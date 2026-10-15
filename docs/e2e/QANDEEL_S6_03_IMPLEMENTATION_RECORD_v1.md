# QANDEEL — S6-03 Implementation Record v1

**Task:** S6-03 — Matching Proposal Pipeline & Intelligence Prerequisites  
**Stage:** 6 — Matching & Introductions  
**Product authority:** the Product Owner's S6-03 Task Contract v1.3 (2026-10-15; D1–D7, C1–C8, R1, R2), the approved
text of Controlled Amendment [CW2-06B](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-06B_CONFIRMED_FACTS_ELIGIBILITY_NEUTRAL_PRESENTATION_REPROPOSAL_CONTROLLED_AMENDMENT_v1.0.md)
(2026-10-15, with R3, R4, R4-A, R4-B and R5, and the final R5 and re-proposal-block wording), the Product Owner's
resumption order for CP2–CP6 (same day), and the Product Owner's decision on review finding 2 (same day, §8.1). No merge or deployment without another explicit Product Owner approval.  
**Status:** **CLOSED / READY FOR PRODUCT OWNER MERGE DECISION — NOT MERGED / NOT DEPLOYED** (2026-10-15). The Product
Owner decision point of §8.1 is decided and closed in this pull request.  
**Base:** `main` = merged PR #340 (S6-02) at `8e85b40dcf9b4ba35439f9424997ad0c3a0c1113`.  
**Branch:** `s6/s6-03-matching-proposal-pipeline` (one pull request).  
**Migrations:** `0156_matching_confirmed_facts_eligibility_neutral_disclosure_v1.sql`,
`0157_matching_reproposal_admission_orchestration_v1.sql` (both numbers were free at the base).

Closing S6-03 is not launching Matching. After it there are zero real proposals, zero Mutual Match commits, zero
Introduction births, no enrollment, no installed policy, no compatibility producer, no open launch gate and no new
application-executable Matching pathway.

## 1. Checkpoints

| CP | Outcome |
|---|---|
| CP0 | Repository truth, read-only, against `8e85b40d`: findings F-01 … F-24 (fact source, single revalidation, frozen reason CHECK, first-name seam, `IF disclosed = 0`, zero-field Handoff, persistence-level re-proposal proof, the frozen TS file, the fixture census, NO_BACKDOOR, `prosrc` scanners, delta CHECKs). Kept untracked in `.s6-03-reports/` as the CP1 package |
| CP1 | The full CW2-06B text and the implementation, verification and dependency maps. The Product Owner approved P-1 … P-5, P-7, P-8, R3, R5 and the R4 principle, then R4-A and R4-B, then the final text with two wording fixes (§2) and the `verify-0120` P03b re-anchor |
| CP2 / WP2 | `0156` §1–§8, §10–§12: the confirmed-fact source and its one internal writer, the reader, the confirmed first name, the structured encoding v1, the R3 age rule and R4 horizon, the deterministic evaluator, the pair rule at capture and the snapshot fact binding, currentness |
| CP3 / WP3 | `0156` §13–§14: B4 (zero fields under an explicitly empty allowlist), the NULL projection; `0157` §2: the refusing producer seam |
| CP4 / WP4 | `0156` §9, §15: the owner-only policy primitive, the deterministic Arabic/English privacy floor |
| CP5 / WP5 | `0157`: the re-proposal block in Discovery and Prepare, the R4-A preparation instant, the pair-scoped CW2-08 seam, the admission, the orchestrator and the sweeper |
| CP6 / WP6 | verifiers, fixtures, re-anchors, static contract, CI wiring, this record, CW2-06B and its Index row, the Backlog closing change, Current State, Project Map, Roadmap; independent review (§8) |

## 2. The two final wording fixes (Product Owner, CP1 approval)

- **R5 (CW2-06B-02 §3):** during S6-03 the internal writer is available to no application role and no callable wrapper is
  created for it. S6-07 remains responsible later for the authorized enrollment path that wraps it, bound to the user's
  consent, the confirmation evidence and the confirmed fact version, under NO_BACKDOOR. The wording is not a permanent
  ban on the approved S6-07 integration.
- **Re-proposal (CW2-06B-05 §7, CW2-06B-14 §1, §3):** the block after a terminal outcome is a *continuing automatic block
  until a Stage 9 policy is approved*, not a final ban.

## 3. What changed

