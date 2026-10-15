# QANDEEL — Connected Worlds v2
## CW2-06B — Confirmed Matching Facts, Deterministic Eligibility, Neutral Pre-Match Presentation and Automatic Re-proposal Protection — Controlled Amendment to CW2-06 v1.0

**Status:** `CANONICAL CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE`  
**Approval:** text approved by the Product Owner on 2026-10-15 (S6-03 CP1, with R3, R4, R4-A, R4-B and R5, and the final
R5 and re-proposal-block wording applied). The binding takes effect on the merge of the pull request that carries it

**Amends:** [CW2-06](QANDEEL_CW2-06_INTRODUCTIONS_MATCHING_RUNTIME_ARCHITECTURE_v1.0_FROZEN.md) in the named scope
only:

| CW2-06 section | What this amendment adds or changes |
|---|---|
| §8–§9 | where confirmed candidate facts live for I-07 |
| §11 | an authority whose approved field set is empty |
| §12, §20, §23 | what is *presented* before Mutual Match |
| §14–§15 | three deterministic dimensions and the snapshot's fact binding |
| §17 | how a policy version is installed |
| §19, §28, §31 | automatic re-proposal after a terminal outcome |
| §24–§26 | the conclusion prerequisite, and an explicitly empty Product field allowlist |
| §33 | one additional private reason |

It also binds, for the questions in §9 below, over:

- P1 canonical closure §4;
- the G2.3 LANG-01 copy amendment unit M-02, for presentability only;
- CW2-06A §4 ("left to S6-03") and §5, as consumed.

**Does not amend:** every other CW2-06 section and invariant (§17 below). Nor does it amend:

- the frozen bytes of any document or migration;
- the SEC-MATCH-00 suspension (`0149`);
- the CW2-08 launch law;
- the S6-01 preparation (`0154`);
- the S6-02 Introduction privacy (`0155`).

**Reason:** the Product Owner's S6-03 Task Contract v1.3 (2026-10-15):

- decisions D1–D7;
- C1–C8;
- R1;
- the R2 clarification.

**Task:** S6-03 — Matching Proposal Pipeline & Intelligence Prerequisites. This is a controlled amendment to CW2-06,
not CW2-09 and not a new Connected Worlds phase.

**Implementation:** realized by S6-03 (migrations `0156`, `0157`; the S6-03 implementation record).

This record is additive:

- The original CW2-06 file remains the historical frozen record. Its bytes and its `CW2_SOURCE_PROVENANCE.sha256`
  entry stay valid.
- The I-07 migrations `0108`–`0122` and their bodies stay byte-identical.
- Behavior changes only by forward migrations that this amendment names.

For the narrow questions below, this later controlled amendment is authoritative.

---

# 1. Why an amendment is needed

CW2-06 and its I-07 runtime were frozen before the Product Owner decided six things. Each needs a place in the
architecture.

1. **Confirmed facts.** Matching v1 rests on facts the owner explicitly confirmed (CW2-06A §4–§5). CW2-06 §8 lists
   candidate self-truth sources, but the runtime has no durable home for them. The I-07 first-name seam
   (`resolve_matching_canonical_first_name_v1`) has no source and fails closed (`QAN-BL-MATCH-05`).
2. **The pair rule and the requirement dimensions.**
   - The pair rule is Product law, not a user dealbreaker.
   - The S6-01 dimensions are structured. The I-07 requirement items are key/value text.
   - Neither CW2-06 nor the runtime says how one becomes the other.
3. **Neutral presentation.** CW2-06 §20 and §23 have a recipient *receive* the candidate's first name and a Safe
   Compatibility Conclusion before Mutual Match. The Product Owner decided instead:
   «Bind internally. Present neutrally. Disclose at Mutual Match.»
4. **Zero disclosed fields.** The runtime refuses a proposal with no disclosed field. The Product Owner approved an
   explicitly empty Product field allowlist under a real human authority (B4).
5. **Re-proposal.** Nothing in CW2-06 or the runtime prevents the same pair from being proposed again after:
   - a human decline;
   - a withdrawal;
   - an expiry;
   - a Mutual Match.

   The Product Owner decided which of these block automatic re-proposal (D6, C5, R1, R2).
6. **Deterministic floor and policy ownership.**
   - The contact-route floor is ASCII-only, and the Product Owner approved an Arabic/English floor (D7, C8).
   - Policies have no install path, and the Product Owner approved a database-owner-only primitive (C6).

---

# 2. `CW2-06B-01` — the durable source of confirmed Matching facts

1. **What it is.** A versioned relation on the I-07 side, `CONFIRMED_MATCHING_FACT_VERSION`, holds one human's
   explicitly confirmed facts:
   - the **Introduction First Name** (P1 §4);
   - **sex** (`MALE` | `FEMALE`);
   - **birth year and month**;
   - **country** and optional **first-level region**;
   - **marital status** (`NEVER_MARRIED` | `DIVORCED` | `WIDOWED` | `CURRENTLY_MARRIED`).

   One pointer per human names the current version.
