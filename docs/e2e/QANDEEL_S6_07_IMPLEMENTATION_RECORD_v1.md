# QANDEEL — S6-07 Implementation Record v1

**Task:** S6-07 — Activity, Direct Entry and Final Integration (Stage 6)  
**Owned:** `QAN-BL-MATCH-01` (Matching setup enrollment), `QAN-BL-MATCH-06` (the forward producer), `QAN-BL-PRIV-04`
(Export My Data for Matching / Introductions); closes A3-01 G-17. Each is dispositioned at the task's closing change (CP4).  
**Product authority:** the S6-07 Final Task Contract; the CP0 report and its review addendum, approved by the Product Owner
on 2026-10-18 («S6-07 — CP0 Approved / Start CP1»), with the Controlled Amendments they name; and the Product Owner's
CP1 correction decision D-CP1-1 = B (2026-10-18, «S6-07 — CP1 Correction: Empty Introduction Profile»), with
CA-D-CP1-1-impl; and «S6-07 — CP1 CLOSED / Start CP2» (2026-10-18), under Q5′ and CA-SYS-02 (CA-SYS-02-impl, §10); and the Product Owner's
CP2 correction «S6-07 — CP2 Targeted Correction: Account Deletion Guard» (2026-10-18, §10.9). No merge
or deployment without the Product Owner's explicit «ادمج».  
**Status:** **S6-07 ACTIVE — CP0 APPROVED, CP1 (GOVERNED ENROLLMENT) CLOSED, CP2 (FORWARD DISPATCHER) DELIVERED WITH THE
ACCOUNT-DELETION GUARD (§10.9) — AWAITING THE PRODUCT OWNER'S CP2 REVIEW — CP3 / CP4 NOT STARTED — NOT MERGED / NOT DEPLOYED** (2026-10-18). The Product Owner closed CP1,
the D-CP1-1 correction (§4) included, on the green head `05cc2cbc`; CP2 is §10.  
**Base:** `main` = merged PR #345 (ACCT-DEL-01) at `1861df43943a8695a761edec7aa42f5e18f018ec`, re-verified before the branch.  
**Branch:** `s6/s6-07-activity-direct-entry-final-integration` (one pull request for the whole task: CP1 … CP4).  
**Migrations:** `0165_matching_governed_enrollment_v1.sql` (CP1) and `0166_matching_forward_dispatch_v1.sql` (CP2); both
numbers were free.

`MERGED ≠ DEPLOYED ≠ LAUNCH-READY`. The hosted environment is `NOT_DEPLOYED`. CP1 opens no gate: the `ENROLLMENT` gate has
no row and the consent catalogue no text, so nothing can be enrolled in production; CW2-08 and every launch gate stay closed.
CP2 opens none either: in production every forward attempt stops at the CW2-08 seam.

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
