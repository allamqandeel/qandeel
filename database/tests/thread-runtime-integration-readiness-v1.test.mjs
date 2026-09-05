import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// T-03B2b3 - Thread Runtime Orchestration + Integration Readiness: the static
// database contract. Live semantics are proven against real PostgreSQL by
// database/verify-migration-0069.mjs. Migration 0069 is a READ / AUDIT
// substrate only: AC-B2B3-01 defers the live authority cutover to T-03D, and
// ED-B2B3-01 keeps migration 0068's `conversation_thread_batch_state_v1` the
// single structural B2 completeness authority.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const migration = read('../migrations/0069_thread_runtime_integration_readiness_v1.sql');
const verifier = read('../verify-migration-0069.mjs');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const section = (from, to) => {
  const start = migration.indexOf(from);
  const end = to === undefined ? migration.length : migration.indexOf(to);
  assert.ok(start >= 0 && (to === undefined || end > start), `section ${from} was located`);
  return migration.slice(start, end).split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
};
const SELF_ASSERTION_MARKER = '-- 5. Terminal self-assertions';
const executableBody = migration.slice(0, migration.indexOf(SELF_ASSERTION_MARKER)).split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const migrationLevelSql = executableBody.split(/\$\$[\s\S]*?\$\$/gu).join('\n');
const snapshot = section('CREATE FUNCTION public.get_conversation_focus_thread_integrated_batch_snapshot_v1', '-- 2. The combined B1+B2 runtime context');
const context = section('CREATE FUNCTION public.get_conversation_focus_thread_runtime_context_v1', '-- 3. The Thread-capture cutover-readiness audit');
const audit = section('CREATE FUNCTION public.assert_conversation_thread_capture_cutover_ready_v1', '-- 4. Ownership, search_path hardening');

function gitBlobId(content) {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

test('0069 is the newest migration, and 0064 - 0068 are byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  // (T-03B3 added 0070, the FINAL Thread-layer substrate, pinned by
  // database/tests/thread-lifecycle-cross-session-continuity-v1.test.mjs; 0069
  // stays the newest READ / AUDIT-only migration of T-03B2.)
  assert.ok(migrations.includes('0069_thread_runtime_integration_readiness_v1.sql'));
  assert.ok(migrations.indexOf('0069_thread_runtime_integration_readiness_v1.sql') > migrations.indexOf('0068_durable_thread_home_same_sp_substrate_v1.sql'));
  assert.equal(migrations.filter((name) => name.startsWith('0069_')).length, 1, 'exactly one 0069 migration exists');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  for (const [name, blob] of [
    ['0064_committed_conversational_unit_substrate_v1.sql', '0a2ee63980e59072b3e9f52a643efa8220e95b08'],
    ['0065_session_semantic_clock_sp_lh_delivery_v1.sql', '3dc061c71bcb237cec648abb2d1fa02f450cd57f'],
    ['0066_durable_reference_emerging_focus_sp_substrate_v1.sql', '9f0588d5ca46329a8721ee30302f49d227a357ae'],
    ['0067_conversation_focus_runtime_integration_readiness_v1.sql', 'd12a3f552e80709ee1d20887f55f1c84e84f9208'],
    ['0068_durable_thread_home_same_sp_substrate_v1.sql', '5ea270424059acd40c0a6bf7dc040efc3aa693d3'],
  ]) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  // (T-03D re-anchored the 0066 / 0067 / 0068 verifiers' T-03A2 grant posture to the cutover: the temporal-only producer is retired.)
  for (const [name, blob] of [
    ['verify-migration-0066.mjs', '13ccb087e415a316609b1121f937ca3699c59ba4'],
    ['verify-migration-0067.mjs', '0e496a95da7a0ee596c416e0c599f703c121b991'],
    ['verify-migration-0068.mjs', '4f5984ac54c4ba03662c9336eea66578adc80b23'],
  ]) {
    assert.equal(gitBlobId(read(`../${name}`)), blob, `the ${name} verifier is byte-identical`);
  }
  assert.match(migration, /current_setting\('server_encoding'\) <> 'UTF8'/u);
  assert.match(migration, /to_regprocedure\('public\.conversation_thread_batch_state_v1\(uuid,uuid,uuid,uuid\)'\) IS NULL/u,
    'the 0068 structural B2 authority is a precondition');
  assert.match(migration, /to_regclass\('public\.conversation_thread_commit_batches'\) IS NULL/u);
});

