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
merge, as §2 lists. Until then nothing here is in force. CP1 is delivered locally and is not merged.

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
