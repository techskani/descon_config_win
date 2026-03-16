@echo off
REM 起動時にそのPCに合わせたNode.js環境を構築（Windows版）
chcp 65001 > nul

echo 🔧 起動時にNode.js環境を構築中...

REM スクリプトのディレクトリを取得
set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%.."

REM アーキテクチャを確認
echo 🔍 実行アーキテクチャ: %PROCESSOR_ARCHITECTURE%

REM 既存のnodeディレクトリをクリーンアップ
if exist "%APP_DIR%\node" (
    echo 🗑️  既存のNode.js環境を削除中...
    rmdir /s /q "%APP_DIR%\node" 2>nul
)

REM システムのNode.jsが利用可能かチェック
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ システムにNode.jsがインストールされていません
    echo.
    echo 🔍 解決方法:
    echo 1. Node.js LTSをインストール: https://nodejs.org/
    echo 2. インストール時に「Add to PATH」を有効にしてください
    echo.
    pause
    exit /b 1
)

REM システムのnpmが利用可能かチェック
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ システムにnpmがインストールされていません
    echo Node.jsと一緒にインストールされるはずです
    pause
    exit /b 1
)

REM 同梱用のnodeディレクトリを作成
echo 🔗 Node.js環境を構築中...
mkdir "%APP_DIR%\node" 2>nul
mkdir "%APP_DIR%\node\bin" 2>nul

REM システムのNode.jsとnpmのパスを取得
for /f "tokens=*" %%i in ('where node') do set "SYSTEM_NODE_PATH=%%i"
for /f "tokens=*" %%i in ('where npm') do set "SYSTEM_NPM_PATH=%%i"
for /f "tokens=*" %%i in ('where npx 2^>nul') do set "SYSTEM_NPX_PATH=%%i"

echo ✅ Node.jsパス: %SYSTEM_NODE_PATH%
echo ✅ npmパス: %SYSTEM_NPM_PATH%

REM Windowsではシンボリックリンクが使えないため、バッチファイルでラッパーを作成
echo @echo off > "%APP_DIR%\node\bin\node.bat"
echo "%SYSTEM_NODE_PATH%" %%* >> "%APP_DIR%\node\bin\node.bat"

echo @echo off > "%APP_DIR%\node\bin\npm.bat"
echo "%SYSTEM_NPM_PATH%" %%* >> "%APP_DIR%\node\bin\npm.bat"

if defined SYSTEM_NPX_PATH (
    echo @echo off > "%APP_DIR%\node\bin\npx.bat"
    echo "%SYSTEM_NPX_PATH%" %%* >> "%APP_DIR%\node\bin\npx.bat"
)

echo ✅ Node.js環境の構築が完了しました
echo 📁 場所: %APP_DIR%\node\
echo 🟢 実行ファイル: %APP_DIR%\node\bin\node.bat
echo 📦 パッケージマネージャー: %APP_DIR%\node\bin\npm.bat

exit /b 0

