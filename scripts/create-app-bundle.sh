#!/bin/bash

echo "🚀 DESCON Config .appバンドルを作成中..."

# スクリプトのディレクトリに移動
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# 既存の.appを削除
rm -rf "DESCON Config.app"

# .appバンドルの構造を作成
mkdir -p "DESCON Config.app/Contents/MacOS"
mkdir -p "DESCON Config.app/Contents/Resources"
mkdir -p "DESCON Config.app/Contents/Resources/python"
mkdir -p "DESCON Config.app/Contents/Resources/backend"
mkdir -p "DESCON Config.app/Contents/Resources/node"

# Info.plistを作成
cat > "DESCON Config.app/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>DESCON-Config-Launcher</string>
    <key>CFBundleIdentifier</key>
    <string>com.descon.config</string>
    <key>CFBundleName</key>
    <string>DESCON Config</string>
    <key>CFBundleDisplayName</key>
    <string>DESCON Config</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.utilities</string>
    <key>CFBundleIconFile</key>
    <string>icon.icns</string>
</dict>
</plist>
EOF

# ランチャースクリプトを作成（同梱Node必須・仮想環境優先／埋め込みPythonfallback）
cat > "DESCON Config.app/Contents/MacOS/DESCON-Config-Launcher" << 'EOF'
#!/bin/bash

# デバッグログファイルを作成
LOG_FILE="/tmp/descon-config-app.log"
echo "$(date): DESCON Config.app が起動されました" >> "$LOG_FILE"

# Resources ディレクトリ
RESOURCES_DIR="$(cd "$(dirname "$0")/../Resources" && pwd)"
echo "$(date): Resourcesディレクトリ: $RESOURCES_DIR" >> "$LOG_FILE"

# 作業ディレクトリをResourcesに
cd "$RESOURCES_DIR"
echo "$(date): 作業ディレクトリに移動: $(pwd)" >> "$LOG_FILE"

