// PROD-SEC-02 - static source contract for the turn admission concurrency & cost bound.
//
// Real behaviour is proven by database/verify-migration-0131.mjs (PostgreSQL) and the API specs. This contract pins
// the shape that a refactor could silently erode: every foreground provider checks the request deadline before it
// opens a provider request and outside the block that would wrap the refusal as a provider outage; nothing races a
// timer against provider work; the bound lives in migration 0131 under one per-user lock; the application carries
// no limit and cannot widen the deadline past the database work lease; and the verifier is registered in CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
/** Source without comments, so a rule about code is never tripped by prose that explains the rule. */
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

// The reply routers carry the guard themselves; the four semantic providers are frozen byte-identical by their own
// contracts, so they are guarded at the binding seam the semantic chain already uses.
const REPLY_ROUTERS = [
  ['apps/api/src/model-router/providers/openai/openai-model-router.ts', 'this.client.responses.create('],
  ['apps/api/src/model-router/providers/anthropic/claude-model-router.ts', 'this.client.messages.create('],
];
const SEMANTIC_BINDINGS = [
  ['CU_SEGMENTATION_BINDING_FACTORY', 'openAiSegmentationBinding'],
  ['FOCUS_RESOLUTION_BINDING_FACTORY', 'openAiFocusResolutionBinding()'],
  ['THREAD_ESTABLISHMENT_BINDING_FACTORY', 'openAiThreadEstablishmentBinding()'],
  ['THREAD_CONTINUITY_BINDING_FACTORY', 'openAiThreadContinuityBinding()'],
];
const FROZEN_SEMANTIC_PROVIDERS = [
  'apps/api/src/conversation-unit/openai-cu-segmentation.provider.ts',
  'apps/api/src/conversational-focus/openai-focus-resolution.provider.ts',
  'apps/api/src/thread-lifecycle/openai-thread-continuity.provider.ts',
  'apps/api/src/thread-establishment/openai-thread-establishment.provider.ts',
];

test('every foreground provider is reached only behind the deadline check', () => {
  for (const [file, call] of REPLY_ROUTERS) {
    const source = read(file);
    const callAt = source.indexOf(call);
    const guardAt = source.indexOf('assertForegroundProviderBudget();');
    assert.ok(callAt > 0, `${file} still opens its provider request through ${call}`);
    assert.ok(guardAt > 0 && guardAt < callAt, `${file} checks the deadline before the provider request`);
    assert.ok(source.lastIndexOf('try {', callAt) > guardAt, `${file} checks the deadline OUTSIDE the try that maps provider failures`);
  }
  const module = code('apps/api/src/conversation/conversation.module.ts');
  for (const [token, factory] of SEMANTIC_BINDINGS) {
    const escaped = factory.replace(/[()]/gu, '\\$&');
    assert.match(module, new RegExp(`provide: ${token}, useValue: guardForegroundBinding\\(${escaped}\\)`, 'u'), `${token} is guarded`);
  }
  for (const file of FROZEN_SEMANTIC_PROVIDERS) {
    assert.doesNotMatch(read(file), /foreground-turn-work|assertForegroundProviderBudget/u, `${file} stays untouched`);
  }
});
test('the deadline stops new calls only: no timer is raced against provider work, and it cannot outlive the work lease', () => {
  const scope = read('apps/api/src/conversation/foreground-turn-work.ts');
  assert.doesNotMatch(scope, /Promise\.race|setTimeout|AbortController/u, 'the scope never races or aborts work');
  const max = Number(/FOREGROUND_TURN_WORK_DEADLINE_MAX_MS = ([0-9_]+);/u.exec(scope)?.[1].replace(/_/gu, ''));
  const fallback = Number(/FOREGROUND_TURN_WORK_DEADLINE_DEFAULT_MS = ([0-9_]+);/u.exec(scope)?.[1].replace(/_/gu, ''));
  assert.ok(max > 0 && max <= 120_000 - 20_000, 'the deadline ceiling leaves room inside the 120-second work lease');
  assert.ok(fallback > 0 && fallback <= max);
  // The lease length is the database's, never the application's.
  const migration = read('database/migrations/0131_turn_admission_concurrency_cost_bound_v1.sql');
  assert.match(migration, /CURRENT_TIMESTAMP \+ public\.foreground_generation_lease_interval_v1\(\)\);/u);
  assert.doesNotMatch(code('apps/api/src/conversation/conversation-turn-work.repository.ts'), /\binterval\b|\bseconds?\b|\bexpires|\blimit\b|\b[0-9]{3,}\b/u,
    'the application sends identities only - no duration, limit or clock');
});

