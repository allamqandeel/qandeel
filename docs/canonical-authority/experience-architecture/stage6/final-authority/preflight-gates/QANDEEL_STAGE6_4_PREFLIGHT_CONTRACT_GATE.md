# QANDEEL — Stage 6.4 Pre-Flight Contract Gate
## Motion + Accessibility + Responsive Experience Contract

**Status:** PRE-FLIGHT ONLY  
**Stage:** 6 — Experience Closure + Implementation Readiness  
**Active Task:** 6.4 — Motion + Accessibility + Responsive Experience Contract

**Upstream authority:**
- Stages 0–5 CLOSED / FROZEN
- Stage 6.1 CLOSED / FROZEN
- Stage 6.2 CLOSED / FROZEN
- Stage 6.3 CLOSED / FROZEN

**Stage 6.4 owns:**
- OPEN-10 — motion
- final accessible interaction topology / semantics needed for v1
- non-pointer / keyboard / assistive reach equivalence
- pointer/touch target topology
- responsive / mobile interaction expression
- transition/interruption rules where presentation mechanics must be fixed for implementation

Do NOT execute design yet.
Do NOT modify the repository.
Do NOT code.
Do NOT reopen Stage 6.2 or 6.3 semantics.
Do NOT revive OPEN-06 / 08 / 09 / 19.

Return only the requested Pre-Flight Readiness Report, then STOP.

---

# 1. Purpose

Stage 6.4 closes the final cross-surface Experience contract before Implementation Contract work.

It must ensure that the already-frozen system remains:

- understandable with motion;
- understandable with reduced/no motion;
- operable by pointer;
- operable by touch;
- operable by keyboard/non-pointer interaction;
- truthful to assistive technology;
- stable on mobile/narrow surfaces;
- interruption-safe.

Stage 6.4 does NOT invent new product semantics.

It defines how already-authorized semantics are carried across input, presentation and accessibility modalities.

---

# 2. Frozen Upstream Decisions — Do Not Reopen

Stage 6.4 consumes:

## Timeline
- ordinal constant-step metric;
- windowing;
- relative progressive traversal;
- `Moment(LH)` vs outboard non-metric `LIVE_EDGE`;
- Preview / Commit / Settle;
- P3a dual explicit acts;
- no aggregation in v1;
- no future enumeration while pinned.

## Historical Map
- fixed Established Thread Home loci;
- no historical relayout/compaction/camera rescue;
- object-intrinsic lifecycle channel;
- Dormant presence floor;
- Reopened current-state only;
- no sparseness-triggered cue;
- content-independent projection-state orientation;
- OPEN-17 stability bounds;
- retained `IF_ref` / historically correct `IF_render`;
- no unavailable miniature/ghost;
- IF-D vs IF-E semantic distinction.

## Returns
- Back One Step;
- Exact Return;
- Return to Live Head;
- Return to Live Focus;
- Return to World;
- Go Live + Locate;
- one-shot binding rules;
- RH transaction boundaries.

Stage 6.4 expresses these; it does not redefine them.

---

# 3. OPEN-10 — Motion Scope

Stage 6.4 must decide the **minimum semantic motion contract**, not a final animation style guide.

Motion may help communicate:

- continuity;
- state change;
- navigation direction;
- Preview vs committed state;
- appearance/disappearance of legitimately entitled material;
- lifecycle state transition;
- IF divergence onset/clearance;
- Return / Exact Return;
- camera movement when explicitly authorized.

Motion MUST NOT:

- manufacture geometry;
- imply relation;
- imply causality;
- imply confidence;
- imply importance;
- expose future direction/location;
- reveal unavailable material before entitlement;
- become the only carrier of a semantic distinction.

Every frozen distinction must survive:

```text
prefers reduced motion
or
motion disabled
```

---

# 4. Motion Authority Categories

The Pre-Flight report must understand these categories.

## M4-A — Motion REQUIRED for semantics
Presumption: NONE.

If any semantic meaning appears to require motion as its sole carrier:
report an Architecture problem.

