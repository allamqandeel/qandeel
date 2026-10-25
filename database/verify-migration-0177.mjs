// S8A-04 CP3-C — the owner's permission surface by member names: the real-PostgreSQL verifier for migration 0177.
//
// Against a database migrated through 0177, inside ONE transaction that is rolled back, it proves (Copy Gate CG-1 – CG-5,
// approved 6/6 on 2026-10-25; the CP3-C authorization §3 – §4):
//   1. the boundary — the v2 read and commands are executable by `authenticated` only; the audience reference derivation by
//      no application role; pinned definers and invoker wrappers;
//   2. the view — the request is its owner's alone; the other current members are given by name, in join order, never by
//      id; the reference is that of the exact current audience; no value of the view names any user;
//   3. the commands — a stale, foreign or malformed reference writes nothing; the current reference allows exactly the
//      current audience; replay; decline; allow-later; withdrawal by the unchanged v1 command;
//   4. growth — a reconfirmation names only the new members; the reference shown before the join no longer allows;
//   5. endings — leaving (shown to the rejoined owner until they decide afresh), correction, forgetting, turning off and
//      expiry, each without the item's words when they are no longer the owner's.
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
const count = async (text, values = []) => Number((await first(text, values)).n);

/** Expect `operation` to be refused with one of `codes`. Must run inside the open transaction. */
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
/** Run the deferred constraint triggers now, as a commit would. */
async function settle() {
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
}

// ------------------------------------------------------------------------------------------------- fixtures (0175's)
const digest = (text) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
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
/** A former member comes back only by the governed REJOIN (0140): proposed by Shared ID, approved by all, accepted by them. */
async function rejoin(worldId, member, current) {
  await asOwner();
  const [state] = await rows('SELECT epoch FROM public.shared_world_invite_credential_state WHERE user_id = $1', [member]);
  const sharedId = Array.from({ length: 12 }, () => '0123456789ABCDEFGHJKMNPQRSTVWXYZ'[randomInt(32)]).join('').replace(/^(.{4})(.{4})/u, '$1-$2-');
  await asOwner(member);
  await rows('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, $3)',
    [randomUUID(), `sid1:${createHash('sha256').update(sharedId, 'utf8').digest('hex')}`, state ? state.epoch : null]);
  await actAs('authenticated', current[0]);
  assert.equal((await first('SELECT * FROM public.propose_shared_world_member_v1($1, $2, $3)', [randomUUID(), worldId, sharedId])).outcome, 'SUBMITTED');
  const proposal = (await first('SELECT proposal_id FROM public.list_own_shared_world_proposals_v1($1)', [worldId])).proposal_id;
  for (const human of current) {
    await actAs('authenticated', human);
    await first('SELECT * FROM public.approve_shared_world_proposal_v1($1, $2, $3)', [randomUUID(), worldId, proposal]);
  }
  await actAs('authenticated', member);
  assert.equal((await first('SELECT * FROM public.accept_shared_membership_request_v1($1, $2, $3)', [randomUUID(), worldId, proposal])).outcome, 'JOINED');
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
  const sent = await first('SELECT * FROM public.send_shared_world_human_text_v1($1, $2, $3)', [randomUUID(), worldId, content]);
  assert.equal(sent.outcome, 'COMMITTED');
  await asOwner();
  const { id } = await first('SELECT id FROM public.shared_world_material_commit_commands WHERE material_id = $1', [sent.material_id]);
  return { material: sent.material_id, command: id, world: worldId, sender };
}
/** One of the owner's memories, with its 0171 index terms. */
async function memory(owner, content, terms, { type = 'PERSONAL_FACT', source = 'USER_STATED', subject = 'SELF', importance = 0.5,
  expired = false } = {}) {
  const id = randomUUID();
  await asOwner();
  await client.query(`INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status, expires_at, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 0.9, $6, 'ACTIVE', NULL, now(), now())`, [id, owner, type, content, source, importance]);
  if (subject) await client.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis) VALUES ($1, $2, $3, 'EXPLICIT_STATEMENT')", [id, owner, subject]);
  // An attribution is written only with a live memory (0152), whose expiry is immutable: an expired one lapses after.
  if (expired) await client.query("UPDATE public.memories SET status = 'EXPIRED' WHERE id = $1", [id]);
  for (const term of terms) await client.query('INSERT INTO public.memory_retrieval_terms (memory_id, user_id, term) VALUES ($1, $2, $3)', [id, owner, term]);
  return id;
}


