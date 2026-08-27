# HGS Purpose Alignment Measurement Model v1

HIM Expansion & Human Intelligence Completion — metric 16/17, the third
HGS metric, delivered in migration
`0048_hgs_purpose_alignment_measurement_model_v1.sql`; migrations
`0001`–`0047` are unchanged. After this task exactly sixteen structured
metrics are calibrated (five HSE, four HBS, four HRS,
`hgs.self-awareness`, `hgs.resilience`, and `hgs.purpose-alignment`) and
one remains uncalibrated (`hgs.habit-strength`) — a one-time
migration-phase transition, never a permanent historical-verifier
ceiling. **HGS measurement grants no runtime-consumption authority**:
HGS Runtime Consumption remains a later, separately reviewed contract.

## Construct boundary

`hgs.purpose-alignment@1` measures **goal-bound current perceived
congruence with personally meaningful direction**: for one exact GOAL,
how well pursuing that goal currently fits with what the user genuinely
regards as important, personally meaningful, and worth standing for or
moving toward — including their endorsed values, priorities, and sense
of desired life direction — rather than merely whether the goal is
urgent, rewarding, expected, socially approved, or easy to pursue.

The core object is **person ↔ goal congruence of meaning/direction**.
It is not "how motivated am I?", it is not "will I succeed?", and it is
not "is this objectively a good goal?". Construct examples (NOT
subscales, never averaged): the goal expresses or serves something the
user personally values; it fits genuinely endorsed priorities; it fits
the direction they want their life/development to move toward; it feels
meaningfully "theirs" even if pursuit is difficult; it is compatible
enough with what matters to them to be described by one overall
alignment rating.

Goal self-concordance research distinguishes whether a goal fits the
person's developing interests and core values from whether the person
merely exerts effort, feels capable, or ultimately achieves the goal.
QANDEEL v1 uses only that narrow conceptual principle — a personally
meaningful goal can be more or less congruent with what the person
genuinely values and wants their life/direction to express — and does
NOT adopt a published psychometric instrument or a weighted
autonomous-motivation formula. Purpose Alignment is never computed from
intrinsic/identified/introjected/external motive subscales, Motivation,
Self-Awareness, goal effort, progress, goal attainment, or LLM
judgment.

### What Purpose Alignment is NOT

It is NOT: `hse.motivation`; desire intensity, excitement, or energy;
effort, engagement, commitment, or persistence/grit; HBS Consistency or
Initiative; Habit Strength; goal progress or attainment; feasibility or
likelihood of success; self-efficacy / Self-Confidence; Self-Awareness;
Resilience; goal importance alone; urgency or external consequences;
social/family approval; status/prestige/financial reward; moral
correctness; ethical, legal, or safety approval; GLOBAL life purpose;
purpose clarity; identity certainty; or a clinical/diagnostic
construct.

```text
Purpose Alignment != Motivation
Purpose Alignment != Self-Awareness
Purpose Alignment != Resilience
Purpose Alignment != Consistency
Purpose Alignment != Habit Strength
Purpose Alignment != Goal Importance
Purpose Alignment != Goal Success
Purpose Alignment != Moral / Safety Approval
```

**External pressure is not automatically misalignment.** A goal may
carry external expectations and still be genuinely endorsed — the
system never implements `external pressure => low Purpose Alignment`.
Likewise `intrinsic enjoyment => automatically high Purpose Alignment`
is not approved: the metric asks directly for perceived congruence with
personally meaningful values/priorities/direction and never infers
alignment from motive categories.

