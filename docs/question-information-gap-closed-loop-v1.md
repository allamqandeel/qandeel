# QANDEEL — Question / Information-Gap Closed Loop v1

**Status: ACTIVE / NORMATIVE**

**Phase:** QANDEEL — Integrated Intelligence Runtime & Hardening v1
**Task:** QIR-006 — Question / Information-Gap Closed Loop v1
**Canonical entry baseline:** commit `1f4413422e0781622b03b5b412ee6e81adad7a2e`, tree `125ae6522e7a67565679f9c27e1a4954462b66e0`, canonical-main CI run `33314624686` (success), migration baseline `0062_fast_deep_runtime_decision_policy_v2.sql`.
**Migration:** `database/migrations/0063_question_information_gap_closed_loop_v1.sql` — **migration 0063 is the new terminal migration of this contract's baseline.** A later, separately reviewed migration in any domain remains legal by number and by name: QIR-008 phase closure repaired this contract's static guard so it freezes only the durable historical fact that migration 0063 EXISTS and was the terminal migration of the CLOSED QIR v1 historical baseline.

Any change to a semantic frozen here requires its own versioned, separately
reviewed superseding contract.

## 1. Problem

Before QIR-006 the Question / Information-Gap loop was deliberately open:
durable automatic Information Gaps were materialized from exact durable
Confidence sources (migration 0038) but never consumed in foreground
conversation; `information_gaps.status` was effectively OPEN-only, so a stale
gap could linger forever; no durable binding tied a formal Question
opportunity to the assistant turn that actually carried it; and no canonical
closure rule existed once new user information changed Hypothesis/Confidence
state.

QIR-006 closes exactly those boundaries:

```text
Confidence
  → durable automatic Information Gap (OPEN)
  → one eligible same-session formal Question opportunity (SELECTED)
  → the existing ONE conversational provider call (QuestionContext included)
  → atomic finalization (BOUND)
  → normal user response → existing Memory/Evidence/Hypothesis/Confidence pipeline
  → canonical gap reconciliation (RESOLVED / SUPERSEDED / OPEN / reopen by epoch)
```

**QANDEEL may ask because canonical intelligence says one information need is
still open; it may stop asking only because canonical intelligence says that
need changed, resolved, or became obsolete — never merely because a user
happened to send another message.**

## 2. State machines

### 2.1 Durable Information Gap lifecycle (migration 0063)

```text
OPEN ──────────→ RESOLVED     (same exact current Hypothesis version; fresh
     │                         canonical evaluation no longer contains the code)
     └─────────→ SUPERSEDED   (current version moved away from the exact source
                               target, or the Hypothesis lifecycle left the
                               questioning-eligible set)
RESOLVED / SUPERSEDED ──→ OPEN  (the same canonical tuple became actionable
                                 again: same gap identity, open_epoch + 1,
                                 closure metadata cleared — exactly once per
                                 recurrence)
```

Closure metadata is exact: `closed_at` and `closure_reason`
(`MISSING_INFORMATION_CODE_ABSENT` for RESOLVED;
`HYPOTHESIS_VERSION_ADVANCED` or `HYPOTHESIS_LIFECYCLE_INELIGIBLE` for
SUPERSEDED) are present on exactly the closed states and null on OPEN.
`open_epoch >= 1` and moves only by +1 on a protected reopen. Every transition
is gated by the `information_gap_lifecycle_guard` trigger behind an internal
transition authorization; no role — service_role included — holds direct
UPDATE/DELETE on `information_gaps`. **A user turn by itself never resolves a
gap: no "next user turn = answered" heuristic exists anywhere.**

### 2.2 Formal Question binding lifecycle (`formal_question_turn_bindings`)

```text
SELECTED ──→ BOUND      (the sanitized QuestionContext actually survived final
                         provider-request assembly and finalization bound the
                         reservation to the completed assistant turn — same
                         transaction)
SELECTED ──→ RELEASED   (the reservation was never consumed by the finalized
                         assistant turn: budget omission, failure,
                         cancellation, expired-GENERATING recovery, or
                         finalization without consumption)
```

