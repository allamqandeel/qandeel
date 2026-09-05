import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// T-03C - Historical Coverage Completion + Layer A Projection + Layer B
// Disclosure v1: the static database contract. Live semantics are proven
// against real PostgreSQL by database/verify-migration-0072.mjs. Migration 0072
// completes SP-native availability / validity capture for every v1 exposed
// family, decides coverage per Session, cuts the SP(1) baseline under the
// world-clock lock, enters the durable post-response execution as the ONE
// server-owned Session association, preserves every canonical row (R-C2),
// tracks every legacy attach path (R-C3), maps expiry into SP space (R-C5),
// and opens exactly ONE owner-scoped Layer-A projection read.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const migration = read('../migrations/0072_historical_coverage_projection_disclosure_v1.sql');
const verifier = read('../verify-migration-0072.mjs');
const cleanup = read('../verifier-fixture-cleanup.mjs');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const stripSql = (text) => text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const executableSql = stripSql(migration);
const SELF_ASSERTION_MARKER = '-- 16. Terminal self-assertions';
assert.ok(migration.includes(SELF_ASSERTION_MARKER), 'the terminal self-assertion section exists');
const executableBody = stripSql(migration.slice(0, migration.indexOf(SELF_ASSERTION_MARKER)));
const migrationLevelSql = executableBody.split(/\$\$[\s\S]*?\$\$/gu).join('\n');
const section = (from, to) => {
  const start = migration.indexOf(from);
  const end = to === undefined ? migration.length : migration.indexOf(to, start);
  assert.ok(start >= 0 && (to === undefined || end > start), `section ${from} was located`);
  return stripSql(migration.slice(start, end));
};
const tables = section('-- 1. The World Semantic Clock', '-- 7. Identity, and the historical capture boundary');
const boundary = section('CREATE FUNCTION public.historical_capture_begin_v1', 'CREATE FUNCTION public.historical_event_identity_conflict_v1');
const hooks = section('CREATE FUNCTION public.historical_event_identity_conflict_v1', '-- 9. The LEGACY BASELINE');
const seeding = section('-- 9. The LEGACY BASELINE', '-- 10. Installing the hooks');
const wrappers = section('-- 11. The live writers enter the historical boundary', '-- 12. The Thread <-> Reading appearance writers');
const bindings = section('-- 12. The Thread <-> Reading appearance writers', '-- 13. R-C5');
const expiry = section('-- 13. R-C5', '-- 14. Layer A');
const projection = section('CREATE FUNCTION public.get_session_historical_projection_v1', '-- 15. Ownership, search_path hardening');
const posture = section('-- 15. Ownership, search_path hardening', SELF_ASSERTION_MARKER);

function gitBlobId(content) {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

test('0072 is the newest migration, 0064 - 0071 are byte-identical, and every frozen precondition is required', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), '0072_historical_coverage_projection_disclosure_v1.sql');
  assert.equal(migrations.filter((name) => name.startsWith('0072_')).length, 1, 'exactly one 0072 migration exists');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  for (const [name, blob] of [
    ['0064_committed_conversational_unit_substrate_v1.sql', '0a2ee63980e59072b3e9f52a643efa8220e95b08'],
    ['0065_session_semantic_clock_sp_lh_delivery_v1.sql', '3dc061c71bcb237cec648abb2d1fa02f450cd57f'],
    ['0066_durable_reference_emerging_focus_sp_substrate_v1.sql', '9f0588d5ca46329a8721ee30302f49d227a357ae'],
    ['0067_conversation_focus_runtime_integration_readiness_v1.sql', 'd12a3f552e80709ee1d20887f55f1c84e84f9208'],
    ['0068_durable_thread_home_same_sp_substrate_v1.sql', '5ea270424059acd40c0a6bf7dc040efc3aa693d3'],
    ['0069_thread_runtime_integration_readiness_v1.sql', 'fc2531a5a880f440b7086a3a63ba6557527413a7'],
    ['0070_thread_lifecycle_cross_session_continuity_v1.sql', '8436717bcf23877e1c1048b248b51717f5a9a8a6'],
  ]) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.match(migration, /current_setting\('server_encoding'\) <> 'UTF8'/u);
  for (const precondition of ['public.reserve_session_same_sp_event_v1(uuid,uuid)', 'public.canonical_uuid_v5_v1(uuid,text)', 'public.conversation_thread_session_lifecycle_state_v1(uuid,uuid,integer)',
    'public.conversation_session_live_focus_before_v1(uuid,integer)', 'public.persist_post_response_hypothesis_generation_v1(uuid)', 'public.execute_post_response_hypothesis_update_batch_v1(uuid,jsonb)',
    'public.execute_post_response_confidence_batch_v1(uuid)', 'public.sync_post_response_information_gaps_v2(uuid)', 'public.server_create_memory_v1(']) {
    assert.ok(migration.includes(precondition), `0072 requires ${precondition}`);
  }
});

