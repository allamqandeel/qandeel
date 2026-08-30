# QANDEEL — Bounded Foreground Intelligence Gatherer v1

**Phase:** QANDEEL — Integrated Intelligence Runtime & Hardening v1
**Task:** QIR-003 — Bounded Foreground Intelligence Gatherer v1
**Status: ACTIVE / NORMATIVE**
**Architecture owner:** QANDEEL Architecture
**Provider / LLM product selection:** EXPLICITLY DEFERRED

This document is the normative contract for the QIR-003 Bounded Foreground
Intelligence Gatherer v1: the production abstraction that owns Memory +
Hypothesis foreground acquisition and their typed outcomes, and the
Conversation Orchestrator topology that launches it concurrently with the
frozen Human Intelligence lane after Safety authorizes a provider-generating
turn. It implements the Layer 3 target defined by the QIR-001 Integrated
Intelligence Runtime Contract v1 and changes nothing owned by QIR-002, by the
frozen QHIA phase, or by any later QIR task.

Any deliberate change to a rule frozen here requires its own versioned,
separately reviewed superseding contract.

## 1. Canonical entry baseline

QIR-003 was implemented from exactly:

- Repository: `https://github.com/allamqandeel/qandeel.git`
- Canonical entry `main`: `80532e671508708c0d496523cdb04f18da01f813`
- Canonical entry tree: `f0501b644a87c16a2d25dd6269d91634b404efef`
- Canonical merge identity: PR #178 — QIR-002 FAST / DEEP Runtime Decision Policy v2
- Canonical post-merge API CI: run `33302907218` — completed / success
- Entry migration baseline: `0062_fast_deep_runtime_decision_policy_v2.sql`

**QIR-003 adds NO database migration.** The migration baseline remains 0062.
That is a frozen historical fact of this task, recorded here; it is proven by
this document and the reviewed change itself, and it bans nothing about the
future: a later, separately reviewed migration — including migration 0063 and
any later number, in any domain — is legal and out of this contract's scope.

## 2. The problem this task removes

Before QIR-003 the provider-generating foreground after Safety was
structurally serial:

`Human Intelligence barrier → Memory retrieval → Hypothesis reasoning → Recommendation grounding → provider`

Memory and Hypothesis were additive awaited stages even though they do not
depend on Human Intelligence or on each other. QIR-003 replaces that
serialization with the bounded dependency-aware topology:

`claim → ContextBuilder → Safety → if BLOCK finalize deterministically → otherwise launch QHIA + Memory + Hypothesis concurrently → one join → deterministic Recommendation grounding from a legitimate Hypothesis outcome → provider-envelope assembly → exactly one conversational provider call → finalize`

## 3. Frozen dependency topology

**After Safety returns ALLOW or GUIDED, the Conversation Orchestrator launches
the frozen Human Intelligence lane, Memory retrieval, and Hypothesis reasoning
in the same synchronous post-Safety stage, before awaiting any of them.**

- Memory and Hypothesis do not depend on Human Intelligence.
- Memory and Hypothesis do not depend on each other.
- Memory is never a serial stage after the Human Intelligence barrier.
- Hypothesis is never a serial stage after Memory.
- The provider-generating turn waits for the slower of the frozen Human
  Intelligence lane and the shared Memory/Hypothesis gather deadline — never
  their serial sum.

True dependencies remain and are unchanged: Safety before any intelligence
launch; Recommendation after the Hypothesis outcome; provider-envelope
assembly after the gathered outcomes; the one conversational provider call
after the foreground join; finalization after the single provider result.

**Safety BLOCK short-circuits before any intelligence launch.** A blocked turn
performs zero Human Intelligence reads, zero Memory reads, zero Hypothesis
reads, zero Recommendation work, and zero conversational provider calls.
COMPLETED replays, GENERATING recovery replays, and lost claims likewise start
no new intelligence or provider work.

## 4. Ownership boundary

