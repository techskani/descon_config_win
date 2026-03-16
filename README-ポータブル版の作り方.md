# DESCON設定ツール - ポータブル版セットアップガイド

## 📦 概要

このガイドでは、**インストール不要で動作する**ポータブル版のDESCON設定ツールの作成方法を説明します。

---

## 🎯 メリット

- ✅ **インストール不要** - USBメモリやネットワークドライブから直接実行
- ✅ **管理者権限不要** - 制限されたPCでも動作
- ✅ **環境の統一** - すべてのPCで同じNode.jsとPythonバージョンを使用
- ✅ **簡単配布** - フォルダをコピーするだけ

---

## 🚀 自動セットアップ（推奨）

### 方法1: PowerShellスクリプトを使用

1. `setup-portable.ps1` を右クリック
2. 「PowerShellで実行」を選択
3. ダウンロードとセットアップを待つ（5-10分）
4. 完了後、`DESCON-Universal.bat` を実行

**これだけで完了です！**

---

## 🔧 手動セットアップ

自動セットアップができない場合の手順です。

### 手順1: フォルダ構造の作成

以下のフォルダを作成してください：
```
DESCON-Config-Tool-Windows-Portable/
├── portable/
│   ├── node/
│   └── python/
```

### 手順2: Node.jsのダウンロード

1. https://nodejs.org/dist/v20.11.0/ にアクセス
2. `node-v20.11.0-win-x64.zip` をダウンロード
3. すべてのファイルを `portable/node/` に展開

**展開後の内容:**
```
portable/node/
├── node.exe
├── npm.cmd
├── npx.cmd
└── node_modules/
```

### 手順3: Pythonのダウンロード

1. https://www.python.org/downloads/windows/ にアクセス
2. **Windows embeddable package (64-bit)** をダウンロード
   - 例: `python-3.11.8-embed-amd64.zip`
3. すべてのファイルを `portable/python/` に展開

**展開後の内容:**
```
portable/python/
├── python.exe
├── python311.dll
└── (その他のDLLファイル)
```

### 手順4: Pythonの設定

**重要:** 組み込み版Pythonは設定が必要です。

1. `portable/python/python311._pth` をメモ帳で開く
2. ファイルの最後に以下を追加:
   ```
   import site
   ```
3. 保存して閉じる

### 手順5: pipのインストール

コマンドプロンプトを開いて実行：
```batch
cd portable\python
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python.exe get-pip.py
```

### 手順6: 動作確認

`DESCON-Universal.bat` を実行

以下のメッセージが表示されれば成功：
```
Found portable Node.js and Python - Using bundled versions

========================================
Final Verification
========================================
Mode: PORTABLE
Node.js: D:\path\to\portable\node\node.exe
Python: D:\path\to\portable\python\python.exe
```

---

## 📁 完成後のフォルダ構造

```
DESCON-Config-Tool-Windows-Portable/
├── DESCON-Universal.bat          ← 起動ファイル（修正済み）
├── README-ポータブル版の作り方.md  ← このファイル
├── setup-portable.ps1            ← 自動セットアップスクリプト
├── PORTABLE-VERSION-QUICKSTART.txt
├── app/
├── backend/
├── components/
├── electron/
├── node_modules/
├── portable/                     ← NEW: ポータブル版ランタイム
│   ├── node/                     ← Node.js本体
│   │   ├── node.exe
│   │   ├── npm.cmd
│   │   └── node_modules/
│   └── python/                   ← Python本体
│       ├── python.exe
│       ├── python311.dll
│       ├── Lib/
│       └── venv/                 ← Python仮想環境（自動作成）
│           └── Scripts/
│               └── python.exe
└── python/                       ← ローカル仮想環境（システムPython用）
    └── venv/
```

---

## 💾 ファイルサイズ

| コンポーネント | サイズ（概算） |
|--------------|--------------|
| Node.js本体 | 約50 MB |
| Python本体（組み込み版） | 約15 MB |
| Python仮想環境＋パッケージ | 約50 MB |
| アプリケーションファイル | 約200 MB |
| **合計** | **約315 MB** |