2. **Only confirmed values exist in it.** A fact is either present, with the confirmation instant its writer recorded,
   or absent. What evidences the human confirmation is S6-07's promotion record, not the row itself (CW2-06B-02
   §3, §5).
   - There is no `DECLARED` or `CORRECTED` state here.
   - A declared-but-unconfirmed or corrected-but-unconfirmed draft value is simply absent.
   - Absent means `UNKNOWN` everywhere downstream.
3. **What it is not.** It is not enrollment, participation, a Matching Context Grant, an Introduction Profile field, a
   Disclosure Authority field or a `PROPOSAL_SAFE_FIELDS` key.
4. **Source isolation.** No I-07 discovery, evaluation, proposal or disclosure boundary reads `0154`.
   - No relation outside `introductions_preparation_private` holds a foreign key into it.
   - No value is read or inferred from:
     - the account Name;
     - a Public identity;
     - Memory, HIM or voice;
     - conversation history;
     - model output.
5. **Shape constraints, not catalogue foreign keys.**
   - The first name has exactly the S6-01 shape: 1–32 Latin or Arabic letters, with the same separators.
   - The country matches `^[A-Z]{2}$`.
   - The region matches `^[A-Z]{2}-[A-Z0-9]{1,3}$`, with the country as its prefix.
   - A region requires a country.
   - The birth year and month are present together.
6. **Supported area.** The ONE writer (`CW2-06B-02`) verifies country and region against the S6-01 controlled
   catalogue at the moment of promotion. It reads the catalogue; it binds no foreign key to it. A syntactically valid
   but unsupported area therefore cannot enter the source, and evaluation never reads the catalogue or the draft.
7. **Access posture.** The relation follows the posture of the rest of I-07:
   - postgres-owned;
   - row-level security on, with zero policies;
   - every privilege revoked from PUBLIC, anon, authenticated and service_role;
   - append-only;
   - every foreign key `ON DELETE RESTRICT`.

# 3. `CW2-06B-02` — versioning, authority and the S6-07 promotion interface

1. **Versions.** A changed confirmed fact is a NEW version that supersedes the current one along the owner's own chain.
   - A historical version is never rewritten.
   - A later version never rewrites a recipient view or a Handoff copy that bound an earlier one.
2. **One internal writer.** S6-03 delivers one database-internal writer, `record_matching_confirmed_facts_core_v1`. It
   is executable by **no role**: not PUBLIC, anon, authenticated or service_role. It:
   - takes the owner's existing Matching serialization row (the same lock every I-07 command takes);
   - compares-and-swaps the expected current version;
   - is idempotent on the version id;
   - validates every shape and the area catalogue;
   - writes the version and moves the pointer.

   It reads no draft and creates no participation, grant, profile, requirement or authority. It is the interface that
   S6-07's reviewed, human-authorized promotion wraps.
3. **The writer is not evidence of human consent (R5).** The writer records values a trusted internal caller supplies.
   That includes each `*_confirmed_at` instant, which is a value the caller asserts.
   - A row it writes does not, by itself, prove that any human declared, reviewed or confirmed anything.
   - Nothing in S6-03 treats a fact version as such proof.
   - A fact version carries no "confirmed by the owner" flag, source label or consent claim of its own. Only its
     values, its owner key, its instants and its chain.
   - **During S6-03** the writer is available to no application role: not PUBLIC, anon, authenticated or
     service_role. S6-03 creates no callable wrapper for it and grants it to nobody.
   - **S6-07 remains responsible later** for the authorized enrollment path that wraps it: binding it to the user's
     consent, the confirmation evidence and the confirmed fact version, under NO_BACKDOOR (`0149`).
   - This wording describes S6-03's own scope. It is not a permanent ban on implementing the approved S6-07
     integration in the future.
4. **No promotion in S6-03.**
   - S6-03 creates no application-executable writer, wrapper, grant, route or worker.
   - It promotes no real data, and no production row exists after it.
   - Every S6-03 test that writes a fact version does so with **synthetic fixture humans** inside a verifier. Such a
     row is test data. It proves only how the runtime behaves, never that any user confirmed anything.
5. **What S6-07 owns.**
   - **The human act.** The explicit, `auth.uid()`-derived human act that confirms and authorizes promotion.
   - **Its evidence.** The durable confirmation evidence: S6-07's own promotion record, which references the exact
     fact version it produced and the exact confirmed preparation-draft version it came from.
   - **The binding to enrollment.** The binding of that evidence to the authorized enrollment operation.
   - **Making evidence a precondition.** Before any production caller of the writer exists, S6-07 makes that evidence a
     precondition of eligibility: the canonical facts reader answers only for a fact version that carries an S6-07
     promotion record. A fact version written any other way can never become eligible in production.
   - **Atomicity with enrollment.**
   - **Deletion safety** (`ACCT-DEL-01`).

   No promotion path opens before `ACCT-DEL-01` is resolved (`QAN-BL-MATCH-01`). Until then, no production caller of
   the writer exists and no production fact version can exist.

# 4. `CW2-06B-03` / `CW2-06B-04` — canonical encoding of the structured requirements

