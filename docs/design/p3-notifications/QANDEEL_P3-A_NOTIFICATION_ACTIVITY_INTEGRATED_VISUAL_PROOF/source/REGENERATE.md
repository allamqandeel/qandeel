# P3-A — Regenerate the package

Requirements: Node 24 (global `WebSocket`, no npm packages), Google Chrome at
`C:\Program Files\Google\Chrome\Application\chrome.exe` (headless, over the DevTools Protocol), and an ffmpeg with an
H.264 encoder for the clips (this host: CapCut's bundled `ffmpeg.exe`, `h264_mf`). Nothing is installed.

```text
node source/tools/p3vendor.mjs      # only to re-copy the P2 material (merged P2-A) and G3.2's reviewed page (records PROVENANCE.json)
node source/tools/p3pipeline.mjs    # build → 117 captures + 13 phone clips → 18 boards + M06 → COPY_TABLE.md → checks
node source/tools/p3package.mjs     # byte-identical rebuild, MANIFEST.json, the review ZIP outside the repository
```

| Step | Tool | Output |
|---|---|---|
| vendor | `tools/p3vendor.mjs` | `source/` P2 copies and `prototype/g3.2/index.html` (G3.2's reviewed prototype, byte-exact; the Analysis surface, loaded in a frame) |
| build | `src/build.mjs` | `prototype/index.html` — one offline file: Estedad v8.5, the frozen tokens, P2 glyphs, the model, the fixtures, the copy and `src/app.js` |
| capture | `tools/p3capture.mjs` | `WORK/shots/*.png` + `data/SHOTS.json` (geometry per shot); `motion/*.mp4` + `data/motion/*.json` (per-frame truth); `captures/` |
| boards | `tools/p3boards.mjs` | `boards/*.png`, `data/BOARDS.json`, `data/A11Y.json`, M06 |
| copy | `tools/p3copy.mjs` | `data/COPY_TABLE.md` (interface strings with their status, and the FIXTURE table) |
| checks | `tools/p3checks.mjs [--no-git] [--out file]` | `data/CHECKS.json` (writes in place by default; pass `--out` to verify without touching evidence) |
| package | `tools/p3package.mjs` | `MANIFEST.json`; `E:\QANDEEL\QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF.zip` (env `P3_ZIP`) |

`WORK` is scratch outside the repository: env `P3_WORK`, else `%TEMP%\qandeel-p3a-work`. Captures are deterministic:
the page runs on a virtual clock in capture mode (`?capture=1`, `window.P3.tick`).

**Fixtures** are `src/fixtures.mjs` (synthetic only). **The model** is `src/model.mjs`; the page ships the same file.
**Provenance:** `source/PROVENANCE.json` lists every vendored P2 file with its P2-A path, bytes and SHA-256
(re-verified by check C-SCOPE-3).
