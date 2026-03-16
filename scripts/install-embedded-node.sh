#!/bin/bash

set -euo pipefail

echo "📦 同梱Node.jsを取得・配置します"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 既存のnodeディレクトリを削除するか確認
if [ -d "$APP_ROOT/node" ]; then
  echo "⚠️  既存のnode/を削除します: $APP_ROOT/node"
  rm -rf "$APP_ROOT/node"
fi

ARCH="$(uname -m)"
case "$ARCH" in
  arm64)
    NODE_PKG="node-v20.16.0-darwin-arm64"
    ;;
  x86_64)
    NODE_PKG="node-v20.16.0-darwin-x64"
    ;;
  *)
    echo "❌ 未対応アーキテクチャ: $ARCH"; exit 1
    ;;
esac

URL="https://nodejs.org/dist/v20.16.0/${NODE_PKG}.tar.gz"
TMP_TGZ="/tmp/${NODE_PKG}.tar.gz"

echo "⬇️  ダウンロード: $URL"
curl -L "$URL" -o "$TMP_TGZ"

echo "📦 展開中..."
tar -xzf "$TMP_TGZ" -C /tmp

echo "🚚 配置: $APP_ROOT/node"
mv "/tmp/${NODE_PKG}" "$APP_ROOT/node"

echo "🧪 バージョン確認: $APP_ROOT/node/bin/node --version"
"$APP_ROOT/node/bin/node" --version

echo "✅ 同梱Node.jsの配置が完了しました"


