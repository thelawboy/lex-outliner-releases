const assert = require('assert'); const fs = require('fs'); const os = require('os'); const path = require('path');
const { writeBackup } = require('../backup.js');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));
  const files = (n) => [{ name: 'hornbook-backup.json', text: `{"v":${n}}` }, { name: 'markdown/Torts.md', text: `# Torts ${n}` }];
  for (let i = 0; i < 33; i++) await writeBackup(root, files(i), new Date(2026, 9, 1 + i, 12));
  await writeBackup(root, [{ name: 'hornbook-backup.json', text: '{"v":"last"}' }], new Date(2026, 10, 2, 13));
  assert.equal(fs.readFileSync(path.join(root, 'Latest/hornbook-backup.json'), 'utf8'), '{"v":"last"}');
  assert.ok(!fs.existsSync(path.join(root, 'Latest/markdown/Torts.md')), 'stale markdown removed');
  const days = fs.readdirSync(path.join(root, 'Daily')).sort();
  assert.equal(days.length, 30); assert.equal(days[0], '2026-10-04'); assert.equal(days[29], '2026-11-02');
  assert.equal(fs.readFileSync(path.join(root, 'Daily/2026-11-02/hornbook-backup.json'), 'utf8'), '{"v":"last"}');
  assert.deepEqual(fs.readdirSync(root).sort(), ['Daily', 'Latest']);
  for (const bad of [[{ name: '../x.json', text: '' }], [{ name: 'markdown/../../etc.md', text: '' }, { name: 'hornbook-backup.json', text: '' }], [{ name: 'markdown/a.md', text: '' }], [{ name: 'hornbook-backup.json', text: 1 }]])
    await assert.rejects(writeBackup(root, bad));
  assert.ok(!fs.existsSync(path.join(os.tmpdir(), 'x.json')));
  console.log('backup.js: all passed');
})().catch(e => { console.error(e); process.exit(1); });
