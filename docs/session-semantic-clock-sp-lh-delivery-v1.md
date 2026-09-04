# Session Semantic Clock + SP Allocation/Sealing + LH Establishment + Committed-CU Delivery v1

**Task:** T-03A2 · **Status:** implementation contract · **Migration:** `0065_session_semantic_clock_sp_lh_delivery_v1.sql`

T-03A1 built the committed Conversational Unit substrate and deliberately granted its
producer to no application role, so no CU could be produced and no Session Position
could be allocated. T-03A2 is the **one activation act**: it adds the server-owned
Session Semantic Clock, makes the Session Position born atomically with the committed
CU, derives the Live Head from the clock, publishes a dedicated durable delivery
surface, and only then grants the producer to `service_role`.

Commitment and temporal establishment therefore become executable **together**. There
is no window in which a committed CU exists without a Session Position, and no state
named `COMMITTED_WITHOUT_SP`, `SP_PENDING`, `PRE_MOMENT` or `PENDING_MOMENT` exists
anywhere in the schema, the runtime or the wire.

## The frozen equations

```text
ONE COMMITTED CU = ONE MOMENT
SP(m)            = per-Session ordinal of the committed CU
LH               = greatest committed CU SP in the current Session
```

SP is Session-scoped, integer, monotonic, gapless over committed CUs, and never
assigned to provisional or uncommitted source. **A timestamp is never SP**: the clock
table carries no timestamp column at all, and no allocation path reads a wall-clock
value.

## Session Semantic Clock

`public.session_semantic_clocks` holds exactly one row per Session:

| column | meaning |
| --- | --- |
| `session_id` | primary key, the Session it clocks |
| `user_id` | the Session's owner, used for owner-scoped locking and reads |
| `current_sp` | the Session's head, or `NULL` |
| `same_sp_event_sequence` | internal ordering inside the open SP |

`current_sp IS NULL` means exactly one thing: **no user-addressable committed CU / SP
exists yet in this Session**. It is not `SP(0)`, not `PRE_FIRST_SP` as a Product
state, not a Moment and not a temporal mode.

`LH(session) = session_semantic_clocks.current_sp`. There is deliberately no second
mutable `live_head` column that could drift from it, and the cross-check invariant
`current_sp = MAX(conversation_units.session_position)` holds for every Session with
at least one committed CU. The API and the client never receive `0` as LH.

Every existing Session received a clock row in the migration, and every future Session
receives one atomically through an `AFTER INSERT` trigger on `conversation_sessions`.

## AF66-01 — the mandatory lock order

Every T-03A2 semantic write acquires

```text
target Session Semantic Clock  →  conversation_units / source turn / other Stage-6 rows
```

in that order, and holds the clock lock for the complete semantic transaction. Exactly
one Session clock is acquired by one semantic transaction in v1. This is a disciplined
single-direction lock order, **not** a claim that arbitrary database deadlocks are
impossible.

The verifier proves the deployed producer body takes the clock lock before the
source-turn lock, reading `pg_get_functiondef` rather than the migration text.

## Allocation and sealing

For a new non-zero batch under the locked clock:

```text
next_sp = COALESCE(current_sp, 0) + 1
CU[i]  -> next_sp + i
clock.current_sp             = last allocated SP
clock.same_sp_event_sequence = 0
```

The `COALESCE(..., 0)` is arithmetic **inside** the allocator before `SP(1)`; it
creates no `SP(0)` and no Product state.

Sealing is **derived**, never a second mutable flag:

```text
SP(n) is OPEN   iff n = current_sp
SP(n) is SEALED iff n < current_sp
```

For a multi-CU block `SP(a) … SP(b)` every position before `SP(b)` seals inside the
same atomic transaction; only the final head stays open. No later writer may backdate
into a sealed position: the allocator only ever produces `current_sp + 1`, the row is
immutable by the T-03A1 append-only trigger, and `UNIQUE(session_id, session_position)`
is the structural backstop.

A **zero-CU batch** remains a valid committed evaluation batch. It receives no CU,
allocates no SP, changes neither `current_sp` nor LH, and creates no delivery event.

## The same-SP sequencing seam

`reserve_session_same_sp_event_v1(session, user)` acquires the Session clock first,
requires an established `current_sp`, increments `same_sp_event_sequence`, and returns
`(session_position, event_sequence)` while holding the row lock for the caller's
transaction.