test('0072 adds exactly the thirteen history tables: SP-native anchors, typed per family, append-only, no label / score / camera', () => {
  assert.deepEqual([...migration.matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]).sort(), [
    'historical_confidence_events', 'historical_evidence_participation_events', 'historical_gap_events', 'historical_material_events', 'historical_question_appearance_events',
    'historical_question_events', 'historical_reading_events', 'historical_reading_relation_events', 'historical_thread_availability', 'historical_world_semantic_clocks',
    'session_historical_baselines', 'session_historical_coverage', 'thread_reading_bindings']);
  assert.doesNotMatch(executableSql, /DROP |CREATE EXTENSION|CREATE SEQUENCE|CREATE TYPE|CREATE POLICY|ADD COLUMN|TRUNCATE/u, 'no destructive DDL, no column added to a frozen table');
  assert.doesNotMatch(executableBody, /ALTER TABLE public\.(?:conversation_units|conversation_threads|conversation_thread_homes|conversation_emerging_focuses|session_semantic_clocks|hypotheses|memories|information_gaps|question_candidates|confidence_evaluations|formal_question_turn_bindings)\b/u,
    '0072 alters no frozen table (triggers attach without ALTER TABLE)');
  for (const forbidden of ['label', 'title', 'coordinate', 'direction', 'score', 'rank', 'weight', 'centrality', 'priority', 'viewport', 'camera', 'inspection', 'timeline', 'knowledge_frontier', 'version_frontier', 'analysis']) {
    assert.equal(tables.includes(forbidden), false, `the history tables must not carry ${forbidden}`);
  }
  // Every anchored event table carries the ONE anchor shape.
  const anchorTables = ['historical_reading_events', 'historical_evidence_participation_events', 'historical_reading_relation_events', 'historical_material_events', 'historical_gap_events', 'historical_question_events', 'historical_confidence_events'];
  for (const table of anchorTables) {
    const ddl = tables.slice(tables.indexOf(`CREATE TABLE public.${table} (`), tables.indexOf(');', tables.indexOf(`CREATE TABLE public.${table} (`)));
    assert.match(ddl, /session_id uuid,\s*\n\s*session_position integer,\s*\n\s*same_sp_event_sequence bigint,\s*\n\s*world_version bigint NOT NULL,/u, `${table} carries the SP-native anchor and the world version`);
    assert.match(ddl, /\(session_position IS NULL\) = \(same_sp_event_sequence IS NULL\)/u, `${table}: an SP always comes with its same-SP sequence`);
    assert.match(ddl, /\(session_id IS NOT NULL OR session_position IS NULL\)/u, `${table}: no SP without a Session`);
    assert.match(ddl, /world_version >= 0/u);
  }
  assert.match(migration, /coverage_state IN \('COVERED', 'LEGACY_UNCOVERED'\)/u, 'exactly the two coverage decisions');
  assert.match(migration, /event_kind IN \('LEGACY_BASELINE', 'CREATED', 'STATUS_TRANSITION', 'VERSION_ADVANCED'\)/u, 'Reading events: creation, status, version advance, legacy baseline');
  assert.match(migration, /event_kind IN \('LEGACY_BASELINE', 'ATTACHED', 'DETACHED'\)/u);
  assert.match(migration, /event_kind IN \('LEGACY_BASELINE', 'LINKED', 'UNLINKED'\)/u);
  assert.match(migration, /event_kind IN \('LEGACY_BASELINE', 'CREATED', 'CLOSED', 'REOPENED'\)/u);
  assert.match(migration, /hypothesis_a < hypothesis_b/u, 'a peer relation is one unordered pair');
  assert.match(migration, /evidence_id ~ '\^memory:/u, 'Evidence identity is the canonical memory: form');
  assert.match(migration, /binding_id uuid NOT NULL UNIQUE/u, 'one appearance per Formal Question binding');
  assert.match(migration, /WHERE unbound_sp IS NULL/u, 'one current Thread <-> Reading appearance per (Session, Thread, Reading)');
  assert.match(migration, /unbound_sp IS NULL OR unbound_sp >= bound_sp/u);
  for (const table of ['session_historical_coverage', 'session_historical_baselines', 'historical_thread_availability', ...anchorTables, 'historical_question_appearance_events']) {
    assert.match(migration, new RegExp(`BEFORE UPDATE OR DELETE ON public\\.${table}\\s*\\n\\s*FOR EACH ROW EXECUTE FUNCTION public\\.reject_historical_projection_mutation_v1\\(\\)`, 'u'), `${table} is append-only`);
  }
  assert.match(migration, /BEFORE UPDATE OR DELETE ON public\.historical_world_semantic_clocks\s*\n\s*FOR EACH ROW EXECUTE FUNCTION public\.guard_historical_world_semantic_clock_v1\(\)/u);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON public\.thread_reading_bindings\s*\n\s*FOR EACH ROW EXECUTE FUNCTION public\.guard_thread_reading_binding_mutation_v1\(\)/u);
  for (const token of ['CANONICAL_HISTORICAL_ROW_IS_IMMUTABLE', 'WORLD_SEMANTIC_CLOCK_IS_PERMANENT', 'WORLD_SEMANTIC_CLOCK_IS_MONOTONIC', 'CANONICAL_THREAD_READING_BINDING_IS_IMMUTABLE']) {
    assert.ok(migration.includes(token), `the migration names ${token}`);
  }
  // Timestamps: audit defaults, the CU wall-time read of the R-C5 mapping, and nothing ordered by time in the projection.
  assert.doesNotMatch(projection, /created_at|now\(\)|CURRENT_TIMESTAMP|clock_timestamp|ORDER BY [^;]*created_at/u, 'the projection reads no timestamp');
  assert.doesNotMatch(hooks, /ORDER BY [^;]*created_at|created_at\s*[<>=]/u, 'no hook orders or compares by time');
});

