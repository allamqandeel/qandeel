# S3-R2: how to reproduce the final approved art direction (MAP-CLOSE-01 Step 3)

**Status:** `S3-R2 — FINAL APPROVED VISUAL ART DIRECTION (PO, 2026-11-10)`.

**What S3-R2 is:**
- all three improvements are accepted (`core`, `fine` and `fill`);
- it is built on S3-R1, which carries five accepted changes, and S3-R1 is built on AD-4;
- every name, element, relation, colour and group membership in it is **declared synthetic**;
- it is a visual reference, not product data.

## Inputs
| File | Note | SHA-256 |
|---|---|---|
| `proto/web.js` | — | `ffc81c4bf4531376bd8648056f569309be28da69c6103ab3c43fded7cc47b2c1` |
| `proto/hero.html` | — | `0bcb1f3de1adf78c542db6fd558656cb9e1ede5d5f4a6ce6a5a4aa84762446b6` |
| `proto/fonts/Estedad-*.ttf` (OFL) | byte-identical to the app's `apps/mobile/assets/fonts/estedad/` | — |

## Toolchain
- **`tools/shootf.sh`:** Chrome 157.0.8103.39 headless with `--disable-gpu`, device scale 2 and a virtual-time budget of 600 s.
- **Image library:** `sharp` 0.35.5, loaded from `E:/s8b07spike`. Edit that path if you rebuild elsewhere.
- **Runtime:** Node 24.19.0 on Windows 11.
- **Output path:** must be **absolute**.

## Renders
`URL = file:///<abs>/proto/hero.html`, size 1200 × 894 css (2400 × 1788 px).

| What | Query | SHA-256 |
|---|---|---|
| **S3-R2 (final)** | `?p=6000000&wk=2600&s3=amb,bloom,edgeglow,smooth,farweb,core,fine,fill` | **`6bd028962b4a91e54c541d70232e7a3d820bc6389cf4eac3bf07497c59ae5371`** |
| S3-R1 (historical; R2 switches off) | `?p=6000000&wk=2600&s3=amb,bloom,edgeglow,smooth,farweb` | `b7275b4c00e6870222d382e55715214cb10b485c1fb0c5a7eb5ae72eadadbfd6` |
| `+core` | `...,core` | `28a059cb733306eacbc3ee9b377c000b34a20843fa1eb4abdd21971dc5c03ecf` |
| `+core+fine` | `...,core,fine` | `aed63a2f209267eadba1594219ab380db2c265f9c7e5bcd2283effe4ed62f5c7` |
| `fine` alone | `...,fine` | `599937df1bbc07298d9d6b10582273b02ce8800bd1f7303230e805e27c41aaf3` |
| `fill` alone | `...,fill` | `e4187f96e0c0dc2f65f2c078a78c5e1ac0ec3109bf0c14b63184a7668559fb99` |

AD-4 (historical) is not reproduced from this file. It reproduces from the AD-4 archive v1, with `?p=3000000&wk=2600`, giving `be16f2b7…`.

## The approved parameters
They are fixed in `proto/web.js`, as the defaults of `tools/s3r2-patch.mjs`:

| Switch | Parameters |
|---|---|
| `core` | `hw 0.25`, `hk 0.8`, `ek 0.38`, `b1h 0.026`, `b1e 0.024`, `b2h 0.046`, `b2e 0.018`, `b3h 0.018`, `vh 0.6`, `ve 0.75` |
| `fine` | 2,600 threads, `fk0 0.18`, `fk1 0.28`, drawn after the glow |
| `fill` | `fk 0.11`, 750 wisps, `fwk0 0.06`, `fwk1 0.10` |

## Contents
- **`out/`:**
  - the renders above, each with its result JSON;
  - the JSON fields titles, nodes, relations, labels, layout, groups, edge classes, regions, node positions, lights and font are identical across every render.
- **`review-S3-R2/`:** the review package the PO approved:
  - full images and the progression board;
  - before/after crops;
  - phone crops.
- **`review-S3-R1-historical/`:** the S3-R1 package, kept as history.
- **Also included:**
  - `S3-R2-web.js.diff`, against S3-R1;
  - `S3-R2-metrics.txt`;
  - `S3-R2_VISUAL_REVIEW.md`;
  - `tools/`.

**Not included:** no third-party image. Dashboard01 and the private comparison boards are **not** in this archive.
