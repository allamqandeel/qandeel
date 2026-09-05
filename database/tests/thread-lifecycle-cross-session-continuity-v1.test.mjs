import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// T-03B3 - Thread Lifecycle + Cross-Session Continuity v1: the static database
// contract. Live semantics are proven against real PostgreSQL by
// database/verify-migration-0070.mjs. Migration 0070 is the FINAL Thread-layer
// substrate: Session-local lifecycle over user/world-global Thread identity,
// exhaustive deterministic dossier paging, one Thread-layer seq2, and a
// production-inert posture that grants nothing and revokes nothing.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const migration = read('../migrations/0070_thread_lifecycle_cross_session_continuity_v1.sql');
const verifier = read('../verify-migration-0070.mjs');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const stripSql = (text) => text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const executableSql = stripSql(migration);
const SELF_ASSERTION_MARKER = '-- 22. Terminal self-assertions';
const executableBody = stripSql(migration.slice(0, migration.indexOf(SELF_ASSERTION_MARKER)));
const migrationLevelSql = executableBody.split(/\$\$[\s\S]*?\$\$/gu).join('\n');
const section = (from, to) => {
  const start = migration.indexOf(from);
  const end = to === undefined ? migration.length : migration.indexOf(to, start);
  assert.ok(start >= 0 && (to === undefined || end > start), `section ${from} was located`);
  return stripSql(migration.slice(start, end));
};
const reducer = section('CREATE FUNCTION public.derive_conversation_thread_lifecycle_transitions_v1', '-- 11. The canonical ESTABLISHMENT identity evidence');
const validator = section('CREATE FUNCTION public.validate_conversation_thread_lifecycle_decision_v1', '-- 13. Persisting the Thread-layer rows');
const batchState = section('CREATE FUNCTION public.conversation_thread_semantic_batch_state_v1', '-- 15. The integrated per-Moment writer');
const writer = section('CREATE FUNCTION public.commit_conversation_units_with_focus_thread_lifecycle_v1', '-- 16. The atomic finalized-exchange coordinator');
const coordinator = section('CREATE FUNCTION public.commit_finalized_exchange_with_focus_thread_lifecycle_v1', '-- 17. Exhaustive, deterministic Thread identity dossier paging');
const dossier = section('CREATE FUNCTION public.get_conversation_thread_identity_dossier_page_v1', '-- 18. The B3 runtime context');
const context = section('CREATE FUNCTION public.get_conversation_thread_lifecycle_runtime_context_v1', '-- 19. The integrated batch snapshot');
const audit = section('CREATE FUNCTION public.assert_conversation_thread_lifecycle_cutover_ready_v1', '-- 21. Ownership, search_path hardening');

function gitBlobId(content) {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

test('0070 is the newest migration, and 0064 - 0069 are byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), '0070_thread_lifecycle_cross_session_continuity_v1.sql');
  assert.equal(migrations.filter((name) => name.startsWith('0070_')).length, 1, 'exactly one 0070 migration exists');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  for (const [name, blob] of [
    ['0064_committed_conversational_unit_substrate_v1.sql', '0a2ee63980e59072b3e9f52a643efa8220e95b08'],
    ['0065_session_semantic_clock_sp_lh_delivery_v1.sql', '3dc061c71bcb237cec648abb2d1fa02f450cd57f'],
    ['0066_durable_reference_emerging_focus_sp_substrate_v1.sql', '9f0588d5ca46329a8721ee30302f49d227a357ae'],
    ['0067_conversation_focus_runtime_integration_readiness_v1.sql', 'd12a3f552e80709ee1d20887f55f1c84e84f9208'],
    ['0068_durable_thread_home_same_sp_substrate_v1.sql', '5ea270424059acd40c0a6bf7dc040efc3aa693d3'],
    ['0069_thread_runtime_integration_readiness_v1.sql', 'fc2531a5a880f440b7086a3a63ba6557527413a7'],
  ]) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.equal(gitBlobId(read('../verify-migration-0068.mjs')), 'f20eeff7a9b13756867448c22f222f1a93cd847f', 'the 0068 verifier is byte-identical');
  assert.equal(gitBlobId(read('../verify-migration-0069.mjs')), '306948f90adeeba1eb9a9ace64078ee727f03586', 'the 0069 verifier is byte-identical');
  assert.match(migration, /current_setting\('server_encoding'\) <> 'UTF8'/u);
  for (const precondition of ['public.conversation_thread_batch_state_v1(uuid,uuid,uuid,uuid)', 'public.validate_conversation_thread_decision_v1(public.conversation_units,jsonb)',
    'public.persist_conversation_thread_establishment_v1(', 'public.compute_canonical_home_placement_v1(', 'public.get_conversation_focus_thread_runtime_context_v1(uuid,uuid)',
    'public.get_conversation_focus_thread_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)']) {
    assert.ok(migration.includes(precondition), `0070 requires ${precondition}`);
  }
});