// ------------------------------------------------------------------------------------------------- the 0177 acts
const audienceOf = async (worldId) => {
  await asOwner();
  return (await rows('SELECT user_id FROM public.resolve_shared_world_human_audience_snapshot_v1($1) ORDER BY user_id', [worldId])).map((r) => r.user_id);
};
/** The reference the database derives, recomputed here independently of it. */
const expectedRef = async (worldId) => `sha256:${createHash('sha256').update(['QANDEEL_S8A04_CP3_SHARED_KNOWLEDGE_AUDIENCE_V2',
  `world=${String(worldId).toLowerCase()}`, `members=${(await audienceOf(worldId)).map((u) => String(u).toLowerCase()).sort().join(',')}`].join('\n'),
'utf8').digest('hex')}`;
const propose = async (on, terms) => {
  await actAs('service_role');
  const out = await first('SELECT * FROM public.propose_shared_knowledge_request_v1($1, $2, $3, $4)', [on.world, on.material, terms, 3600]);
  await asOwner();
  return out.outcome;
};
const view = async (owner, worldId) => {
  await actAs('authenticated', owner);
  const out = await rows('SELECT * FROM public.list_own_shared_knowledge_v2($1)', [worldId]);
  await asOwner();
  return out;
};
const answer = async (owner, requestId, decision, ref, command = randomUUID()) => {
  await actAs('authenticated', owner);
  const out = await first('SELECT * FROM public.answer_own_shared_knowledge_request_v2($1, $2, $3, $4)', [command, requestId, decision, ref]);
  await asOwner();
  return out.outcome;
};
const allow = async (owner, worldId, memoryId, ref, command = randomUUID()) => {
  await actAs('authenticated', owner);
  const out = await first('SELECT * FROM public.allow_own_shared_knowledge_v2($1, $2, $3, $4)', [command, worldId, memoryId, ref]);
  await asOwner();
  return out.outcome;
};
const revoke = async (owner, worldId, memoryId) => {
  await actAs('authenticated', owner);
  const out = await first('SELECT * FROM public.revoke_own_shared_knowledge_v1($1, $2, $3)', [randomUUID(), worldId, memoryId]);
  await asOwner();
  return out.outcome;
};
const openRequest = async (owner, worldId) => first(`SELECT id, memory_id FROM shared_knowledge_private.requests
  WHERE owner_user_id = $1 AND world_id = $2 AND state = 'OPEN'`, [owner, worldId]);
/** Test-only, rolled back: the per-member window (at least a minute) is treated as passed by moving that member's requests
 *  back in time, with the history guard suspended for this one statement. */
async function asIfAskedLongAgo(owner) {
  await asOwner();
  await client.query('SET LOCAL session_replication_role = replica');
  await client.query("UPDATE shared_knowledge_private.requests SET created_at = created_at - interval '2 hours' WHERE owner_user_id = $1", [owner]);
  await client.query('SET LOCAL session_replication_role = origin');
}
const tally = async () => ({
  events: await count('SELECT count(*) n FROM shared_knowledge_private.consent_events'),
  reasoning: await count('SELECT count(*) n FROM shared_knowledge_private.reasoning_grants'),
  disclosure: await count('SELECT count(*) n FROM shared_knowledge_private.disclosure_grants'),
  requests: await count("SELECT count(*) n FROM shared_knowledge_private.requests WHERE state = 'OPEN'"),
});
/** Names in join order; the two founders join at the same instant, so their relative order is not asserted. */
const sorted = (names) => [...names].sort();
const founders = (names) => [...sorted(names.slice(0, 2)), ...names.slice(2)];
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
/** No value of a v2 row names a user: only the owner's item, its request, words, endings, names and the opaque reference. */
function carriesNoUserId(viewRows, users) {
  const text = JSON.stringify(viewRows);
  for (const user of users) assert.ok(!text.includes(user), 'no user id leaves the owner surface');
  for (const r of viewRows) {
    assert.deepEqual(Object.keys(r), ['section', 'memory_id', 'content', 'request_id', 'ended_reason', 'member_names', 'new_member_names', 'audience_ref']);
    for (const name of [...(r.member_names ?? []), ...(r.new_member_names ?? [])]) assert.ok(!UUID.test(name), 'a name, not an id');
  }
}

