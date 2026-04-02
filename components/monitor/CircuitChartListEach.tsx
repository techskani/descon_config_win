'use client'


import React, { useEffect, useState } from 'react';
import CircuitChart from '@/components/monitor/CircuitChart';
import TrackingChart from '@/components/monitor/TrackingChart';
import { TrackingData, WebSocketData, YamlConfig, YamlDeviceConfig } from '@/app/types';

// フロントエンド用のデータ型
interface DeviceData {
  deviceName: string;
  circuits: Record<string, Record<string, [string, number | string][]>>;
}

// csv出力データの型定義
interface SensorRecord {
  deviceName: string; 
  sensorNumber: string;
  timestamp: string;
  temperature?: number | null;
  current?: number | null;
  trackcurrent?: number | null;
  leakcurrent?: number | null;
}

// csv出力データの型定義
interface SavedData {
  sensors: SensorRecord[];
}

// dashboardのため
interface CircuitData {
  deviceName: string;
  circuitName: string;
  type: 'temperature' | 'current' | 'voltage';
  value: number;
  data: Record<string, [string, string | number][]>;
}

/** 名称に「40回路」と「A」(半角/全角)を含むか */
function nameIncludes40AndA(name: string): boolean {
  return name.includes('40回路') && /A|Ａ/.test(name);
}
/** 名称に「40回路」と「B」(半角/全角)を含むか */
function nameIncludes40AndB(name: string): boolean {
  return name.includes('40回路') && /B|Ｂ/.test(name);
}
/** A/B(半角・全角)を末尾から除去した名称（統合表示の表示名に使用） */
function getBaseName(name: string): string {
  return name.replace(/\s*[AＡBＢ]\s*$/, '').trim();
}

/** 統合回路オブジェクトを、主幹・盤内温度を最後にした順で返す */
function sortMergedCircuitsWithMainAndTempLast(
  circuits: Record<string, Record<string, [string, number | string][]>>
): Record<string, Record<string, [string, number | string][]>> {
  const keys = Object.keys(circuits);
  const mainAndTemp = keys.filter(k => k === '主幹' || k === '盤内温度');
  const rest = keys.filter(k => k !== '主幹' && k !== '盤内温度');
  const orderedKeys = [...rest, ...mainAndTemp];
  const result: Record<string, Record<string, [string, number | string][]>> = {};
  orderedKeys.forEach(k => { result[k] = circuits[k]; });
  return result;
}

interface CircuitChartListEachProps {
  configData: YamlConfig;
  websocketData: WebSocketData;
  containerWidth?: number; 
  onContentChange: () => void;
  onDividerHeightChange: (height: number) => void;
}

