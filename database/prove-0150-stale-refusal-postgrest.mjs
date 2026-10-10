// PROD-RETRY-01 - live wire proof of migration 0150 THROUGH a real PostgREST server (QAN-BL-PROD-06).
//
// verify-migration-0150.mjs proves what PostgreSQL raises: the deterministic stale-state refusals are SQLSTATE PT409
// with the frozen message. The API and every direct Data API caller never see that; they see the HTTP answer PostgREST
// makes of it. PostgREST before v16.0 re-runs a request's whole transaction, without bound, on 40001: a deterministic
// 40001 is never answered and holds a pool connection. This proof runs against every PostgREST line CI starts
// (`POSTGREST_VERSION`) and proves, with every request bounded by RPC_TIMEOUT_MS so that an unanswered request FAILS
// the proof instead of hanging it:
//
//   * ATTEMPTS: a probe that raises PT409 is answered HTTP 409 {code PT409} after exactly ONE execution, counted by a
//     non-transactional sequence the re-runs could not roll back. On v16+ only, a probe that raises 40001 is answered
//     HTTP 500 {code 40001} after exactly one execution - the answer the API received for these refusals before 0150
//     wherever PostgREST answered at all. It is never sent to a line before v16, which would re-run it forever.
//   * THE REAL ENTRY POINTS, called exactly as a client calls them: transition_hypothesis_v2,
//     apply_hypothesis_evidence_update and rotate_own_sealed_shared_id_v1 and the two retained Matching reducers with a
//     user token, background_apply_hypothesis_evidence_update_v1 and get_conversation_thread_identity_dossier_page_v1
//     with the service token. Each stale request is answered at once with HTTP 409, code PT409, the frozen message,
//     the frozen DETAIL (or none) and no HINT, and commits nothing.
//
// It needs DATABASE_URL (the fixture owner), POSTGREST_URL and POSTGREST_JWT_SECRET (a CI-only signing secret for the
// throwaway PostgREST container; never a deployment credential). Every fixture and probe object it creates is removed
// in `finally`, whatever happened.
import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const postgrestUrl = (process.env.POSTGREST_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const version = process.env.POSTGREST_VERSION ?? 'unspecified';
if (!databaseUrl || !secret) throw new Error('DATABASE_URL and POSTGREST_JWT_SECRET are required.');
/** A request PostgREST re-runs is never answered: this bound turns that into a named failure, never a hang. */
const RPC_TIMEOUT_MS = 10_000;
const major = Number(/^v?(\d+)/u.exec(version)?.[1] ?? Number.NaN);
const RETRIES_40001 = !(major >= 16);
const STALE_DETAIL = 'The user/world Thread identity dossiers changed after the runtime context was read; re-read the context and screen again.';

const client = new pg.Client({ connectionString: databaseUrl });
let stage = 'connect';

const base64url = (value) => Buffer.from(value).toString('base64url');
function jwt(claims) {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 600 }))}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

