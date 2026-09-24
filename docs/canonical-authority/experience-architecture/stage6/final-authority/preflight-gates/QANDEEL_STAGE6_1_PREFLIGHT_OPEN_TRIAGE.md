# QANDEEL — Stage 6 Launch + Stage 6.1 Pre-Flight Contract Gate
## Experience Closure + Implementation Readiness
### Task 6.1 — OPEN Register Triage + V1 Cutline

**Status:** PRE-FLIGHT ONLY  
**Authority:** Product / Experience / Architecture  
**Upstream:** Stages 0–5 CLOSED / FROZEN  
**Canonical Entry Point:** `QANDEEL_CANONICAL_CORE_CHECKPOINT_v2.md`

---

# 0. Stage 6 Canonical Name

# **Stage 6 — Experience Closure + Implementation Readiness**

Stage 6 exists to convert the frozen product/interaction architecture into a **buildable v1 experience contract**.

It is the final non-coding phase before implementation.

Stage 6 must:

- close only the Experience decisions genuinely required before implementation;
- explicitly defer nonessential product ideas instead of solving everything;
- turn frozen architecture into implementation-ready interaction contracts;
- preserve the distinction between semantic truth and visual treatment;
- produce a finite, reviewable build handoff;
- avoid reopening Stages 0–5.

Stage 6 does NOT authorize coding by itself.

Coding begins only after Stage 6 final freeze / implementation authorization.

---

# 1. Provisional Stage 6 Structure

The following structure is the current Architecture plan.

Only **6.1** is active now.

## 6.1 — OPEN Register Triage + V1 Cutline
Classify every remaining OPEN as:
- must resolve before implementation;
- may defer beyond v1;
- implementation-spec only;
- already semantically resolved but needs Experience expression.

## 6.2 — Timeline Interaction + Legibility Completion
Resolve only the Timeline-side Experience decisions that 6.1 proves are implementation-blocking.

Likely candidates include:
- P3a affordance vocabulary;
- Live Edge vs latest Moment legibility;
- Timeline axis/scale policy;
- neutral aggregation encoding;
- coarse stepping only if required.

## 6.3 — Historical Map + Inspection Legibility Completion
Resolve Map-side visual/interaction expression required to implement:
- lifecycle-state legibility;
- sparse historical orientation;
- neighbourhood-expression bounds;
- `IF_ref` vs rendered-version legibility;
- no-op acknowledgement if required.

## 6.4 — Motion + Accessibility + Responsive Experience Contract
Resolve only implementation-required:
- motion semantics;
- transition priorities;
- accessible interaction topology;
- keyboard/non-pointer equivalence;
- narrow/mobile projection behavior.

No semantic architecture may be reopened.

## 6.5 — Implementation Contract + Build Sequencing
Translate frozen Product / Experience contracts into:
- state ownership;
- action/event contracts;
- component responsibilities;
- renderer boundaries;
- accessibility acceptance criteria;
- test fixtures;
- failure behavior;
- PR/task sequencing.

This is specification, not coding.

## 6.6 — Integrated Implementation-Readiness Proof + Stage 6 Freeze
Prove that:
- all implementation-blocking experience decisions are closed;
- all deferred items are explicitly non-blocking;
- no contradictory UI behavior remains;
- Claude Code can implement without inventing Product/Architecture semantics.

After 6.6 freezes, coding may begin under a separately authorized implementation phase.

---

# 2. Stage 6.1 Purpose

Stage 6.1 asks one question:

> **Which remaining OPEN items must be resolved before QANDEEL can be implemented faithfully as v1, and which should deliberately remain deferred?**

Do NOT solve the OPENs yet.

Do NOT design final UI.

Do NOT conduct broad visual exploration.

Do NOT code.

The output of 6.1 is a **dependency/cutline decision**, not a design package.

---

# 3. Frozen Upstream Authority

Treat `QANDEEL_CANONICAL_CORE_CHECKPOINT_v2.md` as the canonical entry point.

Stages 0–5 are CLOSED / FROZEN.

Do not reopen:

- persistent Map world;
- Stage 3 visual direction;
- Stage 4 navigation;
- Stage 5 state model;
- two temporal modes;
- Timeline current-session domain;
- `Moment(m)` vs `LIVE_EDGE`;
- Preview/Commit/Settle;
- no-hindsight;
- historical projection;
- canonical geography;
- `IF_ref` / `IF_render`;
- RH / Exact Return;
- return action distinctions;
- P5 post-live one-shot binding;
- mobile truth parity;
- accessibility epistemic parity.

If an OPEN appears to require reopening one of these, flag the conflict rather than reinterpreting the frozen contract.

---

