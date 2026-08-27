# HRS Communication Measurement Model v1

HIM Expansion & Human Intelligence Completion — metric 11/17, the second
HRS metric, delivered together with `hrs.repair@1` (metric 12/17) in
migration `0044_hrs_communication_repair_measurement_models_v1.sql`;
migrations `0001`–`0043` are unchanged. The two metrics share one migration
**only** because the owned RELATIONSHIP measurement-target substrate from
0043 already exists — they remain two fully independent measurement systems
with separate constructs, vocabularies, instruments, scales, models,
approvals, bindings, RPC families, and lock namespaces. After this task
exactly twelve structured metrics are calibrated (five HSE, four HBS,
`hrs.relationship-trust`, `hrs.communication`, and `hrs.repair`) and five
remain uncalibrated — a one-time migration-phase transition, never a
permanent historical-verifier ceiling.

## Construct boundary

`hrs.communication@1` measures **relationship-bound current communication
workability**: based on what the user has actually experienced in one exact
relationship, the user's current appraisal of how workable communication is
when something important needs to be expressed, heard, clarified, and
understood well enough for the exchange to continue constructively,
including when the two people do not initially agree. The core object is
whether important communication can meaningfully **"get through"** and
produce enough shared understanding to keep the interaction workable.

The construct is **dyadic as perceived by the user, never an objective
judgment about the other person**. It is a product/HIM relational
construct, NOT a clinical inference, and it must never mean or infer:
amount or frequency of talking; sociability or extraversion; verbosity;
agreement; absence of conflict; relationship satisfaction; love, closeness,
intimacy, or affection; `hrs.relationship-trust`, `hrs.repair`, or
`hrs.emotional-safety`; honesty or truthfulness; the other person's
objective communication skill; conflict resolution success; persuasion;
compliance; compatibility; a clinical/diagnostic construct; a safety
verdict; or Recommendation authority.

```text
Communication != Amount of Talking
Communication != Agreement / Absence of Conflict
Communication != Relationship Satisfaction
Communication != Relationship Trust
Communication != Repair Capacity
Communication != Emotional Safety
```

A relationship may have high Communication and low Trust; high
Communication and poor Repair; or low Communication and high Emotional
Safety. The metric permits every such combination — nothing forces sibling
metrics to correlate.

**Direction is not correctness or health.** A higher score means only more
self-reported current workability of important communication in this exact
relationship. It does not mean the relationship is healthy, the other
person communicates well in general, the user is right, or that any
recommendation follows. **No recommendation or safety decision may be
derived from this score.** No clinical terminology enters user data or
outputs, **no founder questionnaire is claimed or required**, and **no
external or clinical validation is claimed**.

## Measurement — one exact at-report relationship appraisal

Communication v1 is **one exact RELATIONSHIP-bound current at-report
appraisal grounded in actual experience** — never a seven-day period
measurement, a talk-frequency count, or a per-conversation rating:

- the 0043 owned RELATIONSHIP target substrate is reused unchanged: exactly
  one owned target created through the existing
  `create_him_relationship_measurement_target_v1` RPC, with the
  server-derived opaque label never interpreted semantically. No new
  relationship/social-graph/contact/person entity exists;
- `him_measurement_events.observation_window_start` /
  `observation_window_end` are **NULL** for every Communication event, and
  the calculation refuses any non-NULL window; no 7/14/30-day period
  exists;
- no caller-selected window exists; the server-authoritative report time is
  the measurement time; client timestamps remain untrusted diagnostics;
- instrument
  `hrs.communication.direct-relationship-bound-communication-workability-report@1`,
  source `DIRECT_STRUCTURED_USER_REPORT` only. No LLM/provider call,
  conversation-text or sentiment inference, Memory/Evidence inference,
  keyword heuristics, embeddings, or passive telemetry — the v1 metric
  exists only from the user's explicit structured report.

### Canonical prompt semantics

English semantic template (documentation/product semantics only — not
hard-coded UI): "Thinking about this relationship as it stands now, and
based on what has actually happened between you, how workable is
communication when something important needs to be said — can you both get
the important point across and understand each other well enough for the
conversation to keep moving, even when you disagree?" Canonical
founder-facing ar-EG example:
«وأنت بتفكر في علاقتك بالشخص ده دلوقتي، وبناءً على اللي حصل بينكم فعلًا،
لحد قد إيه التواصل بينكم بيسمح إن كل واحد يوصل اللي مهم ويفهم التاني بشكل
كفاية عشان الكلام يفضل ممكن ومفيد، حتى لو مش متفقين؟»

The wording is deliberately current ("as it stands now"),
experience-grounded ("based on what has actually happened between you"),
and workability-framed (express, hear, clarify, understand, keep moving —
even in disagreement). It never asks "Do you talk a lot?", "Do you agree?",
"Do you fight?", or "Are you satisfied with the relationship?".

## Scale, special responses, and calculation

Scale `hrs.communication.workability-5.v1@1`, ORDINAL only (no
interval/ratio operations, averages, percentages, thresholds, bands,
healthy/unhealthy readings, clinical cutoffs, cross-relationship
comparison, or implicit "more is always better" rule):

