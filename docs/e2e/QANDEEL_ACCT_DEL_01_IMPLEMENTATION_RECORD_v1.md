# QANDEEL — ACCT-DEL-01 Implementation Record v1

**Task:** ACCT-DEL-01 — Account Deletion Across Matching / Introductions  
**Owned:** `QAN-BL-ACCT-01` (re-owned by CP1 from `OPEN — UNASSIGNED` to `DEFERRED — OWNED`; at this closure re-owned to
`ACCT-DEL-02`, still open, P-1; §8). ACCT-DEL-01 owns no open item from its merge.  
**Product authority:** the Product Owner's approval (2026-10-17) of the ACCT-DEL-01 WP0 report v1, its review addendum
v1.1 and decisions P-1 … P-4, with the final review notes («ACCT-DEL-01 — Final Implementation Authorization»). W3-PDG-01
§8 (Delete Account), CW2-06 and CW2-03 §37 as cited. No merge or deployment without the Product Owner's explicit «ادمج».  
**Status:** **ACCT-DEL-01 CLOSED / READY FOR PRODUCT OWNER REVIEW AND MERGE DECISION — CP1 APPROVED, CP2 (CLOSURE)
DELIVERED — NOT MERGED / NOT DEPLOYED** (CP1 2026-10-17, approved by the Product Owner on its exact head `90681312`, API CI
and Mobile CI green; CP2, this closure, 2026-10-17). *Until CP2: "CP1 DELIVERED — AWAITING THE PRODUCT OWNER'S CP1 REVIEW —
CP2 (CLOSURE) NOT STARTED — NOT MERGED / NOT DEPLOYED".* Matching / Introductions account deletion is handled; account
deletion in QANDEEL as a whole is **not** closed (§8).  
**Pull request:** [#345](https://github.com/allamqandeel/qandeel/pull/345) (draft; merging needs the Product Owner's
explicit «ادمج»).  
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
  `HOSTED-DEPLOY-01` (`QAN-BL-PROD-09`, admitted at CP2; §8), together with the hosted `statement_timeout` of `service_role`. Splitting the
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
  *Delivered: §8.*
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

