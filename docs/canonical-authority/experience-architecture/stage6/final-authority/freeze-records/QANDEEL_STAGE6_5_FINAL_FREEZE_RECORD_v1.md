# QANDEEL — Stage 6.5 Final Freeze Record v1
## Implementation Contract + Build Sequencing

**Status:** CLOSED / FROZEN  
**Date:** 2026-09-03  
**Stage:** 6 — Experience Closure + Implementation Readiness  
**Task:** 6.5 — Implementation Contract + Build Sequencing  
**Authority:** Product / Experience / Engineering Architecture  
**Approved Candidate:** `QANDEEL_STAGE6_5_IMPLEMENTATION_CONTRACT_CANDIDATE_v3`  
**Canonical Repository Baseline:** `f322112ec5b862a83716bf9d65b4553b06931774`

---

# 1. Final Architecture Verdict

The Stage 6.5 v3 package is APPROVED subject to the Architecture Freeze Clarifications in this record.

# **STAGE 6.5 — CLOSED / FROZEN**

No v4 candidate is required.

The candidate successfully closes the implementation-sensitive Product/domain questions that must not be delegated to coding:

- `Moment`;
- `SP`;
- `LH`;
- committed Conversational Units;
- Emerging Focus;
- Thread constitution;
- Thread establishment;
- permanent Home;
- Thread lifecycle;
- Reading ↔ Thread contextual binding;
- `LF`;
- `K(TC)` vs Semantic Zoom disclosure `V`;
- R-02 restart/recovery;
- client-stack direction;
- accessibility / Map modality mapping;
- practical presentation-position navigation;
- OPEN-17 implementation seam direction;
- build / migration / test sequencing.

No Product semantic blocker remains.

---

# 2. Package Integrity Review

Reviewed:

- `STAGE6_5_IMPLEMENTATION_CONTRACT_CANDIDATE_v3.md`
- `START_HERE.md`
- `diagrams/S6.5_v3_Implementation_Architecture.png`
- `SHA256SUMS.txt`

Recorded SHA256 digests match the extracted artifact bytes.

The architecture diagram is accepted as implementation-architecture proof scaffolding.

---

# 3. Client Stack — FINAL FREEZE

The v1 mobile-client direction is:

# **React Native New Architecture + Expo CNG + TypeScript**

inside:

```text
apps/mobile
```

for:

```text
iOS + Android
```

Canonical implementation principles:

- shared TypeScript contracts through the monorepo;
- native escape hatches only through the frozen four-level policy;
- no authority granted to the local untracked Expo spike;
- custom spatial renderer may use GPU/canvas infrastructure;
- accessible semantics come from real platform Views / accessibility surfaces derived from the same entitled disclosed view;
- no rendering/layout framework gains authority over canonical Map geography.

Exact dependency/library versions are implementation pins, not Product semantics.

---

# 4. Moment / SP / LH — FINAL FREEZE

Canonical implementation mapping:

# **ONE COMMITTED CONVERSATIONAL UNIT = ONE MOMENT**

```text
Moment(m) = committed CU
SP(m)     = gapless per-session ordinal of that committed CU
LH        = greatest committed CU SP in the current Session
```

A Moment is NOT:

- a raw runtime turn;
- a USER + ASSISTANT exchange;
- a timestamp;
- provisional/live/revisable source.

One turn may yield:

```text
0..N committed CUs
```

A CU:

- belongs to exactly one turn;
- never crosses a turn boundary;
- has stable speaker/attribution/provenance;
- becomes a Moment only at the frozen committed-unit boundary.

---

# 5. Architecture Freeze Clarification AF65-01
## T-03A1 includes the commitment producer, not storage only

The v3 Delta Register correctly identifies:

```text
CU commitment producer = MISSING / BUILD
```

but the T-03A1 wording focuses heavily on the `conversation_units` substrate.

Canonical T-03A1 scope is:

# **Committed CU Constitution + Commitment Producer + Durable Substrate**

T-03A1 MUST implement:

1. the executable CU boundary/commitment evaluator from INPUT-01;
2. committed-CU creation;
3. exact immutable source provenance;
4. commitment provenance/policy version;
5. append-only durable storage;
6. rejection of cross-turn CUs;
7. rejection of provisional source as permanent analytical truth.

The implementation must not create a table and leave CU constitution to an unspecified later service.

If the provider-assisted segmentation path is used:

- the provider result must be committed as durable canonical fact;
- it is not re-derived at read time;
- replay uses the stored committed CU, not a new model inference.

---

# 6. Multi-CU commitment transaction — FINAL CLARIFICATION

If one source-finalization operation commits several CUs:

the database operation MAY be one atomic transaction.

But semantically, each committed CU has its own `SP`.

Within the transaction, process committed CUs in canonical source order.

For each CU/SP, execute the frozen order:

```text
1. commit CU / assign SP
2. resolve references + conversational focus
3. resolve Emerging Focus continuity
4. optionally establish Thread
5. resolve effective LF for that SP
```

Therefore:

> **One batch transaction may contain several sequential Moment establishments. It does not collapse them into one focus/LF decision.**

There remains exactly one effective `LF` for each committed `SP`.

Earlier SP results are never rewritten by later CUs in the same batch.

---

# 7. CU-commit delivery — idempotency clarification

The Product contract requires an equivalent of:

```text
ConversationalUnitsCommitted
```

to expose that `LH` advanced without content leakage.

The implementation MUST NOT canonically depend on:

```text
exactly one CU-commit event per source turn
```

unless INPUT-01 + the final commitment producer prove that invariant.

If a source turn can produce more than one durable CU-commit operation:

the outbox idempotency key must use an explicit:

- commitment/batch identity;
- event identity;
- or equivalent stable deduplication key.

Do not force the Product commitment lifecycle to fit the existing:

```text
UNIQUE(event_type, subject_turn_id)
```

constraint.

That existing constraint may be reused only if the final CU producer proves one commit batch per source turn.

---

# 8. Thread — FINAL FREEZE

A Thread is:

> **a persistent navigable locus of genuine conversational attention around one sufficiently identifiable, user-addressable focus/subject.**

Lifecycle:

```text
Mention / reference
→ Emerging Focus
→ Established Thread
→ Active ↔ Dormant ↔ Reopened
```

Persistent geography begins only at Establishment.

Thread establishment paths:

- TE-01 explicit user conversational selection;
- TE-02 sustained substantive engagement;
- TE-03 recurrent independent attention.

Forbidden constitutions:

- hypothesis graph connected component;
- lexical similarity alone;
- embedding clustering;
- keyword count;
- generic numeric score;
- elapsed timer;
- QANDEEL analytical interest alone.

Home is assigned exactly once at establishment from then-legitimate world context and remains immutable.

No Thread merge path exists in v1.

---

# 9. Emerging Focus — FINAL FREEZE

Every Emerging Focus that can participate in LF has a:

# **stable session-scoped `emerging_focus_id`**

It is:

- provisional;
- pre-geographic;
- conversation-grounded;
- not a Thread;
- allowed to terminate without geography.

If promoted:

```text
EmergingFocus(id)
→ promoted_to
→ Thread(thread_id)
```

the earlier Emerging history remains intact.

No historical rewrite.

---

# 10. Live Focus — FINAL FREEZE

```text
LF =
    NONE
  | EmergingFocus(emerging_focus_id)
  | EstablishedThread(thread_id)
```

`LF` means:

# **current live conversational attention only**

It is analysis-derived from committed conversation.

It is NOT:

- Map inspection;
- Pan/Zoom;
- latest click;
- user-owned context activation;
- importance;
- rank;
- confidence;
- Reading strength.

No client action writes `LF`.

LF transitions are:

- server-authoritative;
- append-only;
- `SP`-anchored;
- durable canonical facts;
- never re-derived at historical read time.

---

# 11. `K(TC)` vs `V` — FINAL FREEZE

Keep two distinct semantic layers:

```text
K(TC) = TemporalProject(W, TC)

V = Disclose(K(TC), semanticDepth, inspectionContext)
```

## `K(TC)` owns
- knowledge availability;
- then-current validity;
- contextual availability;
- relation/evidence/confidence/question entitlement;
- lifecycle truth;
- Thread establishment membership;
- no-hindsight filtering.

## `V` owns
- Semantic Zoom disclosure;
- depth withholding;
- current inspection/depth view.

Visual renderer, accessibility semantic surfaces and field navigation operate from:

# **the same disclosed view `V`**

Depth withholding is never historical absence.

Transport/fetch strategy may be lazy.

`NOT_FETCHED` is not `NOT_KNOWN_AT_TC`.

---

# 12. Architecture Freeze Clarification AF65-02
## `NOT_RECONSTRUCTABLE` is a technical coverage condition, not a Product epistemic state

The v3 candidate uses:

```text
NOT_RECONSTRUCTABLE
```

for legacy object families whose past state cannot be recovered from the existing schema.

This MUST NOT become:

- a fourth canonical `K(TC)` truth state;
- historical absence;
- “QANDEEL did not know this”;
- a renderer/a11y state equivalent to `NOT_KNOWN_AT_TC`.

Canonical interpretation:

# **HISTORICAL DATA COVERAGE FAILURE / IMPLEMENTATION SAFETY CONDITION**

If the server cannot truthfully reconstruct a required historical fact:

- it must fail closed;
- it must not substitute today's value;
- it must not convert technical missing history into epistemic absence;
- it must not expose false historical projection.

For supported v1 Sessions, the implementation must provide sufficient history capture from the beginning of the supported Session's analytical lifecycle.

