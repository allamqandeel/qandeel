# P2-A — Temporal Spine + Aperture Proof

**Status:** `P2-A VISUAL PROOF — VARIANT C RECOMMENDED FOR PRODUCT OWNER REVIEW — NOT FROZEN`.

**Boards:** 06 (the three variants × four states), 07 (the recommendation through every state), 08 / 09 (RTL / LTR),
13 (320), 15 (geometry, targets, focus order, Reduced Motion).
**Clips:** `M04` / `M04r` (a real-pointer scrub, then commit), `M05` (preview → cancel), `M06` / `M06r` (Return Live),
`M07` (a new Moment while PINNED).
**Source:** `source/src/app.js` (the P2-A Temporal Spine block: `renderTimeline`, `drawSpine`, `drawTerminal`),
`source/src/machines.mjs`.

> The user is not moving a slider; the interface is **opening time at a moment**.

## 1. The semantic machine, consumed unchanged

| Frozen contract | Where it holds in the proof |
|---|---|
| `TM` is exactly `FOLLOW_LIVE` or `PINNED(t)`; a preview is a separate, lossless PTC (T-06) | the runtime state machine is G3.2's, untouched; the truth logs in `data/motion/*.truth.json` |
| Moment(LH) is not the Live Edge; committing it gives `PINNED(LH)` (T-06, T-08) | `rec-pinnedLH`: the aperture opens on SP17 while the terminal stays AVAILABLE and Return Live is offered (K10) |
| Scrubbing, or previewing the newest Moment, never means "go live" | the preview mark never reaches the terminal; the terminal is outside the Track (K10) |
| Return Live has one home, at the Live edge (G3 amendment §2.5) | the terminal and «العودة إلى المحادثة الجارية» in T-05's outboard slot; not repeated in «طرق العودة» |
| **48 RN layout px per committed Moment** (T-05) | measured in every Analysis capture: every adjacent pair is exactly 48.00 pt apart (K06). G3.2's proof drew 16 pt; restored |
| **The 44-pt interaction / accessibility rail** (T-05) | the Track band is 44 pt high at every size (K07); the visible spine is a 1-pt hairline inside it |
| The finger is followed 1:1, with no easing (T-06, T-10 M0) | `M04` / `M04r`: max \|finger − preview aperture\| = **0.04 pt** over 57 held frames (K11) |
| Commit only on a completed act; release retargets (M1, 140 ms) and settles once (M2, +9 % scaleY) | `M04`: released 15 pt off-centre; on its Moment within 140 ms; one settle (K12) |
| Cancel is lossless (M3, 240 ms) | `M05`: the stance never changes; the preview returns and fades (K15) |
| The window offset is never animated; the Track is SP1-anchored | the window jumps (never glides) only to keep a target in view; PINNED holds still while Moments arrive (`M07`, K16) |
| No ghost, trail or interpolated historical state; no repeating Live pulse | apertures appear and close **in place**; nothing travels between historical Moments; a 10-s still state is constant (K13, K14) |
| The temporal line sits above the Timeline when truthful context exists (G3 amendment) | unchanged G3.2 composition; the line is T-08's words |
| Reduced Motion keeps the truth and removes movement | `M04r`, `M06r`: 0-ms retarget, no settle, the aperture is cut; opacity resolves stay 140 ms (K12, K14, K22) |
| RTL is a logical mirror, not naïve flipping (T-06) | SP1 at the START edge (right in Arabic), Live at the END (K20) |
| No fake waveform | the spine draws only disclosed Moments; no variation encodes importance, emotion, confidence or energy |

## 2. The visual vocabulary

- **Spine.** A 1-pt tertiary hairline running from the start edge to the newest disclosed Moment.
- **Notch.** One per disclosed Moment, 1 × 6 pt, tertiary. The previewed Moment's notch is primary and 12 pt tall: it
  says *which* Moment, not how important it is.
- **Aperture (committed).** The spine OPENS at the committed Moment, in primary ink.
- **Aperture (preview).** The same opening drawn lighter: a 1-pt line at 0.72 (T-06 M4). It is never at committed
  weight and has no core.
- **Terminal.** The Live edge's own form in the outboard slot:
  - **ENGAGED** while following Live;
  - **AVAILABLE** while PINNED, with Return Live's label, which is never icon-only (T-12).
- **Discontinuity.** Three small points at the end edge when the newest Moment is outside the window (T-05).

## 3. The three variants (board 06)

| | A · Lens | B · Gate | **C · Parting (recommended)** |
|---|---|---|---|
| Aperture | the spine breaks; a floating lens holds the Moment; committed = lens + core | the spine breaks and turns into two lips; committed = heavier lips + core | the spine **itself** parts around the Moment and rejoins; committed = the Moment's mark inside the opening |
| Preview | a lighter lens | hairline lips | a lighter parting, no mark |
| Live terminal | stop bar + disc (solid when engaged) | lip + rounded square | **stop bar + the present as its own short line** (heavy when engaged, hairline when available) |
| Reading | the lens-with-core reads as the familiar **"eye / visibility" icon**, a semantic collision | clear, but reads as a text-selection bracket | "opening time": the line opens, with no borrowed meaning |
| Generic-thumb risk | medium (a floating object) | low | **lowest**: nothing floats; the mark is part of the line |
| Terminal ≠ Moment | yes | yes (lips vs a lip) | **strongest**: no curve and no core, so it shares no form with the parting |

**Why C.**
- It is the only variant in which the committed position is **part of time's line**, not an object placed on it.
- The preview is a lighter version of the same opening.
- The Live edge is categorically different: a line that continues past a stop, not an opening.

## 4. Findings made by building it

- **F-P2-01. The Track was truncated at the pinned Moment.** The G3.2 proof drew only SP1…SP(t) while PINNED
  (`disclosedCount() = tc`). T-05 / T-06 keep SP1…SP(LH) disclosed, and scrubbing forward to SP(LH) is allowed while
  PINNED. P2's proof renders the full disclosed Track. This is a correction of the proof harness toward the frozen
  contract; no semantic changes.
- **F-P2-02. The Live act's box covered the Track's end.** G3.2's Return Live box (≈ 169 × 60 pt, label + slot) lay
  over the last Moments, so a press there reached Return Live, not the Timeline. At the canonical 48-pt pitch that is
  SP15–SP17 at 390 pt.
  - P2 narrows only the act's **hit region** to its label and its 50 × 60-pt outboard column. The box, label and focus
    ring are unchanged, and the target is still ≥ 44.
  - Every visible Moment is now hit-tested onto the Track (K09).
  - This is a composition-level item for the future T-11 / T-12 implementation, which the Product Owner may want
    recorded.
- **F-P2-03. The floating Moment number.** The G3.2 proof's number above the cursor collides with the Live label at
  the canonical pitch. It only repeated the T-08 line, so P2 does not draw it; the value stays in the slider's
  accessible value and in the line.
- **F-P2-04. The narrowest width.** At 320 pt the 48-pt pitch shows 5 Moments. Older Moments stay reachable by the
  window, and by keyboard, typing or the T-06 navigator. This is T-05's intended "narrow widths show fewer steps", now
  visible for the first time.

## 5. What is not frozen and not decided here

- The exact aperture dimensions (34 × 16 pt), the notch length, the terminal line length and the discontinuity mark are
  craft values. The 48-pt / 44-pt geometry is T-05's and unchanged.
- Colour and material stay neutral. The Timeline is not Brass, because it is functional machinery, not the persistent
  navigation family.
