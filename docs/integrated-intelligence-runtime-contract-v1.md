# QANDEEL — Integrated Intelligence Runtime Contract v1

**Phase:** QANDEEL — Integrated Intelligence Runtime & Hardening v1
**Task:** QIR-001 — Integrated Intelligence Runtime Contract v1
**Status: ACTIVE / NORMATIVE** — phase entry contract
**Production behavior change:** NONE (architecture / verification-only)
**Database migration:** NONE
**Provider / LLM product selection:** EXPLICITLY DEFERRED

This document is the versioned, server-owned integration constitution for the
QANDEEL brain as a whole. QANDEEL already has real intelligence subsystems and
a real, proven, closed foreground/background intelligence loop; this contract
invents no new intelligence engine and reimplements no existing subsystem. It
makes the policy of the whole brain — authority, conflicts, bounded foreground
work, budgets, degradation, background work, and provider boundaries —
explicit, versioned, and enforceable, without collapsing existing subsystem
ownership boundaries.

Everything in this contract is exactly one of four kinds of statement, and the
kind is always labeled:

1. **Baseline census** — facts observed at the canonical entry baseline.
   Historical record only; census facts are mutable and later QIR tasks are
   explicitly expected to change many of them.
2. **Frozen integration invariants** — rules every QIR task must preserve.
3. **Target integration requirements** — rules later QIR tasks must implement.
4. **Deferred decisions** — decisions this phase deliberately does not make,
   above all the final Provider/LLM selection and every final numeric budget
   that requires later measurement.

A current implementation detail never becomes a permanent guard merely by
being observed here: if a later QIR task is explicitly expected to replace it,
it is census, not law.

---

## 1. Canonical entry baseline (historical record)

- Repository: `https://github.com/allamqandeel/qandeel.git`
- Canonical entry `main` SHA: `51d70648243c05e60593f38da4d12cb9908a8f14`
- Canonical entry tree: `7a8ed2a3e76710ddf597e63ff9b75bab3a6202c7`
- Canonical merge identity: PR #176 — QHIA-015 Human Intelligence Activation
  Phase Closure / Freeze v1
- Post-merge canonical-main API CI evidence: run `33277311608`,
  `completed / success`, on the exact canonical entry SHA.
- Last closed phase: `QANDEEL — Human Intelligence Activation v1` — status
  **CLOSED / FROZEN** per
  [Human Intelligence Activation Freeze v1](human-intelligence-activation-freeze-v1.md).
- QHIA terminal migration baseline: `0061_him_brain_context_bridge_v1.sql`.
  QIR-001 adds no migration; this is recorded here as a fact of the entry
  baseline, never enforced by scanning the future migration listing.

These SHAs and identities are recorded as the historical entry baseline of the
QIR phase. They do not freeze the live repository's future history.

### Relationship to the QHIA freeze

The QHIA change-control rule is preserved in full: any deliberate change to a
frozen QHIA surface (the 17 canonical v1 metric identities and calibration,
the runtime consumption matrix, the QHIA-006 relevance authority, the
foreground topology and 300 ms budget class, the degradation/fail-closed
classification, the QHIA-012 eight-slot Brain Context bridge, the QHIA-013
provider envelope, and the privacy/non-inference boundaries) requires its own
versioned, separately reviewed superseding contract. No QIR task may silently
change a frozen QHIA surface, and QHIA frozen evidence remains historical.

---

## 2. Why this contract exists

The canonical repository already proves substantial integration: canonical
conversation claim/replay/recovery; ContextBuilder; Safety Response Gate;
Behavioral Response Policy; Memory retrieval; Human Intelligence / HIM
foreground consumption; Hypothesis reasoning context; Recommendation
grounding; FAST/DEEP model-router paths; exactly one normal conversational
provider response path; durable runtime event publication; Redis post-response
consumption; durable post-response effect/result semantics; the
Memory → Evidence → Association → Hypothesis update/generation → Confidence →
Information Gap background flow; Human Intelligence Brain Context
materialization for the next turn; duplicate/recovery/idempotency protection;
the A2 End-to-End Runtime Smoke; and the Full Intelligence End-to-End Runtime
Smoke.

