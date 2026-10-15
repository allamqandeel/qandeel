# QANDEEL — S6-04 Implementation Record v1

**Task:** S6-04 — Private Proposal Review and Decisions  
**Stage:** 6 — Matching & Introductions  
**Product authority:** the Product Owner's S6-04 Task Contract v1.0 and its twelve binding decisions D1–D12
(2026-10-15), with the earlier Stage 6 decisions it names (GATE-21, GATE-23, GATE-27, GATE-28, GATE-37) and the binding
records it lists. No merge or deployment without the Product Owner's explicit «ادمج».  
**Status:** **IMPLEMENTED — READY FOR PRODUCT OWNER REVIEW — PRODUCT COPY GATE CLOSED — NOT MERGED / NOT DEPLOYED**
(2026-10-15). The Product Owner closed the Product Copy Gate on 2026-10-15 ([package](QANDEEL_S6_04_PRODUCT_COPY_GATE_PACKAGE_v1.md)
§0, §7 below): CG-1 and CG-3 … CG-7 approved; under CG-2, M-01 is kept but not displayed in S6-04. The TalkBack proof
ran on an emulator only (§3.2), which is not a device proof.  
**Base:** `main` = merged PR #341 (S6-03) at `869b3ca63ec8dde830aaa31847588e7f03b55d05`, re-verified at the start.  
**Branch:** `s6/s6-04-private-proposal-review-decisions` (one pull request).  
**Migration:** `0158_matching_private_proposal_review_decisions_v1.sql` (the number was free at the base).

Closing S6-04 is not launching Matching. After it there are zero real proposals, no enrollment, no installed policy, no
compatibility producer, no running producer, orchestrator or sweeper, and no open launch gate. The CW2-08 seam still
answers `NOT_EVALUATED`, so in production every reader lists nothing and every consequential decision is refused.

## 1. WP0 — repository truth and anti-duplication (read-only, before any change)

| # | Question | Finding |
|---|---|---|
| 1 | `main` and S6-01/02/03 | `main` = `869b3ca6`, the merge of PR #341. PRs #339 (S6-01), #340 (S6-02), #341 (S6-03) are MERGED. Current State still called S6-03 "NOT MERGED" (reconciled here, §9) |
| 2 | Existing review / decision functions | `0114` `approve_matching_proposal_forward_core_v1`; `0120` `decline_matching_proposal_as_first_core_v1`, `decline_matching_proposal_as_second_core_v1`, `withdraw_matching_proposal_core_v1`. Each derives the human from `auth.uid()`, enters through `enter_matching_proposal_decision_v1` (bounded not-found from immutable membership, then the two-human lock), checks the exact view under the lock, is idempotent from durable rows (a reused id with another request is 23505), and gates on CW2-08 last — except withdrawal, which is deliberately ungated (`0112` header, `0120:941-943`) |
| 3 | Privileges | All four cores and both projections are executable by NO role (`0112` §10, `0120` §8, `0156`). Nothing wraps them. `I-07` §22 leaves the wrapping to a later reviewed boundary; GATE-21 gives Stage 6 closed integration boundaries |
| 4 | `resolve_my_matching_proposal_v1` after S6-03 | One proposal at a time, `auth.uid()`, no recipient parameter; returns view id, proposal id, `presented_first_name = NULL`, `safe_compatibility_conclusion = NULL` (every state, CW2-06B-07), the neutral outcome, and `action_available = (outcome = 'AWAITING_YOU')` — not a withdrawal right |
| 5 | Listing / display path | None in the database, the API or mobile. No mobile proposal code or copy existed; the S6-01 C07 row stays deferred |
| 6 | API patterns | The caller's own bearer to PostgREST (`SupabaseDataApiService`), so `auth.uid()` is the caller; `SupabaseAuthGuard`; manual strict decoding; the command id in the body, idempotency in the database, no retry; only a database `22023` is the client's fault, everything else 503 with no database detail; modules composed through `AccountModule` (the root is pinned); every route in the rate-limit census |
| 7 | Tests that protect I-07 / S6-02 / S6-03 | `verify-0108` … `0122`, `0149` (NO_BACKDOOR transitive census), `0150` (PROD-RETRY-01 retry-hazard guard), `0155` / `0156` / `0157`; static contracts `sec-match-00`, `prod-retry-01`, `s6-02`, `matching-*`; API census and isolation specs |
| 8 | GitHub vs the historical files | The only drift found is the S6-03 merge not yet in Current State / Project Map / Roadmap (reconciled here) |

