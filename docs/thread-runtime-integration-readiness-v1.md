# Thread Runtime Orchestration + Integration Readiness v1 (T-03B2b3)

**Slice:** T-03B2b3 — the final implementation slice of canonical Product task
T-03B2 (Thread Establishment).
**Migration:** `0069_thread_runtime_integration_readiness_v1.sql` — READ /
AUDIT ONLY.
**Status:** PRODUCTION-INERT. Nothing here is wired into `ConversationModule`
or `ConversationService`, and every database function it uses is executable by
no application role.

---

## 1. Why this slice is still inert (AC-B2B3-01)

The frozen Stage-6 same-SP chain is

```text
CU / SP
→ B1 reference + conversational focus
→ B1 Emerging Focus continuity
→ optional B2 Thread establishment + permanent Home
→ effective LF                                    [T-03D]
```

and a sealed SP may never be reopened or backdated. Making the integrated
B1+B2 writer live now would seal every new Moment **before** T-03D can write
effective LF inside the same per-Moment transaction. The production path
therefore remains the currently-live T-03A2 temporal path, and T-03D remains
the owner of the final semantic-chain authority cutover.

This is an Engineering activation-order rule. It changes no frozen Product
meaning.

---

## 2. The runtime chain

`ConversationThreadEstablishmentService` turns ONE durable COMPLETED
USER → ASSISTANT finalized exchange into canonical Session time plus its
reference / focus semantics plus its optional Thread establishment and
permanent Home:

```text
A  relation gate (zero providers, zero mutation on an invalid pair)
B  stable automatic batch identities (exactly T-03A2's derivation)
C  integrated B1+B2 snapshots BEFORE any provider
     COMPLETE + COMPLETE  canonical replay, stored delivery, zero providers
     ABSENT   + ABSENT    a new exchange
     anything else        integrity failure, no repair, no backfill
D  ONE authoritative combined B1+B2 context + clock token, outside any lock
E  USER and ASSISTANT segmentation, separately (T-03A2 semantics kept)
F  exact prepared CurrentCu inputs from the proposed spans (code points)
G  sequential whole-exchange B1 focus evaluation, no hindsight
H  ONE whole-exchange B1 canonicalization, then an exact split
I  the exact canonical B1 bundle paired to the exact B2 CU
J  sequential whole-exchange B2 Thread evaluation, no hindsight
K  deterministic grounded Conversational Origin (ED-B2B3-02, no provider)
L  ONE whole-exchange Thread canonicalization, then an exact split
M  one existing 0068 coordinator commit against the exact token
N  the SAME external temporal delivery shape T-03A2 returns
```

No Thread, Home or Origin value becomes client payload: the delivery is
exactly `{ liveHead, committedEvents }`, and `packages/runtime` is unchanged.

The database remains the final authority for SP, the same-SP sequence, B1
persistence, Thread identity re-validation, Home placement, world
serialization, the B2 event / evidence / origin rows, and replay coherence.

### Bounded stale-context recovery

At most ONE semantic re-evaluation per request, and segmentation is never
repeated. On a commit failure the runtime re-reads both integrated snapshots
FIRST: a COMPLETE + COMPLETE winner is returned as stored delivery with no
second semantic pass; anything mixed or PARTIAL fails closed; only the exact
typed stale condition (SQLSTATE `40001` whose message EQUALS
`STALE_CONVERSATIONAL_FOCUS_CONTEXT`, the predicate reused verbatim from
T-03B1b2) with both halves absent may continue, and only after the source
frontiers are proven unchanged. A second stale failure is retryable
unavailability.

### Phase separation

A failure here never calls `failTurn`, never marks a COMPLETED turn FAILED,
never regenerates or duplicates an assistant answer, and never reinterprets a
provider outage as `NO_ESTABLISHMENT`. Technical failure remains technical
failure.

---

## 3. Migration 0069 — read / audit only (ED-B2B3-01)

Three functions, all `OWNER postgres`, `SECURITY DEFINER`, `STABLE`, with a
fixed search path, executable by **no** application role:

| Function | Purpose |
| --- | --- |
| `get_conversation_focus_thread_integrated_batch_snapshot_v1` | the T-03B1b2 integrated read (commitment + B1) plus the B2 capture state and counters |
| `get_conversation_focus_thread_runtime_context_v1` | the T-03B1b1 context read (token + B1 prior context) plus one canonical B1 bundle and one attention item per prior committed CU, plus the already-canonical Thread bindings |
| `assert_conversation_thread_capture_cutover_ready_v1` | a deployment proof that every committed-CU batch is structurally COMPLETE |

