# HSE Motivation Measurement Model v1

## Production contract

`hse.motivation@1` is an HSE `STATE`: the user's current self-reported motivational drive toward one explicit target bound to one exact `GOAL` or `SITUATION`. It is not Energy, readiness, ability, availability, importance, obligation, execution, productivity, excitement, mood, priority, evidence count, Memory content, or model inference. `GLOBAL` and untargeted conversation-session measurements are unsupported.

Instrument `hse.motivation.direct-self-report@1` uses `DIRECT_STRUCTURED_SELF_REPORT` with RIGHT_NOW meaning and the semantic template “Right now, how strong is your motivation/drive toward [explicit target]?” The target is required data and its context kind/id must equal the observation's bound context. The founder-tested ar-EG example is `دلوقتي، قد إيه حاسس إن عندك دافع تكمل شغل QANDEEL؟`; QANDEEL is only an example target and is not hard-coded.

## Scale and calculation

`hse.motivation.ordinal-5.v1@1` preserves `VERY_LOW`, `LOW`, `MODERATE`, `HIGH`, and `VERY_HIGH` as stable ordered storage codes 1–5. They are not interval or ratio values. `NOT_SURE` and absence are `UNASSESSED`/null; missing is not zero. No bands, threshold, arithmetic, averaging, percentage, baseline, decay, or cross-metric formula exists. Metric Confidence remains `UNASSESSED` with a null reference.

## Hardened shared substrate

Motivation minimally generalizes the Energy substrate: Measurement Event → immutable target-bound Structured Observation → exact ACTIVE Canonical Binding → deterministic calculation result → trusted snapshot. Canonical report/observation time is database-assigned; caller time is diagnostic and untrusted. Correction remains in the same event, appends audit history, invalidates an old result through immutable supersession, and shares the same per-observation advisory lock with calculation. Calculation revalidates currentness under that lock and is idempotent per observation/binding.

`him_current_structured_measurements` is the server-enforced current path for Energy and Motivation. It excludes superseded observations and snapshots. After correction and before replacement calculation, no old Motivation value is current; after calculation, only the replacement is current.

## Governance and security

The calibrated production model is `hse.motivation.direct-structured-self-report@1`, approved by `qandeel.him.motivation.foundation-approval@1`. Separate ACTIVE bindings authorize exact `GOAL` and `SITUATION` contexts. Binding triggers validate model lifecycle/environment, metric/definition/context, instrument, scale, and exact approval/model identity. Binding transitions remain database-owner governed; authenticated users cannot forge or mutate governance artifacts.

Artifacts are owner-scoped through RLS. RPCs derive ownership and canonical metadata server-side, validate exact context shape and mandatory target binding, and reject cross-user/cross-metric operations. Generic direct assessed snapshot writes remain blocked.

`CALIBRATED` means internally approved deterministic production measurement under this exact contract. It is not clinical, diagnostic, population, or psychometric validation. Energy remains calibrated and semantically unchanged; the other 15 initial HIM metrics remain uncalibrated.

## Explicit exclusions

No free-text or behavioral inference, providers, embeddings, Memory/Evidence writes, Trends, Intelligence Snapshot, Recommendation Bridge, UI, temporal aggregation, or other HIM model is included.

