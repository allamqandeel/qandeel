# QANDEEL — Stage 8B
## S8B-03 — MACHINE_ASR Fresh Evidence Controlled Amendment v1.0

**Status:** `APPROVED BY THE PRODUCT OWNER (2026-10-31, S8B-03 WP0 contract v1.2: D1, E1 … E13) — IMPLEMENTED BY S8B-03 CP1 ON s8b/s8b-03-cp1 (DRAFT PULL REQUEST, NOT MERGED) — BINDS FROM THAT MERGE — MIGRATION 0186 NOT HOSTED — EVERY VOICE GATE DISABLED, SO NO USER PRODUCES A MACHINE_ASR TURN TODAY`
**Scope:** the narrowest change to the governed brain that lets a Voice Note's machine transcript (`MACHINE_ASR`) become
Fresh Evidence by its confidence band, without ever being treated as words the user typed.
**Amends:** the [Voice Runtime Contract v1](../../../voice-runtime-v1.md) §4.2 (appended there as a dated note), and through
migration `0186` the bodies listed in §3, each re-created as its original plus declared edits
(`database/voice-notes-0186-substitutions.mjs`).
**Authority:** the Product Owner's S8B-03 CP1 authorization (2026-10-31), approving contract v1.2 in full (D1 … D5,
OD-1 … OD-10, E1 … E13). Record: [S8B-03 implementation record](../../../e2e/QANDEEL_S8B_03_PERSONAL_VOICE_NOTES_IMPLEMENTATION_RECORD_v1.md).
**Task:** `S8B-03` — CP1. It is not a Connected Worlds phase.

This record is additive. It replaces S8B-02's Deviation 6 (`MACHINE_ASR` was not Evidence) and S8B-02's Deviation 8 (no
spoken Memory command rule), both owned by S8B-03.

---

## 1. The governing principle (D1)

- A `MACHINE_ASR` unit is **QANDEEL's understanding of what it heard**. It is never the user's typed words, never quoted as
  them, and never promoted to `USER_CONFIRMED` or `USER_STATED`.
- **HIGH** and **MEDIUM** turns are Fresh Evidence and may write Memory with source `MACHINE_ASR` at the band's constant
  confidence: **0.90** (HIGH) and **0.75** (MEDIUM), read inside the database from
  `voice_private.machine_asr_memory_confidence_v1(band)`. No caller chooses the value.
- **LOW** leaves no durable trace: no Memory, no Evidence, no hypothesis, no intent, and its text is never sent to Open
  Understanding (backfill only).
- Correction, forgetting and lapse act through the existing Truth Maintenance; no new Memory runtime is created.

## 2. Band thresholds (OD-8)

`HIGH ≥ 0.85`, `MEDIUM ≥ 0.65`, otherwise `LOW`, with the closed high-impact word rule (K1 negation, K2 change and time,
K3 Memory verbs, K4 numbers, months and days, K5 the other language inside a note; `high-impact-words.ts`): such a word
heard below the HIGH threshold makes the whole note `LOW`, and every absence of confidence fails safe to `LOW`. These are controlled configuration, **not a calibration claim**.

## 3. The amendments E1 … E13

| # | Change | Where |
|---|---|---|
| E1 | `MACHINE_ASR` admitted at the L2 gate (step B); `SELF`, `DERIVED_INSIGHT`, repetition and the 64 limit unchanged | `canonical_eligible_memory_ids_v1` (re-created) |
| E2 | L1 widened in parallel (CURRENT, NOT_SELF, UNATTRIBUTED), keeping L2 ⊆ CURRENT | `personal_evidence_standing_v1` (re-created) |
| E3 | TS types, the projection and the association validator accept `MACHINE_ASR` | `evidence.types.ts`, `evidence.service.ts`, the association provider |
| E4 | The enrichment SKIP line for `MACHINE_ASR` is removed | `background-intelligence-enrichment.service.ts` |
| E5 | The source and `confirmedByTyping` at the six model boundaries; M-01 wherever Memory is shown; M-02 on a qualifying voice message; M-03 on a typed one | the three hypothesis adapters, the capture adapter, `ModelRouterMemoryContext` |
| E6 | Open Understanding **v4** = v3 + the turn's source + the per-band operation matrix + the in-database band confidence (**no confidence parameter**) + `p_confirmed_memory_ids`; v3 re-created as a wrapper of v4 with no confirmations; the v3 result shape unchanged | `0186`; the capture service; the post-response repository |
| E7 | A LOW turn feeds neither hypothesis generation nor intent (`NOT_ELIGIBLE`) | the dispatcher; the intent authority |
| E8 | Spoken Memory Control: `server_finalize_memory_control_turn_v2` re-created to read the turn's source; the band's source and confidence (must **equal** the constant, else `22023`); LOW refused → `NOT_HEARD_CLEARLY` (C-54); FORGET / DISABLE always confirmed first (C-55 / C-56); a spoken answer accepted from HIGH only | `0186`; `memory-control.service.ts` / `.copy.ts` |
| E9 | The typed confirmation: `memory_typed_confirmations`; the typed REMEMBER of an equivalent `MACHINE_ASR` Memory; `p_confirmed_memory_ids` in v4 from a typed turn only | `0186` |
| E10 | The knowledge picture includes `MACHINE_ASR` with its source | `personal-knowledge.projection.ts` |
| E11 | `uncertain_tokens` on the transcription; v4 refuses a person label containing an uncertain word | `0186` |
| E12 | A LOW turn runs Open Understanding in the existing backfill mode only | the capture service |
| E13 | The voice confidence comes from the database: `machine_asr_memory_confidence_v1` (IMMUTABLE); finalize v2 and `background_record_memory_v1` require **equality** instead of `< 0.95` for a voice turn; a start-up check refuses a P-1 configuration that differs from the function | `0186`; `machine-asr-confidence.startup-check.ts` |

## 4. What does not change (each with a regression proof)

- 0154 (Matching onboarding, a human decision per item), 0156 – 0166, 0176 (`INELIGIBLE`) and the Public text paths:
  `MACHINE_ASR` stays excluded.
- No `USER_CONFIRMED` writer; no `transcript_origin` column on Memory; no source rewrite of a `MACHINE_ASR` Memory.
- `background_record_memory_v1` keeps its behaviour except E13's equality condition.
- **Every typed path:** v4 on a typed turn equals v3 in effect; finalize v2 on a typed turn equals its previous behaviour;
  typed Memory Control replies are byte-identical; a model request with no voice source is byte-identical.
- The Orchestrator, the Model Router, the Safety Gate, user isolation and default-deny.
- `UNSUPPORTED_SOURCE_MODALITY` in `conversation-unit-commitment.service.ts` stays.

## 5. Proof

verify-migration-0186 (V-E, V-TM, V-P, V-G, V-OU, V-MC, V-CF, V-CS), the re-pinned verifiers 0151 / 0152 / 0173 / 0028 /
0183, and the jest specs named in the record §4. No paid model run: DeepSeek's quality on M-02 / M-03 is the open condition
PC-D, recorded and not a proof.
