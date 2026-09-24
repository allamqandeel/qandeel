# QANDEEL — Stage 6.2 Pre-Flight Contract Gate
## Timeline Interaction + Legibility Completion

**Status:** PRE-FLIGHT ONLY  
**Upstream:** Stages 0–5 CLOSED / FROZEN; Stage 6.1 CLOSED / FROZEN  
**Stage 6.2 owns:** OPEN-13, OPEN-02, OPEN-12, OPEN-14

Do NOT execute design yet.
Do NOT modify the repository.
Do NOT code.
Do NOT resolve Stage 6.3 / 6.4 items.
Do NOT reopen frozen Stage 5 semantics.

Return only the requested Pre-Flight Readiness Report, then STOP.

---

# 1. Purpose

Stage 6.2 closes the minimum Timeline-side Experience decisions required to turn the frozen Stage 5 Timeline architecture into a faithful v1 interaction contract.

It must resolve:

- **OPEN-13 — Timeline axis / scale policy**
- **OPEN-02 — P3a Temporal+Locate affordance**
- **OPEN-12 — LIVE_EDGE vs latest absolute Moment legibility**
- **OPEN-14 — neutral aggregation encoding**

Stage 6.2 does not redesign the Timeline architecture.

It gives final Experience expression to semantics already frozen in Stage 5.

---

# 2. Priority Rule

OPEN-13 is the only Stage 6.1 item classified:

# `A — MUST RESOLVE BEFORE IMPLEMENTATION`

Therefore Stage 6.2 must treat OPEN-13 as the first load-bearing decision.

OPEN-14 depends on the selected Track scale/geometry policy.

Do not resolve aggregation before scale.

---

# 3. Frozen Timeline Semantics

## T-01 — Current Session only

Timeline domain remains:

```text
M_current = { m0 < m1 < ... < LH }
```

No cross-session/life-history Timeline.

## T-02 — Target-kind distinction

```text
Moment(m)
LIVE_EDGE
```

```text
Commit(Moment(m)) → PINNED(m)
Commit(LIVE_EDGE) → FOLLOW_LIVE
```

Even when `m == LH`:

```text
Moment(LH) ≠ LIVE_EDGE
```

## T-03 — Preview / Commit / Settle

Preview remains transient.

```text
PTC ∉ S
```

No Preview RH write.
No hidden Preview commit.

## T-04 — Temporal ≠ spatial intent

Timeline movement does not imply camera movement.

P3 Temporal+Locate requires explicit locate intent.

## T-05 — Current-session SP is the only Track address

Timeline content/structural addresses derive from legitimate current-session:

```text
SP
```

Never:

- RTO
- KF
- VF/VT
- object age
- Thread age
- Map position

## T-06 — Timeline semantic boundary

Timeline discloses temporal orientation plus minimum committed anonymous conversational structure.

It does not disclose analytical interpretation.

## T-07 — Historical post-TC firewall

While PINNED, material after TC must not encode future:

- count;
- density;
- magnitude;
- semantic markers;
- subdivisions;
- structure;
- focus-stop enumeration.

Only non-metric reachability + permitted Live meta.

## T-08 — Accessibility parity

The same knowledge firewall applies to nonvisual surfaces.

Final accessible control topology is not frozen yet.

---

# 4. OPEN-13 — Timeline Axis / Scale Policy

Stage 6.2 must decide the final v1 semantic scale model.

Candidate policy families may include:

- ordinal/equal-step;
- duration-proportional;
- adaptive/hybrid;
- another explicit model.

The decision must specify:

1. what distance on the Track means;
2. whether distance communicates elapsed duration;
3. how irregular conversational timing is represented;
4. how the model behaves during long pauses;
5. how it behaves during dense rapid Moments;
6. mobile/narrow implications;
7. keyboard/non-pointer implications;
8. how Preview maps pointer/gesture position to temporal target;
9. how no-hindsight constrains the post-TC region;
10. how aggregation can operate without changing the semantic meaning of distance.

