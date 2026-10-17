# QANDEEL — ACCT-DEL-01 Implementation Record v1

**Task:** ACCT-DEL-01 — Account Deletion Across Matching / Introductions  
**Owns:** `QAN-BL-ACCT-01` (re-owned in this change from `OPEN — UNASSIGNED` to `DEFERRED — OWNED`; it stays open, P-1)  
**Product authority:** the Product Owner's approval (2026-10-17) of the ACCT-DEL-01 WP0 report v1, its review addendum
v1.1 and decisions P-1 … P-4, with the final review notes («ACCT-DEL-01 — Final Implementation Authorization»). W3-PDG-01
§8 (Delete Account), CW2-06 and CW2-03 §37 as cited. No merge or deployment without the Product Owner's explicit «ادمج».  
**Status:** **CP1 DELIVERED — AWAITING THE PRODUCT OWNER'S CP1 REVIEW — CP2 (CLOSURE) NOT STARTED — NOT MERGED / NOT
DEPLOYED** (2026-10-17).  
**Base:** `main` = merged PR #344 (S6-06) at `4233c06739149fb19b441db782837497815d8be6`, re-verified before the branch.  
**Branch:** `acct/acct-del-01-account-erasure` (one pull request for the whole task: CP1, then CP2).  
**Migration:** `0164_account_deletion_matching_introductions_v1.sql` (the number was free).

`MERGED ≠ DEPLOYED ≠ LAUNCH-READY`. The hosted environment is `NOT_DEPLOYED` (its schema stops at `0074`), so no real
Matching footprint and no real `BLOCKED` request exists to migrate. Nothing here opens a launch gate or CW2-08, and nothing
claims that account deletion in QANDEEL as a whole is closed.

## 1. The Product Owner's decisions (binding; not to be reopened)

| ID | Decision (approved 2026-10-17) |
|---|---|
| P-1 | Scope: account deletion in Matching / Introductions completely, the Introduction World's own dependencies included. `QAN-BL-ACCT-01` stays open for what is not resolved. Shared `STANDARD` and Public are owned in future by `ACCT-DEL-02`; Replay by Stage 7. A release gate prevents launching any world without a complete, proven account-deletion path. Do not claim all account deletion is closed. |
| P-2 | When A is deleted, A's data, content and links go; B keeps B's own text messages, with the right to read, delete and export them, through the retained view — without widening B's rights or revealing anything of A. Prove compatibility with `IntroductionWorldService` (its `matching_proposal_id` requirement) and the current UI; do not assume no mobile change. |
| P-3 | `BLOCKED` honestly for uncovered causes, with no partial erasure; re-arm with a fresh 7-day grace and cancellation when the cause goes; RETRY distinguished from real integrity failures, with no unbounded retry; `ERASED`, `COMPLETED` and external file erasure distinguished, the photo queue tracked and its removal proven. |
| P-4 | The controlled amendments only as designed: the guards, `NO_BACKDOOR`, the retained-view readers, gate 7a of `0117`. No historical migration edited; the six suspended commands stay suspended; no new direct grant to a user or `service_role` on a Matching engine; CW2-08 and every production gate stay closed. |

The WP0 called the controlled amendment "I-07 §48". `PROD-RETRY-01` had already taken §48 of
[`matching-introduction-runtime-v1.md`](../matching-introduction-runtime-v1.md), so it is **§49** there. Nothing else differs.

## 2. CP1 — what was built

### 2.1 Migration `0164` (database)

- **One coordinator, one entry.** `account_erasure_private.erase_account_v1(deletion)` behind
  `public.server_erase_account_v1(uuid)` (`SECURITY DEFINER`, `service_role` only). The coordinator and the module are
  executable by no role; nothing else calls the coordinator. `0130` is byte-unchanged and keeps its own grants.
- **The published lock order** (WP0 addendum §5.2): the account's Introduction Worlds (ascending) → their Records → the
  Matching serialization rows of the account and every counterpart (ascending) → the account's proposals → participation
  pointers → claims → the account row → the request. The footprint is re-read under the setup locks; if a Match, a
  SUCCESS or a new pair committed while it waited, the answer is `RETRY`. A local `lock_timeout` of 2 s turns any longer
  wait into `RETRY`. The locks are taken outside the erasure subtransaction, so they survive its rollback.
