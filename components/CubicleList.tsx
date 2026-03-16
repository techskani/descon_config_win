import React, { useContext, useState } from "react";
import { DataContext, DataContextType } from "@/contexts/Datacontext";
import { FileUploadCubicle } from "./FileUploadCubicle";
import { CubicleYamlConfig, InputFieldProps, YamlTransConfig } from "@/app/types";
import yaml from "js-yaml";
import { saveAs } from "file-saver";

export default function CubicleList() {
  const { cubicleConfigData, setCubicleConfigData, editedCubicleConfigData, setEditedCubicleConfigData } = useContext<DataContextType>(DataContext);
  const [isEditable, setIsEditable] = useState(false);
  const [expandedIndices, setExpandedIndices] = useState<{ [key: number]: boolean }>({});

  const handleEdit = () => {
    setIsEditable(true);
  };

  const handleSave = () => {
    setIsEditable(false);
    setCubicleConfigData(editedCubicleConfigData);
  };

  const initialConfig: CubicleYamlConfig = {
    site: "",
    "polling-interval": 0,
    "supervisor-ipaddr": "",
    "supervisor-port": 0,
    "mqtt-ipaddr": "",
    "mqtt-port": 0,
    trans: []
  };

  const handleReset = () => {
    // 確認ダイアログを表示
    const isConfirmed = confirm("本当にリセットしますか？現在の設定データが初期化されます。");

    if (isConfirmed) {
      // 初期設定を適用
      setEditedCubicleConfigData(initialConfig);
      setCubicleConfigData(initialConfig);

      // 編集可能状態をリセット
      setIsEditable(false);
    }
  };

  const handleInputChange = (id: string, value: string) => {
    let newValue: string | number;

    if (id === "polling-interval" || id === "mqtt-port" || id === "supervisor-port") {
      const parsedValue = parseInt(value, 10);
      if (isNaN(parsedValue)) {
        // 入力値が空の文字列の場合は、元の値を保持する
        newValue = 0;
      } else {
        // 数値に変換できる場合は、変換後の値を設定する
        newValue = parsedValue;
      }
    } else {
      newValue = value;
    }

    const newConfigData: CubicleYamlConfig = {
      ...editedCubicleConfigData,
      [id]: newValue,
    };

    setEditedCubicleConfigData(newConfigData);
  };

  const saveConfigToYaml = (configData: CubicleYamlConfig, filename: string) => {
    const yamlString = yaml.dump(configData);
    const blob = new Blob([yamlString], { type: "application/yaml" });
    saveAs(blob, filename);
  };

  const downloadYaml = () => {
    saveConfigToYaml(editedCubicleConfigData, "cubicle.yaml");
  };

  const handleOutputButtonClick = () => {
    downloadYaml();
  };

  const handleAddTrans = () => {
    // 新しいトランス設定を追加
    const newTrans: YamlTransConfig = {
      name: "新規トランス",
      "switch-boards": [],
      overload: [
        {
          state: "warn",
          curr: 0,
          time: 0
        },
        {
          state: "alarm",
          curr: 0,
          time: 0
        }
      ],
      alert: {
        "controller-ipaddr": "",
        device: "",
        "circuit-no": 0
      }
    };
    
    const updatedConfig = {
      ...editedCubicleConfigData,
      trans: [...editedCubicleConfigData.trans, newTrans]
    };
    
    setEditedCubicleConfigData(updatedConfig);
    
    // 新しく追加したトランスを展開状態にする
    setExpandedIndices((prevIndices) => ({
      ...prevIndices,
      [editedCubicleConfigData.trans.length]: true
    }));
  };

  const handleToggleExpand = (index: number) => {
    setExpandedIndices((prevIndices) => ({
      ...prevIndices,
      [index]: !prevIndices[index]
    }));
  };

  const handleRemoveTrans = (index: number) => {
    if (!isEditable) return;
    
    const isConfirmed = confirm(`${editedCubicleConfigData.trans[index].name}を削除してもよろしいですか？`);
    
    if (isConfirmed) {
      const updatedTrans = [...editedCubicleConfigData.trans];
      updatedTrans.splice(index, 1);
      
      setEditedCubicleConfigData({
        ...editedCubicleConfigData,
        trans: updatedTrans
      });
    }
  };

  const handleTransChange = (index: number, field: string, value: string | number) => {
    if (!isEditable) return;
    
    const updatedTrans = [...editedCubicleConfigData.trans];
    
    if (field === "name") {
      updatedTrans[index].name = value as string;
    } else if (field === "warn-curr") {
      const warnIndex = updatedTrans[index].overload.findIndex(item => item.state === "warn");
      if (warnIndex !== -1) {
        updatedTrans[index].overload[warnIndex].curr = Number(value);
      }
    } else if (field === "warn-time") {
      const warnIndex = updatedTrans[index].overload.findIndex(item => item.state === "warn");
      if (warnIndex !== -1) {
        updatedTrans[index].overload[warnIndex].time = Number(value);
      }
    } else if (field === "alarm-curr") {
      const alarmIndex = updatedTrans[index].overload.findIndex(item => item.state === "alarm");
      if (alarmIndex !== -1) {
        updatedTrans[index].overload[alarmIndex].curr = Number(value);
      }
    } else if (field === "alarm-time") {
      const alarmIndex = updatedTrans[index].overload.findIndex(item => item.state === "alarm");
      if (alarmIndex !== -1) {
        updatedTrans[index].overload[alarmIndex].time = Number(value);
      }
    } else if (field === "controller-ipaddr") {
      updatedTrans[index].alert["controller-ipaddr"] = value as string;
    } else if (field === "device") {
      updatedTrans[index].alert.device = value as string;
    } else if (field === "circuit-no") {
      updatedTrans[index].alert["circuit-no"] = Number(value);
    }
    
    setEditedCubicleConfigData({
      ...editedCubicleConfigData,
      trans: updatedTrans
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div className="w-64 mx-auto sm:mx-0 sm:w-auto">
            <FileUploadCubicle />
          </div>
          <div className="flex justify-end">
            <button
              className="py-2 px-4 m-2 text-white font-bold bg-blue-600 rounded hover:bg-blue-700"
              onClick={handleEdit}
            >
              編集
            </button>
            <button
              className="py-2 px-4 m-2 text-white font-bold bg-red-600 rounded hover:bg-red-700"
              onClick={handleReset}
            >
              リセット
            </button>
          </div>
        </div>
        
        {/* スーパバイザ用設定 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">スーパバイザ用設定</h2>
          <InputField
            label="サイト名"
            value={editedCubicleConfigData.site || ""}
            id="site"
            isEditable={isEditable}
            onChange={handleInputChange}
          />
          <InputField
            label="ポーリングインターバル"
            value={editedCubicleConfigData["polling-interval"] || 0}
            id="polling-interval"
            isEditable={isEditable}
            onChange={handleInputChange}
          />
          <InputField
            label="スーパバイザIPアドレス"
            value={editedCubicleConfigData["supervisor-ipaddr"] || ""}
            id="supervisor-ipaddr"
            isEditable={isEditable}
            onChange={handleInputChange}
          />
          <InputField
            label="スーパバイザポート番号"
            value={editedCubicleConfigData["supervisor-port"] || 0}
            id="supervisor-port"
            isEditable={isEditable}
            onChange={handleInputChange}
          />
          <InputField
            label="MQTT IPアドレス"
            value={editedCubicleConfigData["mqtt-ipaddr"] || ""}
            id="mqtt-ipaddr"
            isEditable={isEditable}
            onChange={handleInputChange}
          />
          <InputField
            label="MQTT ポート番号"
            value={editedCubicleConfigData["mqtt-port"] || 0}
            id="mqtt-port"
            isEditable={isEditable}
            onChange={handleInputChange}
          />
        </div>
        
        {/* トランス設定 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">トランス設定</h2>
            {isEditable && (
              <button
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                onClick={handleAddTrans}
              >
                トランスを追加
              </button>
            )}
          </div>
          
          {editedCubicleConfigData.trans && editedCubicleConfigData.trans.length > 0 ? (
            <div className="space-y-4">
              {editedCubicleConfigData.trans.map((trans, index) => (
                <div
                  key={index}
                  className="border rounded-md p-4 bg-white shadow-sm"
                >
                  <div className="flex justify-between items-center">
                    <div className="grid grid-cols-3 items-center space-x-1 w-full">
                      <label className="font-medium">トランス名称</label>
                      <div className="flex col-span-2 items-center space-x-2">
                        <input
                          className={`border rounded p-2 w-80 transition-colors duration-150 ${
                            isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                          }`}
                          value={trans.name}
                          onChange={(e) => handleTransChange(index, "name", e.target.value)}
                          readOnly={!isEditable}
                          type="text"
                          placeholder="トランス名称"
                        />
                        <button
                          className="flex justify-center items-center text-blue-500 focus:outline-none"
                          onClick={() => handleToggleExpand(index)}
                        >
                          {expandedIndices[index] ? "▲" : "▼"}
                        </button>
                        <button
                          className={`border rounded p-2 ${
                            trans.name ? "" : "bg-gray-200 text-gray-500"
                          }`}
                          disabled={!trans.name}
                          onClick={() => {
                            if (trans.name) {
                              window.location.href = `/transDetailSetting/${encodeURIComponent(trans.name)}`;
                            }
                          }}
                        >
                          <span className="hidden sm:inline">詳細設定</span>
                          <span className="sm:hidden font-bold">詳</span>
                        </button>
                        {isEditable && (
                          <button
                            className="flex justify-center items-center text-red-500 focus:outline-none"
                            onClick={() => handleRemoveTrans(index)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {expandedIndices[index] && (
                    <div className="mt-4 pl-4 border-l-2 border-gray-200">
                      <h3 className="font-medium mb-2">過負荷設定</h3>
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <label className="block text-sm mb-1">注意 電流値 (A)</label>
                          <input
                            className={`border rounded p-2 w-full transition-colors duration-150 ${
                              isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                            }`}
                            value={trans.overload.find(o => o.state === "warn")?.curr || 0}
                            onChange={(e) => handleTransChange(index, "warn-curr", e.target.value)}
                            readOnly={!isEditable}
                            type="number"
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">注意 時間 (秒)</label>
                          <input
                            className={`border rounded p-2 w-full transition-colors duration-150 ${
                              isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                            }`}
                            value={trans.overload.find(o => o.state === "warn")?.time || 0}
                            onChange={(e) => handleTransChange(index, "warn-time", e.target.value)}
                            readOnly={!isEditable}
                            type="number"
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">警報 電流値 (A)</label>
                          <input
                            className={`border rounded p-2 w-full transition-colors duration-150 ${
                              isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                            }`}
                            value={trans.overload.find(o => o.state === "alarm")?.curr || 0}
                            onChange={(e) => handleTransChange(index, "alarm-curr", e.target.value)}
                            readOnly={!isEditable}
                            type="number"
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">警報 時間 (秒)</label>
                          <input
                            className={`border rounded p-2 w-full transition-colors duration-150 ${
                              isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                            }`}
                            value={trans.overload.find(o => o.state === "alarm")?.time || 0}
                            onChange={(e) => handleTransChange(index, "alarm-time", e.target.value)}
                            readOnly={!isEditable}
                            type="number"
                          />
                        </div>
                      </div>
                      
                      <h3 className="font-medium mb-2">アラート設定</h3>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-sm mb-1">コントローラーIPアドレス</label>
                          <input
                            className={`border rounded p-2 w-full transition-colors duration-150 ${
                              isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                            }`}
                            value={trans.alert["controller-ipaddr"]}
                            onChange={(e) => handleTransChange(index, "controller-ipaddr", e.target.value)}
                            readOnly={!isEditable}
                            type="text"
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">デバイス名</label>
                          <input
                            className={`border rounded p-2 w-full transition-colors duration-150 ${
                              isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                            }`}
                            value={trans.alert.device}
                            onChange={(e) => handleTransChange(index, "device", e.target.value)}
                            readOnly={!isEditable}
                            type="text"
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">回路番号</label>
                          <input
                            className={`border rounded p-2 w-full transition-colors duration-150 ${
                              isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                            }`}
                            value={trans.alert["circuit-no"]}
                            onChange={(e) => handleTransChange(index, "circuit-no", e.target.value)}
                            readOnly={!isEditable}
                            type="number"
                          />
                        </div>
                      </div>
                      
                      <h3 className="font-medium mb-2">配電盤情報</h3>
                      <div className="bg-gray-50 p-2 rounded">
                        {trans["switch-boards"].length > 0 ? (
                          <ul className="divide-y divide-gray-200">
                            {trans["switch-boards"].map((board, boardIndex) => (
                              <li key={boardIndex} className="py-2">
                                <div className="flex justify-between">
                                  <span className="font-medium">{board.name}</span>
                                  <span className="text-gray-500 text-sm">IP: {board.ipaddr}</span>
                                </div>
                                <div className="text-gray-500 text-sm">
                                  監視回路: {board.curr.length}回路, 
                                  分電盤: {board.devices.length}台
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500 text-sm">配電盤がありません</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">トランス設定がありません</p>
          )}
        </div>
        
        <div className="flex justify-end">
          <button
            className="h-12 w-28 px-5 mt-6 text-lg text-indigo-100 transition-colors duration-150 bg-blue-600 rounded-lg focus:shadow-outline hover:bg-blue-800"
            onClick={handleSave}
          >
            保存
          </button>
        </div>
        <div className="flex justify-end">
          <button
            className="h-12 px-5 ml-4 text-lg text-indigo-100 transition-colors duration-150 bg-blue-700 rounded-lg focus:shadow-outline hover:bg-blue-800"
            onClick={handleOutputButtonClick}
          >
            YAMLファイルを出力
          </button>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, id, isEditable, onChange }: InputFieldProps) {
  return (
    <div className="grid grid-cols-3 items-center space-x-1 mb-2">
      <label className="font-medium" htmlFor={id}>
        {label}
      </label>
      <div className="flex col-span-2 items-center space-x-2">
        <input
          className={`border rounded p-2 w-80 transition-colors duration-150 ${
            isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
          }`}
          id={id}
          value={value}
          readOnly={!isEditable}
          onChange={(e) => onChange(id, e.target.value)}
          type="text"
        />
      </div>
    </div>
  );
} 