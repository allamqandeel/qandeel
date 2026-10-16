# QANDEEL — S6-05 Implementation Record v1

**Task:** S6-05 — Mutual Match & Introduction World  
**Stage:** 6 — Matching & Introductions  
**Product authority:** the Product Owner's S6-05 Task Contract v1.0 and its decisions D1–D7 (2026-10-15); the CP0 rulings
R-1 … R-8 and the approval of V-1 as the visual direction (2026-10-15); the «S6-05 — CP1 Final Approval & CP2
Authorization» (2026-10-15). No merge or deployment without the Product Owner's explicit «ادمج».  
**Status:** **IN PROGRESS — CP3 APPROVED, CP4 DELIVERED (INTRODUCTION END & CLOSED HISTORY) — VISUAL GATE AND COPY GATE
CLOSED — NOT MERGED / NOT DEPLOYED** (2026-10-16). CP4 waits for the Product Owner's review; CP5, the last checkpoint, is
not started.
*As written at CP3 (2026-10-16):* IN PROGRESS — CP2 APPROVED, CP3 DELIVERED (INTRODUCTION WORLD & HUMAN MESSAGING) — VISUAL
GATE AND COPY GATE CLOSED — NOT MERGED / NOT DEPLOYED; CP3 waited for the Product Owner's review; CP4 and CP5 were not
started.  
**Base:** `main` = merged PR #342 (S6-04) at `35ad4e19ad7e449255e7d087d4420b5d3775cf86`, re-verified before the branch.  
**Branch:** `s6/s6-05-mutual-match-introduction-world` (one pull request for the whole task, #343, draft).  
**Migrations:** `0159_matching_mutual_match_acceptance_v1.sql` (CP2), `0160_introduction_world_human_messaging_v1.sql`
(CP3) and `0161_introduction_closed_history_v1.sql` (CP4); each number was free.

No checkpoint launches Matching. There are still no real proposals, no enrollment, no installed policy, no
compatibility or forward producer and no open launch gate. The CW2-08 seam still answers `NOT_EVALUATED`, so in
production nobody is shown ACCEPT, every acceptance is refused before anything is written, and no Introduction World
exists for CP3's reads and messages, or CP4's closed history, to reach.

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
| CP2 result | **Approved** (2026-10-16, «S6-05 — CP2 Approved / CP3 Next Checkpoint») after an independent review of PR #343 at `f13dc26b` and green API CI, Mobile CI and live PostgREST on the four lines (§4.2). No rework of CP2, and nothing further for the earlier Docker pull failure |
| CP3 | Authorized (2026-10-16), in the same branch and PR: a safe read of the active Introduction World for its two humans only, the S6-02 isolation kept everywhere else; the first party's discovery of the World with no identity leaked; human text messages only, reusing the Shared storage and message components; no AI Reply, Model Router, Semantic Weaving, Living Analysis, Personal Context or Matching Context Grant transfer; R-8, R-7 and R-5 applied; `ENDED` only to an entitled member on the server's own confirmation, a neutral answer to anyone else; send-vs-END races, retries, read / write rights and nothing after END proven; the ordinary Shared World unchanged. Not authorized: re-doing CP2 / 0159, opening CW2-08, the forward producer, CP4 / CP5, F-1, frozen-contract changes, merging |
| CP3 CI decision | (2026-10-16, «S6-05 — CP3 Review / CI Decision») CP3 accepted in principle, closure pending green exact-head CI and the real PostgREST proof; on a repeated registry limit, stop and propose a source for the same pinned image. After the investigation the Product Owner deferred the image-source (GHCR) decision and approved one line in `verify-migration-0160.mjs` («S6-05 — CP3 One-Line Test Correction»; §10.1) |
| CP3 result | **Approved** (2026-10-16, «S6-05 / CP4 — Introduction END & Closed History Integration»): CP0–CP3 approved; CP3's tests green on `18988bc2`, including API CI, real PostgreSQL and the PostgREST proof on the four lines (§10.1). CP4 authorized |
| CP4 | Authorized (2026-10-16), in the same branch and PR: the closed Introduction history on the frozen closed-view entitlements and the existing historical source of truth (`resolve_shared_world_closed_history_visibility_v1`), each human's rights independent, owner deletion removing a message for both even after END, read-only, keyset paging, no identity or HIM / Matching data; END integration through the existing `POST /introductions/worlds/:worldId/end` (outcomes `ENDED` / `ALREADY_SETTLED` / `UNAVAILABLE`, alone, without the other's consent, not conditioned on CW2-08, nothing after it, no leak to non-members); owner deletion through the existing route. Not authorized: re-doing CP2 / CP3, old migrations or frozen contracts, Visual / Copy Gate or approved text changes, CP5 or its screens, CW2-08 or production gates, the forward producer, Activity / Push / AI, a new task, merging |
| Checkpoint rule | (2026-10-16, «S6-05 — Documentation & Checkpoint Closure Rule») Checkpoints are not separate tasks: each checkpoint updates this record, Current State, the Project Map and the Roadmap with its own work, and records the previous checkpoint's approval with its GitHub evidence. **CP5 is S6-05's last checkpoint**: the mobile surfaces, integration and tests, the final documentation and BG-08 / BG-09, in this PR. No sixth checkpoint and no separate documentation or reconciliation task; closed records keep their history; no merge and no S6-06 without the Product Owner |

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