- **The census before any write.** The account row is held `FOR UPDATE`, so no transaction can add a row that references
  it: a static, read-only census (one probe per residue relation and column, generated from the catalog and kept complete
  by CI) finds Shared `STANDARD`, Public or Replay rows. Any uncovered class answers `BLOCKED` with its classes, and
  nothing is touched.
- **One subtransaction around every write, the `0130` call included.** A live Introduction ends exactly as A's own S6-02
  END would (the frozen `0116` core through `end_own_introduction_v1`, A as `auth.uid()`, authorized by A's own
  re-authenticated, grace-expired request); B's retained view and lineage release are written; every photo storage key
  goes to the `0162` queue and is tracked for the request; the whole footprint is deleted; a module completeness check
  runs; then the unchanged `0130` Personal erasure. `0130` answers `BLOCKED` without raising, so every answer but `ERASED`
  is raised: the subtransaction undoes every delete, B's END effects, the retained view, the release, the queued keys,
  the authorization and the GUC. Every deferrable constraint in the schema is `ON DELETE RESTRICT`, which PostgreSQL checks
  immediately, so no outcome waits for `COMMIT`.
- **Outcomes.** `ERASED` | `BLOCKED` | `RETRY` | `INTEGRITY`, and `0130`'s own `NOT_DUE` | `CANCELLED` | `ALREADY_ERASED`
  | `UNKNOWN`. `RETRY` (contention) backs off 15 s doubling to at most 15 minutes; a refusal the census cannot explain
  backs off 1, 2 minutes, and the third in a row is an honest `BLOCKED (UNREGISTERED)`. `INTEGRITY` keeps only the
  SQLSTATE class and backs off 5 minutes doubling to at most 24 hours. All keep the request `SCHEDULED` and are counted by
  the existing stuck-deletion signal (`0132`). No outcome keeps an account id, a SQLSTATE beyond its class or any text.
- **The narrowed guards.** Twenty Matching / Introductions DELETE guards keep their bodies byte for byte after one prefix
  (the `0130` pattern, its own GUC `qandeel.account_erasure` and its own authorization table). The migration proves it
  about itself and `verify-0164` A02 re-proves it against every prior defining migration.
- **The counterpart's retained view (P-2).** `introduction_retained_views` / `introduction_retained_view_items`: B's own
  episode, the proposal identity B already held, and exactly the items of B's frozen entitlement that are B's own human
  words. Four readers are replaced forward (the Introduction branch of the closed resolver, the history reader, the list
  — `ENDED`, no name — and the live read — one `ENDED` row). Everything else of A's World goes: A's words, A's name, every
  disclosure and photo both ways (each names A as owner or as its only audience), SUCCESS approvals, entitlements, the
  Match, the Record. The World row and B's episode stay; when nobody is left, the World goes too.
- **The counterpart's continuity (CW2-06).** `matching_counterpart_erasure_releases` freezes B's exact gate 7a–7c proof;
  the `0117` core is replaced forward (gate 7a accepts the release of the exact anchor; the write goes to
  `matching_counterpart_erasure_reactivation_commands`; both idempotency passes read both relations; everything else
  byte-identical, CW2-08 LAST). A B who had already reactivated keeps the audit, moved with the same identities.
- **Recovery (P-3).** `rearm_blocked_account_deletions_v1`: a `BLOCKED` request whose classes are all covered by a module,
  or that never recorded one (a legacy `0130` `BLOCKED`), is re-judged; a clean one is `SCHEDULED` with `final_at = now +
  7 days`, cancellable by its owner exactly as today. No class is covered yet, so nothing is re-armed until
  `ACCT-DEL-02` / Stage 7 cover their class in the same change as their module.
- **Photos at two levels (P-3).** Level 1 (`ERASED`): every rendition is gone, so every byte read is refused at once
  (`authorize_my_introduction_media_v1` re-authorizes from the rows). Level 2 (`media_erased_at`): the request's tracked
  keys leave `media_pending` only when the `0162` worker deletes their queue rows, which it does only after DELETE and
  HEAD 404; the last one sets `media_erased_at`. `COMPLETED` = the account and the provider account; "fully erased" =
  `COMPLETED` + `media_erased_at`.
- **Coverage registry and release gate (P-1).** `coverage_registry` names 180 relations (every relation that references
  the account, every module relation, and every relation that references one); `residue_class_coverage` names the four
  residue classes, all uncovered, with their owners (`ACCT-DEL-02`, Stage 7, and `UNREGISTERED` refused by CI).
  `server_read_account_erasure_coverage_v1` lets a release-readiness check read that truth.