**High Motivation + low Purpose Alignment must be possible** (strongly
driven toward a goal that no longer fits what matters), and so must low
Motivation + high Purpose Alignment (deeply "mine", currently
depleted), high Self-Awareness + low Purpose Alignment, low
Self-Awareness + high Purpose Alignment, high Resilience + low Purpose
Alignment, low Resilience + high Purpose Alignment, high Consistency +
low Purpose Alignment, and low Consistency + high Purpose Alignment.
The 0048 verifier proves Motivation VERY_HIGH (5) coexisting with
Purpose Alignment VERY_LOW (1) and Motivation VERY_LOW (1) with Purpose
Alignment VERY_HIGH (5) on the same user and the same owned GOAL
targets, Self-Awareness/Purpose-Alignment independence in both
directions, Resilience VERY_HIGH (5) with Purpose Alignment VERY_LOW
(1), and Consistency ALMOST_ALWAYS (5) with Purpose Alignment VERY_LOW
(1). No database constraint or formula forces these metrics to
correlate.

**Direction is not goodness, safety, or success.** A higher score means
only greater self-reported current congruence between this exact GOAL
and the user's personally meaningful values/priorities/direction. It
does NOT prove the goal is objectively wise, morally good, safe, legal,
recommended, likely to succeed, or wellbeing-enhancing. A lower score
does NOT prove the goal must be abandoned. Existing Safety and
Recommendation authority remains separate and unchanged, and this
metric never produces a moral, safety, legal, or continue/abandon-goal
verdict. A 5 is perceived congruence, not objective correctness. No
validated psychometric instrument, clinical validation, or external
validation is claimed (`external_validation_claimed = false`), **no
founder questionnaire is claimed or required**, and no clinical
terminology enters user data or outputs.

## Measurement — one exact goal-bound current at-report appraisal

Purpose Alignment v1 is **one exact GOAL-bound current at-report
perceived congruence appraisal** — never a seven-day measure, a
retrospective period, a growth trajectory, a goal-progress delta, a
before/after values analysis, or a caller-selected temporal window:

- the existing owned GOAL `him_measurement_targets` substrate (0013) is
  reused unchanged: exactly one owned target row
  (`user_id = auth.uid()`, `context_kind = GOAL`) created through the
  existing historical target RPCs, with the server-derived opaque label
  never interpreted semantically. No SITUATION, DECISION, RELATIONSHIP,
  CONVERSATION_SESSION, or GLOBAL context, no new target table/RPC, no
  Purpose-Alignment-specific target creator, and no HGS-specific target
  substrate exists;
- `him_measurement_events.observation_window_start` /
  `observation_window_end` are **NULL** for every Purpose Alignment
  event, and the calculation refuses any non-NULL window;
- the server-authoritative report time is the measurement time; client
  timestamps remain untrusted diagnostics;
- instrument
  `hgs.purpose-alignment.direct-goal-bound-purpose-congruence-report@1`,
  source `DIRECT_STRUCTURED_USER_REPORT` only. **No LLM, Memory,
  Evidence, or conversation analysis is permitted to infer alignment**
  — the user supplies the structured appraisal, and the v1 metric
  exists only from that explicit structured report. No provider call,
  sentiment/keyword analysis, automatic alignment detection, or passive
  telemetry exists.

### Canonical prompt semantics

English semantic template (documentation/product semantics only — no
UI/questionnaire/auto-question generation): "Thinking about this goal
as it stands now, how well does pursuing it fit with what you genuinely
feel is important and meaningful to you — your own values, priorities,
and the direction you want your life or development to move in — rather
than simply whether the goal is urgent, rewarding, expected, or easy?"
Canonical founder-facing ar-EG example:
«وأنت بتفكر في الهدف ده دلوقتي، لحد قد إيه السعي وراه متوافق فعلًا مع
الحاجات اللي إنت شايفها مهمة وليها معنى بالنسبة لك — قيمك وأولوياتك
والاتجاه اللي إنت عايز حياتك أو تطورك يمشي فيه — بعيدًا عن مجرد إن
الهدف مستعجل أو فيه مكافأة أو متوقع منك أو سهل؟»

The wording asks directly for congruence with personally meaningful
values/priorities/direction. It never asks "Is this a good goal?",
"Should you continue?", or "Are you motivated?".

## Scale, special responses, and calculation

