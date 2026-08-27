# HBS Avoidance Measurement Model v1

HIM Expansion & Human Intelligence Completion — metric 6/17. Migration
`0040_hbs_avoidance_measurement_model_v1.sql`; migrations `0001`–`0039` are
unchanged. After this task exactly six structured metrics are calibrated (the
five HSE metrics plus `hbs.avoidance`) and eleven remain uncalibrated.

## Construct boundary

`hbs.avoidance@1` measures **target-bound, recent behavioral avoidance
frequency**: during one fixed recent observation window, how often the user
reports delaying, disengaging from, or not taking an intended next action
toward one explicit owned GOAL or SITUATION **despite having a real
opportunity to act and intending to act**.

It is a product/HIM behavioral construct, NOT a clinical diagnosis, and it
must never mean or infer: a permanent personality trait, "avoidant
personality", an anxiety disorder, fear severity, experiential avoidance of
thoughts/feelings, emotional suppression, generalized procrastination, low
Motivation/Energy/Attention, Consistency, Initiative, inability, lack of
resources/permission/opportunity, deliberate reprioritization, strategic
waiting, a safety-motivated decision not to act, outcome failure, or laziness,
weakness, pathology, or moral judgment.

**Direction is not valence.** A higher score means only a higher frequency of
the narrowly defined self-reported behavior for the exact target and window.
It does not automatically mean worse, unhealthy, clinically significant, or
causally explanatory. No clinical terminology enters user data or outputs, and
**no external or clinical validation is claimed**.

## Measurement

- Instrument: `hbs.avoidance.direct-target-bound-seven-day-report@1`, source
  `DIRECT_STRUCTURED_USER_REPORT` only. No LLM inference, free-text
  classification, keyword heuristics, Memory/Evidence inference, embeddings,
  behavioral telemetry, passive monitoring, or provider call.
- Exact target: exactly one owned `him_measurement_targets` row of kind GOAL
  or SITUATION. The server derives ownership, context kind/ID, and the bounded
  target label from the stored artifact; caller-supplied labels/context are
  never trusted. No GLOBAL score, no CONVERSATION_SESSION score, no
  cross-target aggregation.
- Fixed window: the previous **7 days ending at the server-authoritative
  measurement time** (`windowEnd = canonical report time`,
  `windowStart = windowEnd − 7 days`), stored durably on the immutable
  measurement event (`observation_window_start/end`). The client never chooses
  the window; client timestamps remain untrusted diagnostics. Existing HSE
  events remain null-window right-now events with unchanged semantics.
- Semantic prompt (canonical English template): "During the last 7 days, among
  the times you had a real opportunity to take the next intended step toward
  [target], how often did you delay, avoid, or disengage instead, even though
  you intended to act?" Canonical founder-facing ar-EG example (documentation
  contract, not a hard-coded UI requirement):
  «خلال آخر 7 أيام، في المرات اللي كان عندك فيها فرصة حقيقية تاخد الخطوة اللي
  ناوي عليها ناحية [الهدف]، قد إيه لقيت نفسك بتأجل أو بتتجنب أو بتنسحب بدل ما
  تبدأ أو تكمل؟»

## Scale and calculation

Scale `hbs.avoidance.frequency-5.v1@1`, ORDINAL only (no interval/ratio
operations, no averages, percentages, thresholds, bands, healthy/unhealthy
readings, clinical cutoffs, normalization, or cross-user/cross-target
comparison):

```text
NEVER → 1   RARELY → 2   SOMETIMES → 3   OFTEN → 4   ALMOST_ALWAYS → 5
NO_CLEAR_OPPORTUNITY → UNASSESSED (null)
NOT_SURE             → UNASSESSED (null)
missing observation  → UNASSESSED (null)
contradictory refs   → UNASSESSED (null) / PRESENT_UNRESOLVED
```

`NO_CLEAR_OPPORTUNITY` (no sufficiently clear opportunity existed in the
window) and `NOT_SURE` (the user cannot confidently report the frequency) are
**unassessed, never zero** — the opportunity/intention boundary is part of the
construct. The calculation model
`hbs.avoidance.direct-structured-seven-day-self-report@1` (CALIBRATED,
PRODUCTION, `QANDEEL_HIM_GOVERNANCE`) is deterministic and rejects context/
target mismatches, wrong instruments/scales/sources, malformed or shifted or
non-seven-day windows, superseded observations, and any attempt to treat
missing data as zero. Metric confidence stays `UNRESOLVED_METRIC_CONFIDENCE`
(UNASSESSED/null).

## Authority, correction, and currentness

`create_hbs_avoidance_measurement_v1` / `correct_hbs_avoidance_measurement_v1`
/ `calculate_hbs_avoidance_measurement_v1` follow the hardened HSE authority
model: authenticated owner only, exact owned-target checks, immutable
append-only history, advisory-lock idempotency/concurrency safety, and trusted
calculation provenance (a direct assessed snapshot without calculation
provenance remains blocked). A correction attaches to the SAME measurement
event, preserves the original target and the exact original seven-day window,
supersedes the prior observation, and retires its calculated result/current
snapshot through the existing supersession ledger — a correction changes the
response, never the period. `him_current_structured_measurements` now also
carries Avoidance so `HimRepository.getLatest()` for `hbs.avoidance` in GOAL/
SITUATION can never surface a stale superseded value; the five HSE routes are
unchanged. Every Avoidance snapshot keeps
`semantic_mapping_status='UNRESOLVED'` and `semantic_type=NULL`: calibration
and Foundation semantic mapping are deliberately independent, and no new
semantic type (such as BEHAVIOR) is introduced.

## Phase decisions

- **Temporal comparability / Trend v1: NOT ELIGIBLE.** Avoidance v1 is a
  retrospective seven-day period measurement; adjacent check-ins may represent
  overlapping windows, and Trend v1 is a point-sequence contract built for the
  five HSE right-now ordinal STATE metrics. Treating overlapping period
  windows as adjacent points would create a misleading movement signal, so
  `read_him_trend_source_v1` and `HimTrendService` continue to reject
  `hbs.avoidance`. A future HBS Temporal Comparability Declaration may make it
  eligible only after a deliberate period-window (non-overlap) policy.
- **HIM Intelligence Snapshot v1 / Reasoning: NOT ELIGIBLE.** Snapshot v1 is
  intentionally a five-HSE `semanticType='STATE'` contract; Avoidance retains
  an unresolved NULL semantic mapping, so it enters neither
  `read_him_intelligence_snapshot_v1`, `HIM_SNAPSHOT_SLOTS`, HIM Reasoning
  Consumption, FAST/DEEP projection, nor any prompt guidance. This deliberate
  non-consumption is not a defect: a future, separately versioned and reviewed
  **HBS Runtime Consumption** contract may extend the snapshot architecture
  after multiple HBS metrics are calibrated.

## Verification

`hbs-avoidance.model.spec.ts` (deterministic model), the static contract
`database/tests/hbs-avoidance-measurement-model-v1.test.mjs`, the live
verifier `database/verify-migration-0040.mjs`
(`npm run verify:hbs-avoidance:integration`, wired in CI after the five HSE
verifiers and before the HIM Trend verifier), and the updated structured-
measurement preflight manifest (six calibrated metrics,
`EXPECTED_UNCALIBRATED_COUNT=11`).
