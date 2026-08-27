# HGS Resilience Measurement Model v1

HIM Expansion & Human Intelligence Completion — metric 15/17, the second
HGS metric, delivered in migration
`0047_hgs_resilience_measurement_model_v1.sql`; migrations
`0001`–`0046` are unchanged. After this task exactly fifteen structured
metrics are calibrated (five HSE, four HBS, four HRS,
`hgs.self-awareness`, and `hgs.resilience`) and two remain uncalibrated
(`hgs.purpose-alignment`, `hgs.habit-strength`) — a one-time
migration-phase transition, never a permanent historical-verifier
ceiling. **HGS measurement grants no runtime-consumption authority**:
HGS Runtime Consumption remains a later, separately reviewed contract.

## Construct boundary

`hgs.resilience@1` measures **target-bound current perceived adaptive
recovery/continuity under experienced challenge**: in one exact GOAL or
SITUATION where the user has actually faced meaningful difficulty,
setback, disruption, or sustained challenge, how well the user currently
judges they have been able to maintain or regain workable functioning
and adapt their approach enough to continue engaging with what matters
in that context.

The core object is **adaptive functioning after or during actual
challenge**, not hypothetical toughness. The construct allows both
maintaining workable functioning despite challenge and regaining
workable functioning after being disrupted. It does NOT require
"returning to exactly how things were before" — adaptation may involve
changing approach. Construct examples (NOT subscales, never averaged):
regaining workable footing after disruption; keeping or restoring
enough functioning to continue; adjusting approach when the old
approach no longer works; re-engaging after a setback; avoiding
remaining persistently derailed by the challenge.

Psychological resilience is commonly treated as a process/outcome of
adapting to meaningful difficulty or adversity — not simply a fixed
personality trait and not the absence of distress. QANDEEL v1 narrows
that broad concept into a safe measurable unit: one exact GOAL or
SITUATION; challenge actually experienced; current perceived adaptive
functioning/recovery in that context; direct structured self-report
only.

### What Resilience is NOT

It is NOT: absence of stress/distress; low `hse.stress`; emotional
numbness; stoicism; "being strong"; a toughness identity; optimism;
positive mood; `hse.motivation`; `hse.self-confidence`; HBS
Consistency; HBS Initiative; HBS Avoidance; Habit Strength;
persistence/grit; continuing rigidly at all costs; success of the GOAL;
achievement/performance; recovery speed; instant "bouncing back";
post-traumatic growth; clinical recovery; a trauma diagnosis/outcome;
HRS Repair; a global personality trait; or a prediction of how the user
will handle future adversity.

```text
Resilience != Low Stress
Resilience != Motivation
Resilience != Self-Confidence
Resilience != Consistency
Resilience != Habit Strength
Resilience != Grit / Persistence
Resilience != Goal Success
Resilience != HRS Repair
```

**High Resilience + high Stress must be possible** (the user remains
distressed by a difficult situation while still maintaining/regaining
workable functioning — Resilience is not the absence of distress), and
so must high Resilience + low Motivation, high Resilience + low
Self-Confidence, low Resilience + high Motivation, high Self-Awareness
+ low Resilience, low Self-Awareness + high Resilience, high
Consistency + low Resilience, and low Consistency + high Resilience.
The 0047 verifier proves Stress VERY_HIGH (5) coexisting with
Resilience VERY_HIGH (5) on the same user and the same owned SITUATION
target, Self-Awareness/Resilience independence in both directions, and
Motivation/Resilience independence in both directions on the same owned
GOAL targets. No database constraint or formula forces these metrics to
correlate.

**Direction is not distress, success, or virtue.** A higher score means
only greater self-reported current adaptive continuity/recovery in the
exact challenged context. It does NOT prove absence of pain/distress,
healthy coping in every respect, success of the goal, better character,
greater worth, future resilience, or clinical recovery. A lower score
means only that the user reports greater current disruption / less
adaptive recovery in that context — never pathology, weakness, failure,
or diagnosis. A 5 is not proof of health; a 1 is not proof of disorder.
No validated psychometric instrument, objective resilience, clinical
validation, trauma-recovery validation, or external validation is
claimed (`external_validation_claimed = false`), **no founder
questionnaire is claimed or required**, and no clinical terminology
enters user data or outputs.

## Measurement — one exact target-bound current at-report appraisal grounded in actual challenge

Resilience v1 is **one exact GOAL- or SITUATION-bound current at-report
appraisal based on actual challenge experienced in that target** —
never a seven-day frequency, a 30-day recovery period, a
time-to-recovery, a longitudinal growth trajectory, a before/after
delta, or a caller-selected window:

- the existing owned GOAL/SITUATION `him_measurement_targets` substrate
  (0013/0014) is reused unchanged: exactly one owned target row
  (`user_id = auth.uid()`, `context_kind IN (GOAL, SITUATION)`) created
  through the existing historical target RPCs, with the server-derived
  opaque label never interpreted semantically. No GLOBAL,
  CONVERSATION_SESSION, DECISION, or RELATIONSHIP context, no new target
  table/RPC, and no HGS-specific target substrate exists;
- `him_measurement_events.observation_window_start` /
  `observation_window_end` are **NULL** for every Resilience event, and
  the calculation refuses any non-NULL window; the current appraisal may
  refer to challenge experienced in the target, but the metric does not
  encode a retrospective period;
- the server-authoritative report time is the measurement time; client
  timestamps remain untrusted diagnostics;
- instrument
  `hgs.resilience.direct-target-bound-adaptive-recovery-report@1`,
  source `DIRECT_STRUCTURED_USER_REPORT` only. **No LLM, Memory,
  Evidence, or conversation analysis is permitted to infer that
  adversity occurred** — the user supplies the structured appraisal, and
  the v1 metric exists only from that explicit structured report. No
  provider call, sentiment/keyword analysis, automatic adversity
  detection, or passive telemetry exists.

### Canonical prompt semantics

English semantic template (documentation/product semantics only — no
UI/questionnaire/auto-question generation): "Thinking about this goal or
situation as it stands now, and about meaningful difficulties,
setbacks, or disruptions you have actually faced here, how well have
you been able to maintain or regain workable footing and adapt what you
do so you can keep functioning in a way that still serves what matters
in this context?" Canonical founder-facing ar-EG example:
«وأنت بتفكر في الهدف أو الموقف ده دلوقتي، وبناءً على الصعوبات أو
الانتكاسات أو التعطيل اللي حصل فعلًا فيه، لحد قد إيه قدرت تحافظ على
رجلك أو ترجع تقف تاني بشكل عملي، وتعدّل طريقتك لو محتاج، بحيث تقدر
تكمل تتعامل مع المهم في السياق ده؟»

The wording is deliberately grounded ("actually faced here") and
adaptation-framed (maintain or regain workable footing, adapt what you
do). It never asks "Are you strong?", "Are you over it?", or "Will you
cope in the future?".

## Scale, special responses, and calculation

Scale `hgs.resilience.adaptive-recovery-5.v1@1`, ORDINAL only (no
interval/ratio operations, zero, midpoint substitution, resilience
percentages, trait scores, recovery-time scores, "strong/weak person"
labels, clinical cutoffs, trauma-recovery thresholds,
healthy/unhealthy bands, cross-user or cross-target rankings, automatic
growth percentages, or "resilience improving/worsening" outputs):

```text
VERY_LOW → 1   LOW → 2   MODERATE → 3   HIGH → 4   VERY_HIGH → 5
NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE → UNASSESSED (null)
TOO_EARLY_TO_JUDGE_ADAPTATION        → UNASSESSED (null)
TOO_CHALLENGE_DEPENDENT_TO_RATE      → UNASSESSED (null)
NOT_SURE                             → UNASSESSED (null)
missing observation                  → UNASSESSED (null)
contradictory refs                   → UNASSESSED (null) / PRESENT_UNRESOLVED
```

- **No-adversity protection.** If the target has not yet involved
  meaningful difficulty, there is no valid basis to assess resilience:
  `NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE` is UNASSESSED/null. **No
  adversity is NOT "high resilience"** — and never zero, never a
  midpoint.
- **Too-early protection.** A meaningful setback may have happened
  while the user is still in the immediate disruption without enough
  basis to judge whether workable adaptation/recovery has occurred:
  `TOO_EARLY_TO_JUDGE_ADAPTATION` is UNASSESSED/null. **This is not low
  resilience by default.**
- **Challenge-dependence protection.** The user may adapt well to one
  kind of challenge in the target while remaining strongly derailed by
  another, such that one scalar would erase a material difference:
  `TOO_CHALLENGE_DEPENDENT_TO_RATE` is UNASSESSED/null. Challenge types
  are never averaged and v1 creates no resilience subdomains; a future
  version may introduce them separately. `NOT_SURE` is equally
  UNASSESSED/null.

The calculation model
`hgs.resilience.direct-structured-current-adaptive-recovery@1`
(CALIBRATED, PRODUCTION, `QANDEEL_HIM_GOVERNANCE`, method
`DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_ADAPTIVE_RECOVERY_REPORT`,
evidence contract
`FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1` — the exact
activated canonical target-bound evidence contract, reused rather than
reinvented) is deterministic and rejects non-GOAL/SITUATION contexts,
target/context mismatches, forged/untrimmed/oversized target labels,
wrong metric/version/instrument/scale/source identities, malformed and
sibling responses (including the Self-Awareness, Trust, Communication,
Repair, and Emotional Safety special codes), smuggled temporal windows,
and superseded observations. It consumes only its own `observation`
input, never interprets the target label, and never inspects HSE
Stress, Motivation, Self-Confidence, Self-Awareness, any HBS metric,
HRS Repair, future Purpose Alignment / Habit Strength, Memory,
Evidence, conversation text, or provider/LLM output. Metric confidence
stays `UNRESOLVED_METRIC_CONFIDENCE` (UNASSESSED/null).

