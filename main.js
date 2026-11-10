// Lex Outliner for the Mac: a window that opens the web app (so every update to lex.nicholasgirard.com shows up here
// with no new download), plus Touch Bar buttons for the node types, folder backups of your notes (backup.js), and
// updates of this app itself (update.js). The buttons send a command to the page through
// preload.js; the page runs it like its own toolbar button (src/app/desktop.ts). Nothing here touches your data.
const { app, BrowserWindow, TouchBar, shell, Menu, ipcMain, nativeImage, dialog, clipboard } = require('electron');
const { checkUpdates } = require('./update');
const { writeBackup } = require('./backup');
const fs = require('fs');
const path = require('path');

const HOME = 'https://lex.nicholasgirard.com/';
const HOST = new URL(HOME).host;
// Sites a page may open inside the app (Open in Overleaf posts a form to a new window); anything else opens in your browser.
const INSIDE = new Set([HOST, 'www.overleaf.com', 'overleaf.com']);

/** The Touch Bar until the page says how it should look: [label, command, color]. */
const BUTTONS = [
  ['Class note', 'classnote', '#C2410C'],
  ['Case', 'case', '#9E1B32'], ['Brief', 'brief', '#9E1B32'], ['Authority', 'authority', '#6A3FA0'], ['Problem', 'problem', '#3D7A2E'],
  ['Summary', 'summary', '#8A6A00'], ['Rule', 'rule', '#1F4FA8'], ['Test', 'test', '#4F4FB8'],
  ['Outline', 'outline', ''], ['Beside notes', 'dual', ''],
];
const GAP_BEFORE = new Set(['case', 'outline']);

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

/* Folder backups (backup.js writes them). Settings live in backup.json in the app's own data folder: the folder you
   chose, when the last backup was written, and the last error. The page asks for these through preload.js. */
