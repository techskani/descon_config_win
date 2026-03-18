import socket
import asyncio
import websockets
import json
import os
import time

# 環境変数を設定して制限を緩和
os.environ["WEBSOCKETS_MAX_LINE_LENGTH"] = "65536"  # 64KB
os.environ["WEBSOCKETS_MAX_NUM_HEADERS"] = "256"
os.environ["WEBSOCKETS_MAX_BODY_SIZE"] = "20971520"  # 20MB

devices = {}
tasks = {}
# 動作中の設定内容を保持するグローバル変数
device_settings = {}
device_current_data = {}

# メインのtaskキャンセル処理と各taskのWebSocket送信処理の排他制御を行う - kotani
lock = asyncio.Lock()

# ----------------------------------------------------------------------
# DeviceSettingsManager
# ----------------------------------------------------------------------
class DeviceSettingsManager:
    """動作中の装置設定を管理するクラス"""
    
    @staticmethod
    def parse_yaml_settings(device_config):
        """YAML設定から設定値を解析"""
        settings = {
            'device_name': device_config.get('name', ''),
            'model': device_config.get('model', ''),
            'ipaddr': device_config.get('ipaddr', ''),
            'port': device_config.get('port', 0),
            'circuits': device_config.get('circuits', []),
            'temp_names': device_config.get('temp-names', []),
            'temp_settings': {},
            'curr_names': device_config.get('curr-names', []),
            'curr_settings': {},
            'track_names': device_config.get('track-names', []),
            'track_settings': {},
            'leak_names': device_config.get('leak-names', []),
            'leak_settings': {},
            'brkr_names': device_config.get('brkr-names', []),
            'brkr_sens': device_config.get('brkr-sens', []),
            'input_names': device_config.get('input-names', []),
            'volt_names': device_config.get('volt-names', [])
        }
        
        # temp設定を解析
        temp_configs = device_config.get('temp', [])
        if temp_configs:
            try:
                # 最初の行がSetValue,200かSetValue,201かで判定
                offset = 0
                if len(temp_configs) > 0 and 'SetValue,200' in temp_configs[0]:
                    # temp[0]: SetValue,200,1=1,2=1,... (チャンネルマッピング)
                    channel_mapping = DeviceSettingsManager.parse_setvalue_line(temp_configs[0])
                    settings['temp_settings']['channel_mapping'] = channel_mapping
                    offset = 1
                
                # temp[offset+0]: SetValue,201,1=0,2=0,... (センサー有効/無効)
                if len(temp_configs) > offset:
                    sensor_config = DeviceSettingsManager.parse_setvalue_line(temp_configs[offset])
                    settings['temp_settings']['sensor_enabled'] = sensor_config
                
                # temp[offset+1]: SetValue,202,1=85.0,2=55.0,... (注意温度)
                if len(temp_configs) > offset + 1:
                    warning_config = DeviceSettingsManager.parse_setvalue_line(temp_configs[offset + 1])
                    settings['temp_settings']['warning_temperatures'] = warning_config
                
                # temp[offset+2]: SetValue,203,1=600,2=600,... (注意判定時間)
                if len(temp_configs) > offset + 2:
                    warning_time_config = DeviceSettingsManager.parse_setvalue_line(temp_configs[offset + 2])
                    settings['temp_settings']['warning_times'] = warning_time_config
                
                # temp[offset+3]: SetValue,204,1=90.0,2=60.0,... (遮断温度)
                if len(temp_configs) > offset + 3:
                    alarm_config = DeviceSettingsManager.parse_setvalue_line(temp_configs[offset + 3])
                    settings['temp_settings']['alarm_temperatures'] = alarm_config
                
                # temp[offset+4]: SetValue,205,1=180,2=180,... (遮断判定時間)
                if len(temp_configs) > offset + 4:
                    alarm_time_config = DeviceSettingsManager.parse_setvalue_line(temp_configs[offset + 4])
                    settings['temp_settings']['alarm_times'] = alarm_time_config
                
                # temp[offset+5]: SetValue,206,1=100.0,2=100.0,... (即遮断温度・未実装)
                if len(temp_configs) > offset + 5:
                    immediate_config = DeviceSettingsManager.parse_setvalue_line(temp_configs[offset + 5])
                    settings['temp_settings']['immediate_thresholds'] = immediate_config
                    
            except Exception as e:
                print(f"温度設定解析エラー {device_config.get('name', '')}: {e}")
        
        # curr設定を解析
        curr_configs = device_config.get('curr', [])
        if curr_configs:
            try:
                # 電流設定の解析 (220-224番)
                if len(curr_configs) > 0:
                    relay_config = DeviceSettingsManager.parse_setvalue_line(curr_configs[0])
                    settings['curr_settings']['relay'] = relay_config
                if len(curr_configs) > 1:
                    warning_current_config = DeviceSettingsManager.parse_setvalue_line(curr_configs[1])
                    settings['curr_settings']['warning_current'] = warning_current_config
                if len(curr_configs) > 2:
                    warning_delay_config = DeviceSettingsManager.parse_setvalue_line(curr_configs[2])
                    settings['curr_settings']['warning_delays'] = warning_delay_config
                if len(curr_configs) > 3:
                    alarm_current_config = DeviceSettingsManager.parse_setvalue_line(curr_configs[3])
                    settings['curr_settings']['alarm_current'] = alarm_current_config
                if len(curr_configs) > 4:
                    alarm_delay_config = DeviceSettingsManager.parse_setvalue_line(curr_configs[4])
                    settings['curr_settings']['alarm_delays'] = alarm_delay_config
            except Exception as e:
                print(f"電流設定解析エラー {device_config.get('name', '')}: {e}")
        
        # track設定を解析
        track_configs = device_config.get('track', [])
        if track_configs:
            try:
                # トラッキング設定の解析 (210-214番)
                if len(track_configs) > 0:
                    relay_config = DeviceSettingsManager.parse_setvalue_line(track_configs[0])
                    settings['track_settings']['relay'] = relay_config
                if len(track_configs) > 1:
                    warning_multiplier_config = DeviceSettingsManager.parse_setvalue_line(track_configs[1])
                    settings['track_settings']['warning_multipliers'] = warning_multiplier_config
                if len(track_configs) > 2:
                    warning_count_config = DeviceSettingsManager.parse_setvalue_line(track_configs[2])
                    settings['track_settings']['warning_count'] = warning_count_config
                if len(track_configs) > 3:
                    alarm_multiplier_config = DeviceSettingsManager.parse_setvalue_line(track_configs[3])
                    settings['track_settings']['alarm_multipliers'] = alarm_multiplier_config
                if len(track_configs) > 4:
                    alarm_count_config = DeviceSettingsManager.parse_setvalue_line(track_configs[4])
                    settings['track_settings']['alarm_count'] = alarm_count_config
            except Exception as e:
                print(f"トラッキング設定解析エラー {device_config.get('name', '')}: {e}")
        
        # leak設定を解析
        leak_configs = device_config.get('leak', [])
        if leak_configs:
            try:
                # 漏電設定の解析 (230-234番)
                if len(leak_configs) > 0:
                    relay_config = DeviceSettingsManager.parse_setvalue_line(leak_configs[0])
                    settings['leak_settings']['relay'] = relay_config
                if len(leak_configs) > 1:
                    warning_current_config = DeviceSettingsManager.parse_setvalue_line(leak_configs[1])
                    settings['leak_settings']['warning_current'] = warning_current_config
                if len(leak_configs) > 2:
                    warning_delay_config = DeviceSettingsManager.parse_setvalue_line(leak_configs[2])
                    settings['leak_settings']['warning_delays'] = warning_delay_config
                if len(leak_configs) > 3:
                    alarm_current_config = DeviceSettingsManager.parse_setvalue_line(leak_configs[3])
                    settings['leak_settings']['alarm_current'] = alarm_current_config
                if len(leak_configs) > 4:
                    alarm_delay_config = DeviceSettingsManager.parse_setvalue_line(leak_configs[4])
                    settings['leak_settings']['alarm_delays'] = alarm_delay_config
            except Exception as e:
                print(f"漏電設定解析エラー {device_config.get('name', '')}: {e}")
        
        # brkr設定を解析
        brkr_configs = device_config.get('brkr', [])
        brkr_sens = device_config.get('brkr-sens', [])
        if brkr_configs or brkr_sens:
            settings['brkr_settings'] = {}
            try:
                # ブレーカー設定の解析 (250番: ブレーカー遮断検知 ON/OFF)
                if brkr_configs and len(brkr_configs) > 0:
                    trip_detection_config = DeviceSettingsManager.parse_setvalue_line(brkr_configs[0])
                    settings['brkr_settings']['trip_detection'] = trip_detection_config
                
                # ブレーカー感度設定を数値リストとして保存
                if brkr_sens:
                    settings['brkr_settings']['sensitivities'] = {i+1: float(sens) for i, sens in enumerate(brkr_sens)}
            except Exception as e:
                print(f"ブレーカー設定解析エラー {device_config.get('name', '')}: {e}")
        
        return settings
    
    @staticmethod
    def parse_setvalue_line(setvalue_line):
        """SetValue行を解析してチャンネル別設定を取得"""
        # "SetValue,202,1=85.0,2=55.0,3=85.0,..." -> {1: 85.0, 2: 55.0, ...}
        try:
            parts = setvalue_line.split(',')
            if len(parts) < 3:
                return {}
            
            channel_settings = {}
            for part in parts[2:]:  # SetValue,202を除く
                if '=' in part:
                    channel, value = part.split('=', 1)
                    try:
                        channel_num = int(channel)
                        # 数値として解析を試行
                        try:
                            # 小数点が含まれている場合はfloat、そうでない場合はintとして解析
                            if '.' in value:
                                numeric_value = float(value)
                            else:
                                numeric_value = int(value)
                            channel_settings[channel_num] = numeric_value
                        except ValueError:
                            # 文字列として保存
                            channel_settings[channel_num] = value
                    except ValueError:
                        continue
            
            return channel_settings
            
        except Exception as e:
            print(f"SetValue行解析エラー: {e}")
            return {}
    
    @staticmethod
    def store_device_settings(device_config):
        """装置設定をグローバル変数に保存"""
        device_name = device_config.get('name', '')
        if device_name:
            settings = DeviceSettingsManager.parse_yaml_settings(device_config)
            device_settings[device_name] = settings
            print(f"✅ 設定保存完了: {device_name} (モデル: {settings.get('model')}, IP: {settings.get('ipaddr')}:{settings.get('port')})")
            return settings
        else:
            print(f"⚠️ 装置名が空のため設定を保存できませんでした")
        return None
    
    @staticmethod
    def get_device_settings(device_name):
        """装置設定を取得"""
        return device_settings.get(device_name, None)
    
    @staticmethod
    def update_current_data(device_name, current_data):
        """現在の測定値を更新"""
        device_current_data[device_name] = current_data
    
    @staticmethod
    def get_current_data(device_name):
        """現在の測定値を取得"""
        return device_current_data.get(device_name, None)

