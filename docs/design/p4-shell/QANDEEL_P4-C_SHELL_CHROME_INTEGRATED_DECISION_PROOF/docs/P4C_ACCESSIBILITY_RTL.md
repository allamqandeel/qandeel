# P4-C — Accessibility, RTL and Bidi

**Status:** browser evidence for candidates under study. VoiceOver / TalkBack, device Dynamic Type, Bold Text, Reduce
Motion and Increase Contrast, and touch latency are **device / implementation gates** (G1.2 §7; P2 §14; P3 §18). Nothing
here certifies a device.

P4-C applies existing authority — E1R, F1R2, P2 §10, P3 §16 and the `designing-arabic-frontends` rules — and creates
no competing accessibility or direction contract.

## 1. What every candidate keeps (checked)

| Obligation | How the proof keeps it | Check |
|---|---|---|
| 44 pt minimum target | every entry, switcher item and «سياق الكلام» action is a ≥ 44 × 44 pt box; a glyph never grows to meet its target | `C-TGT-1` (planted `smalltarget` rejected) |
| Truthful names | icon-only entries carry their Product word: «النشاط، فيه جديد» / "Activity, new items", «الإعدادات» / "Settings"; text controls are named by their words | `C-NAME-1` (planted `settingsname` rejected) |
| Decorative glyphs hidden | the nav glyphs, Open Ledger, the gear, the depth chevron and every Q are `aria-hidden`; the word names the control | `C-NAV-6`, `C-Q-2` |
| State without colour | SELECTED = the E1R marker + a heavier word; PRESSED = the ground wash under the content; FOCUS = the detached perimeter with its world-colour companion; Living Brass identical at every state | `C-NAV-4`, `C-NAV-5` (planted `brasssel`, `nosel` rejected) |
| Focus order = visual order | the DOM is rendered top → bottom, START → END: the upper chrome, then the Personal row, then the conversation, the composer and the switcher | `C-FOCUS-1` (DOM order against geometry) and `C-FOCUS-2` (a **real Tab walk** from the page start, AR and EN). Board 10's focus captures use keyboard modality with programmatic focus on a chosen control; they show the ring, the Tab walk proves the order |
| Increased Contrast | the F1 dark-increased and F2 light-increased token transforms, unchanged (no new value) | captures `*-hc-*`, boards 05 and 10 |
| No new colour | every paint resolves through `tokens.mjs` from the frozen tree; the build refuses a literal that disagrees | build guard; `C-PROV-1` |
| Forced colours | the E1R ring is a box-shadow, which forced-colours modes drop, so the focused control also carries a transparent 2 pt outline that such modes paint (no pixel changes otherwise) | build CSS |
| No hidden second navigation | in the Analysis the candidate switcher stands in G3.2's rail box; G3.2's own (pre-P2) rail underneath is made `inert` at runtime (no G3.2 byte changes), so it is neither focusable nor announced | `C-FOCUS-3` |

## 2. Direction by meaning

| Element | Arabic (RTL) | English (LTR) | Rule |
|---|---|---|---|
| Activity entry | START = the right edge | START = the left edge | P3 §3 / §16 — never mirrored |
| Settings under S-A | beside Activity, inward | beside Activity, inward | the START utility group |
| Personal row (U-A / S-B) | «فهم قنديل» at START, the gear at END | the same by meaning | logical placement, `C-DIR-2` |
| Depth chevron after «فهم قنديل» | mirrored (points left = forward) | not mirrored | a chevron is directional — `designing-arabic-frontends` §6 |
| «تحليل المحادثة» + Replay | the END group | the END group | G1.1 §1, unchanged |
| Switcher | QANDEEL · Shared World · Public World in reading order | the same | order follows reading direction; glyphs never mirrored |
| The canonical Q | never mirrored | never mirrored | a logo (C3 §7.1; P2 §10) |
| «سياق الكلام» (X-A) | the inward side of Replay | the inward side of Replay | grouped with the other act on the conversation |

Arabic is not a translated afterthought: every candidate was drawn and measured in Arabic first, then in a real English
LTR composition (board 08), never as a mirrored screenshot.

## 3. Bidi and script

- The page root carries `dir` and `lang` (`ar-EG` / `en`) — `C-DIR-1`. `lang` drives the browser's Arabic shaping and a
  screen reader's voice.
- Conversation paragraphs are `dir="auto"`, so a Latin fragment ("presentation", "Q3 numbers", "Pixel 8") resolves inside
  its Arabic paragraph without breaking punctuation; speaker side stays independent of paragraph direction (G1.1 §1).
- No `letter-spacing` and no italics on anything containing Arabic; every Arabic line-height is ≥ 1.6 (the frozen
  reading ramp).
- P4-C's own chrome renders Western digits, as P2-A and P3-A do, under T-12's one locale authority; it sets no digit policy. G3.2's world labels (I-08B1 fixture) render Arabic-Indic digits and Arabic labels, even in English — G3.2's own content, shown unchanged, and not a P4-C decision.
- `dir="auto"` on conversation paragraphs works here because every fixture paragraph starts with a letter of its own script; an Arabic sentence opening with a Latin token ("Pixel 8", "Q3") would resolve LTR. Implementation should set paragraph direction from the language of the text, not from its first strong character.
- English "In play now" for «سياق الكلام» is `PROOF COPY — NOT CANONICAL`; its final wording belongs to P4-DQ-09.

## 4. 320 pt and large text

- Every candidate is captured at 320 × 568 in both languages, and in the densest Analysis state (Live Call + PINNED).
  The measured results are in [`P4C_DECISION_STUDY.md`](P4C_DECISION_STUDY.md) and board 09. Two candidates fail there
  as drawn: U-B (the chrome overflows; the door and Replay leave the screen) and X-C (the world drops below its 160 pt
  floor).
- **Large text:** the harness offers a browser stand-in (`ts=large`, 118 %) and board 09 shows it. It is **not** Dynamic
  Type: the real large-text behaviour of the chrome at 320 pt is a device gate, as G3 §G (F-08) already records.

## 5. What is not evidenced here

- **Focus inside the Analysis.** The «سياق الكلام» candidates are laid over G3.2's frame from outside it, so their place in G3.2's own focus order cannot be shown by this proof; in production the action belongs in the chrome row's focus sequence. The matrix records this gap on X-A and X-B.
- **Device assistive technology.** VoiceOver / TalkBack, Dynamic Type, Bold Text and device Increase Contrast are device gates.

## 6. Skills applied

| Skill | Concrete effect here |
|---|---|
| `sibawayh:designing-arabic-frontends` | START / END placement throughout; the depth chevron mirrors by meaning while the Q, Open Ledger and the World glyphs never do; `lang="ar-EG"` with `dir="rtl"` at the root; no letter-spacing, no italics, line-height ≥ 1.6; one digit policy, deferred to T-12 |
| `impeccable` (craft floor, Operate mode) | the brief's pinned world wins over taste: no pills, no gradients, no glows, no cards for the new rows; states checked on the built result (focus, pressed, contrast) in one batched inspection round; icons drawn from the real P2 family, never glyph stand-ins |
