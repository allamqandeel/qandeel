# HRS Repair Measurement Model v1

HIM Expansion & Human Intelligence Completion — metric 12/17, the third HRS
metric, delivered together with `hrs.communication@1` (metric 11/17) in
migration `0044_hrs_communication_repair_measurement_models_v1.sql`;
migrations `0001`–`0043` are unchanged. The two metrics share one migration
**only** because the owned RELATIONSHIP measurement-target substrate from
0043 already exists — they remain two fully independent measurement systems
with separate constructs, vocabularies, instruments, scales, models,
approvals, bindings, RPC families, and lock namespaces. After this task
exactly twelve structured metrics are calibrated and five remain
uncalibrated — a one-time migration-phase transition, never a permanent
historical-verifier ceiling.

## Construct boundary

`hrs.repair@1` measures **relationship-bound current repair effectiveness
after meaningful interpersonal rupture**: based on repair opportunities the
user has actually experienced in one exact relationship, the user's current
appraisal of how effectively the relationship can reduce the unresolved
impact of hurt, tension, misunderstanding, or conflict and restore workable
connection through acknowledgment, clarification, de-escalation,
accountability, or corrective action. The core object is **repair after a
rupture, not whether conflict exists**.

Repair can happen without full agreement. Repair can be partial. Calming
down alone is not necessarily repair. Forgetting or avoiding the issue is
not automatically repair. Forgiveness is not required for a repair score.

It is a product/HIM relational construct, NOT a clinical inference, and it
must never mean or infer: conflict frequency; absence of conflict; "never
arguing"; generic Communication quality; `hrs.relationship-trust` or
`hrs.emotional-safety`; forgiveness; reconciliation or reunion; staying in
the relationship; relationship satisfaction; love or closeness; attachment
style; moral blame or fault; whether one person apologized; whether the
underlying issue was objectively solved; whether the other person is safe;
an abuse-risk assessment; a clinical construct; or a stay/leave
Recommendation.

```text
Repair != Absence of Conflict
Repair != Never Arguing
Repair != Communication Quality
Repair != Forgiveness / Reconciliation
Repair != Relationship Trust
Repair != Emotional Safety
```

A relationship may communicate clearly during ordinary conversation yet
repair poorly after hurt; may have low Trust but still show strong repair
behavior; or may repair disagreements while still being emotionally unsafe.
The metric permits every such combination — nothing forces sibling metrics
to correlate.

**Direction is not correctness or health.** A higher score means only more
self-reported current repair effectiveness in this exact relationship. It
does not mean the relationship is healthy, the ruptures were acceptable,
the other person is safe, or that any recommendation follows. **No
recommendation or safety decision may be derived from this score.** No
clinical terminology enters user data or outputs, **no founder
questionnaire is claimed or required**, and **no external or clinical
validation is claimed**.

## Measurement — one exact at-report relationship appraisal

Repair v1 is **one exact RELATIONSHIP-bound current at-report appraisal
grounded in actual prior repair opportunities** — never a seven-day
frequency measure, a "last conflict" persistence flag, or a per-episode
ledger:

- the 0043 owned RELATIONSHIP target substrate is reused unchanged: exactly
  one owned target created through the existing
  `create_him_relationship_measurement_target_v1` RPC, with the
  server-derived opaque label never interpreted semantically. No new
  rupture/event target table and no relationship/social-graph/contact/
  person entity exists;
- `him_measurement_events.observation_window_start` /
  `observation_window_end` are **NULL** for every Repair event, and the
  calculation refuses any non-NULL window; no 7/14/30-day period exists;
- no caller-selected window exists; the server-authoritative report time is
  the measurement time; client timestamps remain untrusted diagnostics;
- instrument
  `hrs.repair.direct-relationship-bound-repair-effectiveness-report@1`,
  source `DIRECT_STRUCTURED_USER_REPORT` only. No LLM/provider call,
  conversation-text or sentiment inference, Memory/Evidence inference,
  keyword heuristics, embeddings, or passive telemetry — the v1 metric
  exists only from the user's explicit structured report.

### Canonical prompt semantics

English semantic template (documentation/product semantics only — not
hard-coded UI): "When something important between you causes hurt, tension,
misunderstanding, or conflict, and based on what you have actually
experienced in this relationship, how well are you able to repair the
impact afterward — through acknowledgment, clarification, calming the
escalation, taking responsibility, or making a corrective step — so the
rupture does not simply remain unresolved between you?" Canonical
founder-facing ar-EG example:
«لما بيحصل بينكم زعل أو سوء فهم أو خلاف مهم، وبناءً على اللي شفته فعلًا في
العلاقة دي، لحد قد إيه بتعرفوا تصلحوا أثر اللي حصل — بالاعتراف بالمشكلة، أو
التوضيح، أو التهدئة، أو تحمل المسؤولية، أو خطوة تصحيح — بدل ما يفضل أثر
الخلاف معلق بينكم؟»

The wording is deliberately rupture-anchored ("when something important …
causes hurt"), experience-grounded ("based on what you have actually
experienced"), and mechanism-framed (acknowledgment, clarification,
de-escalation, responsibility, corrective step). It never asks "Do you
fight?", "Did they apologize?", "Have you forgiven them?", or "Did you get
back together?".

## Scale, special responses, and calculation

Scale `hrs.repair.effectiveness-5.v1@1`, ORDINAL only (no interval/ratio
operations, averages, percentages, thresholds, bands, healthy/unhealthy
readings, clinical cutoffs, cross-relationship comparison, or implicit
"more is always better" rule):

