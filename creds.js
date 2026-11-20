// Remember me: the email and password you signed in with, so the sign-in screen can fill them in next time (the
// page asks for them only while it shows that screen). Kept in userData/signin.json, encrypted with a key macOS keeps in
// your Keychain (Electron's safeStorage), readable only by this user. Because the app is signed ad hoc, macOS may ask
// once after an update whether Lex Outliner may use that Keychain item. Nothing is kept when encryption isn't available.
const fs = require('fs');

const MAX_EMAIL = 320, MAX_PASS = 1024;
/** Check what the page sent: {email, password}, plain strings of a sensible size. */
function clean(c) {
  if (!c || typeof c.email !== 'string' || typeof c.password !== 'string') throw new Error('Malformed sign-in.');
  const email = c.email.trim();
  if (!email.includes('@') || email.length > MAX_EMAIL || /[\s<>]/.test(email)) throw new Error('Not an email address.');
  if (!c.password || c.password.length > MAX_PASS) throw new Error('Not a password.');
  return { email, password: c.password };
}

/** file: () => the path of signin.json; safe: Electron's safeStorage (or a stand-in in tests). */
function makeCreds(file, safe) {
  return {
    /** The saved sign-in, or null (none, unreadable, or the Keychain said no). */
    read() {
      try {
        if (!safe.isEncryptionAvailable()) return null;
        const { box } = JSON.parse(fs.readFileSync(file(), 'utf8'));
        return clean(JSON.parse(safe.decryptString(Buffer.from(String(box), 'base64'))));
      } catch { return null; }
    },
    /** Save a sign-in; false if it couldn't be encrypted. Written whole, so it's never half-saved. */
    save(c) {
      const x = clean(c);
      if (!safe.isEncryptionAvailable()) return false;
      const box = safe.encryptString(JSON.stringify(x)).toString('base64');
      const tmp = file() + '.new';
      fs.writeFileSync(tmp, JSON.stringify({ box }), { mode: 0o600 });
      fs.renameSync(tmp, file());
      return true;
    },
    clear() { fs.rmSync(file(), { force: true }); },
  };
}

module.exports = { makeCreds, clean };
