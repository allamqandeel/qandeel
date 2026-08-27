# HGS Self-Awareness Measurement Model v1

HIM Expansion & Human Intelligence Completion — metric 14/17, the first
HGS metric, delivered in migration
`0046_hgs_self_awareness_measurement_model_v1.sql`; migrations
`0001`–`0045` are unchanged. After this task exactly fourteen structured
metrics are calibrated (five HSE, four HBS, four HRS, and
`hgs.self-awareness`) and three remain uncalibrated (`hgs.resilience`,
`hgs.purpose-alignment`, `hgs.habit-strength`) — a one-time
migration-phase transition, never a permanent historical-verifier
ceiling. Self-Awareness is implemented alone because its boundary with
HBS Reflection deserves independent verification. **HGS measurement
grants no runtime-consumption authority**: HGS Runtime Consumption
remains a later, separately reviewed contract.

## Construct boundary

`hgs.self-awareness@1` measures **target-bound current perceived
self-understanding clarity**: in one exact GOAL or SITUATION, how
clearly the user currently feels able to recognize and distinguish the
internal experiences and personal drivers that matter here — such as
feelings, needs, motives, values, assumptions, or limits — and
understand how those are shaping their own choices or behavior in this
context.

This is a **current, context-specific self-understanding appraisal**. It
measures perceived clarity, not verified truth. It includes current
perceived clarity about: feelings; needs/what matters; motives/values;
assumptions/expectations; relevant personal limits/tensions; and how
these factors influence the user's own choices or behavior. Those are
construct examples, NOT facets to be scored separately and NOT
subscales.

### Perceived clarity vs objective accuracy — and the Reflection boundary

QANDEEL v1 deliberately separates two constructs:

- **HBS Reflection** (`hbs.reflection@1`, migration 0042) = the
  deliberate reflective PROCESS: how much the user intentionally stepped
  back to examine one exact context;
- **HGS Self-Awareness** (`hgs.self-awareness@1`, this task) = current
  perceived SELF-UNDERSTANDING CLARITY: how clear things inside
  currently feel in one exact context.

It is NOT: HBS Reflection; amount of introspection;
rumination/overthinking; intelligence or wisdom; objective insight
accuracy; global identity or self-concept clarity; a stable personality
trait; emotional intelligence; mindfulness; self-esteem;
`hse.self-confidence`; Motivation; behavior change or growth achieved;
or therapy/diagnosis.

```text
Self-Awareness != Reflection
Self-Awareness != Rumination
Self-Awareness != Self-Confidence
Self-Awareness != Insight Accuracy
Self-Awareness != Growth Outcome
```

**High Reflection + low Self-Awareness must be possible** (much
deliberate examination, still murky inside), and **low Reflection + high
Self-Awareness must be possible** (little deliberate examination, yet
currently clear). The 0046 verifier proves both boundary directions on
the same user and the same owned SITUATION target, plus high Motivation
+ low Self-Awareness and low Motivation + high Self-Awareness on the
same owned GOAL targets, and high Self-Confidence + low Self-Awareness
on the same SITUATION.

**Direction is not correctness.** A higher score means only greater
self-reported current clarity about oneself in the exact context. It
does NOT prove the explanation is accurate, that hidden motives were
identified correctly, that the user is wiser, or that growth occurred.
No validated psychometric instrument, objective accuracy, clinical
validation, or external validation is claimed
(`external_validation_claimed = false`), **no founder questionnaire is
claimed or required**, and no clinical terminology enters user data or
outputs.

## Measurement — one exact target-bound current at-report appraisal

Self-Awareness v1 is **one exact GOAL- or SITUATION-bound current
at-report appraisal** — never a seven-day period measurement, a 30-day
window, a growth trajectory, or a before/after delta. HGS ownership does
not automatically mean longitudinal growth:

- the existing owned GOAL/SITUATION `him_measurement_targets` substrate
  (0013/0014) is reused unchanged: exactly one owned target row
  (`user_id = auth.uid()`, `context_kind IN (GOAL, SITUATION)`) created
  through the existing historical target RPCs, with the server-derived
  opaque label never interpreted semantically. No GLOBAL,
  CONVERSATION_SESSION, DECISION, or RELATIONSHIP context, no new target
  table/RPC, and no HGS-specific target substrate exists;