| File | Change |
|---|---|
| `database/migrations/0156_…_v1.sql` | 3 relations (`matching_confirmed_fact_versions`, `matching_confirmed_fact_state`, `matching_eligibility_snapshot_fact_bindings`) with immutability and truth triggers; the internal writer `record_matching_confirmed_facts_core_v1`; the reader `resolve_matching_confirmed_facts_v1`; 6 pure encoding helpers; the evaluator `evaluate_matching_structured_requirements_core_v1`; the policy primitive `install_matching_proposal_policy_version_core_v1`; 5 delta classifiers; 11 forward `CREATE OR REPLACE` (first name, capture, snapshot validity, manual recorder, disclosure gate, recipient projection, the five classifiers), each generated from its live definition with only named, count-asserted edits; the reason CHECK DROP / ADD; 13 delta CHECKs; ACL re-assertion and terminal self-assertions |
| `database/migrations/0157_…_v1.sql` | the block resolver, the two seams, the admission, the orchestrator, the sweeper; discovery and preparation replaced once each, generated the same way; ACL and self-assertions |
| `apps/api/src/connected-worlds/matching/matching-proposal-pipeline.types.ts` | additive vocabulary module; the frozen `matching-proposal.types.ts` and `matching-setup.types.ts` are byte-identical |
| `database/verify-migration-0156.mjs`, `database/verify-migration-0157.mjs` | the two new real-PostgreSQL verifiers (31 + 33 scenarios) |
| `database/tests/matching-confirmed-facts-reproposal-pipeline-v1.test.mjs` | static contract (6 tests) |
| `database/matching-proposal-verifier-support.mjs`, `database/matching-setup-verifier-support.mjs` | fixtures record synthetic confirmed facts through the internal writer before each capture (opposite sex by default), teardown peels the new rows, and the lifecycle registry names the binding relation |
| `database/verify-migration-0111/0112/0113/0114/0120/0155.mjs` | the re-anchors of §5 |
| `package.json`, `.github/workflows/api-ci.yml`, `database/README.md` | the two verifiers wired into the toolchain and API CI after S6-02 |

Not changed: every migration `0001`–`0155`; every `0114` function; the `0120` offer, forward, decline and withdraw cores;
the expiry and revalidation cores; `0116` / `0117`; the six `0149` commands and their grants; `verify-migration-0108`,
`0109`, `0116`, `0117`, `0130`, `0150` (byte-unchanged).

## 4. Evidence (real PostgreSQL 17, local disposable cluster; CI on the exact head is the confirmation gate)

| Area | Proof |
|---|---|
| Confirmed facts, versions, CAS, idempotency, catalogue, R5 posture | `verify-0156` A01–A03, B01–B02 |
| First name: confirmed only; never Name, draft or a confirmed-but-unpromoted value | `verify-0156` C01; the first-name shape equals S6-01's byte for byte (A04) |
| Encoding: strict decoders, version refusal, no free text | `verify-0156` D01, E01–E02 |
| R3 age matrix (31/30/28/29-day months, 29 February, both sides of the month, no possible day) | `verify-0156` D02 (23 cases) |
| R4 horizon | `verify-0156` D03; `verify-0157` L01 (two expiry values each side of `H_min`), L02, L05 (an undecodable PASS fails closed) |
| R4-A lock-wait, discrimination control, retry | `verify-0157` L03 (55000, not 40P01; nothing written; same pair prepares after), L04 (the defective comparison leaves a dead PREPARED), P03 posture; `verify-0120` P03b re-anchored |
| R4-B intermediate decisions | `verify-0157` M01–M04 |
| Pair rule, binding, currentness, the writer race | `verify-0156` F01–F04 |
| B4, NULL projection, zero-field Handoff with every FK | `verify-0156` G01–G03 |
| Privacy floor (delta-only, CHECK = classifier, corpus, false positives, the real filter) | `verify-0156` H01–H05 |
| Policy primitive, nothing installed | `verify-0156` I01–I02, the 0156 self-assertion |
| Re-proposal D6.6 cases 1–13 (R1, R2) | `verify-0157` K01–K13 |
| Admission, orchestrator, sweeper | `verify-0157` N01–N05, P01–P02 |
| Deletion | `verify-0156` J01 (ERASED), J02 (BLOCKED, nothing erased) |
| Regression | every `verify-migration-*` in order on one fresh database (§6); `npm run test:database` 1310 / 1310; root contracts 1375 / 1375; `npm run build:api` passes |

## 5. Re-anchors (each tied to one forward change; none weakens a security assertion)

