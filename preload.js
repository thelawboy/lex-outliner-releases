// What the page gets from the desktop app: Touch Bar commands by name, and a way to say how the buttons look. No
// access to files or the system.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('lexDesktop', {
  onCommand: cb => { ipcRenderer.on('lex:cmd', (_e, cmd) => cb(String(cmd))); },
  // How the Touch Bar's buttons should look (icons, colors); the app checks what it's given.
  setBar: items => { ipcRenderer.send('lex:bar', items); },
});
