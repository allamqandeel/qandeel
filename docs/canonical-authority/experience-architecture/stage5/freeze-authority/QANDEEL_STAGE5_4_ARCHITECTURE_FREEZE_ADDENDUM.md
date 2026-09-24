# QANDEEL — Stage 5.4 Architecture Freeze Addendum
## Historical Projection + Map Temporal Appearance Contract v1

**Architecture Verdict:** APPROVED / CLOSED / FROZEN  
**Base Candidate:** `QANDEEL_STAGE5_4_CANDIDATE_PACKAGE_v1`  
**Authority:** This addendum is canonical and overrides/narrows the candidate wherever the wording differs. All candidate rules not modified here are accepted.

---

# A-01 — Correct the resolution axes: knowledge membership ≠ currentness ≠ default rendering

The candidate's gate model is accepted in direction but not literally as written.

It currently says gates 1–3 determine “presence in `K(TC)`” while also saying a known superseded version remains present in lineage. Those statements conflict.

Canonical model:

## 1. Knowledge availability

Knowledge is evaluated for the **specific target component being resolved**, not only for the parent entity.

At minimum:

- `Known(e,t)` — canonical identity known;
- `Known(a,t)` — contextual appearance known, when an appearance is targeted;
- `Known(v,t)` — specific version/state known, when a version is targeted;
- relations, Evidence participations, Confidence versions/states, Question-state changes and other independently generated analytical units each obey their own `KF`.

If the relevant component's `KF > t`, that component is unavailable at `t`.

## 2. Then-current validity

For a known version/state:

`Current(v,t)` is determined separately from knowledge.

A known noncurrent version remains part of legitimate historical lineage but is not the default then-current Map representation.

## 3. Context availability

A canonical identity may be known while one contextual appearance is unavailable.

## 4. Semantic-depth disclosure

Depth is a non-temporal disclosure gate evaluated only after the relevant temporal entitlement is established.

Therefore the architecture must keep separate:

- canonical identity knowledge;
- appearance knowledge;
- version/state knowledge;
- then-current validity;
- default renderability;
- lineage/provenance retrievability.

`KNOWN_NONCURRENT_AT_TC` means:

> legitimately known and lineage-retrievable, but not the default then-current representation.

It does **not** mean “not in K(TC).”

---

# A-02 — Half-open intervals do not by themselves guarantee exactly one current version

`[VF, VT)` remains the canonical boundary convention where version-validity intervals exist.

But half-open interval notation alone guarantees only boundary inclusion/exclusion. It does **not** mathematically guarantee:

- no overlapping versions;
- no gaps;
- exactly one current version at every `TC`.

Canonical validity invariant:

> For any version lineage, the validity model MUST NOT produce more than one then-current version at the same `TC`.

Where an upstream lifecycle guarantees continuous current state, adjacent intervals may provide gapless coverage.

Where the ontology legitimately allows a period with no current version/state, a gap is allowed and MUST NOT be filled by borrowing another version.

Do not infer gaplessness merely from `[VF,VT)` notation.

The supersession example:

`VT(R1) = VF(R2)`

still yields the intended clean handoff: R1 ceases to be current exactly when R2 becomes current.

---

# A-03 — Spatial invariance is about frozen Home assignments, not `pos(e)=f(e)` for every entity

The candidate's intended anti-compaction invariant is approved, but the equation:

`pos(e) = f(e)`

is too broad and too restrictive if read literally.

Canonical rule:

## Spatially committed entities

For an Established Thread or other upstream-authorized permanent spatial commitment such as an exceptional Shared Anchor:

`Home(e) := AssignAtEstablishment(e, then-legitimate world context)`

Once legitimately established:

`Home(e, t >= establishment) = constant`

Historical projection membership MUST NOT recompute, repack, normalize, or move that Home assignment.

The initial establishment assignment MAY depend on legitimate world/context information available at establishment; Stage 5.4 does not redefine how that assignment was originally chosen.

## Non-spatial entities

Readings, Memories, Events, relations, Evidence participations, Confidence states, Questions, provenance records and ordinary contextual appearances do not acquire independent canonical Home loci merely because they are resolvable objects.

They disclose within their frozen Thread/Session/contextual structure.

Therefore the correct invariant is:

> **Projection changes never recompute canonical spatial commitments.**

not:

> every entity position is a function of the entity alone.

