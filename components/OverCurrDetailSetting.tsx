'use client'

import { TableRowOverCurr, YamlDeviceConfig } from '@/app/types';
import React, { useState, useEffect, useRef } from 'react';
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

interface OverCurrDetailProps {
  selectedDeviceName: string;
  isEditable: boolean;
  config: YamlDeviceConfig[];
  onEdit: () => void;
  seteditConfig: (config: YamlDeviceConfig[]) => void;
  currTableData: TableRowOverCurr[];
  setcurrTableData: (tabledata: TableRowOverCurr[]) => void;
}


export function OverCurrDetailSettings({selectedDeviceName, isEditable, config, onEdit, seteditConfig, currTableData, setcurrTableData}:OverCurrDetailProps) {
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
      brkr: [],
      "input-names": [],
      input: [],
      temp: [],
      track: [],
      curr: [],
      leak: [],
      volt: [],
      time: [],
      ptc: [],
  });

  // ロードした時のTableDataを保存・回路名変更時に参照するため
  const [originalOverCurrTableData, setOriginalOverCurrTableData] = useState<TableRowOverCurr[]>([]);

  // ジュール熱詳細設定からの回路名・電源種別変更イベントをリッスン
  useEffect(() => {
    const handleCircuitNameChange = (event: CustomEvent) => {
      if (event.detail.deviceName === selectedDeviceName && (deviceDetail.model === "T24C10B10A" || deviceDetail.model === "T24R8A" || deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T64C30B30I1")) {
        const { oldCircuitName, newCircuitName, newPower, newBreaker } = event.detail;
        
        // 過電流テーブルの回路名、電源種別、ブレーカーを更新
        const updatedTableData = currTableData.map(row => {
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
        setcurrTableData(updatedTableData);
      }
    };

    const handlePowerChange = (event: CustomEvent) => {
      if (event.detail.deviceName === selectedDeviceName && (deviceDetail.model === "T24C10B10A" || deviceDetail.model === "T24R8A" || deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T64C30B30I1")) {
        const { circuitName, newPower } = event.detail;
        
        // 過電流テーブルの電源種別を更新
        const updatedTableData = currTableData.map(row => {
          if (row["circuit-name"] === circuitName) {
            return {
              ...row,
              power: newPower
            };
          }
          return row;
        });
        setcurrTableData(updatedTableData);
      }
    };

    window.addEventListener('tempTableCircuitNameChange', handleCircuitNameChange as EventListener);
    window.addEventListener('tempTablePowerChange', handlePowerChange as EventListener);
    // 漏洩電流テーブルからのブレーカー変更イベント
    const handleLeakBreakerChange = (event: CustomEvent) => {
      if (event.detail.deviceName === selectedDeviceName && deviceDetail.model === "T24R8A") {
        const { circuitName, newBreaker } = event.detail;
        const updatedTableData = currTableData.map(row => {
          if (row["circuit-name"] === circuitName) {
            return { ...row, breaker: newBreaker };
          }
          return row;
        });
        setcurrTableData(updatedTableData);
      }
    };
    window.addEventListener('leakTableBreakerChange', handleLeakBreakerChange as EventListener);
    
    return () => {
      window.removeEventListener('tempTableCircuitNameChange', handleCircuitNameChange as EventListener);
      window.removeEventListener('tempTablePowerChange', handlePowerChange as EventListener);
      window.removeEventListener('leakTableBreakerChange', handleLeakBreakerChange as EventListener);
    };
  }, [selectedDeviceName, deviceDetail.model, currTableData, setcurrTableData]);

  const processEmpData = (empData: string) => {
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
  
                // currの中身を処理する
                const processedOverCurr = device.curr.map(processEmpData);

                const tabledetailData: TableRowOverCurr[] = [];
                
                // T24R8Aモデルでcurr-namesが空の場合、currデータから行数を取得
                let rowCount = device["curr-names"].length;
                if (device.model === "T24R8A" && rowCount === 0 && device.curr.length > 0) {
                  // SetValue,220のチャンネル数から行数を決定
                  const firstCurrData = processedOverCurr[0];
                  if (firstCurrData && firstCurrData.length > 2) {
                    rowCount = firstCurrData.length - 2; // SetValueとコマンド番号を除く
                  }
                }
                
                for (let i = 0; i < rowCount; i++) {
                    const circuitName = i < device["curr-names"].length ? device["curr-names"][i] : "未使用";
                    const circuitIndex = device["circuits"].findIndex(circuit => circuit.name === circuitName);
                    const phaseIndex = i % 3;
                    const phaseLabel = phaseIndex === 0 ? "R" : phaseIndex === 1 ? "S" : "T"; 
                    
                    // 秒から分への変換と整数化を行う関数
                    const secondsToMinutes = (seconds: string) => Math.round(parseInt(seconds) / 60).toString();

                      if (device.model === "T28C16R8I1") {
                        tabledetailData.push({
                          "sensor-No": i+1,
                          "circuit-name": circuitName,
                          power: circuitIndex !== -1 ? device["circuits"][circuitIndex]["power"] : '',
                          wire: circuitIndex !== -1 ? device["circuits"][circuitIndex]["wire"] : '',
                          breaker: circuitIndex !== -1 ? device["circuits"][circuitIndex]["breaker"] : '',
                          phase: phaseLabel,
                          relay: circuitName === "未使用" 
                            ? '0' 
                            : (() => {
                                const circuit = device.circuits.find(c => c.name === circuitName);
                                if (circuit) {
                                  return circuit.autotrip === 1 ? circuit.output.toString() : '0';
                                }
                                return '0';
                              })(),
                          "caution-curr": circuitName === "未使用" ? '0.0' : (processedOverCurr[1]?.[i+2] ?? '0.1'),
                          "caution-time": circuitName === "未使用" ? '0' : secondsToMinutes(processedOverCurr[2]?.[i+2] ?? '0'),
                          "cutoff-curr": circuitName === "未使用" ? '0.0' : (processedOverCurr[3]?.[i+2] ?? '0.1'),
                          "cutoff-time": circuitName === "未使用" ? '0' : secondsToMinutes(processedOverCurr[4]?.[i+2] ?? '0'),
                        });
                      } else {
                        tabledetailData.push({
                          "sensor-No": i+1,
                          "circuit-name": circuitName,
                          power: circuitIndex !== -1 ? device["circuits"][circuitIndex]["power"] : '',
                          wire: circuitIndex !== -1 ? device["circuits"][circuitIndex]["wire"] : '',
                          breaker: circuitIndex !== -1 ? device["circuits"][circuitIndex]["breaker"] : '',
                          phase: '',
                          relay: circuitName === "未使用" 
                            ? '0' 
                            : (() => {
                                const circuit = device.circuits.find(c => c.name === circuitName);
                                if (circuit) {
                                  return circuit.autotrip === 1 ? circuit.output.toString() : '0';
                                }
                                return '0';
                              })(),
                          "caution-curr": circuitName === "未使用" ? '0.0' : (processedOverCurr[1]?.[i+2] ?? '0.1'),
                          "caution-time": circuitName === "未使用" ? '0' : secondsToMinutes(processedOverCurr[2]?.[i+2] ?? '0'),
                          "cutoff-curr": circuitName === "未使用" ? '0.0' : (processedOverCurr[3]?.[i+2] ?? '0.1'),
                          "cutoff-time": circuitName === "未使用" ? '0' : secondsToMinutes(processedOverCurr[4]?.[i+2] ?? '0'),
                        });
                      }
                  }
                  setcurrTableData(tabledetailData);
                  setOriginalOverCurrTableData(tabledetailData);
                  
                  // T24R8A/T28C16R8I1/T64C30B30I1用: windowオブジェクトにデータを保存
                  if (device.model === "T24R8A" || device.model === "T28C16R8I1" || device.model === "T64C30B30I1") {
                    (window as any).currTableDataForWrite = tabledetailData;
                  }
              }
          }
      }
      processData();
    }, [selectedDeviceName, config]);
    
    // currTableDataが更新されたらwindowにも反映（T24R8A/T28C16R8I1/T64C30B30I1用）
    useEffect(() => {
      if ((deviceDetail.model === "T24R8A" || deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T64C30B30I1") && currTableData.length > 0) {
        (window as any).currTableDataForWrite = currTableData;
      }
    }, [currTableData, deviceDetail.model]);
    
  // バックエンドから過電流設定データを読み出す機能
  const updateCurrTableWithBackendData = (backendSettings: any) => {
    if (!backendSettings?.curr_settings) {
      console.warn('バックエンド過電流設定データが不完全です');
      return;
    }

    const secondsToMinutes = (seconds: string | number): string => {
      const sec = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
      if (isNaN(sec) || sec === undefined || sec === null) {
        return '0';
      }
      return Math.round(sec / 60).toString();
    };

    const circuits = backendSettings.circuits || [];
    const currNames = backendSettings.curr_names || [];
    const tempNames = backendSettings.temp_names || [];
    const deviceModel = backendSettings.device_info?.model || deviceDetail.model;
    const currSettings = backendSettings.curr_settings;

    const updatedTableData = currTableData.map(row => {
      const channelNum = row["sensor-No"];
      
      // 回路名を取得
      let circuitName = row["circuit-name"];
      let power = row.power;
      let breaker = row.breaker;
      let wire = row.wire;
      
      // T24C10B10Aの場合はtemp-namesから取得（奇数インデックス）
      if (deviceModel === "T24C10B10A" && tempNames.length > 0) {
        // curr-namesのインデックス（0-based）からtemp-namesの奇数インデックスを計算
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
          // T24R8A: curr-namesから回路名を取得（未使用含む可能性あり）
          const currNameIndex = channelNum - 1;
          if (currNameIndex >= 0 && currNameIndex < currNames.length) {
            const currName = currNames[currNameIndex];
            
            // circuitsから対応する回路情報を取得（name検索）
            const circuit = circuits.find((c: any) => c.name === currName);
            if (circuit) {
              circuitName = circuit.name;
              power = circuit.power || power;
              breaker = circuit.breaker || breaker;
              wire = circuit.wire || wire;
            } else if (currName === "未使用") {
              // 未使用の場合は空にする
              circuitName = "未使用";
              power = '';
              breaker = '';
              wire = '';
            }
          }
        } else {
        // その他のモデルはcurr-namesから取得
        const currNameIndex = channelNum - 1;
        if (currNameIndex >= 0 && currNameIndex < currNames.length) {
          const currName = currNames[currNameIndex];
          
          // circuitsから対応する回路情報を取得
          const circuit = circuits.find((c: any) => c.name === currName);
          if (circuit) {
            circuitName = circuit.name;
            power = circuit.power || power;
            breaker = circuit.breaker || breaker;
            wire = circuit.wire || wire;
          }
        }
      }
      
      // 未使用行の場合は電流値・時間を0にする
      const isUnused = circuitName === "未使用";
      
      // チャンネル番号を文字列に変換してアクセス
      const channelKey = channelNum.toString();
      
      // relayの値を取得（バックエンドから取得したrelay設定、またはcircuitsから計算）
      let relayValue = row.relay;
      if (currSettings.relay?.[channelKey] !== undefined) {
        relayValue = currSettings.relay[channelKey].toString();
      } else {
        // circuitsから取得
        const circuit = circuits.find((c: any) => c.name === circuitName);
        if (circuit) {
          relayValue = circuit.autotrip === 1 ? circuit.output.toString() : '0';
        } else if (isUnused) {
          relayValue = '0';
        }
      }
      
      return {
        ...row,
        "circuit-name": circuitName,
        power: power,
        breaker: breaker,
        wire: wire,
        relay: relayValue,
        "caution-curr": isUnused ? '0.0' : (currSettings.warning_current?.[channelKey] !== undefined 
          ? currSettings.warning_current[channelKey].toString()
          : row["caution-curr"]),
        "caution-time": isUnused ? '0' : (currSettings.warning_delays?.[channelKey] !== undefined 
          ? secondsToMinutes(currSettings.warning_delays[channelKey])
          : row["caution-time"]),
        "cutoff-curr": isUnused ? '0.0' : (currSettings.alarm_current?.[channelKey] !== undefined 
          ? currSettings.alarm_current[channelKey].toString()
          : row["cutoff-curr"]),
        "cutoff-time": isUnused ? '0' : (currSettings.alarm_delays?.[channelKey] !== undefined 
          ? secondsToMinutes(currSettings.alarm_delays[channelKey])
          : row["cutoff-time"])
      };
    });

    setcurrTableData(updatedTableData);
    
    // T24R8A/T28C16R8I1/T64C30B30I1用: windowオブジェクトにデータを保存
    if (deviceModel === "T24R8A" || deviceModel === "T28C16R8I1" || deviceModel === "T64C30B30I1") {
      (window as any).currTableDataForWrite = updatedTableData;
    }
  };

  const handleReadDeviceData = async () => {
    if (!selectedDeviceName) {
      console.warn('デバイスが選択されていません');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('🔧 バックエンド過電流設定データ読み出し開始:', selectedDeviceName);
      
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
        
        if (afterReadSettings && afterReadSettings.curr_settings) {
          const isTimestampUpdated = afterTimestamp > beforeTimestamp;
          
            if (isTimestampUpdated) {
              if (checkTimeoutId) {
                clearTimeout(checkTimeoutId);
              }
              
            console.log('📊 [過電流] beforeTimestamp:', beforeTimestamp);
            console.log('📊 [過電流] afterTimestamp:', afterTimestamp);
            console.log('📊 [過電流] hasCurrSettings:', !!afterReadSettings.curr_settings);
            console.log('📊 [過電流] curr_settings_keys:', afterReadSettings.curr_settings ? Object.keys(afterReadSettings.curr_settings) : null);
            console.log('📊 [過電流] warning_current type:', afterReadSettings.curr_settings?.warning_current ? typeof afterReadSettings.curr_settings.warning_current : null);
            console.log('📊 [過電流] warning_current sample:', afterReadSettings.curr_settings?.warning_current ? 
              Object.entries(afterReadSettings.curr_settings.warning_current).slice(0, 3) : null);
            console.log('📊 [過電流] alarm_current sample:', afterReadSettings.curr_settings?.alarm_current ? 
              Object.entries(afterReadSettings.curr_settings.alarm_current).slice(0, 3) : null);
              
              // ⚠️ 重要: config更新による再レンダリング後にテーブルを更新
              console.log('📊 [過電流] updateCurrTableWithBackendData 呼び出し前');
              setTimeout(() => {
                updateCurrTableWithBackendData(afterReadSettings);
                console.log('📊 [過電流] updateCurrTableWithBackendData 呼び出し後');
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
          console.warn('⚠️ 過電流設定データが見つかりません');
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
      console.error('❌ バックエンド過電流設定データ読み出しエラー:', error);
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
      console.log('🔧 バックエンド過電流設定データ変更開始:', selectedDeviceName);
      
      // WebSocket接続状態をチェック
      if (!sendMessage) {
        setIsLoading(false);
        alert('エラー: バックエンドサーバーに接続できません。\nサーバーが起動しているか確認してください。');
        return;
      }

      // 現在表示中のテーブルデータをバックエンド用の設定形式に変換
      const currSettings: { [key: string]: { [channel: number]: number | string } } = {
        relay: {},
        warning_current: {},
        warning_delays: {},
        alarm_current: {},
        alarm_delays: {}
      };

      // currTableDataから設定値を抽出
      console.log('🔍 現在の過電流テーブルデータ:', currTableData);
      currTableData.forEach((row) => {
        const channel = row["sensor-No"];
        
        // relayは文字列または数値
        currSettings.relay[channel] = row["relay"];
        
        // 電流値は小数点付き数値（floatとして送信）
        const warningCurr = row["caution-curr"] !== undefined && row["caution-curr"] !== '' ? parseFloat(row["caution-curr"].toString()) : 11.0;
        currSettings.warning_current[channel] = warningCurr;
        
        // 判定時間は整数（intとして送信）
        const warningDelay = row["caution-time"] !== undefined && row["caution-time"] !== '' ? Math.round(parseFloat(row["caution-time"].toString())) : 0;
        currSettings.warning_delays[channel] = warningDelay;
        
        // 電流値は小数点付き数値（floatとして送信）
        const alarmCurr = row["cutoff-curr"] !== undefined && row["cutoff-curr"] !== '' ? parseFloat(row["cutoff-curr"].toString()) : 15.0;
        currSettings.alarm_current[channel] = alarmCurr;
        
        // 判定時間は整数（intとして送信）
        const alarmDelay = row["cutoff-time"] !== undefined && row["cutoff-time"] !== '' ? Math.round(parseFloat(row["cutoff-time"].toString())) : 0;
        currSettings.alarm_delays[channel] = alarmDelay;
      });

      // configから現在のデバイス情報を取得
      const currentDevice = config.find(device => device.name === selectedDeviceName);
      if (!currentDevice) {
        setIsLoading(false);
        alert('エラー: デバイス情報が見つかりません。');
        return;
      }

      // バックエンドに設定変更を送信（IPアドレスとポートで識別）
      const updateSettingsRequest = {
        request_type: 'UpdateDeviceSettings',
        ipaddr: currentDevice.ipaddr,
        port: currentDevice.port,
        curr_settings: currSettings
      };

      console.log('📤 送信データ:', updateSettingsRequest);
      await sendMessage(JSON.stringify(updateSettingsRequest));

      setIsLoading(false);
      console.log('✅ 過電流設定データ送信完了');

    } catch (error) {
      console.error('❌ バックエンド過電流設定データ変更エラー:', error);
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
          console.log('📥 [過電流] 読み出しイベント受信:', deviceName);
          handleReadDeviceData();
        }
      };

    const handleDeviceDataWriteEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.deviceName === selectedDeviceName) {
        console.log('📥 過電流設定: deviceDataWriteイベント受信');
        handleWriteDeviceData();
      }
    };

    window.addEventListener('deviceDataRead', handleDeviceDataReadEvent);
    window.addEventListener('deviceDataWrite', handleDeviceDataWriteEvent);
    return () => {
      window.removeEventListener('deviceDataRead', handleDeviceDataReadEvent);
      window.removeEventListener('deviceDataWrite', handleDeviceDataWriteEvent);
    };
  }, [selectedDeviceName, deviceSettings, currTableData]);

  const handleInputChange = (index: number, field: string, value: string) => {
    const updatedTableData = currTableData.map((row, rowIndex) => {
      if (rowIndex === index) {
        return {
          ...row,
          [field]: value,
        };
      }
      return row;
    });
    setcurrTableData(updatedTableData);
  };

  const handleCircuitNameChange = (event: React.ChangeEvent<HTMLSelectElement>, row: TableRowOverCurr) => {
    const newCircuitName = event.target.value;
    const selectedCircuit = deviceDetail.circuits.find(circuit => circuit.name === newCircuitName);
    let existingRowR = null;
    let existingRowS = null;
    let existingRowT = null;
    let existingRowWithSameCircuit = null;
    let existingRowsWithSameCircuitList = [];

    if (deviceDetail.model === "T28C16R8I1") {
      // 選択した回路の全相（R,S,T）のデータを取得
      existingRowsWithSameCircuitList = originalOverCurrTableData.filter(r => r["circuit-name"] === newCircuitName);

      // R相、S相、T相のデータを個別に取得
      existingRowR = existingRowsWithSameCircuitList.find(r => r.phase === "R");
      existingRowS = existingRowsWithSameCircuitList.find(r => r.phase === "S");
      existingRowT = existingRowsWithSameCircuitList.find(r => r.phase === "T");
    } else {
      // 新しく選択された回路名と同じ回路名を持つ行をロード時のtrackTableDataから探す
      existingRowWithSameCircuit = originalOverCurrTableData.find(r => r["circuit-name"] === newCircuitName);
    }

    const updatedTableData = currTableData.map((r) => {
      const sensorNo = r["sensor-No"];
      let shouldUpdate = false;
      
      // モデルに基づいて、この行を更新すべきかどうかを判断
      if (deviceDetail.model === "T28C16R8I1") {
        // T28C16R8I1: 3つずつグループ化
        const groupIndex = Math.floor((row["sensor-No"] - 1) / 3);
        const currentGroupIndex = Math.floor((sensorNo - 1) / 3);
        shouldUpdate = groupIndex === currentGroupIndex;
      } else {
        // その他のモデル: 選択した行のみを更新
        shouldUpdate = sensorNo === row["sensor-No"];
      }

      if (shouldUpdate) {
        if (newCircuitName === "未使用") {
          // "未使用"が選択された場合の処理
          return {
            ...r,
            "circuit-name": "未使用",
            power: "",
            breaker: "",
            wire: "",
            relay: "0",
            "caution-curr": '0.1',
            "caution-time": '0',
            "cutoff-curr": '0.1',
            "cutoff-time": '0',
          };
        } else if (selectedCircuit) {
          // T28C16R8I1モデルの場合のみ相固有のデータを使用
          if (deviceDetail.model === "T28C16R8I1") {
            // 現在の相の値を保持
            const currentPhase = r.phase;

            // 相に応じた適切なデータを選択
            let phaseSpecificData = null;
            if (currentPhase === "R" && existingRowR) {
              phaseSpecificData = existingRowR;
            } else if (currentPhase === "S" && existingRowS) {
              phaseSpecificData = existingRowS;
            } else if (currentPhase === "T" && existingRowT) {
              phaseSpecificData = existingRowT;
            }
            
            // 回路が選択された場合の処理
            const newRelay = selectedCircuit.autotrip === 1 ? selectedCircuit.output.toString() : "0";
            const breakerValue = selectedCircuit["breaker"].match(/(\d+)/)?.[0];
            const cautionCurr = breakerValue ? (Number(breakerValue) * 1.125).toFixed(1) : '0.1';
            const cutoffCurr = breakerValue ? (Number(breakerValue) * 1.8).toFixed(1) : '0.1';

            return {
              ...r,
              "circuit-name": newCircuitName,
              power: selectedCircuit["power"],
              breaker: selectedCircuit["breaker"],
              wire: selectedCircuit["wire"],
              relay: newRelay, // autotripに基づいてrelayを設定
              // 相固有のデータを使用、なければデフォルト値
              "caution-curr": phaseSpecificData ? phaseSpecificData["caution-curr"] : cautionCurr,
              "caution-time": phaseSpecificData ? phaseSpecificData["caution-time"] : '60',
              "cutoff-curr": phaseSpecificData ? phaseSpecificData["cutoff-curr"] : cutoffCurr,
              "cutoff-time": phaseSpecificData ? phaseSpecificData["cutoff-time"] : '2',
            };
          } else {
            // その他のモデル: 以前の実装
            const newRelay = selectedCircuit.autotrip === 1 ? selectedCircuit.output.toString() : "0";
            const breakerValue = selectedCircuit["breaker"].match(/(\d+)/)?.[0];
            const cautionCurr = breakerValue ? (Number(breakerValue) * 1.125).toFixed(1) : '0.1';
            const cutoffCurr = breakerValue ? (Number(breakerValue) * 1.8).toFixed(1) : '0.1';

            return {
              ...r,
              "circuit-name": newCircuitName,
              power: selectedCircuit["power"],
              breaker: selectedCircuit["breaker"],
              wire: selectedCircuit["wire"],
              relay: newRelay, // autotripに基づいてrelayを設定
              // 既存の値を保持するか、新しい回路の場合はデフォルト値を設定
              "caution-curr": existingRowWithSameCircuit ? existingRowWithSameCircuit["caution-curr"] : cautionCurr,
              "caution-time": existingRowWithSameCircuit ? existingRowWithSameCircuit["caution-time"] : '60',
              "cutoff-curr": existingRowWithSameCircuit ? existingRowWithSameCircuit["cutoff-curr"] : cutoffCurr,
              "cutoff-time": existingRowWithSameCircuit ? existingRowWithSameCircuit["cutoff-time"] : '2',
            };
          }
        }
      }
      return r;
    });
  
    setcurrTableData(updatedTableData);
  };

  return (
    <Table className="m-4 text-sm ml-12 w-11/12">
      <TableCaption className="text-lg font-bold mb-2 caption-top">過電流詳細設定</TableCaption>
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
          <TableHead className="font-bold border border-black px-2 py-1 text-center">単相100V:1</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">ブレーカー</TableHead>
          {deviceDetail.model !== "T24C10B10A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center"></TableHead>
          )}
          <TableHead className="font-bold border border-black px-2 py-1 text-center" colSpan={2}>①注意電流アラート</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center" colSpan={2}>
            {deviceDetail.model === "T24R8A" 
              ? "②警報電流アラート" 
              : "②遮断電流　自動遮断"}
          </TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">IPアドレス:</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">{deviceDetail.ipaddr}</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">単相200V:2</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">電流値</TableHead>
          {deviceDetail.model !== "T24C10B10A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center"></TableHead>
          )}
          <TableHead className="font-bold border border-black px-2 py-1 text-center">電流値</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">判定時間</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">電流値</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">判定時間</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">センサー</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center"></TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">三相100V:3</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">[A]</TableHead>
          {deviceDetail.model !== "T24C10B10A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center"></TableHead>
          )}
          <TableHead className="font-bold border border-black px-2 py-1 text-center">
            {deviceDetail.model === "T24R8A" 
              ? "[A]" 
              : "125%×0.9[A]"}
          </TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">[分]</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">
            {deviceDetail.model === "T24R8A" 
              ? "[A]" 
              : "200%×0.9[A]"}
          </TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">[分]</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">No.</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">回路名</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">電源種別</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">1〜999</TableHead>
          {deviceDetail.model !== "T24C10B10A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center">相</TableHead>
          )}
          <TableHead className="font-bold border border-black px-2 py-1 text-center">0.1〜999.9</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">0〜999</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">0.1〜999.9</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">0〜999</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {currTableData.map((row, index) => {
          /* --- モデル別の結合判定をループ内で計算 --- */
          const isGroupModel   = deviceDetail.model === "T28C16R8I1";
          const span           = isGroupModel ? 3 : 1;
          const showCircuitCell = !isGroupModel || index % span === 0; // 先頭行だけ
          
          return (
            <TableRow key={index}>
              <TableCell className="border border-black px-2 py-1 text-center">{row["sensor-No"]}</TableCell>
              {showCircuitCell && (
                <TableCell rowSpan={span} className="border border-black px-2 py-1 text-center">
                <select
                  value={row["circuit-name"]}
                  onChange={(e) => handleCircuitNameChange(e, row)}
                  disabled={!isEditable || deviceDetail.model === "T24C10B10A" || deviceDetail.model === "T24R8A" || deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T64C30B30I1"}
                  className={`w-full text-center form-select ${isEditable && deviceDetail.model !== "T24C10B10A" && deviceDetail.model !== "T24R8A" && deviceDetail.model !== "T28C16R8I1" && deviceDetail.model !== "T64C30B30I1" ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                >
                    {Array.from(new Set(deviceDetail.circuits.map(circuit => circuit.name)))
                      .filter(name => name !== "未使用")
                      .map((uniqueName) => (
                        <option key={uniqueName} value={uniqueName}>
                          {uniqueName}
                        </option>
                      ))
                    }
                    <option value="未使用">未使用</option>
                  </select>
                </TableCell>
              )}
              {showCircuitCell && (
                <TableCell rowSpan={span} className="border border-black px-2 py-1 text-center">{row.power}</TableCell>
              )}
              {showCircuitCell && (
                <TableCell rowSpan={span} className="border border-black px-2 py-1 text-center">{row.breaker}</TableCell>
              )}
              {deviceDetail.model !== "T24C10B10A" && (
                <TableCell className="border border-black px-2 py-1 text-center">{row.phase}</TableCell>
              )}
              <TableCell className="border border-black px-2 py-1 text-center">
                <input
                  type="number"
                  value={row["caution-curr"]}
                  readOnly={!isEditable}
                  onChange={(e) => handleInputChange(row["sensor-No"]-1, "caution-curr", e.target.value)}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      handleInputChange(row["sensor-No"] - 1, "caution-curr", '0.1');
                    } else {
                      const floatValue = parseFloat(value);
                      if (!isNaN(floatValue) && floatValue >= 0.1 && floatValue <= 999.9) {
                        const formattedValue = floatValue.toFixed(1);
                        handleInputChange(row["sensor-No"] - 1, "caution-curr", formattedValue);
                      } else {
                        handleInputChange(row["sensor-No"] - 1, "caution-curr", '0.1');
                      }
                    }
                  }}
                  min="0.1"
                  max="999.9"
                  className={`w-full text-center ${isEditable ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                />
              </TableCell>
              <TableCell className="border border-black px-2 py-1 text-center">
                <input
                  type="number"
                  value={row["caution-time"]}
                  readOnly={!isEditable}
                  onChange={(e) => handleInputChange(row["sensor-No"]-1, "caution-time", e.target.value)}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      handleInputChange(row["sensor-No"] - 1, "caution-time", '0');
                    } else {
                      const intValue = Math.round(parseFloat(value));
                      if (!isNaN(intValue) && intValue >= 0 && intValue <= 999) {
                        handleInputChange(row["sensor-No"] - 1, "caution-time", intValue.toString());
                      } else {
                        handleInputChange(row["sensor-No"] - 1, "caution-time", '0');
                      }
                    }
                  }}
                  min="0"
                  max="999"
                  className={`w-full text-center ${isEditable ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                />
              </TableCell>
              <TableCell className="border border-black px-2 py-1 text-center">
                <input
                  type="number"
                  value={row["cutoff-curr"]}
                  readOnly={!isEditable}
                  onChange={(e) => handleInputChange(row["sensor-No"]-1, "cutoff-curr", e.target.value)}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      handleInputChange(row["sensor-No"] - 1, "cutoff-curr", '0.1');
                    } else {
                      const floatValue = parseFloat(value);
                      if (!isNaN(floatValue) && floatValue >= 0.1 && floatValue <= 999.9) {
                        const formattedValue = floatValue.toFixed(1);
                        handleInputChange(row["sensor-No"] - 1, "cutoff-curr", formattedValue);
                      } else {
                        handleInputChange(row["sensor-No"] - 1, "cutoff-curr", '0.1');
                      }
                    }
                  }}
                  min="0.1"
                  max="999.9"
                  className={`w-full text-center ${isEditable ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                />
              </TableCell>
              <TableCell className="border border-black px-2 py-1 text-center">
                <input
                  type="number"
                  value={row["cutoff-time"]}
                  readOnly={!isEditable}
                  onChange={(e) => handleInputChange(row["sensor-No"]-1, "cutoff-time", e.target.value)}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      handleInputChange(row["sensor-No"] - 1, "cutoff-time", '0');
                    } else {
                      const intValue = Math.round(parseFloat(value));
                      if (!isNaN(intValue) && intValue >= 0 && intValue <= 999) {
                        handleInputChange(row["sensor-No"] - 1, "cutoff-time", intValue.toString());
                      } else {
                        handleInputChange(row["sensor-No"] - 1, "cutoff-time", '0');
                      }
                    }
                  }}
                  min="0"
                  max="999"
                  className={`w-full text-center ${isEditable ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  );
}
  