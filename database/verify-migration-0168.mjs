// S6-07 CP4 / migration 0168 - real-PostgreSQL proof of Export My Data's Matching and Introductions section
// (QAN-BL-PRIV-04, GATE-19, CA-EXP, Q7' / Q7'', Q9) and of the export download's one owner-only photo reader.
//
//   A  posture: the builder keeps its 0130 posture (SECURITY INVOKER, STABLE, search_path '', owner postgres) and no
//      application role executes it; its body is the 0153 body verbatim plus exactly the one added section and the
//      shorter not-yet-included list (the same slice proof verify-0153 uses); the photo reader is postgres-owned, DEFINER,
//      STABLE, pinned, authenticated only, with one overload; the migration adds no table, column, policy, trigger, gate
//      row or registry row, and redefines nothing but the builder
//   B  behaviour (one rolled-back transaction, each scenario in its own SAVEPOINT) on the REAL pipeline - the S6-01
//      preparation commands, the S6-07 governed enrollment (fixture gate and texts), proposal -> approval -> forward ->
//      Match -> Introduction World, the real 0160 messages, 0162 shares and photos, END, SUCCESS and the real 0164 erasure:
//      B01 a reader with no footprint: every new sub-section empty, the earlier sections untouched, three categories left
//      B02 a populated two-human footprint: each export holds exactly the reader's own preparation, enrollment acts with
//          their consent versions, participation / consent / authority events, profile and requirement versions,
//          confirmed facts, delivered proposals and own decisions, and per Introduction the reader's own messages, shares,
//          photo facts, name display acts and continuation approvals
//      B03 nothing of the other human, no identifier, no internal word: each export, serialized, holds none of the other
//          human's strings, no uuid, no state, role, reason or requirement outcome word, no conclusion, no digest, no key
//      B04 not evaluated unless reached (CW2-06 §53): a candidate whose proposal was never forwarded exports no proposal;
//          every outcome is exactly the reader's own proposal screen word; no arrival or deadline instant (Q9)
//      B05 owner deletion: a deleted message and a deleted share are absent, and so is any digest of them (CW2-08 §2)
//      B06 the photo facts and the reader: the package's (startedAt, stage, shared) set equals the reader's, for the owner
//          only; PENDING and DISCARDED hold nothing; after END the shared stage stays and the unshared go; the owner's
//          authorization after END is pinned
//      B07 END and SUCCESS: endedByYou only for the human who ended it; after SUCCESS the Shared-era messages are not here
//      B08 the other human's account erasure: the reader keeps only their own words (keptIntroductions) and the release;
//          nothing pair-bound and nothing of the erased human remains in the reader's export
//      B09 the photo reader refuses anon, answers an outsider nothing, and never answers another human's renditions
//
// Behaviour runs on SYNTHETIC fixture humans and rolls back; the CW2-08 seams are replaced for B and restored byte for
// byte; the fixture enrollment gate and consent texts exist only inside the rolled-back transaction.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { DFN, PFN, createIntroductionRuntime, runVerifier } from './introduction-lifecycle-verifier-support.mjs';
import { CLEAN } from './matching-match-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, rejected } = rt;