BOUND and RELEASED are terminal; nothing returns to SELECTED, RELEASED never
becomes BOUND, and DELETE is always rejected. The states are deliberately NOT
named `ASKED`/`ANSWERED`: SELECTED never proves the model rendered anything,
and no durable state ever claims the user answered. The row snapshots the
exact reserved target — gap identity, `gap_open_epoch`, the automatic source
tuple (hypothesis, exact version, missing-information code) and the
server-derived question type — and carries no question text, no transcript,
no provider payload, and no hidden reasoning.

## 3. Canonical closure authority

The migration-0038 synchronization authority is versioned to
`sync_post_response_information_gaps_v2`: the EXACT durable-source validation
and materialization semantics, extended with closed-loop reconciliation.
`sync_post_response_information_gaps_v1` becomes a pure delegating wrapper, so
exactly ONE process-level materialization/closure implementation exists and
the application entry point is unchanged.

Reconciliation consumes ONLY this execution's validated durable sources plus
the canonical current Hypothesis rows they name — never conversation text and
never an arbitrary latest-data scan:

```text
same exact current Hypothesis version + missing code still present  → OPEN (reuse)
same exact current Hypothesis version + missing code no longer
present in this execution's fresh canonical evaluation              → RESOLVED
Hypothesis version or eligible lifecycle moved away                 → SUPERSEDED
same tuple legitimately actionable again after closure              → OPEN, open_epoch + 1
```

Repeated synchronization of identical durable sources is a lifecycle no-op:
no duplicate gaps, no repeated epoch increments. Reconciliation and
materialization share one transaction and ONE globally sorted advisory-lock
set (per-hypothesis reconciliation keys plus the v1 per-tuple keys), so
cross-execution races serialize deadlock-free. Transport uncertainty can
fabricate nothing: a failed or quarantined synchronization writes no
lifecycle state.

### 3.1 Two authorities inside one update receipt

A durable `HYPOTHESIS_UPDATE_BATCH` / `UPDATES_APPLIED` receipt carries two
**different** authorities, and QIR-006 consumes them separately:

**(A) Reconciliation target authority — every schema-valid receipt.** A
receipt proves its Hypothesis was successfully mutated to `afterVersion` and
that the mutation COMMITTED. Migration 0034 deliberately keeps that mutation
committed even when the exact-version Confidence attempt then fails, recording
`confidenceStatus = PENDING_RETRY`. **Both `EVALUATED` and `PENDING_RETRY`
receipts therefore contribute their Hypothesis to the bounded reconciliation
target set**, so a committed version advance always reconciles its old
exact-version gaps. Consuming only `EVALUATED` receipts would leave a stale
gap OPEN forever and keep a stale formal Question outstanding.

Server-owned integrity is proven from canonical state before a receipt is used
as reconciliation authority: the Hypothesis must exist and be owned by the
execution owner, `afterVersion` must be a valid successful mutation version,
and canonical current state must not be BEHIND it (a later batch may have
advanced it further; it can never be older than a committed mutation). An
impossible, foreign, or malformed relationship fails closed with the bounded
`QUARANTINED` result. **No Confidence row is required**: a `PENDING_RETRY`
attempt failed by definition, so none is guaranteed to exist.

**(B) Fresh Confidence authority — `EVALUATED` receipts only.** Only an
`EVALUATED` receipt carries a successful exact-version evaluation. A
`PENDING_RETRY` receipt never enters the fresh source set, so it can never
fabricate a Confidence identity, **never authorizes RESOLVED, never authorizes
a reopen, and never states presence or absence of any missing-information
code**. Consequences:

- old gap whose exact target version is now behind canonical current →
  `SUPERSEDED` / `HYPOTHESIS_VERSION_ADVANCED` (epoch unchanged);
- gap already targeting the current `afterVersion` with no valid fresh
  exact-version Confidence → **no closure decision at all**: not resolved, not
  reopened, nothing fabricated. The answer stays UNKNOWN;
- no gap is ever materialized from a `PENDING_RETRY` receipt.

## 4. Foreground topology and the 300 ms ceiling

After Safety, on an ALLOW disposition only:

```text
Human Intelligence lane       ┐
QIR-003 Memory/Hypothesis     ├── launched independently/concurrently
QIR-006 Question Selection    ┘
```

