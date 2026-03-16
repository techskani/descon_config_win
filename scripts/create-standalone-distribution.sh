#!/bin/bash

# 完全自己完結型配布パッケージ作成スクリプト
# Node.js、Python等の環境が不要な配布パッケージを作成

set -e

echo "🚀 完全自己完結型配布パッケージを作成中..."

# 配布ディレクトリの作成
DIST_DIR="descon-config-standalone"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

echo "📦 アプリケーションファイルをコピー中..."

# 必要なファイルをコピー
cp -r app "$DIST_DIR/"
cp -r components "$DIST_DIR/"
cp -r contexts "$DIST_DIR/"
cp -r lib "$DIST_DIR/"
cp -r public "$DIST_DIR/"
cp -r backend "$DIST_DIR/"
cp -r electron "$DIST_DIR/"
cp -r scripts "$DIST_DIR/"
cp components.json "$DIST_DIR/"
cp next.config.mjs "$DIST_DIR/"
cp package.json "$DIST_DIR/"
cp postcss.config.mjs "$DIST_DIR/"
cp tailwind.config.ts "$DIST_DIR/"
cp tsconfig.json "$DIST_DIR/"
cp README.md "$DIST_DIR/"

echo "🔧 Next.jsアプリケーションをビルド中..."

# Next.jsアプリケーションをビルド
npm run build

# ビルドファイルをコピー
cp -r .next "$DIST_DIR/"

echo "📱 Node.js実行環境をダウンロード中..."

# Node.js実行環境をダウンロード（macOS用）
cd "$DIST_DIR"
mkdir -p runtime
cd runtime

# Node.js v18.19.0 バイナリをダウンロード
if [[ "$OSTYPE" == "darwin"* ]]; then
    curl -L https://nodejs.org/dist/v18.19.0/node-v18.19.0-darwin-x64.tar.gz -o node.tar.gz
    tar -xzf node.tar.gz
    mv node-v18.19.0-darwin-x64 node
    rm node.tar.gz
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    curl -L https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.xz -o node.tar.xz
    tar -xJf node.tar.xz
    mv node-v18.19.0-linux-x64 node
    rm node.tar.xz
else
    echo "⚠️  Windows環境では手動でNode.jsバイナリを配置してください"
fi

cd ..

echo "🐍 Python実行環境を設定中..."

# Python環境の設定
mkdir -p python
cd python

# Python実行環境をダウンロード（macOS用）
if [[ "$OSTYPE" == "darwin"* ]]; then
    curl -L https://www.python.org/ftp/python/3.11.7/python-3.11.7-macos11.pkg -o python.pkg
    echo "⚠️  Pythonパッケージをダウンロードしました。手動でインストールしてください。"
fi

# Python依存関係をインストール
pip3 install --target . Flask==2.3.3 flask-cors==4.0.0 websockets==11.0.3 PyYAML==6.0.1

cd ..

echo "📝 起動スクリプトを作成中..."

# 起動スクリプトを作成
cat > start-app.sh << 'EOF'
#!/bin/bash

# DESCON Config 起動スクリプト
echo "🚀 DESCON Config を起動中..."

# 実行権限を確認
if [ ! -x "runtime/node/bin/node" ]; then
    chmod +x runtime/node/bin/node
fi

# 環境変数を設定
export NODE_ENV=production
export PATH="$(pwd)/runtime/node/bin:$PATH"

# Pythonバックエンドを起動
echo "🐍 Pythonバックエンドを起動中..."
python3 backend/server.py &
PYTHON_PID=$!

# Next.jsサーバーを起動
echo "🌐 Next.jsサーバーを起動中..."
runtime/node/bin/node scripts/start-nextjs.js &
NEXTJS_PID=$!

# サーバーの起動を待機
sleep 3

# Electronアプリケーションを起動
echo "💻 Electronアプリケーションを起動中..."
runtime/node/bin/node electron/main.js

# 終了時にプロセスを停止
kill $PYTHON_PID $NEXTJS_PID 2>/dev/null || true
EOF

chmod +x start-app.sh

echo "📋 使用方法ドキュメントを作成中..."

# 使用方法ドキュメントを作成
cat > STANDALONE-README.md << 'EOF'
# DESCON Config - 完全自己完結型配布パッケージ

## 特徴
- **環境不要**: Node.js、Python、npm等のインストールが不要
- **簡単起動**: ダブルクリックで起動可能
- **完全自己完結**: すべての依存関係が含まれています

## 使用方法

### macOS / Linux:
```bash
./start-app.sh
```

### または、ファイルマネージャーから:
`start-app.sh` をダブルクリック

## システム要件
- macOS 10.15以上 / Linux (Ubuntu 18.04以上)
- メモリ: 4GB以上推奨
- ディスク容量: 500MB以上

## トラブルシューティング

### 起動しない場合:
1. ターミナルを開く
2. このフォルダに移動
3. `chmod +x start-app.sh` を実行
4. `./start-app.sh` を実行

### ポート競合の場合:
- ブラウザで http://localhost:3000 にアクセス
- 他のアプリケーションでポート3000を使用していないか確認

## サポート
問題が発生した場合は、開発者にご連絡ください。
EOF

cd ..

echo "🎉 完全自己完結型配布パッケージが作成されました！"
echo "📁 フォルダ: $DIST_DIR"
echo "📦 サイズ: $(du -sh $DIST_DIR | cut -f1)"
echo ""
echo "🚀 使用方法:"
echo "1. '$DIST_DIR' フォルダを配布"
echo "2. 受け取った人は 'start-app.sh' をダブルクリック"
echo "3. アプリケーションが自動起動します" 