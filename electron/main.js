const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

// 開発環境判定
const isDev = !app.isPackaged;

let mainWindow;
let pythonProcess;
let nextProcess;

function createWindow() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    icon: path.join(__dirname, '../public/favicon.ico'),
    title: 'DESCON設定ツール',
    show: false
  });

  const startUrl = 'http://localhost:3002';
  
  console.log('[Electron] Loading URL:', startUrl);
  console.log('[Electron] isDev:', isDev, 'isProduction:', isProduction);
  
  // 本番環境では内蔵Next.jsサーバーの起動を待機
  if (isProduction || !isDev) {
    console.log('[Electron] Production mode: waiting for Next.js server...');
    
    const checkServerAndLoad = async (retries = 0) => {
      const req = http.request('http://localhost:3002', { method: 'HEAD', timeout: 1000 }, (res) => {
        if (res.statusCode === 200 || res.statusCode === 304) {
          console.log('[Electron] Next.js server ready!');
          mainWindow.loadURL(startUrl);
        } else {
          throw new Error(`Server returned ${res.statusCode}`);
        }
      });
      
      req.on('error', (error) => {
        if (retries < 60) {
          setTimeout(() => checkServerAndLoad(retries + 1), 1000);
        } else {
          console.error('[Electron] Server failed to start after 60 seconds');
          mainWindow.loadURL(startUrl);
        }
      });
      
      req.end();
    };
    
    setTimeout(() => checkServerAndLoad(), 3000);
  } else {
    // 開発環境では即座にロード
    mainWindow.loadURL(startUrl);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('[Electron] Window shown');
  });

  // 本番環境では開発者ツールを無効化
  if (isProduction) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if ((input.meta && input.alt && input.key === 'i') || 
          (input.control && input.shift && input.key === 'I') ||
          (input.key === 'F12')) {
        event.preventDefault();
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (pythonProcess) {
      pythonProcess.kill();
    }
    if (nextProcess) {
      nextProcess.kill();
    }
  });

  // 開発環境のみ開発者ツールを開く
  if (isDev && process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.openDevTools();
  }
}

function startNextServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log('[Electron] startNextServer - isDev:', isDev, 'isProduction:', isProduction);
  
  // 本番環境のみ内蔵Next.jsサーバーを起動
  if (isProduction) {
    const appPath = path.join(__dirname, '..');
    const startScript = path.join(__dirname, '../scripts/start-nextjs.js');
    
    console.log('[Electron] Starting embedded Next.js server...');
    console.log('[Electron] App path:', appPath);
    console.log('[Electron] Start script:', startScript);

    // 同梱Nodeの検出（優先順位付き）
    const embeddedNodePaths = [
      path.join(appPath, 'node/bin/node'),
      path.join(process.resourcesPath || '', 'node/bin/node')
    ];
    
    let nodeCmd = process.execPath; // Electronのnodeをデフォルト
    for (const nodePath of embeddedNodePaths) {
      if (fs.existsSync(nodePath)) {
        nodeCmd = nodePath;
        console.log('[Electron] Using embedded Node.js:', nodePath);
        break;
      }
    }

    // Next.jsサーバーを起動
    nextProcess = spawn(nodeCmd, [startScript], {
      cwd: appPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        NODE_ENV: 'development', // 常に開発モードでNext.jsを起動
        PORT: '3002',
        HOSTNAME: 'localhost'
      }
    });

    nextProcess.stdout.on('data', (data) => {
      console.log('[Next.js]', data.toString().trim());
    });

    nextProcess.stderr.on('data', (data) => {
      console.error('[Next.js]', data.toString().trim());
    });

    nextProcess.on('close', (code) => {
      console.log('[Next.js] Process exited with code', code);
    });

    nextProcess.on('error', (error) => {
      console.error('[Next.js] Failed to start:', error);
    });
  } else {
    // 開発環境では外部のNext.jsサーバーを使用
    console.log('[Electron] Development mode: using external Next.js server');
  }
}

function startPythonBackend() {
  // 外部でPythonを起動済み（起動スクリプト側）ならスキップ
  if (process.env.DESCON_EXTERNAL_PY === '1') {
    console.log('[Electron] DESCON_EXTERNAL_PY=1: skipping Python backend start');
    return;
  }
  
  console.log('[Electron] Starting Python backend...');
  console.log('[Electron] isDev:', isDev, 'NODE_ENV:', process.env.NODE_ENV);
  
  // Pythonパスの優先順位
  const pythonPaths = [
    path.join(__dirname, '../python/venv/bin/python3'),
    path.join(__dirname, '../python/venv/bin/python'),
    path.join(process.resourcesPath || '', 'python/venv/bin/python3'),
    'python3',
    'python'
  ];
  
  let pythonPath = null;
  for (const testPath of pythonPaths) {
    if (testPath.startsWith('/') || testPath.includes('python')) {
      if (fs.existsSync(testPath)) {
        pythonPath = testPath;
        console.log('[Electron] Found Python:', testPath);
        break;
      }
    } else {
      // システムPythonを試す
      pythonPath = testPath;
      break;
    }
  }
  
  if (!pythonPath) {
    console.warn('[Electron] Python not found. WebSocket features unavailable.');
    return;
  }
  
  // スクリプトパス
  let scriptPath = path.join(__dirname, '../backend/server.py');
  if (!isDev) {
    const resourcePath = path.join(process.resourcesPath || '', 'backend/server.py');
    if (fs.existsSync(resourcePath)) {
      scriptPath = resourcePath;
    }
  }
  
  if (!fs.existsSync(scriptPath)) {
    console.warn('[Electron] server.py not found:', scriptPath);
    return;
  }

  console.log('[Electron] Python path:', pythonPath);
  console.log('[Electron] Script path:', scriptPath);

  try {
    pythonProcess = spawn(pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        PYTHONUNBUFFERED: '1'
      }
    });

    pythonProcess.stdout.on('data', (data) => {
      console.log('[Python]', data.toString().trim());
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error('[Python]', data.toString().trim());
    });

    pythonProcess.on('close', (code) => {
      console.log('[Python] Process exited with code', code);
      if (code !== 0 && code !== null) {
        console.warn('[Python] Backend failed. WebSocket features unavailable.');
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('[Python] Failed to start:', error);
    });
  } catch (error) {
    console.error('[Python] Spawn error:', error);
  }
}

app.whenReady().then(() => {
  createWindow();
  startNextServer();
  startPythonBackend();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (nextProcess) {
    nextProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (nextProcess) {
    nextProcess.kill();
  }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('quit-app', () => {
  app.quit();
}); 