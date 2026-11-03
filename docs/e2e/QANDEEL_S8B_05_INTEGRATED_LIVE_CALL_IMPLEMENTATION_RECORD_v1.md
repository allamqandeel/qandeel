# QANDEEL S8B-05 — Integrated Live Call: Implementation Record v1

**Task:** S8B-05 — Integrated Live Call (Stage 8B). This record covers CP1 (§0 – §9), CP2 (§10), CP3 (§11) and **CP4 —
Final Live Call Integration & Closure, S8B-05's closing change** (§12).
**Status:** `S8B-05 CLOSED / READY FOR THE PRODUCT OWNER'S MERGE DECISION (2026-11-03, the CP4 closing change; §12) — CP1 MERGED THROUGH PR #374 AS 50938001 — CP2 MERGED THROUGH PR #375 AS f5de4c27 — CP3 MERGED THROUGH PR #377 AS 5f1e0561 — CP4 ON s8b/s8b-05-cp4 AS A DRAFT PULL REQUEST, NOT MERGED (MERGE ONLY ON THE PRODUCT OWNER'S EXPLICIT «ادمج») — #34 NOT MET UNDER SHIPPED, OWNED BY GCR-01-A — MIGRATIONS 0189 – 0192 NOT HOSTED — ALL FOUR VOICE GATES DISABLED — NO PAID PROVIDER CALL, NO F-01 AUDIO GENERATED — NOT USER-READY`

