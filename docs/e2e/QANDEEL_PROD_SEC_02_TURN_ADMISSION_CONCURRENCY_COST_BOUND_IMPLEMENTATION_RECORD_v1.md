# QANDEEL — PROD-SEC-02 — Turn Admission Concurrency & Cost Bound — Implementation Record v1

**Status:** `PROD-SEC-02` — **IMPLEMENTED — DRAFT PR #299, AWAITING PRODUCT OWNER REVIEW** (not merged; not
`CLOSED / FROZEN`; `QAN-BL-PROD-01` stays `DEFERRED — OWNED` until the Product Owner accepts it)
**Baseline:** `main = fe9d9155f122725cb669e9989fa35ff12916112a` (unchanged at start and at hand-off)
**Branch:** `fix/prod-sec-02-turn-admission-cost-bound` — commits `bb924bb` (implementation), `702d59c` (CI round-1
correction + governance), and this record; the final head is stated in the PR.
**Evidence base:** `PROD-READINESS-01` review, Draft PR #298 at `03685fd`, finding `PR01-S02` (the only P0).
**Claude did not merge anything.**

---

## 1. Problem closed

One authenticated account could start unbounded concurrent and sustained foreground AI work:

- `create_user_conversation_turn` bounded nothing (any number of turns, in any number of sessions, at any rate);
- `claim_conversation_turn` only prevents two claimants of the SAME turn;
- each turn fans into several provider calls (reply, segmentation, focus, Thread continuity / establishment);
- `createTurn` had no overall deadline;
- a client could also bank `RECEIVED` turns through the RPC directly and later replay them all at once, or
  replay a completed-but-unestablished exchange many times in parallel.

## 2. Design in one paragraph

The **database** owns the bound, under one per-user transaction advisory lock, so it holds across every API
instance and against a client that calls the RPC directly:

- **admission** (`create_user_conversation_turn`, same signature, same ACL) refuses a NEW turn with `PT429` /
  `TURN_ADMISSION_LIMITED` (HTTP 429) when the session already has a turn in flight, the user already has two, or
  the user has used the rolling 10-minute or 24-hour allowance;
- **work** (service-role `begin_ / end_conversation_turn_work_v1`) grants one lease per exchange before any
  provider-bearing step: the generation claim, or the semantic walk of an exchange not yet established.

The **API** opens one foreground scope per `createTurn` request. It carries:

- a **deadline**, after which no NEW provider call starts;
- the **lease handle**, returned when the request ends.

Nothing races a timer against running work.

## 3. Admission invariants (migration `0131`)

| # | Invariant | Where |
|---|---|---|
| A | A session admits a new turn only when none of its turns is in flight | `create_user_conversation_turn` under the per-user lock |
| B | A user admits a new turn only while holding fewer than two in flight, across all sessions | same |
| C | At most 40 admissions per rolling 10 min and 600 per rolling 24 h per user | same; counted from canonical USER turns |
| D | One exchange is worked by at most one request at a time; a user's concurrent provider-bearing work obeys A/B | `begin_conversation_turn_work_v1` |
| E | Refusal = one typed `PT429 TURN_ADMISSION_LIMITED`, no detail / hint, nothing inserted | `RAISE ... USING ERRCODE='PT429'` |
| F | Replay of an already-admitted command (same session, user, key) is never limited and never charged | idempotency short-circuit before the bound → unchanged `23505` |
| G | Every pre-existing check keeps its order and error (`42501`, `55000`, `22023`) | body unchanged ahead of the lock |

**"In flight"** is one definition, used everywhere. A USER turn of the user counts if it:

- holds a live work lease; **or**
- is `GENERATING` with a live generation lease (0039's rule, including its `updated_at` fallback for legacy
  rows); **or**
- for admission only: is `RECEIVED` and was admitted within the frozen 120-second foreground lease.

## 4. Engineering limit values and why (not Product law)

| Value | Default | Why |
|---|---:|---|
| In flight per session | 1 | The TEXT conversation keeps one coherent head. The client already sends one turn at a time, and the Session Semantic Clock orders exchanges. |
| In flight per user | 2 | Room for a second device; opening more sessions buys nothing. |
| Admissions / 10 min | 40 | Each turn waits for its whole reply and semantic establishment before the next turn in its session. Conversational use stays far below one new turn per 15 s sustained for 10 min, burst included. |
| Admissions / 24 h | 600 | Hours of heavy daily use, while the sustained per-account ceiling is ~10× lower than the 10-minute window alone allows. |
| Foreground deadline | 90 s (`CONVERSATION_TURN_WORK_DEADLINE_MS`, clamped 30–90 s, malformed → default) | Must leave room inside the 120 s work lease for the last in-flight provider call (≤ 10 s) and the commits, so it cannot be raised past 90 s. |
| Work-lease length | 120 s | The existing frozen `foreground_generation_lease_interval_v1()`; no second duration constant. |