Scale `hgs.purpose-alignment.congruence-5.v1@1`, ORDINAL only (no
interval/ratio operations, zero, midpoint substitution, purpose
percentages, global life-purpose scores, values-fit percentages, moral
scores, goal-quality scores, recommendation thresholds,
safe/unsafe-goal thresholds, cross-user or cross-goal rankings,
weighted value averages, autonomous-motivation formulas, growth
percentages, or "alignment improving/worsening" outputs):

```text
VERY_LOW → 1   LOW → 2   MODERATE → 3   HIGH → 4   VERY_HIGH → 5
TOO_VALUE_CONFLICTED_TO_RATE                   → UNASSESSED (null)
INSUFFICIENT_PERSONAL_DIRECTION_BASIS_TO_JUDGE → UNASSESSED (null)
NOT_SURE                                       → UNASSESSED (null)
missing observation                            → UNASSESSED (null)
contradictory refs                  → UNASSESSED (null) / PRESENT_UNRESOLVED
```

- **Value-conflict protection.** One goal may strongly serve one
  important value while materially conflicting with another. If one
  scalar would erase a material conflict,
  `TOO_VALUE_CONFLICTED_TO_RATE` is UNASSESSED/null. Values are never
  averaged, no value weights or hierarchy are created, and v1 creates
  no value subdomains — never zero, never a midpoint.
- **Insufficient-direction-basis protection.** The user may not
  currently have enough basis to judge alignment because the relevant
  values/priorities/direction are not clear enough:
  `INSUFFICIENT_PERSONAL_DIRECTION_BASIS_TO_JUDGE` is UNASSESSED/null.
  **This is NOT automatically low Purpose Alignment**, and it creates
  no dependency on Self-Awareness — the user directly reports whether
  there is enough basis for this appraisal. `NOT_SURE` is equally
  UNASSESSED/null.

The calculation model
`hgs.purpose-alignment.direct-structured-current-purpose-congruence@1`
(CALIBRATED, PRODUCTION, `QANDEEL_HIM_GOVERNANCE`, method
`DIRECT_STRUCTURED_GOAL_BOUND_CURRENT_PURPOSE_CONGRUENCE_REPORT`,
evidence contract
`FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1` — the exact
activated canonical target-bound evidence contract, reused rather than
reinvented) is deterministic and rejects non-GOAL contexts,
target/context mismatches, forged/untrimmed/oversized target labels,
wrong metric/version/instrument/scale/source identities, malformed and
sibling responses (including the Self-Awareness and Resilience special
codes), smuggled temporal windows, and superseded observations. It
consumes only its own `observation` input, never interprets the target
label, and never inspects Motivation, Self-Awareness, Resilience,
Consistency, Initiative, future Habit Strength, Memory, Evidence,
conversation text, or provider/LLM output. Metric confidence stays
`UNRESOLVED_METRIC_CONFIDENCE` (UNASSESSED/null).

## Semantic mapping — CRITICAL

The Purpose Alignment Foundation mapping is **ALREADY RESOLVED** and is
preserved exactly: `hifOwner = HGS`,
`semanticMappingStatus = RESOLVED`, `semanticType = ALIGNMENT`. This
deliberately differs from Self-Awareness and Resilience (both
UNRESOLVED/null). The identity is never downgraded to UNRESOLVED/null,
no PURPOSE or VALUES semantic type is invented, and no
STATE/TRAIT/CAPABILITY/READINESS/PROGRESS remapping is made. Every
produced snapshot also carries `semantic_mapping_status = RESOLVED`
and `semantic_type = ALIGNMENT`, with regression proof.

## Authority, correction, and currentness

