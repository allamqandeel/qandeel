// S4-04 — Shared Activity, Notifications & Direct Entry v1: the real-PostgreSQL verifier for migration 0141.
//
// It proves, against a fully migrated database:
//   1. the boundary: the server pass is a pinned `public` SECURITY DEFINER executable by `service_role` only; the two
//      human commands are pinned `shared_private` definers behind SECURITY INVOKER wrappers executable by
//      `authenticated` only; the internal World-name helper is nobody's; the server channel still reaches exactly the
//      three S4-02 reply-work commands in `shared_private`; no `commit_%` name joins the T-03D census; no table is added;
//   2. HUMAN_TEXT: a committed human message tells exactly the CURRENT members of its own World who can see it, never its
//      author, never a member of another World; a deleted message tells nobody;
//   3. PROPOSAL (by the proposer's command id): exactly the people the proposal waits on — never the proposer, never the
//      removal target — with the proposer's Name and the target's Name for a removal only; a committed proposal tells
//      nobody; a well-formed add request that opened nothing tells nobody;
//   4. MEMBER_REQUEST: nothing before every member approved; then the target alone, with the proposer's Name and nothing
//      of the World; nothing once accepted;
//   5. JOINED / BIRTH / LEFT: the other current members only (BIRTH: the inviter); the actor is never told;
//   6. the per-World alerts: the reader's CURRENT Worlds only, each with its own mute; muting World A mutes no other World
//      and no other reader; unmuting restores; a former member, a stranger and an unknown World get one UNAVAILABLE;
//      muting changes no membership and no material; the row is the ONE A3-01 mute table's own;
//   7. refusals: an unknown source kind is 22023; a client cannot run the server pass.
//
// Everything runs inside one transaction that is rolled back.
import assert from 'node:assert/strict';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = []) => (await client.query(text, values)).rows;
const first = async (text, values = []) => (await rows(text, values))[0];

/** Expect `operation` to be refused with one of `codes`. Must run inside an open transaction. */
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

// --- the S4-01 … S4-03 commands S4-04 composes with ------------------------------------------------------------------
const setGate = async (scope, flag, requirements) =>
  first('SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)', [scope, flag, requirements, 's4-04-verifier', 'verification fixture']);
const send = async (commandId, worldId, content) => first('SELECT * FROM public.send_shared_world_human_text_v1($1::uuid, $2::uuid, $3::text)', [commandId, worldId, content]);
const deleteOwn = async (commandId, worldId, materialId) =>
  (await first('SELECT * FROM public.delete_own_shared_world_material_v1($1::uuid, $2::uuid, $3::uuid)', [commandId, worldId, materialId])).outcome;
const members = async (worldId) => rows('SELECT * FROM public.list_own_shared_world_member_handles_v1($1::uuid)', [worldId]);
const proposeRemoval = async (commandId, worldId, handle) =>
  first('SELECT * FROM public.propose_shared_world_member_removal_v1($1::uuid, $2::uuid, $3::uuid)', [commandId, worldId, handle]);
const proposeSettings = async (commandId, worldId, name) =>
  first('SELECT * FROM public.propose_shared_world_settings_v1($1::uuid, $2::uuid, $3::text, $4::text, $5::text)', [commandId, worldId, name, null, null]);
const proposeMember = async (commandId, worldId, sharedId) =>
  first('SELECT * FROM public.propose_shared_world_member_v1($1::uuid, $2::uuid, $3::text)', [commandId, worldId, sharedId]);
const approve = async (commandId, worldId, proposalId) =>
  (await first('SELECT * FROM public.approve_shared_world_proposal_v1($1::uuid, $2::uuid, $3::uuid)', [commandId, worldId, proposalId])).outcome;
const acceptRequest = async (commandId, worldId, requestId) =>
  (await first('SELECT * FROM public.accept_shared_membership_request_v1($1::uuid, $2::uuid, $3::uuid)', [commandId, worldId, requestId])).outcome;
