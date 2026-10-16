// S6-05 (CP4) - live wire proof of END and the migration 0161 closed Introduction history THROUGH a real PostgREST
// server.
//
// verify-migration-0161.mjs proves the reader, END and owner deletion under SET ROLE. A client never issues SET ROLE: it
// sends a token to PostgREST, which switches to the token's role and calls the function. This proof closes that gap
// against the real engine Supabase runs, across the PostgREST lines CI starts it with (`POSTGREST_VERSION`):
//
//   * the reader takes exactly the parameters the API sends (checked against the live catalog);
//   * anon and service-role tokens cannot call it;
//   * a live Introduction has no closed history yet;
//   * one human's token ends the Introduction alone through the S6-02 END (ENDED), its retry is the same END, and the
//     other human's END is ALREADY_SETTLED; an outsider's END is UNAVAILABLE;
//   * each human's token reads the closed history - both messages, each marked as theirs or not - and an outsider's
//     nothing;
//   * nobody deletes another's words; the author deletes their own through the existing Shared owner deletion (R-5), and
//     it is gone from BOTH histories;
//   * a send after END is ENDED, and nothing is written: the two frozen entitlements are exactly what END wrote.
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
const HISTORY = 'read_my_introduction_history_v1';
const SIGNATURE = ['public.read_my_introduction_history_v1(uuid, timestamptz, uuid, integer)', ['p_before_established_at', 'p_before_material_id', 'p_limit', 'p_world_id']];
const words = (page) => page.map((r) => [r.introduction_state, r.is_self, r.text_body]);

async function main() {
  await rt.client.connect();
  const [first, candidate, outsider] = Array.from({ length: 3 }, () => randomUUID());
  const humans = [first, candidate, outsider];
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
    const f = await rt.bringToIntroduction(first, candidate);
    await rt.asRole('postgres');
    const tokens = {
      first: jwt({ sub: first, role: 'authenticated' }), candidate: jwt({ sub: candidate, role: 'authenticated' }),
      outsider: jwt({ sub: outsider, role: 'authenticated' }), anon: jwt({ role: 'anon' }), server: jwt({ role: 'service_role' }),
    };
    const history = (token) => rpc(token, HISTORY, { p_world_id: f.world, p_before_established_at: null, p_before_material_id: null, p_limit: 51 });
    const send = (token, content) => rpc(token, 'send_my_introduction_text_v1', { p_command_id: randomUUID(), p_world_id: f.world, p_content: content });
    const end = (token, command = randomUUID()) => rpc(token, 'end_own_introduction_v1', { p_command_id: command, p_world_id: f.world });
    const remove = (token, material) => rpc(token, 'delete_own_shared_world_material_v1', { p_command_id: randomUUID(), p_world_id: f.world, p_material_id: material });
    const written = async () => (await rows(`SELECT (SELECT count(*)::int FROM public.shared_world_materials WHERE world_id = $1) AS materials,
        (SELECT count(*)::int FROM public.introduction_closed_view_entitlements WHERE world_id = $1) AS entitlements,
        (SELECT count(*)::int FROM public.introduction_closed_view_entitlement_items WHERE world_id = $1) AS items`, [f.world]))[0];

    stage = 'anon and service_role cannot call the reader';
    assertNotCallable(await history(tokens.anon), `${HISTORY} for anon`);
    assertNotCallable(await history(tokens.server), `${HISTORY} for service_role`);

    stage = 'a live Introduction has no closed history yet';
    const mine = answered(await send(tokens.first, 'Hello Omar'), 'first send')[0];
    assert.equal(mine.outcome, 'COMMITTED');
    assert.equal(answered(await send(tokens.candidate, 'Hello Mona'), 'candidate send')[0].outcome, 'COMMITTED');
    for (const token of [tokens.first, tokens.candidate, tokens.outsider]) assert.deepEqual(answered(await history(token), 'history before END'), []);

    stage = 'END by one human alone; its retry; the other is ALREADY_SETTLED; an outsider UNAVAILABLE';
    assert.deepEqual(answered(await end(tokens.outsider), 'outsider end'), [{ outcome: 'UNAVAILABLE' }]);
    const command = randomUUID();
    assert.deepEqual(answered(await end(tokens.first, command), 'end'), [{ outcome: 'ENDED' }]);
    assert.deepEqual(answered(await end(tokens.first, command), 'end retry'), [{ outcome: 'ENDED' }], 'the retry is the same END');
    assert.deepEqual(answered(await end(tokens.candidate), 'other end'), [{ outcome: 'ALREADY_SETTLED' }]);
    await rt.asRole('postgres');
    const closed = await written();
    assert.equal(closed.entitlements, 2, 'END froze exactly two entitlements');

    stage = 'each human reads the closed history; an outsider nothing';
    assert.deepEqual(words(answered(await history(tokens.first), 'first history')), [['ENDED', false, 'Hello Mona'], ['ENDED', true, 'Hello Omar']]);
    assert.deepEqual(words(answered(await history(tokens.candidate), 'candidate history')), [['ENDED', true, 'Hello Mona'], ['ENDED', false, 'Hello Omar']]);
    assert.deepEqual(answered(await history(tokens.outsider), 'outsider history'), []);

    stage = 'owner deletion after END, reused (R-5): gone from both histories';
    assert.deepEqual(answered(await remove(tokens.candidate, mine.material_id), 'not the author'), [{ outcome: 'UNAVAILABLE' }]);
    assert.deepEqual(answered(await remove(tokens.outsider, mine.material_id), 'an outsider'), [{ outcome: 'UNAVAILABLE' }]);
    assert.deepEqual(answered(await remove(tokens.first, mine.material_id), 'the author'), [{ outcome: 'DELETED' }]);
    assert.deepEqual(words(answered(await history(tokens.first), 'first history after delete')), [['ENDED', false, 'Hello Mona']]);
    assert.deepEqual(words(answered(await history(tokens.candidate), 'candidate history after delete')), [['ENDED', true, 'Hello Mona']]);

    stage = 'nothing after END: no send, no new entitlement';
    for (const token of [tokens.first, tokens.candidate]) assert.equal(answered(await send(token, 'after the end'), 'send after END')[0].outcome, 'ENDED');
    await rt.asRole('postgres');
    const after = await written();
    assert.deepEqual([after.entitlements, after.items, after.materials], [closed.entitlements, closed.items, closed.materials],
      'nothing was written after END: no entitlement, item or message');

    console.log(`Verified S6-05 CP4 through live PostgREST ${version}: the closed-history reader takes exactly the API's parameters and refuses anon and service_role; a live Introduction has no closed history; one human ends it alone, the retry is the same END, the other is ALREADY_SETTLED and an outsider UNAVAILABLE; each human reads their own closed history and an outsider nothing; nobody deletes another's words, the author's owner deletion removes the message from both histories; after END a send is ENDED and no entitlement, item or message is written.`);
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
  console.error(`S6-05 CP4 PostgREST ${version} wire proof failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
}
