# QANDEEL — Voice Runtime Contract v1

**Task:** S8B-01 — Voice Runtime Contract & Provider Evidence (Stage 8B): CP1 (this contract), CP2 (the provider evidence), CP3 (the closing change)
**Status:** `STAGE 8B VOICE RUNTIME CONTRACT — MERGED WITH S8B-01 CP1 (PR #364, de774cfd) — PROVIDERS SELECTED BY THE PRODUCT OWNER AT S8B-01 CP2, MERGED (PR #365, 47121434): TTS GEMINI-3.8-FLASH-TTS, VOICE ACHIRD (record §9.10); ASR SPEECHMATICS ENHANCED AR_EN (§4.7, record §9.21) — S8B-01 CLOSED AT CP3 (record §10): THE PRODUCT OWNER'S CP3 DECISIONS D-A1 … D-F1 (2026-10-30, record §10.9): THE VA-4 STARTING VALUES, THE CODEC, THE SERVER-SIDE RENDER AND THE AAC-LC / M4A VOICE NOTE APPROVED; CALL RETENTION STARTED_AT + 30 DAYS; LAUNCH NOW, SCALE WHEN NEEDED — EVERY CAPABILITY IN THIS CONTRACT NOT IMPLEMENTED — EVERY VOICE GATE CLOSED / CLOSED TO USERS`
**Date:** 2026-10-28 (CP1); closed at S8B-01 CP3, 2026-10-30
**Authority:** the Product Owner's S8B-00 decisions (D-1 … D-9, with the D-9 cloud-iOS amendment) and the recording /
retention / Replay decisions, approved 2026-10-28 and recorded in the
[S8B-01 record](e2e/QANDEEL_S8B_01_VOICE_RUNTIME_CONTRACT_PROVIDER_EVIDENCE_RECORD_v1.md) §1. The controlled changes this
contract needs are drafted, one by one, in the candidate
[S8B-01 Voice Runtime Controlled Amendment](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-01_VOICE_RUNTIME_CONTROLLED_AMENDMENT_v1.0.md)
(VA-1 … VA-10), with VA-11 added at CP2. CP1 was merged through PR #364. Each amendment binds only when the Stage 8B task
that implements it merges, and none is in force for production today; their lifecycle at S8B-01's close is in the record
§10.4.

This contract defines Stage 8B's runtime. It **consumes** frozen authority and edits none of it:

- the Product canon: G1.1, G1.2 §1–§5, G3 §D, P2, P3 §9, the P4 non-signal Voice visuals and P4-C2 §4 / §5;
- the Replay canon: CW2-05 and I-06A … I-06D (`docs/replay-runtime-v1.md`);
- the Foundation: the Orchestrator, Model Router, Behavioral, Safety and Memory runtimes;
- CW2-03 / CW2-08 / CW2-08A for the Shared World;
- the binding fixed-Arabic-copy decision of 2026-10-13.

No second Orchestrator, Memory, Accounting or Replay runtime is created. DeepSeek Flash is QANDEEL's only brain.

---

## 1. Scope and non-scope

**In Stage 8B (engineering only; synthetic data; every gate closed):**

- Personal Voice Notes;
- QANDEEL's voice (Speech Rendering + TTS);
- the Personal Live Call (realtime, full-duplex managed, background, reconnection);
- the original-audio source and its 30-day retention;
- listening to the original call;
- the audio-visual Replay and its three destinations, built and proven with their gates closed;
- Shared Voice Notes;
- recording disclosure and consent;
- accounting of every voice provider call;
- device proof (D-9).

**Not in Stage 8B:**

| Item | Owner |
|---|---|
| Opening any voice, Replay-distribution or launch gate to production | Stage 9 |
| Credits and per-minute pricing | Stage 9 |
| Store submission of the background-audio and phone-call declarations | Stage 9 |
| Hosted object-store lifecycle | `HOSTED-DEPLOY-01` |
| The published legal privacy policy | Stage 9 |
| Real-user enablement of voice providers, the analogue of `QAN-BL-AI-01` | admitted at S8B-08 |
| `SHARED_HUMAN_LIVE_CALL` | stays `DISABLED_BY_PRODUCT_LEGAL_GATE` |
| Public `VOICE_REPLY` | stays out of scope |
| Replay during a live call | stays deferred (CW2-05 §50; G1.2 §I) |
| Synthesis of the user's voice, in any form | never |

**Stage 8A is untouched (D-1).** These items keep their owner and state:

- S8A-06, S8A-07 and S8A-08;
- `QAN-BL-AI-01`, `AI-02`, `AI-04`, `AI-05` and `AI-08`;
- `QAN-BL-MATCH-03` and `MATCH-04`;
- `QAN-BL-ACE-02`, `IP-02` and `CW-05`.

Stage 8B neither closes nor defers any of them. Where Stage 8B builds a capability one of them could reuse — the
streaming Model Router (VA-1) and `AI-05` — the capability is built once, in the Model Router, and the item's state does
not move.

## 2. Architecture (D-2)

The architecture is a **streaming cascade with full-duplex management**. DeepSeek Flash is the only brain. A
speech-to-speech model is never the brain; one may serve only as an ASR or TTS provider, through a mode that does neither
reasoning nor reply.

```text
device mic ─► uplink (Opus frames, client capture clock) ─► Voice Gateway (NestJS, voice module)
   │                                                            │
   │                                                            ├─► Recording writer: USER track (as received)
   │                                                            ├─► streaming ASR adapter ─► endpointing ─► final transcript
   │                                                            │       └─► Conversation Orchestrator (unchanged owner of the turn)
   │                                                            │              safety gate · context · HIM · behavioral (spoken) ·
   │                                                            │              Model Router.stream (DeepSeek, REALTIME profile)
   │                                                            │                 └─► incremental release guard (sentence chunks)
   │                                                            │                        └─► Speech Rendering (normalize · names ·
   │                                                            │                            numbers · selective vocalization · hints)
   │                                                            │                               └─► streaming TTS adapter
   ◄── downlink (audio chunks) ◄────────────────────────────────┘
device playout ─► playout reports ─► Recording writer: QANDEEL track (confirmed-played ranges only)
```

