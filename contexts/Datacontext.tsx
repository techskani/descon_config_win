import { TableRowLeakCurr, TableRowOverCurr, TableRowRelays, TableRowTemp, TableRowTrack, YamlCircuitConfig, YamlConfig, YamlDeviceConfig, CubicleYamlConfig } from '@/app/types';
import yaml from 'js-yaml';
import React, { createContext, useEffect, useState } from 'react'

export interface DataContextType {
    configData: YamlConfig;
    setConfigData: (config: YamlConfig) => void;
    editedConfigData: YamlConfig;
    setEditedConfigData: (config: YamlConfig) => void;
    desconConfigMonitor: YamlConfig;
    setdesconConfigMonitor: (config: YamlConfig) => void;
    cubicleConfigMonitor: YamlConfig;
    setcubicleConfigMonitor: (config: YamlConfig) => void;
    setUploadedFile: (file: File | null) => void;
    setUploadedFileMonitor: (file: File | null) => void;
    tempTableData: TableRowTemp[];
    settempTableData: (tabledata: TableRowTemp[]) => void;
    trackTableData: TableRowTrack[];
    settrackTableData: (tabledata: TableRowTrack[]) => void;
    currTableData: TableRowOverCurr[];
    setcurrTableData: (tabledata: TableRowOverCurr[]) => void;
    leakTableData: TableRowLeakCurr[];
    setleakTableData: (tabledata: TableRowLeakCurr[]) => void;
    relayTableData: TableRowRelays[];
    setrelayTableData: (tabledata: TableRowRelays[]) => void;
    filename: string;
    setFilename: (value: string) => void;
    cubicleConfigData: CubicleYamlConfig;
    setCubicleConfigData: (config: CubicleYamlConfig) => void;
    editedCubicleConfigData: CubicleYamlConfig;
    setEditedCubicleConfigData: (config: CubicleYamlConfig) => void;
    setCubicleUploadedFile: (file: File | null) => void;
}

export const DataContext = createContext<DataContextType>({
    configData: {
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
    },
    setConfigData: () => {},
    editedConfigData: {
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
    },
    setEditedConfigData: () => {},
    desconConfigMonitor: {
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
    },
    setdesconConfigMonitor: () => {},
    cubicleConfigMonitor: {
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
    },
    setcubicleConfigMonitor: () => {},
    setUploadedFile: () => {},
    setUploadedFileMonitor: () => {},
    tempTableData: [{
        "sensor-No": 0,
        "circuit-name": '',
        power: '',
        wire:'',
        breaker: '',
        "breaker-type": '',
        "allowable-temp": 0,
        phase: '',
        relay: '0',
        sensor: '0',
        "caution-temp": '0.0',
        "caution-time": '0',
        "cutoff-temp": '0.0',
        "cutoff-time": '0',
        "imm-cutoff-temp": '0.0',
        "sensor-enabled": '0',
    }],
    settempTableData: () => {},
    trackTableData: [
        {
            "sensor-No": 0,
            "circuit-name": '',
            power: '',
            wire:'',
            breaker: '',
            phase: '',
            relay: '0',
            "caution-curr": '0.0',
            "caution-count": '1',
            "cutoff-curr": '0.0',
            "cutoff-count": '1',
        }
      ],
    settrackTableData: () => {},
    currTableData: [
        {
            "sensor-No": 0,
            "circuit-name": '',
            power: '',
            wire:'',
            breaker: '',
            phase: '',
            relay: '0',
            "caution-curr": '0.1',
            "caution-time": '0',
            "cutoff-curr": '0.1',
            "cutoff-time": '0',
        }
      ],
    setcurrTableData: () => {},
    leakTableData: [
        {
            "sensor-No": 0,
            "circuit-name": '',
            power: '',
            wire:'',
            breaker: '',
            relay: '0',
            "caution-curr": '0.1',
            "caution-time": '0',
            "cutoff-curr": '0.1',
            "cutoff-time": '0',
        }
      ],
    setleakTableData: () => {},
    relayTableData: [
      {
            "sensor-No": 0,
            "circuit-name": '',
            power: '',
            breaker: '',
            wire: '',
            "relay-link-to": 0,
            "relay-auto-trip": 0,
            "brkr-sens-curr": '0.0',
            "brkr-trip-status": 'OFF',
      }
    ],
    setrelayTableData: () => {},
    filename: '',
    setFilename: () => {},
    cubicleConfigData: {
        site: "",
        "polling-interval": 0,
        "supervisor-ipaddr": "",
        "supervisor-port": 0,
        "mqtt-ipaddr": "",
        "mqtt-port": 0,
        trans: [],
    },
    setCubicleConfigData: () => {},
    editedCubicleConfigData: {
        site: "",
        "polling-interval": 0,
        "supervisor-ipaddr": "",
        "supervisor-port": 0,
        "mqtt-ipaddr": "",
        "mqtt-port": 0,
        trans: [],
    },
    setEditedCubicleConfigData: () => {},
    setCubicleUploadedFile: () => {},
});

