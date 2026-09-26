# P2-A — Product Proof Report

**Status:** `RECOMMENDED FOR PRODUCT OWNER REVIEW` — P2 is **not** closed and **not** frozen. There has been no Product
Owner acceptance. A later P2-B closure task may be prepared only after independent review and the Product Owner's
explicit acceptance (task §0, §22).

## A. What exists now

A complete, integrated visual candidate for QANDEEL's final iconography, proved inside the **real** accepted Product.
The harness is a fork of the reviewed G3.2 Product proof: its world, Conversation, Live Call, Timeline, PINNED states,
appearances and sizes. It consists of:
- **the signature family:** 15 glyphs on one measured construction system, plus two machines, the Call Rail and the
  Temporal Spine + Aperture;
- **a curated utility-family recommendation;**
- **evidence:** 15 boards, 10 motion clips, 24 checks with 8 planted defects, and a manifest.

## B. The system

- **Layer A: the signature family** (`P2_ICON_GEOMETRY_SPEC.md`).
  - *Language.* Open Geometry, with one QANDEEL cut at 45°: the canonical Q's opening, used as a grammar, never the Q
    itself. Round terminals and an optical stroke (1.60 / 1.75 / 1.95 u at 24 / 20 / 16). Solid anchors only for a
    world's light, the media transport, a toggle's ON body and the terminal act.
  - *Navigation.* Three world glyphs in **Living Brass**, byte-identical in every state (K18). State is carried by
    E1R's marker and weight on the word.
  - *Functional glyphs.* Neutral everywhere.
- **Layer B: the utility family.** The recommendation is **Hugeicons Free (Stroke Rounded)** drawings, vendored as a
  curated subset with no runtime icon package; Lucide is the benchmark (`P2_UTILITY_LIBRARY_COMPARISON.md`).
- **Layer C: motion.** Calm State Morphing:
  - Mic ↔ Muted draws the slash and cuts the microphone together;
  - the speaker route fills and draws its wave;
  - the Aperture is under the finger 1:1, settles once, and closes in place;
  - there is no bounce, loop or pulse (`P2_STATE_MOTION_ACCESSIBILITY.md` §3).

## C. Call Rail: variant A "Keyed seam", recommended

| Variant | Verdict |
|---|---|
| **A · Keyed seam** | Mic + Route are one plate. End is the same plate's end, cut away on a parallel slant: the family's cut, at rail scale. End's rank = position, separation, terminal form and the one solid mark, in primary ink. No red, no Brass, no circle, no Q |
| B · Open tray | calmer, but the trays read as brackets |
| C · Break line | lowest profile, but it becomes "a row of icons" and End loses its terminal |

The details are in `P2_CALL_RAIL_PROOF.md`. Its unresolved craft concerns are End's glyph size (24 vs 26–28 px), the
seam angle, and the focus perimeter against the plate at Increase Contrast.

## D. Temporal Spine + Aperture: variant C "Parting", recommended

| Variant | Verdict |
|---|---|
| A · Lens | reads as the generic "eye / visibility" icon |
| B · Gate | clear, but reads as a text-selection bracket |
| **C · Parting** | the spine **itself** opens around the Moment. The preview is a lighter opening. The Live terminal is a stop and a separate present-line that shares no form with a Moment |

The semantic proof, every row measured, is in `P2_TEMPORAL_SPINE_APERTURE_PROOF.md` §1:
- 48.00 pt per Moment in every capture;
- a 44-pt band;
- ≤ 0.04 pt finger-to-aperture error;
- retarget ≤ 140 ms plus one settle; Reduced Motion 0 ms with no settle;
- Return Live closes in place;
- nothing oscillates in a 10-s still state;
- PINNED(LH) is visibly not Live;
- SP1 at the START edge.

## E. Findings made by building it

| # | Finding | Disposition |
|---|---|---|
| F-P2-01 | The G3.2 proof truncated the Track at the pinned Moment; T-05 / T-06 keep SP1…SP(LH) | corrected in the P2 harness. No semantic change |
| F-P2-02 | The Live act's box covered the Track's last Moments (SP15–17 at 390 pt at the canonical pitch), so a press there hit Return Live | the hit region was narrowed to the label and its outboard column; the box, label and focus ring are unchanged (K09). **A composition item for the T-11 / T-12 implementation** |
| F-P2-03 | The floating Moment number collides with the Live label at 48-pt pitch | not drawn; the T-08 line and the accessible value carry it |
| F-P2-04 | At 320 pt, the canonical 48-pt pitch shows 5 Moments | intended by T-05, and visible for the first time. Older Moments are reachable by the window, the keyboard and the navigator |
| F-P2-05 | The G1.2 / G3.2 call line drew a **simulated** microphone level | removed (K05) |
| F-P2-06 | The G3.2 rail press wash painted over the Brass glyph | the wash now lies under the content; Brass is unchanged under press (K18) |
| F-P2-07 | The first Shared / Public drawings read as faces | redrawn: diagonal points; a porous ring |

