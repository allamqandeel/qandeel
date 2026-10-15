// S6-02 - live wire proof of the migration 0155 END boundary and of one representative Stage 4 read THROUGH a real
// PostgREST server.
//
// verify-migration-0155.mjs proves the boundary under SET ROLE. A client never issues SET ROLE: it sends a token to
// PostgREST, which switches to the token's role and calls the function. This proof closes that gap against the real
// engine Supabase runs, across the PostgREST lines CI starts it with (`POSTGREST_VERSION`):
//
//   * POST /rpc/end_own_introduction_v1 takes exactly { p_command_id, p_world_id } (checked against the live catalog);
//   * an outsider's token is answered UNAVAILABLE and moves nothing; anon and service-role tokens cannot call it;
//   * one matched human's token ends the live Introduction alone (ENDED, no gate); the same command again is ENDED and
//     changes nothing; the other human's token is ALREADY_SETTLED with a fresh command and UNAVAILABLE with the same
//     command id; the World is READ_ONLY_CLOSED / INTRODUCTION with exactly one terminal winner;
//   * while the Introduction is live, the representative Stage 4 reads answer it like a non-member's - the entry verdict
//     UNAVAILABLE with exactly its pinned output columns, no member row, no material.
//
// No request here is answered with SQLSTATE 40001 (the END core raises 23505 / 55000 / P0002, which the boundary turns
// into its three outcomes), so every PostgREST line answers each request once. Every fixture is removed afterwards,
// and every Matching seam this proof replaced is restored byte for byte.
//
// It needs DATABASE_URL (the fixture owner), POSTGREST_URL and POSTGREST_JWT_SECRET (a CI-only signing secret for the
// throwaway PostgREST container; never a deployment credential).
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import process from 'node:process';
import { DFN, PFN, createIntroductionRuntime } from './introduction-lifecycle-verifier-support.mjs';

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

/** One RPC, sent the way the Supabase client libraries send it, bounded so an unanswered request fails here. */
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

/** Not callable on the wire: refused for privilege, or not exposed to that role at all. */
function assertNotCallable(response, label) {
  const refused = [401, 403].includes(response.status) && response.body?.code === '42501';
  const hidden = response.status === 404 && response.body?.code === 'PGRST202';
  assert.ok(refused || hidden, `${label} is not callable (got ${response.status} ${JSON.stringify(response.body)})`);
  return refused ? '42501' : 'PGRST202';
}
const outcomeOf = (response, label) => {
  assert.equal(response.status, 200, `${label} is answered (${response.status} ${JSON.stringify(response.body)})`);
  assert.ok(Array.isArray(response.body) && response.body.length === 1, `${label} answers one row`);
  assert.deepEqual(Object.keys(response.body[0]), ['outcome'], `${label} answers exactly { outcome }`);
  return response.body[0].outcome;
};