# ----------------------------------------------------------------------
# enhance_device_response：使ってない - kotani
# ----------------------------------------------------------------------
def enhance_device_response(raw_response: str, device_name: str) -> str:
    """
    デバイスレスポンスをExcel仕様書準拠形式に拡張
    実装置が対応していないデータ項目を模擬データで補完
    """
    lines = raw_response.strip().split('\n')
    enhanced_lines = []
    found_data_types = set()
    
    # 既存のデータを処理
    for line in lines:
        line = line.strip()
        if line:
            enhanced_lines.append(line)
            # データ番号を記録
            if ',' in line:
                data_num = line.split(',')[0]
                found_data_types.add(data_num)
    
    # Excel仕様書に基づく不足データを補完
    excel_spec_data = {
        "102": "102,1=0.0,2=0.0,3=0.0,4=0.0",  # 電流データ（T8R0Aは温度特化のため0値）
        "103": "103,1=NORMAL,2=NORMAL,3=NORMAL,4=NORMAL",  # 電流ステータス
        "104": "104,1=0.0,2=0.0,3=0.0,4=0.0",  # トラッキング電流データ
        "105": "105,1=NORMAL,2=NORMAL,3=NORMAL,4=NORMAL",  # トラッキングステータス
        "106": "106,1=0.0",  # 漏洩電流データ
        "107": "107,1=NORMAL",  # 漏電ステータス
        "108": "108,1=OFF,2=OFF",  # 接点情報
        "109": "109,1=NORMAL,2=NORMAL",  # 接点ステータス
        "150": "150,1=OFF,2=OFF,3=OFF",  # リレー情報
        "160": "160,1=0",  # 電流記録数（T8R0Aはトラッキング非対応のため0）
    }
    
    # 不足しているデータを追加（170番の前に挿入）
    final_lines = []
    time_line = None
    
    for line in enhanced_lines:
        if line.startswith("170,"):
            time_line = line
        else:
            final_lines.append(line)
    
    # Excel仕様書準拠の順序でデータを追加
    data_order = ["100", "101", "102", "103", "104", "105", "106", "107", "108", "109", "150", "160"]
    
    for data_num in data_order:
        # 既存データがある場合はそのまま、ない場合は補完データを追加
        existing_line = None
        for line in final_lines:
            if line.startswith(f"{data_num},"):
                existing_line = line
                break
        
        if not existing_line and data_num in excel_spec_data:
            final_lines.append(excel_spec_data[data_num])
    
    # 最後に170番（時刻）を追加
    if time_line:
        final_lines.append(time_line)
    
    return '\n'.join(final_lines)

# ----------------------------------------------------------------------
# send_setvaluerequest_command：使ってない - kotani
# ----------------------------------------------------------------------
async def send_setvaluerequest_command(device, setvalue_number):
    """リモート装置にSetValueRequestコマンドを送信して設定値を読み出す"""
    host = device["ipaddr"]
    port = device["port"]
    device_name = device["name"]
    
    try:
        print(f"📖 [{device_name}] SetValueRequest送信開始: SetValue番号={setvalue_number}")
        
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            try:
                print(f"  🔌 [{device_name}] 接続開始: {host}:{port}")
                s.connect((host, port))
                print(f"  ✅ [{device_name}] 接続成功")
            except Exception as conn_error:
                print(f"  ❌ [{device_name}] 接続失敗: {conn_error}")
                return None
            
            # SetValueRequestコマンドを構築
            command = f"SetValueRequest,{setvalue_number}"
            command_with_terminator = command + "\r\n"
            command_bytes = command_with_terminator.encode('utf-8')
            
            print(f"  📤 [{device_name}] 送信: {command}")
            s.sendall(command_bytes)
            
            # 応答を受信
            s.settimeout(10.0)
            try:
                response = s.recv(4096).decode('utf-8', errors='ignore').strip()
                print(f"  📥 [{device_name}] 受信: {response}")
                return response
            except socket.timeout:
                print(f"  ⏱️ [{device_name}] タイムアウト: 応答なし")
                return None
            except Exception as recv_error:
                print(f"  ❌ [{device_name}] 受信エラー: {recv_error}")
                return None
                
    except Exception as e:
        print(f"❌ [{device_name}] SetValueRequest失敗: {e}")
        return None

