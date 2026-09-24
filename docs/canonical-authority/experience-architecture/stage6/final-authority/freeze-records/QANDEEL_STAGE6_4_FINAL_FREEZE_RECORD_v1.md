# QANDEEL — Stage 6.4 Final Freeze Record v1
## Motion + Accessibility + Responsive Experience Contract

**Status:** CLOSED / FROZEN  
**Date:** 2026-09-03  
**Stage:** 6 — Experience Closure + Implementation Readiness  
**Task:** 6.4 — Motion + Accessibility + Responsive Experience Contract  
**Authority:** Product / Experience / Architecture  
**Approved Candidate:** `QANDEEL_STAGE6_4_MOTION_A11Y_RESPONSIVE_CANDIDATE_v2`

---

# 1. Final Architecture Verdict

The Stage 6.4 v2 package is APPROVED subject to the Architecture Freeze Clarifications in this record.

# **STAGE 6.4 — CLOSED / FROZEN**

No v3 candidate is required.

Stage 6.4 successfully closes:

- OPEN-10 — Motion;
- v1 cross-surface accessibility topology;
- non-pointer / keyboard reach requirements;
- pointer/touch interaction constraints;
- responsive recomposition semantics;
- presentation interruption/cancellation rules.

No frozen Stage 0–5 / 6.1 / 6.2 / 6.3 product semantics are reopened.

---

# 2. Package Integrity Review

Reviewed:

- `STAGE6_4_MOTION_A11Y_RESPONSIVE_CANDIDATE_v2.md`
- `START_HERE.md`
- `boards/S6.4_A_Motion_and_Interruption.png`
- `boards/S6.4_B_Accessibility_and_Reach.png`
- `SHA256SUMS.txt`

All recorded SHA256 digests match the extracted artifact bytes.

The proof boards are accepted as Experience proof scaffolding only.

They are not final visual design.

---

# 3. OPEN-10 — FINAL FREEZE
## Motion is optional reinforcement, never semantic authority

The set:

```text
M4-A — motion required as sole semantic carrier
```

is:

# **EMPTY**

Every QANDEEL semantic distinction must remain understandable when:

```text
motion = 0
```

Motion may reinforce an already-frozen semantic change.

Motion MUST NOT invent, decide or replace semantic state.

---

# 4. Semantic State vs Presentation Progress — FINAL FREEZE

Canonical invariant:

```text
semantic_state_transition
!=
animation_progress
```

Animation progress never decides:

- whether an action committed;
- whether RH was written;
- `TM`;
- `TC`;
- `IF_ref`;
- locate entitlement;
- camera destination authority;
- P5 post-live binding;
- Back semantics;
- Preview ownership.

`settle` is a state-machine boundary, not an animation-completion callback.

At:

```text
0 ms
short motion
long motion
reduced motion
motion disabled
```

the semantic result and RH result are identical.

---

# 5. Historical Projection Motion — FINAL FREEZE

When temporal projection changes:

# **THE NEW PROJECTION RESOLVES IMMEDIATELY**

No cross-state interpolation may depict false truth.

Forbidden:

- fade-out ghost of future-unavailable material;
- cross-fade between mutually exclusive current versions;
- connector persistence after relation entitlement ends;
- morph between current/historical versions;
- lifecycle rewind through later-unavailable history;
- camera drift merely to smooth disappearance.

A content-independent whole-surface settling treatment MAY exist as presentation-only reinforcement if:

- all legitimate truth has already resolved;
- it reveals no changed content;
- it has no semantic interpretation;
- it disappears under reduced/no-motion.

No per-object historical cross-state interpolation.

---

# 6. Newly Committed Live Changes vs Historical Projection

A newly committed legitimate Live fact may receive optional presentation reinforcement.

That does not authorize historical replay.

Canonical distinction:

```text
new legitimate Live transition
    may be reinforced

rendering K(TC)
    does not replay the history by which K(TC) was reached
```

This applies to:

- lifecycle state;
- object presence;
- relation presence;
- IF divergence.

---

# 7. Reduced / No-Motion — FINAL FREEZE

`motion = 0` is a first-class product condition.

Reduced/no-motion MUST preserve:

- temporal mode;
- Preview vs committed state;
- lifecycle state;
- projection orientation;
- IF divergence;
- camera destination;
- Return semantics;
- exact final truth.

A motion preference change during a session changes presentation only.

An in-flight animation may resolve immediately to the presentation of the already-authoritative semantic state.

No RH entry is created.

---

# 8. Presentation Control vs Authoritative Live State — FINAL FREEZE

Where accessibility requirements call for control of automatically moving/updating presentation:

the user may control the:

- motion;
- scrolling;
- updating presentation surface;
- presentation visibility/announcement behavior,

as applicable.

This does NOT pause:

