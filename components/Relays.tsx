'use client'

import { TableRowRelays, YamlDeviceConfig } from '@/app/types';
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';

import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"

  interface RelayProps {
    selectedDeviceName: string
    isEditable: boolean;
    config: YamlDeviceConfig[];
    onEdit: () => void;
    seteditConfig: (config: YamlDeviceConfig[]) => void;
    relayTableData: TableRowRelays[];
    setrelayTableData: (tabledata: TableRowRelays[]) => void;
  }
  
  
  export function RelayDetailSetting( {selectedDeviceName, isEditable, config, onEdit, seteditConfig, relayTableData, setrelayTableData} : RelayProps) {
    const { sendMessage, deviceSettings } = useWebSocket();
    const [isLoading, setIsLoading] = useState(false);
    
    // deviceSettingsの最新の値を常に参照できるようにuseRefを使用
    const deviceSettingsRef = useRef(deviceSettings);
    
    // deviceSettingsが更新されたらrefも更新
    useEffect(() => {
      deviceSettingsRef.current = deviceSettings;
    }, [deviceSettings]);
    const [deviceDetail, setDeviceDetail] = useState<YamlDeviceConfig>({
        name: '',
        model: '',
        ipaddr: '',
        port: 0,
        circuits: [],
        "temp-names": [],
        "track-names": [],
        "curr-names": [],
        "leak-names": [],
        "volt-names": [],
        "brkr-names": [],
        "brkr-sens": [],
        "input-names": [],
        "brkr": [],
        input: [],
        temp: [],
        track: [],
        curr: [],
        leak: [],
        volt: [],
        time: [],
        ptc: [],
    });
    const [hasBrkrSens, setHasBrkrSens] = useState(false);
    const [hasBrkr, setHasBrkr] = useState(false);

    const processEmpData = (empData: string) => {
      if (!empData) return [];

      const processedData: string[] = empData.split(",").map((item) => {
        const [key, val] = item.split("=");
        return val;
      });
      return processedData;
    };
    
    useEffect(() => {
      async function processData() {
          if (selectedDeviceName) {
              const device = config.find(device => device.name === selectedDeviceName);
              if (device) {
                  setDeviceDetail(device);

                  const deviceHasBrkrSens = Array.isArray(device["brkr-sens"]) && device["brkr-sens"].length > 0;
                  setHasBrkrSens(deviceHasBrkrSens);
                  
                  const deviceHasBrkr = Array.isArray(device["brkr"]) && device["brkr"].length > 0;
                  setHasBrkr(deviceHasBrkr);
  
                  // 行名の決定: brkr-names が空の場合のフォールバック（T24C10B10A は temp-names 偶数インデックス）
                  let rowNames: string[] = [];
                  if (Array.isArray(device["brkr-names"]) && device["brkr-names"].length > 0) {
                    rowNames = device["brkr-names"] as unknown as string[];
                  } else if (device.model === "T24C10B10A" && Array.isArray(device["temp-names"]) && device["temp-names"].length > 0) {
                    // 偶数インデックス(0-based)のみを採用
                    rowNames = device["temp-names"].filter((_, idx) => idx % 2 === 0);
                    // 主幹や盤内温度等は除外
                    rowNames = rowNames.filter(name => name !== "主幹" && name !== "盤内温度" && name !== "未使用");
                  } else {
                    rowNames = [];
                  }
  
                  const tabledetailData: TableRowRelays[] = [];
                  for (let i = 0; i < rowNames.length; i++) {
                    const circuitName = rowNames[i];
                    // name一致でサーチ（key一致は厳しすぎて初期表示が空になる原因になる）
                    const circuitIndex = device["circuits"].findIndex(circuit => circuit.name === circuitName);

                    const outputMax = rowNames.length;
                    const outputVal = circuitIndex !== -1 ? device["circuits"][circuitIndex]["output"] : 0;
                      tabledetailData.push({
                          "sensor-No": i+1,
                          "circuit-name": circuitName,
                        power: circuitIndex !== -1 ? device["circuits"][circuitIndex]["power"] : '',
                        breaker: circuitIndex !== -1 ? device["circuits"][circuitIndex]["breaker"] : '',
                        wire: circuitIndex !== -1 ? device["circuits"][circuitIndex]["wire"] : '',
                        "relay-link-to": circuitIndex !== -1 ? (outputVal <= outputMax ? outputVal : 0) : 0,
                          "relay-auto-trip": circuitIndex !== -1 ? device["circuits"][circuitIndex]["autotrip"] : 0,
                        "brkr-sens-curr": deviceHasBrkrSens ? device["brkr-sens"][i]?.toFixed?.(1) ?? '' : '',
                        // 設定ファイルが空のときは空文字を採用（以前はOFF）
                        "brkr-trip-status": deviceHasBrkr ? (processEmpData(device["brkr"][0])?.[i+2] ?? '') : '',
                    });
                  }
                  // 編集中のリセットを避ける: 既存のテーブルがあり編集中なら上書きしない
                  if (isEditable && relayTableData && relayTableData.length > 0) {
                    // 既存行をベースに、存在しない行だけ追加
                    const merged = relayTableData.map((row, idx) => ({
                      ...tabledetailData[idx],
                      ...row, // 既存のユーザー編集値を優先
                    }));
                    setrelayTableData(merged);
                  } else {
                  setrelayTableData(tabledetailData);
                  }
              }
          }
      }
      processData();
    }, [selectedDeviceName]);

    // ジュール熱詳細設定からの回路名・電源種別変更イベントをリッスン
    useEffect(() => {
      const handleCircuitNameChange = (event: CustomEvent) => {
        if (event.detail.deviceName === selectedDeviceName && (deviceDetail.model === "T24C10B10A" || deviceDetail.model === "T24R8A" || deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T64C30B30I1")) {
          const { oldCircuitName, newCircuitName, newPower, newBreaker } = event.detail;
          
          // ブレーカーテーブルの回路名、電源種別、ブレーカーを更新
          const updatedTableData = relayTableData.map(row => {
            if (row["circuit-name"] === oldCircuitName) {
              return {
                ...row,
                "circuit-name": newCircuitName,
                power: newPower || row.power,
                breaker: newBreaker || row.breaker
              };
            }
            return row;
          });
          setrelayTableData(updatedTableData);
        }
      };

      const handlePowerChange = (event: CustomEvent) => {
        if (event.detail.deviceName === selectedDeviceName && (deviceDetail.model === "T24C10B10A" || deviceDetail.model === "T24R8A" || deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T64C30B30I1")) {
          const { circuitName, newPower } = event.detail;
          
          // ブレーカーテーブルの電源種別を更新
          const updatedTableData = relayTableData.map(row => {
            if (row["circuit-name"] === circuitName) {
              return {
                ...row,
                power: newPower
              };
            }
            return row;
          });
          setrelayTableData(updatedTableData);
        }
      };

      window.addEventListener('tempTableCircuitNameChange', handleCircuitNameChange as EventListener);
      window.addEventListener('tempTablePowerChange', handlePowerChange as EventListener);
      
      return () => {
        window.removeEventListener('tempTableCircuitNameChange', handleCircuitNameChange as EventListener);
        window.removeEventListener('tempTablePowerChange', handlePowerChange as EventListener);
      };
    }, [selectedDeviceName, deviceDetail.model, relayTableData, setrelayTableData]);

    // バックエンドからブレーカー設定データを読み出す機能
    const updateRelayTableWithBackendData = (backendSettings: any) => {
      if (!backendSettings?.brkr_settings && !backendSettings?.circuits) {
        console.warn('⚠️ バックエンドブレーカー設定データが不完全です');
        return;
      }

      const circuits = backendSettings.circuits || [];
      const brkrNames = backendSettings.brkr_names || [];
      const tempNames = backendSettings.temp_names || [];
      const deviceModel = backendSettings.device_info?.model || deviceDetail.model;
      const brkrSettings = backendSettings.brkr_settings;
      
      const updatedTableData = relayTableData.map(row => {
        const channelNum = row["sensor-No"];
        
        // 回路名を取得
        let circuitName = row["circuit-name"];
        let power = row.power;
        let breaker = row.breaker;
        let wire = row.wire;
        
        // T24C10B10Aの場合はtemp-namesから取得（偶数インデックス）
        if (deviceModel === "T24C10B10A" && tempNames.length > 0) {
          // brkr-namesのインデックス（0-based）からtemp-namesの偶数インデックスを計算
          const tempNameIndex = (channelNum - 1) * 2; // 0 -> 0, 1 -> 2, 2 -> 4, ...
          if (tempNameIndex >= 0 && tempNameIndex < tempNames.length) {
            const tempName = tempNames[tempNameIndex];
            
            // circuitsから対応する回路情報を取得
            const circuit = circuits.find((c: any) => c.name === tempName);
            if (circuit) {
              circuitName = circuit.name;
              power = circuit.power || power;
              breaker = circuit.breaker || breaker;
              wire = circuit.wire || wire;
            }
          }
        } else if (deviceModel === "T24R8A") {
          // T24R8Aはcircuitsの並びがそのままブレーカーチャンネルと一致
          const idx = channelNum - 1;
          if (idx >= 0 && idx < circuits.length) {
            const circuit = circuits[idx];
            if (circuit) {
              circuitName = circuit.name || circuitName;
              power = circuit.power || power;
              breaker = circuit.breaker || breaker;
              wire = circuit.wire || wire;
            }
          }
        } else {
          // その他のモデルはbrkr-namesから取得
          const brkrNameIndex = channelNum - 1;
          if (brkrNameIndex >= 0 && brkrNameIndex < brkrNames.length) {
            const brkrName = brkrNames[brkrNameIndex];
            
            // circuitsから対応する回路情報を取得
            const circuit = circuits.find((c: any) => c.name === brkrName);
            if (circuit) {
              circuitName = circuit.name;
              power = circuit.power || power;
              breaker = circuit.breaker || breaker;
              wire = circuit.wire || wire;
            }
          }
        }
        
        return {
          ...row,
          "circuit-name": circuitName,
          power: power,
          breaker: breaker,
          wire: wire,
          "brkr-sens-curr": brkrSettings?.sensitivities?.[channelNum] !== undefined 
            ? brkrSettings.sensitivities[channelNum].toFixed(1) 
            : row["brkr-sens-curr"],
          "brkr-trip-status": brkrSettings?.trip_detection?.[channelNum] !== undefined 
            ? brkrSettings.trip_detection[channelNum] 
            : row["brkr-trip-status"],
          // circuits[i].autotripを更新
          "relay-auto-trip": circuits.find((c: any) => c.name === circuitName)?.autotrip ?? row["relay-auto-trip"]
        };
      });

      setrelayTableData(updatedTableData);
    };

    const handleReadDeviceData = async () => {
      if (!selectedDeviceName) {
        console.warn('デバイスが選択されていません');
        return;
      }

      setIsLoading(true);
      
      try {
        console.log('🔧 バックエンドブレーカー設定データ読み出し開始:', selectedDeviceName);
        
        if (!sendMessage) {
          setIsLoading(false);
          return;
        }
        
        // configから現在のデバイス情報を取得
        const currentDevice = config.find(device => device.name === selectedDeviceName);
        if (!currentDevice) {
          setIsLoading(false);
          console.warn('デバイス情報が見つかりません');
          return;
        }
        
        // 読み出し前の設定状態を記録（最新の値を取得）
        const currentDeviceSettings = deviceSettingsRef.current;
        const deviceKey = `${currentDevice.ipaddr}:${currentDevice.port}`;
        const beforeTimestamp = currentDeviceSettings?.[deviceKey]?.timestamp || 0;
        
        const getSettingsRequest = {
          request_type: 'GetDeviceSettings',
          ipaddr: currentDevice.ipaddr,
        port: currentDevice.port
      };

      await sendMessage(JSON.stringify(getSettingsRequest));

        let attempts = 0;
        const maxAttempts = 30; // 15秒間（500ms × 30回）
        let checkTimeoutId: NodeJS.Timeout | null = null;
        
        const checkResponse = () => {
          attempts++;
          // 最新のdeviceSettingsを取得（IPアドレス:ポートのキーで検索）
        const currentDeviceSettings = deviceSettingsRef.current;
        const afterReadSettings = currentDeviceSettings?.[deviceKey];
        const afterTimestamp = afterReadSettings?.timestamp || 0;
        
        if (afterReadSettings && afterReadSettings.brkr_settings) {
            const isTimestampUpdated = afterTimestamp > beforeTimestamp;
            
            if (isTimestampUpdated) {
              if (checkTimeoutId) {
                clearTimeout(checkTimeoutId);
              }
              
              console.log('📊 [ブレーカー] データ更新:', {
                beforeTimestamp,
                afterTimestamp,
                hasBrkrSettings: !!afterReadSettings.brkr_settings
              });
              
              // ⚠️ 重要: config更新による再レンダリング後にテーブルを更新
              setTimeout(() => {
                updateRelayTableWithBackendData(afterReadSettings);
                setIsLoading(false);
                // 親コンポーネントに成功を通知
                const resultEvent = new CustomEvent('deviceDataReadResult', {
                  detail: { success: true, timeout: false }
                });
                window.dispatchEvent(resultEvent);
              }, 100);
              return;
            }
          }
          
        if (attempts >= maxAttempts) {
          setIsLoading(false);
          console.warn('⚠️ ブレーカー設定データが見つかりません');
          // 親コンポーネントにタイムアウトを通知
          const resultEvent = new CustomEvent('deviceDataReadResult', {
            detail: { success: false, timeout: true }
          });
          window.dispatchEvent(resultEvent);
          return;
        }
          
          checkTimeoutId = setTimeout(checkResponse, 500);
        };
        
        checkTimeoutId = setTimeout(checkResponse, 1000);

      } catch (error) {
        console.error('❌ バックエンドブレーカー設定データ読み出しエラー:', error);
        setIsLoading(false);
        // 親コンポーネントにエラーを通知
        const resultEvent = new CustomEvent('deviceDataReadResult', {
          detail: { success: false, timeout: true }
        });
        window.dispatchEvent(resultEvent);
      }
    };

    // 設定データ変更機能
    const handleWriteDeviceData = async () => {
      if (!selectedDeviceName) {
        alert('デバイスが選択されていません。');
        return;
      }

      setIsLoading(true);
      
      try {
        console.log('🔧 バックエンドブレーカー設定データ変更開始:', selectedDeviceName);
        
        // WebSocket接続状態をチェック
        if (!sendMessage) {
          setIsLoading(false);
          alert('エラー: バックエンドサーバーに接続できません。\nサーバーが起動しているか確認してください。');
          return;
        }

        // configから現在のデバイス情報を取得
        const currentDevice = config.find(device => device.name === selectedDeviceName);
        if (!currentDevice) {
          setIsLoading(false);
          alert('エラー: デバイス情報が見つかりません。');
          return;
        }

        // 現在表示中のテーブルデータをバックエンド用の設定形式に変換
        const brkrSettings: { [key: string]: { [channel: number]: any } } = {
          trip_detection: {}
        };

        const circuits: any[] = [];

        // relayTableDataから設定値を抽出
        console.log('🔍 現在のブレーカーテーブルデータ:', relayTableData);
        relayTableData.forEach((row, index) => {
          const channel = row["sensor-No"];
          
          // ブレーカー遮断検知設定
          if (hasBrkr) {
            brkrSettings.trip_detection[channel] = row["brkr-trip-status"];
          }

          // 自動遮断設定（circuitsに含める）
          circuits.push({
            name: row["circuit-name"],
            autotrip: row["relay-auto-trip"]
          });
        });

        // バックエンドに設定変更を送信（IPアドレスとポートで識別）
        const updateSettingsRequest = {
          request_type: 'UpdateDeviceSettings',
          ipaddr: currentDevice.ipaddr,
          port: currentDevice.port,
          brkr_settings: hasBrkr ? brkrSettings : undefined,
          circuits: circuits
        };

        console.log('📤 送信データ:', updateSettingsRequest);
        await sendMessage(JSON.stringify(updateSettingsRequest));

        setIsLoading(false);
        console.log('✅ ブレーカー設定データ送信完了');

      } catch (error) {
        console.error('❌ バックエンドブレーカー設定データ変更エラー:', error);
        setIsLoading(false);
        alert('エラー: バックエンドへの設定データ変更に失敗しました。');
      }
    };

    // deviceDataReadイベントとdeviceDataWriteイベントを受信
    useEffect(() => {
      const handleDeviceDataReadEvent = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { deviceName } = customEvent.detail;
        if (deviceName === selectedDeviceName) {
          console.log('📥 [ブレーカー] 読み出しイベント受信:', deviceName);
          handleReadDeviceData();
        }
      };

      const handleDeviceDataWriteEvent = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail.deviceName === selectedDeviceName) {
          handleWriteDeviceData();
        }
      };

      window.addEventListener('deviceDataRead', handleDeviceDataReadEvent);
      window.addEventListener('deviceDataWrite', handleDeviceDataWriteEvent);
      return () => {
        window.removeEventListener('deviceDataRead', handleDeviceDataReadEvent);
        window.removeEventListener('deviceDataWrite', handleDeviceDataWriteEvent);
      };
    }, [selectedDeviceName, deviceSettings, relayTableData, hasBrkr]);

    const handleInputChangeRelay = ( value: string, circuitName: string) => {
      const newConfig: YamlDeviceConfig[] = config.map((device) => {
        if (device.name === selectedDeviceName) {
          // circuitsの更新
          const updatedCircuits = device.circuits.map((circuit) => {
            if (circuit.name === circuitName) {
              return {
                ...circuit,
                autotrip: value === '1' ? 1 : 0,
              };
            }
            return circuit;
          });
    
          return {
            ...device,
            circuits: updatedCircuits,
          };
        }
        return device;
      });
    
      seteditConfig(newConfig);
      // ローカルテーブルも即時反映（他の列は維持）
      const updatedTable = relayTableData.map((row) => {
        if (row["circuit-name"] === circuitName) {
          return { ...row, "relay-auto-trip": value === '1' ? 1 : 0 };
        }
        return row;
      });
      setrelayTableData(updatedTable);
    };

    const handleInputChange = (index: number, field: string, value: string) => {
      const updatedTableData = relayTableData.map((row, rowIndex) => {
        if (rowIndex === index) {
          return {
            ...row,
            [field]: value,
          };
        }
        return row;
      });
      setrelayTableData(updatedTableData);
    };
    
    return (
      <Table className="m-4 text-sm ml-12 w-11/12">
        <TableCaption className="text-lg font-bold mb-2 caption-top">ブレーカー設定</TableCaption>
        <TableHeader className="bg-yellow-300">
          <TableRow>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">リモート装置種別:</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">
                {deviceDetail.model === "T64C30B30I1" ? "電灯盤用B" : 
                    deviceDetail.model === "T28C16R8I1" ? "動力盤用B" : 
                    deviceDetail.model === "T16I4C4R4" ? "動力盤用A" : 
                    deviceDetail.model === "T24C10B10A" ? "ホーム分電盤用A" : 
                    deviceDetail.model === "T24C10B10AD" ? "ホーム分電盤用B" :
                    deviceDetail.name }
            </TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center" colSpan={2}>自動遮断</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">漏電ブレーカー</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">遮断検知</TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">IPアドレス:</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">{deviceDetail.ipaddr}</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">可: 1</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">対応出力</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">感度電流値: [mA]</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">有: ON</TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">回路</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center"></TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">不可: 0</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">No.</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">漏電検知不可: 0.0</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">無: OFF</TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">No.</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">回路名</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">0/1</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">1〜99</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">0.0/0.1〜999.9</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">ON/OFF</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {relayTableData.map((row, index) => (
            <TableRow key={index}>
              <TableCell className="border border-black px-2 py-1 text-center">{row["sensor-No"]}</TableCell>
              <TableCell className="border border-black px-2 py-1 text-center">{row["circuit-name"]}</TableCell>
              <TableCell className="border border-black px-2 py-1 text-center">
                <select
                  value={row["relay-auto-trip"]}
                  disabled={true}
                  title="この項目は編集できません（SetValue,251は未実装）"
                  className="w-full text-center cursor-not-allowed"
                >
                  <option value="0">0</option>
                  {row["circuit-name"] !== "未使用" && <option value="1">1</option>}
                </select>
              </TableCell>
              <TableCell className="border border-black px-2 py-1 text-center">{row["relay-link-to"]}</TableCell>
              <TableCell className="border border-black px-2 py-1 text-center">
                {hasBrkrSens ? (
                  <input
                    type="number"
                    value={row["brkr-sens-curr"]}
                    readOnly={true}
                    title="この項目は編集できません（SetValue,252は未実装）"
                    className="w-full text-center cursor-not-allowed"
                  />
                ) : null}
              </TableCell>
              <TableCell className="border border-black px-2 py-1 text-center">
                  <select
                  value={row["brkr-trip-status"] ?? ''}
                    disabled={!isEditable}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleInputChange(row["sensor-No"]-1, "brkr-trip-status", value);
                    }}
                    className={`w-full text-center ${isEditable ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                  >
                  <option value=""></option>
                    <option value="OFF">OFF</option>
                    <option value="ON">ON</option>
                  </select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
  

