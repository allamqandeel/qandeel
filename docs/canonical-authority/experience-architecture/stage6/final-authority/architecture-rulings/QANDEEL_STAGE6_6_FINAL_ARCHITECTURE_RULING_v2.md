# QANDEEL — Stage 6.6 Final Architecture Ruling v2
## Session Semantic Clock + SP-Native Availability + Same-SP Validity Closure

**Architecture Verdict:** TARGETED FINAL REVISION REQUIRED  
**Base Candidate:** `QANDEEL_STAGE6_6_IMPLEMENTATION_READINESS_CANDIDATE_v2`  
**Next Candidate:** `QANDEEL_STAGE6_6_IMPLEMENTATION_READINESS_CANDIDATE_v3`  
**Canonical repository baseline:** `f322112ec5b862a83716bf9d65b4553b06931774`  
**Stage 6:** NOT FROZEN YET  
**Coding:** NOT AUTHORIZED

This is NOT a restart.

Do NOT repeat:
- FG66-01…03;
- client-stack research;
- accessibility proof;
- Timeline reach proof;
- OPEN-17 proof;
- R-02 proof;
- Thread/LF/Home proofs;
- deferred-feature audit;
- unaffected Z66 tests.

Preserve all unaffected PASS evidence.

The remaining correction is entirely in the temporal implementation mapping between:
- PostgreSQL commit/write ordering;
- current-session `SP`;
- analytical availability;
- same-`SP` event ordering;
- wall-clock expiry.

---

# 1. Why v2 cannot freeze as written

Candidate v2 correctly rejects:

```text
created_at = KF
```

but still treats immutable server-derived `CURRENT_TIMESTAMP` as a trustworthy proxy for the object's **actual canonical commit time** and then converts that timestamp to `SP`.

That proof is insufficient.

In PostgreSQL:

```text
CURRENT_TIMESTAMP
=
transaction start time
```

not:
- statement execution time;
- row visibility time;
- transaction commit time.

Therefore a transaction may obtain an earlier `CURRENT_TIMESTAMP`, wait, and make a canonical analytical row visible only after another transaction has already advanced the current Session Position.

A timestamp-based post-hoc mapping can therefore anchor an analytical object to an earlier `SP` than the position at which it actually became canonical.

That is exactly the hindsight/backdating failure REV66-01 exists to prevent.

The v2 evidence that timestamps are:
- server-derived;
- immutable;
- non-caller-supplied

is still useful.

It proves they are trustworthy **audit facts**.

It does NOT prove they are the authoritative current-session availability coordinate.

---

# 2. REV66-06 — Freeze an SP-native Session Semantic Clock

For a historical-enabled current Session, canonical temporal availability MUST be assigned directly in Session-Position space.

Define an implementation boundary equivalent to:

# **SESSION SEMANTIC CLOCK**

It owns, per historical-enabled Session:

```text
current_sp
same_sp_event_sequence
```

and one shared serialization authority used by:

- CU/SP commitment;
- Emerging/Thread/LF events;
- all canonical analytical availability/validity events that may affect historical `K(TC)`.

The physical implementation may be:
- a locked session-clock row;
- a transaction advisory lock plus durable counters;
- another equivalent database-owned mechanism.

The semantic contract is fixed.

---

# 3. Shared serialization rule

Every current-session canonical semantic write that can change historical `K(TC)` MUST enter the same per-session serialization boundary.

Inside that transaction:

```text
1. acquire Session Semantic Clock authority
2. determine the authoritative current SP
3. assign the event/object/component its SP-native availability/validity anchor
4. assign deterministic same-SP event sequence where required
5. write the canonical fact/event
6. commit
```

CU commitment uses the same authority.

A CU commit that advances:

```text
SP(n) → SP(n+1)
```

and an analytical commit cannot overtake each other ambiguously.

Whichever obtains the serialization authority first determines the legitimate ordering.

---

# 4. The concurrency invariant

Consider:

```text
analytical transaction A begins
CU transaction B begins
```

It is irrelevant which transaction began first.

The authoritative order is the Session Semantic Clock order.

## If A serializes/commits first

```text
A anchors to current SP(n)
then
B advances to SP(n+1)
```

The analytical fact is legitimately available at `SP(n)`.

## If B serializes/commits first

```text
B advances to SP(n+1)
then
A anchors to SP(n+1)
```

The analytical fact is NOT available at `SP(n)`.

No transaction-start timestamp may override this order.

---

# 5. Current-session availability is stored/recorded directly

For facts created while a Session is historical-enabled, use an explicit SP-native availability fact equivalent to:

```text
available_at_sp
```

or:

```text
session_semantic_events(
  session_id,
  object/component identity,
  event kind,
  at_sp,
  event_sequence
)
```

