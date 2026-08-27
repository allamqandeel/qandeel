# HGS Habit Strength Measurement Model v1

HIM Expansion & Human Intelligence Completion — metric 17/17, the fourth
and final HGS metric and the final metric-calibration task of the
canonical 17-metric HIM v1 inventory. Migration
`0049_hgs_habit_strength_measurement_model_v1.sql` activates
`hgs.habit-strength@1`. After 0049 all seventeen canonical v1 metrics
are calibrated and zero remain uncalibrated — a one-time
migration-phase transition, never a historical-verifier ceiling.
Measurement inventory completion != Runtime Consumption approval, and
formal Measurement Foundation closure remains pending the separately
planned 17-metric system-wide architecture audit.

## Construct — target-bound current cue-linked automaticity

`hgs.habit-strength@1` measures **target-bound current perceived
cue-linked automaticity of a specific recurring action/routine**: in
one exact GOAL or SITUATION, based on sufficient repeated experience
with the relevant recurring action, how strongly the user currently
experiences starting or carrying out that action as tending to happen
automatically when its familiar cue or circumstances occur, with less
need for a fresh deliberate decision at the moment of action.

The core object is **current perceived cue → action automaticity**.
Not frequency. Not motivation. Not discipline. Not persistence. The
construct is deliberately narrower than broad everyday uses of
"habit."

The v1 construct concerns the user's current perceived experience
that, when familiar cues/circumstances arise, the recurring action:

- tends to start with reduced need for a fresh conscious decision;
- can feel like the default response in that context;
- may begin or unfold with relatively automatic initiation;
- is linked to recurring contextual cues through repeated experience.

These are construct examples only — NOT subscales, and they are never
averaged.

## Research-informed principle — no external-validation claim

Habit research commonly distinguishes habitual automaticity triggered
by recurring context/cues from merely repeating a behavior often.
QANDEEL v1 adopts only this narrow principle: Habit Strength is about
how automatic a repeated response has become in its familiar context,
not simply how often it happened. QANDEEL v1 does NOT adopt or claim
the Self-Report Habit Index, the Self-Report Behavioral Automaticity
Index, any published psychometric scoring formula, objective
behavioral automaticity, or clinical validation:

```text
external_validation_claimed = false
```

## Habit Strength is NOT

Consistency; behavior frequency; seven-day follow-through; Initiative;
willingness to start; Motivation; Purpose Alignment; Self-Awareness;
Resilience; Avoidance; discipline; willpower; grit; persistence;
commitment; routine scheduling; reminder use; environmental
convenience; skill/proficiency; speed; ease because the action is
objectively easy; identity ("this is who I am");
preference/enjoyment; craving; compulsion; addiction; inability to
stop; pathology; goal success/progress; a global personality trait.

```text
Habit Strength != Consistency
Habit Strength != Frequency
Habit Strength != Initiative
Habit Strength != Motivation
Habit Strength != Purpose Alignment
Habit Strength != Resilience
Habit Strength != Grit / Discipline
Habit Strength != Compulsion / Addiction
```

## The mandatory Consistency boundary

This is the central sibling boundary. `hbs.consistency@1` measures
repeated-opportunity follow-through frequency over a fixed seven-day
retrospective window; `hgs.habit-strength@1` measures current
perceived cue-linked automaticity of the recurring action, based on
sufficient repetition history, with a NULL temporal window.

```text
Consistency   = "How consistently did I do it?"
Habit Strength = "How automatic has doing it become when the cue/context appears?"
```

The system permits — and the 0049 verifier proves on real owned
targets in both directions:

- **High Consistency + Low Habit Strength** (`ALMOST_ALWAYS` → 5 with
  `VERY_LOW` → 1): the user reliably follows through, but only through
  deliberate effort/decision each time.
- **Low Consistency + High Habit Strength** (`NEVER` → 1 with
  `VERY_HIGH` → 5): a well-established automatic response may
  currently show low seven-day follow-through because the
  cue/opportunity did not occur normally, the environment was
  disrupted, or other constraints interfered.

Neither metric is derived from the other, no minimum Consistency score
is required to assess Habit Strength, Habit Strength never reads
Consistency observations, no Consistency frequency code is reused as a
Habit Strength response, and no frequency → automaticity conversion
exists.

## Other mandatory independence