This phase is therefore **not** "first integration." It is integration
governance, coherence, boundedness, and hardening. The canonical problem:

> The systems are connected, but the policy of the brain as a whole is still
> distributed across orchestration code, subsystem contracts, provider
> guidance prose, and background effect ordering.

QIR-001 makes that policy explicit before any integration hardening change is
made.

---

## 3. Baseline census (mutable observations, not targets)

Every item in this census is a **mutable baseline observation, not a frozen
target**. Later QIR tasks are explicitly expected to change several of these
facts under their own reviewed contracts. Nothing in this section may be
turned into a permanent live guard.

### 3.1 Foreground flow

At the canonical entry baseline
(`apps/api/src/conversation/conversation-orchestrator.service.ts`), a normal
provider-generating turn follows:

`claim/recovery → context → safety → Human Intelligence → memory → hypothesis
→ recommendation → one model-router call → finalize`

Observed facts:

- Safety BLOCK finalizes deterministically before any downstream intelligence
  acquisition or provider generation; a blocked turn issues zero Human
  Intelligence reads and zero provider requests.
- COMPLETED replay returns current canonical state; GENERATING replay runs the
  bounded recovery/liveness check exactly once. Neither starts new provider
  work, and a lost claim never starts provider work either.
- FAST/DEEP selection is driven by a primitive input-length threshold:
  `DEEP_INPUT_LENGTH = 1000` with route reasons `FAST_DEFAULT` and
  `INPUT_LENGTH_REQUIRES_DEEP_CONTEXT`. **Census only — QIR-002 replaces
  this.** The runtime-event envelope validator
  (`apps/api/src/runtime-events/runtime-event.types.ts`) currently hard-codes
  the same two route-reason strings and their coupling to the path; QIR-002
  must version that surface deliberately rather than drift it.
- Human Intelligence has the frozen shared foreground wait class
  `HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300` for Snapshot +
  Reflection behind one `Promise.all` barrier, with aggregate-v3 and Brain
  Context launched in the same synchronous step carrying zero required
  incremental foreground wait (late settlement is discarded; no cross-turn
  cache).
- Memory retrieval and Hypothesis reasoning are currently awaited serially
  after the Human Intelligence barrier and therefore contribute separate
  additive foreground stages. **Census only — QIR-003 restructures foreground
  acquisition under one dependency-aware plan.**
- Recommendation grounding is deterministic and read-only from the canonical
  Hypothesis reasoning result; it performs no database, Memory, HIM, Question,
  Information Gap, or provider access and derives no ranking, utility, risk,
  or confidence.
- A normal conversational generation path contains exactly one
  `ModelRouter.generate(...)` invocation, with
  `latencyBudgetMs: 10000 (DEEP) / 3000 (FAST)` sent through the request.
  The single-call fact is a frozen invariant (section 5); the numeric latency
  values are census (section 8.2).
- The turn failure path fails the turn closed (canonical FAILED plus a
  sanitized service-unavailable response); no partial or fabricated provider
  answer is produced.

### 3.2 Context and local caps

Local boundedness exists per source, and only per source:

- Recent conversation context: `RECENT_CONTEXT_EXCHANGE_LIMIT = 4` complete
  authoritative exchanges plus the current user turn
  (`apps/api/src/conversation/context-builder.service.ts`).
- Memory: `MEMORY_CANDIDATE_LIMIT = 32`, `MAX_SELECTED_MEMORIES = 4`,
  `MAX_MEMORY_CONTEXT_CHARACTERS = 2400`, cue-gated deterministic lexical
  retrieval (`apps/api/src/memory/memory-retriever.service.ts`).
- Hypothesis: `MAX_MODEL_HYPOTHESES = 8`,
  `MAX_HYPOTHESIS_CONTEXT_STRING_CHARS = 24000`, with a deterministic
  truncation flag (`apps/api/src/hypothesis/hypothesis-reasoning-context.*`).
