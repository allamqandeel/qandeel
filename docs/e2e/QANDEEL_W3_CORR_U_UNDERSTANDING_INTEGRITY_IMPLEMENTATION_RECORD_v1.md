# QANDEEL — W3-CORR-U — Understanding Integrity — Implementation Record v1

**Status:** `W3-CORR-U` — **IMPLEMENTED — DRAFT PR, AWAITING INDEPENDENT REVIEW** (not merged by Claude).
**Baseline:** `main = ddc3e6c1531d47d2e2ef4977ace79ac97478b79f`. PR #301 (`PROD-SEC-01`) is merged; migrations through
`0133` are canonical.
**Branch:** `fix/w3-corr-u-understanding-integrity`. The **implementation evidence head** is `e5a0ed5`. Every commit
after it is documentation / governance only.
**Migration:** `0134_understanding_integrity_v1.sql` (the next free slot).
**Backlog:** no item names this task, so it inherits none (BG-05). One residue found by the Gap Sweep is admitted
with a named owner: `QAN-BL-PRIV-01` (§10). `QAN-BL-CTX-01` is unchanged.
**Claude did not merge anything.**

---

## 1. What changed, in plain words

- **The item you are discussing stays the item you are discussing.** You open an item from QANDEEL Understanding and
  then say "I see it differently". The disagreement moves that item to a new version. Before this task, QANDEEL then
  lost track of which item you were talking about. Now the same database transaction that records the disagreement
  also moves your discussion to the new version. When the discussion started, and when it lapses, do not change.
- **A disagreement can now be resolved, and it is never erased.** While an item is under review, the discussion line
  offers «أوافق عليه الآن» / "I agree with this now". Pressing it ends the review of that item. It changes nothing
  about the understanding itself: no confidence is invented and it does not become "clear". The item's history keeps
  «سُجّل رأيك المختلف» and adds «وافقت لاحقًا على هذا الفهم» / "You later agreed with this understanding".
- **Only two things resolve a disagreement:** your own explicit agreement, or QANDEEL withdrawing the interpretation
  (`REJECTED` / `RETIRED`). Stronger evidence, a `SUPPORTED` step or any other change resolves nothing. A withdrawal is
  never shown as if you agreed. A later disagreement starts a new contest; it never reopens an old one.
- **The AI sees what you are actually dealing with.** The AI still receives at most 8 interpretations. Within that
  bound, the item you are discussing comes first, then the items you disagreed with that are still under review, then
  everything else in the usual order. No ranking or relevance logic was added.

## 2. G0 — repository truth

- `origin/main` was exactly `ddc3e6c1531d47d2e2ef4977ace79ac97478b79f`. PR #301 is MERGED with that merge commit.
  The tree was clean. Migrations end at `0133`, so `0134` is next. Node `v24.19.0`, npm `11.17.0`.
- Main had not advanced, so there was no overlapping diff to inspect.

## 3. G1 — Skills

| Skill | Inspected | Used | Reason | Concrete effect |
|---|---|---|---|---|
| `code-review` (high) | yes | **yes** | the mandatory review | 5 findings: 4 fixed in `e5a0ed5` and 1 deliberately skipped (§11) |
| `security-review` | yes | attempted — **cannot run on this host** | its `!git diff …` shell step needs Bash, which Smart App Control blocks | replaced by the manual adversarial pass in §11; nothing is claimed beyond what that pass checked |
| `react-native-best-practices` | yes | no | the mobile change is one control and controller state; it adds no animation, threading or native module | none |
| database / PostgreSQL, NestJS, concurrency / state-machine skills | searched in the available list: none exists | — | — | the PostgreSQL primary documentation (§4) stood in |

## 4. Research refresh — primary sources

- [Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html). Under READ COMMITTED, an
  `UPDATE` that waits on a row lock re-evaluates its `WHERE` against the committed row version it waited for. Every
  focus write here is one guarded `UPDATE`, so a focus that was closed or moved to another item meanwhile simply no
  longer matches. The database was **not** switched to SERIALIZABLE.
