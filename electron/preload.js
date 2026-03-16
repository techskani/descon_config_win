const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  isElectron: true
});

// Disable node integration in renderer process
window.nodeRequire = require;
delete window.require;
delete window.exports;
delete window.module; 