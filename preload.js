const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stickyAPI', {
  load:       () => ipcRenderer.invoke('notes:load'),
  save:       (data) => ipcRenderer.invoke('notes:save', data),
  exportFile: (data) => ipcRenderer.invoke('notes:export', data),
  importFile: () => ipcRenderer.invoke('notes:import'),

  // Version of the running Electron build, captured at preload time so the
  // renderer can synchronously compare to the latest GitHub release tag.
  appVersion: ipcRenderer.sendSync('app:version-sync'),
  // Open https URLs in the user's default browser. Used by the update banner.
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  // Force a fresh update check (menu → Help → Check for Updates…). The main
  // process sends menu:checkUpdates; the renderer calls this back to show
  // a native dialog for the "up to date" and "check failed" branches
  // (the "update available" branch uses the in-app banner instead).
  showUpdateResult: (payload) => ipcRenderer.invoke('update:show-result', payload),
  onMenuCheckUpdates: (cb) => {
    const wrapped = () => cb();
    ipcRenderer.on('menu:checkUpdates', wrapped);
    return () => ipcRenderer.removeListener('menu:checkUpdates', wrapped);
  },
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