## M4-B — Motion MAY REINFORCE an already-frozen distinction
Potential examples:
- transition between committed temporal states;
- object truth appearing/disappearing after temporal projection changes;
- lifecycle current-state transition;
- retained-reference divergence onset;
- authorized camera navigation.

## M4-C — Motion FORBIDDEN
Motion that:
- anticipates future unavailable truth;
- drags objects toward future loci;
- morphs one canonical identity into another;
- makes a relation appear before relation entitlement;
- makes a no-op look like a state change;
- performs passive camera rescue.

---

# 5. Preview / Commit / Settle Motion Boundary

Preview is transient and noncanonical.

Motion must not blur:

```text
Preview state
vs
Committed state
```

Stage 6.4 must determine:

- how transient Preview is distinguishable;
- what happens when Preview is cancelled;
- what happens when a spatial action cancels Preview;
- whether any settle transition exists;
- how interruption avoids leaving a stale visual intermediate.

No Preview animation may:
- write RH;
- imply hidden commit;
- reveal beyond `P(PTC)`;
- continue after Preview cancellation.

---

# 6. Temporal Projection Change

When `TC` changes:

- Map truth may change;
- Established Home loci do not move;
- camera does not move unless independently authorized.

Stage 6.4 must define whether appearance/disappearance/state-change transitions:

- animate;
- crossfade;
- resolve immediately;
- or use another bounded presentation strategy.

The strategy must preserve:

- no future ghosting;
- no old/current truth overlap that implies simultaneous validity;
- no spatial drift;
- no hindsight leakage.

Reduced-motion behavior must remain fully understandable.

---

# 7. Lifecycle Motion

Stage 6.3 freezes lifecycle state structurally.

Motion may reinforce a transition, but:

- Active / Dormant / Reopened remain distinguishable without motion;
- Reopened gets no persistent history scar;
- motion must not narrate an unavailable past;
- lifecycle motion must not change Home locus, scale or importance;
- historical projection to an earlier TC must not “rewind” through future lifecycle events if those events are unavailable there.

Stage 6.4 must explicitly distinguish:

```text
transition animation caused by a newly committed legitimate state change
vs
rendering a historical projection at TC
```

The latter must not replay unavailable transition history.

---

# 8. Sparse / Projection-State Motion

Stage 6.3 freezes:

- no sparseness-triggered cue;
- projection-state orientation independent of field content.

Therefore its motion/appearance MUST NOT vary with:

- field density;
- missing count;
- future-unavailable object identities.

If the projection-state orientation expression animates at all, its behavior must derive only from the temporal/orientation state that is legitimate to communicate.

It cannot “wake up” because the Map became empty.

---

# 9. IF Divergence Motion

`IF_ref` / `IF_render` divergence is a standing derived relationship.

Motion may reinforce onset/clearance but must never:

- show the unavailable requested version;
- morph historical R1 into future R2 if R2 is unavailable at TC;
- imply overwrite;
- move camera;
- substitute context;
- turn a standing state into a fleeting notice.

Reduced/no-motion state must remain fully legible.

---

# 10. Return / Camera Motion

When a frozen action authorizes camera movement:

motion must preserve the exact semantic destination and transaction boundary.

Stage 6.4 must define:

- interruption policy;
- new navigation action during an in-flight camera movement;
- Back during motion;
- Preview during motion if allowed;
- whether the semantic state commits at activation, settle, or an already-frozen boundary;
- what the user sees if the animation is skipped/reduced.

Motion timing MUST NOT become semantic authority.

The state machine remains frozen upstream.

---

# 11. Accessibility — Epistemic Parity

Nonvisual surfaces must obey the same truth boundary as visual surfaces.

Stage 6.4 must build the accessible topology without leaking:

- future Moment count;
- future set size;
- future range extent;
- future identity;
- future context;
- future lifecycle history;
- future locus/direction.

No platform role may be chosen merely because it is conventional if its required metadata violates QANDEEL epistemics.

---

# 12. Accessible Timeline Topology

