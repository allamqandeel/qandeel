# QANDEEL — Stage 6.4 Execution Authorization
## Motion + Accessibility + Responsive Experience Contract

**Pre-Flight Result:** APPROVED  
**Stage:** 6 — Experience Closure + Implementation Readiness  
**Active Task:** 6.4 — Motion + Accessibility + Responsive Experience Contract  
**Upstream:** Stages 0–5 CLOSED / FROZEN; Stage 6.1 CLOSED / FROZEN; Stage 6.2 CLOSED / FROZEN; Stage 6.3 CLOSED / FROZEN  
**Owned OPEN:** OPEN-10 — Motion  
**Additional v1 obligations owned here:** accessibility topology, non-pointer reach, pointer/touch topology, responsive interaction expression, presentation interruption/cancellation.

This authorization permits targeted research + Experience-contract execution for Stage 6.4 only.

Do NOT modify the repository.
Do NOT code.
Do NOT reopen frozen product semantics.
Do NOT revive OPEN-06 / 08 / 09 / 19.
Do NOT make animation timing part of state authority.
Do NOT freeze decorative motion polish.
Do NOT choose platform accessibility primitives before epistemic compatibility analysis.

---

# 0. Pre-Flight Approval

The Stage 6.4 Pre-Flight Readiness Report is APPROVED.

Accepted understanding:

- Stage 6.4 carries frozen meaning across modalities; it does not invent meaning.
- `settle` is a state-machine boundary, not an animation event.
- M4-A is presumed empty: no semantic distinction should require motion as its sole carrier.
- reduced/no-motion is a first-class baseline.
- accessibility topology must be derived from what may truthfully be exposed.
- long-session practical reach is mandatory without silently reviving OPEN-08.
- responsive chrome may recompose; canonical Map geography may not.
- Back reverses transaction semantics, not animation frames.
- targeted research is justified.
- Blocking ambiguities at authorization time: NONE.

---

# 1. EXECUTION-GATE EG-64-01
## Semantic state commits independently of presentation progress

For every action with presentation/motion:

```text
semantic_state_transition
!=
animation_progress
```

The candidate must identify the authoritative semantic boundary from frozen upstream contracts.

Animation may begin before/after that boundary as presentation, but it MUST NOT determine:

- whether the act committed;
- RH transaction creation;
- `TM`;
- `TC`;
- `IF_ref`;
- Map camera destination authority;
- locate entitlement;
- Preview ownership;
- P5 post-live binding;
- Back semantics.

Required rule:

> **Skipping, shortening, reducing or interrupting animation must not change the semantic result.**

If a proposal needs “animation complete” to decide product state, reject it.

---

# 2. EXECUTION-GATE EG-64-02
## Motion may reinforce meaning, never carry it alone

Every state distinction must remain understandable with:

```text
motion = 0
```

For each proposed motion cue, the package must name the underlying non-motion carrier.

Examples:

- Pinned vs Live → structural target/mode state already frozen.
- Dormant vs Active → Stage 6.3 lifecycle structure.
- IF divergence → retained-reference chrome/state.
- projection-state orientation → Stage 6.3 orientation expression.
- Preview vs committed → structural interaction state.
- authorized camera destination → final viewpoint/state.

If the underlying static/nonvisual carrier does not exist:

STOP and report an Architecture problem.

Motion is not permitted to become a substitute for a missing structural contract.

---

# 3. EXECUTION-GATE EG-64-03
## Historical transition motion must not create forbidden temporal overlap

A temporal projection transition may change:

- presence;
- absence;
- then-current version;
- lifecycle state;
- legitimate contextual appearance;
- relation expression.

But transition presentation MUST NOT cause an intermediate frame to assert a false semantic state.

Specifically forbid:

- future-unavailable object fading as a ghost before disappearing;
- future version and historical then-current version reading as simultaneously current;
- a relation connector persisting after it is not entitled;
- a lifecycle “rewind” that visually replays future-known states into an earlier TC;
- camera drift introduced solely to make disappearance feel smoother.

The candidate must distinguish:

## A. Visual interpolation that is semantically neutral
Allowed only if no intermediate frame asserts unavailable or mutually-exclusive truth.

## B. Cross-state overlap that carries semantic meaning
Forbidden when it implies simultaneous validity.

Where safe interpolation cannot be proven:
prefer immediate state resolution or another non-overlap treatment.

Do not decide final easing/duration here.

---

# 4. EXECUTION-GATE EG-64-04
## Accessibility topology is selected from epistemic compatibility, not convention

For each candidate accessible interaction topology:

1. list the metadata the platform pattern normally exposes;
2. compare it to QANDEEL's permitted knowledge;
3. reject any topology whose required semantics leak unavailable information;
4. only then evaluate ergonomics.

