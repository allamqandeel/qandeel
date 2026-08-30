# QANDEEL — Post-Response Intelligence Scheduler & Provider Budget v1

**Phase:** QANDEEL — Integrated Intelligence Runtime & Hardening v1
**Task:** QIR-005 — Post-Response Intelligence Scheduler & Provider Budget v1
**Status: ACTIVE / NORMATIVE**
**Architecture owner:** QANDEEL Architecture
**Provider / LLM product selection:** EXPLICITLY DEFERRED

This document is the normative contract for QIR-005: the explicit, server-owned
provider-call budget of ONE durable post-response intelligence execution, and
the explicit statement of the real post-response dependency graph it protects.

QIR-005 creates **no** new background-intelligence system, **no** generic
workflow engine, **no** generic retry subsystem and **no** new durable ledger.
It closes exactly one integration gap: the number of external provider calls a
single durable post-response execution may make was previously an emergent
property of the dispatcher's control flow rather than an explicit, centralized,
recovery-aware contract.

Any deliberate change to a rule frozen here requires its own versioned,
separately reviewed superseding contract.

## 1. Canonical entry baseline

QIR-005 was implemented from exactly:

- Repository: `https://github.com/allamqandeel/qandeel.git`
- Canonical entry `main`: `a6aa99e91c9c2817308b5c016ebe0ba9e3fcf7e8`
- Canonical entry tree: `51005e4189bfd3ee23892c196c5f300dbd7d0df8`
- Canonical merge identity: PR #180 — QIR-004 Integrated Context Budget & Conflict Resolution v1
- Canonical post-merge API CI: run `33310126117` — completed / success
- Entry migration baseline: `0062_fast_deep_runtime_decision_policy_v2.sql`

**QIR-005 adds NO database migration.** The migration baseline remains 0062.
The existing durable effect ledger already carries every fact the provider
budget needs: the effect key, the effect state, the typed durable result and the
execution identity.

That is a statement about THIS task only: it bans nothing about the future. A
later, separately reviewed migration in any domain — including migration 0063
and any later number — is legal and is not a QIR-005 regression.

## 2. Canonical provider-boundary census

Exactly three canonical post-response effects cross an external provider
boundary at the QIR-005 baseline:

```text
ASSOCIATION_PROVIDER
INTENT_PROVIDER
CANDIDATE_PROVIDER
```

The remaining canonical durable effects are **not** provider-call budget
consumers:

```text
MEMORY_WRITE
HYPOTHESIS_UPDATE_BATCH
HYPOTHESIS_PERSISTENCE
CONFIDENCE_BATCH
HIM_BRAIN_CONTEXT_MATERIALIZATION
```

Information Gap synchronization is also not a provider-call consumer.

**Provider-backed membership is explicit and centralized, never inferred.** It
is never derived from `INTELLIGENCE_EFFECTS`, never computed from an
effect-name substring, and never widened by adding another `IntelligenceEffect`.
Not every `IntelligenceEffect` is provider-backed.

## 3. The frozen provider-call budget v1

```text
POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3

ASSOCIATION_PROVIDER = maximum 1 provider slot
INTENT_PROVIDER      = maximum 1 provider slot
CANDIDATE_PROVIDER   = maximum 1 provider slot
```

The cap equals the size of the frozen v1 provider-backed registry, because each
registered provider effect owns at most ONE durable slot.

**A fourth provider-backed post-response effect cannot be introduced silently.**
Adding one requires editing the frozen registry, which requires a deliberate,
separately reviewed, versioned contract update.

The cap is a compile-time constant. **It is never configurable through an
environment variable**, never scaled per deployment, never scaled by processing
path, and never raised dynamically at runtime.

### 3.1 Budget scope

The budget is scoped to the **entire durable post-response execution
lifecycle**, never to:

- one Redis delivery;
- one consumer cycle;
- one Node.js process;
- one reclaim;
- one retry attempt;
- one dispatcher invocation.

**Process restart, Redis reclaim, duplicate delivery, redispatch or execution
reacquisition must not reset the budget.** The durable effect ledger is the
authoritative source of already-spent provider slots, and it is the ONLY input
to the reconstruction.

### 3.2 What consumes a slot

A provider slot is consumed **only after the provider-backed effect has been
durably claimed successfully**. The integration law is, in this exact order:

```text
budget/schedule authorization
        ↓
durable effect claim
        ↓
slot becomes permanently spent
        ↓
maximum ONE external provider transport attempt
        ↓
typed durable completion
```

**A mere intention to invoke a provider does not spend a slot.**

**A failed durable claim spends no new local slot and must issue zero provider
calls.** The existing non-terminal claim-loss semantics are unchanged.

### 3.3 No refunds