**Traps found and how the plan meets them.**

- **NO_BACKDOOR.** Every decision core enters through the pair lock, which upserts `matching_setup_locks`; any
  authenticated wrapper is therefore reached by `verify-0149`'s transitive census. Answer: admit exactly the three named
  S6-04 decision boundaries, as S6-02 admitted its one END boundary, with two new refused-weakening probes (§5).
- **PROD-RETRY-01.** The cores answer a stale view, a stale state and a failed revalidation with `40001`, which a
  PostgREST before v16 re-runs without bound. Answer: each decision boundary absorbs `40001` (naming `PT409` too, so it is
  no `CATCH_TRAP`) into a fixed word, and `verify-0150` names the three as absorbers (§5).
- **Expiry.** The decision cores never read the deadline; only expiry and the sweeper do. WP0 assigned "clock enforcement
  after expiry" to S6-04. Answer: the deadline is decided in the one presentation helper against `clock_timestamp()` read
  after the lock.
- **Withdrawal's `p_expected_state`.** The core needs the exact prior state. Answer: it is read on the server under the
  lock (or, for a replay, from the committed transition), never sent by the client.
- **The withdrawal right.** `action_available` means AWAITING_YOU only. Answer: one server-side helper derives the offered
  decisions from the caller's own current view and the proposal state, and both the reads and the decisions use it.
- **The frozen I-07B type file** (`matching-proposal.types.ts`) still types the name and conclusion as strings. Answer: it
  is not edited; the S6-04 API and mobile contracts are new, narrower types that carry neither column at all.

**What the plan deliberately does not touch.** Any I-07 core, projection, seam, policy or privilege; `0001`–`0157`;
the S6-01 preparation module, its copy and its API; the S6-02 END boundary; acceptance, Mutual Match and Worlds; the
Activity and notification system; the Arabic Copy of earlier tasks; Issue #322.

## 2. What was built

### 2.1 WP1 / WP2 — migration 0158 (database)

| Function | Who | What |
|---|---|---|
| `resolve_my_matching_proposal_presentation_v1(proposal)` | nobody | Calls the frozen `resolve_my_matching_proposal_v1` (so the NULL name / conclusion projection is the source), then derives the decisions offered now from the caller's own current view: first recipient + AWAITING_YOU → `APPROVE_FORWARD`, `DECLINE`; second recipient + AWAITING_YOU → `DECLINE`; first recipient + IN_PROGRESS (forward-approved or forwarded) → `WITHDRAW`; otherwise none. A live proposal past its deadline (database clock) or failing its own revalidation (the boolean of `resolve_matching_proposal_validity_v1`, never the reason) reads `NO_LONGER_AVAILABLE` with no decision, so what is read and what is accepted never disagree. `presented_actions` drops the two consequential decisions unless the CW2-08 seam answers `CLEARED`; withdrawal is never dropped |
| `list_my_matching_proposals_v1(after, limit)` | authenticated | The caller's own delivered proposals (rows of their own recipient view state), newest first delivery first, at most 20 per page; the cursor is the last proposal of the previous page, and a cursor that is not the caller's own is the end of the list. Columns: view id, proposal id, neutral outcome, available actions |
| `get_my_matching_proposal_v1(proposal)` | authenticated | The same row for one proposal, or no row for anything else |
| `approve_my_matching_proposal_forward_v1(command, proposal, view)` | authenticated | over `approve_matching_proposal_forward_core_v1` |
| `decline_my_matching_proposal_v1(command, proposal, view)` | authenticated | over the first- or second-recipient decline core, chosen on the server from the caller's own view (a replay goes to the core that committed it) |
| `withdraw_my_matching_proposal_v1(command, proposal, view)` | authenticated | over `withdraw_matching_proposal_core_v1`, the expected state read under the lock; ungated |