const leave = async (commandId, worldId) => (await first('SELECT * FROM public.leave_shared_world_v1($1::uuid, $2::uuid)', [commandId, worldId])).outcome;
/** The acceptance's deferred episode binding is checked now, then deferral is restored (the 0140 verifier's own step). */
async function flushAcceptance() {
  await asOwner();
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
}
const proposalIdOf = async (commandId) => {
  await asOwner();
  return (await first("SELECT shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL', $1) AS id", [commandId])).id;
};
// --- S4-04 -----------------------------------------------------------------------------------------------------------
const alerts = async () => rows('SELECT * FROM public.list_own_shared_world_alerts_v1()');
const setAlerts = async (worldId, muted) => (await first('SELECT * FROM public.set_own_shared_world_alerts_v1($1::uuid, $2::boolean)', [worldId, muted])).outcome;
/** The server pass, as the server channel; rows sorted by recipient for comparison. */
async function source(kind, id) {
  await actAs('service_role');
  const list = await rows('SELECT * FROM public.server_read_shared_activity_source_v1($1, $2::uuid)', [kind, id]);
  await asOwner();
  return list;
}
const recipients = (list) => list.map((r) => r.recipient_user_id).sort();

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function drawSharedId() {
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += ALPHABET[randomInt(32)];
    if (i === 3 || i === 7) out += '-';
  }
  return out;
}
const refOf = (canonical) => `sid1:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
async function giveSharedId(user) {
  await asOwner();
  const [state] = await rows('SELECT epoch FROM public.shared_world_invite_credential_state WHERE user_id = $1', [user]);
  const canonical = drawSharedId();
  await asOwner(user);
  await rows('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, $3)', [randomUUID(), refOf(canonical), state ? state.epoch : null]);
  await asOwner();
  return canonical;
}
async function signUp(id, name, loginId) {
  await client.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  await client.query('UPDATE public.users SET name = $2, login_id = $3 WHERE id = $1', [id, name, loginId]);
}
/** A born ACTIVE / STANDARD World through the frozen 0081 / 0082 primitives (fixture construction only). */
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
const handleOf = async (worldId, reader, name) => {
  await actAs('authenticated', reader);
  const row = (await members(worldId)).find((m) => m.member_name === name);
  assert.ok(row, `${name} is a current member seen by the reader`);
  return row.member_handle;
};

const HUMAN = ['list_own_shared_world_alerts_v1', 'set_own_shared_world_alerts_v1'];

async function verifyBoundary() {
  stage = 'boundary: the server pass is a pinned public definer for service_role only';
  const [server] = await rows(`SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS owner FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'server_read_shared_activity_source_v1'`);
  assert.equal(server.prosecdef, true);
  assert.equal(server.owner, 'postgres');
  assert.ok((server.proconfig ?? []).includes('search_path=""'));
  const sig = 'public.server_read_shared_activity_source_v1(text,uuid)';
  for (const [role, expected] of [['public', false], ['anon', false], ['authenticated', false], ['service_role', true]]) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, sig, 'EXECUTE']);
    assert.equal(allowed, expected, `${role} ${expected ? 'runs' : 'cannot run'} the server pass`);
  }

  stage = 'boundary: the human commands are pinned definers behind INVOKER wrappers, for authenticated only';
  const definers = await rows(`SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'shared_private' AND p.proname = ANY($1::text[]) ORDER BY 1`, [[...HUMAN, 'shared_activity_world_name_v1']]);
  assert.deepEqual(definers.map((f) => f.proname), ['list_own_shared_world_alerts_v1', 'set_own_shared_world_alerts_v1', 'shared_activity_world_name_v1']);
  for (const f of definers) {
    assert.equal(f.prosecdef, true, `shared_private.${f.proname} is SECURITY DEFINER`);
    assert.ok((f.proconfig ?? []).includes('search_path=""'));
  }
  const wrappers = await rows(`SELECT p.proname, p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY($1::text[]) ORDER BY 1`, [[...HUMAN, 'shared_activity_world_name_v1']]);
  assert.deepEqual(wrappers.map((f) => [f.proname, f.prosecdef]), HUMAN.map((name) => [name, false]), 'no internal helper is exposed');
  const executable = await rows(`SELECT r.rolname, n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role'), ('public')) AS r(rolname)
    WHERE ((n.nspname = 'shared_private' AND p.proname = ANY($1::text[])) OR (n.nspname = 'public' AND p.proname = ANY($2::text[])))
      AND (r.rolname = 'public' OR EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2, 3`, [[...HUMAN, 'shared_activity_world_name_v1'], HUMAN]);
  assert.deepEqual(executable.map((r) => `${r.rolname} ${r.nspname}.${r.proname}`).sort(), [
    ...HUMAN.map((name) => `authenticated public.${name}`), ...HUMAN.map((name) => `authenticated shared_private.${name}`),
  ].sort());

  stage = 'boundary: the server channel reaches nothing new in shared_private; the committing census is untouched';
  const serverReach = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'shared_private' AND has_function_privilege('service_role', p.oid, 'EXECUTE') ORDER BY 1`);
  assert.deepEqual(serverReach.map((r) => r.proname),
    ['begin_shared_qandeel_reply_work_v1', 'complete_shared_world_qandeel_reply_v1', 'end_shared_qandeel_reply_work_v1']);
  // S5-03B proof-scope correction (no DB authority changed): local to S4-04, not a repository-wide ceiling — a later,
  // separately owned server command (S5-03B's `commit_public_spatial_placement_v1`, verify-migration-0145) is outside it.
  assert.ok([...HUMAN, 'shared_activity_world_name_v1'].every((name) => !name.startsWith('commit_')), 'S4-04 owns no `commit_%` command');
  const committing = await rows(`SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'commit\\_%' AND has_function_privilege('service_role', p.oid, 'EXECUTE') ORDER BY 1`);
  assert.deepEqual(committing.filter((f) => /\bshared_private\./u.test(f.prosrc)).map((f) => f.proname), [],
    'no service_role `commit_%` endpoint reaches the Shared shared_private surface');
  assert.ok(committing.some((f) => f.proname === 'commit_finalized_exchange_with_full_semantic_chain_v1'),
    'the historical T-03D FINAL coordinator keeps its service_role authority');

  stage = 'boundary: an unknown source kind is refused; a client cannot run the server pass';
  await actAs('service_role');
  await rejected(() => rows('SELECT * FROM public.server_read_shared_activity_source_v1($1, $2::uuid)', ['EVERYTHING', randomUUID()]), ['22023']);
  await actAs('authenticated', randomUUID());
  await rejected(() => rows('SELECT * FROM public.server_read_shared_activity_source_v1($1, $2::uuid)', ['HUMAN_TEXT', randomUUID()]), ['42501']);
  await asOwner();
  for (const kind of ['HUMAN_TEXT', 'PROPOSAL', 'MEMBER_REQUEST', 'JOINED', 'BIRTH', 'LEFT']) {
    assert.deepEqual(await source(kind, randomUUID()), [], `an unknown ${kind} tells nobody anything`);
  }
}

