# QANDEEL — S6-05 Implementation Record v1

**Task:** S6-05 — Mutual Match & Introduction World  
**Stage:** 6 — Matching & Introductions  
**Product authority:** the Product Owner's S6-05 Task Contract v1.0 and its decisions D1–D7 (2026-10-15); the CP0 rulings
R-1 … R-8 and the approval of V-1 as the visual direction (2026-10-15); the «S6-05 — CP1 Final Approval & CP2
Authorization» (2026-10-15). No merge or deployment without the Product Owner's explicit «ادمج».  
**Status:** **IN PROGRESS — CP2 DELIVERED (MUTUAL MATCH SECURE INTEGRATION) — VISUAL GATE AND COPY GATE CLOSED — NOT MERGED /
NOT DEPLOYED** (2026-10-16). CP2 waits for the Product Owner's review; CP3, CP4 and CP5 are not started.  
**Base:** `main` = merged PR #342 (S6-04) at `35ad4e19ad7e449255e7d087d4420b5d3775cf86`, re-verified before the branch.  
**Branch:** `s6/s6-05-mutual-match-introduction-world` (one pull request for the whole task).  
**Migration:** `0159_matching_mutual_match_acceptance_v1.sql` (the number was free at the base).

CP2 is not launching Matching. After it there are still no real proposals, no enrollment, no installed policy, no
compatibility or forward producer and no open launch gate. The CW2-08 seam still answers `NOT_EVALUATED`, so in
production nobody is shown ACCEPT and every acceptance is refused before anything is written.

## 1. CP0 — repository truth (read-only, 2026-10-15)

- `commit_matching_mutual_match_v1` (`0114:245`) is the one atomic producer of the Match, the `ACTIVE / INTRODUCTION /
  MUTUAL_MATCH` World, its two membership episodes, the Introduction Record and its facts, the two claims, the two
  `ACTIVE_INTRODUCTION` pauses, the competing cancellations and the handoff. It takes twelve identities, derives the
  accepting human from `auth.uid()`, revalidates everything under the canonical locks with CW2-08 last, decides its
  deadline at the one birth instant, is idempotent from its commit row, and is executable by nobody. Nothing called it.
