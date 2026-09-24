# QANDEEL — Stage 6.5 Architecture Review Ruling v1
## Implementation Contract + Build Sequencing — Targeted Revision

**Architecture Verdict:** TARGETED REVISION REQUIRED  
**Base Candidate:** `QANDEEL_STAGE6_5_IMPLEMENTATION_CONTRACT_CANDIDATE_v1`  
**Scope:** Seven targeted corrections / closures  
**Research:** Do not repeat CS-01 broadly  
**Repository:** NON-CODING / read-only only  
**Canonical baseline:** `f322112ec5b862a83716bf9d65b4553b06931774`

Do NOT redo Stage 6.5 from scratch.

Preserve all unaffected research, client-stack analysis, architecture inventory, OPEN-17 proof direction, task sequencing evidence and diagram structure.

Do NOT code.
Do NOT fetch into or modify the dirty local clone.
Do NOT create a branch, commit, PR, migration or source file.
Do NOT adopt untracked `apps/mobile` spike work.

---

# 1. APPROVED DIRECTIONS

The following Stage 6.5 candidate directions are APPROVED, subject only to the targeted revisions below.

## A65-01 — Client stack direction

Architecture APPROVES as the v1 client-stack direction:

# **React Native New Architecture + Expo CNG + TypeScript**

inside:

```text
apps/mobile
```

with:

- shared TypeScript contracts through the monorepo;
- native escape hatches where explicitly justified;
- custom spatial rendering support;
- real accessible native/View semantics layered from the same entitled projection;
- virtualization for long Timeline structures.

This approval does NOT adopt any untracked local Expo spike.

The actual implementation starts from the canonical committed placeholder.

---

## A65-02 — Map renderer direction

Architecture APPROVES the direction:

- custom GPU/canvas rendering for the visual Living Analysis Map;
- native/real View accessibility overlay derived from the same semantic view projection;
- no layout engine authority over canonical geography;
- camera transform separate from world coordinates;
- `RenderStyle` presentation-only seam.

The exact rendering library/version remains implementation-pinned in T-01/T-04.

---

## A65-03 — Timeline virtualization direction

Architecture APPROVES:

- virtualized disclosed-region target rendering;
- Timeline presentation window as class-D presentation state;
- one-Moment semantic traversal;
- separate presentation-window navigation;
- separate Live affordance;
- no future-unavailable target membership.

---

## A65-04 — OPEN-17 seam direction

The candidate's two proposed PARAM channels are accepted in principle:

```text
RenderStyle.ambient
RenderStyle.emptySpace
```

provided the final Stage 6.5 v2 proof consumes the corrected depth-disclosure boundary in REV65-02.

The important architectural separation is retained:

```text
semantic/projected truth
    !=
RenderStyle parameters
```

and accessible semantics must not depend on either PARAM.

---

## A65-05 — Build-sequencing shape

A multi-task / multi-PR implementation sequence is APPROVED.

The candidate's 12-task structure is a useful base.

The exact tasks may be revised where the corrections below change prerequisites or responsibilities.

No giant single “Stage 6 implementation” PR.

---

# 2. REV65-01 — SEMANTIC DOMAIN MAPPING MUST BE CLOSED BEFORE CODING

## Candidate problem

The candidate leaves critical temporal/domain questions to T-03, including an equivalent of:

> establish during T-03 whether the committed schema already carries KF/validity.

It also says:

- lifecycle source of truth to be defined in T-03;
- analytical domains are “source material” for Threads / Readings;
- LF is treated as a server/runtime-owned fact without an exact committed producer being identified.

That is not implementation-ready.

Stage 6.5 exists specifically so coding does NOT invent those mappings.

---

## Architecture ruling

Before Stage 6.5 can freeze, produce a:

# **SEMANTIC DOMAIN MAPPING RECORD**

against canonical baseline `f322112e`.

It must explicitly resolve at least the following.

## SDM-01 — Timeline Moment

Define exactly what durable/runtime entity constitutes:

```text
Moment(m)
SP(m)
LH
```

