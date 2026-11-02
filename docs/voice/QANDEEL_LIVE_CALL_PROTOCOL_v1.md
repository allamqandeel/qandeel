# QANDEEL Live Call Protocol v1 (`qandeel.live-call.v1`)

**Status:** FROZEN by S8B-05 CP1 (2026-11-02), under the Integrated Live Call Contract v1.2 FINAL (Part A, 05-CP1 Scope C).
The code statement of the same protocol is `apps/api/src/voice/call/live-call.protocol.ts`, and
`tests/s8b-05-live-call-contract.test.mjs` keeps the two identical. **A change is a new protocol version, never an edit of
this one.**

**What CP1 implements:** the transport, authentication, HELLO / resume, the uplink audio and the USER track, MUTE / UNMUTE,
TOKEN_REFRESH, HEARTBEAT, END, STATE, ACK, REFUSED and CALL_ENDING. **What is only frozen:** the shapes of PLAYOUT,
BARGE_IN, TEXT_TURN (client) and TURN_COMMITTED, REPLY_AUDIO, REPLY_END (server). Their logic belongs to S8B-05 CP2 – CP4.
In CP1 the server answers each of those client messages with `REFUSED NOT_SUPPORTED_YET` and never ACKs one, and it never
sends any of those server messages.

## 1. Transport

```
GET wss://<api>/voice/calls/connect          TLS ends at the trusted proxy; no query string, ever
Sec-WebSocket-Version: 13
Sec-WebSocket-Protocol: qandeel.live-call.v1  required, exactly
Authorization: Bearer <access token>          the same Supabase token check as every guarded route
```

- The token never travels in the URL. It travels in a message body only as `TOKEN_REFRESH`.
- No extension is negotiated. Per-message deflate is never accepted.
- **A refused upgrade gets a plain HTTP status before any frame:**

  | Status | Meaning |
  |---|---|
  | 400 | malformed |
  | 401 | not authenticated: no token, or an invalid or expired one |
  | 404 | another path, or any query string |
  | 426 | not WebSocket version 13 |
  | 429 | rate limited |
  | 503 | this instance is full, or authentication is unavailable |

- A text frame is one JSON control message; a binary frame is one audio frame.
- Frames are never fragmented: FIN is set on every frame.
- Client frames are masked (RFC 6455).
- **Limits checked before anything is buffered:** a text frame is at most 4096 bytes, a binary frame at most 1295 bytes
  (20 + 1275), and a control frame at most 125 bytes. Anything larger closes the socket with `1009`.

## 2. Binary frames

Big-endian, a 20-byte header, then one Opus packet of 1 … 1275 bytes.

| offset | size | AUDIO (client → server, kind `0x01`) | REPLY_AUDIO (server → client, kind `0x02`; CP2) |
|---|---|---|---|
| 0 | 1 | kind | kind |
| 1 | 1 | version = 1 | version = 1 |
| 2 | 2 | flags = 0 (reserved) | flags = 0 (reserved) |
| 4 | 4 | connection epoch | connection epoch |
| 8 | 4 | seq: per call, +1 per packet produced | call_turn_index of the reply |
| 12 | 4 | captureMs: the call's capture clock | chunkSeq within the reply, from 0 |
| 16 | 4 | reserved = 0 | offsetMs within the reply |

**Uplink (D-C1):** Opus, mono, 16 kHz, one 20 ms packet per frame, FEC on, DTX off.

- The server refuses anything that is not a mono 20 ms Opus packet (TOC check).
- The capture clock starts at 0 on the call's first packet. It keeps running while the call is muted or reconnecting.
- So every `captureMs` is a multiple of 20, and the USER track's clock **is** the capture clock.

**Downlink (CP2):** Opus, mono, 24 kHz, 20 ms.

## 3. Messages

**Client → server (text, JSON, exact keys; any other key, a missing key or a bad value is a protocol violation):**