| Verifier | Re-anchor | Tied to |
|---|---|---|
| `verify-0111` B04 | the three humans get confirmed sexes before discovery; a same-sex human is shown not to be a candidate | CW2-06B-05 §2 |
| `verify-0112` C04 | the projection presents NULL to both recipients; independence is proven on the two BOUND views (other subject, own conclusion) | CW2-06B-07 |
| `verify-0113` P05 | the reason count is the eleven 0110 codes + `COMPETING_MATCH_COMMITTED` + `MATCHING_FACT_VERSION_CHANGED` | CW2-06B-16 |
| `verify-0114` C06 | the four humans are assigned {M, F, F, M} before the first capture | CW2-06B-05 (F-20) |
| `verify-0120` P03b | preparation half: deadline and cadence window still `CURRENT_TIMESTAMP`; exactly one `clock_timestamp()`, read after the deadline mint and before the first write, used only in the expiry refusal, never assigned; the expiry-core half, P02 and every delivery assertion unchanged | R4-A (approved) |
| `verify-0155` P03 | the first-name resolver is compared against its forward redefinition in `0156`; 0155 still defines nothing frozen (P04) | CW2-06B-01 |
| shared fixtures | facts recorded through the writer before capture; teardown; `S6_03_LIFECYCLE_RELATIONS` | CW2-06B-05 |

## 6. Full regression

Every `database/verify-migration-*.mjs` (150 files) was run in order against ONE freshly migrated database, so residue
from any verifier would surface in the ones after it. Result: recorded in §6.1 at the closing change.

### 6.1 Result

**149 / 150 pass**, including `verify-0156` 31 / 31 and `verify-0157` 31 / 31 (before the review fixes of §8; after
them 31 / 31 and 32 / 32, with the I-07 set re-run on the fixed migrations). The one failure is `verify-migration-0133`,
which shells out to `psql`, not installed on this machine: an environment baseline, the same without S6-03.
`verify-migration-0130` fails intermittently on this Windows host at its "7 days" export-grace check and fails
identically on a database without `0156` / `0157` (baseline); it passed in this regression run. CI on the exact head
is the confirmation gate.

### 6.2 The §8.1 change (focused re-run)

The §8.1 change touches one function of `0157` and adds `verify-0157` N05, so only the affected verifiers were re-run, on
a fresh database with all 157 migrations: `verify-0157` **33 / 33** and `verify-0156` **31 / 31**. A mutation control
(the admission with the new condition removed, applied to the same database) fails exactly N05 and nothing else, and
was then restored. No other verifier reads the admission. CI on the exact head is the confirmation gate.

## 7. Deletion and export footprint (handed to `ACCT-DEL-01` / `QAN-BL-ACCT-01` and `QAN-BL-PRIV-04`)

| Relation | References | On delete |
|---|---|---|
| `matching_confirmed_fact_versions` | `public.users`; itself (prior, same owner) | RESTRICT |
| `matching_confirmed_fact_state` | `public.users`; fact versions | RESTRICT |
| `matching_eligibility_snapshot_fact_bindings` | snapshots; pairs; fact versions (× 2) | RESTRICT |

Any committed row makes the `0130` erasure answer a truthful `BLOCKED` with nothing erased (J02). S6-03 commits none in
production, and enrollment stays closed until `ACCT-DEL-01`. The three relations join `QAN-BL-PRIV-04`'s export footprint.

## 8. Independent review

An independent read-only review (architecture, security and privacy, data integrity, Product fidelity; contract §10)
found **no BLOCKER and no MAJOR**. CW2-06B-01 … -16, R3, R4, R4-A and R4-B checked; forward-only, the ACLs, NO_BACKDOOR,
the lock order, the block derivation, the H_min join, the decoders and the delta-only floor were confirmed, and the
re-anchors weaken no security assertion. Its MINOR / NIT findings and their resolution:

| # | Finding | Resolution |
|---|---|---|
| 1 | the sweeper and orchestrator keep every pair lock they take until their transaction ends, in no global order: a batch could deadlock against a human decision | no caller exists; both now state the lock discipline for any future caller (one attempt, `p_max = 1`, per transaction) |
| 2 | the admission does not check that both humans hold a confirmed first name, which the disclosure gate requires | raised to the Product Owner (§8.1); **approved and fixed in this pull request**: new admission answer `FIRST_NAME_NOT_CONFIRMED`, CW2-06B-15 §3 updated, `verify-0157` N05 |
| 3 | the contact delta matches substrings; the given name «هاتف» (also "phone") is refused as a confirmed first name | documented and accepted as a fail-closed false positive, now asserted by `verify-0156` H04 / H05. The reviewer's «التجوال» example is not refused (the bare «جوال» is not in the list), checked live |
| 4 | §6.1 and §8 were placeholders while the banner said CLOSED | filled in by this closing change |
| 5 | the orchestrator swallowed every 23505 | it now absorbs only `MATCHING_LIVE_PROPOSAL_ALREADY_EXISTS` and re-raises any other 23505 |
| 6 | a variable named `found` in the facts reader | renamed |
| 7 | an AGE_RANGE PASS whose value does not decode was silently ignored by H_min | it now has no provable horizon and fails closed (`verify-0157` L05) |
| 8 | discovery relied on predicate order to avoid asking the block about (self, self) | explicit `CASE` guard |
| 9 | the 0156 self-assertion's role list omitted the classifiers | included |
| 10 | no upper bound on `birth_year` (a future year evaluates UNKNOWN, never PASS); full-width hex letters are not mapped by the provenance delta; an unversioned key such as `age_range` is outside the family | accepted as recorded: each fails closed or is the existing manual path for a non-family key |
| 11 | K13 also accepts the revalidation refusal; L03's "precedes" is trivially true after the wait; H03 samples ten ASCII texts | accepted: K13 proves the no-fresh-proposal property it is named for (the block under the lock is K12's), and every delta branch needs a non-ASCII character by construction (static contract) |

