import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// T-03A2 - Session Semantic Clock + SP Allocation/Sealing + LH Establishment +
// Committed-CU Delivery: the static database contract. Live semantics are
// proven against real PostgreSQL by database/verify-migration-0065.mjs.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const migration = read('../migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql');
const previous = read('../migrations/0064_committed_conversational_unit_substrate_v1.sql');
const verifier = read('../verify-migration-0065.mjs');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

// Prose comments explain WHY a construct is forbidden and therefore name it;
// every "must not contain" assertion runs against executable SQL only.
const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const section = (from, to) => {
  const start = migration.indexOf(from);
  const end = to === undefined ? migration.length : migration.indexOf(to);
  return migration.slice(start, end).split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
};
const producerBody = section('CREATE OR REPLACE FUNCTION public.commit_conversation_units_v1', '-- 6. The atomic USER');
// The terminal self-assertion block necessarily NAMES the forbidden column
// tokens inside its own guard pattern, so scans for those tokens run against
// the DDL and function bodies that precede it.
const SELF_ASSERTION_MARKER = '-- 10. Terminal self-assertions.';
const executableBody = migration.slice(0, migration.indexOf(SELF_ASSERTION_MARKER))
  .split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
/** Statements at migration level, i.e. outside every `$$ ... $$` function body. */
const migrationLevelSql = executableBody.split(/\$\$[\s\S]*?\$\$/gu).join('\n');

function gitBlobId(content) {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

test('0065 is the ordered forward activation migration and rewrites nothing historical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes('0065_session_semantic_clock_sp_lh_delivery_v1.sql'), 'migration 0065 exists');
  assert.ok(
    migrations.indexOf('0065_session_semantic_clock_sp_lh_delivery_v1.sql')
      > migrations.indexOf('0064_committed_conversational_unit_substrate_v1.sql'),
    '0065 orders after 0064');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  // Migration 0064 is frozen implementation input: T-03A2 extends THROUGH 0065
  // and never rewrites the substrate migration.
  assert.equal(gitBlobId(previous), '0a2ee63980e59072b3e9f52a643efa8220e95b08', 'migration 0064 is byte-identical');
});