The production abstraction is:

- `apps/api/src/intelligence-runtime/bounded-foreground-intelligence-gatherer.types.ts`
- `apps/api/src/intelligence-runtime/bounded-foreground-intelligence-gatherer.service.ts`

It owns exactly **Memory + Hypothesis foreground acquisition and typed
outcomes**. It is deliberately narrow: it is NOT a whole-brain runtime
planner, NOT a context budget manager, NOT a background scheduler, NOT a
Question engine, and NOT a provider router.

**QIR-003 does not rewrite Human Intelligence.** The frozen QHIA lane remains
semantically unchanged and remains owned by the Conversation Orchestrator's
`him_context` stage: the shared Snapshot + Reflection 300 ms foreground wait
class, the ONE existing QHIA barrier, aggregate-v3 zero-required-incremental-wait
semantics, Brain Context zero-required-incremental-wait semantics, the current
relevance authority, the current non-inference rules, the current privacy
boundaries, the current fail-closed integrity behavior, and the consolidated
ONE `humanIntelligence` provider field are all preserved exactly. The
Conversation Orchestrator remains the composition point that launches the
frozen QHIA lane and the QIR-003 gatherer in the same post-Safety stage.

## 5. The ONE shared non-HI foreground ceiling

```ts
QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS = 5000
```

- The deadline starts ONCE, at Memory/Hypothesis gather launch.
- Memory and Hypothesis share the SAME absolute deadline: one timer, one
  window.
- There is no 5 s Memory window followed by another 5 s Hypothesis window, no
  fresh 5 s window after either source settles, and no per-source additive
  foreground deadline. **The maximum QIR-003 non-HI foreground wait after
  launch is one 5000 ms ceiling.**

The 5000 ms value is a structural safety ceiling derived from the current
canonical authenticated Data API transport boundary (each transport request
already carries a shared 5000 ms timeout, and a serial multi-stage Hypothesis
read can span more than one transport window). It is **NOT** the QHIA 300 ms
Human Intelligence budget, **NOT** a whole-turn budget, **NOT** a Provider
SLA, and **NOT** a final product latency target. The QHIA 300 ms budget is
unchanged, the existing FAST/DEEP provider latency-budget values are
unchanged, and the QIR-003 ceiling is never used by any Human Intelligence
read.

## 6. Typed foreground outcomes

Memory and Hypothesis outcomes are typed and **non-interchangeable**:

- `AVAILABLE` — the source answered with real content.
- `LEGITIMATE_EMPTY` — the source answered authoritatively that there is
  nothing.
- `OPTIONAL_AVAILABILITY_FAILURE` — an approved transport availability
  failure; the source could not answer.
- `FOREGROUND_BUDGET_EXPIRY` — the shared deadline passed before the source
  settled.

Hard authority/integrity failures have NO outcome state: they fail closed
rather than becoming ordinary degraded outcomes, rejecting the gather with the
original error so the turn fails through the existing fail-closed path before
any provider generation.

**Internal typed states and telemetry never collapse unavailable or expired
into legitimate empty.** Unavailable or expired Memory is OMISSION — never a
valid empty-memory assertion, never a stale answer from a previous turn, and
never fabricated Memory. Unavailable or expired Hypothesis is never converted
into a fabricated `{ coverageState: 'EMPTY' }` result.

Memory classification:

- deterministic no-retrieval (cue gate off) → `LEGITIMATE_EMPTY`
- successful zero selected memories → `LEGITIMATE_EMPTY`
- successful non-empty selection → `AVAILABLE`
- approved transport availability failure → `OPTIONAL_AVAILABILITY_FAILURE`
- shared deadline expiry → `FOREGROUND_BUDGET_EXPIRY`
- malformed / authority / unexpected failure → hard fail closed

Hypothesis classification:

- canonical `coverageState: EMPTY` result → `LEGITIMATE_EMPTY`
- canonical AVAILABLE result → `AVAILABLE`
- approved transport availability failure → `OPTIONAL_AVAILABILITY_FAILURE`
- shared deadline expiry → `FOREGROUND_BUDGET_EXPIRY`
- `HypothesisReasoningInvariantError` → hard fail closed
- malformed / authority / unexpected failure → hard fail closed

## 7. Exact optional-availability classifier

ONLY the following may degrade to `OPTIONAL_AVAILABILITY_FAILURE`:

1. Nest `ServiceUnavailableException` from the canonical read
   transport/configuration path;
2. `MemoryDataApiError` with HTTP status 408, 429, or 500–599.

Hard fail closed for: `HypothesisReasoningInvariantError`; `MemoryDataApiError`
with any other 4xx status, including 401 and 403; malformed results;
owner/user/version/contract invariant violations; Recommendation grounding
invariant failures; unexpected error types; and anything not positively
identified as an approved availability failure.

**The default is HARD FAIL CLOSED.** Classification is by constructor identity
and numeric HTTP status only: no error-message substring matching exists on
this path, and the upstream database message/code is never read or exposed for
QIR-003 degradation classification.

## 8. Late-settlement rule

When a source exceeds the shared deadline, the turn stops waiting for it, and:

- handlers stay attached, so a late rejection can never become an unhandled
  rejection;
- any late result is discarded for the current turn;
- the provider request is never mutated;
- no second conversational provider call is triggered;
- nothing is cached into another turn;
- no implicit background bridge is created;
- there is no retry, no fallback, no backup read, and no fan-out.

Transport cancellation is not required, and no broad cancellation architecture
is introduced for this task.

## 9. Recommendation dependency

Recommendation remains deterministic, read-only, and Hypothesis-owned:

- Hypothesis `AVAILABLE` → the existing grounding runs normally.
- Hypothesis legitimate `EMPTY` → the existing deterministic empty grounding
  may run.
- Hypothesis `OPTIONAL_AVAILABILITY_FAILURE` → **Recommendation grounding is
  not called**; Hypothesis and Recommendation are both omitted.
- Hypothesis `FOREGROUND_BUDGET_EXPIRY` → **Recommendation grounding is not
  called**; both are omitted.
- A Recommendation grounding invariant failure fails the turn closed.

There is no Recommendation fallback and no provider-generated replacement.

## 10. Provider-envelope semantics

Memory:

- `AVAILABLE` → the actual Memory context is included.
- `LEGITIMATE_EMPTY` → no Memory field.
- `OPTIONAL_AVAILABILITY_FAILURE` → the Memory field is omitted.
- `FOREGROUND_BUDGET_EXPIRY` → the Memory field is omitted.

Hypothesis / Recommendation:

- `AVAILABLE` → the existing valid provider fields.
- legitimate `EMPTY` → no available Hypothesis/Recommendation field.
- unavailable / expired → both omitted without fabrication.

**No extra LLM call may be introduced to interpret, reconcile, summarize, or
recover missing intelligence. Exactly one normal conversational provider call
per provider-generating turn remains mandatory.**

## 11. Telemetry

Bounded fail-soft source-outcome telemetry:

- Metric: `qandeel.foreground.intelligence.source`
- Finite dimensions only:
  - `source = MEMORY | HYPOTHESIS`
  - `outcome = AVAILABLE | LEGITIMATE_EMPTY | OPTIONAL_AVAILABILITY_FAILURE | FOREGROUND_BUDGET_EXPIRY | HARD_FAILURE`
  - `processing_path = FAST | DEEP`
  - `policy_version = "1"`

Exactly one outcome is emitted per source per gather, at the moment the
source's outcome is determined; a settlement after the deadline emits nothing.
Values outside the exact finite registries are dropped rather than emitted.
The metric never carries user content, Memory content, Hypothesis text, IDs,
access tokens, arbitrary exception messages, database error body/code/message,
or Provider/model identity. Telemetry is fail-soft and can never alter a
gather outcome or the turn.