1. **One store.** The structured S6-01 requirements are written as ordinary items of the existing
   `MATCHING_REQUIREMENT` versions (`0108`). No second requirement store exists.
2. **Keys and strengths (encoding v1).** The encoding version is part of the key.

   | Dimension | `HARD_DEALBREAKER` key | `SOFT_PREFERENCE` key |
   |---|---|---|
   | `AGE_RANGE` | `age_range_v1` | `age_range_preference_v1` |
   | `MARITAL_STATUS` | `marital_status_v1` | `marital_status_preference_v1` |
   | `AREA` | `area_v1` | `area_preference_v1` |

   A canonical key carries only its own strength. Every key satisfies the frozen 0108 key shape and the contact-route
   ban.
3. **Values.** Values are ASCII with no whitespace and are matched by an anchored full-string grammar.
   - `AGE_RANGE`: `min=<A>;max=<B>`.
     - A and B are whole numbers 18–99, with no leading zero, and A ≤ B.
   - `MARITAL_STATUS`: `accepted=<S1>[,<S2>…]`.
     - Values come from the four marital values only.
     - There are 1–4 of them, distinct, in strictly ascending byte order.
   - `AREA`: `country=<CC>` or `country=<CC>;regions=<R1>[,<R2>…]`.
     - Regions are distinct and in strictly ascending byte order.
     - Each region is prefixed by CC.
4. **Mapping from S6-01.**
   - `{dimension:'AGE_RANGE',min,max}` → `age_range_v1` = `min=…;max=…`.
   - `accepted` → the sorted set.
   - `countryCode` / `regionCodes` → `country=…` and the sorted `regions=…`.
   - The draft's hard set maps to `HARD_DEALBREAKER` keys and its soft set to `SOFT_PREFERENCE` keys.
5. **Strict decoding.** A value that does not match the grammar exactly cannot be decoded. Neither can a key of the
   same family whose version is not `v1`, such as `age_range_v2`. For a hard item, either case is recorded `UNKNOWN`,
   never `PASS`. Free text is never interpreted.
6. **No implicit requirement.** The encoding adds no item the owner did not confirm, and it encodes no Product rule.
7. **Provenance.**
   - The item belongs to the owner's own requirement version (composite owner key, 0108).
   - The S6-07 promotion record evidences that it came from the owner's reviewed, confirmed draft.
8. **Coexistence.** Existing immutable versions and items outside the family are untouched.
   - Such items have no deterministic evaluator.
   - An unevaluated hard item keeps blocking preparation (CW2-06 §14; 0110 eligibility truth), until a later reviewed
     slice evaluates it (free-text evaluation: Stage 8A).
9. **`NONE_ADDITIONAL` (`CW2-06B-04`).** "No additional personal hard dealbreakers" is represented by the ABSENCE of
   hard family items.
   - It is never represented by an invented item or a sentinel.
   - The frozen I-07A command refuses an empty item set (`0109:671`). Reconciling that is `CA-10`, owned by S6-07,
     with the `ACCT-DEL-01` dependency.
   - S6-03 does not alter `0109`.

# 5. `CW2-06B-05` — the Product pair rule, age uncertainty and the snapshot's fact binding

1. **The pair rule (`CA-09` part 2).** Matching v1 evaluates only a pair of one confirmed `MALE` and one confirmed
   `FEMALE` human, each fact in that human's own current confirmed version.
   - Missing, unconfirmed or equal values are `UNKNOWN` or `FAIL`.
   - Either way the pair is not eligible.
   - Nothing infers sex.
2. **Where it is enforced.** At candidate discovery and at eligibility snapshot capture. Capture refuses with the same
   single bounded answer it already gives for a non-eligible pair, which names neither human.
3. **Not a user requirement.** The rule is never written as a `matching_hard_requirement_results` row. That relation's
   foreign keys require a real item of the human's own requirement version. The Product gate and the human results are
   separately provable.
4. **Snapshot fact binding.** A captured snapshot binds both humans' exact current fact versions in a new append-only
   relation, `MATCHING_ELIGIBILITY_SNAPSHOT_FACT_BINDING`.
   - Its trigger proves that the two humans are the snapshot's own.
   - It proves that both bound versions carry confirmed, different sex values.
   - It records the rule identity `OPPOSITE_SEX_CONFIRMED_V1`.
   - A binding exists only for a pair that passed the rule.
5. **Currentness.** The one revalidation (`resolve_matching_snapshot_validity_v1`) also asks whether both humans'
   CURRENT fact versions are still the bound ones. A missing binding or a moved version is invalid, with the private
   reason `MATCHING_FACT_VERSION_CHANGED` (`CW2-06B-16`).
   - Every advancing step reaches that revalidation: preparation, offer, forward and Mutual Match commit.
   - A fact change therefore stales progress, and the existing protective revalidation ends a live proposal.
   - The order of locks is unchanged: both humans' Matching serialization rows, in canonical order.
   - The CW2-06B-02 writer takes the same row.
