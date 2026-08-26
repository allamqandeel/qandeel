# Confidence Batch Reliability v1 (QAN-AUD-06)

Forward migration: `database/migrations/0035_confidence_batch_reliability_v1.sql`.

## Finding closed

> Per-Hypothesis Confidence failures are swallowed and the batch/execution are durably marked complete.

Before this change `CONFIDENCE_BATCH` was the last generic, result-less effect. The
dispatcher claimed it, looped the accepted Hypothesis IDs with an empty `catch`,
then completed the effect generically and terminalized the execution `COMPLETED`.
Five failure classes followed:

1. one failed target still produced a durable `COMPLETED` batch and a terminal
   `COMPLETED` execution — false durable success;
2. a crash after some targets committed left a `CLAIMED` batch that the global
   fail-closed rule could only quarantine, with no way to resume the rest;
3. a crash after every evaluation but before the generic completion left no
   durable proof that the batch had been fully evaluated;
4. no durable record of the exact target versions existed, so a retry could
   silently evaluate a later Hypothesis version;
5. `confidence_evaluations` is an immutable history table with no batch identity,
   so an ambiguous transport outcome could not be answered from history and a
   fresh random evaluation UUID could duplicate a committed evaluation.

`CONFIDENCE_BATCH` is now a **managed typed effect**, exactly like the A2.3c
`HYPOTHESIS_UPDATE_BATCH`: the ordinary claim
(`claim_post_response_intelligence_effect_v1`) and the generic result-less
completion (`complete_post_response_intelligence_effect_v1`) both fail closed for
it (`CONFIDENCE_BATCH_MANAGED` / `CONFIDENCE_BATCH_COMMAND_REQUIRED`), so the new
path can never produce a `CLAIMED` Confidence row. After 0035 no generic
result-less effect remains at all, and the application-level generic abstraction
(`GenericIntelligenceEffect`, the repository `complete()` method and the
dispatcher `effect()` helper) was removed rather than kept as a fake generic path.

## Durable item plan

`public.post_response_confidence_batch_items` is the bounded 0..5 child work
state owned by the single `CONFIDENCE_BATCH` effect — **not** a second
orchestration ledger, queue, scheduler or dynamic per-target effect key.

| column | meaning |
| --- | --- |
| `execution_id` | owning post-response execution (`ON DELETE RESTRICT`) |
| `ordinal` | 1..5 position in the durable generation persistence order |
| `hypothesis_id` | exact target from the durable `HYPOTHESIS_PERSISTENCE` result |
| `target_version` | exact current version frozen at first batch initialization |
| `confidence_evaluation_id` | stable database-generated evaluation identity |
| `state` | `PENDING` / `RETRY_PENDING` / `EVALUATED` / `QUARANTINED` |
| `failure_code` | bounded reason; NULL exactly for `PENDING` and `EVALUATED` |

Invariants: primary key `(execution_id, ordinal)`, unique
`(execution_id, hypothesis_id)`, globally unique `confidence_evaluation_id`,
positive `target_version`, and a bounded failure vocabulary
(`CONFIDENCE_ATTEMPT_FAILED`, `TARGET_UNAVAILABLE`, `TARGET_VERSION_DRIFT`,
`EVALUATION_ID_CONFLICT`, `RESULT_INTEGRITY_FAILURE`). The table carries no raw
error text, stack trace, provider payload, Memory content, statement text or
transcript content, has RLS enabled, and grants no direct DML or SELECT to
`anon`, `authenticated` or `service_role`. `PENDING` is initialization-in-
transaction state only: every item resolves before the command returns.

## Managed command

```sql
public.execute_post_response_confidence_batch_v1(p_execution_id uuid) RETURNS text
```

`SECURITY DEFINER`, owner `postgres`, fixed empty `search_path`, `EXECUTE`
granted to `service_role` only. The application supplies **only** the execution
identity — never a userId, sessionId, target ID, target version, Evidence,
Confidence payload, access token or user JWT. The command derives:

- the owner from the locked RUNNING `post_response_intelligence_executions` row;
- the exact ordered targets from the durable `HYPOTHESIS_PERSISTENCE` result
  (migration 0033), validated with the existing
  `post_response_persisted_hypothesis_ids_valid_v1`;
- each target version from the canonical Hypothesis row at first initialization;
- one stable evaluation UUID per target, generated in the database.

Evidence eligibility, Confidence snapshot construction, policy version,
assumptions/competitors handling, missing-information logic and provenance are
**not** duplicated: every row is written through the canonical
`public.background_create_confidence_evaluation_v1` boundary.

Return vocabulary:

| status | meaning |
| --- | --- |
| `COMPLETED` | the typed Confidence effect is durably complete |
| `RETRY_PENDING` | at least one item needs retry; no batch effect; execution stays RUNNING |
| `QUARANTINED` | irrecoverable item/work mismatch; the dispatcher quarantines |
| `NO_OP` | race / missing / terminal condition; reread durable state before deciding |

## Typed result semantics

```text
NO_CONFIDENCE_TARGETS       -- durable persistence was NO_HYPOTHESES_PERSISTED
CONFIDENCE_BATCH_EVALUATED  -- every frozen target has a valid Confidence evaluation
```

`NO_CONFIDENCE_TARGETS` carries no reference and no payload and requires no item
rows. `CONFIDENCE_BATCH_EVALUATED` carries the exact ordered receipt array,
bounded to 1..5, in the original durable persistence order:

```ts
{ ordinal: number; hypothesisId: string; targetVersion: number; confidenceEvaluationId: string }
```

There is deliberately **no** `PARTIAL`, `PENDING_RETRY` or `FAILED` completed
effect result. The audit invariant is explicit: the batch is complete only when
every target has a valid result. The final item transitions and the typed
completion commit in the same database transaction.

## Retry behaviour

Each Confidence attempt is isolated in its own exception sub-block, so one target
failing can never roll back another target's committed evaluation. An already
`EVALUATED` item is never re-evaluated, and a retry always reuses the item's
durable `confidence_evaluation_id` and frozen `target_version` — so duplicate
delivery and redelivery can never add a duplicate immutable Confidence row.

- expected retryable failure → `RETRY_PENDING` / `CONFIDENCE_ATTEMPT_FAILED`;
- irrecoverable identity/version/integrity failure → `QUARANTINED` with a bounded
  code.

`RETRY_PENDING` makes `dispatcher.dispatch(...)` return `false`, so the Redis
entry stays pending and the **existing** bounded reclaim/redelivery mechanism
retries it later. No new queue, scheduler, polling worker, cron or retry service
was added, and the existing execution `attempt_count` / `MAX_ATTEMPTS` policy
remains authoritative. At retry exhaustion the execution may quarantine under
that existing policy; the Confidence batch is still never represented as
completed unless every item evaluated.

## Post-persistence resume boundary

Once `HYPOTHESIS_PERSISTENCE` is durably `COMPLETED` on a still-RUNNING
execution, a redelivery resumes **directly** at the managed Confidence batch.
This is mandatory: generation eligibility is recomputed from current canonical
state, so a world change between the original persistence and the retry could
terminate the execution `SKIPPED` and strand a durable generated Hypothesis
without its required Confidence evaluation.

The resume path runs after the existing envelope validation, execution
acquisition, no-illegal-`CLAIMED` check, max-attempt gate, authority validation,
Safety gate and canonical source-turn/routing reread — and then reruns **none**
of Memory write, Association preparation/provider, the automatic Hypothesis
Update batch, generation eligibility, the Intent provider, the Candidate provider
or Hypothesis persistence. It rebuilds the generation result from durable state
only, cross-checked with the same pure recovery functions the fresh path uses
(`recoverDurableIntentProviderResult` → `recoverCandidateProviderResult` →
`recoverHypothesisPersistenceResult`). Missing, legacy, malformed, foreign,
reordered or inconsistent durable generation state quarantines under the existing
`INTENT_RECOVERY` / `CANDIDATE_RECOVERY` / `HYPOTHESIS_PERSISTENCE_RECOVERY`
stages; nothing is inferred or repaired from current Hypothesis rows. Fresh-path
ordering is unchanged:

```text
Memory → Association → automatic HYPOTHESIS_UPDATE_BATCH → Eligibility → Intent
→ Candidate → HYPOTHESIS_PERSISTENCE → managed CONFIDENCE_BATCH → terminal
```

## Exact target-version rule and version-drift quarantine

The first Confidence-batch initialization locks every durable target in
deterministic UUID order, requires owner = execution owner, and captures each
Hypothesis's **current version at that moment**. That frozen version is
authoritative for every retry of that item: a candidate-creation version is never
used, and a newer version is never rediscovered on retry.

If a target advanced past its frozen version before the retry, the item becomes
`QUARANTINED` / `TARGET_VERSION_DRIFT`, the execution quarantines, and the batch
never completes. The later version is **not** evaluated on behalf of the frozen
target and no Confidence row of any version is written for it. Historical
Hypothesis snapshot reconstruction is explicitly out of scope.

## Ambiguous transport

The managed command is atomic but HTTP is not. On `COMPLETED`, `NO_OP` or a lost
response the dispatcher rereads the durable ledger and reconciles:

- a valid typed completed Confidence result → recover and continue to terminal
  `COMPLETED` with zero Confidence replay;
- a malformed or legacy completed Confidence result → quarantine
  (`INDETERMINATE_EFFECT` / `CONFIDENCE_BATCH_RECOVERY`);
- no completed Confidence effect → return `false` and allow redelivery (this
  safely covers both "nothing committed" and a committed
  `RETRY_PENDING`/`QUARANTINED` item state the command resolves next attempt);
- ledger reread unavailable → return `false`.

Success is never fabricated from an HTTP outcome.

## Upgrade behaviour

Migration 0035 is forward-only and rewrites nothing: no execution, effect row,
Hypothesis, Confidence evaluation, Candidate/Persistence result or
Association/update result is backfilled or rewritten, and historical terminal
executions stay historical.

- **Legacy `COMPLETED` `CONFIDENCE_BATCH` with a null result** — never inferred
  as success. On a still-RUNNING recoverable execution it classifies as
  INDETERMINATE and quarantines; a terminal historical execution is not replayed.
- **Legacy `CLAIMED` `CONFIDENCE_BATCH`** — the existing global fail-closed
  CLAIMED rule still applies: quarantine, with no inference about which targets
  succeeded and no blind replay.

New executions after 0035 never use generic claim or generic completion for
Confidence.

## Non-goals

Explicitly not in this change: Hypothesis Lifecycle Completion; a retry engine
for A2.3c `PENDING_RETRY` update receipts; HIM runtime consumption; information
gap / question integration; reasoning → recommendation integration; any
Intelligence E2E runtime redesign; QAN-AUD-09 Memory concurrency/idempotency;
QAN-AUD-10 Model Router consolidation; new provider or model calls; a new
Confidence score/band/calibration model; historical Hypothesis snapshots; a
generic job scheduler; a new Redis stream or queue; microservices; UI/mobile/
voice work; and any foreground latency change. Post-response intelligence remains
entirely outside the foreground response critical path, and
`BackgroundIntelligenceEnrichmentService.evaluateHypothesisConfidence(...)` /
`BackgroundIntelligenceDataApiService.createConfidenceEvaluation(...)` are
preserved unchanged — the managed generation path simply no longer calls the
application-level helper.

`docs/post-generation-confidence-snapshot-integration-v1.md` remains a historical
description of the earlier v1 generation-Confidence behaviour.
