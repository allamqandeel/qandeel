// T-03B2b2 - Durable Thread + Permanent Home + Same-SP DB Substrate: the
// static anti-scope contract.
//
// Secret-free and CI-runnable. Live database semantics are proven by
// database/verify-migration-0068.mjs against real PostgreSQL, and the migration
// text by database/tests/durable-thread-home-same-sp-substrate-v1.test.mjs.
// This contract guards the SHAPE of the slice across the repository: that the
// substrate exists and 0064-0067 are untouched; that the frozen T-03B2a
// evaluator and the frozen T-03B2b1 Home placement engine are byte-identical;
// that QANDEEL_OSDAP_V1 is mirrored in SQL with its exact constants and that no
// caller can author a permanent coordinate; that the Session clock is locked
// before the one user-world lock and that B1 holds same-SP sequence 1 before an
// optional B2 sequence 2; that a non-establishment reserves nothing; that there
// is no Thread without its Home, no relocation API, no parent or primary
// origin, no merge, no lifecycle, no LF and no T-03C; that nothing new is
// production-reachable and the T-03A2 runtime wiring is unchanged; and that the
// canonicalizer is deterministic, owner-scoped and geography-free.
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
/** Executable code only: prose may name a forbidden construct in order to forbid it. */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
const stripSql = (text) => text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const stripProse = (text) => text.replace(/DETAIL='[\s\S]*?';/gu, "DETAIL='';");
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
const HOME_DIR = `${THREAD_DIR}/home-placement`;
const MIGRATION = 'database/migrations/0068_durable_thread_home_same_sp_substrate_v1.sql';
const migration = read(MIGRATION);
const executable = stripSql(migration);
const body = stripSql(migration.slice(0, migration.indexOf('-- 17. Terminal self-assertions.')));
const verifier = read('database/verify-migration-0068.mjs');
const payloadTypes = stripComments(read(`${THREAD_DIR}/durable-thread-payload.types.ts`));
const rawCanonicalizer = read(`${THREAD_DIR}/durable-thread-canonicalizer.ts`);
const canonicalizer = stripComments(rawCanonicalizer);
const canonicalizerSpec = read(`${THREAD_DIR}/durable-thread-canonicalizer.spec.ts`);
const vectors = read(`${HOME_DIR}/home-placement-vectors.ts`);
const conversationModule = read('apps/api/src/conversation/conversation.module.ts');
const conversationService = read('apps/api/src/conversation/conversation.service.ts');
const appModule = read('apps/api/src/app.module.ts');
const focusEstablishment = read('apps/api/src/conversational-focus/conversation-focus-establishment.service.ts');
const unitRepository = read('apps/api/src/conversation-unit/conversation-unit.repository.ts');
const rootPackage = readJson('package.json');
const apiPackage = readJson('apps/api/package.json');
const mobilePackage = readJson('apps/mobile/package.json');
const apiCi = read('.github/workflows/api-ci.yml');
const mobileCi = read('.github/workflows/mobile-ci.yml');
const doc = read('docs/durable-thread-home-same-sp-substrate-v1.md');
const docsIndex = read('docs/README.md');

/** The T-03B2a evaluator and the T-03B2b1 placement engine, pinned blob by blob. */
const FROZEN_BLOBS = {
  [`${THREAD_DIR}/fake-thread-establishment.provider.ts`]: 'cb6245af8b2dc2f9db773cf3e3078276a4e82694',
  [`${THREAD_DIR}/index.ts`]: '6e7e8fa4223413873185fe85ed6df92438cd98ec',
  [`${THREAD_DIR}/openai-thread-establishment.provider.spec.ts`]: 'e64dd08c083019bfa3f3088f62ac702fa8e1df83',
  [`${THREAD_DIR}/openai-thread-establishment.provider.ts`]: '5135e056beb4ca5facb761422703f4b69d922a81',
  [`${THREAD_DIR}/thread-establishment-evaluator.service.spec.ts`]: '800f3e2580c5624106f25ba93621f14d80b0e2ee',
  [`${THREAD_DIR}/thread-establishment-evaluator.service.ts`]: '8440bf21a042ced27c710eee06ea5e016f122e86',
  [`${THREAD_DIR}/thread-establishment-provider.config.ts`]: 'f80bc72dbb75f54841ca42678755206c41c907d3',
  [`${THREAD_DIR}/thread-establishment-provider.types.ts`]: 'e3d26e9554f50c597763c49b1676d5d123368aac',
  [`${THREAD_DIR}/thread-establishment-validator.spec.ts`]: 'b830569f4ff73c15139490738f305671527641d9',
  [`${THREAD_DIR}/thread-establishment-validator.ts`]: '9b515e4eb15491e6899a87a887683ebf1a33a92a',
  [`${THREAD_DIR}/thread-establishment.types.ts`]: 'b76b1c59b30582d8d5de1dde75121a05aa532702',
  [`${HOME_DIR}/home-placement-engine.spec.ts`]: '23f1cecfd1ca73de732f314037b82e3dae8b7ea9',
  [`${HOME_DIR}/home-placement-engine.ts`]: '8808fb257be3143af0c0f5e38539aed08d98e30f',
  [`${HOME_DIR}/home-placement-scenario.ts`]: '509ddf69fafe9f4121eb773f887767e88624a851',
  [`${HOME_DIR}/home-placement-stress.spec.ts`]: '3777809703b76684da429f67ca9cc44d50bfc409',
  [`${HOME_DIR}/home-placement-vectors.ts`]: 'd5d29cacdb188bdfa42a9f053420b26109b537c3',
  [`${HOME_DIR}/home-placement.types.ts`]: 'af074b8f6799e7ec4e2b3dc7a558a5476b256f29',
  [`${HOME_DIR}/index.ts`]: '63a3720a6fca3c6cbad1d4363af1d626728f9dd6',
  [`${HOME_DIR}/sha256-canonical.ts`]: 'fc943b5af77e94c12dab5f5ea68077de03f52560',
  'apps/api/src/runtime-identity/uuid-v5.ts': '90d8f820a13f2b75f416448f881ebdbc8de12590',
};

