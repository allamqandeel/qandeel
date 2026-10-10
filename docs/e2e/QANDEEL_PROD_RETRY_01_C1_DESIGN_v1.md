# PROD-RETRY-01 / C1 — Data API Retry Hazard: Final Design, Coverage & Safety Contract

**Phase:** C1 — DESIGN · **Status:** `C1 ACCEPTED WITH CORRECTIONS — C2 AUTHORIZED` (Product Owner, 2026-10-10) · **Backlog:** `QAN-BL-PROD-06` (HIGH, launch/deployment gate)
**Implementation:** [PROD-RETRY-01 implementation record](QANDEEL_PROD_RETRY_01_DATA_API_STALE_STATE_IMPLEMENTATION_RECORD_v1.md) (C2, migration `0150`).
**Baseline:** `origin/main` = `e07857bab47f500a035e265b0eefc4b0bb65bd34` (PR #323 merge), migrations `0001`–`0149`.
**Evidence base:** two disposable local PostgreSQL databases built from that baseline (bootstrap + 149 migrations):
`qandeel_c2r` (CI-shaped) and `qandeel_c2rh` (hosted-shaped default privileges). Catalog reads only; no application rows.
Nothing was committed, no migration or runtime file was written, no CI was run, the hosted project was not contacted.

> **This is the design the Product Owner reviewed at the C1 gate, kept as it was decided, with the two corrections below.**
> It is evidence and design, not a runtime contract: the frozen records and their controlled forward amendments are.
> It contains no secret, credential, user row or hosted project identifier.

### C1 decision and corrections (2026-10-10)

The Product Owner accepted C1 with corrections and authorized C2: D1–D6 accepted in principle, option S for the
Hypothesis batch catcher, D7 accepted as a `LOW` deferred item that does not block launch (after an anti-duplication
check, with a named owner), D8 under the contract in §10 with the conditions below.

1. **The HTTP status DOES change (correction to §0 D5 and §6).** PostgREST answers SQLSTATE `40001` with **HTTP 500**
   (class `40`, "transaction rollback") on v16+, and before v16 it does not answer a deterministic `40001` at all. It
   answers `PT409` with **HTTP 409** on every line. So every direct Data API caller of the twelve entry points sees
   **409 {code PT409}** where it saw **500 {code 40001}** (v16+) or **no answer** (before v16). The message, DETAIL and
   HINT are unchanged. What does NOT change is the API's own answer to its clients: the three API seams that read these
   refusals recognise (code, exact message) and accept both codes; the Hypothesis refusals reach no API route; no API
   consumer of the twelve branches on the HTTP status. The C2 implementation record §5 is the full consumer audit, and the
   live wire proof asserts the exact answer on all four PostgREST lines.
2. **One classification refined by the C2 guard (§2.4).** `commit_own_public_experience_ready_v1` absorbs its stale
   refusal on its main path, but its idempotent-replay branch calls the core OUTSIDE the classifying handler (C0 had
   called it "partially wrapped"). That branch is entered only when the exact command is already committed, and the core
   answers a committed command (`ALREADY_COMMITTED` or `23505`) before any stale comparison: the 40001 is unreachable
   there. No function had to change; the guard proves this structurally and live (implementation record §4).

---

## 0. Decisions requested at this gate

| # | Decision | Recommendation |
|---|---|---|
| D1 | Adopt the change set in §3 (12 function bodies: 11 raisers, 23 raise sites `40001 → PT409`, plus 1 catcher extended) | **Approve** |
| D2 | Hypothesis family: swap at the source cores + extend the batch catcher (§4.2 option S) rather than translate in the wrappers (option T) | **S** |
| D3 | Leave the 2 race-converging entries and every unreachable/absorbed site on `40001`, enforced by a fail-closed catalog guard (§8 L5) | **Approve** |
| D4 | `40P01`: no conversion (§4.5) | **Approve** |
| D5 | API keeps the client-visible HTTP contract unchanged; only exact-identity recognisers accept `PT409` in addition to `40001` (§6) | **Approve** |
| D6 | Backlog: amend `QAN-BL-PROD-06`'s scope (add Shared ID rotation; correct the batch / generation rows) in the C2 closing change (BG-08) | **Approve** |
| D7 | Admit one LOW residue at C2 closure: "post-v16 retry semantics for race-converging and genuine-deadlock paths" (§4.5, §11) | PO choice |
| D8 | Approve C2 (implementation + one exact-head CI cycle) under the contract in §10 | PO choice |

---

## 1. Repo truth, anti-dup and new contradictions

**Repo truth (re-verified at C1 start, `git fetch` 2026-10-10):** `origin/main` head is still `e07857b`; the last
migration is `0149`; no `0150` exists in the tree. No branch, PR or migration addresses `PT409`, `40001` retry or
`PROD-06` (PR list through #323 checked; remote branches checked). The local checkout is on the merged SEC-MATCH-00
branch and is clean apart from pre-existing untracked report directories.

**Contradictions found (none blocks the design; each has an owner):**

1. **C0 counts, corrected.**
   - The strict count is **51** raising functions and **101** raise sites. It counts RAISE statements only.
   - C0's "52" counted `execute_post_response_hypothesis_update_batch_v1_core` as a raiser, but its `40001` appears
     only in a `WHEN SQLSTATE '40001'` handler. It is a catcher, not a raiser.
   - All 51 raisers are in `public`. The private schemas (`shared_private`, `understanding_private`,
     `public_authoring_private`, `public_discussion_private`, `shared_semantic_private`, `account_private`) only *call*
     them, which is why a `public`-only census misses their entry points.
2. **C0 classification, corrected (12 / 5 / 7 becomes 12 / 4 / 8).**
   - `commit_own_public_experience_ready_v1` is **absorbed**, not race-only. Its only raising call sits inside a
     `WHEN OTHERS` block, and `classify_public_refusal_v1` maps `PUBLIC_EXPERIENCE_STALE` to `'STALE'`.
   - Two of the remaining "race-only" entries are in fact **guarded / unreachable**, as §2 explains:
     `record_understanding_disagreement_v1` and `persist_post_response_hypothesis_generation_v1`.
3. **`QAN-BL-PROD-06` scope drift** (backlog lines 1171–1225).
   - It omits the Shared ID rotation (`rotate_own_sealed_shared_id_v1`, a deterministic path any signed-in account can
     call).
   - It lists `persist_post_response_hypothesis_generation_v1` and `execute_post_response_hypothesis_update_batch_v1`
     as hazards. The first cannot reach its stale raise. The second absorbs it, although its catcher **is** on the
     change path (§4.2).
   - Disposition: amended in the C2 closing change (D6).
4. **`QANDEEL_CURRENT_STATE.md` is stale on main.** Lines 104, 140 and 168 still describe SEC-MATCH-00 as "not merged /
   READY FOR PO MERGE DECISION", but it merged as `e07857b`. This is not PROD-RETRY-01's scope; it should be
   reconciled by the next state-touching closure. Recommendation: the C2 closing change, since it edits the same
   register.
5. **Risk report (`docs/e2e/QANDEEL_SEC_MATCH_00_40001_RETRY_HAZARD_RISK_REPORT_v1.md`).** It surveyed `public` only,
   so it predates findings 1–3. It is historical evidence and is not edited; this design supersedes its counts.

---

## 2. Final Impact Matrix — all 24 Data API entry points

An **entry point** is a function in `public` that `anon`, `authenticated` or `service_role` can `EXECUTE`, and that can
reach a `40001` raise. Reachability is computed across every schema through schema-qualified calls and trigger writes.
The API reaches only `public`: it never sends `Accept-Profile` or `Content-Profile`.

The result is identical on both database shapes. Shape differences are limited to extra hosted-shaped grants: for
example, `apply_hypothesis_evidence_update` is also `service_role`-executable there.

**Hosted** = the defining migration is ≤ `0074`, the hosted schema position C1 metadata inferred in SEC-MATCH-00. It is
still unverified.

**How each class is defined** (PostgREST < v16 re-runs the whole transaction on `40001`):
- **DETERMINISTIC.** The expectation (version, epoch or id) is an RPC argument. A re-run sends the same argument
  against the same committed state, so it raises again, forever. The request is never answered and holds a pool
  connection.
- **RACE-CONVERGING.** The raise is reachable only through a transient race. A re-run reads fresh state and returns a
  normal answer.
- **GUARDED.** The raise is unreachable from this entry: the row is locked and pre-checked, or was created in the same
  transaction.
- **ABSORBED.** A handler on the path converts `40001` into a durable typed outcome; nothing propagates.

### 2.1 DETERMINISTIC — 12 (the change set)

| # | Entry point (role) | Def. | Hosted | Raiser (body line) · message | Why deterministic |
|---|---|---|---|---|---|
| 1 | `transition_hypothesis_v2` (auth) | 0036 | yes | `transition_hypothesis_core_v1` L17, L25 · `Stale hypothesis version.` | `p_expected_version` comes from the caller. The API reads the version and then calls, so two devices or a hostile client produce it. |
| 2 | `apply_hypothesis_evidence_update` (auth; +svc hosted-shaped) | 0032 | yes | `apply_hypothesis_evidence_update_core_v1` L17, L32 · same | Same as row 1. |
| 3 | `background_apply_hypothesis_evidence_update_v1` (svc) | 0032 | yes | same core | `p_expected_version` is an argument. API caller: `background-intelligence-data-api.service.ts:126`. It has no non-test caller in `apps/api/src` today, but is still executable. |
| 4 | `commit_finalized_exchange_with_full_semantic_chain_v1` (svc) | 0071 | yes | own body L72 `STALE_CONVERSATIONAL_FOCUS_CONTEXT`, L91 `STALE_THREAD_IDENTITY_CONTEXT` (both with DETAIL) | Focus clock and identity-version tokens come from the caller. This is the **core turn flow**. |
| 5 | `get_conversation_thread_identity_dossier_page_v1` (svc) | 0070 | yes | own body L15 `STALE_THREAD_IDENTITY_CONTEXT` (DETAIL) | `p_expected_world_thread_identity_version` is an argument. |
| 6 | `grant_shared_world_standing_context_v1` (auth) | 0078 | no | own body L74, L84 `STANDING_CONTEXT_STALE_STATE` | `p_expected_active_grant_id` is an argument. |
| 7 | `revoke_shared_world_standing_context_v1` (auth) | 0078 | no | own body L37, L43 · same | Same as row 6. |
| 8 | `pause_matching_participation_v1` (auth) | 0109 | no | own body L32, L47 `MATCHING_STALE_STATE` | `p_expected_current_event_id` is an argument. |
| 9 | `turn_off_matching_participation_v1` (auth) | 0109 | no | own body L32, L47 · same | Same as row 8. |
| 10 | `revoke_matching_context_v1` (auth) | 0109 | no | own body L34, L38 · same | `p_expected_active_grant_id` is an argument. |
| 11 | `revoke_pre_match_disclosure_authority_v1` (auth) | 0109 | no | own body L37, L42 · same | `p_expected_active_authority_id` is an argument. |
| 12 | **`rotate_own_sealed_shared_id_v1`** (auth) — **new in C0** | 0138 | no | → `shared_private.rotate_own_sealed_shared_id_v1` (0138) → `rotate_shared_world_invite_credential_v1` (0081) L67, L70, L98, L132 `SHARED_INVITE_CREDENTIAL_STALE_STATE` | `p_expected_epoch` is an argument. A double-tap or a two-device rotation hangs one request. **L132** (the first-setup race) is deterministic on re-run, because the re-run sees `has_state` and fails at L67. |

**Notes on the matrix:**
- Rows 6–11 have **no API or mobile caller**. They are still reachable by any signed-in account directly through
  `rest/v1/rpc/...` with its own JWT, so a stale argument is a user-triggerable way to exhaust connections. Matching
  and Standing Context are not yet launched, but the functions are executable.
- In rows 1, 2, 7–11 and 12, the second site in each pair sits after a `FOR UPDATE` lock, an equal check and a
  conditional `UPDATE ... WHERE <expected>`. It is unreachable in practice but carries the same contract, so both sites
  change together. A function must never answer one stale state with two codes.

### 2.2 RACE-CONVERGING — 2 (unchanged)

| Entry point (role) | Def. | Path | Why it converges |
|---|---|---|---|
| `start_own_public_experience_draft_v1` (auth) | 0143 | → `public_authoring_private.start_…` → `provision_own_public_identity_v1` → `ensure_public_identity_v1` L76 `PUBLIC_EXPERIENCE_STALE` | Only a concurrent *first* identity creation by the same user hits `public_identities_user_key`. A re-run takes the `FOUND` branch and returns `ALREADY_PRESENT`. |
| `post_own_public_discussion_v1` (auth) | 0147 | → `public_discussion_private.post_…` → same `ensure_public_identity_v1` L76 | Same as above. |

### 2.3 GUARDED (raise unreachable from this entry) — 2 (unchanged)

| Entry point (role) | Def. | Path | Why the core's `40001` cannot fire |
|---|---|---|---|
| `record_understanding_disagreement_v1` (auth) | 0127 / 0134 | → `understanding_private.record_…` → `transition_hypothesis_core_v1` | It locks the hypothesis `FOR UPDATE` (L17–19) and answers `'STALE'` itself when the version differs (L60–63). It then calls the core with the **locked** version, so the core's check cannot fail. |
| `persist_post_response_hypothesis_generation_v1` (svc) | 0036 / 0072 | → `…_core` → `transition_hypothesis_core_v1` (activation) | It activates only hypotheses created earlier **in the same transaction**, which no other transaction can see or modify. |

### 2.4 ABSORBED — 8 (unchanged)

| Entry point (role) | Def. | Catcher (body lines) | Raisers it wraps | Durable outcome |
|---|---|---|---|---|
| `execute_post_response_hypothesis_update_batch_v1` (svc) | 0034 / 0072 | `execute_post_response_hypothesis_update_batch_v1_core` L62–112: `WHEN SQLSTATE '40001' OR SQLSTATE '22023'` | `background_apply_…` → `apply_hypothesis_evidence_update_core_v1` | `UPDATES_REJECTED` (all-or-nothing). **Its raiser changes, so this catcher is extended (§4.2).** |
| `complete_shared_world_qandeel_reply_v1` (svc) | 0139 | `shared_private.complete_…` L57–74 `WHEN serialization_failure` | `commit_shared_world_qandeel_material_v1` | `'STALE'` (+ lease end) |
| `approve_shared_world_proposal_v1` (auth) | 0140 | `shared_private.approve_…` L75–84, L89–112 `WHEN serialization_failure` | `commit_shared_world_governance_approval_v1`, `commit_shared_world_member_removal_v1`, `…settings_change`, `…standard_end`, `dispatch_…member_invitation`, `resolve_shared_world_governance_approval_v1` | `'STALE'` |
| `accept_shared_membership_request_v1` (auth) | 0140 | `shared_private.accept_…` L53–69 `WHEN … serialization_failure …` | `accept_shared_world_member_invitation_v1`, `commit_shared_world_member_rejoin_v1` (→ `resolve_…`) | `'UNAVAILABLE'` |
| `approve_shared_world_history_share_v1` (auth) | 0140 | `shared_private.approve_…` L54–63, L64–76 `WHEN serialization_failure` | `commit_shared_world_history_package_approval_v1`, `commit_shared_world_history_access_grant_v1` | `'STALE'` |
| `complete_shared_semantic_place_v1` (svc) | 0148 | `shared_semantic_private.complete_…` L75–89 `WHEN serialization_failure` | `commit_shared_world_qandeel_material_v1` | `'STALE'` |
| `approve_own_public_package_v1` (auth) | 0143 | `public_authoring_private.approve_…` L34–49 `WHEN OTHERS` → `classify_public_refusal_v1` | `approve_public_experience_manifest_v1` L104 | `'STALE'` |
| `commit_own_public_experience_ready_v1` (auth) | 0143 | `public_authoring_private.commit_…` L47–55 `WHEN OTHERS` → classify | `commit_public_experience_ready_for_review_v1` L86, L124, L139 | `'STALE'` |

**Everything else.** The other raisers, about 35 functions, among them Replay (0101–0105), Matching I-07B..D cores,
the 0066/0067/0068 focus and thread coordinators and the Shared World cores, are executable by **no application
role**. Each is either absorbed above or not reachable from any entry point. They stay on `40001`, and the guard
(§8 L5) fails closed the moment one becomes reachable. This includes the six Matching setup commands that 0149
suspended. If S6-01 restores them (`QAN-BL-MATCH-01`), the guard forces the same `PT409` treatment, as the backlog
already requires.

---

## 3. Exact Change Set

This is the only set of bodies 0150 replaces. Every listed site carries a *logical* stale-state refusal; none is a
PostgreSQL concurrency failure (§4.4). In every raiser, **all** of its `ERRCODE='40001'` occurrences are in scope, and
no other code changes.

| # | Function (signature) | Body defined in | Sites (prosrc lines) | Direct callers → indirect entry | Current catcher | `40001` → |
|---|---|---|---|---|---|---|
| 1 | `public.transition_hypothesis_core_v1(uuid,uuid,integer,text,text)` SECDEF, `search_path=""`, ACL owner only | 0036 | 2 (L17, L25) | `transition_hypothesis_v2` (entry); `persist_…_generation_v1_core` (guarded); `understanding_private.record_understanding_disagreement_v1` (guarded) | none (`record_…` catches only `unique_violation`) | `PT409` |
| 2 | `public.apply_hypothesis_evidence_update_core_v1(uuid,uuid,uuid,integer,text,text)` **INVOKER**, `search_path=""`, ACL owner only | 0032 | 2 (L17, L32) | `apply_hypothesis_evidence_update` (entry); `background_apply_…_v1` (entry) → `execute_…_batch_v1_core` | batch core L110 | `PT409` |
| 3 | `public.commit_finalized_exchange_with_full_semantic_chain_v1(…44 args…)` SECDEF, svc | 0071 | 2 (L72, L91) | none (entry) | none | `PT409` |
| 4 | `public.get_conversation_thread_identity_dossier_page_v1(uuid,bigint,uuid,integer)` SECDEF, svc | 0070 | 1 (L15) | none (entry) | none | `PT409` |
| 5 | `public.grant_shared_world_standing_context_v1(uuid,uuid,uuid,uuid[],uuid)` SECDEF, auth | 0078 | 2 (L74, L84) | none (entry) | none | `PT409` |
| 6 | `public.revoke_shared_world_standing_context_v1(uuid,uuid,uuid)` SECDEF, auth | 0078 | 2 (L37, L43) | none (entry) | none | `PT409` |
| 7 | `public.pause_matching_participation_v1(uuid,uuid)` SECDEF, auth | 0109 | 2 (L32, L47) | none (entry) | none | `PT409` |
| 8 | `public.turn_off_matching_participation_v1(uuid,uuid)` SECDEF, auth | 0109 | 2 (L32, L47) | none (entry) | none | `PT409` |
| 9 | `public.revoke_matching_context_v1(uuid,uuid)` SECDEF, auth | 0109 | 2 (L34, L38) | none (entry) | none | `PT409` |
| 10 | `public.revoke_pre_match_disclosure_authority_v1(uuid,uuid)` SECDEF, auth | 0109 | 2 (L37, L42) | none (entry) | none | `PT409` |
| 11 | `public.rotate_shared_world_invite_credential_v1(uuid,text,bigint)` SECDEF, ACL owner only (0138 revoked `authenticated`) | 0081 | 4 (L67, L70, L98, L132) | `shared_private.rotate_own_sealed_shared_id_v1` → `rotate_own_sealed_shared_id_v1` (entry); `account_private.regenerate_own_shared_id_v1` (0129; no grantee, no caller) | none (`regenerate` catches only `unique_violation`) | `PT409` |
| 12 | `public.execute_post_response_hypothesis_update_batch_v1_core(uuid,jsonb)` SECDEF, owner only | 0034 (renamed in 0072) | **handler**, L110 | `execute_…_batch_v1` (entry) | is the catcher | `WHEN SQLSTATE '40001' OR SQLSTATE '22023'` → `WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' OR SQLSTATE '22023'` |

**Totals:** 12 bodies; 23 raise sites; 1 handler clause. Messages, `DETAIL`, `HINT`, lock order, compare-and-swap
predicates, idempotency branches, grants, owners, security mode and configuration are byte-identical.

---

## 4. Internal Catch Compatibility Design

### 4.1 Rule

A code moves only where **every** catcher on every path to it is either absent, or is extended in the same migration to
accept the new code with the identical outcome. The design was checked against every handler that can absorb the
code: `WHEN serialization_failure`, `WHEN SQLSTATE '40001'` and `WHEN OTHERS`, in all schemas. It also covered every
caller of every changed function (the full caller lists are in §3).

### 4.2 Hypothesis batch — `UPDATES_REJECTED` stays durable

The trap: `background_apply_…` → `apply_…_core` raises inside the batch's inner subtransaction. Today `40001` is caught
and becomes a durable `UPDATES_REJECTED`. If the core raised `PT409` and the handler still matched only `40001`, the
error would escape. The whole managed transaction would abort with no durable rejection, and the execution would stay
`RUNNING`.

- **Option S (recommended).** Swap the four raise sites in the two cores, and extend the one handler to
  `WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' OR SQLSTATE '22023'`. Keeping `40001` makes the new handler a strict
  superset, so nothing it caught before is lost. Proof obligations (§8 L2):
  - a stale `expectedVersion` in a batch still yields the `UPDATES_REJECTED` effect row;
  - no hypothesis or `hypothesis_updates` row from that batch survives;
  - the function returns `false`;
  - the `22023` path behaves identically;
  - the `XX000` integrity raise still aborts the whole transaction.
- **Option T (rejected).** Leave the cores and translate in the three public wrappers with an `EXCEPTION WHEN
  serialization_failure` block that re-raises `PT409`. `background_apply_…` is both an entry point and the batch's
  callee, so the batch handler must be extended anyway. T touches 4 bodies instead of 3 and adds a subtransaction per
  call.

The other callers of the transition core are unaffected under S. `record_understanding_disagreement` and
`persist_generation` cannot reach the core's raise (§2.3), so their outputs (`'STALE'`, `COMMAND_CONFLICT`,
`HYPOTHESES_PERSISTED`) are unchanged by construction.

### 4.3 Shared World and Public Experience catchers — untouched by construction

None of the 7 absorbing wrappers (rows 2–8 of §2.4) calls, directly or transitively, any of the 11 changed raisers. Their
raisers keep `40001`, so their `serialization_failure` / `WHEN OTHERS` handlers keep producing `'STALE'` /
`'UNAVAILABLE'` exactly as today.

Proof (§8 L3): the migration self-check and the verifier assert that the body hash of every absorbing wrapper and of
every raiser it wraps is unchanged. No regression run of those domains is needed, because zero bytes on their paths
change.

The Shared ID rotation chain has no catcher at all:
- `shared_private.rotate_own_sealed_shared_id_v1` has no handler;
- `account_private.regenerate_own_shared_id_v1` catches only `unique_violation` with
  `SHARED_INVITE_CREDENTIAL_REF_UNAVAILABLE`;
- the third pass inside `rotate_shared_world_invite_credential_v1` (L103) catches `unique_violation`, not
  serialization.

So moving its four sites changes only the code its callers see.

### 4.4 Logical stale state versus genuine PostgreSQL concurrency failures

- **Every `40001` in this database is application-raised.** No function sets `transaction_isolation`, and no
  database or role setting changes isolation (catalog-checked on both shapes: `proconfig` = 0, `pg_db_role_setting` =
  0, `default_transaction_isolation` = `read committed`). Every request therefore runs `READ COMMITTED`. The hosted
  value is not verified; L5 pins the repository-controlled settings. PostgreSQL raises a native `40001` only under `REPEATABLE READ` / `SERIALIZABLE`, so
  none can occur today. The guard pins this assumption (§8 L5): introducing a per-function or per-role isolation change
  fails CI and forces a fresh classification.
- **Logical stale state** is a deterministic disagreement between a caller's claim and committed truth. Retrying never
  helps, and the caller must re-read. It becomes `PT409`, which PostgREST never re-runs and answers as HTTP 409.
- **Genuine concurrency** is a deadlock (`40P01`), and native serialization if isolation is ever raised. A retry is
  the correct response, so it is **not** converted (§4.5).
- **Race-converging application raises** (`ensure_public_identity_v1` L76) are logical by message but transient by
  nature. Today PostgREST's server-side re-run is what resolves them correctly. Converting them would turn a silent
  success into a client-visible 409, which would sacrifice correct current behavior. They stay `40001` (D3).

### 4.5 `40P01`

- No function raises `40P01` or `deadlock_detected`; this was catalog-checked. A deadlock can only be genuine.
- On PostgREST < v16, a re-run resolves it. On v16+ it surfaces as HTTP 500 / `40P01`, which the API already classifies
  as `TRANSPORT` (`observability/operational-failure.ts`: ≥ 500).
- Converting it to `PT409` would misreport a transient conflict as a stale state and remove the correct retry, so this
  design converts nothing.
- The lock-order discipline already documented in the cores (canonical lock order, id-ordered pre-locks in the batch)
  keeps deadlocks rare.
- The residual is that on v16 neither genuine deadlocks nor the two race-converging paths are retried by the server.
  This is a v16-transition behavior, independent of B, proposed as D7.

---

## 5. QANDEEL contract preservation

| Contract | How 0150 preserves it | Proven by |
|---|---|---|
| Compare-and-swap | Predicates are byte-identical. Only the `ERRCODE` literal of the refusal changes. | Body-transform equality (§7.3) |
| No-write-on-stale | `RAISE` with any SQLSTATE aborts the statement's transaction (PostgREST request = one transaction). Every pre-raise write (e.g. the Matching lock-row upsert at L14–16) rolls back exactly as before. The batch's inner subtransaction still rolls back every mutation and audit row before it records `UPDATES_REJECTED`, unchanged. | Table digests before and after each stale call (§8 L1) |
| Concurrency safety / lock order | No lock statement changes | Body equality + race tests (§8 L4) |
| Idempotency | Replay branches precede the CAS and are unchanged; a committed command still returns its committed result | Replay tests per family (§8 L1) |
| Ownership / RLS | No table, policy, RLS flag or grant is touched; `auth.uid()` derivation unchanged | Migration content contract + ACL equality |
| Owners, grants, SECURITY DEFINER / INVOKER, `search_path`, volatility, strictness, cost/rows, signature, return type, comments | `CREATE OR REPLACE` keeps oid, owner, ACL and comment; every other attribute is restated verbatim and self-checked against a pre-snapshot in the same transaction | §7.3 assertions |
| Exact semantic messages / DETAIL | Unchanged text. PostgREST returns `message` / `details` identically for `PTxxx` (the PT429 precedent is proven on all four lines by `prove-0131-postgrest-refusal.mjs`). | Wire proof (§8 C2) |
| Audit / rejection outcomes | `UPDATES_REJECTED`, `'STALE'`, `'UNAVAILABLE'`, `COMMAND_CONFLICT`, `ALREADY_UNDER_REVIEW` unchanged | §8 L2, L3 |
| Privacy / account deletion | No row, retention or erasure path is touched; Matching lock rows still roll back on stale (0149 / ACCT-01 premise intact) | Same as no-write |

**Controlled Forward Amendments (C2 closing change, append-only, mirroring SEC-MATCH-00's §47).** Frozen text is never
rewritten. Each record gets one forward section that cites 0150 and this approval.

| Frozen record (lifecycle) | Pinned text | Amendment |
|---|---|---|
| `docs/effective-live-focus-final-semantic-chain-cutover-v1.md` (0071, D-07) | stale recovery on `40001` | commit answers `PT409` (same messages); API recognises both |
| `docs/thread-lifecycle-cross-session-continuity-v1.md` (0070) L163–164 | `STALE_*` = SQLSTATE 40001 | dossier / commit answer `PT409` |
| `docs/conversation-focus-runtime-integration-readiness-v1.md` (T-03B1b2) L68 | "maps **only** SQLSTATE 40001" | maps `40001` **or** `PT409` with the exact message |
| `docs/thread-runtime-integration-readiness-v1.md` (T-03B2b3, Slice) L76 | same | same |
| `docs/hypothesis-lifecycle-completion-v1.md` (0036) L123 | "established stale-version SQLSTATE 40001" | cores answer `PT409`; batch handler accepts both |
| `database/README.md` §0078 L427 (Standing Context) and §0081 L642 (Shared ID credential) | bounded `40001` | bounded `PT409` |
| `docs/matching-introduction-runtime-v1.md` (I-07, CLOSED / FROZEN) L192, L1445 and `database/README.md` L2529, L4350 | bounded `40001`; "never expose 0109 through PostgREST < v16" | the four retained commands answer `PT409`. The deployment rule is **narrowed, not removed**: I-07B..D cores still raise `40001` and are not app-executable, and any restoration carries the guard. |
| `docs/qandeel-canonical-backlog-v1.md` `QAN-BL-PROD-06` | scope / status | scope amended (D6); closed by C2 per BG-08 with the hosted-deployment condition kept explicit (§9) |

`docs/durable-reference-emerging-focus-sp-substrate-v1.md` (0066) needs no amendment: the 0066 coordinator keeps
`40001` and is not app-executable.

---

## 6. API Compatibility Plan

This plan is for C2. C1 changes no API code.

**Principle** (see the C1 correction 1 above: the Data API HTTP status of these refusals does change, 500 → 409). The API's own answers do not change. Only the three exact-identity recognisers learn
`PT409`, in addition to `40001`, never instead of it. Matching stays on (code, message), never on HTTP status alone.
PostgREST also maps `23505` to 409, so a status-only check would conflate a stale state with a uniqueness conflict.

| Site | Today | C2 change | Behavior |
|---|---|---|---|
| `conversational-focus/conversation-focus-runtime.repository.ts:34,53-58` `isStaleConversationalFocusContext` | code `=== '40001'` and exact message | code ∈ {`PT409`, `40001`}, exact message unchanged | Shared by `live-focus/conversation-semantic-runtime.repository.ts:56`, `thread-establishment/…runtime.repository.ts:108`, `thread-lifecycle/…:66`. The semantic establishment's bounded stale retry (`conversation-semantic-establishment.service.ts:280`) now actually runs on < v16 (today it never receives the error). |
| `thread-lifecycle/conversation-thread-lifecycle-runtime.repository.ts:40,55-58` `isStaleThreadIdentityContext` (+ `.types.ts`) | same | same | Same as above. |
| `shared-world/shared-world.service.ts:198` | `databaseCode === '40001'` (code only) | code ∈ {`PT409`, `40001`} **and** message `=== 'SHARED_INVITE_CREDENTIAL_STALE_STATE'` | Equivalent on today's database: that is the only `40001` on the path. The read-back of the winner's value is unchanged. |
| Hypothesis (`hypothesis.repository.ts:47`, `hypothesis-update.repository.ts:10`, `background-intelligence-data-api.service.ts:126`) | no code matching; the error propagates as a non-HTTP error | **none** | Nest answers 500 for an unknown error, exactly what v16 yields today. On < v16 the request now ends at once instead of after the 5 s timeout. Mapping a hypothesis stale state to `409 Conflict` would be a **new client contract**, so it is not done. It stays a PO option. |
| Standing Context / Matching | no API caller | none | n/a |
| `observability/operational-failure.ts` | 5xx → `TRANSPORT`, other 4xx → `INTEGRITY` | none | None of its four call sites (privacy worker, ai-usage worker, push worker, understanding re-evaluation) calls a changed RPC. |
| `supabase-data-api.service.ts` comments, `conversation.service.ts:56` (PT429 precedent) | — | doc comment only | — |

**Transition.**
- Dual acceptance makes **API-first** deployment safe against an un-migrated database.
- A migrated database with an old API never hangs. It only degrades the conversation stale recovery to a generic
  failure, which is still strictly better than today on < v16.
- Dropping `40001` acceptance later is optional, and only after every environment is verified at ≥ 0150. Not part of C2.

**API specs touched (only these).**
- Update or extend with `PT409` cases while keeping the `40001` cases:
  - `conversation-focus-runtime.repository.spec.ts`
  - `conversation-semantic-runtime.repository.spec.ts`
  - `conversation-thread-runtime.repository.spec.ts`
  - `conversation-thread-lifecycle-runtime.repository.spec.ts`
  - `shared-world.spec.ts`
  - `supabase-data-api.error-identity.spec.ts` (if it pins the code)
- `hypothesis.service.spec.ts`: review only. It asserts that an upstream `40001` error propagates; add the `PT409`
  twin.

---

## 7. Forward Migration Design — `0150`

### 7.1 Number and name

`0150` is free on `origin/main` (`0149` is the last migration). C2 re-checks this at branch creation and renumbers if
main moved.

Name: `0150_data_api_stale_state_non_retryable_sqlstate_v1.sql`.

### 7.2 Shape (forward-only, one transaction)

```
BEGIN;
-- (a) PRE-SNAPSHOT: a temp table ON COMMIT DROP holding, for the 12 changed functions and the
--     no-change set (§4.3: 7 absorbing wrappers, their wrapped raisers, record/persist/regenerate callers):
--     oid, prosrc, md5(prosrc), proowner, proacl, prosecdef, proconfig, provolatile, proparallel,
--     proisstrict, proleakproof, procost, prorows, prorettype, proretset, proargtypes, proallargtypes,
--     proargmodes, proargnames, pg_get_expr(proargdefaults), prolang, obj_description(oid,'pg_proc').
--     Plus a PRE-CONDITION: each of the 11 raisers contains exactly its expected count of
--     ERRCODE='40001' (2,2,2,1,2,2,2,2,2,2,4) and no 'PT409'; the batch core contains the exact old
--     handler clause once. Any mismatch (e.g. a drifted hosted body) -> RAISE, migration aborts.
-- (b) 12 x CREATE OR REPLACE FUNCTION: each a verbatim copy of its defining migration's body
--     (0032, 0034, 0036, 0070, 0071, 0078, 0081, 0109) with ONLY the approved token change, and every
--     attribute clause restated verbatim (SECURITY DEFINER/INVOKER, SET search_path = '', LANGUAGE,
--     volatility, RETURNS ...). No GRANT/REVOKE/ALTER OWNER (CREATE OR REPLACE keeps both).
-- (c) TERMINAL SELF-CHECK (DO block), for every changed function:
--       replace(old.prosrc, $$ERRCODE='40001'$$, $$ERRCODE='PT409'$$) = new.prosrc     (11 raisers)
--       replace(old.prosrc, <old handler>, <new handler>) = new.prosrc                  (batch core)
--       oid and every attribute in (a) equal; new.prosrc has zero ERRCODE='40001' (raisers).
--     For every no-change function: md5(prosrc) and attributes unchanged.
--     Effective-privilege spot checks under has_function_privilege for anon/authenticated/service_role
--     equal to the pre-snapshot (shape-independent: CI and hosted-shaped both pass).
COMMIT;
```

### 7.3 Why it is provable

- The self-check compares the database's own before and after state in one transaction. It therefore holds on every
  shape (CI, hosted-shaped, hosted) without frozen literals.
- It aborts on any drift, so it fails closed.
- Because comments inside bodies are **not** edited, the transform is a pure literal substitution. The reason for the
  change lives in the migration header only, so the equality check stays exact.

**Content contract** (a static test, §8 L6), asserting the migration contains only:
- the 12 `CREATE OR REPLACE FUNCTION` statements;
- the snapshot and self-check blocks.

It must contain no DML on application tables, no `GRANT` / `REVOKE` / `ALTER`, and no table, policy or RLS DDL. No
historical migration file is edited.

---

## 8. Focused Validation Matrix — QUALITY COMPLETE, VALIDATION PROPORTIONAL TO CHANGE

The **local** checks run on two disposable PostgreSQL databases built from the C2 branch with
`focused-verification-runner`'s bootstrap: CI-shaped and hosted-shaped. They never touch hosted or `.env` URLs.

| ID | Group | What | Where |
|---|---|---|---|
| L0 | Migration self-check | 0150 applies cleanly on both shapes. Its terminal assertions are the body-transform and attribute proof. | local ×2 |
| L1 | `verify-migration-0150.mjs` (new, live) | For each of the 12 entry points / 11 raisers: (i) stale request → SQLSTATE `PT409`, exact message (+ exact DETAIL for commit / dossier), **zero writes**, checked by digests of every table the function writes; (ii) one happy path still commits; (iii) idempotent replay of a committed command returns the committed result (Standing ×2, Matching ×4, rotation); (iv) role matrix: the anon / authenticated / service_role EXECUTE answers equal the pre-0150 grants. | local ×2, then CI |
| L2 | Batch regression (inside L1) | Stale `expectedVersion` → `UPDATES_REJECTED` effect, zero batch mutations, returns `false`; `22023` path identical; `XX000` integrity still aborts; mixed batch (one stale) rolls back all. | same |
| L3 | Absorbed-path invariance | md5 + attribute equality of every §4.3 function (in-migration and in the verifier). A single smoke of one `'STALE'` outcome via `complete_shared_semantic_place_v1` proves the catcher still sees `40001`. | same |
| L4 | Real concurrency (two connections, `pg` clients, statement_timeout 10 s, `finally` cleanup) | Transition core: two transitions at the same expected version → one commits, one `PT409`, exactly one audit row. Shared ID: same-epoch rotations by two commands → one `ROTATED`, one `PT409`; **first-setup race** (expected `NULL` ×2, different commands) → one `ROTATED`, one `PT409` (L132 / L67); same command twice concurrently → both return the one committed epoch. Matching pause race and Standing grant race → one winner, one `PT409`. Race-converging control: concurrent `ensure_public_identity_v1` → still `40001` from SQL (unchanged by design). | local ×2, then CI |
| L5 | Catalog guard (new, live DB test) | Cross-schema reachability (schema-qualified calls + trigger writes) from every `public` function executable by anon / authenticated / service_role. Distinguishes **RAISE** statements from **WHEN** handlers. Asserts: (a) the 12 deterministic entry points reach no `40001` / `40P01` raise; (b) the set of entry points that still reach a `40001` raise equals the frozen allowlist of 12 (2 race-converging + 2 guarded + 8 absorbed), each with its classification; (c) no function raises `40P01` / `deadlock_detected`; (d) no non-literal `ERRCODE`; (e) no isolation setting in `proconfig` or `pg_db_role_setting`. Any drift (a new exposure, restored Matching commands, a new raiser) fails with the entry point named. | local ×2, then CI |
| L6 | Static contracts | 0150 content contract (§7.3); the amended canonical sections exist (BG-09 style); `npm run test:task-closure-governance-contract` at closure. | local, CI |
| L7 | Re-anchoring (only live checks that execute a changed function and assert its stale code). **Rule:** a live assertion that a changed function answers `40001` becomes `PT409`, commented "since 0150". Static assertions on historical migration text stay unchanged, because the files are untouched. **Candidates C2 confirms by running:** `verify-migration-0070/0071/0078/0081/0109/0112/0114/0116/0149`; live DB tests `canonical-evidence-eligibility-v1`, `hypothesis-lifecycle-completion-v1`, `shared-standing-context-consent-commands-v1`, `matching-setup-human-authority-commands-v1`. Only their stale assertions change. | local focused runner, then CI |
| L8 | API jest | Only the specs in §6, with both-code cases. | local, CI |
| C1 | GitHub API CI, **one exact-head run** | The existing gate (it already runs the database verifiers and jest), plus L1 / L5 / L7 wired into it. | CI |
| C2 | Wire proof `prove-0150-stale-refusal-postgrest.mjs` (new) | Inside the existing PostgREST loop (`v12.2.9`, `v13.0.8`, `v14.18`, `v16.4`, throwaway containers, `docker stop` in `always()`). It sends a deterministic stale request to `transition_hypothesis_v2` (authenticated JWT), `get_conversation_thread_identity_dossier_page_v1` (service role) and `rotate_own_sealed_shared_id_v1` (authenticated). Each must be answered within `AbortSignal.timeout(10 s)` with HTTP 409, `code` `PT409` and the exact message / details. A missing answer **fails** the proof, naming the boundary. On < v16 that missing answer is exactly the old hazard, so the timeout is the discriminator. | CI only |

**Not run:**
- Supabase hosted, in any form.
- The SEC-MATCH-00 suites, as a re-run.
- Unrelated domains' verifiers outside the C1 gate.
- Any test that can loop outside a disposable container with a timeout.

**CI cycles:** the target is **1** exact-head run. A failure gets one fix-forward cycle. There is no cap that permits
merging an unverified head: merge requires green.

---

## 9. Deployment and Rollback Safety Plan

**Order.**
1. Deploy the API with dual recognition. It behaves identically against today's database.
2. Apply `0150` in the next database deployment. A migrated database with an old API is still safe (§6).

**Hosted.**
- `0150` re-creates functions from `0078` / `0081` / `0109`, so it cannot be applied to a hosted schema at `0074` on its
  own. It ships **inside the `0075`+ catch-up**, in the same controlled window as `0149`, and no later than any
  exposure of `0078` / `0081` / `0109`.
- Until hosted is at ≥ `0150` **or** verified at PostgREST ≥ v16, the existing `QAN-BL-PROD-06` reopen conditions bind
  unchanged: keep the hosted Data API closed to real signed-in users.
- If the hosted API already serves traffic, the five hosted deterministic entry points (rows 1–5) are live exposure
  today. That raises the catch-up's priority. It is still unknown; the PO confirms it.

**PostgREST version (still NOT VERIFIED; read-only, PO-only).**
- Supabase Dashboard → Project Settings → General (service versions / infrastructure section) → read the PostgREST
  version. Do not press "Upgrade project".
- Share only the number. No keys and no CLI `link`.
- B does not depend on the answer. It decides only whether the hosted exposure is already mitigated (≥ v16) or live
  (< v16).

**Post-deploy evidence on hosted** (only with separate approval; read-only SQL in the Dashboard SQL editor, run by the
PO): a catalog query that counts `ERRCODE='40001'` in the 11 raisers (expect 0) and `'PT409'` (expect 23). **Never** a
stale request against hosted.

**Rollback.**
- API rollback is safe at any time: no hang, and only the stale recovery degrades.
- The database is forward-only. Reverting would mean a new migration restoring `40001`, which reintroduces the hazard,
  so the plan is fix-forward.
- The in-migration self-check guarantees a failed apply leaves the database untouched (one transaction).

---

## 10. C2 Implementation Task Contract (for review, not for execution)

- **Task:** `PROD-RETRY-01 / C2 — Non-retryable stale-state SQLSTATE (migration 0150) + API dual recognition`.
- **Branch:** `prod/prod-retry-01-stale-state-pt409` from current `main`.
- **Inherits:** `QAN-BL-PROD-06` (BG-05).
- **In scope:**
  1. Migration `0150` exactly per §3 / §7; renumber only if main moved.
  2. API changes exactly per §6 (3 recognisers + doc comments).
  3. `verify-migration-0150.mjs` (L1–L4).
  4. The catalog guard (L5) and the content contract (L6).
  5. Re-anchoring per L7, limited to stale-code assertions of changed functions.
  6. `prove-0150-stale-refusal-postgrest.mjs` added to the existing PostgREST loop and to `package.json` (C2 in §8).
  7. Controlled Forward Amendments per §5.
  8. Backlog: amend the scope of `QAN-BL-PROD-06` (D6) and dispose of it at closure under BG-08. The recommended
     closing text is "CLOSED for the repository; hosted deployment condition retained in §9 of the record", or the PO's
     wording. Admit the D7 residue if approved.
  9. A `QANDEEL_CURRENT_STATE.md` row for PROD-RETRY-01, plus the SEC-MATCH-00 merged-state reconciliation (§1.4), if
     the PO agrees.
  10. An implementation record `docs/e2e/QANDEEL_PROD_RETRY_01_…_IMPLEMENTATION_RECORD_v1.md`.
- **Out of scope:**
  - any other function body;
  - race-converging, guarded or absorbed paths;
  - `40P01` handling;
  - the client-visible HTTP mapping for hypothesis stale states;
  - restoring Matching commands;
  - hosted catch-up, upgrade or any hosted connection;
  - mobile.
- **Acceptance:**
  - L0–L8 green locally on both shapes;
  - one exact-head API CI run green, including C2 on all four PostgREST lines;
  - `npm run test:task-closure-governance-contract` green;
  - no secret in any file;
  - PR description states what changed, why, what was deliberately not changed, and how it was verified.
- **Stop points:**
  - After the local L0–L8 pass: report, then push and open a Draft PR. This is the single CI cycle.
  - After CI: report for PO merge decision. No merge or deploy without explicit approval.

---

## 11. Risks and dependencies

| Risk | Mitigation |
|---|---|
| A verbatim copy drifts from the defining body (a typo becomes a silent behavior change) | The in-migration transform-equality self-check makes it impossible to apply |
| A hosted body already drifted from the repository | The pre-condition counts abort the migration on hosted. That is fail-closed and surfaces the drift. |
| A catcher outside the analysed set | L5 (handlers versus raises, all schemas) plus caller lists per changed function; any new caller fails the guard |
| Clients that relied on HTTP 500 for these refusals | Hypothesis keeps 500 at the API edge. The conversation and Shared ID paths are server-internal and recognised by exact identity. Standing Context and Matching have no client. |
| Mixed codes for one message family (e.g. `MATCHING_STALE_STATE` is `PT409` in the 4 retained commands and `40001` in I-07B..D cores) | Each function has one code. The non-converted cores are not app-executable, and the guard forces conversion on exposure. |
| v16 later removes the server-side retry that resolves race-converging paths and deadlocks | D7 residue; independent of B |
| Hosted at `0074` cannot take `0150` alone | Deployment rule in §9; reopen conditions unchanged |

**Dependencies:**
- PO decisions D1–D8.
- The PO reads the PostgREST version on the Dashboard (optional for C2, required for deployment assessment).
- The PO confirms whether the hosted API serves real users.
- `0150` remains free at C2 start.
