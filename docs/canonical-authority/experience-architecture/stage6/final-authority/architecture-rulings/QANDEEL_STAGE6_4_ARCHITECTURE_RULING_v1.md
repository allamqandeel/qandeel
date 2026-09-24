# QANDEEL — Stage 6.4 Architecture Review Ruling v1
## Motion + Accessibility + Responsive Experience Contract — Targeted Revision

**Architecture Verdict:** TARGETED REVISION REQUIRED  
**Base Candidate:** `QANDEEL_STAGE6_4_MOTION_A11Y_RESPONSIVE_CANDIDATE_v1`  
**Scope:** Two load-bearing corrections + four wording/authority narrowings  
**Research:** APPROVED — do not repeat  
**Repo:** no coding / no tracked changes

Do NOT redo Stage 6.4 from scratch.

Preserve all unaffected research, matrices, tests and proof evidence.

---

# 1. APPROVED DIRECTIONS

Architecture APPROVES the following candidate directions.

## A64-01 — M4-A is empty

No QANDEEL semantic distinction requires motion as its sole carrier.

Motion is presentation reinforcement only.

Every semantic distinction must remain understandable when:

```text
motion = 0
```

APPROVED.

---

## A64-02 — Semantic state is independent of animation progress

The candidate rule is APPROVED:

```text
semantic_state_transition
!=
animation_progress
```

Animation timing does not decide:

- commit;
- RH;
- TM;
- TC;
- IF_ref;
- locate entitlement;
- P5 binding;
- Back semantics;
- authoritative destination.

`settle` remains a state-machine boundary, not an animation event.

---

## A64-03 — Historical projection resolves without cross-state interpolation

APPROVED:

- no fade-out ghost of future-unavailable truth;
- no cross-fade between mutually exclusive current versions;
- no relation persistence past entitlement;
- no lifecycle rewind into future-known history;
- no camera drift merely to smooth historical truth changes.

Historical projection resolves directly to the new legitimate truth.

A content-independent whole-surface settling treatment MAY remain presentation-only if it asserts no semantic fact and disappears under reduced motion.

---

## A64-04 — Accessible structure must be epistemically derived

APPROVED:

- no full-session `PINNED` range exposing post-TC extent;
- no future Moment enumeration;
- no future set-size / position-in-set;
- separate Live intent;
- separate forward continuation;
- P3a act distinction preserved;
- no platform role chosen by convention first.

---

## A64-05 — Rate is not a semantic unit

APPROVED:

The v1 temporal traversal unit remains:

# **ONE MOMENT**

Duration-driven repetition may increase the rate at which the same one-Moment advancement repeats.

No named/selectable semantic unit larger than one Moment is introduced.

OPEN-08 remains deferred.

---

## A64-06 — Interruption is presentation-level

APPROVED except for REV-64-02 below.

A newer authoritative act may cancel or retarget presentation.

It does not create animation-frame checkpoints or rewrite prior RH transaction semantics.

Back reverses the latest effective transaction, not presentation frames.

---

# 2. REV-64-01 — AX4-06 PRACTICAL LONG-SESSION REACH IS NOT YET PROVEN

## Candidate result

The candidate marks:

```text
AX4-06 — PASS
```

primarily because:

1. held repetition accelerates by duration;
2. direct routes cover some long-distance destinations;
3. platform repeat is familiar/native.

The package also states an equivalent of:

> bounded duration-based acceleration makes traversal time grow far more slowly than n.

That is not sufficient as the v1 practical-reach proof.

---

## Why the proof is incomplete

With a **bounded maximum repeat rate**, traversing an arbitrary distant Moment by repeated one-Moment advancement remains proportional to the number of Moments once the rate cap is reached.

Acceleration improves the constant factor.

It does not eliminate the long-distance traversal problem.

The direct routes cited by the candidate cover:

- Return to Live Head;
- Back;
- Exact Return;
- already-visible/disclosed targets.

They do NOT by themselves provide practical random reach to an arbitrary distant **already-disclosed historical Moment** that is outside the current Timeline window and has not previously been visited.

Therefore:

> `rate, not unit` remains a correct rule for semantic traversal, but **rate alone cannot carry AX4-06**.

---

## Architecture correction

Stage 6.2 already froze **windowing** as presentation-only:

- the Track geometry remains ordinal;
- window movement changes simultaneity/visibility only;
- window movement does not change target identity;
- window movement does not write RH;
- window movement does not commit TC.

Stage 6.4 must use that distinction.

The v1 long-session reach grammar must contain TWO independent mechanisms:

### A. Temporal traversal

Used for:
- adjacent navigation;
- Preview;
- earned forward disclosure beyond TC.

Semantic unit:

```text
one Moment
```

Held duration-based acceleration may repeat it faster.

### B. Disclosed-region window navigation

Used for long-distance movement through material already inside the disclosure horizon.

This is:

```text
presentation / viewport navigation
```

NOT:

```text
temporal commit
temporal Preview
coarse temporal step
```

It may move the Timeline window by a presentation amount such as:
- viewport span;
- page-like screenful;
- scroll operation;
- another platform-neutral window movement.

