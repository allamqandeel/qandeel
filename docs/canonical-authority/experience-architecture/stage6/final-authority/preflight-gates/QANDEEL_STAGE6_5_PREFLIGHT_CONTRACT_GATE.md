# QANDEEL — Stage 6.5 Pre-Flight Contract Gate
## Implementation Contract + Build Sequencing

**Status:** PRE-FLIGHT ONLY  
**Stage:** 6 — Experience Closure + Implementation Readiness  
**Active Task:** 6.5 — Implementation Contract + Build Sequencing

**Upstream authority:**
- Stages 0–5 CLOSED / FROZEN
- Stage 6.1 CLOSED / FROZEN
- Stage 6.2 CLOSED / FROZEN
- Stage 6.3 CLOSED / FROZEN
- Stage 6.4 CLOSED / FROZEN

Stage 6.5 is still:

# **NON-CODING**

It converts frozen Product / Experience Architecture into a build-ready engineering contract.

Do NOT modify source.
Do NOT implement.
Do NOT create a feature branch.
Do NOT open a PR.
Do NOT change migrations/schema.
Do NOT resolve deferred OPEN-06 / 08 / 09 / 19.

Return only the requested Pre-Flight Readiness Report, then STOP.

---

# 1. Purpose

Stage 6.5 must answer:

> **Exactly what does Claude Code need to build, in what ownership boundaries and sequence, so that implementation does not invent Product / Experience semantics?**

The output must become the authoritative handoff from:

```text
Frozen Product / Experience Architecture
        ↓
Implementation tasks / PR sequence
```

Stage 6.5 is not a generic frontend technical-design exercise.

It must be grounded in:

1. frozen QANDEEL semantics;
2. the actual canonical repository architecture;
3. existing runtime/state boundaries;
4. existing frontend/client architecture;
5. existing tests/tooling;
6. the smallest safe implementation sequence.

---

# 2. Repository Baseline Gate

Repository inspection is REQUIRED.

Repository mutation is forbidden.

Before any implementation-contract work, establish the exact committed baseline.

Report:

- repository remote identity;
- current branch;
- current HEAD;
- local `main` SHA;
- remote `origin/main` SHA if fetch/read is safely available;
- working-tree status;
- tracked vs untracked pre-existing changes;
- whether the current working tree can be trusted as canonical source.

## Dirty-tree rule

The recent Stage 6 work reported approximately 38 pre-existing working-tree entries.

Do NOT:

- stash;
- delete;
- restore;
- checkout;
- reset;
- clean;
- commit;
- modify them.

If the tree is dirty:

> inspect the **committed canonical baseline**, not the dirty working-tree content, wherever they differ.

Use read-only Git mechanisms such as:
- `git show <SHA>:path`;
- `git diff` for classification;
- read-only tree listing;
- other non-mutating commands.

If canonical `origin/main` cannot be established safely:

STOP and report the baseline blocker.

Do not silently plan from an unknown branch or dirty feature state.

---

# 3. Source Authority Order

Stage 6.5 must consume in this order:

```text
Stage 6.4 Final Freeze Record
    >
Stage 6.3 Final Freeze Record
    >
Stage 6.2 Final Freeze Record
    >
Stage 6.1 Final Freeze Record
    >
Canonical Core Checkpoint v2
    >
committed repository implementation facts
```

The repository tells us:

> how QANDEEL is currently implemented.

It does NOT override frozen Product semantics.

If current code conflicts with frozen Architecture:

- identify the delta;
- classify it as implementation work;
- do not reinterpret the Architecture to fit the code.

---

# 4. Implementation Domains to Inspect

Inspect only the repository areas necessary to map the frozen experience into implementation.

At minimum determine whether/how the repo currently contains:

## D65-01 — Canonical temporal state ownership
- `LH`
- `LF`
- `TM`
- `TC`
- `IF_ref`
- Map camera state
- RH/history
- Preview `PTC`

