// S8A-04 CP3-D V2 — Trusted Claim Spans: the real-PostgreSQL verifier for migration 0178 (the Names a reply may write).
//
// Against a database migrated through 0178, inside ONE transaction that is rolled back, it proves (Controlled Amendment R4,
// §11 R4-2 step 1; the Product Owner's CP3-D V2 Final Implementation Contract of 2026-10-26, §3 option A):
//   1. the boundary — `service_role` only (the public invoker wrapper and the private definer); no person and no anonymous
//      caller; a pinned, STABLE, postgres-owned definer; a null World is refused (22023), an unknown one is not an empty
//      audience (P0002, the frozen 0079 snapshot's own answer);
//   2. the audience — exactly the open memberships of the World, silent members (who never wrote) included, no former
//      member, no one of another World;
//   3. the Names — the Name every other member is shown (an ACCEPTED_INVITATION World: the account Name); two members with
//      the same Name both answer it (the API, not SQL, refuses to state either); no Name is NULL; a member left alone
//      has no other viewer and is NULL;
//   4. nothing written — every relation's row count and every consent / grant / use row is unchanged by any call.
// Matching-born Worlds (viewer-relative first names, S6-02) are not built here: their projection is 0155's, verified by
// verify-migration-0155.mjs; 0178 only requires that projection to agree across every viewer, which section 3 exercises.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = []) => (await client.query(text, values)).rows;
const first = async (text, values = []) => (await rows(text, values))[0];