Do NOT automatically equate a raw `conversation_turns` row with a canonical Timeline Moment.

The canonical repository does contain ordered conversation turns and turn lifecycle states.

But the frozen product architecture requires **committed current-session Moments**, and prior QANDEEL grammar work distinguishes provisional/revisable input from committed conversational truth.

Therefore the mapping must prove:

- which turn/unit states become Timeline Moments;
- whether one DB turn equals one Moment;
- how revised/superseded/cancelled/failed/streaming turns are handled;
- how stable `SP` is assigned;
- what precisely advances `LH`.

If existing committed source does not implement the required committed conversational-unit lifecycle:

classify the missing canonical-unit substrate as `MISSING / BUILD`.

Do not use timestamps alone as semantic commitment.

---

## SDM-02 — Canonical Thread

Identify the exact runtime/domain source for a canonical Established Thread.

If there is no existing committed Thread entity:

state:

```text
MISSING / BUILD
```

and define what new canonical server-side entity/contract is required.

Must specify:

- stable Thread identity;
- establishment event/boundary;
- permanent Home-locus persistence;
- Active / Dormant / Reopened lifecycle ownership;
- relation/context bindings;
- no future Home borrowing.

Do not simply relabel a hypothesis row as a Thread unless the semantics are proven equivalent.

---

## SDM-03 — Reading / analytical object

Define the mapping between the frozen “Reading / analytical object” concept and existing runtime domains.

At minimum classify:

- Hypothesis;
- Memory;
- Confidence evaluation;
- Information Gap;
- Question;
- HIM measurement/snapshot;
- Relation/association;
- other analytical objects used by the Living Analysis Map.

The mapping may be:

- one canonical union/interface over several existing domains;
- separate typed object families;
- another explicit implementation model.

But the client must not infer ontology from table shape.

---

## SDM-04 — Live Focus `LF`

Identify the authoritative producer and lifecycle of:

```text
LF
```

The candidate currently treats LF as server/runtime-owned.

That is acceptable only if a committed producer exists or a precise new server/domain contract is specified.

Must define:

- what can become LF;
- Emerging/pre-geographic LF representation;
- when LF changes;
- whether LF is persisted or derived;
- how Live Focus events reach the client;
- how `LF_at_activation` and `LF_at_post-live-boundary` are obtained atomically enough for Stage 5.5 semantics.

If no existing producer exists:

classify `LF` as `MISSING / BUILD`.

---

## SDM-05 — Knowledge / version validity

Resolve, per relevant canonical object/component:

```text
KF
VF
VT
```

Do NOT leave this as `UNKNOWN` for T-03.

At minimum inspect and classify:

- Hypothesis identity/version/lifecycle;
- Evidence participation;
- Confidence version/state;
- Information Gap / Question lifecycle;
- contextual appearances;
- Relation/association;
- Thread lifecycle;
- Reading/object versions;
- provenance lineage.

Use exact canonical schema/service/history evidence.

---

## SDM-06 — Historical reconstructability

For every domain used in `K(TC)`, classify:

- `FULL HISTORY AVAILABLE / REUSE`
- `PARTIAL HISTORY / EXTEND`
- `CURRENT-ONLY / BUILD HISTORY`
- `NOT IN v1 PROJECTION`
- `BLOCKER`

Important:

> A numeric `version` field on a mutable current row does NOT by itself mean historical versions can be reconstructed.

Likewise:

> an audit table covering one mutation path does not prove full object-state history.

The candidate must prove reconstructability path-by-path.

---

# 3. Repository Evidence That Makes REV65-01 LOAD-BEARING

The canonical repository already demonstrates why the domain mapping cannot remain implicit.

Examples at `f322112e`:

- `conversation_turns` has explicit lifecycle statuses and ordered timestamps/IDs;
- `hypotheses` is a mutable current row with a `version` integer;
- hypothesis transitions increment the version on that same row;
- `hypothesis_updates` records before/after version for the evidence-update path;
- confidence evaluations are separate version-targeted evaluation records.

These structures are useful foundations.

