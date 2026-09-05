import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// T-03B1b2 - Focus Runtime Orchestration + Activation Readiness: the static
// database contract. Live semantics are proven against real PostgreSQL by
// database/verify-migration-0067.mjs. Migration 0067 is a READ / AUDIT
// substrate only: AC-B1B2-01 defers the live authority cutover to T-03D.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const migration = read('../migrations/0067_conversation_focus_runtime_integration_readiness_v1.sql');
const verifier = read('../verify-migration-0067.mjs');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const section = (from, to) => {
  const start = migration.indexOf(from);
  const end = to === undefined ? migration.length : migration.indexOf(to);
  assert.ok(start >= 0 && (to === undefined || end > start), `section ${from} was located`);
  return migration.slice(start, end).split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
};
const SELF_ASSERTION_MARKER = '-- 4. Terminal self-assertions';
const executableBody = migration.slice(0, migration.indexOf(SELF_ASSERTION_MARKER)).split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const migrationLevelSql = executableBody.split(/\$\$[\s\S]*?\$\$/gu).join('\n');
const snapshot = section('CREATE FUNCTION public.get_conversation_integrated_batch_snapshot_v1', '-- 2. The activation-readiness audit');
const audit = section('CREATE FUNCTION public.assert_conversation_focus_capture_cutover_ready_v1', '-- 3. Ownership, search_path hardening');

function gitBlobId(content) {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

test('0067 orders after 0066, and 0064 / 0065 / 0066 are byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  // (T-03B2b2 added 0068, the durable Thread / Home substrate, pinned by
  // database/tests/durable-thread-home-same-sp-substrate-v1.test.mjs; 0067
  // stays the newest READ / AUDIT migration of T-03B1.)
  assert.ok(migrations.includes('0067_conversation_focus_runtime_integration_readiness_v1.sql'));
  assert.ok(migrations.indexOf('0067_conversation_focus_runtime_integration_readiness_v1.sql') > migrations.indexOf('0066_durable_reference_emerging_focus_sp_substrate_v1.sql'));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal(gitBlobId(read('../migrations/0064_committed_conversational_unit_substrate_v1.sql')), '0a2ee63980e59072b3e9f52a643efa8220e95b08', '0064 byte-identical');
  assert.equal(gitBlobId(read('../migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql')), '3dc061c71bcb237cec648abb2d1fa02f450cd57f', '0065 byte-identical');
  assert.equal(gitBlobId(read('../migrations/0066_durable_reference_emerging_focus_sp_substrate_v1.sql')), '9f0588d5ca46329a8721ee30302f49d227a357ae', '0066 byte-identical');
  // (T-03D re-anchored the 0066 verifier's T-03A2 grant posture to the cutover: the temporal-only producer is retired.)
  assert.equal(gitBlobId(read('../verify-migration-0066.mjs')), '13ccb087e415a316609b1121f937ca3699c59ba4', 'the 0066 verifier is byte-identical');
  assert.match(migration, /current_setting\('server_encoding'\) <> 'UTF8'/u);
  assert.match(migration, /to_regclass\('public\.conversation_focus_commit_batches'\) IS NULL/u, 'the T-03B1b1 substrate is a precondition');
});