# ----------------------------------------------------------------------
# sndsetval_common：send_setvalue_to_remoteから共通部分を抽出 - kotani
# ----------------------------------------------------------------------
async def sndsetval_common(sock, device_name, commands, setting_key_map, max_channels, current_settings):
    """リモート装置にSetValueコマンドを送信して設定を更新（共通部分）"""
    successful_commands = []
    failed_commands = []

    # ------------------------------------------------------------
    # まず現在のリモート装置の設定を取得（受信データベース方式）
    # ------------------------------------------------------------
    print(f"  📖 [{device_name}] リモート装置から現在の設定を取得中...")
    current_remote_settings = {}
    
    for setvalue_num in commands:
        try:
            # SetValueRequestで現在の値を取得
            request_cmd = f"SetValueRequest,{setvalue_num}\r\n"
            sock.sendall(request_cmd.encode('utf-8'))
            
            # レスポンスを受信（改行ごとに処理）
            sock.settimeout(5.0)
            buffer = b''
            received_target = False
            
            # ------------------------------------------------------------
            # 受信ループ
            # ------------------------------------------------------------
            while not received_target:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                buffer += chunk
                
                # 改行ごとに処理
                while b'\n' in buffer:
                    line_bytes, buffer = buffer.split(b'\n', 1)
                    line = line_bytes.decode('utf-8', errors='ignore').strip()
                    
                    if not line:
                        continue
                    
                    # 対象のSetValue行を検出
                    if line.startswith(f'{setvalue_num},'):
                        # "202,1=59.0,2=61.0,..." 形式
                        parts = line.split(',')
                        # parts[0] = setvalue_num, parts[1:]が値
                        current_remote_settings[setvalue_num] = parts[1:]
                        received_target = True
                        break
            
            await asyncio.sleep(0.2)
        except Exception as e:
            print(f"  ⚠️ [{device_name}] SetValue,{setvalue_num} 現在値取得失敗: {e}")
            return successful_commands, failed_commands         # kotani
    
    print(f"  ✅ [{device_name}] 現在の設定取得完了（{len(current_remote_settings)}ブロック）")
    
    # ------------------------------------------------------------
    # 取得した現在値をベースに、変更箇所だけ上書きして送信
    # ------------------------------------------------------------
    for setvalue_num in commands:
        setting_key = setting_key_map.get(setvalue_num)
        if setting_key in current_settings:
            setting_data = current_settings[setting_key]
            
            # 現在のリモート装置の値を取得（key=value形式）
            if setvalue_num in current_remote_settings:
                current_values = current_remote_settings[setvalue_num]
                # key=value形式から値だけ抽出
                values = []
                for kv in current_values:
                    if '=' in kv:
                        values.append(kv.split('=')[1])
                    else:
                        values.append(kv)
                
                # デバッグ: 現在値の状態をログ出力
                if setvalue_num == commands[2]:
                    print(f"  🔍 [{device_name}] SetValue,{command[2]} デバッグ:")
                    print(f"    current_values 件数: {len(current_values)}")
                    print(f"    current_values 最初の3件: {current_values[:3]}")
                    print(f"    values 件数: {len(values)}")
                    print(f"    values 最初の3件: {values[:3]}")
                
                # フロントエンドから送信された変更箇所を上書き
                for ch in range(1, min(len(values) + 1, max_channels + 1)):
                    new_value = setting_data.get(ch, setting_data.get(str(ch)))
                    if new_value is not None:
                        values[ch - 1] = str(new_value)
                
                # key=value形式で再構築
                pairs = [f'{i+1}={v}' for i, v in enumerate(values)]
                
                # デバッグ: 構築後の状態をログ出力
                if setvalue_num == commands[2]:
                    print(f"    pairs 件数: {len(pairs)}")
                    print(f"    pairs 最初の3件: {pairs[:3]}")
                
                command = f"SetValue,{setvalue_num},{','.join(pairs)}"
            else:
                # 現在値が取得できなかった場合は従来通り
                values = []
                for ch in range(1, 45):
                    value = setting_data.get(ch, setting_data.get(str(ch), 0))
                    values.append(str(value))
                pairs = [f'{i+1}={v}' for i, v in enumerate(values)]
                command = f"SetValue,{setvalue_num},{','.join(pairs)}"
            
            command_with_terminator = command + "\r\n"
            command_bytes = command_with_terminator.encode('utf-8')
            
            try:
                # バッファをクリア（前のコマンドの残りデータを破棄）
                sock.settimeout(0.1)
                # ------------------------------------------------------------
                # 受信ループ
                # ------------------------------------------------------------
                try:
                    while True:
                        discard = sock.recv(4096)
                        if not discard:
                            break
                except socket.timeout:
                    pass
                
                # 最初の3値をログに出力
                sample_pairs = pairs[:3]
                print(f"  📤 [{device_name}] 送信: SetValue,{setvalue_num} (データ長:{len(pairs)}, 最初の3値:{','.join(sample_pairs)})")
                sock.sendall(command_bytes)
                
                # 送信後、少し待機してからレスポンスを受信
                await asyncio.sleep(0.3)
                
                # 応答を受信（複数行の可能性があるため、OKまたはNGを探す）
                sock.settimeout(2.0)
                buffer = b''
                found_ok = False
                found_ng = False
                
                try:
                    # ------------------------------------------------------------
                    # 受信ループ
                    # ------------------------------------------------------------
                    # 最大2秒間データを受信
                    start_time = asyncio.get_event_loop().time()
                    while (asyncio.get_event_loop().time() - start_time) < 2.0:
                        try:
                            sock.settimeout(0.5)
                            chunk = sock.recv(4096)
                            if chunk:
                                buffer += chunk
                                response_str = buffer.decode('utf-8', errors='ignore')
                                
                                # OKまたはNGを探す
                                if 'OK' in response_str.upper():
                                    found_ok = True
                                    break
                                if 'NG' in response_str.upper():
                                    found_ng = True
                                    break
                        except socket.timeout:
                            # タイムアウトしたら次のループへ
                            continue
                        except:
                            break
                except:
                    pass
                
                response = buffer.decode('utf-8', errors='ignore').strip()
                # 最初の200文字だけログに出力
                response_preview = response[:200] + ('...' if len(response) > 200 else '')
                print(f"  📥 [{device_name}] 受信: {response_preview}")
                
                if found_ok or (not found_ng and len(response) == 0):
                    successful_commands.append(f"SetValue,{setvalue_num}")
                    print(f"  ✅ [{device_name}] SetValue,{setvalue_num} 設定成功")
                elif found_ng:
                    failed_commands.append(f"SetValue,{setvalue_num}")
                    print(f"  ❌ [{device_name}] SetValue,{setvalue_num} 設定失敗: NG")
                else:
                    # OKもNGもない場合は成功と判定（リモート装置が異常なレスポンスを返す場合）
                    successful_commands.append(f"SetValue,{setvalue_num}")
                    print(f"  ✅ [{device_name}] SetValue,{setvalue_num} 設定成功（応答不明、正常と判定）")
                
                await asyncio.sleep(0.5)
                
            except Exception as cmd_error:
                failed_commands.append(f"SetValue,{setvalue_num}")
                print(f"  ❌ [{device_name}] SetValue,{setvalue_num} 送信エラー: {cmd_error}")
                return successful_commands, failed_commands         # kotani

    return successful_commands, failed_commands                     # kotani

# ----------------------------------------------------------------------
# send_setvalue_to_remote
# ----------------------------------------------------------------------
async def send_setvalue_to_remote(device, temp_settings, track_settings, curr_settings, leak_settings=None, brkr_settings=None, device_model=None):
    """リモート装置にSetValueコマンドを送信して設定を更新"""
    host = device["ipaddr"]
    port = device["port"]
    device_name = device["name"]
    
    # モデルごとのチャンネル数を決定
    if device_model == 'T28C16R8I1':                # DESCON動力盤
        max_temp_channels = 48                      # 16回路 x 3相
        max_track_curr_channels = 16                # 16回路
        max_brkr_channels = 8                       # 8回路
        max_leak_curr_channels = 1                  # kotani

    elif device_model == 'T64C30B30I1':             # DESCON電灯盤 / ホーム分電盤30回路
        max_temp_channels = 60                      # 30回路 x 2相
        max_track_curr_channels = 30                # 30回路
        max_brkr_channels = 30                      # 30回路
        max_leak_curr_channels = 1                  # kotani

    elif device_model == 'T44C20B20':               # ホーム分電盤20回路 / ホーム分電盤40回路 - kotani
        max_temp_channels = 44                      # 20回路 x 2相 + 4（主幹など）
        max_track_curr_channels = 20                # 20回路
        max_brkr_channels = 20                      # 20回路
        max_leak_curr_channels = 1                  # kotani

    else:                                           # T24C10B10A - kotani
        max_temp_channels = 24                      # 10回路 x 2相 + 4（主幹など）
        max_track_curr_channels = 10                # 10回路
        max_brkr_channels = 10                      # 10回路
        max_leak_curr_channels = 1                  # kotani
    
    successful_commands = []
    failed_commands = []
    
    try:
        print(f"🔧 [{device_name}] リモート装置への設定送信開始")
        
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(20.0)
            try:
                print(f"  🔌 [{device_name}] 接続開始: {host}:{port}")
                sock.connect((host, port))
                print(f"  ✅ [{device_name}] 接続成功")
            except Exception as conn_error:
                print(f"  ❌ [{device_name}] 接続失敗: {conn_error}")
                return {
                    "success": 0,
                    "failed": 0,
                    "error": str(conn_error),
                    "successful_commands": [],
                    "failed_commands": []
                }
            
            # ------------------------------------------------------------
            # SetValue,200-206 (温度設定)を送信
            # ------------------------------------------------------------
            if temp_settings:
                commands = [200, 201, 202, 203, 204, 205, 206]
                setting_key_map = {
                    200: 'channel_mapping',
                    201: 'sensor_enabled',
                    202: 'warning_temperatures',
                    203: 'warning_times',
                    204: 'alarm_temperatures',
                    205: 'alarm_times',
                    206: 'immediate_thresholds'
                }
                oks, ngs = sndsetval_common(sock, device_name, commands, setting_key_map, max_temp_channels, temp_settings)
                successful_commands += oks
                failed_commands += ngs

            # ------------------------------------------------------------
            # SetValue,210-214 (トラッキング設定)を送信
            # ------------------------------------------------------------
            if track_settings:
                commands = [210, 211, 212, 213, 214]
                setting_key_map = {
                    210: 'relay',
                    211: 'warning_current',
                    212: 'warning_count',
                    213: 'alarm_current',
                    214: 'alarm_count'
                }
                oks, ngs = sndsetval_common(sock, device_name, commands, setting_key_map, max_track_curr_channels, track_settings)
                successful_commands += oks
                failed_commands += ngs
            
            # ------------------------------------------------------------
            # SetValue,220-224 (過電流設定)を送信
            # ------------------------------------------------------------
            if curr_settings:
                commands = [220, 221, 222, 223, 224]
                setting_key_map = {
                    220: 'relay',
                    221: 'warning_current',
                    222: 'warning_delays',
                    223: 'alarm_current',
                    224: 'alarm_delays'
                }
                oks, ngs = sndsetval_common(sock, device_name, commands, setting_key_map, max_track_curr_channels, curr_settings)
                successful_commands += oks
                failed_commands += ngs

            # ------------------------------------------------------------
            # SetValue,230-234 (漏洩電流設定)を送信
            # ------------------------------------------------------------
            if leak_settings:
                commands = [230, 231, 232, 233, 234]
                setting_key_map = {
                    230: 'relay',
                    231: 'warning_current',
                    232: 'warning_delays',
                    233: 'alarm_current',
                    234: 'alarm_delays'
                }
                oks, ngs = sndsetval_common(sock, device_name, commands, setting_key_map, max_leak_curr_channels, leak_settings)
                successful_commands += oks
                failed_commands += ngs
            
            # ------------------------------------------------------------
            # SetValue,250 (ブレーカー遮断検知設定)を送信
            # ------------------------------------------------------------
            if brkr_settings:
                commands = [250]
                setting_key_map = {
                    250: 'trip_detection'
                }
                oks, ngs = sndsetval_common(sock, device_name, commands, setting_key_map, max_brkr_channels, brkr_settings)
                successful_commands += oks
                failed_commands += ngs
            
            print(f"🎉 [{device_name}] リモート装置への設定送信完了 - 成功: {len(successful_commands)}, 失敗: {len(failed_commands)}")
            
            return {
                "success": len(successful_commands),
                "failed": len(failed_commands),
                "successful_commands": successful_commands,
                "failed_commands": failed_commands
            }
            
    except Exception as e:
        print(f"❌ [{device_name}] リモート装置への設定送信失敗: {e}")
        return {
            "success": 0,
            "failed": 0,
            "error": str(e),
            "successful_commands": [],
            "failed_commands": []
        }