High Motivation + low Habit Strength (wants the behavior, still
deliberately initiates it each time) and low Motivation + high Habit
Strength (the behavior runs automatically despite weak current
motivation) both stay expressible, as do high Initiative + low Habit
Strength, low Initiative + high Habit Strength, high Purpose Alignment
+ low Habit Strength, low Purpose Alignment + high Habit Strength,
high Self-Awareness + low Habit Strength, and high Resilience + low
Habit Strength. No DB formula or model constraint forces correlation,
cross-calculation and cross-correction fail in both directions for
every key sibling, and no HGS composite, inverse, or derived score
exists.

## Direction is not virtue, success, or loss of control

Higher Habit Strength means only greater self-reported current
cue-linked automaticity for the specific recurring action in this
exact target. It does NOT prove the behavior is beneficial, aligned
with values, healthy, should continue, that the goal will succeed,
that the user lacks control, or that addiction/compulsion exists.
Lower Habit Strength means lower perceived automaticity — never weak
character, poor discipline, or failure. The metric emits no
compulsion, addiction, loss-of-control, craving, dependence, disorder,
healthy/unhealthy-habit, safe/unsafe, or continue/stop output of any
kind. Safety/Recommendation authority remains separate and unchanged.

## Measurement — one exact target-bound current at-report appraisal

- **Contexts:** GOAL and SITUATION only, on the existing owned
  `him_measurement_targets` substrate from 0013/0014 — no GLOBAL,
  DECISION, RELATIONSHIP, or CONVERSATION_SESSION authority, no
  HGS-specific or habit-specific target table, and no new target
  creator. The server derives owner, target UUID, context kind, label,
  provenance, and report time; the target label is an opaque binding
  artifact that is never semantically interpreted.
- **Basis:** sufficient repeated experience with the recurring action.
  This is a basis requirement, never a scored temporal window — the
  metric is not hypothetical ("if I did this often enough…"), and no
  component may infer repetition history from Consistency, event
  counts, Memory, conversation, telemetry, or provider output.
- **Temporal contract:** `observation_window_start = NULL`,
  `observation_window_end = NULL`. Not a seven-day frequency, 30-day
  habit score, streak, repetition count, days-to-habit,
  time-to-automaticity, habit-formation curve, or caller-selected
  window.
- **Instrument:**
  `hgs.habit-strength.direct-target-bound-cue-linked-automaticity-report@1`,
  source `DIRECT_STRUCTURED_USER_REPORT`.
- **Scale:** `hgs.habit-strength.automaticity-5.v1@1`, ORDINAL 1–5. A
  5 is perceived automaticity, not "good habit"; a 1 is not poor
  character. No habit percentage, automaticity percentage, streak
  score, behavior-success score, discipline/willpower score,
  compulsivity band, healthy/unhealthy classification, cross-user or
  cross-target ranking, growth percentage, or improving/worsening
  output exists.
- **Model:**
  `hgs.habit-strength.direct-structured-current-cue-linked-automaticity@1`,
  method
  `DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_CUE_LINKED_AUTOMATICITY_REPORT`,
  input contract
  `DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_CUE_LINKED_AUTOMATICITY_REPORT_V1`,
  evidence contract
  `FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1`.

## Canonical prompt semantics (documentation only — no UI generation)

English semantic template:

> "Thinking about the repeated action or routine you mean in this goal
> or situation, and only if you have actually repeated it enough to
> judge: when its familiar cue or circumstances show up, how much does
> starting or doing it now tend to happen automatically, without
> needing a fresh deliberate decision each time?"

Founder-facing ar-EG semantic example:

> وأنت بتفكر في السلوك أو الروتين المتكرر اللي تقصده في الهدف أو الموقف ده — ولو كررته فعلًا بما يكفي إنك تحكم عليه — لما الإشارة أو الظروف المعتادة بتاعته تظهر، لحد قد إيه البدء فيه أو عمله بقى بيحصل تلقائيًا نسبيًا، من غير ما تحتاج كل مرة تاخد قرار جديد ومتعمد علشان تبدأ؟

## Response vocabulary and special-state rationale