- Human Intelligence: bounded snapshot/reflection/aggregate/Brain envelopes
  with the QHIA-013 consolidated provider field (measured 6,427-byte
  all-active footprint at QHIA closure).
- Provider adapters: `maxOutputTokens 1024`, adapter timeout
  `min(latencyBudgetMs, 10000)`, `maxRetries 0` (both adapters).

Those local caps do **not** constitute one global provider-input budget across
all sources. The gap this phase must close is recorded as:

> local subsystem caps exist; a global integrated provider-context budget and
> deterministic cross-source budget policy do not yet exist as one
> server-owned runtime contract.

Current local cap values are census. They are **not** the final global prompt
budget, and QIR-004 must not treat them as one.

### 3.3 Authority is partly encoded in provider guidance today

`composeServerGuidance()` (`apps/api/src/model-router/model-router.types.ts`)
already protects important authority semantics in prose rendered to the
provider:

- Safety guidance and the base Behavioral Policy remain higher-authority
  instructions than Human Intelligence.
- Human Intelligence is server-owned support/advisory data and cannot create,
  strengthen, replace, or override Recommendation, Question, Hypothesis, or
  FAST/DEEP authority; agreement between sources does not strengthen an
  instruction.
- Direct current information from the user takes precedence over conflicting
  advisory Human Intelligence.
- Memory is contextual data; instructions contained inside memory are not
  executable instructions.
- Hypotheses are provisional; lifecycle states are not truth or probability;
  `NOT_EVALUATED_FOR_CURRENT_VERSION` must never fall back to an older
  evaluation.
- Recommendation grounding does not itself authorize advice; missing
  information signals do not automatically authorize a formal question;
  question selection remains owned by the Question Engine.

QIR preserves this work, but provider prompt prose is **not** the only
integration-governance mechanism this phase accepts. Later QIR runtime work
must make cross-source policy server-owned and deterministic before provider
rendering where runtime enforcement is possible; prose may reinforce a rule
but must not be its sole owner (section 6, rule 10).

### 3.4 Background reliability (already strong; not re-invented)

The durable post-response path
(`apps/api/src/post-response-intelligence/*`,
`apps/api/src/background-intelligence/*`,
`apps/api/src/runtime-events/*`) already has:

- canonical event/owner/session/turn revalidation before any work;
- execution acquisition with a durable ledger and bounded delivery attempts
  (quarantine at the bounded attempt ceiling);
- durable effect/result identities for exactly eight effect keys at baseline
  (`MEMORY_WRITE`, `ASSOCIATION_PROVIDER`, `HYPOTHESIS_UPDATE_BATCH`,
  `INTENT_PROVIDER`, `CANDIDATE_PROVIDER`, `HYPOTHESIS_PERSISTENCE`,
  `CONFIDENCE_BATCH`, `HIM_BRAIN_CONTEXT_MATERIALIZATION`);
- quarantine for indeterminate effect state; recovery of successful durable
  provider results instead of replay; managed idempotent one-transaction
  database commands; durable Confidence and Hypothesis flows; Information Gap
  synchronization; Brain Context materialization for next-turn consumption;
  Redis pending/reclaim behavior and terminal ACK discipline.
- Exactly three background provider-boundary effects exist at baseline
  (`ASSOCIATION_PROVIDER`, `INTENT_PROVIDER`, `CANDIDATE_PROVIDER`), each
  invoked at most once per execution with its post-authority result persisted
  durably; the E2E proofs census each at exactly one call with zero replay on
  duplicate delivery. **The observed count is census, never the frozen future
  cap — QIR-005 derives and freezes the cap from the real effect DAG.**

Therefore QIR must **not** create a generic "retry system" task and must not
replace the durable ledger. The integration gap is explicit dependency
scheduling, provider-call budgeting, and whole-pipeline coordination — not
reliability primitives.

### 3.5 Question closed-loop gap

Question / Information Gap Runtime exists and is contractually real
(`apps/api/src/question/*`, the idempotent post-response Information Gap
synchronization, and validated Question Candidates with
`expected_information_gain: null`, `question_utility: null`,
`ranking_state: 'UNASSESSED'`). The foreground Conversation Orchestrator does
**not** currently consume any formal Question opportunity/candidate channel,
and existing Recommendation guidance explicitly states that formal question
selection remains owned by the Question Engine.

