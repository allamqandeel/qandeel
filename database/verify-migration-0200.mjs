// Real-PostgreSQL verifier for migration 0200 (COSMOS E-2 corrections, the Reading statement: the Personal projection V2
// discloses a Reading's own words exactly when QANDEEL may rely on it — PG-02 / INTEL-TM-01, 0151). No provider is
// called; everything runs in ONE transaction that is rolled back, so nothing is retained.
//
//   T0   catalogue: V2 is postgres-owned, SECURITY DEFINER, search_path-pinned, EXECUTE to authenticated only, returns
//        V1's row shape and gates through the 0151 core; V1 (0072) is not replaced
//   T1   fails closed: no caller, and another person, are refused exactly as V1 refuses them
//   T2   positive: while every Reading's evidence is CURRENT, each V2 Reading is V1's Reading with `evidenceChange` NONE
//        added, nothing else changed
//   T3   negative: after the evidence changes, a REVIEW_PENDING and a NO_REMAINING_SUPPORT Reading carry no statement,
//        no assumptions and no disconfirming conditions, and their evidence-change kind; a NONE Reading is unchanged
//   T4   the wire proof: no withheld word appears ANYWHERE in the V2 row (every column, serialised); the identity,
//        status, version, lineage and groundings of a withheld Reading stay (history is not erased)
//   T5   every other column of the row is V1's, byte for byte (only `threads`, `readings` and `confidences` differ)
//
// Honest limit: Confidence rows need the generation pipeline; the Confidence `assumptions` withholding is proven by the
// static SQL pins and the API mapper tests, and against real Confidence rows it is NOT TESTED here.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';
import { attributeFixtureSelf } from './verifier-memory-subject-fixture.mjs';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const client = new Client({ connectionString: process.env.DATABASE_URL });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}
async function outcomeOf(operation) {
  await q('SAVEPOINT s');
  try {
    return { rows: await operation() };
  } catch (error) {
    return { code: error.code, message: error.message };
  } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
}

const V1 = 'public.get_session_historical_projection_v1(uuid,integer)';
const V2 = 'public.get_session_historical_projection_v2(uuid,integer)';
const project = async (version, owner, session, tc) => {
  await identity('authenticated', owner);
  const result = await rows(`SELECT * FROM public.get_session_historical_projection_${version}($1, $2)`, [session, tc]);
  await identity('postgres');
  return result;
};
const change = async (id) => (await rows(`SELECT public.hypothesis_evidence_change_core_v1(h.user_id, h.id, h.supporting_evidence_ids,
  h.contradicting_evidence_ids, CURRENT_TIMESTAMP) AS value FROM public.hypotheses h WHERE h.id = $1`, [id]))[0].value;

async function human() {
  const id = randomUUID();
  await identity('postgres');
  await q('INSERT INTO auth.users(id) VALUES ($1)', [id]);
  return id;
}
async function memory(owner, label) {
  const id = randomUUID();
  await q(`INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status)
           VALUES ($1, $2, 'PERSONAL_FACT', $3, 'USER_STATED', 0.9, 0.8, 'ACTIVE')`, [id, owner, `verifier-0200 ${label} ${id.slice(0, 8)}`]);
  await attributeFixtureSelf(client, id, owner);
  return id;
}
const forget = (owner, memoryId) => rows('SELECT id FROM public.server_mark_memory_deleted_v1($1, $2)', [owner, memoryId]);

