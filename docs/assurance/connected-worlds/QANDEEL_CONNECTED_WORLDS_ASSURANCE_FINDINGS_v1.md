# QANDEEL — Connected Worlds
## QAN-CW-ASSURE-01 — Assurance Findings Register v1

**Baseline:** `5de5271b52b4a3b1404d477aa8406cf86b859943` · migration tip `0118`
**Evidence standard:** every finding is `STRUCTURAL-PROOF` (§27). No PostgreSQL exists on the review
host — `initdb.exe` is blocked by Windows Application Control — so no probe could be executed. Each
concurrency-dependent finding carries the exact two-transaction reproduction a PostgreSQL host must
pin.
**Order:** BLOCKER → HIGH → MEDIUM → LOW → OBSERVATION.

**Counts:** BLOCKER 0 · HIGH 2 · MEDIUM 3 · LOW 4 · OBSERVATION 9

**Every finding below survived three independent adversarial refutation attempts** (mechanism, frozen
contract, reachability). Where a refuter corrected the scope, severity, owner or invariant, the
correction is applied and marked. Three further candidates were **withdrawn** during that process and
are recorded as negative evidence in the main report rather than deleted.

---

# BLOCKER

**None.**

No path was found by which the current canonical runtime can violate human consent, a privacy
boundary, an audience boundary, single terminal truth, single-winner correctness, cross-world
authority, protected source availability or durable lifecycle integrity with executable evidence.
Every consequential write boundary in `0090`–`0118` is executable by no application role, so no
finding is reachable end-to-end today. That is a severity bound and is recorded as such on every
finding; it is not treated as a defence, because six of the nine findings are defects in an authority
derivation, a lock predicate or a clock source — all of which sit behind the launch seam that is
designed to be removed.

---

# HIGH

## `ASSURE-F05` — Owner deletion never reaches the Public DRAFT derivative, and a `service_role` boundary serves the deleted text forever

**Affected phases:** I-04 Shared (owner deletion) × I-05 Public (draft derivative + review boundary).
Cross-phase.
**Affected migrations/functions:** `0093 prepare_public_experience_manifest_v1`,
`0093 resolve_public_package_items_v1`, `0093 resolve_public_experience_review_v1`,
`0092 public_experience_text_derivative_bodies` + its immutability trigger,
`0090`/`0115 delete_shared_world_owned_material_v1`.

**Frozen invariant violated**
- CW2-02 §27 + `B19`/`B20` — owner deletion "invalidates future QANDEEL access/use of
  **source-content-bearing internal derivatives** unless a later explicit rule preserves them"; source-
  content-bearing and analytical derivatives are distinct classes. No later explicit rule preserves
  this one.
- CW2-03 §37 + `C32` — owner-deleted material is unavailable for future use and cannot be
  reconstructed; "a history/view entitlement cannot preserve deleted source content".
- CW2-01 `A18` — owner-deleted Shared material cannot be reconstructed by QANDEEL.
- CW2-08 §2 lists "deleted-content non-serving" among the **non-waivable** invariants.

**Exact current behaviour**
`resolve_public_package_items_v1` (`0093:521`) selects the Shared body verbatim —
`CASE s.src_class WHEN 'MY_WORLD' THEN cu.committed_text ELSE b.body_text END` at `0093:548`,
returned as `public_text_body` at `0093:574` — and `prepare_public_experience_manifest_v1` writes it
into `public_experience_text_derivative_bodies` at `0093:1171-1176`, classified
`SOURCE_CONTENT_BEARING_DERIVATIVE` at `0093:551-552`. `database/README.md:1542` states it outright:
"The public derivative is the exact committed source text."

`delete_shared_world_owned_material_v1` destroys only the Shared body and marks the history item
`DELETED_BY_OWNER` with a bumped availability revision. It touches no Public relation, and none exists
that it could touch: `public_experience_text_derivative_bodies` has exactly **one writer**
(`0093:1171`) and **no deleter anywhere in the repository**, and `0092:531-532` installs a
`BEFORE UPDATE OR DELETE` immutability trigger that refuses removal for every role through ordinary DML.
*(Pass-3 correction: an earlier draft said "structurally permanent, including for the table owner". That
is overstated — the owner can `ALTER TABLE … DISABLE TRIGGER`, and `verify-migration-0093.mjs:728-729`
does exactly that. The accurate claim is that **no canonical primitive removes it and no reviewed path
exists to**.)*

**Two facts that strengthen the finding, added in Pass 3.**
1. **The review boundary is the SOLE surviving path to the bytes after deletion.** It is not redundant
   with access the controller already had: `resolve_shared_world_history_visibility_v1` filters
   `i.availability_state = 'AVAILABLE'` in all four of its branches (`0115:990-1145`), so once the
   author deletes, the controller loses the Shared view of that material entirely — and keeps only this
   one.
2. **The copy is made before any rightsholder approval exists, and the author cannot observe it.**
   `0093:1171-1176` writes it at *prepare* time; approval is required only to reach `READY_FOR_REVIEW`
   (`0093:1514-1519`). The author may never approve, the provenance is sealed (`0092:388-393`, and the
   resolver is forbidden from reading it), and there is no producer-side notification anywhere.

`resolve_public_experience_review_v1` (`0093:1576-1611`) returns `b.public_text_body` with predicates
only on controller match (`0093:1602-1603`), the Experience's current version (`0093:1604`), its
manifest (`0093:1605`) and the Experience id (`0093:1609`). It performs **no** availability check,
**no** `captured_availability_revision` comparison, **no** `captured_source_digest` re-check, and calls
neither `derive_public_publication_authority_v1` nor `resolve_shared_world_history_visibility_v1`. It
is `service_role`-executable — the sole resolver grant of the slice.

**Preconditions**
A Shared World with at least two humans; a member other than the author who can currently see the
author's material; that member creates a Public Experience draft (becoming its sole controller) and
prepares a manifest including the author's material; the author later invokes owner deletion. **No
race and no unusual state is required** — the deletion may follow minutes or years later, and both
commit orders end in the same durable state. Reaching the *write* half needs the CW2-08 gate opened far
enough for `create_public_experience_draft_v1` and `prepare_public_experience_manifest_v1`
(`0093:1651-1656`: executable by no application role today). The *read* boundary is already open to
`service_role`.

**Evidence:** `STRUCTURAL-PROOF` — `EV-F05-01` … `EV-F05-08`.

**Expected behaviour**
Owner deletion should make the source-content-bearing Public draft derivative unusable — by
invalidating it, by removing it, or by making the review boundary re-check current source availability
before serving the body. CW2-02 §27 requires exactly one of these unless a later explicit rule
preserves it; none does.

**Actual behaviour**
Every *public* surface correctly goes dark (`derive_public_continuing_eligibility_v1` refuses on
availability state, on revision drift and on the missing body digest; all twelve outward consumers
compose that one truth). The *internal controller review* surface does not, and the copied bytes are
undeletable.

