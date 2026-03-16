import React, { useContext, useState } from "react";
import PhoneSettings from "./PhoneSetting";
import DeviceSettings from "./DeviceSetting";
import {
  YamlConfig,
  InputFieldProps,
  YamlMailConfig,
  YamlPhoneConfig,
  YamlDeviceConfig,
} from "@/app/types";
import MailSettings from "./MailSetting";
import { DataContext, DataContextType } from "@/contexts/Datacontext";
import yaml from "js-yaml";
import { saveAs } from "file-saver";
import { FileUpload } from "./FileUpload";

export default function List() {
  const { editedConfigData, setConfigData, setEditedConfigData, filename } =
    useContext<DataContextType>(DataContext);
  const [isEditable, setIsEditable] = useState(false);

  const handleEdit = () => {
    setIsEditable(true);
  };

  const handleSave = () => {
    setIsEditable(false);
    setConfigData(editedConfigData);
  };

  const initialConfig: YamlConfig = {
    site: "",
    "polling-interval": 0,
    "supervisor-ipaddr": "",
    "supervisor-port": 0,
    "mqtt-ipaddr": "",
    "mqtt-port": 0,
    mails: [
      {
        "smtp-server": "",
        "smtp-port": 0,
        "smtp-user": "",
        "smtp-password": "",
        "smtp-to": [""],
        starttls: "",
      },
    ],
    phones: [
      {
        "phone-api": "",
        "phone-from": "",
        "phone-to": [""],
        "phone-timeout": 0,
        "phone-retries": 0,
      },
    ],
    "circuit-names": [],
    devices: [
      {
        name: "",
        model: "",
        ipaddr: "",
        port: 0,
        circuits: [],
        "temp-names": [],
        "track-names": [],
        "curr-names": [],
        "leak-names": [],
        "volt-names": [],
        "input-names": [],
        "brkr-names": [],
        "brkr-sens": [],
        brkr: [],
        input: [],
        temp: [],
        track: [],
        curr: [],
        leak: [],
        volt: [],
        time: [],
        ptc: [],
      },
    ],
  };

  const handleReset = () => {
    // 確認ダイアログを表示
    const isConfirmed = confirm("本当にリセットしますか？現在の設定データが初期化されます。");

    if (isConfirmed) {
      // 初期設定を適用
      setEditedConfigData(initialConfig);
      setConfigData(initialConfig);

      // ファイル名をリセット（削除）
      // setFilename("");

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

    const newConfigData: YamlConfig = {
      ...editedConfigData,
      [id]: newValue,
    };

    setEditedConfigData(newConfigData);
  };

  // const saveConfigToYaml = (configData: YamlConfig, filename: string) => {
  //   const yamlString = yaml.dump(configData);
  //   const blob = new Blob([yamlString], { type: "application/yaml" });
  //   saveAs(blob, filename);
  // };

  const saveConfigToYaml = (configData: YamlConfig, filename: string) => {
    // 通常のYAML変換
    let yamlString = yaml.dump(configData);
    
    // すべてのデバイスを処理
    configData.devices.forEach(device => {
      if (device["brkr-sens"]) {
        // brkr-sens のリスト形式を検索するパターン
        const pattern = new RegExp(
          `(brkr-sens:\\s*\\n)((?:\\s*-\\s*\\d+(?:\\.\\d+)?\\s*\\n)+)`, 'g'
        );
        
        // 配列形式に変換
        const formattedArray = `brkr-sens: [${
          Array.isArray(device["brkr-sens"]) && device["brkr-sens"].length > 0
            ? device["brkr-sens"]
                .map(v => (v !== null && v !== undefined) ? Number(v).toFixed(1) : '0.0')
                .join(',')
            : ''
        }]\n`;
        
        // 置換を実行 (完全に置き換える)
        yamlString = yamlString.replace(pattern, formattedArray);
      }
    });
    
    const blob = new Blob([yamlString], { type: "application/yaml" });
    saveAs(blob, filename);
  };


  const downloadYaml = (filename: string) => {
    saveConfigToYaml(editedConfigData, filename);
  };

  const handleOutputButtonClick = () => {
    if (!filename) {
      alert("ファイル名が選択されていません。サイドバーからファイル名を選択してください。");
      return;
    }
    downloadYaml(filename);
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div className="w-64 mx-auto sm:mx-0 sm:w-auto">
            <FileUpload />
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
        {/* 各inputフィールドを一貫して表示 */}
        <InputField
          label="サイト名"
          value={editedConfigData.site || ""}
          id="site"
          isEditable={isEditable}
          onChange={handleInputChange}
        />
        <InputField
          label="ポーリングインターバル"
          value={editedConfigData["polling-interval"] || 0}
          id="polling-interval"
          isEditable={isEditable}
          onChange={handleInputChange}
        />
        <InputField
          label="スーパバイザIPアドレス"
          value={editedConfigData["supervisor-ipaddr"] || ""}
          id="supervisor-ipaddr"
          isEditable={isEditable}
          onChange={handleInputChange}
        />
        <InputField
          label="スーパバイザポート番号"
          value={editedConfigData["supervisor-port"] || 0}
          id="supervisor-port"
          isEditable={isEditable}
          onChange={handleInputChange}
        />
        <InputField
          label="MQTT IPアドレス"
          value={editedConfigData["mqtt-ipaddr"] || ""}
          id="mqtt-ipaddr"
          isEditable={isEditable}
          onChange={handleInputChange}
        />
        <InputField
          label="MQTT ポート番号"
          value={editedConfigData["mqtt-port"] || 0}
          id="mqtt-port"
          isEditable={isEditable}
          onChange={handleInputChange}
        />
        <MailSettings
          isEditable={isEditable}
          editconfig={editedConfigData.mails}
          seteditConfig={(mails: YamlMailConfig[]) => {
            const newState: YamlConfig = {
              ...editedConfigData,
              mails: mails,
            };
            setEditedConfigData(newState);
          }}
        />
        <PhoneSettings
          isEditable={isEditable}
          editconfig={editedConfigData.phones}
          seteditConfig={(phones: YamlPhoneConfig[]) => {
            const newState: YamlConfig = {
              ...editedConfigData,
              phones: phones,
            };
            setEditedConfigData(newState);
          }}
        />
        <DeviceSettings
          isEditable={isEditable}
          editconfig={editedConfigData.devices}
          seteditConfig={(devices: YamlDeviceConfig[]) => {
            const newState: YamlConfig = {
              ...editedConfigData,
              devices: devices,
            };
            setEditedConfigData(newState);
          }}
          // filename={filename} を削除
        />
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
    <div className="grid grid-cols-3 items-center space-x-1">
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
