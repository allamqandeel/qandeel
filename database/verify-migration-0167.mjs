// S6-07 CP3 / migration 0167 - real-PostgreSQL proof of the Introductions Activity sources, the capability truth and the
// per-Introduction alerts.
//
//   A  posture: seven functions, each once, postgres-owned, DEFINER, pinned; the server reads and the lister service_role
//      only, the human reads and the mute command authenticated only, the resolver nobody's, anon nothing; all read-only
//      but the mute command, which writes only the caller's own mute row; the migration creates no table
//   B  behaviour (one rolled-back transaction, each scenario in its own SAVEPOINT, on the REAL pipeline: enrollment
//      fixtures -> proposal -> forward -> Match -> Introduction World, the real 0160 send, 0162 disclosure, END, SUCCESS
//      preparation and the real 0164 erasure):
//      B01 the capability truth: never-entered false; enrolled, Introduction humans and a retained view true; own answer
//      B02 the delivery source: the second recipient while current and before the deadline; nothing after it, nothing
//          for anyone else
//      B03 WORLD_BORN for both humans exactly, nobody else; a published member removes exactly that row; a second
//          publication of the same key is a DUPLICATE (one item)
//      B04 HUMAN_TEXT for the other human only, never the author; a message its owner deleted tells nobody anything
//      B05 DISCLOSURE for the counterpart only
//      B06 ENDED for the human who did not end it, never the actor; the World's live events stop being listed
//      B07 SUCCESS_REQUESTED for each approver who has not approved, and no longer for one who has
//      B08 the other human's account erasure: the retained-view holder is listed ENDED once; the erased human's items
//          and mutes are gone and nothing is listed for them
//      B09 the per-Introduction mute: exactly the caller's Introduction Worlds; MUTED / UNMUTED on the caller's own row;
//          one Introduction muted mutes no other World and nobody else's; UNAVAILABLE (no row) for an outsider, a random
//          id and a World SUCCESS made Standard; the Stage 4 alerts still refuse an Introduction World
//      B10 bounded requests: the limit is honoured, an invalid limit or source is 22023
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { DFN, PFN, P, createIntroductionRuntime, runVerifier, terminalIds } from './introduction-lifecycle-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, rejected } = rt;

const FN = Object.freeze({
  RESOLVE: 'public.resolve_introductions_capability_v1(uuid)',
  MINE: 'public.read_my_introductions_capability_v1()',
  SERVER_CAPABILITY: 'public.server_read_introductions_capability_v1(uuid[])',
  DELIVERY: 'public.server_read_introductions_proposal_delivery_v1(uuid)',
  LISTER: 'public.server_list_introductions_activity_v1(integer)',
  ALERTS: 'public.list_own_introduction_world_alerts_v1()',
  SET_ALERTS: 'public.set_own_introduction_world_alerts_v1(uuid,boolean)',
});
const SERVER = [FN.SERVER_CAPABILITY, FN.DELIVERY, FN.LISTER];
const HUMAN = [FN.MINE, FN.ALERTS, FN.SET_ALERTS];
const M0167 = readFileSync(new URL('./migrations/0167_introductions_activity_direct_entry_v1.sql', import.meta.url), 'utf8');

