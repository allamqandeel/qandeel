# QANDEEL — P4-C3 Residual Visual + Copy Proof

> **Status: `P4-C3 — RESIDUAL VISUAL + COPY PROOF — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW`.**
> **P4 remains ACTIVE — NOT CLOSED / NOT FROZEN.** Nothing in this package freezes copy or visuals: every new string is
> `PROPOSED_FOR_PO_REVIEW`, and every Voice / call word is `RUNTIME_GATED` (PROOF ONLY / NOT COPY FREEZE). No production
> runtime was implemented. **No lantern research, design or technology selection was performed.** PR #280 was not merged.

**Baseline:** PR #280 head `0b2703ef35cbad724078926b645d2d216c860749`. **Branch:**
`design/p4-c-shell-chrome-integrated-decision-proof`.

The package closes the three evidence gaps P4-C2 left before P4's final reconciliation:

1. **Static launch → system handoff** (iOS, Android), up to the boundary where the standalone task
   **QANDEEL — Lantern Gateway Identity Moment v1** begins. Nothing past that boundary is drawn.
2. **Non-signal Voice**: the Voice Note turn, the finished-call record, recording and sent, and the Live Call composition.
   None of it shows a waveform, a level or a speaking signal.
3. **P4-owned bilingual copy**: the core Conversation / Analysis / Replay / Timeline / Live-edge words, the English normal
   opener, the confidence words, the Settings group names, the Public ID warning, and P3's residual copy.

## What to look at, in this order

1. [`docs/P4C3_PRODUCT_PROOF_REPORT.md`](docs/P4C3_PRODUCT_PROOF_REPORT.md) — the report: findings, limitations and the
   one Product Owner question.
2. Voice: [`03`](boards/03-voice-note-history-ar.png) · [`04`](boards/04-voice-note-history-en.png) ·
   [`05`](boards/05-finished-call-history-ar-en.png) · [`06`](boards/06-voice-note-recording-non-signal.png) ·
   [`07`](boards/07-live-call-analysis-non-signal.png), then
   [`docs/P4C3_VOICE_VISUAL_SPEC.md`](docs/P4C3_VOICE_VISUAL_SPEC.md).
3. Launch: [`01`](boards/01-launch-handoff-ios.png) · [`02`](boards/02-launch-handoff-android.png), then
   [`docs/P4C3_PLATFORM_LAUNCH_RESEARCH.md`](docs/P4C3_PLATFORM_LAUNCH_RESEARCH.md).
4. Copy: [`08`](boards/08-core-copy-conversation-analysis-replay-timeline.png) ·
   [`09`](boards/09-understanding-confidence-and-settings-copy.png) · [`10`](boards/10-public-id-warning.png) ·
   [`11`](boards/11-p3-residual-copy.png) · [`12`](boards/12-opener-ar-en.png), then
   [`docs/P4C3_COPY_PROOF_REPORT.md`](docs/P4C3_COPY_PROOF_REPORT.md) and
   [`data/COPY_DECISION_TABLE.md`](data/COPY_DECISION_TABLE.md).
5. Stress and accessibility: [`13`](boards/13-stress-320-large-text.png) ·
   [`14`](boards/14-accessibility-contrast-reduced-motion.png).

## Open it live

[`prototype/index.html`](prototype/index.html) works offline in Chrome. The Analysis states load G3.2's reviewed page from
`prototype/g3.2/index.html` (byte-exact) in a frame, so serve the folder over `http://`. The panel beside the phone is the
**PROOF HARNESS — NOT PRODUCT UI**.

| Harness parameter | Values |
|---|---|
| `?state=` | `conv` · `opener` · `record` · `sent` · `call-analysis` · `call-conv` · `call-analysis-2` · `call-muted` · `call-ended` · `analysis` · `analysis-pinned` · `analysis-replay` · `settings` · `notif` · `publicid` · `understanding` · `launch-ios` · `handoff-ios` · `launch-android` · `handoff-android` |
| Voice Note | `vn=rest\|paused\|playing` (stored playback state) |
| device stand-ins | `lang=en` · `appearance=light` · `contrast=more` · `rm=1` · `w=320&h=568` / `w=430&h=932` · `ts=large` · `sec=proactive\|quiet\|lock` |
| validator only | `defect=…` — the planted defects (see `source/src/app.js` `plantDefects`); each is rejected by its named check |

In the live page, the call, recording and End controls work with real input. The clock advances in real time.

## Package

| Path | What |
|---|---|
| [`docs/P4C3_AUTHORITY_AND_SCOPE.md`](docs/P4C3_AUTHORITY_AND_SCOPE.md) | repository truth, authorities read, consumed bytes, scope and non-scope |
| [`docs/P4C3_PLATFORM_LAUNCH_RESEARCH.md`](docs/P4C3_PLATFORM_LAUNCH_RESEARCH.md) | Apple / Android first-party guidance, checked 2026-09-27 — evidence, never authority |
| [`docs/P4C3_VOICE_VISUAL_SPEC.md`](docs/P4C3_VOICE_VISUAL_SPEC.md) | the non-signal Voice specification proposed for review |
| [`docs/P4C3_COPY_PROOF_REPORT.md`](docs/P4C3_COPY_PROOF_REPORT.md) | the copy rules and the owned words |
| [`docs/P4C3_PRODUCT_PROOF_REPORT.md`](docs/P4C3_PRODUCT_PROOF_REPORT.md) | the report: skills, checks, findings, limitations, the PO question |
| `data/` | `COPY_DECISION_TABLE.md` · `COPY_REGISTRY.json` · `CHECKS.json` · `A11Y.json` · `PROVENANCE.json` · `SHOTS.json` · `BOARDS.json` |
| `boards/` · `captures/` | 14 boards · the kept representative captures |
| `prototype/` · `source/` | the proof, and everything that builds it ([`source/REGENERATE.md`](source/REGENERATE.md)) |
| [`MANIFEST.json`](MANIFEST.json) | every file with bytes and SHA-256 |

**Browser evidence only.** VoiceOver / TalkBack, Dynamic Type, device contrast / motion settings, native launch
behaviour and real audio remain implementation / device gates.