6. **The deterministic evaluator.** One internal core evaluates every hard family item of both humans' bound
   requirement versions against the OTHER human's bound fact version, and records `PASS | FAIL | UNKNOWN`.
   - The evidence source class is `EXPLICIT_MATCHING_ANSWER` for an established outcome and `NOT_ESTABLISHED` for
     `UNKNOWN`.
   - It is the only producer of results for family keys. The existing manual recorder refuses a family key.
   - Rules for each dimension:
     - `MARITAL_STATUS`: `PASS` when the other's confirmed status is accepted, and `FAIL` when it is confirmed and
       not accepted.
     - `AREA`: `FAIL` when the confirmed country differs.
       - With no listed regions, a matching confirmed country is `PASS`.
       - With listed regions, a confirmed region inside them is `PASS`, and a confirmed region outside them is `FAIL`.
       - A missing region is `UNKNOWN`.
     - Any missing fact is `UNKNOWN`.
   - Soft preferences are never evaluated as gates.
   - No rank, score, percentage, weight or inferred trait is produced.
7. **Age from year and month (C7; corrected by R3).**
   - **Reference date.** The reference date `R` is the UTC calendar date of the snapshot's capture instant.
   - **Possible birth dates.** The possible birth dates are every day `d` of the confirmed month that is not later
     than `R`.
   - **Full-year age.** The full-year age for one possible day is
     `age(d, R) = (R.year − d.year) − (1 if (R.month, R.day) < (d.month, d.day) else 0)`.
     - Under this rule a 29 February birthday is reached on 1 March in a non-leap year.
   - **The only rule (R3).**
     - `PASS` only if `age(d, R)` lies inside `[min, max]` for EVERY possible day.
     - `FAIL` only if it lies outside the range for every possible day.
     - Otherwise `UNKNOWN`, which happens exactly when the range boundary falls between two possible days.
     - There is no other rule. The position of the birth month relative to the reference month decides nothing by
       itself.
     - Example: a confirmed December 1990 birth, at any October 2026 reference date, is 35 for every possible day.
       So `[30, 40]` is `PASS` and `[36, 40]` is `FAIL`.
   - **No possible day.** If no day of the confirmed month is on or before `R`, there is no possible birth date. The
     fact is then unusable for that reference date and the outcome is `UNKNOWN`.
   - **How long a `PASS` stays certain (R4).** Over time a full-year age only grows, so the lower bound of a `PASS`
     can never lapse. The upper bound lapses first for the earliest possible day, the 1st of the month.
     - The **age-certainty horizon** of a `PASS` is the instant `H = (birth_year + max + 1)-(birth_month)-01 00:00 UTC`.
     - Before `H` the `PASS` is certain on every date. From `H` it no longer is.
     - `H` is a pure function of the bound fact version and the bound requirement item. It is never stored, so
       nothing can drift from it.
   - **How eligibility stays true for the proposal's whole life (R4).** A proposal may be created only if its own
     deadline, `expires_at`, is strictly earlier than `H_min`, the smallest `H` among the snapshot's `AGE_RANGE`
     `PASS` results. `H_min` is computed from the bound fact versions and bound requirement items, read under the
     pair lock. A snapshot with no `AGE_RANGE` `PASS` has no `H_min` and no horizon condition.
   - **R4-A — the preparation instant.**
     - **The deadline is still minted from the transaction instant.** It stays
       `deadline := CURRENT_TIMESTAMP + make_interval(hours => expiry_hours)`, and `prepared_at` keeps its default.
       0120 classifies this clock SAFE-SNAPSHOT because a start-of-transaction instant can only shorten a
       proposal's life, never lengthen it, so it is not replaced.
     - **But that clock cannot decide whether to create the proposal.** It is fixed before preparation waits on
       the canonical pair lock, so a preparation that resumes after a long wait would compare an instant that has
       already passed. The decision is therefore taken against a real instant, at the last point before the first
       write.
     - **Order inside preparation:**
       1. the pair lock;
       2. the equivalent-retry answer, from the committed row, before any deadline decision (as in the 0120 gate);
       3. revalidation;
       4. the re-proposal block;
       5. cadence and pending;
       6. the deadline mint;
       7. computing `H_min`;
       8. `checked_at := clock_timestamp()`, captured exactly once;
       9. the two refusals below;
       10. then immediately `INSERT INTO public.matching_proposals`, the first write.
     - **The two refusals:**
       - `MATCHING_PROPOSAL_EXPIRED` (the existing code, `55000`) if `deadline <= checked_at`;
       - `MATCHING_ELIGIBILITY_HORIZON_EXCEEDED` if `deadline >= H_min`.
     - **Either refusal writes nothing.** No `PREPARED` proposal, no transition, nothing counted toward cadence or
       pending, and no re-proposal block, because a proposal that was never created can never become `EXPIRED`.
       This is the concrete reason the check matters: without it, a preparation that resumed after its own deadline
       would leave a dead `PREPARED`. The sweeper would turn it into `EXPIRED`, which under CW2-06B-14 imposes on the
       pair a continuing automatic block until a Stage 9 policy is approved.
     - **When both pass,** `checked_at < deadline < H_min`, so the age `PASS` holds when the proposal is created.
     - **`checked_at` is used only in these two refusals.** It never becomes the deadline, `prepared_at` or any
       stored value, so no proposal's life can be lengthened.
     - **0120 and 0114 are untouched by R4-A.** The disclosure deadline logic in 0120 and the commit instant in
       0114 do not change.
     - **One existing assertion is re-anchored (test only).** verify-0120 P03b asserts that preparation contains
       no `clock_timestamp`. It is re-anchored to what the classification protects:
       - the deadline and the cadence window are still minted from `CURRENT_TIMESTAMP`;
       - `clock_timestamp()` appears exactly once, only in the refusal comparison, and is never assigned to the
         deadline.

       The expiry-core half of P03b and the static source pins on 0112 and 0120 are unchanged. Rejected
       alternative: moving the clock into a separate helper so that the old needle stays literally true. That
       would hide a wall clock from an assertion written to see it.
   - **R4-B — which steps decide the deadline (precise).**
     - **Three steps decide the deadline against a real instant before their first write:**
       - preparation (R4-A, `checked_at`);
       - the disclosure gate inside offer-to-first and forward-to-second (0120, `delivery_at`);
       - the Mutual Match commit (0114, `birth_at`).
     - **The intermediate decisions have no deadline check of their own:**
       - the forward approval (`approve_matching_proposal_forward_core_v1`, 0114);
       - decline as first, decline as second and withdraw (0120).

       The expiry terminal keeps its conservative transaction clock. So it is NOT true that every step is refused
       at or after `expires_at`.
     - **Why no intermediate decision can get around the delivery or commit gates:**
       1. A forward approval after the deadline, before the sweeper runs, can still write `FIRST_FORWARD_APPROVED`
          and its view binding. That is existing behavior. It discloses nothing to anyone and creates no Match.
       2. The only advancing exit from `FIRST_FORWARD_APPROVED` is `FORWARDED_TO_SECOND` (the legal-transition
          CHECK, 0110:754). The forward core writes that transition only after the disclosure gate, in the same
          transaction. The gate refuses when `delivery_at >= expires_at` before its first write, so the whole
          transaction rolls back.
          - An equivalent retry answers only a delivery that was committed before the deadline.
          - That every delivery passes through the gate is pinned by the 0120 self-assertion and verify-0120 P03.
       3. The commit is legal only from `FORWARDED_TO_SECOND`. It requires the bound approval view and refuses when
          `birth_at >= expires_at`. So a late approval can never reach a commit, and a proposal forwarded in time
          cannot commit after its deadline.
       4. Declines and withdraw only end the proposal. They disclose nothing new and open nothing. A late decline
          yields `FIRST_DECLINED` or `SECOND_DECLINED` instead of `EXPIRED`, and under CW2-06B-14 all of these block
          re-proposal identically, so the outcome is the same.
       5. A late approval keeps the proposal pending until the sweeper expires it (`FIRST_FORWARD_APPROVED → EXPIRED`
          is legal), exactly as `OFFERED_TO_FIRST` does today. This can only refuse more preparations, never fewer.
     - **Age at every step.** Every disclosure and the commit happen at a real instant before `expires_at`, so
       before `H_min`, and the age `PASS` is certain at each of them. A late intermediate decision may fall after
       `H_min`, but by points 1–4 it leads to no disclosure and no Match.
     - **No proven security need to change 0114 or 0120, so S6-03 does not.** Specifically:
       - no 0114 function is replaced;
       - no deadline decision or clock in 0114 or 0120 changes;
       - the only function S6-03 replaces whose current body comes from 0120 is the disclosure gate, for B4
         (CW2-06B, the zero-key branch). That change sits inside the unchanged `IF disclosed = 0 THEN`, and its
         clock and deadline lines and their order stay byte-identical (verify-0120 P02).
   - **Properties that remain:**
     - No clock is added to the delivery path.
     - No additional private reason is needed. `MATCHING_PROPOSAL_EXPIRED` is an existing refusal code, not a
       transition reason.
     - The guarantee holds for ANY configured expiry. It depends on no particular value: the 72-hour figure stays a
       research target only (D6.1).
     - A configured expiry that would carry a proposal past `H` makes preparation refuse. The deadline is never
       shortened to fit.
     - A refused pair may be captured again when a new snapshot is lawful. It is not blocked, because nothing
       terminal happened.
   - **What revalidation still covers.** Revalidation stays identity-based (§5 item 5). A changed fact version is
     still `MATCHING_FACT_VERSION_CHANGED`. Age needs no revalidation clock because of the horizon rule above.
   - **Stage 9.** The legal adult threshold and jurisdiction rules are Stage 9's. Their absence is never legal
     clearance, and the horizon rule opens no launch path.