Existing engine telemetry remains: the pre-existing `memory_retrieval` and
`hypothesis_context` engine spans are preserved unchanged (now emitted from
the gatherer under the same correlation scope), and the pre-existing
hypothesis-context outcome metric keeps its
available/consumed/empty/rejected/failed vocabulary — `rejected`/`failed` are
recorded exactly when a hard Hypothesis failure is the source outcome.

## 12. What QIR-003 does NOT do

- It does not change QIR-002 routing: the FAST/DEEP decision-before-claim
  topology, the v2 policy algorithm, the route reasons, and the routing
  telemetry are untouched.
- It does not change the Safety order or launch intelligence before Safety.
- It does not change the QHIA 300 ms budget or any frozen QHIA semantics.
- It does not change provider latency-budget values.
- It does not modify provider adapters, `model-profile.registry.ts`, or any
  final Provider/LLM selection. QANDEEL has NOT selected its final Provider or
  LLM; QIR-003 is provider-neutral and vendor-neutral.
- It does not implement QIR-004 global integrated context budgeting or
  conflict resolution, QIR-005 background scheduling or provider-call budgets,
  QIR-006 Question foreground consumption, or QIR-007 E2E expansion beyond the
  verification necessary for QIR-003.
- It adds no database migration, no retry, no fallback read, no fan-out, no
  LLM classifier/reconciler, and no second conversational provider call.

## 13. Forward safety

This contract freezes only QIR-003-owned invariants. It deliberately does
**NOT** freeze:

- the current absence of future Question foreground consumption — QIR-006 owns
  the Question foreground channel and may add one under its own reviewed
  contract;
- current global-context behavior — QIR-004 owns the global integrated
  provider-context budget and may wrap or re-shape provider-context assembly;
- the current background provider-call count — QIR-005 owns the background
  scheduler and its cap;
- Provider/model identifiers — final Provider/LLM selection is deferred;
- any final product latency SLA — the 5000 ms ceiling is a structural
  transport-boundary safety bound, not a product latency target;
- future migrations — a later, separately reviewed migration in any domain,
  including this one, remains legal.

## 14. Verification surface

QIR-003 is enforced by:

- the focused gatherer spec
  `apps/api/src/intelligence-runtime/bounded-foreground-intelligence-gatherer.service.spec.ts`
  (deterministic deferred promises and fake timers: concurrent launch, the one
  shared deadline, per-source expiry, late-settlement discard and absorption,
  the exact availability classifier, hard-fail-closed defaults, and bounded
  fail-soft telemetry);
- the Conversation Orchestrator spec's QIR-003 block (post-Safety concurrent
  launch of all three lanes, join-before-dispatch, slower-of-not-sum,
  provider-envelope omission semantics, Recommendation gating, replay/lost-claim
  zero-work, and exactly one conversational provider call);
- the Foundation integration gate and the Full Intelligence end-to-end smoke,
  which drive the REAL gatherer;
- the static contract
  `tests/bounded-foreground-intelligence-gatherer-v1-contract.test.mjs`,
  registered as the package script
  `test:bounded-foreground-intelligence-gatherer-v1-contract` and as an API CI
  step alongside the QIR-001 and QIR-002 static contracts.

## 15. Acceptance statement

QIR-003 is complete only when QANDEEL proves:

> After Safety authorizes a provider-generating turn, frozen Human
> Intelligence, Memory retrieval, and Hypothesis reasoning begin without
> unnecessary serial dependency; Memory and Hypothesis share one bounded
> 5000 ms foreground ceiling; legitimate empty, availability failure, budget
> expiry, and hard integrity failure remain typed and non-interchangeable;
> Recommendation is grounded only from a legitimate Hypothesis result; late
> work cannot mutate the turn or trigger a second provider call; QHIA remains
> frozen; and exactly one conversational provider call remains the foreground
> invariant.
