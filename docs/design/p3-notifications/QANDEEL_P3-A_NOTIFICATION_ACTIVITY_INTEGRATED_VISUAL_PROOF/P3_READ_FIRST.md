# QANDEEL — P3-A Notification & Activity: Integrated Visual Proof and Decision Gate

> **Status: `P3-A — VISUAL PROOF / DECISION GATE — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW`.**
> **P3 is NOT CLOSED / NOT FROZEN.** No production notification runtime or platform integration has been implemented.
> A P3 canonical closure would be a later, separate task.

**Baseline:** `main` `b9e087ba366c9df6843b6b880ff5e790f1fde045` (after PR #274, P2 CLOSED / FROZEN).
**Branch:** `design/p3-notification-activity-integrated-visual-proof`.

It realizes the Product Owner's accepted P3 direction on top of the frozen I-08N-01 contract, which it does not
reopen, using the final P2 icon system byte-for-byte.

## What to look at, in this order

1. `boards/18-decision-summary.png` — the whole direction in one view, and the only open (craft) questions.
2. `boards/01-activity-arabic-dark.png`, `02-…english-light` — Activity. `03` filters, `04` attention states.
3. `boards/05-global-activity-entry.png` — the entry in the real shell, and the new glyph (Open Ledger, recommended).
4. `boards/06-attention-strip.png` — when the in-app strip appears, and when it does not (same place, Live Call).
5. `boards/10-lock-screen-disclosure.png` — L0 → L3, Introductions L0, no default preview.
6. `boards/07`, `08` settings · `09` permission · `12` Quiet Hours · `13` ceilings · `14` foreground / background.
7. `motion/`: `M02` strip, `M03` strip → Direct Entry, `M04` the same under Reduced Motion, `M01` the mark during a
   Live Call, `M05` education → platform, `M06` the night and the 08:00 re-evaluation, `M07` seen / opened.
8. `docs/P3_PRODUCT_PROOF_REPORT.md` — the decision-gate report in plain Product language.

## Open it live

`prototype/index.html` opens from disk in Chrome and works offline. The panel beside the phone is the proof harness
(states, device stand-ins, arrivals, and the model's decision log), not Product UI.

| Harness parameter | Values |
|---|---|
| `?state=` | `conv` · `conv-strip-shared` · `shared-strip-qandeel` · `conv-strip-system` · `shared-inplace` · `conv-call` · `activity` · `activity-stale` · `settings-root` · `notif` · `notif-lock` · `edu` · `edu-boundary` · `edu-notnow` · `shared` |
| `?lang=en` · `?appearance=light` / `system` · `?rm=1` · `?contrast=more` · `?w=320&h=568` / `?w=430&h=932` | device stand-ins |
| `?os=denied` · `?intro=0` · `?filter=…` · `?entry=bell` | Product conditions, and the comparison glyph |

**Try:** in `conv`, press an arrival (`sharedReply`) → the strip; press it → «رحلة الصيف». In `conv-call`, end the call
(the handset) → the deferred reply is re-evaluated and shown once. Open Activity, wait a moment → seen rows lose the
dot; the security item and the introduction keep the ring.

## Package

| Path | What |
|---|---|
| `docs/P3_AUTHORITY_AND_SCOPE.md` | repository truth, authorities read, the frozen semantics realized, non-scope |
| `docs/P3_PLATFORM_REFERENCE_GATE.md` | Apple / Android primary sources (checked 2026-09-26), platform-owned vs QANDEEL-owned, the Skills Gate |
| `docs/P3_ACTIVITY_VISUAL_SPEC.md` · `P3_ATTENTION_STRIP_SPEC.md` | Activity, the entry, the mark, the strip |
| `docs/P3_PRIVACY_DISCLOSURE_PROOF.md` · `P3_NOTIFICATION_SETTINGS_PROOF.md` · `P3_PERMISSION_EDUCATION_PROOF.md` | Lock Screen words, settings, permission |
| `docs/P3_FREQUENCY_QUIET_HOURS_PROOF.md` | ceilings, Quiet Hours, Snooze, no morning dump |
| `docs/P3_STATE_MOTION_ACCESSIBILITY.md` | states, motion, accessibility, device gates |
| `docs/P3_IMPLEMENTATION_FEASIBILITY.md` | future seams and constraints — not an implementation task |
| `docs/P3_PRODUCT_PROOF_REPORT.md` | the report |
| `prototype/index.html` | the proof, built from `source/` |
| `source/` | `src/` (model, fixtures, copy, glyphs, build, runtime) · `tools/` (pipeline, capture, boards, checks, copy table, package) · `vendor/` (P2 material byte-exact; `PROVENANCE.json`) · `REGENERATE.md` |
| `boards/` · `motion/` · `captures/` | 18 boards · 10 clips · 16 key captures |
| `data/` | `CHECKS.json`, `SHOTS.json`, `BOARDS.json`, `A11Y.json`, `COPY_TABLE.md`, `motion/` (per-frame truth) |
| `MANIFEST.json` | every file with bytes and SHA-256 |

**Browser evidence only.** VoiceOver / TalkBack, device Reduce Motion / Increase Contrast, haptics, real delivery and
the platform notification surfaces are implementation / device gates.
