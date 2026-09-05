import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// T-03D - Effective Live Focus + FINAL Same-SP Semantic Chain + Production
// Authority Cutover v1: the static database contract. Live semantics are
// proven against real PostgreSQL by database/verify-migration-0071.mjs.
// Migration 0071 is the ONE authorized activation act: it adds the LF layer
// at the same SP, makes the FINAL coordinator the ONE application mutation
// authority, retires the temporary T-03A2 writer grants, and opens exactly
// the owner-scoped LF delivery reads.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const migration = read('../migrations/0071_effective_live_focus_final_semantic_chain_cutover_v1.sql');
const verifier = read('../verify-migration-0071.mjs');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const stripSql = (text) => text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const executableSql = stripSql(migration);
const SELF_ASSERTION_MARKER = '-- 15. Terminal self-assertions';
const executableBody = stripSql(migration.slice(0, migration.indexOf(SELF_ASSERTION_MARKER)));
const migrationLevelSql = executableBody.split(/\$\$[\s\S]*?\$\$/gu).join('\n');
const section = (from, to) => {
  const start = migration.indexOf(from);
  const end = to === undefined ? migration.length : migration.indexOf(to, start);
  assert.ok(start >= 0 && (to === undefined || end > start), `section ${from} was located`);
  return stripSql(migration.slice(start, end));
};
const tables = section('-- 1. Durable LF transition history', '-- 3. Append-only enforcement');
const reducer = section('CREATE FUNCTION public.derive_conversation_effective_live_focus_v1', '-- 7. Validating ONE canonical LF decision');
const validator = section('CREATE FUNCTION public.validate_conversation_live_focus_decision_v1', 'CREATE FUNCTION public.persist_conversation_live_focus_transition_v1');
const persist = section('CREATE FUNCTION public.persist_conversation_live_focus_transition_v1', '-- 8. The ONE structural full-chain completeness authority');
const batchState = section('CREATE FUNCTION public.conversation_full_semantic_batch_state_v1', '-- 9. The FINAL integrated per-Moment writer');
const writer = section('CREATE FUNCTION public.commit_conversation_units_with_full_semantic_chain_v1', '-- 10. The FINAL atomic finalized-exchange coordinator');
const coordinator = section('CREATE FUNCTION public.commit_finalized_exchange_with_full_semantic_chain_v1', '-- 11. The FINAL runtime reads');
const reads = section('CREATE FUNCTION public.get_conversation_full_semantic_integrated_batch_snapshot_v1', '-- 12. The authenticated LF read surface');
const delivery = section('CREATE FUNCTION public.get_session_live_state_v1', '-- 13. The full-semantic-chain cutover-readiness audit');
const audit = section('CREATE FUNCTION public.assert_conversation_full_semantic_chain_cutover_ready_v1', '-- 14. Ownership, search_path hardening and THE CUTOVER');
const cutover = section('-- 14. Ownership, search_path hardening and THE CUTOVER', SELF_ASSERTION_MARKER);

function gitBlobId(content) {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

test('0071 is the newest migration, and 0064 - 0070 are byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), '0071_effective_live_focus_final_semantic_chain_cutover_v1.sql');
  assert.equal(migrations.filter((name) => name.startsWith('0071_')).length, 1, 'exactly one 0071 migration exists');
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
  for (const precondition of ['public.reserve_session_same_sp_event_v1(uuid,uuid)', 'public.persist_conversation_unit_focus_semantics_v1(public.conversation_units,uuid,jsonb,bigint)',
    'public.validate_conversation_thread_decision_v1(public.conversation_units,jsonb)', 'public.persist_conversation_thread_establishment_v1(', 'public.compute_canonical_home_placement_v1(',
    'public.canonical_uuid_v5_v1(uuid,text)', 'public.validate_conversation_thread_lifecycle_decision_v1(public.conversation_units,jsonb,jsonb)',
    'public.persist_conversation_thread_lifecycle_layer_v1(public.conversation_units,uuid,jsonb,bigint)', 'public.conversation_thread_semantic_batch_state_v1(uuid,uuid,uuid,uuid)',
    'public.commit_conversation_units_with_focus_thread_lifecycle_v1(', 'public.get_conversation_thread_lifecycle_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)',
    'public.get_conversation_thread_lifecycle_runtime_context_v1(uuid,uuid)', 'public.get_conversation_thread_identity_dossier_page_v1(uuid,bigint,uuid,integer)',
    'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)', 'public.commit_finalized_exchange_conversation_units_v1(']) {
    assert.ok(migration.includes(precondition), `0071 requires ${precondition}`);
  }
});

