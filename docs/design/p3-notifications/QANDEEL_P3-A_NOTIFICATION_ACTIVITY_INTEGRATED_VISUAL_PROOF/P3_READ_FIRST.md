# QANDEEL — P3-A Notification & Activity: Integrated Visual Proof and Decision Gate

> **Status: `P3-A FINAL MICRO-REFINEMENT — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW`.**
> **P3 remains NOT CLOSED / NOT FROZEN.** No production notification runtime or platform integration has been
> implemented. A P3 canonical closure would be a later, separate task.

**Baseline:** `main` `b9e087ba366c9df6843b6b880ff5e790f1fde045` (after PR #274, P2 CLOSED / FROZEN).
**Branch:** `design/p3-notification-activity-integrated-visual-proof` (Draft PR #275).
**Refinement:** on the same branch, from the independently reviewed head `579648f` (→ `d92c67b`); the **final
micro-refinement** follows on the same branch from `d92c67b`.

It realizes the Product Owner's accepted P3 direction on top of the frozen I-08N-01 contract, which it does not
reopen, using the final P2 icon system byte-for-byte — and, after the refinement, the Product Owner's selections:
**Open Ledger** accepted; **no Activity entry in the Analysis**; L1 = **«إظهار النوع» / "Show type"**; **Reduce** = a
tighter Proactive Gate, not a class rule; **no Introductions category cap** (default L0 kept); during a Live Call only
**critical security** and a **requested exact-time reminder** show a small **call-safe strip**; a **P2-compliant
Introductions mark**; a bounded copy cleanup — and, after the final micro-refinement: **Open Link is final** (At the
Door is comparison / history only); **no ordinary Attention Strip inside the Analysis** (the model defers ordinary
attention there, keeps it in Activity and **re-evaluates it when the user leaves — at most one strip**); the call-safe
strip has **no Direct Entry** (dismiss only). Temporary intentional Replay occlusion is the one bounded exception; all
other frozen Analysis controls and the world remain unobstructed — and it applies only to the two call-safe cases during
an active Live Call.

## What to look at, in this order

1. `boards/18-decision-summary.png` — the whole direction in one view, every Product Owner decision, and what is
   still open (copy and device / implementation only).
2. `boards/06-attention-strip.png` — the strip; inside the Analysis nothing ordinary appears and leaving it
   re-evaluates (one strip at most); during a Live Call ordinary attention waits and the call-safe strip serves the two
   exceptions, measured against G3's own Analysis.
3. `boards/05-global-activity-entry.png` — the accepted Open Ledger, the Analysis without the entry, and the final
   Open Link Introductions mark (At the Door as history).
4. `boards/10-lock-screen-disclosure.png` — L0 → L3 in the accepted words, Introductions L0 with no category cap.
5. `boards/07`, `08` settings (Reduce, «إظهار النوع», the raised Introductions ceiling) · `14` foreground / background
   (39 scenarios + the exit cases X1–X4) · `17` accessibility and Reduced Motion.
6. `boards/01`–`04`, `09`, `11`–`13`, `15`, `16` — Activity, filters, attention states, permission, indicators, Quiet
   Hours, ceilings, 320 / 390 / 430.
7. `motion/`: `M10` leaving the Analysis → re-evaluation → one strip, `M08` / `M08r` the call-safe strip in the
   Analysis (and Reduced Motion), `M09` the same at 320 × 568,
   `M02` strip, `M03` strip → Direct Entry, `M04` Reduced Motion, `M01` the mark during a Live Call, `M05` education →
   platform, `M06` the night and the 08:00 re-evaluation, `M07` seen / opened.
8. `docs/P3_PRODUCT_PROOF_REPORT.md` — the decision-gate report in plain Product language.

## Open it live

`prototype/index.html` opens in Chrome and works offline. The Analysis states load G3.2's own reviewed page from
`prototype/g3.2/index.html` (byte-exact) in a frame; served over `http://` (as the tools do) the proof also measures and
drives it. The panel beside the phone is the proof harness (states, device stand-ins, arrivals, and the model's
decision log), not Product UI.

| Harness parameter | Values |
|---|---|
| `?state=` | `conv` · `conv-strip-shared` · `shared-strip-qandeel` · `conv-strip-system` · `shared-inplace` · `conv-call` · `conv-call-security` · `conv-call-reminder` · `analysis` · `analysis-deferred` · `analysis-exit` · `analysis-call` · `analysis-call-security` · `analysis-call-reminder` · `activity` · `activity-stale` · `settings-root` · `notif` · `notif-lock` · `edu` · `edu-boundary` · `edu-notnow` · `shared` |
| `?lang=en` · `?appearance=light` / `system` · `?rm=1` · `?contrast=more` · `?w=320&h=568` / `?w=430&h=932` | device stand-ins |
| `?os=denied` · `?intro=0` · `?filter=…` · `?proactive=reduce` · `?lockintro=L3` · `?g32=CALL_PINNED` · `?arrive=reply` · `?mute=w-summer` | Product conditions |
| `?entry=bell` · `?introglyph=door` | comparison glyphs (Quiet Bell and At the Door are comparison / history only) |
| `?defect=…` | planted defects for the checks only — e.g. `analysisstrip` = REJECTED / PLANTED DEFECT — ORDINARY STRIP INSIDE ANALYSIS |

**Try:** in `conv`, press an arrival (`sharedReply`) → the strip; press it → «رحلة الصيف». In `analysis`, press
`sharedReply` → nothing appears (deferred); press «المحادثة» in G3's chrome → re-evaluated, one strip. In `analysis-call`, press
`security` → the call-safe strip in the chrome row; press `sharedReply` → nothing but the wait. In `conv-call`, end the
call (the handset) → the deferred reply is re-evaluated and shown once.

## Package

| Path | What |
|---|---|
| `docs/P3_AUTHORITY_AND_SCOPE.md` | repository truth, authorities read, the frozen semantics realized, the refinement, non-scope |
| `docs/P3_PLATFORM_REFERENCE_GATE.md` | Apple / Android primary sources (checked 2026-09-26), platform-owned vs QANDEEL-owned, the Skills Gates |
| `docs/P3_ACTIVITY_VISUAL_SPEC.md` · `P3_ATTENTION_STRIP_SPEC.md` | Activity, the entry, the Introductions mark, the attention mark, the strip and the call-safe strip |
| `docs/P3_PRIVACY_DISCLOSURE_PROOF.md` · `P3_NOTIFICATION_SETTINGS_PROOF.md` · `P3_PERMISSION_EDUCATION_PROOF.md` | Lock Screen words and the Introductions ceiling, settings and Reduce, permission |
| `docs/P3_FREQUENCY_QUIET_HOURS_PROOF.md` | ceilings, Quiet Hours, Snooze, no morning dump |
| `docs/P3_STATE_MOTION_ACCESSIBILITY.md` | states, motion, accessibility, device gates |
| `docs/P3_IMPLEMENTATION_FEASIBILITY.md` | future seams and constraints — not an implementation task |
| `docs/P3_PRODUCT_PROOF_REPORT.md` | the report |
| `prototype/index.html` · `prototype/g3.2/index.html` | the proof, built from `source/` · G3.2's reviewed prototype, byte-exact (the Analysis) |
| `source/` | `src/` (model, fixtures, copy, glyphs, build, runtime) · `tools/` (pipeline, capture, boards, checks, copy table, package, vendor) · `vendor/` (P2 material byte-exact; `PROVENANCE.json` also records the G3.2 page) · `REGENERATE.md` |
| `boards/` · `motion/` · `captures/` | 18 boards · 14 clips · 22 key captures |
| `data/` | `CHECKS.json`, `SHOTS.json`, `BOARDS.json`, `A11Y.json`, `COPY_TABLE.md`, `motion/` (per-frame truth) |
| `MANIFEST.json` | every file with bytes and SHA-256 |

**Browser evidence only.** VoiceOver / TalkBack, device Reduce Motion / Increase Contrast, haptics, real delivery and
the platform notification surfaces are implementation / device gates.
