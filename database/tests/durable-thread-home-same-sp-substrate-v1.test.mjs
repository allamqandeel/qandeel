import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// T-03B2b2 - Durable Thread + Permanent Home + Same-SP DB Substrate: the
// static database contract. Live semantics are proven against real PostgreSQL
// by database/verify-migration-0068.mjs. This file guards the SHAPE of
// migration 0068: what it creates, what it may never create, that 0064-0067
// stay byte-identical, that the per-Moment order and the AF66-01 lock order
// are structurally present, that QANDEEL_OSDAP_V1 is mirrored with its exact
// frozen constants, and that the whole slice stays production-inert.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const migration = read('../migrations/0068_durable_thread_home_same_sp_substrate_v1.sql');
const verifier = read('../verify-migration-0068.mjs');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const stripSql = (text) => text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
/** Executable statements only: a DETAIL message may NAME a construct in order to forbid it. */
const stripProse = (text) => text.replace(/DETAIL='[\s\S]*?';/gu, "DETAIL='';");
const executableSql = stripSql(migration);
const section = (from, to) => {
  const start = migration.indexOf(from);
  const end = to === undefined ? migration.length : migration.indexOf(to);
  assert.ok(start >= 0 && (to === undefined || end > start), `section ${from} was located`);
  return stripSql(migration.slice(start, end));
};
const SELF_ASSERTION_MARKER = '-- 15. Terminal self-assertions.';
const executableBody = stripSql(migration.slice(0, migration.indexOf(SELF_ASSERTION_MARKER)));
const writer = section('CREATE FUNCTION public.commit_conversation_units_with_focus_and_thread_v1', '-- 13. The atomic finalized-exchange coordinator');
const coordinator = section('CREATE FUNCTION public.commit_finalized_exchange_with_focus_and_thread_v1', '-- 14. Ownership, search_path hardening');
const validator = section('CREATE FUNCTION public.validate_conversation_thread_decision_v1', '-- 11. Persisting ONE establishment');
const persist = section('CREATE FUNCTION public.persist_conversation_thread_establishment_v1', '-- 12. The integrated per-Moment writer');
const placement = section('CREATE FUNCTION public.compute_canonical_home_placement_v1', '-- ===========================================================================\n-- 10.');
const search = section('CREATE FUNCTION public.osdap_search_admissible_placement_v1', '-- 9.9 The canonical placement');

function gitBlobId(content) {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

test('0068 is the newest migration, orders after 0067, and 0064-0067 are byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), '0068_durable_thread_home_same_sp_substrate_v1.sql');
  assert.ok(migrations.indexOf('0068_durable_thread_home_same_sp_substrate_v1.sql')
    > migrations.indexOf('0067_conversation_focus_runtime_integration_readiness_v1.sql'));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal(gitBlobId(read('../migrations/0064_committed_conversational_unit_substrate_v1.sql')), '0a2ee63980e59072b3e9f52a643efa8220e95b08', '0064 byte-identical');
  assert.equal(gitBlobId(read('../migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql')), '3dc061c71bcb237cec648abb2d1fa02f450cd57f', '0065 byte-identical');
  assert.equal(gitBlobId(read('../migrations/0066_durable_reference_emerging_focus_sp_substrate_v1.sql')), '9f0588d5ca46329a8721ee30302f49d227a357ae', '0066 byte-identical');
  assert.equal(gitBlobId(read('../migrations/0067_conversation_focus_runtime_integration_readiness_v1.sql')), 'd12a3f552e80709ee1d20887f55f1c84e84f9208', '0067 byte-identical');
  assert.equal(gitBlobId(read('../verify-migration-0066.mjs')), '39559c2ca81dd216968e694e6c93c8a160fec4a4', 'the 0066 verifier is byte-identical');
  assert.equal(gitBlobId(read('../verify-migration-0067.mjs')), 'aaec5bf020143b111d265f0726bdc08d0c5922df', 'the 0067 verifier is byte-identical');
  assert.match(migration, /current_setting\('server_encoding'\) <> 'UTF8'/u);
  assert.match(migration, /to_regclass\('public\.conversation_emerging_focuses'\) IS NULL/u, 'the T-03B1b1 substrate is a precondition');
  assert.doesNotMatch(executableSql, /CREATE OR REPLACE|DROP |ALTER TABLE public\.conversation_units|ALTER TABLE public\.session_semantic_clocks/u,
    '0068 replaces, drops and alters nothing that already exists');
});

