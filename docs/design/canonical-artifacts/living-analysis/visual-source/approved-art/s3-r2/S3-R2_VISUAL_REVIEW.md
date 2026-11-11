# MAP-CLOSE-01 Step 3: S3-R2 visual review package (built on the approved S3-R1)

**Status:** `S3-R2 — PRESENTED FOR PO VISUAL REVIEW — NOT APPROVED — DESIGN IMAGES ONLY — NOTHING IMPLEMENTED`

**Date:** 2026-11-10.

**Base:** S3-R1, which the PO approved with all five of its changes. AD-4 is kept only for comparison and as a reference rollback point.

**Scope:** exactly three improvements:
1. light around the nodes;
2. fine threads;
3. fullness of the quiet areas.

**Out of scope:**
- the production engine and renderer;
- data, names, relations, group membership and positions;
- text layout;
- frozen contracts;
- N4, CAL-2, V-3 and Replay.

**Not done:** no round S3-R3.

## 1. Gate: S3-R1 reproduced before and after the change (PASS)

**Before any change:**
- I re-rendered S3-R1 from `S3-R1/proto` (`web.js` `56261090…`, `hero.html` `2b908dd7…`) with `?p=6000000&wk=2600&s3=amb,bloom,edgeglow,smooth,farweb`.
- The result is **`b7275b4c…`**, byte-identical to the approved `REVIEW/02-S3-R1-hero-2400.png`.
- The render toolchain is the same as S3-R1's: Chrome 157.0.8103.39 with `--disable-gpu`, and sharp 0.35.5.

**After the change:**
- `S3-R2/proto` is a copy of S3-R1's prototype: `web.js` `ffc81c4b…` and `hero.html` `0bcb1f3d…`. The fonts are identical.
- Every change sits behind a new switch in `opts.s3`: `core`, `fine` or `fill`.
- With the S3-R1 switches only, the S3-R2 code renders **`b7275b4c…` byte for byte**. I ran this check after each tuning step and again on the final values.

## 2. Mechanical checks

**Data is stable.** I compared 15 fields of the result JSON:
- titles;
- nodes, relations and labels;
- label layout, collisions and audit;
- two-line labels;
- group membership and group colours;
- edge classes;
- regions;
- every node position;
- **lights**;
- the font.

I checked every render against S3-R1: `+core`, `+core+fine`, the final image, `fine` alone, `fill` alone and the repeat render. **All 15 fields are identical in each one.** S3-R2 adds no light, node or element.

**Each change works on its own.**
- `fine` alone gives `599937df…`.
- `fill` alone gives `e4187f96…`.
- `core` can be switched off independently of the other two.

**The output is deterministic.** The final image `6bd02896…` re-rendered byte-identical.

## 3. What changed, and why

### R2-1 `core`: light around the nodes
**Why:** in S3-R1 the hub centre filled its ring with white. It read as a lit disc, and the star rays inside it disappeared.

**What:**
- **The centre:** less white and less energy at the core of each node:
  - the raster core takes the node's own saturated colour (25% white instead of 60%);
  - the inner vector halo drops from 1.0 to 0.6 opacity on hubs, and its white mix from 60% to 30%.
- **The glow:** R1's bloom energy moves out of the centre into a wider, softer glow, in three nested radii instead of two. It uses the node's own colour, not the light colour mixed towards warm white.
- **Unchanged:** the rays, the ring, the white centre dot and the hub/element tier difference.

**Result:**

| Measure | S3-R1 | S3-R2 |
|---|---|---|
| Near-white pixels at hub centres | 3,463 | 2,224 (−36%) |
| Near-white pixels at element centres | 2,233 | 1,989 (−11%) |
| Glow chroma around hubs | 57.8 | 61.0 |
| **Global mean luma, `core` alone** | **49.40** | **49.39** |

The overall light did not rise to make up for the reduced centres: I lowered the outer glow until it stayed at or below R1.

### R2-2 `fine`: fine threads and web
**Why:** the clusters and the transitions between them lacked fine detail.