test('0067 adds exactly two read / audit functions and nothing else', () => {
  assert.deepEqual([...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((m) => m[1]).sort(),
    ['assert_conversation_focus_capture_cutover_ready_v1', 'get_conversation_integrated_batch_snapshot_v1']);
  assert.deepEqual([...migration.matchAll(/CREATE TABLE/gu)], [], 'no table is created');
  assert.doesNotMatch(executableSql, /CREATE OR REPLACE|DROP |ALTER TABLE|CREATE TRIGGER|CREATE INDEX|CREATE POLICY|CREATE EXTENSION|CREATE SEQUENCE/u);
  // No semantic write, backfill, clock change or CU change anywhere - not at
  // migration level and not inside either function body.
  assert.doesNotMatch(executableBody, /INSERT INTO|UPDATE public|DELETE FROM|TRUNCATE/u, 'the migration writes, backfills, rewrites and deletes nothing');
  assert.deepEqual([...migrationLevelSql.matchAll(/INSERT INTO public\.(\w+)/gu)], []);
  assert.doesNotMatch(executableBody, /session_semantic_clocks c\s+SET|SET current_sp|same_sp_event_sequence =/u, 'no Session clock row changes');
});

test('the integrated snapshot delegates the commitment half to T-03A2 and adds technical B1 completeness only', () => {
  assert.match(snapshot, /RETURNS TABLE\(\s*batch_exists boolean,\s*committed_unit_count integer,\s*units jsonb,\s*commit_event jsonb,\s*source_frontier integer,\s*live_head integer,\s*focus_batch_exists boolean,\s*focus_semantic_count integer,\s*focus_attention_count integer,\s*focus_complete boolean\s*\)/u);
  assert.match(snapshot, /FROM public\.get_conversation_unit_commit_batch_snapshot_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\) s;/u,
    'ownership, replay and source-frontier semantics are the T-03A2 read, preserved by delegation');
  assert.match(snapshot, /focus_row\.user_id <> p_user_id OR focus_row\.session_id <> p_session_id OR focus_row\.source_turn_id <> p_source_turn_id/u);
  assert.match(snapshot, /focus_complete := focus_row\.unit_count = committed_unit_count\s*\n\s*AND focus_semantic_count = committed_unit_count\s*\n\s*AND focus_attention_count = committed_unit_count;/u,
    'a zero-CU batch is complete only through its zero-unit focus batch; a non-zero batch needs one semantic and one attention row per CU');
  assert.match(snapshot, /s\.session_position = cu\.session_position/u, 'a semantic row disagreeing with its CU does not count');
  assert.match(snapshot, /e\.session_position = cu\.session_position/u);
  assert.doesNotMatch(snapshot, /created_at|CURRENT_TIMESTAMP|now\(\)|clock_timestamp/u, 'no timestamp determines completeness');
  assert.doesNotMatch(snapshot, /thread|live_focus|knowledge|timeline|reference_handles|claim_attributions|anchor_text/u, 'no semantic content, Thread, LF or K/V data is returned');
  assert.match(snapshot, /focus_batch_exists := false;/u);
  assert.match(snapshot, /IF batch_exists THEN/u, 'B1 completeness is examined only for an existing commitment batch');
});

test('the cutover-readiness audit is a STABLE proof that fails closed on every legacy or partial shape', () => {
  assert.match(audit, /RETURNS void\s*\n\s*LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''/u);
  for (const detail of ['COMMIT_BATCH_WITHOUT_FOCUS_BATCH', 'FOCUS_BATCH_UNIT_COUNT_MISMATCH', 'COMMITTED_CU_WITHOUT_FOCUS_SEMANTICS',
    'COMMITTED_CU_WITHOUT_ATTENTION_HISTORY', 'FOCUS_SEMANTICS_DISAGREE_WITH_CU', 'ATTENTION_HISTORY_DISAGREES_WITH_CU']) {
    assert.ok(audit.includes(detail), `the audit detects ${detail}`);
  }
  assert.equal((audit.match(/RAISE EXCEPTION 'FOCUS_CAPTURE_CUTOVER_NOT_READY' USING ERRCODE='55000'/gu) ?? []).length, 6, 'one stable technical error');
  assert.match(audit, /LEFT JOIN public\.conversation_focus_commit_batches f ON f\.commit_batch_id = b\.id\s*\n\s*WHERE f\.commit_batch_id IS NULL/u,
    'a zero-CU commitment without its zero-unit focus batch is detected by the same LEFT JOIN');
  assert.doesNotMatch(audit, /INSERT|UPDATE|DELETE|created_at|historical|PRE_FIRST_SP|focus_enabled|analysis_enabled|semantic_version|historical_ready/u,
    'the audit backfills, mutates and declares nothing');
});

