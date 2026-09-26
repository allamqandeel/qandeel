# P2-A — Icon Inventory and Ownership

**Status:** `P2-A EVIDENCE — PRODUCT OWNER VISUAL SELECTIONS ACCEPTED AFTER INDEPENDENT REVIEW — P2 NOT CLOSED / NOT
FROZEN`.

This inventory lists every icon or control need that the **frozen Product already has**, and classifies each one. It
adds no control. Where no authority has placed or named a control, the row says so rather than inventing it (task §7).

## Classes

- `SIGNATURE_CUSTOM`: drawn by QANDEEL on the P2 construction system (`src/sig.mjs`, `P2_ICON_GEOMETRY_SPEC.md`).
- `UTILITY_LIBRARY_CANDIDATE`: a mundane affordance, taken from the curated utility family (`src/utility.mjs`;
  `P2_UTILITY_LIBRARY_COMPARISON.md`).
- `SYSTEM/OS_OWNED`: drawn by the platform; QANDEEL must neither hide nor imitate it.
- `TEXT/NO_ICON_REQUIRED`: the canonical control is words, or it is not an icon.
- `UNRESOLVED_BY_EXISTING_PRODUCT_AUTHORITY`: a need that exists, but whose entry, placement or form no canonical record
  has settled. **No glyph is proposed.**

Direction column:
- `N` = never mirrored (media, call, world, identity marks);
- `M` = mirrors by meaning;
- `L` = the layout direction decides (logical start / end);
- `—` = no direction.

Material column:
- `Brass` = `qandeel.navigation.machinery`;
- `neutral` = rest ink `qandeel.control.functional` or primary ink.

## 1. Global navigation and shell

| Need | Class | Meaning | Dir | Material | States | Size | Name carried by | Source |
|---|---|---|---|---|---|---|---|---|
| «قنديل» / Qandeel (Personal) | `SIGNATURE_CUSTOM` `navMine` | one open world with its point of light | N | **Brass**, identical in every state | REST · selected (2-pt marker at the top edge + weight 600 on the word) · pressed (ground) · focus (perimeter) | 24 | the visible word, inside the button | I-08A4 Global Switcher; C3 §2A, §4 |
| «العالم المشترك» / Shared World | `SIGNATURE_CUSTOM` `navShared` | the same open world holding two points (two people, one world; not an intersection, CW-00) | N | Brass | as above | 24 | the word | G1.2 §3 (singular name); C3 §2A |
| «العالم العام» / Public World | `SIGNATURE_CUSTOM` `navPublic` | the same world, open on every side, people in its openings | N | Brass | as above | 24 | the word | I-08A4; C3 §2A |
| General Settings entry (one destination, P1) | glyph: `UTILITY_LIBRARY_CANDIDATE` (settings) · **entry: `UNRESOLVED_BY_EXISTING_PRODUCT_AUTHORITY`** | the one General Settings destination | — | neutral | — | 24 | its word | P1 §8 ("icons and copy stay open"); I-08A4 "secondary Global Shell utility". The shell entry's location is not placed by any record, so it is not drawn in the proof |
| QANDEEL Understanding «فهم قنديل» entry | `UNRESOLVED_BY_EXISTING_PRODUCT_AUTHORITY` | a depth inside Personal | — | — | — | — | — | P1 §10 (entry visual open). No rendered entry exists |
| Activity surface entry and badge | `UNRESOLVED_BY_EXISTING_PRODUCT_AUTHORITY` | one Activity surface (N-01-D28) and badges | — | a badge is a status mark: **never Brass** (C3 §2C) | — | — | — | I-08N-01 N-01-D28 freezes the surface, not its entry or placement |
| QANDEEL Q | outside P2: **brand** | identity mark | N (never mirrored) | Brass identity mark | — | 22 in-thread | aria-hidden | I-08B2.5. Its presence on every screen is C3 §8's open placement question, and P2 does not answer it |
| Status bar, home indicator, OS privacy indicators | `SYSTEM/OS_OWNED` | — | — | — | — | — | — | G1.2 §5; G3 amendment §4 |

## 2. Conversation, Voice Note, the Conversation line