## D65-02 — Current-session Moment / Timeline data
- Moment identity/order;
- `SP`;
- session scope;
- committed vs provisional input;
- Live Head updates;
- timestamps only where independently present.

## D65-03 — Historical projection
- `K(TC)` equivalent;
- knowledge availability;
- version/state validity;
- relation/evidence/context availability;
- historical render/query boundaries.

## D65-04 — Map model / renderer
- canonical Thread/Home representation;
- world-space geometry;
- Semantic Zoom;
- camera;
- contextual appearances;
- lifecycle expression hooks;
- relation rendering.

## D65-05 — Inspection
- current selected/inspected object;
- context/version lineage;
- Source/Provenance route;
- exact-return information.

## D65-06 — Navigation / history
- Pan;
- Zoom;
- Back;
- Return;
- navigation transaction/history infrastructure;
- current UI router/history behavior if any.

## D65-07 — Accessibility/input
- focus-management architecture;
- keyboard handlers;
- pointer/touch abstraction;
- reduced-motion handling;
- responsive breakpoints;
- virtualization/windowing libraries/components.

## D65-08 — Frontend framework / state system
- rendering framework;
- state-management library;
- event architecture;
- component boundaries;
- test stack.

## D65-09 — Backend/API support
Only where required by the frozen experience:
- session committed position;
- historical versions;
- provenance;
- lifecycle state;
- availability boundaries.

Do not reopen Backend Intelligence Architecture already frozen elsewhere.

---

# 5. Stage 6.5 Must Separate Four Kinds of State

The implementation contract must explicitly distinguish:

## A. Canonical Product State
Equivalent of frozen `S`.

## B. Derived Product State
Examples:
- `K(TC)`;
- `IF_render`;
- divergence;
- locatability;
- projection-state expression.

## C. Transient Interaction State
Examples:
- `PTC`;
- drag/gesture stream;
- pointer state;
- in-flight presentation target.

## D. Presentation State
Examples:
- Timeline window position;
- responsive panel composition;
- animation progress;
- virtualized rendered range;
- focus proxy where platform requires it.

Critical rule:

> **Presentation state must not silently become canonical Product state.**

Especially:

```text
Timeline window position
!=
TC
!=
PTC

animation progress
!=
semantic settle

responsive viewport envelope
!=
Map geography
```

---

# 6. State Ownership Contract

For each state item, Stage 6.5 must define:

1. authoritative owner;
2. producer;
3. readers;
4. mutation authority;
5. persistence class;
6. restoration behavior;
7. whether it appears in RH;
8. whether it crosses API/backend boundary;
9. accessibility consumer;
10. test oracle.

Do not decide ownership solely for coding convenience.

---

# 7. Event / Action Contract

Produce one normalized action catalog for all v1 interactions needed by Stages 4–6.

At minimum:

- Pan
- Semantic Zoom
- Preview Temporal Target
- Commit Moment
- Commit LIVE_EDGE
- Cancel Preview
- Temporal+Locate
- contextual locus choice
- Return to Live Head
- Return to Live Focus
- Go Live + Locate
- Return to World
- Exact Return
- Back One Step
- Timeline window navigation
- long-hold relative continuation
- responsive recomposition
- input cancellation
- reduced-motion preference change

For every action define:

- input intent;
- preconditions;
- state read-set;
- state write-set;
- semantic boundary;
- RH transaction rule;
- presentation consequence;
- accessibility consequence;
- failure/no-op behavior;
- idempotency/re-entry concerns.

Do not create implementation-only action names that blur frozen semantic distinctions.

---

# 8. Historical Projection Contract

Stage 6.5 must translate `K(TC)` into an implementation boundary.

Specify:

- where knowledge availability is evaluated;
- where version validity is evaluated;
- where contextual appearance availability is evaluated;
- where relation/evidence/confidence/question state is filtered;
- how future-unavailable material is prevented from reaching the renderer/accessibility tree;
- how known noncurrent lineage remains available to Source/Provenance;
- how Preview obtains `P(PTC)` without becoming committed state.