test('0071 adds exactly the two LF tables: reference identity at (SP, sequence), no label / Home / content / score / projection, append-only', () => {
  assert.deepEqual([...migration.matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]).sort(), ['conversation_live_focus_commit_batches', 'conversation_live_focus_transitions']);
  assert.doesNotMatch(executableSql, /CREATE OR REPLACE|DROP |CREATE EXTENSION|CREATE SEQUENCE|CREATE TYPE|CREATE POLICY|ADD COLUMN/u);
  assert.doesNotMatch(executableBody, /ALTER TABLE public\.(?:conversation_units|conversation_threads|conversation_thread_homes|conversation_emerging_focuses|session_semantic_clocks|conversation_unit_commit_batches|conversation_thread_focus_bindings)\b/u,
    '0071 alters no frozen table');
  for (const forbidden of ['label', 'name text', 'title', 'home_anchor', 'placement_x', 'coordinate', 'direction', 'content text', 'score', 'confidence', 'importance', 'rank', 'weight', 'centrality',
    'priority', 'viewport', 'camera', 'inspection', 'timeline', 'projection', 'knowledge_frontier', 'version_frontier', 'pre_first_sp', 'historical', 'reading', 'analysis']) {
    assert.equal(tables.includes(forbidden), false, `the LF tables must not carry ${forbidden}`);
  }
  assert.match(migration, /from_kind IN \('NONE', 'EMERGING', 'THREAD'\) AND to_kind IN \('NONE', 'EMERGING', 'THREAD'\)/u, 'exactly the closed LF domain');
  assert.match(migration, /\(\(from_kind = 'NONE'\) = \(from_ref IS NULL\)\) AND \(\(to_kind = 'NONE'\) = \(to_ref IS NULL\)\)/u, 'NONE carries no reference; EMERGING / THREAD always do');
  assert.match(migration, /CONSTRAINT live_focus_transitions_change_check CHECK \(\s*from_kind <> to_kind OR from_ref IS DISTINCT FROM to_ref\)/u, 'no row ever has from == to');
  assert.match(migration, /reason_code IN \('NEW_INDEPENDENT_FOCUS', 'THREAD_PROMOTION', 'RETURN_TO_THREAD', 'FOCUS_REPLACEMENT', 'STABLE_DEPARTURE_NO_REPLACEMENT'\)/u);
  assert.match(migration, /\(\(to_kind = 'NONE'\) = \(reason_code = 'STABLE_DEPARTURE_NO_REPLACEMENT'\)\)/u);
  assert.match(migration, /\(\(from_kind = 'NONE' AND to_kind <> 'NONE'\) = \(reason_code = 'NEW_INDEPENDENT_FOCUS'\)\)/u);
  assert.match(migration, /\(reason_code <> 'THREAD_PROMOTION' OR from_kind = 'EMERGING'\)/u, 'a promotion is always Emerging -> Thread');
  assert.match(migration, /session_position >= 1 AND same_sp_event_sequence IN \(2, 3\)/u, 'an LF transition is seq 2 or seq 3, never 1, never more');
  assert.match(migration, /CONSTRAINT live_focus_transitions_one_per_cu UNIQUE \(session_id, cu_id\)/u);
  assert.match(migration, /CONSTRAINT live_focus_transitions_one_per_sp UNIQUE \(session_id, session_position\)/u);
  assert.match(migration, /FOREIGN KEY \(session_id, session_position\) REFERENCES public\.conversation_units \(session_id, session_position\)/u, 'a transition is bound to a real committed Moment');
  assert.match(migration, /FOREIGN KEY \(commit_batch_id\) REFERENCES public\.conversation_thread_semantic_commit_batches \(commit_batch_id\)/u, 'the LF capture exists only beside a FINAL Thread-layer capture');
  assert.match(migration, /transition_count >= 0 AND transition_count <= unit_count/u);
  assert.match(migration, /length\(canonical_fingerprint\) = 32/u);
  assert.doesNotMatch(tables.slice(tables.indexOf('CREATE TABLE public.conversation_live_focus_commit_batches')), /session_position|same_sp_event_sequence/u,
    'the technical LF capture is not a Timeline object: it carries no SP and no same-SP sequence');
  // Timestamps are audit defaults only: never ordered by, never compared, never an LF input.
  assert.doesNotMatch(executableBody, /ORDER BY [^;]*created_at|created_at\s*[<>=]|now\(\)|clock_timestamp/u);
  const timestamps = executableBody.match(/timestamptz|CURRENT_TIMESTAMP/gu) ?? [];
  const auditDefaults = executableBody.match(/created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP/gu) ?? [];
  assert.equal(timestamps.length, auditDefaults.length * 2, 'every timestamp token is an audit default');
  assert.equal(auditDefaults.length, 2, 'each of the two new tables carries exactly one audit default');
  for (const table of ['conversation_live_focus_transitions', 'conversation_live_focus_commit_batches']) {
    assert.match(migration, new RegExp(`BEFORE UPDATE OR DELETE ON public\\.${table}\\s*\\n\\s*FOR EACH ROW EXECUTE FUNCTION public\\.reject_conversation_live_focus_mutation_v1\\(\\)`, 'u'));
  }
  assert.match(migration, /CANONICAL_LIVE_FOCUS_ROW_IS_IMMUTABLE/u);
  assert.doesNotMatch(executableBody, /UPDATE public\.conversation_live_focus|DELETE FROM public\.conversation_live_focus|UPDATE public\.conversation_thread|UPDATE public\.conversation_units|DELETE FROM/u,
    'no rewrite, no backdating and no delete path exists');
  assert.deepEqual([...migrationLevelSql.matchAll(/INSERT INTO public\.(\w+)/gu)], [], 'no migration-level backfill');
});