| type | fields | CP1 |
|---|---|---|
| `HELLO` | `v: 1`, `callId`, `sessionId`, `clientInstanceId` (UUIDs), `resume: boolean` | implemented; first message, exactly once |
| `HEARTBEAT` | `n` (u32) | implemented; once a second |
| `MUTE` / `UNMUTE` | `msgId`, `captureMs` (multiple of 20) | implemented; ACKed |
| `TOKEN_REFRESH` | `msgId`, `accessToken` (≤ 3500 chars, no whitespace) | implemented; the same person or the socket closes `4001` |
| `END` | `msgId` | implemented; ends the call `USER_ENDED` |
| `PLAYOUT` | `msgId`, `callTurnIndex`, `chunkSeq`, `playedMs` | shape frozen; `REFUSED NOT_SUPPORTED_YET` |
| `BARGE_IN` | `msgId`, `callTurnIndex`, `captureMs` | shape frozen; `REFUSED NOT_SUPPORTED_YET` |
| `TEXT_TURN` | `msgId`, `clientTurnId`, `text` (1 … 2000 chars) | shape frozen; `REFUSED NOT_SUPPORTED_YET` |

AUDIO is the binary frame above.

**Server → client:**

| type | fields | CP1 |
|---|---|---|
| `STATE` | `callId`, `state`, `epoch`, `startedAt`, `resumeFromCaptureMs`, `lastMsgId`, `endsAt`, `endReason`, `heartbeatMs` | sent |
| `ACK` | `msgId` | sent |
| `REFUSED` | `reason`, `msgId` (or null) | sent |
| `CALL_ENDING` | `endsInMs` (300000, then 60000) | sent |
| `TURN_COMMITTED` | `callTurnIndex`, `role`, `turnId`, `clientTurnId` | shape frozen; not sent |
| `REPLY_END` | `callTurnIndex`, `chunks`, `deliveryState` | shape frozen; not sent |

REPLY_AUDIO is the binary frame above (CP2).

**`STATE.state`:** `CONNECTING` | `ACTIVE` | `RECONNECTING` | `ENDED`.

**`endReason`:** `USER_ENDED` | `PEER_LOST_AFTER_GRACE` | `SYSTEM_INTERRUPTED` | `FAILED` | `SERVER_ENDED`.

**`REFUSED.reason`:**

| reason | when |
|---|---|
| `PROTOCOL_VIOLATION` | the client broke this protocol |
| `NOT_SUPPORTED_YET` | a CP2 – CP4 message in CP1 |
| `CONSENT_REQUIRED` | no current voice consent |
| `NOT_AVAILABLE_NOW` | the voice gate is closed |
| `CAPACITY_FULL` | every realtime seat is taken (calls and live voice notes share them) |
| `ALREADY_IN_CALL` | the person already has an unended call |
| `SESSION_NOT_ACTIVE` | the session is not active |
| `NOT_FOUND` | not this person's call, or no such call |
| `OTHER_DEVICE` | a resume from another client instance |
| `FENCED` | a newer connection holds the call |
| `TOKEN_INVALID` | a refreshed token was refused, or the token expired |
| `OVERLOADED` | a rate or queue bound was exceeded |
| `COMMAND_CONFLICT` | the call id is already used differently |
| `UNAVAILABLE` | the server could not answer |

## 4. The call's life on one connection

1. **New call.** `HELLO {resume: false}` leads to `server_begin_call_v1` (0189), which decides ownership, the session,
   consent, the PERSONAL_LIVE_CALL gate, one unended call per person and a realtime seat. The server answers
   `STATE CONNECTING` with `epoch 1`, or `REFUSED` with a reason, and the socket closes `4004`.
2. **Activation.** The first AUDIO frame (`captureMs 0`) activates the call. `started_at` is written once and the call's
   recording opens in the same transaction. The server answers `STATE ACTIVE`. A CONNECTING call that does not become
   ACTIVE in time ends `FAILED`.
3. **Resume.** After a lost socket, `HELLO {resume: true}` from the **same client instance** gives a new epoch.
   - The connection holding the old epoch is fenced. It closes `4003`, either at once on the same instance or at its next
     lease renewal (≤ 5 s) on another one, and changes nothing more.
   - `STATE` names `resumeFromCaptureMs`, the USER track's durable end. The phone resends what it still holds from there
     (at most 2000 ms of audio).
   - The rest of the hole becomes a `RECONNECTION` gap. A resume never creates a new call. A resume of an ended call
     answers `STATE ENDED` with its end reason.
4. **Lost connection.** A lost socket, silence, an expired token, a violation or an overload is **not** an end.
   - The server writes what it received, then suspends the call: `RECONNECTING` for the 30-second grace, the seat kept.
   - After the grace the authority's sweep ends it `PEER_LOST_AFTER_GRACE` and seals the recording.
   - A server that stops renewing (a crash) leaves an ACTIVE call whose lease lapses. The sweep ends it
     `SYSTEM_INTERRUPTED`.