It MUST NOT:
- mutate `TM`;
- mutate `TC`;
- create `PTC`;
- choose a Moment;
- write RH;
- create a named semantic temporal unit.

After the desired disclosed region is brought into view:

> the user directly focuses/selects the exact Moment.

This is not OPEN-08 because the large movement applies to the **presentation window**, not the temporal cursor.

---

## Post-TC boundary

Disclosed-region window navigation MUST NOT leap the window into undisclosed post-TC structure.

For:

```text
TC < m <= LH
```

while pinned:

- future structure remains absent from the resting metric window;
- relative progressive one-Moment traversal remains the mechanism that earns disclosure;
- windowing may operate only on structure already within the current disclosure horizon.

---

## Revised AX4-06 requirement

PASS only if a non-pointer user can efficiently reach:

1. a distant already-disclosed historical Moment without one-by-one semantic traversal;
2. a later undisclosed Moment only by legitimate progressive Preview;
3. Live via the explicit Live route;
4. previously visited states through frozen return semantics;

without introducing a coarser temporal semantic unit or future enumeration.

---

## Required new fixture

### REV64-AT-01 — disclosed long-session reach

State:

```text
10,000 Moments legitimately disclosed
TC = m9000
Timeline window currently around m9000
target = m500
```

The user must be able to:

1. move the **Timeline presentation window** toward the distant disclosed region efficiently;
2. without changing `TC`, `TM`, `PTC` or RH;
3. bring `m500` into the interactive window;
4. then explicitly select/Preview/commit `m500` using the frozen temporal grammar.

PASS only if no coarse temporal semantic step is created.

---

# 3. REV-64-02 — RESPONSIVE RECOMPOSITION MUST CHOOSE ONE PREVIEW RULE

## Candidate wording

`RC-P3` says Preview may:

```text
either survive with the same target
or be cancelled
```

and X64-06 marks that branch as deterministic.

That is not yet deterministic enough for implementation.

A breakpoint/rotation is presentation-only and has no semantic authority.

The implementer must not choose whether it cancels `PTC`.

---

## Architecture ruling

# **RESPONSIVE RECOMPOSITION BY ITSELF DOES NOT CANCEL PREVIEW**

If a breakpoint / resize / orientation change occurs while Preview is active:

```text
PTC survives
target identity survives
TM/TC remain committed state
RH remains unchanged
```

The presentation remaps the same Preview target into the recomposed interface.

Focus moves to the equivalent affordance if needed.

---

## Input-stream exception

A device / OS / user agent may separately terminate the active pointer/gesture/input stream during rotation.

If that happens:

> treat the input termination as an **input cancellation event**, not as a responsive-layout semantic rule.

Then the already-frozen Preview cancellation semantics apply:

- discard `PTC`;
- withdraw transient disclosure;
- no commit;
- no RH.

Therefore:

```text
responsive recomposition alone → preserve Preview

actual input cancellation event → cancel Preview
```

This is deterministic and keeps responsive layout from acquiring semantic authority.

---

## Required X64-06 re-run

Test two subcases:

### X64-06A
Breakpoint/orientation change, interaction stream remains active.

Expected:
same `PTC`, same Preview target, recomposed presentation, no RH.

### X64-06B
Platform terminates the active input sequence.

Expected:
Preview cancels under the existing cancellation rule; no hidden commit/RH.

---

# 4. REV-64-03 — NARROW THE ACCESSIBLE “BOUNDED-RANGE” FREEZE

The candidate's safest structural insight is valid:

```text
disclosed-region navigation
+
relative forward continuation
+
separate Live target
```

Architecture APPROVES that.

But Stage 6.4 should not canonically require a **numeric bounded-range expression** for the disclosed-region navigator.

Why:

- the structural contract is platform-neutral;
- a composite target navigator can satisfy it;
- an eventual platform range mapping may impose min/max/value semantics that are unnecessary for the product contract;
- 6.5 should choose platform mappings only after checking their metadata.

---

## Canonical topology wording

Freeze the v1 topology as:

# **DISCLOSED-REGION TARGET NAVIGATOR + RELATIVE FORWARD ACTION + SEPARATE LIVE TARGET**

The disclosed-region navigator:

- contains/addresses only legitimately disclosed temporal targets;
- never includes undisclosed future material;
- supports exact target selection;
- supports focus/window virtualization;
- requires no publication of future membership.

It is NOT canonically required to be:
- a slider;
- a numeric range;
- a listbox;
- a grid;
- a tree.

A bounded-range implementation MAY be used on a platform only if 6.5 proves its required metadata is compatible.

---

## Narrow AXT-03

Replace the absolute statement equivalent to:

> “No set size / total / position-in-set is exposed in any state.”

with:

> **No quantity or membership metadata whose value depends on undisclosed/future material may be exposed.**

Publication of information derived solely from already-disclosed material is not prohibited by Stage 6.4 merely for being quantitative; whether it is useful/necessary belongs to the platform mapping.

No future side channel is permitted.

---

# 5. REV-64-04 — WCAG 2.5.7 DOES NOT MAKE HELD-ACTIVATION ITSELF MANDATORY