```text
VERY_LOW → 1   LOW → 2   MODERATE → 3   HIGH → 4   VERY_HIGH → 5
TOO_TOPIC_DEPENDENT_TO_RATE → UNASSESSED (null)
INSUFFICIENT_BASIS_TO_JUDGE → UNASSESSED (null)
NOT_SURE                    → UNASSESSED (null)
missing observation         → UNASSESSED (null)
contradictory refs          → UNASSESSED (null) / PRESENT_UNRESOLVED
```

- **Topic-dependence protection.** Communication can be meaningfully
  topic-dependent: excellent on practical matters yet consistently breaking
  down on emotionally important topics — or vice versa. When one scalar
  would be misleading, `TOO_TOPIC_DEPENDENT_TO_RATE` is UNASSESSED/null —
  **not a midpoint**, and topics are never averaged. v1 creates no
  communication subdomains; a future version may introduce them separately.
- **Insufficient-experience protection.** `INSUFFICIENT_BASIS_TO_JUDGE`
  means a new or sparse relationship has not produced enough meaningful
  exchanges to support a score. This is missing basis, **never zero and
  never "poor communication"**. `NOT_SURE` is equally UNASSESSED/null.

The calculation model
`hrs.communication.direct-structured-current-communication-workability@1`
(CALIBRATED, PRODUCTION, `QANDEEL_HIM_GOVERNANCE`, method
`DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_COMMUNICATION_WORKABILITY_REPORT`,
evidence contract
`FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1`) is
deterministic and rejects non-RELATIONSHIP contexts, target/context
mismatches, forged/untrimmed/oversized target labels, wrong
metric/version/instrument/scale/source identities, malformed and sibling
responses, smuggled temporal windows, and superseded observations. It never
inspects Trust, Repair, Emotional Safety, HBS metrics, Memory, Evidence,
conversation text, or the semantics of the relationship target label.
Metric confidence stays `UNRESOLVED_METRIC_CONFIDENCE` (UNASSESSED/null),
and the Foundation semantic mapping stays UNRESOLVED with a NULL semantic
type — RELATIONSHIP is a context kind, not a semantic type, and no
COMMUNICATION semantic type is invented.

## HRS construct independence

```text
Communication != Relationship Trust
Communication != Repair
Communication != Emotional Safety
```

`hrs.communication@1` has its own vocabulary, instrument, scale, model,
approval, binding, RPC family
(`create_hrs_communication_measurement_v1` /
`correct_hrs_communication_measurement_v1` /
`calculate_hrs_communication_measurement_v1`), and advisory-lock namespace
(`hrs.communication.observation:`). Nothing is shared with `hrs.repair`
even though both scales use the 1–5 numeric shape, and no derived formula,
composite HRS score, inverse constraint, or hidden "relationship health"
value exists. The verifier proves Trust = 1, Communication = 5, and
Repair = 2 coexist on the same user and the same RELATIONSHIP target, and
that cross-metric calculation and correction are structurally impossible in
every direction. `hrs.emotional-safety` remains entirely uncalibrated and
unobserved by this task.

## Authority, correction, and currentness

The dedicated RPCs follow the hardened 0043 pattern: authenticated owner
only, anon revoked, cross-user fail closed, direct DML bypass blocked,
server-derived measurement identity/provenance, server-authoritative report
time, immutable append-only observations, corrections that supersede on the
SAME measurement event and the SAME exact relationship target (**a
correction changes the response, never the relationship**), NULL event
windows preserved through correction, idempotent calculation for the exact
observation + canonical binding, race-safe correction/calculation in the
Communication-only lock namespace, and superseded observations that can
never be recalculated or surface as current.
`him_current_structured_measurements` and `HimRepository.getLatest()` now
also route `hrs.communication` + RELATIONSHIP; unsupported contexts and
`hrs.emotional-safety` stay on the raw snapshot path.

## Phase decisions

- **Temporal comparability / Trend v1: NOT ELIGIBLE.** Trend v1 remains
  the five-HSE STATE contract: the semantic mapping is unresolved/null,
  Communication is a relationship appraisal (not an HSE STATE point), no
  approved HRS temporal-comparability cadence or minimum-evidence policy
  exists, Communication may be topic-dependent, and no
  "improving/worsening communication" threshold is approved.
  `read_him_trend_source_v1` and `HimTrendService` reject
  `hrs.communication`, with regression proof. A future, separately
  versioned HRS Temporal Comparability contract may admit it deliberately.
- **HIM Intelligence Snapshot v1 / Reasoning / FAST-DEEP: NOT ELIGIBLE.**
  Snapshot v1 remains exactly the five HSE STATE metrics and rejects
  RELATIONSHIP, with regression proof. Communication enters no Reasoning
  Consumption, FAST/DEEP projection, prompt guidance, Recommendation
  bridge, or Safety Runtime path. Relationship metrics are sensitive:
  consumption will be a separately designed HRS Runtime Consumption
  contract after the HRS family is complete and reviewed.

## Verification

`hrs-communication.model.spec.ts` (deterministic model), the static
contract
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
