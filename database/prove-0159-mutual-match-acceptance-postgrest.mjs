// S6-05 - live wire proof of the migration 0159 Mutual Match acceptance THROUGH a real PostgREST server.
//
// verify-migration-0159.mjs proves the acceptance under SET ROLE. A client never issues SET ROLE: it sends a token to
// PostgREST, which switches to the token's role and calls the function. This proof closes that gap against the real
// engine Supabase runs, across the PostgREST lines CI starts it with (`POSTGREST_VERSION`):
//
//   * the acceptance takes exactly the parameters the API sends (checked against the live catalog);
//   * anon and service-role tokens cannot call it;
//   * the second recipient's token reads ACCEPT beside DECLINE in the four neutral columns, and the first recipient's
//     does not;
//   * an acceptance on a superseded view, and one whose first approval is no longer current - both the frozen core's
//     40001 - are each answered ONCE, HTTP 200, CHANGED and UNAVAILABLE, on every line, including the lines before v16
//     that re-run a 40001 transaction without bound; nothing moves;
//   * an outsider's acceptance is UNAVAILABLE; the acceptance is MATCHED with the World the core bound, its replay
//     MATCHED with the same World and nothing new, and the same command id with another view COMMAND_CONFLICT.
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
const answerOf = (response, label) => {
  assert.equal(response.status, 200, `${label} is answered (${response.status} ${JSON.stringify(response.body)})`);
  assert.ok(Array.isArray(response.body) && response.body.length === 1, `${label} answers one row`);
  assert.deepEqual(Object.keys(response.body[0]), ['outcome', 'introduction_world_id'], `${label} answers exactly { outcome, introduction_world_id }`);
  return response.body[0];
};
const ACCEPT = 'accept_my_matching_proposal_v1';
const SIGNATURE = ['public.accept_my_matching_proposal_v1(uuid, uuid, uuid)', ['p_command_id', 'p_expected_view_id', 'p_proposal_id']];

