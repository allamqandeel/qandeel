# HRS Relationship Trust Measurement Model v1

HIM Expansion & Human Intelligence Completion — metric 10/17, the first HRS
metric and the first RELATIONSHIP-bound measurement substrate. Migration
`0043_hrs_relationship_trust_measurement_model_v1.sql`; migrations
`0001`–`0042` are unchanged. After this task exactly ten structured metrics
are calibrated (five HSE, four HBS, and `hrs.relationship-trust`) and seven
remain uncalibrated — a one-time migration-phase transition, never a
permanent historical-verifier ceiling.

## Construct boundary

`hrs.relationship-trust@1` measures **relationship-bound current reliance
trust**: based on what the user has actually experienced in one exact
relationship, how willing the user currently feels to reasonably rely on
the other person when something important to the user depends on that
person's word, follow-through, or good-faith handling of that reliance. The
core object is the user's **current willingness to rely under meaningful
interpersonal vulnerability/uncertainty** — a relationship-specific
appraisal grounded in the user's own experienced relationship.

This measures the **user's reliance appraisal, never a verdict on the other
person**. It is a product/HIM relational construct, NOT a clinical
inference, and it must never mean or infer: a global propensity to trust
people; a personality trait; attachment style or security; love, closeness,
affection, or loyalty; dependency, compliance, or obedience; relationship
satisfaction, compatibility, commitment, or forgiveness; conflict frequency
or its absence; `hrs.communication`, `hrs.repair`, or
`hrs.emotional-safety`; physical safety or an abuse-risk assessment; a
truth detector; proof that the other person is objectively trustworthy or a
permanent "trustworthiness" trait; a prediction that the person will
definitely act well; provider/model or QANDEEL/SENA trust; the epistemic
Confidence Runtime; self-confidence; or a clinical diagnosis.

```text
Relationship Trust != Emotional Safety
Relationship Trust != Communication Quality
Relationship Trust != Repair Capacity
Relationship Trust != Love / Closeness
Relationship Trust != Objective Trustworthiness
Relationship Trust != Global Propensity to Trust
```

A user may trust someone's follow-through but not feel emotionally safe
being vulnerable with them; communicate well with someone but not trust
them with important commitments; have poor communication but still trust
the person's intentions; feel love or closeness while trust is low; or
report high trust that is objectively misplaced. The metric permits every
such combination.

**Direction is not correctness or health.** A higher score means only more
self-reported current willingness to reasonably rely on this person in this
exact relationship. It does not automatically mean the relationship is
healthier, the trust is justified, the other person is safe or honest, that
QANDEEL recommends increasing vulnerability, or that the user should stay.
A low score is not automatically pathology, and a high score is not
evidence of safety. **No recommendation or safety decision may be derived
from this score**: this metric never by itself produces or implies "this
person is safe/unsafe", "you should leave/stay", "you should trust or
distrust them more", "they are lying", "they will betray you", or "this
relationship is abusive/healthy/unhealthy". `hrs.emotional-safety` remains
a separate future metric, and the broader Safety Runtime remains
authoritative for actual safety handling. No clinical terminology enters
user data or outputs, **no founder questionnaire is claimed or required**,
and **no external or clinical validation is claimed**.

## RELATIONSHIP measurement-target substrate

This task establishes the minimal reusable owned RELATIONSHIP
measurement-target substrate by generalizing `him_measurement_targets`
(explicit union: the 0014 GOAL/SITUATION/DECISION kinds plus RELATIONSHIP)
rather than creating a parallel table. A RELATIONSHIP target is **a private, user-owned HIM
measurement context artifact identifying one relationship for measurement
purposes**. It is NOT a social graph, a contact record, another QANDEEL
user link, a mutual relationship object, a verified real-world identity, or
a product "Relationship" domain model.

