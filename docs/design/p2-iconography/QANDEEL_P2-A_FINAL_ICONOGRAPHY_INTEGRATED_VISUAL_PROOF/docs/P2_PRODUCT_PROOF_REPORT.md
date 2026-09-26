# P2-A — Product Proof Report

**Status:** `PRODUCT OWNER VISUAL SELECTIONS ACCEPTED AFTER INDEPENDENT REVIEW — P2 NOT CLOSED / NOT FROZEN`.

**Product Owner visual selections accepted after independent review; P2 remains not closed/frozen until the later P2-B
canonical closure task.**

| | State |
|---|---|
| Strategy and visual selection | **accepted** by the Product Owner (§J) |
| Canonical P2 lifecycle closure | **not performed**. It belongs to the later P2-B task. No canonical record, backlog item or locator is changed by P2-A |
| Production integration | **not authorised** by P2-A |

The P2-A refinement (§K) records the accepted selections, polishes the End Call glyph's presence inside the accepted
Call Rail, and corrects the Skia / Reanimated wording. It opens no new alternative.

## A. What exists now

A complete, integrated visual candidate for QANDEEL's final iconography, proved inside the **real** accepted Product.
The harness is a fork of the reviewed G3.2 Product proof: its world, Conversation, Live Call, Timeline, PINNED states,
appearances and sizes. It consists of:
- **the signature family:** 15 glyphs on one measured construction system, plus two machines, the Call Rail and the
  Temporal Spine + Aperture;
- **a curated utility-family recommendation;**
- **evidence:** 16 boards, 10 motion clips, 25 checks with 9 planted defects, and a manifest.

## B. The system

- **Layer A: the signature family** (`P2_ICON_GEOMETRY_SPEC.md`).
  - *Language.* Open Geometry, with one QANDEEL cut at 45°: the canonical Q's opening, used as a grammar, never the Q
    itself. Round terminals and an optical stroke (1.60 / 1.75 / 1.95 u at 24 / 20 / 16). Solid anchors only for a
    world's light, the media transport, a toggle's ON body and the terminal act.
  - *Navigation.* Three world glyphs in **Living Brass**, byte-identical in every state (K18). State is carried by
    E1R's marker and weight on the word.
  - *Functional glyphs.* Neutral everywhere.
- **Layer B: the utility family.** Accepted: **Hugeicons Free (Stroke Rounded)** as the preferred curated
  **source / reference** for mundane utility glyphs. No runtime icon package is adopted, no Pro or paid asset is used,
  and no dependency changes. Lucide remains the benchmark (`P2_UTILITY_LIBRARY_COMPARISON.md`).
- **Layer C: motion.** Calm State Morphing:
  - Mic ↔ Muted draws the slash and cuts the microphone together;
  - the speaker route fills and draws its wave;
  - the Aperture is under the finger 1:1, settles once, and closes in place;
  - there is no bounce, loop or pulse (`P2_STATE_MOTION_ACCESSIBILITY.md` §3).

## C. Call Rail: variant A "Keyed seam", accepted

| Variant | Verdict |
|---|---|
| **A · Keyed seam — accepted** | Mic + Route are one plate. End is the same plate's end, cut away on a parallel slant: the family's cut, at rail scale. End's rank = position, separation, terminal form, the one solid mark in primary ink, and (since the refinement) a **27-px** handset. No red, no Brass, no circle, no Q |
| B · Open tray | comparison evidence only: calmer, but the trays read as brackets |
| C · Break line | comparison evidence only: lowest profile, but it becomes "a row of icons" and End loses its terminal |

The details are in `P2_CALL_RAIL_PROOF.md`. The End glyph size is now resolved (27 px, §K and board 16). The seam
angle and the focus perimeter against the plate at Increase Contrast remain implementation craft checks, not Product
decisions.

## D. Temporal Spine + Aperture: variant C "Parting", accepted