# ----------------------------------------------------------------------
# send_setvalue_commands：リモート装置の旧モデル用 - kotani
# ----------------------------------------------------------------------
async def send_setvalue_commands(device, temp_settings):
    """DESCON装置にSetValueコマンドを送信して設定を更新（受信データベース方式）"""
    host = device["ipaddr"]
    port = device["port"]
    device_name = device["name"]
    
    # デフォルトのチャンネル数（T8R0A想定）
    max_temp_channels = 8
    
    try:
        print(f"🔧 {device_name} への設定送信開始")
        
        # DataRequestと同じ方式で接続を試行
        # 既存の監視接続がある場合は少し待つ
        await asyncio.sleep(0.5)
        
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            # 無線接続やデバッグ中の装置のため、タイムアウトを延長
            s.settimeout(20.0)
            try:
                s.connect((host, port))
                print(f"✅ {device_name} に設定変更用接続成功")
            except ConnectionRefusedError:
                print(f"⚠️ {device_name} への直接接続が拒否されました。装置が設定変更を受け付けない可能性があります。")
                return {
                    "success": 0,
                    "failed": 5,
                    "error": "Device does not support configuration changes via TCP connection",
                    "successful_commands": [],
                    "failed_commands": ["SetValue,202", "SetValue,203", "SetValue,204", "SetValue,205", "SetValue,206"],
                    "note": "This device may only support read-only operations."
                }
            
            # ------------------------------------------------------------
            # まず現在のリモート装置の設定を取得（受信データベース方式）
            # ------------------------------------------------------------
            print(f"  📖 [{device_name}] リモート装置から現在の設定を取得中...")
            current_remote_settings = {}
            
            for setvalue_num in [202, 203, 204, 205, 206]:
                try:
                    request_cmd = f"SetValueRequest,{setvalue_num}\r\n"
                    s.sendall(request_cmd.encode('utf-8'))
                    
                    s.settimeout(5.0)
                    buffer = b''
                    received_target = False
                    
                    # ------------------------------------------------------------
                    # 受信ループ
                    # ------------------------------------------------------------
                    while not received_target:
                        chunk = s.recv(4096)
                        if not chunk:
                            break
                        buffer += chunk
                        
                        while b'\n' in buffer:
                            line_bytes, buffer = buffer.split(b'\n', 1)
                            line = line_bytes.decode('utf-8', errors='ignore').strip()
                            
                            if not line:
                                continue
                            
                            if line.startswith(f'{setvalue_num},'):
                                parts = line.split(',')
                                current_remote_settings[setvalue_num] = parts[1:]
                                received_target = True
                                break
                    
                    await asyncio.sleep(0.2)
                except Exception as e:
                    print(f"  ⚠️ [{device_name}] SetValue,{setvalue_num} 現在値取得失敗: {e}")
            
            print(f"  ✅ [{device_name}] 現在の設定取得完了（{len(current_remote_settings)}ブロック）")
            
            # ------------------------------------------------------------
            # 取得した現在値をベースに、変更箇所だけ上書きして送信
            # ------------------------------------------------------------
            successful_commands = []
            failed_commands = []
            
            setting_key_map = {
                202: 'warning_temperatures',
                203: 'warning_times',
                204: 'alarm_temperatures',
                205: 'alarm_times',
                206: 'immediate_thresholds'
            }
            
            for setvalue_num in [202, 203, 204, 205, 206]:
                setting_key = setting_key_map.get(setvalue_num)
                if setting_key in temp_settings:
                    setting_data = temp_settings[setting_key]
                    
                    # 現在のリモート装置の値を取得（key=value形式）
                    if setvalue_num in current_remote_settings:
                        current_values = current_remote_settings[setvalue_num]
                        
                        # デバッグ: 現在値の状態をログ出力
                        if setvalue_num == 202:
                            print(f"  🔍 [{device_name}] SetValue,202 デバッグ:")
                            print(f"    current_values 型: {type(current_values)}")
                            print(f"    current_values 件数: {len(current_values)}")
                            print(f"    current_values 最初の5件: {current_values[:5]}")
                        
                        # key=value形式から値だけ抽出
                        values = []
                        for kv in current_values:
                            if '=' in kv:
                                values.append(kv.split('=')[1])
                            else:
                                values.append(kv)
                        
                        # デバッグ: 抽出後の状態をログ出力
                        if setvalue_num == 202:
                            print(f"    values 件数: {len(values)}")
                            print(f"    values 最初の5件: {values[:5]}")
                        
                        # フロントエンドから送信された変更箇所を上書き
                        for ch in range(1, min(len(values) + 1, max_temp_channels + 1)):
                            new_value = setting_data.get(ch, setting_data.get(str(ch)))
                            if new_value is not None:
                                values[ch - 1] = str(new_value)
                        
                        # デバッグ: 構築後の状態をログ出力
                        if setvalue_num == 202:
                            print(f"    更新後 values 件数: {len(values)}")
                            print(f"    更新後 values 最初の5件: {values[:5]}")
                        
                        # key=value形式で再構築
                        pairs = [f'{i+1}={v}' for i, v in enumerate(values)]
                        
                        # デバッグ: 最終構築状態をログ出力
                        if setvalue_num == 202:
                            print(f"    pairs 件数: {len(pairs)}")
                            print(f"    pairs 最初の5件: {pairs[:5]}")
                        
                        command = f"SetValue,{setvalue_num},{','.join(pairs)}"
                    else:
                        # 現在値が取得できなかった場合は従来通り（8チャンネル）
                        temp_values = []
                        for i in range(1, 9):
                            value = setting_data.get(i, setting_data.get(str(i), '0'))
                            temp_values.append(f"{i}={value}")
                        command = f"SetValue,{setvalue_num},{','.join(temp_values)}"
                    
                    try:
                        command_with_terminator = command + "\r\n\r\n"
                        command_hex = command_with_terminator.encode('utf-8').hex()
                        command_bytes = bytes.fromhex(command_hex)
                        
                        s.sendall(command_bytes)
                        print(f"📤 送信: {command} (hex: {command_hex[:50]}...)")
                        
                        s.settimeout(10.0)
                        try:
                            response = s.recv(1024).decode('utf-8', errors='ignore').strip()
                            print(f"📥 応答: {response}")
                            
                            if "OK" in response.upper() or "ACK" in response.upper() or "SUCCESS" in response.upper() or len(response) == 0:
                                successful_commands.append(command)
                                print(f"✅ SetValue,{setvalue_num} 設定成功")
                            else:
                                failed_commands.append(command)
                                print(f"❌ SetValue,{setvalue_num} 設定失敗: {response}")
                        except socket.timeout:
                            successful_commands.append(command)
                            print(f"✅ SetValue,{setvalue_num} 設定完了（応答なし、正常と判定）")
                        
                        await asyncio.sleep(0.5)
                        
                    except Exception as cmd_error:
                        failed_commands.append(command)
                        print(f"❌ SetValue,{setvalue_num} 送信エラー: {cmd_error}")
            
            print(f"📊 設定送信結果 - 成功: {len(successful_commands)}, 失敗: {len(failed_commands)}")
            
            return {
                "success": len(successful_commands),
                "failed": len(failed_commands),
                "successful_commands": successful_commands,
                "failed_commands": failed_commands
            }
            
    except Exception as e:
        print(f"❌ {device_name} への設定送信失敗: {e}")
        return {
            "success": 0,
            "failed": 5,
            "error": str(e),
            "successful_commands": [],
            "failed_commands": []
        }

