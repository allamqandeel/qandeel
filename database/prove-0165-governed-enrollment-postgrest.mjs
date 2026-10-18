// S6-07 (CP1) - live wire proof of the migration 0165 governed enrollment THROUGH a real PostgREST server.
//
// verify-migration-0165.mjs proves the boundary under SET ROLE. A client never issues SET ROLE: it sends a token to
// PostgREST, which switches to the token's role and calls the function. This proof closes that gap against the real
// engine Supabase runs, across the PostgREST lines CI starts it with (`POSTGREST_VERSION`):
//
//   * the boundary and the read take exactly the parameters the API sends (checked against the live catalog);
//   * anon and service-role tokens cannot call either;
//   * with the ENROLLMENT gate absent, an authenticated ENROLL is answered NOT_AVAILABLE_NOW and writes nothing;
//   * with a fixture gate and fixture consent texts, ENROLL is ENROLLED, its replay the same answer with nothing new, and
//     the same command id with another consent version COMMAND_CONFLICT;
//   * a 40001 and a PT409 underneath the act (a committed fixture trigger) are each answered ONCE, HTTP 200, CHANGED, on
//     every line - including the lines before v16 that re-run a 40001 transaction without bound - and nothing moves;
//   * the six 0149 commands are still refused on the wire with the gate open;
//   * the three no-role cores - including the D-CP1-1 empty-profile core - are callable by no token.
//
// Every fixture is removed afterwards: the humans and everything they own, the fixture gate, texts and trigger.
//
// It needs DATABASE_URL (the fixture owner), POSTGREST_URL and POSTGREST_JWT_SECRET (a CI-only signing secret for the
// throwaway PostgREST container; never a deployment credential).
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import process from 'node:process';
import { createMatchRuntime } from './matching-match-verifier-support.mjs';

const databaseUrl = process.env.DATABASE_URL;
const postgrestUrl = (process.env.POSTGREST_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const version = process.env.POSTGREST_VERSION ?? 'unspecified';
if (!databaseUrl || !secret) throw new Error('DATABASE_URL and POSTGREST_JWT_SECRET are required.');

const rt = createMatchRuntime(databaseUrl);
const { q, rows } = rt;
let stage = 'connect';

const S = 'matching_enrollment_private';
const PREP = 'introductions_preparation_private';
const ENROLL = 'enroll_my_matching_setup_v1';
const READ = 'read_my_matching_enrollment_v1';
const SIGNATURE = ['public.enroll_my_matching_setup_v1(uuid, text, bigint, text, text, text)',
  ['p_command_id', 'p_context_consent_version', 'p_disclosure_consent_version', 'p_expected_draft_version', 'p_kind',
    'p_participation_consent_version']];
const V = Object.freeze({ P: 'S6_07_WIRE_PARTICIPATION_V1', C: 'S6_07_WIRE_CONTEXT_V1', D: 'S6_07_WIRE_DISCLOSURE_V1' });

const base64url = (value) => Buffer.from(value).toString('base64url');
function jwt(claims) {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 600 }))}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}
const tokenOf = (sub) => jwt({ sub, role: 'authenticated' });