Question selection never waits behind Memory, Hypothesis, or Human
Intelligence, and none of them waits behind Question selection. The joins are
sequential awaits of already-running promises — slower-of semantics, no new
barrier, no new orchestrator timer. **Safety GUIDED and BLOCK perform ZERO
formal Question selection**: no selection RPC, no reservation, no
QuestionContext.

`QUESTION_FOREGROUND_WAIT_BUDGET_MS = 300` is frozen in
`apps/api/src/question/question-foreground-selection.types.ts`. It is a
foreground wait ceiling only — not a database SLA, not a provider SLA, not a
whole-turn budget. On expiry the outcome is `FOREGROUND_BUDGET_EXPIRY`:
settlement handlers stay attached, the late result is discarded for this turn,
the assembled provider request is never mutated, no second provider call ever
happens, and nothing is cached into a later turn. The database reservation
semantics own orphan safety: every canonical terminalizer releases an
unconsumed SELECTED reservation in the same transaction that terminalizes the
source turn, so a late reservation cannot outlive its turn.

Typed outcomes are exactly `SELECTED`, `LEGITIMATE_EMPTY` (bounded reason
`NO_ELIGIBLE_GAP` or `OUTSTANDING_OPEN_QUESTION`),
`OPTIONAL_AVAILABILITY_FAILURE`, `FOREGROUND_BUDGET_EXPIRY`; a hard failure
rejects with its ORIGINAL error and fails the turn closed before provider
generation. Only a Nest `ServiceUnavailableException` or a canonical
service-role API status of 408, 429, or 500..599 may degrade; 400-class
integrity failures, 401, 403, malformed successful values, ownership
mismatches, impossible durable states, unknown enums and unexpected errors
all stay HARD. Classification is by constructor identity and numeric status —
never substring matching.

## 5. Selection eligibility and determinism

`select_formal_question_opportunity_v1(p_user_id, p_session_id,
p_source_turn_id)` is the ONE service-role-only atomic selection command. The
application supplies ONLY the caller identity triple; the database derives the
canonical target. A formal Question opportunity is eligible only when ALL
hold:

1. automatic Confidence-backed gap (structural: the binding FK references the
   migration-0038 source table, so a manual gap is unreservable);
2. gap status OPEN;
3. exact source target version equals the CURRENT Hypothesis version;
4. Hypothesis lifecycle in the canonical questioning-eligible set
   (`CANDIDATE`,`ACTIVE`,`SUPPORTED`,`MIXED`,`WEAK`,`REOPENED`);
5. Hypothesis scope exactly `CONVERSATION_SESSION:<current session UUID>` —
   **cross-session questioning is forbidden**, and session relevance is the
   canonical Hypothesis scope authority, never similarity, embeddings, or an
   LLM;
6. no outstanding formal Question for the session: neither a live BOUND
   reservation (see below), nor a live SELECTED reservation held by a
   concurrent turn;
7. the gap's current `open_epoch` not already reserved or consumed (a
   RELEASED reservation never blocks a later legitimate selection);
8. Safety disposition ALLOW (enforced at the orchestrator launch gate).

Ordering is deterministic and DB-owned: oldest eligible gap by the canonical
creation ordinal (`created_at`), stable UUID tie-break. No utility ranking, no
Expected Information Gain, no content heuristic, no source voting — all
explicitly deferred.

### 5.1 "Outstanding" is decided against canonical current state

A BOUND reservation blocks the session only while it is still **live**: its gap
is OPEN at its exact bound epoch AND the same authority dimensions selection
eligibility uses still hold — exact automatic source, current Hypothesis
version equal to the source target version, questioning-eligible lifecycle,
and same-session scope.

**This is defense in depth, not a second closure engine.** A gap row can
legitimately lag canonical reality: synchronization only reconciles the
Hypotheses one execution's durable receipts name, it can quarantine, and the
authenticated Hypothesis lifecycle commands (`transition_hypothesis_v2`,
`apply_hypothesis_evidence_update`) advance a version with no post-response
execution at all. Deciding "outstanding" from the gap row alone would let an
obviously stale bound question hold a session hostage indefinitely. The
outstanding check therefore reads current state to decide whether a bound
question is still live; it writes nothing, closes nothing, and closure remains
owned exclusively by the synchronization authority. No heuristic and no
content matching participate.

