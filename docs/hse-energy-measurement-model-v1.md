# HSE Energy Measurement Model v1

## Canonical construct

`hse.energy@1` remains an HSE `STATE`. It represents the user's current subjective experience of how much energy they feel they have at a specific measurement event and context. It is not capacity, productivity, motivation, attention, mood, stress, fatigue, sleep, fitness, health, metabolic energy, personality, readiness, or the inverse of Fatigue.

## Instrument and scope

V1 accepts only `DIRECT_STRUCTURED_USER_REPORT` in Arabic Egyptian (`ar-EG`) with recall period `RIGHT_NOW` and prompt `دلوقتي، حاسس إن عندك طاقة قد إيه؟`. Production context is exactly one `CONVERSATION_SESSION`; catalog support for `SITUATION` does not authorize this model there. English is documentation-only and no transcript, Memory, behavior, voice, provider, embedding, or inferred signal is an input.

## Ordinal scale

Scale `hse.energy.ordinal-5.v1` maps `VERY_LOW`, `LOW`, `MODERATE`, `HIGH`, `VERY_HIGH` to storage codes 1–5. `NOT_SURE`, skip, decline, missing, and no response are unassessed/null. Codes are ordered categories: interval and ratio operations, fractions, equal-spacing claims, averages, percentages, arithmetic deltas, and trends are forbidden.

## Events, observations, and correction

A server-generated Measurement Event is distinct from its exact session context. Separate events in one session may validly differ. A structured report is stored as an owned first-class Measurement Observation, never automatically as Memory or generic Evidence. It binds event, metric/definition, instrument, scale, exact context, response, report time, locale, source, and provenance.

An explicit correction appends an observation in the same event with `supersedes_observation_id`. The server verifies same owner, metric, event, context, instrument, and scale. Timestamp order alone never implies correction. Superseded observations remain immutable history and cannot be calculated. A later state change creates a new event.

## Deterministic calculation and confidence

The calibrated model is `hse.energy.direct-structured-user-report@1`. It supports `CONVERSATION_SESSION` only and uses the one active canonical binding. Scored responses map exactly to integers 1–5. `NOT_SURE` is unassessed/null. Missing, superseded, cross-user, wrong-context, wrong-instrument, wrong-scale, and out-of-contract inputs fail closed. Competing current observations are never averaged.

Metric value remains separate from Metric Confidence. V1 always stores confidence as `UNASSESSED` with a null reference and never reuses Hypothesis Confidence.

## Governance and CALIBRATED meaning

The immutable approval `qandeel.him.energy.foundation-approval@1` represents QANDEEL Foundation authorization of the exact construct, method, recall period, context, Arabic instrument, ordinal scale, Founder/Design F1+F2 validation, deterministic mapping, event/correction/missingness rules, security invariants, and explicit absence of an external-validation claim.

For this exact model, `CALIBRATED` means approved for deterministic production measurement under QANDEEL's internal v1 contract. It does not mean clinically, physiologically, population, target-user, or psychometrically validated. Ordinary authenticated callers cannot author model, binding, scale, or approval records or promote arbitrary authority strings.

## Trusted assessed-write path

Canonical assessed snapshots can arise only through `Measurement Event → Measurement Observation → Active Canonical Binding → Deterministic Calculation Result → HIM Metric Snapshot`. Database provenance binds the exact event, observation, model, binding, instrument, scale, and result. Generic authenticated snapshot creation remains unassessed-only in effect: an assessed insert without trusted calculation provenance is rejected by the database.

## Security, privacy, and current catalog state

Events and observations are UUID-based, user-owned, RLS-protected, and append-only. Canonical tables are default-deny for authenticated writes. Server functions derive ownership and canonical metadata and validate exact session ownership. Raw unrestricted conversation text is not copied. Memory, Evidence, Hypothesis, Confidence, Question, Behavioral, Safety, routing, and provider runtimes are not mutated.

Current state after migration 0012: `hse.energy` is the single `CALIBRATED` production metric and the other 16 metrics remain `UNCALIBRATED`.

## Explicit limitations

No English production locale, `SITUATION` model, external psychometric validation, clinical claim, metric-confidence formula, trend, averaging, automatic cadence, UI exposure, ContextBuilder injection, provider call, or inferred Energy calculation is included.

