# P4-C — Provenance

Every byte this proof did not author comes from a frozen record on `main` at `175df7b`, copied **byte-exact** by
[`source/tools/p4vendor.mjs`](../source/tools/p4vendor.mjs) and listed with its origin, size and SHA-256 in
[`source/PROVENANCE.json`](../source/PROVENANCE.json). `C-PROV-1` re-hashes each file against its canonical origin on every
check run. Nothing vendored is ever edited.

## 1. Vendored, byte-exact

| Material | Origin (on `main`) | In this package | Guard |
|---|---|---|---|
| G3.2's reviewed prototype — the whole Analysis | `docs/design/canonical-artifacts/product-proofs/g3/g3.2/prototype/index.html` | `prototype/g3.2/index.html`, SHA-256 `10611f35cdcfd031d74ad0b065634a19f530e2b1e28acfd2c944d4f2d4983d71` — loaded unchanged in a frame | `C-G32-1` |
| P2 signature family (N1), Call Rail A, utility sourcing, token resolver | P2-A `source/src/sig.mjs`, `machines.mjs`, `utility.mjs`, `tokens.mjs` | `source/src/` | `C-PROV-1`, `C-NAV-7` |
| The frozen token tree (B4R, C3, D2R, E1, F1, F2, G1.1 alias; dark / light / increased contrast) | P2-A `source/vendor/tokens/` | `source/vendor/tokens/` | `C-PROV-1`; `tokens.mjs` refuses to build if a frozen literal disagrees |
| Estedad v8.5 and its OFL | P2-A `source/vendor/fonts/` | `source/vendor/fonts/` | `C-PROV-1` |
| Curated utility drawings (Hugeicons Free, normalised by `utility.mjs`) and licences | P2-A `source/vendor/utility/` | `source/vendor/utility/` | `C-PROV-1` |
| Open Ledger (the Activity entry glyph, P3 §5.1) | P3-A `source/src/p3glyphs.mjs` | `source/src/p3glyphs.mjs` | `C-PROV-1` |
| The canonical Q master | `docs/design/canonical-artifacts/brand/i-08b2.5/masters/QANDEEL_Q_BASE_MASTER.svg` | `source/vendor/brand/QANDEEL_Q_BASE_MASTER.svg` | `C-Q-0`, `C-Q-1` |
| CDP driver and static server | P2-A `source/tools/lib/cdp.mjs`, `server.mjs` | `source/tools/lib/` | `C-PROV-1` |

## 2. Adapted (P4-C's own files, modelled on accepted packages)

| P4-C file | Modelled on | What changed |
|---|---|---|
| `source/src/build.mjs` | P3-A `source/src/build.mjs` | the same inline-font, token-variable and shell-geometry construction; P4-C's candidate styles added; no P3 notification runtime |
| `source/src/app.js` | P3-A `source/src/app.js` | the same one-state / render-top-to-bottom runtime and the same G3.2 framing method (ready → clock 0 → enter state → settle); candidates from the registry; no attention model. At runtime it sets `inert` on G3.2's own rail when a candidate switcher replaces it (no G3.2 byte changes) |
| `source/src/content.mjs` | P3-A `content.mjs`, G3.2 `content.mjs` | the words the proof shows, each with its status and source; no new Product copy |
| `source/tools/lib/session.mjs`, `lib/sheet.mjs` | P3-A `lib/session.mjs`, `lib/sheet.mjs` | ports and scratch folder renamed for P4-C |

## 3. Authored for P4-C

`source/src/candidates.mjs` (the one candidate registry), `source/src/qmark.mjs` (reads the Q master), and the tools
`shots.mjs`, `p4capture.mjs`, `p4checks.mjs`, `p4matrix.mjs`, `p4boards.mjs`, `p4package.mjs`, `p4pipeline.mjs`,
`p4vendor.mjs`.

## 4. Fixture content

The Personal thread is G3.2's own fixture conversation (today), with the G1.1 §1 normal Arabic opener (canonical) and
G3.2's proof English opener. The Shared World «رحلة الصيف» / "Summer trip", its two turns and the three Activity rows are
P3-A fixtures, reproduced verbatim. Every fixture string is marked `FIXTURE` in `content.mjs` and is never Product copy.

## 5. Regenerate

Requirements: Node 24 (no npm packages) and Google Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`.

```text
node source/tools/p4vendor.mjs     # only to re-copy the frozen material (rewrites source/PROVENANCE.json)
node source/tools/p4pipeline.mjs   # build → 124 captures → checks → matrix → seal → checks → 11 boards → seal → checks → final seal
```

Scratch output (the full 2× captures and board HTML) goes outside the repository: env `P4_WORK`, else
`%TEMP%\qandeel-p4c-work`. The package keeps the 28 representative captures in `captures/`.