test('R-C1 coverage: a LEGACY UNCOVERED SESSION keeps its Conversation Runtime and stays historical-disabled; COVERED at creation; the SP(1) baseline is cut for COVERED Sessions only, under the world-clock lock; committed-CU insertion is never gated by coverage', () => {
  assert.match(seedingOrTables(), /INSERT INTO public\.session_historical_coverage \(session_id, user_id, coverage_state\)\s*\nSELECT s\.id, s\.user_id, 'LEGACY_UNCOVERED'/u, 'every pre-existing Session is decided LEGACY_UNCOVERED');
  assert.match(migration, /AFTER INSERT ON public\.conversation_sessions\s*\n\s*FOR EACH ROW EXECUTE FUNCTION public\.provision_session_historical_coverage_v1\(\)/u, 'a new Session is decided at creation');
  // R1-01: committed-CU runtime eligibility != historical projection eligibility.
  // A LEGACY UNCOVERED SESSION keeps committing CUs / Session Positions through
  // the frozen runtime authority; coverage is consulted by the baseline hook
  // (COVERED only) and by the projection (fail-closed), never by a gate on
  // conversation_units.
  // (executableBody: the migration before its terminal self-assertions, which
  // legitimately name the retired gate as a tombstone they refuse to find.)
  assert.doesNotMatch(executableBody, /BEFORE INSERT ON public\.conversation_units/u, 'no coverage gate stands between the runtime and a committed CU');
  assert.doesNotMatch(executableBody, /guard_session_historical_coverage_v1|coverage_gate/u, 'the committed-CU coverage gate does not exist');
  assert.match(migration.slice(migration.indexOf(SELF_ASSERTION_MARKER)), /to_regprocedure\('public\.guard_session_historical_coverage_v1\(\)'\) IS NOT NULL/u, 'the self-assertions refuse to deploy with the gate present');
  assert.doesNotMatch(hooks, /HISTORICAL_COVERAGE_UNAVAILABLE/u, 'no capture hook refuses a canonical write for coverage');
  assert.match(projection, /HISTORICAL_COVERAGE_UNAVAILABLE/u, 'the projection is where coverage fails closed');
  assert.equal((executableBody.match(/CREATE TRIGGER \w+\s*\n\s*(?:AFTER|BEFORE) [A-Z ]+ ON public\.conversation_units/gu) ?? []).length, 1, 'exactly ONE 0072 trigger on conversation_units');
  assert.match(migration, /AFTER INSERT ON public\.conversation_units\s*\n\s*FOR EACH ROW EXECUTE FUNCTION public\.capture_session_historical_baseline_v1\(\)/u, 'and it is the AFTER INSERT baseline hook');
  const baselineHook = hooks.slice(hooks.indexOf('CREATE FUNCTION public.capture_session_historical_baseline_v1'), hooks.indexOf('CREATE FUNCTION public.guard_historical_canonical_row_preservation_v1'));
  assert.match(baselineHook, /IF NEW\.session_position = 1 THEN/u, 'the baseline is cut at SP(1)');
  assert.match(baselineHook, /IF FOUND AND coverage = 'COVERED' THEN/u, 'a baseline belongs to a COVERED Session only - never fabricated for a LEGACY UNCOVERED SESSION (or an undecided one) that later commits a Moment');
  assert.ok(baselineHook.indexOf("coverage = 'COVERED'") < baselineHook.indexOf('INSERT INTO public.session_historical_baselines'), 'the coverage check precedes the cut');
  assert.doesNotMatch(baselineHook, /RAISE EXCEPTION/u, 'the baseline hook never refuses the committed CU');
  assert.match(baselineHook, /FOR UPDATE/u, 'under the world-clock row lock: no race gap with SP(1)');
  assert.match(baselineHook, /INSERT INTO public\.session_historical_baselines/u);
  assert.match(baselineHook, /question-appearance:/u, 'the Formal Question <-> Turn appearance anchors at the exchange\'s first committed Moment');
  assert.match(baselineHook, /b\.state = 'BOUND'/u);
  assert.doesNotMatch(baselineHook, /now\(\)|CURRENT_TIMESTAMP|clock_timestamp/u);
  assert.ok(migration.includes('coverage must gate historical projection, never committed-CU runtime'), 'the migration self-asserts the ungated runtime');
  assert.doesNotMatch(migration, /never enters committed-CU commitment|receives no committed Session Position|lose EXECUTE/u, 'no stale statement about a gated runtime or a revoked attach path survives (R1-04)');
});

test('verify:auth:smoke tears its fixture down under 0072: replica mode as the fixture owner, the T-03C decisions before the Sessions, a residue postcondition; no production guard weakened', () => {
  const smoke = read('../verify-supabase-auth.mjs');
  const body = smoke.slice(smoke.indexOf('async function cleanupRows()'), smoke.indexOf('\nasync function main()'));
  assert.ok(body.length > 0, 'cleanupRows() precedes main()');
  const order = ["SET LOCAL session_replication_role = 'replica'", 'DELETE FROM public.conversation_turns', 'DELETE FROM public.session_historical_baselines', 'DELETE FROM public.session_historical_coverage',
    'DELETE FROM public.session_semantic_clocks', 'DELETE FROM public.conversation_sessions', 'DELETE FROM public.users', 'AS total'].map((needle) => body.indexOf(needle));
  assert.ok(order.every((index, i) => index > 0 && (i === 0 || index > order[i - 1])), `replica mode first, then turns, the T-03C decisions, the clock, the Sessions, the user, then the residue postcondition (${order.join(',')})`);
  assert.match(body, /Auth smoke fixture cleanup left residue/u, 'the teardown proves its own completeness (replica mode relaxes FK enforcement)');
  assert.doesNotMatch(body, /ALTER TABLE|DISABLE TRIGGER|DROP /u, 'no DDL, no trigger disabled');
  assert.doesNotMatch(migration, /ON DELETE CASCADE/u, 'no production cascade merely for tests');
  assert.doesNotMatch(posture, /GRANT [^;]*(?:DELETE|ON TABLE)/u, 'no application DELETE grant, no table grant');
  assert.match(packageJson, /"verify:auth:smoke": "node --env-file=\.env database\/verify-supabase-auth\.mjs"/u, 'the smoke command is unchanged');
  assert.match(verifier, /verify-supabase-auth\.mjs/u, 'the 0072 verifier replays the smoke teardown from its source against real PostgreSQL');
  assert.match(verifier, /'session_historical_coverage', \['23001', '23503'\]/u, 'and proves the plain Session delete it replaces is the RESTRICT regression');
});