`create_him_relationship_measurement_target_v1` accepts only a bounded
trimmed 1–256 display label (e.g. "my relationship with Ahmed", "my
marriage"); the server derives `auth.uid()`, the UUID, the RELATIONSHIP
context kind, canonical provenance, and the created time. Anonymous access
is denied, RLS owner isolation is preserved, and targets stay immutable.
The historical Motivation-named target RPC is not broadened or renamed and
still rejects RELATIONSHIP, and existing GOAL/SITUATION target creation and
measurement behavior remains unchanged.

## Measurement — one exact at-report relationship appraisal

Relationship Trust v1 is **one exact RELATIONSHIP-bound current at-report
appraisal** — never a seven-day period measurement, a behavior-frequency
count, an average across incidents, or a lifetime relationship summary:

- `him_measurement_events.observation_window_start` /
  `observation_window_end` are **NULL** for every Relationship Trust event
  (the durable 0040 window pair stays unused, exactly like HSE right-now
  and Reflection events), and the calculation refuses any non-NULL window;
- no caller-selected window exists; the server-authoritative report time is
  the measurement time; client timestamps remain untrusted diagnostics;
- instrument
  `hrs.relationship-trust.direct-relationship-bound-reliance-report@1`,
  source `DIRECT_STRUCTURED_USER_REPORT` only. No LLM/provider call,
  conversation-text or sentiment inference, Memory/Evidence inference,
  relationship-event mining, keyword heuristics, embeddings, or passive
  behavioral telemetry — the v1 metric exists only from the user's explicit
  structured report.

### Canonical prompt semantics

English semantic template (documentation/product semantics only — not
hard-coded UI): "Thinking about this relationship as it stands now, and
based on what you have actually experienced, how much do you feel you can
reasonably rely on this person when something important to you depends on
their word or follow-through?" Canonical founder-facing ar-EG example:
«وأنت بتفكر في علاقتك بالشخص ده دلوقتي، وبناءً على اللي شفته منه فعلًا، لحد
قد إيه شايف إنك تقدر تعتمد عليه لما حاجة مهمة بالنسبالك تبقى معتمدة على
كلامه أو التزامه؟»

The wording is deliberately current ("as it stands now"),
experience-grounded ("based on what you have actually experienced"), and
reliance-framed ("reasonably rely … when something important depends on
their word or follow-through"). It never asks "Do you love them?", "Are
they a good person?", "Are they trustworthy?", "Do they make you feel
safe?", or "Do you trust them completely?" — the instrument measures the
user's reliance appraisal, not an absolute verdict on the other person.

## Scale, special responses, and calculation

Scale `hrs.relationship-trust.reliance-5.v1@1`, ORDINAL only (no
interval/ratio operations, averages, percentages, thresholds, bands,
healthy/unhealthy readings, trustworthiness classifications, clinical
cutoffs, cross-user or cross-relationship comparison, or implicit "more is
always better" rule):

```text
VERY_LOW → 1   LOW → 2   MODERATE → 3   HIGH → 4   VERY_HIGH → 5
TOO_CONTEXT_DEPENDENT_TO_RATE → UNASSESSED (null)
INSUFFICIENT_BASIS_TO_JUDGE   → UNASSESSED (null)
NOT_SURE                      → UNASSESSED (null)
missing observation           → UNASSESSED (null)
contradictory refs            → UNASSESSED (null) / PRESENT_UNRESOLVED
```

- **Domain-dependence protection.** Interpersonal trust can be meaningfully
  domain-dependent (a partner trusted emotionally but not financially; a
  colleague trusted professionally but not with private information).
  Relationship Trust v1 is an overall core reliance appraisal only when the
  user can meaningfully give one overall answer.
  `TOO_CONTEXT_DEPENDENT_TO_RATE` means one scalar overall score would be
  misleading; it is UNASSESSED/null — **not a midpoint**, and domains are
  never averaged. No domain sub-scores exist in v1; a future version may
  introduce domain-specific trust separately.
- **Insufficient-experience protection.** `INSUFFICIENT_BASIS_TO_JUDGE`
  means the user does not yet have enough relevant experience in this
  relationship (very new relationship, little relevant dependence, no
  meaningful opportunities to observe follow-through). It is
  UNASSESSED/null — **never zero and never low trust**. `NOT_SURE` is
  equally UNASSESSED/null.

The calculation model
`hrs.relationship-trust.direct-structured-current-reliance@1` (CALIBRATED,
PRODUCTION, `QANDEEL_HIM_GOVERNANCE`, method
`DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT`) is
deterministic and rejects non-RELATIONSHIP contexts, target/context
mismatches, forged/untrimmed/oversized target labels, wrong
metric/version/instrument/scale/source identities, malformed responses,
smuggled temporal windows, and superseded observations. It never inspects
Communication, Repair, Emotional Safety, HBS metrics, Memory, Evidence,
conversation text, or the semantics of the relationship target label.
Metric confidence stays `UNRESOLVED_METRIC_CONFIDENCE` (UNASSESSED/null).

## HRS construct independence

```text
Relationship Trust != Communication
Relationship Trust != Repair
Relationship Trust != Emotional Safety
```

`hrs.relationship-trust@1` has its own vocabulary, instrument, scale,
model, approval, binding, RPC family, lock namespace, observations,
results, and snapshots. No derived formulas, no composite HRS score, and no
sibling observation as input. Logically possible combinations — high trust
with poor communication, low trust with good communication, high trust
with low emotional safety, low trust with strong repair behavior — remain
freely expressible, with verifier proof that cross-metric calculation is
structurally impossible in every direction. `hrs.communication`,
`hrs.repair`, and `hrs.emotional-safety` remain uncalibrated.

## Authority, correction, and currentness

`create_hrs_relationship_trust_measurement_v1` /
`correct_hrs_relationship_trust_measurement_v1` /
`calculate_hrs_relationship_trust_measurement_v1` follow the hardened
HBS/HSE authority pattern: authenticated owner only, exact
owned-RELATIONSHIP-target checks, immutable append-only history,
advisory-lock idempotency/concurrency safety in a Trust-only lock
namespace, and trusted calculation provenance (a direct assessed snapshot
without calculation provenance remains blocked). A correction attaches to
the SAME measurement event, keeps the same exact relationship target,
label, and context (**a correction changes the response, never the
relationship**), preserves the NULL event window, supersedes the prior
observation, and retires its calculated result/current snapshot through the
existing supersession ledger. Every Relationship Trust snapshot keeps
`semantic_mapping_status='UNRESOLVED'`, `semantic_type=NULL` (the
RELATIONSHIP context kind is not a semantic type; no TRUST/STATE/TRAIT/
READINESS/CAPABILITY mapping is made), `temporal_window_start/end=NULL`,
and `confidence_state='UNASSESSED'` with a NULL reference.
`him_current_structured_measurements` now also carries
`hrs.relationship-trust` so `HimRepository.getLatest()` in RELATIONSHIP can
never surface a stale superseded trust value; the five HSE routes and the
four HBS routes are unchanged, and no other HRS metric is routed.

## Phase decisions

- **Temporal comparability / Trend v1: NOT ELIGIBLE.** Current Trend v1 is
  a five-HSE STATE contract and no HRS temporal-comparability contract has
  been approved: the semantic mapping remains unresolved/null, relationship
  trust is a relationship appraisal (not an HSE STATE), meaningful change
  may be slow/nonlinear/event-driven, no canonical HRS comparison cadence
  or minimum-evidence policy exists, and a single overall trust score may
  become temporarily UNASSESSED when domain-dependent.
  `read_him_trend_source_v1` and `HimTrendService` reject
  `hrs.relationship-trust`, with regression proof. No rising/falling trust
  is ever inferred and no trust-loss/gain threshold exists. This does NOT
  mean Relationship Trust can never have a trend — a future HRS Temporal
  Comparability contract can version this separately.
- **HIM Intelligence Snapshot v1 / Reasoning / FAST-DEEP: NOT ELIGIBLE.**
  Snapshot v1 remains exactly the five HSE STATE metrics. Relationship
  Trust enters neither `read_him_intelligence_snapshot_v1`, the snapshot
  slots/types, HIM Reasoning Consumption, FAST/DEEP projection, nor any
  foreground/background prompt guidance, and it can never directly change
  Recommendations — with regression proof. This is especially important
  because relationship trust is sensitive and must not influence advice
  before the HRS family and its consumption contract are deliberately
  designed and separately reviewed.

## Verification

`hrs-relationship-trust.model.spec.ts` (deterministic model), the static
contract `database/tests/hrs-relationship-trust-measurement-model-v1.test.mjs`,
the live verifier `database/verify-migration-0043.mjs`
(`npm run verify:hrs-relationship-trust:integration`, wired in CI after the
0042 Reflection verifier and before the HIM Trend verifier), and the
updated structured-measurement preflight manifest (ten calibrated metrics,
`EXPECTED_UNCALIBRATED_COUNT=7`), where the preflight continues to derive
the calibrated inventory from the application catalog and compares it to
the manifest — the manifest is the single current-state
calibrated-inventory source, with both drift directions fail-closed.
Historical verifiers freeze neither a global calibrated count nor any
migration-number ceiling: later HIM Expansion phases may calibrate further
metrics and add migration 0044 and beyond.
