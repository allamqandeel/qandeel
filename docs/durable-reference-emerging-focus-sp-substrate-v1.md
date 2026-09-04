# Durable Reference / Emerging Focus SP-Native Substrate + Per-Moment Integrated DB Writer v1

**Task:** T-03B1b1 (slice b1 of T-03B1b, inside canonical Product task T-03B1) · **Status:** implementation contract · **Migration:** `0066_durable_reference_emerging_focus_sp_substrate_v1.sql`

T-03B1a evaluates one committed CU at a time and returns a prepared, transient result.
T-03B1b makes reference continuity and Emerging Focus durable while preserving the
frozen Stage-6 same-SP order:

```text
1. CU is committed / receives SP
2. references + conversational focus are resolved        ← T-03B1b1
3. Emerging Focus continuity is resolved                 ← T-03B1b1
4. optional Thread establishment                         ← T-03B2
5. effective LF                                          ← T-03D
```

A later writer may not backdate new truth into a sealed SP, and the T-03A2 whole-batch
producer seals every SP except the final head before any later writer could run. This
slice therefore builds the **transaction shape** in which, for every CU / Moment:

```text
allocate this CU's SP
→ make that SP the current open head
→ reserve the same-SP semantic sequence through the ONE T-03A2 seam
→ persist this CU's reference / focus semantic bundle at it
→ only then may the next CU advance the clock and seal this SP
```

T-03B1b1 is **production-inert**. The integrated writer, the exchange coordinator and
the context snapshot are granted to no application role, the T-03A2 `service_role`
grants are untouched, nothing is wired into `ConversationModule` / `ConversationService`,
and no mobile, Thread, LF or T-03C code exists. T-03B1b2 performs the single activation
step after Architecture has reviewed this substrate.

## Durable schema (migration 0066)

| table | role |
| --- | --- |
| `conversation_focus_commit_batches` | one semantic-batch identity per committed-CU batch; DB-derived SHA-256 `canonical_fingerprint` over the canonicalized payload + focus provenance (SP, sequence and audit time excluded) |
| `conversation_unit_focus_semantics` | one append-only bundle per committed CU: frozen `functions[]`, `sequence_position`, prior-CU `target_cu_id`, at the CU's own `(session_position, same_sp_event_sequence)` |
| `conversation_reference_handles` | stable session-scoped reference identity, born at its first grounding `(first_cu_id, first_sp, first_event_sequence)`; no name, label, embedding or type |
| `conversation_reference_resolutions` | one row per material reference: exact anchor + code-point span, `RESOLVED` / `AMBIGUOUS` / `UNRESOLVED`, `resolved_handle_id` iff RESOLVED |
| `conversation_reference_resolution_candidates` | the AMBIGUOUS candidate handles |
| `conversation_claim_attributions` | exact anchor, claimant kind `CURRENT_CONVERSATIONAL_SPEAKER` / `REFERENCE_HANDLE` / `UNRESOLVED`, frozen frame |
| `conversation_emerging_focuses` | stable provisional `emerging_focus_id`, `UNIQUE(session_id, grounding_handle_id)`; no Thread id, Home, lifecycle, LF, active flag or score |
| `conversation_emerging_focus_attention_events` | append-only decision per CU: kind, reason, focus id, same-CU grounding reference index |

Every table is owned by `postgres`, RLS-enabled, unreachable by `anon` /
`authenticated` / `service_role`, and refuses `UPDATE` and `DELETE` for every role
including the owner. Delete/reinsert identity rewriting is impossible.

## Canonicalization (`apps/api/src/conversational-focus/durable-focus-canonicalizer.ts`)

```text
PreparedConversationalFocusResult + stable canonical ids → CanonicalCuFocusSemanticPayload
```

Identity derivation is real RFC 4122 version 5 through the neutral
`runtime-identity/uuid-v5` helper (the exact T-03A2 algorithm, extracted with every
vector preserved):

```text
new reference handle  = uuidV5(https://qandeel.app/runtime/reference-handle/v1 ns, `${sessionId}:${cuId}:${referenceIndex}`)
new Emerging Focus    = uuidV5(https://qandeel.app/runtime/emerging-focus/v1 ns,   `${sessionId}:${startedCuId}`)
```

`newReference` becomes a normal `RESOLVED` row whose handle is created here
(`creates_handle`); `NEW_CURRENT_CU_REFERENCE(referenceIndex)` becomes
`REFERENCE_HANDLE(<that handle>)`; `START_NEW_FOCUS` carries the new stable focus id and
its same-CU grounding index; `ATTEND_EXISTING_FOCUS` carries the exact durable id. A
`prepared:` id that survives anywhere fails closed before the boundary. Same input on any
retry, in any process, yields the same ids and the same payload.

