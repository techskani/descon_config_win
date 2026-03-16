#!/bin/bash

echo "Building Electron app with embedded Python and Next.js..."

# Clean previous builds
rm -rf dist python

# Setup Python environment
./scripts/setup-python.sh

# Build Electron app (Next.jsは内蔵サーバーとして動作)
npm run build:electron

echo "Build complete! Check the dist folder for the application." 