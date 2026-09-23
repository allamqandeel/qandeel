# Regenerating the G1.2 proof

Requires Node 22+ and Google Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`. The MP4 encoder is
CapCut's bundled ffmpeg (`%LOCALAPPDATA%\CapCut\Apps\9.2.0.3931\ffmpeg.exe`), this host's only H.264 encoder.

To regenerate, run these from this `source/` directory, in order:

1. `node src/build.mjs` — the three prototype pages → `out/prototype/`
2. `node tools/screens.mjs` — every phone capture → `out/screens/` + `SCREENS.json`
3. `node tools/motion.mjs > out/motion-run.log` — 13 recordings + truth logs → `out/motion/`
4. `node tools/boards.mjs` — the review boards → `out/boards/`
5. `node tools/checks.mjs` — the verification → `out/data/G12_CHECKS.json` (exit code 1 on any failure)

`tools/package.mjs` assembles the package, and only when every check passes and every probe is rejected.

`tools/contact.mjs` is a review aid (contact sheets). It is not part of the package.