test('0065 creates exactly the authorized clock, delivery and authority surface', () => {
  const tables = [...migration.matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(tables, ['conversation_unit_commit_events', 'session_semantic_clocks']);
  const functions = [...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(functions, [
    'commit_conversation_units_v1',
    'commit_finalized_exchange_conversation_units_v1',
    'get_conversation_unit_commit_batch_snapshot_v1',
    'get_conversational_units_committed_events_v1',
    'get_session_temporal_state_v1',
    'provision_session_semantic_clock_v1',
    'reject_conversation_unit_commit_event_mutation_v1',
    'reserve_session_same_sp_event_v1',
  ]);
  const triggers = [...migration.matchAll(/CREATE TRIGGER (\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(triggers, ['conversation_sessions_provision_semantic_clock', 'conversation_unit_commit_events_immutable']);
  // Only the canonical producer is replaced; nothing else historical is.
  assert.deepEqual([...migration.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/gu)].map((m) => m[1]),
    ['commit_conversation_units_v1']);
  assert.doesNotMatch(executableSql, /DROP (?:TABLE|FUNCTION|TRIGGER|CONSTRAINT|POLICY|COLUMN)/iu, 'nothing existing is dropped');
  assert.doesNotMatch(executableSql, /CREATE EXTENSION|CREATE SEQUENCE|GENERATED ALWAYS AS IDENTITY|bigserial/iu);
  assert.doesNotMatch(executableSql, /CREATE POLICY/u, 'no client read policy is created: reads run through definer authority');
});

test('the activation is refused over any pre-existing committed conversational unit', () => {
  assert.match(migration, /RAISE EXCEPTION 'T-03A2 refuses to activate over pre-existing committed conversational units'/u);
  assert.match(migration, /RAISE EXCEPTION 'T-03A2 refuses to activate over pre-existing commitment batches'/u);
  assert.match(migration, /current_setting\('server_encoding'\) <> 'UTF8'/u, 'the frozen UTF-8 contract still binds');
  // Nothing at migration level writes a committed CU or a delivery event: the
  // only backfill is the clock row every existing Session must have, and every
  // other write lives inside the canonical producer.
  const migrationLevelInserts = [...migrationLevelSql.matchAll(/INSERT INTO public\.(\w+)/gu)].map((m) => m[1]);
  assert.deepEqual([...new Set(migrationLevelInserts)], ['session_semantic_clocks'],
    'the activation backfills only Session Semantic Clock rows');
  assert.doesNotMatch(migrationLevelSql, /UPDATE public\.\w+ SET|DELETE FROM public\.\w+/u,
    'the activation rewrites and deletes nothing');
});

test('the Session Semantic Clock is the single server-owned temporal authority', () => {
  const clock = section('CREATE TABLE public.session_semantic_clocks', 'INSERT INTO public.session_semantic_clocks');
  assert.match(clock, /session_id uuid PRIMARY KEY/u);
  assert.match(clock, /current_sp integer,/u, 'current_sp is nullable: no SP(0) and no PRE_FIRST_SP Product state');
  assert.match(clock, /same_sp_event_sequence bigint NOT NULL DEFAULT 0/u);
  assert.match(clock, /CHECK \(current_sp IS NULL OR current_sp >= 1\)/u);
  assert.match(clock, /CHECK \(same_sp_event_sequence >= 0\)/u);
  // No second mutable head authority, no sealed flag, and no timestamp that a
  // Session Position decision could ever read.
  assert.doesNotMatch(clock, /live_head|sealed|pre_first_sp|moment|timestamptz|CURRENT_TIMESTAMP/iu);
  assert.match(migration, /CREATE TRIGGER conversation_sessions_provision_semantic_clock\s*\n\s*AFTER INSERT ON public\.conversation_sessions/u);
  assert.match(migration, /ON CONFLICT \(session_id\) DO NOTHING/u, 'the one-clock-row invariant survives a duplicate attempt');
});

test('session_position is born with the CU, is unique per Session and can never be zero', () => {
  assert.match(migration, /ADD COLUMN session_position integer NOT NULL,/u);
  assert.match(migration, /ADD CONSTRAINT conversation_units_session_position_check CHECK \(session_position >= 1\)/u);
  assert.match(migration, /ADD CONSTRAINT conversation_units_session_sp_unique UNIQUE \(session_id, session_position\)/u);
  assert.doesNotMatch(executableSql, /session_position integer DEFAULT|session_position integer NULL/u,
    'no committed CU may exist without a Session Position');
  assert.doesNotMatch(executableSql, /SP_PENDING|PRE_MOMENT|PENDING_MOMENT|COMMITTED_WITHOUT_SP/u,
    'no temporary Product state is introduced');
});

test('AF66-01: the producer takes the Session clock before the source turn', () => {
  const clockLock = producerBody.indexOf('FROM public.session_semantic_clocks c');
  const turnLock = producerBody.indexOf('FROM public.conversation_turns t');
  assert.ok(clockLock > 0 && turnLock > 0, 'both locks exist in the producer body');
  assert.ok(clockLock < turnLock, 'the Session Semantic Clock is acquired FIRST');
  assert.ok(producerBody.indexOf('FOR UPDATE', clockLock) < turnLock, 'the clock lock is FOR UPDATE and precedes the turn lock');
  const coordinator = section('CREATE FUNCTION public.commit_finalized_exchange_conversation_units_v1', '-- 7. Narrow service-role');
  assert.ok(
    coordinator.indexOf('FROM public.session_semantic_clocks c') < coordinator.indexOf('public.commit_conversation_units_v1'),
    'the exchange coordinator takes the one Session clock before either block');
  assert.equal((coordinator.match(/FOR UPDATE/gu) ?? []).length, 1, 'exactly one Session clock per semantic transaction');
  assert.match(coordinator, /p_user_source_turn_id[\s\S]*p_assistant_source_turn_id/u, 'USER identity precedes ASSISTANT identity');
  const userCall = coordinator.indexOf('p_user_source_turn_id, p_user_batch_id');
  const assistantCall = coordinator.indexOf('p_assistant_source_turn_id, p_assistant_batch_id');
  assert.ok(userCall > 0 && assistantCall > userCall, 'the USER block is committed before the ASSISTANT block');
});

test('the rewritten producer preserves the entire 0064 rejection and idempotency contract', () => {
  for (const token of [
    'INVALID_COMMIT_IDENTITY', 'INVALID_UNIT_PAYLOAD', 'INVALID_COMMIT_PROVENANCE', 'FORBIDDEN',
    'UNSUPPORTED_SOURCE_ROLE', 'SOURCE_TURN_NOT_COMMITTABLE', 'UNSUPPORTED_SOURCE_MODALITY',
    'SPAN_OUT_OF_RANGE', 'SPAN_NOT_FORWARD_ORDERED', 'SPAN_BEFORE_SOURCE_FRONTIER',
    'COMMIT_BATCH_PAYLOAD_CONFLICT', 'COMMIT_BATCH_ORDINAL_INTEGRITY',
  ]) {
    assert.ok(producerBody.includes(token), `the producer still raises ${token}`);
  }
  // The DB-derived canonical fields and fingerprint are unchanged, and SP is
  // excluded from the fingerprint exactly as ordinals are, so a historical
  // replay stays independent of today's clock.
  assert.match(producerBody, /derived_speaker constant text := 'RESOLVED'/u);
  assert.match(producerBody, /derived_modality constant text := 'TEXT'/u);
  assert.match(producerBody, /sha256\(convert_to\(turn_row\.content, 'UTF8'\)\)/u);
  assert.match(producerBody, /fingerprint := sha256\(convert_to\(canonical::text, 'UTF8'\)\);/u);
  const canonical = producerBody.slice(producerBody.indexOf('canonical := jsonb_build_object'), producerBody.indexOf('fingerprint :='));
  assert.doesNotMatch(canonical, /session_position|live_head|current_sp/u, 'SP never participates in batch identity');
  // The producer signature is unchanged: still no caller-authoritative field.
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.commit_conversation_units_v1\(\s*p_session_id uuid,\s*p_user_id uuid,\s*p_source_turn_id uuid,\s*p_batch_id uuid,\s*p_units jsonb,\s*p_evaluator_version text,\s*p_policy_version text,\s*p_segmentation_provider text,\s*p_segmentation_model text,\s*p_segmentation_prompt_version text\s*\) RETURNS SETOF public\.conversation_units/u);
  const signature = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.commit_conversation_units_v1'), migration.indexOf('LANGUAGE plpgsql SECURITY DEFINER SET search_path=\'\' AS $$\nDECLARE\n  uuid_shape'));
  for (const forbidden of ['p_sp', 'p_session_position', 'p_live_head', 'fingerprint', 'committed_text', 'p_ordinal']) {
    assert.ok(!signature.includes(forbidden), `the producer surface must not contain ${forbidden}`);
  }
});

test('SP allocation is ordinal arithmetic under the clock, never a timestamp', () => {
  assert.match(producerBody, /next_sp := COALESCE\(clock_row\.current_sp, 0\) \+ 1;/u);
  assert.match(producerBody, /last_sp := next_sp \+ unit_count - 1;/u);
  assert.match(producerBody, /SET current_sp = last_sp, same_sp_event_sequence = 0/u,
    'a new advance seals every earlier position and restarts the same-SP sequence');
  const allocation = producerBody.slice(producerBody.indexOf('next_sp := COALESCE'), producerBody.indexOf('PATH A'));
  assert.doesNotMatch(allocation, /CURRENT_TIMESTAMP|now\(\)|clock_timestamp|committed_at|created_at/u,
    'no wall-clock value participates in a Session Position decision');
  // A zero-CU batch allocates nothing and publishes nothing.
  assert.match(producerBody, /IF unit_count = 0 THEN\s*\n\s*RETURN;\s*\n\s*END IF;/u);
});

test('SP sealing and LH are derived: no stored flag and no second head column', () => {
  // `live_head` appears ONLY as the name of a derived read output. What must not
  // exist is a STORED column: a second mutable authority that could drift from
  // `current_sp`, or a sealed flag that could disagree with `n < current_sp`.
  const storedColumns = [
    ...[...executableBody.matchAll(/CREATE TABLE public\.\w+ \(([\s\S]*?)\n\);/gu)].map((match) => match[1]),
    ...[...executableBody.matchAll(/ADD COLUMN [^,;]+/gu)].map((match) => match[0]),
  ].join('\n');
  assert.ok(storedColumns.includes('current_sp integer'), 'the stored-column scan actually found the clock');
  assert.doesNotMatch(storedColumns, /\bsealed\b|is_sealed|seal_state|sealed_at|live_head|pre_first_sp|moment/iu,
    'LH and sealing are derived; neither has a stored column');
  assert.doesNotMatch(executableBody, /\bsealed\b|is_sealed|seal_state|sealed_at/iu,
    'no sealing flag is written or read anywhere');
  // Sealing is expressed exactly once, as the clock advance itself.
  assert.equal((executableBody.match(/SET current_sp = /gu) ?? []).length, 1,
    'exactly one statement advances the Session Semantic Clock');
});

test('the same-SP sequencing seam is internal, fails closed before SP(1) and is granted to nobody', () => {
  const helper = section('CREATE FUNCTION public.reserve_session_same_sp_event_v1', '-- 5. The rewritten commitment producer');
  assert.match(helper, /RETURNS TABLE\(session_position integer, event_sequence bigint\)/u);
  assert.match(helper, /FROM public\.session_semantic_clocks c[\s\S]*FOR UPDATE/u, 'it acquires the Session clock FIRST');
  assert.match(helper, /SESSION_POSITION_NOT_ESTABLISHED/u);
  assert.match(helper, /same_sp_event_sequence = c\.same_sp_event_sequence \+ 1/u);
  assert.doesNotMatch(helper, /PRE_FIRST_SP/u, 'the seam invents no Product membership');
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.reserve_session_same_sp_event_v1\(uuid,uuid\) FROM PUBLIC, anon, authenticated/u);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.reserve_session_same_sp_event_v1\(uuid,uuid\) FROM service_role/u);
  assert.doesNotMatch(executableSql, /GRANT EXECUTE ON FUNCTION public\.reserve_session_same_sp_event_v1/u,
    'the internal seam is granted to no role at all');
});

