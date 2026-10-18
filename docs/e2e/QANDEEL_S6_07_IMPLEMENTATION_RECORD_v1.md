# QANDEEL — S6-07 Implementation Record v1

**Task:** S6-07 — Activity, Direct Entry and Final Integration (Stage 6)  
**Owned:** `QAN-BL-MATCH-01` (Matching setup enrollment), `QAN-BL-MATCH-06` (the forward producer), `QAN-BL-PRIV-04`
(Export My Data for Matching / Introductions); closes A3-01 G-17. Each is dispositioned at the task's closing change (CP4).  
**Product authority:** the S6-07 Final Task Contract; the CP0 report and its review addendum, approved by the Product Owner
on 2026-10-18 («S6-07 — CP0 Approved / Start CP1»), with the Controlled Amendments they name. No merge or deployment
without the Product Owner's explicit «ادمج».  
**Status:** **S6-07 ACTIVE — CP0 APPROVED, CP1 (GOVERNED ENROLLMENT) DELIVERED — AWAITING THE PRODUCT OWNER'S CP1 REVIEW —
CP2 … CP4 NOT STARTED — NOT MERGED / NOT DEPLOYED** (2026-10-18).  
**Base:** `main` = merged PR #345 (ACCT-DEL-01) at `1861df43943a8695a761edec7aa42f5e18f018ec`, re-verified before the branch.  
**Branch:** `s6/s6-07-activity-direct-entry-final-integration` (one pull request for the whole task: CP1 … CP4).  
**Migration:** `0165_matching_governed_enrollment_v1.sql` (the number was free).

`MERGED ≠ DEPLOYED ≠ LAUNCH-READY`. The hosted environment is `NOT_DEPLOYED`. CP1 opens no gate: the `ENROLLMENT` gate has
no row and the consent catalogue no text, so nothing can be enrolled in production; CW2-08 and every launch gate stay closed.

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
| Q10 | `HUMAN_TEXT` stays Class 4, in Activity only (no native push). |

Authorization limits: CP1 only, on one branch and one pull request; no LIVE or Production deployment; no Launch Gate; no
change to a frozen contract beyond the approved Controlled Amendments; CP2 not before the CP1 review; no merge without
«ادمج».

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
- **Two internal cores, executable by no role:** `set_empty_matching_requirements_core_v1` (CA-10-impl) and
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

## 4. A Product decision CP1 surfaced (needs the Product Owner)

**D-CP1-1 — a reviewed draft with neither optional profile field.** S6-01 made the short introduction and the work field
optional, but the frozen `0109` profile command refuses an empty field set, `matchable` needs a current profile version, and
the authority (Q3-A) binds one. CP1 therefore refuses such a draft as `INCOMPLETE` and invents no field. Options:

- **(a) keep** — enrollment needs at least one of the two optional fields (a Product rule the Copy Gate would explain);
- **(b) a zero-field profile core** — a new Controlled Amendment, the CA-10-impl pattern, so a profile version may hold no
  field (it would be bound by the zero-field authority and disclose nothing);
- **(c) enroll without a profile** — participation and the grant only, not `matchable`, until a profile field exists.

**Recommendation: (b)** if the Product Owner wants the optional fields to stay truly optional; otherwise (a). Nothing
depends on it before the gate opens.

## 5. Verification (local: real PostgreSQL 17.10, live PostgREST v12.2.9)

| Proof | Result |
|---|---|
| `verify-migration-0165` (new) | 30 / 30 scenarios: A01–A05 posture; B01–B18 behaviour; C01–C07 races on two real connections |
| `prove-0165` on live PostgREST v12.2.9 (new) | pass, twice (the cleanup leaves nothing): anon / service_role refused; closed gate `NOT_AVAILABLE_NOW`; ENROLLED, replay, `COMMAND_CONFLICT`; a 40001 and a PT409 underneath each answered once as `CHANGED`; the six refused |
| `prove-0149` on the same PostgREST | pass |
| Every database verifier of the repository on a fresh clone each | 162 / 165 pass; the 3 others are local-environment only (§5.1) |
| API: `tsc --noEmit`, Jest | pass; 258 suites, 6048 tests |
| Root static contracts (`node --test tests/*.test.mjs`) | 1446 / 1446 |
| Database static tests (`test:database`) | 1310 / 1310 |
| `test:task-closure-governance-contract` | 24 / 24 |
| `test:s6-07-governed-enrollment-contract` (new) | 3 / 3; every one of its 12 planted defects is caught |

