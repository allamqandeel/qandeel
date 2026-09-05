# Thread Lifecycle + Cross-Session Continuity v1 (T-03B3)

**Task:** T-03B3 — Active / Dormant / Reopened, one Architecture-sized task
(no sub-splits).
**Migration:** `0070_thread_lifecycle_cross_session_continuity_v1.sql` — the
FINAL Thread-layer substrate: Session focus → Thread binding, user/world Thread
identity evidence, Session-local lifecycle transitions, the integrated
B1 + B2 + B3 per-Moment writer and coordinator, exhaustive dossier paging, the
B3 runtime context, the integrated B3 snapshot and the cutover-readiness audit.
**Status:** PRODUCTION-INERT. Nothing here is wired into `ConversationModule`
or `ConversationService`; every new database function is executable by **no**
application role; the T-03A2 live authority is untouched; migrations
0064–0069 are byte-identical.

---

## 1. Why this task is still inert (AC-B3-01)

The frozen Stage-6 same-SP chain is

```text
CU / SP
→ B1 reference + conversational focus + Emerging Focus continuity   [seq 1]
→ the FINAL Thread layer                                            [seq 2, at most one]
    new Thread + permanent Home              (0068, reused)
    Session focus → existing Thread binding  (0070)
    Session lifecycle transition(s)          (0070)
→ effective LF                                                      [T-03D]
```

and a sealed SP may never be reopened or backdated. Making the integrated
B1 + B2 + B3 writer live now would seal every new Moment **before** T-03D can
write effective LF inside the same per-Moment transaction. The production
path therefore remains the currently-live T-03A2 temporal path, and T-03D
remains the owner of the final semantic-chain authority cutover.

This is an Engineering activation-order rule. It changes no frozen Product
meaning.

---

## 2. The five Architecture Decisions

| Id | Decision |
| --- | --- |
| **B3-01** | Lifecycle state is **Session-local**; Thread identity, Home and identity evidence are **user/world-global**. SP values of different Sessions are not comparable, so there is no global current lifecycle column, no global Session order, no cross-Session SP and no timestamp-based lifecycle ordering anywhere. A Thread has one canonical id, one permanent Home and as many Session temporal footprints as conversation truthfully returns to it. Its first appearance in a **new** Session binds it and starts that Session's lifecycle at ACTIVE through the binding row itself; it is never a cross-Session "reopening" and costs no lifecycle row. |
| **B3-02** | Cross-Session continuity is **semantic identity resolution**: a later Session's Emerging Focus binds to an existing Thread only when the current focus refers to the same canonical conversational locus, proven by exact grounding evidence. Same name, repeated wording, similarity, proximity, recency, importance and "best match" are never identity. Same-name ambiguity stays `AMBIGUOUS_EXISTING`, binds nothing, and **blocks** duplicate Thread creation. |
| **B3-03** | Candidate screening is **exhaustive and deterministic**: every canonical Thread dossier of the user, in `thread_id::text COLLATE "C"` order, in fixed chunks of 32, one sequential provider screening call per chunk, against one exact user/world identity version. No retrieval heuristic can silently drop a Thread; a page read against a moved version fails closed. |
| **B3-04** | The FINAL Thread-layer capture of 0070 **supersedes** the B2-only capture of 0068 for B3-enabled batches. 0068 is not wrong: it remains valid implementation-layer evidence and its one structural authority (`conversation_thread_batch_state_v1`) is reused, never rewritten. |
| **B3-05** | Lifecycle transitions are a **deterministic reduction** over canonical B1 functions, attention, focus → Thread bindings and the exact prior committed-CU sequence. No lifecycle model, no timer, no wall-clock duration, no importance, no analytical or background activity. The database re-derives the transitions of every CU from durable rows and refuses any payload that differs. |

---

## 3. Lifecycle semantics (Session-local)

States: `ACTIVE`, `DORMANT`, `REOPENED`. Legal transitions and their reason
codes are the only rows `conversation_thread_lifecycle_events` accepts:

| Transition | Reason | When |
| --- | --- | --- |
| ACTIVE → DORMANT | `EXPLICIT_FOCUS_SHIFT` | the current CU carries a `FOCUS_SHIFT` function and its focus is bound to another Thread |
| ACTIVE → DORMANT | `SUSTAINED_DEPARTURE` | the current CU and the immediately preceding committed CU of the Session (`session_position − 1`) are both *away* from the Thread |
| DORMANT → REOPENED | `GENUINE_RETURN` | the current CU's focus is bound to the dormant Thread |
| REOPENED → ACTIVE | `CONTINUED_ANCHORING` | the current CU's focus is bound to the reopened Thread |
| REOPENED → DORMANT | `EXPLICIT_FOCUS_SHIFT` / `SUSTAINED_DEPARTURE` | as above, for a reopened Thread |