| Variant | Verdict |
|---|---|
| A · Lens | comparison evidence only: reads as the generic "eye / visibility" icon |
| B · Gate | comparison evidence only: clear, but reads as a text-selection bracket |
| **C · Parting — accepted** | the spine **itself** opens around the Moment. The preview is a lighter opening. The Live terminal is a stop and a separate present-line that shares no form with a Moment |

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
- **Skia / Reanimated.** The repository currently declares Skia 2.6.2 and Reanimated 4.5.1. Their exact integration
  pairing is not certified by P2-A and was not device-validated here. P2-A does not rely on Skia. The recommended
  implementation path remains static / vector SVG rendering plus Reanimated where appropriate, subject to a future
  implementation task and device verification. Nothing is upgraded (`P2_IMPLEMENTATION_FEASIBILITY.md` §4).

## H. Evidence

- boards `01`–`16` (`data/BOARDS.json`: each board's question); board 16 is the End Call presence study;
- clips `M01`–`M07` + `M01r` / `M04r` / `M06r` (`data/motion/*.truth.json`);
- `data/SHOTS.json`: 87 Product captures with their measured geometry and truth (63 + the 24 End Call study
  captures);
- `data/END_CALL_STUDY.json`: the End Call presence measurement and its criteria;
- `data/NAV_MATERIAL.json`;
- `data/CHECKS.json`: 25 / 25, planted 9 / 9;
- `MANIFEST.json`: every file, with bytes and SHA-256.

## I. Skills

| Skill | Why used | Concrete effect |
|---|---|---|
| `fixing-accessibility` | icon-only controls, names, focus, state | every glyph is `aria-hidden` and every control named (K19, planted defect rejected); state is never colour alone (K21); the Live act's hit region was narrowed without removing its focus ring (F-P2-02) |
| `designing-arabic-frontends` | direction and mirroring | "mirror by meaning": only the chevron mirrors; media / call / world glyphs never do (K20, planted "mirrored mic" rejected); logical `inset-inline` layout; start / end wording throughout; no letter-spacing on Arabic |
| `animate-expo` | motion and its RN path | the "should it animate?" gate (the rail switch does not animate; toggles 180 ms); finger work stays 1:1 on the UI thread; Reduced Motion ships with every clip; feasibility maps the morphs to Reanimated animated props and does not rely on Skia |
| `apple-design` | direct manipulation, symmetric paths | the aperture is drawn at the finger (≤ 0.04 pt, K11); cancel returns the way it came, and Return Live closes in place instead of travelling (K14) |
| `ui-ux-pro-max` | icon QA checklist (its `quick-reference.md`; its script needs Python, which this host lacks) | one family, one stroke, SVG only, 44-pt targets, reduced motion. Its generic "brand colour for primary actions" rule was rejected in favour of C3 (End Call is not Brass) |
| `writing-eloquent-arabic` | a guard | no Arabic copy written or changed; every Product string is existing canon or G3.2 copy |

## J. Product Owner decision gate: the accepted selections

After independent review, the Product Owner accepted these visual selections. They are recorded here, not reopened.
The other variants' evidence is preserved as comparison evidence only.

| # | Decision | Accepted selection | Evidence |
|---|---|---|---|
| 1 | Call Rail | **A "Keyed seam"**. B and C are comparison evidence only. The End glyph polish is §K | boards 04, 05, 16 |
| 2 | Temporal Spine + Aperture | **C "Parting"**. A and B are comparison evidence only | boards 06, 07 |
| 3 | Navigation rail | the QANDEEL navigation glyph **above** the destination word, with the frozen Living Brass material rules unchanged. Not words-only | board 03 |
| 4 | Drawing nuance | **N1 "Open"**: round terminals, the Open Geometry direction. N2 is comparison evidence only | board 01 |
| 5 | Utility family | **Hugeicons Free** as the preferred curated source / reference for mundane utility glyphs. No runtime package adoption, no Pro or paid asset path, no dependency change | board 02 |
| 6 | Speaking indicator | **deferred** to the future Voice runtime. P2 has no canonical, truthful real-audio speaking signal, so no waveform, activity or speaking state is designed or added | — |

The strategy (hybrid system, Call Rail, Spine + Aperture, Open Geometry, Calm Morphing, a small owned family) is
**not** reopened.

**What acceptance does not do.** The strategy and the visual selection are accepted. The canonical P2 lifecycle
closure has **not** been performed: P2 is not closed and not frozen, and that closure belongs to the later P2-B task.

## K. P2-A refinement (2026-09-26)

**Refinement 01: End Call glyph presence.** The accepted Rail A is not redesigned; only the End handset's render size
changed.
- Studied at 24 (the reviewed proof), 26, 27 and 28 px in the real rail: Arabic and English Analysis, 320 × 568,
  focus, press and system Light. Evidence: board 16 and `data/END_CALL_STUDY.json`.
- The seven criteria (H1–H7) were written before the numbers were read:
  - H1: the geometry is unchanged;
  - H2: ≥ 8 pt clear inside the target;
  - H3: ≥ 1.10 × the 24-px weight;
  - H4: at least as heavy as the heaviest neighbour, and no heavier than the group;
  - H5: ≤ 22 pt wide;
  - H6: pixels identical in AR and EN;
  - H7: the ink is unchanged under focus and press.
- The measurement confirmed the review's concern. At 24 px under system Light, the End handset's contrast-weighted ink
  is **lighter than the speaker Route beside it**.
- 26, 27 and 28 px all meet every criterion, so no measurement gives a clear reason to depart from the default.
  **27 px is selected** (`END_GLYPH_PX`, check K25):
  - At 26 px the lead over the Light Route is the thinnest.
  - At 28 px the handset is the widest.
  - 27 px leads the Light Route clearly, keeps ≥ 12 pt clear inside the target, and stays well under the group's
    weight.
- Mic, Route, the plate, the seam, the slots and the targets are unchanged (H1).

**Refinement 02: this decision record.** §J now records the accepted selections, and the status separates acceptance
from closure.

**Refinement 03: the Skia / Reanimated wording** (§G; `P2_REFERENCE_GATE.md` §2; `P2_IMPLEMENTATION_FEASIBILITY.md`
§4). The earlier text inferred that the pairing was fine from the declared peer ranges. That was too strong. React
Native Skia's own documentation is version-dependent:
- the Animations page: "Starting version `2.10` and above, this integration requires Reanimated v4 or above. For lower
  version numbers, you can use Reanimated v3";
- the Installation page: current native Skia with Reanimated requires `react-native-reanimated@>=4.0.0` with
  `react-native-worklets@>=0.7.0`.

P2-A therefore certifies nothing about the exact 2.6.2 + 4.5.1 pairing. No dependency was changed.

**Skills that affected the refinement.**

| Skill | Concrete effect on this refinement |
|---|---|
| `animate-expo` | §7 "44×44pt minimum … don't grow the visual": the glyph grew inside a target that did not (H1; End stays 44 × 44 at the same slot). No motion was added: End has no size change on press, and its press stays E1R's ground wash (H7). M03 was re-rendered and still decodes to its exact frame count (K23) |
| `fixing-accessibility` | §1 "decorative icons must be aria-hidden": the resized glyph stays `aria-hidden` and the button keeps its name (K19). §7 focus: the 2-pt perimeter still frames the glyph with ≥ 12 pt clear, and the focus / press captures leave the ink box unchanged (H2, H7) |
| `designing-arabic-frontends` | §6 "never mirror … media playback": the End target's pixels are byte-identical in Arabic and English at every size (H6). The End Call terminal stays at the END edge in both directions (board 16) |
| `apple-design` | §16 simplicity, "use hierarchy — order, spacing, contrast": End's rank is taken from optical size inside the existing hierarchy, not from a new colour or ornament. This shaped criteria H3–H5: stronger than 24 px, never outweighing the group, never a hero |