Exact schema shape remains Engineering Architecture.

The semantic requirement does not.

For current-session creation/transition:

# **`KF` / `VF` / `VT` must come from the SP-native semantic event, not from `created_at`.**

---

# 6. Legacy analytical families

The existing legacy tables may continue to provide:

- canonical content;
- identity;
- immutable fields;
- lineage;
- audit timestamps.

But when a legacy-family object/component becomes canonical **during a historical-enabled Session**, its writer path must additionally record the SP-native availability/validity event through the Session Semantic Clock.

This applies at minimum to:

- Reading creation;
- Reading lifecycle transitions;
- Evidence participation;
- peer/competing relations;
- Memory creation/supersession/status transitions;
- Information Gap creation/lifecycle;
- Question selection/binding lifecycle where exposed;
- Confidence evaluation;
- any other current-session component exposed by historical `V`.

Thus several v2 rows currently labelled `FULL BY REUSE` for availability become:

```text
FIELD VALUE: REUSE
TEMPORAL AVAILABILITY: BUILD
OVERALL HISTORICAL ROW VERDICT: FULL AFTER BUILD
```

where an SP-native availability event does not already exist.

Do not preserve the v2 FBR count for cosmetic consistency.

---

# 7. `created_at` / wall-clock fields after this correction

Wall-clock fields remain valid for:

- audit;
- diagnostics;
- provider/runtime latency;
- expiration policy;
- forensic ordering outside the Product Timeline where explicitly appropriate;
- deterministic backfill when separately proven.

They MUST NOT be the authoritative current-session `KF/VF/VT` source.

They MUST NOT be used to repair an ordering race after canonical writes have committed.

---

# 8. REV66-07 — Replace the misleading `PRE_SESSION` semantic

The candidate's sentinel:

```text
PRE_SESSION
```

currently means:

> available before the first addressable SP

but also describes this as:

> semantically known before Session start.

Those are not equivalent.

A fact may become canonical:

```text
after Session creation
but before the first committed CU / SP
```

There is no user-addressable temporal point in between.

Therefore freeze the semantic sentinel as:

# **`PRE_FIRST_SP`**

Meaning:

> the fact is legitimately available at every addressable SP of this Session because it was already canonical before the first addressable committed CU.

`PRE_FIRST_SP` does NOT assert that the fact existed before wall-clock Session creation.

It is:

- internal;
- non-addressable;
- not a Moment;
- not a temporal mode;
- not a member of `S`;
- not exposed in `V` or accessibility.

An implementation may retain another internal token name only if its semantics exactly match `PRE_FIRST_SP`.

Do not use "pre-session knowledge" as a synonym unless it is independently true.

---

# 9. Session-start baseline

For a new historical-enabled Session, establish an atomic baseline equivalent to:

```text
SessionHistoricalBaseline
```

before the first committed CU receives `SP(1)`.

The baseline defines which already-canonical world facts are:

```text
PRE_FIRST_SP
```

for this Session.

The exact implementation may be:

- a baseline revision/token;
- an event-log high-water mark;
- a deterministic snapshot reference;
- another equivalent server-owned mechanism.

It MUST NOT depend solely on comparing mutable/current rows to transaction-start timestamps.

The baseline is technical projection authority, not a new Product state.

---

# 10. SP sealing

A current live `SP(n)` is the active Session Position until the next CU commit.

While `SP(n)` is current, canonical analytical/validity events may legitimately be anchored to it through the Session Semantic Clock.

When the next committed CU advances:

```text
LH: SP(n) → SP(n+1)
```

then:

# **SP(n) IS SEALED**

After sealing:

- no newly committed analytical event may later be anchored to `SP(n)`;
- no causal-source reference may reopen it;
- late background work anchors to the then-current SP;
- historical `K(SP(n))` becomes stable.

This is an implementation invariant, not a new user-visible state.

---

# 11. Same-SP ordering — retained and strengthened

Candidate v2's internal same-SP ordering direction remains approved.

Within one open SP:

```text
event_sequence = deterministic, server-owned, non-addressable
```

It orders canonical analytical/validity events sharing that SP.

It creates:

- no Moment;
- no Timeline target;
- no third Product temporal dimension.

Historical projection for a SEALED `SP(n)` uses the final valid semantic state after all events legitimately committed within that SP before sealing.

---

# 12. REV66-08 — Memory expiry must obey the same same-SP rule

Candidate v2 currently says:

```text
m20 @ 10:00
expiry @ 10:03
m21 @ 10:08

historical m20 = active
historical m21 = expired
```

while §9.2 simultaneously says that same-SP canonical events project to the then-final state of that SP.

Those two rules are inconsistent.

A Memory expiry occurring while:

```text
LH = SP(n)
```