- `LH`;
- committed conversational events;
- evidence ingestion;
- canonical Live analysis;
- authoritative runtime progression.

Canonical rule:

> **Presentation may pause; authoritative Live state continues.**

On resumption:

- presentation resolves to current authoritative truth;
- intermediate states are not replayed as historical animation;
- passive Live evolution writes no RH.

“Pause Live” is NOT a Stage 6.4 product semantic.

---

# 9. Architecture Freeze Clarification AF64-01
## Automatic-update announcement scope

Candidate wording equivalent to:

> automatically updating material is “never re-announced per commit”

must not be interpreted as a global prohibition on all QANDEEL announcements.

Canonical reading:

- Stage 6.4 forbids the **Timeline/Map orientation and auto-updating presentation chrome** from announcing every passive Live commit merely because the interface updated;
- it does not override separate Conversation, safety, notification, or future product contracts that may independently require announcing user-relevant content.

Any such announcement still obeys its own epistemic/accessibility contract.

Stage 6.4 controls the Living Analysis Map / Timeline presentation surface only.

---

# 10. Accessible Timeline Topology — FINAL FREEZE

The v1 platform-neutral topology is:

# **DISCLOSED-REGION TARGET NAVIGATOR
+ RELATIVE FORWARD ACTION
+ SEPARATE LIVE TARGET**

The disclosed-region target navigator:

- addresses only legitimately disclosed temporal targets;
- supports exact target selection;
- may virtualize/window focus;
- never requires publication of undisclosed membership;
- does not include future-unavailable targets.

The relative forward action:

- is repeatable;
- exposes no remaining count;
- earns later Preview disclosure one Moment at a time.

The Live target:

- is separately reachable;
- is separately nameable by intent;
- is not a position after `Moment(LH)`.

No platform role is frozen here.

---

# 11. Accessible Metadata Firewall — FINAL FREEZE

No quantity or membership metadata may be exposed when its value depends on:

- undisclosed material;
- future-unavailable Moments;
- post-horizon membership.

Forbidden future-relative disclosures include:

- total;
- set size;
- position in future set;
- remaining count;
- future range extent;
- progress ratio;
- distance-to-Live;
- hidden future focus-stop membership.

Information derived solely from already-disclosed material is not forbidden merely because it is quantitative.

A platform mapping still must prove that its metadata does not create another semantic side channel.

---

# 12. Platform Mapping — FINAL FREEZE

The product contract does NOT require the target navigator to be:

- a slider;
- a numeric range;
- a listbox;
- a grid;
- a tree.

A platform-specific mapping MAY use one of these only if Stage 6.5 proves:

1. required metadata is epistemically legal;
2. undisclosed membership is not exposed;
3. Live remains a separate intent;
4. forward continuation remains non-metric;
5. P3a dual acts remain available;
6. virtualization/focus behavior remains stable.

Platform convention never overrides QANDEEL truth.

---

# 13. Long-Session Reach — TWO AXES, FINAL FREEZE

The v1 grammar has two independent movement axes.

## A. Temporal traversal — semantic

Moves temporal Preview/cursor.

Semantic unit:

# **ONE MOMENT**

Held activation/input duration may accelerate repetition of that same one-Moment advancement.

It is used for:

- adjacent temporal traversal;
- Preview;
- earned forward disclosure beyond TC.

No named/selectable semantic unit larger than one Moment exists in v1.

## B. Disclosed-region window navigation — presentation

Moves only the Timeline presentation window through material already inside the disclosure horizon.

It MUST NOT:

- change `TM`;
- change `TC`;
- create/change `PTC`;
- select a Moment;
- write RH;
- create a temporal semantic unit;
- cross into undisclosed post-TC structure.

After the desired disclosed region is visible:

the user explicitly selects the exact Moment under the frozen temporal grammar.

This is not OPEN-08.

---

# 14. Architecture Freeze Clarification AF64-02
## “Window navigation” must actually satisfy practical long-distance reach

The v2 candidate correctly fixes the semantic category error:

> a screenful of **presentation window** is not a coarse temporal step.

However, the worked REV64-AT-01 trace overstates what repeated fixed-size screenful movement alone proves.

Repeated page/screenful commands can still become impractical for arbitrarily long disclosed histories.

Therefore Stage 6.4 freezes a stronger functional requirement:

# **PRACTICAL DISCLOSED-REGION REPOSITIONING**

The Stage 6.5 platform mapping MUST provide a way to reposition the Timeline presentation window efficiently across a very large **already-disclosed** region without:

- temporally traversing every intervening Moment;
- creating a coarse temporal semantic unit;
- requiring one discrete command per Moment;
- exposing undisclosed future material.

The mechanism may be platform-specific, for example:

- direct scroll-position manipulation;
- scrollbar/scroll-thumb behavior over the disclosed presentation extent;
- accessible presentation-position control;
- accelerated presentation-window scrolling;
- Home/End/page/window combinations;
- another equivalent presentation-only navigator.

This list is illustrative, not frozen UI.

Canonical distinction:

```text
large presentation reposition
    = allowed

large temporal cursor step
    = OPEN-08 / not in v1
```

## 14.1 Practicality acceptance rule

Stage 6.5 must NOT claim AX4-06 satisfied merely because:

- key repeat exists;
- PageUp/PageDown exists;
- the number of commands is lower than the number of Moments.

It must show a concrete platform mapping that remains practically usable at large disclosed sizes.

`REV64-AT-01` remains valid as a **semantic-safety** test for window navigation.

Its claim of ergonomic/practical sufficiency is superseded by this clarification.

---

# 15. Post-TC Boundary — FINAL FREEZE

While pinned:

window navigation may operate only inside the current disclosure horizon.

It must never leap into undisclosed post-TC structure.

For:

```text
TC < m <= LH
```

the only v1 mechanism that earns Timeline disclosure remains:

# **RELATIVE PROGRESSIVE ONE-MOMENT TRAVERSAL**

Window navigation cannot substitute for earned disclosure.

---

# 16. Held Acceleration — FINAL FREEZE

QANDEEL v1 selects held activation as a primary non-dragging route for relative continuation.

Canonical rule:

> **Rate may accelerate; semantic unit does not.**

Acceleration:

- depends on input duration;
- is bounded;
- repeats one-Moment advancement;
- does not depend on remaining distance;
- does not expose a remaining count.

The chosen held-activation route is a QANDEEL product decision.

Accessibility standards require a suitable non-dragging equivalent where applicable; they do not uniquely mandate held activation itself.

---

# 17. Pointer / Touch — FINAL FREEZE

Every function that is otherwise available only through drag/path/multipoint gesture must have a single-pointer non-dragging equivalent.

No essential semantic act may be:

- hover-only;
- drag-only;
- modifier-only;
- long-press-only;
- path-gesture-only.

For discrete activation, the preferred v1 pattern is cancellable activation with commit on completion/up/equivalent accessible activation.

For continuous Preview:

- pointer-down/movement may create transient Preview;
- release may commit under the frozen grammar;
- cancellation discards Preview;
- no down-event may create an irreversible semantic commit.

Final event mapping remains platform-specific.

---

# 18. P3a Modality Parity — FINAL FREEZE

Both semantic act kinds:

```text
temporal-only
temporal + locate
```

must be intentionally available in:

- pointer;
- touch;
- keyboard;
- non-pointer / assistive interaction.

They must be distinguishable before invocation.

Accelerators may supplement them.

Accelerators never replace the primary accessible route.

---

# 19. Interruption — FINAL FREEZE

Canonical rule:

# **PRESENTATION RETARGETS; TRANSACTIONS ARE NOT REWRITTEN**

A newer authoritative user act may cancel or retarget in-flight presentation.

It does not:

- split an existing transaction;
- merge two acts;
- create an animation-frame RH checkpoint;
- change the semantic boundary of the earlier act.

Back reverses the latest effective transaction.

It never reverses animation frames.

---

# 20. Preview Interruption — FINAL FREEZE

Existing frozen rules remain authoritative.

Spatial input during Preview:

1. cancels Preview;
2. discards `PTC`;
3. withdraws transient disclosure;
4. writes no Preview RH;
5. executes the spatial act from committed state.

A new temporal Preview may supersede the prior Preview target without RH.

Return to Live during Preview executes from committed authoritative state, not from `PTC`.

---

# 21. Responsive Preview Rule — FINAL FREEZE

# **RESPONSIVE RECOMPOSITION ALONE DOES NOT CANCEL PREVIEW**

On breakpoint / resize / orientation change:

```text
PTC survives
Preview target identity survives
TM/TC remain committed state
RH unchanged
```

The interface remaps the same Preview target.

If the platform independently terminates the active input stream:

that event is an **input cancellation event**, not a responsive-layout semantic rule.

Then:

- discard `PTC`;
- withdraw transient disclosure;
- no commit;
- no RH.

Canonical split:

```text
layout recomposition alone
    → preserve Preview

actual input-stream cancellation
    → cancel Preview
```

---

# 22. Responsive Chrome vs Map Geography — FINAL FREEZE

Responsive UI chrome may:

- move on screen;
- regroup;
- reorient;
- reduce simultaneous disclosure;
- change panel extent;
- change presentation order.

Canonical Map geography may NOT:

- repack;
- re-anchor;
- compact;
- move Established Home loci;
- move semantic neighbourhood coordinates.

Responsive interface layout is not world geometry.

---

