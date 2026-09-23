# Regenerating G1.1-R3

The regeneration needs three things: Node 24+, Google Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe` (driven over CDP), and CapCut's bundled ffmpeg for the MP4s.

Run from `source/`. The Analysis imagery is not produced by these steps: it is the sealed F2 crop, shipped as `source/out/world/`, and is used exactly where the build expects it.

```text
node src/build.mjs        # prototype/index.html, index-en.html, index-new-conversation.html
node tools/screens.mjs    # 42 captures → out/screens (+ SCREENS.json)
node tools/motion.mjs     # 3 journeys × 859 frames → out/motion (+ *.truth.json, MP4s)
node tools/boards.mjs     # 14 boards → out/boards
node tools/checks.mjs     # → out/data/G11_R3_CHECKS.json (exit 1 on any failure or unrejected probe)
node tools/package.mjs    # the package + zip (run from the work directory)
```

**Determinism:**
- Every capture renders at a deterministic clock (`?capture=1`).
- The prototype build is byte-identical from the same source; `tools/package.mjs` verifies this against the shipped prototype.