```text
VERY_LOW → 1   LOW → 2   MODERATE → 3   HIGH → 4   VERY_HIGH → 5
NO_MEANINGFUL_REPAIR_OPPORTUNITY → UNASSESSED (null)
TOO_EPISODE_DEPENDENT_TO_RATE    → UNASSESSED (null)
NOT_SURE                         → UNASSESSED (null)
missing observation              → UNASSESSED (null)
contradictory refs               → UNASSESSED (null) / PRESENT_UNRESOLVED
```

- **Missing-opportunity protection.** If the user has not experienced a
  meaningful rupture, conflict, or hurt that actually required repair,
  there is no basis to rate repair: absence of conflict is not evidence of
  repair ability. `NO_MEANINGFUL_REPAIR_OPPORTUNITY` is UNASSESSED/null —
  **never converted into a high score because the relationship did not
  recently fight, and never converted into a low score**.
- **Episode-dependence protection.** If some ruptures repair well and
  others remain badly unresolved such that one scalar would erase an
  important difference, `TOO_EPISODE_DEPENDENT_TO_RATE` is UNASSESSED/null
  — **not a midpoint**, and episodes are never averaged. v1 creates no
  repair subdomains or episode ledger; a future version may introduce them
  separately. `NOT_SURE` is equally UNASSESSED/null.

The calculation model
`hrs.repair.direct-structured-current-repair-effectiveness@1` (CALIBRATED,
PRODUCTION, `QANDEEL_HIM_GOVERNANCE`, method
`DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT`,
evidence contract
`FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1`) is
deterministic and rejects non-RELATIONSHIP contexts, target/context
mismatches, forged/untrimmed/oversized target labels, wrong
metric/version/instrument/scale/source identities, malformed and sibling
responses, smuggled temporal windows, and superseded observations. It never
inspects Trust, Communication, Emotional Safety, HBS metrics, Memory,
Evidence, conversation text, or the semantics of the relationship target
label. Metric confidence stays `UNRESOLVED_METRIC_CONFIDENCE`
(UNASSESSED/null), and the Foundation semantic mapping stays UNRESOLVED
with a NULL semantic type — RELATIONSHIP is a context kind, not a semantic
type, and no REPAIR semantic type is invented.

## HRS construct independence

```text
Repair != Relationship Trust
Repair != Communication
Repair != Emotional Safety
```

`hrs.repair@1` has its own vocabulary, instrument, scale, model, approval,
binding, RPC family (`create_hrs_repair_measurement_v1` /
`correct_hrs_repair_measurement_v1` / `calculate_hrs_repair_measurement_v1`),
and advisory-lock namespace (`hrs.repair.observation:`). Nothing is shared
with `hrs.communication` even though both scales use the 1–5 numeric shape,
and no derived formula, composite HRS score, inverse constraint, or hidden
"relationship health" value exists. The verifier proves Trust = 1,
Communication = 5, and Repair = 2 coexist on the same user and the same
RELATIONSHIP target, and that cross-metric calculation and correction are
structurally impossible in every direction. `hrs.emotional-safety` remains
entirely uncalibrated and unobserved by this task.

## Authority, correction, and currentness

The dedicated RPCs follow the hardened 0043 pattern: authenticated owner
only, anon revoked, cross-user fail closed, direct DML bypass blocked,
server-derived measurement identity/provenance, server-authoritative report
time, immutable append-only observations, corrections that supersede on the
SAME measurement event and the SAME exact relationship target (**a
correction changes the response, never the relationship**), NULL event
windows preserved through correction, idempotent calculation for the exact
observation + canonical binding, race-safe correction/calculation in the
Repair-only lock namespace, and superseded observations that can never be
recalculated or surface as current.
`him_current_structured_measurements` and `HimRepository.getLatest()` now
also route `hrs.repair` + RELATIONSHIP; unsupported contexts and
`hrs.emotional-safety` stay on the raw snapshot path.

## Phase decisions

- **Temporal comparability / Trend v1: NOT ELIGIBLE.** Trend v1 remains
  the five-HSE STATE contract: the semantic mapping is unresolved/null,
  Repair is a relationship appraisal (not an HSE STATE point), no approved
  HRS temporal-comparability cadence or minimum-evidence policy exists,
  Repair may be episode/opportunity-dependent, and no "repair getting
  better/worse" threshold is approved. `read_him_trend_source_v1` and
  `HimTrendService` reject `hrs.repair`, with regression proof. A future,
  separately versioned HRS Temporal Comparability contract may admit it
  deliberately.
- **HIM Intelligence Snapshot v1 / Reasoning / FAST-DEEP: NOT ELIGIBLE.**
  Snapshot v1 remains exactly the five HSE STATE metrics and rejects
  RELATIONSHIP, with regression proof. Repair enters no Reasoning
  Consumption, FAST/DEEP projection, prompt guidance, Recommendation
  bridge, or Safety Runtime path. Relationship metrics are sensitive:
  consumption will be a separately designed HRS Runtime Consumption
  contract after the HRS family is complete and reviewed.

## Verification

`hrs-repair.model.spec.ts` (deterministic model), the static contract
`database/tests/hrs-communication-repair-measurement-models-v1.test.mjs`,
the live verifier `database/verify-migration-0044.mjs`
(`npm run verify:hrs-communication-repair:integration`, wired in CI after
the 0043 Relationship Trust verifier and before the HIM Trend verifier),
and the updated structured-measurement preflight manifest (twelve
calibrated metrics, `EXPECTED_UNCALIBRATED_COUNT=5`), where the preflight
continues to derive the calibrated inventory from the application catalog
and compares it to the manifest with both drift directions fail-closed.
Historical verifiers freeze neither a global calibrated count nor any
migration-number ceiling: later HIM Expansion phases may calibrate further
metrics and add migration 0045 and beyond.
