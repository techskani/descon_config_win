#!/bin/bash

echo "🚀 マルチアーキテクチャ対応 DESCON Config .appバンドルを作成中..."

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
    <key>LSArchitecturePriority</key>
    <array>
        <string>arm64</string>
        <string>x86_64</string>
    </array>
</dict>
</plist>
EOF

# マルチアーキテクチャ対応のランチャースクリプトを作成
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
chmod +x scripts/*.sh 2>/dev/null || true
echo "$(date): 実行権限を設定しました" >> "$LOG_FILE"

# アーキテクチャを確認
ARCH=$(uname -m)
echo "$(date): 実行アーキテクチャ: $ARCH" >> "$LOG_FILE"
echo "🔍 実行アーキテクチャ: $ARCH"

# 起動時の動的環境構築
echo "$(date): 起動時の動的環境構築を開始..." >> "$LOG_FILE"
echo "🚀 起動時に動的環境構築を開始..."

# Python環境の動的構築
if [ ! -d "python/venv" ] || [ ! -x "python/venv/bin/python" ]; then
    echo "🔧 Python環境を動的構築中..." | tee -a "$LOG_FILE"
    if [ -f "scripts/build-python-env.sh" ]; then
        # 環境構築を試行
        bash scripts/build-python-env.sh
        BUILD_RESULT=$?
        
        if [ $BUILD_RESULT -ne 0 ]; then
            echo "❌ Python環境の構築に失敗しました (終了コード: $BUILD_RESULT)" | tee -a "$LOG_FILE"
            echo "$(date): Python環境構築失敗 (終了コード: $BUILD_RESULT)" >> "$LOG_FILE"
            
            # 詳細なエラー情報を表示
            echo "🔍 問題の詳細:" | tee -a "$LOG_FILE"
            echo "1. システムにPythonがインストールされているか確認してください" | tee -a "$LOG_FILE"
            echo "2. Python 3.7以上が必要です" | tee -a "$LOG_FILE"
            echo "3. ネットワーク接続を確認してください" | tee -a "$LOG_FILE"
            echo "4. 管理者権限が必要な場合があります" | tee -a "$LOG_FILE"
            
            # システム情報を表示
            echo "🔍 システム情報:" | tee -a "$LOG_FILE"
            echo "OS: $(uname -s)" | tee -a "$LOG_FILE"
            echo "アーキテクチャ: $(uname -m)" | tee -a "$LOG_FILE"
            echo "Python3: $(command -v python3 2>/dev/null || echo '見つかりません')" | tee -a "$LOG_FILE"
            echo "Python: $(command -v python 2>/dev/null || echo '見つかりません')" | tee -a "$LOG_FILE"
            
            osascript -e 'display alert "Python環境構築エラー" message "Python環境の構築に失敗しました。\n\n詳細:\n• システムにPython3.7以上が必要\n• ネットワーク接続を確認\n• 管理者権限が必要な場合あり\n\nログファイル: /tmp/descon-config-app.log"'
            read -p "Enterキーを押してください..."; exit 1
        fi
        
        # 構築後の確認
        if [ -x "python/venv/bin/python" ]; then
            echo "✅ Python環境の構築が完了しました" | tee -a "$LOG_FILE"
            echo "$(date): Python環境構築完了" >> "$LOG_FILE"
        else
            echo "❌ Python環境の構築が完了していません" | tee -a "$LOG_FILE"
            echo "$(date): Python環境構築未完了" >> "$LOG_FILE"
            osascript -e 'display alert "エラー" message "Python環境の構築が完了していません。"'
            read -p "Enterキーを押してください..."; exit 1
        fi
    else
        echo "❌ Python環境構築スクリプトが見つかりません" | tee -a "$LOG_FILE"
        echo "$(date): Python環境構築スクリプト未発見" >> "$LOG_FILE"
        osascript -e 'display alert "エラー" message "Python環境構築スクリプトが見つかりません。"'
        read -p "Enterキーを押してください..."; exit 1
    fi
fi

# Node.js環境の動的構築
if [ ! -d "node/bin" ] || [ ! -x "node/bin/node" ]; then
    echo "🔧 Node.js環境を動的構築中..." | tee -a "$LOG_FILE"
    if [ -f "scripts/build-node-env.sh" ]; then
        bash scripts/build-node-env.sh
        if [ $? -ne 0 ]; then
            echo "❌ Node.js環境の構築に失敗しました" | tee -a "$LOG_FILE"
            osascript -e 'display alert "エラー" message "Node.js環境の構築に失敗しました。システムにNode.jsをインストールしてください。"'
            read -p "Enterキーを押してください..."; exit 1
        fi
    else
        echo "❌ Node.js環境構築スクリプトが見つかりません" | tee -a "$LOG_FILE"
        osascript -e 'display alert "エラー" message "Node.js環境構築スクリプトが見つかりません。"'
        read -p "Enterキーを押してください..."; exit 1
    fi
fi

# 構築された環境の確認
echo "$(date): 構築された環境を確認中..." >> "$LOG_FILE"
echo "🔍 構築された環境を確認中..."

# Python環境の確認
if [ -x "python/venv/bin/python" ]; then
    PYTHON_CMD="python/venv/bin/python"
    PYTHON_TYPE="動的構築仮想環境"
    echo "✅ Python仮想環境を使用します: $($PYTHON_CMD --version)" | tee -a "$LOG_FILE"
    echo "$(date): Python仮想環境: $($PYTHON_CMD --version)" >> "$LOG_FILE"
else
    echo "❌ Python環境が見つかりません" | tee -a "$LOG_FILE"
    osascript -e 'display alert "エラー" message "Python環境が見つかりません。"'
    read -p "Enterキーを押してください..."; exit 1
fi

# Node.js環境の確認
if [ -x "node/bin/node" ] && [ -f "node/lib/node_modules/npm/bin/npm-cli.js" ]; then
    NODE_CMD="node/bin/node"
    NPM_CMD="\"node/bin/node\" \"node/lib/node_modules/npm/bin/npm-cli.js\""
    echo "✅ 動的構築Node.jsを使用します: $($NODE_CMD --version)" | tee -a "$LOG_FILE"
    echo "$(date): 動的構築Node.js: $($NODE_CMD --version)" >> "$LOG_FILE"
else
    echo "❌ Node.js環境が見つかりません" | tee -a "$LOG_FILE"
    osascript -e 'display alert "エラー" message "Node.js環境が見つかりません。"'
    read -p "Enterキーを押してください..."; exit 1
fi

echo "$(date): NODE_CMD=$NODE_CMD" >> "$LOG_FILE"
echo "$(date): NPM_CMD=$NPM_CMD" >> "$LOG_FILE"
echo "$(date): 使用Python: $PYTHON_CMD ($PYTHON_TYPE)" >> "$LOG_FILE"
echo "🐍 使用Python: $PYTHON_CMD ($PYTHON_TYPE)"

# Node.js依存関係の確認
if [ ! -d "node_modules" ]; then
    echo "📦 Node.js依存関係をインストール中..." | tee -a "$LOG_FILE"
    echo "$(date): Node.js依存関係をインストール中..." >> "$LOG_FILE"
    osascript -e 'display alert "セットアップ中" message "Node.js依存関係をインストールしています。お待ちください..."'
    eval $NPM_CMD install --production
    echo "$(date): Node.js依存関係のインストールが完了しました" >> "$LOG_FILE"
fi

# Next.jsアプリケーションのビルド確認
if [ ! -d ".next" ]; then
    echo "🔨 Next.jsアプリケーションをビルド中..." | tee -a "$LOG_FILE"
    echo "$(date): Next.jsアプリケーションをビルド中..." >> "$LOG_FILE"
    osascript -e 'display alert "ビルド中" message "アプリケーションをビルドしています。お待ちください..."'
    eval $NPM_CMD run build
    echo "$(date): Next.jsアプリケーションのビルドが完了しました" >> "$LOG_FILE"
fi

echo "💻 アプリケーションを起動中..." | tee -a "$LOG_FILE"
echo "$(date): アプリケーションを起動中..." >> "$LOG_FILE"

# 環境変数を設定してPythonパスを通知
export DESCON_PYTHON_CMD="$PYTHON_CMD"
export DESCON_PYTHON_TYPE="$PYTHON_TYPE"

# アプリケーションを起動
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

# 動的環境構築用の空のディレクトリを作成（環境は起動時に構築）
echo "🔧 動的環境構築用のディレクトリを作成中..."
mkdir -p "DESCON Config.app/Contents/Resources/python"
mkdir -p "DESCON Config.app/Contents/Resources/node/bin"
mkdir -p "DESCON Config.app/Contents/Resources/node/lib/node_modules/npm/bin"

# 設定ファイルをコピー
cp *.json "DESCON Config.app/Contents/Resources/"
cp *.mjs "DESCON Config.app/Contents/Resources/"
cp *.ts "DESCON Config.app/Contents/Resources/" 2>/dev/null || true

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

echo "✅ マルチアーキテクチャ対応 DESCON Config.app が作成されました！"
echo "📁 場所: $(pwd)/DESCON Config.app"
echo ""
echo "🚀 特徴:"
echo "   - Intel Mac (x86_64) と Apple Silicon Mac (arm64) の両方で動作"
echo "   - システムのPython/Node.jsを優先使用"
echo "   - 不足時は同梱環境に自動フォールバック"
echo ""
echo "使用方法:"
echo "1. 'DESCON Config.app' をダブルクリック"
echo "2. 初回起動時は自動でセットアップが実行されます"
echo "3. アプリケーションが起動します"
echo ""
echo "💡 デバッグ情報:"
echo "   - ログファイル: /tmp/descon-config-app.log"
echo "   - プロセス確認: ps aux | grep electron"
echo ""
echo "🔧 事前セットアップ（推奨）:"
echo "   ./scripts/setup-multiarch.sh"

