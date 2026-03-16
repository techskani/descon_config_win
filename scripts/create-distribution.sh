#!/bin/bash

echo "Creating DESCON Config distribution package..."

# 配布用ディレクトリを作成
DIST_DIR="descon-config-distribution"
rm -rf $DIST_DIR
mkdir -p $DIST_DIR

echo "Copying application files..."

# 必要なファイルをコピー
cp -r app $DIST_DIR/
cp -r components $DIST_DIR/
cp -r contexts $DIST_DIR/
cp -r lib $DIST_DIR/
cp -r electron $DIST_DIR/
cp -r backend $DIST_DIR/
cp -r public $DIST_DIR/
cp -r scripts $DIST_DIR/
cp package.json $DIST_DIR/
cp package-lock.json $DIST_DIR/
cp next.config.mjs $DIST_DIR/
cp tailwind.config.ts $DIST_DIR/
cp tsconfig.json $DIST_DIR/
cp postcss.config.mjs $DIST_DIR/
cp components.json $DIST_DIR/
cp README-electron.md $DIST_DIR/README.md

# Python環境をセットアップ
echo "Setting up Python environment..."
cd $DIST_DIR
../scripts/setup-python.sh
cd ..

# インストールスクリプトを作成
cat > $DIST_DIR/install.sh << 'EOF'
#!/bin/bash

echo "Installing DESCON Config..."

# Node.jsの依存関係をインストール
echo "Installing Node.js dependencies..."
npm install --production

echo "Installation complete!"
echo ""
echo "To run the application:"
echo "  Development mode: npm run electron-dev"
echo "  Production mode:  npm run run-prod"
EOF

# 実行可能にする
chmod +x $DIST_DIR/install.sh
chmod +x $DIST_DIR/scripts/*.sh

# 配布用README
cat > $DIST_DIR/DISTRIBUTION-README.md << 'EOF'
# DESCON Config - 配布パッケージ

## 必要な環境
- Node.js 18以上
- Python 3.8以上
- npm

## インストール手順

1. このフォルダに移動:
   ```bash
   cd descon-config-distribution
   ```

2. インストールスクリプトを実行:
   ```bash
   ./install.sh
   ```

## 使用方法

### 開発環境で起動:
```bash
npm run electron-dev
```

### 本番環境で起動:
```bash
npm run run-prod
```

## 特徴

- **Python実行環境内蔵**: アプリケーションにPython環境が組み込まれています
- **自動サーバー起動**: Next.jsサーバーとPythonバックエンドが自動起動します
- **完全自己完結型**: 別途サーバーを起動する必要がありません

## トラブルシューティング

### Python環境の再構築:
```bash
rm -rf python
./scripts/setup-python.sh
```

### 依存関係の再インストール:
```bash
rm -rf node_modules
npm install
```

詳細な情報は README.md をご覧ください。
EOF

# アーカイブを作成
echo "Creating archive..."
tar -czf descon-config-distribution.tar.gz $DIST_DIR

echo "Distribution package created successfully!"
echo "Files:"
echo "  - descon-config-distribution/ (folder)"
echo "  - descon-config-distribution.tar.gz (archive)"
echo ""
echo "To distribute:"
echo "  1. Share the .tar.gz file"
echo "  2. User extracts: tar -xzf descon-config-distribution.tar.gz"
echo "  3. User runs: cd descon-config-distribution && ./install.sh" 