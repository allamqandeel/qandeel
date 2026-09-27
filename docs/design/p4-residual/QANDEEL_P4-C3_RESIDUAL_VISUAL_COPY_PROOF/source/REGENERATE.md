# P4-C3 — Regenerate the package

Requirements: Node 24 (global `WebSocket`, no npm packages) and Google Chrome at
`C:\Program Files\Google\Chrome\Application\chrome.exe` (headless, over the DevTools Protocol). Nothing is installed.

```text
node source/tools/c3vendor.mjs              # only to re-copy frozen material → source/PROVENANCE.json
node source/tools/c3pipeline.mjs [--no-git] # build → copy table → captures → seal → checks → boards → checks → seal
```

| Step | Tool | Output |
|---|---|---|
| build | `src/build.mjs` | `prototype/index.html` — one offline file: Estedad v8.5, the frozen tokens, P2 / P3 glyphs, the Q, the I-08B2.5 Android icon layer, the copy registry and `src/app.js` |
| copy table | `tools/c3copytable.mjs` | `data/COPY_DECISION_TABLE.md`, `data/COPY_REGISTRY.json` (registry + P3-A fixture sentences read from P3-A) |
| capture | `tools/c3capture.mjs` (plan: `tools/shots.mjs`) | `WORK/shots/*.png` at 2×, `data/SHOTS.json`, `captures/` (the kept subset); journeys by real pointer input |
| checks | `tools/c3checks.mjs [--no-git] [--out file]` | `data/CHECKS.json`, `data/A11Y.json` — static and live-page checks and planted defects |
| boards | `tools/c3boards.mjs` | `boards/*.png`, `data/BOARDS.json` |
| package | `tools/c3package.mjs` | proves the byte-identical rebuild, writes `data/PROVENANCE.json` and writes + verifies `MANIFEST.json` |

`WORK` is scratch outside the repository: env `P4C3_WORK`, else `%TEMP%\qandeel-p4c3-work`.

Serve `prototype/` over `http://` to open the live page (the Analysis states load `prototype/g3.2/index.html` in a
frame). The panel beside the phone is the **PROOF HARNESS — NOT PRODUCT UI**.