This preserves every anti-compaction proof in the candidate without over-constraining the frozen spatial model.

---

# A-04 — Independently generated analytical components keep independent knowledge gates

The candidate matrix contains several “follows parent” formulations that are too loose.

Canonical requirements carried forward from Stage 5.1:

## Relation
Own `KF`, and where applicable own validity/lifecycle boundaries.

Endpoint existence is necessary but never sufficient.

## Evidence participation
Own `KF` and applicable participation-validity boundary.

A later Evidence participation MUST NOT strengthen an earlier Reading projection merely because the Reading itself already existed.

## Contextual appearance
Own `KF(a)` and any applicable appearance-validity boundary, in addition to requiring a legitimate referent/context.

## Confidence version/state
Own knowledge/version boundary.

The analytical object existing earlier does **not** make a later Confidence version historically available.

At `TC`, only the Confidence state/version both legitimately known and then-valid may be exposed at an entitled analytical depth.

## Question / Information-Gap lifecycle changes
Each later lifecycle transition must become historically visible only from its own legitimate knowledge/validity boundary.

General rule:

> **Parent availability is necessary where semantically required, but never substitutes for the child's own temporal entitlement.**

---

# A-05 — Emerging Focus must not be collapsed into Established Thread identity

The candidate correctly preserves the frozen rule that Emerging Focus is provisional and pre-geographic.

However, wording such as “one identity across all states” must not be read as:

`Emerging Focus == already-canonical Established Thread identity`

before establishment.

Canonical distinction:

- an Emerging Focus is a legitimate provisional focus state;
- it is pre-geographic;
- it may later resolve/establish into an Established Thread when upstream semantics warrant;
- Stage 5.4 MUST NOT assume every Emerging Focus necessarily becomes an Established Thread;
- it MUST NOT assign the later Thread Home locus or established-Thread identity backward before establishment.

Once a Thread is established:

`Active / Dormant / Reopened`

are states of the **same established Thread identity** and the same persistent Home locus.

The exact upstream identity-transition semantics from provisional Focus → Established Thread are preserved; Stage 5.4 does not invent or collapse them.

---

# A-06 — Uniform absence applies to default Map projection, not to legitimate lineage/provenance or knowledge-gated chrome

The candidate's “uniform, reason-free absence” principle is accepted only at the **default Map representation** level.

Canonical meaning:

If a target component is not legitimate for default rendering at `TC`, the Map MUST NOT expose it through:

- ghost;
- placeholder;
- future-shaped slot;
- object marker;
- spatial target;
- future label;
- anticipatory geometry.

However this does **not** mean all internal states become epistemically identical.

In particular:

- a known superseded version may remain deliberately retrievable at Source/Provenance depth;
- a known canonical identity may remain nameable in allowed knowledge-gated return chrome even when one later contextual appearance is unavailable;
- an unknown future identity/version/context remains unnamed;
- a generic “Return to previous inspection” affordance remains allowed where Stage 5.3 permits it.

Therefore `H-10` is read as:

> **No unavailable/noncurrent component gains ambient/default Map presence merely to explain its absence.**

It does not prohibit legitimate deliberate provenance inspection of already-known historical lineage.

---

# A-07 — Inspection resolution must distinguish canonical identity, context, and version

`IF_ref / IF_render` is APPROVED, with this refinement.

`IF_ref` may identify a compound target such as:

`{ canonicalIdentity, contextualAppearance?, version?, depth, lineage }`

Temporal re-resolution must evaluate each component separately.

## Case A — canonical identity itself unknown
- no object rendering;
- no future identity/name;
- RH retains opaque reference;
- generic return chrome only.

## Case B — canonical identity known, specific future version unknown
Example: the Reading lineage is already known through R1, but the inspected live version R2 has `KF(R2) > TC`.

- R2 MUST NOT render or be named as though known;
- the then-current historically legitimate version may appear in the **default Map projection**;
- this MUST NOT silently rebind `IF_ref` from R2 to that version;
- the already-known canonical lineage name may remain only if it does not disclose R2-specific future information.

## Case C — identity known, contextual appearance unavailable
- unavailable appearance absent;
- no automatic substitution into another context;
- canonical identity may remain legitimately accessible elsewhere;
- future context name/locus withheld.