function seedingOrTables() { return `${tables}\n${seeding}`; }

test('the capture boundary: clock-first, the ONE 0065 seam, the world clock, one context per (user, Session association), unassociated writes world-only, no caller-supplied SP / sequence / version', () => {
  assert.match(boundary, /RETURNS TABLE\(session_id uuid, session_position integer, same_sp_event_sequence bigint, world_version bigint\)/u);
  const clock = boundary.indexOf('FROM public.session_semantic_clocks c');
  const seam = boundary.indexOf('FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r');
  const world = boundary.indexOf('FROM public.historical_world_semantic_clocks w WHERE w.user_id = p_user_id FOR UPDATE');
  assert.ok(clock > 0 && seam > clock && world > seam, 'AF66-01: Session Semantic Clock FIRST -> the ONE same-SP seam -> the World Semantic Clock');
  assert.match(boundary, /SET current_version = w\.current_version \+ 1/u, 'the world clock advances by exactly one per context');
  assert.doesNotMatch(boundary, /same_sp_event_sequence \+ 1|CREATE SEQUENCE|nextval\(/u, 'no second sequence authority');
  assert.match(boundary, /HISTORICAL_CAPTURE_ASSOCIATION_INTEGRITY/u, 'a Session of another user is refused');
  assert.match(boundary, /HISTORICAL_CAPTURE_SEQUENCE_INTEGRITY/u);
  assert.match(boundary, /qandeel\.historical_capture_context/u, 'the context is transaction-local');
  assert.match(boundary, /'requested_session_id', p_session_id/u, 'one context per (user, requested Session association)');
  assert.match(boundary, /public\.historical_capture_begin_v1\(p_user_id, NULL, false\)/u, 'a hook without a context establishes a world-only one: unassociated, never untracked, never fabricated');
  assert.match(boundary, /e\.source_turn_id = p_source_turn_id|FROM public\.post_response_intelligence_executions e/u, 'the durable execution is the server-owned association');
  const beginSignature = boundary.slice(0, boundary.indexOf(') RETURNS TABLE') > 0 ? boundary.indexOf(') RETURNS TABLE') : boundary.indexOf('RETURNS TABLE'));
  assert.doesNotMatch(beginSignature, /p_session_position|p_sp\b|p_same_sp|p_sequence|p_world_version/u, 'no caller supplies an SP, a sequence or a world version');
  assert.match(hooks, /HISTORICAL_EVENT_IDENTITY_CONFLICT/u, 'the same stable identity with a different payload is refused');
  assert.match(hooks, /ON CONFLICT \(event_id\) DO NOTHING/u, 'an identical retry duplicates nothing');
  assert.match(migration, /'79466f6b-04fd-5150-aa23-59682098057c'/u, 'the event namespace is pinned in SQL');
  assert.match(migration, /'11be3a36-745a-54fd-a938-3f14eaedee14'/u, 'the Thread <-> Reading binding namespace is pinned in SQL');
  assert.match(migration, /https:\/\/qandeel\.app\/runtime\/historical-availability-event\/v1/u);
  assert.match(migration, /https:\/\/qandeel\.app\/runtime\/thread-reading-binding\/v1/u);
  assert.match(migration, /public\.canonical_uuid_v5_v1\(/u, 'identities derive through the frozen 0068 v5 authority');
  assert.match(hooks, /'reading-version:' \|\| NEW\.id::text/u, 'a version advance without a status change is its own availability boundary');
  // R-C2: every canonical family is preserved; only lifecycle columns move.
  assert.match(hooks, /CANONICAL_HISTORICAL_ROW_IS_PRESERVED/u);
  assert.match(hooks, /CANONICAL_HISTORICAL_FIELD_IS_IMMUTABLE/u);
  assert.match(hooks, /ARRAY\['status', 'version', 'updated_at', 'supporting_evidence_ids', 'contradicting_evidence_ids', 'competing_hypothesis_ids'\]/u, 'the Reading\'s mutable columns are exactly its lifecycle columns');
  assert.match(hooks, /ARRAY\['status', 'updated_at'\]/u, 'the Material\'s mutable columns are exactly status and updated_at');
  for (const [table, trigger] of [['hypotheses', 'hypotheses_historical_capture'], ['memories', 'memories_historical_capture'], ['information_gaps', 'information_gaps_historical_capture'],
    ['question_candidates', 'question_candidates_historical_capture'], ['confidence_evaluations', 'confidence_evaluations_historical_capture'], ['conversation_threads', 'conversation_threads_historical_availability'],
    ['hypotheses', 'hypotheses_historical_preservation'], ['memories', 'memories_historical_preservation'], ['question_candidates', 'question_candidates_historical_preservation'], ['confidence_evaluations', 'confidence_evaluations_historical_preservation']]) {
    assert.match(migration, new RegExp(`CREATE TRIGGER ${trigger}\\s*\\n\\s*(?:AFTER INSERT OR UPDATE|AFTER INSERT|BEFORE UPDATE OR DELETE) ON public\\.${table}`, 'u'), `${table}.${trigger} exists`);
  }
  // Legacy seeding: baseline events only, world version 0, no Session anchor; no other migration-level DML.
  assert.equal((seeding.match(/'LEGACY_BASELINE'/gu) ?? []).length, 7, 'seven legacy families seed a LEGACY_BASELINE event');
  assert.doesNotMatch(seeding, /UPDATE public|DELETE FROM/u);
  const migrationInserts = [...migrationLevelSql.matchAll(/INSERT INTO public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(migrationInserts)], ['historical_confidence_events', 'historical_evidence_participation_events', 'historical_gap_events', 'historical_material_events', 'historical_question_events',
    'historical_reading_events', 'historical_reading_relation_events', 'historical_thread_availability', 'session_historical_coverage'], 'migration-level writes are the coverage decision and the legacy baseline events, nothing else');
  assert.doesNotMatch(migrationLevelSql, /UPDATE public\.(?:hypotheses|memories|information_gaps|question_candidates|confidence_evaluations|conversation_\w+)|DELETE FROM/u, 'no canonical row is rewritten or deleted at migration time');
});

test('the wrappers keep the frozen names, signatures and grants; the cores are renamed and unreachable; the synchronization entry still delegates to v2; the Memory command derives owner AND Session from the execution', () => {
  for (const [name, args] of [['persist_post_response_hypothesis_generation_v1', 'uuid'], ['execute_post_response_hypothesis_update_batch_v1', 'uuid,jsonb'], ['execute_post_response_confidence_batch_v1', 'uuid']]) {
    assert.match(wrappers, new RegExp(`ALTER FUNCTION public\\.${name}\\(${args}\\)\\s*\\n\\s*RENAME TO ${name}_core;`, 'u'), `${name} keeps its frozen body under _core`);
    assert.match(wrappers, new RegExp(`CREATE FUNCTION public\\.${name}\\(`, 'u'), `${name} is re-created under its public name`);
    assert.match(wrappers, new RegExp(`RETURN public\\.${name}_core\\(`, 'u'), `${name} runs exactly its frozen core`);
    assert.match(posture, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}_core\\(${args}\\) FROM PUBLIC, anon, authenticated;`, 'u'));
    assert.match(posture, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}_core\\(${args}\\) FROM service_role`, 'u'), `${name}_core is unreachable by service_role`);
    assert.match(posture, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\(${args}\\) TO service_role`, 'u'), `${name} keeps its service_role grant`);
  }
  assert.equal((wrappers.match(/PERFORM public\.historical_capture_begin_for_execution_v1\(p_execution_id\);/gu) ?? []).length, 4, 'the three managed commands and the synchronization entry enter the boundary first');
  assert.match(wrappers, /CREATE OR REPLACE FUNCTION public\.sync_post_response_information_gaps_v1\(p_execution_id uuid\)[\s\S]{0,400}RETURN public\.sync_post_response_information_gaps_v2\(p_execution_id\);/u, 'v1 keeps delegating to the v2 authority');
  assert.match(wrappers, /CREATE FUNCTION public\.server_create_memory_for_execution_v1\(\s*\n\s*p_source_turn_id uuid, p_memory_id uuid/u, 'the Memory command is keyed by the canonical source turn, never by a caller-supplied user or session id');
  assert.match(wrappers, /MEMORY_WRITE_EXECUTION_NOT_ASSOCIATED/u);
  assert.match(wrappers, /f\.effect_key = 'MEMORY_WRITE' AND f\.state = 'CLAIMED'/u);
  assert.match(wrappers, /public\.historical_capture_begin_v1\(execution_row\.user_id, execution_row\.session_id, true\)/u, 'the association is REQUIRED for the Memory command');
  assert.match(wrappers, /FROM public\.server_create_memory_v1\(execution_row\.user_id, p_memory_id/u, 'the frozen 0026 command is reused, never re-implemented');
  assert.doesNotMatch(wrappers, /RETURNS SETOF public\.(?:hypotheses|memories)/u, 'no new function returns a canonical row set (the 0026 / 0027 censuses stay exact)');
  assert.doesNotMatch(executableSql, /UPDATE public\.hypotheses SET status|INSERT INTO public\.hypothesis_lifecycle_transitions/u, 'no second Reading status writer, no second lifecycle audit writer');
});

test('the Thread <-> Reading appearance writers are clock-first, Session-bound, identity-derived, idempotent and granted to nobody', () => {
  assert.match(bindings, /CREATE FUNCTION public\.bind_reading_to_thread_v1\(p_user_id uuid, p_session_id uuid, p_thread_id uuid, p_hypothesis_id uuid\)/u);
  assert.match(bindings, /CREATE FUNCTION public\.unbind_reading_from_thread_v1\(p_user_id uuid, p_session_id uuid, p_binding_id uuid\)/u);
  assert.match(bindings, /public\.historical_capture_begin_v1\(p_user_id, p_session_id, true\)/u, 'clock-first through the ONE boundary, association required');
  assert.match(bindings, /SESSION_POSITION_NOT_ESTABLISHED/u, 'an appearance needs an addressable Session Position');
  assert.match(bindings, /THREAD_READING_BINDING_IDENTITY_CONFLICT/u, 'one life of an appearance per Session Position');
  assert.match(bindings, /p_session_id::text \|\| ':' \|\| p_thread_id::text \|\| ':' \|\| p_hypothesis_id::text \|\| ':' \|\| ctx\.session_position::text/u, 'the exact v5 name');
  assert.doesNotMatch(bindings, /p_bound_sp|p_session_position|p_sequence|p_world_version/u, 'no caller supplies the anchor');
  assert.doesNotMatch(posture, /GRANT EXECUTE ON FUNCTION public\.(?:bind_reading_to_thread_v1|unbind_reading_from_thread_v1)/u, 'granted to NO application role: the Product evaluator that decides WHEN is owned by no merged task');
});

test('R-C5: expiry is mapped from the wall-clock domain into SP space by ONE STABLE mapping and never compared to TC', () => {
  assert.match(expiry, /CREATE FUNCTION public\.historical_session_position_wall_time_v1\(p_session_id uuid, p_sp integer\)\s*\nRETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER/u);
  assert.match(expiry, /SELECT max\(u\.created_at\) FROM public\.conversation_units u\s*\n\s*WHERE u\.session_id = p_session_id AND u\.session_position <= p_sp/u, 't(k) is the running maximum of committed audit times up to k');
  assert.match(expiry, /CREATE FUNCTION public\.historical_memory_expiry_at_sp_v1\(p_session_id uuid, p_expires_at timestamptz\)\s*\nRETURNS TABLE\(mapping text, session_position integer\)\s*\nLANGUAGE plpgsql STABLE SECURITY DEFINER/u);
  for (const mapping of ["'NO_EXPIRY'", "'PRE_FIRST_SP'", "'SP'", "'NOT_IN_SESSION'", "'PENDING'"]) assert.ok(expiry.includes(mapping), `the mapping names ${mapping}`);
  assert.match(expiry, /WHERE public\.historical_session_position_wall_time_v1\(p_session_id, k\) <= p_expires_at/u, 'half-open: t(n) <= X < t(n+1), an exact tie is EXPIRED at n');
  assert.match(expiry, /IF p_expires_at < first_time THEN/u, 'X < t(1) is PRE_FIRST_SP');
  assert.match(expiry, /IF closed IS NOT NULL AND p_expires_at >= closed THEN/u, 'after the Session closed: NOT_IN_SESSION');
  assert.doesNotMatch(expiry, /INSERT INTO|UPDATE public|DELETE FROM/u, 'the mapping writes nothing: no LH advance, no TC move, no RH');
  assert.match(projection, /CROSS JOIN LATERAL public\.historical_memory_expiry_at_sp_v1\(p_session_id, m\.expires_at\) x/u, 'the projection consumes the ONE mapping');
  assert.match(projection, /WHEN l\.to_status = 'ACTIVE' AND x\.mapping = 'SP' AND x\.session_position <= p_tc THEN 'EXPIRED'/u, 'EXPIRED at TC iff the mapped SP is <= TC');
  assert.match(projection, /WHEN l\.to_status = 'ACTIVE' AND x\.mapping = 'PRE_FIRST_SP' THEN 'EXPIRED'/u);
  assert.doesNotMatch(projection, /expires_at\s*[<>=]|expires_at <= |p_tc\s*[<>=]\s*m\.expires_at/u, 'expires_at is never compared to TC or to any clock inside the projection');
});

test('Layer A: the ONE owner-scoped projection is STABLE, coverage-gated, TC-validated, fail-closed, and gates every family by its own availability anchor', () => {
  assert.match(projection, /RETURNS TABLE\(\s*\n\s*session_id uuid,\s*\n\s*live_head integer,\s*\n\s*tc integer,\s*\n\s*sealed boolean,\s*\n\s*revision jsonb,\s*\n\s*moments jsonb,\s*\n\s*emerging_focuses jsonb,\s*\n\s*live_focus jsonb,\s*\n\s*threads jsonb,\s*\n\s*thread_reading_appearances jsonb,\s*\n\s*readings jsonb,\s*\n\s*reading_relations jsonb,\s*\n\s*evidence_participations jsonb,\s*\n\s*materials jsonb,\s*\n\s*gaps jsonb,\s*\n\s*questions jsonb,\s*\n\s*question_appearances jsonb,\s*\n\s*confidences jsonb\s*\n\)/u,
    'typed per family: no generic world-truth blob');
  assert.match(projection, /LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''/u);
  assert.match(projection, /caller := \(SELECT auth\.uid\(\)\);/u, 'ownership is server-derived, never a caller-supplied user id');
  const coverage = projection.indexOf("RAISE EXCEPTION 'HISTORICAL_COVERAGE_UNAVAILABLE'");
  const liveHead = projection.indexOf("RAISE EXCEPTION 'LIVE_HEAD_NOT_ESTABLISHED'");
  const addressable = projection.indexOf("RAISE EXCEPTION 'SESSION_POSITION_NOT_ADDRESSABLE'");
  const baseline = projection.indexOf("RAISE EXCEPTION 'HISTORICAL_BASELINE_MISSING'");
  assert.ok(coverage > 0 && liveHead > coverage && addressable > liveHead && baseline > addressable, 'gate order: coverage -> Live Head -> TC -> baseline, every one fail-closed (Z66-05)');
  assert.match(projection, /IF p_tc IS NULL OR p_tc < 1 OR p_tc > lh THEN/u, 'TC is an addressable committed Session Position in [1, LH]');
  assert.match(projection, /sealed := p_tc < lh;/u);
  assert.equal((projection.match(/OR e\.world_version <= baseline\)/gu) ?? []).length >= 8, true, 'the ONE availability law - anchored in this Session at SP <= TC, or world version <= baseline - gates every event family');
  assert.match(projection, /public\.conversation_thread_session_lifecycle_state_v1\(t\.id, p_session_id, p_tc \+ 1\)/u, 'Thread lifecycle at TC from the durable 0070 history');
  assert.match(projection, /public\.conversation_session_live_focus_before_v1\(p_session_id, p_tc \+ 1\) b/u, 'LF at TC from the durable 0071 history');
  assert.match(projection, /JOIN public\.conversation_thread_homes h ON h\.thread_id = t\.id/u, 'ONE Home per Thread, assigned at establishment');
  assert.match(projection, /'home', jsonb_build_object\('x', h\.placement_x::text, 'y', h\.placement_y::text\)/u, 'the Home crosses as exact integer text');
  assert.match(projection, /WHEN c\.target_version > v\.to_version THEN 'PREVALID'/u, 'Z66-04: a Confidence beyond the then-current version is PREVALID');
  assert.match(projection, /HISTORICAL_PROJECTION_INTEGRITY/u, 'a Thread without world availability is corruption, never absence');
  assert.doesNotMatch(projection, /INSERT INTO|UPDATE public\.|DELETE FROM|set_config/u, 'the projection writes nothing');
  assert.doesNotMatch(projection, /similar|embedding|score|rank|centrality|ILIKE|~\*/u, 'no similarity, score or rank authority inside the projection');
  assert.doesNotMatch(projection, /FROM public\.hypotheses h\s+WHERE|FROM public\.memories m\s+WHERE m\.user_id = caller\s*;/u, 'no current mutable row is a historical fallback: every family joins its own known creation event');
  assert.match(projection, /'sameSpEventSequence', clock_sequence/u);
  assert.match(projection, /'pendingExpiries', pending_expiries/u);
});

test('THE AUTHORITY POSTURE: authenticated executes exactly the projection; service_role exactly the wrappers, the synchronization entry and the Memory command; every history table unreachable; no cutover of frozen writers', () => {
  assert.match(posture, /^GRANT EXECUTE ON FUNCTION public\.get_session_historical_projection_v1\(uuid,integer\) TO authenticated;$/mu);
  assert.equal((posture.match(/GRANT EXECUTE ON FUNCTION [^;]* TO authenticated/gu) ?? []).length, 1, 'exactly ONE authenticated grant');
  assert.equal((posture.match(/GRANT EXECUTE ON FUNCTION [^;]* TO service_role/gu) ?? []).length, 5, 'exactly five service_role grants: three wrappers, the synchronization entry, the Memory command');
  assert.doesNotMatch(posture, /GRANT [^;]*TO anon|GRANT [^;]*TO PUBLIC|GRANT [^;]*ON TABLE/u);
  assert.match(posture, /ENABLE ROW LEVEL SECURITY/u);
  assert.match(posture, /REVOKE ALL ON TABLE public\.historical_world_semantic_clocks, public\.session_historical_coverage, public\.session_historical_baselines,[\s\S]{0,600}public\.thread_reading_bindings\s*\n\s*FROM PUBLIC, anon, authenticated;/u);
  assert.match(posture, /REVOKE ALL ON FUNCTION public\.historical_capture_begin_v1\(uuid,uuid,boolean\) FROM service_role/u, 'the boundary is executable by no application role');
  assert.doesNotMatch(posture, /REVOKE [^;]*(?:commit_conversation_units|commit_finalized_exchange|get_session_live_state_v1|get_live_focus_transition_events_v1|get_session_temporal_state_v1|attach_hypothesis_evidence|apply_hypothesis_evidence_update|transition_hypothesis)/u,
    'no frozen writer or read is cut over: R-C3 is enforced by capture, not by breaking live callers');
  for (const assertion of [
    'every Session carries a coverage decision',
    'every pre-existing Session is a LEGACY UNCOVERED SESSION',
    'every pre-existing canonical fact carries its legacy baseline event',
    'the migration seeds legacy baseline events only',
    'the historical event namespace drifted',
    'the Thread <-> Reading binding namespace drifted',
    'the pinned event identity vector does not reproduce',
    'must be STABLE SECURITY DEFINER',
    'a history table is reachable by an application role',
    'the authority posture is wrong',
    'the service_role posture is wrong',
    'the Reading capture hook is not the one enabled AFTER INSERT OR UPDATE trigger',
    'the Session Semantic Clock changed shape',
  ]) {
    assert.ok(migration.includes(assertion), `the migration self-asserts: ${assertion}`);
  }
  for (const vector of ['79466f6b-04fd-5150-aa23-59682098057c', '11be3a36-745a-54fd-a938-3f14eaedee14', '91dc104c-e42b-54ff-8638-6dd7776f318c']) {
    assert.ok(migration.includes(vector) && verifier.includes(vector), `the identity vector ${vector} is pinned in SQL and replayed by the verifier`);
  }
});

test('every identifier 0072 introduces fits the PostgreSQL 63-byte limit', () => {
  const identifiers = [...migration.matchAll(/\b(?:TABLE|FUNCTION|INDEX|TRIGGER|CONSTRAINT)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gu)].map((m) => m[1]);
  assert.ok(identifiers.length > 0);
  assert.deepEqual([...new Set(identifiers)].filter((name) => Buffer.byteLength(name, 'utf8') > 63), []);
});

test('the 0072 verifier proves live semantics, the fixture cleanup knows the new tables, and both are wired into the toolchain and CI', () => {
  for (const proof of ['HISTORICAL_COVERAGE_UNAVAILABLE', 'LIVE_HEAD_NOT_ESTABLISHED', 'SESSION_POSITION_NOT_ADDRESSABLE', 'HISTORICAL_BASELINE_MISSING', 'HISTORICAL_CAPTURE_ASSOCIATION_INTEGRITY',
    'HISTORICAL_EVENT_IDENTITY_CONFLICT', 'THREAD_READING_BINDING_IDENTITY_CONFLICT', 'MEMORY_WRITE_EXECUTION_NOT_ASSOCIATED', 'CANONICAL_HISTORICAL_ROW_IS_IMMUTABLE', 'CANONICAL_HISTORICAL_ROW_IS_PRESERVED',
    'CANONICAL_HISTORICAL_FIELD_IS_IMMUTABLE', 'WORLD_SEMANTIC_CLOCK_IS_MONOTONIC', 'WORLD_SEMANTIC_CLOCK_IS_PERMANENT', 'CANONICAL_THREAD_READING_BINDING_IS_IMMUTABLE',
    'LEGACY_UNCOVERED', 'PRE_FIRST_SP', 'NOT_IN_SESSION', 'PENDING', 'P66-A', 'P66-B', 'P66-C', 'P66-D', 'P66-E', 'P66-F', 'P66-G', 'P66-H', 'Z66-03', 'Z66-04', 'Z66-05', 'R-C1', 'R-C2', 'R-C3', 'R-C5',
    'has_function_privilege', 'has_table_privilege', 'pg_get_functiondef', 'exact tie', 'open head', 'sealed', 'unassociated', 'permission denied', 'AF66-01',
    'PREVALID', 'SUPERSEDED', 'CURRENT', 'VERSION_ADVANCED', 'attach_hypothesis_evidence', 'background_attach_hypothesis_evidence_v1', 'apply_hypothesis_evidence_update',
    'persist_post_response_hypothesis_generation_v1', 'sync_post_response_information_gaps_v1', 'server_create_memory_for_execution_v1', 'bind_reading_to_thread_v1', 'unbind_reading_from_thread_v1',
    'select_formal_question_opportunity_v1', 'finalize_conversation_turn_v2', 'commit_finalized_exchange_with_full_semantic_chain_v1', 'BLOCKED', 'sessionLifecycle', 'has no Session-local lifecycle here',
    'a LEGACY UNCOVERED SESSION', 'no fabricated anchor', 'one life per SP', 'identical to its earlier projection', 'evolved with the associated write while LH did not move',
    // R1-01: the deployment-spanning P66-C proof and the ungated runtime.
    'B0. R-C1 / P66-C across the deployment boundary', 'CREATE DATABASE', 'DROP DATABASE IF EXISTS', 'before 0072 no coverage decision exists anywhere', 'await q(migrationSql)',
    'the deployment decides the pre-existing Session LEGACY_UNCOVERED', 'post-deploy exchange 1 committed SP6 and SP7', 'post-deploy exchange 3 committed SP10 and SP11',
    'get_session_live_state_v1', 'get_session_temporal_state_v1', 'coverage stays LEGACY_UNCOVERED through every post-deploy commit and capture', 'no baseline was fabricated by the post-deploy Moments',
    'keeps committing Session Positions through the frozen runtime authority', 'the committed-CU coverage gate does not exist', 'REV66-06 section 4.5',
    // R1-03: the smoke teardown replayed from its source.
    'cleanupRows', 'verify-supabase-auth.mjs', "session_replication_role = 'replica'"]) {
    assert.ok(verifier.includes(proof), `verifier is missing ${proof}`);
  }
  assert.doesNotMatch(verifier, /P66-C \(a later Session inherits/u, 'later-Session baseline inheritance is not called P66-C (R1-04)');
  assert.ok(verifier.indexOf('await verifyDeploymentSpan();') < verifier.indexOf("await q('BEGIN');", verifier.indexOf('async function main()')), 'the deployment-spanning proof runs outside the main transaction (CREATE DATABASE cannot run inside one)');
  for (const table of ['thread_reading_bindings', 'historical_reading_events', 'session_historical_baselines', 'session_historical_coverage', 'historical_world_semantic_clocks']) {
    assert.ok(cleanup.includes(`'${table}'`), `the fixture cleanup removes ${table}`);
  }
  assert.match(packageJson, /"verify:historical-projection:integration": "node --env-file-if-exists=\.env database\/verify-migration-0072\.mjs"/u);
  assert.match(workflow, /run: npm run verify:historical-projection:integration/u);
  assert.ok(workflow.indexOf('run: npm run verify:historical-projection:integration') > workflow.indexOf('run: npm run verify:effective-live-focus-final-semantic-chain-cutover:integration'), 'the 0072 verifier runs after the 0071 verifier');
});
