export interface YamlConfig {
  site: string;
  "polling-interval": number;
  "supervisor-ipaddr": string;
  "supervisor-port": number;
  "mqtt-ipaddr": string;
  "mqtt-port": number;
  mails: YamlMailConfig[];
  phones: YamlPhoneConfig[];
  "circuit-names": string[];
  devices: YamlDeviceConfig[];
}

// Cubicle用YAMLの型定義
export interface CubicleYamlConfig {
  site: string;
  "polling-interval": number;
  "supervisor-ipaddr": string;
  "supervisor-port": number;
  "mqtt-ipaddr": string;
  "mqtt-port": number;
  trans: YamlTransConfig[];
}

// トランス設定の型定義
export interface YamlTransConfig {
  name: string;
  "switch-boards": YamlSwitchBoardConfig[];
  overload: YamlOverloadConfig[];
  alert: YamlAlertConfig;
}

// 配電盤設定の型定義
export interface YamlSwitchBoardConfig {
  name: string;
  ipaddr: string;
  curr: number[];
  devices: YamlSwitchBoardDeviceConfig[];
}

// 分電盤設定の型定義
export interface YamlSwitchBoardDeviceConfig {
  name: string;
  ipaddr: string;
}

// 過負荷設定の型定義
export interface YamlOverloadConfig {
  state: string;
  curr: number;
  time: number;
}

// アラート設定の型定義
export interface YamlAlertConfig {
  "controller-ipaddr": string;
  device: string;
  "circuit-no": number;
}

export interface YamlMailConfig {
  "smtp-server": string;
  "smtp-port": number;
  "smtp-user": string;
  "smtp-password": string;
  "smtp-to": string[];
  starttls: string;
}

export interface YamlPhoneConfig {
  "phone-api": string;
  "phone-from": string;
  "phone-to": string[];
  "phone-timeout": number;
  "phone-retries": number;
}

export interface YamlDeviceConfig {
  name: string;
  model: string;
  ipaddr: string;
  port: number;
  circuits: YamlCircuitConfig[];
  "temp-names": string[];
  "track-names": string[];
  "curr-names": string[];
  "leak-names": string[];
  "volt-names": string[];
  "brkr-names": string[];
  "brkr-sens": number[];
  "input-names": string[];
  input: string[];
  brkr: string[];
  temp: string[];
  track: string[];
  curr: string[];
  leak: string[];
  volt: string[];
  time: string[];
  ptc: string[];
}

export interface YamlCircuitConfig {
  name: string;
  power: string;
  breaker: string;
  "breaker-type"?: string;
  wire: string;
  "allowable-temp"?: number;
  autotrip: number;
  output: number;
  key?: number;
}

export interface InputFieldProps {
  label: string;
  value: any;     
  id: string;
  isEditable: boolean;
  onChange: (id: string, value: string) => void;
}

export interface TableRowRelays {
  "sensor-No": number;
  "circuit-name": string;
  power: string;
  breaker: string;
  wire: string;
  "relay-link-to": number;
  "relay-auto-trip": number;
  "brkr-sens-curr": string;
  "brkr-trip-status": string;
}

export interface TableRowTemp {
  "sensor-No": number;
  "circuit-name": string;
  power: string;
  wire: string;
  breaker: string;
  "breaker-type": string;
  "allowable-temp": number;
  phase: string;
  relay: string;
  sensor: string;
  "caution-temp": string;
  "caution-time": string;
  "cutoff-temp": string;
  "cutoff-time": string;
  "imm-cutoff-temp": string;
  "sensor-enabled": string;
}

export interface TableRowTrack {
  "sensor-No": number;
  "circuit-name": string;
  power: string;
  wire: string;
  breaker: string;
  phase: string;
  relay: string;
  "caution-curr": string;
  "caution-count": string;
  "cutoff-curr": string;
  "cutoff-count": string;
}

export interface TableRowOverCurr {
  "sensor-No": number;
  "circuit-name": string;
  power: string;
  wire: string;
  breaker: string;
  phase: string;
  relay: string;
  "caution-curr": string;
  "caution-time": string;
  "cutoff-curr": string;
  "cutoff-time": string;
}

export interface TableRowLeakCurr {
  "sensor-No": number;
  "circuit-name": string;
  power: string;
  wire: string;
  breaker: string;
  relay: string;
  "caution-curr": string;
  "caution-time": string;
  "cutoff-curr": string;
  "cutoff-time": string;
}

// monitoring

export interface DeviceData {
  temperature: Record<number, [string, number][]>;
  tempstate: Record<number, [string, string][]>;
  current: Record<number, [string, number][]>;
  currstate: Record<number, [string, string][]>;
  trackcurrent: Record<number, [string, number][]>;
  trackstate: Record<number, [string, string][]>;
  leakcurrent: Record<number, [string, number][]>;
  leakstate: Record<number, [string, string][]>;
  voltage: Record<number, [string, number][]>;
  voltstate: Record<number, [string, string][]>;
  input: string[];
  inputstate: string[];
  relay: string[];
  num_current: number;
  timestamp: number;
  timestampData: string;
}

export interface WebSocketData {
  [deviceName: string]: DeviceData;
}

export interface TrackingDataEach {
  deviceName: string;
  ch: number;
  peakCurrent: number;
  values: number[];
  timestamp: string;
}

export interface TrackingData {
  trackingData: TrackingDataEach[];
}

export interface WebSocketContextType {
  desconData: WebSocketData;
  cubicleData: WebSocketData;
  trackingData: TrackingData;
  setTrackingData: React.Dispatch<React.SetStateAction<TrackingData>>;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  sendMessage?: (message: string) => Promise<void>;
  deviceSettings: { [deviceName: string]: any };
  setDeviceSettings: React.Dispatch<React.SetStateAction<{ [deviceName: string]: any }>>;
}
