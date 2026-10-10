# QANDEEL — SEC-MATCH-00 — Unbounded 40001 Retry in PostgREST — Risk Report v1

**Date:** 2026-10-09 (analysis). Committed to the repository on 2026-10-10 by SEC-MATCH-00's closing change.
**Requested by:** the Product Owner, separately from PR #323
**Status:** analysis only, and evidence, not Product authority. No migration, no upgrade, no change to code or
production, and no connection to the hosted environment, not even read-only. The hazard is registered as
[`QAN-BL-PROD-06`](../qandeel-canonical-backlog-v1.md) (owner `PROD-RETRY-01`); the backlog entry, not this report, is
the obligation. The hosted project's PostgREST version is **unverified**; nothing here assumes it.
**Contains:** no user data, no secret, no connection string and no project identifier.
**Scope of evidence:**
- the repository;
- local disposable PostgreSQL 17 databases;
- the public PostgREST and hasql-transaction source;
- the C1 evidence collected earlier under its own authorization (metadata only, no new connection);
- Supabase's public changelog.

---

## 0. Summary

1. **The cause is established from source.**
   - PostgREST before v16.0 runs each request inside `hasql-transaction`, which re-runs the whole transaction
     without any bound when it fails with `40001`. It also re-runs on `40P01` from hasql-transaction 1.1.
   - PostgREST v16.0 (2026-08-07, PR #3673) moved to `transactionNoRetry`.
   - So a request whose answer is a **deterministic** `40001` is never answered on v12, v13 or v14.
2. **The risk is wider than Matching. It reaches Qandeel's conversation core.**
   - Qandeel's API calls its functions through the Supabase Data API (`rest/v1/rpc/...`), not over a direct
     database connection.
   - So the hazard covers the conversation commit (`commit_finalized_exchange_with_full_semantic_chain_v1`), the
     thread identity dossier page, and hypothesis generation and updates. These raise `40001` as a **designed**
     stale-state outcome under normal concurrency, not under attack only.
3. **What is probably on the hosted environment now.**
   - The hosted schema is at 0073/0074 (C1).
   - Seven Data API entry points that can end in `40001` are probably there:
     - two a signed-in user can call: `transition_hypothesis_v2` and `apply_hypothesis_evidence_update`;
     - five the API calls with the service-role key.
   - None of the Matching or Shared World functions are there (0075 onward is absent).
4. **The two user-callable functions are reachable in practice, not just in theory.**
   - Proven on a local database at hosted level, with and without Supabase's default privileges.
   - A signed-in account that owns at least one hypothesis reads its version through RLS, then gets `40001` from
     both functions every time.
   - Through a stand-in with PostgREST's old retry rule, neither request is answered. Through one without it, both
     are answered within 100 ms. Nothing is written.
5. **On option (a):**
   - It is enough for every entry point on the hosted environment **if** it really runs PostgREST v16.0 or later.
   - Supabase's last public announcement is v14 (December 2025), and I found no announcement of v16.
   - Availability must be checked on the project itself. The Product Owner can do that from the dashboard without
     any connection from me.
6. **On option (b):**
   - It means replacing 10 function bodies containing 19 raise sites.
   - It also means updating the API's stale-state recognition in 12 files and re-anchoring about 23 verifiers and
     contracts.
   - Compare-and-swap and the messages are preserved. The repository already has a proven precedent: `PT429` in
     0131.
7. **Not verified:** whether real PostgREST stops the loop when the client disconnects. The API gives up after 5 s;
   the stand-in keeps looping. This needs a real PostgREST in CI, never the hosted environment.

## 1. Mechanism and evidence

| Element | Evidence |
|---|---|
| Unbounded retry on `40001` | `hasql-transaction` 1.0.1.4: `inRetryingTransaction = fix $ \retry -> …` and `"40001" -> onTransactionError` (also `"40P01"` from 1.1). |
| PostgREST v12.2.9 uses it per request | `src/PostgREST/Query.hs:81-82`: `SQL.transaction isoLvl txMode`, with `hasql-transaction >= 1.0.1 && < 1.1`. |
| v13.0.8 / v14.18 | `hasql-transaction < 1.2`. No retry fix appears in the v14.18 changelog. |
| v16.0 stops it | v16.4 changelog: "Fix automatic transaction retries on 40001…" (#3673, 16.0). `MainTx.hs:96`: `SQL.transactionNoRetry`. |
| How v16 answers | `Error.hs`: `'4':'0':_ -> status500` (HTTP 500, code `40001`), which is exactly what the API's error handling expects. |
| What CI observed | Run `37971820700` (`d8afff6`): a request answered with a deterministic `40001` went unanswered for 300 s on v12.2.9. |
| Local reproduction | A stand-in with the same rule re-ran the transaction about 2,000 times a second without answering. |

Genuine serialization failures are not a source here. PostgREST runs at READ COMMITTED, and the census found no
`default_transaction_isolation` setting on any role, database or function. Deadlocks (`40P01`) are transient and do
not form a deterministic loop, even though v13/v14 retry them.

## 2. Exposed functions (catalog census, transitive)

Method (`census-retry.mjs`):
- every function in `public` reachable through PostgREST by `anon`, `authenticated` or `service_role` whose own body,
  or the body of any function it calls by name, raises `40001` / `40P01` / `serialization_failure`;
- the same check over table, view, policy, default and check paths, through triggers;
- a check for any non-literal `ERRCODE`.

**Result on both 0074 databases (CI-shaped and hosted-shaped):** no table, view or policy paths, and no non-literal
`ERRCODE`.

| Entry point | Who can call it | Migration | Probably on hosted? | Who calls it in practice | Message |
|---|---|---|---|---|---|
| `transition_hypothesis_v2` | authenticated | 0036 | **yes** (marker present) | the API with the user's token, **and the user directly** | `Stale hypothesis version.` |
| `apply_hypothesis_evidence_update` | authenticated (+ service_role on hosted) | 0008/0028/0032 | **yes** | the API with the user's token, **and the user directly** | `Stale hypothesis version.` |
| `background_apply_hypothesis_evidence_update_v1` | service_role | 0032 | yes | the API (background intelligence) | `Stale hypothesis version.` |
| `commit_finalized_exchange_with_full_semantic_chain_v1` | service_role | 0071 | yes | the API (conversation commit) | `STALE_CONVERSATIONAL_FOCUS_CONTEXT`, `STALE_THREAD_IDENTITY_CONTEXT` |
| `get_conversation_thread_identity_dossier_page_v1` | service_role | 0070 | yes | the API (two repositories) | `STALE_THREAD_IDENTITY_CONTEXT` |
| `persist_post_response_hypothesis_generation_v1` | service_role | 0033/0036/0072 | yes | the API (post-response intelligence) | `Stale hypothesis version.` (via `transition_hypothesis_core_v1`) |
| `execute_post_response_hypothesis_update_batch_v1` | service_role | 0034/0072 | yes | the API (post-response intelligence) | `Stale hypothesis version.` (via the core) |
| `grant_` / `revoke_shared_world_standing_context_v1` | authenticated | 0078 | no (0075+ absent) | — | `STANDING_CONTEXT_STALE_STATE` |
| pause / turn off / the two Matching revocations | authenticated | 0109 (narrowed by 0149) | no | — | `MATCHING_STALE_STATE` |

**Basis for "probably on hosted":**
- C1 markers for 0032, 0033, 0034, 0036, 0070, 0071 and 0072 are present; 0075 onward is absent.
- C1 did not record these functions' privileges.
- The privilege columns come from the repository, built twice locally: CI-shaped, and with Supabase's default
  privileges. The two builds agree, except that hosted adds `service_role` to `apply_hypothesis_evidence_update`.
- Whether the hosted copy matches the repository is an inference from the markers, not a measurement.

## 3. Are they callable in practice by a signed-in user?

**The two user-callable functions:** yes, under one condition.
- The account must own at least one hypothesis. The system creates hypotheses; the user cannot create one (no
  `INSERT`).
- If the hypothesis isn't found, both functions return nothing. `40001` comes only from a version mismatch on a
  hypothesis the user owns.
- The user can read their hypothesis and its version (`SELECT` through RLS), so they can send a stale version on
  purpose.

**Practical proof** (`risk/reach-hypothesis.mjs`, on `qandeel_c2h74` and `qandeel_c274`; real role, real claims, no
data reads):

| Step | Result |
|---|---|
| Read own hypothesis through RLS | succeeded (version 1) |
| `transition_hypothesis_v2(stale version)` ×3 | `40001 Stale hypothesis version.` all three times |
| `apply_hypothesis_evidence_update(stale version)` ×3 | `40001 Stale hypothesis version.` all three times |
| Through a stand-in with PostgREST's old retry rule | **not answered** after 4 s, for both |
| Through a stand-in without it (v16-like) | answered within 9–95 ms with HTTP 409 (the stand-in's mapping; real v16 gives 500) |
| After the run | version unchanged, 0 audit rows, 0 update rows |

**The service-role functions:** a user cannot call them directly. They do sit in the API's normal flows, though. The
designed stale outcome (for example, the conversational focus moving between read and commit) is `40001`. On
PostgREST before v16 the API never receives it: it waits 5 s (`AbortSignal.timeout(5000)`) and fails, instead of
handling the stale state as designed.

**What I don't know about the hosted environment, and did not check:**
- whether any account has hypotheses;
- whether the API serves real traffic;
- whether sign-up is open;
- the PostgREST version.

## 4. Is option (a) enough?

**Yes, for everything in §2, on these conditions:**
1. **The version must be verified on the project itself.** Supabase's public changelog says the hosted Data API
   moved to v14 (December 2025), and I found no public announcement of v16 on Supabase. Availability, timing and
   method are unknown. The current version shows in the dashboard (Infrastructure).
2. **Clients must accept HTTP 500 + `40001`.** That is how v16 answers. The API already expects exactly this
   (`DataApiError(500, '40001')`) and the mobile app calls no RPC directly, so nothing needs to change.
3. **It is not durable on its own.** Any return to a line before v16 (on hosted, or in a staging environment)
   brings the hazard back. CI's own v12–v14 lines will also hang any future proof that sends a deterministic
   `40001`.
4. **It doesn't fix the API's current waiting** on a line before v16. That stays until the upgrade.

## 5. What option (b) would require

**Principle:** a forward-only migration that replaces the bodies, changing **only** the `ERRCODE` literal at each site
to a code PostgREST never re-runs. Recommended: `PT409`, with the message unchanged.

**Why `PT409`:**
- PostgREST maps `PTxyz` to HTTP xyz. The `PT429` precedent (0131) is proven in CI on all four lines.
- 409 Conflict fits a compare-and-swap conflict.

**Scope** (`risk/option-b-scope.mjs`, on main + 0149):
- **10 function bodies, 19 sites:**
  - `transition_hypothesis_core_v1` (2);
  - `apply_hypothesis_evidence_update_core_v1` (2);
  - `commit_finalized_exchange_with_full_semantic_chain_v1` (2);
  - `get_conversation_thread_identity_dossier_page_v1` (1);
  - `grant_` / `revoke_shared_world_standing_context_v1` (2 + 2);
  - the four retained Matching commands (2 each).
- **Wider Matching scope (S6-01):** if the six suspended commands come back later, they carry the same rule.
- **API:** 12 files under `apps/api/src`. The stale-state constants (`STALE_*_SQLSTATE = '40001'`) and their
  matching should accept the new code, preferably alongside `40001` during the transition window.
- **Re-anchoring:** about 19 files under `database/` (verifiers and static tests) and 4 contracts under `tests/`
  currently assert `40001` with these messages. They are re-anchored forward the way 0109 was in C2. Historical
  checks stay intact.
- **Frozen contracts touched:** conversation focus and thread (0066–0071), hypotheses (0032/0036), Shared standing
  context (0078) and Matching (I-07A §47). Each needs a recorded controlled amendment.

**What must be preserved, and how to prove it:**

| Requirement | Proof |
|---|---|
| Same compare-and-swap | The normalized body is **identical** to the current one, apart from the `ERRCODE` literal at the 19 sites. |
| No write over a stale state | A stale call writes nothing, adds no audit row, and the version is unchanged. |
| Same semantic message | The message is asserted verbatim in each verifier. |
| No security change | `CREATE OR REPLACE` keeps the owner and privileges. The migration restates `SECURITY DEFINER` and `search_path` exactly. Terminal assertions compare `proacl` / owner / `prosecdef` / `proconfig` before and after. |
| No change to user data | No DML. The migration only replaces function definitions. |
| Concurrency still serialized | Repeat the existing races (X01 and similar) with the new code. |

## 6. Proving the fix without endangering the hosted environment

1. **Never reproduce the hazard on hosted.** Reproducing it is the outage itself.
2. **Hosted evidence (read-only, separately authorized):**
   - The PostgREST version, from the dashboard. The Product Owner can do this themselves.
   - Whether the API serves real traffic.
   - If needed, and only with authorization, one metadata-only query for these seven functions' privileges, using
     the C1 recipe.
3. **In CI only, with disposable containers:**
   - **(i) A reachability proof** like the one in §3 for each entry point, as a real role with no writes.
   - **(ii) A wire proof per PostgREST line, including the hosted line:**
     - send the stale path with a strict timeout;
     - measure server-side attempts (a `pg_stat_database.xact_rollback` delta, or `pg_stat_statements.calls`);
     - check `pg_stat_activity` after the client leaves. This answers whether the loop stops on disconnect.
     - **Expected:** without a fix, lines before v16 don't answer and v16+ answers once. Under (b), every line
       answers once with `PT409`.
   - **(iii) A forward catalog guard:** fail if any Data API entry point can reach a retried SQLSTATE. Under (a), the
     guard instead fails if the CI matrix lacks the hosted line.
4. **For (b), before any deployment:**
   - local verification and CI on CI-shaped and hosted-shaped databases;
   - the normalized-body equality proof;
   - API tests;
   - then a controlled deployment window with metadata-only verification afterwards.

## 7. Decisions for the Product Owner

1. **The version.** Read the hosted PostgREST version from the dashboard yourself. If it is v16+, (a) is already in
   effect. If it is v14 or earlier, ask whether Supabase offers v16 and how.
2. **If the API already serves real users,** this affects the conversation core today, not only future Matching. It
   may call for faster handling than the SEC-MATCH-00 timeline.
3. **Backlog disposition (BG-08).** *Done in SEC-MATCH-00's closing change (2026-10-10), at the Product Owner's
   direction:* the hazard is the single new item `QAN-BL-PROD-06` (`HIGH`, `DEFERRED — OWNED`, owner
   `PROD-RETRY-01 — Data API 40001 Retry Hazard Closure`). No existing item covered it.
4. **If (b) is chosen,** it is its own task with its own approval and a migration number. It is not part of
   PR #323.

## 8. Evidence files (session scratch, not in the repository)

The scripts below ran in the analysing session's scratch space and are **not** committed. They are named so the method
can be reproduced; `PROD-RETRY-01` re-derives its evidence in CI (§6) rather than relying on them.

- `census-retry.mjs`, `census-retry-svc.mjs`: the census.
- `reach-hypothesis.mjs`: the reachability proof.
- `option-b-scope.mjs`: the scope of (b).
- `postgrest-shim-hasql.mjs`, `postgrest-shim.mjs`: local stand-ins, **not PostgREST**.
- Databases: four local, disposable PostgreSQL 17 databases built from the repository, two at `0074` and two at
  `0149`, each pair CI-shaped and hosted-shaped.

**Later CI evidence (PR #323).** On the exact head `a0290f8`, API CI run `37994876559` passed all three live wire
proofs on PostgREST `v12.2.9`, `v13.0.8`, `v14.18` and `v16.4` (12 / 12). Those proofs send no request whose answer is
a deterministic `40001`, so they say nothing about the hazard on the hosted project.

## Sources

- hasql-transaction: https://github.com/nikita-volkov/hasql-transaction (`Private/Sessions.hs` in tags 1.0.1.4,
  1.1.x, 1.2.1)
- PostgREST v12.2.9 `Query.hs`: https://github.com/PostgREST/postgrest/blob/v12.2.9/src/PostgREST/Query.hs
- PostgREST v16.4 `MainTx.hs`, `Error.hs`, CHANGELOG: https://github.com/PostgREST/postgrest/tree/v16.4
- Supabase, "Data API upgrade to PostgREST v14": https://supabase.com/changelog/41288-data-api-upgrade-to-postgrest-v14
- Supabase platform upgrades: https://supabase.com/docs/guides/platform/upgrading
- PostgreSQL, Serialization Failure Handling: https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html