test('the LF reducer is deterministic and DB-re-derived (D-01): no provider, no timer, no Map / camera / analysis input, LF-01 .. LF-04 exactly', () => {
  for (const rule of ["att.attention_kind IN ('START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS')", "result_row.outcome IN ('ESTABLISH_NEW', 'ATTEND_EXISTING', 'ACTIVATE_EXISTING_IN_SESSION', 'REOPEN_EXISTING')",
    "effective_kind := 'THREAD'", "effective_kind := 'EMERGING'", "'FOCUS_SHIFT' = ANY (sem.functions)", "att.attention_reason <> 'LOCAL_CLARIFICATION_OR_CORRECTION'",
    'anchored := target_att.emerging_focus_id = prior_ref', 'b.thread_id = prior_ref AND b.bound_sp <= p_cu.session_position',
    // R1-01 (B3 -> D same-Moment closure): a departure is only as stable as the frozen lifecycle says.
    "departure_stable := prior_kind <> 'THREAD'", "public.conversation_thread_session_lifecycle_state_v1(prior_ref, p_cu.session_id, p_cu.session_position + 1) = 'DORMANT'", 'IF NOT anchored AND departure_stable THEN',
    'conversation_session_live_focus_before_v1(p_cu.session_id, p_cu.session_position)',
    "reason_code := 'STABLE_DEPARTURE_NO_REPLACEMENT'", "reason_code := 'NEW_INDEPENDENT_FOCUS'", "prior_kind = 'EMERGING' AND prior_ref = att.emerging_focus_id", "reason_code := 'THREAD_PROMOTION'",
    "result_row.outcome = 'ESTABLISH_NEW'", "reason_code := 'RETURN_TO_THREAD'", "reason_code := 'FOCUS_REPLACEMENT'"]) {
    assert.ok(reducer.includes(rule), `the SQL reducer carries: ${rule}`);
  }
  assert.match(reducer, /LIVE_FOCUS_INPUT_NOT_DURABLE/u, 'effective LF is derivable only for a CU whose B1 bundle and FINAL Thread-layer result are durable');
  assert.doesNotMatch(reducer, /created_at|CURRENT_TIMESTAMP|interval|EXTRACT\(|age\(|similar|embedding|score|confidence|importance|reading|hypothes|camera|viewport|inspection|placement_|thread_homes|home_anchor|turn_count|quiet/iu,
    'the reducer reads no timestamp, duration, similarity, importance, spatial, camera or analytical input');
  // No future CU participates: the ONLY `+ 1` is the exclusive upper bound of the
  // R1-01 lifecycle-state read (rows strictly before SP + 1 = up to and including THIS CU).
  assert.doesNotMatch(reducer, /session_position > p_cu\.session_position|session_position >= p_cu\.session_position \+ 1/u, 'no future CU participates');
  assert.equal((reducer.match(/session_position \+ 1/gu) ?? []).length, 1);
  assert.match(reducer, /conversation_thread_session_lifecycle_state_v1\(prior_ref, p_cu\.session_id, p_cu\.session_position \+ 1\)/u);
  assert.match(validator, /derived FROM public\.derive_conversation_effective_live_focus_v1\(p_cu\);/u, 'the validator re-derives every CU');
  assert.match(validator, /LIVE_FOCUS_NOT_CANONICAL/u, 'a payload may neither force a value, invent or hide a transition, nor author a reason');
  assert.match(validator, /INVALID_LIVE_FOCUS_IDENTITY/u, 'the transition identity is derived, never authored');
  assert.match(validator, /\(SELECT count\(\*\) FROM jsonb_object_keys\(p_decision\)\) <> 6/u, 'exactly six keys');
  assert.match(validator, /An unchanged LF carries no transition identity/u);
  assert.match(persist, /p_event_sequence NOT IN \(2, 3\)/u);
  assert.doesNotMatch(persist, /reserve_session_same_sp_event_v1/u, 'the persist path never reserves a sequence: the writer does, exactly once');
  assert.match(migration, /CREATE FUNCTION public\.canonical_live_focus_transition_id_v1\(p_session_id uuid, p_cu_id uuid, p_to_kind text, p_to_ref uuid\)/u);
  assert.match(migration, /RETURNS uuid LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path=''/u);
  assert.match(migration, /p_session_id::text \|\| ':' \|\| p_cu_id::text \|\| ':' \|\| p_to_kind \|\| ':' \|\| COALESCE\(p_to_ref::text, 'NONE'\)/u, 'the exact v5 name');
  assert.match(migration, /ORDER BY t\.session_position DESC, t\.same_sp_event_sequence DESC\s*\n\s*LIMIT 1;/u, 'the current LF is the latest by canonical (SP, sequence), never by timestamp');
});

test('the writer keeps B1 at seq 1, the Thread layer at most one seq 2, LF at seq 2 or 3, nothing for an unchanged LF, under AF66-01', () => {
  const clock = writer.indexOf('FROM public.session_semantic_clocks c');
  const turn = writer.indexOf('FROM public.conversation_turns t');
  const focusPersist = writer.indexOf('persist_conversation_unit_focus_semantics_v1(');
  const identityClock = writer.indexOf('FROM public.conversation_world_thread_identity_clocks w');
  const world = writer.indexOf('FROM public.conversation_world_spatial_authorities w');
  const threadPersist = writer.indexOf('persist_conversation_thread_establishment_v1(');
  const lifecyclePersist = writer.indexOf('persist_conversation_thread_lifecycle_layer_v1(inserted_cu, p_batch_id, lifecycle, reserved_sequence)');
  const lfValidate = writer.indexOf('validate_conversation_live_focus_decision_v1(inserted_cu, lf_unit)');
  const lfPersist = writer.indexOf('persist_conversation_live_focus_transition_v1(');
  assert.ok(clock > 0 && turn > clock && focusPersist > turn && identityClock > focusPersist && world > identityClock && threadPersist > world && lifecyclePersist > threadPersist && lfValidate > lifecyclePersist && lfPersist > lfValidate,
    'Session clock FIRST -> source turn -> B1 rows -> identity clock -> spatial authority -> Thread / Home / binding / lifecycle rows -> LF derived AFTER the FINAL Thread-layer truth -> LF row');
  assert.equal((writer.match(/FOR UPDATE/gu) ?? []).length, 4, 'exactly four row locks: Session clock, source turn, identity clock, spatial authority - LF adds none');
  assert.equal((writer.match(/reserve_session_same_sp_event_v1/gu) ?? []).length, 3, 'the ONE T-03A2 seam: sequence 1 for B1, sequence 2 ONCE for the Thread layer, ONCE more for an LF transition');
  assert.match(writer, /reserved_sequence IS DISTINCT FROM 1::bigint/u);
  assert.match(writer, /reserved_sequence IS DISTINCT FROM 2::bigint/u);
  assert.match(writer, /reserved_sequence IS DISTINCT FROM \(CASE WHEN has_change THEN 3::bigint ELSE 2::bigint END\)/u, 'seq 3 exactly after a Thread-layer seq 2, seq 2 otherwise');
  assert.match(writer, /IF lf_decision\.changed THEN/u);
  assert.doesNotMatch(writer, /same_sp_event_sequence \+ 1|CREATE SEQUENCE|nextval\(/u);
  // The frozen 0066 / 0068 / 0070 gates and helpers are CALLED, never re-implemented.
  for (const reused of ['validate_conversation_thread_decision_v1(inserted_cu, decision)', 'validate_conversation_thread_lifecycle_decision_v1(inserted_cu, decision, lifecycle)',
    'persist_conversation_thread_establishment_v1(', 'persist_conversation_thread_lifecycle_layer_v1(', 'compute_canonical_home_placement_v1(', 'canonical_thread_identities_v1(turn_row.user_id',
    'persist_conversation_unit_focus_semantics_v1(']) {
    assert.ok(writer.includes(reused), `the writer reuses ${reused}`);
  }
  assert.doesNotMatch(migration, /CREATE FUNCTION public\.(?:osdap_|compute_canonical_home_placement|validate_conversation_thread_decision|persist_conversation_thread_establishment|canonical_thread_identities|validate_conversation_thread_lifecycle_decision|persist_conversation_thread_lifecycle_layer|derive_conversation_thread_lifecycle_transitions|persist_conversation_unit_focus_semantics)/u,
    'no second placement engine, identity authority, B1 / B2 / B3 validator or persist path');
  // Replay is all-or-nothing through the ONE full-chain authority; a NEW batch never delegates to the 0070 writer (it would seal a Moment before its LF is durable).
  assert.match(writer, /batch_state := public\.conversation_full_semantic_batch_state_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\);/u);
  assert.match(writer, /IF batch_state = 'ABSENT' THEN/u);
  assert.match(writer, /IF batch_state <> 'COMPLETE' THEN[\s\S]{0,400}FULL_SEMANTIC_BATCH_INTEGRITY/u);
  assert.match(writer, /PERFORM \* FROM public\.commit_conversation_units_with_focus_thread_lifecycle_v1\(/u, 'replay delegates the CU / B1 / B2 / B3 layers to the frozen 0070 writer with zero mutation');
  assert.ok(writer.indexOf('PERFORM * FROM public.commit_conversation_units_with_focus_thread_lifecycle_v1(') > writer.indexOf("IF batch_state <> 'COMPLETE' THEN"), 'the delegation lives in the replay path only');
  assert.match(writer, /LIVE_FOCUS_BATCH_PAYLOAD_CONFLICT/u);
  assert.match(writer, /LIVE_FOCUS_UNIT_MAPPING_MISMATCH/u);
  assert.match(writer, /INVALID_LIVE_FOCUS_PROVENANCE/u);
  assert.match(writer, /'lf_reducer_version', p_lf_reducer_version/u, 'the reducer version is part of the capture identity');
  const signature = writer.slice(0, writer.indexOf(') RETURNS SETOF'));
  assert.doesNotMatch(signature, /placement|coordinate|fingerprint|attempt|_x |_y |scheme|from_kind|from_ref|p_same_sp_event_sequence\b|p_session_position\b|p_sp\b|p_live_head|label|home/u,
    'the signature accepts no caller-authored SP, sequence, placement, from value, label or Home');
});

test('the coordinator classifies both halves by the ONE full-chain authority, checks the Session token FIRST and the identity version SECOND; LF adds no third authority', () => {
  const relation = coordinator.indexOf('INVALID_FINALIZED_EXCHANGE_RELATION');
  const gate = coordinator.indexOf('user_state := public.conversation_full_semantic_batch_state_v1');
  const sessionStale = coordinator.indexOf("RAISE EXCEPTION 'STALE_CONVERSATIONAL_FOCUS_CONTEXT'");
  const identityLock = coordinator.indexOf('FROM public.conversation_world_thread_identity_clocks w');
  const identityStale = coordinator.indexOf("RAISE EXCEPTION 'STALE_THREAD_IDENTITY_CONTEXT'");
  const write = coordinator.indexOf('public.commit_conversation_units_with_full_semantic_chain_v1(');
  assert.ok(relation < gate && gate < sessionStale && sessionStale < identityLock && identityLock < identityStale && identityStale < write,
    'relation gate -> half-state gate -> Session token -> identity clock lock -> identity version -> BOTH writer calls');
  assert.ok(coordinator.indexOf('FROM public.session_semantic_clocks c') < identityLock, 'never identity clock before Session Semantic Clock');
  assert.match(coordinator, /IF NOT \(\(user_state = 'ABSENT' AND assistant_state = 'ABSENT'\)[\s\S]{0,200}FULL_SEMANTIC_BATCH_INTEGRITY/u);
  assert.equal((coordinator.match(/USING ERRCODE='40001'/gu) ?? []).length, 2, 'exactly two exact typed stale conditions: LF introduces no third optimistic authority');
  assert.match(coordinator, /p_user_live_focus_units jsonb,/u);
  assert.match(coordinator, /p_assistant_live_focus_units jsonb,/u);
  assert.match(coordinator, /p_lf_reducer_version text,/u);
  assert.match(coordinator, /live_focus_kind text,\s*\n\s*live_focus_ref uuid,\s*\n\s*live_focus_sp integer,/u, 'the delivery facts: reference identity and the SP it became effective at');
  assert.match(coordinator, /jsonb_build_object\('session_position', t\.session_position, 'to_kind', t\.to_kind, 'to_ref', t\.to_ref\)/u, 'transitions cross as reference identity only');
  assert.doesNotMatch(coordinator, /label|home_anchor|placement|committed_text|reason_code'|same_sp_event_sequence', t/u, 'no label, Home, content, reason or sequence is returned');
});

test('the full-chain completeness authority REUSES 0070 and re-derives every LF claim; ABSENT / COMPLETE / PARTIAL, never upgraded', () => {
  assert.match(batchState, /base_state := public\.conversation_thread_semantic_batch_state_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\);/u);
  assert.match(batchState, /RETURNS text\s*\nLANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''/u);
  for (const rule of ["RETURN CASE WHEN lf_row.commit_batch_id IS NULL THEN 'ABSENT' ELSE 'PARTIAL' END;", "IF base_state <> 'COMPLETE' OR lf_row.commit_batch_id IS NULL THEN",
    'lf_row.unit_count <> commit_row.unit_count', 'row_total <> lf_row.transition_count', "EXCEPTION WHEN SQLSTATE '55000' THEN",
    'expected_sequence := CASE WHEN result_row.thread_layer_event_sequence = 2 THEN 3 ELSE 2 END;', 'transition.same_sp_event_sequence <> expected_sequence',
    'transition.from_kind <> derived.prior_kind OR transition.from_ref IS DISTINCT FROM derived.prior_ref', 'transition.to_kind <> derived.effective_kind OR transition.to_ref IS DISTINCT FROM derived.effective_ref',
    'transition.reason_code <> derived.reason_code', 'transition.event_id <> public.canonical_live_focus_transition_id_v1(cu.session_id, cu.id, derived.effective_kind, derived.effective_ref)',
    "transition.to_kind = 'EMERGING' AND NOT EXISTS", "transition.to_kind = 'THREAD' AND NOT EXISTS", 'ELSIF transition.event_id IS NOT NULL THEN']) {
    assert.ok(batchState.includes(rule), `structural completeness requires: ${rule}`);
  }
  assert.doesNotMatch(batchState, /INSERT INTO|UPDATE public|DELETE FROM|created_at/u);
  assert.match(coordinator, /user_state := public\.conversation_full_semantic_batch_state_v1\(p_session_id, p_user_id, p_user_source_turn_id, p_user_batch_id\);/u);
  assert.match(coordinator, /assistant_state := public\.conversation_full_semantic_batch_state_v1\(p_session_id, p_user_id, p_assistant_source_turn_id, p_assistant_batch_id\);/u);
  assert.match(reads, /full_semantic_capture_state := public\.conversation_full_semantic_batch_state_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\);/u,
    'the ONE authority serves the writer, both coordinator halves and the snapshot');
});

test('the FINAL reads delegate to 0070 and fail closed on legacy history; the authenticated LF delivery is owner-scoped reference identity only', () => {
  assert.match(reads, /FROM public\.get_conversation_thread_lifecycle_integrated_batch_snapshot_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\) s;/u, 'the 0070 snapshot is preserved by delegation');
  assert.match(reads, /FROM public\.get_conversation_thread_lifecycle_runtime_context_v1\(p_session_id, p_user_id\) c;/u, 'the 0070 context is preserved by delegation');
  assert.match(reads, /PRIOR_BATCH_NOT_FULL_CHAIN_COMPLETE/u, 'legacy history is never silently reduced to "no LF yet"');
  assert.match(reads, /INVALID_SEMANTIC_RUNTIME_CONTEXT/u);
  assert.match(reads, /current_live_focus_kind text,\s*\n\s*current_live_focus_ref uuid,\s*\n\s*current_live_focus_sp integer/u);
  assert.doesNotMatch(reads, /placement_x|placement_y|home_anchor_id|address_scheme|world_fingerprint|created_at|label|committed_text/u);
  assert.match(delivery, /caller := \(SELECT auth\.uid\(\)\);/u, 'ownership is server-derived from auth.uid(), never a caller-supplied user id');
  assert.equal((delivery.match(/auth\.uid\(\)/gu) ?? []).length, 2, 'both delivery reads derive the caller');
  assert.match(delivery, /RETURNS TABLE\(session_id uuid, live_head integer, live_focus_kind text, live_focus_ref uuid, live_focus_sp integer\)/u, 'the snapshot: LH beside the current LF and its effective SP');
  assert.match(delivery, /RETURNS TABLE\(\s*\n\s*session_id uuid,\s*\n\s*session_position integer,\s*\n\s*to_kind text,\s*\n\s*to_ref uuid\s*\n\)/u, 'catch-up rows carry no same-SP sequence, reason, label or content');
  assert.match(delivery, /INVALID_DELIVERY_CURSOR/u);
  assert.match(delivery, /effective_limit < 1 OR effective_limit > 256/u);
  assert.match(delivery, /ORDER BY t\.session_position\s*\n\s*LIMIT effective_limit;/u);
  assert.doesNotMatch(delivery, /same_sp_event_sequence|reason_code|label|home|committed_text|created_at|projection|knowledge/u);
  assert.match(audit, /RETURNS void\s*\nLANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''/u);
  assert.equal((audit.match(/RAISE EXCEPTION 'FULL_SEMANTIC_CHAIN_CUTOVER_NOT_READY' USING ERRCODE='55000'/gu) ?? []).length, 4, 'one stable technical error, four detail kinds');
  assert.match(audit, /t\.from_kind = 'THREAD' AND t\.to_kind = 'NONE'\s*\n\s*AND public\.conversation_thread_session_lifecycle_state_v1\(t\.from_ref, t\.session_id, t\.session_position \+ 1\) IS DISTINCT FROM 'DORMANT'/u,
    'R1-01: the audit refuses any stored Thread departure the frozen lifecycle contradicts');
  for (const detail of ['COMMIT_BATCH_NOT_FULL_SEMANTIC_CHAIN_COMPLETE', 'ORPHAN_LIVE_FOCUS_TRANSITION', 'INVALID_LIVE_FOCUS_CHAIN', 'LIVE_FOCUS_DEPARTURE_LIFECYCLE_CONTRADICTION']) {
    assert.ok(audit.includes(detail), `the audit names ${detail}`);
  }
  assert.doesNotMatch(audit, /INSERT|UPDATE|DELETE|created_at|historical|PRE_FIRST_SP|thread_enabled|analysis_enabled|semantic_version|lf_enabled/u);
});

test('THE CUTOVER: exactly one committing authority for service_role, the temporary T-03A2 writers retired, the two LF delivery reads opened, nothing else granted', () => {
  assert.match(cutover, /GRANT EXECUTE ON FUNCTION public\.commit_finalized_exchange_with_full_semantic_chain_v1\([^)]*\) TO service_role/u);
  assert.match(cutover, /GRANT EXECUTE ON FUNCTION public\.get_conversation_full_semantic_integrated_batch_snapshot_v1\(uuid,uuid,uuid,uuid\) TO service_role/u);
  assert.match(cutover, /GRANT EXECUTE ON FUNCTION public\.get_conversation_full_semantic_runtime_context_v1\(uuid,uuid\) TO service_role/u);
  assert.match(cutover, /GRANT EXECUTE ON FUNCTION public\.get_conversation_thread_identity_dossier_page_v1\(uuid,bigint,uuid,integer\) TO service_role/u);
  assert.match(cutover, /REVOKE ALL ON FUNCTION public\.commit_conversation_units_v1\([^)]*\) FROM service_role/u, 'the temporary T-03A2 producer is retired');
  assert.match(cutover, /REVOKE ALL ON FUNCTION public\.commit_finalized_exchange_conversation_units_v1\([^)]*\) FROM service_role/u, 'the temporary T-03A2 exchange coordinator is retired');
  assert.match(cutover, /^GRANT EXECUTE ON FUNCTION public\.get_session_live_state_v1\(uuid\) TO authenticated;$/mu);
  assert.match(cutover, /^GRANT EXECUTE ON FUNCTION public\.get_live_focus_transition_events_v1\(uuid,integer,integer\) TO authenticated;$/mu);
  assert.equal((cutover.match(/GRANT EXECUTE/gu) ?? []).length, 6, 'exactly six grants: four to service_role, two to authenticated');
  assert.doesNotMatch(cutover, /GRANT [^;]*TO anon|GRANT [^;]*TO PUBLIC/u);
  assert.doesNotMatch(cutover, /GRANT EXECUTE ON FUNCTION public\.commit_conversation_units_with_full_semantic_chain_v1/u, 'the per-batch writer is reachable only through the coordinator');
  assert.doesNotMatch(cutover, /GRANT EXECUTE ON FUNCTION public\.(?:commit_conversation_units_with_focus|commit_finalized_exchange_with_focus|reserve_session_same_sp_event_v1|get_conversation_thread_lifecycle|assert_conversation)/u,
    'no predecessor writer, seam, 0070 read or audit is granted');
  assert.match(cutover, /ENABLE ROW LEVEL SECURITY/u);
  assert.match(cutover, /REVOKE ALL ON TABLE public\.conversation_live_focus_transitions, public\.conversation_live_focus_commit_batches\s*\n\s*FROM PUBLIC, anon, authenticated;/u);
  assert.doesNotMatch(cutover, /GRANT [^;]*ON TABLE/u, 'no table privilege for any role');
  for (const assertion of [
    'T-03D creates a forward-only substrate and backfills nothing',
    'every T-03D table must be append-only',
    'T-03D introduces no LF label / Home / content / score / projection column',
    'the technical LF capture is not a Timeline object: it carries no SP and no same-SP sequence',
    'T-03D requires at most one LF transition per CU and per SP, never from == to',
    'T-03D functions must stay postgres-owned, SECURITY DEFINER and search_path-fixed',
    'T-03D reads, derivations and the audit must be STABLE, never writers',
    'the 0065 / 0066 / 0068 / 0070 substrate must remain deployed, byte-identical, and callable from inside this chain',
    'T-03D must reuse the 0066 / 0068 / 0070 authorities and the 0070 reads, never duplicate them',
    'the T-03D cutover requires service_role EXECUTE on %',
    'after the T-03D cutover service_role must not execute %',
    'exactly ONE committing function is executable by service_role after T-03D',
    'the owner-scoped LF delivery read % must be executable by authenticated',
    'the LF substrate must stay unreachable',
    'T-03D requires the exact RFC 4122 version-5 derivation of its frozen namespace',
    'T-03D requires the frozen LF transition identity vectors',
    'T-03D must not alter the Session Semantic Clock',
  ]) {
    assert.ok(migration.includes(assertion), `the migration self-asserts: ${assertion}`);
  }
  for (const vector of ['14cd67f4-be9d-54f6-b735-cbe38a7cb311', '31ae1e67-d4f8-541a-8188-f9db29f6cc20', 'ebf823d1-1081-5ae2-94ac-aa69b9d62ccc', '12ac4f9b-1865-5bfd-8c5e-cebb1e178b98']) {
    assert.ok(migration.includes(vector) && verifier.includes(vector), `the identity vector ${vector} is pinned in SQL and replayed by the verifier`);
  }
  assert.match(migration, /https:\/\/qandeel\.app\/runtime\/live-focus-transition\/v1/u);
});

