# P2-A — Call Rail Proof

**Status:** `P2-A VISUAL PROOF — VARIANT A "KEYED SEAM" ACCEPTED BY THE PRODUCT OWNER AFTER INDEPENDENT REVIEW — P2 NOT
CLOSED / NOT FROZEN`. B and C are preserved as comparison evidence, not open alternatives. The End Call glyph is 27 px
since the P2-A refinement (§6).

**Boards:** 04 (the three variants), 05 (the accepted rail in the real Product), 11 (states), 12 (Light), 13
(320 × 568), 14 (390 / 430), 16 (End Call glyph presence).
**Clips:** `M01` / `M01r` (Mic ↔ Muted), `M02` (route), `M03` (press, then End Call).
**Source:** `source/src/machines.mjs` (the art), `source/src/sig.mjs` (the glyphs), `source/src/build.mjs` (layout).

## 1. What was inherited, unchanged

- **The call surfaces (G1.2 §1–§5).** The Live Call is Analysis-first, and the same call identity survives
  Conversation ↔ Analysis.
- **Call prose.** There is no persistent normal-state prose, and there is one assistive live-status channel.
- **Microphone permission** is requested at first need.
- **The G3 shell and composition.** The call line is 64 pt, inside the dark Analysis shell, and on the Conversation it
  follows the resolved appearance.

P2 changes the drawing and the arrangement of the controls inside that line, and nothing else. Heights are unchanged,
so G3.2's K14 world-floor evidence stands (check K17).

## 2. The machine (every variant)

- **Group and terminal.** Mic and the audio route are **one group**. End Call is a **separate terminal** at the END
  edge: left in Arabic, right in English.
  - Logical layout, in points from the END edge: End [12, 56] · Mic [78, 122] · Route [122, 166].
  - All targets are 44 × 44 pt.
- **Colour and weight.**
  - The rail art is a neutral tertiary hairline. There is no tone fill: B4R forbids a second Surface tone, and nesting
    adds no tonal step.
  - Mic and Route are drawn in **rest** ink. End is drawn in **primary** ink, and its glyph is the family's one solid
    call mark.
  - There is no red. E1R's error ink is retrospective ("something failed") and grants nothing to End Call. There is
    no Brass (C3 §2B, check K04).
  - There is no literal Q, and no circle.
