# HBS Measurement Expansion v1 (bounded phase note)

State of the HBS (Behavior) branch of HIM Expansion & Human Intelligence
Completion after migrations 0040, 0041, and 0042.

## Calibrated HBS metrics

| Metric | Task | Construct (one line) | Special unassessed code |
|---|---|---|---|
| `hbs.avoidance@1` | 6/17 (0040) | Target-bound recent avoidance frequency despite real opportunity and intention | `NO_CLEAR_OPPORTUNITY` |
| `hbs.consistency@1` | 7/17 (0041) | Target-bound recent follow-through consistency across repeated real opportunities | `INSUFFICIENT_REPEATED_OPPORTUNITIES` |
| `hbs.initiative@1` | 8/17 (0041) | Target-bound recent self-initiated start frequency among self-owned opportunities | `NO_CLEAR_SELF_OWNED_OPPORTUNITY` |
| `hbs.reflection@1` | 9/17 (0042) | Context-bound at-report deliberate reflective engagement with one exact SITUATION or conversation session | `NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT` |

The HBS family is now fully calibrated. Phase inventory after 0042: 9/17
calibrated, 8/17 uncalibrated.

## Shared period substrate (Avoidance, Consistency, Initiative)

Avoidance, Consistency, and Initiative share one canonical HBS target-bound
seven-day period-measurement substrate established by 0040 and extended
(explicit-union only) by 0041:

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

## Reflection's deliberately different substrate (0042)

`hbs.reflection@1` intentionally does NOT reuse the seven-day target-bound
period substrate: it is one exact **context-bound at-report
reflective-engagement assessment** over the authorized
SITUATION/CONVERSATION_SESSION contexts. A SITUATION binds to one owned
existing measurement target with a server-derived label; a
CONVERSATION_SESSION binds directly to one owned real conversation session
with all-NULL target fields. Its measurement events keep a **NULL temporal
window** (the durable 0040 window pair stays unused, like HSE right-now
events), there is no caller-selected window and no
frequency-across-opportunities calculation, and the server-authoritative
report time is the measurement time. Everything else follows the same
hardened rules: direct structured report only, ordinal 1–5 engagement
scale with UNASSESSED/null special codes, immutable correction chain,
supersession-aware current reads, and UNRESOLVED/NULL semantic mapping.

## Independence

All four constructs are fully independent: separate vocabularies,
instruments, scales, models, approvals, bindings, RPC families, lock
namespaces, observations, results, and snapshots. No inverse
(`x = 6 − avoidance`), composite "behavior score", or cross-metric
derivation exists, and the substrate accepts any combination of values
(e.g. high initiative + low consistency, high reflection + high avoidance,
or low reflection + high initiative). Verifiers prove cross-metric
calculation is structurally impossible in every direction.

## Why runtime consumption remains deferred

Trend v1 is a five-HSE point-sequence contract; retrospective seven-day
period measurements can overlap between adjacent check-ins, so treating
them as ordinary adjacent points would fabricate movement signals, and
context-bound Reflection has no canonical repeated interval while its
elapsed reflective opportunity differs between observations. HIM
Intelligence Snapshot v1 (and Reasoning/FAST-DEEP consumption) is a
five-HSE `STATE`-only contract, and all four HBS metrics keep an
unresolved NULL semantic mapping. Both surfaces therefore reject all four
HBS metrics, with regression proof. A future, separately versioned **HBS
Runtime Consumption** contract (and, for movement, an HBS temporal
comparability declaration with a deliberate period-window policy) will
decide how the completed calibrated HBS family enters reasoning.