### 8.1 Product Owner decision point (from review finding 2) — DECIDED AND CLOSED

CW2-06B-15 §3 lists what the admission checks, and §4 states its purpose: no PREPARED row that a later check already
knew could not be delivered. A confirmed fact version without a confirmed first name is lawful (CW2-06B-01), and the
disclosure gate refuses such a subject (`MATCHING_CANONICAL_FIRST_NAME_UNRESOLVED`). Once a real producer and the CW2-08
seam both answer, such a pair could be admitted and prepared, never delivered, and expired by the sweeper - which places
it under the continuing automatic block although no human ever saw anything. **Recommendation:** add "both humans hold a
confirmed Introduction First Name" to the admission list (one line in `0157`, and one in CW2-06B-15 §3), in this PR or
in the task that first makes the admission able to answer `ADMITTED`. Nothing is affected today: the producer seam
answers `UNAVAILABLE`, so nothing is admitted.

**Decision (Product Owner, 2026-10-15):** fix it in this pull request, with no new task or pull request. **Resolution:**

- `resolve_matching_pair_admission_v1` now answers `FIRST_NAME_NOT_CONFIRMED` unless BOTH humans resolve `RESOLVED` through
  `resolve_matching_canonical_first_name_v1`, the one canonical seam the disclosure gate reads. A version with no
  confirmed first name, or a later version that no longer carries one, is refused.
- The check sits after the pair rule and before the block, the policies and the two seams. Every earlier and later gate
  is unchanged and still decides, and the admission writes nothing.
- CW2-06B-15 §3 carries the new condition. `PAIR_ADMISSION_ANSWERS` (TypeScript) carries the new answer.
- `verify-0157` N05, run under the production first-name seam inside a rolled-back scenario, proves:
  - the first human without a confirmed name is refused, in both argument orders;
  - the second human without one is refused;
  - with both names confirmed, the name condition passes, and the policy, producer, CW2-08 and pair-rule gates each
    still decide;
  - the orchestrator, run from either side, writes no pair, snapshot, binding, proposal, private note or view.

No Launch Gate, grant, policy, producer or proposal is created.

## 9. Backlog disposition (BG-08)

- `QAN-BL-MATCH-05` — **tombstoned**. The durable source, the resolver, the provenance constraints, the tests and the S6-07
  writer interface are delivered. The closure claims no real enrollment and no real-name availability for any production
  participant.
- `QAN-BL-MATCH-01` (S6-07) — unchanged owner; a dated note records the interface S6-07 wraps and the R5 obligations.
- `QAN-BL-ACCT-01`, `QAN-BL-PRIV-04` — unchanged; dated notes record the three new relations in each footprint.
- `QAN-BL-MATCH-03`, `QAN-BL-MATCH-04` (Stage 8A) — unchanged.
- Checked and not admitted (BG-06): policy values, activation, legal age and any re-proposal relaxation (Stage 9, the
  approved roadmap and CW2-06B-12); CW2-08 clearance (the CW2-08 runtime); the neutral proposal copy (S6-04 Copy Gate).
  Each already has its owner; the Task Contract creates no new Backlog ID (§7.1, §9.1).

## 10. Remaining dependencies and risks

- **Enrollment / promotion** (S6-07, `QAN-BL-MATCH-01`): the writer is internal; S6-07 must add the human act, the
  evidence record and the evidence precondition before any production caller exists.
- **Deletion** (`ACCT-DEL-01`): the new RESTRICT relations block erasure by design until it is solved.
- **Producer** (Stage 8A): the admission never admits until a real, evaluated, approved producer answers `READY`.
- **Privacy floor false positives:** documented and accepted fail-closed (CW2-06B-09 §5): e.g. «حامل» (bearer / pregnant),
  «هاتف» (phone) in an innocent sentence. ASCII text is decided exactly as before.
- **Hosted catch-up** (`HOSTED-DEPLOY-01`, `QAN-BL-PROD-06`): `0156` / `0157` are not deployed.