const BUILDER = 'personal_data_private.build_personal_export_v1(uuid)';
const READER = 'public.list_my_introduction_photo_renditions_v1()';
const PREP = 'introductions_preparation_private';
const S = 'matching_enrollment_private';
const SHARING = 'introduction_sharing_private';
const migrationText = (name) => readFileSync(new URL(`./migrations/${name}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const M0168 = migrationText('0168_personal_export_matching_introductions_v1.sql');
const V = Object.freeze({ P: 'S6_07_CP4_FIXTURE_PARTICIPATION_V1', C: 'S6_07_CP4_FIXTURE_CONTEXT_V1', D: 'S6_07_CP4_FIXTURE_DISCLOSURE_V1' });
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
// Words that name a state, a role, a reason or an internal evaluation: none may appear in anybody's export.
const INTERNAL_WORDS = ['FIRST_DECLINED', 'SECOND_DECLINED', 'WITHDRAWN', 'EXPIRED', 'CANCELLED_BY_COMPETING_MATCH', 'FIRST_RECIPIENT',
  'CANDIDATE', 'MUTUAL_MATCH_COMMITTED', 'FORWARDED_TO_SECOND', 'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', 'AWAITING_YOU',
  'NO_LONGER_AVAILABLE', 'faith_practice_level', 'EXPLICIT_MATCHING_ANSWER', 'PASS', 'qmedia:', 'intro-media/', 'sha256', 'digest'];
const SCREEN_WORD = Object.freeze({ AWAITING_YOU: 'awaiting you', IN_PROGRESS: 'in progress', CLOSED_BY_YOU: 'closed by you',
  MATCH_CONCLUDED: 'matched', NO_LONGER_AVAILABLE: 'no longer available' });

// ------------------------------------------------------------------ helpers
const owner = () => asRole('postgres');
const as = (uid) => asRole('authenticated', uid);
async function call(uid, sql, values = []) {
  await as(uid);
  try { return await rows(sql, values); } finally { await owner(); }
}
async function svc(sql, values = []) {
  await asRole('service_role');
  try { return await rows(sql, values); } finally { await owner(); }
}
const one = async (promise) => (await promise)[0];
async function exportOf(uid) {
  await owner();
  return (await rows(`SELECT ${BUILDER.slice(0, BUILDER.indexOf('('))}($1) AS e`, [uid]))[0].e;
}
const mi = async (uid) => (await exportOf(uid)).matchingAndIntroductions;

async function openGates() {
  await owner();
  await q(`SELECT * FROM ${PREP}.set_gate_v1('PREPARATION', 'ENABLED', 'SATISFIED', 'verify-0168', 'fixture gate, not a launch decision')`);
  await q(`SELECT * FROM ${S}.set_gate_v1('ENABLED', 'SATISFIED', 'verify-0168', 'fixture gate, not a launch decision')`);
  for (const [purpose, version] of [['MATCHING_PARTICIPATION', V.P], ['MATCHING_CONTEXT_GRANT', V.C], ['PRE_MATCH_DISCLOSURE_AUTHORITY', V.D]]) {
    await q(`SELECT ${S}.install_consent_text_v1($1, $2, $3, $4)`,
      [version, purpose, `نص تجريبي للتحقق (${purpose}) - ليس نصًا معتمدًا`, `verify-0168 fixture text (${purpose}), not approved copy`]);
  }
}
const draftVersion = async (human) => { await owner(); return Number((await rows(`SELECT ${PREP}.draft_version_v1($1) AS v`, [human]))[0].v); };
async function prep(human, kind, payload) {
  const expected = await draftVersion(human);
  const [{ a }] = await call(human, 'SELECT public.apply_own_matching_preparation_command_v1($1, $2, $3, $4) AS a', [randomUUID(), expected, kind, payload]);
  assert.ok(['APPLIED', 'NOT_READY_FOR_REVIEW'].includes(a.outcome), `fixture ${kind}: ${JSON.stringify(a)}`);
  return a;
}
/** A reviewed draft through the REAL S6-01 owner commands, carrying the human's own marker strings; then the governed ENROLL. */
async function enrolledHuman(human, { firstName, sex, marker }) {
  for (const [kind, payload] of [
    ['SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName }],
    ['SET_FACT', { fact: 'SEX', sex }],
    ['SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: 1994, month: 5 }],
    ['SET_FACT', { fact: 'BROAD_AREA', countryCode: 'EG', regionCode: 'EG-C' }],
    ['SET_FACT', { fact: 'MARITAL_STATUS', maritalStatus: 'NEVER_MARRIED' }],
    ...['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS'].map((fact) => ['CONFIRM_FACT', { fact }]),
    ['SET_PROFILE', { shortIntroduction: `${marker} enjoys quiet evenings and long walks.`, workField: 'HEALTH' }],
    ['ADD_NOTE', { kind: 'ABOUT_ME', body: `${marker} note about what matters.` }],
    ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'NONE_ADDITIONAL', items: [] }],
    ['SET_REQUIREMENTS', { strength: 'SOFT', answer: 'NONE', items: [] }],
    ['CONFIRM_REVIEW', {}],
  ]) await prep(human, kind, payload);
  const draft = await draftVersion(human);
  const [answer] = await call(human, 'SELECT * FROM public.enroll_my_matching_setup_v1($1, $2, $3, $4, $5, $6)',
    [randomUUID(), 'ENROLL', draft, V.P, V.C, V.D]);
  assert.equal(answer.outcome, 'ENROLLED', `fixture enrollment of ${marker}`);
  return draft;
}
const sendAs = async (uid, world, text) => one(call(uid, 'SELECT * FROM public.send_my_introduction_text_v1($1, $2, $3)', [randomUUID(), world, text]));
const shareText = async (uid, world, type, text, key = null) =>
  one(call(uid, 'SELECT * FROM public.disclose_my_introduction_text_v1($1, $2, $3, $4, $5)', [randomUUID(), world, type, key, text]));
const endAs = async (uid, world) => (await one(call(uid, 'SELECT * FROM public.end_own_introduction_v1($1, $2)', [randomUUID(), world]))).outcome;
const deleteOwn = async (uid, world, material) =>
  (await one(call(uid, 'SELECT * FROM public.delete_own_shared_world_material_v1($1, $2, $3)', [randomUUID(), world, material]))).outcome;
const myMessages = (uid, world) => call(uid, 'SELECT * FROM public.read_my_introduction_messages_v1($1, NULL, NULL, 200)', [world]);
const renditionsOf = async (uid) => call(uid, `SELECT * FROM ${READER.slice(0, READER.indexOf('('))}()`);
const authorize = async (uid, world, handle) =>
  (await one(call(uid, 'SELECT * FROM public.authorize_my_introduction_media_v1($1, $2)', [world, handle]))).outcome;
/** A READY photo: begin as the owner, the three upload keys, then the API's completion as service_role (no bytes here). */
async function readyPhoto(uid, world) {
  const begun = await one(call(uid, 'SELECT * FROM public.begin_my_introduction_image_v1($1, $2)', [randomUUID(), world]));
  assert.equal(begun.outcome, 'BEGUN', 'the fixture photo begins');
  assert.equal((await svc('SELECT * FROM public.server_read_introduction_image_upload_v1($1)', [begun.image_series_id])).length, 3);
  assert.equal((await one(svc('SELECT * FROM public.server_complete_introduction_image_v1($1)', [begun.image_series_id]))).outcome, 'READY');
  return begun.image_series_id;
}
const shareStage = async (uid, world, series, n) =>
  one(call(uid, 'SELECT * FROM public.disclose_my_introduction_image_stage_v1($1, $2, $3, $4)', [randomUUID(), world, series, n]));
async function requestDeletion(user) {
  await owner();
  const [row] = await rows(
    `INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
     VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [user]);
  return row.id;
}
const erase = async (id) => (await one(svc('SELECT public.server_erase_account_v1($1) AS outcome', [id]))).outcome;
/** The proposal screen's own word for this human, through the S6-04 reader on their own token. */
async function screenWord(uid, proposal) {
  const [row] = await call(uid, 'SELECT * FROM public.get_my_matching_proposal_v1($1)', [proposal]);
  return row ? SCREEN_WORD[row.neutral_outcome] : null;
}
/** Confirmed facts for a fixture pair that is not enrolled through the boundary (the opposite-sex rule needs them). */
async function pairFacts(first, candidate) {
  await rt.recordFacts(first, { sex: 'FEMALE', firstName: 'Mona' });
  await rt.recordFacts(candidate, { sex: 'MALE', firstName: 'Omar' });
  await owner();
}
/**
 * The journey for two ENROLLED humans, on the human boundaries wherever one exists: the proposal is prepared and offered
 * by the fixture producer (no production conclusion producer exists, QAN-BL-MATCH-03), the first recipient approves on
 * their own token (S6-04), the CP2 dispatcher forwards it (0166), and the candidate accepts on their own token (S6-05).
 */
