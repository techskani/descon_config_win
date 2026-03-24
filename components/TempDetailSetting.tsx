'use client'

import { TableRowTemp, YamlDeviceConfig } from '@/app/types';
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

interface TempDetailProps {
  selectedDeviceName: string
  isEditable: boolean;
  config: YamlDeviceConfig[];
  onEdit: () => void;
  seteditConfig: (config: YamlDeviceConfig[]) => void;
  tempTableData: TableRowTemp[];
  settempTableData: (tabledata: TableRowTemp[]) => void;
}


export function TempDetailSettings( {selectedDeviceName, isEditable, config, onEdit, seteditConfig, tempTableData, settempTableData} : TempDetailProps) {
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
  const [originalTempTableData, setOriginalTempTableData] = useState<TableRowTemp[]>([]);

  // originalTempTableDataをuseRefで保護（再レンダリング中でも保持）
  const originalTempTableDataRef = useRef<TableRowTemp[]>([]);
  
  // データ読み出し状態管理
  const [isLoading, setIsLoading] = useState(false);
  const [lastReadData, setLastReadData] = useState<any>(null);

  // 親コンポーネントからのイベントリスナー
  useEffect(() => {
    const handleDeviceDataRead = (event: CustomEvent) => {
      const { deviceName } = event.detail;
      if (deviceName === selectedDeviceName) {
        console.log('📥 [ジュール熱] 読み出しイベント受信:', deviceName);
        handleReadDeviceData();
      }
    };

    const handleDeviceDataWrite = (event: CustomEvent) => {
      if (event.detail.deviceName === selectedDeviceName) {
        handleWriteDeviceData();
      }
    };

    window.addEventListener('deviceDataRead', handleDeviceDataRead as EventListener);
    window.addEventListener('deviceDataWrite', handleDeviceDataWrite as EventListener);
    return () => {
      window.removeEventListener('deviceDataRead', handleDeviceDataRead as EventListener);
      window.removeEventListener('deviceDataWrite', handleDeviceDataWrite as EventListener);
    };
  }, [selectedDeviceName]);

  // モデル固有の機能サポート判定
  const getModelCapabilities = (model: string) => {
    switch (model) {
      case "T8R0A":
        return {
          supportsImmediateCutoff: false, // 206番（即遮断温度）未サポート
          displayName: "キュービクル用A"
        };
      case "T24R8A":
        return {
          supportsImmediateCutoff: true,
          displayName: "キュービクル用B"
        };
      case "T28C16R8I1":
        return {
          supportsImmediateCutoff: true,
          displayName: "動力盤用B"
        };
      case "T64C30B30I1":
        return {
          supportsImmediateCutoff: true,
          displayName: "電灯盤用B"
        };
      case "T16I4C4R4A":
        return {
          supportsImmediateCutoff: true,
          displayName: "動力盤用A"
        };
      case "T24C10B10A":
        return {
          supportsImmediateCutoff: true,
          displayName: "ホーム分電盤用A"
        };
      case "T24C10B10AB":
        return {
          supportsImmediateCutoff: true,
          displayName: "ホーム分電盤用B"
        };
      default:
        return {
          supportsImmediateCutoff: true,
          displayName: model
        };
    }
  };

  const processEmpData = (empData: string) => {
    // SetValue,204,1=90.0,2=60.0,... の形式を処理
    const parts = empData.split(",");
    const processedData: string[] = [];
    
    // 最初の2つ（SetValue, 204など）はスキップして、key=value形式のみ処理
    for (let i = 2; i < parts.length; i++) {
      const [key, val] = parts[i].split("=");
      processedData[parseInt(key)] = val; // キーを数値インデックスとして使用
    }
    return processedData;
  };

  // SetValue,200の論理ch→物理chマッピングを解析する関数
  const parseChannelMapping = (setValue200: string): { [logicalCh: number]: number } => {
    const mapping: { [logicalCh: number]: number } = {};
    try {
      const parts = setValue200.split(",");
      // SetValue,200,1=1,2=2,3=3,... の形式を処理
      for (let i = 2; i < parts.length; i++) {
        const [logicalKey, physicalVal] = parts[i].split("=");
        const logicalCh = parseInt(logicalKey);
        const physicalCh = parseInt(physicalVal);
        if (!isNaN(logicalCh) && !isNaN(physicalCh)) {
          mapping[logicalCh] = physicalCh;
        }
      }
    } catch (error) {
      console.warn('SetValue,200解析エラー:', error);
    }
    return mapping;
  };
  
  useEffect(() => {
    async function processData() {
      if (selectedDeviceName) {
        const device = config.find(device => device.name === selectedDeviceName);
        if (device) {
          
          setDeviceDetail(device);
  
          // tempの中身を処理する
          const processedTemp = device.temp.map(processEmpData);
          
          
          // SetValue,200の論理ch→物理chマッピングを解析
          // SetValue,200が存在するかチェック
          const hasSetValue200 = device.temp.length > 0 && device.temp[0].includes('SetValue,200');
          const channelMapping = hasSetValue200 ? parseChannelMapping(device.temp[0]) : {};
          const hasValidMapping = Object.keys(channelMapping).length > 0;
          
          // SetValue,200が存在しない場合、配列インデックスを調整
          const offset = hasSetValue200 ? 0 : -1;
          
  
          const tabledetailData: TableRowTemp[] = [];
          
          // テーブルの行数はtemp-namesの長さを使用
          const rowCount = device["temp-names"].length;
          
          for (let i = 0; i < rowCount; i++) {
            const circuitIndex = device["circuits"].findIndex(circuit => circuit.name === device["temp-names"][i]);
            const circuitName = device["temp-names"][i] || "";
                      
            // 秒から分への変換と整数化を行う関数
            const secondsToMinutes = (seconds: string) => Math.round(parseInt(seconds) / 60).toString();

            // 埼大許容温度を取得する関数
            const getAllowableTemp = (wire: string, circuitName: string): number => {
              if (circuitName === "盤内温度") {
                return device["circuits"][circuitIndex]["allowable-temp"] ?? 60;
              }
              switch (wire) {
                case 'IV':
                case 'KIV':
                case 'VVF':
                case 'IV・KIV':
                case 'VCT':
                  return 60;
                case 'HIV':
                  return 75;
                case '600V CV':
                case 'CV':
                case 'MLFC':
                case '銅バー':
                  return 90;
                default:
                  return 60; // デフォルト値
              }
            };

            // デフォルトの回路値を取得する関数
            const getDefaultCircuitValues = (circuitName: string) => {
              if (circuitName.includes("主幹")) {
                // T44C20B20を追加 - kotani (2026/03/24)
                if (device.model === "T64C30B30I1" || device.model === "T24C10B10A" || device.model === "T24C10B10B" || device.model === "T44C20B20") {
                  return {
                    power: "電灯単層200V",
                    wire: "CV",
                    breaker: "100A",
                  };
                } else if (device.model === "T28C16R8I1" || device.model === "T16I4C4R4A") {
                  return {
                    power: "動力三相200V",
                    wire: "CV",
                    breaker: "300A",
                  };
                }
              } 
              return {
                power: "",
                wire: "",
                breaker: "",
              };
            };

            const defaultValues = getDefaultCircuitValues(circuitName);
            const wire = circuitIndex !== -1 ? device["circuits"][circuitIndex]["wire"] : defaultValues.wire;
            const power = circuitIndex !== -1 ? device["circuits"][circuitIndex]["power"] : defaultValues.power;
            const breaker = circuitIndex !== -1 ? device["circuits"][circuitIndex]["breaker"] : defaultValues.breaker;
            const breakerType = circuitIndex !== -1 ? device["circuits"][circuitIndex]["breaker-type"] : "";
            const allowableTemp = circuitIndex !== -1 ? getAllowableTemp(wire, device["temp-names"][i]) : 60;

            // モデルごとの相（phase）の設定
            let phaseLabel = "";
            if (device.model === "T28C16R8I1") {
                // 24センサーまでは3つずつR,S,T、それ以降は空文字
                if (i < 24) {
                    const phaseIndex = i % 3;
                    phaseLabel = phaseIndex === 0 ? "R" : phaseIndex === 1 ? "S" : "T";
                } else {
                    phaseLabel = "";
                }
            } else if (device.model === "T64C30B30I1") {
                // 60点まで対応、2点ずつで電源種別(power)によって相が変わる
                if (i < 60) {
                    const powerType = power || "";
                    
                    // 2点ずつのグループ内での位置（0または1）
                    const groupPosition = i % 2;
                    
                    if (powerType.includes("単相100V")) {
                        // 単相100Vの場合：R, N
                        phaseLabel = groupPosition === 0 ? "R" : "N";
                    } else if (powerType.includes("単相200V")) {
                        // 単相200Vの場合：R, T
                        phaseLabel = groupPosition === 0 ? "R" : "T";
                    } else {
                        phaseLabel = "";
                    }
                } else {
                    phaseLabel = "";
                }
            } else if (device.model === "T24C10B10A") {
                // 20点まで対応、2点ずつでpowerによって相が変わる
                if (i < 20) {
                  const powerType = power || "";
                      
                  // 2点ずつのグループ内での位置（0または1）
                  const groupPosition = i % 2;
                  
                  if (powerType.includes("単相100V")) {
                      // 単相100Vの場合：R, N
                      phaseLabel = groupPosition === 0 ? "R" : "N";
                  } else if (powerType.includes("単相200V")) {
                      // 単相200Vの場合：R, T
                      phaseLabel = groupPosition === 0 ? "R" : "T";
                  } else {
                      phaseLabel = "";
                  }
                } else {
                    phaseLabel = "";
                }
            } else if (device.model === "T24R8A") {
                const powerType = power || "";
                      
                // 3点ずつのグループ内での位置（0,1,2）
                const groupPosition = i % 3;

                if (powerType.includes("単相200V")) {
                    // 単相200Vの場合：R, N, T
                    phaseLabel = groupPosition === 0 ? "R" : groupPosition === 1 ? "N" : "T";
                } else if (powerType.includes("三相200V") || powerType.includes("三相100V")) {
                    // 三相100V/200Vの場合：R, S, T
                    phaseLabel = groupPosition === 0 ? "R" : groupPosition === 1 ? "S" : "T";
                } else {
                    phaseLabel = "";
                }
            // ホーム分電盤20/40回路 - kotani (2026/03/24)
            } else if (device.model === "T44C20B20") {
                // 40点まで対応、2点ずつで電源種別(power)によって相が変わる
                if (i < 40) {
                    const powerType = power || "";
                    
                    // 2点ずつのグループ内での位置（0または1）
                    const groupPosition = i % 2;
                    
                    if (powerType.includes("単相100V")) {
                        // 単相100Vの場合：R, N
                        phaseLabel = groupPosition === 0 ? "R" : "N";
                    } else if (powerType.includes("単相200V")) {
                        // 単相200Vの場合：R, T
                        phaseLabel = groupPosition === 0 ? "R" : "T";
                    } else {
                        phaseLabel = "";
                    }
                } else {
                    phaseLabel = "";
                }
            } else {
                // その他のモデルの場合
                phaseLabel = "";
            }
  
            // 論理ch（行番号）= YAMLのチャンネル番号
            const logicalCh = i + 1;
  
            tabledetailData.push({
              "sensor-No": logicalCh, // 表示用は論理ch
              "circuit-name": circuitName,
              power: power,
              wire: wire,
              breaker: breaker,
              "breaker-type": breakerType || "",
              "allowable-temp": allowableTemp,
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
              // 論理ch（行番号）をそのままチャンネル番号として使用
              // offset=-1の場合: temp[0]=201, temp[1]=202, temp[2]=203, ...
              // offset=0の場合: temp[0]=200, temp[1]=201, temp[2]=202, temp[3]=203, ...
              sensor: circuitName === "未使用" ? '0' : (processedTemp[1 + offset]?.[logicalCh] ?? '0'),
              "caution-temp": circuitName === "未使用" ? '0.0' : (processedTemp[2 + offset]?.[logicalCh] ?? '0.0'),
              "caution-time": circuitName === "未使用" ? '0' : (processedTemp[3 + offset]?.[logicalCh] ?? '0'),
              "cutoff-temp": circuitName === "未使用" ? '0.0' : (processedTemp[4 + offset]?.[logicalCh] ?? '0.0'),
              "cutoff-time": circuitName === "未使用" ? '0' : (processedTemp[5 + offset]?.[logicalCh] ?? '0'),
              "imm-cutoff-temp": circuitName === "未使用" ? '0.0' : 
                // モデルが即遮断温度をサポートしない場合は空欄表示
                (!getModelCapabilities(device.model).supportsImmediateCutoff ? '' : (processedTemp[6 + offset]?.[logicalCh] ?? '0.0')),
              // SetValue,201の有効/無効フラグ（0=無効、1=有効）
              "sensor-enabled": circuitName === "未使用" ? '0' : (processedTemp[1 + offset]?.[logicalCh] ?? '0'),
            });
          }
          
          
          settempTableData(tabledetailData);
          setOriginalTempTableData(tabledetailData);
          // useRefにも保存（再レンダリング中でも保持される）
          originalTempTableDataRef.current = tabledetailData;
          
          // T24C10B10A, T28C16R8I1, T64C30B30I1の場合、windowオブジェクトにも保存（設定データ変更時に使用）
          // T44C20B20を追加 - kotani (2026/03/24)
          if (device.model === "T24C10B10A" || device.model === "T28C16R8I1" || device.model === "T64C30B30I1" || device.model === "T44C20B20") {
            (window as any).tempTableDataForWrite = tabledetailData;
          }
        } else {
          console.warn('⚠️ [processData] デバイスが見つかりません:', selectedDeviceName);
        }
      }
    }
    processData();
  }, [selectedDeviceName, config]);

  const handleInputChange = (index: number, field: string, value: string) => {
    const updatedTableData = tempTableData.map((row, rowIndex) => {
      if (rowIndex === index) {
        return {
          ...row,
          [field]: value,
        };
      }
      return row;
    });
    settempTableData(updatedTableData);
    
    // T24C10B10A, T28C16R8I1, T64C30B30I1の場合、windowオブジェクトにも保存（設定データ変更時に使用）
    // T44C20B20を追加 - kotani (2026/03/24)
    if (deviceDetail.model === "T24C10B10A" || deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T64C30B30I1" || deviceDetail.model === "T44C20B20") {
      (window as any).tempTableDataForWrite = updatedTableData;
    }
    
  // 温度・時間フィールドの変更は連動処理をスキップ（テーブル更新のみ）
  const isTemperatureOrTimeField = [
    'caution-temp', 'caution-time', 
    'cutoff-temp', 'cutoff-time', 
    'imm-cutoff-temp'
  ].includes(field);
  
  if (isTemperatureOrTimeField) {
    // 温度・時間フィールドの場合は、テーブル更新のみで連動処理は不要
    return;
  }
    
  // モデル別の連動処理（T24C10B10A / T24R8A / T28C16R8I1 / T64C30B30I1）
  // 回路名や電源種別の変更時のみ実行
  // T44C20B20を追加 - kotani (2026/03/24)
  if (deviceDetail.model === "T24C10B10A" || deviceDetail.model === "T24R8A" || deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T64C30B30I1" || deviceDetail.model === "T44C20B20") {
      const changedRow = tempTableData[index]; // 変更前のデータ
      const updatedRow = updatedTableData[index]; // 変更後のデータ
      
      // 回路名が変更された場合
      if (field === "circuit-name") {
        const oldCircuitName = changedRow["circuit-name"];
        const newCircuitName = value;
        
        // configの関連フィールドを更新
        const updatedConfig = config.map(device => {
          if (device.name === selectedDeviceName) {
            if (deviceDetail.model === "T24R8A") {
              // T24R8A: temp-names, curr-names, leak-namesを特別な構造で更新
              return {
                ...device,
                circuits: device.circuits.map(circuit => 
                  circuit.name === oldCircuitName 
                    ? { ...circuit, name: newCircuitName }
                    : circuit
                ),
                "brkr-names": device["brkr-names"].map(name => 
                  name === oldCircuitName ? newCircuitName : name
                ),
                "temp-names": device["temp-names"].map(name => 
                  name === oldCircuitName ? newCircuitName : name
                ),
                "curr-names": device["curr-names"].map(name => 
                  name === oldCircuitName ? newCircuitName : name
                ),
                "leak-names": device["leak-names"].map(name => 
                  name === oldCircuitName ? newCircuitName : name
                ),
              };
            } else if (deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T64C30B30I1") {
              // T28C16R8I1/T64C30B30I1: temp-names, track-names, curr-namesを特別な構造で更新
              return {
                ...device,
                circuits: device.circuits.map(circuit => 
                  circuit.name === oldCircuitName 
                    ? { ...circuit, name: newCircuitName }
                    : circuit
                ),
                "brkr-names": device["brkr-names"].map(name => 
                  name === oldCircuitName ? newCircuitName : name
                ),
                "temp-names": device["temp-names"].map(name => 
                  name === oldCircuitName ? newCircuitName : name
                ),
                "track-names": device["track-names"].map(name => 
                  name === oldCircuitName ? newCircuitName : name
                ),
                "curr-names": device["curr-names"].map(name => 
                  name === oldCircuitName ? newCircuitName : name
                ),
              };
            } else {
              // T24C10B10A
              return {
                ...device,
                circuits: device.circuits.map(circuit => 
                  circuit.name === oldCircuitName 
                    ? { ...circuit, name: newCircuitName }
                    : circuit
                ),
                "brkr-names": device["brkr-names"].map(name => 
                  name === oldCircuitName ? newCircuitName : name
                ),
                "temp-names": device["temp-names"].map(name => 
                  name === oldCircuitName ? newCircuitName : name
                ),
                "track-names": device["track-names"].map(name => 
                  name === oldCircuitName ? newCircuitName : name
                ),
                "curr-names": device["curr-names"].map(name => 
                  name === oldCircuitName ? newCircuitName : name
                ),
              };
            }
          }
          return device;
        });
        seteditConfig(updatedConfig);
        
        // 他のテーブルにも通知
        setTimeout(() => {
          const event = new CustomEvent('tempTableCircuitNameChange', {
            detail: {
              deviceName: selectedDeviceName,
              oldCircuitName: oldCircuitName,
              newCircuitName: newCircuitName,
              newPower: updatedRow.power,
              newBreaker: updatedRow.breaker,
              newWire: updatedRow.wire
            }
          });
          window.dispatchEvent(event);
        }, 0);
      }
      
      // 電源種別(power)が変更された場合
      if (field === "power") {
        const circuitName = changedRow["circuit-name"];
        
        // configのcircuits配列のpowerを更新
        const updatedConfig = config.map(device => {
          if (device.name === selectedDeviceName) {
            return {
              ...device,
              circuits: device.circuits.map(circuit => 
                circuit.name === circuitName 
                  ? { ...circuit, power: value }
                  : circuit
              ),
            };
          }
          return device;
        });
        seteditConfig(updatedConfig);
        
        // 他のテーブルにも通知
        const event = new CustomEvent('tempTablePowerChange', {
          detail: {
            deviceName: selectedDeviceName,
            circuitName: circuitName,
            newPower: value
          }
        });
        window.dispatchEvent(event);
      }
    }
  };

  const handleCircuitNameChange = (event: React.ChangeEvent<HTMLSelectElement>, row: TableRowTemp) => {
    const newCircuitName = event.target.value;
    const selectedCircuit = deviceDetail.circuits.find(circuit => circuit.name === newCircuitName);
    
    console.log('🔧 回路名変更:', {
      oldName: row["circuit-name"],
      newName: newCircuitName,
      selectedCircuit: selectedCircuit,
      model: deviceDetail.model
    });
    
    let existingRowR = null;
    let existingRowS = null;
    let existingRowT = null;
    let existingRowN = null;
    let existingRowWithSameCircuit = null;
    let existingRowsWithSameCircuitList = [];

    const getAllowableTemp = (wire: string): number => {
      switch (wire) {
        case 'IV':
        case 'KIV':
        case 'VVF':
        case 'IV・KIV':
        case 'VCT':
          return 60;
        case 'HIV':
          return 75;
        case '600V CV':
        case 'CV':
        case 'MLFC':
        case '銅バー':
          return 90;
        default:
          return 60; // デフォルト値
      }
    };

    const getMaxSensorNo = (model: string): number => {
      switch (model) {
        case 'T28C16R8I1':
          return 24;
        case 'T16I4C4R4A':
          return 12;
        case 'T64C30B30I1':
          return 60;
        case 'T24C10B10A':
          return 20;
        case 'T24R8A':
          return 24;
        case 'T8R0A':
          return 8;
        // T44C20B20を追加 - kotani (2026/03/24)
        case 'T44C20B20':
          return 40;
        default:
          return 20; 
      }
    };
    
    const maxSensorNo = getMaxSensorNo(deviceDetail.model);

    if (deviceDetail.model === "T28C16R8I1" && row["sensor-No"] <= maxSensorNo) {
      // 選択した回路の全相（R,S,T）のデータを取得
      existingRowsWithSameCircuitList = originalTempTableData.filter(r => r["circuit-name"] === newCircuitName);
  
      // R相、S相、T相のデータを個別に取得
      existingRowR = existingRowsWithSameCircuitList.find(r => r.phase === "R");
      existingRowS = existingRowsWithSameCircuitList.find(r => r.phase === "S");
      existingRowT = existingRowsWithSameCircuitList.find(r => r.phase === "T");
    // T44C20B20を追加 - kotani (2026/03/24)
    } else if ((deviceDetail.model === "T64C30B30I1" || deviceDetail.model === "T24C10B10A" || deviceDetail.model === "T44C20B20") && row["sensor-No"] <= maxSensorNo) {
      // 選択した回路の全相（R,N/T）のデータを取得
      existingRowsWithSameCircuitList = originalTempTableData.filter(r => r["circuit-name"] === newCircuitName);
  
      // R相、N相/T相のデータを個別に取得
      existingRowR = existingRowsWithSameCircuitList.find(r => r.phase === "R");
      existingRowN = existingRowsWithSameCircuitList.find(r => r.phase === "N");
      existingRowT = existingRowsWithSameCircuitList.find(r => r.phase === "T");
    } else if (deviceDetail.model === "T24R8A" && row["sensor-No"] <= maxSensorNo) {
      // 選択した回路の全相（R,S,N,T）のデータを取得
      existingRowsWithSameCircuitList = originalTempTableData.filter(r => r["circuit-name"] === newCircuitName);
  
      // R相、N相/T相のデータを個別に取得
      existingRowR = existingRowsWithSameCircuitList.find(r => r.phase === "R");
      existingRowS = existingRowsWithSameCircuitList.find(r => r.phase === "S");
      existingRowN = existingRowsWithSameCircuitList.find(r => r.phase === "N");
      existingRowT = existingRowsWithSameCircuitList.find(r => r.phase === "T");
    } else {
      // 新しく選択された回路名と同じ回路名を持つ行をロード時のtempTableDataから探す
      existingRowWithSameCircuit = originalTempTableData.find(r => r["circuit-name"] === newCircuitName);
    }

    const updatedTableData = tempTableData.map((r) => {
      const sensorNo = r["sensor-No"];
      let shouldUpdate = false;

      // モデルに基づいて、この行を更新すべきかどうかを判断
      if (deviceDetail.model === "T28C16R8I1" && row["sensor-No"] <= maxSensorNo && sensorNo <= maxSensorNo) {
        // T28C16R8I1: 最大点数以下の場合は3つずつグループ化
        const groupIndex = Math.floor((row["sensor-No"] - 1) / 3);
        const currentGroupIndex = Math.floor((sensorNo - 1) / 3);
        shouldUpdate = groupIndex === currentGroupIndex;
      // T44C20B20を追加 - kotani (2026/03/24)
      } else if ((deviceDetail.model === "T64C30B30I1" || deviceDetail.model === "T24C10B10A" || deviceDetail.model === "T44C20B20") && row["sensor-No"] <= maxSensorNo && sensorNo <= maxSensorNo) {
        // T64C30B30I1/T24C10B10A: 最大点数以下の場合は2つずつグループ化
        const groupIndex = Math.floor((row["sensor-No"] - 1) / 2);
        const currentGroupIndex = Math.floor((sensorNo - 1) / 2);
        shouldUpdate = groupIndex === currentGroupIndex;
      } else if (deviceDetail.model === 'T24C10B10B') {
        if (row["sensor-No"] <= 20 || (row["sensor-No"] >= 25 && row["sensor-No"] <= 44)) {
          // 1-20と25-44の範囲では2つずつペア
          shouldUpdate = Math.floor((sensorNo - 1) / 2) === Math.floor((row["sensor-No"] - 1) / 2);
        } else if (row["sensor-No"] >= 21 && row["sensor-No"] <= 24) {
          // 21-24の範囲ではペアなし（完全一致のみ）
          shouldUpdate = sensorNo === row["sensor-No"];
        } else {
          // その他の範囲（45以上）は完全一致のみ
          shouldUpdate = sensorNo === row["sensor-No"];
        }
      } else if (deviceDetail.model === "T24R8A" && row["sensor-No"] <= maxSensorNo && sensorNo <= maxSensorNo) {
        // T24R8A: 最大点数以下の場合は3つずつグループ化
        const groupIndex = Math.floor((row["sensor-No"] - 1) / 3);
        const currentGroupIndex = Math.floor((sensorNo - 1) / 3);
        shouldUpdate = groupIndex === currentGroupIndex;
      } else {
        // その他のモデルまたは最大点数を超えた場合: 選択した行のみを更新
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
            "allowable-temp": 0,
            relay: "0",
            "caution-temp": '0.0',
            "caution-time": '0',
            "cutoff-temp": '0.0',
            "cutoff-time": '0',
            "imm-cutoff-temp": '0.0',
          };
        } else if (newCircuitName === "盤内温度") {
          // "盤内温度"が選択された場合の処理
          const panelTempCircuit = deviceDetail.circuits.find(circuit => circuit.name === "盤内温度");
          const allowableTemp = panelTempCircuit ? panelTempCircuit["allowable-temp"] : 60;
          return {
            ...r,
            "circuit-name": "盤内温度",
            power: "",
            breaker: "",
            wire: "",
            "allowable-temp": allowableTemp ?? 60,
            relay: "0",
            "caution-temp": ((allowableTemp ?? 60) + 1).toFixed(1),
            "caution-time": '60',
            "cutoff-temp": ((allowableTemp ?? 60) + 5).toFixed(1),
            "cutoff-time": '60',
            "imm-cutoff-temp": ((allowableTemp ?? 60) + 10).toFixed(1),
          };
        } else if (selectedCircuit) {
          // 相固有のデータを使用する必要があるかどうか判断
          // T44C20B20を追加 - kotani (2026/03/24)
          const usePhaseSpecificData = (
            (deviceDetail.model === "T28C16R8I1" && row["sensor-No"] <= maxSensorNo) ||
            (deviceDetail.model === "T64C30B30I1" && row["sensor-No"] <= maxSensorNo) ||
            (deviceDetail.model === "T24C10B10A" && row["sensor-No"] <= maxSensorNo) ||
            (deviceDetail.model === "T44C20B20" && row["sensor-No"] <= maxSensorNo) ||
            (deviceDetail.model === "T24R8A" && row["sensor-No"] <= maxSensorNo)
          );
          
          if (usePhaseSpecificData) {
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
            } else if (currentPhase === "N" && existingRowN) {
              phaseSpecificData = existingRowN;
            }
            
            // 回路が選択された場合の処理
            const allowableTemp = getAllowableTemp(selectedCircuit["wire"]);
            const newRelay = selectedCircuit.autotrip === 1 ? selectedCircuit.output.toString() : "0";
            
            // 相固有のデータがあればそれを使用、なければ共通の計算値
            return {
              ...r,
              "circuit-name": newCircuitName,
              power: selectedCircuit["power"],
              breaker: selectedCircuit["breaker"],
              wire: selectedCircuit["wire"],
              "allowable-temp": allowableTemp,
              relay: newRelay,
              "caution-temp": phaseSpecificData ? phaseSpecificData["caution-temp"] : ((allowableTemp ?? 60) + 1).toFixed(1),
              "caution-time": phaseSpecificData ? phaseSpecificData["caution-time"] : deviceDetail.model === "T28C16R8I1" ? '120' : '60',
              "cutoff-temp": phaseSpecificData ? phaseSpecificData["cutoff-temp"] : ((allowableTemp ?? 60) + 5).toFixed(1),
              "cutoff-time": phaseSpecificData ? phaseSpecificData["cutoff-time"] : deviceDetail.model === "T28C16R8I1" ? '120' : '60',
              "imm-cutoff-temp": phaseSpecificData ? phaseSpecificData["imm-cutoff-temp"] : ((allowableTemp ?? 60) + 10).toFixed(1),
            };
          } else {
            // その他のモデルまたは最大点数を超えた場合
            const allowableTemp = getAllowableTemp(selectedCircuit["wire"]);
            const newRelay = selectedCircuit.autotrip === 1 ? selectedCircuit.output.toString() : "0";
            
            return {
              ...r,
              "circuit-name": newCircuitName,
              power: selectedCircuit["power"],
              breaker: selectedCircuit["breaker"],
              wire: selectedCircuit["wire"],
              "allowable-temp": allowableTemp,
              relay: newRelay,
              "caution-temp": existingRowWithSameCircuit ? existingRowWithSameCircuit["caution-temp"] : ((allowableTemp ?? 60) + 1).toFixed(1),
              "caution-time": existingRowWithSameCircuit ? existingRowWithSameCircuit["caution-time"] : newCircuitName.includes("主幹") ? '120' : '60',
              "cutoff-temp": existingRowWithSameCircuit ? existingRowWithSameCircuit["cutoff-temp"] : ((allowableTemp ?? 60) + 5).toFixed(1),
              "cutoff-time": existingRowWithSameCircuit ? existingRowWithSameCircuit["cutoff-time"] : newCircuitName.includes("主幹") ? '120' : '60',
              "imm-cutoff-temp": existingRowWithSameCircuit ? existingRowWithSameCircuit["imm-cutoff-temp"] : ((allowableTemp ?? 60) + 10).toFixed(1),
            };
          }
        }
      }
      return r;
    });
    settempTableData(updatedTableData);
    
    // T24C10B10A、T24R8A、T28C16R8I1、T64C30B30I1モデルで回路名が変更された場合、他のテーブルとconfigを更新
    // T44C20B20を追加 - kotani (2026/03/24)
    if (deviceDetail.model === "T24C10B10A" || deviceDetail.model === "T24R8A" || deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T64C30B30I1" || deviceDetail.model === "T44C20B20") {
      const oldCircuitName = row["circuit-name"];
      
      // 変更後の回路情報を取得（updatedTableDataから）
      const updatedRow = updatedTableData.find(r => 
        r["sensor-No"] === row["sensor-No"]
      );
      const newPower = updatedRow?.power || selectedCircuit?.power || row.power;
      const newBreaker = updatedRow?.breaker || selectedCircuit?.breaker || row.breaker;
      const newWire = updatedRow?.wire || selectedCircuit?.wire || row.wire;
      
      // configの関連フィールドを更新
      const updatedConfig = config.map(device => {
        if (device.name === selectedDeviceName) {
          if (deviceDetail.model === "T24R8A") {
            // T24R8A: temp-names, curr-names, leak-namesを特別な構造で更新
            const oldIndex = device.circuits.findIndex(c => c.name === oldCircuitName);
            
            // 新しいtemp-names（24要素、各回路が3回ずつ）
            const newTempNames = device["temp-names"].map(name => 
              name === oldCircuitName ? newCircuitName : name
            );
            
            // 新しいcurr-names（27要素、未使用×3 + 回路名×3の繰り返し）
            const newCurrNames = device["curr-names"].map(name => 
              name === oldCircuitName ? newCircuitName : name
            );
            
            // 新しいleak-names（9要素、未使用 + 回路名）
            const newLeakNames = device["leak-names"].map(name => 
              name === oldCircuitName ? newCircuitName : name
            );
            
            return {
              ...device,
              circuits: device.circuits.map(circuit => 
                circuit.name === oldCircuitName 
                  ? { 
                      ...circuit, 
                      name: newCircuitName, 
                      power: newPower,
                      breaker: newBreaker,
                      wire: newWire
                    }
                  : circuit
              ),
              "brkr-names": device["brkr-names"].map(name => 
                name === oldCircuitName ? newCircuitName : name
              ),
              "temp-names": newTempNames,
              "curr-names": newCurrNames,
              "leak-names": newLeakNames,
            };
          } else if (deviceDetail.model === "T28C16R8I1" || deviceDetail.model === "T64C30B30I1") {
            // T28C16R8I1/T64C30B30I1: temp-names, track-names, curr-namesを特別な構造で更新
            return {
              ...device,
              circuits: device.circuits.map(circuit => 
                circuit.name === oldCircuitName 
                  ? { 
                      ...circuit, 
                      name: newCircuitName, 
                      power: newPower,
                      breaker: newBreaker,
                      wire: newWire
                    }
                  : circuit
              ),
              "brkr-names": device["brkr-names"].map(name => 
                name === oldCircuitName ? newCircuitName : name
              ),
              "temp-names": device["temp-names"].map(name => 
                name === oldCircuitName ? newCircuitName : name
              ),
              "track-names": device["track-names"].map(name => 
                name === oldCircuitName ? newCircuitName : name
              ),
              "curr-names": device["curr-names"].map(name => 
                name === oldCircuitName ? newCircuitName : name
              ),
            };
          } else {
            // T24C10B10A
            // TODO：T44C20B20はどうする？ - kotani (2026/03/24)
            return {
              ...device,
              circuits: device.circuits.map(circuit => 
                circuit.name === oldCircuitName 
                  ? { 
                      ...circuit, 
                      name: newCircuitName, 
                      power: newPower,
                      breaker: newBreaker,
                      wire: newWire
                    }
                  : circuit
              ),
              "brkr-names": device["brkr-names"].map(name => 
                name === oldCircuitName ? newCircuitName : name
              ),
              "temp-names": device["temp-names"].map(name => 
                name === oldCircuitName ? newCircuitName : name
              ),
              "track-names": device["track-names"].map(name => 
                name === oldCircuitName ? newCircuitName : name
              ),
              "curr-names": device["curr-names"].map(name => 
                name === oldCircuitName ? newCircuitName : name
              ),
            };
          }
        }
        return device;
      });
      seteditConfig(updatedConfig);
      
      // setTimeoutで少し遅延させてから他のテーブルに通知（テーブル更新が完了してから）
      setTimeout(() => {
        const event = new CustomEvent('tempTableCircuitNameChange', {
          detail: {
            deviceName: selectedDeviceName,
            oldCircuitName: oldCircuitName,
            newCircuitName: newCircuitName,
            newPower: newPower,
            newBreaker: newBreaker,
            newWire: newWire
          }
        });
        window.dispatchEvent(event);
      }, 0);
    }
  };

  // バックエンドデータでメインテーブルを更新する関数
  const updateMainTableWithBackendData = (backendSettings: any) => {
    if (!backendSettings?.temp_settings) {
      console.warn('⚠️ バックエンド設定データが不完全です');
      return;
    }

    // originalTempTableDataRefを使用（再レンダリング中でも保持される）
    const baseTableData = originalTempTableDataRef.current.length > 0 
      ? originalTempTableDataRef.current 
      : (originalTempTableData.length > 0 ? originalTempTableData : tempTableData);
    
    // テーブルデータが空の場合、何もしない
    if (baseTableData.length === 0) {
      console.warn('⚠️ テーブルデータが空です。テーブルが初期化されていない可能性があります。');
      return;
    }

    const tempSettings = backendSettings.temp_settings;
    const deviceModel = backendSettings.device_info?.model || deviceDetail.model;
    const circuits = backendSettings.circuits || [];
    const tempNames = backendSettings.temp_names || [];
    
    const updatedTableData = baseTableData.map((row, rowIndex) => {
      const channelNum = row["sensor-No"];
      
      // デバッグログ（最初の3行のみ）
      if (rowIndex < 3) {
        console.log(`📊 [読み出し] 行${rowIndex + 1}: sensor-No=${channelNum}, warning_temp=${tempSettings.warning_temperatures?.[channelNum]}, row.caution-temp=${row["caution-temp"]}`);
      }
      
      // T24C10B10Aの場合、temp-namesから回路名を取得
      let circuitName = row["circuit-name"];
      let power = row.power;
      let breaker = row.breaker;
      let wire = row.wire;
      
      if (deviceModel === "T24C10B10A" && tempNames.length > 0) {
        // センサー番号に対応するtemp-namesのインデックス（0-based）
        const tempNameIndex = channelNum - 1;
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
      } else if (deviceModel === "T24R8A" && tempNames.length > 0) {
        // T24R8A: temp-namesから回路名を取得（3点グループ）
        const tempNameIndex = channelNum - 1;
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
      }
      
      return {
        ...row,
        "circuit-name": circuitName,
        power: power,
        breaker: breaker,
        wire: wire,
        "caution-temp": tempSettings.warning_temperatures?.[channelNum] !== undefined 
          ? tempSettings.warning_temperatures[channelNum].toString() 
          : row["caution-temp"],
        "caution-time": tempSettings.warning_times?.[channelNum] !== undefined 
          ? tempSettings.warning_times[channelNum].toString() 
          : row["caution-time"], 
        "cutoff-temp": tempSettings.alarm_temperatures?.[channelNum] !== undefined 
          ? tempSettings.alarm_temperatures[channelNum].toString() 
          : row["cutoff-temp"],
        "cutoff-time": tempSettings.alarm_times?.[channelNum] !== undefined 
          ? tempSettings.alarm_times[channelNum].toString() 
          : row["cutoff-time"],
        "imm-cutoff-temp": getModelCapabilities(deviceModel).supportsImmediateCutoff 
          ? (tempSettings.immediate_thresholds?.[channelNum] !== undefined 
              ? tempSettings.immediate_thresholds[channelNum].toString() 
              : row["imm-cutoff-temp"])
          : row["imm-cutoff-temp"]
      };
    });

    // デバッグ: 更新後のデータを確認（最初の3行のみ）
    console.log('📊 [読み出し] 更新後のテーブルデータ（最初の3行）:');
    updatedTableData.slice(0, 3).forEach((row, index) => {
      console.log(`  行${index + 1}: sensor-No=${row["sensor-No"]}, caution-temp=${row["caution-temp"]}, circuit-name=${row["circuit-name"]}`);
    });
    
    settempTableData(updatedTableData);
    
    // T24C10B10A, T28C16R8I1, T64C30B30I1の場合、windowオブジェクトも更新
    // 44C20B20を追加 - kotani (2026/03/24)
    if (deviceModel === "T24C10B10A" || deviceModel === "T28C16R8I1" || deviceModel === "T64C30B30I1" || deviceModel === "T44C20B20") {
      (window as any).tempTableDataForWrite = updatedTableData;
    }
    
    // settempTableData後の確認（useStateは非同期なので、次のレンダリングで反映される）
    console.log('📊 [読み出し] settempTableData()呼び出し完了（次のレンダリングで反映されます）');
  };

  // T24C10B10A用：temp-namesに基づいてconfig全体を同期
  const syncConfigWithTempNames = (backendSettings: any) => {
    const tempNames = backendSettings.temp_names || [];
    const circuits = backendSettings.circuits || [];
    
    // temp-namesから各種names配列を生成
    // temp-names: [電灯1, 電灯1, 電灯2, 電灯2, ...] (24個、R/N)
    // brkr/track/curr-names: [電灯1, 電灯2, ...] (10個、偶数インデックスのみ)
    
    const brkrNames: string[] = [];
    const trackNames: string[] = [];
    const currNames: string[] = [];
    
    // 偶数インデックスのtemp-namesを抽出（各回路の代表名）
    for (let i = 0; i < tempNames.length; i += 2) {
      const circuitName = tempNames[i];
      // 主幹と盤内温度は除外（brkr/track/curr-namesには含まれない）
      if (circuitName !== "主幹" && circuitName !== "盤内温度" && circuitName !== "未使用") {
        brkrNames.push(circuitName);
        trackNames.push(circuitName);
        currNames.push(circuitName);
      }
    }
    
    // configを更新
    const updatedConfig = config.map(device => {
      if (device.name === selectedDeviceName) {
        // circuits配列のnameも更新（temp-namesの偶数インデックスと対応）
        const updatedCircuits = device.circuits.map((circuit, index) => {
          const tempNameIndex = index * 2;
          if (tempNameIndex < tempNames.length) {
            const newName = tempNames[tempNameIndex];
            // circuitsから対応する詳細情報を取得
            const backendCircuit = circuits.find((c: any) => c.name === newName);
            if (backendCircuit) {
              return {
                ...circuit,
                name: newName,
                power: backendCircuit.power || circuit.power,
                breaker: backendCircuit.breaker || circuit.breaker,
                wire: backendCircuit.wire || circuit.wire
              };
            }
            return {
              ...circuit,
              name: newName
            };
          }
          return circuit;
        });
        
        return {
          ...device,
          "temp-names": tempNames,
          "brkr-names": brkrNames,
          "track-names": trackNames,
          "curr-names": currNames,
          circuits: updatedCircuits
        };
      }
      return device;
    });
    
    seteditConfig(updatedConfig);
  };

  // T24R8A用：temp-namesに基づいてconfig全体を同期
  const syncConfigWithTempNamesForT24R8A = (backendSettings: any) => {
    const tempNames = backendSettings.temp_names || [];
    const currNames = backendSettings.curr_names || [];
    const leakNames = backendSettings.leak_names || [];
    const circuits = backendSettings.circuits || [];
    
    const updatedConfig = config.map(device => {
      if (device.name === selectedDeviceName) {
        // circuitsも更新
        const updatedCircuits = device.circuits.map((circuit, index) => {
          // 3点グループの最初のtemp-namesを使用（i=0→0, i=1→3, i=2→6...）
          const tempNameIndex = index * 3;
          if (tempNameIndex < tempNames.length) {
            const newName = tempNames[tempNameIndex];
            // circuitsから新しい名前に対応する情報を検索
            const backendCircuit = circuits.find((c: any) => c.name === newName);
            if (backendCircuit) {
              return {
                ...circuit,
                name: newName,
                power: backendCircuit.power || circuit.power,
                breaker: backendCircuit.breaker || circuit.breaker,
                wire: backendCircuit.wire || circuit.wire
              };
            }
            // バックエンドのcircuitsに見つからない場合は名前のみ更新
            return {
              ...circuit,
              name: newName
            };
          }
          return circuit;
        });
        
        // brkr-namesを更新（circuitsのnameから生成）
        const brkrNames = updatedCircuits.map(c => c.name);
        
        return {
          ...device,
          "temp-names": tempNames,
          "curr-names": currNames,
          "leak-names": leakNames,
          "brkr-names": brkrNames,
          circuits: updatedCircuits
        };
      }
      return device;
    });
    
    seteditConfig(updatedConfig);
  };

  // T28C16R8I1用：temp-namesに基づいてconfig全体を同期（3点グループ）
  const syncConfigWithTempNamesForT28C16R8I1 = (backendSettings: any) => {
    const tempNames = backendSettings.temp_names || [];
    const trackNames = backendSettings.track_names || [];
    const currNames = backendSettings.curr_names || [];
    const circuits = backendSettings.circuits || [];
    
    const updatedConfig = config.map(device => {
      if (device.name === selectedDeviceName) {
        // circuitsも更新
        const updatedCircuits = device.circuits.map((circuit, index) => {
          // 3点グループの最初のtemp-namesを使用（i=0→0, i=1→3, i=2→6...）
          const tempNameIndex = index * 3;
          if (tempNameIndex < tempNames.length) {
            const newName = tempNames[tempNameIndex];
            const backendCircuit = circuits.find((c: any) => c.name === newName);
            if (backendCircuit) {
              return {
                ...circuit,
                name: newName,
                power: backendCircuit.power || circuit.power,
                breaker: backendCircuit.breaker || circuit.breaker,
                wire: backendCircuit.wire || circuit.wire
              };
            }
            return {
              ...circuit,
              name: newName
            };
          }
          return circuit;
        });
        
        // brkr-namesを更新（circuitsのnameから生成、主幹を除く）
        const brkrNames = updatedCircuits
          .filter(c => c.name !== "主幹")
          .map(c => c.name);
        
        return {
          ...device,
          "temp-names": tempNames,
          "track-names": trackNames,
          "curr-names": currNames,
          "brkr-names": brkrNames,
          circuits: updatedCircuits
        };
      }
      return device;
    });
    
    seteditConfig(updatedConfig);
  };

  // T64C30B30I1用：temp-namesに基づいてconfig全体を同期（2点グループ）
  const syncConfigWithTempNamesForT64C30B30I1 = (backendSettings: any) => {
    const tempNames = backendSettings.temp_names || [];
    const trackNames = backendSettings.track_names || [];
    const currNames = backendSettings.curr_names || [];
    const circuits = backendSettings.circuits || [];
    
    const updatedConfig = config.map(device => {
      if (device.name === selectedDeviceName) {
        // circuitsも更新
        const updatedCircuits = device.circuits.map((circuit, index) => {
          // 2点グループの最初のtemp-namesを使用（i=0→0, i=1→2, i=2→4...）
          const tempNameIndex = index * 2;
          if (tempNameIndex < tempNames.length) {
            const newName = tempNames[tempNameIndex];
            const backendCircuit = circuits.find((c: any) => c.name === newName);
            if (backendCircuit) {
              return {
                ...circuit,
                name: newName,
                power: backendCircuit.power || circuit.power,
                breaker: backendCircuit.breaker || circuit.breaker,
                wire: backendCircuit.wire || circuit.wire
              };
            }
            return {
              ...circuit,
              name: newName
            };
          }
          return circuit;
        });
        
        // brkr-namesを更新（circuitsのnameから生成、主幹を除く）
        const brkrNames = updatedCircuits
          .filter(c => c.name !== "主幹")
          .map(c => c.name);
        
        return {
          ...device,
          "temp-names": tempNames,
          "track-names": trackNames,
          "curr-names": currNames,
          "brkr-names": brkrNames,
          circuits: updatedCircuits
        };
      }
      return device;
    });
    
    seteditConfig(updatedConfig);
  };

  // T44C20B20用：temp-namesに基づいてconfig全体を同期（2点グループ）
  const syncConfigWithTempNamesForT44C20B20 = (backendSettings: any) => {
    const tempNames = backendSettings.temp_names || [];
    const trackNames = backendSettings.track_names || [];
    const currNames = backendSettings.curr_names || [];
    const circuits = backendSettings.circuits || [];
    
    const updatedConfig = config.map(device => {
      if (device.name === selectedDeviceName) {
        // circuitsも更新
        const updatedCircuits = device.circuits.map((circuit, index) => {
          // 2点グループの最初のtemp-namesを使用（i=0→0, i=1→2, i=2→4...）
          const tempNameIndex = index * 2;
          if (tempNameIndex < tempNames.length) {
            const newName = tempNames[tempNameIndex];
            const backendCircuit = circuits.find((c: any) => c.name === newName);
            if (backendCircuit) {
              return {
                ...circuit,
                name: newName,
                power: backendCircuit.power || circuit.power,
                breaker: backendCircuit.breaker || circuit.breaker,
                wire: backendCircuit.wire || circuit.wire
              };
            }
            return {
              ...circuit,
              name: newName
            };
          }
          return circuit;
        });
        
        // brkr-namesを更新（circuitsのnameから生成、主幹を除く）
        const brkrNames = updatedCircuits
          .filter(c => c.name !== "主幹")
          .map(c => c.name);
        
        return {
          ...device,
          "temp-names": tempNames,
          "track-names": trackNames,
          "curr-names": currNames,
          "brkr-names": brkrNames,
          circuits: updatedCircuits
        };
      }
      return device;
    });
    
    seteditConfig(updatedConfig);
  };

  // バックエンドから設定データを読み出す機能
  const handleReadDeviceData = async () => {
    if (!selectedDeviceName) {
      alert('デバイスが選択されていません。');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('📖 [読み出し] =========== 開始 ===========');
      console.log('📖 [読み出し] デバイス名:', selectedDeviceName);
      
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
      
      console.log('📖 [読み出し] デバイス情報:', {
        name: currentDevice.name,
        model: currentDevice.model,
        ipaddr: currentDevice.ipaddr,
        port: currentDevice.port
      });
      
      // 読み出し前の設定状態を記録（最新の値を取得）
      const currentDeviceSettings = deviceSettingsRef.current;
      const deviceKey = `${currentDevice.ipaddr}:${currentDevice.port}`;
      const beforeTimestamp = currentDeviceSettings?.[deviceKey]?.timestamp || 0;
      
      console.log('📖 [読み出し] 読み出し前のタイムスタンプ:', beforeTimestamp);
      
      // バックエンドから設定データを取得（IPアドレスとポートで識別）
      const getSettingsRequest = {
        request_type: 'GetDeviceSettings',
        ipaddr: currentDevice.ipaddr,
        port: currentDevice.port
      };

      console.log('📖 [読み出し] リクエスト送信:', getSettingsRequest);
      await sendMessage(JSON.stringify(getSettingsRequest));

      // レスポンスを待つ（最大8秒）
      let attempts = 0;
      const maxAttempts = 30; // 15秒間（500ms × 30回）
      let checkTimeoutId: NodeJS.Timeout | null = null;
      
      const checkResponse = () => {
        attempts++;
        console.log(`📖 [読み出し] レスポンス確認 (試行 ${attempts}/${maxAttempts})`);
        
        // 最新のdeviceSettingsを取得（IPアドレス:ポートのキーで検索）
        const currentDeviceSettings = deviceSettingsRef.current;
        const afterReadSettings = currentDeviceSettings?.[deviceKey];
        const afterTimestamp = afterReadSettings?.timestamp || 0;
        
        // データが取得されているかチェック
        if (afterReadSettings?.temp_settings) {
          // タイムスタンプが更新されているかチェック
          const isTimestampUpdated = afterTimestamp > beforeTimestamp;
          
          console.log('📖 [読み出し] レスポンス受信:', {
            beforeTimestamp,
            afterTimestamp,
            isTimestampUpdated,
            hasData: !!afterReadSettings.temp_settings
          });
          
          // モデル情報を取得
          const deviceModel = afterReadSettings.device_info?.model;
          
          if (isTimestampUpdated) {
            // タイムアウトをキャンセル
            if (checkTimeoutId) {
              clearTimeout(checkTimeoutId);
            }
            
            console.log('📖 [読み出し] データサンプル:', {
              warning_temperatures: Object.keys(afterReadSettings.temp_settings.warning_temperatures || {}).slice(0, 3).reduce((obj: any, key) => {
                obj[key] = afterReadSettings.temp_settings.warning_temperatures[key];
                return obj;
              }, {}),
              totalChannels: Object.keys(afterReadSettings.temp_settings.warning_temperatures || {}).length
            });
            
            // ⚠️ 重要: config同期を先に実行してからテーブル更新
            // （config更新による再レンダリングの影響を避けるため）
            
            // T24C10B10Aの場合、temp-namesに基づいてconfig全体を同期
            if (deviceModel === "T24C10B10A" && afterReadSettings.temp_names) {
              syncConfigWithTempNames(afterReadSettings);
            }
            
            // T24R8Aの場合、temp-namesに基づいてconfig全体を同期
            if (deviceModel === "T24R8A" && afterReadSettings.temp_names) {
              console.log('📖 [読み出し] T24R8A config同期実行');
              syncConfigWithTempNamesForT24R8A(afterReadSettings);
            }
            
            // T28C16R8I1の場合、temp-namesに基づいてconfig全体を同期
            if (deviceModel === "T28C16R8I1" && afterReadSettings.temp_names) {
              console.log('📖 [読み出し] T28C16R8I1 config同期実行');
              syncConfigWithTempNamesForT28C16R8I1(afterReadSettings);
            }
            
            // T64C30B30I1の場合、temp-namesに基づいてconfig全体を同期
            if (deviceModel === "T64C30B30I1" && afterReadSettings.temp_names) {
              console.log('📖 [読み出し] T64C30B30I1 config同期実行');
              syncConfigWithTempNamesForT64C30B30I1(afterReadSettings);
            }
            
            // T44C20B20の場合、temp-namesに基づいてconfig全体を同期
            if (deviceModel === "T44C20B20" && afterReadSettings.temp_names) {
              console.log('📖 [読み出し] T64C30B30I1 config同期実行');
              syncConfigWithTempNamesForT44C20B20(afterReadSettings);
            }
            
            // config同期後、少し待ってからテーブルを更新（config更新による再レンダリング後）
            setTimeout(() => {
              updateMainTableWithBackendData(afterReadSettings);
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
          console.log('📖 [読み出し] ❌ タイムアウト');
          setIsLoading(false);
          // 親コンポーネントにタイムアウトを通知
          const resultEvent = new CustomEvent('deviceDataReadResult', {
            detail: { success: false, timeout: true }
          });
          window.dispatchEvent(resultEvent);
          return;
        }
        
        // 再試行
        checkTimeoutId = setTimeout(checkResponse, 500);
      };
      
      // 1秒後にチェック開始（バックエンド処理に余裕を持たせる）
      checkTimeoutId = setTimeout(checkResponse, 1000);

    } catch (error) {
      console.error('❌ バックエンド設定データ読み出しエラー:', error);
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
      console.log('✏️ [変更] =========== 開始 ===========');
      console.log('✏️ [変更] デバイス名:', selectedDeviceName);
      
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

      console.log('✏️ [変更] デバイス情報:', {
        name: currentDevice.name,
        model: currentDevice.model,
        ipaddr: currentDevice.ipaddr,
        port: currentDevice.port
      });

      // T24C10B10A, T28C16R8I1, T64C30B30I1の場合、windowオブジェクトから最新のテーブルデータを取得
      // T44C20B20を追加 - kotani (2026/03/24)
      let currentTempTableData = tempTableData;
      if ((currentDevice.model === "T24C10B10A" || currentDevice.model === "T28C16R8I1" || currentDevice.model === "T64C30B30I1" || currentDevice.model === "T44C20B20") && (window as any).tempTableDataForWrite) {
        currentTempTableData = (window as any).tempTableDataForWrite;
      }

      // 現在表示中のテーブルデータをバックエンド用の設定形式に変換
      const tempSettings: { [key: string]: { [channel: number]: number } } = {
        warning_temperatures: {},
        warning_times: {},
        alarm_temperatures: {},
        alarm_times: {},
        immediate_thresholds: {}
      };

      // tempTableDataから設定値を抽出
      console.log('✏️ [変更] テーブルデータ:', currentTempTableData.length, '行');
      currentTempTableData.forEach((row, index) => {
        const channel = row["sensor-No"];
        
        // sensor-Noが0または未定義の場合、indexベースで設定
        const validChannel = (channel && channel > 0) ? channel : index + 1;
        
        const cautionTemp = row['caution-temp'] !== undefined && row['caution-temp'] !== '' ? parseFloat(row['caution-temp'].toString()) : 85.0;
        tempSettings.warning_temperatures[validChannel] = cautionTemp;
        
        const cautionTime = row['caution-time'] !== undefined && row['caution-time'] !== '' ? Math.round(parseFloat(row['caution-time'].toString())) : 600;
        tempSettings.warning_times[validChannel] = cautionTime;
        
        const cutoffTemp = row['cutoff-temp'] !== undefined && row['cutoff-temp'] !== '' ? parseFloat(row['cutoff-temp'].toString()) : 90.0;
        tempSettings.alarm_temperatures[validChannel] = cutoffTemp;
        
        const cutoffTime = row['cutoff-time'] !== undefined && row['cutoff-time'] !== '' ? Math.round(parseFloat(row['cutoff-time'].toString())) : 180;
        tempSettings.alarm_times[validChannel] = cutoffTime;
        
        if (getModelCapabilities(currentDevice.model).supportsImmediateCutoff) {
          const immCutoffTemp = row['imm-cutoff-temp'] !== undefined && row['imm-cutoff-temp'] !== '' ? parseFloat(row['imm-cutoff-temp'].toString()) : 100.0;
          tempSettings.immediate_thresholds[validChannel] = immCutoffTemp;
        }
      });

      // T24R8Aの場合、過電流・漏洩電流設定も含める
      let updateSettingsRequest: any = {
        request_type: 'UpdateDeviceSettings',
        ipaddr: currentDevice.ipaddr,
        port: currentDevice.port,
        temp_settings: tempSettings
      };

      // T44C20B20を追加 - kotani (2026/03/24)
      if (currentDevice.model === "T24R8A" || currentDevice.model === "T28C16R8I1" || currentDevice.model === "T64C30B30I1" || currentDevice.model === "T44C20B20") {
        // 過電流設定
        if ((window as any).currTableDataForWrite && (window as any).currTableDataForWrite.length > 0) {
          const currSettings: { [key: string]: { [channel: number]: number | string } } = {
            relay: {},
            warning_current: {},
            warning_delays: {},
            alarm_current: {},
            alarm_delays: {}
          };
          
          (window as any).currTableDataForWrite.forEach((row: any, index: number) => {
            const channel = row["sensor-No"];
            const relay = row["relay"] || '0';
            const cautionCurr = parseFloat(row["caution-curr"] || '0');
            const cautionTime = Math.round(parseFloat(row["caution-time"] || '0') * 60);
            const cutoffCurr = parseFloat(row["cutoff-curr"] || '0');
            const cutoffTime = Math.round(parseFloat(row["cutoff-time"] || '0') * 60);
            
            currSettings.relay[channel] = relay;
            currSettings.warning_current[channel] = cautionCurr;
            currSettings.warning_delays[channel] = cautionTime;
            currSettings.alarm_current[channel] = cutoffCurr;
            currSettings.alarm_delays[channel] = cutoffTime;
          });
          
          updateSettingsRequest.curr_settings = currSettings;
        }
        
        // トラッキング設定（T28C16R8I1/T64C30B30I1）
        if ((currentDevice.model === "T28C16R8I1" || currentDevice.model === "T64C30B30I1") && (window as any).trackTableDataForWrite && (window as any).trackTableDataForWrite.length > 0) {
          const trackSettings: { [key: string]: { [channel: number]: number | string } } = {
            relay: {},
            warning_current: {},
            warning_count: {},
            alarm_current: {},
            alarm_count: {}
          };
          
          (window as any).trackTableDataForWrite.forEach((row: any, index: number) => {
            const channel = row["sensor-No"];
            const relay = row["relay"] || '0';
            const cautionCurr = parseFloat(row["caution-curr"] || '0');
            const cautionCount = Math.round(parseFloat(row["caution-count"] || '1'));
            const cutoffCurr = parseFloat(row["cutoff-curr"] || '0');
            const cutoffCount = Math.round(parseFloat(row["cutoff-count"] || '1'));
            
            trackSettings.relay[channel] = relay;
            trackSettings.warning_current[channel] = cautionCurr;
            trackSettings.warning_count[channel] = cautionCount;
            trackSettings.alarm_current[channel] = cutoffCurr;
            trackSettings.alarm_count[channel] = cutoffCount;
          });
          
          updateSettingsRequest.track_settings = trackSettings;
        }
        
        // 漏洩電流設定
        if ((window as any).leakTableDataForWrite && (window as any).leakTableDataForWrite.length > 0) {
          const leakSettings: { [key: string]: { [channel: number]: number | string } } = {
            relay: {},
            warning_current: {},
            warning_delays: {},
            alarm_current: {},
            alarm_delays: {}
          };
          
          (window as any).leakTableDataForWrite.forEach((row: any, index: number) => {
            const channel = row["sensor-No"];
            const relay = row["relay"] || '0';
            const cautionCurr = parseFloat(row["caution-curr"] || '0');
            const cautionTime = Math.round(parseFloat(row["caution-time"] || '0'));
            const cutoffCurr = parseFloat(row["cutoff-curr"] || '0');
            const cutoffTime = Math.round(parseFloat(row["cutoff-time"] || '0'));
            
            leakSettings.relay[channel] = relay;
            leakSettings.warning_current[channel] = cautionCurr;
            leakSettings.warning_delays[channel] = cautionTime;
            leakSettings.alarm_current[channel] = cutoffCurr;
            leakSettings.alarm_delays[channel] = cutoffTime;
          });
          
          updateSettingsRequest.leak_settings = leakSettings;
        }
      }
      
      console.log('✏️ [変更] 送信データサンプル:', {
        temp_settings_channels: Object.keys(updateSettingsRequest.temp_settings.warning_temperatures || {}).length,
        temp_sample: Object.keys(updateSettingsRequest.temp_settings.warning_temperatures || {}).slice(0, 3).reduce((obj: any, key) => {
          obj[key] = updateSettingsRequest.temp_settings.warning_temperatures[key];
          return obj;
        }, {}),
        has_curr_settings: !!updateSettingsRequest.curr_settings,
        has_track_settings: !!updateSettingsRequest.track_settings,
        has_leak_settings: !!updateSettingsRequest.leak_settings
      });
      
      // 詳細ログ: warning_temperatures全体（最初の10チャンネル）
      const detailedSample = Object.keys(updateSettingsRequest.temp_settings.warning_temperatures || {})
        .slice(0, 10)
        .map(key => `ch${key}=${updateSettingsRequest.temp_settings.warning_temperatures[key]}`)
        .join(', ');
      console.log('✏️ [変更] warning_temperatures詳細（最初の10ch）:', detailedSample);
      
      await sendMessage(JSON.stringify(updateSettingsRequest));
      
      console.log('✏️ [変更] =========== 完了 ===========');
      setIsLoading(false);

    } catch (error) {
      console.error('✏️ [変更] ❌ エラー:', error);
      setIsLoading(false);
      alert('エラー: バックエンドへの設定データ変更に失敗しました。\n\nバックエンドサーバーが起動しているか確認してください。');
    }
  };

  // 現在の測定値と設定値を表示する機能
  const getCurrentValues = () => {
    if (!selectedDeviceName) return [];
    
    // バックエンドから設定データを取得
    const backendSettings = deviceSettings?.[selectedDeviceName];
    
    // 実際の装置データを取得（WebSocketから）
    const deviceData = desconData[selectedDeviceName];
    const temperatureData = deviceData?.temperature || [];
    
    // バックエンドの現在温度データも確認
    const backendCurrentTemps = backendSettings?.current_temperatures || {};
    
    // 温度チャンネル名を取得（バックエンド設定 > YAML設定の順）
    const tempNames = backendSettings?.temp_names || deviceDetail["temp-names"] || [];
    
    return Array.from({ length: Math.max(tempNames.length, 8) }, (_, i) => {
      // 現在温度の取得（WebSocketデータ > バックエンドデータの順）
      let currentTemp = -999;
      const tempValue = temperatureData[i];
      if (typeof tempValue === 'number') {
        currentTemp = tempValue;
      } else if (backendCurrentTemps[i + 1] !== undefined) {
        currentTemp = backendCurrentTemps[i + 1];
      }
      
      const isConnected = currentTemp > -50; // -50℃以下は未接続とみなす
      
      // 設定値の取得（バックエンド設定 > YAML設定の順）
      let warningThreshold = "0.0";
      let alarmThreshold = "0.0";
      
      if (backendSettings?.temp_settings?.warning_thresholds?.[i + 1] !== undefined) {
        warningThreshold = backendSettings.temp_settings.warning_thresholds[i + 1].toString();
      } else if (tempTableData[i]?.["caution-temp"]) {
        warningThreshold = tempTableData[i]["caution-temp"];
      }
      
      if (backendSettings?.temp_settings?.alarm_thresholds?.[i + 1] !== undefined) {
        alarmThreshold = backendSettings.temp_settings.alarm_thresholds[i + 1].toString();
      } else if (tempTableData[i]?.["cutoff-temp"]) {
        alarmThreshold = tempTableData[i]["cutoff-temp"];
      }
      
      return {
        channel: i + 1,
        name: tempNames[i] || `CH${i + 1}`,
        currentTemp: isConnected ? currentTemp : 0,
        warningThreshold: warningThreshold,
        alarmThreshold: alarmThreshold,
        isConnected: isConnected,
        isFromBackend: !!backendSettings // バックエンドデータかどうかのフラグ
      };
    });
  };


  return (
    <div className="w-full">
      {/* ボタンエリア */}
      <div className="grid grid-cols-4 items-center space-x-1 mb-4 mt-6">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>

      {/* 装置情報表示は親コンポーネントに移動済み */}

      {/* テーブルタイトル */}
      <div className="m-4 ml-12 mb-2">
        <h2 className="text-lg font-bold">ジュール熱詳細設定</h2>
      </div>


    <Table className="m-4 text-sm ml-12 w-11/12">
        <TableCaption className="text-lg font-bold mb-2 caption-top sr-only">ジュール熱詳細設定テーブル</TableCaption>
      <TableHeader className="bg-yellow-300">
        <TableRow>
        <TableHead className="font-bold border border-black px-2 py-1 text-center">リモート装置種別:</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">
              {getModelCapabilities(deviceDetail.model).displayName}
          </TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">単相100V:1</TableHead>
          {deviceDetail.model !== "T8R0A" && deviceDetail.model !== "T24R8A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center">ブレーカー</TableHead>
          )}
          {deviceDetail.model !== "T8R0A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center">電線種別</TableHead>
          )}
          {deviceDetail.model !== "T8R0A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center">最高許容温度</TableHead>
          )}
          {deviceDetail.model !== "T8R0A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center"></TableHead>
          )}
          <TableHead className="font-bold border border-black px-2 py-1 text-center" colSpan={2}>①注意温度　アラート</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center" colSpan={2}>②遮断温度　自動遮断</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">③即遮断温度</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">IPアドレス:</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">{deviceDetail.ipaddr}</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">単相200V:2</TableHead>
          {deviceDetail.model !== "T8R0A" && deviceDetail.model !== "T24R8A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center">電流値</TableHead>
          )}
          {deviceDetail.model !== "T8R0A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center"></TableHead>
          )}
          {deviceDetail.model !== "T8R0A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center"></TableHead>
          )}
          {deviceDetail.model !== "T8R0A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center"></TableHead>
          )}
          <TableHead className="font-bold border border-black px-2 py-1 text-center">温度</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">判定時間</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">温度</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">判定時間</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">温度</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">センサー</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center"></TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">三相100V:3</TableHead>
          {deviceDetail.model !== "T8R0A" && deviceDetail.model !== "T24R8A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center">[A]</TableHead>
          )}
          {deviceDetail.model !== "T8R0A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center"></TableHead>
          )}
          {deviceDetail.model !== "T8R0A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center">[℃]</TableHead>
          )}
          {deviceDetail.model !== "T8R0A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center"></TableHead>
          )}
          <TableHead className="font-bold border border-black px-2 py-1 text-center">[℃]</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">[秒]</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">[℃]</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">[秒]</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">[℃]</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">No.</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">回路名</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">電源種別</TableHead>
          {deviceDetail.model !== "T8R0A" && deviceDetail.model !== "T24R8A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center">0〜99999</TableHead>
          )}
          {deviceDetail.model !== "T8R0A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center">8文字</TableHead>
          )}
          {deviceDetail.model !== "T8R0A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center">0〜999</TableHead>
          )}
          {deviceDetail.model !== "T8R0A" && (
            <TableHead className="font-bold border border-black px-2 py-1 text-center">相</TableHead>
          )}
          <TableHead className="font-bold border border-black px-2 py-1 text-center">0.0〜999.9</TableHead>  
          <TableHead className="font-bold border border-black px-2 py-1 text-center">0〜99999</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">0.0〜9999.9</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">0〜99999</TableHead>
          <TableHead className="font-bold border border-black px-2 py-1 text-center">0.0〜9999.9</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {tempTableData.map((row, index) => {
          /* --- モデル別の結合判定とグループ化の設定 --- */
          let span = 1;
          let maxPoints = Infinity;
          
          // モデルごとの設定
          if (deviceDetail.model === "T28C16R8I1") {
            maxPoints = 24; // 24点まで
            span = row["sensor-No"] <= maxPoints ? 3 : 1; // maxPoints以下なら3点グループ、超えたら1点
          } else if (deviceDetail.model === "T64C30B30I1") {
            maxPoints = 60; // 60点まで
            span = row["sensor-No"] <= maxPoints ? 2 : 1; // maxPoints以下なら2点グループ、超えたら1点
          } else if (deviceDetail.model === "T24C10B10A") {
            maxPoints = 20; // 20点まで
            span = row["sensor-No"] <= maxPoints ? 2 : 1; // maxPoints以下なら2点グループ、超えたら1点
          } else if (deviceDetail.model === "T16I4C4R4A") {
            maxPoints = 12; // 12点まで
            span = row["sensor-No"] <= maxPoints ? 3 : 1; // maxPoints以下なら3点グループ、超えたら1点
          } else if (deviceDetail.model === "T24R8A") {
            maxPoints = 24; // 24点まで
            span = row["sensor-No"] <= maxPoints ? 3 : 1; // maxPoints以下なら3点グループ、超えたら1点
          // T44C20B20を追加 - kotani (2026/03/24)
          } else if (deviceDetail.model === "T44C20B20") {
            maxPoints = 40; // 40点まで
            span = row["sensor-No"] <= maxPoints ? 2 : 1; // maxPoints以下なら2点グループ、超えたら1点
          }
          
          const isGroupModel = span > 1;

          // グループ化するかどうかを判断（maxPointsを超えたらグループ化しない）
          const inGroup = isGroupModel && row["sensor-No"] <= maxPoints;
          
          // グループの先頭行かどうか（グループ内の最初の要素、またはグループ化しない場合は常にtrue）
          const showCircuitCell = !inGroup || index % span === 0;
          
          return (
            <TableRow key={row["sensor-No"]}>
              <TableCell className="border border-black px-2 py-1 text-center">{row["sensor-No"]}</TableCell>
              {showCircuitCell && (
                <TableCell rowSpan={span} className="border border-black px-2 py-1 text-center">
                  <input
                    type="text"
                    value={row["circuit-name"]}
                    onChange={(e) => handleInputChange(row["sensor-No"]-1, "circuit-name", e.target.value)}
                    readOnly={!isEditable}
                    className={`w-full text-center ${isEditable ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                    placeholder="回路名を入力"
                  />
                </TableCell>
              )}
              {showCircuitCell && (
                <TableCell rowSpan={span} className="border border-black px-2 py-1 text-center">
                  <input
                    type="text"
                    value={row.power}
                    onChange={(e) => handleInputChange(row["sensor-No"]-1, "power", e.target.value)}
                    readOnly={!isEditable}
                    className={`w-full text-center ${isEditable ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                    placeholder="電源種別を入力"
                  />
                </TableCell>
              )}
              {showCircuitCell && deviceDetail.model !== "T8R0A" && deviceDetail.model !== "T24R8A" && (
                <TableCell rowSpan={span} className="border border-black px-2 py-1 text-center">{row.breaker}</TableCell>
              )}
              {showCircuitCell && deviceDetail.model !== "T8R0A" && (
                <TableCell rowSpan={span} className="border border-black px-2 py-1 text-center">
                  <input
                    type="text"
                    value={row.wire}
                    onChange={(e) => handleInputChange(row["sensor-No"]-1, "wire", e.target.value)}
                    readOnly={!isEditable}
                    className={`w-full text-center ${isEditable ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                    placeholder="電線種別を入力"
                  />
                </TableCell>
              )}
              {showCircuitCell && deviceDetail.model !== "T8R0A" && (
                <TableCell rowSpan={span} className="border border-black px-2 py-1 text-center">
                    <input
                      type="number"
                      value={row["allowable-temp"]}
                      readOnly={!isEditable}
                      onChange={(e) => handleInputChange(row["sensor-No"]-1, "allowable-temp", e.target.value)}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          handleInputChange(row["sensor-No"] - 1, "allowable-temp", '60');
                        } else {
                          const intValue = Math.round(parseFloat(value));
                          if (!isNaN(intValue) && intValue >= 0 && intValue <= 999) {
                            handleInputChange(row["sensor-No"] - 1, "allowable-temp", intValue.toString());
                          } else {
                            handleInputChange(row["sensor-No"] - 1, "allowable-temp", '60');
                          }
                        }
                      }}
                      min="0"
                    max="9999"
                      className={`w-full text-center ${isEditable ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                    />
                </TableCell>
              )}
              {deviceDetail.model !== "T8R0A" && (
                <TableCell className="border border-black px-2 py-1 text-center">{row["phase"]}</TableCell>
              )}
              <TableCell className="border border-black px-2 py-1 text-center">
                <input
                  type="number"
                  value={row["caution-temp"] }
                  readOnly={!isEditable}
                  onChange={(e) => handleInputChange(row["sensor-No"]-1, "caution-temp", e.target.value)}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      handleInputChange(row["sensor-No"] - 1, "caution-temp", '0.0');
                    } else {
                      const floatValue = parseFloat(value);
                      if (!isNaN(floatValue) && floatValue >= 0.0 && floatValue <= 999.9) {
                        const formattedValue = floatValue.toFixed(1);
                        handleInputChange(row["sensor-No"] - 1, "caution-temp", formattedValue);
                      } else {
                        handleInputChange(row["sensor-No"] - 1, "caution-temp", '0.0');
                      }
                    }
                  }}
                  min="0.0"
                  max="9999.9"
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
                      if (!isNaN(intValue) && intValue >= 0 && intValue <= 99999) {
                        handleInputChange(row["sensor-No"] - 1, "caution-time", intValue.toString());
                      } else {
                        handleInputChange(row["sensor-No"] - 1, "caution-time", '0');
                      }
                    }
                  }}
                  min="0"
                  max="99999"
                  className={`w-full text-center ${isEditable ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                />
              </TableCell>
              <TableCell className="border border-black px-2 py-1 text-center">
                <input
                  type="number"
                  value={row["cutoff-temp"]}
                  readOnly={!isEditable}
                  onChange={(e) => handleInputChange(row["sensor-No"]-1, "cutoff-temp", e.target.value)}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      handleInputChange(row["sensor-No"] - 1, "cutoff-temp", '0.0');
                    } else {
                      const floatValue = parseFloat(value);
                      if (!isNaN(floatValue) && floatValue >= 0.0 && floatValue <= 999.9) {
                        const formattedValue = floatValue.toFixed(1);
                        handleInputChange(row["sensor-No"] - 1, "cutoff-temp", formattedValue);
                      } else {
                        handleInputChange(row["sensor-No"] - 1, "cutoff-temp", '0.0');
                      }
                    }
                  }}
                  min="0.0"
                  max="9999.9"
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
                      if (!isNaN(intValue) && intValue >= 0 && intValue <= 99999) {
                        handleInputChange(row["sensor-No"] - 1, "cutoff-time", intValue.toString());
                      } else {
                        handleInputChange(row["sensor-No"] - 1, "cutoff-time", '0');
                      }
                    }
                  }}
                  min="0"
                  max="99999"
                  className={`w-full text-center ${isEditable ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                />
              </TableCell>
              <TableCell className="border border-black px-2 py-1 text-center">
                {!getModelCapabilities(deviceDetail.model).supportsImmediateCutoff ? (
                  // 即遮断温度をサポートしないモデルでは空欄表示
                  <div className="text-gray-400">—</div>
                ) : (
                <input
                  type="number"
                  value={row["imm-cutoff-temp"]}
                  readOnly={!isEditable}
                  onChange={(e) => handleInputChange(row["sensor-No"]-1, "imm-cutoff-temp", e.target.value)}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      handleInputChange(row["sensor-No"] - 1, "imm-cutoff-temp", '0.0');
                    } else {
                      const floatValue = parseFloat(value);
                      if (!isNaN(floatValue) && floatValue >= 0.0 && floatValue <= 999.9) {
                        const formattedValue = floatValue.toFixed(1);
                        handleInputChange(row["sensor-No"] - 1, "imm-cutoff-temp", formattedValue);
                      } else {
                        handleInputChange(row["sensor-No"] - 1, "imm-cutoff-temp", '0.0');
                      }
                    }
                  }}
                  min="0.0"
                    max="9999.9"
                  className={`w-full text-center ${isEditable ? 'border-2 border-blue-500 bg-blue-100' : ''}`}
                />
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </div>
  );
}
  
  