The candidate's product choice may remain:

> held activation is the primary non-dragging forward-continuation route in v1.

But the standards attribution must be narrowed.

WCAG 2.5.7 requires:

> functionality achievable by dragging must also be achievable by a single pointer **without dragging**.

It does NOT require held activation specifically.

Therefore canonical wording:

```text
WCAG 2.5.7 → requires a non-dragging single-pointer equivalent.

QANDEEL v1 → selects held activation as one such primary equivalent.
```

Other equivalent non-dragging controls could also satisfy the standard.

Do not state that WCAG makes the chosen mechanic uniquely mandatory.

---

# 6. REV-64-05 — PAUSING PRESENTATION MUST NEVER PAUSE AUTHORITATIVE LIVE STATE

Candidate MO-06 says passive-evolution presentation is pausable/stoppable.

Narrow this carefully.

WCAG 2.2.2 concerns automatically moving / blinking / scrolling / auto-updating **presented information** under its applicability conditions.

Stage 6.4 does NOT gain authority to pause:

- `LH`;
- committed conversational events;
- evidence ingestion;
- canonical Live analysis;
- authoritative runtime progression.

Canonical rule:

> Where WCAG/applicability requires control of automatically moving or updating presentation, the user may pause/stop/hide/control the **presentation behavior**, while authoritative QANDEEL state continues to advance.

If presentation is resumed:

- it resolves to authoritative current truth;
- it does not replay unavailable intermediate states as historical animation;
- passive runtime evolution still writes no RH.

Do not use “pause Live” as product semantics unless separately authorized.

---

# 7. REV-64-06 — POINTER CANCELLATION GUIDANCE IS A DEFAULT, NOT A UNIVERSAL SEMANTIC RULE

The candidate freezes wording equivalent to:

> every activation completes on pointer-up inside the target and moving away aborts it.

This is a valid and preferred v1 pattern for ordinary discrete pointer activation.

But WCAG 2.5.2 itself permits multiple cancellation models.

Also, continuous Preview/direct-manipulation interactions may legitimately begin presentation on pointer-down while keeping commit on release/cancel.

Therefore:

## For discrete actions

Default v1 pointer contract:

```text
commit on activation/up
abort when released outside / cancelled
```

unless the platform's standard accessible activation semantics provide equivalent cancellation.

## For continuous Preview

- pointer-down/movement may establish transient Preview;
- release may commit under the already-frozen grammar;
- cancellation discards Preview;
- no down-event may create an irreversible semantic commit.

This preserves accessibility without over-constraining all input mechanics to one event sequence.

---

# 8. APPROVED MOTION CONTRACT — RETAIN

Do NOT reopen these v1 results:

- M4-A empty.
- Historical projection immediate resolution.
- No future ghost.
- No simultaneous-current cross-fade.
- No historical lifecycle rewind.
- Motion optional/reinforcement-only.
- Reduced/no-motion semantic parity.
- Back reverses transactions, not frames.
- Animation frames are never RH checkpoints.
- No-op receives no semantic-change animation.
- Camera motion only where spatial authority exists.
- Responsive chrome may recompose; Map geography does not.

---

# 9. Required v2 Scope

Create:

# `QANDEEL_STAGE6_4_MOTION_A11Y_RESPONSIVE_CANDIDATE_v2`

Do NOT repeat research.

Do NOT redo unaffected sections.

Update only:

1. Decision Index;
2. research synthesis wording affected by REV-64-04 / 05 / 06;
3. accessibility topology option/matrix wording;
4. recommended accessible topology;
5. AXT-02 / AXT-03 as affected;
6. long-session reach option space;
7. long-session comparative matrix;
8. recommended reach grammar;
9. pointer/touch contract;
10. responsive state-preservation contract;
11. IN-10;
12. no-hindsight accessibility audit as affected;
13. AX4-06;
14. RP-03;
15. X64-05 / X64-06;
16. new REV64-AT-01;
17. Board B;
18. Board A only where IN-10 wording appears;
19. MUST / MUST NOT / SHOULD-MAY;
20. Stage 6.5 implementation-readiness outputs;
21. Architecture Review Handoff;
22. START_HERE / checksums/index.

Preserve all unaffected evidence.

---

# 10. Required Targeted Re-Runs

Re-run only:

- AX4-01
- AX4-02
- AX4-05
- AX4-06
- RP-03
- X64-04
- X64-05
- X64-06A
- X64-06B
- X64-08
- X64-09
- REV64-AT-01

Re-evaluate X64-10 only if responsive control placement changes return reachability.

No other test needs to be repeated unless its premise changes.

---

# 11. Architecture Stop Rule

STOP rather than inventing new Product semantics if the corrected solution requires:

- a semantic temporal unit larger than one Moment;
- future enumeration to make long-session reach practical;
- responsive layout itself cancelling/committing Preview;
- a platform role whose required metadata leaks undisclosed material;
- animation timing as state authority;
- motion as sole meaning;
- new RH semantics;
- Map re-layout;
- reopening Stage 6.2 / 6.3.

Otherwise return v2 for final Architecture review.

Do NOT declare Stage 6.4 frozen yourself.