async function enrolledJourney(first, candidate) {
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
  const [{ recipient_view_id: firstView }] = await call(first, 'SELECT * FROM public.get_my_matching_proposal_v1($1)', [proposal]);
  const approved = await one(call(first, 'SELECT * FROM public.approve_my_matching_proposal_forward_v1($1, $2, $3)', [randomUUID(), proposal, firstView]));
  assert.equal(approved.outcome, 'RECORDED', `the first approval on the human boundary: ${JSON.stringify(approved)}`);
  assert.deepEqual(await call(candidate, 'SELECT * FROM public.get_my_matching_proposal_v1($1)', [proposal]), [], 'not reached before the forward');
  assert.equal((await one(svc('SELECT * FROM public.server_forward_approved_matching_proposals_v1(1)'))).outcome, 'FORWARDED', 'the CP2 dispatcher forwards');
  const [{ recipient_view_id: secondView }] = await call(candidate, 'SELECT * FROM public.get_my_matching_proposal_v1($1)', [proposal]);
  const accepted = await one(call(candidate, 'SELECT * FROM public.accept_my_matching_proposal_v1($1, $2, $3)', [randomUUID(), proposal, secondView]));
  assert.equal(accepted.outcome, 'MATCHED', `the acceptance on the human boundary: ${JSON.stringify(accepted)}`);
  return { world: accepted.introduction_world_id, proposal };
}
const strings = (value) => JSON.stringify(value);
function assertNothingOf(exported, forbidden, label) {
  const text = strings(exported);
  for (const s of forbidden) assert.ok(!text.includes(s), `${label}: must not contain ${JSON.stringify(s)}`);
}
function assertNoInternals(exported, label) {
  const text = strings(exported);
  assert.doesNotMatch(text, UUID, `${label}: no identifier of any kind`);
  for (const word of INTERNAL_WORDS) assert.ok(!text.includes(word), `${label}: no internal word ${word}`);
}

