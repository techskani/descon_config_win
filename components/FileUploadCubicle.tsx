import React, { useContext, useRef } from "react";
import { DataContext } from "@/contexts/Datacontext";

export const FileUploadCubicle = () => {
  const { setCubicleUploadedFile } = useContext(DataContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCubicleUploadedFile(file);
      // ファイル選択後に input の値をリセット
      event.target.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <input
        type="file"
        accept=".yaml"
        onChange={handleFileUpload}
        style={{ display: "none" }}
        ref={fileInputRef}
      />
      <button
        className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        onClick={handleClick}
      >
        Cubicle設定ファイルをアップロード
      </button>
    </div>
  );
}; 