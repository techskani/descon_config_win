#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Next.js server (direct next bin)...');

const appPath = path.join(__dirname, '..');
const nextBinPath = path.join(appPath, 'node_modules', 'next', 'dist', 'bin', 'next');

console.log('next bin path:', nextBinPath);
console.log('App path:', appPath);
console.log('Working directory:', process.cwd());

// 常に dev（本番環境でも）
const nextCommand = 'dev';
console.log(`Using next: ${nextCommand}`);

// 親プロセスと同じNode実行ファイルを使用（同梱Node対応）
const nodeExec = process.execPath;

const nextProcess = spawn(nodeExec, [nextBinPath, nextCommand], {
  cwd: appPath,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: '3002',
    HOSTNAME: 'localhost'
  }
});

nextProcess.on('close', (code) => {
  console.log(`Next.js process exited with code ${code}`);
  process.exit(code);
});

nextProcess.on('error', (error) => {
  console.error('Failed to start Next.js process:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down Next.js server...');
  nextProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Shutting down Next.js server...');
  nextProcess.kill('SIGTERM');
}); 