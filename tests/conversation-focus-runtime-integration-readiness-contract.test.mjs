// T-03B1b2 - Focus Runtime Orchestration + Activation Readiness: the static
// anti-scope contract.
//
// Secret-free and CI-runnable. Behaviour is proven by the Jest suites under
// apps/api/src/conversational-focus and the real-PostgreSQL 0067 verifier.
// This contract guards the SHAPE across the repository, above all
// AC-B1B2-01: the B1 runtime exists, is fully executable with fakes, and is
// NOT live - nothing is granted, nothing is revoked, nothing is registered,
// and the T-03A2 production path is byte-for-byte untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const stripSql = (text) => text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
function gitBlobId(content) {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}
const relative = (file) => file.slice(rootPath.length).replace(/^[\\/]/u, '').replace(/\\/gu, '/');

const FOCUS_DIR = 'apps/api/src/conversational-focus';
const migration = read('database/migrations/0067_conversation_focus_runtime_integration_readiness_v1.sql');
const executable = stripSql(migration);
const service = stripComments(read(`${FOCUS_DIR}/conversation-focus-establishment.service.ts`));
const repository = stripComments(read(`${FOCUS_DIR}/conversation-focus-runtime.repository.ts`));
const mapper = stripComments(read(`${FOCUS_DIR}/conversation-focus-runtime-mapper.ts`));
const runtimeTypes = stripComments(read(`${FOCUS_DIR}/conversation-focus-runtime.types.ts`));
const binding = stripComments(read(`${FOCUS_DIR}/focus-resolution-binding.ts`));
const runtimeCode = [service, repository, mapper, runtimeTypes, binding].join('\n');
const dataApi = stripComments(read('apps/api/src/conversation/supabase-data-api.service.ts'));
const serviceRoleApi = stripComments(read('apps/api/src/conversation/supabase-service-role-api.service.ts'));
const conversationModule = read('apps/api/src/conversation/conversation.module.ts');
const conversationService = read('apps/api/src/conversation/conversation.service.ts');
const establishment = read('apps/api/src/conversation-unit/conversation-temporal-establishment.service.ts');
const unitRepository = read('apps/api/src/conversation-unit/conversation-unit.repository.ts');
const migration0065 = read('database/migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql');
const rootPackage = readJson('package.json');
const apiPackage = readJson('apps/api/package.json');
const apiCi = read('.github/workflows/api-ci.yml');
const mobileCi = read('.github/workflows/mobile-ci.yml');

test('migration 0067 exists, is the newest, and 0064 / 0065 / 0066 keep their exact pins', () => {
  const migrations = readdirSync(join(rootPath, 'database/migrations')).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), '0067_conversation_focus_runtime_integration_readiness_v1.sql');
  assert.equal(gitBlobId(read('database/migrations/0064_committed_conversational_unit_substrate_v1.sql')), '0a2ee63980e59072b3e9f52a643efa8220e95b08');
  assert.equal(gitBlobId(read('database/migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql')), '3dc061c71bcb237cec648abb2d1fa02f450cd57f');
  assert.equal(gitBlobId(read('database/migrations/0066_durable_reference_emerging_focus_sp_substrate_v1.sql')), '9f0588d5ca46329a8721ee30302f49d227a357ae');
  assert.ok(existsSync(new URL('database/verify-migration-0067.mjs', root)));
  assert.ok(existsSync(new URL('database/tests/conversation-focus-runtime-integration-readiness-v1.test.mjs', root)));
});

