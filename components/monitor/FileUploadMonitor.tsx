import React, { useContext, useRef } from 'react';
import { DataContext } from '@/contexts/Datacontext';

export const FileUploadMonitor = () => {
  const { setUploadedFileMonitor } = useContext(DataContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFileMonitor(file);
      // ファイル選択後に input の値をリセット
      event.target.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        type="file"
        accept=".yaml"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        ref={fileInputRef}
      />
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={handleClick}
      >
        設定ファイルをアップロード
      </button>
    </div>
  );
};