**Durable post-state**
A permanent, immutable row in `public_experience_text_derivative_bodies` containing the exact text a
human exercised their deletion right over, readable by a different human through a
`service_role`-reachable boundary, with no path in the repository to remove it.

**Privacy / authority impact**
This is the failure mode owner deletion exists to prevent. The author's erasure right is defeated with
respect to a second human, permanently.

**Concurrency impact:** none — the finding is order-independent.

**Blast radius**
One Public draft per prepared manifest, bounded by the set of Shared materials a controller could
legitimately see at preparation time. Because the derivative is immutable and there is no deleter, the
exposure does not decay.

**Why existing tests/reviews missed it** — *consumer set not enumerated; vacuous static test.*
The disappearance census helper `database/public-runtime-verifier-support.mjs:220-239`
(`assertCompletelyDark`) asserts nine surfaces go dark — visibility, serving, placement, discussion,
responses, vitality, panel, search, lens — and **never calls `review()`**, although `review()` is the
boundary that serves the body. `verify-migration-0093.mjs:656-665` (case P25) *does* perform the
deletion and assert that the READY commit then fails, and then immediately rolls back to a savepoint
without ever re-reading the review boundary.

**Smallest responsible owner:** cross-phase integration (I-05A owns the derivative and the review
boundary; I-04G/I-07D own the deletion primitive whose effect it fails to observe; I-05C owns the
census that exempted it).

**Remediation direction — DO NOT IMPLEMENT.** Smallest semantic correction: make
`resolve_public_experience_review_v1` join the item's provenance and refuse (or null) a body whose
source is no longer `AVAILABLE` at the captured revision — the check `0093:380-389` already performs in
the authority derivation. Whether the retained bytes must additionally be destroyed is a Product
ruling, and destroying them requires a reviewed exception to `0092:531-532`, which currently binds even
the table owner.

**Future regression tests required**
Add `review()` to `assertCompletelyDark`. Extend `verify-migration-0093.mjs` P25 so that after the
deletion, and *before* the rollback, it asserts the review boundary returns no body. Add a
forward-safety plant proving a future reviewed Public reader cannot serve a source-unavailable
derivative.

*Refuter note (recorded, not suppressed): lens 1 and lens 3 held HIGH; lens 2 argued MEDIUM on the
ground that no audience outside the Experience's own controllers is widened. The register keeps HIGH
because CW2-08 §2 classes deleted-content non-serving as non-waivable and the retention is permanent.*

---

## `ASSURE-F02` — A QANDEEL Shared material with no declared dependency is recorded as a RESOLVED EMPTY human requirement, so Introduction material about both humans widens with zero approvals

**Affected phases:** I-04G (origin of the derivation) × I-07D (made reachable in Introduction) ×
I-04F (history widening) × I-05A (Public publication). Cross-phase.
**Affected migrations/functions:** `0090`/`0118 commit_shared_world_qandeel_material_v1`,
`0090 shared_world_material_historical_widening_gate_v1`, `0087` history-package authority,
`0092`/`0105` publication package authority, `0093 prepare_public_experience_manifest_v1`.

**Frozen invariant violated**
- CW2-02 §26 — a publishable/redistributable QANDEEL analysis carries an `AUTHORITY_REQUIREMENT_SET`
  derived from the protected human material **and the SUBJECTS actually implicated**.
- CW2-02 `B4` / CW2-08 `H4` — required UNKNOWN fails closed. This converts "not established" into
  "established empty".
- CW2-02 `B27` / §38 — the required approver set is the union of the authority requirements of the
  included protected portions.
- CW2-01 `A12` (possession ≠ permission) and `A25` (distinct authorities); CW2-04 `D7`.
- And the repository's own doctrine, stated four times and contradicted here — most sharply at
  `0092:407-410`: *"'We cannot compute the requirement' and 'we computed it and there is none' stay
  different facts: the second is `RESOLVED_NO_HUMAN_REQUIREMENT` and is written ONLY when **the source
  state explicitly proves it**."* In this case the source state proves nothing; the absence of a
  caller-supplied array is taken as proof.

**Exact current behaviour**
`0118:500-506` coalesces both dependency arrays to empty and **no floor requires either**.
```
0118:692-695   authority_resolution := CASE
                 WHEN reasoning_edges > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'
                 WHEN approvers      > 0 THEN 'RESOLVED_EXACT_HUMAN_REQUIREMENT'
                 ELSE 'RESOLVED_NO_HUMAN_REQUIREMENT' END;
0118:700-701   authority_mode := CASE WHEN authority_resolution = 'RESOLVED_NO_HUMAN_REQUIREMENT'
                 THEN 'NO_HUMAN_APPROVAL_REQUIRED' ELSE 'EXACT_HUMAN_APPROVER_SET' END;
```
With both counts zero, `0118:812-816` writes one `INDEPENDENT_TARGET_TRUTH` provenance row,
`0118:752` writes the history item as `NO_HUMAN_APPROVAL_REQUIRED`, `0118:761-765` inserts **zero**
required-approver rows and `0118:818-820` records `RESOLVED_NO_HUMAN_REQUIREMENT`.

The migration justifies the UNRESOLVED arm at `0118:686-691` on the ground that *a protected human
subject may be implicated whose authority this repository cannot resolve*. That rationale applies
identically to a material that declares no source at all, yet the `ELSE` arm records the known-empty
requirement the same comment forbids. `0118:987-989` then pins **only** the UNRESOLVED arm as a tip
contract, freezing half the `CASE`.

**Why the Introduction phase is where this bites.** In `ACTIVE / STANDARD` the dependency vocabulary is
adequate: anything derived from a human's material carries a `MATERIAL_DEPENDENCY`, and anything
derived from a Shared Standing Context Grant carries a `REASONING_DEPENDENCY`. The Introduction phase
introduces a **third** content source with no representable edge — the `MATCH_HANDOFF_PACKAGE`, whose
relations (`0113:582`, `0113:644`) can never be a `MATERIAL_DEPENDENCY` because `0089:326-335` and
`0089:348-359` FK-pin a dependency source to a `shared_world_materials` row of the same World — and for
which CW2-06 `F33` / CW2-03 `C8` / CW2-02 `B28` deliberately forbid a Shared grant existing to point
at. The dependency vocabulary is closed at three values (`0089:322`), so `INDEPENDENT_TARGET_TRUTH` is
the only representable encoding, and it is exactly the one that yields zero approvers. CW2-03 §44 is
explicit that this phase exists so QANDEEL can "explain bounded safe compatibility reasons" and
"surface safe differences and agreements" — content that is by construction about both humans.

**The same slice got the sibling case right.** `commit_introduction_progressive_disclosure_v1` writes
exactly one required approver, the owner (`0115:881-882`), and records
`RESOLVED_EXACT_HUMAN_REQUIREMENT` (`0115:902-904`).

