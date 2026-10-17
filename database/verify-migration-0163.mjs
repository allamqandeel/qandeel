// S6-06 (CP1) - migration 0163: Introduction SUCCESS and post-Introduction reactivation.
//
// Runs against a FULLY migrated database (0001 .. 0163) and proves, through the real authenticated boundaries:
//
//   A  posture        authenticated-only, DEFINER, pinned, no human identity parameter; the system attempt and every
//                     frozen core and seam stay executable by no application role; the approval boundary never runs the
//                     commit; nothing calls the success preparation; production shape answers nothing and writes nothing
//   B  SUCCESS        two humans approve, each in their own transaction, and see only their own state; the system attempt
//                     completes exactly once whoever triggers it; a closed gate, a lock conflict (40001) injected inside
//                     the commit, or a withdrawal each leave both approvals untouched, open no gate and write nothing,
//                     and a later attempt completes safely (condition 3); END and SUCCESS keep one winner
//   C  reactivation   one explicit, fully revalidated act; gated last; nothing revived; stale state is CHANGED
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, D, DFN, PFN, createIntroductionRuntime, runVerifier } from './introduction-lifecycle-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;

const P = 'introduction_sharing_private';
const HUMAN = [
  'public.read_my_introduction_success_v1(uuid)',
  'public.approve_my_introduction_success_v1(uuid,uuid,uuid,uuid)',
  'public.withdraw_my_introduction_success_v1(uuid,uuid,uuid,uuid)',
  'public.complete_my_introduction_success_v1(uuid)',
  'public.reactivate_my_introductions_v1(uuid,uuid,text)',
];
const HIDDEN = [
  `${P}.attempt_introduction_success_v1(uuid)`,
  DFN.PREPARE_SUCCESS, DFN.APPROVAL_CORE, DFN.APPROVE, DFN.WITHDRAW, DFN.SUCCESS, DFN.REACTIVATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE,
];
const SEAMS = [PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE];
const capturedSeams = [];

const as = (uid) => asRole('authenticated', uid);
const owner = () => asRole('postgres');
async function call(uid, sql, values = []) {
  await as(uid);
  try { return await rows(sql, values); } finally { await owner(); }
}
const one = async (promise) => (await promise)[0];
const readOf = async (uid, world) => (await call(uid, 'SELECT * FROM public.read_my_introduction_success_v1($1)', [world]))[0] ?? null;
const approve = async (uid, world, version, expected = null, command = randomUUID()) =>
  ({ ...(await one(call(uid, 'SELECT * FROM public.approve_my_introduction_success_v1($1, $2, $3, $4)', [command, world, version, expected]))), command });
const withdraw = async (uid, world, version, expected, command = randomUUID()) =>
  ({ ...(await one(call(uid, 'SELECT * FROM public.withdraw_my_introduction_success_v1($1, $2, $3, $4)', [command, world, version, expected]))), command });
const complete = async (uid, world) => (await one(call(uid, 'SELECT * FROM public.complete_my_introduction_success_v1($1)', [world]))).outcome;
const reactivate = async (uid, expected, channel = null, command = randomUUID()) =>
  ({ ...(await one(call(uid, 'SELECT * FROM public.reactivate_my_introductions_v1($1, $2, $3)', [command, expected, channel]))), command });
const endAs = async (uid, world) => (await one(call(uid, 'SELECT * FROM public.end_own_introduction_v1($1, $2)', [randomUUID(), world]))).outcome;
const restoreSeams = async () => { for (const seam of capturedSeams) await rt.restoreMatchingSeam(seam); };

async function proposed(first, candidate) {
  await rt.recordFacts(first, { sex: 'FEMALE', firstName: 'Mona' });
  await rt.recordFacts(candidate, { sex: 'MALE', firstName: 'Omar' });
  const f = await rt.bringToSuccessProposed(first, candidate);
  await owner();
  return f;
}
/** Both humans' approval acts and pointers, and the terminal and World truth: what a failed attempt must not move. */
async function successTruth(f) {
  await owner();
  return {
    events: (await rows(`SELECT id, approver_user_id, resulting_state FROM ${D.APPROVALS} WHERE transition_version_id = $1 ORDER BY id`, [f.version])),
    pointers: (await rows(`SELECT approver_user_id, current_event_id FROM ${D.APPROVAL_STATE} WHERE transition_version_id = $1 ORDER BY approver_user_id`, [f.version])),
    terminal: Number((await rows(`SELECT count(*) n FROM ${D.TERMINAL} WHERE introduction_record_id = $1`, [f.record]))[0].n),
    world: (await rows('SELECT lifecycle, phase FROM public.shared_worlds WHERE id = $1', [f.world]))[0],
    gate: await rt.seamClearance(DFN.SUCCESS_GATE.slice(0, DFN.SUCCESS_GATE.indexOf('('))),
  };
}

