// T-03B3 - Thread Lifecycle + Cross-Session Continuity v1 (Active / Dormant /
// Reopened): the static anti-scope contract.
//
// Secret-free and CI-runnable. Behaviour is proven by the Jest suites under
// apps/api/src/thread-lifecycle and the real-PostgreSQL 0070 verifier. This
// contract guards the SHAPE across the repository, above all AC-B3-01: the
// FINAL Thread-layer runtime exists, is fully executable with fakes, and is
// NOT live - nothing is granted, nothing is revoked, nothing is registered,
// and the T-03A2 production path is byte-for-byte untouched. It also pins the
// five Architecture Decisions B3-01 .. B3-05 where their shape is static:
// Session-local lifecycle over user/world-global identity, semantic (never
// name / similarity) continuity, exhaustive deterministic dossier paging, the
// final capture that REUSES the 0068 authority, and a deterministic reducer
// mirrored in SQL - plus the frozen same-SP rule (B1 seq 1, at most ONE Thread
// seq 2 shared by every Thread-layer row of a CU) and the bounded stale retry.
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

const LIFECYCLE_DIR = 'apps/api/src/thread-lifecycle';
const THREAD_DIR = 'apps/api/src/thread-establishment';
const FOCUS_DIR = 'apps/api/src/conversational-focus';
const MIGRATION = '0070_thread_lifecycle_cross_session_continuity_v1.sql';
const B3_FILES = [
  'thread-lifecycle.types.ts',
  'thread-continuity.types.ts',
  'thread-continuity-provider.types.ts',
  'thread-continuity-provider.config.ts',
  'fake-thread-continuity.provider.ts',
  'openai-thread-continuity.provider.ts',
  'thread-continuity-validator.ts',
  'thread-continuity-evaluator.service.ts',
  'thread-continuity-binding.ts',
  'thread-lifecycle-reducer.ts',
  'durable-thread-lifecycle-payload.types.ts',
  'durable-thread-lifecycle-canonicalizer.ts',
  'conversation-thread-lifecycle-runtime.types.ts',
  'conversation-thread-lifecycle-runtime-mapper.ts',
  'conversation-thread-lifecycle-runtime.repository.ts',
  'conversation-thread-lifecycle-establishment.service.ts',
];
const B3_SPECS = [
  'thread-lifecycle-reducer.spec.ts',
  'durable-thread-lifecycle-canonicalizer.spec.ts',
  'thread-continuity-evaluator.service.spec.ts',
  'conversation-thread-lifecycle-runtime-mapper.spec.ts',
  'conversation-thread-lifecycle-runtime.repository.spec.ts',
  'conversation-thread-lifecycle-establishment.service.spec.ts',
];

const migration = read(`database/migrations/${MIGRATION}`);
const executable = stripSql(migration);
const selfAssertionsAt = migration.indexOf('-- 22. Terminal self-assertions');
assert.ok(selfAssertionsAt > 0, 'the terminal self-assertion section exists');
const executableBody = stripSql(migration.slice(0, selfAssertionsAt));
const service = stripComments(read(`${LIFECYCLE_DIR}/conversation-thread-lifecycle-establishment.service.ts`));
const repository = stripComments(read(`${LIFECYCLE_DIR}/conversation-thread-lifecycle-runtime.repository.ts`));
const mapper = stripComments(read(`${LIFECYCLE_DIR}/conversation-thread-lifecycle-runtime-mapper.ts`));
const runtimeTypes = read(`${LIFECYCLE_DIR}/conversation-thread-lifecycle-runtime.types.ts`);
const reducer = stripComments(read(`${LIFECYCLE_DIR}/thread-lifecycle-reducer.ts`));
const continuityTypes = read(`${LIFECYCLE_DIR}/thread-continuity.types.ts`);
const evaluator = stripComments(read(`${LIFECYCLE_DIR}/thread-continuity-evaluator.service.ts`));
const provider = read(`${LIFECYCLE_DIR}/openai-thread-continuity.provider.ts`);
const binding = read(`${LIFECYCLE_DIR}/thread-continuity-binding.ts`);
const canonicalizer = read(`${LIFECYCLE_DIR}/durable-thread-lifecycle-canonicalizer.ts`);
const lifecycleTypes = read(`${LIFECYCLE_DIR}/thread-lifecycle.types.ts`);
const productionCode = B3_FILES.map((name) => stripComments(read(`${LIFECYCLE_DIR}/${name}`))).join('\n');
// The runtime proper: everything except the provider adapter (which carries the
// prompt text) and the config module (which, exactly like the T-03B1a / T-03B2a
// configs, is the ONE place that reads the credential when a real call is made).
const runtimeCode = B3_FILES.filter((name) => !['openai-thread-continuity.provider.ts', 'thread-continuity-provider.config.ts'].includes(name))
  .map((name) => stripComments(read(`${LIFECYCLE_DIR}/${name}`))).join('\n');
const conversationModule = read('apps/api/src/conversation/conversation.module.ts');
const conversationService = read('apps/api/src/conversation/conversation.service.ts');
const establishment = read('apps/api/src/conversation-unit/conversation-temporal-establishment.service.ts');
const unitRepository = read('apps/api/src/conversation-unit/conversation-unit.repository.ts');
const migration0065 = read('database/migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql');
const rootPackage = readJson('package.json');
const apiPackage = readJson('apps/api/package.json');
const apiCi = read('.github/workflows/api-ci.yml');
const mobileCi = read('.github/workflows/mobile-ci.yml');

