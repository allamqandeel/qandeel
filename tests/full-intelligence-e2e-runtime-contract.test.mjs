// Static contract for the Full Intelligence End-to-End Runtime Smoke v1.
//
// Fail-closed drift guards only: the authoritative proof is the runtime smoke
// itself (verify:full-intelligence-e2e-runtime) against real PostgreSQL 17 +
// Redis 7 in CI. These assertions keep the composition verifier wired into CI
// after the frozen A2 gate, keep it composed from the REAL production
// foreground and background services, keep the only doubles at the model/
// provider transport boundaries, and keep the no-paid-provider, no-direct-
// derived-write, and privacy guarantees checkable without infrastructure.
// Architectural invariants, not formatting: no full-file snapshots.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const apiCi = await readFile(new URL('.github/workflows/api-ci.yml', root), 'utf8');
const smokeScript = await readFile(new URL('apps/api/scripts/verify-full-intelligence-end-to-end-runtime.ts', root), 'utf8');
const routerDouble = await readFile(
  new URL('apps/api/scripts/full-intelligence-e2e-smoke/deterministic-conversational-router.ts', root), 'utf8');
const foregroundAdapters = await readFile(
  new URL('apps/api/scripts/full-intelligence-e2e-smoke/pg-foreground-intelligence.adapters.ts', root), 'utf8');
const smokeSources = [smokeScript, routerDouble, foregroundAdapters].join('\n');

async function listProductionSources(directory) {
  const base = fileURLToPath(directory);
  const entries = await readdir(base, { withFileTypes: true, recursive: true });
  return Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => readFile(join(entry.parentPath ?? base, entry.name), 'utf8')));
}

test('package scripts exist with the exact intended verifier files', () => {
  const runtimeCommand = packageJson.scripts['verify:full-intelligence-e2e-runtime'];
  assert.equal(typeof runtimeCommand, 'string', 'missing verify:full-intelligence-e2e-runtime');
  assert.match(runtimeCommand, /--env-file-if-exists=\.env/u, 'CI-provided configuration must work without a physical .env');
  assert.match(runtimeCommand, /ts-node/u);
  assert.match(runtimeCommand, /apps\/api\/scripts\/verify-full-intelligence-end-to-end-runtime\.ts/u);
  const contractCommand = packageJson.scripts['test:full-intelligence-e2e-runtime-contract'];
  assert.equal(typeof contractCommand, 'string', 'missing test:full-intelligence-e2e-runtime-contract');
  assert.match(contractCommand, /tests\/full-intelligence-e2e-runtime-contract\.test\.mjs/u);
});

test('CI invokes the static contract after the A2 static contract and the runtime gate after the A2 runtime smoke', () => {
  const contractInvocations = apiCi.match(/run: npm run test:full-intelligence-e2e-runtime-contract/gu) ?? [];
  assert.equal(contractInvocations.length, 1, 'CI invokes this static contract exactly once');
  assert.ok(apiCi.indexOf('run: npm run test:full-intelligence-e2e-runtime-contract') >
    apiCi.indexOf('run: npm run test:a2-e2e-smoke-contract'),
    'the Full Intelligence static contract runs immediately after the existing A2 static contract');
  const runtimeInvocations = apiCi.match(/run: npm run verify:full-intelligence-e2e-runtime\b/gu) ?? [];
  assert.equal(runtimeInvocations.length, 1, 'CI invokes the runtime verifier exactly once');
  const runtimeIndex = apiCi.indexOf('run: npm run verify:full-intelligence-e2e-runtime');
  assert.ok(runtimeIndex > apiCi.indexOf('run: npm run verify:a2-e2e-runtime-smoke'),
    'the Full Intelligence runtime gate runs after the successful A2 E2E runtime smoke');
  assert.ok(runtimeIndex > apiCi.indexOf('run: npm run verify:post-response-dispatch:integration'),
    'the Full Intelligence runtime gate runs after the Redis dispatch verifier');
  const a2Invocations = apiCi.match(/run: npm run verify:a2-e2e-runtime-smoke\b/gu) ?? [];
  assert.equal(a2Invocations.length, 1, 'the frozen A2 runtime smoke still runs independently exactly once');
});

