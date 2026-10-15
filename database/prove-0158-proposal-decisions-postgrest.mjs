// S6-04 - live wire proof of the migration 0158 proposal review and decision boundaries THROUGH a real PostgREST server.
//
// verify-migration-0158.mjs proves the boundaries under SET ROLE. A client never issues SET ROLE: it sends a token to
// PostgREST, which switches to the token's role and calls the function. This proof closes that gap against the real
// engine Supabase runs, across the PostgREST lines CI starts it with (`POSTGREST_VERSION`):
//
//   * each boundary takes exactly the parameters the API sends (checked against the live catalog);
//   * anon and service-role tokens cannot call any of the five;
//   * the first recipient's token lists and reads exactly the four neutral columns; the candidate's and an outsider's
//     tokens list nothing before forward approval;
//   * a decision on a superseded view - the cores' 40001 - is answered ONCE, HTTP 200 CHANGED, on every line, including
//     the lines before v16 that re-run a 40001 transaction without bound; nothing moves;
//   * forward approval RECORDED, its replay RECORDED with nothing new, the same id reused to withdraw COMMAND_CONFLICT,
//     the withdrawal RECORDED; an outsider's decision UNAVAILABLE.
//
// Every fixture is removed afterwards, and the CW2-08 seam this proof replaced is restored byte for byte.
//
// It needs DATABASE_URL (the fixture owner), POSTGREST_URL and POSTGREST_JWT_SECRET (a CI-only signing secret for the
// throwaway PostgREST container; never a deployment credential).
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import process from 'node:process';
import { PFN, createMatchRuntime } from './matching-match-verifier-support.mjs';

const databaseUrl = process.env.DATABASE_URL;
const postgrestUrl = (process.env.POSTGREST_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const version = process.env.POSTGREST_VERSION ?? 'unspecified';
if (!databaseUrl || !secret) throw new Error('DATABASE_URL and POSTGREST_JWT_SECRET are required.');

const rt = createMatchRuntime(databaseUrl);
const { rows } = rt;
let stage = 'connect';

const base64url = (value) => Buffer.from(value).toString('base64url');
function jwt(claims) {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 600 }))}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

