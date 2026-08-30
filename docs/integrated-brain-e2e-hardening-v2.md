# QANDEEL — Integrated Brain End-to-End Hardening v2

**Status: ACTIVE / NORMATIVE**

**Task:** QIR-007 — Integrated Brain E2E Hardening v2
**Phase:** QANDEEL — Integrated Intelligence Runtime & Hardening v1

---

## 1. Purpose

QIR-007 is the final **adversarial integrated proof layer** over QIR-001..QIR-006,
before QIR-008 Phase Closure / Freeze.

It proves that QANDEEL's already-built brain behaves as **one bounded system**
when its frozen subsystems operate together under multi-turn cognition,
FAST/DEEP, optional-source failure and expiry, hard integrity failure, authority
conflict, context pressure, Safety, duplicate/reclaim/recovery, the durable
provider-budget lifecycle, formal Question isolation, and privacy constraints.

> **Prove the frozen production architecture. Do not redesign it.**

## 2. The zero-semantics rule

QIR-007 is **not a feature task**. Its default rule is **ZERO new production
semantics**. It adds:

- no runtime/product behaviour change;
- no database schema change and **no migration 0064** — the terminal migration
  of this contract's baseline remains
  `database/migrations/0063_question_information_gap_closed_loop_v1.sql`;
- no provider, no model, no provider/model selection;
- no fourth background provider effect and no `QUESTION_PROVIDER`;
- no retry, fallback, provider-racing or hidden-retry framework;
- no second conversational provider call and no reconciliation LLM pass;
- no FAST/DEEP policy change, no context-authority or budget change;
- no Question or Information-Gap semantics and **no answer detector**;
- no test-only production branch.

A **verification-harness** defect may be fixed inside QIR-007. An existing
**production semantic defect** may never be silently repaired: the task STOPS
and reports a `QIR-007 Production Blocker` instead (section 9).

**Provider/model neutrality.** QANDEEL has not selected its final Provider or
LLM. Nothing in this verifier depends on a vendor or model identifier, no
provider adapter is imported, and no provider API key is read. External HTTP is
made structurally impossible by a verifier-scoped `globalThis.fetch` guard that
throws `INTEGRATED_BRAIN_E2E_HARDENING_V2_EXTERNAL_HTTP_FORBIDDEN`.

## 3. What runs

Real infrastructure, real production code:

- **real PostgreSQL 17** and **real Redis 7** (the same CI services the frozen
  A2 and Full Intelligence smokes use);
- the **real** Conversation Orchestrator, ContextBuilder, Safety gate,
  Behavioral policy, Human Intelligence lane, QIR-003 bounded foreground
  gatherer, QIR-004 Integrated Context Budget Assembler, QIR-006 Question
  foreground selection, Recommendation grounding, Runtime Event Publisher,
  Redis Streams transport, Redis post-response consumer, Post-Response
  Intelligence Dispatcher, and every canonical `SECURITY DEFINER` command;
- the **real** telemetry service (wrapped by a transparent recording proxy that
  forwards every call unchanged).

Deterministic in-process doubles exist **only** at the external model/provider
transport boundaries:

- one conversational Model Router double, which records the request and the
  output of the **real** `composeServerGuidance`, returns one fixed benign
  assistant text, and can raise exactly one canonical provider failure;
- the three frozen A2 background provider doubles (Association proposal, Intent
  extraction, Candidate generation).

Verification-only PostgREST substitutes (reused from the frozen smokes) and
fault injectors live in `apps/api/scripts/integrated-brain-e2e-hardening-v2/`.
The fault injectors only lose transports, return canonical HTTP statuses, defer
a settlement, or deliver a malformed successful payload — they never fabricate
durable state and never decide an authority answer. **There is no parallel fake
intelligence architecture.**

The entire database fixture lives inside ONE `BEGIN ... ROLLBACK` transaction;
Redis uses a unique stream/consumer group deleted in `finally`.

## 4. Scenarios A–H

### A — Full three-turn cognitive loop