# 実行権限を確認
chmod +x scripts/*.sh install.sh 2>/dev/null || true
echo "$(date): 実行権限を設定しました" >> "$LOG_FILE"

# Node.js（同梱のみ許可）とnpmのパス設定
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
EMBEDDED_NODE_DIR="$RESOURCES_DIR/node"
EMBEDDED_NODE_BIN="$EMBEDDED_NODE_DIR/bin/node"
EMBEDDED_NPM_CLI="$EMBEDDED_NODE_DIR/lib/node_modules/npm/bin/npm-cli.js"
echo "$(date): 同梱Node想定パス: $EMBEDDED_NODE_BIN" >> "$LOG_FILE"
echo "$(date): 同梱npm-cli想定パス: $EMBEDDED_NPM_CLI" >> "$LOG_FILE"

if [ -x "$EMBEDDED_NODE_BIN" ] && [ -f "$EMBEDDED_NPM_CLI" ]; then
    NODE_CMD="$EMBEDDED_NODE_BIN"
    NPM_CMD="\"$EMBEDDED_NODE_DIR/bin/node\" \"$EMBEDDED_NPM_CLI\""
    echo "✅ 同梱Node.jsを使用します: $($EMBEDDED_NODE_BIN --version)" | tee -a "$LOG_FILE"
else
    echo "❌ 同梱Node/npmが見つかりません。'node/' ディレクトリが必要です。" | tee -a "$LOG_FILE"
    osascript -e 'display alert "エラー" message "同梱Node.jsが見つかりません。アプリ同梱のnode/ を含めてください。"'
    read -p "Enterキーを押してください..."; exit 1
fi

echo "$(date): NODE_CMD=$NODE_CMD" >> "$LOG_FILE"
echo "$(date): NPM_CMD=$NPM_CMD" >> "$LOG_FILE"

# Python環境の確認（venv優先／同梱Pythonfallback／どちらも無ければ自動セットアップ）
echo "$(date): Python環境の事前確認" >> "$LOG_FILE"
if [ ! -x "python/venv/bin/python" ] && [ ! -x "python/bin/python3" ]; then
  echo "⚠️  Python環境が見つからないためセットアップを試行します" | tee -a "$LOG_FILE"
  if [ -f "scripts/setup-python.sh" ]; then
    bash scripts/setup-python.sh >> "$LOG_FILE" 2>&1 || true
  fi
fi

if [ -x "python/venv/bin/python" ]; then
  echo "✅ 仮想環境を検出 (python/venv/bin/python)" | tee -a "$LOG_FILE"
elif [ -x "python/bin/python3" ]; then
  echo "✅ 同梱Pythonを検出 (fallback)" | tee -a "$LOG_FILE"
  export DESCON_USE_EMBEDDED_PY=1
else
  echo "❌ Python実行環境が見つかりません（python/venv も python/bin/python3 も無し）" | tee -a "$LOG_FILE"
  osascript -e 'display alert "エラー" message "Pythonが見つかりません。オンラインで scripts/setup-python.sh を実行してから再配布してください。"'
  read -p "Enterキーを押してください..."; exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "📦 Node.js依存関係をインストール中..."
    echo "$(date): Node.js依存関係をインストール中..." >> "$LOG_FILE"
    osascript -e 'display alert "セットアップ中" message "Node.js依存関係をインストールしています。お待ちください..."'
    eval $NPM_CMD install --production
    echo "$(date): Node.js依存関係のインストールが完了しました" >> "$LOG_FILE"
fi

if [ ! -d ".next" ]; then
    echo "🔨 Next.jsアプリケーションをビルド中..."
    echo "$(date): Next.jsアプリケーションをビルド中..." >> "$LOG_FILE"
    osascript -e 'display alert "ビルド中" message "アプリケーションをビルドしています。お待ちください..."'
    eval $NPM_CMD run build
    echo "$(date): Next.jsアプリケーションのビルドが完了しました" >> "$LOG_FILE"
fi

echo "💻 アプリケーションを起動中..."
echo "$(date): アプリケーションを起動中..." >> "$LOG_FILE"
eval $NPM_CMD run run-prod

echo "✅ アプリケーションが終了しました"
echo "$(date): アプリケーションが終了しました" >> "$LOG_FILE"
read -p "Enterキーを押してください..."
EOF

# 実行権限を設定
chmod +x "DESCON Config.app/Contents/MacOS/DESCON-Config-Launcher"

# 必要なファイルをコピー
echo "📁 ファイルをコピー中..."

# アプリケーションファイルをコピー
cp -r app "DESCON Config.app/Contents/Resources/"
cp -r components "DESCON Config.app/Contents/Resources/"
cp -r contexts "DESCON Config.app/Contents/Resources/"
cp -r lib "DESCON Config.app/Contents/Resources/"
cp -r electron "DESCON Config.app/Contents/Resources/"
cp -r backend "DESCON Config.app/Contents/Resources/"
cp -r public "DESCON Config.app/Contents/Resources/"
cp -r scripts "DESCON Config.app/Contents/Resources/"
if [ -d "node" ]; then
    cp -r node "DESCON Config.app/Contents/Resources/"
fi
cp *.json "DESCON Config.app/Contents/Resources/"
cp *.mjs "DESCON Config.app/Contents/Resources/"
cp *.ts "DESCON Config.app/Contents/Resources/" 2>/dev/null || true

# Python環境をコピー
if [ -d "python" ]; then
    cp -r python "DESCON Config.app/Contents/Resources/"
fi

# 完全なnode_modulesをコピー
if [ -d "node_modules" ]; then
    echo "📦 node_modulesをコピー中..."
    cp -r node_modules "DESCON Config.app/Contents/Resources/"
fi

# .nextディレクトリをコピー
if [ -d ".next" ]; then
    cp -r .next "DESCON Config.app/Contents/Resources/"
fi

# アイコンファイルをコピー
if [ -f "electron/icon.icns" ]; then
    cp electron/icon.icns "DESCON Config.app/Contents/Resources/"
fi

echo "✅ DESCON Config.app が作成されました！"
echo "📁 場所: $(pwd)/DESCON Config.app"
echo ""
echo "使用方法:"
echo "1. 'DESCON Config.app' をダブルクリック"
echo "2. 初回起動時は自動でセットアップが実行されます"
echo "3. アプリケーションが起動します"
echo ""
echo "💡 デバッグ情報:"
echo "   - ログファイル: /tmp/descon-config-app.log"
echo "   - プロセス確認: ps aux | grep electron" 