const CircuitChartListEach: React.FC<CircuitChartListEachProps> = ({configData, websocketData, containerWidth, onContentChange, onDividerHeightChange}) => {
  const [selectedDevice, setSelectedDevice] = useState<string>("dashboard");
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedCircuit, setSelectedCircuit] = useState<string | null>(null);
  const [selectedModalDevice, setSelectedModalDevice] = useState<string | null>(null);
  const [deviceData, setDeviceData] = useState<DeviceData[]>([]);
  /** 統合表示ごとの 回路名 → 元デバイス名（複数統合対応） */
  const [combinedCircuitSourceDevice, setCombinedCircuitSourceDevice] = useState<Record<string, Record<string, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [savedData, setSavedData] = useState<SavedData[]>([]);

  // console.log(deviceData); // フロントエンド用に整形したデータ

  // 区切り線の高さを更新するため
  useEffect(() => {
    // デバイスが変更されたときに dividerHeight をリセット
    onDividerHeightChange(0);
    // デバイスの変更やグラフ数の変化が発生したときに呼び出す
    const timer = setTimeout(() => {
      onContentChange();
    }, 10); // 10ミリ秒（0.01秒）の遅延を設定
  
    // クリーンアップ関数
    return () => clearTimeout(timer);
  }, [selectedDevice]); 

  useEffect(() => {
    // バックエンドから取得したデータをフロントエンド用にデータを再形成する関数
    const createCircuitData = (deviceName: string) => {
      const deviceConfig = configData.devices.find(device => device.name === deviceName);

      if (!deviceConfig) {
        console.error(`Device config not found for device name: ${deviceName}`);
        return {};
      }

      const tempNames = deviceConfig["temp-names"];
      const currNames = deviceConfig["curr-names"];
      const trackNames = deviceConfig["track-names"];
      const leakNames = deviceConfig["leak-names"];
      const voltNames = deviceConfig["volt-names"] || [];
      const circuitData: Record<string, Record<string, [string, number| string][]>> = {};

      // websocketDataはwebsocketでバックエンドから受け取ったデータ
      if (!websocketData[deviceName]) {
        // console.error(`Data not found for device name: ${deviceName}`);
        return {};
      }

      tempNames.forEach((circuitName, index) => {
        const tempsensorNumber = index + 1;
        const tempsensorData = websocketData[deviceName]?.temperature[tempsensorNumber] || [];
        const tempsensorStateData = websocketData[deviceName]?.tempstate[tempsensorNumber] || [];
        const key = `temp${tempsensorNumber}`;
        const key_state = `tempState${tempsensorNumber}`;

        if (!circuitData[circuitName]) {
          circuitData[circuitName] = {};
        }

        circuitData[circuitName][key] = tempsensorData;
        circuitData[circuitName][key_state] = tempsensorStateData;
      });

      currNames.forEach((circuitName, index) => {
        const currsensorNumber = index + 1;
        const currsensorData = websocketData[deviceName]?.current[currsensorNumber] || [];
        const currsensorStateData = websocketData[deviceName]?.currstate[currsensorNumber] || [];
        const key = `curr${currsensorNumber}`;
        const key_state = `currState${currsensorNumber}`;

        if (!circuitData[circuitName]) {
          circuitData[circuitName] = {};
        }
      
        circuitData[circuitName][key] = currsensorData;
        circuitData[circuitName][key_state] = currsensorStateData;
      });

      trackNames.forEach((circuitName, index) => {
        const tracksensorNumber = index + 1;
        const tracksensorData = websocketData[deviceName]?.trackcurrent[tracksensorNumber] || [];
        const tracksensorStateData = websocketData[deviceName]?.trackstate[tracksensorNumber] || [];
        const key = `track${tracksensorNumber}`;
        const key_state = `trackState${tracksensorNumber}`;

        if (!circuitData[circuitName]) {
          circuitData[circuitName] = {};
        }

        circuitData[circuitName][key] = tracksensorData;
        circuitData[circuitName][key_state] = tracksensorStateData;
      });

      leakNames.forEach((circuitName, index) => {
        const leaksensorNumber = index + 1;
        const leaksensorData = websocketData[deviceName]?.leakcurrent[leaksensorNumber] || [];
        const leaksensorStateData = websocketData[deviceName]?.leakstate[leaksensorNumber] || [];
        const key = `leak${leaksensorNumber}`;
        const key_state = `leakState${leaksensorNumber}`;

        if (!circuitData[circuitName]) {
          circuitData[circuitName] = {};
        }

        circuitData[circuitName][key] = leaksensorData;
        circuitData[circuitName][key_state] = leaksensorStateData;
      });

      // 電圧データをすべて「盤内温度」回路に集約 - kotani (2026-04-02)
      const mainCircuitName = '盤内温度';
      const deviceData = websocketData[deviceName];
      const voltageData = (deviceData && 'voltage' in deviceData) ? (deviceData as { voltage?: Record<number, [string, number][]> }).voltage || {} : {};
      const voltstateData = (deviceData && 'voltstate' in deviceData) ? (deviceData as { voltstate?: Record<number, [string, string][]> }).voltstate || {} : {};

      if (Object.keys(voltageData).length > 0 || Object.keys(voltstateData).length > 0) {
        if (!circuitData[mainCircuitName]) {
          circuitData[mainCircuitName] = {};
        }
        Object.keys(voltageData).forEach((sensorNumberStr) => {
          const voltsensorNumber = parseInt(sensorNumberStr, 10);
          const voltsensorData = voltageData[voltsensorNumber] || [];
          const voltsensorStateData = voltstateData[voltsensorNumber] || [];
          if (voltsensorData.length > 0 || voltsensorStateData.length > 0) {
            const key = `volt${voltsensorNumber}`;
            const key_state = `voltState${voltsensorNumber}`;
            circuitData[mainCircuitName][key] = voltsensorData;
            circuitData[mainCircuitName][key_state] = voltsensorStateData;
          }
        });
      }

      return circuitData;
    };

    let newDeviceData: DeviceData[] = configData.devices.map(device => ({
      deviceName: device.name,
      circuits: createCircuitData(device.name)
    }));

    // 「40回路」+「A」と「40回路」+「B」を含むデバイスで、A/B除去後の名称が一致するペアごとに統合表示を追加
    const baseNameToPair: Record<string, { nameA: string; nameB: string }> = {};
    configData.devices.forEach(d => {
      if (nameIncludes40AndA(d.name)) {
        const base = getBaseName(d.name);
        if (!baseNameToPair[base]) baseNameToPair[base] = { nameA: '', nameB: '' };
        baseNameToPair[base].nameA = d.name;
      }
      if (nameIncludes40AndB(d.name)) {
        const base = getBaseName(d.name);
        if (!baseNameToPair[base]) baseNameToPair[base] = { nameA: '', nameB: '' };
        baseNameToPair[base].nameB = d.name;
      }
    });
    const newCombinedSource: Record<string, Record<string, string>> = {};
    Object.entries(baseNameToPair).forEach(([baseName, { nameA, nameB }]) => {
      if (!nameA || !nameB) return;
      const circuitsA = createCircuitData(nameA);
      const circuitsB = createCircuitData(nameB);
      const mergedCircuitsRaw: Record<string, Record<string, [string, number | string][]>> = {
        ...circuitsA,
        ...circuitsB
      };
      const mergedCircuits = sortMergedCircuitsWithMainAndTempLast(mergedCircuitsRaw);
      newCombinedSource[baseName] = {};
      Object.keys(circuitsA).forEach(circuitName => { newCombinedSource[baseName][circuitName] = nameA; });
      Object.keys(circuitsB).forEach(circuitName => { newCombinedSource[baseName][circuitName] = nameB; });
      // 元になった2つのうち、一覧で上に表示されている方の1つ上に統合選択肢を挿入
      const indexA = newDeviceData.findIndex(d => d.deviceName === nameA);
      const indexB = newDeviceData.findIndex(d => d.deviceName === nameB);
      const insertIndex = Math.min(indexA, indexB) >= 0 ? Math.min(indexA, indexB) : newDeviceData.length;
      newDeviceData = [
        ...newDeviceData.slice(0, insertIndex),
        { deviceName: baseName, circuits: mergedCircuits },
        ...newDeviceData.slice(insertIndex)
      ];
    });
    setCombinedCircuitSourceDevice(newCombinedSource);

    setDeviceData(newDeviceData);
  }, [websocketData, configData]);

  // 選択されているデバイスの全回路のデータ
  const selectedDevice_CircuitsData = deviceData.find(device => device.deviceName === selectedDevice)?.circuits || {};

  // selectボックスでデバイスが変更されたときに発火
  const handleDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDevice(event.target.value);
  };

  const isCombinedDevice = (deviceName: string) =>
    Object.prototype.hasOwnProperty.call(combinedCircuitSourceDevice, deviceName);

  const handleOpenModal = (circuitName: string, deviceName?: string) => {
    setSelectedCircuit(circuitName);
    if (deviceName && (selectedDevice === "dashboard" || isCombinedDevice(selectedDevice))) {
      setSelectedModalDevice(deviceName);
    } else {
      setSelectedModalDevice(null);
    }
    setModalIsOpen(true);
  };

  const handleCloseModal = () => {
    setModalIsOpen(false);
    setSelectedCircuit(null);
    setSelectedModalDevice(null);
  };

  const handleCSVSaveStart = () => {
    setIsSaving(true);
    setSavedData([]); // 保存データを初期化
  };

  const handleCSVSaveEnd = () => {
    setIsSaving(false);
    downloadCSV();
  };

  const generateCSV = (data: SavedData[]) => {
    const headers = ['deviceName', 'sensorNumber', 'timestamp', 'temperature', 'current', 'trackcurrent', 'leakcurrent'];
    const csvRows = [headers.join(',')];
  
    data.forEach(item => {
      item.sensors.forEach(sensor => {
        const row = [
          sensor.deviceName,
          sensor.sensorNumber,
          sensor.timestamp,
          sensor.temperature !== undefined && sensor.temperature !== null ? sensor.temperature.toString() : '',
          sensor.current !== undefined && sensor.current !== null ? sensor.current.toString() : '',
          sensor.trackcurrent !== undefined && sensor.trackcurrent !== null ? sensor.trackcurrent.toString() : '',
          sensor.leakcurrent !== undefined && sensor.leakcurrent !== null ? sensor.leakcurrent.toString() : ''
        ];
        csvRows.push(row.join(','));
      });
    });
  
    return csvRows.join('\n');
  };

  const downloadCSV = () => {
    const csvContent = generateCSV(savedData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = `${selectedDevice ?? 'data'}.csv`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    // csvに保存するためのデータを作成
    if (isSaving && selectedDevice) {
      // バックエンドから取得するデータから選択しているデバイスのデータを取得
      const deviceData_forCSV = websocketData[selectedDevice];
      const deviceName = selectedDevice;
  
      if (deviceData_forCSV) {
        const newSavedData: SavedData = {
          sensors: [] as SensorRecord[]
        };
  
        const convertToJapanTime = (utcTimestamp: string) => {
          const date = new Date(utcTimestamp);
          const japanTimeOffset = 9 * 60; // JSTはUTC+9
          const japanDate = new Date(date.getTime() + japanTimeOffset * 60 * 1000);
          return japanDate.toISOString().replace('T', ' ').substring(0, 19);
        };
  
        const sensorTypes = ['temperature', 'current', 'trackcurrent', 'leakcurrent'];
  
        const sensorDataMap: Record<string, Partial<SensorRecord>> = {};
  
        sensorTypes.forEach(sensorType => {
          if (deviceData_forCSV[sensorType as keyof typeof deviceData_forCSV]) {
            Object.entries(deviceData_forCSV[sensorType as keyof typeof deviceData_forCSV]).forEach(([sensorNumber, values]) => {
              const latestEntry = values.length > 0 ? values[values.length - 1] : null;
              if (latestEntry) {
                if (!sensorDataMap[sensorNumber]) {
                  sensorDataMap[sensorNumber] = {
                    deviceName,
                    sensorNumber,
                    timestamp: convertToJapanTime(latestEntry[0]), // 日本時間に変換
                    temperature: null,
                    current: null,
                    trackcurrent: null,
                    leakcurrent: null,
                  };
                }
                sensorDataMap[sensorNumber][sensorType as keyof SensorRecord] = latestEntry[1];
              }
            });
          }
        });
  
        Object.values(sensorDataMap).forEach(sensorData => {
          newSavedData.sensors.push({
            deviceName: sensorData.deviceName as string,
            sensorNumber: sensorData.sensorNumber as string,
            timestamp: sensorData.timestamp as string,
            temperature: sensorData.temperature || null,
            current: sensorData.current || null,
            trackcurrent: sensorData.trackcurrent || null,
            leakcurrent: sensorData.leakcurrent || null,
          });
        });
  
        setSavedData(prevData => [...prevData, newSavedData]);
      }
    }
  }, [websocketData, isSaving, selectedDevice]);

  // dashboardに表示するデータを取得
  const getDashboardData = (): CircuitData[] => {
    const allCircuits: CircuitData[] = []; // センサーごとの値とその回路のデータを保持しているので、回路は重複している。
  
    // 全デバイスの回路データを収集
    deviceData.forEach(device => {
        Object.entries(device.circuits).forEach(([circuitName, sensorData]) => {
            if (circuitName !== '未使用') {  // 未使用の回路を除外
                Object.entries(sensorData).forEach(([sensorType, data]) => {
                    if (sensorType.startsWith('temp') && !sensorType.startsWith('tempState')) {
                        const latestTempData = data[data.length - 1];
                        if (latestTempData) {
                            allCircuits.push({
                                deviceName: device.deviceName,
                                circuitName,
                                type: 'temperature',
                                value: latestTempData[1] as number,
                                data: sensorData  as Record<string, [string, string | number][]> // 全体のデータを保持する
                            });
                        }
                    } else if (sensorType.startsWith('curr') && !sensorType.startsWith('currState')) {
                          const latestCurrData = data[data.length - 1];
                          if (latestCurrData) {
                              allCircuits.push({
                                  deviceName: device.deviceName,
                                  circuitName,
                                  type: 'current',
                                  value: latestCurrData[1] as number,
                                  data: sensorData  as Record<string, [string, string | number][]>
                              });
                          }
                    } else if (sensorType.startsWith('volt') && !sensorType.startsWith('voltState') && circuitName === '主幹') {
                          const latestVoltData = data[data.length - 1];
                          if (latestVoltData) {
                              allCircuits.push({
                                  deviceName: device.deviceName,
                                  circuitName,
                                  type: 'voltage',
                                  value: latestVoltData[1] as number,
                                  data: sensorData  as Record<string, [string, string | number][]>
                              });
                          }
                    }
                });
            }
        });
    });
  
    // 温度が高い順に3つ、同じ回路を除外
    const uniqueTemperatureCircuits = new Set<string>();
    const topTemperatureCircuits = allCircuits
        .filter(circuit => circuit.type === 'temperature')
        .sort((a, b) => b.value - a.value)
        .filter(circuit => {
            if (uniqueTemperatureCircuits.has(circuit.circuitName)) {
                return false;
            } else {
                uniqueTemperatureCircuits.add(circuit.circuitName);
                return true;
            }
        })
        .slice(0, 3);
  
    // 電流が高い順に3つ、同じ回路を除外
    const uniqueCurrentCircuits = new Set<string>();
    const topCurrentCircuits = allCircuits
        .filter(circuit => circuit.type === 'current')
        .sort((a, b) => b.value - a.value)
        .filter(circuit => {
            if (uniqueCurrentCircuits.has(circuit.circuitName)) {
                return false;
            } else {
                uniqueCurrentCircuits.add(circuit.circuitName);
                return true;
            }
        })
        .slice(0, 3);
  
    // 主幹回路の電圧データを収集（重複を除外）
    const uniqueVoltageCircuits = new Set<string>();
    const voltageCircuits = allCircuits
        .filter(circuit => circuit.type === 'voltage' && circuit.circuitName === '主幹')
        .filter(circuit => {
            const key = `${circuit.deviceName}-${circuit.circuitName}`;
            if (uniqueVoltageCircuits.has(key)) return false;
            uniqueVoltageCircuits.add(key);
            return true;
        });
  
    return [...topTemperatureCircuits, ...topCurrentCircuits, ...voltageCircuits];
  };

  // 温度のステータスによって、グラフのデザインを変更する
  // const getCircuitStatus = (data: Record<string, [string, number | string][]>) => {
  //   let borderClass = '';
  //   let alertSentence = '';
  //   let alertClass = '';
  //   let alertBg = '';

  //   Object.entries(data).forEach(([key, values]) => {
  //       if (key.startsWith('tempState') && values.length > 0 && typeof values[values.length - 1][1] === 'string') {
  //           const state = values[values.length - 1][1] as string;
  //           if (state === 'WARNING' && borderClass !== 'border-4 border-red-500') {
  //             borderClass = 'border-4 border-yellow-500';
  //             alertSentence = '注意温度';
  //             alertClass = 'text-yellow-500';
  //             alertBg = 'bg-yellow-50';
  //           } else if (state === 'ALARM') {                         
  //             borderClass = 'border-4 border-red-500';
  //             alertSentence = '遮断中';
  //             alertClass = 'text-red-500';
  //             alertBg = 'bg-red-50';
  //           }
  //       }
  //   });

  //   return { borderClass, alertSentence, alertClass, alertBg };
  // };

  // // 温度と電流のステータスによって、グラフのデザインを変更する
  // const getCircuitStatus = (data: Record<string, [string, number | string][]>) => {
  //   let borderClass = '';
  //   let alertSentence: string[] = [];
  //   let alertClass = '';
  //   let alertBg = '';

  //   Object.entries(data).forEach(([key, values]) => {
  //       if (values.length > 0 && typeof values[values.length - 1][1] === 'string') {
  //           const state = values[values.length - 1][1] as string;
  //           if (key.startsWith('tempState')) {
  //               if (state === 'WARNING' && !alertSentence.includes('遮断中(温度)')) {
  //                   borderClass = 'border-4 border-yellow-500';
  //                   alertSentence.push('注意温度');
  //                   alertClass = 'text-yellow-500';
  //                   alertBg = alertBg || 'bg-yellow-50';
  //               } else if (state === 'ALARM') {
  //                   alertSentence.push('遮断中(温度)');
  //                   alertClass = 'text-red-500';
  //                   borderClass = 'border-4 border-red-500';
  //                   alertBg = 'bg-red-50';
  //               }
  //           } else if (key.startsWith('currState')) {
  //               if (state === 'WARNING' && !alertSentence.includes('遮断中(電流)')) {
  //                   borderClass = 'border-4 border-yellow-500';
  //                   alertSentence.push('注意電流');
  //                   alertClass = 'text-yellow-500';
  //                   alertBg = alertBg || 'bg-yellow-50';
  //               } else if (state === 'ALAEM') {
  //                   alertSentence.push('遮断中(電流)');
  //                   alertClass = 'text-red-500';
  //                   borderClass = 'border-4 border-red-500';
  //                   alertBg = 'bg-red-50';
  //               }
  //           }
  //       }
  //   });

  //   return { borderClass, alertSentence, alertClass, alertBg };
  // };


  // 温度と電流とトラッキングと漏洩電流のステータスによって、グラフのデザインを変更する
  const getCircuitStatus = (data: Record<string, [string, number | string][]>) => {
    let borderClass = '';
    const warningSet = new Set<string>();
    const alarmSet = new Set<string>();
    let alertClass = '';
    let alertBg = 'bg-white';
  
    // まずALARMの状態を確認
    Object.entries(data).forEach(([key, values]) => {
      if (values.length > 0 && typeof values[values.length - 1][1] === 'string') {
        const state = values[values.length - 1][1] as string;
        if (state === 'ALARM') {
          if (key.startsWith('tempState')) {
            alarmSet.add('遮断中(温度)');
          } else if (key.startsWith('currState')) {
            alarmSet.add('遮断中(電流)');
          } else if (key.startsWith('trackState')) {
            alarmSet.add('遮断中(トラッキング)');
          } else if (key.startsWith('leakState')) {
            alarmSet.add('遮断中(漏電電流)');
          }
        }
      }
    });
  
    // ALARMがない場合のみWARNINGを確認
    Object.entries(data).forEach(([key, values]) => {
      if (values.length > 0 && typeof values[values.length - 1][1] === 'string') {
        const state = values[values.length - 1][1] as string;
        if (state === 'WARNING') {
          if (key.startsWith('tempState') && !alarmSet.has('遮断中(温度)')) {
            warningSet.add('注意温度');
          } else if (key.startsWith('currState') && !alarmSet.has('遮断中(電流)')) {
            warningSet.add('注意電流');
          } else if (key.startsWith('trackState') && !alarmSet.has('遮断中(トラッキング)')) {
            warningSet.add('注意(トラッキング)');
          } else if (key.startsWith('leakState') && !alarmSet.has('遮断中(漏電電流)')) {
            warningSet.add('注意漏電電流');
          }
        }
      }
    });
  
    // スタイルの設定
    if (alarmSet.size > 0) {
      alertClass = 'text-red-500';
      borderClass = 'border-4 border-red-500';
      alertBg = 'bg-red-50';
    } else if (warningSet.size > 0) {
      alertClass = 'text-yellow-500';
      borderClass = 'border-4 border-yellow-500';
      alertBg = 'bg-yellow-50';
    }
  
    // 警告文を配列に変換
    const alertSentence = [...Array.from(alarmSet), ...Array.from(warningSet)];
  
    return { borderClass, alertSentence, alertClass, alertBg };
  };

  // 温度によって、グラフのデザインを変更する
  // const getCircuitStatus_temp = (data: Record<string, [string, number | string][]>) => {
  //   let borderClass = '';
  //   let alertSentence = '';
  //   let alertClass = '';
  //   let alertBg = '';
  
  //   Object.entries(data).forEach(([key, values]) => {
  //     if (key.startsWith('temp') && !key.startsWith('tempState') && values.length > 0 && typeof values[values.length - 1][1] === 'number') {
  //       const tempValue = values[values.length - 1][1] as number;
  //       if (tempValue >= 50) {
  //         borderClass = 'border-4 border-red-500';
  //         alertSentence = '遮断中';
  //         alertClass = 'text-red-500';
  //         alertBg = 'bg-red-50';
  //       } else if (tempValue >= 40 && tempValue < 50 && borderClass !== 'border-4 border-red-500') {
  //         borderClass = 'border-4 border-yellow-500';
  //         alertSentence = '注意温度';
  //         alertClass = 'text-yellow-500';
  //         alertBg = 'bg-yellow-50';
  //       }
  //     }
  //   });
  
  //   return { borderClass, alertSentence, alertClass, alertBg };
  // };

  const [gridColumns, setGridColumns] = useState(3);

  useEffect(() => {
    if (containerWidth) {
      let columns;
      if (containerWidth < 600) columns = 1;  // スマホサイズ
      else if (containerWidth > 2560) columns = 5;  // 超大画面 (2K以上)
      else if (containerWidth > 1280) columns = 4;
      else columns = 3;
      setGridColumns(columns);
    }
  }, [containerWidth]);

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
    gap: '1rem',
  };

  const [gridColumnsForDashboard, setGridColumnsForDashboard] = useState(3);

  useEffect(() => {
    if (containerWidth) {
      let columns;
      if (containerWidth < 640) columns = 1;  // スマホサイズ
      else if (containerWidth < 768) columns = 2;  // タブレットサイズ
      else columns = 3;       // デスクトップサイズ
      setGridColumnsForDashboard(columns);
    }
  }, [containerWidth]);

  const gridStyleForDashboard = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridColumnsForDashboard}, minmax(0, 1fr))`,
    gap: '1rem',
  };

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 mb-2">
        <label className="text-lg">Select Device:</label>
        <select 
          id="device-select" 
          onChange={handleDeviceChange} 
          className="w-full sm:w-auto border p-2 sm:ml-8 rounded"
          value={selectedDevice}
        >
          <option value="dashboard">ダッシュボード</option>
          {deviceData.map(device => (
            <option key={device.deviceName} value={device.deviceName}>
              {device.deviceName}
            </option>
          ))}
        </select>
      </div>

      {selectedDevice === "dashboard" ? (
        <div className="flex flex-col w-full">
          {/* 温度が高い回路 */}
          <h3 className="text-center font-bold mb-2 text-2xl">温度</h3>
          <div style={gridStyleForDashboard} className="flex-grow mb-4">
            {getDashboardData().filter(circuit => circuit.type === 'temperature').map((circuit, index) => {
              const { borderClass, alertSentence, alertClass, alertBg } = getCircuitStatus(circuit.data);
              return (
                <div
                  key={`${circuit.deviceName}-${circuit.circuitName}-${index}`}
                  className={`flex flex-col border rounded-lg p-2 shadow cursor-pointer ${alertBg} ${borderClass}`}
                  onClick={() => handleOpenModal(circuit.circuitName, circuit.deviceName)}
                >
                  {Array.isArray(alertSentence) && alertSentence.length > 0 ? (
                    <div className={`grid ${alertSentence.length > 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mb-2 justify-items-center`}>
                      {alertSentence.map((sentence, index) => (
                        <h2 
                          key={index} 
                          className={`text-center font-bold ${alertClass} px-2 py-1 rounded ${alertSentence.length === 1 ? 'col-span-2' : ''}`}
                        >
                          {sentence}
                        </h2>
                      ))}
                    </div>
                  ) : (
                    alertSentence && <h2 className={`text-center font-bold mb-2 ${alertClass}`}>{alertSentence}</h2>
                  )}
                  <h3 className="text-center mb-2 text-lg">
                    {`${circuit.deviceName} - ${circuit.circuitName}`}
                  </h3>
                  <div className="flex-grow min-h-[230px]">
                    <CircuitChart
                      circuitName={circuit.circuitName}
                      sensorData={circuit.data}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 電流が高い回路 */}
          <h3 className="text-center font-bold mb-2 text-2xl">電流</h3>
          <div style={gridStyleForDashboard} className="flex-grow mb-6">
            {getDashboardData().filter(circuit => circuit.type === 'current').map((circuit, index) => {
              const { borderClass, alertSentence, alertClass, alertBg } = getCircuitStatus(circuit.data);
              return (
                <div
                  key={`${circuit.deviceName}-${circuit.circuitName}-${index}`}
                  className={`flex flex-col border rounded-lg p-2 shadow cursor-pointer ${alertBg} ${borderClass}`}
                  onClick={() => handleOpenModal(circuit.circuitName, circuit.deviceName)}
                >
                  {Array.isArray(alertSentence) && alertSentence.length > 0 ? (
                    <div className={`grid ${alertSentence.length > 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mb-2 justify-items-center`}>
                      {alertSentence.map((sentence, index) => (
                        <h2 
                          key={index} 
                          className={`text-center font-bold ${alertClass} px-2 py-1 rounded ${alertSentence.length === 1 ? 'col-span-2' : ''}`}
                        >
                          {sentence}
                        </h2>
                      ))}
                    </div>
                  ) : (
                    alertSentence && <h2 className={`text-center font-bold mb-2 ${alertClass}`}>{alertSentence}</h2>
                  )}
                  <h3 className="text-center mb-2 text-lg">
                    {`${circuit.deviceName} - ${circuit.circuitName}`}
                  </h3>
                  <div className="flex-grow min-h-[230px]">
                    <CircuitChart
                      circuitName={circuit.circuitName}
                      sensorData={circuit.data}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 電圧（主幹） */}
          <h3 className="text-center font-bold mb-2 text-2xl">電圧</h3>
          <div style={gridStyleForDashboard} className="flex-grow mb-6">
            {getDashboardData().filter(circuit => circuit.type === 'voltage').map((circuit, index) => {
              const { borderClass, alertSentence, alertClass, alertBg } = getCircuitStatus(circuit.data);
              return (
                <div
                  key={`volt-${circuit.deviceName}-${circuit.circuitName}-${index}`}
                  className={`flex flex-col border rounded-lg p-2 shadow cursor-pointer ${alertBg} ${borderClass}`}
                  onClick={() => handleOpenModal(circuit.circuitName, circuit.deviceName)}
                >
                  {Array.isArray(alertSentence) && alertSentence.length > 0 ? (
                    <div className={`grid ${alertSentence.length > 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mb-2 justify-items-center`}>
                      {alertSentence.map((sentence, idx) => (
                        <h2 key={idx} className={`text-center font-bold ${alertClass} px-2 py-1 rounded ${alertSentence.length === 1 ? 'col-span-2' : ''}`}>{sentence}</h2>
                      ))}
                    </div>
                  ) : (
                    alertSentence && <h2 className={`text-center font-bold mb-2 ${alertClass}`}>{alertSentence}</h2>
                  )}
                  <h3 className="text-center mb-2 text-lg">{`${circuit.deviceName} - ${circuit.circuitName}`}</h3>
                  <div className="flex-grow min-h-[230px]">
                    <CircuitChart circuitName={circuit.circuitName} sensorData={circuit.data} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
      selectedDevice && (
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{selectedDevice}</h2>
            <div className="flex items-center">
              {!isSaving ? (
                <button
                  onClick={handleCSVSaveStart}
                  className="p-2 bg-green-500 text-white rounded mr-2"
                >
                  csv保存開始
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCSVSaveEnd}
                    className="p-2 bg-red-500 text-white rounded mr-2"
                  >
                    csv保存終了
                  </button>
                </>
              )}
            </div>
          </div>
          <div style={gridStyle} className="flex-grow mb-6">
            {Object.entries(selectedDevice_CircuitsData)
            .filter(([circuitName]) => circuitName !== '未使用')
            .map(([circuitName, sensorData]) => {
              const { borderClass, alertSentence, alertClass, alertBg } = getCircuitStatus(sensorData);
              const sourceDevice = isCombinedDevice(selectedDevice) ? combinedCircuitSourceDevice[selectedDevice]?.[circuitName] : undefined;
              return (
                <div
                  key={`${selectedDevice}-${circuitName}`}
                  className={`flex flex-col border rounded-lg p-4 shadow cursor-pointer ${alertBg} ${borderClass}`}
                  onClick={() => handleOpenModal(circuitName, sourceDevice)}
                >
                  {Array.isArray(alertSentence) && alertSentence.length > 0 ? (
                    <div className={`grid ${alertSentence.length > 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mb-2 justify-items-center`}>
                      {alertSentence.map((sentence, index) => (
                        <h2 
                          key={index} 
                          className={`text-center font-bold ${alertClass} px-2 py-1 rounded ${alertSentence.length === 1 ? 'col-span-2' : ''}`}
                        >
                          {sentence}
                        </h2>
                      ))}
                    </div>
                  ) : (
                    alertSentence && <h2 className={`text-center font-bold mb-2 ${alertClass}`}>{alertSentence}</h2>
                  )}
                  <h3 className="text-center mb-2 text-lg">{circuitName}</h3>
                  <div className="flex-grow min-h-[230px]">
                    <CircuitChart
                      circuitName={circuitName}
                      sensorData={sensorData}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )
      )}

      {modalIsOpen && selectedCircuit && selectedDevice && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          {(() => {
            const dashboardCircuit = selectedDevice === "dashboard" 
              ? getDashboardData().find(circuit => circuit.circuitName === selectedCircuit && (!selectedModalDevice || circuit.deviceName === selectedModalDevice))
              : null;

            const circuitData = selectedDevice === "dashboard"
              ? dashboardCircuit?.data
              : selectedDevice_CircuitsData[selectedCircuit];

            // データが存在しない場合は早期リターン
            if (!circuitData) {
              return <p>No data available for this circuit.</p>;
            }

            const { alertBg, borderClass, alertSentence, alertClass } = getCircuitStatus(circuitData);

            const deviceName = selectedDevice === "dashboard"
              ? (selectedModalDevice ?? dashboardCircuit?.deviceName)
              : isCombinedDevice(selectedDevice) && selectedModalDevice
                ? selectedModalDevice
                : selectedDevice;

            return (
              <div 
                className={`p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[95vh] py-4 overflow-auto relative ${alertBg} ${borderClass}`}
              >
                <button
                  onClick={handleCloseModal}
                  className="absolute top-2 right-2 p-2 mr-4 mt-2 bg-blue-500 text-white rounded"
                >
                  Close
                </button>
                {Array.isArray(alertSentence) && alertSentence.length > 0 ? (
                  <div className={`grid ${alertSentence.length > 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mb-2 justify-items-center`}>
                    {alertSentence.map((sentence, index) => (
                      <h2 
                        key={index} 
                        className={`text-center font-bold ${alertClass} px-2 py-1 rounded ${alertSentence.length === 1 ? 'col-span-2' : ''}`}
                      >
                        {sentence}
                      </h2>
                    ))}
                  </div>
                ) : (
                  alertSentence && <h2 className={`text-center font-bold mb-2 ${alertClass}`}>{alertSentence}</h2>
                )}
                <h2 className="text-xl mb-4">
                  Device {deviceName} - Circuit {selectedCircuit}
                </h2>
                <div className="flex-grow">
                  <CircuitChart
                    circuitName={selectedCircuit}
                    sensorData={circuitData}
                    isModal={true}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* {modalIsOpen && selectedCircuit && selectedDevice && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          {(() => {
            let alertBg = 'bg-white';
            let borderClass = '';
            if (selectedDevice === "dashboard") {
              const circuit = getDashboardData().find(circuit => circuit.circuitName === selectedCircuit);
              if (circuit) {
                const { alertBg: tempAlertBg, borderClass: TempBorderClass } = getCircuitStatus(circuit.data);
                alertBg = tempAlertBg || alertBg;
                borderClass = TempBorderClass;
              }
            } else {
              const { alertBg: tempAlertBg, borderClass: TempBorderClass } = getCircuitStatus(selectedDevice_CircuitsData[selectedCircuit]);
              alertBg = tempAlertBg || alertBg;
              borderClass = TempBorderClass;
            }

            return (
              <div 
                className={`p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[95vh] py-4 overflow-auto relative ${alertBg} ${borderClass}`}
              >
                <button
                  onClick={handleCloseModal}
                  className="absolute top-2 right-2 p-2 mr-4 mt-2 bg-blue-500 text-white rounded"
                >
                  Close
                </button>
                {selectedDevice === "dashboard" ? (
                  (() => {
                    const circuit = getDashboardData().find(circuit => circuit.circuitName === selectedCircuit);
                    if (circuit) {
                      const { alertSentence, alertClass } = getCircuitStatus(circuit.data);
                      return (
                        <>
                          {Array.isArray(alertSentence) && alertSentence.length > 0 ? (
                            <div className={`grid ${alertSentence.length > 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mb-2 justify-items-center`}>
                              {alertSentence.map((sentence, index) => (
                                <h2 
                                  key={index} 
                                  className={`text-center font-bold ${alertClass} px-2 py-1 rounded ${alertSentence.length === 1 ? 'col-span-2' : ''}`}
                                >
                                  {sentence}
                                </h2>
                              ))}
                            </div>
                          ) : (
                            alertSentence && <h2 className={`text-center font-bold mb-2 ${alertClass}`}>{alertSentence}</h2>
                          )}
                          <h2 className="text-xl mb-4">Device {circuit.deviceName} - Circuit {selectedCircuit}</h2>
                          <div className="flex-grow">
                            <CircuitChart
                              circuitName={circuit.circuitName}
                              sensorData={circuit.data}
                            />
                          </div>
                        </>
                      );
                    } else {
                      return <p>No data available for this circuit.</p>;
                    }
                  })()
                ) : (
                  (() => {
                    const { alertSentence, alertClass } = getCircuitStatus(selectedDevice_CircuitsData[selectedCircuit]);
                    return (
                      <>
                        {Array.isArray(alertSentence) && alertSentence.length > 0 ? (
                          <div className={`grid ${alertSentence.length > 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mb-2 justify-items-center`}>
                            {alertSentence.map((sentence, index) => (
                              <h2 
                                key={index} 
                                className={`text-center font-bold ${alertClass} px-2 py-1 rounded ${alertSentence.length === 1 ? 'col-span-2' : ''}`}
                              >
                                {sentence}
                              </h2>
                            ))}
                          </div>
                        ) : (
                          alertSentence && <h2 className={`text-center font-bold mb-2 ${alertClass}`}>{alertSentence}</h2>
                        )}
                        <h2 className="text-xl mb-4">Device {selectedDevice} - Circuit {selectedCircuit}</h2>
                        <div className="flex-grow">
                          <CircuitChart
                            circuitName={selectedCircuit}
                            sensorData={selectedDevice_CircuitsData[selectedCircuit]}
                          />
                        </div>
                      </>
                    );
                  })()
                )}
              </div>
            );
          })()}

        </div>
      )} */}

    </div>
  );
};

export default CircuitChartListEach;