# 4. Current OPEN Register

Classify each of these.

## OPEN-02 — P3a locate-affordance vocabulary
Question:
What explicit user affordance expresses single-act Temporal+Locate without confusing temporal-only navigation?

## OPEN-06 — In-session temporal bookmarks
Question:
Should v1 expose explicit user-created or system-recognized temporal bookmarks within the current Session?

Important:
Existence of bookmarks is not frozen.

## OPEN-08 — Coarse temporal-step granularity
Question:
Does v1 require a coarser discrete temporal navigation unit beyond ±1 Moment / direct addressing?

## OPEN-09 — Object-originated version jump
Question:
Should an object/version inspection offer a temporal jump to a relevant version boundary/current-session Moment?

Do not use `VF/VT` as Timeline address.

## OPEN-10 — Motion
Question:
What motion semantics are required to preserve orientation and truth across temporal change, zoom, appearance/disappearance, and return?

## OPEN-12 — Final `LIVE_EDGE` vs latest absolute Moment affordance
Question:
How does the final experience make two different meanings legible even when they occupy the same current coordinate?

Semantic distinction is already frozen.

## OPEN-13 — Timeline axis / scale policy
Question:
What is the visible temporal scale model:
- ordinal;
- duration-proportional;
- adaptive;
- another explicitly defined policy?

Do not change Stage 5 no-hindsight.

## OPEN-14 — Neutral aggregation encoding
Question:
How does dense Timeline disclosure aggregate without implying analytical importance?

## OPEN-15 — Lifecycle-state visual legibility
Question:
How are Established Active / Dormant / Reopened states perceptibly distinct without changing identity or geography?

## OPEN-16 — Sparse-projection orientation cue
Question:
How does the experience reassure/orient the user in a sparse historical viewport without camera rescue or future placeholders?

## OPEN-17 — Neighbourhood-expression variation bounds
Question:
How much may local visual expression vary with then-current legitimate content while preserving fixed spatial commitments and avoiding perceived relayout?

## OPEN-18 — `IF_ref` vs rendered-version legibility
Question:
How does the experience communicate that the requested inspection reference may be R2 while the historically correct default Map shows R1?

Semantics are already frozen.

## OPEN-19 — Transient no-op acknowledgement form
Question:
Should/how does QANDEEL acknowledge an explicit command that produces no effective state change without creating RH/history state?

---

# 5. Required Classification Vocabulary

For each OPEN, assign exactly one primary classification:

## A. `MUST RESOLVE BEFORE IMPLEMENTATION`
Claude Code cannot implement a faithful v1 without a Product/Experience decision.

## B. `MUST RESOLVE BEFORE UX POLISH, NOT CORE IMPLEMENTATION`
Core semantics can be built first, but production-ready interaction cannot freeze without the decision.

## C. `IMPLEMENTATION CONTRACT CAN PRESERVE AS PARAMETER / STRATEGY`
The behavior can be implemented behind an explicit seam without deciding the final Experience form yet.

This classification is allowed only if:
- the seam has deterministic semantics;
- no implementation choice would accidentally become Product semantics;
- later resolution can be changed without schema/state-model migration or interaction-meaning breakage.

## D. `DEFER BEYOND V1`
The feature/decision is not required for v1 correctness or core usability.

Do not reserve visible UI, state, storage, or navigation behavior for it unless independently needed.

## E. `AMBIGUOUS — NEEDS ARCHITECTURE RULING`
Use only if the OPEN cannot be classified without a genuine unresolved dependency.

Do not resolve it yourself.

---

# 6. V1 Cutline Principles

The v1 cutline must be strict.

## CUT-01 — Correctness before completeness
An OPEN is implementation-blocking if leaving it open would force an implementer to invent semantic behavior.

## CUT-02 — Do not solve optional product features merely because they exist
If QANDEEL can deliver the frozen core experience without an OPEN, prefer defer.

## CUT-03 — Experience expression may be blocking even when semantics are frozen
Example:
`LIVE_EDGE` vs `Moment(LH)` semantics are frozen, but if the implemented control cannot communicate the distinction, the experience is not shippable.

## CUT-04 — Visual polish is not automatically implementation-blocking
A final texture/color/icon may defer if structure and semantics can be implemented correctly.

## CUT-05 — Avoid future migration traps
If deferring an OPEN would force:
- schema redesign;
- state-model changes;
- event contract changes;
- incompatible navigation semantics;
- inaccessible component replacement;

then classify it earlier.

## CUT-06 — No speculative scaffolding
Do not implement dormant feature hooks simply “in case” unless the implementation seam is independently valuable.

## CUT-07 — Mobile and accessibility count as v1
A decision required for accessible or narrow/mobile correctness is not optional polish.

