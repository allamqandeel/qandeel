// S6-07 CP4 - the final integration journey on real PostgreSQL, through the HUMAN boundaries wherever one exists:
//
//   Enrollment (CP1, the governed boundary) -> Proposal (the fixture producer: no production conclusion producer exists,
//   QAN-BL-MATCH-03) -> First Approval (S6-04, the first recipient's own token) -> Forward (CP2, the dispatcher) ->
//   Second Approval = Mutual Match (S6-05, the candidate's own token) -> Introduction World (S6-05 / S6-06) -> Activity
//   sources and Direct Entry truth (CP3: the listers name the legitimate recipient only; the entry re-reads on the
//   recipient's own token) -> Export (CP4: requested on a password-proof token, prepared by the server pass, read by its
//   owner through 0130 - the reader's own Matching / Introductions section).
//
//   J01 production stays closed: with the real ENROLLMENT gate nothing enrolls; with the real CW2-08 seam nothing is
//       forwarded and the candidate sees nothing
//   J02 the whole journey, and each export of it
//   J03 the first recipient declines: nothing is ever forwarded; the candidate was never reached and exports nothing
//   J04 the candidate declines: no World; each export says its own screen word
//   J05 the deadline passes after the forward: nothing can be accepted; the word is the screen's
//   J06 a consent withdrawn before the forward (the candidate's Matching Context Grant): nothing is forwarded, and the
//       withdrawal is in the candidate's own export
//   J07 a pending account deletion holds the forward; END tells the other human; the erasure leaves the reader their own
//       words and nothing of the erased human
//
// SYNTHETIC fixture humans; everything rolls back; the seams are replaced after J01 and restored byte for byte.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { DFN, PFN, createIntroductionRuntime, runVerifier } from './introduction-lifecycle-verifier-support.mjs';
import { CLEAN } from './matching-match-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
const PREP = 'introductions_preparation_private';
const S = 'matching_enrollment_private';
const V = Object.freeze({ P: 'S6_07_JOURNEY_FIXTURE_PARTICIPATION_V1', C: 'S6_07_JOURNEY_FIXTURE_CONTEXT_V1', D: 'S6_07_JOURNEY_FIXTURE_DISCLOSURE_V1' });
const SCREEN_WORD = Object.freeze({ AWAITING_YOU: 'awaiting you', IN_PROGRESS: 'in progress', CLOSED_BY_YOU: 'closed by you',
  MATCH_CONCLUDED: 'matched', NO_LONGER_AVAILABLE: 'no longer available' });
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;