| Need | Class | Meaning | Dir | Material | States | Size | Name | Source |
|---|---|---|---|---|---|---|---|---|
| «تحليل المحادثة» door | `SIGNATURE_CUSTOM` `depth` | into THIS conversation's world (the same open-world drawing, neutral) | N | neutral rest ink | REST · pressed · focus | 22 | the visible label (+ «— المكالمة مستمرة» during a call) | G1.1 §1; G1.2 §1 |
| «المحادثة» back (from the Analysis) | `UTILITY_LIBRARY_CANDIDATE` chevron | back to the Conversation | **M** | neutral primary | REST · pressed · focus | 22 | «المحادثة — رجوع» | G1.1 §1 |
| Send | `SIGNATURE_CUSTOM` `send` | send the committed turn | N (vertical on purpose) | neutral primary | shown only with text | 24 | «إرسال» | G1.1 R3 decision kept |
| Voice Note: record entry | `SIGNATURE_CUSTOM` `mic` | record a voice message | N | neutral rest | — | 24 | «رسالة صوتية» | G1.2 §1 |
| Voice Note: cancel | `UTILITY_LIBRARY_CANDIDATE` close | discard the recording | — | neutral rest | — | 24 | «إلغاء التسجيل» | G1.2 |
| Voice Note: send | `SIGNATURE_CUSTOM` `send` | send the note | N | neutral primary | — | 24 | «إرسال الرسالة الصوتية» | G1.2 |
| Voice message play / pause | `SIGNATURE_CUSTOM` `play` / `pause` (solid: media transport) | play a committed voice message | **N** (media) | neutral primary | toggles (aria label changes) | 20 | «تشغيل / إيقاف مؤقت» + duration | G1.2 §15 |
| Stop (recording) | `SIGNATURE_CUSTOM` `stop` | defined for completeness; **not rendered** by the frozen flow | N | — | — | — | — | G1.1 proof glyph set (evidence) |
| Call entry | `SIGNATURE_CUSTOM` `call` | start a Live Call (Analysis-first) | N | neutral rest | REST · pressed · focus | 24 | «مكالمة صوتية» | G1.2 §1 |

## 3. Live Call: the Call Rail

| Need | Class | Meaning | Dir | Material | States | Size | Name | Source |
|---|---|---|---|---|---|---|---|---|
| Mic / Muted | `SIGNATURE_CUSTOM` `muted` (one morphing drawing) | the microphone, and the microphone cut | **N** | neutral rest | toggle (aria-pressed); **form** = slash + negative-space cut | 24 | «كتم الميكروفون» / «تشغيل الميكروفون» (G1.2 R1 action label) | G1.2 §4, R1 |
| Audio route | `SIGNATURE_CUSTOM` `routeMorph` | loudspeaker vs earpiece | **N** | neutral rest | toggle; **form** = body fill + wave count | 24 | «السماعة الخارجية» | G1.2 §6 (route behaviour itself unfrozen) |
| End Call | `SIGNATURE_CUSTOM` `endCall` (the one solid mark) | end the call | **N** | neutral **primary** (no red: no grant, K04) | REST · pressed · focus | 24 | «إنهاء المكالمة» | G1.2; E1R |
| Rail art | `SIGNATURE_CUSTOM` (machine, not a glyph) | one group + a separated terminal | **L** (layout mirrors) | tertiary hairline | — | 44 × 48 per piece | aria-hidden | P2 §4.2 |
| Elapsed time | `TEXT/NO_ICON_REQUIRED` | call continuity | — (LTR digits island) | tertiary | — | 12 | through the one assistive live-status channel | G1.2 §4 |
| Normal-state call prose | `TEXT/NO_ICON_REQUIRED` → **none** | — | — | — | — | — | the one assistive channel | G1.2 §4 (no persistent prose) |
| Audio activity strip | **not drawn** | — | — | — | — | — | — | G1.2 §6 (unfrozen). P2 removes the proof's simulated level (no fake waveform, K05) |

## 4. The Analysis, the Timeline, Return, Replay