// ------------------------------------------------------------------ A. posture
async function verifyPosture(report) {
  await owner();
  await report.section('A01 the builder keeps its 0130 posture and no application role executes it', async () => {
    const [p] = await rows(`SELECT p.prosecdef, p.proconfig::text[] AS config, pg_get_userbyid(p.proowner) AS owner, p.provolatile
      FROM pg_proc p WHERE p.oid = $1::regprocedure`, [BUILDER]);
    assert.deepEqual(p, { prosecdef: false, config: ['search_path=""'], owner: 'postgres', provolatile: 's' }, 'A01 unchanged posture');
    for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
      assert.equal(await rt.canExecute(role, BUILDER), false, `A01 ${role} must not execute the builder`);
    }
  });
  await report.section('A02 the live builder is the 0153 body verbatim plus exactly the one section and the shorter list', async () => {
    const body = (text, marker) => {
      const start = text.indexOf(marker);
      assert.ok(start >= 0, `${marker} found`);
      const open = text.indexOf('AS $$', start) + 'AS $$'.length;
      return text.slice(open, text.indexOf('$$;', open));
    };
    const marker = 'CREATE OR REPLACE FUNCTION personal_data_private.build_personal_export_v1(';
    const defined0153 = body(migrationText('0153_interaction_preferences_v1.sql'), marker);
    const defined0168 = body(M0168, marker);
    const live = (await rows('SELECT prosrc FROM pg_proc WHERE oid = $1::regprocedure', [BUILDER]))[0].prosrc.replace(/\r\n/gu, '\n');
    assert.equal(live, defined0168, 'A02 the live builder is the 0168 body');
    const added = defined0168.indexOf('        -- S6-07 (0168)');
    const list = defined0168.indexOf("        'notYetIncluded'");
    assert.ok(added > 0 && list > added, 'A02 the section sits before the not-yet-included list');
    const old = "        'notYetIncluded', jsonb_build_array('shared', 'public', 'replay', 'introductions'));\n";
    assert.equal(defined0168.slice(list), "        'notYetIncluded', jsonb_build_array('shared', 'public', 'replay'));\n", 'A02 only introductions leaves the list');
    assert.equal(defined0168.slice(0, added) + old, defined0153, 'A02 every earlier line is 0153\'s, byte for byte');
  });
  await report.section('A03 the photo reader: postgres-owned, DEFINER, STABLE, pinned, one overload, authenticated only', async () => {
    const p = await rt.functionPosture(READER);
    assert.equal(p.owner, 'postgres');
    assert.equal(p.secdef, true);
    assert.deepEqual(p.config, ['search_path=""']);
    const [{ n, volatile }] = await rows(`SELECT count(*)::int n, bool_or(provolatile <> 's') AS volatile FROM pg_proc
      WHERE proname = 'list_my_introduction_photo_renditions_v1'`);
    assert.equal(n, 1, 'A03 one overload');
    assert.equal(volatile, false, 'A03 STABLE');
    for (const role of ['public', 'anon', 'service_role']) assert.equal(await rt.canExecute(role, READER), false, `A03 ${role} must not execute`);
    assert.equal(await rt.canExecute('authenticated', READER), true, 'A03 authenticated executes');
  });
  await report.section('A04 the migration adds no relation, policy, trigger, gate or registry row and redefines nothing else', async () => {
    const sql = M0168.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n');
    assert.doesNotMatch(sql, /CREATE TABLE|ALTER TABLE|ADD COLUMN|CREATE POLICY|CREATE TRIGGER|INSERT INTO|UPDATE |DELETE FROM|gate_states|coverage_registry/iu);
    const defined = [...sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z0-9_.]+)\(/giu)].map((m) => m[1]);
    assert.deepEqual(defined, ['personal_data_private.build_personal_export_v1', 'public.list_my_introduction_photo_renditions_v1']);
    for (const frozen of ['authorize_my_introduction_media_v1', 'server_read_introduction_media_key_v1', 'prepare_data_exports_v1',
      'read_own_data_export_v1', 'enroll_my_matching_setup_v1']) assert.ok(!sql.includes(`FUNCTION public.${frozen}`), `A04 ${frozen} untouched`);
  });
}