They are NOT automatically equivalent to a complete `KF/VF/VT` historical projection model for every analytical object.

Stage 6.5 v2 must resolve this before coding starts.

---

# 4. REV65-02 — SEPARATE K(TC) FROM SEMANTIC-ZOOM DISCLOSURE

## Candidate problem

§13 currently assigns the server primary filter responsibility for:

```text
K(TC)
...
depth entitlement
```

and then builds renderer/accessibility directly from “the projection.”

This risks collapsing two frozen axes:

```text
temporal / epistemic availability
vs
Semantic Zoom depth withholding
```

Stage 5 explicitly freezes them as different conditions.

---

## Architecture ruling

Use two explicit layers.

## Layer A — Temporal/Epistemic Projection

Conceptually:

```text
K(TC) = TemporalProject(W, TC)
```

This layer decides:

- known vs unknown;
- then-valid vs noncurrent;
- contextual appearance availability;
- relation availability;
- Evidence participation availability;
- Confidence state/version entitlement;
- Question/Gap lifecycle entitlement;
- lifecycle truth;
- no-hindsight filtering.

Future-unavailable material MUST be filtered before it reaches general semantic UI surfaces.

---

## Layer B — Semantic Disclosure View

Conceptually:

```text
V = Disclose(K(TC), semanticDepth, inspectionContext)
```

This layer decides:

- what of temporally-entitled truth is disclosed at current Semantic Zoom depth;
- World / Thread / Session / Reading / Source-Provenance disclosure;
- depth withholding.

Depth withholding MUST NOT be represented as historical absence.

---

## Transport / performance freedom

Stage 6.5 does NOT require all of `K(TC)` to be transmitted eagerly.

The implementation may:

- fetch depth-specific slices;
- lazily fetch deeper content;
- use server query parameters;
- cache entitled material.

But the semantic contracts remain separate.

A transport optimization may not redefine:

```text
not fetched
=
not known
```

---

## Accessibility correction

The accessibility overlay/tree must derive from:

# **THE SAME DEPTH-DISCLOSED VIEW `V` USED BY THE VISUAL SEMANTIC SURFACE**

not from raw `K(TC)` and not from the canvas renderer.

This preserves:

- epistemic parity;
- Semantic Zoom parity;
- OPEN-17 separation.

Update the OPEN-17 seam proof accordingly.

---

# 5. REV65-03 — STATE/ACTION AUTHORITY CONSISTENCY

## Candidate inconsistency A — “Exactly S”

The candidate says class A is:

```text
LH, LF, TM, TC, IF_ref, MC intent, RH
```

followed by:

> “Exactly S, nothing more.”

But frozen conceptual `S` includes `K(TC)`.

Implementation may validly treat `K(TC)` as derived rather than independently mutable/persisted.

Therefore canonical wording must be:

> **Class A contains the authoritative independently mutable state variables; `K(TC)` remains a canonical product projection derived from authoritative world truth + TC.**

Do not claim the physical store shape is literally identical to conceptual `S`.

---

## Candidate inconsistency B — class-A writers

The action section says:

> only the eight commit/return actions may write class A.

But its own catalog correctly has:

- `PAN` writing `MC`;
- `ZOOM_SEMANTIC` writing `MC.depth`;
- contextual locus choice writing camera intent;
- authoritative server events advancing `LH`;
- authoritative LF events changing `LF`.

Correct invariant:

# **Presentation/transient actions may not write Class A.**

Class A may be changed only by:

1. an explicit frozen Product action with authority over that field; or
2. an authoritative upstream/server event explicitly allowed by frozen semantics.

Update the state matrix and T-02 wording.

---

# 6. REV65-04 — AF64-02 PRACTICAL REPOSITIONING NEEDS A REAL ASSISTIVE MAPPING

## Approved part

The distinction is correct:

```text
presentation-position navigation
!=
temporal cursor navigation
```

A position control over the **already-disclosed presentation extent** is legal in principle.

---

## Candidate gap

The candidate claims O(1) / Moment-count-independent practical access for assistive interaction while its actual mapping is:

```text
adjustable
+ increment/decrement actions
```

That mechanism is still repeated adjustment unless the adjustment semantics themselves move the **presentation window** in bounded large presentation increments.

The current proof mixes:

- computational scroll addressing;
- direct pointer drag;
- keyboard first/last;
- repeated assistive increments.

These are not equivalent practical-cost proofs.

---

## Architecture ruling

Stage 6.5 v2 must define an explicit:

# **DISCLOSED-PRESENTATION POSITION SCALE**

This scale is presentation-only.

It may be normalized or otherwise bounded over:

```text
already-disclosed presentation extent
```

Examples of valid structural semantics:

```text
0% … 100% of disclosed presentation extent
```

or equivalent bounded presentation regions.

This is NOT session time and NOT a temporal unit.

---

## Requirements

For pointer/touch:
- direct presentation-position manipulation may map to a disclosed scroll offset.

For keyboard:
- first/last + page/local movement + direct/bounded presentation-position controls may be used.

For assistive interaction:
- provide actions whose user-interaction cost remains bounded/practical as Moment count grows;
- an adjustable presentation-position control may move by **presentation fractions/regions**, not one Moment;
- exposed value text may describe disclosed presentation position;
- no undisclosed/future extent participates.

After viewport reposition:

> exact Moment choice is a separate ordinary temporal action.

---

## Do not freeze algorithmic `O(1)`

Do NOT claim:

```text
scrollToIndex = O(1)
```

or any library internal complexity unless officially guaranteed and relevant.

The acceptance requirement is:

# **BOUNDED / PRACTICAL USER INTERACTION COST**

for large already-disclosed histories.

Required proof sizes:

```text
10,000 disclosed Moments
100,000 disclosed Moments
```

No semantic coarse temporal step.

---

# 7. REV65-05 — PROCESS-RESTART RECOVERY CANNOT REMAIN FOR STAGE 6.6 / CODING

## Candidate problem

§27 says process-restart behavior for:

```text
TM / TC / IF_ref / MC / RH
```

is not frozen and leaves the decision for Stage 6.6 / Product.

Stage 6.6 is a proof gate.

It should not be where a persistence architecture is invented.

And Claude Code must not decide this during implementation.

---

## Required Recovery Decision Gate

Stage 6.5 v2 must compare at least:

### R-01 — Process-session only

Committed navigation state survives rerender/background/reconnect but resets on cold process restart.

### R-02 — Same-device local committed-navigation persistence

Persist a versioned local committed navigation checkpoint sufficient to restore the current same-session navigation state after process restart.

Transient/presentation state remains nonpersistent.

### R-03 — Server/cross-device navigation persistence

Persist/sync navigation state remotely.

Likely highest complexity; include only for comparison.

---

## Evaluate each against

- inspection continuity;
- exact-return expectations;
- mobile process-kill reality;
- stale server truth;
- no-hindsight;
- RH semantics;
- same-session validation;
- closed/expired Session behavior;
- migration/versioning;
- privacy/security;
- implementation complexity;
- cross-device necessity.

Recommend ONE v1 policy.

Do not implement it.

The final Architecture review will freeze the policy before 6.6.

---

# 8. REV65-06 — NATIVE ESCAPE-HATCH POLICY UNDER EXPO CNG

The client-stack direction remains approved.

But candidate language equivalent to:

> config plugins / dangerous mods are the documented escape hatch

is too permissive.

Canonical v1 hierarchy:

## Level 1
Use supported Expo / React Native APIs and maintained libraries.

## Level 2
Use an idempotent Expo config plugin for native configuration.

## Level 3
Use an Expo Module / explicit native module when the capability requires native code.

## Level 4
Direct brittle generated-native-file manipulation / dangerous mods:

# **NOT PRE-AUTHORIZED**

May be used only under a task-specific Engineering Architecture review proving:

- no supported plugin/module path exists;
- idempotency/re-generation safety;
- upgrade risk is contained;
- CI verifies generated native output.

Manual edits to generated CNG native projects are not canonical source.

