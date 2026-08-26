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
  assert.ok(smokeIndex > apiCi.indexOf('run: npm run verify:post-response-dispatch:integration'),
    'runtime smoke runs after the Redis Streams dispatch verifier');
  assert.match(apiCi, /run: npm run test:a2-e2e-smoke-contract/u, 'CI runs this static contract');
});

test('the canonical migration chain still ends at 0034 — this task adds no migration 0035', async () => {
  const migrations = (await readdir(new URL('database/migrations/', root))).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), '0034_automatic_hypothesis_update_invocation_recovery_v1.sql');
  assert.equal(migrations.some((name) => name.startsWith('0035')), false, 'no migration 0035');
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