This applies especially to Timeline navigation.

While `PINNED`, no accessible structure may reveal future-relative:

- maximum;
- total;
- set size;
- position-in-set;
- remaining count;
- progress ratio;
- future extent;
- future focus-stop set.

Do not choose:
- slider;
- listbox;
- tree;
- grid;
- composite widget;
- custom control

merely because it is familiar.

The semantic contract comes first.

No web-specific ARIA role is frozen by 6.4 unless the final cross-platform contract truly requires it. Prefer platform-neutral interaction semantics and provide implementation mappings later in 6.5 where possible.

---

# 5. EXECUTION-GATE EG-64-05
## Long-session reach must optimize repetition, not invent a larger semantic unit

OPEN-08 remains deferred.

Therefore:

> **A distant target may be reached faster, but the semantic unit of temporal traversal remains one Moment.**

The package must distinguish:

### Semantic unit
One Moment.

### Input acceleration
May increase how many one-Moment increments are applied over time/input magnitude.

### Coarse step
A named/selectable semantic unit larger than one Moment.

The first is frozen by Stage 6.2 as the v1 relative traversal choice.
The second may be an input mechanic.
The third remains out of v1.

Potentially valid techniques to investigate:

- key-repeat acceleration;
- held activation with rate acceleration;
- direct access to already-disclosed visible/windowed targets;
- pointer/touch traversal proportional to input movement where it still repeats the one-Moment unit;
- focus management/windowing strategies.

Forbidden:

- “jump 10 Moments” as a product command;
- named large-step unit;
- page/session-fraction semantics;
- exposing remaining Moment count to accelerate;
- future target enumeration.

If practical non-pointer reach cannot pass AX4-06 without a semantic coarse step:

STOP and report new dependency evidence.

---

# 6. EXECUTION-GATE EG-64-06
## Interruption changes presentation, not transaction history

The candidate must define one deterministic presentation rule for overlapping actions.

Canonical principle:

> **A newer authoritative user act may supersede/cancel in-flight presentation, but it does not retroactively split, merge or rewrite the already-defined semantic transaction.**

Examples:

## Camera movement interrupted by new explicit camera act
- first act's semantic transaction remains what upstream says it is;
- second act creates its own act/transaction if effective;
- presentation retargets to the newest authoritative destination;
- no intermediate animation frame becomes an RH checkpoint.

## Back during motion
- Back reverses the latest effective RH transaction;
- it does not reverse animation progress.

## Preview cancelled
- `PTC` discarded under frozen rule;
- transient disclosure removed;
- any associated transition stops;
- no stale Preview frame remains authoritative.

## Return to Live during another presentation
- Return semantics execute from authoritative current state;
- old animation cannot delay the temporal-mode change.

Animation cancellation must never manufacture a no-op acknowledgement or RH entry.

---

# 7. Targeted Research Authorization

Conduct targeted research only.

Do NOT repeat Stage 6.2/6.3 research.

Prefer authoritative standards/platform guidance for accessibility and input behavior.

## R-64-01 — Reduced motion / motion accessibility

Research authoritative guidance for:

- prefers-reduced-motion / platform equivalents;
- motion triggered by interaction;
- vestibular considerations;
- preserving state communication without animation.

Goal:
define what motion classes must be removable/reduced and what static alternatives are required.

Do not import CSS/platform implementation as product semantics.

---

## R-64-02 — Object constancy and state-transition presentation

Research HCI / interaction guidance for:

- object constancy;
- continuity across state transitions;
- interruption-safe transitions;
- change blindness;
- avoiding false intermediate interpretations.

Goal:
constrain temporal projection/camera transitions.

Do not resolve final animation style.

---

## R-64-03 — Accessible Timeline / composite control topology

Research authoritative accessibility patterns for:

- range controls;
- composite widgets;
- roving focus / active-descendant approaches;
- repeated relative actions;
- value text / labels;
- large dynamic sets.

Evaluate:
- metadata leakage;
- future set enumeration;
- Live vs latest intent;
- P3a dual acts;
- Preview / Cancel.

The research result may conclude that no single conventional widget pattern maps cleanly.

That is acceptable.

---

## R-64-04 — Long-range keyboard/non-pointer navigation

Research:

- key-repeat behavior;
- acceleration while holding a key/control;
- large-set navigation without exposing semantic coarse units;
- focus virtualization/windowing accessibility.

Goal:
find practical reach mechanisms compatible with one-Moment semantics.

Do not revive OPEN-08.

---

## R-64-05 — Pointer/touch and responsive complex spatial interaction

Research authoritative guidance for:

- target sizing / spacing;
- touch/pointer parity;
- hover-independent access;
- orientation change;
- responsive re-composition;
- complex spatial UI accessibility.

