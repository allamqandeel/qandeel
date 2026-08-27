# HBS Initiative Measurement Model v1

HIM Expansion & Human Intelligence Completion — metric 8/17, delivered with
Consistency (7/17) as the first deliberately combined task. Migration
`0041_hbs_consistency_initiative_measurement_models_v1.sql`; migrations
`0001`–`0040` are unchanged. After this task exactly eight structured metrics
are calibrated (five HSE plus `hbs.avoidance`, `hbs.consistency`, and
`hbs.initiative`) and nine remain uncalibrated.

## Construct boundary

`hbs.initiative@1` measures **target-bound recent self-initiated action
frequency**: during the fixed previous seven days, among real opportunities
where a reasonably clear next action toward one explicit owned GOAL or
SITUATION was within the user's own responsibility, how often the user
reports starting that action without first needing another person or system
to prompt, remind, or direct them.

It is a product/HIM behavioral construct, NOT a clinical inference, and it
must never mean or infer: a permanent personality trait, extraversion,
dominance, assertiveness, leadership, ambition, Motivation, productivity,
amount of work, urgency, impulsivity, risk-taking, "doing everything alone",
refusing collaboration, ignoring necessary approvals/dependencies, starting
actions that were not actually the user's responsibility, or clinical
functioning. Waiting is not low initiative when another person must act
first, approval is genuinely required, information is unavailable, the
action is unsafe, the next step is not clear enough, or the action is
outside the user's responsibility.

**Direction is not valence.** A higher score means only more frequent
self-initiated starts in the exact eligible opportunities and window. It
does not automatically mean better. No clinical terminology enters user data
or outputs, and **no external or clinical validation is claimed**.

## Measurement

- Instrument: `hbs.initiative.direct-target-bound-seven-day-report@1`,
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
  when there was a clear useful next step toward [target] that was yours to
  take, how often did you start it on your own before someone or something
  had to prompt or remind you?" Canonical founder-facing ar-EG example
  (documentation contract, not a hard-coded UI requirement):
  «خلال آخر 7 أيام، لما كانت فيه خطوة واضحة ومفيدة ناحية [الهدف] وكانت
  مسؤوليتك أنت إنك تبدأها، قد إيه بدأت من نفسك قبل ما تحتاج حد أو حاجة
  تفكّرك أو تزقّك؟»

## Scale and calculation

Scale `hbs.initiative.frequency-5.v1@1`, ORDINAL only (no interval/ratio
operations, no averages, percentages, thresholds, bands, healthy/unhealthy
readings, clinical cutoffs, normalization, or cross-user/cross-target
comparison):

```text
NEVER → 1   RARELY → 2   SOMETIMES → 3   OFTEN → 4   ALMOST_ALWAYS → 5
NO_CLEAR_SELF_OWNED_OPPORTUNITY → UNASSESSED (null)
NOT_SURE                        → UNASSESSED (null)
missing observation             → UNASSESSED (null)
contradictory refs              → UNASSESSED (null) / PRESENT_UNRESOLVED
```

`NO_CLEAR_SELF_OWNED_OPPORTUNITY` (no sufficiently clear self-owned
opportunity existed in the window — waiting on others, approvals,
information, safety, or responsibility boundaries) and `NOT_SURE` are
**unassessed, never zero** — the self-owned-opportunity boundary is part of
the construct. The calculation model
`hbs.initiative.direct-structured-seven-day-self-report@1` (CALIBRATED,
PRODUCTION, `QANDEEL_HIM_GOVERNANCE`) is deterministic and rejects
context/target mismatches, wrong instruments/scales/sources, malformed or
shifted or non-seven-day windows, superseded observations, sibling
(Consistency/Avoidance) observations and vocabularies, and any attempt to
treat missing data as zero. Metric confidence stays
`UNRESOLVED_METRIC_CONFIDENCE` (UNASSESSED/null).

## Independence

`hbs.initiative@1` is fully independent of `hbs.consistency@1` and
`hbs.avoidance@1`: its own instrument, scale, model, approval, bindings,
observations, calculation results, and snapshots. No inverse formula
(`initiative = 6 − avoidance` is prohibited), no composite behavior score,
and no sibling-derived value exists. Low avoidance with low initiative (few
self-owned starts), high avoidance with moderate consistency, and every
other combination remain expressible.

## Authority, correction, and currentness

`create_hbs_initiative_measurement_v1` /
`correct_hbs_initiative_measurement_v1` /
`calculate_hbs_initiative_measurement_v1` follow the merged Avoidance
authority pattern: authenticated owner only, exact owned-target checks,
immutable append-only history, advisory-lock idempotency/concurrency safety
in an Initiative-only lock namespace, and trusted calculation provenance (a
direct assessed snapshot without calculation provenance remains blocked). A
correction attaches to the SAME measurement event, preserves the original
target and the exact original seven-day window, supersedes the prior
observation, and retires its calculated result/current snapshot through the
existing supersession ledger. `him_current_structured_measurements` now also
carries Initiative so `HimRepository.getLatest()` in GOAL/SITUATION can
never surface a stale superseded value; the five HSE routes and the
Avoidance route are unchanged. Every snapshot keeps
`semantic_mapping_status='UNRESOLVED'` and `semantic_type=NULL`; no new
semantic type (such as BEHAVIOR) is introduced.

## Phase decisions

- **Temporal comparability / Trend v1: NOT ELIGIBLE.** Initiative v1 is a
  retrospective seven-day period measurement; adjacent check-ins may
  represent overlapping windows, and Trend v1 is a five-HSE point-sequence
  contract. `read_him_trend_source_v1` and `HimTrendService` reject
  `hbs.initiative`, with regression proof.
- **HIM Intelligence Snapshot v1 / Reasoning: NOT ELIGIBLE.** Snapshot v1 is
  a five-HSE `semanticType='STATE'` contract; Initiative retains an
  unresolved NULL semantic mapping, so it enters neither
  `read_him_intelligence_snapshot_v1`, `HIM_SNAPSHOT_SLOTS`, HIM Reasoning
  Consumption, FAST/DEEP projection, nor any prompt guidance. A future,
  separately versioned **HBS Runtime Consumption** contract will decide how
  calibrated HBS signals enter reasoning.

## Verification

`hbs-initiative.model.spec.ts` (deterministic model), the static contract
`database/tests/hbs-consistency-initiative-measurement-models-v1.test.mjs`,
the live verifier `database/verify-migration-0041.mjs`
(`npm run verify:hbs-consistency-initiative:integration`, wired in CI after
the Avoidance 0040 verifier and before the HIM Trend verifier), and the
updated structured-measurement preflight manifest (eight calibrated metrics,
`EXPECTED_UNCALIBRATED_COUNT=9`).