Once a provider-backed effect is durably `CLAIMED`, **its slot is permanently
spent for that execution and is never refunded** — not when the process crashes
after the claim, not when the provider transport times out, not when the
provider returns an error, not when provider output is invalid, not when durable
completion becomes ambiguous, not when later authority validation fails, and not
when the execution quarantines.

This is required because after a durable claim followed by process or transport
ambiguity, the runtime cannot safely prove that an external provider request was
never emitted.

### 3.4 Durable recovery accounting

At execution recovery, provider-budget accounting is reconstructed from durable
effect state. **Both `CLAIMED` and `COMPLETED` provider-backed effects count as
spent.**

A `COMPLETED` provider effect is recovered from its exact typed durable result
and issues **zero provider calls**.

A pre-existing `CLAIMED` effect remains an indeterminate state and follows the
canonical indeterminate-effect quarantine behaviour. **It is never replayed and
its slot is never refunded.** QIR-005 does not weaken, replace or bypass that
behaviour.

Example:

```text
ASSOCIATION_PROVIDER = COMPLETED
INTENT_PROVIDER      = COMPLETED
CANDIDATE_PROVIDER   = absent

spent     = 2
remaining = 1
```

## 4. The narrow scheduler/budget abstraction

QIR-005 introduces one narrow server-owned abstraction under the post-response
intelligence runtime:

```text
apps/api/src/post-response-intelligence/post-response-provider-budget.ts
apps/api/src/post-response-intelligence/post-response-provider-budget.service.ts
```

It owns exactly:

- the explicit provider-backed effect registry;
- the hard provider budget constant;
- reconstruction of spent provider slots from durable effects;
- authorization of the next fresh provider-backed effect;
- protection against duplicate local consumption;
- the explicit budget-exhaustion decision;
- bounded, fail-soft telemetry decision metadata.

### 4.1 What the abstraction must NOT own

**It is not a generic workflow engine.** It must never own:

Association business semantics; Intent extraction semantics; Candidate
generation semantics; Hypothesis authority; Evidence authority; Safety; HIM
semantics; Information Gap semantics; persistence; Confidence; Redis
consumption; retry/reclaim policy; provider/model selection.

**The dispatcher remains the composition and execution engine.** In particular
the dispatcher — not the budget — issues the durable effect claim, so the
abstraction can never grow into a general scheduler of arbitrary work.

The budget object performs no I/O: it reads no database, touches no Redis, calls
no provider, and holds no state that outlives one durable execution's dispatch.

## 5. Explicit post-response dependency graph v1

The canonical v1 dependency order is:

```text
Runtime Event Validation
    ↓
Execution Acquire
    ↓
Canonical Authority
    ↓
Canonical Source-Turn Revalidation
    ↓
Safety = ALLOW
    ↓
HIM Brain Context Materialization
    ↓
Memory Write
    ↓
[only if fresh Evidence exists]
Association Preparation
    ↓
ASSOCIATION_PROVIDER                 [provider slot]
    ↓
Hypothesis Update Batch
    ↓
Information Gap Sync
    ↓
Generation Eligibility
    ↓
INTENT_PROVIDER                      [provider slot]
    ↓
Generation Request Assembly
    ↓
HIM Hypothesis-Generation Context Read
    ↓
CANDIDATE_PROVIDER                   [provider slot]
    ↓
Hypothesis Persistence
    ↓
Confidence Batch
    ↓
Terminal Execution
```

This is a **conditional DAG**, not a requirement that every stage runs on every
turn. A legitimate execution may spend 0, 1, 2 or 3 provider slots.

### 5.1 Frozen true dependencies

- No provider work before canonical authority and Safety `ALLOW`.
- Association provider requires a legitimate fresh Evidence path and successful
  Association preparation.
- Hypothesis Update Batch consumes the durable Association result.
- Information Gap synchronization remains before downstream Intent/Candidate
  provider work when the update path requires it.
- Intent provider requires legitimate generation eligibility.
- Candidate provider requires a recovered or freshly authorized Intent, a READY
  assembly, and a legitimate HIM generation-context read.
- Persistence consumes the durable Candidate result.
- Confidence consumes durable Hypothesis persistence.
- The existing post-persistence Confidence resume remains authoritative.

### 5.2 No false parallelism

**QIR-005 parallelizes nothing.** Association provider is never run concurrently
with Intent provider, Intent provider is never run concurrently with Candidate
provider, Candidate provider is never run concurrently with persistence, and
persistence is never run concurrently with Confidence. These are real semantic
dependencies, not an accident of implementation order.

QIR-005 does not freeze global cross-execution worker concurrency and does not
redesign the Redis consumer architecture.

## 6. Provider gate integration

Every **fresh** provider-backed effect passes the same centralized gate before
its durable claim:

