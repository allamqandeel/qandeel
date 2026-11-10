# QANDEEL — AD-4 art base — durable archive v1 (MAP-CLOSE-01 Step 2)

**Status:** AD-4 is a `TEMPORARY ART BASE — NOT FINAL — NOT APPROVED`. This archive preserves it. It approves nothing.
**Created:** 2026-11-10, from the study folder `E:\QANDEEL_REPORTS\MAP-VISUAL-REFRESH-01\` (copied byte for byte).
**Integrity:** `MANIFEST.sha256` lists every file in this archive except itself.
- Check it with `sha256sum -c MANIFEST.sha256`, run from this folder.
- The repository keeps a copy at `docs/design/canonical-artifacts/living-analysis/visual-source/art-base/ad-4/AD4-ARCHIVE-v1.MANIFEST.sha256`.

**All data is synthetic:** names, elements, relations, colours and memberships.
**This archive contains no Dashboard01 and no other third-party image.** The study tools only *name* the Dashboard01 copy at `V-1/inputs/NS-CANDIDATE.png`, which is not included; the AD-4 tools and board do not use it.

## Contents
| Path | What |
|---|---|
| `MAP-VISUAL-REFRESH-01/AD4/proto/` | `web.js`, `hero.html`, and `fonts/` (Estedad Regular / Medium, SIL OFL, with `OFL.txt`) |
| `MAP-VISUAL-REFRESH-01/AD4/out/` | the original renders, 2400 × 1788: `AD4-hero.png` and `AD4-world-only.png`, with their result JSON |
| `MAP-VISUAL-REFRESH-01/AD4/board-AD4.{html,png}` | the review board |
| `MAP-VISUAL-REFRESH-01/AD4/belong/` | the belonging and colour-vision test images, plus `annot.html` |
| `MAP-VISUAL-REFRESH-01/AD4/crops/` | AD-3 / AD-4 comparison crops |
| `MAP-VISUAL-REFRESH-01/AD4/*.md` | `AD4_REVIEW.md`, `AD4_PT10_PT13_ANNEX.md` |
| `MAP-VISUAL-REFRESH-01/AD3/out/` | `AD3-hero.png` / `.json`, which `board-AD4.html` references |
| `MAP-VISUAL-REFRESH-01/tools/` | the study's render and measurement harness (`shootf.sh`, `ad4-*.mjs`, …) |

## Reproduction (proven on 2026-11-10)
**Environment:**
- Windows 11.
- Google Chrome **157.0.8103.39**, headless, with `--disable-gpu`.
- Node 24.19.0.
- `sharp` **0.35.5**, which is *not* bundled. `tools/shootf.sh` loads it from `E:/s8b07spike`; elsewhere, edit that one path.

**Render** (from the folder that holds `proto/`, at device scale 2):
```sh
sh tools/shootf.sh "file:///<abs>/AD4/proto/hero.html?p=3000000&wk=2600"        "<abs>/AD4-hero.png"       1200 894
sh tools/shootf.sh "file:///<abs>/AD4/proto/hero.html?p=3000000&wk=2600&data=0" "<abs>/AD4-world-only.png" 1200 894
```
**The parameters matter.** The `hero.html` defaults (1.5 M particles, 1,800 walkers) do **not** reproduce AD-4. The original render used **3,000,000 particles and 2,600 walkers**, as `AD4_REVIEW.md` records. Seed 20261109 and dust 700 k are the defaults.

**Results (2026-11-10):**
- Rendered from the repository's pinned `web.js` (`2414dd56…`) and `hero.html` (`c7a68144…`), with the repository's Estedad fonts.
- **Byte-identical.** `AD4-hero.png` re-rendered to `be16f2b70d809f4ca2aed2c2063130ea528e50e93059f6de44108cad59d3c80d`, and `AD4-world-only.png` to `ad6ff8be7793b753d895e526a8e4ba30e2513877497fbecd550bf98f80c29fb8`.
- The decoded pixels are identical: 0 / 4,291,200 differ. The result JSON equals the original, timings excepted.
- **Not re-run:** the board, crops, belonging and colour-vision images. Their tools are included, but they were not re-executed.
- **Proven for this toolchain only.** Another Chrome version or GPU path may differ.
