# P4-C — Regenerate the package

Requirements: Node 24 (global `WebSocket`, no npm packages) and Google Chrome at
`C:\Program Files\Google\Chrome\Application\chrome.exe` (headless, over the DevTools Protocol). Nothing is installed.

```text
node source/tools/p4vendor.mjs      # only to re-copy frozen material (P2-A, P3-A Open Ledger, the Q master, G3.2) → PROVENANCE.json
node source/tools/p4pipeline.mjs    # build → captures → checks → matrix → checks → boards → checks → MANIFEST.json
```

| Step | Tool | Output |
|---|---|---|
| build | `src/build.mjs` | `prototype/index.html` — one offline file: Estedad v8.5, the frozen tokens, P2 / P3 glyphs, the Q, the registry and `src/app.js` |
| capture | `tools/p4capture.mjs` (plan: `tools/shots.mjs`) | `WORK/shots/*.png` at 2×, `data/SHOTS.json` (state + measured geometry), `captures/` (the kept subset) |
| checks | `tools/p4checks.mjs [--no-git] [--out file]` | `data/CHECKS.json` — DOM checks on the live page, static checks, 15 planted defects |
| matrix | `tools/p4matrix.mjs` | `data/DECISION_MATRIX.json` and `docs/P4C_DECISION_STUDY.md` |
| boards | `tools/p4boards.mjs` | `boards/*.png`, `data/BOARDS.json` |
| package | `tools/p4package.mjs` | proves the byte-identical rebuild, writes and verifies `MANIFEST.json` |

`WORK` is scratch outside the repository: env `P4_WORK`, else `%TEMP%\qandeel-p4c-work`.