**Two widening paths, not one**
1. **Intra-Shared history widening.** `0087:1076-1083` makes a zero-required-approver history package
   lawful precisely when every included item says `NO_HUMAN_APPROVAL_REQUIRED`. The one structural
   defence, `shared_world_material_historical_widening_gate_v1` (`0090:427-442`), tests **only**
   `UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT` and therefore never fires. So after `SUCCESS` the item can
   be granted to a later third Shared member with zero approvals.
2. **Public publication.** `0092:425` permits `required_approver_count = 0`; `0093:1134-1135` and the
   live authority derivation at `0105:913-914` / `0105:932-935` admit the state; the bidirectional
   consistency checks pass because both sides are empty; `0093:1517` and `0095:514-519` then compare
   0 against 0 and publish.

**Compounding:** `0115:1266` refuses owner deletion for any material whose `producer_kind <> 'HUMAN'`,
and there is no source material to delete to trigger the `0090` invalidation cascade. **The counterpart
has no approval authority, no deletion authority and no control surface over the material at all.**

**Preconditions**
An `ACTIVE / INTRODUCTION` World with a live Introduction Record (`0118:629-634`); one
`QANDEEL_OUTPUT` or `QANDEEL_ANALYSIS` committed with both dependency arrays empty or NULL. For the
publication half, a future wrapper exposing the Public draft/prepare/publish primitives and a `CLEARED`
CW2-08 clearance. **The wrong authority metadata is written today**, onto append-only rows protected by
immutability triggers, so it is durable rather than transient — and `verify-migration-0118.mjs` M03
already commits exactly this shape through the real boundary.

**Evidence:** `STRUCTURAL-PROOF` — `EV-F02-01` … `EV-F02-14`.

**Expected behaviour**
Either bind the counterpart as a required approver for Introduction-phase QANDEEL material, or record
the zero-dependency case as `UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT` so the frozen `0087` widening
gate and `0092` package representation refuse it — exactly as the reasoning-bearing case is recorded,
and on the identical rationale.

**Actual behaviour** — it is recorded as a proven-empty requirement and both widening paths accept it.

**Durable post-state**
`shared_world_history_items.authority_requirement_mode = 'NO_HUMAN_APPROVAL_REQUIRED'` and
`shared_world_material_historical_authority.resolution_state = 'RESOLVED_NO_HUMAN_REQUIREMENT'` on
append-only, immutability-triggered rows, plus an entry in both humans' Introduction closed-view
entitlements that no human can delete. The promised additive forward path — a later reviewed
subject-authority resolver moving rows forward (`docs/shared-world-lifecycle-conversation-runtime-v1.md`
§4, `database/README.md` I-05A) — will silently **skip** every row already written as RESOLVED.

**Privacy / authority impact**
Precisely stated: **either Introduction human can unilaterally widen a QANDEEL analysis about both of
them — to a later third Shared member, or to the entire Public World — and the other is never consulted
and cannot object.** (The publisher must still be an Experience controller and must still currently see
the source, so this is not "no human decision"; it is "the wrong human's decision, alone".)

**Concurrency impact:** none.

**Blast radius**
Every QANDEEL-produced Shared material committed without a declared dependency, in any World mode. Most
consequential in `ACTIVE / INTRODUCTION`, where the frozen architecture expects exactly this content.

**Why existing tests/reviews missed it** — *producer census too narrow; task contract omission.*
There is no `verify-migration-0118.mjs` assertion about authority resolution at all; its M03 case
commits exactly this shape (`commitQandeel(f.world, 'a welcome that breaks the ice', …)` with no
sources) and asserts only that it commits. No verifier anywhere exercises Introduction → Public or
Introduction → history-package. Each slice verified its own derivation against its own comment; nothing
asks the cross-phase question "what does an `INDEPENDENT_TARGET_TRUTH` QANDEEL material require before
it may be widened, and is that answer consistent with the reasoning-dependency arm of the same `CASE`?"

**Smallest responsible owner:** cross-phase integration. The derivation originates in I-04G
(`0090:1075-1084`, reproduced verbatim including its comment at `0118:692-701`; the `ELSE` arm and the
`INDEPENDENT_TARGET_TRUTH` fallback ship at `0090:1186-1189`). I-07D made it reachable in the phase
where it matters and pinned only half of it. The correction belongs in the shared derivation.

**Remediation direction — DO NOT IMPLEMENT.** Architecture should specify this before any
implementation: the model currently has no way to express "a protected human is implicated but
contributed no Shared material." Either add that representation, or make the zero-dependency QANDEEL
case fail closed. Forward-only `CREATE OR REPLACE`; do not edit `0090` or `0118`. Any fix must also
decide what happens to rows already written as RESOLVED.

**Future regression tests required**
A real-PG case committing a zero-dependency QANDEEL material and asserting it is refused by both the
`0087` history-package path and the `0093`/`0095` publication path. A forward-safety plant proving the
`ELSE` arm cannot be relaxed. A tip assertion pinning **both** arms of the `CASE`, not one.

*Refuter note: all three lenses rated this "MEDIUM at this baseline, HIGH on the day any Product
producer is authorized". The register keeps HIGH because §29 HIGH is defined by "meaningful
preconditions", the blast radius spans two independent widening paths, the counterpart has no control
surface at all, and the incorrect authority metadata is durable today.*

---

# MEDIUM

## `ASSURE-F01` — Two delivery gates in `0112` decide proposal expiry from a transaction-settled clock fixed before the lock wait

**Affected phases:** I-07B (`0112`), with cross-phase contention from I-07A, I-07C and I-07D sharing
the same per-human `matching_setup_locks` rows.
**Affected functions:** `offer_matching_proposal_to_first_core_v1` (`0112:489`, gate `0112:530`),
`forward_matching_proposal_to_second_core_v1` (`0112:560`, gate `0112:598`).

**Frozen invariant violated**
CW2-06 §31 ("Expiry is terminal"), §55 ("Stale state cannot commit when … proposal expires") and `F43`;
CW2-02 `B34` ("Stale authority state cannot commit") and `B7` (revalidate before delivery).

**Exact current behaviour**
`CURRENT_TIMESTAMP` **is** `transaction_timestamp()` — fixed at transaction start and not advanced by
waiting on a lock. Migration `0112` never captures an instant.
```
0112:502  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
0112:504  PERFORM public.lock_matching_pair_humans_v1(...);          <-- BLOCKING WAIT
0112:530  IF proposal.expires_at <= CURRENT_TIMESTAMP THEN           <-- clock fixed BEFORE :504
0112:542  SELECT * INTO view_result FROM materialize_matching_recipient_view_core_v1(...)  <-- DISCLOSURE
```
`forward_matching_proposal_to_second_core_v1` is identical: lock `0112:575`, gate `0112:598`,
disclosure `0112:612`. `lock_matching_pair_humans_v1` (`0111:365-381`) is
`INSERT … ON CONFLICT (user_id) DO UPDATE` on both humans' rows — a real blocking row-exclusive wait
with no `NOWAIT` and no `lock_timeout`.