```text
VERY_LOW  -> 1
LOW       -> 2
MODERATE  -> 3
HIGH      -> 4
VERY_HIGH -> 5

INSUFFICIENT_REPETITION_HISTORY_TO_JUDGE -> UNASSESSED / NULL
NO_SINGLE_RECURRING_PATTERN_TO_RATE      -> UNASSESSED / NULL
TOO_CUE_DEPENDENT_TO_RATE                -> UNASSESSED / NULL
NOT_SURE                                 -> UNASSESSED / NULL
```

A special is never scored as zero or a midpoint.

- `INSUFFICIENT_REPETITION_HISTORY_TO_JUDGE`: the behavior/routine is
  too new or insufficiently repeated for the user to judge current
  automaticity. Insufficient basis — NOT low Habit Strength.
- `NO_SINGLE_RECURRING_PATTERN_TO_RATE`: the target does not currently
  correspond to one sufficiently clear recurring action/routine for a
  meaningful single appraisal (a broad GOAL with several different
  behaviors, a SITUATION with multiple unrelated recurring responses,
  or no established recurring action to name). The calculation never
  infers or chooses the behavior from the target label, conversation,
  Memory, Evidence, keywords, or provider output — no behavior
  classifier, habit graph, behavior ontology, or behavior entity
  exists in v1.
- `TOO_CUE_DEPENDENT_TO_RATE`: the action feels highly automatic under
  one familiar cue/context but strongly deliberate under another, such
  that one scalar would erase a material cue-specific difference. Cue
  conditions are never averaged and no cue subdomain exists in v1.

## Semantic mapping

Foundation identity preserved exactly: `hifOwner = HGS`,
`semanticMappingStatus = UNRESOLVED`, `semanticType = NULL` on the
definition and on every produced snapshot. No forced
TRAIT/CAPABILITY/STATE/PROGRESS/READINESS mapping and no invented
HABIT/AUTOMATICITY/ROUTINE semantic type.

## Authority, correction, and currentness

The three dedicated RPCs
(`create_hgs_habit_strength_measurement_v1`,
`correct_hgs_habit_strength_measurement_v1`,
`calculate_hgs_habit_strength_measurement_v1`) follow the hardened
target-bound pattern from 0046–0048: authenticated owner only,
existing owned GOAL/SITUATION target only, server-derived
target/context/label/provenance and report time, untrusted client
timestamp, NULL event window, append-only correction that preserves
the same event and exact target and changes the response only, the
dedicated `hgs.habit-strength.observation:` advisory-lock namespace,
idempotent calculation, race-safe correction/calculation, superseded
observations that can neither recalculate nor be corrected again,
supersession-safe current reads, and a blocked direct
assessed-snapshot bypass. `him_current_structured_measurements` and
`HimRepository.getLatest()` now route `hgs.habit-strength` for GOAL
and SITUATION — completing current structured routing for all 17
canonical calibrated metrics — while unsupported contexts stay on the
raw snapshot path and no previous route is broadened.

## Trend / Snapshot / Reasoning non-consumption

```text
hgs.habit-strength@1
Trend v1 = NOT ELIGIBLE
HIM Intelligence Snapshot v1 = NOT ELIGIBLE
```

Semantic mapping remains UNRESOLVED/null, Trend v1 remains five-HSE
only, no HGS temporal-comparability contract exists, the
repeated-history basis is not a comparable measurement window, cue
conditions may materially change, special states can make one
appraisal UNASSESSED, and no approved cadence/comparability threshold
exists. No habit strengthening/weakening trend, formation curve,
days-to-habit, or improving/worsening automaticity reading exists.
Habit Strength is not exposed to Snapshot, Reasoning, FAST/DEEP,
Recommendation, prompt guidance, or proactive behavior. Completing
17/17 measurement calibration does NOT authorize runtime consumption —
a later separately reviewed HGS/HIM Runtime Consumption contract
decides that.

## Historical-verifier forward compatibility

Migration 0049 asserts the exact one-time 17/0 transition at execution
time only. The historical verifier `verify-migration-0049.mjs` proves
the durable guarantees (all canonical v1 identities exist and hold
their approved calibration contracts, Habit Strength's exact v1
artifacts, the prior sixteen unchanged) without freezing the global
calibrated/uncalibrated count, without any next-migration-number
ceiling, and without any live-schema absence check for future
authority — owned-function inspection queries exactly the three
0049-owned functions by exact name, and the static contract test
guards against reintroducing a future-authority live-schema ceiling.
