# QANDEEL — Stage 6.6 Final Architecture Review Ruling v1
## Integrated Implementation-Readiness Proof — Targeted Final Revision

**Architecture Verdict:** TARGETED REVISION REQUIRED  
**Base Candidate:** `QANDEEL_STAGE6_6_IMPLEMENTATION_READINESS_CANDIDATE_v1`  
**Next Candidate:** `QANDEEL_STAGE6_6_IMPLEMENTATION_READINESS_CANDIDATE_v2`  
**Stage 6:** NOT FROZEN YET  
**Coding:** NOT AUTHORIZED YET  
**Canonical repository baseline:** `f322112ec5b862a83716bf9d65b4553b06931774`

Do NOT redo Stage 6.6 from scratch.

Preserve all unaffected proof results, authority evidence, client-stack evidence, task readiness work, traceability, accessibility proof, OPEN-17 proof, recovery proof and dependency proof.

Do NOT repeat broad research.

Do NOT modify the repository.

Do NOT code, branch, commit, migrate or open a PR.

---

# 1. Architecture Review Result

The Stage 6.6 v1 package is strong and closes nearly all readiness questions.

Architecture independently accepts the following as directionally correct:

- FG66-01 authority bundle;
- zero Product-semantic TODO result;
- corrected implementation dependency graph;
- committed-CU / Moment transaction model;
- explicit commitment/batch idempotency identity;
- state/action authority;
- 10k/100k presentation-position reach direction;
- Map accessibility parity from `V`;
- OPEN-17 seam;
- R-02 recovery;
- client-stack feasibility;
- deferred-feature absence;
- all Thread / LF / Home / no-merge / no-coarse-step constraints.

However, the final historical-coverage proof contains two load-bearing temporal-domain errors and two coverage-scope gaps.

These must be corrected before Stage 6 can freeze.

No Product Architecture needs reopening.

The required corrections are deterministic consequences of already-frozen Stage 5 temporal semantics.

---

# 2. REV66-01 — `created_at` IS NOT `KF`
## Freeze Session-Position Availability Anchoring

Stage 5 freezes:

```text
SP(x)
= the current-session Session Position at which content or analysis becomes committed

KF(x)
= the earliest Session Position at which QANDEEL legitimately knows / may expose x
```

and separately:

```text
RTO != SP
KF != VF/VT
```

A wall-clock timestamp is therefore not itself a `KF`.

The v1 matrix currently contains rows equivalent to:

```text
KF = created_at
```

or:

```text
created_at → ordinalised
```

and, for Reading creation, wording equivalent to:

```text
created_at
(ordinal-anchored by the creating CU)
```

That is insufficient and can backdate asynchronous analysis to its causal/source CU.

The committed repository already has post-response analytical work that may become canonical after the source turn has completed.

Therefore the implementation contract must freeze one explicit mapping.

---

# 3. Canonical implementation mapping
## `SessionAvailabilityAnchor`

Define an implementation-level function equivalent to:

```text
SessionAvailabilityAnchor(session, canonicalCommitTime)
```

Result:

```text
PRE_SESSION
or
SP(n)
```

where:

## PRE_SESSION

The fact/object/version was already legitimately known before the first addressable committed CU of the current Session.

`PRE_SESSION` is an internal projection sentinel only.

It is NOT:

- a Timeline Moment;
- a new temporal mode;
- a new Stage 5 state member;
- a user-addressable temporal target.

Semantically it means:

```text
KF <= session start
```

## SP(n)

For a fact becoming canonical during the current Session:

```text
SP(n)
=
the greatest committed CU Session Position
whose committed wall-clock time
is <= the actual canonical commit time of that fact
```

If the fact becomes canonical while `LH = n`, this normally resolves to:

```text
SP(n)
```

The key rule:

# **ANCHOR TO ACTUAL CANONICAL AVAILABILITY, NEVER TO CAUSAL SOURCE**

A Reading generated from CU `m10` but not committed until after `m12` exists must not receive:

```text
KF = m10
```

It receives the Session Availability Anchor corresponding to its actual canonical commit time.

---

# 4. Wall-clock audit time vs Product time

Fields such as:

```text
created_at
updated_at
completed_at
expires_at
```

may be used as immutable audit inputs to derive a Session Position anchor.

They are NOT Timeline addresses.

They must never be:

- directly compared to `TC`;
- exposed as `SP`;
- used to move `TC`;
- used as a substitute for `KF/VF/VT`.

Canonical direction:

```text
wall-clock commit time
    ↓
SessionAvailabilityAnchor(...)
    ↓
KF / validity boundary in current-session position space
```

---

# 5. Availability anchoring applies independently per component

The v2 historical matrix must apply the rule separately to every v1 component that can become known/change during a Session, including as applicable:

