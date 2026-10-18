# QANDEEL — S6-07 Implementation Record v1

**Task:** S6-07 — Activity, Direct Entry and Final Integration (Stage 6)  
**Owned:** `QAN-BL-MATCH-01` (Matching setup enrollment), `QAN-BL-MATCH-06` (the forward producer), `QAN-BL-PRIV-04`
(Export My Data for Matching / Introductions); closes A3-01 G-17. Each is dispositioned at the task's closing change (CP4).  
**Product authority:** the S6-07 Final Task Contract; the CP0 report and its review addendum, approved by the Product Owner
on 2026-10-18 («S6-07 — CP0 Approved / Start CP1»), with the Controlled Amendments they name; and the Product Owner's
CP1 correction decision D-CP1-1 = B (2026-10-18, «S6-07 — CP1 Correction: Empty Introduction Profile»), with
CA-D-CP1-1-impl; and «S6-07 — CP1 CLOSED / Start CP2» (2026-10-18), under Q5′ and CA-SYS-02 (CA-SYS-02-impl, §10); and the Product Owner's
CP2 correction «S6-07 — CP2 Targeted Correction: Account Deletion Guard» (2026-10-18, §10.9); and «S6-07 — CP2 CLOSED / Start
CP3» (2026-10-18, §11); and «S6-07 — CP3 Copy Gate APPROVED / Resume Implementation» (2026-10-18, §11.5, §11.10). No merge
or deployment without the Product Owner's explicit «ادمج».  
**Status:** **S6-07 ACTIVE — CP0 APPROVED, CP1 (GOVERNED ENROLLMENT) CLOSED, CP2 (FORWARD DISPATCHER, WITH THE
ACCOUNT-DELETION GUARD) CLOSED, CP3 (ACTIVITY, PUSH, DIRECT ENTRY, ENROLLMENT & CONSENT UX) DELIVERED — CP3 PRODUCT COPY
GATE CLOSED (§11.5) — AWAITING THE PRODUCT OWNER'S CP3 REVIEW — CP4 NOT STARTED — NOT MERGED / NOT DEPLOYED** (2026-10-18). The Product Owner closed CP1, the D-CP1-1 correction (§4)
included, on the green head `05cc2cbc`; CP2 is §10, closed on the green head `ad1e4138`; CP3 is §11.  
**Base:** `main` = merged PR #345 (ACCT-DEL-01) at `1861df43943a8695a761edec7aa42f5e18f018ec`, re-verified before the branch.  
**Branch:** `s6/s6-07-activity-direct-entry-final-integration` (one pull request for the whole task: CP1 … CP4).  
**Migrations:** `0165_matching_governed_enrollment_v1.sql` (CP1), `0166_matching_forward_dispatch_v1.sql` (CP2) and
`0167_introductions_activity_direct_entry_v1.sql` (CP3); every number was free.

`MERGED ≠ DEPLOYED ≠ LAUNCH-READY`. The hosted environment is `NOT_DEPLOYED`. CP1 opens no gate: the `ENROLLMENT` gate has
no row and the consent catalogue no text, so nothing can be enrolled in production; CW2-08 and every launch gate stay closed.
The approved consent texts (CP3, §11.10) enter a catalogue only through the loopback-only operator installer; no migration
installs them, and installing them on the hosted environment is not authorized.
CP2 opens none either: in production every forward attempt stops at the CW2-08 seam. CP3 opens none: in production nothing
is delivered, born, sent or shared, so nothing is notified.

## 1. The Product Owner's decisions (binding; not to be reopened)

| ID | Decision (approved 2026-10-18) |
|---|---|
| Q1 | One governed enrollment path; `NO_BACKDOOR` amended for the named exception only (CA-01-impl). |
| Q2(b) | A separate `ENROLLMENT` gate, closed by default, in its own schema (CA-GATE). |
| Q3-A | An explicit disclosure authority that approves zero personal fields (CA-08-impl). |
| Q4′ | A truly empty requirement version; no condition is invented for the user (CA-10-impl). |
| Q5′ | The forward dispatcher with the corrected lock order and real concurrency tests (CP2). |
| Q6 | `WORLD_BORN` when an Introduction World begins (CP3). |
| Q7′ / Q7″ | Export every derived photo rendition the user is still authorized to retrieve, blurred and clear, under the corrected download contract (CP4). **Binding condition:** the 32 MiB bound is a technical guard only, never a limit on the right to export; a safe path for photos beyond it is delivered inside S6-07, and `QAN-BL-PRIV-04` is not declared complete while any photo the user may download cannot be exported. |
| Q8(A) | One enrollment confirmation, with three independent consents, each revocable on its own. |
| Q9 | The proposal's arrival time is not exported. |
| D-CP1-1 = B | *(CP1 correction, 2026-10-18.)* No optional field is ever required to enroll: a reviewed draft with neither optional profile field enrolls with a real Introduction Profile version that has no field rows (CA-D-CP1-1-impl, §4). |
| Q10 | `HUMAN_TEXT` stays Class 4, in Activity only (no native push). |

Authorization limits: CP1 only, on one branch and one pull request; no LIVE or Production deployment; no Launch Gate; no
change to a frozen contract beyond the approved Controlled Amendments; CP2 not before the CP1 review; no merge without
«ادمج». *(CP2, 2026-10-18:)* CP2 only, on the same branch and pull request; no CP3, merge, deployment or Launch Gate, and no
other task or pull request.

## 2. CP1 — what was built

### 2.1 Migration `0165` (database)

- **Schema `matching_enrollment_private`** (not exposed through the Data API; RLS on, no policy, no application-role
  privilege): `gate_states` / `gate_events` (scope `ENROLLMENT`, the `0154` pattern, operator-only `set_gate_v1`),
  `consent_texts` (the three purposes; created EMPTY; operator installer `install_consent_text_v1`; a text is never
  rewritten), `fact_promotions` (the promotion record), `enrollment_acts` (every committed act with the exact consent
  version of each consent it exercised and the events it created) and `command_ledger`.
- **`public.enroll_my_matching_setup_v1`** — THE ONE governed boundary (CA-01-impl, CA-R5-impl): `authenticated` only,
  `SECURITY DEFINER`, the human from `auth.uid()`; the caller supplies the command id, the act (`ENROLL`, `CORRECTION`,
  `RESUME`, `RECONFIRM_CONSENT`), the reviewed draft version it promotes, and the version of each consent it agrees to —
  nothing else. It calls five of the six `0149` commands with their frozen bodies and the `0156` facts writer; never the
  field-bearing disclosure grant.
- **Three internal cores, executable by no role:** `set_empty_matching_requirements_core_v1` (CA-10-impl),
  `set_empty_introduction_profile_core_v1` (CA-D-CP1-1-impl, §4) and
  `grant_zero_field_pre_match_disclosure_authority_core_v1` (CA-08-impl). Each repeats the frozen `0109` lock, replay,
  compare-and-swap and history rules exactly, with the owner passed by its only caller.
- **`public.read_my_matching_enrollment_v1`** — the caller's availability (the gate AND a current text of each consent),
  the current consent texts, their own setup state and last act.
- **`resolve_matching_confirmed_facts_v1`** replaced forward with one added join: it answers only for a promoted version.
- **Deletion:** the three evidence relations cascade with the account row and are registered `ACCOUNT_CASCADE`.

The controlled amendment to the frozen `I-07` surface is [`matching-introduction-runtime-v1.md` §50](../matching-introduction-runtime-v1.md).

### 2.2 API

`apps/api/src/introductions-enrollment/` — one module composed through `AccountModule`:

| Route | Class | Does |
|---|---|---|
| `GET /introductions/enrollment` | `AUTHENTICATED` | the read, strictly decoded |
| `POST /introductions/enrollment` | `SECURITY_SENSITIVE` | `{ commandId, kind, expectedDraftVersion, consents: { participation, contextGrant, disclosureAuthority } }` → `{ outcome, view }` |

Caller's token only; no account, profile field, requirement or fact in any request; no `service_role` path; the database's
`22023` is a 400, anything else one sanitized 503.

### 2.3 Mobile and copy

None in CP1. The consent texts, the closing step «تأكيد التسجيل», the closed-state words and the revocation controls are
Product copy: they go through the Copy Gate in CP3, with the Activity and Direct Entry sentences. Until then the database
holds no consent text, so no act can succeed even if the gate were opened.

## 3. How CP1 implements the approved design (and the four refinements, with reasons)

**Order (every act):** the account row `FOR KEY SHARE` → a committed command id answers its first result → a live account
deletion is `DELETION_PENDING` (before any Matching lock) → the gate `FOR SHARE` → ONE block: the caller's own
`matching_setup_locks` row → the consent texts `FOR SHARE` → the draft `FOR SHARE` → the frozen commands and the cores →
the act and ledger rows. Every refusal raises inside the block, so its rollback removes everything, the lock row included.
The cores' `40001` (and a `PT409`) becomes one bounded `CHANGED`; the boundary raises neither.

Refinements inside the approved design — none changes a Product rule:

1. **The setup identities are read on the server, under the caller's own lock**, instead of being sent by the client
   (report §3.2 listed them as parameters). The lock is taken before anything is read, so the server's read is exactly
   the state the act applies to; the client never needs an internal identity; the reviewed draft version remains the
   human's CAS on what they confirmed.
2. **Each act carries exactly the consents it exercises** (ENROLL all three; CORRECTION the disclosure consent; RESUME the
   participation consent; RECONFIRM_CONSENT either or both), and the act records a version exactly when its event exists.
   A CORRECTION re-grants an ACTIVE authority whose basis moved only with a fresh consent and never re-grants a revoked
   grant or authority: Q8(A)'s independence holds in both directions.
