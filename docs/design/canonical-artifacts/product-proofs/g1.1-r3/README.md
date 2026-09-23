# I-08B3.1-G1.1-R3 — Consolidated Product / Conversation / Replay / Naming Correction

**READY FOR INDEPENDENT PRODUCT / DESIGN REVIEW.** Not merged. G1.1 is not closed. No new Product truth
is frozen.

This package is the G1.1 conversation proof revised by the R3 consolidated brief. The sealed G1.1 and A1
packages are left untouched beside it.

## Start here (ten minutes)

1. `proof/R3-00-at-a-glance.png` — the locked decisions in one row.
2. `G1.1_R3_FINAL_REPORT.md`:
   - §A — what R3 supersedes.
   - §B — what it records: the exact opener, the slab, the side rule, the three modes, Live Call Analysis-first, Replay placement and its audio dependency, shared grammar, B4 status.
   - §D — canon conflicts reported.
   - §E — decisions for review.
3. `proof/conversation/` — the opener, the speaker sides (Arabic USER right, English USER left), mixed-language bidi, the slab magnified.
4. `proof/modes/` — Writing and the one line, Voice Note, Live Call.
5. `proof/replay/` — Replay in the upper chrome, then its entry: the whole conversation or a part.
6. `proof/shared-area/`, `proof/light/`, `proof/motion/` (Reduced Motion parity), `proof/accessibility/`.
7. `G1.1_R3_B4_RECONCILIATION_NOTE.md` — the slab fits no B4 role; the recommendation is one additive role, UTTERANCE.
8. `G1.1_R3_SKILL_USAGE_LEDGER_DELTA.md` — the Skills re-read in this run, by path and hash.
9. `prototype/index.html` — the interactive proof:
   - Write and press Enter.
   - Tap the microphone for a voice message.
   - Tap the handset for a Live Call: it opens the Analysis, and «المحادثة» returns without ending it.
   - Tap Replay at the top.

   Also in `prototype/`: `index-en.html` (English) and `index-new-conversation.html` (the opener only; no Replay until you write).

## Layout

```
G1.1_R3_FINAL_REPORT.md               the report (A–K)
G1.1_R3_SKILL_USAGE_LEDGER_DELTA.md   Skill Gate delta for this run
G1.1_R3_B4_RECONCILIATION_NOTE.md     the slab and B4 (R3 §14)
README.md                             this file
proof/
  R3-00-at-a-glance.png
  conversation/  modes/  replay/  shared-area/  light/  motion/  accessibility/
  <each>/screens/                     the full-resolution captures the boards are made of
  motion/*.mp4, motion/frames/        three 60 fps journeys (standard, Reduced Motion, English)
prototype/                            index.html (Arabic), index-en.html, index-new-conversation.html
source-notes/SOURCE_TRACE.md          every canonical source used, with what it decided
data/                                 checks, screen facts, motion truth logs, manifest
source/                               src/ tools/ vendor/ — everything needed to regenerate (REGENERATE.md)
```

## Review parameters for the prototype

These are review chrome, not Product controls:
- `?appearance=light|dark`
- `?rm=1` for Reduced Motion
- `?contrast=more`
- `?ts=2` for 200% text
- `?shared=0|1|3`
- `?state=call|call-conv|note|replay-menu|replay-part|shared|world`

Keyboard: Tab reaches every control. Escape closes the Replay entry, leaves a part selection, or leaves the Analysis. It never ends a call.