test('every identifier 0071 introduces fits the PostgreSQL 63-byte limit', () => {
  const identifiers = [...migration.matchAll(/\b(?:TABLE|FUNCTION|INDEX|TRIGGER|CONSTRAINT)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gu)].map((m) => m[1]);
  assert.ok(identifiers.length > 0);
  assert.deepEqual([...new Set(identifiers)].filter((name) => Buffer.byteLength(name, 'utf8') > 63), []);
});

test('the 0071 verifier proves live semantics and is wired into the toolchain and CI', () => {
  for (const proof of ['FULL_SEMANTIC_CHAIN_CUTOVER_NOT_READY', 'COMMIT_BATCH_NOT_FULL_SEMANTIC_CHAIN_COMPLETE', 'PRIOR_BATCH_NOT_FULL_CHAIN_COMPLETE', 'INCOMPLETE_PRIOR_SEMANTIC_HISTORY',
    'LIVE_FOCUS_NOT_CANONICAL', 'INVALID_LIVE_FOCUS_IDENTITY', 'INVALID_LIVE_FOCUS_PAYLOAD', 'LIVE_FOCUS_UNIT_MAPPING_MISMATCH', 'INVALID_LIVE_FOCUS_PROVENANCE', 'LIVE_FOCUS_BATCH_PAYLOAD_CONFLICT',
    'FULL_SEMANTIC_BATCH_INTEGRITY', 'THREAD_SEMANTIC_BATCH_PAYLOAD_CONFLICT', 'STALE_CONVERSATIONAL_FOCUS_CONTEXT', 'STALE_THREAD_IDENTITY_CONTEXT', 'CANONICAL_LIVE_FOCUS_ROW_IS_IMMUTABLE',
    'live_focus_transitions_change_check', 'live_focus_transitions_position_check', 'live_focus_transitions_reason_shape_check', 'live_focus_transitions_one_per_sp', 'live_focus_batches_count_check',
    'INVALID_DELIVERY_CURSOR', 'INVALID_DELIVERY_LIMIT', 'has_function_privilege', 'has_table_privilege', 'pg_get_functiondef',
    'NEW_INDEPENDENT_FOCUS', 'THREAD_PROMOTION', 'RETURN_TO_THREAD', 'FOCUS_REPLACEMENT', 'STABLE_DEPARTURE_NO_REPLACEMENT',
    'exactly ONE committing function is executable by service_role after T-03D', 'no temporal-only fallback', 'the temporary T-03A2 producer / coordinator are retired',
    'a legacy T-03A2-only batch', 'a B1-only batch', 'a B2-only', 'a B3-only', 'no repair, no backfill', 'never upgrades',
    'a deleted LF transition', 'a deleted technical LF capture row', 'a transition at the wrong same-SP sequence claim', 'a transition to a value the reducer never derived', 'an authored reason',
    'a broken chain', 'an extra transition where the LF did not change', 'a transition re-attributed to another batch',
    'a Thread departure the frozen lifecycle contradicts (R1-01)', 'LIVE_FOCUS_DEPARTURE_LIFECYCLE_CONTRADICTION', 'no stored Thread departure contradicts the frozen lifecycle', 'B3 and LF agree at the same Moment',
    'every row rolled back', 'no sealed SP was reopened', 'mutates zero rows and zero clock coordinates',
    'an unchanged LF reserves no same-SP sequence', 'seq 3 after the Thread-layer seq 2', 'anchored shift', 'a clarification', 'permission denied',
    "same_sp_event_sequence: '1'", 'the SQL reducer re-derives', 'LF is Session-local', 'reference identity only', 'the cursor is exclusive', 'another user sees no live state']) {
    assert.ok(verifier.includes(proof), `verifier is missing ${proof}`);
  }
  assert.match(packageJson, /"verify:effective-live-focus-final-semantic-chain-cutover:integration": "node --env-file-if-exists=\.env database\/verify-migration-0071\.mjs"/u);
  assert.match(workflow, /run: npm run verify:effective-live-focus-final-semantic-chain-cutover:integration/u);
  assert.ok(workflow.indexOf('run: npm run verify:effective-live-focus-final-semantic-chain-cutover:integration')
    > workflow.indexOf('run: npm run verify:thread-lifecycle-cross-session-continuity:integration'), 'the 0071 verifier runs after the 0070 verifier');
});