Update CS-01 Decision Record and T-01 constraints.

---

# 9. REV65-07 — MAP ACCESSIBILITY MUST INCLUDE NAVIGATION, NOT ONLY OBJECT OVERLAYS

## Candidate strength

The real-view overlay over entitled Map objects is a strong basis for accessible object semantics.

But §21 focuses mainly on:

- object identity;
- lifecycle;
- IF;
- Timeline.

It does not yet define a complete nonvisual/accessibility route for Stage 4 Map navigation.

---

## Required v2 Map Accessibility Mapping

Define platform-neutral mappings for at least:

- semantic Zoom In;
- semantic Zoom Out;
- Return World;
- Return Live Focus;
- Go Live + Locate;
- selectable/inspectable currently disclosed Map objects;
- contextual-locus choice;
- orientation/projection chrome.

For spatial Pan:

- do not require a screen-reader user to perform a geometric drag;
- define an equivalent route to navigate/explore the disclosed spatial field or move viewport when needed;
- do not create semantic geometry that differs from sighted users.

The accessible object set must derive from:

```text
V = Disclose(K(TC), depth, context)
```

not raw K(TC).

Do not expose off-depth/future objects merely to improve accessibility.

---

# 10. DELTA REGISTER CORRECTIONS REQUIRED

The v2 Architecture Delta Register must explicitly add/resolve rows for:

- canonical Moment/SP/LH substrate;
- canonical Thread entity;
- Thread establishment;
- Home-locus persistence;
- LF producer;
- lifecycle history;
- Reading/object ontology;
- KF/VF/VT historical reconstruction per object family;
- depth-disclosure view boundary;
- accessible Map navigation;
- process-restart committed-navigation recovery.

No load-bearing row may remain:

```text
UNKNOWN → resolve while coding
```

An `UNKNOWN / BLOCKER` may remain only if Stage 6.5 itself cannot settle it after read-only inspection.

If that occurs:

STOP and report it before 6.6.

---

# 11. TASK-SEQUENCE CORRECTION

The existing 12-task sequence may remain the base.

But no task may contain a hidden architecture-discovery gate that coding must decide.

In particular:

## T-02
Correct the Class-A writer invariant.

## T-03
Must execute a PRE-FROZEN contract, not discover:
- what a Moment is;
- what a Thread is;
- who owns LF;
- what KF/VF/VT mean per domain.

Those decisions must be closed in Stage 6.5 v2.

T-03 may implement migrations/API/projection mechanics after the mapping is frozen.

## T-04
Accessibility overlay consumes depth-disclosed view `V`.

## T-05
Must implement the concrete practical presentation-position mapping selected in v2.

## T-09
Must include Map navigation modality parity, not Timeline semantics only.

If these changes require splitting one Task for one architectural reason, adjust the count.

Do not preserve “12” merely for consistency.

---

# 12. Targeted Repository Inspection Required

Do NOT repeat broad repository inspection.

Perform targeted read-only inspection at `f322112e` sufficient to close REV65-01.

At minimum inspect relevant:

- conversation schema/types/services;
- finalization/commit lifecycle;
- hypothesis schema + lifecycle + update history;
- confidence history;
- information-gap/question lifecycle/history;
- association/relation durability;
- HIM snapshots/current/history where they feed the Map;
- latest hypothesis lifecycle completion;
- question closed-loop migrations;
- any provenance/audit tables;
- existing event/outbox contracts relevant to LH/LF;
- any canonical object-binding/context structures.

Search alone is not enough.

Read the relevant source/migrations.

If prior frozen Conversational Analysis Grammar material is required to identify committed conversational units and is not available in the repository/core checkpoint:

state the exact missing authority and STOP that sub-decision instead of equating raw turns with Moments.

---

# 13. Technical Documentation Rule

Do NOT redo the client-stack comparison.

Use targeted current official technical docs only where needed to:

- verify the selected RN/Expo/Skia/virtualization mapping;
- close the practical assistive window-position control;
- confirm native escape-hatch mechanics.

No new UX/HCI research.

