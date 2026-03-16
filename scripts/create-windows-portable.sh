#!/bin/bash

# Windows用USB配布パッケージ作成スクリプト
# Electron版DESCON設定ツール用

set -e

echo "🪟 Windows用DESCON設定ツール配布パッケージを作成中..."

DIST_NAME="DESCON-Config-Tool-Windows-Portable"
DIST_DIR="$DIST_NAME"

# 既存の配布ディレクトリを削除
if [ -d "$DIST_DIR" ]; then
    echo "🗑️  既存の$DIST_DIRを削除中..."
    rm -rf "$DIST_DIR"
fi

# 配布ディレクトリを作成
echo "📁 配布ディレクトリを作成中..."
mkdir -p "$DIST_DIR"

# Next.jsをビルド
echo "🔨 Next.jsをビルド中..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Next.jsのビルドに失敗しました"
    exit 1
fi

# ファイルをコピー
echo "📦 必要なファイルをコピー中..."
cp -R .next "$DIST_DIR/"
cp -R app "$DIST_DIR/"
cp -R components "$DIST_DIR/"
cp -R contexts "$DIST_DIR/"
cp -R lib "$DIST_DIR/"
cp -R electron "$DIST_DIR/"
cp -R backend "$DIST_DIR/"
cp -R public "$DIST_DIR/"
cp -R scripts "$DIST_DIR/"
cp -R node_modules "$DIST_DIR/"
cp package.json "$DIST_DIR/"
cp package-lock.json "$DIST_DIR/"
cp next.config.mjs "$DIST_DIR/"
cp tsconfig.json "$DIST_DIR/"
cp tailwind.config.ts "$DIST_DIR/"
cp postcss.config.mjs "$DIST_DIR/"
cp components.json "$DIST_DIR/"

# 不要なファイルを削除
echo "🗑️  不要なファイルを削除中..."
rm -rf "$DIST_DIR/python" 2>/dev/null || true
rm -rf "$DIST_DIR/node" 2>/dev/null || true
rm -rf "$DIST_DIR/.git" 2>/dev/null || true
rm -rf "$DIST_DIR/dist" 2>/dev/null || true
rm -rf "$DIST_DIR/build" 2>/dev/null || true

# Windows用起動スクリプト（.bat）を作成
echo "🔧 Windows用起動スクリプトを作成中..."
cat > "$DIST_DIR/DESCON設定ツール.bat" << 'EOF'
@echo off
chcp 65001 > nul
title DESCON設定ツール

echo.
echo ========================================
echo   DESCON設定ツール
echo ========================================
echo.
echo 🚀 起動中...
echo 初回起動時は環境設定が自動で行われます
echo しばらくお待ちください...
echo.

REM 現在のディレクトリを取得
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Node.jsとnpmが利用可能かチェック
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.jsが見つかりません
    echo.
    echo 📋 Node.jsをインストールしてください:
    echo 1. https://nodejs.org/ にアクセス
    echo 2. 'LTS' バージョンをダウンロード
    echo 3. インストール時に「Add to PATH」にチェック
    echo 4. インストール後、PCを再起動
    echo 5. 再度このスクリプトを実行
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npmが見つかりません
    echo Node.jsと一緒にインストールされるはずです
    echo Node.jsを再インストールしてください
    pause
    exit /b 1
)

REM Pythonが利用可能かチェック
where python >nul 2>nul
if %errorlevel% neq 0 (
    where py >nul 2>nul
    if %errorlevel% neq 0 (
        echo ❌ Pythonが見つかりません
        echo.
        echo 📋 Pythonをインストールしてください:
        echo 1. https://www.python.org/downloads/ にアクセス
        echo 2. 最新のPython 3をダウンロード
        echo 3. インストール時に「Add Python to PATH」にチェック
        echo 4. インストール後、PCを再起動
        echo 5. 再度このスクリプトを実行
        echo.
        pause
        exit /b 1
    )
)

REM バージョン確認
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo ✅ Node.js %NODE_VERSION% が見つかりました
echo ✅ npm %NPM_VERSION% が見つかりました

REM アプリケーションを起動
echo.
echo 💻 アプリケーションを起動中...
echo ブラウザウィンドウが開くまでお待ちください
echo.

call scripts\run-production.bat

echo.
echo ✅ アプリケーションが終了しました
echo ウィンドウを閉じてください
pause
EOF

# Windows用README.mdを作成
echo "📝 Windows用READMEを作成中..."
cat > "$DIST_DIR/README-Windows.md" << 'EOF'
# DESCON設定ツール - Windows USB配布版

## 📋 概要

DESCON監視システムの設定を行うデスクトップアプリケーションです。
USBメモリから直接実行できるポータブル版です。

## 🚀 使用方法

### 初回起動

1. **必要なソフトウェアのインストール**
   
   このツールを使用するには、以下のソフトウェアがPCにインストールされている必要があります：
   
   - **Node.js (LTS版)**: https://nodejs.org/
     - インストール時に「Add to PATH」にチェックを入れてください
   
   - **Python 3.7以上**: https://www.python.org/downloads/
     - インストール時に「Add Python to PATH」にチェックを入れてください