// ------------------------------------------------------------------ helpers
const owner = () => asRole('postgres');
async function call(uid, sql, values = [], claims = null) {
  if (claims === null) await asRole('authenticated', uid);
  else {
    await q('RESET ROLE');
    await q('SET LOCAL ROLE authenticated');
    await q("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: uid, role: 'authenticated', ...claims })]);
  }
  try { return await rows(sql, values); } finally { await owner(); }
}
async function svc(sql, values = []) {
  await asRole('service_role');
  try { return await rows(sql, values); } finally { await owner(); }
}
const one = async (promise) => (await promise)[0];
async function openFixtureGate() {
  await owner();
  await q(`SELECT * FROM ${S}.set_gate_v1('ENABLED', 'SATISFIED', 'verify-s6-07-journey', 'fixture gate, not a launch decision')`);
}
async function installFixtureTexts() {
  await owner();
  for (const [purpose, version] of [['MATCHING_PARTICIPATION', V.P], ['MATCHING_CONTEXT_GRANT', V.C], ['PRE_MATCH_DISCLOSURE_AUTHORITY', V.D]]) {
    await q(`SELECT ${S}.install_consent_text_v1($1, $2, $3, $4)`,
      [version, purpose, `نص تجريبي للتحقق (${purpose}) - ليس نصًا معتمدًا`, `journey fixture text (${purpose}), not approved copy`]);
  }
}
const draftVersion = async (human) => { await owner(); return Number((await rows(`SELECT ${PREP}.draft_version_v1($1) AS v`, [human]))[0].v); };
async function reviewedDraft(human, { firstName, sex }) {
  await owner();
  await q(`SELECT * FROM ${PREP}.set_gate_v1('PREPARATION', 'ENABLED', 'SATISFIED', 'verify-s6-07-journey', 'fixture gate')`);
  for (const [kind, payload] of [
    ['SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName }], ['SET_FACT', { fact: 'SEX', sex }],
    ['SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: 1993, month: 3 }], ['SET_FACT', { fact: 'BROAD_AREA', countryCode: 'EG', regionCode: 'EG-C' }],
    ['SET_FACT', { fact: 'MARITAL_STATUS', maritalStatus: 'NEVER_MARRIED' }],
    ...['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS'].map((fact) => ['CONFIRM_FACT', { fact }]),
    ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'NONE_ADDITIONAL', items: [] }], ['SET_REQUIREMENTS', { strength: 'SOFT', answer: 'NONE', items: [] }],
    ['CONFIRM_REVIEW', {}],
  ]) {
    const expected = await draftVersion(human);
    const [{ a }] = await call(human, 'SELECT public.apply_own_matching_preparation_command_v1($1, $2, $3, $4) AS a', [randomUUID(), expected, kind, payload]);
    assert.ok(['APPLIED', 'NOT_READY_FOR_REVIEW'].includes(a.outcome), `fixture ${kind}: ${JSON.stringify(a)}`);
  }
  return draftVersion(human);
}
const enroll = async (human, draft) => one(call(human, 'SELECT * FROM public.enroll_my_matching_setup_v1($1, $2, $3, $4, $5, $6)',
  [randomUUID(), 'ENROLL', draft, V.P, V.C, V.D]));
async function enrolledPair(first, candidate) {
  for (const [human, firstName, sex] of [[first, 'Salma', 'FEMALE'], [candidate, 'Yusuf', 'MALE']]) {
    const answer = await enroll(human, await reviewedDraft(human, { firstName, sex }));
    assert.equal(answer.outcome, 'ENROLLED', `the governed enrollment of the fixture human (${JSON.stringify(answer)})`);
  }
}
/** The fixture producer: a snapshot, one permitted conclusion each way through the REAL filter, prepared and offered. */
async function offered(first, candidate) {
  // CW2-06B B4: an enrollee's zero-field authority is lawful only under a Product field policy that permits zero keys.
  const f = await rt.seedMatchable(first, candidate, { safeFieldKeys: [] });
  const snapshot = randomUUID();
  await rt.capture(snapshot, f.pair, first, candidate);
  const forFirst = await rt.permitted(snapshot, first, candidate, `${CLEAN} A settled and unhurried outlook on both sides.`);
  await rt.permitted(snapshot, candidate, first, `${CLEAN} The same unhurried outlook, from the other side of it.`);
  const proposal = randomUUID();
  await rt.prepare(proposal, snapshot, first);
  await rt.offer(randomUUID(), proposal, randomUUID(), forFirst.id);
  await owner();
  return proposal;
}
const mine = (uid, proposal) => call(uid, 'SELECT * FROM public.get_my_matching_proposal_v1($1)', [proposal]);
const viewOf = async (uid, proposal) => (await mine(uid, proposal))[0]?.recipient_view_id ?? null;
const screenWord = async (uid, proposal) => { const [r] = await mine(uid, proposal); return r ? SCREEN_WORD[r.neutral_outcome] : null; };
const approve = async (uid, proposal) => one(call(uid, 'SELECT * FROM public.approve_my_matching_proposal_forward_v1($1, $2, $3)', [randomUUID(), proposal, await viewOf(uid, proposal)]));
const decline = async (uid, proposal) => one(call(uid, 'SELECT * FROM public.decline_my_matching_proposal_v1($1, $2, $3)', [randomUUID(), proposal, await viewOf(uid, proposal)]));
const accept = async (uid, proposal) => one(call(uid, 'SELECT * FROM public.accept_my_matching_proposal_v1($1, $2, $3)', [randomUUID(), proposal, await viewOf(uid, proposal)]));
const dispatch = async () => (await one(svc('SELECT * FROM public.server_forward_approved_matching_proposals_v1(1)'))).outcome;
const deliveries = async () => svc('SELECT * FROM public.server_list_proposal_delivery_activity_reconciliation_v1(100)');
const events = async (humans) => (await svc('SELECT * FROM public.server_list_introductions_activity_v1(100)'))
  .filter((r) => humans.includes(r.recipient_user_id)).map((r) => `${r.event}:${r.recipient_user_id}`).sort();
const capability = async (uid) => (await one(call(uid, 'SELECT public.read_my_introductions_capability_v1() AS entered'))).entered;
const worldsOf = (uid) => call(uid, 'SELECT * FROM public.list_my_introduction_worlds_v1()');
/** Export My Data through 0130 itself: requested on a password-proof token, prepared by the server pass, read by its owner. */
async function exported(uid) {
  const [requested] = await call(uid, 'SELECT * FROM public.request_own_data_export_v1($1)', [randomUUID()],
    { amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] });
  assert.equal(requested.outcome, 'ACCEPTED', `the export request (${JSON.stringify(requested)})`);
  await svc('SELECT * FROM public.server_prepare_data_exports_v1(10)');
  const [read] = await call(uid, 'SELECT * FROM public.read_own_data_export_v1()');
  assert.equal(read.export_status, 'READY', 'the export is ready');
  return read.content;
}
async function requestDeletion(user) {
  await owner();
  const [row] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
     VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [user]);
  return row.id;
}