test('0069 adds exactly three read / audit functions and nothing else', () => {
  assert.deepEqual([...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((m) => m[1]).sort(), [
    'assert_conversation_thread_capture_cutover_ready_v1',
    'get_conversation_focus_thread_integrated_batch_snapshot_v1',
    'get_conversation_focus_thread_runtime_context_v1',
  ]);
  assert.deepEqual([...migration.matchAll(/CREATE TABLE/gu)], [], 'no table is created');
  assert.doesNotMatch(executableSql, /CREATE OR REPLACE|DROP |ALTER TABLE|CREATE TRIGGER|CREATE INDEX|CREATE POLICY|CREATE EXTENSION|CREATE SEQUENCE|CREATE TYPE/u);
  // ED-B2B3-01: no semantic write, backfill, repair, clock change, SP
  // allocation or same-SP reservation - neither at migration level nor inside
  // any function body.
  assert.doesNotMatch(executableBody, /INSERT INTO|UPDATE public|DELETE FROM|TRUNCATE/u, 'the migration writes, backfills, repairs and deletes nothing');
  assert.deepEqual([...migrationLevelSql.matchAll(/INSERT INTO public\.(\w+)/gu)], []);
  assert.doesNotMatch(executableBody, /session_semantic_clocks c\s+SET|SET current_sp|same_sp_event_sequence =|reserve_session_same_sp_event_v1|FOR UPDATE/u,
    'no clock row changes, no SP is allocated, no same-SP sequence is reserved and no row is locked');
  assert.doesNotMatch(executableBody, /historical|PRE_FIRST_SP|knowledge_frontier|live_focus|LIVE_FOCUS|reading|neighborhood|merge/iu,
    'no historical, LF, Reading, Neighborhood or Thread-merge state appears');
});

test('the integrated snapshot delegates both earlier halves and reuses the ONE 0068 B2 authority', () => {
  assert.match(snapshot, /RETURNS TABLE\(\s*batch_exists boolean,\s*committed_unit_count integer,\s*units jsonb,\s*commit_event jsonb,\s*source_frontier integer,\s*live_head integer,\s*focus_batch_exists boolean,\s*focus_semantic_count integer,\s*focus_attention_count integer,\s*focus_complete boolean,\s*thread_capture_state text,\s*thread_batch_exists boolean,\s*thread_unit_count integer,\s*thread_establishment_count integer\s*\)/u);
  assert.match(snapshot, /LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''/u);
  assert.match(snapshot, /FROM public\.get_conversation_integrated_batch_snapshot_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\) s;/u,
    'ownership, replay, source-frontier and B1 completeness are the T-03B1b2 read, preserved by delegation');
  assert.match(snapshot, /thread_capture_state := public\.conversation_thread_batch_state_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\);/u,
    'B2 completeness is READ from the single 0068 authority, never recomputed');
  // The B2 completeness rules are NOT restated here: no counting, no coherence
  // walk, no evidence or origin logic of its own.
  assert.doesNotMatch(snapshot, /conversation_thread_establishment_evidence|conversation_thread_origin_members|conversation_thread_homes|conversation_threads\b/u,
    '0069 must not duplicate or re-implement B2 completeness');
  assert.match(snapshot, /thread_row\.user_id <> p_user_id OR thread_row\.session_id <> p_session_id OR thread_row\.source_turn_id <> p_source_turn_id/u,
    'a capture batch that belongs to another owner, Session or turn fails closed exactly as the B1 read does');
  assert.doesNotMatch(snapshot, /created_at|CURRENT_TIMESTAMP|now\(\)|clock_timestamp/u, 'no timestamp decides any state');
});

