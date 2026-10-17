// ACCT-DEL-01 / migration 0164 - real-PostgreSQL proof of the governed account erasure across Matching / Introductions.
//
//   A  posture: one service_role entry and nothing else reaches the erasure; the twenty narrowed guards are their prior
//      bodies byte for byte after exactly one prefix; the GUC alone and the authorization alone each still refuse; the
//      coverage registry is complete (every relation that references the account, or a relation the erasure deletes
//      from, is registered; a planted RESTRICT relation is caught); the static census probes every residue column; the
//      release gate names every uncovered class and its owner; 0130 and every RESTRICT are unchanged; CW2-08 closed
//   E  behaviour, each in its own SAVEPOINT of one rolled-back transaction:
//        E01  the maximum footprint is ERASED with zero references left; the counterpart keeps exactly their own words,
//             reads, lists and deletes them, sees an ordinary END, and keeps an exact Matching lineage
//        E02  an uncovered footprint (Shared STANDARD, Public) is BLOCKED by the census and nothing is touched
//        E03  0130 refusing AFTER the module ran (a planted unregistered reference) rolls EVERYTHING back - Matching,
//             the counterpart's END, the retained view, the queued keys - and answers RETRY; three in a row are BLOCKED
//             (UNREGISTERED), never a loop
//        E04  any other failure is INTEGRITY with its SQLSTATE class only and a bounded, growing backoff; nothing touched
//        E05  answers are idempotent: ALREADY_ERASED, NOT_DUE, CANCELLED, BLOCKED, UNKNOWN; the provider path unchanged
//        E06  the counterpart's continuity: NOT_AVAILABLE_NOW while CW2-08 is closed (as after any END); with the seam
//             cleared they reactivate through the release, once; a wrong anchor or another human cannot; OFF -> ACTIVATE
//        E07  a counterpart who had already reactivated keeps the audit (moved, same identities) and their replay
//        E08  a third party's proposal cancelled by the erased account's Match keeps its state and transition
//        E09  photos at two levels: access ends at ERASED; `media_erased_at` only after the last tracked key is confirmed
//        E10  recovery: a legacy BLOCKED of a covered footprint is re-armed with a fresh grace; an uncovered one stays
//             BLOCKED; covering a class re-arms only a clean census
//        E11  the counterpart erased afterwards: their retained view, the World and every remaining row go
//        E12  a SUCCESS-completed (STANDARD) World is Shared STANDARD residue: BLOCKED, untouched
//   G  races on two real connections, committed and erased away: the counterpart's message, END and reactivation
//      against the erasure in both orders; two erasures of the two humans at once; the owner's cancellation; a held
//      Matching lock answered by lock_timeout as RETRY - no deadlock, no orphan, one winner every time
//   T  the maximum-footprint erasure's duration against the API's dedicated erase timeout
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import process from 'node:process';
import { APP_ROLES, D, DFN, PFN, createIntroductionRuntime, runVerifier } from './introduction-lifecycle-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, rejected } = rt;

const ENTRY = 'public.server_erase_account_v1(uuid)';
const REARM = 'public.server_rearm_blocked_account_deletions_v1(integer)';
const OPERATIONS = 'public.server_read_account_erasure_operations_v1()';
const COVERAGE = 'public.server_read_account_erasure_coverage_v1()';
const PRIVATE = [
  'account_erasure_private.erase_account_v1(uuid)',
  'account_erasure_private.erase_matching_introductions_v1(uuid,uuid,uuid[])',
  'account_erasure_private.rearm_blocked_account_deletions_v1(integer)',
  'account_erasure_private.residue_classes_v1(uuid,uuid[])',
  'account_erasure_private.module_residue_v1(uuid)',
  'account_erasure_private.record_outcome_v1(uuid,text,text,text)',
  'account_erasure_private.erasure_authorized_v1()',
];
const GUARDS = [
  'public.introduction_disclosure_verifier_erasure_guard_v1()', 'public.introduction_profile_state_truth_v1()',
  'public.introduction_record_truth_v1()', 'introduction_sharing_private.refuse_name_display_event_rewrite_v1()',
  'public.introduction_success_approval_pointer_truth_v1()', 'public.matching_active_introduction_claim_truth_v1()',
  'public.matching_authority_status_truth_v1()', 'public.matching_confirmed_fact_state_truth_v1()',
  'public.matching_participation_state_truth_v1()', 'public.matching_proposal_state_truth_v1()',
  'public.matching_recipient_view_state_truth_v1()', 'public.matching_requirement_state_truth_v1()',
  'public.matching_setup_lock_truth_v1()', 'public.reject_introduction_disclosure_mutation_v1()',
  'public.reject_introduction_terminal_mutation_v1()', 'public.reject_matching_confirmed_fact_mutation_v1()',
  'public.reject_matching_match_mutation_v1()', 'public.reject_matching_proposal_mutation_v1()',
  'public.reject_matching_reactivation_mutation_v1()', 'public.reject_matching_setup_mutation_v1()',
];
const PREFIX = "\n  -- ACCT-DEL-01 (0164): the governed account erasure alone may DELETE; nothing else changes.\n"
  + "  IF TG_OP = 'DELETE' THEN\n"
  + "    IF pg_catalog.current_setting('qandeel.account_erasure', true) = pg_catalog.txid_current()::text THEN\n"
  + '      IF account_erasure_private.erasure_authorized_v1() THEN RETURN OLD; END IF;\n'
  + '    END IF;\n'
  + '  END IF;';
const MIGRATIONS = new URL('./migrations/', import.meta.url);
const EMPTY_ENDED = { introduction_state: 'ENDED', material_id: null, established_at: null, is_self: null, text_body: null };
/** The dedicated erase timeout of the API's server channel (apps/api PrivacyMaintenanceRepository). */
const ERASE_TIMEOUT_MS = 60_000;

