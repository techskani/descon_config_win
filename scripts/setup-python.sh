#!/bin/bash

# Python実行環境セットアップスクリプト
echo "Setting up Python environment for Electron app..."

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 既存のPythonディレクトリを削除
rm -rf "$APP_DIR/python"

# Pythonディレクトリを作成
mkdir -p "$APP_DIR/python"

# Pythonの仮想環境を作成
echo "Creating Python virtual environment..."
cd "$APP_DIR"
python3 -m venv python/venv

# 仮想環境をアクティベート
echo "Activating virtual environment..."
source python/venv/bin/activate

# 必要なPythonパッケージをインストール
echo "Installing Python packages..."
pip install --upgrade pip
pip install flask==2.3.3 flask-cors==4.0.0 websockets==11.0.3 pyyaml==6.0.1

# requirements.txtファイルを作成
cat > python/requirements.txt << EOF
flask==2.3.3
flask-cors==4.0.0
websockets==11.0.3
pyyaml==6.0.1
EOF

# Pythonランタイムを本番用にコピー
echo "Copying Python runtime..."
mkdir -p python/bin
mkdir -p python/lib

# Python実行ファイルをコピー
cp python/venv/bin/python3 python/bin/
cp python/venv/bin/python python/bin/ 2>/dev/null || true

# Python標準ライブラリとsite-packagesをコピー
cp -r python/venv/lib python/

# 実行権限を設定
chmod +x python/bin/python3
chmod +x python/bin/python 2>/dev/null || true

echo "Python environment setup complete!"
echo "Python executable: $(which python)"
echo "Installed packages:"
pip list

# 仮想環境を非アクティベート化
deactivate

echo "✅ Python環境のセットアップが完了しました"
echo "📁 Python実行ファイル: python/bin/python3"
echo "📦 インストール済みパッケージ: python/requirements.txt" 