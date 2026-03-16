'use client'


import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useWebSocketData, useTrackingData } from '@/contexts/WebSocketContext';
import { DataContext } from '@/contexts/Datacontext';
import { FileUploadMonitor } from './FileUploadMonitor';
import { DeviceData, TrackingData, TrackingDataEach, WebSocketData, YamlConfig, YamlDeviceConfig } from '@/app/types';
import CircuitChartListEach from './CircuitChartListEach';
import TrackingChart from './TrackingChart';


const CircuitChartList: React.FC = () => {
  
  const { desconConfigMonitor, setdesconConfigMonitor, cubicleConfigMonitor, setcubicleConfigMonitor } = useContext(DataContext);
  const [desconData, cubicleData, connectionStatus] = useWebSocketData();
  const [trackingData, setTrackingData] = useTrackingData(); 

  const [cubicleWidth, setCubicleWidth] = useState<number | undefined>(undefined);
  const [desconWidth, setDesconWidth] = useState<number | undefined>(undefined);
  const [dividerHeight, setDividerHeight] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);
  const cubicleRef = useRef<HTMLDivElement>(null);
  const desconRef = useRef<HTMLDivElement>(null);

  // console.log(desconData); // バックエンドから取得したデータ
  // console.log(cubicleData); // バックエンドから取得したデータ
  // console.log(trackingData);

  const initialConfig: YamlConfig = {
    site: '',
    "polling-interval": 0,
    "supervisor-ipaddr": '',
    "supervisor-port": 0,
    "mqtt-ipaddr": '',
    "mqtt-port": 0,
    mails: [],
    phones: [],
    "circuit-names": [],
    devices: []
  };

  // 最後に保存されたトラッキングデータの参照を保持
  const lastSavedTrackingRef = useRef<TrackingData>({ trackingData: [] });
  const MAX_SAVED_ITEMS = 10; // 保存するデータの最大数

  const handleResetMonitor = () => {
    // 直接両方のデータをリセット
    resetData('3');
  };

  const resetData = (choice: '1' | '2' | '3') => {
    let resetFunction = () => {};

    switch (choice) {
      case '1':
        resetFunction = () => {
          setdesconConfigMonitor(initialConfig);
          // sessionStorage.removeItem('desconConfigMonitor');
        };
        break;
      case '2':
        resetFunction = () => {
          setcubicleConfigMonitor(initialConfig);
        };
        break;
      case '3':
        resetFunction = () => {
          setdesconConfigMonitor(initialConfig);
          setcubicleConfigMonitor(initialConfig);
        };
        break;
    }

    // 確認なしで直接リセット
      resetFunction();
  };

  const handleTrackingChartClose = (index: number) => {
    setTrackingData(prevData => ({
      trackingData: prevData.trackingData.filter((_, i) => i !== index)
    }));
  };

  // トラッキングデータを取得したらそのデータをCSVに保存
  useEffect(() => {
    const newTrackingData = trackingData.trackingData.filter(
      (data) => !lastSavedTrackingRef.current.trackingData.some(
        (savedData) => 
          savedData.deviceName === data.deviceName && 
          savedData.ch === data.ch && 
          savedData.peakCurrent === data.peakCurrent &&
          savedData.timestamp === data.timestamp
      )
    );

    if (newTrackingData.length > 0) {
      newTrackingData.forEach((data) => {
        const fileName = `tracking_data_${data.deviceName}_ch${data.ch}_${data.timestamp}.csv`;
        downloadTrackingCSV(data, fileName);
      });

      // 新しいデータを追加し、最大数を超えた場合は古いデータを削除
      const updatedTrackingData = [
        ...lastSavedTrackingRef.current.trackingData,
        ...newTrackingData
      ];

      if (updatedTrackingData.length > MAX_SAVED_ITEMS) {
        lastSavedTrackingRef.current = {
          trackingData: updatedTrackingData.slice(-MAX_SAVED_ITEMS)
        };
      } else {
        lastSavedTrackingRef.current = {
          trackingData: updatedTrackingData
        };
      }
    }
  }, [trackingData]);

  const generateTrackingCSV = (data: TrackingDataEach) => {
    const header = 'Timestamp,Value\n';
    const row = `${data.timestamp},${data.values.join(',')}\n`;
    return header + row;
  };

  // トラッキングデータをCSVに保存
  const downloadTrackingCSV = (data: TrackingDataEach, fileName: string) => {
    const csvContent = generateTrackingCSV(data);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // メモリリークを防ぐためにURLを解放
  };

  // クライアントサイドでのみ条件付きレンダリングを実行してHydrationエラーを防ぐ
  useEffect(() => {
    setIsClient(true);
  }, []);

  const hasDesconData = isClient && desconConfigMonitor.devices.length > 0;
  const hasCubicleData = isClient && cubicleConfigMonitor.devices.length > 0;

  // 子コンポーネントに渡し、区切り線の高さを更新
  const updateDividerHeight = useCallback(() => {
    const cubicleHeight = cubicleRef.current?.scrollHeight || 0;
    const desconHeight = desconRef.current?.scrollHeight || 0;
    
    setDividerHeight(Math.max(cubicleHeight, desconHeight));
  }, []);

  // 子コンポーネントの幅と高さを更新
  useEffect(() => {
    const updateWidthsAndHeight = () => {
      if (cubicleRef.current) {
        setCubicleWidth(cubicleRef.current.offsetWidth);
      }
      if (desconRef.current) {
        setDesconWidth(desconRef.current.offsetWidth);
      }

      // 区切り線の高さを更新
      updateDividerHeight();
    };
  
    updateWidthsAndHeight();
    window.addEventListener('resize', updateWidthsAndHeight);
    return () => window.removeEventListener('resize', updateWidthsAndHeight);
  }, [hasDesconData, hasCubicleData, updateDividerHeight]);

  // トラッキング時に回路名を取得する関数
  const getCircuitName = (deviceName: string, ch: number): string => {
    const configs = [];
    if (hasCubicleData) configs.push(cubicleConfigMonitor);
    if (hasDesconData) configs.push(desconConfigMonitor);

    for (const config of configs) {
      const device = config.devices.find(d => d.name === deviceName);
      if (device && device['track-names']) {
        if (ch > 0 && ch <= device['track-names'].length) {
          return device['track-names'][ch - 1];
        }
      }
    }
    
    return `チャンネル ${ch}`;
  };



  // // デモデータを生成する関数
  // const generateDemoData = (deviceName: string): TrackingDataEach => {
  //   const now = new Date();
  //   const values = Array.from({ length: 2400 }, () => Math.random() * 100 - 50); // -50から50の間のランダムな値
  //   return {
  //     deviceName: deviceName,
  //     ch: Math.floor(Math.random() * 4) + 1, // 1から4のランダムなチャンネル
  //     values: values,
  //     timestamp: now.toISOString()
  //   };
  // };

  // // デモデータを追加する関数
  // const addDemoData = () => {
  //   const demoData = generateDemoData("デモデバイス1");
  //   setTrackingData(prevData => ({
  //     trackingData: [...prevData.trackingData, demoData]
  //   }));

  //   // 10秒後に2つ目のデモデータを追加
  //   setTimeout(() => {
  //     const secondDemoData = generateDemoData("デモデバイス2");
  //     setTrackingData(prevData => ({
  //       trackingData: [...prevData.trackingData, secondDemoData]
  //     }));
  //   }, 10000);

  //   // 10秒後に2つ目のデモデータを追加
  //   setTimeout(() => {
  //     const secondDemoData = generateDemoData("デモデバイス3");
  //     setTrackingData(prevData => ({
  //       trackingData: [...prevData.trackingData, secondDemoData]
  //     }));
  //   }, 20000);

  //   // 10秒後に2つ目のデモデータを追加
  //   setTimeout(() => {
  //     const secondDemoData = generateDemoData("デモデバイス4");
  //     setTrackingData(prevData => ({
  //       trackingData: [...prevData.trackingData, secondDemoData]
  //     }));
  //   }, 30000);
  // };


  // // デモ用のデータを生成する関数
  // const generateDemoData1 = (): DeviceData => {
  //   const now = new Date();
  //   const timestamp = now.getTime();
  //   const timestampData = now.toISOString();
  
  //   // 少数第2位までに制限する関数
  //   const roundToTwoDecimals = (num: number) => Math.round(num * 100) / 100;
  
  //   return {
  //     temperature: {
  //       1: [[timestampData, roundToTwoDecimals(25 + Math.random() * 10)]],
  //       2: [[timestampData, roundToTwoDecimals(30 + Math.random() * 10)]],
  //     },
  //     tempstate: {
  //       1: [[timestampData, '正常']],
  //       2: [[timestampData, '正常']],
  //     },
  //     current: {
  //       1: [[timestampData, roundToTwoDecimals(5 + Math.random() * 2)]],
  //       2: [[timestampData, roundToTwoDecimals(7 + Math.random() * 2)]],
  //     },
  //     currstate: {
  //       1: [[timestampData, '正常']],
  //       2: [[timestampData, '正常']],
  //     },
  //     trackcurrent: {
  //       1: [[timestampData, roundToTwoDecimals(0.5 + Math.random() * 0.2)]],
  //       2: [[timestampData, roundToTwoDecimals(0.7 + Math.random() * 0.2)]],
  //     },
  //     trackstate: {
  //       1: [[timestampData, '正常']],
  //       2: [[timestampData, '正常']],
  //     },
  //     leakcurrent: {
  //       1: [[timestampData, roundToTwoDecimals(0.1 + Math.random() * 0.05)]],
  //       2: [[timestampData, roundToTwoDecimals(0.15 + Math.random() * 0.05)]],
  //     },
  //     leakstate: {
  //       1: [[timestampData, '正常']],
  //       2: [[timestampData, '正常']],
  //     },
  //     input: ['オン', 'オフ'],
  //     inputstate: ['正常', '正常'],
  //     relay: ['オン', 'オフ'],
  //     num_current: [
  //       roundToTwoDecimals(5.5).toFixed(2),
  //       roundToTwoDecimals(7.2).toFixed(2)
  //     ],
  //     timestamp: timestamp,
  //     timestampData: timestampData,
  //   };
  // };


  // const generateDemoWebSocketData = (): WebSocketData => {
  //   return {
  //     '低圧電灯盤1A': generateDemoData1(),
  //     '低圧電灯盤1B': generateDemoData1(),
  //     '低圧電灯盤2A': generateDemoData1(),
  //     '低圧電灯盤2B': generateDemoData1(), 
  //     '低圧動力盤1A': generateDemoData1(), 
  //     '実験用DESCON電灯盤': generateDemoData1(),
  //     '実験用DESCON動力盤': generateDemoData1(),
  //     'ホーム分電盤10回路': generateDemoData1(),
  //     'ホーム分電盤20回路': generateDemoData1(),
  //   };
  // };

  // const DemoDesconData: WebSocketData = generateDemoWebSocketData();
  // const DemoCubicleData: WebSocketData = generateDemoWebSocketData();


  return (
    <div className="flex flex-col h-full w-full p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mx-4 sm:ml-8 mb-4">
        <div className="w-full max-w-xs sm:w-auto">  {/* max-w-xsで最大幅を制限 */}
          <FileUploadMonitor />
        </div>
        <div className="w-1/2 sm:w-auto">   {/* 同じmax-w-xsを適用 */}
          <button
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            onClick={handleResetMonitor}
          >
            リセット
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' :
            connectionStatus === 'connecting' ? 'bg-yellow-500' :
            connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
          }`}></div>
          <span className="text-sm text-gray-600">
            WebSocket: {
              connectionStatus === 'connected' ? '接続中' :
              connectionStatus === 'connecting' ? '接続試行中' :
              connectionStatus === 'error' ? 'エラー' : '切断'
            }
          </span>
        </div>
      </div>

      {(hasDesconData || hasCubicleData) ? (
        <div className="flex flex-col sm:flex-row w-full">
          {hasCubicleData && (
            <div ref={cubicleRef} className={`w-full ${hasDesconData ? 'sm:w-1/2' : ''}`}>
              <h1 className="text-lg font-bold">Cubicle</h1>
              <CircuitChartListEach
                configData={cubicleConfigMonitor}
                websocketData={cubicleData}
                containerWidth={cubicleWidth}
                onContentChange={updateDividerHeight}
                onDividerHeightChange={(height: number) => setDividerHeight(height)}
              />
            </div>
          )}
          {hasDesconData && hasCubicleData && (
            <div 
              className="hidden sm:block w-px bg-gray-300 mx-4 self-stretch"
              style={{ height: `${dividerHeight}px` }}
            ></div>
          )}
          {hasDesconData && (
            <div ref={desconRef} className={`w-full ${hasCubicleData ? 'sm:w-1/2' : ''}`}>
              <h1 className="text-lg font-bold">Descon</h1>
              <CircuitChartListEach
                configData={desconConfigMonitor}
                websocketData={desconData}
                containerWidth={desconWidth}
                onContentChange={updateDividerHeight}
                onDividerHeightChange={(height: number) => setDividerHeight(height)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          設定ファイルをアップロードしてください。
        </div>
      )}

      {/* トラッキングデータモーダル */}
      {trackingData.trackingData.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-auto">
          <div className="bg-white p-6 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto">
            <h2 className="text-2xl font-bold mb-4">トラッキング発生</h2>
            <div className={`grid gap-4 ${
              trackingData.trackingData.length === 1 
                ? 'grid-cols-1' 
                : 'grid-cols-1 sm:grid-cols-2'
            }`}>
              {trackingData.trackingData.map((data, index) => (
                <div 
                  key={`${data.deviceName}-${data.ch}-${data.timestamp}`}
                  className={`${
                    trackingData.trackingData.length === 1 
                      ? 'w-full sm:w-1/2 mx-auto' 
                      : 'w-full'
                  }`}
                >
                  <TrackingChart
                    key={`${data.deviceName}-${data.ch}-${data.timestamp}`}
                    trackingData={data}
                    onClose={() => handleTrackingChartClose(index)}
                    circuitName={getCircuitName(data.deviceName, data.ch)}
                  />
                </div>
              ))}
            </div>
            <button
              className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              onClick={() => setTrackingData({ trackingData: [] })}
            >
              全て閉じる
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default CircuitChartList;