async function main() {
  await rt.client.connect();
  const [first, candidate, outsider, otherFirst, otherCandidate] = Array.from({ length: 5 }, () => randomUUID());
  const humans = [first, candidate, outsider, otherFirst, otherCandidate];
  let seam = null;
  let failure = null;
  try {
    stage = 'the request shape is the live signature';
    assert.deepEqual((await rt.inputParameters(SIGNATURE[0])).sort(), SIGNATURE[1], SIGNATURE[0]);

    stage = 'fixtures';
    await rt.provisionHumans(humans);
    seam = await rt.captureMatchingSeam(PFN.PREREQUISITES);
    await rt.clearProposalPrerequisites();
    await rt.recordFacts(first, { sex: 'FEMALE', firstName: 'Mona' });
    await rt.recordFacts(candidate, { sex: 'MALE', firstName: 'Omar' });
    const f = await rt.bringToForwarded(first, candidate);
    await rt.asRole('postgres');
    const tokens = {
      first: jwt({ sub: first, role: 'authenticated' }), candidate: jwt({ sub: candidate, role: 'authenticated' }),
      outsider: jwt({ sub: outsider, role: 'authenticated' }), anon: jwt({ role: 'anon' }), server: jwt({ role: 'service_role' }),
    };
    const accept = (token, command, view) => rpc(token, ACCEPT, { p_command_id: command, p_proposal_id: f.proposal, p_expected_view_id: view });
    const transitions = async () => (await rows('SELECT count(*)::int n FROM public.matching_proposal_transitions WHERE proposal_id = $1', [f.proposal]))[0].n;
    const commits = async () => (await rows('SELECT count(*)::int n FROM public.matching_match_commits WHERE proposal_id = $1', [f.proposal]))[0].n;

    stage = 'anon and service_role cannot accept';
    for (const [who, token] of [['anon', tokens.anon], ['service_role', tokens.server]]) {
      assertNotCallable(await accept(token, randomUUID(), f.secondView), `${ACCEPT} for ${who}`);
    }

    stage = 'the second recipient reads ACCEPT beside DECLINE; the first recipient does not';
    const listed = await rpc(tokens.candidate, 'get_my_matching_proposal_v1', { p_proposal_id: f.proposal });
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body, [{ recipient_view_id: f.secondView, matching_proposal_id: f.proposal, neutral_outcome: 'AWAITING_YOU',
      available_actions: ['ACCEPT', 'DECLINE'] }]);
    assert.deepEqual((await rpc(tokens.first, 'get_my_matching_proposal_v1', { p_proposal_id: f.proposal })).body[0].available_actions, ['WITHDRAW']);

    stage = 'a superseded view: the core\'s 40001 is answered once, CHANGED, on every line';
    const newer = randomUUID();
    await rt.materialize(newer, f.proposal, candidate, f.conclusionForCandidate);
    await rt.asRole('postgres');
    let before = await transitions();
    assert.deepEqual(answerOf(await accept(tokens.candidate, randomUUID(), f.secondView), 'stale view'), { outcome: 'CHANGED', introduction_world_id: null });
    assert.equal(await transitions(), before, 'nothing moved');

    stage = 'an outsider accepts nothing';
    assert.deepEqual(answerOf(await accept(tokens.outsider, randomUUID(), newer), 'outsider'), { outcome: 'UNAVAILABLE', introduction_world_id: null });

    stage = 'a first approval no longer current: the core\'s NOT_COMMITTABLE 40001 is answered once, UNAVAILABLE, on every line';
    // A second, separate pair, so the first pair's proposal stays acceptable. The first recipient's view is superseded
    // after forwarding (only a direct core call can do that), which the frozen core refuses as one bounded class.
    await rt.recordFacts(otherFirst, { sex: 'FEMALE', firstName: 'Salma' });
    await rt.recordFacts(otherCandidate, { sex: 'MALE', firstName: 'Ali' });
    const g = await rt.bringToForwarded(otherFirst, otherCandidate);
    await rt.materialize(randomUUID(), g.proposal, otherFirst, g.conclusionForFirst);
    await rt.asRole('postgres');
    const gTransitions = async () => (await rows('SELECT count(*)::int n FROM public.matching_proposal_transitions WHERE proposal_id = $1', [g.proposal]))[0].n;
    const gBefore = await gTransitions();
    assert.deepEqual(answerOf(await rpc(jwt({ sub: otherCandidate, role: 'authenticated' }), ACCEPT,
      { p_command_id: randomUUID(), p_proposal_id: g.proposal, p_expected_view_id: g.secondView }), 'stale first approval'),
    { outcome: 'UNAVAILABLE', introduction_world_id: null });
    assert.equal(await gTransitions(), gBefore, 'nothing moved');

    stage = 'the acceptance, its replay and a reused id';
    const command = randomUUID();
    const matched = answerOf(await accept(tokens.candidate, command, newer), 'acceptance');
    assert.equal(matched.outcome, 'MATCHED');
    assert.match(matched.introduction_world_id, /^[0-9a-f-]{36}$/u);
    await rt.asRole('postgres');
    assert.equal(await commits(), 1);
    before = await transitions();
    assert.deepEqual(answerOf(await accept(tokens.candidate, command, newer), 'acceptance replay'), matched, 'the same World');
    assert.equal(await commits(), 1, 'nothing new');
    assert.equal(await transitions(), before, 'nothing new');
    assert.equal(answerOf(await accept(tokens.candidate, command, randomUUID()), 'reused id').outcome, 'COMMAND_CONFLICT');
    const [world] = await rows('SELECT lifecycle, phase, birth_basis FROM public.shared_worlds WHERE id = $1', [matched.introduction_world_id]);
    assert.deepEqual(world, { lifecycle: 'ACTIVE', phase: 'INTRODUCTION', birth_basis: 'MUTUAL_MATCH' });

    console.log(`Verified S6-05 through live PostgREST ${version}: the acceptance takes exactly the API's parameters and refuses anon and service_role; ACCEPT is offered to the second recipient only; a stale-view acceptance is answered once (CHANGED) with nothing moved; an outsider is UNAVAILABLE; the acceptance is MATCHED with its World, its replay answers the same World with nothing new, and a reused id is COMMAND_CONFLICT.`);
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
  console.error(`S6-05 PostgREST ${version} wire proof failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
}