# 23. Architecture Freeze Clarification AF64-03
## Canonical camera intent vs device viewport envelope

Candidate clauses RC-P1 and RC-P6 can appear contradictory if `MC` is read as the exact pixel/device viewport footprint:

- RC-P1 says `MC` is untouched;
- RC-P6 allows visible extent/aspect to change with the device.

Canonical interpretation:

## A. Navigation-authored camera intent

Responsive recomposition preserves the camera's authoritative world reference:

- camera anchor / reference point;
- world orientation;
- semantic depth;
- zoom/scale intent;
- user-authored spatial destination.

No responsive breakpoint is a navigation act.

It writes no RH.

## B. Device presentation envelope

The physical screen / panel geometry may change:

- width;
- height;
- aspect ratio;
- clipping envelope.

Therefore the **derived visible world footprint** may contain more/less surrounding geography.

That derived footprint change is a presentation consequence of the surface geometry, not a Map relayout and not a camera-navigation transaction.

Canonical rule:

```text
responsive surface changes
    may change derived visible footprint

but MUST NOT
    move world anchors
    recenter to content
    refit the Map
    change semantic depth
    invent a new camera destination
```

If implementation models `MC.region` as a derived footprint, that footprint may be recomputed from the preserved camera intent + current surface geometry without an RH write.

This does not create a new member of `S`.

---

# 24. Exact Return Under Responsive Geometry — FINAL CLARIFICATION

Exact Return continues to restore the exact stored semantic/navigation camera intent.

On the same presentation geometry:

- the same visible footprint is restored.

On a different device/aspect ratio:

- the same world reference / scale intent / depth / target is restored;
- the current surface envelope derives the visible footprint.

Responsive geometry does not authorize content-fit, recentering, or semantic reinterpretation.

This is the only device adaptation permitted.

---

# 25. No-Op — FINAL FREEZE

A true no-op:

- creates no RH transaction;
- creates no semantic-change animation;
- does not acquire a special acknowledgement state.

OPEN-19 remains deferred beyond v1.

Normal control/state feedback may remain available, but it cannot imply that state changed.

---

# 26. Final Accessibility / Responsive Acceptance Invariants

Stage 6.5 and implementation must preserve:

1. no future Moment enumeration;
2. no post-horizon membership exposure;
3. Live vs latest intent distinction;
4. P3a act parity;
5. practical disclosed-region reach;
6. earned post-TC traversal;
7. Dormant as present, not disabled;
8. IF-A/B/C knowledge gating;
9. IF-D vs IF-E distinction;
10. reduced/no-motion parity;
11. responsive Preview preservation;
12. responsive Map-geography invariance;
13. presentation interruption without RH mutation.

---

# 27. Verification Result

The v2 package plus this Freeze Record resolves the Architecture Ruling without requiring:

- third temporal mode;
- coarse temporal semantic step;
- future enumeration;
- future range leak;
- motion as sole carrier;
- animation timing as state authority;
- responsive-layout semantic authority;
- Map relayout;
- new RH semantics;
- reopening Stage 6.2 / 6.3.

The v2 tests remain accepted, with one important interpretation:

- `REV64-AT-01` proves **semantic safety** of presentation-only window navigation;
- practical large-scale window reach remains a concrete Stage 6.5 platform-mapping acceptance obligation under AF64-02.

---

# 28. Final OPEN Status After Stage 6.4

## RESOLVED / FROZEN

- OPEN-10 — Motion

All Stage 6.1 v1 Experience OPENs selected for closure have now been resolved at the Experience-contract level.

## Deferred beyond v1

- OPEN-06 — in-session bookmarks
- OPEN-08 — coarse temporal step
- OPEN-09 — object-originated version jump
- OPEN-19 — dedicated no-op acknowledgement

## Stage 6.5 obligation

OPEN-17's Experience bounds are frozen.

The final reversible implementation-seam proof remains mandatory in Stage 6.5.

---

# 29. Current Stage Status

```text
Stages 0–5                                  CLOSED / FROZEN
Stage 6.1 — OPEN Triage                    CLOSED / FROZEN
Stage 6.2 — Timeline Completion            CLOSED / FROZEN
Stage 6.3 — Historical Map Completion      CLOSED / FROZEN
Stage 6.4 — Motion + A11y + Responsive     CLOSED / FROZEN
Stage 6.5 — Implementation Contract        NEXT
```

No coding is authorized by this freeze.

---

# 30. Authority Precedence

For Stage 6.4 interpretation:

```text
This Final Freeze Record
    >
Stage 6.4 Candidate v2
    >
Proof-board shorthand
    >
Research examples
```

AF64-01…AF64-03 are binding Architecture clarifications.

They intentionally prevent narrow candidate wording from over-constraining later implementation or from claiming a practicality proof stronger than the evidence supports.