**No other gate catches it.** A whole-corpus census shows the proposal deadline is read by exactly four
predicates in `0064`–`0118`: `0112:530`, `0112:598`, `0112:827` and `0114:482`. There is no trigger, no
`CHECK` beyond `0110:694 CHECK (expires_at > prepared_at)`, no FK and no index predicate that reads it.
`resolve_matching_proposal_validity_v1` (`0112:195`) delegates wholly to
`resolve_matching_snapshot_validity_v1` (`0112:121-186`), which checks participation, context grants,
profile and requirement versions, disclosure authorities, the three policy versions and the canonical
active-Introduction truth — and **never `expires_at`**.
`materialize_matching_recipient_view_core_v1` (`0111:922`) has no expiry check at all.

**Same root cause, recorded but not consequential** (corrected in Pass 3 — the candidate claimed five
consequential sites; only two are):
- `0112:827` (`expire_matching_proposal_core_v1`) refuses a terminalization that is genuinely due —
  fails **safe**, transient, self-correcting on retry.
- `0112:441` (cadence window) drifts toward **refusal**: with `T0 ≤ T_commit`, `prepared_at > T0 − window`
  admits a superset, so the count is over-stated and the gate refuses more readily.
- `0112:454` (`deadline := CURRENT_TIMESTAMP + expiry_hours`) **shortens** the proposal's live window by
  the lock-wait duration — less exposure, not more, though the infidelity is made permanent by
  `0110:1068-1077`.

**Preconditions**
Any concurrent transaction holding either human's `matching_setup_locks` row across the proposal's
deadline. The exposure window equals the transaction's own age at the gate.

**Evidence:** `STRUCTURAL-PROOF` — `EV-F01-01` … `EV-F01-10`.

**Expected behaviour** — capture one `clock_timestamp()` after the pair lock and after every
currentness gate, and decide `expires_at <= <that instant>` immediately before the disclosure, exactly
as `I07C-TIME-01` made `commit_matching_mutual_match_v1` do (`0114:471` / `0114:482`).

**Actual behaviour** — an expired proposal is delivered, materializing an immutable
`RECIPIENT_PROPOSAL_VIEW_VERSION` carrying the subject's approved Introduction Profile field values and
their recipient-specific Safe Compatibility Conclusion.

**Durable post-state** — that view and its field rows, plus the recipient's current-view pointer.
CW2-06 §32 / `F25`: already-delivered proposal information is not retroactively erased.

**Concurrency impact** — this is the whole finding.

**Blast radius — bounded, and the bound matters.** `0114:482` checks
`proposal.expires_at <= birth_at` against a post-lock `clock_timestamp()` (`0114:471`), so **no
stale-clock path in `0112` can produce a Mutual Match, a Shared World birth or an Introduction Record.**
The worst durable artifact is one recipient-view disclosure. Note the reachability asymmetry: the
*victim* boundaries are postgres-only, but the *contending* side is already `authenticated`-executable —
the eleven I-07A setup commands take the same per-human lock rows — so once EXECUTE is granted on the
`0112` boundaries, the contention that opens the window needs nothing privileged or unusual.

**Why existing tests/reviews missed it** — *concurrency not pinned; currentness read at the wrong point.*
`database/tests/matching-proposal-privacy-runtime-v1.test.mjs` has fifteen tests and the whole file
contains no occurrence of `CURRENT_TIMESTAMP`, `expires_at`, `EXPIRED` or `clock`. `0112`'s own terminal
self-assertion bans a caller-supplied timestamp **parameter** (`0112:1122-1137`) — a different hazard.
Decisively: **every other migration in the span carries a deploy-time assertion refusing a consequential
core whose body contains the transaction clock** (`0085:1735`, `0088:728`, `0090:1639`, `0093:1848`,
`0095:788`, `0099:841`, `0101:1426`, `0103:1610`, `0105:2492`, `0107:1047`, `0114:930`, `0115:1661`,
`0116:1951`, `0117:607`, `0118:950`). `0112` carries no such ban, and it is the only migration in
`0075`–`0118` where a transaction-settled clock decides a gate.

**Smallest responsible owner:** I-07 (`0112`), as a cross-slice consistency defect: the class was found
and fixed in I-07C and not swept back into the already-frozen I-07B migration.

**Remediation direction — DO NOT IMPLEMENT.** Adopt the I-07C discipline in both delivery cores, mirror
it in `expire_matching_proposal_core_v1`, and add the missing deploy-time transaction-clock ban to the
replacing migration. Forward-only `CREATE OR REPLACE`; `0112` must not be edited. **Fix together with
`ASSURE-F08`** — same slice, same four functions.