The current absence of a foreground Question channel is census, not law:
QIR-006 may close the loop, but must not move formal-question authority into
Recommendation, Hypothesis, Human Intelligence, or the model provider.

### 3.6 Provider boundary census

- `ModelRouter` is one QANDEEL-owned interface with a single
  `generate(request)` method over a normalized, server-owned
  `ModelRouterRequest` envelope.
- Two provider adapters exist under
  `apps/api/src/model-router/providers/` (Anthropic, OpenAI). Both consume
  the same normalized request, render the same server-owned
  `composeServerGuidance` output, sanitize failures to one
  `ModelRouterProviderError`, and own no Safety, Question, Hypothesis,
  Recommendation, Human Intelligence, Memory, or routing semantics.
- The active adapter is selected by the `MODEL_PROVIDER` environment value
  (`anthropic` | `openai`), with a deterministic fake router under test. This
  is deployment configuration, not product selection.
- `model-profile.registry.ts` currently maps FAST/DEEP to vendor model
  identifiers for those two adapters. Census only — see section 4.
- No multi-provider race, fallback chain, or speculative fan-out exists.

### 3.7 Existing integration proofs

The A2 End-to-End Runtime Smoke and the Full Intelligence End-to-End Runtime
Smoke run the real production classes over real PostgreSQL + Redis with
deterministic doubles only at the model/provider transport boundaries. They
already census foreground and background transport by name (attempted AND
completed), prove exactly one conversational provider call per eligible turn,
prove background provider counts stay at one per effect across duplicate
delivery, and prove the closed loop into the next turn. The QIR phase must
extend these proofs (QIR-007), never replace them with weaker mocks or a
parallel test architecture.

---

## 4. Provider / LLM selection is explicitly NOT frozen (deferred decision)

**QANDEEL has NOT selected its final Provider or LLM.**

Existing entries in `model-profile.registry.ts` — including the current
Anthropic and OpenAI model identifiers — are implementation/testable routing
profiles in the canonical repository. Their existence is **NOT** product
approval, procurement approval, performance approval, or a frozen QANDEEL
model decision. Final Provider/LLM comparison and selection is **DEFERRED**
to a later explicit decision/evaluation activity outside this phase.

QIR-001 and the rest of this phase are provider-agnostic.

### Frozen provider-agnostic rules

1. The integrated runtime reasons in terms of QANDEEL-owned capability
   paths/contracts (`FAST`, `DEEP`, budgets, authority, source eligibility),
   never vendor identity.
2. No QIR integration semantic may depend on an Anthropic / OpenAI / Gemini /
   Kimi / any-vendor model name.
3. A provider adapter consumes a QANDEEL-owned normalized request/envelope; it
   never becomes the owner of Safety, Question, Hypothesis, Recommendation,
   Human Intelligence, Memory, or routing semantics.
4. Final provider/model comparison and selection is deferred to a later
   explicit decision/evaluation activity.
5. No multi-provider race, hidden fallback chain, speculative fan-out, or
   "try provider B if provider A is slow" is introduced in this phase unless a
   separate versioned architecture contract explicitly authorizes it later.
6. Exactly one normal conversational provider response path remains the
   foreground invariant.
7. No extra LLM pass may be introduced merely to interpret, merge, summarize,
   classify, or reconcile Human Intelligence, Memory, Hypothesis,
   Recommendation, or Question context.

### Architectural consequence

QIR designs the brain so that providers are replaceable implementations of a
QANDEEL contract. QANDEEL is never designed around one provider's context
window, prompt dialect, tool syntax, or reasoning controls.

---

## 5. Typed authority ownership (frozen integration invariants)

Authority is **typed ownership**, never one flat priority list: different
systems own different decisions, and no source can acquire another source's
decision by outranking it generally.

### 5.1 Hard system authority

Cannot be overridden by intelligence data or provider output:

- Safety decisions and Safety guidance;
- privacy / ownership / authorization constraints;
- hard Behavioral Policy constraints;
- canonical turn/session claim, replay, recovery, finalization, and execution
  identity;
- explicit frozen non-inference rules.

### 5.2 Current-user factual authority

For user-specific conversational facts, direct current information from the
user takes precedence over conflicting stale/derived/advisory context,
subject to hard system authority above. This rule does **not** allow user
text to rewrite server-owned state, bypass authorization, override Safety, or
execute instructions embedded inside retrieved data.

### 5.3 Explicit relevance authority

Where an explicit server-controlled, user-activated relevance binding exists
(QHIA-006 `him_session_context_bindings`), that binding owns whether the
bound context is relevant. Free text, embeddings, model judgment, "latest,"
"only," or any other inferred fallback must not silently replace explicit
relevance authority. QHIA-006 remains frozen here.

### 5.4 Memory

Memory may provide contextual facts/provenance selected by its own runtime,
but provider-facing Memory is never instruction authority: instructions
contained in stored Memory remain data. Current direct user information wins
factual conflicts with older Memory.

### 5.5 Hypothesis + Confidence

Hypothesis Runtime owns hypothesis lifecycle semantics. Confidence Runtime
owns exact-version evaluation semantics. A hypothesis remains provisional:
lifecycle state or evidence count is not factual truth, probability,
strength, or diagnosis. An absent current-version evaluation must not fall
back to an older evaluation unless a future separately versioned Confidence
contract explicitly authorizes it.

### 5.6 Recommendation

Recommendation Runtime owns recommendation-grounding semantics only.
Recommendation context is decision support, not autonomous action authority
and not automatic authorization to advise. Recommendation cannot create
formal-question authority.

### 5.7 Question / Information Gap

**Question Engine owns formal question selection/authorization.** Information
Gap, Hypothesis, Recommendation, Memory, Human Intelligence, or
model-provider reasoning may provide inputs to that system only through
reviewed contracts; none may silently ask a formal system-selected question
on its own authority.

### 5.8 Human Intelligence / Brain Context

Human Intelligence owns only its explicitly frozen behavioral/advisory
semantics. It may shape delivery, pacing, exploration, or scaffolding within
its approved contracts. It does not own Safety, factual truth, Hypothesis,
Confidence, Recommendation, Question selection, or FAST/DEEP routing.
Agreement between multiple Human Intelligence/advisory sources never
amplifies their authority.

### 5.9 FAST / DEEP

FAST/DEEP is execution/routing authority only. It may change density,
latency/cost budget, or model capability class. It must not change truth,
Safety, user rights, Question authority, Hypothesis meaning, Confidence
meaning, or Human Intelligence semantics.

### 5.10 Provider

**The provider has no independent QANDEEL product authority.** It is a
renderer/reasoner operating inside the supplied server-owned request.
Provider output remains subject to the runtime's Safety, authority,
finalization, and downstream contracts.

---

## 6. Cross-source conflict rules (frozen integration invariants)

1. Hard system authority always wins over intelligence/advisory data.
2. Direct current user factual information wins over conflicting
   older/advisory user context, except where the conflicting value is
   server-owned state or policy rather than a user fact.
3. Explicit relevance authority wins over inferred relevance.
4. No number of lower-authority sources may "vote" themselves into higher
   authority.
5. Agreement between Memory / Hypothesis / HIM / Recommendation / any other
   sources must not automatically strengthen a conclusion.
6. Conflicting hypotheses remain competing provisional possibilities unless
   their owning runtime changes lifecycle state through its own contract.
7. UNKNOWN / absent / unavailable is never replaced with a fabricated
   default, zero, "moderate," stale value, or provider guess.
8. Missing current-version Confidence does not use older Confidence as a
   hidden fallback.
9. A provider may not resolve an authority conflict by inventing its own
   hierarchy.
10. Conflict handling must be deterministic and server-owned before or at the
    normalized provider-envelope boundary; prompt prose may reinforce the
    rule but must not be the sole owner of the rule where runtime enforcement
    is possible.

