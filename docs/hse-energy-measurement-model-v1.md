# HSE Energy Measurement Model v1

## Canonical construct

`hse.energy@1` remains an HSE `STATE`. It represents the user's current subjective experience of how much energy they feel they have at a specific measurement event and context. It is not capacity, productivity, motivation, attention, mood, stress, fatigue, sleep, fitness, health, metabolic energy, personality, readiness, or the inverse of Fatigue.

## Instrument and scope

V1 accepts only `DIRECT_STRUCTURED_USER_REPORT` in Arabic Egyptian (`ar-EG`) with recall period `RIGHT_NOW` and prompt `دلوقتي، حاسس إن عندك طاقة قد إيه؟`. Production context is exactly one `CONVERSATION_SESSION`, and since migration 0051 the persisted definition and the application catalog carry `CONVERSATION_SESSION` as Energy's only valid context kind — the earlier `SITUATION` entry was Foundation-era drift, never production authority, and is gone. English is documentation-only and no transcript, Memory, behavior, voice, provider, embedding, or inferred signal is an input.

## Ordinal scale

Scale `hse.energy.ordinal-5.v1` maps `VERY_LOW`, `LOW`, `MODERATE`, `HIGH`, `VERY_HIGH` to storage codes 1–5. `NOT_SURE`, skip, decline, missing, and no response are unassessed/null. Codes are ordered categories: interval and ratio operations, fractions, equal-spacing claims, averages, percentages, arithmetic deltas, and trends are forbidden.

## Events, observations, and correction

A server-generated Measurement Event is distinct from its exact session context. Separate events in one session may validly differ. A structured report is stored as an owned first-class Measurement Observation, never automatically as Memory or generic Evidence. It binds event, metric/definition, instrument, scale, exact context, response, report time, locale, source, and provenance. Canonical `reported_at` and snapshot `observed_at` are assigned by the database at receipt; the RPC's timestamp argument is retained only as `client_reported_at_untrusted` diagnostic metadata and never controls RIGHT_NOW ordering or canonical state.

An explicit correction appends an observation in the same event with `supersedes_observation_id`. Correction and calculation serialize on the same observation advisory lock, and calculation revalidates currentness only after acquiring it. The server verifies same owner, metric, event, context, instrument, and scale. Timestamp order alone never implies correction. If the old observation was calculated, an immutable supersession record links its result and snapshot to the correcting observation. The old rows remain audit history but are excluded from the canonical current read; between correction and calculation of the replacement, `him_current_structured_measurements` — and therefore the Energy compatibility read projected from it — returns no Energy value for that event. Once calculated, only the corrected observation is canonical/current. Superseded observations cannot be calculated again. A later state change creates a new event.

## Deterministic calculation and confidence

The calibrated model is `hse.energy.direct-structured-user-report@1`. It supports `CONVERSATION_SESSION` only and uses the one active canonical binding. Scored responses map exactly to integers 1–5. `NOT_SURE` is unassessed/null. Missing, superseded, cross-user, wrong-context, wrong-instrument, wrong-scale, and out-of-contract inputs fail closed. Recalculating the same current observation with the same binding returns its existing result/snapshot; database uniqueness prevents duplicates under concurrent retries. Competing current observations are never averaged.

Metric value remains separate from Metric Confidence. V1 always stores confidence as `UNASSESSED` with a null reference and never reuses Hypothesis Confidence.

## Current and latest read authority

Two different contracts are involved and they are never blurred. *Per-observation currentness* — "the current snapshot for one measurement observation" — is owned by `him_current_structured_measurements`. Since migration 0050 that shared view exposes at most one current snapshot per unsuperseded observation, prefers the snapshot calculated under the exact ACTIVE canonical binding over mere snapshot recency, and otherwise preserves exactly one deterministic latest historical candidate. *Latest measurement across events* — "the newest measurement for this metric and context" — is owned by `read_him_latest_measurement_v1(...)` (migration 0052), which resolves the newest measurement event by immutable event chronology before reading that event's current snapshot.