`TURN 1` user information → foreground → ONE conversational provider call →
finalized response → durable background intelligence → Confidence → Information
Gap OPEN.
`TURN 2` same session → a formal Question is selected → the sanitized
`QuestionContext` travels inside the SAME single conversational call →
canonical finalization atomically BINDS the reservation.
`TURN 3` the user supplies the missing information through the **normal
production pipeline only**. Canonical Hypothesis intelligence advances a version
and the frozen migration-0063 synchronizer marks the prior gap `SUPERSEDED` with
closure reason `HYPOTHESIS_VERSION_ADVANCED`.

**There is no Question-specific answer detector, and Question Runtime never
resolves a gap directly.** The proof asserts the ACTUAL frozen transition; it
never changes production to manufacture a desired state.

### B — FAST / DEEP integrated parity

One representative FAST turn and one representative DEEP turn run through the
real integrated brain (the QIR-002 threshold matrix is not repeated). Both
preserve current-user and Safety authority, exactly one normalized request,
exactly one conversational provider call, context-budget correctness, Question
semantics, the background provider cap, and no stale/default/fabricated absent
values. Only the frozen processing path and projection differ.

### C — Foreground failure isolation matrix

- **C1** the canonical approved optional-source availability failure (a
  sanitized transport identity or a canonical 408/429/5xx status): only that
  source is omitted, unrelated eligible work continues, exactly one provider
  call, no default/stale/invented substitute. A canonical authority status is
  proven to stay a HARD failure, so the availability classifier is not
  broadened.
- **C2** budget expiry: an optional source settles after its frozen deadline.
  The deadline wins, the late result never mutates the final request, no second
  provider call happens, the finalized turn is not mutated, and nothing is
  carried into another turn.
- **C3** late rejection after deadline completion: no hidden retry, no second
  provider call, no late state mutation, no unhandled side effect.
- **C4** a malformed but SUCCESSFUL boundary result fails **closed before**
  conversational provider generation and is never reinterpreted as an
  availability failure.

Deterministic deferred gates replace every sleep: a settlement that must lose a
deadline is released only after the turn it raced has already finished.

### D — Authority conflict + global context pressure

An adversarial fixture puts the current user turn, older history, Memory, Human
Intelligence, Hypothesis/Recommendation and a Question in conflict. The proof
inspects the final normalized `ModelRouterRequest` and the rendered server
guidance — never model prose — and asserts: the current user turn is exact and
last, the integrated authority charter occurs exactly once, no source voting or
agreement authority exists, contextual sources never become instruction
authority, UNKNOWN/absent/omitted is never fabricated, and exactly one
normalized request reaches the router.

Under pressure the REAL assembler is driven with scaled versions of that real
request to prove the exact per-slice and final byte ceilings, no borrowing,
history continuity (whole newest exchanges only), the Memory ranked prefix,
atomic Human Intelligence, atomic Hypothesis+Recommendation, atomic Question,
fail-closed Mandatory Core, and that no second semantic trimming pass exists.

### E — Safety / fail-closed integration

- **E1 BLOCK**: no formal Question selection, zero conversational provider
  calls, only the frozen canonical block/finalization behaviour.
- **E2 GUIDED**: Safety remains hard authority, formal Question selection stays
  disabled, no `QuestionContext` leaks, exactly one conversational call.
- **E3 hard foreground authority/integrity failure**: zero conversational
  provider calls (shared with C1b/C4).
- **E4 background hard failure after foreground finalization**: the finalized
  response cannot be retroactively changed, deleted or regenerated, and cannot
  cause a second conversational call. The existing post-response
  failure/retry/quarantine authority is unchanged.

### F — Crash / reclaim / recovery

Two DIFFERENT delivery seams are proven here, and the verifier keeps them
strictly apart:

**F1 = duplicate delivery.** Its contract is at-least-once idempotency, so the
correct stimulus is a deliberate SECOND stream entry carrying the byte-identical
envelope. F1 proves that redelivery of a COMPLETED execution replays no
completed provider effect, RECONSTRUCTS the spent slots from the durable ledger,
does not reset the budget, and duplicates no domain mutation. This is the ONLY
place the verifier publishes a synthetic duplicate.

