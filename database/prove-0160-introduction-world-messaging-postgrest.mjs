// S6-05 (CP3) - live wire proof of the migration 0160 Introduction World reading and human messaging THROUGH a real
// PostgREST server.
//
// verify-migration-0160.mjs proves the three boundaries under SET ROLE. A client never issues SET ROLE: it sends a token
// to PostgREST, which switches to the token's role and calls the function. This proof closes that gap against the real
// engine Supabase runs, across the PostgREST lines CI starts it with (`POSTGREST_VERSION`):
//
//   * each boundary takes exactly the parameters the API sends (checked against the live catalog);
//   * anon and service-role tokens cannot call any of them;
//   * both humans' tokens list the one Introduction World with the other's handoff first name; an outsider's lists
//     nothing, reads nothing and sends nothing (UNAVAILABLE);
//   * a message is COMMITTED, read by the other human as theirs-not-mine, its retry is the same message, and the same
//     command id with other words is COMMAND_CONFLICT;
//   * the author deletes it through the existing Shared owner deletion (R-5);
//   * after the S6-02 END each human's token reads, lists and sends ENDED, and an outsider's still UNAVAILABLE.
//
// Every fixture is removed afterwards, and the CW2-08 seam this proof replaced is restored byte for byte.
//
// It needs DATABASE_URL (the fixture owner), POSTGREST_URL and POSTGREST_JWT_SECRET (a CI-only signing secret for the
// throwaway PostgREST container; never a deployment credential).
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import process from 'node:process';
import { PFN, createIntroductionRuntime } from './introduction-lifecycle-verifier-support.mjs';

const databaseUrl = process.env.DATABASE_URL;
const postgrestUrl = (process.env.POSTGREST_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const version = process.env.POSTGREST_VERSION ?? 'unspecified';
if (!databaseUrl || !secret) throw new Error('DATABASE_URL and POSTGREST_JWT_SECRET are required.');

const rt = createIntroductionRuntime(databaseUrl);
const { rows } = rt;
let stage = 'connect';

const base64url = (value) => Buffer.from(value).toString('base64url');
function jwt(claims) {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 600 }))}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

/** One RPC, sent the way the API sends it, bounded so an unanswered request fails here. */
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
const answered = (response, label) => {
  assert.equal(response.status, 200, `${label} is answered (${response.status} ${JSON.stringify(response.body)})`);
  assert.ok(Array.isArray(response.body), `${label} answers rows`);
  return response.body;
};
const sent = (response, label) => {
  const body = answered(response, label);
  assert.equal(body.length, 1, `${label} answers one row`);
  assert.deepEqual(Object.keys(body[0]), ['outcome', 'material_id', 'established_at'], `${label} answers exactly { outcome, material_id, established_at }`);
  return body[0];
};
const LIST = 'list_my_introduction_worlds_v1';
const READ = 'read_my_introduction_messages_v1';
const SEND = 'send_my_introduction_text_v1';
const SIGNATURES = [
  ['public.list_my_introduction_worlds_v1()', []],
  ['public.read_my_introduction_messages_v1(uuid, timestamptz, uuid, integer)', ['p_before_established_at', 'p_before_material_id', 'p_limit', 'p_world_id']],
  ['public.send_my_introduction_text_v1(uuid, uuid, text)', ['p_command_id', 'p_content', 'p_world_id']],
];
const ENDED_ROW = { introduction_state: 'ENDED', material_id: null, established_at: null, is_self: null, text_body: null };

