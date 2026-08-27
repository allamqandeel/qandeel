# HBS Measurement Expansion v1 (bounded phase note)

State of the HBS (Behavior) branch of HIM Expansion & Human Intelligence
Completion after migrations 0040 and 0041.

## Calibrated HBS metrics

| Metric | Task | Construct (one line) | Special unassessed code |
|---|---|---|---|
| `hbs.avoidance@1` | 6/17 (0040) | Target-bound recent avoidance frequency despite real opportunity and intention | `NO_CLEAR_OPPORTUNITY` |
| `hbs.consistency@1` | 7/17 (0041) | Target-bound recent follow-through consistency across repeated real opportunities | `INSUFFICIENT_REPEATED_OPPORTUNITIES` |
| `hbs.initiative@1` | 8/17 (0041) | Target-bound recent self-initiated start frequency among self-owned opportunities | `NO_CLEAR_SELF_OWNED_OPPORTUNITY` |

`hbs.reflection` remains uncalibrated. Phase inventory after 0041: 8/17
calibrated, 9/17 uncalibrated.

## Shared period substrate

All three metrics share one canonical HBS target-bound period-measurement
substrate established by 0040 and extended (explicit-union only) by 0041:

- exact owned GOAL/SITUATION target, server-derived identity and label;
- fixed previous-seven-days window ending at the server-authoritative
  measurement time, stored durably on the immutable measurement event
  (HSE right-now events stay null-window);
- direct structured user report only (`DIRECT_STRUCTURED_USER_REPORT`) —
  no provider/LLM call, no passive behavioral inference;
- immutable append-only history; corrections keep the original
  event/target/window and supersede through the hardened supersession
  ledger; supersession-aware current reads;
- deterministic per-metric calculation with trusted snapshot provenance;
- ordinal 1–5 frequency scales; special no-opportunity codes and NOT_SURE
  are UNASSESSED/null, never zero;
- semantic mapping UNRESOLVED with NULL semantic type; metric confidence
  UNASSESSED/null.

## Independence

The three constructs are fully independent: separate vocabularies,
instruments, scales, models, approvals, bindings, RPC families, lock
namespaces, observations, results, and snapshots. No inverse
(`x = 6 − avoidance`), composite "behavior score", or cross-metric
derivation exists, and the substrate accepts any combination of values
(e.g. high initiative + low consistency, or low avoidance + low
initiative). Verifiers prove cross-metric calculation is structurally
impossible in every direction.

## Why runtime consumption remains deferred

Trend v1 is a five-HSE point-sequence contract; retrospective seven-day
period measurements can overlap between adjacent check-ins, so treating
them as ordinary adjacent points would fabricate movement signals. HIM
Intelligence Snapshot v1 (and Reasoning/FAST-DEEP consumption) is a
five-HSE `STATE`-only contract, and all three HBS metrics keep an
unresolved NULL semantic mapping. Both surfaces therefore reject all three
HBS metrics, with regression proof. A future, separately versioned **HBS
Runtime Consumption** contract (and, for movement, an HBS temporal
comparability declaration with a deliberate period-window policy) will
decide how calibrated HBS signals enter reasoning.