# ----------------------------------------------------------------------
# send_setvalue_request_to_remote
# ----------------------------------------------------------------------
async def send_setvalue_request_to_remote(device, setvalue_numbers):
    """リモート装置にSetValueRequestコマンドを送信して現在の設定を取得"""
    host = device["ipaddr"]
    port = device["port"]
    device_name = device["name"]
    
    retrieved_settings = {}
    
    try:
        print(f"🔍 [{device_name}] リモート装置からの設定読み出し開始")
        
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(20.0)
            try:
                print(f"  🔌 [{device_name}] 接続開始: {host}:{port}")
                s.connect((host, port))
                print(f"  ✅ [{device_name}] 接続成功")
            except Exception as conn_error:
                print(f"  ❌ [{device_name}] 接続失敗: {conn_error}")
                return None
            
            # ------------------------------------------------------------
            # 各SetValueブロックIDを個別にリクエスト
            # ------------------------------------------------------------
            for setvalue_num in setvalue_numbers:
                command = f"SetValueRequest,{setvalue_num}"
                command_with_terminator = command + "\r\n"
                command_bytes = command_with_terminator.encode('utf-8')
                
                try:
                    print(f"  📤 [{device_name}] 送信: SetValueRequest,{setvalue_num}")
                    s.sendall(command_bytes)
                    
                    # レスポンスを受信（改行ごとに処理）
                    s.settimeout(10.0)  # タイムアウトを10秒に延長
                    buffer = b''
                    received_lines = []
                    
                    try:
                        # ------------------------------------------------------------
                        # 受信ループ
                        # ------------------------------------------------------------
                        # タイムスタンプ行（270,）が来るまで、またはタイムアウトまで受信
                        timestamp_received = False
                        while not timestamp_received:
                            chunk = s.recv(4096)
                            if not chunk:
                                break
                            buffer += chunk
                            
                            # 改行ごとに処理
                            while b'\n' in buffer:
                                line_bytes, buffer = buffer.split(b'\n', 1)
                                line = line_bytes.decode('utf-8', errors='ignore').strip()
                                
                                if not line:
                                    continue
                                
                                received_lines.append(line)
                                
                                # タイムスタンプ行が来たら終了
                                if line.startswith('270,'):
                                    timestamp_received = True
                                    break
                        
                        # 受信した全行から目的のSetValue行を抽出
                        for line in received_lines:
                            # 対象のSetValue行を検出（例：231,1=3.0）
                            if line.startswith(f'{setvalue_num},'):
                                # "231,1=3.0" 形式
                                full_line = f"SetValue,{line}"
                                channel_data = DeviceSettingsManager.parse_setvalue_line(full_line)
                                retrieved_settings[setvalue_num] = channel_data
                                # 先頭3チャンネルの値をサンプル表示
                                sample_values = {k: channel_data[k] for k in list(channel_data.keys())[:3] if k in channel_data}
                                print(f"  ✅ [{device_name}] SetValue,{setvalue_num} 取得成功 (チャンネル数:{len(channel_data)}, サンプル:{sample_values})")
                                break
                            # または "SetValue,231,1=3.0" 形式
                            elif line.startswith(f'SetValue,{setvalue_num},'):
                                channel_data = DeviceSettingsManager.parse_setvalue_line(line)
                                retrieved_settings[setvalue_num] = channel_data
                                sample_values = {k: channel_data[k] for k in list(channel_data.keys())[:3] if k in channel_data}
                                print(f"  ✅ [{device_name}] SetValue,{setvalue_num} 取得成功 (チャンネル数:{len(channel_data)}, サンプル:{sample_values})")
                                break
                        
                        # 目的のデータが見つからなかった場合
                        if setvalue_num not in retrieved_settings:
                            print(f"  ⚠️ [{device_name}] SetValue,{setvalue_num} が応答に含まれていません")
                    
                    except socket.timeout:
                        if setvalue_num not in retrieved_settings:
                            print(f"  ⏱️ [{device_name}] SetValue,{setvalue_num} 応答タイムアウト")
                    
                    # リクエスト間の待機時間
                    await asyncio.sleep(0.3)
                    
                except Exception as cmd_error:
                    print(f"  ❌ [{device_name}] SetValueRequest,{setvalue_num} 送信エラー: {cmd_error}")
            
            print(f"🎉 [{device_name}] リモート装置からの設定読み出し完了 - 取得数: {len(retrieved_settings)}/{len(setvalue_numbers)}")
            
            return retrieved_settings if retrieved_settings else None
            
    except Exception as e:
        print(f"❌ [{device_name}] リモート装置からの設定読み出し失敗: {e}")
        return None

# ----------------------------------------------------------------------
# generate_tracking_record_response
# ----------------------------------------------------------------------
def generate_tracking_record_response(device_name: str, channel: int = 1) -> str:
    """
    TrackingRecordRequest用の301番レスポンス生成（Excel仕様書準拠）
    """
    import time
    import random
    
    # 50%の確率でエラー応答（実際の挙動を模擬）
    if random.random() < 0.5:
        error_types = ["MEMORYFULL", "NG"]
        error = random.choice(error_types)
        return f"ERROR:{error}"
    
    # 正常な301番レスポンス
    current_time = int(time.time())
    peak_current = round(random.uniform(50.0, 300.0), 1)  # 50-300Aの範囲でランダム
    
    # 模擬記録データ（20ポイント）
    tracking_data = [f"{random.uniform(-10.0, 10.0):.1f}" for _ in range(20)]
    
    response = f"301,{channel},{peak_current},{current_time}," + ",".join(tracking_data)
    return response