async function verifySources(h, w) {
  stage = 'BIRTH: the inviter of the born World alone';
  const birth = await source('BIRTH', w.one);
  assert.deepEqual(recipients(birth), [h.a], 'the inviter, never the human who accepted');
  assert.equal(birth[0].actor_name, 'Badr Two');
  assert.equal(birth[0].world_id, w.one);

  stage = 'HUMAN_TEXT: the current members of its own World who can see it — never its author, never another World';
  await setGate('SHARED_CONVERSATION', 'ENABLED', 'SATISFIED');
  await actAs('authenticated', h.a);
  const said = await send(randomUUID(), w.one, 'S4-04 private words that must never leave the World');
  assert.equal(said.outcome, 'COMMITTED');
  const told = await source('HUMAN_TEXT', said.material_id);
  assert.deepEqual(recipients(told), [h.b, h.c].sort(), 'B and C; not A (the author); not D (another World)');
  for (const row of told) {
    assert.equal(row.world_id, w.one);
    assert.deepEqual(Object.keys(row).sort(), ['actor_name', 'occurred_at', 'operation_kind', 'recipient_user_id', 'subject_name', 'world_id', 'world_name']);
    assert.ok(!JSON.stringify(row).includes('private words'), 'no content is ever returned');
  }
  assert.equal(told[0].world_name, null, 'no committed name yet');
  await actAs('authenticated', h.a);
  assert.equal(await deleteOwn(randomUUID(), w.one, said.material_id), 'DELETED');
  assert.deepEqual(await source('HUMAN_TEXT', said.material_id), [], 'a deleted message tells nobody');

  stage = 'PROPOSAL: exactly the people it waits on — never the proposer, never the removal target';
  await setGate('SHARED_GOVERNANCE', 'ENABLED', 'SATISFIED');
  const handleC = await handleOf(w.one, h.b, 'Chadi Three');
  await actAs('authenticated', h.b);
  const removal = randomUUID();
  assert.equal((await proposeRemoval(removal, w.one, handleC)).outcome, 'PROPOSED');
  const removalTold = await source('PROPOSAL', removal);
  assert.deepEqual(recipients(removalTold), [h.a], 'A only: not B (the proposer), not C (the target)');
  assert.deepEqual([removalTold[0].operation_kind, removalTold[0].actor_name, removalTold[0].subject_name], ['REMOVE_MEMBER', 'Badr Two', 'Chadi Three']);
  const settings = randomUUID();
  await actAs('authenticated', h.a);
  assert.equal((await proposeSettings(settings, w.one, 'S4-04 Room')).outcome, 'PROPOSED');
  const settingsTold = await source('PROPOSAL', settings);
  assert.deepEqual(recipients(settingsTold), [h.b, h.c].sort());
  assert.deepEqual(settingsTold.map((r) => [r.operation_kind, r.actor_name, r.subject_name]),
    [['WORLD_SETTINGS_CHANGE', 'Amal One', null], ['WORLD_SETTINGS_CHANGE', 'Amal One', null]], 'a removal target is named for a removal only');
  const settingsProposal = await proposalIdOf(settings);
  for (const human of [h.a, h.b, h.c]) {
    await actAs('authenticated', human);
    await approve(randomUUID(), w.one, settingsProposal);
  }
  assert.deepEqual(await source('PROPOSAL', settings), [], 'a committed proposal tells nobody');
  const named = await source('PROPOSAL', removal);
  assert.equal(named[0].world_name, 'S4-04 Room', 'the World label is its committed name');

  stage = 'MEMBER_REQUEST: nothing before every member approved; then the target alone, and nothing of the World';
  const idT = await giveSharedId(h.t);
  await actAs('authenticated', h.d);
  const nobody = randomUUID();
  assert.equal((await proposeMember(nobody, w.two, drawSharedId())).outcome, 'SUBMITTED');
  assert.deepEqual(await source('PROPOSAL', nobody), [], 'a request that opened nothing tells nobody');
  await actAs('authenticated', h.d);
  const add = randomUUID();
  assert.equal((await proposeMember(add, w.two, idT)).outcome, 'SUBMITTED');
  assert.deepEqual(recipients(await source('PROPOSAL', add)), [h.e], 'the other current member; never the target');
  const addProposal = await proposalIdOf(add);
  assert.deepEqual(await source('MEMBER_REQUEST', addProposal), [], 'nothing reaches the target before every member approved');
  await actAs('authenticated', h.d);
  assert.equal(await approve(randomUUID(), w.two, addProposal), 'APPROVED');
  await actAs('authenticated', h.e);
  assert.equal(await approve(randomUUID(), w.two, addProposal), 'INVITED');
  const request = await source('MEMBER_REQUEST', addProposal);
  assert.deepEqual(request.map((r) => [r.recipient_user_id, r.world_id, r.world_name, r.actor_name, r.subject_name, r.operation_kind]),
    [[h.t, w.two, null, 'Dina Four', null, 'ADD_MEMBER']], 'the target alone, with the proposer\'s Name and no World name');

  stage = 'JOINED: the other current members only; the request then tells nobody';
  await actAs('authenticated', h.t);
  const acceptance = randomUUID();
  assert.equal(await acceptRequest(acceptance, w.two, addProposal), 'JOINED');
  await flushAcceptance();
  const joined = await source('JOINED', acceptance);
  assert.deepEqual(recipients(joined), [h.d, h.e].sort(), 'D and E; never T (the human who joined)');
  assert.equal(joined[0].actor_name, 'Tala Thirteen');
  assert.deepEqual(await source('MEMBER_REQUEST', addProposal), [], 'an accepted request tells nobody');

  stage = 'LEFT: the members after this exact leave; never the human who left; nothing for another World';
  await actAs('authenticated', h.e);
  const left = randomUUID();
  assert.equal(await leave(left, w.two), 'LEFT');
  const leftTold = await source('LEFT', left);
  assert.deepEqual(recipients(leftTold), [h.d, h.t].sort());
  assert.equal(leftTold[0].actor_name, 'Ehab Five');
  for (const row of [...leftTold, ...joined]) assert.equal(row.world_id, w.two, 'never another World');
}