**F2 and F3 = real production Redis reclaim** of the ORIGINAL pending entry.
They never republish a copy. The original entry is already pending in the real
consumer group because the real `read()` delivered it and the crash left it
unACKed, and recovery re-enters through the frozen production seam:

```text
original Redis entry
  -> pending entry in the real consumer group
  -> stale pending ownership (abandoned consumer)
  -> RedisPostResponseConsumer.reclaim()
  -> XAUTOCLAIM
  -> the SAME original Redis entry/envelope
  -> PostResponseIntelligenceDispatcherService recovery
  -> provider slots/effects reconstructed with no replay
```

The frozen 30,000 ms stale-idle threshold is production-owned and unchanged.
The verifier never sleeps for it: it hands the already-pending entry to an
abandoned consumer and ages it past the threshold with a raw `XCLAIM ... IDLE`.
That is **verification-only Redis pending-entry setup** — it creates no stream
entry, publishes nothing, and mutates no QANDEEL durable database authority.
Each reclaim proves anti-vacuously that the entry really was pending, that the
stale-idle threshold really was satisfied, that reclaim returned the ORIGINAL
message id with a byte-identical envelope, that no new stream entry was created,
and that `XAUTOCLAIM` really transferred ownership to the production consumer.

- **F2** a pre-existing `CLAIMED` provider effect — produced by the canonical
  crash window between the durable claim and the typed completion — is
  RECLAIMED through the real seam and recovers through the existing
  `QUARANTINED / INDETERMINATE_EFFECT / EFFECT_RECOVERY` fail-safe with **zero
  new provider calls** and a slot that is never refunded.
- **F3** the canonical post-provider/persistence durable checkpoint is
  RECLAIMED through the same real seam, and the outstanding Confidence/Gap work
  completes without replaying Memory, Association, Intent, Candidate, or
  Hypothesis persistence/version advance.
- **F4** across original delivery plus reclaim/redelivery, each registered
  provider effect is spent at most once and the total stays at most three.

The pre-existing `verify:post-response-dispatch:integration` verifier proves raw
Redis `XAUTOCLAIM` directly; QIR-007 additionally proves the **production
`RedisPostResponseConsumer.reclaim()` method composed with durable dispatcher,
effect-ledger and provider-budget recovery**, which is the seam a defect could
otherwise hide in.

### G — Integrated Question isolation

- **G1 cross-session**: a session-A gap/reservation can never surface in
  session B (proven while the user-scoped Memory demonstrably does cross).
- **G2 outstanding bound invariant**: no more than the canonical allowed
  outstanding BOUND open formal Question reservation per session.
- **G3 budget omission + release**: an oversized provider-safe Question package
  is omitted ATOMICALLY by the real assembler (never partially retained), and an
  unconsumed `SELECTED` reservation is canonically `RELEASED` by the ONE
  database-owned terminal mechanism — no partial context and no stranded
  selection. Both halves are proven on real authorities: the frozen objectives
  are constant-sized and measurably fit the 8 KiB slice, so the omission branch
  is exercised adversarially at the assembler while the release is exercised on
  a real turn whose finalization carries no binding identity — byte-identical to
  the omission path's finalization call.
- **G4 stale binding progression**: a stale bound opportunity after a canonical
  Hypothesis/gap epoch advance does not permanently deadlock future legitimate
  Question selection.
- **G5 privacy**: the Question projection leaks no user/session/turn/Hypothesis/
  Confidence/Gap/binding ID, `Question provider calls = 0`, and a user turn
  alone never marks a gap RESOLVED.

### H — Privacy + hidden-work census

Deterministic verification-only counters prove, for the whole run:

```text
normal provider-generating turn   -> conversational provider calls == 1
hard-fail / BLOCK turn            -> conversational provider calls == 0
each background execution         -> each registered provider effect <= 1
each background execution         -> total provider effects <= 3
```