```text
1. budget authorization of the provider-backed effect
2. durable effect claim
3. only if the claim succeeded, mark the local slot spent
4. issue maximum ONE external provider transport attempt
5. persist the typed post-authority/post-validation durable result
```

### 6.1 Association

Fresh `ASSOCIATION_PROVIDER` passes the provider budget gate before its durable
claim. An existing completed Association is recovered from its exact durable
result with zero provider calls.

### 6.2 Intent

Fresh `INTENT_PROVIDER` passes the provider budget gate before its durable
claim. An existing completed Intent is recovered from its exact durable result
with zero provider calls.

### 6.3 Candidate

Fresh `CANDIDATE_PROVIDER` passes the provider budget gate before its durable
claim.

**The existing HIM Hypothesis-Generation Context read remains BEFORE the
Candidate claim**, so a HIM read or integrity failure can never strand
`CANDIDATE_PROVIDER` in `CLAIMED`. The budget gate sits between that read and
the claim, so both fail-closed rules hold simultaneously: a HIM failure claims
nothing and calls no provider, and an exhausted budget issues zero provider
transport and leaves `CANDIDATE_PROVIDER` unclaimed.

An existing completed Candidate is recovered from its exact durable result with
zero provider calls.

## 7. Hard budget exhaustion semantics

Under the valid v1 DAG, provider-budget exhaustion is unreachable during a
legitimate execution. **Provider budget exhaustion is therefore an
integrity/contract violation, not ordinary optional degradation.**

If fresh provider work is requested after the execution has already spent all
three provider slots:

```text
provider transport calls = 0
execution → QUARANTINED
stage     → PROVIDER_BUDGET
```

It is deterministic, it is a terminal quarantine, it issues zero provider calls,
**it never fabricates an intelligence result, it never substitutes stale data
for a missing result, and it never increases the cap dynamically.**

### 7.1 The exhaustion outcome code — bounded repository naming

The contract's requested outcome name is `PROVIDER_BUDGET_EXHAUSTED`. The
repository has a stricter bounded naming convention that takes precedence here:
`public.post_response_intelligence_executions.outcome_code` carries a **closed
`CHECK` domain frozen by migration 0022**, and QIR-005 adds no migration, so a
new outcome code literal cannot be written without an unauthorized schema
change.

QIR-005 therefore uses the exact equivalent inside the frozen domain:

```text
state        = QUARANTINED
outcome_code = AUTHORITY_REJECTED
current_stage = PROVIDER_BUDGET
```

`AUTHORITY_REJECTED` is the canonical existing code for "a server-owned
authority refused this work", which is exactly what the provider-budget gate
does. **The provider-budget identity is carried by the dedicated
`PROVIDER_BUDGET` stage, which no other dispatcher path writes**, and by the
`EXHAUSTED` telemetry decision. The pair is therefore deterministic and
unambiguous. Both halves are declared once, centrally, as
`POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_OUTCOME` and
`POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_STAGE`.

A later, separately reviewed migration may extend the `outcome_code` domain and
give this path its own literal code. That is legal and is not a QIR-005
regression.

## 8. At-most-once external provider transport

For each authorized provider-backed effect slot, the maximum number of external
provider transport attempts is:

```text
1
```

**No post-response provider-backed effect may perform a retry, an SDK retry, a
fallback model, a fallback vendor, a speculative fan-out, a provider race, a
second call after timeout, or a second call after invalid output.**

The canonical v1 provider implementations use zero retries, and QIR-005 freezes
that as an integration requirement of the post-response provider boundary:

```text
HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_RETRIES = 0
HYPOTHESIS_INTENT_EXTRACTION_MAX_RETRIES = 0
HYPOTHESIS_CANDIDATE_GENERATION_MAX_RETRIES = 0
```

QIR-005 is provider-agnostic. The existing model identifiers remain deployment
implementations, **not** the final QANDEEL product/provider selection, which
stays explicitly deferred. QIR-005 depends on no vendor identity.

## 9. Existing durable recovery semantics are frozen

QIR-005 preserves every existing recovery behaviour:

- any pre-existing `CLAIMED` effect at execution recovery → canonical
  indeterminate-effect quarantine;
- `COMPLETED ASSOCIATION_PROVIDER` → typed durable recovery, zero provider replay;
- `COMPLETED INTENT_PROVIDER` → typed durable recovery, zero provider replay;
- `COMPLETED CANDIDATE_PROVIDER` → typed durable recovery, zero provider replay;
- durable Hypothesis Persistence recovery → direct Confidence resume;
- no re-running Memory, Association, Intent or Candidate after persistence completion;
- Confidence `RETRY_PENDING` → non-terminal delivery, Redis pending/reclaim;
- ambiguous managed-command transport → durable reread/reconciliation;
- terminal-only ACK discipline;
- bounded execution delivery attempts;
- the existing first-durable-result / typed-result integrity rules.