3. **The lock row is taken through a private helper** (`matching_enrollment_private.enter_own_setup_v1`), as the S6-04 …
   S6-06 boundaries take theirs: `0149`'s own frozen terminal assertion, which `verify-0149` re-applies, refuses any
   application-executable function that writes a `0108` relation directly. The transitive census still reaches the
   boundary and admits it by name.
4. **The promotion record is its own relation** (`fact_promotions`), so the canonical reader's precondition is one join and
   a verifier fixture can give a synthetic version a fixture record beside it.

## 4. The Product decision CP1 surfaced — D-CP1-1, DECIDED (B) and applied

**D-CP1-1 — a reviewed draft with neither optional profile field.** S6-01 made the short introduction and the work field
optional, but the frozen `0109` profile command refuses an empty field set, `matchable` needs a current profile version, and
the authority (Q3-A) binds one. CP1 as first delivered (`b5f18fe7`) refused such a draft as `INCOMPLETE`, which made the
optional data required in practice. Options were (a) keep that refusal, (b) a zero-field profile core, (c) enroll without a
profile (not `matchable`).

**Decision (Product Owner, 2026-10-18, «S6-07 — CP1 Correction: Empty Introduction Profile»): B — APPROVED.** Binding
product rule: no optional field may be required of the user to enroll in Matching.

**CA-D-CP1-1-impl — the empty Introduction Profile version** (a Controlled Amendment of the frozen `I-07A` surface, recorded
in [I-07 runtime §50](../matching-introduction-runtime-v1.md)):

- ONE internal core, `public.set_empty_introduction_profile_core_v1(command, owner, expected current version)`, writes a
  real, immutable `introduction_profile_versions` row in the owner's same chain with NO field rows — the absence of fields,
  never a sentinel value. It repeats the frozen `set_introduction_profile_v1` law exactly: the caller's own
  `matching_setup_locks` row first; the command id IS the version id, an equivalent retry answers the committed version,
  a reused id with any other request (another owner, another prior, or a version that holds fields) is `23505`; any
  current version other than the expected one is `40001` with nothing applied.
- Executable by NO role (`anon`, `authenticated`, `service_role`, `PUBLIC`): revoked explicitly and asserted by the
  migration's terminal self-assertion; it names none of the six and reads no session identity. Its only caller is
  `enroll_my_matching_setup_v1`.
- The boundary chooses by the reviewed draft alone: one or two fields → the frozen `set_introduction_profile_v1`,
  unchanged; neither field → the empty-profile core. A new version is written only when the field set differs from the
  current one, so empty → fields, fields → empty and fields → other fields are each one new version along one chain, and
  empty → empty is `NO_CHANGE`.
- The zero-field disclosure authority binds the exact empty version like any other (no field, no token consent). A
  correction that moves the profile still needs a fresh disclosure consent; the three consents stay independent.
- Unchanged: the six `0109` bodies (`set_introduction_profile_v1` still refuses an empty set); `matchable` and the Match
  eligibility rules (`matchable` already needs only a current profile version — `0111`
  `resolve_matching_setup_state_v1`); every lock, CAS, idempotency and deletion rule; the closed `ENROLLMENT` gate.
- **Precondition checked, not assumed:** `0165` is on this branch only (not on `main`), no workflow applies migrations to
  a hosted database, and the hosted environment was last recorded at `0074` (`NOT_DEPLOYED`); so `0165` was corrected
  in place in the same pull request rather than by a forward migration.

## 5. Verification (local: real PostgreSQL 17.10, live PostgREST v12.2.9)

| Proof | Result |
|---|---|
| `verify-migration-0165` (new) | 33 / 33 scenarios: A01–A05 posture; B01–B20 behaviour (B19 / B20: D-CP1-1); C01–C08 races on two real connections (C08: D-CP1-1) |
| `prove-0165` on live PostgREST v12.2.9 (new) | pass (the cleanup leaves nothing): anon / service_role refused; closed gate `NOT_AVAILABLE_NOW`; ENROLLED, replay, `COMMAND_CONFLICT`; a 40001 and a PT409 underneath each answered once as `CHANGED`; the six refused; the three no-role cores refused to every token |
| `prove-0149` on the same PostgREST | pass |
| Every database verifier of the repository on a fresh clone each | 162 / 165 pass; the 3 others are local-environment only (§5.1) |
| API: `tsc --noEmit`, Jest | pass; 258 suites, 6048 tests |
| Root static contracts (`node --test tests/*.test.mjs`) | 1446 / 1446 |
| Database static tests (`test:database`) | 1310 / 1310 |
| `test:task-closure-governance-contract` | 24 / 24 |
| `test:s6-07-governed-enrollment-contract` (new) | 3 / 3; every one of its 16 planted defects is caught |

The three races that matter most for Q8(A) and the deletion rule: an act waiting behind an in-flight deletion request
answers `DELETION_PENDING` and writes nothing; an act waiting behind a draft edit answers `CHANGED` (nothing stale is
promoted); an act holding the old consent version while a new text is installed answers `CONSENT_OUTDATED`.

### 5.1 Full local runs

All 158 `verify-migration-*` and 7 other database verifiers ran, each on its own fresh clone of a database migrated 0001 → 0165. 162 pass. Three cannot pass on this machine and none is caused by `0165`:

- `verify-migration-0133` needs the `psql` client, which is not installed locally (CI has it).
- `verify-supabase-auth` is the live Supabase sign-in smoke and needs a hosted project (`SUPABASE_URL`); it is not a CI database step.
- `verify-migration-0130` fails on its 7-day window assertions here, and fails identically on an untouched clone of `1861df43` (no `0165`); the database and Node clocks agree to 3 ms. CI on `1861df43` passed it. The exact-head CI run of this branch is the deciding proof.

The re-anchored verifiers `0149` (34 / 34), `0150` (28 / 28) and `0156` (31 / 31) pass, and so does every verifier that reads confirmed facts through the shared fixture (`0110` … `0164`).

### 5.2 The D-CP1-1 correction (focused runs only)

The correction changes one function body and adds one no-role core, so only what reads them was run again, each on a fresh
clone of a database migrated 0001 → 0165 (corrected): `verify-migration-0165` 33 / 33, `0149` 34 / 34, `0150` 28 / 28,
`0156` 31 / 31, `0108` 26 / 26, `0109` 39 / 39; `prove-0165` on live PostgREST v12.2.9; and the eight static contracts
that read `0165` (`s6-07`, `sec-match-00`, `acct-del-01`, `s6-02`, `s6-04`, `s6-05`, `s6-06`, conversation-focus) 68 / 68.
The API is unchanged (`INCOMPLETE` stays an outcome for an unreviewed draft, an unconfirmed fact or a refused value).
What the new proofs show:

- **B19:** a reviewed draft with neither field is `ENROLLED` and `matchable`, with a real version of that human (the
  derived id, no prior) and zero field rows; the act binds it with the three exact consent versions; the zero-field
  authority (its own `GRANTED` event) binds that exact version; a retry writes nothing and an old id with other content is
  `COMMAND_CONFLICT`; `0109` still refuses an empty set; the core's replay, `23505` (other prior, other owner),
  `40001` and `22023` refusals write nothing; `anon`, `authenticated` and `service_role` are refused `42501`; revoking
  the authority or the grant leaves the others, and a re-granted authority binds the same empty version; a deleting account
  is `DELETION_PENDING` and a stale or unreviewed empty draft `CHANGED` / `INCOMPLETE`, all with nothing written.
- **B20:** one field goes through the frozen command (exactly its row); empty → one field → two fields → empty is four
  versions along one chain, each move of the authority's basis needing a fresh disclosure consent (`CONSENT_OUTDATED`
  without it, nothing written), the authority always bound to the current version and the superseded one `REVOKED`; the
  retry of the last correction writes nothing; empty → empty is `NO_CHANGE`; participation, the grant and the requirements
  never move.
- **C08:** an empty draft edited in flight: the act waits and answers `CHANGED`, with no row at all (not even the lock
  row); two enrollments at once: one `ENROLLED`, the other `ALREADY_ENROLLED`, one empty version, one authority.

## 6. Contracts and verifiers re-anchored (only where `0165` changes their truth)