// ------------------------------------------------------------------ helpers
const owner = () => asRole('postgres');
const as = (uid) => asRole('authenticated', uid);
const count = async (sql, values = []) => { await owner(); return Number((await rows(sql, values))[0].n); };
async function facts(pairs) { for (const [human, sex, firstName] of pairs) await rt.recordFacts(human, { sex, firstName }); }
async function introduction(first, candidate) {
  await facts([[first, 'FEMALE', 'Mona'], [candidate, 'MALE', 'Omar']]);
  const f = await rt.bringToIntroduction(first, candidate);
  await owner();
  return f;
}
async function server(sql, values = []) {
  await asRole('service_role');
  try { return await rows(sql, values); } finally { await owner(); }
}
const listed = (limit = 100) => server('SELECT * FROM public.server_list_introductions_activity_v1($1)', [limit]);
/** The lister's rows for these humans only, as [event, recipient] pairs (the fixture database is shared by scenarios). */
async function pendingFor(humans) {
  const all = await listed();
  return all.filter((r) => humans.includes(r.recipient_user_id)).map((r) => [r.event, r.recipient_user_id]).sort();
}
async function mine(uid) {
  await as(uid);
  try { return (await rows('SELECT public.read_my_introductions_capability_v1() AS entered'))[0].entered; } finally { await owner(); }
}
const capability = async (ids) => Object.fromEntries((await server('SELECT * FROM public.server_read_introductions_capability_v1($1::uuid[])', [ids]))
  .map((r) => [r.user_id, r.entered]));
/** One publication through the REAL A3-01 server pass, exactly as the CP3 producer names it (fixture copy). */
async function publish(row) {
  const [answer] = await server(`SELECT * FROM public.server_publish_activity_candidate_v1($1, $2, $3, 'INTRODUCTIONS', 'INTRODUCTION', 3,
      false, false, 'INTRODUCTIONS', $4, NULL, NULL, 'INTRODUCTIONS', $5, 'PRODUCT', 'verifier fixture', 'verifier fixture', NULL, NULL,
      false, 'L0', $6, NULL)`, [row.recipient_user_id, row.candidate_key, row.candidate_key, row.world_id, `world:${row.world_id}`, row.occurred_at]);
  return answer.outcome;
}
async function sendAs(uid, world, text) {
  await as(uid);
  try { return (await rows('SELECT * FROM public.send_my_introduction_text_v1($1, $2, $3)', [randomUUID(), world, text]))[0]; } finally { await owner(); }
}
async function endAs(uid, world) {
  await as(uid);
  try { return (await rows('SELECT * FROM public.end_own_introduction_v1($1, $2)', [randomUUID(), world]))[0].outcome; } finally { await owner(); }
}
async function alertsOf(uid) {
  await as(uid);
  try { return await rows('SELECT * FROM public.list_own_introduction_world_alerts_v1()'); } finally { await owner(); }
}
async function setAlerts(uid, world, muted) {
  await as(uid);
  try { return (await rows('SELECT * FROM public.set_own_introduction_world_alerts_v1($1, $2)', [world, muted]))[0].outcome; } finally { await owner(); }
}
async function worldsOf(uid) {
  await as(uid);
  try { return await rows('SELECT * FROM public.list_my_introduction_worlds_v1()'); } finally { await owner(); }
}
const mutesOf = async (humans) => (await (async () => { await owner(); return rows(
  'SELECT user_id, context_ref FROM public.activity_context_mutes WHERE user_id = ANY($1::uuid[]) ORDER BY 1, 2', [humans]); })());