Stage 6.6 must prove this release invariant.

---

# 13. Historical reconstruction completeness — FINAL IMPLEMENTATION REQUIREMENT

T-03C must close historical capture for **every mutable semantic field that v1 `V` may expose historically**.

At minimum this includes, where present in the v1 object family:

## Reading
- status/lifecycle;
- statement/content version;
- assumptions;
- disconfirming conditions;
- Evidence participation;
- peer/Reading relations;
- contextual Thread bindings;
- provenance necessary to distinguish lineage.

## Material / Memory
All mutable/superseding fields exposed by historical `V`.

## Unknown / Information Gap
- open/closed/reopened lifecycle epochs;
- fields whose then-current state is displayed.

## Question / Contextual Appearance
Any mutable lifecycle/context field not already immutable/append-only.

## Confidence
Existing append-only/version-targeted history may be reused where sufficient.

## Thread / Emerging / LF
Use the new append-only SP-anchored histories frozen by Stage 6.5.

If a v1-exposed field cannot be historically reconstructed:

# **Stage 6.6 fails readiness.**

Do not ship a historical view that silently omits a technically unreconstructable fact.

---

# 14. History coverage for pre-migration data

A migration/audit start boundary is:

# **technical history coverage metadata**

not `KF`.

If repository data predates complete history capture:

the implementation must distinguish:

```text
technical history coverage
```

from:

```text
QANDEEL knowledge availability
```

For v1 release, Stage 6.6 must prove one of:

1. supported user Sessions begin only after complete history-capture contracts are active; or
2. earlier supported Sessions are truthfully backfilled/reconstructable.

No UI may use “knowledge-horizon” language for a merely technical audit-start boundary.

---

# 15. OPEN-17 seam — FINAL FREEZE

Only:

```text
RenderStyle.ambient
RenderStyle.emptySpace
```

or an equivalently narrow presentation-only seam may remain tunable.

The seam:

- is not an input to `K(TC)`;
- is not an input to `V`;
- cannot move Home loci;
- cannot receive future-relative data;
- carries no semantic meaning;
- cannot alter accessibility semantics.

Two parameter values must yield:

- identical canonical state;
- identical `K(TC)`;
- identical `V`;
- identical Home loci;
- identical accessible semantic tree.

Only nonsemantic pixels may differ.

Any implementation channel failing this proof becomes FIXED or is removed.

---

# 16. Accessibility / Map modality — FINAL FREEZE

Accessible semantics derive from `V`.

The implementation must expose non-drag/nonvisual equivalents for frozen Map intents including:

- inspect disclosed object;
- Semantic Zoom In;
- Semantic Zoom Out;
- Return World;
- Return Live Focus;
- Go Live + Locate;
- contextual-locus choice;
- disclosed-field/viewport exploration where needed.

Accessibility MUST NOT gain access to:

- future objects;
- off-depth objects;
- future range membership;
- unavailable contexts

merely to make navigation easier.

---

# 17. Practical Timeline reach — FINAL FREEZE

Keep separate:

```text
temporal traversal
vs
presentation-window navigation
```

Temporal traversal:

- one Moment / committed CU at a time;
- may repeat faster by input duration;
- earns undisclosed forward truth progressively.

Presentation-window navigation:

- operates only over already-disclosed targets;
- changes no `TM`;
- changes no `TC`;
- creates no `PTC`;
- writes no RH;
- chooses no Moment.

Stage 6.5's disclosed-presentation position scale remains approved.

Stage 6.6 must prove practical bounded interaction cost at:

- 10,000 disclosed Moments;
- 100,000 disclosed Moments;

for pointer/touch, keyboard and assistive interaction.

No coarse temporal semantic unit.

---

# 18. R-02 recovery — FINAL FREEZE

v1 uses:

# **same-device local committed-navigation persistence**

Persist a versioned app-private checkpoint sufficient to restore:

- Session identity;
- `TM`;
- `TC`;
- `IF_ref`;
- canonical camera intent;
- `RH`.

Do NOT persist:

- `PTC`;
- animation progress;
- input stream;
- Timeline presentation window;
- disclosed-presentation position;
- responsive layout;
- cached `K(TC)`;
- cached `V`.

On cold restart:

- validate checkpoint/session/version;
- re-read authoritative `LH`;
- re-read authoritative `LF`;
- recompute `K(TC)`;
- recompute `V`;
- restore no transition animation;
- write no RH for restart.

If the stored Session is no longer current/valid:

discard the checkpoint whole and enter canonical app/session entry routing.

Do not synthesize `FOLLOW_LIVE` for a non-current Session.

---

# 19. Architecture Freeze Clarification AF65-03
## Correct implementation dependency graph

The v3 dependency graph incorrectly treats:

- T-03C;
- T-03D

as independent immediately after T-03A2.