**Future regression tests required**
A barrier-pinned two-connection race in the shape of `0114` scenario `C16`, but for delivery: T2 holds
the pair lock with an observable lock wait, the proposal's `expires_at` passes while T1 is provably
blocked (assert T1's `xact_start` precedes `expires_at` via `pg_stat_activity`), release, and require
`MATCHING_PROPOSAL_EXPIRED` with no recipient-view row, no pointer move and no transition — plus the
load-bearing negative that the pre-fix body accepts it.

---

## `ASSURE-F08` — Three of the four human proposal decisions never compare or validate the exact recipient view version on a reused command id

**Affected phases:** I-07B (`0112`), with I-07C having fixed the fourth sibling.
**Affected functions:** `decline_matching_proposal_as_first_core_v1` (`0112:637`),
`decline_matching_proposal_as_second_core_v1` (`0112:720`),
`withdraw_matching_proposal_core_v1` (`0112:758`).

**Frozen invariant violated**
CW2-06 `F21` / §27 — "Acceptance binds to the exact view version the recipient saw"; `F42` —
consequential Matching operations are idempotent; `F43` — stale Matching state cannot silently commit.

**Exact current behaviour**
```
0112:645  auth.uid() check
0112:646  PERFORM enter_matching_proposal_decision_v1(p_proposal_id, u)      -- takes the pair lock
0112:647  IF EXISTS (SELECT 1 FROM matching_proposal_transitions t
0112:648        WHERE t.id = p_command_id AND t.proposal_id = p_proposal_id
0112:649          AND t.resulting_state = 'FIRST_DECLINED' AND t.first_recipient_actor_id = u) THEN
0112:650    RETURN QUERY SELECT p_command_id, 'FIRST_DECLINED', 'CLOSED_BY_YOU'; RETURN;
0112:652  PERFORM assert_matching_recipient_view_current_v1(..., p_expected_view_id, ...)  -- ONLY validator
```
`p_expected_view_id` appears nowhere in the fast path, and `matching_proposal_transitions` carries no
view column, so it is neither compared nor persisted. `enter_matching_proposal_decision_v1`
(`0112:298`) null-checks only the proposal and the actor. A reused command id carrying a **different**
or **NULL** view id is therefore answered as an equivalent retry, and on that path the parameter is
never validated at all. The second-decline and withdraw paths have the identical shape.

The fourth sibling, `approve_matching_proposal_forward_core_v1`, was replaced forward-only at
`0114:174-232` by I-07C (review finding `I07C-AUTH-01`) precisely to bind the exact view — in the same
section of the same migration.

**Preconditions** — a command id already committed as that exact human's transition on that exact
proposal, replayed with a different or null `p_expected_view_id`. No cross-human oracle exists:
`t.first_recipient_actor_id = u` / `t.candidate_actor_id = u` pin the retry to the human who committed
it.

**Evidence:** `STRUCTURAL-PROOF` — `EV-F08-01` … `EV-F08-05`.

**Expected behaviour** — the command identity binds the whole immutable request, so the exact view the
human acted on is compared on the historical path (or persisted so it can be), and a parameter the
first-commit path validates is not skipped by the retry path.

**Actual behaviour** — the caller is told their decline/withdrawal on view V2 succeeded when what
committed was a decline on view V1.

**Durable post-state** — none wrong: the transition already exists and is terminal. The defect is in
the *answer*, and in an input the historical path accepts that the live path refuses.

**Privacy / authority impact** — low. All three acts **end** exposure rather than create it, which is
why this is MEDIUM and `I07C-AUTH-01` (on the acceptance path, which creates an Introduction) was
blocking.

**Blast radius** — three of the four human decision paths of one slice.

**Why existing tests/reviews missed it** — *wrong assertion.*
`verify-migration-0112.mjs:528-555` ("D01 every command answers an equivalent retry from the committed
row") replays only the **approval**, and only with the **same** view
(`rt.approveForward(approval, f.proposal, f.firstView)` twice, `assert.deepEqual`). It never replays a
decline or a withdrawal, and never with a different view.

**Smallest responsible owner:** I-07 (`0112`) — the same cross-slice sweep failure as `ASSURE-F01`.

**Remediation direction — DO NOT IMPLEMENT.** Either bind the exact view in the transition row (as
`0114` did for the approval) and compare it on the fast path, or validate `p_expected_view_id` before
the fast path returns. Forward-only `CREATE OR REPLACE`. **Fix together with `ASSURE-F01`.**

**Future regression tests required** — replay each of the three decisions with a different view id and
with NULL, asserting `MATCHING_COMMAND_ID_CONFLICT` rather than a success echo; and assert that an
invalid view id is refused on the historical path as it is on the first-commit path.

---

## `ASSURE-F06` — An unsalted SHA-256 of a deleted low-entropy Introduction disclosure survives forever in an immutable row

**Affected phases:** I-07D (`0115`), composing with the I-04G digest pattern.
**Affected objects:** `introduction_disclosure_commands.payload_digest` (`0115:409`),
`commit_introduction_progressive_disclosure_v1` (`0115:723-724`, `0115:731`),
`delete_shared_world_owned_material_v1` (`0115:1343-1360`).

**Frozen invariant violated**
CW2-03 §37 permits only a "**minimal non-content** deletion trace"; CW2-01 `A18` and CW2-02 §27 /
`B19` forbid reconstruction of owner-deleted material. CW2-06 §12 / `F12` identifies the data class at
stake (contact route, full identity).

**Exact current behaviour**
```
0115:723-724  digest := 'sha256:' || encode(sha256(convert_to(
                 coalesce(p_field_key, '') || E'\n' || p_text_value, 'UTF8')), 'hex');
0115:731      digest := 'sha256:' || encode(sha256(convert_to(p_media_object_ref, 'UTF8')), 'hex');
```
No salt, no key, no per-command nonce. `0115:275` is
`CHECK ((field_key IS NOT NULL) = (resource_type = 'DEEPER_PERSONAL_FIELD'))`, so for a
`CONTACT_METHOD` the preimage is exactly `'\n' || phone_or_email`. The command row is immutable for
every role including the owner (`0115:568-570`) and owner deletion **deliberately preserves it**
(`0115:1343-1345`) while physically removing the only payload row (`0115:1346-1360`).

**Preconditions** — a committed disclosure of `CONTACT_METHOD`, `FULL_NAME` or a short
`DEEPER_PERSONAL_FIELD`, followed by the owner's deletion, followed by database-level read access (a
dump, a backup, an operator session, or any future internal boundary over that table). No application
role can read it today: RLS on, zero policies, all roles revoked.

**Evidence:** `STRUCTURAL-PROOF` — `EV-F06-01` … `EV-F06-07`.

**Expected behaviour** — after owner deletion, the retained trace must not permit reconstruction of the
deleted value. A phone number is at most ~10^11 candidates, an email is enumerable from a domain list
plus common local parts, and a full name is a dictionary of ~10^6; exhaustive search over any of those
recovers the plaintext from an unsalted digest.

**Actual behaviour** — the value is recoverable indefinitely.

**Durable post-state** — an undeletable row containing a brute-forceable commitment to content a human
exercised their deletion right over.

**Blast radius** — every `CONTACT_METHOD`, `FULL_NAME` and short `DEEPER_PERSONAL_FIELD` disclosure ever
committed. The image half is materially weaker: `media_object_ref` is a high-entropy opaque handle.

**Why this is not merely the established digest pattern.** The sibling digests it resembles —
`shared_world_material_commit_commands.body_digest` (`0090:190`),
`publication_package_item_provenance.captured_source_digest` (`0092:342`),
`replay_source_manifest_items.captured_source_digest` (`0100:334`) — all commit to **free prose**, which
is not brute-forceable. The defect is the **composition**: a primitive frozen for a high-entropy content
class was extended to contact routes and full names without re-deriving its privacy premise.

**Why existing tests/reviews missed it** — *historical assumption became false.*
`verify-migration-0115.mjs` PD14 (lines 536-562) is the deletion test. It asserts the payload is gone,
that the resolver returns only the surviving disclosure "with no placeholder for the other", and that
the resource version, grant fact and material survive. It never considers what the surviving digest
permits.

**Smallest responsible owner:** I-07D (`0115`) for the composition; predecessor dependency for the
pattern.

**Remediation direction — DO NOT IMPLEMENT.** Either salt or key the disclosure digest (a per-command
random salt stored beside it defeats exhaustive search while preserving the retry comparison, since
both idempotency passes recompute from the stored salt), or drop `payload_digest` from the command row
and rely on the already-present `request_ref`. Architecture should first rule on whether a deletion
trace may commit to the deleted value at all.

**Future regression tests required** — a contract asserting the disclosure digest's preimage includes a
per-command salt; and a PD14 extension asserting that the surviving command row contains no value
derivable from the destroyed payload.

---

# LOW

## `ASSURE-F04` — Three Shared-material lock statements carry no `world_id` predicate, so a transaction can hold row locks in a World whose World row it does not hold

**Affected phases:** I-04F (`0087`), I-04G (`0090`, live via `0118`), I-05A (`0093`), against the
deletion primitive (`0090`, live via `0115`). Cross-phase.

**Frozen invariant violated — NONE.**
*This is a Pass-3 correction and it matters.* The candidate cited CW2-03 `C42` and CW2-02 `B34`; both
are **staleness** invariants and neither is violated, because every request that survives to read a
Shared body named the material's true World and therefore did hold the right `shared_worlds` row. What
is violated is the repository's **own stated serialization argument**, at `0093:1019-1025`, which is
false for a foreign row — plus availability of a privacy operation.

**Exact current behaviour**
`0093:1028-1029`, `0118:643-644` and `0087:692-693` lock rows named only by `id = ANY(<caller array>)`,
and test World containment only afterwards (`0093:1058-1064`, `0118:652-659`, `0087:701-703`).
`0093:1026-1027` locks only the Worlds the caller named, so on a mismatched request the transaction
holds a lock on a material of `W2` while holding no row of `W2`.
`delete_shared_world_owned_material_v1` locks out of identity order: `shared_worlds` (`0115:1224`), the
exact material `X` (`0115:1255`), its history item (`0115:1270`), then the transitive closure
**ascending** (`0115:1307`). The decisive supporting fact is `0089:340-341`:
`CHECK (source_established_at IS NULL OR source_established_at < target_established_at)` — precedence is
**temporal, not lexical on the uuid** — so a closure target `Y` may hold a smaller uuid than `X`, making
the deletion's sequence `X, Y` descending while every other site is ascending. *Had that CHECK been on
`id`, this finding would have been refuted outright.*

**The cycle.** `T_del` holds `X` and waits for `Y`; `T_pub` (a `0093` preparation naming World `W1` but
materials `{X, Y}` of `W2`) holds `Y FOR SHARE` and waits for `X`. `FOR SHARE` conflicts with
`FOR UPDATE`, so both wait → `40P01 deadlock detected`, and the victim may be the owner deletion.
If the caller names the matching World, `T_pub` takes `shared_worlds[W2] FOR SHARE`, `T_del` blocks on
its very first lock holding nothing, and the two serialize correctly. **The missing predicate is the
whole cycle.**

**Preconditions** — a World holding `X` and a `MATERIAL_DEPENDENCY` target `Y` with `Y.id < X.id` (a
coin flip); a caller who submits mismatched `(world_ids, material_ids)` arrays — a request that will be
refused, but only after the locks are taken.

**Evidence:** `STRUCTURAL-PROOF` — `EV-F04-01` … `EV-F04-08`.

**Expected / actual** — the locking statement should not be able to lock a row outside the World the
transaction holds; it can.

**Durable post-state — none wrong.** The malformed request is refused and the deadlock victim is rolled
back whole; the deletion is atomic inside the block opened at `0115:1324` and is durably retryable
through its command-id idempotency.

**Blast radius** — availability of a privacy operation, plus a false serialization claim repeated in
three migrations. *Downgraded from MEDIUM to LOW in Pass 3: the consequence is a whole-transaction
abort, not a disclosure and not an incorrect commit.*

**Why existing tests/reviews missed it** — *concurrency not pinned; local verifier only.*
`verify-migration-0090.mjs:857-859` commits a material in another World and asserts only the refusal
class `SHARED_WORLD_MATERIAL_STALE`. An outcome assertion cannot observe a lock taken on the way to the
raise. Each migration's self-assertion checks the **textual order** of its lock statements, never the
**predicate** they lock on.

**Smallest responsible owner:** cross-phase integration; primary site I-05A `0093`, because its
`(world, material)` arrays are the only ones a human's publication request supplies directly.

**Remediation direction — DO NOT IMPLEMENT.** Add the `world_id` predicate to each locking statement
(`AND m.world_id = ANY(p_shared_source_world_ids)` / `AND m.world_id = p_world_id`) and move the
existing foreign-row check ahead of the lock. Forward-only; do not edit `0087`, `0090` or `0093`.

**Future regression tests required** — a barrier-pinned two-connection race: `T_del` blocked on `Y`,
`T_pub` issued with mismatched arrays, asserting `PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE` with **neither
transaction observing `40P01`**, plus the load-bearing negative that the pre-fix statement deadlocks.

---

## `ASSURE-F03` — Replay-side approval effective state ignores a direct canonical Public withdrawal

**Affected phases:** I-06C (`0105`) × I-05B (`0094`).
**Affected functions:** `derive_replay_distribution_approval_effective_state_v1` (`0105:738-757`),
`resolve_replay_distribution_package_v1` (`0105:2098-2131`).

**Frozen invariant violated**
Primarily the repository's own reviewed phase record — `docs/replay-runtime-v1.md` §43 (lines
1034-1043): *"One human consent act, two immutable evidence stores … A withdrawal takes back both
halves the same way."* The declared symmetry holds in exactly one direction. CW2-02 `B9` / §10
("effective grants represent current permission") applies to the read boundary only.