- `him_measurement_events.observation_window_start` /
  `observation_window_end` are **NULL** for every Self-Awareness event,
  and the calculation refuses any non-NULL window; no 7/30-day period or
  caller-selected window exists;
- the server-authoritative report time is the measurement time; client
  timestamps remain untrusted diagnostics;
- instrument
  `hgs.self-awareness.direct-target-bound-self-understanding-clarity-report@1`,
  source `DIRECT_STRUCTURED_USER_REPORT` only. No LLM/provider call,
  conversation-text inference, sentiment/keyword analysis,
  Memory/Evidence/Hypothesis inference, automatic self-awareness
  inference, or passive telemetry — the v1 metric exists only from the
  user's explicit structured report.

### Canonical prompt semantics

English semantic template (documentation/product semantics only — no
UI/questionnaire/auto-question generation): "Thinking about this goal or
situation as it stands now, how clearly do you understand what is going
on inside you here — what you are feeling, what matters or you need,
what motives, values, assumptions, or limits are influencing you, and
how those things are shaping what you are doing?" Canonical
founder-facing ar-EG example:
«وأنت بتفكر في الهدف أو الموقف ده دلوقتي، لحد قد إيه الصورة واضحة عندك
عن اللي بيحصل جواك فيه — إنت حاسس بإيه، إيه المهم أو اللي محتاجه، إيه
الدوافع أو القيم أو الافتراضات أو الحدود اللي مأثرة عليك، وإزاي الحاجات
دي بتأثر على تصرفاتك؟»

The wording is deliberately current ("as it stands now") and
clarity-framed (how clearly things inside are understood). It never asks
"Did you reflect?", "Is your explanation correct?", or "Have you
grown?".

## Scale, special responses, and calculation

Scale `hgs.self-awareness.clarity-5.v1@1`, ORDINAL only (no
interval/ratio operations, zero, midpoint substitution, facet averages,
percentages, health bands, accuracy percentages, clinical thresholds,
rankings, or automatic growth percentages):

```text
VERY_LOW → 1   LOW → 2   MODERATE → 3   HIGH → 4   VERY_HIGH → 5
TOO_FACET_DEPENDENT_TO_RATE  → UNASSESSED (null)
INSUFFICIENT_BASIS_TO_JUDGE  → UNASSESSED (null)
NOT_SURE                     → UNASSESSED (null)
missing observation          → UNASSESSED (null)
contradictory refs           → UNASSESSED (null) / PRESENT_UNRESOLVED
```

- **Facet-dependence protection.** Self-understanding can be genuinely
  uneven: crystal clear about feelings, murky about motives — or vice
  versa. When one scalar would be misleading,
  `TOO_FACET_DEPENDENT_TO_RATE` is UNASSESSED/null — **not a midpoint**,
  and facets are never averaged. v1 creates no Self-Awareness subscales;
  a future version may introduce them separately.
- **Insufficient-basis protection.** `INSUFFICIENT_BASIS_TO_JUDGE`
  means the context is too new or unclear, or meaningful internal
  reactions have not emerged enough to judge current clarity. Missing
  basis is **neither high nor low self-awareness — never zero**.
  `NOT_SURE` is equally UNASSESSED/null.

The calculation model
`hgs.self-awareness.direct-structured-current-self-understanding-clarity@1`
(CALIBRATED, PRODUCTION, `QANDEEL_HIM_GOVERNANCE`, method
`DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_SELF_UNDERSTANDING_CLARITY_REPORT`,
evidence contract
`FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1` — the exact
activated canonical target-bound evidence contract, reused rather than
reinvented) is deterministic and rejects non-GOAL/SITUATION contexts,
target/context mismatches, forged/untrimmed/oversized target labels,
wrong metric/version/instrument/scale/source identities, malformed and
sibling responses (including the Reflection, Trust, Communication,
Repair, and Emotional Safety special codes), smuggled temporal windows,
and superseded observations. It consumes only its own `observation`
input, never interprets the target label, and never inspects Reflection,
Motivation, Self-Confidence, any other HGS metric, HRS, Memory,
Evidence, or conversation text. Metric confidence stays
`UNRESOLVED_METRIC_CONFIDENCE` (UNASSESSED/null).