/** A COVERED Session with two committed units (SP 1, 2), inserted exactly as the Replay verifiers build one. */
async function conversation(owner) {
  const session = randomUUID();
  const turn = randomUUID();
  const batch = randomUUID();
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, owner]);
  const message = 'verifier-0200 message';
  await q("INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content) VALUES ($1, $2, $3, 'USER', 'COMPLETED', $4)",
    [turn, session, owner, message]);
  await q(`INSERT INTO public.conversation_unit_commit_batches
             (id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256, unit_count, evaluator_version,
              policy_version, segmentation_provider, segmentation_model, segmentation_prompt_version)
           VALUES ($1, $2, $3, $4, sha256($5::bytea), sha256($5::bytea), 2, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
  [batch, owner, session, turn, Buffer.from(`${session}:${message}`, 'utf8')]);
  for (let sp = 1; sp <= 2; sp += 1) {
    const body = `${message}, sentence ${sp}`;
    await q(`INSERT INTO public.conversation_units
               (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state, source_modality,
                ordinal_within_turn, source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
             VALUES ($1, $2, $3, $4, $5, 'USER', 'RESOLVED', 'TEXT', $6, 0, $7, $8, sha256(convert_to($8, 'UTF8')), $9)`,
    [randomUUID(), owner, session, turn, batch, sp - 1, [...body].length, body, sp]);
  }
  await q('UPDATE public.session_semantic_clocks SET current_sp = 2 WHERE session_id = $1', [session]);
  const [{ baseline }] = await rows('SELECT baseline_world_version::bigint AS baseline FROM public.session_historical_baselines WHERE session_id = $1', [session]);
  return { session, baseline: Number(baseline) };
}

/** A Reading known from SP 1, with sentinel words that must never cross while it is withheld. */
async function reading(owner, world, label, supporting, offset) {
  const id = randomUUID();
  const words = { statement: `SENTINEL-STATEMENT-${label}-${id.slice(0, 8)}`, assumption: `SENTINEL-ASSUMPTION-${label}`,
    condition: `SENTINEL-CONDITION-${label}` };
  await q("SET LOCAL session_replication_role = 'replica'");
  try {
    await q(`INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, status, version,
               supporting_evidence_ids, assumptions, disconfirming_conditions)
             VALUES ($1, $2, $3, 'CAUSAL', 'GENERAL', $4, 'SYSTEM_GENERATED', 'CANDIDATE', 1, $5, ARRAY[$6], ARRAY[$7])`,
    [id, owner, words.statement, `CONVERSATION_SESSION:${world.session}`, supporting.map((m) => `memory:${m}`), words.assumption, words.condition]);
    await q(`INSERT INTO public.historical_reading_events
               (event_id, user_id, hypothesis_id, event_kind, from_status, to_status, from_version, to_version,
                session_id, session_position, same_sp_event_sequence, world_version)
             VALUES ($1, $2, $3, 'CREATED', NULL, 'CANDIDATE', NULL, 1, $4, 1, 0, $5)`,
    [randomUUID(), owner, id, world.session, world.baseline + offset]);
  } finally {
    await q("SET LOCAL session_replication_role = 'origin'");
  }
  return { id, words };
}

const byId = (list) => Object.fromEntries(list.map((entry) => [entry.id, entry]));
const OTHER_COLUMNS = ['session_id', 'live_head', 'tc', 'sealed', 'revision', 'moments', 'emerging_focuses', 'live_focus',
  'thread_reading_appearances', 'reading_relations', 'evidence_participations', 'materials', 'gaps', 'questions', 'question_appearances'];

try {
  await client.connect();
  await q('BEGIN');

  stage = 'T0 catalogue';
  const [catalogue] = await rows(
    `SELECT p.prosecdef, r.rolname AS owner, EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') AS pinned,
            has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can,
            pg_get_function_result(p.oid) = pg_get_function_result($2::text::regprocedure) AS same_shape,
            position('hypothesis_evidence_change_core_v1' IN p.prosrc) > 0 AS gated
       FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner WHERE p.oid = $1::text::regprocedure`, [V2, V1]);
  assert.deepEqual(catalogue, { prosecdef: true, owner: 'postgres', pinned: true, anon_can: false, authenticated_can: true, same_shape: true, gated: true });
  if ((await rows("SELECT 1 FROM pg_roles WHERE rolname = 'service_role'")).length === 1) {
    const [{ can }] = await rows("SELECT has_function_privilege('service_role', $1::text::regprocedure, 'EXECUTE') AS can", [V2]);
    assert.equal(can, false, 'service_role does not execute V2');
  }
  const [{ v1gated }] = await rows("SELECT position('hypothesis_evidence_change_core_v1' IN prosrc) > 0 AS v1gated FROM pg_proc WHERE oid = $1::text::regprocedure", [V1]);
  assert.equal(v1gated, false, 'V1 (0072) is not replaced: the gate is V2\'s alone');

  stage = 'fixture';
  const owner = await human();
  const stranger = await human();
  const world = await conversation(owner);
  const [kept, gone, only] = [await memory(owner, 'kept'), await memory(owner, 'gone'), await memory(owner, 'only')];
  const relied = await reading(owner, world, 'NONE', [kept], 1);
  const review = await reading(owner, world, 'REVIEW', [kept, gone], 2);
  const unsupported = await reading(owner, world, 'UNSUPPORTED', [only], 3);
  const all = [relied, review, unsupported];

  stage = 'T1 fails closed as V1 does';
  await identity('postgres');
  const noCaller = async (version) => outcomeOf(async () => { await identity('authenticated', null); return rows(`SELECT * FROM public.get_session_historical_projection_${version}($1, 2)`, [world.session]); });
  const refusedNoCaller = await noCaller('v2');
  assert.ok(refusedNoCaller.code, 'no caller is refused');
  assert.deepEqual(refusedNoCaller, await noCaller('v1'), 'refused exactly as V1 refuses');
  await identity('postgres');
  const asStranger = async (version) => outcomeOf(() => project(version, stranger, world.session, 2));
  const strangerV2 = await asStranger('v2');
  assert.deepEqual(strangerV2, await asStranger('v1'), 'another person is answered exactly as V1 answers them');
  assert.ok(strangerV2.code || strangerV2.rows.length === 0, 'and learns nothing');
  await identity('postgres');

  stage = 'T2 positive: every Reading relied on';
  for (const entry of all) assert.equal(await change(entry.id), 'NONE');
  const [before1] = await project('v1', owner, world.session, 2);
  const [before2] = await project('v2', owner, world.session, 2);
  assert.ok(before1 && before2, 'the owner reads the Session at TC 2');
  const v1Before = byId(before1.readings);
  const v2Before = byId(before2.readings);
  for (const entry of all) {
    assert.ok(v1Before[entry.id], 'the Reading is known at TC');
    assert.deepEqual(v2Before[entry.id], { ...v1Before[entry.id], evidenceChange: 'NONE' }, 'a relied-on Reading is V1\'s, with NONE added');
    assert.equal(v2Before[entry.id].statement, entry.words.statement);
  }

  stage = 'T3 negative: evidence changed';
  await forget(owner, gone);
  await forget(owner, only);
  assert.equal(await change(relied.id), 'NONE');
  assert.equal(await change(review.id), 'REVIEW_PENDING');
  assert.equal(await change(unsupported.id), 'NO_REMAINING_SUPPORT');
  const [after1] = await project('v1', owner, world.session, 2);
  const [after2] = await project('v2', owner, world.session, 2);
  const v1After = byId(after1.readings);
  const v2After = byId(after2.readings);
  assert.deepEqual(v2After[relied.id], { ...v1After[relied.id], evidenceChange: 'NONE' }, 'the relied-on Reading is unchanged');
  for (const [entry, kind] of [[review, 'REVIEW_PENDING'], [unsupported, 'NO_REMAINING_SUPPORT']]) {
    assert.deepEqual(v2After[entry.id], { ...v1After[entry.id], statement: null, assumptions: [], disconfirmingConditions: [], evidenceChange: kind },
      `a ${kind} Reading carries no words of its own and its evidence-change kind; everything else is V1's`);
    assert.equal(v1After[entry.id].statement, entry.words.statement, 'V1 itself is frozen (0072): the gate is V2\'s');
  }
  assert.deepEqual(after2.readings.map((r) => r.id), after1.readings.map((r) => r.id), 'the same Readings in the same order: nothing erased');

  stage = 'T4 the wire proof';
  const wire = JSON.stringify(after2);
  for (const entry of [review, unsupported]) {
    for (const word of Object.values(entry.words)) assert.equal(wire.includes(word), false, `the withheld "${word}" never reaches the V2 row`);
  }
  for (const word of Object.values(relied.words)) assert.equal(wire.includes(word), true, `the relied-on "${word}" is disclosed`);

  stage = 'T5 every other column is V1\'s';
  for (const column of OTHER_COLUMNS) assert.deepEqual(after2[column], after1[column], `${column} is V1's`);
  assert.deepEqual(after2.confidences, after1.confidences, 'no Confidence row exists here, so the column is V1\'s');

  await q('ROLLBACK');
  console.log('migration 0200 verified');
} catch (error) {
  try { await q('ROLLBACK'); } catch { /* the connection may be gone */ }
  console.error(`verify-migration-0200 failed at stage "${stage}"`);
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