test('the dedicated delivery surface is append-only, content-free and never the runtime outbox', () => {
  const events = section('CREATE TABLE public.conversation_unit_commit_events', 'CREATE FUNCTION public.reject_conversation_unit_commit_event_mutation_v1');
  assert.match(events, /commit_batch_id uuid PRIMARY KEY/u, 'the batch is the stable event identity');
  assert.match(events, /CHECK \(\s*first_sp >= 1 AND last_sp >= first_sp AND unit_count = last_sp - first_sp \+ 1\)/u);
  for (const forbidden of ['text', 'jsonb', 'payload', 'content', 'event_type', 'schema_ref', 'analysis', 'reading', 'thread', 'confidence']) {
    assert.ok(!events.toLowerCase().includes(forbidden), `the delivery event must carry no ${forbidden} column`);
  }
  assert.match(migration, /CREATE TRIGGER conversation_unit_commit_events_immutable\s*\n\s*BEFORE UPDATE OR DELETE ON public\.conversation_unit_commit_events/u);
  assert.match(migration, /CONVERSATIONAL_UNITS_COMMITTED_EVENT_IS_IMMUTABLE/u);
  assert.doesNotMatch(executableSql, /INSERT INTO public\.runtime_event_outbox|UPDATE public\.runtime_event_outbox|ALTER TABLE public\.runtime_event_outbox/u,
    'the runtime event outbox is untouched');
  assert.doesNotMatch(executableSql, /post_response_intelligence/u, 'the single-turn dispatch ledger is untouched');
  assert.doesNotMatch(executableSql, /UNIQUE \(source_turn_id\)|source_turn_id uuid NOT NULL UNIQUE/u,
    'no one-event-per-source-turn or one-batch-per-turn constraint is introduced');
});

