// SEC-MATCH-00 - live wire proof of the migration 0149 narrowing THROUGH a real PostgREST server.
//
// verify-migration-0149.mjs proves the effective privileges under SET ROLE. A client never issues SET ROLE: it sends a
// token to PostgREST, which switches to the token's role and calls the function. This proof closes that gap against the
// real engine Supabase runs, across the PostgREST lines CI starts it with (`POSTGREST_VERSION`):
//
//   * each of the six suspended boundaries, called the way a client would (POST /rpc/<name>, JSON arguments whose names
//     are checked against the live catalog), is refused for an authenticated, an anon and a service-role token - HTTP
//     401 / 403 with code 42501, or 404 PGRST202 if the engine hides a function the role cannot execute - and commits
//     nothing: a fresh account that tried every boundary still has no Matching row at all;
//   * an account that already has Matching state still pauses, revokes its Matching Context Grant, revokes its Pre-Match
//     Disclosure Authority, turns participation off and inspects its own setup under its own token; another account's
//     token moves none of it; and a replay of its own pre-0149 activation is refused;
//   * anon and service-role tokens reach none of the five retained operations either.
//
// It needs DATABASE_URL (the fixture owner), POSTGREST_URL and POSTGREST_JWT_SECRET (a CI-only signing secret for the
// throwaway PostgREST container; never a deployment credential).
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import process from 'node:process';
import { createMatchingRuntime, MATCHING_TABLES, SEC_MATCH_00_SUSPENDED, SEC_MATCH_00_RETAINED } from './matching-setup-verifier-support.mjs';

const databaseUrl = process.env.DATABASE_URL;
const postgrestUrl = (process.env.POSTGREST_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const version = process.env.POSTGREST_VERSION ?? 'unspecified';
if (!databaseUrl || !secret) throw new Error('DATABASE_URL and POSTGREST_JWT_SECRET are required.');

const rt = createMatchingRuntime(databaseUrl);
let stage = 'connect';

const base64url = (value) => Buffer.from(value).toString('base64url');
function jwt(claims) {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 600 }))}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