test('0068 creates exactly the seven durable tables and nothing else', () => {
  assert.deepEqual([...migration.matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]).sort(), [
    'conversation_thread_commit_batches', 'conversation_thread_establishment_events',
    'conversation_thread_establishment_evidence', 'conversation_thread_homes',
    'conversation_thread_origin_members', 'conversation_threads',
    'conversation_world_spatial_authorities',
  ]);
  assert.deepEqual([...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((m) => m[1]).sort(), [
    'commit_conversation_units_with_focus_and_thread_v1', 'commit_finalized_exchange_with_focus_and_thread_v1',
    'compute_canonical_home_placement_v1', 'osdap_attempt_digest_v1', 'osdap_candidate_offset_v1',
    'osdap_floor_div_v1', 'osdap_origin_fingerprint_v1', 'osdap_search_admissible_placement_v1',
    'osdap_serialize_homes_v1', 'osdap_unsigned_v1', 'osdap_world_fingerprint_v1',
    'persist_conversation_thread_establishment_v1', 'reject_conversation_thread_mutation_v1',
    'validate_conversation_thread_decision_v1',
  ]);
  assert.doesNotMatch(executableSql, /CREATE EXTENSION|CREATE SEQUENCE|nextval\(|CREATE POLICY|CREATE TYPE|CREATE VIEW|CREATE MATERIALIZED/u);
  // Every canonical table is append-only for the owner too.
  assert.equal((migration.match(/EXECUTE FUNCTION public\.reject_conversation_thread_mutation_v1\(\)/gu) ?? []).length, 7);
  assert.match(migration, /RAISE EXCEPTION 'CANONICAL_THREAD_ROW_IS_IMMUTABLE'/u);
  // No backfill, no legacy rewrite, no historical-enabled declaration, no flag.
  assert.doesNotMatch(executableBody, /UPDATE public\.conversation_units|DELETE FROM|TRUNCATE|historical_enabled|cutover|feature_flag|activation/u);
  assert.deepEqual([...executableBody.matchAll(/INSERT INTO public\.(\w+)/gu)].map((m) => m[1]).sort(), [
    'conversation_focus_commit_batches', 'conversation_thread_commit_batches',
    'conversation_thread_establishment_events', 'conversation_thread_establishment_evidence',
    'conversation_thread_homes', 'conversation_thread_origin_members', 'conversation_threads',
    'conversation_unit_commit_batches', 'conversation_unit_commit_events', 'conversation_units',
    'conversation_world_spatial_authorities',
  ], 'the writer inserts only committed CUs, their capture batches and the Thread layer; T-03B1 rows go through the frozen 0066 helper');
});

test('the durable schema carries the frozen invariants and nothing graded, lifecycle-shaped or hierarchical', () => {
  const threads = section('CREATE TABLE public.conversation_threads', '-- ===========================================================================\n-- 3.');
  assert.match(threads, /id uuid PRIMARY KEY/u);
  assert.match(threads, /grounding_emerging_focus_id uuid NOT NULL UNIQUE/u, 'the EmergingFocus -> Thread lineage is one-to-one and immutable');
  assert.match(threads, /CHECK \(establishment_path IN \('TE-01','TE-02','TE-03'\)\)/u);
  assert.match(threads, /CHECK \(established_sp >= 1 AND established_event_sequence = 2\)/u, 'establishment is always the second same-SP layer of its Moment');
  const homes = section('CREATE TABLE public.conversation_thread_homes', '-- ===========================================================================\n-- 4.');
  assert.match(homes, /thread_id uuid PRIMARY KEY/u, 'exactly ONE permanent Home per Thread, structurally');
  assert.match(homes, /home_anchor_id uuid NOT NULL UNIQUE/u);
  assert.match(homes, /UNIQUE \(user_id, address_scheme, placement_x, placement_y\)/u, 'one canonical place holds at most one Thread');
  assert.match(homes, /address_scheme = 'QANDEEL_OSDAP_V1'/u);
  assert.match(homes, /placement_engine_version = 'canonical-home-placement-engine-v1'/u);
  assert.match(homes, /placement_x numeric\(20,0\) NOT NULL/u, 'a coordinate is exact, never a floating value');
  assert.match(homes, /placement_attempt >= 0 AND placement_attempt <= 8191/u);
  assert.match(homes, /placement_x >= -4611686018427387904 AND placement_x <= 4611686018427387903/u);
  const origins = section('CREATE TABLE public.conversation_thread_origin_members', '-- ===========================================================================\n-- 7.');
  assert.match(origins, /PRIMARY KEY \(thread_id, origin_member_ordinal\)/u);
  assert.match(origins, /UNIQUE \(thread_id, origin_thread_id\)/u);
  for (const forbidden of ['parent_thread_id', 'origin_parent', 'primary_origin', 'edge_direction', 'semantic_distance', 'weight', 'rank']) {
    assert.equal(origins.includes(forbidden), false, `Conversational Origin provenance must not carry ${forbidden}`);
  }
  const evidence = section('CREATE TABLE public.conversation_thread_establishment_evidence', '-- ===========================================================================\n-- 6.');
  assert.match(evidence, /PRIMARY KEY \(thread_id, evidence_ordinal\)/u);
  assert.match(evidence, /UNIQUE \(thread_id, cu_id\)/u);
  assert.match(evidence, /evidence_role IN \('PRIOR_EVIDENCE','ESTABLISHING_CU'\)/u);
  const events = section('CREATE TABLE public.conversation_thread_establishment_events', '-- ===========================================================================\n-- 5.');
  assert.match(events, /thread_id uuid NOT NULL UNIQUE/u);
  assert.match(events, /home_anchor_id uuid NOT NULL UNIQUE/u);
  assert.match(events, /session_position >= 1 AND same_sp_event_sequence = 2/u, 'Thread and Home are ONE B2 semantic event');
  assert.match(events, /origin_state IN \('NONE','RESOLVED','MULTIPLE','AMBIGUOUS'\)/u);
  const batches = section('CREATE TABLE public.conversation_thread_commit_batches', '-- ===========================================================================\n-- 8.');
  assert.doesNotMatch(batches, /session_position|same_sp_event_sequence/u, 'the capture batch is technical metadata: it carries no SP and no sequence');
  assert.match(batches, /establishment_count >= 0 AND establishment_count <= unit_count/u);
  const authority = section('CREATE TABLE public.conversation_world_spatial_authorities', '-- ===========================================================================\n-- 2.');
  assert.match(authority, /user_id uuid PRIMARY KEY/u);
  assert.match(authority, /address_scheme = 'QANDEEL_OSDAP_V1'/u);
  assert.doesNotMatch(authority, /rank|counter|layout|next_|cursor|origin_x|origin_y|zoom/u, 'the serialization row holds no mutable world state');
  // No lifecycle, LF, score, merge or Reading column anywhere in the slice.
  const tables = migration.slice(migration.indexOf('CREATE TABLE public.conversation_world_spatial_authorities'), migration.indexOf('-- 8. Append-only / permanence'));
  for (const forbidden of ['lifecycle', 'dormant', 'reopen', 'live_focus', 'liveFocus', 'merge', 'score', 'confidence',
    'similarity', 'embedding', 'importance', 'label', 'display_name', 'reading_id', 'timeline', 'projection', 'viewport', 'camera']) {
    assert.equal(stripSql(tables).toLowerCase().includes(forbidden.toLowerCase()), false, `the durable schema must not carry ${forbidden}`);
  }
  // Timestamps are audit-only.
  const timestamps = executableBody.match(/timestamptz|CURRENT_TIMESTAMP|now\(\)|clock_timestamp/gu) ?? [];
  const auditDefaults = executableBody.match(/created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP/gu) ?? [];
  assert.equal(timestamps.length, auditDefaults.length * 2, 'every timestamp token is an audit default');
  assert.doesNotMatch(executableBody, /ORDER BY [^;]*created_at|created_at\s*[<>=]/u);
});

test('QANDEEL_OSDAP_V1 is mirrored with its exact frozen constants and exact integer arithmetic', () => {
  assert.match(search, /min_coord constant numeric := -4611686018427387904;/u);
  assert.match(search, /max_coord constant numeric := 4611686018427387903;/u);
  assert.match(search, /home_step constant numeric := 1000000;/u);
  assert.match(search, /min_separation constant numeric := 250000;/u);
  assert.match(search, /candidates_per_shell constant integer := 32;/u);
  assert.match(search, /max_attempts constant integer := 8192;/u);
  assert.match(migration, /'qandeel-osdap-v1' \|\| '\|' \|\| p_user_world_id \|\| '\|' \|\| p_new_thread_id \|\| '\|'/u);
  assert.match(migration, /encode\(p_origin_fingerprint, 'hex'\) \|\| '\|' \|\| encode\(p_world_fingerprint, 'hex'\) \|\| '\|' \|\| p_attempt::text/u);
  assert.match(migration, /'QANDEEL_OSDAP_V1' \|\| E'\\n' \|\| public\.osdap_serialize_homes_v1/u);
  assert.match(migration, /h\.thread_id \|\| E'\\t' \|\| h\.x::bigint::text \|\| E'\\t' \|\| h\.y::bigint::text \|\| E'\\n'/u);
  assert.match(migration, /ORDER BY h\.thread_id COLLATE "C"/u, 'canonical order is byte order, never a locale collation');
  assert.match(migration, /public\.osdap_unsigned_v1\(p_digest, 0, 16\)/u);
  assert.match(migration, /public\.osdap_unsigned_v1\(p_digest, 16, 32\)/u);
  assert.match(migration, /mod\(public\.osdap_unsigned_v1\(p_digest, 0, 16\), 2 \* p_radius \+ 1\) - p_radius/u);
  assert.match(migration, /boundary := div\(p_radius \+ 1, 2\);/u, 'the outer-half boundary is ceil(radius / 2)');
  assert.match(migration, /IF abs_dx >= abs_dy THEN/u, 'x wins the absolute-value tie');
  assert.match(migration, /CASE WHEN offset_dx < 0 THEN -1 ELSE 1 END/u, 'a zero component counts as positive');
  assert.match(search, /radius := home_step \* \(1 \+ attempt \/ candidates_per_shell\);/u);
  assert.match(search, /CONTINUE;/u, 'an out-of-bound candidate is skipped');
  assert.doesNotMatch(stripProse(search), /LEAST\(GREATEST|LEAST\(max_coord|GREATEST\(min_coord|mod\(candidate/u, 'a candidate is never clamped or wrapped into the bound');
  assert.match(search, /abs\(candidate_x - h\.x\) < min_separation AND abs\(candidate_y - h\.y\) < min_separation/u,
    'the separation test is the exact Chebyshev comparison');
  assert.match(search, /RAISE EXCEPTION 'CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED'/u);
  assert.match(placement, /base_x := 0;\s*\n\s*base_y := 0;/u, 'origin NONE searches from the world datum');
  assert.match(placement, /base_x := public\.osdap_floor_div_v1\(sum_x, origin_count\);/u, 'the barycenter is exact floor division over ALL members');
  assert.match(migration, /quotient := div\(p_dividend, p_divisor\);[\s\S]*?IF mod\(p_dividend, p_divisor\) < 0 THEN\s*\n\s*quotient := quotient - 1;/u,
    'floor division rounds toward negative infinity');
  // The placement binds the search to the REAL fingerprints of the REAL world.
  assert.match(placement, /world_fingerprint := public\.osdap_world_fingerprint_v1\(p_existing_thread_ids, p_existing_x, p_existing_y\);/u);
  assert.match(placement, /origin_fingerprint := public\.osdap_origin_fingerprint_v1\(p_origin_state, p_origin_thread_ids, origin_x, origin_y\);/u);
  assert.match(placement, /public\.osdap_search_admissible_placement_v1\(\s*p_user_world_id, p_new_thread_id, origin_fingerprint, world_fingerprint,\s*base_x, base_y, p_existing_x, p_existing_y\)/u);
  // No floating-point authority anywhere in the mirror.
  assert.doesNotMatch(stripSql(migration), /::float|::real|::double|random\(\)|sqrt\(|atan2|sin\(|cos\(|power\(/u);
  assert.doesNotMatch(placement, /similarity|score|confidence|keyword|embedding|viewport|zoom/u);
});

test('the per-CU integrated order and AF66-01 are structurally present in the writer', () => {
  const clock = writer.indexOf('FROM public.session_semantic_clocks c');
  const turn = writer.indexOf('FROM public.conversation_turns t');
  const loop = writer.indexOf('FOR idx IN 1 .. unit_count LOOP');
  const insert = writer.indexOf('INSERT INTO public.conversation_units (', loop);
  const head = writer.indexOf('SET current_sp = this_sp, same_sp_event_sequence = 0', loop);
  const reserveOne = writer.indexOf('reserve_session_same_sp_event_v1(p_session_id, p_user_id) r', loop);
  const focus = writer.indexOf('persist_conversation_unit_focus_semantics_v1(', loop);
  const gate = writer.indexOf('validate_conversation_thread_decision_v1(', loop);
  const world = writer.indexOf('FROM public.conversation_world_spatial_authorities w', loop);
  const compute = writer.indexOf('compute_canonical_home_placement_v1(', loop);
  const reserveTwo = writer.indexOf('reserve_session_same_sp_event_v1(p_session_id, p_user_id) r', world);
  const persistThread = writer.indexOf('persist_conversation_thread_establishment_v1(', loop);
  const endLoop = writer.indexOf('END LOOP;', persistThread);
  assert.ok(clock > 0 && turn > clock, 'AF66-01: the Session Semantic Clock is the FIRST lock');
  assert.ok(writer.indexOf('FOR UPDATE', clock) < turn, 'the clock lock is FOR UPDATE and precedes the source-turn lock');
  assert.ok(turn < loop && loop < insert && insert < head && head < reserveOne && reserveOne < focus && focus < gate,
    'per CU: SP insert -> open head -> seam reservation -> B1 bundle -> B2 gate');
  assert.ok(gate < world && world < compute && compute < reserveTwo && reserveTwo < persistThread && persistThread < endLoop,
    'per establishment: gate -> world lock -> canonical placement -> same-SP reservation -> atomic Thread insert');
  assert.ok(clock < world, 'the user-world spatial authority is NEVER locked before the Session Semantic Clock');
  assert.equal((writer.match(/FOR UPDATE/gu) ?? []).length, 3, 'exactly three row locks: the Session clock, the source turn and the user world');
  assert.equal((writer.match(/conversation_world_spatial_authorities w\s+WHERE w\.user_id = turn_row\.user_id\s+FOR UPDATE/gu) ?? []).length, 1,
    'exactly one user-world lock');
  assert.equal((stripSql(writer).match(/reserve_session_same_sp_event_v1/gu) ?? []).length, 2,
    'the writer reuses the ONE T-03A2 seam: once for B1, once for the whole B2 event');
  assert.doesNotMatch(stripSql(writer), /same_sp_event_sequence \+ 1/u, 'the writer never increments the same-SP sequence itself');
  assert.match(writer, /reserved_sequence IS DISTINCT FROM 1::bigint/u);
  assert.match(writer, /reserved_sequence IS DISTINCT FROM 2::bigint/u);
  // A NO_ESTABLISHMENT reserves nothing at all.
  assert.match(writer, /IF \(decision ->> 'decision'\) = 'ESTABLISH_THREAD' THEN/u);
  const noBranch = writer.slice(gate, world);
  assert.doesNotMatch(noBranch, /reserve_session_same_sp_event_v1|INSERT INTO public\.conversation_threads/u,
    'a truthful non-establishment reserves no same-SP event and inserts no Thread');
  // No caller coordinate reaches any signature; SP and the sequence are DB-allocated.
  for (const signature of [...migration.matchAll(/CREATE FUNCTION public\.(\w+)\(([\s\S]*?)\)\s*(?:RETURNS|LANGUAGE)/gu)]) {
    const [, name, args] = signature;
    if (name.startsWith('osdap_') || name === 'compute_canonical_home_placement_v1' || name === 'persist_conversation_thread_establishment_v1') continue;
    assert.doesNotMatch(args, /p_placement|p_home_x|p_home_y|p_coordinate|p_world_fingerprint|p_attempt/u, `${name} accepts no caller-authored placement`);
    assert.doesNotMatch(args, /p_same_sp_event_sequence\b|p_session_position\b|p_sp\b|p_live_head/u, `${name} accepts no caller-authored SP or sequence`);
  }
  // The Home is written once, by the persistence helper, with the values the
  // database computed; there is no relocation or update path anywhere.
  assert.equal((executableSql.match(/INSERT INTO public\.conversation_thread_homes/gu) ?? []).length, 1);
  assert.doesNotMatch(executableSql, /UPDATE public\.conversation_thread_homes|UPDATE public\.conversation_threads|DELETE FROM public\.conversation_thread/u);
  assert.match(persist, /INSERT INTO public\.conversation_threads[\s\S]*INSERT INTO public\.conversation_thread_homes[\s\S]*INSERT INTO public\.conversation_thread_establishment_events[\s\S]*INSERT INTO public\.conversation_thread_establishment_evidence[\s\S]*INSERT INTO public\.conversation_thread_origin_members/u,
    'Thread, Home, event, evidence and origin provenance are inserted in one helper, in one transaction');
});

test('the database re-proves every deterministic T-03B2a gate and every NO_ESTABLISHMENT state', () => {
  assert.match(validator, /jsonb_object_keys\(p_decision\)\) <> 12/u, 'the canonical decision has exactly twelve keys');
  assert.match(validator, /decision NOT IN \('NO_ESTABLISHMENT', 'ESTABLISH_THREAD'\)/u);
  assert.match(validator, /attention_kind NOT IN \('START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS'\)/u);
  assert.match(validator, /focus_id IS DISTINCT FROM attention_focus/u, 'the target is exactly the B1 attention focus');
  assert.match(validator, /THREAD_FOCUS_ALREADY_ESTABLISHED/u);
  assert.match(validator, /FUTURE_OR_FOREIGN_THREAD_EVIDENCE/u);
  assert.match(validator, /THREAD_EVIDENCE_NOT_FOCUS_BOUND/u);
  assert.match(validator, /CURRENT_CU_THREAD_EVIDENCE_REQUIRED/u);
  assert.match(validator, /DUPLICATE_THREAD_EVIDENCE/u);
  // TE-01
  assert.match(validator, /p_cu\.source_role <> 'USER'/u);
  assert.match(validator, /EXPLICIT_SELECTION_ROLE_FORBIDDEN/u);
  assert.match(validator, /public\.validate_conversation_focus_anchor_v1\(p_cu\.committed_text, grounding\)/u,
    'the selection is validated against the committed wording in code-point coordinates');
  assert.match(validator, /c\.claim_frame IN \('REPORTED_SPEECH', 'DIRECT_QUOTATION'\)\s*\n\s*AND a_start >= c\.span_start AND a_end <= c\.span_end/u,
    'a selection wholly inside attributed wording is refused');
  assert.match(validator, /ATTRIBUTED_SELECTION_FORBIDDEN/u);
  // TE-02
  assert.match(validator, /evidence_count < 2/u);
  assert.match(validator, /INSUFFICIENT_SUSTAINED_THREAD_EVIDENCE/u);
  assert.match(validator, /USER_THREAD_EVIDENCE_REQUIRED/u);
  assert.doesNotMatch(stripProse(validator), /interval|age\(|EXTRACT\(|threshold|score|similarity/u, 'no time threshold and no score exists on any path');
  // TE-03: the recurrence boundary is derived from the FULL canonical history.
  assert.match(validator, /attention_reason = 'LOCAL_CLARIFICATION_OR_CORRECTION'/u);
  assert.match(validator, /ORDER BY e\.session_position DESC, e\.same_sp_event_sequence DESC\s*\n\s*LIMIT 1;/u,
    'the boundary is the LATEST prior START/ATTEND of the target focus');
  assert.match(validator, /NOT \(boundary_cu = ANY \(prior_ids\)\)/u, 'that exact CU must itself be cited');
  assert.match(validator, /e\.session_position > boundary_sp AND e\.session_position < p_cu\.session_position/u);
  assert.match(validator, /e\.emerging_focus_id IS DISTINCT FROM focus_id\s*\n\s*AND e\.attention_reason <> 'LOCAL_CLARIFICATION_OR_CORRECTION'/u);
  assert.match(validator, /THREAD_RECURRENCE_NOT_PROVEN/u);
  // The three NO_ESTABLISHMENT states.
  assert.match(validator, /reason NOT IN \('NO_INDEPENDENT_FOCUS', 'ALREADY_ESTABLISHED', 'NO_PROMOTION_PATH_PROVEN'\)/u);
  assert.match(validator, /attention_kind <> 'NO_INDEPENDENT_FOCUS' OR focus_id IS NOT NULL/u);
  assert.match(validator, /\(reason = 'ALREADY_ESTABLISHED'\) <> already_established/u,
    'ALREADY_ESTABLISHED and NO_PROMOTION_PATH_PROVEN are decided by the canonical lineage, not by the caller');
  assert.match(validator, /THREAD_NO_ESTABLISHMENT_MISMATCH/u);
  // Conversational Origin stays provenance.
  assert.match(validator, /origin_state = 'RESOLVED' AND cardinality\(origin_ids\) <> 1/u);
  assert.match(validator, /origin_state IN \('MULTIPLE', 'AMBIGUOUS'\) AND cardinality\(origin_ids\) < 2/u);
  assert.match(validator, /THREAD_ORIGIN_ORDER_NOT_CANONICAL/u);
  assert.match(validator, /UNKNOWN_THREAD_ORIGIN_MEMBER/u);
  assert.doesNotMatch(validator, /parent|primary_origin|edge_direction/u);
});

test('replay, conflict and partial state are exact, and the zero-CU batch is complete', () => {
  assert.match(writer, /IF NOT commit_batch_exists AND NOT focus_batch_exists AND NOT thread_batch_exists THEN/u,
    'a new integrated batch is allowed only when NO layer exists yet');
  assert.match(writer, /IF NOT \(commit_batch_exists AND focus_batch_exists AND thread_batch_exists\) THEN[\s\S]*?THREAD_CAPTURE_BATCH_INTEGRITY/u,
    'existing CU or B1 truth without a B2 capture fails closed instead of being upgraded');
  assert.match(writer, /THREAD_BATCH_PAYLOAD_CONFLICT/u);
  assert.match(writer, /thread_batch_row\.canonical_fingerprint IS DISTINCT FROM thread_fingerprint/u);
  assert.match(writer, /IF unit_count = 0 THEN\s*\n\s*RETURN;/u, 'a zero-CU batch allocates no SP and no sequence');
  // The capture fingerprint excludes allocation results.
  const fingerprint = writer.slice(writer.indexOf('thread_canonical := jsonb_build_object('), writer.indexOf('thread_fingerprint := sha256'));
  for (const excluded of ['session_position', 'same_sp_event_sequence', 'created_at', 'placement_x', 'placement_y', 'attempt', 'world_fingerprint']) {
    assert.equal(fingerprint.includes(excluded), false, `the capture fingerprint must exclude ${excluded}`);
  }
  for (const included of ['establishment_count', 'thread_units', 'thread_evaluator_version', 'thread_policy_version', 'thread_provider', 'thread_model', 'thread_prompt_version', 'thread_schema_version']) {
    assert.ok(fingerprint.includes(included), `the capture fingerprint must include ${included}`);
  }
  // The finalized-exchange rules are preserved verbatim.
  assert.match(coordinator, /p_expected_current_sp integer,\s*\n\s*p_expected_same_sp_event_sequence bigint/u);
  assert.match(coordinator, /USING ERRCODE='40001'/u);
  assert.match(coordinator, /INVALID_FINALIZED_EXCHANGE_RELATION/u);
  const stale = coordinator.indexOf("RAISE EXCEPTION 'STALE_CONVERSATIONAL_FOCUS_CONTEXT'");
  const write = coordinator.indexOf('public.commit_conversation_units_with_focus_and_thread_v1(');
  assert.ok(stale > 0 && write > stale, 'the token is checked before any canonical mutation');
  assert.doesNotMatch(coordinator.slice(0, stale), /INSERT INTO|UPDATE public/u, 'nothing is written before the token check');
  assert.doesNotMatch(coordinator, /conversation_world_spatial_authorities/u, 'the coordinator never takes the world lock itself');
});

test('the whole slice is production-inert and leaves the T-03A2 and T-03B1b1 posture untouched', () => {
  assert.doesNotMatch(executableSql, /GRANT /u, 'the migration grants nothing');
  for (const fn of ['commit_conversation_units_with_focus_and_thread_v1', 'commit_finalized_exchange_with_focus_and_thread_v1',
    'validate_conversation_thread_decision_v1', 'persist_conversation_thread_establishment_v1',
    'compute_canonical_home_placement_v1', 'osdap_search_admissible_placement_v1']) {
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\)\\s*\\n?\\s*FROM service_role`, 'u'), `${fn} is revoked from service_role`);
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\)\\s*\\n?\\s*FROM PUBLIC, anon, authenticated`, 'u'), `${fn} is revoked from anon and authenticated`);
  }
  assert.match(migration, /T-03B2b2 is production-inert: % must not execute %/u);
  assert.match(migration, /T-03B2b2 must leave the T-03A2 service_role grants exactly in place/u);
  assert.match(migration, /the Thread substrate must stay unreachable/u);
  assert.match(migration, /T-03B2b2 creates a forward-only substrate and backfills nothing/u);
  assert.match(migration, /T-03B2b2 must not alter the Session Semantic Clock/u);
  assert.doesNotMatch(executableSql, /reserve_session_same_sp_event_v1\(uuid,uuid\) TO /u, 'the T-03A2 seam stays internal');
  assert.match(migration, /same_sp_helper constant text := 'public\.reserve_session_same_sp_event_v1\(uuid,uuid\)'/u);
  // The 0066 writer and coordinator stay ungranted too.
  assert.match(migration, /focus_writer constant text := 'public\.commit_conversation_units_with_focus_v1/u);
  assert.match(migration, /focus_coordinator constant text := 'public\.commit_finalized_exchange_with_focus_v1/u);
});

test('the gates are registered at the root and in API CI', () => {
  const scripts = JSON.parse(packageJson).scripts;
  assert.equal(scripts['verify:durable-thread-home-same-sp-substrate:integration'], 'node --env-file-if-exists=.env database/verify-migration-0068.mjs');
  assert.equal(scripts['test:durable-thread-home-same-sp-substrate-contract'], 'node --test tests/durable-thread-home-same-sp-substrate-contract.test.mjs');
  assert.match(workflow, /run: npm run verify:durable-thread-home-same-sp-substrate:integration/u);
  assert.ok(workflow.indexOf('verify:durable-thread-home-same-sp-substrate:integration')
    > workflow.indexOf('verify:conversation-focus-runtime-integration-readiness:integration'),
    'the 0068 verifier runs after the 0067 verifier');
  assert.equal((workflow.match(/verify:durable-thread-home-same-sp-substrate:integration/gu) ?? []).length, 1);
  assert.match(verifier, /compute_canonical_home_placement_v1/u, 'the verifier exercises the deployed placement engine');
  assert.match(verifier, /CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED/u);
  assert.match(verifier, /GOLDEN_VECTORS/u);
});