/** One RPC, sent the way the API's Data API services send it, and never waited on forever. */
async function rpc(token, name, body) {
  let response;
  try {
    response = await fetch(`${postgrestUrl}/rpc/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      throw new Error(`${name} was not answered within ${RPC_TIMEOUT_MS} ms on PostgREST ${version}: its transaction is being re-run (the 40001 hazard)`);
    }
    throw error;
  }
  const text = await response.text();
  return { status: response.status, body: text.length > 0 ? JSON.parse(text) : null };
}

/** The exact non-retryable stale-state answer: HTTP 409, PT409, the frozen message and DETAIL, no HINT. */
function assertStale(answer, message, details = null) {
  assert.equal(answer.status, 409, `HTTP 409 for ${message} (got ${answer.status} ${JSON.stringify(answer.body)})`);
  assert.equal(answer.body.code, 'PT409', 'the body carries the SQLSTATE the API recognises');
  assert.equal(answer.body.message, message, 'the frozen message, byte for byte');
  assert.equal(answer.body.details ?? null, details, 'the frozen DETAIL');
  assert.equal(answer.body.hint ?? null, null, 'no HINT');
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function drawSharedId() {
  let out = '';
  for (let i = 0; i < 12; i += 1) { out += ALPHABET[randomInt(32)]; if (i === 3 || i === 7) out += '-'; }
  return out;
}
const bytea = (buffer) => `\\x${buffer.toString('hex')}`;

const PROBE_SEQUENCE = 'public.prod_retry_01_wire_attempts';
const PROBES = {
  PT409: 'prod_retry_01_wire_probe_pt409_v1',
  '40001': 'prod_retry_01_wire_probe_40001_v1',
};
const attempts = async () => Number((await client.query(`SELECT last_value + (CASE WHEN is_called THEN 0 ELSE -1 END) AS n FROM ${PROBE_SEQUENCE}`)).rows[0].n);

/** Creates the two probes and waits until PostgREST's schema cache serves them. */
async function createProbes(token) {
  await client.query(`CREATE SEQUENCE ${PROBE_SEQUENCE}`);
  for (const [code, name] of Object.entries(PROBES)) {
    await client.query(`CREATE FUNCTION public.${name}() RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  PERFORM nextval('${PROBE_SEQUENCE}');
  RAISE EXCEPTION 'PROD_RETRY_01_WIRE_PROBE' USING ERRCODE = '${code}';
END$$`);
    await client.query(`REVOKE ALL ON FUNCTION public.${name}() FROM PUBLIC`);
    await client.query(`GRANT EXECUTE ON FUNCTION public.${name}() TO authenticated`);
  }
  await client.query(`GRANT USAGE ON SEQUENCE ${PROBE_SEQUENCE} TO authenticated`);
  await client.query("NOTIFY pgrst, 'reload schema'");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const answer = await rpc(token, PROBES.PT409, {});
    if (answer.status !== 404) {
      await client.query(`SELECT setval('${PROBE_SEQUENCE}', 1, false)`);
      return;
    }
    await new Promise((resolve) => { setTimeout(resolve, 500); });
  }
  throw new Error('PostgREST never loaded the probes into its schema cache');
}
async function dropProbes() {
  for (const name of Object.values(PROBES)) await client.query(`DROP FUNCTION IF EXISTS public.${name}()`);
  await client.query(`DROP SEQUENCE IF EXISTS ${PROBE_SEQUENCE}`);
  await client.query("NOTIFY pgrst, 'reload schema'");
}

async function main() {
  await client.connect();
  const hypothesisOwner = randomUUID();
  const matchingHuman = randomUUID();
  const sharedHuman = randomUUID();
  const humans = [hypothesisOwner, matchingHuman, sharedHuman];
  const session = randomUUID();
  const hypothesis = randomUUID();
  try {
    stage = 'fixtures';
    await client.query('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [humans]);
    await client.query(`INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,status,assumptions)
      VALUES($1,$2,'prod-retry-01 wire probe','CAUSAL','GENERAL',$3,'HUMAN_REVIEWED','ACTIVE','{}')`, [hypothesis, hypothesisOwner, `CONVERSATION_SESSION:${session}`]);
    // The Shared human's current credential, as the owner with the human's claims (a FIRST Shared ID is launch-gated).
    await client.query('BEGIN');
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: sharedHuman })]);
    const first = drawSharedId();
    await client.query('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, NULL)',
      [randomUUID(), `sid1:${createHash('sha256').update(first, 'utf8').digest('hex')}`]);
    await client.query('COMMIT');
    const userToken = (sub) => jwt({ sub, role: 'authenticated' });
    const serverToken = jwt({ role: 'service_role' });
    const before = (await client.query(`SELECT
        (SELECT to_jsonb(h) FROM public.hypotheses h WHERE h.id = $1) AS hypothesis,
        (SELECT count(*) FROM public.hypothesis_lifecycle_transitions WHERE hypothesis_id = $1)::int AS transitions,
        (SELECT count(*) FROM public.hypothesis_updates WHERE hypothesis_id = $1)::int AS updates,
        (SELECT count(*) FROM public.matching_setup_locks WHERE user_id = $2)::int AS locks,
        (SELECT jsonb_agg(to_jsonb(s)) FROM public.shared_world_invite_credential_state s WHERE s.user_id = $3) AS credential,
        (SELECT count(*) FROM public.shared_world_invitation_commands WHERE actor_user_id = $3)::int AS commands`,
    [hypothesis, matchingHuman, sharedHuman])).rows[0];

    stage = 'attempts: PT409 is answered after exactly one execution';
    await createProbes(userToken(hypothesisOwner));
    const pt409 = await rpc(userToken(hypothesisOwner), PROBES.PT409, {});
    assert.equal(pt409.status, 409, `PT409 becomes HTTP 409 (got ${pt409.status} ${JSON.stringify(pt409.body)})`);
    assert.equal(pt409.body.code, 'PT409');
    assert.equal(await attempts(), 1, 'PostgREST executed the PT409 request exactly once');
    if (RETRIES_40001) {
      console.log(`  ${version}: a 40001 probe is not sent - this line re-runs it without bound (PostgREST #3673)`);
    } else {
      stage = 'attempts: on v16+ a 40001 is HTTP 500 after exactly one execution';
      const legacy = await rpc(userToken(hypothesisOwner), PROBES['40001'], {});
      assert.equal(legacy.status, 500, `40001 becomes HTTP 500 on ${version} (got ${legacy.status} ${JSON.stringify(legacy.body)})`);
      assert.equal(legacy.body.code, '40001');
      assert.equal(await attempts(), 2, 'PostgREST executed the 40001 request exactly once');
    }

    stage = 'Hypothesis, as the owner and as the server';
    assertStale(await rpc(userToken(hypothesisOwner), 'transition_hypothesis_v2',
      { p_hypothesis_id: hypothesis, p_expected_version: 2, p_status: 'SUPPORTED' }), 'Stale hypothesis version.');
    assertStale(await rpc(userToken(hypothesisOwner), 'apply_hypothesis_evidence_update',
      { p_update_id: randomUUID(), p_hypothesis_id: hypothesis, p_expected_version: 2, p_evidence_id: `memory:${randomUUID()}`, p_evidence_role: 'SUPPORTING' }),
    'Stale hypothesis version.');
    assertStale(await rpc(serverToken, 'background_apply_hypothesis_evidence_update_v1',
      { p_user_id: hypothesisOwner, p_session_id: session, p_update_id: randomUUID(), p_hypothesis_id: hypothesis, p_expected_version: 2,
        p_evidence_id: `memory:${randomUUID()}`, p_evidence_role: 'SUPPORTING' }), 'Stale hypothesis version.');

    stage = 'the Thread identity dossier page, as the server';
    assertStale(await rpc(serverToken, 'get_conversation_thread_identity_dossier_page_v1',
      { p_user_id: randomUUID(), p_expected_world_thread_identity_version: 1, p_after_thread_id: null, p_limit: 8 }),
    'STALE_THREAD_IDENTITY_CONTEXT', STALE_DETAIL);

    stage = 'the two retained Matching reducers, as a human with no Matching state';
    for (const name of ['pause_matching_participation_v1', 'turn_off_matching_participation_v1']) {
      assertStale(await rpc(userToken(matchingHuman), name, { p_command_id: randomUUID(), p_expected_current_event_id: randomUUID() }), 'MATCHING_STALE_STATE');
    }

    stage = 'the sealed Shared ID rotation, from a stale epoch';
    const stale = await rpc(userToken(sharedHuman), 'rotate_own_sealed_shared_id_v1', {
      p_command_id: randomUUID(), p_expected_epoch: 7, p_shared_id: drawSharedId(), p_key_version: 1,
      p_nonce: bytea(randomBytes(12)), p_ciphertext: bytea(randomBytes(14)), p_auth_tag: bytea(randomBytes(16)),
    });
    assertStale(stale, 'SHARED_INVITE_CREDENTIAL_STALE_STATE');
    assert.doesNotMatch(JSON.stringify(stale.body), /sid1:|[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/u, 'no credential reference or Shared ID is disclosed');

    stage = 'nothing was written';
    const after = (await client.query(`SELECT
        (SELECT to_jsonb(h) FROM public.hypotheses h WHERE h.id = $1) AS hypothesis,
        (SELECT count(*) FROM public.hypothesis_lifecycle_transitions WHERE hypothesis_id = $1)::int AS transitions,
        (SELECT count(*) FROM public.hypothesis_updates WHERE hypothesis_id = $1)::int AS updates,
        (SELECT count(*) FROM public.matching_setup_locks WHERE user_id = $2)::int AS locks,
        (SELECT jsonb_agg(to_jsonb(s)) FROM public.shared_world_invite_credential_state s WHERE s.user_id = $3) AS credential,
        (SELECT count(*) FROM public.shared_world_invitation_commands WHERE actor_user_id = $3)::int AS commands`,
    [hypothesis, matchingHuman, sharedHuman])).rows[0];
    assert.deepEqual(after, before, 'no stale request committed anything, not even the Matching lock row');
    console.log(`PostgREST ${version}: every deterministic stale-state refusal is answered at once - HTTP 409 {code PT409}, the frozen message and DETAIL, nothing written; PT409 runs exactly once${RETRIES_40001 ? '' : '; 40001 is HTTP 500 after one execution'}.`);
  } finally {
    stage = 'cleanup';
    await client.query('ROLLBACK').catch(() => undefined);
    await dropProbes().catch((error) => console.error(`probe cleanup: ${error.message}`));
    // ONE teardown transaction. The hypothesis is canonical history (0072 / 0130 refuse its DELETE for every role), so
    // the guards stand aside for this transaction only, exactly as the Replay verifier support removes its fixture.
    await client.query('BEGIN');
    try {
      await client.query("SET LOCAL session_replication_role = 'replica'");
      await client.query('DELETE FROM public.historical_reading_events WHERE user_id = ANY($1::uuid[])', [humans]);
      await client.query('DELETE FROM public.hypothesis_updates WHERE user_id = ANY($1::uuid[])', [humans]);
      await client.query('DELETE FROM public.hypothesis_lifecycle_transitions WHERE user_id = ANY($1::uuid[])', [humans]);
      await client.query('DELETE FROM public.hypotheses WHERE user_id = ANY($1::uuid[])', [humans]);
      await client.query('DELETE FROM public.historical_world_semantic_clocks WHERE user_id = ANY($1::uuid[])', [humans]);
      await client.query('DELETE FROM public.matching_setup_locks WHERE user_id = ANY($1::uuid[])', [humans]);
      await client.query('DELETE FROM public.shared_world_invitation_commands WHERE actor_user_id = ANY($1::uuid[])', [humans]);
      await client.query('DELETE FROM shared_private.shared_id_sealed_values WHERE user_id = ANY($1::uuid[])', [humans]);
      await client.query('DELETE FROM public.shared_world_invite_credential_state WHERE user_id = ANY($1::uuid[])', [humans]);
      await client.query("SET LOCAL session_replication_role = 'origin'");
      await client.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
      await client.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [humans]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw new Error(`fixture teardown failed: ${error.message}`);
    }
    const [{ residue }] = (await client.query(`SELECT (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM public.hypotheses WHERE user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM pg_proc WHERE proname LIKE 'prod\\_retry\\_01\\_wire%') AS residue`, [humans])).rows;
    assert.equal(Number(residue), 0, 'every fixture and probe was removed');
  }
}

try {
  await main();
} catch (error) {
  console.error(`PROD-RETRY-01 wire proof failed on PostgREST ${version} at ${stage}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