**QIR-005 weakens none of these in order to simplify the scheduler.**

## 10. Brain Context and Information Gap ownership

### HIM Brain Context

`HIM_BRAIN_CONTEXT_MATERIALIZATION` **consumes zero provider budget**, remains
in its existing authority-safe position before every legitimate early exit,
remains a managed typed durable effect, and **is not moved behind
Hypothesis-generation eligibility**.

### Information Gap

QIR-005 preserves the current Information Gap synchronization dependency
unchanged. A transient sync failure leaves the delivery non-terminal, so zero
downstream Intent/Candidate provider work happens on that attempt, and the
existing bounded redelivery resumes through the existing idempotent semantics
with no upstream provider replay.

**QIR-005 creates no Question provider call, no foreground Question consumption,
and moves no formal-question authority into another subsystem. That work belongs
to QIR-006 and is not implemented here.**

## 11. Telemetry

One bounded provider-budget telemetry surface:

```text
qandeel.post_response.provider_budget
```

Allowed bounded dimensions:

```text
effect:
  ASSOCIATION_PROVIDER
  INTENT_PROVIDER
  CANDIDATE_PROVIDER

decision:
  AUTHORIZED
  RECOVERED
  EXHAUSTED

processing_path:
  FAST
  DEEP

policy_version:
  "1"
```

Semantics:

- **`AUTHORIZED` is recorded only after a successful durable claim, when the new
  provider slot is actually spent — never for a mere intention to call a
  provider.**
- **`RECOVERED` is recorded when a valid durable completed provider effect is
  consumed with zero provider call.**
- **`EXHAUSTED` is recorded before any provider transport**, when the hard budget
  blocks fresh provider work.

The effect and decision label registries are the SAME frozen QIR-005 registries
the production gate uses, so an invented decision or a fourth provider-backed
effect cannot be emitted even by accident. Any value outside the exact
registries — including an unrecognized processing path — is DROPPED rather than
emitted.

**Telemetry failure remains fail-soft and can never change a budget decision, a
durable claim, or the execution.**

Telemetry never includes a user ID, session ID, turn ID, execution ID, effect
result payload, user text or content, Evidence/Hypothesis IDs, arbitrary error
text, provider/vendor/model name, tokens or secrets, and introduces no unbounded
label.

## 12. Frozen invariant summary

```text
per durable post-response execution:
  Association provider attempts <= 1
  Intent provider attempts      <= 1
  Candidate provider attempts   <= 1
  total provider slots          <= 3
```

The foreground conversational `ModelRouter.generate(...)` call remains OUTSIDE
this post-response budget and remains governed by the separate QIR foreground
invariant of exactly one conversational provider call per turn.

## 13. Forward safety

This contract and its static guard freeze QIR-005-owned facts only. They must
never freeze:

- the current absence of a foreground Question channel or a Question closed loop
  (QIR-006 owns that, and adding it later is legal);
- Provider/model identifiers, provider adapters or the model-profile registry
  (final Provider/LLM selection stays deferred);
- QIR-002 routing thresholds or reasons;
- QIR-003 foreground gatherer semantics or its shared 5000 ms ceiling;
- QIR-004 budget partition values or its context-budget telemetry relation;
- global cross-execution worker concurrency or the Redis consumer architecture;
- future migrations: a later, separately reviewed migration in ANY domain — by
  number and by domain, including a v2 of this task's own domain — stays legal;
- the exhaustion outcome code as permanently `AUTHORITY_REJECTED`: a later
  reviewed migration may extend the frozen `outcome_code` domain.

## 14. Acceptance

QIR-005 is complete only when all of the following hold:

1. The canonical v1 post-response provider-backed effect set is explicit and centralized.
2. The hard durable-execution provider budget is exactly `3`.
3. Each provider-backed effect consumes maximum one slot.
4. A slot is spent only after durable claim success.
5. A spent slot is never refunded.
6. Durable recovery reconstructs spent budget from durable effects.
7. Completed provider results recover with zero provider replay.
8. Pre-existing CLAIMED provider state still quarantines and is never replayed.
9. Fresh provider work is impossible after budget exhaustion.
10. Budget exhaustion performs zero provider transport and fails closed as quarantine.
11. Association → Intent → Candidate true dependency ordering is preserved.
12. No hidden provider/SDK retry, fallback, race or speculative fan-out exists.
13. Brain Context, Information Gap, managed Confidence, durable persistence,
    ACK/reclaim and bounded-attempt semantics remain intact.
14. QIR-002 / QIR-003 / QIR-004 / QHIA frozen surfaces are not regressed.
15. No QIR-006 Question behaviour is implemented early.
16. No migration is added.
