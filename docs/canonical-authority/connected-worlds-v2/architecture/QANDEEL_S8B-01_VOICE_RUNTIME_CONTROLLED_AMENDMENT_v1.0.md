# QANDEEL — Stage 8B
## S8B-01 — Voice Runtime Controlled Amendment VA-1 … VA-10 v1.0

**Status:** `MERGED WITH S8B-01 CP1 (PR #364, de774cfd) — APPROVED IN PRINCIPLE (S8B-00 D-8); EACH TEXT REVIEWED AND BOUND IN ITS IMPLEMENTING TASK — NONE IN FORCE — EVERY AMENDMENT NOT IMPLEMENTED (S8B-01 CP3 CLOSE, 2026-10-30; record §10.4) — VA-4'S STARTING VALUES APPROVED AS STARTING VALUES AND VA-8 R-5'S CODEC APPROVED BY THE PRODUCT OWNER AT CP3 (D-A1, D-C1, 2026-10-30), NOT IMPLEMENTED`. Each amendment binds only from the merge of the Stage 8B task that implements it, as listed in §2, after the Product Owner has approved its text in that task. Nothing below is in force today.  
**Scope:** the controlled changes the [Voice Runtime Contract v1](../../../voice-runtime-v1.md) needs.
- VA-1 … VA-7 touch the Foundation turn path, the Model Router contract and the release guard, the Conversation Unit
  modality, the AI-COST-01 units and a mobile CI guard.
- VA-8 and VA-9 wire a real original-audio source into the frozen Replay runtime.
- VA-10 is the narrowest P4 change needed to listen to a retained call.

Stage 9, CW2-08, Credits, the Shared human live call and Public `VOICE_REPLY` are outside it.  
**Authority:** the Product Owner's S8B-00 decisions (2026-10-28): D-2 architecture, D-4 Speech Rendering tools, D-6
experience, D-8 amendments in principle, and the recording / retention / Replay decisions 1 – 12 (record §1).  
**Task:** `S8B-01` — CP1. It is not a Connected Worlds phase.

This record is additive. The Foundation documents, CW2-05, `docs/replay-runtime-v1.md`, the I-06C migrations, AI-COST-01,
G1.2 and P4-C3 stay byte-identical. Each passage narrowed here is quoted, and it binds as narrowed only once the
implementing task merges. **What no amendment changes:**

- the Orchestrator owns the turn;
- providers stay behind adapters;
- DeepSeek Flash is the only brain;
- user isolation and default-deny;
- no raw audio or transcript in any log;
- the Safety Gate runs on every user turn;
- Replay never synthesizes a source event.

---

## 1. The amendments

### VA-1 — Streaming Model Router with cancellation (Foundation: provider abstraction; turn authority / cancellation)

