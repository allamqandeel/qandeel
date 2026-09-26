# QANDEEL — P2-A Final Iconography: Integrated Visual Proof and Decision Gate

> **Status: `RECOMMENDED FOR PRODUCT OWNER REVIEW — VISUAL PROOF / DECISION GATE ONLY`.**
> **P2 is not closed and not frozen.** There is no Product Owner acceptance, and no production integration is authorised.
> A P2-B closure task may be prepared only after independent review and the Product Owner's explicit acceptance.

**Baseline:** `main` `209ca7269181e447f0c5192e49979aa391103871`.
**Branch:** `design/p2-final-iconography-integrated-visual-proof`.

## What to look at, in this order

1. `boards/05-call-rail-recommended.png` and `boards/07-temporal-spine-recommended.png`: the recommended machines in
   the real Product.
2. `boards/04-…` and `boards/06-…`: the three variants of each.
3. `boards/01-signature-family.png`: the owned family and its construction; `02`: the utility family.
4. `motion/`: `M04-scrub-commit.mp4` (the finger, 1:1), `M06-return-live.mp4`, `M01-mic-mute-unmute.mp4`, and their
   `…-reduced-motion` counterparts.
5. `docs/P2_PRODUCT_PROOF_REPORT.md`: the report and the **§J Product Owner decision gate**.

## Open it live

`prototype/index.html` opens from disk in Chrome and works offline. The panel beside the phone is the proof harness,
not Product UI.

| Harness parameter | Values | What it does |
|---|---|---|
| `?rail=` | `A` (recommended) · `B` · `C` | Call Rail variant |
| `?spine=` | `C` (recommended) · `A` · `B` | Temporal Spine variant |
| `?lang=en`, `?appearance=light`, `?rm=1`, `?w=320&h=568` | as G3.2 | device stand-ins |

**Try:**
- «تحليل المحادثة», then the call button → the Call Rail. Press Mute and the speaker.
- In the Analysis, pick «PINNED(14)» in the harness, then drag on the Timeline: the lighter opening stays under the
  finger. Release to commit, or press Escape while previewing from the keyboard.

## Package

| Path | What |
|---|---|
| `docs/P2_AUTHORITY_AND_SCOPE.md` | repository truth, authorities read, frozen boundaries kept, what is not done |
| `docs/P2_REFERENCE_GATE.md` | research refreshed 2026-09-26 (libraries, licences, RN / Expo, platform guidance) and the Skill Gate |
| `docs/P2_ICON_INVENTORY_AND_OWNERSHIP.md` | every icon need, classified, and the audit of the old proof glyphs |
| `docs/P2_ICON_GEOMETRY_SPEC.md` | the measurable construction system |
| `docs/P2_UTILITY_LIBRARY_COMPARISON.md` | five libraries, scored, and the recommendation |
| `docs/P2_CALL_RAIL_PROOF.md` | the Call Rail: variants, recommendation, proof points, craft concerns |
| `docs/P2_TEMPORAL_SPINE_APERTURE_PROOF.md` | the Spine: semantic compliance, variants, findings |
| `docs/P2_STATE_MOTION_ACCESSIBILITY.md` | state, motion and accessibility evidence, and the gaps |
| `docs/P2_IMPLEMENTATION_FEASIBILITY.md` | the production path, dependencies, Skia / Reanimated |
| `docs/P2_PRODUCT_PROOF_REPORT.md` | the report |
| `prototype/index.html` | the proof, built from `source/` |
| `source/` | build (`src/`), tools (`tools/`), vendored canon, tokens, fonts, utility glyphs + licences; `source/REGENERATE.md` |
| `boards/` | 15 review boards (each answers one question: `data/BOARDS.json`) |
| `motion/` | 10 clips, 30 fps (frame truth: `data/motion/`) |
| `captures/` | 11 key Product captures at 2× (all 63 are composed into the boards; `data/SHOTS.json` holds every capture's measured geometry) |
| `data/` | `CHECKS.json` (24 / 24, planted 8 / 8), `SHOTS.json`, `NAV_MATERIAL.json`, `BOARDS.json`, `motion/` |
| `MANIFEST.json` | every file, with bytes and SHA-256 |

**Browser evidence only.** VoiceOver / TalkBack, device Reduce Motion, CallKit / Telecom and real touch latency are
implementation / device gates.
