# Reasoning → Recommendation Integration v1

Phase: Phase II — Intelligence Runtime Completion
No forward migration: this task is foreground application code only; migrations
`0001`–`0038` are untouched and no migration `0039` exists.

## Architectural position

Canonical Reasoning ownership: the foreground reasoning substrate is the frozen
`HypothesisReasoningContextService`, whose `HypothesisReasoningContextResult`
carries provisional active Hypotheses, exact current versions, structural
eligible Evidence counts, assumptions and disconfirming conditions, and
exact-current uncalibrated Confidence state. Canonical Recommendation ownership
belongs to the Recommendation Engine defined in ABS Part 9 — a decision-support
authority that converts validated understanding into ranked, context-appropriate
recommendations while preserving user agency.

ABS Part 9 is a working specification: it explicitly leaves the recommendation
utility function, risk model, reversibility model, confidence thresholds,
candidate-generation architecture, domain evaluators, personalization weights,
high-impact decision policy, experiment framework, outcome attribution,
learning feedback, final explanation format, voice timing, and escalation rules
**open**, and states that its conceptual APIs are finalized only after ABS
integration. Part 9 therefore does **not** authorize inventing ranking,
scoring, selection, or recommendation-confidence math, and the current
repository has **no** full Recommendation Engine foundation: no Recommendation
module existed before this task, and no Recommendation table, migration,
persisted Recommendation Object, lifecycle, or audit trail exists after it.

This v1 is a deterministic Recommendation **grounding bridge** inside the
existing single foreground conversational call:

```text
HypothesisReasoningContext
→ RecommendationGroundingService (pure, read-only transform)
→ minimized RecommendationGroundingContext
→ same existing ModelRouter request (optional recommendationContext)
→ central composeServerGuidance
→ same single conversational provider call
```

## Bounded contract

Exact source authority: the canonical `HypothesisReasoningContextResult`
returned by `HypothesisReasoningContextService`. The grounding service performs
no database, Hypothesis-repository, Confidence-repository, Information Gap,
Memory, HIM, Question, or provider access.

`RecommendationGroundingContext` (contract version 1, source
`QANDEEL_HYPOTHESIS_REASONING_CONTEXT`, sourceContractVersion 1) exposes
exactly five derived fields:

- `currentVersionConfidenceCoverage`: `NONE` when zero included Hypotheses have
  `EXACT_CURRENT_VERSION_EVALUATED` Confidence, `FULL` when all do, otherwise
  `PARTIAL`. **Coverage is not confidence strength**: it is never a score,
  probability, band, or readiness level, and `FULL` never means high
  confidence. Every current exact evaluation remains `numericScore: null`,
  `confidenceBand: null`, `UNCALIBRATED`, `UNASSESSED` stability.
- `actionableMissingInformationCodes`: deduplicated codes aggregated only from
  exact-current evaluated items, restricted to `NO_ELIGIBLE_EVIDENCE`,
  `UNVERIFIED_ASSUMPTIONS`, `COMPETING_HYPOTHESES_UNASSESSED`, returned in that
  fixed canonical order regardless of encounter order.
  `CONFIDENCE_MODEL_UNCALIBRATED` is excluded — calibration state constrains
  certainty globally and is not user-answerable structural missing information,
  the same distinction the Information Gap integration froze. An unknown future
  code fails closed.
- `unverifiedAssumptionsPresent`: boolean structural presence of canonical
  assumptions on any included Hypothesis; no assumption text is copied, no
  severity is judged.
- `contradictingEvidencePresent`: boolean presence of
  `currentlyEligibleContradictingEvidenceCount > 0` on any included Hypothesis;
  no IDs or counts are copied and no strength or probability is implied.
- `sourceTruncated`: exact mirror of the canonical source `truncated` value; it
  is never converted into a probability, risk score, or routing decision.

The context deliberately contains no user/session/turn IDs, Hypothesis or
Evidence or Confidence IDs, statements, scopes, assumption or
disconfirming-condition text, numeric counts, scores, bands, provider metadata,
timestamps, provenance, Information Gap rows, HIM values, memory content, or
hidden reasoning. The detailed substrate remains separately available to the
model as the unchanged `hypothesisContext` channel.

An `EMPTY` reasoning result maps to
`{coverageState: 'EMPTY', reason: 'NO_ACTIVE_HYPOTHESES'}` and the orchestrator
omits `recommendationContext` entirely; normal conversation continues
unchanged. Impossible source shapes (wrong contract/source/coverage,
count/truncation inconsistencies, target-version mismatch, non-null score/band,
wrong calibration/stability/policy, unsupported Confidence state, unknown
missing-information code) throw the bounded
`RecommendationGroundingInvariantError` — no raw user content in the error —
which fails the turn through the existing sanitized failure path **before** any
provider call.

## Orchestrator integration

Order is preserved: Context → Safety → HIM → Memory →
HypothesisReasoningContext → Recommendation grounding transform → context
assembly → ONE `ModelRouter.generate` → finalize. Safety `BLOCK` still
finalizes deterministically before any HIM, Memory, Hypothesis, Recommendation,
or provider work. FAST and DEEP receive identical grounding semantics because
the source contract is path-invariant; `selectPath`, thresholds, budgets, model
selection, and fallback are unchanged. `ModelRouterRequest` gains only the
optional `recommendationContext` field; the task remains
`CONVERSATIONAL_RESPONSE` with exactly one primary ModelRouter call and **zero
new provider/model calls**.

## Central provider guidance

All Recommendation semantics live in the shared `composeServerGuidance`:
the context is escaped structured DATA inside
`<recommendation_grounding_context>`, below Safety and Behavioral authority. The
guidance states that the context's presence does not authorize advice; the user
decides (no coercion, manipulation, autonomous high-impact or irreversible
choices); coverage is never confidence; null/uncalibrated Confidence never
becomes a score, band, percentage, or threshold; actionable missing information
never auto-authorizes a Question (Question selection stays with the Question
Engine); no scored/ranked/best/optimal claim may be attributed to the system;
material uncertainty (coverage below FULL, actionable missing information,
unverified assumptions, contradicting Evidence, truncation) keeps advice
provisional, preserves alternatives, and prefers low-commitment reversible
steps; HIM influences tone and pacing only and has no recommendation authority;
Evidence flags are structural only and decision-relevant contradiction must not
be hidden; explanations distinguish assumptions from facts without exposing
hidden chain-of-thought or internal codes/contract names. Anthropic and OpenAI
adapters consume this identical central guidance and add **no provider-specific
Recommendation policy**.

## Explicit non-goals and open canonical decisions

No Recommendation persistence, table, RPC, RLS, lifecycle
(PRESENTED/ACCEPTED/DECLINED/COMPLETED), audit trail, outcome tracking, or
learning loop. No `generate_candidates` / `evaluate_candidate` /
`rank_candidates` / `select_recommendation` production APIs; no template or LLM
candidate generation, weights, tie-breakers, or winner logic. No foreground
Information Gap read (v1 gaps have no resolution/closure lifecycle, so treating
historical OPEN gaps as live blockers would be stale policy), no gap or
Question mutation, no answer ingestion. No Hypothesis/Evidence/
Confidence/Memory mutation. No conversational-state or intent classifier, no
advice trigger, no Behavioral policy change. No background/post-response,
Redis, A2, or dispatcher change; the A2 E2E smoke is unchanged. The open Part 9
decisions listed above remain unresolved by design.

Next planned roadmap boundary: **Full Intelligence End-to-End Runtime**, where
wider composed end-to-end proof belongs.