The three races that matter most for Q8(A) and the deletion rule: an act waiting behind an in-flight deletion request
answers `DELETION_PENDING` and writes nothing; an act waiting behind a draft edit answers `CHANGED` (nothing stale is
promoted); an act holding the old consent version while a new text is installed answers `CONSENT_OUTDATED`.

### 5.1 Full local runs

All 158 `verify-migration-*` and 7 other database verifiers ran, each on its own fresh clone of a database migrated 0001 → 0165. 162 pass. Three cannot pass on this machine and none is caused by `0165`:

- `verify-migration-0133` needs the `psql` client, which is not installed locally (CI has it).
- `verify-supabase-auth` is the live Supabase sign-in smoke and needs a hosted project (`SUPABASE_URL`); it is not a CI database step.
- `verify-migration-0130` fails on its 7-day window assertions here, and fails identically on an untouched clone of `1861df43` (no `0165`); the database and Node clocks agree to 3 ms. CI on `1861df43` passed it. The exact-head CI run of this branch is the deciding proof.

The re-anchored verifiers `0149` (34 / 34), `0150` (28 / 28) and `0156` (31 / 31) pass, and so does every verifier that reads confirmed facts through the shared fixture (`0110` … `0164`).

## 6. Contracts and verifiers re-anchored (only where `0165` changes their truth)

| File | What moves, and why |
|---|---|
| `database/verify-migration-0149.mjs` | `NO_BACKDOOR`: the ONE named exception (exact signature, `authenticated` only); the "no function body names a suspended boundary" rule admits exactly it, and it names exactly five of the six; `DELETION_BASELINE_UNCHANGED`: the three evidence relations cascade by design (registered `ACCOUNT_CASCADE`), every other reference stays `RESTRICT`; probes f14 – f17 refuse a second wrapper, a `service_role` grant, a wrapper of the facts writer and a grant of either core |
| `database/verify-migration-0150.mjs` | the boundary joins the `ABSORBED` entry points (it absorbs the cores' `40001`, naming `PT409`) |
| `database/verify-migration-0156.mjs` | A02: exactly the boundary wraps the writer (CW2-06B-02 §3 named it the one intended caller); its own writer helper gives each fixture version a fixture promotion record |
| `database/matching-proposal-verifier-support.mjs` | `recordFacts` gives each fixture version a fixture promotion record (every verifier from `0110` on reads facts through the one reader) |
| `tests/sec-match-00-…-contract.test.mjs` | amended as its header required: the one later function that names a suspended command is the `0165` boundary, granted to `authenticated` only; the forward regression check is unchanged and still applies to `0165` |
| `tests/s6-02-…`, `s6-04-…`, `s6-05-…` (two), `s6-06-…-contract.test.mjs` | the census, `ABSORBED` and `AccountModule` pins: the S6-07 entries are appended after the S6-06 ones |
| `tests/conversation-focus-runtime-integration-readiness-contract.test.mjs` | the typed database error readers: the enrollment service reads only `22023` |
| `tests/s5-03b-…`, `tests/s5-03c-…-contract.test.mjs` | the Project Map's one current-task line names S6-07; ACCT-DEL-01 merged |

## 7. Deliberately not in CP1, and owned

- **CP2:** the forward dispatcher (`QAN-BL-MATCH-06`, CA-SYS-02) with its lock-order and concurrency proofs.
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

CP1 is delivered on this branch in one pull request (see the pull request for the head and its CI). The Product Owner reviews CP1 next; CP2 starts only after that approval. No merge without «ادمج».
