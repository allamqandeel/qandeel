# P3-A — State, motion and accessibility (proof)

**Status:** `P3-A EVIDENCE — NOT FROZEN` (refined: P3-A refinement §8, §9; final micro-refinement §5–§13). Evidence:
boards 04, 05, 06, 11, 14, 17; clips M01–M10 (+ Reduced Motion counterparts); checks C-A11Y-1…9, C-A11Y-1b, C-STRIP-3,
C-CALL-5…7, C-ANL-3, C-EXIT-3, C-GLY-1…3, C-P2-1. **Browser evidence only.**

## 1. State channels (E1R, consumed unchanged)

| State | Channel | Where |
|---|---|---|
| PRESSED | the ground wash under the content, from pointer-down (P2-A F-P2-06 kept) | every control (`.pz`) |
| FOCUS | the detached perimeter with its world-colour companion | every control; headings that receive programmatic focus for assistive technology draw no ring (they are not controls) |
| SELECTED | primary-selected ink + weight 600 + a 2-pt marker | filters, the Proactive choice, the navigation (unchanged) |
| attention (new) | a small solid neutral mark, presence only | the entry, Activity rows |
| attention (waiting) | a hollow ring mark | actionable Activity rows after they are seen |
| opened | secondary ink on the sentence | Activity rows |
| stale | tertiary ink + words | Activity rows |

No state is carried by colour alone: each also has a shape (mark / ring / marker), a position (switch knob), a weight
or words in the accessible name (C-A11Y-5). Living Brass stays the navigation family's and never carries state
(C-P2-1); the attention mark is never Brass or error ink (C-MARK-1/2).

## 2. Motion (Calm State Morphing, P2 §9 — consumed)

| Clip | What moves | Standard | Reduced Motion |
|---|---|---|---|
| M01 / M01r | the attention mark arrives during a Live Call (nothing else moves; the call is untouched) | fade + scale 0.6 → 1, 220 ms | fade, 180 ms |
| M02 / M04 | strip: appear · 6 s readable hold · dismiss | 240 ms ease-out, 10 pt from the chrome; exit 180 ms back up | opacity only, 160 / 140 ms |
| M03 | strip → Direct Entry into «رحلة الصيف» | strip leaves, then the World fades in 200 ms | 120 ms |
| M05 / M05r | education → platform boundary | scrim 220 ms, sheet rises 320 ms (the iOS sheet curve), then the schematic boundary | opacity only |
| M06 | Quiet Hours night → 08:00 re-evaluation (board-drawn) | a cursor sweeps the model's timeline | — (a board, not UI) |
| M07 / M07r | seen / opened / waiting | seen marks fade 260 ms after a 1.2 s dwell; opening a row, then Back | 160 ms fades |
| M08 / M08r | the call-safe strip in the Analysis during a Live Call (critical security): appear · 6 s hold · dismiss by itself; G3's page underneath does not move | 240 ms ease-out, 6 pt from the chrome; exit 180 ms back up | opacity only, 160 / 140 ms |
| M09 | the call-safe strip at 320 × 568, PINNED (a requested reminder, English), dismissed by ×; the call keeps running | as M08 | — (M08r shows the Reduced Motion form) |
| M10 | inside the Analysis four ordinary events arrive: **nothing moves** (deferred; no deferral animation is invented). «المحادثة» leaves the Analysis: the model re-evaluates and ONE strip appears with the approved ordinary strip motion | the Conversation fades in 200 ms; the strip as M02 | — (M04 is the ordinary strip's Reduced Motion form; no new motion language) |

No bounce language (no finger momentum is involved), no loop, no pulse, no countdown, no fake loading, no speaking or
audio signal, and no animation that creates event truth. Only `transform` and `opacity` animate. Every clip is 30 fps,
rendered frame by frame on the page's virtual clock (`window.P3.tick`), encoded with the host's H.264 (Media
Foundation) encoder and decoded back to count its frames (`data/motion/*.json` holds each frame's measured opacity and
transform). **Timings are craft, not frozen**; feel is a device gate.

## 3. Accessibility (fixing-accessibility, applied)

- **Names:** every control has an accessible name, in both languages (C-A11Y-1). Where a control's name would otherwise
  be glued from several text pieces («رحلة الصيفمفعّل»), it carries an explicit, separated label (C-A11Y-1b — found by
  this proof's own board 17 and fixed; planted defect D15 proves the check can fail).
- **Decorative glyphs** are `aria-hidden` everywhere (C-A11Y-2).
- **Targets** ≥ 44 × 44 pt at 320, 390 and 430 (C-A11Y-3). No glyph grows to meet its target.
- **Focus** is visible under keyboard modality on the entry, filters, switches and the strip (C-A11Y-4). The strip's
  hold pauses while focus is inside it.
- **Dialogs:** the education, the preview-level chooser and the platform boundary are modal: focus moves in, everything
  behind them is `inert` (nothing behind is reachable or read), and Escape = "Not now" / close (C-A11Y-9). This proof's
  own board 17 name table first showed the page behind the education still reachable; it was fixed, and planted defect
  D16 proves the check can fail.
- **Announcements:** one persistent polite live region; a strip is announced once. Inside the Analysis ordinary
  attention creates **no transient region and no announcement** (no phantom live-region text; C-ANL-3, board 17) — the
  event is announced only if a strip follows when the user leaves, and it stays reachable in Activity. During a Live Call nothing
  ordinary is announced; only the call-safe strip is, once, through the same P3 region — «تنبيه أثناء المكالمة: … (المكالمة
  مستمرة)» — and never through the call's own live-status channel (G1.2's single channel for call-state changes).
- **The call-safe strip:** a named region (named once) with no Direct Entry; its one control is the named 44-pt dismiss
  (C-CALL-5, C-A11Y-1, C-A11Y-3); dismissing it does not resolve the event or end the call. In the Analysis it
  temporarily and intentionally occludes G3's Replay slot for its hold (the one bounded exception); if Replay takes
  keyboard focus there, the strip steps aside at once, so focus is never hidden (C-CALL-7).
- **Glyph grammar:** the Introductions source mark is measured on the rendered glyph (C-GLY-1…3) — no ring with more
  than one opening, points never side by side, the P2 optical stroke and round terminals.
- **Direction:** mirror by meaning (C-A11Y-6). Chevrons mirror; the ledger, World, call and media glyphs never do; the
  strip and the Call Rail follow layout direction; the entry sits at the START edge in both scripts; Latin handles are
  LTR islands.
- **Appearance and contrast:** Activity follows Dark / Light / System (C-A11Y-8); Increased Contrast uses the F1 / F2
  token transforms and a 7-pt mark (board 11, 17).

## 4. Device gates (not proven here)

VoiceOver / TalkBack reading order and names, device Reduce Motion and Increase Contrast, Dynamic Type at the largest
sizes, real touch latency, haptics, and the platform notification surfaces themselves.