async function verifyAlerts(h, w) {
  stage = 'alerts: the reader\'s CURRENT Worlds only, each with its own mute';
  w.three = await bornWorld(h.a, h.d);
  await actAs('authenticated', h.a);
  assert.deepEqual((await alerts()).map((r) => [r.world_id, r.muted]).sort(), [[w.one, false], [w.three, false]].sort());
  for (const row of await alerts()) assert.equal(typeof row.muted, 'boolean', 'a real boolean');
  await asOwner();
  const [{ episodes }] = await rows('SELECT count(*)::int AS episodes FROM public.shared_world_membership_episodes WHERE world_id = ANY($1::uuid[])', [[w.one, w.three]]);
  const [{ materials }] = await rows('SELECT count(*)::int AS materials FROM public.shared_world_materials WHERE world_id = ANY($1::uuid[])', [[w.one, w.three]]);

  stage = 'alerts: muting World A mutes no other World and no other reader; unmuting restores';
  await actAs('authenticated', h.a);
  assert.equal(await setAlerts(w.one, true), 'MUTED');
  assert.equal(await setAlerts(w.one, true), 'MUTED', 'idempotent');
  assert.deepEqual((await alerts()).map((r) => [r.world_id, r.muted]).sort(), [[w.one, true], [w.three, false]].sort());
  await asOwner();
  assert.deepEqual((await rows('SELECT user_id, context_ref FROM public.activity_context_mutes WHERE user_id = ANY($1::uuid[]) ORDER BY 1, 2',
    [[h.a, h.b, h.c, h.d]])).map((r) => [r.user_id, r.context_ref]), [[h.a, w.one]], 'the ONE A3-01 mute table; the World id is the context');
  await actAs('authenticated', h.b);
  assert.deepEqual((await alerts()).map((r) => [r.world_id, r.muted]), [[w.one, false]], 'another reader of the same World is unaffected');
  await actAs('authenticated', h.a);
  assert.equal(await setAlerts(w.one, false), 'UNMUTED');
  assert.deepEqual((await alerts()).map((r) => [r.world_id, r.muted]).sort(), [[w.one, false], [w.three, false]].sort());
  await asOwner();
  const [{ episodesAfter }] = await rows('SELECT count(*)::int AS "episodesAfter" FROM public.shared_world_membership_episodes WHERE world_id = ANY($1::uuid[])', [[w.one, w.three]]);
  const [{ materialsAfter }] = await rows('SELECT count(*)::int AS "materialsAfter" FROM public.shared_world_materials WHERE world_id = ANY($1::uuid[])', [[w.one, w.three]]);
  assert.deepEqual([episodesAfter, materialsAfter], [episodes, materials], 'muting changes no membership and no material');

  stage = 'alerts: a former member, a stranger and an unknown World get one UNAVAILABLE and see nothing';
  await actAs('authenticated', h.e);
  assert.deepEqual(await alerts(), [], 'E left World Two: nothing is listed');
  assert.equal(await setAlerts(w.two, true), 'UNAVAILABLE', 'a former member cannot reach the World');
  await actAs('authenticated', h.x);
  assert.deepEqual(await alerts(), []);
  assert.equal(await setAlerts(w.one, true), 'UNAVAILABLE', 'a stranger');
  assert.equal(await setAlerts(randomUUID(), true), 'UNAVAILABLE', 'an unknown World');
  await asOwner();
  assert.equal(Number((await first('SELECT count(*)::int AS n FROM public.activity_context_mutes WHERE user_id = ANY($1::uuid[])', [[h.e, h.x]])).n), 0);
  await actAs('authenticated', h.a);
  await rejected(() => rows('SELECT * FROM public.set_own_shared_world_alerts_v1($1::uuid, $2::boolean)', [w.one, null]), ['22023']);
  await actAs('anon');
  await rejected(() => rows('SELECT * FROM public.list_own_shared_world_alerts_v1()'), ['42501']);
  await asOwner();
}