/** One RPC, sent the way the API sends it, bounded so an unanswered (re-run) request fails here. */
const RPC_TIMEOUT_MS = 30_000;
async function rpc(token, name, body) {
  const response = await fetch(`${postgrestUrl}/rpc/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  }).then((answered) => answered, (error) => {
    throw new Error(`POST /rpc/${name} was not answered (${error?.name ?? 'Error'}: ${error?.message ?? error})`, { cause: error });
  });
  const text = await response.text();
  return { status: response.status, body: text.length > 0 ? JSON.parse(text) : null };
}

function assertNotCallable(response, label) {
  const refused = [401, 403].includes(response.status) && response.body?.code === '42501';
  const hidden = response.status === 404 && response.body?.code === 'PGRST202';
  assert.ok(refused || hidden, `${label} is not callable (got ${response.status} ${JSON.stringify(response.body)})`);
}
const rowsOf = (response, label) => {
  assert.equal(response.status, 200, `${label} is answered (${response.status} ${JSON.stringify(response.body)})`);
  assert.ok(Array.isArray(response.body), `${label} answers rows`);
  for (const row of response.body) {
    assert.deepEqual(Object.keys(row), ['recipient_view_id', 'matching_proposal_id', 'neutral_outcome', 'available_actions'], `${label} columns`);
  }
  return response.body;
};
const decision = (response, label) => {
  assert.equal(response.status, 200, `${label} is answered (${response.status} ${JSON.stringify(response.body)})`);
  assert.ok(Array.isArray(response.body) && response.body.length === 1, `${label} answers one row`);
  assert.deepEqual(Object.keys(response.body[0]), ['outcome', 'neutral_outcome'], `${label} answers exactly { outcome, neutral_outcome }`);
  return response.body[0];
};
const SIGNATURES = {
  list_my_matching_proposals_v1: ['public.list_my_matching_proposals_v1(uuid, integer)', ['p_after_proposal_id', 'p_limit']],
  get_my_matching_proposal_v1: ['public.get_my_matching_proposal_v1(uuid)', ['p_proposal_id']],
  approve_my_matching_proposal_forward_v1: ['public.approve_my_matching_proposal_forward_v1(uuid, uuid, uuid)', ['p_command_id', 'p_expected_view_id', 'p_proposal_id']],
  decline_my_matching_proposal_v1: ['public.decline_my_matching_proposal_v1(uuid, uuid, uuid)', ['p_command_id', 'p_expected_view_id', 'p_proposal_id']],
  withdraw_my_matching_proposal_v1: ['public.withdraw_my_matching_proposal_v1(uuid, uuid, uuid)', ['p_command_id', 'p_expected_view_id', 'p_proposal_id']],
};

async function main() {
  await rt.client.connect();
  const [first, candidate, outsider] = [randomUUID(), randomUUID(), randomUUID()];
  const humans = [first, candidate, outsider];
  let seam = null;
  let failure = null;
  try {
    stage = 'the request shapes are the live signatures';
    for (const [signature, params] of Object.values(SIGNATURES)) {
      assert.deepEqual((await rt.inputParameters(signature)).sort(), params, signature);
    }

    stage = 'fixtures';
    await rt.provisionHumans(humans);
    seam = await rt.captureMatchingSeam(PFN.PREREQUISITES);
    await rt.clearProposalPrerequisites();
    await rt.recordFacts(first, { sex: 'FEMALE', firstName: 'Mona' });
    await rt.recordFacts(candidate, { sex: 'MALE', firstName: 'Omar' });
    const f = await rt.bringToOffered(first, candidate);
    await rt.asRole('postgres');
    const tokens = {
      first: jwt({ sub: first, role: 'authenticated' }), candidate: jwt({ sub: candidate, role: 'authenticated' }),
      outsider: jwt({ sub: outsider, role: 'authenticated' }), anon: jwt({ role: 'anon' }), server: jwt({ role: 'service_role' }),
    };
    const decide = (token, name, command, view) => rpc(token, name, { p_command_id: command, p_proposal_id: f.proposal, p_expected_view_id: view });

    stage = 'anon and service_role cannot call any boundary';
    for (const name of Object.keys(SIGNATURES)) {
      const body = name.startsWith('list_') ? { p_after_proposal_id: null, p_limit: 20 }
        : name.startsWith('get_') ? { p_proposal_id: f.proposal }
          : { p_command_id: randomUUID(), p_proposal_id: f.proposal, p_expected_view_id: f.firstView };
      for (const [who, token] of [['anon', tokens.anon], ['service_role', tokens.server]]) {
        assertNotCallable(await rpc(token, name, body), `${name} for ${who}`);
      }
    }

    stage = 'the reads: the first recipient sees the four neutral columns; nobody else sees anything';
    const mine = rowsOf(await rpc(tokens.first, 'list_my_matching_proposals_v1', { p_after_proposal_id: null, p_limit: 20 }), 'list');
    assert.deepEqual(mine, [{ recipient_view_id: f.firstView, matching_proposal_id: f.proposal, neutral_outcome: 'AWAITING_YOU',
      available_actions: ['APPROVE_FORWARD', 'DECLINE'] }]);
    assert.deepEqual(rowsOf(await rpc(tokens.first, 'get_my_matching_proposal_v1', { p_proposal_id: f.proposal }), 'get'), mine);
    for (const who of ['candidate', 'outsider']) {
      assert.deepEqual(rowsOf(await rpc(tokens[who], 'list_my_matching_proposals_v1', { p_after_proposal_id: null, p_limit: 20 }), `${who} list`), []);
      assert.deepEqual(rowsOf(await rpc(tokens[who], 'get_my_matching_proposal_v1', { p_proposal_id: f.proposal }), `${who} get`), []);
    }

    stage = 'a superseded view: the cores 40001 is answered once, CHANGED, on every line';
    const newer = randomUUID();
    await rt.materialize(newer, f.proposal, first, f.conclusionForFirst);
    await rt.asRole('postgres');
    const before = (await rows(`SELECT count(*)::int n FROM public.matching_proposal_transitions WHERE proposal_id = $1`, [f.proposal]))[0].n;
    assert.deepEqual(decision(await decide(tokens.first, 'approve_my_matching_proposal_forward_v1', randomUUID(), f.firstView), 'stale approval'),
      { outcome: 'CHANGED', neutral_outcome: null });
    assert.equal((await rows(`SELECT count(*)::int n FROM public.matching_proposal_transitions WHERE proposal_id = $1`, [f.proposal]))[0].n, before,
      'nothing moved');

    stage = 'an outsider decides nothing';
    assert.equal(decision(await decide(tokens.outsider, 'decline_my_matching_proposal_v1', randomUUID(), newer), 'outsider').outcome, 'UNAVAILABLE');

    stage = 'forward approval, its replay, a reused id, and the withdrawal';
    const command = randomUUID();
    assert.deepEqual(decision(await decide(tokens.first, 'approve_my_matching_proposal_forward_v1', command, newer), 'approval'),
      { outcome: 'RECORDED', neutral_outcome: 'IN_PROGRESS' });
    assert.deepEqual(decision(await decide(tokens.first, 'approve_my_matching_proposal_forward_v1', command, newer), 'approval replay'),
      { outcome: 'RECORDED', neutral_outcome: 'IN_PROGRESS' });
    assert.equal(decision(await decide(tokens.first, 'withdraw_my_matching_proposal_v1', command, newer), 'reused id').outcome, 'COMMAND_CONFLICT');
    assert.deepEqual(rowsOf(await rpc(tokens.first, 'get_my_matching_proposal_v1', { p_proposal_id: f.proposal }), 'after approval')[0].available_actions,
      ['WITHDRAW']);
    assert.deepEqual(decision(await decide(tokens.first, 'withdraw_my_matching_proposal_v1', randomUUID(), newer), 'withdrawal'),
      { outcome: 'RECORDED', neutral_outcome: 'CLOSED_BY_YOU' });
    await rt.asRole('postgres');
    assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'WITHDRAWN');

    console.log(`Verified S6-04 through live PostgREST ${version}: the five boundaries take exactly the API's parameters and refuse anon and service_role; the first recipient reads exactly the four neutral columns and nobody else reads anything; a stale-view decision is answered once (CHANGED) with nothing moved; approval, its replay, a reused id (COMMAND_CONFLICT), an outsider (UNAVAILABLE) and the withdrawal answer as specified.`);
  } catch (error) {
    failure = { stage, error };
  }
  stage = 'fixture removal';
  const removal = await (async () => {
    await rt.asRole('postgres');
    if (seam) await rt.restoreMatchingSeam(seam);
    await rt.cleanupRace(humans);
    await rt.removeFixtureHumans(humans);
  })().then(() => null, (error) => error ?? new Error('fixture removal failed')).finally(() => rt.client.end());
  if (failure && removal) {
    stage = failure.stage;
    throw new AggregateError([failure.error, removal],
      `${failure.error?.message ?? failure.error}; the fixture removal that followed ALSO failed: ${removal?.message ?? removal}`);
  }
  if (failure) { stage = failure.stage; throw failure.error; }
  if (removal) throw removal;
}

try {
  await main();
} catch (error) {
  console.error(`S6-04 PostgREST ${version} wire proof failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
}