**Exact current behaviour**
`0105:748` / `0105:755` decide `WITHDRAWN` solely from `replay_distribution_approval_withdrawal_events`.
`withdraw_replay_distribution_approval_v1` takes back both halves (`0105:1800-1805`), but the frozen
`withdraw_publication_approval_v1` (`0094:267-364`) writes only Public evidence and contains no
reference to `replay_distribution_approvals`. A human who withdraws their canonical Public approval
**directly** leaves the Replay-side answer reading `EFFECTIVE`.

**Scope corrections applied from Pass 3**
- The affected surface is **`resolve_replay_distribution_package_v1`** (`0105:2098-2131`), whose
  `effective_approval_count` / `withdrawn_approval_count` report *N effective / 0 withdrawn*. It is
  `service_role`-executable (`0105:2234`). The candidate named
  `resolve_replay_distribution_current_state_v1`, which is **wrong** — that boundary returns no approval
  state at all and, for a published package, already answers `DESTINATION_NOT_CURRENTLY_SERVING`.
- Blast radius is **one destination**: `0104:359-363` forces `linked_public_approval_id IS NULL` for
  `SHARE_EXTERNALLY` and `DOWNLOAD`, so those cannot desynchronize at all.
- **No audience ever widens.** `authorize_replay_distribution_v1` passes its own approval gates on the
  stale answer but aborts at `0105:2045` because `publish_public_experience_v1` raises
  `PUBLIC_EXPERIENCE_APPROVAL_NOT_EFFECTIVE` (`0095:518-520`); post-publication, `0098:220-228` makes
  the artifact `NOT_PUBLICLY_VISIBLE`.
- A second residue: `reconcile_replay_post_finalization_state_v1` (`0107:620-621`, `0107:635-639`)
  writes the coarser `PUBLIC_DESTINATION_NOT_SERVING` into append-only, immutable reconciliation
  evidence instead of `APPROVAL_NOT_EFFECTIVE` — the recorded *cause* is the destination rather than the
  consent.

