# G1.2 — Source trace

Every canonical source read for G1.2, and what it decided here.

- **Repository head:** local branch `fix/connected-worlds-rem03-privacy-cross-phase-governance` at `7eb2017d`.
- **Canonical `main`:** `049759f80f26e5ad41e3032d898b1815cdde4860`, fetched and read with `git show` (the working tree
  was not switched).

| Source | Read at | Decided |
|---|---|---|
| `AGENTS.md` | local | report product-contract gaps; no tracked change without a branch; never `git add -A`; secrets |
| `apps/mobile/README.md` | `main` | CNG hierarchy (config plugin / Expo Module); T-12P foreground-only live driver, no background polling; T-13 durable viewpoint vs ephemeral state |
| `apps/mobile/package.json`, `app.json`, `app.config.js` | `main` | SDK 57 / RN 0.86.3; no audio or call library; no permissions or background modes |
| `docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md` | `main` | G1.1 CLOSED / FROZEN; `UTTERANCE` role and its one-tone alias (vendored as `vendor/tokens/base/g11.utterance.alias.tokens.json`, verbatim); carry-forward boundaries |
| `docs/design/phase-vi/vi-01-bilingual-product-language/*` (amended) | `main` | §14 voice principles; Terminology Matrix V01–V07 (PROVISIONAL / PHASE VII); «سياق الكلام» (Tier 2 approved); T13 empty Live Context; register and gender law |
| `docs/replay-runtime-v1.md` §7, §19 | `main` | Personal original audio / call NOT PRODUCIBLE; `source_modality` TEXT; the open Live Head cannot be frozen |
| `docs/qandeel-canonical-backlog-v1.md` | `main` | `QAN-BL-NAV-02` open; no Voice / Live Call runtime item |
| `docs/implementation-foundation/QANDEEL_FOUNDATION_FREEZE_v1.0.md` | local = `main` | provider independence; interruption first-class; realtime voice deferred |
| `QANDEEL_Recommended_TECH_STACK_v1.0.md`, `QANDEEL_PROJECT_SKELETON_v1.0.md` | local | Voice Adapter; Speech Rendering; candidate providers; benchmark-driven |
| `QANDEEL_CONVERSATION_ORCHESTRATOR_v1.0.md`, `QANDEEL_BEHAVIORAL_RUNTIME_v1.0.md`, `QANDEEL_SAFETY_RUNTIME_v1.0.md` | local | interruption as a lifecycle event; QANDEEL yields immediately; no raw-audio logging |
| G1.1-R3 package source (`.i08b31-g11r3-work`, reviewed zip `0a56a2fb…`) | local | the shell base; unchanged frozen decisions |

**Official platform documentation:** the URL list is in the compliance note, §10.