**What:** 2,600 thin, long, flowing filaments on their own random stream.
- **Where they start:** weighted towards cluster membership, the density of the web, and the transitions between two groups.
- **Colour:** each takes its place's own colour, interleaved where two groups meet, as in AD-4.
- **Drawn after the glow:** so they stay crisp, never become haze or fog, and do not raise the light around them.
- **No noise:** one deposit per step, with no side scatter.
- **Kept clear of** names and nodes.
- **Hierarchy:** every relation stays far brighter than these filaments.

### R2-3 `fill`: fullness of the quiet areas
**Why:** the deep-space voids were still visually empty.

**What:**
- **Wisps:** 750 very faint wisps in the neutral deep-space colour, only where no group is present. They fade towards the groups and under the names.
- **Tone:** a slight tonal variation in the body of the deep space.

**Kept out on purpose:**
- no stars, bright knots or glints;
- no salient element;
- nothing under any name.

The rest space stays dark.

**Measured** in areas more than 70 css px from any node:

| Measure | S3-R1 | S3-R2 |
|---|---|---|
| Mean luma | 32.0 | 34.4 |
| Fine detail | 22.5 | 24.7 |

**Global luma:** 49.40 for S3-R1 against 51.57 for the final image, +4.4%. **All of the rise comes from the added threads and the fill; none comes from node light** (49.39 with `core` alone).

The PO's rule holds: these numbers are supporting evidence only, and **the judgement is visual**.

**Rejected during the round:**
- **v1:** the threads were drawn before the glow, so they turned into a faint haze and were too weak to see.
- **v1 fill:** a scatter of dust. Dropped as noise.
- **The first `core`:** it weakened the glow around the hub too much. I corrected it by moving energy outwards rather than adding it at the centre.

## 4. Review files (`REVIEW-R2/`)

| File | Content |
|---|---|
| `01-S3-R1-hero-2400.png` | S3-R1, 2400 × 1788 |
| `02-S3-R2-hero-2400.png` | S3-R2 at the same size |
| `03-S3-R2-progression-board.png` | One change per step, each with a full-size crop of the «الخوف» hub and of a quiet area |
| `before-after/A1…A5` | **Luminous nodes:**<br>• the «الأبوة» centre at ×3;<br>• the «الخوف», «العلاقات» and «القرارات» hubs;<br>• the elements of «الخوف» |
| `before-after/B1…B3` | **Fine threads:**<br>• the «العلاقات» cluster;<br>• the «الخوف» / «الأبوة» transition;<br>• the «الوحدة» / «العمل» transition |
| `before-after/C1…C3` | **Quiet areas:**<br>• top right;<br>• bottom centre;<br>• right edge |
| `phone/phone-{1-left,2-centre,3-right}-{S3R1,S3R2,before-after}.png` | Portrait 822 × 1788 crops at the same positions as S3-R1 |
| `PRIVATE-DO-NOT-PUBLISH/quality-vs-Dashboard01-R2.png` | Dashboard01, S3-R1 and S3-R2. **Private: never commit or publish it.** Dashboard01 is a light-and-density quality reference only; none of its divisions or colour meanings were taken |

Supporting files:
- `S3-R2/S3-R2-web.js.diff`: 93 lines.
- `S3-R2/S3-R2-metrics.txt`.
- `S3-R2/tools/`: the patch, the render script, the metrics, the crops and the package builder.

Every file's SHA-256 is in `S3-R2-MANIFEST.sha256`.

**Known limits:**
- **Phone views:** these are crops of the desktop-scale render, not a device capture.
- **Hub prominence:** at phone scale the hub reads a little less loud than in S3-R1, because its white disc is gone. It is now a star with a clear centre inside a ring, and the hub is still clearly larger than an element. The PO should judge this.
- **Glow strength:** each switch is tuned on fixed values. Only the PO's visual judgement decides whether the glow should be slightly stronger or quieter.

## 5. Decisions for the PO
- Accept or reject each change (`core`, `fine`, `fill`) separately. Each one can be switched off without affecting the others.
- Say what still falls short. **No other round starts and nothing moves to V-3 without the PO's approval.**

**Not done:**
- no implementation in the app;
- no new data;
- no production-code change;
- nothing published, committed or pushed.