// ------------------------------------------------------------------------------------------------- 1. the boundary
const V2 = ['list_own_shared_knowledge_v2', 'answer_own_shared_knowledge_request_v2', 'allow_own_shared_knowledge_v2'];
async function verifyBoundary() {
  stage = 'boundary: the owner\'s v2 read and commands for a person only; the reference derivation for no one';
  await asOwner();
  const executable = await rows(`SELECT r.rolname, n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
    WHERE n.nspname IN ('public', 'shared_knowledge_private') AND p.proname = ANY($1::text[])
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2, 3`, [[...V2, 'audience_ref_v2']]);
  assert.deepEqual(executable.map((r) => `${r.rolname} ${r.nspname}.${r.proname}`).sort(),
    V2.flatMap((name) => [`authenticated public.${name}`, `authenticated shared_knowledge_private.${name}`]).sort());
  const fns = await rows(`SELECT n.nspname, p.proname, p.prosecdef, pg_get_userbyid(p.proowner) AS owner, p.proconfig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname IN ('public', 'shared_knowledge_private') AND p.proname = ANY($1::text[])`,
  [[...V2, 'audience_ref_v2']]);
  assert.equal(fns.length, 7);
  for (const f of fns) {
    if (f.nspname === 'public') assert.equal(f.prosecdef, false, `public.${f.proname} is SECURITY INVOKER`);
    else assert.ok(f.prosecdef && f.owner === 'postgres' && JSON.stringify(f.proconfig) === JSON.stringify(['search_path=""']), `${f.proname} is a pinned definer`);
  }
  await actAs('anon');
  await rejected(() => rows('SELECT * FROM public.list_own_shared_knowledge_v2($1)', [randomUUID()]), ['42501']);
  await asOwner();
  await actAs('service_role');
  await rejected(() => rows('SELECT * FROM public.list_own_shared_knowledge_v2($1)', [randomUUID()]), ['42501']);
  await rejected(() => rows('SELECT * FROM public.allow_own_shared_knowledge_v2($1, $2, $3, $4)',
    [randomUUID(), randomUUID(), randomUUID(), `sha256:${'0'.repeat(64)}`]), ['42501']);
  await asOwner();
  await actAs('authenticated', randomUUID());
  await rejected(() => rows('SELECT shared_knowledge_private.audience_ref_v2($1)', [randomUUID()]), ['42501']);
  await asOwner();

  stage = 'boundary: the 0176 read and the two ceiling commands, which carry user ids, are retired for every application role';
  const retired = await rows(`SELECT r.rolname, n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
    WHERE n.nspname IN ('public', 'shared_knowledge_private') AND p.proname = ANY($1::text[])
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE')`,
  [['list_own_shared_knowledge_v1', 'answer_own_shared_knowledge_request_v1', 'allow_own_shared_knowledge_v1']]);
  assert.deepEqual(retired, [], 'no application role executes the v1 read or the two v1 ceiling commands');
  await actAs('authenticated', randomUUID());
  await rejected(() => rows('SELECT * FROM public.list_own_shared_knowledge_v1($1)', [randomUUID()]), ['42501']);
  await rejected(() => rows('SELECT * FROM public.answer_own_shared_knowledge_request_v1($1, $2, $3, $4)',
    [randomUUID(), randomUUID(), 'ALLOW', [randomUUID()]]), ['42501']);
  await rejected(() => rows('SELECT * FROM public.allow_own_shared_knowledge_v1($1, $2, $3, $4)',
    [randomUUID(), randomUUID(), randomUUID(), [randomUUID()]]), ['42501']);
  await asOwner();
  assert.equal((await first(`SELECT has_function_privilege('authenticated', 'public.revoke_own_shared_knowledge_v1(uuid, uuid, uuid)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'shared_knowledge_private.revoke_own_shared_knowledge_v1(uuid, uuid, uuid)', 'EXECUTE') AS kept`)).kept,
  true, 'the withdrawal, which carries no user id, stays the owner\'s');
}