- **Modules** (Foundation skeleton `PROJECT_SKELETON:42`): `voice` holds the gateway, the call authority, the ASR / TTS
  ports and the recording writer. `speech-rendering` holds the pronunciation preparation. Neither owns a turn.
- **Ownership.** The Conversation Orchestrator owns every spoken turn, end to end (Foundation Freeze `:22`). The voice
  module is transport, adapters and media. It never calls the Model Router itself and never composes guidance.
- **Ports.** `SpeechRecognitionAdapter` covers streaming and batch, with interim / final and confidence.
  `SpeechSynthesisAdapter` covers streaming chunks, voice id and the pronunciation-hint capability. Provider-specific
  code lives only behind them (AGENTS §4). The selected providers come from CP2 / CP3 evidence (D-3).
- **Transport.** One authenticated, TLS-terminated streaming connection per call, from the client to the Voice Gateway,
  carrying Opus frames with sequence numbers and client capture / playout timestamps.
  - **Echo cancellation is the platform's:** iOS `playAndRecord` / `voiceChat`; Android `VOICE_COMMUNICATION` with
    `AcousticEchoCanceler`. This is the G1.2 compliance note's "WebRTC-class" requirement, met by the OS voice-processing
    path.
  - **The fallback is a WebRTC media path,** adopted only if S8B-06 device evidence shows the platform AEC or jitter
    behaviour fails acceptance. It is a recorded, reviewed change, not a default.
  - **The connection obeys the same trusted-proxy law as HTTP** (`QAN-BL-LAUNCH-01` §979).
- **No WebSocket is opened for anything else.** The temporal and historical-projection controllers' "no WebSocket /
  no SSE" statements stay true for those surfaces.

## 3. The call authority

- **One canonical call record per Live Call:** `callId`, owner, the Personal `sessionId` and `conversationId` (the call
  lives inside the ordinary Conversation, per G1.1 / G1.2 §1; the `0001` `channel = 'VOICE'` session form stays unused),
  state, started / ended instants, end reason, and recording identity.
  - **States:** `CONNECTING`, `ACTIVE`, `RECONNECTING`, `ENDED`.
  - **End reasons:** `USER_ENDED`, `PEER_LOST_AFTER_GRACE`, `SYSTEM_INTERRUPTED`, `FAILED`, `SERVER_ENDED`.
- **Server-canonical.** The client renders it and never decides it. `call-truth.ts` becomes a read of this authority.
  `ACTIVE` while `CONNECTING` / `ACTIVE` / `RECONNECTING`; `NO_CALL_KNOWN` otherwise, or when unknown, failing safe
  (PO-OPS-17).
- **Consumers:** P3 §9 call-safe attention, G3 §D Matching deferral, and the Analysis-first surface. Every end path
  converges on `ENDED` with a truthful finished-call record (G1.2 §2; compliance note §7).
- **Reconnection.** The grace window is **30 s** (D-6), configurable by controlled configuration, not by code. Inside
  the window the same `callId` continues. After it, the call ends `PEER_LOST_AFTER_GRACE`.
- **No claim after Force-quit.** Microphone capture stops when the app dies, and nothing claims otherwise. The server
  ends the call after the grace window with that end reason. No promise of survival is made (G1.2 §2).

## 4. The spoken turn

**4.1 Commit.**
- A user spoken turn is committed when endpointing finalizes it.
- It becomes one ordinary `conversation_units` row (VA-3):
  - `source_modality = 'LIVE_CALL_SPEECH'`, or `'VOICE_NOTE'` for a note;
  - `content` = the final transcript;
  - provenance: `transcript_origin = 'MACHINE_ASR'`, an ASR confidence band, and the audio anchor (§6.3).
- From commit onward it is an ordinary turn. The Safety Gate, the context builder, HIM, Memory and post-response
  intelligence all read it unchanged.
- **The Analysis changes when a spoken turn commits, never with sound** (G1.2 audio note §2).

**4.2 Mis-hearing.**
- The transcript is `DERIVED_TRANSCRIPT` (CW2-05 §40). It is never promoted to source truth.
- Memory capture and correction treat a `MACHINE_ASR` unit as the user's words as heard.
- A low-confidence band suppresses durable Memory writes from that unit. The turn itself still proceeds.
- The user can correct through the existing Memory correction commands.
- No new Memory runtime is created.
- *(S8B-03 CP1, 2026-10-31, the Product Owner's D1 and E1 … E13; binds from S8B-03 CP1's merge; [S8B-03 MACHINE_ASR Fresh Evidence Controlled Amendment](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-03_MACHINE_ASR_FRESH_EVIDENCE_CONTROLLED_AMENDMENT_v1.0.md).)*
  **`MACHINE_ASR` is Fresh Evidence by band.** HIGH and MEDIUM write Memory and Evidence with source `MACHINE_ASR` at the
  band's constant confidence (0.90 / 0.75), read inside the database; LOW leaves no durable trace and feeds no hypothesis or
  intent. It is never treated or quoted as typed text and never promoted to `USER_CONFIRMED` / `USER_STATED`; an explicit
  typed confirmation is recorded beside it, without rewriting its source. Spoken FORGET / DISABLE always ask first, and a
  LOW spoken command changes nothing (C-54). This replaces S8B-02's Deviations 6 and 8.

**4.3 QANDEEL's reply.**
- The Orchestrator runs the existing pipeline. The behavioral stage selects the **spoken guidance** (VA-7): shorter,
  speakable, no lists, markdown or URLs, and it yields to interruption (Behavioral Runtime `:63-64`).