async function main() {
  await rt.client.connect();
  const [first, candidate, outsider] = Array.from({ length: 3 }, () => randomUUID());
  const humans = [first, candidate, outsider];
  let seam = null;
  let failure = null;
  try {
    stage = 'each request shape is the live signature';
    for (const [signature, parameters] of SIGNATURES) assert.deepEqual((await rt.inputParameters(signature)).sort(), parameters, signature);

    stage = 'fixtures';
    await rt.provisionHumans(humans);
    seam = await rt.captureMatchingSeam(PFN.PREREQUISITES);
    await rt.clearProposalPrerequisites();
    await rt.recordFacts(first, { sex: 'FEMALE', firstName: 'Mona' });
    await rt.recordFacts(candidate, { sex: 'MALE', firstName: 'Omar' });
    const f = await rt.bringToIntroduction(first, candidate);
    await rt.asRole('postgres');
    const tokens = {
      first: jwt({ sub: first, role: 'authenticated' }), candidate: jwt({ sub: candidate, role: 'authenticated' }),
      outsider: jwt({ sub: outsider, role: 'authenticated' }), anon: jwt({ role: 'anon' }), server: jwt({ role: 'service_role' }),
    };
    const read = (token) => rpc(token, READ, { p_world_id: f.world, p_before_established_at: null, p_before_material_id: null, p_limit: 51 });
    const send = (token, command, content) => rpc(token, SEND, { p_command_id: command, p_world_id: f.world, p_content: content });
    const materials = async () => (await rows('SELECT count(*)::int n FROM public.shared_world_materials WHERE world_id = $1', [f.world]))[0].n;

    stage = 'anon and service_role cannot call any boundary';
    for (const [who, token] of [['anon', tokens.anon], ['service_role', tokens.server]]) {
      assertNotCallable(await rpc(token, LIST, {}), `${LIST} for ${who}`);
      assertNotCallable(await read(token), `${READ} for ${who}`);
      assertNotCallable(await send(token, randomUUID(), 'x'), `${SEND} for ${who}`);
    }

    stage = 'both humans find the World; an outsider finds, reads and sends nothing';
    assert.deepEqual(answered(await rpc(tokens.first, LIST, {}), 'first list'),
      [{ world_id: f.world, matching_proposal_id: f.proposal, introduction_state: 'ACTIVE', other_first_name: 'Omar' }]);
    assert.deepEqual(answered(await rpc(tokens.candidate, LIST, {}), 'candidate list'),
      [{ world_id: f.world, matching_proposal_id: f.proposal, introduction_state: 'ACTIVE', other_first_name: 'Mona' }]);
    assert.deepEqual(answered(await rpc(tokens.outsider, LIST, {}), 'outsider list'), []);
    assert.deepEqual(answered(await read(tokens.outsider), 'outsider read'), []);
    assert.deepEqual(sent(await send(tokens.outsider, randomUUID(), 'let me in'), 'outsider send'), { outcome: 'UNAVAILABLE', material_id: null, established_at: null });

    stage = 'a message, its reading, its retry and a reused id';
    const command = randomUUID();
    const message = sent(await send(tokens.first, command, 'Hello Omar'), 'send');
    assert.equal(message.outcome, 'COMMITTED');
    assert.match(message.material_id, /^[0-9a-f-]{36}$/u);
    const page = answered(await read(tokens.candidate), 'candidate read');
    assert.deepEqual(page.map((r) => [r.introduction_state, r.material_id, r.is_self, r.text_body]), [['ACTIVE', message.material_id, false, 'Hello Omar']]);
    await rt.asRole('postgres');
    assert.equal(await materials(), 1);
    assert.deepEqual(sent(await send(tokens.first, command, 'Hello Omar'), 'retry'), message, 'the retry is the same message');
    assert.equal(await materials(), 1, 'nothing new');
    assert.equal(sent(await send(tokens.first, command, 'other words'), 'reused id').outcome, 'COMMAND_CONFLICT');

    stage = 'the author deletes it through the existing owner deletion (R-5)';
    const deleted = answered(await rpc(tokens.first, 'delete_own_shared_world_material_v1',
      { p_command_id: randomUUID(), p_world_id: f.world, p_material_id: message.material_id }), 'delete');
    assert.deepEqual(deleted, [{ outcome: 'DELETED' }]);
    assert.deepEqual(answered(await read(tokens.candidate), 'read after delete'), [{ ...ENDED_ROW, introduction_state: 'ACTIVE' }],
      'the deleted message is gone: one empty ACTIVE row');

    stage = 'after END: ENDED to the two humans only';
    assert.deepEqual(answered(await rpc(tokens.candidate, 'end_own_introduction_v1', { p_command_id: randomUUID(), p_world_id: f.world }), 'end'),
      [{ outcome: 'ENDED' }]);
    for (const token of [tokens.first, tokens.candidate]) {
      assert.deepEqual(answered(await read(token), 'member read after END'), [ENDED_ROW]);
      assert.equal(answered(await rpc(token, LIST, {}), 'member list after END')[0].introduction_state, 'ENDED');
      assert.equal(sent(await send(token, randomUUID(), 'after the end'), 'member send after END').outcome, 'ENDED');
    }
    assert.deepEqual(answered(await read(tokens.outsider), 'outsider read after END'), []);
    assert.equal(sent(await send(tokens.outsider, randomUUID(), 'after the end'), 'outsider send after END').outcome, 'UNAVAILABLE');
    await rt.asRole('postgres');
    assert.equal(await materials(), 1, 'nothing was written after END');

    console.log(`Verified S6-05 CP3 through live PostgREST ${version}: the three boundaries take exactly the API's parameters and refuse anon and service_role; both humans find the World and an outsider nothing; a message is COMMITTED and read by the other human, its retry is the same message and a reused id COMMAND_CONFLICT; the author deletes it through the existing owner deletion; after END the two humans read, list and send ENDED and an outsider is still UNAVAILABLE.`);
  } catch (error) {
    failure = { stage, error };
  }
  stage = 'fixture removal';
  const removal = await (async () => {
    await rt.asRole('postgres');
    if (seam) await rt.restoreMatchingSeam(seam);
    await rt.cleanupIntroductionRace(humans);
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
  console.error(`S6-05 CP3 PostgREST ${version} wire proof failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
}
