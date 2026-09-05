// T-03B2b3 - Thread Runtime Orchestration + Integration Readiness: the static
// anti-scope contract.
//
// Secret-free and CI-runnable. Behaviour is proven by the Jest suites under
// apps/api/src/thread-establishment and the real-PostgreSQL 0069 verifier.
// This contract guards the SHAPE across the repository, above all
// AC-B2B3-01: the combined B1+B2 runtime exists, is fully executable with
// fakes, and is NOT live - nothing is granted, nothing is revoked, nothing is
// registered, and the T-03A2 production path is byte-for-byte untouched. It
// also guards ED-B2B3-02: Conversational Origin is a deterministic mapping of
// already-canonical grounded B1 structure, with no model and no forbidden
// authority anywhere near it.
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

const THREAD_DIR = 'apps/api/src/thread-establishment';
const FOCUS_DIR = 'apps/api/src/conversational-focus';
const B2B3_FILES = [
  'conversation-thread-runtime.types.ts',
  'conversation-thread-runtime.repository.ts',
  'conversation-thread-runtime-mapper.ts',
  'conversation-thread-establishment.service.ts',
  'thread-establishment-binding.ts',
  'conversational-origin-mapper.ts',
];
const B2B3_SPECS = [
  'conversation-thread-runtime.repository.spec.ts',
  'conversation-thread-runtime-mapper.spec.ts',
  'conversation-thread-establishment.service.spec.ts',
  'conversational-origin-mapper.spec.ts',
];

const migration = read('database/migrations/0069_thread_runtime_integration_readiness_v1.sql');
const executable = stripSql(migration);
const service = stripComments(read(`${THREAD_DIR}/conversation-thread-establishment.service.ts`));
const repository = stripComments(read(`${THREAD_DIR}/conversation-thread-runtime.repository.ts`));
const mapper = stripComments(read(`${THREAD_DIR}/conversation-thread-runtime-mapper.ts`));
const runtimeTypes = stripComments(read(`${THREAD_DIR}/conversation-thread-runtime.types.ts`));
const binding = stripComments(read(`${THREAD_DIR}/thread-establishment-binding.ts`));
const origin = stripComments(read(`${THREAD_DIR}/conversational-origin-mapper.ts`));
const runtimeCode = [service, repository, mapper, runtimeTypes, binding, origin].join('\n');
const conversationModule = read('apps/api/src/conversation/conversation.module.ts');
const conversationService = read('apps/api/src/conversation/conversation.service.ts');
const establishment = read('apps/api/src/conversation-unit/conversation-temporal-establishment.service.ts');
const unitRepository = read('apps/api/src/conversation-unit/conversation-unit.repository.ts');
const migration0065 = read('database/migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql');
const rootPackage = readJson('package.json');
const apiPackage = readJson('apps/api/package.json');
const apiCi = read('.github/workflows/api-ci.yml');
const mobileCi = read('.github/workflows/mobile-ci.yml');