## Case D — specific version known but noncurrent
- default Map projection shows the then-current version/state;
- `IF_ref` remains attached to the requested historical version identity;
- at a legitimate Source/Provenance lineage depth, that known noncurrent version MAY be rendered explicitly as historical/noncurrent;
- ordinary higher Map depths do not render all lineage versions together.

## Case E — temporally entitled but depth-withheld
- not historical absence;
- frozen Semantic Zoom rules apply.

This preserves Exact Return, canonical identity, default historical truth and deliberate lineage inspection simultaneously.

---

# A-08 — Neighbourhood expression is then-current-content-derived; do not promise impossible “non-inferability”

The candidate's `H-23/H-24` direction is accepted with a precision correction.

Neighbourhood expression MAY legitimately vary according to content/state available in the selected historical projection while its established Home locus remains fixed.

The enforceable rule is:

> **Neighbourhood expression at `TC` may be derived only from then-legitimate material in `K(TC)` and the frozen visual grammar. It MUST NOT be computed from future-relative-to-`TC` material.**

Stage 5.4 cannot guarantee that a user who has already seen Live will be unable to infer that the historical field contains less material. Such prior user knowledge is not erased by historical projection.

The contract protects against **system-generated hindsight leakage**, not against human memory of a later state already observed.

OPEN-17 remains the correct place to test perceptual variation bounds.

---

# Accepted Stage 5.4 Core

Subject to A-01…A-08, the following are APPROVED and FROZEN:

1. Historical projection changes truth/state, never canonical geography.
2. No historical compaction, recentering or alternate layout.
3. Future-unavailable identities/appearances/versions/relations do not gain ambient Map representation.
4. Empty historical field is legitimate; future-shaped emptiness is forbidden.
5. Established Thread Home loci persist from establishment onward.
6. Emerging Focus remains provisional/pre-geographic and never borrows future geography.
7. Active/Dormant/Reopened remain one Established Thread identity after establishment.
8. Dormancy is presence-with-state, not absence.
9. Reopening is state change, not new identity.
10. Relations and presentation substitutes cannot leak before their own historical entitlement.
11. Contextual appearances are independently gated and never imply ownership.
12. Supersession preserves historical lineage without ambient duplicate clutter.
13. Historical correction does not rewrite earlier then-valid truth.
14. Confidence and other versioned analytical properties resolve historically and never alter geometry.
15. `IF_ref` remains exact while `IF_render` is re-resolved against selected historical truth.
16. Projection changes do not move `MC`.
17. Sparse historical viewports are legitimate.
18. Temporal unavailability and Semantic-Depth withholding remain distinct.
19. Source/Provenance may retrieve legitimately known historical lineage without contaminating higher-level default projection.
20. Preview obeys the frozen Stage 5.2 envelope; settle must contain no stale intermediate temporal state.
21. Historical truth is device-invariant; mobile reduces simultaneous disclosure, not truth.
22. Absence carries no implication of falsity, rejection, deletion or low confidence.
23. Final lifecycle styling, sparse-orientation cues, neighbourhood-expression bounds and motion remain outside this freeze where already declared OPEN.

---

# Remaining OPEN Items

Inherited and still DEFER:

- OPEN-02
- OPEN-06
- OPEN-08
- OPEN-09
- OPEN-10
- OPEN-12
- OPEN-13
- OPEN-14

Stage-5.4-specific and retained:

- OPEN-15 — Lifecycle-state legibility
- OPEN-16 — Sparse-projection orientation
- OPEN-17 — Neighbourhood-expression variation bounds

No new OPEN item is required by this addendum.

---

# Proof Status

**Proof Board A — ACCEPTED as architectural proof scaffolding**, under the corrected A-03 interpretation:

- the printed invariant coordinates prove persistent **Established Thread Home loci**;
- they do not assert that every canonical object class owns a world-space coordinate;
- initial Home assignment mechanics remain upstream/out of scope.

**Proof Board B — ACCEPTED as adversarial proof scaffolding**, under A-01/A-04/A-06/A-07.

No board aesthetics, color, typography, motion or renderer choice is canonical.

---

# Final Status

## Stage 5.4 — Historical Projection + Map Temporal Appearance Contract v1

**APPROVED / CLOSED / FROZEN**

No repository implementation is authorized by this freeze.

The base Candidate Package v1 plus this Architecture Freeze Addendum together form the canonical Stage 5.4 record.
