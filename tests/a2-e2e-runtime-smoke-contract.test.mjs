// Static contract for the A2 End-to-End Runtime Smoke v1.
//
// Lightweight drift guards only: the authoritative proof is the runtime smoke
// itself (verify:a2-e2e-runtime-smoke) against real PostgreSQL 17 + Redis 7 in
// CI. These assertions keep the smoke wired, keep production isolated from the
// smoke-only transport adapters, and keep the no-paid-provider guarantees
// checkable without infrastructure.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const apiCi = await readFile(new URL('.github/workflows/api-ci.yml', root), 'utf8');
const smokeScript = await readFile(new URL('apps/api/scripts/verify-a2-end-to-end-runtime-smoke.ts', root), 'utf8');
const providerDoubles = await readFile(new URL('apps/api/scripts/a2-e2e-smoke/deterministic-providers.ts', root), 'utf8');
const smokeDirectory = new URL('apps/api/scripts/a2-e2e-smoke/', root);
const smokeFiles = await Promise.all(
  (await readdir(smokeDirectory)).map((name) => readFile(new URL(name, smokeDirectory), 'utf8')),
);
const smokeSources = [smokeScript, ...smokeFiles].join('\n');

async function listProductionSources(directory) {
  const base = fileURLToPath(directory);
  const entries = await readdir(base, { withFileTypes: true, recursive: true });
  return Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => readFile(join(entry.parentPath ?? base, entry.name), 'utf8')));
}

test('the smoke command exists and CI invokes it exactly once, after the Redis dispatch verifier', () => {
  const command = packageJson.scripts['verify:a2-e2e-runtime-smoke'];
  assert.equal(typeof command, 'string', 'missing verify:a2-e2e-runtime-smoke');
  assert.match(command, /--env-file-if-exists=\.env/u, 'CI-provided configuration must work without a physical .env');
  assert.match(command, /ts-node/u);
  assert.match(command, /apps\/api\/scripts\/verify-a2-end-to-end-runtime-smoke\.ts/u);
  assert.equal(typeof packageJson.scripts['test:a2-e2e-smoke-contract'], 'string', 'missing test:a2-e2e-smoke-contract');

  const invocations = apiCi.match(/run: npm run verify:a2-e2e-runtime-smoke/gu) ?? [];
  assert.equal(invocations.length, 1, 'CI invokes the runtime smoke exactly once');
  const smokeIndex = apiCi.indexOf('run: npm run verify:a2-e2e-runtime-smoke');
  assert.ok(smokeIndex > apiCi.indexOf('run: npm run verify:hypothesis-update-auto-invocation:integration'),
    'runtime smoke runs after the migration 0034 verifier');
  assert.ok(smokeIndex > apiCi.indexOf('run: npm run verify:confidence-batch-reliability:integration'),
    'runtime smoke runs after the migration 0035 verifier');
  assert.ok(smokeIndex > apiCi.indexOf('run: npm run verify:hypothesis-lifecycle-completion:integration'),
    'runtime smoke runs after the migration 0036 verifier');
  assert.ok(smokeIndex > apiCi.indexOf('run: npm run verify:post-response-dispatch:integration'),
    'runtime smoke runs after the Redis Streams dispatch verifier');
  assert.match(apiCi, /run: npm run test:a2-e2e-smoke-contract/u, 'CI runs this static contract');
});

test('CI runs the migration 0036 verifier once, after 0035 and before the Redis and A2 E2E stages', () => {
  const invocations = apiCi.match(/run: npm run verify:hypothesis-lifecycle-completion:integration/gu) ?? [];
  assert.equal(invocations.length, 1, 'CI invokes the lifecycle completion verifier exactly once');
  const lifecycleIndex = apiCi.indexOf('run: npm run verify:hypothesis-lifecycle-completion:integration');
  assert.ok(lifecycleIndex > apiCi.indexOf('run: npm run verify:confidence-batch-reliability:integration'),
    'the lifecycle completion verifier runs after the migration 0035 verifier');
  assert.ok(lifecycleIndex < apiCi.indexOf('run: npm run verify:post-response-dispatch:integration'),
    'the lifecycle completion verifier runs before the Redis Streams dispatch verifier');
  assert.equal(typeof packageJson.scripts['verify:hypothesis-lifecycle-completion:integration'], 'string');
  assert.match(packageJson.scripts['verify:hypothesis-lifecycle-completion:integration'],
    /^node --env-file-if-exists=\.env database\/verify-migration-0036\.mjs$/u);
});

test('the canonical migration chain ends at the Background HIM Runtime Consumption forward migration 0037', async () => {
  const migrations = (await readdir(new URL('database/migrations/', root))).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), '0037_background_him_runtime_consumption_v1.sql');
  assert.ok(migrations.includes('0036_hypothesis_lifecycle_completion_v1.sql'), 'migration 0036 remains untouched in the chain');
  assert.equal(migrations.some((name) => name.startsWith('0038')), false, 'no migration 0038');
});

