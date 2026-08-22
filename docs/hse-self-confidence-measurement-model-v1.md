# HSE Self-Confidence Measurement Model v1

## Production contract

`hse.self-confidence@1` is an HSE `STATE`: the user's current self-perceived confidence in themselves and their ability to handle one exact owned `SITUATION` or `DECISION`. It is contextual self-report, not a permanent trait or objective evaluation. `GLOBAL` and `CONVERSATION_SESSION` are unsupported.

Instrument `hse.self-confidence.direct-self-report@1` is a one-item `DIRECT_STRUCTURED_SELF_REPORT` with RIGHT_NOW meaning: “Right now, how confident are you in yourself and your ability to handle this [situation/decision]?” The founder-tested ar-EG realization is `دلوقتي، قد إيه واثق في نفسك إنك تقدر تتعامل مع الموقف/القرار ده؟`. Both context kinds reuse the server-owned `him_measurement_targets` authority established for contextual measurements; this does not create a Decision Runtime. Identity and ownership are server-controlled, and the event, observation, and binding must resolve to the same artifact.

## Construct boundaries

Self-Confidence is separate from information completeness, external control, actual competence, expected success, outcome certainty, decision correctness, anxiety or stress, assertiveness, general self-esteem, Energy, Motivation, and Attention. It neither reads nor writes Hypothesis Confidence Runtime, and provider/model certainty is never human Self-Confidence. Metric Confidence remains `UNASSESSED`/null.

## Scale and calculation

`hse.self-confidence.ordinal-5.v1@1` preserves `VERY_LOW`, `LOW`, `MODERATE`, `HIGH`, and `VERY_HIGH` as bounded ordinal storage codes 1–5. `NOT_SURE` and absence are `UNASSESSED`/null; missing is not zero. No arithmetic, averages, percentages, success probabilities, equal-distance meaning, thresholds, inference, or cross-metric formula exists.

## Hardened shared substrate

The model reuses Measurement Event → immutable structured observation → exact ACTIVE binding → deterministic result → trusted snapshot. Database time is canonical; caller time is diagnostic and untrusted. Correction appends history in the same event, supersedes old derived state, and uses the same per-observation advisory lock as calculation. Calculation revalidates currentness under that lock and is idempotent. The supersession-aware current view returns no old value during the correction/recalculation gap.

## Governance and security

Production model `hse.self-confidence.direct-structured-self-report@1` has separately governed ACTIVE bindings for `SITUATION` and `DECISION`. Enforcement validates exact model, lifecycle, environment, metric, definition, context, instrument, scale, and approval identity. Ordinary authenticated users cannot mutate governance. RLS and database checks reject fabricated, nonexistent, mismatched, and cross-user contexts, timestamp forgery, direct assessed writes, and cross-metric references.

`CALIBRATED` means internally approved deterministic production measurement under this contract—not clinical, diagnostic, competence, psychometric, or population validation. Energy, Motivation, and Attention remain unchanged; the other 13 initial metrics remain uncalibrated.

## Explicit exclusions

No Hypothesis Confidence changes, Decision Runtime, GLOBAL/session support, providers, embeddings, behavioral/free-text inference, Memory/Evidence writes, Trends, Intelligence Snapshot, Recommendation Bridge, UI, temporal aggregation, or other measurement model is included.