### 4.2 CP2 on the exact head in CI (PR #343, head `f13dc26b`, 2026-10-16)

| Check | Result |
|---|---|
| API CI, attempt 1 (run `38812403897`) | **failed before any test**: the runner's pull of the pinned `public.ecr.aws/docker/library/postgres:17@sha256:2d2b8998…` service image was refused, `toomanyrequests: Data limit exceeded` (a registry limit; the same digest had pulled on `main` and on S6-04 hours earlier). No code or workflow was changed for it |
| API CI, attempt 2 (`gh run rerun --failed`, once) | **green**: `verify-api`, the change-aware plan and the VAL-01 evidence. In it: `verify-migration-0159.mjs` **24 / 24** on real PostgreSQL 17; the S6-05 static contract **8 / 8**; the API suite **5875 / 5875** (251 suites); every re-anchored verifier and contract |
| Live PostgREST (`prove-0159`, in the same job) | **passed on v12.2.9, v13.0.8, v14.18 and v16.4**, each engine imported from PostgREST's own release asset with its pinned sha256 and run as user 1000: exact parameters, anon and service_role refused, ACCEPT to the second recipient only, a stale view answered **once** (`CHANGED`) on every line including the pre-v16 lines, outsider `UNAVAILABLE`, `MATCHED` with its World, the replay the same World with nothing new, a reused id `COMMAND_CONFLICT` |
| Mobile CI | **green** (the fast contract gate; the build and device jobs were skipped as unaffected) |

This supersedes §4's local stand-in line for CP2: the wire proof is now proven against the real engine.

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

## 9. CP3 — Introduction World & Human Messaging: what was built

### 9.1 Anti-duplication (before any change)

