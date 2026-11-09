// Lex Outliner for the Mac: a window that opens the web app (so every update to lex.nicholasgirard.com shows up here
// with no new download), plus Touch Bar buttons for the node types, and updates of this app itself (update.js). The buttons send a command to the page through
// preload.js; the page runs it like its own toolbar button (src/app/desktop.ts). Nothing here touches your data.
const { app, BrowserWindow, TouchBar, shell, Menu, ipcMain, nativeImage } = require('electron');
const { checkUpdates } = require('./update');
const fs = require('fs');
const path = require('path');

const HOME = 'https://lex.nicholasgirard.com/';
const HOST = new URL(HOME).host;
// Sites a page may open inside the app (Open in Overleaf posts a form to a new window); anything else opens in your browser.
const INSIDE = new Set([HOST, 'www.overleaf.com', 'overleaf.com']);

/** The Touch Bar until the page says how it should look: [label, command, color]. */
const BUTTONS = [
  ['Class note', 'classnote', '#C2410C'],
  ['Brief', 'brief', '#9E1B32'], ['Authority', 'authority', '#6A3FA0'], ['Problem', 'problem', '#3D7A2E'],
  ['Summary', 'summary', '#8A6A00'], ['Rule', 'rule', '#1F4FA8'], ['Test', 'test', '#4F4FB8'],
  ['Outline', 'outline', ''], ['Beside notes', 'dual', ''],
];
const GAP_BEFORE = new Set(['brief', 'outline']);

const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function savedBounds() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return {}; } }
function saveBounds(win) { try { fs.writeFileSync(stateFile(), JSON.stringify(win.getBounds())); } catch { /* not worth stopping for */ } }

/**
 * Build the Touch Bar from items {cmd, label, icon?, color?, on?, gap?}. The page sends these (src/app/desktop.ts):
 * the app's own icons as white PNGs at 2x, on each type's color from your Node types; Outline and Beside notes are
 * lit (blue) while showing. Only known commands, #rrggbb colors and small PNG data URLs are taken.
 */
function touchBar(win, items) {
  const { TouchBarButton, TouchBarSpacer } = TouchBar;
  const send = cmd => () => { if (!win.isDestroyed()) win.webContents.send('lex:cmd', cmd); };
  const out = [];
  for (const it of items) {
    if (it.gap) out.push(new TouchBarSpacer({ size: 'small' }));
    const opts = { accessibilityLabel: it.label, click: send(it.cmd) };
    let icon = null;
    if (typeof it.icon === 'string' && it.icon.startsWith('data:image/png;base64,') && it.icon.length < 200000) {
      icon = nativeImage.createFromBuffer(Buffer.from(it.icon.slice(22), 'base64'), { scaleFactor: 2 });
      if (icon.isEmpty()) icon = null;
    }
    if (icon) opts.icon = icon; else opts.label = it.label;
    const color = it.on ? '#0A84FF' : it.color;
    if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) opts.backgroundColor = color;
    out.push(new TouchBarButton(opts));
  }
  return new TouchBar({ items: out });
}
const defaultItems = () => BUTTONS.map(([label, cmd, color]) => ({ cmd, label, color, gap: GAP_BEFORE.has(cmd) }));
const KNOWN = new Set(BUTTONS.map(b => b[1]));

function open() {
  const b = savedBounds();
  const win = new BrowserWindow({
    width: b.width || 1400, height: b.height || 900, x: b.x, y: b.y, minWidth: 480, minHeight: 360,
    title: 'Lex Outliner', backgroundColor: '#ffffff', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  win.setTouchBar(touchBar(win, defaultItems()));
  // The page describes the buttons (icons, your types' colors); only this window's own site may.
  const onBar = (e, items) => {
    if (e.sender !== win.webContents || !Array.isArray(items) || items.length > 16) return;
    let host = ''; try { host = new URL(e.senderFrame.url).host; } catch { /* ignore */ }
    if (host !== HOST) return;
    const clean = items.filter(it => it && KNOWN.has(it.cmd)).map(it => ({ cmd: it.cmd, label: String(it.label || it.cmd).slice(0, 40), icon: it.icon, color: it.color, on: !!it.on, gap: !!it.gap }));
    if (clean.length) win.setTouchBar(touchBar(win, clean));
  };
  ipcMain.on('lex:bar', onBar);
  win.on('closed', () => ipcMain.removeListener('lex:bar', onBar));
  win.once('ready-to-show', () => win.show());
  win.on('close', () => saveBounds(win));
  // New windows: Overleaf inside the app, everything else (Cornell LII, eCFR, the ABA…) in your browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    let host = ''; try { host = new URL(url).host; } catch { /* ignore */ }
    if (INSIDE.has(host)) return { action: 'allow' };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Leaving the app's own site in this window goes to your browser instead.
  win.webContents.on('will-navigate', (e, url) => {
    let host = ''; try { host = new URL(url).host; } catch { /* ignore */ }
    if (host !== HOST) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });
  win.loadURL(HOME);
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: app.name, submenu: [{ role: 'about' }, { label: 'Check for Updates…', click: () => { const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]; if (w) checkUpdates(w, true); } }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }, { role: 'fileMenu' }, { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'toggleDevTools' }] },
    { role: 'windowMenu' },
  ]));
  const win = open();
  setTimeout(() => checkUpdates(win, false), 15000);
  setInterval(() => { const w = BrowserWindow.getAllWindows()[0]; if (w) checkUpdates(w, false); }, 6 * 3600 * 1000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) open(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