test('T-03A1 tables and the conversation runtime keep their existing shape', () => {
  assert.doesNotMatch(executableSql, /ALTER TABLE public\.conversation_turns|ALTER TABLE public\.conversation_sessions|ALTER TABLE public\.users/u,
    'conversation_turns, conversation_sessions and users are not altered');
  assert.doesNotMatch(executableSql, /finalize_conversation_turn|claim_conversation_turn|fail_conversation_turn|cancel_conversation_turn/u,
    'the conversation lifecycle authorities are untouched');
  const alters = [...executableSql.matchAll(/ALTER TABLE public\.(\w+)/gu)].map((m) => m[1]);
  assert.deepEqual([...new Set(alters)].sort(), ['conversation_unit_commit_events', 'conversation_units', 'session_semantic_clocks']);
});

test('the activation grants the producer to service_role only, and the reads to their own channel', () => {
  for (const signature of [
    'public\\.commit_conversation_units_v1\\(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text\\)',
    'public\\.commit_finalized_exchange_conversation_units_v1\\(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text\\)',
    'public\\.get_conversation_unit_commit_batch_snapshot_v1\\(uuid,uuid,uuid,uuid\\)',
  ]) {
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION ${signature} TO service_role`, 'u'));
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION ${signature}\\s*\n?\\s*FROM PUBLIC, anon, authenticated`, 'u'));
  }
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.get_session_temporal_state_v1\(uuid\) TO authenticated;/u);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.get_conversational_units_committed_events_v1\(uuid,integer,integer\) TO authenticated;/u);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_session_temporal_state_v1\(uuid\) FROM service_role/u);
  assert.doesNotMatch(executableSql, /GRANT [A-Z, ]*ON TABLE public\.(?:conversation_unit|session_semantic)/u,
    'no direct table privilege is granted to any role');
  assert.match(migration, /REVOKE ALL ON TABLE public\.session_semantic_clocks, public\.conversation_unit_commit_events\s*\n?\s*FROM PUBLIC, anon, authenticated/u);
  for (const table of ['session_semantic_clocks', 'conversation_unit_commit_events']) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'u'));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} OWNER TO postgres`, 'u'));
  }
});

test('the owner-scoped reads derive identity from auth.uid() and expose no zero sentinel or Timeline', () => {
  const reads = section('CREATE FUNCTION public.get_session_temporal_state_v1', '-- 9. Ownership, search_path hardening');
  assert.match(reads, /caller := \(SELECT auth\.uid\(\)\);/u);
  assert.equal((reads.match(/auth\.uid\(\)/gu) ?? []).length, 2, 'both authenticated reads derive the owner server-side');
  assert.doesNotMatch(reads, /p_user_id/u, 'no caller-supplied user id is client authorization');
  assert.match(reads, /INVALID_DELIVERY_CURSOR/u);
  assert.match(reads, /INVALID_DELIVERY_LIMIT/u);
  assert.match(reads, /effective_limit < 1 OR effective_limit > 256/u, 'the catch-up page is bounded');
  assert.match(reads, /ORDER BY e\.first_sp/u, 'delivery events are ordered ascending by Session Position');
  assert.match(reads, /p_after_sp IS NOT NULL AND p_after_sp < 1/u, 'SP(0) can never be a delivery cursor');
  assert.doesNotMatch(reads, /committed_text|same_sp_event_sequence|timeline|history|projection/iu,
    'the catch-up transport is delivery/recovery, never a Timeline or history API');
});

test('the migration self-asserts its own activation invariants', () => {
  for (const assertion of [
    'T-03A2 activates a forward-only clock and backfills no Session Position',
    'T-03A2 requires a NOT NULL session_position on every committed conversational unit',
    'T-03A2 requires UNIQUE(session_id, session_position)',
    'T-03A2 requires exactly one Session Semantic Clock row per Session',
    'SP(0) is not a Session Position',
    'T-03A2 derives LH and sealing; it creates no second mutable authority',
    'the committed-CU delivery event carries no content, analysis or future material',
    'the canonical commitment producer must stay postgres-owned, SECURITY DEFINER and search_path-fixed',
    'T-03A2 activation requires service_role EXECUTE on the producer and the exchange coordinator',
    'the canonical producer must never be executable by',
    'the internal same-SP sequencing seam must not be executable by',
    'the temporal substrate must stay unreachable',
    'the committed-CU delivery event table must be append-only',
    'the runtime_event_outbox one-row-per-turn contract must remain untouched',
    'the runtime_event_outbox event-type contract must remain untouched',
  ]) {
    assert.ok(migration.includes(assertion), `the migration self-asserts: ${assertion}`);
  }
});

test('every identifier 0065 introduces fits the PostgreSQL 63-byte limit', () => {
  const identifiers = [...migration.matchAll(/\b(?:TABLE|FUNCTION|CONSTRAINT|INDEX|TRIGGER)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gu)].map((m) => m[1]);
  assert.ok(identifiers.length > 0, 'identifiers were actually scanned');
  const oversized = [...new Set(identifiers)].filter((name) => Buffer.byteLength(name, 'utf8') > 63);
  assert.deepEqual(oversized, [], `identifiers exceed PostgreSQL's 63-byte limit: ${oversized.join(', ')}`);
});

