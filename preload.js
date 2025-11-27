const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  probeFile: (filePath) => ipcRenderer.invoke('probe-file', filePath),
  extractStream: (payload) => ipcRenderer.invoke('extract-stream', payload),
});
