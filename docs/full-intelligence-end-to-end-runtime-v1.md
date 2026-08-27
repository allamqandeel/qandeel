# Full Intelligence End-to-End Runtime v1

Phase: Phase II — Intelligence Runtime Completion (final implementation task)
No forward migration: migrations `0001`–`0038` are untouched, the migration
ceiling remains `0038_information_gap_question_integration_v1.sql`, and no
migration `0039` exists. No new table, RPC, function, RLS policy, effect type,
durable-result schema, queue, stream, Recommendation persistence, or
Information Gap resolution/closure model was added.

## Purpose

This task is a runtime **composition proof**, not a new intelligence engine.
Every intelligence boundary it exercises was already implemented and frozen by
its own earlier task; what had never been proven was that they compose as ONE
closed loop through the real production runtime on real infrastructure. The
new verifier (`verify:full-intelligence-e2e-runtime`) proves exactly that
causal loop, deterministically, with zero production semantic changes:

```text
Foreground #1
→ finalized conversation/outbox
→ Redis/background intelligence
→ duplicate no-op
→ Foreground #2 consumes resulting intelligence
```

Concretely: the real `ConversationOrchestratorService` runs Foreground Turn #1
(routing FAST, Safety ALLOW, real PARTIAL HIM session context with
`hse.stress = HIGH`, the seeded Hypothesis at version 1 with no current
Confidence, Recommendation grounding coverage `NONE`, exactly one
conversational ModelRouter call) and itself reaches canonical finalization,
creating the durable `TURN_FINALIZED` (`ConversationTurnCompleted` v2) outbox
event. The real `RuntimeEventPublisher` publishes it to a real Redis Stream;
the real `RedisPostResponseConsumer` and
`PostResponseIntelligenceDispatcherService` run the background intelligence to
terminal completion: canonical Memory write, fresh Evidence, seeded-Hypothesis
update v1 → v2, controlled Hypothesis generation with the frozen
CANDIDATE → ACTIVE lifecycle activation, exact-current-version Confidence for
both current versions, and idempotent Information Gap synchronization with
zero automatic Question Candidates. A byte-identical duplicate delivery is
then proven to be a terminal no-op (provider census still 1/1/1, no duplicated
domain or durable state). Finally the SAME real orchestrator runs Foreground
Turn #2 in the same session and provably consumes the composed intelligence:
the background-created Memory in `memoryContext`, the unchanged session HIM
snapshot, both current Hypotheses with exact-current Confidence, and
Recommendation grounding coverage `FULL` with the canonical actionable set
`['UNVERIFIED_ASSUMPTIONS']` — in exactly one more conversational ModelRouter
call (total: two). Turn #2's own finalization creates a second pending outbox
event that is deliberately left un-dispatched and rolled back, keeping the
smoke bounded while proving foreground durability after consumption.

## What is real

- Every foreground production service: `ConversationOrchestratorService`,
  `ContextBuilderService`, `SafetyResponseGateService`,
  `BehavioralResponsePolicyService`, `MemoryRuntimeService`,
  `MemoryRetrieverService`, `EvidenceService`, `HimTurnContextSelectionService`,
  `HimIntelligenceSnapshotService`, `HimReasoningConsumptionService`,
  `HimFastDeepConsumptionService`, `HypothesisService`,
  `HypothesisReasoningContextService`, `RecommendationGroundingService`,
  `CorrelationService`, `TelemetryService`, and the real `ConversationRepository`.
- Every background production service the frozen A2 smoke runs:
  `RuntimeEventPublisher`, `RedisStreamsTransport`, `RedisPostResponseConsumer`,
  `PostResponseIntelligenceDispatcherService`,
  `BackgroundIntelligenceAuthorityService` / `ContextFactory` /
  `EnrichmentService`, `MemoryWriteEvaluatorService`, the Hypothesis
  association/update/generation services, the managed Confidence batch, and the
  Information Gap synchronization — all through the canonical SECURITY DEFINER
  commands.
- Real PostgreSQL 17 (one rollback-safe transaction), real Redis 7 (one unique
  stream/group deleted afterwards), the canonical RPC/authority paths, and the
  real production `composeServerGuidance` — the recorded central guidance is
  produced by the production function, never re-implemented.

## What is a verifier double

Only external model/provider transport boundaries:

- ONE deterministic conversational ModelRouter double
  (`full-intelligence-e2e-smoke/deterministic-conversational-router.ts`). It
  implements the existing `ModelRouter` contract, records every request,
  invokes the real `composeServerGuidance` and records the result, returns
  fixed benign assistant text, makes zero network calls, performs no provider
  SDK call, reads no provider key, and adds no provider-specific
  Recommendation/HIM/Hypothesis behavior. Expected census: exactly one call on
  each foreground turn — two in total. Recommendation remains an input
  grounding channel of the one conversational call; no second
  "Recommendation model call" exists.
- The three frozen deterministic A2 background provider doubles (association,
  intent, candidate generation), reused unchanged with their observable call
  census (exactly 1/1/1, unchanged by duplicate delivery).
