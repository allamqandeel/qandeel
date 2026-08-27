# HIM Temporal Comparability and Trend v1

Trend v1 is an internal, derived read model for `hse.energy`, `hse.motivation`, `hse.attention`, `hse.self-confidence`, and `hse.stress` — and only those five HSE metrics. `hbs.avoidance`, `hbs.consistency`, and `hbs.initiative` are calibrated (HIM Expansion metrics 6–8/17) but deliberately NOT eligible for Trend v1: each is a retrospective seven-day period measurement whose adjacent check-in windows may overlap, and treating overlapping periods as ordinary adjacent points in this point-sequence contract would create a misleading movement signal; a future HBS Temporal Comparability Declaration may admit them only after a deliberate period-window policy. The remaining nine initial HIM metrics are uncalibrated and unsupported. There is no controller, client contract, conversation-path integration, persistence, cache, provider call, embedding, or paid call.

Requests name an explicit finite half-open window: `windowStart <= observed_at < windowEnd`. No default window or cadence is inferred. At most 128 eligible current event values are supported; the source resolver returns a 129th only to detect overflow, which produces `UNASSESSED / WINDOW_OVERFLOW` without truncation or sampling.

## Exact comparability

The metric, definition version, approved context kind, and exact owned context ID must match. The approved contexts are Energy in `CONVERSATION_SESSION`; Motivation in `GOAL` or `SITUATION`; Attention in `SITUATION`, `CONVERSATION_SESSION`, or `DECISION`; Self-Confidence in `SITUATION` or `DECISION`; and Stress in `SITUATION` or `CONVERSATION_SESSION`. There is no global fallback or cross-context aggregation.

The read-only `read_him_trend_source_v1` RPC reads `him_current_structured_measurements`, so a corrected observation replaces the value for its original measurement event and never creates false temporal movement. Raw superseded snapshots remain audit history. The RPC validates the authenticated owner and authoritative context, then resolves the active canonical binding server-side. Every point must share that exact binding and its metric/definition/context, instrument/version, ordinal scale/version, and calculation model/version identities. Cross-binding or cross-version comparison returns unassessed; widening requires a future Temporal Comparability Declaration.

Only trusted, valid, assessed snapshots with exact ordinal codes 1 through 5 and complete event, observation, calculation, and binding provenance enter the sequence. Missing, `NOT_SURE`, unassessed, superseded, invalidated, malformed, or untrusted data never becomes zero or neutral. Safely encountered unassessed rows contribute only to the bounded excluded count. Ownership failures fail closed without disclosing another user's data.

## Ordinal evaluation boundary

Points are ordered by server-authoritative observation time and stable snapshot ID. Adjacent categories are compared only for order. All equal steps are `UNCHANGED`; upward steps with no downward step are `INCREASING`; downward steps with no upward step are `DECREASING`; and any sequence containing both is `MIXED`. Fewer than two comparable events is unassessed. Confidence is always `UNASSESSED` with a null reference.

Direction is not valence. The result never says improving, worsening, good, bad, healthy, unhealthy, successful, clinically severe, or material. It computes no average, median substitution, numeric distance, percentage, slope, velocity, smoothing, interpolation, imputation, decay, baseline, normalization, volatility, significance, materiality, or cross-metric formula.

The result is calculated on read and does not mutate measurement history. User-visible trends, Reasoning/Recommendation interpretation, Intelligence Snapshots, proactive behavior, measurement cadence, confidence formulas, and all remaining HIM measurement models are explicit non-goals.