# ----------------------------------------------------------------------
# fetch_device_data
# ----------------------------------------------------------------------
async def fetch_device_data(device, websocket, request_type="DataRequest"):
    global lock
    host = device["ipaddr"]
    port = device["port"]
    device_name = device["name"]
    recv_total_timeout = 60.0                                                               # トータル受信タイムアウト値
    sock_timeout = 3.5
    
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        connected = False
        s.settimeout(sock_timeout)                                                      # ソケット・タイムアウトを設定

        # ------------------------------------------------------------
        # メイン・ループ - kotani
        # ------------------------------------------------------------
        while True:
            try:
                # このタスクの実行中はソケットを接続したままにしておく - kotani
                if not connected:
                    s.connect((host, port))
                    connected = True
                    print(f"Connected to {host} on port {port}: {device_name}")
                    
                # 接続が未確立のときは60秒待って次の接続を試行 - kotani
                if not connected:
                    print(f"Retry connection to {host} on port {port}: {device_name}")
                    await asyncio.sleep(60)
                    continue

                byte_data = f"{request_type}\r\n\r\n".encode()
                s.sendall(byte_data)
                # デバッグの邪魔なので止めておく - kotani (2025/11/26)
                #print(f"Sent: {byte_data} to {device_name}")

                # ------------------------------------------------------------
                # 受信ループ - kotani
                # ------------------------------------------------------------
                buffer = b''                                                                            # 受信バッファをリセット
                recv_block_time = 0.0
                while True:
                    try:
                        chunk = s.recv(1024)

                    # 受信タイムアウト処理 - kotani
                    except socket.timeout:
                        # トータル受信タイムアウト発生時は受信ループを抜ける - kotani
                        recv_block_time += sock_timeout                                     # 受信ブロック時間を更新
                        if recv_block_time >= recv_total_timeout:
                            print(f"Receive timeout for device: {device_name}: {response_text}")
                            break
                        await asyncio.sleep(0)                                                      # 次の受信の前にタスク切り替えを促す
                        continue

                    # 接続の正常終了時はEOFを受信する - kotani
                    if not chunk:
                        print(f"Got EOF data for {device_name}: request: {request_type}")
                        return                                                                      # タスク終了
                    recv_block_time = 0.0                                                   # 受信したのでリセット
                    buffer += chunk

                    # 共通のエラー処理 - kotani
                    end_of_data = True if (len(buffer) >= 4 and buffer[-4:] == b'\r\n\r\n')  else False
                    response_text = buffer.decode()
                    if response_text.startswith("NG") or response_text.startswith("MEMORYFULL"):
                        print(f"ERROR: {device_name} returned error for {request_type}: {response_text}")
                        # エラー応答をフロントエンドに送信
                        if websocket.open:                                                      # websocketの状態をチェック - kotani
                            async with lock:                                                    # 送信中のキャンセルを防ぐ - kotani
                                await websocket.send(f"{device_name}:ERROR:{response_text}")
                        else:
                            print(f"ERROR: {device_name} cannot send ERROR message")
                        break

                    # TrackingRecordRequestの処理 - kotani
                    if request_type == "TrackingRecordRequest" and end_of_data:
                        if b"301,"  in buffer:                                                  # 応答のレコード(301)があるか？
                            print(f"TrackingRecordRequest completed for {device_name}, switching to DataRequest")
                            if websocket.open:                                                  # websocketの状態をチェック - kotani
                                async with lock:                                                # 送信中のキャンセルを防ぐ - kotani
                                    await websocket.send(f"{device_name}:{response_text}")
                            else:
                                print(f"ERROR: {device_name} cannot send Tracking data")
                            print(f"Received complete tracking response for {device_name}: {len(response_text.split())} data items")
                            break
                        else:
                            print(f"Received bad tracking response for {device_name}: {response_text}")
                            buffer = b''                                                        # 不正なデータを破棄し次のデータを受信

                    # DataRequestの処理 - kotani
                    elif request_type == "DataRequest" and end_of_data:
                        if b"170,"  in buffer:                                              # 応答の最後のレコード(170)があるか？
                            # 現在の測定値を保存
                            DeviceSettingsManager.update_current_data(device_name, response_text)
                            if websocket.open:                                                  # websocketの状態をチェック - kotani
                                async with lock:                                                # 送信中のキャンセルを防ぐ - kotani
                                    await websocket.send(f"{device_name}:{response_text}")
                            else:
                                print(f"ERROR: {device_name} cannot send DataRequest response")
                            # デバッグの邪魔なので止めておく - kotani (2025/11/26)
                            #print(f"Received complete response for {device_name}: {len(response_text.split())} data items")
                            break
                        else:
                            print(f"Received bad data response for {device_name}: {response_text}")
                            buffer = b''                                                    # 不正なデータを破棄し次のデータを受信

                    # ------------------------------------------------------------
                    # 受信ループの末尾 - kotani
                    # ------------------------------------------------------------
                    await asyncio.sleep(0)                                              # 次の受信の前にタスク切り替えを促す

                # ------------------------------------------------------------
                # 受信ループからbreakで抜けると、ここへ来る - kotani
                # ------------------------------------------------------------
                if request_type == "TrackingRecordRequest":
                    request_type = "DataRequest"                                    # 次回リクエストを切り替える
                await asyncio.sleep(1)                                                  # 1秒待って次のリクエストを送信

            except ConnectionRefusedError as e:
                print(f"Connection refused for device {device_name} at {host}:{port}: {e}")
                await asyncio.sleep(60)                                                 # 60秒待って次のリクエストを送信

            except socket.error as e:
                print(f"Socket error with device {device_name}: {e}")
                await asyncio.sleep(60)                                                 # 60秒待って次のリクエストを送信

            except websockets.exceptions.ConnectionClosedError as e:
                print(f"WebSocket connection closed (Error) for device {device_name}: {e}")
                return                                                                              # タスク終了

            except websockets.exceptions.ConnectionClosedOK as e:
                print(f"WebSocket connection closed (OK) for device {device_name}: {e}")
                return                                                                              # タスク終了

            except asyncio.CancelledError:                                              # タスク終了
                print(f"Task canceled with device {device_name}")
                raise                                                                               # 例外を再送出する

            except Exception as e:
                print(f"An unexpected error occurred with device {device_name}: {e}")
                await asyncio.sleep(60)                                                 # 60秒待って次のリクエストを送信