Forbidden:

- arbitrary layout spacing;
- spacing that accidentally communicates importance;
- future-relative metric disclosure while pinned;
- using RTO/KF/VF/VT as geometry.

---

# 5. OPEN-02 — P3a Temporal+Locate Affordance

P3a semantics are frozen:

A single explicit act may:

1. commit temporal target;
2. obtain one-shot locate entitlement;
3. locate only if exactly one legitimate locus exists at settle.

If 0 loci:
- temporal commit remains;
- no camera move.

If >1 loci:
- no arbitrary camera move;
- later human contextual choice is a separate transaction.

Stage 6.2 must determine how the Experience makes the user's **combined temporal+spatial intent explicit**.

The solution must not make ordinary Timeline navigation silently spatial.

Resolve:

- interaction grammar;
- recognizability;
- pointer/touch expression;
- non-pointer/accessibility equivalent intent;
- zero-locus outcome;
- multi-locus transition to explicit context choice.

Do NOT freeze final iconography or decorative styling unless necessary.

---

# 6. OPEN-12 — LIVE_EDGE vs Latest Moment Legibility

The semantic distinction is frozen.

The Experience must make understandable that:

## Latest absolute Moment

```text
Moment(LH)
→ PINNED(LH)
```

If Live advances:
- remains pinned to that absolute Moment.

## LIVE_EDGE

```text
LIVE_EDGE
→ FOLLOW_LIVE
```

If Live advances:
- moves with Live.

Stage 6.2 must decide how both intents remain:

- perceptually distinguishable;
- operable;
- accessible;
- understandable on mobile;
- distinguishable even when currently co-located.

Do not solve by merging the controls/semantics.

Do not leak future post-TC structure.

---

# 7. OPEN-14 — Neutral Aggregation Encoding

Aggregation may be needed when committed Timeline structure becomes dense.

Any aggregation must remain semantically neutral.

It must not imply:

- importance;
- confidence;
- truth;
- analytical weight;
- causality;
- ownership;
- emotional intensity.

Resolve:

1. when aggregation begins;
2. what exactly is aggregated;
3. what information the aggregate is allowed to communicate;
4. how it interacts with selected scale policy;
5. how users inspect/navigate dense intervals;
6. mobile behavior;
7. accessibility equivalent;
8. how historical no-hindsight prevents future-relative density/count leakage.

Aggregation must not become a new canonical analytical object unless upstream Architecture explicitly authorizes it.

---

# 8. Cross-OPEN Coupling

## Hard dependency

```text
OPEN-14 → OPEN-13
```

Aggregation requires a defined scale/geometry policy.

OPEN-13 does not require OPEN-14 to be decided first.

## Coordination

OPEN-12 must be tested under the selected OPEN-13 scale.

OPEN-02 must be tested against the final Track interaction grammar but must remain semantically independent of ordinary temporal selection.

Do not inflate these into false hard dependencies.

---

# 9. Required Decision Tests

For each proposed decision, test at minimum:

## DT-01
`Moment(LH)` and `LIVE_EDGE` currently share one physical coordinate.

Can a user intentionally choose either meaning?

## DT-02
Live advances immediately after selecting `Moment(LH)`.

Does the experience clearly remain pinned?

## DT-03
Live advances while `FOLLOW_LIVE`.

Does the Live Edge remain intelligible without exposing future structure?

## DT-04
Long real-time pause with no committed Moment.

Does Track geometry preserve its declared semantic meaning?

## DT-05
Burst of many Moments in short real time.

Does geometry remain usable without implying analytical density?

## DT-06
Historical TC with large future committed region.

Does the post-TC area remain non-metric and non-enumerative?

## DT-07
Dense committed structure before TC.

Can aggregation occur without implying importance?

## DT-08
P3a act to target with exactly one locus.

Is combined temporal+locate intent explicit?

## DT-09
P3a act to target with zero loci.

Does temporal success remain legible without fabricated spatial failure semantics?

