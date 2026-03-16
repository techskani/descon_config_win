'use client'

import { TableRowLeakCurr, YamlDeviceConfig } from '@/app/types';
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

  interface LeakCurrDetailProps {
    selectedDeviceName: string;
    isEditable: boolean;
    config: YamlDeviceConfig[];
    onEdit: () => void;
    seteditConfig: (config: YamlDeviceConfig[]) => void;
    leakTableData: TableRowLeakCurr[];
    setleakTableData: (tabledata: TableRowLeakCurr[]) => void;
  }
  
  
  export function LeakCurrDetailSettings({selectedDeviceName, isEditable, config, onEdit, seteditConfig, leakTableData, setleakTableData}:LeakCurrDetailProps) {
    const { sendMessage, desconData, deviceSettings } = useWebSocket();
    
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
        input: [],
        "brkr": [],
        temp: [],
        track: [],
        curr: [],
        leak: [],
        volt: [],
        time: [],
        ptc: [],
    });

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
                    console.log(device);
    
                    // tempの中身を処理する
                const processedLeakCurr = device.leak.map(processEmpData);
                // console.log(device.leak);
                // console.log(processedLeakCurr);

                const tabledetailData: TableRowLeakCurr[] = [];
                
                // T24R8Aモデルでleak-namesが空の場合、leakデータから行数を取得
                let rowCount = device["leak-names"].length;
                if (device.model === "T24R8A" && rowCount === 0 && device.leak.length > 0) {
                  // SetValue,230のチャンネル数から行数を決定
                  const firstLeakData = processedLeakCurr[0];
                  if (firstLeakData && firstLeakData.length > 2) {
                    rowCount = firstLeakData.length - 2; // SetValueとコマンド番号を除く
                  }
                }
                
                for (let i = 0; i < rowCount; i++) {
                    const circuitName = i < device["leak-names"].length ? device["leak-names"][i] : "未使用";
                    const circuitIndex = device["circuits"].findIndex(circuit => circuit.name === circuitName);
                    // console.log(circuitIndex);

                        tabledetailData.push({
                            "sensor-No": i+1,
                            "circuit-name": circuitName,
                            power: circuitIndex !== -1 ? device["circuits"][circuitIndex]["power"] : '',
                            wire: circuitIndex !== -1 ? device["circuits"][circuitIndex]["wire"] : '',
                            breaker: circuitIndex !== -1 ? device["circuits"][circuitIndex]["breaker"] : '',
                            relay: circuitName === "未使用" 
                              ? '0' 
                              : (() => {
                                  const circuit = device.circuits.find(c => c.name === circuitName);
                                  if (circuit) {
                                    return circuit.autotrip === 1 ? circuit.output.toString() : '0';
                                  }
                                  return '0';
                                })(),
                            "caution-curr": circuitName === "未使用" ? '0.0' : (processedLeakCurr[1]?.[i+2] ?? '0.1'),
                            "caution-time": circuitName === "未使用" ? '0' : (processedLeakCurr[2]?.[i+2] ?? '0'),
                            "cutoff-curr": circuitName === "未使用" ? '0.0' : (processedLeakCurr[3]?.[i+2] ?? '0.1'),
                            "cutoff-time": circuitName === "未使用" ? '0' : (processedLeakCurr[4]?.[i+2] ?? '0'),
                        });
                    }
                    setleakTableData(tabledetailData);
                    
                    // T24R8A/T28C16R8I1/T64C30B30I1用: windowオブジェクトにデータを保存
                    if (device.model === "T24R8A" || device.model === "T28C16R8I1" || device.model === "T64C30B30I1") {
                      (window as any).leakTableDataForWrite = tabledetailData;
                    }
                }
            }
        }
    
        processData();
    }, [selectedDeviceName, config]);
    
    // leakTableDataが更新されたらwindowにも反映（T24R8A/T28C16R8I1/T64C30B30I1用）
    useEffect(() => {
      if ((deviceDetail.model === "T24R8A" || deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T64C30B30I1") && leakTableData.length > 0) {
        (window as any).leakTableDataForWrite = leakTableData;
      }
    }, [leakTableData, deviceDetail.model]);

    const [isLoadingLeak, setIsLoadingLeak] = useState(false);

    // デバイスデータ読み出しイベントのリスナー
    useEffect(() => {
      const handleReadEvent = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { deviceName } = customEvent.detail;
        if (deviceName === selectedDeviceName) {
          console.log('📥 [漏洩電流] 読み出しイベント受信:', deviceName);
          handleReadDeviceData();
        }
      };

      const handleWriteEvent = () => {
        console.log('📥 漏洩電流設定: deviceDataWriteイベント受信');
        handleWriteDeviceData();
      };

      window.addEventListener('deviceDataRead', handleReadEvent);
      window.addEventListener('deviceDataWrite', handleWriteEvent);

      return () => {
        window.removeEventListener('deviceDataRead', handleReadEvent);
        window.removeEventListener('deviceDataWrite', handleWriteEvent);
      };
    }, [selectedDeviceName, config, leakTableData]);
      

    const handleInputChange = (index: number, field: string, value: string) => {
      const updatedTableData = leakTableData.map((row, rowIndex) => {
        if (rowIndex === index) {
          return {
            ...row,
            [field]: value,
          };
        }
        return row;
      });
      setleakTableData(updatedTableData);
      
      // ブレーカーが変更された場合、過電流詳細設定テーブルに通知（T24R8Aのみ）
      if (field === "breaker" && deviceDetail.model === "T24R8A") {
        const circuitName = leakTableData[index]["circuit-name"];
        const event = new CustomEvent('leakTableBreakerChange', {
          detail: {
            deviceName: selectedDeviceName,
            circuitName: circuitName,
            newBreaker: value
          }
        });
        window.dispatchEvent(event);
      }
    };

    // バックエンドデータで漏洩電流テーブルを更新する関数
    const updateLeakTableWithBackendData = (backendSettings: any) => {
      if (!backendSettings?.leak_settings && !backendSettings?.circuits) {
        console.warn('⚠️ バックエンド漏洩電流設定データが不完全です');
        return;
      }

      const circuits = backendSettings.circuits || [];
      const leakNames = backendSettings.leak_names || [];
      const leakSettings = backendSettings.leak_settings;
      
      const updatedTableData = leakTableData.map(row => {
        const channelNum = row["sensor-No"];
        
        let circuitName = row["circuit-name"];
        let power = row.power;
        let breaker = row.breaker;
        let wire = row.wire;
        
        const leakNameIndex = channelNum - 1;
        if (leakNameIndex >= 0 && leakNameIndex < leakNames.length) {
          const leakName = leakNames[leakNameIndex];
          const circuit = circuits.find((c: any) => c.name === leakName);
          if (circuit) {
            circuitName = circuit.name;
            power = circuit.power || power;
            breaker = circuit.breaker || breaker;
            wire = circuit.wire || wire;
          } else if (leakName === "未使用") {
            circuitName = "未使用";
            power = '';
            breaker = '';
            wire = '';
          }
        }
        
        const isUnused = circuitName === "未使用";
        
        // チャンネル番号を文字列に変換してアクセス
        const channelKey = channelNum.toString();
        
        return {
          ...row,
          "circuit-name": circuitName,
          power: power,
          breaker: breaker,
          wire: wire,
          "caution-curr": isUnused ? '0.0' : (leakSettings?.warning_current?.[channelKey] !== undefined 
            ? leakSettings.warning_current[channelKey].toString()
            : row["caution-curr"]),
          "caution-time": isUnused ? '0' : (leakSettings?.warning_delays?.[channelKey] !== undefined 
            ? leakSettings.warning_delays[channelKey].toString()
            : row["caution-time"]),
          "cutoff-curr": isUnused ? '0.0' : (leakSettings?.alarm_current?.[channelKey] !== undefined 
            ? leakSettings.alarm_current[channelKey].toString()
            : row["cutoff-curr"]),
          "cutoff-time": isUnused ? '0' : (leakSettings?.alarm_delays?.[channelKey] !== undefined 
            ? leakSettings.alarm_delays[channelKey].toString()
            : row["cutoff-time"])
        };
      });

      setleakTableData(updatedTableData);
    };

    // バックエンドから設定データを読み出す処理
    const handleReadDeviceData = async () => {
      console.log('🔧 バックエンド漏洩電流設定データ読み出し開始:', selectedDeviceName);
      
      const currentDevice = config.find(d => d.name === selectedDeviceName);
      if (!currentDevice) {
        console.warn('⚠️ デバイスが見つかりません:', selectedDeviceName);
        return;
      }

      const deviceKey = `${currentDevice.ipaddr}:${currentDevice.port}`;
      
      if (isLoadingLeak) {
        console.log('📊 [漏洩電流] 既に読み出し処理中です');
        return;
      }
      setIsLoadingLeak(true);

      const beforeTimestamp = deviceSettingsRef.current[deviceKey]?.timestamp || 0;

      // バックエンドに設定読み出しリクエストを送信
      const ws = (window as any).websocket;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          request_type: 'GetDeviceSettings',
          ipaddr: currentDevice.ipaddr,
          port: currentDevice.port
        }));
      }

      // レスポンスを待つ（最大15秒、500msごとにチェック）
      let attempts = 0;
      const maxAttempts = 30;
      let checkTimeoutId: NodeJS.Timeout | null = null;
      let isCompleted = false; // 処理完了フラグ
      
      const checkResponse = () => {
        if (isCompleted) return; // 既に完了している場合は何もしない
        
        attempts++;
        const currentDeviceSettings = deviceSettingsRef.current;
        const afterReadSettings = currentDeviceSettings?.[deviceKey];
        const afterTimestamp = afterReadSettings?.timestamp || 0;
        
        console.log(`📊 [漏洩電流] 試行 ${attempts}/${maxAttempts}:`, {
          hasSettings: !!afterReadSettings,
          hasLeakSettings: !!afterReadSettings?.leak_settings,
          leakSettingsKeys: afterReadSettings?.leak_settings ? Object.keys(afterReadSettings.leak_settings) : null,
          beforeTimestamp,
          afterTimestamp,
          isTimestampUpdated: afterTimestamp > beforeTimestamp
        });
        
        if (afterReadSettings && afterReadSettings.leak_settings) {
          const isTimestampUpdated = afterTimestamp > beforeTimestamp;
          
            if (isTimestampUpdated) {
              isCompleted = true; // 処理完了をマーク
              if (checkTimeoutId) {
                clearTimeout(checkTimeoutId);
                checkTimeoutId = null;
              }
              
            console.log('📊 [漏洩電流] データ更新検出:');
            console.log('  beforeTimestamp:', beforeTimestamp);
            console.log('  afterTimestamp:', afterTimestamp);
            console.log('  leak_settings keys:', Object.keys(afterReadSettings.leak_settings));
            console.log('  warning_current:', afterReadSettings.leak_settings?.warning_current);
            console.log('  alarm_current:', afterReadSettings.leak_settings?.alarm_current);
              
              // ⚠️ 重要: config更新による再レンダリング後にテーブルを更新
              console.log('📊 [漏洩電流] updateLeakTableWithBackendData 呼び出し');
              setTimeout(() => {
                updateLeakTableWithBackendData(afterReadSettings);
                setIsLoadingLeak(false);
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
          isCompleted = true; // 処理完了をマーク
          if (checkTimeoutId) {
            clearTimeout(checkTimeoutId);
            checkTimeoutId = null;
          }
          setIsLoadingLeak(false);
          console.warn('⚠️ 漏洩電流設定データが見つかりません（タイムアウト）');
          // 親コンポーネントにタイムアウトを通知
          const resultEvent = new CustomEvent('deviceDataReadResult', {
            detail: { success: false, timeout: true }
          });
          window.dispatchEvent(resultEvent);
          console.warn('  最終チェック:', {
            hasSettings: !!afterReadSettings,
            hasLeakSettings: !!afterReadSettings?.leak_settings,
            beforeTimestamp,
            afterTimestamp
          });
          return;
        }
        
        checkTimeoutId = setTimeout(checkResponse, 500);
      };
      
      checkResponse();
    };

    // バックエンドに設定データを送信する処理
    const handleWriteDeviceData = async () => {
      console.log('🔧 バックエンド漏洩電流設定データ変更開始:', selectedDeviceName);
      
      const currentDevice = config.find(d => d.name === selectedDeviceName);
      if (!currentDevice) {
        console.warn('⚠️ デバイスが見つかりません:', selectedDeviceName);
        return;
      }

      console.log('🔍 現在の漏洩電流テーブルデータ:', leakTableData);

      // T24R8A, T28C16R8I1, T64C30B30I1の場合、window.leakTableDataForWriteから取得
      let currentLeakTableData = leakTableData;
      if ((currentDevice.model === "T24R8A" || currentDevice.model === "T28C16R8I1" || currentDevice.model === "T64C30B30I1") && (window as any).leakTableDataForWrite) {
        currentLeakTableData = (window as any).leakTableDataForWrite;
      }

      const leakSettings: { [key: string]: { [channel: number]: number | string } } = {
        relay: {},
        warning_current: {},
        warning_delays: {},
        alarm_current: {},
        alarm_delays: {}
      };

      currentLeakTableData.forEach((row, index) => {
        const channel = row["sensor-No"];
        
        leakSettings.relay[channel] = row["relay"];
        
        const warningCurr = row["caution-curr"] !== undefined && row["caution-curr"] !== '' ? parseFloat(row["caution-curr"].toString()) : 0.1;
        leakSettings.warning_current[channel] = warningCurr;
        
        const warningDelay = row["caution-time"] !== undefined && row["caution-time"] !== '' ? Math.round(parseFloat(row["caution-time"].toString())) : 0;
        leakSettings.warning_delays[channel] = warningDelay;
        
        const alarmCurr = row["cutoff-curr"] !== undefined && row["cutoff-curr"] !== '' ? parseFloat(row["cutoff-curr"].toString()) : 0.1;
        leakSettings.alarm_current[channel] = alarmCurr;
        
        const alarmDelay = row["cutoff-time"] !== undefined && row["cutoff-time"] !== '' ? Math.round(parseFloat(row["cutoff-time"].toString())) : 0;
        leakSettings.alarm_delays[channel] = alarmDelay;
      });

      console.log('📤 送信データ:', leakSettings);

      const ws = (window as any).websocket;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          request_type: 'UpdateDeviceSettings',
          ipaddr: currentDevice.ipaddr,
          port: currentDevice.port,
          leak_settings: leakSettings
        }));
        console.log('✅ 漏洩電流設定データ送信完了');
      }
    };

    const handleCircuitNameChange = (event: React.ChangeEvent<HTMLSelectElement>, row: TableRowLeakCurr) => {
      const newCircuitName = event.target.value;
      const selectedCircuit = deviceDetail.circuits.find(circuit => circuit.name === newCircuitName);

      const updatedTableData = leakTableData.map((r) => {
        if (r["sensor-No"] === row["sensor-No"]) {
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
            // 回路が選択された場合の処理
            const newRelay = selectedCircuit.autotrip === 1 ? selectedCircuit.output.toString() : "0";
            if (deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T16I4C4R4A") {
              return {
                ...r,
                "circuit-name": newCircuitName,
                power: selectedCircuit["power"],
                breaker: selectedCircuit["breaker"],
                wire: selectedCircuit["wire"],
                relay: newRelay,
                "caution-curr": '5.0',
                "caution-time": '0',
                "cutoff-curr": '15.0',
                "cutoff-time": '0',
              };
            } else {
              return {
                ...r,
                "circuit-name": newCircuitName,
                power: selectedCircuit["power"],
                breaker: selectedCircuit["breaker"],
                wire: selectedCircuit["wire"],
                relay: newRelay,
                "caution-curr": '1.0',
                "caution-time": '0',
                "cutoff-curr": '5.0',
                "cutoff-time": '0',
              };
            }
          }
        }
        return r;
      });
      setleakTableData(updatedTableData);
    };


    return (
      <Table className="m-4 text-sm ml-12 w-11/12">
        <TableCaption className="text-lg font-bold mb-2 caption-top">漏洩電流詳細設定</TableCaption>
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
            <TableHead className="font-bold border border-black px-2 py-1 text-center" colSpan={2}>①注意漏洩電流アラート</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center" colSpan={2}>
              {deviceDetail.model === "T24R8A" 
                ? "②警報漏洩電流アラート" 
                : "②漏洩電流　自動遮断"}
            </TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">IPアドレス:</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">{deviceDetail.ipaddr}</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">単相200V:2</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">電流値</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">漏洩電流値</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">判定時間</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">漏洩電流値</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">判定時間</TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">センサー</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center"></TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">三相100V:3</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">[A]</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">[mA]</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">[秒]</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">[mA]</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">[秒]</TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">No.</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">回路名</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">電源種別</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">1〜999</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">0.1〜999.9</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">0〜99</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">0.1〜999.9</TableHead>
            <TableHead className="font-bold border border-black px-2 py-1 text-center">0〜99</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leakTableData.map((row, index) => (
            <TableRow key={index}>
              <TableCell className="border border-black px-2 py-1 text-center">{row["sensor-No"]}</TableCell>
              <TableCell className="border border-black px-2 py-1 text-center">
                <select
                  value={row["circuit-name"]}
                  onChange={(e) => handleCircuitNameChange(e, row)}
                  disabled={!isEditable || deviceDetail.model === "T24R8A" || deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T64C30B30I1"}
                  className={`w-full text-center form-select ${isEditable && deviceDetail.model !== "T24R8A" && deviceDetail.model !== "T28C16R8I1" && deviceDetail.model !== "T64C30B30I1" ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
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
              <TableCell className="border border-black px-2 py-1 text-center">{row.power}</TableCell>
              <TableCell className="border border-black px-2 py-1 text-center">
                <input
                  type="text"
                  value={row.breaker}
                  onChange={(e) => handleInputChange(row["sensor-No"]-1, "breaker", e.target.value)}
                  readOnly={!isEditable || row["circuit-name"] === "未使用"}
                  className={`w-full text-center ${isEditable && row["circuit-name"] !== "未使用" ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                  placeholder="ブレーカーを入力"
                />
              </TableCell>
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
                      if (!isNaN(intValue) && intValue >= 0 && intValue <= 99) {
                        handleInputChange(row["sensor-No"] - 1, "caution-time", intValue.toString());
                      } else {
                        handleInputChange(row["sensor-No"] - 1, "caution-time", '0');
                      }
                    }
                  }}
                  min="0"
                  max="99"
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
                      if (!isNaN(intValue) && intValue >= 0 && intValue <= 99) {
                        handleInputChange(row["sensor-No"] - 1, "cutoff-time", intValue.toString());
                      } else {
                        handleInputChange(row["sensor-No"] - 1, "cutoff-time", '0');
                      }
                    }
                  }}
                  min="0"
                  max="99"
                  className={`w-full text-center ${isEditable ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
  
  