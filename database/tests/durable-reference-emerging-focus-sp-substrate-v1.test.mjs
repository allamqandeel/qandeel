import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// T-03B1b1 - Durable Reference / Emerging Focus SP-Native Substrate +
// Per-Moment Integrated DB Writer: the static database contract. Live
// semantics are proven against real PostgreSQL by
// database/verify-migration-0066.mjs.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const migration = read('../migrations/0066_durable_reference_emerging_focus_sp_substrate_v1.sql');
const substrate = read('../migrations/0064_committed_conversational_unit_substrate_v1.sql');
const activation = read('../migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql');
const activationVerifier = read('../verify-migration-0065.mjs');
const verifier = read('../verify-migration-0066.mjs');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const section = (from, to) => {
  const start = migration.indexOf(from);
  const end = to === undefined ? migration.length : migration.indexOf(to);
  assert.ok(start >= 0 && (to === undefined || end > start), `section ${from} was located`);
  return migration.slice(start, end).split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
};
const SELF_ASSERTION_MARKER = '-- 15. Terminal self-assertions.';
const executableBody = migration.slice(0, migration.indexOf(SELF_ASSERTION_MARKER))
  .split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const migrationLevelSql = executableBody.split(/\$\$[\s\S]*?\$\$/gu).join('\n');
const anchorValidator = section('CREATE FUNCTION public.validate_conversation_focus_anchor_v1', '-- 10. Persisting ONE CU');
const persist = section('CREATE FUNCTION public.persist_conversation_unit_focus_semantics_v1', '-- 11. The integrated per-Moment writer');
const writer = section('CREATE FUNCTION public.commit_conversation_units_with_focus_v1', '-- 12. The atomic finalized-exchange coordinator');
const coordinator = section('CREATE FUNCTION public.commit_finalized_exchange_with_focus_v1', '-- 13. The internal authoritative focus-context snapshot');
const context = section('CREATE FUNCTION public.get_conversation_focus_runtime_context_v1', '-- 14. Ownership, search_path hardening');

function gitBlobId(content) {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

test('0066 is the ordered forward substrate migration and rewrites nothing historical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), '0066_durable_reference_emerging_focus_sp_substrate_v1.sql', '0066 is the newest migration');
  assert.ok(migrations.indexOf('0066_durable_reference_emerging_focus_sp_substrate_v1.sql')
    > migrations.indexOf('0065_session_semantic_clock_sp_lh_delivery_v1.sql'), '0066 orders after 0065');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  // 0064 and 0065 are frozen implementation inputs: byte-identical.
  assert.equal(gitBlobId(substrate), '0a2ee63980e59072b3e9f52a643efa8220e95b08', 'migration 0064 is byte-identical');
  assert.equal(gitBlobId(activation), '3dc061c71bcb237cec648abb2d1fa02f450cd57f', 'migration 0065 is byte-identical');
  assert.equal(gitBlobId(activationVerifier), '132841c718ba1e2368ecc639b49dadff82b79ddb', 'the 0065 verifier is byte-identical');
  assert.doesNotMatch(executableSql, /DROP (?:TABLE|FUNCTION|TRIGGER|CONSTRAINT|POLICY|COLUMN)|CREATE OR REPLACE FUNCTION/iu, 'nothing existing is dropped or replaced');
  assert.doesNotMatch(executableSql, /ALTER TABLE public\.(?:conversation_units|conversation_unit_commit_batches|session_semantic_clocks|conversation_unit_commit_events|conversation_turns|conversation_sessions|users)\b/u,
    'no T-03A1/A2 or conversation table is altered');
  assert.doesNotMatch(executableSql, /CREATE EXTENSION|CREATE SEQUENCE|GENERATED ALWAYS AS IDENTITY|bigserial|CREATE POLICY/iu);
  assert.deepEqual([...migrationLevelSql.matchAll(/INSERT INTO public\.(\w+)/gu)].map((m) => m[1]), [], 'the migration backfills nothing');
  assert.doesNotMatch(migrationLevelSql, /UPDATE public\.\w+ SET|DELETE FROM public\.\w+/u, 'the migration rewrites and deletes nothing');
  assert.match(migration, /current_setting\('server_encoding'\) <> 'UTF8'/u, 'the frozen UTF-8 contract still binds');
  assert.match(migration, /to_regprocedure\('public\.reserve_session_same_sp_event_v1\(uuid,uuid\)'\) IS NULL/u, 'the T-03A2 seam is a precondition');
});

