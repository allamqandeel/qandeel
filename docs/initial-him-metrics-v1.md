# Initial HIM Metrics v1

This gate registers what QANDEEL may eventually measure. It does not define how to calculate any metric. Every definition is version `1`, has calculation status `UNCALIBRATED`, scale status `UNCALIBRATED_NO_PRODUCTION_SCALE`, confidence status `UNRESOLVED_METRIC_CONFIDENCE_MODEL`, and no dependency edges. Registration creates no user snapshot; missing remains `UNASSESSED`/`NULL`, structurally distinct from numeric zero.

**Scope note.** This page records the Foundation registration gate as it was seeded, not current state. All seventeen identities are now `CALIBRATED`, each through its own separately reviewed measurement model, and the allowed-context column below is the originally registered list. One entry has since been reconciled: `hse.energy` is `CONVERSATION_SESSION` only — its original `SITUATION` entry was Foundation drift that never carried a model, binding, instrument, or RPC, and migration 0051 removed it. Each metric's current production contexts live in that metric's own measurement-model document.

| Stable key | Display name | Category / owner / source | Semantic type | Allowed contexts | Boundary note |
|---|---|---|---|---|---|
| `hse.stress` | Stress | State / HSE / HIF Part 8 v0.1 | STATE | SITUATION, CONVERSATION_SESSION | Contextual state |
| `hse.energy` | Energy | State / HSE / HIF Part 8 v0.1 | STATE | SITUATION, CONVERSATION_SESSION | Contextual state |
| `hse.motivation` | Motivation | State / HSE / HIF Part 8 v0.1 | STATE | SITUATION, GOAL | Contextual state |
| `hse.self-confidence` | Confidence | State / HSE / HIF Part 8 v0.1 | STATE | SITUATION, DECISION | Human self-confidence, never epistemic Confidence Runtime |
| `hse.attention` | Attention | State / HSE / HIF Part 8 v0.1 | STATE | SITUATION, CONVERSATION_SESSION, DECISION | Contextual state |
| `hbs.avoidance` | Avoidance | Behavior / HBS / HIF Part 8 v0.1 | UNRESOLVED | SITUATION, GOAL | No canonical Foundation semantic mapping; not a trait |
| `hbs.consistency` | Consistency | Behavior / HBS / HIF Part 8 v0.1 | UNRESOLVED | SITUATION, GOAL | No canonical Foundation semantic mapping; not a trait |
| `hbs.initiative` | Initiative | Behavior / HBS / HIF Part 8 v0.1 | UNRESOLVED | SITUATION, GOAL | No canonical Foundation semantic mapping; not a trait |
| `hbs.reflection` | Reflection | Behavior / HBS / HIF Part 8 v0.1 | UNRESOLVED | SITUATION, CONVERSATION_SESSION | No canonical Foundation semantic mapping; not a trait |
| `hrs.relationship-trust` | Trust | Relationship / HRS / HIF Part 8 v0.1 | UNRESOLVED | RELATIONSHIP | Not SENA, provider, epistemic, or global trust |
| `hrs.communication` | Communication | Relationship / HRS / HIF Part 8 v0.1 | UNRESOLVED | RELATIONSHIP | Relationship-bound |
| `hrs.repair` | Repair | Relationship / HRS / HIF Part 8 v0.1 | UNRESOLVED | RELATIONSHIP | Relationship-bound |
| `hrs.emotional-safety` | Emotional Safety | Relationship / HRS / HIF Part 8 v0.1 | UNRESOLVED | RELATIONSHIP | Relationship-bound |
| `hgs.self-awareness` | Self-awareness | Growth / HGS / HIF Part 8 v0.1 | UNRESOLVED | GOAL, SITUATION | No canonical Foundation semantic mapping |
| `hgs.resilience` | Resilience | Growth / HGS / HIF Part 8 v0.1 | UNRESOLVED | GOAL, SITUATION | No canonical Foundation semantic mapping |
| `hgs.purpose-alignment` | Purpose Alignment | Growth / HGS / HIF Part 8 v0.1 | ALIGNMENT | GOAL | Goal-bound alignment |
| `hgs.habit-strength` | Habit Strength | Growth / HGS / HIF Part 8 v0.1 | UNRESOLVED | GOAL, SITUATION | No canonical Foundation semantic mapping |

## Mapping rationale and provenance

The mapping contract is a bounded pair: `RESOLVED` requires one existing Foundation semantic type, while `UNRESOLVED` requires a null semantic type. It does not add a new production semantic category. HSE metrics are canonically State metrics and resolve to `STATE`, never `TRAIT`. Purpose Alignment resolves directly to the existing `ALIGNMENT` type. HBS is a separate Behavior category, HRS is a separate Relationship category, and HIF does not directly establish `CAPABILITY` for Self-awareness, Resilience, or Habit Strength; those eleven mappings therefore remain explicitly unresolved. No metric is global. Exact context kind and identity are required on every read/write and there is no cross-context fallback.

HIF Part 8 supplies the identities and subsystem ownership. It does not supply production formulas, calibrated scales, thresholds, bands, decay, evidence weights, confidence calculation, update cadence, predictive validation, or authoritative dependency edges. Evidence references remain owned, supporting/contradictory, and provenance-preserving; evidence is neither created nor interpreted here.

## Enforcement and non-goals

The service and security-definer database RPC both reject `ASSESSED` for an uncalibrated definition, including numeric zero and calls with evidence. Calculation status and canonical owner/source/type/context/version are definition-derived and cannot be supplied through the observation RPC. Authenticated users retain no insert/update/delete privileges on the catalog. The deterministic migration seeds the same 17 identities and creates no snapshots.

There is no calculator, formula, scale, metric confidence, trend, Intelligence Snapshot, UI/client exposure, Context Builder or provider-payload integration, response-path change, Memory/Evidence/Hypothesis mutation, provider call, embedding, or paid call.

## Next gate

HIM Trends is not architecturally safe next: trends over unassessed metrics would manufacture values or be empty by construction. A separately reviewed **HIM Metric Calculation/Calibration v1** gate must approve measurement models, scales, confidence, and validation before Trends.