and that no architecture exists for a Question provider, a reconciliation LLM, a
fallback provider, provider racing, a hidden provider retry, or a fourth
background provider effect. A conversational provider failure is proven to
produce exactly one call. Representative telemetry is exercised and every
emitted dimension is scanned: no content, no user/session/turn/Hypothesis/
Confidence/Gap identifier, no UUID of any kind, and no dynamic provider/model
name may appear as a label.

## 5. Provider census

```text
ASSOCIATION_PROVIDER <= 1
INTENT_PROVIDER      <= 1
CANDIDATE_PROVIDER   <= 1
TOTAL                <= 3
```

The budget is per **durable execution lifecycle**, never per Redis delivery or
attempt: redelivery and reclaim RECONSTRUCT the spent slots from the durable
effect ledger through the same production function the dispatcher uses. There is
no `QUESTION_PROVIDER`.

Frozen foreground ceilings preserved and asserted from production:

```text
QHIA shared Human Intelligence wait:      300 ms
QIR-003 Memory + Hypothesis shared:      5000 ms
QIR-006 Question selection ceiling:       300 ms
```

Frozen integrated context budget preserved and asserted from production:

```text
Mandatory Core                  65536
History                         16384
Memory                           8192
Human Intelligence               8192
Hypothesis + Recommendation     24576
Question                         8192
TOTAL                          131072
```

## 6. Anti-vacuity

The dynamic verifier is the authority; the static test is only a drift guard.
Every scenario proves its own precondition before it asserts anything:

- the FAST fixtures are asserted FAST and the DEEP fixture DEEP by the REAL v2
  policy;
- the Memory-WRITE fixtures are asserted WRITE and the non-generation fixture
  `NO_TRIGGER` by the REAL classifiers;
- the Safety fixtures are asserted BLOCK / GUIDED / ALLOW by the REAL gate;
- the Question fixtures are asserted against a REAL eligible gap;
- the Question budget omission proves the package was genuinely OFFERED, and
  each frozen objective is measured as `INCLUDED_FULL` first;
- recovery proves the durable checkpoint existed before redelivery;
- the malformed-boundary test proves the malformed payload crossed the intended
  validator;
- every armed fault is asserted CONSUMED, so a fault that silently stopped
  firing fails the run instead of passing it.

## 7. Running it

```bash
npm run verify:integrated-brain:e2e-hardening-v2
```

It requires `DATABASE_URL` and `REDIS_URL`. The focused static drift guard runs
without any infrastructure:

```bash
node --test tests/integrated-brain-e2e-hardening-v2-contract.test.mjs
```

## 8. CI position

The existing gates stay intact and are **prerequisite regression gates**; this
verifier is appended after them, in this exact order:

1. `verify:a2-e2e-runtime-smoke` — A2 End-to-End Runtime Smoke
2. `verify:full-intelligence-e2e-runtime` — Full Intelligence End-to-End Runtime Smoke
3. `verify:integrated-brain:e2e-hardening-v2` — **Integrated Brain E2E Hardening v2**

The static contract runs in the static-contract portion of API CI, before the
database bootstrap.

## 9. STOP rule

If an approved adversarial scenario reveals an EXISTING PRODUCTION SEMANTIC
DEFECT, or cannot be proven without changing production semantics, the task
STOPS and reports:

```text
QIR-007 Production Blocker
```

with a deterministic reproduction, the exact affected files, the violated frozen
invariant, expected vs actual behaviour, whether the failure is deterministic or
timing-dependent, the smallest known semantic repair surface, and confirmation
that no silent production repair was made. **A production bug is never fixed
opportunistically inside QIR-007.**

## 10. Expected file scope

```text
apps/api/scripts/verify-integrated-brain-end-to-end-hardening-v2.ts
apps/api/scripts/integrated-brain-e2e-hardening-v2/**
tests/integrated-brain-e2e-hardening-v2-contract.test.mjs
docs/integrated-brain-e2e-hardening-v2.md
package.json
.github/workflows/api-ci.yml
```

Changes under `apps/api/src/**` and `database/migrations/**` are treated as
suspicious. **No production semantic changes were made by QIR-007.**