test('0070 adds exactly the six B3 tables, and no global lifecycle / Session-order / timestamp authority', () => {
  assert.deepEqual([...migration.matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]).sort(), [
    'conversation_thread_focus_bindings',
    'conversation_thread_identity_evidence',
    'conversation_thread_lifecycle_events',
    'conversation_thread_semantic_commit_batches',
    'conversation_thread_semantic_unit_results',
    'conversation_world_thread_identity_clocks',
  ]);
  assert.doesNotMatch(executableSql, /CREATE OR REPLACE|DROP |ALTER TABLE public\.conversation_threads\b|ALTER TABLE public\.conversation_thread_homes\b|CREATE EXTENSION|CREATE SEQUENCE|CREATE TYPE|CREATE POLICY/u);
  assert.doesNotMatch(executableSql, /ALTER TABLE public\.conversation_threads ADD|ADD COLUMN/u, 'no lifecycle column is added to conversation_threads');
  for (const forbidden of ['current_global_lifecycle_state', 'global_thread_sp', 'global_session_order', 'cross_session_last_sp', 'last_active_at', 'dormant_since', 'reopened_at',
    'merge_target', 'merged_into', 'thread_merge', 'live_focus', 'LIVE_FOCUS', 'pre_first_sp', 'PRE_FIRST_SP', 'historical_enabled', 'knowledge_frontier', 'timeline_position']) {
    assert.equal(executableBody.includes(forbidden), false, `0070 must not introduce ${forbidden}`);
  }
  // Timestamps are audit defaults only: never ordered by, never compared, never a lifecycle input.
  assert.doesNotMatch(executableBody.replace('NEW.created_at <> OLD.created_at', ''), /ORDER BY [^;]*created_at|created_at\s*[<>=]|now\(\)|clock_timestamp/u);
  const timestamps = executableBody.match(/timestamptz|CURRENT_TIMESTAMP/gu) ?? [];
  const auditDefaults = executableBody.match(/created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP/gu) ?? [];
  assert.equal(timestamps.length, auditDefaults.length * 2, 'every timestamp token is an audit default');
  assert.equal(auditDefaults.length, 6, 'each of the six new tables carries exactly one audit default');
  assert.match(executableBody, /NEW\.created_at <> OLD\.created_at/u, 'the identity-clock guard forbids rewriting even the audit timestamp');
  // Session-local lifecycle: every lifecycle row is keyed on a Session; there is no cross-Session or global state column.
  assert.match(migration, /CREATE TABLE public\.conversation_thread_lifecycle_events \([\s\S]*?session_id uuid NOT NULL[\s\S]*?\);/u);
  assert.doesNotMatch(migration.slice(migration.indexOf('CREATE TABLE public.conversation_thread_lifecycle_events'), migration.indexOf('CREATE INDEX thread_lifecycle_events_thread_session_idx')), /timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  CONSTRAINT[^]*?ORDER/u);
  assert.match(migration, /CONSTRAINT thread_lifecycle_events_transition_check CHECK \(\s*\(from_state = 'ACTIVE' AND to_state = 'DORMANT'\)\s*OR \(from_state = 'REOPENED' AND to_state = 'DORMANT'\)\s*OR \(from_state = 'DORMANT' AND to_state = 'REOPENED'\)\s*OR \(from_state = 'REOPENED' AND to_state = 'ACTIVE'\)\)/u,
    'exactly the four v1 transitions are representable; DORMANT -> ACTIVE, ACTIVE -> REOPENED and self-transitions are not');
  assert.match(migration, /CONSTRAINT thread_focus_bindings_one_per_session UNIQUE \(thread_id, session_id\)/u);
  assert.match(migration, /emerging_focus_id uuid PRIMARY KEY,\s*\n\s*binding_id uuid NOT NULL UNIQUE/u, 'one Session Emerging Focus binds to at most one Thread forever');
  assert.match(migration, /CONSTRAINT thread_identity_evidence_reference_unique UNIQUE \(session_id, cu_id, reference_index\)/u, 'the same evidence never belongs to two Threads');
  assert.match(migration, /CONSTRAINT thread_lifecycle_events_one_per_cu UNIQUE \(session_id, cu_id, thread_id\)/u);
  assert.match(migration, /thread_layer_event_sequence IS NULL OR thread_layer_event_sequence = 2/u, 'the whole Thread layer is seq2 or nothing');
  assert.match(migration, /bound_sp >= 1 AND same_sp_event_sequence = 2/u);
  assert.match(migration, /session_position >= 1 AND same_sp_event_sequence = 2 AND transition_ordinal >= 0/u);
  // Append-only everywhere; the identity clock advances by exactly one.
  for (const table of ['conversation_thread_focus_bindings', 'conversation_thread_identity_evidence', 'conversation_thread_lifecycle_events',
    'conversation_thread_semantic_commit_batches', 'conversation_thread_semantic_unit_results']) {
    assert.match(migration, new RegExp(`BEFORE UPDATE OR DELETE ON public\\.${table}\\s*\\n\\s*FOR EACH ROW EXECUTE FUNCTION public\\.reject_conversation_thread_lifecycle_mutation_v1\\(\\)`, 'u'));
  }
  assert.match(migration, /NEW\.current_version <> OLD\.current_version \+ 1/u);
  assert.doesNotMatch(executableBody, /UPDATE public\.conversation_thread_focus_bindings|UPDATE public\.conversation_threads|UPDATE public\.conversation_thread_homes|DELETE FROM/u,
    'no rebind, no Home relocation and no delete path exists');
  assert.deepEqual([...migrationLevelSql.matchAll(/INSERT INTO public\.(\w+)/gu)], [], 'no migration-level backfill');
});