The dedicated RPC family
(`create_hgs_purpose_alignment_measurement_v1` /
`correct_hgs_purpose_alignment_measurement_v1` /
`calculate_hgs_purpose_alignment_measurement_v1`) follows the hardened
target-bound pattern: authenticated owner only, anon revoked,
cross-user fail closed, direct DML bypass blocked, server-derived
measurement identity/target UUID/context kind/label/provenance,
server-authoritative report time, untrusted client timestamps,
immutable append-only observations, corrections that supersede on the
SAME measurement event and the SAME exact GOAL (**a correction changes
the response, never the GOAL**), NULL event windows preserved through
correction, idempotent calculation for the exact observation +
canonical binding, race-safe correction/calculation in the dedicated
`hgs.purpose-alignment.observation:` advisory-lock namespace,
superseded observations that can never be recalculated or surface as
current, and the direct assessed-snapshot bypass remains blocked. The
trusted snapshot carries metric `hgs.purpose-alignment`, the exact GOAL
context with the exact target UUID, RESOLVED/ALIGNMENT semantic
identity, UNASSESSED/null confidence, NULL temporal window, canonical
provenance, and **no moral, safety, recommendation, or
continue/abandon field**. `him_current_structured_measurements` and
`HimRepository.getLatest()` now also route `hgs.purpose-alignment` +
GOAL through the supersession-aware current structured read, while
unsupported contexts and the one remaining uncalibrated HGS metric
stay on the raw snapshot path — Habit Strength is not routed.

## Phase decisions

- **Temporal comparability / Trend v1: NOT ELIGIBLE.** Even though the
  semantic mapping is RESOLVED/ALIGNMENT, Trend v1 remains exactly the
  five-HSE contract: no HGS temporal-comparability contract exists,
  and no "increasing/decreasing alignment", values-drift, or
  purpose-growth trajectory reading is ever created.
  `read_him_trend_source_v1` and `HimTrendService` reject
  `hgs.purpose-alignment`, with regression proof. A future HGS
  temporal-comparability contract may revisit this.
- **HIM Intelligence Snapshot v1 / Reasoning / FAST-DEEP /
  Recommendation: NOT ELIGIBLE.** `semanticType = ALIGNMENT` does not
  create eligibility: Snapshot v1 is the frozen five-HSE **STATE**
  contract, with regression proof that the GOAL slot set stays exact
  and carries no Purpose Alignment. Purpose Alignment enters no HIM
  Reasoning Consumption, FAST/DEEP projection, prompt guidance,
  Recommendation bridge, or proactive behavior. **HGS Measurement &
  Calibration does not authorize HGS Runtime Consumption** — that is a
  later, separately versioned and deliberately reviewed contract.

## Verification

`hgs-purpose-alignment.model.spec.ts` (deterministic model), the static
contract
`database/tests/hgs-purpose-alignment-measurement-model-v1.test.mjs`,
the live verifier `database/verify-migration-0048.mjs`
(`npm run verify:hgs-purpose-alignment:integration`, wired in CI after
the 0047 Resilience verifier and before the HIM Trend verifier), and
the updated structured-measurement preflight manifest (sixteen
calibrated metrics, `EXPECTED_UNCALIBRATED_COUNT=1`), where the
preflight continues to derive the calibrated inventory from the
application catalog and compares it to the manifest with both drift
directions fail-closed — no second hard-coded calibrated inventory
source exists. Historical verifiers freeze neither a global calibrated
count, nor a permanent requirement that `hgs.habit-strength` remain
uncalibrated, nor any migration-number ceiling: a later HIM Expansion
phase may calibrate Habit Strength and add further migrations.
**Forward-compatibility guard:** verifier 0048 never asserts that
future sibling HGS authority (Habit Strength functions, later Purpose
Alignment v2/helpers, or later HGS Runtime Consumption functions) is
absent from the live latest schema — historical verifiers run against
the fully migrated latest schema, so that 0048 itself introduced no
sibling HGS authority is proven statically against the frozen 0048
migration text only, and a static regression guard rejects any 0048
verifier that reintroduces a `to_regprocedure`-style (or equivalent)
future-authority live-schema absence ceiling or names a future Habit
Strength function as required-to-be-absent. The verifier makes zero
provider calls.