// ------------------------------------------------------------------------------------------------- 2. the owner's view
async function verifyView(h, w, m) {
  stage = 'view: the request is the owner\'s alone, with the other members by name and the current audience\'s reference';
  const ask = await send(h.hala, w.one, 'هل ينام أحد منكم مبكرًا؟');
  assert.equal(await propose(ask, ['نوم', 'مبكر']), 'REQUESTED');
  const request = await openRequest(h.mohamed, w.one);
  assert.equal(request.memory_id, m.mohamedSleep);
  const mine = await view(h.mohamed, w.one);
  carriesNoUserId(mine, Object.values(h));
  assert.deepEqual(mine.map((r) => [r.section, r.memory_id, r.content, r.request_id, r.ended_reason, sorted(r.member_names), r.new_member_names]),
    [['REQUEST', m.mohamedSleep, 'أنام مبكرًا كل يوم بسبب عملي', request.id, null, ['سارة', 'هالة'], null]],
    'the other current members in join order (CG-1 {members}), never the owner');
  assert.equal(mine[0].audience_ref, await expectedRef(w.one), 'the opaque reference of the exact current audience');
  assert.deepEqual(await view(h.hala, w.one), [], 'the sender sees nothing');
  assert.deepEqual(await view(h.sara, w.one), [], 'another member sees nothing');
  assert.deepEqual(await view(h.outsider, w.one), [], 'a non-member sees nothing');
  assert.deepEqual(await view(h.mohamed, w.two), [], 'nothing of this World in another');
  await rejected(() => view(h.mohamed, null), ['22023']);
  return { ask, request, ref: mine[0].audience_ref };
}

// ------------------------------------------------------------------------------------------------- 3. the commands
async function verifyCommands(h, w, m, v) {
  stage = 'answer: a stale, foreign or malformed reference writes nothing';
  const before = await tally();
  assert.equal(await answer(h.mohamed, v.request.id, 'ALLOW', `sha256:${'a'.repeat(64)}`), 'AUDIENCE_CHANGED');
  assert.equal(await answer(h.mohamed, v.request.id, 'ALLOW', await expectedRef(w.two)), 'AUDIENCE_CHANGED', 'another World\'s reference');
  await rejected(() => answer(h.mohamed, v.request.id, 'ALLOW', null), ['22023']);
  await rejected(() => answer(h.mohamed, v.request.id, 'ALLOW', 'sha256:short'), ['22023']);
  await rejected(() => answer(h.mohamed, v.request.id, 'DECLINE', v.ref), ['22023']);
  await rejected(() => answer(h.mohamed, v.request.id, 'MAYBE', null), ['22023']);
  assert.equal(await answer(h.hala, v.request.id, 'ALLOW', v.ref), 'UNAVAILABLE', 'not her request, even with the right reference');
  assert.deepEqual(await tally(), before, 'nothing written');

  stage = 'answer: the current reference allows exactly the current audience; a replay is that answer';
  const command = randomUUID();
  assert.equal(await answer(h.mohamed, v.request.id, 'ALLOW', v.ref, command), 'ALLOWED');
  await settle();
  const pair = await first(`SELECT r.id, r.ceiling_user_ids FROM shared_knowledge_private.reasoning_grants r
    WHERE r.memory_id = $1 AND r.status = 'ACTIVE'`, [m.mohamedSleep]);
  assert.deepEqual([...pair.ceiling_user_ids].sort(), await audienceOf(w.one), 'the ceiling is the audience the owner was shown');
  assert.equal(await answer(h.mohamed, v.request.id, 'ALLOW', v.ref, command), 'ALLOWED');
  assert.deepEqual((await view(h.mohamed, w.one)).map((r) => [r.section, r.memory_id]), [['ALLOWED', m.mohamedSleep]]);

  stage = 'decline and allow-later by reference';
  assert.equal(await propose(v.ask, ['نوم', 'مبكر']), 'REQUESTED');
  const saraRequest = await openRequest(h.sara, w.one);
  assert.equal(await answer(h.sara, saraRequest.id, 'DECLINE', null), 'DECLINED');
  const declined = await view(h.sara, w.one);
  carriesNoUserId(declined, Object.values(h));
  assert.deepEqual(declined.map((r) => [r.section, r.memory_id, sorted(r.member_names)]), [['DECLINED', m.saraSleep, sorted(['هالة', 'محمد'])]]);
  assert.equal(await allow(h.sara, w.one, m.saraSleep, `sha256:${'b'.repeat(64)}`), 'AUDIENCE_CHANGED');
  assert.equal(await allow(h.sara, w.one, m.saraTravel, declined[0].audience_ref), 'UNAVAILABLE', 'no advance grant');
  assert.equal(await allow(h.hala, w.one, m.saraSleep, declined[0].audience_ref), 'UNAVAILABLE', 'not her item');
  await rejected(() => allow(h.sara, w.one, m.saraSleep, null), ['22023']);
  assert.equal(await allow(h.sara, w.one, m.saraSleep, declined[0].audience_ref), 'ALLOWED');
  await settle();

  stage = 'withdraw: the item moves to declined (allow-later), by the unchanged v1 command';
  assert.equal(await revoke(h.mohamed, w.one, m.mohamedSleep), 'REVOKED');
  assert.deepEqual((await view(h.mohamed, w.one)).map((r) => [r.section, r.memory_id]), [['DECLINED', m.mohamedSleep]]);
  assert.equal(await allow(h.mohamed, w.one, m.mohamedSleep, v.ref), 'ALLOWED', 'the same audience, the same reference');
  await settle();
}