**Preconditions** — a `PUBLISH_TO_PUBLIC_WORLD` package with a bridge row and a committed approval act,
and that same human calling `withdraw_publication_approval_v1` directly. **No producer of the divergent
state exists at this baseline at all** — not merely no application role: the only writer of
`publication_approval_withdrawal_events` is granted to nobody, and its only in-database caller is the
Replay wrapper that writes both halves.

**Evidence:** `STRUCTURAL-PROOF` — `EV-F03-01` … `EV-F03-03`.

**Durable post-state** — one immutable reconciliation row naming the wrong cause. No authority decision
is wrong.

**Blast radius** — a misleading pre-authorization readiness count on one creator-facing boundary.
Note the inversion worth recording: the **writer** side is fully closed while the **reader** side is
already open to `service_role`, so the order in which the two are unblocked decides whether this ever
ships live.

**Why existing tests/reviews missed it** — *consumer set not enumerated.* `verify-migration-0105.mjs`
X39 asserts only the Replay→Public direction; X18 is the test that would have caught it had it withdrawn
the Public half. `verify-migration-0107.mjs` P03/P04 reach `DESTINATION_NOT_CURRENTLY_SERVING` only via
the `0099` disappearance command, never via a direct Public withdrawal.

**Smallest responsible owner:** I-06C (`0105`) — not the Public side; `0094` is correctly ignorant of
Replay.

**Remediation direction — DO NOT IMPLEMENT.** An additive `CREATE OR REPLACE` of
`derive_replay_distribution_approval_effective_state_v1` joining `publication_approval_withdrawal_events`
on `a.linked_public_approval_id`. The fix site is unblocked: that function carries no body pin in
`0105`'s self-assertions.

**Future regression tests required** — construct the divergent state (approve through the Replay act,
withdraw through the Public primitive) and assert the Replay effective state reads `WITHDRAWN` and the
creator census reports it.

---

## `ASSURE-F09` — Public-phase retries answer from live state, contradicting the command-identity contract the same slice states

**Affected phases:** I-05 (`0093`/`0094`/`0095`/`0096`).

**Frozen invariant violated** — no CW2 clause is violated directly; the contradicted authority is the
slice's own stated contract at `0093:194-206`: each command row *"is the idempotency key AND the exact
committed answer: an equivalent retry is served from here rather than by re-reading current state, so a
later preparation, a later approval or a later source change can never make a historical command start
answering differently."* Task §11 asks this question explicitly.

**Exact current behaviour** — `publish_public_experience_v1`'s retry path returns
`(SELECT e.current_lifecycle FROM public.public_experiences e WHERE e.id = committed.experience_id)` at
`0095:390` — live state. `0094:298-299` calls `derive_publication_approval_effective_state_v1` at retry
time; `0096:367-370` reads the current `placement_revision`.

**Contrast** — `docs/matching-introduction-runtime-v1.md` §39: an equivalent retry of an Introduction
terminal command "is answered ENTIRELY from the committed row, never by re-reading live World state, so
a retry after later Standard changes still answers the original terminal result." I-04G, I-06 and I-07
all follow that discipline; I-05 does not.

**Durable post-state** — none wrong. A retry of a publish command for an Experience that has since gone
`ABSENT_FROM_PUBLIC_WORLD` returns `ALREADY_COMMITTED` with `current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD'`.

**Blast radius** — four retry paths in one phase; the answers are truthful about live state but not
about the historical command.

**Why existing tests/reviews missed it** — *wrong assertion.* No verifier compares a retry's answer
against the committed constants after live state has moved.

**Smallest responsible owner:** I-05.

**Remediation direction — DO NOT IMPLEMENT.** Either answer from the committed row, or amend the stated
contract so the two agree. Architecture should decide which, since returning live lifecycle may be the
more useful behaviour — but the contract and the code must not disagree.

**Future regression tests required** — retry each Public command after the relevant live state has
moved and assert the documented semantics, whichever is chosen.

---

## `ASSURE-F07` — The BG-09 closure-synchronization contract cannot govern any Connected Worlds phase document

> **This finding replaces a candidate that adversarial verification REFUTED, and the refutation is
> worth more than the candidate was.** The original candidate asserted that I-04 is treated as
> CLOSED / FROZEN while its banner says `CANDIDATE`, in violation of `BG-09`. That is **wrong, and it
> inverted the very evidence it cited.** `docs/qandeel-canonical-backlog-v1.md:683-686` — the lines the
> candidate quoted — *refuse* to declare I-04 closed: *"`I-04`'s primary document reads
> `CANDIDATE — awaiting independent ChatGPT review`, which is the truth at this point: independent
> review has not happened."* `docs/shared-world-lifecycle-conversation-runtime-v1.md:11-13` says the
> same (*"It is **not** a declaration that I-04 is closed"*). `BG-09`'s antecedent is
> *"treated as CLOSED / FROZEN"*, and its scoping clause (backlog lines 126-129) makes the canonical
> backlog the sole authority for that. The register never treats I-04 as closed. **`BG-09` is satisfied,
> not violated, and I-04 is the repository's cleanest worked example of compliance with it.**
> The real discrepancy is therefore **not in the repository**: it is in the QAN-CW-ASSURE-01 task
> package itself, whose §1 (lines 22 and 65) asserts `I-04 — CLOSED / FROZEN / MERGED`. That is a
> **review-input correction**, reported in §1 of the main report, not a system defect. I-04 is
> genuinely, deliberately still open — awaiting exactly the independent review this task constitutes.

**Affected phases:** governance tooling; affects every Connected Worlds phase document.
**Affected file:** `tests/task-closure-governance-contract.test.mjs`.

**Frozen invariant** — `BG-09` (`docs/qandeel-canonical-backlog-v1.md:116-124`), which the CI contract
exists to enforce mechanically.

**Exact current behaviour**
```
tests/task-closure-governance-contract.test.mjs:84   const TASK_ID = /\bT-\d+[A-Za-z0-9]*\b/u;
                                          :96-99     const id = TASK_ID.exec(ownerTask); … closedTaskIds.add(id[0]);
                                          :115-116   const id = TASK_ID.exec(heading[1]);
                                          :122       const governed = primaryDocuments.filter(d => closedTaskIds.has(d.taskId));
```
The identifier pattern matches only `T-<digits>` task ids. Every Connected Worlds phase document is
identified as `I-04` … `I-07`, so **none of them is ever in `governed`** and the BG-09 banner
synchronization check silently governs nothing for the entire Connected Worlds programme. The gate's
own floor assertions (`:130-131`) pin `T-13` and `T-14` — the two tasks `QAN-GOV-03` repaired — so the
contract is non-vacuous for the T-series and vacuous for the I-series.

**Preconditions** — none; the condition holds at this baseline.

**Evidence:** `STRUCTURAL-PROOF` — `EV-F07-01` … `EV-F07-03`.