// ------------------------------------------------------------------ A. posture
async function verifyPosture(report) {
  await report.section('A01 every human boundary: postgres-owned, DEFINER, pinned, authenticated-only, no human identity, writes nothing itself', async () => {
    for (const fn of HUMAN) {
      const p = await rt.functionPosture(fn);
      assert.deepEqual([p.owner, p.secdef, p.config], ['postgres', true, ['search_path=""']], `A01 ${fn}`);
      assert.equal(await rt.canExecute('authenticated', fn), true, `A01 authenticated executes ${fn}`);
      for (const role of ['public', 'anon', 'service_role']) assert.equal(await rt.canExecute(role, fn), false, `A01 ${role} must not execute ${fn}`);
      for (const name of await rt.inputParameters(fn)) assert.doesNotMatch(name, /user|owner|actor|approver|counterpart|recipient/iu, `A01 ${fn} takes no human`);
      const src = p.prosrc.replace(/--[^\n]*/gu, '');
      assert.match(src, /v_user uuid := \(SELECT auth\.uid\(\)\);/u, `A01 ${fn}: the human is auth.uid()`);
      assert.doesNotMatch(src, /INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|EXECUTE\s|public\.users|prepare_introduction_success/iu, `A01 ${fn} writes nothing itself`);
    }
  });

  await report.section('A02 the system attempt and every frozen core and seam are executable by no application role; no service_role path', async () => {
    for (const fn of HIDDEN) for (const role of ['public', ...APP_ROLES]) assert.equal(await rt.canExecute(role, fn), false, `A02 ${role} must not execute ${fn}`);
    const attempt = (await rt.functionPosture(`${P}.attempt_introduction_success_v1(uuid)`)).prosrc.replace(/--[^\n]*/gu, '');
    assert.doesNotMatch(attempt, /auth\.uid|approval_events|approval_state|approve_introduction|record_introduction_success_approval/iu,
      'A02 the system attempt reads no session subject and touches no approval');
    const approveSrc = (await rt.functionPosture(HUMAN[1])).prosrc.replace(/--[^\n]*/gu, '');
    assert.doesNotMatch(approveSrc, /commit_introduction_success|attempt_introduction_success/iu, 'A02 the approval never runs the commit in its transaction');
    assert.doesNotMatch(approveSrc, /SAVEPOINT/iu, 'A02 and uses no SAVEPOINT');
    const callers = await rows(`SELECT p.oid::regprocedure::text fn FROM pg_proc p
      WHERE p.prosrc ~ 'prepare_introduction_success_transition_v1\\s*\\(' AND p.oid <> $1::regprocedure`, [DFN.PREPARE_SUCCESS]);
    assert.deepEqual(callers, [], 'A02 nothing calls the success preparation (Stage 8A)');
    for (const seam of SEAMS) assert.equal(await rt.seamClearance(seam.slice(0, seam.indexOf('('))), 'NOT_EVALUATED', `A02 ${seam}`);
  });
}