test('the combined runtime context fails closed on incomplete prior capture and leaks no future or foreign truth', () => {
  assert.match(context, /RETURNS TABLE\(\s*base_current_sp integer,\s*base_same_sp_event_sequence bigint,\s*prior_cus jsonb,\s*reference_handles jsonb,\s*focus_candidates jsonb,\s*current_focus_candidate_id uuid,\s*prior_focus_semantics jsonb,\s*focus_attention_history jsonb,\s*established_thread_bindings jsonb\s*\)/u);
  assert.match(context, /LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''/u);
  assert.match(context, /FROM public\.get_conversation_focus_runtime_context_v1\(p_session_id, p_user_id\) c;/u,
    'the token and the B1 prior context are the T-03B1b1 read, preserved by delegation');
  assert.match(context, /IF semantic_bundle_count <> committed_cu_count OR attention_item_count <> committed_cu_count THEN/u);
  assert.match(context, /RAISE EXCEPTION 'INCOMPLETE_PRIOR_THREAD_HISTORY'/u);
  assert.match(context, /public\.conversation_thread_batch_state_v1\(b\.session_id, b\.user_id, b\.source_turn_id, b\.id\) <> 'COMPLETE'/u,
    'a prior commitment batch that is not B2-COMPLETE by the ONE authority stops the runtime path');
  assert.match(context, /RAISE EXCEPTION 'INVALID_THREAD_RUNTIME_CONTEXT'/u, 'a Thread later than the base token is refused, never truncated');
  assert.match(context, /WHERE t\.user_id = p_user_id AND t\.established_session_id = p_session_id\s*\n\s*AND t\.established_sp <= base_current_sp;/u,
    'Thread bindings are same-user, same-Session and never at a future SP');
  // No cleaning, no skipping, no similarity and no cross-session identity.
  assert.doesNotMatch(context, /LEFT JOIN public\.conversation_unit_focus_semantics|COALESCE\(s\.functions/u, 'a prior CU without its bundle is refused, never defaulted');
  assert.doesNotMatch(context, /similar|embedding|label|score|distance|ILIKE|~\*/u, 'no label, similarity or fuzzy matching decides identity');
  assert.doesNotMatch(context, /created_at|CURRENT_TIMESTAMP|now\(\)|clock_timestamp/u, 'no timestamp orders or filters anything');
  // The bundle shape is the exact canonical B1 payload the evaluator consumes.
  for (const key of ["'unit_id'", "'functions'", "'sequence_position'", "'target_cu_id'", "'references'", "'claim_attributions'", "'attention'",
    "'creates_handle'", "'candidate_handle_ids'", "'creates_focus'", "'grounding_reference_index'"]) {
    assert.ok(context.includes(key), `the canonical B1 bundle carries ${key}`);
  }
  for (const key of ["'thread_id'", "'emerging_focus_id'", "'established_cu_id'", "'established_sp'"]) {
    assert.ok(context.includes(key), `the Thread binding carries ${key}`);
  }
  assert.doesNotMatch(context, /placement_x|placement_y|home_anchor_id|address_scheme|world_fingerprint/u,
    'no Home coordinate, anchor or fingerprint crosses the runtime boundary');
});

test('the readiness audit is a STABLE proof over the ONE authority that fails closed and repairs nothing', () => {
  assert.match(audit, /RETURNS void\s*\n\s*LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''/u);
  assert.match(audit, /public\.conversation_thread_batch_state_v1\(b\.session_id, b\.user_id, b\.source_turn_id, b\.id\) <> 'COMPLETE'/u);
  assert.equal((audit.match(/RAISE EXCEPTION 'THREAD_CAPTURE_CUTOVER_NOT_READY' USING ERRCODE='55000'/gu) ?? []).length, 1, 'one stable technical error');
  assert.ok(audit.includes('COMMIT_BATCH_NOT_THREAD_COMPLETE'), 'the audit names the offending batch and its state');
  assert.doesNotMatch(audit, /INSERT|UPDATE|DELETE|created_at|historical|PRE_FIRST_SP|thread_enabled|analysis_enabled|semantic_version|historical_ready/u,
    'the audit backfills, mutates and declares nothing');
});

test('0069 grants nothing, revokes no T-03A2 authority, and self-asserts the unchanged posture', () => {
  assert.doesNotMatch(executableSql, /GRANT /u, 'no GRANT of any kind');
  for (const fn of ['get_conversation_focus_thread_integrated_batch_snapshot_v1\\(uuid,uuid,uuid,uuid\\)',
    'get_conversation_focus_thread_runtime_context_v1\\(uuid,uuid\\)',
    'assert_conversation_thread_capture_cutover_ready_v1\\(\\)']) {
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn} FROM PUBLIC, anon, authenticated`, 'u'));
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn} FROM service_role`, 'u'));
    assert.match(migration, new RegExp(`ALTER FUNCTION public\\.${fn} OWNER TO postgres`, 'u'));
  }
  assert.doesNotMatch(executableSql, /REVOKE [^;]*(?:commit_conversation_units_v1|commit_finalized_exchange_conversation_units_v1|get_conversation_unit_commit_batch_snapshot_v1)\(/u,
    'no legacy T-03A2 writer or read is revoked');
  for (const assertion of [
    'T-03B2b3 performs no cutover: % must not execute %',
    'T-03B2b3 must leave the live T-03A2 service_role grants exactly in place',
    'T-03B2b3 adds reads and one audit only: % must be STABLE, never a writer',
    'T-03B2b3 must reuse the single 0068 B2 completeness authority, never duplicate it',
    'activation readiness must never become Product or historical eligibility state',
    'T-03B2b3 functions must stay postgres-owned, SECURITY DEFINER and search_path-fixed',
  ]) {
    assert.ok(migration.includes(assertion), `the migration self-asserts: ${assertion}`);
  }
  assert.match(migration, /ARRAY\[thread_snapshot, thread_context, readiness_audit, batch_state,\s*\n\s*thread_writer, thread_coordinator, focus_writer, focus_coordinator,\s*\n\s*focus_context, focus_snapshot, same_sp_helper\]/u,
    'the ungranted set covers both the B1 and the B2 integrated surfaces plus the same-SP seam');
  assert.match(migration, /T-03D owns the final semantic-chain\s*\n-- authority cutover/u, 'the live cutover is explicitly deferred to T-03D');
});