- object identity;
- object/version creation;
- version/state transition;
- Thread establishment;
- contextual appearance;
- Relation/association;
- Evidence participation;
- Confidence evaluation/version;
- Unknown/Gap lifecycle;
- Question/binding;
- Memory/Material participation;
- provenance-bearing lineage events.

Do not derive a child/component `KF` from its parent merely because the parent already existed.

Examples:

```text
Reading identity known at m12
Evidence participation added at m15
```

means:

```text
KF(Reading) = m12
KF(EvidenceParticipation) = m15
```

---

# 6. Same-SP analytical ordering

Several analytical commits may map to the same `SP`.

This does NOT create a new Timeline coordinate.

For deterministic replay, the implementation must preserve a stable internal ordering for events sharing one SP, using an implementation mechanism such as:

- append sequence;
- transaction-local sequence;
- stable event identity + canonical ordering;
- another deterministic equivalent.

This ordering:

- is internal;
- is not user-addressable;
- is not a third temporal dimension in the Product;
- does not create additional Timeline Moments.

At historical `TC = SP(n)`, projection uses the then-final valid result of all canonical events legitimately anchored at/before that Session Position under their internal event order.

---

# 7. Matrix correction required

Revisit every historical-coverage row whose `KF` or validity derivation currently says only:

```text
created_at
transition created_at
creation time
turn-anchored created_at
```

At minimum this includes the current candidate's:

- R1–R4;
- R5;
- R8;
- M1;
- M2 where a transition is built;
- M4 successor lineage;
- U1;
- U2;
- Q1;
- A1;
- F1;

and any equivalent component omitted from that list.

The row may remain `FULL BY REUSE` if immutable canonical timestamps + complete committed-CU timing genuinely suffice to derive the correct anchor.

It must become `FULL AFTER BUILD` if an independent historical event/transition timestamp or anchor must be added.

No row may claim `KF = created_at`.

---

# 8. Required proof — P66-A
## Asynchronous analytical availability

Fixture:

```text
m10 committed
→ post-response Reading work begins

m11 committed
m12 committed

Reading R becomes canonical only after m12
```

Expected:

```text
K(m10) does NOT contain R
K(m11) does NOT contain R
K(m12) contains R only once R actually becomes canonical at the availability boundary
```

The causal/source CU must not backdate the Reading.

Repeat the same principle for:

- Relation creation;
- Evidence participation;
- Confidence evaluation.

PASS only if every child/component uses its own availability anchor.

---

# 9. REV66-02 — MEMORY EXPIRY CANNOT COMPARE `expires_at` TO `TC`

The current M3 row states an equivalent of:

```text
expires_at > TC
```

This is invalid.

`expires_at` is an absolute wall-clock timestamp.

`TC` is a current-session Session Position.

They belong to different domains.

Stage 5's separation of temporal facts prohibits comparing them directly.

---

# 10. Memory expiry historical mapping

Freeze the following implementation semantic:

For a Memory with immutable:

```text
expires_at
```

derive an expiry validity boundary in Session Position space.

Define an equivalent of:

```text
ExpirySessionAnchor(session, expires_at)
```

using the committed CU wall-clock timeline.

## Case A — expiry before first addressable CU

```text
ExpiryAnchor = PRE_SESSION
```

The Memory is already expired for every addressable current-session historical position.

## Case B — expiry occurs during Session

Map the expiry instant to the Session Position interval active at that instant:

```text
ExpiryAnchor
=
greatest committed SP
whose committed time <= expires_at
```

subject to the Session's supported coverage boundary.

The Memory's expiry validity is then evaluated in Session Position space.

## Case C — expiry occurs after Session end

No expiry transition belongs to that Session's historical projection.

---

# 11. Equivalent implementation forms

T-03C may implement the same frozen result by either:

### Derived boundary
derive `ExpirySessionAnchor` from immutable `expires_at` + complete committed-CU wall-clock history;

or:

### Materialized history
record an append-only expiry transition carrying the equivalent Session Position anchor.

Both are semantically equivalent only if they return the same historical result.

No new Product decision is delegated to coding.

---

# 12. Memory-expiry guardrails

`expires_at`:

- remains wall-clock metadata;
- is not `RTO`;
- is not `SP`;
- is not a Timeline target;
- never moves `TC`.

Memory identity / lineage knowledge remains separate from active/expired eligibility.

Expiry does not erase historical knowledge.

---

# 13. Required proof — P66-B
## Expiry between Moments

Fixture:

```text
m20 committed at 10:00
memory expires at 10:03
m21 committed at 10:08
```

Prove:

- no timestamp is directly compared with `TC`;
- the expiry receives the correct Session Position validity boundary;
- historical projection before/after that boundary is deterministic;
- Memory identity/lineage is not erased;
- Live current eligibility and later historical replay agree under the frozen Session-position model.