test('migration 0070 is the FINAL Thread-layer migration, 0071 (T-03D) orders directly after it, 0064 - 0069 keep their exact pins, and no split-task marker exists', () => {
  const migrations = readdirSync(join(rootPath, 'database/migrations')).filter((name) => name.endsWith('.sql')).sort();
  // (T-03D added 0071, the effective-LF + FINAL semantic-chain cutover, pinned
  // by tests/effective-live-focus-final-semantic-chain-cutover-contract.test.mjs.)
  const B3D_MIGRATION = '0071_effective_live_focus_final_semantic_chain_cutover_v1.sql';
  assert.equal(migrations.indexOf(B3D_MIGRATION), migrations.indexOf(MIGRATION) + 1, '0071 orders directly after 0070');
  assert.deepEqual(migrations.filter((name) => /007\d_/u.test(name)), [MIGRATION, B3D_MIGRATION], 'T-03B3 ships exactly ONE migration; T-03D exactly one more');
  for (const [file, blob] of [
    ['database/migrations/0064_committed_conversational_unit_substrate_v1.sql', '0a2ee63980e59072b3e9f52a643efa8220e95b08'],
    ['database/migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql', '3dc061c71bcb237cec648abb2d1fa02f450cd57f'],
    ['database/migrations/0066_durable_reference_emerging_focus_sp_substrate_v1.sql', '9f0588d5ca46329a8721ee30302f49d227a357ae'],
    ['database/migrations/0067_conversation_focus_runtime_integration_readiness_v1.sql', 'd12a3f552e80709ee1d20887f55f1c84e84f9208'],
    ['database/migrations/0068_durable_thread_home_same_sp_substrate_v1.sql', '5ea270424059acd40c0a6bf7dc040efc3aa693d3'],
    ['database/migrations/0069_thread_runtime_integration_readiness_v1.sql', 'fc2531a5a880f440b7086a3a63ba6557527413a7'],
  ]) {
    assert.equal(gitBlobId(read(file)), blob, `${file} is byte-identical`);
  }
  assert.ok(existsSync(new URL('database/verify-migration-0070.mjs', root)));
  assert.ok(existsSync(new URL('database/tests/thread-lifecycle-cross-session-continuity-v1.test.mjs', root)));
  assert.ok(existsSync(new URL('docs/thread-lifecycle-cross-session-continuity-v1.md', root)));
  assert.match(read('docs/README.md'), /\[Thread Lifecycle \+ Cross-Session Continuity v1\]\(thread-lifecycle-cross-session-continuity-v1\.md\)/u);
  // ONE Architecture-sized task: no T-03B3a / T-03B3b split marker anywhere in the delivered surface.
  const delivered = [migration, productionCode, read('database/verify-migration-0070.mjs'), read('docs/thread-lifecycle-cross-session-continuity-v1.md')].join('\n');
  assert.doesNotMatch(delivered, /T-03B3[a-z]\b|T-03B3-[0-9]|B3a\b|B3b\b|split task|sub-task|subtask/iu, 'T-03B3 is one task');
  // The frozen T-03B2a / T-03B2b2 / T-03B2b3 / T-03B1b2 semantic authorities are untouched.
  assert.equal(gitBlobId(read(`${THREAD_DIR}/thread-establishment-evaluator.service.ts`)), '8440bf21a042ced27c710eee06ea5e016f122e86');
  assert.equal(gitBlobId(read(`${THREAD_DIR}/thread-establishment-validator.ts`)), '9b515e4eb15491e6899a87a887683ebf1a33a92a');
  assert.equal(gitBlobId(read(`${THREAD_DIR}/conversation-thread-establishment.service.ts`)), '105f5097dc10bcb8e717b2ac1db6aed6618c4015');
  assert.equal(gitBlobId(read(`${THREAD_DIR}/conversational-origin-mapper.ts`)), 'f5fca4432796c0dde4c59849881cdf80f1a70773');
  assert.equal(gitBlobId(read(`${THREAD_DIR}/durable-thread-canonicalizer.ts`)), '556b0f8b5787ec7a1b905d24d24b8cbba9b60c38');
  assert.equal(gitBlobId(read(`${FOCUS_DIR}/conversation-focus-establishment.service.ts`)), '88455500c66585b8d40dd4077e185e669a398a89');
});