test('0067 grants nothing, revokes no T-03A2 authority, and self-asserts the unchanged posture', () => {
  assert.doesNotMatch(executableSql, /GRANT /u, 'no GRANT of any kind');
  for (const fn of ['get_conversation_integrated_batch_snapshot_v1\\(uuid,uuid,uuid,uuid\\)', 'assert_conversation_focus_capture_cutover_ready_v1\\(\\)']) {
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn} FROM PUBLIC, anon, authenticated`, 'u'));
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn} FROM service_role`, 'u'));
    assert.match(migration, new RegExp(`ALTER FUNCTION public\\.${fn} OWNER TO postgres`, 'u'));
  }
  assert.doesNotMatch(executableSql, /REVOKE [^;]*(?:commit_conversation_units_v1|commit_finalized_exchange_conversation_units_v1|get_conversation_unit_commit_batch_snapshot_v1)\(/u,
    'no legacy T-03A2 writer or read is revoked');
  for (const assertion of [
    'T-03B1b2 performs no cutover: % must not execute %',
    'T-03B1b2 must leave the live T-03A2 service_role grants exactly in place',
    'the cutover-readiness audit must be STABLE: it is a proof, never a writer',
    'activation readiness must never become Product or historical eligibility state',
    'T-03B1b2 functions must stay postgres-owned, SECURITY DEFINER and search_path-fixed',
  ]) {
    assert.ok(migration.includes(assertion), `the migration self-asserts: ${assertion}`);
  }
  // The self-assertion covers the 0066 substrate and the seam too.
  assert.match(migration, /ARRAY\[integrated_snapshot, readiness_audit, focus_writer, focus_coordinator, focus_context, same_sp_helper\]/u);
});

test('every identifier 0067 introduces fits the PostgreSQL 63-byte limit', () => {
  const identifiers = [...migration.matchAll(/\b(?:FUNCTION)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gu)].map((m) => m[1]);
  assert.ok(identifiers.length > 0);
  assert.deepEqual([...new Set(identifiers)].filter((name) => Buffer.byteLength(name, 'utf8') > 63), []);
});

test('the 0067 verifier proves live semantics and is wired into the toolchain and CI', () => {
  for (const proof of ['FOCUS_CAPTURE_CUTOVER_NOT_READY', 'COMMIT_BATCH_WITHOUT_FOCUS_BATCH', 'COMMITTED_CU_WITHOUT_FOCUS_SEMANTICS',
    'COMMITTED_CU_WITHOUT_ATTENTION_HISTORY', 'get_conversation_integrated_batch_snapshot_v1', 'assert_conversation_focus_capture_cutover_ready_v1',
    'has_function_privilege', 'has_table_privilege', 'pg_get_functiondef', "same_sp_event_sequence: '0'", "same_sp_event_sequence: '1'",
    'the audit is STABLE', 'permission denied', 'a legacy batch is incomplete, never absent', 'no backfill occurred', 'mutated zero rows and zero clock coordinates',
    'commit_conversation_units_v1(', 'commit_conversation_units_with_focus_v1(']) {
    assert.match(verifier, new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), `verifier is missing ${proof}`);
  }
  assert.match(packageJson, /"verify:conversation-focus-runtime-integration-readiness:integration": "node --env-file-if-exists=\.env database\/verify-migration-0067\.mjs"/u);
  assert.match(workflow, /run: npm run verify:conversation-focus-runtime-integration-readiness:integration/u);
  assert.ok(workflow.indexOf('run: npm run verify:conversation-focus-runtime-integration-readiness:integration')
    > workflow.indexOf('run: npm run verify:durable-reference-emerging-focus-sp-substrate:integration'), 'the readiness verifier runs after the 0066 verifier');
});
