# I-08B2.5 — regenerating this package

Everything here is deterministic given the four approved I-08B2.3 masters, the frozen
I-08B2.4 Variant B file, and a Chromium-family browser. No network access is needed.

## Requirements

- Node.js 18+ (built with v24.19.0). No npm packages — only Node built-ins.
- Chrome or Edge. The tools look in the usual Windows install paths; override with
  `QANDEEL_CHROME=<path to chrome.exe>`.
- The approved masters. Override their location with `QANDEEL_Q_MASTER_DIR`.
- The frozen I-08B2.4 package, for the canonical app-icon source. Override with
  `QANDEEL_B24_DIR`.
- Output root for the assembled package: `QANDEEL_PROJECT_ROOT`.

## Order

```
node build-svg.js       # writes every SVG and Android resource file
node export.js          # rasterises every production PNG through Chrome
node validate.js        # small-size validation -> review/small-size-validation.json
node boards.js          # the four review boards  (or: node boards.js platform|wordmark|small|mono)
node verify.js          # 39 geometry-identity checks -> review/GEOMETRY_VERIFICATION.json
node package.js         # assembles the package at the project root, writes the manifest, zips it
```

`build-svg.js` through `verify.js` write into `../out`, which is disposable — deleting it and
re-running reproduces it exactly. The written report is **authored, not generated**, and
therefore lives in `../report`, outside that tree; `package.js` copies it into the package's
`docs/` alongside the manifest it generates. Keeping it in `out/docs` meant a clean rebuild
deleted it, which is how that arrangement was found to be wrong.

Diagnostics, not part of the build:

```
node probe-opening.js   # ring opening vs bloom vs resolution (the §9.3 table)
node wm-bbox.js         # wordmark ink bbox against the master viewBox (the L-4 check)
node assets.js          # prints the declared framing table
node geom.js            # prints what was extracted from the masters
```

## What each file is for

| file | role |
|---|---|
| `qgeom.js` | inherited unchanged from I-08B2.4: Q bbox, minimum enclosing circle, verbatim path extraction |
| `geom.js` | extends it to all four masters; lifts each master's defs block verbatim |
| `assets.js` | **the single declared parameter table.** Framing, colours, export size lists. Everything else reads it, so artwork and review material cannot drift apart |
| `png.js` | PNG encode/decode. `encodeRGB` writes colour type 2, with no alpha channel, for iOS |
| `chrome.js` | headless Chrome rasterisation at an exact pixel size |
| `build-svg.js` | writes the SVGs and Android XML |
| `export.js` | writes every production PNG |
| `validate.js` | the small-size measurements |
| `boards.js`, `canvas.js`, `font.js` | the review boards |
| `verify.js` | the geometry-identity proof |
| `package.js` | assembly, manifest generation, zip |

## Two traps worth keeping

- **A double hyphen inside an XML comment makes the whole SVG unparseable.** Chrome renders
  a broken-image glyph and the export still "succeeds" as a near-empty PNG. `build-svg.js`
  refuses to write such a file, and `export.js` rejects any render carrying less than 1%
  content. Both guards exist because this happened during the build.
- **Never point-sample a feature about one pixel wide.** A nearest-pixel probe of the ring
  opening reported 0.889 at 29 px and 0.405 at 32 px on identical geometry — that is
  sub-pixel phase, not artwork. `validate.js` samples bilinearly across the whole channel.
