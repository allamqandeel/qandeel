# HSE Stress Measurement Model v1

## Production contract

`hse.stress@1` is an HSE `STATE`: the user's current subjective psychological pressure or strain within one exact owned `SITUATION` or `CONVERSATION_SESSION`. It records experienced pressure, not an objective judgment about circumstances. `GLOBAL`, `GOAL`, and `DECISION` are unsupported.

Instrument `hse.stress.direct-self-report@1` is a one-item `DIRECT_STRUCTURED_SELF_REPORT` with RIGHT_NOW meaning. The session ar-EG realization is `دلوقتي، مستوى الضغط النفسي عندك عامل إزاي؟`; the situation realization is `دلوقتي، مستوى الضغط النفسي عليك في الموقف ده عامل إزاي؟`. SITUATION uses the existing server-owned HIM target authority, while sessions resolve only through owned `conversation_sessions`.

## Construct boundaries

Stress is separate from Anxiety, fear, worry, objective workload, responsibility count, urgency, perceived control, Energy/fatigue, mood, physiological arousal, outward behavior, performance, coping failure, crisis, burnout, and clinical or psychiatric diagnosis. None of those are scoring inputs or proxies. Metric Confidence remains `UNASSESSED`/null and is separate from Hypothesis or provider confidence.

## Scale and calculation

`hse.stress.ordinal-5.v1@1` preserves `VERY_LOW`, `LOW`, `MODERATE`, `HIGH`, and `VERY_HIGH` as bounded ordinal storage codes 1–5. `NOT_SURE` and absence remain `UNASSESSED`/null. The encoding is not interval arithmetic, a percentage, or clinical severity. No thresholds, averages, inference, temporal aggregation, or cross-metric formula exists.

## Integrity, governance, and security

Stress reuses the hardened structured path: event → immutable observation → exact ACTIVE binding → deterministic result → trusted snapshot. Database time is canonical. Correction is append-only, supersedes old derived state, shares the observation advisory lock with calculation, and leaves no current value before recalculation. Calculation is idempotent and revalidates currentness under lock.

Separate governed ACTIVE bindings authorize SITUATION and CONVERSATION_SESSION. Enforcement validates exact model, lifecycle, environment, metric, definition, context, instrument, scale, and approval identity. RLS and server-side ownership checks reject fabricated, mismatched, or cross-user targets/sessions and direct assessed writes. `CALIBRATED` means internally approved deterministic production measurement, not clinical, diagnostic, psychometric, burnout, or population validation.

## Explicit exclusions

No Anxiety model, clinical logic, passive/free-text/behavioral inference, providers, embeddings, Memory/Evidence writes, Trends, Intelligence Snapshot, new runtime, UI, or other metric is included.