---

## 7. Foreground vs background ownership (frozen integration invariants)

### 7.1 Foreground owns only work required to answer the current turn

Foreground work may include: canonical claim/recovery; bounded context
assembly; Safety; a deterministic FAST/DEEP runtime decision; bounded
acquisition of current-turn intelligence inputs; deterministic
reconciliation/budget assembly; exactly one normal conversational provider
call; canonical finalization.

### 7.2 Background owns work that can safely serve future turns

Background work includes durable post-response intelligence — the existing
Memory / Evidence / Association / Hypothesis update & generation / Confidence
/ Information Gap / Brain Context materialization flows — whenever those
flows are not required to produce the current answer. **No optional
future-turn enrichment may become mandatory serial foreground latency simply
because it exists.**

### 7.3 No structural foreground slowdown from Human Intelligence

The QHIA frozen principle remains intact:

> Human Intelligence must make QANDEEL smarter without making the foreground
> response structurally slow or authority-unsafe.

The existing QHIA 300 ms shared wait class and the zero-incremental-wait
Brain/cross-context semantics must not be silently changed by QIR. Any
deliberate future change to a frozen QHIA surface requires its own versioned
superseding contract.

---

## 8. Runtime budget contract (model frozen; numbers deferred)

QIR-001 freezes the **budget model and its ownership**, and deliberately does
not invent numeric values that require measurement.

### 8.1 Foreground latency

- The QHIA 300 ms shared Human Intelligence wait class is preserved and is
  **NOT** reinterpreted as the whole-brain foreground budget.
- Later QIR work may introduce an integrated intelligence-acquisition
  deadline only after measuring the actual current topology.
- Independent reads must not be serialized without a dependency reason.
- A per-source timeout design must never accidentally add into an unbounded
  total foreground wait.

### 8.2 Provider latency

The current baseline sends `latencyBudgetMs` values (10000 DEEP / 3000 FAST)
through the model-router request. These are current implementation values,
never a final product/provider SLA decision. No QIR task may silently change
those values merely because a new provider has a different latency profile.

### 8.3 Global provider-context budget (target requirement; ceiling deferred)

QIR-001 requires QIR-004 to implement a global integrated provider-context
budget. QIR-001 intentionally does **not** invent the final numeric ceiling —
the final numeric ceiling is deferred to QIR-004, derived from measurement.

The later budget must be two-layered:

1. **Provider-neutral structural budget** owned by QANDEEL before adapter
   serialization: source counts/entries/characters/serialized bytes or
   equivalent deterministic units.
2. **Provider capability/token fit** handled at the adapter/capability
   mapping boundary after a provider is selected/evaluated, without changing
   source authority or truncation semantics.

This prevents QANDEEL architecture from coupling to one vendor tokenizer or
context-window size.

### 8.4 Context-budget safety rules (frozen)

Regardless of final numeric ceilings:

- Safety/hard Behavioral instructions cannot be crowded out by optional
  intelligence;
- the current user turn cannot be dropped to make room for advisory history;
- truncation/omission must be deterministic, source-aware, and observable;
- truncation cannot change the authority of the surviving data;
- one large subsystem cannot silently consume an unbounded share of the
  provider envelope;
- the provider must never be asked to decide which source to trust merely
  because the server exceeded its own budget.

### 8.5 Provider-call budget

- Foreground invariant now: **exactly one normal conversational provider call
  per provider-generating turn.**
- Background invariant now: provider invocation count must be finite,
  explicit, and tied to durable effects. The exact future per-turn background
  provider-call cap is **NOT frozen in QIR-001** — QIR-005 must derive and
  freeze it from the real effect DAG / provider-boundary census. The three
  baseline provider-boundary effects (section 3.4) are census, not the cap.
- No new background provider invocation may be added outside that future
  explicit budget.

---

## 9. Target QIR runtime architecture (target requirements; not implemented here)

The target composition later QIR tasks implement. QIR-001 defines it and
deliberately does not implement any of it — no `IntegratedIntelligence*`
service, no `RuntimePlan` type, no scheduler, no budget manager, no
reconciliation engine exists in this task.

