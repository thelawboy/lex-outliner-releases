// What the page gets from the desktop app: Touch Bar commands by name, a way to say how the buttons look, and folder
// backups (status, choosing the folder, saving a backup's files there, showing it). No other access to files or the system.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('lexDesktop', {
  onCommand: cb => { ipcRenderer.on('lex:cmd', (_e, cmd) => cb(String(cmd))); },
  // How the Touch Bar's buttons should look (icons, colors); the app checks what it's given.
  setBar: items => { ipcRenderer.send('lex:bar', items); },
  // Folder backups: the page builds the files; the app writes them into the folder you chose (backup.js).
  backup: {
    status: () => ipcRenderer.invoke('lex:backup-status'),
    choose: () => ipcRenderer.invoke('lex:backup-choose'),
    save: files => ipcRenderer.invoke('lex:backup-save', files),
    show: () => ipcRenderer.invoke('lex:backup-show'),
  },
});
