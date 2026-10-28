# QANDEEL — Voice Runtime Contract v1

**Task:** S8B-01 — Voice Runtime Contract & Provider Evidence (Stage 8B), CP1
**Status:** `CANDIDATE — S8B-01 CP1, AT THE PRODUCT OWNER'S CP1 REVIEW (2026-10-28) — NOT IMPLEMENTED — NO PROVIDER SELECTED — NO PAID CALL MADE — EVERY VOICE GATE CLOSED / CLOSED TO USERS`
**Date:** 2026-10-28
**Authority:** the Product Owner's S8B-00 decisions (D-1 … D-9, with the D-9 cloud-iOS amendment) and the recording /
retention / Replay decisions, approved 2026-10-28 and recorded in the
[S8B-01 record](e2e/QANDEEL_S8B_01_VOICE_RUNTIME_CONTRACT_PROVIDER_EVIDENCE_RECORD_v1.md) §1. The controlled changes this
contract needs are drafted, one by one, in the candidate
[S8B-01 Voice Runtime Controlled Amendment](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-01_VOICE_RUNTIME_CONTROLLED_AMENDMENT_v1.0.md)
(VA-1 … VA-10). This document binds nothing until the Product Owner approves CP1. Each amendment binds only when the
Stage 8B task that implements it merges.

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

**4.3 QANDEEL's reply.**
- The Orchestrator runs the existing pipeline. The behavioral stage selects the **spoken guidance** (VA-7): shorter,
  speakable, no lists, markdown or URLs, and it yields to interruption (Behavioral Runtime `:63-64`).
- The Model Router streams (VA-1).
- The incremental release guard releases sentence chunks (VA-2).
- Each released chunk passes Speech Rendering (§5) and then TTS.
- The committed QANDEEL unit is the released text **truncated to the last chunk whose audio was confirmed played**,
  marked `INTERRUPTED` when cut. What is stored is what was said.

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

**6.2 Gaps.**
- A reconnection gap or a muted span is recorded as what it was: an explicit gap marker, or real silence while muted.
- Nothing is stitched to look continuous (CW2-05 §17 timing integrity).

**6.3 Anchors.**
- Every committed spoken unit carries `[start_ms, end_ms)` on the call clock, plus its commit instant.
- These are the CW2-05 §11 stable source anchors for audio.
- The analytical projection at represented time *t* is the one that was live at *t*, because units commit during the
  call and I-06B projects them with the no-hindsight rule (§8–§9).
- Analysis computed after the call stays at its own, later time.

**6.4 Voice Note.**
- One mono Opus track, the recording as sent, with its commit instant.
- QANDEEL's reply to a note is text. A Replay of a note exchange is `MIXED` (CW2-05 §41).

**6.5 Storage.**
- A private, user-scoped object store generalises the S6-06 pattern: bytes never in PostgreSQL, opaque keys, a distinct
  key prefix per class (`voice-call/`, `voice-note/`), and erasure proven by `DELETE` then `HEAD 404`.
- No URL, credential or key ever reaches a client surface. Playback uses a short-lived, server-authorized read.
- Raw audio and transcripts are never logged (AGENTS §5; APP-OPS-01:189-192).

## 7. Retention (PO decisions 2–4, 10)

| Source | Expiry instant | Immutable |
|---|---|---|
| Live Call recording | the call's `ended_at` + 30 days | yes |
| Voice Note (Personal and Shared) | its commit instant + 30 days | yes |

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
- The codec / container (CW2-05 §50 leaves it open) is decided by the S8B-01 CP2 render spike. The proposal is H.264 +
  AAC in MP4 for destinations, with Opus at the source.

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
- If CP2 shows the sum cannot meet the target, the levers are measured and offered, never applied silently:
  - endpointing tuning;
  - speculative generation on a stable interim transcript, cancelled if the final differs, which costs more;
  - a shorter first chunk;
  - a REALTIME `max_tokens` cap.
- Spoken fillers that simulate thinking are **not** a lever (VI-01 §14).
- The REALTIME budgets (time to first token, total) are set from CP2 evidence by controlled configuration (VA-4).
- Acceptance:
  - S8B-05 must meet the target on synthetic audio;
  - S8B-06 measures it on a real Android device;
  - S8B-08 reports p50 / p95 per stage.

## 12. Accounting (VA-5)

- Every ASR and TTS call, and any paid Speech Rendering tool, is a ledger call in AI-COST-01. This extends the ledger; no
  second ledger is created.
- **New usage kinds:** `AUDIO_INPUT_MS`, `AUDIO_OUTPUT_MS` and `SYNTHESIS_CHARACTERS`.
- **New feature families:** `VOICE_NOTE_TRANSCRIPTION`, `LIVE_CALL_TRANSCRIPTION`, `SPEECH_SYNTHESIS` and
  `SPEECH_RENDERING`.
- The selected providers and their operations are added as well.
- Prices use the existing basis units. A provider whose billing truth is unknown settles `UNPRICED`.
- Credits stay inactive (Stage 9).
- Storage and render cost per call minute are reported at S8B-08, not billed.
- The Model Router's DeepSeek stream is accounted from the stream's final usage chunk, on the existing operation.

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
- **Voices:**
  - CP3 presents a shortlist per supported dialect from real samples;
  - the Product Owner chooses each default after listening;
  - if the Product Owner approves two or more voices for a dialect, the user's voice choice (P1 L271) is built in
    S8B-04.

## 16. Stage 8B task plan (scope and dependencies as approved at S8B-00)

| Task | Depends on | Core acceptance |
|---|---|---|
| S8B-01 Contract & Evidence | — | This contract and VA-1…VA-10 approved; providers and voices chosen on measured evidence; the latency budget measured; cost per minute |
| S8B-02 Foundation | 01 | VA-3 / VA-5 migrations; the media store; immutable `retention_expires_at` and the expiry worker (physical deletion; text kept; no extension by any action); early and account deletion; the coverage registry; export; the consent record; the ports with fakes; the gate closed; real PostgreSQL green; default-deny; no audio in logs |
| S8B-03 Personal Voice Notes | 02 | Record, ASR, commit, reply, playback, 30-day expiry and its state, J1 / J2, VA-6 (microphone); E2E on a real Android device and in the iOS simulator |
| S8B-04 QANDEEL's voice | 02 | Speech Rendering, VA-7, TTS, the voices and voice choice, J10, the fixed failure line; the pronunciation suite; visible text provably unchanged |
| S8B-05 Realtime Core | 01, 02, 04 | The call authority, the gateway, streaming ASR, VA-1 / VA-2 / VA-4, barge-in, reconnection, two-track recording with playout confirmation, anchors; the §11 target on synthetic audio; no late audio; nothing stored as heard without confirmation |
| S8B-06 Native Call | 05 | CallKit / Core-Telecom / FGS, background, routes, interruption, the disclosure screen, `call-truth`; Android real-device matrix and latency; iOS simulator; the Stage 9 residue list |
| S8B-07 Replay & Worlds | CP1 / CP2: 05, 06; CP3: 03 | CP1 listening (VA-10) and the audio-visual Replay (VA-8); CP2 the three destinations (VA-9), gates closed; CP3 Shared Voice Notes |
| S8B-08 Exit & Closure | all | The device E2E, the expiry simulation, the deletion audit, zero-retention evidence, cost; BG-08 / BG-09 |