- [Explicit locking and application-level consistency](https://www.postgresql.org/docs/current/applevel-consistency.html).
  Row locks taken in one documented order (§6.4) serialize each conflicting pair without deadlock.
- [Partial unique indexes](https://www.postgresql.org/docs/current/indexes-partial.html). 0127's
  `understanding_contests_one_under_review_idx` (`WHERE lifecycle = 'UNDER_REVIEW'`) already allows at most one open
  contest per reader and item while allowing any number of resolved ones. It is kept unchanged.

## 5. G2 — Direction Gap Sweep

Every listed term was searched across the backlog, the W3-MEGA-U record, the API, mobile, migrations, verifiers and
contracts: `UNDER_REVIEW`, `understanding_contests`, `understanding_discussion_focus`,
`record_understanding_disagreement`, `MAX_MODEL_HYPOTHESES`, `MAX_ACTIVE_HYPOTHESES`, `OPENED_FROM_UNDERSTANDING`,
`userContest`, `readOpenDiscussionFocus`, `listUnderReview`, `YOU_DISAGREED`, `REJECTED`, `RETIRED`.

| Finding | Disposition |
|---|---|
| U-1 … U-5 as the task lists them | closed here (§13) |
| **Evolution showed `YOU_DISAGREED` only for the contest under review.** A resolution would therefore have erased it from the detail. | fixed: the detail reads the item's whole contest history |
| **The MIXED step of an item that was already MIXED was hidden.** A disagreement on such an item suppressed the earlier, independent `BECAME_MIXED`. | fixed: only a disagreement's own re-evaluation step is folded into `YOU_DISAGREED` |
| **A replay of a disagreement whose contest was since resolved** answered `underReview: true`. | fixed (code review): it answers `409 UNDERSTANDING_ITEM_CHANGED` |
| **A pre-0134 contest left under review on an item since withdrawn.** | fixed: the forward reconciliation in §6.5 |
| **Personal export.** `yourDisagreements` stays complete and true, but the export does not carry the later agreement. Adding it is an export-shape decision for Privacy & Data, not for Understanding. | admitted with a named owner: `QAN-BL-PRIV-01` (§10) |
| **U-3 documentation.** The W3-MEGA-U record says "only after the reader chose talk to QANDEEL about this". | corrected in place with a dated note: it describes the mobile placement, not a server rule |
| `QAN-BL-CTX-01` | untouched (§12) |

Two **NO-ISSUE** confirmations from the sweep:
- `listContestsUnderReview` and `listUnderReview` filter `lifecycle = UNDER_REVIEW`, so a resolved contest is
  automatically no longer under review, both in the projection and in the provider context.
- The 0130 erasure deletes contests and focus rows. That path has no `UPDATE`, so the new lifecycle guard cannot block
  it.

## 6. Migration 0134 design

Forward-only. 0126 and 0127 are byte-identical; the contract pins both, and 0036's, by git blob id. 0127's command is
redefined in place with its exact signature.

### 6.1 Contest lifecycle model

```
UNDER_REVIEW ──(reader: USER_CONFIRMED_CURRENT_INTERPRETATION, with resolution_command_id)──► RESOLVED (final)
             └─(lifecycle step to REJECTED / RETIRED: INTERPRETATION_WITHDRAWN, no command id)─► RESOLVED (final)
```

- **New facts.** Four nullable columns: `resolved_at`, `resolved_version`, `resolution_reason` and
  `resolution_command_id`.
- **Allowed states.** `understanding_contests_lifecycle_check` allows exactly `UNDER_REVIEW` and `RESOLVED`.
- **Shape of the facts.** `understanding_contests_resolution_check`:
  - an open contest carries none of the resolution facts;
  - a resolved one carries all of them, with `resolved_at >= created_at` and
    `resolved_version >= reevaluation_after_version`;
  - a command identity is present exactly for the reader's own confirmation.
- **Idempotency.** `UNIQUE (user_id, resolution_command_id)`.
- **Finality.** `understanding_contests_lifecycle_forward_only` is a `BEFORE UPDATE` trigger that raises `55000` on any
  change to a `RESOLVED` row.
- **Original facts.** 0127's facts trigger still keeps the original disagreement immutable. Nothing deletes a contest,
  except the governed account erasure (0130).

### 6.2 Explicit resolution — `resolve_understanding_disagreement_v1(command, hypothesis, expected_version)`

The command is SECURITY DEFINER in `understanding_private`, with a `public` INVOKER pass-through. The owner is
`auth.uid()`. It takes no reason and no owner.

It runs these steps in order:
1. Lock the item `FOR UPDATE`.
2. Replay check: the same command answers `RESOLVED` at its committed version; reused anywhere else, it answers
   `COMMAND_CONFLICT`.
3. `NOT_FOUND` if the item is not one of the caller's current items.
4. `STALE` if the version differs from the one the reader saw.
5. `NOT_UNDER_REVIEW` if no contest is open.
6. One forward `UPDATE` that writes only the five lifecycle columns, with the reason fixed to
   `USER_CONFIRMED_CURRENT_INTERPRETATION`.

It does no lifecycle step, no Hypothesis write and no Confidence write.

### 6.3 Withdrawal resolution

`hypothesis_lifecycle_transitions_withdraw_understanding_contest` is an `AFTER INSERT` trigger on the lifecycle audit
table, `WHEN (NEW.after_status IN ('REJECTED', 'RETIRED'))`. The audit row is written by the one lifecycle core (0036)
in the same transaction as the step. The trigger resolves that item's open contest as `INTERPRETATION_WITHDRAWN`, with
`resolved_version` set to the withdrawal's version and no command identity.

What it deliberately leaves alone:
- the lifecycle core itself (stop condition 3);
- reads, which are never intercepted;
- every other status: `ACTIVE`, `SUPPORTED`, `MIXED`, `WEAK` and `REOPENED` resolve nothing;
- an old resolved contest, which a later `REOPENED` never mutates.

### 6.4 Focus rebinding law (U-1)

Inside `record_understanding_disagreement_v1`, after the contest row:

```sql
IF v_after_version <> v_item.version THEN
  UPDATE public.understanding_discussion_focus f SET hypothesis_version = v_after_version
   WHERE f.user_id = v_user AND f.hypothesis_id = v_item.id AND f.closed_at IS NULL AND f.hypothesis_version = v_item.version;
END IF;
```

- **What the update does.** Only the version moves. `opened_at` is never written, so the 30-minute window is
  unchanged. A closed focus never matches, a focus on another item never matches, and an item already `MIXED` makes no
  step and moves nothing.
- **What never moves a focus.** No trigger on `public.hypotheses` exists, so an unrelated lifecycle step never slides
  one.
- **Repair.** The `RECORDED` replay and `ALREADY_UNDER_REVIEW` answers run the same guarded repair. It applies only
  when all four facts hold:
  - the focus names the contested version;
  - the contest's after-version is the contested version + 1;
  - the item is exactly at that after-version;
  - the focus is still open.
- **Lock order:** the `hypotheses` row (`FOR UPDATE`, or `FOR SHARE` for opening a discussion), then the
  `understanding_contests` row, then the `understanding_discussion_focus` row. Closing a discussion takes only the
  focus row.

### 6.5 Forward reconciliation, once

- **a. Withdrawn items.** Every contest still `UNDER_REVIEW` whose item has a `REJECTED` / `RETIRED` audit row after the
  contest's after-version is resolved as `INTERPRETATION_WITHDRAWN`, at that first withdrawal's version and instant.
- **b. Stale focus rows.** Every open focus left at a contested version, where the contest's step was +1 and the item
  is still exactly there, moves to that version.

Nothing else is rewritten. The 0134 verifier executes this exact section from the migration text against crafted rows.

### 6.6 Privileges, after 0133

Every grant is explicit:
- EXECUTE on the record and resolve commands, private and public, for `authenticated` only;
- the two trigger functions are executable by no role;
- SELECT-only on both tables for `authenticated`;
- `service_role` revokes, and nothing for PUBLIC or anon.

## 7. API / projection and mobile behaviour

- **Route.** `POST /understanding/items/:ref/disagreement/resolve` takes the body `{ commandId, revision }` exactly.
  Its census class is `AUTHENTICATED`.
  - `200 { underReview: false, revision }` — resolved, or the same command replayed.
  - `409 UNDERSTANDING_ITEM_CHANGED` — the item changed since the reader saw it.
  - `409 UNDERSTANDING_NOT_UNDER_REVIEW` — the item has no contest under review any more.
  - `409 UNDERSTANDING_COMMAND_CONFLICT` — this command identity was spent on another item or version.
  - `404` — not one of the caller's current items.

  It calls no provider, no Confidence Runtime and no telemetry. The revision is matched to the version the reader saw,
  looking back at most 64 versions, so a lost answer is still answered after the item moved on. The database resolves
  only at the exact current version.
- **Projection.** The shape is unchanged; `underReview` turns `true → false`. The evolution keeps `YOU_DISAGREED` for
  every contest and adds `YOU_RESOLVED_DISAGREEMENT` only for the reader's own confirmation. No contest id, hypothesis
  id, command id, reason or evaluation id leaves the server.
- **Mobile — controller.** `agree()` is offered only while the discussed item is under review, with one request in
  flight at a time. It has its own durable command identity, never the disagreement's, keyed by ref and revision:
  - an unknown failure keeps the same command for the retry;
  - `CHANGED` and `NOT_UNDER_REVIEW` re-read the item first;
  - `GONE` removes the discussion;
  - a completion after the controller is retired changes nothing.
- **Mobile — after success.** The strip stays open with `underReview = false`, and "I see it differently" is offered
  again as a new contest.
- **Mobile — control and copy.** The control carries `accessibilityLabel`, plus `busy` / `disabled` while it is sending.
  A failure reuses «تعذّر تسجيل رأيك.» / "Your view couldn't be recorded.", so no third wording is invented. There is
  no Undo and no layout redesign.
- **Approved copy, exact:** «أوافق عليه الآن» / "I agree with this now" and «وافقت لاحقًا على هذا الفهم» / "You later
  agreed with this understanding". No conflicting canonical copy exists in the repository (searched).

## 8. U-3, U-4 and U-5

- **U-3 — `NO ISSUE BY PRODUCT SEMANTICS`.** The disagreement command is itself the reader's explicit act on one owned
  ref, one exact revision and one command identity. No server prerequisite was added.
  - Regressions: the API spec shows a direct disagreement with no discussion recorded; the 0134 verifier shows a
    disagreement with no focus row `RECORDED`.
  - Owner and version checks still hold: another reader's item is `NOT_FOUND`, and a stale revision is `STALE` or
    `409`.
  - The contract plants both a database and an API prerequisite and rejects each.
- **U-4 — `ALREADY CLOSED — PROD-OPS-01`, regression only.**
  - Unchanged: a disagreement still ENSURES the exact-version Confidence under the contest's identity, a failure is
    still `retry_pending` and fail-soft, and the contest stays committed. The PROD-OPS-01 telemetry tests and contract
    pass unchanged.
  - The resolution calls no Confidence and emits no signal; the spec asserts this.
  - The contract requires exactly one `recordOperationalOutcome` call.
- **U-5 — `FIXED BOUNDEDLY`.**
  - The order is: the valid exact-version focus first, then current `UNDER_REVIEW` items in repository order, then the
    rest in repository order.
  - The bounds are unchanged: `MAX_MODEL_HYPOTHESES = 8` and 24 000 characters. When focus plus contests exceed the
    bound, the list is truncated deterministically and `truncated` stays true.
  - No ranking, embedding or score was added; the contract plants one and rejects it.

## 9. Verification

| Check | Result |
|---|---|
| **Real PostgreSQL 17** `verify-migration-0134` (Focused Database Verification, `migration-0134`) | **PASS** — run 36893271269 at `007f162` ("1 verifier(s), 1 passed"). Re-run at the final implementation head: see the PR |
| 0126 / 0127 / 0130 / 0133 regressions (Focused Database Verification, dispatched serially) | see the PR body: each run is listed with its id and result |
| Combined 10-hypothesis proof | inside the 0134 verifier: real rows under the reader's RLS, fed to the **real compiled** `HypothesisReasoningContextService` (`apps/api/dist`): j first before and after (both markers after), i promoted inside 8, resolution drops only `userContest`, close drops only `userDiscussion`. The same scenario also runs as a Jest spec |
| API Jest (local, full minus the host-blocked bootstrap spec) | 208 suites / 4 828 tests passed, at `8602bac`; Understanding + Hypothesis + http-security re-run at `e5a0ed5`: 30 / 504 passed |
| Mobile Jest (local, full) | 162 suites / 1 945 tests passed; mobile typecheck clean; partial ESLint (non-resolver rules) clean |
| API build | `nest build` clean |
| Static contracts | W3-CORR-U 39/39 (**every** §18 planted defect rejected, plus extra variants); U1 25/25, U2 23/23, U3 34/34, PROD-SEC-01 31/31, PROD-OPS-01 29/29; root suite 1 029 / 1 029; `test:database` 1 281 / 1 281 |
| Full API CI / Mobile CI | on the Draft PR (see the PR body) |

Re-anchors, validation only, with permanent claims unchanged:
- `verify-migration-0127`'s exact column and trigger censuses now name 0134's four facts and its trigger.
- `verify-migration-0133`:
  - its "0133 is the latest" check becomes "0133 directly follows 0132";
  - its scratch replay now applies every later migration before comparing hosted with CI, which also proves 0134's
    grants under hosted Supabase defaults.
- The PROD-SEC-01 contract's "0133 is latest" check gets the same re-anchor.
- The U3 contract's "words sent" detector now checks **every** request body, because the identical resolution body
  would otherwise have blinded it.

## 10. Governance (BG-05 / BG-06 / BG-08 / BG-09)

- **BG-05.** The backlog was read in full. No item names W3-CORR-U, so nothing is inherited.
- **BG-01.** U-1 … U-5 were active-direction gaps. They are closed here, not laundered into the backlog.
- **BG-06 / BG-08.** One residue qualifies, and Architecture designates it in this closing change:
  `QAN-BL-PRIV-01 — Export My Data omits the reader's later explicit agreement with a disagreed Understanding item`.
  - Severity `MEDIUM`, owner `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts`, status
    `DEFERRED — OWNED`.
  - It is deferred rather than fixed because the export's shape is a Privacy & Data Product decision (W3-PDG-01 /
    W3-MEGA-S). Adding a field from inside an Understanding corrective would invent it.
  - The export remains truthful: every disagreement is still listed.
- **BG-09.** This record's banner is the task's lifecycle state. It moves to its final state with the merge that
  closes the task, as for `PROD-SEC-01` and `PROD-OPS-01`.

## 11. Review findings and dispositions

**`code-review` (high).**

| # | Finding | Disposition |
|---|---|---|
| 1 | Replaying a disagreement whose contest was since resolved answered `underReview: true` | **fixed**: `409 UNDERSTANDING_ITEM_CHANGED`, and the client re-reads |
| 2 | A resolution replay after the version moved answered 409, not the committed success | **fixed**: the API binds the seen version, looking back at most 64; the database answers the replay or `STALE` |
| 3 | Duplicated status list in `validateContestHistory` | **fixed**: `UNDERSTANDING_SURFACE_STATUSES` |
| 4 | A self-referential statement check in the verifier | **fixed**: compared with the pre-resolution row |
| 5 | The combined DB proof uses equal timestamps | **skipped**: the priority rule concerns group membership, not timestamps. The Jest spec proves it on fixed orders, and the DB proof's purpose is the atomic rebinding on real rows |

**Manual adversarial security pass**, in place of `security-review`, which cannot run here (§3):
- **Owner and identity.** The owner comes only from `auth.uid()`. There is no `p_user_id`, `p_owner` or `p_reason`
  anywhere.
- **Definers.** Every DEFINER is in `understanding_private` with `search_path=''`. The withdrawal DEFINER is reachable
  only through audit inserts, and no client role may insert an audit row (0036).
- **Grants.** All grants are explicit and the trigger functions are executable by nobody. There is no client write and
  RLS is unchanged.
- **Inputs.** Every query is parameterised. The body is checked for exactly two keys; any reason or userId field is
  refused with `400`.
- **Throttling.** The route is in the PROD-SEC-01 throttle census.
- **Leaks.** No identifier or reason leaves the server.
- **Cost.** The look-back is a bounded 64 SHA-256 checks.

## 12. `QAN-BL-CTX-01` boundary

This task orders only by the reader's own explicit acts: their open focus and their open contests. It decides no
general conversational relevance among more than 8 eligible hypotheses, adds no score, embedding or ranking, and
changes no Living Analysis behaviour. That remains owned by `QAN-BL-CTX-01` → `QAN-CTX-01 — Conversational Relevance
Runtime`, unchanged.

## 13. Gap Closure Matrix

| Gap | Final disposition | Evidence / owner |
|---|---|---|
| U-1 Focus continuity | **FIXED** | 0134 §6.4 rebinding, replay / ALREADY_UNDER_REVIEW repair and §6.5 reconciliation. The 0134 verifier covers focus continuity, the two race families (disagreement vs close, disagreement vs a new selection), and the combined proof through the compiled service. The contract rejects defects 1–5 |
| U-2 Contest resolution lifecycle | **FIXED** | 0134 §6.1–6.3; the resolve route; `YOU_RESOLVED_DISAGREEMENT`; mobile "I agree with this now". The verifier covers the lifecycle, withdrawal, resolve vs resolve and resolve vs withdrawal. The contract rejects defects 6–17 and 25–28 |
| U-3 No server discussion prerequisite | **NO ISSUE BY PRODUCT SEMANTICS** | regression in the API spec and the 0134 verifier; the W3-MEGA-U record is corrected; the contract rejects defects 18–19 |
| U-4 Confidence retry visibility | **ALREADY CLOSED — PROD-OPS-01 / regression green** | PROD-OPS-01 contract 29/29 and the U3 telemetry specs pass unchanged; the resolution emits nothing; the contract rejects defect 24 |
| U-5 Provider-context priority | **FIXED BOUNDEDLY; general relevance owned by `QAN-BL-CTX-01`** | the reasoning context order; Jest 10-hypothesis, bound, character-budget and truncation specs; the DB-backed combined proof. The contract rejects defects 20–23 |

**Orphan gaps = 0.** Every same-direction finding of the sweep is fixed here (§5). The one adjacent residue is admitted
with a named owner (`QAN-BL-PRIV-01`).
