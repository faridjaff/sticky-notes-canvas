const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stickyAPI', {
  load:       () => ipcRenderer.invoke('notes:load'),
  save:       (data) => ipcRenderer.invoke('notes:save', data),
  exportFile: (data) => ipcRenderer.invoke('notes:export', data),
  importFile: () => ipcRenderer.invoke('notes:import'),
  onMenuExport: (cb) => {
    const wrapped = (_event, ...args) => cb(...args);
    ipcRenderer.on('menu:export', wrapped);
    return () => ipcRenderer.removeListener('menu:export', wrapped);
  },
  onMenuImport: (cb) => {
    const wrapped = (_event, ...args) => cb(...args);
    ipcRenderer.on('menu:import', wrapped);
    return () => ipcRenderer.removeListener('menu:import', wrapped);
  },
  onMenuPreferences: (cb) => {
    const wrapped = (_event, ...args) => cb(...args);
    ipcRenderer.on('menu:preferences', wrapped);
    return () => ipcRenderer.removeListener('menu:preferences', wrapped);
  },
});
