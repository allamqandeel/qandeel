# P4-C3 — Non-signal Voice visual specification (proposed for review)

**Status:** `PROPOSED FOR PRODUCT OWNER + INDEPENDENT REVIEW — NOT FROZEN`. This is the visual half P4-C2 §4 lets P4
close. The signal-bearing half — live waveform, levels, speaking / listening morphology and runtime state wording — stays
with `QAN-BL-VOICE-01`, and nothing here fakes it.

Every value below is taken from frozen tokens and P2 glyphs, or measured from the frozen shell. **No new colour, token,
glyph or Surface role** is introduced. Pixel values are reference craft for review. They are not new Product law.

## 1. The Voice Note turn (Conversation history)

**What is true without a runtime:** the reader recorded something. It has a stored length and, once played, a stored
position. Nothing else is shown.

| Part | Specification | Authority |
|---|---|---|
| Container | the reader's **UTTERANCE** slab, exactly as for a written turn: attached to the author's edge (Arabic right, English left), open toward it, rounded **only** on the inward corners (18 pt), `{qandeel.role.utterance.fill}` → the one functional Surface tone | G1.1 §1, §3 |
| Width | `min(100% − 40 pt, 292 pt)` — a fixed calm width; length is **not** encoded as width (length is a fact, width would read as a signal) | P4-C3 craft |
| Control | one 44 × 44 pt media control at the START of the slab: P2 `play` / `pause`, 24 px, primary ink, solid anchors, never mirrored | P2 §4, §10; G1.1 §3 ("its own media control") |
| Line | a 1 pt hairline in tertiary ink across the free width | P4-C3 craft |
| Heard part | the same line from START to the stored position, 2 pt, primary ink, round ends | P4-C3 craft |
| Position mark | a 2 × 12 pt primary tick at the stored position — present only once the note has been played | P4-C3 craft |
| Time | at rest: the total length in secondary ink; once played: the stored position in primary ink. `r-meta`, tabular, Western digits in both languages, an LTR island inside Arabic | T-08 numerals; T-12 §9 |
| Direction | the line runs START → END (right → left in Arabic), the logical direction QANDEEL's Timeline already uses | P2 §7, §10 |
| No words | no visible «رسالة صوتية» / "Voice message" (VI-01 V01, provisional); the group's accessible name carries it and its length | VI-01 V01; P4-C2 §5 |
| State channels | rest / paused / playing differ by **form** (weight, mark, glyph), never by colour alone | F1R2; E1R; C3 §2C |
| Not present | waveform, bars, levels, colour for speaker, Brass, transcript, a QANDEEL voice reply (P4-GAP-026) | P4-C2 §4; P2 §11.1 |

**Playing is stored state.** While a stored recording plays, the position advances with the file's own clock. That is
deterministic media state, not a live signal. Under Reduced Motion the position still updates, without easing, because it
is information.

## 2. The finished-call record (Conversation history)

| Part | Specification | Authority |
|---|---|---|
| Plane | a mark in the history's own plane, centred like the day line — **not** an UTTERANCE (a call belongs to both speakers), **no** Surface | G1.1 §3; B4 roles |
| Composition | 28 pt rule · P2 `call` glyph at 16 px · the word · Call Rail A's seam · the length · 28 pt rule; tertiary rules and glyph, secondary word and length, `r-meta` | P2 §6; machines.mjs |
| The seam | a 1 pt stroke leaning toward the END edge at Call Rail A's own slope (8 across 48 up), mirrored by layout direction: the call's machine, left at rest in the history | machines.mjs `railArt('A')` |
| Behaviour | non-interactive: no button, no focus stop, **no play** — no durable Personal call audio exists (`QAN-BL-VOICE-01`); no transcript | G1.2 §8; G1.1 §5 |
| Truth shown | that a call happened and how long it lasted, both fixture-owned facts. Ended state is implied by the record existing with a final length, and said aloud in the accessible summary | task §5.2 |
| Words | «مكالمة صوتية» / "Voice call" and the accessible summary are `RUNTIME_GATED` (VI-01 V02) | P4-C2 §5 |

## 3. Recording a Voice Note (the lower FIELD line)

| Part | Specification | Authority |
|---|---|---|
| Line | the 64 pt FIELD line, unchanged | G1.2 |
| START | P2 `mic` at 20 px in primary ink · the capture word · elapsed time (tabular, secondary) | G1.2 R1 keeps capture wording visible |
| Acts | cancel (Hugeicons-Free `close`, rest ink) at slot-i; send (P2 `send`, primary ink) at the END slot — the two acts G1.2 already has; no stop / review step is invented | G1.2; P2 §8 |
| Not present | the G3.2 level trace (superseded, P2 §11.1), bars, pulse, red, a recording dot | P2 §9, §11.1 |
| Words | «بسجّل» / "Recording" — `RUNTIME_GATED`, **PROOF ONLY / NOT COPY FREEZE** (VI-01 V04 warns that "Recording" may be false) | VI-01 V04 |
| Sent | the note joins the history as a Voice Note turn at rest; the line returns to idle | G1.2 (Conversation-first) |

## 4. The Live Call (non-signal composition)

| Part | Specification | Authority |
|---|---|---|
| Entry | the call starts from the Conversation's call control and opens **Analysis-first** | G1.1 §1; G1.2 §1 |
| Line | P2 **Call Rail A "Keyed Seam"** exactly as P2-A draws it: route + mic as one plate, End Call as the separated terminal at the END edge, End at 27 px in primary ink, mic and route at 24 px in rest ink; the 64 pt line; the elapsed time at START in tertiary ink, tabular | P2 §6 |
| In the Analysis | the line stands in G3.2's own call-line box, measured every frame from G3.2's layout; G3.2's pre-P2 circular End Call and simulated level trace are hidden and made inert at runtime (no G3.2 byte changes); the Analysis stays dark in both appearances | P2 §6, §11.1; G3 §C.1 |
| In the Conversation | the same line replaces the composer; the door's accessible name adds that the call continues | G1.2 §1 |
| Continuity | one call identity across Conversation ↔ Analysis; elapsed only increases; End adds one finished-call record of that length | G1.2 §1–§2 |
| State words | none visible in normal operation. Microphone on / muted go through **one** polite status channel; G3.2's own channel is made inert so nothing is announced twice | G1.2 §4 |
| Mute / route | by **form**: the slash cuts a band through the microphone; the speaker body empties and keeps one wave | P2 §6 |
| Not present | waveform, activity marks, speaking / listening indicators, "QANDEEL is speaking", "microphone is active", codec or provider names, a native call UI | G1.2 §4, §6; P2 §11.1 |

## 5. What stays open (not decided by this spec)

- Every Voice / call **string** (`RUNTIME_GATED`).
- Live signal visuals and a truthful Speaking Indicator (`QAN-BL-VOICE-01`; P2 §11.1).
- Missed / declined / failed call records, and connecting / reconnecting / failure presentations, which depend on runtime
  states.
- Voice Note transcripts (P4-GAP-024) and QANDEEL spoken replies (P4-GAP-026).
- Native call stack, CallKit / Telecom, Recents privacy, audio routes (G1.2 §7).