Each decision: 42501 without a session, 22023 for a missing argument; `enter_matching_proposal_decision_v1` first; a
replay of a committed command goes straight to its core (answered from durable rows); otherwise the decision must be one
the helper offers under the lock; then the core, which keeps its own exact-view, revalidation and CW2-08 order. Answers:
`RECORDED` (with the core's neutral outcome), `CHANGED` (a moved view or state), `UNAVAILABLE` (anything with nothing to
decide, one answer), `NOT_AVAILABLE_NOW` (CW2-08 not cleared), `COMMAND_CONFLICT` (23505). Every refusal rolls back
everything the attempt touched, the lock row included. A contradictory durable state (`P0001`) is not absorbed.

### 2.2 API (`apps/api/src/introductions-proposals`, through `AccountModule`)

`GET /introductions/proposals?after=&limit=` → `{ proposals, next }`; `GET /introductions/proposals/:proposalId` →
`{ proposal | null }`; `POST /introductions/proposals/:proposalId/{forward-approval|decline|withdrawal}` with exactly
`{ commandId, viewId }` → `{ outcome, proposal }` (the proposal re-read after the decision). The caller's own token; no
identity, role or state from the client; strict four-field decoding (a row with any other field fails closed); only a
database `22023` is `INVALID_REQUEST`; everything else is 503 `{ outcome: 'UNAVAILABLE' }` with nothing of the database
answer; one call, never retried; nothing logged. Five census entries.

### 2.3 WP3 — mobile (`apps/mobile/src/introductions`)

- `introduction-proposals-api.ts` (runtime-entry): the transport; strict decoding; `OFFLINE` distinct from `UNAVAILABLE`.
- `proposals-controller.ts`: one controller per runtime generation, retired with it; reads only when asked; a decision is
  sent only when the server offered it, bound to the exact view shown; a lost answer is retried with the same command id;
  one decision at a time; a failed read shows nothing it cannot vouch for.
