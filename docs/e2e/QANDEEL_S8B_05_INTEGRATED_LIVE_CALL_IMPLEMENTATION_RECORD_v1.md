# QANDEEL S8B-05 — Integrated Live Call: Implementation Record v1

**Checkpoint:** S8B-05 CP1 — UNDER REVIEW (2026-11-02). CP1 (Call Authority, Gateway, Admission & User Track) is on
`s8b/s8b-05-cp1` as a **Draft pull request, not merged; merge only on the Product Owner's explicit «ادمج»**. S8B-05 is
**not closed**. CP2 – CP4 and S8B-06 are **not started and not authorized**.

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