/** One RPC, sent the way the API sends it, bounded so an unanswered (re-run) request fails here. */
const RPC_TIMEOUT_MS = 30_000;
async function rpc(token, name, body) {
  const started = Date.now();
  const response = await fetch(`${postgrestUrl}/rpc/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  }).then((answered) => answered, (error) => {
    throw new Error(`POST /rpc/${name} was not answered (${error?.name ?? 'Error'}: ${error?.message ?? error})`, { cause: error });
  });
  const text = await response.text();
  return { status: response.status, body: text.length > 0 ? JSON.parse(text) : null, ms: Date.now() - started };
}
function assertNotCallable(response, label) {
  const refused = [401, 403].includes(response.status) && response.body?.code === '42501';
  const hidden = response.status === 404 && response.body?.code === 'PGRST202';
  assert.ok(refused || hidden, `${label} is not callable (got ${response.status} ${JSON.stringify(response.body)})`);
}
const answerOf = (response, label) => {
  assert.equal(response.status, 200, `${label} is answered (${response.status} ${JSON.stringify(response.body)})`);
  assert.ok(Array.isArray(response.body) && response.body.length === 1, `${label} answers one row`);
  assert.deepEqual(Object.keys(response.body[0]), ['outcome', 'participation_state', 'matchable'],
    `${label} answers exactly { outcome, participation_state, matchable }`);
  return response.body[0];
};
const enrollBody = (command, draft, consents = { p: V.P, c: V.C, d: V.D }) => ({
  p_command_id: command, p_kind: 'ENROLL', p_expected_draft_version: draft,
  p_participation_consent_version: consents.p, p_context_consent_version: consents.c, p_disclosure_consent_version: consents.d,
});
/** Rows any part of an enrollment leaves for the human: zero means nothing moved. */
const footprint = async (human) => Number((await rows(`SELECT
    (SELECT count(*) FROM public.matching_setup_locks WHERE user_id = $1)
  + (SELECT count(*) FROM public.matching_participation_events WHERE participant_user_id = $1)
  + (SELECT count(*) FROM public.matching_confirmed_fact_versions WHERE owner_user_id = $1)
  + (SELECT count(*) FROM ${S}.enrollment_acts WHERE user_id = $1)
  + (SELECT count(*) FROM ${S}.command_ledger WHERE user_id = $1) AS n`, [human]))[0].n);

/** A reviewed draft built through the real S6-01 owner commands, on the wire. */
async function reviewedDraft(human) {
  const token = tokenOf(human);
  let expected = 0;
  const steps = [
    ['SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName: 'Huda' }], ['SET_FACT', { fact: 'SEX', sex: 'FEMALE' }],
    ['SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: 1994, month: 7 }],
    ['SET_FACT', { fact: 'BROAD_AREA', countryCode: 'JO', regionCode: 'JO-AM' }],
    ['SET_FACT', { fact: 'MARITAL_STATUS', maritalStatus: 'NEVER_MARRIED' }],
    ...['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS'].map((fact) => ['CONFIRM_FACT', { fact }]),
    ['SET_PROFILE', { shortIntroduction: 'Quiet mornings, long books and close family.', workField: 'EDUCATION' }],
    ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'NONE_ADDITIONAL', items: [] }],
    ['SET_REQUIREMENTS', { strength: 'SOFT', answer: 'NONE', items: [] }],
    ['CONFIRM_REVIEW', {}],
  ];
  for (const [kind, payload] of steps) {
    const answer = await rpc(token, 'apply_own_matching_preparation_command_v1',
      { p_command_id: randomUUID(), p_expected_version: expected, p_kind: kind, p_payload: payload });
    assert.equal(answer.status, 200, `fixture ${kind} on the wire`);
    assert.equal(answer.body.outcome, 'APPLIED', `fixture ${kind}: ${JSON.stringify(answer.body)}`);
    expected = answer.body.version;
  }
  return expected;
}

async function main() {
  await rt.client.connect();
  const humans = Array.from({ length: 3 }, () => randomUUID());
  const [alice, bea, carla] = humans;
  let failure = null;
  try {
    stage = 'the request shape is the live signature';
    assert.deepEqual((await rt.inputParameters(SIGNATURE[0])).sort(), SIGNATURE[1], SIGNATURE[0]);
    assert.deepEqual(await rt.inputParameters(`public.${READ}()`), [], `${READ} takes no parameter`);

    stage = 'fixtures: three humans and the preparation gate';
    await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [humans]);
    await q(`SELECT * FROM ${PREP}.set_gate_v1('PREPARATION', 'ENABLED', 'SATISFIED', 'prove-0165', 'fixture gate')`);
    const draftA = await reviewedDraft(alice);
    const draftB = await reviewedDraft(bea);
    const draftC = await reviewedDraft(carla);

    stage = 'anon and service_role tokens cannot call the boundary or the read';
    for (const role of ['anon', 'service_role']) {
      const token = jwt({ sub: alice, role });
      assertNotCallable(await rpc(token, ENROLL, enrollBody(randomUUID(), draftA)), `${role} ${ENROLL}`);
      assertNotCallable(await rpc(token, READ, {}), `${role} ${READ}`);
    }

    stage = 'the gate absent: NOT_AVAILABLE_NOW, nothing written';
    assert.equal(answerOf(await rpc(tokenOf(alice), ENROLL, enrollBody(randomUUID(), draftA)), 'closed gate').outcome, 'NOT_AVAILABLE_NOW');
    assert.equal(await footprint(alice), 0, 'nothing moved behind a closed gate');
    const closedRead = await rpc(tokenOf(alice), READ, {});
    assert.equal(closedRead.status, 200);
    assert.equal(closedRead.body.available, false, 'the read says unavailable');

    stage = 'a fixture gate and fixture texts: ENROLLED, replay, reused id';
    await q(`SELECT * FROM ${S}.set_gate_v1('ENABLED', 'SATISFIED', 'prove-0165', 'fixture gate, not a launch decision')`);
    for (const [purpose, v] of [['MATCHING_PARTICIPATION', V.P], ['MATCHING_CONTEXT_GRANT', V.C], ['PRE_MATCH_DISCLOSURE_AUTHORITY', V.D]]) {
      await q(`SELECT ${S}.install_consent_text_v1($1, $2, 'نص تجريبي للتحقق - ليس نصًا معتمدًا', 'prove-0165 fixture text, not approved copy')`, [v, purpose]);
    }
    const command = randomUUID();
    const enrolled = answerOf(await rpc(tokenOf(alice), ENROLL, enrollBody(command, draftA)), 'ENROLL');
    assert.deepEqual(enrolled, { outcome: 'ENROLLED', participation_state: 'ACTIVE', matchable: true });
    const before = await footprint(alice);
    assert.deepEqual(answerOf(await rpc(tokenOf(alice), ENROLL, enrollBody(command, draftA)), 'replay'), enrolled, 'the replay answers the committed act');
    assert.equal(await footprint(alice), before, 'and writes nothing');
    assert.equal(answerOf(await rpc(tokenOf(alice), ENROLL, enrollBody(command, draftA, { p: V.P, c: V.C, d: 'S6_07_WIRE_OTHER_V1' })), 'reused id').outcome,
      'COMMAND_CONFLICT');
    const openRead = await rpc(tokenOf(alice), READ, {});
    assert.deepEqual([openRead.status, openRead.body.available, openRead.body.setup.matchable, openRead.body.enrollment.enrolledDraftVersion],
      [200, true, true, draftA], 'the read on the wire');

    stage = 'the six 0149 commands are still refused on the wire with the gate open';
    assertNotCallable(await rpc(tokenOf(bea), 'activate_matching_participation_v1',
      { p_command_id: randomUUID(), p_entry_channel: 'MANUAL_MY_WORLD_ENTRY', p_expected_current_event_id: null }), 'activate');
    assertNotCallable(await rpc(tokenOf(bea), 'set_matching_requirements_v1', { p_command_id: randomUUID(), p_requirement_keys: ['age_range_v1'],
      p_requirement_strengths: ['HARD_DEALBREAKER'], p_requirement_values: ['min=20;max=30'], p_expected_current_version_id: null }), 'requirements');

    stage = 'the three no-role cores (CA-10-impl, CA-D-CP1-1-impl, CA-08-impl) are callable by no token';
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const token = jwt({ sub: bea, role });
      assertNotCallable(await rpc(token, 'set_empty_matching_requirements_core_v1',
        { p_command_id: randomUUID(), p_owner_user_id: bea, p_expected_current_version_id: null }), `${role} empty requirements core`);
      assertNotCallable(await rpc(token, 'set_empty_introduction_profile_core_v1',
        { p_command_id: randomUUID(), p_owner_user_id: bea, p_expected_current_version_id: null }), `${role} empty profile core`);
      assertNotCallable(await rpc(token, 'grant_zero_field_pre_match_disclosure_authority_core_v1',
        { p_command_id: randomUUID(), p_owner_user_id: bea, p_new_authority_id: randomUUID(), p_profile_version_id: randomUUID(),
          p_expected_active_authority_id: null }), `${role} zero-field authority core`);
    }
    assert.equal(await footprint(bea), 0, 'the refused core calls wrote nothing');

    stage = 'a 40001 and a PT409 underneath the act are answered ONCE, HTTP 200 CHANGED, on this line';
    for (const [code, who, draft] of [['40001', bea, draftB], ['PT409', carla, draftC]]) {
      await q(`CREATE FUNCTION public.s6_07_wire_stale_v1() RETURNS trigger LANGUAGE plpgsql AS $probe$
               BEGIN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE = '${code}'; END$probe$`);
      await q(`CREATE TRIGGER s6_07_wire_stale BEFORE INSERT ON ${S}.command_ledger FOR EACH ROW EXECUTE FUNCTION public.s6_07_wire_stale_v1()`);
      try {
        const answered = await rpc(tokenOf(who), ENROLL, enrollBody(randomUUID(), draft));
        assert.equal(answerOf(answered, `${code} underneath`).outcome, 'CHANGED', `${code} is the bounded CHANGED`);
        assert.ok(answered.ms < RPC_TIMEOUT_MS, `${code} answered within the bound (${answered.ms} ms)`);
        assert.equal(await footprint(who), 0, `${code}: nothing moved`);
      } finally {
        await q(`DROP TRIGGER IF EXISTS s6_07_wire_stale ON ${S}.command_ledger`);
        await q('DROP FUNCTION IF EXISTS public.s6_07_wire_stale_v1()');
      }
      assert.equal(answerOf(await rpc(tokenOf(who), ENROLL, enrollBody(randomUUID(), draft)), `${code} gone`).outcome, 'ENROLLED',
        'the same act succeeds once nothing is stale');
    }
    console.log(`prove-0165 PostgREST ${version}: closed gate NOT_AVAILABLE_NOW; ENROLLED / replay / COMMAND_CONFLICT; 40001 and PT409 answered once as CHANGED; the six and the three cores refused; anon and service_role refused`);
  } catch (error) {
    failure = error;
  }
  const cleanup = await (async () => {
    await q(`DROP TRIGGER IF EXISTS s6_07_wire_stale ON ${S}.command_ledger`);
    await q('DROP FUNCTION IF EXISTS public.s6_07_wire_stale_v1()');
    await rt.removeCommittedProposalState(humans);
    await rt.removeCommittedMatchingSetup(humans);
    await rt.removeFixtureHumans(humans);
    await q('BEGIN');
    await q(`ALTER TABLE ${S}.consent_texts DISABLE TRIGGER consent_texts_immutable`);
    await q(`DELETE FROM ${S}.consent_texts WHERE consent_version LIKE 'S6_07_WIRE_%'`);
    await q(`ALTER TABLE ${S}.consent_texts ENABLE TRIGGER consent_texts_immutable`);
    await q(`DELETE FROM ${S}.gate_events`);
    await q(`DELETE FROM ${S}.gate_states`);
    await q(`DELETE FROM ${PREP}.gate_events`);
    await q(`DELETE FROM ${PREP}.gate_states`);
    await q('COMMIT');
  })().then(() => null, (error) => error ?? new Error('fixture removal failed')).finally(() => rt.client.end());
  if (failure) throw new Error(`prove-0165 (PostgREST ${version}) failed at stage: ${stage}: ${failure.message}`, { cause: failure });
  if (cleanup) throw cleanup;
}

await main();
