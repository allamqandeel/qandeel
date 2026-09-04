import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../migrations/0064_committed_conversational_unit_substrate_v1.sql');
const verifier = read('../verify-migration-0064.mjs');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

// Prose comments explain WHY a construct is forbidden and therefore name it;
// every "must not contain" assertion runs against executable SQL only.
const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const executableSlice = (from, to) => {
  const start = migration.indexOf(from);
  const end = to === undefined ? migration.length : migration.indexOf(to);
  return migration.slice(start, end).split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
};

test('0064 is the ordered forward migration and creates only the T-03A1 substrate', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes('0064_committed_conversational_unit_substrate_v1.sql'), 'migration 0064 exists');
  assert.ok(
    migrations.indexOf('0064_committed_conversational_unit_substrate_v1.sql')
      > migrations.indexOf('0063_question_information_gap_closed_loop_v1.sql'),
    '0064 orders after 0063');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);

  const tables = [...migration.matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(tables, ['conversation_unit_commit_batches', 'conversation_units']);
  const functions = [...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(functions, ['commit_conversation_units_v1', 'reject_committed_conversational_unit_mutation_v1']);
  const triggers = [...migration.matchAll(/CREATE TRIGGER (\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(triggers, ['conversation_unit_commit_batches_immutable', 'conversation_units_immutable']);
});

test('0064 leaves every existing object alone (AF03A1-01, case 41/42)', () => {
  assert.doesNotMatch(executableSql, /ALTER TABLE public\.conversation_turns/iu, 'conversation_turns is never altered');
  assert.doesNotMatch(executableSql, /ALTER TABLE public\.conversation_sessions|ALTER TABLE public\.users/iu);
  assert.doesNotMatch(executableSql, /runtime_event_outbox|post_response_intelligence/iu, 'the outbox and dispatch ledger are untouched');
  assert.doesNotMatch(executableSql, /DROP (?:TABLE|FUNCTION|TRIGGER|CONSTRAINT|POLICY)/iu, 'nothing existing is dropped');
  assert.doesNotMatch(executableSql, /CREATE EXTENSION|btree_gist|EXCLUDE USING/iu, 'no extension or exclusion constraint (AF03A1-02)');
  assert.doesNotMatch(executableSql, /CREATE SEQUENCE|GENERATED ALWAYS AS IDENTITY|bigserial/iu, 'identities stay application-supplied UUIDs');
  // Only the two new tables are ever written to.
  const inserts = [...executableSql.matchAll(/INSERT INTO public\.(\w+)/gu)].map((m) => m[1]);
  assert.deepEqual([...new Set(inserts)].sort(), ['conversation_unit_commit_batches', 'conversation_units']);
  assert.doesNotMatch(executableSql, /UPDATE public\.\w+ SET|DELETE FROM public\.\w+/iu, 'the substrate is append-only and backfills nothing');
});

test('the durable schema carries the frozen semantics and nothing Moment-adjacent (case 29)', () => {
  for (const constraint of [
    'conversation_units_source_role_check',
    'conversation_units_speaker_state_check',
    'conversation_units_source_modality_check',
    'conversation_units_span_check',
    'conversation_units_committed_text_span_check',
    'conversation_units_turn_ordinal_unique',
    'conversation_units_digest_check',
    'conversation_unit_commit_batches_unit_count_check',
    'conversation_unit_commit_batches_provenance_check',
  ]) {
    assert.match(migration, new RegExp(`CONSTRAINT ${constraint}\\b`, 'u'), `${constraint} exists`);
  }
  assert.match(migration, /source_role IN \('USER', 'ASSISTANT'\)/u, 'AF03A1-03: SYSTEM is not committable');
  assert.match(migration, /speaker_state IN \('RESOLVED', 'UNRESOLVED'\)/u, 'the frozen speaker domain stays representable');
  assert.match(migration, /source_modality = 'TEXT'/u, 'modality is fail-closed to the only real runtime');
  assert.match(migration, /UNIQUE \(source_turn_id, ordinal_within_turn\)/u, 'the required structural ordering constraint');
  // No SP, LH, status, function/dialogue-act, normalized text, or updated_at.
  const schema = executableSlice('CREATE TABLE public.conversation_unit_commit_batches', 'CREATE FUNCTION public.reject_');
  assert.doesNotMatch(schema, /session_position|live_head|\blh\b|\bsp\b|moment|updated_at|normalized|dialogue|function_|\bstatus\b/iu);
  assert.doesNotMatch(executableSql, /SP_PENDING|PRE_MOMENT|PENDING_MOMENT|COMMITTED_WITHOUT_SP/u, 'no temporary Product state is introduced');
  // There is no UNIQUE(source_turn_id) on batches: multiple forward batches per turn are legal.
  assert.doesNotMatch(executableSql, /source_turn_id uuid NOT NULL UNIQUE|UNIQUE \(source_turn_id\)/u);
});

test('the coordinate and digest contract is frozen with no fallback (REV03A1-05, case 40)', () => {
  assert.match(migration, /current_setting\('server_encoding'\) <> 'UTF8'/u, 'the migration refuses a non-UTF8 server');
  assert.match(migration, /sha256\(convert_to\(turn_row\.content, 'UTF8'\)\)/u, 'the canonical source digest');
  assert.match(migration, /sha256\(convert_to\(canonical::text, 'UTF8'\)\)/u, 'the DB-derived canonical fingerprint');
  assert.doesNotMatch(executableSql, /\bmd5\b|octet_length|byte_offset/iu, 'no MD5 or byte-offset fallback exists');
  assert.match(migration, /substring\(turn_row\.content from span_starts\[g\.i\] \+ 1 for span_ends\[g\.i\] - span_starts\[g\.i\]\)/u,
    'committed wording is sliced by the database from the locked canonical source');
});

test('the producer exposes no caller-authoritative parameter (REV03A1-02, REV03A1-03)', () => {
  assert.match(migration, /CREATE FUNCTION public\.commit_conversation_units_v1\(\s*p_session_id uuid,\s*p_user_id uuid,\s*p_source_turn_id uuid,\s*p_batch_id uuid,\s*p_units jsonb,\s*p_evaluator_version text,\s*p_policy_version text,\s*p_segmentation_provider text,\s*p_segmentation_model text,\s*p_segmentation_prompt_version text\s*\) RETURNS SETOF public\.conversation_units/u,
    'the exact authorized ten-parameter signature');
  const signature = migration.slice(migration.indexOf('CREATE FUNCTION public.commit_conversation_units_v1'), migration.indexOf('LANGUAGE plpgsql SECURITY DEFINER'));
  for (const forbidden of ['fingerprint', 'committed_text', 'p_text', 'p_role', 'p_speaker', 'p_modality', 'p_digest', 'p_sha', 'p_ordinal', 'p_sp']) {
    assert.ok(!signature.includes(forbidden), `the parameter surface must not contain ${forbidden}`);
  }
  assert.match(migration, /SECURITY DEFINER SET search_path=''/u);
  assert.match(migration, /derived_speaker constant text := 'RESOLVED'/u, 'speaker state is DB-derived');
  assert.match(migration, /derived_modality constant text := 'TEXT'/u, 'modality is DB-derived');
  const body = executableSlice('CREATE FUNCTION public.commit_conversation_units_v1', '-- 5.');
  assert.doesNotMatch(body, /'UNRESOLVED'/u, 'no producer path can write an unresolved speaker state');
  assert.doesNotMatch(body, /openai|anthropic|gemini|http|fetch|paraphrase/iu, 'replay never re-runs inference');
});

test('REV03A1-06: replay and new-batch commit are separated, and the frontier binds new writes only', () => {
  const body = migration.slice(migration.indexOf('CREATE FUNCTION public.commit_conversation_units_v1'), migration.indexOf('-- 5.'));
  const pathB = body.indexOf('PATH B - NEW BATCH COMMIT');
  const pathA = body.indexOf('PATH A - EXISTING BATCH REPLAY');
  assert.ok(pathB > 0 && pathA > 0, 'both paths are explicit');
  // Section boundaries are named in comments, so locate on the raw body and
  // then assert against executable SQL only.
  const strip = (text) => text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
  const newBatch = strip(body.slice(pathB, pathA));
  const replay = strip(body.slice(pathA));
  // The frontier and the ordinal derivation exist ONLY in the new-batch path.
  assert.match(newBatch, /COALESCE\(MAX\(cu\.source_span_end\), 0\), COALESCE\(MAX\(cu\.ordinal_within_turn\) \+ 1, 0\)/u);
  assert.match(newBatch, /SPAN_BEFORE_SOURCE_FRONTIER/u);
  assert.doesNotMatch(replay, /SPAN_BEFORE_SOURCE_FRONTIER/u, 'a historical replay is never re-checked against today\'s frontier');
  assert.doesNotMatch(replay, /MAX\(cu\.ordinal_within_turn\)/u, 'a historical replay never re-derives ordinals');
  assert.doesNotMatch(replay, /INSERT INTO/u, 'the replay path performs zero mutation');
  // The replay path proves identity three ways.
  assert.match(replay, /canonical_fingerprint IS DISTINCT FROM fingerprint/u, 'DB-derived fingerprint comparison');
  assert.match(replay, /st\.id <> unit_ids\[st\.rn::integer\]/u, 'tuple-by-tuple stored-row comparison');
  assert.match(replay, /COMMIT_BATCH_ORDINAL_INTEGRITY/u, 'stored ordinal integrity is validated independently');
  assert.match(replay, /st\.committed_text <> substring\(turn_row\.content/u, 'stored wording is re-derived from canonical source');
  // Structural validation is shared and frontier-independent.
  const common = strip(body.slice(0, pathB));
  assert.match(common, /SPAN_OUT_OF_RANGE/u);
  assert.match(common, /SPAN_NOT_FORWARD_ORDERED/u);
  assert.doesNotMatch(common, /SPAN_BEFORE_SOURCE_FRONTIER/u, 'the frontier is not part of shared structural validation');
});

test('the activation gate grants the producer to no role (case 28)', () => {
  assert.doesNotMatch(executableSql, /GRANT EXECUTE ON FUNCTION public\.commit_conversation_units_v1/u, 'T-03A1 grants no EXECUTE');
  assert.doesNotMatch(executableSql, /GRANT [A-Z, ]*ON TABLE public\.conversation_unit/u, 'neither table is granted to any role');
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.commit_conversation_units_v1\(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text\)\s*FROM PUBLIC, anon, authenticated/u);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.commit_conversation_units_v1\(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text\) FROM service_role/u);
  assert.match(migration, /REVOKE ALL ON TABLE public\.conversation_unit_commit_batches, public\.conversation_units\s*FROM PUBLIC, anon, authenticated/u);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/u);
  assert.doesNotMatch(migration, /CREATE POLICY/u, 'no read policy is created before T-03A2 decides delivery');
  for (const fn of ['commit_conversation_units_v1', 'reject_committed_conversational_unit_mutation_v1']) {
    assert.match(migration, new RegExp(`ALTER FUNCTION public\\.${fn}\\([^)]*\\)\\s*\n?\\s*OWNER TO postgres`, 'u'), `${fn} ownership is explicit`);
  }
  // The migration refuses to deploy a reachable substrate.
  assert.match(migration, /has_function_privilege\(target_role, producer, 'EXECUTE'\)/u);
  assert.match(migration, /has_table_privilege\(target_role, target_table, target_privilege\)/u);
});

test('every identifier 0064 introduces fits the PostgreSQL 63-byte limit', () => {
  const identifiers = [...migration.matchAll(/\b(?:TABLE|FUNCTION|CONSTRAINT|INDEX|TRIGGER)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gu)].map((m) => m[1]);
  assert.ok(identifiers.length > 0, 'identifiers were actually scanned');
  const oversized = [...new Set(identifiers)].filter((name) => Buffer.byteLength(name, 'utf8') > 63);
  assert.deepEqual(oversized, [], `identifiers exceed PostgreSQL's 63-byte limit: ${oversized.join(', ')}`);
});

test('the 0064 verifier proves live semantics and is wired into the toolchain and CI', () => {
  for (const proof of [
    "current_setting('server_encoding')", 'sha256(convert_to(', 'SPAN_BEFORE_SOURCE_FRONTIER', 'COMMIT_BATCH_PAYLOAD_CONFLICT',
    'COMMITTED_CONVERSATIONAL_UNIT_IS_IMMUTABLE', 'UNSUPPORTED_SOURCE_ROLE', 'UNSUPPORTED_SOURCE_MODALITY',
    'SOURCE_TURN_NOT_COMMITTABLE', 'has_function_privilege', 'has_table_privilege', 'BLOCKED', 'zero fixture residue',
  ]) {
    assert.match(verifier, new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), `verifier is missing ${proof}`);
  }
  assert.match(packageJson, /"verify:committed-conversational-unit-substrate:integration": "node --env-file-if-exists=\.env database\/verify-migration-0064\.mjs"/u);
  assert.match(workflow, /run: npm run verify:committed-conversational-unit-substrate:integration/u);
  const step = workflow.indexOf('run: npm run verify:committed-conversational-unit-substrate:integration');
  assert.ok(step > workflow.indexOf('run: npm run verify:question-information-gap-closed-loop:integration'),
    'the substrate verifier runs after the existing conversation-authority gates');
});
