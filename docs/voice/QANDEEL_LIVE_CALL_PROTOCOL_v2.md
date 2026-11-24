# QANDEEL Live Call Protocol v2 (`qandeel.live-call.v2`)

**Status:** IMPLEMENTED — NOT MERGED (S8B-07 RB-2 / M-2, CP3, 2026-11-24), under the Product Owner's "RB-2 / M-2 + S3
PRODUCTION IMPLEMENTATION — Direct Historical Binding — Execution Authorization" (2026-11-24). Draft until the Product
Owner's merge decision.

The code statements are `apps/api/src/voice/call/live-call.protocol-v2.ts` (server) and
`apps/mobile/src/voice-call/live-call-protocol-v2.ts` (phone). **v1 (`QANDEEL_LIVE_CALL_PROTOCOL_v1.md`,
`live-call.protocol.ts`) is frozen and unchanged:** v2 is v1 plus exactly the two messages below. A phone that offers only
`qandeel.live-call.v1` is answered exactly as before and is never sent a v2 message.

## 1. Purpose

v2 lets the server bind a database snapshot to an instant of the call's capture clock (the USER track's clock, v1 §2). A
moment of the conversation whose semantic commit (S1, migration 0201) is visible in that snapshot is certified to have been
committed no later than that capture instant; Replay may then reveal it at that position of the recording (S3, migration
0202) and never earlier. The storage and certification rules are migration 0203
(`database/migrations/0203_s8b_07_live_call_clock_marks_v1.sql`).

## 2. Negotiation

- The phone offers `Sec-WebSocket-Protocol: qandeel.live-call.v2, qandeel.live-call.v1` **only when its engine can resolve
  a certified capture position**. Today that is Android only. **iOS offers v1 only**, so it is never asked for a mark and no
  moment of an iOS call is placed inside the recording (fail-closed: such a moment is `AFTER_END`).
- The server selects v2 whenever it is offered, else v1, else refuses the upgrade (400), and echoes the one it selected. A
  v1-only server (or the S8B-06 fake gateway) selects v1, and the phone then speaks exactly v1.
- Under v2 the phone's HELLO carries `"v": 2` (every other HELLO field as in v1). A HELLO with `"v": 1` on a v2 connection,
  or `"v": 2` on a v1 connection, is a protocol violation (`REFUSED PROTOCOL_VIOLATION`, close 4002).
- Binary frames are unchanged: version byte 1, the v1 layout, the v1 rules. Every v1 message keeps its v1 shape and rules.

## 3. Messages

| Direction | Message | Shape (exact keys) | Rules |
|---|---|---|---|
| server → phone | `CLOCK_MARK` | `{ "type": "CLOCK_MARK", "seq": u32 ≥ 1 }` | Sent only while the call is `ACTIVE`, and only **after** the slot transaction that took the snapshot it is bound to has committed. `seq` rises by 1 per connection, from 1. |
| phone → server | `MARK_ECHO` | `{ "type": "MARK_ECHO", "seq": u32 ≥ 1, "captureMs": u32 multiple of 20 \| null }` | `captureMs` is the capture position of the **first frame captured at least 100 ms after the mark arrived** (the Android margin; 0 ms is unsafe — HONOR proof, 2026-11-24). `null` is NOCLOCK. Not ACKed, not resent, never logged. |

NOCLOCK (`null`) is answered whenever the phone has no stable capture timestamp: the call is held; the capture clock is
being re-established after a resume (a new recording segment); the start-up gate has not yet passed; the platform returned
no timestamp; the engine is not running. **The phone never derives a position by continuing the pre-hold frame index**, and
resolving a mark never blocks or delays capture or playback.

On a v1 connection a `CLOCK_MARK` is a server fault for the phone, and a `MARK_ECHO` is a violation for the server.

## 4. Timing (frozen, Option B)

- One mark per ACTIVE call per second, in ten staggered 100 ms slots (`slot = hash(callId) mod 10`). One batched database
  call per non-empty slot persists the previous echoes and takes a fresh snapshot (0203 `server_call_clock_slot_v1`); the
  marks are sent after it resolves. An idle instance runs no statement.
- A slot still running when the next one is due is skipped, never caught up. If the batch fails, no mark is sent and its
  echoes and compactions are retried in the next slot.
- The server keeps an echo only if: the `seq` is outstanding on the current connection and answered for the first time,
  within 10 s, not `null`, later than the newest capture position the server held when it sent the mark, and later than the
  call's previous accepted echo. Anything else is dropped silently — it can only make a certification later, never earlier.
- Each server instance writes only its own snapshots (a random instance id); a call's marks follow its current connection
  epoch. When the call ends, its marks are compacted (0203 `compact_call_clock_marks_v1`).

## 5. Privacy

A mark carries a sequence number; an echo carries a capture position. Neither carries audio, transcript, memory or any
user content, and neither is logged. The stored rows hold only the call, the person, the certified ledger coordinate and
the capture position, and are erased with the account (0203 coverage `ACCOUNT_CASCADE`).