test('migration 0069 is the newest, and 0064 - 0068 keep their exact pins', () => {
  const migrations = readdirSync(join(rootPath, 'database/migrations')).filter((name) => name.endsWith('.sql')).sort();
  // (T-03B3 added 0070, the FINAL Thread-layer substrate that SUPERSEDES this
  // read/audit slice for B3-enabled batches; it is pinned by its own contract.
  // 0069 stays the newest READ / AUDIT-only migration of T-03B2.)
  assert.ok(migrations.includes('0069_thread_runtime_integration_readiness_v1.sql'));
  assert.ok(migrations.indexOf('0069_thread_runtime_integration_readiness_v1.sql') > migrations.indexOf('0068_durable_thread_home_same_sp_substrate_v1.sql'));
  assert.equal(gitBlobId(read('database/migrations/0064_committed_conversational_unit_substrate_v1.sql')), '0a2ee63980e59072b3e9f52a643efa8220e95b08');
  assert.equal(gitBlobId(read('database/migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql')), '3dc061c71bcb237cec648abb2d1fa02f450cd57f');
  assert.equal(gitBlobId(read('database/migrations/0066_durable_reference_emerging_focus_sp_substrate_v1.sql')), '9f0588d5ca46329a8721ee30302f49d227a357ae');
  assert.equal(gitBlobId(read('database/migrations/0067_conversation_focus_runtime_integration_readiness_v1.sql')), 'd12a3f552e80709ee1d20887f55f1c84e84f9208');
  assert.equal(gitBlobId(read('database/migrations/0068_durable_thread_home_same_sp_substrate_v1.sql')), '5ea270424059acd40c0a6bf7dc040efc3aa693d3');
  assert.ok(existsSync(new URL('database/verify-migration-0069.mjs', root)));
  assert.ok(existsSync(new URL('database/tests/thread-runtime-integration-readiness-v1.test.mjs', root)));
  // The frozen T-03B2a / T-03B2b1 / T-03B2b2 semantic authorities are untouched.
  assert.equal(gitBlobId(read(`${THREAD_DIR}/thread-establishment-evaluator.service.ts`)), '8440bf21a042ced27c710eee06ea5e016f122e86');
  assert.equal(gitBlobId(read(`${THREAD_DIR}/thread-establishment-validator.ts`)), '9b515e4eb15491e6899a87a887683ebf1a33a92a');
  assert.equal(gitBlobId(read(`${FOCUS_DIR}/conversation-focus-establishment.service.ts`)), '88455500c66585b8d40dd4077e185e669a398a89');
});

