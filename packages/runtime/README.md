# `@qandeel/runtime`

Shared runtime contracts between the API and the mobile client.

## What it is today (T-03A2)

A **type-only** workspace package. It declares no `main`, ships no JavaScript and
carries no runtime dependency: every consumer imports from it with `import type`, so
the declarations are erased at compile time and nothing here can enter a bundle.

`src/temporal.d.ts` holds the T-03A2 temporal wire contract:

- `ConversationalUnitsCommittedWireEvent` — one durable committed-CU advancement per
  non-zero commitment batch (`type`, `version`, `sessionId`, `batchId`, `sourceTurnId`,
  `firstSp`, `lastSp`, `unitCount`).
- `SessionTemporalSnapshot` — `{ sessionId, liveHead }`, where `liveHead` is `null`
  when no user-addressable committed CU exists yet. Zero is never sent.
- `ConversationTemporalDelivery` — the additive temporal block on a completed exchange.

The wire event deliberately carries no committed text, analysis, Reading, Thread, Live
Focus, Evidence, confidence, `K`/`V` or timestamp. A timestamp is never a Session
Position, so no time field exists here to be mistaken for temporal authority. The
server-internal same-SP event sequence is not part of the wire contract.

The client mirror event (`LIVE_HEAD_ADVANCED`) is a different layer and lives in the
mobile canonical state kernel; the two names are intentionally distinct and neither is
renamed into the other.

## Planned foundation modules

Later tasks may add real runtime modules here:

- Core Runtime
- Conversation Orchestrator
- Model Router
- Memory Runtime
- Behavioral Runtime
- Safety Runtime

Adding executable code to this package is a separate, separately reviewed decision: it
would turn a type-only contract into a shipped dependency of both clients.
