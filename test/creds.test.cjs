const assert = require('assert'); const fs = require('fs'); const os = require('os'); const path = require('path');
const { makeCreds } = require('../creds.js');
// A stand-in for safeStorage: reversible, and never the plain text.
const safe = (on = true) => ({
  isEncryptionAvailable: () => on,
  encryptString: s => Buffer.from(Buffer.from(s, 'utf8').map(b => b ^ 0x5a)),
  decryptString: b => Buffer.from(b.map(x => x ^ 0x5a)).toString('utf8'),
});
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-')), file = path.join(dir, 'signin.json');
const c = makeCreds(() => file, safe());
assert.equal(c.read(), null, 'nothing saved yet');
assert.equal(c.save({ email: ' me@law.edu ', password: 'correct horse' }), true);
assert.deepEqual(c.read(), { email: 'me@law.edu', password: 'correct horse' });
const raw = fs.readFileSync(file, 'utf8');
assert.ok(!raw.includes('correct horse') && !raw.includes('me@law.edu'), 'kept encrypted');
assert.equal(fs.statSync(file).mode & 0o777, 0o600, 'readable only by you');
assert.ok(!fs.existsSync(file + '.new'));
for (const bad of [null, {}, { email: 'x', password: 'p' }, { email: 'a@b.c', password: '' }, { email: 'a@b.c', password: 1 }, { email: 'a b@c.d', password: 'p' }, { email: 'a@b.c', password: 'x'.repeat(2000) }])
  assert.throws(() => c.save(bad));
assert.deepEqual(c.read(), { email: 'me@law.edu', password: 'correct horse' }, 'a bad save leaves the old one');
assert.equal(makeCreds(() => file, safe(false)).save({ email: 'a@b.c', password: 'p' }), false, 'no Keychain: nothing kept');
assert.equal(makeCreds(() => file, safe(false)).read(), null);
fs.writeFileSync(file, 'not json'); assert.equal(c.read(), null, 'a damaged file reads as none');
c.clear(); assert.ok(!fs.existsSync(file)); c.clear();
fs.rmSync(dir, { recursive: true, force: true });
console.log('creds.js: all passed');
