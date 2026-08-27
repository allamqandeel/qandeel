# HRS Measurement Expansion v1 (bounded family note)

State of the HRS (Relationship) branch of HIM Expansion & Human
Intelligence Completion after migration 0044.

## Calibrated HRS metrics

| Metric | Task | Construct (one line) | Special unassessed codes |
|---|---|---|---|
| `hrs.relationship-trust@1` | 10/17 (0043) | Relationship-bound current reliance trust under meaningful interpersonal vulnerability/uncertainty | `TOO_CONTEXT_DEPENDENT_TO_RATE`, `INSUFFICIENT_BASIS_TO_JUDGE` |
| `hrs.communication@1` | 11/17 (0044) | Relationship-bound current communication workability when something important needs to get through | `TOO_TOPIC_DEPENDENT_TO_RATE`, `INSUFFICIENT_BASIS_TO_JUDGE` |
| `hrs.repair@1` | 12/17 (0044) | Relationship-bound current repair effectiveness after meaningful interpersonal rupture | `NO_MEANINGFUL_REPAIR_OPPORTUNITY`, `TOO_EPISODE_DEPENDENT_TO_RATE` |

The HRS family state is now: **Trust — calibrated; Communication —
calibrated; Repair — calibrated; Emotional Safety — still uncalibrated.**
`hrs.emotional-safety` is a deliberately separate future task, and nothing
in 0043/0044 scores, infers, or constrains it. Communication and Repair
were delivered in one migration **only** because the RELATIONSHIP substrate
already existed — they are two independent measurement systems (separate
constructs, vocabularies, instruments, scales, models, approvals, bindings,
RPC families, and lock namespaces), and combining the delivery never
combined the constructs. Phase inventory after 0044: 12/17 calibrated, 5/17
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

0044 reuses this substrate unchanged for Communication and Repair: no new
target authority, no new table, and no Communication- or Repair-specific
relationship targets — both metrics accept only an existing owned
RELATIONSHIP target, and the target label stays an opaque binding artifact
that no calculation ever interprets semantically.

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
temporal-comparability contract has been approved: HRS metrics are
relationship appraisals whose meaningful change may be slow, nonlinear, or
event-driven, with no canonical comparison cadence or minimum-evidence
policy; a single overall score may become temporarily UNASSESSED when
domain-, topic-, or episode-dependent; and no "improving/worsening"
threshold of any kind is approved. HIM Intelligence Snapshot v1 (and
Reasoning/FAST-DEEP consumption) is a five-HSE `STATE`-only contract, and
Trust, Communication, and Repair all keep unresolved NULL semantic
mappings. Both surfaces therefore reject all three calibrated HRS metrics,
with regression proof. Because relationship metrics are sensitive, no HRS
value may influence Recommendations, safety handling, or prompt guidance
before a future, separately versioned and deliberately reviewed **HRS
Runtime Consumption** contract decides how the HRS family enters reasoning.
