# Committed Conversational Unit Substrate v1 (T-03A1)

The first durable runtime substrate for QANDEEL's frozen conversational time.

Stage 1.2 defines a **Conversational Unit (CU)** as *the smallest contiguous span
of committed conversational source material that constitutes one independently
addressable conversational contribution*. Stage 6 freezes:

```text
1 committed CU = 1 Moment
1 turn        = 0..N committed CUs
a CU never crosses a turn boundary
a CU never merges USER + ASSISTANT source
```

T-03A1 implements the CU constitution, the commitment producer and the durable
append-only substrate. It owns **no** temporal establishment: Session Semantic
Clock, SP allocation, SP sealing, LH derivation and client delivery are T-03A2.

---

## 1. Production-inert activation gate

Migration `0064` creates `commit_conversation_units_v1` as `SECURITY DEFINER`,
`SET search_path=''`, `OWNER TO postgres`, and grants `EXECUTE` to **no**
application role. Neither table is readable or writable by `anon`,
`authenticated` or `service_role`.

`apps/api` holds no PostgreSQL driver: every database call is PostgREST HTTP as
`authenticated` or `service_role`, and PostgREST cannot execute a function the
request role lacks `EXECUTE` on. **No code path reachable from the deployed
product can create a committed CU.** The CI verifier connects as the migration
owner and proves the whole producer against real PostgreSQL.

There is also no Nest module in `apps/api/src/conversation-unit/`, so nothing
can be imported into `AppModule`, and no orchestrator, dispatcher or
post-response path references the substrate.

Because the producer cannot run in production, `conversation_units` is provably
**empty** until activation. There is therefore no state in which a committed CU
exists without temporal establishment — no `SP_PENDING`, `PRE_MOMENT`,
`PENDING_MOMENT` or `COMMITTED_WITHOUT_SP` is introduced, and no column exists
in which such a state could live.

**T-03A2 activation is one migration**: add the SP column and its index (safe on
an empty table), `CREATE OR REPLACE` the producer so SP allocation and sealing
happen inside the same transaction as CU insertion — preserving the source
frontier rule below — and `GRANT EXECUTE ... TO service_role`, re-asserting
owner and ACLs explicitly because `CREATE OR REPLACE` preserves drifted
privileges.

---

## 2. The frozen coordinate and digest contract

```text
Unicode code points, 0-based, half-open [start, end)
over conversation_turns.content exactly as stored, with no normalization
canonical source digest = sha256(convert_to(content, 'UTF8'))
```

The migration refuses to deploy against a non-UTF-8 server encoding. There is
**no** byte-offset fallback and **no** MD5 fallback: an environment that cannot
honour the contract must stop for Architecture review, not silently change it.

JavaScript indexes by code point (`Array.from`), never `String.length` —
`'\u{1F600}'.repeat(500)` has `.length === 1000` but 500 code points, and one
such character would shift every later offset. The verifier proves JS ↔
PostgreSQL parity over Arabic, combining marks, supplementary-plane characters
and mixed Arabic/English.

Committed surface wording is authoritative (Stage 1.2 D8). Dialectal particles,
negation morphology, code-switching, hesitation, correction cues and
ambiguity-bearing surface forms survive byte-exact. No normalized column exists.

---

## 3. The boundary evaluator

Hybrid: **provider-assisted boundary proposal + deterministic source validation
+ database-authoritative commit.**

A deterministic segmenter is not available in principle: Stage 1.2 A2/CU-03
define the boundary semantically and forbid segmenting on punctuation, commas,
pause, code-switching, fillers, hesitation, syntactic clauses, named entities or
connectives — which is all a deterministic segmenter could read. The one
inference-free policy, *one CU per turn always*, is disqualified by the frozen
grammar itself.

### The anchored-excerpt protocol

The provider returns **extractive anchors only** — never offsets, never wording
of its own:

```json
{ "units": [ { "text": "<exact source excerpt>", "occurrence": 1 } ] }
```

Strict `json_schema`, `additionalProperties:false`, bounded unit count and
excerpt length, `store:false`, zero SDK retries, an explicit AbortController
timeout, and the source wrapped in an untrusted-data envelope. `units` may be
empty — the legal zero-CU proposal.

