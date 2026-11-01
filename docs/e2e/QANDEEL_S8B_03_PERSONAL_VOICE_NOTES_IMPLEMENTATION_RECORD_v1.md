# QANDEEL — S8B-03 Personal Voice Notes — Implementation Record v1

**Task:** S8B-03 — Personal Voice Notes (Stage 8B). This record covers **CP1 — Server & Intelligence** (§1 … §8, merged)
and **CP2 — Mobile & Integration, S8B-03's closing change** (§9 … §14).
**Status:** `S8B-03 CLOSED / READY FOR THE PRODUCT OWNER'S MERGE DECISION (2026-10-31, the CP2 closing change; §9 … §14) — CP1 MERGED THROUGH PR #370 AS e68ca146 — CP2 ON s8b/s8b-03-cp2 AS A DRAFT PULL REQUEST, NOT MERGED (MERGE ONLY ON THE PRODUCT OWNER'S EXPLICIT «ادمج») — MIGRATION 0186 NOT HOSTED — ALL FOUR VOICE GATES DISABLED — NO PAID PROVIDER CALL, NO PRODUCTION RESOURCE — NOT USER-READY`
**Date:** 2026-10-31
**Branch / base:** CP1 `s8b/s8b-03-cp1`, from `main` at `a3b04d7a4340e26ad36e57d89b12f067d7956c99` (the merge of PR #369),
merged through PR #370 as `e68ca146`; CP2 `s8b/s8b-03-cp2`, from `main` at `e68ca146`.
**Authority:** the Product Owner's *S8B-03 CP1 Server & Intelligence — Authorized Implementation* (2026-10-31), which
approved the S8B-03 WP0 Research and Implementation Task Contract **v1.2 FINAL** in full. The contract was delivered to the
Product Owner outside the repository; its binding decisions and the approved texts are recorded here so that they live in
the repository (§1, §2). The controlled amendment this task needs is
[the S8B-03 MACHINE_ASR Fresh Evidence Controlled Amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-03_MACHINE_ASR_FRESH_EVIDENCE_CONTROLLED_AMENDMENT_v1.0.md),
binding from this CP1's merge. CP2's authority is the Product Owner's CP2 authorization with the approval of
C-13 … C-53 (2026-10-31) and the later CP2 design decisions (§9).

Merging, opening any voice gate, any paid Speechmatics or DeepSeek call (OD-10), any real user data and any hosted or
production resource each need the Product Owner's further explicit approval. None of them is done here.

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

## 2. Product Copy Gate — 60 rows APPROVED verbatim (2026-10-31): Copy Gate CLOSED

The Product Owner approved these rows **verbatim, Arabic and English**: the 19 of §2.1 … §2.4 with CP1, and C-13 … C-53
(§2.5) before CP2. They are pinned character for character in the code named beside them and by
`tests/s8b-03-personal-voice-notes-contract.test.mjs`. Changing one character is a Copy Gate change. No row is `PROPOSED`.

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

### 2.2 The native permission — pinned with CP1; placed by CP2

| ID | Status | العربية | English |
|---|---|---|---|
| C-12 | APPROVED | يستخدم قنديل الميكروفون عند تسجيل الرسائل الصوتية وأثناء المكالمات، ولا يستخدمه لتشغيل التسجيلات. | Qandeel uses the microphone when recording voice messages and during calls. It isn't used to play recordings. |

C-12 is `NSMicrophoneUsageDescription` and the picker's text (OD-7). CP1 pinned it in documents only; CP2 places it in
`apps/mobile/src/voice-note/voice-note-copy.ts` (the one source), `apps/mobile/app.json` (the `expo-audio` and
`expo-image-picker` plugin options) and `apps/mobile/locales/ar.json` / `en.json` (iOS `InfoPlist.strings`), checked by the
native voice gate `apps/mobile/scripts/verify-voice-note-native.mjs` (§10).

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

### 2.5 The Voice Note's words (CP2) — `apps/mobile/src/voice-note/voice-note-copy.ts`

Approved verbatim on 2026-10-31 with the CP2 authorization (contract v1.2 §7.3 … §7.6). The shipped rows were compared
with the contract character for character before this record was written: 41 rows, 0 differences. `{date}` (C-40) is the date the app inserts.

| ID | Status | العربية | English |
|---|---|---|---|
| C-13 | APPROVED | رسالة صوتية | Voice message |
| C-14 | APPROVED | جارٍ التسجيل | Recording |
| C-15 | APPROVED | إلغاء التسجيل | Cancel recording |
| C-16 | APPROVED | إرسال الرسالة الصوتية | Send voice message |
| C-17 | APPROVED | توقّف التسجيل عند مغادرة شاشة المحادثة، وحُفظ مسودةً على هذا الجهاز. | Recording stopped when the conversation screen was left. It's saved as a draft on this device. |
| C-18 | APPROVED | توقّف التسجيل بسبب مقاطعة صوتية، وحُفظ مسودةً على هذا الجهاز. | Recording stopped because of an audio interruption. It's saved as a draft on this device. |
| C-19 | APPROVED | بلغ التسجيل الحد الأقصى للمدة، وحُفظ مسودةً. | The recording reached its maximum length and was saved as a draft. |
| C-20 | APPROVED | حذف المسودة | Delete draft |
| C-21 | APPROVED | الميكروفون غير متاح لقنديل. الكتابة متاحة. | The microphone isn't available to Qandeel. Writing is available. |
| C-22 | APPROVED | فتح الإعدادات | Open Settings |
| C-23 | APPROVED | تعذّرت استعادة المسودة. | The draft couldn't be restored. |
| C-24 | APPROVED | جارٍ إرسال الرسالة الصوتية | Sending voice message |
| C-25 | APPROVED | لم تُرسَل الرسالة الصوتية. ما زالت محفوظة على هذا الجهاز. | The voice message wasn't sent. It's still saved on this device. |
| C-26 | APPROVED | إعادة المحاولة | Try again |
| C-27 | APPROVED | جارٍ تحويل الرسالة إلى نص | Converting the message to text |
| C-28 | APPROVED | تعذّر تحويل الرسالة إلى نص الآن. التسجيل محفوظ. | The message couldn't be converted to text right now. The recording is saved. |
| C-29 | APPROVED | تعذّر تحويل هذه الرسالة إلى نص. يمكن الاستماع إليها أو حذفها، والكتابة متاحة. | This message couldn't be converted to text. It can be listened to or deleted, and writing is available. |
| C-30 | APPROVED | لم يُتعرَّف على كلام في هذه الرسالة. | No speech was recognized in this message. |
| C-31 | APPROVED | الرسائل الصوتية غير متاحة الآن. الكتابة متاحة. | Voice messages aren't available right now. Writing is available. |
| C-32 | APPROVED | تحتاج الرسائل الصوتية إلى الموافقة على التسجيل. | Voice messages need consent to recording. |
| C-33 | APPROVED | لم تُعالَج هذه الرسالة لأن الموافقة على التسجيل مسحوبة. التسجيل محفوظ. | This message wasn't processed because recording consent was withdrawn. The recording is saved. |
| C-34 | APPROVED | تشغيل الرسالة الصوتية / إيقاف الرسالة الصوتية مؤقتًا | Play voice message / Pause voice message |
| C-35 | APPROVED | اعرض النص / أخفِ النص | Show text / Hide text |
| C-36 | APPROVED | نص مستخرج آليًا، وقد يحتوي على أخطاء | Automatically transcribed text; it may contain errors |
| C-37 | APPROVED | انتهت مدة الاحتفاظ بالتسجيل | The recording's retention period has ended |
| C-38 | APPROVED | حُذف التسجيل | The recording was deleted |
| C-39 | APPROVED | تعذّر تشغيل الرسالة الآن | The message can't be played right now |
| C-40 | APPROVED | متاحة حتى {date} | Available until {date} |
| C-41 | APPROVED | حذف التسجيل | Delete recording |
| C-42 | APPROVED | سيُحذف التسجيل الصوتي نهائيًا. يبقى النص المستخرج في المحادثة، ويبقى ما تذكّره قنديل منه حتى يُصحَّح أو يُطلب نسيانه. | The voice recording will be deleted permanently. The transcribed text stays in the conversation, and what Qandeel remembers from it stays until it's corrected or forgotten on request. |
| C-43 | APPROVED | حذف / إلغاء | Delete / Cancel |
| C-44 | APPROVED | الرسائل الصوتية | Voice messages |
| C-45 | APPROVED | تُحفظ التسجيلات الصوتية 30 يومًا من وصولها إلى قنديل، ثم تُحذف تلقائيًا. | Voice recordings are kept for 30 days after they reach Qandeel, then deleted automatically. |
| C-46 | APPROVED | سحب الموافقة على التسجيل | Withdraw recording consent |
| C-47 | APPROVED | لن تُرسل رسائل صوتية جديدة، ولن تُعالَج الرسائل التي لم يكتمل تحويلها إلى نص. تبقى التسجيلات الحالية متاحة للاستماع والحذف والحفظ حتى انتهاء مدتها. | New voice messages can't be sent, and messages not yet converted to text won't be processed. Existing recordings stay available to listen to, delete and save until their period ends. |
| C-48 | APPROVED | الموافقة على التسجيل مسحوبة | Recording consent withdrawn |
| C-49 | APPROVED | حفظ التسجيلات الصوتية | Save voice recordings |
| C-50 | APPROVED | حُفظت التسجيلات الصوتية | Voice recordings saved |
| C-51 | APPROVED | تعذّر حفظ التسجيلات الصوتية، وحُذفت الملفات التي بدأ حفظها. | Voice recordings couldn't be saved, and the files that had started saving were removed. |
| C-52 | APPROVED | بعض التسجيلات لم تعد متاحة. | Some recordings are no longer available. |
| C-53 | APPROVED | تعذّر حفظ التسجيلات الصوتية. قد تبقى بعض الملفات في المجلد المختار، ويمكن حذفها منه. | Voice recordings couldn't be saved. Some files may remain in the chosen folder and can be deleted from there. |

---

## 3. What CP1 implements

| Area | Where |
|---|---|
| **A — Migration `0186`** | `database/migrations/0186_s8b_03_personal_voice_notes_v1.sql` (forward-only, one transaction) with its substitution module `database/voice-notes-0186-substitutions.mjs` (0183 pattern: every re-created body = its original + declared edits; any undeclared difference fails). The transcription state and attempt tables (RLS, no policy, no grant, erasure census); the 13 transcription definers (`service_role` only), plus the read-only `server_list_voice_note_unsettled_attempts_v1` added by the PR #370 review (decision 5); the replayed-begin fix (`ALREADY_ACCEPTED`, BLOCKER-1); the atomic `server_commit_voice_note_turn_v1`; E1 / E2 / E6 / E8 / E9 / E11 / E13; `memory_typed_confirmations`; `voice_private.machine_asr_memory_confidence_v1`; `server_read_memory_command_voice_v1`; the consent text installed verbatim (§2.1); deploy guards: all four gates `DISABLED`, no client role executes a new definer, the `voice_private` function census. |
| **B — Batch port, adapter, worker** | `apps/api/src/voice/batch-transcription-jobs.port.ts` (`BATCH_TRANSCRIPTION_JOBS`); `apps/api/src/voice/speechmatics/speechmatics-batch-jobs.adapter.ts` + `speechmatics-batch.config.ts` (one `node:https` POST of a hand-streamed multipart body under backpressure, `fetch` for the reads, configurable EU endpoint, `tracking.reference`, json-v2, deletion without `force`, the per-instance rate limit, content-free error classes, `NOT_SENT` distinct from `UNKNOWN`); `apps/api/src/voice/testing/fake-batch-transcription-jobs.ts` (tests only, wired in no module); `apps/api/src/voice/voice-note-transcription.worker.ts` with the deletion sweep and the ledger recovery sweep (decision 5); `apps/api/src/voice/voice.module.ts`. `SpeechRecognitionAdapter` is unchanged and has no production binding. |
| **C — M4A duration prover** | `apps/api/src/voice/m4a/m4a-audio-duration.ts` (`proveM4aAudioDuration`, §4.6.2) through `VoiceMediaService.readNoteRange`; `apps/api/src/voice/testing/m4a-fixture.writer.ts` for synthetic fixtures. A refused note is final, uncounted, and never submitted. |
| **D — API and the voice turn** | `apps/api/src/voice-media/voice-notes.controller.ts` / `.service.ts` / `.repository.ts`: `GET /voice/consent`, `POST /voice/consent/grant`, `POST /voice/consent/withdraw`, `GET /voice/capability`, `GET /voice/notes/pending`, `GET /voice/notes/:recordingId/status`, `POST /voice/notes/:recordingId/transcription/retry`, `POST /voice/notes/:recordingId/turn`; the optional `voiceNote` field in conversation history (no key, no band). The committed turn runs through `ConversationService.runCommittedTurn` → the **unchanged** Orchestrator (`voice-note-turn.port.ts`). Each route is classified in the rate-limit census. |
| **E — The governed brain (E1 … E13)** | E1 / E2 / E6 / E8 / E9 / E11 / E13 in `0186`; E3 (`evidence.types.ts`, `evidence.service.ts`, the association provider); E4 (the enrichment SKIP line removed); E5 (source and `confirmedByTyping` at the six model boundaries, M-01 / M-02 / M-03, `ModelRouterMemoryContext`); E6 TS (`personal-understanding-capture.service.ts`, the post-response repository); E7 (a LOW turn feeds no hypothesis and no intent); E8 TS (`memory-control.service.ts` / `.copy.ts` / `.types.ts`, `NOT_HEARD_CLEARLY`); E9 TS (the typed confirmation); E10 (`personal-knowledge.projection.ts`); E12 (LOW runs Open Understanding in backfill only); E13 (`apps/api/src/voice/asr-confidence/machine-asr-confidence.startup-check.ts`). |
| **F — Consent and races** | grant / withdraw / read with the approved text (§2.1); the withdraw / commit and withdraw / running-job races decided by the database (`FOR SHARE`). |
| **Telemetry** | `VOICE_TRANSCRIPTION`, `VOICE_CAPTURE_OPERATION_WITHHELD`, `VOICE_MEMORY_COMMAND_NOT_HEARD`: closed labels, no content, no identifier. |
| **Configuration** | `.env.example` names only (no values): `SPEECHMATICS_API_KEY` (server only), `SPEECHMATICS_BATCH_BASE_URL`, `SPEECHMATICS_RECONCILE_BY_REFERENCE`, `VOICE_API_INSTANCES`, `VOICE_TRANSCRIPTION_CONCURRENCY`, `VOICE_TRANSCRIPTION_WORKER_DISABLED`, `VOICE_ASR_BAND_HIGH`, `VOICE_ASR_BAND_MEDIUM`. No key: the worker stays off and nothing is ever sent. |

---

## 4. Acceptance criteria A1 … A27 + A6b — how each is proven (all free)

`verify-migration-0186.mjs` ran **twice on one database, 29 / 29 sections passing both times** (28 at the first delivery; V-L2 added by the PR #370 review) (local PostgreSQL 17,
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
| A9 | Ledger: one v3 row per attempt; settlement source; `UNPRICED` | worker spec (incl. the recovery sweep) + verify-0186 V-L1 / V-L2 |
| A10 | By band: HIGH / MEDIUM write `MACHINE_ASR` at 0.90 / 0.75; LOW writes nothing | verify-0186 V-E1 … E6 + the dispatcher, association and capture specs |
| A11 | Truth Maintenance after voice evidence | verify-0186 V-TM1 … TM5 |
| A12 | No automatic promotion | verify-0186 V-P1 … P4 |
| A13 | Matching onboarding, Shared and Public text paths exclude `MACHINE_ASR` | verify-0186 V-G1 / G2 |
| A14 | Open Understanding v4, cell by cell | verify-0186 V-OU1 … OU9 + `s8b-03-voice-capture.spec` |
| A15 | Source at the model boundary; M-01 / M-02 / M-03 verbatim | the three `deepseek-hypothesis-*` provider specs and the capture spec inspect the **outgoing** payload; `s8b-03-memory-context.spec` (reply); the knowledge projection |
| A16 | Spoken Memory commands, cell by cell | verify-0186 V-MC1 … MC9 + `s8b-03-voice-memory-control.spec` |
| A17 | Erasure | verify-0186 V-X + verify-0183 A11 (re-pinned) |
| A18 | No text, audio, key, job id or uncertain words in logs and telemetry | the contract test + `observability.spec` |
| A19 | 24 MiB streamed within 16 MiB held | prove-0186 P02 (**CI only**); the regression in `speechmatics-batch-jobs.adapter.spec` (fresh chunks, live ArrayBuffer memory, a held control) |
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
5. **The ledger is settled right after the database outcome, before the provider deletion; a settlement that did not land
   is recovered from durable facts** (PR #370 review, 2026-10-31). A failed or crashed `settle` no longer leaves the call
   `PENDING` for good: each worker cycle reads, through the read-only `service_role` definer
   `server_list_voice_note_unsettled_attempts_v1` (bounded: grace 60 s … 1 day, at most 100 rows; the worker uses 15 minutes
   and 20), the terminal attempts whose call is still `PENDING`, and settles each through the same
   `settle_ai_provider_call_v2`. Only durable facts are used and **the provider is never asked again**: a transcript the
   provider returned (`SUCCEEDED`, or `FAILED` with `TRANSCRIPT_TOO_LONG`) settles `SUCCEEDED` with the duration proven
   locally before submission, labelled `GATEWAY_MEASURED` (D-2) — the provider's own duration is not durable, so a
   recovered row is never `PROVIDER_REPORTED`; every other end settles `FAILED` with usage `ABSENT` (`FAILED_USAGE_UNKNOWN`,
   unpriced). A transcript without a proven duration is not invented: the row stays `PENDING` (integrity signal). The
   ledger's own digest makes a replay `ALREADY_SETTLED`; a different settlement that landed first stands (`PT409`), so
   nothing is counted twice. No new cost table, state or rating rule. Proven by verify-0186 V-L2 and the worker spec.
6. **E11 retry:** when the database refuses a person label (an uncertain word, or a non-HIGH band), the capture is retried
   once **without the items about other people** (`withoutOtherPeople`); each dropped item is counted as
   `VOICE_CAPTURE_OPERATION_WITHHELD`.
7. **Typed-path byte invariance:** M-01 / M-03 are appended only when a `MACHINE_ASR` item is present.
8. **The voice turn route** commits through the database first, then runs `runCommittedTurn`; a replay returns the stored
   reply. Under test the foreground work gate is inactive, as it is for typed turns.
9. **The history `voiceNote` read is not fail-soft:** a failed read fails the history request, never omits the field.
10. **The memory-command voice read** (`server_read_memory_command_voice_v1`): one extra read **only** when a Memory command
    is planned on a turn; ordinary turns read nothing. A failed read fails the turn closed.
11. **C-57 is wired but unreachable** (re-verified for the PR #370 review, 2026-10-31). The approved E8 table (§4.9.4)
    gives a spoken CORRECT no confirmation of its own: a single clear target is `CORRECTED` at the band's score, an
    ambiguous one asks *the existing clarification*. `memory-control.service.ts` builds a CORRECT clarification only
    from `AMBIGUOUS` (two or three options; `PARTIAL` is ordinary talk for a correction), so the one-option question
    with the old and the new words is never asked. The one place a CORRECT clarification can carry one option — asking
    again after an out-of-range answer when the other options were removed meanwhile — repeats the existing question
    without the new words, as the table says. No scenario the contract requires is missing, so no question was
    invented; C-57 stays pinned and tested at the copy level (§6).
12. **C-12 is pinned in documents only** in CP1 (§2.2).
13. **A5 by composition:** see §4.

---

### 5.1 PR #370 review fixes (2026-10-31)

- **API CI, `test:full-intelligence-e2e-smoke-adapters`:** the smoke harness's foreground SQL translator refused the read
  `MemoryRepository` makes since E9 (the subject embed followed by `memory_typed_confirmations(memory_id)`). It now accepts
  that one further embed, pinned exactly, only directly after the subject embed, on `memories`, as the last item, and
  translates it to a correlated array (`[]` without a row) under the caller's RLS. Columns, order and every other refusal
  are unchanged; no production code changed. Its test proves the shape and the isolation on real PostgreSQL.
- **Ledger recovery:** decision 5. **C-57:** decision 11 (truth recorded, no code change).
- **A19, prove-0186 P02 on `a1536702`:** 25 176 823 bytes held against the 16 MiB bound. Measured apart (24 MiB, Node 24,
  the A19 instrument: live `arrayBuffers` after two collections): the S3 read alone 0.08 MiB; the upload alone, to a fake
  in ANOTHER process, 23.18 MiB; S3 → upload → in-process fake 23.51 MiB. `fetch` read at most 0.62 MiB ahead of the wire,
  but kept every chunk it had sent reachable until the request ended - so the old "ahead of the wire" spec (one reused
  chunk) could not see it. `submit` now writes ONE `node:http(s)` POST itself: nothing before the connection and TLS are
  up (node's certificate and host checks, never relaxed), `drain` between chunks, the exact `Content-Length`, not one
  byte past the declared size, the first answer stops the writing, the same signal, and the same NOT_SENT / UNKNOWN /
  REJECTED / CREATED classification with no retry. After: 0.06 MiB (upload alone), 0.21 MiB (S3 → upload → fake). The
  bound and A19 are unchanged; the new spec regression fails on the old adapter (25 133 426 bytes) and passes on the new.

## 6. Residual limits (CP1, as they stood at its merge; CP2 closes the client-side ones, §11 … §12)

- **prove-0186** (A19, A24 live, wire refusals) runs only in GitHub CI; it is not runnable on the local harness.
- **A5** is proven by composition (real-PostgreSQL unit + Orchestrator spec), not one end-to-end real-PostgreSQL spec.
- **C-57** is unreachable by the current grammar (decision 11); it stays pinned and tested at the copy level.
- **Ledger `PENDING` window:** a call whose settlement did not land stays `PENDING` for the grace (15 minutes) and until a
  worker cycle runs; it is then settled from durable facts (decision 5). Only while every worker is off does it stay
  `PENDING` (visible in the stale-pending summary).
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

Closing any of them needs a separately authorized live run (OD-10) or the production account set-up. None was run. At
S8B-03's closure they are admitted together as `QAN-BL-VOICE-02`, owned by S8B-08 as gate-opening conditions (§13).

---

## 8. CP1: not done, and the state left at its merge (historical; S8B-03's closing state is §14)

- **CP2 was not started at CP1's merge** (mobile recorder, `expo-audio`, the voice guard with C-12, the 41 remaining copy rows, the
  device proof B1 … B14, S8B-03's closing change); it was authorized later the same day (§9).
- **The four voice gates** — `PERSONAL_LIVE_CALL`, `PERSONAL_VOICE_NOTE`, `REPLAY_AUDIO_DISTRIBUTION`,
  `SHARED_VOICE_NOTE` — are **`DISABLED`**, asserted by the 0186 deploy guard and verify-0186.
- **Migration `0186` is not hosted**; no hosted or production resource was touched (`QAN-BL-PROD-08` unchanged).
- **No paid call**: no Speechmatics and no DeepSeek request was made; no real recording or user data was used.
- **S8B-03 was not closed by CP1.** `QAN-BL-VOICE-01` stayed worked but not delivered.

---

## 9. CP2 — the Product Owner's authorization and decisions (2026-10-31), recorded as binding

CP2 is S8B-03's closing change: contract v1.2 §5.6, §5.7, §7, §8.2 (B1 … B14 and the closure items), §8.3, §8.4 and
OD-1 … OD-10, from `main` at `e68ca146` (CP1 merged through PR #370).

| # | Decision | Where it binds |
|---|---|---|
| CP2-1 | **CP2 authorized**, with **C-13 … C-53 APPROVED verbatim**, Arabic and English (§2.5). The Copy Gate is closed: 60 / 60 rows. | `voice-note-copy.ts`; this record; the contract test |
| CP2-2 | **Proof recordings:** "Unblock mic, quiet room" on the Product Owner's Android phone. Phone recordings are proof only: deleted, never committed. Repository fixtures are silence from a device with no input (§11, B5). | §11 |
| CP2-3 | **The screen stays on while recording** (`expo-keep-awake`, held only while a capture is `RECORDING`). | `voice-note-recorder-port.ts` (`createCaptureScreenHold`) |
| CP2-4 | **The recording controls and the slab:** the P4-C3 composition, with P2 as the glyph authority — P2's `mic` (24 px, and 20 px with P2's stroke for that size), its recording state and P2's utility `close`, ported as neutral drawing names (contract §5.7.3). | `Glyph.tsx`, `canonical-visual.generated.ts`, `VoiceNoteViews.tsx` |
| CP2-5 | **The player speaks the Timeline language:** P2 §7 Temporal Spine + Aperture C "Parting" (`P2_SPINE`, `Aperture`), simplified for a message — the Spine hairline, the heard part from START, the committed Parting as the position, tap or 1:1 drag to seek with a preview Parting, release commits, a cancelled drag changes nothing, one logical RTL mirror. Moment notches, the Live Edge and Replay's chrome are not taken. | `VoiceNoteViews.tsx` |
| CP2-6 | **The Timeline design APPROVED** as captured in Arabic and English on Android ("S8B-03 CP2 — Voice Note Timeline Design Approval"); no further visual change. **Screen-reader step:** a message shorter than 30 s moves 1 s per increment / decrement, one of 30 s or more 5 s, always inside the recording's bounds. Recorded here, inside CP2, with no new design phase or cycle. | `voiceNoteSeekStepMs` (`VOICE_NOTE_SHORT_SEEK_STEP_MS` 1000, `VOICE_NOTE_LONG_SEEK_STEP_MS` 5000, `VOICE_NOTE_LONG_RECORDING_MS` 30 000) and its tests |

The Product Owner's standing limits for CP2, all kept: the four voice gates stay `DISABLED`; no paid call (OD-10 not
run, not even under USD 0.05); no production database or app deployment; migration `0186` and the brain contracts
unchanged; Conversation and Export not rebuilt; no approved text changed; no CP3; no merge without «ادمج».

---

## 10. What CP2 implements

| Component | Where |
|---|---|
| **Dependencies and native configuration** | `expo-audio ~57.0.4` (57.0.5 locked), `expo-keep-awake ~57.0.1`; the `expo-audio` plugin with `microphonePermission` = C-12 and **background recording and background playback both off**; `expo-image-picker`'s `microphonePermission` = C-12 instead of `false` (OD-7: the picker asks for images only and never launches a camera); `apps/mobile/locales/ar.json` / `en.json` carry C-12 for iOS. No `UIBackgroundModes`, no `FOREGROUND_SERVICE*`. |
| **A — The recorder** | `recording-options.ts` (Android `mpeg4` / `aac`; iOS `MPEG4AAC`; one channel, 32 000 bps, 16 000 Hz), `voice-note-recorder-port.ts` (the expo-audio port: permission at the moment of intent with `canAskAgain`, the input read after `record()`, the screen hold), `voice-note-capture.ts` (start only while the conversation is in front; stop on the reader's stop, on leaving the screen in-app, on the background, on an interruption or a route change, and at the 10-minute limit, each keeping the draft; cancel discards), `voice-note-limits.ts`. |
| **B — The draft store (OD-6)** | `voice-draft-store.ts`: `Paths.document/qandeel-voice-drafts/<accountId>/<draftId>.m4a` and `expo-sqlite/kv-store` (`qandeel-voice-drafts.db`) under the account; never `cache` as a store; start-up recovery adopts a finished recorder file or removes an unrecoverable one; deleted on a confirmed `ACCEPTED`, a discard or a confirmed account deletion; kept over sign-out and shown to its owner only. `m4a-draft-check.ts` checks a draft's container is complete. **Backup exclusion:** Android — the local module `modules/qandeel-backup-exclusion` ships `qandeel_backup_rules.xml` / `qandeel_data_extraction_rules.xml` (the drafts folder, the recorder's `Audio/` folder and the drafts database with its `-wal` / `-shm` / `-journal`, for full backup, cloud backup and device transfer), wired on `<application>` by `plugins/with-qandeel-voice-backup.js` (a manifest mod only, no dangerous mod); iOS — the module's `QandeelBackupExclusion` sets and reads back `NSURLIsExcludedFromBackupKey` on the same items (`backup-exclusion.ts`). Nothing else in the app is excluded. |
| **C — Upload and processing** | `voice-note-api.ts` (the CP1 routes through the authorized fetch, a timeout and an `AbortController`; the `commandId` kept with the draft and rotated only on `UNAVAILABLE`), `voice-note-controller.ts` / `voice-note-session.ts` / `voice-note-runtime.ts` (a sending item like a typed send; status polled with back-off; commit; the existing `PENDING` path; recovery from local state or `GET /voice/notes/pending`; retry; no duplicate). |
| **D — The conversation** | `VoiceNoteViews.tsx` through neutral slots of `ConversationSurface.tsx` (the surface holds no voice code): the recording line (CP2-4), the slab with the Timeline-language line (CP2-5 / CP2-6), playback over Range with the `Authorization` header (`voice-note-player-port.ts`, `voice-note-playback.ts`), details on demand (C-40, C-35 / C-36, C-41 … C-43), the expired (C-37) and deleted (C-38) slabs with the text still reachable, the consent panel before the first note (C-01 … C-11 from `GET /voice/consent`, refused unless exactly the approved text), the scroll that follows the newest. |
| **E — Settings** | `VoiceNoteSettingsSection.tsx` (C-44 … C-48: retention, withdraw and its confirmation), placed in `SettingsSurface.tsx` by `DepthComposition.tsx`. |
| **F — Export** | `settings/export-file.ts` `saveExportVoices` (C-49 … C-53): the system folder picker, each listed file streamed with the bearer, its length and SHA-256 checked in and read back, the manifest written last; a file gone since the listing → `SOME_UNAVAILABLE`; any failure deletes the folder and checks it is gone → `FAILED_REMOVED` (C-51) or `FAILED_REMAINS` (C-53). `privacy-data-controller.ts` / `account-api.ts` reach the S8B-02 voice manifest. |
| **Composition** | `integration-runtime.ts` builds the voice-note session per signed-in account and retires it on sign-out (after the recovery writer, before Replay); `runtime-entry/index.ts` exports `decodeSubmitResponse` and `EXPORT_VOICE_FILE_NAME` to it (scope census extended). |
| **Guards** | `apps/mobile/scripts/verify-voice-note-native.mjs` — the native Voice Note gate on the REAL generated projects: RECORD_AUDIO requested and never removed; no foreground service; both backup rule files shipped by the linked module and wired; iOS C-12 in Info.plist and `InfoPlist.strings`, no `UIBackgroundModes`; both `expo-audio` background options off; the picker carries C-12, asks for images only and launches no camera. It plants 11 defects and requires each caught, then requires the repository unchanged. Wired as `prebuild:verify-voice-note` (mobile) / `prebuild:voice-note:mobile` (root) and in Mobile CI. |
| **Proof tooling (validation only)** | `S803ProofRoot.tsx`, `S803UiProof.tsx`, `s803-proof-entry.tsx`, `scripts/select-s803-proof-entry.mjs` (refuses without `S803_DEVICE_PROOF=1`); `scripts/s8b-03/fake-voice-server.cjs` / `fake-voice-api.cjs` / `m4a-info.cjs`; the iOS Simulator proof `.github/workflows/s8b-03-ios-proof.yml` + `scripts/s8b-03/run-s803-ios-proof.sh` + `apps/mobile/.maestro/s803-ios-*.yaml`. None is reachable from the Product build. |

**Re-pins (contract §5.7), each with a dated S8B-03 RE-ANCHOR note:** the plugin list and dependencies
(living-analysis-map-runtime, mobile-foundation-toolchain, return-navigation-layer, temporal-navigation-layer, W2-02,
W3-MEGA-S); W2-02 / W3-01 plugin files (+ the voice-backup plugin, with no dangerous mod or write); S6-06 (the picker's C-12
from `voice-note-copy.ts`; the photo gate no longer owns the microphone names; the voice gate does, and Mobile CI runs it);
T-13 (five storage modules, the drafts database its own, with no auth or transcript words); S8B-02 (voice routes only in
`apps/mobile/src/voice-note/`); W1A-01 (glyph keys + `mic`, `micRecording`, `close`); S7-02 (the composer's place may hold
the recording line, decided after the selection check). This contract test is rewritten for the closure (§14).

---

## 11. Acceptance B1 … B14 — how each is proven

**Devices.** Android: the Product Owner's HONOR phone (Android 15, density 3.25), the proof build
`com.qandeel.mobile.s803proof` beside, never over, the installed app, driven over adb against the fake voice server
through `adb reverse`; the clean build's APK `368fdb5f…` and its in-app-leave rebuild `3f1d3f8a…` carry the closing tree,
earlier builds the earlier steps (evidence ledger, outside the repository). Android emulator: QANDEEL_API36 (x86_64,
google_apis) started without `-allow-host-audio` (input zeroed), for the repository fixtures. iOS: the iPhone 17 /
iOS 26.5 simulator in CI (`s8b-03-ios-proof.yml`). No paid call; every gate `DISABLED`.

| ID | Criterion | Proof | Result |
|---|---|---|---|
| B1 | The G1.2 §E states with the approved texts; no lone long press; RTL / LTR | jest (`voice-note-surface`, the views and session suites); Android captures of idle, recording, sending, converting, committed, playing, paused, details, text, cancel, withdraw and consent in Arabic, and idle / recording / playing / the Timeline line in English; iOS (CI, run `41272144181`): the production surface opened and closed in Arabic and in English (screenshots) | **Proven.** No view registers a long press (jest); the long-press absence was not exercised separately on the phone. |
| B2 | Permission at the moment of intent; refusal → writing + «فتح الإعدادات»; never asked at playback | Android: `RECORD_AUDIO` not granted at launch, nothing asked; the first record after consent raised Android's own dialog; «Don't allow» → **C-21 + C-22** with the composer still there; C-22 opened the proof app's own App info, Back returned. No dialog at any playback. iOS (CI, run `41272144181`): nothing asked at launch; the in-app RECORD tap reached the shipped capture (its permission read `UNDETERMINED` and its request traced), iOS's own alert carried C-12 word for word; «Don't Allow» → `PERMISSION_DENIED`, no `prepare`, no recording, no draft file, zero uploads. | **Proven** on Android and on the iOS Simulator. |
| B3 | Leaving the screen, the background, a call and a headset stop and keep; no background recording | Android: **in-app leave** (the analysis entry, no Android lifecycle) → a 0:03 draft with **C-17**, stopped at the in-app tap and not at a later link; Home → `LEFT_SCREEN`, `dumpsys audio` shows the recorder stopped; force-quit mid-recording → the recorder file adopted on relaunch (`PROVEN`); no `FOREGROUND_SERVICE`, both background options off (native gate). iOS (CI, run `41272144181`): a NEW capture (#2) recording with its clock advancing; the app sent to the background → React Native reported `background`, the capture stopped `LEFT_SCREEN` into its own kept draft (a complete AAC-LC / mono / 16 kHz M4A, 12 800 ms), zero uploads. | **Proven** for leaving, background and force-quit. **A call and a headset unplug were not exercised on a device** (the interruption and route-change paths are proven by jest only) → `QAN-BL-VOICE-04`. |
| B4 | The draft survives relaunch; no network before send; no send on recovery; isolation; deleted after `ACCEPTED`; backup exclusion | Android: relaunch and `recover` kept every draft with **zero uploads**; owner B never saw owner A's drafts in the same store; `draftLeft=false` after each `ACCEPTED`; the **shipped APK** (`aapt2`) carries `fullBackupContent` / `dataExtractionRules` and both merged rule files excluding `qandeel-voice-drafts/`, `Audio/` and the drafts database with `-wal` / `-shm` / `-journal`. iOS (CI, run `41272144181`): the drafts folder and database carry iOS's excluded-from-backup flag (read on the host); a relaunch (a new process) recovered the `LEFT_SCREEN` draft with zero uploads; owner B saw none of owner A's drafts. | **Proven** at the store and package level. A real sign-out / sign-in cycle on the device and an on-device backup / transfer run were not done → `QAN-BL-VOICE-04`. |
| B5 | AAC-LC (`mp4a.40.2`), mono, ~32 kbps M4A; plays on both; device files pass the prover within 0.1 s; silence fixtures in the repository | Phone files (12, quiet room, deleted after proof): `ftyp, moov, free, mdat`, AAC-LC, 1 channel, 16 kHz, 32.6 kbps on the 10-minute file; **every one `PROVEN`** and equal to the container's own `mdhd` / `mvhd` to the millisecond; the 10-minute `LIMIT` stop at 600 384 ms (bound 601 000). Played on the phone. **Fixtures:** `apps/api/fixtures/voice-m4a/android-emulator-silence-{2416,4720,11760}ms.m4a` (the shipped capture on the emulator, zeroed input) + `m4a-device-fixtures.spec.ts`. | **Proven for the phone.** The emulator's software AAC path writes the first frame as 1792 ticks, which §4.6.2 step 4 refuses: the fixtures are pinned as **REJECTED** (`AUDIO_CONTAINER_INCONSISTENT`) → `QAN-BL-VOICE-03`. The recorder's own wall clock leads the file by about 120 – 135 ms on short notes (shown only while sending; the server's proven duration replaces it). **iOS (CI, run `41272144181`):** both uploaded silence files `ftyp, moov, free, mdat`, AAC-LC, mono, 16 kHz, **`PROVEN`** (23 680 ms / 370 frames and 12 800 ms / 200 frames, equal to `mdhd`). iOS's writer puts `channelcount=2` in the sample entry of this mono stream (the AudioSpecificConfig says 1 channel); the prover reads the stream, so the verdict is unaffected — recorded as an observation (§12). |
| B6 | The full path with a fake transcription server | Android, production surface: consent → record → send → `ACCEPTED` (`PROVEN`) → C-27 → `READY` → one `COMMITTED` turn → the reply; playback with the bearer (`200`, and `206` for seek and the 10-minute file); after restart the slab is drawn again. iOS (CI, run `41272144181`): record → stop → upload `ACCEPTED` (`draftLeft=false`) → playback streamed with the bearer (`206`). | **Proven** on Android and on the iOS Simulator (the fake server; no transcription on iOS). |
| B7 | A network cut during the upload and after acceptance; a transcription failure with retry; no duplicate | Android with injected faults: a failure → C-26 + Try again → one commit; the reply lost after `ACCEPTED` → the re-send is the same note (`replay`), no second note; a cut before anything stored → the draft kept with Try again; status reads cut → C-27 kept, then one commit. | **Proven.** |
| B8 | Expired and deleted: a non-interactive slab with the text kept; C-42 before delete | Android: delete → C-42 with Cancel / Delete (C-43) → C-38, the text kept, still C-38 after restart; **expired → C-37, no play, and C-35 opens the text with C-36**. | **Proven.** |
| B9 | Export byte for byte; cleanup → C-51; unconfirmed cleanup → C-53; a file gone → C-52 | Android, the production saver: `SAVED` with the on-device SHA-256 equal to the uploaded file; `SOME_UNAVAILABLE` (C-52); a short file → `FAILED_REMOVED` (C-51) with no folder left. C-53 (`FAILED_REMAINS`) by jest (`export-voice-file`, a device that cannot delete). iOS (CI, run `41272144181`): the production saver opened iOS's own document picker, which opened on «Recents»; the flow's «On My iPhone» choice was not reached, so nothing was saved. | **Proven on Android** except C-53 on a device → `QAN-BL-VOICE-04`. **NOT PROVEN on the iOS Simulator** — recorded, not required (contract §8.2 / §8.3). |
| B10 | Guards pass; planted defects rejected; the photo guard without regression | `verify-voice-note-native.mjs`: PASS, 11 planted defects caught, repository unchanged; the photo gate and its re-pinned contract pass; both run in Mobile CI. | **Proven** (CI result §14). |
| B11 | Names and roles; TalkBack; VoiceOver structure; Reduced Motion | Accessible names from the approved rows (C-13, C-16, C-34 + duration, C-35, C-41 …) and 44 dp targets read from the phone's accessibility tree; the line an adjustable element with value «m:ss / m:ss» and the CP2-6 step (jest). Reduced Motion: the Voice Note views run no animation (no `Animated`, no timing or spring, no layout animation); the preview opening follows the finger 1:1, and the time and the position change in steps. | **Names, roles and targets proven; nothing for Reduced Motion to remove.** TalkBack and VoiceOver were **not run** (no system accessibility setting was changed on the Product Owner's phone) → `QAN-BL-VOICE-04`. |
| B12 | No key, URL or text in the logs; no `expo-secure-store` or `AsyncStorage` | The proof app's whole logcat over the proofs (138 lines): no bearer, token, server address, route, transcript, reply, recording id, drafts path or file name — the only "token" lines are Android's own activity records; the fake server logs kinds, sizes and verdicts only; the storage ban by the T-13 / S8B-02 contracts and this contract test. | **Proven.** |
| B13 | The consent screen shows the text whose digest `0186` requires | The client refuses any consent text that is not exactly C-01 … C-11 (jest); `0186`'s digests equal those rows (this contract test, CP1); on the device the panel showed the 11 rows, served in CI and in the repo's fake server **from the API's own `voice-consent-text`**. | **Proven** by the chain client = record = `0186` digest. |
| B14 | Closure: BG-08 / BG-09, the locators, the controlled amendment, the governance contract | §13; `npm run test:task-closure-governance-contract`. | **Done** (§13, §14). |

**Not proven, recorded as limits (contract §8.3) and admitted as `QAN-BL-VOICE-04` for S8B-08's Stage 9 list:** an
incoming call and a headset unplug during a recording on a device; TalkBack and VoiceOver on devices; a
real sign-out / sign-in cycle and an on-device backup / transfer run; C-53 on a device; on iOS, a real microphone, the
real-device prompt, sound quality and container integrity after a force-quit, and the export into a folder (B9: NOT
PROVEN on the simulator).

---

## 12. Findings, residues and observations

**Found and fixed during CP2:**

1. **A start refused right after a launch link** (the link pauses the activity): the proof root waits for the active
   state, and the true reader actions use on-screen controls; the capture now reads its input only after `record()`
   (reading it before pinned the built-in microphone), maps permission with `canAskAgain`, and finishes a capture torn
   down mid-recording as `LEFT_SCREEN`.
2. **The consent panel clipped its rows** at half the screen: it takes 0.75.
3. **The thread did not follow the newest note:** it follows when near the newest and re-applies over two frames; a drag
   cancels it (jest, and 3 / 3 on the phone).
4. **The accessible value rounded while the text floored:** both use whole seconds (jest).
5. **The iOS proof harness (validation only, no production change):** iOS run `41243248744` showed SpringBoard's «Open
   in QANDEEL?» confirmed for a proof link that iOS never delivered to the app (no open-URL action reached it), so a link
   proves nothing about a command having run. The iOS proof now drives every step through the proof root's own buttons,
   checks that the RECORD tap reached the shipped capture, and requires each uploaded file's container and `PROVEN`
   verdict; the script was run locally end to end against stubbed `maestro` / `xcrun` / `xattr` and the real fake voice
   server (16 injected faults and two stale expectations caught) before run `41272144181` passed.

**Residues admitted (§13):**

6. **`QAN-BL-VOICE-03` — a real Android recording refused by the duration proof.** Android's software AAC path
   (MPEG4Writer, seen on the API 36 emulator) writes the first sample as 1792 ticks, then 1024 per frame. Contract v1.2
   §4.6.2 step 4 allows 1024 only, except the last entry, so the CP1 prover refuses such a file
   `AUDIO_CONTAINER_INCONSISTENT` and the note fails with C-29. The Product Owner's phone wrote 1024 throughout (every file
   `PROVEN`), so this is device-dependent. The approved rule is not changed by CP2: it needs a Product Owner decision and
   a controlled amendment of §4.6.2 before `PERSONAL_VOICE_NOTE` opens. Pinned by `m4a-device-fixtures.spec.ts`.
7. **`QAN-BL-MOB-01` — `expo-sqlite` handles fail after BACK and a relaunch in the same process.** After the activity is
   finished by BACK and the app reopened in the same process, a `SQLiteStorage` opened earlier rejects
   (`NativeDatabase.prepareAsync` / `execAsync` → `NullPointerException`), so a capture fails at `store.begin`
   silently: no draft and no message; the reader can still write. Seen once on the phone; force-stop and relaunch clears it. The same lazy
   open-once pattern serves other app stores (appearance, push device store, auth, recovery) — not reproduced there.
8. **`QAN-BL-VOICE-02` — the open external proof conditions** PC-S1 … PC-S7 and PC-D (§7), as gate-opening conditions.
9. **`QAN-BL-VOICE-04` — the physical-device proof list** of §11.

**Observations, not defects:**

- Once, about 6.5 s of playback was heard without a play act (an audio-focus pair in `dumpsys audio`); not reproduced in
  five attempts, and no tap on the details starts playback.
- The length reads 0:29 while sending and 0:28 after the commit: the recorder's wall clock against the proven duration.
- iOS's recorder writes `channelcount=2` in the M4A sample entry of the mono AAC stream (the AudioSpecificConfig says
  one channel, AOT 2, 16 kHz); every stts delta is 1024 and the prover returns `PROVEN`.
- Android's folder picker names a second export folder of the same day `… (1)`; the saver's own name is kept otherwise.
- The first launch link after a cold start on the emulator was not executed by the proof root (a harness timing): its
  draft stayed `RECORDING` until `recover` adopted it as `SAVED` with nothing sent — the product's recovery path.

---

## 13. Closure — BG-08, BG-09, the locators and the controlled amendment

- **BG-08 — `QAN-BL-VOICE-01`:** worked by S8B-03 and **not delivered** (the Voice Note is engineered end to end and
  closed by its gate; speech rendering, the live call, AEC, Replay audio, cost and launch evidence remain with S8B-04 …
  S8B-08). Owner `Stage 8B — Voice Runtime`, `HIGH` and `DEFERRED — OWNED` unchanged; a current-truth note is added.
- **Admitted (BG-06), each with the complete schema:** `QAN-BL-VOICE-02` (PC-S1 … PC-S7, PC-D; owner S8B-08),
  `QAN-BL-VOICE-03` (the first-sample delta; owner S8B-08, a controlled amendment of §4.6.2 before the gate opens),
  `QAN-BL-VOICE-04` (the physical-device list; owner S8B-08 with Stage 9), `QAN-BL-MOB-01` (the `expo-sqlite` reopen;
  owner Stage 9's release-readiness gate). **Index: 93 items; 48 / 4 / 8 / 33 by status; 56 / 35 / 2 by severity.**
- **Read and left unchanged:** `QAN-BL-PROD-06` / `08` (`0186` not hosted), `QAN-BL-AI-01`, `QAN-BL-AI-03`,
  `QAN-BL-ACE-02`, `QAN-BL-LAUNCH-06` (the photo folder save; the voice saver is proven here), `QAN-BL-PRIV-05`,
  `QAN-BL-SEC-01` (the app-wide `allowBackup`, untouched), `QAN-BL-CI-01` / `02`.
- **Reopened after the closing change:** `QAN-BL-CI-03` (Mobile CI's Android emulator disk), its reopen condition met on
  head `29794fca`; diagnosed and given a bounded Mobile CI change at the Product Owner's direction (2026-11-01). Its
  disposition follows the GitHub run of that change; the index counts are unchanged.
- **BG-09:** this record's banner states S8B-03's closing state; the three locators (`QANDEEL_CURRENT_STATE.md`,
  `QANDEEL_PROJECT_MAP.md`, `QANDEEL_PRODUCT_ROADMAP.md`) carry it.
- **The controlled amendment:** the S8B-01 Voice Runtime Controlled Amendment gains **§5 "S8B-03 — the text S8B-03
  binds"**: VA-3's Voice Note writer is `0186`'s commit definer; VA-6's microphone, with OD-7's narrow reading (the picker
  carries C-12 and never captures sound), binding from S8B-03's merge.
- `npm run test:task-closure-governance-contract` passes (§14).

---

## 14. Verification and the state left

**Run locally on the closing tree** (Windows, Node 24):

- mobile jest: 251 suites, 3 143 tests, all passing; `tsc --noEmit` (mobile, API): clean; `expo lint`: 0 errors (106 warnings);
- API jest, `src/voice` and `src/conversation-unit`: 16 suites, 300 tests, all passing (the m4a suites 51 / 51);
- the native Voice Note gate: PASS on the generated Android project (Windows prebuilds Android only; the iOS half runs in
  Mobile CI), 11 planted defects caught, repository unchanged;
- every root contract (`tests/*.test.mjs`): 118 of 119 files pass; `forward-safety-contract` does not finish on this
  Windows host and is proven in GitHub CI. One finding on the way: the HIM authority scan requires every file under
  `apps/api/src` to be TypeScript source, so the three `.m4a` fixtures moved to `apps/api/fixtures/voice-m4a/` (the
  guard unchanged);
- `npm run test:task-closure-governance-contract`: 24 / 24.

**GitHub CI on the Draft pull request:**

- **iOS Simulator proof — PASSED:** `s8b-03-ios-proof` run `41272144181` on `29794fca` (iPhone 17 / iOS 26.5, Xcode 26.6,
  Maestro 2.10.0; the driver answered after 41 s): B2, B3, B4, B5 and B6 pass with the evidence in §11 and the run's
  artifact; **B9 NOT PROVEN** on the simulator (iOS's picker opened on «Recents»), recorded, not required.
- **API CI — PASSED** on `29794fca`.
- **Mobile CI** run `41272148542` on `29794fca`: both Release builds, the contracts and the iOS boot smoke passed; the
  **Android API 36 emulator boot smoke failed** before the emulator started (runner disk, `QAN-BL-CI-03`, §13) and
  `Validation evidence (VAL-01)` with it. The bounded Mobile CI change that follows is verified only by its own GitHub
  run; nothing here claims that result.

**The state left:**

- **S8B-03 is CLOSED** at this change and **not merged**: merge only on the Product Owner's explicit «ادمج».
- **The four voice gates** — `PERSONAL_LIVE_CALL`, `PERSONAL_VOICE_NOTE`, `REPLAY_AUDIO_DISTRIBUTION`,
  `SHARED_VOICE_NOTE` — are **`DISABLED`**. **Migration `0186` is not hosted**; no hosted or production resource was
  touched.
- **No paid call:** no Speechmatics and no DeepSeek request; OD-10 (a) and (b) were not run.
- **No real user data:** the phone's quiet-room recordings were proof only and are not in the repository; the
  repository's fixtures are silence.
- **Not user-ready:** voice for users needs the hosted store (`HOSTED-DEPLOY-01`), `QAN-BL-VOICE-02` … `04` and the
  gate's own launch decision.