- **Behaviour.**
  - **Mute.** One drawing morphs. The slash is drawn while a band of negative space cuts through the microphone
    (180 ms, T-10's curve).
  - **Route.** The loudspeaker body fills and the outer wave draws; the earpiece keeps one wave.
  - **Press.** E1R's ground wash from pointer-down.
  - **End Call.** The rail leaves with the call (G1.2).
- **Removed from the G3.2 line:** the ring around End Call (a generic circular control) and the **simulated microphone
  level** trace, which drew a seeded hash with no real signal behind it (check K05).

## 3. The three variants

| | A · Keyed seam (**accepted**) | B · Open tray (evidence only) | C · Break line (evidence only) |
|---|---|---|---|
| Group | one rounded contour, rounded on its start side; its end side is a slant | an open U-tray under Mic + Route | a baseline under the group, flicking up where it breaks |
| Terminal | the complementary slant, 7 pt away: one plate, keyed and broken | a tray that rises only on its outer side | its own short plinth under End |
| Break / seam | a parallel diagonal seam (the "cut", in the rail's scale) | a gap between two trays | the baseline's flick |
| Asymmetry | slant + outer rounding | the terminal rises on one side only | none beyond the break |
| Icon-to-ground | glyph 24 in a 48-pt-high piece (End: 27 since the refinement) | 24 in an open 48 | 24 over a line |
| Reads as | **one machine, broken on purpose; End clearly the end** | quiet, but the trays read as brackets | lowest profile, but "a row of icons" again, and End loses its terminal |

**Why A.**
- It is the only variant in which Mic + Route visibly form one object and End is visibly *the same object's end*,
  separated by the family's own opening grammar (the cut becomes the seam).
- End's hierarchy comes from position, separation, terminal form and its solid mark. At no point does it come from
  colour.
- It stays a low 48 pt within the 64-pt line, so the world and the temporal row are untouched.

## 4. Proof points (in the real Product)

| Requirement (task §13) | Evidence |
|---|---|
| Live Call, Analysis-first, FOLLOW_LIVE | board 05, `rec-call-live` |
| Live Call, Analysis, PINNED | boards 05 and 04, `rec-call-pinned` |
| Conversation surface during the call | boards 05, 04 and 12, `rec-conv-call`; the same rail |
| Arabic RTL / English LTR | boards 08 and 09 |
| 320 × 568 / 390 × 844 / 430 × 932 | boards 13 and 14 |
| Standard motion / Reduced Motion | `M01`–`M03` / `M01r` |
| Mic readable; mute readable without colour | board 05 crops; K21 (form); `M01` |
| Audio route readable | `rec-muted`: earpiece = outline body + one wave; speaker = solid body + two waves; `M02` |
| End Call hierarchy unmistakable | End sits alone beyond the seam at the end edge, in primary ink; the only solid mark; a 27-px handset that outweighs each neighbour in Dark and Light (board 16, H4); board 11 |
| No Brass misuse | K03, K04 (planted "Brass End Call" and "red End Call" both rejected) |
| No collision with the Conversation ↔ Analysis switch or the temporal floor | the switch lives in the upper chrome; the rail stays in the 64-pt call line; K17 heights unchanged |
| The compact form does not consume the world | the rail's footprint is 170 pt of width inside the existing line; the start side keeps the elapsed time |
| One family | the same stroke, terminals, cut and neutral ink as the Conversation line's glyphs (board 01) |

## 5. Craft concerns

1. **End glyph size: resolved by the P2-A refinement** (§6). **27 px** is selected.
2. **Seam angle.** 8 pt of slant across 48 pt. A steeper seam reads more "broken"; a shallower one reads more "one
   plate". The proof uses the middle value.
3. **Focus perimeter.** The perimeter meets the plate hairline (board 11). It remains distinguishable, since primary
   2 pt with a companion reads against a tertiary 1 pt, but a device review should confirm it at 3 pt under Increase
   Contrast.
4. **Activity expression: deferred by the Product Owner.** No "who is speaking" visual exists after the simulated trace
   was removed. Call truth remains in the controls, the elapsed time and the assistive channel (G1.2 §4). P2 has no
   canonical, truthful real-audio speaking signal, so none is designed or added here. The Speaking Indicator is
   deferred to the future Voice runtime (`QAN-BL-VOICE-01`; `P2_PRODUCT_PROOF_REPORT.md` §J).

## 6. P2-A refinement: End Call glyph presence (24 / 26 / 27 / 28 px)

**What changed.** Only the End handset's render size: `END_GLYPH_PX = 27` in `source/src/machines.mjs`.
- It is the same solid drawing on the same 24-unit grid, scaled. A solid mark has no stroke to re-weight.
- Nothing else changed: the rail art, the seam, the slots, the 44-pt targets, and the Mic and Route glyphs (24 px).
- The harness parameter `?end=24|26|27|28` re-renders the same drawing at a study size, for comparison only.

**How it was measured** (`source/tools/p2endstudy.mjs` → `data/END_CALL_STUDY.json`; board 16).
- 24 captures of the accepted rail: 4 sizes × Arabic Analysis, English Analysis, 320 × 568 PINNED, focus, press and
  Conversation under system Light.
- In each capture: the glyph's contrast-weighted ink (pt²), its ink box, and its clearance to the 44-pt target, for End
  and, as reference, for Mic and Route.
- The criteria were fixed before the numbers were read:

| | Criterion |
|---|---|
| H1 | the target, the terminal and group plates, and the Mic / Route glyph boxes are identical to the 24-px proof |
| H2 | End's ink keeps ≥ 8 pt clear inside its target, at rest, focused and pressed |
| H3 | End's weight is ≥ 1.10 × its 24-px weight |
| H4 | End weighs ≥ its heaviest neighbour and ≤ the two together (Arabic, English, Light) |
| H5 | End's ink width is ≤ 22 pt: not a hero |
| H6 | the End target's pixels are byte-identical in Arabic and English |
| H7 | the ink box under focus and press equals rest |

**Result** (the exact values are in `data/END_CALL_STUDY.json`).
- 24 px fails H3 by definition. It also fails **H4 under system Light**, where End is lighter than the speaker Route
  beside it: the concern the independent review raised, now measured.
- 26, 27 and 28 px meet all seven criteria.
  - At 26 px, the lead over the Light Route is the thinnest.
  - At 28 px, the handset reaches 20 pt wide.
- The task's rule is "27 unless the evidence gives a clear reason for 26 or 28". No such reason exists, so **27 px is
  selected**. Check K25 binds the built page to that selection, and the planted "34-px hero" is rejected.

**What it does not change.**
- Hit targets and spacing (H1).
- Focus and press semantics (H7): the E1R ground wash and the detached perimeter carry the state; the glyph does not.
- Direction (H6): never mirrored, at the END edge in both scripts.
- Colour: neutral primary ink, no red, no Brass (K03, K04).
- Motion: no new motion; M03 is re-rendered.
- 320 × 568: the target does not move, so no new collision is possible.
