#!/bin/bash
# 起動時にそのPCのアーキテクチャに合わせたPython環境を構築

echo "🔧 起動時にPython環境を構築中..."

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# アーキテクチャを確認
ARCH=$(uname -m)
echo "🔍 実行アーキテクチャ: $ARCH"

# 既存のPython環境をクリーンアップ
rm -rf "$APP_DIR/python"

# システムのPythonが利用可能かチェック（python3とpythonの両方を試行）
PYTHON_CMD=""
PYTHON_VERSION=""

echo "🔍 Pythonコマンドを検索中..."

# 1. python3を試行
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
    echo "✅ python3コマンドを検出: $PYTHON_VERSION"
    
    # バージョンチェック
    if [[ "$PYTHON_VERSION" =~ ^3\.[7-9] ]] || [[ "$PYTHON_VERSION" =~ ^3\.[0-9][0-9] ]]; then
        echo "✅ Python 3.7以上を確認: $PYTHON_VERSION"
    else
        echo "⚠️  Python 3.7未満を検出: $PYTHON_VERSION (互換性の問題が発生する可能性があります)"
    fi
# 2. pythonを試行
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
    PYTHON_VERSION=$(python --version 2>&1 | cut -d' ' -f2)
    echo "✅ pythonコマンドを検出: $PYTHON_VERSION"
    
    # バージョンチェック
    if [[ "$PYTHON_VERSION" =~ ^3\.[7-9] ]] || [[ "$PYTHON_VERSION" =~ ^3\.[0-9][0-9] ]]; then
        echo "✅ Python 3.7以上を確認: $PYTHON_VERSION"
    else
        echo "⚠️  Python 3.7未満を検出: $PYTHON_VERSION (互換性の問題が発生する可能性があります)"
    fi
# 3. その他のPythonコマンドを試行
elif command -v python3.11 >/dev/null 2>&1; then
    PYTHON_CMD="python3.11"
    PYTHON_VERSION=$(python3.11 --version 2>&1 | cut -d' ' -f2)
    echo "✅ python3.11コマンドを検出: $PYTHON_VERSION"
elif command -v python3.10 >/dev/null 2>&1; then
    PYTHON_CMD="python3.10"
    PYTHON_VERSION=$(python3.10 --version 2>&1 | cut -d' ' -f2)
    echo "✅ python3.10コマンドを検出: $PYTHON_VERSION"
elif command -v python3.9 >/dev/null 2>&1; then
    PYTHON_CMD="python3.9"
    PYTHON_VERSION=$(python3.9 --version 2>&1 | cut -d' ' -f2)
    echo "✅ python3.9コマンドを検出: $PYTHON_VERSION"
else
    echo "❌ システムにPythonがインストールされていません"
    echo ""
    echo "🔍 解決方法:"
    echo "1. Python公式サイトからダウンロード: https://www.python.org/downloads/"
    echo "2. Homebrew (macOS): brew install python@3.11"
    echo "3. パッケージマネージャー: sudo apt install python3 (Ubuntu/Debian)"
    echo "4. パッケージマネージャー: sudo yum install python3 (CentOS/RHEL)"
    echo ""
    echo "⚠️  注意: Python 3.7以上が必要です"
    exit 1
fi

echo "🐍 使用Python: $PYTHON_CMD ($PYTHON_VERSION)"

# Python仮想環境を作成
echo "🐍 Python仮想環境を作成中..."
cd "$APP_DIR"

# venvモジュールが利用可能かチェック
if ! $PYTHON_CMD -c "import venv" 2>/dev/null; then
    echo "❌ venvモジュールが利用できません"
    echo "システムのPythonにvenvが含まれていない可能性があります"
    echo ""
    echo "🔍 解決方法:"
    echo "1. python3-venvパッケージをインストール"
    echo "2. より新しいPythonバージョンを使用"
    echo "3. virtualenvを使用: pip install virtualenv"
    exit 1
fi

# 仮想環境を作成
$PYTHON_CMD -m venv python/venv

# 仮想環境の作成が成功したかチェック
if [ ! -d "python/venv" ] || [ ! -x "python/venv/bin/python" ]; then
    echo "❌ Python仮想環境の作成に失敗しました"
    echo "システムのPythonが仮想環境をサポートしていない可能性があります"
    echo ""
    echo "🔍 解決方法:"
    echo "1. 管理者権限で実行"
    echo "2. ディスク容量を確認"
    echo "3. より新しいPythonバージョンを使用"
    exit 1
fi

# 仮想環境をアクティベート
echo "📦 必要なパッケージをインストール中..."
source python/venv/bin/activate

# 仮想環境内のPythonパスを確認
VENV_PYTHON=$(which python)
echo "🔍 仮想環境内Python: $VENV_PYTHON"

# pipをアップグレード
echo "📦 pipをアップグレード中..."
python -m pip install --upgrade pip

# 必要なパッケージをインストール
echo "📦 Flask, WebSockets, PyYAML等をインストール中..."
echo "📦 インストール中: flask==2.3.3 flask-cors==4.0.0 websockets==11.0.3 pyyaml==6.0.1"

# パッケージを個別にインストールしてエラーを特定
python -m pip install flask==2.3.3
if [ $? -ne 0 ]; then
    echo "❌ Flaskのインストールに失敗しました"
    exit 1
fi

python -m pip install flask-cors==4.0.0
if [ $? -ne 0 ]; then
    echo "❌ Flask-CORSのインストールに失敗しました"
    exit 1
fi

python -m pip install websockets==11.0.3
if [ $? -ne 0 ]; then
    echo "❌ WebSocketsのインストールに失敗しました"
    exit 1
fi

python -m pip install pyyaml==6.0.1
if [ $? -ne 0 ]; then
    echo "❌ PyYAMLのインストールに失敗しました"
    exit 1
fi

# インストールが成功したかチェック
echo "🔍 インストールされたパッケージを確認中..."
if ! python -c "import websockets, flask, flask_cors, yaml" 2>/dev/null; then
    echo "❌ 必要なパッケージのインストールに失敗しました"
    echo "ネットワーク接続または権限の問題の可能性があります"
    echo ""
    echo "🔍 トラブルシューティング:"
    echo "1. ネットワーク接続を確認"
    echo "2. プロキシ設定を確認"
    echo "3. 管理者権限で実行"
    echo "4. ファイアウォール設定を確認"
    exit 1
fi

# requirements.txtを作成
cat > python/requirements.txt << 'PYTHON_REQ'
flask==2.3.3
flask-cors==4.0.0
websockets==11.0.3
pyyaml==6.0.1
PYTHON_REQ

# 仮想環境を非アクティベート
deactivate

# 最終確認
if [ -x "python/venv/bin/python" ]; then
    echo "✅ Python環境の構築が完了しました"
    echo "📁 場所: $APP_DIR/python/venv/"
    echo "🐍 実行ファイル: $APP_DIR/python/venv/bin/python"
    echo "📦 パッケージ: $APP_DIR/python/requirements.txt"
    echo "🔍 動作確認: $APP_DIR/python/venv/bin/python --version"
    
    # 動作確認
    if "$APP_DIR/python/venv/bin/python" -c "import websockets, flask, flask_cors, yaml; print('✅ 全パッケージが正常にインポートできました')" 2>/dev/null; then
        echo "✅ 全パッケージの動作確認が完了しました"
        exit 0
    else
        echo "❌ パッケージの動作確認に失敗しました"
        exit 1
    fi
else
    echo "❌ Python環境の構築に失敗しました"
    exit 1
fi