- Verification-only transport adapters substitute the PostgREST/Supabase HTTP
  boundary that CI does not provide: the reused A2 pg adapters for the
  background repositories, plus new foreground adapters
  (`pg-foreground-intelligence.adapters.ts`) that execute the identical
  canonical reads and RPCs the frozen production repositories emit, with the
  same per-request role and JWT-claims identity semantics PostgREST applies.
  They decide no intelligence policy, hand-create no derived domain state, and
  are SELECT-only outside the canonical command functions. A smoke-only global
  fetch guard (`FULL_INTELLIGENCE_E2E_EXTERNAL_HTTP_FORBIDDEN`) makes any
  external HTTP impossible; no provider call — paid or otherwise — occurs.

## The specific proofs

- **Memory**: no Memory exists before background processing (Turn #1 carries
  no `memoryContext`); the background writes the canonical evaluator-decided
  Memory; Turn #2's request contains that exact Memory by type/content/source
  through the real retrieval policy — the central acceptance condition.
- **HIM**: the seeded structured `hse.stress = HIGH` session measurement is
  consumed on both turns as a genuinely `PARTIAL` snapshot (energy and
  attention `UNKNOWN`/null), FAST projection fields only,
  freshness/confidence policy `UNASSESSED`, with no trend/readiness/diagnosis
  inference; the background generation context reflects the same canonical
  structured state.
- **Hypothesis Reasoning**: Turn #1 consumes the seeded Hypothesis at version
  1 with structural Evidence counts 0/0, the assumption present, and
  `NOT_EVALUATED_FOR_CURRENT_VERSION` targeting version 1; Turn #2 consumes
  both current Hypotheses (seeded now v2 with its eligible supporting
  Evidence; generated lifecycle-ACTIVE at its exact current version) by stable
  statement identity, never array position.
- **Exact-current Confidence**: both current versions carry exact-version
  evaluations with `numericScore = null`, `confidenceBand = null`,
  `UNCALIBRATED` calibration and `UNASSESSED` stability. Nothing numeric is
  invented anywhere.
- **Information Gap internal state**: the canonical sync materialized exactly
  one automatic gap per exact actionable Confidence source;
  `CONFIDENCE_MODEL_UNCALIBRATED` materialized nothing; automatic
  `question_candidates` remain exactly zero; the foreground path reads no gap
  as a live blocker and creates no Question.
- **Recommendation grounding**: `NONE` coverage on Turn #1 and `FULL` coverage
  on Turn #2 with the canonical actionable set `['UNVERIFIED_ASSUMPTIONS']`,
  `unverifiedAssumptionsPresent = true`, `contradictingEvidencePresent =
  false`, `sourceTruncated = false`.
- **One-call foreground routing**: FAST route, LOW complexity, unchanged
  latency/cost/safety budgets, exactly one conversational router call per
  turn, two in total, no added provider call of any kind.
- **Duplicate recovery/idempotency**: the byte-identical redelivered event
  resolves terminally and ACKs with zero provider replay and zero duplicated
  Memory/Hypothesis/Confidence/Information Gap/durable-receipt state — the
  already-frozen durable behavior, with no new idempotency machinery.
- **Central guidance composition**: on Turn #2 the real
  `composeServerGuidance` output contains the Memory, HIM, Hypothesis, and
  Recommendation grounding blocks together as separate bounded server-owned
  channels, none of which appears inside USER/ASSISTANT history.

## Explicit boundary statements

- Coverage is not confidence: `NONE`/`PARTIAL`/`FULL` is exact-current
  Confidence **coverage** and must never be read as confidence strength.
- Information Gaps do not auto-create Questions: gaps are internal structural
  state with `UNASSESSED` answerability; no Question Candidate, selection, or
  asking behavior exists or is faked.
- Recommendation grounding is not a full Recommendation Engine: no candidate
  generation, ranking, utility/risk/reversibility math, persistence,
  lifecycle, or Recommendation confidence exists.
- HIM does not become Recommendation authority: HIM stays a bounded structured
  data channel; it proves no hypothesis and forces no recommendation.
- No external provider calls occur anywhere in the smoke.

## Verification structure

- `apps/api/scripts/verify-full-intelligence-end-to-end-runtime.ts` — the
  runtime composition verifier (`npm run verify:full-intelligence-e2e-runtime`),
  requiring only `DATABASE_URL` and `REDIS_URL`.
- `apps/api/scripts/full-intelligence-e2e-smoke/` — the deterministic
  conversational router double and the foreground pg transport adapters.
- `tests/full-intelligence-e2e-runtime-contract.test.mjs` — the fail-closed
  static contract (`npm run test:full-intelligence-e2e-runtime-contract`),
  wired into CI immediately after the A2 static contract.
- CI runs the runtime gate at the end of the API integration sequence, after
  the independent, unchanged A2 E2E runtime smoke succeeds. A2 remains the
  canonical deep background/post-response regression gate; this smoke is the
  final composition gate over the same real PostgreSQL 17 + Redis 7
  infrastructure. The A2 smoke, its helpers, and its static contract are
  byte-unchanged by this task.

## Roadmap

With this gate green, Phase II — Intelligence Runtime Completion is
implementation-complete. The next planned roadmap boundary is the
**Codex System-Wide Architecture Review**.