test('the B2b3 runtime exists as plain classes and is NOT a Nest provider', () => {
  for (const name of [...B2B3_FILES, ...B2B3_SPECS]) {
    assert.ok(existsSync(new URL(`${THREAD_DIR}/${name}`, root)), `${name} exists`);
  }
  assert.match(service, /export class ConversationThreadEstablishmentService \{/u);
  assert.match(repository, /export class ConversationThreadRuntimeRepository implements ConversationThreadRuntimeBoundary \{/u);
  assert.doesNotMatch(runtimeCode, /@Injectable\(|@Module\(|@Controller\(|from '@nestjs\//u, 'no Nest decorator and no Nest import anywhere in the runtime');
  assert.match(service, /constructor\(\s*private readonly repository: ConversationThreadRuntimeBoundary,\s*private readonly createSegmentationBinding: CuSegmentationBindingFactory,\s*private readonly createFocusBinding: FocusResolutionBindingFactory,\s*private readonly createThreadBinding: ThreadEstablishmentBindingFactory,\s*\)/u);
  assert.match(service, /async establish\(userId: string, result: OrchestratedTurnResult\): Promise<OrchestratedTurnResult>/u, 'the same entry shape as T-03A2');
  assert.match(service, /return \{ liveHead, committedEvents: ordered \};/u, 'the same external temporal delivery shape');
  // The T-03B2a index stays exactly the frozen semantic surface: the runtime is
  // reachable only by explicit path, never by re-export.
  const index = read(`${THREAD_DIR}/index.ts`);
  for (const name of B2B3_FILES) assert.ok(!index.includes(name.replace(/\.ts$/u, '')), `index.ts does not re-export ${name}`);
});

test('AC-B2B3-01: the B1+B2 runtime is NOT live - not registered, not called, nothing granted, nothing revoked', () => {
  assert.doesNotMatch(stripComments(conversationModule), /thread-establishment|ConversationThreadEstablishmentService|ConversationThreadRuntimeRepository|Thread/u);
  assert.doesNotMatch(stripComments(conversationService), /thread-establishment|ConversationThreadEstablishmentService|Thread/u);
  assert.match(conversationService, /private readonly temporal: ConversationTemporalEstablishmentService/u);
  assert.match(conversationService, /return this\.establishTemporal\(userId, await this\.orchestrator\.orchestrate\(/u);
  assert.match(conversationModule, /ConversationTemporalEstablishmentService/u);
  assert.doesNotMatch(stripComments(establishment), /with_focus|with_thread|thread-establishment|Thread/u);
  assert.match(unitRepository, /'commit_finalized_exchange_conversation_units_v1'/u, 'the live runtime still commits through the T-03A2 coordinator');
  // No file outside the two production-inert semantic directories reaches the runtime.
  const referencing = listFiles(join(rootPath, 'apps/api/src')).map(relative)
    .filter((file) => !file.startsWith(`${THREAD_DIR}/`))
    // T-03B3 (thread-lifecycle, production-inert) SUPERSEDES this runtime for
    // B3-enabled batches and reuses its mappers, types, helpers and Origin
    // mapper; it is pinned separately just below.
    .filter((file) => !file.startsWith('apps/api/src/thread-lifecycle/'))
    .filter((file) => /ConversationThreadEstablishmentService|ConversationThreadRuntimeRepository|conversation-thread-runtime|conversational-origin-mapper|with_focus_and_thread_v1|focus_thread_integrated_batch_snapshot|focus_thread_runtime_context|thread_capture_cutover_ready/u.test(stripComments(read(file))));
  assert.deepEqual(referencing, []);
  const lifecycleFiles = listFiles(join(rootPath, 'apps/api/src/thread-lifecycle')).map(relative);
  assert.ok(lifecycleFiles.length > 0, 'the T-03B3 directory exists');
  for (const file of lifecycleFiles) {
    assert.doesNotMatch(stripComments(read(file)), /new ConversationThreadEstablishmentService|new ConversationThreadRuntimeRepository|'commit_finalized_exchange_with_focus_and_thread_v1'|'get_conversation_focus_thread_integrated_batch_snapshot_v1'|'get_conversation_focus_thread_runtime_context_v1'|thread_capture_cutover_ready/u,
      `${file} supersedes the B2b3 runtime: it never constructs it and never calls a 0069 read or the 0068 coordinator itself`);
  }
  // Database: nothing granted, nothing revoked, no semantic write.
  assert.doesNotMatch(executable, /GRANT /u);
  for (const fn of ['commit_conversation_units_with_focus_and_thread_v1', 'commit_finalized_exchange_with_focus_and_thread_v1',
    'conversation_thread_batch_state_v1', 'get_conversation_focus_thread_integrated_batch_snapshot_v1',
    'get_conversation_focus_thread_runtime_context_v1', 'assert_conversation_thread_capture_cutover_ready_v1']) {
    assert.doesNotMatch(executable, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}`, 'u'));
  }
  assert.doesNotMatch(executable, /REVOKE [^;]*(?:commit_conversation_units_v1|commit_finalized_exchange_conversation_units_v1|get_conversation_unit_commit_batch_snapshot_v1)\(/u, 'no legacy writer revocation');
  assert.match(migration0065, /GRANT EXECUTE ON FUNCTION public\.commit_finalized_exchange_conversation_units_v1\([^)]*\) TO service_role/u, 'the T-03A2 service-role writer grant remains');
  assert.doesNotMatch(stripSql(migration.slice(0, migration.indexOf('-- 5. Terminal self-assertions'))), /INSERT INTO|UPDATE public|DELETE FROM|TRUNCATE/u, 'no semantic backfill, update or delete');
  assert.match(migration, /T-03B2b3 performs no cutover/u);
  assert.match(migration, /T-03D owns the final semantic-chain/u, 'live cutover explicitly deferred to the full same-SP semantic chain');
  assert.match(read(`${THREAD_DIR}/conversation-thread-establishment.service.ts`), /T-03D performs the final cutover/u);
});

test('no B3 lifecycle, no LF, no T-03C, no Reading / Neighborhood / merge, no mobile or runtime-package change', () => {
  for (const forbidden of ['DORMANT', 'Dormant', 'REOPEN', 'Reopened', 'lifecycle', 'LIVE_FOCUS', 'liveFocus', 'live_focus_transitions',
    'effectiveLf', 'knowledgeFrontier', 'PRE_FIRST_SP', 'historical', 'thread_enabled', 'analysis_enabled', 'semantic_version',
    'timeline', 'Timeline', 'Reading', 'neighborhood', 'Neighborhood', 'mergeThread', 'threadMerge', 'projection',
    'placementX', 'placement_x', 'homeAnchorId', 'expo-router', 'react-native', 'apps/mobile']) {
    assert.equal(runtimeCode.includes(forbidden), false, `the runtime must not contain ${forbidden}`);
  }
  assert.doesNotMatch(runtimeCode, /score|embedding|similarity|keyword|setInterval|Date\.now|new Date|Math\.random/iu);
  assert.doesNotMatch(mobileCi, /0069|thread-runtime-integration-readiness/u);
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3);
  for (const file of listFiles(join(rootPath, 'apps/mobile/src')).map(relative)) {
    assert.doesNotMatch(read(file), /with_focus_and_thread_v1|focus_thread_runtime_context|thread_capture_cutover_ready|ConversationThread|Conversational Origin/u, `${file} untouched`);
  }
  // The shared client wire contract is byte-identical: no Thread, Home or
  // Origin field can have reached it, and no client schema changed.
  for (const [file, blob] of [
    ['packages/runtime/src/index.d.ts', 'ab7281703923934e7d00fcd016cfa15a956c85d8'],
    ['packages/runtime/src/temporal.d.ts', '412aa269409575116d08064435f9230083a45796'],
    ['packages/runtime/package.json', '932b837629f23b5cb765eda196fb659418d07916'],
  ]) {
    assert.equal(gitBlobId(read(file)), blob, `${file} is byte-identical`);
  }
  for (const file of listFiles(join(rootPath, 'packages/runtime')).map(relative).filter((file) => file.endsWith('.ts'))) {
    assert.doesNotMatch(stripComments(read(file)), /threadId|thread_id|homeAnchor|home_anchor|originThread|origin_state|emergingFocus|emerging_focus/u,
      `${file} declares no Thread, Home or Origin payload`);
  }
  assert.deepEqual(Object.keys(rootPackage.devDependencies), ['pg']);
  for (const name of ['uuid', 'zod', 'p-retry', 'async-retry', 'retry', 'bottleneck']) {
    assert.equal(name in (apiPackage.dependencies ?? {}) || name in (apiPackage.devDependencies ?? {}), false, `${name} must not be introduced`);
  }
});

test('ED-B2B3-02: Conversational Origin is deterministic, provider-free and grounded only in canonical B1 structure', () => {
  // No model, no provider, no prompt, no client: the mapper imports pure types
  // and pure helpers only.
  const imports = [...origin.matchAll(/from\s+'([^']+)'/gu)].map((match) => match[1]).sort();
  assert.deepEqual(imports, [
    '../conversational-focus/durable-focus-payload.types',
    './conversation-thread-runtime.types',
    './durable-thread-canonicalizer',
    './durable-thread-payload.types',
    './thread-establishment.types',
  ], 'the Origin mapper imports no provider, no client, no config and no model');
  assert.doesNotMatch(origin, /provider|Provider|openai|OpenAI|prompt|model|Math\.|Date|random|fetch|await /u,
    'the Origin mapping is pure, synchronous and provider-free');
  // The four closed outcomes, and no fifth.
  for (const state of ["state: 'NONE'", "state: 'RESOLVED'", "state: 'MULTIPLE'", "state: 'AMBIGUOUS'"]) {
    assert.ok(origin.includes(state), `the closed Origin vocabulary includes ${state}`);
  }
  assert.doesNotMatch(origin, /primary|parent|preferred|best|rank|weight|confidence|importance|intensity|popularity|strength|distance|viewport|device|chronolog/iu,
    'no primary, parent, rank or forbidden authority is representable');
  // Only the two frozen grounding sources are read.
  assert.match(origin, /bundle\.target_cu_id !== null/u, 'path A reads the canonical sequence link');
  assert.match(origin, /reference\.state === 'RESOLVED'/u, 'path B reads canonical RESOLVED reference grounding');
  assert.match(origin, /reference\.state !== 'AMBIGUOUS'/u, 'path B reads canonical AMBIGUOUS candidates');
  assert.match(origin, /if \(thread\.emergingFocusId === request\.targetEmergingFocusId\) return invalid\(\);/u, 'a Thread is never its own origin');
  assert.match(origin, /INVALID_CONVERSATIONAL_ORIGIN_CONTEXT/u, 'a contradictory context fails closed');
  assert.match(origin, /\.sort\(compareThreadIds\)/u, 'members are stored in canonical textual order, never a ranking');
  // No hindsight: the establishing CU derives its origin BEFORE its own Thread
  // joins the visible world, and the prefix only ever grows forward.
  assert.ok(service.indexOf('origins.set(result.cuId, deriveConversationalOrigin(') < service.indexOf('establishedThreads.push({'),
    'a CU never sees its own Thread, and a later same-exchange Thread never reaches an earlier CU');
  assert.match(service, /NO_ESTABLISHMENT.*never|if \(result\.decision === 'ESTABLISH_THREAD' && result\.emergingFocusId !== null\) \{/u);
  const originSpec = read(`${THREAD_DIR}/conversational-origin-mapper.spec.ts`);
  for (const proof of ['the FIRST Thread of a world has no prior Thread to originate from',
    'an abrupt new subject with no canonical link stays NONE',
    'adjacency alone is not a link', 'path A: a canonical target_cu_id', 'path B: a RESOLVED reference',
    'two INDEPENDENT resolved links produce a symmetric MULTIPLE with no primary',
    'canonical B1 ambiguity over two grounded Threads is AMBIGUOUS, never a pick',
    'repeated names are not identity', 'chronology alone is not origin',
    'no similarity, importance, confidence, distance or model input is representable',
    'a later CU is structurally absent', 'a contradictory Thread world fails closed',
    'MULTIPLE membership and order are deterministic and independent of input order']) {
    assert.ok(originSpec.includes(proof), `the Origin proof covers: ${proof}`);
  }
});

test('FIX-T03B2B3-01: the direct runtime boundary proves the WHOLE finalized-exchange relation, both COMPLETED statuses included', () => {
  // ONE gate, in ONE place: role, both COMPLETED statuses, same Session and the
  // source relation. Nothing later re-checks it, and nothing may reach a read,
  // a binding or a mutation without passing it.
  assert.match(service, /function assertFinalizedExchangeRelation\(userTurn: ConversationTurn, assistantTurn: ConversationTurn\): void \{\s*if \(\s*userTurn\.role !== 'USER'\s*\|\| assistantTurn\.role !== 'ASSISTANT'\s*\|\| userTurn\.status !== 'COMPLETED'\s*\|\| assistantTurn\.status !== 'COMPLETED'\s*\|\| userTurn\.session_id !== assistantTurn\.session_id\s*\|\| assistantTurn\.source_turn_id !== userTurn\.id\s*\) \{\s*throw new ConversationThreadIntegrityError\('INVALID_FINALIZED_EXCHANGE_RELATION'\);/u);
  assert.equal((service.match(/assertFinalizedExchangeRelation\(/gu) ?? []).length, 2, 'exactly one declaration and one call site');
  // The call site is the FIRST statement of the direct boundary and sits
  // OUTSIDE the try, so an invalid pair can never be converted into provider or
  // transport unavailability.
  const boundary = service.slice(service.indexOf('async establishExchange('));
  assert.match(boundary, /async establishExchange\(userId: string, userTurn: ConversationTurn, assistantTurn: ConversationTurn\): Promise<ConversationTemporalDelivery> \{\s*assertFinalizedExchangeRelation\(userTurn, assistantTurn\);\s*try \{/u);
  assert.ok(boundary.indexOf('assertFinalizedExchangeRelation(userTurn, assistantTurn);') < boundary.indexOf('try {'));
  assert.ok(service.indexOf('assertFinalizedExchangeRelation(userTurn, assistantTurn);') < service.indexOf('private async run('),
    'the gate precedes every snapshot read, context read, binding construction and mutation');
  // The wrapper keeps returning a not-yet-complete pair unchanged.
  assert.match(service, /if \(userTurn\.status !== 'COMPLETED' \|\| assistantTurn\.status !== 'COMPLETED'\) return result;/u);
  const serviceSpec = read(`${THREAD_DIR}/conversation-thread-establishment.service.spec.ts`);
  assert.ok(serviceSpec.includes('74. a direct establishExchange call with any non-COMPLETED turn is refused before every read, provider and write'),
    'the adversarial direct-call proof exists');
  for (const proof of ["['GENERATING', 'COMPLETED']", "['COMPLETED', 'GENERATING']", "['FAILED', 'COMPLETED']",
    "['COMPLETED', 'FAILED']", "['GENERATING', 'FAILED']", "['FAILED', 'GENERATING']"]) {
    assert.ok(serviceSpec.includes(proof), `the direct-call proof covers ${proof}`);
  }
});

test('the orchestration order is fixed: B1 sequential, one B1 canonicalization, then B2 sequential, then one Thread canonicalization', () => {
  const focusEval = service.indexOf('await evaluator.evaluateSequence(sessionId, sequence, context.priorContext)');
  const focusCanon = service.indexOf('canonicalizePreparedFocusSequence(');
  const threadEval = service.indexOf('evaluator.evaluateSequence(sessionId, paired, threadPriorContext)');
  const originStep = service.indexOf('this.deriveOrigins(');
  const threadCanon = service.indexOf('canonicalizePreparedThreadSequence(');
  const split = service.indexOf('userThreadUnits: canonicalThread.units.slice(0, userCus.length)');
  assert.ok(focusEval > 0 && focusCanon > focusEval, 'the whole B1 sequence is evaluated, then canonicalized once');
  assert.ok(threadEval > focusCanon, 'B2 runs only after the whole-exchange B1 canonicalization');
  assert.ok(originStep > threadEval, 'Origin is derived from prepared B2 decisions');
  assert.ok(threadCanon > originStep, 'the Thread sequence is canonicalized after Origin');
  assert.ok(split > threadCanon, 'the split by exact USER / ASSISTANT counts happens after the ONE canonicalization');
  assert.equal((service.match(/canonicalizePreparedFocusSequence\(/gu) ?? []).length, 1, 'one whole-exchange B1 canonicalization');
  assert.equal((service.match(/canonicalizePreparedThreadSequence\(/gu) ?? []).length, 1, 'one whole-exchange Thread canonicalization');
  assert.doesNotMatch(service, /Promise\.all\(\[[^\]]*evaluat/u, 'semantic evaluation is never concurrent');
  assert.match(service, /const sequence = orderFinalizedExchange\(userCus, assistantCus\);/u, 'USER CUs in source order, then ASSISTANT CUs');
  assert.match(service, /sliceByCodePoints\(turn\.content, \{ start: unit\.spanStart, end: unit\.spanEnd \}\)/u, 'exact code-point wording');
  assert.match(service, /automaticCommitBatchId\(userTurn\.id\)/u);
  assert.match(service, /newUnitId: \(unit\) => automaticCommitUnitId\(batchId, unit\)/u, 'the exact T-03A2 identity derivation, no parallel scheme');
  assert.match(service, /expectedCurrentSp: context\.token\.currentSp,\s*expectedSameSpEventSequence: context\.token\.sameSpEventSequence,/u);
  assert.match(service, /if \(focusSemantics\.unit_id !== cu\.cuId\) throw new ConversationThreadIntegrityError\('FOCUS_SEMANTICS_MISMATCH'\);/u,
    'the exact canonical B1 bundle is paired to the exact B2 CU');
  assert.equal((repository.match(/\.rpc[<(]/gu) ?? []).length, 3, 'exactly three RPCs: two 0069 reads and the ONE existing 0068 coordinator');
  assert.match(repository, /'commit_finalized_exchange_with_focus_and_thread_v1'/u, 'no new mutation RPC is introduced');
});

test('stale recovery is bounded to one, checks the database winner first, and never repeats segmentation', () => {
  assert.match(runtimeTypes, /export const MAX_THREAD_STALE_CONTEXT_RETRIES = 1;/u);
  assert.match(service, /let retriesLeft = MAX_THREAD_STALE_CONTEXT_RETRIES;/u);
  assert.match(service, /if \(!\(error instanceof StaleConversationalFocusContextError\)\) throw error;/u);
  assert.match(service, /if \(retriesLeft === 0\) throw new ConversationThreadEstablishmentUnavailableError\('STALE_CONTEXT_RETRY_EXHAUSTED'/u);
  assert.match(service, /retriesLeft -= 1;/u);
  const loop = service.indexOf('for (;;) {');
  assert.ok(service.indexOf('const halves = await Promise.all([userHalf, assistantHalf]);') < loop, 'segmentation happens once, before the retry loop');
  assert.ok(service.indexOf('const winner = this.canonicalDelivery(fresh);', loop) < service.indexOf('if (!(error instanceof StaleConversationalFocusContextError)) throw error;', loop),
    'the database winner is checked BEFORE the stale branch');
  assert.doesNotMatch(service.slice(loop), /this\.segment\(/u, 'no segmentation inside the retry loop');
  assert.match(service, /SEGMENTATION_FRONTIER_MOVED/u, 'a moved frontier refuses segmentation reuse');
  // The exact stale identity is REUSED from T-03B1b2, never restated or widened.
  assert.match(repository, /import \{ isStaleConversationalFocusContext \} from '\.\.\/conversational-focus\/conversation-focus-runtime\.repository';/u);
  assert.doesNotMatch(repository, /'40001'|STALE_CONVERSATIONAL_FOCUS_CONTEXT'|\.includes\(|new RegExp/u,
    'the stale predicate is imported, not re-implemented, so exact equality stays one fact');
  // Integrity is never collapsed into unavailability.
  for (const reason of ['INVALID_FINALIZED_EXCHANGE_RELATION', 'PARTIAL_INTEGRATED_EXCHANGE', 'INCOMPLETE_THREAD_CAPTURE',
    'INVALID_INTEGRATED_SNAPSHOT', 'INVALID_THREAD_RUNTIME_CONTEXT', 'INCOMPLETE_PRIOR_THREAD_HISTORY',
    'INVALID_CONVERSATIONAL_ORIGIN_CONTEXT', 'FOCUS_SEMANTICS_MISMATCH', 'THREAD_PROVENANCE_DISAGREEMENT',
    'COMMITTED_WITHOUT_DELIVERY_EVENT', 'DELIVERY_RANGE_MISMATCH', 'LIVE_HEAD_NOT_ESTABLISHED', 'SEGMENTATION_FRONTIER_MOVED']) {
    assert.ok(runtimeTypes.includes(reason), `the integrity vocabulary includes ${reason}`);
  }
  for (const reason of ['PROVIDER_UNAVAILABLE', 'TRANSPORT_UNAVAILABLE', 'STALE_CONTEXT_RETRY_EXHAUSTED']) {
    assert.ok(runtimeTypes.includes(reason), `the retryable vocabulary includes ${reason}`);
  }
  // Phase separation: a post-finalization failure never touches turn lifecycle.
  assert.doesNotMatch(runtimeCode, /failTurn|FAILED|regenerat|markFailed/u, 'a technical failure never fails or regenerates a completed turn');
});

test('both semantic bindings are lazy and no Thread, Home or Origin payload reaches the wire', () => {
  assert.match(binding, /export function openAiThreadEstablishmentBinding\(environment: NodeJS\.ProcessEnv = process\.env\): ThreadEstablishmentBindingFactory \{\s*return \(\) => \{\s*const config = loadThreadEstablishmentOpenAIConfig\(environment\);/u);
  assert.match(service, /this\.focus \?\?= this\.createFocusBinding\(\);/u);
  assert.match(service, /this\.thread \?\?= this\.createThreadBinding\(\);/u);
  assert.equal((service.match(/this\.createThreadBinding\(\)/gu) ?? []).length, 1);
  assert.equal((service.match(/this\.createFocusBinding\(\)/gu) ?? []).length, 1);
  const constructorEnd = service.indexOf('async establish(');
  assert.doesNotMatch(service.slice(0, constructorEnd), /createThreadBinding\(\)|createFocusBinding\(\)|createSegmentationBinding\(\)|process\.env/u,
    'construction reads no environment and builds no provider');
  assert.ok(service.indexOf('const replayed = this.canonicalDelivery(snapshots);') < service.indexOf('await this.repository.readRuntimeContext('),
    'the replay / partial gate precedes the context read');
  assert.ok(service.indexOf('await this.repository.readRuntimeContext(') < service.indexOf('this.segment(userId, userTurn'), 'the context is read before any provider');
  assert.doesNotMatch(runtimeCode, /OPENAI_API_KEY|process\.env\./u, 'no ambient credential read in the runtime');
  // The delivery carries only LH and the frozen committed events.
  assert.match(service, /\.map\(toCommittedWireEvent\)/u);
  const deliveryMethod = service.slice(service.indexOf('private delivery('), service.indexOf('private async segment('));
  assert.ok(deliveryMethod.length > 0);
  assert.doesNotMatch(deliveryMethod.replace(/ConversationThreadIntegrityError/gu, ''), /thread|origin|home|emerging_focus/iu,
    'the external delivery is built from LH and the frozen committed events alone');
  // No permanent placement of any kind crosses the boundary in either direction.
  for (const forbidden of ['placement', 'home_anchor', 'world_fingerprint', 'origin_fingerprint', 'address_scheme', 'attempt']) {
    assert.equal(repository.includes(forbidden), false, `the repository never carries ${forbidden}`);
  }
  // The strict mapper rejects rather than cleans.
  for (const rule of ['CONTEXT_GROUNDING_NOT_CLOSED', 'INVALID_THREAD_RUNTIME_CONTEXT', 'INCOMPLETE_PRIOR_THREAD_HISTORY',
    'entry.session_position <= lastSp', 'if (sameSpEventSequence !== 0) return invalid();',
    "if (threadCaptureState === 'ABSENT'", "if (threadCaptureState === 'COMPLETE'"]) {
    assert.ok(mapper.includes(rule), `the mapper enforces: ${rule}`);
  }
  assert.doesNotMatch(mapper, /\.filter\(|delete /u, 'invalid context is rejected, never filtered');
  assert.doesNotMatch(mapper, /thread_capture_state: '(?:ABSENT|COMPLETE|PARTIAL)'|thread_capture_state = /u,
    'the mapper never rewrites the capture state: PARTIAL can never become COMPLETE');
  assert.match(mapper, /thread_capture_state: threadCaptureState,/u, 'the transported state is returned as given once it is proven');
});

test('the gates are registered at the root and in API CI', () => {
  assert.equal(rootPackage.scripts['test:thread-runtime-integration-readiness-contract'], 'node --test tests/thread-runtime-integration-readiness-contract.test.mjs');
  assert.equal(rootPackage.scripts['verify:thread-runtime-integration-readiness:integration'], 'node --env-file-if-exists=.env database/verify-migration-0069.mjs');
  assert.match(apiCi, /run: npm run test:thread-runtime-integration-readiness-contract/u);
  assert.match(apiCi, /run: npm run verify:thread-runtime-integration-readiness:integration/u);
  assert.ok(apiCi.indexOf('test:thread-runtime-integration-readiness-contract') < apiCi.indexOf('Apply all migrations to fresh PostgreSQL'));
  assert.ok(apiCi.indexOf('verify:thread-runtime-integration-readiness:integration') > apiCi.indexOf('verify:durable-thread-home-same-sp-substrate:integration'));
});
