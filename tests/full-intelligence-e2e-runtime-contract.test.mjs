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

test('the canonical migration chain still ends at 0038 with no migration 0039', async () => {
  const migrations = (await readdir(new URL('database/migrations/', root))).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), '0038_information_gap_question_integration_v1.sql');
  assert.equal(migrations.some((name) => name.startsWith('0039')), false, 'no migration 0039');
  assert.doesNotMatch(smokeSources, /0039/u, 'no migration 0039 reference');
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
