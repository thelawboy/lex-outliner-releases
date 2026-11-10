# Lex Outliner for Mac (public)

The Electron shell for Lex Outliner (the web app lives in the private repository thelawboy/Lex-Outliner, deployed at
lex.nicholasgirard.com; its page side of the Touch Bar is src/app/desktop.ts there, checked by scripts/checks/desktop.cjs).
This repository is **public** on purpose: installed copies download updates from its releases without a GitHub login.
Never put secrets, notes or the web app's code here.

- `main.js` window + Touch Bar + right-click menu (`context-menu`: spelling suggestions and Learn Spelling from macOS's
  spellchecker, Look Up, Cut/Copy/Paste; Electron has none by default; the page's own menus prevent it) (page-described buttons through `lex:bar`; items with a `group` (preload `caps: ['segments']`, 1.2.3 on) become one
  full button for 'mode' and segmented-control strips for 'types'/'views', so all fit beside the Control Strip; validated: known commands, #rrggbb, small PNG
  data URLs, only from the site's own frame). `preload.js` exposes `onCommand`, `setBar`, `caps` and `backup`.
- `backup.js` folder backups: the page sends files ({name, text}: hornbook-backup.json, markdown/*.md); `clean` refuses
  anything else; written to <folder>/Latest (swapped in whole) and Daily/<date> (30 kept). Settings in userData/backup.json;
  IPC `lex:backup-*` (only from the site's frame); File menu items; offered once on first launch. `npm test` runs
  test/backup.test.cjs (also in the release workflow).
- `update.js` self-updater (no Apple account, so no Squirrel/electron-updater): `latest.json` from the newest release,
  zip from `releases/download/v<version>/` of this repo only (requests retried on 5xx/429/network errors, `get`; automatic
  checks that fail stay quiet and retry in 30 min; errors in plain words, `Trouble`), SHA-256 checked, `codesign --verify`, then a detached
  script swaps the bundle after the app quits and reopens it. Falls back to the release page when the app can't write
  to its own location (disk image, App Translocation).
- Versions are plain X.X.X (the owner's choice). For a release: bump `version` in package.json (and package-lock.json:
  `npm install --package-lock-only`), write `NOTES.txt`, push to main; `.github/workflows/release.yml` builds and
  publishes `v<version>` with the .dmg, .zip and latest.json. Also update `public/desktop.json` in the private repo
  (version, release url): copies older than 1.2.0 read that instead.
- Owner is a law student; explain plainly. Ad hoc signed, unsigned by Apple: first install needs Open Anyway.
