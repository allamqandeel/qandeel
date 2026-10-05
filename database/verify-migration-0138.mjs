// S4-01 — Shared World Reachability, Invitation & Birth v1: the real-PostgreSQL verifier for migration 0138.
//
// It proves, against a fully migrated database:
//   1. the boundary: every privileged part lives in the non-exposed `shared_private` as a pinned SECURITY DEFINER;
//      every exposed wrapper is SECURITY INVOKER; the exact client-executable set; the operator gate change and the
//      bare gate binding are reachable by no application role; the frozen 0082 birth core, the frozen 0081 rotation
//      and submission and the 0129 server regeneration are executable by NO application role (the legacy client path
//      is retired — Journey B item 8); every new table is RLS-on, policy-free and unreachable;
//   2. the launch gate fails closed: with no configured capability nothing is provisioned, invited or born; ALLOW needs
//      ENABLED + SATISFIED / WAIVED; UNKNOWN, INTERNAL, LIMITED_ROLLOUT and EMERGENCY_DISABLED deny; every change
//      advances the restriction version and is audited;
//   3. the owner-readable Shared ID: the first provision and every regeneration commit the sealed value, the lookup
//      reference, the epoch and the PENDING-invitation invalidation together; the database stores bytes it cannot
//      open and never a clear value; a replay answers its committed epoch; a non-canonical value or a malformed seal
//      is refused before anything is written; a credential rotated outside the sealed path is UNSEALED, never served
//      stale; regeneration stays available while Shared is closed;
//   4. the non-enumerating invitation: one answer, SUBMITTED, for a person, nobody, the caller's own ID, a retired ID
//      and a duplicate — only the first creates a row; no World exists before acceptance;
//   5. decline: exact invitee only, idempotent, terminal DECLINED; no World, no membership;
//   6. the launch-gated birth: refused with no World while the birth capability denies; on ALLOW exactly one ACTIVE /
//      STANDARD World, exactly the inviter + invitee birth episodes, the invitation ACCEPTED, the WORLD_BIRTH fact and
//      the bound gate snapshot; a retry — same command or another command for the same invitation — births nothing new;
//   7. the Product reads: current Worlds, their members and the entry verdict for current members only; former
//      membership (a real voluntary leave) is not current membership; the invitation list carries the inviter's Name
//      and nothing else; another human's World is UNAVAILABLE, indistinguishable from a World that never existed;
//   8. concurrency on committed state: an emergency disable waits for an in-flight birth bound to the earlier
//      snapshot, and the next birth is refused; two identical acceptances birth one World.
//
// Stages 1–7 run inside one transaction that is rolled back. Stage 8 needs committed rows; its fixtures (and the gate
// rows it configured) are removed afterwards and the removal is checked.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = [], on = client) => (await on.query(text, values)).rows;

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
  return refusal;
}

/** A human acting through the Data API: role `authenticated` with that human's claims. */
async function actAs(role, userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role } : {})]);
}