| File | What moves, and why |
|---|---|
| `database/verify-migration-0149.mjs` | `NO_BACKDOOR`: the ONE named exception (exact signature, `authenticated` only); the "no function body names a suspended boundary" rule admits exactly it, and it names exactly five of the six; `DELETION_BASELINE_UNCHANGED`: the three evidence relations cascade by design (registered `ACCOUNT_CASCADE`), every other reference stays `RESTRICT`; probes f14 – f17 refuse a second wrapper, a `service_role` grant, a wrapper of the facts writer and a grant of any core (f17 probes all three since D-CP1-1) |
| `database/verify-migration-0150.mjs` | the boundary joins the `ABSORBED` entry points (it absorbs the cores' `40001`, naming `PT409`) |
| `database/verify-migration-0156.mjs` | A02: exactly the boundary wraps the writer (CW2-06B-02 §3 named it the one intended caller); its own writer helper gives each fixture version a fixture promotion record |
| `database/matching-proposal-verifier-support.mjs` | `recordFacts` gives each fixture version a fixture promotion record (every verifier from `0110` on reads facts through the one reader) |
| `tests/sec-match-00-…-contract.test.mjs` | amended as its header required: the one later function that names a suspended command is the `0165` boundary, granted to `authenticated` only; the forward regression check is unchanged and still applies to `0165` |
| `tests/s6-02-…`, `s6-04-…`, `s6-05-…` (two), `s6-06-…-contract.test.mjs` | the census, `ABSORBED` and `AccountModule` pins: the S6-07 entries are appended after the S6-06 ones |
| `tests/conversation-focus-runtime-integration-readiness-contract.test.mjs` | the typed database error readers: the enrollment service reads only `22023` |
| `tests/s5-03b-…`, `tests/s5-03c-…-contract.test.mjs` | the Project Map's one current-task line names S6-07; ACCT-DEL-01 merged |

## 7. Deliberately not in CP1, and owned

- **CP2:** the forward dispatcher (`QAN-BL-MATCH-06`, CA-SYS-02) with its lock-order and concurrency proofs — delivered,
  §10.
- **CP3:** Activity, Push and Direct Entry (A3-01 G-17), Introduction World mutes, `WORLD_BORN`; the Copy Gate for every
  new sentence, including the three consent texts and the enrollment surface; the mobile closing step and the revocation
  controls (the retained `0109` commands already revoke each consent on its own at the database).
- **CP4:** Export My Data (`QAN-BL-PRIV-04`, CA-EXP and the §10 download contract) under the binding Q7 condition, the
  integration journey, and the closure (BG-08 / BG-09) — `QAN-BL-MATCH-01` is dispositioned there.
- **Never in S6-07:** opening the `ENROLLMENT` gate or any launch gate (Stage 9), CW2-08, a hosted deployment.

## 8. Backlog (BG-08 at CP1)

CP1 admits nothing, re-owns nothing and closes nothing. It adds a dated CP1 note on `QAN-BL-MATCH-01` (backlog §5): the
launch path is delivered, the item stays open until S6-07's closing change. 74 items; 37 / 4 / 9 / 24; 42 / 30 / 2,
unchanged.

## 9. Final status (CP1)

CP1 is delivered on this branch in one pull request (see the pull request for the head and its CI), with the D-CP1-1 = B
correction applied (§4, §5.2); no Product decision of CP1 is pending. The Product Owner reviews CP1 next; CP2 starts only
after that approval. No merge without «ادمج». *(2026-10-18:)* the Product Owner closed CP1 after API CI and Mobile CI were
green on `05cc2cbc3ebbce53ac75752938a7b406aa06c0e9`, and started CP2 (§10).

## 10. CP2 — the forward dispatcher (`QAN-BL-MATCH-06`, Q5′, CA-SYS-02)

**Authorization:** «S6-07 — CP1 CLOSED / Start CP2» (Product Owner, 2026-10-18), after API CI and Mobile CI were green on
`05cc2cbc3ebbce53ac75752938a7b406aa06c0e9`: CP1 closed (D-CP1-1 = B included); CP2 on the same branch and pull request;
the review addendum's Q5′ (§2) is the design wherever it differs from the CP0 report. Not authorized: CP3, a merge, a
deployment, any Launch Gate, another task or pull request.

### 10.1 What was built

**Migration `0166_matching_forward_dispatch_v1.sql`** (the number was free):

- **`matching_forward_private.proposal_forward_attempts`** — the durable ledger, one row per proposal: the forward command
  id and the candidate view id, each minted ONCE and reused by every attempt; the attempt count, the last outcome, the
  SQLSTATE of a held integrity refusal (nothing else of it), and the next instant the proposal is due. Readable and
  writable by no application role, RLS on; it references only its proposal, `ON DELETE CASCADE`; registered
  `MATCHING_INTRODUCTIONS` in the ACCT-DEL-01 coverage registry.
- **`public.server_forward_approved_matching_proposals_v1(p_max)`** — THE dispatcher. `service_role` only, `SECURITY
  DEFINER`, `lock_timeout` 2 s, `p_max` must be 1 (one attempt per transaction, the `0157` sweeper discipline):
  1. the one due proposal, read with NO row lock (`FIRST_FORWARD_APPROVED`, before its deadline, no ledger row or a due
     one; the oldest due first) — none: `NONE_DUE`;
  2. the canonical pair lock FIRST, the same first lock every core and every human decision takes, then both humans'
     account rows `FOR KEY SHARE` (§10.9); a wait past the timeout is `BUSY`, with nothing of the proposal touched;
  3. the proposal re-read under the lock: moved or expired → `SKIPPED_MOVED`; either human's account deletion pending →
     `SKIPPED_DELETION_PENDING` (§10.9); the first recipient's forward approval no longer bound to their current exact
     view → `SKIPPED_STALE`;
  4. the ledger row (the ids minted once) and its row lock;
  5. the candidate's permitted conclusion for the proposal's own snapshot, about the first recipient: exactly one, or
     `SKIPPED_NO_CONCLUSION` — nothing is invented;
  6. the frozen `forward_matching_proposal_to_second_core_v1` with the ledger's ids, in an inner block: `FORWARDED`; the
     CW2-08 seam's `55000` → `SKIPPED_NOT_CLEARED`; any other `55000` → `SKIPPED_NOT_READY`; `40001` / `PT409` →
     `SKIPPED_STALE`; a lock wait → `BUSY`; anything else → `HELD_INTEGRITY`;
  7. the ledger: `FORWARDED`, `SKIPPED_MOVED` and `HELD_INTEGRITY` are terminal; every other outcome is due again after
     1 min doubling, capped at 6 h and never past the deadline (`BUSY`: 30 s, not counted as an attempt).
  It answers one word and no identity.
- **`public.server_list_proposal_delivery_activity_reconciliation_v1(p_limit)`** — read-only, `STABLE`, `service_role`
  only: every proposal delivery that is still its proposal's current state, before its deadline, whose recipient has no
  Activity member under `introductions:proposal-delivered:<delivery transition>` (`0136`). It reaches no write.

**API — `apps/api/src/introductions-dispatch/`**, one module composed through `AccountModule`, with NO controller and no
route: `IntroductionsForwardDispatchRepository` (the two `service_role` calls, strictly decoded; `p_max: 1` only) and
`IntroductionsForwardDispatcherWorker` (the push-dispatcher / media-erasure pattern: one cycle at a time on a timer that
never keeps the process alive, off under tests and without the server channel, `INTRODUCTIONS_FORWARD_DISPATCH_DISABLED`):
up to 10 single-proposal attempts per cycle, ending at `NONE_DUE`, at `BUSY` and at any failure; then, only when an
Activity notifier is bound, the reconciliation. CP2 binds none (the producer, its copy and its capability truth are CP3),
so CP2 publishes nothing. Telemetry is content-free: `INTRODUCTIONS_FORWARD` / `dispatch`, `reconcile`, with the
existing outcome words only.

### 10.2 CA-SYS-02-impl — the Controlled Amendment (recorded in [I-07 runtime §50](../matching-introduction-runtime-v1.md))

`NO_BACKDOOR` gains its SECOND named `service_role` SYSTEM exception, and nothing else: the dispatcher, by exact signature
`public.server_forward_approved_matching_proposals_v1(integer)`, reaches a Matching setup write only through the pair lock
(`lock_matching_pair_humans_v1` upserts both humans' `matching_setup_locks` rows). `verify-migration-0149` holds exactly
two system exceptions apart (the ACCT-DEL-01 erasure and this one), proves each `service_role`-only with no overload, and
its probes f18 / f19 refuse a second `service_role` wrapper around the dispatcher and the dispatcher granted to a client.
The ledger and the lister are not exceptions. This is also the CW2-06 §16 / §35 implementation note the addendum names:
the second recipient still receives an independent proposal only after the first party's forward approval, through the
frozen core, and the dispatcher is not a human's decision.

The implementation follows addendum §2.2. Eight refinements, each with its reason; none changes a Product rule:

1. **Its own schema, `matching_forward_private`** (the addendum wrote `matching_enrollment_private`): the ledger is no
   enrollment evidence, and the CP1 schema's invariants (every relation `ACCOUNT_CASCADE`, nothing outside references it)
   and their verifier stay unchanged.
2. **`ON DELETE CASCADE` from its proposal**, instead of `RESTRICT` and an explicit delete in the erasure module: the
   governed erasure (`0164`) deletes the account's proposals and the ledger rows go with them, while the frozen erasure
   body stays byte-unchanged. The ledger is bookkeeping, never evidence (`verify-0164` A04 passes; `verify-0166` C07).
3. **`BUSY` may defer the proposal in the ledger** (30 s, with at most a 100 ms wait for the ledger itself) — never anything
   of the proposal. Without it a long-held pair would be selected first on every call. While a human decision holds the
   proposal row itself the deferral is skipped (the ledger is then not even touched, as the addendum says) and the worker
   ends its cycle, so nothing loops.
4. **A reused-id `23505`, and any other unexpected refusal of the core, is `HELD_INTEGRITY`** — terminal in the ledger with
   its SQLSTATE, never retried automatically, reported as `integrity_failure` — instead of being raised. A raised refusal
   rolls the ledger back, so the same proposal would be selected first forever and starve every other.
5. **`SKIPPED_NOT_READY`** for a `55000` that is not the CW2-08 seam (the deadline at the real instant, an unconfigured
   policy, an unresolved first name, a refused disclosure), so `SKIPPED_NOT_CLEARED` means exactly the seam.
6. **The first recipient's forward approval must still be bound to their current exact view**, under the pair lock
   (`QAN-BL-MATCH-06`'s required property), or the attempt is `SKIPPED_STALE`.
7. **Exactly one permitted conclusion.** None, or more than one, is `SKIPPED_NO_CONCLUSION`: choosing among several would be
   a selection no Product rule makes.
8. **The lister answers `PUBLISH` only**, with the proposal, the candidate key and the delivery instant, so the CP3 producer
   needs no other read. The withdrawal of a delivery that left the live set, the producer and its copy are CP3.

Unchanged: the bodies of the forward core, the materializer, the transition writer, the pair lock, the validity reader, the
CW2-08 seam (`NOT_EVALUATED`), the S6-04 decisions, the `0157` sweeper and the `0164` erasure (`verify-0166` A03 compares
each with its last definition byte for byte); every grant of an earlier function; every launch gate.

### 10.3 What the proofs show (lock order, concurrency, recovery)

| Property | Proof |
|---|---|
| No lock inversion, no deadlock, bounded waiting | D01: a human withdrawal holding the pair lock → the dispatcher is `BUSY` within its 2 s timeout (measured), no `40P01`, nothing written — the human's decision stands. D02: the dispatcher first → the human waits one dispatcher transaction, then answers `RECORDED` from `FORWARDED_TO_SECOND` |
| Two workers | D03: one forward, one binding, one view; the second re-reads under the lock and answers `SKIPPED_MOVED`; the terminal ledger row is not reopened |
| Expiry or change during processing | D04: a deadline that passes while the dispatcher waits → `SKIPPED_MOVED`, nothing delivered. C03: a revoked first-recipient authority → `SKIPPED_STALE`; an expired proposal is never due |
| Retry without repetition | C01: a second call is `NONE_DUE`; the core re-called with the ledger's ids is its committed answer (nothing written); another view under the same command id is `23505`. B02: after a refused attempt the next one reuses the SAME ids, and once the seam clears those exact ids deliver |
| Worker crash and restart | D05: a worker killed by the server with an uncommitted forward leaves nothing, not even a ledger row; the restart forwards once |
| Activity recovery | C06 / D05: a committed delivery is listed until its Activity member exists; a fixture publication is `PUBLISHED` once, its replay `DUPLICATE`, a third cycle lists nothing; a withdrawn delivery is never listed; the first recipient gets nothing at forward time |
| No `permitted conclusion` | C02: none, or two, → `SKIPPED_NO_CONCLUSION`; no conclusion or candidate is written |
| Gates stay closed | B02 / B03: with the real seam a realistic fixture (conclusion present) ends `SKIPPED_NOT_CLEARED` with only a ledger row; the proposal and pair seams answer `NOT_EVALUATED`, the producer seam `UNAVAILABLE`, the `ENROLLMENT` gate has no row and no consent text exists |
| No disclosure before the binding | B02 / C01: the candidate's own readers answer nothing before the delivery binding and exactly the neutral row after it; on the wire the same with the candidate's token |
| Fair backoff, no starvation | C04: one not-ready proposal and two ready ones → three cycles, three distinct proposals; the backoff doubles, is capped at 6 h and is cut at the deadline. C05: a held integrity refusal starves nobody. D06: a held pair answers `BUSY`, the next proposal is forwarded at once, the held one waits 30 s |
| Role refusal | A01 / A04: `anon` and `authenticated` are `42501` on both functions; every application role is `42501` on the ledger and on the frozen core; `p_max` other than 1 is `22023`. On the wire: `anon` / `authenticated` tokens refused, the ledger not exposed |
| The governed erasure | C07: erasing the candidate deletes the proposal and its ledger row; the dispatcher then finds nothing |

### 10.4 Verification (local: real PostgreSQL 17.10, live PostgREST v12.2.9)

| Proof | Result |
|---|---|
| `verify-migration-0166` (new) | 21 / 21: A01–A04 posture; B01–B04 production closed; C01–C07 behaviour; D01–D06 races on real connections |
| `prove-0166` on live PostgREST v12.2.9 (new), driving the COMPILED worker | pass, fixture-clean: `anon` / `authenticated` refused, the ledger not exposed; `NONE_DUE`; `SKIPPED_NOT_CLEARED` behind the real seam; a 40001 and a PT409 underneath each answered once as `SKIPPED_STALE`; one forward; a failed publication recovered exactly once |
| `verify-migration-0149` (re-anchored) / `0150` (re-anchored) | 36 / 36 (f18, f19 new) / 28 / 28 |
| The verifiers whose catalog censuses read the new functions, each on a fresh clone | `0110` 25, `0111` 23, `0112` 22, `0113` 17, `0114` 35, `0120` 27, `0156` 31, `0157` 33, `0158` 25, `0159` 24, `0164` 29, `0165` 33 — all pass |
| API: `tsc --noEmit`, Jest | pass; 259 suites, 6063 tests (the worker spec and the telemetry relation included) |
| `test:s6-07-forward-dispatch-contract` (new) | 3 / 3; every one of its 21 planted defects is caught |
| Root static contracts / `test:database` / `test:task-closure-governance-contract` | 1449 / 1449 / 1310 / 1310 / 24 / 24; after the documentation change, the 31 contracts and 10 database tests that read the edited documents again: 487 / 487 and 644 / 644 |

### 10.5 Contracts and verifiers re-anchored (only where `0166` changes their truth)

| File | What moves, and why |
|---|---|
| `database/verify-migration-0149.mjs` | `NO_BACKDOOR`: two named SYSTEM exceptions held apart, each proven exactly; the dispatcher reaches Setup state only through the pair lock; probes f18 / f19 |
| `database/verify-migration-0150.mjs` | the dispatcher joins the `ABSORBED` entry points (it absorbs the core's `40001`, naming `PT409`) |
| `apps/api/src/observability/observability.spec.ts` | the legal telemetry relation gains `INTRODUCTIONS_FORWARD` (existing outcome words only) |
| `tests/s6-02-…`, `s6-04-…`, `s6-05-…` (two), `s6-06-…`, `s6-07-governed-enrollment-contract.test.mjs` | the `AccountModule` and `ABSORBED` pins: the CP2 entries are appended after the CP1 ones |

### 10.6 Residual risks and what is still not proven

- **Not deployed.** The hosted environment is `NOT_DEPLOYED` (last recorded at `0074`); `0166` is on this branch only.
- **Dormant in production.** The CW2-08 seam answers `NOT_EVALUATED` and no conclusion producer exists (Stage 8A), so in
  production every attempt would stop at `SKIPPED_NOT_CLEARED` and nothing is forwarded; `FORWARDED` is proven on
  fixtures only. The dispatcher's existence makes neither Stage 8A nor Matching production ready.
- **Decided and applied (§10.9):** the Product Owner's account-deletion guard. *(Before it, this bullet read: "Product
  question, not decided here: no rule refuses forwarding while either human has a live account deletion request (the
  S6-04 decisions do not refuse either); the governed erasure itself removes the proposal and its ledger.")* A
  cancellation is seen at the proposal's next due attempt (its backoff: at most 6 h, never past its deadline), not at once.
- **Performance:** `matching_proposals` has no index on its state, so the selection reads the live proposals (none exist in
  production). An index is a change to a frozen relation and waits until there is volume.
- **Activity:** until CP3 no one is notified of a delivered proposal; the producer, the withdrawal of a stale item, the
  `INTRODUCTIONS` capability truth and the copy are CP3.
- The exact-head CI run is the deciding proof.

### 10.7 Backlog (BG-08 at CP2)

CP2 admits nothing, re-owns nothing and closes nothing. It adds a dated CP2 note on `QAN-BL-MATCH-06` (backlog §5): the
producer exists and is dormant behind the CW2-08 seam; the item stays open, because its required property "composes with
the S6-07 notifications" is CP3's, and it is dispositioned at S6-07's closing change. 74 items; 37 / 4 / 9 / 24; 42 / 30 /
2, unchanged.

### 10.8 Final status (CP2)

CP2 is delivered on this branch in the same pull request (see the pull request for the head and its CI), with the
account-deletion guard of §10.9. It opens no gate and changes no frozen body. The Product Owner reviews CP2 next; CP3 starts only after that approval. No merge without
«ادمج».

### 10.9 The CP2 correction — the account-deletion guard (Product Owner decision, 2026-10-18)

**Decision** («S6-07 — CP2 Targeted Correction: Account Deletion Guard», APPROVED, on the reviewed head `c5703a2f`): while
either human of a proposal has an account deletion request that is not `CANCELLED` (`SCHEDULED`, `BLOCKED`, `ERASED`,
`COMPLETED`), no proposal is forwarded to the other human. Once the request is cancelled, a proposal that is still valid
and meets its conditions may be evaluated again; a proposal that expired, was withdrawn or was invalidated is never
revived. A small, proportionate correction inside CP2 — no new lock system, no frozen body, no privilege.

**Size of the change.** `0166` only (it is not deployed: hosted is at `0074`): one statement in the pair-lock block, one
`IF` before the approval-binding check, one outcome word in the ledger's outcome set, one self-assertion. The worker's
outcome set and telemetry map gain the word (`blocked_expected`). Nothing else moves.

**The guarantee, from existing locks only.** `0130` takes the account row `FOR UPDATE` before it writes or cancels a
request; `0154` and `0165` already hold the account row `FOR KEY SHARE` for exactly this. The dispatcher now holds BOTH
humans' account rows `FOR KEY SHARE` right after the pair lock — the erasure's own order (`0164`: the pair rows, then the
account row) — inside the same `BUSY` block, so a wait past the 2 s timeout is `BUSY` like the pair lock. Under READ
COMMITTED each statement reads committed state, so:

- a request that committed first (or committed while the dispatcher waited on the row) is seen, and nothing is forwarded;
- a request that arrives while the dispatcher holds the rows waits for that one transaction; the forward then committed
  before the request existed;
- hence no forward commits after a pending request committed. Lock order: request and cancellation hold only the account
  row; the erasure takes the pair rows before the account row, as the dispatcher does; `FOR KEY SHARE` does not conflict
  with `0154` / `0165` or with ordinary updates of the account row. A residual deadlock or wait is `BUSY`.

**The outcome.** `SKIPPED_DELETION_PENDING` — the core is not called, no transition, view or delivery binding is written;
only the ledger row, NOT terminal: the ids it minted stay the proposal's, and its backoff (1 min doubling, at most 6 h,
never past the deadline) brings the proposal back. After a cancellation the next due attempt delivers once under the same
ids; an expired or withdrawn proposal is never selected again. The check runs before the CW2-08 seam's, so in production
the answer during a pending deletion is `SKIPPED_DELETION_PENDING`, otherwise still `SKIPPED_NOT_CLEARED`.

**Proofs (real PostgreSQL 17.10, focused runs only).** `verify-migration-0166` **23 / 23** (21 + two new):

- **C08:** the first recipient's `SCHEDULED` request → `SKIPPED_DELETION_PENDING`, nothing written but the non-terminal
  ledger row, the candidate sees nothing; the candidate's `BLOCKED` request → the same; cancelled → the backoff still
  holds, then `FORWARDED` once under the ids minted the first time (one transition, one binding, one view), then
  `NONE_DUE`; two proposals refused during a deletion, one then expired and one withdrawn → after the cancellation
  neither is ever selected.
- **D07 (the focused race):** a deletion request taken as `0130` takes it (the candidate's account row `FOR UPDATE`, then the
  request row), held open on its own connection → the dispatcher waits on that row; the request commits → the dispatcher answers
  `SKIPPED_DELETION_PENDING`, nothing delivered; cancelled → `FORWARDED` once.
- D01 – D06 unchanged and passing (no new lock inversion, `BUSY` still bounded).

Also re-run: `verify-0149` 36 / 36, `0150` 28 / 28, `0164` 29 / 29, `0165` 33 / 33, `0120` 27 / 27; the static contract
3 / 3 with 24 planted defects, three new (the account rows not held; only the first recipient's deletion checked; a
`BLOCKED` deletion let through); API `tsc` and the dispatch / observability Jest suites (57 / 57); the ACCT-DEL-01 and
PROD-OPS-01 contracts that read `account_deletions` (43 / 43). `verify-migration-0130` fails locally on its own 7-day grace
assertion (`grace <= 7`, local clock skew) exactly as on the unchanged baseline before this correction; CI is the gate.

**Not done, deliberately:** no change to `0130`, `0164` or any S6-04 decision (a human may still decide on their own
proposal during a deletion; the governed erasure removes the proposal); no immediate re-evaluation on cancellation; no
backlog change (`QAN-BL-MATCH-06` stays `DEFERRED — OWNED`).

## 11. CP3 — Activity, Push and Direct Entry (A3-01 G-17; the CP0 Event Matrix with Q6 and Q10)

**Authority:** «S6-07 — CP2 CLOSED / Start CP3» (2026-10-18), after green API CI and Mobile CI on
`ad1e41385596a5a8b851649b260c5b842008f5e4`; the CP0 report §5 and the review addendum §5 (Event Matrix; Q6 `WORLD_BORN`;
Q10 `HUMAN_TEXT` = Class 4); D-CP1-1 = B and Q8(A) for the consent controls.

**State at this point: CP3 DELIVERED — THE CP3 PRODUCT COPY GATE CLOSED (§11.5) — AWAITING THE PRODUCT OWNER'S CP3 REVIEW.**
§11.1 – §11.9 are the first part, built before the Copy Gate (everything that needed no new Product copy). After the
Product Owner approved the Copy Gate (2026-10-18), §11.10 completes CP3: the enrollment step, the three consents and
their withdrawal on exactly the approved words, the governed install of the approved consent texts, and the correction
of the CI lint failure on `ec27e01a`. Nothing in this section ships an unapproved sentence.

### 11.1 What was built

- **Migration `0167_introductions_activity_direct_entry_v1.sql`** (the number was free; forward-only; creates NO relation,
  so the governed erasure's census is unchanged; no earlier function replaced):
  - **the capability truth** that replaces the API's `INTRODUCTIONS_ENTERED = false`: a human has *entered* Introductions
    when they ever committed a Matching participation event (only the governed enrollment of `0165` creates one), are one
    of the two humans of an Introduction Record, or keep a retained view (`0164`). `resolve_introductions_capability_v1`
    (no role), `read_my_introductions_capability_v1()` (`authenticated`, own truth only) and
    `server_read_introductions_capability_v1(uuid[])` (`service_role`, for the platform dispatcher);
  - **the delivery re-read** `server_read_introductions_proposal_delivery_v1(uuid)` (`service_role`): one proposal delivery
    while it is still its proposal's current state and before its deadline — the recipient, the proposal and the deadline;
  - **the one lister** `server_list_introductions_activity_v1(p_limit)` (`service_role`, STABLE, last 7 days, at most 100):
    every Introductions event whose legitimate recipient has no Activity member yet under the event's own candidate key
    (§11.2). A message or a disclosure is listed only while the frozen resolver of its kind still returns it to its
    recipient; nothing of the content, no name, no count is returned;
  - **the per-Introduction alerts** `list_own_introduction_world_alerts_v1()` / `set_own_introduction_world_alerts_v1(world,
    muted)` (`authenticated`): exactly the Worlds `list_my_introduction_worlds_v1()` lists to the caller (ACTIVE, ENDED,
    retained); MUTED / UNMUTED on the caller's own row of the ONE existing A3-01 mute table (`activity_context_mutes`,
    context = the World id); UNAVAILABLE, with no row, for anything else. The Stage 4 alerts stay fenced from every
    Introduction-phase World (`0155` D4), so the two never mix.
- **API**:
  - `activity/`: `silenceOf` / `markOf` / `interruptionVerdict` take the caller's capability truth (absent = not entered)
    and apply the World's own mute to Introductions; the feed, the attention summary and the preferences read it on the
    caller's token (`preferences.introductions.available` is now that truth); `open()` gains the Introductions branch
    (§11.3); `INTRODUCTIONS` is an executable destination.
  - `push/`: the platform dispatcher reads the capability truth of the readers of claimed Introductions items on the
    server channel; a failed read counts as *not entered* (the intent is suppressed, never sent). No other change: L0 is
    the Introductions Lock Screen default, Class 4 is never planned, Quiet Hours and Snooze defer as for everything else.
  - `introductions-activity/` (new module, no route): `IntroductionsActivityProducer` — the CP2 dispatcher's notifier —
    and its server-channel source repository. It publishes through the ONE boundary, `ActivityPublisher.publish`, only.
  - `introductions-dispatch/`: the CP2 worker's existing reconcile step now also asks the notifier for the other events
    (one pass for all Introductions Activity, the same single-flight timer and telemetry); the module binds the producer.
  - `introductions-world/`: `GET /introductions/alerts`, `PUT /introductions/worlds/:worldId/alerts` (owner token only).
  - `introductions-enrollment/`: `POST /introductions/enrollment/revocation` `{ commandId, consent }` — ONE consent withdrawn
    through its own retained frozen `0109` command (participation → `turn_off_matching_participation_v1`, the Matching
    Context Grant → `revoke_matching_context_v1`, the Pre-Match Disclosure Authority →
    `revoke_pre_match_disclosure_authority_v1`; `0149` never narrowed these), on the identity the caller's own setup read
    names now: REVOKED | NOT_ACTIVE | CHANGED | COMMAND_CONFLICT, plus the refreshed view. Always available (a closed gate
    or a pending deletion never blocks a withdrawal); the other two consents are never touched.
- **Mobile** (no new copy): the Activity decoder accepts `{ kind: 'INTRODUCTIONS', target: { kind: 'WORLD', worldId } |
  { kind: 'PROPOSAL', proposalId } }` strictly; Direct Entry opens a World on its own surface in the Shared area (where the
  reader finds it) and a proposal in the «مقترحات التعارف» space, each of which reads the server again; the
  per-Introduction mute rows in Notifications & Activity (approved IW-11 / IW-11b titles and the approved «مفعّل» /
  «مكتوم» words).

### 11.2 The Event Matrix as implemented

| Event | Durable source | Recipient (from durable truth, now) | Class | Context / entry | Lock Screen |
|---|---|---|---|---|---|
| A proposal reached you | the forward's delivery binding (`0120`, via `0166`'s lister, re-read by `0167`) | the delivery's recipient, until the proposal's deadline | 3 | none / `proposal:<id>` | L0 |
| `WORLD_BORN` (Q6) | `introduction_records` of an ACTIVE Introduction World | both humans | 3 | World / `world:<id>` | L0 |
| `HUMAN_TEXT` (Q10) | `shared_world_materials` (human text) in that World | the other human, never the author; only while it still resolves to them | **4** (Activity only, never a push) | World / `world:<id>` | — |
| `DISCLOSURE` | `introduction_disclosure_granted_events` | the counterpart; only while it still resolves to them | 3 | World / `world:<id>` | L0 |
| `ENDED` | `introduction_ended_events`, or the retained view after the other human's erasure (`0164`) | the human who did not end it; or the retained-view holder (one key per World and recipient) | 3 | World / `world:<id>` (the closed record) | L0 |
| `SUCCESS_REQUESTED` | a SUCCESS transition version's required approvers | each approver who has not approved — **dormant** (no version producer before Stage 8A) | 3 | World / `world:<id>` | L0 |

Never produced (CP0 §5.2, D1): a decline, a withdrawal, an expiry, a competing Match, "being considered", any evaluation
outcome. Every item carries the one REUSED sentence (§11.5 R-1) and no label, secondary line, name or content.

**One notification per event, even after a retry or a crash.** The candidate key is the event's own identity
(`introductions:proposal-delivered:<transition>` — CP2's —, `…:world-born:<world>`, `…:human-text:<material>`,
`…:disclosure:<resource version>`, `…:ended:<world>`, `…:success-requested:<version>:<approver>`): a second publication is
a DUPLICATE in `0136`, never a second item. Publication happens only in the dispatcher's pass, after its forwards and
never inside a forward transaction, from the listers: an event whose publication failed, or whose worker died after the
commit, is still listed on the next cycle and published once.

### 11.3 Direct Entry, revalidated

`open()` (server, caller's token): `world:<id>` → ENTER only while that World is in the caller's
`list_my_introduction_worlds_v1()` (and equals the item's context); `proposal:<id>` → ENTER only while
`get_my_matching_proposal_v1(id)` answers exactly that proposal. Otherwise — expired, withdrawn, erased, made Standard,
never theirs — one `UNAVAILABLE` with no fallback and no detail; a malformed or out-of-context reference is refused. The
device then opens the exact target through the existing surfaces, which read again before drawing: a World that is no
longer the reader's shows the existing neutral unavailable state and nothing of any World. Another account's item is a
404 and opens nothing (the S4-04 / S5-04 law, unchanged). A proposal opens the reader's proposals space (the list
containing it); it is not scrolled to.

### 11.4 Choices, and why

- **The CP2 pass publishes everything (recovery by construction).** CP0 proposed a source reader called after each
  commit. A lister of not-yet-told events, run in the dispatcher's existing single-flight pass, gives the same events
  with crash recovery for every one of them, needs no change to the S6-04 / S6-05 / S6-06 services, and reuses the hook
  CP2 left for exactly this. Cost: an item appears up to one poll interval (60 s by default) after its event.
- **One reused sentence.** Every per-event sentence would be new Product copy; the approved generic Introductions line
  is safe at every level and already authorized as Activity copy by the Shared precedent (p3.generic.shared). Per-event
  sentences are offered in the Copy Gate (AC rows).
- **The capability truth is per user and server-side**, read wherever Activity decides (feed, attention, preferences,
  platform dispatcher), never a constant and never another person's.
- **Deletion protection** is unchanged and still complete for Introductions Activity: nothing is delivered — so nothing
  is notified — while either human's deletion is pending (§10.9); the erasure removes the erased human's items and mutes
  with the account; the counterpart learns only that the Introduction ended; a proposal item whose proposal the erasure
  removed opens nothing.

### 11.5 The CP3 Product Copy Gate — CLOSED (APPROVED by the Product Owner, 2026-10-18)

**Decision** («S6-07 — CP3 Copy Gate APPROVED / Resume Implementation», 2026-10-18):

| Group | Decision |
|---|---|
| A — the enrollment step (EN-01 … EN-21) | **APPROVED**, with EN-03 amended (below) |
| B — the three consent texts (CT-P, CT-C, CT-D) | **APPROVED**, with CT-P and CT-D amended (below); CT-C unchanged |
| C — the consent controls (RV-01 … RV-12) | **APPROVED**, with RV-06 and RV-08 amended (below) |
| D — per-event Activity sentences (AC-01 … AC-06) | **NOT APPROVED FOR USE.** Every Introductions Activity item keeps R-1 «تحديث في التعارف» / "An Introductions update"; Native Push stays L0 |

**The five final words, as the Product Owner wrote them** (they replace the proposed rows below; every other row of A, B
and C is approved exactly as proposed):

| ID | ar | en |
|---|---|---|
| EN-03 | المشاركة في مقترحات التعارف | Taking part in introduction proposals |
| CT-P | أوافق على المشاركة في مقترحات التعارف التي يقدّمها لي قنديل، ويمكنني إيقاف مشاركتي في أي وقت. | I agree to take part in the introduction proposals QANDEEL offers me, and I can stop taking part at any time. |
| CT-D | أوافق على أن يقدّم قنديل للطرف الآخر مقترح تعارف خاصًا ومستقلًا قبل التوافق المتبادل، دون مشاركة أي حقل من ملف التعارف الخاص بي. ويمكنني سحب هذه الموافقة في أي وقت. | I agree that QANDEEL may show the other person a separate, private introduction proposal before a mutual match, without sharing any fields from my introduction profile. I can withdraw this consent at any time. |
| RV-06 | تتوقف مشاركتك في مقترحات التعارف الجديدة، دون إنهاء أي تعارف بدأ بالفعل. | You will stop taking part in new introduction proposals. This does not end an introduction that has already begun. |
| RV-08 | لن يُسمح بتمرير مقترحات جديدة إلى الطرف الآخر استنادًا إلى هذه الموافقة. | This consent will no longer authorize new proposals to be forwarded to the other person. |

Where the words live: A and C in `apps/mobile/src/introductions/enrollment-copy.ts` (`ENROLLMENT_COPY_GATE`: CLOSED, 33
rows, each with its ID); B as version 1 of each consent (`MATCHING_PARTICIPATION_V1`, `MATCHING_CONTEXT_GRANT_V1`,
`PRE_MATCH_DISCLOSURE_AUTHORITY_V1`) in the one pinned module `database/matching-consent-texts-v1.mjs` — never in the
app, which shows exactly the text the server returns. The approval authorizes neither opening `ENROLLMENT` nor installing
the texts on the hosted environment (§11.10).

*The proposal as it was put to the Product Owner, kept as history:*

**Reused (approved words, in contexts already authorized; listed for visibility, no decision needed):**

| ID | Words (ar / en) | Where it appears |
|---|---|---|
| R-1 | p3.generic.intro «تحديث في التعارف» / "An Introductions update" | the body of every Introductions Activity item (in the app only) |
| R-2 | p3.l0 «إشعار جديد» / "New notification" | every Introductions native notification and Lock Screen (L0) |
| R-3 | IW-11 «تعارف مع {0}» / "Introduction with {0}"; IW-11b «تعارف» / "Introduction" | the per-Introduction mute row |
| R-4 | p3.on «مفعّل» / "On"; p3.mutedWorld «مكتوم» / "Muted" | the per-Introduction mute row's state |
| R-5 | «التعارف», p3.introOn «تنبيهات التعارف», p3.introHelp | the existing Introductions section of Notifications, now shown when the server says the reader has entered |
| R-6 | the Introduction World's existing unavailable state; Activity's existing entry presentation | a refused Direct Entry |

**Proposed (new; not approved; not shipped).** Arabic in simplified Modern Standard Arabic, gender-neutral (S6 rule):
nominal and passive forms, the reader's own first person in the consents, no gendered imperative.

*A. The enrollment step* — a closing step of the «التعارف مع قنديل» preparation surface, shown only when the server
answers `available`; three separate consent rows, never one checkbox (Q8(A)); no optional field required (D-CP1-1 = B).

| ID | ar | en | Context |
|---|---|---|---|
| EN-01 | تأكيد التسجيل في التعارف | Confirm your Introductions enrollment | the step's heading |
| EN-02 | تُعرض أدناه ثلاث موافقات مستقلة، ويمكن سحب كلٍّ منها لاحقًا على حدة. | Three separate consents are shown below. Each can be withdrawn later on its own. | under the heading |
| EN-03 | المشاركة في التعارف | Taking part in Introductions | consent row 1 (participation) |
| EN-04 | الاستناد إلى عالمي الخاص في التعارف | Drawing on My World for Introductions | consent row 2 (the Matching Context Grant) |
| EN-05 | ما يُعرض قبل التوافق المتبادل | What's shown before a mutual match | consent row 3 (the Pre-Match Disclosure Authority) |
| EN-06 | أوافق | I agree | each row's own control |
| EN-07 | تأكيد التسجيل | Confirm enrollment | the act (enabled only when all three are agreed) |
| EN-08 | جارٍ تسجيل التأكيد… | Recording your confirmation… | while the act runs |
| EN-09 | تمّ التسجيل في التعارف. | You're enrolled in Introductions. | ENROLLED |
| EN-10 | التسجيل في التعارف غير متاح الآن. | Introductions enrollment isn't available right now. | the closed state (no gate, or no consent text) — what production shows |
| EN-11 | لا يمكن التسجيل أثناء وجود طلب لحذف الحساب. | Enrollment isn't possible while an account deletion is pending. | DELETION_PENDING |
| EN-12 | تغيّر شيء منذ المراجعة الأخيرة، وتلزم المراجعة مرة أخرى قبل التأكيد. | Something changed since the last review. Please review again before confirming. | CHANGED |
| EN-13 | تغيّر نص إحدى الموافقات، وتلزم قراءته مرة أخرى قبل التأكيد. | The wording of one of the consents changed. Please read it again before confirming. | CONSENT_OUTDATED |
| EN-14 | يلزم إكمال التجهيز قبل التسجيل. | Preparation needs to be completed before enrolling. | INCOMPLETE |
| EN-15 | تحديث التسجيل بما تمّت مراجعته | Update your enrollment with what you reviewed | the CORRECTION act |
| EN-16 | تمّ تحديث التسجيل. | Your enrollment is updated. | CORRECTED |
| EN-17 | استئناف المشاركة في التعارف | Resume taking part in Introductions | the RESUME act |
| EN-18 | تمّ استئناف المشاركة. | You're taking part again. | RESUMED |
| EN-19 | تأكيد الموافقات بصيغتها الجديدة | Confirm the consents in their new wording | the RECONFIRM_CONSENT act |
| EN-20 | تمّ تأكيد الموافقات. | Your consents are confirmed. | RECONFIRMED |
| EN-21 | تعذّر إتمام الطلب الآن، ويمكن المحاولة لاحقًا. | This couldn't be completed right now. You can try again later. | a transport or unknown failure |

*B. The three consent texts* — the words the operator installs as version 1 of each consent in the `0165` catalogue
(installing them is an operator act; the gate stays closed). Each is the reader's own first-person statement, faithful to
the frozen meaning of its `0108` authority.

| ID | ar | en |
|---|---|---|
| CT-P | أوافق على المشاركة في التعارف مع قنديل، ويمكنني إيقاف المشاركة مؤقتًا أو إنهاؤها في أي وقت. | I agree to take part in Introductions with QANDEEL. I can pause or stop taking part at any time. |
| CT-C | أوافق على أن يستند قنديل إلى ما كتبته بنفسي في عالمي الخاص، لغرض التعارف وحده. لا يُنقل شيء منه إلى أي عالم آخر، ويمكنني سحب هذه الموافقة في أي وقت. | I agree that QANDEEL may draw on what I wrote myself in My World, for Introductions only. Nothing of it is moved into any other World, and I can withdraw this consent at any time. |
| CT-D | أوافق على أن يُعرض مقترح التعارف على الطرف الآخر قبل التوافق المتبادل دون أي بيانات شخصية من ملفي، ويمكنني سحب هذه الموافقة في أي وقت. | I agree that, before a mutual match, an introduction proposal may be shown to the other person without any personal details from my profile. I can withdraw this consent at any time. |

*C. The consent controls* — in the same «التعارف مع قنديل» surface after enrollment: one row per consent (EN-03 … EN-05 as
labels), each withdrawn on its own.

| ID | ar | en | Context |
|---|---|---|---|
| RV-01 | موافقات التعارف | Introductions consents | the section heading |
| RV-02 | مُعطاة | Given | a consent that is in force |
| RV-03 | غير مُعطاة | Not given | a consent that is not in force |
| RV-04 | سحب الموافقة | Withdraw consent | the row's act |
| RV-05 | سحب هذه الموافقة؟ | Withdraw this consent? | the confirmation's title |
| RV-06 | تتوقف المشاركة في التعارف، ولا تُقترح تعارفات جديدة. | Taking part in Introductions stops, and no new introductions are proposed. | the confirmation's body — participation |
| RV-07 | يتوقف الاستناد إلى عالمك الخاص في التعارف. | QANDEEL stops drawing on your My World for Introductions. | the body — the Matching Context Grant |
| RV-08 | يتوقف عرض مقترحات التعارف على الطرف الآخر. | Introduction proposals stop being shown to anyone. | the body — the Pre-Match Disclosure Authority |
| RV-09 | سحب | Withdraw | the confirm button (cancel reuses the approved «إلغاء») |
| RV-10 | تمّ سحب الموافقة. | Consent withdrawn. | REVOKED |
| RV-11 | تغيّرت الحالة منذ عرضها، وقد حُدِّثت الآن. | This changed since it was shown. It's up to date now. | CHANGED |
| RV-12 | لا توجد موافقة قائمة لسحبها. | There's no consent to withdraw. | NOT_ACTIVE |

*D. Activity per-event sentences — optional.* Shipped today: R-1 for every event. If the Product Owner prefers one sentence
per event, these would replace it **in the app only** (the Lock Screen stays L0, «إشعار جديد»):

| ID | ar | en | Event |
|---|---|---|---|
| AC-01 | مقترح تعارف جديد | A new introduction proposal | a proposal reached you |
| AC-02 | رسالة جديدة في التعارف | A new message in your introduction | HUMAN_TEXT |
| AC-03 | مشاركة جديدة في التعارف | Something new was shared in your introduction | DISCLOSURE |
| AC-04 | IW-12 «انتهى التعارف» / "Introduction ended" (an approved word, in a new context) | | ENDED |
| AC-05 | IW-05 «بدأ التعارف» / "Your introduction has begun" (an approved word, in a new context) | | WORLD_BORN |
| AC-06 | طلب في التعارف بانتظار الرد | A request in your introduction is waiting for a reply | SUCCESS_REQUESTED (dormant) |

**Decisions asked (answered above, 2026-10-18):** (1) approve, amend or reject A (EN-01 … EN-21), B (CT-P, CT-C, CT-D) and
C (RV-01 … RV-12); (2) D: keep R-1 for every event (*recommended for launch safety: it is already approved and says nothing
about the event*) or approve AC-01 … AC-06 for the in-app body. After approval, CP3 continues in the same pull request: the
enrollment step and the consent controls on exactly the approved words, their tests and a device proof — then the CP3
report (§11.10).

### 11.6 Verification (local: real PostgreSQL 17.10; focused runs)

- `verify-migration-0167`: **13 / 13** — posture (seven functions, the role matrix, read-only but the mute, no relation, no
  gate row) and, on the real pipeline in one rolled-back transaction: the capability truth (never entered / enrolled /
  Introduction humans / retained view; own answer only; anon refused); the delivery re-read (recipient, before the
  deadline only); `WORLD_BORN` for both humans exactly and a replay a DUPLICATE (one item); `HUMAN_TEXT` for the other
  human only, nothing after an owner deletion; `DISCLOSURE` for the counterpart only; `ENDED` for the non-actor only and
  no live event after it; `SUCCESS_REQUESTED` for the approver who has not approved; **the real `0164` erasure**: the
  holder listed `ENDED` once, the erased human's items and mutes gone; the mute — own Worlds only, own row only, one World
  only, UNAVAILABLE without a row for an outsider / a random id / a Standard World, the Stage 4 alerts still refusing an
  Introduction World; bounded requests.
- Neighbouring verifiers re-run on a database with `0167`: `0115`, `0122`, `0136`, `0137`, `0141`, `0149` (36), `0150` (28),
  `0154`, `0155` (37), `0156` (31), `0158` (25), `0159` (24), `0160` (19), `0161` (20), `0162` (25), `0163` (12), `0164`
  (29), `0165` (33), `0166` (23) — all pass.
- **Live PostgREST v12.2.9 with the compiled API** (`prove-0166`, re-anchored): the forward by the compiled worker, then the
  publication by the REAL compiled CP3 producer, failed once and recovered exactly once — one item for the candidate,
  none for the first recipient, exactly the producer's shape (L0, the reused sentence, `proposal:<id>`, a deadline) — and
  the capability truth on the wire: `true` for the candidate's own token, `false` for a human who never entered.
- API: `tsc` clean; the full Jest suite **6091 / 6091** (260 suites), including the new `introductions-activity.spec.ts` (27: the producer's exact candidates, one
  item per event across a crash, the strict sources, the decision with the capability and the mute, Push at L0 and never
  for a message / not entered / muted / alerts off, Quiet Hours and Snooze, Direct Entry revalidation, the alerts service,
  the one-consent withdrawal and its refusals).
- Mobile: `tsc` clean; the new integration test `s6-07-introductions-direct-entry.test.tsx` (5: a World tap opens exactly
  that World and reads it again; a World no longer the reader's shows the neutral state; a proposal tap opens the
  proposals space; UNAVAILABLE and another account's item open nothing; the mute rows) and the strict decoders (4); the
  affected folders 1063 / 1071 with exactly the six known local baseline failures (`depth`, `w2-account-access`, failing
  the same way before CP3).
- The static contract `tests/s6-07-activity-direct-entry-contract.test.mjs`: 3 / 3, 21 planted defects each refused.

### 11.7 Contracts and tests re-anchored (only where CP3 changes their truth)

- The executable-destination pins — `tests/a3-01-activity-attention-inapp-contract.test.mjs` test 7,
  `tests/s4-04-shared-activity-notifications-direct-entry-contract.test.mjs`,
  `tests/s5-04-public-discussion-qandeel-final-integration-contract.test.mjs`: `INTRODUCTIONS` is executable; Replay still
  fails closed.
- `tests/s4-01-shared-world-reachability-contract.test.mjs`: the Shared area is also handed one revalidated Introduction
  World entry (a World id and a counter) — still nothing of the Personal world.
- The Introduction World route pins — `tests/s6-05-introduction-world-messaging-contract.test.mjs`,
  `tests/s6-05-introduction-closed-history-contract.test.mjs`, `tests/s6-02-introduction-privacy-end-boundary-contract.test.mjs`:
  the alerts client and the CP3 integration test name `/introductions/worlds/…` for the alerts and the reads only, and are
  now asserted to wire no message, END or history.
- `tests/s6-07-governed-enrollment-contract.test.mjs`: the enrollment module adds the 0109 self-inspection, exactly the
  three retained withdrawal commands and the one withdrawal route.
- `tests/s6-07-forward-dispatch-contract.test.mjs`: the notifier is bound, to exactly the CP3 producer; `prove-0166` drives
  the real compiled producer instead of its CP2 fixture (and an outsider human for the capability check).
- `tests/conversation-focus-runtime-integration-readiness-contract.test.mjs`: the enrollment service reads the typed
  database identity a second time, for the withdrawal's frozen refusals only.
- API specs: `activity.spec.ts` and `public-discussion.spec.ts` (Introductions now opens; Replay fails closed), the S6-05 world module isolation (a fifth
  file, the alerts, under the same rules), the CP2 worker spec and the CP1 enrollment spec (the wider interfaces).
- Mobile: the runtime-entry barrel pin (one new transport class).
- *(After the Copy Gate, §11.10:)* the runtime-entry barrel pin again (`IntroductionsEnrollmentApiClient`), and the CP3
  static contract's Direct Entry pin (the entry taken while rendering).

### 11.8 Residual risks and what is not done yet

- *(Resolved by §11.10:)* ~~Waiting on the Copy Gate: the mobile enrollment step and the consent controls; then their
  device proof.~~
- An item appears up to one dispatcher poll (60 s by default) after its event; a server down for more than 7 days skips
  the older events (the feed is not a log).
- A message deleted, or a share removed, after its item was published leaves the item (it says only R-1); a proposal item
  is not withdrawn when the erasure removes its proposal — it opens nothing.
- A mute row is keyed by the World id, so a muted Introduction that SUCCESS makes a Standard World stays muted there (the
  Shared rows show it and can unmute it).
- Not proven here: a real device or a real platform provider (Stage 9, `QAN-BL-LAUNCH-04/05`, `QAN-BL-NOTIF-05`); every
  launch gate and CW2-08 stay closed, so in production nothing is delivered, born, sent or notified.

### 11.10 CP3 completed after the Copy Gate (2026-10-18)

**Authority:** «S6-07 — CP3 Copy Gate APPROVED / Resume Implementation» (2026-10-18), on the reviewed head `ec27e01a`.
Limits kept: the same task, branch and pull request; no frozen core changed; no Launch Gate, `ENROLLMENT` gate or hosted
install; no CP4, merge or deployment.

**1. The CI failure on `ec27e01a`, corrected (not a baseline).** Mobile CI's *Fast mobile contract gate* failed on one
lint error, `react-hooks/set-state-in-effect` at `apps/mobile/src/shared-world/SharedWorldArea.tsx:113`, which CP3 had
introduced: the revalidated Introduction World entry was taken by a `setIntroduction(...)` inside an effect. The entry is
now taken once per entry while rendering (React's "adjusting state when a prop changes"), and only once the Introduction
surface exists — the same exact World opens, nothing else is chosen in its place, and a later entry (a new counter) opens
again. The rule is not disabled. The CP3 static contract pins the new form and refuses an effect form. The other jobs of
that run were skipped (dependent) or green (API CI `39132912365` green); no other real failure was on that head.

**2. The enrollment step and the three consents (mobile).**

- `runtime-entry/introductions-enrollment-api.ts` — the transport of the CP1 / CP3 routes, strictly decoded (an
  "available" view without all three texts is not believed); an act sends only the act, the reviewed draft version and
  the consent versions it exercises; a withdrawal names one consent.
- `introductions/enrollment-controller.ts` — one controller per runtime generation (retired with it). `enrollmentOffer`
  chooses ONE act from the server's view: ENROLL (participation OFF and a reviewed draft — any reviewed draft, no field
  required: D-CP1-1 = B), RESUME (a `USER_PAUSED` participation only), RECONFIRM_CONSENT (exactly the consents not in
  force), CORRECTION (a reviewed draft newer than the enrolled one; with a fresh disclosure consent while the authority
  is in force). Nothing is offered while the gate is closed or a deletion is pending. An act is refused locally unless
  every consent it exercises was agreed, each by the version of the text shown; a lost answer is retried with the same
  command id; a fresh read clears an earlier answer.
- `introductions/IntroductionsEnrollment.tsx` — the step (EN-01, EN-02, then one row per consent: its EN-03 / EN-04 /
  EN-05 label, the server's own current text in the reader's language, its own «أوافق»; the act enabled only when every
  row is agreed; EN-08 while it runs; the outcome below it) and «موافقات التعارف» (each consent's RV-02 / RV-03 state,
  RV-04, a confirmation with RV-05 and that consent's RV-06 / RV-07 / RV-08, RV-09 and the approved «إلغاء»; the answer
  RV-10 / RV-11 / RV-12 / EN-21 inside that consent's own row).
- `IntroductionsSurface.tsx` — the step closes the reviewed preparation, after the portrait it confirms; the consent
  controls stand in the reviewed, intro and read-only (closed or deletion pending) states, so a withdrawal is always
  reachable. The S6-01 "not available yet" sentences stay exactly where they were while nothing is known or the reader
  never enrolled and the gate is closed (production); an enrolled reader with a closed gate sees EN-10 instead; none
  while enrollment is open.
- Composition: `integration-runtime.ts` (`introductionEnrollment`), `mobile-runtime-entry.ts`
  (`introductionsEnrollmentFor`), `DepthComposition.tsx` (passed to the surface). Nothing else is reached.

How the approved words are used where a choice was needed (recorded, not new copy):

- **ALREADY_ENROLLED, NOT_ENROLLED, NOT_RESUMABLE** (the state moved since it was shown) answer EN-12 with the refreshed
  view; **COMMAND_CONFLICT** answers EN-21; **NO_CHANGE** shows nothing and stops offering that correction.
- **EN-19** names the RECONFIRM_CONSENT act, which is also how a withdrawn context or disclosure consent is given again
  under the current text (the act the approved context names).
- **The consent version** is shown with the text it belongs to and is exactly what the act names; it is not drawn as a
  visible label, because no approved word names a version. If the Product Owner wants a visible version label, it is one
  more Copy Gate row.

**3. The governed install of the approved consent texts (database tooling; no migration).**

- `database/matching-consent-texts-v1.mjs` — the ONE source of CT-P, CT-C, CT-D as approved, as version 1
  (`MATCHING_PARTICIPATION_V1`, `MATCHING_CONTEXT_GRANT_V1`, `PRE_MATCH_DISCLOSURE_AUTHORITY_V1`), each pinned by the
  SHA-256 of its bytes; the module refuses to load if a text and its pin disagree.
- `database/install-matching-consent-texts.mjs` — the operator installer: only through the `0165` operator function
  `install_consent_text_v1`, in one transaction; idempotent (an approved version already installed is left as it is);
  refuses another text under an approved version, a superseded approved version and an unknown current text of a purpose,
  writing nothing; never acts on a gate and proves the `ENROLLMENT` gate unchanged before committing; **loopback only** —
  any other host is refused before connecting, so the approval cannot become a hosted install by accident; needs the
  explicit `--confirm MATCHING_CONSENT_TEXTS_V1`.
- No migration installs the texts: every database, production included, keeps the catalogue empty and enrollment closed.
- `database/verify-matching-consent-texts.mjs` (API CI): T01 the bounds; T02 a fresh install is exactly the approved texts
  and digests, the reader's view shows exactly them, the gate is untouched and still CLOSED, and an ENROLL with the
  approved versions answers `NOT_AVAILABLE_NOW` writing nothing; T03 idempotent; T04 × 3 the refusals, nothing written;
  T05 with a FIXTURE gate (never a launch decision) the approved versions are exactly what ENROLL names, for a reviewed
  draft with neither optional field (one real profile version, zero fields), and any other version is `CONSENT_OUTDATED`.
  Everything is rolled back; the catalogue is left empty.

**4. Verification (local; GitHub CI on the final head is the deciding proof).**

| Proof | Result |
|---|---|
| `verify-matching-consent-texts` (real PostgreSQL 17.10, fresh clone at `0167`) | 7 / 7 scenarios |
| Mobile `enrollment.test.tsx` (new; Arabic and English; real controllers, scripted transports) | 35 / 35 |
| Mobile affected suites (`introductions`, `runtime-entry`, `integration`, `shared-world`, `settings`) | 1057 / 1063 — the 6 are the known local baseline (`depth`, `w2-account-access`), unchanged |
| Mobile `tsc`; `lint` | clean; 0 errors (96 warnings, unchanged) |
| API `tsc`; enrollment + Introductions Activity specs | clean; 63 / 63 (one new: the approved texts pass through byte for byte) |
| `tests/s6-07-enrollment-consent-surface-contract.test.mjs` (new) | 2 / 2; every one of its 18 planted defects caught |
| `tests/s6-07-activity-direct-entry-contract.test.mjs` (re-anchored for §1) | 3 / 3 |
| Root static contracts (`node --test tests/*.test.mjs`) | 1454 / 1454 |
| `test:database` | 1310 / 1310 (the hazard contract's H7 asked the installer's savepoint helper to say what an autocommit caller must do; it does) |

The neighbouring suites the earlier part of CP3 proved (`verify-0167`, `verify-0165`, Activity / Push / mutes, `prove-0166`)
read nothing this part changed and were not re-run; API CI re-runs them on the final head.

**5. Device proof (emulator, validation only).** `.s6-07-reports/cp3-device-proof/` (not committed): the S4-01 proof build
at `bbfc611a` (APK `c1f83650…`) with the SYNTHETIC stand-ins (`s607-proof-enrollment.ts`, copies of the approved texts,
checked identical by the static contract), API 36 x86_64 emulator 1080 × 2400 @ 420 dpi, four legs — Arabic / English ×
Dark / Light — each a clean install and one Maestro journey of 18 photographed steps, all passing (72 screenshots,
`CP3_DEVICE_EVIDENCE.html`): the production closed state; the step; each consent row with the approved text; two of
three agreed (act disabled); three agreed; ENROLLED; the three given; withdrawing one (its own confirmation), the other
two untouched; giving it again (RECONFIRM_CONSENT); the participation and disclosure confirmations (RV-06, RV-08 as
amended); CONSENT_OUTDATED with nothing agreed; enrolled with the gate closed (EN-10, no act, withdrawal still offered).
The device found two defects, both fixed before the final legs: a withdrawal's answer stood below the fold (now in that
consent's row), and an earlier EN-13 stood beside a later closed state (a fresh read now starts clean; a test pins it).
Not proven here: a physical device and TalkBack / VoiceOver (as for S6-04 … S6-06, required before launch).

**6. Activity, Push and the mutes.** Unchanged by this part: no file of `activity/`, `push/`, `introductions-activity/`,
`introductions-dispatch/` or `0167` changed after `ec27e01a`; their proofs (§11.6) stand and API CI re-runs them.
Group D is not used: every Introductions item keeps R-1 at L0.

**Status: CP3 DELIVERED — AWAITING THE PRODUCT OWNER'S CP3 REVIEW.** CP4 is not started.

### 11.9 Backlog (BG-08 at CP3)

CP3 admits nothing, re-owns nothing and closes nothing. `QAN-BL-MATCH-06` gains a dated CP3 note: its last required
property ("composes with the S6-07 notifications") is delivered; it is dispositioned at S6-07's closing change. A3-01
G-17 (the capability truth, publication through the boundary, L0 kept) is delivered here and closed at CP4 with the task. *(After the Copy Gate, §11.10:)* still nothing is admitted, re-owned or closed; `QAN-BL-MATCH-01` gains a dated CP3 note (the enrollment step, the three independent consents and the governed loopback-only install of the approved texts; the item stays open until the closing change).
74 items; counts unchanged.