test('0066 creates exactly the eight semantic tables, five functions and eight immutability triggers', () => {
  const tables = [...migration.matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(tables, [
    'conversation_claim_attributions', 'conversation_emerging_focus_attention_events', 'conversation_emerging_focuses',
    'conversation_focus_commit_batches', 'conversation_reference_handles', 'conversation_reference_resolution_candidates',
    'conversation_reference_resolutions', 'conversation_unit_focus_semantics']);
  const functions = [...migration.matchAll(/CREATE FUNCTION public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(functions, [
    'commit_conversation_units_with_focus_v1', 'commit_finalized_exchange_with_focus_v1',
    'get_conversation_focus_runtime_context_v1', 'persist_conversation_unit_focus_semantics_v1',
    'reject_conversation_focus_semantic_mutation_v1', 'validate_conversation_focus_anchor_v1']);
  const triggers = [...migration.matchAll(/CREATE TRIGGER (\w+)\s*\n\s*BEFORE UPDATE OR DELETE ON public\.(\w+)/gu)].map((m) => [m[1], m[2]]);
  assert.equal(triggers.length, 8, 'every semantic table is append-only');
  assert.deepEqual(triggers.map((t) => t[1]).sort(), tables);
  assert.match(migration, /CONVERSATIONAL_FOCUS_SEMANTIC_ROW_IS_IMMUTABLE/u);
  for (const table of tables) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} OWNER TO postgres`, 'u'));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'u'));
  }
});

test('the substrate carries stable ids, exact anchors, frozen vocabularies, and no Thread/LF/Home/score/label column', () => {
  const ddl = [...executableBody.matchAll(/CREATE TABLE public\.\w+ \(([\s\S]*?)\n\);/gu)].map((m) => m[1]).join('\n');
  assert.match(ddl, /grounding_handle_id uuid NOT NULL/u);
  assert.match(ddl, /CONSTRAINT emerging_focuses_grounding_unique UNIQUE \(session_id, grounding_handle_id\)/u,
    'one Emerging Focus per already-represented canonical locus');
  assert.match(ddl, /CONSTRAINT cu_focus_semantics_sp_unique UNIQUE \(session_id, session_position\)/u, 'one semantic bundle per SP');
  assert.match(ddl, /CONSTRAINT cu_focus_semantics_sp_fk\s*\n\s*FOREIGN KEY \(session_id, session_position\) REFERENCES public\.conversation_units \(session_id, session_position\)/u,
    'the bundle SP must be a real SP of the same Session');
  assert.match(ddl, /CHECK \(state IN \('RESOLVED','AMBIGUOUS','UNRESOLVED'\)\)/u);
  assert.match(ddl, /CHECK \(\(state = 'RESOLVED'\) = \(resolved_handle_id IS NOT NULL\)\)/u);
  assert.match(ddl, /CHECK \(claimant_kind IN \('CURRENT_CONVERSATIONAL_SPEAKER','REFERENCE_HANDLE','UNRESOLVED'\)\)/u,
    'NEW_CURRENT_CU_REFERENCE is structurally unrepresentable');
  assert.match(ddl, /CHECK \(attention_kind IN \('NO_INDEPENDENT_FOCUS','ATTEND_EXISTING_FOCUS','START_NEW_FOCUS'\)\)/u);
  assert.match(ddl, /functions <@ ARRAY\['INFORM_REPORT','ASK','REQUEST','ACKNOWLEDGE','AGREE','DISAGREE_CHALLENGE','ELABORATE',\s*'CLARIFY','CORRECT','RECALL','FOCUS_SHIFT','FUNCTION_UNRESOLVED'\]::text\[\]/u);
  assert.match(ddl, /NOT \('FUNCTION_UNRESOLVED' = ANY \(functions\)\) OR cardinality\(functions\) = 1/u);
  assert.match(ddl, /CHECK \(sequence_position IN \('UNMARKED','INITIATING','RESPONSIVE','FOLLOW_UP'\)\)/u);
  assert.match(ddl, /length\(anchor_text\) = span_end - span_start/u, 'anchor spans are exact code-point spans');
  // `\bknowledge` rather than `knowledge`: the frozen function ACKNOWLEDGE is
  // not a K/V column.
  assert.doesNotMatch(ddl, /thread|\bhome|live_focus|lifecycle|status|score|confidence|embedding|label|display_name|normalized|active|sealed|pre_first_sp|moment|timeline|\bknowledge/iu,
    'no Thread/Home/lifecycle/LF/K-V/score/label column exists');
  // The audit timestamps are the only timestamps, and nothing reads them.
  assert.doesNotMatch(executableBody.replace(/created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP/gu, ''), /timestamptz|CURRENT_TIMESTAMP|now\(\)|clock_timestamp/u,
    'no timestamp decides SP, identity, continuity, availability or ordering');
  assert.doesNotMatch(executableBody, /created_at\s*(?:<|>|=|DESC|ASC)/u, 'no created_at comparison or ordering exists');
});

test('the integrated writer preserves the whole 0064/0065 contract and interleaves each CU with its semantics', () => {
  for (const token of ['INVALID_COMMIT_IDENTITY', 'INVALID_UNIT_PAYLOAD', 'INVALID_COMMIT_PROVENANCE', 'FORBIDDEN',
    'UNSUPPORTED_SOURCE_ROLE', 'SOURCE_TURN_NOT_COMMITTABLE', 'UNSUPPORTED_SOURCE_MODALITY',
    'SPAN_OUT_OF_RANGE', 'SPAN_NOT_FORWARD_ORDERED', 'SPAN_BEFORE_SOURCE_FRONTIER']) {
    assert.ok(writer.includes(token), `the writer still raises ${token}`);
  }
  assert.match(writer, /sha256\(convert_to\(turn_row\.content, 'UTF8'\)\)/u);
  assert.match(writer, /fingerprint := sha256\(convert_to\(canonical::text, 'UTF8'\)\);/u, 'the commitment fingerprint is DB-derived exactly as 0065 derives it');
  assert.match(writer, /focus_fingerprint := sha256\(convert_to\(focus_canonical::text, 'UTF8'\)\);/u, 'the semantic fingerprint is DB-derived');
  const focusCanonical = writer.slice(writer.indexOf('focus_canonical := jsonb_build_object'), writer.indexOf('focus_fingerprint :='));
  assert.doesNotMatch(focusCanonical, /session_position|same_sp_event_sequence|current_sp|created_at|CURRENT_TIMESTAMP/u,
    'SP, the same-SP sequence and audit time never participate in semantic batch identity');
  // AF66-01 and the per-CU loop, structurally.
  const clockLock = writer.indexOf('FROM public.session_semantic_clocks c');
  const turnLock = writer.indexOf('FROM public.conversation_turns t');
  assert.ok(clockLock > 0 && turnLock > clockLock && writer.indexOf('FOR UPDATE', clockLock) < turnLock, 'clock lock FOR UPDATE before the source turn');
  const loop = writer.indexOf('FOR idx IN 1 .. unit_count LOOP');
  const insert = writer.indexOf('INSERT INTO public.conversation_units (', loop);
  const head = writer.indexOf('SET current_sp = this_sp, same_sp_event_sequence = 0', loop);
  const reserve = writer.indexOf('FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r', loop);
  const check = writer.indexOf("reserved_sp IS DISTINCT FROM this_sp OR reserved_sequence IS DISTINCT FROM 1::bigint", loop);
  const persistCall = writer.indexOf('PERFORM public.persist_conversation_unit_focus_semantics_v1(', loop);
  const endLoop = writer.indexOf('END LOOP;', persistCall);
  const event = writer.indexOf('INSERT INTO public.conversation_unit_commit_events', endLoop);
  assert.ok(loop > 0 && insert > loop && head > insert && reserve > head && check > reserve && persistCall > check && endLoop > persistCall && event > endLoop,
    'per CU: insert with SP -> open head -> reserve through the seam -> require (SP, 1) -> persist bundle; delivery event after the loop');
  assert.equal((writer.match(/reserve_session_same_sp_event_v1/gu) ?? []).length, 1, 'the T-03A2 seam is the ONE sequence authority');
  assert.doesNotMatch(writer, /same_sp_event_sequence = c\.same_sp_event_sequence \+ 1|same_sp_event_sequence \+ 1/u, 'the writer never increments the sequence itself');
  assert.match(writer, /IF unit_count = 0 THEN\s*\n\s*RETURN;\s*\n\s*END IF;/u, 'a zero-CU batch reserves nothing and writes no semantic row');
  // Replay delegates commitment identity to the canonical 0065 producer and fails closed on partial semantic state.
  assert.match(writer, /PERFORM \* FROM public\.commit_conversation_units_v1\(/u);
  assert.match(writer, /FOCUS_SEMANTIC_BATCH_INTEGRITY/u);
  assert.match(writer, /FOCUS_BATCH_PAYLOAD_CONFLICT/u);
  assert.match(writer, /FOCUS_UNIT_MAPPING_MISMATCH/u);
  assert.match(writer, /INVALID_FOCUS_PROVENANCE/u);
  // No caller-supplied SP or sequence parameter exists on any new function.
  for (const signature of [writer, coordinator, persist, context]) {
    const head_ = signature.slice(0, signature.indexOf('LANGUAGE plpgsql'));
    assert.doesNotMatch(head_, /p_sp\b|p_session_position|p_same_sp_event_sequence\b(?!.*expected)|p_event_sequence bigint\)|p_live_head|p_fingerprint/u,
      'no caller supplies SP, sequence, LH or fingerprint');
  }
  assert.match(persist, /p_event_sequence bigint/u, 'the internal persistence helper receives the sequence the seam allocated');
  assert.doesNotMatch(coordinator.slice(0, coordinator.indexOf('LANGUAGE plpgsql')), /\bp_event_sequence\b|\bp_session_position\b|\bp_same_sp_event_sequence\b/u,
    'the coordinator accepts an EXPECTED token only, never an allocation');
});

test('the database revalidates every element of the canonical semantic payload', () => {
  for (const token of ['INVALID_FOCUS_PAYLOAD', 'INVALID_FOCUS_FUNCTION', 'UNKNOWN_TARGET_CU', 'NON_EXTRACTIVE_REFERENCE',
    'OCCURRENCE_OUT_OF_RANGE', 'INVALID_REFERENCE_CARDINALITY', 'UNKNOWN_REFERENCE_HANDLE', 'REFERENCE_HANDLE_ALREADY_GROUNDED',
    'INVALID_CLAIM_ATTRIBUTION', 'UNKNOWN_FOCUS_CANDIDATE', 'FOCUS_GROUNDING_REQUIRED', 'EXISTING_FOCUS_CONTINUITY_REQUIRED',
    'EMERGING_FOCUS_ALREADY_EXISTS', 'UNGROUNDED_FOCUS_CONTINUITY', 'SAME_SP_SEQUENCE_INTEGRITY']) {
    assert.ok(persist.includes(token) || writer.includes(token) || anchorValidator.includes(token), `the boundary raises ${token}`);
  }
  assert.match(persist, /t\.session_position < p_cu\.session_position/u, 'a target is a PRIOR same-Session CU');
  assert.match(anchorValidator, /substring\(p_committed_text from span_start \+ 1 for span_end - span_start\) <> anchor_text/u,
    'the database proves the anchor is the exact committed wording at the span');
  assert.match(anchorValidator, /anchor_occurrence <> earlier \+ 1/u, 'the named occurrence must be the repetition at the span');
  assert.doesNotMatch(anchorValidator, /lower\(|unaccent|translate\(|regexp_replace|similarity|levenshtein/iu, 'no normalization or fuzzy matching');
  assert.match(persist, /ref_state = 'RESOLVED' THEN\s*\n\s*IF ref_handle IS NULL OR cardinality\(ref_candidates\) <> 0/u);
  assert.match(persist, /count\(DISTINCT c\) FROM unnest\(ref_candidates\) AS d\(c\)\) < 2/u, 'AMBIGUOUS needs at least two distinct candidates');
  assert.match(persist, /claimant_kind NOT IN \('CURRENT_CONVERSATIONAL_SPEAKER', 'REFERENCE_HANDLE', 'UNRESOLVED'\)/u);
  assert.match(persist, /f\.session_id = p_cu\.session_id AND f\.grounding_handle_id = grounding_handle/u, 'an already-represented locus is attended, never minted twice');
  assert.match(persist, /grounding_handle IS DISTINCT FROM focus_grounding_handle/u, 'an ATTEND link must name the handle that grounds the focus');
  assert.match(persist, /current_focus IS DISTINCT FROM focus_id\s*\n\s*OR EXISTS \(SELECT 1 FROM unnest\(ref_states\) AS s\(state\) WHERE s\.state <> 'RESOLVED'\)/u,
    'identity-free continuation requires the current focus and a reference-clean CU');
  assert.match(persist, /~\* uuid_shape/u, 'only canonical UUID identities are representable; prepared ids fail closed');
  assert.doesNotMatch(persist, /prepared:|score|embedding|similarity|keyword|lower\(|unaccent|levenshtein|normalize/iu, 'no shortcut and no normalization');
});

test('the coordinator locks the one clock first, proves the relation, then checks the token before any mutation', () => {
  const clock = coordinator.indexOf('FROM public.session_semantic_clocks c');
  const user = coordinator.indexOf('INTO user_turn_row');
  const assistant = coordinator.indexOf('INTO assistant_turn_row');
  const relation = coordinator.indexOf('INVALID_FINALIZED_EXCHANGE_RELATION');
  const stale = coordinator.indexOf('STALE_CONVERSATIONAL_FOCUS_CONTEXT');
  const first = coordinator.indexOf('public.commit_conversation_units_with_focus_v1(');
  assert.ok(clock > 0 && clock < user && user < assistant && assistant < relation && relation < stale && stale < first,
    'clock -> USER row -> ASSISTANT row -> relation gate -> token check -> writer calls');
  assert.equal((coordinator.match(/FROM public\.session_semantic_clocks c\s+WHERE[^;]*FOR UPDATE/gu) ?? []).length, 1, 'one Session clock per semantic transaction');
  assert.match(coordinator, /p_expected_current_sp integer,\s*\n\s*p_expected_same_sp_event_sequence bigint/u);
  assert.match(coordinator, /clock_row\.current_sp IS DISTINCT FROM p_expected_current_sp\s*\n\s*OR clock_row\.same_sp_event_sequence IS DISTINCT FROM p_expected_same_sp_event_sequence/u);
  assert.match(coordinator, /USING ERRCODE='40001'/u, 'a stale context is a concurrency condition, not a lifecycle failure');
  assert.match(coordinator, /IF NOT both_exist\s*\n\s*AND \(clock_row\.current_sp IS DISTINCT FROM/u, 'an exact replay of an already-committed pair needs no token');
  for (const clause of ["user_turn_row.role <> 'USER'", "assistant_turn_row.role <> 'ASSISTANT'", 'assistant_turn_row.source_turn_id IS DISTINCT FROM user_turn_row.id']) {
    assert.ok(coordinator.includes(clause), `the relation gate requires: ${clause}`);
  }
  assert.doesNotMatch(coordinator, /PRE_FIRST_SP/u, 'the (NULL, 0) token is a technical absence, never PRE_FIRST_SP');
  const userCall = coordinator.indexOf('p_user_source_turn_id, p_user_batch_id, p_user_units');
  const assistantCall = coordinator.indexOf('p_assistant_source_turn_id, p_assistant_batch_id, p_assistant_units');
  assert.ok(userCall > 0 && assistantCall > userCall, 'USER block before ASSISTANT block');
});

test('the context snapshot is owner-scoped, SP-ordered, closed over prior CUs and timestamp-free', () => {
  assert.match(context, /WHERE c\.session_id = p_session_id AND c\.user_id = p_user_id;\s*\n\s*IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'/u);
  assert.match(context, /ORDER BY cu\.session_position\)/u);
  assert.match(context, /ORDER BY r\.session_position, r\.reference_index/u);
  assert.match(context, /ORDER BY e\.session_position DESC, e\.same_sp_event_sequence DESC\s*\n\s*LIMIT 1/u, 'the current focus is the latest START/ATTEND');
  assert.match(context, /e\.attention_kind IN \('START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS'\)/u, 'NO_INDEPENDENT_FOCUS neither mints nor clears a focus');
  assert.match(context, /'grounding_handle_ids', jsonb_build_array\(f\.grounding_handle_id\)/u);
  assert.match(context, /'focus_candidate_id', f\.id/u, 'a FocusCandidate id is the durable emerging_focus_id');
  assert.doesNotMatch(context, /created_at|CURRENT_TIMESTAMP|now\(\)|clock_timestamp|auth\.uid|timeline|knowledge/u);
  assert.doesNotMatch(context, /FOR UPDATE/u, 'the snapshot is a read: the clock is never held across a provider call');
});

test('the posture is production-inert: nothing new is granted, and the T-03A2 grants are untouched', () => {
  assert.doesNotMatch(executableSql, /GRANT /u, 'the migration grants nothing to anybody');
  for (const signature of [
    'public\\.commit_conversation_units_with_focus_v1\\(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer\\)',
    'public\\.commit_finalized_exchange_with_focus_v1\\(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint\\)',
    'public\\.get_conversation_focus_runtime_context_v1\\(uuid,uuid\\)',
  ]) {
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION ${signature}\\s*\\n?\\s*FROM PUBLIC, anon, authenticated`, 'u'));
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION ${signature} FROM service_role`, 'u'));
  }
  assert.doesNotMatch(executableSql, /REVOKE [^;]*commit_conversation_units_v1\(|REVOKE [^;]*commit_finalized_exchange_conversation_units_v1\(|REVOKE [^;]*get_conversation_unit_commit_batch_snapshot_v1\(/u,
    'the T-03A2 service_role grants are neither revoked nor re-granted');
  assert.match(migration, /T-03B1b1 must leave the T-03A2 service_role grants exactly in place/u);
  assert.match(migration, /T-03B1b1 is production-inert: % must not execute %/u);
  for (const assertion of [
    'T-03B1b1 creates a forward-only substrate and backfills nothing',
    'every T-03B1b1 semantic table must be append-only',
    'T-03B1b1 introduces no Thread/Home/lifecycle/LF/K-V/score/label column',
    'T-03B1b1 requires UNIQUE(session_id, grounding_handle_id) on Emerging Focus',
    'T-03B1b1 functions must stay postgres-owned, SECURITY DEFINER and search_path-fixed',
    'the focus substrate must stay unreachable',
    'T-03B1b1 must not alter the Session Semantic Clock',
  ]) {
    assert.ok(migration.includes(assertion), `the migration self-asserts: ${assertion}`);
  }
});

test('every identifier 0066 introduces fits the PostgreSQL 63-byte limit', () => {
  const identifiers = [...migration.matchAll(/\b(?:TABLE|FUNCTION|CONSTRAINT|INDEX|TRIGGER)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gu)].map((m) => m[1]);
  assert.ok(identifiers.length > 0);
  const oversized = [...new Set(identifiers)].filter((name) => Buffer.byteLength(name, 'utf8') > 63);
  assert.deepEqual(oversized, [], `identifiers exceed PostgreSQL's 63-byte limit: ${oversized.join(', ')}`);
});