test('the 0065 verifier proves live semantics and is wired into the toolchain and CI', () => {
  for (const proof of [
    'AF66-01', 'pg_get_functiondef', 'SESSION_POSITION_NOT_ESTABLISHED', 'CONVERSATIONAL_UNITS_COMMITTED_EVENT_IS_IMMUTABLE',
    'conversation_units_session_sp_unique', 'INVALID_DELIVERY_CURSOR', 'INVALID_DELIVERY_LIMIT',
    'has_function_privilege', 'has_table_privilege', 'BLOCKED', 'zero fixture residue',
    'refuses to activate over pre-existing committed conversational units',
    'reserve_session_same_sp_event_v1', 'commit_finalized_exchange_conversation_units_v1',
    'get_session_temporal_state_v1', 'get_conversational_units_committed_events_v1',
    'get_conversation_unit_commit_batch_snapshot_v1',
  ]) {
    assert.match(verifier, new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), `verifier is missing ${proof}`);
  }
  assert.match(packageJson, /"verify:session-semantic-clock-sp-lh-delivery:integration": "node --env-file-if-exists=\.env database\/verify-migration-0065\.mjs"/u);
  assert.match(workflow, /run: npm run verify:session-semantic-clock-sp-lh-delivery:integration/u);
  const step = workflow.indexOf('run: npm run verify:session-semantic-clock-sp-lh-delivery:integration');
  assert.ok(step > workflow.indexOf('run: npm run verify:committed-conversational-unit-substrate:integration'),
    'the activation verifier runs after the T-03A1 substrate verifier');
});
