# QANDEEL — Integrated Intelligence Runtime Phase Freeze v1

**Status: CLOSED / FROZEN**

**Phase:** QANDEEL — Integrated Intelligence Runtime & Hardening v1
**Task:** QIR-008 — Integrated Intelligence Runtime Phase Closure / Freeze v1

The QANDEEL Integrated Intelligence Runtime & Hardening phase (QIR) is closed.
This document freezes what the phase proved, what it deliberately did not claim,
the deferred work it never attempted, and the change-control rule that governs
every later touch of a frozen QIR surface.

The phase principle that closes here, proven in executable production
architecture:

> **QANDEEL's already-built subsystems must behave as ONE bounded, authority-safe
> system on every turn — deterministically routed, bounded in the foreground,
> reconciled inside a server-owned context budget, spoken through exactly one
> conversational provider call, and continued durably in the background under a
> hard provider budget.**

`Integrated Intelligence Runtime CLOSED` is **NOT** the statement
`QANDEEL PRODUCT COMPLETE`. The first is made here; the second is explicitly not
made.

**QIR closure is NOT QANDEEL product completion.**

Architectural rule of this closure: **closure, not expansion; freeze, not
redesign; evidence, not ceremony.** Every claim below maps to an executable,
registered proof. Nothing here was marked satisfied from documentation alone.

---

## Pre-closure canonical baseline (historical record)