CP1 was pushed as four commits on `4233c067` to [PR #345](https://github.com/allamqandeel/qandeel/pull/345). Its exact
head is `906813121683960fda4baaf08be1a39c3c6fc438`.

| Required check on `90681312` | Run | Result |
|---|---|---|
| API CI: `verify-api` (contracts, every migration verifier on real PostgreSQL, `verify-migration-0164` and the ACCT-DEL-01 static contract included, the API build and Jest), Change-aware plan, Validation evidence (VAL-01) | [`39030890618`](https://github.com/allamqandeel/qandeel/actions/runs/39030890618) | success |
| Mobile CI: fast mobile contract gate, Android Release APK and API 36 emulator boot smoke, iOS Release simulator app and iPhone 17 / iOS 26.5 boot smoke, Change-aware plan, Validation evidence (VAL-01) | [`39030890572`](https://github.com/allamqandeel/qandeel/actions/runs/39030890572) | success |

The Product Owner verified both runs on GitHub independently and **approved CP1** on that head («ACCT-DEL-01 — CP1
Approved / Start CP2», 2026-10-17), authorizing CP2 in the same pull request.

## 8. Closure (CP2) — BG-08 / BG-09

CP2 is documentation and governance only, under the Product Owner's checkpoint rule (no separate documentation task or
pull request). It changes no migration, API, mobile or test behaviour. Its only test edits re-anchor the
`QAN-BL-ACCT-01` index-row pins to the item's new owner, the change the re-owning makes true.

### 8.1 What ACCT-DEL-01 resolved

**Account deletion across Matching / Introductions** is handled in the repository:
- the governed erasure takes an account's whole Matching / Introductions footprint, the Introduction World's own
  dependencies included, together with the unchanged `0130` Personal erasure, in one transaction or nothing;
- the counterpart keeps their own words, read and deletable (§2.1), an ordinary END and an exact Matching lineage;
- an uncovered footprint answers a truthful, recorded `BLOCKED` and is re-armed with a fresh grace when covered;
- photos are erased at two levels.

The proof is §3 and §4, and both CI runs in §7 are green on the exact head. Nothing is deployed: the hosted database
stops at `0074`.

### 8.2 What stays open (P-1)

| Residue | Owner | Register |
|---|---|---|
| Shared `STANDARD` Worlds (post-SUCCESS Introduction Worlds included) and the Public World | `ACCT-DEL-02 — Account Deletion Across Shared STANDARD / Public` (future; not opened) | `QAN-BL-ACCT-01`, **re-owned, still open** |
| Replay | `Stage 7 — Replay` | `QAN-BL-ACCT-02`, **admitted** |
| The release gate: no World opens in production without an automated account-deletion coverage check on the hosted project; the erasure's hosted bound (the `service_role` `statement_timeout`, the 42 unindexed account columns) | `HOSTED-DEPLOY-01` (a mandatory condition) | `QAN-BL-PROD-09`, **admitted** |

`ACCT-DEL-02` and Stage 7 are not started, and nothing of theirs is implemented here. Each one covers its class in
`account_erasure_private.residue_class_coverage` in the same change as its module. Until then, every footprint of that
class answers `BLOCKED (SHARED_STANDARD | PUBLIC | REPLAY)` and nothing is erased.

**The coverage check is not a deployment block.** The coverage census in CI and `server_read_account_erasure_coverage_v1`
make the repository's coverage truth checkable. Neither one stops a deployment or a launch capability by itself, and
this record does not claim otherwise. `QAN-BL-PROD-09` owns the executable check on the hosted project.

**Account deletion in QANDEEL as a whole is not closed.**

### 8.3 S6-07's dependency

`QAN-BL-MATCH-01`'s mandatory `ACCT-DEL-01` dependency (the Stage 6 WP0 final decision addendum, D3) is **met in
engineering** from this pull request's merge: an enrollment path would no longer commit a footprint without a governed
deletion. That changes no gate:
- the six `0149` commands stay executable by no application role until S6-07's own Task Contract and the Product Owner
  approve the launch path (`NO_BACKDOOR`);
- CW2-08 and every launch gate stay closed;
- S6-07 is not started.

S6-07 registers every new relation it adds in the coverage registry (CI refuses otherwise), and `QAN-BL-PRIV-04`
exports the retained view.

### 8.4 BG-08 reconciliation

| Item | Disposition |
|---|---|
| `QAN-BL-ACCT-01` (inherited) | **Re-owned**, not tombstoned: the Matching / Introductions part delivered; Shared `STANDARD` and Public to `ACCT-DEL-02`; Replay split to `QAN-BL-ACCT-02` (BG-02: one owner per item). Index-row pins re-anchored in the same change |
| `QAN-BL-ACCT-02` | **Admitted** (`HIGH`, `DEFERRED — OWNED`, owner `Stage 7 — Replay`) at the Product Owner's P-1 |
| `QAN-BL-PROD-09` | **Admitted** (`HIGH`, `DEFERRED — OWNED`, owner `HOSTED-DEPLOY-01`) at the Product Owner's CP1-approval direction |
| `QAN-BL-MATCH-01` | Dated note: the dependency is met in engineering; owner `S6-07`, severity and status unchanged |
| `QAN-BL-PROD-06` | Dated note: the four new `service_role` entry points let no deterministic `40001` escape (`verify-migration-0150`'s cross-schema guard) |
| `QAN-BL-PROD-08` | Dated note: the erasure's second photo level (`media_erased_at`) waits on the hosted object store |
| `QAN-BL-PRIV-04` | Dated note: the retained view and the released lineage join the export footprint |
| Every other item | Untouched |

Register: **74 items; 37 / 4 / 9 / 24 by status, 42 / 30 / 2 by severity**, recounted mechanically from backlog §4.
ACCT-DEL-01 owns no open item from its merge.

**Contracts re-anchored at CP2** (only the owner field of the `QAN-BL-ACCT-01` row, which CP1 had pinned to
`ACCT-DEL-01`):
- `tests/sec-match-00-…`, `w3-mega-s-…`, `s5-01-…`, `s5-02-…`, `s5-03a-…` and `s5-03b-…` (the s5-03c pin reads the status
  only);
- `tests/acct-del-01-account-erasure-contract.test.mjs`. It now also pins `QAN-BL-ACCT-02` with Stage 7 and
  `QAN-BL-PROD-09` with `HOSTED-DEPLOY-01`, each still open, and refuses two more planted defects (Replay deletion handed
  to no one; the release gate closed): 14 tests.

### 8.5 BG-09 and the locators

- **This record:** from its CP1 banner to `CLOSED / READY FOR PRODUCT OWNER REVIEW AND MERGE DECISION`, in this change.
- **Locators updated in the same change:**
  - [`QANDEEL_CURRENT_STATE.md`](../../QANDEEL_CURRENT_STATE.md): the lifecycle row, the register mirror, the D-17 note,
    the sequencing and the owner rows;
  - [`QANDEEL_PROJECT_MAP.md`](../../QANDEEL_PROJECT_MAP.md);
  - [`QANDEEL_PRODUCT_ROADMAP.md`](../../QANDEEL_PRODUCT_ROADMAP.md) §6.18.
- **`I-07`** stays `CLOSED / FROZEN`. At CP2, §49's text is unchanged; only its lifecycle line moves to the closure.
- [`database/README.md`](../../database/README.md): ACCT-DEL-01's residue owners and a deployment paragraph
  (`QAN-BL-PROD-09`).

**Verification at CP2:** the documentation and governance contracts affected by these edits, run locally; CP1's
PostgreSQL and mobile proofs were not repeated (no behaviour changed). The mandatory CI runs on the final head.

**Not done, by instruction:** no merge, no deployment, no gate opened, S6-07 not started, CP1's code not reopened.

## 9. CI infrastructure correction (same pull request)

API CI failed twice on CP2's head `d30bd4e8`, in run [`39040365464`](https://github.com/allamqandeel/qandeel/actions/runs/39040365464), attempts 1 and 2. Both attempts
stopped at "Initialize containers": Amazon ECR Public refused the pinned `postgres:17` service image with
`toomanyrequests: Data limit exceeded` (three pull attempts in attempt 2). No test started, and nothing in ACCT-DEL-01 failed.
Mobile CI ([`39040365472`](https://github.com/allamqandeel/qandeel/actions/runs/39040365472)) passed on the same head.

The Product Owner reviewed the logs independently and authorized a limited, durable correction in this pull request
(«PR #345 — CI Infrastructure Correction Only»). It changes `.github/workflows/api-ci.yml` (job `verify-api` only):

- **No service containers.** PostgreSQL and Redis are no longer pulled from any image registry. Docker Hub's anonymous
  pull limit refused them earlier, and now ECR Public's anonymous data quota has too.
- **Official signed apt repositories, exact versions.** The versions are the ones the images carried:

  | Server | Package | Repository | Signing key (fingerprint pinned) |
  |---|---|---|---|
  | PostgreSQL 17.11 | `postgresql-17=17.11-1.pgdg24.04+2` | the PostgreSQL project's PGDG, suite `noble-pgdg-archive` (keeps every published build, so the pin does not disappear at the next minor) | `B97B0AFC AA1A47F0 44F244A0 7FCC7D46 ACCC4CF8` |
  | Redis 7.4.11 | `redis-server=6:7.4.11-1rl1~noble1` | Redis Ltd.'s `packages.redis.io`, suite `noble` | `54318FA4 052D1E61 A6B6F7BB 5F4349D6 BF53AA0C` |

  A key file is refused unless it holds exactly one primary key and that key is the pinned one. apt then refuses any
  index or package that key did not sign; no signature check is waived. The installed versions are re-read from `dpkg`
  and must equal the pins.
- **The runner is pinned to `ubuntu-24.04`,** the release those packages are built for, instead of `ubuntu-latest`.
- **Started explicitly, checked before any test.** No packaged cluster or service is started. One step starts both
  servers itself:
  - PostgreSQL is initialized as the official image did: superuser `postgres` with the same password, UTF8 with
    `en_US.UTF-8`, UTC, `trust` on the local socket, `scram-sha-256` over TCP.
  - The step creates the database `DATABASE_URL` names.
  - Before the first test it proves three things: each server answers at `DATABASE_URL` / `REDIS_URL`, PostgreSQL
    reports the installed 17.x and Redis the installed 7.4.x, and ports 5432 and 6379 were free beforehand.

  Each failure carries its own `::error` message naming the cause, and prints the server log where there is one.
- **Unchanged:** `DATABASE_URL`, `REDIS_URL`, `PGPASSWORD`, the database name, the roles the bootstrap creates, and
  every test step, in its order.
- **Deliberately not used:** PostgreSQL 16, image pulls with repeated retries, images of unknown origin. apt's own
  transport retry (`Acquire::Retries=3`) covers a dropped connection; it is not a registry quota workaround.

**Contract re-anchored (required by this change, narrowest form):** `tests/toolchain.test.mjs` pinned the two ECR
Public image digests.
- **What it pins now:** the same truth (PostgreSQL 17 and Redis 7 at exact, verified versions) in the new form: no
  `services`, `ubuntu-24.04`, the exact package pins, the two key fingerprints, `signed-by` on both sources, no waived
  signature check, the version and readiness checks, and `DATABASE_URL` / `REDIS_URL` unchanged.
- **Why it changed:** the commented reason is in the test.

**Not changed:** migration `0164`, the API, mobile and every product contract. The focused database gate
(`focused-database-verification.yml`, manual dispatch, not a required check) keeps its own image.

**Verification:**
- Locally, every contract that reads `api-ci.yml` passed, 1945 / 1945. In the first parallel run the forward-safety
  contract failed once; it then passed alone (35 / 35) and in the rerun.
- The key and fingerprint logic was exercised against both real keys and against a wrong key and a two-key file, both
  refused. The PGDG archive and Redis `InRelease` files verified against the pinned keys.
- The binding proof is API CI on this pull request's new head.

## 10. CI-iOS correction (same pull request)

**The failure.** On the §9 head `5a3afe76` everything else passed in run
[`39047797516`](https://github.com/allamqandeel/qandeel/actions/runs/39047797516): API CI, the Android build and emulator
smoke, and the iOS Release build. The iOS boot smoke (job `117445673117`) failed inside Maestro / XCTest, and the
Validation evidence job failed only because of it. The Product Owner reviewed the logs independently and authorized a
limited correction in this pull request («ACCT-DEL-01 — CI-iOS Correction / PR #345»).

**The proven cause.** The readiness probe and the smoke talked to **two different XCTest runners**, at the same time.

| | Readiness probe (`maestro hierarchy`) | Boot smoke (`maestro test`) |
|---|---|---|
| Driver port | `22087` | `51962` |
| Runner | pid 11920, `xcodebuild` 7888 | pid 17221, a second cold launch at 16:39:26 |
| `POST /deviceInfo` | 16:38:42, answered in 0.8 s; `/viewHierarchy` followed | 16:40:24: SpringBoard lookup took 13.6 s, then retries 1 and 2; driver handler bound (100 s) answered **500** at 16:42:23 |
| Lifetime | alive until 16:42:40, when its `testHttpServer` failed | — |

- **Why the ports differed:** in Maestro cli-2.10.0, `hierarchy` serves the driver on `defaultXcTestPort` 22087
  (`MaestroSessionManager`). `test` without `--driver-host-port` takes an OS-chosen free port
  (`TestCommand.selectPort`, `ServerSocket(0)`). Its status check therefore never found the probe's driver, and
  `startXCTestRunner` launched another. S6-01 CI-R2's premise, "the smoke reuses the driver the probe proved alive",
  never held. Every run since then launched two runners; most survived the overlap, this one did not.
- **So `hierarchy` passing proved nothing about the smoke's `/deviceInfo`:** each ran against a different runner.
  `hierarchy` itself sends `/deviceInfo` too, and on the first runner it succeeded.
- **Why it took 780 s:** Maestro's CLI main thread died of the uncaught `UnknownFailure` at 16:42:31. The JVM did not
  exit, so `bounded-run` ended it only at its 780 s bound (exit 124).
- **No Product failure:** no QANDEEL step or app assertion ran.

**The correction.**

| Part | Change |
|---|---|
| A — true readiness | `verify-ios` pins `MAESTRO_IOS_DRIVER_PORT=22087`, and the smoke passes `--driver-host-port` with it. `test` then finds the probe's driver alive and reuses it (`startXCTestRunner`: "UI Test runner already running"), so no second runner launches. After `hierarchy`, readiness checks **that port**: `GET /status`, then the smoke's own first request, `POST /deviceInfo` with `{}`, bounded at 110 s around the driver's 100 s handler, accepted only if a DeviceInfo comes back. Any failure gets the existing ONE clean recovery, then one more probe. A second failure stays red. |
| B — fail-fast | `scripts/validation/bounded-run.mjs` gains an opt-in `--fail-fast <signature>` that names one entry of a closed set. The only entry is `maestro-xctest-device-info-500`: Maestro's `Exception in thread "main" UnknownFailure(... http://127.0.0.1:<port>/deviceInfo failed, code: 500` followed within 20 lines by the `xcuitest.XCTestDriverClient.deviceInfo` frame. On it, the runner classifies INFRASTRUCTURE, writes the evidence file, sends SIGTERM to the whole process group, then SIGKILLs any survivor, and exits **125**, never 0. Any other 500, driver route or app assertion is untouched. |
| Evidence | `ios-driver-diagnostics.sh` (read-only) also lists the live runner launches and the driver ports they listen on. |

**C — no cosmetic success:**
- no `continue-on-error`, and no smoke retry;
- the app's assertions and the flow are unchanged;
- no bound is raised: 480 s / 780 s / 22 and 15 minutes stay as they were;
- Maestro 2.10.0, Xcode 26.6, iPhone 17 / iOS 26.5 and the retry budget are unchanged;
- without `--fail-fast` the runner's streams and behaviour are byte-for-byte the original, and Android and every other
  bounded command are not armed.

**Tests** (VAL-01 contract, additive; test 13 unchanged). One gap: the process-group kill is exercised on the Linux
runners; locally (Windows) only the direct child can be killed.
- **13b:** the signature matches run `39047797516`'s exact transcript and nothing else: an app or API 500, another
  driver route or status, a non-loopback host, header or frame alone, a frame beyond the window, an app assertion.
  The set is closed.
- **13c:**
  - the normal path forwards output and passes the command's own status through;
  - an app failure keeps its own status;
  - on the signature with a SIGTERM-ignoring grandchild, the run ends in seconds with 125 and INFRASTRUCTURE, and the
    grandchild is killed;
  - a signature followed by exit 0 is still 125;
  - an unrelated 500 followed by a hang still ends at the bound with 124.

  A planted disarmed scanner makes 13c fail (it ends at the 60 s bound with 124), so the test is not vacuous.
- **13d:** the workflow structure:
  - one port, `/status` and `POST /deviceInfo` on it, both gating readiness;
  - exactly one recovery and no loop;
  - the smoke's exact line;
  - no `continue-on-error` anywhere;
  - Android's lines verbatim;
  - `--fail-fast` only in `verify-ios`.

**Rebuild, by contract.** `.github/workflows/` and `scripts/validation/` are native-fingerprint inputs by design
(QAN-INF-04: a workflow is the build recipe), so this head rebuilds the APK and the `.app` under the usual identity
and provenance checks. Nothing is bypassed to save time.

**Not changed:** migration `0164`, the API, mobile Product code, the ACCT-DEL-01 erasure, the closure records of closed
phases, the CI gates and their success conditions.

**Remaining risk:**
- `test --driver-host-port` first asks the JVM whether the port is free (`isPortAvailable`, an IPv6-wildcard bind)
  while the probe's driver listens on IPv4 `127.0.0.1`. By Maestro's own note on that probe (`SocketUtils.getFreePort`)
  and BSD bind rules, it answers "free". If it ever did not, the smoke would stop within seconds with Maestro's
  `Requested driver host port … is not available`: red, never hung.
- Reusing one runner for both commands is new to this workflow; this pull request's CI is its first proof.