test('migration 0068 is the newest DURABLE substrate, and 0064 / 0065 / 0066 / 0067 are byte-identical', () => {
  const migrations = readdirSync(join(rootPath, 'database/migrations')).filter((name) => name.endsWith('.sql')).sort();
  // (T-03B2b3 added 0069, a READ / AUDIT-only migration that creates no table
  // and reuses this migration's `conversation_thread_batch_state_v1` as the
  // single structural B2 completeness authority; it is pinned by
  // tests/thread-runtime-integration-readiness-contract.test.mjs.)
  assert.ok(migrations.includes('0068_durable_thread_home_same_sp_substrate_v1.sql'));
  assert.equal(migrations.filter((name) => name.startsWith('0068_')).length, 1, 'exactly one 0068 migration exists');
  // (T-03B3 added 0070, which creates its OWN Session-local lifecycle /
  // continuity tables and never a second Thread, Home, event, evidence, origin
  // or B2 capture table; it is pinned by its own contract.)
  for (const later of migrations.slice(migrations.indexOf('0068_durable_thread_home_same_sp_substrate_v1.sql') + 1)) {
    assert.doesNotMatch(read(`database/migrations/${later}`),
      /CREATE TABLE public\.(?:conversation_world_spatial_authorities|conversation_threads|conversation_thread_homes|conversation_thread_establishment_events|conversation_thread_establishment_evidence|conversation_thread_origin_members|conversation_thread_commit_batches)\b/u,
      `${later} creates no second Thread or Home substrate`);
  }
  assert.equal(gitBlobId(read('database/migrations/0064_committed_conversational_unit_substrate_v1.sql')), '0a2ee63980e59072b3e9f52a643efa8220e95b08');
  assert.equal(gitBlobId(read('database/migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql')), '3dc061c71bcb237cec648abb2d1fa02f450cd57f');
  assert.equal(gitBlobId(read('database/migrations/0066_durable_reference_emerging_focus_sp_substrate_v1.sql')), '9f0588d5ca46329a8721ee30302f49d227a357ae');
  assert.equal(gitBlobId(read('database/migrations/0067_conversation_focus_runtime_integration_readiness_v1.sql')), 'd12a3f552e80709ee1d20887f55f1c84e84f9208');
  // (T-03D re-anchored the 0066 / 0067 verifiers' T-03A2 grant posture to the cutover: the temporal-only producer is retired.)
  assert.equal(gitBlobId(read('database/verify-migration-0066.mjs')), '13ccb087e415a316609b1121f937ca3699c59ba4');
  assert.equal(gitBlobId(read('database/verify-migration-0067.mjs')), '0e496a95da7a0ee596c416e0c599f703c121b991');
  assert.ok(existsSync(new URL('database/verify-migration-0068.mjs', root)));
  assert.ok(existsSync(new URL('database/tests/durable-thread-home-same-sp-substrate-v1.test.mjs', root)));
  assert.doesNotMatch(executable, /CREATE OR REPLACE|DROP /u, '0068 replaces and drops nothing');
});