## Semantic mapping

`hifOwner = HGS`, `semanticMappingStatus = UNRESOLVED`,
`semanticType = NULL` — deliberately preserved. The construct is NOT
mapped to CAPABILITY simply because it sounds like an ability, and no
SELF_AWARENESS or GROWTH semantic type is created; no
STATE/TRAIT/READINESS/LOAD/PROGRESS mapping is made either.

## Authority, correction, and currentness

The dedicated RPC family
(`create_hgs_self_awareness_measurement_v1` /
`correct_hgs_self_awareness_measurement_v1` /
`calculate_hgs_self_awareness_measurement_v1`) follows the hardened
target-bound pattern: authenticated owner only, anon revoked, cross-user
fail closed, direct DML bypass blocked, server-derived measurement
identity/target UUID/context kind/label/provenance, server-authoritative
report time, immutable append-only observations, corrections that
supersede on the SAME measurement event and the SAME exact target (**a
correction changes the response, never the target**), NULL event windows
preserved through correction, idempotent calculation for the exact
observation + canonical binding, race-safe correction/calculation in the
dedicated `hgs.self-awareness.observation:` advisory-lock namespace,
superseded observations that can never be recalculated or surface as
current, and the direct assessed-snapshot bypass remains blocked. The
trusted snapshot carries metric `hgs.self-awareness`, the exact GOAL or
SITUATION context with the exact target UUID, UNRESOLVED/NULL semantic
mapping, UNASSESSED/null confidence, NULL temporal window, canonical
provenance, and **no accuracy, growth, or wellbeing field**.
`him_current_structured_measurements` and `HimRepository.getLatest()`
now also route `hgs.self-awareness` + GOAL and `hgs.self-awareness` +
SITUATION through the supersession-aware current structured read, while
unsupported contexts and the three remaining uncalibrated HGS metrics
stay on the raw snapshot path — no other HGS metric is routed.

## Phase decisions

- **Temporal comparability / Trend v1: NOT ELIGIBLE.** Trend v1 remains
  the five-HSE STATE contract: the semantic mapping is unresolved/null,
  Self-Awareness is a perceived-clarity appraisal (not an HSE STATE
  point), no approved HGS temporal-comparability cadence or
  minimum-evidence policy exists, and no cadence,
  "increasing/decreasing" language, or growth-trajectory reading of any
  kind is approved. `read_him_trend_source_v1` and `HimTrendService`
  reject `hgs.self-awareness`, with regression proof.
- **HIM Intelligence Snapshot v1 / Reasoning / FAST-DEEP /
  Recommendation: NOT ELIGIBLE.** Snapshot v1 remains exactly the five
  HSE STATE metrics, with regression proof that the GOAL and SITUATION
  slot sets stay exact and carry no Self-Awareness. Self-Awareness
  enters no HIM Reasoning Consumption, FAST/DEEP projection, prompt
  guidance, Recommendation bridge, or proactive behavior. **HGS
  measurement does not authorize HGS Runtime Consumption** — that is a
  later, separately versioned and deliberately reviewed contract.

## Verification

`hgs-self-awareness.model.spec.ts` (deterministic model), the static
contract
`database/tests/hgs-self-awareness-measurement-model-v1.test.mjs`, the
live verifier `database/verify-migration-0046.mjs`
(`npm run verify:hgs-self-awareness:integration`, wired in CI after the
0045 Emotional Safety verifier and before the HIM Trend verifier), and
the updated structured-measurement preflight manifest (fourteen
calibrated metrics, `EXPECTED_UNCALIBRATED_COUNT=3`), where the
preflight continues to derive the calibrated inventory from the
application catalog and compares it to the manifest with both drift
directions fail-closed — no second hard-coded calibrated inventory
source exists. Historical verifiers freeze neither a global calibrated
count, nor a permanent requirement that `hgs.resilience`,
`hgs.purpose-alignment`, and `hgs.habit-strength` remain uncalibrated,
nor any migration-number ceiling: later HIM Expansion phases may
calibrate the remaining HGS metrics and add further migrations. The
verifier makes zero provider calls.