test('lifecycle is deterministic and DB-re-derived: no timer, no model, no similarity, no backdating', () => {
  for (const rule of ["'GENUINE_RETURN'", "'CONTINUED_ANCHORING'", "'EXPLICIT_FOCUS_SHIFT'", "'SUSTAINED_DEPARTURE'",
    'rel.explicit_shift', 'rel.attention_on OR rel.targets_thread', 'prev_rel.away AND NOT prev_rel.targets_thread',
    'u.session_position = p_cu.session_position - 1', "ORDER BY b.thread_id::text COLLATE \"C\""]) {
    assert.ok(reducer.includes(rule), `the SQL reducer carries: ${rule}`);
  }
  assert.doesNotMatch(reducer, /created_at|CURRENT_TIMESTAMP|interval|EXTRACT\(|age\(|similar|embedding|score|confidence|importance|reading|hypothes/iu,
    'the reducer reads no timestamp, duration, similarity, importance or analytical input');
  assert.match(validator, /derived := public\.derive_conversation_thread_lifecycle_transitions_v1\(p_cu\);/u);
  assert.match(validator, /THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL/u, 'a payload may neither add nor omit a transition');
  assert.match(validator, /from_state is never caller-authored/u);
  assert.match(migration, /from_state := public\.conversation_thread_session_lifecycle_state_v1\(\(entry ->> 'thread_id'\)::uuid, p_cu\.session_id, p_cu\.session_position\);/u,
    'the database derives from_state itself');
  assert.match(migration, /'ATTEND_EXISTING', 'ACTIVATE_EXISTING_IN_SESSION', 'REOPEN_EXISTING', 'IDENTITY_AMBIGUOUS'/u);
  assert.match(validator, /THREAD_FOCUS_ALREADY_BOUND/u, 'no rebind and no duplicate geography');
  assert.match(validator, /THREAD_ALREADY_BOUND_IN_SESSION/u);
  assert.match(validator, /THREAD_ESTABLISHMENT_CONTINUITY_MISMATCH/u, 'a BIND or AMBIGUOUS continuity outcome forbids a new Thread');
  assert.match(validator, /THREAD_CONTINUITY_EVIDENCE_REQUIRED/u);
  assert.match(validator, /THREAD_CONTINUITY_PRIOR_EVIDENCE_UNKNOWN/u, 'prior evidence refers only to the supplied dossier');
  assert.match(validator, /r\.state = 'RESOLVED' AND r\.resolved_handle_id = grounding_handle/u, 'current evidence closes to the bound focus grounding');
  assert.match(validator, /INVALID_THREAD_IDENTITY_AMBIGUITY/u);
  assert.match(validator, /COLLATE "C"/u, 'candidate order is canonical, never a preference');
  assert.doesNotMatch(validator, /similar|ILIKE|~\*|levenshtein|embedding|score|confidence/iu, 'no name, similarity or score authority anywhere in the validator');
});

test('the writer keeps B1 at seq1, reserves at most one Thread-layer seq2 shared by every row, under AF66-01', () => {
  const clock = writer.indexOf('FROM public.session_semantic_clocks c');
  const turn = writer.indexOf('FROM public.conversation_turns t');
  const focusPersist = writer.indexOf('persist_conversation_unit_focus_semantics_v1(');
  const identityClock = writer.indexOf('FROM public.conversation_world_thread_identity_clocks w');
  const world = writer.indexOf('FROM public.conversation_world_spatial_authorities w');
  const threadPersist = writer.indexOf('persist_conversation_thread_establishment_v1(');
  const lifecyclePersist = writer.indexOf('persist_conversation_thread_lifecycle_layer_v1(inserted_cu, p_batch_id, lifecycle, reserved_sequence)');
  assert.ok(clock > 0 && turn > clock && focusPersist > turn && identityClock > focusPersist && world > identityClock && threadPersist > world && lifecyclePersist > threadPersist,
    'Session clock -> source turn -> B1 rows -> user/world Thread Identity Clock -> spatial authority -> Thread / Home / binding / lifecycle rows');
  assert.equal((writer.match(/FOR UPDATE/gu) ?? []).length, 4, 'exactly four row locks: Session clock, source turn, identity clock, spatial authority');
  assert.equal((writer.match(/reserve_session_same_sp_event_v1/gu) ?? []).length, 2, 'the ONE T-03A2 seam: sequence 1 for B1, sequence 2 ONCE for the whole Thread layer');
  assert.match(writer, /reserved_sequence IS DISTINCT FROM 1::bigint/u);
  assert.match(writer, /reserved_sequence IS DISTINCT FROM 2::bigint/u);
  assert.doesNotMatch(writer, /same_sp_event_sequence \+ 1|CREATE SEQUENCE|nextval\(/u);
  assert.match(writer, /has_change := outcome IN \('ESTABLISH_NEW', 'ACTIVATE_EXISTING_IN_SESSION'\)\s*\n\s*OR jsonb_array_length\(lifecycle -> 'lifecycle_transitions'\) > 0;/u);
  assert.match(writer, /IF has_change THEN/u);
  assert.match(writer, /persist_conversation_thread_lifecycle_layer_v1\(inserted_cu, p_batch_id, lifecycle, NULL\)/u, 'no change reserves nothing');
  // The frozen 0068 gates and helpers are CALLED, never re-implemented.
  for (const reused of ['validate_conversation_thread_decision_v1(inserted_cu, decision)', 'persist_conversation_thread_establishment_v1(',
    'compute_canonical_home_placement_v1(', 'canonical_thread_identities_v1(turn_row.user_id', 'persist_conversation_unit_focus_semantics_v1(']) {
    assert.ok(writer.includes(reused), `the writer reuses ${reused}`);
  }
  assert.doesNotMatch(migration, /CREATE FUNCTION public\.(?:osdap_|compute_canonical_home_placement|validate_conversation_thread_decision|persist_conversation_thread_establishment|canonical_thread_identities)/u,
    'no second placement engine, identity authority or B2 validator');
  // Replay is all-or-nothing through the ONE B3 authority, and identity is payload-exact.
  assert.match(writer, /batch_state := public\.conversation_thread_semantic_batch_state_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\);/u);
  assert.match(writer, /IF batch_state = 'ABSENT' THEN/u);
  assert.match(writer, /IF batch_state <> 'COMPLETE' THEN[\s\S]{0,400}THREAD_SEMANTIC_BATCH_INTEGRITY/u);
  assert.match(writer, /PERFORM \* FROM public\.commit_conversation_units_with_focus_and_thread_v1\(/u, 'replay delegates the CU / B1 / B2 layers to the frozen 0068 writer');
  assert.match(writer, /THREAD_SEMANTIC_BATCH_PAYLOAD_CONFLICT/u);
  // The signature accepts no caller-authored SP, sequence, placement or from_state.
  const signature = writer.slice(0, writer.indexOf(') RETURNS SETOF'));
  assert.doesNotMatch(signature, /placement|coordinate|fingerprint|attempt|_x |_y |scheme|from_state|p_same_sp_event_sequence\b|p_session_position\b|p_sp\b|p_live_head/u);
});

test('the coordinator classifies both halves, checks the Session token FIRST and the identity version SECOND, before any writer', () => {
  const relation = coordinator.indexOf('INVALID_FINALIZED_EXCHANGE_RELATION');
  const gate = coordinator.indexOf('user_state := public.conversation_thread_semantic_batch_state_v1');
  const sessionStale = coordinator.indexOf("RAISE EXCEPTION 'STALE_CONVERSATIONAL_FOCUS_CONTEXT'");
  const identityLock = coordinator.indexOf('FROM public.conversation_world_thread_identity_clocks w');
  const identityStale = coordinator.indexOf("RAISE EXCEPTION 'STALE_THREAD_IDENTITY_CONTEXT'");
  const write = coordinator.indexOf('public.commit_conversation_units_with_focus_thread_lifecycle_v1(');
  assert.ok(relation < gate && gate < sessionStale && sessionStale < identityLock && identityLock < identityStale && identityStale < write,
    'relation gate -> half-state gate -> Session token -> identity clock lock -> identity version -> BOTH writer calls');
  assert.ok(coordinator.indexOf('FROM public.session_semantic_clocks c') < identityLock, 'never identity clock before Session Semantic Clock');
  assert.match(coordinator, /IF NOT \(\(user_state = 'ABSENT' AND assistant_state = 'ABSENT'\)[\s\S]{0,200}THREAD_SEMANTIC_BATCH_INTEGRITY/u);
  assert.match(coordinator, /USING ERRCODE='40001'/u);
  assert.equal((coordinator.match(/USING ERRCODE='40001'/gu) ?? []).length, 2, 'exactly two exact typed stale conditions');
  assert.match(coordinator, /p_expected_world_thread_identity_version bigint/u);
  assert.match(coordinator, /world_thread_identity_version bigint,/u, 'the technical version is returned, never a Product time');
});

test('the B3 completeness authority reuses 0068, and IDENTITY_AMBIGUOUS is a truthful COMPLETE outcome', () => {
  assert.match(batchState, /base_state := public\.conversation_thread_batch_state_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\);/u);
  assert.match(batchState, /RETURNS text\s*\nLANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''/u);
  for (const rule of ['result_count <> commit_row.unit_count', 'continuity_count <> semantic_row.continuity_binding_count', 'lifecycle_count <> semantic_row.lifecycle_transition_count',
    'has_change <> (result_row.thread_layer_event_sequence = 2)', "result_row.outcome IN ('NO_THREAD_ACTION', 'IDENTITY_AMBIGUOUS')",
    'binding.binding_id <> public.canonical_thread_focus_binding_id_v1', 'expected_from IS DISTINCT FROM event_row.from_state',
    'event_row.event_id <> public.canonical_thread_lifecycle_event_id_v1', 'r.resolved_handle_id IS DISTINCT FROM grounding_handle']) {
    assert.ok(batchState.includes(rule), `structural completeness requires: ${rule}`);
  }
  assert.doesNotMatch(batchState, /INSERT INTO|UPDATE public|DELETE FROM|created_at/u);
  assert.match(writer, /batch_state := public\.conversation_thread_semantic_batch_state_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\);/u);
  assert.match(coordinator, /user_state := public\.conversation_thread_semantic_batch_state_v1\(p_session_id, p_user_id, p_user_source_turn_id, p_user_batch_id\);/u);
  assert.match(coordinator, /assistant_state := public\.conversation_thread_semantic_batch_state_v1\(p_session_id, p_user_id, p_assistant_source_turn_id, p_assistant_batch_id\);/u);
  assert.match(migration, /thread_semantic_capture_state := public\.conversation_thread_semantic_batch_state_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\);/u,
    'the ONE authority serves the writer, both coordinator halves and the snapshot');
});

test('dossier paging is exhaustive, deterministic, version-exact and geography-free; the context and audit fail closed', () => {
  assert.match(dossier, /ORDER BY t\.id::text COLLATE "C"\s*\n\s*LIMIT p_limit;/u);
  assert.match(dossier, /t\.id::text COLLATE "C" > p_after_thread_id::text COLLATE "C"/u);
  assert.match(dossier, /p_limit < 1 OR p_limit > 64/u);
  assert.match(dossier, /RAISE EXCEPTION 'STALE_THREAD_IDENTITY_CONTEXT' USING ERRCODE='40001'/u);
  assert.match(dossier, /THREAD_WITHOUT_IDENTITY_DOSSIER/u, 'a Thread without a dossier is never silently ignored');
  for (const key of ["'session_id'", "'cu_id'", "'exact_surface'", "'committed_cu_text'", "'source_role'"]) assert.ok(dossier.includes(key), `a dossier item carries ${key}`);
  assert.doesNotMatch(dossier, /placement|home_anchor|thread_homes|lifecycle|importance|confidence|relation|created_at|similar/u);
  assert.match(context, /FROM public\.get_conversation_focus_thread_runtime_context_v1\(p_session_id, p_user_id\) c;/u, 'the 0069 context is preserved by delegation');
  assert.match(context, /PRIOR_BATCH_NOT_B3_COMPLETE/u);
  assert.match(context, /THREAD_WITHOUT_IDENTITY_DOSSIER/u);
  assert.doesNotMatch(context, /placement_x|placement_y|home_anchor_id|address_scheme|world_fingerprint|created_at|ORDER BY [^;]*cross|global/u);
  for (const key of ["'binding_id'", "'thread_id'", "'emerging_focus_id'", "'bound_cu_id'", "'bound_sp'", "'binding_kind'", "'event_id'", "'transition_ordinal'", "'from_state'", "'to_state'", "'reason_code'"]) {
    assert.ok(context.includes(key), `the context carries ${key}`);
  }
  assert.match(audit, /RETURNS void\s*\nLANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''/u);
  assert.equal((audit.match(/RAISE EXCEPTION 'THREAD_LIFECYCLE_CUTOVER_NOT_READY' USING ERRCODE='55000'/gu) ?? []).length, 4, 'one stable technical error, four detail kinds');
  for (const detail of ['COMMIT_BATCH_NOT_THREAD_LIFECYCLE_COMPLETE', 'THREAD_WITHOUT_ESTABLISHMENT_BINDING', 'THREAD_WITHOUT_IDENTITY_DOSSIER', 'INVALID_LIFECYCLE_CHAIN']) {
    assert.ok(audit.includes(detail), `the audit names ${detail}`);
  }
  assert.doesNotMatch(audit, /INSERT|UPDATE|DELETE|created_at|historical|PRE_FIRST_SP|thread_enabled|analysis_enabled|semantic_version|historical_ready|lifecycle_ready/u);
});

test('0070 grants nothing, revokes no T-03A2 authority, and self-asserts the unchanged posture', () => {
  assert.doesNotMatch(executableSql, /GRANT /u, 'no GRANT of any kind');
  for (const fn of ['commit_conversation_units_with_focus_thread_lifecycle_v1', 'commit_finalized_exchange_with_focus_thread_lifecycle_v1',
    'get_conversation_thread_identity_dossier_page_v1', 'get_conversation_thread_lifecycle_runtime_context_v1',
    'get_conversation_thread_lifecycle_integrated_batch_snapshot_v1', 'assert_conversation_thread_lifecycle_cutover_ready_v1',
    'validate_conversation_thread_lifecycle_decision_v1', 'persist_conversation_thread_lifecycle_layer_v1', 'conversation_thread_semantic_batch_state_v1']) {
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\)\\s*\\n?\\s*FROM PUBLIC, anon, authenticated`, 'u'), `${fn} is revoked from PUBLIC / anon / authenticated`);
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM service_role`, 'u'), `${fn} is revoked from service_role`);
  }
  assert.doesNotMatch(executableSql, /REVOKE [^;]*(?:commit_conversation_units_v1|commit_finalized_exchange_conversation_units_v1|get_conversation_unit_commit_batch_snapshot_v1)\(/u,
    'no legacy T-03A2 writer or read is revoked');
  for (const assertion of [
    'T-03B3 performs no cutover: % must not execute %',
    'T-03B3 must leave the live T-03A2 service_role grants exactly in place',
    'T-03B3 creates a forward-only substrate and backfills nothing',
    'T-03B3 introduces no global lifecycle / Session-order / timestamp / LF / score / label / merge column',
    'T-03B3 adds no lifecycle column to conversation_threads: lifecycle is Session-local history',
    'T-03B3 reads, derivations and the audit must be STABLE, never writers',
    'T-03B3 must reuse the 0068 completeness authority and the 0069 reads, never duplicate them',
    'T-03B3 requires the exact RFC 4122 version-5 derivation of its frozen namespaces',
    'T-03B3 requires the frozen focus-binding and lifecycle-event identity vectors',
    'T-03B3 must not alter the Session Semantic Clock',
  ]) {
    assert.ok(migration.includes(assertion), `the migration self-asserts: ${assertion}`);
  }
  for (const vector of ['194bb7c5-906f-5228-8116-b4c99b34bd76', '9fbd9e6c-f8a4-529b-bd97-46f75cb068d3', '81db0320-39e5-5053-adc5-6d9c993f5ec7', '3150f4a8-1f76-5ed4-9936-53dc2d72ee78', '45873543-9eb6-5679-ae70-befb05f4ee86']) {
    assert.ok(migration.includes(vector) && verifier.includes(vector), `the identity vector ${vector} is pinned in SQL and replayed by the verifier`);
  }
  assert.match(migration, /https:\/\/qandeel\.app\/runtime\/thread-focus-binding\/v1/u);
  assert.match(migration, /https:\/\/qandeel\.app\/runtime\/thread-lifecycle-event\/v1/u);
});

