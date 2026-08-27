# HRS Emotional Safety Measurement Model v1

HIM Expansion & Human Intelligence Completion — metric 13/17, the fourth
and final HRS metric, delivered in migration
`0045_hrs_emotional_safety_measurement_model_v1.sql`; migrations
`0001`–`0044` are unchanged. After this task exactly thirteen structured
metrics are calibrated (five HSE, four HBS, and all four HRS metrics) and
four remain uncalibrated (the four HGS metrics) — a one-time
migration-phase transition, never a permanent historical-verifier ceiling.
**The HRS measurement family is COMPLETE.** Measurement completion grants
no runtime-consumption authority: HRS Runtime Consumption remains a later,
separately reviewed contract.

## Construct boundary

`hrs.emotional-safety@1` measures **relationship-bound current perceived
safety for emotional openness**: based on what the user has actually
experienced in one exact relationship, how safe it currently feels to
reveal emotionally vulnerable inner experience — such as a feeling, need,
insecurity, mistake, limit, or disagreement — without reasonably expecting
that the vulnerability itself will be met with humiliating, contemptuous,
punitive, retaliatory, or weaponizing interpersonal consequences.

The measured object is the user's **current perceived interpersonal safety
of emotional exposure**. It includes the user's experienced sense that
vulnerable/personal disclosure can occur without the disclosure itself
predictably becoming interpersonal ammunition — without humiliation,
ridicule, contempt, punitive response, retaliation, or deliberate
weaponization of the vulnerability. Those are construct examples, NOT an
abuse checklist and NOT subscales.

### Subjective vs objective safety

The construct is **subjective and relationship-specific**. It is the
user's current felt appraisal, never an objective classification of the
other person or the relationship. It is a product/HIM relational
construct, NOT a clinical inference, and it must never mean or infer:
physical, sexual, financial, or medical safety; imminent-danger
assessment; an abuse, coercive-control, harassment, manipulation,
gaslighting, or dangerousness classifier; objective partner safety;
relationship health or satisfaction; love or closeness; attachment style
or security; global or social anxiety; conflict frequency or absence of
conflict; politeness or kindness; "never being challenged"; lack of
accountability; `hrs.relationship-trust`, `hrs.communication`, or
`hrs.repair`; stay/leave authority; or a clinical/diagnostic construct.

```text
Emotional Safety != Trust != Communication != Repair
Emotional Safety != objective/physical/abuse safety
```

**Direction is not a verdict.** A higher score means only more
self-reported emotional-openness safety in this exact relationship. It
does NOT prove the relationship or person is objectively safe or healthy.
A lower score does NOT prove abuse or danger. **No recommendation, safety
decision, or disclosure advice may be derived from this score.** No
clinical terminology enters user data or outputs, **no founder
questionnaire is claimed or required**, and **no external or clinical
validation is claimed**.

### Safety Runtime separation — hard boundary

The word "Safety" in the metric name gives this metric **no system Safety
authority**. The existing Safety Runtime remains separate and
independently authoritative if actual conversation content raises a
safety issue. This implementation never calls, bypasses, suppresses, or
modifies Safety Runtime; never classifies safe/unsafe or
abuse/coercion/manipulation/gaslighting/danger; never infers imminent
risk; never produces stay/leave logic; never recommends more disclosure;
and never maps the score to any safety verdict. No executable SQL or
TypeScript measurement path converts the numeric value into an
abuse/danger/safety verdict, and the 0045 verifier proves the dedicated
functions read and mutate no Safety Runtime state.

## Independence from Trust, Communication, and Repair

The data model permits every logically possible combination:

- high Trust + low Emotional Safety (e.g. reliable on commitments, yet
  vulnerability gets mocked);
- low Trust + high Emotional Safety;
- high Communication + low Emotional Safety (practical topics flow, but
  emotional exposure feels dangerous);
- low Communication + high Emotional Safety;
- high Repair + low Emotional Safety;
- low Repair + high Emotional Safety.

No formula or DB constraint forces HRS metrics to correlate: no inverse,
no composite HRS score, and no hidden relationship-health value. The 0045
verifier proves Trust = 5, Communication = 4, Repair = 3, and Emotional
Safety = 1 coexist on the same user and the same RELATIONSHIP target, and
that cross-metric calculation and correction are structurally impossible
in every direction (including representative HSE/HBS rejections both
ways).

## Measurement — one exact at-report relationship appraisal

Emotional Safety v1 is **one exact RELATIONSHIP-bound current at-report
appraisal grounded in actual relationship experience** — never a
seven-day period measurement or frequency/episode average:

- the 0043 owned RELATIONSHIP target substrate is reused unchanged:
  exactly one owned `him_measurement_targets` row (`user_id = auth.uid()`,
  `context_kind = RELATIONSHIP`) created through the existing
  `create_him_relationship_measurement_target_v1` RPC, with the
  server-derived opaque label never interpreted semantically. No new
  target table/RPC, contact/person/social graph, linked partner,
  relationship taxonomy, or Couple Mode exists;
- `him_measurement_events.observation_window_start` /
  `observation_window_end` are **NULL** for every Emotional Safety event,
  and the calculation refuses any non-NULL window; no 7/14/30-day period
  or caller-selected window exists;
- the server-authoritative report time is the measurement time; client
  timestamps remain untrusted diagnostics;
- instrument
  `hrs.emotional-safety.direct-relationship-bound-emotional-openness-safety-report@1`,
  source `DIRECT_STRUCTURED_USER_REPORT` only. No LLM/provider call,
  conversation-text inference, sentiment/keyword analysis,
  Memory/Evidence/Hypothesis inference, attachment inference,
  abuse/safety classifier, embeddings, or passive telemetry — the v1
  metric exists only from the user's explicit structured report.

### Canonical prompt semantics

English semantic template (documentation/product semantics only — no
UI/questionnaire/auto-question generation): "Thinking about this
relationship as it stands now, and based on what has actually happened
between you, how emotionally safe does it feel to be open about something
vulnerable or personally important — such as a feeling, need, insecurity,
mistake, limit, or disagreement — without expecting that openness itself
to be mocked, humiliated, punished, retaliated against, or later used
against you?" Canonical founder-facing ar-EG example:
«وأنت بتفكر في علاقتك بالشخص ده دلوقتي، وبناءً على اللي حصل بينكم فعلًا،
لحد قد إيه بتحس إنك تقدر تبقى صريح في حاجة حساسة أو مكشوف فيها نفسيًا —
زي شعور، احتياج، نقطة ضعف، غلطة، حد من حدودك، أو اختلاف — من غير ما تتوقع
إن صراحتك نفسها تتقابل بسخرية أو إهانة أو عقاب أو رد انتقامي أو إنها
تتستخدم ضدك بعدين؟»

The wording is deliberately current ("as it stands now"),
experience-grounded ("based on what has actually happened between you"),
and openness-framed (the consequence attaches to the openness itself). It
never asks "Is this person safe?", "Is this relationship healthy?", "Do
you fight?", or "Should you stay?".

## Scale, special responses, and calculation

Scale `hrs.emotional-safety.openness-safety-5.v1@1`, ORDINAL only (no
interval/ratio operations, zero, midpoint substitution, averages,
percentages, thresholds, safe/unsafe bands, abuse cutoffs, clinical
cutoffs, normalization, or cross-relationship/cross-user ranking):

```text
VERY_LOW → 1   LOW → 2   MODERATE → 3   HIGH → 4   VERY_HIGH → 5
TOO_VULNERABILITY_DEPENDENT_TO_RATE → UNASSESSED (null)
INSUFFICIENT_BASIS_TO_JUDGE         → UNASSESSED (null)
NOT_SURE                            → UNASSESSED (null)
missing observation                 → UNASSESSED (null)
contradictory refs                  → UNASSESSED (null) / PRESENT_UNRESOLVED
```

- **Vulnerability-dependence protection.** Perceived openness safety can
  differ substantially by what would be disclosed: safe to share a
  practical worry, unsafe to reveal an insecurity — or vice versa. When
  one scalar would be misleading, `TOO_VULNERABILITY_DEPENDENT_TO_RATE`
  is UNASSESSED/null — **not a midpoint**, and disclosure kinds are never
  averaged. v1 creates no Emotional Safety subdomains; a future version
  may introduce them separately.
- **Insufficient-basis protection.** `INSUFFICIENT_BASIS_TO_JUDGE` means
  a new or sparse relationship has produced too little meaningful
  emotional exposure to support a score. Missing basis is **neither high
  nor low safety — never zero and never "unsafe"**. `NOT_SURE` is
  equally UNASSESSED/null.