The four admission numbers live in one internal function, `conversation_turn_admission_policy_v1()`. They are
deliberately **not** runtime-configurable: the admission RPC is callable by every authenticated client, so the
ceiling must sit where that client cannot reach it. Changing them is a reviewed forward migration.

Fixture compatibility was checked: the largest historical-verifier footprint is 25 USER rows for one user, well
under 40.

## 5. Lock order and concurrency design

- Each of the three commands that decide the bound — admission, begin-work, and the internal lock helper they share —
  takes **exactly one** lock: `pg_advisory_xact_lock(hashtextextended('qandeel.conversation-turn-admission.v1:' ||
  user_id, 0))`. It is taken before any row is read or written.
- Nothing else in the schema takes this key, and no holder of a row lock waits for it, so no deadlock cycle can form.
- Different users hash to different keys and never serialize on one another (proven in §9).
- `end_conversation_turn_work_v1` takes no lock. It deletes only the exact `(turn, lease_id)` row, so a late return
  from a request whose lease already expired cannot release a newer holder's lease.
- In-memory state is **not** a bound. The API context holds only the per-request deadline and lease handle.

## 6. Stale-turn and crash recovery

| Situation | Outcome |
|---|---|
| Crash between admission and claim | The `RECEIVED` turn stops counting after 120 s. A later replay (same key) claims it under a lease. The turn is never deleted or rewritten. |
| Crash after claim | 0039 is unchanged: the generation lease expires, the replay terminalizes to `FAILED`, and the slot frees itself. |
| Crash while holding a work lease | The lease expires after 120 s. The next `begin` for that user clears expired rows. |
| Cancelled turn whose request is still working | Its lease still counts, so admit → cancel → admit cannot outrun running work. |
| Account erasure | Lease rows cascade with the turns (`ON DELETE CASCADE`). The 0130 erasure is not edited. |

## 7. Deadline and cost-bound behaviour

- `assertForegroundProviderBudget()` is checked immediately **before** a provider request opens:
  - in the two reply routers (`OpenAIModelRouter`, `ClaudeModelRouter`), outside the `try` that maps provider
    failures;
  - for the four semantic providers, at their binding seam (`guardForegroundBinding` in `ConversationModule`). Their
    classes stay byte-identical, as their frozen contracts require.
- A call already in flight keeps its own provider timeout. Nothing aborts or races it.
- **Reply phase.** A deadline reached before the reply call takes the existing canonical failure path (turn
  `FAILED`, 503). Nothing is fabricated.
- **Semantic phase.** The walk stops before its next provider call and maps to the typed
  `FOREGROUND_DEADLINE_EXHAUSTED` (503). The integrated commit never ran, the completed pair stays `COMPLETED`, and a
  replay re-enters establishment.
- **No provider-call counter was added.** Capping calls would truncate the canonical semantic walk (stop
  condition 5). Deadline + admission allowance + work lease close the P0; the fine-grained semantic call count is
  recorded under `QAN-BL-PROD-05` (`PROD-DATA-01`).

## 8. Refusal contract

| Situation | HTTP | Body | Mobile |
|---|---|---|---|
| New admission refused (nothing committed) | 429 | `{ "code": "TURN_ADMISSION_LIMITED" }` only | existing `REFUSED { status: 429 }`: words returned editable with the existing approved "not sent" line; no new copy |
| Committed turn whose generation work is deferred (lease `LIMITED`) | 503 | existing shape | existing `OUTCOME_UNKNOWN` reconcile / replay |
| Completed exchange whose semantic walk is deferred (`IN_PROGRESS` / `LIMITED`) or out of time | 503 | existing semantic-unavailable shape | existing reconcile; completed turns untouched |
| Replay of an admitted command | unchanged | unchanged | unchanged |

- `Retry-After` is omitted. No deterministic, non-disclosing value exists for the in-flight bounds.
- A 429 is answered only when the database committed nothing. A committed turn is never answered as "not
  admitted".

## 9. Verification (exact results)