| Need | Existing path | Decision |
|---|---|---|
| Store a human message in an Introduction World | the frozen `0090` / `0118` human text core `commit_shared_world_human_text_v1` (ACTIVE / INTRODUCTION with a live Record and exactly two humans; World row locked first; durable idempotency) | **REUSE**, unchanged, called once. No second material store, no second history model |
| Derive the message identities | `shared_private.derive_shared_conversation_identity_v1` (the Stage 4 send's, `0139`) | **REUSE** the function under two **Introduction-only** namespaces (`INTRODUCTION_HUMAN_TEXT_MATERIAL`, `INTRODUCTION_HUMAN_TEXT_HISTORY_ITEM`): a retry is the same message, and the same command id replayed through the Stage 4 send after SUCCESS is the core's command conflict, never a Stage 4 message that would start a reply, weaving or Activity (independent review, §11.1) |
| Decide who sees a message | `resolve_shared_world_material_v1` (`0089`) over the `0115` ACTIVE / INTRODUCTION visibility branch | **REUSE**, unchanged |
| The other human's name | `shared_private.shared_person_name_v1` (S6-02, `0155`): the handoff first name presented to this viewer, never the account Name | **REUSE** |
| Delete one's own message (R-5) | `delete_own_shared_world_material_v1` (`0139` → `0143`) and `POST /shared/worlds/:worldId/materials/:materialId/delete`; author from `auth.uid()`, phase never consulted, ACTIVE and READ_ONLY_CLOSED | **REUSE**, unchanged; no new route |
| END | `end_own_introduction_v1` (S6-02) and its route | **REUSE**, unchanged |
| The Stage 4 send / read / list | S6-02 fences them to `STANDARD`; the send also starts QANDEEL's reply and weaving and the controller records Activity | **NOT REUSED**: lifting the fence or adding a flag would put the reply, weaving and Activity one condition away. A separate boundary beside the fence is the smaller and safer change (CP0 §3) |
| A reader that names the World to the first party | none (`MATCH_CONCLUDED` carries no World; `introduction_records` is revoked from clients) | **NEW**, one reader |

### 9.2 Migration `0160` — three authenticated boundaries, nothing replaced

| Function | What it answers |
|---|---|
| `list_my_introduction_worlds_v1()` | The caller's own Introduction Worlds — either human, the first recipient included (D2: they arrive into a World that already exists). Per World: `world_id`, `matching_proposal_id` (already known to both), `ACTIVE` / `ENDED`, and the other's handoff first name. A World SUCCESS made Standard is not listed; nobody else's World ever appears |
| `read_my_introduction_messages_v1(world, before instant, before id, limit)` | One newest-first keyset page of the two humans' words, one snapshot, every row carrying the state: **no row** — not one of the two humans, unknown, or no longer an Introduction (one answer); **ACTIVE rows** (one empty ACTIVE row for an empty page); **one empty ENDED row** — a member, after END (the closed history is CP4's). Human text only: no QANDEEL, analysis or disclosure material; a deleted message is gone |
| `send_my_introduction_text_v1(command, world, text)` | `COMMITTED` (+ material, instant) — now, or the retry of the committed command, even after END or SUCCESS; `ENDED` — a member, after END (the only trigger of IW-35); `UNAVAILABLE` — anyone else, an unknown World, a World that is no longer an Introduction; `COMMAND_CONFLICT` — the core's own command conflict |

**Order in the send.** 42501 without a human; 22023 for a malformed request (the Stage 4 bound, 20 000 characters) →
membership from the immutable Introduction Record, **before any lock** (an outsider is the same `UNAVAILABLE` as an
unknown World) → a command id that already exists goes straight to the frozen core (replay from durable rows, or its
conflict) → a World that is visibly no longer a live Introduction is answered **without its lock** (`ENDED` to a member of an
ended one, `UNAVAILABLE` after SUCCESS), so a former member never serializes against a Standard World's work → otherwise
the World row `FOR UPDATE` — the same first lock the core, END and SUCCESS take — and the phase is decided **again under
it**: a live Introduction goes to the core once; an ended one answers `ENDED`; anything else, a World
SUCCESS has just made Standard included, `UNAVAILABLE`. A message therefore never lands in a Standard World through this
path, and END against a message is atomic: either the message commits and END's closed-view snapshot holds it, or END
commits and the message is `ENDED`.

**Gating.** No Stage 4 launch gate is bound: an Introduction World exists only after the CW2-08-gated Mutual Match, and
the humans' words inside it are, like END (S6-02), not a launch capability. CW2-08 is not touched.

**Self-assertions.** The migration refuses to deploy unless the three are postgres-owned pinned definers executable by
authenticated only; none names a reply, weaving, analysis, Activity, alert, launch gate, account Name, grant, Personal
Context or Memory, writes directly, re-raises or runs dynamic SQL; the composed cores stay executable by no application
role; the send calls the human text core exactly once and answers a non-member before it locks anything.

### 9.3 API — `IntroductionsWorldModule` (new, composed through the Account module like S6-01 / S6-02 / S6-04)