# 6. `CW2-06B-06` — a real, owner-controlled zero-field Pre-Match Disclosure Authority

1. **The authority stays mandatory.** A snapshot and a recipient view still bind the subject's own current
   `PRE_MATCH_PROPOSAL_DISCLOSURE_AUTHORITY` over the exact bound profile version.
   - The identities stay `NOT NULL`, under the original composite foreign keys.
   - No system grant, sentinel or fictional consent exists.
2. **Zero fields.** Under CW2-06 §11 the authority covers Product-permitted Safe Compatibility Conclusions as well as
   profile material. An authority that approves zero profile fields and permits the bounded conclusion is a lawful
   authority.
   - Its future human act is S6-07's (`0109` stays unchanged and suspended).
   - That act must not make the consent symbolic or misleading.
3. **Explicitly empty Product allowlist.** A `PROPOSAL_SAFE_FIELDS` policy version with zero keys means "Product
   permits no profile field before Mutual Match".
   - Under exactly that current policy the disclosure gate may produce a view with zero fields.
   - An empty intersection under a NON-empty policy is still refused (`MATCHING_PROPOSAL_DISCLOSURE_EMPTY`).
   - A missing policy is still refused.
   - Zero fields bypass no check:
     - audience and direction derivation;
     - authority and profile currency;
     - the permitted conclusion and its audience;
     - the confirmed first name;
     - the value filter;
     - the exact delivery instant and deadline.