---

# 14. Required v2 Candidate

Create:

# `QANDEEL_STAGE6_5_IMPLEMENTATION_CONTRACT_CANDIDATE_v2`

Do NOT rebuild unaffected sections from scratch.

Update/add only what is needed for:

1. Semantic Domain Mapping Record;
2. historical reconstructability matrix;
3. corrected Architecture Delta Register;
4. corrected state-class inventory;
5. corrected State Ownership Matrix;
6. corrected Action Catalog invariant;
7. K(TC) vs Semantic Disclosure View architecture;
8. accessibility view-source correction;
9. AF64-02 practical presentation-position mapping;
10. practical-reach proofs at 10k / 100k disclosed Moments;
11. Map accessibility/navigation mapping;
12. Recovery Decision Gate + recommendation;
13. Expo CNG native escape-hatch policy;
14. updated OPEN-17 seam proof;
15. updated backend/API/schema delta;
16. updated Timeline architecture;
17. updated Test Architecture / traceability;
18. updated Task/BR sequence and affected task contracts;
19. updated Dependency Graph;
20. updated risks/blockers;
21. Stage 6.6 proof inputs;
22. MUST / MUST NOT / SHOULD-MAY;
23. Implementation Decision Index;
24. Architecture Review Handoff;
25. architecture diagram if materially affected;
26. START_HERE/checksums.

Preserve approved CS-01 evidence and unaffected sections.

---

# 15. Required New Proofs

## P65-01 — Domain-history reconstructability

For each v1 analytical object family:

```text
identity known?
version history available?
validity reconstructable?
KF reconstructable?
historical then-current state reconstructable?
provenance available?
```

No assumption from `version` integer alone.

---

## P65-02 — Moment commitment

Fixture with:

- received;
- streaming;
- completed;
- cancelled;
- superseded/revised

conversation input/turn states.

Prove exactly which units become Timeline Moments and advance SP/LH.

---

## P65-03 — K vs depth

Same `TC`, same K(TC), two Semantic Zoom depths.

Expected:

- temporal truth identical;
- disclosed view differs;
- hidden-by-depth is not reported as historical absence;
- visual + accessibility consume same disclosed view.

---

## P65-04 — Practical reach 10k / 100k

For already-disclosed histories:

- pointer/touch;
- keyboard;
- assistive interaction.

Prove practical viewport reposition cost is bounded by presentation navigation design, not Moment count.

No temporal cursor change until exact Moment activation.

---

## P65-05 — OPEN-17 corrected seam

Two PARAM styles:

Expected:
- identical K(TC);
- identical depth-disclosed view V;
- identical canonical state;
- identical accessible semantic tree;
- identical Home loci;
- pixels may differ only in nonsemantic PARAM channels.

---

## P65-06 — Recovery policy

Cold restart while:
- FOLLOW_LIVE;
- PINNED historical;
- IF divergence;
- nonempty RH.

Demonstrate the selected v1 recovery policy deterministically.

No transient/presentation state survives unless explicitly authorized.

---

## P65-07 — Map modality parity

Demonstrate all frozen Map/navigation intents remain available without requiring:
- hover;
- drag-only;
- future/off-depth object exposure.

---

# 16. Stop Rules

STOP and report rather than inventing a contract if:

- canonical Moment cannot be mapped from available frozen/runtime authority;
- Thread identity/establishment cannot be defined without reopening Product Architecture;
- LF meaning/source requires a new Product semantic decision rather than implementation architecture;
- a v1 object family cannot support historical truth without a new upstream product rule;
- practical assistive presentation repositioning requires a coarse temporal unit;
- process-restart recovery requires changing Stage 5 return semantics;
- accessible Map parity requires exposing unavailable/off-depth material;
- selected client stack cannot meet the corrected contracts.

Do not move an unresolved Architecture question into T-01…T-12.

---

# 17. Final Status

Stage 6.5 remains:

# **ACTIVE — TARGETED REVISION**

Stage 6.6 is NOT authorized yet.

Implementation is NOT authorized.

No coding.