test('the frozen T-03B2a evaluator and T-03B2b1 placement engine are byte-identical; the directory grew by exactly three files', () => {
  for (const [path, blob] of Object.entries(FROZEN_BLOBS)) {
    assert.equal(gitBlobId(read(path)), blob, `${path} must stay byte-identical`);
  }
  const entries = readdirSync(join(rootPath, THREAD_DIR), { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
  // (T-03B2b3 adds exactly the ten runtime / Origin files listed last; they are
  // pinned by tests/thread-runtime-integration-readiness-contract.test.mjs.)
  assert.deepEqual(files, [
    'conversation-thread-establishment.service.spec.ts', 'conversation-thread-establishment.service.ts',
    'conversation-thread-runtime-mapper.spec.ts', 'conversation-thread-runtime-mapper.ts',
    'conversation-thread-runtime.repository.spec.ts', 'conversation-thread-runtime.repository.ts',
    'conversation-thread-runtime.types.ts', 'conversational-origin-mapper.spec.ts', 'conversational-origin-mapper.ts',
    'durable-thread-canonicalizer.spec.ts', 'durable-thread-canonicalizer.ts', 'durable-thread-payload.types.ts',
    'fake-thread-establishment.provider.ts', 'index.ts', 'openai-thread-establishment.provider.spec.ts',
    'openai-thread-establishment.provider.ts', 'thread-establishment-binding.ts',
    'thread-establishment-evaluator.service.spec.ts',
    'thread-establishment-evaluator.service.ts', 'thread-establishment-provider.config.ts',
    'thread-establishment-provider.types.ts', 'thread-establishment-validator.spec.ts',
    'thread-establishment-validator.ts', 'thread-establishment.types.ts',
  ], 'T-03B2b2 adds exactly the payload types, the canonicalizer and its suite; T-03B2b3 adds exactly the runtime chain');
  assert.deepEqual(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(), ['home-placement']);
  // The new boundary is pure: no Nest, no I/O, no database, no clock, no randomness.
  for (const [name, text] of [['payload types', payloadTypes], ['canonicalizer', canonicalizer]]) {
    assert.doesNotMatch(text, /@Injectable\(|@Module\(|@Controller\(|from '@nestjs\//u, `${name} carries no Nest decorator`);
    assert.doesNotMatch(text, /require\(|\bimport\(/u, `${name} loads nothing dynamically`);
    for (const forbidden of ['serviceApi', 'dataApi', 'SupabaseClient', '.rpc(', '.rpc<', "from 'pg'", 'INSERT INTO', 'UPDATE ',
      'randomUUID', 'Date.now', 'new Date', 'setTimeout', 'Math.random', 'process.env.', 'fs.', 'readFile', 'writeFile']) {
      assert.equal(text.includes(forbidden), false, `the ${name} must not contain ${forbidden}`);
    }
  }
  for (const source of [payloadTypes, canonicalizer, stripComments(canonicalizerSpec)]) {
    for (const match of source.matchAll(/from\s+'([^']+)'/gu)) {
      assert.ok(['./thread-establishment.types', './durable-thread-payload.types', './durable-thread-canonicalizer',
        '../runtime-identity/uuid-v5', '../conversational-focus/conversational-focus.types'].includes(match[1]),
      `only the frozen type authorities and the neutral UUID helper may be imported; found ${match[1]}`);
    }
  }
  // The T-03B2a index still exposes neither nested slice.
  assert.doesNotMatch(read(`${THREAD_DIR}/index.ts`), /durable-thread|home-placement/u);
});

test('canonical identity is user/world-scoped, derived, geography-free and never provider-authored', () => {
  // Raw source: the comment stripper would cut a `https://` URI in half.
  assert.match(rawCanonicalizer, /uuidV5\(RFC4122_URL_NAMESPACE, 'https:\/\/qandeel\.app\/world\/thread\/v1'\)/u);
  assert.match(rawCanonicalizer, /uuidV5\(RFC4122_URL_NAMESPACE, 'https:\/\/qandeel\.app\/world\/home-anchor\/v1'\)/u);
  assert.match(rawCanonicalizer, /uuidV5\(RFC4122_URL_NAMESPACE, 'https:\/\/qandeel\.app\/runtime\/thread-established\/v1'\)/u);
  assert.match(canonicalizer, /uuidV5\(THREAD_NAMESPACE, `\$\{userId\}:\$\{emergingFocusId\}`\)/u, 'thread_id = uuidV5(THREAD_NAMESPACE, userId + ":" + emergingFocusId)');
  assert.match(canonicalizer, /uuidV5\(HOME_ANCHOR_NAMESPACE, threadId\)/u);
  assert.match(canonicalizer, /uuidV5\(THREAD_EVENT_NAMESPACE, threadId\)/u);
  assert.doesNotMatch(canonicalizer, /sessionId/u, 'a canonical Thread belongs to the user world, never to the Session');
  // The pinned namespace and identity vectors.
  for (const vector of ['973d2e95-15d7-593c-953d-84ee94be343c', 'ca3acc01-e866-5d84-a15a-5be440c1919e',
    '47cd6b25-dbf8-5fd3-941f-eff9d2386990', 'afc4fd81-fe54-5738-9545-e1053044d919',
    '61cbba23-76ef-5aea-a453-50aed3a8006b', '76cb9266-87d0-53ac-8fae-f6242f9583ea']) {
    assert.ok(canonicalizerSpec.includes(vector), `the identity vector ${vector} is pinned`);
  }
  assert.match(canonicalizerSpec, /THREAD_NAMESPACE\)\.toBe\('973d2e95-15d7-593c-953d-84ee94be343c'\)/u);
  assert.match(canonicalizerSpec, /HOME_ANCHOR_NAMESPACE\)\.toBe\('ca3acc01-e866-5d84-a15a-5be440c1919e'\)/u);
  assert.match(canonicalizerSpec, /THREAD_EVENT_NAMESPACE\)\.toBe\('47cd6b25-dbf8-5fd3-941f-eff9d2386990'\)/u);
  // The PostgreSQL verifier derives its expectations from the SAME three URIs
  // and the SAME rule, so what the database stores is what the canonicalizer
  // derives - never a second identity scheme.
  assert.match(verifier, /uuidV5\(RFC4122_URL_NAMESPACE, 'https:\/\/qandeel\.app\/world\/thread\/v1'\)/u);
  assert.match(verifier, /uuidV5\(RFC4122_URL_NAMESPACE, 'https:\/\/qandeel\.app\/world\/home-anchor\/v1'\)/u);
  assert.match(verifier, /uuidV5\(RFC4122_URL_NAMESPACE, 'https:\/\/qandeel\.app\/runtime\/thread-established\/v1'\)/u);
  assert.match(verifier, /uuidV5\(THREAD_NAMESPACE, `\$\{userId\}:\$\{focusId\}`\)/u);
  assert.match(verifier, /uuidV5\(HOME_ANCHOR_NAMESPACE, threadId\)/u);
  assert.match(verifier, /uuidV5\(THREAD_EVENT_NAMESPACE, threadId\)/u);
  // Only the twelve boundary keys; nothing geographic, graded or lifecycle-shaped.
  assert.match(payloadTypes, /readonly unit_id: string;\s*readonly decision: ThreadEstablishmentDecision;\s*readonly no_establishment_reason: NoEstablishmentReason \| null;\s*readonly emerging_focus_id: string \| null;\s*readonly path: ThreadEstablishmentPath \| null;\s*readonly thread_id: string \| null;\s*readonly home_anchor_id: string \| null;\s*readonly thread_established_event_id: string \| null;\s*readonly evidence: readonly CanonicalThreadEvidence\[\];\s*readonly explicit_selection_grounding: CanonicalSelectionGrounding \| null;\s*readonly origin_state: PreparedOriginState;\s*readonly origin_thread_ids: readonly string\[\];\s*\}/u,
    'the canonical decision carries exactly the twelve boundary fields');
  for (const forbidden of ['placement', 'coordinate', 'placement_x', 'placement_y', 'baseX', 'attempt', 'fingerprint', 'scheme',
    'OSDAP', 'shell', 'radius', 'score', 'confidence', 'similarity', 'embedding', 'rank', 'importance', 'weight',
    'parent', 'primary', 'merge', 'lifecycle', 'Dormant', 'Reopen', 'liveFocus', 'LIVE_FOCUS', 'effectiveLF',
    'sessionPosition', 'session_position', 'sameSpEventSequence', 'same_sp_event_sequence', 'liveHead',
    'reading', 'Reading', 'timeline', 'Timeline', 'projection', 'neighborhood', 'viewport', 'camera', 'MapState']) {
    assert.equal(`${payloadTypes}\n${canonicalizer}`.includes(forbidden), false, `the T-03B2b2 boundary must not contain ${forbidden}`);
  }
  assert.match(payloadTypes, /PREPARED_ORIGIN_STATES = Object\.freeze\(\['NONE', 'RESOLVED', 'MULTIPLE', 'AMBIGUOUS'\] as const\)/u);
  assert.match(payloadTypes, /THREAD_EVIDENCE_ROLES = Object\.freeze\(\['PRIOR_EVIDENCE', 'ESTABLISHING_CU'\] as const\)/u);
  assert.match(canonicalizer, /\[\.\.\.members\]\.sort\(compareThreadIds\)/u, 'origin members are stored in canonical textual order');
  assert.doesNotMatch(canonicalizer, /localeCompare/u, 'ordering is locale-independent');
  assert.match(canonicalizer, /'NO_ESTABLISHMENT'/u, 'NO_ESTABLISHMENT survives as a typed no-op payload');
  assert.match(canonicalizer, /includes\('prepared:'\)/u, 'no transient identity may cross the boundary');
});

test('QANDEEL_OSDAP_V1 is mirrored in SQL with its exact frozen constants, and the caller can never author a coordinate', () => {
  // The SQL mirror carries exactly the frozen TypeScript constants.
  for (const constant of ['-4611686018427387904', '4611686018427387903', '1000000', '250000', '32', '8192']) {
    assert.ok(migration.includes(constant), `the SQL mirror carries the frozen constant ${constant}`);
  }
  assert.match(migration, /'QANDEEL_OSDAP_V1'/u);
  assert.match(migration, /'canonical-home-placement-engine-v1'/u);
  assert.match(migration, /'qandeel-osdap-v1'/u);
  // The frozen TypeScript engine still declares the same constants.
  const engine = read(`${HOME_DIR}/home-placement.types.ts`);
  assert.match(engine, /MIN_COORD: WorldCoord = -\(2n \*\* 62n\)/u);
  assert.match(engine, /MAX_COORD: WorldCoord = 2n \*\* 62n - 1n/u);
  assert.match(engine, /HOME_STEP: WorldCoord = 1_000_000n/u);
  assert.match(engine, /MIN_HOME_SEPARATION: WorldCoord = 250_000n/u);
  assert.match(engine, /CANDIDATES_PER_SHELL = 32 as const/u);
  assert.match(engine, /MAX_ATTEMPTS = 8192 as const/u);
  assert.match(engine, /OSDAP_DIGEST_DOMAIN = 'qandeel-osdap-v1' as const/u);
  // The verifier replays the SAME seven golden vectors the frozen engine pins.
  const goldenIds = [...vectors.matchAll(/id: '(GV-0[1-7])'/gu)].map((m) => m[1]);
  assert.deepEqual(goldenIds, ['GV-01', 'GV-02', 'GV-03', 'GV-04', 'GV-05', 'GV-06', 'GV-07']);
  for (const id of goldenIds) assert.ok(verifier.includes(`'${id}'`), `${id} is replayed against real PostgreSQL`);
  // Every fingerprint the SQL parity proof asserts is a fingerprint the frozen
  // TypeScript vectors already pin: one contract, replayed in two languages.
  const replayed = [...verifier.matchAll(/(?:worldFp|originFp): '([0-9a-f]{64})'/gu)].map((m) => m[1]);
  assert.equal(replayed.length, 14, 'each of the seven golden vectors replays both of its fingerprints');
  for (const fingerprint of replayed) {
    assert.ok(vectors.includes(fingerprint), `the replayed fingerprint ${fingerprint} is pinned by the frozen engine`);
  }
  assert.deepEqual([...verifier.matchAll(/attempt: (\d+),/gu)].map((m) => Number(m[1])), [0, 0, 0, 0, 0, 0, 34],
    'the pinned attempt of every golden vector is replayed, including the dense shell escalation');
  // No caller-authored geography anywhere: not in a signature, not in a payload.
  const writer = migration.slice(migration.indexOf('CREATE FUNCTION public.commit_conversation_units_with_focus_and_thread_v1'),
    migration.indexOf('-- 15. The atomic finalized-exchange coordinator'));
  const coordinator = migration.slice(migration.indexOf('CREATE FUNCTION public.commit_finalized_exchange_with_focus_and_thread_v1'),
    migration.indexOf('-- 16. Ownership, search_path hardening'));
  for (const [label, signature] of [['writer', writer.slice(0, writer.indexOf(') RETURNS'))], ['coordinator', coordinator.slice(0, coordinator.indexOf(') RETURNS'))]]) {
    assert.doesNotMatch(signature, /placement|coordinate|fingerprint|attempt|_x |_y |scheme/u, `the ${label} accepts no caller-authored placement`);
    assert.doesNotMatch(signature, /p_same_sp_event_sequence\b|p_session_position\b|p_sp\b|p_live_head/u, `the ${label} accepts no caller-authored SP or sequence`);
  }
  assert.match(writer, /public\.compute_canonical_home_placement_v1\(\s*turn_row\.user_id::text, canonical_thread_id::text, \(decision ->> 'origin_state'\),\s*origin_ids, world_thread_ids, world_x, world_y\)/u,
    'the placement is computed by the database from the world it actually holds');
  assert.match(writer, /FROM public\.conversation_thread_homes h\s*\n\s*WHERE h\.user_id = turn_row\.user_id AND h\.address_scheme = authority_row\.address_scheme/u,
    'the world is read under the lock, from the canonical Home table');
  // No semantic, similarity, score or viewport value can reach geography.
  assert.doesNotMatch(stripProse(body), /similarity|embedding|cosine|keyword|levenshtein|importance|popularity|viewport|zoom|device|::float|::real|::double|random\(\)/u);
});

test('AF66-01 holds with exactly one user-world lock, and B1 sequence 1 precedes an optional B2 sequence 2', () => {
  const writer = migration.slice(migration.indexOf('CREATE FUNCTION public.commit_conversation_units_with_focus_and_thread_v1'),
    migration.indexOf('-- 15. The atomic finalized-exchange coordinator'));
  const clock = writer.indexOf('FROM public.session_semantic_clocks c');
  const turn = writer.indexOf('FROM public.conversation_turns t');
  const focusPersist = writer.indexOf('persist_conversation_unit_focus_semantics_v1(');
  const world = writer.indexOf('FROM public.conversation_world_spatial_authorities w');
  const threadPersist = writer.indexOf('persist_conversation_thread_establishment_v1(');
  assert.ok(clock > 0 && turn > clock, 'the Session Semantic Clock is the FIRST lock');
  assert.ok(writer.indexOf('FOR UPDATE', clock) < turn, 'the clock lock is FOR UPDATE and precedes the source turn');
  assert.ok(focusPersist > turn && world > focusPersist && threadPersist > world,
    'clock -> source turn -> B1 semantic rows -> user-world spatial authority -> Thread / Home rows');
  assert.ok(clock < world, 'the world lock is NEVER taken before the Session Semantic Clock');
  assert.equal((writer.match(/FOR UPDATE/gu) ?? []).length, 3, 'exactly three row locks in the writer');
  assert.equal((writer.match(/conversation_world_spatial_authorities w\s+WHERE w\.user_id = turn_row\.user_id\s+FOR UPDATE/gu) ?? []).length, 1,
    'exactly ONE user-world lock serializes concurrent Home allocation');
  assert.equal((stripSql(writer).match(/reserve_session_same_sp_event_v1/gu) ?? []).length, 2,
    'the ONE T-03A2 seam is reused: sequence 1 for B1, sequence 2 for the whole B2 event');
  assert.doesNotMatch(stripSql(writer), /same_sp_event_sequence \+ 1|CREATE SEQUENCE|nextval\(/u, 'no second sequence authority is created');
  assert.match(writer, /reserved_sequence IS DISTINCT FROM 1::bigint/u);
  assert.match(writer, /reserved_sequence IS DISTINCT FROM 2::bigint/u);
  // A NO_ESTABLISHMENT reserves nothing at all.
  const gate = writer.indexOf('validate_conversation_thread_decision_v1(');
  assert.doesNotMatch(writer.slice(gate, world), /reserve_session_same_sp_event_v1|INSERT INTO public\.conversation_thread/u,
    'a truthful non-establishment reserves no same-SP event and inserts no Thread row');
  // T-03D is not implemented here.
  assert.doesNotMatch(stripProse(body), /live_focus|LIVE_FOCUS|liveFocus|effective_lf|live_focus_transitions/u, 'no Live Focus exists in this slice');
});

test('the database is the canonical identity authority: UUID-shaped is never accepted as sufficient', () => {
  // The derivation lives in SQL, with no extension and no new dependency, and
  // reproduces the TypeScript canonicalizer exactly.
  assert.match(migration, /CREATE FUNCTION public\.canonical_sha1_v1\(p_message bytea\)/u);
  assert.match(migration, /CREATE FUNCTION public\.canonical_uuid_v5_v1\(p_namespace uuid, p_name text\)/u);
  assert.match(migration, /CREATE FUNCTION public\.canonical_thread_identities_v1\(/u);
  assert.doesNotMatch(executable, /CREATE EXTENSION|pgcrypto/u, 'no extension is introduced for the derivation');
  assert.match(migration, /thread_namespace constant uuid := '973d2e95-15d7-593c-953d-84ee94be343c';/u);
  assert.match(migration, /home_namespace constant uuid := 'ca3acc01-e866-5d84-a15a-5be440c1919e';/u);
  assert.match(migration, /event_namespace constant uuid := '47cd6b25-dbf8-5fd3-941f-eff9d2386990';/u);
  assert.match(migration, /public\.canonical_uuid_v5_v1\(thread_namespace, p_user_id::text \|\| ':' \|\| p_emerging_focus_id::text\)/u,
    'the SQL Thread derivation is the TypeScript one: uuidV5(namespace, userId + ":" + emergingFocusId)');
  assert.match(canonicalizer, /uuidV5\(THREAD_NAMESPACE, `\$\{userId\}:\$\{emergingFocusId\}`\)/u, 'and the TypeScript side is unchanged');
  // The migration refuses to deploy unless SQL reproduces the frozen values.
  for (const frozen of ['973d2e95-15d7-593c-953d-84ee94be343c', 'ca3acc01-e866-5d84-a15a-5be440c1919e',
    '47cd6b25-dbf8-5fd3-941f-eff9d2386990', '74738ff5-5367-5958-9aee-98fffdcd1876',
    'a9993e364706816aba3e25717850c26c9cd0d89d', 'afc4fd81-fe54-5738-9545-e1053044d919']) {
    assert.ok(migration.includes(frozen), `the migration self-assertion pins ${frozen}`);
    assert.ok(verifier.includes(frozen) || frozen === 'a9993e364706816aba3e25717850c26c9cd0d89d',
      'the verifier replays the same frozen values against real PostgreSQL');
  }
  // Shape alone is explicitly no longer sufficient.
  const validator = migration.slice(migration.indexOf('CREATE FUNCTION public.validate_conversation_thread_decision_v1'),
    migration.indexOf('-- 12. Persisting ONE establishment'));
  assert.match(validator, /FROM public\.canonical_thread_identities_v1\(p_cu\.user_id, focus_id\) c;/u);
  assert.match(validator, /IF thread_id <> expected_thread_id[\s\S]{0,200}RAISE EXCEPTION 'INVALID_THREAD_IDENTITY'/u);
  assert.doesNotMatch(validator, /IF thread_id = home_anchor_id OR thread_id = event_id/u,
    'mutual distinctness is not canonical identity proof');
  // The verifier proves every valid-but-wrong substitution is refused BEFORE
  // the world lock, and that OSDAP consumed the derived identity.
  for (const proof of ['INVALID_THREAD_IDENTITY', 'no spatial authority row was created',
    'OSDAP received the validated canonical Thread identity as its placement entropy',
    'the RFC 4122 version-5 reference vector is reproduced']) {
    assert.ok(verifier.includes(proof), `the verifier proves: ${proof}`);
  }
});

test('the finalized exchange classifies BOTH halves through the ONE completeness authority before any writer', () => {
  assert.match(migration, /CREATE FUNCTION public\.conversation_thread_batch_state_v1\(/u);
  assert.match(migration, /RETURNS text\s*\nLANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''/u,
    'the completeness authority is read-only and hardened');
  const writer = migration.slice(migration.indexOf('CREATE FUNCTION public.commit_conversation_units_with_focus_and_thread_v1'),
    migration.indexOf('-- 15. The atomic finalized-exchange coordinator'));
  const coordinator = migration.slice(migration.indexOf('CREATE FUNCTION public.commit_finalized_exchange_with_focus_and_thread_v1'),
    migration.indexOf('-- 16. Ownership, search_path hardening'));
  // The SAME authority serves the per-batch writer and the exchange gate.
  assert.equal((migration.match(/public\.conversation_thread_batch_state_v1\(p_session_id/gu) ?? []).length, 3,
    'the same authority is called once by the writer and once per finalized-exchange half');
  assert.match(writer, /batch_state := public\.conversation_thread_batch_state_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\);/u);
  assert.match(writer, /IF batch_state = 'ABSENT' THEN/u);
  assert.match(writer, /IF batch_state <> 'COMPLETE' THEN[\s\S]{0,400}THREAD_CAPTURE_BATCH_INTEGRITY/u);
  assert.match(coordinator, /IF NOT \(\(user_state = 'ABSENT' AND assistant_state = 'ABSENT'\)[\s\S]{0,200}THREAD_CAPTURE_BATCH_INTEGRITY/u);
  const relation = coordinator.indexOf('INVALID_FINALIZED_EXCHANGE_RELATION');
  const gate = coordinator.indexOf('user_state := public.conversation_thread_batch_state_v1');
  const stale = coordinator.indexOf("RAISE EXCEPTION 'STALE_CONVERSATIONAL_FOCUS_CONTEXT'");
  const write = coordinator.indexOf('public.commit_conversation_units_with_focus_and_thread_v1(');
  assert.ok(relation < gate && gate < stale && stale < write,
    'relation gate -> half-state gate -> token check -> BOTH writer calls');
  assert.doesNotMatch(coordinator, /EXISTS \(SELECT 1 FROM public\.conversation_unit_commit_batches b WHERE b\.id = p_user_batch_id\)/u,
    'replay eligibility is no longer "the commitment batch exists"');
  // Full B2 completeness covers evidence, origin provenance and coherence.
  const state = migration.slice(migration.indexOf('CREATE FUNCTION public.conversation_thread_batch_state_v1'),
    migration.indexOf('-- 14. The integrated per-Moment writer'));
  for (const rule of ['durable_events <> thread_row.establishment_count', 'evidence_total < 1',
    "ev2.evidence_role = 'ESTABLISHING_CU') <> 1", 'ev2.evidence_ordinal = evidence_total - 1',
    'cu2.session_position >= event_row.session_position', "event_row.origin_state = 'RESOLVED' AND origin_total <> 1",
    "event_row.origin_state IN ('MULTIPLE', 'AMBIGUOUS') AND origin_total < 2",
    'canonical_thread_identities_v1(p_user_id, event_row.emerging_focus_id)',
    'h.home_anchor_id = event_row.home_anchor_id', 't.established_event_sequence = 2']) {
    assert.ok(state.includes(rule), `structural completeness requires: ${rule}`);
  }
  assert.match(writer, /FROM public\.conversation_thread_establishment_evidence ev WHERE ev\.thread_id = replay_thread_id\)/u,
    'exact replay compares stored evidence to the canonical payload');
  assert.match(writer, /FROM public\.conversation_thread_origin_members m WHERE m\.thread_id = replay_thread_id\)/u,
    'exact replay compares stored origin provenance to the canonical payload');
  // The verifier proves the half-states and every corruption fixture.
  for (const proof of ["'ABSENT', 'an untouched half classifies as ABSENT'", 'USER complete + ASSISTANT absent',
    'ASSISTANT complete + USER absent', 'USER commitment+B1 without B2 + ASSISTANT absent',
    'missing Home', 'missing ThreadEstablished event', 'missing evidence row', 'missing ESTABLISHING_CU evidence role',
    'evidence naming the wrong CU', 'evidence in the wrong order', 'missing RESOLVED origin member',
    'MULTIPLE with only one stored member is PARTIAL', 'event Home Anchor mismatch', 'event SP mismatch',
    'event focus mismatch', 'event path mismatch', 'extra durable establishment beyond establishment_count',
    'a nonzero batch that established nothing is COMPLETE', 'a zero-CU capture batch is COMPLETE']) {
    assert.ok(verifier.includes(proof), `the verifier proves: ${proof}`);
  }
});

test('there is no Thread without its Home, no relocation API, no parent origin and no merge', () => {
  const persist = migration.slice(migration.indexOf('CREATE FUNCTION public.persist_conversation_thread_establishment_v1'),
    migration.indexOf('-- 14. The integrated per-Moment writer'));
  assert.match(persist, /INSERT INTO public\.conversation_threads[\s\S]*INSERT INTO public\.conversation_thread_homes[\s\S]*INSERT INTO public\.conversation_thread_establishment_events/u,
    'Thread, Home and the establishment event are written together, in one helper, in one transaction');
  assert.equal((executable.match(/INSERT INTO public\.conversation_threads\b/gu) ?? []).length, 1);
  assert.equal((executable.match(/INSERT INTO public\.conversation_thread_homes\b/gu) ?? []).length, 1);
  assert.doesNotMatch(executable, /UPDATE public\.conversation_thread|DELETE FROM public\.conversation_thread|UPDATE public\.conversation_world/u,
    'there is no relocation, rewrite or delete path for any canonical Thread row');
  assert.match(migration, /thread_id uuid PRIMARY KEY/u, 'one permanent Home per Thread is structural');
  assert.match(migration, /UNIQUE \(user_id, address_scheme, placement_x, placement_y\)/u);
  assert.match(migration, /grounding_emerging_focus_id uuid NOT NULL UNIQUE/u);
  for (const forbidden of ['parent_thread_id', 'origin_parent', 'primary_origin', 'edge_direction', 'semantic_distance',
    'merge_target', 'merged_into', 'thread_merge', 'lifecycle_status', 'dormant', 'reopened_at',
    'reading_id', 'thread_reading', 'historical_projection', 'projection_version', 'timeline_position']) {
    assert.equal(stripProse(body).toLowerCase().includes(forbidden), false, `0068 must not introduce ${forbidden}`);
  }
  // Nothing later than T-03B2b2 leaked in.
  assert.doesNotMatch(body, /PRE_FIRST_SP|pre_first_sp|historical_enabled|knowledge_frontier|version_frontier|WORLD_ANCHOR|map_state/u);
});

test('the whole slice is production-inert: no grant, no wiring, no runtime reader, no mobile change', () => {
  assert.doesNotMatch(executable, /GRANT /u, 'the migration grants nothing');
  for (const fn of ['commit_conversation_units_with_focus_and_thread_v1', 'commit_finalized_exchange_with_focus_and_thread_v1',
    'validate_conversation_thread_decision_v1', 'persist_conversation_thread_establishment_v1',
    'compute_canonical_home_placement_v1', 'osdap_search_admissible_placement_v1']) {
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\)\\s*\\n?\\s*FROM service_role`, 'u'), `${fn} is revoked from service_role`);
  }
  assert.match(migration, /T-03B2b2 must leave the T-03A2 service_role grants exactly in place/u);
  // Nothing in the API runtime, the scripts or the database references the new
  // writer, coordinator, canonicalizer or placement mirror.
  const referencing = listFiles(join(rootPath, 'apps/api/src'))
    .map(relative)
    .filter((file) => !file.startsWith(`${THREAD_DIR}/`))
    // T-03B3 (thread-lifecycle, production-inert) reuses this canonicalizer and
    // payload boundary exactly as T-03B2b3 does; it is pinned separately just below.
    .filter((file) => !file.startsWith('apps/api/src/thread-lifecycle/'))
    // T-03D (live-focus) is the FINAL, LIVE chain: it canonicalizes B2 through
    // this boundary inside the ONE 0071 coordinator and never calls the 0068
    // writer or the placement engine; it is pinned by the T-03D contract.
    .filter((file) => !file.startsWith('apps/api/src/live-focus/'))
    .filter((file) => /with_focus_and_thread_v1|durable-thread|canonicalizePreparedThreadSequence|durableThreadId|conversation_threads|compute_canonical_home_placement/u.test(stripComments(read(file))));
  assert.deepEqual(referencing, [], 'no runtime path reaches the T-03B2b2 writer, canonicalizer or placement mirror except the FINAL chain');
  // T-03B3's FINAL Thread-layer runtime (thread-lifecycle) canonicalizes B2
  // through this boundary and never carries a placement of its own: the
  // database is still the only placement authority, and a reused Thread
  // keeps its Home untouched.
  const lifecycleFiles = listFiles(join(rootPath, 'apps/api/src/thread-lifecycle')).map(relative);
  assert.ok(lifecycleFiles.length > 0, 'the T-03B3 directory exists');
  for (const file of lifecycleFiles) {
    assert.doesNotMatch(stripComments(read(file)), /compute_canonical_home_placement|osdap|conversation_thread_homes|placeCanonicalHome|resolveThreadHome/iu,
      `${file} carries no permanent placement: the database is the only placement authority`);
  }
  // T-03D wires the FINAL chain (which carries the Thread layer) in
  // ConversationModule / ConversationService; neither reaches the 0068 writer,
  // the canonicalizer or the placement engine directly.
  for (const [name, text] of [['ConversationModule', conversationModule], ['ConversationService', conversationService]]) {
    assert.doesNotMatch(stripComments(text), /durable-thread|with_focus_and_thread|canonicalizePreparedThreadSequence|compute_canonical_home_placement|conversation_threads/u, `${name} never reaches the T-03B2b2 writer or engine`);
  }
  for (const [name, text] of [['AppModule', appModule], ['the T-03B1b2 focus establishment service', focusEstablishment]]) {
    assert.doesNotMatch(stripComments(text), /thread|Thread|durable-thread|with_focus_and_thread/u, `${name} is untouched by T-03B2b2`);
  }
  assert.match(unitRepository, /'commit_finalized_exchange_conversation_units_v1'/u, 'the retired T-03A2 repository still names the retired coordinator');
  for (const file of [...listFiles(join(rootPath, 'apps/api/scripts')), ...listFiles(join(rootPath, 'apps/mobile/src'))].map(relative)) {
    assert.doesNotMatch(read(file), /with_focus_and_thread|durable-thread|conversation_threads|thread_home/u, `${file} does not reach the substrate`);
  }
  // No new dependency; the lockfile is byte-identical; MOB-CI-01 is untouched.
  assert.equal(gitBlobId(read('package-lock.json')), 'da9e64f217db91c4e72da27073c578a108a99bad', 'package-lock.json is byte-identical');
  assert.deepEqual(Object.keys(rootPackage.devDependencies), ['pg']);
  for (const name of ['uuid', 'nanoid', 'zod', 'knex', 'prisma', 'pg-promise', 'postgres', 'kysely', 'drizzle-orm']) {
    assert.equal(name in (apiPackage.dependencies ?? {}) || name in (apiPackage.devDependencies ?? {}) || name in (mobilePackage.dependencies ?? {}), false, `${name} must not be introduced`);
  }
  assert.equal(gitBlobId(read('.github/workflows/mobile-ci.yml')), '8efe44a2d2e95688c7612a2429b8f3ab106ecb8c', 'Mobile CI is byte-identical');
  assert.equal(gitBlobId(read('apps/mobile/package.json')), 'a259368e87baeca24d7374dd922d866bbe6a6f88', 'the mobile package is byte-identical');
});

test('the gates are registered at the root and in API CI, and the slice is documented', () => {
  assert.equal(rootPackage.scripts['test:durable-thread-home-same-sp-substrate-contract'], 'node --test tests/durable-thread-home-same-sp-substrate-contract.test.mjs');
  assert.equal(rootPackage.scripts['verify:durable-thread-home-same-sp-substrate:integration'], 'node --env-file-if-exists=.env database/verify-migration-0068.mjs');
  assert.match(apiCi, /run: npm run test:durable-thread-home-same-sp-substrate-contract/u);
  assert.match(apiCi, /run: npm run verify:durable-thread-home-same-sp-substrate:integration/u);
  assert.equal((apiCi.match(/test:durable-thread-home-same-sp-substrate-contract/gu) ?? []).length, 1);
  assert.equal((apiCi.match(/verify:durable-thread-home-same-sp-substrate:integration/gu) ?? []).length, 1);
  assert.ok(apiCi.indexOf('test:durable-thread-home-same-sp-substrate-contract') > apiCi.indexOf('test:canonical-home-placement-engine-contract'),
    'the static contract runs after the T-03B2b1 gate');
  assert.ok(apiCi.indexOf('test:durable-thread-home-same-sp-substrate-contract') < apiCi.indexOf('Apply all migrations to fresh PostgreSQL'),
    'the static contract runs before the database bootstrap');
  assert.ok(apiCi.indexOf('verify:durable-thread-home-same-sp-substrate:integration') > apiCi.indexOf('verify:conversation-focus-runtime-integration-readiness:integration'),
    'the 0068 verifier runs after the 0067 verifier');
  assert.doesNotMatch(mobileCi, /durable-thread|0068|thread-home/u);
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3);
  assert.equal((mobileCi.match(/if: needs\.verify-mobile-contracts\.outputs\.native_impact == 'true'/gu) ?? []).length, 2);
  assert.match(doc, /production-inert/iu);
  assert.match(doc, /QANDEEL_OSDAP_V1/u);
  assert.match(docsIndex, /durable-thread-home-same-sp-substrate-v1\.md/u);
});