It is internal, server-owned, non-addressable, not a Moment, not client-visible, not
an API transport cursor, and **granted to no application role** — `service_role`
included. Later Stage-6 semantic writers (T-03B1 / T-03B2 / T-03D) call it from inside
their own `SECURITY DEFINER` transaction while respecting AF66-01. Before the first SP
it fails closed with `SESSION_POSITION_NOT_ESTABLISHED`, which is a technical absence
and never `PRE_FIRST_SP` membership.

## The committed-CU delivery surface

`public.conversation_unit_commit_events` carries one append-only row per **non-zero**
committed batch:

```text
commit_batch_id  uuid PRIMARY KEY     -- the stable event identity
user_id, session_id, source_turn_id
first_sp, last_sp, unit_count         -- unit_count = last_sp - first_sp + 1
created_at                            -- audit only, never temporal authority
```

`runtime_event_outbox` is **not** reused: it is `UNIQUE(event_type, subject_turn_id)`,
i.e. structurally one row per source turn, while the frozen CU grammar allows several
valid commitment batches per turn. Keying on the batch keeps multiple batches per turn
representable and makes the forbidden one-event-per-turn assumption unable to return.
The table name encodes the event type; there is no generic event ontology, no
`event_type` column and no `payload`. The event carries no committed text, analysis,
Reading, Thread, Live Focus, K/V or future material.

Idempotency: an exact batch replay finds the exact event and mutates nothing; a new
non-zero batch produces exactly one event; a zero-CU batch produces none.

## The atomic USER → ASSISTANT exchange

`finalize_conversation_turn_v2` completes the USER turn and inserts the ASSISTANT turn
together operationally. They remain **two source turns and two commitment batches**:
there is no combined USER+ASSISTANT CU and no combined Moment.

`commit_finalized_exchange_conversation_units_v1` takes the one Session clock first
and holds it across both blocks, then reuses the canonical producer for the USER block
and then the ASSISTANT block. No other Session SP writer can interleave between them;
either block failing rolls both back; an exact replay returns the stored canonical pair
with zero mutation.

```text
USER 2 CUs, ASSISTANT 3 CUs, starting LH = 7
USER      -> SP(8), SP(9)
ASSISTANT -> SP(10), SP(11), SP(12)
new LH    -> SP(12)
```

USER zero + ASSISTANT two allocates only the ASSISTANT positions — no phantom USER
Moment. Both zero leaves LH unchanged with no events.

## Runtime establishment

`ConversationTemporalEstablishmentService` turns one finalized exchange into Session
time:

1. **A** derive the two stable automatic batch identities;
2. **B** read both batch snapshots — if both are already committed, return the stored
   canonical delivery with **zero provider calls** (a committed zero-CU batch counts
   as complete);
3. **C** evaluate the USER and the ASSISTANT source separately, concurrently, never
   merged into one segmentation request;
4. **D** commit both through one atomic Session-clock transaction, USER block first;
5. **E** if a race is lost to an already-committed winner, re-read the canonical result
   instead of overwriting or re-segmenting it. Duplicate provider compute under a rare
   race is acceptable; duplicate canonical truth is not.

A structurally partial automatic pair is never silently repaired: it fails closed as an
integrity error.

### Automatic identity

The automatic batch id is a genuine RFC 4122 §4.3 **name-based UUID version 5** over a
fixed domain namespace and the source turn id; unit ids derive from the batch id, the
unit index and the canonical source span. This is technical idempotency only — not SP,
not Product temporal state, and not a one-batch-per-turn constraint. A later,
deliberately distinct batch for the same turn simply uses a different id.

Version 5 rather than a UUIDv8 custom-hash layout because migration 0064 froze the
producer's caller-payload validation to `[1-5]` in the version nibble, and T-03A2
preserves that rejection contract rather than widening it.

### Failure and replay

Provider failure remains fail-closed: no whole-turn fallback CU, no fake zero-CU batch
for an outage, and no hidden retry inside a segmentation call (`maxRetries = 0`
stands). A failed request leaves the durable finalized turns canonical, and an
idempotent replay of the completed turn re-enters establishment without repeating model
response generation. After successful establishment, replay reads the stored batches
and events with zero provider calls.