"Away" is defined conservatively. A CU is **never** away from a Thread when it
has `NO_INDEPENDENT_FOCUS`, when its attention is on the Thread's bound focus,
or when a RESOLVED reference of the CU targets that focus's grounding handle
(a brief, local clarification anchored to the Thread). A single away CU never
produces dormancy; dormancy needs the **second consecutive** away CU. A
baseline ACTIVE (establishment or continuity binding) is durable through the
binding row and never costs a lifecycle row.

The same reduction lives twice, byte-for-byte in meaning:
`apps/api/src/thread-lifecycle/thread-lifecycle-reducer.ts` (pure, no I/O) and
`derive_conversation_thread_lifecycle_transitions_v1` in 0070. The validator
compares the proposed transitions with the DB derivation under exact equality
(`THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL`).

---

## 4. The runtime chain

`ConversationThreadLifecycleEstablishmentService` (a plain class, not a Nest
provider) turns ONE durable COMPLETED USER → ASSISTANT finalized exchange into
canonical Session time plus its B1 semantics plus the FINAL Thread layer, per
Moment:

1. relation gate (zero providers, zero mutation on an invalid pair);
2. stable automatic batch identities (exactly T-03A2's derivation);
3. integrated B3 snapshots BEFORE any provider — COMPLETE + COMPLETE is
   canonical replay with zero calls, ABSENT + ABSENT is a new exchange, every
   other combination fails closed with no repair and no backfill;
4. ONE authoritative B3 context, the Session Semantic Clock token and the
   user/world Thread identity version, read outside any database lock;
5. USER and ASSISTANT segmentation, separately (T-03A2 semantics kept);
6. sequential whole-exchange B1 focus evaluation, then ONE B1 canonicalization;
7. for each focus-bearing CU in sequence, strictly sequential: resolve the
   same-Session existing binding deterministically; else page the dossiers
   exhaustively and resolve continuity once; `DISTINCT_NEW` → the frozen
   T-03B2a establishment evaluator; `BIND_EXISTING` / `AMBIGUOUS_EXISTING` →
   no B2 promotion call and no new Thread; deterministic grounded
   Conversational Origin for a new Thread; deterministic lifecycle reduction;
8. ONE whole-exchange Thread (B2) canonicalization and ONE whole-exchange
   Thread-layer (B3) canonicalization, then exact splits;
9. one 0070 coordinator commit against BOTH exact tokens;
10. the SAME external temporal delivery shape T-03A2 returns.

The CU's own bundle — its wording, its RESOLVED grounding surfaces and the
focus it starts — is legitimately visible to its own decision; no later CU
ever is (no hindsight).

---

## 5. Cross-Session continuity

Per focus-bearing CU whose focus is not yet bound in the Session, the
`ThreadContinuityEvaluatorService` pages every dossier of the user (B3-03),
screens each chunk through the provider, validates that every nominated
Thread belongs to the chunk, and resolves once over the nominated set:

* `DISTINCT_NEW` — nothing nominated, or the resolution proves distinctness;
  the frozen B2a evaluator decides establishment as before.
* `BIND_EXISTING` — exactly one Thread, cited by exact identity evidence
  (`prior_identity_evidence`: dossier items that must exist byte-for-byte at
  the exact version) and grounded by the current CU's RESOLVED references to
  the focus grounding handle (`identity_evidence`). The database re-checks
  both sets (`THREAD_CONTINUITY_PRIOR_EVIDENCE_UNKNOWN`,
  `THREAD_CONTINUITY_EVIDENCE_NOT_GROUNDED`, `…_NOT_CURRENT`) and refuses a
  Thread already bound in this Session (`THREAD_ALREADY_BOUND_IN_SESSION`).
  The **same** Thread and the **same** Home are reused; OSDAP is never
  invoked; `conversation_threads.grounding_emerging_focus_id` is never
  rewritten.
* `AMBIGUOUS_EXISTING` — at least two candidates the evidence cannot separate;
  the candidate ids are recorded, nothing is bound, no Thread is created.

The user/world **Thread Identity Clock** (`conversation_world_thread_identity_clocks`)
is a technical optimistic version: it advances by exactly one when a dossier
changes (a new canonical Thread, or a new SESSION_CONTINUITY binding adding
identity evidence) and never for a lifecycle-only transition. A trigger
forbids any other change and any delete. It is not Product time, not SP, not
LH, not knowledge time and not a global Session order.

---

## 6. Migration 0070 — the same-SP rule and the lock order

B1 stays same-SP sequence 1. The whole Thread layer reserves **at most one**
additional sequence, 2, when any durable Thread-layer change happens at a CU
(new Thread, new Session binding, lifecycle transition(s)); every Thread-layer
row of that CU shares it. `conversation_thread_semantic_unit_results` records
`thread_layer_event_sequence` as `NULL` or `2`, with a CHECK tying it to the
outcome. T-03D later reads: no Thread-layer event → LF may be 2; Thread-layer
event → LF may be 3. LF is not implemented here.

AF66-01 lock order, provable from the writer body: Session Semantic Clock
`FOR UPDATE` first → source turn → B1 rows → user/world Thread Identity Clock →
user/world spatial authority (new establishment only, through the frozen 0068
persist path) → Thread / Home / focus-binding / lifecycle rows.

The coordinator checks the Session Semantic Clock token **first**
(`STALE_CONVERSATIONAL_FOCUS_CONTEXT`, SQLSTATE 40001) and then the Thread
identity version (`STALE_THREAD_IDENTITY_CONTEXT`, SQLSTATE 40001). Both are
typed exactly (code AND message) in the repository; the service earns **one**
shared semantic re-evaluation against a re-read context and re-read
dossiers; segmentation is never repeated; a second stale failure is retryable
unavailability. Before any retry the integrated snapshots are re-read: a
canonical winner is returned, partial history fails closed.

`ABSENT | COMPLETE | PARTIAL` for the B3 layer is decided by ONE authority,
`conversation_thread_semantic_batch_state_v1`, which reuses 0068's
`conversation_thread_batch_state_v1` (B3-04). The writer replay gate, the
coordinator halves, the snapshot, the context and the readiness audit all
call it.

---

## 7. Engineering decisions flagged for review

| Id | Decision |
| --- | --- |
| **ED-B3-01** | Threads already bound in the current Session are excluded from the continuity candidate set: B1 already decided that two different Emerging Focus identities are two different loci, and the database refuses a second same-Session binding of one Thread. |
| **ED-B3-02** | The B2 payload of a continuity-bound or ambiguous focus is `NO_ESTABLISHMENT` / `NO_PROMOTION_PATH_PROVEN`, because 0068 ties `ALREADY_ESTABLISHED` to grounding lineage; the B3 result (`ACTIVATE_EXISTING_IN_SESSION`, `AMBIGUOUS_IDENTITY_HOLD`) carries the truth. The writer's coupling gate refuses any other pairing. |
| **ED-B3-03** | `NO_THREAD_ACTION` means no identity or binding action for the CU's **own** focus; other Threads' lifecycle rows may still exist at that CU. |
| **ED-B3-04** | ESTABLISHMENT identity evidence is derived: the RESOLVED references to the focus grounding handle in the starting CU and in the B2 evidence CUs; the database re-derives it and demands exact equality (`THREAD_IDENTITY_EVIDENCE_NOT_CANONICAL`). |
| **ED-B3-05** | The identity clock advances per `ESTABLISH_NEW` / `ACTIVATE_EXISTING_IN_SESSION` only — never for a lifecycle-only CU — so lifecycle churn never invalidates a concurrent Session's dossier read. |
| **ED-B3-06** | Sustained departure fires at the **second consecutive** away CU, using the exact prior committed CU (`session_position − 1`) of the Session; there is no counter, no window and no duration. |
| **ED-B3-07** | Identity ids are RFC 4122 v5 over documented URIs (`thread-focus-binding/v1`, `thread-lifecycle-event/v1`), derived in TypeScript and re-derived in SQL through 0068's `canonical_uuid_v5_v1`; the writer refuses a client id that differs. |

---

## 8. What this task deliberately does NOT do

No live cutover; no service-role grant on any new writer, coordinator, read,
page or audit; no `ConversationService` / `ConversationModule` change; no
revocation of the T-03A2 live authority; no effective LF; no T-03D; no T-03C
historical coverage or projection; no Thread merge; no global cross-Session
lifecycle timeline; no timestamp as lifecycle ordering; no Home move or
recompute (OSDAP is called only through the frozen 0068 path for a NEW
Thread); no mobile or client schema change; no new dependency and no lockfile
change.

---

## 9. Proofs

* `apps/api/src/thread-lifecycle/*.spec.ts` — reducer (cases 1–20),
  canonicalizer (21–32), continuity evaluator (33–48), runtime mapper (49–58),
  repository (59–63) and the whole-exchange runtime (64–95), all against
  injected fakes; CI makes no live provider request.
* `database/verify-migration-0070.mjs` — the real-PostgreSQL verifier
  (cross-Session reuse of the same Thread and Home, ambiguity hold, exhaustive
  paging, lifecycle scenarios and DB re-derivation, same-SP sharing, both
  stale tokens, identity-clock policy, replay, rollback, immutability,
  privileges, audit).
* `database/tests/thread-lifecycle-cross-session-continuity-v1.test.mjs` —
  the static database contract.
* `tests/thread-lifecycle-cross-session-continuity-contract.test.mjs` — the
  repository-wide static anti-scope contract.