const bkFile = () => path.join(app.getPath('userData'), 'backup.json');
function bkRead() { try { const j = JSON.parse(fs.readFileSync(bkFile(), 'utf8')); return { folder: typeof j.folder === 'string' ? j.folder : null, last: j.last || null, error: j.error || null, asked: !!j.asked }; } catch { return { folder: null, last: null, error: null, asked: false }; } }
function bkWrite(st) { try { fs.writeFileSync(bkFile(), JSON.stringify(st)); } catch { /* not worth stopping for */ } }
const bkStatus = () => { const { folder, last, error } = bkRead(); return { folder, last, error }; };
async function bkChoose(win) {
  const r = await dialog.showOpenDialog(win, { title: 'Choose a folder for Lex Outliner backups', buttonLabel: 'Back Up Here', properties: ['openDirectory', 'createDirectory'], message: 'Lex keeps its newest backup here, plus one a day for 30 days. A folder in iCloud Drive or Google Drive is copied online too.' });
  if (!r.canceled && r.filePaths[0]) bkWrite({ ...bkRead(), folder: r.filePaths[0], error: null, asked: true });
  return bkStatus();
}
/** Only the page from Lex's own site, in our window, may use these. */
const fromSite = e => { try { return new URL(e.senderFrame.url).host === HOST; } catch { return false; } };
ipcMain.handle('lex:backup-status', e => (fromSite(e) ? bkStatus() : null));
ipcMain.handle('lex:backup-choose', e => (fromSite(e) ? bkChoose(BrowserWindow.fromWebContents(e.sender)) : null));
ipcMain.handle('lex:backup-show', e => { if (fromSite(e)) { const f = bkRead().folder; if (f) shell.openPath(f); } });
ipcMain.handle('lex:backup-save', async (e, files) => {
  if (!fromSite(e)) return null;
  const st = bkRead(); if (!st.folder) return bkStatus();
  try { const last = await writeBackup(st.folder, files); bkWrite({ ...st, last, error: null }); }
  catch (err) { bkWrite({ ...st, error: String(err && err.message ? err.message : err).slice(0, 200) }); }
  return bkStatus();
});
/** Once, on the first launch with backups: offer to choose a folder. */
async function offerBackups(win) {
  const st = bkRead(); if (st.folder || st.asked) return;
  bkWrite({ ...st, asked: true });
  const { response } = await dialog.showMessageBox(win, { message: 'Back up your notes to a folder?', detail: 'Lex can keep a copy of all your notes in a folder on this Mac, updated a couple of minutes after you edit, with one copy a day for 30 days. Choose a folder in iCloud Drive or Google Drive and it’s copied online too. You can change this later in Settings → Backups.', buttons: ['Choose Folder…', 'Not Now'], defaultId: 0, cancelId: 1 });
  if (response === 0) { await bkChoose(win); if (bkRead().folder && !win.isDestroyed()) win.webContents.send('lex:cmd', 'backup-now'); }
}

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
  // Right-click: Electron has no menu of its own, so build the usual one: spelling suggestions for a misspelled word,
  // Learn Spelling, Look Up, then Cut / Copy / Paste. The page's own menus (a bullet's dot, a table cell) take the click
  // themselves and this doesn't appear.
  win.webContents.on('context-menu', (_e, p) => {
    const items = [];
    if (p.misspelledWord) {
      for (const w of (p.dictionarySuggestions || []).slice(0, 6)) items.push({ label: w, click: () => win.webContents.replaceMisspelling(w) });
      if (!(p.dictionarySuggestions || []).length) items.push({ label: 'No Guesses Found', enabled: false });
      items.push({ label: 'Learn Spelling', click: () => win.webContents.session.addWordToSpellCheckerDictionary(p.misspelledWord) }, { type: 'separator' });
    }
    const sel = (p.selectionText || '').trim();
    if (sel && process.platform === 'darwin') items.push({ label: `Look Up “${sel.length > 24 ? sel.slice(0, 23) + '…' : sel}”`, click: () => win.webContents.showDefinitionForSelection() }, { type: 'separator' });
    if (p.linkURL && /^https?:/.test(p.linkURL)) items.push({ label: 'Open Link in Browser', click: () => shell.openExternal(p.linkURL) }, { label: 'Copy Link', click: () => clipboard.writeText(p.linkURL) }, { type: 'separator' });
    if (p.isEditable) {
      const f = p.editFlags || {};
      items.push({ role: 'cut', enabled: !!f.canCut }, { role: 'copy', enabled: !!f.canCopy }, { role: 'paste', enabled: !!f.canPaste }, { role: 'pasteAndMatchStyle', enabled: !!f.canPaste }, { type: 'separator' }, { role: 'selectAll' });
    } else if (sel) items.push({ role: 'copy' });
    while (items.length && items[items.length - 1].type === 'separator') items.pop();
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });
  win.loadURL(HOME);
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: app.name, submenu: [{ role: 'about' }, { label: 'Check for Updates…', click: () => { const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]; if (w) checkUpdates(w, true); } }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }, { label: 'File', submenu: [{ label: 'Back Up Now', accelerator: 'CmdOrCtrl+Shift+B', click: () => { const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]; if (w) w.webContents.send('lex:cmd', 'backup-now'); } }, { label: 'Choose Backup Folder…', click: () => { const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]; if (w) bkChoose(w); } }, { label: 'Show Backups in Finder', click: () => { const f = bkRead().folder; if (f) shell.openPath(f); } }, { type: 'separator' }, { role: 'close' }] }, { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'toggleDevTools' }] },
    { role: 'windowMenu' },
  ]));
  const win = open();
  setTimeout(() => checkUpdates(win, false), 15000);
  setTimeout(() => { if (!win.isDestroyed()) offerBackups(win); }, 8000);
  setInterval(() => { const w = BrowserWindow.getAllWindows()[0]; if (w) checkUpdates(w, false); }, 6 * 3600 * 1000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) open(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