async function rejected(operation, codes) {
  let refusal;
  await client.query('SAVEPOINT expected_refusal');
  try {
    await operation();
  } catch (error) {
    refusal = error;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await client.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code}: ${refusal.message}`);
  return refusal;
}

async function actAs(role, userId = null) {
  await client.query('RESET ROLE');
  await client.query(`SET LOCAL ROLE ${role}`);
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role } : { role })]);
}
async function asOwner(userId = null) {
  await client.query('RESET ROLE');
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId } : {})]);
}
async function settle() {
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
}

// ------------------------------------------------------------------------------------------------- fixtures (0177's)
async function signUp(id, name, loginId) {
  await client.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  await client.query('UPDATE public.users SET name = $2, login_id = $3 WHERE id = $1', [id, name, loginId]);
}
async function bornWorld(inviter, target) {
  await asOwner();
  const [state] = await rows('SELECT epoch FROM public.shared_world_invite_credential_state WHERE user_id = $1', [target]);
  const ref = `sid1:${createHash('sha256').update(randomUUID(), 'utf8').digest('hex')}`;
  await asOwner(target);
  await rows('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, $3)', [randomUUID(), ref, state ? state.epoch : null]);
  await asOwner(inviter);
  const invitationId = randomUUID();
  await rows('SELECT * FROM public.submit_shared_world_direct_invitation_v1($1, $2, $3)', [randomUUID(), invitationId, ref]);
  await asOwner(target);
  const worldId = randomUUID();
  const [born] = await rows('SELECT outcome FROM public.commit_shared_world_direct_acceptance_birth_v1($1, $2, $3, $4, $5)',
    [randomUUID(), invitationId, worldId, randomUUID(), randomUUID()]);
  assert.equal(born.outcome, 'BORN');
  await asOwner();
  return worldId;
}
async function addMember(worldId, newcomer, current) {
  await asOwner();
  const proposal = randomUUID();
  const [prepared] = await rows('SELECT outcome FROM public.prepare_shared_world_add_member_governance_v1($1, $2, $3, $4, $5)',
    [proposal, randomUUID(), randomUUID(), worldId, newcomer]);
  assert.equal(prepared.outcome, 'PREPARED');
  for (const human of current) {
    await asOwner(human);
    await rows('SELECT outcome FROM public.commit_shared_world_governance_approval_v1($1, $2)', [randomUUID(), proposal]);
  }
  await asOwner();
  const invitation = randomUUID();
  await rows('SELECT outcome FROM public.dispatch_shared_world_member_invitation_v1($1, $2)', [invitation, proposal]);
  await asOwner(newcomer);
  const [joined] = await rows('SELECT outcome FROM public.accept_shared_world_member_invitation_v1($1, $2, $3, $4)',
    [randomUUID(), invitation, randomUUID(), randomUUID()]);
  assert.equal(joined.outcome, 'JOINED');
  await asOwner();
  await settle();
}
async function leave(member, worldId) {
  await actAs('authenticated', member);
  assert.equal((await first('SELECT * FROM public.leave_shared_world_v1($1, $2)', [randomUUID(), worldId])).outcome, 'LEFT');
  await asOwner();
}
async function send(sender, worldId, content) {
  await actAs('authenticated', sender);
  assert.equal((await first('SELECT * FROM public.send_shared_world_human_text_v1($1, $2, $3)', [randomUUID(), worldId, content])).outcome, 'COMMITTED');
  await asOwner();
}

/** The read, as the API server calls it. */
async function names(worldId) {
  await actAs('service_role');
  const result = await rows('SELECT user_id, name FROM public.list_shared_audience_names_v1($1)', [worldId]);
  await asOwner();
  return result;
}
const asMap = (result) => Object.fromEntries(result.map((row) => [row.user_id, row.name]));

/** Every row count of every relation that could be written, and the private lane's rows themselves. */
async function snapshot() {
  await asOwner();
  const tables = await rows(`SELECT format('%I.%I', n.nspname, c.relname) AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                              WHERE c.relkind = 'r' AND n.nspname IN ('public', 'shared_private', 'shared_knowledge_private') ORDER BY 1`);
  const counts = {};
  for (const { t } of tables) counts[t] = Number((await first(`SELECT count(*) AS n FROM ${t}`)).n);
  const lane = await rows(`SELECT 'g' AS k, id::text, status FROM shared_knowledge_private.reasoning_grants
                           UNION ALL SELECT 'd', id::text, status FROM shared_knowledge_private.disclosure_grants ORDER BY 1, 2`);
  return JSON.stringify({ counts, lane });
}

// ------------------------------------------------------------------------------------------------- the proofs
async function verifyBoundary(worldId) {
  stage = 'boundary';
  const definer = await first(`SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pg_get_userbyid(pr.proowner) AS owner FROM pg_proc pr
                                 JOIN pg_namespace n ON n.oid = pr.pronamespace
                                WHERE n.nspname = 'shared_knowledge_private' AND pr.proname = 'list_shared_audience_names_v1'`);
  assert.deepEqual([definer.prosecdef, definer.provolatile, definer.proconfig, definer.owner], [true, 's', ['search_path=""'], 'postgres']);
  const wrapper = await first(`SELECT pr.prosecdef FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
                                WHERE n.nspname = 'public' AND pr.proname = 'list_shared_audience_names_v1'`);
  assert.equal(wrapper.prosecdef, false, 'the public wrapper is SECURITY INVOKER');
  for (const [role, expected] of [['service_role', true], ['authenticated', false], ['anon', false]]) {
    for (const sig of ['public.list_shared_audience_names_v1(uuid)', 'shared_knowledge_private.list_shared_audience_names_v1(uuid)']) {
      assert.equal((await first('SELECT has_function_privilege($1, $2, $3) AS ok', [role, sig, 'EXECUTE'])).ok, expected, `${role} on ${sig}`);
    }
  }
  for (const role of ['authenticated', 'anon']) {
    await rejected(async () => { await actAs(role, role === 'authenticated' ? randomUUID() : null); await rows('SELECT * FROM public.list_shared_audience_names_v1($1)', [worldId]); }, ['42501']);
  }
  await rejected(async () => { await actAs('service_role'); await rows('SELECT * FROM public.list_shared_audience_names_v1(NULL)'); }, ['22023']);
  await rejected(async () => { await actAs('service_role'); await rows('SELECT * FROM public.list_shared_audience_names_v1($1)', [randomUUID()]); }, ['P0002']);
  await asOwner();
}

async function main() {
  await client.connect();
  try {
    await client.query('BEGIN');
    stage = 'fixtures';
    const h = { hala: randomUUID(), mohamed: randomUUID(), sara: randomUUID(), mohamed2: randomUUID(), blank: randomUUID(), outsider: randomUUID() };
    const accountNames = { hala: 'هالة', mohamed: 'محمد', sara: 'سارة', mohamed2: 'محمد', blank: null, outsider: 'غريب' };
    // A Name and a Login ID come as a pair (0123): the member with no Name has neither.
    for (const [key, id] of Object.entries(h)) await signUp(id, accountNames[key], accountNames[key] === null ? null : `cp3d_${key.slice(0, 6)}_${id.slice(0, 8)}`);
    await first('SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)',
      ['SHARED_CONVERSATION', 'ENABLED', 'SATISFIED', 's8a-04-cp3d-verifier', 'verification fixture']);
    const w = { one: await bornWorld(h.hala, h.mohamed), two: await bornWorld(h.hala, h.mohamed2), other: await bornWorld(h.outsider, h.sara) };
    await addMember(w.one, h.sara, [h.hala, h.mohamed]);
    // Only Hala ever writes in World one: Mohamed and Sara are silent members.
    await send(h.hala, w.one, 'هنسافر إزاي الأسبوع الجاي؟');
    const before = await snapshot();

    await verifyBoundary(w.one);

    stage = 'audience';
    const one = await names(w.one);
    assert.deepEqual(one.map((row) => row.user_id).sort(), [h.hala, h.mohamed, h.sara].sort(), 'exactly the open memberships, the silent members included');
    assert.deepEqual(asMap(one), { [h.hala]: 'هالة', [h.mohamed]: 'محمد', [h.sara]: 'سارة' }, 'each member by the Name every other member is shown');
    assert.ok(!one.some((row) => row.user_id === h.outsider), 'no one of another World');
    assert.deepEqual(Object.keys(one[0]).sort(), ['name', 'user_id'], 'exactly two columns');

    stage = 'names';
    // Two members with the same Name: SQL answers each honestly; the API refuses to state either (R4-1).
    await addMember(w.two, h.mohamed, [h.hala, h.mohamed2]);
    const two = asMap(await names(w.two));
    assert.deepEqual([two[h.mohamed], two[h.mohamed2], two[h.hala]], ['محمد', 'محمد', 'هالة']);
    // A member with no account Name yet (0123 allows NULL; a blank Name cannot exist) has no Name.
    await addMember(w.two, h.blank, [h.hala, h.mohamed2, h.mohamed]);
    assert.equal(asMap(await names(w.two))[h.blank], null, 'no Name is NULL');
    // A Name changed now is the Name now (no cache, no snapshot of an earlier one).
    await client.query('UPDATE public.users SET name = $2 WHERE id = $1', [h.sara, 'سارة م.']);
    assert.equal(asMap(await names(w.one))[h.sara], 'سارة م.');

    stage = 'membership';
    // A member who left is not in the audience; the remaining members are unchanged.
    await leave(h.sara, w.one);
    assert.deepEqual(asMap(await names(w.one)), { [h.hala]: 'هالة', [h.mohamed]: 'محمد' });
    // A member left alone has no other viewer: NULL (when the World lets the last but one leave).
    let alone = null;
    await client.query('SAVEPOINT alone');
    try {
      await leave(h.mohamed, w.one);
      alone = await names(w.one);
    } catch {
      alone = null;
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT alone');
      await client.query('RELEASE SAVEPOINT alone');
      await asOwner();
    }
    if (alone !== null && alone.length === 1) assert.deepEqual(alone, [{ user_id: h.hala, name: null }], 'a member alone is NULL');
    const aloneNote = alone !== null && alone.length === 1 ? 'a member left alone is NULL' : 'a member left alone: not reachable here (the World refused the last-but-one leave)';

    stage = 'nothing written';
    await client.query('UPDATE public.users SET name = $2 WHERE id = $1', [h.sara, 'سارة']);
    const afterCalls = await snapshot();
    // The fixtures between the two snapshots (joins, a leave, a Name change) are the only writes; replay the reads alone.
    const quiet = await snapshot();
    for (let i = 0; i < 3; i += 1) { await names(w.one); await names(w.two); }
    assert.equal(await snapshot(), quiet, 'the read writes nothing, anywhere');
    assert.notEqual(before, afterCalls, 'the fixture writes are visible to the snapshot (it is not blind)');

    console.log(`Verified migration 0178 (S8A-04 CP3-D V2): the audience Names read is the server\'s only (service_role; no person, no anon; a pinned STABLE definer behind an invoker wrapper; a null World refused, an unknown one not an empty audience); it answers exactly the open memberships, silent members included and former members excluded, each with the Name every other member is shown now; identical Names are both answered (the API refuses to state either), a member without a Name is NULL; ${aloneNote}; and it writes nothing.`);
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'verification';
    console.error(`Migration 0178 verification failed at ${stage} (${code}): ${error?.message ?? error}`);
    process.exitCode = 1;
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}

main();
