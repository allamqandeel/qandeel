# QANDEEL — SEC-MATCH-00 — Matching Direct-RPC Exposure & Account-Deletion Protection — Implementation Record v1

**Status:** `SEC-MATCH-00` — **IMPLEMENTED — AWAITING INDEPENDENT REVIEW AND THE PRODUCT OWNER'S MERGE DECISION (`ادمج`)**.
Not merged, not deployed, not `CLOSED / FROZEN`.
**Workstream:** P0 cross-cutting security checkpoint ahead of CI-01 — not a Product stage.
**Baseline:** `main = 5973123153e26494d702a4a859a79631ede225cd` (merge of PR #321).
**Branch:** `sec/sec-match-00-direct-rpc-protection`. The final head is stated in the PR.
**Authority:** the SEC-MATCH-00 Task Contract v1 (2026-10-09), and the Product Owner's gates in order:
- C0 accepted;
- `AUTHORIZE_C1_READ_ONLY_METADATA` for the QANDEEL APP hosted environment;
- `APPROVE_C2_PATCH_B`.

**Core rule:** preserve the core, prove exposure, protect deletion, do not rebuild Matching.
**Claude did not merge, deploy or touch any hosted environment in C2.**

---

## 1. The problem (C0, proven on disposable PostgreSQL)

`0109` granted all eleven I-07A Matching setup boundaries to `authenticated`. Matching is not launched: Stage 6 has not
started, and the `CW2-08` launch gates are closed. No API route and no mobile surface calls a Matching setup command,
but a hidden UI is not an access control. Any signed-in account could call the functions directly through the Data API.

On a fresh account, four commands COMMIT a footprint with no prior Matching history:
- `activate_matching_participation_v1`;
- `grant_matching_context_v1`;
- `set_introduction_profile_v1`;
- `set_matching_requirements_v1`.

Each takes the caller's `matching_setup_locks` row first (`0108`, `ON DELETE RESTRICT` to `public.users`). Every one
of the fourteen `0108` relations refuses `DELETE`. So the governed Personal erasure (`0130`) then truthfully answers
`BLOCKED`, and no governed path removes the footprint.

The other six commands cannot create a first footprint:
- `grant_pre_match_disclosure_authority_v1` needs a profile;
- pause, resume, turn off and both revocations need an existing state they name exactly.

A transitive call-graph census found no other client route into Matching state.

## 2. Environment evidence (C1, read-only metadata, QANDEEL APP hosted only)

The identity check was unambiguous, so C1 connected. Everything ran in one `READ ONLY` transaction, which was
asserted before any query. No user or application table was read or counted, no RPC was called, and `SET ROLE` was
not used.

**Classification: `NOT_DEPLOYED`.**
- The hosted schema stops at migration `0074`. None of `0075`–`0148` is applied.
- 0 / 11 Matching functions and 0 / 14 Matching tables exist, and no other writer exists.
- No production Matching footprint can exist, and no emergency production action is needed.

Hosted default privileges grant every new `postgres`-owned function in `public` to `anon`, `authenticated` and
`service_role`. That is why this migration revokes by name, sweeps every grantee, and asserts effective privilege.

## 3. The Product Owner's decision

`APPROVE_C2_PATCH_B`: the six-function, narrowing-only protection. Corrections of an Introduction Profile or a
requirement set, and resume, are **temporarily suspended before launch**. C2 invents no correction or enrollment
wrapper. C2 is authorization to implement and prepare a PR, not to deploy.

## 4. Design in one paragraph

One forward migration, `0149_matching_setup_pre_launch_direct_execute_narrowing_v1.sql`, changes privileges only:
- It revokes `ALL` on exactly six exact signatures from `PUBLIC`, `anon` and `authenticated`, then from
  `service_role` where the role exists, then from every remaining non-owner grantee in the function's ACL.
- Its terminal assertions then refuse to commit if:
  - any of `PUBLIC`, `anon`, `authenticated` or `service_role` can still execute one of the six (effective privilege,
    inheritance included);
  - any non-owner ACL entry remains on the six;
  - one of the five retained operations lost its `authenticated` grant or gained a client grant;
  - any other function an application role can execute writes one of the fourteen `0108` relations.

No body, signature, owner, table, policy, row-level-security setting or row changes.

## 5. The protection — the exact privilege delta

| Boundary | Before `0149` | After `0149` |
|---|---|---|
| `activate_matching_participation_v1(uuid, text, uuid)` | `authenticated` | owner only |
| `resume_matching_participation_v1(uuid, uuid)` | `authenticated` | owner only |
| `grant_matching_context_v1(uuid, uuid, uuid)` | `authenticated` | owner only |
| `set_introduction_profile_v1(uuid, text[], text[], uuid)` | `authenticated` | owner only |
| `set_matching_requirements_v1(uuid, text[], text[], text[], uuid)` | `authenticated` | owner only |
| `grant_pre_match_disclosure_authority_v1(uuid, uuid, uuid, text[], uuid)` | `authenticated` | owner only |
| `pause_matching_participation_v1(uuid, uuid)` | `authenticated` | `authenticated` (unchanged) |
| `turn_off_matching_participation_v1(uuid, uuid)` | `authenticated` | `authenticated` (unchanged) |
| `revoke_matching_context_v1(uuid, uuid)` | `authenticated` | `authenticated` (unchanged) |
| `revoke_pre_match_disclosure_authority_v1(uuid, uuid)` | `authenticated` | `authenticated` (unchanged) |
| `get_my_matching_setup_v1()` | `authenticated` | `authenticated` (unchanged) |

`PUBLIC`, `anon` and `service_role` hold none of the eleven, before or after. The resulting ACL was compared on a
CI-shaped database and on a hosted-shaped one carrying Supabase's `public` default privileges. It is identical in
both: the six read `{postgres=X/postgres}`, and the five read `{postgres=X/postgres,authenticated=X/postgres}`.

**Retained for every existing human:**
- pause;
- turn off participation;
- revoke the Matching Context Grant;
- revoke the Pre-Match Disclosure Authority;
- inspect one's own Matching setup.

These keep their exact `0109` semantics: the human comes from `auth.uid()`, the command id is the row identity, the
retry returns the committed answer, a conflicting reuse is `23505`, a stale expected state is `40001`, and the caller's
own lock row is taken first. None of the five can commit anything for a human with no Matching history.

## 6. What is unchanged (anti-scope)

- Migrations `0001`–`0148` are byte-identical; the contract pins `0108` / `0109` by SHA-256. All eleven bodies are
  proven byte-identical to the `0109` source on the live catalog.
- No Matching semantics are added: no candidate, proposal, score, catalogue, eligibility, launch gate, wrapper or
  model. The `I-07B`–`I-07D` cores stay executable by no application role.
- There is no API, mobile, provider or DeepSeek change, and no model call was made.
- `0130` semantics are unchanged, and no Connected Worlds erasure is implemented.
- S6-01 stays paused, Issue #322 stays open (NO-GO), and CI-01 has not started.

## 7. Account deletion — `QAN-BL-ACCT-01`

`0149` protects account deletion against new Matching footprints. It does not physically erase existing
Connected Worlds references.
- **New accounts:** an account with no Matching history can no longer acquire a Matching `RESTRICT` reference
  through any client route.
- **Existing footprints:** an account that already holds one keeps it, and its governed erasure stays truthfully
  `BLOCKED`, never relabeled as deleted.
- **Constraints:** every Matching-namespace foreign key to `public.users` is still `RESTRICT`.

`QAN-BL-ACCT-01` stays `HIGH`, `OPEN — UNASSIGNED`. The canonical backlog records a current-truth note.

## 8. Suspended operations — `QAN-BL-MATCH-01`

Correction and first creation are the same functions, so a correction cannot be separated from new enrollment
without a new wrapper, which the Product Owner ruled out for C2. The following are therefore suspended until a
reviewed Stage 6 launch path exists:
- new enrollment (activate);
- resume after a user pause;
- Introduction Profile correction;
- requirement correction;
- granting or reconfirming a Matching Context Grant or a Pre-Match Disclosure Authority.

The retry law is amended: a replay of an already committed command of the six now answers `42501` instead of its
committed result.

These amendments to the frozen `I-07A` surface are recorded as §47 of the
[Matching / Introduction Runtime record](../matching-introduction-runtime-v1.md), without rewriting §7. The
obligation to restore them is admitted as `QAN-BL-MATCH-01` (`HIGH`, `DEFERRED — OWNED`, owner
`S6-01 — Intelligent Matching Onboarding`).

## 9. Verification (exact results)

All database runs used a disposable local PostgreSQL 17.10, never the hosted database. Two databases were built from
the repository's canonical bootstrap plus all 149 migrations, one file per batch:
- `CI-shaped`: the API CI posture;
- `hosted-shaped`: the same plus `verify-migration-0133.mjs`'s `SUPABASE_PUBLIC_DEFAULTS`.

Both applied cleanly, and `0149`'s own terminal assertions passed on both.

| Check | CI-shaped | Hosted-shaped |
|---|---|---|
| `verify-migration-0149.mjs` | 20 / 20 PASS | 20 / 20 PASS |
| `verify-migration-0109.mjs` (re-anchored) | 39 / 39 PASS | 39 / 39 PASS |
| `verify-migration-0109.mjs` before the re-anchor | 33 / 39 — exactly the 6 predicted current-grant failures | — |

**Matching regression on the CI-shaped database:** every verifier passes unchanged:

| Verifier | Result |
|---|---|
| `0108` | 26 / 26 |
| `0110` | 25 / 25 |
| `0111` | 23 / 23 |
| `0112` | 22 / 22 |
| `0113` | 17 / 17 |
| `0114` | 35 / 35 |
| `0115` | 25 / 25 |
| `0116` | 33 / 33 |
| `0117` | 14 / 14 |
| `0118` | 15 / 15 |
| `0120` | 27 / 27 |
| `0122` | 23 / 23 |

**Account deletion baseline:** `verify-migration-0130.mjs` passes, including its Connected Worlds `BLOCKED` hard stop.
On this Windows host it needs the established scratch clock-offset preload: the database clock runs about 10 ms
ahead of Node, which trips its `available_until <= 7 days` bound by milliseconds. This is environmental and
reproduces without `0149`.

**Wire proof:** `prove-0149-matching-direct-rpc-postgrest.mjs` is run by API CI against live PostgREST
`v12.2.9`, `v13.0.8`, `v14.18` and `v16.4`. There is no Docker on the implementation host, so locally its logic was
exercised end to end against a scratch stand-in. The stand-in models one transaction per request, `SET LOCAL ROLE`
from the token, claims as a transaction GUC and PostgREST's `42501` mapping; it is **not** PostgREST, and this record
does not claim a live PostgREST result until CI reports it.

**First exact-head CI (`d8afff6`): the wire proof failed on `v12.2.9`, and the proof was corrected.**
- Every other API CI step passed, including `verify-0149` and the forward-safety gate.
- The proof sent the fresh account's pause and turn-off a random expected act id. The answer to that is
  deterministically `40001 MATCHING_STALE_STATE`.
- PostgREST before `v16.0` re-runs a transaction that fails with `40001` without bound (§11.6). The request was
  never answered, and the HTTP client gave up after 300 s.
- The failure was reproduced locally with a stand-in that adds PostgREST's retry rule: the same request was
  re-run about 2,000 times a second.

The corrected proof:
- sends those two calls a null expectation, refused `22023` before any write;
- bounds every request at 30 s and names the boundary that went unanswered;
- reports a failure at the stage where it happened;
- always removes its fixtures, and reports a removal failure together with any earlier failure, never instead of
  it.

The `40001` refusals themselves are unchanged and stay proven on real PostgreSQL by `verify-0149`: a fresh and an
existing human, and the `X01` race. A green wire proof says nothing about the hosted project's PostgREST (§11.6).

**Static, local:**

| Check | Result |
|---|---|
| New SEC-MATCH-00 contract | 9 / 9 |
| `npm run test:database` (includes the unchanged `0109` static test and the verifier-hazard contract) | 1304 / 1304 |
| Repository hazard scan | 0 findings |
| `test:task-closure-governance-contract` | 24 / 24 |
| `test:toolchain` | 8 / 8 |
| Forward-safety gate | 25 / 35 |

All ten forward-safety failures are one sub-test: the Expo `expo install --check` / `expo-doctor` determinism leg of
`qan-inf-03`, and only inside the gate's temporary mirror. That contract passes 6 / 6 run directly in the real tree.
SEC-MATCH-00 touches none of its inputs, and the same mirror leg was already recorded as a baseline local failure on
this host during S5-04. API CI's run of the gate is the authoritative result; see the PR for the exact-head CI.

`verify-0149` scenarios:
- `DIRECT_RPC_DENY` (catalog; every role × six for a fresh human; an existing human's correction and resume);
- `NEW_FOOTPRINT_ZERO`;
- `SELF_INSPECTION_ALLOWED`;
- `EXISTING_TURN_OFF_ALLOWED`;
- `EXISTING_REVOKE_ALLOWED`;
- `OWNER_ONLY`;
- `IDEMPOTENT_RETRY`;
- `X01` (two real connections, real `authenticated` role, lock-row serialization, loser `40001`);
- `NO_BACKDOOR` (a transitive writer census over every function, plus every relation built on Matching state);
- `DELETION_BASELINE_UNCHANGED` (catalog and existing footprint);
- `HOSTED_DEFAULT_PRIVILEGES` (`0149` re-applied over a drift that grants all four client roles plus an inherited
  grant, with the drift first proven real by an actual activation; every row unchanged);
- `BODIES_UNCHANGED`;
- three refused weakenings: `f1` an inherited owner privilege makes `0149` refuse to commit; `f2` a reopened direct
  grant fails the regression check; `f3` a client wrapper fails the census;
- the posture re-checked after every probe and fixture.

The transitive census on both databases: of the 32 functions that reach a Matching setup write, exactly four are
application-executable: pause, turn off and the two revocations, `authenticated` only. Before `0149` there were ten.

## 10. Historical verifier re-anchoring

`verify-migration-0109.mjs` asserted that `authenticated` executes all eleven. Two narrow changes were made, and
both cite this amendment:
- The current-effective expectation now reads "executes ⇔ not one of the six" (`SEC_MATCH_00_SUSPENDED`, shared
  from `matching-setup-verifier-support.mjs`).
- `G01` now proves that a real `authenticated` session reaches the projection and a command it still holds (pause),
  that activation is `42501`, and that a claimless session is refused through a retained command.

Every historical `I-07A` check is untouched: owner, definer, pinned path, `auth.uid()`, no identity parameter, no
system credential (`PUBLIC` / `anon` / `service_role` refused all eleven), the participation law, idempotency,
serialization and the three refused weakenings. All behaviour scenarios still drive the commands as the owner with
the human's claims, exactly as before. The `0109` static test passes unchanged.

## 11. Deployment requirement

C2 is not a deployment. A future deployment is its own Product Owner approval. When it happens:

1. Never expose `0108` / `0109` to live signed-in users without `0149` taking effect in the **same controlled
   deployment window**. A catch-up that reaches `0109` must include `0149`.
2. Keep the Data API closed to signed-in use during that window until the effective privileges are verified. A call
   that passed its `EXECUTE` check before `0149` commits can still finish.
3. Verify afterwards, by metadata only: `has_function_privilege` is false for `PUBLIC`, `anon`, `authenticated` and
   `service_role` on the six, and true for `authenticated` only on the five. This is the C1 recipe's Q3.
4. Dashboard-only checks remain the operator's:
   - the exposed-schemas list;
   - the GraphQL toggle (moot while `pg_graphql` is absent);
   - Auth settings;
   - whether any distributed mobile build points at the project.
5. The hosted project is 74 migrations behind `main`. That catch-up is a separate, planned deployment; `0149` does
   not change its other risks.
6. **Blocking condition: unbounded `40001` retry.**
   - **The risk.** PostgREST before `v16.0` runs every request through `hasql-transaction`. That library re-runs the
     whole transaction, without any bound, whenever it fails with `40001` (`serialization_failure`). It does the same
     for `40P01` from `hasql-transaction` 1.1. PostgREST `v16.0` stopped this (PostgREST #3673).
   - **Why Matching is affected.** The four retained Matching mutations (pause, turn off and the two revocations)
     answer a stale expectation with a deterministic `40001 MATCHING_STALE_STATE`. Revoking an already-revoked grant
     is one example.
   - **The effect.** Through such a PostgREST, one such request from any signed-in user is never answered. It keeps
     a pool connection re-running the transaction. This was shown in API CI against `v12.2.9` (§9).
   - **The rule.** No deployment may expose `0109` through the Data API while the hosted project's PostgREST would
     re-run a `40001` transaction. Before such a deployment, one of these must hold:
     - **(a)** the hosted project's PostgREST is `v16.0` or later. This must be verified on the hosted project itself,
       never inferred from the upstream release.
     - **(b)** a separately approved forward migration answers the stale-state refusal with a SQLSTATE that is never
       re-run. That migration must keep the compare-and-swap, the refusal to write over a stale state, the semantic
       `MATCHING_STALE_STATE` message, and every security guarantee, and it must not change user data.
   - **Rejected.** Moving these commands off the Data API is rejected for now.
   - **What CI proves.** A green API CI run proves the repository's behaviour on CI's PostgREST lines. It is **not**
     evidence that this operational risk is handled on the hosted project. That needs its own evidence-based closure
     decision.

## 12. Known limitations and residuals

- **Forward durability.** A later migration that re-creates one of the six would get a fresh ACL. On a hosted
  project, `service_role` keeps a default grant even after `0133`. The static contract therefore refuses any later
  migration that grants, re-creates, drops, re-owns or blanket-grants one of the six. The verifier refuses the
  resulting catalog state on every API CI run.
- **The census is static.** It reads function bodies, including transitive calls. A function that reached Matching
  state only through dynamic SQL built from non-literal text would not be seen. No such function exists, and the
  migration's own assertion uses the same rule.
- **The race window.** The protection is a catalog ACL committed atomically with its assertions. There is no runtime
  toggle to race, which is why §11.2 keeps the window closed.
- **Stage 6 work.** Restoring enrollment, correction and resume is Stage 6 work (`QAN-BL-MATCH-01`). Until then,
  Matching cannot launch.
- **The `40001` retry hazard is wider than Matching.** Other functions an `authenticated` token can execute also
  answer `40001`, including two that predate the hosted schema's `0074`. SEC-MATCH-00 neither creates nor closes this
  hazard; `0149` narrows it by closing six of the ten Matching commands that raise it. Assessing it is a separate
  report the Product Owner requested. The hazard needs a backlog disposition (BG-08) no later than the change that
  closes SEC-MATCH-00.

## 13. Files changed

- `database/migrations/0149_matching_setup_pre_launch_direct_execute_narrowing_v1.sql` (new)
- `database/verify-migration-0149.mjs` (new)
- `database/prove-0149-matching-direct-rpc-postgrest.mjs` (new)
- `database/matching-setup-verifier-support.mjs`: the shared six / five lists
- `database/verify-migration-0109.mjs`: the narrow re-anchor (§10)
- `tests/sec-match-00-matching-direct-rpc-protection-contract.test.mjs` (new)
- `package.json`: three scripts
- `.github/workflows/api-ci.yml`: the static contract step, the integration step, and the wire proof in the live
  PostgREST loop
- `database/README.md`
- `docs/matching-introduction-runtime-v1.md`: a §7 pointer and §47
- `docs/qandeel-canonical-backlog-v1.md`
- `QANDEEL_CURRENT_STATE.md`
- `QANDEEL_PRODUCT_ROADMAP.md`
- this record

## 14. Governance reconciliation (BG-05 / BG-08 / BG-09)

- **BG-05:** SEC-MATCH-00 inherited no item by owner.
- **BG-08, admitted:** `QAN-BL-MATCH-01`. It is a canonical record's explicit deferral to a named future task.
- **`QAN-BL-ACCT-01`:** stays `OPEN — UNASSIGNED`, with a current-truth note.
- **`QAN-BL-SEC-01`:** unchanged.
- **Register:** 49 items; 21 / 0 / 10 / 18 by status and 28 / 20 / 1 by severity, counted mechanically.
- **Phase status:** unchanged. `I-07` and its slices remain `CLOSED / FROZEN`; §47 records a controlled privilege
  amendment, not a reopening.
- **BG-09:** this record's banner moves to its final lifecycle state in the change that closes SEC-MATCH-00.

## 15. Merge statement

Ready for independent review. Nothing is merged or deployed. The next steps are the Product Owner's: review, then
`ادمج`, then a separate deployment approval. After SEC-MATCH-00 closes, the next roadmap workstream is
**CI-01 — Shared Intelligence Learning Evidence & Baseline**, which has not started.
