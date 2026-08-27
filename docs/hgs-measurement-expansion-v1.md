# HGS Measurement Expansion v1 (bounded family note)

State of the HGS (Growth) branch of HIM Expansion & Human Intelligence
Completion after migration 0047.

## Calibrated HGS metrics

| Metric | Task | Construct (one line) | Special unassessed codes |
|---|---|---|---|
| `hgs.self-awareness@1` | 14/17 (0046) | Target-bound current perceived self-understanding clarity in one exact GOAL or SITUATION — perceived clarity only, never objective insight accuracy or growth outcome | `TOO_FACET_DEPENDENT_TO_RATE`, `INSUFFICIENT_BASIS_TO_JUDGE` |
| `hgs.resilience@1` | 15/17 (0047) | Target-bound current perceived adaptive recovery/continuity under actually experienced challenge in one exact GOAL or SITUATION — never low Stress, grit, goal success, HRS Repair, or a global resilience trait | `NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE`, `TOO_EARLY_TO_JUDGE_ADAPTATION`, `TOO_CHALLENGE_DEPENDENT_TO_RATE` |

The HGS family state is now:

```text
Self-Awareness     CALIBRATED
Resilience         CALIBRATED
Purpose Alignment  UNCALIBRATED
Habit Strength     UNCALIBRATED
```

Self-Awareness was deliberately implemented alone because its boundary
with HBS Reflection deserves independent verification; Resilience
followed with its own actual-challenge grounding and its own
independence proofs against Stress, Motivation, Self-Confidence,
Self-Awareness, Consistency, and HRS Repair. The remaining two metrics
are later, separately reviewed HIM Expansion tasks — nothing in
0046/0047 or their verifiers freezes them as permanently uncalibrated,
and no migration-number ceiling exists. Phase inventory after 0047:
15/17 calibrated, 2/17 uncalibrated (a one-time migration transition,
never a historical-verifier ceiling).

## The Reflection boundary (why Self-Awareness came first)

QANDEEL v1 deliberately separates **HBS Reflection** (the deliberate
reflective PROCESS in one exact SITUATION or CONVERSATION_SESSION) from
**HGS Self-Awareness** (current perceived SELF-UNDERSTANDING CLARITY in
one exact GOAL or SITUATION). Process is not clarity: high Reflection
with low Self-Awareness and low Reflection with high Self-Awareness both
stay fully expressible, with live regression proof on the same user and
the same owned SITUATION target. No formula, constraint, composite,
inverse, or forced correlation links the two, and neither metric ever
reads the other's observations.

## GOAL/SITUATION measurement-target substrate (reused, not reinvented)

Self-Awareness binds to exactly one existing owned
`him_measurement_targets` row of kind GOAL or SITUATION — the substrate
established by 0013/0014 and shared with Motivation and the seven-day
HBS metrics. No HGS-specific target table, no new target-creation RPC,
and no GLOBAL/CONVERSATION_SESSION/DECISION/RELATIONSHIP authority
exists. The server derives owner, target UUID, context kind, label, and
provenance; the label stays an opaque binding artifact that no
calculation ever interprets semantically.

## Shared HGS rules established with the first metric

- target-bound only: every HGS Self-Awareness measurement binds to
  exactly one owned GOAL or SITUATION target with a server-derived
  label;
- direct structured user report only — no provider/LLM call, no
  conversation-text inference, no Memory/Evidence inference, no
  automatic self-awareness inference;
- **current at-report appraisal with a NULL temporal window** — HGS
  ownership does not automatically mean longitudinal growth: no growth
  trajectory, growth percentage, before/after delta, or caller-selected
  window exists;
- immutable append-only history; corrections keep the original event
  and the exact target and supersede through the hardened supersession
  ledger; supersession-aware current reads;
- deterministic per-metric calculation with trusted snapshot
  provenance;
- ordinal 1–5 scales; special facet-dependence/insufficient-basis codes
  and NOT_SURE are UNASSESSED/null, never zero and never a midpoint;
- semantic mapping UNRESOLVED with NULL semantic type — never a forced
  CAPABILITY mapping and no invented SELF_AWARENESS/GROWTH semantic
  types; metric confidence UNASSESSED/null;
- **no composite HGS score**, no cross-metric derivation, and no claim
  of a validated psychometric instrument, objective accuracy, or
  clinical/external validation.

## Why runtime consumption remains deferred

Trend v1 is a five-HSE point-sequence contract and no HGS
temporal-comparability contract has been approved: perceived
self-understanding clarity may change slowly, nonlinearly, or
event-driven, a single scalar may become temporarily UNASSESSED when
facet-dependent, and no "increasing/decreasing" or growth-trajectory
reading of any kind is approved. HIM Intelligence Snapshot v1 (and
Reasoning/FAST-DEEP consumption) is a five-HSE `STATE`-only contract,
and Self-Awareness keeps an unresolved NULL semantic mapping. Both
surfaces therefore reject `hgs.self-awareness`, with regression proof.
Because self-understanding metrics are sensitive, no HGS value may
influence Recommendations, safety handling, prompt guidance, or
proactive behavior before a future, separately versioned and
deliberately reviewed **HGS Runtime Consumption** contract decides how
the HGS family enters reasoning. Measuring Self-Awareness is not
consuming it.