test('the runtime orchestration service, repository, mapper and lazy binding exist and are plain classes', () => {
  for (const name of ['conversation-focus-runtime.types.ts', 'conversation-focus-runtime.repository.ts', 'conversation-focus-runtime-mapper.ts',
    'conversation-focus-establishment.service.ts', 'focus-resolution-binding.ts', 'conversation-focus-establishment.service.spec.ts']) {
    assert.ok(existsSync(new URL(`${FOCUS_DIR}/${name}`, root)), `${name} exists`);
  }
  assert.match(service, /export class ConversationFocusEstablishmentService \{/u);
  assert.match(repository, /export class ConversationFocusRuntimeRepository implements ConversationFocusRuntimeBoundary \{/u);
  assert.doesNotMatch(runtimeCode, /@Injectable\(|@Module\(|@Controller\(|from '@nestjs\//u, 'no Nest decorator and no Nest import anywhere in the runtime');
  assert.match(service, /constructor\(\s*private readonly repository: ConversationFocusRuntimeBoundary,\s*private readonly createSegmentationBinding: CuSegmentationBindingFactory,\s*private readonly createFocusBinding: FocusResolutionBindingFactory,\s*\)/u);
  assert.match(service, /async establish\(userId: string, result: OrchestratedTurnResult\): Promise<OrchestratedTurnResult>/u, 'the same entry shape as T-03A2');
  assert.match(service, /return \{ liveHead, committedEvents: ordered \};/u, 'the same external temporal delivery shape');
});

test('AC-B1B2-01: the B1 runtime is NOT live - not registered, not called, nothing granted, nothing revoked', () => {
  // Not imported or registered by ConversationModule; ConversationService still calls the canonical T-03A2 temporal service.
  assert.doesNotMatch(stripComments(conversationModule), /conversational-focus|ConversationFocusEstablishmentService|ConversationFocusRuntimeRepository|focus|Focus/u);
  assert.doesNotMatch(stripComments(conversationService), /conversational-focus|ConversationFocusEstablishmentService|focus|Focus/u);
  assert.match(conversationService, /private readonly temporal: ConversationTemporalEstablishmentService/u);
  assert.match(conversationService, /return this\.establishTemporal\(userId, await this\.orchestrator\.orchestrate\(/u);
  assert.match(conversationModule, /ConversationTemporalEstablishmentService/u);
  // The T-03A2 establishment service and unit repository are untouched by this slice.
  assert.doesNotMatch(stripComments(establishment), /with_focus|conversational-focus|Focus/u);
  assert.match(unitRepository, /'commit_finalized_exchange_conversation_units_v1'/u, 'the live runtime still commits through the T-03A2 coordinator');
  // No file outside the directory reaches the runtime.
  const referencing = listFiles(join(rootPath, 'apps/api/src')).map(relative)
    .filter((file) => !file.startsWith(`${FOCUS_DIR}/`))
    // T-03B2a (thread-establishment, production-inert) consumes ONLY the pure
    // B1 TYPE authorities; it is pinned separately just below.
    .filter((file) => !file.startsWith('apps/api/src/thread-establishment/'))
    .filter((file) => /ConversationFocusEstablishmentService|ConversationFocusRuntimeRepository|conversational-focus|with_focus_v1|integrated_batch_snapshot|cutover_ready/u.test(stripComments(read(file))));
  assert.deepEqual(referencing, []);
  // The T-03B2a evaluator never reaches the B1 runtime orchestration, its
  // repository, the 0066/0067 RPCs or the lazy provider binding.
  const threadFiles = listFiles(join(rootPath, 'apps/api/src/thread-establishment')).map(relative);
  assert.ok(threadFiles.length > 0, 'the T-03B2a directory exists');
  for (const file of threadFiles) {
    const source = read(file);
    for (const match of source.matchAll(/from\s+'([^']*conversational-focus[^']*)'/gu)) {
      assert.ok(['../conversational-focus/conversational-focus.types', '../conversational-focus/durable-focus-payload.types'].includes(match[1]),
        `${file} may import only the B1 type authorities; found ${match[1]}`);
    }
    assert.doesNotMatch(stripComments(source), /ConversationFocusEstablishmentService|ConversationFocusRuntimeRepository|with_focus_v1|integrated_batch_snapshot|cutover_ready|focus-resolution-binding|conversation-focus-runtime|conversation-focus-establishment/u,
      `${file} does not reach the T-03B1b2 runtime`);
  }
  // Database: nothing granted, nothing revoked, no semantic write.
  assert.doesNotMatch(executable, /GRANT /u);
  for (const fn of ['commit_conversation_units_with_focus_v1', 'commit_finalized_exchange_with_focus_v1', 'get_conversation_focus_runtime_context_v1', 'get_conversation_integrated_batch_snapshot_v1']) {
    assert.doesNotMatch(executable, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}`, 'u'));
  }
  assert.doesNotMatch(executable, /REVOKE [^;]*(?:commit_conversation_units_v1|commit_finalized_exchange_conversation_units_v1|get_conversation_unit_commit_batch_snapshot_v1)\(/u, 'no legacy writer revocation');
  assert.match(migration0065, /GRANT EXECUTE ON FUNCTION public\.commit_finalized_exchange_conversation_units_v1\([^)]*\) TO service_role/u, 'the T-03A2 service-role writer grant remains');
  assert.doesNotMatch(stripSql(migration.slice(0, migration.indexOf('-- 4. Terminal self-assertions'))), /INSERT INTO|UPDATE public|DELETE FROM|TRUNCATE/u, 'no semantic backfill, update or delete');
  assert.match(migration, /T-03B1b2 performs no cutover/u);
  assert.match(migration, /T-03D owns the final semantic-chain\s*\n?-- authority cutover|T-03D owns the final semantic-chain/u, 'live cutover explicitly deferred to the full same-SP semantic chain');
  assert.match(read(`${FOCUS_DIR}/conversation-focus-establishment.service.ts`), /T-03D performs the final cutover/u);
});

test('no Thread / LF / T-03C scope, no mobile change, no new dependency', () => {
  for (const forbidden of ['ThreadEstablished', 'threadId', 'Thread(', 'homeSp', 'lifecycle', 'LIVE_FOCUS', 'liveFocus', 'live_focus_transitions',
    'LIVE_FOCUS_TRANSITION', 'knowledgeFrontier', 'PRE_FIRST_SP', 'historical', 'focus_enabled', 'analysis_enabled', 'semantic_version',
    'timeline', 'Timeline', 'WORLD_ANCHOR', 'MapState', 'projection', 'expo-router', 'react-native', 'apps/mobile']) {
    assert.equal(runtimeCode.includes(forbidden), false, `the runtime must not contain ${forbidden}`);
  }
  assert.doesNotMatch(runtimeCode, /score|embedding|similarity|keyword|setInterval|Date\.now|new Date/iu);
  assert.doesNotMatch(mobileCi, /0067|runtime-integration-readiness/u);
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3);
  for (const file of listFiles(join(rootPath, 'apps/mobile/src')).map(relative)) {
    assert.doesNotMatch(read(file), /with_focus_v1|focus_runtime_context|integrated_batch_snapshot|cutover_ready|ConversationFocus/u, `${file} untouched`);
  }
  assert.deepEqual(Object.keys(rootPackage.devDependencies), ['pg']);
  for (const name of ['uuid', 'zod', 'p-retry', 'async-retry', 'retry', 'bottleneck']) {
    assert.equal(name in (apiPackage.dependencies ?? {}) || name in (apiPackage.devDependencies ?? {}), false, `${name} must not be introduced`);
  }
});

test('the focus provider binding is lazy and never runs at construction, replay, invalid exchange or partial history', () => {
  assert.match(binding, /export function openAiFocusResolutionBinding\(environment: NodeJS\.ProcessEnv = process\.env\): FocusResolutionBindingFactory \{\s*return \(\) => \{\s*const config = loadFocusResolutionOpenAIConfig\(environment\);/u);
  assert.match(service, /this\.focus \?\?= this\.createFocusBinding\(\);/u);
  assert.match(service, /this\.segmentation \?\?= this\.createSegmentationBinding\(\);/u);
  // The factory is referenced exactly once, inside evaluateFocus, which runs
  // only after the snapshots (replay / partial gate) and the context read.
  assert.equal((service.match(/this\.createFocusBinding\(\)/gu) ?? []).length, 1);
  const constructorEnd = service.indexOf('async establish(');
  assert.doesNotMatch(service.slice(0, constructorEnd), /createFocusBinding\(\)|createSegmentationBinding\(\)|process\.env/u, 'construction reads no environment and builds no provider');
  assert.ok(service.indexOf('const replayed = this.canonicalDelivery(snapshots);') < service.indexOf('await this.repository.readRuntimeContext('),
    'the replay / partial gate precedes the context read');
  assert.ok(service.indexOf('await this.repository.readRuntimeContext(') < service.indexOf('this.segment(userId, userTurn'), 'the context is read before any provider');
  assert.doesNotMatch(runtimeCode, /OPENAI_API_KEY|process\.env\./u, 'no ambient credential read in the runtime');
});

test('stale retry is bounded to one, segmentation is reused, and only the exact typed stale error enters the branch', () => {
  assert.match(runtimeTypes, /export const MAX_STALE_CONTEXT_RETRIES = 1;/u);
  assert.match(service, /let retriesLeft = MAX_STALE_CONTEXT_RETRIES;/u);
  assert.match(service, /if \(!\(error instanceof StaleConversationalFocusContextError\)\) throw error;/u);
  assert.match(service, /if \(retriesLeft === 0\) throw new ConversationFocusEstablishmentUnavailableError\('STALE_CONTEXT_RETRY_EXHAUSTED'/u);
  assert.match(service, /retriesLeft -= 1;/u);
  // The winner check precedes the stale branch, and segmentation happens once, before the loop.
  const loop = service.indexOf('for (;;) {');
  assert.ok(service.indexOf('const halves = await Promise.all([userHalf, assistantHalf]);') < loop, 'segmentation happens once, before the retry loop');
  assert.ok(service.indexOf('const winner = this.canonicalDelivery(', loop) < service.indexOf('if (!(error instanceof StaleConversationalFocusContextError)) throw error;', loop));
  assert.doesNotMatch(service.slice(loop), /this\.segment\(/u, 'no segmentation inside the retry loop');
  assert.match(service, /SEGMENTATION_FRONTIER_MOVED/u, 'a moved frontier refuses segmentation reuse');
  // FIX-T03B1B2-01: the repository maps ONLY 40001 whose message EQUALS the
  // token. Containment, regex, case folding or normalization would read a
  // negation, a longer token or a wrapped relay as the stale condition.
  assert.match(repository, /return databaseCode === STALE_CONVERSATIONAL_FOCUS_CONTEXT_SQLSTATE\s*&& databaseMessage === STALE_CONVERSATIONAL_FOCUS_CONTEXT_TOKEN;/u);
  assert.match(repository, /export const STALE_CONVERSATIONAL_FOCUS_CONTEXT_SQLSTATE = '40001';/u);
  assert.match(repository, /export const STALE_CONVERSATIONAL_FOCUS_CONTEXT_TOKEN = 'STALE_CONVERSATIONAL_FOCUS_CONTEXT';/u);
  assert.doesNotMatch(repository, /databaseMessage\.(?:includes|startsWith|endsWith|match|indexOf|search|toLowerCase|toUpperCase|trim|normalize)\(/u,
    'the stale message is compared by equality alone, never by containment or normalization');
  assert.doesNotMatch(repository, /new RegExp|\/STALE_CONVERSATIONAL_FOCUS_CONTEXT\//u, 'no regex matching of the stale token');
  // The proof enumerates the near-miss messages that must NOT be stale.
  const repositorySpec = read(`${FOCUS_DIR}/conversation-focus-runtime.repository.spec.ts`);
  for (const nearMiss of ['NOT_STALE_CONVERSATIONAL_FOCUS_CONTEXT', 'STALE_CONVERSATIONAL_FOCUS_CONTEXT_BUT_DIFFERENT_CONDITION',
    'STALE_CONVERSATIONAL_FOCUS_CONTEXT_OTHER', 'wrapped: STALE_CONVERSATIONAL_FOCUS_CONTEXT', 'stale_conversational_focus_context',
    'could not serialize access due to concurrent update']) {
    assert.ok(repositorySpec.includes(nearMiss), `the stale proof covers: ${nearMiss}`);
  }
});

test('FIX-T03B1B2-02: claimed snapshot completeness is proven from the row, never trusted', () => {
  // An absent commitment batch carries no coordinates and no B1 half at all.
  assert.match(mapper, /if \(!row\.batch_exists && \(row\.committed_unit_count !== 0 \|\| row\.commit_event !== null\s*\n?\s*\|\| row\.focus_batch_exists \|\| row\.focus_semantic_count !== 0 \|\| row\.focus_attention_count !== 0 \|\| row\.focus_complete\)\) return reject\(\);/u);
  // Without a focus batch there is nothing to count and nothing to complete.
  assert.match(mapper, /if \(!row\.focus_batch_exists && \(row\.focus_semantic_count !== 0 \|\| row\.focus_attention_count !== 0 \|\| row\.focus_complete\)\) return reject\(\);/u);
  // The RPC counts only AGREEING rows, so a count above the committed count is malformed transport.
  assert.match(mapper, /if \(row\.focus_semantic_count > row\.committed_unit_count \|\| row\.focus_attention_count > row\.committed_unit_count\) return reject\(\);/u);
  // A claimed completeness must be provable from the counts in the same row.
  assert.match(mapper, /if \(row\.focus_complete && !\(row\.batch_exists && row\.focus_batch_exists\s*\n\s*&& row\.focus_semantic_count === row\.committed_unit_count\s*\n\s*&& row\.focus_attention_count === row\.committed_unit_count\)\) return reject\(\);/u);
  // An honest incomplete row stays representable: never repaired, never made absent.
  assert.doesNotMatch(mapper, /focus_complete: (?:true|false)\b|focus_complete = |focus_semantic_count = |focus_attention_count = /u,
    'the mapper never rewrites completeness or the counts');
  assert.match(mapper, /focus_complete: row\.focus_complete,/u, 'the transported flag is returned as given once it is proven');
  const mapperSpec = read(`${FOCUS_DIR}/conversation-focus-runtime-mapper.spec.ts`);
  for (const proof of ['accepts a complete non-zero snapshot and a complete ZERO-CU snapshot',
    'rejects every claimed completeness the counts in the same row do not support',
    'keeps an honest incomplete snapshot representable', 'no focus batch but a non-zero semantic count',
    'no focus batch but claimed complete', 'semantic count above the committed count', 'attention count above the committed count',
    'claimed complete with a semantic shortfall', 'claimed complete with an attention shortfall',
    'the review finding verbatim: two CUs, zero B1 rows, claimed complete']) {
    assert.ok(mapperSpec.includes(proof), `the snapshot-coherence proof covers: ${proof}`);
  }
  // And the service-level proof: an incoherent claimed-complete row cannot become replay.
  const serviceSpec = read(`${FOCUS_DIR}/conversation-focus-establishment.service.spec.ts`);
  assert.match(serviceSpec, /36\. an incoherent claimed-complete row is rejected at the boundary: no replay, no delivery, no provider/u);
  assert.match(serviceSpec, /new ConversationFocusRuntimeRepository\(\{ rpc \} as unknown as SupabaseServiceRoleApiService\)/u,
    'the replay proof runs through the REAL repository and mapper, not a fake boundary');
});

test('the typed database error transport is additive, bounded, opaque, and source-compatible', () => {
  assert.match(dataApi, /constructor\(readonly status: number, identity\?: DataApiUpstreamIdentity\) \{/u);
  assert.match(dataApi, /const upstreamFailureIdentity = new WeakMap<DataApiError, DataApiUpstreamIdentity>\(\);/u);
  assert.match(dataApi, /export function readDataApiUpstreamIdentity\(error: DataApiError\): DataApiUpstreamIdentity/u);
  assert.match(dataApi, /const MAX_UPSTREAM_IDENTITY_LENGTH = 512;/u);
  assert.match(dataApi, /catch \{\s*return \{\};\s*\}/u, 'a malformed body never replaces the transport failure');
  assert.doesNotMatch(dataApi, /this\.databaseCode|this\.databaseMessage|defineProperty|console\./u, 'the identity is opaque and never logged');
  assert.doesNotMatch(dataApi.slice(dataApi.indexOf('export class DataApiError')), /readonly databaseCode|readonly databaseMessage/u, 'no enumerable identity field on the error');
  assert.match(dataApi, /throw new DataApiError\(response\.status, await parseDataApiUpstreamIdentity\(response\)\)/u);
  assert.match(serviceRoleApi, /throw new DataApiError\(response\.status, await parseDataApiUpstreamIdentity\(response\)\)/u);
  // The only production reader of the identity is the focus runtime repository.
  const readers = listFiles(join(rootPath, 'apps/api/src')).map(relative)
    .filter((file) => !file.endsWith('.spec.ts') && stripComments(read(file)).includes('readDataApiUpstreamIdentity('))
    .filter((file) => !file.endsWith('supabase-data-api.service.ts'));
  assert.deepEqual(readers, [`${FOCUS_DIR}/conversation-focus-runtime.repository.ts`]);
});

test('whole-exchange focus evaluation is sequential, no-hindsight and canonicalized once; no focus result reaches the wire', () => {
  assert.match(service, /const sequence = orderFinalizedExchange\(userCus, assistantCus\);\s*results = \(await evaluator\.evaluateSequence\(sessionId, sequence, context\.priorContext\)\)\.results;/u);
  assert.doesNotMatch(service, /Promise\.all\(\[[^\]]*evaluat/u, 'focus evaluation is never concurrent');
  assert.equal((service.match(/canonicalizePreparedFocusSequence\(/gu) ?? []).length, 1, 'one whole-exchange canonicalization');
  assert.match(service, /userFocusUnits: canonical\.units\.slice\(0, userCus\.length\),\s*assistantFocusUnits: canonical\.units\.slice\(userCus\.length\),/u);
  assert.match(service, /sliceByCodePoints\(turn\.content, \{ start: unit\.spanStart, end: unit\.spanEnd \}\)/u, 'exact code-point wording');
  assert.match(service, /automaticCommitBatchId\(userTurn\.id\)/u);
  assert.match(service, /newUnitId: \(unit\) => automaticCommitUnitId\(batchId, unit\)/u, 'the exact T-03A2 identity derivation, no parallel scheme');
  assert.match(service, /expectedCurrentSp: context\.token\.currentSp,\s*expectedSameSpEventSequence: context\.token\.sameSpEventSequence,/u);
  // The delivery carries only LH and the frozen committed events.
  assert.match(service, /\.map\(toCommittedWireEvent\)/u);
  assert.doesNotMatch(service.slice(service.indexOf('private delivery(')), /references|claimAttributions|attention|emerging_focus/u);
  // The strict mapper rejects rather than cleans.
  for (const rule of ['CONTEXT_GROUNDING_NOT_CLOSED', 'INVALID_RUNTIME_CONTEXT', 'entry.session_position <= lastSp', 'priorCuIds.has(g.cu_id)', "row.base_current_sp === null", 'if (sameSpEventSequence !== 0) return invalid();']) {
    assert.ok(mapper.includes(rule), `the mapper enforces: ${rule}`);
  }
  assert.doesNotMatch(mapper, /\.filter\(|delete /u, 'invalid context is rejected, never filtered');
});

test('the gates are registered at the root and in API CI', () => {
  assert.equal(rootPackage.scripts['test:conversation-focus-runtime-integration-readiness-contract'], 'node --test tests/conversation-focus-runtime-integration-readiness-contract.test.mjs');
  assert.equal(rootPackage.scripts['verify:conversation-focus-runtime-integration-readiness:integration'], 'node --env-file-if-exists=.env database/verify-migration-0067.mjs');
  assert.match(apiCi, /run: npm run test:conversation-focus-runtime-integration-readiness-contract/u);
  assert.match(apiCi, /run: npm run verify:conversation-focus-runtime-integration-readiness:integration/u);
  assert.ok(apiCi.indexOf('test:conversation-focus-runtime-integration-readiness-contract') < apiCi.indexOf('Apply all migrations to fresh PostgreSQL'));
  assert.ok(apiCi.indexOf('verify:conversation-focus-runtime-integration-readiness:integration') > apiCi.indexOf('verify:durable-reference-emerging-focus-sp-substrate:integration'));
});
