import React, { useContext, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useParams, useRouter } from "next/navigation";
import { DataContext } from "@/contexts/Datacontext";
import {
  CubicleYamlConfig,
  YamlTransConfig,
  YamlSwitchBoardConfig,
  YamlSwitchBoardDeviceConfig,
  YamlOverloadConfig,
  YamlAlertConfig,
} from "@/app/types";

export default function SelectTransDetail() {
  const { transName: encodedTransName } = useParams<{ transName: string }>();
  const {
    cubicleConfigData,
    editedCubicleConfigData,
    setCubicleConfigData,
    setEditedCubicleConfigData,
  } = useContext(DataContext);
  const [selectedTrans, setSelectedTrans] = useState<string>("");
  const router = useRouter();
  const [isEditable, setIsEditable] = useState(false);

  // URLからトランス名を取得して設定
  useEffect(() => {
    const decodedTransName = decodeURIComponent(encodedTransName);
    if (decodedTransName) {
      setSelectedTrans(decodedTransName);
    }
    console.log(selectedTrans);
  }, [encodedTransName]);

  // トランス選択時の処理
  const handleTransChange = (transName: string) => {
    if (transName) {
      setSelectedTrans(transName);
      router.push(`/transDetailSetting/${encodeURIComponent(transName)}`);
    }
  };

  // 編集モード切替
  const handleEdit = () => {
    setIsEditable(true);
  };

  // 保存処理
  const handleSave = () => {
    setIsEditable(false);
    setCubicleConfigData(editedCubicleConfigData);
  };

  // 選択中のトランス情報を取得
  const selectedTransData = editedCubicleConfigData.trans.find(
    (trans) => trans.name === selectedTrans
  );

  // 配電盤の追加
  const handleAddSwitchBoard = () => {
    if (!selectedTrans || !isEditable) return;

    const updatedTrans = [...editedCubicleConfigData.trans];
    const transIndex = updatedTrans.findIndex((trans) => trans.name === selectedTrans);

    if (transIndex === -1) return;

    const newSwitchBoard: YamlSwitchBoardConfig = {
      name: "新規配電盤",
      ipaddr: "",
      curr: [],
      devices: [],
    };

    updatedTrans[transIndex]["switch-boards"] = [
      ...updatedTrans[transIndex]["switch-boards"],
      newSwitchBoard,
    ];

    setEditedCubicleConfigData({
      ...editedCubicleConfigData,
      trans: updatedTrans,
    });
  };

  // 配電盤の削除
  const handleRemoveSwitchBoard = (switchBoardIndex: number) => {
    if (!selectedTrans || !isEditable) return;

    const isConfirmed = confirm("この配電盤を削除してもよろしいですか？");
    if (!isConfirmed) return;

    const updatedTrans = [...editedCubicleConfigData.trans];
    const transIndex = updatedTrans.findIndex((trans) => trans.name === selectedTrans);

    if (transIndex === -1) return;

    updatedTrans[transIndex]["switch-boards"].splice(switchBoardIndex, 1);

    setEditedCubicleConfigData({
      ...editedCubicleConfigData,
      trans: updatedTrans,
    });
  };

  // 分電盤の追加
  const handleAddDevice = (switchBoardIndex: number) => {
    if (!selectedTrans || !isEditable) return;

    const updatedTrans = [...editedCubicleConfigData.trans];
    const transIndex = updatedTrans.findIndex((trans) => trans.name === selectedTrans);

    if (transIndex === -1) return;

    const newDevice: YamlSwitchBoardDeviceConfig = {
      name: "新規分電盤",
      ipaddr: "",
    };

    updatedTrans[transIndex]["switch-boards"][switchBoardIndex].devices = [
      ...updatedTrans[transIndex]["switch-boards"][switchBoardIndex].devices,
      newDevice,
    ];

    setEditedCubicleConfigData({
      ...editedCubicleConfigData,
      trans: updatedTrans,
    });
  };

  // 分電盤の削除
  const handleRemoveDevice = (switchBoardIndex: number, deviceIndex: number) => {
    if (!selectedTrans || !isEditable) return;

    const isConfirmed = confirm("この分電盤を削除してもよろしいですか？");
    if (!isConfirmed) return;

    const updatedTrans = [...editedCubicleConfigData.trans];
    const transIndex = updatedTrans.findIndex((trans) => trans.name === selectedTrans);

    if (transIndex === -1) return;

    updatedTrans[transIndex]["switch-boards"][switchBoardIndex].devices.splice(deviceIndex, 1);

    setEditedCubicleConfigData({
      ...editedCubicleConfigData,
      trans: updatedTrans,
    });
  };

  // 入力フィールド変更時の処理
  const handleInputChange = (
    field: string,
    value: string | number,
    switchBoardIndex?: number,
    deviceIndex?: number
  ) => {
    if (!selectedTrans || !isEditable) return;

    const updatedTrans = [...editedCubicleConfigData.trans];
    const transIndex = updatedTrans.findIndex((trans) => trans.name === selectedTrans);

    if (transIndex === -1) return;

    // トランス自体のフィールド
    if (field === "name") {
      updatedTrans[transIndex].name = value as string;
    }
    // 過負荷設定
    else if (field === "warn-curr") {
      const warnIndex = updatedTrans[transIndex].overload.findIndex(
        (item) => item.state === "warn"
      );
      if (warnIndex !== -1) {
        updatedTrans[transIndex].overload[warnIndex].curr = Number(value);
      }
    } else if (field === "warn-time") {
      const warnIndex = updatedTrans[transIndex].overload.findIndex(
        (item) => item.state === "warn"
      );
      if (warnIndex !== -1) {
        updatedTrans[transIndex].overload[warnIndex].time = Number(value);
      }
    } else if (field === "alarm-curr") {
      const alarmIndex = updatedTrans[transIndex].overload.findIndex(
        (item) => item.state === "alarm"
      );
      if (alarmIndex !== -1) {
        updatedTrans[transIndex].overload[alarmIndex].curr = Number(value);
      }
    } else if (field === "alarm-time") {
      const alarmIndex = updatedTrans[transIndex].overload.findIndex(
        (item) => item.state === "alarm"
      );
      if (alarmIndex !== -1) {
        updatedTrans[transIndex].overload[alarmIndex].time = Number(value);
      }
    }
    // アラート設定
    else if (field === "controller-ipaddr") {
      updatedTrans[transIndex].alert["controller-ipaddr"] = value as string;
    } else if (field === "device") {
      updatedTrans[transIndex].alert.device = value as string;
    } else if (field === "circuit-no") {
      updatedTrans[transIndex].alert["circuit-no"] = Number(value);
    }
    // 配電盤設定
    else if (switchBoardIndex !== undefined) {
      if (field === "switchboard-name") {
        updatedTrans[transIndex]["switch-boards"][switchBoardIndex].name = value as string;
      } else if (field === "switchboard-ipaddr") {
        updatedTrans[transIndex]["switch-boards"][switchBoardIndex].ipaddr = value as string;
      } else if (field === "switchboard-curr") {
        // カンマ区切りの文字列を数値配列に変換
        const currArray = (value as string)
          .split(",")
          .map((item) => Number(item.trim()))
          .filter((item) => !isNaN(item));
        updatedTrans[transIndex]["switch-boards"][switchBoardIndex].curr = currArray;
      }
      // 分電盤設定
      else if (deviceIndex !== undefined) {
        if (field === "device-name") {
          updatedTrans[transIndex]["switch-boards"][switchBoardIndex].devices[deviceIndex].name =
            value as string;
        } else if (field === "device-ipaddr") {
          updatedTrans[transIndex]["switch-boards"][switchBoardIndex].devices[deviceIndex].ipaddr =
            value as string;
        }
      }
    }

    setEditedCubicleConfigData({
      ...editedCubicleConfigData,
      trans: updatedTrans,
    });
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-4 items-center space-x-0 md:space-x-1 gap-4 md:gap-0 mb-4 mt-6">
        <label className="text-left md:text-right mr-0 md:mr-4 font-medium" htmlFor="trans-name">
          トランス名称
        </label>
        <div className="flex col-span-1 md:col-span-2 items-center space-x-2">
          <Select onValueChange={handleTransChange} value={selectedTrans}>
            <SelectTrigger className="flex w-full">
              <SelectValue placeholder="トランス名">
                {selectedTrans || "トランスを選択してください"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {editedCubicleConfigData.trans
                .filter((trans) => trans.name !== "")
                .map((trans) => (
                  <SelectItem key={trans.name} value={trans.name}>
                    {trans.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-center md:justify-end">
          <button
            className="
              h-12 px-5 m-2 w-28
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
        </div>
      </div>

      {selectedTransData && (
        <div className="flex flex-col items-center space-y-4">
          {/* 過負荷設定 */}
          <div className="w-full border rounded-md p-4 bg-white shadow-sm">
            <h2 className="text-lg font-bold mb-4">過負荷設定</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-medium">注意レベル</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">電流値 (A)</label>
                    <input
                      className={`border rounded p-2 w-full transition-colors duration-150 ${
                        isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                      }`}
                      value={
                        selectedTransData.overload.find((o) => o.state === "warn")?.curr || 0
                      }
                      onChange={(e) => handleInputChange("warn-curr", e.target.value)}
                      readOnly={!isEditable}
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">時間 (秒)</label>
                    <input
                      className={`border rounded p-2 w-full transition-colors duration-150 ${
                        isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                      }`}
                      value={
                        selectedTransData.overload.find((o) => o.state === "warn")?.time || 0
                      }
                      onChange={(e) => handleInputChange("warn-time", e.target.value)}
                      readOnly={!isEditable}
                      type="text"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="font-medium">警報レベル</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">電流値 (A)</label>
                    <input
                      className={`border rounded p-2 w-full transition-colors duration-150 ${
                        isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                      }`}
                      value={
                        selectedTransData.overload.find((o) => o.state === "alarm")?.curr || 0
                      }
                      onChange={(e) => handleInputChange("alarm-curr", e.target.value)}
                      readOnly={!isEditable}
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">時間 (秒)</label>
                    <input
                      className={`border rounded p-2 w-full transition-colors duration-150 ${
                        isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                      }`}
                      value={
                        selectedTransData.overload.find((o) => o.state === "alarm")?.time || 0
                      }
                      onChange={(e) => handleInputChange("alarm-time", e.target.value)}
                      readOnly={!isEditable}
                      type="text"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* アラート設定 */}
          <div className="w-full border rounded-md p-4 bg-white shadow-sm">
            <h2 className="text-lg font-bold mb-4">アラート設定</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1">コントローラーIPアドレス</label>
                <input
                  className={`border rounded p-2 w-full transition-colors duration-150 ${
                    isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                  }`}
                  value={selectedTransData.alert["controller-ipaddr"]}
                  onChange={(e) => handleInputChange("controller-ipaddr", e.target.value)}
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
                  value={selectedTransData.alert.device}
                  onChange={(e) => handleInputChange("device", e.target.value)}
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
                  value={selectedTransData.alert["circuit-no"]}
                  onChange={(e) => handleInputChange("circuit-no", e.target.value)}
                  readOnly={!isEditable}
                  type="text"
                />
              </div>
            </div>
          </div>

          {/* 配電盤設定 */}
          <div className="w-full border rounded-md p-4 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">配電盤設定</h2>
              {isEditable && (
                <button
                  className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  onClick={handleAddSwitchBoard}
                >
                  配電盤を追加
                </button>
              )}
            </div>
            
            {selectedTransData["switch-boards"].length > 0 ? (
              <div className="space-y-6">
                {selectedTransData["switch-boards"].map((switchBoard, switchBoardIndex) => (
                  <div key={switchBoardIndex} className="border p-4 rounded">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium">配電盤 {switchBoardIndex + 1}</h3>
                      {isEditable && (
                        <button
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleRemoveSwitchBoard(switchBoardIndex)}
                        >
                          削除
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm mb-1">配電盤名称</label>
                        <input
                          className={`border rounded p-2 w-full transition-colors duration-150 ${
                            isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                          }`}
                          value={switchBoard.name}
                          onChange={(e) => 
                            handleInputChange("switchboard-name", e.target.value, switchBoardIndex)
                          }
                          readOnly={!isEditable}
                          type="text"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">IPアドレス</label>
                        <input
                          className={`border rounded p-2 w-full transition-colors duration-150 ${
                            isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                          }`}
                          value={switchBoard.ipaddr}
                          onChange={(e) => 
                            handleInputChange("switchboard-ipaddr", e.target.value, switchBoardIndex)
                          }
                          readOnly={!isEditable}
                          type="text"
                        />
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm mb-1">電流センサーNo (カンマ区切り)</label>
                      <input
                        className={`border rounded p-2 w-full transition-colors duration-150 ${
                          isEditable ? "bg-white border-blue-500" : "bg-gray-100 border-gray-300"
                        }`}
                        value={switchBoard.curr.join(", ")}
                        onChange={(e) => 
                          handleInputChange("switchboard-curr", e.target.value, switchBoardIndex)
                        }
                        readOnly={!isEditable}
                        type="text"
                        placeholder="例: 4, 5, 6, 7, 8"
                      />
                    </div>
                    
                    {/* 分電盤設定 */}
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">分電盤</h4>
                        {isEditable && (
                          <button
                            className="px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                            onClick={() => handleAddDevice(switchBoardIndex)}
                          >
                            分電盤を追加
                          </button>
                        )}
                      </div>
                      
                      {switchBoard.devices.length > 0 ? (
                        <div className="space-y-3 pl-4">
                          {switchBoard.devices.map((device, deviceIndex) => (
                            <div key={deviceIndex} className="border-l-2 pl-3 py-2">
                              <div className="flex justify-between items-center mb-2">
                                <h5 className="font-medium text-sm">分電盤 {deviceIndex + 1}</h5>
                                {isEditable && (
                                  <button
                                    className="text-red-500 text-sm hover:text-red-700"
                                    onClick={() => 
                                      handleRemoveDevice(switchBoardIndex, deviceIndex)
                                    }
                                  >
                                    削除
                                  </button>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm mb-1">分電盤名称</label>
                                  <input
                                    className={`border rounded p-2 w-full transition-colors duration-150 ${
                                      isEditable 
                                        ? "bg-white border-blue-500" 
                                        : "bg-gray-100 border-gray-300"
                                    }`}
                                    value={device.name}
                                    onChange={(e) => 
                                      handleInputChange(
                                        "device-name", 
                                        e.target.value, 
                                        switchBoardIndex, 
                                        deviceIndex
                                      )
                                    }
                                    readOnly={!isEditable}
                                    type="text"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm mb-1">IPアドレス</label>
                                  <input
                                    className={`border rounded p-2 w-full transition-colors duration-150 ${
                                      isEditable 
                                        ? "bg-white border-blue-500" 
                                        : "bg-gray-100 border-gray-300"
                                    }`}
                                    value={device.ipaddr}
                                    onChange={(e) => 
                                      handleInputChange(
                                        "device-ipaddr", 
                                        e.target.value, 
                                        switchBoardIndex, 
                                        deviceIndex
                                      )
                                    }
                                    readOnly={!isEditable}
                                    type="text"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm pl-4">分電盤がありません</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">配電盤がありません</p>
            )}
          </div>
        </div>
      )}

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
