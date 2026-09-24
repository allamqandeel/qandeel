# QANDEEL — Stage 6.2 Architecture Review Ruling
## Timeline Interaction + Legibility Completion — Targeted Revision

**Architecture Verdict:** TARGETED REVISION REQUIRED  
**Base Candidate:** `QANDEEL_STAGE6_2_TIMELINE_COMPLETION_CANDIDATE_v1`  
**Scope:** Four narrow corrections only  
**Research:** APPROVED — do not repeat  
**Repo:** untouched / no coding

Do NOT redo Stage 6.2 from scratch.

Preserve all unaffected research, option analysis, proof evidence, and tests.

---

# 1. APPROVED DIRECTIONS

Subject to the corrections below, Architecture APPROVES these directions:

## A-01 — OPEN-13 core scale direction

The v1 Timeline uses an:

# **ORDINAL / CONSTANT-STEP METRIC FOR DISCLOSED COMMITTED MOMENTS**

For the metrically disclosed region:

> Track distance communicates **committed current-session order**, not elapsed real-world duration.

Therefore:

- equal step distance does NOT mean equal elapsed time;
- long real-time pauses do not create larger ordinal distance by themselves;
- rapid real-time bursts do not compress Moments because of duration;
- spacing must not encode importance, confidence, emotion, analytical weight, causality or ownership;
- previously disclosed ordinal positions do not rescale merely because Live advances.

This direction is APPROVED.

The candidate's rejection of:
- duration-proportional;
- fit-to-width;
- future-aware adaptive scaling

is accepted where those models would disclose or compute future-relative extent/density while PINNED.

---

## A-02 — OPEN-14

# **NO TIMELINE AGGREGATION IN v1**

APPROVED, provided the corrected post-TC navigation contract below remains usable.

No dormant aggregation object/control/state should be retained solely for future use.

The absence of aggregation does not remove the requirement for:
- long-session navigation;
- mobile usability;
- non-pointer reach;
- Preview;
- direct temporal actions already frozen upstream.

---

## A-03 — OPEN-02 structural direction

APPROVED in principle:

> **Targets express temporal address; explicit acts express temporal-only vs Temporal+Locate intent.**

Ordinary temporal target selection must never gain spatial authority merely from target position.

P3a remains:
- one explicit user act;
- temporal commit + one-shot locate intent;
- one RH transaction when the frozen composite succeeds as one act.

Zero locus:
- temporal success;
- no spatial landing.

Multiple loci:
- no arbitrary landing;
- later explicit contextual choice remains a separate transaction.

The v2 package must retain the exact chosen interaction grammar and prove it does not become two sequential user acts.

---

## A-04 — Research

The targeted research is accepted.

In particular, the accessibility research correctly identifies a real risk:

> a conventional full-range control can leak information if its exposed range/value semantics encode future-relative extent while the user is PINNED.

This finding is retained, but must be narrowed under REV-03 below.

---

# 2. REV-01 — POST-TC NAVIGATION MUST REMAIN POSSIBLE

## Candidate wording to revise

The v1 summary states an equivalent of:

> the post-TC terminus is a single target, never a range, and while PINNED no gesture anywhere resolves to a post-TC Moment.

That is NOT acceptable as a canonical Stage 6.2 rule.

## Why

Frozen Stage 5 established all of the following:

1. the Timeline domain is the current Session;
2. later current-session time remains reachable;
3. Preview may legitimately move to a later `PTC`;
4. later Preview reveals only truth legitimate at that `PTC`;
5. Stage 5.3's post-TC rule is a **disclosure firewall**, not a navigation-coordinate/input-mapping prohibition.

Therefore Stage 6.2 must not solve no-hindsight by making later absolute Moments unreachable from the Timeline.

Canonical constraint:

> **While PINNED, future-relative-to-TC structure must be non-metric and non-enumerative, but explicit temporal navigation toward later current-session Moments must remain possible.**

---

## Required revised model

Separate:

### A. Disclosed metric region

For legitimate Moments at or before current `TC`:

```text
ordinal constant-step metric
```

Distance communicates committed order only.

### B. Post-TC navigation region / mechanism

For:

```text
TC < m <= LH
```

the Experience may expose only:

- later current-session time exists / is reachable;
- permitted Live meta;
- a navigation mechanism that does not reveal future count, density, magnitude, subdivision or semantic structure.

It MUST NOT expose:
- one slot per future Moment;
- future step count;
- future proportional length;
- future density;
- hidden set-size;
- disabled future targets;
- semantic markers.

But it MUST preserve the ability for explicit temporal interaction to move/Preview/commit forward under the frozen grammar.

---

## Mapping requirement

Stage 6.2 must now explicitly define:

> how user input can advance into later current-session temporal positions without the passive Track disclosing how much future structure exists.

Possible mechanism families may include:
- relative/progressive traversal;
- gesture-delta traversal;
- another deterministic non-enumerative mapping.

Architecture is NOT selecting the final mapping in this ruling.

The candidate must choose and prove one.

Do NOT create:
- a third mode;
- coarse stepping;
- a future Moment list;
- a hidden enumerable control set.

---

## Required test

### REV-AT-01

State:

```text
LH = 100
TC = 40
TM = PINNED(40)
```

Without exposing:
- 60 future Moments;
- proportional future extent;
- future markers/count/density;

the user must still be able to intentionally navigate/Preview toward a later `PTC` and commit a later `Moment(m)`.

PASS only if:
- navigation is possible;
- passive disclosure remains firewall-compliant;
- no future count/extent is recoverable merely from the resting control.

---

# 3. REV-02 — LIVE_EDGE MAY BE VISUALLY DISTINCT, BUT MUST NOT BECOME A FAKE TEMPORAL STEP

## Candidate direction to revise

The candidate describes:

> `Moment(LH)` as the final step and `LIVE_EDGE` as a terminus beyond it, adjacent and never co-located.

That wording is over-broad.

## Frozen semantic fact

At a given instant:

```text
Moment(LH)
```

and:

```text
LIVE_EDGE
```

may refer to the same current temporal coordinate while representing different target kinds / future behavior.

Stage 6.2 must solve the **intent distinction**, not manufacture an additional temporal distance.

---

## Architecture ruling

A distinct Live affordance MAY be visually/spatially separated from the final Moment for operability.

But if separated:

> it must be an **outboard/non-metric Live control anchored to the same Live boundary**, not another ordinal temporal step after `Moment(LH)`.

Therefore:

- `LIVE_EDGE` does not consume ordinal Track distance;
- there is no fictitious “Moment after LH”;
- adjacency may exist as control composition;
- temporal coordinate equality remains conceptually true;
- the UI must not imply elapsed/order distance between `Moment(LH)` and `LIVE_EDGE`.

Canonical phrasing:

> **co-temporal, intent-distinct; affordances may be spatially distinct.**

---

## Required re-run of DT-01

The proof must test the hard case rather than remove it:

```text
temporal coordinate(Moment(LH))
=
temporal boundary(LIVE_EDGE)
```

Can the user intentionally invoke either:

```text
Moment(LH) → PINNED(LH)
```

or:

```text
LIVE_EDGE → FOLLOW_LIVE
```

without interpreting visual separation as temporal distance?

If the chosen proof board uses an outboard terminus/control, label it explicitly:

```text
NON-METRIC LIVE CONTROL
```

or equivalent.

Do not call it a later Track step.

---

# 4. REV-03 — NARROW THE ACCESSIBILITY SLIDER CONCLUSION

The research finding is valuable but the canonical conclusion must be narrower.

W3C APG slider examples/patterns use numeric range semantics such as:
- minimum;
- maximum;
- current value;
- keyboard step movement.

That means:

> **a conventional single full-session slider whose exposed bounds/value encode post-TC future extent is incompatible with QANDEEL while PINNED.**

This conclusion is APPROVED.

Do NOT freeze the broader statement:

> “slider/range topology is structurally unavailable.”

That is too absolute.

Stage 6.4 retains authority to determine whether slider/range semantics might be valid:
- for a restricted disclosed region;
- in FOLLOW_LIVE;
- in combination with another non-metric future-navigation mechanism;
- or not at all.

Stage 6.2 freezes only the epistemic constraint:

> accessible value/range metadata MUST NOT reveal future-relative count, magnitude, position, density or extent while PINNED.

No web-specific ARIA role is frozen here.

---

# 5. REV-04 — WCAG TARGET SIZE IS NOT PART OF THE SCALE SEMANTICS

The candidate states an equivalent of:

> every constant step clears WCAG 2.5.8's 24×24 requirement by construction.

Do NOT freeze that claim as a reason for selecting ordinal scale.

WCAG 2.5.8 concerns pointer target sizing/spacing and includes exceptions; it does not require each semantic Timeline Moment to become an independently exposed 24×24 target.

Also, spatial-value controls such as sliders can constitute one target for that criterion.

Therefore:

- OPEN-13 may define ordinal separation;
- Stage 6.4 owns final pointer target/accessibility sizing topology;
- proof boards may use generous hit areas as scaffolding;
- no fixed per-Moment pixel target is canonical in Stage 6.2.

Remove 24×24 from the semantic justification for constant-step scale.

---

# 6. TIMESTAMP CONSEQUENCE — NARROW WORDING

The candidate may state:

> **The Stage 6.2 Timeline contract creates no new requirement to retain Moment timestamps solely for Track geometry.**

Do NOT state:

> QANDEEL / v1 has no Moment timestamp retention obligation at all.

Other runtime, evidence, audit, provenance, analytics, or future contracts may independently require timestamps.

Stage 6.2 decides only that ordinal Track geometry does not need elapsed-time timestamps.

---

# 7. OPEN-14 — NO AGGREGATION v1 CONDITIONS

The no-aggregation decision remains APPROVED only if v2 proves all of:

1. disclosed ordinal steps keep deterministic meaning;
2. viewport/windowing does not alter semantic target identity;
3. long current Sessions remain temporally navigable;
4. mobile can expose less simultaneously without changing meaning;
5. non-pointer reach remains a 6.4 obligation without reviving OPEN-08;
6. post-TC navigation remains possible under REV-01;
7. no hidden aggregation/count metadata appears.

If those hold:

# OPEN-14 → NO AGGREGATION IN v1

may freeze.

---

# 8. Required v2 Scope

Create:

# `QANDEEL_STAGE6_2_TIMELINE_COMPLETION_CANDIDATE_v2`

Do NOT repeat research.

Do NOT redo unaffected sections.

Update only:

1. OPEN-13 full scale contract;
2. Live vs pinned geometry contract;
3. post-TC navigation/input-mapping contract;
4. OPEN-12 structural contract;
5. accessibility conclusion;
6. target-size wording;
7. timestamp-retention wording;
8. OPEN-14 proof dependency;
9. affected MUST / MUST NOT clauses;
10. Stage 6.5 implementation-readiness outputs;
11. affected traceability;
12. Boards A/B;
13. affected DT/X results;
14. Decision Index;
15. Architecture Review Handoff;
16. package index/checksums if present.

Preserve all unaffected v1 evidence.

---

# 9. Mandatory Re-Run

Re-run only the affected tests:

- DT-01 — co-temporal latest Moment vs LIVE_EDGE intent
- DT-02 — pinned latest Moment then Live advance
- DT-03 — FOLLOW_LIVE advance
- DT-06 — pinned future firewall
- DT-11 — nonvisual distinction
- DT-13 — mobile/narrow
- X-01 — range-metadata leak
- X-02 — co-temporal target ambiguity
- X-05 — historical transition
- X-09 — mobile co-location
- REV-AT-01 — pinned forward navigation without future enumeration

Re-evaluate X-10 after board changes.

No other test needs to be re-run unless a correction changes its premises.

---

# 10. Architecture Stop Rule

STOP if the corrected solution requires any of:

- post-TC future Moment enumeration;
- future count/density/extent leakage;
- a new temporal mode;
- coarse stepping as v1 feature;
- cross-session Timeline;
- ordinary temporal selection auto-locating;
- `LIVE_EDGE` becoming a fictitious later temporal position;
- changing Stage 5 Preview/Commit/Settle semantics.

Otherwise return v2 for final Architecture review.

Do NOT declare Stage 6.2 frozen yourself.
