# PROD-RETRY-01 — Data API 40001 Retry Hazard Closure: Implementation Record (C2)

**Status:** `CLOSED / READY FOR PO MERGE DECISION — NOT MERGED / NOT DEPLOYED`. The Product Owner's technical review
passed (2026-10-10, "TECHNICAL REVIEW PASSED — AUTHORIZE DOCUMENTATION CLOSURE ONLY") at the exact reviewed head
`3a780baf0069e3464511e7bd6312d59006a11ac1` of `prod/prod-retry-01-stale-state-pt409` (PR #324). That branch starts from `main` at
`e07857bab47f500a035e265b0eefc4b0bb65bd34`. The closing change on top of it is documentation only (§10).
- Merging needs the Product Owner's explicit decision.
- Deploying needs its own approval and stays gated by `QAN-BL-PROD-06` (§8, §10.4).
- The repository fix being complete is **not** the hosted hazard being closed.

*(At C2: `IMPLEMENTED — READY FOR REVIEW`; the exact-head API CI was pending.)*

**Backlog:** inherits `QAN-BL-PROD-06` (`HIGH`, launch / deployment gate). At closure it is re-owned, not tombstoned, to
`HOSTED-DEPLOY-01` (§10.4). Admits `QAN-BL-PROD-07` (`LOW`).

**Design:** [C1 design, coverage and safety contract](QANDEEL_PROD_RETRY_01_C1_DESIGN_v1.md), accepted by the Product
Owner with corrections (2026-10-10). C2 was authorized under that contract.

**Migration:** `database/migrations/0150_data_api_stale_state_non_retryable_sqlstate_v1.sql`.

This record states what changed, why, what was deliberately not changed, and how it was verified. It contains no
secret, credential, user row or hosted project identifier.

---

## 1. The hazard, in one paragraph

PostgREST before v16.0 runs every request through `hasql-transaction`. That library re-runs the WHOLE transaction,
without bound, when it fails with SQLSTATE `40001`; from `hasql-transaction` 1.1 it does the same for `40P01`. PostgREST
#3673 removed this in v16.0.

Twelve QANDEEL function bodies answered a caller's stale expectation with a **deterministic** `40001`. The expectation is
a version, an epoch, a clock token or an expected current id that the caller itself sends, so a re-run sends the same
argument against the same committed state. Through such a PostgREST the request is never answered, it holds a pool
connection, and the API's designed stale-state handling never runs.

On v16+ the same refusal is answered as HTTP 500 `{code 40001}`. The API reaches every function through the Data API
(`rest/v1/rpc/...`), and any signed-in account can call the authenticated entry points directly.

## 2. What changed

### 2.1 Migration 0150 (forward-only, one transaction)

- **Eleven raising bodies.** Every `ERRCODE='40001'` becomes `ERRCODE='PT409'`, 23 sites in all, and nothing else in
  them changes.
- **One catcher.** The Hypothesis batch handler also accepts `PT409`.

| Function | Defined in | Sites | Message |
|---|---|---|---|
| `transition_hypothesis_core_v1` | 0036 | 2 | `Stale hypothesis version.` |
| `apply_hypothesis_evidence_update_core_v1` | 0032 | 2 | `Stale hypothesis version.` |
| `commit_finalized_exchange_with_full_semantic_chain_v1` | 0071 | 2 | `STALE_CONVERSATIONAL_FOCUS_CONTEXT`, `STALE_THREAD_IDENTITY_CONTEXT` (with DETAIL) |
| `get_conversation_thread_identity_dossier_page_v1` | 0070 | 1 | `STALE_THREAD_IDENTITY_CONTEXT` (with DETAIL) |
| `grant_shared_world_standing_context_v1` | 0078 | 2 | `STANDING_CONTEXT_STALE_STATE` |
| `revoke_shared_world_standing_context_v1` | 0078 | 2 | `STANDING_CONTEXT_STALE_STATE` |
| `rotate_shared_world_invite_credential_v1` (behind `rotate_own_sealed_shared_id_v1`) | 0081 | 4 | `SHARED_INVITE_CREDENTIAL_STALE_STATE` |
| `pause_matching_participation_v1` | 0109 | 2 | `MATCHING_STALE_STATE` |
| `turn_off_matching_participation_v1` | 0109 | 2 | `MATCHING_STALE_STATE` |
| `revoke_matching_context_v1` | 0109 | 2 | `MATCHING_STALE_STATE` |
| `revoke_pre_match_disclosure_authority_v1` | 0109 | 2 | `MATCHING_STALE_STATE` |
| `execute_post_response_hypothesis_update_batch_v1_core` (catcher) | 0034 (renamed 0072) | handler | `WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' OR SQLSTATE '22023'` |

Each `CREATE OR REPLACE` is its defining migration's statement **verbatim**. The only edits are the rename 0072 made
and the approved token. The migration proves itself in one transaction:

1. It snapshots every application function (`public` and `*_private`), body and full posture.
2. It refuses to run unless each target holds exactly its expected sites and no `PT409`. A drifted body anywhere,
   hosted included, aborts it.
3. It creates the twelve.
4. It requires, from the catalog, that:
   - every new body is the old body with exactly the substitution;
   - oid, owner, ACL, `SECURITY DEFINER` / `INVOKER`, `search_path`, signature, defaults, result type and comment are
     unchanged;
   - no other application function changed, appeared or disappeared.

### 2.2 API (exact identity, both codes)

| Seam | Before | After |
|---|---|---|
| `isStaleConversationalFocusContext` (`conversational-focus/conversation-focus-runtime.repository.ts`) | code `=== '40001'` and exact message | `isStaleContextSqlstate(code)` (`PT409` or `40001`, by equality) and the exact message |
| `isStaleThreadIdentityContext` (`thread-lifecycle/conversation-thread-lifecycle-runtime.repository.ts`) | same | the same single code rule, reused |
| Shared ID lost-race test (`shared-world/shared-world.service.ts`) | any code `40001` | code `PT409` or `40001` **and** message `SHARED_INVITE_CREDENTIAL_STALE_STATE` (equivalent on today's database: the only `40001` on that path) |

Doc comments that stated the code were updated, and so were the specs:
- `PT409` cases were added beside every `40001` case, which is kept.
- A status-only 409, a `23505`-409 and every other `PT409` message are proven NOT to be the stale condition.

## 3. What deliberately did not change

- Compare-and-swap predicates, lock order, idempotent replay and every message, DETAIL and HINT.
- Owners, grants, RLS, `SECURITY DEFINER`, `search_path`, signatures and user data. 0150 writes no row.
- **0149's Matching narrowing** (privileges only; 0150 changes none). The six suspended commands keep raising `40001`
  and are executable by no application role (`QAN-BL-MATCH-01`).
- **Paths kept on `40001`, each proven safe (§4):**
  - **Race-converging:** `start_own_public_experience_draft_v1` and `post_own_public_discussion_v1`, through
    `ensure_public_identity_v1`'s first-creation race. Today a PostgREST re-run resolves it to `ALREADY_PRESENT`;
    converting it would turn a correct silent success into a client-visible conflict.
  - **Replay-guarded:** the `commit_own_public_experience_ready_v1` replay branch.
  - **Absorbed:** the five Shared World wrappers, `approve_own_public_package_v1` and the main path of
    `commit_own_public_experience_ready_v1`, which return `STALE` / `UNAVAILABLE`.
  - **Unreachable:** every raiser no application role can reach (I-07B..D cores, Replay, the 0066–0068 coordinators,
    the Shared World cores).
- **Guarded paths, which now reach `PT409` and still cannot fire:** `record_understanding_disagreement_v1` locks and
  pre-checks the version itself, and `persist_post_response_hypothesis_generation_v1` activates only rows created in the
  same transaction.
- **`40P01` is never raised and never converted.** A genuine deadlock is correctly retried; the residual after v16 is
  `QAN-BL-PROD-07`.
- **The API's own answers to its clients.**
  - Hypothesis refusals reach no API route: `HypothesisService.transition` and `HypothesisUpdateService.apply` have no
    production caller, and `applyAuthorizedHypothesisUpdate` has none either.
  - Standing Context and Matching have no API caller.
  - The conversation and Shared ID seams recognise both codes.

## 4. The guard: why the paths left on 40001 are safe

`database/data-api-retry-hazard-guard.mjs` is an analysis of the live catalog, not a name list.

**What it reads:**
- It lexes every PL/pgSQL and SQL function in every non-system schema, keeping literals and dropping comments.
- It parses the `BEGIN … EXCEPTION … END` blocks, `CASE` frames and handler clauses.
- It follows schema-qualified calls, bare `public` calls and trigger-firing writes.

**How it judges a site:**
- It treats a handler as absorbing only if its first matching clause does not re-raise.
- A re-raise guarded by `classify_public_refusal_v1(SQLERRM)` absorbs exactly the messages that function classifies,
  and the guard evaluates it **live**.

**What it flags as findings:**
- a handler that catches `40001` by name above a `PT409` raise without also catching `PT409` (`CATCH_TRAP`);
- dynamic `ERRCODE`;
- dynamic SQL;
- any isolation level above `READ COMMITTED`.

`verify-migration-0150.mjs` uses it to prove, on the CI-shaped and the hosted-shaped databases:

- **The twelve.** They let no `40001` / `40P01` escape, and do let exactly their stale refusal escape as `PT409`.
- **Exactly three entry points still let a `40001` escape**, each with its single raise. Each is discharged by a proof:
  - **`RACE_CONVERGING`** (`start_own_public_experience_draft_v1`, `post_own_public_discussion_v1`):
    - *Structurally:* the only `40001` in `ensure_public_identity_v1` answers a `unique_violation` on
      `public_identities_user_key` alone. It sits behind a locked per-user lookup whose `IF FOUND … RETURN` answers any
      re-run.
    - *Live:* two connections race a first identity. The loser gets `40001`. Its identical re-run, which is what
      PostgREST < v16 does, answers `ALREADY_PRESENT` after one re-run.
  - **`REPLAY_GUARDED`** (`commit_own_public_experience_ready_v1`):
    - *Structurally:* the one unprotected call to `commit_public_experience_ready_for_review_v1` is the
      `IF EXISTS (… review_ready_commands … c.id = p_command_id) THEN` branch, and it passes that same command id. The
      core answers a committed command (`ALREADY_COMMITTED` or `23505`) before any stale comparison. No function deletes a
      committed command.
    - *Live:* with the core's stale comparison made true, a NEW command gets `40001` and the committed command gets
      `ALREADY_COMMITTED`.
- **Exactly six entry points absorb** every `40001` they reach, each naming its handler.
- **The one finding is discharged.** `DYNAMIC_SQL` in `historical_event_identity_conflict_v1` is one read-only `SELECT` of
  an ordinary table named by a literal at every call site.
- **The checks bite.** Nothing raises `40P01`. Five weakenings are each refused (`g1`–`g5`):
  - a deterministic body restored to `40001`;
  - the batch catcher restored to `40001`-only (`CATCH_TRAP`);
  - a new client wrapper around a `40001` raiser;
  - a handler that re-raises;
  - a raised isolation level.

## 5. HTTP status: the correction, and the consumer audit

| PostgREST line | Before 0150 (deterministic `40001`) | After 0150 (`PT409`) |
|---|---|---|
| v12.2.9, v13.0.8, v14.18 | no answer: the transaction is re-run without bound | HTTP 409 `{code: PT409, message, details, hint: null}` |
| v16.4 | HTTP 500 `{code: 40001, …}` | HTTP 409 `{code: PT409, …}` |

Every direct Data API caller therefore sees 409 instead of 500, or instead of no answer. **API consumer audit** of the
twelve entry points:

| Entry point | API caller | Handling | Change |
|---|---|---|---|
| `commit_finalized_exchange_with_full_semantic_chain_v1`, `get_conversation_thread_identity_dossier_page_v1` | `live-focus/conversation-semantic-runtime.repository.ts`, `thread-lifecycle/…runtime.repository.ts` | exact (code, message) → typed stale error → ONE bounded semantic retry | both codes accepted. Before v16 the bounded retry now actually runs. |
| `rotate_own_sealed_shared_id_v1` | `shared-world/shared-world.service.ts` | lost race → read the winner back | both codes plus the exact message |
| `transition_hypothesis_v2`, `apply_hypothesis_evidence_update`, `background_apply_hypothesis_evidence_update_v1` | repositories only. No API route or production caller reaches them; `applyAuthorizedHypothesisUpdate` has no caller. | the error propagates unchanged | none. A non-HTTP error is HTTP 500 at the API edge either way. |
| Standing Context ×2, Matching ×4 | none (direct Data API only) | — | — |

No status-based branch (`error.status === 409 / 500`) lies on any of these paths.
- The three existing 409 branches (`createTurn`, the Shared conversation guard, `changeLoginId`) belong to other RPCs.
- `classifyOperationalFailure` is not reached by these RPCs.

## 6. Verification

**Local** (disposable PostgreSQL 17 on this host, never a hosted or `.env` database):

| Check | Result |
|---|---|
| 0150 applied on the CI-shaped and hosted-shaped databases; its self-check passed | pass on both |
| `verify-migration-0150.mjs` (28 scenarios) | 28 / 28 on both shapes |
| `verify-migration-0150.mjs` anti-vacuity (run on the pre-0150 database) | 13 / 28 fail, exactly the 0150-specific claims |
| Re-anchored verifiers: 0027, 0028, 0032, 0036, 0070, 0071, 0078, 0081, 0109, 0138, 0149 | pass |
| Batch regression `verify-migration-0034.mjs` (stale command → `UPDATES_REJECTED`, all-or-nothing) and 0038 | pass, unchanged |
| Other verifiers that call a changed function: 0008, 0072, 0082–0090, 0112, 0114, 0116, 0126, 0127, 0134, 0139–0141, 0148 | pass, unchanged |
| `verify-migration-0130.mjs` | fails identically on the pre-0150 database: a known Windows clock-skew flake (`days<=7`) |
| `node --test database/tests/*.test.mjs` (live tests against the migrated database) | pass, after one re-anchor |
| `node --test tests/*.test.mjs` (static contracts, forward-safety mirror included) | pass, after the re-anchors below |
| `tests/prod-retry-01-data-api-stale-state-contract.test.mjs` | 9 / 9 |
| API jest, the affected modules (conversational-focus, thread-lifecycle, live-focus, thread-establishment, shared-world, error identity, hypothesis service) | 604 / 604 |
| `tsc --noEmit` (API) | pass |
| `npm run verify:db:hazards` | 0 findings |
| Wire proof dry run against a local PostgREST stand-in (proves the script's own logic only) | pass on both line types |

**CI** (one exact-head run of API CI): the whole gate, plus:
- the 0150 verifier;
- the static contract;
- `prove-0150-stale-refusal-postgrest.mjs` on v12.2.9, v13.0.8, v14.18 and v16.4.

The wire proof bounds every request by 10 s, and an unanswered request FAILS rather than hangs. It counts executions
with a non-transactional sequence:
- `PT409` runs exactly once on every line;
- on v16.4 only, `40001` is HTTP 500 after exactly one run. It is never sent before v16.

An EXIT trap stops every engine container whatever happens.

`verify-migration-0133.mjs` replays 0150 under hosted defaults through `psql`, which this host lacks: CI-only
confirmation. **Nothing was run against a hosted environment.** The exact-head CI results are in §10.2.

**Re-anchored, only where a check asserted a changed function's stale code or its pinned text:**
- **Verifiers:** 0027, 0028, 0032, 0036, 0070, 0071, 0078, 0081, 0109, 0138 and 0149 (`BODIES_UNCHANGED`: the four
  retained commands carry exactly the 0150 substitution).
- **0036:** its own re-application of 0036 inside a rolled-back savepoint keeps `40001`.
- **Static contracts:**
  - `database/tests/shared-standing-context-consent-commands-v1.test.mjs` (pinned verifier text);
  - `tests/conversation-focus-runtime-integration-readiness-contract.test.mjs` and
    `tests/thread-lifecycle-cross-session-continuity-contract.test.mjs` (pinned recogniser text, still equality-only);
  - `tests/thread-establishment-evaluator-contract.test.mjs` and `tests/canonical-home-placement-engine-contract.test.mjs`:
    0150 is exempt for its two VERBATIM re-creations of the 0070 / 0071 bodies alone, each checked byte for byte against
    its defining statement, following the W3-MEGA-S 0130 precedent.

## 7. Governance

- **`QAN-BL-PROD-06`.**
  - Scope amended (C0 / C1 / C2): the Shared ID rotation is added; the generation entry is guarded; the batch absorbs,
    and its catcher is on the change path.
  - Repository resolution recorded. *(At C2:)* it stays `DEFERRED — OWNED` until the closing change at the Product
    Owner's merge decision (BG-08). The closing change re-owned it instead of tombstoning it (§10.4).
  - The hosted condition is recorded as the 0150 deployment rule in `database/README.md`.
- **`QAN-BL-PROD-07`** admitted after anti-duplication: `LOW`, `DEFERRED — OWNED`, owner `PROD-RETRY-02 — Post-v16
  Data API Retry Semantics`. It covers the post-v16 behavior of the race-converging `40001` paths and genuine
  deadlocks. It does not block launch.
- **Controlled Forward Amendments**, append-only:
  - `docs/hypothesis-lifecycle-completion-v1.md`;
  - `docs/effective-live-focus-final-semantic-chain-cutover-v1.md`;
  - `docs/thread-lifecycle-cross-session-continuity-v1.md`;
  - `docs/conversation-focus-runtime-integration-readiness-v1.md`;
  - `docs/thread-runtime-integration-readiness-v1.md`;
  - `docs/matching-introduction-runtime-v1.md` §48;
  - `database/README.md` (0078, 0081 and 0109 pointers, and the 0150 section).
- **`QANDEEL_CURRENT_STATE.md`.**
  - The SEC-MATCH-00 rows now record its merge through PR #323 as `e07857b`. The closure state it merged in is kept
    as history, not erased.
  - A PROD-RETRY-01 row and the register are added.

## 8. Deployment and rollback

- **Order.** Deploy the API that accepts both codes first, or together with 0150. A database at 0150 with an older API
  never hangs; it only degrades the conversation stale recovery to a generic failure.
- **Hosted.** 0150 re-creates 0078 / 0081 / 0109 functions, so a hosted project behind 0149 receives it only in its
  catch-up, in the same controlled window as 0149. It must arrive no later than any exposure of 0078 / 0081 / 0109.
  - The hosted PostgREST version is **NOT VERIFIED**. The Product Owner reads it on the Dashboard (Project Settings →
    General, service versions).
  - Until the hosted database is at 0150, or its PostgREST is verified at v16+, `QAN-BL-PROD-06`'s reopen conditions
    bind unchanged.
  - Never reproduce the hazard on a hosted environment.
- **Rollback.**
  - The API can be rolled back at any time.
  - The database is forward-only. Reverting 0150 would reintroduce the hazard, so the plan is fix-forward.
  - A failed apply leaves the database untouched, because it is one transaction and the self-check aborts.

## 9. Residual risk

- **Hosted exposure.** The five hosted entry points already present at 0074 (Hypothesis ×3, the dossier, the FINAL
  commit) stay exposed on any PostgREST < v16 until the catch-up ships 0150. Whether the hosted API serves real users is
  unknown.
- **Mixed codes for one message family.** For example, `MATCHING_STALE_STATE` is `PT409` in the four retained commands
  and `40001` in the unreachable I-07B..D cores. The guard forces conversion the moment any of those becomes reachable.
- **v16 removes the server re-run** that today resolves the race-converging paths and genuine deadlocks
  (`QAN-BL-PROD-07`).

## 10. Closure (2026-10-10) — CLOSED / READY FOR PO MERGE DECISION, NOT MERGED, NOT DEPLOYED

The Product Owner's decision was "TECHNICAL REVIEW PASSED — AUTHORIZE DOCUMENTATION CLOSURE ONLY". This closing change
touches documentation alone. It changes no SQL, no migration (`0150` included), no API or mobile code, no test and no
workflow. Nothing was merged or deployed, and no hosted environment was contacted.

### 10.1 Exact reviewed head

`3a780baf0069e3464511e7bd6312d59006a11ac1` on `prod/prod-retry-01-stale-state-pt409` (PR #324). The branch starts from
`main` at `e07857bab47f500a035e265b0eefc4b0bb65bd34`. Its four commits are `347a4f8` (migration, guard, verifier, wire
proof, contract, CI), `7a7c4be` (API), `dd1a508` (re-anchors) and `3a780ba` (documentation).

### 10.2 Final results on that head

| Gate | Run | Result |
|---|---|---|
| API CI (whole gate) | `38019937801` | **success** |
| Mobile CI | `38019937819` | **success**. VAL-01 found no mobile path changed: the fast mobile contract gate ran and passed, and the build and device jobs were skipped by plan |
| `verify-migration-0150.mjs` | in API CI | **28 / 28 PASS**: bodies, posture, census, self-check p0–p6, guard with g1–g5, stale / no-write, Shared ID races, race-converging and replay-guarded |
| Live PostgREST `v12.2.9` | in API CI | **PASS**: every deterministic stale refusal is HTTP 409 `{code PT409}` with the frozen message and DETAIL, nothing written, `PT409` executed exactly once |
| Live PostgREST `v13.0.8` | in API CI | **PASS**, same as `v12.2.9` |
| Live PostgREST `v14.18` | in API CI | **PASS**, same as `v12.2.9` |
| Live PostgREST `v16.4` | in API CI | **PASS**, same as `v12.2.9`; in addition, `40001` is HTTP 500 after exactly one execution |
| SEC-MATCH-00, PROD-SEC-02 and PROD-OPS-01 live PostgREST proofs | in API CI, on all four lines | **PASS** |
| `verify-migration-0133.mjs` (hosted-default replay through `psql`; CI-only) | in API CI | **PASS** |
| `verify-migration-0130.mjs` (a known Windows clock-skew flake locally) | in API CI | **PASS** |
| `test:forward-safety-contract` (flaked locally only under a parallel `node --test`) | in API CI | **35 / 35** |

Nothing above was re-run for this closing change. Proportional validation of the closing change itself is in §10.6.

### 10.3 What was found and closed during C1 / C2

- **PT409 → 409 against 40001 → 500 (the Product Owner's C1 correction).**
  - Documented in §5.
  - No consumer branches on HTTP status, and messages are unchanged.
  - The Data API behavior is proven on the wire on all four lines.
- **The Shared ID rotation**, found in C0. It is covered by `0150`, its API recogniser and the `SHARED_ID_RACES` proofs.
- **The Hypothesis batch catch-trap.** Option S extends the one catcher.
  - `UPDATES_REJECTED` is proven unchanged by `verify-migration-0034`.
  - Guard probe g2 refuses a regression.
- **C1's classification of `commit_own_public_experience_ready_v1`** as absorbed was corrected to replay-guarded. Its
  replay branch calls the core outside its handler, but the core answers a committed command first. This is proven
  structurally and live (`REPLAY_GUARDED`), and no further function needed a change.
- **`persist_post_response_hypothesis_generation_v1`** is guarded: it touches only rows created in the same transaction.
- **The Thread and Home contracts** ban thread tokens in later migrations. `0150` has a narrow exemption for its two
  verbatim re-creations alone, each checked byte for byte, following the `0130` precedent.
- **`verify-migration-0036`** re-applies `0036` inside a rolled-back savepoint, so it keeps `40001` there.
- **Wire-proof teardown** hit the canonical historical-row guards. It now removes its fixtures in one replica-role
  transaction and asserts that no residue remains.
- **Governance:**
  - the SEC-MATCH-00 merge state was reconciled in Current State in C2;
  - the backlog §7 and Current State §5 count tables, which C2 had not moved for `QAN-BL-PROD-07`, are corrected in this
    closing change.

### 10.4 BG-08: repository closure against hosted closure

**A. Repository implementation: complete.**
- `0150` is implemented.
- The API accepts `PT409` and `40001`, by equality with the exact message.
- Every required gate passed on the exact head (§10.2).
- The fix is ready for the Product Owner's merge decision.

**B. Hosted deployment: not done, and the hazard stands there.**
- `0150` has not been deployed to Supabase.
- The hosted database was at `0074` at the last approved metadata check.
- The hosted PostgREST version is **NOT VERIFIED**.
- Until the required future property of `QAN-BL-PROD-06` holds on the hosted project itself, the risk stays live there.
  That property is `0150` applied there, or PostgREST `v16.0`+ verified there.

**Disposition.**
- **`QAN-BL-PROD-06`** is **re-owned**, not tombstoned, to `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment &
  Data API Retry Gate`.
  - It keeps `HIGH` and `DEFERRED — OWNED`, and its reopen condition (a launch and deployment gate) and required future
    property are unchanged.
  - It now records a closure condition proven on the hosted project itself: read-only evidence, never a retry-loop
    reproduction.
  - A tombstone now would hide the remaining deployment gate. Re-owning keeps one item for one hazard, and no second
    item is admitted.
- **`QAN-BL-PROD-07`** is unchanged: `LOW`, `DEFERRED — OWNED`, owner `PROD-RETRY-02`. It is not a launch gate.
- **Admitted at closure:** none.
- The register holds 51 items, recounted mechanically.

### 10.5 Deferred risks and their owners

| Risk | Owner | State |
|---|---|---|
| Hosted exposure. The five entry points already at `0074` stay exposed on any PostgREST before `v16`, and the rest arrive with the catch-up, until the hosted project carries `0150` or is verified at `v16.0`+ | `HOSTED-DEPLOY-01` (`QAN-BL-PROD-06`, `HIGH`) | `DEFERRED — OWNED`; launch and deployment gate |
| Post-v16 loss of the server-side re-run for the race-converging `40001` paths and genuine `40P01` | `PROD-RETRY-02` (`QAN-BL-PROD-07`, `LOW`) | `DEFERRED — OWNED`; not a launch gate |
| Mixed codes for one message family, for example `MATCHING_STALE_STATE` in the unreachable I-07B..D cores | the `0150` guard (`verify-migration-0150`, in every API CI run) | enforced; a core that becomes reachable fails the guard |
| The six suspended Matching commands, if restored, carry the same rule | `S6-01` (`QAN-BL-MATCH-01`) | `DEFERRED — OWNED`, unchanged |

### 10.6 Validation of this closing change

The validation is proportional to a documentation-only change:
- `npm run test:task-closure-governance-contract`;
- the static contracts that read the changed documents;
- a mechanical recount of the §4 index against the backlog §7 and Current State §5 tables;
- a secret scan of the diff.

The four PostgREST proofs and the 42 local verifier runs were not repeated: the closing change touches no code they
exercise.

Results (local, on this host):
- `test:task-closure-governance-contract`: 24 / 24.
- The 20 static contracts that read the changed documents, plus this task's contract: 298 / 298.
- The recount: the §4 index holds 51 items (23 / 0 / 10 / 18; 29 / 20 / 2). The backlog §7 and Current State §5 tables
  equal it, and the Current State's 33 active rows equal the index rows one for one.
- The secret scan of the diff: no credential, key, token or hosted identifier.
- `test:forward-safety-contract` fails 10 / 35 locally, and **identically on the unmodified head `3a780ba`**. All ten come
  from the mirror's replay of `qan-inf-03`'s offline `expo-doctor` check. That check passes 6 / 6 on the real tree, so
  the failure belongs to this host's environment, not to this change. On the same head, CI ran forward-safety at
  35 / 35. The closing change's own CI run is the authority.
