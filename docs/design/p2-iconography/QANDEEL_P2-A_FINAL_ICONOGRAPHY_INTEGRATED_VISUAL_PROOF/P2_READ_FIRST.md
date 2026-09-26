# QANDEEL — P2-A Final Iconography: Integrated Visual Proof and Decision Gate

> **Status: `VISUAL PROOF / DECISION GATE — PRODUCT OWNER VISUAL SELECTIONS ACCEPTED AFTER INDEPENDENT REVIEW`.**
> **P2 remains not closed / not frozen** until the later P2-B canonical closure task.
>
> - **Accepted:** the strategy and the visual selection.
> - **Not performed:** canonical P2 lifecycle closure.
>
> No production integration is authorised.

**Baseline:** `main` `209ca7269181e447f0c5192e49979aa391103871`.
**Branch:** `design/p2-final-iconography-integrated-visual-proof` (Draft PR #273).

## Accepted selections (Product Owner, after independent review)

| Decision | Accepted | Other evidence |
|---|---|---|
| Call Rail | **A "Keyed seam"**, End Call glyph **27 px** (refinement, board 16) | B, C: comparison evidence only |
| Temporal Spine + Aperture | **C "Parting"** | A, B: comparison evidence only |
| Navigation | QANDEEL navigation glyph **above** the destination word; Living Brass rules unchanged | words-only: not selected |
| Drawing nuance | **N1 "Open"**, round terminals | N2: comparison evidence only |
| Utility family | **Hugeicons Free** as the curated source / reference; no runtime package, no Pro, no dependency change | Lucide: benchmark |
| Speaking indicator | **deferred** to the future Voice runtime; no truthful real-audio signal exists in P2 | — |

## What to look at, in this order

1. `boards/05-call-rail-recommended.png` and `boards/07-temporal-spine-recommended.png`: the accepted machines in the
   real Product.
2. `boards/16-end-call-presence-26-27-28.png`: the End Call glyph presence refinement, measured.
3. `boards/04-…` and `boards/06-…`: the comparison each selection was made from.
4. `boards/01-signature-family.png`: the owned family and its construction; `02`: the utility family.
5. `motion/`:
   - `M04-scrub-commit.mp4`: the finger, 1:1;
   - `M06-return-live.mp4`;
   - `M01-mic-mute-unmute.mp4`;
   - `M03-press-mute-route-end.mp4`;
   - and the `…-reduced-motion` counterparts.
6. `docs/P2_PRODUCT_PROOF_REPORT.md`: §J (the accepted selections) and §K (the refinement).

## Open it live

`prototype/index.html` opens from disk in Chrome and works offline. The panel beside the phone is the proof harness,
not Product UI.

| Harness parameter | Values | What it does |
|---|---|---|
| `?rail=` | `A` (accepted) · `B` · `C` | Call Rail variant (B, C: evidence) |
| `?spine=` | `C` (accepted) · `A` · `B` | Temporal Spine variant (A, B: evidence) |
| `?end=` | `24` · `26` · `27` (Product) · `28` | End Call glyph-size study (the same drawing re-rendered) |
| `?lang=en`, `?appearance=light`, `?rm=1`, `?w=320&h=568` | as G3.2 | device stand-ins |

**Try:**
- «تحليل المحادثة», then the call button → the Call Rail. Press Mute and the speaker.
- In the Analysis, pick «PINNED(14)» in the harness, then drag on the Timeline. The lighter opening stays under the
  finger. Release to commit, or press Escape while previewing from the keyboard.

## Package

| Path | What |
|---|---|
| `docs/P2_AUTHORITY_AND_SCOPE.md` | repository truth, authorities read, frozen boundaries kept, the refinement's scope |
| `docs/P2_REFERENCE_GATE.md` | research refreshed 2026-09-26 (libraries, licences, RN / Expo, platform guidance; the corrected Skia / Reanimated wording) and the Skill Gate |
| `docs/P2_ICON_INVENTORY_AND_OWNERSHIP.md` | every icon need, classified, and the audit of the old proof glyphs |
| `docs/P2_ICON_GEOMETRY_SPEC.md` | the measurable construction system |
| `docs/P2_UTILITY_LIBRARY_COMPARISON.md` | five libraries, scored, and the accepted source |
| `docs/P2_CALL_RAIL_PROOF.md` | the Call Rail: variants, the accepted A, proof points, the End Call presence study (§6) |
| `docs/P2_TEMPORAL_SPINE_APERTURE_PROOF.md` | the Spine: semantic compliance, variants, findings |
| `docs/P2_STATE_MOTION_ACCESSIBILITY.md` | state, motion and accessibility evidence, and the gaps |
| `docs/P2_IMPLEMENTATION_FEASIBILITY.md` | the production path, dependencies, Skia / Reanimated |
| `docs/P2_PRODUCT_PROOF_REPORT.md` | the report |
| `prototype/index.html` | the proof, built from `source/` |
| `source/` | build (`src/`), tools (`tools/`), vendored canon, tokens, fonts, utility glyphs + licences; `source/REGENERATE.md` |
| `boards/` | 16 review boards (each answers one question: `data/BOARDS.json`) |
| `motion/` | 10 clips, 30 fps (frame truth: `data/motion/`) |
| `captures/` | 13 key Product captures at 2×. All 87 are composed into the boards, and `data/SHOTS.json` holds every capture's measured geometry |
| `data/` | `CHECKS.json` (25 / 25, planted 9 / 9), `SHOTS.json`, `END_CALL_STUDY.json`, `NAV_MATERIAL.json`, `BOARDS.json`, `motion/` |
| `MANIFEST.json` | every file, with bytes and SHA-256 |

**Browser evidence only.** VoiceOver / TalkBack, device Reduce Motion, CallKit / Telecom and real touch latency are
implementation / device gates.
