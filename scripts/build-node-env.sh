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