Also test:

- expiry before first CU;
- expiry after Session end.

---

# 14. REV66-03 — SUPPORTED SESSION COVERAGE MUST BE COMPLETE FROM SESSION START

The current FG66-05 proof says that Sessions before the CU substrate have no addressable `TC`.

That is necessary but not sufficient.

A Session may already exist before deployment and remain active after the CU substrate is enabled.

Without an explicit rule it could receive:

```text
new post-deploy SPs
```

while older current-session conversation has no committed-CU/SP history.

That would create a partially covered Session.

---

# 15. Final supported-session release rule

For v1 historical projection:

# **NO PARTIALLY COVERED SESSION MAY BE HISTORICAL-ENABLED**

A Session is eligible only if one of these is true:

## Path A — New fully covered Session

The Session begins after:

- required history capture;
- CU commitment substrate;
- availability-anchor contract;
- immutable-source guards

are active.

## Path B — Complete deterministic backfill

The Session's entire relevant conversational and analytical history is backfilled/reconstructed before:

- its first post-deploy `SP` is accepted as historical-enabled;
- or historical projection is exposed.

If complete backfill cannot be proven:

> the pre-existing Session remains historical-disabled for its entire lifecycle.

Do not create a partial Timeline beginning in the middle of a Session.

---

# 16. Technical coverage state is not Product state

Implementation may keep an internal gate equivalent to:

```text
historical_coverage_complete
```

or another deterministic technical eligibility predicate.

It is:

- release/runtime safety metadata;
- not a user-facing epistemic state;
- not KF;
- not a "knowledge horizon";
- not a new Stage 5 temporal mode.

---

# 17. Required proof — P66-C
## Session spanning deployment

Fixture:

```text
Session S starts before deployment.
Three source turns already exist.
Coverage migrations/CU substrate deploy.
User continues S and commits two new CUs.
```

PASS only if either:

1. all earlier required CUs/analytical history are deterministically backfilled before S becomes historical-enabled; or
2. S remains historical-disabled through closure.

Forbidden result:

```text
Timeline starts halfway through S
```

---

# 18. REV66-04 — CONTEXTUAL APPEARANCE COVERAGE MUST BE TYPE-SPECIFIC

The current historical matrix labels:

```text
formal_question_turn_bindings
```

as a generic:

```text
Contextual appearance
```

That table proves one contextual-appearance family only.

Stage 5 freezes contextual appearances as independently knowledge/validity gated.

Therefore one table cannot silently stand for every appearance type.

---

# 19. v1 contextual-appearance registry

The Stage 6.6 v2 matrix must explicitly classify each contextual appearance family that v1 `V` exposes.

At minimum distinguish:

## Thread ↔ Reading contextual appearance
Source:

```text
thread_reading_bindings
```

with its own:
- bind availability;
- validity/unbind boundary.

## Formal Question ↔ Turn contextual appearance
Source:

```text
formal_question_turn_bindings
```

with its own:
- creation/bind availability;
- terminal validity state.

Any other contextual appearance family must be:

- separately listed with its own `KF/VF/VT` contract; or
- explicitly `NOT EXPOSED IN v1 V`.

No generic fallback appearance exists.

---

# 20. Required proof — P66-D
## Parent-known / appearance-unknown

Fixture:

- canonical Reading identity exists at `m10`;
- Thread exists at `m8`;
- their contextual binding becomes canonical at `m14`.

Expected:

```text
K(m12):
Reading may exist
Thread may exist
Thread↔Reading contextual appearance ABSENT

K(m14):
appearance becomes available
```

Parent availability must not substitute child entitlement.

---

# 21. REV66-05 — IMMUTABILITY PROOF MUST COVER DELETE / REPLACEMENT, NOT UPDATE ONLY

The exhaustive `UPDATE` enumeration is useful and accepted.

But historical immutability requires more than:

```text
no UPDATE exists
```

Stage 6.6 final proof must also ensure canonical rows used by historical `V` cannot be physically:

- deleted;
- replaced;
- delete/reinserted

through a currently authorized application path.

The existing Memory hardening direction already uses status transitions / successor rows rather than physical deletion.

Preserve that principle.

---

# 22. Strengthened R-C2

Replace the current R-C2 wording with:

# **R-C2 — STATIC/HISTORICAL ROW PRESERVATION GUARD**

Before the CU substrate/history projection becomes relied upon:

- source `conversation_turns.content` gets immutability enforcement;
- static historical fields used as `FULL BY REUSE` get immutable-column guards where needed;
- direct physical DELETE is denied for historical canonical rows unless a separately governed Product erasure policy explicitly owns it;
- replacement/reinsert paths cannot silently rewrite identity/history;
- DML ACLs + definer functions + triggers/verifiers are tested together.