- **Indexes (the Data API bound).** The 14 account columns of covered relations that had no leading index now have one:
  the final `DELETE` of the account row checks every `RESTRICT` reference to it.

### 2.2 API

- `PrivacyMaintenanceRepository.erase` calls `server_erase_account_v1` under its own 60 s bound
  (`ACCOUNT_ERASURE_TIMEOUT_MS`); every other server call keeps the 5 s default (`SupabaseServiceRoleApiService.rpc`
  gained an optional bound). No API path calls `server_erase_personal_account_v1` any more.
- `PrivacyMaintenanceWorker` maps `RETRY` to `retry_expected` (a backoff the database already applied) and `INTEGRITY` to
  `integrity_failure`; `BLOCKED` stays `blocked_expected`. Its cycle is otherwise unchanged.
- `AccountErasureRecoveryWorker` (new, every 5 minutes, enabled exactly where the Privacy & Data pass is): the re-arm, and
  the erasure's aggregate state as numbers (`ACCOUNT_ERASURE` domain: `BLOCKED` by class, `retrying`, `integrity_holding`,
  `media_pending` with its oldest age, `uncovered_classes`). Content-free and fail-soft.

### 2.3 Mobile and copy

**No mobile source change and no new copy were needed — proven, not assumed** (§4). The retained World is listed under
the ended Worlds with the approved IW-11b «تعارف»; it opens its closed record under IW-31 with the reader's own words;
the reader deletes them with the existing owner deletion; no composer, END or sharing action appears, and nothing says
the World is unavailable. The existing `deleteBlocked` copy stays truthful for an uncovered footprint; a re-armed request
shows the existing `deleteScheduled` copy with its new date.

## 3. Atomicity, locks and the Data API bound

- **No partial erasure on `BLOCKED`** — `verify-0164` E03: a planted unregistered `RESTRICT` reference makes `0130` refuse
  *after* the module ran; an exact content fingerprint of every covered and Personal relation, the account row, the photo
  queue and the authorization table is identical before and after, the Introduction is still `ACTIVE` (A's END rolled
  back too), and the request is `SCHEDULED` under a backoff. Three in a row answer `BLOCKED (UNREGISTERED)`.
- **No deadlock** — eight races on two real connections (G01–G08): B's message, B's END and B's reactivation in both
  orders against the erasure; both humans erased at once; the owner's cancellation; a held Matching lock answered by
  `lock_timeout` as `RETRY` with nothing touched. Every race has one answer per side and no `40P01`.
- **Third parties** — E01: a proposal between B and a third human that A's Match cancelled keeps its state and every
  transition; only the private link from A's Match is gone; the third human's every row is unchanged.
- **The bound** — the maximum footprint (E01) erases in **198 ms** locally against the 60 s bound. 56 of the 116 account
  columns had no leading index; the 14 in covered relations are indexed by `0164`. The other 42 (Personal, Public, Shared
  `STANDARD`) are other owners' relations: at production scale each is a scan inside the final `DELETE`, recorded for
  `HOSTED-DEPLOY-01` (`QAN-BL-PROD-06`), together with the hosted `statement_timeout` of `service_role`. Splitting the
  erasure over several transactions is refused: it would commit a partial erasure.

## 4. Verification (local: real PostgreSQL 17.10)

| Proof | Result |
|---|---|
| `verify-migration-0164` (A01–A08, E01–E13, G01–G08) | 29 / 29 |
| Re-anchored: `verify-0122`, `verify-0149` (incl. new probes f12 / f13), `verify-0161` | 23 / 23, 30 / 30, 20 / 20 |
| Every affected verifier on a fresh database with `0164`: `0087`–`0090`, `0108`–`0122`, `0130`, `0132`, `0149`–`0164` (37) | all pass |
| Static contracts: every `tests/*.test.mjs` except the forward-safety mirror (CI runs it) | 1 402 / 1 402 (the Expo dependency leg passed on its re-run; it is the known intermittent `QAN-BL-CI-02`, and no dependency changed) |
| `tests/acct-del-01-account-erasure-contract.test.mjs` (four detectors, 11 planted defects each refused) | 12 / 12 |
| API: the whole Jest suite, incl. `account-erasure.spec.ts` (11) and `introduction-world.retained-view.spec.ts` (4); `nest build` | 257 suites, 6 013 / 6 013; build clean |
| Mobile: `retained-view.test.tsx` (Arabic and English); `tsc --noEmit`; ESLint on the new file | 4 / 4; clean; clean |