### Two distinct technical phases

```text
1. GENERATION / FINALIZATION            — ConversationOrchestratorService
2. POST-FINALIZATION TEMPORAL ESTABLISHMENT — ConversationTemporalEstablishmentService
```

Phase 2 is invoked from `ConversationService`, strictly after phase 1 has produced
durable COMPLETED turns. The separation is **structural**: the orchestrator holds no
reference to temporal establishment, so a CU temporal-establishment failure has no code
path through which it could mark an already-COMPLETED turn FAILED, call
`fail_conversation_turn`, record a false generation-failure outcome, or regenerate an
assistant response. It surfaces as a retryable service-unavailable response while the
durable completed turns stay completed.

## Transport

The completed exchange result gains an additive block:

```ts
temporal: {
  liveHead: number | null;
  committedEvents: ConversationalUnitsCommittedWireEvent[];   // ordered by SP
}
```

`userTurn` and `assistantTurn` are unchanged. Two authenticated routes deliver current
truth and catch-up:

```text
GET /conversation/sessions/:sessionId/temporal          -> { sessionId, liveHead }
GET /conversation/sessions/:sessionId/temporal/events   -> { sessionId, events }
    ?afterSp=<integer >= 1>&limit=<1..256>
```

`afterSp` omitted means the start of available delivery events; `SP(0)` is not a cursor
and is refused by both the controller and the database. Events sort ascending by
`firstSp`. Ownership is derived server-side from `auth.uid()` — a caller-supplied user
id is never client authorization.

This is a **delivery/recovery transport for LH, not a Timeline API**. There is no
`/timeline`, `/history` or `/projection` route; T-03C owns historical projection and
coverage. There is no WebSocket and no SSE in T-03A2: realtime push would be a
separate, separately owned decision.

## Shared contract and client mirror

`@qandeel/runtime` is a **type-only** workspace package: no `main`, no JavaScript, no
runtime dependency, imported only with `import type`. It declares
`ConversationalUnitsCommittedWireEvent`, `SessionTemporalSnapshot` and
`ConversationTemporalDelivery`.

The server/domain event and the client mirror are deliberately different layers:

```text
CONVERSATIONAL_UNITS_COMMITTED   (server wire)
LIVE_HEAD_ADVANCED               (client canonical mirror)
```

Neither is renamed into the other, and no generic `WORLD_TRUTH_UPDATED` exists. A block
`firstSp=20, lastSp=23, unitCount=4` mirrors as `toSp=23` exactly once; the individual
Moments stay addressable by their own SPs in the durable rows.

`apps/mobile/src/temporal/` validates every delivered payload at runtime before it can
influence canonical state, then hands the mirrored position to the T-02 store's
authoritative-event seam. It never writes `LH` directly, never dispatches a Product
act, never appends RH, and rejects a cross-Session delivery. A stale lower-SP delivery
is classified as stale and never retracts the head. It is non-UI, has no Router, no
persistence and no credential storage, and is not mounted in the app shell: T-03A2
delivers authoritative LH only, and **`LF` stays with T-03D** — no `LF = null`
conclusion is invented because T-03D has not landed.

## AF66-02 — the historical boundary

T-03A2 establishes live SP/LH authority only. It manufactures no historical baseline
membership, compares no timestamp to decide `PRE_FIRST_SP`, declares no pre-T-03C
Session historically navigable, and invents no `KF/VF/VT`. A Session that receives SPs
here is not thereby historical-enabled; T-03C / R-C1 decides coverage and backfill
eligibility later. For a Session later declared historical-enabled the frozen rule still
holds: the SessionHistoricalBaseline cut must be established under the same clock
authority immediately before `SP(1)` — and nothing here makes that impossible.

## Verification

```sh
npm run test:session-semantic-clock-sp-lh-delivery-contract    # static contract (API + client + wiring)
npm run test:database                                          # includes the 0065 migration contract
npm run verify:session-semantic-clock-sp-lh-delivery:integration   # real PostgreSQL, 52-case matrix
```

The real-PostgreSQL verifier proves allocation, sealing, replay, the exchange
coordinator, the delivery surface, the same-SP seam, the ACL matrix, the owner-scoped
reads and the activation guard against live semantics, and leaves zero fixture residue.