- S6-04 (`0158`) offers the second recipient DECLINE only, by design (acceptance was S6-05's).
- S6-02 (`0155`) fences every Stage 4 read, send and reply path to `STANDARD`; the `0118` cores accept an Introduction
  send and both they and the `0116` END core lock the World row, so END against send is already atomic (CP3 / CP4).
- No reader returns an Introduction World to the first party, and none returns the closed Introduction history (CP3 / CP4).
- Gap G-1: nothing produces `FORWARDED_TO_SECOND` at runtime (`forward_matching_proposal_to_second_core_v1` has no caller).
  Admitted as `QAN-BL-MATCH-06` (§7).
- The full CP0 report and the CP1 package were delivered outside the repository and are summarised here and in the
  [gate record](QANDEEL_S6_05_VISUAL_COPY_GATE_v1.md).

## 2. Product Owner decisions (2026-10-15; not to be reopened)

| ID | Decision |
|---|---|
| R-1 | Option (a): D3 (human text only, no AI reply, no weaving, no Living Analysis in the Introduction) is within GATE-30. ACE-SP-01 is **not** amended; it governs what a reply says when a reply is called, and an Introduction World calls none until Stage 8A |
| R-2 | An honest welcome with no implied active AI; M-12 («أنا معكما في البداية») is not used |
| R-3 | The welcome is fixed client text, never a stored AI message (no `QANDEEL_PARTICIPATION` row) |
| R-4 | G-1 owned by **S6-07**, `HIGH`, after a duplication check: `QAN-BL-MATCH-06` (§7) |
| R-5 | Owner deletion of one's own messages reuses the existing route, in the active and the closed Introduction World |
| R-6 | Only the test expectations whose truth S6-05 changes are re-anchored (§5) |
| R-7 | Activity and Push from Introduction messages are S6-07's |
| R-8 | Introduction message send is `SECURITY_SENSITIVE` (CP3) |
| CP1 | Visual Gate and Copy Gate **CLOSED**: V-1 as shown in rev.2 (16 screens, S15a / S15b split), every text approved word for word with the final IW-03b correction ([gate record](QANDEEL_S6_05_VISUAL_COPY_GATE_v1.md)) |
| CP2 | Authorized: a narrow wrapper over the frozen core, server-derived identities, idempotency and retry safety, owner and current-view checks, CW2-08 kept closed, no reason or other-party data revealed, NO_BACKDOOR and PROD-RETRY-01 kept. Any future `ENDED` answer is membership-checked and reveals nothing to anyone not entitled |

## 3. CP2 — what was built

### 3.1 Migration `0159`

| Function | Who executes it | What it is |
|---|---|---|
| `accept_my_matching_proposal_v1(command, proposal, expected view)` | authenticated only | NEW. The second recipient's acceptance: a thin shell over the frozen `0114` core |
| `resolve_my_matching_proposal_presentation_v1(proposal)` | nobody | REDEFINED. The `0158` helper plus exactly one delta: the second recipient awaiting a decision is offered `ACCEPT` beside `DECLINE`, and `ACCEPT` joins the consequential decisions presented only when the CW2-08 seam answers `CLEARED` |

**Identity derivation.** The client supplies its command id, the proposal and the exact view it saw, and nothing else —
no human, counterpart, World or internal identity. The nine other identities are
`uuid(sha256('QANDEEL_S6_05_MUTUAL_MATCH_IDENTITY_V1' \n slot \n human \n proposal \n command))` with the `0155` version
and variant nibbles, for WORLD, INTRODUCTION_RECORD, FIRST_RECIPIENT_EPISODE, CANDIDATE_EPISODE, FIRST_RECIPIENT_CLAIM,
CANDIDATE_CLAIM, FIRST_RECIPIENT_PAUSE, CANDIDATE_PAUSE and HANDOFF_PACKAGE_VERSION. An equivalent retry derives the same
nine and the core answers it from its committed row; nothing new is stored.

**Order.** 42501 without a human; 22023 for a missing argument; then, inside one absorbing block:
`enter_matching_proposal_decision_v1` (the bounded not-found from immutable membership before any lock, then the canonical
two-human lock) → a command id this proposal already committed as the Match goes straight to the core (replay); one that
already names another act, on this proposal or any other, is a conflict → otherwise `ACCEPT` must be a decision the helper offers under that lock (deadline and
revalidation decided there, so the read and the act agree) → the core, once, with its whole frozen revalidation and
CW2-08 last.

A replay takes the pair lock before the core answers it (the core alone answers a replay before any lock); it can wait
behind pair work in progress and changes nothing.

**Answers** (one fixed word; a refusal rolls back everything the attempt touched, the lock row included):

| Core outcome | Answer |
|---|---|
| committed, or the replay of the committed command | `MATCHED` + the World the core bound |
| 40001 `MATCHING_RECIPIENT_VIEW_STALE`, `MATCHING_STALE_STATE` | `CHANGED` |
| 40001 `MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE` (any other 40001); P0002 (not theirs, not offered); 22023 inside; 55000 `MATCHING_PROPOSAL_EXPIRED`; 23505 `MATCHING_MATCH_ID_CONFLICT` | `UNAVAILABLE` |
| 55000 `MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED` | `NOT_AVAILABLE_NOW` |
| a command id that already names another act (on this or any other proposal) | `COMMAND_CONFLICT`, before the core |
| 23505 `MATCHING_COMMAND_ID_CONFLICT` | `COMMAND_CONFLICT` |
| P0001 (contradiction) | not absorbed (the API answers a neutral 503) |

The handler names `PT409` beside `40001` (no CATCH_TRAP); a real `40P01` is not converted, under the existing retry
contract: the whole attempt rolls back and a re-run derives the same identities. Stricter than copying `0158` literally,
which would have answered a non-committable Match `CHANGED` and an expiry at the birth instant `NOT_AVAILABLE_NOW` —
both would reveal a reason.

### 3.2 API

`POST /introductions/proposals/:proposalId/acceptance` with exactly `{ commandId, viewId }` → `{ outcome, worldId, proposal }`.
The caller's own token to PostgREST; strict decoding (exactly two columns; only `MATCHED` may carry a World, and must);
only a database 22023 is the client's `INVALID_REQUEST`, every other failure a neutral 503; no retry, nothing logged.
The listing and the single read now decode `ACCEPT`. Rate class `AUTHENTICATED`, like the three S6-04 decisions. Same
module (`introductions-proposals`), which imports no Introduction World, Shared, Conversation or Model Router runtime.

### 3.3 What was reused unchanged

The `0114` core (proved byte-identical on the live catalog, verify-0159 A04, and by blob id); the `0112` / `0120`
entry, lock and view assertion; the `0156` neutral projection; the `0158` boundaries; the S6-02 END boundary (exercised
on a born Introduction, D03); `SupabaseDataApiService` and the S6-04 API patterns; the verifier support ladders.

## 4. Evidence (local, 2026-10-16)

| Check | Result |
|---|---|
| `verify-migration-0159.mjs` (real PostgreSQL 17, fresh database) | **24 / 24**: posture A01–A04; production closed B01–B02; presentation C01; Match D01–D03; refusals E01–E07; replay F01; races G01–G06 |
| Affected verifiers, each on a fresh copy of the fully migrated database | 0108 26/26, 0112 22/22, 0113 17/17, 0114 35/35, 0115 25/25, 0116 33/33, 0117 14/14, 0118 15/15, 0120 27/27, 0149 26/26 (+ probes f1–f9), 0150 28/28, 0155 37/37, 0156 31/31, 0157 33/33, 0158 25/25 |
| Root static contracts (`node --test tests/*.test.mjs`) | **1391 / 1391** (the S6-05 contract adds 8) |
| `test:database` | **1310 / 1310** |
| API specs `introductions-proposals` + `http-security` | **146 / 146**; the whole API suite **5875 / 5875** (251 suites); `tsc --noEmit` clean |
| `prove-0159` / `prove-0158` wire proofs | run locally only against a minimal PostgREST stand-in (no Docker on this machine): both pass. The real proof across the PostgREST lines, including the pre-v16 re-run behaviour, runs in API CI |

What the races prove (two real connections, interleaving pinned on the lock wait): the same command twice → both
`MATCHED`, one World; two commands → one Match, the other `UNAVAILABLE`; acceptance vs the first party's withdrawal in both
orders → exactly one ending; an acceptance waiting on the pair lock past the deadline → nothing; two candidates of one
first recipient → one Match, the other proposal `CANCELLED_BY_COMPETING_MATCH` and its acceptance `UNAVAILABLE`.

A local note, not a product finding: a verifier that fails before its teardown leaves its committed race fixtures in a
shared database and contaminates every later verifier; every local run above used a fresh copy per verifier. CI applies
the migrations once and runs the verifiers in sequence, where every verifier passing is the precondition.

### 4.1 Independent review (2026-10-16)

An independent review of the uncommitted change found no BLOCKER and no MAJOR. Fixed: M1 — a command id reused from
ANOTHER proposal answered `UNAVAILABLE` (the core can only report it as a colliding identity); it is now
`COMMAND_CONFLICT` before the core (E06). Recorded: M2 (the coverage note, §6), N1 (the replay takes the pair lock,
§3.1), N2 (the client contract, §6). Fixed: N3 (a vacuous assertion in D01). Checked and sound: the anti-oracle answers,
the escaping SQLSTATEs, the derivation and replay, the lock order, the frozen bytes and ACL, the API decoding and every
re-anchor's scope.

## 5. Re-anchors (each tied to the one truth S6-05 changes; none weakens a security assertion)

| Pin | Change |
|---|---|
| `verify-0158` A03 / C01 | the helper may name `ACCEPT`; no S6-04 boundary accepts; the second recipient is offered `['ACCEPT', 'DECLINE']` |
| `verify-0112` B01 | the acceptance census admits the core and its one S6-05 shell by exact name |
| `verify-0149` NO_BACKDOOR | admits `accept_my_matching_proposal_v1(uuid, uuid, uuid)` by exact signature, one overload, authenticated-only; new probes f8 (a second client wrapper around the Match core is refused) and f9 (the acceptance granted to service_role is refused) |
| `verify-0150` ABSORBED | names `accept_my_matching_proposal_v1` |
| `database/tests/matching-mutual-match-introduction-birth-v1` | the 0112 predecessor seam: one producer equality, one producer-plus-shell equality |
| `tests/s6-02-…` and `tests/s6-04-…` contracts | the census expression, the ABSORBED list and the API route list |
| `introduction-proposals.spec.ts` | `ACCEPT` decodes; the route list has exactly one acceptance route |
| `tests/s5-03b-…`, `tests/s5-03c-…` | the current-task locator pin moves to S6-05 (validation only) |

## 6. Privacy, security and residual risks

- No identity, World or internal id is accepted from the client; nothing about the other human is returned. The answer
  is one word and, on `MATCHED` only, the World the accepting human now belongs to (D2).
- Anyone who is not the candidate — an outsider, a fresh account, the first recipient — gets the same `UNAVAILABLE` as a
  guessed id, and nothing is written, not even a lock row version (E01). Timing: the not-found is answered from immutable
  membership before any lock, for a real and a guessed proposal alike.
- No Matching Context Grant becomes a Shared grant, none is copied or moved, and the born World holds no material (D02).
- **Residual — the stale first approval.** No production path supersedes the first recipient's view after forwarding
  (only offer and forward materialize a view, `0120`); a direct core call does, and then the read still offers ACCEPT
  while the core refuses it as `NOT_COMMITTABLE` (answered `UNAVAILABLE`, E05). Recorded, not changed: it is unreachable
  from any application path.
- **Residual — the mobile decoder.** The S6-04 mobile transport decodes only the S6-04 actions; `ACCEPT` reaches the wire
  only when CW2-08 clears (Stage 9), and CP5 adds it to the mobile client before then.
- **Client contract (for CP3 / CP5).** A second tap with a NEW command id after a Match answers `UNAVAILABLE` with no World
  (G02); the read then shows `MATCH_CONCLUDED`. A client keeps and reuses its command id until it has an answer, so a
  retry recovers the World; CP3's reader is the other way to it.
- **Coverage note.** Two mappings are structural rather than exercised here: `MATCHING_PROPOSAL_EXPIRED` at the core's
  birth instant (the helper decides the deadline under the same lock first; G05; the core's own decision is proven by
  `verify-migration-0114.mjs`) and `MATCHING_STALE_STATE` (unreachable while the lock is held).
- **Residual — G-1.** Until S6-07 delivers `QAN-BL-MATCH-06`, no proposal reaches a second recipient outside synthetic
  proofs, so no real acceptance can occur even after the gates open.

## 7. Governance

- **BG-05 at kickoff:** no item named S6-05.
- **Admitted — `QAN-BL-MATCH-06`** (`HIGH`, `DEFERRED — OWNED`, owner `S6-07 — Activity, Direct Entry and Final Integration`;
  R-4): no runtime producer forwards a first-approved proposal to the second recipient. Checked against all 69 earlier IDs,
  every tombstone and §7 / §9: `QAN-BL-MATCH-01` is enrollment, `QAN-BL-MATCH-03` the conclusion producer, `QAN-BL-MATCH-04`
  understanding readiness, `QAN-BL-PRIV-04` export, and S6-04's "notifications for a delivered proposal (S6-07)" covers
  notification only. The ID was unused in the tree and in every ref's history. Register: **70 items; 32 / 4 / 10 / 24; 39 / 29 / 2**.
- Locators: Current State, Project Map and Roadmap record that S6-04 merged as PR #342 (`35ad4e19`) and that S6-05 is the
  current task, with dated additions; closed history is not rewritten.
- BG-08 / BG-09 at S6-05's closure are owed by S6-05's own closing change, not by this checkpoint.

## 8. Not delivered by CP2 (each its own checkpoint or owner)

The Introduction reads, human messaging and the first party's discovery of the World (CP3); END on mobile and the closed
history (CP4); every mobile surface, the approved copy module and RTL / LTR proofs (CP5); the forward producer
(`QAN-BL-MATCH-06`, S6-07); Activity, Push and Direct Entry (S6-07); photos, disclosure, SUCCESS and reactivation
(S6-06); Introduction intelligence (Stage 8A); launch clearance and policies (Stage 9 / CW2-08).