No finding contradicts a frozen Product authority. F-P2-02 is a composition defect of the proof harnesses, found by the
canonical geometry itself.

## F. Accessibility, RTL, Reduced Motion

Proved (browser evidence):
- 44-pt targets everywhere;
- named controls with decorative glyphs;
- focus order = visual order;
- the E1R perimeter;
- non-colour state;
- direction by meaning (only the chevron and the layout mirror);
- Reduced Motion with the same truth;
- dark / light with frozen tokens only;
- every Moment reachable.

Not proved here: device assistive technology, device Reduce Motion or Increase Contrast, real touch latency, and large
text at 320 pt. These are implementation / device gates (`P2_STATE_MOTION_ACCESSIBILITY.md` §4).

## G. Production feasibility

- **The path:** a generated static path registry → `react-native-svg` + Reanimated animated props; the spine drawn per
  T-05 item plus an aperture overlay; the utility subset vendored.
- **One dependency a future task must approve:** `react-native-svg`, Expo 57's 15.15.4.
- **Skia is not needed.** The 2.6.2 ↔ Reanimated 4.5.1 integration is declared-compatible but unverified on a device,
  so nothing depends on it, and nothing is upgraded (`P2_IMPLEMENTATION_FEASIBILITY.md`).

## H. Evidence

- boards `01`–`15` (`data/BOARDS.json`: each board's question);
- clips `M01`–`M07` + `M01r` / `M04r` / `M06r` (`data/motion/*.truth.json`);
- `data/SHOTS.json`: 63 Product captures with their measured geometry and truth;
- `data/NAV_MATERIAL.json`;
- `data/CHECKS.json`: 24 / 24, planted 8 / 8;
- `MANIFEST.json`: every file, with bytes and SHA-256.

## I. Skills

| Skill | Why used | Concrete effect |
|---|---|---|
| `fixing-accessibility` | icon-only controls, names, focus, state | every glyph is `aria-hidden` and every control named (K19, planted defect rejected); state is never colour alone (K21); the Live act's hit region was narrowed without removing its focus ring (F-P2-02) |
| `designing-arabic-frontends` | direction and mirroring | "mirror by meaning": only the chevron mirrors; media / call / world glyphs never do (K20, planted "mirrored mic" rejected); logical `inset-inline` layout; start / end wording throughout; no letter-spacing on Arabic |
| `animate-expo` | motion and its RN path | the "should it animate?" gate (the rail switch does not animate; toggles 180 ms); finger work stays 1:1 on the UI thread; Reduced Motion ships with every clip; feasibility maps the morphs to Reanimated animated props and rejects Skia as unnecessary |
| `apple-design` | direct manipulation, symmetric paths | the aperture is drawn at the finger (≤ 0.04 pt, K11); cancel returns the way it came, and Return Live closes in place instead of travelling (K14) |
| `ui-ux-pro-max` | icon QA checklist (its `quick-reference.md`; its script needs Python, which this host lacks) | one family, one stroke, SVG only, 44-pt targets, reduced motion. Its generic "brand colour for primary actions" rule was rejected in favour of C3 (End Call is not Brass) |
| `writing-eloquent-arabic` | a guard | no Arabic copy written or changed; every Product string is existing canon or G3.2 copy |

## J. Product Owner decision gate: the few decisions that genuinely remain

1. **The Call Rail:** A "Keyed seam" (recommended), B or C (board 04). In A, a 24-px or a slightly larger End glyph.
2. **The Temporal Aperture:** C "Parting" (recommended), A or B (board 06).
3. **The navigation rail:** Brass glyph **above** the word (recommended; the words stay the names), or keep G1.1's
   words-only Brass rail. C3 permits both, and the glyphs are proved state-invariant either way (board 03).
4. **The drawing nuance:** N1 "Open" (round terminals, 50° cut; recommended) or N2 "Architectural" (flat terminals at
   the cut, 34°) (board 01).
5. **The utility family's character:** Hugeicons-sourced (matches the family; recommended) or Lucide (more anonymous)
   (board 02).
6. **A speaking / activity expression in the Call Rail.** The proof's simulated level was removed and none exists now.
   Whether a real, signal-driven expression should exist later is a Product decision. Its signal is future Voice work
   (`QAN-BL-VOICE-01`).

The strategy (hybrid system, Call Rail, Spine + Aperture, Open Geometry, Calm Morphing, a small owned family) is
**not** reopened.