**Expected behaviour** — the mechanical gate that exists because banner drift was discovered three times
by hand (`QAN-BL-AUTH-01`, `QAN-BL-T13-01`, and the two stale banners `QAN-GOV-03` fixed) should cover
the phase documents that are now the repository's principal closure records.

**Actual behaviour** — it cannot see them. I-06's and I-07's correct banner synchronizations were
performed by human discipline, not by the gate; the next I-phase closure could drift exactly as T-13
and T-14 did, and nothing would fail.

**Durable post-state** — none. **Privacy / authority impact** — none.

**Blast radius** — governance assurance for four closed phases and every future `I-0N` phase.

**Why existing tests/reviews missed it** — *vacuous static test.* The contract passes, and passes
honestly for the T-series it was written against; nothing signals that its subject class excluded the
documents that mattered most by the time I-04 began.

**Smallest responsible owner:** governance / Architecture (the contract predates the I-series).

**Remediation direction — DO NOT IMPLEMENT.** Widen `TASK_ID` to admit `I-0N` phase ids and add the four
phase documents to the governed set, with floor assertions pinning at least one I-phase id so the gate
cannot silently empty again.

**Backlog disposition (§44):** **VALID FUTURE OBLIGATION** — the only entry in this register that is not
an active runtime defect.

---

# OBSERVATION

**`ASSURE-O01` — Shared World and Public Experience lifecycles are sealed only procedurally.**
`public.shared_worlds` and `public.public_experiences` carry **no trigger at all** (a scan of
`CREATE TRIGGER` across `0075`–`0118` returns 110 triggers, none on either). `0075:67-69`'s closure
consistency CHECK constrains the resulting row, not the transition, so `READ_ONLY_CLOSED → ACTIVE` and
`STANDARD → INTRODUCTION` are representable at the table level. Contrast `public.replays`, which has a
`BEFORE UPDATE` trigger binding even the table owner. Containment today rests on the producer set
(three guarded writers each) plus the zero-privilege posture, and the path is not reachable. `0091:1395`
documents the deliberate reasoning for Public ("a guard a later authorized slice would have to remove is
a ceiling on the roadmap"); no equivalent statement exists for `shared_worlds`. Recorded so a future
fourth writer is reviewed with this in mind.

**`ASSURE-O02` — RLS is ENABLED but never FORCED anywhere in the span.**
All tables are `postgres`-owned with RLS on and zero policies, and every write path is a
`postgres`-owned `SECURITY DEFINER` function running as the owner — so RLS binds no reachable role. The
self-assertions read `pg_class.relrowsecurity` and never `relforcerowsecurity`. The actual containment
is the REVOKE posture, which is sound and complete. This is a consistent, deliberate posture across all
four phases; it is recorded only so that no future reader mistakes the RLS state for the security
property.

**`ASSURE-O03` — "a future wrapper can never substitute another principal" is stronger than the
mechanism supports.** `auth.uid()` reads the `request.jwt.claims` GUC. A future `postgres`-owned
`SECURITY DEFINER` function granted to `service_role` could `set_config('request.jwt.claims', …, true)`
and then call a consent primitive. No such function exists in `0075`–`0118`, and adding one would be a
reviewed act — so the current posture is sound and NEG-10 stands. But the claim as written (e.g.
`0084:66-69`, `0084:1168`) asserts structural impossibility where the guarantee is actually "no such
wrapper has been written". Worth stating accurately in the canonical records.

**`ASSURE-O04` — `ON DELETE RESTRICT` chains make any Connected Worlds participant permanently
un-hard-deletable.** I-04, I-05, I-06 and I-07 each add RESTRICT foreign keys into `public.users`, and
several child relations are append-only for every role including the owner. Composed, a human who has
ever joined a Shared World, held a Public Identity, been a required approver, or been matched can never
be hard-deleted by any path in any phase. **This is NOT reported as a defect (§28):** account deletion
and erasure are explicit anti-scope for every phase (the I-05 closure record names "general account
deletion or erasure"), and deletion in this architecture is availability-state based by design. It is
recorded because it is a genuine cross-phase consequence that no single phase's record states, and a
future erasure capability must be designed against it.

**`ASSURE-O05` — the durable idempotency fast path precedes authorization in every command family.**
`0099:414/417` raises `..._COMMAND_ID_CONFLICT` before the authorization check at `0099:436-438`;
`0107:545` does the same before `0107:558-561`; the pattern is uniform. An existing command id is
therefore distinguishable from a nonexistent one for any caller. The ordering is deliberate — a retry
must stay answerable after authority moves — and the only fact disclosed is "this uuid has been used as
a command id". Command ids are caller-chosen uuids, so nothing is enumerable and no human, object or
state is named. Recorded under §21 for completeness, not as a defect.

**`ASSURE-O06` — a pre-existing Replay assertion may have gone vacuous.**
`verify-migration-0101.mjs:290` asserts that an Introduction World is refused through the same bounded
class. That refusal previously came from the `0087` entry point raising `0A000` for a non-STANDARD
World; since `0115` the entry point supports `INTRODUCTION`. The assertion may now pass through the
empty-visibility path instead, testing nothing. See `LEAD-2`.

**`ASSURE-O07` — the persisted `counterpart_user_id` is never enforced at the disclosure read boundary.**
`introduction_disclosure_resource_versions.counterpart_user_id` is written at `0115:907-910`, but
`resolve_shared_world_introduction_disclosure_v1` (`0115:1455-1485`) applies no owner/counterpart
predicate — it delegates wholly to the generic visibility entry point. During `ACTIVE / INTRODUCTION`
that is harmless (the audience *is* the two humans). After `SUCCESS` the World becomes `STANDARD` and the
entry point gains the history-grant disjunct. The widening remains **consented**, because the
disclosure's sole required approver is the owner (`0115:881-882`), so it is not reported as a defect —
but CW2-06 §45 / `F35` bind the resource to an *exact counterpart*, and that binding is enforced only
incidentally by the World phase. See `LEAD-1`.

**`ASSURE-O08` — the Replay boundary leaks a Public error class.**
`PUBLIC_EXPERIENCE_APPROVAL_NOT_EFFECTIVE` (SQLSTATE 55000) escapes from `0095:520` through
`authorize_replay_distribution_v1` at `0105:2045` untrapped, breaking the Replay boundary's own bounded-
class discipline, which `0107:396-409` declares deliberate ("the creator learns that the authority is no
longer current without learning which human withdrew").

**`ASSURE-O09` — one prose clause asserts I-04 closed, and immediately concedes it has not.**
`database/README.md:1999` reads "*and I-04 closed on exactly that basis*", then two clauses later
"*The formal register act belongs to Architecture under BG-08 and BG-09*". It is the only sentence in
the tree that asserts I-04 closure, it is in a non-register document, and it self-corrects. Recorded for
completeness alongside the `ASSURE-F07` refutation; it is **not** a `BG-09` violation, because the
register — which `BG-09` designates the sole authority — makes no closure claim for I-04.
