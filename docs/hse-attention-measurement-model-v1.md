# HSE Attention Measurement Model v1

## Production contract

`hse.attention@1` is an HSE `STATE`: the user's current self-reported capacity to direct and sustain attention in one exact `SITUATION`, `CONVERSATION_SESSION`, or `DECISION`. It is not focus duration, productivity, distraction telemetry, cognitive diagnosis, interest, motivation, energy, importance, or inferred behavior. `GLOBAL` and `GOAL` contexts are unsupported.

Instrument `hse.attention.direct-self-report@1` uses `DIRECT_STRUCTURED_SELF_REPORT` with RIGHT_NOW meaning. For `SITUATION` and `DECISION`, the minimal `him_measurement_targets` authority assigns identity and ownership server-side from bounded display text; this does not create a Decision Runtime. For `CONVERSATION_SESSION`, the existing owned conversation session is authoritative. Callers supply an authoritative reference, never canonical identity or ownership. Event context, observation target fields, and calculation binding must resolve to that exact owned artifact.

## Scale and calculation

`hse.attention.ordinal-5.v1@1` preserves `VERY_LOW`, `LOW`, `MODERATE`, `HIGH`, and `VERY_HIGH` as stable ordered storage codes 1–5. They are ordinal categories, not interval or ratio values. `NOT_SURE` and absence are `UNASSESSED`/null. No arithmetic, averaging, percentage, threshold, baseline, decay, inference, or cross-metric formula exists. Metric Confidence remains `UNASSESSED` with a null reference.

## Hardened shared substrate

Attention reuses the Energy and Motivation substrate: Measurement Event → immutable structured observation → exact ACTIVE Canonical Binding → deterministic calculation result → trusted snapshot. Canonical report and observation time is assigned by the database; caller time is diagnostic and untrusted. Correction stays in the same event, appends immutable audit history, supersedes any old derived value, and serializes on the same observation advisory lock as calculation. Calculation revalidates currentness under the lock and is idempotent per observation and binding.

`him_current_structured_measurements` is the server-enforced current path for Energy, Motivation, and Attention. It excludes superseded observations and snapshots. After correction and before replacement calculation, no old Attention assessment is current; after calculation, only the corrected assessment is current.

## Governance and security

The calibrated production model is `hse.attention.direct-structured-self-report@1`, approved by `qandeel.him.attention.foundation-approval@1`. Three ACTIVE bindings authorize the exact supported contexts. Binding enforcement validates lifecycle, environment, metric, definition, context, instrument, scale, and exact approval/model identity. Binding transitions remain database-owner governed.

Targets, sessions, events, observations, results, and snapshots are owner-scoped. Database constraints and RPC checks reject nonexistent, fabricated, mismatched, cross-kind, and cross-user references. Generic direct assessed snapshot writes remain blocked. `CALIBRATED` means internally approved deterministic production measurement under this contract, not clinical, diagnostic, population, or psychometric validation. Energy and Motivation remain calibrated and unchanged; the other 14 initial HIM metrics remain uncalibrated.

## Explicit exclusions

No Decision Runtime, free-text or behavioral inference, providers, embeddings, Memory/Evidence writes, Trends, Intelligence Snapshot, Recommendation Bridge, UI, temporal aggregation, or other HIM model is included.