Stage 6.4 owns the final v1 topology.

It must support:

- ordinary temporal targeting;
- absolute `Moment(LH)` vs `LIVE_EDGE`;
- relative progressive traversal past `TC`;
- P3a temporal-only vs Temporal+Locate acts;
- Preview / Commit / Cancel;
- Return to Live;
- current temporal-mode legibility.

It MUST NOT:

- enumerate future Moments;
- expose post-TC set size;
- silently revive coarse stepping;
- create a hidden third mode.

The Pre-Flight must explicitly recognise that Stage 6.2 left open whether any bounded-range semantics are valid:
- for a restricted disclosed region;
- under FOLLOW_LIVE;
- or not at all.

Do not decide this in Pre-Flight.

---

# 13. Long-Session Reach Equivalence

This is a v1 obligation.

A user who does not use a pointer must still be able to reach legitimate temporal targets in a long Session.

But Stage 6.1 deferred OPEN-08 coarse stepping beyond v1.

Therefore Stage 6.4 must solve:

> practical reach without introducing a coarser temporal semantic unit.

Candidate mechanisms may involve:
- continuous key repeat;
- accelerated repetition of the same one-Moment unit;
- direct target selection within disclosed/windowed structure;
- search-like navigation only if already semantically authorized;
- another topology that preserves one-Moment semantics.

Do NOT assume a coarser step.

If practical reach cannot be solved without OPEN-08:
STOP and report new dependency evidence.

---

# 14. Pointer / Touch Topology

Stage 6.4 owns:

- hit areas;
- pointer target sizing;
- touch target sizing;
- gesture collision;
- affordance spacing;
- hover-independent access;
- accidental activation resistance.

It does not own temporal semantics.

P3a Temporal+Locate:
- must remain a distinct explicit act;
- must not rely solely on hover/modifier/long-press;
- may have accelerators in addition to the primary route.

---

# 15. Responsive / Mobile Contract

Mobile may reduce simultaneity.

It must preserve:

- canonical Map geography;
- temporal semantics;
- lifecycle state;
- projection-state orientation;
- IF divergence;
- Live vs pinned distinction;
- return semantics;
- accessibility truth.

Stage 6.4 must define responsive re-composition without semantic re-layout.

Important distinction:

```text
UI chrome may recompose responsively
while
canonical Map geography does not.
```

Do not confuse interface layout with world geometry.

---

# 16. Interruption / Cancellation

Motion and input can overlap.

Stage 6.4 must define deterministic presentation behavior for at least:

- Preview cancelled by spatial input;
- new temporal act during Preview;
- new camera act during camera motion;
- Back during motion;
- Return to Live during historical projection transition;
- P3a while a previous presentation transition is visually settling;
- device rotation / responsive breakpoint during interaction.

No interruption may:
- create extra RH entries;
- cause hidden commits;
- leave stale projection content;
- change action semantics.

---

# 17. Required Adversarial Tests

Confirm understanding now; execute only after authorization.

## MA-01 — Motion removed
All state distinctions remain understandable.

## MA-02 — Reduced motion
No semantic loss; no timing dependency.

## MA-03 — Future ghost attack
Historical projection transition must not leave future-unavailable material visible during fade/morph.

## MA-04 — Supersession overlap
Transition must not make two versions appear simultaneously current.

## MA-05 — Lifecycle rewind attack
Moving to earlier TC must not replay future-known Dormant/Reopened history.

## MA-06 — Camera movement interrupted
New explicit camera act during in-flight motion yields one deterministic destination and RH result.

## MA-07 — Back during motion
Back reverses transaction semantics, not animation frames.

## MA-08 — Preview cancelled mid-animation
PTC/disclosure vanish correctly; no stale preview content.

## MA-09 — No-op motion
True no-op produces no semantic-change animation that implies state changed.

## AX4-01 — Full-session slider leak
Any topology exposing post-TC max/value/extent is rejected.

## AX4-02 — Future focus-stop leak
No future Moment enumeration in accessible tree.