4. **Handoff.** With zero view fields the Mutual Match Handoff carries zero field rows. Every `0113`–`0114` foreign key
   and truth trigger still binds:
   - the exact two views;
   - the exact first names those views bound;
   - the exact permitted conclusions.

# 7. `CW2-06B-07` — internal binding versus neutral presentation

1. **Bind internally.** Every recipient view remains bound to:
   - its exact proposal, recipient and subject;
   - the eligibility snapshot;
   - the subject's current authority and profile version;
   - the Product field policy;
   - the subject's confirmed Introduction First Name;
   - one recipient-specific permitted Safe Compatibility Conclusion.

   None of these constraints is removed.
2. **Present neutrally.** `resolve_my_matching_proposal_v1` keeps its exact signature, result columns and audience rule.
   - It returns `presented_first_name = NULL` and `safe_compatibility_conclusion = NULL` in every state, including
     after Mutual Match.
   - The neutral outcome and the action affordance follow the existing rules unchanged.
   - Nothing new is revealed through an error, a branch or metadata.
   - `resolve_my_matching_proposal_fields_v1` is unchanged. Under the initial (empty) Product allowlist it returns
     zero rows.
3. **Disclose at Mutual Match.**
   - The Handoff copies the bound name and conclusion exactly as today.
   - What each Introduction participant may see is decided by the S6-02 projection (`0155`), not by the proposal
     projection.
   - Storing a conclusion in the Handoff does not by itself authorize showing detailed compatibility reasoning.
4. **No copy.** This amendment and S6-03 create no user-visible proposal copy.
   - The neutral proposal message belongs to the S6-04 Copy Gate.
   - Richer post-Match explanation belongs to S6-05 and Stage 8A, within their own authority.

# 8. `CW2-06B-08` — precedence over CW2-06 §11, §20, §23, P1 §4 and G2.3 M-02

| Source | Earlier statement | Now reads | Preserved |
|---|---|---|---|
| CW2-06 §11 | the authority covers approved profile material and Product-permitted conclusions | unchanged; the approved profile field set may be empty (§6) | the authority is mandatory, explicit, owner-bound and current, and covers no raw evidence or contact data |
| CW2-06 §12 | the pre-Match ceiling: first name, minimal approved information, safe conclusion | unchanged as a CEILING; v1 presents less than the ceiling (§7) | every exclusion in §12 |
| CW2-06 §20 | the first recipient *receives* the candidate's first name, bounded approved information and a recipient-specific conclusion | the first recipient's view is BOUND to those things, and what is *presented* before Mutual Match is the neutral projection of §7 | the candidate is not notified; independence of the views; exact-view binding |
| CW2-06 §23 | the second recipient receives an independent recipient-specific proposal | the same split: bound internally, presented neutrally | independence; no copy of the first-side wording |
| P1 closure §4 | the Introduction First Name "supplies CW2-06 §12's first name disclosure" | it is the ONLY canonical first-name source (§2); its *presentation* happens at and after Mutual Match through the Handoff and the S6-02 projection | not inferred from Name; not part of sign-up; a prefill is not authority |
| G2.3 / LANG-01 M-02 | the fixed QANDEEL-view paragraph asserting «نقاط اتفاق كثيرة» | presentable only where a genuine permitted conclusion supports it and the S6-04 Copy Gate approves it for that context | the approved wording itself; LANG-01 ownership of wording |

# 9. `CW2-06B-09` — the deterministic Arabic/English privacy floor

1. **Extension only.**
   - The five I-07B classifiers are redefined forward. Each new definition is the old rule OR an extension.
   - Every existing CHECK stays.
   - A NEW delta CHECK is added beside each one that the extension concerns. It refuses ONLY the new patterns, so
     every existing proof stays true.