💡 **ヒント:** 7-Zipで圧縮すると約50%サイズが削減されます

---

## 📤 他のPCへの配布方法

1. フォルダ全体をUSBメモリまたはネットワークドライブにコピー
2. `portable` フォルダが含まれていることを確認
3. 配布先のPCで `DESCON-Universal.bat` を実行
4. インストール不要で即座に動作！

---

## ✅ 配布前のチェックリスト

配布する前に以下を確認してください：

- [ ] `portable/node/node.exe` が存在し、実行できる
- [ ] `portable/node/npm.cmd` が存在する
- [ ] `portable/python/python.exe` が存在し、実行できる
- [ ] `portable/python/python.exe -m pip --version` が動作する
- [ ] `DESCON-Universal.bat` がエラーなく起動する
- [ ] アプリケーションウィンドウが正常に開く
- [ ] 管理者権限なしで動作する

---

## 🔍 トラブルシューティング

### 「Portable Node.js not found」と表示される

**原因:** Node.jsの実行ファイルが見つからない

**解決方法:**
- `portable/node/node.exe` が存在するか確認
- ファイルパスが正しいか確認
- ファイルが破損していないか確認

### 「Portable Python not found」と表示される

**原因:** Pythonの実行ファイルが見つからない

**解決方法:**
- `portable/python/python.exe` が存在するか確認
- ファイルパスが正しいか確認
- ファイルが破損していないか確認

### 「Python has no module named pip」と表示される

**原因:** pipがインストールされていない

**解決方法:**
```batch
cd portable\python
python.exe -m ensurepip
```
または手順5を再度実行

### 「Failed to create Python virtual environment」と表示される

**原因:** 組み込み版Pythonが仮想環境をサポートしていない

**解決方法1:** 手動で仮想環境を作成
```batch
cd portable\python
python.exe -m venv venv
venv\Scripts\activate
pip install flask==2.3.3 flask-cors==4.0.0 websockets==11.0.3 pyyaml==6.0.1
deactivate
```

**解決方法2:** フル版のPythonを使用
- Python公式サイトからインストーラー版をダウンロード
- インストール先を `portable/python/` に指定
- サイズは大きくなりますが確実に動作します

---

## 📝 補足情報

### ポータブル版と通常版の違い

| 項目 | ポータブル版 | 通常版 |
|-----|-----------|-------|
| インストール | 不要 | 必要 |
| 管理者権限 | 不要 | 必要（初回のみ） |
| ファイルサイズ | 約315 MB | 約200 MB |
| 配布 | コピーのみ | 各PCで個別セットアップ |
| 更新 | 手動（ファイル置換） | 自動可能 |

### セキュリティについて

- ポータブル版は自動アップデートを受信しません
- Node.jsやPythonのセキュリティアップデートがある場合は、手動で `portable` フォルダを更新してください
- 定期的に最新版をダウンロードして置き換えることを推奨します

### プラットフォームについて

- このセットアップは **Windows 64bit専用** です
- 32bit版が必要な場合は、対応するNode.jsとPythonをダウンロードしてください

---

## 🆘 サポート

問題が発生した場合：

1. すべてのファイルが正しい場所にあるか確認
2. ファイルのアクセス権限を確認（特にUSBドライブ）
3. クリーンなPC（Node.js/Pythonが未インストール）でテスト
4. `portable/node/node.exe --version` を実行してバージョン確認
5. `portable/python/python.exe --version` を実行してバージョン確認

---

## 📚 関連ドキュメント

- `README-Portable-Setup.md` - 英語版詳細ガイド
- `PORTABLE-VERSION-QUICKSTART.txt` - クイックスタートガイド
- `setup-portable.ps1` - 自動セットアップスクリプト

---

**バージョン**: 1.0.0  
**最終更新**: 2025年1月21日  
**対応OS**: Windows 10/11 (64bit)