Legal/account erasure remains outside Stage 6 and must never be invented by implementation as an ordinary history mutation.

---

# 23. Release conditions — revised canonical set

Stage 6.6 v2 must carry this release-gate set:

## R-C1 — Complete session history coverage
Strengthened by REV66-03:
historical-enabled Session coverage starts at Session start or is fully backfilled.

## R-C2 — Static/historical row preservation
Strengthened by REV66-05.

## R-C3 — Evidence-path defanging
Retain v1:
0005 / 0021 / 0028 unaudited evidence-attach paths are defanged before their history is relied upon.

## R-C4 — Session-position availability anchoring
Every v1 identity/version/state/relation/participation/appearance exposed in historical `V` has a valid `PRE_SESSION | SP(n)` availability/validity mapping based on actual canonical commit, never causal-source backdating.

## R-C5 — Wall-clock validity domain separation
No wall-clock field such as `expires_at` is directly compared with `TC/SP`; required wall-clock validity is mapped to Session Position space by an explicit deterministic contract.

These are implementation merge/release gates.

They are not open Product questions.

---

# 24. Affected gates to re-run

Do NOT rerun all 15 gates.

Re-run only:

- FG66-04 — Historical field coverage matrix
- FG66-05 — Supported-session history coverage
- FG66-06 — CU/Moment proof only where availability-anchor order interacts with analytical commits
- FG66-12 — Backend/API/migration closure matrix
- FG66-14 — traceability rows affected by new proofs
- Z66-04 — Reading historical availability/version
- Z66-05 — technical history coverage

Add:

- P66-A — asynchronous analytical availability
- P66-B — Memory expiry wall-clock → Session Position mapping
- P66-C — Session spanning deployment
- P66-D — contextual appearance independent availability

Re-evaluate the Architecture contradiction/ambiguity audit after these corrections.

All unaffected PASS results may be carried forward.

---

# 25. Historical matrix requirements for v2

The v2 matrix must:

1. remove every direct `created_at = KF` reading;
2. identify the canonical commit timestamp / event used by `SessionAvailabilityAnchor`;
3. distinguish PRE_SESSION from current-session SP anchoring;
4. identify validity anchors separately from knowledge anchors;
5. fix M3;
6. split contextual-appearance families;
7. state whether each row is:
   - FULL BY REUSE
   - FULL AFTER BUILD
   - NOT EXPOSED IN v1 V
   - BLOCKER
8. keep technical coverage failure out of Product truth.

Zero blockers remains acceptable only after the corrected matrix proves it.

---

# 26. No baseline drift

Architecture independently rechecked public `main` before this ruling.

It still resolves to:

```text
f322112ec5b862a83716bf9d65b4553b06931774
```

Therefore this targeted revision does NOT require a repository re-baseline.

The existing dirty local checkout remains NON-CANONICAL and must remain untouched during Stage 6.6.

---

# 27. Required v2 package

Return:

# `QANDEEL_STAGE6_6_IMPLEMENTATION_READINESS_CANDIDATE_v2`

Do NOT rebuild unaffected sections.

Update only:

1. authorization/correction consumption;
2. gate summary;
3. historical field coverage matrix;
4. supported-session coverage proof;
5. CU/analysis availability interaction as affected;
6. backend/API/migration closure matrix;
7. traceability;
8. affected risk register;
9. MUST / MUST NOT;
10. release conditions;
11. Stage 6 freeze recommendation;
12. implementation authorization recommendation;
13. contradiction audit;
14. ambiguity audit;
15. affected diagram content if necessary;
16. START_HERE / SHA256SUMS;
17. P66-A…P66-D and affected Z tests.

Preserve the verified Authority Bundle.

No new UX board is required.

---

# 28. Stop Rules

STOP rather than inventing Product semantics if the corrected proof requires:

- a new user-addressable temporal coordinate below Moment/SP;
- causal-source backdating of analytical availability;
- direct wall-clock comparison to TC;
- partial-session historical Timeline;
- generic contextual-appearance fallback;
- treating technical coverage as epistemic absence;
- suppressing a required v1 historical field merely because its history is hard;
- reopening Stage 5 temporal semantics;
- reviving OPEN-06/08/09/19.

---

# 29. Current status

```text
Stages 0–5                           CLOSED / FROZEN
Stage 6.1                           CLOSED / FROZEN
Stage 6.2                           CLOSED / FROZEN
Stage 6.3                           CLOSED / FROZEN
Stage 6.4                           CLOSED / FROZEN
Stage 6.5                           CLOSED / FROZEN
Stage 6.6 v1                        REVIEWED
Stage 6.6                           TARGETED FINAL REVISION
Stage 6                             NOT FROZEN YET
Implementation                     NOT AUTHORIZED
```

No coding is authorized.
