// Updates for Lex Outliner on the Mac, without an Apple developer account.
//
// Each release here (github.com/thelawboy/lex-outliner-releases) carries the app as a .zip and a latest.json:
// {version, sha256, notes}. The app reads latest.json from the newest release, and when it names a newer version it
// offers Update and Restart: it downloads that release's .zip (only from this repository, over HTTPS), checks it against
// the sha256, unpacks it, checks the app's signature is intact, then quits, swaps the new app in place of this one and
// opens it. A file the app downloads itself isn't marked as downloaded from the internet, so macOS doesn't ask again.
// If this copy can't replace itself (run from the disk image, or not yet moved into Applications), it offers the
// release page instead.
const { app, dialog, shell, net } = require('electron');
const { execFile, spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = 'thelawboy/lex-outliner-releases';
const LATEST = `https://github.com/${REPO}/releases/latest/download/latest.json`;
const page = v => `https://github.com/${REPO}/releases/tag/v${v}`;
const zipUrl = v => `https://github.com/${REPO}/releases/download/v${v}/Lex-Outliner-mac.zip`;

const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
const seenFile = () => path.join(app.getPath('userData'), 'update-seen.txt');
const run = (cmd, args) => new Promise((res, rej) => execFile(cmd, args, (err, out) => (err ? rej(err) : res(String(out)))));

/** This app's bundle, if it can replace itself there: in a folder it may write to, not the disk image or a translocated copy. */
function selfPath() {
  const p = path.resolve(path.dirname(process.execPath), '..', '..');
  if (!p.endsWith('.app') || p.startsWith('/Volumes/') || p.includes('/AppTranslocation/')) return null;
  try { fs.accessSync(path.dirname(p), fs.constants.W_OK); fs.accessSync(p, fs.constants.W_OK); return p; } catch { return null; }
}

async function latest() {
  const r = await net.fetch(LATEST, { cache: 'no-store' });
  if (!r.ok) throw new Error(`latest.json: ${r.status}`);
  const j = await r.json();
  if (!j || typeof j.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(j.version) || typeof j.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(j.sha256)) throw new Error('latest.json is malformed');
  return { version: j.version, sha256: j.sha256, notes: typeof j.notes === 'string' ? j.notes.slice(0, 600) : '' };
}

/** Download the release's zip to a file, showing progress on the Dock icon, and return its sha256. */
async function download(win, version, file) {
  const r = await net.fetch(zipUrl(version));
  if (!r.ok || !r.body) throw new Error(`download: ${r.status}`);
  const total = +r.headers.get('content-length') || 0;
  const hash = crypto.createHash('sha256'); const out = fs.createWriteStream(file);
  const reader = r.body.getReader(); let got = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      hash.update(value); got += value.length;
      if (!out.write(Buffer.from(value))) await new Promise(res => out.once('drain', res));
      if (total && !win.isDestroyed()) win.setProgressBar(got / total);
    }
  } finally { await new Promise(res => out.end(res)); if (!win.isDestroyed()) win.setProgressBar(-1); }
  return hash.digest('hex');
}

/** Download, check, unpack and swap in the new version, then restart. Throws with a plain message if anything fails. */
async function install(win, info, target) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lex-update-'));
  const zip = path.join(dir, 'update.zip');
  const sum = await download(win, info.version, zip);
  if (sum !== info.sha256) throw new Error('The download didn’t match its fingerprint, so it wasn’t installed.');
  const unpacked = path.join(dir, 'app'); fs.mkdirSync(unpacked);
  await run('/usr/bin/ditto', ['-x', '-k', zip, unpacked]);
  const name = fs.readdirSync(unpacked).find(f => f.endsWith('.app'));
  if (!name) throw new Error('The download didn’t contain the app.');
  const fresh = path.join(unpacked, name);
  await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', fresh]);
  // A small script waits for this app to quit, swaps the new one in (putting the old one back if that fails), and opens it.
  const script = path.join(dir, 'swap.sh');
  fs.writeFileSync(script, [
    '#!/bin/bash',
    'pid="$1"; old="$2"; new="$3"; back="$old.previous"',
    'for i in $(seq 1 150); do kill -0 "$pid" 2>/dev/null || break; sleep 0.2; done',
    'rm -rf "$back"',
    'if mv "$old" "$back" && mv "$new" "$old"; then rm -rf "$back"; else [ -d "$back" ] && [ ! -d "$old" ] && mv "$back" "$old"; fi',
    'xattr -dr com.apple.quarantine "$old" 2>/dev/null',
    'open "$old"',
    'rm -rf "$(dirname "$0")"',
  ].join('\n'), { mode: 0o700 });
  spawn('/bin/bash', [script, String(process.pid), target, fresh], { detached: true, stdio: 'ignore' }).unref();
  app.quit();
}

/**
 * Look for a newer version. On its own (asked = false) it says so once per version; from the menu it always answers.
 */
async function checkUpdates(win, asked) {
  let info;
  try { info = await latest(); } catch {
    if (asked) dialog.showMessageBox(win, { message: 'Couldn’t check for updates', detail: 'Lex couldn’t reach GitHub. Try again when you’re online.' });
    return;
  }
  if (!newer(info.version, app.getVersion())) {
    if (asked) dialog.showMessageBox(win, { message: 'Lex Outliner is up to date', detail: `You have version ${app.getVersion()}. Changes to Lex itself reach this app on their own; only the app’s window and Touch Bar need an update.` });
    return;
  }
  let seen = ''; try { seen = fs.readFileSync(seenFile(), 'utf8').trim(); } catch { /* first time */ }
  if (!asked && seen === info.version) return;
  try { fs.writeFileSync(seenFile(), info.version); } catch { /* ignore */ }
  const target = selfPath();
  const detail = `You have ${app.getVersion()}.${info.notes ? ' ' + info.notes : ''}`;
  if (!target) {
    const { response } = await dialog.showMessageBox(win, { message: `Lex Outliner ${info.version} is available`, detail: `${detail}\n\nThis copy can’t update itself (open Lex Outliner from your Applications folder to allow it). Download it instead?`, buttons: ['Download', 'Later'], defaultId: 0, cancelId: 1 });
    if (response === 0) shell.openExternal(page(info.version));
    return;
  }
  const { response } = await dialog.showMessageBox(win, { message: `Lex Outliner ${info.version} is available`, detail: `${detail}\n\nIt downloads in the background (the Dock icon shows progress), then Lex restarts. Your notes aren’t affected.`, buttons: ['Update and Restart', 'Later'], defaultId: 0, cancelId: 1 });
  if (response !== 0) return;
  try { await install(win, info, target); } catch (e) {
    const { response: r2 } = await dialog.showMessageBox(win, { type: 'warning', message: 'The update couldn’t be installed', detail: `${e && e.message ? e.message : e}\n\nYou can download it and install it by hand instead.`, buttons: ['Download', 'Close'], defaultId: 0, cancelId: 1 });
    if (r2 === 0) shell.openExternal(page(info.version));
  }
}

module.exports = { checkUpdates };