// ------------------------------------------------------------------------------------------------- 4. the audience grows
async function verifyGrowth(h, w, m) {
  stage = 'growth: the new member is named for the reconfirmation; the old reference no longer allows';
  const oldRef = (await view(h.sara, w.one))[0].audience_ref;
  await addMember(w.one, h.nour, [h.hala, h.mohamed, h.sara]);
  const sara = await view(h.sara, w.one);
  carriesNoUserId(sara, Object.values(h));
  assert.deepEqual(sara.map((r) => [r.section, r.memory_id, founders(r.member_names), r.new_member_names]),
    [['NEEDS_RECONFIRMATION', m.saraSleep, ['هالة', 'محمد', 'نور'], ['نور']]].map(([a, b, c, d]) => [a, b, founders(c), d]), 'CG-3 {members}: the new members only');
  assert.notEqual(sara[0].audience_ref, oldRef);
  const before = await tally();
  assert.equal(await allow(h.sara, w.one, m.saraSleep, oldRef), 'AUDIENCE_CHANGED', 'the audience she was shown before');
  assert.deepEqual(await tally(), before);
  assert.equal(await allow(h.sara, w.one, m.saraSleep, sara[0].audience_ref), 'ALLOWED', '«اسمح للجميع»');
  await settle();
  assert.deepEqual((await view(h.sara, w.one)).map((r) => [r.section, r.new_member_names]), [['ALLOWED', null]]);
  assert.deepEqual((await view(h.mohamed, w.one)).map((r) => r.section), ['NEEDS_RECONFIRMATION']);
  assert.equal(await revoke(h.mohamed, w.one, m.mohamedSleep), 'REVOKED', '«أوقف استخدامها»');
  assert.deepEqual((await view(h.mohamed, w.one)).map((r) => r.section), ['DECLINED']);

  stage = 'growth during the answer: a request answered over the audience before a join is AUDIENCE_CHANGED';
  const coffee = await send(h.hala, w.one, 'من يشرب القهوة؟');
  assert.equal(await propose(coffee, ['قهوة']), 'REQUESTED');
  const nourRequest = await openRequest(h.nour, w.one);
  const shown = (await view(h.nour, w.one))[0];
  assert.deepEqual([shown.section, founders(shown.member_names)], ['REQUEST', founders(['هالة', 'محمد', 'سارة'])]);
  await addMember(w.one, h.layla, [h.hala, h.mohamed, h.sara, h.nour]);
  assert.equal(await answer(h.nour, nourRequest.id, 'ALLOW', shown.audience_ref), 'AUDIENCE_CHANGED');
  const again = (await view(h.nour, w.one))[0];
  assert.deepEqual(founders(again.member_names), founders(['هالة', 'محمد', 'سارة', 'ليلى']), 'the client shows the new list');
  assert.equal(await answer(h.nour, nourRequest.id, 'ALLOW', again.audience_ref), 'ALLOWED');
  await settle();
}