| Gate | Result |
|---|---|
| `database/verify-migration-0131.mjs`, Focused DB gate, PostgreSQL 17, run `36837624994` | **success** |
| Re-anchored historical verifiers, Focused DB gate, serial runs `36837860250`, `36838037302`, `36838211072`, `36838404482`, `36838580662` (0025, 0030, 0039, 0062, 0064) | **all success** |
| `npm run verify:db:hazards` | **0 findings** |
| `npm run test:database` (static, local) | **1281 / 1281** |
| All 41 static `test:*` contracts that API CI runs (local) | **all pass** after the round-1 correction |
| API Jest, every touched directory (`conversation/`, `live-focus/`, `model-router/`, `conversation-unit/`, `conversational-focus/`, `thread-lifecycle/`, `thread-establishment/`), local | **63 suites, 1310 tests, all pass** |
| Mobile `conversation-turns.test.ts` (local) | **11 / 11** |
| Full API CI and Mobile CI on PR #299 | stated in the PR at hand-off |

**What `verify-migration-0131.mjs` proves** (the task's twelve points and more):

1. a normal admission;
2. the session bound;
3. the user bound across sessions;
4. independent users;
5. a deterministic `PT429` with no row, detail or hint;
6. capacity released by cancel, finalize and lease return;
7. stale `RECEIVED`, expired `GENERATING` and legacy null-lease rows never lock out;
8. a replay at the bound answers `23505` and charges nothing;
9. the RPC itself enforces the bound, and authenticated cannot call, read or write any lease authority;
10. anon and other-user authority do not widen;
11. leases cascade with turns;
12. committed races:
    - same-session: the second request **blocks** on the lock, then is refused;
    - same-user across sessions: likewise;
    - two users: they never block each other;
    - a 4-connection burst converges with no deadlock;
    - two concurrent `begin` calls for one exchange yield `GRANTED` + `IN_PROGRESS`.

**API and runtime tests:**

- the typed 429 mapping, and that nothing broader is misread as it;
- no orchestration, provider or semantic work after a refusal;
- the lease is taken before the claim and returned on success and on failure;
- `LIMITED` / `IN_PROGRESS` start nothing;
- poll replays never request a lease;
- the deadline refuses NEW calls while an in-flight call completes;
- the semantic phase is deferred with zero providers, zero context and zero commit;
- a completed reply is never failed by a later semantic deferral;
- the binding guard keeps the provider's own `this`;
- cancel and history behaviour unchanged (existing suites green).

## 10. Historical verifier re-anchoring

Five historical verifiers seeded turns through the real RPC inside one transaction (frozen `now()`). They left a
finished scenario's non-terminal turn in the same conversation head before admitting the next one. Each
re-anchored file carries one documented helper, `settleConversationHead`, which closes those finished fixture turns
through the owner's canonical `cancel_conversation_turn`, called only after their last assertion.

The five files are 0025, 0030, 0039, 0062 and 0064. No assertion changed, and all five pass on the Focused DB gate.

## 11. Explicitly out of scope (unchanged)

- General throttling, WAF, edge, `trust proxy` or IP limits (`PROD-SEC-01`).
- Auth verification (`PROD-AUTH-01`).
- `/health/ready` (`PROD-OPS-01`).
- Projection or list performance (`PROD-DATA-01`).
- Understanding and Memory behaviour.
- FAST/DEEP routing.
- Making the semantic phase async.
- Model or provider selection.
- Any no-hindsight or world-truth semantics.
- Any new user-facing copy.

## 12. Files changed

- **Database:**
  - `database/migrations/0131_turn_admission_concurrency_cost_bound_v1.sql` (new);
  - `database/verify-migration-0131.mjs` (new);
  - `database/verify-migration-{0025,0030,0039,0062,0064}.mjs` (fixture re-anchor).
- **API:**
  - `conversation/foreground-turn-work.ts` (new);
  - `conversation/conversation-turn-work.repository.ts` (new);
  - `conversation/conversation.service.ts`, `conversation-orchestrator.service.ts`, `conversation.module.ts`;
  - `live-focus/conversation-semantic-establishment.service.ts`, `conversation-semantic-runtime.types.ts`;
  - `model-router/providers/{openai,anthropic}/*-model-router.ts`;
  - specs: new `foreground-turn-work.spec.ts`; updated `conversation.service.spec.ts`,
    `conversation-history.spec.ts`, `conversation-memory-control.route.spec.ts`,
    `conversation-semantic-establishment.service.spec.ts`.
- **Mobile:** `runtime-entry/__tests__/conversation-turns.test.ts` (test only).
- **Static contracts:**
  - new `tests/prod-sec-02-turn-admission-cost-bound-contract.test.mjs`;
  - re-anchored `tests/conversation-focus-runtime-integration-readiness-contract.test.mjs`,
    `tests/effective-live-focus-final-semantic-chain-cutover-contract.test.mjs` and
    `tests/session-semantic-clock-sp-lh-delivery-contract.test.mjs`. Each now accepts exactly the guarded lazy
    factory, or the one new typed-refusal reader, with a note.
- **CI and registry:** `package.json` (two scripts), `.github/workflows/api-ci.yml` (two steps).
- **Governance:** `docs/qandeel-canonical-backlog-v1.md` (`QAN-BL-PROD-01..05`, counts); this record.

## 13. Skills Used

| Skill | Inspected | Used | Why |
|---|---|---|---|
| `security-review` | yes | **attempted, could not run** | It starts by running `git status` through Bash, and Bash is non-functional on this host (Windows Application Control). The security pass was instead done manually against the task's §11 planted-defect list (§14). |
| `code-review` (high) | yes | **yes** | Ran on the final-round diff and reported seven findings. Outcomes are in §15. Finding 3 (per-provider guard list) led directly to the binding-seam design. |
| others (UI, motion, mobile and design skills) | yes | no | Not applicable to a database and API security corrective. |

## 14. Security review against the planted-defect list (§11 of the task)

| Bad fix | Present? | Evidence |
|---|---|---|
| in-memory-only semaphore | no | the bound is in SQL; the API context holds only a deadline and lease handle |
| check-then-insert race | no | decide + insert under one per-user xact lock; committed race test **blocks** the second admission |
| per-session-only limit | no | the user bound across sessions is enforced and tested |
| per-user-only limit (no session coherence) | no | the session bound is 1, enforced and tested |
| limit only in Nest | no | the bound is in the authenticated RPC itself; the verifier calls it directly |
| replay charged twice | no | the idempotency short-circuit precedes the bound; `23505` at the bound, no new row |
| counters another user can influence | no | counts are scoped to `auth.uid()`; independent-user tests pass |
| client-supplied quota fields | no | no parameter, header, setting or JWT field selects a limit (static contract) |
| `Promise.race` timeout while work continues | no | the guard refuses before a call starts; no timer in the scope (static contract) |
| generic catch turning refusal into 500 | no | exact `PT429` + message → typed 429; others untouched (tests) |
| `trust proxy` / IP throttling smuggled in | no | none in the diff |
| semantic truncation presented as truth | no | the deadline yields typed `FOREGROUND_DEADLINE_EXHAUSTED`; nothing is committed |
| deleting old turns to free a slot | no | no `DELETE` / `UPDATE` of `conversation_turns` in 0131 (static contract) |
| permanent lockout after crash | no | every in-flight clause expires (§6) |
| global DB lock | no | lock key per user; cross-user race does not block |
| weakened grants / RLS / ownership | no | ACL matrix asserted; the admission keeps authenticated-only EXECUTE; leases have no client grant and RLS on |

## 15. Residual issues (honest)

1. **The PostgREST `PT429` → HTTP 429 mapping is documented primary behaviour, but no CI job runs PostgREST.** The
   verifier proves the SQLSTATE and the API proves the mapping from a 429 + `PT429` identity. If a hosted gateway
   rewrote the status, the refusal would surface as a 500. Proposed: one live check against the CI Supabase project
   when deployment validation runs.
2. **The deadline governs provider calls, not every database call after it.** The 90 s ceiling leaves a 30 s margin
   inside the 120 s lease. An extremely slow Data API could in theory exceed it, briefly letting a second lease be
   granted. Bounded, and recorded for `PROD-DATA-01` measurement.
3. **A semantic walk that always needs more than the deadline cannot complete** (very large Thread counts). It is
   retryable and commits nothing, and is recorded in `QAN-BL-PROD-05` for measurement.
4. **Two extra service-role round trips per new turn** (lease begin and return). Accepted for clarity; folding the
   grant into the claim command would change a frozen signature.
5. **After a crash, a session can answer "busy" for up to 120 s.** This is by design (§6).
6. **`settleConversationHead` is repeated in five historical verifiers**, which are self-contained by repository
   convention.

For the other correctives:

- `PROD-SEC-01` still owns IP / edge limits and `trust proxy` (`QAN-BL-PROD-02`).
- `PROD-OPS-01` owns the readiness probe (`QAN-BL-PROD-03`).
- `PROD-AUTH-01` owns the auth hop (`QAN-BL-PROD-04`).
- `PROD-DATA-01` owns the list and fan-out items plus the measurements above (`QAN-BL-PROD-05`).

## 16. Merge statement

Claude created a Draft PR and **did not merge, enable auto-merge, or modify PR #298**. Merge authority is the
Product Owner's alone.