- `ProposalsSurface.tsx`: the space (neutral cards: «مقترح تعارف خاص» and the status — nothing about anyone), the review
  (the review lead — M-01 is not displayed, CG-2 —, QANDEEL's role, what forward approval means and that it does not start an introduction, M-03),
  the short confirmations (forward approval restates its meaning; decline asks for no reason; withdrawal explains its
  effect first), the neutral endings, the loading / empty / unavailable / offline states, "show more"; Back walks one
  level at a time (Android system Back too); the screen reader lands on each level's heading; notices in a polite live
  region; no acceptance button anywhere (the second recipient sees «خيار بدء التعارف … غير متاح بعد»).
- `ProposalsCue` inside the Introductions surface and a quiet mark on the Introductions entry while a delivered proposal
  waits (D1, D11): never a count, never repeated, never urgent; the entry's screen-reader label carries the arrival line.
  With no proposal the entry and the surface are exactly the S6-01 ones.
- `proposals-copy.ts`: 45 Arabic / English rows, each marked `APPROVED` (§7); M-01 kept in `PROPOSALS_LANG01_APPROVED`, not rendered.
- Validation only: `integration/__validation__/s604-proof-proposals.ts`, four SYNTHETIC opaque proposals behind
  `qandeel://s401-proof/introductions/seed-proposals` in the S4-01 proof build (never the production bundle; answers
  nothing until seeded; guarded by `s6-04-proof-proposals.test.ts`), for the TalkBack proof of §3.2.

## 3. Evidence

All database proofs on a disposable local PostgreSQL 17 cluster with every migration `0001`–`0158` applied; CI on the
exact head is the confirmation gate.

| Area | Proof |
|---|---|
| Posture: five authenticated-only, the helper and every core executable by nobody, `auth.uid()`, no actor / role / state parameter, no name / conclusion / field read, lock → helper → core order, 40001 absorbed with PT409 named | `verify-0158` A01–A04 |
| Production stays closed: NOT_EVALUATED, no proposal, nothing listed, every decision UNAVAILABLE, no lock row for a fresh human, anon refused, no session refused, bad page sizes refused | `verify-0158` B01 |
| Own delivered views only; nothing for the second recipient before forward approval; the real proposal reads exactly as a nonexistent one to anyone else; no acceptance offered | `verify-0158` C01, F01 |
| No name, conclusion, field, role, state, date or counterparty in anything a reader receives | `verify-0158` C02; API spec; mobile transport tests |
| Bounded pages, newest first, a cursor that is not the caller's own ends the list | `verify-0158` C03 |
| Forward approval binds the exact view, creates no Match / World / Introduction | `verify-0158` D01, H01 |
| First and second decline through the right core; neutral to the other side | `verify-0158` D02, D03 |
| Withdrawal from FIRST_FORWARD_APPROVED and FORWARDED_TO_SECOND, the state read on the server; the second recipient keeps a neutral view | `verify-0158` D04, E03 |
| A decision not offered is UNAVAILABLE and writes nothing | `verify-0158` D05 |
| Neutral equality: second decline = expiry = staleness; competing Match NO_LONGER_AVAILABLE to both; withdrawal = expiry for the second recipient | `verify-0158` E01–E03 |
| A superseded view: CHANGED, nothing written | `verify-0158` F02; `prove-0158` (on the wire, every PostgREST line) |
| Past the deadline: NO_LONGER_AVAILABLE, every decision UNAVAILABLE, nothing written | `verify-0158` F03 |
| Failed revalidation: the reads say NO_LONGER_AVAILABLE with no decision for both recipients, every decision is UNAVAILABLE, nothing written (not even a lock-row version) | `verify-0158` F04 |
| CW2-08 closed: no consequential decision presented or taken; withdrawal still works (D7) | `verify-0158` F05 |
| Replay answers from the committed row; a reused id for another act or view is COMMAND_CONFLICT | `verify-0158` G01; `prove-0158` |
| Races on two real connections: two decisions of one human; withdrawal against the second decline | `verify-0158` I01, I02 |
| Result | **`verify-0158` 25 / 25** on a fresh database |
| Regression on one fresh database with `0158` | `verify-0108` … `0122`, `0130`, `0132`, `0149` (24 / 24 with f6, f7), `0150` (28 / 28), `0154`, `0155`, `0156`, `0157`, `0158`: **24 / 24 verifiers pass** |
| API | `introduction-proposals.spec.ts` **46 / 46**; `npm run build:api` passes |
| Mobile | `proposals.test.tsx` **45 / 45** (after CG-2); the proof stand-in guard `s6-04-proof-proposals.test.ts` **3 / 3**; `src/introductions` + `src/runtime-entry` + S4-04 **379 / 379**; `tsc --noEmit` passes; full suite §3.1, §3.3 |
| Static contract | `tests/s6-04-private-proposal-review-decisions-contract.test.mjs` **8 / 8**; root contracts §3.1 |

### 3.1 Full suites (before the review fixes of §8; the affected suites were re-run after them)

- Root contracts: **1383 / 1383**. `npm run test:database`: **1310 / 1310**.
- Mobile, the whole suite: **2524 / 2530**. The six failures are the documented host-locale baseline (`ar-EG` on this
  machine): three W1A-01 cases in `depth.test.tsx` and three session-end cases in `w2-account-access.test.tsx`, the same
  without S6-04. A seventh failure caused by S6-04 (S4-04's "no Shared proposals read" matched `/introductions/proposals`)
  was fixed by the re-anchor in §5.
- After the §8 fixes: `verify-0158` 25 / 25, `verify-0149` 24 / 24, `verify-0150` 28 / 28, `verify-0112` 22 / 22,
  `verify-0114` 35 / 35, `verify-0120` 27 / 27, `verify-0156` 31 / 31, `verify-0157` 33 / 33 on a fresh database; the
  API, mobile and contract suites above.
- After the Copy Gate decision and the TalkBack proof stand-in (2026-10-15): root contracts **1383 / 1383** (forward-safety
  35 / 35), `npm run test:database` **1310 / 1310**, task-closure governance **24 / 24**, mobile `tsc --noEmit` passes;
  the whole mobile suite §3.3.

### 3.2 TalkBack on an Android emulator (AC-09) — PASS 13 / 13, one finding; not a device proof

Run on 2026-10-15 at the Product Owner's request: bounded, diagnosed, no blind retries. Code `d606e3ba`; proof APK sha256
`ec3ff4d6499d1836f79c82357345bff87d9ce07a82a90161cabecbc75be5dd95` (x86_64 release, S4-01 proof entry); emulator
`QANDEEL_API36` (API 36, 1080 × 2400); **no physical device**. SYNTHETIC data only (four opaque proposals from
`s604-proof-proposals.ts`). Gestures are real touchscreen events, so they pass through TalkBack's touch exploration; focus
is TalkBack's outline measured in each screenshot; labels come from the accessibility tree (full and compressed). Arabic
(RTL) full walk, English (LTR) entry → space → review. Evidence (screenshots, dumps, step table):
`.s6-04-native-proof/talkback/EVIDENCE.md` (local, untracked, like the earlier native proofs).

| # | Check | Result |
|---|---|---|
| T1–T2 | entry drawn only with a delivered proposal, label carries the arrival line, the quiet mark is not a separate stop | PASS |
| T3 | double-tap into «التعارف مع قنديل», the cue, and the proposals space | PASS |
| T4 | each card reads "title، status" (CG-7); nothing about anyone | PASS |
| T5 | while the space is open nothing beneath it is offered to the screen reader (compressed tree) | PASS |
| T6 | first-recipient review: lead, role, the meaning of allowing, M-03 verbatim, **no M-01** (ar and en), only allow / decline | PASS |
| T7–T8 | allow → confirmation → in progress with withdrawal; withdraw → confirmation → ended, notice in the polite live region | PASS |
| T9 | second recipient: «خيار بدء التعارف من هذا المقترح غير متاح بعد.», decline only, no reason asked, recorded | PASS |
| T10 | an unavailable proposal offers no decision | PASS |
| T11 | on-screen Back (double-tap) and system Back through every level | PASS |
| T12 | with nothing waiting the arrival line and the mark disappear (D11) | PASS |
| T13 | English LTR labels and the approved English review | PASS |

- **F-1 (MINOR, cross-cutting) — programmatic focus is not reliably honoured.** The surface asks the screen reader to
  land on each level's heading and, on the way back, on the cue and the entry (`setAccessibilityFocus` right after the
  screen changes; jest proves the request). TalkBack honoured it after the three asynchronous decisions (forward
  approval, withdrawal, decline: focus on the heading) but not when a level opened or closed: focus stayed on the bar
  title (Arabic) or the Back control (English), and on return went to the Introductions title and then the Analysis door.
  Opening the allow confirmation briefly left focus where the allow button had been — now the confirm button — before
  TalkBack moved it to the title; the following double-tap landed on the title and did nothing. **No decision was taken
  without an explicit explore and double-tap on the decision control.** The likely cause is a race between the request
  and TalkBack's own placement after a window-content change. Every surface of the app uses the same immediate pattern
  (S6-01, Settings, Activity, Shared), so this is not specific to S6-04. It is recorded, not silently fixed, and the
  Product Owner decides its handling (§10).
- **Not verified:** speech. The emulator's TTS never initialised (TalkBack: "TTS is not ready"), so what TalkBack says
  aloud, including live-region announcements, is unverified; the nodes and their texts are verified.
- **Harness limits (not counted as Product failures):** injected explore touches were sometimes not registered after a
  first success; TalkBack keyboard shortcuts need a physical keyboard.

An emulator run does not replace a physical-device TalkBack proof before launch (Product Owner, 2026-10-15; §10).

### 3.3 The six mobile failures are the base's own

The whole mobile suite on a detached worktree of the base `869b3ca6` (same `node_modules`, same machine, host locale
`ar-EG`) fails exactly six tests, **the same six by full name** as on the S6-04 head: three W1A-01 cases in
`depth.test.tsx` and three session-end cases in `w2-account-access.test.tsx`. Base: 2482 / 2488. Head (the CG-2 change on `ad514e51`, before the
proof stand-in): 2526 / 2533, the six plus `s4-03-proof-world` Journey A, a load timeout while both suites ran at once;
it passes alone and in the clean run. **Clean run of the whole suite at `d606e3ba` (alone): 2530 / 2536, exactly the same six.** No closed task is reopened.

### 3.4 CI — the API infrastructure failure and the exact head

- **What failed on `ad514e51`:** API CI's `verify-api` job never started its steps. Initialising its PostgreSQL service
  container, the runner's pull of `public.ecr.aws/docker/library/postgres:17@sha256:2d2b8998…` answered
  `toomanyrequests: Data limit exceeded` three times (the anonymous ECR Public quota); `Validation evidence (VAL-01)` then
  reported the gate NOT GREEN. No test ran, so nothing about S6-04's code was measured.
- **Why it is infrastructure:** the same digest-pinned image was pulled and API CI passed on `main` `869b3ca6` the same
  morning (run 38729965165), and on S6-03's heads before it.
- **Narrowest action:** no workflow, image or code change. The next push re-runs the job on the new head; if the quota
  error recurred, only the failed job would be re-run.
- **Exact-head result:** recorded in the pull request against the final head, because writing it here would change the head.

## 4. Privacy and fail-closed report

- **Identity** comes only from the verified session: the API passes the caller's token; every database boundary derives
  the human from `auth.uid()`; no boundary has an actor, recipient, role or state parameter (A02, API spec, contract 2).
- **No oracle:** another human's proposal, one never offered, one the second recipient holds no view of yet and one that
  does not exist are the same empty read and the same `UNAVAILABLE` decision; a non-member writes no lock row and a
  member's refused attempt leaves no lock-row version behind (F01 compares `xmin`, B01). The one difference left is the
  frozen 0112 design's: a member waits on the pair lock where a stranger is answered at once, which needs the proposal's
  opaque id, never shown to a candidate before forwarding (review finding 9).
- **No disclosure before Mutual Match:** the reads are built on the frozen NULL projection and return four columns; the
  API and the mobile transport refuse any row with any other field.
- **Neutral endings:** every ending caused by the other side, by time or by a private invalidation reads
  `NO_LONGER_AVAILABLE` — a live proposal past its deadline or failing its revalidation already reads so, before any
  sweeper — and no reason, date or state name leaves the database.
- **Launch stays closed:** the two consequential decisions need CW2-08 `CLEARED`, which production never answers; nothing
  installs a policy, a producer or a seam; no proposal can exist. Withdrawal alone is ungated, as D7 and the core require.
- **No mutation on refusal:** every refusal is raised inside the boundary's own block and rolled back with the lock upsert.
- **No Match or World** can come from S6-04: no S6-04 body names the Match commit, a World or an Introduction record (A03,
  contract 4) and H01 proves none appears.
- **Retry safety:** the cores' `40001` never reaches PostgREST; `verify-0150` proves the absorption from the live catalog.

## 5. Re-anchors (each tied to one forward change; none weakens a security assertion)

| Test | Re-anchor | Tied to |
|---|---|---|
| `verify-0149` NO_BACKDOOR | admits exactly `approve_my_matching_proposal_forward_v1`, `decline_my_matching_proposal_v1`, `withdraw_my_matching_proposal_v1` by exact signature, one overload each, authenticated-only; new probes f6 (a fourth decision wrapper is refused) and f7 (a decision boundary granted to service_role is refused) | WP2 |
| `verify-0150` GUARD | the three decision boundaries are named in the exact `ABSORBED` list; the analysis still proves each absorption from the live catalog | WP2, PROD-RETRY-01 |
| `tests/s6-02-…` test 6, test 7 | the census expression and the exact `AccountModule` imports now include the S6-04 additions; the END exception is unchanged | WP2, API |
| `tests/conversation-focus-runtime-integration-readiness-contract` | the exact typed-database-identity reader list includes the proposal service, pinned to one read that recognises only `22023`, never logged or returned | API |
| `apps/mobile/src/runtime-entry/__tests__/scope.test.ts` | the runtime-entry layer exports exactly one more transport class | WP3 |
| `apps/mobile/src/integration/__tests__/s4-04-shared-direct-entry.test.tsx` | "no Shared proposals read" now excludes the reader's own `/introductions/proposals` read | WP3 |
| `tests/s5-03b-…`, `tests/s5-03c-…` | the one current-task line names S6-04 (S6-03 merged as PR #341) | governance |

## 6. Deletion and export footprint

S6-04 adds no relation. Its decisions write only through the existing cores, into the existing `0110` / `0113` / `0120`
relations, which are already in `QAN-BL-ACCT-01` / `QAN-BL-PRIV-04`'s footprint. Nothing is committed in production.

## 7. Product Copy Gate — CLOSED (Product Owner, 2026-10-15)

The consolidated package is [QANDEEL_S6_04_PRODUCT_COPY_GATE_PACKAGE_v1.md](QANDEEL_S6_04_PRODUCT_COPY_GATE_PACKAGE_v1.md);
its §0 records the Product Owner's decision verbatim.

- **Approved:** CG-1 (the simplified-MSA `reviewLead` replacing «راجع المقترح وخد قرارك براحتك»), CG-3 (M-03 verbatim on
  the review of a waiting proposal), CG-4 (`acceptNotYet`), CG-5 (`MATCH_CONCLUDED`, `concludedBody`), CG-6 (every English
  row), CG-7 (the accessibility labels), and the package's texts. All 45 displayed rows are marked `APPROVED` in
  `proposals-copy.ts`; no `PROPOSED` marker remains (mobile test and contract 7).
- **CG-2 — not approved as proposed.** The Product Owner did not accept that a stored permitted conclusion by itself
  proves QANDEEL's genuine understanding of both people. M-01 is kept byte-exact in `PROPOSALS_LANG01_APPROVED` and is
  displayed nowhere in S6-04: the `opening` row and its use are removed and `reviewLead` is the review's first line
  (commit `d606e3ba`). Tests prove no displayed row, Arabic or English, carries it, and the contract proves the review
  draws none. Its future display needs real Stage 8A evidence; nothing replaces it with an unproven compatibility claim.
- **M-02** stays unused (CW2-06B-07 / -08).
- **Open:** nothing in S6-04's copy. The future display of M-01 is a Stage 8A-conditioned decision (§10).

## 8. Independent review

An independent read-only review of the two commits (identity, privileges, lock order, oracles, retry safety, API, mobile,
verifier honesty, governance claims) found **no BLOCKER and no MAJOR**. Its findings and their resolution:

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | MINOR | a proposal that failed its revalidation still read AWAITING_YOU with APPROVE_FORWARD offered while forward approval answered UNAVAILABLE: the read and the act disagreed, which could hint at a private change, and the UI could loop | **fixed**: the helper reads the validity boolean; such a proposal reads NO_LONGER_AVAILABLE with no decision, for both recipients (`verify-0158` F04 rewritten) |
| 2 | MINOR | that divergence survived only as a task-local residue | resolved by fix 1; nothing to admit |
| 3 | MINOR | F01's "not even a lock row" could not detect a committed upsert for a member | **fixed**: the footprint compares the lock rows' `xmin`; refusals are compared with it, replays (a frozen no-op lock upsert) without it (G01) |
| 4 | MINOR | a list read in flight could overwrite the answer of a later decision | **fixed**: a decision drops every read in flight (mobile test) |
| 5 | MINOR | the Introductions surface stayed readable under the proposals space; focus did not return to the way in | **fixed**: hidden from the screen reader while covered; focus returns to the cue's control (mobile test) |
| 6 | MINOR | a recorded decision whose re-read failed was reported as unavailable / "could not be sent" | **fixed**: the API answers the decision with `proposal: null`; the controller keeps the list and reads it again (API and mobile tests) |
| 7 | NIT | the S4-04 re-anchor excluded every `/introductions/` URL | **fixed**: narrowed to `/introductions/proposals` |
| 8 | NIT | a command id reused for another operation on the same proposal answers NOT_AVAILABLE_NOW / UNAVAILABLE rather than COMMAND_CONFLICT; it never commits (`append_…` refuses it) | accepted as recorded; the shipped client never reuses an id across operations |
| 9 | NIT | a member waits on the pair lock where a stranger is answered at once (the 0112 design) | accepted as recorded in §4; it needs the proposal's opaque id |
| 10 | NIT | until `0158` is hosted, the entry's read answers 503 (drawn as nothing) | an operational note for `HOSTED-DEPLOY-01`: deploy `0158` with the API |

## 9. Backlog disposition (BG-08) and locator reconciliation

- **Inherited:** none. The canonical backlog assigns no item to S6-04 (BG-05).
- **Observed, owners unchanged:** `QAN-BL-PROD-06` (`HOSTED-DEPLOY-01`; `0158` is not deployed), `QAN-BL-PROD-07`, `QAN-BL-VOICE-01`,
  `QAN-BL-NOTIF-02`, `QAN-BL-SEC-01`, `QAN-BL-ACCT-01`, `QAN-BL-PRIV-04`, `QAN-BL-MATCH-01`, `QAN-BL-MATCH-03`,
  `QAN-BL-MATCH-04`, `QAN-BL-LAUNCH-04` (Issue #322, still open and a launch blocker).
- **Checked and not admitted (BG-06):** the second recipient's acceptance, the Match and the World (S6-05, by the approved
  task map); Activity, Direct Entry and notifications (S6-07); the real conclusion producer (Stage 8A); launch clearance,
  policies and any limits (Stage 9 / CW2-08). Each has its owner; nothing is left only in this record.
- **Proposed, not admitted (awaiting the Product Owner, BG-06):** the physical-device TalkBack proof of the S6-04 surfaces
  and F-1 (§3.2, §10). They are named here and in the pull request so that neither survives only in a report; each
  becomes a register item, or an S6-04 fix, only on the Product Owner's decision.
- **Locators:** S6-03's merge (PR #341 as `869b3ca6`) is reconciled in Current State, the Project Map and the Roadmap; the
  register stays 69 items.

## 10. Remaining dependencies and risks

| Item | Owner | Note |
|---|---|---|
| Showing M-01 at all | Stage 8A, then the Product Owner | kept, not displayed (CG-2); only real Stage 8A evidence of QANDEEL's understanding of both people can justify it |
| Acceptance by the second recipient, Mutual Match, Introduction surfaces | S6-05 | not offered anywhere in S6-04 |
| Activity, Direct Entry, push for a delivered proposal | S6-07 | S6-04's cue is in-app only |
| A real proposal at all | Stage 8A (producer), Stage 9 / CW2-08 (clearance, policies), S6-07 (enrollment) | none can exist today |
| TalkBack on a physical device | **proposed:** Stage 9 release-readiness gate (with `QAN-BL-LAUNCH-04`'s device validation) — awaiting the Product Owner's admission decision | the emulator run (§3.2) passed 13 / 13 checks and is not a device proof; the Product Owner requires real-device TalkBack before launch |
| F-1 — programmatic screen-reader focus not reliably honoured (§3.2) | **proposed:** the Product Owner decides — fix inside S6-04, or admit a cross-cutting item (every surface uses the same pattern) | MINOR; no decision is ever taken without an explicit explore + double-tap; recorded, not silently fixed |
| `0158` not deployed | `HOSTED-DEPLOY-01` | with `0149` / `0150` in the same controlled window, and before or with the API that reads it (review finding 10) |