2. **起動**
   
   - `DESCON設定ツール.bat` をダブルクリック
   - 初回起動時は環境設定が自動で行われます（5-10分程度）
   - 完了後、アプリケーションウィンドウが自動で開きます

### 2回目以降の起動

- `DESCON設定ツール.bat` をダブルクリックするだけ
- すぐに起動します（数秒）

## 💻 動作環境

### 必須環境

- **OS**: Windows 10 / 11 (64bit)
- **メモリ**: 4GB以上推奨
- **ディスク空き容量**: 2GB以上
- **ネットワーク**: 初回起動時のみインターネット接続が必要

### 必須ソフトウェア

- Node.js (LTS版推奨)
- Python 3.7以上

## 📱 機能

- DESCON機器の設定管理
- リアルタイムモニタリング
- 設定ファイル（YAML）の読み込み・編集・保存
- キュービクル設定管理
- グラフ表示

## 🔧 トラブルシューティング

### Node.jsが見つからない

1. https://nodejs.org/ にアクセス
2. 「LTS」版をダウンロード
3. インストール時に「Add to PATH」オプションにチェック
4. インストール後、PCを再起動
5. 再度ツールを起動

### Pythonが見つからない

1. https://www.python.org/downloads/ にアクセス
2. 最新のPython 3をダウンロード
3. インストール時に「Add Python to PATH」にチェック
4. インストール後、PCを再起動
5. 再度ツールを起動

### 起動が遅い（初回のみ）

- 正常です。初回起動時は環境構築に5-10分かかります
- インターネット接続が必要です
- 完了まで待ってください

### ポート使用エラー

- 他のアプリケーションがポート3002または8765を使用している可能性があります
- 他のアプリケーションを終了してから再起動してください

### アプリケーションが起動しない

1. ウイルス対策ソフトが実行をブロックしていないか確認
2. 管理者として実行してみる
3. python, nodeフォルダを削除して再起動（環境が再構築されます）

## 📂 フォルダ構成

```
DESCON設定ツール/
├── DESCON設定ツール.bat    ← これをダブルクリックして起動
├── README-Windows.md        ← このファイル
├── app/                     ← フロントエンドアプリ
├── backend/                 ← Pythonバックエンド
├── scripts/                 ← 起動スクリプト
├── node_modules/            ← Node.jsパッケージ
├── python/                  ← Python環境（初回起動時に自動作成）
└── node/                    ← Node.js環境（初回起動時に自動作成）
```

## 📞 サポート

問題が発生した場合は、開発チームにお問い合わせください。

---

**バージョン**: 1.0.0
**最終更新**: 2025年10月

**注意**: 
- このツールは初回起動時にインターネット接続が必要です
- USBメモリから直接実行できますが、書き込み権限が必要です
- セキュリティソフトによってブロックされる場合があります
EOF

# 使用方法クイックガイドを作成
cat > "$DIST_DIR/使用方法-クイックガイド.txt" << 'EOF'
========================================
  DESCON設定ツール - クイックガイド
========================================

■ 初回起動

1. Node.jsをインストール
   https://nodejs.org/
   → 「LTS」版をダウンロード
   → インストール時に「Add to PATH」にチェック

2. Pythonをインストール  
   https://www.python.org/downloads/
   → 最新のPython 3をダウンロード
   → インストール時に「Add Python to PATH」にチェック

3. PCを再起動

4. 「DESCON設定ツール.bat」をダブルクリック

5. 初回は環境設定が自動実行されます（5-10分）

6. アプリケーションウィンドウが開きます

■ 2回目以降

1. 「DESCON設定ツール.bat」をダブルクリック
   → すぐに起動します

■ トラブル

- 起動しない
  → Node.js、Pythonがインストールされているか確認
  → PCを再起動してみる
  
- 遅い（初回のみ）
  → 正常です。完了までお待ちください

- エラーが出る
  → python, nodeフォルダを削除して再起動

========================================
EOF

echo "✅ Windows用配布パッケージ($DIST_DIR)の作成が完了しました！"
echo ""
echo "📁 配布フォルダ: $DIST_DIR"
echo "📦 サイズ: $(du -sh $DIST_DIR | cut -f1)"
echo ""
echo "💡 使用方法:"
echo "   1. $DIST_DIR フォルダをWindowsマシンにコピー（またはUSBメモリに入れる）"
echo "   2. Windowsで「DESCON設定ツール.bat」をダブルクリック"
echo "   3. 初回起動時は環境設定が自動で行われます"
echo ""
echo "📦 ZIPファイルを作成しますか？ (y/n)"
read -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗜️  ZIPファイルを作成中..."
    if command -v zip >/dev/null 2>&1; then
        zip -r "${DIST_NAME}.zip" "$DIST_DIR"
        echo "✅ ${DIST_NAME}.zip が作成されました！"
        echo "📦 ZIPサイズ: $(du -sh ${DIST_NAME}.zip | cut -f1)"
    else
        echo "⚠️  zipコマンドが見つかりません"
        echo "手動で圧縮してください: $DIST_DIR"
    fi
fi

echo ""
echo "🎉 完成！Windowsユーザーに配布できます"

