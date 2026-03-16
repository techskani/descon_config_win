import React, { useContext, useEffect, useState, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useParams, useRouter } from "next/navigation";
import { DataContext } from "@/contexts/Datacontext";
import { TempDetailSettings } from "./TempDetailSetting";
import { TrackDetailSettings } from "./TrackDetailSettings";
import { OverCurrDetailSettings } from "./OverCurrDetailSetting";
import { LeakCurrDetailSettings } from "./LeakCurrDetailSetting";
import {
  TableRowLeakCurr,
  TableRowOverCurr,
  TableRowTemp,
  TableRowTrack,
  YamlConfig,
  YamlDeviceConfig,
} from "@/app/types";
import { RelayDetailSetting } from "./Relays";
import { useWebSocket } from "@/contexts/WebSocketContext";

export default function SelectDeviceDetail() {
  const { deviceName: encodedDeviceName } = useParams<{ deviceName: string }>();
  const {
    configData,
    editedConfigData,
    setConfigData,
    setEditedConfigData,
    tempTableData,
    settempTableData,
    trackTableData,
    settrackTableData,
    currTableData,
    setcurrTableData,
    leakTableData,
    setleakTableData,
    relayTableData,
    setrelayTableData,
  } = useContext(DataContext);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const router = useRouter();
  const [isEditable, setIsEditable] = useState(false);
  const [readResultsRef] = useState<{ current: { success: number, total: number, timeout: number } }>({ 
    current: { success: 0, total: 0, timeout: 0 } 
  });

  useEffect(() => {
    const decodedDeviceName = decodeURIComponent(encodedDeviceName);
    if (decodedDeviceName) {
      setSelectedDevice(decodedDeviceName);
    }
    console.log(selectedDevice);
  }, [encodedDeviceName]);

  // 子コンポーネントからの読み出し結果を集約
  useEffect(() => {
    const handleReadResult = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { success, timeout } = customEvent.detail;
      
      if (success) {
        readResultsRef.current.success++;
      }
      if (timeout) {
        readResultsRef.current.timeout++;
      }
      
      const completed = readResultsRef.current.success + readResultsRef.current.timeout;
      
      // すべての子コンポーネントから結果を受信したら、1回だけアラートを表示
      if (completed === readResultsRef.current.total && readResultsRef.current.total > 0) {
        if (readResultsRef.current.success > 0) {
          alert('✅ 設定データを読み出しました');
        } else {
          alert('❌ 設定データの読み出しに失敗しました');
        }
        // 結果をリセット
        readResultsRef.current = { success: 0, total: 0, timeout: 0 };
      }
    };
    
    window.addEventListener('deviceDataReadResult', handleReadResult);
    return () => {
      window.removeEventListener('deviceDataReadResult', handleReadResult);
    };
  }, []);

  const handleDeviceChange = (deviceName: string) => {
    if (deviceName) {
      setSelectedDevice(deviceName);
      router.push(`/detailSetting/${encodeURIComponent(deviceName)}`);
    }
  };

  const handleEdit = () => {
    setIsEditable(true);
  };

  const handleReadDeviceData = () => {
    const deviceName = selectedDevice || decodeURIComponent(encodedDeviceName);
    console.log('📖 読み出しボタン押下:', deviceName);
    
    // モデルに応じた子コンポーネント数を設定
    const device = editedConfigData.devices.find(d => d.name === deviceName);
    if (device) {
      const model = device.model;
      // モデルごとに有効なテーブル数を設定
      let tableCount = 2; // デフォルト: ブレーカー + ジュール熱
      
      if (model === 'T24C10B10A') {
        tableCount = 4; // ブレーカー + ジュール熱 + トラッキング + 過電流
      } else if (model === 'T24R8A' || model === 'T28C16R8I1' || model === 'T64C30B30I1') {
        tableCount = 5; // ブレーカー + ジュール熱 + トラッキング + 過電流 + 漏洩電流
      }
      
      readResultsRef.current = { success: 0, total: tableCount, timeout: 0 };
    }
    
    const event = new CustomEvent('deviceDataRead', {
      detail: { deviceName: deviceName }
    });
    window.dispatchEvent(event);
  };

  const handleSave = () => {
    setIsEditable(false);

    const trackkeyMap = ["relay", "caution-curr", "caution-count", "cutoff-curr", "cutoff-count"];
    const currkeyMap = ["relay", "caution-curr", "caution-time", "cutoff-curr", "cutoff-time"];
    const leakkeyMap = ["relay", "caution-curr", "caution-time", "cutoff-curr", "cutoff-time"];

    const newDevicesconfig: YamlDeviceConfig[] = editedConfigData.devices.map((device) => {
      if (device.name === selectedDevice) {
        // SetValue,200の存在確認
        const hasSetValue200 = device.temp.length > 0 && device.temp[0].includes('SetValue,200');
        
        // 温度設定のSetValueコード順とテーブル表示の対応を動的に設定
        let tempkeyMap: string[];
        if (hasSetValue200) {
          // SetValue,200がある場合（T24R8Aなど）:
          // temp[0]: SetValue,200 (channel mapping) - スキップ
          // temp[1]: SetValue,201 (sensor) - スキップ
          // temp[2]: SetValue,202 (caution-temp) 
          // temp[3]: SetValue,203 (caution-time)  
          // temp[4]: SetValue,204 (cutoff-temp)
          // temp[5]: SetValue,205 (cutoff-time)
          // temp[6]: SetValue,206 (imm-cutoff-temp)
          tempkeyMap = ["channel-mapping", "sensor", "caution-temp", "caution-time", "cutoff-temp", "cutoff-time", "imm-cutoff-temp"];
        } else {
          // SetValue,200がない場合（T8R0Aなど）:
          // temp[0]: SetValue,201 (sensor) - スキップ  
          // temp[1]: SetValue,202 (caution-temp)
          // temp[2]: SetValue,203 (caution-time)  
          // temp[3]: SetValue,204 (cutoff-temp)
          // temp[4]: SetValue,205 (cutoff-time)
          // temp[5]: SetValue,206 (imm-cutoff-temp)
          tempkeyMap = ["sensor", "caution-temp", "caution-time", "cutoff-temp", "cutoff-time", "imm-cutoff-temp"];
        }
        
        // 漏電ブレーカー感度電流値を更新
        const updatedBrkrSens = [...device["brkr-sens"]];
        relayTableData.forEach((row, index) => {
          const valueStr = parseFloat(row["brkr-sens-curr"]).toFixed(1);
          updatedBrkrSens[index] = isNaN(Number(valueStr)) ? 0 : Number(valueStr);
        });

        // 漏電ブレーカー遮断検知用ステータスを更新
        const updatedBrkr = device.brkr.map((brkrString, stringIndex) => {
          if (stringIndex === 0) { 
            const brkrParts = brkrString.split(",");
            const updatedBrkrParts = brkrParts.map((part, partIndex) => {
              if (partIndex >= 2 && partIndex - 2 < relayTableData.length) {
                const [key, _] = part.split("=");
                const value = relayTableData[partIndex - 2]["brkr-trip-status"];
                return `${key}=${value}`;
              }
              return part;
            });
            return updatedBrkrParts.join(",");
          }
          return brkrString;
        });
        
        const updatedTemp = device.temp.map((tempString, stringIndex) => {
          const tempkeyname = tempkeyMap[stringIndex];
          
          // SetValue,200 (channel mapping) または SetValue,201 (sensor) はスキップ
          if (tempkeyname === "channel-mapping" || tempkeyname === "sensor") {
            return tempString;
          }

          const tempParts = tempString.split(",");
          
          const updatedTempParts = tempParts.map((part, partIndex) => {
            if (partIndex >= 2 && tempkeyname) {
              const [key, oldValue] = part.split("=");
              const channelNo = parseInt(key);
              
              // tempTableDataからchannelNo番目の行を取得（0-indexedなので -1）
              const rowIndex = channelNo - 1;
              
              if (rowIndex >= 0 && rowIndex < tempTableData.length) {
                const matchingRow = tempTableData[rowIndex];
                const newValue = matchingRow[tempkeyname as keyof TableRowTemp];
                return `${key}=${newValue}`;
              }
            }
            return part;
          });
          return updatedTempParts.join(",");
        });

        const updatedTrack = device.track.map((trackString, stringIndex) => {
          let trackkeyname = trackkeyMap[stringIndex];
          const trackParts = trackString.split(",");
          const updatedTrackParts = trackParts.map((part, partIndex) => {
            if (partIndex >= 2) {
              const [key, _] = part.split("=");
              return `${key}=${trackTableData[partIndex - 2][trackkeyname as keyof TableRowTrack]}`;
            }
            return part;
          });
          return updatedTrackParts.join(",");
        });

        const updatedCurr = device.curr.map((currString, stringIndex) => {
          let currkeyname = currkeyMap[stringIndex];
          const currParts = currString.split(",");
          const updatedCurrParts = currParts.map((part, partIndex) => {
            if (partIndex >= 2) {
              const [key, _] = part.split("=");
              let value = currTableData[partIndex - 2][currkeyname as keyof TableRowOverCurr];
              // 時間の値を分から秒に変換
              if (currkeyname === "caution-time" || currkeyname === "cutoff-time") {
                value = (Number(value) * 60).toString();
              }
              return `${key}=${value}`;
            }
            return part;
          });
          return updatedCurrParts.join(",");
        });

        const updatedLeak = device.leak.map((leakString, stringIndex) => {
          const leakkeyname = leakkeyMap[stringIndex];
          const leakParts = leakString.split(",");
          const updatedLeakParts = leakParts.map((part, partIndex) => {
            if (partIndex >= 2 && leakkeyname) {
              const [key, _] = part.split("=");
              return `${key}=${
                leakTableData[partIndex - 2][leakkeyname as keyof TableRowLeakCurr]
              }`;
            }
            return part;
          });
          return updatedLeakParts.join(",");
        });

        // temp-names, curr-names, leak-names, brkr-names, track-namesの更新
        let updatedTempNames: string[];
        let updatedBrkrNames: string[];
        
        let updatedCurrNames: string[];
        let updatedLeakNames: string[];
        let updatedTrackNames: string[];
        
        if (device.model === "T24R8A") {
          // T24R8A: temp-names, curr-names, leak-namesは元のまま維持
          updatedTempNames = device["temp-names"];
          updatedCurrNames = device["curr-names"];
          updatedLeakNames = device["leak-names"];
          updatedTrackNames = [];
          // brkr-namesはrelayTableDataから（8要素）
          updatedBrkrNames = relayTableData.map((row) => row["circuit-name"]);
        } else if (device.model === "T28C16R8I1" || device.model === "T64C30B30I1") {
          // T28C16R8I1/T64C30B30I1: temp-names, track-names, curr-namesは元のまま維持
          updatedTempNames = device["temp-names"];
          updatedCurrNames = device["curr-names"];
          updatedTrackNames = device["track-names"];
          updatedLeakNames = leakTableData.map((row) => row["circuit-name"]);
          // brkr-namesはrelayTableDataから
          updatedBrkrNames = relayTableData.map((row) => row["circuit-name"]);
        } else {
          // その他のモデル: 各テーブルから取得
          updatedTempNames = tempTableData.map((row) => row["circuit-name"]);
          updatedBrkrNames = relayTableData.map((row) => row["circuit-name"]);
          updatedCurrNames = currTableData.map((row) => row["circuit-name"]);
          updatedLeakNames = leakTableData.map((row) => row["circuit-name"]);
          
          // track-namesの更新
          updatedTrackNames = [];
          if (trackTableData.length > 0 && trackTableData[0]["circuit-name"] !== "") {
            trackTableData.forEach((row) => {
              const circuitName = row["circuit-name"];
              updatedTrackNames.push(circuitName);

              // 特定のモデルの場合、同じ回路名をもう一度追加
              if (device.model === "T16I4C4R4A") {
                updatedTrackNames.push(circuitName);
              }
            });
          }
        }

        // circuitsの更新（tempTableData、relayTableData、leakTableData、currTableDataから）
        let updatedCircuits = device.circuits.map((circuit, index) => {
          // 各テーブルから回路情報を取得
          const tempRow = tempTableData.find(row => row["circuit-name"] === circuit.name);
          const relayRow = relayTableData.find(row => row["circuit-name"] === circuit.name);
          const leakRow = leakTableData.find(row => row["circuit-name"] === circuit.name);
          const currRow = currTableData.find(row => row["circuit-name"] === circuit.name);
          
          if (relayRow || tempRow) {
            return {
              ...circuit,
              name: relayRow?.["circuit-name"] || tempRow?.["circuit-name"] || circuit.name,
              power: tempRow?.power || relayRow?.power || circuit.power,
              breaker: tempRow?.breaker || leakRow?.breaker || currRow?.breaker || relayRow?.breaker || circuit.breaker,
              wire: tempRow?.wire || relayRow?.wire || circuit.wire,
              autotrip: relayRow ? relayRow["relay-auto-trip"] : circuit.autotrip
            };
          }
          
          return circuit;
        });
        
        // "盤内温度"の存在確認と追加
        const hasPanelTemp = updatedCircuits.some((circuit) => circuit.name === "盤内温度");
        
        if (!hasPanelTemp) {
          const panelTempRow = tempTableData.find((row) => row["circuit-name"] === "盤内温度");
          if (panelTempRow) {
            updatedCircuits.push({
              name: "盤内温度",
              power: "",
              breaker: "",
              wire: "",
              "allowable-temp": panelTempRow["allowable-temp"],
              autotrip: 0,
              output: 0,
            });
          }
        } else {
          // 既存の"盤内温度"のallowable-tempを更新
          updatedCircuits = updatedCircuits.map((circuit) => {
            if (circuit.name === "盤内温度") {
              const panelTempRow = tempTableData.find((row) => row["circuit-name"] === "盤内温度");
              return {
                ...circuit,
                "allowable-temp": panelTempRow
                  ? panelTempRow["allowable-temp"]
                  : circuit["allowable-temp"],
              };
            }
            return circuit;
          });
        }

        return {
          ...device,
          circuits: updatedCircuits,
          "brkr-names": updatedBrkrNames,
          "brkr-sens": updatedBrkrSens,
          brkr: updatedBrkr,
          "temp-names": updatedTempNames,
          temp: updatedTemp,
          "track-names": updatedTrackNames,
          track: updatedTrack,
          "curr-names": updatedCurrNames,
          curr: updatedCurr,
          "leak-names": updatedLeakNames,
          leak: updatedLeak,
        };
      }
      return device;
    });

    const newConfig: YamlConfig = {
      ...editedConfigData,
      devices: newDevicesconfig,
    };

    setEditedConfigData(newConfig); 
    // setConfigData(newConfig);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-4 items-center space-x-1 mb-4 mt-6">
        <label className="text-right mr-4 font-medium" htmlFor="device-name">
          デバイス名称
        </label>
        <div className="flex col-span-2 items-center space-x-2">
          <Select onValueChange={handleDeviceChange} value={selectedDevice}>
            <SelectTrigger className="flex col-span-3">
              <SelectValue placeholder="デバイス名">
                {selectedDevice || "デバイスを選択してください"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {editedConfigData.devices
                .filter((device) => device.name !== "")
                .map((device) => (
                  <SelectItem key={device.name} value={device.name}>
                    {device.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end space-x-2">
          <button
            className="
                      h-12 px-5 m-2 mr-2 w-28
                      text-sm
                      text-indigo-100
                      transition-colors duration-150
                      bg-blue-600
                      rounded-lg
                      focus:shadow-outline
                      hover:bg-blue-800
                    "
            onClick={handleEdit}
          >
            編集
          </button>
          <button
            className="
                      h-12 px-3 m-2 mr-2 w-32
                      text-xs
                      text-white
                      transition-colors duration-150
                      bg-blue-600
                      rounded-lg
                      focus:shadow-outline
                      hover:bg-blue-700
                      disabled:bg-gray-400 disabled:cursor-not-allowed
                      leading-tight
                    "
            onClick={handleReadDeviceData}
            disabled={!selectedDevice && !encodedDeviceName}
          >
            <div className="flex flex-col items-center">
              <span>設定データ</span>
              <span>読み出し</span>
            </div>
          </button>
          <button
            className="
                      h-12 px-3 m-2 mr-10 w-32
                      text-xs
                      text-white
                      transition-colors duration-150
                      bg-green-600
                      rounded-lg
                      focus:shadow-outline
                      hover:bg-green-700
                      disabled:bg-gray-400 disabled:cursor-not-allowed
                      leading-tight
                    "
            onClick={() => {
              // 設定データ変更処理を各テーブルコンポーネントに委譲
              const event = new CustomEvent('deviceDataWrite', { 
                detail: { deviceName: selectedDevice } 
              });
              window.dispatchEvent(event);
              
              // 短い遅延後に成功メッセージを表示（各コンポーネントの送信完了後）
              setTimeout(() => {
                alert('✅ 設定データを送信しました。');
              }, 500);
            }}
            disabled={!selectedDevice}
          >
            <div className="flex flex-col items-center">
              <span>設定データ</span>
              <span>変更</span>
            </div>
          </button>
        </div>
      </div>
      <div className="flex flex-col items-center space-y-4">
        {/* 装置情報（ブレーカー設定より上に表示） */}
        {selectedDevice && (() => {
          const device = editedConfigData.devices.find(d => d.name === selectedDevice);
          return (
            <div className="bg-gray-50 p-4 rounded-lg mb-2 m-4 ml-12 w-11/12">
              <h3 className="font-bold mb-2">装置情報</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">装置名:</span>
                  <div className="text-blue-600">{selectedDevice}</div>
                </div>
                <div>
                  <span className="font-medium">モデル:</span>
                  <div>{device?.model ?? ''}</div>
                </div>
                <div>
                  <span className="font-medium">IPアドレス:</span>
                  <div>{device?.ipaddr ?? ''}</div>
                </div>
                <div>
                  <span className="font-medium">ポート:</span>
                  <div>{device?.port ?? ''}</div>
                </div>
              </div>
            </div>
          );
        })()}
        {/* T8R0Aモデルの場合はRelayDetailSettingを表示しない */}
        {!(selectedDevice && 
           editedConfigData.devices.find(d => d.name === selectedDevice)?.model === "T8R0A") && (
          <RelayDetailSetting
            selectedDeviceName={selectedDevice}
            isEditable={isEditable}
            config={editedConfigData.devices}
            onEdit={handleEdit}
            seteditConfig={(devices: YamlDeviceConfig[]) => {
              const newState: YamlConfig = {
                ...editedConfigData,
                devices: devices,
              };
              setEditedConfigData(newState);
            }}
            relayTableData={relayTableData}
            setrelayTableData={setrelayTableData}
          />
        )}
        <TempDetailSettings
          selectedDeviceName={selectedDevice}
          isEditable={isEditable}
          config={editedConfigData.devices}
          onEdit={handleEdit}
          seteditConfig={(devices: YamlDeviceConfig[]) => {
            const newState: YamlConfig = {
              ...editedConfigData,
              devices: devices,
            };
            setEditedConfigData(newState);
          }}
          tempTableData={tempTableData}
          settempTableData={settempTableData}
        />
        {/* T24R8A、T8R0Aモデルの場合はTrackDetailSettingsを表示しない */}
        {!(selectedDevice && 
           editedConfigData.devices.find(d => d.name === selectedDevice)?.model === "T24R8A" ||
           editedConfigData.devices.find(d => d.name === selectedDevice)?.model === "T8R0A") && (
          <TrackDetailSettings
            selectedDeviceName={selectedDevice}
            isEditable={isEditable}
            config={editedConfigData.devices}
            onEdit={handleEdit}
            seteditConfig={(devices: YamlDeviceConfig[]) => {
              const newState: YamlConfig = {
                ...editedConfigData,
                devices: devices,
              };
              setEditedConfigData(newState);
            }}
            trackTableData={trackTableData}
            settrackTableData={settrackTableData}
          />
        )}
        {/* T8R0Aモデルの場合はOverCurrDetailSettingsを表示しない */}
        {!(selectedDevice && 
           editedConfigData.devices.find(d => d.name === selectedDevice)?.model === "T8R0A") && (
          <OverCurrDetailSettings
            selectedDeviceName={selectedDevice}
            isEditable={isEditable}
            config={editedConfigData.devices}
            onEdit={handleEdit}
            seteditConfig={(devices: YamlDeviceConfig[]) => {
              const newState: YamlConfig = {
                ...editedConfigData,
                devices: devices,
              };
              setEditedConfigData(newState);
            }}
            currTableData={currTableData}
            setcurrTableData={setcurrTableData}
          />
        )}
        {/* T8R0AモデルとT24C10B10Aモデルの場合はLeakCurrDetailSettingsを表示しない */}
        {!(selectedDevice && 
           (editedConfigData.devices.find(d => d.name === selectedDevice)?.model === "T8R0A" ||
            editedConfigData.devices.find(d => d.name === selectedDevice)?.model === "T24C10B10A")) && (
          <LeakCurrDetailSettings
            selectedDeviceName={selectedDevice}
            isEditable={isEditable}
            config={editedConfigData.devices}
            onEdit={handleEdit}
            seteditConfig={(devices: YamlDeviceConfig[]) => {
              const newState: YamlConfig = {
                ...editedConfigData,
                devices: devices,
              };
              setEditedConfigData(newState);
            }}
            leakTableData={leakTableData}
            setleakTableData={setleakTableData}
          />
        )}
      </div>
      <div className="flex justify-end m-10">
        <button
          className="h-12 w-28 px-5 m-2 text-lg text-indigo-100 transition-colors duration-150 bg-blue-600 rounded-lg focus:shadow-outline hover:bg-blue-800"
          onClick={handleSave}
        >
          保存
        </button>
      </div>
    </div>
  );
}