// ------------------------------------------------------------------ helpers
const owner = () => asRole('postgres');
const as = (uid) => asRole('authenticated', uid);
/** The body of the LAST definition of `schema.name` in the migrations BEFORE 0164, CR-free. */
function priorBody(schema, name) {
  let found = null;
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f < '0164').sort()) {
    const text = readFileSync(new URL(file, MIGRATIONS), 'utf8').replace(/\r\n/gu, '\n');
    for (const match of text.matchAll(new RegExp(String.raw`CREATE (?:OR REPLACE )?FUNCTION ${schema}\.${name}\(`, 'gu'))) {
      const tail = text.slice(match.index);
      const open = /\bAS\s+(\$[A-Za-z_]*\$)/u.exec(tail);
      const start = open.index + open[0].length;
      found = { file, body: tail.slice(start, tail.indexOf(open[1], start)) };
    }
  }
  return found;
}
async function requestDeletion(user, { due = true, status = 'SCHEDULED' } = {}) {
  await owner();
  const [row] = await rows(
    `INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at, blocked_at)
     VALUES ($1, gen_random_uuid(), $2, clock_timestamp() - interval '8 days',
             clock_timestamp() + CASE WHEN $3 THEN interval '-1 day' ELSE interval '6 days' END,
             CASE WHEN $2 = 'BLOCKED' THEN clock_timestamp() END)
     RETURNING id`, [user, status, due]);
  return row.id;
}
async function erase(id) {
  await asRole('service_role');
  try { return (await rows('SELECT public.server_erase_account_v1($1) AS outcome', [id]))[0].outcome; } finally { await owner(); }
}
async function rearm(limit = 20) {
  await asRole('service_role');
  try { return (await rows('SELECT public.server_rearm_blocked_account_deletions_v1($1) AS n', [limit]))[0].n; } finally { await owner(); }
}
const requestOf = async (id) => { await owner(); return (await rows('SELECT * FROM personal_data_private.account_deletions WHERE id = $1', [id]))[0]; };
const progressOf = async (id) => { await owner(); return (await rows('SELECT * FROM account_erasure_private.deletion_progress WHERE deletion_id = $1', [id]))[0] ?? null; };
/** Every row in the database that still references `user` through a foreign key to the account. */
async function references(user) {
  await owner();
  const keys = await rows(`
    SELECT c.conrelid::regclass::text rel, a.attname col FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass AND cardinality(c.conkey) = 1`);
  const held = [];
  for (const k of keys) {
    const [{ n }] = await rows(`SELECT count(*)::int n FROM ${k.rel} x WHERE x.${k.col} = $1`, [user]);
    if (n > 0) held.push(`${k.rel}.${k.col}=${n}`);
  }
  const [{ n }] = await rows('SELECT count(*)::int n FROM public.users WHERE id = $1', [user]);
  if (n > 0) held.push('public.users');
  return held;
}
/** An exact content fingerprint of every relation the erasure can touch: proof that "nothing changed" is literal. */
async function fingerprint() {
  await owner();
  const relations = (await rows(`SELECT relation FROM account_erasure_private.coverage_registry
                                  WHERE coverage IN ('MATCHING_INTRODUCTIONS', 'SHARED_INTRODUCTION', 'PERSONAL') ORDER BY 1`))
    .map((r) => r.relation).concat(['public.users', 'introduction_sharing_private.media_erasure_queue',
      'account_erasure_private.media_pending', 'account_erasure_private.erasure_authorizations']);
  const out = {};
  for (const rel of relations) {
    const [{ h }] = await rows(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM ${rel} t`);
    out[rel] = h;
  }
  return out;
}
const sameFingerprint = (before, after, label) => {
  const changed = Object.keys(before).filter((k) => before[k] !== after[k]);
  assert.deepEqual(changed, [], `${label}: nothing at all changed`);
};
async function facts(pairs) { for (const [human, sex, firstName] of pairs) await rt.recordFacts(human, { sex, firstName }); }
async function introduction(first, candidate) {
  await facts([[first, 'FEMALE', 'Mona'], [candidate, 'MALE', 'Omar']]);
  const f = await rt.bringToIntroduction(first, candidate);
  await owner();
  return f;
}
async function send(uid, world, text) {
  await as(uid);
  try { return (await rows('SELECT * FROM public.send_my_introduction_text_v1($1, $2, $3)', [randomUUID(), world, text]))[0]; } finally { await owner(); }
}
async function endAs(uid, world) {
  await as(uid);
  try { return (await rows('SELECT * FROM public.end_own_introduction_v1($1, $2)', [randomUUID(), world]))[0].outcome; } finally { await owner(); }
}
async function historyOf(uid, world) {
  await as(uid);
  try {
    return await rows(`SELECT introduction_state, material_id, established_at::text AS established_at, is_self, text_body
                         FROM public.read_my_introduction_history_v1($1, NULL, NULL, 50)`, [world]);
  } finally { await owner(); }
}
async function messagesOf(uid, world) {
  await as(uid);
  try { return await rows('SELECT * FROM public.read_my_introduction_messages_v1($1, NULL, NULL, 50)', [world]); } finally { await owner(); }
}
async function listOf(uid) {
  await as(uid);
  try { return await rows('SELECT * FROM public.list_my_introduction_worlds_v1()'); } finally { await owner(); }
}
async function deleteOwn(uid, world, material) {
  await as(uid);
  try { return (await rows('SELECT * FROM public.delete_own_shared_world_material_v1($1, $2, $3)', [randomUUID(), world, material]))[0].outcome; } finally { await owner(); }
}
async function reactivateAs(uid, expected, channel = null, command = randomUUID()) {
  await as(uid);
  try { return { ...(await rows('SELECT * FROM public.reactivate_my_introductions_v1($1, $2, $3)', [command, expected, channel]))[0], command }; } finally { await owner(); }
}
async function discloseText(uid, world, type, text, fieldKey = null) {
  const command = randomUUID();
  await as(uid);
  try {
    const [answer] = await rows('SELECT * FROM public.disclose_my_introduction_text_v1($1, $2, $3, $4, $5)', [command, world, type, fieldKey, text]);
    assert.equal(answer.outcome, 'DISCLOSED', `the ${type} disclosure is real`);
  } finally { await owner(); }
  const [{ v }] = await rows("SELECT introduction_sharing_private.derive_identity_v1('TEXT_RESOURCE_VERSION', $1, $2, $3) v", [uid, world, command]);
  return v;
}
/** A photo with three renditions, completed, and its first stage shown to the other human. */
async function photo(uid, world) {
  await as(uid);
  const [{ image_series_id: series }] = await rows('SELECT * FROM public.begin_my_introduction_image_v1($1, $2)', [randomUUID(), world]);
  await asRole('service_role');
  const [{ outcome: ready }] = await rows('SELECT * FROM public.server_complete_introduction_image_v1($1)', [series]);
  assert.equal(ready, 'READY', 'the fixture photo is complete');
  await as(uid);
  const [{ outcome }] = await rows('SELECT * FROM public.disclose_my_introduction_image_stage_v1($1, $2, $3, 1)', [randomUUID(), world, series]);
  assert.equal(outcome, 'DISCLOSED', 'its first stage is shown');
  await owner();
  return series;
}
/**
 * The maximum footprint: A and B in a live Introduction with words both ways, a FULL_NAME each way and B's display
 * consent, a photo each way, a SUCCESS transition B approved; A with a second, offered proposal to C; A's every
 * Matching setup row. Returns everything a scenario needs to judge the result.
 */
async function maximum(A, B, C) {
  // A third human's proposal with the COUNTERPART, offered before the Match: the erased account's Match cancels it.
  await facts([[A, 'FEMALE', 'Mona'], [B, 'MALE', 'Omar'], [C, 'FEMALE', 'Lina']]);
  const offered = await rt.bringToOffered(B, C);
  await owner();
  const f = await introduction(A, B);
  const fromA = await send(A, f.world, 'from A, first');
  const fromB = await send(B, f.world, 'from B, first');
  const fromB2 = await send(B, f.world, 'from B, second');
  const fromA2 = await send(A, f.world, 'from A, second');
  await discloseText(A, f.world, 'FULL_NAME', 'Mona Example');
  const bName = await discloseText(B, f.world, 'FULL_NAME', 'Omar Example');
  await discloseText(B, f.world, 'DEEPER_PERSONAL_FIELD', 'a quiet town', 'hometown_city');
  await as(B);
  assert.equal((await rows('SELECT * FROM public.grant_my_introduction_name_display_v1($1, $2, $3)', [randomUUID(), f.world, bName]))[0].outcome, 'GRANTED');
  await owner();
  const seriesA = await photo(A, f.world);
  const seriesB = await photo(B, f.world);
  const version = randomUUID();
  await rt.prepareSuccess(version, f.world);
  await rt.actAs(B);
  await rt.approveSuccess(randomUUID(), version, null);
  await owner();
  const offeredTransitions = Number((await rows('SELECT count(*) n FROM public.matching_proposal_transitions WHERE proposal_id = $1', [offered.proposal]))[0].n);
  const [{ state: offeredState }] = await rows('SELECT proposal_state state FROM public.matching_proposals WHERE id = $1', [offered.proposal]);
  assert.equal(offeredState, 'CANCELLED_BY_COMPETING_MATCH', "the fixture: the Match cancelled the counterpart's other proposal");
  const keys = (await rows(`SELECT r.storage_key FROM introduction_sharing_private.image_renditions r
                              JOIN introduction_sharing_private.image_series s ON s.id = r.series_id WHERE s.world_id = $1`, [f.world]))
    .map((r) => r.storage_key).sort();
  return { ...f, fromA, fromA2, fromB, fromB2, seriesA, seriesB, keys, offered, offeredTransitions };
}

// ------------------------------------------------------------------ A. posture
async function verifyPosture(report) {
  await owner();
  await report.section('A01 one service_role entry reaches the erasure; no client role, no wrapper, no private function', async () => {
    for (const fn of [ENTRY, REARM, OPERATIONS, COVERAGE]) {
      const p = await rt.functionPosture(fn);
      assert.equal(p.owner, 'postgres', `A01 ${fn} is postgres-owned`);
      assert.equal(p.secdef, true, `A01 ${fn} is SECURITY DEFINER`);
      assert.equal(await rt.canExecute('service_role', fn), true, `A01 service_role executes ${fn}`);
      for (const role of ['public', 'anon', 'authenticated']) assert.equal(await rt.canExecute(role, fn), false, `A01 ${role} must not execute ${fn}`);
    }
    for (const fn of PRIVATE) {
      for (const role of ['public', ...APP_ROLES]) assert.equal(await rt.canExecute(role, fn), false, `A01 ${role} must not execute ${fn}`);
    }
    const [{ usage }] = await rows("SELECT bool_or(has_schema_privilege(r, 'account_erasure_private', 'USAGE')) usage FROM unnest($1::text[]) r", [APP_ROLES]);
    assert.equal(usage, false, 'A01 no application role may even see the private schema');
    const callers = await rows(`SELECT p.oid::regprocedure::text fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prosrc ~ 'account_erasure_private\\.erase_account_v1\\(' ORDER BY 1`);
    assert.deepEqual(callers.map((r) => r.fn), ['server_erase_account_v1(uuid)'], 'A01 exactly one function calls the coordinator');
    const [{ n }] = await rows("SELECT count(*)::int n FROM pg_proc p WHERE p.proname = 'server_erase_account_v1'");
    assert.equal(n, 1, 'A01 no overload');
    assert.equal(await rt.canExecute('service_role', 'public.server_erase_personal_account_v1(uuid)'), true,
      'A01 0130 keeps its own grants: nothing of it is changed');
  });

  await report.section('A02 the twenty guards are their prior bodies byte for byte after exactly one prefix; every guard trigger is enabled', async () => {
    for (const fn of GUARDS) {
      const [schema, rest] = fn.split('.');
      const name = rest.slice(0, rest.indexOf('('));
      const prior = priorBody(schema, name);
      assert.ok(prior, `A02 ${fn} was defined before 0164`);
      const at = prior.body.search(/\bBEGIN\b/u);
      const expected = prior.body.slice(0, at + 5) + PREFIX + prior.body.slice(at + 5);
      const live = (await rt.functionPosture(fn)).prosrc.replace(/\r\n/gu, '\n');
      assert.equal(live, expected, `A02 ${fn} is the ${prior.file} body plus exactly the prefix`);
      assert.equal(live.split('qandeel.account_erasure').length - 1, 1, `A02 ${fn} carries the prefix once`);
    }
    const disabled = await rows(`SELECT t.tgrelid::regclass::text rel, t.tgname FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE NOT t.tgisinternal AND t.tgenabled <> 'O' AND p.oid = ANY($1::regprocedure[])`, [GUARDS]);
    assert.deepEqual(disabled, [], 'A02 every guard trigger is enabled');
  });

  await report.section('A03 the GUC alone, the authorization alone and a stale authorization each still refuse a DELETE', async () => {
    await q('BEGIN');
    try {
      const human = randomUUID();
      await rt.provisionHumans([human]);
      // A real participation act through the frozen I-07A command (as its owner: 0149 closed it to every client role).
      await rt.actAs(human);
      await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY', null);
      await owner();
      const [{ id: act }] = await rows('SELECT id FROM public.matching_participation_events WHERE participant_user_id = $1', [human]);
      const deleteAct = () => q('DELETE FROM public.matching_participation_events WHERE id = $1', [act]);
      await rejected(deleteAct, ['55000']);
      await q("SELECT set_config('qandeel.account_erasure', txid_current()::text, true)");
      await rejected(deleteAct, ['55000']);
      await q("SELECT set_config('qandeel.account_erasure', '', true)");
      await q('INSERT INTO account_erasure_private.erasure_authorizations (transaction_id, deletion_id) VALUES (txid_current(), gen_random_uuid())');
      await rejected(deleteAct, ['55000']);
      await q("SELECT set_config('qandeel.account_erasure', (txid_current() + 1)::text, true)");
      await rejected(deleteAct, ['55000']);
      await q("SELECT set_config('qandeel.account_erasure', txid_current()::text, true)");
      await rejected(() => q("UPDATE public.matching_participation_events SET occurred_at = occurred_at WHERE id = $1", [act]), ['55000']);
      await q('DELETE FROM public.matching_participation_state WHERE participant_user_id = $1', [human]);
      await deleteAct();
      assert.equal(Number((await rows('SELECT count(*) n FROM public.matching_participation_events WHERE id = $1', [act]))[0].n), 0,
        'A03 both together admit a DELETE - and only a DELETE');
    } finally { await q('ROLLBACK'); await owner(); }
  });

  await report.section('A04 COVERAGE_CENSUS: every relation referencing the account or an erased relation is registered; a planted one is caught', async () => {
    const census = async () => {
      const missing = await rows(`
        WITH registry AS (SELECT relation FROM account_erasure_private.coverage_registry),
        erased AS (SELECT relation FROM account_erasure_private.coverage_registry
                    WHERE coverage IN ('MATCHING_INTRODUCTIONS', 'SHARED_INTRODUCTION')),
        scope AS (
          SELECT DISTINCT c.conrelid::regclass::text relation FROM pg_constraint c
           WHERE c.contype = 'f' AND (c.confrelid = 'public.users'::regclass
              OR c.confrelid::regclass::text IN (SELECT relation FROM erased)))
        SELECT s.relation FROM scope s WHERE s.relation NOT IN (SELECT relation FROM registry) ORDER BY 1`);
      return missing.map((r) => r.relation);
    };
    assert.deepEqual(await census(), [], 'A04 no relation that references the account or an erased relation is unregistered');
    const stale = await rows(`SELECT g.relation FROM account_erasure_private.coverage_registry g
                               WHERE to_regclass(g.relation) IS NULL ORDER BY 1`);
    assert.deepEqual(stale, [], 'A04 every registered relation exists');
    const cascadeLies = await rows(`SELECT DISTINCT g.relation FROM account_erasure_private.coverage_registry g
        JOIN pg_constraint c ON c.conrelid = to_regclass(g.relation) AND c.contype = 'f' AND c.confrelid = 'public.users'::regclass
       WHERE g.coverage = 'ACCOUNT_CASCADE' AND c.confdeltype <> 'c'`);
    assert.deepEqual(cascadeLies, [], 'A04 an ACCOUNT_CASCADE relation references the account only ON DELETE CASCADE');
    await q('BEGIN');
    try {
      await q('CREATE TABLE public.acct_del_01_planted (user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT)');
      assert.deepEqual(await census(), ['acct_del_01_planted'], 'A04 a planted RESTRICT reference to the account fails the census');
    } finally { await q('ROLLBACK'); }
    await q('BEGIN');
    try {
      await q('CREATE TABLE public.acct_del_01_planted (item uuid REFERENCES public.matching_pairs (id) ON DELETE RESTRICT)');
      assert.deepEqual(await census(), ['acct_del_01_planted'], 'A04 so does one referencing a relation the erasure deletes from');
    } finally { await q('ROLLBACK'); }
  });

  await report.section('A05 the static census probes every residue column, and the module check every covered one', async () => {
    const census = (await rt.functionPosture('account_erasure_private.residue_classes_v1(uuid,uuid[])')).prosrc;
    const moduleCheck = (await rt.functionPosture('account_erasure_private.module_residue_v1(uuid)')).prosrc;
    const keys = await rows(`
      SELECT c.conrelid::regclass::text rel, a.attname col, g.coverage FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        JOIN account_erasure_private.coverage_registry g ON g.relation = c.conrelid::regclass::text
       WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass AND c.confdeltype <> 'c'`);
    const qualified = (rel) => (rel.includes('.') ? rel : `public.${rel}`);
    for (const k of keys) {
      const probe = `FROM ${qualified(k.rel)} x`;
      if (['SHARED_STANDARD', 'PUBLIC', 'REPLAY', 'SHARED_INTRODUCTION'].includes(k.coverage)) {
        assert.ok(census.includes(`${probe} WHERE x.${k.col} = p_user`) || census.includes(`${probe} JOIN public.shared_world_history_items i ON i.id = x.history_item_id`),
          `A05 the census probes ${k.rel}.${k.col}`);
      }
      if (['MATCHING_INTRODUCTIONS', 'SHARED_INTRODUCTION'].includes(k.coverage)) {
        assert.ok(moduleCheck.includes(`${probe} WHERE x.${k.col} = p_user`), `A05 the module check probes ${k.rel}.${k.col}`);
      }
    }
    assert.doesNotMatch(census, /\bEXECUTE\b/u, 'A05 static SQL only: no dynamic statement');
  });

  await report.section('A06 the release gate: every residue class is uncovered today, owned, and readable by the server', async () => {
    await asRole('service_role');
    const coverage = await rows(`SELECT * FROM ${COVERAGE.replace('()', '()')}`);
    await owner();
    assert.deepEqual(coverage.map((r) => [r.residue_class, r.covered]),
      [['PUBLIC', false], ['REPLAY', false], ['SHARED_STANDARD', false], ['UNREGISTERED', false]], 'A06 nothing is claimed beyond Matching / Introductions');
    assert.deepEqual(Object.fromEntries(coverage.map((r) => [r.residue_class, r.owner])), {
      PUBLIC: 'ACCT-DEL-02', REPLAY: 'Stage 7 - Replay', SHARED_STANDARD: 'ACCT-DEL-02',
      UNREGISTERED: 'none - refused by the ACCT-DEL-01 coverage census in CI',
    }, 'A06 and every class has its owner');
  });

  await report.section('A08 every account column of a relation the erasure deletes from has a leading index (the final DELETE checks each)', async () => {
    const unindexed = await rows(`
      SELECT c.conrelid::regclass::text || '.' || a.attname AS col FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        JOIN account_erasure_private.coverage_registry g ON g.relation = c.conrelid::regclass::text
       WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass AND cardinality(c.conkey) = 1
         AND g.coverage IN ('MATCHING_INTRODUCTIONS', 'SHARED_INTRODUCTION')
         AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1])
       ORDER BY 1`);
    assert.deepEqual(unindexed.map((r) => r.col), [], 'A08 no whole-table scan of a covered relation inside the erasure');
  });

  await report.section('A07 frozen: 0130 byte for byte, every account reference still RESTRICT or CASCADE, CW2-08 closed', async () => {
    const live = (await rt.functionPosture('personal_data_private.erase_personal_account_v1(uuid)')).prosrc.replace(/\r\n/gu, '\n');
    assert.equal(live, priorBody('personal_data_private', 'erase_personal_account_v1').body, 'A07 the 0130 erasure is untouched');
    const weakened = await rows(`SELECT c.conrelid::regclass::text rel FROM pg_constraint c
      WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass AND c.confdeltype NOT IN ('r', 'c')`);
    assert.deepEqual(weakened, [], 'A07 no reference to the account is SET NULL, SET DEFAULT or NO ACTION');
    for (const seam of [PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) {
      assert.equal(await rt.seamClearance(seam.slice(0, seam.indexOf('('))), 'NOT_EVALUATED', `A07 ${seam} is fail-closed`);
    }
    for (const role of APP_ROLES) {
      assert.equal(await rt.canExecute(role, 'public.reactivate_matching_after_introduction_v1(uuid,uuid,uuid,text)'), false,
        `A07 ${role} executes no reactivation core`);
    }
  });
}

// ------------------------------------------------------------------ E. behaviour, one rolled-back transaction
async function verifyBehaviour(report, H) {
  await owner();
  await q('BEGIN');
  try {
    await report.isolated('E01 the maximum footprint is ERASED: zero references, the counterpart keeps exactly their own words and an ordinary END', async () => {
      const [A, B, C] = H;
      const f = await maximum(A, B, C);
      const bItems = new Set([f.fromB.material_id, f.fromB2.material_id]);
      const thirdBefore = await references(C);
      const id = await requestDeletion(A);
      const started = Date.now();
      assert.equal(await erase(id), 'ERASED', 'E01 ERASED');
      const elapsed = Date.now() - started;
      console.log(`0164 T the maximum-footprint erasure took ${elapsed} ms (the API's dedicated bound is ${ERASE_TIMEOUT_MS} ms)`);
      assert.ok(elapsed < ERASE_TIMEOUT_MS / 4, `E01 the maximum footprint erases well inside the dedicated timeout (${elapsed} ms)`);
      assert.deepEqual(await references(A), [], 'E01 no row anywhere references the erased account');
      const request = await requestOf(id);
      assert.equal(request.status, 'ERASED', 'E01 the request is ERASED (the provider removal follows)');
      // the counterpart: an ordinary END, their own words kept, nothing of A's
      assert.deepEqual(await messagesOf(B, f.world), [EMPTY_ENDED], 'E01 the live read tells the counterpart only that it ended');
      const history = await historyOf(B, f.world);
      assert.deepEqual(new Set(history.map((r) => r.material_id)), bItems, 'E01 the counterpart reads exactly their own two messages');
      assert.ok(history.every((r) => r.is_self === true && r.introduction_state === 'ENDED'), 'E01 every one is theirs');
      const [listed] = (await listOf(B)).filter((w) => w.world_id === f.world);
      assert.deepEqual(listed, { world_id: f.world, matching_proposal_id: f.proposal, introduction_state: 'ENDED', other_first_name: null },
        'E01 the World is listed ENDED, with the proposal identity they held and no name (IW-11b covers it)');
      const kept = (await rows('SELECT history_item_id FROM public.introduction_retained_view_items WHERE world_id = $1 AND user_id = $2', [f.world, B])).length;
      assert.equal(kept, 2, 'E01 the retained view holds exactly the two own items');
      // nothing of A's survives in the World; the counterpart's disclosures and photos to A are gone with it
      assert.equal(Number((await rows('SELECT count(*) n FROM public.shared_world_materials WHERE world_id = $1 AND NOT (id = ANY($2::uuid[]))', [f.world, [...bItems]]))[0].n), 0,
        'E01 no other material remains in the World');
      for (const rel of ['public.introduction_disclosure_resource_versions', 'introduction_sharing_private.image_series',
        'introduction_sharing_private.name_display_events', 'public.introduction_closed_view_entitlements', 'public.introduction_records']) {
        assert.equal(Number((await rows(`SELECT count(*) n FROM ${rel} WHERE world_id = $1`, [f.world]))[0].n), 0, `E01 ${rel} holds nothing of the World`);
      }
      // the counterpart's Matching state is the END's own
      const act = await rt.currentActOf(B);
      assert.deepEqual([act.resulting_state, act.resulting_pause_reason], ['PAUSED', 'POST_INTRODUCTION'], 'E01 the counterpart is PAUSED / POST_INTRODUCTION');
      const [release] = await rows('SELECT * FROM public.matching_counterpart_erasure_releases WHERE participant_user_id = $1', [B]);
      assert.equal(release.anchor_event_id, act.id, 'E01 their exact current act is released');
      // a third human's proposal the erased account's Match cancelled keeps its state and every transition; only the
      // private link from the erased Match is gone
      const [third] = await rows('SELECT proposal_state FROM public.matching_proposals WHERE id = $1', [f.offered.proposal]);
      assert.equal(third.proposal_state, 'CANCELLED_BY_COMPETING_MATCH', "E01 the counterpart's proposal with a third human keeps its state");
      assert.equal(Number((await rows('SELECT count(*) n FROM public.matching_proposal_transitions WHERE proposal_id = $1', [f.offered.proposal]))[0].n),
        f.offeredTransitions, 'E01 and every one of its transitions');
      assert.equal(Number((await rows('SELECT count(*) n FROM public.matching_match_competing_cancellations WHERE cancelled_proposal_id = $1', [f.offered.proposal]))[0].n), 0,
        'E01 only the private link from the erased Match is gone');
      assert.deepEqual(await references(C), thirdBefore, 'E01 the third human keeps every row that names them');
      // the queued keys, tracked for this request
      const queued = (await rows('SELECT storage_key FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[]) ORDER BY 1', [f.keys])).map((r) => r.storage_key);
      assert.deepEqual(queued, f.keys, 'E01 every photo key of the World is in the erasure queue');
      const pending = (await rows('SELECT storage_key FROM account_erasure_private.media_pending WHERE deletion_id = $1 ORDER BY 1', [id])).map((r) => r.storage_key);
      assert.deepEqual(pending, f.keys, 'E01 and tracked for this request');
      const progress = await progressOf(id);
      assert.deepEqual([progress.last_outcome, progress.media_keys, progress.media_erased_at], ['ERASED', f.keys.length, null], 'E01 level 1 done, level 2 pending');
    });

    await report.isolated('E02 an uncovered footprint is BLOCKED by the census before anything is touched', async () => {
      const [A, B] = H;
      await introduction(A, B);
      await owner();
      await q('INSERT INTO public.public_identities (public_identity_ref, user_id, created_at) VALUES (gen_random_uuid(), $1, clock_timestamp())', [A]);
      await q("INSERT INTO public.shared_world_invite_credential_state (user_id, credential_lookup_ref, epoch) VALUES ($1, 'acct-del-01-' || gen_random_uuid(), 1)", [A]);
      const id = await requestDeletion(A);
      const before = await fingerprint();
      assert.equal(await erase(id), 'BLOCKED', 'E02 BLOCKED');
      const after = await fingerprint();
      const request = await requestOf(id);
      assert.equal(request.status, 'BLOCKED', 'E02 the request is BLOCKED');
      const progress = await progressOf(id);
      assert.deepEqual(progress.residue_classes, ['PUBLIC', 'SHARED_STANDARD'], 'E02 with exactly its uncovered classes');
      sameFingerprint(before, after, 'E02');
      assert.equal(await erase(id), 'BLOCKED', 'E02 a BLOCKED request answers BLOCKED again, untouched');
    });

    await report.isolated('E03 0130 refusing after the module ran rolls EVERYTHING back; three in a row are BLOCKED (UNREGISTERED), never a loop', async () => {
      const [A, B] = H;
      const f = await introduction(A, B);
      await send(A, f.world, 'from A');
      await send(B, f.world, 'from B');
      await photo(B, f.world);
      await q('CREATE TABLE public.acct_del_01_unregistered (user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT)');
      await q('INSERT INTO public.acct_del_01_unregistered VALUES ($1)', [A]);
      const id = await requestDeletion(A);
      const before = await fingerprint();
      assert.equal(await erase(id), 'RETRY', 'E03 the first refusal is RETRY');
      sameFingerprint(before, await fingerprint(), 'E03 after RETRY');
      let request = await requestOf(id);
      assert.equal(request.status, 'SCHEDULED', 'E03 the request stays SCHEDULED');
      assert.ok(new Date(request.lease_until) > new Date(), 'E03 under a backoff lease');
      assert.equal((await rt.recordRow(f.record)).introduction_status, 'ACTIVE', 'E03 the Introduction was not ended: the END rolled back too');
      assert.equal(await erase(id), 'RETRY', 'E03 the second is RETRY');
      assert.equal(await erase(id), 'BLOCKED', 'E03 the third is an honest BLOCKED');
      const progress = await progressOf(id);
      assert.deepEqual(progress.residue_classes, ['UNREGISTERED'], 'E03 with the class UNREGISTERED');
      assert.equal((await requestOf(id)).status, 'BLOCKED', 'E03 and the request says so');
      sameFingerprint(before, await fingerprint(), 'E03 after all three');
    });

    await report.isolated('E04 any other failure is INTEGRITY: its SQLSTATE class only, a growing bounded backoff, nothing touched', async () => {
      const [A, B] = H;
      await introduction(A, B);
      await q(`CREATE FUNCTION public.acct_del_01_planted_failure() RETURNS trigger LANGUAGE plpgsql AS $f$
               BEGIN RAISE EXCEPTION 'planted' USING ERRCODE = 'XX001'; END$f$`);
      await q(`CREATE TRIGGER acct_del_01_planted_failure BEFORE DELETE ON public.matching_pairs
               FOR EACH ROW EXECUTE FUNCTION public.acct_del_01_planted_failure()`);
      const id = await requestDeletion(A);
      const before = await fingerprint();
      assert.equal(await erase(id), 'INTEGRITY', 'E04 INTEGRITY');
      sameFingerprint(before, await fingerprint(), 'E04');
      const first = await requestOf(id);
      const p1 = await progressOf(id);
      assert.deepEqual([p1.integrity_failures, p1.last_failure_class], [1, 'XX'], 'E04 the class only');
      await q('UPDATE personal_data_private.account_deletions SET lease_until = NULL WHERE id = $1', [id]);
      assert.equal(await erase(id), 'INTEGRITY', 'E04 again');
      const second = await requestOf(id);
      const [{ grew }] = await rows(`SELECT ($1::timestamptz - clock_timestamp()) > ($2::timestamptz - $3::timestamptz) + interval '1 minute' AS grew`,
        [second.lease_until, first.lease_until, first.lease_until]);
      assert.equal(grew, true, 'E04 the backoff grows');
      assert.equal(second.status, 'SCHEDULED', 'E04 never BLOCKED for an integrity failure');
    });

    await report.isolated('E05 idempotent answers: ALREADY_ERASED, NOT_DUE, CANCELLED, BLOCKED, UNKNOWN; the provider path unchanged', async () => {
      const [A, B, C] = H;
      await introduction(A, B);
      const id = await requestDeletion(A);
      assert.equal(await erase(id), 'ERASED');
      assert.equal(await erase(id), 'ALREADY_ERASED', 'E05 a second pass is ALREADY_ERASED (0130\'s sweep)');
      await asRole('service_role');
      assert.equal((await rows('SELECT public.server_complete_account_deletion_v1($1) o', [id]))[0].o, 'COMPLETED', 'E05 the provider path completes');
      await owner();
      assert.equal(await erase(id), 'ALREADY_ERASED', 'E05 and stays ALREADY_ERASED');
      const notDue = await requestDeletion(C, { due: false });
      assert.equal(await erase(notDue), 'NOT_DUE', 'E05 a request in its grace period is NOT_DUE');
      await q("UPDATE personal_data_private.account_deletions SET status = 'CANCELLED', cancelled_at = clock_timestamp() WHERE id = $1", [notDue]);
      assert.equal(await erase(notDue), 'CANCELLED', 'E05 a cancelled one is CANCELLED');
      assert.equal(await erase(randomUUID()), 'UNKNOWN', 'E05 an unknown one is UNKNOWN');
      assert.ok((await references(C)).length > 0, 'E05 and nothing of the other account was touched');
    });

    await report.isolated('E06 the counterpart\'s continuity: NOT_AVAILABLE_NOW while CW2-08 is closed; with it cleared, the release reactivates once', async () => {
      const [A, B, C] = H;
      const f = await introduction(A, B);
      assert.equal(await erase(await requestDeletion(A)), 'ERASED');
      const paused = await rt.currentActOf(B);
      const seam = await rt.captureMatchingSeam(DFN.REACTIVATION_GATE);
      await rt.restoreMatchingSeam(seam);
      assert.equal(await rt.seamClearance(DFN.REACTIVATION_GATE.slice(0, DFN.REACTIVATION_GATE.indexOf('('))), 'NOT_EVALUATED');
      assert.equal((await reactivateAs(B, paused.id)).outcome, 'NOT_AVAILABLE_NOW', 'E06 exactly as after any END while CW2-08 is closed');
      await rt.clearSeam([DFN.REACTIVATION_GATE.slice(0, DFN.REACTIVATION_GATE.indexOf('(')), 'p_user_id']);
      assert.equal((await reactivateAs(C, (await rt.currentActOf(C))?.id ?? randomUUID())).outcome === 'REACTIVATED', false, 'E06 another human holds no such lineage');
      const first = await reactivateAs(B, paused.id);
      assert.deepEqual([first.outcome, first.participation_state], ['REACTIVATED', 'ACTIVE'], 'E06 the counterpart reactivates by their own act');
      const [command] = await rows('SELECT * FROM public.matching_counterpart_erasure_reactivation_commands WHERE id = $1', [first.command]);
      assert.deepEqual([command.participant_user_id, command.released_anchor_event_id, command.prior_participation_event_id],
        [B, paused.id, paused.id], 'E06 recorded in the sibling relation with its exact lineage');
      assert.equal((await reactivateAs(B, paused.id, null, first.command)).outcome, 'REACTIVATED', 'E06 the same command replays');
      assert.equal((await reactivateAs(B, paused.id)).outcome, 'CHANGED', 'E06 a second crossing of the same lineage is refused');
      assert.equal(Number((await rows('SELECT count(*) n FROM public.matching_proposals p JOIN public.matching_pairs x ON x.id = p.pair_id WHERE $1 IN (x.lower_user_id, x.higher_user_id)', [B]))[0].n), 0,
        'E06 nothing revived or created a proposal');
      await rt.restoreMatchingSeam(seam);
      void f;
    });

    await report.isolated('E07 OFF over the lineage: the release anchors on the act before OFF, and ACTIVATE needs an entry channel', async () => {
      const [A, B] = H;
      const f = await introduction(A, B);
      const off = await rt.turnOffDuringIntroduction(B);
      assert.equal(await erase(await requestDeletion(A)), 'ERASED');
      const act = await rt.currentActOf(B);
      assert.deepEqual([act.id, act.resulting_state], [off, 'OFF'], 'E07 the END left the counterpart OFF');
      const [release] = await rows('SELECT * FROM public.matching_counterpart_erasure_releases WHERE participant_user_id = $1', [B]);
      assert.equal(release.anchor_event_id, act.prior_event_id, 'E07 the released anchor is the exact pause the OFF superseded');
      const seam = await rt.captureMatchingSeam(DFN.REACTIVATION_GATE);
      await rt.clearSeam([DFN.REACTIVATION_GATE.slice(0, DFN.REACTIVATION_GATE.indexOf('(')), 'p_user_id']);
      assert.equal((await reactivateAs(B, act.id, 'MANUAL_MY_WORLD_ENTRY')).outcome, 'REACTIVATED', 'E07 ACTIVATE through the release');
      await rt.restoreMatchingSeam(seam);
      void f;
    });

    await report.isolated('E08 a counterpart who had already reactivated keeps the audit (moved, same identities) and their replay', async () => {
      const [A, B] = H;
      const f = await introduction(A, B);
      assert.equal(await endAs(B, f.world), 'ENDED');
      const seam = await rt.captureMatchingSeam(DFN.REACTIVATION_GATE);
      await rt.clearSeam([DFN.REACTIVATION_GATE.slice(0, DFN.REACTIVATION_GATE.indexOf('(')), 'p_user_id']);
      const paused = await rt.currentActOf(B);
      const done = await reactivateAs(B, paused.id);
      assert.equal(done.outcome, 'REACTIVATED');
      const [original] = await rows('SELECT * FROM public.matching_introduction_reactivation_commands WHERE id = $1', [done.command]);
      assert.equal(await erase(await requestDeletion(A)), 'ERASED');
      const [moved] = await rows('SELECT * FROM public.matching_counterpart_erasure_reactivation_commands WHERE id = $1', [done.command]);
      assert.deepEqual([moved.participant_user_id, moved.prior_participation_event_id, moved.participation_event_id, moved.reactivation_act, String(moved.committed_at)],
        [original.participant_user_id, original.prior_participation_event_id, original.participation_event_id, original.reactivation_act, String(original.committed_at)],
        'E08 the same identities, in the sibling relation');
      assert.equal(moved.released_anchor_event_id, null, 'E08 a moved audit carries no release');
      assert.equal((await reactivateAs(B, paused.id, null, done.command)).outcome, 'REACTIVATED', 'E08 the replay still answers from history');
      await rt.restoreMatchingSeam(seam);
    });

    await report.isolated('E09 photos at two levels: access ends at ERASED; media_erased_at only after the last tracked key is confirmed', async () => {
      const [A, B] = H;
      const f = await introduction(A, B);
      const series = await photo(B, f.world);
      const [{ handle }] = await rows('SELECT handle FROM introduction_sharing_private.image_renditions WHERE series_id = $1 AND stage = 1', [series]);
      const id = await requestDeletion(A);
      assert.equal(await erase(id), 'ERASED');
      await as(B);
      assert.notEqual((await rows('SELECT * FROM public.authorize_my_introduction_media_v1($1, $2)', [f.world, handle]))[0]?.outcome, 'AUTHORIZED',
        'E09 no byte of the counterpart\'s photo is authorized any more');
      await owner();
      const keys = (await rows('SELECT storage_key FROM account_erasure_private.media_pending WHERE deletion_id = $1 ORDER BY 1', [id])).map((r) => r.storage_key);
      assert.equal(keys.length, 3, 'E09 three tracked keys');
      await q('UPDATE introduction_sharing_private.media_erasure_queue SET not_before = clock_timestamp() - interval \'1 second\' WHERE storage_key = ANY($1::text[])', [keys]);
      await asRole('service_role');
      const leased = await rows('SELECT * FROM public.server_claim_introduction_media_erasures_v1(200, 60)');
      const mine = leased.filter((l) => keys.includes(l.storage_key));
      assert.equal(mine.length, 3, 'E09 the worker leases them like any other key');
      for (const [i, l] of mine.entries()) {
        assert.equal((await rows('SELECT * FROM public.server_confirm_introduction_media_erased_v1($1, $2)', [l.storage_key, l.lease_id]))[0].outcome, 'CONFIRMED');
        await owner();
        const progress = await progressOf(id);
        assert.equal(progress.media_erased_at === null, i < 2, `E09 media_erased_at ${i < 2 ? 'waits' : 'is set'} after ${i + 1} of 3`);
        await asRole('service_role');
      }
      await owner();
      assert.equal(Number((await rows('SELECT count(*) n FROM account_erasure_private.media_pending WHERE deletion_id = $1', [id]))[0].n), 0, 'E09 nothing is left pending');
    });

    await report.isolated('E10 recovery: a legacy BLOCKED of a covered footprint is re-armed; an uncovered one stays; covering a class re-arms a clean census only', async () => {
      const [A, B, C] = H;
      await introduction(A, B);
      const legacy = await requestDeletion(A, { status: 'BLOCKED' });
      await q("INSERT INTO public.shared_world_invite_credential_state (user_id, credential_lookup_ref, epoch) VALUES ($1, 'acct-del-01-' || gen_random_uuid(), 1)", [C]);
      const blocked = await requestDeletion(C);
      assert.equal(await erase(blocked), 'BLOCKED', 'E10 an uncovered footprint is BLOCKED');
      assert.ok(await rearm() >= 1, 'E10 the pass re-arms');
      const re = await requestOf(legacy);
      assert.equal(re.status, 'SCHEDULED', 'E10 the legacy BLOCKED (a footprint now covered) is SCHEDULED again');
      const [{ fresh }] = await rows("SELECT $1::timestamptz BETWEEN clock_timestamp() + interval '6 days 23 hours' AND clock_timestamp() + interval '7 days 1 minute' AS fresh", [re.final_at]);
      assert.equal(fresh, true, 'E10 with a fresh 7-day grace');
      assert.equal((await progressOf(legacy)).rearm_count, 1, 'E10 recorded once');
      await as(A);
      assert.equal((await rows('SELECT * FROM public.cancel_own_account_deletion_v1()'))[0].outcome, 'CANCELLED', 'E10 and the owner can cancel it');
      await owner();
      {
        assert.equal((await requestOf(blocked)).status, 'BLOCKED', 'E10 an uncovered class stays BLOCKED');
        await rearm();
        assert.equal((await requestOf(blocked)).status, 'BLOCKED', 'E10 every pass leaves it BLOCKED while its class is uncovered');
        assert.deepEqual((await progressOf(blocked)).residue_classes, ['SHARED_STANDARD'], 'E10 with its class unchanged');
        // ACCT-DEL-02 covers a class in the same change as its module; here the flag alone, rolled back with the scenario.
        await q("UPDATE account_erasure_private.residue_class_coverage SET covered = true WHERE residue_class = 'SHARED_STANDARD'");
        await rearm();
        const again = await requestOf(blocked);
        assert.equal(again.status, 'SCHEDULED', 'E10 once its class is covered it is re-armed');
        assert.deepEqual([(await progressOf(blocked)).last_outcome, (await progressOf(blocked)).residue_classes], ['REARMED', null], 'E10 and recorded so');
      }
    });

    await report.isolated('E11 the counterpart erased afterwards: their retained view, the World and every remaining row go', async () => {
      const [A, B] = H;
      const f = await introduction(A, B);
      await send(A, f.world, 'a');
      await send(B, f.world, 'b');
      assert.equal(await erase(await requestDeletion(A)), 'ERASED');
      assert.equal(await erase(await requestDeletion(B)), 'ERASED', 'E11 the counterpart is erased in turn');
      assert.deepEqual(await references(B), [], 'E11 nothing references them');
      assert.equal(Number((await rows('SELECT count(*) n FROM public.shared_worlds WHERE id = $1', [f.world]))[0].n), 0, 'E11 nobody is left: the World is gone');
      assert.equal(Number((await rows('SELECT count(*) n FROM public.shared_world_history_items WHERE world_id = $1', [f.world]))[0].n), 0, 'E11 with its history');
    });

    await report.isolated('E12 the counterpart deletes their own retained words; a stranger and Stage 4 see nothing', async () => {
      const [A, B, C] = H;
      const f = await introduction(A, B);
      const mine = await send(B, f.world, 'mine to take back');
      await send(A, f.world, 'theirs');
      assert.equal(await erase(await requestDeletion(A)), 'ERASED');
      assert.equal(await deleteOwn(B, f.world, mine.material_id), 'DELETED', 'E12 owner deletion works on the retained words');
      assert.deepEqual(await historyOf(B, f.world), [EMPTY_ENDED], 'E12 and they are gone');
      assert.deepEqual(await historyOf(C, f.world), [], 'E12 a stranger reads nothing');
      assert.deepEqual(await messagesOf(C, f.world), [], 'E12 nor the live read');
      await as(B);
      const stage4 = await rows('SELECT * FROM shared_private.list_own_shared_worlds_v1()').catch(() => []);
      await owner();
      assert.ok(!stage4.some((w) => Object.values(w).includes(f.world)), 'E12 no Stage 4 list shows the Introduction World');
    });

    await report.isolated('E13 a SUCCESS-completed (Standard) World is Shared STANDARD residue: BLOCKED, untouched', async () => {
      const [A, B] = H;
      const f = await rt.bringToSuccessApproved(...await (async () => { await facts([[A, 'FEMALE', 'Mona'], [B, 'MALE', 'Omar']]); return [A, B]; })());
      const [{ outcome }] = await rows('SELECT * FROM public.commit_introduction_success_v1($1, $2, $3, $4)', [randomUUID(), f.version, randomUUID(), randomUUID()]);
      assert.ok(outcome, 'E13 SUCCESS committed');
      const id = await requestDeletion(A);
      const before = await fingerprint();
      assert.equal(await erase(id), 'BLOCKED', 'E13 BLOCKED');
      assert.deepEqual((await progressOf(id)).residue_classes, ['SHARED_STANDARD'], 'E13 by the Shared STANDARD World');
      sameFingerprint(before, await fingerprint(), 'E13');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ G. races on two real connections
async function verifyRaces(report, used) {
  // Each race commits its own two fresh humans and removes them at the end through the erasure itself: an erased
  // account can never be provisioned again (0130), which is exactly right, so no race reuses another's humans.
  let one;
  let two;
  const cleanup = async () => {
    await owner();
    for (const human of [one, two]) {
      const [{ n }] = await rows('SELECT count(*)::int n FROM public.users WHERE id = $1', [human]);
      if (n === 0) continue;
      await q("UPDATE personal_data_private.account_deletions SET status = 'CANCELLED', cancelled_at = clock_timestamp() WHERE user_id = $1 AND status IN ('SCHEDULED', 'BLOCKED')", [human]);
      const id = await requestDeletion(human);
      const outcome = await erase(id);
      assert.equal(outcome, 'ERASED', `teardown: the race human is erased (${outcome})`);
    }
  };
  const race = (name, body) => report.section(name, async () => {
    one = randomUUID();
    two = randomUUID();
    used.push(one, two);
    await owner();
    await rt.provisionHumans([one, two]);
    try { await body(); } finally { await owner(); await cleanup(); }
  });
  /** The primary holds `mine` open (as `mineAs`); the extra connection runs `theirs` and must wait; then both settle. */
  async function contend(label, { mine, theirs, theirsAs = null, theirsRole = 'authenticated' }) {
    const extra = await rt.openExtra();
    try {
      await q('BEGIN');
      const first = await mine();
      await extra.qx('BEGIN');
      await extra.qx(`SET LOCAL ROLE ${theirsRole}`);
      await extra.qx("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(theirsAs ? { sub: theirsAs, role: theirsRole } : { role: theirsRole })]);
      const pending = extra.qx(theirs.sql, theirs.values).then((r) => r.rows[0], (error) => error);
      assert.equal(await rt.waitForLockWait((t, v) => q(t, v), extra.pid), true, `${label}: the second act waits on the first`);
      await q('COMMIT');
      const late = await pending;
      await extra.qx(late instanceof Error ? 'ROLLBACK' : 'COMMIT');
      assert.ok(!(late instanceof Error) || !['40P01'].includes(late.code), `${label}: no deadlock`);
      return { first, late };
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await owner();
      await extra.close();
    }
  }
  const eraseSql = (id) => ({ sql: 'SELECT public.server_erase_account_v1($1) AS outcome', values: [id] });
  const commit = async (fn) => { await q('BEGIN'); try { const r = await fn(); await q('COMMIT'); return r; } catch (e) { await q('ROLLBACK'); throw e; } };

  await race('G01 the counterpart\'s message first, the erasure waiting: ERASED, and the message is kept as theirs', async () => {
    const f = await commit(() => introduction(one, two));
    const id = await commit(() => requestDeletion(one));
    const { first, late } = await contend('G01', {
      mine: async () => { const r = await send(two, f.world, 'just in time'); return r; },
      theirs: eraseSql(id), theirsRole: 'service_role',
    });
    assert.equal(first.outcome, 'COMMITTED');
    assert.equal(late.outcome, 'ERASED', 'G01 the erasure then completes');
    const history = await historyOf(two, f.world);
    assert.ok(history.some((r) => r.material_id === first.material_id && r.is_self), 'G01 the message is in the counterpart\'s retained view');
  });

  await race('G02 the erasure first, the counterpart\'s message waiting: it is answered, never written into an erased Introduction', async () => {
    const f = await commit(() => introduction(one, two));
    const id = await commit(() => requestDeletion(one));
    const { first, late } = await contend('G02', {
      mine: () => erase(id),
      theirs: { sql: 'SELECT * FROM public.send_my_introduction_text_v1($1, $2, $3)', values: [randomUUID(), f.world, 'too late'] }, theirsAs: two,
    });
    assert.equal(first, 'ERASED');
    assert.ok(['UNAVAILABLE', 'ENDED'].includes(late.outcome), `G02 the late message is refused (${late.outcome})`);
    assert.equal(Number((await rows("SELECT count(*) n FROM public.shared_world_text_material_bodies b JOIN public.shared_world_materials m ON m.id = b.material_id WHERE m.world_id = $1 AND b.body_text = 'too late'", [f.world]))[0].n), 0,
      'G02 nothing was written');
  });

  await race('G03 the counterpart\'s END first, the erasure waiting: one terminal outcome, then ERASED', async () => {
    const f = await commit(() => introduction(one, two));
    const id = await commit(() => requestDeletion(one));
    const { first, late } = await contend('G03', { mine: () => endAs(two, f.world), theirs: eraseSql(id), theirsRole: 'service_role' });
    assert.equal(first, 'ENDED');
    assert.equal(late.outcome, 'ERASED');
    assert.deepEqual([(await rt.currentActOf(two)).resulting_pause_reason], ['POST_INTRODUCTION'], 'G03 the counterpart\'s END stands');
  });

  await race('G04 the erasure first, the counterpart\'s END waiting: answered UNAVAILABLE, no second terminal', async () => {
    const f = await commit(() => introduction(one, two));
    const id = await commit(() => requestDeletion(one));
    const { first, late } = await contend('G04', {
      mine: () => erase(id), theirs: { sql: 'SELECT * FROM public.end_own_introduction_v1($1, $2)', values: [randomUUID(), f.world] }, theirsAs: two,
    });
    assert.equal(first, 'ERASED');
    assert.ok(!(late instanceof Error), 'G04 the END is answered');
    assert.ok(['UNAVAILABLE', 'ALREADY_SETTLED'].includes(late.outcome), `G04 (${late.outcome})`);
  });

  await race('G05 both humans erased at once: no deadlock, both ERASED, nothing left of the Introduction', async () => {
    const f = await commit(() => introduction(one, two));
    const ids = await commit(async () => [await requestDeletion(one), await requestDeletion(two)]);
    const { first, late } = await contend('G05', { mine: () => erase(ids[0]), theirs: eraseSql(ids[1]), theirsRole: 'service_role' });
    assert.equal(first, 'ERASED');
    assert.equal(late.outcome, 'ERASED', 'G05 the second erasure, after waiting, completes too');
    assert.equal(Number((await rows('SELECT count(*) n FROM public.shared_worlds WHERE id = $1', [f.world]))[0].n), 0, 'G05 the World is gone');
  });

  await race('G06 the owner cancels while the erasure holds the account: the cancellation waits and finds the account erased', async () => {
    await commit(() => introduction(one, two));
    const id = await commit(() => requestDeletion(one));
    const { first, late } = await contend('G06', { mine: () => erase(id), theirs: { sql: 'SELECT * FROM public.cancel_own_account_deletion_v1()', values: [] }, theirsAs: one });
    assert.equal(first, 'ERASED');
    assert.ok(late instanceof Error ? late.code === 'P0002' : late.outcome !== 'CANCELLED', 'G06 a cancellation after the erasure cancels nothing');
    assert.equal((await requestOf(id)).status, 'ERASED');
  });

  await race('G07 a held Matching lock answers RETRY by lock_timeout, touching nothing; released, the next pass is ERASED', async () => {
    await commit(() => introduction(one, two));
    const id = await commit(() => requestDeletion(one));
    const extra = await rt.openExtra();
    try {
      await extra.qx('BEGIN');
      await extra.qx('SELECT 1 FROM public.matching_setup_locks WHERE user_id = $1 FOR UPDATE', [two]);
      const before = await fingerprint();
      const started = Date.now();
      assert.equal(await erase(id), 'RETRY', 'G07 RETRY');
      assert.ok(Date.now() - started < 10_000, 'G07 within the lock_timeout, not the statement timeout');
      sameFingerprint({ ...before, 'account_erasure_private.media_pending': null }, { ...(await fingerprint()), 'account_erasure_private.media_pending': null }, 'G07');
      await extra.qx('ROLLBACK');
    } finally { await extra.close(); }
    assert.equal((await progressOf(id)).consecutive_contention, 1, 'G07 counted as contention');
    await q('UPDATE personal_data_private.account_deletions SET lease_until = NULL WHERE id = $1', [id]);
    assert.equal(await erase(id), 'ERASED', 'G07 the next pass completes');
  });

  await race('G08 the counterpart reactivating while the erasure runs: one order, no deadlock', async () => {
    const f = await commit(() => introduction(one, two));
    await commit(() => endAs(two, f.world));
    const id = await commit(() => requestDeletion(one));
    const paused = await rt.currentActOf(two);
    const { first, late } = await contend('G08', {
      mine: () => erase(id),
      theirs: { sql: 'SELECT * FROM public.reactivate_my_introductions_v1($1, $2, NULL)', values: [randomUUID(), paused.id] }, theirsAs: two,
    });
    assert.equal(first, 'ERASED');
    assert.equal(late.outcome, 'NOT_AVAILABLE_NOW', 'G08 the reactivation is answered as after any END (CW2-08 closed)');
  });
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID()];
const raceHumans = [];
const SEAMS = [PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE];
const capturedSeams = [];
await runVerifier('0164', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  setStage('fixtures');
  await rt.provisionHumans(humans);
  const report = createScenarioReport('0164', { query: q, restore: () => owner() });

  setStage('posture');
  await verifyPosture(report);

  for (const fn of SEAMS) capturedSeams.push(await rt.captureMatchingSeam(fn));
  try {
    await rt.clearProposalPrerequisites();
    await rt.clearSeam([DFN.DISCLOSURE_GATE.slice(0, DFN.DISCLOSURE_GATE.indexOf('(')), 'p_world_id']);
    await rt.clearSeam([DFN.SUCCESS_GATE.slice(0, DFN.SUCCESS_GATE.indexOf('(')), 'p_introduction_record_id']);
    setStage('behaviour');
    await verifyBehaviour(report, humans);
    setStage('races');
    await verifyRaces(report, raceHumans);
  } finally {
    await owner();
    for (const seam of capturedSeams) await rt.restoreMatchingSeam(seam);
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  for (const seam of SEAMS) {
    assert.equal(await rt.seamClearance(seam.slice(0, seam.indexOf('('))), 'NOT_EVALUATED', `${seam} is fail-closed again`);
  }
  await rt.cleanupIntroductionRace([...humans, ...raceHumans]);
  await q('DELETE FROM account_erasure_private.media_pending WHERE deletion_id IN (SELECT id FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[]))', [[...humans, ...raceHumans]]);
  await q('DELETE FROM account_erasure_private.deletion_progress WHERE deletion_id IN (SELECT id FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[]))', [[...humans, ...raceHumans]]);
  await q('DELETE FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[])', [[...humans, ...raceHumans]]);
  await rt.removeFixtureHumans([...humans, ...raceHumans]);
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM public.introduction_records WHERE lower_user_id = ANY($1::uuid[]) OR higher_user_id = ANY($1::uuid[])) AS residue`,
  [[...humans, ...raceHumans]]);
  assert.equal(Number(residue), 0, 'the run leaves nothing behind');
}, () => rt.client.end().catch(() => undefined));