test('migration 0131 owns the bound: same admission signature, one per-user lock, one typed refusal, no application override', () => {
  const migration = read('database/migrations/0131_turn_admission_concurrency_cost_bound_v1.sql');
  assert.match(migration, /^-- PROD-SEC-02/u);
  assert.match(migration, /^BEGIN;$/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.create_user_conversation_turn\(\n  p_id uuid, p_session_id uuid, p_content text, p_idempotency_key text DEFAULT NULL\n\) RETURNS SETOF public\.conversation_turns/u);
  assert.equal((migration.match(/pg_advisory_xact_lock/gu) ?? []).length, 1, 'exactly one lock definition');
  assert.match(migration, /'qandeel\.conversation-turn-admission\.v1:' \|\| p_user_id::text/u, 'the lock is keyed by the user only');
  assert.equal((migration.match(/ERRCODE='PT429'/gu) ?? []).length, 1, 'exactly one refusal path');
  assert.doesNotMatch(migration, /current_setting|request\.header|p_limit|p_window|p_quota/iu, 'no caller, header or setting can choose a limit');
  assert.doesNotMatch(migration, /DELETE FROM public\.conversation_turns|UPDATE public\.conversation_turns/u, 'no canonical turn is deleted or rewritten to free a slot');
  assert.match(migration, /REFERENCES public\.conversation_turns\(id\) ON DELETE CASCADE/u, 'lease state goes with its turn');
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.begin_conversation_turn_work_v1\(uuid,uuid,uuid\) TO service_role;/u);
  assert.doesNotMatch(migration, /GRANT [^;]*TO (?:anon|authenticated)[^;]*work_v1/u, 'no client role may take or return a work lease');
});

test('the refusal is typed only where nothing was committed, and the verifier is registered in CI', () => {
  const service = read('apps/api/src/conversation/conversation.service.ts');
  assert.match(service, /export const TURN_ADMISSION_LIMITED = 'TURN_ADMISSION_LIMITED';/u);
  assert.match(service, /identity\.databaseCode === 'PT429' && identity\.databaseMessage === TURN_ADMISSION_LIMITED/u);
  assert.match(service, /HttpStatus\.TOO_MANY_REQUESTS/u);
  const orchestrator = code('apps/api/src/conversation/conversation-orchestrator.service.ts');
  const gateAt = orchestrator.indexOf('enterForegroundTurnWork(userTurn.session_id, userTurn.id)');
  assert.ok(gateAt > 0 && gateAt < orchestrator.indexOf('this.repository.claimTurn('), 'the work lease is taken before the claim');
  assert.doesNotMatch(orchestrator, /TOO_MANY_REQUESTS|429/u, 'a committed turn is never answered as "not admitted"');
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['verify:turn-admission-cost-bound:integration'], 'node --env-file-if-exists=.env database/verify-migration-0131.mjs');
  assert.equal(pkg.scripts['test:prod-sec-02-turn-admission-cost-bound-contract'], 'node --test tests/prod-sec-02-turn-admission-cost-bound-contract.test.mjs');
  const ci = read('.github/workflows/api-ci.yml');
  assert.match(ci, /run: npm run verify:turn-admission-cost-bound:integration/u);
  assert.match(ci, /npm run test:prod-sec-02-turn-admission-cost-bound-contract/u);
});
