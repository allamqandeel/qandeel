# QANDEEL — Stage 6.5 Execution Authorization
## Implementation Contract + Build Sequencing

**Pre-Flight Result:** APPROVED WITH CLIENT-STACK GATE  
**Stage:** 6 — Experience Closure + Implementation Readiness  
**Active Task:** 6.5 — Implementation Contract + Build Sequencing  
**Upstream:** Stages 0–5 and 6.1–6.4 CLOSED / FROZEN  
**Canonical repository baseline:** `f322112ec5b862a83716bf9d65b4553b06931774`  
**Repository:** `https://github.com/allamqandeel/qandeel.git`

Stage 6.5 remains NON-CODING.

Do NOT modify the repository.
Do NOT fetch into the dirty local clone.
Do NOT stash/reset/clean/checkout/commit/branch/open PR.
Do NOT adopt untracked local client code as canonical.
Do NOT resolve deferred OPEN-06 / 08 / 09 / 19.

---

# 0. Pre-Flight Approval

The Stage 6.5 Pre-Flight Readiness Report is APPROVED.

Architecture independently confirms:

- repository identity is `allamqandeel/qandeel`;
- canonical `main` baseline is commit `f322112ec5b862a83716bf9d65b4553b06931774`;
- the committed `apps/mobile/` directory at that SHA contains only `README.md`;
- that README defines the location as a **Qandeel Mobile application placeholder** and explicitly defers product-screen implementation until core runtime contracts are stable;
- therefore there is no committed production client implementation architecture at the canonical baseline.

The dirty local `apps/mobile` spike is NON-CANONICAL evidence only.

It must not be used as implementation authority.

---

# 1. Architecture Ruling AR65-01
## Mobile product target is established; client technical stack is not

The absence of committed client code does NOT make the product target ambiguous.

Canonical product target for this implementation track is:

# **QANDEEL MOBILE CLIENT — iOS + Android**

This ruling does NOT select:

- React Native;
- Expo;
- bare React Native;
- native Swift/Kotlin;
- Flutter;
- another framework.

The technical client stack is an **Engineering Architecture decision owned by Stage 6.5**.

Therefore the Pre-Flight statement:

```text
Blocking ambiguities: NONE
```

is accepted at Product Architecture level.

However:

> **No final implementation contract or PR sequence may be frozen until the client-stack gate below is passed.**

---

# 2. CLIENT-STACK GATE CS-01 — REQUIRED FIRST

Before completing D65-04…D65-08 mappings, Stage 6.5 must perform a targeted client-stack decision.

Do NOT simply inherit the untracked Expo spike.

Compare at minimum:

## Option A
React Native + Expo-compatible architecture

## Option B
React Native with a lower-level/native-control architecture where Expo abstractions are insufficient

## Option C
Native iOS + Android

A materially superior fourth option may be added if evidence warrants it.

The comparison is NOT a generic technology popularity exercise.

It must be evaluated against frozen QANDEEL requirements.

---

# 3. Client-Stack Decision Criteria

Score every viable option against at least:

## CS-C01 — Living Analysis Map rendering

Can the stack support:

- large persistent spatial world;
- Pan;
- Semantic Zoom;
- stable world coordinates;
- custom object-intrinsic lifecycle boundaries;
- relation rendering;
- potentially high object counts;
- renderer virtualization/culling;
- no forced DOM/layout semantics that would manufacture geography?

## CS-C02 — Timeline

Must support:

- ordinal constant-step Timeline;
- disclosed-region virtualization;
- relative progressive traversal;
- non-semantic presentation-window repositioning;
- precise target identity/focus;
- outboard Live control.

## CS-C03 — Accessibility

Must support credible mappings for:

- VoiceOver;
- TalkBack;
- keyboard/external keyboard where platform supports it;
- accessible custom/composite controls;
- virtualized focus stability;
- state descriptions without future metadata leaks;
- reduced motion.

## CS-C04 — Gesture/input

Must support deterministic:

- Pan;
- Zoom;
- Timeline Preview;
- touch;
- pointer where available;
- held activation;
- gesture cancellation;
- P3a explicit acts;
- interruption.

## CS-C05 — Motion

Must support:

- optional motion;
- zero-motion parity;
- interruptible/retargetable presentation;
- no animation-frame state authority.

## CS-C06 — Responsive / device envelope

Must support:

- phone sizes;
- tablet/narrow/wide layouts where applicable;
- orientation changes;
- recomposition without Map relayout;
- Preview preservation when input stream survives.

## CS-C07 — Voice/live-session future

The client architecture should not create avoidable barriers to:

- microphone/audio session handling;
- streaming;
- real-time voice;
- background/foreground transitions;
- future synchronized analysis surfaces.

Do not design voice in Stage 6.5; evaluate platform fit only.

## CS-C08 — Performance

Evaluate:

- rendering path;
- UI/native thread interaction;
- animation/render scheduling;
- large virtualized structures;
- memory;
- low-end Android risk.

## CS-C09 — Testability

Must support:

- unit;
- component;
- accessibility;
- gesture/input;
- integration;
- device-level testing.

## CS-C10 — Delivery complexity

Evaluate:

- one-team maintainability;
- iOS/Android parity;
- native escape hatches;
- build/release complexity;
- dependency risk.

## CS-C11 — Existing repository compatibility

Evaluate against:

- monorepo;
- TypeScript/runtime packages;
- API code;
- current tooling.

Do NOT score the untracked spike as existing canonical investment.

## CS-C12 — Future web sharing

Potential future web/export surfaces may benefit from reusable logic.

This is secondary.

Do not compromise the mobile core to force web code reuse.

---

# 4. Required Technical Research for Client Stack

Targeted authoritative technical documentation is AUTHORIZED.

Use current official documentation where possible.

At minimum research relevant current documentation for candidate stacks covering:

- custom rendering / canvas / GPU options;
- accessibility of custom drawing surfaces;
- gesture system;
- animation/reduced motion;
- virtualization;
- native modules / audio escape hatches;
- platform support;
- testing.

For every source state:

1. source;
2. exact capability/constraint;
3. QANDEEL implication;
4. blocker/risk;
5. whether native fallback/escape hatch exists.

External framework defaults do not override QANDEEL semantics.

---

# 5. Client-Stack Decision Output

Before using the selected stack in the rest of the Stage 6.5 candidate, include:

# **CLIENT STACK DECISION RECORD**

containing:

1. options considered;
2. comparison matrix;
3. rejected options and exact reason;
4. selected v1 client architecture;
5. renderer strategy;
6. accessibility strategy;
7. gesture/input strategy;
8. state-management boundary;
9. native-module/escape-hatch policy;
10. testing strategy;
11. risks;
12. conditions that would force Architecture reconsideration.

The selected stack becomes a Stage 6.5 candidate decision.

It is not frozen until Product / Engineering Architecture approves the Stage 6.5 candidate.

---

# 6. Baseline Inspection Rule

All canonical repository reads must be against:

```text
f322112ec5b862a83716bf9d65b4553b06931774
```

or a later baseline only if Architecture explicitly updates this authorization.

Because the local object store does not contain that commit and the working tree is dirty:

- use read-only GitHub/API reads pinned to the SHA;
- do not use dirty local `apps/mobile` contents as source;
- local files may be inspected only to classify them as non-canonical evidence;
- do not mutate local Git state.

If the canonical GitHub baseline becomes unavailable:

STOP.

---

# 7. AR65-02 — Client absence changes the delta classification, not the Product contract

If the committed client remains only a placeholder:

D65-04…D65-08 client implementation requirements should normally classify:

```text
MISSING / BUILD
```

unless a reusable committed package exists elsewhere.

Do NOT:

- label them UNKNOWN merely because no client exists;
- infer a framework from local untracked files;
- redesign the experience to match a spike.

The purpose of 6.5 is to define the correct new client architecture.

---

# 8. AR65-03 — Existing backend/runtime must still be reused where valid

The lack of a client does NOT imply the whole implementation is greenfield.

Stage 6.5 must inspect committed:

- `apps/api`;
- `packages/runtime`;
- database/migrations;
- tests;
- existing conversation/session/auth/context contracts.

Classify each frozen requirement:

- `ALREADY IMPLEMENTED / REUSE`
- `PARTIAL / EXTEND`
- `MISSING / BUILD`
- `CONFLICT / REPLACE`
- `UNKNOWN / BLOCKER`

Do not rebuild server/runtime semantics that already exist correctly.

---

# 9. State Ownership — Required Output

Produce an implementation state matrix with at least:

| State | Class | Owner | Persistence | RH? | API? | Recovery | Test oracle |
|---|---|---|---|---|---|---|---|

