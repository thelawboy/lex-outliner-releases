# Lex Outliner for Mac

[Lex Outliner](https://lex.nicholasgirard.com) in its own window, with Touch Bar buttons: **Class note** | **Brief**,
**Authority**, **Problem**, **Summary**, **Rule**, **Test** | **Outline** and **Outline beside notes**, each with Lex's
icon in your node type's color.

The window shows the website, so every change to Lex reaches the app on its own. Only the app itself (the window, the
Touch Bar, the menus) is updated from here, and it updates itself: when a new version is out it offers **Update and
Restart**.

## Installing

1. Open the newest [release](https://github.com/thelawboy/lex-outliner-releases/releases/latest) and download
   **Lex-Outliner-mac.dmg**.
2. Open it and drag **Lex Outliner** into **Applications**.
3. The first time, macOS refuses to open it, because it isn't signed with a paid Apple developer account. Click
   **Done**, then open **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to
   Lex Outliner. You only do this once: updates the app installs itself don't ask again.

If macOS says the app "is damaged", run `xattr -cr "/Applications/Lex Outliner.app"` in Terminal and open it again.

## What's here, and what isn't

This repository holds only the desktop app: a window onto lex.nicholasgirard.com, its Touch Bar, and its updater. No
notes, accounts, keys or passwords are here or in the app; your notes are stored by the website, behind your sign-in.

- `main.js`: the window and the Touch Bar. Links to other sites open in your browser; Overleaf opens inside.
- `preload.js`: all the website gets from the app: Touch Bar commands, and a way to say how the buttons look.
- `update.js`: updates. It reads `latest.json` from the newest release here, downloads that release's zip only from
  this repository over HTTPS, checks it against the release's SHA-256 and the app's signature, then swaps it in and
  restarts.
- `.github/workflows/release.yml`: builds the app on GitHub's Macs and publishes the release, for a new `version` in
  `package.json` (with `NOTES.txt` as its notes).