That conflicts with the v3's own frozen same-SP semantic order.

Correct dependency authority:

```text
T-01
  ↓
T-02
  ↓
T-03A1
  ↓
T-03A2
  ↓
T-03B1
  ↓
T-03B2
  ├──────────────▶ T-03D
  ↓                  │
T-03B3               │
  └──────────┬───────┘
             ↓
           T-03C
          /      \
       T-04      T-05
                   ↓
                 T-06
                   ↓
                 T-07
                   ↓
                 T-08
                   ↓
                 T-10
                   ↓
                 T-11
                   ↓
                 T-12
```

T-13 Recovery may proceed after T-02 + the relevant authoritative API/state contracts are stable; final integration still joins T-12.

T-09 accessibility/modality work remains integrated alongside T-04…T-08 and must gate each owning component.

## Why

T-03D requires:

- reference/focus continuity from T-03B1;
- Thread establishment semantics from T-03B2;

because same-SP order is:

```text
focus continuity
→ optional Thread establishment
→ effective LF
```

T-03C full projection requires the canonical schemas/histories for:

- Emerging Focus;
- Thread establishment/lifecycle;
- Thread↔Reading bindings;
- LF transitions;

before it can freeze one integrated historical projection contract.

Do not implement a “temporary projection” that later changes semantic membership rules.

---

# 20. T-03C scope correction

T-03C is:

# **Historical Coverage Completion + Layer A Projection + Layer B Disclosure**

It must not merely add:

- peer relation history;
- assumptions;
- gap epochs.

It must implement/verify complete history capture for all v1 historical fields listed in §13 of this Freeze Record.

Its gate is:

> Every semantic fact exposed by historical `V` is either reconstructable at the target TC or Stage 6 readiness fails.

`NOT_RECONSTRUCTABLE` is an internal fail-closed condition, not a valid Product projection result.

---

# 21. Task count

The candidate's 19-task structure remains acceptable after the dependency correction.

No task count is frozen for cosmetic reasons.

If implementation review before a task begins proves one task contains two independent architectural reasons:

it may be split by Architecture before coding that task.

Do not merge tasks merely to preserve the count.

---

# 22. Required frozen-authority inputs — FINAL HANDOFF RULE

The v3 correctly identifies:

- INPUT-01 — Stage 1.2 CU boundary / commitment grammar;
- INPUT-02 — Stage 1 reference / attention / coreference grammar;
- INPUT-03 — Thread Establishment evidence predicates.

These are NOT optional background reading.

Before implementation is authorized, Stage 6.6 MUST produce an:

# **IMPLEMENTATION AUTHORITY BUNDLE**

that identifies the exact canonical source artifact(s) for INPUT-01…03 and makes them available to the owning implementation tasks.

The bundle must include:

- exact artifact/file name;
- canonical/frozen status;
- relevant section/contract identifiers;
- integrity/version reference where available;
- owning implementation Tasks.

No task may begin from paraphrased memory if the detailed frozen artifact is available.

If the exact source artifact cannot be supplied:

# **Stage 6.6 must STOP.**

---

# 23. Build-sequence authority

The v3 task contracts are approved subject to:

- AF65-01;
- AF65-02;
- AF65-03;
- the expanded T-03C coverage rule.

Implementation tasks remain NON-AUTHORIZED until Stage 6.6 passes.

---

# 24. Final blocker status

## Product blockers

**NONE**

## Technical blockers

**NONE currently proven**

## Stage 6.6 readiness gates

The following must still be proven, not decided:

1. exact INPUT-01…03 authority bundle exists;
2. every v1 historical field has truthful coverage;
3. corrected dependency graph is internally deterministic;
4. practical 10k/100k Timeline reach works on the selected client stack;
5. OPEN-17 seam is structurally isolated;
6. accessible Map/Timeline topology preserves no-hindsight;
7. R-02 recovery preserves Stage 5 semantics;
8. all frozen acceptance tests map to implementation tests;
9. no coding Task retains a Product-semantic TODO.

---

# 25. Current Stage Status

```text
Stages 0–5                              CLOSED / FROZEN
Stage 6.1                              CLOSED / FROZEN
Stage 6.2                              CLOSED / FROZEN
Stage 6.3                              CLOSED / FROZEN
Stage 6.4                              CLOSED / FROZEN
Stage 6.5                              CLOSED / FROZEN
Stage 6.6                              NEXT
Implementation                        NOT AUTHORIZED
```

---

# 26. Authority Precedence

For Stage 6.5 implementation planning:

```text
This Final Freeze Record
    >
Stage 6.5 Candidate v3
    >
Stage 6.5 v3 Architecture Diagram
    >
earlier v2/v1 candidate wording
```

AF65-01…AF65-03 and the historical-coverage clarification are binding.

No implementation task may rely on superseded v3 wording where this record narrows or corrects it.