- The Model Router streams (VA-1).
- The incremental release guard releases sentence chunks (VA-2).
- Each released chunk passes Speech Rendering (§5) and then TTS.
- The committed QANDEEL unit is the released text **truncated to the last chunk whose audio was confirmed played**,
  marked `INTERRUPTED` when cut. What is stored is what was said.
- **A chunk cut mid-playout** (CP1 review R1-3):
  - Its text is **not** committed as spoken. The committed unit keeps only the chunks whose audio was confirmed played
    to their end.
  - Nothing infers which words of a cut chunk were heard: not from the playout position, the elapsed time or the
    character count. Stage 8B claims no word-level alignment of the synthesized audio. Committing part of a chunk's text
    as spoken would need a word-level playout proof and a controlled change.
  - The audio that was actually played, up to the device-confirmed playout position, stays in the `QANDEEL` track
    (§6.1). It is the Replay reference for that moment, not the text.
  - A cut before the first chunk finished playing commits no QANDEEL text. The `INTERRUPTED` unit then carries no
    spoken text, and its audio range is the only record of what was heard.

**4.4 Interruption (barge-in, J5).**
- Detection uses on-device VAD after AEC, with a minimum speech duration. The value is measured in S8B-05 and set by
  controlled configuration.
- On detection, QANDEEL's playout stops immediately on the device, and the server receives the playout position.
- The Orchestrator marks the reply turn `SUPERSEDED`. It cancels the Model Router stream and TTS synthesis, suppresses
  every late chunk (Orchestrator "Realtime Interruption"; Safety Runtime `:45-46`), and commits the heard prefix (§4.3).
- The new user turn then follows the normal path.

**4.5 Failure.**
- A generation failure, a withheld chunk or a timeout produces one **fixed, pre-synthesized, process-framed line**,
  never model text. It is a Copy Gate row in S8B-04, in neutral MSA, under VI-01 §14.
- The call continues.
- Writing stays available (G1.2 §5).

**4.6 Voice Note.**
- Recorded on the device (foreground only; `expo-audio`; compliance note §11 `voiceNoteBackgroundCapture: false`).
- Uploaded after send, then batch ASR, then one committed `VOICE_NOTE` unit.
- The reply is text by default with a «استمع» control (J10). The control is synthesized on demand and is **not** an
  original audio event (CW2-05 §6); it is never stored as Replay audio.
- Leaving the screen while recording stops capture and keeps an unsent draft (J1).
- «اعرض النص» shows the transcript on demand, with machine-transcription provenance and no verbatim typography (J2;
  VI-01 §14 / §18).
- *(S8B-03 CP1, 2026-10-31; binds from its merge; [S8B-03 record](e2e/QANDEEL_S8B_03_PERSONAL_VOICE_NOTES_IMPLEMENTATION_RECORD_v1.md).)* **The server side is implemented, closed by default:**
  a durable transcription state (attempts bounded 3 automatic / 5 total, a crash-safe `OUTCOME_UNKNOWN`, no blind
  resubmission); a local M4A duration proof before any submission (10-minute limit); the batch port and its Speechmatics
  adapter behind `voice/speechmatics/` (proven only against a loopback fake); no note is `READY` before the first
  outcome of the provider job's deletion is recorded; one atomic voice turn through the unchanged Orchestrator. The recorder, the draft (J1), the bubble and
  «اعرض النص» are CP2's, not started. `PERSONAL_VOICE_NOTE` stays `DISABLED`.

