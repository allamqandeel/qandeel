// T-03B1b1 - Durable Reference / Emerging Focus SP-Native Substrate +
// Per-Moment Integrated DB Writer: the static anti-scope contract.
//
// Secret-free and CI-runnable. Live database semantics are proven by
// database/verify-migration-0066.mjs against real PostgreSQL, and the migration
// text by database/tests/durable-reference-emerging-focus-sp-substrate-v1.
// This contract guards the SHAPE of the slice across the repository: that the
// substrate exists and 0064/0065 are untouched; that no Thread, LF or T-03C
// scope crept in; that nothing new is production-reachable and the T-03A2
// runtime wiring is unchanged; that the integrated per-CU order, the reuse of
// the ONE same-SP seam, and the expected-token check are structurally present;
// that the canonicalizer is deterministic and lets no prepared identity cross;
// and that the frozen vocabularies survive intact.
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
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
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

const MIGRATION = 'database/migrations/0066_durable_reference_emerging_focus_sp_substrate_v1.sql';
const migration = read(MIGRATION);
const executable = stripSql(migration);
const body = stripSql(migration.slice(0, migration.indexOf('-- 15. Terminal self-assertions.')));
const verifier = read('database/verify-migration-0066.mjs');
const canonicalizer = stripComments(read('apps/api/src/conversational-focus/durable-focus-canonicalizer.ts'));
const payloadTypes = stripComments(read('apps/api/src/conversational-focus/durable-focus-payload.types.ts'));
const canonicalizerSpec = read('apps/api/src/conversational-focus/durable-focus-canonicalizer.spec.ts');
const uuidHelper = stripComments(read('apps/api/src/runtime-identity/uuid-v5.ts'));
const identityModule = stripComments(read('apps/api/src/conversation-unit/deterministic-runtime-id.ts'));
const focusTypes = stripComments(read('apps/api/src/conversational-focus/conversational-focus.types.ts'));
const conversationModule = read('apps/api/src/conversation/conversation.module.ts');
const conversationService = read('apps/api/src/conversation/conversation.service.ts');
const establishment = read('apps/api/src/conversation-unit/conversation-temporal-establishment.service.ts');
const unitRepository = read('apps/api/src/conversation-unit/conversation-unit.repository.ts');
const rootPackage = readJson('package.json');
const apiPackage = readJson('apps/api/package.json');
const mobilePackage = readJson('apps/mobile/package.json');
const apiCi = read('.github/workflows/api-ci.yml');
const mobileCi = read('.github/workflows/mobile-ci.yml');

