# P2-A — Utility Library Comparison

**Status:** `P2-A EVIDENCE — RECOMMENDATION FOR PRODUCT OWNER REVIEW — NOT A FROZEN LIBRARY CHOICE`.

**Visual evidence:** board 02 (`boards/02-utility-library-comparison.png`) and board 10 (the real 16 / 20 / 24 px rasters).
**Glyph data:** `source/vendor/utility/utility-glyphs.json` (fetched from each library's own npm package, with URL and
SHA-256), plus the licence texts. No package was installed, and `apps/mobile/package.json` is unchanged.

## 1. The test

- **Set.** The same eight meanings in each library: close, edit, settings, chevron, overflow, add, back (a chevron in
  the Product; an arrow in the sheet), search. Only three of them are rendered in today's proof (back, close, settings
  as a candidate).
- **Beside the family.** Each row ends with three QANDEEL signature glyphs (mic, send, replay), so the optical match is
  judged beside the family, not in isolation.
- **Three renders per library:**
  - as published, at 24 px, dark;
  - **normalised**, at 24 px, dark;
  - normalised, at 20 px, Light.

  Normalised means the library's stroke is replaced by QANDEEL's optical stroke, 1.60 u at 24 px and 1.75 u at 20 px.
  No path is edited. That is exactly what a production wrapper's `strokeWidth` prop would do.

## 2. Scoring (1 = poor, 5 = strong)

| Criterion | Hugeicons Free (Stroke Rounded) | Lucide | Tabler (outline) | Iconoir (regular) | Phosphor (regular) |
|---|---|---|---|---|---|
| Optical weight vs QANDEEL (native stroke → 1.6 u) | **5** (1.5 → 1.6) | 3 (2.0 → 1.6) | 3 (2.0 → 1.6) | 4 (1.5 → 1.6) | 3 (16-px design grid; heavier at small sizes) |
| Terminal compatibility (round caps / joins) | **5** | 5 | 5 | 5 | 4 |
| Detail density at 20–24 px | 4 (edit / settings slightly busier) | 4 | 3 (densest) | 4 | 4 |
| Small-size legibility (16 px, board 10) | 4 | 4 | 3 | 3 (airy; weak overflow dots) | 4 |
| Arabic / RTL behaviour | 5 (plain chevrons; mirroring is QANDEEL's rule) | 5 | 5 | 5 | 5 |
| React Native maintenance | **5**: official, same repository, updated 2026-08/09 | 5: official | 5: official | 4: official; needs RN ≥ 0.78 and svg ^15.12 | **1**: first-party repository dormant since 2023-05; community wrapper |
| Licence | MIT (free set); **Pro is paid and excluded** | ISC | MIT | MIT | MIT |
| Import model / tree-shaking on Metro | per-icon ESM files (6,067 counted) + a renderer package; "tree shakeable builds … for bundlers like Metro" (its README) | "tree-shakable", one component per icon (its guide) | not measured here | not measured here | a barrel; "pulls **all 1512 icons**" without Expo tree-shaking (its README) |
| Dependency cost | `react-native-svg` + two packages | `react-native-svg` + one | `react-native-svg` + one | `react-native-svg` + one | `react-native-svg` + one (+ bundle risk) |
| Ease of normalisation | **5**: `strokeWidth` prop; closest native weight | 5 | 4 | 5 | 2: fixed weights; one icon carries all six |
| Risk of looking like a generic icon pack | medium: rounded, softer. It sits nearest the Open nuance, and it is the least recognisable as "the default" | **high**: the de-facto default look of 2020s apps | high | medium | medium |
| Coverage for future utilities (glyph files counted in the published package, jsDelivr listing, 2026-09-26) | 6,067 free (`dist/esm/*Icon.js`) | 2,118 (`lucide-static/icons`) | 5,166 (`icons/outline`) | 1,383 (`icons/regular`) | 1,512 (`assets/regular`) |

## 3. What the boards show

- **Normalised to 1.6 u,** Lucide, Tabler and Hugeicons become visually close. The remaining differences are drawing
  character:
  - Lucide's and Tabler's even geometric construction is the familiar look of most apps built since 2020;
  - Hugeicons' rounded construction is closest to the family's Open nuance, with round caps and soft joins.
- **Hugeicons moves least** under normalisation (1.5 → 1.6 u), so its published proportions survive intact.
- **Iconoir** shares the weight, but its lighter drawings, such as the overflow dots, lose presence at 20 px.
- **Phosphor** is excluded for maintenance and bundle reasons, not for drawing quality.

## 4. Recommendation

> **Hugeicons Free (Stroke Rounded) as the SOURCE of the utility family, with Lucide kept as the reference benchmark.**

The evidence supports the Product Owner's leading candidate. The **integration** recommendation is narrower than
"add the library":
- vendor the curated subset of Hugeicons Free drawings the Product actually uses (today three; a few more later) into
  QANDEEL's own icon registry, with the MIT notice;
- render them with the **same** renderer and the same optical-stroke rule as the signature family;
- add **no runtime icon-library dependency**. This avoids Metro tree-shaking risk and a second icon API, and it keeps
  one normalisation path.

If a future task prefers the package, `@hugeicons/react-native` + `@hugeicons/core-free-icons` with deep imports is the
path. It needs explicit approval, like any dependency.

**Hugeicons Pro is out of scope** and was not used or evaluated. It is a paid licence (task §5).

## 5. Open to the Product Owner

- Whether the utility family should visibly **match** the signature family (Hugeicons, recommended) or stay a
  neutral, more anonymous companion (Lucide). Both normalise cleanly; this is taste, and the boards show both.