| Route | Rate class | Answer |
|---|---|---|
| `GET /introductions/worlds` | `AUTHENTICATED` | `{ worlds: [{ worldId, proposalId, state, otherFirstName }] }` |
| `GET /introductions/worlds/:worldId/messages` | `AUTHENTICATED` | `{ outcome: 'ACTIVE', messages, hasOlder }` (oldest first; `producer` `SELF` / `HUMAN`, `canDelete` for one's own) or `{ outcome: 'ENDED' }` or `{ outcome: 'UNAVAILABLE' }` |
| `GET /introductions/worlds/:worldId/messages/before/:materialId/:establishedAt` | `AUTHENTICATED` | the same, strictly older |
| `POST /introductions/worlds/:worldId/messages` with `{ commandId, content }` | **`SECURITY_SENSITIVE`** (R-8) | `{ outcome: 'COMMITTED', materialId, establishedAt }` or `ENDED`, `UNAVAILABLE`, `COMMAND_CONFLICT` |

The caller's own token to PostgREST; strict decoding of every row (exact columns; `ENDED` only as the one empty row the
database answers); only a database 22023 is the client's `INVALID_REQUEST`, every other failure a neutral 503; one call,
no retry, nothing logged. The module imports only auth and the Data API transport: no Shared, Conversation, Model Router,
QANDEEL reply, weaving, Living Analysis, Activity or Push code (R-1, R-7) — asserted by the spec, the module metadata
and the static contract. Deletion is the existing Shared route (R-5); END is the S6-02 route.

## 10. CP3 evidence (local, 2026-10-16)