Goal:
define implementable v1 constraints without turning screen layout into Map geography.

---

# 8. Research Evidence Rules

For each source record:

1. source;
2. authority/type;
3. principle reused;
4. QANDEEL implication;
5. conflict with frozen semantics;
6. pattern explicitly not copied.

External sources can reject a proposed mechanism.

They cannot alter:
- temporal modes;
- RH;
- Preview / Commit / Settle;
- Map geography;
- IF semantics;
- lifecycle semantics;
- no-hindsight;
- Stage 6.2/6.3 decisions.

---

# 9. OPEN-10 Decision Framework
## Minimum Semantic Motion Contract

Build a matrix of state/event classes.

At minimum evaluate:

- Pan;
- Semantic Zoom;
- ordinary temporal commit;
- Timeline Preview;
- Preview cancel;
- Return to Live Head;
- Return to Live Focus;
- Go Live + Locate;
- Exact Return;
- Back One Step;
- historical projection change;
- object appearance;
- object disappearance;
- relation appearance/disappearance;
- lifecycle state change;
- IF divergence onset/clearance;
- responsive re-composition;
- no-op.

For each classify:

- `MOTION FORBIDDEN`
- `MOTION OPTIONAL — REINFORCEMENT ONLY`
- `MOTION RECOMMENDED — BUT STATIC EQUIVALENT REQUIRED`
- `NO SEMANTIC MOTION CONTRACT NEEDED`

For any permitted motion specify:

1. semantic state before;
2. authoritative semantic boundary;
3. semantic state after;
4. safe visual interpolation envelope;
5. interruption behavior;
6. reduced/no-motion equivalent.

Do NOT set production durations/easing.

---

# 10. Accessibility Topology Decision Framework

Compare at least three structural topology families for the Timeline/accessibility surface.

The comparison must include:

## Family A — Bounded-range-led topology
Evaluate only where epistemically legal.

## Family B — Composite target/action topology
Explicit reachable targets + relative forward continuation + separate Live action.

## Family C — Hybrid topology
A bounded disclosed-region control plus separate non-metric forward/Live controls.

Other families may be added.

For each evaluate:

- future metadata leakage;
- Moment targeting;
- Live vs `Moment(LH)`;
- P3a two acts;
- Preview / Cancel;
- long-session reach;
- screen-reader understanding;
- keyboard;
- touch;
- mobile;
- implementation determinism.

Do not force one web control role across all states if semantic compatibility differs by temporal mode.

Recommend one platform-neutral v1 topology.

---

# 11. Long-Session Reach Decision Framework

Compare at least three non-coarse-step mechanisms.

For each test:

- one-Moment semantic unit preserved;
- no future count required;
- no future focus-stop set required;
- practical time/effort;
- predictable acceleration;
- ability to stop on exact Moment;
- reduced motor precision needs;
- mobile equivalent;
- assistive technology equivalent;
- virtualization/windowing compatibility.

Recommend one primary v1 reach grammar plus allowed accelerators.

---

# 12. Responsive Contract Decision Framework

Define which things MAY recompose:

- Timeline chrome;
- inspection chrome;
- projection-state chrome;
- action controls;
- labels;
- control grouping.

Define what MUST NOT re-layout:

- canonical Map geography;
- Established Home loci;
- semantic neighbourhood coordinates;
- historical spatial commitments.

For each breakpoint/device transition define:

- state preservation;
- focused target preservation;
- Preview behavior;
- RH preservation;
- active action preservation/cancellation;
- camera viewport mapping rule;
- reduced simultaneous disclosure.

No responsive state may create new product semantics.

---

# 13. Required Interruption Matrix

Create a deterministic matrix for at least:

1. Preview + spatial input
2. Preview + new temporal input
3. Preview + Return Live
4. Camera motion + new camera act
5. Camera motion + Back
6. Camera motion + Return World
7. Historical transition presentation + new TC
8. Historical transition presentation + Return Live
9. P3a presentation + new explicit act
10. Responsive breakpoint/rotation during interaction
11. reduced-motion preference change during session
12. no-op activation during in-flight presentation

Columns:

- authoritative state before;
- incoming act;
- semantic authority;
- presentation cancellation/retarget;
- RH effect;
- final state;
- forbidden stale artifact.

---

# 14. Mandatory Tests

Execute all tests from the approved Pre-Flight Gate:

- MA-01…MA-09
- AX4-01…AX4-08
- RP-01…RP-04

Add:

## X64-01 — animation-duration attack
Same semantic action at 0 ms, short motion and long motion.

Expected:
identical semantic final state and RH.

## X64-02 — frame-interruption attack
Interrupt at 10%, 50%, 90% of presentation.