## DT-10
P3a settles with >1 loci.

Does explicit contextual choice occur as a separate act?

## DT-11
Screen reader at `Moment(LH)` vs `LIVE_EDGE`.

Can it distinguish absolute pinned target from moving Live intent without future enumeration?

## DT-12
Keyboard/non-pointer user performs P3a.

Is combined intent possible without relying on hover/drag-only mechanics?

## DT-13
Mobile narrow Track under dense structure.

Does the same semantic scale survive with less simultaneous disclosure?

## DT-14
Aggregation expands/collapses or is inspected.

Does this alter temporal target meaning or RH incorrectly?

## DT-15
No visual styling.

Can the interaction/scale contract still be described deterministically?

---

# 10. Research Requirement

Before resolving Stage 6.2, conduct **targeted Experience research** if and only if it materially helps compare scale/interaction patterns.

Research may examine authoritative examples/principles for:

- timeline scale semantics;
- scrubber vs event-index navigation;
- live-edge controls;
- dense temporal navigation;
- accessible timeline controls.

For every source:

1. source;
2. reusable principle;
3. QANDEEL implication;
4. pattern not to copy.

Do not import another product's UI wholesale.

Frozen QANDEEL semantics remain authority.

---

# 11. Required Proof Artifacts Later

If execution is authorized, create only proof artifacts that help make the four decisions inspectable.

At minimum:

## Board A — Scale + Live Edge / Latest Moment

Prove OPEN-13 + OPEN-12 under:
- co-located latest Moment / Live Edge;
- Live advance;
- long pause;
- dense burst;
- pinned historical state;
- mobile/narrow.

## Board B — P3a + Aggregation

Prove OPEN-02 + OPEN-14 under:
- unique locus;
- zero locus;
- multiple loci;
- dense committed structure;
- historical firewall;
- accessibility/non-pointer intent.

Boards are Experience proof scaffolding, not final visual styling.

---

# 12. Forbidden Interpretations

## F-01
Do not reopen target-kind semantics.

## F-02
Do not make ordinary Timeline selection auto-locate.

## F-03
Do not use real-world referenced time as Track address.

## F-04
Do not use KF/VF/VT as Track geometry.

## F-05
Do not expose future counts/density while pinned.

## F-06
Do not make aggregation analytical.

## F-07
Do not create a third temporal mode.

## F-08
Do not widen Timeline beyond current Session.

## F-09
Do not resolve OPEN-06/08/09/19.

## F-10
Do not resolve Stage 6.3/6.4 OPENs.

## F-11
Do not freeze final decorative styling.

## F-12
Do not code or modify repo.

---

# 13. Required Pre-Flight Readiness Report

Return only:

## 1. Canonical understanding
What 6.2 is and is not.

## 2. Frozen Timeline boundary
Summarize T-01…T-08.

## 3. OPEN-13 understanding
State exactly what semantic scale decision must be made.

Do not decide it.

## 4. OPEN-02 understanding
State the Experience problem without proposing the affordance.

## 5. OPEN-12 understanding
Explain why co-location does not erase target-kind distinction.

## 6. OPEN-14 understanding
Explain what “neutral aggregation” must and must not mean.

## 7. Coupling
Confirm:
- 14 → 13 hard;
- 12 ↔ 13 coordination;
- 02 ↔ Track interaction grammar coordination.

## 8. Decision tests
Confirm DT-01…DT-15 understood.

## 9. Research necessity
State:
- `TARGETED RESEARCH REQUIRED`
or
- `NO NEW RESEARCH REQUIRED`

Do not conduct it yet.

## 10. Blocking ambiguities
If none:
**Blocking ambiguities: NONE.**

## 11. Execution plan
Maximum 5 bullets.

Then STOP.

---

# 14. Current Board

```text
Stages 0–5                 CLOSED / FROZEN
Stage 6                    ACTIVE
6.1 OPEN Triage            CLOSED / FROZEN
6.2 Timeline Completion    PRE-FLIGHT
```
