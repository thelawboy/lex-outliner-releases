// Folder backups: the page builds a backup of all your notes (src/app/desktop.ts in the web app) and hands the files
// here; this writes them into the folder you chose:
//   <folder>/Latest/hornbook-backup.json and Latest/markdown/*.md   (the newest backup, replaced each time)
//   <folder>/Daily/2026-11-09/hornbook-backup.json                  (that day's last backup; the newest 30 days kept)
// Only a JSON file and Markdown files with plain names are accepted, and nothing is written outside the folder.
const fs = require('fs');
const path = require('path');

const MAX_FILES = 3000, MAX_BYTES = 400 * 1024 * 1024, KEEP_DAYS = 30;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Check what the page sent: [{name, text}], names 'hornbook-backup.json' or 'markdown/<plain name>.md'. */
function clean(files) {
  if (!Array.isArray(files) || !files.length || files.length > MAX_FILES) throw new Error('The backup was empty or too large.');
  let bytes = 0; const seen = new Set();
  const out = files.map(f => {
    if (!f || typeof f.name !== 'string' || typeof f.text !== 'string') throw new Error('The backup was malformed.');
    const ok = f.name === 'hornbook-backup.json' || /^markdown\/[\w\- ().,&]{1,200}\.md$/.test(f.name);
    if (!ok || f.name.includes('..') || seen.has(f.name)) throw new Error(`Unexpected file name in the backup: ${f.name}`);
    seen.add(f.name); bytes += Buffer.byteLength(f.text);
    return { name: f.name, text: f.text };
  });
  if (bytes > MAX_BYTES) throw new Error('The backup was too large.');
  if (!seen.has('hornbook-backup.json')) throw new Error('The backup had no hornbook-backup.json.');
  return out;
}

async function writeDir(dir, files) {
  await fs.promises.mkdir(path.join(dir, 'markdown'), { recursive: true });
  for (const f of files) await fs.promises.writeFile(path.join(dir, ...f.name.split('/')), f.text);
}

/** Write a backup into root (the chosen folder). Latest is swapped in whole, so it's never half-written. */
async function writeBackup(root, files, now = new Date()) {
  const list = clean(files);
  await fs.promises.mkdir(root, { recursive: true });
  const latest = path.join(root, 'Latest'), next = path.join(root, '.Latest-new'), old = path.join(root, '.Latest-old');
  await fs.promises.rm(next, { recursive: true, force: true });
  await writeDir(next, list);
  await fs.promises.rm(old, { recursive: true, force: true });
  if (fs.existsSync(latest)) await fs.promises.rename(latest, old);
  await fs.promises.rename(next, latest);
  await fs.promises.rm(old, { recursive: true, force: true });
  // Today's copy (the JSON is enough to restore from), then the oldest days beyond 30 removed.
  const pad = n => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const daily = path.join(root, 'Daily');
  await fs.promises.mkdir(path.join(daily, day), { recursive: true });
  await fs.promises.writeFile(path.join(daily, day, 'hornbook-backup.json'), list.find(f => f.name === 'hornbook-backup.json').text);
  const days = (await fs.promises.readdir(daily)).filter(d => DAY.test(d)).sort();
  for (const d of days.slice(0, Math.max(0, days.length - KEEP_DAYS))) await fs.promises.rm(path.join(daily, d), { recursive: true, force: true });
  return now.toISOString();
}

module.exports = { writeBackup, clean, KEEP_DAYS };