5. **End.** `END` leads to `server_end_call_v1 USER_ENDED`. The server answers `ACK`, then `STATE ENDED`, then closes
   `1000`. The recording is sealed and the seat released in the same transaction.
6. **Maximum length** (D-05-06). `CALL_ENDING` is sent 5 minutes and 1 minute before the end. At the end the server ends
   the call `SERVER_ENDED`.

## 5. Ordering, duplicates, resend

- Within one connection `seq` rises by exactly 1. A lower `seq` is a resend and is dropped; a jump is a violation.
- `captureMs` rises by exactly 20.
  - A packet whose `captureMs` is below what the server already holds is a duplicate and is dropped.
  - A jump is allowed only after a resume (it becomes a `RECONNECTION` gap) or after a MUTE / UNMUTE pair (a `MUTED` gap).
  - Any other jump is a violation. Audio sent while muted is a violation.
- **Same capture instant means same audio.** A resend after a resume carries the original `captureMs`. The track stores
  each instant once and never stitches or invents audio.
- **Control messages that change state** carry a rising `msgId`.
  - The server ACKs each one once it is applied.
  - A repeat (`msgId` ≤ the last applied) is re-ACKed and not applied again.
  - `STATE.lastMsgId` tells a resumed phone what was applied.

## 6. Limits and close codes

```json qandeel-live-call-v1
{
  "protocol": "qandeel.live-call.v1",
  "path": "/voice/calls/connect",
  "version": 1,
  "clientMessages": ["HELLO", "AUDIO", "PLAYOUT", "BARGE_IN", "TEXT_TURN", "MUTE", "UNMUTE", "TOKEN_REFRESH", "HEARTBEAT", "END"],
  "serverMessages": ["STATE", "TURN_COMMITTED", "REPLY_AUDIO", "REPLY_END", "REFUSED", "CALL_ENDING", "ACK"],
  "notYetSupported": ["BARGE_IN", "PLAYOUT", "TEXT_TURN"],
  "frame": { "audioKind": 1, "replyAudioKind": 2, "headerBytes": 20, "maxOpusPacketBytes": 1275, "maxTextFrameBytes": 4096, "packetMs": 20 },
  "limits": {
    "heartbeatIntervalMs": 1000,
    "silenceTimeoutMs": 3000,
    "leaseRenewalMs": 5000,
    "resendBufferMs": 2000,
    "framesPerSecond": 100,
    "frameBurst": 150,
    "controlPerSecond": 20,
    "maxPendingAudioBytes": 524288,
    "maxOutboundBufferBytes": 1048576,
    "segmentTargetMs": 10000,
    "tokenFallbackLifetimeMs": 600000,
    "callEndingNoticeMs": [300000, 60000]
  },
  "close": {
    "NORMAL": 1000, "GOING_AWAY": 1001, "PROTOCOL_ERROR": 1002, "TOO_BIG": 1009,
    "TOKEN": 4001, "PROTOCOL_VIOLATION": 4002, "FENCED": 4003, "REFUSED": 4004, "OVERLOADED": 4005, "SILENCE": 4008
  }
}
```

**The upgrade's own bounds (per instance, `live-call.gateway.ts`):**

- 20 upgrades per client address per minute.
- 200 sockets per instance.
- 3 sockets per person (a takeover briefly needs two).
- A 10 s handshake.

The client address is the one Express resolves under the startup proxy topology. The same SHA-256 keying as the HTTP
throttler is used, and nothing is stored beyond the minute. The global, distributed limit belongs to the edge
(`QAN-BL-LAUNCH-01`).

**The call authority's policy** (0189 `voice_private.live_call_policy`, changed only by its setter):

| setting | value |
|---|---|
| realtime capacity | 2 |
| reconnect grace | 30 s |
| connect timeout | 15 s |
| seat lease | 20 s |
| maximum call | 3600 s |

## 7. Privacy

- Nothing in the gateway, the connection or the writer logs. No token, address, person, call, frame or audio byte is
  logged.
- Telemetry carries content-free outcomes only (`VOICE_LIVE_CALL`).
- The decoded 16 kHz PCM goes to the speech sink. CP1 binds the null sink: no recognizer, no provider, nothing kept.