- **Narrowed text.** `ModelRouter { generate(request): Promise<ModelRouterResult> }`
  (`apps/api/src/model-router/model-router.types.ts:104`) returns one string. The DeepSeek client sends `stream: false`
  (`providers/deepseek/deepseek-client.ts:85`). The Foundation already requires "candidate response/stream", a
  `STREAMING` turn state, a `REALTIME` routing mode and cancellation propagation (Orchestrator "Turn Lifecycle", "Canonical
  Turn Flow", "Cancellation"; Model Router "Routing Modes"). The Freeze lists provider-abstraction and cancellation changes
  as controlled (`FOUNDATION_FREEZE:89`).
- **Amended.**
  - The router contract gains one additive method, `stream(request, signal): AsyncIterable<ModelStreamEvent>`. Its events
    are `delta` (text) and `end` (finish reason, usage).
  - It is used only with `routingMode = 'REALTIME'` by the Orchestrator's spoken path. `generate()` and every text caller
    are unchanged.
  - Cancellation is an `AbortSignal` the Orchestrator owns. Abort stops the provider request and suppresses every later
    event.
  - Usage is taken from the stream's final usage chunk and settled through the existing AI-COST-01 operation.
  - A provider without streaming refuses `stream()` (it never fakes a stream).
- **Unchanged.**
  - The DeepSeek-only qualification (`SYNTHETIC_ONLY`) and `MAX_RETRIES = 0`.
  - The Personal FAST / DEEP text budgets.
  - `QAN-BL-AI-05`'s state. A later text-path use of `stream()` is that item's decision, not this amendment's.
- **Implemented by:** S8B-05.

### VA-2 — The incremental release guard (S8A-01 release guard)

- **Narrowed text.** `model-output-release-guard.ts:3-5`: "a candidate that fails is withheld whole, before anything is
  persisted or shown, and the turn fails as an ordinary generation failure (no partial text, no substitute wording)."
- **Amended, for the REALTIME spoken path only.** Text is released in sentence chunks.
  - A chunk is released only when it ends on a sentence or clause boundary, and only when the accumulated text passes
    every existing check: `EMPTY` at end of turn, `UNREADABLE` and `INTERNAL_CONTAINER`.
  - A `<` that has not yet closed holds the chunk back until it does.
  - **`GUIDANCE_ECHO` holdback:** the longest suffix of the accumulated text that occurs inside any server-authored
    sentence stays withheld. So a verbatim echo of `GUIDANCE_ECHO_MIN_LENGTH` (48) characters can never be partly
    spoken. It is detected while still withheld.
  - On any failure the stream is cancelled and the unreleased tail is discarded. The turn's committed QANDEEL text is the
    released prefix that was confirmed played (contract §4.3), marked `WITHHELD_TAIL`. A turn with nothing released fails
    exactly as today. No substitute model wording is produced, and the call speaks the fixed failure line (contract §4.5).
- **Unchanged.** The guard stays deterministic, provider-neutral and log-free, and it still claims no harmful-content
  judgement. The text path keeps the whole-candidate guard byte-identical.
- **Implemented by:** S8B-05.

### VA-3 — Voice modality and provenance on Conversation Units (`0064`, `0001`)

- **Narrowed text.**
  - `0064_committed_conversational_unit_substrate_v1.sql:147`: `CHECK (source_modality = 'TEXT')`.
  - `conversation-unit-commitment.service.ts:82` refuses `UNSUPPORTED_SOURCE_MODALITY`.
  - `0100:358` pins a Personal manifest item to `ORIGINAL_TEXT`.
- **Amended.**
  - `source_modality IN ('TEXT', 'VOICE_NOTE', 'LIVE_CALL_SPEECH')`.
  - A non-`TEXT` user unit requires:
    - `transcript_origin = 'MACHINE_ASR'`;
    - an ASR confidence band (`HIGH` / `MEDIUM` / `LOW`);
    - an opaque audio anchor: the media identity plus `[start_ms, end_ms)` on its clock.
  - A QANDEEL unit spoken in a call carries `spoken = true` and, when cut, `INTERRUPTED` or `WITHHELD_TAIL`.
  - The anchor never holds a URL, key or credential (the `0089` CHECK law).
  - `LOW` confidence suppresses durable Memory writes from that unit (contract §4.2).
- **Unchanged.**
  - A call stays inside the Personal Conversation session, so the `0001` `channel = 'VOICE'` session form stays unused and
    rejected.
  - Units stay append-only.
  - Every downstream reader keeps reading `content`.
- **Implemented by:** S8B-02 (schema), S8B-03 / S8B-05 (writers).

### VA-4 — REALTIME latency budgets (Foundation: configurable budgets)

- **Narrowed text.** The Personal budgets are FAST 10 s / DEEP 25 s (`conversation-orchestrator.service.ts:562`). The
  provider ceiling is 25 s.
- **Amended.**
  - The REALTIME spoken path has its own budgets:
    - a time-to-first-token abort;
    - a total generation cap;
    - a REALTIME `max_tokens`;
    - the endpointing and barge-in thresholds;
    - the 30 s reconnection grace.
  - Each is a controlled configuration value. Its starting value comes from S8B-01 CP2 evidence and is set by the Product
    Owner at CP3, against the end-of-speech-to-first-audio target (p50 ≤ 1.5 s, p95 ≤ 2.5 s; contract §11).
- **Unchanged.** Every text budget, and FAST / DEEP routing for text.
- **Implemented by:** S8B-05.

### VA-5 — AI-COST-01 audio units

- **Narrowed text.** `ai-usage.types.ts:57`: "Audio or other units are NOT here: they need a reviewed extension backed
  by a provider's billing truth." The `0135` CHECKs pin four token kinds.
- **Amended.**
  - **Usage kinds:** `AUDIO_INPUT_MS`, `AUDIO_OUTPUT_MS` and `SYNTHESIS_CHARACTERS`.
  - **Providers and operations:** only those selected at S8B-01 CP3, each with its billing truth cited.
  - **Feature families:** `VOICE_NOTE_TRANSCRIPTION`, `LIVE_CALL_TRANSCRIPTION`, `SPEECH_SYNTHESIS` and
    `SPEECH_RENDERING`.
  - Price basis units are unchanged. Quantities are milliseconds or characters, and an unknown price settles `UNPRICED`.
- **Unchanged.** One ledger; content-free telemetry; Credits inactive.
- **Implemented by:** S8B-02.

### VA-6 — The microphone in the mobile native guard

- **Narrowed text.**
  - `apps/mobile/scripts/verify-introduction-photo-native.mjs:24-26` asserts `android.permission.RECORD_AUDIO` removed
    and `NSMicrophoneUsageDescription` absent.
  - `app.json` has `"microphonePermission": false` for the image picker.
- **Amended.**
  - The photo guard keeps every camera and storage rule. Its microphone rule moves to a voice guard, which requires:
    - `RECORD_AUDIO` and `NSMicrophoneUsageDescription`, with the Copy-Gated purpose string;
    - at S8B-06, `UIBackgroundModes: audio` (no `voip`), plus `FOREGROUND_SERVICE_PHONE_CALL` and
      `FOREGROUND_SERVICE_MICROPHONE` only where the compliance note requires them.
  - The microphone is requested only at explicit intent (G1.2 §5).
  - The image picker's own microphone stays off.
- **Implemented by:** S8B-03 (microphone), S8B-06 (background).

### VA-7 — Spoken behavioral guidance

- **Narrowed text.** `BehavioralResponsePolicyService.buildTextGuidance` (`behavioral-response-policy.service.ts:141`) is
  the only guidance. The Golden suite says "audio expression is Stage 8B".
- **Amended.**
  - A spoken variant is built from the same principles: concise, minimal intervention, hypothesis restraint, anti-lecture,
    the frozen personality core and the language / dialect preference.
  - It adds the spoken constraints of Behavioral Runtime `:63-64`: shorter, speakable, no lists, markdown or URLs,
    numbers in speakable form, yield to interruption.
  - Optionally, under D-4, it asks for a separate speech-hint channel.
  - Its model-facing wording goes through a Product Copy Gate with its exact text.
  - It never changes a principle, only the form.
- **Implemented by:** S8B-04.

### VA-8 — The original-audio source in Replay (CW2-05 / I-06A … D)

- **Narrowed text.**
  - `docs/replay-runtime-v1.md` §7: "`MY_WORLD` original audio / call — NOT PRODUCIBLE".
  - `0100:358` pins `ORIGINAL_TEXT` for a Personal item.
  - `0102:572` pins `source_medium_class = 'ORIGINAL_TEXT_ONLY'`.
  - `docs/replay-runtime-v1.md` §7 for Shared `HUMAN_VOICE_NOTE`: "render and media delivery not claimed".
- **Amended, as the wiring CW2-05 already foresees** (§5, §6, §11, §31, §34 – §35, §39 – §41):
  - **R-1.** A Personal manifest item may be `ORIGINAL_AUDIO` / `MIXED` when its unit has a retained audio anchor
    (VA-3).
  - **R-2.** A new `RENDER_CONTRACT_VERSION` admits `ORIGINAL_AUDIO` and `MIXED`. The current version stays valid for text
    Replays.
  - **R-3.** Audio anchors are stable source anchors. The two call tracks share the client audio clock (contract §6).
  - **R-4.** Expiry and early deletion are written as I-06D source-availability facts, and new versions refuse them
    (§31).
  - **R-5.** The codec and container are decided by the CP2 render spike (CW2-05 §50 leaves them open).
  - **R-6.** Captions and transcripts are `DERIVED_*` (§40).
  - **R-7.** The QANDEEL track is the confirmed-played audio only (§6).
  - A Shared `HUMAN_VOICE_NOTE` gains render and media delivery under its existing visibility resolver and
    `FROM_JOIN_FORWARD`.
- **Unchanged.**
  - The four version components and their append-only law.
  - No-hindsight.
  - Source-deletion behaviour (§29 – §31).
  - No synthetic source event (§43).
  - Replay during a live call stays deferred.
- **Implemented by:** S8B-02 (R-1 schema), S8B-05 (R-3 / R-7 recording), S8B-07 CP1 (R-2, R-4, R-6, rendering).

### VA-9 — The three destinations' media (I-06C)

- **Narrowed text.** `docs/replay-runtime-v1.md` §45: "This repository has no encoder, container, bitrate, object store,
  CDN, public file URL … and the migration refuses to deploy with a storage handle, URL, filename, object key, codec or
  watermark column anywhere."
- **Amended.**
  - The Replay distribution tables still hold no such column. Their deploy guard stays.
  - A separate media domain, keyed by `distribution_package_version_id`, holds:
    - (a) transient delivery files for `DOWNLOAD` and `SHARE_EXTERNALLY`, deleted on delivery or within 1 hour and never
      outliving the source;
    - (b) the published playable media of a `PUBLISH_TO_PUBLIC_WORLD` Public Experience. It is durable under Public World
      law (withdrawal, consent revocation, privacy, F05 erasure), and it is **not withdrawn by the source's 30-day expiry**
      (PO decision 7; CW2-05 §31).
  - A delivery state is recorded only for a delivery the transport actually performed.
  - `EXPORT_PRIVACY_SANITIZATION` (§46) applies to every file.
- **Unchanged.**
  - I-06C's authorities, approvals and destination actions.
  - CW2-08 gates. Opening any destination is Stage 9.
- **Implemented by:** S8B-07 CP2.

### VA-10 — Listening to a retained call (P4-C3 §2, narrowest change)

- **Narrowed text.** P4-C3 §2, "Behaviour": "non-interactive: no button, no focus stop, **no play** — no durable Personal
  call audio exists (`QAN-BL-VOICE-01`); no transcript". This is frozen by reference through the P4 closure.
- **Amended.**
  - Only while the call's recording is retained, the record carries the frozen Voice Note media grammar of P4-C3 §1, in
    the record's own plane, centred, with no Surface and no UTTERANCE:
    - the P2 play / pause control (44 pt);
    - the hairline and heard part;
    - the stored position;
    - the time.
  - It plays the original call (both tracks), and it is the entry to Replay creation from that call.
  - After expiry, the record is exactly the frozen §2 record again.
  - No new colour, token, glyph or Surface role is introduced. The words stay `RUNTIME_GATED` for S8B-07's Copy Gate.
- **Gate.** A visual proof board approved by the Product Owner before implementation.
- **Implemented by:** S8B-07 CP1.

## 2. Effect

| Amendment | Binds from the merge of |
|---|---|
| VA-3 (schema), VA-5, VA-8 R-1 | S8B-02 |
| VA-3 (Voice Note writer), VA-6 (microphone) | S8B-03 |
| VA-7 | S8B-04 |
| VA-1, VA-2, VA-3 (call writer), VA-4, VA-8 R-3 / R-7 | S8B-05 |
| VA-6 (background) | S8B-06 |
| VA-8 R-2 / R-4 / R-6, VA-9, VA-10 | S8B-07 |
| CA-07B-1 (§6) | S8B-07 CP1-B |

An implementing task may tighten a text here. It may not widen one without a new controlled change.

## 3. Lifecycle at S8B-01's close (CP3, 2026-10-30)

- Every narrowed text above was re-read on `main` at `47121434` and still stands, so no amendment is implemented. One
  citation moved: `ModelRouter.generate` is now `model-router.types.ts:106`. The implementing task re-quotes it.
- The approval, the implementing task, the state and the future proof gate of each amendment, VA-11 included: the
  [S8B-01 record](../../../e2e/QANDEEL_S8B_01_VOICE_RUNTIME_CONTRACT_PROVIDER_EVIDENCE_RECORD_v1.md) §10.4.
- **VA-4.** CP3 proposed the starting values (record §10.1), approved as starting values (D-A1, record §10.9). The commit silence and the barge-in threshold are set in
  S8B-05, by the Product Owner's later decision (record §9.21), which prevails over VA-4's "set at CP3".
- **VA-5.** The providers were selected at CP2, not CP3. Their billing truths are cited in record §10.2.
- **VA-8 R-5.** The spike gave the evidence (record §9.15); the codec and container were proposed at CP3 (record §10.3)
  and approved (D-C1, record §10.9), with the render worker bounded so that it never competes with live calls.
- Beyond D-8's approval in principle, the Product Owner's CP3 decisions (record §10.9) approve VA-4's starting values
  and VA-8 R-5's codec only. Every amendment keeps its implementing task, none is in force, and each text is still bound
  in that task.

## 4. S8B-02 CP1 — the text S8B-02 binds (2026-10-30)

This section records the text the Product Owner approved for S8B-02 (WP0 approval and CP1 authorization, 2026-10-30;
[S8B-02 record](../../../e2e/QANDEEL_S8B_02_VOICE_FOUNDATION_IMPLEMENTATION_RECORD_v1.md) §1). It binds from S8B-02's
merge, as §2 lists. Until then nothing here is in force. CP1 is on Draft PR #367, with the Product Owner's R1
corrections (record §10), and is not merged.

- **Citations re-quoted on `main` at `c65b878c`.** Each narrowed text still stands there:
  - `0064_committed_conversational_unit_substrate_v1.sql:147` (`CHECK (source_modality = 'TEXT')`);
  - `conversation-unit-commitment.service.ts:82` (`UNSUPPORTED_SOURCE_MODALITY`);
  - `0102:572` (`ORIGINAL_TEXT_ONLY`);
  - `ai-usage.types.ts:57` ("Audio or other units are NOT here …").
  - **One citation moved:** the `0100` Personal pin to `ORIGINAL_TEXT` is the shape CHECK at `0100:395`, not `:358`.
- **VA-3, tightened by D-3.**
  - The audio anchor is turn-level. It lives on the turn's voice source and is inherited by every unit of that turn.
  - It is the recording identity plus `[start_ms, end_ms)` on its clock, never a key or URL.
  - The modality and provenance are written once, before the turn has units. A unit's modality must equal its turn's.
  - `LOW` suppresses durable Memory writes. `HIGH` / `MEDIUM` write `source = 'MACHINE_ASR'` at the Product Owner's P-1
    values (0.90 / 0.75), never the typed 0.98 / 0.95. Explicit Memory commands are unchanged.
  - The commitment gate at `:82` is unchanged, because the API commits no voice turn until S8B-03.
- **VA-5, amended by D-1 / D-2.**
  - **Usage kinds:** `AUDIO_INPUT_MS` (Speechmatics) and `AUDIO_OUTPUT_TOKEN` with `INPUT_TOKEN` (Gemini speech).
    `AUDIO_OUTPUT_MS` and `SYNTHESIS_CHARACTERS` are not added: Gemini speech is billed in tokens (D-1).
  - **Usage source:** every settled call carries `PROVIDER_REPORTED` or `GATEWAY_MEASURED`. `GATEWAY_MEASURED` is admitted
    for the Speechmatics operations only. It is never presented as provider-confirmed usage, and every reader, aggregate
    and telemetry label keeps the two apart (D-2).
  - **Providers and operations:** `SPEECHMATICS` (realtime, batch) and the route-neutral `GEMINI_SPEECH_GENERATION`.
  - No Price Card and no Credit change: an unknown price settles `UNPRICED`. Every text pair keeps exactly its partition.
- **VA-8 R-1.**
  - A Personal manifest item takes its unit's medium: `ORIGINAL_AUDIO` for a voice unit.
  - Moments return no transcript for a non-text item. A sub-range of an audio item is refused.
  - `0102:572` stays as written. An audio-bearing Replay is not rendered, previewed or distributed until R-2 (S8B-07).
    This is a wait, not a cancellation (D-7).
- **Not changed by S8B-02:**
  - the `0001` session channel (`VOICE` stays refused);
  - the text paths;
  - `0104` and the I-06C distribution;
  - every other amendment.

## 5. S8B-03 — the text S8B-03 binds (2026-10-31)

This section records the text the Product Owner approved for S8B-03 (contract v1.2 FINAL with OD-1 … OD-10, CP1 and CP2
authorizations, 2026-10-31; [S8B-03 record](../../../e2e/QANDEEL_S8B_03_PERSONAL_VOICE_NOTES_IMPLEMENTATION_RECORD_v1.md)
§1 and §9). It binds from S8B-03's merge, as §2 lists. CP1 merged through PR #370 as `e68ca146`; CP2 is on a Draft pull
request and is not merged, so until that merge nothing here is in force.

- **VA-3 (Voice Note writer).**
  - The writer is `public.server_commit_voice_note_turn_v1(p_user_id uuid, p_recording_id uuid)` in
    `0186_s8b_03_personal_voice_notes_v1.sql`. It creates the user turn and its voice source in ONE transaction, under
    the same admission bound as a typed turn.
  - It writes `VOICE_NOTE` with `MACHINE_ASR` provenance, the band, and the turn-level anchor that §4 fixed: the recording
    identity plus `[start_ms, end_ms)` on its clock, never a key or URL.
  - The commitment gate at `conversation-unit-commitment.service.ts:82` (`UNSUPPORTED_SOURCE_MODALITY`) still refuses
    every non-text modality on the generic path. Only this definer commits a voice turn.
  - The call writer stays with S8B-05.
- **VA-6 (microphone).**
  - The guard is `apps/mobile/scripts/verify-voice-note-native.mjs`, run in mobile CI after the native prebuild.
  - Android requests `RECORD_AUDIO` (never `tools:node="remove"`) and no `FOREGROUND_SERVICE*` permission.
  - iOS carries C-12 as `NSMicrophoneUsageDescription` in both locales, and no `UIBackgroundModes` exists.
  - OD-7's narrow reading: the image picker's `microphonePermission` carries C-12 only so that one sentence describes the
    microphone. The picker selects images, never opens the camera and never captures sound.
  - The background half of VA-6 stays with S8B-06.
- **Not changed by S8B-03:**
  - the four voice gates, which stay `DISABLED`;
  - the `0001` session channel;
  - the Replay and distribution paths;
  - every other amendment.

## 6. CA-07B-1 — Transient processing files: readability and physical deletion (FINAL, 2026-11-07)

**Status:** `FINAL — APPROVED BY THE PRODUCT OWNER (2026-11-07)`. Approved in principle on 2026-11-05 (A-4), and as
FINAL on 2026-11-07 after the final review of R5.1
([S8B-07 record](../../../e2e/QANDEEL_S8B_07_ORIGINAL_AUDIO_REPLAY_RECORD_v1.md) §12.5 and §13).
**It binds from the merge of S8B-07 CP1-B,** which implements it (§2). Until then nothing here is in force.

**What kind of change this is.** It is a controlled amendment of an absolute physical-deletion promise, not a reading of
it. The old texts promised that processing files are physically gone on completion, at the end of the session and "in
any case within 1 hour", never outliving the source. No object-store design keeps that during a store outage. The new
text separates:
- an **absolute** end of readability, decided by the database;
- an **asynchronous** physical deletion, with a measured target, and a recorded and retried violation.

Replacing an absolute promise with a conditional one widens the text, so §2's rule requires this amendment.

### 6.1 Text 1 — `docs/voice-runtime-v1.md` §9.1 (the processing-files bullet)

**Old (stays verbatim in place, with a pointer to this section):**

> - It is **not** a private video library. No permanent private video copy is kept (PO decisions 5, 9). Processing files
>   are deleted on completion, and in any case within 1 hour, never outliving the source.

**New (binding, complete):**

> - It is **not** a private video library. No permanent private video copy is kept (PO decisions 5, 9).
> - **Processing files (CA-07B-1).** A processing file is transient. The listening file of a retained call and the
>   playback files of a private Replay are processing files. For each one:
>   1. **Readability ends with the source.** The source ends at the first of: its expiry at `retention_expires_at`, its
>      deletion, account erasure, or, for a Replay, the version leaving `CURRENT`. From that instant no new request and
>      no byte range of the file is served. A response already being sent is cut, under the acceptance conditions of
>      1 s after a known end and 7 s after an end decided elsewhere, proven before release. Bytes already delivered to
>      the device cannot be recalled, and none is written to the device's persistent storage.
>   2. **The end of the session.** When the listening or playback session ends, the file is released and its erasure
>      becomes due at that instant. A released file is never read or reused again. The end of a session does not end
>      the right to listen: within the source's retention, a later request makes a new file.
>   3. **An independent maximum from creation.** A file cannot be read later than 58 minutes after its creation, nor
>      after its source ends, whichever comes first.
>      - Under healthy operation, its physical deletion therefore has a **target** within 1 hour of its creation:
>        58 minutes plus the 120-second target of point 4. This is not a guarantee.
>      - **A session longer than one file continues without loss of position.** While the source is still readable,
>        a file of the next generation is prepared from the same plan before the current file stops being readable.
>        Playback moves to it at the exact position, and the current file is released.
>      - Every file keeps its own maximum. At most two **generations** of one subject are live at once. A generation
>        is one file for listening, and one file per run for a multi-run Replay.
>   4. **Physical deletion.** Physical deletion is asynchronous, never immediate.
>      - It becomes due at the first of the instants in 1, 2 and 3, or when the file's own processing job fails.
>      - It is performed by the Replay deletion path: the reaper of the Replay Media Compute Pool, with an independent
>        Replay watchdog as its backstop. Neither runs on a live-call server.
>      - It is proven by `DELETE`, then `HEAD 404`, and the proof is recorded.
>      - **Under healthy operation of the store and of the Replay deletion path, its target is completion within
>        120 seconds of becoming due.**
>   5. **Violations.** A deletion not proven within that target is **recorded once as a violation, reported without
>      content, and retried** until it is proven.
>      - **No absolute physical guarantee is given while the store is unavailable, or while both the reaper and the
>        independent watchdog are unavailable.** Independent monitoring alerts on either.
>      - Readability (1 – 3) is decided by the database, fails closed, does not depend on the store, and is not
>        weakened by any outage.
>   6. **Retention.** No processing file, and no operation on one, extends the source recording's retention, not even
>      by one second.
>      - `retention_expires_at` is never written.
>      - Nothing is readable after the source's end.
>
>   **Not covered by this amendment:**
>   - the source recording itself;
>   - delivery files for `DOWNLOAD` and `SHARE_EXTERNALLY` (VA-9 (a), S8B-07 CP2);
>   - the final delivered or published video.
>
>   Each keeps its own text.

### 6.2 Text 2 — the S8B-01 record §10.3, the listening row

**Old (stays verbatim in place, with a pointer to this section):**

> | **Listening to a retained call** (§8) | a transient, server-mixed AAC-LC M4A of both tracks on the shared clock,
> delivered by a short-lived authorized read; deleted when the listening session ends and in any case within 1 hour | The
> device plays one file. Both tracks never leave the store as separate files. It is a processing file under §9.1's rule,
> never a permanent copy. |

**New (binding, complete):**

> | **Listening to a retained call** (§8) | a transient, server-mixed AAC-LC M4A of both tracks on the shared clock,
> delivered by a short-lived authorized read.
> - **Unreadable** from the first of: the end of the listening session, the end of its source, or 58 minutes after its
>   creation. A response in progress is cut under CA-07B-1's acceptance conditions.
> - **At the end of the session it is released.** Its erasure becomes due at that instant, and it is never reused.
> - **Physically deleted asynchronously** (`DELETE`, then `HEAD 404`) by the Replay deletion path:
>   - with a **target** of 120 s from becoming due under healthy operation, so a **target** within 1 hour of its
>     creation (not a guarantee);
>   - a miss is recorded as a violation and retried;
>   - no absolute physical guarantee while the store, or both the reaper and the independent watchdog, are unavailable.
> - A session longer than one file continues on a file of the next generation, prepared in advance, at the exact
>   position (CA-07B-1 point 3).
> - It never extends the source's retention (CA-07B-1).
>
> | The device plays one file. Both tracks never leave the store as separate files. It is a processing file under §9.1's
> rule **as amended by CA-07B-1**, never a permanent copy. |

### 6.3 Continuation across the 58-minute maximum (point 3)

The continuation rules are part of the approved text (S8B-07 CP1-B WP0 contract §20, R5.1):
- A session longer than one file continues on a file of the next **generation**, made from the same plan before the
  current file stops being readable. It plays from the exact position.
- Every file keeps its own maximum: `expires_at = least(created_at + 58 min, the source's end)`. Nothing writes
  `retention_expires_at`.
- At most two live generations of one subject exist at once. The database enforces this through a single write path: no
  role holds a direct write grant on the artifacts table, and the one generation-inserting function applies the rule
  and asserts it.
- Generations are mixed bit-exactly, and a generation whose decoded PCM differs from its predecessor's is never served.

### 6.4 What it does not change

- The source recording's 30-day retention from `started_at`, written once and never changed.
- The right to listen within retention: the end of a session does not end it.
- The disclosure wording and CL-08's date, which is the source's `retention_expires_at`.
- Delivery files for `DOWNLOAD` and `SHARE_EXTERNALLY` (VA-9 (a), S8B-07 CP2), and the final delivered or published
  video. Each keeps its own text.

**Proof (S8B-07 CP1-B):** V-12, V-14, V-27 (incl. (h)), V-31 (incl. (l) – (t)), V-32, V-35a (incl. (8) – (10)), V-36,
and HC-1 … HC-5 on the HONOR device.