## AX4-03 — Live vs latest
Nonvisual user can intentionally choose PINNED(LH) vs FOLLOW_LIVE.

## AX4-04 — P3a
Non-pointer user can intentionally choose temporal-only vs Temporal+Locate.

## AX4-05 — Forward reach
PINNED user can advance beyond TC without future count/set-size disclosure.

## AX4-06 — Long-session practicality
Non-pointer user can practically reach distant legitimate material without coarse semantic stepping.

## AX4-07 — Dormant semantics
Dormant is announced as present/lifecycle state, not disabled/unavailable.

## AX4-08 — IF cases
IF-A/B/C do not leak unavailable identity/version/context; IF-D and IF-E remain distinct.

## RP-01 — Narrow Map
Canonical geography unchanged.

## RP-02 — Narrow Timeline
Same target meanings; less simultaneous exposure only.

## RP-03 — Breakpoint during interaction
Responsive recomposition does not alter state/target/RH.

## RP-04 — Orientation chrome
Projection-state / IF chrome may recompose but content truth remains identical.

---

# 18. Research Decision

Pre-Flight must decide whether targeted research is necessary for:

- motion accessibility / reduced-motion guidance;
- animation and object constancy;
- accessible composite/range control patterns;
- keyboard long-range navigation without semantic coarse steps;
- pointer/touch target guidance;
- responsive accessibility of complex spatial interfaces;
- interruption/cancel semantics in direct-manipulation systems.

If research is required:
- keep it targeted;
- use authoritative accessibility/platform sources where possible;
- use HCI research only for questions the standards do not answer.

Do not repeat Stage 6.2/6.3 research unnecessarily.

---

# 19. Forbidden Interpretations

## F64-01
Motion is not semantic state.

## F64-02
Animation timing is not commit authority.

## F64-03
Reduced motion may not remove meaning.

## F64-04
No future ghost/fade.

## F64-05
No historical transition replay that leaks later knowledge.

## F64-06
No full-session pinned range exposing future extent.

## F64-07
No future focus-stop enumeration.

## F64-08
No coarse-step revival.

## F64-09
No hidden P3a modifier-only route.

## F64-10
No responsive Map relayout.

## F64-11
No ARIA/platform role frozen before compatibility analysis.

## F64-12
No reopening Stage 6.2/6.3 semantics.

## F64-13
No repo change/code.

---

# 20. Required Pre-Flight Readiness Report

Return ONLY:

## 1. Canonical understanding
What 6.4 is / is not.

## 2. Frozen upstream boundary
Summarize the Stage 6.2 / 6.3 contracts 6.4 must consume.

## 3. OPEN-10 understanding
Explain minimum semantic motion vs final animation polish.

## 4. Motion-state boundary
Explain why state/transaction authority cannot depend on animation timing.

## 5. Accessibility problem
Explain the no-hindsight constraints on Timeline/control topology.

## 6. Long-session reach
Explain why practical reach is required while coarse stepping remains deferred.

## 7. Responsive boundary
Explain chrome recomposition vs canonical Map geography.

## 8. Interruption model
State what must remain deterministic under overlapping input/motion.

## 9. Tests
Confirm MA-01…09, AX4-01…08, RP-01…04 understood; name no more than five most discriminating.

## 10. Research necessity
Return exactly:
- `TARGETED RESEARCH REQUIRED`
or
- `NO NEW RESEARCH REQUIRED`

Do not conduct it yet.

## 11. Blocking ambiguities
If none:
**Blocking ambiguities: NONE.**

## 12. Execution plan
Maximum five bullets.

Then STOP.

---

# 21. Current Board

```text
Stages 0–5                              CLOSED / FROZEN
Stage 6.1 — OPEN Triage                CLOSED / FROZEN
Stage 6.2 — Timeline Completion        CLOSED / FROZEN
Stage 6.3 — Historical Map Completion  CLOSED / FROZEN
Stage 6.4 — Motion + A11y + Responsive PRE-FLIGHT
```

No coding is authorized.
