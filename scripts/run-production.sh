#!/bin/bash

echo "Starting DESCON Config in production mode..."

# 位置情報
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# アーキテクチャを確認
ARCH=$(uname -m)
echo "🔍 実行アーキテクチャ: $ARCH"

# 起動時の動的環境構築
echo "🚀 起動時の動的環境構築を開始..."

# Python環境の動的構築
if [ ! -d "$APP_DIR/python/venv" ] || [ ! -x "$APP_DIR/python/venv/bin/python" ]; then
    echo "🔧 Python環境を動的構築中..."
    if [ -f "$APP_DIR/scripts/build-python-env.sh" ]; then
        bash "$APP_DIR/scripts/build-python-env.sh"
        if [ $? -ne 0 ]; then
            echo "❌ Python環境の構築に失敗しました"
            echo "システムにPython3をインストールしてください: https://www.python.org/downloads/"
            exit 1
        fi
    else
        echo "❌ Python環境構築スクリプトが見つかりません"
        exit 1
    fi
fi

# Node.js環境の動的構築
if [ ! -d "$APP_DIR/node/bin" ] || [ ! -x "$APP_DIR/node/bin/node" ]; then
    echo "🔧 Node.js環境を動的構築中..."
    if [ -f "$APP_DIR/scripts/build-node-env.sh" ]; then
        bash "$APP_DIR/scripts/build-node-env.sh"
        if [ $? -ne 0 ]; then
            echo "❌ Node.js環境の構築に失敗しました"
            echo "システムにNode.jsをインストールしてください: https://nodejs.org/"
            exit 1
        fi
    else
        echo "❌ Node.js環境構築スクリプトが見つかりません"
        exit 1
    fi
fi

# 構築された環境の確認
echo "🔍 構築された環境を確認中..."

# Python環境の確認
if [ -x "$APP_DIR/python/venv/bin/python" ]; then
    echo "Activating Python virtual environment..."
    source "$APP_DIR/python/venv/bin/activate"
    PYTHON_CMD="$APP_DIR/python/venv/bin/python"
    PYTHON_TYPE="動的構築仮想環境"
    echo "✅ Python仮想環境を使用します: $($PYTHON_CMD --version)"
else
    echo "❌ Python環境が見つかりません"
    exit 1
fi

# Node.js環境の確認
if [ -x "$APP_DIR/node/bin/node" ]; then
    NODE_CMD="$APP_DIR/node/bin/node"
    echo "✅ 動的構築Node.jsを使用します: $($NODE_CMD --version)"
else
    echo "❌ Node.js環境が見つかりません"
    exit 1
fi

echo "🐍 使用Python: $PYTHON_CMD ($PYTHON_TYPE)"

# 既存のポート占有プロセスを解放（多重起動防止）
echo "Checking port 8765 availability..."
if lsof -nP -iTCP:8765 -sTCP:LISTEN > /dev/null 2>&1; then
  echo "Port 8765 is in use. Stopping existing process..."
  lsof -t -iTCP:8765 -sTCP:LISTEN | xargs -I{} kill {} 2>/dev/null || true
  sleep 1
fi

# Pythonバックエンドサーバーを起動
echo "Starting Python backend server..."
cd "$APP_DIR/backend"
"$PYTHON_CMD" server.py &
PYTHON_PID=$!
cd "$APP_DIR"

# 終了時に確実にクリーンアップ
trap 'kill $PYTHON_PID 2>/dev/null || true' EXIT

# 少し待ってからPythonサーバーの起動を確認
sleep 2
if ! kill -0 $PYTHON_PID 2>/dev/null; then
    echo "Error: Failed to start Python backend server"
    exit 1
fi

echo "Python backend server started (PID: $PYTHON_PID)"
echo "Starting Electron app with embedded Next.js server..."

# Electron CLI（node_modules/electron/cli.js）を同梱Nodeで実行。なければエラー
ELECTRON_CLI="$APP_DIR/node_modules/electron/cli.js"
if [ ! -f "$ELECTRON_CLI" ]; then
  echo "Error: Electron CLI not found at $ELECTRON_CLI"
  echo "Please run 'npm ci' or ensure node_modules is bundled."
  exit 1
fi

# 環境変数を設定してPythonパスを通知
export DESCON_PYTHON_CMD="$PYTHON_CMD"
export DESCON_PYTHON_TYPE="$PYTHON_TYPE"

# Electronアプリを起動（外部でPythonを起動済みであることを通知）
DESCON_EXTERNAL_PY=1 NODE_ENV=production "$NODE_CMD" "$ELECTRON_CLI" .

# クリーンアップ
echo "Stopping Python backend server..."
kill $PYTHON_PID 2>/dev/null || true
echo "✅ アプリケーションが終了しました" 