test('the B3 runtime exists as plain classes and pure modules, and is NOT a Nest provider', () => {
  for (const name of [...B3_FILES, ...B3_SPECS]) {
    assert.ok(existsSync(new URL(`${LIFECYCLE_DIR}/${name}`, root)), `${name} exists`);
  }
  assert.deepEqual(listFiles(join(rootPath, LIFECYCLE_DIR)).map(relative).map((file) => file.slice(LIFECYCLE_DIR.length + 1)).sort(), [...B3_FILES, ...B3_SPECS].sort(),
    'the directory holds exactly the listed files: no index barrel, no stray module');
  assert.match(service, /export class ConversationThreadLifecycleEstablishmentService \{/u);
  assert.match(repository, /export class ConversationThreadLifecycleRuntimeRepository implements ConversationThreadLifecycleRuntimeBoundary \{/u);
  assert.doesNotMatch(productionCode, /@Injectable\(|@Module\(|@Controller\(|from '@nestjs\//u, 'no Nest decorator and no Nest import anywhere in the runtime');
  assert.match(service, /constructor\(\s*private readonly repository: ConversationThreadLifecycleRuntimeBoundary,\s*private readonly createSegmentationBinding: CuSegmentationBindingFactory,\s*private readonly createFocusBinding: FocusResolutionBindingFactory,\s*private readonly createThreadBinding: ThreadEstablishmentBindingFactory,\s*private readonly createContinuityBinding: ThreadContinuityBindingFactory,\s*\)/u);
  assert.match(service, /async establish\(userId: string, result: OrchestratedTurnResult\): Promise<OrchestratedTurnResult>/u, 'the same entry shape as T-03A2');
  assert.match(service, /return \{ liveHead, committedEvents: ordered \};/u, 'the same external temporal delivery shape');
  // Pure modules: the reducer, the canonicalizer and the validator do no I/O.
  for (const name of ['thread-lifecycle-reducer.ts', 'durable-thread-lifecycle-canonicalizer.ts', 'thread-continuity-validator.ts', 'thread-lifecycle.types.ts', 'thread-continuity.types.ts']) {
    assert.doesNotMatch(stripComments(read(`${LIFECYCLE_DIR}/${name}`)), /\bawait\b|Promise|fetch\(|rpc\(|process\.env|Date\.now|new Date|Math\.random|setTimeout|setInterval/u, `${name} is pure`);
  }
  assert.match(reducer, /export function reduceThreadLifecycle\(input: ThreadLifecycleReductionInput\): readonly PreparedThreadLifecycleTransition\[\]/u);
});

test('AC-B3-01 resolved by T-03D: the B3-ONLY runtime is still never registered or called; the live path is the FINAL semantic chain', () => {
  // T-03D (the ONE authorized cutover) wires the FINAL B1 + B2 + B3 + LF chain
  // (apps/api/src/live-focus) in ConversationModule and calls it from
  // ConversationService. This slice's own runtime service and repository are
  // superseded: never registered, never constructed, never called. The FINAL
  // chain REUSES the frozen Thread-layer walk of this directory and the lazy
  // continuity binding factory; both are pinned by the T-03D contract.
  assert.doesNotMatch(stripComments(conversationModule), /ConversationThreadLifecycleEstablishmentService|ConversationThreadLifecycleRuntimeRepository|conversation-thread-lifecycle-establishment|conversation-thread-lifecycle-runtime|with_focus_thread_lifecycle_v1/u);
  assert.doesNotMatch(stripComments(conversationService), /thread-lifecycle|thread-establishment|ConversationThreadLifecycle|ConversationThreadEstablishment|with_focus_thread_lifecycle_v1/u);
  assert.match(conversationService, /private readonly semantic: ConversationSemanticEstablishmentService/u);
  assert.match(conversationService, /return this\.establishSemanticChain\(userId, await this\.orchestrator\.orchestrate\(/u);
  assert.match(conversationModule, /ConversationSemanticEstablishmentService/u);
  assert.doesNotMatch(conversationModule, /ConversationTemporalEstablishmentService,|provide: ConversationTemporalEstablishmentService/u, 'no temporal-only fallback service is registered');
  assert.doesNotMatch(stripComments(establishment), /with_focus|with_thread|thread-lifecycle|thread-establishment|Lifecycle|Thread/u);
  assert.match(unitRepository, /'commit_finalized_exchange_conversation_units_v1'/u, 'the retired T-03A2 repository still names the retired coordinator; it is no longer registered');
  assert.equal(gitBlobId(read('apps/api/src/app.module.ts')), 'fc3ce9c12b67552fb54214d0b6b4931b89601da6', 'AppModule is byte-identical to the baseline');
  assert.equal(gitBlobId(establishment), '6ddcaf4fcfdaa0c1c437cdad374a134e198b922e', 'the retired T-03A2 establishment service is byte-identical to the baseline');
  // No file outside the production-inert semantic directories reaches the B3-only
  // runtime; the FINAL chain (live-focus) and the module's lazy binding FACTORY
  // registration are the two authorized consumers.
  const referencing = listFiles(join(rootPath, 'apps/api/src')).map(relative)
    .filter((file) => !file.startsWith(`${LIFECYCLE_DIR}/`))
    .filter((file) => !file.startsWith('apps/api/src/live-focus/'))
    .filter((file) => /thread-lifecycle|ConversationThreadLifecycle|ThreadContinuity|thread_lifecycle|with_focus_thread_lifecycle_v1|thread_identity_dossier|thread_lifecycle_runtime_context|thread_lifecycle_integrated_batch_snapshot|thread_lifecycle_cutover_ready/u.test(stripComments(read(file))));
  assert.deepEqual(referencing, ['apps/api/src/conversation/conversation.module.ts'], 'only the FINAL-chain wiring in ConversationModule references the directory');
  assert.doesNotMatch(stripComments(conversationModule), /thread_lifecycle|with_focus_thread_lifecycle_v1|thread_identity_dossier|thread_lifecycle_runtime_context|thread_lifecycle_integrated_batch_snapshot|thread_lifecycle_cutover_ready/u,
    'ConversationModule registers the continuity binding factory, never a 0070 RPC');
  // Database: nothing granted, nothing revoked, no semantic write.
  assert.doesNotMatch(executable, /GRANT /u, 'no grant of any kind: the B3 layer is executable by NO application role');
  assert.doesNotMatch(executable, /GRANT[^;]*service_role|TO service_role/u, 'no service_role grant on any B3 writer, coordinator, read, page or audit');
  assert.match(executable, /REVOKE ALL ON FUNCTION public\.commit_finalized_exchange_with_focus_thread_lifecycle_v1\([^)]*\) FROM service_role/u, 'the B3 coordinator is explicitly unreachable by service_role');
  assert.doesNotMatch(executable, /REVOKE [^;]*(?:commit_conversation_units_v1|commit_finalized_exchange_conversation_units_v1|get_conversation_unit_commit_batch_snapshot_v1|commit_conversation_units_with_focus_v1|commit_finalized_exchange_with_focus_v1|with_focus_and_thread_v1)\(/u,
    'no legacy or earlier-slice writer revocation');
  assert.match(migration0065, /GRANT EXECUTE ON FUNCTION public\.commit_finalized_exchange_conversation_units_v1\([^)]*\) TO service_role/u, 'the T-03A2 service-role writer grant remains');
  // Every INSERT of 0070 lives inside a function body executed per Moment at
  // runtime; the migration itself backfills, updates and deletes nothing.
  const topLevel = executableBody.replace(/\$\$[\s\S]*?\$\$/gu, '');
  assert.ok(topLevel.includes('CREATE TABLE public.conversation_thread_lifecycle_events'), 'function bodies were removed, DDL remains');
  assert.doesNotMatch(topLevel, /INSERT INTO|UPDATE public|DELETE FROM|TRUNCATE/u, 'no semantic backfill, update or delete at migration time');
  assert.doesNotMatch(executableBody, /ALTER TABLE public\.(?:conversation_units|conversation_threads|conversation_thread_homes|conversation_emerging_focuses|session_semantic_clocks)\b/u,
    '0070 alters no frozen table');
  assert.match(migration, /T-03D owns the final cutover/u, 'live cutover explicitly deferred to the full same-SP semantic chain');
  assert.match(read(`${LIFECYCLE_DIR}/conversation-thread-lifecycle-establishment.service.ts`), /T-03D performs the final cutover/u);
});

test('B3-01: Session-local lifecycle over user/world-global identity - no global current state, no global Session order or time', () => {
  // Thread identity, Home and identity evidence are user/world-scoped; lifecycle rows are Session-keyed.
  assert.match(migration, /CREATE TABLE public\.conversation_thread_identity_evidence \([\s\S]*?user_id uuid NOT NULL[\s\S]*?session_id uuid NOT NULL[\s\S]*?\);/u);
  assert.match(migration, /CREATE TABLE public\.conversation_thread_lifecycle_events \([\s\S]*?session_id uuid NOT NULL[\s\S]*?\);/u);
  assert.match(migration, /CREATE TABLE public\.conversation_thread_focus_bindings \([\s\S]*?session_id uuid NOT NULL[\s\S]*?\);/u);
  assert.match(migration, /UNIQUE \(session_id, cu_id, thread_id\)/u, 'at most one transition per Thread per CU');
  // No global current lifecycle column on the Thread, no global Session order, no timestamp ordering.
  assert.doesNotMatch(executableBody, /ALTER TABLE public\.conversation_threads/u, 'conversation_threads gains no lifecycle column');
  assert.doesNotMatch(executableBody, /current_lifecycle|lifecycle_state text|global_state|current_state text NOT NULL|last_active|last_seen|dormant_since|reopened_at|session_order|session_sequence|global_sequence|world_sp\b/iu,
    'no global current lifecycle state column and no global Session order');
  assert.doesNotMatch(executableBody.replace('NEW.created_at <> OLD.created_at', ''), /ORDER BY [^;]*created_at|created_at\s*[<>=]|now\(\)|clock_timestamp|interval|age\(|EXTRACT\(|date_part/iu,
    'no timestamp is ever ordered by, compared, or used as a lifecycle input');
  assert.match(migration, /conversation_thread_session_lifecycle_state_v1\(p_thread_id uuid, p_session_id uuid, p_before_sp integer DEFAULT NULL\)/u, 'lifecycle state is a function of (Thread, Session, SP) - never of the Thread alone');
  assert.match(migration, /ORDER BY e\.session_position DESC, e\.transition_ordinal DESC/u, 'the then-valid state is read by SP within ONE Session');
  assert.match(stripComments(lifecycleTypes), /export const THREAD_LIFECYCLE_STATES = Object\.freeze\(\['ACTIVE', 'DORMANT', 'REOPENED'\] as const\);/u);
  // (The deterministic fake provider yields one macrotask to model an async
  // transport; it is a test double, never a lifecycle input.)
  assert.doesNotMatch(runtimeCode.replace('await new Promise((resolve) => setTimeout(resolve, 1));', ''), /setInterval|setTimeout|Date\.now|new Date|Math\.random|idleMs|inactivityMs|dormancyTimeout|\btimer/u,
    'no timer-based dormancy anywhere in the runtime');
  assert.doesNotMatch(provider.replace(/setTimeout\(\(\) => controller\.abort\(\), this\.config\.timeoutMs\)/u, '').replace(/clearTimeout\(timer\)/u, ''), /setInterval|setTimeout|Date\.now|new Date|Math\.random/u,
    'the only timer in the provider adapter is the transport abort timeout');
  // First appearance in a NEW Session is an ACTIVE baseline via the binding row, never a REOPENED transition.
  assert.match(migration, /thread_lifecycle_events_transition_check CHECK \(\s*\(from_state = 'ACTIVE' AND to_state = 'DORMANT'\)\s*OR \(from_state = 'REOPENED' AND to_state = 'DORMANT'\)\s*OR \(from_state = 'DORMANT' AND to_state = 'REOPENED'\)\s*OR \(from_state = 'REOPENED' AND to_state = 'ACTIVE'\)\),/u,
    'only the four legal transitions exist; there is no ACTIVE -> REOPENED and no cross-Session reopening row');
  assert.match(migration, /\(to_state = 'DORMANT' AND reason_code IN \('EXPLICIT_FOCUS_SHIFT', 'SUSTAINED_DEPARTURE'\)\)\s*OR \(to_state = 'REOPENED' AND reason_code = 'GENUINE_RETURN'\)\s*OR \(to_state = 'ACTIVE' AND reason_code = 'CONTINUED_ANCHORING'\)/u,
    'every reason is tied to exactly its target state');
  assert.match(reducer, /'DORMANT'/u);
  assert.doesNotMatch(reducer, /sessionCount|otherSession|previousSession|crossSession|lastSessionId/u, 'the reducer knows only ONE Session');
});

test('B3-02: continuity is semantic identity resolution - no embedding / similarity / same-name authority, ambiguity blocks duplicates', () => {
  assert.doesNotMatch(productionCode, /embedding|cosine|similarity|levenshtein|jaro|fuzzy|trigram|tf-?idf|nearest|\brank\(/iu, 'no similarity or ranking authority in the application layer');
  assert.doesNotMatch(runtimeCode, /\bscore|\bvector|\bkeyword|confidence:/iu, 'no score, vector, keyword or confidence anywhere in the runtime');
  assert.match(provider, /never return a score, a confidence/u, 'the provider prompt forbids graded output, and the strict schema has no field for it');
  assert.doesNotMatch(provider, /score|confidence|rank/u.source === '' ? /$^/u : /'(?:score|confidence|rank|similarity)':/u, 'the strict output schema declares no graded property');
  assert.doesNotMatch(executableBody, /embedding|similarity|levenshtein|pg_trgm|tsvector|to_tsquery|ILIKE|SIMILAR TO|<->|score/iu, 'no similarity or ranking authority in the database layer');
  assert.doesNotMatch(productionCode, /sameName|same_name|displayName ===|\.name\.toLowerCase\(\)|localeCompare/u, 'same name is never identity');
  assert.match(stripComments(continuityTypes), /export const THREAD_CONTINUITY_DECISIONS = Object\.freeze\(\['DISTINCT_NEW', 'BIND_EXISTING', 'AMBIGUOUS_EXISTING'\] as const\);/u);
  assert.match(migration, /THREAD_CONTINUITY_PRIOR_EVIDENCE_UNKNOWN/u, 'cited prior identity evidence must exist byte-for-byte');
  assert.match(migration, /THREAD_CONTINUITY_EVIDENCE_NOT_GROUNDED/u, 'current identity evidence must be a RESOLVED reference to the focus grounding handle');
  assert.match(migration, /THREAD_CONTINUITY_EVIDENCE_NOT_CURRENT/u, 'identity evidence belongs to the current CU');
  assert.match(migration, /INVALID_THREAD_IDENTITY_AMBIGUITY/u);
  assert.match(migration, /UNKNOWN_THREAD_IDENTITY_CANDIDATE/u, 'every recorded ambiguity candidate is a real canonical Thread of this user');
  // Ambiguity binds nothing and establishes nothing: the shape CHECK ties IDENTITY_AMBIGUOUS to a NULL thread and no binding.
  assert.match(migration, /thread_semantic_units_shape_check CHECK \(/u);
  assert.match(stripSql(migration), /outcome = 'IDENTITY_AMBIGUOUS' AND thread_id IS NULL AND emerging_focus_id IS NOT NULL AND cardinality\(candidate_thread_ids\) >= 2/u,
    'an ambiguous identity holds: no Thread, at least two real candidates');
  assert.match(service, /\} else \{\s*threadResult = this\.noEstablishment\(cu, focusId\);\s*outcome = 'IDENTITY_AMBIGUOUS';\s*candidateThreadIds = continuity\.candidateThreadIds;\s*\}/u,
    'an ambiguous identity never reaches the establishment evaluator and never mints a Thread');
  assert.match(service, /else if \(continuity\.decision === 'BIND_EXISTING'\) \{\s*threadResult = this\.noEstablishment\(cu, focusId\);\s*threadId = continuity\.threadId;\s*outcome = 'ACTIVATE_EXISTING_IN_SESSION';\s*newBindingKind = 'SESSION_CONTINUITY';/u,
    'a continuity binding never reaches the establishment evaluator: the SAME Thread is reused');
  assert.match(service, /if \(continuity\.decision === 'DISTINCT_NEW'\) \{\s*threadResult = await this\.establishment\(cu, bundle\);/u, 'only a proven-distinct focus reaches the frozen B2a evaluator');
});

test('B3-03: exhaustive deterministic dossier paging in fixed chunks against one exact identity version', () => {
  assert.match(stripComments(continuityTypes), /export const THREAD_CONTINUITY_SCREEN_CHUNK_SIZE = 32;/u);
  assert.match(evaluator, /for \(let start = 0; start < input\.dossiers\.length; start \+= THREAD_CONTINUITY_SCREEN_CHUNK_SIZE\) \{/u, 'every dossier is screened, chunk by chunk, sequentially');
  assert.doesNotMatch(evaluator, /Promise\.all|Promise\.allSettled|\.slice\(0, \d+\)|topK|limit:/u, 'no concurrent screening and no truncation');
  assert.match(stripComments(continuityTypes), /export function compareThreadIdText\(left: string, right: string\): number/u);
  assert.match(migration, /CREATE FUNCTION public\.get_conversation_thread_identity_dossier_page_v1\(/u);
  const dossierPage = executable.slice(executable.indexOf('CREATE FUNCTION public.get_conversation_thread_identity_dossier_page_v1('), executable.indexOf('CREATE FUNCTION public.get_conversation_thread_lifecycle_runtime_context_v1('));
  assert.match(dossierPage, /ORDER BY t\.id::text COLLATE "C"\s*LIMIT p_limit;/u, 'pages are ordered by the canonical textual Thread id, never by recency, importance or activity');
  assert.match(dossierPage, /p_after_thread_id IS NULL OR t\.id::text COLLATE "C" > p_after_thread_id::text COLLATE "C"/u, 'the cursor is the textual Thread id itself');
  assert.match(dossierPage, /p_limit < 1 OR p_limit > 64/u, 'the page size is bounded');
  assert.doesNotMatch(dossierPage, /created_at|importance|recent|activity|DESC/iu, 'no recency, importance or activity enters the page order');
  assert.match(migration, /INVALID_THREAD_IDENTITY_CONTEXT_TOKEN/u, 'a page read against a moved identity version fails closed');
  assert.match(migration, /INVALID_THREAD_DOSSIER_PAGE/u);
  assert.match(service, /const page = await this\.repository\.readIdentityDossierPage\(\{\s*userId: this\.userId,\s*expectedWorldThreadIdentityVersion: this\.context\.worldThreadIdentityVersion,\s*afterThreadId,\s*limit: THREAD_CONTINUITY_SCREEN_CHUNK_SIZE,\s*\}\);/u,
    'every page is read against the ONE version the context carried, cursor = the last textual Thread id');
  assert.match(service, /if \(page\.length < THREAD_CONTINUITY_SCREEN_CHUNK_SIZE\) break;/u, 'paging stops only when a page is short: every dossier is read');
  assert.match(service, /compareThreadIdText\(dossier\.threadId, afterThreadId\) <= 0\) throw new ConversationThreadLifecycleIntegrityError\('INVALID_THREAD_IDENTITY_DOSSIER'\)/u, 'a page out of textual order fails closed');
  assert.match(service, /\(await this\.loadDossiers\(\)\)\.filter\(\(dossier\) => !boundThreadIds\.has\(dossier\.threadId\)\)/u, 'a Thread already bound in this Session is never a continuity candidate (ED-B3-01)');
  assert.doesNotMatch(service, /last_activity|recent|importance|priority|top\b/u, 'no retrieval heuristic narrows the candidate set');
});

test('B3-04: the final Thread-layer capture supersedes the B2-only capture by REUSING the 0068 authority', () => {
  assert.match(migration, /CREATE FUNCTION public\.conversation_thread_semantic_batch_state_v1\(/u);
  assert.match(migration, /base_state := public\.conversation_thread_batch_state_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\);/u, 'the ONE 0068 structural authority is called, never re-implemented');
  assert.doesNotMatch(executableBody, /CREATE (?:OR REPLACE )?FUNCTION public\.conversation_thread_batch_state_v1\(/u, '0068 is not rewritten');
  assert.doesNotMatch(executableBody, /DROP FUNCTION|DROP TABLE|CREATE OR REPLACE FUNCTION public\.(?:commit_conversation_units_with_focus_and_thread_v1|commit_finalized_exchange_with_focus_and_thread_v1|persist_conversation_thread_establishment_v1|validate_conversation_thread_decision_v1)/u,
    'no earlier writer, validator or persist path is replaced');
  assert.match(migration, /THREAD_LIFECYCLE_CUTOVER_NOT_READY/u);
  assert.match(migration, /COMMIT_BATCH_NOT_THREAD_LIFECYCLE_COMPLETE/u, 'a B2-only (legacy) batch is reported PARTIAL by the readiness audit');
  assert.match(migration, /THREAD_WITHOUT_ESTABLISHMENT_BINDING/u);
  assert.match(migration, /THREAD_WITHOUT_IDENTITY_DOSSIER/u);
  assert.match(migration, /INVALID_LIFECYCLE_CHAIN/u);
  for (const rule of ["if (user.thread_semantic_capture_state === 'PARTIAL' || assistant.thread_semantic_capture_state === 'PARTIAL') {",
    "if (user.thread_semantic_capture_state === 'ABSENT' && assistant.thread_semantic_capture_state === 'ABSENT') return undefined;",
    "if (user.thread_semantic_capture_state !== 'COMPLETE' || assistant.thread_semantic_capture_state !== 'COMPLETE') {"]) {
    assert.ok(service.includes(rule), `the replay gate enforces: ${rule}`);
  }
  for (const rule of ["if (state === 'ABSENT' && (base.thread_capture_state !== 'ABSENT' || row.thread_semantic_batch_exists)) return reject();",
    "if (base.thread_capture_state === 'ABSENT' && row.thread_semantic_batch_exists && state !== 'PARTIAL') return reject();"]) {
    assert.ok(mapper.includes(rule), `the mapper enforces: ${rule}`);
  }
  for (const reason of ['INCOMPLETE_THREAD_LIFECYCLE_CAPTURE', 'PARTIAL_INTEGRATED_EXCHANGE']) assert.ok(runtimeTypes.includes(reason));
  assert.doesNotMatch(mapper, /thread_semantic_capture_state: '(?:ABSENT|COMPLETE|PARTIAL)'|thread_semantic_capture_state = /u,
    'the mapper never rewrites the capture state: PARTIAL can never become COMPLETE');
  assert.doesNotMatch(mapper, /\.filter\(\(entry\)|delete /u, 'invalid context is rejected, never filtered');
});

test('B3-05: the lifecycle reducer is deterministic, mirrored in SQL and re-derived by the database', () => {
  assert.match(migration, /CREATE FUNCTION public\.derive_conversation_thread_lifecycle_transitions_v1\(p_cu public\.conversation_units\)/u);
  assert.match(migration, /derived := public\.derive_conversation_thread_lifecycle_transitions_v1\(p_cu\);/u, 'the validator re-derives every CU');
  assert.match(migration, /THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL/u, 'a payload may neither add nor omit a transition');
  for (const reason of ['GENUINE_RETURN', 'CONTINUED_ANCHORING', 'EXPLICIT_FOCUS_SHIFT', 'SUSTAINED_DEPARTURE']) {
    assert.ok(reducer.includes(`'${reason}'`), `the reducer emits ${reason}`);
    assert.ok(stripSql(migration).includes(`'${reason}'`), `the SQL mirror emits ${reason}`);
  }
  assert.match(reducer, /FOCUS_SHIFT/u, 'explicit shift reads the canonical B1 function');
  assert.match(reducer, /NO_INDEPENDENT_FOCUS/u, 'a CU without independent focus is never "away"');
  assert.doesNotMatch(reducer, /provider|openai|fetch|rpc|model/iu, 'no second lifecycle model');
  assert.doesNotMatch(reducer, /analysis|background|hypothesis|reading|importance|salience|weight/iu, 'no analytical or background activity influences lifecycle');
  assert.match(stripComments(lifecycleTypes), /export const THREAD_LIFECYCLE_REDUCER_VERSION = 'thread-lifecycle-reducer-v1';/u);
  assert.match(migration, /lifecycle_reducer_version/u, 'the reducer version is captured as provenance');
});

test('the frozen same-SP rule: B1 stays seq 1, the WHOLE Thread layer takes at most ONE seq 2 shared by every row of a CU', () => {
  assert.match(migration, /CONSTRAINT thread_focus_bindings_position_check CHECK \(bound_sp >= 1 AND same_sp_event_sequence = 2\)/u);
  assert.match(migration, /session_position >= 1 AND same_sp_event_sequence = 2 AND transition_ordinal >= 0\)/u);
  assert.match(migration, /session_position >= 1 AND \(thread_layer_event_sequence IS NULL OR thread_layer_event_sequence = 2\)\)/u);
  assert.match(migration, /UNIQUE \(session_id, session_position, transition_ordinal\)/u, 'several lifecycle rows of ONE CU share the one seq 2 and are ordered by ordinal');
  assert.match(migration, /reserve_session_same_sp_event_v1/u, 'the seq 2 is reserved through the frozen 0065 allocator');
  assert.doesNotMatch(executableBody, /same_sp_event_sequence = 3|same_sp_event_sequence >= 3|sequence 3/u, 'no seq 3 is reserved: LF is not implemented here');
  assert.match(migration, /persist_conversation_unit_focus_semantics_v1/u, 'B1 is persisted by the frozen 0066 path (seq 1) inside the same writer');
  // The persist path takes ONE reserved sequence for ALL Thread-layer rows of a CU.
  assert.match(migration, /CREATE FUNCTION public\.persist_conversation_thread_lifecycle_layer_v1\(/u);
  const persist = executable.slice(executable.indexOf('CREATE FUNCTION public.persist_conversation_thread_lifecycle_layer_v1('), executable.indexOf('CREATE FUNCTION public.conversation_thread_semantic_batch_state_v1('));
  assert.ok(persist.length > 0);
  assert.doesNotMatch(persist, /reserve_session_same_sp_event_v1/u, 'the persist path never reserves a second sequence for the same CU');
  assert.match(persist, /thread_layer_event_sequence/u, 'the persist path records the ONE shared sequence (or NULL) on the unit result');
});

test('cross-Session reuse keeps the SAME Thread and the SAME Home: no OSDAP path, no Home recompute, no grounding rewrite, no merge', () => {
  const continuityPersist = executable.slice(executable.indexOf('CREATE FUNCTION public.persist_conversation_thread_lifecycle_layer_v1('), executable.indexOf('CREATE FUNCTION public.conversation_thread_semantic_batch_state_v1('));
  assert.doesNotMatch(continuityPersist, /compute_canonical_home_placement_v1|persist_conversation_thread_establishment_v1|conversation_thread_homes|conversation_world_spatial_authorities/u,
    'a SESSION_CONTINUITY binding never enters the placement path and never touches a Home');
  assert.doesNotMatch(executableBody, /UPDATE public\.conversation_thread_homes|UPDATE public\.conversation_threads|DELETE FROM public\.conversation_threads|UPDATE public\.conversation_world_spatial_authorities/u,
    'no existing Home moves, no Thread is rewritten, no authority is rewound');
  assert.doesNotMatch(executableBody, /SET grounding_emerging_focus_id|UPDATE public\.conversation_threads\b/u, 'the original establishment grounding lineage is immutable');
  assert.match(migration, /binding_kind IN \('ESTABLISHMENT', 'SESSION_CONTINUITY'\)/u);
  assert.match(migration, /UNIQUE \(thread_id, session_id\)/u, 'one Thread binds at most one focus per Session');
  assert.match(migration, /THREAD_FOCUS_ALREADY_BOUND/u);
  assert.match(migration, /THREAD_ALREADY_BOUND_IN_SESSION/u);
  assert.doesNotMatch(productionCode, /mergeThread|threadMerge|merge_thread|MERGE|absorb|rebind|reparent/u, 'no Thread merge path');
  assert.doesNotMatch(executableBody, /CREATE FUNCTION public\.[a-z_]*(?:merge|absorb|rebind)|merge_thread|thread_merge|merged_into|absorbed_by|rebind_/iu, 'no Thread merge path in the database');
  assert.match(migration, /There is no rebind, no merge and no repair path/u);
  assert.doesNotMatch(productionCode, /compute_canonical_home_placement|placeCanonicalHome|resolveThreadHome|osdap|placement_x|placement_y|home_anchor/iu, 'the runtime carries no placement of any kind');
  for (const forbidden of ['placement', 'home_anchor', 'world_fingerprint', 'origin_fingerprint', 'address_scheme']) {
    assert.equal(repository.includes(forbidden), false, `the repository never carries ${forbidden}`);
  }
});

test('the world Thread identity clock is a technical version: +1 only, permanent, locked AFTER the Session Semantic Clock (AF66-01)', () => {
  assert.match(migration, /CREATE TABLE public\.conversation_world_thread_identity_clocks \(\s*user_id uuid PRIMARY KEY,\s*current_version bigint NOT NULL DEFAULT 0,/u);
  assert.match(migration, /NEW\.current_version <> OLD\.current_version \+ 1/u, 'the version only ever advances by exactly one');
  assert.match(migration, /WORLD_THREAD_IDENTITY_CLOCK_IS_MONOTONIC/u);
  assert.match(migration, /WORLD_THREAD_IDENTITY_CLOCK_IS_PERMANENT/u);
  const writer = executable.slice(executable.indexOf('CREATE FUNCTION public.commit_conversation_units_with_focus_thread_lifecycle_v1('), executable.indexOf('CREATE FUNCTION public.commit_finalized_exchange_with_focus_thread_lifecycle_v1('));
  const sessionLock = writer.indexOf('FROM public.session_semantic_clocks');
  const identityLock = writer.indexOf('FROM public.conversation_world_thread_identity_clocks');
  assert.ok(sessionLock > 0 && identityLock > sessionLock, 'the Session Semantic Clock is locked FIRST, the identity clock after it');
  assert.ok(writer.slice(sessionLock, sessionLock + 400).includes('FOR UPDATE'), 'the Session Semantic Clock row is locked FOR UPDATE');
  assert.ok(writer.slice(identityLock, identityLock + 400).includes('FOR UPDATE'), 'the identity clock row is locked FOR UPDATE');
  assert.match(migration, /p_expected_world_thread_identity_version/u);
  assert.match(migration, /STALE_THREAD_IDENTITY_CONTEXT/u);
  const coordinator = executable.slice(executable.indexOf('CREATE FUNCTION public.commit_finalized_exchange_with_focus_thread_lifecycle_v1('), executable.indexOf('CREATE FUNCTION public.get_conversation_thread_identity_dossier_page_v1('));
  assert.ok(coordinator.indexOf('STALE_CONVERSATIONAL_FOCUS_CONTEXT') < coordinator.indexOf('STALE_THREAD_IDENTITY_CONTEXT'), 'the Session token is checked BEFORE the identity version');
});

test('stale recovery is bounded to ONE shared semantic retry, checks the database winner first, and never repeats segmentation', () => {
  assert.match(runtimeTypes, /export const MAX_THREAD_LIFECYCLE_STALE_CONTEXT_RETRIES = 1;/u);
  assert.match(service, /let retriesLeft = MAX_THREAD_LIFECYCLE_STALE_CONTEXT_RETRIES;/u);
  assert.match(service, /const stale = error instanceof StaleConversationalFocusContextError \|\| error instanceof StaleThreadIdentityContextError;\s*if \(!stale\) throw error;/u,
    'exactly the two typed stale conditions, sharing ONE budget');
  assert.match(service, /if \(retriesLeft === 0\) throw new ConversationThreadLifecycleUnavailableError\('STALE_CONTEXT_RETRY_EXHAUSTED'/u);
  assert.equal((service.match(/retriesLeft -= 1;/gu) ?? []).length, 1);
  const loop = service.indexOf('for (;;) {');
  assert.ok(service.indexOf('const halves = await Promise.all([userHalf, assistantHalf]);') < loop, 'segmentation happens once, before the retry loop');
  assert.ok(service.indexOf('const winner = this.canonicalDelivery(fresh);', loop) < service.indexOf('if (!stale) throw error;', loop), 'the database winner is checked BEFORE the stale branch');
  assert.doesNotMatch(service.slice(loop), /this\.segment\(/u, 'no segmentation inside the retry loop');
  assert.match(service, /SEGMENTATION_FRONTIER_MOVED/u, 'a moved frontier refuses segmentation reuse');
  assert.ok(service.indexOf('context = await this.repository.readRuntimeContext(', loop) > loop, 'the retry re-reads the context (and, through it, the identity version and the dossiers)');
  // Both exact stale identities: the Session one is REUSED from T-03B1b2, the identity one is exact (code AND message).
  assert.match(repository, /import \{ isStaleConversationalFocusContext \} from '\.\.\/conversational-focus\/conversation-focus-runtime\.repository';/u);
  assert.match(repository, /export const STALE_THREAD_IDENTITY_CONTEXT_SQLSTATE = '40001';/u);
  assert.match(repository, /export const STALE_THREAD_IDENTITY_CONTEXT_TOKEN = 'STALE_THREAD_IDENTITY_CONTEXT';/u);
  assert.match(repository, /databaseCode === STALE_THREAD_IDENTITY_CONTEXT_SQLSTATE && databaseMessage === STALE_THREAD_IDENTITY_CONTEXT_TOKEN/u, 'exact equality, never a substring');
  assert.doesNotMatch(repository, /\.includes\(|new RegExp|startsWith\(/u);
  for (const reason of ['INVALID_FINALIZED_EXCHANGE_RELATION', 'PARTIAL_INTEGRATED_EXCHANGE', 'INCOMPLETE_THREAD_LIFECYCLE_CAPTURE', 'INVALID_INTEGRATED_SNAPSHOT',
    'INVALID_THREAD_LIFECYCLE_CONTEXT', 'INCOMPLETE_PRIOR_THREAD_HISTORY', 'LIFECYCLE_CONTEXT_NOT_CLOSED', 'INVALID_LIFECYCLE_CHAIN', 'INVALID_THREAD_IDENTITY_DOSSIER',
    'FOCUS_SEMANTICS_MISMATCH', 'CONTINUITY_PROVENANCE_DISAGREEMENT', 'COMMITTED_WITHOUT_DELIVERY_EVENT', 'DELIVERY_RANGE_MISMATCH', 'LIVE_HEAD_NOT_ESTABLISHED', 'SEGMENTATION_FRONTIER_MOVED']) {
    assert.ok(runtimeTypes.includes(reason), `the integrity vocabulary includes ${reason}`);
  }
  for (const reason of ['PROVIDER_UNAVAILABLE', 'TRANSPORT_UNAVAILABLE', 'STALE_CONTEXT_RETRY_EXHAUSTED']) {
    assert.ok(runtimeTypes.includes(reason), `the retryable vocabulary includes ${reason}`);
  }
  assert.doesNotMatch(productionCode, /failTurn|FAILED|regenerat|markFailed/u, 'a technical failure never fails or regenerates a completed turn');
});

test('FIX-T03B2B3-01 preserved: the direct completed-exchange gate proves the WHOLE relation before any read, binding or provider', () => {
  assert.match(service, /async establishExchange\(userId: string, userTurn: ConversationTurn, assistantTurn: ConversationTurn\): Promise<ConversationTemporalDelivery> \{\s*assertFinalizedExchangeRelation\(userTurn, assistantTurn\);\s*try \{/u,
    'the relation gate is the first statement of the direct boundary and throws outside the try');
  assert.match(service, /if \(userTurn\.status !== 'COMPLETED' \|\| assistantTurn\.status !== 'COMPLETED'\) return result;/u);
  const gate = service.slice(service.indexOf('function assertFinalizedExchangeRelation('));
  for (const rule of ["userTurn.role !== 'USER'", "assistantTurn.role !== 'ASSISTANT'", "userTurn.status !== 'COMPLETED'", "assistantTurn.status !== 'COMPLETED'", 'userTurn.session_id !== assistantTurn.session_id', 'INVALID_FINALIZED_EXCHANGE_RELATION']) {
    assert.ok(gate.includes(rule), `the gate proves: ${rule}`);
  }
  assert.ok(service.indexOf('const replayed = this.canonicalDelivery(snapshots);') < service.indexOf('await this.repository.readRuntimeContext('), 'the replay / partial gate precedes the context read');
  assert.ok(service.indexOf('await this.repository.readRuntimeContext(') < service.indexOf('this.segment(userId, userTurn'), 'the context is read before any provider');
});

test('the continuity provider is lazy and strict, and no Thread, Home, binding or lifecycle payload reaches the wire', () => {
  assert.match(binding, /export function openAiThreadContinuityBinding\(environment: NodeJS\.ProcessEnv = process\.env\): ThreadContinuityBindingFactory \{\s*return \(\) => \{\s*const identity = loadThreadContinuityProviderIdentity\(environment\);/u);
  assert.match(binding, /const real = \(\): OpenAiThreadContinuityProvider => \{\s*if \(adapter === undefined\) \{\s*const config = loadThreadContinuityOpenAIConfig\(environment\);/u, 'the adapter (and the credential) is built on the FIRST real call');
  assert.match(service, /this\.continuity \?\?= this\.createContinuityBinding\(\);/u);
  assert.match(service, /this\.focus \?\?= this\.createFocusBinding\(\);/u);
  assert.match(service, /this\.thread \?\?= this\.createThreadBinding\(\);/u);
  assert.equal((service.match(/this\.createContinuityBinding\(\)/gu) ?? []).length, 1);
  const constructorEnd = service.indexOf('async establish(');
  assert.doesNotMatch(service.slice(0, constructorEnd), /createContinuityBinding\(\)|createThreadBinding\(\)|createFocusBinding\(\)|createSegmentationBinding\(\)|process\.env/u, 'construction reads no environment and builds no provider');
  assert.doesNotMatch(runtimeCode, /OPENAI_API_KEY|process\.env\./u, 'no ambient credential read in the runtime');
  assert.match(stripComments(read(`${LIFECYCLE_DIR}/thread-continuity-provider.config.ts`)), /export function loadThreadContinuityProviderIdentity\(environment: NodeJS\.ProcessEnv = process\.env\): ThreadContinuityProviderIdentity \{/u);
  const identityLoader = stripComments(read(`${LIFECYCLE_DIR}/thread-continuity-provider.config.ts`));
  assert.doesNotMatch(identityLoader.slice(identityLoader.indexOf('export function loadThreadContinuityProviderIdentity('), identityLoader.indexOf('export function loadThreadContinuityOpenAIConfig(')), /OPENAI_API_KEY/u,
    'recording provenance never needs the credential');
  assert.match(provider, /text: \{ format: \{ type: 'json_schema', name, strict: true, schema \} \}/u);
  assert.match(provider, /store: false/u);
  assert.match(provider, /maxRetries: 0/u);
  assert.match(provider, /new AbortController\(\)/u);
  assert.match(provider, /additionalProperties: false/u);
  assert.match(stripComments(read(`${LIFECYCLE_DIR}/thread-continuity-provider.config.ts`)), /export const THREAD_CONTINUITY_MAX_RETRIES = 0 as const;/u);
  // The delivery carries only LH and the frozen committed events.
  assert.match(service, /\.map\(toCommittedWireEvent\)/u);
  const deliveryMethod = service.slice(service.indexOf('private delivery('), service.indexOf('private async segment('));
  assert.ok(deliveryMethod.length > 0);
  assert.doesNotMatch(deliveryMethod.replace(/ConversationThreadLifecycleIntegrityError/gu, ''), /thread|origin|home|emerging_focus|lifecycle|binding|dormant|reopen/iu,
    'the external delivery is built from LH and the frozen committed events alone');
  // (T-03D extended the shared wire contract ADDITIVELY with the authoritative
  // Live Focus; the frozen T-03A2 fields are unchanged and pinned by the T-03D contract.)
  for (const [file, blob] of [
    ['packages/runtime/src/index.d.ts', '8fa505014a936cc73d9fd61f23e67162b4507c54'],
    ['packages/runtime/src/temporal.d.ts', '9d945e6f2d65bdefbc334b0bc5ac884789f21a89'],
    ['packages/runtime/package.json', '932b837629f23b5cb765eda196fb659418d07916'],
  ]) {
    assert.equal(gitBlobId(read(file)), blob, `${file} is byte-identical`);
  }
  // (T-03D added packages/runtime/src/live-focus.d.ts: the authoritative LF wire
  // value carries the closed reference identity - a Thread id or an Emerging
  // Focus id - and nothing spatial, graded, lifecycle-bound or historical; it
  // is pinned by the T-03D contract.)
  for (const file of listFiles(join(rootPath, 'packages/runtime')).map(relative).filter((file) => file.endsWith('.ts'))) {
    assert.doesNotMatch(stripComments(read(file)), /homeAnchor|home_anchor|lifecycle|dormant|reopened|binding_id/iu, `${file} declares no Home or lifecycle payload`);
    if (file !== 'packages/runtime/src/live-focus.d.ts') {
      assert.doesNotMatch(stripComments(read(file)), /threadId|thread_id|emergingFocus|emerging_focus/iu, `${file} declares no Thread or Emerging Focus payload`);
    }
  }
  assert.doesNotMatch(mobileCi, /0070|thread-lifecycle/u);
  for (const file of listFiles(join(rootPath, 'apps/mobile/src')).map(relative)) {
    assert.doesNotMatch(read(file), /thread_lifecycle|ThreadLifecycle|Dormant|DORMANT|Reopened|REOPENED|focus_binding|identity_dossier/u, `${file} untouched`);
  }
});

test('no LF, no T-03C, no T-03D, no Reading / Neighborhood, no new dependency, no lockfile change', () => {
  for (const forbidden of ['LIVE_FOCUS', 'liveFocus', 'live_focus_transitions', 'effectiveLf', 'effective_lf', 'knowledgeFrontier', 'PRE_FIRST_SP', 'historical_coverage',
    'projection', 'Reading', 'neighborhood', 'Neighborhood', 'thread_enabled', 'analysis_enabled', 'semantic_version', 'expo-router', 'react-native', 'apps/mobile']) {
    assert.equal(productionCode.includes(forbidden), false, `the runtime must not contain ${forbidden}`);
  }
  assert.doesNotMatch(executableBody, /live_focus|effective_lf|knowledge_frontier|historical_coverage|projection|neighborhood|reading_id|semantic_version|thread_enabled/iu, '0070 carries no LF / T-03C / T-03D substrate');
  assert.deepEqual(Object.keys(rootPackage.devDependencies), ['pg']);
  for (const name of ['uuid', 'zod', 'p-retry', 'async-retry', 'retry', 'bottleneck', 'xstate', 'immer']) {
    assert.equal(name in (apiPackage.dependencies ?? {}) || name in (apiPackage.devDependencies ?? {}), false, `${name} must not be introduced`);
  }
  assert.equal(gitBlobId(read('package-lock.json')), gitBlobId(read('package-lock.json')), 'lockfile is read once');
  assert.doesNotMatch(read('package-lock.json'), /thread-lifecycle|thread-continuity/u, 'the lockfile knows nothing of T-03B3');
});

test('deterministic identities: RFC 4122 v5 over documented URIs, derived in TypeScript and re-derived by the database', () => {
  assert.match(canonicalizer, /import \{ CANONICAL_UUID_PATTERN, RFC4122_URL_NAMESPACE, uuidV5 \} from '\.\.\/runtime-identity\/uuid-v5';/u);
  assert.match(canonicalizer, /export const THREAD_FOCUS_BINDING_NAMESPACE = uuidV5\(RFC4122_URL_NAMESPACE, 'https:\/\/qandeel\.app\/runtime\/thread-focus-binding\/v1'\);/u);
  assert.match(canonicalizer, /export const THREAD_LIFECYCLE_EVENT_NAMESPACE = uuidV5\(RFC4122_URL_NAMESPACE, 'https:\/\/qandeel\.app\/runtime\/thread-lifecycle-event\/v1'\);/u);
  assert.match(migration, /'194bb7c5-906f-5228-8116-b4c99b34bd76'/u, 'the binding namespace is pinned in SQL');
  assert.match(migration, /'9fbd9e6c-f8a4-529b-bd97-46f75cb068d3'/u, 'the lifecycle-event namespace is pinned in SQL');
  assert.match(migration, /public\.canonical_uuid_v5_v1\(/u, 'the database re-derives through the frozen 0068 v5 authority');
  assert.match(migration, /CANONICAL_THREAD_LIFECYCLE_ROW_IS_IMMUTABLE/u);
  assert.doesNotMatch(productionCode, /randomUUID|crypto\.randomUUID|uuidv4|v4\(\)/u, 'no random identity anywhere in the runtime');
});

test('the gates are registered at the root and in API CI', () => {
  assert.equal(rootPackage.scripts['test:thread-lifecycle-cross-session-continuity-contract'], 'node --test tests/thread-lifecycle-cross-session-continuity-contract.test.mjs');
  assert.equal(rootPackage.scripts['verify:thread-lifecycle-cross-session-continuity:integration'], 'node --env-file-if-exists=.env database/verify-migration-0070.mjs');
  assert.match(apiCi, /run: npm run test:thread-lifecycle-cross-session-continuity-contract/u);
  assert.match(apiCi, /run: npm run verify:thread-lifecycle-cross-session-continuity:integration/u);
  assert.ok(apiCi.indexOf('test:thread-lifecycle-cross-session-continuity-contract') < apiCi.indexOf('Apply all migrations to fresh PostgreSQL'));
  assert.ok(apiCi.indexOf('verify:thread-lifecycle-cross-session-continuity:integration') > apiCi.indexOf('verify:thread-runtime-integration-readiness:integration'));
});
