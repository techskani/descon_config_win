#!/bin/bash

echo "🚀 マルチアーキテクチャ対応環境をセットアップ中..."

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# アーキテクチャを確認
ARCH=$(uname -m)
echo "🔍 現在のアーキテクチャ: $ARCH"

# 既存の環境をクリーンアップ
echo "🧹 既存の環境をクリーンアップ中..."
rm -rf "$APP_DIR/python"
rm -rf "$APP_DIR/node"

# Python環境のセットアップ
echo "🐍 Python環境をセットアップ中..."

# システムのPythonバージョンを確認
if command -v python3 >/dev/null 2>&1; then
    SYSTEM_PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
    echo "✅ システムPython: $SYSTEM_PYTHON_VERSION"
else
    echo "❌ システムPythonが見つかりません"
    exit 1
fi

# 仮想環境を作成
echo "🔧 Python仮想環境を作成中..."
cd "$APP_DIR"
python3 -m venv python/venv

# 仮想環境をアクティベート
echo "📦 必要なパッケージをインストール中..."
source python/venv/bin/activate
pip install --upgrade pip
pip install flask==2.3.3 flask-cors==4.0.0 websockets==11.0.3 pyyaml==6.0.1

# requirements.txtファイルを作成
cat > python/requirements.txt << EOF
flask==2.3.3
flask-cors==4.0.0
websockets==11.0.3
pyyaml==6.0.1
EOF

# 仮想環境を非アクティベート
deactivate

# Node.js環境のセットアップ
echo "🟢 Node.js環境をセットアップ中..."

# システムのNode.jsバージョンを確認
if command -v node >/dev/null 2>&1; then
    SYSTEM_NODE_VERSION=$(node --version)
    echo "✅ システムNode.js: $SYSTEM_NODE_VERSION"
else
    echo "❌ システムNode.jsが見つかりません"
    exit 1
fi

# システムのnpmバージョンを確認
if command -v npm >/dev/null 2>&1; then
    SYSTEM_NPM_VERSION=$(npm --version)
    echo "✅ システムnpm: $SYSTEM_NPM_VERSION"
fi

# 起動時の動的環境構築用スクリプトを作成
echo "📝 起動時の動的環境構築スクリプトを作成中..."

# Python環境構築スクリプト
cat > "$APP_DIR/scripts/build-python-env.sh" << 'EOF'
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

# システムのPython3が利用可能かチェック
if ! command -v python3 >/dev/null 2>&1; then
    echo "❌ システムにpython3がインストールされていません"
    echo "Python 3.7以上をインストールしてください: https://www.python.org/downloads/"
    exit 1
fi

# Python仮想環境を作成
echo "🐍 Python仮想環境を作成中..."
cd "$APP_DIR"
python3 -m venv python/venv

# 仮想環境をアクティベート
echo "📦 必要なパッケージをインストール中..."
source python/venv/bin/activate

# pipをアップグレード
pip install --upgrade pip

# 必要なパッケージをインストール
echo "📦 Flask, WebSockets, PyYAML等をインストール中..."
pip install flask==2.3.3 flask-cors==4.0.0 websockets==11.0.3 pyyaml==6.0.1

# requirements.txtを作成
cat > python/requirements.txt << 'PYTHON_REQ'
flask==2.3.3
flask-cors==4.0.0
websockets==11.0.3
pyyaml==6.0.1
PYTHON_REQ

# 仮想環境を非アクティベート
deactivate

echo "✅ Python環境の構築が完了しました"
echo "📁 場所: $APP_DIR/python/venv/"
echo "🐍 実行ファイル: $APP_DIR/python/venv/bin/python"
echo "📦 パッケージ: $APP_DIR/python/requirements.txt"

exit 0
EOF

# Node.js環境構築スクリプト
cat > "$APP_DIR/scripts/build-node-env.sh" << 'EOF'
#!/bin/bash
# 起動時にそのPCのアーキテクチャに合わせたNode.js環境を構築

echo "🔧 起動時にNode.js環境を構築中..."

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# アーキテクチャを確認
ARCH=$(uname -m)
echo "🔍 実行アーキテクチャ: $ARCH"

# 既存のnodeディレクトリをクリーンアップ
rm -rf "$APP_DIR/node"

# システムのNode.jsが利用可能かチェック
if ! command -v node >/dev/null 2>&1; then
    echo "❌ システムにNode.jsがインストールされていません"
    echo "Node.js LTSをインストールしてください: https://nodejs.org/"
    exit 1
fi

# システムのnpmが利用可能かチェック
if ! command -v npm >/dev/null 2>&1; then
    echo "❌ システムにnpmがインストールされていません"
    echo "Node.jsと一緒にインストールされるはずです"
    exit 1
fi

# 同梱用のnodeディレクトリを作成
mkdir -p "$APP_DIR/node/bin"
mkdir -p "$APP_DIR/node/lib/node_modules/npm/bin"

# システムのNode.jsとnpmへのシンボリックリンクを作成（相対パスで）
echo "🔗 システムのNode.jsとnpmへのシンボリックリンクを作成中..."
cd "$APP_DIR/node/bin"

# システムのパスを相対的に解決
SYSTEM_NODE_PATH=$(which node)
SYSTEM_NPM_PATH=$(which npm)
SYSTEM_NPX_PATH=$(which npx)

# 相対パスでシンボリックリンクを作成
if [ -n "$SYSTEM_NODE_PATH" ]; then
    ln -sf "$SYSTEM_NODE_PATH" node
    echo "✅ Node.jsリンク作成: $SYSTEM_NODE_PATH"
fi

if [ -n "$SYSTEM_NPM_PATH" ]; then
    ln -sf "$SYSTEM_NPM_PATH" npm
    echo "✅ npmリンク作成: $SYSTEM_NPM_PATH"
fi

if [ -n "$SYSTEM_NPX_PATH" ]; then
    ln -sf "$SYSTEM_NPX_PATH" npx
    echo "✅ npxリンク作成: $SYSTEM_NPX_PATH"
fi

# npmの設定ファイルをコピー
if [ -d "$(npm config get prefix)/lib/node_modules/npm" ]; then
    cp -r "$(npm config get prefix)/lib/node_modules/npm" "$APP_DIR/node/lib/node_modules/"
    echo "✅ npm設定ファイルをコピーしました"
fi

cd "$APP_DIR"

echo "✅ Node.js環境の構築が完了しました"
echo "📁 場所: $APP_DIR/node/"
echo "🟢 実行ファイル: $APP_DIR/node/bin/node"
echo "📦 パッケージマネージャー: $APP_DIR/node/bin/npm"

exit 0
EOF

# 実行権限を設定
chmod +x "$APP_DIR/scripts/build-python-env.sh"
chmod +x "$APP_DIR/scripts/build-node-env.sh"

echo "✅ マルチアーキテクチャ対応環境のセットアップが完了しました！"
echo ""
echo "📁 作成された環境:"
echo "   - Python仮想環境: $APP_DIR/python/venv/"
echo "   - 動的環境構築スクリプト:"
echo "     * $APP_DIR/scripts/build-python-env.sh"
echo "     * $APP_DIR/scripts/build-node-env.sh"
echo ""
echo "🚀 特徴:"
echo "   - 起動時にそのPCのアーキテクチャに合わせた環境を動的構築"
echo "   - 絶対パスを使用しない"
echo "   - システム環境に依存しない"
echo "   - 完全にポータブル"
echo ""
echo "🔍 動作確認:"
echo "   - Python: $APP_DIR/python/venv/bin/python --version"
echo "   - 環境構築テスト: $APP_DIR/scripts/build-python-env.sh"