async function main() {
  try {
    await client.connect();
    await client.query('BEGIN');
    try {
      await verifyBoundary();
      stage = 'fixtures';
      const h = { a: randomUUID(), b: randomUUID(), c: randomUUID(), d: randomUUID(), e: randomUUID(), t: randomUUID(), x: randomUUID() };
      const suffix = randomUUID().slice(0, 8).replace(/[^a-z0-9]/gu, 'x');
      for (const [key, name] of [['a', 'Amal One'], ['b', 'Badr Two'], ['c', 'Chadi Three'], ['d', 'Dina Four'], ['e', 'Ehab Five'],
        ['t', 'Tala Thirteen'], ['x', 'Xena Outsider']]) {
        await signUp(h[key], name, `s404${key}${suffix}`);
      }
      const w = {};
      w.one = await bornWorld(h.a, h.b);
      w.two = await bornWorld(h.d, h.e);
      // C joins World One through the governed add, as the S4-03 Product path does it.
      await setGate('SHARED_GOVERNANCE', 'ENABLED', 'SATISFIED');
      const idC = await giveSharedId(h.c);
      await actAs('authenticated', h.a);
      const addC = randomUUID();
      assert.equal((await proposeMember(addC, w.one, idC)).outcome, 'SUBMITTED');
      const addCProposal = await proposalIdOf(addC);
      for (const human of [h.a, h.b]) {
        await actAs('authenticated', human);
        await approve(randomUUID(), w.one, addCProposal);
      }
      await actAs('authenticated', h.c);
      assert.equal(await acceptRequest(randomUUID(), w.one, addCProposal), 'JOINED');
      await flushAcceptance();
      await verifySources(h, w);
      await verifyAlerts(h, w);
    } finally {
      await client.query('ROLLBACK');
    }
    console.log('Verified migration 0141: the Shared Activity server pass is service_role only and derives every recipient from durable Shared truth (HUMAN_TEXT visible current members only, never the author, never another World, nothing once deleted; PROPOSAL exactly whom it waits on, never the proposer or removal target, nothing once committed; MEMBER_REQUEST the target alone, nothing of the World; JOINED / BIRTH / LEFT the other current members); per-World alerts list current Worlds only; muting one World mutes no other World or reader, changes no membership or material, writes the one A3-01 mute table; former members, strangers and unknown Worlds are UNAVAILABLE; no new table; no new server reach in shared_private.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Database verification failed at ${stage} (${code}). Connection details were suppressed.`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  else if (typeof error?.code === 'string' && typeof error?.message === 'string') console.error(error.message.slice(0, 300));
  process.exitCode = 1;
});