// sessionStorageの安全な使用のためのヘルパー関数
const getFromSessionStorage = (key: string, defaultValue: any) => {
    if (typeof window !== 'undefined') {
        const storedData = sessionStorage.getItem(key);
        return storedData ? JSON.parse(storedData) : defaultValue;
    }
    return defaultValue;
};

const setToSessionStorage = (key: string, value: any) => {
    if (typeof window !== 'undefined') {
        sessionStorage.setItem(key, JSON.stringify(value));
    }
};

export const DataProvider = ({children}:any) => {
    const [configData, setConfigData] = useState<YamlConfig>(() => {
        return getFromSessionStorage('configData', {
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
        });
    });

    const [editedConfigData, setEditedConfigData] = useState<YamlConfig>(() => {
        return getFromSessionStorage('editedConfigData', {
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
        });
    }); 
    
    const [desconConfigMonitor, setdesconConfigMonitor] = useState<YamlConfig>(() => {
        return getFromSessionStorage('desconConfigMonitor', {
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
        });
    });

    const [cubicleConfigMonitor, setcubicleConfigMonitor] = useState<YamlConfig>(() => {
        return getFromSessionStorage('cubicleConfigMonitor', {
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
        });
    });

    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [uploadedFileMonitor, setUploadedFileMonitor] = useState<File | null>(null);
    const [cubicleUploadedFile, setCubicleUploadedFile] = useState<File | null>(null);

    const [filename, setFilename] = useState<string>(() => {
      return getFromSessionStorage('filename', '');
    });

    // 表のデータを状態として持つ
    const [tempTableData, settempTableData] = useState<TableRowTemp[]>([
      {
          "sensor-No": 0,
          "circuit-name": '',
          power: '',
          wire:'',
          breaker: '',
          "breaker-type": '',
          "allowable-temp": 0,
          phase: '',
          relay: '0',
          sensor: '0',
          "caution-temp": '0.0',
          "caution-time": '0',
          "cutoff-temp": '0.0',
          "cutoff-time": '0',
          "imm-cutoff-temp": '0.0',
          "sensor-enabled": '0',
      }
    ]);

    const [trackTableData, settrackTableData] = useState<TableRowTrack[]>([
        {
            "sensor-No": 0,
            "circuit-name": '',
            power: '',
            wire:'',
            breaker: '',
            phase: '',
            relay: '0',
            "caution-curr": '0.0',
            "caution-count": '1',
            "cutoff-curr": '0.0',
            "cutoff-count": '1',
        }
      ]);
    
    const [currTableData, setcurrTableData] = useState<TableRowOverCurr[]>([
    {
        "sensor-No": 0,
        "circuit-name": '',
        power: '',
        wire:'',
        breaker: '',
        phase: '',
        relay: '0',
        "caution-curr": '0.1',
        "caution-time": '0',
        "cutoff-curr": '0.1',
        "cutoff-time": '0',
    }
    ]);

    const [leakTableData, setleakTableData] = useState<TableRowLeakCurr[]>([
        {
            "sensor-No": 0,
            "circuit-name": '',
            power: '',
            wire:'',
            breaker: '',
            relay: '0',
            "caution-curr": '0.1',
            "caution-time": '0',
            "cutoff-curr": '0.1',
            "cutoff-time": '0',
        }
      ]);
    
    const [relayTableData, setrelayTableData] = useState<TableRowRelays[]>([
        {
            "sensor-No": 0,
            "circuit-name": '',
            power: '',
            breaker: '',
            wire: '',
            "relay-link-to": 0,
            "relay-auto-trip": 0,
            "brkr-sens-curr": '0.0',
            "brkr-trip-status": 'OFF',
        }
      ]);

    // Cubicle.yaml用の初期設定
    const initialCubicleConfig: CubicleYamlConfig = {
        site: "",
        "polling-interval": 0,
        "supervisor-ipaddr": "",
        "supervisor-port": 0,
        "mqtt-ipaddr": "",
        "mqtt-port": 0,
        trans: []
    };

    // Cubicle.yaml用の状態管理
    const [cubicleConfigData, setCubicleConfigData] = useState<CubicleYamlConfig>(() => {
        return getFromSessionStorage('cubicleConfigData', initialCubicleConfig);
    });

    const [editedCubicleConfigData, setEditedCubicleConfigData] = useState<CubicleYamlConfig>(() => {
        return getFromSessionStorage('editedCubicleConfigData', initialCubicleConfig);
    });

    useEffect(() => {
        setToSessionStorage('configData', configData);
    }, [configData]);
    
    useEffect(() => {
        setToSessionStorage('editedConfigData', editedConfigData);
    }, [editedConfigData]);

    useEffect(() => {
        setToSessionStorage('desconConfigMonitor', desconConfigMonitor);
    }, [desconConfigMonitor]);

    useEffect(() => {
        setToSessionStorage('cubicleConfigMonitor', cubicleConfigMonitor);
    }, [cubicleConfigMonitor]);

    useEffect(() => {
        setToSessionStorage('filename', filename);
    }, [filename]);

    useEffect(() => {
        const fetchConfig = async () => {
          try {
            if (uploadedFile) {
              const fileReader = new FileReader();
              fileReader.onload = (event) => {
                const yamlContent = event.target?.result as string;
                const config = yaml.load(yamlContent) as YamlConfig;
                
                const updatedConfig: YamlConfig = {
                  ...config,
                  devices: config.devices.map((deviceConfig) => {
                    // brkr-namesに基づいて新しいcircuits配列を作成
                    const newCircuits = deviceConfig["brkr-names"].map((name, index) => {
                      // 既存のcircuitsから一致する回路を探す
                      const existingCircuit = deviceConfig.circuits.find(c => c.name === name);
                      if (existingCircuit) {
                        // 既存の回路情報がある場合はそれを使用し、keyを更新
                        return { ...existingCircuit, key: index, output: index + 1 };
                      } else {
                        // 既存の回路情報がない場合は新しい回路オブジェクトを作成
                        return {
                          name: name,
                          power: "",
                          breaker: "",
                          wire: "",
                          autotrip: 0,
                          output: index + 1,
                          key: index
                        };
                      }
                    });
                
                    // brkr-names以外の回路（主幹など）を追加
                    const otherCircuits = deviceConfig.circuits.filter(
                      circuit => !deviceConfig["brkr-names"].includes(circuit.name)
                    ).map((circuit, index) => ({
                      ...circuit,
                      key: deviceConfig["brkr-names"].length + index
                    }));
                
                    // 新しいcircuits配列を結合
                    const updatedCircuits = [...newCircuits, ...otherCircuits];
                
                    return {
                      ...deviceConfig,
                      circuits: updatedCircuits,
                    };
                  }),
                };

                setConfigData(updatedConfig);
                setEditedConfigData(updatedConfig);
                
                // セッションストレージに読み取った値を保存
                setToSessionStorage('configData', updatedConfig);
                setToSessionStorage('editedConfigData', updatedConfig);

                // ファイル名は変更しない
              };
              fileReader.readAsText(uploadedFile);
              
            }
          } catch (error) {
            console.error('Failed to load YAML file', error);
          }
        };
    
        fetchConfig();
      }, [uploadedFile]);

      useEffect(() => {
        const fetchConfigMonitor = async () => {
          try {
            if (uploadedFileMonitor) {
              if (!uploadedFileMonitor.name.includes("descon") && !uploadedFileMonitor.name.includes("cubicle")) {
                alert("正しいファイルをアップロードしてください。ファイル名に 'descon' または 'cubicle' を含める必要があります。");
                return; // ファイル名が不適切な場合、処理を中止
              }
      
              const fileReader = new FileReader();
              fileReader.onload = (event) => {
                const yamlContent = event.target?.result as string;
                const config = yaml.load(yamlContent) as YamlConfig;
                
                if (uploadedFileMonitor.name.includes("descon")) {
                  setdesconConfigMonitor(config);
                  setToSessionStorage('desconConfigMonitor', config);
                } else {
                  setcubicleConfigMonitor(config);
                  setToSessionStorage('cubicleConfigMonitor', config);
                }

                // ファイル処理完了後、WebSocketに新しい設定を送信するため、
                // リロードではなく状態更新で対応（WebSocketContextが自動的に新しいデータを送信）
                console.log('監視用設定ファイルが更新されました。WebSocketに新しい設定を送信します。');

              };
              fileReader.readAsText(uploadedFileMonitor);
            }
          } catch (error) {
            console.error('Failed to load YAML file', error);
          }
        };
      
        fetchConfigMonitor();
      }, [uploadedFileMonitor]);

    useEffect(() => {
        setToSessionStorage('cubicleConfigData', cubicleConfigData);
    }, [cubicleConfigData]);
    
    useEffect(() => {
        setToSessionStorage('editedCubicleConfigData', editedCubicleConfigData);
    }, [editedCubicleConfigData]);

    // Cubicle.yaml用のアップロード処理
    useEffect(() => {
        const fetchCubicleConfig = async () => {
          try {
            if (cubicleUploadedFile) {
              const fileReader = new FileReader();
              fileReader.onload = (event) => {
                const yamlContent = event.target?.result as string;
                const config = yaml.load(yamlContent) as CubicleYamlConfig;
                
                setCubicleConfigData(config);
                setEditedCubicleConfigData(config);
                
                // セッションストレージに読み取った値を保存
                setToSessionStorage('cubicleConfigData', config);
                setToSessionStorage('editedCubicleConfigData', config);
              };
              fileReader.readAsText(cubicleUploadedFile);
            }
          } catch (error) {
            console.error('Failed to load YAML file', error);
          }
        };
    
        fetchCubicleConfig();
      }, [cubicleUploadedFile]);

    return (
        <DataContext.Provider value={{ configData, setConfigData, editedConfigData, setEditedConfigData, desconConfigMonitor, setdesconConfigMonitor, cubicleConfigMonitor, setcubicleConfigMonitor, setUploadedFile, setUploadedFileMonitor, 
                                      tempTableData, settempTableData, trackTableData, settrackTableData, currTableData, setcurrTableData, leakTableData, setleakTableData, relayTableData, setrelayTableData, filename, setFilename,
                                      cubicleConfigData, setCubicleConfigData,
                                      editedCubicleConfigData, setEditedCubicleConfigData,
                                      setCubicleUploadedFile
        }}>
            {children}
        </DataContext.Provider>
    );
}