| Need | Class | Meaning | Dir | Material | States | Size | Name | Source |
|---|---|---|---|---|---|---|---|---|
| Replay | `SIGNATURE_CUSTOM` `replay` | replay this conversation (an action, not a place) | **N** (media) | neutral rest | REST · pressed · focus · expanded | 22 | «إعادة عرض المحادثة» | G1.1 §1 (placement) |
| Temporal Spine: spine, notches | `SIGNATURE_CUSTOM` (machine) | the disclosed Track, one notch per committed Moment | **L** (T-06 logical mirror) | tertiary | notch · targeted notch (primary) | 48 pt per Moment · 44-pt band | the slider's name + T-08 value text | T-05, T-06 |
| Aperture (committed) | `SIGNATURE_CUSTOM` | PINNED(t): time opened at Moment t | L | primary | resolve · settle (M2) · close in place | ≈ 34 × 16 pt | the slider value | T-06 M1–M4 |
| Aperture (preview) | `SIGNATURE_CUSTOM` | a temporary look, not a move | L | primary at 0.72, hairline | under the finger 1:1 | — | T-08 preview sentence | T-06 §preview |
| Live terminal | `SIGNATURE_CUSTOM` | the Live edge (never a Moment) | L | primary when engaged, rest when available | ENGAGED (following Live) · AVAILABLE (PINNED) | 44 × 44 slot | «العودة إلى المحادثة الجارية» when PINNED; the Live-slot name when following | T-05 outboard slot; T-06; T-12 (label never removed) |
| Discontinuity | `SIGNATURE_CUSTOM` (3 points) | the disclosed Track continues beyond the end edge | L | tertiary | — | — | "Disclosed Track continues" (T-05) | T-05 |
| OrientationChrome acts, «طرق العودة» | `TEXT/NO_ICON_REQUIRED` | Return acts | — | — | — | — | their labels | T-08: "There is no icon, arrow or chevron anywhere in the surface" |
| Temporal orientation line | `TEXT/NO_ICON_REQUIRED` | — | — | — | — | — | text, not a control | G3 T-11/T-12 amendment §5 |

## 5. Shared World, Public World, Introductions / Matching

| Need | Class | Source |
|---|---|---|
| Shared World header and composer (INTRODUCTION phase) | `TEXT/NO_ICON_REQUIRED` in the frozen proof: the name, the phase word, a text line | G2.3; G2 §D |
| Matching attention cue | the **Q** (brand) + words; `TEXT/NO_ICON_REQUIRED` | G2.3 (copy frozen); no glyph added |
| Private proposal: back | `UTILITY_LIBRARY_CANDIDATE` chevron (M) | G2.3 |
| Introduction image stages (P1 §14) | `UNRESOLVED_BY_EXISTING_PRODUCT_AUTHORITY` | the Introduction screen has no Product source yet (G3 §G; Connected Worlds `I-08`) |
| Public World surfaces | `UNRESOLVED_BY_EXISTING_PRODUCT_AUTHORITY` | there is no Public World Product screen in the frozen proofs |
| Permission / failure (microphone denied, connection failure) | `TEXT/NO_ICON_REQUIRED` | the explanatory wording is the carrier (G1.2 §4–§5). E1R's status silhouettes (circle-cross, triangle-bar) remain E1R's if a status glyph is ever placed |

## 6. The old proof glyphs, audited as evidence (task §8)

The source is `docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/src/glyphs.mjs`, which is G1.1 → G1.2 → G3.2
byte lineage. G1.2 §6 made these glyphs "PROOF ONLY — NOT A VISUAL FREEZE". The file was **not** edited; this package
carries its own copy under `source/src/glyphs.mjs` for the Q mark only.

| Aspect | Finding | P2 disposition |
|---|---|---|
| **Still useful** | world glyphs that "draw only what is true" (one ring, differing only in who is in it); an OFFSET point in the ring, so it never reads as a radio button; the vertical, non-directional SEND; the handset laid down as End; route ON/OFF as a change of shape; no waveform on voice messages | kept as **semantic ideas**; every drawing redrawn |
| **Generic / temporary** | the closed ring (any library's "record"); the standard handset path; the rotate-135° End; the chevron `back`; the stock play / pause | redrawn on the open-geometry system; `back` moved to the utility family |
| **Stroke and grid inconsistencies** | a single 1.75 stroke at every size (C3 §7.2 had recorded nav 1.75 @ 24 vs functional 1.6 @ 20 as mismatched ratios); no optical correction at 16–20 px | optical stroke per size: 1.60 / 1.75 / 1.95 u at 24 / 20 / 16 |
| **State techniques worth keeping** | route: filled vs outlined body; mute: a slash | kept and made **one morphing drawing each**. Mute's slash now also CUTS the drawing (negative space), so it is not just a line laid on top |
| **Must be redrawn** | all of them, including End (the G3.2 ring around it was a generic circle control, which task §4.2 excludes) | done (`src/sig.mjs`) |
| **Non-directional decisions** | SEND vertical, never mirrored; media never mirrored; `back` mirrored with `scaleX(-1)` | kept (K20) |
| **Shape-based speaker state** | ON = filled cone, OFF = outline cone, both with two waves | kept and strengthened: OFF keeps **one** wave, because sound still plays (no waves would read as "sound off") |
| **Fake waveform removal** | G1.2 removed the R3 seeded waveform from voice messages, but the call line still drew a **simulated microphone level** (`simLevel`, a seeded hash) | **removed from the Call Rail** (K05). A future level needs a real signal (`QAN-BL-VOICE-01`) and a Product decision |