2. **What the extension covers.**
   - Arabic-Indic (U+0660–U+0669) and Extended Arabic-Indic/Persian (U+06F0–U+06F9) digits, alone or mixed with
     Western digits, in runs that the existing digit-run rule would refuse for Western digits.
   - Common separators.
   - Arabic and transliterated words for phone, number, mobile, WhatsApp, Telegram, Instagram, Snapchat, Facebook,
     Twitter/X, e-mail and "contact me".
   - Arabic-script and mixed-script domains, links and handles.
   - Arabic sensitive-fact markers (health, reproductive, financial, legal, immigration, substance) for the
     conclusion filter.
   - Adversarial text/number combinations.
3. **Where it applies.**
   - Confirmed first-name values.
   - The Safe Compatibility Conclusion candidate (through the filter) and the permitted text.
   - Recipient-view first names and field values.
   - Handoff names, conclusions and field values.
   - Any other reachable pre-Match disclosure sink proven in CP0. There is none other.
4. **Encoding hygiene.** Non-ASCII characters in CHECKs and classifiers are built from code points (`chr()`), never
   typed into a migration. The single exception is the first-name shape, which reuses the exact S6-01 expression.
5. **Agreement.**
   - One shared corpus proves that each classifier refuses exactly what its CHECK pair refuses.
   - It also proves that legitimate Arabic names and ordinary sentences pass.
   - False positives are documented and accepted as the fail-closed cost.
   - A later model-assisted review may only ADD refusals.

# 10. `CW2-06B-10` — corrections after enrollment

- The owner-facing correction of a confirmed fact after enrollment is S6-07's, with `CA-10` and `ACCT-DEL-01`.
- A correction of the mutable preparation draft never mutates the durable source.
- S6-03 defines only how versions and currentness are read (§3, §5.5).

# 11. `CW2-06B-11` — impact on triggers, ACLs, boundaries and verifiers

1. **Unchanged frozen guarantees.** These are unchanged:
   - every `0110`–`0120` truth trigger, foreign key, unique index and row-level-security posture;
   - the one-live-proposal-per-pair index;
   - the immutable transition chain and its single writer;
   - the human-decision `auth.uid()` rule;
   - the exact-view order;
   - the CW2-08 seam's answer;
   - the protective cores' independence from clearance;
   - the 0113/0114 Handoff guarantees;
   - the 0155 projection;
   - the 0149 privileges and NO_BACKDOOR.
2. **New objects.** Every new object follows the I-07 posture:
   - postgres-owned, `SECURITY DEFINER`, empty `search_path`;
   - executable by no role;
   - row-level security on, with zero policies;
   - `RESTRICT` foreign keys;
   - append-only history.

   No function names a suspended `0109` boundary.
3. **Verifiers.**
   - `verify-migration-0108`, `0109`, `0116`, `0117`, `0130` and `0150` stay byte-unchanged and pass.
   - The shared verifier fixtures provision confirmed facts through the CW2-06B-02 writer.
   - The exact re-anchors are listed in the S6-03 record. Each is tied to one forward change, and none weakens a
     security assertion.

# 12. `CW2-06B-12` — deferred dependencies and their owners

| Dependency | Owner | Status |
|---|---|---|
| Human-authorized promotion, enrollment, `CA-10`, post-enrollment correction | S6-07 (`QAN-BL-MATCH-01`) | `DEFERRED — OWNED` |
| Account-deletion integrity for enrolled participants | `ACCT-DEL-01` (`QAN-BL-ACCT-01`) | `DEFERRED — OWNED` |
| The real Safe Compatibility Conclusion producer; understanding readiness; free-text requirement evaluation | Stage 8A (`QAN-BL-MATCH-03`, `QAN-BL-MATCH-04`) | `DEFERRED — OWNED` |
| Policy values, policy activation, legal age, any re-proposal relaxation | Stage 9 | `DEFERRED — OWNED` |
| CW2-08 safety / moderation / entitlement / Launch Gate clearance | CW2-08 runtime | unchanged |
| Neutral proposal copy | S6-04 Copy Gate | `DEFERRED — OWNED` |
| Matching data export | `QAN-BL-PRIV-04` | unchanged; the new relations join its footprint |

# 13. `CW2-06B-13` — policy installation (C6)

1. **One primitive.** One database-owner-only primitive, `install_matching_proposal_policy_version_core_v1`, installs
   or supersedes one version of one of the five existing kinds, with its exact typed values. For
   `PROPOSAL_SAFE_FIELDS` it installs the exact key set, which may be empty. It moves the pointer forward along that
   kind's own chain.
2. **Not reachable by applications.** It is executable by no application role. It is exposed through no endpoint,
   worker or wrapper. Its only intended caller is a separately governed operator change.
3. **Nothing installed.** No policy row is installed by S6-03.
   - The research targets (about 5 a week, 2 pending, 72 hours) are not defaults.
   - A missing policy is never permissive.
   - No new kind exists.

# 14. `CW2-06B-14` — automatic re-proposal protection (D6, C5, R1, R2)