// ------------------------------------------------------------------ J01: production stays closed (before any seam is replaced)
async function verifyClosed(report, [a, b]) {
  await q('BEGIN');
  try {
    await report.isolated('J01 production stays closed: no gate, no enrollment; the real CW2-08 seam forwards nothing', async () => {
      await installFixtureTexts();
      const draft = await reviewedDraft(a, { firstName: 'Salma', sex: 'FEMALE' });
      assert.equal((await enroll(a, draft)).outcome, 'NOT_AVAILABLE_NOW', 'J01 the ENROLLMENT gate has no row: nothing enrolls');
      await owner();
      assert.equal(Number((await rows(`SELECT count(*) n FROM ${S}.enrollment_acts WHERE user_id = $1`, [a]))[0].n), 0, 'J01 nothing written');
      // A fixture gate for the enrollment only; the CW2-08 seam stays the real one.
      await openFixtureGate();
      assert.equal((await enroll(a, draft)).outcome, 'ENROLLED', 'J01 the same reviewed draft enrolls once a (fixture) gate is open');
      assert.equal((await enroll(b, await reviewedDraft(b, { firstName: 'Yusuf', sex: 'MALE' }))).outcome, 'ENROLLED');
      // With the real CW2-08 seam the proposal cannot even be offered: nobody is reached, nothing is forwarded.
      await rt.rejected(() => offered(a, b), ['55000'], /MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED/u);
      await owner();
      assert.equal(await dispatch(), 'NONE_DUE', 'J01 nothing is forwarded');
      for (const who of [a, b]) assert.deepEqual(await call(who, 'SELECT * FROM public.list_my_matching_proposals_v1(NULL, 20)'), [], 'J01 nothing reaches either human');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ J02 ... J07
async function verifyJourney(report, H) {
  const [a, b, c, d] = H;
  await q('BEGIN');
  try {
    await installFixtureTexts();
    await openFixtureGate();

    await report.isolated('J02 the whole journey: enrollment, proposal, first approval, forward, acceptance, World, Activity, entry, export', async () => {
      await enrolledPair(a, b);
      const enrolledView = await one(call(a, 'SELECT public.read_my_matching_enrollment_v1() AS r'));
      assert.ok(enrolledView.r, 'J02 the reader reads their own enrollment');
      // Proposal: the first recipient's own screen, the candidate never reached yet.
      const proposal = await offered(a, b);
      assert.equal(await screenWord(a, proposal), 'awaiting you');
      assert.deepEqual(await mine(b, proposal), [], 'J02 the candidate is not reached before the forward');
      // First approval on the first recipient's own token.
      assert.equal((await approve(a, proposal)).outcome, 'RECORDED', 'J02 the first approval');
      assert.equal(await screenWord(a, proposal), 'in progress');
      assert.deepEqual(await mine(b, proposal), [], 'J02 still not reached: the approval alone reaches no one');
      // Forward by the CP2 dispatcher; the delivery source names the candidate only.
      assert.equal(await dispatch(), 'FORWARDED', 'J02 the dispatcher forwards');
      assert.equal(await screenWord(b, proposal), 'awaiting you', 'J02 now the candidate is reached');
      const delivered = (await deliveries()).filter((r) => [a, b].includes(r.recipient_user_id));
      assert.deepEqual(delivered.map((r) => r.recipient_user_id), [b], 'J02 the delivery is for the candidate only (its Activity source)');
      // Direct Entry `proposal:<id>`: re-read on the recipient's own token; nobody else can open it.
      assert.equal((await mine(b, proposal)).length, 1);
      assert.deepEqual(await mine(c, proposal), [], 'J02 an outsider opens nothing');
      // Second approval = the Mutual Match, on the candidate's own token.
      const matched = await accept(b, proposal);
      assert.equal(matched.outcome, 'MATCHED', `J02 the acceptance (${JSON.stringify(matched)})`);
      const world = matched.introduction_world_id;
      for (const who of [a, b]) {
        assert.equal(await screenWord(who, proposal), 'matched');
        assert.equal(await capability(who), true, 'J02 the capability truth');
        assert.deepEqual((await worldsOf(who)).map((w) => w.world_id), [world], 'J02 Direct Entry `world:<id>` resolves for each human');
      }
      assert.equal(await capability(c), false);
      assert.deepEqual(await worldsOf(c), [], 'J02 an outsider has no such World');
      assert.deepEqual(await events([a, b, c]), [`WORLD_BORN:${a}`, `WORLD_BORN:${b}`].sort(), 'J02 WORLD_BORN for the two humans exactly');
      // The Introduction World: a message tells the other human only.
      assert.equal((await one(call(a, 'SELECT * FROM public.send_my_introduction_text_v1($1, $2, $3)', [randomUUID(), world, 'JOURNEY-A first words']))).outcome, 'COMMITTED');
      assert.ok((await events([a, b])).includes(`HUMAN_TEXT:${b}`), 'J02 HUMAN_TEXT for the other human');
      assert.ok(!(await events([a, b])).includes(`HUMAN_TEXT:${a}`), 'J02 never for its author');
      // Export, through 0130 itself, for each human.
      const ea = await exported(a);
      const eb = await exported(b);
      for (const [e, decision, words] of [[ea, 'approved', ['JOURNEY-A first words']], [eb, 'accepted', []]]) {
        const s = e.matchingAndIntroductions;
        assert.deepEqual(e.notYetIncluded, ['shared', 'public', 'replay']);
        assert.deepEqual(s.enrollment.acts.map((x) => [x.act, x.consentVersions]), [['enrolled', { participation: V.P, contextGrant: V.C, disclosureAuthority: V.D }]]);
        assert.deepEqual(s.proposals.map((p) => [p.outcome, p.yourDecisions.map((x) => x.decision)]), [['matched', [decision]]]);
        assert.deepEqual(s.introductions.map((i) => [i.state, i.yourMessages.map((m) => m.text)]), [['active', words]]);
        assert.doesNotMatch(JSON.stringify(s), UUID, 'J02 no identifier in the section');
      }
      assert.ok(!JSON.stringify(eb).includes('JOURNEY-A'), 'J02 the other human\'s words are not in B\'s export');
    });

    await report.isolated('J03 the first recipient declines: nothing is forwarded, and the candidate exports nothing', async () => {
      await enrolledPair(a, b);
      const proposal = await offered(a, b);
      assert.equal((await decline(a, proposal)).outcome, 'RECORDED');
      assert.equal(await dispatch(), 'NONE_DUE', 'J03 nothing is due');
      assert.deepEqual(await mine(b, proposal), [], 'J03 the candidate is never reached');
      assert.deepEqual((await exported(b)).matchingAndIntroductions.proposals, [], 'J03 the candidate was never evaluated in their export (CW2-06 §53)');
      const [p] = (await exported(a)).matchingAndIntroductions.proposals;
      assert.deepEqual([p.outcome, p.yourDecisions.map((x) => x.decision)], ['closed by you', ['declined']]);
      assert.equal(p.outcome, await screenWord(a, proposal));
    });

    await report.isolated('J04 the candidate declines: no World; each export says its own screen word', async () => {
      await enrolledPair(a, b);
      const proposal = await offered(a, b);
      await approve(a, proposal);
      assert.equal(await dispatch(), 'FORWARDED');
      assert.equal((await decline(b, proposal)).outcome, 'RECORDED');
      assert.deepEqual(await worldsOf(a), [], 'J04 no World');
      const [pa] = (await exported(a)).matchingAndIntroductions.proposals;
      const [pb] = (await exported(b)).matchingAndIntroductions.proposals;
      assert.deepEqual([pa.outcome, pb.outcome], ['no longer available', 'closed by you']);
      assert.deepEqual([pa.outcome, pb.outcome], [await screenWord(a, proposal), await screenWord(b, proposal)]);
      assert.ok(!JSON.stringify(pa).includes('declined'), 'J04 the first recipient never learns the other declined');
    });

    await report.isolated('J05 the deadline passes after the forward: nothing can be accepted, the word is the screen\'s', async () => {
      await enrolledPair(a, b);
      const proposal = await offered(a, b);
      await approve(a, proposal);
      assert.equal(await dispatch(), 'FORWARDED');
      await rt.backdate(proposal);
      await owner();
      assert.equal(await screenWord(b, proposal), 'no longer available');
      const late = await accept(b, proposal);
      assert.notEqual(late.outcome, 'MATCHED', 'J05 an expired proposal cannot be accepted');
      assert.deepEqual(await worldsOf(b), []);
      for (const who of [a, b]) assert.equal((await exported(who)).matchingAndIntroductions.proposals[0].outcome, await screenWord(who, proposal));
    });

    await report.isolated('J06 a consent withdrawn before the forward: nothing is forwarded, and the withdrawal is the reader\'s own export', async () => {
      await enrolledPair(a, b);
      const proposal = await offered(a, b);
      await approve(a, proposal);
      const [setup] = await call(b, 'SELECT * FROM public.get_my_matching_setup_v1()');
      const revoked = await one(call(b, 'SELECT * FROM public.revoke_matching_context_v1($1, $2)', [randomUUID(), setup.matching_context_grant_id]));
      assert.ok(revoked, 'J06 the Matching Context Grant is withdrawn on its own (the CP3 route\'s frozen 0109 command)');
      assert.notEqual(await dispatch(), 'FORWARDED', 'J06 nothing is forwarded on a withdrawn consent');
      assert.deepEqual(await mine(b, proposal), [], 'J06 the candidate is never reached');
      const eb = (await exported(b)).matchingAndIntroductions;
      // (Inside one fixture transaction the two events can share an instant, so they are compared as a set.)
      assert.deepEqual(eb.enrollment.contextGrant.map((x) => x.event).sort(), ['granted', 'revoked'], 'J06 the withdrawal is in the reader\'s own export');
      assert.deepEqual(eb.proposals, []);
      assert.equal((await exported(a)).matchingAndIntroductions.proposals[0].outcome, await screenWord(a, proposal));
    });

    await report.isolated('J07 a pending deletion holds the forward; END tells the other human; the erasure keeps the reader\'s own words only', async () => {
      await enrolledPair(c, d);
      const proposal = await offered(c, d);
      await approve(c, proposal);
      const pending = await requestDeletion(d);
      assert.equal(await dispatch(), 'SKIPPED_DELETION_PENDING', 'J07 nothing is forwarded while a deletion is pending');
      await owner();
      await rows("UPDATE personal_data_private.account_deletions SET status = 'CANCELLED', cancelled_at = clock_timestamp(), lease_until = NULL WHERE id = $1", [pending]);
      // The dispatcher's own bounded backoff (CP2, proven by verify-0166) is brought forward for this fixture only.
      await rows("UPDATE matching_forward_private.proposal_forward_attempts SET next_attempt_at = clock_timestamp() - interval '1 second' WHERE proposal_id = $1", [proposal]);
      assert.equal(await dispatch(), 'FORWARDED', 'J07 once cancelled, the same proposal is forwarded');
      const { introduction_world_id: world } = await accept(d, proposal);
      await one(call(c, 'SELECT * FROM public.send_my_introduction_text_v1($1, $2, $3)', [randomUUID(), world, 'JOURNEY-C words I keep']));
      await one(call(d, 'SELECT * FROM public.send_my_introduction_text_v1($1, $2, $3)', [randomUUID(), world, 'JOURNEY-D words that go']));
      assert.equal((await one(call(d, 'SELECT * FROM public.end_own_introduction_v1($1, $2)', [randomUUID(), world]))).outcome, 'ENDED');
      assert.ok((await events([c, d])).includes(`ENDED:${c}`), 'J07 ENDED for the human who did not end it');
      assert.ok(!(await events([c, d])).includes(`ENDED:${d}`), 'J07 never for the one who did');
      await owner();
      await rows("DELETE FROM personal_data_private.account_deletions WHERE id = $1", [pending]);
      assert.equal((await one(svc('SELECT public.server_erase_account_v1($1) AS outcome', [await requestDeletion(d)]))).outcome, 'ERASED');
      const kept = (await exported(c)).matchingAndIntroductions;
      assert.deepEqual(kept.introductions, [], 'J07 the pair-bound Introduction went with the erased human');
      assert.deepEqual(kept.keptIntroductions.map((k) => k.yourMessages.map((m) => m.text)), [['JOURNEY-C words I keep']]);
      assert.ok(!JSON.stringify(kept).includes('JOURNEY-D'), 'J07 nothing of the erased human');
      assert.equal(await capability(c), true, 'J07 a retained view keeps the capability truth');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ the run
const humans = Array.from({ length: 4 }, () => randomUUID());
await runVerifier('s6-07-final-journey', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  setStage('fixtures');
  await rt.provisionHumans(humans);
  const report = createScenarioReport('s6-07-journey', { query: q, restore: () => owner() });
  setStage('production closed');
  await verifyClosed(report, humans);
  const seams = [];
  for (const fn of [PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) seams.push(await rt.captureMatchingSeam(fn));
  try {
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    setStage('journey');
    await verifyJourney(report, humans);
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
  const [{ texts, gates }] = await rows(`SELECT (SELECT count(*)::int FROM ${S}.consent_texts) AS texts, (SELECT count(*)::int FROM ${S}.gate_states) AS gates`);
  assert.deepEqual([texts, gates], [0, 0], 'the fixture texts and gate existed only inside the rolled-back transactions');
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows('SELECT count(*)::int AS residue FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
  assert.equal(residue, 0, 'the run leaves nothing behind');
}, () => rt.client.end().catch(() => undefined));