Expected:
same transaction rules; no animation-frame checkpoint.

## X64-03 — false overlap attack
Projection change where R2 becomes unavailable and R1 becomes historically current.

Expected:
no frame communicates R1 and R2 as simultaneously current.

## X64-04 — acceleration-is-not-coarse-step
Hold forward input long enough to accelerate traversal.

Expected:
every semantic advancement remains one-Moment adjacency; no “large step” command or exposed unit appears.

## X64-05 — unknown-remainder reach
Large unknown distance to LH.

Expected:
practical traversal can continue without computing/exposing a remaining count as a UI semantic.

## X64-06 — rotation during Preview
Responsive breakpoint changes while `PTC` exists.

Expected:
Preview either deterministically survives with same target or is cancelled under an explicit presentation rule; no hidden commit/RH.

## X64-07 — reduced-motion historical projection
Large truth change across TC with motion disabled.

Expected:
correct projection is immediately understandable; no future ghost or lost orientation.

## X64-08 — screen-reader future leak
PINNED state with 100 later Moments.

Expected:
no total/set-size/range/focus enumeration reveals them.

## X64-09 — P3a modality parity
Pointer, touch, keyboard/non-pointer all invoke the same two semantic act kinds.

Expected:
same settle/locus/RH behavior.

## X64-10 — mobile return semantics
Narrow interface with re-composed chrome.

Expected:
Back / Return Live / Return World meanings unchanged.

---

# 15. Proof Artifacts

Create only proof artifacts necessary for Architecture review.

At minimum:

## Board A — Motion + Interruption

Prove:
- motion optionality;
- zero-motion parity;
- historical projection transition;
- no future ghost;
- camera interruption;
- Back during motion;
- Preview cancel;
- lifecycle current-state transition vs historical projection;
- IF divergence onset;
- responsive breakpoint interruption.

## Board B — Accessibility + Responsive Reach

Prove:
- chosen accessible topology;
- PINNED future firewall;
- Live vs latest;
- P3a two acts;
- relative progressive traversal;
- long-session accelerated repetition;
- no coarse semantic step;
- pointer/touch/non-pointer parity;
- mobile/narrow recomposition;
- Dormant / IF distinctions nonvisually.

Boards are proof scaffolding only.

---

# 16. Required Stage 6.4 Candidate Package

Return:

# `QANDEEL_STAGE6_4_MOTION_A11Y_RESPONSIVE_CANDIDATE_v1`

containing:

1. Authorization compliance
2. Research inventory
3. Research synthesis
4. Frozen cross-surface constraint register
5. OPEN-10 event/state matrix
6. Motion classification
7. Recommended minimum motion contract
8. Reduced/no-motion contract
9. Historical projection transition contract
10. Lifecycle transition-motion contract
11. IF divergence-motion contract
12. Camera/Return motion contract
13. Preview-motion contract
14. Accessibility topology option space
15. Accessibility comparative matrix
16. Recommended platform-neutral accessible topology
17. Timeline accessible semantics
18. P3a accessible semantics
19. Long-session reach option space
20. Long-session reach comparative matrix
21. Recommended reach grammar
22. Pointer/touch topology
23. Responsive re-composition matrix
24. Responsive state-preservation contract
25. Interruption matrix
26. No-hindsight accessibility audit
27. Reduced-motion audit
28. Mobile/narrow audit
29. MA-01…MA-09 results
30. AX4-01…AX4-08 results
31. RP-01…RP-04 results
32. X64-01…X64-10 results
33. Board A
34. Board B
35. MUST
36. MUST NOT
37. SHOULD / MAY
38. Implementation-readiness outputs for Stage 6.5
39. Remaining presentation/polish details
40. Architecture Review Handoff

Also include:

## Stage 6.4 Decision Index

```text
OPEN-10 → decision → why
ACCESSIBILITY TOPOLOGY → decision → why
LONG-SESSION REACH → decision → why
RESPONSIVE CONTRACT → decision → why
INTERRUPTION MODEL → decision → why
```

Do NOT self-declare Stage 6.4 frozen.

---

# 17. Architecture Stop Rule

STOP and report rather than inventing a product rule if a viable solution requires:

- animation timing as commit/state authority;
- motion as the sole semantic carrier;
- future ghosting during historical transition;
- simultaneous-current version overlap;
- historical replay of unavailable future lifecycle state;
- future Moment enumeration;
- full-session PINNED range metadata leak;
- a semantic coarse temporal step;
- hidden third temporal mode;
- modifier/hover-only P3a route;
- responsive Map relayout;
- new RH semantics;
- changing Stage 6.2 / 6.3 frozen meaning.

If all obligations can be met within frozen semantics, return the candidate package for Architecture review.

No coding is authorized.
