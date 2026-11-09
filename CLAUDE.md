# Lex Outliner for Mac (public)

The Electron shell for Lex Outliner (the web app lives in the private repository thelawboy/Lex-Outliner, deployed at
lex.nicholasgirard.com; its page side of the Touch Bar is src/app/desktop.ts there, checked by scripts/checks/desktop.cjs).
This repository is **public** on purpose: installed copies download updates from its releases without a GitHub login.
Never put secrets, notes or the web app's code here.

- `main.js` window + Touch Bar (page-described buttons through `lex:bar`, validated: known commands, #rrggbb, small PNG
  data URLs, only from the site's own frame). `preload.js` exposes only `onCommand` and `setBar`.
- `update.js` self-updater (no Apple account, so no Squirrel/electron-updater): `latest.json` from the newest release,
  zip from `releases/download/v<version>/` of this repo only, SHA-256 checked, `codesign --verify`, then a detached
  script swaps the bundle after the app quits and reopens it. Falls back to the release page when the app can't write
  to its own location (disk image, App Translocation).
- Versions are plain X.X.X (the owner's choice). For a release: bump `version` in package.json (and package-lock.json:
  `npm install --package-lock-only`), write `NOTES.txt`, push to main; `.github/workflows/release.yml` builds and
  publishes `v<version>` with the .dmg, .zip and latest.json. Also update `public/desktop.json` in the private repo
  (version, release url): copies older than 1.2.0 read that instead.
- Owner is a law student; explain plainly. Ad hoc signed, unsigned by Apple: first install needs Open Anyway.