/** One RPC, sent the way the Supabase client libraries send it. */
async function rpc(token, name, body) {
  const response = await fetch(`${postgrestUrl}/rpc/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text.length > 0 ? JSON.parse(text) : null };
}

const nameOf = (signature) => signature.slice('public.'.length, signature.indexOf('('));

/** Type-valid arguments for every boundary; `s` is the caller's existing setup, when there is one. */
const ARGUMENTS = {
  activate_matching_participation_v1: (s) => ({ p_command_id: s?.activation ?? randomUUID(), p_entry_channel: 'MANUAL_MY_WORLD_ENTRY', p_expected_current_event_id: null }),
  resume_matching_participation_v1: (s) => ({ p_command_id: randomUUID(), p_expected_current_event_id: s?.act ?? randomUUID() }),
  grant_matching_context_v1: (s) => ({ p_command_id: randomUUID(), p_new_grant_id: randomUUID(), p_expected_active_grant_id: s?.grant ?? null }),
  set_introduction_profile_v1: (s) => ({ p_command_id: randomUUID(), p_field_keys: ['life_stage'], p_field_values: ['settled and ready'], p_expected_current_version_id: s?.profile ?? null }),
  set_matching_requirements_v1: (s) => ({ p_command_id: randomUUID(), p_requirement_keys: ['faith_practice_level'], p_requirement_strengths: ['HARD_DEALBREAKER'], p_requirement_values: ['practising'], p_expected_current_version_id: s?.requirements ?? null }),
  grant_pre_match_disclosure_authority_v1: (s) => ({ p_command_id: randomUUID(), p_new_authority_id: randomUUID(), p_profile_version_id: s?.profile ?? randomUUID(), p_approved_field_keys: ['life_stage'], p_expected_active_authority_id: s?.authority ?? null }),
  pause_matching_participation_v1: (s) => ({ p_command_id: randomUUID(), p_expected_current_event_id: s?.act ?? randomUUID() }),
  turn_off_matching_participation_v1: (s) => ({ p_command_id: randomUUID(), p_expected_current_event_id: s?.act ?? randomUUID() }),
  revoke_matching_context_v1: (s) => ({ p_command_id: randomUUID(), p_expected_active_grant_id: s?.grant ?? randomUUID() }),
  revoke_pre_match_disclosure_authority_v1: (s) => ({ p_command_id: randomUUID(), p_expected_active_authority_id: s?.authority ?? randomUUID() }),
  get_my_matching_setup_v1: () => ({}),
};

/** Not callable on the wire: refused for privilege, or not exposed to that role at all. Returns which. */
function assertNotCallable(response, label) {
  const refused = [401, 403].includes(response.status) && response.body?.code === '42501';
  const hidden = response.status === 404 && response.body?.code === 'PGRST202';
  assert.ok(refused || hidden, `${label} is not callable (got ${response.status} ${JSON.stringify(response.body)})`);
  return refused ? '42501' : 'PGRST202';
}

async function matchingRows(human) {
  let total = 0;
  for (const table of MATCHING_TABLES) {
    const column = (await rt.rows(
      `SELECT a.attname FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attname IN
         ('user_id','participant_user_id','grantor_user_id','owner_user_id') AND NOT a.attisdropped`, [table]))[0]?.attname;
    if (column) total += await rt.count(table, `${column} = $1`, [human]);
  }
  return total;
}

/** Every committed Matching row of the fixture humans, then the humans themselves. */
async function removeFixtures(humans) {
  await rt.removeCommittedMatchingSetup(humans);
  await rt.removeFixtureHumans(humans);
}

async function main() {
  await rt.client.connect();
  const [fresh, existing, other] = [randomUUID(), randomUUID(), randomUUID()];
  const humans = [fresh, existing, other];
  const outcomes = new Set();
  try {
    stage = 'the request shapes are the live signatures';
    for (const fn of [...SEC_MATCH_00_SUSPENDED, ...SEC_MATCH_00_RETAINED]) {
      assert.deepEqual(Object.keys(ARGUMENTS[nameOf(fn)]()).sort(), (await rt.inputParameters(fn)).sort(),
        `the ${nameOf(fn)} request names exactly its live parameters`);
    }

    stage = 'fixtures';
    await rt.provisionHumans(humans);
    // State the existing account committed BEFORE 0149: reached as the owner with that human's own claims.
    await rt.actAs(existing);
    const activation = randomUUID();
    const [active] = await rt.activate(activation, 'MANUAL_MY_WORLD_ENTRY');
    const grant = randomUUID();
    await rt.grantContext(randomUUID(), grant);
    const [profile] = await rt.setProfile(randomUUID(), [['life_stage', 'settled and ready']]);
    const [requirements] = await rt.setRequirements(randomUUID(), [['faith_practice_level', 'HARD_DEALBREAKER', 'practising']]);
    const authority = randomUUID();
    await rt.grantDisclosure(randomUUID(), authority, profile.introduction_profile_version_id, ['life_stage']);
    await rt.asRole('postgres');
    const setup = { activation, act: active.participation_event_id, grant, authority,
      profile: profile.introduction_profile_version_id, requirements: requirements.matching_requirement_version_id };
    const tokens = {
      fresh: jwt({ sub: fresh, role: 'authenticated' }),
      existing: jwt({ sub: existing, role: 'authenticated' }),
      other: jwt({ sub: other, role: 'authenticated' }),
      anon: jwt({ role: 'anon' }),
      server: jwt({ role: 'service_role' }),
    };

    stage = 'the six are refused for every token, fresh account and existing account alike';
    for (const fn of SEC_MATCH_00_SUSPENDED.map(nameOf)) {
      for (const [who, token, state] of [['fresh', tokens.fresh, null], ['existing', tokens.existing, setup],
        ['anon', tokens.anon, null], ['service_role', tokens.server, null]]) {
        outcomes.add(assertNotCallable(await rpc(token, fn, ARGUMENTS[fn](state)), `${fn} for ${who}`));
      }
    }

    stage = 'a fresh account that tried every boundary has no Matching footprint';
    for (const fn of SEC_MATCH_00_RETAINED.map(nameOf)) {
      const answer = await rpc(tokens.fresh, fn, ARGUMENTS[fn](null));
      if (fn === 'get_my_matching_setup_v1') {
        assert.equal(answer.status, 200, `self-inspection answers a fresh account (${answer.status} ${JSON.stringify(answer.body)})`);
        assert.equal(answer.body[0].participation_state, 'OFF');
      } else {
        assert.ok(answer.status >= 400, `${fn} commits nothing for a fresh account (${answer.status})`);
        assert.ok(['40001', 'P0002'].includes(answer.body?.code), `${fn} is refused by its own bounded rule, not by privilege (${JSON.stringify(answer.body)})`);
      }
    }
    assert.equal(await matchingRows(fresh), 0, 'the fresh account has no Matching row at all');

    stage = 'another account moves nothing of the existing one';
    const intrusion = await rpc(tokens.other, 'revoke_matching_context_v1', ARGUMENTS.revoke_matching_context_v1(setup));
    assert.ok(intrusion.status >= 400 && intrusion.body?.code === 'P0002', `another token cannot revoke the grant (${JSON.stringify(intrusion.body)})`);
    assert.equal((await rt.rows('SELECT status FROM public.matching_context_grants WHERE id = $1', [grant]))[0].status, 'ACTIVE');

    stage = 'the existing account keeps its five operations under its own token';
    const before = await rpc(tokens.existing, 'get_my_matching_setup_v1', {});
    assert.equal(before.status, 200);
    assert.deepEqual([before.body[0].participation_state, before.body[0].matching_context_grant_id, before.body[0].pre_match_disclosure_authority_id],
      ['ACTIVE', grant, authority], 'the owner inspects their own setup');
    const revokedGrant = await rpc(tokens.existing, 'revoke_matching_context_v1', ARGUMENTS.revoke_matching_context_v1(setup));
    assert.equal(revokedGrant.status, 200, JSON.stringify(revokedGrant.body));
    assert.equal(revokedGrant.body[0].grant_status, 'REVOKED');
    const paused = await rpc(tokens.existing, 'pause_matching_participation_v1', ARGUMENTS.pause_matching_participation_v1(setup));
    assert.equal(paused.status, 200, JSON.stringify(paused.body));
    assert.equal(paused.body[0].participation_state, 'PAUSED');
    const revokedAuthority = await rpc(tokens.existing, 'revoke_pre_match_disclosure_authority_v1', ARGUMENTS.revoke_pre_match_disclosure_authority_v1(setup));
    assert.equal(revokedAuthority.status, 200, JSON.stringify(revokedAuthority.body));
    assert.equal(revokedAuthority.body[0].authority_event_type, 'REVOKED');
    const off = await rpc(tokens.existing, 'turn_off_matching_participation_v1',
      ARGUMENTS.turn_off_matching_participation_v1({ act: paused.body[0].participation_event_id }));
    assert.equal(off.status, 200, JSON.stringify(off.body));
    assert.equal(off.body[0].participation_state, 'OFF');
    const after = await rpc(tokens.existing, 'get_my_matching_setup_v1', {});
    assert.deepEqual([after.body[0].participation_state, after.body[0].matching_context_grant_id, after.body[0].pre_match_disclosure_authority_id],
      ['OFF', null, null], 'self-inspection reflects every withdrawal');
    outcomes.add(assertNotCallable(await rpc(tokens.existing, 'activate_matching_participation_v1', ARGUMENTS.activate_matching_participation_v1(setup)),
      'a replay of the pre-0149 activation'));

    stage = 'no anon or service-role token reaches the five';
    for (const fn of SEC_MATCH_00_RETAINED.map(nameOf)) {
      for (const [who, token] of [['anon', tokens.anon], ['service_role', tokens.server]]) {
        outcomes.add(assertNotCallable(await rpc(token, fn, ARGUMENTS[fn](setup)), `${fn} for ${who}`));
      }
    }

    console.log(`Verified SEC-MATCH-00 through live PostgREST ${version}: the six suspended Matching setup commands are not callable by an authenticated, anon or service-role token (${[...outcomes].sort().join(' / ')}), a fresh account that tried all eleven has no Matching row, and an existing account still inspects its setup, revokes both authorities, pauses and turns participation off under its own token while another token moves nothing.`);
  } finally {
    stage = 'fixture removal';
    await removeFixtures(humans).finally(() => rt.client.end());
  }
}

try {
  await main();
} catch (error) {
  console.error(`SEC-MATCH-00 PostgREST ${version} wire proof failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
}
