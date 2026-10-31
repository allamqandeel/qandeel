# QANDEEL — S8B-03 Personal Voice Notes — Implementation Record v1

**Task:** S8B-03 — Personal Voice Notes (Stage 8B). This record covers **CP1 — Server & Intelligence**. CP2 (Mobile &
Integration, and S8B-03's closing change) is **not started and not authorized**.
**Status:** `S8B-03 CP1 — SERVER & INTELLIGENCE — DELIVERED ON s8b/s8b-03-cp1 AS A DRAFT PULL REQUEST (2026-10-31) — NOT MERGED (MERGE ONLY ON THE PRODUCT OWNER'S EXPLICIT «ادمج») — S8B-03 NOT CLOSED: CP2 (MOBILE, expo-audio, DEVICE PROOF, THE REMAINING 41 COPY ROWS) NOT STARTED, NOT AUTHORIZED — MIGRATION 0186 NOT HOSTED — ALL FOUR VOICE GATES DISABLED — NO PAID PROVIDER CALL, NO REAL RECORDING, NO PRODUCTION RESOURCE — NOT USER-READY`
**Date:** 2026-10-31
**Branch / base:** `s8b/s8b-03-cp1`, from `main` at `a3b04d7a4340e26ad36e57d89b12f067d7956c99` (the merge of PR #369).
**Authority:** the Product Owner's *S8B-03 CP1 Server & Intelligence — Authorized Implementation* (2026-10-31), which
approved the S8B-03 WP0 Research and Implementation Task Contract **v1.2 FINAL** in full. The contract was delivered to the
Product Owner outside the repository; its binding decisions and the approved texts are recorded here so that they live in
the repository (§1, §2). The controlled amendment this task needs is
[the S8B-03 MACHINE_ASR Fresh Evidence Controlled Amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-03_MACHINE_ASR_FRESH_EVIDENCE_CONTROLLED_AMENDMENT_v1.0.md),
binding from this CP1's merge.

Merging, starting CP2, adding `expo-audio`, opening any voice gate, any paid Speechmatics or DeepSeek call, any real
recording or user data and any hosted or production resource each need the Product Owner's further explicit approval.
None of them is done here.

---

## 1. The Product Owner's approval (2026-10-31), recorded as binding

Approved in full, as written in contract v1.2:

- **D1 … D5:**
  - D1 — `MACHINE_ASR` becomes Fresh Evidence: HIGH and MEDIUM qualify under controls, LOW leaves no durable trace; no
    automatic promotion to `USER_CONFIRMED` and never treated as typed text; correction, forgetting and lapse through
    Truth Maintenance.
  - D2 — the Speechmatics job is deleted after transcription, with governed failure handling, keeping what is technically
    proven apart from what is contractual.
  - D3 — leaving the recording screen stops recording and keeps a private, unsent local draft (CP2).
  - D4 — a transcription failure after upload never loses the recording; attempts are bounded; no false completed message
    and no duplicate turn, reply or provider call.
  - D5 — a real Android device and the iOS Simulator in CI (CP2); what is not proven is recorded as a limit.
- **OD-1 … OD-10:**
  - OD-1 — spoken REMEMBER / CORRECT are kept as `MACHINE_ASR` at the band's confidence; LOW does nothing durable and replies
    C-54; spoken FORGET / DISABLE are never executed in the same turn: a confirmation question first, executed by a typed
    or a HIGH spoken answer; ambiguity goes through the existing clarification; the database enforces it.
  - OD-2 — the original `MACHINE_ASR` source is never rewritten and there is no promotion by text match; an explicit typed
    confirmation is recorded in `memory_typed_confirmations` and shown to the model.
  - OD-3 — Open Understanding runs on voice: HIGH / MEDIUM by the §4.9.3 table; LOW leaves no durable trace from its text,
    with the independent backfill; the database refuses LOW and `USER_STATED` even on a direct call.
  - OD-4 — withdrawal stops new processing, halts the unfinished (job deleted, no text, `HELD_CONSENT`) and deletes no
    recording; reading, deletion and export stay available; the races are tested.
  - OD-5 — deleting a recording deletes the audio only; the text and Memory stay, and correction and forgetting stay available.
  - OD-6 — the draft lives in `Paths.document` under the account, with a narrow backup exclusion (CP2).
  - OD-7 — the picker takes C-12 instead of `false`, under the narrow VA-6 guard (CP2).
  - OD-8 — a 10-minute limit; `HIGH ≥ 0.85`, `MEDIUM ≥ 0.65`, otherwise `LOW`; 3 automatic and 5 total attempts; the
    closed high-impact word rule (K1 – K5, `apps/api/src/voice/asr-confidence/high-impact-words.ts`) failing safe to LOW;
    no calibration claim.
  - OD-9 — a general consent text scoped to voice messages; a new version at S8B-04 for the provider disclosures (VA-11).
  - OD-10 — no paid call now. Later, each separately authorized with a USD 0.05 cap: (a) one Speechmatics smoke at the end
    of CP1, (b) a short Android E2E in CP2. No acceptance criterion depends on them. **Neither was run.**
- **E1 … E13** — the governed brain amendment (§3 below and the controlled amendment).
- **Migration `0186`**, the **CP1 / CP2 split**, **A1 … A27 + A6b**, and the privacy, cost and recovery limits.

**What stays exactly as it was:** no Product decision, no approved text and no gate is changed by CP1. `PC-S1 … PC-S7` and
`PC-D` are **not** proofs; they remain open conditions on a future gate opening (§7).

---

## 2. Product Copy Gate — 19 rows APPROVED verbatim (2026-10-31)

The Product Owner approved these 19 rows **verbatim, Arabic and English**. They are pinned character for character in the
code named beside them and by `tests/s8b-03-personal-voice-notes-contract.test.mjs`. Changing one character is a Copy Gate
change. **The other 41 rows (C-13 … C-53) stay `PROPOSED` and are approved before CP2.**

### 2.1 Consent, version `VOICE_RECORDING_V1` — `apps/api/src/voice-media/voice-consent-text.ts`; installed by `0186`

| ID | Status | العربية | English |
|---|---|---|---|
| C-01 | APPROVED | التسجيل الصوتي في قنديل | Voice recording in Qandeel |
| C-02 | APPROVED | تُحفظ كل رسالة صوتية تُرسل إلى قنديل تسجيلًا صوتيًا. | Each voice message sent to Qandeel is kept as an audio recording. |
| C-03 | APPROVED | تُحفظ التسجيلات 30 يومًا من وصولها إلى قنديل، ثم تُحذف تلقائيًا. ويمكن حذف أي تسجيل قبل ذلك. | Recordings are kept for 30 days after they reach Qandeel, then deleted automatically. Any recording can be deleted sooner. |
| C-04 | APPROVED | يُحوَّل التسجيل إلى نص يفهمه قنديل ويرد عليه، ويمكن الاستماع إليه طوال مدة حفظه. | The recording is converted to text that Qandeel understands and replies to, and it can be listened to while it's kept. |
| C-05 | APPROVED | يبقى النص المستخرج في المحادثة بعد حذف التسجيل أو انتهاء مدته، ويبقى ما تذكّره قنديل منه حتى يُصحَّح أو يُطلب نسيانه. | The transcribed text stays in the conversation after the recording is deleted or expires, and what Qandeel remembers from it stays until it's corrected or forgotten on request. |
| C-06 | APPROVED | يحوّل مزوّد خدمة خارجي الكلام إلى نص، ويطلب قنديل منه حذف التسجيل بعد التحويل مباشرة. | An external service provider converts speech to text, and Qandeel asks it to delete the recording right after conversion. |
| C-07 | APPROVED | قد يلتقط التسجيل أصواتًا قريبة. | A recording may capture nearby voices. |
| C-08 | APPROVED | النسخة التي تُنزَّل أو تُشارَك تخرج من قنديل ولا يمكن استرجاعها. | A downloaded or shared copy leaves Qandeel and cannot be recalled. |
| C-09 | APPROVED | يمكن سحب الموافقة في أي وقت من الإعدادات. سحبها يوقف الرسائل الصوتية الجديدة ولا يحذف التسجيلات الحالية. | Consent can be withdrawn at any time in Settings. Withdrawing it stops new voice messages and doesn't delete existing recordings. |
| C-10 | APPROVED | أوافق وأتابع | Agree and continue |
| C-11 | APPROVED | ليس الآن | Not now |

C-06 makes no no-training or zero-retention claim: both stay a binding operational condition (PC-S7), and the gate does not
open without them.

### 2.2 The native permission — pinned here; used in CP2

| ID | Status | العربية | English |
|---|---|---|---|
| C-12 | APPROVED | يستخدم قنديل الميكروفون عند تسجيل الرسائل الصوتية وأثناء المكالمات، ولا يستخدمه لتشغيل التسجيلات. | Qandeel uses the microphone when recording voice messages and during calls. It isn't used to play recordings. |

C-12 is `NSMicrophoneUsageDescription` and the picker's text (OD-7). CP1 adds no mobile change, so C-12 is pinned in this
record and in the contract test only; CP2 places it in `apps/mobile/locales/ar.json` / `en.json` and the voice guard.

### 2.3 QANDEEL's replies to spoken Memory commands — `apps/api/src/memory/memory-control.copy.ts`

| ID | Status | العربية | English |
|---|---|---|---|
| C-54 | APPROVED | لم تكن الرسالة الصوتية واضحة بما يكفي لتنفيذ هذا الطلب، لذلك لم أغيّر شيئًا. يمكن كتابة الطلب أو تسجيله من جديد. | The voice message wasn't clear enough to act on this request, so I haven't changed anything. The request can be typed or recorded again. |
| C-55 | APPROVED | هل المقصود نسيان {«…»}؟ | Should I forget {“…”}? |
| C-56 | APPROVED | هل المقصود التوقف عن الاعتماد على {«…»}؟ | Should I stop relying on {“…”}? |
| C-57 | APPROVED | هل المقصود تصحيح {«…»} إلى {«…»}؟ | Should I change {“…”} to {“…”}? |

`{«…»}` / `{“…”}` is the named Memory, quoted with the existing `quoteMemory` of the typed path.

### 2.4 Model-facing texts (English only, never shown) — `apps/api/src/memory/machine-asr-model-copy.ts`

| ID | Status | Where | Text |
|---|---|---|---|
| M-01 | APPROVED | every prompt that receives Memories or Evidence | `source MACHINE_ASR: automatically transcribed from the user's voice message; recognition errors are possible, especially in negation, names and numbers; never treat or quote it as words the user typed. confirmedByTyping: the user later confirmed this item explicitly in typed text; its source is still MACHINE_ASR.` |
| M-02 | APPROVED | Open Understanding, a qualifying voice message only | `This message was transcribed automatically from the user's voice (band {HIGH\|MEDIUM}). Recognition errors are possible, especially in negation, names and numbers. Do not propose forgetting anything from it.` |
| M-03 | APPROVED | Open Understanding, a typed message | `confirmedKnown: list a known item only when this typed message explicitly confirms that exact item as true, for example a clear yes to it. Saying the same thing again is a restatement, not a confirmation.` |

M-01 and M-03 are appended **only** when a `MACHINE_ASR` item is present in the request; a request with no voice source is
byte-identical to before (A21).

---

## 3. What CP1 implements

| Area | Where |
|---|---|
| **A — Migration `0186`** | `database/migrations/0186_s8b_03_personal_voice_notes_v1.sql` (forward-only, one transaction) with its substitution module `database/voice-notes-0186-substitutions.mjs` (0183 pattern: every re-created body = its original + declared edits; any undeclared difference fails). The transcription state and attempt tables (RLS, no policy, no grant, erasure census); the 13 transcription definers (`service_role` only); the replayed-begin fix (`ALREADY_ACCEPTED`, BLOCKER-1); the atomic `server_commit_voice_note_turn_v1`; E1 / E2 / E6 / E8 / E9 / E11 / E13; `memory_typed_confirmations`; `voice_private.machine_asr_memory_confidence_v1`; `server_read_memory_command_voice_v1`; the consent text installed verbatim (§2.1); deploy guards: all four gates `DISABLED`, no client role executes a new definer, the `voice_private` function census. |
| **B — Batch port, adapter, worker** | `apps/api/src/voice/batch-transcription-jobs.port.ts` (`BATCH_TRANSCRIPTION_JOBS`); `apps/api/src/voice/speechmatics/speechmatics-batch-jobs.adapter.ts` + `speechmatics-batch.config.ts` (`fetch`, hand-streamed multipart, configurable EU endpoint, `tracking.reference`, json-v2, deletion without `force`, the per-instance rate limit, content-free error classes, `NOT_SENT` distinct from `UNKNOWN`); `apps/api/src/voice/testing/fake-batch-transcription-jobs.ts` (tests only, wired in no module); `apps/api/src/voice/voice-note-transcription.worker.ts` with the deletion sweep; `apps/api/src/voice/voice.module.ts`. `SpeechRecognitionAdapter` is unchanged and has no production binding. |
| **C — M4A duration prover** | `apps/api/src/voice/m4a/m4a-audio-duration.ts` (`proveM4aAudioDuration`, §4.6.2) through `VoiceMediaService.readNoteRange`; `apps/api/src/voice/testing/m4a-fixture.writer.ts` for synthetic fixtures. A refused note is final, uncounted, and never submitted. |
| **D — API and the voice turn** | `apps/api/src/voice-media/voice-notes.controller.ts` / `.service.ts` / `.repository.ts`: `GET /voice/consent`, `POST /voice/consent/grant`, `POST /voice/consent/withdraw`, `GET /voice/capability`, `GET /voice/notes/pending`, `GET /voice/notes/:recordingId/status`, `POST /voice/notes/:recordingId/transcription/retry`, `POST /voice/notes/:recordingId/turn`; the optional `voiceNote` field in conversation history (no key, no band). The committed turn runs through `ConversationService.runCommittedTurn` → the **unchanged** Orchestrator (`voice-note-turn.port.ts`). Each route is classified in the rate-limit census. |
| **E — The governed brain (E1 … E13)** | E1 / E2 / E6 / E8 / E9 / E11 / E13 in `0186`; E3 (`evidence.types.ts`, `evidence.service.ts`, the association provider); E4 (the enrichment SKIP line removed); E5 (source and `confirmedByTyping` at the six model boundaries, M-01 / M-02 / M-03, `ModelRouterMemoryContext`); E6 TS (`personal-understanding-capture.service.ts`, the post-response repository); E7 (a LOW turn feeds no hypothesis and no intent); E8 TS (`memory-control.service.ts` / `.copy.ts` / `.types.ts`, `NOT_HEARD_CLEARLY`); E9 TS (the typed confirmation); E10 (`personal-knowledge.projection.ts`); E12 (LOW runs Open Understanding in backfill only); E13 (`apps/api/src/voice/asr-confidence/machine-asr-confidence.startup-check.ts`). |
| **F — Consent and races** | grant / withdraw / read with the approved text (§2.1); the withdraw / commit and withdraw / running-job races decided by the database (`FOR SHARE`). |
| **Telemetry** | `VOICE_TRANSCRIPTION`, `VOICE_CAPTURE_OPERATION_WITHHELD`, `VOICE_MEMORY_COMMAND_NOT_HEARD`: closed labels, no content, no identifier. |
| **Configuration** | `.env.example` names only (no values): `SPEECHMATICS_API_KEY` (server only), `SPEECHMATICS_BATCH_BASE_URL`, `SPEECHMATICS_RECONCILE_BY_REFERENCE`, `VOICE_API_INSTANCES`, `VOICE_TRANSCRIPTION_CONCURRENCY`, `VOICE_TRANSCRIPTION_WORKER_DISABLED`, `VOICE_ASR_BAND_HIGH`, `VOICE_ASR_BAND_MEDIUM`. No key: the worker stays off and nothing is ever sent. |

---

## 4. Acceptance criteria A1 … A27 + A6b — how each is proven (all free)

`verify-migration-0186.mjs` ran **twice on one database, 28 / 28 sections passing both times** (local PostgreSQL 17,
`0001 … 0186`). The jest specs named below pass. `prove-0186` runs in GitHub CI only (PostgREST + rclone + a loopback fake of
the batch API); GitHub CI is the authority for it.

| ID | Criterion (short) | Proof |
|---|---|---|
| A1 | Replayed upload of an accepted note | verify-0186 V-R1 … R7; `voice-media.spec` (`putStream` 0, `deleteRecording` 0, `acceptNote` 1, deep-equal answer, the race → 404) |
| A2 | Turn and voice source in one transaction | verify-0186 V-C1 / C2 |
| A3 | Idempotent commit: one USER, one ASSISTANT, one router call | verify-0186 V-C3; `conversation.service.spec` (`runCommittedTurn`: one `orchestrate`, no `createTurn`) |
| A4 | Admission bounds and refusals | verify-0186 V-C4 |
| A5 | Through the unchanged Orchestrator; units `VOICE_NOTE` | verify-0186 V-C (the `VOICE_NOTE` / `MACHINE_ASR` unit on real PostgreSQL) + `conversation.service.spec` + `voice-notes.service.spec`. **Declared limit (§6, decision 13):** no real-PostgreSQL Orchestrator harness exists in the repository, so A5 is proven by composition, not by one end-to-end spec. |
| A6 | Logically once, under crashes (the four worker crash scenarios) | `voice-note-transcription.worker.spec` (fake counters: `submit` = 1 in every scenario) + verify-0186 V-T1 … T4 |
| A6b | Adapter classification, `Retry-After`, rate limit, streamed multipart, `findByReference` `UNSUPPORTED`, no content logged | `speechmatics-batch-jobs.adapter.spec` against a loopback HTTP server |
| A7 | 3 automatic / 5 total; duration proof accept / refuse matrix with `submit` = 0 | `m4a-audio-duration.spec` (fixtures from `m4a-fixture.writer.ts`, counted bytes and reads) + worker spec + verify-0186 V-T5 / T6 |
| A8 | External uncertainty: `UNKNOWN` → `OUTCOME_UNKNOWN`, quarantine, adoption, abort after the first byte | worker spec + adapter spec + verify-0186 V-T3 |
| A9 | Ledger: one v3 row per attempt; settlement source; `UNPRICED` | worker spec + verify-0186 V-L1 |
| A10 | By band: HIGH / MEDIUM write `MACHINE_ASR` at 0.90 / 0.75; LOW writes nothing | verify-0186 V-E1 … E6 + the dispatcher, association and capture specs |
| A11 | Truth Maintenance after voice evidence | verify-0186 V-TM1 … TM5 |
| A12 | No automatic promotion | verify-0186 V-P1 … P4 |
| A13 | Matching onboarding, Shared and Public text paths exclude `MACHINE_ASR` | verify-0186 V-G1 / G2 |
| A14 | Open Understanding v4, cell by cell | verify-0186 V-OU1 … OU9 + `s8b-03-voice-capture.spec` |
| A15 | Source at the model boundary; M-01 / M-02 / M-03 verbatim | the three `deepseek-hypothesis-*` provider specs and the capture spec inspect the **outgoing** payload; `s8b-03-memory-context.spec` (reply); the knowledge projection |
| A16 | Spoken Memory commands, cell by cell | verify-0186 V-MC1 … MC9 + `s8b-03-voice-memory-control.spec` |
| A17 | Erasure | verify-0186 V-X + verify-0183 A11 (re-pinned) |
| A18 | No text, audio, key, job id or uncertain words in logs and telemetry | the contract test + `observability.spec` |
| A19 | 24 MiB streamed within 16 MiB held | prove-0186 P02 (**CI only**) |
| A20 | Four gates `DISABLED`; consent text = the approved digest; no client role executes a new definer | deploy guards + verify-0186 C0a / C0b + verify-0183 S0c (re-pinned) |
| A21 | Typed paths unchanged | verify-0183 A1 + verify-0173 + verify-0152 (re-pinned) + the frozen contracts; typed Memory Control replies byte-identical |
| A22 | The typed confirmation | verify-0186 V-CF1 … CF6 + spec |
| A23 | Band classification fixtures; thresholds; `NO_SPEECH`; refused start | `asr-confidence.spec` |
| A24 | Consent races | verify-0186 V-RC1 / RC2 + V-RC3 (two connections) + prove-0186 P03 (CI) + `voice-notes.service.spec` |
| A25 | Deletion order through the port | worker spec (fake clock) + adapter spec (200 / 404 / 410 / 423 / 429) + verify-0186 V-D1 … D4 |
| A26 | Person labels from voice: HIGH only, never with an uncertain word | verify-0186 V-OU10 / OU11 |
| A27 | The confidence is the band's constant and cannot be forged | verify-0186 V-CS1 … CS5 + `machine-asr-confidence.startup-check.spec` |

**Re-pinned verifiers** (dated, to the declared successors): `verify-migration-0183` (20 / 20), `0185` (3 / 3), `0151`,
`0152`, `0173`, `0028`, all passing on `0001 … 0186`. **Re-anchored contracts** (contract §5.8; each with a
dated note naming the difference): the four current-task pins (S5-03B, S5-03C, S7-03, S7-04: the current task is S8B-03,
S8B-02 beneath it); `s8b-02-voice-foundation` (0186 follows 0185; E4 removed the SKIP line; `fetch` / the environment only
in `voice/speechmatics/`, imported only by `voice.module.ts`; `FakeBatchTranscriptionJobs` composed nowhere); AI-COST-01
(the three hypothesis adapters and the capture adapter re-pinned for E5; the committed voice turn's attribution, with a new
planted defect); the Live-Focus cutover and SP-LH delivery (3 → 4 orchestrated paths); historical-projection (the
generator's `base` + M-01); INTEL-TM-01 (0186 re-creates L1 once, E2, and nothing else of L1 / L3); W3-MEGA-M (exactly one
`VOICE_MEMORY_COMMAND_NOT_HEARD` line after a finalized Memory-control turn). **New:**
`tests/s8b-03-personal-voice-notes-contract.test.mjs` (the 19 rows verbatim across this record, the code and 0186's
consent text and digests; the gates; the CI wiring; the key server-only; no logging; no mobile surface), registered in
`package.json` and API CI.

---

## 5. Declared engineering decisions (inside the approved contract)

1. **One refusal code:** every direct definer call that breaks a voice rule (a LOW turn, a forged confidence, a spoken
   answer from a non-HIGH turn, a confirmation from a voice turn) raises SQLSTATE `22023`, as E8 / E13 name it; nothing
   new uses `PT409`.
2. **E13 read definer:** the band constant is read from `voice_private.machine_asr_memory_confidence_v1` through a
   `service_role` definer; the startup check compares it with P-1 and **runs only when the worker is enabled**.
3. **Adapter classification** follows A6b exactly; a timeout after the first body byte is `UNKNOWN`, never `NOT_SENT`.
4. **Attempt limits live only in the database policy** (3 automatic, 5 total); the worker never counts.
5. **The ledger is settled right after the database outcome, before the provider deletion.** Residual: a crash between the
   two leaves the call `PENDING` until the existing ledger sweep.
6. **E11 retry:** when the database refuses a person label (an uncertain word, or a non-HIGH band), the capture is retried
   once **without the items about other people** (`withoutOtherPeople`); each dropped item is counted as
   `VOICE_CAPTURE_OPERATION_WITHHELD`.
7. **Typed-path byte invariance:** M-01 / M-03 are appended only when a `MACHINE_ASR` item is present.
8. **The voice turn route** commits through the database first, then runs `runCommittedTurn`; a replay returns the stored
   reply. Under test the foreground work gate is inactive, as it is for typed turns.
9. **The history `voiceNote` read is not fail-soft:** a failed read fails the history request, never omits the field.
10. **The memory-command voice read** (`server_read_memory_command_voice_v1`): one extra read **only** when a Memory command
    is planned on a turn; ordinary turns read nothing. A failed read fails the turn closed.
11. **C-57 is wired but unreachable** by the current grammar: a CORRECT clarification always has two or more options, so the
    single-option voice correction question is not produced today (§6).
12. **C-12 is pinned in documents only** in CP1 (§2.2).
13. **A5 by composition:** see §4.

---

## 6. Residual limits (CP1)

- **prove-0186** (A19, A24 live, wire refusals) runs only in GitHub CI; it is not runnable on the local harness.
- **A5** is proven by composition (real-PostgreSQL unit + Orchestrator spec), not one end-to-end real-PostgreSQL spec.
- **C-57** is unreachable by the current grammar (decision 11); it stays pinned and tested at the copy level.
- **Ledger `PENDING` window** between settlement and a crash (decision 5).
- **No live provider behaviour is proven.** Every adapter proof is a loopback fake; every DeepSeek proof is a recorded
  payload, not a model answer.
- **Not user-ready:** no client surface, no recorder, no `expo-audio`, no device proof (all CP2), and every gate is closed.

---

## 7. Open external proof conditions — NOT proofs (contract §8.4)

These do not block CP1 or CP2. Each **must** be closed before any voice gate opens; until then the safe behaviour holds.

| # | Condition | Safe behaviour until closed | Owner if not closed |
|---|---|---|---|
| PC-S1 / S1b | The provider's real deletion behaviour (200 / 404 / 410 / 423) and its verification | 423 retried; 404 / 410 `PROVIDER_ABSENT`; never `force` | A gate-opening condition (S8B-08) |
| PC-S2 | `tracking.reference` survives and the job list is complete | No reconciliation; quarantine and the counted user retry | The conservative path stays if never proven |
| PC-S3 | `ar_en` + `enhanced` accepted in Batch | `PROVIDER_CONFIG_REJECTED` | A gate-opening condition |
| PC-S4 | The job duration in json-v2 vs the local proof, on a real file | The locally proven duration for the ledger; `PROVIDER_DURATION_DISAGREEMENT` over one second | Does not block a merge; a proven live disagreement blocks the gate until explained |
| PC-S5 | Per-word confidence and its scale | Absent → LOW | A gate-opening condition (without it everything is LOW) |
| PC-S6 | The Batch EU endpoint | Configuration; the gate stays closed | A gate-opening condition |
| PC-S7 | No training and retention on the production account | The gate stays closed | S8B-08 |
| PC-D | DeepSeek quality on M-02 / M-03 | Server behaviour proven free; the possible error is bounded (§4.9.5) | Recorded, does not block closure |

Closing any of them needs a separately authorized live run (OD-10) or the production account set-up. None was run.

---

## 8. Not done, and the state left

- **CP2 is not started** (mobile recorder, `expo-audio`, the voice guard with C-12, the 41 remaining copy rows, the
  device proof B1 … B14, S8B-03's closing change). It needs the Product Owner's explicit authorization.
- **The four voice gates** — `PERSONAL_LIVE_CALL`, `PERSONAL_VOICE_NOTE`, `REPLAY_AUDIO_DISTRIBUTION`,
  `SHARED_VOICE_NOTE` — are **`DISABLED`**, asserted by the 0186 deploy guard and verify-0186.
- **Migration `0186` is not hosted**; no hosted or production resource was touched (`QAN-BL-PROD-08` unchanged).
- **No paid call**: no Speechmatics and no DeepSeek request was made; no real recording or user data was used.
- **S8B-03 is not closed.** `QAN-BL-VOICE-01` stays worked but not delivered.