1. **What blocks.** A canonical unordered pair is under a continuing automatic block on re-proposal, until a Stage 9
   policy is approved (§6 below), when any proposal over that pair has ever reached one of these states:
   - `FIRST_DECLINED`;
   - `SECOND_DECLINED`;
   - `WITHDRAWN`;
   - `EXPIRED`, including `PREPARED → EXPIRED` that no human ever saw;
   - `MUTUAL_MATCH_COMMITTED`.

   The last covers both later Introduction outcomes, `INTRODUCTION_COMPLETED` and `INTRODUCTION_ENDED`. The original
   committed Match is sufficient.
2. **What does not block.** `STALE` and `CANCELLED_BY_COMPETING_MATCH` are system outcomes. They do not block, and they
   stay subject to every existing eligibility, cadence and currentness rule.
3. **Derived, not stored.** The block is derived from the immutable proposal transition chain, read through the
   proposals' terminal states and their composite transition keys.
   - There is no independent rejection ledger and no cooldown.
   - It is a continuing automatic block until a Stage 9 policy is approved, not a final ban. Until then it does not
     lapse with time, restart or resume.
   - It does not lapse with either human's later `0117` reactivation, or with the end or completion of an
     Introduction.
   - Reversing the direction cannot bypass it, because the pair is unordered.
   - Another pair is never blocked by a human's history with someone else.
4. **Where it is enforced.** At candidate discovery, at the pre-preparation admission, at proposal preparation and in
   the orchestrator.
   - It is enforced in the runtime cores rather than as a persistence trigger, which keeps 0110's persistence
     contract. The one proposal producer is the preparation core.
   - Preparation checks it inside the canonical two-human serialization region, which Mutual Match commit and every
     terminal transition also hold. So a concurrent commit or terminal event cannot be followed by a fresh automatic
     proposal.
5. **EXPIRED is not a refusal.**
   - It is never recorded as a decline.
   - It carries no human actor (0110 actor rule).
   - It produces no refusal reason.
   - It is projected exactly as today.
   - It is not a permanent Product ban.
6. **Lifting the block.** Only a later reviewed Stage 9 policy, under its own Controlled Amendment, may define a lawful
   relaxation. A future user-authorized exception or reactivation mechanism needs its own approval. The absence of
   such a policy is never permission.
7. **Language.** `COMPLETED` records the successful completion of the Introduction phase only. It is never presented
   as a relationship status, engagement, exclusivity or marriage.

# 15. `CW2-06B-15` — the conclusion prerequisite and the pre-preparation admission

1. **The producer seam.** The readiness seam `resolve_matching_compatibility_producer_readiness_v1` answers
   `UNAVAILABLE` until the Stage 8A producer is real, evaluated and approved. It makes no model call, imports no
   router and has no fallback. It cannot answer otherwise, and a self-assertion proves this.
2. **Conclusions are untrusted input.** A future producer submits conclusions as untrusted input through the existing
   path:
   - candidate → Sensitive Conclusion Filter → permitted conclusion.

   The filter stays mandatory. No other writer of a permitted conclusion exists.
3. **The admission.** The pair-scoped admission, `resolve_matching_pair_admission_v1`, is evaluated BEFORE any pair,
   snapshot or proposal is written. It answers `ADMITTED` only when all of the following hold:
   - both humans are currently matchable;
   - the pair rule passes on current facts;
   - the pair is not blocked;
   - every required policy is configured;
   - the producer seam answers `READY`;
   - a pair-scoped CW2-08 seam answers `CLEARED`. That seam is `resolve_matching_pair_prerequisites_v1`, and today it
     answers `NOT_EVALUATED`, exactly like the proposal-scoped seam.

   Today it therefore never admits.
4. **No optimistic preparation.** No PREPARED row is written that a later check already knew could not be delivered.
   The proposal-scoped CW2-08 seam is untouched and is not claimed to be cleared.

# 16. `CW2-06B-16` — the private reason `MATCHING_FACT_VERSION_CHANGED`

- One private reason is added to the proposal transition reason vocabulary: `MATCHING_FACT_VERSION_CHANGED`.
- It is added by the same forward DROP/ADD pattern `0113` used for `COMPETING_MATCH_COMMITTED`.
- It is private operational state like every other reason. No recipient projection returns it.

# 17. What stays as it is

- Every CW2-06 section and invariant not named above.
- The no-photo pre-Match law.
- §52 no marketplace or contact path.
- §53 pair privacy.
- §28 rejection and expiry privacy.
- §36 single winner.
- §41 Handoff contents.
- §42 Matching→Shared isolation.

Also unchanged: the six suspended commands, the CW2-08 law, the CW2-06A preparation, the S6-02 Introduction privacy,
and every frozen byte.

# 18. Explicit non-amendments

This amendment does not:

- create real enrollment, a real proposal, a Match or an Introduction;
- install a policy;
- create a compatibility producer;
- perform paid AI calls;
- create a worker or an application route;
- create proposal UI or copy;
- implement progressive disclosure or reactivation;
- implement deletion;
- open a Launch Gate;
- create a new task or backlog obligation.

# 19. Implementation status

`APPROVED — realized by S6-03` (migrations `0156` and `0157`) in one pull request. The binding takes effect on that pull
request's merge.