test('every identifier 0070 introduces fits the PostgreSQL 63-byte limit', () => {
  const identifiers = [...migration.matchAll(/\b(?:TABLE|FUNCTION|INDEX|TRIGGER|CONSTRAINT)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gu)].map((m) => m[1]);
  assert.ok(identifiers.length > 0);
  assert.deepEqual([...new Set(identifiers)].filter((name) => Buffer.byteLength(name, 'utf8') > 63), []);
});

test('the 0070 verifier proves live semantics and is wired into the toolchain and CI', () => {
  for (const proof of ['THREAD_LIFECYCLE_CUTOVER_NOT_READY', 'COMMIT_BATCH_NOT_THREAD_LIFECYCLE_COMPLETE', 'THREAD_WITHOUT_IDENTITY_DOSSIER', 'INCOMPLETE_PRIOR_THREAD_HISTORY',
    'STALE_THREAD_IDENTITY_CONTEXT', 'STALE_CONVERSATIONAL_FOCUS_CONTEXT', 'THREAD_FOCUS_ALREADY_BOUND', 'THREAD_ALREADY_BOUND_IN_SESSION', 'THREAD_ESTABLISHMENT_CONTINUITY_MISMATCH',
    'THREAD_CONTINUITY_EVIDENCE_REQUIRED', 'THREAD_CONTINUITY_PRIOR_EVIDENCE_UNKNOWN', 'THREAD_CONTINUITY_EVIDENCE_NOT_GROUNDED', 'THREAD_IDENTITY_EVIDENCE_NOT_CANONICAL',
    'INVALID_THREAD_IDENTITY_AMBIGUITY', 'UNKNOWN_THREAD_IDENTITY_CANDIDATE', 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL', 'THREAD_LIFECYCLE_OUTCOME_MISMATCH',
    'THREAD_SEMANTIC_BATCH_INTEGRITY', 'THREAD_SEMANTIC_BATCH_PAYLOAD_CONFLICT', 'CANONICAL_THREAD_LIFECYCLE_ROW_IS_IMMUTABLE', 'WORLD_THREAD_IDENTITY_CLOCK_IS_MONOTONIC',
    'has_function_privilege', 'has_table_privilege', 'pg_get_functiondef', "same_sp_event_sequence: '1'",
    'SUSTAINED_DEPARTURE', 'EXPLICIT_FOCUS_SHIFT', 'GENUINE_RETURN', 'CONTINUED_ANCHORING', 'never SP6', 'the same permanent Home is reused',
    'same-name', 'Relationship with Ahmed', 'a legacy T-03A2-only batch', 'a B1-only batch', 'B2-only', 'a deleted focus binding', 'a rebound focus',
    'a deleted identity evidence row', 'a lifecycle row with an impossible from_state', 'an ambiguous outcome beside a permanent Thread mutation', 'a deleted permanent Home',
    'every row rolled back', 'mutates zero rows and zero clock coordinates', 'no repair, no backfill', 'permission denied', 'commit_conversation_units_v1(', 'seq3']) {
    assert.ok(verifier.includes(proof), `verifier is missing ${proof}`);
  }
  assert.match(packageJson, /"verify:thread-lifecycle-cross-session-continuity:integration": "node --env-file-if-exists=\.env database\/verify-migration-0070\.mjs"/u);
  assert.match(workflow, /run: npm run verify:thread-lifecycle-cross-session-continuity:integration/u);
  assert.ok(workflow.indexOf('run: npm run verify:thread-lifecycle-cross-session-continuity:integration')
    > workflow.indexOf('run: npm run verify:thread-runtime-integration-readiness:integration'), 'the 0070 verifier runs after the 0069 verifier');
});