No component should receive unavailable future material and merely “hide” it visually if that creates a side-channel risk.

Prefer entitlement filtering before semantic rendering surfaces.

---

# 9. Timeline Implementation Contract

Translate Stage 6.2/6.4 into implementable boundaries.

Must include:

## Geometry
- ordinal constant-step semantics;
- windowing;
- outboard Live target;
- disclosure horizon.

## Temporal navigation
- one-Moment relative progressive traversal;
- earned Preview disclosure;
- explicit Moment commit;
- explicit Live commit.

## Presentation-window navigation
- operates on disclosed material only;
- no TM/TC/PTC/RH mutation;
- cannot cross horizon;
- practical large-scale reposition requirement from AF64-02.

## Accessible topology
- disclosed-region target navigator;
- relative forward action;
- separate Live target;
- P3a dual acts.

## Platform mapping seam
6.5 must select or define the component/control mappings for the actual client stack and prove metadata compatibility.

---

# 10. Practical Reach Mapping — REQUIRED

AF64-02 is a Stage 6.5 blocker.

The contract must name a concrete v1 implementation approach for:

# **practical disclosed-region window repositioning**

It must work for:
- pointer;
- touch;
- keyboard;
- non-pointer/accessibility.

It must NOT:
- create a temporal coarse step;
- mutate `TC/PTC`;
- write RH;
- cross the horizon;
- expose undisclosed material.

Do not satisfy this by saying merely:

> PageUp/PageDown exists.

The approach must remain practical for very large disclosed histories.

If the actual client framework cannot support this without inventing Product semantics:

report an Architecture blocker.

---

# 11. Map Implementation Contract

Translate Stage 6.3 into renderer rules.

Must include:

## Lifecycle
- object-intrinsic lifecycle boundary/contour channel;
- secondary state notation;
- Dormant presence floor;
- Reopened current-state-only;
- no history scar.

## Projection state
- content-independent orientation chrome;
- no sparseness-triggered behavior;
- no Map object/locus.

## Neighbourhood stability
- FIXED / TRUTH / PARAM / FORBIDDEN channel classification;
- no secondary layout compensation;
- no future-driven ambient parameters.

## IF divergence
- retained-reference chrome;
- five IF cases;
- no miniature unavailable render;
- Source/Provenance deliberate retrieval.

---

# 12. OPEN-17 Reversible-Seam Proof — REQUIRED

Stage 6.1 left OPEN-17 as classification C.

Stage 6.3 froze the Experience bounds.

Stage 6.5 must now prove the actual implementation seam.

For every tunable `PARAM` channel prove:

1. established Home commitments cannot move through it;
2. future-relative material cannot enter its inputs;
3. semantic meaning does not depend on the selected parameter;
4. a conservative default is valid;
5. later tuning requires no:
   - state migration;
   - schema migration;
   - event migration;
   - RH migration;
   - accessibility semantic migration.

If a parameter fails:

# **REMOVE THE SEAM / MAKE THE CHANNEL FIXED**

Do not widen OPEN-17.

This proof must be against actual proposed implementation boundaries, not abstract prose.

---

# 13. Camera / Responsive Implementation Boundary

Consume AF64-03.

Distinguish:

## Canonical camera/navigation intent
- world reference/anchor;
- zoom/scale intent;
- semantic depth;
- authorized destination.

## Presentation surface envelope
- screen dimensions;
- aspect;
- clipping/visible footprint.

Responsive change:

- does not create navigation;
- does not write RH;
- does not refit content;
- may recompute the derived visible footprint.

The implementation contract must specify exactly where this separation lives in the actual client state model.

---

# 14. Motion / Presentation Controller

Specify a presentation controller that cannot become semantic authority.

It must support:

- optional camera motion;
- optional Pan/Zoom reinforcement;
- immediate historical projection resolution;
- interruption/retarget;
- reduced-motion = 0;
- no future ghost;
- no version overlap;
- no lifecycle historical rewind.

The controller may consume authoritative state.