- Repository: `https://github.com/allamqandeel/qandeel.git`
- Pre-closure canonical `main` SHA: `a2d4c3390edebfd93dcc6003ba1165d8988a07e8`
- Pre-closure canonical tree: `91a082effdff16ad165ed763f5186ab4ede3828f`
- Canonical merge identity: QIR-007 Addendum A — Cross-Context Adversarial &
  Human Intelligence Capacity Proof v1 (PR #184)
- Post-merge canonical-main API CI: run `33339907674`, `completed / success`, on
  the exact pre-closure SHA.
- **Terminal migration at QIR closure: `0063_question_information_gap_closed_loop_v1.sql`.**
  The phase adds no migration after 0063 and QIR-008 adds no migration at all.

This is **historical closure evidence**. It records the terminal migration and
the proven tree **of the closed phase**;
it is **not a live future repository ceiling**.
The live repository may legally grow past this baseline — later,
separately reviewed migrations are legal by number and by name. See
[Historical guard forward-safety repair](#historical-guard-forward-safety-repair).

---

## Closed QIR v1 inventory

The closed phase consists of exactly these components. No other numbered QIR
task exists and the order is frozen:

1. QIR-001 — Integrated Intelligence Runtime Contract v1
2. QIR-002 — FAST / DEEP Runtime Decision Policy v2
3. QIR-003 — Bounded Foreground Intelligence Gatherer v1
4. QIR-004 — Integrated Context Budget & Conflict Resolution v1
5. QIR-005 — Post-Response Intelligence Scheduler & Provider Budget v1
6. QIR-006 — Question / Information-Gap Closed Loop v1
7. QIR-007 — Integrated Brain E2E Hardening v2
8. QIR-007 Addendum A — Cross-Context Adversarial & HI Capacity Proof v1
9. QIR-008 — Integrated Intelligence Runtime Phase Closure / Freeze v1

Addendum A is **merged closure evidence carried under QIR-007**, not a separate
numbered task: it extended the QIR-007 dynamic verifier, its static contract and
its normative document, and it changed no production semantics.

**QIR v1 has no planned QIR-009.** Future deliberate changes to a frozen QIR
surface require a separately reviewed, versioned superseding contract or a later
phase/task. Normal future product work — UI, voice, onboarding, subscriptions,
notifications, deployment — does **not** reopen QIR unless it intentionally
changes a frozen invariant.

---

## QIR-001 obligation reconciliation

Every downstream obligation QIR-001 established is reconciled against an owner
contract, an executable proof, and a package/CI registration. Documentation
alone was never accepted as satisfaction.

| QIR-001 obligation | Owner | Executable proof | Registration | Verdict |
|---|---|---|---|---|
| deterministic provider-neutral FAST/DEEP decision | QIR-002 | `tests/fast-deep-runtime-decision-policy-v2-contract.test.mjs`, `database/verify-migration-0062.mjs` | `test:fast-deep-runtime-decision-policy-v2-contract`, `verify:fast-deep-runtime-decision-policy-v2:integration` | SATISFIED |
| bounded dependency-aware Memory/Hypothesis foreground acquisition | QIR-003 | `tests/bounded-foreground-intelligence-gatherer-v1-contract.test.mjs` | `test:bounded-foreground-intelligence-gatherer-v1-contract` | SATISFIED |
| server-owned integrated context budget + conflict resolution | QIR-004 | `tests/integrated-context-budget-conflict-resolution-v1-contract.test.mjs` | `test:integrated-context-budget-conflict-resolution-v1-contract` | SATISFIED |
| durable post-response provider lifecycle budget | QIR-005 | `tests/post-response-intelligence-scheduler-provider-budget-v1-contract.test.mjs` | `test:post-response-intelligence-scheduler-provider-budget-v1-contract` | SATISFIED |
| formal Question / Information-Gap closed loop | QIR-006 | `tests/question-information-gap-closed-loop-v1-contract.test.mjs`, `database/verify-migration-0063.mjs` | `test:question-information-gap-closed-loop-v1-contract`, `verify:question-information-gap-closed-loop:integration` | SATISFIED |
| adversarial integrated E2E hardening | QIR-007 | `apps/api/scripts/verify-integrated-brain-end-to-end-hardening-v2.ts`, `tests/integrated-brain-e2e-hardening-v2-contract.test.mjs` | `verify:integrated-brain:e2e-hardening-v2`, `test:integrated-brain-e2e-hardening-v2-contract` | SATISFIED |
| cross-context integrated adversarial + reachable HI capacity proof | QIR-007 Addendum A | scenarios C5–C8 in `apps/api/scripts/verify-integrated-brain-end-to-end-hardening-v2.ts`, `apps/api/scripts/integrated-brain-e2e-hardening-v2/human-intelligence-capacity.ts` | `verify:integrated-brain:e2e-hardening-v2`, `test:integrated-brain-e2e-hardening-v2-contract` | SATISFIED |
| final census / freeze / regression closure | QIR-008 | `tests/integrated-intelligence-runtime-phase-closure-contract.test.mjs` | `test:integrated-intelligence-runtime-phase-closure-contract` | SATISFIED |

The QIR-001 entry constitution itself remains guarded by
`tests/integrated-intelligence-runtime-contract.test.mjs`
(`test:integrated-intelligence-runtime-contract`), and the two inherited
integration gates it recorded — `verify:a2-e2e-runtime-smoke` and
`verify:full-intelligence-e2e-runtime` — remain registered and green.

**No QIR-001 obligation is unresolved. No `QIR-008 Closure Blocker` was raised.**

---

## Frozen integrated runtime constitution

This section summarizes — it does not replace — the detailed owner contracts.
Where a number or rule appears here, the owner contract and its registered guard
remain the authority.

### Authority

- Safety, privacy, authorization and canonical server state remain **hard
  authority**; no advisory source may override them.
- Direct current-user factual information beats conflicting stale or advisory
  user context, except server-owned policy/state.
- Explicit server-owned relevance beats inferred relevance.
- **There is no source voting**, and agreement among advisory sources does not
  amplify authority.
- `UNKNOWN` / absent / unavailable / omitted / unevaluated is **never**
  fabricated, defaulted, or silently replaced by stale data.
- Provider output owns **no independent QANDEEL product authority**.

### FAST / DEEP

QIR-002 v2 routing is frozen as **deterministic, provider-neutral and
Unicode-aware**, with **no LLM routing classifier**. Routing is **execution
authority only**: it cannot redefine truth, Safety, Hypothesis, Confidence,
Question or Human Intelligence semantics.

### Foreground boundedness

```text
QHIA shared Human Intelligence wait class   = 300 ms
QIR-003 Memory + Hypothesis shared ceiling  = 5000 ms
QIR-006 Question selection ceiling          = 300 ms
```

Independent eligible reads remain concurrent when dependencies permit.

The cross-context aggregate lane remains:

```text
ZERO incremental wait
no dedicated timeout
never directly awaited
late settlement discarded
rejection / late / malformed = omission
no direct per-channel fallback
no cross-turn cache
```

### One conversational provider call

```text
exactly ONE normal conversational provider call
per provider-generating turn
```

There is no Question provider, no reconciliation LLM pass, no provider racing,
no hidden fallback, and no hidden conversational generation retry. A Safety
BLOCK or hard-fail turn may legitimately produce zero calls.

### Integrated context budget

```text
Mandatory Core                  65536
History                         16384
Memory                           8192
Human Intelligence               8192
Hypothesis + Recommendation     24576
Question                         8192
TOTAL                          131072
```

Frozen with the budget: UTF-8 byte accounting, **no borrowing between slices**,
a non-truncatable fail-closed Mandatory Core, complete contiguous newest History
exchanges, a ranked Memory prefix, atomic Human Intelligence, atomic
Hypothesis + Recommendation, atomic Question, and one normalized QANDEEL-owned
`ModelRouterRequest`.

This is a structural, provider-neutral model-input text ceiling. It is **not** a
claim about any model's token window.

### Human Intelligence capacity closure evidence

Two distinct facts are frozen side by side and must never be conflated:

```text
canonical all-active QHIA-013 fixture bytes:            6427
current maximum REACHABLE coherent HI footprint:        7518
Human Intelligence slice bytes:                         8192
headroom bytes:                                          674
capacity verdict:                                       PASS
```

`6427` is the frozen canonical **all-active QHIA-013 fixture** footprint — one
exact fixture, whose Brain Context lane carries two of the eight frozen slots.
It is preserved verbatim and is **not** the maximum reachable envelope.

`7518` is the **current maximum reachable coherent Human Intelligence
incremental provider footprint**. It is authoritative because it:

- searches 2000 coherent candidates over the whole legal session-metric shape
  space and both ACTIVE reflection directives;
- builds ONE canonical `HimReasoningContext` per candidate and drives **both**
  `HimInteractionAdaptationService.derive(...)` and
  `HimFastDeepConsumptionService.project('DEEP', ...)` from that exact object,
  so no unreachable pairing can be measured;
- carries all 3 currently legal session reasoning metrics, all 8 Brain Context
  slots, all 4 cross-context guidance channels ACTIVE, and the maximum legal
  Reflection contribution;
- measures through the REAL production compiler, the REAL renderer and the REAL
  QIR-004 assembler, with no estimated or hand-counted byte.

The winning **reachable** state is frozen as:

```text
hse.stress                UNKNOWN / LATEST_EVENT_INVALIDATED
hse.energy                KNOWN   / VERY_LOW
hse.attention             UNKNOWN / LATEST_EVENT_INVALIDATED
derived adaptationState   ACTIVE
derived driver            ENERGY_LOW_OR_VERY_LOW
reflection directive      GENTLE_REFLECTION_INVITATION
cross-context ACTIVE      4
Brain Context slots       8
behavioral instructions   11
```

**The superseded synthetic figure `7536` is verification history only and is NOT current authority.**
It came from a search that paired an always-maximal
hand-built Interaction Adaptation with every session-metric shape — a state a
real turn cannot reach.

Neither the 8192-byte slice nor the 131072-byte global budget was widened to
make anything fit.

### Cross-context integrated adversarial closure (Addendum A)

Accepted as QIR-007 proof:

```text
C5 — cross-context rejection isolation        PASS
C6 — cross-context late-settlement isolation  PASS
C7 — malformed aggregate isolation            PASS
C8 — all-four-contexts ACTIVE composition     PASS
```

Frozen conclusions:

- exactly **one aggregate-v3 read** per turn;
- no aggregate-v1/v2 fallback;
- no direct Situation/Decision/Goal/Relationship per-channel fallback;
- a rejected, late or malformed aggregate is an **OMISSION**, never an
  authoritative all-four `NONE` answer;
- **no partial salvage**, no sorting, padding or repair of a malformed envelope;
- all four real consumers can be ACTIVE simultaneously;
- they compile into **ONE Human Intelligence provider envelope**;
- instruction IDs are a semantic **set union with deduplication**, emitted once
  in frozen canonical registry order;
- agreement creates **no vote, count, weight, confidence, strength or
  amplification** field of any kind;
- no context id, binding id, cross-context metric key, slot label, binding
  state, directive name or internal instruction ID reaches the provider through
  this behavioral path.

### Background provider lifecycle

```text
ASSOCIATION_PROVIDER
INTENT_PROVIDER
CANDIDATE_PROVIDER

POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3
```

Frozen: CLAIMED and COMPLETED slots count as spent and are never refunded;
duplicate delivery, reclaim or redelivery never resets the budget; a completed
effect is recovered, not replayed; indeterminate CLAIMED provider work is never
speculatively replayed; and **there is no `QUESTION_PROVIDER`**.

### Question closed loop

```text
Information Gap:   OPEN / RESOLVED / SUPERSEDED
Formal binding:    SELECTED / BOUND / RELEASED
```

Frozen: the Question Engine owns formal selection; same-session authority
applies and cross-session questioning is forbidden; Safety `ALLOW` is required
and GUIDED/BLOCK perform zero formal selection; only a provider-safe
`QuestionContext` ever leaves the server; the Question slice stays atomic at
8192 bytes; there is no Question provider; **a user turn by itself never means
answered or resolved**; canonical Hypothesis/Confidence synchronization owns
closure; and stale bound state cannot permanently block legitimate progression.

### Recovery / reclaim / idempotency

Frozen QIR-005/QIR-007 conclusions:

- duplicate terminal redelivery does not replay completed work;
- real Redis reclaim uses the **original pending entry** — recovery publishes no
  copy;
- spent provider slots are reconstructed from the durable effect ledger;
- a pre-existing CLAIMED effect goes fail-safe/quarantine, never replay;
- durable downstream Confidence/Gap work resumes from a completed persistence
  checkpoint without provider replay.

---

## Verification evidence at closure

Proven at the pre-closure baseline and preserved by frozen, CI-registered
guards:

- Post-merge canonical-main API CI run `33339907674` — `completed / success` on
  the exact pre-closure SHA: full API Jest suite, database static suite, fresh
  PostgreSQL migration chain 0001 → 0063, every measurement-model and
  forward-compatibility verifier, the Foundation gate, the HIM
  structured-measurement preflight, and the three runtime E2E gates.
- The seven constituent QIR static contracts (QIR-001 … QIR-007) plus the QHIA
  phase-closure contract, all registered as package scripts and executed in the
  CI static-contract section **before** database bootstrap.
- The QIR-002 migration-0062 routing verifier and the QIR-006 migration-0063
  closed-loop verifier against real PostgreSQL.
- The QIR-007 dynamic gate against **real PostgreSQL 17 and real Redis 7**,
  including Addendum A scenarios C5–C8 and the reachable Human Intelligence
  capacity proof.
- The QIR v1 runtime verification tail, unchanged, in this relative order:

```text
verify:a2-e2e-runtime-smoke
→ verify:full-intelligence-e2e-runtime
→ verify:integrated-brain:e2e-hardening-v2
```

**QIR-008 added no fourth QIR runtime E2E.**
That is a historical scope fact about this task's own diff, not a permanent
inventory ceiling on the repository. What stays frozen is the identity of those
three QIR v1 gates, their continued package and CI registration, and their
relative order.
**A later, separately reviewed product-phase runtime gate is legal and does not reopen QIR merely by existing.**
It would reopen QIR only by intentionally changing a frozen invariant of this
document.

- TypeScript app and scripts no-emit, Nest API build, npm-only toolchain
  contract, `git diff --check`, and a credential/security scan.

---

## Known non-blocking observation

Recorded at closure; it is accepted, it is not a production bug, and **no new
task is created from it**:

- **QIR-007 G3.** The current frozen Question objectives are constant-sized and
  substantially below the 8 KiB Question slice, so a real current production
  turn cannot naturally reach `QUESTION / OMITTED_BUDGET`. QIR-007 therefore
  proved the two halves separately on real authorities: real assembler **atomic
  Question omission** (never partially retained) exercised adversarially at the
  assembler, and canonical **database-owned reservation RELEASE** exercised on a
  real turn whose finalization carries no binding identity.
  **This split proof is accepted.**
  It matters only if a future versioned Question contract increases
  provider-safe Question size or semantics.

---

## Historical guard forward-safety repair

Before closure, the QIR-006 and QIR-007 historical static guards froze the LIVE
repository to "latest migration = 0063 / no migration 0064" — correct while
proving their own tasks added no migration, but not forward-safe after phase
closure. QIR-008 repaired both as verification-only debt:

- `tests/question-information-gap-closed-loop-v1-contract.test.mjs` (QIR-006)
- `tests/integrated-brain-e2e-hardening-v2-contract.test.mjs` (QIR-007)

QIR-008 Fix 01 applied the same rule to the closure guard itself
(`tests/integrated-intelligence-runtime-phase-closure-contract.test.mjs`), which
had introduced two live ceilings of its own: an exact-inventory assertion that
the repository may contain only the three QIR v1 `e2e`/`end-to-end` verify
scripts, and a live check that no `0064_*` migration file exists. Both are now
recorded as historical scope facts here instead of being enforced against the
future, mutable repository, and the guard scans its own source so neither shape
can return.

Each guard now freezes only the durable historical facts of the QIR v1 baseline:
`0063_question_information_gap_closed_loop_v1.sql` EXISTS and was the terminal
migration of the CLOSED QIR v1 historical baseline, and every original QIR-006
migration identity/order/content invariant remains protected by its historical
tests. No guard now requires the live repository's latest migration to remain
0063, bans a future migration by number, or bans a future migration by
filename — a historical verifier cannot prove that an old task "added no later
migration" by scanning the future, mutable migration listing, so "database diff
zero" for QIR-007, Addendum A and QIR-008 is recorded here as a fact of the
frozen baseline rather than enforced against future filenames.

Hypothetical later migrations — `0064_future_product_phase.sql`,
`0065_voice_runtime_v1.sql` and `0066_subscription_runtime_v1.sql` — pass every
historical QIR guard, proven by acceptance fixtures using listing entries only.

**QIR-008 created no migration and modified none: its `database/` diff is zero.**
That is a historical fact of this task's own diff, recorded here rather than
enforced by inspecting the future migration listing — exactly the rule QIR-008
applied to QIR-006 and QIR-007. A later, separately reviewed migration is legal
by number and by name, including one numbered 0064. Future work that revisits a
frozen QIR surface still requires its own explicit versioned change-control
contract; historical tests simply no longer reject it by number or name.

This follows the forward-safe QHIA closure precedent recorded in
`docs/human-intelligence-activation-freeze-v1.md`.

---

## Deferred beyond this phase

**QANDEEL has NOT selected its final conversational Provider or LLM.** The
existing provider adapters and model profiles are implementation **capability
surfaces**, not product approval.

Integrated Intelligence Runtime closure does **NOT** complete, and this freeze
makes no claim about:

- final Provider selection;
- final LLM/model selection;
- provider quality bake-off;
- real-provider latency and cost;
- provider token/context-window fit;
- future provider reliability/fallback architecture;
- voice / realtime audio runtime;
- UI/UX and product experience;
- onboarding product surfaces;
- subscriptions, credits, and payments;
- notifications and proactive product behavior;
- deployment and operations;
- product monitoring dashboards and alert policy;
- future scientific HIM calibration/validation;
- a freshness/decay model;
- a HIM metric confidence model;
- higher-order composites;
- trend-aware provider consumption;
- broader future Brain slots.

**These are deliberate deferrals, not QIR closure defects.**

**QIR closure is not product completion.**

---

## Change-control rule

The frozen QIR v1 surface is: the QIR-001 authority and conflict constitution,
the QIR-002 FAST/DEEP routing law, the QIR-003 foreground boundedness topology
and its 300 / 5000 / 300 ms wait classes, the cross-context zero-incremental-wait
architecture, the QIR-004 131072-byte budget and its six isolated slices, the
one-conversational-provider-call rule, the QIR-005 provider registry and cap of
3, the QIR-006 Question / Information-Gap closed loop, and the QIR-007 +
Addendum A recovery, capacity and privacy conclusions above.

> **Any deliberate change to a frozen QIR v1 surface requires a separately
> reviewed, versioned superseding contract.**

Examples:

- FAST/DEEP law change → a routing vNext contract;
- context budget or slice change → a context-budget vNext contract;
- provider cap or effect-registry change → a provider-budget vNext contract;
- provider fallback or racing → a separate reliability architecture contract;
- Question selection, closure or ranking change → a Question vNext contract;
- any QHIA frozen surface → obey QHIA change control;
- any Human Intelligence capacity-changing semantic → a versioned owner contract
  **and** a re-measurement of the reachable maximum.

Such a change must keep every frozen guard green or supersede it explicitly in
the same reviewed change, and must never weaken authority, boundedness, budget,
privacy or idempotency invariants as a side effect. Documentation-only
corrections must not alter recorded baselines or verdicts.

Normal UI, voice, payments, notifications or deployment work does **not** reopen
QIR unless it intentionally changes a frozen invariant.

---

## Non-claims

This freeze does not claim product completion; does not claim any provider or
model has been selected; does not claim any real-provider latency, cost or
context-window result; does not claim voice, UI, onboarding, subscriptions,
notifications or deployment readiness; does not claim scientific validation of
any Human Intelligence metric; does not claim the historical pre-closure
baseline is a ceiling on the live repository; and does not claim any capability
listed under [Deferred beyond this phase](#deferred-beyond-this-phase).

It claims exactly this: the integrated intelligence runtime QIR-001 specified
exists, is bounded, is authority-safe, is proven by registered executable
evidence at the recorded baseline, and can now STOP.