## CUT-08 — Stage 6 should be finite
Do not turn remaining OPEN resolution into another broad design program.

---

# 7. Dependency Questions to Answer

For each OPEN, determine:

1. Does core runtime/state implementation depend on it?
2. Does interaction-component architecture depend on it?
3. Does accessibility topology depend on it?
4. Does mobile/narrow behavior depend on it?
5. Does data/storage schema depend on it?
6. Does test-fixture design depend on it?
7. Can it be changed later without semantic migration?
8. Is it required for v1 user comprehension?
9. Is it an optional feature rather than a missing contract?
10. Which Stage 6 task should own its resolution if not deferred?

---

# 8. Important Candidate Directions — Do NOT Treat as Decisions Yet

The Architecture expectation going into triage is:

- OPEN-12 is likely implementation-blocking because two frozen temporal intents must be distinguishable.
- OPEN-18 is likely production-readiness blocking because correct semantics can otherwise appear broken.
- OPEN-16 is likely production-readiness blocking because sparse historical truth needs orientation without camera rescue.
- OPEN-15 is likely production-readiness blocking because Dormant must not read as Unknown/Absent.
- OPEN-10 likely needs a minimum motion contract, but not final polish.
- OPEN-06 and OPEN-09 look like strong candidates for post-v1 deferral unless dependency analysis proves otherwise.
- OPEN-08 may be accessibility/input dependent rather than a required product feature.
- OPEN-13 and OPEN-14 may need enough resolution to make Timeline implementation stable.
- OPEN-02 may need semantic affordance resolution but not final copy/icon design.
- OPEN-17 may be expressible as bounded implementation/visual constraints rather than one final appearance.
- OPEN-19 may be deferrable if no-op correctness remains understandable without dedicated acknowledgement.

These are hypotheses only.

Do not simply echo them.

Test them against the dependency criteria.

---

# 9. Forbidden Interpretations

## FORBIDDEN-01 — Reopen frozen semantics
Do not change Stage 5 to make an OPEN easier.

## FORBIDDEN-02 — “Everything must be resolved”
The purpose is to reduce work, not maximize it.

## FORBIDDEN-03 — “Everything can be deferred”
If an implementer would have to invent product behavior, the item is blocking.

## FORBIDDEN-04 — Feature scaffolding as a substitute for a product decision
Do not reserve UI/state/storage for deferred features without justification.

## FORBIDDEN-05 — Final styling
Do not solve color, typography, iconography or detailed motion in 6.1.

## FORBIDDEN-06 — Coding
No repository work.

## FORBIDDEN-07 — Replay
Do not pull Replay into Stage 6.1.

## FORBIDDEN-08 — Treat accessibility/mobile as later polish
They are v1 product constraints.

## FORBIDDEN-09 — Let implementation convenience define product semantics
Technical ease is not Product authority.

## FORBIDDEN-10 — Invent a new OPEN to avoid classification
New OPENs require a real missing dependency, not uncertainty.

---

# 10. Required Pre-Flight Readiness Report

Return ONLY a concise report with these sections.

## 1. Canonical understanding
Explain:
- what Stage 6 is;
- what 6.1 is;
- why 6.1 is a cutline/dependency task rather than a design task.

## 2. Frozen boundary
State the minimum frozen Stage 0–5 rules you will not reopen.

## 3. Classification model
Explain A / B / C / D / E in your own words.

## 4. OPEN inventory understanding
For OPEN-02, 06, 08, 09, 10, 12, 13, 14, 15, 16, 17, 18, 19:
- state the decision question;
- do NOT classify yet.

## 5. Dependency model
Confirm you will evaluate all 10 dependency questions for every OPEN.

## 6. Forbidden interpretations
Confirm FORBIDDEN-01 through FORBIDDEN-10.

## 7. Likely pressure points
Identify no more than 5 OPENs that appear most likely to block faithful v1 implementation and explain why provisionally.

Do not decide them yet.

## 8. Blocking ambiguities
If none:
**Blocking ambiguities: NONE.**

## 9. Execution plan
Maximum 5 bullets:
- source review;
- dependency matrix;
- classification;
- V1 cutline;
- Architecture handoff.

Do NOT execute the plan.

---

# 11. Stop Condition

After returning the Pre-Flight Readiness Report:

**STOP.**

Wait for Product / Experience / Architecture approval before performing the Stage 6.1 classification.

---

# 12. Current Board

```text
Stages 0–5                 CLOSED / FROZEN
Canonical Core v2          CREATED
Stage 6                    OPENED
6.1 OPEN Triage + Cutline  PRE-FLIGHT
```

No coding is authorized yet.