// ------------------------------------------------------------------ B. behaviour
async function verifyBehaviour(report, H) {
  const [a, b, c, d, e, f, g] = H;
  await q('BEGIN');
  try {
    await openGates();

    await report.isolated('B01 a reader with no footprint: the new section is empty, the earlier sections are untouched', async () => {
      const exported = await exportOf(c);
      assert.deepEqual(Object.keys(exported).sort(), ['account', 'conversations', 'format', 'interactionPreferences', 'matchingAndIntroductions',
        'memory', 'notYetIncluded', 'preparedAt', 'understanding'], 'B01 the earlier sections are all still there');
      assert.equal(exported.format, 'qandeel.personal-data-export.v1', 'B01 the format is unchanged');
      assert.deepEqual(exported.notYetIncluded, ['shared', 'public', 'replay'], 'B01 three categories left');
      assert.deepEqual(exported.matchingAndIntroductions, {
        preparation: { draft: null, declaredFacts: null, notes: [], earlierUnderstandingDecisions: [], assistanceConsents: [] },
        enrollment: { acts: [], participation: [], contextGrant: [], disclosureAuthority: [], introductionProfileVersions: [], requirementVersions: [] },
        confirmedFacts: [], proposals: [], introductions: [], keptIntroductions: [], resumedAfterIntroductions: [],
      }, 'B01 nothing invented');
    });

    // The populated footprint shared by B02 ... B08: A (first recipient) and B (candidate), enrolled through the REAL
    // boundary, matched through the real ladder, with messages, shares, a photo, a name display act and approvals.
    const A = { firstName: 'Mariam', marker: 'ALPHA-7Q' };
    const B = { firstName: 'Karim', marker: 'BRAVO-3X' };
    const build = async () => {
      await enrolledHuman(a, { ...A, sex: 'FEMALE' });
      await enrolledHuman(b, { ...B, sex: 'MALE' });
      const fx = await enrolledJourney(a, b);
      const aMessage = await sendAs(a, fx.world, `${A.marker} hello from the first human`);
      const aDeleted = await sendAs(a, fx.world, `${A.marker} a message I will delete`);
      const bMessage = await sendAs(b, fx.world, `${B.marker} hello back from the second human`);
      assert.equal(aMessage.outcome, 'COMMITTED', `fixture aMessage: ${JSON.stringify(aMessage)}`);
      assert.equal(bMessage.outcome, 'COMMITTED', `fixture bMessage: ${JSON.stringify(bMessage)}`);
      const aShare = await shareText(a, fx.world, 'CONTACT_METHOD', `${A.marker} contact route shared`);
      const aName = await shareText(a, fx.world, 'FULL_NAME', `${A.marker} Full Name`);
      const bShare = await shareText(b, fx.world, 'CONTACT_METHOD', `${B.marker} contact route shared`);
      assert.equal(aShare.outcome, 'DISCLOSED', `fixture aShare: ${JSON.stringify(aShare)}`);
      assert.equal(bShare.outcome, 'DISCLOSED', `fixture bShare: ${JSON.stringify(bShare)}`);
      const [nameVersion] = (await call(a, 'SELECT * FROM public.list_my_introduction_shares_v1()')).filter((r) => r.resource_type === 'FULL_NAME');
      assert.equal((await one(call(a, 'SELECT * FROM public.grant_my_introduction_name_display_v1($1, $2, $3)',
        [randomUUID(), fx.world, nameVersion.disclosure_version_id]))).outcome, 'GRANTED');
      const aSeries = await readyPhoto(a, fx.world);
      assert.equal((await shareStage(a, fx.world, aSeries, 1)).outcome, 'DISCLOSED');
      const bSeries = await readyPhoto(b, fx.world);
      assert.equal((await shareStage(b, fx.world, bSeries, 1)).outcome, 'DISCLOSED');
      return { fx, aMessage, aDeleted, bMessage, aShare, aName, bShare, aSeries, bSeries };
    };

    await report.isolated('B02 a populated footprint: each export holds exactly the reader\'s own Matching and Introductions data', async () => {
      const w = await build();
      const mine = await mi(a);
      // preparation
      assert.equal(mine.preparation.draft.shortIntroduction, `${A.marker} enjoys quiet evenings and long walks.`);
      assert.equal(mine.preparation.draft.workField, 'health');
      assert.deepEqual(mine.preparation.draft.requirements, { answer: 'none additional', items: [] });
      assert.ok(typeof mine.preparation.draft.reviewedAt === 'string', 'B02 the draft was reviewed');
      assert.deepEqual(mine.preparation.declaredFacts.firstName.value, A.firstName);
      assert.equal(mine.preparation.declaredFacts.firstName.state, 'confirmed');
      assert.equal(mine.preparation.declaredFacts.sex.value, 'female');
      assert.deepEqual(mine.preparation.notes.map((n) => [n.kind, n.origin, n.text]), [['about me', 'written by you', `${A.marker} note about what matters.`]]);
      // enrollment, with the consent versions it named (GATE-17)
      assert.deepEqual(mine.enrollment.acts.map((x) => [x.act, x.consentVersions]), [['enrolled', { participation: V.P, contextGrant: V.C, disclosureAuthority: V.D }]]);
      assert.equal(mine.enrollment.acts[0].reviewedDraftVersion, await draftVersion(a));
      // (Inside one fixture transaction two events can share an instant, so what they are is compared, not their order.)
      assert.ok(mine.enrollment.participation.some((x) => x.act === 'activate' && x.state === 'active' && x.entry !== undefined), 'B02 the activation');
      assert.ok(mine.enrollment.participation.some((x) => x.state === 'paused' && x.pauseReason === 'active introduction'), 'B02 paused by the live Introduction');
      assert.deepEqual(mine.enrollment.contextGrant.map((x) => x.event), ['granted']);
      assert.deepEqual(mine.enrollment.disclosureAuthority.map((x) => [x.event, x.approvedFields]), [['granted', []]], 'B02 the zero-field authority');
      assert.equal(mine.enrollment.introductionProfileVersions.length, 1);
      assert.deepEqual(mine.enrollment.requirementVersions.map((x) => x.items), [[]], 'B02 the empty requirement version');
      assert.deepEqual(mine.confirmedFacts.map((x) => [x.firstName, x.sex]), [[A.firstName, 'female']]);
      // the proposal: delivered to A, matched, A's own approval only
      assert.deepEqual(mine.proposals.map((p) => [p.outcome, p.yourDecisions.map((x) => x.decision)]), [['matched', ['approved']]]);
      const theirs = await mi(b);
      assert.deepEqual(theirs.proposals.map((p) => [p.outcome, p.yourDecisions.map((x) => x.decision)]), [['matched', ['accepted']]]);
      // the Introduction
      assert.equal(mine.introductions.length, 1);
      const [intro] = mine.introductions;
      assert.equal(intro.state, 'active');
      assert.equal(intro.endedAt, null);
      assert.equal(intro.endedByYou, null);
      assert.deepEqual(intro.yourMessages.map((m) => m.text).sort(), [`${A.marker} a message I will delete`, `${A.marker} hello from the first human`]);
      assert.deepEqual(intro.yourShares.map((s) => [s.kind, s.text]).sort(), [['contact method', `${A.marker} contact route shared`], ['full name', `${A.marker} Full Name`]]);
      assert.deepEqual(intro.yourPhotos, [{ state: 'live', stages: [
        { stage: 1, shared: true, sharedAt: intro.yourPhotos[0].stages[0].sharedAt }, { stage: 2, shared: false, sharedAt: null }, { stage: 3, shared: false, sharedAt: null }] }]);
      assert.ok(typeof intro.yourPhotos[0].stages[0].sharedAt === 'string', 'B02 the shared stage says when');
      assert.deepEqual(intro.yourNameDisplay.map((x) => x.act), ['full name shown']);
      assert.deepEqual(intro.yourContinuationApprovals, []);
      assert.deepEqual(theirs.introductions[0].yourMessages.map((m) => m.text), [`${B.marker} hello back from the second human`]);
      assert.ok(w.fx.world);
    });

    await report.isolated('B03 nothing of the other human, no identifier and no internal word, in either direction', async () => {
      await build();
      const [ea, eb] = [await exportOf(a), await exportOf(b)];
      assertNothingOf(ea.matchingAndIntroductions, [B.marker, B.firstName, 'Omar', 'Mona', 'unhurried outlook'], 'B03 A\'s export');
      assertNothingOf(eb.matchingAndIntroductions, [A.marker, A.firstName, 'Omar', 'Mona', 'unhurried outlook'], 'B03 B\'s export');
      assertNoInternals(ea.matchingAndIntroductions, 'B03 A\'s export');
      assertNoInternals(eb.matchingAndIntroductions, 'B03 B\'s export');
      for (const p of [...ea.matchingAndIntroductions.proposals, ...eb.matchingAndIntroductions.proposals]) {
        assert.deepEqual(Object.keys(p).sort(), ['outcome', 'yourDecisions'], 'B03 a proposal says its word and the reader\'s decisions only');
      }
    });

    await report.isolated('B04 a proposal never forwarded is not in the candidate\'s export; every word is the reader\'s own screen word; no arrival', async () => {
      await pairFacts(d, e);
      const offered = await rt.bringToOffered(d, e);
      await owner();
      assert.deepEqual((await mi(e)).proposals, [], 'B04 the candidate was never reached: nothing (CW2-06 §53)');
      const [only] = (await mi(d)).proposals;
      assert.equal(only.outcome, await screenWord(d, offered.proposal), 'B04 the first recipient\'s word is their screen\'s');
      assert.equal(only.outcome, 'awaiting you');
      // A first recipient's decline: closed by you, with the reader's own decision; the candidate still has nothing.
      const [{ recipient_view_id: view }] = await call(d, 'SELECT * FROM public.get_my_matching_proposal_v1($1)', [offered.proposal]);
      assert.equal((await one(call(d, 'SELECT * FROM public.decline_my_matching_proposal_v1($1, $2, $3)', [randomUUID(), offered.proposal, view]))).outcome, 'RECORDED');
      const [declined] = (await mi(d)).proposals;
      assert.deepEqual([declined.outcome, declined.yourDecisions.map((x) => x.decision)], ['closed by you', ['declined']]);
      assert.equal(declined.outcome, await screenWord(d, offered.proposal));
      assert.deepEqual((await mi(e)).proposals, [], 'B04 still nothing for the candidate');
      // Forwarded then declined by the second: the first recipient reads the one neutral ending, the candidate their own.
      await pairFacts(f, g);
      const fwd = await rt.bringToForwarded(f, g);
      await owner();
      const [{ recipient_view_id: second }] = await call(g, 'SELECT * FROM public.get_my_matching_proposal_v1($1)', [fwd.proposal]);
      assert.equal((await one(call(g, 'SELECT * FROM public.decline_my_matching_proposal_v1($1, $2, $3)', [randomUUID(), fwd.proposal, second]))).outcome, 'RECORDED');
      const [first] = (await mi(f)).proposals;
      const [cand] = (await mi(g)).proposals;
      assert.deepEqual([first.outcome, first.yourDecisions.map((x) => x.decision)], ['no longer available', ['approved']]);
      assert.deepEqual([cand.outcome, cand.yourDecisions.map((x) => x.decision)], ['closed by you', ['declined']]);
      assert.equal(first.outcome, await screenWord(f, fwd.proposal));
      assert.equal(cand.outcome, await screenWord(g, fwd.proposal));
      // Q9: no instant of the proposal itself - its delivery, preparation or deadline - appears anywhere.
      await owner();
      const instants = await rows(`SELECT to_jsonb(b.bound_at) #>> '{}' AS t FROM public.matching_proposal_delivery_view_bindings b WHERE b.proposal_id = ANY($1::uuid[])
        UNION ALL SELECT to_jsonb(p.prepared_at) #>> '{}' FROM public.matching_proposals p WHERE p.id = ANY($1::uuid[])
        UNION ALL SELECT to_jsonb(p.expires_at) #>> '{}' FROM public.matching_proposals p WHERE p.id = ANY($1::uuid[])`, [[offered.proposal, fwd.proposal]]);
      // (Inside one fixture transaction a decision can share the transaction instant; the reader's own decision instant
      // is their own data, so only the instants that are not one of them are checked.)
      for (const who of [d, e, f, g]) {
        const own = (await mi(who)).proposals;
        const decided = new Set(own.flatMap((p) => p.yourDecisions.map((x) => new Date(x.at).toISOString())));
        const text = strings(own);
        for (const { t } of instants) {
          if (decided.has(new Date(t).toISOString())) continue;
          assert.ok(!text.includes(t) && !text.includes(new Date(t).toISOString()), `B04 no proposal instant (${t}) in the export of ${who}`);
        }
      }
      // An expired live proposal reads as its screen does.
      await pairFacts(c, H[7]);
      const late = await rt.bringToOffered(c, H[7]);
      await rt.backdate(late.proposal);
      await owner();
      assert.equal((await mi(c)).proposals[0].outcome, 'no longer available', 'B04 a live proposal past its deadline');
      assert.equal((await mi(c)).proposals[0].outcome, await screenWord(c, late.proposal));
    });

    await report.isolated('B05 owner deletion: a deleted message and a deleted share are absent, with no digest of them', async () => {
      const w = await build();
      const listed = await myMessages(a, w.fx.world);
      const target = listed.find((m) => m.text_body === `${A.marker} a message I will delete`);
      assert.equal(await deleteOwn(a, w.fx.world, target.material_id), 'DELETED');
      assert.equal(await deleteOwn(a, w.fx.world, w.aShare.disclosed_material_id), 'DELETED');
      const [intro] = (await mi(a)).introductions;
      assert.deepEqual(intro.yourMessages.map((m) => m.text), [`${A.marker} hello from the first human`], 'B05 the deleted message is gone');
      assert.deepEqual(intro.yourShares.map((s) => s.kind), ['full name'], 'B05 the deleted share is gone');
      assertNothingOf(await exportOf(a), ['a message I will delete', 'contact route shared'], 'B05');
      assertNoInternals((await exportOf(a)).matchingAndIntroductions, 'B05');
    });

    await report.isolated('B06 the photo facts equal the owner\'s reader; END keeps the shared stage only; the owner\'s authorization after END is pinned', async () => {
      const w = await build();
      const facts = (intro) => intro.yourPhotos.flatMap((p) => p.stages.map((s) => `${intro.startedAt}|${s.stage}|${s.shared}`)).sort();
      const read = async (uid) => (await renditionsOf(uid)).map((r) => `${new Date(r.introduction_started_at).toISOString()}|${r.stage}|${r.is_shared}`).sort();
      const norm = (list) => list.map((x) => { const [at, ...rest] = x.split('|'); return [new Date(at).toISOString(), ...rest].join('|'); }).sort();
      let [intro] = (await mi(a)).introductions;
      assert.deepEqual(norm(facts(intro)), await read(a), 'B06 live: the reader lists exactly the package facts');
      assert.equal((await renditionsOf(a)).every((r) => r.world_id === w.fx.world), true);
      const aHandles = (await renditionsOf(a)).map((r) => r.media_handle);
      const bHandles = (await renditionsOf(b)).map((r) => r.media_handle);
      assert.equal(aHandles.filter((h) => bHandles.includes(h)).length, 0, 'B06 each reader lists only their own renditions');
      // END by A, then the sweep: A's unshared stages go, the shared one stays.
      assert.equal(await endAs(a, w.fx.world), 'ENDED');
      await svc('SELECT * FROM public.server_sweep_introduction_media_v1(50)');
      [intro] = (await mi(a)).introductions;
      assert.deepEqual(intro.yourPhotos, [{ state: 'shared', stages: [{ stage: 1, shared: true, sharedAt: intro.yourPhotos[0].stages[0].sharedAt }] }]);
      assert.deepEqual(norm(facts(intro)), await read(a), 'B06 after END: the reader still lists exactly the package facts');
      const [kept] = await renditionsOf(a);
      // §9.7 proof 5: the owner's authorization for their own shared stage after END, pinned as the frozen resolver answers.
      assert.equal(await authorize(a, w.fx.world, kept.media_handle), 'AUTHORIZED', 'B06 the owner may still download their shared stage');
      // A photo still being uploaded (PENDING) or removed with nothing shared (DISCARDED) holds nothing to export.
      await pairFacts(d, e);
      const other = await rt.bringToIntroduction(d, e);
      await owner();
      const pending = await one(call(d, 'SELECT * FROM public.begin_my_introduction_image_v1($1, $2)', [randomUUID(), other.world]));
      assert.equal(pending.outcome, 'BEGUN', `fixture pending: ${JSON.stringify(pending)}`);
      assert.deepEqual(await renditionsOf(d), [], 'B06 PENDING: nothing to download');
      assert.deepEqual((await mi(d)).introductions[0].yourPhotos, [], 'B06 PENDING: no fact either');
      assert.equal((await one(svc('SELECT * FROM public.server_complete_introduction_image_v1($1)', [pending.image_series_id]))).outcome, 'READY');
      assert.equal((await one(call(d, 'SELECT * FROM public.remove_my_introduction_image_v1($1, $2, $3)', [randomUUID(), other.world, pending.image_series_id]))).outcome, 'REMOVED');
      assert.deepEqual(await renditionsOf(d), [], 'B06 DISCARDED: nothing to download');
      assert.deepEqual((await mi(d)).introductions[0].yourPhotos, [{ state: 'removed', stages: [] }], 'B06 DISCARDED: the fact that it was removed');
    });

    await report.isolated('B07 END says endedByYou only to the human who ended it; after SUCCESS the Shared-era messages are not here', async () => {
      const w = await build();
      assert.equal(await endAs(b, w.fx.world), 'ENDED');
      const [ia] = (await mi(a)).introductions;
      const [ib] = (await mi(b)).introductions;
      assert.deepEqual([ia.state, ia.endedByYou, ib.state, ib.endedByYou], ['ended', false, 'ended', true]);
      assert.equal(ia.endedAt, ib.endedAt);
      // SUCCESS: both approve, the transition commits, and a message after it is the Shared World's (QAN-BL-PRIV-05).
      await pairFacts(d, e);
      const s = await rt.bringToSuccessApproved(d, e);
      await owner();
      await rt.commitText(s.world, d, 'DELTA-5K before the continuation');
      const [{ outcome }] = await call(d, 'SELECT * FROM public.complete_my_introduction_success_v1($1)', [s.world]);
      assert.equal(outcome, 'COMPLETED', 'B07 SUCCESS committed');
      await owner();
      await rt.commitText(s.world, d, 'DELTA-5K after the continuation');
      const [id] = (await mi(d)).introductions;
      assert.equal(id.state, 'continued as a shared world');
      assert.ok(typeof id.continuedAt === 'string');
      assert.deepEqual(id.yourMessages.map((m) => m.text), ['DELTA-5K before the continuation'], 'B07 the Introduction era only');
      assert.deepEqual(id.yourContinuationApprovals.map((x) => x.act), ['approved']);
    });

    await report.isolated('B08 the other human\'s erasure: the reader keeps only their own words, nothing pair-bound and nothing of the erased', async () => {
      const w = await build();
      assert.equal(await endAs(a, w.fx.world), 'ENDED');
      assert.equal(await erase(await requestDeletion(b)), 'ERASED', 'B08 the governed erasure completes');
      const mine = await mi(a);
      assert.deepEqual(mine.introductions, [], 'B08 the pair-bound Introduction Record is gone with the erased human');
      assert.deepEqual(mine.proposals, [], 'B08 and so is the proposal');
      assert.equal(mine.keptIntroductions.length, 1);
      assert.equal(mine.keptIntroductions[0].state, 'ended');
      assert.deepEqual(mine.keptIntroductions[0].yourMessages.map((m) => m.text).sort(),
        [`${A.marker} a message I will delete`, `${A.marker} hello from the first human`].sort(), 'B08 the reader\'s own words, kept');
      assert.ok(mine.resumedAfterIntroductions.some((x) => x.act === 'free to resume'), 'B08 the release is the reader\'s');
      assertNothingOf(mine, [B.marker, B.firstName], 'B08');
      assertNoInternals(mine, 'B08');
      assert.equal(mine.enrollment.acts.length, 1, 'B08 the reader\'s own enrollment is untouched');
    });

    await report.isolated('B09 the photo reader refuses anon, answers an outsider nothing and never another human\'s renditions', async () => {
      await build();
      await asRole('anon');
      await rejected(() => rows(`SELECT * FROM ${READER.slice(0, READER.indexOf('('))}()`), ['42501']);
      await owner();
      await asRole('authenticated');
      await rejected(() => rows(`SELECT * FROM ${READER.slice(0, READER.indexOf('('))}()`), ['42501']);
      await owner();
      assert.deepEqual(await renditionsOf(c), [], 'B09 an outsider holds nothing');
      assert.equal((await renditionsOf(a)).length, 3, 'B09 the owner\'s three live renditions');
      await owner();
      const [{ n }] = await rows(`SELECT count(*)::int n FROM ${SHARING}.image_renditions r JOIN ${SHARING}.image_series s ON s.id = r.series_id
        WHERE s.owner_user_id = $1`, [b]);
      assert.equal(n, 3, 'B09 the other human has renditions too, and A\'s reader lists none of them');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ the run
const humans = Array.from({ length: 8 }, () => randomUUID());
await runVerifier('0168', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  setStage('fixtures');
  await rt.provisionHumans(humans);
  const report = createScenarioReport('0168', { query: q, restore: () => owner() });

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
  const [{ texts, gates }] = await rows(`SELECT (SELECT count(*)::int FROM ${S}.consent_texts) AS texts, (SELECT count(*)::int FROM ${S}.gate_states) AS gates`);
  assert.deepEqual([texts, gates], [0, 0], 'the fixture texts and gate existed only inside the rolled-back transaction');
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows('SELECT count(*)::int AS residue FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
  assert.equal(residue, 0, 'the run leaves nothing behind');
}, () => rt.client.end().catch(() => undefined));