The calculation model
`hrs.emotional-safety.direct-structured-current-emotional-openness-safety@1`
(CALIBRATED, PRODUCTION, `QANDEEL_HIM_GOVERNANCE`, method
`DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_EMOTIONAL_OPENNESS_SAFETY_REPORT`,
evidence contract
`FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1`) is
deterministic and rejects non-RELATIONSHIP contexts, target/context
mismatches, forged/untrimmed/oversized target labels, wrong
metric/version/instrument/scale/source identities, malformed and sibling
responses (including the Trust, Communication, and Repair special codes),
smuggled temporal windows, and superseded observations. It consumes only
its own `observation` input, never interprets the relationship label, and
never inspects Trust, Communication, Repair, HSE, HBS, HGS, Memory,
Evidence, conversation text, or Safety state. Metric confidence stays
`UNRESOLVED_METRIC_CONFIDENCE` (UNASSESSED/null).

## Semantic mapping

`hifOwner = HRS`, `semanticMappingStatus = UNRESOLVED`,
`semanticType = NULL` — deliberately preserved. No
SAFETY/RELATIONSHIP/EMOTIONAL_SAFETY semantic type is created, and no
STATE/TRAIT/CAPABILITY/READINESS/LOAD/PROGRESS mapping is made.
RELATIONSHIP is a context kind, not a semantic type.

## Authority, correction, and currentness

The dedicated RPC family
(`create_hrs_emotional_safety_measurement_v1` /
`correct_hrs_emotional_safety_measurement_v1` /
`calculate_hrs_emotional_safety_measurement_v1`) follows the hardened
0043/0044 pattern: authenticated owner only, anon revoked, cross-user
fail closed, direct DML bypass blocked, server-derived measurement
identity/provenance, server-authoritative report time, immutable
append-only observations, corrections that supersede on the SAME
measurement event and the SAME exact relationship target (**a correction
changes the response, never the relationship**), NULL event windows
preserved through correction, idempotent calculation for the exact
observation + canonical binding, race-safe correction/calculation in the
dedicated `hrs.emotional-safety.observation:` advisory-lock namespace,
superseded observations that can never be recalculated or surface as
current, and the direct assessed-snapshot bypass remains blocked. The
trusted snapshot carries metric `hrs.emotional-safety`, RELATIONSHIP
context with the exact relationship target UUID, UNRESOLVED/NULL semantic
mapping, UNASSESSED/null confidence, NULL temporal window, canonical
provenance, and **no safety verdict or status field**.
`him_current_structured_measurements` and `HimRepository.getLatest()` now
also route `hrs.emotional-safety` + RELATIONSHIP — all four HRS metrics
route through the supersession-aware current structured read on owned
RELATIONSHIP targets — while unsupported contexts and every HGS metric
stay on the raw snapshot path.

## Phase decisions

- **Temporal comparability / Trend v1: NOT ELIGIBLE.** Trend v1 remains
  the five-HSE STATE contract: the semantic mapping is unresolved/null,
  Emotional Safety is a relationship appraisal (not an HSE STATE point),
  no approved HRS temporal-comparability cadence or minimum-evidence
  policy exists, Emotional Safety may be vulnerability-dependent, and no
  cadence, "improving/worsening" language, or safe/unsafe threshold of
  any kind is approved. `read_him_trend_source_v1` and `HimTrendService`
  reject `hrs.emotional-safety`, with regression proof. A future,
  separately versioned HRS Temporal Comparability contract may admit it
  deliberately.
- **HIM Intelligence Snapshot v1 / Reasoning / FAST-DEEP /
  Recommendation: NOT ELIGIBLE.** Snapshot v1 remains exactly the five
  HSE STATE metrics and rejects RELATIONSHIP, with regression proof.
  Emotional Safety enters no HIM Reasoning Consumption, FAST/DEEP
  projection, prompt guidance, Recommendation bridge, or proactive
  behavior. Relationship metrics are sensitive: HRS Runtime Consumption
  is a later, separately reviewed contract, and completing HRS
  measurement is not consumption authority.

## Verification

`hrs-emotional-safety.model.spec.ts` (deterministic model), the static
contract
`database/tests/hrs-emotional-safety-measurement-model-v1.test.mjs`, the
live verifier `database/verify-migration-0045.mjs`
(`npm run verify:hrs-emotional-safety:integration`, wired in CI after the
0044 Communication/Repair verifier and before the HIM Trend verifier),
and the updated structured-measurement preflight manifest (thirteen
calibrated metrics, `EXPECTED_UNCALIBRATED_COUNT=4`), where the preflight
continues to derive the calibrated inventory from the application catalog
and compares it to the manifest with both drift directions fail-closed —
no second hard-coded calibrated inventory source exists. Historical
verifiers freeze neither a global calibrated count, nor the exact HGS
uncalibrated list, nor any migration-number ceiling: later HIM Expansion
phases may calibrate further metrics and add migration 0046 and beyond.