## 6. Concurrency and idempotency

- one reservation lifecycle per source turn, ever
  (`UNIQUE(source_turn_id)`); a legitimate same-turn retry returns the SAME
  SELECTED reservation;
- at most one non-RELEASED reservation per gap/open_epoch (partial unique
  index) — two concurrent selectors can never double-reserve one epoch, and a
  BOUND epoch can never be asked again;
- at most one live SELECTED reservation per session (partial unique index) —
  which, with eligibility rule 6, makes "at most one outstanding BOUND formal
  Question whose gap remains OPEN per session" structural;
- competing selectors serialize on a per-session advisory lock; the source
  turn row lock serializes selection against every canonical terminalizer, so
  a late selection against an already-terminal turn fails closed with zero
  durable writes;
- repeated finalization cannot double-bind (the turn row lock plus the
  SELECTED-only transition);
- release is idempotent by predicate and is owned by ONE database trigger on
  the canonical USER-turn GENERATING→terminal transition — never by
  application `finally` blocks.

## 7. Question budget allocation (QIR-004 supersession)

QIR-006 consumes the previously frozen QIR-004 8 KiB future reserve through
this reviewed versioned contract (QIR-004 Amendment A2):

```text
MANDATORY_CORE                65536
HISTORY                       16384
MEMORY                         8192
HUMAN_INTELLIGENCE             8192
HYPOTHESIS_RECOMMENDATION     24576
QUESTION                       8192
TOTAL                        131072
```

The global ceiling remains exactly `131072` UTF-8 bytes; no other slice moved
by a single byte; no borrowing. **Question is ATOMIC**: legal outcomes are
exactly `NOT_PRESENT`, `INCLUDED_FULL`, `OMITTED_BUDGET`, and
`PARTIALLY_RETAINED` is illegal for `QUESTION`. If the package cannot fit
wholly inside its slice it is omitted from the normalized request — never
truncated, never semantically altered — the binding identity is withheld from
finalization, and the same atomic finalization releases the unconsumed
reservation while the turn continues normally.

## 8. Provider-safe semantics

`QuestionContextV1` is the ONE provider-neutral optional context:

```text
contractVersion: 1
source: QANDEEL_QUESTION_ENGINE
questionType: FACT_FINDING | VALIDATION | DISCRIMINATING
answerFormat: FREE_TEXT
informationObjective: <fixed server-owned sentence>
```

It never carries an Information Gap id, Hypothesis id, Confidence evaluation
id, missing-information code, Hypothesis statement, Confidence score/band,
internal ranking, hidden reasoning, or any user/session/turn UUID. The
server-owned objective mapping is fixed:

- `NO_ELIGIBLE_EVIDENCE` → `FACT_FINDING` → ask for one concrete example,
  event, observation, or experience detail that could provide direct evidence
  relevant to the current topic;
- `UNVERIFIED_ASSUMPTIONS` → `VALIDATION` → ask the user to confirm, reject,
  or clarify one important unresolved assumption in the current topic;
- `COMPETING_HYPOTHESES_UNASSESSED` → `DISCRIMINATING` → ask for one detail
  that may help distinguish between plausible interpretations of the current
  situation.

The provider guidance block (rendered last, only when QuestionContext is
present) instructs the ONE conversational model to answer the user's current
request first; then, only if compatible with Safety and the user's current
instructions, phrase ONE concise natural follow-up question serving the
supplied objective; never expose internal terms; never present inference as
fact; never invent additional formal question needs; never demand an answer;
accept that the user may not know or may decline; and never request
credentials, secrets, or forbidden sensitive information. **The server chooses
the opportunity; the model only phrases it.** This rule concerns
QANDEEL-owned formal Questions only — it never forbids ordinary
conversational questions the model naturally asks when no QuestionContext is
supplied.

## 9. Finalization authority

