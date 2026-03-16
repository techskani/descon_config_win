import React, { useState, useEffect } from 'react';
import { YamlPhoneConfig } from '@/app/types';

interface PhoneSettingsProps {
  isEditable: boolean;
  editconfig: YamlPhoneConfig[];
  seteditConfig: (config: YamlPhoneConfig[]) => void;
}

export default function PhoneSettings({ isEditable, editconfig, seteditConfig }: PhoneSettingsProps) {
    const [phoneconfigs, setphoneConfigs] = useState<YamlPhoneConfig[]>(editconfig.length > 0 ? editconfig : [{
        "phone-api": '',
        "phone-from": '',
        "phone-to": [''],
        "phone-timeout": 0,
        "phone-retries": 0
    }]);
    const [expandedIndices, setExpandedIndices] = useState<{ [key: number]: boolean }>({});

    type YamlPhoneConfigWithoutPhoneTo = Omit<YamlPhoneConfig, "phone-to">;

    useEffect(() => {
      if (editconfig.length > 0) {
        setphoneConfigs(editconfig);
      }
    }, [editconfig]);

    const handleAddConfig = () => {
        const newPhoneConfig: YamlPhoneConfig = {
            "phone-api": '',
            "phone-from": '',
            "phone-to": [''],
            "phone-timeout": 0,
            "phone-retries": 0
        };
        setphoneConfigs([...phoneconfigs, newPhoneConfig]);
        seteditConfig([...phoneconfigs, newPhoneConfig]);
        setExpandedIndices(prevIndices => ({
        ...prevIndices,
        [phoneconfigs.length]: true
        }));
    };

  const handleChange = (index: number, field: keyof YamlPhoneConfigWithoutPhoneTo, value: string | number) => {
    const newConfigs = [...phoneconfigs];
    if (field === "phone-timeout" || field === "phone-retries") {
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
      // その他のプロパティは文字列として直接値を更新
      newConfigs[index][field] = value as string;
    }
    setphoneConfigs(newConfigs);
    seteditConfig(newConfigs);
  };

  const handleChangeTo = (index: number, field: string, subindex: number, value: string ) => {
    const newConfigs = [...phoneconfigs];
    if (field === "phone-to") {
      newConfigs[index][field][subindex] = value as string;
    } 
    setphoneConfigs(newConfigs);
    seteditConfig(newConfigs);
  };

  const handleAddTo = (index: number) => {
    const newConfigs = [...phoneconfigs];
    newConfigs[index]["phone-to"].push('');
    setphoneConfigs(newConfigs);
    seteditConfig(newConfigs);
  };

  const handleRemoveConfig = (index: number) => {
    const newConfigs = phoneconfigs.filter((_, idx) => idx !== index);
    setphoneConfigs(newConfigs);
    seteditConfig(newConfigs);
    setExpandedIndices(prevIndices => {
      const newIndices = { ...prevIndices };
      delete newIndices[index];
      return newIndices;
    });
  };

  const handleRemoveTo = (index: number, subIndex: number) => {
    const newConfigs = [...phoneconfigs];
    newConfigs[index]["phone-to"].splice(subIndex, 1);
    setphoneConfigs(newConfigs);
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
               電話設定
          </label>
          {phoneconfigs.map((config, index) => (
            <div key={index} className="space-y-3">
                <div className="grid grid-cols-3 items-center space-x-1">
                    <label className="text-right font-medium pr-4" htmlFor={`phone-api-${index}`}>電話API</label>
                    <div className="flex col-span-2 items-center space-x-2">
                        <input
                            className={`border rounded p-2 w-80 transition-colors duration-150 ${
                              isEditable ? 'bg-white border-blue-500' : 'bg-gray-100 border-gray-300'
                            }`}
                            id={`phone-api-${index}`}
                            value={config["phone-api"]}
                            onChange={(e) => handleChange(index, "phone-api", e.target.value)}
                            readOnly={!isEditable}
                            type="text"
                            placeholder="twilio"
                        />
                        <button
                            className="flex justify-center items-center text-blue-500 focus:outline-none"
                            onClick={() => handleToggleExpand(index)}
                        >
                            {expandedIndices[index] ? '▲' : '▼'}
                        </button>
                        {isEditable && index >= 0 && phoneconfigs.length > 1 && (
                          <button
                            className="border rounded p-2 text-red-500"
                            onClick={() => handleRemoveConfig(index)}
                          >
                            削除
                          </button>
                        )}
                        {isEditable && index === phoneconfigs.length - 1 && (
                          <button className="border rounded p-2" onClick={handleAddConfig}>
                            追加
                          </button>
                        )}
                    </div>
                </div>


                {expandedIndices[index] && (
                    <>
                    <div className="grid grid-cols-3 items-center space-x-1">
                        <label className="text-right font-medium pr-4" htmlFor={`phone-from-${index}`}>発信元</label>
                        <div className="flex col-span-2 items-center space-x-2">
                        <input
                            className={`border rounded p-2 w-80 transition-colors duration-150 ${
                              isEditable ? 'bg-white border-blue-500' : 'bg-gray-100 border-gray-300'
                            }`}
                            id={`phone-from-${index}`}
                            value={config["phone-from"]}
                            onChange={(e) => handleChange(index, "phone-from", e.target.value)}
                            readOnly={!isEditable}
                            type="text"
                            placeholder="+81xxxxxxxx"
                        />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 items-center space-x-1">
                        <label className="text-right font-medium pr-4" htmlFor={`phone-to-${index}`}>発信先</label>
                        <div className="flex flex-col col-span-2">
                            {config["phone-to"].map((to, subIndex) => (
                            <div key={subIndex} className="flex items-center space-x-2">
                            <input
                                className={`border rounded p-2 w-80 transition-colors duration-150 ${
                                  isEditable ? 'bg-white border-blue-500' : 'bg-gray-100 border-gray-300'
                                }`}
                                id={`phone-to-${index}-${subIndex}`}
                                value={to}
                                onChange={(e) => handleChangeTo(index, "phone-to", subIndex, e.target.value)}
                                readOnly={!isEditable}
                                type="text"
                                placeholder="+81xxxxxxxx"
                            />
                            {isEditable && (subIndex > 0 || config["phone-to"].length > 1) && (
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
                        <label className="text-right font-medium pr-4" htmlFor={`phone-timeout-${index}`}>呼び出し時間</label>
                        <div className="flex col-span-2 items-center space-x-2">
                        <input
                            className={`border rounded p-2 w-80 transition-colors duration-150 ${
                              isEditable ? 'bg-white border-blue-500' : 'bg-gray-100 border-gray-300'
                            }`}
                            id={`phone-timeout-${index}`}
                            value={config["phone-timeout"]}
                            onChange={(e) => handleChange(index, "phone-timeout", e.target.value)}
                            readOnly={!isEditable}
                            type="text"
                            placeholder="60"
                        />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 items-center space-x-1">
                        <label className="text-right font-medium pr-4" htmlFor={`phone-retries-${index}`}>かけ直し回数</label>
                        <div className="flex col-span-2 items-center space-x-2">
                        <input
                            className={`border rounded p-2 w-80 transition-colors duration-150 ${
                              isEditable ? 'bg-white border-blue-500' : 'bg-gray-100 border-gray-300'
                            }`}
                            id={`phone-retries-${index}`}
                            value={config["phone-retries"]}
                            onChange={(e) => handleChange(index, "phone-retries", e.target.value)}
                            readOnly={!isEditable}
                            type="text"
                            placeholder="3"
                        />
                        </div>
                    </div>
                    </>
                )}
            </div>
        ))}
    </div>
  );
}
