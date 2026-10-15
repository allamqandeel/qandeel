# QANDEEL — S6-02 Implementation Record v1

**Task:** S6-02 — Introduction-Phase Privacy Isolation & Safe END Boundary  
**Stage:** 6 — Matching & Introductions  
**Product authority:** the Product Owner's approved Task Contract v1.2 and implementation authorization (2026-10-15): decisions A, A1, D1–D5 and the six final clarifications. No merge or deployment without another explicit Product Owner approval.  
**Status:** **CLOSED / READY FOR PRODUCT OWNER MERGE DECISION — NOT MERGED / NOT DEPLOYED** (2026-10-15). One open Product Owner ruling is recorded in §9.1; it does not block review.  
**Base:** `main` = merged PR #339 (S6-01) at `2224c47f3dc83b16ad011ccbbdcf2aac19bf41f5`.  
**Branch:** `s6/s6-02-introduction-privacy-end-boundary` (one pull request).  
**Migration:** `0155_introduction_privacy_isolation_end_boundary_v1.sql` (the number was free at the base).

*(History: this record was opened at `445df738` as "ACTIVE — CP0 initial repository truth recorded; implementation and validation NOT DONE". This version replaces that banner at the closing change, BG-09.)*

## 1. Binding decisions (as approved)

- **A:** in a `MUTUAL_MATCH`-born World the approved Introduction first name stays the display name across SUCCESS. `users.name` is never substituted. A full account name as display name needs its owner's separate explicit authorization (S6-06).
- **A1 / D3:** after SUCCESS no ADD_MEMBER and no REJOIN_MEMBER, even of an original human, in every proposal / approval / acceptance path. Ordinary Standard Worlds are unchanged.
- **D1:** exactly one authenticated, ungated, human-derived END boundary over the frozen `commit_introduction_end_v1`, with one narrow `NO_BACKDOOR` exception. The six `0149` commands stay closed.
- **D2:** S6-02 builds the one recipient-scoped `presented_first_name` projection; unproven provenance / recipient / authority answers `NULL` (the approved mobile "someone"). S6-03 owns wiring `0154` into `0111`; S6-05 consumes the projection.
- **D4:** Stage 4 reading, sending and model-reply paths refuse Introduction Worlds; the `0118` Introduction-capable cores stay frozen; owner deletion stays.
- **D5:** Replay excludes material of a `MUTUAL_MATCH` World that occurred at or before SUCCESS, or all of it without SUCCESS — derived, with no new Replay column.
- **Final clarifications:** every `author_name` protected, self included; `0141` `actor_name` / `subject_name` fenced; 0150 is the Data API stale-state fix; no new direct caller of the `0119` resolver; S6-03's first-name obligation recorded in the Backlog at closure without a new task.

## 2. CP0 — repository truth (read-only, before any production edit)

The initial findings 1–14 of this record's first version stand. The completed census added:

1. **Name sinks** (catalog census: every function in any schema reading `public.users.name`): 14 Shared Product projections in `shared_private` (`0138`–`0140`), `shared_semantic_private` (`0148`), `public_authoring_private` (`0143`) and `public.server_read_shared_activity_source_v1` (`0141`). `list_own_shared_world_invitations_v1` (`inviter_name`) concerns a pre-World direct invitation, always an ACCEPTED_INVITATION birth, and is deliberately left unchanged.
2. **Introduction-phase gaps** (lifecycle-only predicates): `0138` list / members / entry; `0139` material read, send, QANDEEL reply begin (and complete through the `0118` core); `0141` per-World alerts and the HUMAN_TEXT / BIRTH / JOINED / LEFT Activity branches; `0148`'s `is_current_member_v1`; S5-02's Public authoring source list and package preparation. Everything gated by `0140`'s `is_current_shared_member_v1` was already STANDARD-only; `leave_shared_world_v1` reaches a core that refuses INTRODUCTION.
3. **A1:** the only callers of the frozen add / rejoin / dispatch / accept cores are the three `0140` wrappers named by the contract.
4. **Replay:** only `replay_capture_source_manifest_v1` and `derive_replay_source_manifest_currency_v1` call the `0119` resolver; every later path (revision, composition, preview, finalization, availability, distribution approval / authorization / package) consults the currency derivation. Fencing those two existing consumers adds no caller (verify-0115's pinned set of 8 is unchanged).
5. **Pins checked before editing:** `Object.keys` / RETURNS shapes (kept by `CREATE OR REPLACE`), exact definer / executor sets (no new client-executable helper; `shared_private` `service_role` reach unchanged), verify-0101 / 0106 needle and body-equality checks (kept), verify-0150's twelve pinned bodies (untouched), the `0116` / `0108` / `0113` producer censuses (the END boundary writes nothing itself).
6. **Frozen-contract conflict:** none found. No controlled amendment was needed.

## 3. What changed and why

| File | Change |
|---|---|
| `database/migrations/0155_…_v1.sql` | 3 internal helpers (name projection, era predicate, era filter; executable by no application role), the END boundary, 27 forward `CREATE OR REPLACE` with only named edits (each body generated from its live definition, every edit asserted to match its exact count), terminal self-assertions |
| `database/verify-migration-0155.mjs` | the focused real-PostgreSQL verifier (37 scenarios) |
| `database/prove-0155-introduction-end-postgrest.mjs` | the live PostgREST proof, run in API CI on every supported line |
| `database/verify-migration-0149.mjs` | D1: `NO_BACKDOOR` admits exactly `public.end_own_introduction_v1(uuid, uuid)` (name, signature, no overload, authenticated-only); probes f4 / f5 |
| `tests/s6-02-introduction-privacy-end-boundary-contract.test.mjs` | the static contract (8 tests); `tests/s5-03b…`, `tests/s5-03c…` re-anchored to S6-02 as the current task (validation only); `tests/conversation-focus-runtime-integration-readiness-contract.test.mjs` re-anchored to admit the END service as the one new exact reader of the typed database identity (22023 only) |
| `apps/api/src/introductions-lifecycle/*` | `POST /introductions/worlds/:worldId/end` `{ commandId }` → `ENDED` / `ALREADY_SETTLED` / `UNAVAILABLE`; caller token; no gate, retry or log; composed through `AccountModule`; route census `AUTHENTICATED` |
| `package.json`, `.github/workflows/api-ci.yml`, `database/README.md` | scripts, CI steps (verifier after migrations; wire proof inside the PostgREST loop; static contract), the 0155 section |
| Backlog, Current State, Project Map, Roadmap, this record | the closing change (§10) |

**The name projection.** ACCEPTED_INVITATION World → the account Name, byte-for-byte the old behaviour. Any other World → `matching_match_handoff_subjects.presented_first_name` where the subject is S and the audience is the viewer V, S and V being the two humans of the World's Introduction Record, with the birth fact, Match commit and handoff package all binding the same World / Record / commit; else `NULL`. The viewer's own row has no handoff row presented to themselves, so it is `NULL` (rendered "you" by the self flag; the model sees "A participant" for the requester's own turns). Never the `0154` draft, never a `FULL_NAME` disclosure.

**The END boundary.** Pre-check: the caller must be one of the two humans of this World's Introduction Record, else `UNAVAILABLE` (the core's first refusal for a settled World would otherwise tell an outsider it exists). Participation events = UUID-shaped SHA-256 of `QANDEEL_S6_02_INTRODUCTION_END_PARTICIPATION_EVENT_V1` + `LOWER` / `HIGHER` + command, so a retry is the same core request. 55000 → `ALREADY_SETTLED`; 23505 / P0002 → `UNAVAILABLE`. No `40001` anywhere on the path. The API maps only 22023 to `INVALID_REQUEST`; any other failure is `UNAVAILABLE` (review finding m3).

**Mobile.** No change. Every Shared name site already renders `NULL` as `copy.someone` (APPROVED, S4-01 Copy Gate) or "you"; Activity copy (`withName`) handles `NULL`; S5-02's Public authoring source list omits the author label when `NULL` (safe: no leak, no literal). No new copy, no Copy Gate.

## 4. Verification ledger (all on the stated heads; nothing claimed that did not run)

| Check | Result |
|---|---|
| Local real PostgreSQL 17 (embedded 17.x, fresh DB, all 155 migrations) | 0155 applies; its self-assertions pass |
| `verify-migration-0155` (fresh DB, final migration) | **37 / 37 PASS** |
| `verify-migration-0149` (amended) | **22 / 22 PASS** (incl. f4, f5) |
| Every verifier `0075`–`0154` against the 0155 DB (first full sweep) | all PASS except `0149` (the expected NO_BACKDOOR failure before its amendment, now 22 / 22), and `0130` / `0133`, which fail identically on a DB **without** 0155 (local baselines: the Windows clock-skew grace-period assertion; `psql` not installed) |
| Re-run after the review fixes: `0101`, `0106`, `0107`, `0149`, `0150`, `0155` | PASS |
| PostgREST wire proof | logic exercised locally against a scratch PostgREST *stand-in* (not PostgREST): PASS. Real PostgREST v12.2.9 / v13.0.8 / v14.18 / v16.4 runs **only in API CI** — see the PR |
| Root static contracts (`node --test tests/*.test.mjs`) | **1375 / 1375 PASS** |
| `npm run test:database` | **1304 / 1304 PASS** |
| API `tsc` (app + scripts), `nest build` | PASS |
| Focused API Jest (shared-world, http-security incl. route census, account, introductions-*, public-world, app) | **484 / 484 PASS**; END spec after the review fix **20 / 20** |
| Full API Jest, mobile, Maestro | not run locally (no mobile change); API CI runs its own gates |
| CI on the PR head | see the PR; not claimed here |

Fixtures: every in-transaction scenario rolls back; the races and the wire proof commit and remove their fixtures; afterwards the local DB held 0 introduction records, worlds, participation events and launch-gate rows, and every replaced seam answered `NOT_EVALUATED` / `UNRESOLVED_NO_CANONICAL_SOURCE` again.

## 5. Proof map (contract §10)

- **No account-name leak, no unauthorized wrapper:** P01–P06, N01–N03, I04, A01; the self-assertion census in 0155; static contract tests 2 and 6; the 0149 `NO_BACKDOOR` census with f4 / f5.
- **A1:** M01–M05 (fresh ADD, REJOIN of an original human after leaving, a proposal and a complete request seeded before the fence, ordinary ADD unchanged).
- **Replay before / after SUCCESS:** R01–R06, including the item exactly at the SUCCESS instant and a manifest that already holds Introduction-era material (STALE / `SOURCE_ACCESS_LOST`, and revision refused `REPLAY_SOURCE_STALE`).
- **END x SUCCESS, END x END, idempotency:** E01–E08, X01–X02 (two real connections pinned on a lock-wait barrier; one winner; no deadlock; the loser `ALREADY_SETTLED`).
- **Ordinary STANDARD unaffected:** I01, N03, M05, R06, and every earlier verifier green.

## 6. Independent review (WP4.4)

A separate review agent read the full diff, compared each of the 27 bodies with its last definition, and queried the catalogs read-only. **No blocker.** Confirmed: only the named edits; ACLs; the 0119 consumer set; the projection's single-row guarantee; D4 coverage; the A1 fence (no TOCTOU: `birth_basis` never changes); the era boundary (SUCCESS and all three history-item writers lock the World row before reading the clock); the END wrapper (stable request reference, outsider pre-check, no own locks, no `40001`); the narrow 0149 amendment; no scope creep or frozen-contract edit.

| Finding | Disposition |
|---|---|
| **MAJOR — Public approval request label.** S5-02's `list_own_public_approval_requests_v1` shows the *publisher's* Public display label; under the publisher's own `REAL_NAME` Public display mode that label is their account Name, so a matched counterpart asked to approve post-SUCCESS material could see it. | **Open Product Owner ruling, §9.1.** Not changed: the label is the owner's own explicit Public-identity choice (P1 §13 Public column), and changing Public identity is outside the contract. |
| m1 — the name-leak scans are textual (aliased `public.users` only) | recorded; the projection is the structural guarantee, and §9.1 names the one derived-label path |
| m2 — per-item era lookup on every currency check | **fixed:** an ACCEPTED_INVITATION World returns its set after one lookup |
| m3 — END mapped a server contradiction (P0001 → HTTP 400) to `INVALID_REQUEST` | **fixed:** only 22023 is invalid; anything else is `UNAVAILABLE` |
| notes — clock monotonicity; `publish_public_experience_v1` does not re-check the era for a pre-0155 package; the frozen `0078` Standing Context grant accepts Introduction Worlds by design; the requester's own turns are "A participant" | §9 residual risks |

## 7. Approval boundaries kept

No merge, no deployment, no launch or Matching gate opened, none of the six `0149` commands reopened, no frozen migration or core edited, no mobile surface, no new task opened.

## 8. Commits

- `445df738` — this record's CP0 version (PO authorization)
- `83a67026` — migration 0155, verifiers, wire proof, static contract, CI
- `144d6479` — the END API route
- the closing change (this record, Backlog, locators, re-anchors) and the review fixes — see the PR's commit list

## 9. Open ruling and residual risks (owner)

### 9.1 Product Owner ruling requested — Public display label in a Matching-born context

When a human whose Public display mode is `REAL_NAME` prepares a Public package from post-SUCCESS material of a Matching-born World, the required approver (the other matched human) sees that publisher's Public label, which is their account Name. Options: **(a)** treat the Public identity as the owner's own separate, consented identity (P1 §13: "only if the user chooses real-name display"), outside decision A — no change; **(b)** exclude Matching-born material from S5-02 entirely or force a pseudonymous label for such approvals — a change to S5-02 Public identity, outside this contract. Recommendation: **(a)**, recorded explicitly. Also applied fail-closed and reported for confirmation: S5-02 neither lists nor packages *Introduction-era* material (the D5 rule extended to Public authoring, since Public is a wider exposure than private Replay).

### 9.2 Residual risks (not register items; no qualifying cross-task residue)

- **Clock monotonicity (Stage 7 / Replay owner):** the era predicate compares `clock_timestamp()` instants; a backward wall-clock step between an Introduction item and SUCCESS could misclassify it. Same assumption as every frozen temporal truth of `0116` / `0118`.
- **Pre-0155 Public packages (none exist):** `publish_public_experience_v1` re-checks visibility but not the era; no Matching-born World can exist on any database today.
- **Standing Context in an Introduction World:** the frozen `0078` grant is "Introduction or Standard phase alike" by its own design; it is read by no Stage 4 path during the Introduction (reply work is refused). Any Introduction-specific use is S6-05's.
- **Model input:** with the strict recipient scope, the requester's own turns reach the model as "A participant" in a Matching-born Standard World; the other human is named by the handoff first name, so speakers stay distinguishable whenever a handoff exists.

## 10. Closing change (BG-08 / BG-09)

- **Inherited:** `QAN-BL-MATCH-02` — **tombstoned** (backlog §6) with the Product Owner's stricter decision A as a dated amendment in its §5 block; effective from the merge.
- **Admitted:** `QAN-BL-MATCH-05` (`HIGH`, `DEFERRED — OWNED`, owner `S6-03 — Matching Proposal Pipeline & Intelligence Prerequisites`; D2) — the confirmed Introduction First Name is not yet the canonical Matching first-name source. No new task.
- **Checked and not admitted (BG-06):** S6-05 (Introduction surfaces, END mobile, Introduction closed history), S6-06 (`FULL_NAME` display consent), S6-07 (Activity producers, Direct Entry), Stage 7 (Replay product) are those tasks' own contract scope; §9.2 items are risks, not obligations.
- **Register:** 69 items; 32 / 4 / 10 / 23 by status; 38 / 29 / 2 by severity (recounted mechanically from backlog §4).
- **Locators:** Current State (§3 S6-01 merged and S6-02 rows, §5 mirror, §7 Stage 6 note, owner rows incl. S6-03), Project Map (§5 S6-02 note; the one current-task line, the S6-01 line kept as history), Roadmap §6.11. S6-01's merge through PR #339 is recorded without erasing its pre-merge wording.
- `test:task-closure-governance-contract` covers T-* / I-* only and is not claimed as S6 closure evidence (contract WP4.3); it passes as part of the root suite.