### Layer 1 — Canonical Turn Authority

Owns claim/replay/recovery, canonical context identity, Safety
short-circuit, and the decision whether provider-generating work may begin.

### Layer 2 — Integrated Intelligence Runtime Plan

A server-owned deterministic plan for the turn describing, at minimum
conceptually: FAST/DEEP path; eligible foreground sources; source authority
class; source dependency class; source required/optional classification;
bounded wait/degradation policy; budget ownership; provider-call invariant;
background handoff eligibility. The plan contains no final vendor/model
selection.

### Layer 3 — Bounded Foreground Intelligence Gatherer

Launches independent eligible reads concurrently when dependencies permit,
preserves the QHIA frozen topology, and prevents additive serial waiting.

### Layer 4 — Intelligence Reconciliation & Budget Assembly

Applies server-owned authority/conflict rules and the global provider-context
budget before provider rendering. No LLM call is allowed merely to perform
this reconciliation.

### Layer 5 — Exactly One Conversational Provider Call

The provider receives one normalized QANDEEL-owned request for the selected
capability path.

### Layer 6 — Durable Post-Response Execution Plan

Existing durable effects/results remain foundational. QIR later makes
dependencies and provider budgets explicit as a bounded scheduling graph
without replacing the ledger.

### Layer 7 — Next-Turn Intelligence Bridge

Durably completed background intelligence becomes eligible for the next turn
only through its owning read/revalidation contract. No late in-flight
foreground promise becomes an implicit cross-turn cache.

---

## 10. Integrated failure and degradation taxonomy (frozen classes; mapping is later work)

QIR-001 freezes the integration-level taxonomy. Later implementation tasks
map concrete source failures into these classes.

### 10.1 `HARD_AUTHORITY_OR_INTEGRITY_FAILURE`

Ownership mismatch, canonical identity mismatch, malformed authoritative
data, invariant breach, unrecognized integrity failure. Rule: **fail
closed**. Do not call the conversational provider with invented or untrusted
replacement state.

### 10.2 `OPTIONAL_AVAILABILITY_FAILURE`

A source that is optional for the current response may be omitted only for an
explicitly classified availability/transport failure under its reviewed
source contract. Rule: omit that source; do not fabricate data; do not
convert to UNKNOWN/default; do not silently read an older cache; do not
launch a backup provider/read fan-out.

### 10.3 `FOREGROUND_BUDGET_EXPIRY`

Rule: stop waiting according to the source's approved bounded-wait semantics.
Late settlement must not mutate the already-assembled provider request,
trigger a second provider call, or carry into another turn unless a
separately designed durable bridge explicitly owns that behavior.

### 10.4 `LEGITIMATE_EMPTY`

No eligible data exists and the source contract returned a valid
empty/absent result. Rule: absence is data absence, not an error and not
permission to infer a value.

### 10.5 `BACKGROUND_RETRYABLE_DELIVERY`

Rule: rely on existing durable delivery/effect semantics. Retry/recovery must
never replay a successful durable provider result or duplicate a managed
committed effect.

### 10.6 `INDETERMINATE_DURABLE_EFFECT`

Rule: quarantine/fail closed under the existing post-response semantics. Do
not infer whether an external side effect happened.

### 10.7 `CONVERSATIONAL_PROVIDER_FAILURE`

At the QIR-001 baseline, no hidden provider retry/fallback/race is
authorized. Rule: preserve the existing single provider path and failure
behavior until a separate versioned provider-reliability policy explicitly
changes it.

### Anti-overgeneralization rule (mandatory honesty)

This unified taxonomy is the **target** integration policy. QIR-001 does
**NOT** claim that every current source already implements it: Human
Intelligence has mature classified degradation at the baseline (transport-
vs-integrity classification, typed budget expiry, fail-closed unknowns),
while Memory, Hypothesis, and other lanes still require later QIR integration
work to map their concrete failures into these classes. The contract defines
the target policy while recording current gaps honestly.

---

## 11. Downstream QIR task ownership (established, not implemented, by this contract)

