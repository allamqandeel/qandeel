# Focus Runtime Orchestration + Activation Readiness v1 — Production-Inert Semantic Chain

**Task:** T-03B1b2 (slice b2 of T-03B1b, inside canonical Product task T-03B1) · **Status:** implementation contract · **Migration:** `0067_conversation_focus_runtime_integration_readiness_v1.sql`

## AC-B1B2-01 — the live writer is NOT cut over

The frozen Stage-6 same-SP order is `CU / SP → reference + focus → Emerging Focus
continuity [T-03B1] → optional Thread establishment [T-03B2] → effective LF [T-03D]`, and
a sealed SP may never be reopened. If the B1-only writer became live now, every Moment
committed before T-03B2 / T-03D landed would be sealed without the Thread / LF same-SP
facts those tasks must write truthfully. Therefore:

```text
T-03B1a   evaluator semantics                          CLOSED / MERGED
T-03B1b1  durable B1 substrate + per-Moment writer     CLOSED / MERGED
T-03B1b2  runtime orchestration + cutover readiness    ← this slice (production-inert)
T-03B2    extends the SAME per-Moment chain with Thread establishment
T-03D     extends the chain with effective LF + owns the final live authority cutover
```

This slice grants nothing to `service_role`, revokes no T-03A2 authority, registers
nothing in `ConversationModule`, changes nothing in `ConversationService`, and writes
no B1 semantics from the production request path. The T-03A2 path stays exactly live.

## Rulings on the T-03B1b1 warnings

- **R-B1B2-01** — `(last_sp, 1)` is the correct integrated clock state: B1 is the first
  Stage-6 semantic layer on the Moment. The still-live T-03A2 path ends at
  `(last_sp, 0)`; that is an implementation-era difference, not Product state. Nothing
  resets or fakes the sequence.
- **R-B1B2-02** — a commitment batch without complete B1 semantics is incomplete
  technical history. It is never repaired by re-running today's provider against a
  sealed SP. The cutover-readiness audit reports it as a blocker; nothing solves it here.

## Migration 0067 — read / audit substrate only

- `get_conversation_integrated_batch_snapshot_v1(session, user, source_turn, batch)`:
  the T-03A2 commitment snapshot (delegated, so ownership, replay and source-frontier
  semantics are preserved) plus `focus_batch_exists`, `focus_semantic_count`,
  `focus_attention_count`, `focus_complete`. Non-zero batches are complete only with the
  focus batch at the committed unit count and exactly one agreeing semantic row and one
  agreeing attention row per committed CU; a zero-CU batch is complete only when its
  zero-unit focus batch row exists. Partial state is explicitly incomplete, never
  `batch_exists = false`. No timestamp participates.
- `assert_conversation_focus_capture_cutover_ready_v1()`: `STABLE`, `SECURITY DEFINER`,
  granted to nobody. Raises `FOCUS_CAPTURE_CUTOVER_NOT_READY` (55000) with the first
  offending batch on: commit batch without focus batch (including a zero-CU commitment
  without its zero-unit focus batch), focus batch unit-count / identity mismatch, a
  committed CU without semantics, a committed CU without attention history, or a
  semantic / attention row disagreeing with its CU. It backfills, mutates and declares
  nothing, and readiness is never a Product-state column.
- Privilege posture at migration end: the two new reads, the 0066 writer / coordinator /
  context snapshot and the same-SP seam are executable by no application role; the
  T-03A2 `service_role` grants are exactly as before.

## Runtime (all under `apps/api/src/conversational-focus/`, none registered in Nest)

- `conversation-focus-runtime.types.ts` — snapshot / context / request / result shapes,
  `StaleConversationalFocusContextError`, `ConversationFocusIntegrityError`,
  `ConversationFocusEstablishmentUnavailableError`, `MAX_STALE_CONTEXT_RETRIES = 1`.
- `conversation-focus-runtime-mapper.ts` — the strict mapper: Session identity, positive
  SPs with only `(null, 0)` before the first SP, strictly ascending prior CUs, unique CU
  ids, USER/ASSISTANT roles, frozen vocabularies, every handle / focus grounding closed
  over the returned prior CUs, current focus among the returned candidates, no B1
  bundle missing on a prior CU, no timestamp; invalid context is rejected, never cleaned.
- `conversation-focus-runtime.repository.ts` — `readIntegratedBatchSnapshot`,
  `readRuntimeContext`, `commitFinalizedExchangeWithFocus` over the service-role
  channel; maps **only** SQLSTATE `40001` whose message names
  `STALE_CONVERSATIONAL_FOCUS_CONTEXT` to `StaleConversationalFocusContextError`.
- `focus-resolution-binding.ts` — the lazy binding seam; the factory reads the
  environment only when called, on first actual need inside a fresh exchange.
- `conversation-focus-establishment.service.ts` — the orchestration below; returns the
  same `{ liveHead, committedEvents }` delivery T-03A2 returns.

### Typed database error transport (additive)

`DataApiError(status)` stays source-compatible. Both conversation Data API services now
parse only bounded `code` / `message` strings from a PostgREST error body into an
opaque identity readable through `readDataApiUpstreamIdentity(error)` as
`{ databaseCode?, databaseMessage? }`; malformed bodies fall back to status-only; the
identity is not a property of the error and never reaches a user-facing response.

### Orchestration order

```text
A  relation gate (USER, ASSISTANT, same Session, assistant.source_turn_id = user.id)
B  automatic batch ids = T-03A2 derivation
C  integrated snapshots: both complete → stored delivery, zero providers;
   one half / partial / legacy → fail closed before providers; neither → continue
D  ONE authoritative context + token (base_current_sp, base_same_sp_event_sequence)
E  USER and ASSISTANT segmentation, separately (T-03A2 semantics, frontier authoritative)
F  CurrentCu = deterministic unit id + sliceByCodePoints(turn.content, span) + global ordinal
G  orderFinalizedExchange(userCus, assistantCus) → evaluateSequence(...), strictly sequential
H  canonicalizePreparedFocusSequence over the whole exchange, split by exact CU counts
I  one binding, one identical provenance tuple (a zero-CU sequence issues no proposal)
J  commit_finalized_exchange_with_focus_v1 with the exact expected token
K  { liveHead, committedEvents } — no reference / focus content to the client
```

### Bounded stale-context recovery

On a commit failure: re-read the integrated snapshots; a complete winner is returned
with no second segmentation and no second focus evaluation; partial / legacy fails
closed. Only `StaleConversationalFocusContextError` with neither batch present earns
**one** focus-only re-evaluation: the source frontiers must be unchanged, the context is
re-read, segmentation is reused, canonicalization repeats, and the commit is retried
once with the new token. A second stale failure is `STALE_CONTEXT_RETRY_EXHAUSTED`
(retryable unavailability). A non-stale error never enters the stale branch. Every
failure leaves both turns COMPLETED: no `failTurn`, no regeneration.

## Verification

- `conversation-focus-establishment.service.spec.ts` (the 35 required cases),
  `conversation-focus-runtime-mapper.spec.ts`, `conversation-focus-runtime.repository.spec.ts`,
  `focus-resolution-binding.spec.ts`, `supabase-data-api.error-identity.spec.ts`
- `database/verify-migration-0067.mjs` (real PostgreSQL, families A–D)
- `database/tests/conversation-focus-runtime-integration-readiness-v1.test.mjs` and
  `tests/conversation-focus-runtime-integration-readiness-contract.test.mjs`, both wired
  into API CI
