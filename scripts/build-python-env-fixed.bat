@echo off
REM 起動時にそのPCに合わせたPython環境を構築（Windows版）- 修正版
chcp 65001 > nul

echo 🔧 起動時にPython環境を構築中...

REM スクリプトのディレクトリを取得
set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%.."

REM アーキテクチャを確認
echo 🔍 実行アーキテクチャ: %PROCESSOR_ARCHITECTURE%

REM 既存のPython環境をクリーンアップ
if exist "%APP_DIR%\python" (
    echo 🗑️  既存のPython環境を削除中...
    rmdir /s /q "%APP_DIR%\python" 2>nul
)

REM Pythonコマンドを検索
set "PYTHON_CMD="
set "PYTHON_VERSION="

echo 🔍 Pythonコマンドを検索中...

REM 1. python3を試行
where python3 >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python3"
    for /f "tokens=2" %%i in ('python3 --version 2^>^&1') do set "PYTHON_VERSION=%%i"
    echo ✅ python3コマンドを検出: !PYTHON_VERSION!
    goto :python_found
)

REM 2. pythonを試行
where python >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python"
    for /f "tokens=2" %%i in ('python --version 2^>^&1') do set "PYTHON_VERSION=%%i"
    echo ✅ pythonコマンドを検出: !PYTHON_VERSION!
    goto :python_found
)

REM 3. py launcherを試行（Windows標準）
where py >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=py -3"
    for /f "tokens=2" %%i in ('py -3 --version 2^>^&1') do set "PYTHON_VERSION=%%i"
    echo ✅ py launcherを検出: !PYTHON_VERSION!
    goto :python_found
)

REM Pythonが見つからない
echo ❌ システムにPythonがインストールされていません
echo.
echo 🔍 解決方法:
echo 1. Python公式サイトからダウンロード: https://www.python.org/downloads/
echo 2. インストール時に「Add Python to PATH」にチェックを入れてください
echo 3. Python 3.7以上が必要です
echo.
pause
exit /b 1

:python_found
echo 🐍 使用Python: %PYTHON_CMD% (%PYTHON_VERSION%)

REM Python仮想環境を作成
echo 🐍 Python仮想環境を作成中...
cd /d "%APP_DIR%"

REM venvモジュールが利用可能かチェック
%PYTHON_CMD% -c "import venv" 2>nul
if %errorlevel% neq 0 (
    echo ❌ venvモジュールが利用できません
    echo Pythonにvenvが含まれていない可能性があります
    echo より新しいPythonバージョンをインストールしてください
    pause
    exit /b 1
)

REM 仮想環境を作成
%PYTHON_CMD% -m venv python\venv
if %errorlevel% neq 0 (
    echo ❌ Python仮想環境の作成に失敗しました
    pause
    exit /b 1
)

REM 仮想環境の作成が成功したかチェック
if not exist "python\venv\Scripts\python.exe" (
    echo ❌ Python仮想環境の作成に失敗しました
    echo ディスク容量を確認してください
    pause
    exit /b 1
)

REM 仮想環境をアクティベート
echo 📦 必要なパッケージをインストール中...
call python\venv\Scripts\activate.bat

REM pipをアップグレード
echo 📦 pipをアップグレード中...
python -m pip install --upgrade pip
if %errorlevel% neq 0 (
    echo ⚠️  pipのアップグレードに失敗しましたが、続行します
)

REM 必要なパッケージをインストール
echo 📦 Flask, WebSockets, PyYAML等をインストール中...
echo 📦 インストール中: flask==2.3.3 flask-cors==4.0.0 websockets==11.0.3 pyyaml==6.0.1

REM パッケージを個別にインストール
python -m pip install flask==2.3.3
if %errorlevel% neq 0 (
    echo ❌ Flaskのインストールに失敗しました
    pause
    exit /b 1
)

python -m pip install flask-cors==4.0.0
if %errorlevel% neq 0 (
    echo ❌ Flask-CORSのインストールに失敗しました
    pause
    exit /b 1
)

python -m pip install websockets==11.0.3
if %errorlevel% neq 0 (
    echo ❌ WebSocketsのインストールに失敗しました
    pause
    exit /b 1
)

python -m pip install pyyaml==6.0.1
if %errorlevel% neq 0 (
    echo ❌ PyYAMLのインストールに失敗しました
    pause
    exit /b 1
)

REM インストールが成功したかチェック
echo 🔍 インストールされたパッケージを確認中...
python -c "import websockets, flask, flask_cors, yaml" 2>nul
if %errorlevel% neq 0 (
    echo ❌ 必要なパッケージのインストールに失敗しました
    echo ネットワーク接続または権限の問題の可能性があります
    pause
    exit /b 1
)

REM requirements.txtを作成
echo flask==2.3.3> python\requirements.txt
echo flask-cors==4.0.0>> python\requirements.txt
echo websockets==11.0.3>> python\requirements.txt
echo pyyaml==6.0.1>> python\requirements.txt

REM 仮想環境を非アクティベート
call deactivate 2>nul

REM 最終確認
if exist "python\venv\Scripts\python.exe" (
    echo ✅ Python環境の構築が完了しました
    echo 📁 場所: %APP_DIR%\python\venv\
    echo 🐍 実行ファイル: %APP_DIR%\python\venv\Scripts\python.exe
    echo 📦 パッケージ: %APP_DIR%\python\requirements.txt
    
    REM 動作確認
    python\venv\Scripts\python.exe -c "import websockets, flask, flask_cors, yaml; print('✅ 全パッケージが正常にインポートできました')" 2>nul
    if %errorlevel% equ 0 (
        echo ✅ 全パッケージの動作確認が完了しました
        exit /b 0
    ) else (
        echo ❌ パッケージの動作確認に失敗しました
        pause
        exit /b 1
    )
) else (
    echo ❌ Python環境の構築に失敗しました
    pause
    exit /b 1
)

