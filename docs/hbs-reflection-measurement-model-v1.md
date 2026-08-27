# HBS Reflection Measurement Model v1

HIM Expansion & Human Intelligence Completion — metric 9/17, deliberately a
standalone task because its context/measurement semantics differ from the
seven-day target-bound HBS trio (Avoidance, Consistency, Initiative).
Migration `0042_hbs_reflection_measurement_model_v1.sql`; migrations
`0001`–`0041` are unchanged. After this task exactly nine structured metrics
are calibrated (five HSE plus the four HBS metrics) and eight remain
uncalibrated — a one-time migration-phase transition, never a permanent
historical-verifier ceiling.

## Construct boundary

`hbs.reflection@1` measures **context-bound deliberate reflective
engagement**: at the time of report, to what extent the user has
intentionally stepped back to examine one exact SITUATION or
CONVERSATION_SESSION — including what happened, their own actions or
assumptions, and possible alternative interpretations, learning, or
adjustment.

This measures the **reflective behavior/process, not whether the user
reached a correct insight**. It is a product/HIM behavioral construct, NOT a
clinical inference, and it must never mean or infer: a permanent personality
trait; intelligence, wisdom, analytical ability, or insight accuracy;
`hgs.self-awareness`; emotional intelligence or mindfulness; a global
introspection disposition; accountability, guilt, regret, or self-criticism;
overthinking, repetitive replay, worry, rumination, anxiety, or indecision;
a learning outcome or behavior change; Recommendation readiness; or
therapeutic progress or clinical functioning.

A user may reflect extensively and still reach a mistaken conclusion. A user
may have good self-awareness without having reflected much on this exact
context. Repetitive thinking is not automatically Reflection.

```text
Reflection != Rumination
Reflection != Self-awareness
Reflection != Insight accuracy
Reflection != Behavior change
```

**Direction is not valence.** A higher score means only more self-reported
deliberate reflective engagement with this exact context. It does not
automatically mean healthier, better, or wiser. No clinical terminology
enters user data or outputs, **no founder questionnaire is claimed or
required**, and **no external or clinical validation is claimed**.

## Measurement — not the seven-day HBS period model

Reflection v1 is **one exact context-bound at-report reflective-engagement
assessment**: how much deliberate reflection has occurred with respect to
this exact context by the time of report. It deliberately does NOT reuse the
seven-day window semantics of Avoidance, Consistency, or Initiative:

- no previous-seven-days window, no 14/30-day window, no caller-selected
  temporal window, and no frequency-across-opportunities calculation;
- `him_measurement_events.observation_window_start` /
  `observation_window_end` are **NULL** for every Reflection event (the
  durable 0040 window pair stays unused, exactly like HSE right-now
  events), and the calculation refuses any non-NULL window;
- the server-authoritative event/report time is the measurement time;
  client timestamps remain untrusted diagnostics;
- instrument
  `hbs.reflection.direct-context-bound-reflective-engagement-report@1`,
  source `DIRECT_STRUCTURED_USER_REPORT` only. No LLM/provider call,
  free-text classification, keyword heuristics, embeddings, Memory/Evidence
  inference, passive telemetry, or scoring from conversation text — and no
  automatic Reflection question is ever asked.

### Context authority (SITUATION / CONVERSATION_SESSION only)

- **SITUATION** binds to exactly one owned existing
  `him_measurement_targets` row with `context_kind='SITUATION'`. The server
  derives owner, context kind/ID, and the bounded display label from the
  stored artifact; the caller can never forge the label. The
  target-creation API is unchanged by this task.
- **CONVERSATION_SESSION** binds directly to exactly one owned real
  `conversation_sessions` row. Session observations keep
  `target_label = NULL`, `target_context_kind = NULL`, and
  `target_context_id = NULL` — no fake measurement target is ever created
  for a session.
- No GLOBAL, GOAL, DECISION, or RELATIONSHIP Reflection exists.

### Canonical prompt semantics

English semantic template (documentation/product semantics only — not
hard-coded UI): "Thinking about this situation or conversation, to what
extent have you deliberately stepped back to review what happened, consider
your own actions or assumptions, and think about what you might learn or do
differently?" Canonical founder-facing ar-EG example:
«وأنت بتفكر في الموقف أو المحادثة دي، لحد دلوقتي قد إيه وقفت مع نفسك بشكل
مقصود تراجع اللي حصل، وتبص على تصرفاتك أو افتراضاتك، وتفكر إيه اللي ممكن
تتعلمه أو تعمله بشكل مختلف؟»

## Scale and calculation

Scale `hbs.reflection.engagement-5.v1@1`, ORDINAL only (no interval/ratio
operations, no averages, percentages, thresholds, bands, healthy/unhealthy
readings, clinical cutoffs, normalization, or cross-user/cross-context
comparison):

