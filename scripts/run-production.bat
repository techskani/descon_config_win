@echo off
REM DESCON設定ツール起動スクリプト（Windows版）
chcp 65001 > nul
title DESCON設定ツール

echo Starting DESCON Config in production mode...

REM スクリプトのディレクトリを取得
set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%.."

REM アーキテクチャを確認
echo 🔍 実行アーキテクチャ: %PROCESSOR_ARCHITECTURE%

REM 起動時の動的環境構築
echo 🚀 起動時の動的環境構築を開始...

REM Python環境の動的構築
if not exist "%APP_DIR%\python\venv\Scripts\python.exe" (
    echo 🔧 Python環境を動的構築中...
    if exist "%APP_DIR%\scripts\build-python-env.bat" (
        call "%APP_DIR%\scripts\build-python-env.bat"
        if %errorlevel% neq 0 (
            echo ❌ Python環境の構築に失敗しました
            echo システムにPython3をインストールしてください: https://www.python.org/downloads/
            pause
            exit /b 1
        )
    ) else (
        echo ❌ Python環境構築スクリプトが見つかりません
        pause
        exit /b 1
    )
)

REM Node.js環境の動的構築
if not exist "%APP_DIR%\node\bin\node.bat" (
    echo 🔧 Node.js環境を動的構築中...
    if exist "%APP_DIR%\scripts\build-node-env.bat" (
        call "%APP_DIR%\scripts\build-node-env.bat"
        if %errorlevel% neq 0 (
            echo ❌ Node.js環境の構築に失敗しました
            echo システムにNode.jsをインストールしてください: https://nodejs.org/
            pause
            exit /b 1
        )
    ) else (
        echo ❌ Node.js環境構築スクリプトが見つかりません
        pause
        exit /b 1
    )
)

REM 構築された環境の確認
echo 🔍 構築された環境を確認中...

REM Python環境の確認
if exist "%APP_DIR%\python\venv\Scripts\python.exe" (
    set "PYTHON_CMD=%APP_DIR%\python\venv\Scripts\python.exe"
    set "PYTHON_TYPE=動的構築仮想環境"
    echo ✅ Python仮想環境を使用します
    for /f "tokens=*" %%i in ('"%PYTHON_CMD%" --version 2^>^&1') do echo    %%i
) else (
    echo ❌ Python環境が見つかりません
    pause
    exit /b 1
)

REM Node.js環境の確認
for /f "tokens=*" %%i in ('where node 2^>nul') do set "NODE_CMD=%%i"
if not defined NODE_CMD (
    echo ❌ Node.js環境が見つかりません
    pause
    exit /b 1
)
echo ✅ Node.jsを使用します
for /f "tokens=*" %%i in ('node --version 2^>^&1') do echo    %%i

echo 🐍 使用Python: %PYTHON_CMD% (%PYTHON_TYPE%)

REM 既存のポート占有プロセスを確認
echo Checking port 8765 availability...
netstat -ano | findstr ":8765" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo Port 8765 is in use. Attempting to stop existing process...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765" ^| findstr "LISTENING"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

REM Pythonバックエンドサーバーを起動
echo Starting Python backend server...
cd /d "%APP_DIR%\backend"
start /b "" "%PYTHON_CMD%" server.py
set "PYTHON_PID=%ERRORLEVEL%"
cd /d "%APP_DIR%"

REM 少し待ってからPythonサーバーの起動を確認
timeout /t 2 /nobreak >nul
netstat -ano | findstr ":8765" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Failed to start Python backend server
    pause
    exit /b 1
)

echo ✅ Python backend server started
echo Starting Electron app with embedded Next.js server...

REM Electron CLI（node_modules/electron/cli.js）を実行
set "ELECTRON_CLI=%APP_DIR%\node_modules\electron\cli.js"
if not exist "%ELECTRON_CLI%" (
    echo ❌ Electron CLI not found at %ELECTRON_CLI%
    echo Please run 'npm ci' or ensure node_modules is bundled.
    pause
    exit /b 1
)

REM 環境変数を設定してPythonパスを通知
set "DESCON_PYTHON_CMD=%PYTHON_CMD%"
set "DESCON_PYTHON_TYPE=%PYTHON_TYPE%"
set "DESCON_EXTERNAL_PY=1"
set "NODE_ENV=production"

REM Electronアプリを起動
"%NODE_CMD%" "%ELECTRON_CLI%" .

REM クリーンアップ（Electronが終了した後）
echo Stopping Python backend server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo ✅ アプリケーションが終了しました
pause