is a semantic validity transition inside the current SP interval.

Therefore its historical mapping must follow the same bucket/finalization rule.

Define an equivalent of:

```text
ExpiryAtSP(session, expires_at)
```

with:

## Before first SP
```text
PRE_FIRST_SP
```
→ expired at every addressable SP.

## During an open SP(n)
```text
SP(n)
```
→ expiry validity transition belongs to that SP.

## After Session end
```text
NOT_IN_SESSION
```
→ no expiry transition belongs to the Session.

---

# 13. Expiry historical oracle

If:

```text
m20 committed at 10:00
expiry occurs at 10:03
m21 commits at 10:08
```

then:

### While m20 is still live before 10:03
the Memory may legitimately be active.

### After expiry occurs while m20 is still current
the Memory becomes expired without:
- advancing `LH`;
- moving `TC`;
- writing RH.

### Once m21 commits and m20 is sealed
historical:

```text
K(m20)
```

contains the then-final m20 validity state:

# **EXPIRED**

not ACTIVE.

This is the same rule already used for analytical objects becoming canonical later inside the same SP.

No sub-Moment coordinate is added.

---

# 14. Exact-tie expiry rule

Current Memory eligibility already uses the semantic form:

```text
expires_at > CURRENT_TIME
```

for active eligibility.

Therefore at the exact expiry instant:

```text
now == expires_at
```

the Memory is expired.

The Session-position mapping MUST preserve this half-open validity:

```text
active before expiry
expired at/after expiry
```

Do not freeze the v2 rule that makes the anchor SP active on an exact tie.

---

# 15. Derived vs materialized expiry

The ruling still permits either:

## Derived
derive `ExpiryAtSP` from:
- immutable `expires_at`;
- authoritative committed-CU timing;
- Session baseline/end boundary.

## Materialized
record an append-only expiry validity event.

But both must produce the §13/§14 oracle.

They are not equivalent if one delays expiry until the next Moment.

---

# 16. Legacy session coverage — clarify, do not reopen

Candidate v2's Path A may remain for v1:

> a Session that began before historical architecture activation is not partially upgraded.

But state it as an implementation compatibility boundary:

# **LEGACY UNCOVERED SESSION**

Such a Session:

- continues on the pre-Stage-6 committed runtime;
- does not receive Stage-6 Timeline/Map historical semantics;
- is not partially converted;
- remains historical-disabled through closure unless complete deterministic backfill occurs.

Do not turn:

```text
historical_coverage_complete
```

into a Product or epistemic state.

No partial Timeline.

---

# 17. Updated historical matrix requirement

Rebuild only the temporal-authority columns of FG66-04.

For every row state:

1. semantic field source;
2. current-session availability source;
3. whether availability is:
   - SP-native by existing/new Stage-6 substrate;
   - baseline `PRE_FIRST_SP`;
   - SP-native availability event that must be built;
4. validity source;
5. same-SP ordering need;
6. final verdict.

No row may rely on:

```text
CURRENT_TIMESTAMP → SessionAvailabilityAnchor
```

as the authoritative in-session availability path.

A legacy immutable `created_at` may remain evidence for:
- pre-deployment/backfill;
- audit;
but not current-session live anchoring.

---

# 18. Backend / migration consequences

T-03A2 must own or establish the shared Session Semantic Clock authority used by all downstream SP-native semantic writes.

T-03C must integrate legacy analytical writers with that clock or an equivalent append-only event boundary.

The plan must explicitly identify how a post-response/background canonical write obtains:

```text
session_id
current SP
event sequence
```

without trusting caller-supplied Product authority.

Derivation may use:
- canonical source-turn lineage;
- durable effect/result ownership;
- server-side session lookup;
- another proven server-owned relation.

If a writer cannot be associated with the current Session, it must not fabricate a current-session anchor.

---

# 19. Required new proofs

## P66-E — Transaction-start timestamp adversary

Fixture:

```text
SP = m11

analytical transaction A starts
A therefore has CURRENT_TIMESTAMP = t0

A waits

CU transaction B commits m12

A resumes and makes Reading R canonical
```

Expected:

```text
R anchors to m12
NOT m11
```

because Session Semantic Clock order, not transaction-start timestamp, owns availability.

Repeat inverse serialization order:

```text
A serializes/commits before B
```

Expected:

```text
R anchors to m11
B then advances to m12
```

---

## P66-F — SP sealing

Fixture:

```text
m12 current
late analytical work sourced from m10 commits
→ anchor m12

m13 commits
→ m12 sealed

even later analytical work sourced from m12 commits
```

Expected:

```text
later work anchors m13
never reopens m12
```

Causal source cannot determine availability.

---

## P66-G — Expiry within same SP

Fixture:

```text
m20 @ 10:00
expiry @ 10:03
m21 @ 10:08
```

Expected:

Before expiry while m20 current:
```text
Memory active
```

After expiry while m20 current:
```text
Memory expired
LH still m20
TC unchanged
RH unchanged
```

After m21 seals m20:
```text
historical K(m20) = expired validity
```

No sub-Moment coordinate.

---

## P66-H — Exact expiry tie

Fixture:

```text
m20 committed_at == expires_at
```

Expected:

```text
Memory expired at m20
```

because active validity is half-open:

```text
time < expires_at
```

not `<=`.

---

## P66-I — Before-first-SP distinction

Fixture:

```text
Session created 10:00
Fact becomes canonical 10:02
first committed CU/SP(1) at 10:05
```

Expected:

```text
Fact is PRE_FIRST_SP for this Session
Fact is available at SP(1)
```

But the system MUST NOT assert:

```text
Fact existed before Session start
```

---

# 20. Gates to re-run

Re-run only:

- FG66-04 historical matrix temporal-authority columns;
- affected FG66-05 wording;
- affected FG66-06 same-SP proof;
- FG66-12 backend/migration closure;
- affected FG66-14 traceability;
- Z66-04 availability;
- P66-A with SP-native authority;
- P66-B replaced/superseded by corrected expiry oracle;
- P66-C wording only if needed;
- P66-E…P66-I;
- contradiction audit;
- ambiguity audit;
- release-condition list.

Carry all other PASS results unchanged.

---

# 21. Release-condition correction

Candidate v3 must replace the timestamp-proxy form of R-C4/R-C5 with:

## R-C4 — SP-native semantic availability authority

Every current-session semantic object/component exposed in historical `V` receives its availability/validity anchor through the shared server-owned Session Semantic Clock or an equivalent SP-native event contract.

No transaction-start timestamp determines current-session Product availability.

## R-C5 — Wall-clock validity mapping

Wall-clock-only policy facts such as Memory expiry are mapped into the current SP bucket using the frozen same-SP/sealing semantics.

No direct timestamp↔TC comparison.

Exact expiry is inactive/expired.

Also preserve:

- R-C1 complete session coverage;
- R-C2 row preservation;
- R-C3 evidence-path defanging.

---

# 22. Technical research note

This correction is based on PostgreSQL's documented time semantics:

```text
CURRENT_TIMESTAMP / now()
= start of current transaction
```

while:

```text
clock_timestamp()
= actual current wall clock
```

Even replacing `CURRENT_TIMESTAMP` with `clock_timestamp()` would not by itself solve canonical availability ordering because row visibility still depends on transaction commit and concurrency.

Therefore the fix is not "use a better timestamp".

The fix is:

# **serialize Product availability directly in SP space.**

---

# 23. Stop Rules

STOP if the correction requires:

- a user-addressable sub-Moment coordinate;
- exposing same-SP `event_sequence`;
- using caller-supplied SP as authority;
- backdating to causal source;
- timestamp-only current-session availability;
- reopening a sealed SP;
- delaying a same-SP expiry transition until the next Moment merely for convenience;
- partial-session historical enablement;
- treating coverage/baseline metadata as Product truth;
- reopening OPEN-06/08/09/19.

---

# 24. Required candidate

Return:

# `QANDEEL_STAGE6_6_IMPLEMENTATION_READINESS_CANDIDATE_v3`

Targeted only.

Do not rebuild unaffected evidence.

Required updated sections:

1. correction-consumption matrix;
2. gate summary;
3. temporal availability architecture;
4. baseline sentinel terminology;
5. SP sealing;
6. same-SP ordering;
7. corrected Memory expiry mapping;
8. historical matrix temporal columns/verdict counts;
9. backend/API/migration closure;
10. task ownership changes;
11. traceability;
12. P66-E…P66-I;
13. affected Z/P proofs;
14. risks;
15. MUST/MUST NOT;
16. release conditions;
17. contradiction/ambiguity audit;
18. Stage 6 freeze recommendation;
19. implementation authorization recommendation;
20. START_HERE / diagram / SHA256SUMS if affected.

No code.
No repo mutation.
No branch.
No PR.
No Stage 6 self-freeze.

---

# 25. Current status

```text
Stages 0–5                         CLOSED / FROZEN
Stage 6.1                         CLOSED / FROZEN
Stage 6.2                         CLOSED / FROZEN
Stage 6.3                         CLOSED / FROZEN
Stage 6.4                         CLOSED / FROZEN
Stage 6.5                         CLOSED / FROZEN
Stage 6.6 v2                      REVIEWED
Stage 6.6                         TARGETED FINAL REVISION
Stage 6                           NOT FROZEN YET
Implementation                   NOT AUTHORIZED
```