| Check | Result |
|---|---|
| `verify-migration-0160.mjs` (real PostgreSQL 17, fresh database) | **19 / 19**: posture A01–A03 (incl. the composed cores byte-identical to their defining migrations); discovery B01 (through the REAL CP2 acceptance, both humans) – B02; reading C01–C03 (keyset paging; an outsider — even a member of another Introduction —, an unknown World and an invalid request read nothing; a FULL_NAME disclosure in the same history is not a message); sending D01–D04 (the Introduction-only derivation; exactly the two see it; no reply lease, no QANDEEL material, no Activity source row, no grant moved; retry and conflicts; malformed requests; the S6-02 fence still refuses every Stage 4 path); END and after E01–E03 (ENDED to members only; a pre-END retry is still COMMITTED; owner deletion before and after END; SUCCESS ends the Introduction here, a pre-SUCCESS retry is still that message, and the same command id through the Stage 4 send is refused as the core's command conflict); races G01–G04 |
| Affected verifiers, each on a fresh copy of the fully migrated database | 0089, 0090, 0108 26/26, 0112 22/22, 0113 17/17, 0114 35/35, 0115 25/25, 0116 33/33, 0117 14/14, 0118 15/15, 0119 25/25, 0120 27/27, 0139, 0140, 0143, 0149 26/26, 0150 28/28 (the three boundaries reach no 40001: no new ABSORBED entry), 0155 37/37, 0156 31/31, 0157 33/33, 0158 25/25, 0159 24/24 — all pass |
| CP3 static contract `tests/s6-05-introduction-world-messaging-contract.test.mjs` | **7 / 7** |
| Root static contracts (`node --test tests/*.test.mjs`) | **1398 / 1398** (the CP3 contract adds 7) |
| `test:database` | **1310 / 1310** |
| API spec `introductions-world` | **53 / 53**; `http-security` (the route census) green; the whole API suite **5928 / 5928** (252 suites); `tsc --noEmit` clean |
| `prove-0160` / `prove-0159` wire proofs | locally against the minimal PostgREST stand-in only: both pass. **Not a substitute** for the real proof, which runs in API CI on the four PostgREST lines |

What the races prove (two real connections, interleaving pinned on the World-row lock wait): a message holding the World
row while END waits → `COMMITTED`, then `ENDED`, and END's closed-view snapshot holds the message for both humans; END
first → the waiting message is `ENDED` and nothing is written; the same command twice at once → one message, both
answers name it; SUCCESS first → the waiting message is `UNAVAILABLE` and nothing lands in the now-Standard World.

### 10.1 CP3 on the exact head in CI (PR #343, 2026-10-16)

| Head / run | Result |
|---|---|
| `a70d00a4`, API CI run `38866614505`, attempts 1 and 2 | **failed before any test**, at "Initialize containers": the pinned `public.ecr.aws/docker/library/postgres:17@sha256:2d2b8998…` service image was refused, `toomanyrequests: Data limit exceeded` (the registry's anonymous data quota, shared by runner IPs). Reported; the Product Owner's investigation deferred the image-source decision (GHCR). No workflow, image source or Secret was changed |
| `a70d00a4`, the same run, attempt 3 | the image pulled; **failed** in `test:database` (1309 / 1310): `verifier-hazard-contract-v1` found an H2 aborted-transaction hazard in the race helper of `verify-migration-0160.mjs` (`.catch(() => undefined)` on the waiting connection's COMMIT). The local claim of 1310 / 1310 in §10 was made before that line was committed in this form and did not hold for the committed file |
| `18988bc2` | the one line the Product Owner approved: the waiting transaction's COMMIT no longer swallows an error. No race, production code or workflow change |
| `18988bc2`, API CI run `38892360036`, attempt 1 | **green**: `verify-api` (233 / 233 steps) and the VAL-01 evidence. In it: `verify-migration-0160.mjs` **19 / 19** and `verify-migration-0159.mjs` on real PostgreSQL 17; `test:database` 1310, no failure; the S6-05 static contracts CP3 7 / 7 and CP2 8 / 8; the API suite **5928 / 5928** (252 suites) |
| Live PostgREST (`prove-0160`, same job) | **passed on v12.2.9, v13.0.8, v14.18 and v16.4**, each engine checked against its pinned sha256 and run as user 1000: exact parameters, anon and service_role refused, both humans find the World and an outsider nothing, COMMITTED / retry / COMMAND_CONFLICT, owner deletion, after END `ENDED` to the two humans and `UNAVAILABLE` to an outsider. Every earlier wire proof in the same loop passed on the four lines |
| Mobile CI run `38892360011` | **green** |

This supersedes §10's stand-in line for CP3: the wire proof is proven against the real engine. The registry risk remains
(the image happened to pull); its source decision stays with the Product Owner.

## 11. CP3 re-anchors, privacy and residual risks

**Re-anchors.** `tests/s6-02-…` test 7: the Account module's imports pin gains `IntroductionsWorldModule` after
`IntroductionsProposalsModule` (the S6-02 module still composed exactly once).
`tests/conversation-focus-runtime-integration-readiness-contract.test.mjs`: the exact list of production readers of the
opaque typed database error gains `introduction-world.service.ts`, which reads it once, for the same one typed refusal
(22023 → `INVALID_REQUEST`) as S6-02 and S6-04, never logged or returned (the forward-safety mirror replays it). No verifier census needed a change: the
three boundaries write no Matching table (0149), reach no 40001 (0150), carry no acceptance name (0112) and are not
consumers of the history-visibility resolver (0155 P05). The rate census comment that said S6-04 had no acceptance route
was corrected (CP2 had added it).

### 11.1 Independent review (2026-10-16)

An independent review of the uncommitted change found no BLOCKER, no new message able to land in a Standard World and no
outsider oracle. Fixed: **MAJOR** — the send reused the Stage 4 namespaces, so after SUCCESS the author could replay an
Introduction command id through the Stage 4 send, which answers `COMMITTED` from the matching identities and then starts
a QANDEEL reply, weaving and Activity on Introduction material; the namespaces are now Introduction-only and E03 proves
the Stage 4 replay is refused (23505). **MINOR** — a former member of a now-Standard World could take its row lock; a
lock-free pre-check now answers a World that is no longer a live Introduction. **NIT** — an impossible calendar day in
the page cursor (V8 parses 2026-02-30) reached the database and answered 503; it is now the client's 400. **NIT** — C02
now uses a member of another Introduction as the outsider; the race and A03 titles say exactly what they prove.
Recorded, not changed: `introduction_records` has no index leading on either human, so the listing scans the table
(small until launch; an index is an additive later change); the API's blank / length check is stricter than the
database's (Unicode `trim`, UTF-16 length), exactly as the Stage 4 send; a retry after owner deletion answers the
committed identity, the core's existing behaviour.

**Privacy and security.**
- No identity, author, audience, kind or internal id is taken from the client; the human is `auth.uid()`.
- Membership is the immutable Introduction Record, decided before any lock or read: an outsider's list, read and send are
  indistinguishable from an unknown World's, before and after END (no oracle, no existence or ending leak).
- The name is the handoff first name presented to this reader; the account Name and disclosures are never read.
- No QANDEEL reply, weaving, Living Analysis, Activity, Push, Personal Context, Memory or Matching Context Grant is reached
  by the database boundaries or the API module (D01, D04, the self-assertions and the static contract).

**Residual risks and notes.**
- **`ENDED` in the read carries no history.** Until CP4's closed-history reader exists, a member sees that the
  Introduction ended and nothing of it; owner deletion after END works (E02) but a client cannot list the message ids to
  delete until CP4.
- **The welcome is client text (R-3).** Nothing is stored for it, so an empty Introduction is one empty `ACTIVE` row.
- **No Stage 4 launch gate on the send.** Deliberate (§9.2); recorded so Stage 9 can bind one if it decides to.
- **Client contract (CP5).** Keep and reuse the command id until an answer arrives; show IW-35 only on `ENDED` from the
  server, never on a transport failure; read the list again after `ENDED`.
- **Residual — G-1 still applies** (`QAN-BL-MATCH-06`, S6-07): no real Introduction World can exist before it.

## 12. Not delivered by CP3 (each its own checkpoint or owner)

END on mobile and the closed Introduction history (CP4); every mobile surface, the approved copy module and RTL / LTR
proofs (CP5); the forward producer (`QAN-BL-MATCH-06`, S6-07); Activity, Push and Direct Entry (S6-07); photos,
disclosure, SUCCESS and reactivation (S6-06); Introduction intelligence (Stage 8A); launch clearance and policies
(Stage 9 / CW2-08).

## 13. CP4 — Introduction END & Closed History Integration: what was built

### 13.1 Preflight and anti-duplication (read-only, before any change)

`origin/main` was still `35ad4e19` and PR #343's head `18988bc2` (main its ancestor).

| Need | Existing path | Decision |
|---|---|---|
| End the Introduction | `end_own_introduction_v1` (S6-02, `0155`) over the frozen `0116` END core, and `POST /introductions/worlds/:worldId/end`: either human alone, no consent, no seam ("there is no seam here, by design"), `ENDED` / `ALREADY_SETTLED` / `UNAVAILABLE`, membership from the Record before anything | **REUSE**, unchanged (blob-pinned) |
| Freeze each human's rights at END | `0116` writes one `introduction_closed_view_entitlements` row per matched human and their exact item snapshot through the one visibility entry point, while the World is still ACTIVE, before any membership ends; both relations immutable | **REUSE**: nothing new is frozen, copied or widened |
| Decide what a human sees after END | `resolve_shared_world_material_v1` (`0089`) → `resolve_shared_world_history_visibility_v1` (`0119`) → for `READ_ONLY_CLOSED`, `resolve_shared_world_closed_history_visibility_v1` (`0119`), whose Introduction branch reads exactly the caller's entitlement items that are `AVAILABLE` now | **REUSE**, unchanged |
| Read it as a client | none: the CP3 read answers a member one empty `ENDED` row; the S4-03 closed readers (`list_own_closed_shared_world_material_v1` / members) are fenced to `STANDARD` by S6-02 and also add QANDEEL material and names | **NEW**, one reader beside the fence; the S4-03 readers are **NOT** widened to Introduction (that would lift the S6-02 fence) |
| Delete one's own message after END | `delete_own_shared_world_material_v1` and `POST /shared/worlds/:worldId/materials/:materialId/delete` (works `READ_ONLY_CLOSED`, author from `auth.uid()`) | **REUSE**, unchanged; the new reader gives the author their own message ids (`canDelete`) |
| END against a message, a deletion or another END | the World row lock taken first by END, the human text core and owner deletion | **REUSE**: proven by races, no new lock |

### 13.2 The CP4 / CP5 boundary

Until CP4 this record named "END on mobile and the closed history" as CP4's. The Visual and Copy Gates assign every mobile
surface to CP5, the END screens included (IW-27 … IW-32, S15), and the Product Owner's checkpoint rule (§2) makes CP5 the
checkpoint of the mobile surfaces and their integration. CP4 is therefore the server and API side only: END is the
existing S6-02 route, unchanged, and the closed history is a new reader and two API routes. **No mobile code is added in
CP4** (asserted by the CP4 contract); the END client, the confirmation and closed-record screens and the history list are
CP5's, on exactly the approved copy.

### 13.3 Migration `0161` — one STABLE reader, nothing replaced

| Function | What it answers |
|---|---|
| `read_my_introduction_history_v1(world, before instant, before id, limit)` | One newest-first keyset page of the human words the caller is entitled to keep, one snapshot: **no row** — the caller holds no closed-view entitlement over an Introduction END closed (an outsider, a member of another Introduction, an unknown World, a live Introduction, a World SUCCESS made Standard: one answer); **ENDED rows**; **one empty ENDED row** — entitled, nothing left on this page. Same row shape as the CP3 read |

**Order.** 42501 without a human; 22023 for a malformed page request → the caller's OWN entitlement row joined to its
Introduction Record (`CLOSED`) and World (`READ_ONLY_CLOSED` / `INTRODUCTION`), before anything of the history is read →
the frozen material resolver for (World, caller), human text only. Membership episodes are never read: they ended with
the Introduction. It is STABLE (writes nothing), locks nothing and reaches no `40001`.

**Self-assertions.** The migration refuses to deploy unless the reader is a postgres-owned, STABLE, pinned definer
executable by authenticated only; names no reply, weaving, analysis, Activity, alert, gate, account Name, grant, Personal
Context, Memory or membership; writes, locks and re-raises nothing; answers the entitlement before the resolver; and the
closed resolver stays executable by no application role.

### 13.4 API — the same `IntroductionsWorldModule`

| Route | Rate class | Answer |
|---|---|---|
| `GET /introductions/worlds/:worldId/history` | `AUTHENTICATED` | `{ outcome: 'ENDED', messages, hasOlder }` (oldest first; `producer` `SELF` / `HUMAN`; `canDelete` for one's own) or `{ outcome: 'UNAVAILABLE' }` |
| `GET /introductions/worlds/:worldId/history/before/:materialId/:establishedAt` | `AUTHENTICATED` | the same, strictly older |

The CP3 decoders are reused: exact columns, only `ENDED` rows, the one empty row only alone, a malformed cursor the
client's 400, a database 22023 the client's `INVALID_REQUEST`, anything else a neutral 503; one call, no retry, nothing
logged. END stays `POST /introductions/worlds/:worldId/end` (S6-02) and deletion
`POST /shared/worlds/:worldId/materials/:materialId/delete`: no second END or deletion route exists.

### 13.5 Evidence (local, 2026-10-16)

| Check | Result |
|---|---|
| `verify-migration-0161.mjs` (real PostgreSQL 17, fresh database) | **20 / 20**: posture A01–A03 (the composed authority, END, deletion, the CP3 boundaries and the S4-03 closed readers byte-identical to their defining migrations); END B01–B03 (either human alone, no consent, every CW2-08 / I-07D seam put back to fail-closed for the END; retry, `ALREADY_SETTLED`, reused id, outsider, unknown World; exactly two entitlements and one terminal outcome); history C01–C06 (keyset paging, both sides; two genuinely different frozen sets stay different and a row written after closure widens neither; no row for an outsider, a member of another Introduction, an unknown World, a live Introduction or a World SUCCESS made Standard; refusals; neither a disclosure nor a text-bodied QANDEEL material frozen into both entitlements is a message); deletion D01–D02 (the author finds their own id and deletes after END, gone for both and never back, nobody deletes another's; deleted before END in neither history); after END E01–E02 (no send, no second END, no Stage 4 path, the S4-03 closed readers still fenced; no reply, QANDEEL material, Activity or Push; reading and deleting create or widen no entitlement, item or grant); races G01–G04 |
| Affected verifiers, each on a fresh copy of the fully migrated database | 0089, 0090, 0108 26/26, 0112 22/22, 0113 17/17, 0114 35/35, 0115 25/25, 0116 33/33, 0117 14/14, 0118 15/15, 0119 25/25, 0120 27/27, 0139, 0140, 0143, 0149 26/26, 0150 28/28 (the reader reaches no 40001: no new ABSORBED entry), 0155 37/37, 0156 31/31, 0157 33/33, 0158 25/25, 0159 24/24, 0160 19/19, 0161 20/20 — all pass; no verifier census needed a change |
| CP4 static contract `tests/s6-05-introduction-closed-history-contract.test.mjs` | **5 / 5** (the three S6-05 contracts and `verifier-hazard-contract-v1` together 53 / 53) |
| `test:database` | **1310 / 1310** |
| Root static contracts (`node --test tests/*.test.mjs`) | **1403 tests; the final local run 1401 pass, 2 fail**: two `forward-safety-contract` scenarios, each failing only on its mirror replay of the expo check `expo install --check and expo-doctor both pass deterministically, offline`. `expo-doctor` intermittently cannot reach `exp.host` from this machine (connect timeout); the run before failed the same way 3 times (the direct check too). CP4 changes no mobile file or dependency. The same contracts were green in API CI on `18988bc2`; CI decides |
| API spec `introductions-world` + `http-security` | green (149 tests in the two folders); the whole API suite **5941 / 5941** (252 suites); `tsc --noEmit` clean |
| `prove-0161` / `prove-0160` wire proofs | locally against the minimal PostgREST stand-in only: both pass. **Not a substitute** for the real proof, which runs in API CI on the four PostgREST lines |

What the races prove (two real connections, the interleaving pinned on the World-row lock wait): END against END by the
two humans → one `ENDED`, one `ALREADY_SETTLED`, one terminal outcome; the same END command twice at once → both
`ENDED`, one outcome; a deletion holding the World row while END waits → `DELETED` then `ENDED`, and the item is in
neither frozen entitlement; END first, the deletion waiting → `ENDED` then `DELETED`, the item is in both entitlements
yet gone from both histories (availability dominates).

### 13.6 Re-anchors (each tied to the one truth CP4 changes)

| Pin | Change |
|---|---|
| `tests/s6-05-introduction-world-messaging-contract.test.mjs` test 5 | the controller's first four routes stay pinned exactly; the two CP4 reads follow them; the repository's call list gains `read_my_introduction_history_v1` |
| `introduction-world.spec.ts` | the route list (six) and the repository call list; new CP4 cases |
| `route-rate-limit.census.ts` | the two history routes, `AUTHENTICATED` |

### 13.7 Independent review (2026-10-16)

An independent read-only review of the uncommitted change found no BLOCKER and no MAJOR: no exposure beyond the caller's
frozen, available entitlement; no error code distinguishes World states (the entitlement check proves, in the same
snapshot, everything the resolver could refuse); deletion after END removes a message for both; the S6-02 fence and the
reused END and deletion are unchanged; no verifier hazard (H1–H7). Fixed, both about proof strength: **MINOR** — B01
restored only the CW2-08 prerequisite seam; it now restores all four seams to fail-closed before END. **MINOR** — C05
would have passed without the reader's human-words filter (a disclosure has no text body); it now freezes a text-bodied
QANDEEL material into both entitlements and proves it is never a message. Fixed NITs: E01's message says what it shows
(the S4-03 fence is pinned by A03); the migration's self-assertion also names Push and proves the no-entitlement guard
`IF NOT FOUND THEN RETURN` sits between the entitlement and the resolver; A03 asserts one definition per function; the CP4
contract pins all six routes exactly.

### 13.8 Privacy, security and residual risks

- The authority is the frozen entitlement, never membership; it is the caller's own row, so neither human can read with
  the other's rights, and an outsider's answer is the same as an unknown World's (no existence or ending leak).
- Human words only, `is_self` and nothing else: no name, account, HIM, Matching or disclosure data.
- **Resolved:** CP3's residual "`ENDED` in the read carries no history" (§11): a member now reads their closed history,
  and finds the ids of their own messages to delete.
- **Residual — performance.** Like the Stage 4 and CP3 reads, the reader pages over the resolver's full visible set;
  bounded by one Introduction's history. Recorded, not changed.
- **Residual — G-1 still applies** (`QAN-BL-MATCH-06`, S6-07): no real Introduction World can exist before it.
- **Governance:** CP4 admits nothing; the register stays 70 items. BG-08 / BG-09 are CP5's (§2, checkpoint rule).

## 14. Not delivered by CP4 (each its own checkpoint or owner)

CP5, the last checkpoint: every mobile surface — the Introduction World, END (IW-27 … IW-32, S15), the closed record and
history, deletion — the approved copy module, RTL / LTR proofs, the final documentation and BG-08 / BG-09. Elsewhere: the
forward producer (`QAN-BL-MATCH-06`, S6-07); Activity, Push and Direct Entry (S6-07); photos, disclosure, SUCCESS and
reactivation (S6-06); Introduction intelligence (Stage 8A); launch clearance and policies (Stage 9 / CW2-08).
