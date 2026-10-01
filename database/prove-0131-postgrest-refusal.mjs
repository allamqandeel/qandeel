// PROD-SEC-02 - live wire proof of the migration 0131 refusal contract THROUGH a real PostgREST server.
//
// verify-migration-0131.mjs proves what PostgreSQL raises (SQLSTATE PT429, message TURN_ADMISSION_LIMITED). The API
// never sees that: it sees the HTTP answer PostgREST makes of it. This proof closes that gap against the real engine
// Supabase runs, across the PostgREST lines CI starts it with (`POSTGREST_VERSION`):
//
//   * a bounded admission, called exactly as SupabaseDataApiService calls it (authenticated JWT, POST /rpc/...),
//     answers HTTP 429 with body code 'PT429' and message 'TURN_ADMISSION_LIMITED' and nothing else disclosed - the
//     exact identity ConversationService recognises - and commits no row;
//   * an idempotent replay still answers 409 / 23505, so the replay path the API resolves is unchanged;
//   * the service-role work commands answer the row shapes ConversationTurnWorkRepository reads (GRANTED with a
//     lease id; LIMITED with none once the work-start budget is spent), and a user token cannot reach them.
//
// It needs DATABASE_URL (the fixture owner), POSTGREST_URL and POSTGREST_JWT_SECRET (a CI-only signing secret for
// the throwaway PostgREST container; never a deployment credential).
import assert from 'node:assert/strict'; import { createHmac, randomUUID } from 'node:crypto'; import process from 'node:process'; import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const postgrestUrl = (process.env.POSTGREST_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const version = process.env.POSTGREST_VERSION ?? 'unspecified';
if (!databaseUrl || !secret) throw new Error('DATABASE_URL and POSTGREST_JWT_SECRET are required.');

const client = new pg.Client({ connectionString: databaseUrl });
let stage = 'connect';

const base64url = (value) => Buffer.from(value).toString('base64url');
function jwt(claims) {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 600 }))}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

/** One RPC, sent the way SupabaseDataApiService / SupabaseServiceRoleApiService send it. */
async function rpc(token, name, body) {
  const response = await fetch(`${postgrestUrl}/rpc/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text.length > 0 ? JSON.parse(text) : null };
}

async function main() {
  await client.connect();
  const user = randomUUID();
  const session = randomUUID();
  try {
    stage = 'fixtures';
    await client.query('INSERT INTO auth.users(id) VALUES($1)', [user]);
    await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [session, user]);
    const userToken = jwt({ sub: user, role: 'authenticated' });
    const serverToken = jwt({ role: 'service_role' });
    const admission = (key) => ({ p_id: randomUUID(), p_session_id: session, p_content: 'wire proof', p_idempotency_key: key });

    stage = 'an admission inside the bound';
    const first = await rpc(userToken, 'create_user_conversation_turn', admission('wire-proof-1'));
    assert.equal(first.status, 200, `the first admission is accepted (${first.status} ${JSON.stringify(first.body)})`);
    const [admitted] = first.body;
    assert.equal(admitted.status, 'RECEIVED');

    stage = 'a bounded admission is HTTP 429 with the exact typed identity';
    const refusedId = randomUUID();
    const refused = await rpc(userToken, 'create_user_conversation_turn', { ...admission('wire-proof-2'), p_id: refusedId });
    assert.equal(refused.status, 429, `PT429 becomes HTTP 429 (got ${refused.status} ${JSON.stringify(refused.body)})`);
    assert.equal(refused.body.code, 'PT429', 'the body carries the SQLSTATE the API recognises');
    assert.equal(refused.body.message, 'TURN_ADMISSION_LIMITED', 'the body carries the message the API recognises');
    assert.equal(refused.body.details ?? null, null, 'no detail is disclosed');
    assert.equal(refused.body.hint ?? null, null, 'no hint is disclosed');
    assert.equal((await client.query('SELECT count(*)::int n FROM public.conversation_turns WHERE id=$1', [refusedId])).rows[0].n, 0, 'a refusal commits nothing');

    stage = 'an idempotent replay is still the unique violation the API resolves';
    const replay = await rpc(userToken, 'create_user_conversation_turn', admission('wire-proof-1'));
    assert.equal(replay.status, 409, `a replay is never limited (${replay.status} ${JSON.stringify(replay.body)})`);
    assert.equal(replay.body.code, '23505');

    stage = 'the work commands answer the shapes the repository reads';
    const work = { p_session_id: session, p_user_id: user, p_source_turn_id: admitted.id };
    const granted = await rpc(serverToken, 'begin_conversation_turn_work_v1', work);
    assert.equal(granted.status, 200, JSON.stringify(granted.body));
    assert.equal(granted.body.length, 1);
    assert.equal(granted.body[0].work_outcome, 'GRANTED');
    assert.match(granted.body[0].work_lease_id, /^[0-9a-f-]{36}$/u);
    const ended = await rpc(serverToken, 'end_conversation_turn_work_v1', { p_user_id: user, p_source_turn_id: admitted.id, p_lease_id: granted.body[0].work_lease_id });
    assert.equal(ended.status, 200);
    assert.equal(ended.body, true);

    stage = 'a spent work-start budget is LIMITED on the wire';
    const [{ work_short_window_limit: limit }] = (await client.query('SELECT work_short_window_limit FROM public.conversation_turn_admission_policy_v1()')).rows;
    await client.query(`INSERT INTO public.conversation_turn_work_grants(user_turn_id,user_id,granted_at)
      SELECT $1, $2, now() - interval '1 minute' FROM generate_series(1, $3)`, [admitted.id, user, limit]);
    const limited = await rpc(serverToken, 'begin_conversation_turn_work_v1', work);
    assert.equal(limited.status, 200);
    assert.deepEqual(limited.body, [{ work_outcome: 'LIMITED', work_lease_id: null }]);

    stage = 'a user token cannot reach the work commands';
    const intrusion = await rpc(userToken, 'begin_conversation_turn_work_v1', work);
    assert.ok([401, 403, 404].includes(intrusion.status), `a user token is refused (${intrusion.status})`);

    console.log(`Verified PROD-SEC-02 through live PostgREST ${version}: a bounded admission is HTTP 429 {code PT429, message TURN_ADMISSION_LIMITED} with nothing disclosed or committed; a replay stays 409/23505; the work commands answer GRANTED / LIMITED in the exact row shape the API reads, and a user token cannot reach them.`);
  } finally {
    await client.query('DELETE FROM public.runtime_event_outbox WHERE subject_user_id=$1', [user]);
    await client.query('DELETE FROM public.conversation_turns WHERE user_id=$1', [user]);
    await client.query("SET session_replication_role = 'replica'");
    try {
      await client.query('DELETE FROM public.session_historical_baselines WHERE session_id=$1', [session]);
      await client.query('DELETE FROM public.session_historical_coverage WHERE session_id=$1', [session]);
      await client.query('DELETE FROM public.historical_world_semantic_clocks WHERE user_id=$1', [user]);
      await client.query('DELETE FROM public.session_semantic_clocks WHERE session_id=$1', [session]);
      await client.query('DELETE FROM public.conversation_sessions WHERE id=$1', [session]);
      await client.query('DELETE FROM public.users WHERE id=$1', [user]);
      await client.query('DELETE FROM auth.users WHERE id=$1', [user]);
    } finally {
      await client.query("SET session_replication_role = 'origin'");
    }
    await client.end();
  }
}

main().catch((error) => {
  console.error(`PROD-SEC-02 PostgREST ${version} wire proof failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
});