/** The database owner (operator / fixture setup), optionally carrying a human's claims. */
async function asOwner(userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId } : {})]);
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** A fresh canonical Shared ID, exactly as the server draws one. */
function drawSharedId() {
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += ALPHABET[randomInt(32)];
    if (i === 3 || i === 7) out += '-';
  }
  return out;
}
const refOf = (canonical) => `sid1:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
/** A seal of the right shape. The database cannot open it; it only stores and returns it. */
const seal = () => ({ keyVersion: 1, nonce: randomBytes(12), ciphertext: randomBytes(14), tag: randomBytes(16) });

const rotateSealed = async (commandId, expectedEpoch, sharedId, s = seal(), on = client) =>
  (await rows('SELECT * FROM public.rotate_own_sealed_shared_id_v1($1, $2, $3, $4, $5, $6, $7)',
    [commandId, expectedEpoch, sharedId, s.keyVersion, s.nonce, s.ciphertext, s.tag], on))[0];
const readSharedId = async () => (await rows('SELECT * FROM public.read_own_shared_id_v1()'))[0];
const submit = async (commandId, sharedId) => (await rows('SELECT * FROM public.submit_shared_world_invitation_v1($1, $2)', [commandId, sharedId]))[0];
const decline = async (commandId, invitationId) => (await rows('SELECT * FROM public.decline_shared_world_invitation_v1($1, $2)', [commandId, invitationId]))[0];
const accept = async (commandId, invitationId, on = client) =>
  (await rows('SELECT * FROM public.accept_shared_world_invitation_v1($1, $2)', [commandId, invitationId], on))[0];
const capabilities = async () => (await rows('SELECT * FROM public.read_shared_capabilities_v1()'))[0];
const setGate = async (scope, flag, requirements, on = client) =>
  (await rows('SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)',
    [scope, flag, requirements, 's4-01-verifier', 'verification fixture'], on))[0];

async function counts() {
  const [row] = await rows(`SELECT (SELECT count(*) FROM public.shared_worlds)::int AS worlds,
    (SELECT count(*) FROM public.shared_world_membership_episodes)::int AS episodes,
    (SELECT count(*) FROM public.shared_world_direct_birth_events)::int AS births,
    (SELECT count(*) FROM public.shared_world_direct_invitations)::int AS invitations`);
  return row;
}

async function pendingFor(target) {
  return rows(`SELECT id, inviter_user_id, target_credential_epoch FROM public.shared_world_direct_invitations
                WHERE target_user_id = $1 AND status = 'PENDING' ORDER BY created_at, id`, [target]);
}

const SHARED_PRIVATE_DEFINERS = [
  'accept_shared_world_invitation_v1', 'bind_shared_launch_gate_v1', 'decline_shared_world_invitation_v1',
  'list_own_shared_world_invitations_v1', 'list_own_shared_world_members_v1', 'list_own_shared_worlds_v1',
  'read_own_shared_id_v1', 'read_shared_capabilities_v1', 'resolve_own_shared_world_entry_v1',
  'rotate_own_sealed_shared_id_v1', 'set_shared_launch_capability_v1', 'submit_shared_world_invitation_v1',
];
const OWNER_COMMANDS = SHARED_PRIVATE_DEFINERS.filter((n) => n !== 'bind_shared_launch_gate_v1' && n !== 'set_shared_launch_capability_v1');
const NEW_TABLES = ['shared_direct_birth_launch_evidence', 'shared_direct_invitation_decline_commands', 'shared_id_sealed_values',
  'shared_launch_capability_events', 'shared_launch_capability_states'];

// ------------------------------------------------------------------------------------------------------
// Stage 1 — the boundary.
// ------------------------------------------------------------------------------------------------------
async function verifyBoundary() {
  stage = 'boundary: every shared_private function is a pinned SECURITY DEFINER; every public wrapper is INVOKER';
  const privateFns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'shared_private' ORDER BY 1`);
  assert.deepEqual(privateFns.map((f) => f.proname), SHARED_PRIVATE_DEFINERS);
  for (const f of privateFns) {
    assert.equal(f.prosecdef, true, `shared_private.${f.proname} is SECURITY DEFINER`);
    assert.equal(f.owner, 'postgres');
    assert.ok((f.proconfig ?? []).includes('search_path=""'), `shared_private.${f.proname} pins an empty search_path`);
  }
  const publicFns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY($1::text[]) ORDER BY 1`, [OWNER_COMMANDS]);
  assert.deepEqual(publicFns.map((f) => f.proname), [...OWNER_COMMANDS].sort());
  for (const f of publicFns) {
    assert.equal(f.prosecdef, false, `public.${f.proname} is SECURITY INVOKER`);
    assert.ok((f.proconfig ?? []).includes('search_path=""'));
  }

  stage = 'boundary: the client-executable set is exact';
  const executable = await rows(`SELECT r.rolname, n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role'), ('public')) AS r(rolname)
    WHERE (n.nspname = 'shared_private' OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND (r.rolname = 'public' OR EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2, 3`, [OWNER_COMMANDS]);
  assert.deepEqual(executable, [
    ...OWNER_COMMANDS.map((proname) => ({ rolname: 'authenticated', nspname: 'public', proname })).sort((a, b) => a.proname.localeCompare(b.proname)),
    ...OWNER_COMMANDS.map((proname) => ({ rolname: 'authenticated', nspname: 'shared_private', proname })).sort((a, b) => a.proname.localeCompare(b.proname)),
  ], 'authenticated runs exactly the owner commands; nobody runs the operator change or the bare gate binding');

  stage = 'boundary: the irreversible core and the legacy credential / invitation path are server-owned';
  for (const fn of ['public.commit_shared_world_direct_acceptance_birth_v1(uuid,uuid,uuid,uuid,uuid)',
    'public.rotate_shared_world_invite_credential_v1(uuid,text,bigint)',
    'public.submit_shared_world_direct_invitation_v1(uuid,uuid,text)',
    'account_private.regenerate_own_shared_id_v1(uuid)']) {
    for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
      const exists = role === 'public' || (await rows('SELECT 1 FROM pg_roles WHERE rolname = $1', [role])).length === 1;
      if (!exists) continue;
      const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, fn, 'EXECUTE']);
      assert.equal(allowed, false, `${role} must not execute ${fn}`);
    }
  }

  stage = 'boundary: every new table is RLS-on, policy-free and unreachable';
  for (const table of NEW_TABLES) {
    const [meta] = await rows(`SELECT c.relrowsecurity, (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS policies
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'shared_private' AND c.relname = $1`, [table]);
    assert.deepEqual(meta, { relrowsecurity: true, policies: 0 }, table);
    for (const role of ['anon', 'authenticated']) {
      const [{ reach }] = await rows('SELECT has_table_privilege($1, $2, $3) AS reach', [role, `shared_private.${table}`, 'SELECT,INSERT,UPDATE,DELETE']);
      assert.equal(reach, false, `${role} cannot reach ${table}`);
    }
  }
  const [{ clearColumns }] = await rows(`SELECT count(*)::int AS "clearColumns" FROM information_schema.columns
    WHERE table_schema = 'shared_private' AND column_name ~* '(shared_id|plaintext|clear)'`);
  assert.equal(clearColumns, 0, 'no column holds a Shared ID in clear');

  stage = 'boundary: no gate is configured by a migration';
  const [{ configured }] = await rows('SELECT count(*)::int AS configured FROM shared_private.shared_launch_capability_states');
  assert.equal(configured, 0);
}

// ------------------------------------------------------------------------------------------------------
// Stages 2–7 — behaviour, inside one rolled-back transaction.
// ------------------------------------------------------------------------------------------------------
async function verifyClosedGate({ a, b }) {
  stage = 'closed gate: no Shared ID is provisioned, nothing is invited, nothing is born';
  await actAs('authenticated', a);
  assert.deepEqual(await capabilities(), { invitation_available: false, birth_available: false });
  const absent = await readSharedId();
  assert.equal(absent.state, 'ABSENT');
  assert.equal(absent.provisioning_available, false);
  const refused = await rotateSealed(randomUUID(), null, drawSharedId());
  assert.deepEqual(refused, { outcome: 'UNAVAILABLE', credential_epoch: null });
  assert.equal((await readSharedId()).state, 'ABSENT', 'a closed gate creates no Connected Worlds reference on the account');
  await actAs('authenticated', b);
  assert.deepEqual(await submit(randomUUID(), drawSharedId()), { outcome: 'UNAVAILABLE' });
  assert.deepEqual(await submit(randomUUID(), 'not an id'), { outcome: 'INVALID_SHARED_ID' });
  assert.deepEqual(await accept(randomUUID(), randomUUID()), { outcome: 'UNAVAILABLE', world_id: null });
  await asOwner();
  const [{ credentials }] = await rows('SELECT count(*)::int AS credentials FROM public.shared_world_invite_credential_state WHERE user_id = ANY($1::uuid[])', [[a, b]]);
  assert.equal(credentials, 0);
}

async function verifyGateOperator() {
  stage = 'gate: the operator change advances the version and is audited; clients cannot run it';
  await asOwner();
  const first = await setGate('SHARED_DIRECT_INVITATION', 'DISABLED', 'UNKNOWN');
  const second = await setGate('SHARED_DIRECT_INVITATION', 'ENABLED', 'SATISFIED');
  assert.equal(Number(first.restriction_version), 1);
  assert.equal(Number(second.restriction_version), 2);
  const events = await rows(`SELECT feature_flag_state, launch_requirements_state, restriction_version::int AS v FROM shared_private.shared_launch_capability_events
    WHERE capability_scope = 'SHARED_DIRECT_INVITATION' ORDER BY id`);
  assert.deepEqual(events, [
    { feature_flag_state: 'DISABLED', launch_requirements_state: 'UNKNOWN', v: 1 },
    { feature_flag_state: 'ENABLED', launch_requirements_state: 'SATISFIED', v: 2 },
  ]);
  for (const role of ['authenticated', 'anon']) {
    await actAs(role, role === 'anon' ? null : randomUUID());
    await rejected(() => setGate('SHARED_DIRECT_WORLD_BIRTH', 'ENABLED', 'SATISFIED'), ['42501']);
    await rejected(() => rows("SELECT * FROM shared_private.bind_shared_launch_gate_v1('SHARED_DIRECT_WORLD_BIRTH')"), ['42501']);
    await rejected(() => rows('SELECT * FROM shared_private.shared_launch_capability_states'), ['42501']);
  }
  await asOwner();
  await rejected(() => setGate('SHARED_DIRECT_INVITATION', 'ON', 'SATISFIED'), ['23514']);
  await rejected(() => setGate('PUBLIC_EVERYTHING', 'ENABLED', 'SATISFIED'), ['23514']);
}

async function verifySharedId({ a, b }) {
  stage = 'shared id: the first provision seals the value, the reference and epoch 1 together';
  const valueA = drawSharedId();
  const sealA = seal();
  const setup = randomUUID();
  await actAs('authenticated', a);
  assert.equal((await readSharedId()).provisioning_available, true);
  assert.deepEqual(await rotateSealed(setup, null, valueA, sealA), { outcome: 'ROTATED', credential_epoch: '1' });
  const sealed = await readSharedId();
  assert.equal(sealed.state, 'SEALED');
  assert.equal(sealed.credential_epoch, '1');
  assert.equal(sealed.credential_lookup_ref, refOf(valueA), 'the sealed row is bound to the reference of exactly this value');
  assert.equal(sealed.key_version, 1);
  assert.ok(sealed.nonce.equals(sealA.nonce) && sealed.ciphertext.equals(sealA.ciphertext) && sealed.auth_tag.equals(sealA.tag));
  await asOwner();
  const [state] = await rows('SELECT credential_lookup_ref, epoch FROM public.shared_world_invite_credential_state WHERE user_id = $1', [a]);
  assert.deepEqual(state, { credential_lookup_ref: refOf(valueA), epoch: '1' });
  const [{ inClear }] = await rows(`SELECT (SELECT count(*) FROM shared_private.shared_id_sealed_values WHERE ciphertext = convert_to($1, 'UTF8'))
      + (SELECT count(*) FROM public.shared_world_invite_credential_state WHERE credential_lookup_ref = $1)
      + (SELECT count(*) FROM public.shared_world_invitation_commands WHERE credential_lookup_ref = $1) AS "inClear"`, [valueA]);
  assert.equal(Number(inClear), 0, 'the Shared ID is stored nowhere in clear');

  stage = 'shared id: a replay answers its committed epoch and changes nothing';
  await actAs('authenticated', a);
  assert.deepEqual(await rotateSealed(setup, null, drawSharedId()), { outcome: 'ROTATED', credential_epoch: '1' });
  assert.equal((await readSharedId()).credential_lookup_ref, refOf(valueA));

  stage = 'shared id: a non-canonical value or a malformed seal is refused before anything is written';
  for (const bad of [valueA.toLowerCase(), valueA.replace(/-/gu, ''), 'K7QM-4XWD-P9TU', '']) {
    await rejected(() => rotateSealed(randomUUID(), 1, bad), ['22023']);
  }
  await rejected(() => rotateSealed(randomUUID(), 1, drawSharedId(), { ...seal(), nonce: randomBytes(8) }), ['22023']);
  await rejected(() => rotateSealed(randomUUID(), 1, drawSharedId(), { ...seal(), tag: randomBytes(12) }), ['22023']);
  await rejected(() => rotateSealed(randomUUID(), 1, drawSharedId(), { ...seal(), keyVersion: 0 }), ['22023']);
  await rejected(() => rotateSealed(randomUUID(), 7, drawSharedId()), ['40001']);
  assert.equal((await readSharedId()).credential_epoch, '1');

  stage = 'shared id: the legacy client rotation and submission are refused (Journey B item 8)';
  await rejected(() => rows('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, $3)', [randomUUID(), refOf(drawSharedId()), 1]), ['42501']);
  await rejected(() => rows('SELECT * FROM public.submit_shared_world_direct_invitation_v1($1, $2, $3)', [randomUUID(), randomUUID(), refOf(valueA)]), ['42501']);
  await rejected(() => rows('SELECT * FROM shared_private.shared_id_sealed_values'), ['42501']);

  stage = 'shared id: a second account provisions its own';
  await actAs('authenticated', b);
  const valueB = drawSharedId();
  assert.deepEqual(await rotateSealed(randomUUID(), null, valueB), { outcome: 'ROTATED', credential_epoch: '1' });
  stage = 'shared id: a value another account holds is refused with the bounded class and names nobody';
  const collision = await rejected(() => rotateSealed(randomUUID(), 1, valueA), ['23505']);
  assert.match(collision.message, /SHARED_INVITE_CREDENTIAL_REF_UNAVAILABLE/u);
  assert.doesNotMatch(collision.message, new RegExp(a, 'u'));
  return { valueA, valueB };
}

async function verifyInvitation({ a, b, c }, { valueA, valueB }) {
  stage = 'invitation: a typed Shared ID reaches its owner; the answer names nobody; no World exists yet';
  const before = await counts();
  await actAs('authenticated', b);
  const typed = valueA.toLowerCase().replace(/-/gu, ' ');
  const command = randomUUID();
  const answer = await submit(command, typed);
  assert.deepEqual(answer, { outcome: 'SUBMITTED' }, 'one outcome column and nothing else');
  await asOwner();
  const pending = await pendingFor(a);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].inviter_user_id, b);
  assert.equal(pending[0].target_credential_epoch, '1');
  const after = await counts();
  assert.deepEqual({ ...after, invitations: before.invitations }, before, 'an invitation creates no World and no membership');

  stage = 'invitation: nobody, the caller\'s own ID, a duplicate and a replay all answer SUBMITTED; only the first wrote';
  await actAs('authenticated', b);
  assert.deepEqual(await submit(randomUUID(), drawSharedId()), { outcome: 'SUBMITTED' });
  assert.deepEqual(await submit(randomUUID(), valueB), { outcome: 'SUBMITTED' });
  assert.deepEqual(await submit(randomUUID(), valueA), { outcome: 'SUBMITTED' });
  assert.deepEqual(await submit(command, typed), { outcome: 'SUBMITTED' });
  assert.deepEqual(await submit(randomUUID(), '12345'), { outcome: 'INVALID_SHARED_ID' });
  await asOwner();
  assert.equal((await counts()).invitations, after.invitations, 'no further row was written');
  assert.equal((await pendingFor(b)).length, 0, 'the caller\'s own ID invited nobody');

  stage = 'invitation: the invitee sees the inviter\'s Name and nothing else; others see nothing';
  await actAs('authenticated', a);
  const incoming = await rows('SELECT * FROM public.list_own_shared_world_invitations_v1()');
  assert.equal(incoming.length, 1);
  assert.deepEqual(Object.keys(incoming[0]).sort(), ['created_at', 'invitation_id', 'inviter_name']);
  assert.equal(incoming[0].inviter_name, 'Bassem Inviter');
  assert.equal(incoming[0].invitation_id, pending[0].id);
  for (const other of [b, c]) {
    await actAs('authenticated', other);
    assert.equal((await rows('SELECT * FROM public.list_own_shared_world_invitations_v1()')).length, 0);
  }
  return pending[0].id;
}

async function verifyBirth({ a, b, c }, invitationId) {
  stage = 'birth: a closed or not-yet-satisfied birth capability refuses before anything is written';
  const before = await counts();
  for (const [flag, requirements] of [[null, null], ['DISABLED', 'SATISFIED'], ['ENABLED', 'UNKNOWN'], ['ENABLED', 'UNSATISFIED'],
    ['INTERNAL', 'SATISFIED'], ['LIMITED_ROLLOUT', 'SATISFIED'], ['EMERGENCY_DISABLED', 'SATISFIED']]) {
    if (flag !== null) {
      await asOwner();
      await setGate('SHARED_DIRECT_WORLD_BIRTH', flag, requirements);
    }
    await actAs('authenticated', a);
    assert.deepEqual(await accept(randomUUID(), invitationId), { outcome: 'UNAVAILABLE', world_id: null }, `${flag} / ${requirements} denies`);
  }
  await asOwner();
  assert.deepEqual(await counts(), before);
  assert.equal((await rows('SELECT status FROM public.shared_world_direct_invitations WHERE id = $1', [invitationId]))[0].status, 'PENDING');

  stage = 'birth: only the exact invitee may accept';
  const waived = await setGate('SHARED_DIRECT_WORLD_BIRTH', 'ENABLED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE');
  for (const other of [b, c]) {
    await actAs('authenticated', other);
    assert.deepEqual(await accept(randomUUID(), invitationId), { outcome: 'NOT_ACCEPTABLE', world_id: null });
  }
  await asOwner();
  assert.deepEqual(await counts(), before);

  stage = 'birth: ALLOW births exactly one World with exactly the inviter + invitee episodes, atomically';
  const satisfied = await setGate('SHARED_DIRECT_WORLD_BIRTH', 'ENABLED', 'SATISFIED');
  assert.equal(Number(satisfied.restriction_version), Number(waived.restriction_version) + 1);
  await actAs('authenticated', a);
  const command = randomUUID();
  const born = await accept(command, invitationId);
  assert.equal(born.outcome, 'BORN');
  assert.match(born.world_id, /^[0-9a-f-]{36}$/u);
  await asOwner();
  const after = await counts();
  assert.deepEqual(after, { ...before, worlds: before.worlds + 1, episodes: before.episodes + 2, births: before.births + 1 });
  const [world] = await rows('SELECT lifecycle, phase, birth_basis, closed_at FROM public.shared_worlds WHERE id = $1', [born.world_id]);
  assert.deepEqual(world, { lifecycle: 'ACTIVE', phase: 'STANDARD', birth_basis: 'ACCEPTED_INVITATION', closed_at: null });
  const episodes = await rows('SELECT user_id FROM public.shared_world_membership_episodes WHERE world_id = $1 AND ended_at IS NULL ORDER BY user_id', [born.world_id]);
  assert.deepEqual(episodes.map((e) => e.user_id), [a, b].sort());
  assert.equal((await rows('SELECT status FROM public.shared_world_direct_invitations WHERE id = $1', [invitationId]))[0].status, 'ACCEPTED');
  assert.equal((await rows('SELECT count(*)::int AS n FROM public.shared_world_direct_birth_events WHERE world_id = $1 AND invitation_id = $2', [born.world_id, invitationId]))[0].n, 1);
  const [evidence] = await rows(`SELECT world_id, capability_scope, restriction_version, feature_flag_state, launch_requirements_state
    FROM shared_private.shared_direct_birth_launch_evidence WHERE acceptance_command_id = $1`, [command]);
  assert.deepEqual(evidence, { world_id: born.world_id, capability_scope: 'SHARED_DIRECT_WORLD_BIRTH',
    restriction_version: satisfied.restriction_version, feature_flag_state: 'ENABLED', launch_requirements_state: 'SATISFIED' },
  'the birth bound the exact current gate snapshot');

  stage = 'birth: a retry births nothing new — the same command, or another command for the same invitation';
  await actAs('authenticated', a);
  assert.deepEqual(await accept(command, invitationId), born);
  assert.deepEqual(await accept(randomUUID(), invitationId), born);
  await rejected(() => accept(command, randomUUID()), ['23505']);
  stage = 'birth: a replay of a committed acceptance is answered even after an emergency disable';
  await asOwner();
  await setGate('SHARED_DIRECT_WORLD_BIRTH', 'EMERGENCY_DISABLED', 'SATISFIED');
  await actAs('authenticated', a);
  assert.deepEqual(await accept(command, invitationId), born);
  await asOwner();
  await setGate('SHARED_DIRECT_WORLD_BIRTH', 'ENABLED', 'SATISFIED');
  assert.deepEqual(await counts(), after);
  return born.world_id;
}

async function verifyReads({ a, b, c }, worldId) {
  stage = 'reads: current members see the World, its members and ALLOW; nobody else does';
  for (const member of [a, b]) {
    await actAs('authenticated', member);
    const worlds = await rows('SELECT * FROM public.list_own_shared_worlds_v1()');
    assert.deepEqual(worlds.map((w) => w.world_id), [worldId]);
    const members = await rows('SELECT * FROM public.list_own_shared_world_members_v1()');
    assert.deepEqual(members.map((m) => [m.world_id, m.member_name, m.is_self]).sort(),
      [[worldId, 'Amal Invitee', member === a], [worldId, 'Bassem Inviter', member === b]].sort());
    const [entry] = await rows('SELECT * FROM public.resolve_own_shared_world_entry_v1($1)', [worldId]);
    assert.equal(entry.outcome, 'ALLOW');
    assert.equal(entry.world_id, worldId);
  }
  await actAs('authenticated', c);
  assert.equal((await rows('SELECT * FROM public.list_own_shared_worlds_v1()')).length, 0);
  assert.equal((await rows('SELECT * FROM public.list_own_shared_world_members_v1()')).length, 0);
  const foreign = (await rows('SELECT * FROM public.resolve_own_shared_world_entry_v1($1)', [worldId]))[0];
  const never = (await rows('SELECT * FROM public.resolve_own_shared_world_entry_v1($1)', [randomUUID()]))[0];
  assert.deepEqual(foreign, { outcome: 'UNAVAILABLE', world_id: null, born_at: null, joined_at: null });
  assert.deepEqual(never, foreign, 'another human\'s World and a World that never existed are one answer');

  stage = 'reads: no subject and anon are refused';
  await actAs('authenticated');
  for (const call of ['* FROM public.list_own_shared_worlds_v1()', '* FROM public.list_own_shared_world_invitations_v1()',
    '* FROM public.read_own_shared_id_v1()', '* FROM public.read_shared_capabilities_v1()']) {
    await rejected(() => rows(`SELECT ${call}`), ['42501']);
  }
  await actAs('anon');
  await rejected(() => rows('SELECT * FROM public.list_own_shared_worlds_v1()'), ['42501']);
  await asOwner();
}

async function verifyDecline({ a, b, c }, { valueA }) {
  stage = 'decline: exact invitee only; terminal DECLINED; no World, no membership; idempotent';
  await actAs('authenticated', b);
  assert.deepEqual(await submit(randomUUID(), valueA), { outcome: 'SUBMITTED' });
  await asOwner();
  const [invitation] = await pendingFor(a);
  const before = await counts();
  for (const other of [b, c]) {
    await actAs('authenticated', other);
    assert.deepEqual(await decline(randomUUID(), invitation.id), { outcome: 'NOT_DECLINABLE' });
  }
  await actAs('authenticated', a);
  const command = randomUUID();
  assert.deepEqual(await decline(command, invitation.id), { outcome: 'DECLINED' });
  assert.deepEqual(await decline(command, invitation.id), { outcome: 'DECLINED' });
  assert.deepEqual(await decline(randomUUID(), invitation.id), { outcome: 'DECLINED' });
  await rejected(() => decline(command, randomUUID()), ['23505']);
  assert.deepEqual(await accept(randomUUID(), invitation.id), { outcome: 'NOT_ACCEPTABLE', world_id: null });
  assert.equal((await rows('SELECT * FROM public.list_own_shared_world_invitations_v1()')).length, 0);
  assert.deepEqual(await decline(randomUUID(), randomUUID()), { outcome: 'NOT_DECLINABLE' });
  await asOwner();
  assert.deepEqual(await counts(), before, 'a decline creates no World and no membership');
  const [row] = await rows('SELECT status, terminal_at IS NOT NULL AS terminal FROM public.shared_world_direct_invitations WHERE id = $1', [invitation.id]);
  assert.deepEqual(row, { status: 'DECLINED', terminal: true });

  stage = 'decline: a new invitation is allowed afterwards on the same current Shared ID';
  await actAs('authenticated', b);
  assert.deepEqual(await submit(randomUUID(), valueA), { outcome: 'SUBMITTED' });
  await asOwner();
  assert.equal((await pendingFor(a)).length, 1);
}

async function verifyRegeneration({ a, b }, { valueA }, worldId) {
  stage = 'regeneration: one transaction replaces the value, the reference and the epoch and invalidates old PENDING';
  await asOwner();
  const [old] = await pendingFor(a);
  const worldBefore = await rows('SELECT w.lifecycle, e.user_id, e.ended_at FROM public.shared_worlds w JOIN public.shared_world_membership_episodes e ON e.world_id = w.id WHERE w.id = $1 ORDER BY e.user_id', [worldId]);
  await actAs('authenticated', a);
  const next = drawSharedId();
  assert.deepEqual(await rotateSealed(randomUUID(), 1, next), { outcome: 'ROTATED', credential_epoch: '2' });
  const sealed = await readSharedId();
  assert.deepEqual([sealed.state, sealed.credential_epoch, sealed.credential_lookup_ref], ['SEALED', '2', refOf(next)]);
  await asOwner();
  assert.equal((await rows('SELECT status FROM public.shared_world_direct_invitations WHERE id = $1', [old.id]))[0].status, 'INVALIDATED');
  assert.deepEqual(await rows('SELECT w.lifecycle, e.user_id, e.ended_at FROM public.shared_worlds w JOIN public.shared_world_membership_episodes e ON e.world_id = w.id WHERE w.id = $1 ORDER BY e.user_id', [worldId]),
    worldBefore, 'a born World is untouched by regeneration');

  stage = 'regeneration: the old ID answers SUBMITTED and reaches nobody; the new one reaches the owner';
  await actAs('authenticated', b);
  assert.deepEqual(await submit(randomUUID(), valueA), { outcome: 'SUBMITTED' });
  await asOwner();
  assert.equal((await pendingFor(a)).length, 0, 'the retired Shared ID no longer works');
  await actAs('authenticated', b);
  assert.deepEqual(await submit(randomUUID(), next), { outcome: 'SUBMITTED' });
  await asOwner();
  const fresh = await pendingFor(a);
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].target_credential_epoch, '2');

  stage = 'regeneration: an existing Shared ID can still be regenerated while Shared is closed';
  await setGate('SHARED_DIRECT_INVITATION', 'EMERGENCY_DISABLED', 'SATISFIED');
  await actAs('authenticated', a);
  assert.equal((await readSharedId()).provisioning_available, false);
  assert.deepEqual(await rotateSealed(randomUUID(), 2, drawSharedId()), { outcome: 'ROTATED', credential_epoch: '3' });
  await asOwner();
  await setGate('SHARED_DIRECT_INVITATION', 'ENABLED', 'SATISFIED');

  stage = 'regeneration: a credential rotated outside the sealed path is UNSEALED, never served stale';
  await asOwner(a);
  await rows('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, $3)', [randomUUID(), refOf(drawSharedId()), 3]);
  await actAs('authenticated', a);
  const unsealed = await readSharedId();
  assert.deepEqual([unsealed.state, unsealed.credential_epoch, unsealed.ciphertext], ['UNSEALED', '4', null]);
  assert.deepEqual(await rotateSealed(randomUUID(), 4, drawSharedId()), { outcome: 'ROTATED', credential_epoch: '5' });
  assert.equal((await readSharedId()).state, 'SEALED');
  await asOwner();
}

async function verifyFormerMembership({ a, b }, worldId) {
  stage = 'former membership: after a real voluntary leave the World is no longer listed or enterable for the leaver';
  await asOwner(a);
  const [left] = await rows('SELECT outcome FROM public.commit_shared_world_standard_voluntary_leave_v1($1, $2, $3)', [randomUUID(), worldId, randomUUID()]);
  assert.equal(left.outcome, 'LEFT');
  await actAs('authenticated', a);
  assert.equal((await rows('SELECT * FROM public.list_own_shared_worlds_v1()')).length, 0);
  assert.equal((await rows('SELECT * FROM public.list_own_shared_world_members_v1()')).length, 0);
  assert.equal((await rows('SELECT * FROM public.resolve_own_shared_world_entry_v1($1)', [worldId]))[0].outcome, 'UNAVAILABLE');
  await actAs('authenticated', b);
  assert.deepEqual((await rows('SELECT * FROM public.list_own_shared_worlds_v1()')).map((w) => w.world_id), [worldId],
    'one active human remaining keeps a Shared World');
  assert.deepEqual((await rows('SELECT member_name, is_self FROM public.list_own_shared_world_members_v1()')),
    [{ member_name: 'Bassem Inviter', is_self: true }], 'a former member is not a current member');
  await asOwner();
}

// ------------------------------------------------------------------------------------------------------
// Stage 8 — concurrency on committed state.
// ------------------------------------------------------------------------------------------------------
async function waitUntilBlocked(pid) {
  for (let i = 0; i < 200; i += 1) {
    const [row] = await rows('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (row?.wait_event_type === 'Lock') return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('the second transaction never blocked on the first');
}

async function signUp(on, id, name, loginId) {
  await on.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  await on.query('UPDATE public.users SET name = $2, login_id = $3 WHERE id = $1', [id, name, loginId]);
}

async function verifyConcurrency() {
  const humans = Array.from({ length: 4 }, () => randomUUID());
  const [inviter, first, second, third] = humans;
  const suffix = randomUUID().slice(0, 8).replace(/[^a-z0-9]/gu, 'x');
  // The gate rows as they were, copied inside the database so no timestamp round-trips through JavaScript.
  await client.query('CREATE TEMP TABLE s401_prior_gate ON COMMIT PRESERVE ROWS AS SELECT * FROM shared_private.shared_launch_capability_states');
  const [{ priorGateRows }] = await rows('SELECT count(*)::int AS "priorGateRows" FROM s401_prior_gate');
  const [{ lastEvent }] = await rows('SELECT COALESCE(max(id), 0)::bigint AS "lastEvent" FROM shared_private.shared_launch_capability_events');
  const one = new Client({ connectionString: databaseUrl });
  const two = new Client({ connectionString: databaseUrl });
  await one.connect();
  await two.connect();
  try {
    stage = 'concurrency: committed fixtures';
    await client.query('BEGIN');
    await asOwner();
    for (const [i, id] of humans.entries()) await signUp(client, id, `Racer ${i}`, `s401racer${i}${suffix}`);
    await setGate('SHARED_DIRECT_INVITATION', 'ENABLED', 'SATISFIED');
    await setGate('SHARED_DIRECT_WORLD_BIRTH', 'ENABLED', 'SATISFIED');
    const ids = {};
    for (const target of [first, second, third]) {
      await actAs('authenticated', target);
      ids[target] = drawSharedId();
      await rotateSealed(randomUUID(), null, ids[target]);
      await actAs('authenticated', inviter);
      await submit(randomUUID(), ids[target]);
    }
    await asOwner();
    await client.query('COMMIT');
    const invitationOf = async (target) => (await pendingFor(target))[0].id;

    stage = 'concurrency: an emergency disable waits for the in-flight birth bound to the earlier snapshot';
    const [{ pid }] = await rows('SELECT pg_backend_pid() AS pid', [], two);
    await one.query('BEGIN');
    await actAs('authenticated', first, one);
    const inFlight = await accept(randomUUID(), await invitationOf(first), one);
    assert.equal(inFlight.outcome, 'BORN');
    await two.query('BEGIN');
    await asOwner(null, two);
    const disabling = setGate('SHARED_DIRECT_WORLD_BIRTH', 'EMERGENCY_DISABLED', 'SATISFIED', two);
    await waitUntilBlocked(pid);
    await one.query('COMMIT');
    await disabling;
    await two.query('COMMIT');
    await client.query('BEGIN');
    await actAs('authenticated', second);
    assert.deepEqual(await accept(randomUUID(), await invitationOf(second)), { outcome: 'UNAVAILABLE', world_id: null },
      'the next birth is refused by the new snapshot');
    await asOwner();
    await client.query('COMMIT');

    stage = 'concurrency: two identical acceptances birth one World';
    await client.query('BEGIN');
    await setGate('SHARED_DIRECT_WORLD_BIRTH', 'ENABLED', 'SATISFIED');
    await client.query('COMMIT');
    const target = await invitationOf(third);
    const command = randomUUID();
    const [{ pid: pidTwo }] = await rows('SELECT pg_backend_pid() AS pid', [], two);
    await one.query('BEGIN');
    await actAs('authenticated', third, one);
    const winner = await accept(command, target, one);
    await two.query('BEGIN');
    await actAs('authenticated', third, two);
    const loser = accept(command, target, two);
    await waitUntilBlocked(pidTwo);
    await one.query('COMMIT');
    assert.deepEqual(await loser, winner);
    await two.query('COMMIT');
    const [{ born }] = await rows('SELECT count(*)::int AS born FROM public.shared_world_direct_birth_events WHERE invitation_id = $1', [target]);
    assert.equal(born, 1);
  } finally {
    stage = 'concurrency: fixture removal';
    for (const extra of [one, two]) await extra.query('ROLLBACK').catch((error) => { if (error?.code !== '25P01') throw error; });
    await one.end();
    await two.end();
    await client.query('ROLLBACK').catch((error) => { if (error?.code !== '25P01') throw error; });
    await asOwner();
    const worldIds = (await rows('SELECT world_id FROM public.shared_world_membership_episodes WHERE user_id = ANY($1::uuid[])', [humans])).map((r) => r.world_id);
    await client.query('DELETE FROM shared_private.shared_direct_birth_launch_evidence WHERE world_id = ANY($1::uuid[])', [worldIds]);
    await client.query('DELETE FROM public.shared_world_direct_acceptance_commands WHERE world_id = ANY($1::uuid[])', [worldIds]);
    await client.query('DELETE FROM public.shared_world_direct_birth_events WHERE world_id = ANY($1::uuid[])', [worldIds]);
    await client.query('DELETE FROM public.shared_world_membership_episodes WHERE world_id = ANY($1::uuid[])', [worldIds]);
    await client.query('DELETE FROM public.shared_worlds WHERE id = ANY($1::uuid[])', [worldIds]);
    await client.query('DELETE FROM shared_private.shared_direct_invitation_decline_commands WHERE actor_user_id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM public.shared_world_invitation_commands WHERE actor_user_id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM public.shared_world_direct_invitations WHERE inviter_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM shared_private.shared_id_sealed_values WHERE user_id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM public.shared_world_invite_credential_state WHERE user_id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [humans]);
    // The gate goes back to exactly what it was before this stage.
    await client.query('DELETE FROM shared_private.shared_launch_capability_events WHERE id > $1', [lastEvent]);
    await client.query('DELETE FROM shared_private.shared_launch_capability_states s WHERE NOT EXISTS (SELECT 1 FROM s401_prior_gate p WHERE p.capability_scope = s.capability_scope)');
    await client.query(`UPDATE shared_private.shared_launch_capability_states s SET feature_flag_state = p.feature_flag_state,
      launch_requirements_state = p.launch_requirements_state, restriction_version = p.restriction_version, decided_by = p.decided_by,
      policy_basis = p.policy_basis, decided_at = p.decided_at FROM s401_prior_gate p WHERE p.capability_scope = s.capability_scope`);
    await client.query('DROP TABLE s401_prior_gate');
    const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM public.shared_world_invite_credential_state WHERE user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM shared_private.shared_id_sealed_values WHERE user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM public.shared_world_membership_episodes WHERE user_id = ANY($1::uuid[])) AS residue`, [humans]);
    assert.equal(Number(residue), 0, 'the committed fixtures are gone');
    const [{ gateRows }] = await rows('SELECT count(*)::int AS "gateRows" FROM shared_private.shared_launch_capability_states');
    assert.equal(gateRows, priorGateRows, 'the gate is restored');
  }
}