**4.7 The selected ASR and its binding requirements** (the Product Owner's decision, 2026-10-28; S8B-01 record §9.21).
These are **required and NOT IMPLEMENTED**. A CP2 evaluation result is evidence about the provider. It does not show that
QANDEEL does any of this, and none of it is marked done before its own task proves it.
- **The provider:**
  - Speechmatics real-time, Enhanced `ar_en`, is QANDEEL's selected ASR provider. It stays behind the ASR adapter (§2).
  - Zero retention and no training remain mandatory for ASR (VA-11 does not extend to it). The production account's terms
    are re-verified when it is set up.
- **The final proof's record is unchanged.** Its verdict stays `NOT ACCEPTED` (5 / 6, record §9.20). The provider was
  selected although the synthetic overlap test failed, and that problem is a mandatory pre-launch gate.
- **The endpoint (§2, §4.1, §11 E / A):**
  - QANDEEL's own VAD decides when to finalize the text, and the gateway then sends `ForceEndOfUtterance`. The provider's
    own end-of-utterance trigger is not the authority.
  - **Finalizing the text is not ending the user's turn.** The turn is committed only after the Orchestrator's longer
    commit silence. An early finalization at a thinking pause is never permission to send a reply to DeepSeek.
  - Speech after an early finalization continues the same turn, with no word lost or repeated.
  - The commit silence is measured and set in **S8B-05** by controlled configuration. The 800 ms of the CP2 proof is
    experimental only: a 780 ms reading pause came within 20 ms of it.
- **Barge-in and QANDEEL's own voice (§4.4).** S8B-05 builds and S8B-06 proves on a real device:
  - echo cancellation;
  - detecting the user's speech while QANDEEL is playing;
  - the immediate stop of QANDEEL's audio;
  - QANDEEL's own voice never reaching the ASR as the user's words.
  - Discarding ASR words that end before the user's onset is not enough on its own. **The user's first words must not be
    lost during the overlap.**
- **Launch condition:** barge-in succeeding on a real device **blocks the launch of calls** (`PERSONAL_LIVE_CALL`, §13).
  It is not a deferred improvement.
- **Capacity and cost:**
  - The production environment is prepared for concurrent real-time sessions. The evaluation account allows two.
  - It is also prepared for the per-minute cost: every ASR call is a ledger call (§12).
  - S8B-05 sizes the session handling, and S8B-08 reports the cost before any gate opens.
- **Launch now, scale when needed** (the Product Owner's CP3 decision D-F1, record §10.9; binding, not implemented):
  - The approved path launches as it is: Speechmatics Enhanced `ar_en`, DeepSeek Flash, Gemini Flash TTS / Achird. The
    Speechmatics Pro limit of 50 concurrent sessions is not a limit of 50 registered users. No launch condition requires
    Enterprise or a minimum number of users.
  - S8B-05 manages concurrent sessions and sets the capacity from the provider's actual limit, never assuming it is
    unlimited. When it is full, a new session is refused safely and understandably: no pretend call, no silent failure.
    The visible text goes through S8B-05's Copy Gate.
  - The limit or the provider plan can be raised when needed without rebuilding the brain or changing the voice
    providers. Occupancy, the peak, the capacity refusals and the session cost are monitored; scaling thresholds come
    from real usage. S8B-08 reviews the capacity and cost evidence before operational scaling.
  - The safety, privacy and real-device barge-in conditions above all stay, and no gate opens early.

## 5. Speech Rendering (D-4)

Speech Rendering turns a released text chunk into TTS input. It never changes the visible text, the stored unit, any
Memory or the meaning (`QAN-BL-VOICE-01` L459; Tech Stack `:29-32`). It produces a speech-only representation that is
discarded after synthesis.

Order of operations:

1. normalization: punctuation for prosody, tatweel and spacing;
2. numbers, dates, times and currency, spoken in the reply's language and dialect;
3. names and foreign words, through a reviewed lexicon;
4. **selective contextual vocalization:**
   - diacritics, or the provider's pronunciation markup (SSML phoneme / lexicon / alias), are added only where the
     reading is ambiguous or known to be mispronounced;
   - all Arabic is never diacritized;
5. dialect fidelity: the voice and the hints follow the active language / dialect profile (I-08N-01:587). The default is
   explicit choice, then the clear dialect, then neutral simplified MSA, never Egyptian by default.

**Tools.** Specialised pronunciation and diacritization tools are allowed only where CP2 evidence shows a measured
benefit (D-4). Such a tool is a Speech Rendering instrument, never a reasoning or reply model. One option is evaluated in
CP2: DeepSeek emitting a separate speech-hint channel in the same generation. If adopted, that channel is speech-only and
equally barred from the visible text.

**When the reading is ambiguous and unresolved,** the fallback is the provider's own reading of the undiacritized word.
It is never an invented pronunciation. No universal correctness is promised.

**The Product Owner's production requirements (2026-10-28, after the CP2 TTS listening; S8B-01 record §9.10).** Both are
**required and NOT IMPLEMENTED**. A successful CP2 TTS sample is evidence that the voice can do it, not that QANDEEL does
it. Neither is marked done before its own task proves it.

1. **Contextual expression.** QANDEEL chooses how it expresses a spoken reply from the conversation's context: calm,
   empathy, playfulness, humour, enthusiasm or seriousness.
   - The expression is balanced, never exaggerated. The CP2 listening found X07's EMPATHY style overdone, and X05's
     JOKING style excellent.
   - It travels to TTS only as a speech-only style (`speechMetadata.style` for the selected Gemini TTS path). It never
     enters the visible text, the stored unit or Memory.
   - It is chosen inside the existing behavioral stage and spoken guidance (VA-7), not by a second persona engine or a
     rigid tone classifier (the Product Owner's personality direction, 2026-10-20).
   - **S8B-04** implements and proves it (the expression suite, with listening). **S8B-05** carries it on the realtime
     path: the style is fixed per reply before its first chunk reaches TTS, within the §11 budget.
2. **Selective contextual vocalization.** Speech Rendering (steps 2 – 4 above) vocalizes Arabic words selectively by
   meaning and context, and improves the reading of names, dates and ambiguous words.
   - The CP2 listening found D03's rendered date much better than its digits.
   - The current reading of numbers is accepted as it stands.
   - **S8B-04** implements and proves it (the pronunciation suite).

## 6. The original-audio source contract

This is the reviewed source contract that G1.1 L136-138 and `QAN-BL-VOICE-01` require before audio-led Replay. It wires a
real `ORIGINAL_AUDIO` source into CW2-05 / I-06A … D. It does not redesign them (VA-8).

**6.1 Two tracks, one clock.**
- A Live Call recording is two mono Opus tracks:
  - `USER`: the uplink exactly as received by the server, in client capture order;
  - `QANDEEL`: the downlink audio **only for the ranges the device confirmed it played out** (PO decision 12).
- Both carry the **client audio clock**: capture timestamps for `USER`, playout timestamps for `QANDEEL`. They are
  synchronized by construction.
- "Heard" is defined operationally as *played out by the device's audio output, confirmed by the client's playout
  report*. A downlink range without confirmation is never stored or presented as heard.
- **An interruption mid-chunk** (R1-3): the `QANDEEL` range ends at the device-confirmed playout position, and the
  partial audio up to that point is kept as played. The unplayed remainder is never stored. That played audio, not the
  committed text, is what Replay presents for that moment (§4.3, §9).

**6.2 Gaps.**
- A reconnection gap or a muted span is recorded as what it was: an explicit gap marker, or real silence while muted.
- Nothing is stitched to look continuous (CW2-05 §17 timing integrity).
- *(S8B-02 CP1, 2026-10-30, the Product Owner's D-4 / D-5; binds from S8B-02's merge.)* Gaps are recording data, held
  by the recording authority (`voice_private.recording_gaps`), as `RECONNECTION`, `MUTED` or `WRITER_LOSS`. Segments are
  ordered by index on a continuous clock unless a gap explains the discontinuity. A writer that stops is recovered by
  sealing, and its pending segments become `WRITER_LOSS` gaps. Order, gaps and interruption are proven; **no loss bound
  is claimed** (D-5). [S8B-02 record](e2e/QANDEEL_S8B_02_VOICE_FOUNDATION_IMPLEMENTATION_RECORD_v1.md) §4.1.

**6.3 Anchors.**
- Every committed spoken unit carries `[start_ms, end_ms)` on the call clock, plus its commit instant.
- *(S8B-02 CP1, 2026-10-30, the Product Owner's D-3; binds from S8B-02's merge.)* The anchor is **turn-level**: it is
  written once on the turn's voice source, before the turn has units, and every unit of the turn inherits it
  (VA-3 tightened, amendment §4).
- For an `INTERRUPTED` QANDEEL unit, `end_ms` is the confirmed playout position of the cut. The anchor therefore covers
  the played audio, including the cut chunk's played part, while the unit's text covers only the fully played chunks
  (§4.3). A transcript derived from that audio stays `DERIVED_TRANSCRIPT` (CW2-05 §40) and is never shown as verbatim.
- These are the CW2-05 §11 stable source anchors for audio.
- The analytical projection at represented time *t* is the one that was live at *t*, because units commit during the
  call and I-06B projects them with the no-hindsight rule (§8–§9).
- Analysis computed after the call stays at its own, later time.

**6.4 Voice Note.**
- One mono AAC-LC track in an M4A file (about 32 kbps), the recording exactly as recorded and sent, with its commit
  instant. *(The Product Owner's CP3 decision D-C2, record §10.3 and §10.9; it replaces "one mono Opus track".)* Android
  and iOS both record and play it natively, so a Shared Voice Note plays on both without a server copy. S8B-03 proves it
  on a real Android device and in the iOS Simulator.
- QANDEEL's reply to a note is text. A Replay of a note exchange is `MIXED` (CW2-05 §41).

**6.5 Storage.**
- A private, user-scoped object store generalises the S6-06 pattern: bytes never in PostgreSQL, opaque keys, a distinct
  key prefix per class (`voice-call/`, `voice-note/`), and erasure proven by `DELETE` then `HEAD 404`.
- No URL, credential or key ever reaches a client surface. Playback uses a short-lived, server-authorized read.
- Raw audio and transcripts are never logged (AGENTS §5; APP-OPS-01:189-192).

## 7. Retention (PO decisions 2–4, 10; decision 2 as corrected at CP3, D-D2)

| Source | Expiry instant | Immutable |
|---|---|---|
| Live Call recording | the call's `started_at` + 30 days | yes |
| Voice Note (Personal and Shared) | its commit instant + 30 days | yes |

*(The Product Owner's CP3 decision D-D2, record §10.9, which corrects S8B-00 decision 2's "from the end of the call":
`retention_expires_at = started_at + 30 days`. `started_at` is the instant the call first becomes `ACTIVE`, when its
recording can begin. The expiry is written once, with `started_at`. Ending the call, a reconnection, or creating or
sharing a Replay never restarts the count. A call that never reaches `ENDED` normally is ended by a recovery path with a
truthful end reason, and its expiry does not move. No migration before S8B-02.)*

*(S8B-02 CP1, 2026-10-30, the Product Owner's D-6; binds from S8B-02's merge.)* A Voice Note's "commit instant" is its
`accepted_at`, the instant the server accepts the stored note: `retention_expires_at = accepted_at + 30 days`, written
once, together with `accepted_at`, from `NULL`. A call recording's expiry is written at creation from `started_at`. Both
are refused every later change by every role. Nothing is recorded at or after the expiry, and a call recording
still being written at its expiry is sealed and expired by the retention sweep; the call itself stays S8B-05's (R1,
[S8B-02 record](e2e/QANDEEL_S8B_02_VOICE_FOUNDATION_IMPLEMENTATION_RECORD_v1.md) §4.1).

- **Nothing extends retention.** `retention_expires_at` is written once and is never updated, by a trigger that refuses
  every update. That holds for listening, creating a Replay, editing it, previewing it and distributing it.
- **Early deletion** uses the existing authorities only:
  - the Personal owner;
  - Shared owner deletion (`0090`), which removes the note for everyone;
  - account deletion (`0130`, the `0164` coverage registry).
- **At expiry,** a worker deletes the object and proves it gone. It then records the source as unavailable through
  I-06D's availability facts (`0106`) and marks the media `EXPIRED`.
  - The text history, the committed units, Memory and understanding all remain (PO decision 10).
  - Listening becomes unavailable.
  - A new Replay version, a preview, a render or a distribution that needs the source fails. CW2-05 §29–§31 already
    requires that, and no substitute audio is ever produced.
  - A render or distribution in flight at expiry revalidates and fails (§30). It never extends the source.
- **Retention, provider side.** Zero retention with no training is a selection condition (D-3). A provider that cannot
  attest it is not selected, because it would break the 30-day promise.

## 8. Listening to the original call (D-6)

- **While the recording is retained,** the finished-call record in the Conversation history offers playback of the
  original call, both tracks mixed on the shared clock.
  - It uses the frozen Voice Note media grammar: the P2 play / pause control, the line, the heard part, the stored
    position and the time (P4-C3 §1), placed in the record's own plane.
  - This is the narrowest P4 change, VA-10. It needs a visual proof board before implementation (S8B-07 CP1).
- **After expiry,** the record returns exactly to the frozen non-interactive record (P4-C3 §2).
- **Creating a Replay** from any allowed part of the call, at any time within retention, uses the existing I-06A
  selection model over the call's spoken units and anchors. It is reached from the listening view. The selection
  surface's visual and copy go through S8B-07 CP1's gates.

## 9. Replay (CW2-05 / I-06A … D, wired, not redesigned)

**9.1 The private Replay.**
- It is a draft / preview with its technical version data (`DRAFT` / `PREVIEW_READY` / `FINALIZED`, I-06A / B).
- It is rendered on demand from the retained source.
- It is **not** a private video library. No permanent private video copy is kept (PO decisions 5, 9). Processing files
  are deleted on completion, and in any case within 1 hour, never outliving the source.
- `FINALIZED` is the frozen technical state of the bound versions (§34). It is not a stored file (D-5c as clarified).
- After the source expires, a finalized private Replay's source-content layer is unavailable (§31–§32), and no
  text-only stand-in presents a derived transcript as source (§40).

**9.2 Rendering.**
- A new `RENDER_CONTRACT_VERSION` adds `ORIGINAL_AUDIO` / `MIXED`; the current one is `ORIGINAL_TEXT_ONLY`, `0102:572`.
  CW2-05 §34–§35 require a new validated version for exactly this (VA-8).
- Audio rendering keeps original audio as primary truth. Truthful clipping, simple crossfades and passive-time
  compression are allowed only where semantically safe (§39).
- Captions are `DERIVED_CAPTION` (§40).
- The video's picture is the bound `ANALYTICAL_PROJECTION_VERSION`, drawn in the Living Analysis grammar (§36). It is not
  a new analysis.
- The codec / container (CW2-05 §50 leaves it open). The S8B-01 CP2 render spike gave the evidence (record §9.15). CP3
  proposes the formats and a server-side, on-demand render (record §10.3): Opus at the source, H.264 + AAC in MP4 for the
  destinations, no private video. **Approved** by the Product Owner (D-C1, record §10.9): a resource-bounded background
  worker inside the existing architecture, which never competes with the latency of live calls; no second Replay engine
  and no microservice. S8B-07 implements and proves it.

**9.3 The three destinations** (PO decision 6). They are independent and use I-06C's existing destination actions,
authority and `EXPORT_PRIVACY_SANITIZATION` (§46):

| Destination | What is produced | Lifetime |
|---|---|---|
| `DOWNLOAD` | a transient rendered file, delivered to the device | deleted on delivery or within 1 hour; the device copy is the user's, outside QANDEEL's recording store (PO decision 8) |
| `SHARE_EXTERNALLY` | a transient rendered file, handed to the OS share sheet | the same; an external copy cannot be recalled (§31) |
| `PUBLISH_TO_PUBLIC_WORLD` | a **Public Experience** with its own playable published media, bound through I-06C's `REPLAY_ARTIFACT` bridge (`0104`) | governed by Public World law (withdrawal, consent revocation, privacy, erasure); **the source's expiry does not withdraw it** (PO decision 7; CW2-05 §31) |

- Distribution needs the same authorities as today, for example Shared participants' approvals for a Shared source
  (CW2-05 §22–§23). No new power is opened (PO decision 11).
- **In Stage 8B,** all three are built and proven end to end against a disposable environment with every gate closed.
  Opening them is Stage 9 (CW2-08).
- **VA-9** narrows I-06C's "no storage / codec / filename column" deploy guard. Replay tables still hold none. Transient
  delivery files and the published media live in their own media domain, keyed to the distribution package version, so
  I-06C's tables keep their law.

## 10. Disclosure, consent and privacy (PO decision 11)

1. **First use.**
   - One disclosure-and-consent screen, before the first Voice Note and before the first Live Call.
   - It is versioned and recorded per user (pattern: the Matching enrollment consent record).
   - **It states:** that calls and notes are recorded; that QANDEEL's heard voice is part of the call recording;
     that recordings are kept 30 days; that they are used for listening and Replay; that the user can delete early;
     that speech is processed by the selected providers; that nearby voices may be captured; and that a downloaded or
     shared copy leaves QANDEEL.
2. **At connect.** One short line in the `CONNECTING` state only. G1.2 §4 allows text there, so no persistent in-call
   prose is added.
3. **Settings** show the 30-day rule and the early-deletion action.
4. **Export My Data** includes retained audio (W3-PDG01:222), with the same expiry.
5. **No human review** of any private voice content (CW2-08A).
6. Every string goes through a Product Copy Gate in neutral MSA (decision of 2026-10-13). The published legal policy is
   Stage 9.
7. *(S8B-02 CP1, 2026-10-30, the Product Owner's PRIV-W; binds from S8B-02's merge.)* **Withdrawal.** A user may
   withdraw recording consent at any time. Afterwards no begin, accept, open, segment add or segment store is admitted.
   Sealing an open call recording still succeeds. Existing recordings keep their expiry and stay deletable, and
   withdrawal is never a deletion reason. The consent catalogue is empty until S8B-03 installs a Copy-Gated version, so
   every recording act is refused until then. A replayed begin or segment add that is still unfinished is refused too
   and never hands its key back; a completed acceptance or store still replays its result (R1). Withdrawal racing an upload or a segment store is proven in S8B-02 CP2
   (B5). Export lists retained recordings as metadata, with no key. The per-file voice export is CP2 (B9), and the
   mobile saver is S8B-03.
8. *(S8B-02 CP2, 2026-10-30, S8B-02's closing change; a local commit, effective from its merge; S8B-02 record §11.)*
   The server side of items 3, 4 and 7 is implemented, closed by default:
   - the owner's early deletion through the one shared erasure worker;
   - retention at the instant, never extended by any read;
   - the voice export manifest and its per-file route;
   - PRIV-W's withdrawal races (B5), as live PostgREST / rclone scenarios in `prove-0185`.

   Items 1, 2 and 6 (every user-visible string) and the mobile saver remain S8B-03's. Every voice gate stays `DISABLED`.
9. *(S8B-03 CP1, 2026-10-31; binds from its merge; [S8B-03 record](e2e/QANDEEL_S8B_03_PERSONAL_VOICE_NOTES_IMPLEMENTATION_RECORD_v1.md) §2.)* **The consent text `VOICE_RECORDING_V1`** (C-01 …
   C-11) and the microphone text (C-12) are **APPROVED verbatim** by the Product Owner, with QANDEEL's spoken Memory
   command replies C-54 … C-57 and the model texts M-01 … M-03. `0186` installs C-01 … C-11; consent grant, withdrawal
   and reading are served. The version is scoped to voice messages only; a new version adds calls, QANDEEL's voice and
   the provider names at S8B-04 (VA-11, OD-9). C-12 is used by CP2. The other 41 rows stay `PROPOSED` until before CP2.

## 11. Speed and latency (D-6)

**Target** (PO-approved direction, to be verified by measurement): the time from the end of the user's speech to the
first audible QANDEEL audio is **p50 ≤ 1.5 s and p95 ≤ 2.5 s**.

The stage budget is preregistered in `scripts/s8b-01/bench-plan.json`:

| Stage | Symbol | Measured in |
|---|---|---|
| Endpointing decision after silence | E | CP2 (ASR candidates), S8B-05 |
| ASR final after endpoint | A | CP2 |
| Orchestrator pre-generation (context, safety, HIM, guidance) | P | CP2 (local, free) |
| DeepSeek time to first token, streamed | T | CP2 (paid, guarded) |
| First releasable sentence chunk (guard holdback) | G | CP2 |
| Speech Rendering of the first chunk | R | CP2 |
| TTS time to first audio byte | S | CP2 |
| Network, jitter buffer and device playout | N | S8B-06 (device) |

- First audio = E + A + P + T + G + R + S + N.
- **The per-stage sums are a planning budget only** (CP1 review R1-2). They show where the time goes. Neither the sum of
  stage p50s nor the sum of stage p95s is a statistical bound on the end-to-end p50 / p95, because stage delays are not
  independent. The target is proven only by complete end-of-speech → first-audible-audio measurements on the device.
- **G is the first chunk the VA-2 conditions release** (R1-1), never the first punctuation mark. A stream that VA-2
  withholds gives no G and is counted. CP2 measures G with a predicate that mirrors the S8A-01 guard; S8B-05 re-measures
  it through the implemented guard.
- If CP2 shows the sum cannot meet the target, the levers are measured and offered, never applied silently:
  - endpointing tuning;
  - speculative generation on a stable interim transcript, cancelled if the final differs, which costs more;
  - a shorter first chunk;
  - a REALTIME `max_tokens` cap.
- Spoken fillers that simulate thinking are **not** a lever (VI-01 §14).
- The REALTIME budgets (time to first token, total) are set from CP2 evidence by controlled configuration (VA-4). CP3
  proposes their starting values (record §10.1), **approved as starting values** (D-A1, record §10.9): adjustable by
  controlled configuration, not production results. The commit silence and the barge-in threshold are set in S8B-05 (§4.4,
  §4.7). The planning sums with those values reach about 2.4 – 2.6 s at p50, above the target; the target is kept (D-A2),
  and S8B-05 and S8B-06 measure it end to end.
- Acceptance:
  - S8B-05 must meet the target on synthetic audio;
  - S8B-06 measures it on a real Android device;
  - S8B-08 reports p50 / p95 per stage, as the planning breakdown, beside the end-to-end p50 / p95 that decides.

## 12. Accounting (VA-5)

- Every ASR and TTS call, and any paid Speech Rendering tool, is a ledger call in AI-COST-01. This extends the ledger; no
  second ledger is created.
- *(S8B-02 CP1, 2026-10-30, the Product Owner's D-1 / D-2; binds from S8B-02's merge; amendment §4.)* The kinds are
  `AUDIO_INPUT_MS` (Speechmatics) and `AUDIO_OUTPUT_TOKEN` with `INPUT_TOKEN` (Gemini speech, which is billed in
  tokens). `AUDIO_OUTPUT_MS` and `SYNTHESIS_CHARACTERS` below are superseded and are not added. Every settled call
  carries its usage source, `PROVIDER_REPORTED` or `GATEWAY_MEASURED`. `GATEWAY_MEASURED` applies to Speechmatics only,
  is never presented as provider-confirmed usage, and stays a separate dimension in every reader, aggregate and
  telemetry label. No Price Card is registered in S8B-02, so every voice call settles `UNPRICED`.
- **New usage kinds:** `AUDIO_INPUT_MS`, `AUDIO_OUTPUT_MS` and `SYNTHESIS_CHARACTERS`.
- **New feature families:** `VOICE_NOTE_TRANSCRIPTION`, `LIVE_CALL_TRANSCRIPTION`, `SPEECH_SYNTHESIS` and
  `SPEECH_RENDERING`.
- The selected providers and their operations are added as well.
- Prices use the existing basis units. A provider whose billing truth is unknown settles `UNPRICED`.
- Credits stay inactive (Stage 9).
- Storage and render cost per call minute are reported at S8B-08, not billed.
- The Model Router's DeepSeek stream is accounted from the stream's final usage chunk, on the existing operation.
- *(S8B-03 CP1, 2026-10-31; binds from its merge.)* Every Voice Note batch attempt is one ledger call
  (`SPEECHMATICS_BATCH_TRANSCRIPTION`, `VOICE_NOTE_TRANSCRIPTION`, `AUDIO_INPUT_MS`), begun with `SUBMITTING` before any
  byte is sent and bound to the recording; unknown outcomes are counted. It settles `PROVIDER_REPORTED` when the provider
  reports the duration, otherwise `GATEWAY_MEASURED` from the local proof, or `ABSENT`; still `UNPRICED`. No paid call was
  made in S8B-03 CP1.

## 13. Gates

- **A server-canonical voice capability gate,** fail-safe, following the Shared / Replay launch-capability pattern.
  - **Scopes:** `PERSONAL_VOICE_NOTE`, `PERSONAL_LIVE_CALL`, `SHARED_VOICE_NOTE` and
    `REPLAY_AUDIO_DISTRIBUTION`.
  - Each is `DISABLED` in Stage 8B.
  - Disabling preserves history (PO-OPS-17).
- **Existing gates are untouched:** `SHARED_HUMAN_LIVE_CALL_LEGAL_GATE` and CW2-08.

## 14. Device proof (D-9 as amended)

**Real Android device** (required): audio quality, AEC and echo, Bluetooth / wired / speaker routes, a phone-call
interruption, lock / background / return, reconnection, playout reports, recording integrity and sync, microphone
permission at intent, the ongoing-call notification, TalkBack, and latency.

**iOS** (required): the cloud iOS Simulator on GitHub Actions macOS, with EAS Build / Workflows and Maestro. It covers
flows, layout, the permission education path, state restoration, the CallKit-facing state machine as far as the
simulator exposes it, VoiceOver structure, and crash-free background transitions.

**Optional:** real iOS devices from a cloud device service such as BrowserStack, only when a specific property needs it
and its cost is approved. **It is not a Stage 8B closure condition.**

**iOS properties the simulator cannot prove** are recorded as Stage 9 launch-readiness evidence, never claimed as tested.
They are admitted at S8B-08 with their final list:

- AEC / echo on the iPhone speaker;
- Bluetooth and route changes;
- the CallKit system UI and its Recents exclusion (J8);
- a cellular-call interruption (J6);
- background audio continuity under lock on hardware;
- the real microphone permission prompt;
- on-device latency;
- thermal and battery behaviour.

## 15. Adopted experience decisions (D-6)

| Decision | Adopted |
|---|---|
| J1 | Leaving the screen stops a Voice Note and keeps it as an unsent draft |
| J2 | «اعرض النص» on demand, with machine provenance |
| J3 | A call the user did not end returns them to the Conversation with Writing |
| J4 | Speaker on by default; on headphone disconnect, the receiver. Confirmed by S8B-06 device tests |
| J5 | Immediate stop; the heard part is kept |
| J6 | Held by another call, then resume inside the grace window, or end truthfully. A small proof is needed in S8B-06 |
| J7 | A non-interactive record; listening per §8 |
| J8 | "QANDEEL" with no relationship information, excluded from Recents |
| J9 | Copy Gates per task |
| J10 | The call is always spoken; a note reply is text with «استمع» |

- The reconnection window is 30 s.
- The latency target is §11.
- **Voices** *(the Product Owner chose one voice at CP2, Achird on `gemini-3.8-flash-tts`, one path, no per-turn switching
  (record §9.10), and confirmed it at CP3 (D-D1, record §10.9): one voice, one provider, no new voice list, no separate
  fast and quality paths. So the shortlist step below has nothing to choose, and its condition for a voice choice (two or
  more voices) is not met: S8B-04 builds no voice choice. Dialect support stays S8B-04's, with no claim that every dialect
  is production-qualified. The original text, kept as written)*:
  - CP3 presents a shortlist per supported dialect from real samples;
  - the Product Owner chooses each default after listening;
  - if the Product Owner approves two or more voices for a dialect, the user's voice choice (P1 L271) is built in
    S8B-04.

## 16. Stage 8B task plan (scope and dependencies as approved at S8B-00)

| Task | Depends on | Core acceptance |
|---|---|---|
| S8B-01 Contract & Evidence | — | This contract and VA-1…VA-10 approved; providers and voices chosen on measured evidence; the latency budget measured; cost per minute. *Closed at CP3 (record §10): the contract merged (CP1); providers and the voice chosen (CP2); every stage but N measured; cost per minute estimated (§10.2); the CP3 proposals pending (§10.7)* |
| S8B-02 Foundation | 01 | VA-3 / VA-5 migrations; the media store; immutable `retention_expires_at` (a call: `started_at` + 30 days, D-D2) and the expiry worker (physical deletion; text kept; no extension by any action); early and account deletion; the coverage registry; export; the consent record; the ports with fakes; the gate closed; real PostgreSQL green; default-deny; no audio in logs |
| S8B-03 Personal Voice Notes | 02 | Record (AAC-LC / M4A, D-C2), ASR, commit, reply, playback, 30-day expiry and its state, J1 / J2, VA-6 (microphone); E2E on a real Android device and in the iOS simulator |
| S8B-04 QANDEEL's voice | 02 | Speech Rendering, VA-7, TTS on the one voice (Achird; no voice choice, D-D1), J10, the fixed failure line; the pronunciation suite; visible text provably unchanged; **the Product Owner's two production requirements (§5): contextual expression (balanced, chosen in VA-7's spoken guidance, speech-only) and selective contextual vocalization of names, dates and ambiguous words, each proven by its suite and listening** |
| S8B-05 Realtime Core | 01, 02, 04 | The call authority, the gateway, streaming ASR, concurrent-session capacity from the provider's real limit with a safe refusal when full (D-F1), VA-1 / VA-2 / VA-4, barge-in, reconnection, two-track recording with playout confirmation, anchors; the §11 target on synthetic audio; no late audio; nothing stored as heard without confirmation; **the contextual expression (§5) carried on the realtime path: one style per reply, fixed before its first chunk reaches TTS, inside the §11 budget**; **the selected ASR (§4.7): QANDEEL's VAD + `ForceEndOfUtterance`, the text finalized apart from the turn commit, the commit silence measured and set, no early finalization sent to DeepSeek; barge-in with echo cancellation, QANDEEL's voice kept from the ASR and the user's first words not lost; concurrent-session handling** |
| S8B-06 Native Call | 05 | CallKit / Core-Telecom / FGS, background, routes, interruption, the disclosure screen, `call-truth`; Android real-device matrix and latency; iOS simulator; the Stage 9 residue list; **barge-in on a real Android device (§4.7): echo cancellation, detection during playout, the immediate stop, no QANDEEL word in the user's turn, the user's first words kept, a condition that blocks the launch of calls** |
| S8B-07 Replay & Worlds | CP1 / CP2: 05, 06; CP3: 03 | CP1 listening (VA-10) and the audio-visual Replay (VA-8); CP2 the three destinations (VA-9), gates closed; CP3 Shared Voice Notes |
| S8B-08 Exit & Closure | all | The device E2E, the expiry simulation, the deletion audit, zero-retention evidence, cost, including the ASR per-minute cost and concurrent-session capacity (§4.7; the capacity evidence before operational scaling, D-F1); BG-08 / BG-09 |
