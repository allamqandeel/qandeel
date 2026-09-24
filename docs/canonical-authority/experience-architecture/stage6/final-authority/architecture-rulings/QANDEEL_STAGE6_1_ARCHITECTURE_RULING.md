# QANDEEL — Stage 6.1 Architecture Ruling
## OPEN Register Triage + V1 Cutline — Narrow Classification Corrections

**Architecture Review Status:** TARGETED REVISION REQUIRED  
**Scope:** Two OPEN classifications only  
**Base Candidate:** `QANDEEL_STAGE6_1_OPEN_TRIAGE_CANDIDATE_v1`

All classifications not explicitly changed below are accepted as candidate directions.

Do NOT redo Stage 6.1 from scratch.
Do NOT solve any OPEN.
Do NOT design UI.
Do NOT modify the repository.
Do NOT code.

---

# 1. Accepted Candidate Classifications

The following candidate classifications are APPROVED:

## A — MUST RESOLVE BEFORE IMPLEMENTATION

- **OPEN-13 — Timeline axis / scale policy**

Architecture agrees that this is the only currently proven pre-core-implementation blocker.

Reason:

> Every Track renderer necessarily embodies a temporal geometry/scale model. “Temporary arbitrary spacing” is not semantically neutral because visible spacing itself communicates temporal structure.

Deferring OPEN-13 would not postpone the decision; it would transfer Product authority to implementation/layout code.

---

## B — MUST RESOLVE BEFORE UX POLISH, NOT CORE IMPLEMENTATION

Accepted:

- **OPEN-02 — P3a locate-affordance vocabulary**
- **OPEN-10 — minimum semantic motion contract**
- **OPEN-12 — LIVE_EDGE vs latest absolute Moment legibility**
- **OPEN-14 — neutral aggregation encoding**
- **OPEN-15 — lifecycle-state visual legibility**
- **OPEN-16 — sparse-projection orientation cue**
- **OPEN-18 — IF_ref vs rendered-version legibility**

These may remain unresolved while core semantic/state mechanics are built, but production-ready Experience cannot freeze without resolving them.

---

## C — IMPLEMENTATION CONTRACT CAN PRESERVE AS PARAMETER / STRATEGY

Accepted provisionally:

- **OPEN-17 — neighbourhood-expression variation bounds**

This C classification is valid only if Stage 6.5 proves an invariant-preserving seam in which:

- canonical Home commitments never move;
- no future-relative information changes neighbourhood expression;
- no user-visible semantic meaning depends on the parameter;
- the conservative/default implementation is valid under all frozen Stage 3–5 rules;
- later tuning requires no state/schema/event/RH/accessibility migration.

OPEN-17 remains owned by Stage 6.3/6.5 as appropriate.

---

## D — DEFER BEYOND V1

Accepted:

- **OPEN-06 — in-session temporal bookmarks**
- **OPEN-09 — object-originated version jump**

No visible placeholder, persistence schema, dormant control or speculative navigation hook should be created solely for either feature in v1.

---

# 2. CORRECTION CR-01 — OPEN-08

## Candidate classification
`C — IMPLEMENTATION CONTRACT CAN PRESERVE AS PARAMETER / STRATEGY`

## Architecture ruling
# `D — DEFER BEYOND V1`

### Reason

OPEN-08 asks whether v1 requires **coarse temporal-step granularity** beyond the already-frozen temporal navigation grammar.

The v1 accessibility obligation is:

> non-pointer / assistive interaction must have truthful, practical access to the frozen temporal navigation semantics.

That obligation does **not** entail coarse stepping as a product feature.

Coarse stepping is only one possible Experience solution.

Therefore:

- v1 must satisfy accessibility/non-pointer reach equivalence;
- Stage 6.4 owns that obligation;
- Stage 6.4 must not assume that coarse stepping exists;
- no coarse-step control, state, storage, event type or strategy hook should be reserved merely “in case”;
- if Stage 6.4 later proves that faithful accessible interaction cannot be achieved without coarse stepping, that is new dependency evidence and Architecture may explicitly reopen OPEN-08.

### Why C is rejected

A C classification would preserve a product capability merely because it might become useful.

That violates:

- TG-02 — feature existence vs feature expression;
- CUT-02 — do not solve optional product features merely because they exist;
- CUT-06 — no speculative scaffolding.

The frozen requirement is **reach equivalence**, not **coarse stepping**.

---

# 3. CORRECTION CR-02 — OPEN-19

## Candidate classification
`B — MUST RESOLVE BEFORE UX POLISH, NOT CORE IMPLEMENTATION`

## Architecture ruling
# `D — DEFER BEYOND V1`

### Reason

The semantic contract for a true no-op is already complete:

```text
no effective action-attributable change
→ no RH transaction
```

Nothing in Stages 0–5 requires a dedicated acknowledgement event, animation, toast, vibration, spoken response or other explicit no-op feedback.

For v1:

- a control may simply remain in its already-correct state;
- existing state/orientation indication may provide sufficient feedback;
- no dedicated no-op acknowledgement mechanism is required for semantic correctness;
- no special persistent/transient product state is required;
- no RH effect exists.

Accessibility must still expose the actual current state truthfully, but that does not require a special “nothing happened” product feature.

### First failure if deferred

**No semantic or implementation failure occurs in v1 solely because a dedicated no-op acknowledgement is absent.**

Therefore the earliest proven deadline is beyond v1.

If later usability/accessibility testing demonstrates a concrete comprehension failure, OPEN-19 may be reconsidered as an Experience enhancement.

### Scope rule

Do NOT reserve:

- a dedicated no-op event type;
- animation slot;
- announcement contract;
- haptic contract;
- state field;
- RH marker

solely for OPEN-19 in v1.

---

# 4. Revised V1 Cutline

## LIST 1 — MUST CLOSE BEFORE CORE IMPLEMENTATION

Exactly:

- **OPEN-13**

---

## LIST 2 — CORE MAY BEGIN FIRST, BUT THESE MUST BE CLOSED / SPECIFIED BEFORE STAGE 6 FREEZE OR PRODUCTION-READY UX

### B items
- **OPEN-02**
- **OPEN-10**
- **OPEN-12**
- **OPEN-14**
- **OPEN-15**
- **OPEN-16**
- **OPEN-18**

### C seam
- **OPEN-17**

Total: **8 items**

---

## LIST 3 — OUT OF V1

- **OPEN-06**
- **OPEN-08**
- **OPEN-09**
- **OPEN-19**

Total: **4 items**

---

# 5. Stage 6 Ownership Map — Revised

## Stage 6.2 — Timeline Interaction + Legibility Completion

Own:

- OPEN-13 — axis / scale policy
- OPEN-02 — P3a locate-affordance semantics/recognizability
- OPEN-12 — LIVE_EDGE vs latest Moment legibility
- OPEN-14 — neutral aggregation encoding

Do NOT include:
- OPEN-06
- OPEN-08
- OPEN-09

---

## Stage 6.3 — Historical Map + Inspection Legibility Completion

Own:

- OPEN-15 — lifecycle-state legibility
- OPEN-16 — sparse historical orientation
- OPEN-18 — IF_ref vs rendered-version legibility
- OPEN-17 — neighbourhood-expression bounds / invariant seam

Do NOT include OPEN-19.

---

## Stage 6.4 — Motion + Accessibility + Responsive Experience Contract

Own:

- OPEN-10 — minimum semantic motion contract

Also own the already-frozen obligations for:

- non-pointer temporal access;
- screen-reader parity;
- focus semantics;
- mobile/narrow parity.

Important:

> Stage 6.4 must solve those obligations without assuming OPEN-08 coarse stepping exists.

If that proves impossible, stop and report new dependency evidence rather than silently reviving OPEN-08.

---

## Stage 6.5 — Implementation Contract + Build Sequencing

Must consume:

- the resolved Stage 6.2 decisions;
- the resolved Stage 6.3 decisions;
- the Stage 6.4 motion/accessibility/responsive contract;
- the invariant-preserving OPEN-17 seam if OPEN-17 remains C.

Must not create implementation scaffolding for:

- OPEN-06;
- OPEN-08;
- OPEN-09;
- OPEN-19.

---

# 6. Required Candidate Revision

Create:

`QANDEEL_STAGE6_1_OPEN_TRIAGE_CANDIDATE_v2`

Do NOT repeat the dependency analysis from scratch.

Update only:

1. OPEN-08 classification and rationale;
2. OPEN-19 classification and rationale;
3. dependency-matrix classification/deadline/owner cells affected by those changes;
4. inter-OPEN coupling notes if affected;
5. the adversarial “first failure if deferred” rows for 08 and 19;
6. V1 Cutline Lists 1–3;
7. Stage 6 ownership map;
8. Stage 6.2 / 6.3 / 6.4 scope reduction;
9. Stage 6.5 implementation-contract inputs;
10. V1 Cutline Decision Index;
11. Architecture Review Handoff;
12. package checksums/index if present.

Preserve all unaffected v1 evidence.

---

# 7. Stop Rule

If CR-01 or CR-02 creates a genuine new dependency conflict with frozen Stages 0–5:

STOP and report the exact conflict.

Do not compensate by changing another OPEN classification silently.

Otherwise return v2 for final Architecture sign-off.

Do not declare Stage 6.1 frozen yourself.