### The mapper computes every offset

```text
cursor := committed source frontier
for each anchor, in order:
    occ := every exact code-point occurrence of anchor.text in the source
    reject NON_EXTRACTIVE_ANCHOR    if occ is empty
    reject AMBIGUOUS_ANCHOR         if |occ| = 1 and occurrence <> 1
    reject OCCURRENCE_OUT_OF_RANGE  if occurrence > |occ|
    start := occ[occurrence - 1] ; end := start + codePointLength(anchor.text)
    reject ANCHOR_BEFORE_CURSOR     if start < cursor
    emit [start, end) ; cursor := end
```

**Duplicate identical substrings** are disambiguated by the explicit 1-based
`occurrence` index, cross-checked by the monotonic cursor. A different
occurrence is never silently substituted; every failure rejects the whole batch.

Because an excerpt that is not an exact code-point substring has no location, a
paraphrase or normalized wording **cannot** become a span and therefore cannot
become a committed CU. Extractiveness is proven by construction, not instructed.

*Stated residual:* if a phrase repeats and the provider names a later valid
repetition that still satisfies monotonicity, that repetition is accepted. It
can only ever select a different exact region of canonical source — never
invented wording, an out-of-bounds span, an overlap or an out-of-order unit.

Provider outage, timeout or malformed output fails closed with **zero** batches
committed. The turn is never collapsed to one CU. Read and replay paths never
invoke a provider.

---

## 4. The four INPUT-01 commitment conditions

`conversation_turn.status = COMPLETED` is the **current TEXT-runtime eligibility
signal only**. It is not the Product definition of commitment, `completed_at` is
audit/runtime metadata (never SP/KF/VF/VT/Session Semantic Clock), and it must
not become a universal rule for a future voice or provisional source substrate.

Each condition is established independently and re-established inside the
producer transaction:

| Condition | How it is established |
|---|---|
| Source stability | `conversation_turns.content` is write-once: no migration updates it and no role holds `UPDATE`. The producer recomputes the digest and a mismatch fails closed. |
| Boundary stability | A turn has no continuation mechanism — a continuation is a new turn. Only a turn that terminalized as `COMPLETED` entered the conversation; cancelled, failed, superseded and in-flight source is refused. |
| Speaker-state stability | `role` is server-forced and immutable; speaker state is **derived** from it. `UNRESOLVED` stays representable in the frozen domain but is not executable in v1. |
| Provenance stability | Locked parent turn, span bounded by canonical content length, and DB-sliced committed wording. |

---

## 5. Canonical source authority is database-derived

The caller may identify the source turn and batch and propose unit ids and span
coordinates. It is authority for nothing else. The producer signature carries
**no** parameter for a fingerprint, committed wording, source role, speaker
state, source modality, source digest, ordinal or SP:

```sql
public.commit_conversation_units_v1(
  p_session_id uuid, p_user_id uuid, p_source_turn_id uuid, p_batch_id uuid,
  p_units jsonb,
  p_evaluator_version text, p_policy_version text,
  p_segmentation_provider text, p_segmentation_model text, p_segmentation_prompt_version text
) RETURNS SETOF public.conversation_units
```

`p_session_id` and `p_user_id` are **guards** the database confirms against the
locked source turn; the stored values come from the turn row, not the
parameters. A privileged application caller therefore cannot forge a different
role, modality, digest, committed text for the same span, or an unresolved
speaker state for a source whose speaker is resolved.

---

## 6. Global source order across batches

`ordinal_within_turn` means **global canonical source order across every
committed CU of the source turn**, not commit-arrival order.

Under the source-turn `FOR UPDATE` lock — the one serialization point:

```text
frontier     = COALESCE(MAX(source_span_end), 0)
next_ordinal = COALESCE(MAX(ordinal_within_turn) + 1, 0)
```

A new non-empty batch must satisfy `first_new_span.start >= frontier`, and each
later span `span.start >= previous_span.end`. Gaps are allowed; overlap and
backward or in-between insertion are not. A zero-CU batch is recorded and does
**not** advance the frontier. Committed CUs are never renumbered, reordered,
rewritten, resegmented or deleted.

Because the frontier is at or after the end of every committed CU, this single
rule also subsumes cross-batch overlap.

