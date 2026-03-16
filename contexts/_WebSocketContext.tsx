"use client";

import {
  DeviceData,
  TrackingData,
  TrackingDataEach,
  WebSocketContextType,
  WebSocketData,
  YamlConfig,
  YamlDeviceConfig,
} from "@/app/types";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
  useMemo,
} from "react";
import { DataContext } from "./Datacontext";

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// 型定義
interface MonitoringDB extends IDBDatabase {
  objectStoreNames: DOMStringList;
}

type StoreNames = "desconData" | "cubicleData";

interface StoredData {
  deviceName: string;
  data: DeviceData;
  timestamp: number;
}

// IndexedDBの初期化
const initIndexedDB = (): Promise<MonitoringDB> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("MonitoringDB", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as MonitoringDB);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("desconData")) {
        db.createObjectStore("desconData", { keyPath: "deviceName" });
      }
      if (!db.objectStoreNames.contains("cubicleData")) {
        db.createObjectStore("cubicleData", { keyPath: "deviceName" });
      }
    };
  });
};

// データの保存
const saveToIndexedDB = async (storeName: StoreNames, data: StoredData): Promise<IDBValidKey> => {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// データの取得
const getFromIndexedDB = async (storeName: StoreNames): Promise<StoredData[]> => {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // 結果を適切な型に変換
      const results = request.result as StoredData[];
      resolve(results);
    };
  });
};

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [desconData, setDesconData] = useState<WebSocketData>({});
  const [cubicleData, setCubicleData] = useState<WebSocketData>({});
  // SSR時とCSR時の不整合を防ぐため、初期状態をdisconnectedで統一
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [deviceSettings, setDeviceSettings] = useState<{ [deviceName: string]: any }>({});
  // Hydration対策：クライアントサイドでのみ実行されたかを追跡
  const [isClient, setIsClient] = useState(false);
  
  // WebSocket再試行制御
  const retryCountRef = useRef(0);
  const maxRetries = 3; // 最大3回まで再試行
  
  // メモリ使用量監視用
  const memoryCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // クライアントサイド判定用のuseEffect
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 初期データの読み込み（クライアントサイドでのみ実行）
  useEffect(() => {
    if (!isClient) return;
    
    const loadInitialData = async () => {
      try {
        // 古いデータのクリーンアップ
        const cleanupOldData = async (storeName: StoreNames) => {
          const storedData = await getFromIndexedDB(storeName);
          const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000; // 2時間前のタイムスタンプ
          let hasDeletedData = false;

          for (const data of storedData) {
            if (data.timestamp < twoHoursAgo) {
              const db = await initIndexedDB();
              const transaction = db.transaction(storeName, "readwrite");
              const store = transaction.objectStore(storeName);
              await store.delete(data.deviceName);
              hasDeletedData = true;
            }
          }

          if (hasDeletedData) {
            console.log(`${storeName}の2時間以上前のデータを削除しました`);
          }
        };

        // クリーンアップを実行
        await cleanupOldData("desconData");
        await cleanupOldData("cubicleData");

        const desconStoredData = await getFromIndexedDB("desconData");
        const cubicleStoredData = await getFromIndexedDB("cubicleData");

        // StoredData[]からWebSocketData形式に変換
        if (desconStoredData.length > 0) {
          const convertedDesconData: WebSocketData = {};
          desconStoredData.forEach((item) => {
            convertedDesconData[item.deviceName] = item.data;
          });
          setDesconData(convertedDesconData);
        }

        if (cubicleStoredData.length > 0) {
          const convertedCubicleData: WebSocketData = {};
          cubicleStoredData.forEach((item) => {
            convertedCubicleData[item.deviceName] = item.data;
          });
          setCubicleData(convertedCubicleData);
        }
      } catch (error) {
        console.error("IndexedDBからのデータ読み込みエラー:", error);
      }
    };

    loadInitialData();
    
    // メモリ使用量を監視し、一定以上になったらページをリロードする
    const checkMemoryUsage = () => {
      // TypeScriptの型エラーを回避するため、anyで型アサーションを使用
      const performance = window.performance as any;
      if (performance && performance.memory) {
        const memoryInfo = performance.memory;
        const usedJSHeapSize = memoryInfo.usedJSHeapSize;
        const jsHeapSizeLimit = memoryInfo.jsHeapSizeLimit;
        
        // メモリ使用量がヒープサイズの70%を超えたらリロード
        if (usedJSHeapSize > jsHeapSizeLimit * 0.7) {
          console.log('メモリ使用量が多いため、ページをリロードします');
          window.location.reload();
        }
      }
    };
    
    // 5分ごとにメモリ使用量をチェック
    memoryCheckIntervalRef.current = setInterval(checkMemoryUsage, 5 * 60 * 1000);
    
    // 30分ごとに自動的にページをリロード
    const autoReloadInterval = setInterval(() => {
      console.log('定期的なメンテナンスのため、ページをリロードします');
      window.location.reload();
    }, 30 * 60 * 1000);
    
    return () => {
      if (memoryCheckIntervalRef.current) {
        clearInterval(memoryCheckIntervalRef.current);
      }
      clearInterval(autoReloadInterval);
    };
  }, [isClient]);

  const [trackingData, setTrackingData] = useState<TrackingData>({ trackingData: [] });

  const dataContext = useContext(DataContext);
  const { desconConfigMonitor, cubicleConfigMonitor } = dataContext || {
    desconConfigMonitor: { devices: [] },
    cubicleConfigMonitor: { devices: [] }
  };
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const allDevicesData: YamlConfig = useMemo(() => {
    let devices: YamlDeviceConfig[] = [];

    const hasCubicleDevices = cubicleConfigMonitor?.devices?.length > 0;
    const hasDesconDevices = desconConfigMonitor?.devices?.length > 0;

    if (hasCubicleDevices && hasDesconDevices) {
      // 両方のデバイスがある場合
      devices = [...cubicleConfigMonitor.devices, ...desconConfigMonitor.devices];
    } else if (hasCubicleDevices) {
      // cubicleConfigMonitorのデバイスのみがある場合
      devices = [...cubicleConfigMonitor.devices];
    } else if (hasDesconDevices) {
      // desconConfigMonitorのデバイスのみがある場合
      devices = [...desconConfigMonitor.devices];
    }
    // どちらもない場合は、devicesは空配列のままになります

    return {
      site: "",
      "polling-interval": 0,
      "supervisor-ipaddr": "",
      "supervisor-port": 0,
      "mqtt-ipaddr": "",
      "mqtt-port": 0,
      mails: [],
      phones: [],
      "circuit-names": [],
      devices: devices,
    };
  }, [cubicleConfigMonitor, desconConfigMonitor]);

  useEffect(() => {
    // クライアントサイドでのみWebSocket接続を実行
    if (!isClient) return;
    
    const connect = () => {
      try {
        if (retryCountRef.current >= maxRetries) {
          console.warn(`Maximum WebSocket retry attempts (${maxRetries}) reached. Stopping reconnection attempts.`);
          setConnectionStatus('error');
          return;
        }
        
        setConnectionStatus('connecting');
        retryCountRef.current++;
        const websocket = new WebSocket("ws://localhost:8765");
        setWs(websocket);

        websocket.onopen = () => {
          console.log("🟢 WebSocket connection established");
          setConnectionStatus('connected');
          retryCountRef.current = 0; // 接続成功時はリトライカウントをリセット
          try {
            if (allDevicesData && allDevicesData.devices && allDevicesData.devices.length > 0) {
              websocket.send(JSON.stringify(allDevicesData));
            }
          } catch (error) {
            console.error("初期データ送信エラー:", error);
          }
        };

        websocket.onmessage = async (event: MessageEvent) => {
          try {
            const data = event.data;
            // console.log(event.data);

            // GetDeviceSettingsのレスポンスをチェック
            try {
              const jsonData = JSON.parse(data);
              if (jsonData.request_type === 'GetDeviceSettings') {
                console.log('📥 設定データレスポンス受信:', jsonData);
                if (jsonData.status === 'success') {
                  setDeviceSettings(prev => ({
                    ...prev,
                    [jsonData.device]: jsonData.data
                  }));
                }
                return; // JSON形式のレスポンスの場合はここで終了
              }
            } catch (e) {
              // JSONではない場合は通常の処理を継続
            }

            // メッセージの最初の部分を分割して、デバイス名と他のデータを分離
            const [deviceInfo, ...restData] = data.split(":");
            const deviceName = deviceInfo.split(",")[0];

            // デバイスがdesconかcubicleかを判断
            const isDesconDevice = desconConfigMonitor.devices.some(
              (device) => device.name === deviceName
            );
            const isCubicleDevice = cubicleConfigMonitor.devices.some(
              (device) => device.name === deviceName
            );

            // エラー応答の処理（MEMORYFULL/NG）
            if (restData.length > 0 && restData[0] === "ERROR") {
              console.error(`🔴 [エラー] Device ${deviceName} returned error: ${restData.slice(1).join(":")}`);
              // エラー時は通常のDataRequestに戻るため、ここでは何もしない
              return;
            }

            // 本番用: 実際のエラー応答のみを処理

            // TrackingRecordRequestのデータかどうかを判定
            if (restData.join(":").includes("301,")) {
              const { channel, peakCurrent, unixTime, trackingValues } = parseTrackingData(
                restData.join(":")
              );
              // console.log(channel);
              // console.log(peakCurrent);
              // console.log(unixTime);
              // console.log(trackingValues);

              // UTCからJSTに変換（9時間追加）
              // const timestampData = new Date(Number(unixTime + 9 * 60 * 60) * 1000).toISOString();

              // 現在時刻を取得
              const timestampData = new Date(Date.now()).toISOString();

              // TrackingDataのデータを更新
              setTrackingData((prevTrackingData) => {
                // 新しいトラッキングデータエントリを作成
                const newTrackingEntry: TrackingDataEach = {
                  deviceName,
                  ch: channel,
                  peakCurrent: peakCurrent,
                  values: trackingValues,
                  timestamp: timestampData,
                };

                // 新しいエントリを追加し、最大10個までに制限
                const updatedTrackingData = [...prevTrackingData.trackingData, newTrackingEntry];

                // 配列が10個を超えた場合、古いものから削除
                if (updatedTrackingData.length > 10) {
                  return {
                    trackingData: updatedTrackingData.slice(-10), // 最後の10個を保持
                  };
                }

                return {
                  trackingData: updatedTrackingData,
                };
              });

              // 一度TrackingRecordRequestのデータを受信した後、DataRequestを送信
              const message = JSON.stringify({ request_type: "DataRequest", device: deviceName });
              console.log("Sending message:", message); // メッセージ内容をコンソールに出力
              if (ws) {
                ws.send(message);
              }

              return;
            }

            // DataRequestのデータを処理
            const rawData = restData.join(":");
            const deviceData = parseDeviceData(rawData);
            // console.log(deviceData);

            // TrackingRecordRequestの送信制御（本番用）
            // 電流記録数が2以上の場合のみTrackingRecordRequestを送信

            // deviceData.trackstateのどれかが"WARNING"か"ALARM"に変わったらTrackingRecordRequestを送信
            if (deviceData.trackstate && deviceData.num_current !== undefined) {
              // trackstateの値をチェック
              const hasAlarmOrWarning = Object.values(deviceData.trackstate).some((circuitData) =>
                circuitData.some(([timestamp, state]) => state === "ALARM" || state === "WARNING")
              );

              // 本番用: 実際のALARM/WARNING状態のみを処理

              const hasNumCurrent = deviceData.num_current > 0;

              // トラッキングアラーム時：104番のトラッキング電流値を現在表示の電流値に反映させる
              if (hasAlarmOrWarning && deviceData.trackcurrent) {
                console.log("🔴 トラッキングアラーム検出：104番電流値を反映します");
                
                // trackcurrent (104番) の値を current (102番) にコピーして表示を整合させる
                Object.keys(deviceData.trackcurrent).forEach((circuit) => {
                  const circuitNum = parseInt(circuit);
                  const trackCurrentData = deviceData.trackcurrent?.[circuitNum];
                  if (trackCurrentData && trackCurrentData.length > 0) {
                    const lastTrackCurrentValue = trackCurrentData[trackCurrentData.length - 1];
                    console.log(`🔴 回路${circuitNum}: トラッキング電流値 ${lastTrackCurrentValue[1]}A を表示電流値に反映`);
                    
                    // current配列に104番の値を追加/更新
                    if (!deviceData.current) deviceData.current = {};
                    if (!deviceData.current[circuitNum]) deviceData.current[circuitNum] = [];
                    
                    // 最新の値を追加（重複チェック）
                    const existingCurrentData = deviceData.current[circuitNum];
                    const lastTimestamp = lastTrackCurrentValue[0];
                    const existingIndex = existingCurrentData.findIndex(([timestamp]) => timestamp === lastTimestamp);
                    
                    if (existingIndex >= 0) {
                      // 既存のデータを更新
                      existingCurrentData[existingIndex] = lastTrackCurrentValue;
                    } else {
                      // 新しいデータを追加
                      existingCurrentData.push(lastTrackCurrentValue);
                      // 配列サイズを制限
                      if (existingCurrentData.length > 180) {
                        deviceData.current[circuitNum] = existingCurrentData.slice(-180);
                      }
                    }
                  }
                });
              }

              if (hasAlarmOrWarning && hasNumCurrent) {
                const message = JSON.stringify({
                  request_type: "TrackingRecordRequest",
                  device: deviceName,
                });
                console.log("Sending message:", message);
                if (ws) {
                  ws.send(message);
                }
              }
            }

            // デバイスタイプに応じてデータを更新
            const updateData = (prevData: WebSocketData): WebSocketData => {
              const updatedDeviceData = (prevData[deviceName] || {}) as Partial<DeviceData>;

              Object.entries(deviceData).forEach(([key, value]) => {
                const keyTyped = key as keyof DeviceData;

                if (
                  [
                    "temperature",
                    "tempstate",
                    "current",
                    "currstate",
                    "trackcurrent",
                    "trackstate",
                    "leakcurrent",
                    "leakstate",
                    "voltage",
                    "voltstate",
                  ].includes(keyTyped)
                ) {
                  const newValue = value as
                    | Record<number, [string, number][]>
                    | Record<number, [string, string][]>;
                  updatedDeviceData[keyTyped] = updatedDeviceData[keyTyped] || ({} as any); // 型キャスト

                  Object.entries(newValue).forEach(([circuit, circuitData]) => {
                    let existingData =
                      (updatedDeviceData[keyTyped] as any)[parseInt(circuit)] || [];

                    // circuitDataが空でないことを確認
                    if (circuitData && Array.isArray(circuitData) && circuitData.length > 0) {
                      const newData = circuitData[circuitData.length - 1];
                      // newDataが配列であり、要素が存在することを確認
                      if (newData && Array.isArray(newData) && newData.length > 0) {
                        const existingTimestamps = existingData.map((data: any) => data[0]);

                        if (!existingTimestamps.includes(newData[0])) {
                          existingData.push(newData);
                        }

                        if (existingData.length > 180) {
                          existingData = existingData.slice(-180);
                        }
                      }
                    }

                    (updatedDeviceData[keyTyped] as any)[parseInt(circuit)] = existingData;
                  });
                } else if (["input", "inputstate", "relay", "num_current"].includes(keyTyped)) {
                  updatedDeviceData[keyTyped] = value as any; // 型キャスト
                } else if (keyTyped === "timestamp") {
                  updatedDeviceData[keyTyped] = value as number;
                } else if (keyTyped === "timestampData") {
                  updatedDeviceData[keyTyped] = value as string;
                }
              });

              return {
                ...prevData,
                [deviceName]: updatedDeviceData,
              };
            };

            if (isDesconDevice) {
              setDesconData((prevData) => {
                const newData = updateData(prevData);
                // IndexedDBに保存
                const storedData: StoredData = {
                  deviceName,
                  data: newData[deviceName] as DeviceData,
                  timestamp: Date.now(),
                };
                saveToIndexedDB("desconData", storedData).catch((error) => {
                  console.error("IndexedDBへの保存エラー:", error);
                });
                return newData;
              });
            } else if (isCubicleDevice) {
              setCubicleData((prevData) => {
                const newData = updateData(prevData);
                // IndexedDBに保存
                const storedData: StoredData = {
                  deviceName,
                  data: newData[deviceName] as DeviceData,
                  timestamp: Date.now(),
                };
                saveToIndexedDB("cubicleData", storedData).catch((error) => {
                  console.error("IndexedDBへの保存エラー:", error);
                });
                return newData;
              });
            }
          } catch (error) {
            console.error("メッセージ処理エラー:", error);
          }
        };

        websocket.onerror = (error) => {
          console.error("🔴 WebSocket error:", error);
          
          // エラーの種類に応じて適切なメッセージを表示
          if (error instanceof Event && error.type === 'error') {
            console.warn("🔴 WebSocket connection error occurred. This may be due to:");
            console.warn("1. Python backend not running (run 'python backend/server.py')");
            console.warn("2. Port 8765 already in use");
            console.warn("3. Network connectivity issues");
          }
          
          setConnectionStatus('error');
          
          // エラー時も再接続を試行（最大回数まで）
          if (retryCountRef.current < maxRetries) {
            const retryDelay = Math.min(10000 * retryCountRef.current, 30000); // 10秒、20秒、30秒
            setTimeout(() => {
              console.log(`Retrying WebSocket connection after error... (${retryCountRef.current + 1}/${maxRetries})`);
              connect();
            }, retryDelay);
          }
        };

        websocket.onclose = (event) => {
          console.log("🔴 WebSocket connection closed", event.code, event.reason);
          setConnectionStatus('disconnected');
          
          // 正常なクローズ (1000) や意図的なクローズの場合は再接続しない
          if (event.code === 1000 || event.code === 1001) {
            console.log("🟢 WebSocket closed normally, not reconnecting");
            return;
          }
          
          // 接続拒否 (1006) やその他のエラーの場合は段階的再接続
          if (retryCountRef.current < maxRetries) {
            // 段階的な再接続間隔：5秒、10秒、20秒
            const retryDelay = Math.min(5000 * Math.pow(2, retryCountRef.current), 20000);
            
            setTimeout(() => {
              console.log(`🔄 Attempting to reconnect... (${retryCountRef.current + 1}/${maxRetries}) in ${retryDelay/1000}s`);
              connect(); // 再接続を試みる
            }, retryDelay);
          } else {
            console.error("🔴 Maximum WebSocket retry attempts reached. Connection disabled.");
            setConnectionStatus('error');
          }
        };

        setSocket(websocket);
      } catch (error) {
        console.error("WebSocket接続エラー:", error);
        setConnectionStatus('error');
        
        if (retryCountRef.current < maxRetries) {
          const retryDelay = Math.min(15000 * retryCountRef.current, 45000); // 15秒、30秒、45秒
          console.warn(`Failed to establish WebSocket connection. Retrying in ${retryDelay/1000} seconds... (${retryCountRef.current}/${maxRetries})`);
          setTimeout(connect, retryDelay);
        } else {
          console.warn("Maximum retry attempts reached. WebSocket connection disabled.");
          console.warn("Real-time monitoring features are unavailable. Please:");
          console.warn("1. Ensure Python backend is running: python backend/server.py");
          console.warn("2. Check if port 8765 is available");
          console.warn("3. Restart the application if needed");
        }
      }
    };

    connect();

    return () => {
      if (socket) {
        socket.close();
      }
      // メモリ監視とオートリロードのインターバルをクリア
      if (memoryCheckIntervalRef.current) {
        clearInterval(memoryCheckIntervalRef.current);
      }
    };
  }, [isClient, allDevicesData]); // isClientを依存配列に追加

  // allDevicesDataが変更されたときにデータを送信
  useEffect(() => {
    if (socket && socket.readyState === WebSocket.OPEN && allDevicesData.devices.length > 0) {
      try {
        console.log("新しいデバイス設定をWebSocketに送信中:", allDevicesData.devices.length, "台");
        socket.send(JSON.stringify(allDevicesData));
        console.log("🟢 デバイス設定の送信が完了しました。バックエンドが新しい設定を使用します。");
      } catch (error) {
        console.error("🔴 デバイスデータ送信エラー:", error);
      }
    }
  }, [allDevicesData, socket]); // socketも依存配列に追加

  const parseDeviceData = (data: string): Partial<DeviceData> => {
    try {
      const lines = data.split("\n");
      const temperature: Record<number, [string, number][]> = {};
      const tempstate: Record<number, [string, string][]> = {};
      const current: Record<number, [string, number][]> = {};
      const currstate: Record<number, [string, string][]> = {};
      const trackcurrent: Record<number, [string, number][]> = {};
      const trackstate: Record<number, [string, string][]> = {};
      const leakcurrent: Record<number, [string, number][]> = {};
      const leakstate: Record<number, [string, string][]> = {};
      const voltage: Record<number, [string, number][]> = {};
      const voltstate: Record<number, [string, string][]> = {};
      const input: string[] = [];
      const inputstate: string[] = [];
      const relay: string[] = [];
      let num_current: number = 0;
      let deviceTimestamp: number | undefined;

      // デバイスの時間を最初に取得
      // const timeLine = lines.find(line => line.startsWith('170,'));
      // if (timeLine) {
      //     const [, timeValue] = timeLine.split(',');
      //     const parsedTime = parseInt(timeValue);
      //     if (!isNaN(parsedTime)) {
      //         // UTCからJSTに変換（9時間追加）
      //         deviceTimestamp = (parsedTime + 9 * 60 * 60) * 1000; // ミリ秒に変換
      //     }
      // }

      // const timestamp = deviceTimestamp || Date.now();
      // const timestampData = new Date(timestamp).toISOString();

      // 現在時刻を取得
      const timestamp = Date.now();
      const timestampData = new Date(timestamp).toISOString();

      // 有効な数値かどうかをチェックする関数
      const isValidNumber = (value: any): boolean => {
        const num = parseFloat(value);
        return !isNaN(num) && isFinite(num);
      };

      lines.forEach((line) => {
        const [id, ...rest] = line.split(",");

        switch (id) {
          case "100":
            rest.forEach((item) => {
              const [circuit, value] = item.split("=");
              if (circuit !== undefined && value !== undefined) {
                const circuitNumber = parseInt(circuit);
                if (!temperature[circuitNumber]) {
                  temperature[circuitNumber] = [];
                }
                // 異常な温度値（例：-60℃など）をフィルタリング
                if (isValidNumber(value)) {
                  const tempValue = parseFloat(value);
                  if (isFinite(tempValue) && tempValue > -50 && tempValue < 150) {
                    temperature[circuitNumber].push([timestampData, tempValue]);
                  }
                }
              }
            });
            break;
          case "101":
            rest.forEach((item) => {
              const [circuit, value] = item.split("=");
              if (circuit !== undefined && value !== undefined) {
                const circuitNumber = parseInt(circuit);
                if (!tempstate[circuitNumber]) {
                  tempstate[circuitNumber] = [];
                }
                tempstate[circuitNumber].push([timestampData, value.trim()]);
              }
            });
            break;
          case "102":
            rest.forEach((item) => {
              const [circuit, value] = item.split("=");
              if (circuit !== undefined && value !== undefined) {
                const circuitNumber = parseInt(circuit);
                if (!current[circuitNumber]) {
                  current[circuitNumber] = [];
                }
                // 無効な電流値をフィルタリング
                if (isValidNumber(value)) {
                  const currValue = parseFloat(value);
                  if (isFinite(currValue) && !isNaN(currValue) && currValue !== Infinity && currValue !== -Infinity) {
                    current[circuitNumber].push([timestampData, currValue]);
                  }
                }
              }
            });
            break;
          case "103":
            rest.forEach((item) => {
              const [circuit, value] = item.split("=");
              if (circuit !== undefined && value !== undefined) {
                const circuitNumber = parseInt(circuit);
                if (!currstate[circuitNumber]) {
                  currstate[circuitNumber] = [];
                }
                currstate[circuitNumber].push([timestampData, value.trim()]);
              }
            });
            break;
          case "104":
            rest.forEach((item) => {
              const [circuit, value] = item.split("=");
              if (circuit !== undefined && value !== undefined) {
                const circuitNumber = parseInt(circuit);
                if (!trackcurrent[circuitNumber]) {
                  trackcurrent[circuitNumber] = [];
                }
                // 無効なトラッキング電流値をフィルタリング
                if (isValidNumber(value)) {
                  const trackValue = parseFloat(value);
                  if (isFinite(trackValue)) {
                    trackcurrent[circuitNumber].push([timestampData, trackValue]);
                  }
                }
              }
            });
            break;
          case "105":
            rest.forEach((item) => {
              const [circuit, value] = item.split("=");
              if (circuit !== undefined && value !== undefined) {
                const circuitNumber = parseInt(circuit);
                if (!trackstate[circuitNumber]) {
                  trackstate[circuitNumber] = [];
                }
                trackstate[circuitNumber].push([timestampData, value.trim()]);
              }
            });
            break;
          case "106":
            rest.forEach((item) => {
              const [circuit, value] = item.split("=");
              if (circuit !== undefined && value !== undefined) {
                const circuitNumber = parseInt(circuit);
                if (!leakcurrent[circuitNumber]) {
                  leakcurrent[circuitNumber] = [];
                }
                // 無効な漏洩電流値をフィルタリング
                if (isValidNumber(value)) {
                  const leakValue = parseFloat(value);
                  if (isFinite(leakValue)) {
                    leakcurrent[circuitNumber].push([timestampData, leakValue]);
                  }
                }
              }
            });
            break;
          case "107":
            rest.forEach((item) => {
              const [circuit, value] = item.split("=");
              if (circuit !== undefined && value !== undefined) {
                const circuitNumber = parseInt(circuit);
                if (!leakstate[circuitNumber]) {
                  leakstate[circuitNumber] = [];
                }
                leakstate[circuitNumber].push([timestampData, value.trim()]);
              }
            });
            break;
          case "110":
            // 電圧データ (Voltage Data)
            rest.forEach((item) => {
              const [circuit, value] = item.split("=");
              if (circuit !== undefined && value !== undefined) {
                const circuitNumber = parseInt(circuit);
                if (isValidNumber(value)) {
                  const voltValue = parseFloat(value);
                  if (isFinite(voltValue) && !isNaN(voltValue)) {
                    if (!voltage[circuitNumber]) {
                      voltage[circuitNumber] = [];
                    }
                    voltage[circuitNumber].push([timestampData, voltValue]);
                  }
                }
              }
            });
            break;
          case "111":
            // 電圧状態 (Voltage State) - 数値は電圧データ、文字列は状態
            rest.forEach((item) => {
              const [circuit, value] = item.split("=");
              if (circuit !== undefined && value !== undefined) {
                const circuitNumber = parseInt(circuit);
                if (isValidNumber(value)) {
                  if (!voltage[circuitNumber]) {
                    voltage[circuitNumber] = [];
                  }
                  const voltValue = parseFloat(value);
                  if (isFinite(voltValue) && !isNaN(voltValue)) {
                    voltage[circuitNumber].push([timestampData, voltValue]);
                  }
                } else {
                  if (!voltstate[circuitNumber]) {
                    voltstate[circuitNumber] = [];
                  }
                  voltstate[circuitNumber].push([timestampData, value.trim()]);
                }
              }
            });
            break;
          case "108":
            rest.forEach((item) => {
              const [inputCircuit, inputValue] = item.split("=");
              if (inputCircuit !== undefined && inputValue !== undefined) {
                input.push(inputCircuit.trim());
                inputstate.push(inputValue.trim());
              }
            });
            break;
          case "109":
            rest.forEach((item) => {
              const [circuit, value] = item.split("=");
              if (circuit !== undefined && value !== undefined) {
                relay.push(value.trim());
              }
            });
            break;
          case "160":
            if (rest.length > 0) {
              const value = parseInt(rest[0]);
              if (!isNaN(value)) {
                num_current = value;
              }
            }
            break;
        }
      });

      return {
        temperature,
        tempstate,
        current,
        currstate,
        trackcurrent,
        trackstate,
        leakcurrent,
        leakstate,
        voltage,
        voltstate,
        input,
        inputstate,
        relay,
        num_current,
        timestamp,
        timestampData,
      };
    } catch (error) {
      console.error("デバイスデータのパースエラー:", error);
      return {};
    }
  };

  // TrackingRecordRequestのデータを解析する関数
  const parseTrackingData = (data: string) => {
    try {
      const lines = data.split("\n");
      let channel = 0;
      let peakCurrent = 0;
      let unixTime = 0;

      // 1. '300,'で始まる行を処理してチャネル番号を取得
      const channelLine = lines.find((line) => line.startsWith("300,"));
      if (channelLine) {
        const channelParts = channelLine.split(",");
        if (channelParts.length >= 2) {
          channel = parseInt(channelParts[1], 10);
          peakCurrent = parseFloat(channelParts[2]);
          unixTime = parseInt(channelParts[4]);
        }
      }

      // 2. '301,'で始まる行を処理してvaluesを取得
      const trackingValues = lines
        .filter((line) => line.startsWith("301,"))
        .flatMap((line) =>
          line
            .split(",")
            .slice(1)
            .map((value) => parseFloat(value.trim()))
        );

      return { channel, peakCurrent, unixTime, trackingValues };
    } catch (error) {
      console.error("トラッキングデータのパースエラー:", error);
      return { channel: 0, peakCurrent: 0, unixTime: 0, trackingValues: [] };
    }
  };

  // sendMessage関数を実装
  const sendMessage = async (message: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.error("WebSocket接続が確立されていません");
        reject(new Error("WebSocket connection not established"));
        return;
      }

      try {
        console.log("📤 WebSocketメッセージ送信:", message);
        ws.send(message);
        resolve();
      } catch (error) {
        console.error("❌ WebSocketメッセージ送信エラー:", error);
        reject(error);
      }
    });
  };

  return (
    <WebSocketContext.Provider value={{ 
      desconData, 
      cubicleData, 
      trackingData, 
      setTrackingData, 
      connectionStatus, 
      sendMessage,
      deviceSettings,
      setDeviceSettings
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketData = (): [WebSocketData, WebSocketData, string] => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocketData must be used within a WebSocketProvider");
  }
  return [context.desconData, context.cubicleData, context.connectionStatus];
};

export const useTrackingData = (): [
  TrackingData,
  React.Dispatch<React.SetStateAction<TrackingData>>
] => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useTrackingData must be used within a WebSocketProvider");
  }
  return [context.trackingData, context.setTrackingData];
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return {
    sendMessage: context.sendMessage,
    connectionStatus: context.connectionStatus,
    desconData: context.desconData,
    cubicleData: context.cubicleData,
    trackingData: context.trackingData,
    setTrackingData: context.setTrackingData,
    deviceSettings: context.deviceSettings,
    setDeviceSettings: context.setDeviceSettings
  };
};