async function main() {
  await rt.client.connect();
  const [one, two, three] = [randomUUID(), randomUUID(), randomUUID()];
  const humans = [one, two, three];
  const outcomes = new Set();
  const seams = [];
  let failure = null;
  try {
    stage = 'the request shape is the live signature';
    assert.deepEqual((await rt.inputParameters('public.end_own_introduction_v1(uuid, uuid)')).sort(), ['p_command_id', 'p_world_id']);

    stage = 'fixtures';
    await rt.provisionHumans(humans);
    for (const fn of [PFN.FIRST_NAME, PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) {
      seams.push(await rt.captureMatchingSeam(fn));
    }
    await rt.resolveFirstName({ [one]: 'Sara', [two]: 'Omar' });
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    const f = await rt.bringToIntroduction(one, two);
    await rt.asRole('postgres');
    const tokens = {
      lower: jwt({ sub: f.lower, role: 'authenticated' }), higher: jwt({ sub: f.higher, role: 'authenticated' }),
      outsider: jwt({ sub: three, role: 'authenticated' }), anon: jwt({ role: 'anon' }), server: jwt({ role: 'service_role' }),
    };

    stage = 'the live Introduction is not a Stage 4 World on the wire';
    const entry = await rpc(tokens.lower, 'resolve_own_shared_world_entry_v1', { p_world_id: f.world });
    assert.equal(entry.status, 200, JSON.stringify(entry.body));
    assert.deepEqual(Object.keys(entry.body[0]), ['outcome', 'world_id', 'born_at', 'joined_at'], 'the pinned entry columns');
    assert.deepEqual(entry.body[0], { outcome: 'UNAVAILABLE', world_id: null, born_at: null, joined_at: null },
      'the Introduction does not enter Stage 4, exactly like a World the reader does not belong to');
    const members = await rpc(tokens.lower, 'list_own_shared_world_members_v1', {});
    assert.equal(members.status, 200, JSON.stringify(members.body));
    assert.ok(members.body.every((m) => m.world_id !== f.world), 'no member row of the Introduction');
    const material = await rpc(tokens.lower, 'list_own_shared_world_material_v1',
      { p_world_id: f.world, p_before_established_at: null, p_before_material_id: null, p_limit: 50 });
    assert.equal(material.status, 200, JSON.stringify(material.body));
    assert.deepEqual(material.body, [], 'no Introduction material is read');

    stage = 'the END boundary: not callable by anon or service_role, UNAVAILABLE for an outsider';
    for (const [who, token] of [['anon', tokens.anon], ['service_role', tokens.server]]) {
      outcomes.add(assertNotCallable(await rpc(token, 'end_own_introduction_v1', { p_command_id: randomUUID(), p_world_id: f.world }), `END for ${who}`));
    }
    assert.equal(outcomeOf(await rpc(tokens.outsider, 'end_own_introduction_v1', { p_command_id: randomUUID(), p_world_id: f.world }), 'outsider END'),
      'UNAVAILABLE', 'an outsider cannot end it');
    assert.equal((await rt.recordRow(f.record)).introduction_status, 'ACTIVE', 'and nothing moved');

    stage = 'one matched human ends it alone; a retry is the same answer; the other is told only that it is settled';
    const command = randomUUID();
    assert.equal(outcomeOf(await rpc(tokens.lower, 'end_own_introduction_v1', { p_command_id: command, p_world_id: f.world }), 'END'), 'ENDED');
    assert.equal(outcomeOf(await rpc(tokens.lower, 'end_own_introduction_v1', { p_command_id: command, p_world_id: f.world }), 'END retry'), 'ENDED');
    assert.equal(outcomeOf(await rpc(tokens.higher, 'end_own_introduction_v1', { p_command_id: randomUUID(), p_world_id: f.world }), 'other END'),
      'ALREADY_SETTLED');
    assert.equal(outcomeOf(await rpc(tokens.higher, 'end_own_introduction_v1', { p_command_id: command, p_world_id: f.world }), 'reused command id'),
      'UNAVAILABLE');
    assert.equal(outcomeOf(await rpc(tokens.outsider, 'end_own_introduction_v1', { p_command_id: randomUUID(), p_world_id: f.world }), 'outsider after END'),
      'UNAVAILABLE', 'an outsider never learns that the World is settled');
    await rt.asRole('postgres');
    const [world] = await rows('SELECT lifecycle, phase FROM public.shared_worlds WHERE id = $1', [f.world]);
    assert.deepEqual(world, { lifecycle: 'READ_ONLY_CLOSED', phase: 'INTRODUCTION' });
    const terminal = await rt.terminalRow(f.record);
    assert.deepEqual([terminal.id, terminal.terminal_outcome, terminal.ending_actor_user_id], [command, 'CLOSED', f.lower], 'exactly one terminal winner');

    console.log(`Verified S6-02 through live PostgREST ${version}: end_own_introduction_v1 takes only the command and the World, ends a live Introduction for one matched human alone and ungated, answers its retry ENDED, the other human ALREADY_SETTLED or UNAVAILABLE for a reused id, an outsider UNAVAILABLE, and is not callable by anon or service_role (${[...outcomes].sort().join(' / ')}); the live Introduction is no Stage 4 World (entry with its pinned columns, members, material).`);
  } catch (error) {
    failure = { stage, error };
  }
  stage = 'fixture removal';
  const removal = await (async () => {
    await rt.asRole('postgres');
    for (const seam of seams) await rt.restoreMatchingSeam(seam);
    await rt.cleanupIntroductionRace([one, two]);
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
  console.error(`S6-02 PostgREST ${version} wire proof failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
}