Include at minimum:

- LH
- LF
- TM
- TC
- K(TC)
- IF_ref
- IF_render
- MC camera intent
- derived viewport footprint
- RH
- PTC
- Timeline disclosure horizon
- Timeline presentation window
- animation/presentation progress
- responsive layout state
- input stream state
- lifecycle render state
- IF divergence
- projection-state expression

Do NOT merge presentation and Product state.

---

# 10. AF64-02 — Practical Disclosed-Region Reach Proof

This remains a mandatory Stage 6.5 proof.

The selected actual client stack must define a concrete v1 mapping for:

# **PRACTICAL DISCLOSED-REGION WINDOW REPOSITIONING**

It must work for:

- touch;
- pointer where supported;
- keyboard/external keyboard where supported;
- assistive interaction.

It may use platform-specific presentation navigation.

It MUST NOT:

- mutate `TM`;
- mutate `TC`;
- create `PTC`;
- write RH;
- create a semantic temporal step;
- cross the disclosure horizon;
- expose undisclosed membership.

The proof must include a very large disclosed history.

Do NOT claim success from PageUp/PageDown alone.

---

# 11. OPEN-17 Reversible Seam Proof

Mandatory.

Against the selected implementation architecture, identify all proposed `PARAM` channels.

For every one prove:

1. no Home-locus mutation path;
2. no future-relative input path;
3. no semantic meaning depends on parameter value;
4. conservative valid default;
5. later tuning requires no migration in:
   - canonical state;
   - schema;
   - API;
   - events;
   - RH;
   - accessibility semantics.

Any failing `PARAM` channel becomes:

```text
FIXED
```

or is removed.

No widening of OPEN-17.

---

# 12. Historical Projection Security / Epistemic Boundary

Stage 6.5 must specify where unavailable future data is filtered.

Preferred architectural rule:

> semantic UI surfaces should receive only data they are entitled to render/expose.

Do NOT send future-unavailable material into a client component merely to:

- `display:none`;
- dim it;
- remove its label;
- hide it from accessibility.

The contract must identify:

- server-side boundary;
- client domain boundary;
- renderer boundary;
- accessibility boundary.

If the backend cannot currently provide a correct historical projection:

classify the required server work explicitly.

---

# 13. Client Rendering Architecture

The selected client architecture must separate:

## Canonical spatial model

- Thread Home loci;
- canonical identity;
- relation truth;
- contextual appearances.

## Projection model

- K(TC)-entitled subset/state;
- lifecycle;
- IF_render;
- relation/evidence visibility.

## Camera intent

- world reference;
- zoom/scale;
- semantic depth.

## Surface envelope

- device dimensions/aspect;
- clipping footprint.

## Presentation

- motion;
- windowing;
- focus/highlights;
- responsive chrome.

No layout engine may recompute canonical geography from current visible content.

---

# 14. Timeline Architecture

The implementation contract must include separate owners for:

1. temporal state;
2. disclosure horizon;
3. ordinal target model;
4. Timeline presentation window;
5. virtualized target rendering/focus;
6. relative forward continuation;
7. Live target;
8. P3a actions;
9. platform accessibility adapter.

Critical invariants:

```text
TimelineWindow != TC
TimelineWindow != PTC

window navigation != temporal navigation
```

---

# 15. Action Catalog

Produce a normalized action catalog for every required v1 act.

Each action must define:

- semantic intent;
- authoritative handler;
- preconditions;
- read-set;
- write-set;
- derived recomputations;
- RH rule;
- presentation consequence;
- accessible consequence;
- cancellation/interruption;
- no-op behavior;
- test IDs.

No generic `navigate()` action that merges frozen semantics.

---

# 16. Persistence / Recovery

For each state item classify recovery across:

- React/component rerender equivalent;
- navigation route change;
- app background/foreground;
- reconnect;
- app/process restart.

Do not persist:

- PTC;
- animation progress;
- input stream;
- responsive layout;
- Timeline presentation window

unless an independent product requirement proves otherwise.

If exact recovery of TM/TC/IF/MC/RH after process restart is not frozen upstream:

do not silently invent durable storage.

Flag the boundary clearly for 6.6/future implementation if necessary.

---

# 17. Build Sequencing

Produce the smallest safe task/BR plan.

The sequence should ordinarily establish:

1. client foundation / chosen stack;
2. canonical client state/action foundation;
3. historical projection/data boundary;
4. Map world model + camera;
5. Timeline model + virtualization;
6. temporal navigation;
7. RH/returns integration;
8. lifecycle / projection / IF chrome;
9. accessibility + modality parity integrated with owning components;
10. motion/presentation controller;
11. responsive contracts;
12. integrated adversarial system pass.

This ordering is a starting hypothesis, not a mandatory 12-task count.

Merge/split only when there is one architectural reason per task.

---

# 18. Implementation Task Requirements

For every proposed Task/BR include:

1. Task ID
2. name
3. purpose
4. exact baseline
5. prerequisite Tasks
6. exact repo domains
7. implementation contracts
8. MUST
9. MUST NOT
10. tests
11. adversarial tests
12. non-goals
13. API/schema changes
14. performance risks
15. accessibility requirements
16. stop conditions
17. review strategy
18. merge/freeze gate

Do not execute any Task.

---

# 19. Required Candidate Package

Return:

# `QANDEEL_STAGE6_5_IMPLEMENTATION_CONTRACT_CANDIDATE_v1`

containing at minimum:

1. Authorization compliance
2. Canonical repository baseline
3. Dirty-tree isolation evidence
4. Source/authority inventory
5. Client Stack Decision Record
6. Client-stack technical research inventory
7. Repository architecture inventory
8. Architecture Delta Register
9. State-class inventory
10. State Ownership Matrix
11. Action Catalog
12. Event/derived-state flow
13. Historical projection/data-entitlement architecture
14. Backend/API delta
15. Schema/persistence delta
16. Map rendering architecture
17. Camera/surface-envelope architecture
18. Timeline architecture
19. Timeline virtualization/window architecture
20. AF64-02 practical reach mapping
21. Accessibility platform mapping
22. P3a modality mapping
23. Motion/presentation-controller architecture
24. Responsive architecture
25. Interruption implementation rules
26. OPEN-17 actual reversible-seam proof
27. Reload/recovery matrix
28. Performance/virtualization plan
29. Test architecture
30. Frozen-test → implementation-test traceability
31. Proposed implementation Task/BR sequence
32. Task-by-task contracts
33. Dependency graph
34. API/schema migration order, if any
35. Implementation risks
36. Architecture blockers, if any
37. Deferred/non-goals register
38. Stage 6.6 proof inputs
39. MUST
40. MUST NOT
41. SHOULD / MAY
42. Architecture Review Handoff

Also provide:

## Implementation Decision Index

with one-line decisions for:

- client stack;
- state owner;
- historical projection boundary;
- Map renderer;
- Timeline renderer/windowing;
- practical window reach;
- accessibility topology mapping;
- motion controller;
- responsive camera-envelope split;
- OPEN-17 seam;
- implementation task count/order.

---

# 20. Required Proof Artifacts

No decorative UI boards.

Create only implementation-architecture diagrams if they materially clarify:

## Diagram A — State / Event Authority

Must distinguish:
- canonical;
- derived;
- transient interaction;
- presentation state.

## Diagram B — Data / Epistemic Boundary

Must show:
- backend/domain entitlement filtering;
- client projection;
- renderer;
- accessibility surface.

## Diagram C — Build Dependency Graph

Must show Task/BR dependencies.

These diagrams are optional if the document itself is unambiguous.

---

# 21. Stop Rules

STOP and report if any of the following occurs:

- canonical GitHub baseline cannot be read;
- client-stack choice cannot satisfy a frozen requirement;
- practical window reach needs a coarse temporal semantic unit;
- custom-rendering approach cannot provide truthful accessibility;
- historical no-hindsight requires exposing future material to UI;
- OPEN-17 seam requires semantic input;
- existing runtime contradicts frozen Product truth in a way that cannot be corrected without reopening Architecture;
- platform choice requires changing Stage 6.2/6.3/6.4 semantics.

Do not invent a workaround that changes the Product contract.

---

# 22. Research Rule

After CS-01:

use external technical docs only when needed for an actual selected/considered technology.

No new UX/HCI research.

No broad framework survey beyond the client-stack gate.

---

# 23. Final Stop

Return the Stage 6.5 candidate for Product / Engineering Architecture review.

Do NOT:

- code;
- create files in the repo;
- create branch;
- commit;
- open PR;
- declare Stage 6.5 frozen;
- authorize implementation.

Stage 6.6 remains the final integrated readiness gate.