test('the 0066 verifier proves live semantics and is wired into the toolchain and CI', () => {
  for (const proof of ['AF66-01', 'pg_get_functiondef', 'STALE_CONVERSATIONAL_FOCUS_CONTEXT', 'BLOCKED', 'zero fixture residue',
    'CONVERSATIONAL_FOCUS_SEMANTIC_ROW_IS_IMMUTABLE', 'emerging_focuses_grounding_unique', 'cu_focus_semantics_sp_unique',
    'FOCUS_SEMANTIC_BATCH_INTEGRITY', 'FOCUS_BATCH_PAYLOAD_CONFLICT', 'COMMIT_BATCH_PAYLOAD_CONFLICT', 'FOCUS_UNIT_MAPPING_MISMATCH',
    'EXISTING_FOCUS_CONTINUITY_REQUIRED', 'EMERGING_FOCUS_ALREADY_EXISTS', 'UNGROUNDED_FOCUS_CONTINUITY', 'FOCUS_GROUNDING_REQUIRED',
    'INVALID_REFERENCE_CARDINALITY', 'UNKNOWN_REFERENCE_HANDLE', 'REFERENCE_HANDLE_ALREADY_GROUNDED', 'NON_EXTRACTIVE_REFERENCE',
    'OCCURRENCE_OUT_OF_RANGE', 'INVALID_CLAIM_ATTRIBUTION', 'NEW_CURRENT_CU_REFERENCE', 'INVALID_FOCUS_FUNCTION', 'UNKNOWN_TARGET_CU',
    'has_function_privilege', 'has_table_privilege', 'reserve_session_same_sp_event_v1', 'get_conversation_focus_runtime_context_v1',
    'commit_finalized_exchange_with_focus_v1', 'commit_conversation_units_with_focus_v1', 'permission denied', "session_replication_role = 'replica'",
    'prepared:reference:x:0', 'prepared:focus:x']) {
    assert.match(verifier, new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), `verifier is missing ${proof}`);
  }
  assert.match(packageJson, /"verify:durable-reference-emerging-focus-sp-substrate:integration": "node --env-file-if-exists=\.env database\/verify-migration-0066\.mjs"/u);
  assert.match(workflow, /run: npm run verify:durable-reference-emerging-focus-sp-substrate:integration/u);
  assert.ok(workflow.indexOf('run: npm run verify:durable-reference-emerging-focus-sp-substrate:integration')
    > workflow.indexOf('run: npm run verify:session-semantic-clock-sp-lh-delivery:integration'),
    'the substrate verifier runs after the T-03A2 activation verifier');
});