function vocabulary(name) {
  const match = focusTypes.match(new RegExp(`export const ${name} = Object\\.freeze\\(\\[([\\s\\S]*?)\\] as const\\);`, 'u'));
  assert.ok(match, `${name} is a frozen as-const vocabulary`);
  return [...match[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
}

test('migration 0066 exists, is the newest, and 0064 / 0065 are byte-identical', () => {
  const migrations = readdirSync(join(rootPath, 'database/migrations')).filter((name) => name.endsWith('.sql')).sort();
  // (T-03B1b2 added 0067, a read/audit-only migration pinned by its own contract.)
  assert.ok(migrations.includes('0066_durable_reference_emerging_focus_sp_substrate_v1.sql'));
  assert.ok(migrations.indexOf('0066_durable_reference_emerging_focus_sp_substrate_v1.sql') > migrations.indexOf('0065_session_semantic_clock_sp_lh_delivery_v1.sql'));
  assert.equal(gitBlobId(read('database/migrations/0064_committed_conversational_unit_substrate_v1.sql')), '0a2ee63980e59072b3e9f52a643efa8220e95b08');
  assert.equal(gitBlobId(read('database/migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql')), '3dc061c71bcb237cec648abb2d1fa02f450cd57f');
  assert.equal(gitBlobId(read('database/verify-migration-0065.mjs')), '132841c718ba1e2368ecc639b49dadff82b79ddb');
  assert.ok(existsSync(new URL('database/verify-migration-0066.mjs', root)));
  assert.ok(existsSync(new URL('database/tests/durable-reference-emerging-focus-sp-substrate-v1.test.mjs', root)));
  assert.doesNotMatch(executable, /CREATE OR REPLACE|DROP /u, '0066 replaces and drops nothing');
});

test('no Product-semantic Thread / LF / T-03C scope creep, anywhere in the slice', () => {
  const sliceCode = [body, canonicalizer, payloadTypes, uuidHelper].join('\n');
  for (const forbidden of ['ThreadEstablished', 'thread_id', 'threadId', 'Thread(', 'ThreadHome', 'home_sp', 'homeSp', 'lifecycle',
    'live_focus', 'LIVE_FOCUS', 'liveFocus', 'live_focus_transitions', 'LIVE_FOCUS_TRANSITION', 'effectiveLF',
    'knowledge_frontier', 'knowledgeFrontier', 'version_frontier', 'PRE_FIRST_SP', 'pre_first_sp', 'historical_enabled',
    'timeline', 'Timeline', 'WORLD_ANCHOR', 'MapState', 'projection']) {
    assert.equal(sliceCode.includes(forbidden), false, `the slice must not contain ${forbidden}`);
  }
  // No timestamp decides anything: the only timestamps are audit defaults.
  const timestamps = body.match(/timestamptz|CURRENT_TIMESTAMP|now\(\)|clock_timestamp/gu) ?? [];
  const auditDefaults = body.match(/created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP/gu) ?? [];
  assert.equal(timestamps.length, auditDefaults.length * 2, 'every timestamp token is an audit default');
  assert.doesNotMatch(body, /ORDER BY [^;]*created_at|created_at\s*[<>=]/u);
  // No score / embedding / keyword / timer authority.
  assert.doesNotMatch(sliceCode, /score|embedding|similarity|cosine|keyword|levenshtein|setTimeout|setInterval|Date\.now|new Date/iu);
  // No new third-party dependency anywhere.
  assert.deepEqual(Object.keys(rootPackage.devDependencies), ['pg']);
  for (const name of ['uuid', 'nanoid', 'zod', 'knex', 'prisma', 'pg-promise', 'postgres', 'kysely', 'drizzle-orm']) {
    assert.equal(name in (apiPackage.dependencies ?? {}) || name in (apiPackage.devDependencies ?? {}) || name in (mobilePackage.dependencies ?? {}), false, `${name} must not be introduced`);
  }
  assert.deepEqual([...uuidHelper.matchAll(/from\s+'([^']+)'/gu)].map((m) => m[1]), ['node:crypto'], 'identity derivation uses Node crypto alone');
});

test('the new writer, coordinator and context read are production-inert; the T-03A2 runtime wiring is unchanged', () => {
  assert.doesNotMatch(executable, /GRANT /u, 'the migration grants nothing');
  for (const fn of ['commit_conversation_units_with_focus_v1', 'commit_finalized_exchange_with_focus_v1', 'get_conversation_focus_runtime_context_v1']) {
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM service_role`, 'u'), `${fn} is revoked from service_role`);
  }
  // The T-03A2 seam stays internal: 0066 neither grants it nor re-declares it,
  // and its self-assertion refuses any application role holding EXECUTE on it.
  assert.doesNotMatch(executable, /reserve_session_same_sp_event_v1\(uuid,uuid\) TO /u);
  assert.match(migration, /same_sp_helper constant text := 'public\.reserve_session_same_sp_event_v1\(uuid,uuid\)'/u);
  // Nothing in the API runtime references the new database functions or the canonicalizer.
  const referencing = listFiles(join(rootPath, 'apps/api/src'))
    .map(relative)
    .filter((file) => !file.startsWith('apps/api/src/conversational-focus/'))
    // T-03B2a (thread-establishment, production-inert) consumes ONLY the pure
    // B1 payload/semantic TYPES; it is pinned separately just below.
    .filter((file) => !file.startsWith('apps/api/src/thread-establishment/'))
    .filter((file) => /with_focus_v1|focus_runtime_context|durable-focus|canonicalizePreparedFocusSequence|conversational-focus/u.test(stripComments(read(file))));
  assert.deepEqual(referencing, [], 'no runtime path reaches the T-03B1b1 substrate or canonicalizer');
  // The T-03B2a evaluator may import only the two pure type modules, never the
  // canonicalizer, the durable identity derivation or the 0066 RPCs.
  const threadFiles = listFiles(join(rootPath, 'apps/api/src/thread-establishment')).map(relative);
  assert.ok(threadFiles.length > 0, 'the T-03B2a directory exists');
  // T-03B2b2 derives its OWN Thread / Home / event identities from the neutral
  // `runtime-identity/uuid-v5` helper under its own frozen namespace URIs. It
  // may therefore name `uuidV5`, but never this slice's canonicalizer, its
  // derivation functions, its namespaces or the 0066 RPCs.
  const B2B2_IDENTITY_FILES = new Set([
    'apps/api/src/thread-establishment/durable-thread-canonicalizer.ts',
    'apps/api/src/thread-establishment/durable-thread-canonicalizer.spec.ts',
  ]);
  // T-03B2b3's production-inert runtime orchestration is the ONE consumer that
  // must RUN the frozen B1 chain before its own B2 chain, so it may import the
  // B1 evaluator, canonicalizer, binding and runtime types and name their
  // exported helpers. It still never calls a 0066 RPC itself: its only write is
  // the existing 0068 coordinator, and its only reads are the 0069 ones.
  const B2B3_RUNTIME_FILES = new Set([
    'conversation-thread-runtime.types.ts', 'conversation-thread-runtime.repository.ts',
    'conversation-thread-runtime-mapper.ts', 'conversation-thread-establishment.service.ts',
    'thread-establishment-binding.ts', 'conversational-origin-mapper.ts',
    'conversation-thread-runtime.repository.spec.ts', 'conversation-thread-runtime-mapper.spec.ts',
    'conversation-thread-establishment.service.spec.ts', 'conversational-origin-mapper.spec.ts',
  ]);
  const B2B3_ALLOWED_FOCUS_IMPORTS = new Set([
    '../conversational-focus/conversational-focus.types',
    '../conversational-focus/durable-focus-payload.types',
    '../conversational-focus/conversational-focus-evaluator.service',
    '../conversational-focus/durable-focus-canonicalizer',
    '../conversational-focus/focus-resolution-binding',
    '../conversational-focus/focus-resolution-provider.config',
    '../conversational-focus/focus-resolution-provider.types',
    '../conversational-focus/conversation-focus-runtime.types',
    '../conversational-focus/conversation-focus-runtime.repository',
  ]);
  for (const file of threadFiles) {
    const source = read(file);
    const runtime = B2B3_RUNTIME_FILES.has(file.slice(file.lastIndexOf('/') + 1));
    for (const match of source.matchAll(/from\s+'([^']*(?:conversational-focus|durable-focus)[^']*)'/gu)) {
      if (runtime) assert.ok(B2B3_ALLOWED_FOCUS_IMPORTS.has(match[1]), `${file} may import only the listed B1 pieces; found ${match[1]}`);
      else {
        assert.ok(['../conversational-focus/conversational-focus.types', '../conversational-focus/durable-focus-payload.types'].includes(match[1]),
          `${file} may import only the B1 type authorities; found ${match[1]}`);
      }
    }
    assert.doesNotMatch(stripComments(source), /with_focus_v1\b|focus_runtime_context|EMERGING_FOCUS_NAMESPACE|REFERENCE_HANDLE_NAMESPACE/u,
      `${file} never calls a 0066 RPC and derives no T-03B1 identity namespace of its own`);
    if (!runtime) {
      assert.doesNotMatch(stripComments(source), /durable-focus-canonicalizer|canonicalizePreparedFocusSequence|durableEmergingFocusId|durableReferenceHandleId/u,
        `${file} does not reach the T-03B1b1 canonicalizer or identity derivation`);
    }
    if (!B2B2_IDENTITY_FILES.has(file)) {
      assert.doesNotMatch(stripComments(source), /uuidV5/u, `${file} derives no durable identity of its own`);
    } else {
      assert.match(source, /from '\.\.\/runtime-identity\/uuid-v5'/u, `${file} uses the ONE neutral v5 helper, never a second algorithm`);
    }
  }
  for (const [name, text] of [['ConversationModule', conversationModule], ['ConversationService', conversationService],
    ['the T-03A2 establishment service', establishment], ['the T-03A2 unit repository', unitRepository]]) {
    assert.doesNotMatch(stripComments(text), /with_focus|focus|Focus|canonicaliz/u, `${name} is untouched by T-03B1b1`);
  }
  assert.match(unitRepository, /commit_finalized_exchange_conversation_units_v1|commit_conversation_units_v1/u, 'the T-03A2 runtime still calls the legacy producer path');
  // No scripts entry point, no mobile reference.
  for (const file of [...listFiles(join(rootPath, 'apps/api/scripts')), ...listFiles(join(rootPath, 'apps/mobile/src'))].map(relative)) {
    assert.doesNotMatch(read(file), /with_focus_v1|focus_runtime_context|durable-focus|emerging_focus/u, `${file} does not reach the substrate`);
  }
  // Mobile CI is not touched (MOB-CI-01 preserved).
  assert.doesNotMatch(mobileCi, /durable-reference|0066/u);
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3);
});

test('the per-CU integrated order is structurally present and reuses the ONE same-SP seam', () => {
  const writer = migration.slice(migration.indexOf('CREATE FUNCTION public.commit_conversation_units_with_focus_v1'), migration.indexOf('-- 12. The atomic finalized-exchange coordinator'));
  const clock = writer.indexOf('FROM public.session_semantic_clocks c');
  const turn = writer.indexOf('FROM public.conversation_turns t');
  const loop = writer.indexOf('FOR idx IN 1 .. unit_count LOOP');
  const insert = writer.indexOf('INSERT INTO public.conversation_units (', loop);
  const head = writer.indexOf('SET current_sp = this_sp, same_sp_event_sequence = 0', loop);
  const reserve = writer.indexOf('FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r', loop);
  const persist = writer.indexOf('PERFORM public.persist_conversation_unit_focus_semantics_v1(', loop);
  const endLoop = writer.indexOf('END LOOP;', persist);
  assert.ok(clock > 0 && turn > clock && loop > turn && insert > loop && head > insert && reserve > head && persist > reserve && endLoop > persist,
    'clock lock -> source turn -> per CU: SP insert -> open head -> seam reservation -> semantic bundle -> next CU');
  assert.equal((stripSql(writer).match(/reserve_session_same_sp_event_v1/gu) ?? []).length, 1, 'the writer calls the existing seam and creates no second sequence authority');
  assert.doesNotMatch(stripSql(writer), /same_sp_event_sequence \+ 1/u);
  assert.doesNotMatch(executable, /CREATE SEQUENCE|nextval\(/u);
  assert.match(writer, /reserved_sp IS DISTINCT FROM this_sp OR reserved_sequence IS DISTINCT FROM 1::bigint/u);
  // The same-SP sequence is never caller-supplied: no parameter of any new
  // function carries it, and the persistence helper only receives what the
  // seam returned inside the writer.
  for (const signature of [...migration.matchAll(/CREATE FUNCTION public\.\w+\(([\s\S]*?)\)\s*(?:RETURNS|LANGUAGE)/gu)].map((m) => m[1])) {
    assert.doesNotMatch(signature, /p_same_sp_event_sequence\b|p_session_position|p_sp\b|p_live_head/u, 'no caller supplies SP or the same-SP sequence');
  }
  assert.match(writer, /PERFORM public\.persist_conversation_unit_focus_semantics_v1\(\s*inserted_cu, p_batch_id, p_focus_units -> \(idx - 1\), reserved_sequence\)/u);
});

test('the expected-token check happens after the clock lock and before any semantic mutation', () => {
  const coordinator = migration.slice(migration.indexOf('CREATE FUNCTION public.commit_finalized_exchange_with_focus_v1'), migration.indexOf('-- 13. The internal authoritative focus-context snapshot'));
  const clock = coordinator.indexOf('FOR UPDATE');
  const stale = coordinator.indexOf("RAISE EXCEPTION 'STALE_CONVERSATIONAL_FOCUS_CONTEXT'");
  const write = coordinator.indexOf('public.commit_conversation_units_with_focus_v1(');
  assert.ok(clock > 0 && stale > clock && write > stale, 'lock -> token check -> writes');
  assert.doesNotMatch(coordinator.slice(0, stale), /INSERT INTO|UPDATE public|commit_conversation_units/u, 'nothing is written before the token is checked');
  assert.match(coordinator, /p_expected_current_sp integer,\s*\n\s*p_expected_same_sp_event_sequence bigint/u);
  assert.match(coordinator, /USING ERRCODE='40001'/u);
});

test('emerging_focus_id is stable, session-scoped and non-geographic; focus uniqueness is structural', () => {
  const focus = migration.slice(migration.indexOf('CREATE TABLE public.conversation_emerging_focuses'), migration.indexOf('CREATE TABLE public.conversation_emerging_focus_attention_events'));
  assert.match(focus, /id uuid PRIMARY KEY/u);
  assert.match(focus, /grounding_handle_id uuid NOT NULL/u);
  assert.match(focus, /UNIQUE \(session_id, grounding_handle_id\)/u);
  assert.doesNotMatch(stripSql(focus), /thread|home|status|active|score|confidence|label|geometry|position_x|anchor|camera/iu, 'no geography, lifecycle or score lives on an Emerging Focus');
  assert.match(canonicalizer, /uuidV5\(EMERGING_FOCUS_NAMESPACE, `\$\{sessionId\}:\$\{startedCuId\}`\)/u, 'emerging_focus_id is derived deterministically from session + starting CU');
  assert.match(canonicalizer, /uuidV5\(REFERENCE_HANDLE_NAMESPACE, `\$\{sessionId\}:\$\{cuId\}:\$\{referenceIndex\}`\)/u);
  // Raw source here: the comment stripper would cut a `https://` URL in half.
  const rawCanonicalizer = read('apps/api/src/conversational-focus/durable-focus-canonicalizer.ts');
  assert.match(rawCanonicalizer, /uuidV5\(RFC4122_URL_NAMESPACE, 'https:\/\/qandeel\.app\/runtime\/reference-handle\/v1'\)/u);
  assert.match(rawCanonicalizer, /uuidV5\(RFC4122_URL_NAMESPACE, 'https:\/\/qandeel\.app\/runtime\/emerging-focus\/v1'\)/u);
  assert.match(canonicalizerSpec, /'095fa725-c218-5130-aead-f5f1472fab74'/u, 'the reference-handle namespace vector is pinned');
  assert.match(canonicalizerSpec, /'4ef8538d-ddda-5e11-b7d9-052be85de59a'/u, 'the Emerging Focus namespace vector is pinned');
  // The T-03A2 identity module still exposes the same algorithm (re-exported) and the same vectors.
  assert.match(identityModule, /export \{ uuidV5 \};/u);
  assert.match(read('apps/api/src/conversation-unit/deterministic-runtime-id.spec.ts'), /'886313e1-3b8a-5372-9b90-0c9aee199e5d'/u, 'the RFC 4122 test vector is still pinned');
});

test('prepared identities are rejected or absent at the database boundary', () => {
  assert.match(canonicalizer, /if \(JSON\.stringify\(units\)\.includes\(PREPARED_ID_PREFIX\)\) \{\s*throw new FocusCanonicalizationError\('PREPARED_IDENTITY_LEAKED'\);/u);
  assert.match(canonicalizer, /UNKNOWN_PREPARED_REFERENCE/u);
  assert.match(canonicalizer, /UNKNOWN_PREPARED_FOCUS/u);
  assert.match(canonicalizer, /CANONICAL_UUID_PATTERN\.test\(value\)/u, 'every durable identity is a canonical UUID');
  assert.doesNotMatch(payloadTypes, /prepared/u, 'the durable payload type has no prepared field');
  assert.match(payloadTypes, /DURABLE_CLAIMANT_KINDS = Object\.freeze\(\['CURRENT_CONVERSATIONAL_SPEAKER', 'REFERENCE_HANDLE', 'UNRESOLVED'\] as const\)/u);
  assert.match(body, /~\* uuid_shape/u, 'the database admits canonical UUID identities only');
  assert.doesNotMatch(body, /prepared:|PREPARED_ID_PREFIX|prepared_/u, 'the database knows no prepared identity prefix or column');
  assert.match(verifier, /prepared:reference:x:0/u);
  assert.match(verifier, /prepared:focus:x/u);
  assert.match(verifier, /NEW_CURRENT_CU_REFERENCE/u, 'the prepared claimant pointer is proven unrepresentable');
});

test('the frozen vocabularies are preserved end to end', () => {
  const functions = vocabulary('CONVERSATIONAL_FUNCTIONS');
  assert.deepEqual(functions, ['INFORM_REPORT', 'ASK', 'REQUEST', 'ACKNOWLEDGE', 'AGREE', 'DISAGREE_CHALLENGE', 'ELABORATE', 'CLARIFY', 'CORRECT', 'RECALL', 'FOCUS_SHIFT', 'FUNCTION_UNRESOLVED']);
  const frozenList = new RegExp(`ARRAY\\[${functions.map((fn) => `'${fn}'`).join(',\\s*')}\\]`, 'gu');
  const sqlFunctions = body.match(frozenList) ?? [];
  assert.ok(sqlFunctions.length >= 2, 'the CHECK constraint and the writer both carry the exact frozen function vocabulary');
  assert.deepEqual(vocabulary('SEQUENCE_POSITIONS'), ['UNMARKED', 'INITIATING', 'RESPONSIVE', 'FOLLOW_UP']);
  assert.match(body, /ARRAY\['UNMARKED','INITIATING','RESPONSIVE','FOLLOW_UP'\]/u);
  assert.deepEqual(vocabulary('REFERENCE_RESOLUTION_STATES'), ['RESOLVED', 'AMBIGUOUS', 'UNRESOLVED']);
  assert.match(body, /ref_state NOT IN \('RESOLVED', 'AMBIGUOUS', 'UNRESOLVED'\)/u);
  assert.deepEqual(vocabulary('ATTENTION_KINDS'), ['NO_INDEPENDENT_FOCUS', 'ATTEND_EXISTING_FOCUS', 'START_NEW_FOCUS']);
  assert.match(body, /CHECK \(attention_kind IN \('NO_INDEPENDENT_FOCUS','ATTEND_EXISTING_FOCUS','START_NEW_FOCUS'\)\)/u);
  assert.deepEqual(vocabulary('ATTENTION_REASONS'), ['INCIDENTAL_OR_SUBORDINATE', 'DIRECT_SUBJECT', 'EXPLICIT_FOCUS_SHIFT', 'DIRECT_REQUEST_OR_QUESTION', 'SUBSTANTIVE_ELABORATION', 'LOCAL_CLARIFICATION_OR_CORRECTION', 'UNRESOLVED_ATTENTION']);
  assert.deepEqual(vocabulary('CLAIM_FRAMES'), ['DIRECT_ASSERTION', 'REPORTED_SPEECH', 'DIRECT_QUOTATION']);
  assert.match(body, /claim_frame IN \('DIRECT_ASSERTION','REPORTED_SPEECH','DIRECT_QUOTATION'\)/u);
  // The T-03B1a evaluator itself is unchanged in meaning: still four claimant kinds, one of them prepared-only.
  assert.deepEqual(vocabulary('CLAIMANT_KINDS'), ['CURRENT_CONVERSATIONAL_SPEAKER', 'REFERENCE_HANDLE', 'NEW_CURRENT_CU_REFERENCE', 'UNRESOLVED']);
});

test('the gates are registered at the root and in API CI', () => {
  assert.equal(rootPackage.scripts['test:durable-reference-emerging-focus-sp-substrate-contract'], 'node --test tests/durable-reference-emerging-focus-sp-substrate-contract.test.mjs');
  assert.equal(rootPackage.scripts['verify:durable-reference-emerging-focus-sp-substrate:integration'], 'node --env-file-if-exists=.env database/verify-migration-0066.mjs');
  assert.match(apiCi, /run: npm run test:durable-reference-emerging-focus-sp-substrate-contract/u);
  assert.match(apiCi, /run: npm run verify:durable-reference-emerging-focus-sp-substrate:integration/u);
  assert.ok(apiCi.indexOf('test:durable-reference-emerging-focus-sp-substrate-contract') < apiCi.indexOf('Apply all migrations to fresh PostgreSQL'));
  assert.ok(apiCi.indexOf('verify:durable-reference-emerging-focus-sp-substrate:integration') > apiCi.indexOf('verify:session-semantic-clock-sp-lh-delivery:integration'));
  assert.equal((apiCi.match(/verify:durable-reference-emerging-focus-sp-substrate:integration/gu) ?? []).length, 1);
});
