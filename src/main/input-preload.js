const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  inputResult: (value, channelId) => {
    if (channelId) {
      ipcRenderer.send(channelId, value);
    } else {
      ipcRenderer.send('input-result', value);
    }
  },
  saveUserInfo: (email, name) => ipcRenderer.invoke('save-user-info', email, name),
  loadUserInfo: () => ipcRenderer.invoke('load-user-info'),
  onInputDialogData: (callback) => {
    ipcRenderer.once('input-dialog-data', (event, data) => callback(data));
  },
});
