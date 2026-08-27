# HBS Consistency Measurement Model v1

HIM Expansion & Human Intelligence Completion — metric 7/17, delivered with
Initiative (8/17) as the first deliberately combined task. Migration
`0041_hbs_consistency_initiative_measurement_models_v1.sql`; migrations
`0001`–`0040` are unchanged. After this task exactly eight structured metrics
are calibrated (five HSE plus `hbs.avoidance`, `hbs.consistency`, and
`hbs.initiative`) and nine remain uncalibrated.

## Construct boundary

`hbs.consistency@1` measures **target-bound recent behavioral follow-through
consistency**: during the fixed previous seven days, across repeated real
opportunities to carry out intended next actions toward one explicit owned
GOAL or SITUATION, how consistently the user reports following through
roughly in line with those intended actions.

It is a product/HIM behavioral construct, NOT a clinical inference, and it
must never mean or infer: a permanent personality trait, conscientiousness,
discipline, reliability as a moral judgment, perfectionism, productivity,
outcome success, quality of execution, amount of effort, habit strength,
Motivation, Initiative, Avoidance, compliance with other people, rigidity,
"never changing your mind", or clinical functioning. A user may rationally
change a plan: deliberate reprioritization is not automatically
inconsistency.

**Direction is not valence.** A higher score means only more frequent
self-reported follow-through under this exact contract for the exact target
and window. It does not automatically mean better, healthier, or more
virtuous. No clinical terminology enters user data or outputs, and **no
external or clinical validation is claimed**.

## Measurement

- Instrument: `hbs.consistency.direct-target-bound-seven-day-report@1`,
  source `DIRECT_STRUCTURED_USER_REPORT` only. No LLM inference, free-text
  classification, keyword heuristics, Memory/Evidence inference, embeddings,
  behavioral telemetry, passive monitoring, or provider call.
- Exact target: exactly one owned `him_measurement_targets` row of kind GOAL
  or SITUATION. The server derives ownership, context kind/ID, and the
  bounded target label from the stored artifact; caller-supplied
  labels/context are never trusted. No GLOBAL score, no CONVERSATION_SESSION
  score, no cross-target aggregation.
- Fixed window: the previous **7 days ending at the server-authoritative
  measurement time** (`windowEnd = canonical report time`,
  `windowStart = windowEnd − 7 days`), stored durably on the immutable
  measurement event using the 0040-era durable event window contract. The
  client never chooses the window; client timestamps remain untrusted
  diagnostics. No 14- or 30-day variant exists.
- Semantic prompt (canonical English template): "During the last 7 days,
  across the times you had a real opportunity to carry out the next step you
  intended toward [target], how often did you follow through roughly as
  intended?" Canonical founder-facing ar-EG example (documentation contract,
  not a hard-coded UI requirement):
  «خلال آخر 7 أيام، في المرات اللي كان عندك فيها فرصة حقيقية تعمل الخطوة
  اللي كنت ناوي عليها ناحية [الهدف]، قد إيه نفّذتها تقريبًا زي ما كنت ناوي؟»

## Scale and calculation

Scale `hbs.consistency.frequency-5.v1@1`, ORDINAL only (no interval/ratio
operations, no averages, percentages, thresholds, bands, healthy/unhealthy
readings, clinical cutoffs, normalization, or cross-user/cross-target
comparison):

```text
NEVER → 1   RARELY → 2   SOMETIMES → 3   OFTEN → 4   ALMOST_ALWAYS → 5
INSUFFICIENT_REPEATED_OPPORTUNITIES → UNASSESSED (null)
NOT_SURE                            → UNASSESSED (null)
missing observation                 → UNASSESSED (null)
contradictory refs                  → UNASSESSED (null) / PRESENT_UNRESOLVED
```

`INSUFFICIENT_REPEATED_OPPORTUNITIES` (not enough repeated opportunities in
the window for a meaningful consistency-frequency report) and `NOT_SURE` are
**unassessed, never zero**. The calculation model
`hbs.consistency.direct-structured-seven-day-self-report@1` (CALIBRATED,
PRODUCTION, `QANDEEL_HIM_GOVERNANCE`) is deterministic and rejects
context/target mismatches, wrong instruments/scales/sources, malformed or
shifted or non-seven-day windows, superseded observations, sibling
(Initiative/Avoidance) observations and vocabularies, and any attempt to
treat missing data as zero. Metric confidence stays
`UNRESOLVED_METRIC_CONFIDENCE` (UNASSESSED/null).

## Independence

`hbs.consistency@1` is fully independent of `hbs.initiative@1` and
`hbs.avoidance@1`: its own instrument, scale, model, approval, bindings,
observations, calculation results, and snapshots. No inverse formula
(`consistency = 6 − avoidance` is prohibited), no composite behavior score,
and no sibling-derived value exists. High initiative with low consistency,
low initiative with high (externally prompted) consistency, and every other
combination remain expressible.

## Authority, correction, and currentness

`create_hbs_consistency_measurement_v1` /
`correct_hbs_consistency_measurement_v1` /
`calculate_hbs_consistency_measurement_v1` follow the merged Avoidance
authority pattern: authenticated owner only, exact owned-target checks,
immutable append-only history, advisory-lock idempotency/concurrency safety
in a Consistency-only lock namespace, and trusted calculation provenance (a
direct assessed snapshot without calculation provenance remains blocked). A
correction attaches to the SAME measurement event, preserves the original
target and the exact original seven-day window, supersedes the prior
observation, and retires its calculated result/current snapshot through the
existing supersession ledger. `him_current_structured_measurements` now also
carries Consistency so `HimRepository.getLatest()` in GOAL/SITUATION can
never surface a stale superseded value; the five HSE routes and the
Avoidance route are unchanged. Every snapshot keeps
`semantic_mapping_status='UNRESOLVED'` and `semantic_type=NULL`; no new
semantic type (such as BEHAVIOR) is introduced.

## Phase decisions

- **Temporal comparability / Trend v1: NOT ELIGIBLE.** Consistency v1 is a
  retrospective seven-day period measurement; adjacent check-ins may
  represent overlapping windows, and Trend v1 is a five-HSE point-sequence
  contract. `read_him_trend_source_v1` and `HimTrendService` reject
  `hbs.consistency`, with regression proof.
- **HIM Intelligence Snapshot v1 / Reasoning: NOT ELIGIBLE.** Snapshot v1 is
  a five-HSE `semanticType='STATE'` contract; Consistency retains an
  unresolved NULL semantic mapping, so it enters neither
  `read_him_intelligence_snapshot_v1`, `HIM_SNAPSHOT_SLOTS`, HIM Reasoning
  Consumption, FAST/DEEP projection, nor any prompt guidance. A future,
  separately versioned **HBS Runtime Consumption** contract will decide how
  calibrated HBS signals enter reasoning.

## Verification

`hbs-consistency.model.spec.ts` (deterministic model), the static contract
`database/tests/hbs-consistency-initiative-measurement-models-v1.test.mjs`,
the live verifier `database/verify-migration-0041.mjs`
(`npm run verify:hbs-consistency-initiative:integration`, wired in CI after
the Avoidance 0040 verifier and before the HIM Trend verifier), and the
updated structured-measurement preflight manifest (eight calibrated metrics,
`EXPECTED_UNCALIBRATED_COUNT=9`).