```text
NOT_AT_ALL → 1   A_LITTLE → 2   SOMEWHAT → 3   QUITE_A_BIT → 4   A_GREAT_DEAL → 5
NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT → UNASSESSED (null)
NOT_SURE                             → UNASSESSED (null)
missing observation                  → UNASSESSED (null)
contradictory refs                   → UNASSESSED (null) / PRESENT_UNRESOLVED
```

`NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT` covers too-early or incomplete
contexts and a lack of meaningful reflective distance; it and `NOT_SURE` are
**unassessed, never zero** and never a low score. The calculation model
`hbs.reflection.direct-structured-context-bound-reflective-engagement@1`
(CALIBRATED, PRODUCTION, `QANDEEL_HIM_GOVERNANCE`, method
`DIRECT_STRUCTURED_CONTEXT_BOUND_REFLECTIVE_ENGAGEMENT_REPORT`) is
deterministic and rejects unsupported/mismatched contexts, forged SITUATION
target shapes, non-null session target fields, wrong
metric/version/instrument/scale/source identities, malformed responses,
smuggled temporal windows, and superseded observations. Metric confidence
stays `UNRESOLVED_METRIC_CONFIDENCE` (UNASSESSED/null).

## Independence

```text
Reflection != Avoidance
Reflection != Consistency
Reflection != Initiative
Reflection != Self-awareness
```

`hbs.reflection@1` has its own vocabulary, instrument, scale, model,
approval, bindings, RPC family, lock namespace, observations, results, and
snapshots. The model never inspects sibling HBS metrics, Self-awareness,
Memory, Evidence, or conversation text, and no inverse, composite, or
sibling-derived score exists. Independent combinations — high Reflection
with high Avoidance, low Reflection with high Initiative — remain freely
expressible, with verifier proof that cross-metric calculation is
structurally impossible in every direction.

## Authority, correction, and currentness

`create_hbs_reflection_measurement_v1` /
`correct_hbs_reflection_measurement_v1` /
`calculate_hbs_reflection_measurement_v1` follow the hardened HBS authority
pattern: authenticated owner only, exact owned-context checks on both
branches, immutable append-only history, advisory-lock
idempotency/concurrency safety in a Reflection-only lock namespace, and
trusted calculation provenance (a direct assessed snapshot without
calculation provenance remains blocked). A correction attaches to the SAME
measurement event, can never switch context, preserves the NULL event
window, supersedes the prior observation, and retires its calculated
result/current snapshot through the existing supersession ledger. Every
Reflection snapshot keeps `semantic_mapping_status='UNRESOLVED'`,
`semantic_type=NULL`, `temporal_window_start/end=NULL`, and
`confidence_state='UNASSESSED'` with a NULL reference; no new semantic type
(such as BEHAVIOR) is introduced and no STATE/TRAIT/CAPABILITY/PROGRESS
mapping is made. `him_current_structured_measurements` now also carries
Reflection so `HimRepository.getLatest()` in SITUATION/CONVERSATION_SESSION
can never surface a stale superseded value; the five HSE routes and the
three seven-day HBS routes are unchanged.

## Phase decisions

- **Temporal comparability / Trend v1: NOT ELIGIBLE.** Context-bound
  reflective engagement is not a five-HSE STATE point, has no canonical
  repeated interval, and the elapsed opportunity to reflect differs between
  observations; its semantic mapping also remains unresolved/null.
  `read_him_trend_source_v1` and `HimTrendService` reject `hbs.reflection`,
  with regression proof. No increasing/decreasing Reflection is ever
  inferred.
- **HIM Intelligence Snapshot v1 / Reasoning / FAST-DEEP: NOT ELIGIBLE.**
  Snapshot v1 is a five-HSE `semanticType='STATE'` contract; Reflection
  retains an unresolved NULL semantic mapping, so it enters neither
  `read_him_intelligence_snapshot_v1`, the snapshot slots/types, HIM
  Reasoning Consumption, FAST/DEEP projection, nor any prompt guidance —
  with regression proof. A future, separately versioned **HBS Runtime
  Consumption** contract will decide how the completed HBS family enters
  reasoning.

## Verification

`hbs-reflection.model.spec.ts` (deterministic model), the static contract
`database/tests/hbs-reflection-measurement-model-v1.test.mjs`, the live
verifier `database/verify-migration-0042.mjs`
(`npm run verify:hbs-reflection:integration`, wired in CI after the 0041
Consistency+Initiative verifier and before the HIM Trend verifier), and the
updated structured-measurement preflight manifest (nine calibrated metrics,
`EXPECTED_UNCALIBRATED_COUNT=8`), where the preflight now derives the
calibrated inventory from the application catalog and compares it to the
manifest — the manifest is the single current-state calibrated-inventory
source, with both drift directions fail-closed. Historical verifiers freeze
neither a global calibrated count nor any migration-number ceiling: later
HIM Expansion phases may calibrate further metrics and add migration 0043
and beyond.