## Semantic mapping

`hifOwner = HGS`, `semanticMappingStatus = UNRESOLVED`,
`semanticType = NULL` — deliberately preserved and remaining so. The
construct is NOT force-mapped to CAPABILITY, TRAIT, STATE, PROGRESS, or
READINESS, and no RESILIENCE or GROWTH semantic type is invented.

## Authority, correction, and currentness

The dedicated RPC family
(`create_hgs_resilience_measurement_v1` /
`correct_hgs_resilience_measurement_v1` /
`calculate_hgs_resilience_measurement_v1`) follows the hardened 0046
target-bound pattern: authenticated owner only, anon revoked, cross-user
fail closed, direct DML bypass blocked, server-derived measurement
identity/target UUID/context kind/label/provenance, server-authoritative
report time, untrusted client timestamps, immutable append-only
observations, corrections that supersede on the SAME measurement event
and the SAME exact target (**a correction changes the response, never
the target**), NULL event windows preserved through correction,
idempotent calculation for the exact observation + canonical binding,
race-safe correction/calculation in the dedicated
`hgs.resilience.observation:` advisory-lock namespace, superseded
observations that can never be recalculated or surface as current, and
the direct assessed-snapshot bypass remains blocked. The trusted
snapshot carries metric `hgs.resilience`, the exact GOAL or SITUATION
context with the exact target UUID, UNRESOLVED/NULL semantic mapping,
UNASSESSED/null confidence, NULL temporal window, canonical provenance,
and **no recovery-time, trait, growth, or wellbeing field**.
`him_current_structured_measurements` and `HimRepository.getLatest()`
now also route `hgs.resilience` + GOAL and `hgs.resilience` + SITUATION
through the supersession-aware current structured read, while
unsupported contexts and the two remaining uncalibrated HGS metrics
stay on the raw snapshot path — Purpose Alignment and Habit Strength
are not routed.

## Phase decisions

- **Temporal comparability / Trend v1: NOT ELIGIBLE.** Trend v1 remains
  exactly the five-HSE contract: the semantic mapping is
  unresolved/null, no HGS temporal-comparability contract exists, this
  v1 score is a current appraisal grounded in actual challenge (not a
  point-sequence growth trajectory), challenge identity/materiality may
  differ across assessments, and no approved cadence or
  minimum-comparability policy exists. No "resilience
  improving/worsening" language is ever created.
  `read_him_trend_source_v1` and `HimTrendService` reject
  `hgs.resilience`, with regression proof. A future HGS
  temporal-comparability contract may revisit this.
- **HIM Intelligence Snapshot v1 / Reasoning / FAST-DEEP /
  Recommendation: NOT ELIGIBLE.** Snapshot v1 remains exactly the five
  HSE STATE metrics, with regression proof that the GOAL and SITUATION
  slot sets stay exact and carry no Resilience. Resilience enters no
  HIM Reasoning Consumption, FAST/DEEP projection, prompt guidance,
  Recommendation bridge, or proactive behavior. **HGS Measurement &
  Calibration does not authorize HGS Runtime Consumption** — that is a
  later, separately versioned and deliberately reviewed contract.

## Verification

`hgs-resilience.model.spec.ts` (deterministic model), the static
contract
`database/tests/hgs-resilience-measurement-model-v1.test.mjs`, the live
verifier `database/verify-migration-0047.mjs`
(`npm run verify:hgs-resilience:integration`, wired in CI after the
0046 Self-Awareness verifier and before the HIM Trend verifier), and
the updated structured-measurement preflight manifest (fifteen
calibrated metrics, `EXPECTED_UNCALIBRATED_COUNT=2`), where the
preflight continues to derive the calibrated inventory from the
application catalog and compares it to the manifest with both drift
directions fail-closed — no second hard-coded calibrated inventory
source exists. Historical verifiers freeze neither a global calibrated
count, nor a permanent requirement that `hgs.purpose-alignment` and
`hgs.habit-strength` remain uncalibrated, nor any migration-number
ceiling: later HIM Expansion phases may calibrate the remaining HGS
metrics and add further migrations. **Forward-compatibility guard:**
verifier 0047 never asserts that future sibling HGS authority
(Purpose Alignment functions, Habit Strength functions, later
Resilience v2/helpers, or later HGS Runtime Consumption functions) is
absent from the live latest schema — that 0047 itself introduced no
sibling HGS authority is proven statically against the frozen 0047
migration text only, and a static regression guard rejects any 0047
verifier that reintroduces a future-sibling live-schema absence
ceiling. The verifier makes zero provider calls.
