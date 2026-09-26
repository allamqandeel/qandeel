# QANDEEL — P4-C Shell / Placement / Small-Chrome Integrated Visual Decision Proof

> **Status: `P4-C — COMPARATIVE VISUAL DECISION PROOF — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW`.**
> **P4-DQ-01 … P4-DQ-04 remain OPEN. No candidate has been selected or frozen.** P4 remains ACTIVE, NOT CLOSED / NOT
> FROZEN. No production implementation has been authorized or performed.

**Baseline:** `main` `175df7b6f9254d83b82d2b7571c915959fb06a27` (after PR #279). **Branch:**
`design/p4-c-shell-chrome-integrated-decision-proof`.

This package gives the Product Owner integrated evidence for four open questions — where General Settings is entered,
where QANDEEL Understanding is entered, where the canonical Q appears, and the final small chrome (the Global Switcher's
form and «سياق الكلام»'s place in the Analysis). It is built on the real accepted Product: P3-A's non-Analysis shell and
G3.2's own Analysis, loaded byte-exact. With no parameters the live page opens on the incumbent shell, not on any candidate. Every option is a **CANDIDATE — NOT SELECTED**, except the options authority rejects (X-C; the Understanding-as-Settings row), which are labelled **REJECTED BY AUTHORITY**; each of the two combined
directions is an **INTEGRATED CANDIDATE — NOT SELECTED**.

## What to look at, in this order

1. [`boards/11-decision-summary.png`](boards/11-decision-summary.png) — the four decisions, the candidates, the advisory
   recommendations and the exact questions, in one view.
2. [`docs/P4C_PRODUCT_PROOF_REPORT.md`](docs/P4C_PRODUCT_PROOF_REPORT.md) — the report, ending in four Product Owner
   decision cards.
3. The decision boards: [`02`](boards/02-dq01-settings-placement.png) Settings ·
   [`03`](boards/03-dq02-understanding-placement.png) Understanding · [`04`](boards/04-dq03-q-placement.png) the Q ·
   [`05`](boards/05-dq04-switcher-form.png) the switcher · [`06`](boards/06-dq04-context-placement.png) «سياق الكلام».
4. The integrated boards, where collisions show: [`07`](boards/07-integrated-ar-dark.png) Arabic Dark ·
   [`08`](boards/08-integrated-en-light.png) English Light · [`09`](boards/09-compact-320-stress.png) 320 × 568 and large
   text · [`10`](boards/10-accessibility-rtl-focus.png) Increased Contrast and keyboard focus.
5. [`boards/01-authority-baseline.png`](boards/01-authority-baseline.png) — what already binds, untouched.
6. [`docs/P4C_DECISION_STUDY.md`](docs/P4C_DECISION_STUDY.md) — the qualitative evidence matrix (no numeric scores).

## Open it live

[`prototype/index.html`](prototype/index.html) works offline in Chrome. The Analysis states load G3.2's reviewed page from
`prototype/g3.2/index.html` (byte-exact) in a frame, so serve the folder over `http://` to see them (any static server;
the tools use their own). The panel beside the phone is the **PROOF HARNESS — NOT PRODUCT UI**.

| Harness parameter | Values |
|---|---|
| `?state=` | `conv` · `shared` · `activity` · `settings` · `understanding` · `analysis` · `analysis-pinned` · `analysis-call` · `analysis-callpinned` · `analysis-cue` |
| candidates | `s=A\|B` · `u=A\|B` · `q=A\|B\|C` · `sw=plate\|ground\|seam` · `x=end\|centre\|top` · `dir=I\|II` (an integrated direction) |
| device stand-ins | `lang=en` · `appearance=light` / `system` · `contrast=more` · `w=320&h=568` / `w=430&h=932` · `ts=large` |
| validator only | `defect=…` — the 23 planted defects (see `source/src/candidates.mjs` `DEFECTS`; each is rejected by its named check in `data/CHECKS.json`) |

## Package

| Path | What |
|---|---|
| [`docs/P4C_AUTHORITY_AND_SCOPE.md`](docs/P4C_AUTHORITY_AND_SCOPE.md) | repository truth, authorities read, the baseline, scope and non-scope |
| [`docs/P4C_PLATFORM_REFERENCE_GATE.md`](docs/P4C_PLATFORM_REFERENCE_GATE.md) | Apple / Android primary guidance (checked 2026-09-26) — evidence, never authority |
| [`docs/P4C_DECISION_STUDY.md`](docs/P4C_DECISION_STUDY.md) | the evidence matrix per decision, with its measurements |
| [`docs/P4C_PRODUCT_PROOF_REPORT.md`](docs/P4C_PRODUCT_PROOF_REPORT.md) | the report, the Review Pool and the four decision cards |
| [`docs/P4C_ACCESSIBILITY_RTL.md`](docs/P4C_ACCESSIBILITY_RTL.md) | targets, names, state channels, direction by meaning, bidi, 320 pt |
| [`docs/P4C_PROVENANCE.md`](docs/P4C_PROVENANCE.md) | every vendored byte and its origin; what was adapted; how to regenerate |
| `prototype/` · `source/` | the proof, and everything that builds it ([`source/REGENERATE.md`](source/REGENERATE.md)) |
| `boards/` · `captures/` | 11 boards · 28 representative captures (124 captured) |
| `data/` | `CHECKS.json` · `DECISION_MATRIX.json` · `SHOTS.json` · `BOARDS.json` |
| [`MANIFEST.json`](MANIFEST.json) | every file with bytes and SHA-256 |

**Browser evidence only.** VoiceOver / TalkBack, Dynamic Type and device contrast settings are implementation / device
gates.