async function main() {
  try {
    await client.connect();
    await client.query('BEGIN');
    try {
      await verifyBoundary();
      stage = 'fixtures';
      const humans = { a: randomUUID(), b: randomUUID(), c: randomUUID() };
      const suffix = randomUUID().slice(0, 8).replace(/[^a-z0-9]/gu, 'x');
      await signUp(client, humans.a, 'Amal Invitee', `s401amal${suffix}`);
      await signUp(client, humans.b, 'Bassem Inviter', `s401bassem${suffix}`);
      await signUp(client, humans.c, 'Chadi Outsider', `s401chadi${suffix}`);
      await verifyClosedGate(humans);
      await verifyGateOperator();
      const values = await verifySharedId(humans);
      const invitationId = await verifyInvitation(humans, values);
      const worldId = await verifyBirth(humans, invitationId);
      await verifyReads(humans, worldId);
      await verifyDecline(humans, values);
      await verifyRegeneration(humans, values, worldId);
      await verifyFormerMembership(humans, worldId);
    } finally {
      await client.query('ROLLBACK');
    }
    await verifyConcurrency();
    console.log('Verified migration 0138: server-owned boundary, fail-closed Shared launch gate, sealed Shared ID with atomic rotation, non-enumerating invitation, decline, launch-gated atomic idempotent birth, Product-safe reads, former membership, concurrency.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Database verification failed at ${stage} (${code}). Connection details were suppressed.`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  process.exitCode = 1;
});