async function requestDeletion(user) {
  await owner();
  const [row] = await rows(
    `INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
     VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [user]);
  return row.id;
}
async function erase(id) {
  await asRole('service_role');
  try { return (await rows('SELECT public.server_erase_account_v1($1) AS outcome', [id]))[0].outcome; } finally { await owner(); }
}

// ------------------------------------------------------------------ A. posture
async function verifyPosture(report) {
  await report.section('A01 seven functions, each once, postgres-owned, DEFINER, pinned; the exact role matrix; read-only but the mute', async () => {
    for (const fn of Object.values(FN)) {
      const p = await rt.functionPosture(fn);
      assert.equal(p.owner, 'postgres', `A01 ${fn} is postgres-owned`);
      assert.equal(p.secdef, true, `A01 ${fn} is SECURITY DEFINER`);
      assert.deepEqual(p.config, ['search_path=""'], `A01 ${fn} pins an empty search_path`);
      const name = fn.slice(fn.indexOf('.') + 1, fn.indexOf('('));
      const [{ n, volatile }] = await rows(`SELECT count(*)::int n, bool_or(p.provolatile = 'v') AS volatile FROM pg_proc p
        JOIN pg_namespace s ON s.oid = p.pronamespace WHERE s.nspname = 'public' AND p.proname = $1`, [name]);
      assert.equal(n, 1, `A01 ${fn} exists once, with no overload`);
      assert.equal(volatile, fn === FN.SET_ALERTS, `A01 ${fn} is ${fn === FN.SET_ALERTS ? 'VOLATILE' : 'STABLE'}`);
      for (const role of ['public', 'anon']) assert.equal(await rt.canExecute(role, fn), false, `A01 ${role} must not execute ${fn}`);
      assert.equal(await rt.canExecute('authenticated', fn), HUMAN.includes(fn), `A01 authenticated ${HUMAN.includes(fn) ? 'executes' : 'must not execute'} ${fn}`);
      assert.equal(await rt.canExecute('service_role', fn), SERVER.includes(fn), `A01 service_role ${SERVER.includes(fn) ? 'executes' : 'must not execute'} ${fn}`);
    }
  });
  await report.section('A02 the migration creates no table, column, grant on a table, gate row or Matching setup call', async () => {
    const sql = M0167.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n');
    assert.doesNotMatch(sql, /CREATE TABLE|ALTER TABLE|ADD COLUMN|ON TABLE|CREATE POLICY|gate_states/iu, 'A02 no relation, policy or gate');
    for (const command of ['activate_matching_participation_v1', 'resume_matching_participation_v1', 'grant_matching_context_v1',
      'set_introduction_profile_v1', 'set_matching_requirements_v1', 'grant_pre_match_disclosure_authority_v1', 'forward_matching_proposal_to_second_core_v1',
      'enroll_my_matching_setup_v1', 'server_forward_approved_matching_proposals_v1']) {
      assert.ok(!sql.includes(command), `A02 0167 names no Matching command (${command})`);
    }
    const [{ n }] = await rows("SELECT count(*)::int n FROM matching_enrollment_private.gate_states");
    assert.equal(n, 0, 'A02 the ENROLLMENT gate still has no row');
  });
}

// ------------------------------------------------------------------ B. behaviour
async function verifyBehaviour(report, H) {
  await owner();
  await q('BEGIN');
  try {
    await report.isolated('B01 the capability truth: never entered false; enrolled, Introduction humans and a retained view true', async () => {
      const [a, b, c, outsider] = H;
      assert.deepEqual(await capability([a, outsider]), { [a]: false, [outsider]: false }, 'B01 nobody has entered yet');
      assert.equal(await mine(a), false, 'B01 the caller reads false');
      const f = await introduction(a, b);
      assert.deepEqual(await capability([a, b, outsider]), { [a]: true, [b]: true, [outsider]: false }, 'B01 the two humans entered');
      assert.deepEqual([await mine(a), await mine(b), await mine(outsider)], [true, true, false], 'B01 each reads only their own truth');
      await facts([[c, 'FEMALE', 'Huda']]);
      await rt.seedMatchable(c, outsider);
      assert.deepEqual(await capability([c]), { [c]: true }, 'B01 an enrolled human (a participation event) has entered');
      assert.ok(f.world, 'B01 fixture');
      await asRole('anon');
      await rejected(() => rows('SELECT public.read_my_introductions_capability_v1()'), ['42501']);
      await owner();
      await rejected(async () => { await asRole('service_role'); await rows('SELECT * FROM public.server_read_introductions_capability_v1($1::uuid[])', [Array.from({ length: 101 }, () => randomUUID())]); }, ['22023']);
      await owner();
    });

    await report.isolated('B02 the delivery source: the second recipient while current and before the deadline, nothing otherwise', async () => {
      const [a, b] = H;
      await facts([[a, 'FEMALE', 'Mona'], [b, 'MALE', 'Omar']]);
      const f = await rt.bringToForwarded(a, b);
      await owner();
      const [binding] = await rows(`SELECT delivery_transition_id FROM ${P.DELIVERY_BINDINGS} WHERE proposal_id = $1 AND recipient_user_id = $2`, [f.proposal, b]);
      const read = await server('SELECT * FROM public.server_read_introductions_proposal_delivery_v1($1)', [binding.delivery_transition_id]);
      assert.equal(read.length, 1, 'B02 one row');
      assert.deepEqual([read[0].recipient_user_id, read[0].proposal_id], [b, f.proposal], 'B02 the candidate and the proposal, nothing else');
      assert.deepEqual(Object.keys(read[0]), ['recipient_user_id', 'proposal_id', 'delivered_at', 'expires_at']);
      assert.deepEqual(await server('SELECT * FROM public.server_read_introductions_proposal_delivery_v1($1)', [randomUUID()]), [], 'B02 an unknown delivery: nothing');
      await rt.backdate(f.proposal);
      assert.deepEqual(await server('SELECT * FROM public.server_read_introductions_proposal_delivery_v1($1)', [binding.delivery_transition_id]), [],
        'B02 after the deadline: nothing');
    });

    await report.isolated('B03 WORLD_BORN for both humans exactly; a published member removes exactly that row; a replay is a DUPLICATE', async () => {
      const [a, b, , outsider] = H;
      const f = await introduction(a, b);
      assert.deepEqual(await pendingFor([a, b, outsider]), [['WORLD_BORN', a], ['WORLD_BORN', b]].sort(), 'B03 both, once each, nobody else');
      const row = (await listed()).find((r) => r.recipient_user_id === a && r.event === 'WORLD_BORN');
      assert.deepEqual([row.world_id, row.source_id, row.candidate_key], [f.world, f.world, `introductions:world-born:${f.world}`]);
      assert.deepEqual(Object.keys(row), ['event', 'recipient_user_id', 'world_id', 'source_id', 'candidate_key', 'occurred_at']);
      assert.equal(await publish(row), 'PUBLISHED');
      assert.deepEqual(await pendingFor([a, b]), [['WORLD_BORN', b]], 'B03 the published recipient is no longer listed');
      assert.equal(await publish(row), 'DUPLICATE', 'B03 the same key again is a DUPLICATE');
      assert.equal(await count('SELECT count(*) n FROM public.activity_items WHERE user_id = $1', [a]), 1, 'B03 one item');
    });

    await report.isolated('B04 HUMAN_TEXT for the other human only; a message its owner deleted tells nobody anything', async () => {
      const [a, b] = H;
      const f = await introduction(a, b);
      const sent = await sendAs(a, f.world, 'hello there');
      assert.equal(sent.outcome, 'COMMITTED');
      const text = (await listed()).filter((r) => r.event === 'HUMAN_TEXT' && [a, b].includes(r.recipient_user_id));
      assert.deepEqual(text.map((r) => [r.recipient_user_id, r.source_id, r.world_id]), [[b, sent.material_id, f.world]], 'B04 the other human, never the author');
      assert.equal(text[0].candidate_key, `introductions:human-text:${sent.material_id}`);
      await as(a);
      const [del] = await rows('SELECT * FROM public.delete_own_shared_world_material_v1($1, $2, $3)', [randomUUID(), f.world, sent.material_id]);
      await owner();
      assert.equal(del.outcome, 'DELETED', 'B04 the owner deleted it');
      assert.deepEqual((await listed()).filter((r) => r.event === 'HUMAN_TEXT' && r.source_id === sent.material_id), [], 'B04 a deleted message is not listed');
    });

    await report.isolated('B05 DISCLOSURE for the counterpart only', async () => {
      const [a, b] = H;
      const f = await introduction(a, b);
      await as(a);
      const [d] = await rows('SELECT * FROM public.disclose_my_introduction_text_v1($1, $2, $3, NULL, $4)', [randomUUID(), f.world, 'CONTACT_METHOD', 'a@example.test']);
      await owner();
      assert.equal(d.outcome, 'DISCLOSED');
      const shared = (await listed()).filter((r) => r.event === 'DISCLOSURE' && r.world_id === f.world);
      assert.deepEqual(shared.map((r) => r.recipient_user_id), [b], 'B05 the counterpart only');
      assert.match(shared[0].candidate_key, /^introductions:disclosure:[0-9a-f-]{36}$/u);
    });

    await report.isolated('B06 ENDED for the human who did not end it; the World\'s live events stop being listed', async () => {
      const [a, b] = H;
      const f = await introduction(a, b);
      await sendAs(b, f.world, 'before the end');
      assert.equal(await endAs(a, f.world), 'ENDED');
      assert.deepEqual(await pendingFor([a, b]), [['ENDED', b]], 'B06 only the other human, only ENDED (no born, no message any more)');
      const [row] = (await listed()).filter((r) => r.recipient_user_id === b);
      assert.equal(row.candidate_key, `introductions:ended:${f.world}`);
    });

    await report.isolated('B07 SUCCESS_REQUESTED for each approver who has not approved, no longer for one who has', async () => {
      const [a, b] = H;
      await facts([[a, 'FEMALE', 'Mona'], [b, 'MALE', 'Omar']]);
      const f = await rt.bringToSuccessProposed(a, b);
      await owner();
      const success = async () => (await listed()).filter((r) => r.event === 'SUCCESS_REQUESTED' && r.world_id === f.world).map((r) => r.recipient_user_id).sort();
      assert.deepEqual(await success(), [a, b].sort(), 'B07 both required approvers');
      await rt.actAs(a);
      await rt.approveSuccess(randomUUID(), f.version, null);
      await owner();
      assert.deepEqual(await success(), [b], 'B07 the approver who approved is no longer listed');
    });

    await report.isolated('B08 the other human\'s erasure: the retained-view holder is listed ENDED once; nothing is left of the erased human', async () => {
      const [a, b] = H;
      const f = await introduction(a, b);
      await publish((await listed()).find((r) => r.recipient_user_id === a));
      assert.equal(await setAlerts(a, f.world, true), 'MUTED');
      assert.equal(await erase(await requestDeletion(a)), 'ERASED', 'B08 the real 0164 erasure');
      assert.deepEqual(await pendingFor([a, b]), [['ENDED', b]], 'B08 the holder: ENDED once (the World is no longer live)');
      assert.equal(await count('SELECT count(*) n FROM public.activity_items WHERE user_id = $1', [a]), 0, 'B08 the erased human\'s items are gone');
      assert.deepEqual(await mutesOf([a]), [], 'B08 and their mutes');
      assert.deepEqual(await capability([b]), { [b]: true }, 'B08 the holder still has entered (the retained view)');
      assert.deepEqual((await alertsOf(b)).map((r) => [r.world_id, r.introduction_state, r.muted]), [[f.world, 'ENDED', false]], 'B08 the holder may still mute it');
    });

    await report.isolated('B09 per-Introduction mute: own Worlds only, own row only, one World only; UNAVAILABLE without a row otherwise', async () => {
      const [a, b, c, d] = H;
      const f = await introduction(a, b);
      const g = await introduction(c, d);
      assert.deepEqual((await alertsOf(a)).map((r) => [r.world_id, r.muted]), (await worldsOf(a)).map((w) => [w.world_id, false]), 'B09 exactly the discovery list');
      assert.equal(await setAlerts(a, f.world, true), 'MUTED');
      assert.equal(await setAlerts(a, f.world, true), 'MUTED', 'B09 idempotent');
      assert.deepEqual(await mutesOf([a, b, c, d]), [{ user_id: a, context_ref: f.world }], 'B09 the caller\'s own row, this World only');
      assert.deepEqual((await alertsOf(a)).map((r) => r.muted), [true]);
      assert.deepEqual((await alertsOf(b)).map((r) => r.muted), [false], 'B09 the other human is not muted');
      assert.deepEqual((await alertsOf(c)).map((r) => [r.world_id, r.muted]), [[g.world, false]], 'B09 another Introduction is untouched');
      for (const [who, world] of [[a, g.world], [c, f.world], [a, randomUUID()]]) {
        assert.equal(await setAlerts(who, world, true), 'UNAVAILABLE', 'B09 not theirs / unknown: one answer');
      }
      await as(c);
      assert.equal((await rows('SELECT * FROM public.set_own_shared_world_alerts_v1($1, true)', [g.world]))[0].outcome, 'UNAVAILABLE',
        'B09 the Stage 4 alerts still refuse an Introduction World (no mixing)');
      await owner();
      assert.deepEqual(await mutesOf([a, b, c, d]), [{ user_id: a, context_ref: f.world }], 'B09 no other row was written');
      assert.equal(await setAlerts(a, f.world, false), 'UNMUTED');
      assert.deepEqual(await mutesOf([a]), []);
      assert.equal(await endAs(c, g.world), 'ENDED');
      assert.equal(await setAlerts(d, g.world, true), 'MUTED', 'B09 an ended Introduction is still the reader\'s own');
      await asRole('anon');
      await rejected(() => rows('SELECT * FROM public.set_own_introduction_world_alerts_v1($1, true)', [f.world]), ['42501']);
      await owner();
    });

    await report.isolated('B10 after SUCCESS the World is Standard: no longer an Introduction to mute or to list', async () => {
      const [a, b] = H;
      await facts([[a, 'FEMALE', 'Mona'], [b, 'MALE', 'Omar']]);
      const f = await rt.bringToSuccessApproved(a, b);
      await owner();
      await rt.commitSuccess(terminalIds(), f.version);
      assert.equal(await setAlerts(a, f.world, true), 'UNAVAILABLE', 'B10 a Standard World is not an Introduction');
      assert.deepEqual(await pendingFor([a, b]), [], 'B10 nothing is listed for a World that is no longer an Introduction');
    });

    await report.isolated('B11 bounded requests', async () => {
      for (const limit of [0, 101, null]) {
        await rejected(async () => { await asRole('service_role'); await rows('SELECT * FROM public.server_list_introductions_activity_v1($1)', [limit]); }, ['22023']);
        await owner();
      }
      await rejected(async () => { await asRole('service_role'); await rows('SELECT * FROM public.server_read_introductions_proposal_delivery_v1(NULL)'); }, ['22023']);
      await owner();
      await rejected(async () => { await as(H[0]); await rows('SELECT * FROM public.set_own_introduction_world_alerts_v1(NULL, true)'); },
        ['22023']);
      await owner();
      const [a, b] = H;
      await introduction(a, b);
      assert.equal((await listed(1)).length, 1, 'B11 the limit is honoured');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
await runVerifier('0167', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  setStage('fixtures');
  await rt.provisionHumans(humans);
  const report = createScenarioReport('0167', { query: q, restore: () => owner() });

  setStage('posture');
  await verifyPosture(report);

  const seams = [];
  for (const fn of [PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) seams.push(await rt.captureMatchingSeam(fn));
  try {
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    setStage('behaviour');
    await verifyBehaviour(report, humans);
  } finally {
    await owner();
    for (const seam of seams) await rt.restoreMatchingSeam(seam);
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  for (const seam of [PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) {
    assert.equal(await rt.seamClearance(seam.slice(0, seam.indexOf('('))), 'NOT_EVALUATED', `${seam} is fail-closed again`);
  }
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows('SELECT count(*)::int AS residue FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
  assert.equal(residue, 0, 'the run leaves nothing behind');
}, () => rt.client.end().catch(() => undefined));