test('every identifier 0069 introduces fits the PostgreSQL 63-byte limit', () => {
  const identifiers = [...migration.matchAll(/\b(?:FUNCTION)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gu)].map((m) => m[1]);
  assert.ok(identifiers.length > 0);
  assert.deepEqual([...new Set(identifiers)].filter((name) => Buffer.byteLength(name, 'utf8') > 63), []);
});

test('the 0069 verifier proves live semantics and is wired into the toolchain and CI', () => {
  for (const proof of ['THREAD_CAPTURE_CUTOVER_NOT_READY', 'COMMIT_BATCH_NOT_THREAD_COMPLETE', 'INCOMPLETE_PRIOR_THREAD_HISTORY',
    'get_conversation_focus_thread_integrated_batch_snapshot_v1', 'get_conversation_focus_thread_runtime_context_v1',
    'assert_conversation_thread_capture_cutover_ready_v1', 'conversation_thread_batch_state_v1',
    'has_function_privilege', 'has_table_privilege', 'pg_get_functiondef', "same_sp_event_sequence: '1'", "same_sp_event_sequence: '2'",
    'a legacy T-03A2-only non-zero batch', 'a B1-only batch whose B2 capture never ran', 'a deleted establishment-evidence row',
    'a deleted Conversational Origin member', 'a deleted permanent Home', 'mutated zero rows and zero clock coordinates',
    'no repair, no backfill', 'permission denied', 'commit_conversation_units_v1(', 'is STABLE: the database itself refuses any write']) {
    assert.match(verifier, new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), `verifier is missing ${proof}`);
  }
  assert.match(packageJson, /"verify:thread-runtime-integration-readiness:integration": "node --env-file-if-exists=\.env database\/verify-migration-0069\.mjs"/u);
  assert.match(workflow, /run: npm run verify:thread-runtime-integration-readiness:integration/u);
  assert.ok(workflow.indexOf('run: npm run verify:thread-runtime-integration-readiness:integration')
    > workflow.indexOf('run: npm run verify:durable-thread-home-same-sp-substrate:integration'), 'the readiness verifier runs after the 0068 verifier');
});
