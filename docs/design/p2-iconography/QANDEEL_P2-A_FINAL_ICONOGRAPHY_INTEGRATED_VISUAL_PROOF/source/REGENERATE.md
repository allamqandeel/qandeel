# Regenerating P2-A

Everything is rebuilt from `source/` alone.

## Requirements

- Node.js 24 or later. No npm install is needed: the tools use Node built-ins only.
- Google Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`. The path is fixed in `tools/lib/cdp.mjs`.
- For the clips, an ffmpeg with H.264. The default is CapCut's bundled `ffmpeg.exe`; set `P2_FFMPEG` to use another.
- Scratch lives outside the repository: `P2_WORK`, default `%TEMP%\qandeel-p2a-work`.

## Steps (run from `source/`)

| Step | Command | Produces |
|---|---|---|
| 1 | `node src/build.mjs` | `prototype/index.html`. It refuses to build unless the vendored world equals the pin `4DFD9D27…` |
| 2 | `node tools/p2capture.mjs shots` | 87 Product captures (virtual clock, real pointer input for scrubs; 24 of them are the End Call study) → `data/SHOTS.json` |
| 3 | `node tools/p2capture.mjs clips` | `motion/*.mp4` + `data/motion/*.truth.json`; each decoded back to its frame count |
| 4 | `node tools/p2endstudy.mjs` | `data/END_CALL_STUDY.json`: the End Call glyph presence at 24 / 26 / 27 / 28 px, measured, and the selection (P2-A refinement). It fails if the selection differs from `END_GLYPH_PX` |
| 5 | `node tools/p2boards.mjs` | `boards/*.png` (16), `data/BOARDS.json`, `data/NAV_MATERIAL.json` |
| 6 | `node tools/p2checks.mjs` | `data/CHECKS.json` (25 checks, 9 planted defects) |
| 7 | `node tools/p2package.mjs` | `captures/`, `MANIFEST.json`, and the review ZIP outside the repository, read back and verified |

`node tools/vendor-utility.mjs` re-fetches the utility-comparison glyphs from each library's npm package. It is only
needed to refresh that evidence.

## Lineage

`src/app.js`, `src/build.mjs`, `src/content.mjs`, `src/bridge.js`, `src/bidi.js` and `src/tokens.mjs` start from the
reviewed G3.2 source (`docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/src/`). Every P2-A change is marked
`P2-A` in comments. `src/glyphs.mjs` is kept for the Q mark only. `src/sig.mjs`, `src/utility.mjs` and
`src/machines.mjs` are new. The P2-A refinement added `tools/p2endstudy.mjs` and the `?end=` harness stand-in, and set
`END_GLYPH_PX = 27` in `src/machines.mjs`. The preserved G3.2 package itself is not modified.