`verify-migration-0130` once failed locally at one export assertion ("available for a limited period (7 days)"), on a
baseline database without `0164` as well; it passed in the full run above. A local clock artefact, unrelated.

## 5. Contracts and verifiers re-anchored (only where ACCT-DEL-01 changes their truth)

| File | Why |
|---|---|
| `database/verify-migration-0149.mjs` | `NO_BACKDOOR` admits the one named `service_role` system exception; probes f12 / f13 refuse a second wrapper and a client grant |
| `database/verify-migration-0122.mjs` | the erasure census names the governed account erasure, which deletes disclosures whole and never erases a verifier in place |
| `database/verify-migration-0161.mjs` | the closed resolver, the list and the live read are now defined by `0164` (byte-for-byte pins kept) |
| `apps/api/src/account/privacy-data.spec.ts` | the pass's RPC is the governed account erasure under its own bound |
| `apps/api/src/observability/observability.spec.ts` | the finite telemetry relation's deliberate widening (`retry_expected`; `ACCOUNT_ERASURE`) |
| `tests/sec-match-00-matching-direct-rpc-protection-contract.test.mjs` | the `QAN-BL-ACCT-01` index row, re-owned in the same change, as that item required |
| `tests/w3-mega-s-personal-controls-settings-contract.test.mjs` | the same row: `QAN-BL-ACCT-01` stays an open blocker, now owned by `ACCT-DEL-01` (never tombstoned by assignment) |
| `tests/s5-01-…`, `s5-02-…`, `s5-03a-…`, `s5-03b-…`, `s5-03c-…` contracts | the same row, in each one's governance check (still open, now owned) |
| `tests/s5-03b-…`, `s5-03c-…` contracts | the Project Map's current-task line: S6-06 merged, ACCT-DEL-01 is the current task (the pattern every task since S6-01 re-anchored) |

The `verify-0149` re-anchor keeps the census expression the S6-02 / S6-04 / S6-05 contracts pin byte for byte: the one
`service_role` system exception is held apart and proven by its own assertions, so those three contracts are unchanged.

## 6. Deliberately not in CP1, and owned

- **CP2 (this PR, after the Product Owner's CP1 approval):** the closure — this record's final state, `QAN-BL-ACCT-01`'s
  narrowed disposition (Shared `STANDARD` + Public to `ACCT-DEL-02`, Replay to Stage 7), the dated notes on
  `QAN-BL-MATCH-01` (its `ACCT-DEL-01` dependency met), `QAN-BL-PROD-06` and `QAN-BL-PROD-08`, and the locators.
- **`ACCT-DEL-02`:** Shared `STANDARD` (post-SUCCESS Worlds included) and Public deletion, with their own Product decisions.
- **Stage 7:** Replay's erasure module, registered in the coverage registry from its first relation.
- **Stage 9 / `HOSTED-DEPLOY-01`:** the release gate is enforced in CI and governance (`server_read_account_erasure_coverage_v1`,
  the coverage census, `QAN-BL-ACCT-01` open) — not as a runtime block on the Shared launch capability, which six
  existing verifiers enable and which has no notion of an environment. A production launch reads the coverage truth;
  the hosted `statement_timeout` and the 42 unindexed columns are measured there.
- **S6-07:** enrollment and the MATCH-06 producer register every new relation in the coverage registry (CI refuses
  otherwise); PRIV-04 exports the retained view.
- **Not changed:** `0130`, every foreign key, every seam, CW2-08, the six suspended commands, mobile, copy.

**Locators.** Current State's register mirror is recounted from backlog §4 in this change. It had not been updated for
`QAN-BL-MATCH-06` (S6-05 CP2), `QAN-BL-PROD-08` (S6-06 CP1) or `QAN-BL-LAUNCH-05` (S6-06's closing change), and its counts
had stopped at 71. Their open rows are added exactly as the backlog states them, with a dated note saying so. Nothing in
the backlog itself changes for them.

## 7. Final status (CP1)

To be completed with the exact-head CI results when CP1 is pushed.