`ABSENT | COMPLETE | PARTIAL` is **not** recomputed here. It is read from
migration 0068's single structural authority
`conversation_thread_batch_state_v1`, so the runtime gate, the per-batch
writer replay gate and this readiness audit can never disagree about what
"complete" means. The migration self-asserts that all three functions call it.

0069 allocates no SP, advances no LH, reserves no same-SP sequence, writes no
semantic row, backfills nothing, repairs nothing, declares no
historical-enabled state and creates no activation flag. It grants nothing and
revokes no live T-03A2 authority. Migrations 0064–0068 stay byte-identical.

The combined context **fails closed** rather than serving partial truth: a
committed prior CU without its canonical B1 bundle or attention item, or
inside a commitment batch that is not B2-COMPLETE, raises
`INCOMPLETE_PRIOR_THREAD_HISTORY`. Nothing is cleaned, skipped or defaulted.

`SET search_path=''` with fully qualified names is used throughout, matching
the frozen 0064–0068 convention; it is strictly stronger than a
`public, pg_temp` search path.

---

## 4. Conservative Grounded Conversational-Origin Mapping (ED-B2B3-02)

Conversational Origin is

> the grounded conversational-history context from which the establishment
> episode of a new Thread emerged.

It is placement input and durable provenance only. It is **not** parenthood,
hierarchy, causality, a semantic relation, ownership, importance, proximity
semantics, mandatory adjacency, a Conversation Transition edge, or chronology
alone.

There is **no Origin model, provider or prompt**. `deriveConversationalOrigin`
is a pure, synchronous function of already-canonical grounded B1 structure,
and only two grounding sources exist:

* **A — canonical `target_cu_id`.** An episode CU points at a prior CU through
  canonical B1 sequence semantics, and that prior CU's canonical attention is
  bound to an already-established Thread's grounding Emerging Focus. Adjacency
  alone is never enough.
* **B — canonical reference-handle grounding.** An episode CU carries a
  RESOLVED reference to a stable handle, or AMBIGUOUS candidate handles, and
  that handle's canonical prior grounding closes to a focus/Thread binding
  already present in the authoritative context. Repeated names are not
  identity; similarity is not identity.

Closed outcomes:

| State | Meaning |
| --- | --- |
| `NONE` | no prior established Thread carries a grounded origin link (first Thread, abrupt new subject, predecessor without a canonical link) |
| `RESOLVED` | exactly one distinct prior Thread, with no unresolved competing candidate set |
| `MULTIPLE` | two or more distinct prior Threads, each with an independent resolved link; no member is primary |
| `AMBIGUOUS` | canonical B1 ambiguity leaves two or more grounded candidates and nothing settles one |

A single grounded candidate behind an AMBIGUOUS reference stays `NONE`:
certainty is never invented. A contradictory or structurally impossible
context fails closed with `INVALID_CONVERSATIONAL_ORIGIN_CONTEXT`.

**No hindsight.** The visible prefix grows CU by CU in exact evaluation order,
so a decision can never see a later CU, a later ASSISTANT CU while an earlier
USER CU is judged, or a later same-exchange establishment. A Thread
established earlier in the SAME exchange becomes an origin candidate only
after its own CU has been evaluated — sequential technical state, never
parenthood.

Forbidden inputs, none of which is reachable from the mapper's parameters:
embedding or semantic similarity, Grounded Semantic Relation count or
direction, confidence, importance, emotional intensity, popularity, Reading
strength, Home distance, viewport or device, chronology alone, and any
model-generated "best parent".

---

## 5. What this slice deliberately does NOT do

No live cutover; no service-role grant on any integrated writer, coordinator
or context; no `ConversationService` / `ConversationModule` change; no Thread
lifecycle (Dormant / Reopened); no cross-session Thread sameness or reopening;
no Thread ↔ Reading binding; no effective LF; no T-03C historical coverage or
projection; no Neighborhood geometry; no Thread merge; no mobile or client
payload change; no new dependency and no lockfile change.

---

## 6. Proofs

* `apps/api/src/thread-establishment/*.spec.ts` — the runtime, mapper,
  repository and Origin suites, all against injected fakes; CI makes no live
  provider request.
* `database/verify-migration-0069.mjs` — the real-PostgreSQL verifier
  (snapshot states against the 0068 authority, combined context, readiness
  audit, clock policy, privileges, zero mutation).
* `database/tests/thread-runtime-integration-readiness-v1.test.mjs` — the
  static database contract.
* `tests/thread-runtime-integration-readiness-contract.test.mjs` — the
  repository-wide static anti-scope contract.
