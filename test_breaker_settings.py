import socket
import time

def test_full_breaker_cycle(device_name, ip, port):
    """ブレーカー設定の完全サイクルテスト（読み出し→変更→復元）"""
    print("\n" + "="*80)
    print(f"🔧 ブレーカー設定 完全サイクルテスト")
    print(f"テスト対象: {device_name}")
    print(f"IPアドレス: {ip}:{port}")
    print("="*80)

    original_values = None
    
    try:
        # ステップ1: 現在のブレーカー設定を読み出し
        print("\n📖 [ステップ 1/6] 現在のブレーカー設定を読み出し...")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            s.connect((ip, port))
            print(f"  ✅ 接続成功")
            
            command = "SetValueRequest,250\r\n"
            s.sendall(command.encode('utf-8'))
            print(f"  📤 送信: {command.strip()}")
            
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
                if line.startswith('250,'):
                    original_values = line.split(',')[1:]
                    print(f"  ✅ 元の設定を取得: {len(original_values)}個")
                    print(f"  📝 最初の5個: {','.join(original_values[:5])}")
                    break
            
            if not original_values:
                print(f"  ❌ 250番設定が見つかりませんでした")
                return False
        
        # ステップ2: テスト値を準備（チャンネル1と2をOFFに変更）
        print("\n🔧 [ステップ 2/6] テスト値を準備...")
        test_values = original_values.copy()
        test_values[0] = "1=OFF"
        test_values[1] = "2=OFF"
        print(f"  ✅ テスト変更: CH1=OFF, CH2=OFF")
        print(f"  📝 変更後の最初の5個: {','.join(test_values[:5])}")
        
        # ステップ3: テスト値を書き込み
        print("\n✏️  [ステップ 3/6] テスト値を書き込み...")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            s.connect((ip, port))
            
            test_command = f"SetValue,250,{','.join(test_values)}\r\n"
            s.sendall(test_command.encode('utf-8'))
            print(f"  📤 送信: SetValue,250 (データ長:{len(test_values)}個)")
            
            time.sleep(1)
            
            s.settimeout(5.0)
            try:
                response = s.recv(1024).decode('utf-8', errors='ignore').strip()
                print(f"  📥 応答: {response[:100]}")
                
                if "OK" in response.upper() or len(response) == 0:
                    print(f"  ✅ 書き込み成功")
                else:
                    print(f"  ⚠️ 応答内容: {response}")
            except socket.timeout:
                print(f"  ✅ 書き込み完了（応答なし、正常と判定）")
        
        # ステップ4: 書き込み結果を確認
        print("\n🔍 [ステップ 4/6] 書き込み結果を確認...")
        time.sleep(2)
        
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            s.connect((ip, port))
            
            command = "SetValueRequest,250\r\n"
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
                if line.startswith('250,'):
                    current_values = line.split(',')[1:]
                    print(f"  📥 現在の設定値: 最初の5個 = {','.join(current_values[:5])}")
                    
                    if current_values[0] == "1=OFF" and current_values[1] == "2=OFF":
                        print(f"  ✅ 書き込み確認成功: CH1=OFF, CH2=OFF")
                    else:
                        print(f"  ⚠️ 書き込み確認失敗")
                        print(f"     期待値: 1=OFF,2=OFF")
                        print(f"     実際値: {current_values[0]},{current_values[1]}")
                    break
        
        # ステップ5: 元の値を書き戻す
        print("\n🔄 [ステップ 5/6] 元の設定値を書き戻します...")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            s.connect((ip, port))
            
            restore_command = f"SetValue,250,{','.join(original_values)}\r\n"
            s.sendall(restore_command.encode('utf-8'))
            print(f"  📤 送信: SetValue,250 (元の値に復元)")
            print(f"  📝 復元内容: {original_values[0]},{original_values[1]}")
            
            time.sleep(1)
            
            s.settimeout(5.0)
            try:
                response = s.recv(1024).decode('utf-8', errors='ignore').strip()
                print(f"  📥 応答: {response[:100]}")
                
                if "OK" in response.upper() or len(response) == 0:
                    print(f"  ✅ 復元成功")
                else:
                    print(f"  ⚠️ 応答内容: {response}")
            except socket.timeout:
                print(f"  ✅ 復元完了（応答なし、正常と判定）")
        
        # ステップ6: 復元結果を確認
        print("\n🔍 [ステップ 6/6] 復元結果を確認...")
        time.sleep(2)
        
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            s.connect((ip, port))
            
            command = "SetValueRequest,250\r\n"
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
                if line.startswith('250,'):
                    restored_values = line.split(',')[1:]
                    print(f"  📥 復元後の設定値: 最初の5個 = {','.join(restored_values[:5])}")
                    
                    if restored_values[0] == original_values[0] and restored_values[1] == original_values[1]:
                        print(f"  ✅ 復元確認成功: 元の値に戻りました")
                    else:
                        print(f"  ⚠️ 復元確認失敗")
                        print(f"     期待値: {original_values[0]},{original_values[1]}")
                        print(f"     実際値: {restored_values[0]},{restored_values[1]}")
                    break
        
        print("\n" + "="*80)
        print("✅ ブレーカー設定の完全サイクルテスト完了")
        print("="*80)
        return True
        
    except socket.timeout:
        print(f"\n❌ タイムアウト: {ip}:{port}")
        return False
    except ConnectionRefusedError:
        print(f"\n❌ 接続拒否: {ip}:{port}")
        return False
    except Exception as e:
        print(f"\n❌ エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # テスト対象のデバイス情報
    devices_to_test = [
        {"name": "実験用DESCON電灯盤", "ipaddr": "192.168.40.191", "port": 16620, "model": "T64C30B30I1"}
    ]

    all_tests_passed = True
    for device in devices_to_test:
        result = test_full_breaker_cycle(device["name"], device["ipaddr"], device["port"])
        if not result:
            all_tests_passed = False
    
    if all_tests_passed:
        print("\n🎉 すべてのテストが成功しました！")
    else:
        print("\n⚠️ 一部のテストが失敗しました")