`finalize_conversation_turn_v2` is the versioned current finalization
authority: the exact migration-0025 atomic semantics (assistant insertion +
source USER turn completion + outbox publication, identical
`ConversationTurnCompleted`/`2.0` event) extended with the binding step. With
`p_question_binding_id` present, the reservation must belong to the same
user/session/source turn, must still be SELECTED, and its gap/open_epoch must
still be the reserved canonical target — then BOUND commits atomically with
the rest; anything stale, foreign, duplicate, or impossible fails the whole
finalization closed. Without it, no reservation can be BOUND and the terminal
release trigger retires any SELECTED leftover in the same transaction.

The Conversation Orchestrator authorizes the binding by the FINAL NORMALIZED
REQUEST — `assembled.request.questionContext !== undefined` — exactly like the
QIR-004 Fix 01 `consumed` rule, never by the pre-budget selection outcome.

**The previous service-role finalization RPC is retired**: the pre-0063
`finalize_conversation_turn` signature is a writeless raising tombstone
(`RETIRED_CONVERSATION_FINALIZATION_AUTHORITY`) with EXECUTE revoked from
every application role, so it cannot remain an executable bypass around the
binding semantics. Historical migrations 0001–0062 are untouched.

## 10. Exactly one conversational provider call; QIR-005 exact

QIR-006 adds no Question provider, no `QUESTION_PROVIDER` effect, no fourth
background provider slot, no second conversational provider call, no
answer-detection heuristic, no keyword or embedding classifier, and no
LLM-based reconciliation. The QIR-005 registry remains exactly
`ASSOCIATION_PROVIDER`, `INTENT_PROVIDER`, `CANDIDATE_PROVIDER` with
`POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3`, and the QIR-003 gatherer remains
Memory + Hypothesis only.

## 11. Telemetry

`qandeel.question.foreground_selection` is bounded and fail-soft:

```text
outcome        = SELECTED | LEGITIMATE_EMPTY | OPTIONAL_AVAILABILITY_FAILURE
               | FOREGROUND_BUDGET_EXPIRY | HARD_FAILURE
processing_path = FAST | DEEP
policy_version  = "1"
empty_reason    = NO_ELIGIBLE_GAP | OUTSTANDING_OPEN_QUESTION
                  (attached ONLY to LEGITIMATE_EMPTY)
```

Never emitted: gap/hypothesis/confidence identifiers, missing-information
codes, question objectives, user content, database error strings, or
provider/model identity. The QIR-004 budget telemetry gains `QUESTION` as a
first-class source and byte component (17 legal source/outcome pairs).
Telemetry failures never alter runtime outcomes.

## 12. Security / ACL model

- `formal_question_turn_bindings`: RLS enabled, ZERO direct privileges for
  anon/authenticated/service_role; guarded protected transitions only;
- `information_gaps`: clients keep the 0007 owner-scoped SELECT; no role holds
  direct INSERT/UPDATE/DELETE mutation of lifecycle state; closure/reopen is
  reachable only through the internal transition authorization inside the
  synchronization authority;
- service_role receives ONLY narrowly-scoped EXECUTE on
  `select_formal_question_opportunity_v1`, `finalize_conversation_turn_v2`,
  and the synchronization entry points;
- authenticated callers cannot forge selection, binding, release, resolve,
  supersede, or reopen — every one of those verbs is either
  service-role-command-only or internal-authorization-only;
- no internal IDs or engine terminology enter provider-visible text; no
  transcript, provider payload, or hidden reasoning is persisted in the new
  durable state.

## 13. Failure semantics

Hard authority/integrity failure before provider generation fails the
foreground turn closed through the existing orchestrator failure path. An
optional availability failure or budget expiry omits QuestionContext and the
turn continues; the unconsumable durable reservation is released by the
canonical terminal mechanism. A malformed "successful" selection response is
`HARD_FAILURE` — never reinterpreted as empty, never fabricated into
omission.

## 14. Explicitly deferred

Final provider/model selection; Question utility ranking; Expected
Information Gain; provider-generated Question candidates; semantic/embedding
relevance; cross-session proactive questioning; multi-question batching;
voice; UI; notification/proactive Question scheduling; any "did the user
answer?" semantic classifier; long-term questionnaire strategy. The
QuestionCandidateGenerator foundation remains foundation-only; its single
QIR-006 compatibility change is that `generateValidated(...)` fails closed
when the referenced Information Gap is no longer OPEN.