---

## 7. REV03A1-06 — existing-batch replay vs new-batch commit

After locking and validating the authoritative source turn, the producer
branches on whether `p_batch_id` already exists.

**Path A — existing batch replay.** Historical identity verification, never an
append request. Today's frontier is **not** applied to the historical batch's
spans and ordinals are **not** re-derived from `MAX(ordinal)+1`, so an exact
replay of an earlier batch still succeeds after later batches advanced the
frontier. It validates tenancy, the current source digest against the stored
digest, the supplied evaluator/policy/provider metadata, the unit count, the
DB-derived canonical fingerprint, a tuple-by-tuple comparison of every stored
row against the payload and against freshly re-derived canonical values, and
stored ordinal integrity. It then returns the stored rows ordered by stored
`ordinal_within_turn`, with **zero mutation**.

**Path B — new batch commit.** Only when the batch id does not exist: derive the
frontier and `next_ordinal`, apply the forward-only rule, derive ordinals and
the canonical fingerprint, and insert the batch and its units atomically. The
frontier binds new writes only.

---

## 8. Batch identity is derived by the database

There is **no caller fingerprint parameter**. The producer builds a canonical
`jsonb` document from its own derived values and hashes it with
`sha256(convert_to(canonical::text,'UTF8'))`. `jsonb` normalizes object key
order and preserves array order, so identical canonical content always hashes
identically.

The fingerprint covers the batch id, DB-derived user/session/source-turn
identity, source role, speaker state, modality, source digest, evaluator and
policy identity, segmentation provider/model/prompt identity, the unit count,
and the ordered unit ids with their ordered spans. **Ordinals are deliberately
excluded** — ordered ids plus ordered spans already distinguish the commit
decision, and excluding them is what makes a replay independent of today's
frontier. Stored ordinal integrity is proven separately, both in the replay path
and by the verifier.

Retry contract:

```text
same batch id + identical payload  -> stored rows returned, zero mutation
same batch id + changed payload    -> COMMIT_BATCH_PAYLOAD_CONFLICT, zero mutation
new batch id  + span < frontier    -> SPAN_BEFORE_SOURCE_FRONTIER, zero mutation
several distinct forward batches for one turn -> permitted
```

Canonical idempotency depends on neither `runtime_event_outbox`'s
`UNIQUE(event_type, subject_turn_id)` nor the single-turn post-response dispatch
ledger. Both are structurally one row per turn and are left untouched.

---

## 9. Append-only protection

Both tables are `OWNER TO postgres` with RLS enabled, all privileges revoked
from every application role, and no policies. A `BEFORE UPDATE OR DELETE`
trigger refuses mutation for **every** role including the table owner, so a
future accidental `GRANT` cannot reopen it. Delete/reinsert identity rewriting
is impossible: the delete is refused, a same-id reinsert violates the primary
key, and a new-id reinsert is refused by the forward-only frontier rule and
`UNIQUE(source_turn_id, ordinal_within_turn)`.

No guarantee rests on TypeScript `readonly`.

---

## 10. Scope boundaries

Multi-function classification (Stage 1.2 CU-04/CU-05), sequence position and
local target CU ids are **derived interpretation** and belong to a later table
keyed on `conversation_units.id`; adding it needs no change here. Reference and
coreference resolution, Emerging Focus, Thread constitution, LF, historical
projection and Stage 1.7 correction consequences are out of scope. T-03A1
preserves the source truthfully enough for that later work without source
rewriting.

T-03A1 is **forward-only**: no historical Session is backfilled, no CU boundary
or source span is invented for an existing turn, and migration time is never
used as Product `KF`. Complete Session history coverage for historical-enabled
release remains later release-gating work.

---

## Verification

```sh
npm run test:committed-conversational-unit-activation-boundary-contract
npm run test:database
npm run test:api
npm run verify:committed-conversational-unit-substrate:integration
```

The integration verifier requires `DATABASE_URL` and runs in API CI against the
PostgreSQL 17 service after every migration is applied. It proves the
environment contract, the activation gate, the DB derivation of canonical
source, the frontier and replay split, retry and conflict semantics, append-only
protection, and a two-connection concurrency case, leaving zero fixture residue.
