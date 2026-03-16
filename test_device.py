import socket
import time

def test_device_connection(ip, port, device_name):
    """リモート装置への接続テスト"""
    print(f"\n{'='*60}")
    print(f"テスト対象: {device_name}")
    print(f"IPアドレス: {ip}:{port}")
    print(f"{'='*60}\n")
    
    try:
        # 1. DataRequest テスト
        print("📡 [TEST 1] DataRequest を送信...")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            s.connect((ip, port))
            print(f"✅ 接続成功")
            
            command = "DataRequest\r\n\r\n"
            s.sendall(command.encode('utf-8'))
            print(f"📤 送信: {repr(command)}")
            
            time.sleep(1)
            
            buffer = b''
            while True:
                chunk = s.recv(1024)
                if not chunk:
                    break
                buffer += chunk
                if b'170,' in buffer:
                    # 170,の後ろのデータを全て取得
                    time.sleep(0.5)
                    break
            
            response = buffer.decode('utf-8', errors='ignore')
            lines = response.strip().split('\n')
            print(f"📥 受信: {len(lines)}行のデータ")
            for i, line in enumerate(lines[:5], 1):
                print(f"  行{i}: {line[:80]}...")
            if len(lines) > 5:
                print(f"  ... (残り{len(lines)-5}行)")
        
        print("\n" + "="*60)
        
        # 2. SetValueRequest,202 テスト（温度設定の読み出し）
        print("\n📖 [TEST 2] SetValueRequest,202 を送信（温度注意設定の読み出し）...")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            s.connect((ip, port))
            print(f"✅ 接続成功")
            
            command = "SetValueRequest,202\r\n"
            s.sendall(command.encode('utf-8'))
            print(f"📤 送信: {repr(command)}")
            
            time.sleep(1)
            
            buffer = b''
            timestamp_received = False
            received_lines = []
            
            while not timestamp_received:
                chunk = s.recv(4096)
                if not chunk:
                    break
                buffer += chunk
                
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
            
            print(f"📥 受信: {len(received_lines)}行のデータ")
            
            # 202行を探す
            found_202 = False
            for line in received_lines:
                if line.startswith('202,'):
                    found_202 = True
                    parts = line.split(',')
                    print(f"\n✅ 202番設定を発見:")
                    print(f"  データ数: {len(parts)-1}個")
                    print(f"  最初の10個: {','.join(parts[1:11])}")
                    break
            
            if not found_202:
                print("\n⚠️ 202番設定が見つかりませんでした")
                print(f"受信した行の先頭10個:")
                for line in received_lines[:10]:
                    print(f"  {line[:80]}")
        
        print("\n" + "="*60)
        
        # 3. 現在の設定値を保存
        print("\n💾 [TEST 3] 現在の設定値を保存...")
        original_values = None
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            s.connect((ip, port))
            
            command = "SetValueRequest,202\r\n"
            s.sendall(command.encode('utf-8'))
            
            time.sleep(1)
            
            buffer = b''
            timestamp_received = False
            received_lines = []
            
            while not timestamp_received:
                chunk = s.recv(4096)
                if not chunk:
                    break
                buffer += chunk
                
                while b'\n' in buffer:
                    line_bytes, buffer = buffer.split(b'\n', 1)
                    line = line_bytes.decode('utf-8', errors='ignore').strip()
                    
                    if not line:
                        continue
                    
                    received_lines.append(line)
                    
                    if line.startswith('270,'):
                        timestamp_received = True
                        break
            
            for line in received_lines:
                if line.startswith('202,'):
                    original_values = line.split(',')[1:]  # "1=61.0,2=61.0,..." の部分
                    print(f"✅ 元の設定値を保存しました（{len(original_values)}個）")
                    print(f"  最初の5個: {','.join(original_values[:5])}")
                    break
        
        if not original_values:
            print("❌ 元の設定値の取得に失敗しました。書き込みテストをスキップします。")
            return
        
        print("\n" + "="*60)
        
        # 4. テスト値を書き込み（チャンネル1のみを99.0に変更）
        print("\n✏️  [TEST 4] SetValue,202 を送信（テスト値を書き込み）...")
        print("  テスト内容: チャンネル1の値を 99.0℃ に変更")
        
        # 元の値をコピーして、チャンネル1だけ変更
        test_values = original_values.copy()
        test_values[0] = "1=99.0"  # チャンネル1を99.0に変更
        
        test_command = f"SetValue,202,{','.join(test_values)}\r\n"
        
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            s.connect((ip, port))
            print(f"✅ 接続成功")
            
            s.sendall(test_command.encode('utf-8'))
            print(f"📤 送信: SetValue,202 (データ長:{len(test_values)}個)")
            print(f"  変更箇所: {test_values[0]}")
            
            # 応答を待つ
            time.sleep(1)
            
            s.settimeout(5.0)
            try:
                response = s.recv(1024).decode('utf-8', errors='ignore').strip()
                print(f"📥 応答: {response[:100]}")
                
                if "OK" in response.upper() or len(response) == 0:
                    print(f"✅ 書き込み成功")
                else:
                    print(f"⚠️ 応答内容: {response}")
            except socket.timeout:
                print(f"✅ 書き込み完了（応答なし、正常と判定）")
        
        print("\n" + "="*60)
        
        # 5. 書き込みが成功したか確認
        print("\n🔍 [TEST 5] 書き込み結果を確認...")
        time.sleep(2)  # 装置に設定が反映されるまで待機
        
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            s.connect((ip, port))
            
            command = "SetValueRequest,202\r\n"
            s.sendall(command.encode('utf-8'))
            
            time.sleep(1)
            
            buffer = b''
            timestamp_received = False
            received_lines = []
            
            while not timestamp_received:
                chunk = s.recv(4096)
                if not chunk:
                    break
                buffer += chunk
                
                while b'\n' in buffer:
                    line_bytes, buffer = buffer.split(b'\n', 1)
                    line = line_bytes.decode('utf-8', errors='ignore').strip()
                    
                    if not line:
                        continue
                    
                    received_lines.append(line)
                    
                    if line.startswith('270,'):
                        timestamp_received = True
                        break
            
            for line in received_lines:
                if line.startswith('202,'):
                    current_values = line.split(',')[1:]
                    print(f"📥 現在の設定値: {','.join(current_values[:5])}")
                    
                    if current_values[0] == "1=99.0":
                        print(f"✅ 書き込み確認: チャンネル1 = 99.0℃ （正常）")
                    else:
                        print(f"⚠️ 書き込み確認: チャンネル1 = {current_values[0]} （期待値: 1=99.0）")
                    break
        
        print("\n" + "="*60)
        
        # 6. 元の値を書き戻す
        print("\n🔄 [TEST 6] 元の設定値を書き戻します...")
        
        restore_command = f"SetValue,202,{','.join(original_values)}\r\n"
        
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            s.connect((ip, port))
            print(f"✅ 接続成功")
            
            s.sendall(restore_command.encode('utf-8'))
            print(f"📤 送信: SetValue,202 (元の値に復元)")
            print(f"  復元内容: {original_values[0]}")
            
            time.sleep(1)
            
            s.settimeout(5.0)
            try:
                response = s.recv(1024).decode('utf-8', errors='ignore').strip()
                print(f"📥 応答: {response[:100]}")
                
                if "OK" in response.upper() or len(response) == 0:
                    print(f"✅ 復元成功")
                else:
                    print(f"⚠️ 応答内容: {response}")
            except socket.timeout:
                print(f"✅ 復元完了（応答なし、正常と判定）")
        
        print("\n" + "="*60)
        
        # 7. 復元されたか確認
        print("\n🔍 [TEST 7] 復元結果を確認...")
        time.sleep(2)
        
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            s.connect((ip, port))
            
            command = "SetValueRequest,202\r\n"
            s.sendall(command.encode('utf-8'))
            
            time.sleep(1)
            
            buffer = b''
            timestamp_received = False
            received_lines = []
            
            while not timestamp_received:
                chunk = s.recv(4096)
                if not chunk:
                    break
                buffer += chunk
                
                while b'\n' in buffer:
                    line_bytes, buffer = buffer.split(b'\n', 1)
                    line = line_bytes.decode('utf-8', errors='ignore').strip()
                    
                    if not line:
                        continue
                    
                    received_lines.append(line)
                    
                    if line.startswith('270,'):
                        timestamp_received = True
                        break
            
            for line in received_lines:
                if line.startswith('202,'):
                    restored_values = line.split(',')[1:]
                    print(f"📥 復元後の設定値: {','.join(restored_values[:5])}")
                    
                    if restored_values[0] == original_values[0]:
                        print(f"✅ 復元確認: チャンネル1 = {restored_values[0]} （元の値に戻りました）")
                    else:
                        print(f"⚠️ 復元確認: チャンネル1 = {restored_values[0]} （期待値: {original_values[0]}）")
                    break
        
        print("\n✅ すべてのテスト完了")
        
    except socket.timeout:
        print(f"\n❌ タイムアウト: {ip}:{port}")
    except ConnectionRefusedError:
        print(f"\n❌ 接続拒否: {ip}:{port}")
    except Exception as e:
        print(f"\n❌ エラー: {e}")

if __name__ == "__main__":
    # テスト対象のデバイス
    devices = [
        ("192.168.40.197", 16620, "ホーム分電盤20回路 (T24C10B10A)"),
        ("192.168.40.191", 16620, "実験用DESCON電灯盤 (T64C30B30I1)"),
    ]
    
    for ip, port, name in devices:
        test_device_connection(ip, port, name)
        print("\n" + "="*60 + "\n")

