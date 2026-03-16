#!/bin/bash

echo "Testing production build..."

# Python環境の確認
if [ ! -d "python" ]; then
    echo "Error: Python environment not found. Please run './scripts/setup-python.sh' first."
    exit 1
fi

# 本番環境モードでElectronを起動
echo "Starting Electron in production mode..."
echo "Note: This will use embedded Next.js server"

# 環境変数を設定して本番モードで起動
NODE_ENV=production electron . 