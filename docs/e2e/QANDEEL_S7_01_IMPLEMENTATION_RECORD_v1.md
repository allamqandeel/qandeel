# QANDEEL — S7-01 Implementation Record v1

**Task:** S7-01 — Replay Secure Integration & Account Erasure (Stage 7, the first task)  
**Owned:** `QAN-BL-ACCT-02` (Replay's account-deletion module), dispositioned at this task's closing change (§10).  
**Product authority:** the Stage 7 / WP0 and its corrections addendum, approved by the Product Owner, and the S7-01 brief
(«QANDEEL — Stage 7 / S7-01 Replay Secure Integration & Account Erasure»). No merge, deployment or user opening without the
Product Owner's explicit approval; S7-02 and S7-03 do not start automatically.  
**Status:** **S7-01 CLOSED / AT THE S7-01 INDEPENDENT REVIEW GATE — NOT MERGED / NOT DEPLOYED / CLOSED TO USERS**
(2026-10-19). This change is the task's closing change (BG-08 / BG-09, §10).  
**Base:** `main` = merged PR #346 (S6-07) at `3ea76f37c1c7c87661bad480e90460cc1edf7da2`.  
**Branch:** `s7/s7-01-replay-secure-integration` (one pull request).  
**Migration:** `0169_replay_personal_secure_integration_erasure_v1.sql` (the number was free).

`MERGED ≠ DEPLOYED ≠ LAUNCH-READY`. The hosted environment is `NOT_DEPLOYED`. The Personal Replay capability gate ships
with no row, so every Replay command answers `NOT_AVAILABLE_NOW` and writes nothing. CW2-08 answers `NOT_EVALUATED`, and
no distribution path is reachable.

## 1. The approved decisions this task implements (binding; not reopened)

| Decision | How S7-01 holds it |
|---|---|
| A personal, text-only Replay with a real preview and a private final version | the frozen I-06B preview and finalization, reached as the session subject; finalization makes a private version and nothing else (§3) |
| No exported video, no external distribution, no separate Replay library | no route, wrapper or definer reaches I-06C / I-06D distribution; the only list is one conversation's own Replays (§8.2) |
| One contiguous range of whole messages | the range is two Session Positions; the server resolves it to whole messages, turn-aligned (§3) |
| `MY_WORLD` only | the one source class every draft is born from; pinned by the migration, its verifier and the contract |
| Never present non-existent audio as original audio | the wire carries the frozen `original_medium` and never a playable medium; no audio path exists |
| Preserve I-06 and all closed design work | I-06 bodies untouched but for two guard prefixes (§7); no screen, graphic or motion is touched |
| Replay uses the existing analysis screens; Replay owns data, not graphics | a graphics-free data contract; a moment's analysis is the canonical K(TC) through the ONE T-03C mapper and depth law (§5) |

## 2. What changed (files)

- `database/migrations/0169_replay_personal_secure_integration_erasure_v1.sql`, with eight sections and terminal
  self-assertions: the schema, the gate, the helpers, the commands, the reads, the wrappers, the erasure and the ACL.
- `database/verify-migration-0169.mjs` (34 scenarios) and `database/replay-personal-verifier-support.mjs`.
- Re-anchored verifiers: `verify-migration-0150.mjs` (ABSORBED names the five commands), `verify-migration-0164.mjs`
  (A06: the new residue class and its owner) and `verify-migration-0166.mjs` (A03: the coordinator is the pre-0166 body
  plus exactly the three 0169 edits; §9.6).
- API (`apps/api/src/replay/`): `replay.module.ts`, `replay.controller.ts`, `replay.service.ts`, `replay.repository.ts`,
  `replay.types.ts`, `replay.spec.ts`.
  - Composed through `account/account.module.ts`, because the application root is pinned.
  - Its 11 routes are classified in `http-security/route-rate-limit.census.ts`.
- T-03C, additive: `historical-projection-mapper.ts` exports `mapHistoricalAnalyticalFamilies`, and
  `historical-disclosure.ts` exports `discloseAnalyticalRungs`.
  - `mapHistoricalProjectionRow` and `disclose` now compose these. Their outputs are unchanged, and the parity is proven
    in the two existing specs.
  - The pinned file set and regexes hold, and no file was added to the directory.
- Contract: `tests/s7-01-replay-secure-integration-contract.test.mjs` (17 tests; every detector proven against a planted
  defect).
- Wiring: `package.json` scripts, two `api-ci.yml` steps, and the focused group `s7-01` in `database/focused-verifiers.json`.
- Re-anchored contracts: S6-02, S6-04, S6-05 ×2, S6-06, S6-07 ×2, ACCT-DEL-01 and the typed-error transport census
  (§9.3).
- Records: this document; `database/README.md` (0169); `docs/replay-runtime-v1.md` §64; the backlog; Current State,
  Project Map and Roadmap.

## 3. The secure API over the frozen engine

Every exposed function is a one-line `SECURITY INVOKER` wrapper, granted to `authenticated` only. It calls a
`replay_private` `SECURITY DEFINER`, the 0138 / 0140 / 0143 shape. The definer reads the human from `auth.uid()` alone.
No argument names a user, an owner, a source class, a Conversation Unit or a manifest.

| Act | Gated | Answer |
|---|---|---|
| `create_my_replay_draft_v1(command, session, first_tc, last_tc)` | yes | `CREATED` + the Replay, its lifecycle, draft revision, coverage class and moment count |
| `revise_my_replay_draft_v1(command, replay, expected_revision, first_tc, last_tc)` | yes | `REVISED` + the same |
| `prepare_my_replay_preview_v1(command, replay, expected_revision)` | yes | `PREVIEW_READY` + the version, its revision, moment and discontinuity counts |
| `finalize_my_replay_version_v1(command, replay, expected_version)` | yes | `FINALIZED` + the version (private; nothing distributed) |
| `reopen_my_replay_for_revision_v1(command, replay, expected_version)` | yes | `REOPENED` + the lifecycle and the version reopened from |
| `read_my_replay_v1`, `read_my_replay_version_v1`, `read_my_replay_moments_v1`, `read_my_replay_moment_analysis_v1`, `list_my_conversation_replays_v1`, `read_my_replay_capability_v1` | no | creator-exact; nothing for anyone else |

- **Order inside every command:**
  1. `auth.uid()`;
  2. the request shape (`22023 REPLAY_REQUEST_INVALID`, the client's own error);
  3. an equivalent retry answered from committed history, whatever the gate says now (deterministic identities from
     `replay_private.derive_identity_v1`);
  4. the gate, bound `FOR SHARE`;
  5. the frozen primitive, in its own block;
  6. the gate snapshot written beside the committed act;
  7. one bounded answer.
- **The bounded words:** `NOT_AVAILABLE_NOW`, `UNAVAILABLE`, `NOT_WHOLE_MESSAGES`, `CHANGED`, `SOURCE_CHANGED`,
  `MOMENT_NOT_SEALED`, `ANALYSIS_UNAVAILABLE`, `ANALYSIS_CHANGED`, `LIFECYCLE_NOT_ELIGIBLE`, `SELECTION_NOT_SUPPORTED` and
  `COMMAND_CONFLICT`.
  - Every `40001` / `PT409` of the primitives becomes one of them. A PostgREST before v16.0 therefore never re-runs the
    request (`QAN-BL-PROD-06`); `verify-0150` ABSORBED is re-anchored.
- **Reads are ungated, commands gated** (the 0138 precedent): a human is never trapped out of what already exists.
- **Unavailable and stale states:**
  - the draft's `sourceState` is `CURRENT` or `STALE` (I-06A currency);
  - a version's viewing state comes from the frozen derivations: the current preview, or a finalized version through the
    I-06D complete-Replay usability;
  - it is `VIEWABLE`, or `NOT_VIEWABLE` with one class: `VERSION_SUPERSEDED`, `SOURCE_STATE_CONTRADICTORY`,
    `SOURCE_NOT_CURRENTLY_AVAILABLE` or `ANALYTICAL_EVIDENCE_INCOMPLETE`;
  - both layers are always reported. The analysis never stands in for a missing source.

## 4. Security properties

- **Actor:** `auth.uid()` only; no client-claimed identity anywhere (A01, A02; API spec).
- **No direct execution of a frozen core.** The five I-06 primitives, their cores, derivations and every distribution
  command stay executable by no application role. The three creator resolvers stay `service_role` only. No relation is
  reachable (A03, E14).
- **No existence oracle:**
  - another human's Replay or source, a deleted source, an unknown identity and a malformed path id all give the same
    answer (`UNAVAILABLE`, or zero rows);
  - this was tested with two real accounts (E03);
  - the API never passes the database's message on (only `22023` becomes `INVALID_REQUEST`; everything else is a 503
    `UNAVAILABLE`).
- **A personal capability gate, closed by default:**
  - `replay_private.replay_launch_capability_states`, scope `PERSONAL_REPLAY`, ships with no row (UNCONFIGURED = DENY);
  - only `ENABLED` with requirements `SATISFIED` or `WAIVED` allows;
  - only the operator setter writes it, and no application role executes the setter;
  - every allowed act stores its snapshot in `personal_replay_launch_evidence` (append-only, erasure-only deletes);
  - an operator change waits for an in-flight act (G06).

  It is **not** a substitute for the frozen launch gates. It claims no Safety, moderation, entitlement or launch
  clearance.
- **A private version is not a distribution.** Finalization writes no package, approver, authorization, artifact or
  public bridge row (E13). **CW2-08 is not opened or faked:** its prerequisite seam still answers `NOT_EVALUATED`, which
  the migration asserts terminally (A09).
- **Concurrency and idempotency:**
  - equivalent births converge on one Replay (G01);
  - competing revisions and finalizations have exactly one winner (G02, G03);
  - a stale expectation answers `CHANGED` and a wrong state `LIFECYCLE_NOT_ELIGIBLE`, with nothing written (E11);
  - the same command id naming another request is `COMMAND_CONFLICT` (E10).

## 5. The graphics-independent data contract

The wire types live in `apps/api/src/replay/replay.types.ts`, not in `@qandeel/runtime`. The Replay player is S7-03's,
and a client contract is published when a client consumes it. The runtime index is also pinned against these words.

| The contract expresses | Where |
|---|---|
| Replay identity and state | `replayId`, `lifecycle` (`DRAFT` / `PREVIEW_READY` / `FINALIZED`), `createdAt`, the draft, the current version |
| Source, selection and analysis versions | the draft's revision, range (`firstTc` / `lastTc`), coverage class and source state; each version's revision, `isCurrent`, `finalized`, moment and discontinuity counts |
| Displayable historical moments | `moments[]`: ordinal, `tc` (the represented Session Position), who spoke, the original medium, the exact committed text **only while viewable** |
| Gaps, stops and staleness | `omittedBefore` on each moment (absence named, nothing omitted shown); `temporalDiscontinuityCount`; `viewing` with its class and both layers; `MOMENT_NOT_SEALED`, `ANALYSIS_CHANGED`, `ANALYSIS_NOT_CURRENTLY_AVAILABLE` |
| Render contract version and temporal-truth requirements | `renderContract`: revision, schema, source medium class and the twelve versioned policies of the frozen I-06B render truth contract |

- **No colour, drawing coordinate, React component or motion** is authored. A Thread's `home` is canonical K(TC) truth,
  carried exactly as T-03C carries it. The contract test and the module spec scan for colours, easing, mobile, Skia,
  Living Analysis, MapSurface, temporal-navigation and bridge imports.
- **No source-internal identity.** A moment is its ordinal and its Session Position. No Conversation Unit, Turn,
  manifest, selection, projection or render-contract row id crosses. A Question appearance loses its two Turn ids on
  the Replay wire.
- **The one new read path, and its limits.** `read_my_replay_moment_analysis_v1` is **not a second historical
  projection**:
  - it calls the canonical `get_session_historical_projection_v1` (0072) under the caller's own `auth.uid()`, at the
    version's own represented Session Position only;
  - it serves the answer only when it re-digests, through the frozen
    `replay_analytical_projection_point_digest_v1`, to exactly the `point_digest` the version froze;
  - it carries exactly the twelve families that commitment covers. It omits `moments` (the source layer serves them) and
    `materials[].expiry`: a wall-clock policy fact the digest does not commit, and hindsight at TC;
  - it is no route to any other TC, any other conversation or the full K(TC) header (`sessionId`, `liveHead`,
    `revision`);
  - the API maps it with the T-03C mapper's own checks (`mapHistoricalAnalyticalFamilies`) and discloses it by the one
    depth law (`discloseAnalyticalRungs`), five frozen rungs and `DEPTH_WITHHELD` above the requested depth. E09 proves
    it equals the canonical K(TC) exactly.
- **HistoricalDisclosure reused where suitable.** The rung shapes are T-03C's. The SESSION rung carries Emerging
  Focuses and Question appearances, and its Moments are the Replay's own source layer.

## 6. Account erasure — `QAN-BL-ACCT-02`

- **The module.** `account_erasure_private.erase_personal_replays_v1(deletion, user)` deletes the whole Personal Replay
  footprint, children first in foreign-key order. That covers every Replay, manifest, selection, draft, version, sealed
  projection, render-contract binding, lifecycle event and command, and the S7-01 launch evidence.
  `replay_module_residue_v1` proves nothing is left.
- **The coordinator.** It is forward-replaced from 0164 with three named edits, and the census and the operations
  summary with their own:
  - E1: lock the account's Replays in ascending order, after the claims and before the account row;
  - E2: call the module, then the residue check, after the Matching module;
  - E3: the comment.

  The census probes reclassify into `REPLAY_OUTSIDE_PERSONAL` what this module cannot cover: an approver or
  authorization row, a non-`MY_WORLD` manifest, a package, a reconciliation command or event. The operations summary
  counts both Replay classes. A07 proves each body is 0164's plus exactly these edits.
- **`ON DELETE RESTRICT` without overriding others' rights.** The distribution approvers and authorizations (0104) name
  another human's right. They are not deleted: such an account answers a truthful `BLOCKED (REPLAY_OUTSIDE_PERSONAL)`
  and nothing is erased (R03).
- **Registry.** 29 Replay relations are registered in `coverage_registry`, with class `REPLAY`; `REPLAY` is covered and
  `REPLAY_OUTSIDE_PERSONAL` is admitted, not covered. A08 proves every relation that references the account or a Replay
  relation is registered.
- **Real PostgreSQL:**
  - a populated footprint ERASED to zero references while another human is untouched (R01);
  - 0130 refusing after the module ran rolls everything back, answering `RETRY` (R02);
  - the outside class `BLOCKED` with nothing touched (R03);
  - the re-arm of a request whose census is now clean (R04);
  - the narrowed guards (R05);
  - an erasure against an in-flight revision answers `RETRY` in its lock timeout, then `ERASED`, with no deadlock (G04);
  - a revision against an in-flight erasure waits, then finds nothing (G05).
- **Coordination only, not taken:**
  - `QAN-BL-PROD-09` (owner `HOSTED-DEPLOY-01`) is untouched;
  - `QAN-BL-PRIV-05` (owner `PRIV-EXPORT-01`) gets only the coordination interface and data boundaries, as a dated note
    on the item;
  - no export is added, and `'replay'` stays in `notYetIncluded`.

## 7. Frozen authorities: what changed, and why it is not an unapproved substantive change

- **The I-06 ACL posture (§11 / §30).** I-06 anticipated "a later reviewed … wrapper" that preserves `auth.uid()`. The
  WP0 corrections addendum specified this exact shape (D3), and the approved S7-01 brief requires it ("a pattern
  compatible with 0138, 0140 and 0143 … no direct EXECUTE on the I-06 cores"). No frozen function gained an
  application-role grant.
- **The two I-06 history guards** (`reject_replay_component_mutation_v1`, `reject_replay_version_component_mutation_v1`).
  Each is narrowed in place with exactly 0164's prefix: a `DELETE` passes only inside the ONE transaction-bound governed
  erasure. Every other line is byte-identical (A06). This follows the 0164 precedent for 0130's guards.
- **The 0164 coordinator, census and operations summary.** They are forward-replaced with named edits only (A07), as
  the 0164 framework requires a new module to do. The three coordinator edits are defined once
  (`coordinatorWithS701Edits` in `replay-personal-verifier-support.mjs`), and both 0169 A07 and 0166 A03 compare the live
  body to it exactly.
- **Not changed:** any I-06 primitive or core body, any contract, 0072, 0130 and CW2-08. No frozen authority needed a
  Product Owner decision beyond the approved WP0, so this task did not stop at a decision point.

## 8. Findings for the Product Owner and the next tasks

1. **The open head.** A moment is sealed only below the Live Head, the frozen I-06 / 0072 sealing law. A range that
   reaches a conversation's newest message answers `MOMENT_NOT_SEALED` until a newer message exists (E05 proves the same
   draft previews once it is sealed). This is a product consequence for S7-02 / S7-03: how the selection presents the
   newest message. It is not a defect.
2. **`list_my_conversation_replays_v1`** is a per-conversation re-entry read: the caller's own Replays of one
   conversation, oldest first, at most 100. It is **not a library**. Whether S7-02 surfaces it is S7-02's product
   decision.
3. **A LEGACY UNCOVERED conversation.** The draft is real, and the preview answers `ANALYSIS_UNAVAILABLE` (E06).
4. **Audio (D7).** No audio exists on this path. The wire carries `original_medium` as recorded, and a client must never
   present it as playable.

## 9. Evidence

All local runs used PostgreSQL 17.10 on a database migrated `0001` … `0169`.

### 9.1 Real PostgreSQL

| Verifier | Result |
|---|---|
| `verify-migration-0169` | 34 scenarios, 34 passed (A01 – A09, E01 – E14, R01 – R05, G01 – G06) |
| `verify-migration-0150` (re-anchored) | 28 / 28 |
| `verify-migration-0164` (re-anchored) | 29 / 29 |
| `verify-migration-0166` (re-anchored, §9.6) | 23 / 23 with 0169; 23 / 23 on `0001` … `0168` without it |
| `verify-migration-0167`, `0168`, `verify-matching-consent-texts`, `verify-s6-07-final-journey` | 13 / 13, 13 / 13, 7 / 7, 7 / 7 (the CI steps after 0166, run locally after the correction) |
| `verify-migration-0100` … `0107` | each verified (0102 16, 0103 38, 0104 25, 0105 48, 0106 23, 0107 35 scenarios) |
| `verify-migration-0149`, `0132`, `0130`, `0072` | verified |
| `verify-migration-0133` | **not run locally**: it needs `psql`, which this machine lacks. It runs in CI |

One `verify-migration-0130` run failed once on its 7-day grace-window time check. It passed on a fresh 0169 database,
and also on the 0168 baseline.

### 9.2 API and contracts

Local runs on the closing tree:
- `apps/api` Jest: the full suite, 262 suites and 6166 tests, all passed. That includes the Replay spec (56 tests) and
  the T-03C specs with the new parity tests. `tsc --noEmit` is clean.
- `database/tests/*.test.mjs` (static): 1310 / 1310, including the verifier-hazard contract.
- `tests/*.test.mjs` (static contracts): the results are in §9.5. `npm run test:task-closure-governance-contract` gives
  24 / 24.

### 9.3 Re-anchored contracts

Each change is commented in place as `RE-ANCHORED by S7-01`:
- `ReplayModule` is composed after `IntroductionsDispatchModule` (S6-02, S6-05, S6-06, S6-07 ×2);
- the 0150 ABSORBED array may end with S7-01's commented Replay entries (S6-04, S6-05, S6-06, S6-07 ×2);
- the typed-error reader census admits `replay.service.ts` under the same `22023` rule;
- the Project Map's current task is S7-01, and the merged S6-07 is no longer it (S5-03B, S5-03C);
- the rate-limit census classifies the 11 Replay routes: preview is strict, and the rest are authenticated (PROD-SEC-01);
- `verify-migration-0166` A03 (S6-07 CP2): the coordinator is byte-compared to the pre-0166 body plus exactly the three
  0169 edits where 0169 is applied, and to the pre-0166 body where it is not (§9.6);
- ACCT-DEL-01:
  - the coordinator alone opens the erasure; 0164 defines it and 0169 alone forward-replaces it;
  - `QAN-BL-ACCT-02` is tombstoned by S7-01, and `QAN-BL-ACCT-03` is owned.

### 9.4 Engineering-ready, and still closed to users

| Engineering-ready (in the repository, from the merge) | Still closed |
|---|---|
| the secure boundary and its 11 wrappers; the API's 11 routes; the graphics-free contract; the erasure module | the Personal Replay capability (no gate row: every command `NOT_AVAILABLE_NOW`); opening it is an operator act behind the Product Owner's approval |
| the moment analysis through the canonical projection | no player, no mobile surface, no entry (S7-02 … S7-05) |
| idempotent, race-safe commands; `40001` absorbed | the hosted environment (`NOT_DEPLOYED`; `HOSTED-DEPLOY-01`) |
| | CW2-08 and every distribution path; audio (Stage 8B); export of Replay data (`PRIV-EXPORT-01`) |

### 9.5 Static contracts

`tests/*.test.mjs`: 1474 / 1474 on the closing tree (2026-10-19). That includes this task's contract (17 tests), the
re-anchored contracts and the forward-safety mirror. CI on the pull request's exact head is the gate for review.

### 9.6 CI correction R1 (2026-10-19): `verify-migration-0166` A03

**The failure.** CI on `082309ca` failed in `API CI` / `verify-api`, at the step "Verify S6-07 forward dispatcher
against real PostgreSQL": 22 of 23 passed. A03 compared the live `account_erasure_private.erase_account_v1(uuid)`
byte-for-byte to its last definition before 0166, but 0169 forward-replaces it with the approved Replay module. The
local evidence in §9.1 had not run 0166. The steps after it did not run in CI.

**The correction, verifiers only.** No migration, no Replay logic and no erasure logic changed.
- The three 0169 edits to the coordinator (E1: the Replay lock; E2: the module and its residue check; E3: the coverage
  comment) now live in one place, `coordinatorWithS701Edits` in `replay-personal-verifier-support.mjs`. 0169 A07 uses it
  in place of its inline copy. Each anchor must occur exactly once.
- 0166 A03 still compares every other frozen body byte-for-byte to its history. For the coordinator, the expected body
  is the pre-0166 body plus exactly the three edits when `erase_personal_replays_v1` exists, and the pre-0166 body when
  it does not. Nothing else is accepted.
- Where 0169 is applied, A03 also asserts these points on the live coordinator:
  - the lock order: the claims, then the Replays, then the account row, then the request;
  - the Replay module is called exactly once, after `module_residue_v1`, with its residue check before the
    authorization ends and before 0130;
  - no application role executes either new module function.
- The coordinator's own EXECUTE posture keeps being checked as before.
- The focused group `s7-01` now includes 0166, and this task's contract requires it.

**Negative proof** (planted with `CREATE OR REPLACE` on fresh databases):

| Database | Result |
|---|---|
| An extra `PERFORM 1;` after the Replay module call | 0166: 22 / 23, A03 fails |
| The Replay lock moved after the account-row lock | 0166: 22 / 23, A03 fails |
| The extra statement, under 0169 | 0169: 33 / 34, A07 fails |
| Without 0169 (`0001` … `0168`) | 0166: 23 / 23, the coordinator is the pre-0166 body |

**After the correction**, on fresh `0001` … `0169` databases:
- 0166: 23 / 23; 0169: 34 / 34; 0164: 29 / 29;
- 0167: 13 / 13; 0168: 13 / 13; the consent texts: 7 / 7; the S6-07 final journey: 7 / 7.

The S7-01, S6-07 forward-dispatch and verifier-hazard contracts give 53 / 53. CI on the new head is the gate.

## 10. Closure: BG-08 / BG-09

This is the closing change of S7-01, under the Product Owner's checkpoint rule: no separate documentation task.

- **Inherited:** `QAN-BL-ACCT-02`, **`CLOSED — TOMBSTONE`**, with its backlog §6 record, holding from the merge.
- **Admitted:** `QAN-BL-ACCT-03` (`HIGH`, owner Stage 9, Replay distribution / CW2-08): the account erasure outside the
  Personal Replay. The ID was unused in the tree and in every ref's history.
- **Dated note:** on `QAN-BL-PRIV-05`, the coordination interface. No field changed.
- **Checked, not admitted:**
  - the open-head consequence (§8.1);
  - opening the capability;
  - `QAN-BL-NAV-02`, which stays `OPEN — UNASSIGNED` (the WP0 places it at S7-05);
  - `QAN-BL-PROD-06` / `09`, both unchanged.
- **Register:** 77 items; 36 / 4 / 9 / 28 by status, 43 / 32 / 2 by severity, recounted mechanically. Current State's
  active list was regenerated in the same change, since it had drifted.
- **BG-09:** this record's own banner is final (`CLOSED / AT THE S7-01 INDEPENDENT REVIEW GATE`). I-06 stays
  `CLOSED / FROZEN` with its §64 amendment.

## 11. Integration boundaries for the next tasks

**S7-02 — entry and selection in the app.**
- It calls `GET /replay/capability` as a hint only: every command re-binds the gate.
- It creates a draft with `POST /replay/drafts { commandId, sessionId, firstTc, lastTc }`, where `firstTc` / `lastTc`
  are the first and last selected messages' Session Positions, then revises with the draft revision it read.
- It owns the presentation of the bounded words, through the Copy Gate:
  - `NOT_WHOLE_MESSAGES`;
  - `MOMENT_NOT_SEALED` (§8.1);
  - `ANALYSIS_UNAVAILABLE`;
  - `NOT_AVAILABLE_NOW`.
- It decides whether to show the per-conversation list (§8.2).
- It never sends a user, an owner, a source class or a unit id. A retry reuses the same `commandId`.

**S7-03 — the composite player proof.**
- It consumes the version, the moments and each moment's analysis only:
  - `GET /replay/:replayId/versions/:versionId`;
  - `…/moments`;
  - `…/moments/:ordinal/analysis?depth=`.
- It renders a moment's analysis through the existing analysis surfaces. The rungs are T-03C's (`world`, `thread`,
  `session`, `analyticalObject`, `sourceProvenance`), and `tc` is the represented Session Position.
- It adds no graphic to the API, and Replay data never drives graphics directly. It honours the `renderContract`
  policies and the frozen T-06 motion law.
- It shows gaps from `omittedBefore`, and `NOT_VIEWABLE` with its class and both layers.
- It never presents a moment's analysis without its text, or text as audio.

**S7-04 — the production player and navigation.**
- It uses the same reads, with no new read path.
- Preview is `POST /replay/:replayId/preview { commandId, expectedDraftRevision }`. Finalize is
  `POST …/finalize { commandId, expectedVersionId }`; reopen uses the same body.
- The player must not change the live conversation's state. It reads historical truth only, and the return anchor is
  the client's.
- Any further read, field or route is a change to this boundary: a reviewed migration and API change, with its verifier
  and contract.
- G3.2 fixture history stays a proof, never a source of user truth.

## 12. Deliberately not implemented

The following are not in this task:
- a player screen or controls, or any mobile surface;
- an analysis redesign, map colours or graphics;
- audio, video, download, publication, distribution or a library;
- a frozen-contract change outside §7;
- `QAN-BL-PROD-09`;
- a parallel export (`QAN-BL-PRIV-05`);
- opening CW2-08 or the Personal Replay capability.