## The integrated per-Moment writer

`commit_conversation_units_with_focus_v1(...)` preserves the entire 0064/0065
commitment contract and adds the per-CU semantic write under the same clock lock:

```text
Session Semantic Clock FOR UPDATE            ← first Stage-6 lock (AF66-01)
→ source turn FOR UPDATE
→ commitment invariants for the batch (frontier, ordinal, digest, spans)
→ for each CU in canonical source order:
    B  insert the CU with its next SP
    C  clock.current_sp = this SP
    D  clock.same_sp_event_sequence = 0
    E  reserve_session_same_sp_event_v1(session, user)      ← the ONE sequence authority
    F  require returned SP == this SP and sequence == 1
    G  persist the whole semantic bundle at (this SP, 1)
    H  next CU (which seals this one)
→ delivery event for the batch
```

`commit_finalized_exchange_with_focus_v1(...)` takes the one Session clock first, locks
USER then ASSISTANT source rows, proves the finalized-exchange relation, and then, unless
both batches already exist, compares the caller's expected token against the locked
clock **before any mutation**:

```text
(expected_current_sp, expected_same_sp_event_sequence) ≠ actual → STALE_CONVERSATIONAL_FOCUS_CONTEXT (40001), zero mutation
```

Before the first SP the token is `(NULL, 0)`, a technical absence and not `PRE_FIRST_SP`.
The provider evaluation of T-03B1b2 runs outside this lock and hands the token in; the
clock is never held across a provider call. A stale-context failure is a concurrency /
re-entry condition, not a reason to mark a completed turn FAILED.

## Database revalidation

The database trusts no caller, `service_role` included. Per CU it re-proves: 1:1 unit
mapping in order; frozen function vocabulary (non-empty, distinct, `FUNCTION_UNRESOLVED`
alone); the four sequence positions; a target that is a prior same-Session CU; every
anchor as the exact code-point substring at its span with the exact named occurrence;
`RESOLVED` = exactly one same-Session handle (or a handle first grounded by this CU),
`AMBIGUOUS` = at least two distinct same-Session handles, `UNRESOLVED` = nothing; the
three canonical claimant kinds; `START_NEW_FOCUS` grounded by a same-CU RESOLVED
reference whose handle grounds no existing focus (`EXISTING_FOCUS_CONTINUITY_REQUIRED`);
`ATTEND_EXISTING_FOCUS` through a resolved link to the focus's grounding handle or as a
reference-clean local continuation of the current focus; and that no prepared identity
ever crosses the boundary.

## Replay / partial state

| situation | outcome |
| --- | --- |
| same batch id + identical CU payload + identical semantic payload and provenance | exact replay: stored rows returned, zero clock, sequence, handle, focus, attention or event mutation; no frontier re-check |
| same batch id + changed CU payload or provenance | `COMMIT_BATCH_PAYLOAD_CONFLICT` (0065) |
| same batch id + changed semantic payload or focus provenance | `FOCUS_BATCH_PAYLOAD_CONFLICT` |
| CU batch exists without its semantic batch or with incomplete bundles | `FOCUS_SEMANTIC_BATCH_INTEGRITY`, never repaired from today's inference |
| zero-CU batch | complete: no SP, no reservation, no rows, no event; payload must be `[]` |

## Context snapshot

`get_conversation_focus_runtime_context_v1(session_id, user_id)` (granted to nobody yet)
returns the token `(base_current_sp, base_same_sp_event_sequence)`, `prior_cus` in SP
order with their durable functions / position / target, `reference_handles` with exact
committed-surface grounding, `focus_candidates` keyed on `emerging_focus_id` with their
START / ATTEND history, and `current_focus_candidate_id` = the latest START / ATTEND by
`(SP, sequence)`. A later `NO_INDEPENDENT_FOCUS` does not erase it. No timestamp
influences any order. Every grounding CU is in `prior_cus` by construction.

## Verification

- `database/verify-migration-0066.mjs` (real PostgreSQL, families A–H, wired into API CI)
- `database/tests/durable-reference-emerging-focus-sp-substrate-v1.test.mjs` (static DB contract)
- `tests/durable-reference-emerging-focus-sp-substrate-contract.test.mjs` (static anti-scope contract)
- `apps/api/src/conversational-focus/durable-focus-canonicalizer.spec.ts` (pinned deterministic vectors)
