const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  inputResult: (value) => ipcRenderer.send('input-result', value),
});