# ----------------------------------------------------------------------
# websocket_handler
# ----------------------------------------------------------------------
async def websocket_handler(websocket):
    global devices, tasks, lock

    # ------------------------------------------------------------
    # メイン・ループ
    # ------------------------------------------------------------
    while True:
        try:
            message = await websocket.recv()
            data = json.loads(message)
            print(data)
            if "devices" in data:
                # ------------------------------------------------------------
                # 既存の処理：クライアントからの初期データ(allDevicesData)を受け取る
                # ------------------------------------------------------------
                print(f"📥 設定ファイル受信: {len(data['devices'])} 台のデバイス")
                devices = {device["name"]: device for device in data["devices"]}
                
                # 各装置の設定をDeviceSettingsManagerに保存
                for device in data["devices"]:
                    DeviceSettingsManager.store_device_settings(device)
                
                print(f"✅ 全デバイスの設定保存完了。保存済みデバイス一覧: {list(device_settings.keys())}")
                await websocket.send(json.dumps({"status": "Config data received"}))
                
                # 既存のタスクをキャンセル
                for task in tasks.values():
                    async with lock:                                                                                                    # キャンセル中の送信を防ぐ - kotani
                        task.cancel()
                # キャンセルの処理が完了するのを待つ - kotani
                for device_name, task in tasks.items():
                    try:
                        await task
                    except asyncio.CancelledError:
                        print(f"Task canceled on caller side for {device_name}")
                await asyncio.sleep(0)                                                                                              # タスク生成の前にイベントループに制御を戻す
                
                # 新しいタスクを作成
                tasks = {device_name: asyncio.create_task(fetch_device_data(device, websocket)) for device_name, device in devices.items()}

            # ------------------------------------------------------------
            # request_typeによって処理を下の(1)～(3）に分岐させる
            # ------------------------------------------------------------
            elif "request_type" in data:
                request_type = data["request_type"]
                
                # IPアドレスとポートで識別（新方式）
                ipaddr = data.get("ipaddr")
                port = data.get("port")
                # 旧方式（device名）との互換性維持
                device_name = data.get("device")
                
                # ------------------------------------------------------------
                # (1)設定読み出しリクエストの処理
                # ------------------------------------------------------------
                if request_type == "GetDeviceSettings":
                    if ipaddr and port:
                        # 新方式: IPアドレスとポートで識別
                        device_key = f"{ipaddr}:{port}"
                        print(f"🔧 設定読み出しリクエスト（IP:ポート）: {device_key}")
                        print(f"📊 現在保存されているデバイス一覧: {list(device_settings.keys())}")
                        
                        # IPアドレスとポートでデバイスを検索
                        device_settings_data = None
                        matched_device_name = None
                        for dev_name, dev_info in device_settings.items():
                            dev_ip = dev_info.get('ipaddr')
                            dev_port = dev_info.get('port')
                            print(f"🔍 デバイス比較: {dev_name} - IP:{dev_ip} (要求:{ipaddr}), Port:{dev_port} (要求:{port})")
                            if dev_ip == ipaddr and dev_port == port:
                                device_settings_data = dev_info
                                matched_device_name = dev_name
                                print(f"✅ マッチ成功: {dev_name}")
                                break
                        
                        # 現在値を取得
                        current_data = DeviceSettingsManager.get_current_data(matched_device_name) if matched_device_name else None
                    else:
                        # 旧方式: 装置名で識別（互換性維持）
                        print(f"🔧 設定読み出しリクエスト: {device_name}")
                        print(f"📊 現在保存されているデバイス一覧: {list(device_settings.keys())}")
                        matched_device_name = device_name
                        device_settings_data = DeviceSettingsManager.get_device_settings(device_name)
                        current_data = DeviceSettingsManager.get_current_data(device_name)
                    
                    if device_settings_data:
                        print(f"✅ 設定データ取得成功: {matched_device_name}")
                        print(f"📋 装置情報: name={device_settings_data.get('device_name')}, model={device_settings_data.get('model')}, ip={device_settings_data.get('ipaddr')}, port={device_settings_data.get('port')}")
                        
                        # T24C10B10A, T28C16R8I1, T64C30B30I1モデルの場合、リモート装置から設定を読み出す
                        if device_settings_data.get('model') in ['T24C10B10A', 'T28C16R8I1', 'T64C30B30I1']:
                            print(f"🌐 [{matched_device_name}] リモート装置から設定を読み出します（メモリ内設定は使用しない）")
                            device_for_request = devices.get(matched_device_name)
                            if device_for_request:
                                # SetValue,200-206, 210-214, 220-224, 230-234を読み出す
                                setvalue_numbers = list(range(200, 207)) + list(range(210, 215)) + list(range(220, 225)) + list(range(230, 235))
                                remote_settings = await send_setvalue_request_to_remote(device_for_request, setvalue_numbers)
                                
                                if remote_settings:
                                    # 温度設定を更新（リモート装置の設定で完全に置き換える）
                                    setting_key_map = {
                                        200: 'channel_mapping',
                                        201: 'sensor_enabled',
                                        202: 'warning_temperatures',
                                        203: 'warning_times',
                                        204: 'alarm_temperatures',
                                        205: 'alarm_times',
                                        206: 'immediate_thresholds'
                                    }
                                    
                                    # 新しいtemp_settingsオブジェクトを作成（メモリ内設定を上書きしない）
                                    new_temp_settings = {}
                                    for setvalue_num in range(200, 207):
                                        if setvalue_num in remote_settings:
                                            setting_key = setting_key_map.get(setvalue_num)
                                            # キーを文字列に変換（フロントエンドは文字列キーを期待）
                                            new_temp_settings[setting_key] = {str(k): v for k, v in remote_settings[setvalue_num].items()}
                                            print(f"  📝 SetValue,{setvalue_num} ({setting_key}): チャンネル数={len(remote_settings[setvalue_num])}")
                                    
                                    # device_settings_dataのtemp_settingsをリモート装置の設定で置き換え
                                    device_settings_data['temp_settings'] = new_temp_settings
                                    
                                    # トラッキング設定を更新（リモート装置の設定で完全に置き換える）
                                    track_key_map = {
                                        210: 'relay',
                                        211: 'warning_current',
                                        212: 'warning_count',
                                        213: 'alarm_current',
                                        214: 'alarm_count'
                                    }
                                    
                                    new_track_settings = {}
                                    for setvalue_num in range(210, 215):
                                        if setvalue_num in remote_settings:
                                            setting_key = track_key_map.get(setvalue_num)
                                            # キーを文字列に変換（フロントエンドは文字列キーを期待）
                                            new_track_settings[setting_key] = {str(k): v for k, v in remote_settings[setvalue_num].items()}
                                    
                                    device_settings_data['track_settings'] = new_track_settings
                                    
                                    # 過電流設定を更新（リモート装置の設定で完全に置き換える）
                                    curr_key_map = {
                                        220: 'relay',
                                        221: 'warning_current',
                                        222: 'warning_delays',
                                        223: 'alarm_current',
                                        224: 'alarm_delays'
                                    }
                                    
                                    new_curr_settings = {}
                                    for setvalue_num in range(220, 225):
                                        if setvalue_num in remote_settings:
                                            setting_key = curr_key_map.get(setvalue_num)
                                            # キーを文字列に変換（フロントエンドは文字列キーを期待）
                                            new_curr_settings[setting_key] = {str(k): v for k, v in remote_settings[setvalue_num].items()}
                                    
                                    device_settings_data['curr_settings'] = new_curr_settings
                                    
                                    # 漏洩電流設定を更新（リモート装置の設定で完全に置き換える）
                                    leak_key_map = {
                                        230: 'relay',
                                        231: 'warning_current',
                                        232: 'warning_delays',
                                        233: 'alarm_current',
                                        234: 'alarm_delays'
                                    }
                                    
                                    new_leak_settings = {}
                                    for setvalue_num in range(230, 235):
                                        if setvalue_num in remote_settings:
                                            setting_key = leak_key_map.get(setvalue_num)
                                            # キーを文字列に変換（フロントエンドは文字列キーを期待）
                                            new_leak_settings[setting_key] = {str(k): v for k, v in remote_settings[setvalue_num].items()}
                                            print(f"  📝 SetValue,{setvalue_num} ({setting_key}): チャンネル数={len(remote_settings[setvalue_num])}, サンプル={dict(list(remote_settings[setvalue_num].items())[:2])}")
                                    
                                    device_settings_data['leak_settings'] = new_leak_settings
                                    print(f"  📊 leak_settings keys: {list(new_leak_settings.keys())}, has data: {len(new_leak_settings) > 0}")
                                    
                                    # メモリ内設定も更新（読み出し後も一致させる）
                                    if matched_device_name in device_settings:
                                        device_settings[matched_device_name]['temp_settings'] = new_temp_settings
                                        device_settings[matched_device_name]['track_settings'] = new_track_settings
                                        device_settings[matched_device_name]['curr_settings'] = new_curr_settings
                                        device_settings[matched_device_name]['leak_settings'] = new_leak_settings
                                        print(f"📝 [{matched_device_name}] メモリ内設定も更新しました")
                                    
                                    print(f"🎉 [{matched_device_name}] リモート装置からの設定読み出し完了")
                                else:
                                    print(f"⚠️ [{matched_device_name}] リモート装置からの設定読み出し失敗（メモリ内設定を使用）")
                            else:
                                print(f"⚠️ [{matched_device_name}] デバイス情報が見つかりませんでした")
                    else:
                        print(f"❌ 設定データ取得失敗: {matched_device_name if matched_device_name else device_name}")
                    
                    if device_settings_data:
                        # 現在の測定値を解析
                        current_temperatures = {}
                        if current_data:
                            try:
                                lines = current_data.strip().split('\n')
                                for line in lines:
                                    if line.startswith('100,'):  # 温度データ
                                        temp_parts = line.split(',')[1:]  # 100,を除く
                                        for i, temp_part in enumerate(temp_parts):
                                            if '=' in temp_part:
                                                _, temp_value = temp_part.split('=', 1)
                                                try:
                                                    current_temperatures[i + 1] = float(temp_value)
                                                except ValueError:
                                                    current_temperatures[i + 1] = -999
                                        break
                            except Exception as e:
                                print(f"現在値解析エラー: {e}")
                        
                        # レスポンスデータを構築（device_keyをIPアドレス:ポート形式で返す）
                        response_device_key = f"{device_settings_data.get('ipaddr', '')}:{device_settings_data.get('port', 0)}"
                        response_data = {
                            "request_type": "GetDeviceSettings",
                            "device": response_device_key,  # IPアドレス:ポート形式で返す
                            "status": "success",
                            "data": {
                                "device_info": {
                                    "name": device_settings_data.get('device_name', ''),
                                    "model": device_settings_data.get('model', ''),
                                    "ipaddr": device_settings_data.get('ipaddr', ''),
                                    "port": device_settings_data.get('port', 0)
                                },
                                "circuits": device_settings_data.get('circuits', []),
                                "temp_names": device_settings_data.get('temp_names', []),
                                "temp_settings": device_settings_data.get('temp_settings', {}),
                                "brkr_names": device_settings_data.get('brkr_names', []),
                                "brkr_settings": device_settings_data.get('brkr_settings', {}),
                                "track_names": device_settings_data.get('track_names', []),
                                "track_settings": device_settings_data.get('track_settings', {}),
                                "curr_names": device_settings_data.get('curr_names', []),
                                "curr_settings": device_settings_data.get('curr_settings', {}),
                                "leak_names": device_settings_data.get('leak_names', []),
                                "leak_settings": device_settings_data.get('leak_settings', {}),
                                "current_temperatures": current_temperatures,
                                "timestamp": asyncio.get_event_loop().time()
                            }
                        }
                        
                        await websocket.send(json.dumps(response_data))
                        print(f"✅ 設定データ送信完了: {matched_device_name} ({response_device_key})")
                        print(f"📊 送信データ内容: temp_settings={bool(device_settings_data.get('temp_settings'))}, brkr_settings={bool(device_settings_data.get('brkr_settings'))}, track_settings={bool(device_settings_data.get('track_settings'))}, curr_settings={bool(device_settings_data.get('curr_settings'))}")
                    else:
                        # 設定が見つからない場合
                        error_response = {
                            "request_type": "GetDeviceSettings",
                            "device": device_name,
                            "status": "error",
                            "message": f"Device settings not found for {device_name}"
                        }
                        await websocket.send(json.dumps(error_response))
                        print(f"❌ 設定データなし: {device_name}")
                
                # ------------------------------------------------------------
                # (2)設定を更新
                # ------------------------------------------------------------
                elif request_type == "UpdateDeviceSettings":
                    # IPアドレスとポートで識別（新方式）
                    update_ipaddr = data.get("ipaddr")
                    update_port = data.get("port")
                    # 旧方式（device名）との互換性維持
                    device_name = data.get("device")
                    
                    new_temp_settings = data.get("temp_settings", {})
                    new_brkr_settings = data.get("brkr_settings", {})
                    new_circuits = data.get("circuits", [])
                    new_track_settings = data.get("track_settings", {})
                    new_curr_settings = data.get("curr_settings", {})
                    new_leak_settings = data.get("leak_settings", {})
                    
                    # デバイスを検索
                    matched_device_name = None
                    if update_ipaddr and update_port:
                        # 新方式: IPアドレスとポートで識別
                        device_key = f"{update_ipaddr}:{update_port}"
                        print(f"🔧 設定データ更新開始（IP:ポート）: {device_key}")
                        for dev_name, dev_info in device_settings.items():
                            if dev_info.get('ipaddr') == update_ipaddr and dev_info.get('port') == update_port:
                                matched_device_name = dev_name
                                break
                    else:
                        # 旧方式: 装置名で識別（互換性維持）
                        matched_device_name = device_name
                        print(f"🔧 設定データ更新開始: {device_name}")
                    
                    if matched_device_name and matched_device_name in device_settings and matched_device_name in devices:
                        print(f"📊 受信した設定: temp={bool(new_temp_settings)}, brkr={bool(new_brkr_settings)}, circuits={len(new_circuits)}, track={bool(new_track_settings)}, curr={bool(new_curr_settings)}, leak={bool(new_leak_settings)}")
                        
                        # 実際のDESCON装置に設定を送信
                        device = devices[matched_device_name]
                        device_model = device_settings[matched_device_name].get('model', '')
                        
                        # T24C10B10A, T28C16R8I1, T64C30B30I1モデルの場合、リモート装置にSetValueコマンドを送信
                        send_result = {'success': 0, 'failed': 0, 'errors': []}
                        if device_model in ['T24C10B10A', 'T28C16R8I1', 'T64C30B30I1']:
                            print(f"🌐 [{matched_device_name}] リモート装置に設定を書き込みます（モデル: {device_model}）")
                            
                            # 温度設定、トラッキング設定、過電流設定、漏洩電流設定、ブレーカー設定の送信 (SetValue,200-206, 210-214, 220-224, 230-234, 250)
                            if new_temp_settings or new_track_settings or new_curr_settings or new_leak_settings or new_brkr_settings:
                                remote_result = await send_setvalue_to_remote(device, new_temp_settings, new_track_settings, new_curr_settings, new_leak_settings, new_brkr_settings, device_model)
                                send_result['success'] += remote_result['success']
                                send_result['failed'] += remote_result['failed']
                                if 'errors' in remote_result:
                                    send_result['errors'].extend(remote_result['errors'])
                        else:
                            # 従来の方式（直接SetValueコマンド送信）
                            if new_temp_settings:
                                temp_result = await send_setvalue_commands(device, new_temp_settings)
                                send_result['success'] += temp_result['success']
                                send_result['failed'] += temp_result['failed']
                                if 'errors' in temp_result:
                                    send_result['errors'].extend(temp_result['errors'])
                        
                        # 送信結果をログ出力
                        print(f"📊 装置送信結果: 成功 {send_result['success']}, 失敗 {send_result['failed']}")
                        
                        # 送信が成功した場合のみメモリ内設定を更新
                        if send_result['success'] > 0 or new_circuits:
                            # メモリ内の設定を更新
                            if new_temp_settings:
                                if "temp_settings" not in device_settings[matched_device_name]:
                                    device_settings[matched_device_name]["temp_settings"] = {}
                                device_settings[matched_device_name]["temp_settings"].update(new_temp_settings)
                            
                            if new_brkr_settings:
                                if "brkr_settings" not in device_settings[matched_device_name]:
                                    device_settings[matched_device_name]["brkr_settings"] = {}
                                device_settings[matched_device_name]["brkr_settings"].update(new_brkr_settings)
                            
                            if new_circuits:
                                device_settings[matched_device_name]["circuits"] = new_circuits
                            
                            if new_track_settings:
                                if "track_settings" not in device_settings[matched_device_name]:
                                    device_settings[matched_device_name]["track_settings"] = {}
                                device_settings[matched_device_name]["track_settings"].update(new_track_settings)
                            
                            if new_curr_settings:
                                if "curr_settings" not in device_settings[matched_device_name]:
                                    device_settings[matched_device_name]["curr_settings"] = {}
                                device_settings[matched_device_name]["curr_settings"].update(new_curr_settings)
                            
                            if new_leak_settings:
                                if "leak_settings" not in device_settings[matched_device_name]:
                                    device_settings[matched_device_name]["leak_settings"] = {}
                                device_settings[matched_device_name]["leak_settings"].update(new_leak_settings)
                            
                            device_settings[matched_device_name]["timestamp"] = asyncio.get_event_loop().time()
                            
                            print(f"📝 メモリ内設定も更新完了")
                        
                        # 結果に応じてレスポンスを構築
                        response_device_key = f"{device_settings[matched_device_name].get('ipaddr', '')}:{device_settings[matched_device_name].get('port', 0)}"
                        if send_result['success'] > 0 and send_result['failed'] == 0:
                            # 全て成功
                            response_data = {
                                "request_type": "UpdateDeviceSettings",
                                "device": response_device_key,  # IPアドレス:ポート形式で返す
                                "status": "success",
                                "message": f"All settings sent successfully to device ({send_result['success']} commands)",
                                "updated_settings": new_temp_settings,
                                "device_result": send_result,
                                "timestamp": device_settings[matched_device_name]["timestamp"]
                            }
                        elif send_result['success'] > 0:
                            # 一部成功
                            response_data = {
                                "request_type": "UpdateDeviceSettings",
                                "device": response_device_key,  # IPアドレス:ポート形式で返す
                                "status": "partial_success",
                                "message": f"Partially successful: {send_result['success']} succeeded, {send_result['failed']} failed",
                                "updated_settings": new_temp_settings,
                                "device_result": send_result,
                                "timestamp": device_settings[matched_device_name]["timestamp"]
                            }
                        else:
                            # 全て失敗
                            response_data = {
                                "request_type": "UpdateDeviceSettings",
                                "device": response_device_key,  # IPアドレス:ポート形式で返す
                                "status": "error",
                                "message": f"Failed to send settings to device: {send_result.get('error', 'All commands failed')}",
                                "device_result": send_result
                            }
                        
                        await websocket.send(json.dumps(response_data))
                        print(f"✅ 設定データ更新処理完了: {matched_device_name} ({response_device_key})")
                        
                    else:
                        # デバイスが見つからない場合
                        error_response = {
                            "request_type": "UpdateDeviceSettings", 
                            "device": device_name,
                            "status": "error",
                            "message": f"Device not found or not initialized: {device_name}"
                        }
                        await websocket.send(json.dumps(error_response))
                        print(f"❌ 設定データ更新失敗: {device_name} (デバイスが見つかりません)")
                
                # ------------------------------------------------------------
                # (3)その他 - "TrackingRecordRequest"など
                # ------------------------------------------------------------
                elif request_type in {"DataRequest", "TrackingRecordRequest"}:
                    if device_name in devices:
                        print(f"request_type: {request_type}: {device_name}")
                        device = devices[device_name]
                        if device_name in tasks:
                            async with lock:                                                                                        # キャンセル中の送信を防ぐ - kotani
                                tasks[device_name].cancel()
                            # キャンセルの処理が完了するのを待つ - kotani
                            try:
                                await tasks[device_name]
                            except asyncio.CancelledError:
                                print(f"Task canceled on caller side for {device_name}")
                        await asyncio.sleep(0)                                                                                      # タスク生成の前にイベントループに制御を戻す
                        tasks[device_name] = asyncio.create_task(fetch_device_data(device, websocket, request_type))
                    else:
                        print(f"Got request ({request_type}) for unknown device: {device_name}")    # ログ出力 - kotani

                else:
                    print(f"Unknown request: {request_type} for {device_name}.")                            # ログ出力 - kotani

        except websockets.exceptions.ConnectionClosedError:
            print("WebSocket connection closed (Error) on caller side")
            break

        except websockets.exceptions.ConnectionClosedOK:                                                        # 追加 - kotani
            print("WebSocket connection closed (OK) on caller side")
            break

        except asyncio.CancelledError:
            print("Task cancelled")
            break
            
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            break

# ----------------------------------------------------------------------
# start_websocket_server
# ----------------------------------------------------------------------
async def start_websocket_server():
    # 基本的なWebSocketサーバーを起動
    # 自動Ping送信をオフ、タイムアウト監視をオフ - kotani
    async with websockets.serve(websocket_handler, "localhost", 8765, ping_interval=None, ping_timeout=None):
        print("WebSocket server started on ws://localhost:8765")
        await asyncio.Future()  # サーバーを永続的に実行するための非同期タスク

asyncio.get_event_loop().run_until_complete(start_websocket_server())
asyncio.get_event_loop().run_forever()