test('the smoke proves minimized HIM consumption on the fresh generation path', () => {
  assert.match(smokeScript, /create_hse_stress_measurement\('CONVERSATION_SESSION'/u,
    'session HIM state is seeded through the canonical measurement path, never a raw noncanonical row');
  assert.match(smokeScript, /calculate_hse_stress_measurement/u, 'the canonical calculation path produces the assessed state');
  assert.match(smokeScript, /HIM_STRUCTURED_STATE/u, 'the exact minimized provider-facing HIM contract is asserted');
  assert.match(smokeScript, /provider-facing HIM context is the exact minimized partial-state contract/u);
  assert.match(smokeScript, /no user UUID in the provider-facing HIM context/u);
  assert.match(smokeScript, /exactly one canonical background HIM snapshot read/u);
  assert.match(smokeScript, /zero HIM re-consumption after durable Candidate completion/u,
    'duplicate delivery proves zero HIM reread alongside zero provider replay');
  assert.match(smokeSources, /background_read_him_conversation_snapshot_v1/u,
    'the smoke transport uses the migration 0037 service-role wrapper, not a direct HIM table read');
});

test('the smoke proves the generated Candidate -> Active admission and its ACTIVE-version Confidence', () => {
  assert.match(smokeScript, /public\.hypothesis_lifecycle_transitions/u, 'the immutable lifecycle audit is observed');
  assert.match(smokeScript, /SYSTEM_GENERATION_ACTIVATION/u, 'the bounded activation source is asserted');
  assert.match(smokeScript, /the generated Hypothesis is durably ACTIVE by the time HYPOTHESIS_PERSISTENCE is completed/u);
  assert.match(smokeScript, /exactly one CANDIDATE -> ACTIVE lifecycle audit for the generated target/u);
  assert.match(smokeScript, /no generated Confidence receipt refers to the pre-activation Candidate version/u);
  assert.match(smokeScript, /durable lifecycle audit rows byte-equivalent after duplicate/u,
    'duplicate delivery proves zero duplicate lifecycle transition or audit row');
  assert.match(smokeScript, /Evidence attachment produced no lifecycle transition on the seeded Hypothesis/u,
    'Evidence attachment is proven not to be a lifecycle decision');
});

test('the smoke proves the managed typed Confidence batch rather than a generic result-less effect', () => {
  assert.match(smokeScript, /CONFIDENCE_BATCH_EVALUATED/u, 'the typed durable Confidence result is asserted');
  assert.doesNotMatch(smokeScript, /CONFIDENCE_BATCH stays the generic result-less effect/u,
    'the old generic Confidence assertion is gone');
  assert.match(smokeScript, /public\.post_response_confidence_batch_items/u, 'the durable item plan is observed');
  assert.match(smokeScript, /the receipt points at the exact generated Confidence evaluation/u);
  assert.match(smokeScript, /durable Confidence batch items byte-equivalent after duplicate/u,
    'duplicate delivery proves zero item or Confidence mutation');
});

test('production modules never import the smoke-only transport adapters', async () => {
  const sources = await listProductionSources(new URL('apps/api/src/', root));
  assert.ok(sources.length > 100, 'production sources were actually scanned');
  for (const source of sources) {
    assert.doesNotMatch(source, /a2-e2e-smoke|scripts\/verify-a2-end-to-end-runtime-smoke/u,
      'a production module references the smoke harness');
  }
});

test('the smoke seals the external HTTP boundary and exercises the real A2 runtime classes', () => {
  assert.match(smokeScript, /A2_E2E_EXTERNAL_HTTP_FORBIDDEN/u, 'global fetch guard present');
  assert.match(smokeScript, /globalThis\.fetch/u);
  for (const productionClass of [
    'RuntimeEventPublisher',
    'RedisStreamsTransport',
    'RedisPostResponseConsumer',
    'PostResponseIntelligenceDispatcherService',
    'BackgroundIntelligenceAuthorityService',
    'BackgroundIntelligenceEnrichmentService',
    'ModelAssistedHypothesisAssociationService',
    'HypothesisGenerationIntentExtractionService',
    'HypothesisGenerationIntentAuthorityService',
    'HypothesisGenerationRequestAssemblerService',
    'HypothesisGenerationTriggerClassificationService',
    'MemoryWriteEvaluatorService',
    'HypothesisEvidenceAssociationAuthorityService',
  ]) assert.match(smokeScript, new RegExp(`\\b${productionClass}\\b`, 'u'), `real ${productionClass} is exercised`);
  assert.match(smokeScript, /processOnce\(\)/u, 'the real publisher cycle is invoked');
});

test('provider boundaries are deterministic in-process doubles with call counters — no provider key, no paid call', () => {
  for (const double of [
    'DeterministicAssociationProposalProvider',
    'DeterministicIntentExtractionProvider',
    'DeterministicCandidateGenerator',
  ]) {
    assert.match(providerDoubles, new RegExp(`export class ${double}`, 'u'), `missing ${double}`);
    assert.match(smokeScript, new RegExp(`\\b${double}\\b`, 'u'), `smoke uses ${double}`);
  }
  assert.match(providerDoubles, /callCount/u, 'doubles expose invocation counters');
  assert.doesNotMatch(smokeSources, /process\.env\.(?:ANTHROPIC|OPENAI|GEMINI|GOOGLE|XAI|MISTRAL)[A-Z_]*/u,
    'no provider API key is read by the smoke');
  assert.doesNotMatch(smokeSources, /process\.env\.[A-Z_]*API_KEY/u, 'no API key of any kind is required');
});