`him_current_energy_measurements` is retained only as an Energy-v1 backward-compatibility read. Since migration 0053 it is a projection over `him_current_structured_measurements` restricted to `metric_key='hse.energy'` and `definition_version=1`. It owns no independent currentness algorithm: no raw `him_metric_snapshots` join, no correction predicate, no supersession predicate, no binding resolver, no one-row-per-observation selection, and no snapshot ordering. Correction and binding-transition semantics are therefore inherited from the canonical structured-current layer rather than restated, so a canonical binding transition can never surface two "current" Energy snapshots for one observation and a non-Energy structured snapshot can never appear through this Energy-named surface.

The compatibility view is exact to `hse.energy@1`. A future Energy definition version stays entirely legal, but it does not enter this versionless legacy surface automatically and would be read through separately reviewed exact-version authorities. `him_current_energy_measurements` is never the latest-across-events authority; that remains `read_him_latest_measurement_v1(...)` alone, and no latest semantics live in the compatibility view. Owner and RLS behaviour is unchanged: the view stays `security_invoker`, `authenticated` retains its intended SELECT authority, and PUBLIC and `anon` cannot read it. QHIM-012 grants or broadens no `service_role` authority and retires none either — migration 0053 captures the `service_role` SELECT state that existed immediately before the rebuild and proves that pre-migration state is preserved unchanged, so whatever that state is in a given deployment, this task did not move it. Retiring or extending `service_role` access to this surface would be a separately reviewed decision, not a side effect of QHIM-012. No Trend, Intelligence Snapshot, or Runtime Consumption eligibility changes.

## Governance and CALIBRATED meaning

The immutable approval `qandeel.him.energy.foundation-approval@1` represents QANDEEL Foundation authorization of the exact construct, method, recall period, context, Arabic instrument, ordinal scale, Founder/Design F1+F2 validation, deterministic mapping, event/correction/missingness rules, security invariants, and explicit absence of an external-validation claim.

For this exact model, `CALIBRATED` means approved for deterministic production measurement under QANDEEL's internal v1 contract. It does not mean clinically, physiologically, population, target-user, or psychometrically validated. Binding validation enforces the exact approved model/version, target metric/definition/context, calibrated production lifecycle, instrument, and scale. A database-owner governance transition can atomically retire the prior ACTIVE binding and activate a validated PENDING successor while preserving both records; EXECUTE is revoked from public application roles, and ordinary authenticated callers cannot author or transition model, binding, scale, or approval records or promote arbitrary authority strings.

## Trusted assessed-write path

Canonical assessed snapshots can arise only through `Measurement Event → Measurement Observation → Active Canonical Binding → Deterministic Calculation Result → HIM Metric Snapshot`. Database provenance binds the exact event, observation, model, binding, instrument, scale, and result. Generic authenticated snapshot creation is no longer an available write path of any kind: migration 0051 retired `create_him_metric_snapshot(jsonb)` as a fail-closed no-write tombstone with EXECUTE revoked from every application role, so canonical measurement state can be created only through the metric-owned structured measurement RPCs. Assessed inserts without trusted calculation provenance remain rejected by the database independently of that retirement.

## Security, privacy, and current catalog state

Events and observations are UUID-based, user-owned, RLS-protected, and append-only. Canonical tables are default-deny for authenticated writes. Server functions derive ownership and canonical metadata and validate exact session ownership. Raw unrestricted conversation text is not copied. Memory, Evidence, Hypothesis, Confidence, Question, Behavioral, Safety, routing, and provider runtimes are not mutated.

Historical phase note: immediately after migration 0012, `hse.energy` was the single `CALIBRATED` production metric and the other 16 remained `UNCALIBRATED`. That is a record of the 0012 phase, not current state. Currently all seventeen canonical HIM v1 metrics are `CALIBRATED`, each through its own metric-owned structured measurement path; Energy's own construct, scale, instrument, correction, and confidence contract below are unchanged by that.

## Explicit limitations

No English production locale, `SITUATION` model, binding, instrument, RPC, Snapshot slot, or Trend eligibility, no external psychometric validation, clinical claim, metric-confidence formula, trend, averaging, automatic cadence, UI exposure, ContextBuilder injection, provider call, or inferred Energy calculation is included. A future SITUATION Energy measurement would require a separately reviewed measurement, version, and authority decision.