// ------------------------------------------------------------------------------------------------- 5. endings
async function verifyEndings(h, w, m) {
  stage = 'endings: leaving ends the permission; the rejoined owner sees it ended as LEFT, with nobody\'s id';
  await leave(h.nour, w.one);
  assert.deepEqual(await view(h.nour, w.one), [], 'a former member reads nothing');
  await rejoin(w.one, h.nour, [h.hala, h.mohamed, h.sara, h.layla]);
  const back = await view(h.nour, w.one);
  carriesNoUserId(back, Object.values(h));
  assert.deepEqual(back.map((r) => [r.section, r.memory_id, r.ended_reason, r.content]), [['ENDED', m.nourCoffee, 'LEFT', 'أشرب القهوة كل صباح']]);
  assert.equal(await allow(h.nour, w.one, m.nourCoffee, back[0].audience_ref), 'UNAVAILABLE', 'a fresh consent needs a fresh request');

  stage = 'endings: a fresh request of the new episode replaces the earlier ending';
  await asIfAskedLongAgo(h.nour);
  const coffee = await send(h.hala, w.one, 'من يحب القهوة صباحًا؟');
  assert.equal(await propose(coffee, ['قهوة']), 'REQUESTED');
  assert.deepEqual((await view(h.nour, w.one)).map((r) => r.section), ['REQUEST']);

  stage = 'endings: corrected, forgotten, turned off and expired are the owner\'s CG-5 endings';
  const cases = [['SUPERSEDED', 'CORRECTED'], ['DELETED', 'FORGOTTEN'], ['DISABLED', 'TURNED_OFF'], ['EXPIRED', 'EXPIRED']];
  for (const [status, reason] of cases) {
    const id = await memory(h.layla, `معلومة ${reason}`, [`اختبار${reason}`]);
    const ask = await send(h.hala, w.one, `سؤال ${reason}`);
    assert.equal(await propose(ask, [`اختبار${reason}`]), 'REQUESTED');
    const q = await openRequest(h.layla, w.one);
    assert.equal(q.memory_id, id);
    const shown = (await view(h.layla, w.one)).find((r) => r.section === 'REQUEST');
    assert.equal(await answer(h.layla, q.id, 'ALLOW', shown.audience_ref), 'ALLOWED');
    await settle();
    await client.query('UPDATE public.memories SET status = $2 WHERE id = $1', [id, status]);
    const ended = (await view(h.layla, w.one)).find((r) => r.memory_id === id);
    assert.deepEqual([ended.section, ended.ended_reason, ended.content], ['ENDED', reason, null], `${reason}: ended, without the words`);
    // The relevance read asks a member at most once per window: the next case is asked as if the window had passed.
    await asIfAskedLongAgo(h.layla);
  }
}

async function main() {
  await client.connect();
  try {
    await client.query('BEGIN');
    stage = 'fixtures';
    const h = { hala: randomUUID(), mohamed: randomUUID(), sara: randomUUID(), nour: randomUUID(), layla: randomUUID(), outsider: randomUUID() };
    const names = { hala: 'هالة', mohamed: 'محمد', sara: 'سارة', nour: 'نور', layla: 'ليلى', outsider: 'غريب' };
    for (const [key, id] of Object.entries(h)) await signUp(id, names[key], `cp3c_${key.slice(0, 6)}_${id.slice(0, 8)}`);
    await first('SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)',
      ['SHARED_CONVERSATION', 'ENABLED', 'SATISFIED', 's8a-04-cp3c-verifier', 'verification fixture']);
    await first('SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)',
      ['SHARED_GOVERNANCE', 'ENABLED', 'SATISFIED', 's8a-04-cp3c-verifier', 'verification fixture (the governed rejoin)']);
    const w = { one: await bornWorld(h.hala, h.mohamed), two: await bornWorld(h.hala, h.mohamed) };
    await addMember(w.one, h.sara, [h.hala, h.mohamed]);
    const m = {
      mohamedSleep: await memory(h.mohamed, 'أنام مبكرًا كل يوم بسبب عملي', ['نوم', 'مبكر'], { importance: 0.6 }),
      saraSleep: await memory(h.sara, 'أحب النوم مبكرًا', ['نوم']),
      saraTravel: await memory(h.sara, 'أسافر كثيرًا', ['سفر']),
      nourCoffee: await memory(h.nour, 'أشرب القهوة كل صباح', ['قهوة']),
    };

    await verifyBoundary();
    const v = await verifyView(h, w, m);
    await verifyCommands(h, w, m, v);
    await verifyGrowth(h, w, m);
    await verifyEndings(h, w, m);
    console.log('Verified migration 0177 (S8A-04 CP3-C): the owner\'s v2 read and commands are a person\'s only (nothing for the server or anon; the reference derivation for no one); the owner alone sees their request, with the other members by name and an opaque reference of the current audience, and no user id; a stale, foreign or malformed reference writes nothing; the current reference allows exactly the current audience; decline, allow-later and withdrawal; a growing audience names its new members and refuses the old reference; and the endings (left, corrected, forgotten, turned off, expired) shown to the owner alone.');
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'verification';
    console.error(`Migration 0177 verification failed at ${stage} (${code}): ${error?.message ?? error}`);
    process.exitCode = 1;
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}

main();
