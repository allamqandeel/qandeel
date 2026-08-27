# HRS Measurement Expansion v1 (bounded family note)

State of the HRS (Relationship) branch of HIM Expansion & Human
Intelligence Completion after migration 0043.

## Calibrated HRS metrics

| Metric | Task | Construct (one line) | Special unassessed codes |
|---|---|---|---|
| `hrs.relationship-trust@1` | 10/17 (0043) | Relationship-bound current reliance trust under meaningful interpersonal vulnerability/uncertainty | `TOO_CONTEXT_DEPENDENT_TO_RATE`, `INSUFFICIENT_BASIS_TO_JUDGE` |

Relationship Trust is the **first HRS metric**. `hrs.communication`,
`hrs.repair`, and `hrs.emotional-safety` remain uncalibrated — they are
deliberately separate future tasks, and nothing in 0043 scores, infers, or
constrains them. Phase inventory after 0043: 10/17 calibrated, 7/17
uncalibrated (a one-time migration transition, never a historical-verifier
ceiling).

## RELATIONSHIP measurement-target substrate (established by 0043)

All HRS metrics are relationship-bound, so 0043 established the minimal
reusable owned RELATIONSHIP measurement-target substrate that later HRS
metrics can reuse: `him_measurement_targets` generalized by explicit union
(the 0014 GOAL/SITUATION/DECISION kinds plus RELATIONSHIP) with unchanged
ownership, immutability, label bounds, and canonical provenance, plus the
narrow
`create_him_relationship_measurement_target_v1` RPC (server-derived owner,
kind, UUID, and provenance from a bounded trimmed label). A RELATIONSHIP
target is a private, user-owned measurement context artifact only — no
social graph, contact/person model, partner account linking, shared/couple
mode, reciprocal trust, or external identity verification exists, and no
product "Relationship" domain entity was built.

## Shared HRS rules established with the first metric

- relationship-bound only: every HRS measurement binds to exactly one
  owned RELATIONSHIP target with a server-derived label;
- direct structured user report only — no provider/LLM call, no
  conversation-text/sentiment inference, no Memory/Evidence inference, no
  passive relationship monitoring;
- immutable append-only history; corrections keep the original event and
  the exact relationship and supersede through the hardened supersession
  ledger; supersession-aware current reads;
- deterministic per-metric calculation with trusted snapshot provenance;
- ordinal 1–5 scales; special insufficient-basis/domain-dependence codes
  and NOT_SURE are UNASSESSED/null, never zero and never a midpoint;
- semantic mapping UNRESOLVED with NULL semantic type (RELATIONSHIP is a
  context kind, not a semantic type); metric confidence UNASSESSED/null;
- **no composite HRS score** and no cross-metric derivation: Trust,
  Communication, Repair, and Emotional Safety are independent constructs,
  and every logically possible combination remains expressible.

## Why runtime consumption remains deferred

Trend v1 is a five-HSE point-sequence contract and no HRS
temporal-comparability contract has been approved: relationship trust is a
relationship appraisal whose meaningful change may be slow, nonlinear, or
event-driven, with no canonical comparison cadence, and a single overall
score may become temporarily UNASSESSED when domain-dependent. HIM
Intelligence Snapshot v1 (and Reasoning/FAST-DEEP consumption) is a
five-HSE `STATE`-only contract, and Relationship Trust keeps an unresolved
NULL semantic mapping. Both surfaces therefore reject Relationship Trust,
with regression proof. Because relationship metrics are sensitive, no HRS
value may influence Recommendations, safety handling, or prompt guidance
before a future, separately versioned and deliberately reviewed **HRS
Runtime Consumption** contract decides how the HRS family enters reasoning.
