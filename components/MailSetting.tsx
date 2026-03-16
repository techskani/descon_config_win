import React, { useEffect, useState } from 'react';
import { YamlMailConfig } from '@/app/types'; 

interface MailSettingsProps {
  isEditable: boolean;
  editconfig: YamlMailConfig[];
  seteditConfig: (config: YamlMailConfig[]) => void;
}

export default function MailSettings({ isEditable, editconfig, seteditConfig }: MailSettingsProps) {
  const [mailconfigs, setmailConfigs] = useState<YamlMailConfig[]>(editconfig.length > 0 ? editconfig : [{
    "smtp-server": '',
    "smtp-port": 0,
    "smtp-user": '',
    "smtp-password": '',
    "smtp-to": [''],
    "starttls": ''
  }]);
  const [expandedIndices, setExpandedIndices] = useState<{ [key: number]: boolean }>({});

  type YamlMailConfigWithoutSmtpTo = Omit<YamlMailConfig, "smtp-to">;

  useEffect(() => {
    if (editconfig.length > 0) {
      setmailConfigs(editconfig);
    }
  }, [editconfig]);

  const handleAddConfig = () => {
    const newMailConfig: YamlMailConfig = {
      "smtp-server": '',
      "smtp-port": 0,
      "smtp-user": '',
      "smtp-password": '',
      "smtp-to": [''],
      "starttls": ''
    };
    setmailConfigs([...mailconfigs, newMailConfig]);
    seteditConfig([...mailconfigs, newMailConfig]);
    setExpandedIndices(prevIndices => ({
      ...prevIndices,
      [mailconfigs.length]: true
    }));
  };

  const handleChange = (index: number, field: keyof YamlMailConfigWithoutSmtpTo, value: string | number ) => {
    const newConfigs = [...mailconfigs];
     if (field === "smtp-port") {
      // 数値型であるため、数値に変換する
      const parsedValue = parseInt(value as string, 10);
      if (isNaN(parsedValue)) {
        // 入力値が空の文字列の場合は、元の値を保持する
        newConfigs[index][field] = 0;
      } else {
        // 数値に変換できる場合は、変換後の値を設定する
        newConfigs[index][field] = parsedValue;
      }
    } else {
      newConfigs[index][field] = value as string;
    }
    setmailConfigs(newConfigs);
    seteditConfig(newConfigs);
  };

  const handleChangeTo = (index: number, field: string, subindex: number, value: string ) => {
    const newConfigs = [...mailconfigs];
    if (field === "smtp-to") {
      newConfigs[index][field][subindex] = value as string;
    } 
    setmailConfigs(newConfigs);
    seteditConfig(newConfigs);
  };

  const handleAddTo = (index: number) => {
    const newConfigs = [...mailconfigs];
    newConfigs[index]["smtp-to"].push('');
    setmailConfigs(newConfigs);
    seteditConfig(newConfigs);
  };

  const handleRemoveConfig = (index: number) => {
    const newConfigs = mailconfigs.filter((_, idx) => idx !== index);
    setmailConfigs(newConfigs);
    seteditConfig(newConfigs);
    setExpandedIndices(prevIndices => {
      const newIndices = { ...prevIndices };
      delete newIndices[index];
      return newIndices;
    });
  };

  const handleRemoveTo = (index: number, subIndex: number) => {
    const newConfigs = [...mailconfigs];
    newConfigs[index]["smtp-to"].splice(subIndex, 1);
    setmailConfigs(newConfigs);
    seteditConfig(newConfigs);
  };

  const handleToggleExpand = (index: number) => {
    setExpandedIndices(prevIndices => ({
      ...prevIndices,
      [index]: !prevIndices[index]
    }));
  };

  return (
    <div className="flex flex-col space-y-8">
      <label className="font-medium" htmlFor="mail-setting">
        メール設定
      </label>
      {mailconfigs.map((config, index) => (
        <div key={index} className="space-y-3">
          {/* メールサーバー */}
          <div className="grid grid-cols-3 items-center space-x-1">
            <label className="text-right font-medium pr-4" htmlFor={`mail-server-${index}`}>メールサーバー</label>
            <div className="flex col-span-2 items-center space-x-2">
              <input
                className={`border rounded p-2 w-80 transition-colors duration-150 ${
                  isEditable ? 'bg-white border-blue-500' : 'bg-gray-100 border-gray-300'
                }`}
                id={`mail-server-${index}`}
                value={config["smtp-server"]}
                onChange={(e) => handleChange(index, "smtp-server", e.target.value)}
                readOnly={!isEditable}
                type="text"
                placeholder="smtp.technomirai.co.jp"
              />
              <button
                  className="flex justify-center items-center text-blue-500 focus:outline-none"
                  onClick={() => handleToggleExpand(index)}
              >
                  {expandedIndices[index] ? '▲' : '▼'}
              </button>
              {isEditable && index >= 0 && mailconfigs.length > 1 && (
                <button
                  className="border rounded p-2 text-red-500"
                  onClick={() => handleRemoveConfig(index)}
                >
                  削除
                </button>
              )}
              {isEditable && index === mailconfigs.length - 1 && (
                <button className="border rounded p-2" onClick={handleAddConfig}>
                  追加
                </button>
              )}
            </div>
          </div>
          

          {/* その他のフィールド */}
          {expandedIndices[index] && (
            <>
              <div className="grid grid-cols-3 items-center space-x-1">
                <label className="text-right font-medium pr-4" htmlFor={`mail-port-${index}`}>ポート</label>
                <div className="flex col-span-2 items-center space-x-2">
                  <input
                    className={`border rounded p-2 w-80 transition-colors duration-150 ${
                      isEditable ? 'bg-white border-blue-500' : 'bg-gray-100 border-gray-300'
                    }`}
                    id={`mail-port-${index}`}
                    value={config["smtp-port"]}
                    onChange={(e) => handleChange(index, "smtp-port", e.target.value)}
                    readOnly={!isEditable}
                    type="text"
                    placeholder="ポート番号"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 items-center space-x-1">
                <label className="text-right font-medium pr-4" htmlFor={`mail-username-${index}`}>ユーザー名</label>
                <div className="flex col-span-2 items-center space-x-2">
                  <input
                    className={`border rounded p-2 w-80 transition-colors duration-150 ${
                      isEditable ? 'bg-white border-blue-500' : 'bg-gray-100 border-gray-300'
                    }`}
                    id={`mail-username-${index}`}
                    value={config["smtp-user"]}
                    onChange={(e) => handleChange(index, "smtp-user", e.target.value)}
                    readOnly={!isEditable}
                    type="text"
                    placeholder="ユーザー名"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 items-center space-x-1">
                <label className="text-right font-medium pr-4" htmlFor={`mail-password-${index}`}>パスワード</label>
                <div className="flex col-span-2 items-center space-x-2">
                  <input
                    className={`border rounded p-2 w-80 transition-colors duration-150 ${
                      isEditable ? 'bg-white border-blue-500' : 'bg-gray-100 border-gray-300'
                    }`}
                    id={`mail-password-${index}`}
                    value={config["smtp-password"]}
                    onChange={(e) => handleChange(index, "smtp-password", e.target.value)}
                    readOnly={!isEditable}
                    type="text"
                    placeholder="パスワード"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 items-center space-x-1">
                <label className="text-right font-medium pr-4" htmlFor={`mail-to-${index}`}>送信先</label>
                <div className="flex flex-col col-span-2">
                  {config["smtp-to"].map((to, subIndex) => (
                    <div key={subIndex} className="flex items-center space-x-2">
                      <input
                        className={`border rounded p-2 w-80 transition-colors duration-150 ${
                          isEditable ? 'bg-white border-blue-500' : 'bg-gray-100 border-gray-300'
                        }`}
                        id={`mail-to-${index}-${subIndex}`}
                        value={to}
                        onChange={(e) => handleChangeTo(index, "smtp-to", subIndex, e.target.value)}
                        readOnly={!isEditable}
                        type="text"
                        placeholder="technomirai@gmail.com"
                      />
                      {isEditable && (subIndex > 0 || config["smtp-to"].length > 1) && (
                        <button
                          className="border rounded p-2 text-red-500"
                          onClick={() => handleRemoveTo(index, subIndex)}
                        >
                          削除
                        </button>
                      )}
                      {isEditable && (
                        <button className="border rounded p-2" onClick={() => handleAddTo(index)}>
                          追加
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 items-center space-x-1">
                <label className="text-right font-medium pr-4" htmlFor={`mail-starttls-${index}`}>STARTTLS</label>
                <div className="flex col-span-2 items-center space-x-2">
                  <select
                    className={`border rounded p-2 w-80 transition-colors duration-150 ${
                      isEditable ? 'bg-white border-blue-500' : 'bg-gray-100 border-gray-300'
                    }`}
                    id={`mail-starttls-${index}`}
                    value={config.starttls}
                    onChange={(e) => handleChange(index, 'starttls', e.target.value)}
                    disabled={!isEditable}
                  >
                    <option value="">選択してください</option>
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}