It may not own canonical Product state.

Animation frames never enter RH.

---

# 15. Accessibility Implementation Contract

For the actual client platform/framework, specify:

- chosen role/control mapping;
- focus strategy;
- virtualization strategy;
- announcements/state text;
- Live target representation;
- P3a action exposure;
- relative-forward representation;
- disclosed-region window navigator;
- Dormant semantics;
- IF divergence semantics.

For every metadata field, state:

```text
source fact
→ why user is entitled
→ whether it can depend on undisclosed material
```

If a conventional role requires illegal metadata:

reject the role.

---

# 16. Test Architecture

Stage 6.5 must convert frozen proof tests into implementation test layers.

At minimum classify tests into:

## Unit
Pure state/action/projection functions.

## Component
Timeline / Map / accessible topology / focus / lifecycle / IF chrome.

## Integration
Timeline ↔ Map ↔ camera ↔ RH.

## Accessibility
keyboard, screen-reader semantics, focus virtualization, reduced motion.

## Responsive
breakpoint/rotation, Preview preservation, camera envelope.

## Adversarial
no-hindsight, future side-channels, supersession overlap, stale Preview, interruption.

For every frozen acceptance test identify:

- test layer;
- fixture;
- oracle;
- implementation owner.

Do not simply paste Board tests into one giant e2e suite.

---

# 17. Build / PR Sequencing Principles

Stage 6.5 must produce the smallest safe implementation sequence.

Principles:

## SEQ-01 — Build state semantics before presentation
Do not implement pretty Timeline/Map chrome on unstable state boundaries.

## SEQ-02 — Build epistemic filtering before rendering
No future material should reach UI surfaces merely to be hidden.

## SEQ-03 — Build RH/action semantics before motion
Motion consumes transaction truth; it never defines it.

## SEQ-04 — Accessibility is not final polish
Accessible topology must be implemented with the component that owns the interaction.

## SEQ-05 — Responsive contract ships with its owning component
Do not postpone responsive semantics to a later cleanup PR.

## SEQ-06 — One PR should have one architectural reason to exist
Avoid one giant “Stage 6 implementation” PR.

## SEQ-07 — Every PR has frozen acceptance tests
No implementation task without:
- MUST;
- MUST NOT;
- adversarial fixtures;
- explicit non-goals.

---

# 18. Required Sequencing Output

Produce a proposed list of implementation Tasks/BRs.

For each:

1. Task ID
2. name
3. purpose
4. prerequisite tasks
5. exact code domains
6. state/contracts implemented
7. tests
8. non-goals
9. blocker/stop conditions
10. whether schema/API changes are needed
11. review strategy
12. merge/freeze gate

Do not execute any Task.

Do not create branches.

---

# 19. Architecture Delta Register

Compare frozen requirements to current committed repo.

Classify each requirement:

- `ALREADY IMPLEMENTED / REUSE`
- `PARTIAL / EXTEND`
- `MISSING / BUILD`
- `CONFLICT / REPLACE`
- `UNKNOWN / BLOCKER`

For every conflict:

- state frozen requirement;
- state current committed behavior;
- identify smallest implementation correction;
- do not redesign frozen Architecture.

This register is essential to avoid rebuilding capabilities QANDEEL already has.

---

# 20. API / Schema Change Discipline

Do not invent new backend storage merely because frontend state exists.

For every proposed persistence/API/schema change ask:

1. Is the fact canonical or derived?
2. Does it already exist upstream?
3. Must it survive reload?
4. Must it be shared across devices?
5. Is it only presentation state?
6. Would persistence accidentally make transient state canonical?

Examples presumed presentation/transient unless repository evidence proves otherwise:

- Timeline window position;
- animation progress;
- current pointer stream;
- responsive layout;
- `PTC`.

Do not persist them by default.

---

# 21. Reload / Recovery Boundary

Stage 6.5 must explicitly determine which frozen experience state must survive:

- component re-render;
- route change;
- app background/foreground;
- page reload;
- reconnect;
- process restart.