*(CP3's banner as written, before its merge: "S8B-05 CP3 — UNDER REVIEW (2026-11-02; R1, the Product Owner's correction order on PR #377, 2026-11-03, §11.10; R2, the Product Owner's decisions on R1 and the API CI P04 fix, 2026-11-03, §11.11 – §11.14). CP1 (Call Authority, Gateway, Admission & User Track) is **merged** through [PR #374](https://github.com/allamqandeel/qandeel/pull/374) as `50938001`; CP2 (Realtime Spoken Turn, QANDEEL Reply & Playout Truth, §10) is **merged** through [PR #375](https://github.com/allamqandeel/qandeel/pull/375) as `f5de4c27`. CP3 (Ordered Half-Exchange Establishment & Fast Live Analysis, §11) is on `s8b/s8b-05-cp3` as a **Draft pull request, not merged; merge only on the Product Owner's explicit «ادمج»**. S8B-05 is **not closed**. CP4 is **not started and not authorized**. S8B-06 CP1 is merged through PR #376 as `e429ca35`; CP3 was synced with that `main` and does not depend on it.")*

*(§0 – §9 are CP1's record as written, §10 CP2's, §11 CP3's and §12 CP4's; where a later checkpoint changed an earlier statement, its own section
says so.)*

*(CP2's banner as written, before its merge: "S8B-05 CP2 — UNDER REVIEW (2026-11-02) … CP3, CP4 and S8B-06 are not started
and not authorized.")*

## 0. Authority, base, precedence

**Authority:** the Product Owner's S8B-05 CP1 execution authorization (2026-11-02).

- It approved the final contract `S8B-05_S8B-06_INTEGRATED_LIVE_CALL_CONTRACT_v1.2_FINAL_FOR_PO_EXECUTION_APPROVAL.md`
  (kept outside the repository, under the Product Owner's reports folder `S8B-05`).
- It also approved the decisions D-05-01 … D-05-08 and the controlled amendments CA-05-01 … CA-05-04.
- It authorized **only S8B-05 CP1**.

**Precedence:** contract v1.2 Part A → A1 → v1.1 → v1.0.

**Base:** `main` at `194559e0`, the merge of PR #373 (S8B-04 CP2).

**Branch:** `s8b/s8b-05-cp1`. **Migration:** `0189` (forward-only, not hosted). **The next migration is `0190`.**

**Constraints kept:**

- no voice gate was opened;
- no migration was deployed to a hosted database;
- no paid API was called, and no F-01 or warning audio was generated;
- no real user data or voice was used: the humans are random UUIDs and the audio is a generated signal;
- no merge without «ادمج».

## 1. What CP1 delivers, against the authorized items

| Item | Delivered | Where |
|---|---|---|
| **A. Call authority (0189)** | `voice_private.calls`: CONNECTING / ACTIVE / RECONNECTING / ENDED with the five end reasons; one unended call per person (unique index plus the guarded transitions); `connection_epoch`; `started_at` written once, at the first ACTIVE, in the same transaction that opens the recording; the 30 s grace; begin / activate / heartbeat / suspend / resume / end / sweep (recover); `call_turn_index`; call-truth and the call's track state. Ownership, session, consent and the PERSONAL_LIVE_CALL gate are checked in the definers; races are serialized by row locks, `SKIP LOCKED` and one advisory lock. | `database/migrations/0189_s8b_05_live_call_authority_v1.sql` |
| **B. Capacity** | One pool of realtime seats for calls **and** live voice notes, counted under a global advisory lock. A full pool is an explicit refusal: `CAPACITY_FULL` for a call, and P0001 `REALTIME_CAPACITY_FULL` for a live note, which the API maps to `CAPACITY_FULL` (503; the phone records without it). The seat is released at the end and by recovery, and kept through the 30 s resume. A lapsed seat lease is never counted, so no seat is held for ever. Capacity comes from `voice_private.live_call_policy`, changed only by its setter. No new AI accounting. | 0189; `voice/live-note/live-voice-note.repository.ts` |
| **C. Gateway (the `voice` module)** | The RFC 6455 upgrade at `/voice/calls/connect`: Supabase authentication, TOKEN_REFRESH, and TLS at the trusted proxy. Ownership and epoch come from the authority. Bounds on rate (per address and per connection), frame size, pending audio, the inbound queue and the outbound buffer. Heartbeat and silence. Duplicate, late and invalid messages are rejected. No raw audio or transcript is logged. **Protocol v1 is frozen and documented**; CP2 – CP4 shapes are frozen without logic, and those messages are refused `NOT_SUPPORTED_YET`. | `apps/api/src/voice/call/` (§3); `docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v1.md` |
| **D. Opus and the USER track** | Opus ingest in both directions (libopus through `opusscript`, MIT, WASM); Opus → PCM 16 kHz; a valid Ogg Opus muxer (RFC 7845) and a strict reader. The real USER writer stores ten-second standalone segments of the packets exactly as received, through the existing `VoiceMediaService.writeCallSegment` (S8B-02). It records honest packets, times and gaps, never invented silence. The recording is tied to the call; retention is `started_at` + 30 days and never reset. **CA-05-04:** the NOT_SPEAKING gap (QANDEEL track only); explicit lease renewal; anchors checked against the recorded ranges; the open gaps, duplicates and races closed. No QANDEEL writer and no playout truth (CP2). | `voice/call/codec/`, `voice/call/recording/user-track-writer.ts`; 0189 |
| **E. Recovery** | **Timeouts and resume:** a CONNECTING timeout ends `FAILED`; ACTIVE → RECONNECTING on a lost connection; a resume inside the grace continues the same call; the old connection is rejected after an epoch change (same instance at once, another instance at its next renewal); grace expiry ends `PEER_LOST_AFTER_GRACE`. **Crash or lease expiry** ends `SYSTEM_INTERRUPTED`. **Sealing:** the old recording-recovery worker never seals a live call's recording, or one inside its grace; the final end seals and releases the seat in the same transaction. A lost connection never becomes a new call. | 0189 (`server_sweep_calls_v1`, the forward-replaced `server_recover_stale_call_recordings_v1`); `live-call.service.ts` (the sweep every 5 s) |

**Not delivered, as authorized (forbidden in CP1):**

- endpointing, the LIVE_CALL orchestrator, DeepSeek and Gemini TTS live replies;
- CA-05-01 (CP3) and full CA-05-02 (CP2), playout truth and the QANDEEL track, and full barge-in;
- native modules, any live-map UI, Replay, publishing and sharing;
- any paid test;
- any new Speechmatics, DeepSeek or Gemini adapter, Memory or Analysis engine, or Ledger.

The decoded uplink goes to `LIVE_CALL_SPEECH_SINK`, which CP1 binds to the **null sink**.

## 2. Migration 0189 and how the earlier recording contracts are preserved

0189 is one transaction with a deploy guard. The guard requires all four voice scopes to be `DISABLED / UNSATISFIED`, the
census to be clean and the ACLs to be exact. Every new definer is `public.server_*`, `SECURITY DEFINER`, uses
`search_path = ''` and is executable by `service_role` only. The ten internals are executable by no role.
`voice_private.calls` is `ACCOUNT_CASCADE` in the erasure coverage registry.

**Forward replacements (0183 / 0185 semantics kept, extended for calls):**

- `server_open_call_recording_v1`: only for the call's own ACTIVE start; the authority opens it.
- `server_record_call_gap_v1`: adds NOT_SPEAKING on the QANDEEL track.
- `server_add_call_segment_v1` / `server_record_call_gap_v1` (the writer fence, R1 below): a write that carries no epoch
  is `FENCED` for every call that has not ENDED; 0183's rules are kept, unchanged, for a recording no call holds.
- `seal_call_recording`: refuses `CALL_LIVE` while the call is not ENDED.
- `server_recover_stale_call_recordings_v1`: skips any call that is not ENDED.
- `server_attach_turn_voice_source_v1`: the anchor must lie inside the recorded ranges.

**The existing verifiers keep proving 0183 – 0188 unchanged in meaning:**

- They were re-anchored only where a call recording now needs its call: `database/live-call-0189-anchor.mjs` creates a
  fixture call, and the fixture is ended without a seal so 0183's own seal semantics stay under test.
- Re-anchored: verify-0183, 0184, 0185 and 0186, and prove-0185 (which runs in CI only).

**The writer fence (R1, the Product Owner's PR #374 review):** the contract requires that a connection whose epoch has
moved on cannot change the call's truth, and the recording writes were outside that guarantee. 0189 now closes it in
the database, with the smallest change:

- **`server_add_call_segment_v2` / `server_record_call_gap_v2`** carry the writer's `connection_epoch`. They lock the
  call row `FOR SHARE` first (the same call → recording order as the heartbeat, the end and the sweep, so no deadlock),
  and admit only for the epoch the call holds while it is ACTIVE. Otherwise they answer `FENCED` and write nothing.
  0183's admission and gap bodies run unchanged after the check (`add_call_segment_core_v1`,
  `record_call_gap_core_v1`). The API's writer uses only these.
- **An admission and a resume are serialized by the call lock.** An admission that committed before the resume is in
  the tracks the resumed connection reads (`server_read_call_tracks_v1`), so the new connection writes after it. One
  that comes after the resume is `FENCED`.
- **A segment admitted before the authority moved is not lost.** Its completion (`server_store_call_segment_v1`, 0183)
  stays epoch-free: its index, range and size were fixed by the admission, and its audio was captured before the
  resume. If its upload never completes, the seal turns it into a `WRITER_LOSS` gap, never silence and never audio.
  Nothing new is accepted from a fenced connection.
- **Same-instance resume order.** Before the resume moves the epoch, the same phone's connection that holds the call on
  this instance stops taking audio and writes what it took under its own, still current, epoch. Only then does the epoch
  move and `yieldTo` fence it. Valid audio accepted before the resume is never refused by the new fence. A connection on
  another instance whose late write is refused stops `FENCED` (`4003`). The call is not failed, and the phone resends
  from the new connection's durable end.
- The epoch-less 0183 entries stay for the earlier verifiers' fixtures, whose calls are ended by a plain update without a
  seal. In production a call's recording is sealed in the transaction that ends the call.

**Wire refusal:** the live-note seat refusal uses P0001 with the message `REALTIME_CAPACITY_FULL`, not a `PTnnn` code.
PostgREST maps a `PTnnn` code to HTTP status nnn, so a P0001 refusal keeps the existing 4xx contract of the live-note
route.

## 3. The API layer (`apps/api/src/voice/call/`)

| File | Role |
|---|---|
| `live-call.protocol.ts` | Protocol v1: constants, message shapes, binary layout, limits. Pure. |
| `gateway/websocket-frames.ts` | RFC 6455 server framing. Masked frames only, bounded before buffering, UTF-8 checked. No socket package: the repository's dependency pins allow none. |
| `gateway/live-call.gateway.ts` | The `upgrade` handler. Exact path, method, version, key and subprotocol; the per-address upgrade rate (the HTTP throttler's tracker over Express's own `req.ip`); the per-instance and per-person caps; Supabase authentication before any socket; then the frame parser. |
| `live-call.connection.ts` | One socket's call. It is a strict state machine over the authority, with one message at a time, token buckets, a bounded queue, lease renewal, silence, token expiry, CALL_ENDING, same-instance takeover and fencing. Lose → flush → suspend. |
| `live-call.repository.ts` / `live-call.store.ts` | The authority's commands over the server channel. |
| `recording/user-track-writer.ts` | The USER track, written under the connection's epoch (0189's fenced entries; `FENCED` stops it without failing the call). Only `STORED` releases audio; an ambiguous answer is reconciled from `server_read_call_tracks_v1`. |
| `codec/opus-codec.ts`, `codec/ogg-opus.ts` | Opus both directions; the Ogg Opus muxer and strict reader. |
| `live-call.service.ts` | The instance's connections, call-truth and the sweep (every 5 s, off under tests and without the media store). |
| `live-call-truth.controller.ts` | `GET /voice/calls/truth`. Guarded, `no-store, private`, classified `AUTHENTICATED` in the route census. |
| `live-call-speech.port.ts` | The speech sink (CP1: null). |

Telemetry is the content-free domain `VOICE_LIVE_CALL`.

## 4. Proofs (all free, all local or in CI; nothing paid, nothing hosted)

**`database/verify-migration-0189.mjs` on real PostgreSQL 17: 24 / 24.** Each line below is one scenario.

- **L0a – L0c:** the catalogue, ACLs, policy, gates and census.
- **L1:** begin.
- **L2:** one unended call per person.
- **L3:** activate with `started_at` and the recording together.
- **L4:** the open.
- **L5:** heartbeat and `ends_at`.
- **L6:** suspend, resume, fencing, another device and the grace.
- **L7:** end.
- **L8:** the sweep's four reasons, each sealing RECOVERY.
- **L9:** capacity N / N+1, shared with a live note, the reconnecting seat, the lapsed seat.
- **L10:** `call_turn_index`.
- **L11:** NOT_SPEAKING.
- **L12:** anchors and the track state.
- **L13:** call-truth.
- **L14:** durability and account erasure.
- **L15:** the writer fence.
  - The epoch-less entries are `FENCED` on a live call.
  - An older epoch, an unknown epoch and a RECONNECTING call get `FENCED` and write nothing.
  - A segment admitted before the resume counts in the resumed tracks and still stores.
  - One never uploaded becomes a `WRITER_LOSS` gap at the end.
  - An ENDED call or another person gets `UNAVAILABLE`.
- **LRC-1 … LRC-4:** the races (two begins, the last seat, end vs sweep vs resume, two ends).
- **LRC-5 / LRC-6:** an old epoch's late admission vs a resume, on two connections, in both orders.
  - When the admission holds the call, the resume waits. The segment then counts in the resumed tracks and completes
    after the resume.
  - When the resume holds the call, the admission waits and is `FENCED`.
  - The ended call's USER track is one contiguous truth: the old epoch's segments, the RECONNECTION gap, then the new
    epoch's segment, never interleaved.

The re-anchored verify-0183 / 0184 / 0185 / 0186 / 0187 / 0188 pass locally on the same database (their count of 0189's
internals moves from 7 to 10).

**The synthetic live call** (`apps/api/scripts/s8b-05-live-call-synthetic-proof.ts`; `npm run
prove:live-call-synthetic:integration`) runs the real gateway, connection, repository, `VoiceMediaService` and writer.
There are two gateway instances over real PostgreSQL with 0189. The client is a synthetic phone on a real WebSocket,
sending **real libopus packets** of a generated signal. Local PG17 result: **8 / 8** (report kept with the contract
folder as `CP1_SYNTHETIC_PROOF_local_pg17.txt`).

- **P1:** a whole call. CONNECTING holds one seat; ACTIVE comes at the first audio; 625 packets give segments [0, 10000)
  and [10000, 12500), both STORED and both valid Ogg Opus decoding to exactly 625 × 320 samples. The call ends
  `USER_ENDED` and the recording is sealed; retention is exactly `started_at` + 30 days; the seat is released.
- **P2:** a drop goes to RECONNECTING with the seat kept and call-truth ACTIVE. The resume gets epoch 2 and
  `resumeFromCaptureMs 2000`; the gap is RECONNECTION [2000, 3000). `started_at` and retention are unchanged; the person
  has one call.
- **P3:** recovery during the grace does not seal. After the grace the sweep ends `PEER_LOST_AFTER_GRACE` and seals; a
  late resume is told ENDED.
- **P4:** capacity 1, across two instances. A second call and a live voice note both get `CAPACITY_FULL`; after the end
  the next call begins.
- **P5:** a cross-instance resume. The old instance is fenced (`4003`). The resend of instants the old instance had
  already stored is dropped, so the track is [0, 1200) + [1200, 2200), 110 packets, no gap.
- **P6:** a crashed instance (lapsed lease). Call-truth fails safe; the sweep ends `SYSTEM_INTERRUPTED` and seals.
- **P7:** the writer fence across two instances (R1).
  - Instance A holds epoch 1. Segment [0, 10000) is admitted and its upload is held in flight, with 400 ms more in A's
    buffer.
  - The phone resumes on instance B with epoch 2 and `resumeFromCaptureMs 10000`: the admitted segment counts.
  - A's upload then completes (STORED). A's late write is refused by the database: the admissions read `ADDED@1`,
    `FENCED@1`, `ADDED@2`. A closes `4003`.
  - The phone resends from 10000 on B. The ended call (`USER_ENDED`, epoch 2) has [0, 10000) and [10000, 12000): 600
    packets, every one the phone's own packet for its capture instant, in order, with no gap.
- **P8:** the teardown leaves no fixture row and every gate as it was.

In CI the same proof also runs through every PostgREST line of the existing loop.

**API specs (Jest), 57 tests** (the earlier "49" was a miscount of 48):

| Spec | Tests | What it covers |
|---|---|---|
| `codec/codec.spec.ts` | 8 | real Opus up and down, TOC, mux round-trip, lacing, corruption, CRC |
| `live-call.protocol.spec.ts` | 8 | the frozen messages, exact shapes, binary layout, malformed frames, RFC 6455 framing and bounds |
| `recording/user-track-writer.spec.ts` | 8 | segments decoded packet-for-packet, gaps, ambiguous writes landed or not, a takeover's resend, consent and closed recording, **FENCED** (an older epoch, a call no longer ACTIVE), abandon |
| `live-call.connection.spec.ts` | 19 | see below |
| `gateway/live-call.gateway.e2e.spec.ts` | 7 | see below |
| `gateway/websocket-frames.spec.ts` | 7 | the RFC 6455 negatives (R1 review): unmasked, RSV, fragments, continuations, reserved opcodes, control > 125, 1009 from the header alone (text, binary, a 64-bit length), invalid UTF-8 (1007), a one-byte close, nothing parsed after an error or a close, the accept key |

The connection spec covers:

- begin, activate and end; MUTED gaps; msgId resends;
- seq and capture rules, wrong epoch, random bytes;
- lose → suspend → resume with a RECONNECTION gap;
- same-instance and cross-instance fencing (the same-instance handover written under the old epoch before the epoch
  moves; another instance's late segment `FENCED`, 4003, the call not failed, the resend the one truth); resume of an
  ended call;
- NOT_SUPPORTED_YET; token refresh and expiry; CAPACITY_FULL; silence; the 60-minute end; consent withdrawn mid-call;
  overload.

The gateway e2e spec runs a **real WebSocket** against the **real `SupabaseAuthService`**, pointed at a local fake of
`/auth/v1/user`. It covers:

- missing, forged or expired tokens refused 401 and an unreachable auth answered 503;
- 404 / 400 / 426 refusals;
- a whole call with real Opus and a valid Ogg segment;
- drop and resume; another person's resume refused;
- 1009 and 4002 closes;
- the per-person and per-address caps.

**Static contracts:**

- `tests/s8b-05-live-call-contract.test.mjs` (new): protocol document ≡ code, 0189 wiring, the null sink, no provider and
  no logging, the census, and the Copy Gate.
- `tests/s8b-02-voice-foundation-contract.test.mjs` is **re-anchored** (dated) for `voice/call/`: the live call's
  **server** socket. It dials nothing, reads no environment, opens no client socket and carries no provider, and only
  the gateway imports `node:http` types.

## 5. Acceptance items (contract v1.0 §11, as amended), within CP1's scope

| # | Item | CP1 proof | Status |
|---|---|---|---|
| 1 | A real call under the server's authority | L1 – L9, L13, L15, LRC-1 … 6; synthetic P1 – P7 | **Met for CP1's scope** (the authority, the gateway and the USER track; no AI turn, no reply audio) |
| 2 | The same Personal Conversation | L1 (the person's own ACTIVE TEXT session, FK `(session_id, user_id)`), L2; synthetic P1 | **Met for CP1** (the turns themselves are CP2) |
| 18 | Capacity is never exceeded | L9, LRC-2 (N+1 concurrent: exactly N); synthetic P4 (two instances, call + live note) | **Met** |
| 20 | Recording and the 30-day retention | L3, L4, L12, L14, L15, LRC-5 / 6; synthetic P1 / P2 / P7 (retention = `started_at` + 30 d, unchanged by a resume) | **Met for the USER track** (the QANDEEL track is CP2) |
| 24 | Voice Notes, Text and Analysis not broken | the existing verifiers 0183 – 0188 and API suites pass; the text path and the engines are untouched (no file of theirs changed beyond the live note's capacity mapping) | **Met locally; the full CI run is on the pull request** |
| 25 | No voice gate opened | 0189's deploy guard; L0c; the contract test; the synthetic proof restores every gate and P8 checks it | **Met** |

**Not claimed:**

- a full call;
- real full-duplex or two-way audio (item 3, CP2 → S8B-06);
- any latency figure;
- any provider behaviour;
- any device behaviour.

## 6. Limits and risks

**Real limits, documented and not blocking CP1:**

- **Resolved in R1: the recording writes are fenced by the epoch** (§2, "The writer fence"). The earlier limit (an
  epoch-less segment add, with honesty left to the writer's reconciliation) no longer stands. CP2's QANDEEL writer uses
  the same v2 entries.
- **"Same capture instant means same audio" is a protocol contract**, now only inside one epoch's writer (a resend on one
  connection). It is not verified byte for byte: a resend with different bytes at a held instant would be dropped as a
  duplicate.
- **No independent Ogg decoder is used.** Validity is proven by the strict RFC 7845 reader (CRC, sequence, granules,
  headers, EOS) and by decoding every packet with libopus. There is no `ffmpeg` or `opusdec` on this machine.
- **The upgrade limits are per instance.** The global, distributed limit and the guarantee that nothing reaches an origin
  around the edge belong to `QAN-BL-LAUNCH-01`.
- **iOS / Android clients do not exist yet** (S8B-06). Header-based authentication on the socket assumes React Native's
  WebSocket `headers` option. Node's WebSocket (the synthetic client) supports it, and S8B-06 proves it on the devices.
- **The PostgREST wire run of the synthetic proof** is first exercised in CI, on the pull request.

**Optional improvements (not blockers):**

- a distributed upgrade limit at the edge;
- a byte-level check of resent packets;
- RFC 6455 §7.4 close-code range validation in the frame parser. Today any code is read, and the gateway answers a close
  with a fixed 1000 / 1001. This is harmless and not a security defect (the R1 review of the negatives found no defect).

## 7. Readiness for S8B-06 CP1 (Android / AEC)

**Ready on the server side:** the frozen protocol (§3, the document), call-truth, the gateway, authentication and token
refresh, resume and fencing, and the USER track. A phone can open a call, stream real Opus, mute, lose and resume, and
end.

**Not ready:**

- the downlink (REPLY_AUDIO), PLAYOUT and BARGE_IN logic (CP2 / CP3), so AEC against QANDEEL's real voice cannot be
  proven end to end before CP2;
- the native module and the call UI (S8B-06).

S8B-06 CP1 is **not started**.

## 8. Backlog (BG-05 at kickoff; CP1 is not the closing change)

S8B-05 owns no item by its own name at kickoff (from `main` at `194559e0`). It works `QAN-BL-VOICE-01` for Stage 8B,
which stays `DEFERRED — OWNED`, `HIGH`; worked, not delivered.

**Read and left as they stand:**

| Item | Note |
|---|---|
| `QAN-BL-VOICE-02` … `05` | S8B-08 |
| `QAN-BL-PROD-06` / `08` | `0189` not hosted |
| `QAN-BL-LAUNCH-01` | the edge limit |
| `QAN-BL-AI-01` | — |
| `QAN-BL-ACE-02` | — |
| `QAN-BL-MOB-01` | — |

CP1 admits and tombstones nothing. The epoch-unchecked segment add that §6 listed is resolved inside CP1 (R1); nothing
of it remains as residue.

## 9. Copy Gate — the unified call gate for both stages (D-05-03): every row PROPOSED

One gate covers S8B-05 and S8B-06. **Nothing here is approved.** No text is used by CP1: the phone has no call surface, and
the server sends reason codes, never text. The copy work does not expand CP1 into UI work.

### 9.1 Existing proposals, shown as they stand

These are the 22 `RUNTIME_GATED` rows the contract names:

- the P4-C3 table rows (`COPY_DECISION_TABLE.md`, call keys);
- VI-01 V01 – V07;
- G1.2's V07 principle;
- P4-C3 finding F-03.

| ID | Status | Arabic | English | Source / moment |
|---|---|---|---|---|
| LCE-01 | PROPOSED | مكالمة صوتية | Voice call | `cCall` — call entry / name |
| LCE-02 | PROPOSED | مكالمة صوتية | Voice call | `cRecord` — finished call record |
| LCE-03 | PROPOSED | مكالمة صوتية انتهت، مدتها {d} | Voice call ended, {d} | `cRecordName` — record, accessible |
| LCE-04 | PROPOSED | كتم الميكروفون | Mute microphone | `cMute` |
| LCE-05 | PROPOSED | تشغيل الميكروفون | Turn microphone on | `cUnmute` |
| LCE-06 | PROPOSED | إنهاء المكالمة | End call | `cEnd` |
| LCE-07 | PROPOSED | السماعة الخارجية | Speaker | `cRoute` |
| LCE-08 | PROPOSED | المكالمة مستمرة | the call continues | `cContinues` — accessible suffix |
| LCE-09 | PROPOSED | جاري الاتصال | Connecting | `cConnecting` |
| LCE-10 | PROPOSED | الميكروفون شغّال | Microphone on | `cA11yOn` — assistive only |
| LCE-11 | PROPOSED | الميكروفون مكتوم | Microphone muted | `cA11yMuted` — assistive only |
| LCE-12 | PROPOSED | مدة المكالمة {d} | Call time {d} | `cElapsedName` — accessible |
| LCE-13 | PROPOSED | المكالمة الصوتية غير مشمولة. | Voice calls aren't included. | `replayCallNote` — Replay |
| LCE-14 | PROPOSED | تسجيل صوتي | voice note | VI-01 V01 |
| LCE-15 | PROPOSED | مكالمة | call | VI-01 V02 |
| LCE-16 | PROPOSED | تسجيل | Record | VI-01 V03 — mic idle |
| LCE-17 | PROPOSED | بسجّل | Recording | VI-01 V04 — capture active; never for a call (G12-08) |
| LCE-18 | PROPOSED | بيتكلم | Speaking | VI-01 V05 — «قنديل بيتكلم» |
| LCE-19 | PROPOSED | الاتصال انقطع. جاري إعادة الاتصال. | The call dropped. Reconnecting. | VI-01 V06 |
| LCE-20 | PROPOSED | المكالمة وقفت. الكتابة متاحة. | The call isn't working. You can keep going in writing. | VI-01 V07 |
| LCE-21 | PROPOSED | الميكروفون غير متاح لقنديل. الكتابة متاحة. | The microphone isn't available to Qandeel. Writing is available. | G1.2 — V07 principle |
| LCE-22 | PROPOSED | كتم الميكروفون / إنهاء المكالمة | Mute microphone / End call | P4-C3 F-03 — the status of `cMute` / `cEnd` (CANON in P3-A, runtime-gated by G1.2 §6 / P4-C2 §5): decide once |

### 9.2 New rows the contract requires (drafted here)

| ID | Status | Arabic | English | Moment |
|---|---|---|---|---|
| LC-01 | PROPOSED | صوت المكالمة بيتحفظ ٣٠ يوم من بدايتها. | The call's audio is kept for 30 days from its start. | the disclosure line, CONNECTING only (§10.2) |
| LC-02 | PROPOSED | المكالمات مشغولة دلوقتي. جرّب كمان شوية، والكتابة متاحة. | Calls are busy right now. Try again shortly; writing is available. | `CAPACITY_FULL` |
| LC-03 | PROPOSED | المكالمة شغّالة على جهاز تاني. | The call is active on another device. | `OTHER_DEVICE` |
| LC-04 | PROPOSED | بيرجع الاتصال… | Reconnecting… | the reconnecting state, short form |
| LC-05 | PROPOSED | المكالمة خلصت بعد ٦٠ دقيقة. تقدر تكمّل كتابة أو تبدأ مكالمة جديدة. | The call ended after 60 minutes. You can keep going in writing or start a new call. | `SERVER_ENDED` at the maximum length |
| LC-06 | PROPOSED | فاضل خمس دقايق على نهاية المكالمة. | Five minutes left in this call. | T-5, visible; also the text of the fixed spoken clip (D-05-02; generated only after a separate explicit permission) |
| LC-07 | PROPOSED | فاضل دقيقة على نهاية المكالمة. | One minute left in this call. | T-1, visible; also the spoken clip's text (D-05-02) |
| LC-08 | PROPOSED | قنديل محتاج إذن الميكروفون علشان المكالمة. الكتابة متاحة. | Qandeel needs microphone access for the call. Writing is available. | microphone permission refused for a call |
| LC-09 | PROPOSED | افتح الإعدادات | Open settings | the action beside LC-08 |
| LC-10 | PROPOSED | المكالمة متوقفة مؤقتًا بسبب مكالمة تانية. | The call is paused for another call. | held by a phone call (J6) |
| LC-11 | PROPOSED | مكالمة مع QANDEEL | Call with QANDEEL | the ongoing call notification (Android CallStyle) |
| LC-12 | PROPOSED | QANDEEL | QANDEEL | the call's display name (J8, settled as the name) |
| LC-13 | PROPOSED | تنتهي المكالمة خلال 5 دقائق | The call ends in 5 minutes | the notification text at T-5 |
| LC-14 | PROPOSED | المكالمات: ٣٠ يوم من بداية المكالمة | Calls: 30 days from the start of the call | the retention settings row for calls (C-45's "30 days from arrival" is wrong for calls) |
| LC-15 | PROPOSED | قوطِع | Interrupted | the interrupted-reply marker (contract §2.2 `replyState`) |
| LC-16 | PROPOSED | المكالمة محتاجة موافقتك على تسجيل الصوت. | A call needs your consent to voice recording. | `CONSENT_REQUIRED` (V3 already covers calls; no new consent version) |
| LC-17 | PROPOSED | المكالمات مش متاحة دلوقتي. الكتابة متاحة. | Calls aren't available right now. Writing is available. | `NOT_AVAILABLE_NOW` (the gate is closed) |
| LC-18 | PROPOSED | عندك مكالمة شغّالة بالفعل. | You already have a call in progress. | `ALREADY_IN_CALL` |

**Not reopened:** F-01, TM-02 and C-12 (contract D-05-03).

**On the count:** the contract's inventory named 22 existing rows. They are listed exactly as found: 13 P4-C3 keys,
VI-01 V01 – V07, G1.2's V07 principle and F-03.

## 10. CP2 — Realtime Spoken Turn, QANDEEL Reply & Playout Truth (2026-11-02; UNDER REVIEW)

**Authority:** the Product Owner's S8B-05 CP2 execution task (2026-11-02), «ابدأ الآن S8B-05 CP2 فقط.» Paused at a safe
point at the Product Owner's request and resumed on «اكمل التاسك». CP2 only. Not included: the CA-05-01 coordinator, O1 – O3b,
the queue worker, L2 – L5, full barge-in, an end-to-end reconnect proof, F-01 audio, any paid test, native code or UI, any
protocol shape change, any gate, and any hosted migration.

**Base:** `main` at `50938001` (PR #374, CP1, merged). **Branch:** `s8b/s8b-05-cp2`. **Migration:** `0190` (forward-only,
not hosted). **The next migration is `0191`.**

**Constraints kept:** every §0 constraint above. `VOICE_NOTE_LIVE_TRANSCRIPT` stays OFF; the call's recognizer does not
depend on it.

### 10.1 What CP2 delivers, against the authorized items

| Item | Delivered | Where |
|---|---|---|
| **§3 ASR on the call** | The call has its own realtime recognizer (Speechmatics Enhanced `ar_en`, PCM 16 kHz), bound on the server key alone and **independent of** `VOICE_NOTE_LIVE_TRANSCRIPT`. The decoded uplink streams to it without a break. Partials never leave the engine: only FINAL words make a turn, and nothing reaches DeepSeek before the commit. There is one ledger row per connection, settled once. When the provider reports no usage, the gateway's measured audio settles it (`GATEWAY_MEASURED`). | `voice/voice.module.ts` (`LIVE_CALL_RECOGNITION`); `voice/call-turn/live-call-turn.engine.ts` |
| **D-A1 endpointing** | The server runs the endpointer: a VAD on the decoded uplink (20 ms frames, RMS ≥ 300, armed after 100 ms of speech). After 500 ms of silence it sends ForceEndOfUtterance. The final is accepted at its last FINAL, or after 1 000 ms. The turn commits after 800 ms of silence (a starting value that was measured, not a fixed rule). Speech that resumes before the commit is the SAME turn, with its finals appended in order. | `voice/call-turn/call-endpointer.ts` |
| **§4 the commit** | `server_commit_live_call_turn_v1` does all of this in one transaction: the N1 close of the open exchange; the call's next index (0189's `next_call_turn_index`, **from 1**); the USER turn (GENERATING, FAST); its voice source, with the anchor inside the USER track (the track is settled first); the call's turn order; the exchange; and the analysis queue item (R7′). It is idempotent per commit id. The phone gets `TURN_COMMITTED` (`role: USER`, `clientTurnId: null`). | `0190`; `voice/call-turn/call-turn.repository.ts` |
| **§5 the REALTIME reply** | `LiveCallReplyService` lives in the conversation module and is bound into the engine through `LiveCallConversationBinding`, because voice cannot import the orchestrator. **S1 – S3:** the ONE Safety gate sees exactly the messages the reply gets (the folded window, with the turn last; in-call retrieval is never shown to it). Its verdict is stored once, before anything is generated. BLOCK speaks the deterministic response, whole and CALM, with no provider call. **Guidance:** the turn's text guidance, then TM-02 (`withSpokenCallReply`; no TM-01, per VA-7). **Assembly:** the ONE assembler. **Generation:** DeepSeek Flash, FAST, thinking disabled, a 2 000 ms first-token limit and 5 000 ms in total, `max_tokens` 160, the reply's `AbortSignal`, through the incremental release guard (GUIDED keeps early release off). The call is attributed to the call's owner, Session and spoken turn (AI-COST-01). **L1:** the live reply has its own router (`DeepSeekModelRouter.forLiveCall`) over its own warm keep-alive HTTPS agent (8 sockets, 4 free, 15 s), shared only with the call's TTS adapter. No background queue or limit sits on this path. | `conversation/live-call-reply.service.ts`, `live-call-model-router.ts` (the production router, kept out of `conversation.module.ts`), `conversation.module.ts`; `model-router/providers/deepseek/*`; `http-transport/live-call-keep-alive-fetch.ts` |
| **§6 the reply sink** | `CallReply` sends Gemini TTS through the Listen route (its model, Achird, limits and admission), with its own adapter over the keep-alive transport. Each released piece gets one synthesis, in order. PCM 24 kHz becomes Opus 24 kHz in 20 ms frames, sent as `REPLY_AUDIO` under the connection's epoch (`chunkSeq` from 0, `offsetMs` = `chunkSeq` × 20). The route retries a retryable failure that happens before any audio. Each attempt gets one ledger row; an aborted attempt is settled with ABSENT usage, never zero. | `voice/call-turn/call-reply.ts`; `voice/call/live-call.connection.ts` |
| **§7 PLAYOUT P1 – P3** | PLAYOUT is applied in ACTIVE only, and only a higher mark advances. A resend is re-ACKed. A mark for a closed reply, or for a reply this connection never sent, is IGNORED but still ACKed. A mark for a chunk never sent, or outside its chunk, is a `PROTOCOL_VIOLATION`. The database keeps the ONE confirmed mark. It sets the reply's clock start once, never before the QANDEEL track. After the close it rejects and counts every late command. | `call-reply.ts`; `live-call.connection.ts`; `0190` |
| **§8 the QANDEEL track** | The same epoch-fenced writer (`UserTrackWriter.forTrack('QANDEEL', …)`) writes 24 kHz Ogg Opus. It holds only the packets the phone confirmed, placed at the reply's clock start + offset, with NOT_SPEAKING gaps where QANDEEL was silent. What is recorded as heard is never more than what was heard. | `voice/call/recording/user-track-writer.ts`; `live-call.connection.ts` |
| **§9 CA-05-02** | There is ONE close function, and the first commit wins (natural end `PLAYED_OUT`, N1 `NEXT_TURN`, `GENERATION_FAILED`, `CALL_ENDING`). The heard mark = min(playout, produced, QANDEEL track end − clock start), floored to 20 ms. The reply text = the segments whose end ≤ the mark. `delivery_state` is COMPLETE, INTERRUPTED, WITHHELD_TAIL or FAILED. The close emits `ConversationTurnCompleted` v2 with the stored Safety (R5′). Export My Data and the history read both carry `deliveryState` (the `GET` turns read sets it on a call reply's exchange). The contract test proves no consumer reads a call reply without it. | `0190`; `conversation/conversation.service.ts`, `conversation.types.ts`, `voice-media/voice-notes.repository.ts`; `tests/s8b-05-live-call-contract.test.mjs` |
| **§10 the context** | **N1:** one open exchange; a new turn closes it inside the same transaction. **C2:** the Session's earlier exchanges come first, then the call's by index; a typed turn in the call takes the same order. **C3:** a reply's content is what was heard. **D-05-08:** at most 12 of the call's exchanges or about 1 500 estimated tokens, never fewer than 4. Pre-call exchanges only fill up to 4. Tokens are estimated as UTF-8 bytes / 4; this over-counts Arabic, so the window errs short. **In-call retrieval:** triggered by two shared terms, or one with a recall cue (`فاكر`, `قلتلك`, `زي ما قلت`). It is one owner-scoped indexed read, raced against 80 ms, returning at most 2 exchanges and 1.5 KB, with zero provider calls. A late or failed read is skipped and counted, never an error. **An empty heard reply** is not inserted; its user words join the next user message. | `live-call-reply.service.ts`; `0190` (`call_context_exchanges_v1`, `call_turn_retrieval_v1`) |
| **L6** | The commit takes the call's own row lock. It does not take 0131's admission or the analysis lock, so the next turn never waits for an analysis. CP2 runs no analysis: it writes the queue item, and the worker belongs to CP3. | `0190` |

**The protocol:** no shape, field, limit or close code changed. PLAYOUT was removed from `NOT_YET_SUPPORTED`; BARGE_IN and
TEXT_TURN stay `REFUSED NOT_SUPPORTED_YET`. The protocol document records the CP2 implementation notes.

**CP1 statements that CP2 changes:**

- §1 and §3 said the speech sink is the null sink. The sink is now the call turn engine (`voice/call-turn/`). It reaches
  the conversation only through its binding, and `voice/call/` stays provider-free (the re-anchored S8B-05 contract; the
  S8B-02 contract passes unchanged).
- A call's turns are numbered from 1, as 0189 reserves them. The in-memory test store now numbers them the same way.

### 10.2 Proofs (all free, all local or in CI; nothing paid, nothing hosted)

**`database/verify-migration-0190.mjs` on real PostgreSQL 17: 18 / 18.**

- **T0a – T0e:** the catalogue, the ACLs, the forward-replaced functions (each matches its origin plus exactly the
  declared edits), the policy, every scope DISABLED, and the census.
- **T1:** the commit is fenced, gated and consented; the USER anchor lies inside the USER track; everything happens in one
  transaction; the commit is idempotent; a TEXT turn takes the same order.
- **T2:** R2-G: fail, cancel, recover and any status write all refuse a call turn.
- **T3:** Safety S1 – S3: stored once; storing the SAME value again succeeds; a different value is an error; there is no
  close or N1 without a stored verdict.
- **T4:** CA-05-02: the five cases, with the heard mark bounded by the QANDEEL track.
- **T5:** PLAYOUT P1 – P3: the highest mark wins, the clock start is set once, late commands are rejected and counted, and
  there is one close.
- **T6:** N1 and the long call: 40 turns, never stopped by the text windows.
- **T7:** context and retrieval under the owner's RLS.
- **T8:** AI-COST-01: a TTS row per attempt, the recognition row `GATEWAY_MEASURED`, each settled once.
- **T9:** Export My Data and the history read carry `deliveryState`; account erasure removes every new row.
- **TRC-1 … TRC-4:** natural close vs N1 in both orders, a late PLAYOUT vs the close, a spoken vs a typed commit.

The re-anchored verifiers 0150, 0153, 0168, 0183, 0185 and 0186 pass locally on the same database.

**The synthetic spoken turn** (`apps/api/scripts/s8b-05-cp2-spoken-turn-synthetic-proof.ts`, run as
`npm run prove:live-call-spoken-turn-synthetic:integration`).

- **Real components:** the gateway, the connection, the call authority, the call turn repository, `VoiceMediaService` and
  the track writers; the call turn engine; `LiveCallReplyService` (the one Safety gate, the behavioral policy with TM-02,
  the one assembler); the DeepSeek router with its accounted streaming client; and real PostgreSQL with 0190.
- **Fakes, and only these:** Speechmatics (scripted FINALs), DeepSeek's SDK `create` (streamed chunks) and Gemini TTS.
  Their delays are seeded log-normal draws from the contract's §8.1 figures (T 690 / 903 ms, G 136 / 243 ms,
  S 655 / 764 ms). Memory and preferences are empty.
- **The phone:** speaks protocol v1 over a real WebSocket with real libopus packets of a generated signal on a continuous
  20 ms uplink, and plays the reply in real time with PLAYOUT.

**Local PG17 result: 10 / 10** (S10 added by R1, §10.9). The report is kept with the contract folder as
`CP2_SYNTHETIC_PROOF_local_pg17.txt`.

- **S1:** 16 spoken turns committed (`TURN_COMMITTED` 1 … 16, `role: USER`), from FINAL words only; no partial reached the
  database or any DeepSeek request. 404 `REPLY_AUDIO` frames, each Opus 24 kHz decoding to 480 samples, with exact
  `chunkSeq` and `offsetMs`, at epoch 1. One REPLY_END per exchange, with `chunks` equal to the frames sent.
- **S2:** the five delivery cases, with the phone's REPLY_END and the database agreeing on every one:
  - COMPLETE ×12: heard = produced, both pieces in the text;
  - INTERRUPTED, part heard: 280 of 560 ms, the first piece only, closed `NEXT_TURN`;
  - INTERRUPTED, nothing heard: 0 of 560 ms, empty text;
  - WITHHELD_TAIL: the stream was cut after the first piece; that piece was heard, closed `PLAYED_OUT`;
  - FAILED: no audio, `GENERATION_FAILED`;
  - 16 `ConversationTurnCompleted` events, one per close.
- **S3:** 16 streamed DeepSeek requests, each with `max_tokens` 160, thinking disabled and the reply's abort signal, each
  sent after its turn's commit.
- **S4:** the reply after the interrupted one received the user's words and exactly the heard text, never the unheard
  piece. After the unheard and the failed exchanges, their user words were folded into the next user message with no
  empty reply inserted. Call turn 15 retrieved call turn 1 (`HIT`) after the window had moved past it.
- **S5:** heard = recorded. The QANDEEL track holds exactly the 362 packets the phone confirmed (of 404 sent), byte for
  byte and in order. The USER track holds all 3 556 uplink packets. There are 17 USER and 14 QANDEEL segments, all STORED
  and all valid Ogg Opus.
- **S6:** one ledger row per provider attempt, each settled once, nothing PENDING:
  - the recognizer: 1 (`SUCCEEDED_USAGE_REPORTED`);
  - DeepSeek: 16 (FAST, `CONVERSATION_REPLY`): 14 succeeded and 2 `FAILED_USAGE_UNKNOWN` (the failed stream and the cut
    stream);
  - Gemini: 29, one per synthesis attempt.
- **S7:** the latency stages and the window comparison (§10.3, §10.4).
- **S8:** the teardown leaves no fixture row, and every gate is as it was.
- **S9 (#35):** a 165-turn call (about 55 minutes at 20 s per turn), built from the call's typed turns, then the real
  REALTIME reply on the last turn. What was said in turn 1 comes back through in-call retrieval (`HIT`, 1 exchange; the
  read took 2 ms locally, inside its 80 ms). The window is still 12. There is one provider request and one ledger row, both
  the reply's; the retrieval made none.

**In CI:**

- The proof runs once against PostgreSQL in the full mode.
- It also runs over the wire on the oldest and newest PostgREST lines of the existing loop (v12.2.9 and v16.4), in the
  single-call mode: S1 – S6, S7's latency, S9 and S10. There, every server command and every owner read goes through
  PostgREST under an authenticated JWT and RLS.
- **The wire run is exercised for the first time in CI.** Locally only the full mode and the single-call mode ran, over
  the pg shims; the single-call mode also passed 10 / 10.

**API specs (Jest)** for the call: the CP2 suites below, plus the re-anchored `voice/call/` suites.

| Spec | Tests | What it covers |
|---|---|---|
| `voice/call-turn/call-endpointer.spec.ts` | 4 | the five moments, resumed speech as the same turn, the thresholds |
| `voice/call-turn/call-reply.spec.ts` | 9 | the five cases, P1, one close, the retry, the terms |
| `voice/call-turn/live-call-turn.engine.spec.ts` | 7 | voice to a heard reply, finals only, N1 with its stored Safety, the recognizer settled by the gateway bytes, unbound; **R1: the S3 regression and the R1b race regression (§10.9)** |
| `conversation/live-call-reply.service.spec.ts` | 20 | the window, the fold, retrieval, S1 / S2, BLOCK, GUIDED, a Safety not stored, the 80 ms skip, a provider failure; **#37 (b): six history-dependent cases from the gate's own spec give the call history the same verdict as the text history**; R1: the S3 recovery gives the reply's own verdict, and an unreadable context stores nothing |
| `model-router/providers/deepseek/deepseek-live-call.spec.ts` | 4 | REALTIME (160, no thinking, 5 000 / 2 000 ms), the first-token abort settled once, the call's keep-alive fetch |
| `http-transport/live-call-keep-alive-fetch.spec.ts` | 3 | HTTPS only, the body kinds, no redirect, abort |
| `voice/call/live-call.connection.spec.ts` | 21 | PLAYOUT applied and ACKed, a violation for an unsent chunk |
| `voice/call/recording/user-track-writer.spec.ts` | 9 | the QANDEEL track at 24 kHz |
| `voice/call/live-call.protocol.spec.ts`, `gateway/live-call.gateway.e2e.spec.ts` | 8, 7 | re-anchored: PLAYOUT ACKed, BARGE_IN refused |

**Static contracts:**

- `tests/s8b-05-live-call-contract.test.mjs` (8): re-anchored for CP2 and extended to cover 0190, the delivery-state
  consumer contract, and the CP2 proof in CI.
- `tests/s8b-04-qandeel-voice-contract.test.mjs` (14): TM-02 only on the call reply, and the call's synthesis route.
- `tests/s8b-02-voice-foundation-contract.test.mjs` (9), unchanged.
- `tests/prod-retry-01-data-api-stale-state-contract.test.mjs`: re-anchored for 0190's two PT409 sites (the same one AI-usage
  identity conflict as 0188, in the call reply speech begin and the call transcription begin).
- `tests/ai-cost-01-provider-neutral-cost-credit-ledger-contract.test.mjs` (83): the call reply is attributed, proven
  with a planted defect.

### 10.3 Latency stages — **Synthetic estimate**

These are loopback figures, with the fake providers drawing the contract's §8.1 delays. The network delay (N, 100 – 200 ms)
is added, not measured. The sample is the 14 turns that played in call A (the approved window).

| Stage | P50 | P95 |
|---|---|---|
| E: speech end → commit (the 800 ms silence + the final) | 827 ms | 902 ms |
| context read (from the commit) | 2 ms | 5 ms |
| Safety stored | 4 ms | 14 ms |
| context ready (retrieval, Memory, preferences) | 6 ms | 19 ms |
| T + G: commit → first released piece | 874 ms | 1 134 ms |
| S: first released piece → first REPLY_AUDIO | 648 ms | 741 ms |
| **speech end → first audio at the phone (measured, loopback)** | **2 336 ms** | **2 641 ms** |
| speech end → first audio, with N added | ≈ 2 436 ms | ≈ 2 841 ms |

- The server's own stages add about 5 ms at P50.
- **The 1.5 s target is not met.** The synthetic P50 to first audio is 2 336 ms. It is inside the contract's planning sum
  (≈ 2.4 – 2.6 s at P50) and is **not** a final performance success. The target is kept (D-A2); meeting it and proving it
  end to end belongs to S8B-05 and S8B-06. CP2 does not try to improve it (the Product Owner's PR #375 review).
- No real provider, network or device figure is claimed.

### 10.4 The call window (D-05-08) against a window of 4

The same scripted call ran twice with the same seeded delays: once with the approved window (12 / ≈ 1 500 / 4) and once
with a window of 4.

- The history the model receives grows with the call. At call turn 16 it is 12 exchanges (488 estimated tokens) against
  4 (178).
- **Estimated tokens per request: + 225 on average, + 340 at most** (call turns 6 – 16).
- **First audio: no measurable difference on the server side.** The recorded run gave − 10 ms on average (P50 − 2 ms,
  P95 + 15 ms); an earlier identical run gave + 9 ms (P50 + 4, P95 + 34). Both are inside the run-to-run noise: the
  longer window's extra read, fold and assembly cost a few milliseconds at most. The fake DeepSeek does not model prompt
  prefill, so the provider's cost of the longer prompt is not in this number; S8B-08 measures it.
- The two calls end with identical delivery states.

### 10.5 Acceptance items within CP2's scope (contract §11 as amended by v1.1, A1 and v1.2)

| # | Item | CP2 proof | Status |
|---|---|---|---|
| 3 | Two-way audio | S1, S5 (real Opus up and down; the reply played and recorded) | **Met for SYN**; the device belongs to S8B-06 CP1 |
| 4 | Understanding during the call | S1 (FINALs only, through the fake recognizer), the engine spec | **Met (FK + SYN)** |
| 9 | DeepSeek and Gemini on their paths | S3; `deepseek-live-call.spec.ts`; the reply spec | **Met** |
| 10 | Heard = recorded | S5; verify T4 / T5 | **Met for CP2** (rclone: CP4; the device: S8B-06) |
| 11 | Sources and anchors | verify T0b, T1, T4 | **Met** |
| 12 | Memory without inflation | the band on the voice source (T1); the event with the stored Safety for every close, including the interrupted one (T3, T4, S2) | **Met for the turn and its event**; capture through the half coordinator is CP3 |
| 24 | Voice Notes, Text and Analysis not broken | the existing verifiers and suites; the full CI run on the pull request | **Pending the full CI run** |
| 25 | No voice gate opened | 0190 opens none (contract test, T0e); S8 restores every gate | **Met** |
| 27 | An interrupted reply is not treated as complete | T4, T9; the consumer contract test; S2 | **Met** |
| 28 | Context continuity | the reply spec; S4 | **Met** |
| 29 | A call turn ends only COMPLETED | T2 (R2-G) | **Met for R2-G**; the sweep's closure of an open exchange is CP3 |
| 30 | No lost event for the user's words | T4; S2 (16 closes, 16 events, the interrupted and the failed ones included) | **Met for the event**; the half coordinator is CP3 |
| 31 | The text and message paths unchanged | no text-path file changed beyond the optional `deliveryState` in the history read; O3 not active (no CP3) | **Met locally**; the full CI run is on the pull request |
| 35 | D-05-08: window 12 + retrieval | S4, S7, S9 (minute 1 recalled at minute 55, zero provider calls, the tokens and the first-audio difference reported) | **Met (SYN)** |
| 37 | Safety parity | (a) one gate implementation (the reply spec, the S8B-04 contract); (b) six history-dependent cases give the same verdict; (c) S4; (d) two writes → one value (T3); **S3 at the call's own close points (R1, §10.9): the reply's own verdict recovered by the same gate, S10** | **Met for (a) – (c), the PG half of (d), and S3 at N1 and the reply's close**; S3 in the sweep (the call's END, a crash) is CP3 |
| 38 | Interruption and recording races | T5, TRC-1 … TRC-3 (late, repeated and post-close PLAYOUT; natural close + N1; text = confirmed segments; anchor ≤ mark; every late command rejected and counted) | **Met for the PG part (CP2)**; the injected-fault SYN part is CP4 |

**Not claimed:** any real provider, network or device behaviour; any latency outside the synthetic estimate; barge-in;
reconnection proven end to end with a reply in flight; the analysis halves.

### 10.6 What is intentionally incomplete, and where it goes

| Item | Owner |
|---|---|
| The half coordinator, O1 – O3b, the queue worker, and the sweep's closure of an open exchange: the exchange still open at the call's END, and S3 there (a turn whose Safety was never stored when the call ends or the process stops). Inside a live connection, S3 is CP2's (R1, §10.9). | CP3 (CA-05-01) |
| L2 – L5 (the critical window, the concurrency and queue limits, the retry budget) | CP3 |
| Full barge-in; echo exclusion of QANDEEL's voice from the ASR; F-01 audio; the end-to-end reconnect with a reply in flight. Until then, a PLAYOUT from an older connection after a resume is IGNORED, because the reply belongs to that connection. | CP4 |
| TEXT_TURN in a call, P4 / P5, and the 0131 text windows around it. Until then, a REST text turn that races a call commit gets the 55000 retry. | CP4 |
| The resume trusts the HELLO `sessionId` once the call authority has accepted the call; in 0189 it is the call's own session. | read and left as it stands |
| A FINAL that arrives after the commit belongs to the next turn; nothing is lost or said twice. | by design (D-A1) |
| Memory and preference commands spoken in a call are not acted on. The HIM, recommendation and question lanes are not on the REALTIME path; the bounded Memory gather and the hypothesis context are. | later Stage 8B work, under its own authority |
| Ledger rows that stay usage-unknown when an interruption aborts a synthesis (ABSENT, never zero) | S8B-08 (cost evidence) |
| `deliveryState` in the mobile history type, and the empty-bubble rule for a reply of which nothing was heard | S8B-06 (the call UI) |
| Voice-note streaming in production: the voice note's router has no `stream` in the deferred composition. | read and left as it stands (S8B-04's scope) |

**Conflicts with CP1 or S8B-06:** none that changes a frozen contract. Two alignments are recorded above:

- the null sink is replaced by the engine (CP1 §1, §3);
- call turns are numbered from 1, which S8B-06 must follow, since the protocol carries the number.

### 10.7 Backlog (CP2 is not the closing change)

`QAN-BL-VOICE-01` stays `DEFERRED — OWNED` by Stage 8B, `HIGH`; it was worked on, not delivered. CP2 admits and tombstones
nothing. Every residue in §10.6 is owned inside S8B-05 (CP3 / CP4) or by a planned task whose contract already carries it
(S8B-06, S8B-08). It is reconciled at S8B-05's closing change (BG-08).

### 10.8 Copy Gate

Unchanged: the 40 rows of §9 stay PROPOSED. CP2 adds no user-facing text: the server sends codes and audio, never copy.

### 10.9 R1 — the Product Owner's PR #375 review: S3 inside the call (2026-11-02)

**The defect (found by the review, at `c3e2c077`).**

1. `LiveCallReplyService.replyOnce()` could end `FAILED` before storing the turn's Safety, when the read of
   `call_context_exchanges_v1` failed.
2. `CallReply` then tried to close the exchange, and 0190's `close_call_exchange_core_v1` refused with
   `CALL_EXCHANGE_SAFETY_UNSETTLED`.
3. The next spoken turn waited up to 5 s, then its commit's N1 was refused for the same reason. The user's new turn was
   not committed, and its words were lost.

This broke S3 (contract Part A) and the guarantee that committed speech is not lost.

**The fix (the smallest change that closes S3 inside CP2; no migration, no coordinator, no worker, no sweep).**

- **S3, as Part A states it: the same gate, the same context reader.** `LiveCallReplyService` now has one evaluation,
  used by the reply and by the recovery alike: the owner's `call_context_exchanges_v1`, the D-05-08 window, the fold,
  then the ONE `SafetyResponseGateService.evaluate`.
  - `settleSafety()` reruns it and stores the verdict through the same 0190 command: STORED, or SAME when the generation
    stored it after all. A different value stays the 0190 Safety error.
  - The input is fixed: the reader returns only closed exchanges, and the ones before the turn are immutable under N1, so
    the recovery gives the verdict the reply would have given.
  - If the context cannot be read, it stores nothing and rejects. There is never a default and never another gate.
- **Where it runs: the call's own two close points.**
  - `CallReply` recovers the Safety before its own close (`GENERATION_FAILED`, `PLAYED_OUT`).
  - The engine recovers it before every commit's N1, after the bounded 5 s wait for the generation to store it.
  - One recovery is in flight at a time. Nothing closes an exchange without its stored Safety.
- **The next turn is held, not lost.** If the recovery cannot be done because the context is unreadable, the finished
  turn is held whole, in memory, on its connection:
  - not committed, and no `TURN_COMMITTED` is sent;
  - retried after 250 ms, doubling to 4 s;
  - any words said meanwhile join it as ONE turn, in order, the way speech that resumes before a commit does;
  - once the read is back, S3 stores the Safety, N1 closes the previous exchange, and the held turn commits with every
    word;
  - **R1b (the Product Owner's review at `7d585767`):** a retry never commits the held turn while the person is speaking.
    If the endpointer is not IDLE (speech, or a commit silence still pending), the retry leaves the turn held. The turn
    then joins the new words at that speech's commit, by the usual D-A1 rules, and only then is QANDEEL's reply started.
    If that speech gives no words, the held turn is committed on its own. At `7d585767` a retry could commit it mid-speech;
    the regression below failed there (two `TURN_COMMITTED` during speech) and passes now. No frozen value changed.
- **Not covered here:** a turn held when the connection closes is not committed and was never announced; it goes with
  the connection. The call's END and a crash, with S3 in the sweep, are CP3 (§10.6).

**Proofs.**

- **`live-call-turn.engine.spec.ts`, the S3 regression (deterministic):**
  1. Turn 1 is committed, and its generation fails before storing Safety.
  2. The exchange stays open without a Safety, and no REPLY_END is sent.
  3. Turn 2 is spoken while the context is unreadable: it is held, and nothing is committed or announced. More words
     join the held turn.
  4. The read comes back: the gate's own verdict (GUIDED, not a default ALLOW) is stored once; N1 closes turn 1 FAILED
     with one REPLY_END; turn 2 commits with all its words.
  5. A repeat is SAME, and a different value is a conflict.
- **`live-call-turn.engine.spec.ts`, the R1b race regression (deterministic):** turn 1 fails before its Safety, and turn 2
  is held. The person speaks again, and the read comes back mid-speech. For five real seconds of speech (longer than any
  retry delay) nothing is committed, announced or answered. After the commit silence there is ONE turn 2 with every word;
  N1 closes turn 1 FAILED, and the reply starts only then.
- **`live-call-reply.service.spec.ts`:**
  - The recovery gives exactly the reply's gate input and verdict, with the real gate on a history-dependent case.
  - An unreadable context stores nothing and is retried.
- **The synthetic proof's S10, on real PostgreSQL with the real gateway, engine, reply service and gate** (local PG17,
  both modes):
  - The owner's context read is taken down while turn 1 is answered: its reply fails before Safety, and the exchange
    stays open with `safety_disposition` NULL.
  - Turn 2 and more words are held: the call keeps one call turn, the phone one TURN_COMMITTED, and 7 reads were
    refused.
  - The read comes back:
    - turn 1 is closed `FAILED` / `NEXT_TURN`, with `safety_disposition` = the gate's verdict (GUIDED);
    - its USER and ASSISTANT turns are `COMPLETED` (technically), with exactly one `ConversationTurnCompleted`
      carrying GUIDED;
    - turn 2 is committed with both utterances, as one turn, and played COMPLETE; one provider request.
  - A repeated recovery through the same command returns SAME. A different value is refused with
    `CALL_TURN_SAFETY_CONFLICT`, and the stored value is unchanged.
- **Unchanged:** verify-0190 (18 / 18) and every other proof above; no migration changed. The R1 runs (full and single-call,
  10 / 10 each) are kept as `CP2_R1_SYNTHETIC_PROOF_local_pg17*.txt`. The full run shared the machine with a Jest run, so
  its latency (P50 2 469 ms) is not the reference; §10.3 keeps the quiet run (P50 2 336 ms).

## 11. CP3 — Ordered Half-Exchange Establishment & Fast Live Analysis (2026-11-02; UNDER REVIEW)

**Authority:** the Product Owner's S8B-05 CP3 execution authorization (2026-11-02): the full 05-CP3 scope of contract
v1.2 (CA-05-01; L2 – L5; A1 §1 – §3; R5′ / S3 at the END), with Fast Live Analysis as a stated priority. **Base:** `main`
at `f5de4c27`, the merge of PR #375 (CP2). **Branch:** `s8b/s8b-05-cp3`. **Migration:** `0191` (forward-only, **not
hosted**). **The next migration is `0192`.** PR #376 (S8B-06 CP1) is separate: CP3 neither touches it nor depends on it.
It was merged during CP3 as `e429ca35`, and CP3 was synced with that `main`; the two share no file but the three locators.

**Constraints kept:** no voice gate opened; no migration on a hosted database; no paid API, no F-01 or warning audio; no
real person or voice (random UUIDs, fixed synthetic Arabic sentences, no audio at all in the CP3 proof); nothing merged.

### 11.1 What CP3 delivers, against the authorized items

| Item | Where | How |
|---|---|---|
| Durable ASSISTANT half queued at the close | 0191 (close core, origin 0190) | Every close (`PLAYED_OUT`, `INTERRUPTED`, `GENERATION_FAILED`, `NEXT_TURN`, `CALL_ENDING`) queues the reply's half in the same transaction as the close and the completion event. |
| Queue states | 0191 | `PENDING → CLAIMED` (a lease) `→ COMPLETE`; `RETRY_WAIT` (a provider failure, 2 s then 4 s); `PARKED` (attempts or the daily budget exhausted, never dropped); `ABANDONED_INTEGRITY` (a permanent integrity failure confirmed once, declared with its reply, counted). |
| O1, O2 | 0191 half coordinator | A half commits only when every earlier item of the session's order is terminal: the reply's half never before its USER half (O1); the next USER half never before the whole previous exchange (O2). Ordering is by `call_turn_index`, never by a timestamp. A refusal is retryable and writes nothing. |
| O3a | 0191 (full coordinator, origin 0150) | The text path's full coordinator refuses every numbered call turn; a text exchange is unchanged. |
| O3b / B1 | 0191 (commit turn, origin 0190) | A call's first commit adopts the session's unestablished pre-call exchanges as `EXCHANGE` items numbered `1 − n … 0`, at the head of the order. *(R2, DEC-R1-1: the call's activation now adopts them, numbered to −1000; the first commit adopts only what completed after the activation, §11.11.)* |
| The Half-Exchange Semantic Coordinator | `commit_conversation_units_call_half_v1` + `ConversationSemanticEstablishmentService.establishCallHalf` | The existing engines are reused unchanged: segmentation → B1 focus → the Thread layer → LF, canonicalized; one half per batch with deterministic batch ids; D-07 (one stale re-evaluation); the USER half is analyzable while its turn is `GENERATING` (the writer, origin 0183, admits a GENERATING USER call turn and nothing else); an empty reply is a zero-unit batch with no segmentation call. It is a separate coordinator, not the full one with the COMPLETED check removed. No hindsight: a half sees only its own CUs and the committed past. |
| The Durable Ordered Analysis Worker | `apps/api/src/live-analysis/` | One active worker per session across instances (0191's claim takes the session's semantic lease, an analysis lock separate from 0131's, and the head item's lease); FIFO; pre-call first; a crashed claim lapses and is re-claimed; a half committed before a crash is REPLAYED from storage with zero provider calls; B1 – B4, L5; a 429, an outage or the budget is a retry or PARKED, never a skip. |
| Shared background permits (L2 – L5) | 0191 + `background-permits.ts` | PostgreSQL-shared permits across instances, `max(B_min, B_total − k × live generations)`, two per person, a 120 s lease renewed every 30 s. Covered: call analysis, the text exchange's semantic establishment after its reply, post-response intelligence / memory. Excluded: the live call reply, the typed reply, the voice-note reply (statically pinned). No database call on the voice path (an in-memory kick, never awaited); started calls are never cancelled; waits are bounded and measured. |
| L2 as configuration | `LIVE_CALL_ANALYSIS_START` | `AFTER_FIRST_AUDIO` (M1) is the default; `AT_COMMIT` (M1′) only when set exactly. **The default is unchanged**; §11.3 gives the numbers. A first-audio kick wakes a permit wait in the window at once instead of after its backoff step. |
| The call's end, every path, and S3 | 0191 (`end_call_v1`, origin 0189) + the worker's sweep + `LiveCallReplyService.settleEndedCallSafety` | §11.4. |

### 11.2 Proofs (all free, all local or in CI; nothing paid, nothing hosted)

- **`verify-migration-0191` — 26 / 26 on local PG17** (base: every migration through 0191): T0a – T0f (catalogue, ACL,
  forward replacements identical to their origin plus the declared edits, D-05 as amended, every end path, the gates and
  the census), T1 – T13 (the USER half while GENERATING; O1; O2; the empty reply; stale tokens; O3a; O3b; claims and
  crash recovery; L5 / B3 / the budget; the shared session lock; the permits and L2; the END, S3 and the sweep; erasure).
- **The CP3 synthetic proof (`apps/api/scripts/s8b-05-cp3-live-analysis-proof.ts`) — 51 / 51 checks on local PG17.**
  The real worker (two instances, sticky kicks, both scanning), the real half establishment, the real permits and the
  real queue over a real PostgreSQL with 0191, driven by synthetic live calls through 0189 / 0190's own commands. Stand-ins:
  the PostgREST hop (a service_role pg shim with PostgREST's error identity) and the providers (fakes with seeded
  latencies; the live reply's first token and every analysis call share ONE fake provider capacity of 8 slots).
- **API specs:** the worker (10), the permits and the post-response gate (9), the half establishment and the text permit
  (8). Every existing suite is unchanged. The full Jest run on the tree synced with `main` at `e429ca35` gave 7 715 passed,
  1 skipped and 0 failed. Before the sync, one untouched S8B-04 spec (`voice/live-reply`, a clock race) failed once under
  load; main's S8B-06 R2 fixed that race.
- **Static contracts:** `tests/s8b-05-live-call-contract.test.mjs` adds the CP3 pins (§11.6); the re-anchors are listed
  in §11.7.

### 11.3 Fast Live Analysis — **Synthetic estimate**

**Setup (local PG17, loopback; Synthetic estimate, not a final performance result).**

- 7 concurrent calls per mode: 6 calls of 8 turns and 1 long call of 20 turns. Each session first has one pre-call text
  exchange (O3b): 68 exchanges per mode.
- One fake provider capacity of 8 slots, shared by the live reply's first token and every analysis call.
  - Reply first token 380 ± 160 ms, then +120 ms to first audio, tail 450 ms.
  - Segmentation 200 ± 80, focus 240 ± 90, thread 220 ± 80 ms.
  - The reply's latencies are drawn from the same seed in every mode.
- Two instances of the worker, with sticky kicks and both scanning.
- Each analysis mode runs under the permit policy 0191 ships (B_total 16, k 2, B_min 2, two per person) and under a
  policy calibrated to the fake capacity (B_total 8).
- Two paces:
  - **stress**: the person's turn is 900 ms, an unrealistically fast exchange;
  - **conversational**: 3 s.
- Reports: `CP3_SYNTHETIC_PROOF_local_pg17_{stress,conversational}.{txt,json}`, kept outside the repository with the
  contract. Both runs: 51 / 51 checks.
- After a final refactor (the worker's integrity classification moved behind the live-focus service; no behaviour
  changed), CI's profile was rerun on its own: the calibrated policy at the stress pace, 31 / 31 checks, M1 +20 / +54 ms,
  M1′ +36 / +50 ms (`CP3_SYNTHETIC_PROOF_local_pg17_ci_profile.*`).

**First Audio (commit → first audio) against M0 (analysis off).** The contract limit is +50 ms P50 / +100 ms P95.

| Pace | M0 P50 / P95 | M1 shipped | M1′ shipped | M1 calibrated | M1′ calibrated |
|---|---|---|---|---|---|
| stress | 533 / 657 | +33 / **+104** ✗ | **+58** / **+109** ✗ | +21 / +70 ✓ | +32 / +53 ✓ |
| conversational | 523 / 658 | +13 / +1 ✓ | +45 / +30 ✓ | +0 / +17 ✓ | +10 / +18 ✓ |

An earlier stress run gave M1 shipped +48 / +133 and M1 calibrated +35 / +67. Under contention the P95 moves by tens of
milliseconds from run to run. The numbers are reported as measured; nothing is claimed as "no impact" (§4.3).

**Live Analysis (P50 / P95, ms).**

| Pace / mode | commit → first analysis work (USER half) | commit → USER half committed (= LF update) | close → reply half committed | first stable LF per call | queue depth | backlog age |
|---|---|---|---|---|---|---|
| conversational, M1 shipped | 676 / 2 177 | **1 659 / 3 138** | 1 315 / 2 765 | 3 138 / 3 330 | 1 / 14 | 271 / 1 656 |
| conversational, M1′ shipped | 3 / 2 105 | **1 242 / 3 088** | 934 / 2 726 | 3 088 / 3 236 | 1 / 11 | 77 / 1 354 |
| conversational, M1 calibrated | 791 / 2 392 | **1 785 / 3 148** | 1 336 / 2 776 | 3 148 / 3 730 | 1 / 13 | 575 / 2 368 |
| conversational, M1′ calibrated | 838 / 2 074 | **1 773 / 3 059** | 1 316 / 2 639 | 3 059 / 4 046 | 1 / 13 | 192 / 2 632 |
| stress, M1 shipped | 3 029 / 4 615 | 4 186 / 5 844 | 3 950 / 5 415 | 3 668 / 3 987 | 5 / 35 | 3 614 / 5 550 |
| stress, M1′ shipped | 2 767 / 3 801 | 3 922 / 5 012 | 3 676 / 4 711 | 3 633 / 3 922 | 3 / 31 | 1 760 / 4 776 |
| stress, M1 calibrated | 6 380 / 10 407 | **7 364 / 11 463** | 7 542 / 11 176 | 3 858 / 4 362 | 13 / 52 | 9 700 / 11 190 |
| stress, M1′ calibrated | 3 159 / 10 280 | 4 248 / 11 153 | 4 077 / 10 913 | 3 919 / 10 901 | 16 / 51 | 3 660 / 11 074 |

Notes on the table:

- The first stable LF includes the session's pre-call exchange, which is established first.
- The LF update equals the USER half's commit here, because every USER half in the workload moves the Live Focus.

**The long call (20 turns): commit → USER half committed, per turn.**

- conversational: M1 shipped settles at about 1.4 – 1.7 s from turn 2; M1′ shipped at about 1.0 – 1.1 s.
- stress:
  - M1 shipped stays at about 3.3 – 4.7 s;
  - M1′ shipped converges from 3.3 s to about 1.0 s;
  - M1 calibrated jumps to about 11 s at turn 3 and recovers only slowly (9.1 s at turn 20);
  - M1′ calibrated converges to about 1.0 s.

**Provider calls:**

- 6.62 analysis calls per exchange in every mode, the same count in every mode: no call is skipped or reduced
  (segmentation 150, focus 225, thread 75, continuity 0 per mode).
- Per minute: about 340 at the conversational pace and 600 – 710 at the stress pace, across 7 concurrent calls.
- The reply: one call per exchange.

**What it shows.**

1. **Analysis is live.** At a conversational pace the USER half is committed, and the Live Focus updated, about 1.2 – 1.8 s
   after the commit at P50 (≈ 3.1 s at P95). That is while QANDEEL is still answering or just after. The queue stays at a
   depth of 1 at P50, and every mode drains within 1.5 s of the last call.
2. **The voice is protected by the permit cap, not by L2 alone.** L2 protects only the same person's reply. On a shared
   provider, other people's analysis competes for the same capacity. With the shipped `B_total 16` on an 8-slot provider,
   the stress pace breaks the P95 limit in both modes. With `B_total` calibrated to the capacity, both modes keep it. The
   values are the contract's and S8B-08 calibrates them against the real provider. CP3 does not change them.
3. **M1 against M1′.**
   - At a conversational pace: M1′ gives the USER half about 0.4 s sooner under the shipped policy (1.24 s against 1.66 s
     P50), at +45 ms P50 First Audio against +13 ms. Under the calibrated policy the two are equal (1.77 s against 1.79 s).
   - At the stress pace with the calibrated policy: L2 and the tight cap together starve M1 (USER half 7.4 s / 11.5 s),
     while M1′ keeps 4.2 s P50 and converges in the long call.

**Recommendation (for the Product Owner's decision; nothing changed).**

- **Keep L2 (M1) as the default for now.** It has the smallest First Audio impact at a conversational pace (≤ +13 ms
  P50) and delivers the USER half within about 1.7 s.
- **Calibrate `B_total` against the real provider in S8B-08 before launch.** That cap, not L2, is what keeps the voice
  inside +100 ms P95 under shared load.
- **Revisit M1′ with S8B-08's numbers** if the real capacity is tight. Under a tight cap, M1′ keeps the analysis live where
  M1 falls behind, and stays within the voice limit (+32 / +53 ms here).

**Synthetic limits.**

- The fake capacity is a FIFO of 8 slots, not DeepSeek's real concurrency or rate limits, and its latencies are assumed.
- The database is loopback (no network hop, PostgREST replaced by a pg shim).
- One machine runs the calls, the workers and PostgreSQL.
- The workload is a fixed script, with no barge-in and no audio.
- M2 (five concurrent calls plus active post-response work) and the full E2E closure are CP4's.

### 11.4 The call's end and S3 (R5′)

- **Every end path** (explicit end, a failed connection, the server, the grace lapse, a new call's recovery, the sweep)
  goes through `end_call_v1`, which closes the open exchange **in the same transaction** when its Safety is stored:
  `CALL_ENDING`, the reply's half queued, exactly one `ConversationTurnCompleted` (T0e, T12a, T12c).
- **An exchange whose Safety was never stored stays `OPEN` after the END** and cannot be closed (T12b). This is the case
  where atomic closure and Safety recovery after a process crash genuinely conflict: the gate is TypeScript
  (`SafetyResponseGateService`), so no database transaction can run it, and a second Safety copy in the database is
  forbidden. The resolution is the contract's R5′ (A4 lists v1.1 R5's "same transaction" as superseded):
  1. the END closes atomically everything whose Safety is stored;
  2. the worker's sweep lists the ended calls' open exchanges, recomputes Safety with **the same gate over the same
     reader** (`server_read_call_context_v1`, a definer wrapper of `call_context_exchanges_v1`), stores it once through
     the 0190 command (STORED, or SAME), then closes it once (`CALL_ENDING`);
  3. a context that cannot be read leaves it OPEN for the next scan: never a default ALLOW / BLOCK, never a close
     without Safety.
  The user's turn is never lost: it is committed and kept; only its close waits for its Safety. Proven by T12b and the
  proof's R3.
- **Memory and Safety:** existing policies are preserved. `ConversationTurnCompleted` v2 is written from stored facts;
  a LOW ASR band gives no memory; an interrupted reply is not complete; no memory fact comes from untrusted speech.

### 11.5 Acceptance items reviewed (contract §11 as amended): CP3 against CP4

| # | Item | CP3 proof | Status |
|---|---|---|---|
| 13 | Live Analysis during the call | the proof's M1 / M1′ (the USER half committed while the call goes on; §11.3) | **Met (SYN) for CP3**; the full M0 / M1 / M1′ / M2 E2E closure is CP4 |
| 15 | Ordered analysis, no skip, no duplicate | verify T2, T3, T7 – T9; the proof's order, duplicate, crash and outage checks | **Met** |
| 26 | Background work never delays the voice | the proof's First Audio impact (§11.3); the static pins (no permit on a reply path, no database call on the voice path) | **Met under a calibrated permit policy; exceeded under the shipped policy on an 8-slot fake provider (reported, §11.3)**; real provider contention is S8B-08 |
| 29 | A call turn ends only COMPLETED / the last exchange closed | verify T12a – T12c; the proof's R3 | **Met** |
| 30 | No lost event for the user's words | verify T12a – T12c (one event per close, CALL_ENDING included) | **Met** |
| 32 | Recovery after a crash | verify T8; the proof's R1 (REPLAYED, zero provider calls) | **Met** |
| 33 | Cost bounded | L5 (three attempts, PARKED, the daily budget; verify T9); provider calls per exchange measured (§11.3) | **Met for CP3**; paid cost evidence is S8B-08 |
| 37 | Safety parity | S3 at the END: the same gate over the same reader (verify T12b; the proof's R3; the worker spec) | **Met for CP3**; with CP2's (a) – (d), parity now covers every close point |
| 39 | Not built on removing a check | the half coordinator is a separate definer; the full coordinator refuses call turns (O3a, verify T6) | **Met** |

### 11.6 What is intentionally incomplete, and where it goes

| Item | Owner |
|---|---|
| Barge-in, P4 / P5, TEXT_TURN in a call, F-01 audio, the injected-fault SYN part of #38, the full M0 / M1 / M1′ / M2 E2E closure | CP4 |
| The native audio engine, the call UI, device acceptance | S8B-06 |
| Calibration of `B_total`, `k`, `B_min` against the real provider's capacity, and the paid "analysis on / off" comparison | S8B-08 (the shipped values are the contract's) |
| **Deploy order:** the API's text-path permit and the post-response gate call 0191's RPCs, so 0191 must be on a database before an API that carries CP3 is deployed against it. | HOSTED-DEPLOY (operator) |
| `BACKGROUND_CAPACITY_DEFERRED`: a text exchange whose permit is not granted within 5 s is a retryable 503 cause (the stream's own retry), new in CP3. | recorded as a risk; S8B-08 calibrates the capacity |

### 11.7 Re-anchors (each says what it replaced, in its own file)

- `tests/s8b-05-live-call-contract.test.mjs`: 0191 is the last migration; the record states CP3 under review.
- `tests/canonical-home-placement-engine-contract.test.mjs`, `tests/thread-establishment-evaluator-contract.test.mjs`:
  0191's forward replacements are their origins plus the declared edits.
- `tests/prod-retry-01-data-api-stale-state-contract.test.mjs`: 0191's half coordinator raises PT409 at four sites.
- `tests/effective-live-focus-final-semantic-chain-cutover-contract.test.mjs`: the FINAL repository has five RPC call
  sites (plus the half coordinator); the half path has its own retry loop, with the same bounded recovery, pinned on its own
  slice after the exchange's; `establishExchange` takes an optional `backgroundPermitHeld`.
- `tests/conversation-focus-runtime-integration-readiness-contract.test.mjs`: the FINAL repository reads the typed
  database identity once, for the half coordinator's exact refusals only.
- No re-anchor was needed for the B1 / Thread-layer confinement contracts. The worker reaches the Thread layer only through
  the live-focus service (`establishmentIntegrityReason`). The proof takes the providers' types from the establishment
  service's own bindings.
- `database/verify-migration-0071.mjs`, `0150`, `0183`, `0185`, `0186`: the later replacements of the writer, the full
  coordinator and the voice_private internals.

### 11.8 Backlog (CP3 is not the closing change)

`QAN-BL-VOICE-01` stays `DEFERRED — OWNED` by Stage 8B, `HIGH`. CP3 admits and tombstones nothing; every residue in §11.6
is owned inside S8B-05 (CP4) or by a planned task whose contract already carries it (S8B-06, S8B-08, HOSTED-DEPLOY). It
is reconciled at S8B-05's closing change (BG-08).

### 11.9 Copy Gate

Unchanged: the 40 rows of §9 stay PROPOSED. CP3 adds no user-facing text.

### 11.10 R1 — the Product Owner's Comprehensive Correction Order on PR #377 (2026-11-03)

**Scope:** PR #377 itself, at reviewed head `e43be547`. No new checkpoint and no new pull request. No paid call, no hosted
migration, no voice gate, nothing merged. §11.1 – §11.9 are kept as written, and where R1 changes a statement this
section says so. In particular, §11.3's tables are the pre-R1 run. Its column "commit → first analysis work" actually
measured the **permit grant** (see 11.10.2).

#### 11.10.1 The CI failure: `verify:a2-e2e-runtime-smoke` (Run 41545850635), root cause from data

- **The failure.** The A2 smoke runs inside one `BEGIN … ROLLBACK`. It writes one runtime event, claims a batch of
  `claim_runtime_events(20, …)` (oldest first: `ORDER BY created_at, event_id`), and asserts its own event `PUBLISHED`.
  It read `PENDING` at `stage=OUTBOX_PUBLISH`.
- **The cause.** CI runs the CP3 proof just before A2 on the same database. The CP3 teardown swept every table by
  `user_id`. `public.runtime_event_outbox` names its subject `subject_user_id`, so that sweep never reached it.
- **The data (local PG17, CI order):**
  - after the pre-R1 CP3 proof there were **231** eligible outbox rows, every one orphaned (its subject user deleted);
  - a rolled-back diagnostic claim took **20 / 20** orphaned `ConversationTurnCompleted v2.0` rows, older than anything A2
    writes;
  - A2 then reproduced CI's failure exactly (`PENDING`, expected `PUBLISHED`).
- **Who leaves rows.** Each step was counted in CI order (verify-0189 → verify-0190 → the CP1 proof → the CP2 proof →
  verify-0191 → the CP3 proof → post-response dispatch → A2). Only the CP3 proof left rows. The CP2 proof already deletes
  the outbox by `subject_user_id` and counts it in its S8, so it is unchanged.
- **The `RuntimeEventPublisher` was not defective and is unchanged.** The claim succeeded, nothing was swallowed, and the
  batch was simply full of older rows.
- **The fix.** The CP3 teardown deletes `runtime_event_outbox WHERE subject_user_id = ANY(<its fixtures' users>)`, only its
  own fixtures' rows. A new `fixtureRowsLeft` check then counts its calls, exchanges, queue items, recordings, commit
  batches, outbox events and users after the teardown, and **fails** unless every count is 0. The proof prints that line.
- **The regression test.** `tests/s8b-05-live-call-contract.test.mjs` adds: "every proof that writes runtime events removes
  its fixtures' outbox rows by subject_user_id and proves none is left". Every script under `apps/api/scripts` that writes
  call turns must:
  - delete its outbox rows by `subject_user_id`;
  - count them after the teardown.

  The test names the CP2 and CP3 proofs explicitly, so neither can drop out of its scope.
- **What is not changed.** The batch size, any retry, the `PUBLISHED` assertion, and A2's place in CI.
- **The reruns.** After the fix, in CI order, the outbox count was **0 after every step** and A2 passed. A2 alone on a
  fresh database also passed. The final-code reruns are in 11.10.8.

#### 11.10.2 Instrumentation: what was measured, and the honest names

- The pre-R1 field `commitToFirstAnalysisWorkMs` was taken at the **permit grant**. It is now `commitToPermitGrantedMs`.
- Two new fields sit beside it:
  - `commitToClaimMs`: the session's head item claimed;
  - `commitToFirstProviderCallMs`: the first analysis provider call actually started, the true "first analysis work".
- The proof also records a per-USER-half breakdown, `userHalfStagesMs`, split into turn 1 and later turns:
  - **Before the claim:** each millisecond between the commit and the claim is classified as wake, FIFO / pre-call
    backlog, lock wait, the claim RPC, or scheduling.
  - **The permit wait:** split by the outcome of each ask (L2 critical window, the per-person limit, capacity), the grant
    RPC, and the number of asks.
  - **After the permit:** the turn and snapshot reads, the context read, the dossier read, each provider (segmentation,
    focus, thread, continuity), the provider capacity wait (queue) against the provider service time, the commit RPC,
    and the local remainder.
- How the spans are taken:
  - The service_role shim times every RPC and attributes it to its session.
  - The fake provider times every call with its capacity wait.
  - Nothing reads or logs any content.
- `SharedCapacity.utilization()` reports busy slot-time over slots × wall time.

#### 11.10.3 Improvements made (no call removed, no order relaxed, no analysis shortened)

| # | Change | Where | Why it is safe |
|---|---|---|---|
| I-1 | **0191 defect fixed: the permit cap is a COUNT of permits held, not a range of slot numbers.** Pre-R1, `server_acquire_background_permit_v1` granted any free slot in `1 … cap`. When live calls shrank the cap below the slots held, releasing a low slot let a new grant exceed the cap, in the very case the cap exists for. Now it refuses `WAIT_CAPACITY` while `count(*) ≥ cap`, then takes the lowest free slot in `1 … 64`. | 0191 (not merged, not hosted, so corrected in place) + `verify-migration-0191` **T11b** | T11b fills to the cap, shrinks it with two live calls, frees the lowest slot and asserts it is **still** `WAIT_CAPACITY` (cap − 2, held cap − 1), then `GRANTED` once the permits are freed. On the pre-R1 template it fails ("a freed low slot is not capacity"). |
| I-2 | A capacity wait asks again **as soon as this instance frees capacity** (a permit release or an exchange close), instead of only at its backoff step. The backoff cap is 500 ms (was 1 000). | `background-permits.ts` (`capacityMayHaveChanged`), the worker's `kick('EXCHANGE_CLOSED')` | A wake only re-asks. The database still decides every grant, and the gate never grants itself one. |
| I-3 | The permit is released **when the provider work ends**, before the queue item's settlement. | `call-analysis.worker.ts` | The permit covers provider work only (L3). The settlement is a database write. |
| I-4 | The context read runs **concurrently with segmentation** in the half path. | `ConversationSemanticEstablishmentService.runCallHalf` | Segmentation does not read the context. Focus still starts only after both, and the order G / I is unchanged. |

New specs:
- the permit gate: "a capacity wait asks again as soon as this instance frees capacity (a release or a close), never
  granted by it";
- the worker: "the permit goes back when the provider work ends, before the settlement; a closed exchange wakes capacity
  waits".

The live-analysis and live-focus suites give 118 / 118.

#### 11.10.4 Before / after — **Synthetic estimate** (local PG17, the workload of §11.3: 7 calls, 68 exchanges, seeds fixed, 8 fake slots)

**USER half committed (= Live Focus updated), later turns (turns ≥ 2), P50 / P95 ms:**

| Pace | Mode | Before R1 | After R1 |
|---|---|---|---|
| conversational (3 s) | M1 shipped | 1 679 / 1 993 | **1 641 / 1 920** |
| conversational | M1′ shipped | 1 242 / 1 802 | **1 183 / 1 615** |
| conversational | M1 calibrated | 1 785 / 2 659 | 1 741 / 2 143 |
| conversational | M1′ calibrated | 1 755 / 2 643 | 1 463 / 2 061 |
| stress (900 ms) | M1 shipped | 4 444 / 5 838 | 4 144 / 4 786 |
| stress | M1′ shipped | 3 922 / 4 729 | 3 788 / 4 580 |
| stress | M1 calibrated | 10 338 / 12 898 | **5 515 / 8 399** |
| stress | M1′ calibrated | 6 348 / 11 853 | 5 622 / 9 253 |

**All turns, after R1 (P50 / P95 ms):**

| Pace / mode | commit → claim | → permit | → first provider call | → USER half = LF | close → reply half | queue depth | backlog age | long-call lag, turns 2 – 20 |
|---|---|---|---|---|---|---|---|---|
| conv., M1 shipped | 3 / 2 133 | 624 / 2 135 | 626 / 2 139 | 1 666 / 3 049 | 1 281 / 2 718 | 1 / 14 | 298 / 1 756 | ≈ 1.3 – 1.9 s |
| conv., M1′ shipped | 3 / 2 067 | 5 / 2 067 | 9 / 2 069 | 1 219 / 2 915 | 882 / 2 645 | 0 / 11 | 0 / 1 419 | 1.4 s → ≈ 0.9 – 1.0 s |
| conv., M1 calibrated | 3 / 2 251 | 809 / 2 252 | 812 / 2 255 | 1 817 / 3 211 | 1 351 / 2 830 | 1 / 14 | 401 / 1 887 | ≈ 1.1 – 2.2 s |
| conv., M1′ calibrated | 3 / 2 256 | 760 / 2 258 | 762 / 2 263 | 1 594 / 3 173 | 1 175 / 2 791 | 1 / 11 | 72 / 1 881 | ≈ 0.8 – 2.0 s, ≈ 1.0 s at the end |
| stress, M1 shipped | 2 901 / 3 574 | 2 916 / 3 575 | 2 921 / 3 577 | 3 996 / 4 786 | 3 902 / 4 480 | 4 / 32 | 2 905 / 4 580 | ≈ 3.5 – 4.3 s → 1.2 s |
| stress, M1′ shipped | 2 518 / 3 374 | 2 580 / 3 375 | 2 584 / 3 376 | 3 737 / 4 580 | 3 487 / 4 282 | 2 / 30 | 1 328 / 4 495 | 3.7 s → ≈ 0.9 s |
| stress, M1 calibrated | 3 866 / 7 266 | 4 337 / 7 457 | 4 342 / 7 459 | 5 393 / 8 399 | 4 975 / 8 174 | 13 / 48 | 4 893 / 8 414 | peak 7.4 s, ≈ 4.5 s at the end (was ≈ 10 – 11 s throughout) |
| stress, M1′ calibrated | 3 506 / 8 441 | 4 246 / 8 445 | 4 248 / 8 450 | 4 976 / 9 253 | 4 889 / 9 341 | 14 / 49 | 3 714 / 9 486 | peak 6.3 s → 1.0 s |

The workload is the same in every mode:
- **6.62 analysis calls per exchange** (segmentation 150, focus 225, thread 75, continuity 0) and one reply call per
  exchange. No call was removed, before or after.
- Provider utilization: 0.25 – 0.26 at the conversational pace, 0.53 – 0.54 at the stress pace.

**First Audio impact against M0 (analysis off), P50 / P95 ms; the limit is +50 / +100:**

| Pace | Mode | Before R1 | After R1 |
|---|---|---|---|
| conversational | M1 shipped | +3 / +1 ✓ | +12 / −2 ✓ |
| conversational | M1′ shipped | +36 / +80 ✓ | +38 / +26 ✓ |
| conversational | M1 calibrated | −2 / +1 ✓ | +9 / −1 ✓ |
| conversational | M1′ calibrated | +22 / +5 ✓ | +7 / 0 ✓ |
| stress | M1 shipped | +48 / **+160** ✗ | +45 / **+162** ✗ |
| stress | M1′ shipped | **+56** / **+130** ✗ | **+63** / **+137** ✗ |
| stress | M1 calibrated | +31 / +91 ✓ | +19 / **+117** ✗ |
| stress | M1′ calibrated | +34 / +49 ✓ | +23 / +35 ✓ |

- **M1 calibrated at the stress pace is marginal and noisy.** The same configuration gave +54, +70, +91, +101 and +117 ms
  at P95 across runs.
- **The analysis now runs faster, and therefore competes more often** with the reply's first token for the same 8 slots.
- **The shipped policy (`B_total 16`) fails the voice limit at the stress pace in both modes, before and after R1.** That
  is a property of a cap set above the provider's capacity, not of the analysis code (11.10.6).

#### 11.10.5 The targets, and why they are met or not

The targets are P50 ≤ 1 000 ms and P95 ≤ 2 000 ms for the USER half, with First Audio within +50 / +100 ms.

- **P50 ≤ 1 000 ms is not reachable on this workload without removing work.** The breakdown proves it.
  - A two-sentence USER half needs four **sequential** provider calls: segmentation, then focus twice, then the thread
    layer, in the order the contract fixes (G / I). Their service time alone is **885 – 950 ms at P50** (about 1.03 –
    1.09 s at P95).
  - The database adds about 35 – 60 ms: context read 18 – 32 ms (now concurrent with segmentation), commit RPC 15 – 17 ms,
    plus the dossier and snapshot reads.
  - The local remainder is about 2 ms.
  - **M1 adds the L2 window by design: about 505 ms at P50**, the permit refused while the same person's reply is still
    before its first audio.
  - The best result is M1′ shipped at **1 183 ms P50**. The floor is the provider. Going lower would mean fewer or
    parallel semantic calls, which R1 forbids and the contract's order does not allow.
- **P95 ≤ 2 000 ms on later turns is met** by M1′ shipped (1 615) and M1 shipped (1 920) at the conversational pace. Both
  calibrated profiles land at about 2.1 s.
- **The all-turns P95 (≈ 2.9 – 3.2 s) comes from turn 1.** At the call's first commit, O3b adopts the session's pre-call
  exchange at the head of the order, and O1 / O2 require it to be established first. Turn 1's backlog is therefore
  **2.0 – 2.2 s at P50**, and turn 1's total is about 2.9 – 3.2 s.
  - The lever is to adopt pre-call exchanges at the call's activation instead of at its first turn. The contract says
    "عند أول دور", so that change is a **Product Owner decision** (DEC-R1-1). It is not made here.
- **The stress pace is limited by each session's serial order, not by the provider.**
  - At a 900 ms turn, one exchange cycle is about 1.95 s.
  - The analysis of one exchange needs about 1.6 s of sequential provider work (USER half ≈ 930 ms, reply half ≈ 660 ms).
  - Provider utilization is only 0.54.
  - The queue therefore grows by construction: one item per session at a time, O1 / O2.
  - The lever is segmentation pipelining: segmenting the next half while the current one is in focus / thread. It
    conflicts with the one-item-per-session claim and with L2, so it is a **decision** (DEC-R1-2), not implemented.
- **First Audio stays within the limit at the conversational pace in every profile after R1.** At the stress pace it
  stays within the limit only under a cap at or below the capacity (11.10.6).

#### 11.10.6 Background permits: the finding, a conservative setting, and the precondition

- **Finding (kept visible, not hidden behind a green CI profile).** 0191 ships `B_total 16, k 2, B_min 2`, two per person.
  At the stress pace on an 8-slot provider it fails the voice limit:
  - pre-R1: M1 +33 / **+104** and M1′ **+58** / **+109** (§11.3);
  - R1's runs: M1 +45 / **+162** and M1′ **+63** / **+137**.
- **Why.** `B_total` above the provider's real capacity lets background work hold slots the reply's first token then waits
  for. L2 protects only the same person's reply. Before I-1, a shrinking cap could also be exceeded.
- **The improvement for voice priority without starving analysis.**
  - I-1 makes the cap real.
  - I-2 / I-3 hand capacity back the moment the provider work ends, so the analysis keeps its throughput under a lower
    cap.
- **A conservative setting to propose for the period before calibration (NOT applied; a PO decision, through
  `set_background_permit_policy_v1`):** `B_total 4, k 1, B_min 1`, two per person. It does not assume the real capacity
  is 8; it uses half of the fake's.

  | Pace | Mode | First Audio impact | USER half, later turns | long-call lag |
  |---|---|---|---|---|
  | conversational | M1 conservative | +3 / +2 ✓ | 2 141 / 3 988 | ≈ 1.2 – 1.8 s from turn 8 |
  | conversational | M1′ conservative | +12 / +5 ✓ | 1 919 / 3 638 | ≈ 0.9 – 1.1 s from turn 8 |
  | stress | M1 conservative | +6 / +19 ✓ | 14 344 / 19 689 | ≈ 16 – 20 s |
  | stress | M1′ conservative | +4 / +7 ✓ | 10 564 / 21 117 | peak 10.4 s → 5.7 s |

  It protects the voice at both paces. In exchange, at the stress pace the analysis falls well behind, though it is never
  skipped: 6.62 calls per exchange and drained after the call.
- **Limits and risks.**
  - The simulation does not prove the real provider's capacity, concurrency or rate limits. The fake is a FIFO of 8 slots
    with assumed latencies.
  - A cap too low delays analysis and Live Focus. A cap too high breaks the voice limit.
  - Only a real-provider calibration settles the values.
- **Precondition.** A calibration of `B_total / k / B_min` against the real provider (S8B-08) comes **before any launch and
  before any uncontrolled paid load**. The M1 / M1′ / off comparison stays in S8B-08's plan. No value is changed in CP3.
- **CI.** CI now runs the CP3 proof under `CONSERVATIVE`, and **asserts** the voice limit there for M1, the default. Every
  other profile it runs is printed as `REPORTED … exceeds` when it fails, measured and never hidden. Pre-R1, CI ran
  `CALIBRATED`.
- **The Product Owner's decision (DEC-R1-3, 2026-11-03, R2).**
  - The default values are **not** changed: 0191 keeps `16 / 2 / 2`.
  - `CONSERVATIVE` is **not** the launch setting merely because the voice passes there. Its analysis latency under stress
    (10 – 14 s for a USER half) is unacceptable.
  - SHIPPED, CALIBRATED and CONSERVATIVE stay visible side by side. **CI now runs all three** (R2), and enforces only M1
    under CONSERVATIVE, as a test profile. The others print `REPORTED`. A static test pins both.
  - The real-provider capacity calibration is a **precondition for launch**. It compares M1, M1′ and analysis off, and
    covers the synchronized-arrival case of §11.11.4.

#### 11.10.7 M1 against M1′ after R1, and the recommendation (nothing changed without approval)

- **Which is faster.** M1′, in every profile and at both paces:
  - conversational shipped: 1 183 against 1 641 ms P50 (later turns);
  - the long call converges to about 1 s with M1′ and 1.3 – 1.9 s with M1;
  - stress shipped: 3 788 against 4 144;
  - stress conservative: 10 564 against 14 344.

  M1 pays the L2 window, about 0.5 s per USER half.
- **Which protects the voice better.** M1 at the conversational pace (+12 / −2 against +38 / +26 shipped). Both are within
  the limit there. At the stress pace the cap decides, not L2: both fail under the shipped cap and both pass under the
  conservative one.
- **Recommendation.**
  - **Keep M1 (`AFTER_FIRST_AUDIO`) as the default.** It has the smallest First Audio cost where people actually talk.
  - **Conditions for M1′ at launch:** S8B-08 measures the real provider with M1′'s First Audio within +50 / +100 ms
    under the calibrated cap, at the expected concurrency.
  - **Before merge:** no further engineering improvement is available without either removing semantic work or a
    decision (DEC-R1-1, DEC-R1-2, DEC-R1-3).
- **The Product Owner's decision (DEC-R1-4, 2026-11-03, R2):** M1′ is **not** the default. M1 stays, and M1′ is decided by
  the S8B-08 comparison.

#### 11.10.8 Safety recovery across a real restart (R4) and the final verification

- **R4 (new in the CP3 proof).** Two real OS processes (`spawnSync` of the same script):
  1. A call ends while its last exchange's Safety is not stored. **Process A** runs the worker with a context reader that
     fails every time. It makes two scans, leaves the exchange `OPEN` with no disposition, and writes nothing dependent:
     A established `1:USER, 1:ASSISTANT, 2:USER` only.
  2. A exits. **Process B** (another pid) starts with the reader recovered. It stores the Safety disposition, equal to
     the same gate run independently over the same context, and closes the exchange **once** with `CALL_ENDING`:
     - one completion event;
     - one ASSISTANT half (B establishes `2:ASSISTANT`, COMPLETE);
     - the queue stays in order;
     - no duplicate commit.

  Pending facts stay pending. There is no default ALLOW / BLOCK. No gap was found, so nothing else changed.
- **`verify-migration-0191`: 27 / 27** on local PG17 (T11b added; 26 / 26 before).
- **Final local verification on the R1 tree:** these were run on local PG17 against a template migrated from this branch's own 0190 and 0191.
  - **CI order** (verify-0189 → verify-0190 → CP1 proof → CP2 proof → verify-0191 → CP3 proof under `CONSERVATIVE` → post-response
    dispatch → A2): every step exits 0, and the runtime outbox holds **0** rows after every step.
    - verify-0191 passes 27 / 27.
    - The CP3 proof passes 35 / 35, including R4 and the teardown residue check (all zeros). First Audio stays within limits:
      M1 +5 / −11, M1′ +12 / −1.
    - A2 passes.
  - **A2 alone** on a fresh database passes.
  - **The CP3 proof with all three profiles at the conversational pace** passes 75 / 75. Every mode's First Audio is within
    limits (+2 / +9 … +27 / +51).
  - **Jest** (apps/api): 336 suites; 7 717 passed, 1 skipped, 0 failed.
  - **Static contracts:** `node --test tests/*.test.mjs` gives 1 754 / 1 754.
  - **Typecheck:** `tsc -p apps/api/tsconfig.scripts.json` is clean.
  - **A non-vacuity check:** the new outbox test fails on the pre-R1 proof and passes on R1.
  - **A note on the local harness, not on the code:** the scratch template behind the perf runs above (`base191c`) was built
    from a pre-`d96f2a8c` 0190, which lacks one history read (`server_read_call_reply_delivery_v1`). Nothing in CP3 calls that
    read. The template was rebuilt from this branch, and the final runs above use the rebuilt template.
- **Reports:** `E:\QANDEEL_REPORTS\S8B-05\CP3-R1\` (the before / after / conservative runs, JSON and logs).

#### 11.10.9 Open decisions for the Product Owner (as written in R1; their dispositions in R2 follow the table)

| # | Decision | What it would change |
|---|---|---|
| DEC-R1-1 | Adopt pre-call exchanges (O3b) at the call's activation instead of at its first turn | Turn 1's ≈ 2 s backlog; contract wording "عند أول دور" |
| DEC-R1-2 | Segmentation pipelining (the next half's segmentation while the current half is in focus / thread) | The stress-pace lag; conflicts with one item per session and L2 |
| DEC-R1-3 | The permit values before calibration: the conservative `4 / 1 / 1` against the shipped `16 / 2 / 2` | The voice limit under load against analysis lag |
| DEC-R1-4 | M1′ as the default | Not recommended before S8B-08 |

**Dispositions (the Product Owner, 2026-11-03, R2):**
- **DEC-R1-1:** approved direction, conditional on proof. Implemented, with the amendment annex: §11.11.
- **DEC-R1-2:** a bounded study only. Closed with evidence, no amendment: §11.12.
- **DEC-R1-3:** not approved. The values are unchanged, CONSERVATIVE is not a launch setting, and calibration is a
  precondition for launch: §11.10.6.
- **DEC-R1-4:** not approved. M1 stays the default: §11.10.7.

### 11.11 R2 — DEC-R1-1: O3b at the call's activation (the Product Owner, 2026-11-03; approved direction, conditional on proof)

**The decision.** Pre-call exchanges whose analysis is not established enter the analysis order when the call is
**activated**, not at its first spoken turn. Conditions:
- the mandatory order (old exchanges before the call's halves) holds;
- nothing is skipped or analysed in hindsight;
- the voice path is not slowed;
- the number of semantic calls does not change;
- idempotency and crash recovery hold.

**The contract.** An explicit amendment annex of contract v1.2 replaces only O3b's timing line ("عند أول دور في المكالمة")
and re-words acceptance item 33: `S8B-05_CONTRACT_v1.2_AMENDMENT_DEC-R1-1_O3B_TIMING.md`, next to the contract in the
Product Owner's reports folder `S8B-05`. No other contract or item is opened. It takes effect in `main` only with the
merge.

#### 11.11.1 What changed (0191, not merged, not hosted, so corrected in place)

| Where | Change |
|---|---|
| `voice_private.adopt_pre_call_exchanges_v1(call, user, session, p_reserve)` | Takes a **reserve**, refused `22023` if NULL or negative. With no EXCHANGE yet on the call, the session's unestablished pre-call exchanges are numbered in their present order so the last is `-p_reserve`. With some already adopted, a later adoption continues after the call's last EXCHANGE index. Nothing is adopted at index ≥ 1, the first turn's (`WHERE x.idx < 1`). |
| `server_activate_call_v1` (0189's, forward-replaced in 0191 by the substitution `activate-call-o3b`) | The first `CONNECTING → ACTIVE`, **in the same transaction**, adopts with a reserve of 1000. The items end at −1000; slots −999 … 0 stay free for an exchange that completes before the first turn. A retried or replayed activation adopts nothing new (the exchanges are already on the call). |
| `server_commit_live_call_turn_v1` (first turn) | Still adopts, now with reserve 0: only what completed between the activation and the first turn, after the activation's items. Nothing is adopted after the first turn (O3a governs text written during the call, unchanged). |
| `LiveCallConnection` / `LiveCallService` | After the ACTIVE state is sent, the connection kicks the analysis worker with `CALL_ACTIVATED`, in memory and never awaited, with no database call on the voice path. |

Not changed: the worker, the coordinators, L2–L5, the permits and their values, B1–B4, the text path, the number or kind
of provider calls.

#### 11.11.2 Proofs

- **`verify-migration-0191`: 28 / 28** on local PG17. T7 was re-anchored (−1001 / −1000, adopted at activation, before any
  turn). The new **T7b** covers:
  - a retried activation adopts nothing;
  - a text exchange in flight across the activation (created and claimed before it, finalized after) is adopted at the
    first turn at −999, after −1000. Its claims run in order, and the USER half is refused `CALL_HALF_OUT_OF_ORDER`
    until then;
  - after a played reply, a text exchange and a second turn adopt nothing;
  - an overflow (an EXCHANGE already at index 0) adopts 0;
  - a negative reserve is refused `22023`.
- **Static contracts.** A new test pins:
  - the adoption inside the activation's transaction, just before its answer;
  - the first turn's reserve-0 adoption;
  - the continuation and the `< 1` bound;
  - the kick after the ACTIVE state, never awaited.

  It fails on the R1 0191.
- **Jest:** the connection spec adds "the activation kicks the analysis worker once, with the session, after the ACTIVE state".
- **The CP3 proof:** every mode kicks `CALL_ACTIVATED` and checks that the activation adopted every pre-call exchange
  before any turn. The pre-call index is re-anchored to −1000.

#### 11.11.3 Before / after — **Synthetic estimate** (local PG17, the CP3 workload, fake providers on 8 shared slots)

The measured interval is the first turn's commit → its USER half committed, and the first turn's First Audio. Each cell
was run "before" on the R1 0191 (`base191d`) and "after" on this 0191 (`base191e`). Variables:
- 0, 1 or 2 pending pre-call exchanges;
- the gap from the activation to the first turn's commit (it includes the person's whole first utterance and its
  endpointing): 0.5 / 1.5 / 3 / 6 s.

**The person's own path: one call, five repetitions per cell, SHIPPED permits.** P50 / P95 in ms.

| Mode | Pending | Gap | First USER half, before → after | First Audio, before → after | Semantic calls |
|---|---|---|---|---|---|
| M1 | 0 | any | unchanged (1 452 – 1 587 → 1 469 – 1 550) | unchanged | 30 = 30 |
| M1 | 1 | 0.5 s | 2 755 / 2 979 → **1 683 / 1 934** | 530 / 544 → 530 / 539 | 60 = 60 |
| M1 | 1 | 1.5 s | 2 930 / 3 091 → **1 527 / 1 593** | 532 / 539 → 530 / 536 | 60 = 60 |
| M1 | 1 | 3 s | 2 790 / 3 024 → **1 564 / 1 648** | 531 / 536 → 528 / 541 | 60 = 60 |
| M1 | 1 | 6 s | 2 868 / 2 993 → **1 460 / 1 778** | 534 / 542 → 533 / 550 | 60 = 60 |
| M1 | 2 | 0.5 s | 3 929 / 4 378 → **2 903 / 3 343** | 536 / 543 → 534 / 566 | 90 = 90 |
| M1 | 2 | 1.5 s | 3 897 / 4 023 → **1 830 / 1 985** | 533 / 537 → 530 / 539 | 90 = 90 |
| M1 | 2 | 3 s | 3 944 / 3 996 → **1 525 / 1 677** | 529 / 530 → 535 / 554 | 90 = 90 |
| M1 | 2 | 6 s | 4 161 / 4 400 → **1 600 / 1 727** | 532 / 538 → 531 / 548 | 90 = 90 |
| M1′ | 1 | 1.5 s | 2 437 / 2 487 → **987 / 1 100** | 532 / 540 → 544 / 547 | 60 = 60 |
| M1′ | 2 | 3 s | 3 285 / 3 433 → **911 / 1 121** | 535 / 539 → 534 / 538 | 90 = 90 |

- With pending exchanges and a gap of 1.5 s or more, turn 1's USER half returns to what a call with **no** pending
  exchange costs: M1 ≈ 1.5 s, M1′ ≈ 0.9 – 1 s. Before, it was 2.8 – 4.2 s.
- At 0.5 s the backlog is only partly absorbed: the person committed before the analysis finished.
- **First Audio is unchanged in every cell**: ±12 ms P50, at most +23 ms P95.
- The number of semantic calls is identical in every cell, before and after.
- The order is identical in every cell: every pre-call EXCHANGE first, then `1:USER`, `1:ASSISTANT`, each once.

**Shared capacity: seven calls activated and speaking at the same instant.** One run per cell, all three permit profiles,
both modes. The full tables are in the reports.

| Profile | Mode | Pending / gap | First USER half, before → after | First Audio, before → after |
|---|---|---|---|---|
| SHIPPED | M1 | 1 / 1.5 s | 3 326 / 3 436 → 1 794 / 1 972 | 519 / 653 → 514 / 648 |
| SHIPPED | M1 | 2 / 3 s | 4 440 / 4 857 → 1 670 / 1 870 | 514 / 665 → 510 / 659 |
| SHIPPED | M1 | 1 / 0.5 s | 3 189 / 3 345 → 2 566 / 2 682 | 520 / 646 → **681 / 739** |
| SHIPPED | M1 | 2 / 1.5 s | 4 481 / 4 783 → 2 598 / 3 182 | 527 / 648 → **627 / 766** |
| CALIBRATED | M1 | 1 / 0.5 s | 3 101 / 3 515 → 2 549 / 2 671 | 520 / 651 → **661 / 780** |
| CALIBRATED | M1 | 2 / 1.5 s | 4 264 / 4 766 → 2 613 / 3 331 | 515 / 654 → **634 / 738** |
| CONSERVATIVE | M1 | 2 / 0.5 s | 4 921 / 9 389 → 4 469 / 8 089 | 512 / 641 → **594 / 693** |
| CONSERVATIVE | M1 | 1 / 1.5 s | 4 221 / 5 771 → 2 807 / 4 131 | 514 / 666 → **578** / 647 |
| CONSERVATIVE | M1 | 2 / 3 s | 6 384 / 8 369 → 3 993 / 4 763 | 526 / 658 → **579 / 724** |
| CONSERVATIVE | M1 | 2 / 6 s | 6 214 / 9 677 → 1 994 / 2 886 | 522 / 651 → 518 / 653 |

#### 11.11.4 The voice path: what the numbers show, and the decision left

- **The person's own voice path is not slowed.** On its own, the first reply starts as before in every cell.
- **Shared capacity is a different matter.** When seven people connect and finish their first sentence at the same
  instant, within 1.5 s of connecting, their pre-call analysis is still running on the shared provider when their seven
  first replies start. Then:
  - under SHIPPED and CALIBRATED, First Audio rises +54 … +161 ms P50;
  - under CONSERVATIVE, it rises +52 … +82 ms P50 and up to +66 ms P95, in cells where the cap of 4 keeps the analysis
    running longer (up to 3 s).
- **Why.** L2 protects a person's reply from that person's work that has **not started**. Work started before the
  critical window is never cancelled, and before DEC-R1-1 none existed at that instant. This is the same class as the
  §11.10.6 finding (background work holding provider capacity that replies then wait for). Only the real provider's
  capacity calibration (S8B-08) can say whether it exists outside the fake's shared FIFO of 8.
- **The smallest further protection, NOT implemented (a decision):** an L2 check at each provider-call boundary inside an
  item. The establishment would wait between segmentation, focus and thread while the person's reply is in its critical
  window. This would bound the overlap to at most one provider call. It touches the semantic establishment service, which
  the text path shares, and adds a wait inside an item.
- **Recommendation: accept DEC-R1-1 as implemented.**
  - The person's own path is unchanged.
  - The calls are unchanged.
  - The turn-1 backlog is removed where people actually talk (≥ 1.5 s).
  - Synchronized arrivals at sub-1.5 s gaps are added to S8B-08's calibration plan, beside M1 / M1′ / off.
- **Reports:** `E:\QANDEEL_REPORTS\S8B-05\CP3-R2\` (single-call and seven-call matrices, every profile, JSON and logs).

### 11.12 R2 — DEC-R1-2: Segmentation pipelining, a bounded study, CLOSED with evidence

**The question (the Product Owner, 2026-11-03).** Can a committed half's segmentation be prepared ahead, with:
- no out-of-order commit;
- no competition with the voice reply in its critical window;
- no change to the ordering rules or L2?

This was a study and a small synthetic proof, not a checkpoint.

**What was tried (harness only; never in the product, removed from the proof after the study, kept in the reports as
`DEC-R1-2_study_proof_with_segmentation_prefetch.ts`).**
- When the worker claims an item, the session's **next** queued half is read from the database.
- Its segmentation is asked of the provider **ahead**:
  - under its own shared background permit, asked **once** (`maxWaitMs 0`), with L2's critical window respected in every
    mode;
  - nothing is prefetched inside the person's critical window or without capacity.
- The half's own in-order establishment then uses that proposal instead of a second call.

**Why that is safe.**
- A segmentation's whole provider input is the committed text and its role, and a committed call turn never changes. So a
  prefetched proposal is input-identical: never stale.
- Nothing is written by a prefetch.
- The commit stays in order.
- The study counted every prefetch started and used: none was wasted (started = used), so the semantic calls stayed
  **6.62 per exchange** in every run.

**Results — Synthetic estimate** (the §11.3 workload, 7 calls, 68 exchanges, 8 fake slots; CALIBRATED and CONSERVATIVE).
USER half, commit → committed, P50 / P95 in ms.

| Pace | Mode / profile | Prefetches (of 136 halves) | Baseline | With prefetch | Long-call peak lag, baseline → prefetch |
|---|---|---|---|---|---|
| conversational (3 s) | all four | **0** | — | — | unchanged |
| stress (0.9 s) | M1 CALIBRATED | 36 | 3 963 / 7 077 | 3 946 / **8 939** | 6.3 s → **9.7 s** |
| stress | M1′ CALIBRATED | 27 | 3 380 / 7 358 | 2 887 / **8 933** | 3.7 s → **6.0 s** |
| stress | M1 CONSERVATIVE | 17 | 10 021 / 18 255 | 9 882 / 17 849 | 11.5 s → 11.6 s |
| stress | M1′ CONSERVATIVE | 11 | 9 463 / 15 863 | 7 572 / **18 367** | 11.7 s → 7.6 s |

- **At the conversational pace there is nothing to pipeline.** When an item is claimed, the next half is never yet in the
  queue (depth ≈ 1), so the prefetch never started.
- **At the stress pace the bottleneck is the backlog** (capacity, the one-item-per-session order), not an item's own
  service:
  - a half's provider service is ≈ 0.9 s, of which segmentation is ≈ 0.2 s;
  - the wait before it is 3 – 9 s.

  A prefetch saves at most that 0.2 s, in 8 – 26 % of the halves. It also holds a permit, so it competes with the
  in-order work for the same capacity.
- P50 improved by 0.02 – 0.5 s in three configurations, within the run-to-run spread, and by 1.9 s in M1′ CONSERVATIVE.
- **P95 got worse in three of four configurations** (+1.9 s / +1.6 s / +2.5 s), and the long call's peak lag got worse
  under CALIBRATED.
- First Audio was not worsened: under CONSERVATIVE, M1 and M1′ stay within limits with and without prefetch.

**Verdict: no substantial improvement without a contract change. The idea is closed; no amendment is proposed and CP3 is
not widened.** What would move the stress-pace lag is capacity (S8B-08's calibration), not pipelining one step of an
item.

### 11.13 R2 — API CI on `db832c72`: the S6-06 media proof's P04, root cause from data

**The failure.** API CI run 41593403908, job `verify-api`. The S6-06 CP1 media proof
(`database/prove-0162-introduction-media-store.mjs`) failed at P04: "P04 intro-media/… is gone from the data directory",
`true !== false`. Everything before it passed:
- the CP3 proof;
- `verify-migration-0191`;
- the A2 smoke (the outbox fix of §11.10.1 held).

The removal answered `REMOVED`, the reads were refused at once, and the files existed before `worker.runOnce()`. The
rclone log showed a `LIST BUCKET` and no `DELETE`.

**Reproduced locally, exactly.** Local PG17, `rclone serve s3` v1.75.1 (the pinned version, sha256 checked against the
release's SHA256SUMS) and PostgREST v12.2.9, as CI runs them.
- **On a copy of the database after the local CI-order run** (verify-0189 → … → CP3 proof → A2), the proof fails at P04
  with CI's message.
- **On a fresh database** it passes.

Temporary diagnostics were added to the proof for these runs only and removed after them (`s606-diag.cjs` in the reports).
On the failing run they show:

| Question | Answer from the data |
|---|---|
| The fixture rows after `REMOVED` | three `intro-media/` rows; `not_before` = the removal's `clock_timestamp()`, earlier than the database clock at the claim; `lease_id` / `lease_until` NULL; `attempts` 0; `image_series.series_state` `RETIRED` |
| The rest of the queue | **426 `voice-call/` rows, all due** |
| `server_claim_introduction_media_erasures_v1(25, 120)` (run in a rolled-back transaction just before `runOnce`) | **25 rows, all `voice-call/`**, no error; 0 fixture keys |
| `runOnce()` | `{ swept: 0, erased: 0, deferred: 25, enqueued: 0 }` |
| rclone | 1 `LIST BUCKET` (the cycle-1 reconciliation), 0 `DELETE`, 0 `HEAD` |
| After `runOnce` | the three fixture rows unchanged; 25 voice keys deferred with a back-off |

**So:** the claim neither returned zero rows nor failed silently, and DELETE / HEAD never ran. The claim leases the 25
**oldest** due keys. 426 voice keys, older than the photo's, filled it. The proof's worker has no audio store, so it
defers a voice key without contacting the storage server. That is why the log shows a listing and no delete.

**Where the 426 keys came from: this pull request's own CP3 proof.**
- It adds call segments (`server_add_call_segment_v2`) that are never uploaded, and ends its calls.
- 0183's `seal_call_recording_v1` queues each pending segment's key with `not_before` = its upload deadline + the
  late-upload grace, so they come due minutes later, by the time CI reaches the PostgREST step.
- Its teardown removed the recording objects but not their queue rows: the queue keys on `storage_key`, so the
  teardown's `user_id` sweep never reaches it.
- On `main`, no proof before S6-06 leaves due voice keys. The CP1 and CP2 proofs add no call segment. That is why
  `main` is green.

**The fix (test-only, the narrowest).** No production change, no change to the S6-06 proof, no sleep, no retry:
- The CP3 proof's teardown deletes its fixtures' erasure-queue keys before their recording objects.
- Its residue check adds `erasure_queue_keys`. It reads the fixtures' keys before the teardown and must count 0 after it.
- A new static test fails any proof that adds call segments and ends calls without both.
- It is non-vacuous: it fails on the pre-fix proof.
- The census after every CI step found the same class, smaller, in this PR's `verify-migration-0191`. Its race fixtures
  are erased through the real account erasure (`server_erase_account_v1`), which correctly queues their segment keys:
  6 queue rows and 6 `account_erasure_private.media_pending` rows were left behind. That is under the claim of 25, but
  it is the same residue.
  - Its teardown now reads the fixtures' keys before the erasure and removes both kinds of row with the deletion records.
  - It asserts that none is left, and the static test pins it.
  - `verify-migration-0191` passes 28 / 28 and leaves 0 / 0.

The photo erasure engine is correct as written. A due key is never dropped: a deferred key backs off and the next cycle
claims the next 25, and a production worker composes the audio store too.

**After the fix.** The local CI order now runs the CP3 proof under all three profiles, as CI now does. After every step
it counts the runtime outbox and the erasure queue, then runs the S6-06 proof on the same database:
every step exits 0, and the runtime outbox and the erasure queue are **0 / 0 after every step** (before the fix: 426 due `voice-call/` keys after the CP3 proof, and 6 after `verify-0191`). The CP3 proof passes **82 / 82** under all three profiles, including its new residue check `erasure_queue_keys: 0`. The A2 smoke passes. **The S6-06 proof then passes on the same database** (`Verified S6-06 CP1 media path …`). It also passes alone on a fresh database.

### 11.14 R2 — final verification on the R2 tree (local; GitHub CI on the pushed head is the gate)

These were run on local PG17 against a template migrated from this branch's own 0190 and the R2 0191 (`base191e`):
- **CI order** (verify-0189 → verify-0190 → CP1 proof → CP2 proof → verify-0191 → CP3 proof under SHIPPED, CALIBRATED and
  CONSERVATIVE, as CI now runs it → post-response dispatch → A2), then the **S6-06 media proof on the same database**:
  - every step exits 0, and the runtime outbox and the media erasure queue are 0 after every step;
  - `verify-migration-0191` passes 28 / 28;
  - the CP3 proof passes **82 / 82**, with its residue check all zeros, `erasure_queue_keys` included;
  - First Audio impact against analysis off, at CI's stress pace:
    - M1 CONSERVATIVE +6 / +12, enforced and passed;
    - M1′ CONSERVATIVE +16 / −3;
    - CALIBRATED +30 / +27 (M1) and +20 / +25 (M1′);
    - SHIPPED +70 / +127 (M1) and +80 / +112 (M1′), printed `REPORTED`: the §11.10.6 finding, kept visible;
  - A2 passes;
  - S6-06 passes.
- **S6-06 alone** on a fresh database passes.
- **Jest** (apps/api): 336 suites; 7 718 passed, 1 skipped, 0 failed.
- **Static contracts:** `node --test tests/*.test.mjs` gives 1 756 / 1 756. There are three new static tests, each shown
  to fail without its change:
  - O3b at activation;
  - CI's three profiles;
  - the erasure-queue residue.
- **Typecheck:** `tsc` for apps/api and for `tsconfig.scripts.json` is clean.
- **Not run locally:** the hosted database (nothing is hosted), any paid provider, any voice gate.
- **Local harness:** rclone v1.75.1 for Windows (sha256 equal to the release's SHA256SUMS) and PostgREST v12.2.9 for
  Windows (the official release asset, byte size equal to the release's), in the session's scratchpad only and deleted
  after the runs. CI runs the Linux builds of the same versions.
- **Reports:** `E:\QANDEEL_REPORTS\S8B-05\CP3-R2\`:
  - the DEC-R1-1 matrices;
  - the DEC-R1-2 study and its code;
  - the S6-06 reproduction with its diagnostics, rclone logs and the claim reproduction script;
  - the final CI order.

### 11.15 R2 — API CI on `3d13b8ea`: a latent timing flake in `verify-migration-0189` (L4), fixed in the test only

- **The failure.** API CI run 41610402755 failed at "Verify S8B-05 CP1 live call authority (0189)", scenario L4. The
  message was `unexpected rejection code 23514 (wanted 23503)`, from `recordings_retention_check`.
- **The cause.** L4 inserts a `LIVE_CALL` recording for a call that does not exist and expects the foreign key's 23503.
  The insert set `started_at` and `retention_expires_at` from two separate `clock_timestamp()` calls. Those can differ by
  a microsecond, and the check from 0183 (`retention_expires_at = started_at + interval '30 days'`) then refuses the row
  first. This flake is already on main. It is the only such site in the verifiers (grep).
- **The fix.** Both values now come from one `statement_timestamp()`, which is fixed within the statement. The scenario
  still expects 23503, and nothing else changed: no migration, no product code, no sleep or retry.
- **Local proof:** `verify-migration-0189` passes 24 / 24 on a fresh R2 template.

## 12. CP4 — Final Live Call Integration & Closure (2026-11-03; S8B-05's closing change)

**Authority:** the Product Owner's «S8B-05 CP4: Final Live Call Integration & Closure — Product Owner Execution Direction»
(2026-11-03): a boundary review first, then CP4's five parts (A full barge-in, B TEXT_TURN in a call, C end-to-end
reconnection, D F-01 and recording integrity, E the complete synthetic integration), then the closure. **Base:** `main` at
`5f1e0561`, the merge of PR #377 (CP3). **Branch:** `s8b/s8b-05-cp4`. **Migration:** `0192` (forward-only, **not
hosted**). **The next migration is `0193`.**

**Constraints kept:** no voice gate opened; no migration on a hosted database; no paid API; no F-01 or warning audio
generated (the proof plays a generated tone from a temporary directory, never committed); no real person, voice or user
data (random UUIDs, fixed synthetic Arabic and English sentences, synthetic tones); the S8B-06 Android engine is not
rebuilt; no phone UI, no Replay, no S8B-07; no GCR-01 SHARED permit or deferral; M1, L2, `B_total`, `k`, `B_min` and the
SHIPPED permit defaults unchanged; Safety stays in TypeScript (no second copy in the database); nothing merged.

**Precedence of the other open work:** PR #378 (GCR-01, the Product Owner's pre-launch gate) is documentation only and not
part of CP4. CP4 neither implements nor narrows it; its content is not touched, and the locators below are prepended
beside it.

### 12.1 The boundary review (sent to the Product Owner before the work, as directed)

- **Already in place from CP1 – CP3:** the frozen protocol shapes of `BARGE_IN` and `TEXT_TURN`, both refused
  `NOT_SUPPORTED_YET`; P1 – P3 (heard = confirmed playout, the anchor ≤ the mark, every late command rejected and
  counted); N1 (the next commit closes the open exchange); resume and fencing by the connection epoch; the 30 s grace; the
  QANDEEL track writer; R5′ / S3 at the END; the ordered halves (O1 – O3b) and the worker.
- **Missing, and CP4's:** the barge-in onset and the echo bound; a typed exchange inside the call (D-05-07: its reply is
  text, never spoken) and the guard of the 0131 text paths around a live call; the drain of a dropping connection's
  speech; the open exchange an older connection left (P5); F-01's playout; the M2 mode of the matrix; the injected-fault
  SYN part of #38 / #39.
- **Not CP4's, kept out:** the native engine and the call UI (S8B-06), Replay (S8B-07), the paid evidence (S8B-08), the
  First Audio contention correction and the ≤ 2 s Live Focus target (GCR-01-A).
- **No architectural conflict** was found that the approved contract cannot hold. No decision needed the Product Owner
  before the work.

### 12.2 What CP4 delivers, against the five parts

| Part | Where | How |
|---|---|---|
| **A — Barge-in** | `live-call.connection.ts`, `live-call-turn.engine.ts`, `call-reply.ts`, 0192 `server_record_call_barge_in_v1` | `BARGE_IN` (ACTIVE only, once per `msgId`, ACKed) stops QANDEEL's reply at once: no REPLY_AUDIO after the ACK, the generation is never finished, and the next committed turn closes it `INTERRUPTED` with only what was heard (N1, P1 – P3 unchanged). The first onset is stored (fenced by the epoch; it closes nothing). A barge-in for a closed exchange is late: ACKed, counted, nothing changed. **Echo exclusion:** a FINAL whose mapped capture end falls inside (the reply's playout start, the onset] is QANDEEL's own voice heard by the microphone and is left out of the person's turn; the turn's start moves to the onset, so the person's first words are kept and QANDEEL's voice is never recorded as theirs. The stream-to-capture map follows every uplink break. PLAYOUT, `deliveryState` and the recording stay correct: the QANDEEL track carries only the confirmed frames. |
| **B — TEXT_TURN** | the connection, the engine (`CallTextReply`), 0192 (`server_close_live_call_text_exchange_v1`, the admission trigger), `live-call-reply.service.ts` | The typed turn takes its place in the call's single order, behind any spoken turn still waiting (one backlog of SPEECH and TEXT turns), and stops QANDEEL's voice as a barge-in does (T1 at sending, #40). Applied once per `clientTurnId` (the commit id), ACKed once committed without moving `lastMsgId`, or `REFUSED` with its reason. The reply is text (D-05-07): `TURN_COMMITTED` ASSISTANT when there is text, then `REPLY_END` with `chunks: 0`; a PLAYOUT on it is a violation. The exchange closes `TEXT_REPLIED` (`COMPLETE` or `WITHHELD_TAIL`), `FAILED`, or `INTERRUPTED` when N1 or the END closed it first. **The 0131 race:** a REST typed turn or a Voice Note admitted into a session whose call has not ended is refused `LIVE_CALL_IN_PROGRESS` (55000, nothing written), under the person's call lock, by one `BEFORE INSERT` trigger on the `RECEIVED` user row; neither frozen function is re-created; outside a call nothing changes. |
| **C — Reconnection** | the connection (`lose`, `handOver`, `endByPerson`, `endByServer`), the engine (`drain`, the inherited exchange), 0192 `server_read_open_call_exchange_v1` | A dropping connection (or a same-phone resume on the same instance) first **drains** its speech under its own epoch (bounded at 3 s): spoken replies stop, the utterance in progress is force-ended, every waiting turn is committed in order and its exchange's Safety settled (S3). A drained turn is not answered (nobody would hear it). The connection that resumes (on the same instance or another) reads the open exchange the older connection left (fenced), settles its Safety once before its first commit, and that commit closes it (N1). The phone's resend from `resumeFromCaptureMs` fills the hole; an old epoch is `FENCED`. A PLAYOUT or BARGE_IN resent after the resume is applied while that exchange is still open, rejected (P3) once it is closed. |
| **D — F-01 and recording integrity** | `call-failure-line.ts`, `voice.module.ts` (`LIVE_CALL_FAILURE_LINE`), `call-reply.ts`, `listen/wav.ts` (`wavToPcm`) | When a reply produced nothing (generation failed before any audio), the call plays the fixed failure line F-01 from its pinned files (D-05-02), encoded once per language as 20 ms Opus 24 kHz packets and chosen by the words of the exchange; it is written to the QANDEEL track only as far as it is heard, and the exchange stays `FAILED` with heard 0 (it is not a reply). **While the files are NOT_INSTALLED (the repository's state, unchanged), nothing is played**: no random text, no synthesized line, no assumed copy approval. Interruption, the call's end, a generation failure, an incomplete recording, deletion and retrieval are each proven (§12.3). |
| **E — Synthetic integration** | `s8b-05-cp4-live-call-closure-proof.ts` (new); `s8b-05-cp3-live-analysis-proof.ts` (M2 added) | §12.3 and §12.4. Functional success is reported apart from the speed criterion. |

### 12.3 Proofs (all free, all local or in CI; nothing paid, nothing hosted)

- **`verify-migration-0192` — 15 / 15 on local PG17** (base: every migration through 0192): T0a – T0e (the exchange's new
  columns and checks, ACL, the forward replacements identical to their origin plus the declared edits, the admission
  trigger's shape, the four scopes DISABLED and the census), T1 (barge-in fenced, first onset kept, closes nothing; late
  rejected and counted), T2 / T2b (N1 after a barge-in: only what was heard; before anything was heard: `INTERRUPTED`, never
  `FAILED`), T3 / T3b / T4 (the typed exchange: `COMPLETE`, `WITHHELD_TAIL`, `FAILED`, no close without Safety, not fenced by
  the epoch; closed first by N1 or the END: `INTERRUPTED`, the late text close `ALREADY_CLOSED`; a spoken exchange never by
  text), T5 (the text paths refused while `CONNECTING`, `ACTIVE` and `RECONNECTING` within the grace; admitted elsewhere,
  after the end and when lapsed), T6 (P5: the older connection's open exchange read by the holder; `NONE` once closed).
- **The CP4 synthetic proof — 10 / 10 on local PG17.** Two Nest instances (A, B) with the real gateway, connection,
  engine, reply service, Safety gate, recording writer and 0189 – 0192, over a real PostgreSQL; a synthetic phone (real
  Opus up and down, resume with resend, confirmed playout); stand-ins only for the providers (a fake DeepSeek with OK /
  FAIL / SLOW plans, the fake recognizer, a fake TTS) and the PostgREST hop (pg shims with PostgREST's error identity):

  | | Scenario | Result |
  |---|---|---|
  | X1 | BARGE_IN during QANDEEL's voice | 0 reply frames after the ACK; onset stored; `INTERRUPTED`, heard 600 ms = played 600 ms; heard text = the first pieces only; the next turn is the person's words only (the echo excluded, observed), anchored from the onset |
  | X2 | TEXT_TURN during QANDEEL's voice; REST in the call | the spoken reply `INTERRUPTED`, 0 frames after; one commit by `clientTurnId`, channel TEXT, `TEXT_REPLIED` / `COMPLETE`, ASSISTANT announced, `REPLY_END` chunks 0; the REST typed turn refused 55000 |
  | X3 | a drop on the same instance mid-reply and mid-utterance | drained: one turn, every word, under epoch 1; resumed (epoch 2) within 1.5 s from capture 10 020 ms; 0 reply frames after the drop; turns 1 … 6 once each; no gap left |
  | X4 | a drop during generation, resumed on the other instance | epoch 3 on B; the inherited exchange's Safety stored and closed by N1 (`INTERRUPTED`); 0 late frames; the next reply `COMPLETE`; an epoch-2 commit `FENCED` |
  | X5 | injected faults | late / repeated PLAYOUT and a late BARGE_IN change nothing (2 rejections counted); a BARGE_IN lost with the network, resent at the resume, applied once |
  | X6 | the 60 minutes end during a reply | `SERVER_ENDED`; the last reply `CALL_ENDING` / `INTERRUPTED` with what was heard; every exchange closed; the recording `STORED`, 0 ledger rows pending; QANDEEL track 85 packets = 85 confirmed (93 played; recorded ≤ heard); the USER track whole (1 580 packets, 31.6 s, 0 gaps) |
  | X7 | order, context, retrieval, export | 11 call turns once each, 1 … n, spoken and typed in place; the next reply's context carries the typed exchange; in-call retrieval finds the typed turn; the export carries the delivery states |
  | X8 | F-01 installed / not installed | installed (the tone fixture): 20 / 20 packets played and on the QANDEEL track, `FAILED`, heard 0; not installed: 0 packets, `FAILED` |
  | X9 | account erasure | every row of the call removed (exchanges with their onsets and text replies, call turns, recordings) |
  | X10 | teardown | no fixture row left (calls, exchanges, recordings, call turns, outbox events, ledger rows, users); every voice gate as it was |

- **The CP3 proof with M2 — 113 / 113 checks on local PG17** under SHIPPED, CALIBRATED and CONSERVATIVE (§12.4).
- **The CP1 and CP2 proofs on 0192 — the CP1 proof 8 / 8 and the CP2 proof 10 / 10, run in CI order on one fresh 0192 database (after every verifier), followed there by the CP4 proof 10 / 10 again.** The earlier verifiers on the 0192 tree: `verify-migration-0002`, `0063` – `0072`, `0082`, `0083`, `0090`, `0092`, `0093`, `0123`, `0128`, `0130`, `0131`, `0151`, `0152`, `0171`, `0172`, `0183` – `0192` (31 verifiers) all pass on that database.
- **API specs:** the engine (8 new CP4 cases: barge-in with the echo bound, no exclusion without a barge-in, TEXT_TURN,
  order behind a held turn, the drain, the resume with the inherited exchange and a resent PLAYOUT, F-01 installed / not
  installed), the connection (4 new cases replacing the NOT_SUPPORTED one), `call-failure-line.spec.ts` (new), the
  protocol and gateway specs re-anchored. Voice and conversation: 62 suites, 1 457 tests. The full API run: 337 suites; 7 732 passed, 1 skipped, 0 failed.
- **Static contracts:** `tests/s8b-05-live-call-contract.test.mjs` 16 / 16, with three CP4 pins (0192's shape and the CI
  order, F-01 NOT_INSTALLED and no logging, M2 reported not enforced) and the re-anchors of §12.7. `node --test tests/*.test.mjs database/tests/*.test.mjs` without `forward-safety-contract`: 3 034 / 3 034. That one test copies the repository and re-runs every suite; on this machine it ran past 9 minutes without finishing and was stopped, so it is left to CI. One S8B-04 pin is re-anchored (§12.7). `test:task-closure-governance-contract` 24 / 24.
- **Mobile:** no mobile file changed; `src/voice-call` Jest 28 / 28 (the phone's protocol mirror still parses every reason code, `NOT_SUPPORTED_YET` included, which stays in the frozen protocol).
- **Typecheck:** `tsc` for `apps/api` and for `tsconfig.scripts.json` is clean.
- **CI:** the API workflow runs `verify-0192` after the CP3 proof, then the CP4 proof.

### 12.4 M0 / M1 / M1′ / M2 — **Synthetic estimate** (functional success apart from the speed criterion)

**Functional (enforced):** under every mode and profile, every exchange was established once in the analysis order (pre-call first, FIFO by `call_turn_index`), one active worker per session across the two instances, no duplicate batch, O3b adopted every pre-call exchange first, and in M2 every post-response delivery ran through the real post-response gate, delayed and never dropped (52 / 52 under each profile). The next turn was never refused by the analysis lock.

**Speed (reported, not enforced here; the criterion and its correction are the Product Owner's GCR-01-A):**

Local PG17, two instances, one fake provider of 8 shared slots, seeds fixed. M0 / M1 / M1′: 7 calls, 68 exchanges. M2: 5
calls, 52 exchanges, each closed exchange followed by one post-response provider call; M0_M2 is the same 5 calls with
analysis and post-response off. Impact = the mode against its own M0 (ms). **Synthetic estimate**, not a final
performance result.

| Mode | Profile | First Audio P50 / P95 | Impact P50 / P95 | Commit → Live Focus P50 / P95 |
|---|---|---|---|---|
| M0 | — | 533 / 664 | — | — |
| M1 | SHIPPED | 602 / 795 | **+69 / +131** | 2 504 / 3 896 |
| M1′ | SHIPPED | 623 / 775 | **+90 / +111** | 2 554 / 3 607 |
| M1 | CALIBRATED | 560 / 723 | +27 / +59 | 3 722 / 8 806 |
| M1′ | CALIBRATED | 577 / 721 | +44 / +57 | 3 534 / 7 471 |
| M1 | CONSERVATIVE | 541 / 681 | +8 / +17 | 9 693 / 19 814 |
| M1′ | CONSERVATIVE | 532 / 674 | −1 / +10 | 10 592 / 20 494 |
| M0_M2 | — | 512 / 669 | — | — |
| M2 | SHIPPED | 519 / 668 | +7 / −1 | 6 519 / 16 181 |
| M2 | CALIBRATED | 513 / 668 | +1 / −1 | 7 763 / 18 507 |
| M2 | CONSERVATIVE | 511 / 673 | −1 / +4 | 11 341 / 24 363 |

The trade the table shows is the known one (§11.10.6): a stricter permit policy protects First Audio and delays Live
Focus. In M2 the post-response work takes background permits too, so Live Focus waits longer while First Audio stays
protected; M2's five calls press the provider less than M1's seven, so its impact is not comparable with M1's.

**#34 (voice priority across users, §4.3 of v1.1: ≤ +50 ms P50 and ≤ +100 ms P95 against the same run's M0):** under SHIPPED, M1 **+69 / +131 ms** and M1′ **+90 / +111 ms**: **NOT MET** (printed `REPORTED`). Under CALIBRATED and CONSERVATIVE, and in M2 under all three profiles, it is within.
This is the known First Audio contention the Product Owner deferred to GCR-01-A (2026-11-03, PR #378). CP4 does not
implement the SHARED permit or the deferral, and does not change M1 or the SHIPPED defaults.

**The Live Focus ≤ 2 s P95 target (GCR-01-A item 6), measured where the proof covers it:** commit → durable Live Focus
P95 **3 896 ms** at best (M1 SHIPPED), up to 24 363 ms (M2 CONSERVATIVE); P50 2 504 – 11 341 ms. **Not met**; it stays GCR-01-A's to prove.

### 12.5 Acceptance items (contract §11 as amended by v1.1, A1 and v1.2): CP4 and the closure

| # | Item | CP4 proof | Status |
|---|---|---|---|
| 6 | Barge-in works | X1, X5; T1, T2, T2b; the engine and connection specs | **Met (SYN)**; the device (AND, a launch blocker) is S8B-06 |
| 7 | The person's first words kept | X1 (the uplink never stops; the turn anchored from the onset; the echo left out) | **Met (SYN)**; AND → S8B-06, the paid text quality → S8B-08 |
| 8 | No late audio | X1 – X4 (0 frames after the ACK, the drop, the resume) | **Met (U + SYN)** |
| 10 | Heard = recorded | X1, X6 (the QANDEEL track = the confirmed frames), X8 (F-01 only as heard) | **Met (SYN + PG)**; the device → S8B-06 |
| 13 | Live Focus and the map from approved speech, in order | X7; the M1 / M1′ / M2 modes (§12.4) | **Met** |
| 15 | The map does not slow the voice | §12.4 | **Functional: met** (the next turn is never refused by the analysis lock; no item dropped). **The speed criterion: not met under SHIPPED (reported, §12.4; GCR-01-A)** |
| 16 | Reconnection to the same call | X3, X4 (30 s, two instances, fencing) | **Met (PG + SYN)**; AND → S8B-06 |
| 17 | Honest close on failure | X6, X8; T3b | **Met** |
| 24 | Voice Notes, Text and Analysis not broken | the existing suites and verifiers on 0192; the admission trigger only inside a live call (T5) | **Met locally; the full CI run is on the pull request** |
| 25 | No voice gate opened | 0192's guard; T0e; X10 | **Met** |
| 31 | The text and message paths unchanged | T5 (refused only during a live call); the text suites unchanged | **Met** |
| 32 | The queue under pressure | the CP3 proof's outage and budget cases, now with M2 (§12.4) | **Met (SYN)** |
| 34 | Voice priority across users | §12.4 | **NOT MET under SHIPPED; within under CALIBRATED and CONSERVATIVE (SYN, reported)** → GCR-01-A |
| 38 | Interruption and recording races (the SYN part) | X1 – X6 (late / repeated PLAYOUT, a barge-in lost then resent, a drop in and out of the grace, TEXT_TURN during speech, N1 + the END) | **Met (PG + SYN)** |
| 39 | Pending analysis and the drop | the CP3 proof (O3b, faults on analysis only, drain in order, no hindsight, crash without duplicate) on 0192 | **Met (PG + SYN)** |
| 40 | T1 at sending | X2 (sending stops QANDEEL's voice and closes it `INTERRUPTED` under P2) | **Met (SYN)**; DEV → S8B-06 CP3 |

Items 3, 5, 14, 21 – 23 and 36 are device items (S8B-06); 7's and 33's paid parts are S8B-08's. Every other item is closed
by its own checkpoint (§5, §10.5, §11.5).

### 12.6 Exceptions and limits (each with its owner and date)

| Exception / limit | Owner | Date |
|---|---|---|
| **#34 under SHIPPED**, the First Audio contention across users, and the ≤ 2 s Live Focus P95 target (§12.4): reported, not met | `GCR-01-A` (the Product Owner's decision of 2026-11-03, PR #378) | before voice launch |
| **An instance crash** (as opposed to a disconnect) loses the transcript of an utterance not yet committed on that instance. Its audio is kept (the USER track is durable as received); nothing is lost on a disconnect (the drain). | `GCR-01` (instance loss), admitted as `QAN-BL-VOICE-07` | 2026-11-03 |
| **A drained turn is not answered**, and **REPLY_END is not announced on the new connection** for an inherited exchange (the phone learns its close from the history). A PLAYOUT resent on the new connection writes no QANDEEL audio beyond what was recorded at the close (heard ≤ recorded at the close). If the resume fails after a same-instance hand-over, the older connection's speech stays drained, never lost. | `S8B-06` CP3 (the call UI and the device acceptance), admitted as `QAN-BL-VOICE-06` | 2026-11-03 |
| **F-01's audio files** are NOT_INSTALLED; until they are, a reply that produced nothing is silent and closes `FAILED`. Generating them needs the Product Owner's separate permission and the Copy Gate (D-05-02). | `S8B-06` CP3 (with the call Copy Gate) | 2026-11-03 |
| **Device items** (#3, #5, #6 AND, #14, #16 AND, #21 – #23, #36, #40 DEV) | `S8B-06` (contract plan) | per the contract |
| **Paid evidence** (real speed, provider capacity, calibration of `B_total`, `k`, `B_min`) | `S8B-08` (`QAN-BL-VOICE-05`) | per the contract |
| **Deploy order:** the API's typed-turn and barge-in paths call 0192's RPCs, so 0192 must be on a database before an API carrying CP4 is deployed against it. | `HOSTED-DEPLOY` (operator) | before any hosted deployment |

### 12.7 Re-anchors (each says what it replaced, in its own file)

- `tests/s8b-05-live-call-contract.test.mjs`: no message is `NOT_SUPPORTED_YET`; BARGE_IN and TEXT_TURN are applied while
  ACTIVE; 0192 is the last migration.
- `apps/api/src/voice/call/live-call.protocol.spec.ts`, `live-call.connection.spec.ts`, `gateway/live-call.gateway.e2e.spec.ts`:
  the NOT_SUPPORTED cases replaced by the applied commands.
- `tests/s8b-04-qandeel-voice-contract.test.mjs`: TM-02 is applied to every spoken call turn; a turn typed during the call takes
  the text guidance alone, since its reply is text (D-05-07).
- `database/verify-migration-0183.mjs`, `0185`, `0186`, `0191`: 0192's forward replacements of the close, the delivery read
  and the voice_private internals.

### 12.8 Backlog (BG-08) — the closing change

S8B-05 owned no item by its own name. It worked `QAN-BL-VOICE-01` for Stage 8B: **worked, not delivered**; it stays
`DEFERRED — OWNED` by Stage 8B, `HIGH`, with a current-truth note (the live call server is delivered; the device, the paid
evidence, the gate decisions and GCR-01 remain).

- **Admitted:** `QAN-BL-VOICE-06` (the resume residue of §12.6, owner `S8B-06`) and `QAN-BL-VOICE-07` (the instance crash
  and the cross-user contention / Live Focus target, owner `GCR-01`).
- **Tombstoned:** none.
- **Read and left as they stand:** `QAN-BL-VOICE-02` … `05` (S8B-08), `QAN-BL-PROD-06` / `08` (0189 – 0192 not hosted),
  `QAN-BL-LAUNCH-01` (the edge limit), `QAN-BL-AI-01`, `QAN-BL-ACE-02`, `QAN-BL-MOB-01`.
- Every residue of §6, §10.6 and §11.6 is now closed by a checkpoint or owned: CP3's and CP4's items are delivered above;
  S8B-06, S8B-08, GCR-01 and HOSTED-DEPLOY hold the rest.

### 12.9 Copy Gate

Unchanged: the 40 rows of §9 stay PROPOSED. CP4 adds no user-facing text: the server sends codes, audio and the reply's
own text, never copy. F-01, TM-02 and C-12 are not reopened.

### 12.10 Reports

`E:\QANDEEL_REPORTS\S8B-05\CP4\` (outside the repository): the boundary review, the CP4 proof log, the CP3 proof with M2,
the verifier runs.