QIR-001 is the entry contract. It identifies — and must not prematurely
implement — the following downstream ownership:

1. **QIR-002 — FAST / DEEP Runtime Decision Policy v2** — replace primitive
   input-length-only routing with deterministic, explainable,
   provider-agnostic routing. No extra LLM classifier.
2. **QIR-003 — Bounded Foreground Intelligence Gatherer v1** — remove
   unnecessary additive waits, launch independent reads under one
   dependency-aware plan, and apply typed degradation without weakening QHIA.
3. **QIR-004 — Integrated Context Budget & Conflict Resolution v1** —
   implement the server-owned global context budget, deterministic source
   budget/truncation policy, and pre-provider reconciliation.
4. **QIR-005 — Post-Response Intelligence Scheduler & Provider Budget v1** —
   make the real background dependency graph explicit and freeze a hard
   provider-call budget while preserving durable effects/results and
   idempotency.
5. **QIR-006 — Question / Information-Gap Closed Loop v1** — connect existing
   Question/Information Gap runtime to background/next-turn integration while
   preserving Question Engine as formal-question authority and adding zero
   extra foreground LLM calls.
6. **QIR-007 — Integrated Brain E2E Hardening v2** — extend A2 + Full
   Intelligence E2E proofs for routing, budgets, conflicts, source outages,
   degradation, Question loop, duplicates, cross-turn consistency, and
   provider-call counts.
7. **QIR-008 — Integrated Intelligence Runtime Phase Closure / Freeze v1** —
   final census, phase-wide regression proof, mandatory adversarial review,
   and closure/freeze.

---

## 12. Explicit non-goals / deferred work

Outside QIR-001 and outside this phase unless separately reopened by
architecture review:

- final Provider selection;
- final LLM/model selection;
- generalized Provider Registry / vendor management;
- multi-provider fallback/racing;
- Voice / realtime audio runtime;
- UI/UX;
- onboarding product experience;
- subscriptions / credits / payments / monetization;
- proactive notifications;
- scientific HIM recalibration or validation;
- freshness/decay model;
- HIM confidence model;
- higher-order Human Intelligence composites;
- trend-aware provider consumption;
- broader Brain slots;
- production dashboards/alerting policy;
- vector/embedding Memory modernization merely for modernization's sake.

None of these areas may be "prepared" opportunistically inside QIR tasks.

---

## 13. Verification surface of this contract

This contract is guarded by
`tests/integrated-intelligence-runtime-contract.test.mjs`, registered as the
`test:integrated-intelligence-runtime-contract` package script and executed in
CI in the static-contract portion before database bootstrap. The guard is
anti-vacuity (it rejects the removal of every load-bearing statement above)
and **forward-safe**: it never freezes a census fact that a later QIR task is
explicitly expected to change — not `DEEP_INPUT_LENGTH = 1000`, not the
input-length-only route reasons, not the Memory-before-Hypothesis serial
ordering, not the current absence of a Question foreground channel, not
current vendor/model identifiers, not current local context caps, and not the
current background provider-call count. Those facts live in section 3 as
history; the guard proves the contract records them and proves the frozen
invariants, and nothing else.

---

## 14. Change-control rule

This contract is the normative entry constitution of the QIR phase. Any
change to a frozen integration invariant in sections 4–10 requires its own
versioned, separately reviewed contract (a new task with its own
verification) that supersedes the specific rule explicitly. Later QIR tasks
implement the target requirements without weakening a frozen invariant as a
side effect. Census facts in section 3 may be changed by the QIR task that
owns them; the census itself remains a historical record of the entry
baseline and is never retro-edited to match later state. The QHIA freeze and
its change-control rule remain in force unchanged.

## 15. Non-claims

This contract does not claim the integrated runtime plan, gatherer,
reconciliation, global budget, background scheduler, or Question closed loop
exist yet; does not claim any provider or model has been selected; does not
claim any numeric global budget or background provider cap; and does not
claim product completion. It records that the connected brain exists and
freezes the constitution under which the rest of the phase hardens it.