Do NOT decide this from intuition.

Use existing product/runtime persistence authority and state semantics.

If upstream material does not define a required recovery behavior:

flag it as an implementation-readiness question rather than silently persisting everything.

---

# 22. Performance / Virtualization Boundary

The frozen experience assumes potentially long Sessions and large Map worlds.

Stage 6.5 must identify:

- Timeline virtualization strategy;
- Map rendering strategy;
- projection recomputation boundary;
- accessibility focus stability under virtualization;
- window-navigation practicality;
- cost of historical projection change;
- no-hindsight filtering location.

Do not choose optimization that changes semantics.

Performance must preserve:

- constant-step meaning;
- Home loci;
- target identity;
- RH;
- focus;
- accessibility truth.

---

# 23. No External Research by Default

Stage 6.5 is primarily:

- repository inspection;
- frozen-contract translation;
- implementation architecture.

Do not repeat HCI/UX research.

Targeted technical documentation research is allowed only when needed to understand an actual library/framework already present in the repo.

If used:
- name the library;
- name the implementation question;
- use authoritative documentation;
- do not let framework defaults override QANDEEL semantics.

---

# 24. Required Pre-Flight Readiness Report

Return ONLY:

## 1. Canonical understanding
Explain what 6.5 is and is not.

## 2. Upstream freeze inventory
Summarize the Stage 6.2–6.4 implementation-critical contracts.

## 3. Repository baseline
Report:
- remote;
- branch;
- HEAD;
- local main;
- origin/main;
- working tree;
- whether canonical committed baseline is safely inspectable.

Do not modify anything.

## 4. Dirty-tree handling
Explain exactly how you will avoid using pre-existing uncommitted changes as canonical source.

## 5. Inspection scope
Summarize D65-01…D65-09.

## 6. State-class model
Explain canonical / derived / transient interaction / presentation state.

## 7. Two load-bearing 6.5 proofs
Explain:
- AF64-02 practical window-reach mapping;
- OPEN-17 reversible implementation seam.

Do not solve them yet.

## 8. Architecture delta method
Explain how `REUSE / PARTIAL / MISSING / CONFLICT / UNKNOWN` will be assigned.

## 9. Build-sequencing method
Explain how PR/task boundaries will be derived without coding.

## 10. Research necessity
Return exactly:
- `TARGETED TECHNICAL DOCS MAY BE REQUIRED`
or
- `NO EXTERNAL TECHNICAL RESEARCH EXPECTED`

Do not conduct it yet.

## 11. Blocking ambiguities
If none:
**Blocking ambiguities: NONE.**

If repo baseline cannot be established:
state the blocker and STOP.

## 12. Execution plan
Maximum five bullets.

Then STOP.

---

# 25. Forbidden Interpretations

## F65-01
Do not code.

## F65-02
Do not modify repo.

## F65-03
Do not plan from a dirty working-tree file when committed baseline differs.

## F65-04
Do not let current implementation override frozen Product semantics.

## F65-05
Do not persist presentation/transient state by convenience.

## F65-06
Do not introduce coarse temporal stepping.

## F65-07
Do not expose future material to renderer merely to hide it.

## F65-08
Do not postpone accessibility to final polish.

## F65-09
Do not create one giant implementation task.

## F65-10
Do not create branches/PRs.

## F65-11
Do not resolve deferred OPEN-06/08/09/19.

## F65-12
Do not self-authorize implementation after 6.5.

---

# 26. Current Board

```text
Stages 0–5                              CLOSED / FROZEN
Stage 6.1 — OPEN Triage                CLOSED / FROZEN
Stage 6.2 — Timeline Completion        CLOSED / FROZEN
Stage 6.3 — Historical Map Completion  CLOSED / FROZEN
Stage 6.4 — Motion/A11y/Responsive     CLOSED / FROZEN
Stage 6.5 — Implementation Contract    PRE-FLIGHT
Stage 6.6 — Final Readiness Proof      PENDING
```

No coding is authorized.
