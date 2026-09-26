const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  readFile: p => ipcRenderer.invoke('read-file', p),
  saveFile: (p,c) => ipcRenderer.invoke('save-file', p,c),
  createFile: () => ipcRenderer.invoke('create-file'),
  createFolder: () => ipcRenderer.invoke('create-folder'),
  importAssets: () => ipcRenderer.invoke('import-assets'),
  refreshTree: () => ipcRenderer.invoke('refresh-tree'),
  run: c => ipcRenderer.send('terminal-command', c),
  terminalInput: d => ipcRenderer.send('terminal-input', d),
  onOutput: cb => ipcRenderer.on('terminal-output', (_,d) => cb(d)),
  onPreviewUrl: cb => ipcRenderer.on('preview-url', (_,url) => cb(url)),
  onPreviewContextToggle: cb => ipcRenderer.on('preview-context-toggle', () => cb()),
  clipboardRead: () => ipcRenderer.invoke('clipboard-read'),
  clipboardWrite: text => ipcRenderer.invoke('clipboard-write', text),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  captureSource: () => ipcRenderer.invoke('window-capture-source'),
  projectInfo: () => ipcRenderer.invoke('project-info')
});