test('the runtime verifier composes the real foreground production services', () => {
  for (const productionClass of [
    'ConversationOrchestratorService',
    'ConversationRepository',
    'ContextBuilderService',
    'SafetyResponseGateService',
    'BehavioralResponsePolicyService',
    'MemoryRuntimeService',
    'MemoryRetrieverService',
    'EvidenceService',
    'HimTurnContextSelectionService',
    'HimIntelligenceSnapshotService',
    'HimReasoningConsumptionService',
    'HimFastDeepConsumptionService',
    'HypothesisService',
    'HypothesisReasoningContextService',
    'RecommendationGroundingService',
    'CorrelationService',
    'TelemetryService',
  ]) assert.match(smokeScript, new RegExp(`\\b${productionClass}\\b`, 'u'), `real ${productionClass} is exercised`);
  assert.match(smokeScript, /orchestrator\.orchestrate\(/u, 'the real orchestrator runs the turns');
  assert.doesNotMatch(smokeScript, /finalize_conversation_turn/u,
    'no manual Full-smoke finalization helper: canonical finalization is reached only through the real orchestrator');
});

test('the runtime verifier uses the real background publisher/consumer/dispatcher path and the frozen A2 helpers', () => {
  for (const productionClass of [
    'RuntimeEventPublisher',
    'RedisStreamsTransport',
    'RedisPostResponseConsumer',
    'PostResponseIntelligenceDispatcherService',
    'BackgroundIntelligenceAuthorityService',
    'BackgroundIntelligenceContextFactory',
    'BackgroundIntelligenceEnrichmentService',
    'MemoryWriteEvaluatorService',
    'HypothesisEvidenceAssociationAuthorityService',
    'HypothesisGenerationIntentExtractionService',
    'HypothesisGenerationRequestAssemblerService',
    'HypothesisGenerationTriggerClassificationService',
  ]) assert.match(smokeScript, new RegExp(`\\b${productionClass}\\b`, 'u'), `real ${productionClass} is exercised`);
  assert.match(smokeScript, /processOnce\(\)/u, 'the real publisher cycle is invoked');
  assert.match(smokeScript, /from '\.\/a2-e2e-smoke\/smoke-db'/u, 'the shared A2 transaction session is reused, not duplicated');
  assert.match(smokeScript, /from '\.\/a2-e2e-smoke\/deterministic-providers'/u, 'the frozen A2 provider doubles are reused');
});

test('the foreground ModelRouter is a deterministic verifier double that records real composeServerGuidance', () => {
  assert.match(routerDouble, /export class DeterministicConversationalModelRouter implements ModelRouter/u);
  assert.match(routerDouble, /composeServerGuidance\(request\)/u, 'the double invokes the REAL composeServerGuidance');
  assert.match(routerDouble, /from '\.\.\/\.\.\/src\/model-router\/model-router\.types'/u,
    'guidance composition is imported from production, never re-implemented');
  assert.doesNotMatch(routerDouble, /fetch|https?:|process\.env|new [A-Z][A-Za-z]*Router\(/u,
    'the router double makes no network call, reads no environment, and wraps no real provider router');
  assert.match(smokeScript, /DeterministicConversationalModelRouter/u, 'the verifier uses the deterministic conversational double');
  assert.match(smokeScript, /exactly one conversational ModelRouter call on Turn #1/u);
  assert.match(smokeScript, /exactly one additional conversational ModelRouter call; total = 2/u,
    'the expected foreground router call census is exactly 2');
  assert.doesNotMatch(smokeSources, /Recommendation(?:Model|Provider|Router)|recommendation.*generate\(/u,
    'no second Recommendation model call is simulated');
});

test('the QHIA-011 aggregate v3 is the smoke foreground transport and its success is censused non-vacuously', () => {
  // ROOT CAUSE this guard closes: the smoke PostgREST substitute must
  // RECOGNISE the migration-0060 aggregate-v3 RPC. The aggregate is optional
  // foreground enrichment and the Orchestrator degrades gracefully when it
  // rejects, so an unrecognised RPC lets the whole smoke stay green while
  // migration 0060 is never executed even once.
  assert.match(foregroundAdapters, /'read_him_session_cross_context_foreground_v3'/u,
    'the smoke authenticated RPC allowlist recognises the migration-0060 aggregate-v3 transport');
  // Neither the retired aggregate-v1 and aggregate-v2 endpoints nor any retired
  // per-request shape may be accepted as the orchestrator transport path here.
  // All of them remain canonical database authorities verified by their own
  // migrations and verifiers; this is a smoke-only transport list.
  for (const retired of [
    'read_him_session_cross_context_foreground_v1',
    'read_him_session_cross_context_foreground_v2',
    'read_him_session_situation_stress_v1',
    'read_him_session_decision_attention_v1',
    'read_him_session_goal_motivation_v1',
    'read_him_session_relationship_communication_v1',
    'read_him_session_context_bindings_v1',
  ]) {
    assert.ok(!new RegExp(`'${retired}'`, 'u').test(foregroundAdapters),
      `${retired} is not accepted as the cross-context orchestrator transport path in this smoke`);
  }

  // The census must separate ATTEMPTED from COMPLETED, or "green" still cannot
  // distinguish a successful authoritative read from a rejected one.
  assert.match(foregroundAdapters, /export class SmokeAuthenticatedRpcCensus/u, 'the smoke-only transport census exists');
  for (const recorder of ['recordAttempt', 'recordCompletion', 'recordFailure']) {
    assert.match(foregroundAdapters, new RegExp(`census\\?\\.${recorder}\\(`, 'u'),
      `the substitute records ${recorder} for every authenticated RPC`);
  }
  const attemptIndex = foregroundAdapters.indexOf('census?.recordAttempt(name)');
  const allowlistIndex = foregroundAdapters.indexOf('if (!rpcAllowlist.has(name))');
  assert.ok(attemptIndex > 0 && allowlistIndex > 0 && attemptIndex < allowlistIndex,
    'the attempt is recorded BEFORE the allowlist decision, so a refused direct request is still counted');
  assert.match(foregroundAdapters, /readonly rpcCensus = new SmokeAuthenticatedRpcCensus\(\)/u,
    'the authenticated substitute exposes its own census');
  // Instrumentation stays verification-only.
  assert.doesNotMatch(smokeScript, /jest\.|jest\b|spyOn|monkey|Object\.defineProperty\(\s*Him/u,
    'no production service is instrumented by the smoke');

  // The smoke composes the REAL aggregate boundary and the REAL semantic
  // consumers, and reaches those consumers through the aggregate raw-row path.
  for (const productionClass of [
    'HimCrossContextForegroundAggregationService',
    'HimCrossContextForegroundRepository',
    'HimSituationStressConsumptionService',
    'HimSituationStressRepository',
    'HimDecisionAttentionConsumptionService',
    'HimDecisionAttentionRepository',
    'HimGoalMotivationConsumptionService',
    'HimGoalMotivationRepository',
    'HimRelationshipCommunicationConsumptionService',
    'HimRelationshipCommunicationRepository',
  ]) assert.match(smokeScript, new RegExp(`new ${productionClass}\\(`, 'u'), `real ${productionClass} is composed`);
  // The aggregate must be wired to the REAL Relationship-communication consumer,
  // not to a stand-in: a fifth constructor argument that is not the real service
  // would make the fourth slot's decode meaningless.
  const aggregateStart = smokeScript.indexOf('new HimCrossContextForegroundAggregationService(');
  assert.ok(aggregateStart > 0, 'the smoke constructs the real aggregation service');
  const aggregateArgs = smokeScript.slice(aggregateStart, smokeScript.indexOf(');', aggregateStart));
  for (const child of ['himCrossContextForegroundRepository', 'himSituationStressService', 'himDecisionAttentionService', 'himGoalMotivationService', 'himRelationshipCommunicationService']) {
    assert.ok(aggregateArgs.includes(child), `the aggregate is composed over the real ${child}`);
  }
  const orchestratorStart = smokeScript.indexOf('new ConversationOrchestratorService(');
  assert.ok(orchestratorStart > 0, 'the smoke constructs the real orchestrator');
  const orchestratorArgs = smokeScript.slice(orchestratorStart, smokeScript.indexOf(');', orchestratorStart));
  assert.ok(orchestratorArgs.includes('himCrossContextForegroundService'),
    'the orchestrator receives the aggregate service');
  for (const retired of ['himSituationStressService', 'himDecisionAttentionService', 'himGoalMotivationService', 'himRelationshipCommunicationService']) {
    assert.ok(!orchestratorArgs.includes(retired),
      `${retired} is no longer an Orchestrator dependency: it is reached only through the aggregate`);
  }

  // Runtime census assertions: attempted AND completed, per turn, with zero
  // aggregate-v1, zero aggregate-v2, zero direct per-channel, and zero
  // relevance-authority requests.
  assert.match(smokeScript, /const CROSS_CONTEXT_FOREGROUND_RPC = 'read_him_session_cross_context_foreground_v3'/u);
  assert.match(smokeScript, /'read_him_session_cross_context_foreground_v1',\n\s+'read_him_session_cross_context_foreground_v2',/u,
    'both retired aggregate endpoints are censused by name');
  assert.match(smokeScript, /'read_him_session_goal_motivation_v1',/u,
    'the direct QHIA-010 authority is censused by name');
  assert.match(smokeScript, /'read_him_session_relationship_communication_v1',/u,
    'the direct QHIA-011 authority is censused by name');
  assert.match(smokeScript, /every aggregate attempt COMPLETED against real PostgreSQL/u,
    'the smoke asserts completion, not merely attempt');
  assert.match(smokeScript, /application attempts - the v3 endpoint is not shadowed by, raced against, or backed up by a retired transport/u,
    'the retired aggregate endpoints are proven unused by the application');
  assert.match(smokeScript, /zero direct foreground attempts for/u);
  assert.match(smokeScript, /the QHIA-006 relevance authority is never requested from the application/u);
  assert.match(smokeScript, /no direct, fallback, or backup cross-context foreground request of any kind was issued/u);
  assert.match(smokeScript, /goal_motivation\|relationship_communication\|context_bindings\|cross_context_foreground_v1\|cross_context_foreground_v2/u,
    'the catch-all attempted-name census also covers the Relationship authority and both retired aggregate endpoints');
  for (const label of [
    "assertCrossContextForegroundTransport(0, 'before any foreground turn')",
    "assertCrossContextForegroundTransport(1, 'after foreground Turn #1')",
    "assertCrossContextForegroundTransport(2, 'after foreground Turn #2')",
  ]) assert.ok(smokeScript.includes(label), `the smoke censuses the aggregate transport: ${label}`);

  // Success-with-legitimate-unbound is proven distinctly from degradation, and
  // since QHIA-011A the ACTIVATED Goal slot is proven distinctly from both.
  assert.match(smokeScript, /migration 0060 answers with exactly four transport rows/u);
  assert.match(smokeScript, /the frozen transport order, the explicitly activated Goal, and the deterministic unbound states of the three unactivated authorities/u);
  assert.match(smokeScript, /\[3, 'GOAL_MOTIVATION', 'ACTIVE_GOAL_BOUND'\]/u,
    'the third slot is proven to be an authoritative ACTIVE_GOAL_BOUND row produced by the explicit product activation');
  assert.match(smokeScript, /\[4, 'RELATIONSHIP_COMMUNICATION', 'NO_ACTIVE_RELATIONSHIP'\]/u,
    'the fourth slot is proven to be an authoritative NO_ACTIVE_RELATIONSHIP row, never a missing or degraded one');
  assert.match(smokeScript, /ACTIVE for the explicitly activated Goal, bounded NONE for the three unactivated channels/u,
    'the REAL QHIA-007/QHIA-008/QHIA-010/QHIA-011 consumers are reached through the aggregate raw-row path');
  assert.match(smokeScript, /goalMotivation: \{ contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_GOAL_ACTION_BURDEN' \}/u,
    'the real Goal-motivation consumer decoded the activated raw row to its already-frozen ACTIVE guidance');
  assert.match(smokeScript, /relationshipCommunication: \{ contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' \}/u,
    'the real Relationship-communication consumer decoded the successful raw row to NONE');
  assert.match(smokeScript, /himRelationshipCommunicationService\.consumeSourceRows\(\[aggregateRows\[3\]\]\)/u,
    'the fourth raw row is decoded by the REAL QHIA-011 consumer on its own, not only inside the aggregate');
  assert.match(smokeScript, /himGoalMotivationService\.consumeSourceRows\(\[aggregateRows\[2\]\]\)/u,
    'the third raw row is decoded by the REAL QHIA-010 consumer on its own, not only inside the aggregate');
  assert.match(smokeScript, /decodes the successful NO_ACTIVE_RELATIONSHIP row to NONE \/ DEFAULT/u);
  assert.match(smokeScript, /contractVersion: 3,/u, 'the application consumes the explicit v3 aggregate guidance contract');
  assert.match(smokeScript, /exactly one ACTIVE GOAL binding exists and no Situation, Decision, or Relationship is bound to the session/u,
    'both the activated and the unbound answers are proven to be the authoritative ones, not accidents');
  // QHIA-013: the three authoritatively unbound channels no longer have their
  // own provider request fields, so "they added nothing" is now proven where the
  // provider actually sees it - the ONE envelope's instruction set is exactly
  // the canonical-order union the bound channels authorize, and no more.
  assert.match(smokeScript, /const assertHumanIntelligenceProviderEnvelope = /u,
    'the smoke asserts the one consolidated Human Intelligence provider envelope');
  assert.match(smokeScript, /the instruction set is the canonical-order union only/u,
    'an authoritatively unbound channel contributes no behavioral instruction');
  assert.match(smokeScript, /no legacy \$\{legacy\} request field reaches Model Router/u,
    'none of the eight retired Human Intelligence provider request fields survives');
});

test('QHIA-011A - Full Intelligence covers ONE deliberate explicit activation through the production application entry', () => {
  // ROOT CAUSE this guard closes: before QHIA-011A the smoke exercised only the
  // all-unbound cross-context state, so a completely missing product activation
  // entry could not make it fail. If the deliberate setup activation is ever
  // removed - or downgraded to a direct row write, a raw QHIA-006 SQL call, or
  // a second application binding repository - this test fails.
  assert.match(smokeScript, /ConversationContextActivationService/u,
    'the smoke activates through the NEW production application activation service');
  assert.match(smokeScript, /new ConversationContextActivationService\(\s*new HimSessionContextBindingService\(new HimSessionContextBindingRepository\(memoryDataApi\)\)\)/u,
    'the activation service is composed over the EXISTING QHIA-006 service and its ONE existing repository');
  assert.match(smokeScript, /contextActivationService\.activateContext\(/u,
    'the binding is written by the production application entry, not by the smoke');
  assert.doesNotMatch(smokeSources, /INSERT\s+INTO\s+(?:public\.)?him_session_context_bindings/iu,
    'the smoke never direct-INSERTs a binding row');
  assert.doesNotMatch(smokeSources, /(?:SELECT|FROM)[^\n]*public\.set_him_session_context_binding_v1/u,
    'the smoke never calls the QHIA-006 set command as raw SQL');
  assert.doesNotMatch(smokeSources, /(?:SELECT|FROM)[^\n]*public\.clear_him_session_context_binding_v1/u,
    'the smoke never calls the QHIA-006 clear command as raw SQL');

  // The fixture the activation makes meaningful comes from the EXISTING
  // canonical structured measurement authorities, never from a new writer.
  assert.match(smokeScript, /create_him_motivation_measurement_target\('GOAL'/u,
    'the Goal comes from the existing canonical Motivation target authority');
  assert.match(smokeScript, /create_hse_motivation_measurement\(\$1, 'LOW', NULL\)/u,
    'the LOW reading comes from the existing canonical Motivation measurement authority');
  assert.match(smokeScript, /calculate_hse_motivation_measurement/u,
    'the reading is calculated by the existing canonical calculation authority');

  // The transport substitute must RECOGNISE the activation write, or the smoke
  // could stay green while the activation was silently refused.
  assert.match(foregroundAdapters, /'set_him_session_context_binding_v1'/u,
    'the smoke authenticated RPC allowlist recognises the explicit activation command');
  for (const absent of ['clear_him_session_context_binding_v1', 'read_him_session_context_bindings_v1']) {
    assert.ok(!new RegExp(`'${absent}'`, 'u').test(foregroundAdapters),
      `${absent} is never accepted in this smoke: the activation entry is a one-shot setup command`);
  }

  // Census: exactly one attempted AND completed setup activation, zero
  // failures, and it never becomes a per-turn foreground call.
  assert.match(smokeScript, /const EXPLICIT_ACTIVATION_SET_RPC = 'set_him_session_context_binding_v1'/u);
  assert.match(smokeScript, /census\.attempts\(EXPLICIT_ACTIVATION_SET_RPC\), 1/u,
    'the smoke asserts exactly one explicit activation attempt for the whole run');
  assert.match(smokeScript, /census\.completions\(EXPLICIT_ACTIVATION_SET_RPC\), 1/u,
    'the smoke asserts the activation really COMPLETED, not merely that it was attempted');
  assert.match(smokeScript, /census\.failures\(EXPLICIT_ACTIVATION_SET_RPC\), 0/u);
  assert.match(smokeScript, /census\.attempts\(EXPLICIT_ACTIVATION_CLEAR_RPC\), 0/u,
    'no clear command is issued anywhere: replacement is never clear plus set');
  // The census helper runs before Turn #1 AND after both turns, so "exactly one
  // for the whole smoke" is a statement about every turn, not only about setup.
  for (const label of [
    "assertCrossContextForegroundTransport(0, 'before any foreground turn')",
    "assertCrossContextForegroundTransport(2, 'after foreground Turn #2')",
  ]) assert.ok(smokeScript.includes(label), `the activation census is re-checked at: ${label}`);

  // No provider-race flakiness: the ACTIVE guidance is asserted deterministically
  // off the Orchestrator race, and the provider-side field assertion tolerates
  // absence while forbidding any value other than the frozen ACTIVE contract.
  // QHIA-013 keeps the race-tolerant shape at the consolidated boundary: the
  // instruction set is either the base set the always-active adaptation
  // authorizes or exactly that set unioned with the Goal channel's own
  // instructions - never a third possibility and never a duplicate.
  assert.match(smokeScript, /const GOAL_ACTIVE_BEHAVIORAL_INSTRUCTION_IDS = /u);
  assert.match(smokeScript, /the instruction set is the canonical-order union only/u);
  assert.match(smokeScript, /no behavioral instruction ID repeats/u);
  assert.doesNotMatch(smokeScript, /setTimeout|sleep\(|new Promise\(\s*\(resolve\)\s*=>\s*setTimeout/u,
    'no arbitrary sleep or timer is introduced to win the optional-enrichment race');
});

test('background providers remain the deterministic A2 doubles with an observable census', () => {
  for (const double of [
    'DeterministicAssociationProposalProvider',
    'DeterministicIntentExtractionProvider',
    'DeterministicCandidateGenerator',
  ]) assert.match(smokeScript, new RegExp(`\\b${double}\\b`, 'u'), `smoke uses ${double}`);
  assert.match(smokeScript, /association provider count remains 1 after duplicate/u);
  assert.match(smokeScript, /intent provider count remains 1 after duplicate/u);
  assert.match(smokeScript, /candidate generator count remains 1 after duplicate/u);
});

test('no real conversational/provider adapter is imported and no provider key is read', () => {
  assert.doesNotMatch(smokeSources, /from '[^\n']*(?:providers\/|openai|anthropic|claude|gemini)[^\n']*'/iu,
    'no real OpenAI/Anthropic/Gemini conversational or provider adapter is imported');
  assert.doesNotMatch(smokeSources, /process\.env\.(?:ANTHROPIC|OPENAI|GEMINI|GOOGLE|XAI|MISTRAL)[A-Z_]*/u,
    'no provider API key is read by the smoke');
  assert.doesNotMatch(smokeSources, /process\.env\.[A-Z_]*API_KEY/u, 'no API key of any kind is required');
});

test('the smoke seals the external HTTP boundary explicitly', () => {
  assert.match(smokeScript, /FULL_INTELLIGENCE_E2E_EXTERNAL_HTTP_FORBIDDEN/u, 'bounded verifier-specific fetch guard present');
  assert.match(smokeScript, /globalThis\.fetch/u);
  assert.match(smokeScript, /delete process\.env\.SUPABASE_URL/u, 'real Supabase transport cannot activate');
  assert.match(smokeScript, /delete process\.env\.SUPABASE_SERVICE_ROLE_KEY/u);
});

test('the verifier never directly mutates authority-owned derived tables and hand-builds no Confidence or Information Gap row', () => {
  assert.doesNotMatch(smokeSources,
    /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.)?(?:memories|evidence|hypotheses|confidence_evaluations|information_gaps|question_candidates|hypothesis_updates|hypothesis_lifecycle_transitions|information_gap_confidence_sources|post_response_intelligence_executions|post_response_intelligence_effects|post_response_confidence_batch_items|runtime_event_outbox|conversation_turns|conversation_sessions)\b/iu,
    'the verifier issues no direct DML against canonical or derived authority-owned tables');
  assert.match(smokeSources, /INSERT INTO auth\.users/u, 'fixture bootstrap follows the established A2 auth.users pattern');
  assert.doesNotMatch(smokeSources, /background_create_confidence_evaluation_v1|create_confidence_evaluation/u,
    'no hand-built Confidence evaluation rows');
  assert.doesNotMatch(smokeSources, /create_information_gap/u, 'no hand-built Information Gap rows');
  assert.doesNotMatch(smokeSources, /QuestionService|question\.service|QuestionCandidateGenerator/u,
    'no Question service — real or fake — participates in the foreground path');
  assert.match(foregroundAdapters, /SELECT/u);
  assert.doesNotMatch(foregroundAdapters, /INSERT|UPDATE|DELETE/u,
    'the foreground table transport is SELECT-only; every write authority is a canonical database function');
});

test('the PR #137 migration boundary stays historically accurate without freezing the repository chain', async () => {
  const migrations = (await readdir(new URL('database/migrations/', root))).filter((name) => name.endsWith('.sql')).sort();
  // Historically scoped invariant: PR #137 (Full Intelligence E2E Runtime v1)
  // itself added no forward migration — the Phase II chain through 0038 is
  // intact and ordered. Post-Phase-II reliability-correction migrations are
  // allowed; no permanent global migration ceiling is asserted.
  const phaseTwoTail = ['0037_background_him_runtime_consumption_v1.sql', '0038_information_gap_question_integration_v1.sql'];
  const indexes = phaseTwoTail.map((name) => migrations.indexOf(name));
  assert.ok(indexes.every((index) => index >= 0), 'the Phase II chain still reaches 0038');
  assert.deepEqual([...indexes].sort((left, right) => left - right), indexes, 'the Phase II tail keeps its canonical order');
  // The Full Intelligence verifier remains independent from post-review
  // recovery policy: the smoke references no post-Phase-II migration artifact
  // and does not directly mutate canonical authority-owned state (asserted
  // separately above).
  assert.doesNotMatch(smokeSources, /0039|recover_expired_generating_conversation_turn|generation_lease/u,
    'the smoke stays independent of the post-review recovery migration');
});

test('the closed-loop scenario order is structurally present', () => {
  const order = [
    "stage = 'FIXTURE'",
    "stage = 'FOREGROUND_TURN_1'",
    "stage = 'OUTBOX_PUBLISH'",
    "stage = 'BACKGROUND_DISPATCH'",
    "stage = 'DUPLICATE_DELIVERY'",
    "stage = 'FOREGROUND_TURN_2'",
    "stage = 'CLEANUP'",
  ];
  const indexes = order.map((marker) => smokeScript.indexOf(marker));
  assert.ok(indexes.every((index) => index >= 0), 'every scenario stage exists');
  assert.deepEqual([...indexes].sort((left, right) => left - right), indexes,
    'Foreground #1 → outbox/Redis/background dispatch → duplicate replay → Foreground #2, in that order');
  assert.match(smokeScript, /BEGIN|rollback/iu);
});

test('the first-turn pre-background intelligence proofs are present', () => {
  assert.match(smokeScript, /no Memory from this source turn exists before post-response processing/u);
  assert.match(smokeScript, /no memoryContext before background Memory work/u);
  assert.match(smokeScript, /stress KNOWN\/HIGH, energy and attention UNKNOWN\/null, FAST fields only, policies UNASSESSED/u);
  assert.match(smokeScript, /the seeded Hypothesis is consumed at version 1 with no current-version Confidence/u);
  assert.match(smokeScript, /NONE coverage \(coverage only, never low confidence\)/u);
  assert.match(smokeScript, /exactly one pending TURN_FINALIZED outbox event for the source turn/u);
});

test('the second-turn Memory/HIM/Hypothesis/Recommendation consumption assertions are present', () => {
  assert.match(smokeScript, /background-created Memory is consumed by the next real foreground orchestration/u,
    'the central acceptance condition is asserted');
  assert.match(smokeScript, /second request still consumes the real session HIM snapshot/u);
  assert.match(smokeScript, /seeded hypothesis is now current version 2/u);
  assert.match(smokeScript, /generated hypothesis is lifecycle-current\/active for reasoning/u);
  assert.match(smokeScript, /exact-current Confidence targets the exact current version and stays null\/UNCALIBRATED/u);
  assert.match(smokeScript, /FULL coverage \(never confidence strength\) with the canonical actionable missing-information set/u);
  assert.match(smokeScript, /'UNVERIFIED_ASSUMPTIONS'\]/u, 'the exact canonical actionable set is asserted');
  assert.match(smokeScript, /previous completed USER \+ ASSISTANT turns and the new USER turn in order/u);
  assert.match(smokeScript, /central guidance carries the Memory block/u);
  assert.match(smokeScript, /the Turn #2 event stays pending — no second background cycle runs/u);
});

test('automatic Question Candidates remain zero and duplicate delivery stays a no-op', () => {
  assert.match(smokeScript, /automatic question_candidates count remains exactly zero/u);
  assert.match(smokeScript, /foreground created no Question Candidate/u);
  assert.match(smokeScript, /duplicate dispatch resolves terminally/u);
  assert.match(smokeScript, /durable receipts\/results remain stable after duplicate/u);
  assert.match(smokeScript, /no duplicate Memory, Hypothesis version advance, generated Hypothesis, Confidence, Information Gap or execution/u);
});

test('verifier output is bounded and privacy-safe', () => {
  assert.doesNotMatch(smokeScript,
    /console\.(?:log|error)\([^\n]*(?:SOURCE_TURN_TEXT|SECOND_TURN_TEXT|ASSISTANT_TURN_TEXT|STATEMENT|ASSUMPTION|serverGuidance|\.content|envelope|payload|process\.env)/u,
    'no conversation text, Memory content, Hypothesis statement, guidance, payload or environment value is printed');
  assert.match(smokeScript, /Full Intelligence End-to-End Runtime: PASS/u, 'the bounded success line exists');
});

test('production modules never import the Full Intelligence smoke harness', async () => {
  const sources = await listProductionSources(new URL('apps/api/src/', root));
  assert.ok(sources.length > 100, 'production sources were actually scanned');
  for (const source of sources) {
    assert.doesNotMatch(source, /full-intelligence-e2e-smoke|verify-full-intelligence-end-to-end-runtime/u,
      'a production module references the smoke harness');
  }
});
