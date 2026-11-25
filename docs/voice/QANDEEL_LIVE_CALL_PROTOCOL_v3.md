# QANDEEL Live Call Protocol v3 (`qandeel.live-call.v3`)

**Status:** IMPLEMENTED — NOT MERGED (INTEL-LIVE-01 CP2, 2026-11-25), under the Product Owner's "INTEL-LIVE-01 — CP1
Acceptance & CP2 Execution Authorization" (2026-11-25; D-3 approved: an additive protocol v3). Draft until the Product
Owner's merge decision.

The code statements are `apps/api/src/voice/call/live-call.protocol-v3.ts` (server) and
`apps/mobile/src/voice-call/live-call-protocol-v3.ts` (phone). **v1 (`QANDEEL_LIVE_CALL_PROTOCOL_v1.md`) and v2
(`QANDEEL_LIVE_CALL_PROTOCOL_v2.md`) are frozen and unchanged:** v3 is v2 plus exactly the two server messages below. A phone
that offers only v2 or v1 is answered exactly as before and is never sent a v3 message.

## 1. Purpose

v3 lets the phone show the call's **provisional attention** while the call continues: what the provisional attention lane
(INTEL-LIVE-01 CP1, migration `0204_intel_live_01_call_attention_v1.sql`) has committed to the database — a subject
the conversation is about, set or withdrawn while the person or QANDEEL is still speaking, and settled (`CONFIRMED` /
`EXPIRED`) once its turn is analysed. The phone draws it on the Personal map (COSMOS, D-5) and keeps nothing of it after the
call. **Nothing is ever sent that the database did not commit**; no transcript and no INTERIM is ever sent.

## 2. Negotiation

- The phone offers v3 first. **Android:** `qandeel.live-call.v3, qandeel.live-call.v2, qandeel.live-call.v1`. **iOS:**
  `qandeel.live-call.v3, qandeel.live-call.v1`.
- The server selects the highest offered (v3, else v2, else v1, else it refuses the upgrade) and echoes it.
- Under v3 the phone's HELLO carries `"v": 3` (every other HELLO field as in v1). Any other `v` on a v3 connection is a
  protocol violation (`REFUSED PROTOCOL_VIOLATION`, close 4002).
- **v2 inside v3:** `CLOCK_MARK` / `MARK_ECHO` exactly as v2. A phone that cannot resolve a capture position (iOS) answers
  every mark `null` (NOCLOCK) — the existing null-certificate policy: no moment of such a call is placed by a mark.
- Binary frames and every v1 / v2 message keep their shapes and rules.

## 3. Messages (server → phone only)

| Message | Shape (exact keys) | Rules |
|---|---|---|
| `ATTENTION` | `{ "type": "ATTENTION", "seq", "op", "track", "subjectKey", "label", "kind", "confidence", "threadRef", "producedClockMs" }` | One attention event, sent once its write committed. `seq` is its 0204 `event_seq` (DB-assigned under the call's lock: rising across connections, epochs and instances). `op` ∈ `SET`, `WITHDRAW`, `CONFIRMED`, `EXPIRED`; `track` ∈ `USER`, `QANDEEL`; `label` ≤ 40 characters; `threadRef` a Thread of the person's or `null`; `producedClockMs` the call-clock position the server had ingested when the evaluation produced it (`null` for a settlement). |
| `ATTENTION_STATE` | `{ "type": "ATTENTION_STATE", "seq", "part", "parts", "entries": [ { "track", "subjectKey", "label", "kind", "confidence", "threadRef", "seq" } ] }` | The call's open attention as **one** read of the database holds it (0204's `server_read_call_attention_state_v1`), in `parts` consecutive frames of at most **12** entries, all with the snapshot's `seq` (the call's highest `event_seq` in that read; an entry's own `seq` is its latest `SET`). An empty snapshot is one frame with no entry. |

Every v3 frame stays within the v1 text bound (4096 bytes).

## 4. When the server sends

- **`ATTENTION_STATE` after `STATE ACTIVE`** on every connection, fresh or resumed, restored from the database. A resumed
  connection on another instance reads the same database: no subject is lost across instances.
- **`ATTENTION`** for each event the moment the writer committed it, in `event_seq` order.
- **`ATTENTION_STATE` again** whenever the database's attention may have moved without an `ATTENTION` frame: a settlement of
  this call written on this instance (signalled by the analysis worker); while the phone holds open subjects after a
  committed turn, every 5 s for at most 120 s (a settlement written on another instance); 1 s after a frame that could not
  be sent. These intervals bound re-reads only: no event waits for them, and none decides what is understood.
- **Never a snapshot older than an event already sent** on the connection: such a read is discarded and read again.
- **Audio first:** an attention frame is never queued behind more than 64 KiB waiting towards the phone; it is dropped and
  the state is sent again later. Nothing of this is awaited on the voice path.
- With the attention lane OFF nothing is sent (no frame at all); a v1 or v2 connection never receives a v3 frame.

## 5. What the phone does

- **Part 0 replaces the layer; later parts add to it**, in order and with the same `seq`; the snapshot is applied only
  once whole, and only when its `seq` is not below the layer's. An `ATTENTION` arriving between parts is applied after it.
- Then only `ATTENTION` with `seq` above the layer's applies: a duplicate or a stale event changes nothing. `SET` opens or
  updates its subject; `WITHDRAW`, `CONFIRMED` and `EXPIRED` remove it.
- A subject is its `track` **and** its `subjectKey`: the person's and QANDEEL's attention are never merged.
- No debounce, no timer, no count gate and no semantic rule on the phone. The layer belongs to the call: it is dropped at
  the call's end, a new call starts empty, and nothing of it is stored or promoted to durable knowledge.
- A malformed v3 frame is a protocol fault, as any malformed server frame is.

## 6. Verification

- API: `apps/api/src/voice/call/live-call.protocol-v3.spec.ts`, `apps/api/src/live-attention/call-attention.disclosure.spec.ts`,
  the gateway e2e spec.
- Phone: `apps/mobile/src/call/__tests__/provisional-attention.test.ts`.
- Static: `tests/intel-live-01-live-call-protocol-v3-contract.test.mjs`.
- On a device: the iOS Targeted Gate's ITG-07 (v3, disclosure), ITG-08 (reconnect and restore) and ITG-09 (end cleanup),
  judged by `scripts/ios-targeted-gate/attention-checks.mjs` against the database's state and the proof-only probe
  (`apps/mobile/src/voice-call/__validation__/s806cp3-attention-probe.ts`, which only watches); the Android emulator
  evidence (B5′ / B6′) in the [execution record](../e2e/QANDEEL_INTEL_LIVE_01_IN_SPEECH_UNDERSTANDING_RECORD_v1.md) §9.