// ------------------------------------------------------------------ B. SUCCESS, C. reactivation
async function verifyBehaviour(report, H) {
  const [a, b, outsider] = H;
  await owner();
  await q('BEGIN');
  try {
    await report.isolated('A03 production shape: no version, so nothing to approve; completion is PENDING; reactivation not available; nothing written', async () => {
      await rt.recordFacts(a, { sex: 'FEMALE', firstName: 'Mona' });
      await rt.recordFacts(b, { sex: 'MALE', firstName: 'Omar' });
      const f = await rt.bringToIntroduction(a, b);
      await owner();
      await restoreSeams();
      assert.deepEqual(await readOf(a, f.world), { introduction_state: 'ACTIVE', transition_version_id: null, my_approval_state: null, my_current_event_id: null },
        'A03 no version exists before Stage 8A');
      assert.equal((await approve(a, f.world, randomUUID())).outcome, 'UNAVAILABLE', 'A03 nothing to approve');
      assert.equal(await complete(a, f.world), 'PENDING', 'A03 completion is PENDING');
      const act = await rt.currentActOf(a);
      assert.equal((await reactivate(a, act.id)).outcome, 'NOT_ELIGIBLE', 'A03 no reactivation during a live Introduction');
      assert.equal(Number((await rows(`SELECT count(*) n FROM ${D.TERMINAL} WHERE introduction_record_id = $1`, [f.record]))[0].n), 0, 'A03 no terminal commit');
    });

    await report.isolated('B01 one approval completes nothing, and each human sees only their own state', async () => {
      const f = await proposed(a, b);
      assert.deepEqual(await readOf(a, f.world), { introduction_state: 'ACTIVE', transition_version_id: f.version, my_approval_state: 'NONE', my_current_event_id: null });
      const ap = await approve(a, f.world, f.version);
      assert.equal(ap.outcome, 'APPROVED');
      assert.equal((await readOf(a, f.world)).my_approval_state, 'APPROVED', 'B01 my own state');
      assert.equal((await readOf(b, f.world)).my_approval_state, 'NONE', 'B01 the other human learns nothing of it');
      assert.equal(await complete(a, f.world), 'PENDING', 'B01 one approval completes nothing');
      assert.equal(await complete(b, f.world), 'PENDING', 'B01 and says nothing to the other either');
      assert.equal((await successTruth(f)).terminal, 0);
      assert.equal(await readOf(outsider, f.world), null, 'B01 an outsider reads nothing');
      assert.equal((await approve(outsider, f.world, f.version)).outcome, 'UNAVAILABLE', 'B01 an outsider approves nothing');
      assert.equal(await complete(outsider, f.world), 'UNAVAILABLE', 'B01 nor completes anything');
    });

    await report.isolated('B02 the second approval, then the system attempt in its own transaction: exactly one terminal commit, whoever triggers it', async () => {
      const f = await proposed(a, b);
      await approve(a, f.world, f.version);
      await approve(b, f.world, f.version);
      const approvals = (await successTruth(f)).events;
      assert.equal(await complete(b, f.world), 'COMPLETED', 'B02 completed');
      assert.equal(await complete(a, f.world), 'COMPLETED', 'B02 the other human\'s attempt replays it');
      assert.equal(await complete(b, f.world), 'COMPLETED', 'B02 a retry replays it');
      const after = await successTruth(f);
      assert.deepEqual([after.terminal, after.world], [1, { lifecycle: 'ACTIVE', phase: 'STANDARD' }], 'B02 one commit, the same World, Standard');
      assert.deepEqual(after.events, approvals, 'B02 the system wrote no approval');
      const [t] = await rows(`SELECT terminal_outcome, ending_actor_user_id FROM ${D.TERMINAL} WHERE introduction_record_id = $1`, [f.record]);
      assert.deepEqual(t, { terminal_outcome: 'COMPLETED', ending_actor_user_id: null }, 'B02 a system execution with no actor');
      assert.equal((await readOf(a, f.world)).introduction_state, 'SHARED_WORLD');
      for (const human of [a, b]) {
        const act = await rt.currentActOf(human);
        assert.deepEqual([act.resulting_state, act.resulting_pause_reason], ['PAUSED', 'POST_SUCCESS'], 'B02 Matching stays paused, POST_SUCCESS');
      }
    });

    await report.isolated('B03 both approve, the gate is closed: PENDING, both approvals intact, no gate opened, nothing written; the gate clears: one commit (condition 3)', async () => {
      const f = await proposed(a, b);
      await approve(a, f.world, f.version);
      await approve(b, f.world, f.version);
      await rt.restoreMatchingSeam(capturedSeams.find((s) => JSON.stringify(s).includes('resolve_introduction_success_prerequisites_v1')));
      const before = await successTruth(f);
      assert.equal(before.gate, 'NOT_EVALUATED');
      for (let round = 0; round < 3; round += 1) for (const human of [a, b]) assert.equal(await complete(human, f.world), 'PENDING', 'B03 PENDING while closed');
      assert.deepEqual(await successTruth(f), before, 'B03 approvals, pointers, World and gate exactly as they were; no terminal commit');
      await rt.clearAllSeams();
      assert.equal(await complete(a, f.world), 'COMPLETED', 'B03 once the gate allows, the attempt completes');
      assert.equal((await successTruth(f)).terminal, 1, 'B03 exactly once');
    });

    await report.isolated('B04 a lock conflict (40001) inside the commit: PENDING, the approvals untouched, nothing half-done; the retry completes once (condition 3)', async () => {
      const f = await proposed(a, b);
      await approve(a, f.world, f.version);
      await approve(b, f.world, f.version);
      await q(`CREATE FUNCTION public.s6_06_inject_commit_conflict_v1() RETURNS trigger LANGUAGE plpgsql AS $inject$
               BEGIN RAISE EXCEPTION 'injected serialization failure' USING ERRCODE = '40001'; END $inject$`);
      await q(`CREATE TRIGGER s6_06_inject_commit_conflict BEFORE INSERT ON ${D.TERMINAL}
               FOR EACH ROW EXECUTE FUNCTION public.s6_06_inject_commit_conflict_v1()`);
      const before = await successTruth(f);
      assert.equal(await complete(a, f.world), 'PENDING', 'B04 the failed attempt answers PENDING');
      const failed = await successTruth(f);
      assert.deepEqual(failed, before, 'B04 both approvals, both pointers, the World and the gate are exactly as before');
      assert.equal(Number((await rows(`SELECT count(*) n FROM ${D.COMPLETED} WHERE introduction_record_id = $1`, [f.record]))[0].n), 0,
        'B04 no completed fact survives the failed attempt');
      const claims = await rows("SELECT claim_state FROM public.matching_active_introduction_claims WHERE introduction_record_id = $1", [f.record]);
      assert.deepEqual(claims.map((c) => c.claim_state), ['HELD', 'HELD'], 'B04 both claims still HELD');
      await q(`DROP TRIGGER s6_06_inject_commit_conflict ON ${D.TERMINAL}`);
      assert.equal(await complete(b, f.world), 'COMPLETED', 'B04 the retry completes');
      assert.equal(await complete(a, f.world), 'COMPLETED', 'B04 and replays');
      assert.equal((await successTruth(f)).terminal, 1, 'B04 with exactly one terminal commit');
    });

    await report.isolated('B05 a withdrawal before completion keeps it from completing; withdraw is ungated; a stale token is CHANGED', async () => {
      const f = await proposed(a, b);
      const ap = await approve(a, f.world, f.version);
      await restoreSeams();
      const w = await withdraw(a, f.world, f.version, ap.command);
      assert.equal(w.outcome, 'WITHDRAWN', 'B05 withdraw works with every gate closed');
      await rt.clearAllSeams();
      await approve(b, f.world, f.version);
      assert.equal(await complete(b, f.world), 'PENDING', 'B05 a withdrawn approval is not approval');
      assert.equal((await approve(a, f.world, f.version, ap.command)).outcome, 'CHANGED', 'B05 a stale expected token is CHANGED');
      assert.equal((await approve(a, f.world, f.version, w.command)).outcome, 'APPROVED', 'B05 the current token approves again');
      assert.equal(await complete(a, f.world), 'COMPLETED');
    });

    await report.isolated('B06 a new approval needs the gate; a retry of an approval already made is answered from history', async () => {
      const f = await proposed(a, b);
      const ap = await approve(a, f.world, f.version);
      await restoreSeams();
      assert.equal((await approve(b, f.world, f.version)).outcome, 'NOT_AVAILABLE_NOW', 'B06 a new approval with the gate closed');
      assert.deepEqual([(await approve(a, f.world, f.version, null, ap.command)).outcome], ['APPROVED'], 'B06 a retry of a made approval');
      assert.equal((await approve(a, f.world, f.version, null, randomUUID())).outcome, 'NOT_AVAILABLE_NOW', 'B06 a new command is new');
    });

    await report.isolated('B07 END against a pending SUCCESS: END wins, the attempt is UNAVAILABLE, one terminal outcome', async () => {
      const f = await proposed(a, b);
      await approve(a, f.world, f.version);
      await approve(b, f.world, f.version);
      await rt.restoreMatchingSeam(capturedSeams.find((s) => JSON.stringify(s).includes('resolve_introduction_success_prerequisites_v1')));
      assert.equal(await complete(a, f.world), 'PENDING');
      assert.equal(await endAs(b, f.world), 'ENDED', 'B07 END is never blocked by a pending SUCCESS');
      await rt.clearAllSeams();
      assert.equal(await complete(a, f.world), 'UNAVAILABLE', 'B07 nothing to complete after END');
      const [t] = await rows(`SELECT terminal_outcome FROM ${D.TERMINAL} WHERE introduction_record_id = $1`, [f.record]);
      assert.equal(t.terminal_outcome, 'CLOSED', 'B07 the one terminal outcome is END');
    });

    await report.isolated('C01 reactivation after END: gated last, explicit, revalidated, nothing revived; a retry is the same act; stale is CHANGED', async () => {
      const f = await proposed(a, b);
      assert.equal(await endAs(a, f.world), 'ENDED');
      const act = await rt.currentActOf(a);
      assert.deepEqual([act.resulting_state, act.resulting_pause_reason], ['PAUSED', 'POST_INTRODUCTION']);
      await restoreSeams();
      const before = Number((await rows('SELECT count(*) n FROM public.matching_participation_events WHERE participant_user_id = $1', [a]))[0].n);
      assert.equal((await reactivate(a, act.id)).outcome, 'NOT_AVAILABLE_NOW', 'C01 the CW2-08 gate is closed');
      assert.equal(Number((await rows('SELECT count(*) n FROM public.matching_participation_events WHERE participant_user_id = $1', [a]))[0].n), before,
        'C01 and nothing is written');
      await rt.clearAllSeams();
      assert.equal((await reactivate(a, randomUUID())).outcome, 'CHANGED', 'C01 a stale token is CHANGED');
      const proposals = Number((await rows('SELECT count(*) n FROM public.matching_proposals'))[0].n);
      const r = await reactivate(a, act.id);
      assert.deepEqual([r.outcome, r.participation_state], ['REACTIVATED', 'ACTIVE'], 'C01 reactivated by the human\'s own act');
      assert.deepEqual([(await reactivate(a, act.id, null, r.command)).outcome], ['REACTIVATED'], 'C01 a retry is the same act');
      assert.equal(Number((await rows('SELECT count(*) n FROM public.matching_proposals'))[0].n), proposals, 'C01 no proposal is created or revived');
      const otherAct = await rt.currentActOf(b);
      assert.deepEqual([otherAct.resulting_state, otherAct.resulting_pause_reason], ['PAUSED', 'POST_INTRODUCTION'], 'C01 the other human is untouched');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ G. the two humans' attempts at once
async function verifyRaces(report, H) {
  const [x, y] = H;
  await report.section('G01 both humans trigger the completion at once: one waits on the World lock, both answer COMPLETED, one terminal commit', async () => {
    try {
      await q('BEGIN');
      const f = await proposed(x, y);
      await approve(x, f.world, f.version);
      await approve(y, f.world, f.version);
      await q('COMMIT');
      const extra = await rt.openExtra();
      try {
        await q('BEGIN');
        await as(x);
        const [first] = await rows('SELECT * FROM public.complete_my_introduction_success_v1($1)', [f.world]);
        await owner();
        await extra.qx('BEGIN');
        await extra.qx('SET LOCAL ROLE authenticated');
        await extra.qx("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: y, role: 'authenticated' })]);
        const pending = extra.qx('SELECT * FROM public.complete_my_introduction_success_v1($1)', [f.world]).then((r) => r.rows[0], (e) => e);
        assert.equal(await rt.waitForLockWait((t, v) => q(t, v), extra.pid), true, 'G01 the second attempt waits');
        await q('COMMIT');
        const late = await pending;
        await extra.qx('COMMIT');
        assert.ok(!(late instanceof Error), `G01 answered, not failed: ${late?.message ?? ''}`);
        assert.deepEqual([first.outcome, late.outcome], ['COMPLETED', 'COMPLETED']);
      } finally {
        await q('ROLLBACK').catch(() => undefined);
        await owner();
        await extra.close();
      }
      const [{ n }] = await rows(`SELECT count(*)::int n FROM ${D.TERMINAL} t JOIN public.introduction_records r ON r.id = t.introduction_record_id
        WHERE r.lower_user_id = ANY($1::uuid[])`, [[x, y]]);
      assert.equal(n, 1, 'G01 exactly one terminal commit');
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await owner();
      await rt.cleanupIntroductionRace([x, y]);
    }
  });
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID()];
const raceHumans = [randomUUID(), randomUUID()];
await runVerifier('0163', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '60s'");
  setStage('fixtures');
  await rt.provisionHumans([...humans, ...raceHumans]);
  const report = createScenarioReport('0163', { query: q, restore: () => owner() });
  setStage('posture');
  await verifyPosture(report);
  for (const fn of SEAMS) capturedSeams.push(await rt.captureMatchingSeam(fn));
  try {
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    setStage('behaviour');
    await verifyBehaviour(report, humans);
    setStage('races');
    await verifyRaces(report, raceHumans);
  } finally {
    await owner();
    await restoreSeams();
  }
  report.print();
  report.assertAllPassed();
  setStage('teardown');
  for (const seam of SEAMS) {
    assert.equal(await rt.seamClearance(seam.slice(0, seam.indexOf('('))), 'NOT_EVALUATED', `${seam} is fail-closed again`);
  }
  await rt.cleanupIntroductionRace([...humans, ...raceHumans]);
  await rt.removeFixtureHumans([...humans, ...raceHumans]);
  const [{ residue }] = await rows('SELECT count(*) AS residue FROM public.users WHERE id = ANY($1::uuid[])', [[...humans, ...raceHumans]]);
  assert.equal(Number(residue), 0, 'the run leaves nothing behind');
}, () => rt.client.end().catch(() => undefined));
