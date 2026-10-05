// S4-03 — Shared Membership Lifecycle, Governance, Settings & Historical Access v1: the real-PostgreSQL verifier for
// migration 0140.
//
// It proves, against a fully migrated database:
//   1. the boundary: the 34 S4-03 definers are pinned SECURITY DEFINERs in `shared_private`; every exposed wrapper is
//      SECURITY INVOKER; `authenticated` executes exactly the 22 human commands; the twelve internal helpers are nobody's;
//      the server channel gains nothing; every frozen 0083–0088 core keeps its no-application-role ACL; no `commit_%`
//      name joins the T-03D census; the gate scope CHECK carries five scopes and no S4-03 scope is configured; the one
//      S4-03 table (the proposal origins) is RLS-on, policy-free, unreachable and keeps no Shared ID;
//   2. closed gate: with SHARED_GOVERNANCE / SHARED_HISTORY_ACCESS closed nothing is proposed, approved or widened, and
//      the capability hints are real FALSE booleans; voluntary leave is NOT held hostage by the ordinary gate;
//   3. unanimity (settings): any current member proposes; the proposal is no approval; every current member must approve;
//      every required member sees the proposer's Name, their OWN approval and the neutral progress — never who approved;
//      the satisfying approval commits the version — the settings apply once — and the World name becomes the label;
//      an unchanged version is UNCHANGED; a replay answers the committed request; non-members read nothing;
//   4. removal: the removal target never votes and is never shown the proposal to remove them; the target's episode
//      closes REMOVED; the target loses every read;
//   5. stale topology: a leave after a proposal stales it — no approval set carries over, the proposal disappears from
//      every list and a later approval is STALE; voluntary leave: LEFT, replay, foreign refusals, immediate loss of
//      access;
//   6. history widening: membership is not historical access; the candidates are exactly the human words the grantee
//      cannot see whose authority is resolved, one bounded keyset page at a time; unresolved material (QANDEEL output) is
//      never offered or packageable; the required approvers are the exact authors; each sees only their own words; the
//      completing approval commits the grant and the grantee then sees exactly the granted words;
//   6b. material authority survives membership: a former member's words are still offered; the former member — and only
//      that exact required approver — approves them through the account / privacy read (own words only), the grant
//      commits, and the former member still gets no World entry, browsing, members, settings or surrounding history;
//   6c. reachability by CURRENT Shared ID: every well-formed Shared ID gets the same SUBMITTED answer and nothing about
//      the target is ever returned; the current epoch succeeds (add: invitation → acceptance; rejoin: approval →
//      acceptance); a rotation before an approval answers STALE and records nothing; a rotation before the acceptance
//      makes the request non-actionable for good (no revival after further rotations); an old Shared ID opens nothing;
//      existing Worlds and memberships are unaffected by rotation; approvers never see the target's identity;
//   7. World end: unanimous; READ_ONLY_CLOSED; the closed-view entitlement is the members at closure only (a member
//      removed earlier is not restored); the entitled read; no ordinary act after closure; owner deletion after closure
//      unserves the body; the closed World is never an active World;
//   8. former member: the owner's own words in a World they no longer belong to, nothing else; deletion reuses the owner
//      authority and reopens nothing;
//   9. cross-World replay: the same command on another World, operation or request — and another human's command — is
//      one UNAVAILABLE; a foreign proposal / package is UNAVAILABLE;
//  10. non-null booleans: every Product-facing boolean of every S4-03 read is a real boolean;
//  11. concurrency on committed state: concurrent equivalent approvals record one approval; the satisfying approval and
//      a racing leave serialize on the World row (no deadlock); a leave that wins stales the proposal; a Shared-ID
//      rotation and the target's acceptance serialize on the credential row and the rotation that wins leaves the
//      acceptance UNAVAILABLE; unrelated Worlds stay concurrent.
//
// Stages 1–10 run inside one transaction that is rolled back. Stage 11 needs committed rows; its fixtures (and the gate
// rows it configured) are removed afterwards and the removal is checked.
import assert from 'node:assert/strict';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = [], on = client) => (await on.query(text, values)).rows;

/** Expect `operation` to be refused with one of `codes`. Must run inside an open transaction. */
async function rejected(operation, codes, on = client) {
  let refusal;
  await on.query('SAVEPOINT expected_refusal');
  try {
    await operation();
  } catch (error) {
    refusal = error;
  } finally {
    await on.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await on.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code}: ${refusal.message}`);
  return refusal;
}

/** A principal acting through the Data API: role `authenticated` with that human's claims, or `service_role` with none. */
async function actAs(role, userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role } : { role })]);
}

/** The database owner (operator / fixture setup), optionally carrying a human's claims. */
async function asOwner(userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId } : {})]);
}

const digest = (text) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
/** The frozen I-03G readiness fingerprint, reproduced from its own definition (the core recomputes it). */
const readinessRef = (e) => `sha256:${createHash('sha256').update([
  'QANDEEL_CWV2_SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_V1',
  `effectiveContext=${e.effectiveContextRef}`, `output=${e.outputDigest}`,
  `sourceDisclosureGate=${e.sourceDisclosureGateRef}`, `authorityRevalidation=${e.authorityRevalidationRef}`,
].join('\n'), 'utf8').digest('hex')}`;
/** The frozen I-03D audience fingerprint of a World's CURRENT audience (per user AND episode; carries the World). */
async function audienceRef(worldId) {
  await asOwner();
  const members = await rows('SELECT user_id, membership_episode_id FROM public.resolve_shared_world_human_audience_snapshot_v1($1)', [worldId]);
  const byCodeUnit = (l, r) => (l < r ? -1 : l > r ? 1 : 0);
  const rendered = members.map((m) => ({ user: String(m.user_id).toLowerCase(), episode: String(m.membership_episode_id).toLowerCase() }))
    .sort((l, r) => byCodeUnit(l.user, r.user) || byCodeUnit(l.episode, r.episode)).map((m) => `${m.user}@${m.episode}`).join(',');
  return `sha256:${createHash('sha256').update(['QANDEEL_CWV2_SHARED_HUMAN_AUDIENCE_SNAPSHOT_V1', 'state=RESOLVED',
    `world=${String(worldId).toLowerCase()}`, `members=${rendered}`].join('\n'), 'utf8').digest('hex')}`;
}
function evidenceFor(body, audienceSnapshotRef) {
  const e = { effectiveContextRef: `ec:s403:${randomUUID()}`, outputDigest: digest(body), sourceDisclosureGateRef: `gate:s403:${randomUUID()}`,
    authorityRevalidationRef: `rev:s403:${randomUUID()}`, audienceSnapshotRef };
  return { ...e, readiness: readinessRef(e) };
}

// --- S4-03 human commands -------------------------------------------------------------------------------------------
const first = async (sql, values, on = client) => (await rows(sql, values, on))[0];
const capabilities = async () => first('SELECT * FROM public.read_shared_governance_capabilities_v1()', []);
const names = async () => rows('SELECT * FROM public.list_own_shared_world_names_v1()', []);
const settings = async (worldId) => rows('SELECT * FROM public.read_own_shared_world_settings_v1($1::uuid)', [worldId]);
const members = async (worldId) => rows('SELECT * FROM public.list_own_shared_world_member_handles_v1($1::uuid)', [worldId]);
const proposals = async (worldId) => rows('SELECT * FROM public.list_own_shared_world_proposals_v1($1::uuid)', [worldId]);
const candidates = async (worldId, handle, limit = 100, before = null) =>
  rows('SELECT * FROM public.list_own_shared_history_share_candidates_v1($1::uuid, $2::uuid, $3::timestamptz, $4::uuid, $5::integer)',
    [worldId, handle, before ? before.established_at : null, before ? before.material_id : null, limit]);
const formerRequests = async () => rows('SELECT * FROM public.list_own_former_shared_history_share_requests_v1()', []);
const membershipRequests = async () => rows('SELECT * FROM public.list_own_shared_membership_requests_v1()', []);
const proposeMember = async (commandId, worldId, sharedId) =>
  rows('SELECT * FROM public.propose_shared_world_member_v1($1::uuid, $2::uuid, $3::text)', [commandId, worldId, sharedId]);
const acceptRequest = async (commandId, worldId, requestId, on = client) =>
  (await first('SELECT * FROM public.accept_shared_membership_request_v1($1::uuid, $2::uuid, $3::uuid)', [commandId, worldId, requestId], on)).outcome;
const requests = async (worldId) => rows('SELECT * FROM public.list_own_shared_history_share_requests_v1($1::uuid)', [worldId]);
const closedWorlds = async () => rows('SELECT * FROM public.list_own_closed_shared_worlds_v1()', []);
const closedMembers = async () => rows('SELECT * FROM public.list_own_closed_shared_world_members_v1()', []);
const closedMaterial = async (worldId, limit = 50) =>
  rows('SELECT * FROM public.list_own_closed_shared_world_material_v1($1::uuid, $2::timestamptz, $3::uuid, $4::integer)', [worldId, null, null, limit]);
const formerMaterial = async (limit = 50) =>
  rows('SELECT * FROM public.list_own_former_shared_world_material_v1($1::timestamptz, $2::uuid, $3::integer)', [null, null, limit]);
const leave = async (commandId, worldId, on = client) => (await first('SELECT * FROM public.leave_shared_world_v1($1::uuid, $2::uuid)', [commandId, worldId], on)).outcome;
const proposeSettings = async (commandId, worldId, name, description = null, topic = null) =>
  first('SELECT * FROM public.propose_shared_world_settings_v1($1::uuid, $2::uuid, $3::text, $4::text, $5::text)', [commandId, worldId, name, description, topic]);
const proposeRemoval = async (commandId, worldId, handle) =>
  first('SELECT * FROM public.propose_shared_world_member_removal_v1($1::uuid, $2::uuid, $3::uuid)', [commandId, worldId, handle]);
const proposeEnd = async (commandId, worldId) => first('SELECT * FROM public.propose_shared_world_end_v1($1::uuid, $2::uuid)', [commandId, worldId]);
const approve = async (commandId, worldId, proposalId, on = client) =>
  (await first('SELECT * FROM public.approve_shared_world_proposal_v1($1::uuid, $2::uuid, $3::uuid)', [commandId, worldId, proposalId], on)).outcome;
const proposeShare = async (commandId, worldId, handle, materialIds) =>
  first('SELECT * FROM public.propose_shared_world_history_share_v1($1::uuid, $2::uuid, $3::uuid, $4::uuid[])', [commandId, worldId, handle, materialIds]);
const approveShare = async (commandId, worldId, packageId) =>
  (await first('SELECT * FROM public.approve_shared_world_history_share_v1($1::uuid, $2::uuid, $3::uuid)', [commandId, worldId, packageId])).outcome;
// --- the S4-01 / S4-02 commands S4-03 composes with -------------------------------------------------------------------
const entry = async (worldId) => (await first('SELECT * FROM public.resolve_own_shared_world_entry_v1($1::uuid)', [worldId])).outcome;
const send = async (commandId, worldId, content) => first('SELECT * FROM public.send_shared_world_human_text_v1($1::uuid, $2::uuid, $3::text)', [commandId, worldId, content]);
const listMaterial = async (worldId) =>
  rows('SELECT * FROM public.list_own_shared_world_material_v1($1::uuid, $2::timestamptz, $3::uuid, $4::integer)', [worldId, null, null, 50]);
const deleteOwn = async (commandId, worldId, materialId) =>
  (await first('SELECT * FROM public.delete_own_shared_world_material_v1($1::uuid, $2::uuid, $3::uuid)', [commandId, worldId, materialId])).outcome;
const setGate = async (scope, flag, requirements, on = client) =>
  first('SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)', [scope, flag, requirements, 's4-03-verifier', 'verification fixture'], on);

/** A canonical Shared ID, exactly as the server draws one (12 characters of the 0129 alphabet, grouped by four). */
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
/** Gives (or rotates) a human's Shared ID through the frozen 0081 rotation; returns the new canonical value. */
async function giveSharedId(user, on = client) {
  await asOwner(null, on);
  const [state] = await rows('SELECT epoch FROM public.shared_world_invite_credential_state WHERE user_id = $1', [user], on);
  const canonical = drawSharedId();
  await asOwner(user, on);
  await rows('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, $3)', [randomUUID(), refOf(canonical), state ? state.epoch : null], on);
  await asOwner(null, on);
  return canonical;
}
const proposalCount = async (worldId) => {
  await asOwner();
  return Number((await first('SELECT count(*)::int AS n FROM public.shared_world_governance_proposals WHERE world_id = $1', [worldId])).n);
};

/** Every boolean column of every row is a real boolean (never NULL). */
function realBooleans(list, columns, what) {
  for (const row of list) for (const column of columns) assert.equal(typeof row[column], 'boolean', `${what}.${column} is a real boolean`);
}

async function signUp(on, id, name, loginId) {
  await on.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  await on.query('UPDATE public.users SET name = $2, login_id = $3 WHERE id = $1', [id, name, loginId]);
}

/** A born ACTIVE / STANDARD World through the frozen 0081 / 0082 primitives, driven as the owner with the exact human's claims. */
async function bornWorld(inviter, target, on = client) {
  await asOwner(null, on);
  const [state] = await rows('SELECT epoch FROM public.shared_world_invite_credential_state WHERE user_id = $1', [target], on);
  const ref = `sid1:${createHash('sha256').update(randomUUID(), 'utf8').digest('hex')}`;
  await asOwner(target, on);
  await rows('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, $3)', [randomUUID(), ref, state ? state.epoch : null], on);
  await asOwner(inviter, on);
  const invitationId = randomUUID();
  await rows('SELECT * FROM public.submit_shared_world_direct_invitation_v1($1, $2, $3)', [randomUUID(), invitationId, ref], on);
  await asOwner(target, on);
  const worldId = randomUUID();
  const [born] = await rows('SELECT outcome FROM public.commit_shared_world_direct_acceptance_birth_v1($1, $2, $3, $4, $5)',
    [randomUUID(), invitationId, worldId, randomUUID(), randomUUID()], on);
  assert.equal(born.outcome, 'BORN');
  await asOwner(null, on);
  return worldId;
}

/**
 * A governed add-member through the frozen 0085 cores, driven as the owner with each exact human's claims — fixture
 * construction only (S4-03 exposes no add-member Product path: it waits on the Product Owner).
 */
async function addMember(worldId, newcomer, current, on = client) {
  await asOwner(null, on);
  const proposal = randomUUID();
  const [prepared] = await rows('SELECT outcome FROM public.prepare_shared_world_add_member_governance_v1($1, $2, $3, $4, $5)',
    [proposal, randomUUID(), randomUUID(), worldId, newcomer], on);
  assert.equal(prepared.outcome, 'PREPARED');
  for (const human of current) {
    await asOwner(human, on);
    await rows('SELECT outcome FROM public.commit_shared_world_governance_approval_v1($1, $2)', [randomUUID(), proposal], on);
  }
  await asOwner(null, on);
  const invitation = randomUUID();
  await rows('SELECT outcome FROM public.dispatch_shared_world_member_invitation_v1($1, $2)', [invitation, proposal], on);
  await asOwner(newcomer, on);
  const [joined] = await rows('SELECT outcome FROM public.accept_shared_world_member_invitation_v1($1, $2, $3, $4)',
    [randomUUID(), invitation, randomUUID(), randomUUID()], on);
  assert.equal(joined.outcome, 'JOINED');
  // The acceptance's deferred episode binding is checked now, then deferral is restored for the next acceptance.
  await asOwner(null, on);
  await on.query('SET CONSTRAINTS ALL IMMEDIATE');
  await on.query('SET CONSTRAINTS ALL DEFERRED');
}

/** A QANDEEL reply to one committed human command, through the S4-02 server path under its work lease. */
async function qandeelReply(requester, humanCommandId, worldId, body) {
  const e = evidenceFor(body, await audienceRef(worldId));
  await actAs('service_role');
  const [work] = await rows('SELECT * FROM public.begin_shared_qandeel_reply_work_v1($1, $2, $3)', [humanCommandId, worldId, requester]);
  assert.equal(work.work_outcome, 'GRANTED');
  const [done] = await rows('SELECT * FROM public.complete_shared_world_qandeel_reply_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
    [work.work_lease_id, humanCommandId, worldId, body, e.effectiveContextRef, e.outputDigest, e.sourceDisclosureGateRef, e.authorityRevalidationRef,
      e.readiness, e.audienceSnapshotRef, [], []]);
  assert.equal(done.outcome, 'MATERIAL_COMMITTED');
  await asOwner();
  return done.material_id;
}

const handleOf = async (worldId, reader, name) => {
  await actAs('authenticated', reader);
  const row = (await members(worldId)).find((m) => m.member_name === name);
  assert.ok(row, `${name} is a current member seen by the reader`);
  return row.member_handle;
};

const INTERNAL = ['derive_shared_lifecycle_identity_v1', 'shared_member_handle_v1', 'shared_lifecycle_command_family_v1',
  'is_current_shared_member_v1', 'is_current_shared_proposal_topology_v1', 'is_committed_shared_proposal_v1',
  'shared_history_share_candidates_v1', 'shared_proposal_replay_matches_v1', 'shared_proposal_progress_v1',
  'shared_reachability_target_v1', 'is_actionable_shared_reachability_v1', 'record_shared_proposal_origin_v1'];
const HUMAN = ['read_shared_governance_capabilities_v1', 'list_own_shared_world_names_v1', 'read_own_shared_world_settings_v1',
  'list_own_shared_world_member_handles_v1', 'list_own_shared_world_proposals_v1', 'list_own_shared_history_share_candidates_v1',
  'list_own_shared_history_share_requests_v1', 'list_own_closed_shared_worlds_v1', 'list_own_closed_shared_world_members_v1',
  'list_own_closed_shared_world_material_v1', 'list_own_former_shared_world_material_v1',
  'list_own_former_shared_history_share_requests_v1', 'list_own_shared_membership_requests_v1', 'leave_shared_world_v1',
  'propose_shared_world_settings_v1', 'propose_shared_world_member_removal_v1', 'propose_shared_world_end_v1',
  'approve_shared_world_proposal_v1', 'propose_shared_world_member_v1', 'accept_shared_membership_request_v1',
  'propose_shared_world_history_share_v1', 'approve_shared_world_history_share_v1'];
const FROZEN_CORES = [
  'public.commit_shared_world_standard_voluntary_leave_v1(uuid,uuid,uuid)',
  'public.capture_shared_world_governance_proposal_v1(uuid,uuid,uuid,text,uuid,text,uuid)',
  'public.commit_shared_world_governance_approval_v1(uuid,uuid)',
  'public.resolve_shared_world_governance_approval_v1(uuid,text,uuid)',
  'public.prepare_shared_world_add_member_governance_v1(uuid,uuid,uuid,uuid,uuid)',
  'public.prepare_shared_world_remove_member_governance_v1(uuid,uuid,uuid,uuid,uuid)',
  'public.prepare_shared_world_rejoin_governance_v1(uuid,uuid,uuid,uuid,uuid)',
  'public.dispatch_shared_world_member_invitation_v1(uuid,uuid)',
  'public.accept_shared_world_member_invitation_v1(uuid,uuid,uuid,uuid)',
  'public.commit_shared_world_member_removal_v1(uuid,uuid,uuid)',
  'public.commit_shared_world_member_rejoin_v1(uuid,uuid,uuid,uuid)',
  'public.prepare_shared_world_settings_change_governance_v1(uuid,uuid,uuid,uuid,text,text,text,text)',
  'public.commit_shared_world_settings_change_v1(uuid,uuid,uuid)',
  'public.prepare_shared_world_history_package_v1(uuid,uuid,uuid,uuid[])',
  'public.commit_shared_world_history_package_approval_v1(uuid,uuid)',
  'public.commit_shared_world_history_access_grant_v1(uuid,uuid,uuid,uuid)',
  'public.prepare_shared_world_standard_end_governance_v1(uuid,uuid,uuid,uuid)',
  'public.commit_shared_world_standard_end_v1(uuid,uuid,uuid)',
  'public.resolve_shared_world_closed_history_visibility_v1(uuid,uuid)',
];

// ------------------------------------------------------------------------------------------------------
// Stage 1 — the boundary.
// ------------------------------------------------------------------------------------------------------
async function verifyBoundary() {
  stage = 'boundary: the S4-03 definers are pinned; the wrappers are INVOKER';
  const privateFns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'shared_private' AND p.proname = ANY($1::text[]) ORDER BY 1`,
  [[...INTERNAL, ...HUMAN]]);
  assert.deepEqual(privateFns.map((f) => f.proname).sort(), [...INTERNAL, ...HUMAN].sort());
  for (const f of privateFns) {
    assert.equal(f.prosecdef, true, `shared_private.${f.proname} is SECURITY DEFINER`);
    assert.equal(f.owner, 'postgres');
    assert.ok((f.proconfig ?? []).includes('search_path=""'), `shared_private.${f.proname} pins an empty search_path`);
  }
  const publicFns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY($1::text[]) ORDER BY 1`, [[...INTERNAL, ...HUMAN]]);
  assert.deepEqual(publicFns.map((f) => f.proname).sort(), [...HUMAN].sort(), 'no internal helper is exposed');
  for (const f of publicFns) {
    assert.equal(f.prosecdef, false, `public.${f.proname} is SECURITY INVOKER`);
    assert.ok((f.proconfig ?? []).includes('search_path=""'));
  }

  stage = 'boundary: authenticated runs exactly the 22 human commands; the helpers and the server channel run nothing';
  const executable = await rows(`SELECT r.rolname, n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role'), ('public')) AS r(rolname)
    WHERE ((n.nspname = 'shared_private' AND p.proname = ANY($1::text[])) OR (n.nspname = 'public' AND p.proname = ANY($2::text[])))
      AND (r.rolname = 'public' OR EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2, 3`, [[...INTERNAL, ...HUMAN], HUMAN]);
  const key = (r) => `${r.rolname} ${r.nspname}.${r.proname}`;
  assert.deepEqual(executable.map(key).sort(), [
    ...HUMAN.map((proname) => key({ rolname: 'authenticated', nspname: 'public', proname })),
    ...HUMAN.map((proname) => key({ rolname: 'authenticated', nspname: 'shared_private', proname })),
  ].sort());
  for (const fn of FROZEN_CORES) {
    for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, fn, 'EXECUTE']);
      assert.equal(allowed, false, `${role} must not execute ${fn}`);
    }
  }
  // The T-03D single-committing-authority census is untouched.
  const committing = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'commit\\_%' AND has_function_privilege('service_role', p.oid, 'EXECUTE') ORDER BY 1`);
  assert.deepEqual(committing.map((r) => r.proname), ['commit_finalized_exchange_with_full_semantic_chain_v1']);
  // The server channel still reaches exactly the three S4-02 reply-work commands in shared_private.
  const serverReach = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'shared_private' AND has_function_privilege('service_role', p.oid, 'EXECUTE') ORDER BY 1`);
  assert.deepEqual(serverReach.map((r) => r.proname),
    ['begin_shared_qandeel_reply_work_v1', 'complete_shared_world_qandeel_reply_v1', 'end_shared_qandeel_reply_work_v1']);

  stage = 'boundary: the one S4-03 table is RLS-on, policy-free, unreachable and keeps no Shared ID';
  const [origins] = await rows(`SELECT c.relrowsecurity, (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS policies
    FROM pg_class c WHERE c.oid = 'shared_private.shared_governance_proposal_origins'::regclass`);
  assert.deepEqual(origins, { relrowsecurity: true, policies: 0 });
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const [{ reach }] = await rows('SELECT has_table_privilege($1, $2, $3) AS reach',
      [role, 'shared_private.shared_governance_proposal_origins', 'SELECT,INSERT,UPDATE,DELETE']);
    assert.equal(reach, false, `${role} cannot reach the proposal origins`);
  }
  const [{ clearColumns }] = await rows(`SELECT count(*)::int AS "clearColumns" FROM information_schema.columns
    WHERE table_schema = 'shared_private' AND column_name ~* '(shared_id|plaintext|clear)'`);
  assert.equal(clearColumns, 0, 'no shared_private column holds a Shared ID in clear');

  stage = 'boundary: the gate scope CHECK carries five scopes and no S4-03 scope is configured by a migration';
  const [{ def }] = await rows(`SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
    WHERE c.conrelid = 'shared_private.shared_launch_capability_states'::regclass AND c.conname = 'shared_launch_capability_states_scope_check'`);
  for (const scope of ['SHARED_DIRECT_INVITATION', 'SHARED_DIRECT_WORLD_BIRTH', 'SHARED_CONVERSATION', 'SHARED_GOVERNANCE', 'SHARED_HISTORY_ACCESS']) {
    assert.ok(def.includes(scope), def);
  }
  const [{ configured }] = await rows(`SELECT count(*)::int AS configured FROM shared_private.shared_launch_capability_states
    WHERE capability_scope IN ('SHARED_GOVERNANCE', 'SHARED_HISTORY_ACCESS')`);
  assert.equal(configured, 0);
  await rejected(() => setGate('SHARED_ADD_EVERYONE', 'ENABLED', 'SATISFIED'), ['23514']);

  stage = 'boundary: the derived identities and member handles are deterministic, namespaced and never a client\'s to choose';
  const command = randomUUID();
  const [derived] = await rows(`SELECT shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL', $1) AS a,
    shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL', $1) AS b,
    shared_private.derive_shared_lifecycle_identity_v1('APPROVAL', $1) AS c,
    shared_private.shared_member_handle_v1($2::uuid, $3::uuid) AS h1, shared_private.shared_member_handle_v1($4::uuid, $3::uuid) AS h2`,
  [command, randomUUID(), randomUUID(), randomUUID()]);
  assert.equal(derived.a, derived.b);
  assert.notEqual(derived.a, derived.c);
  assert.notEqual(derived.h1, derived.h2, 'one human has a different handle in every World');
  for (const role of ['authenticated', 'service_role']) {
    await actAs(role, role === 'authenticated' ? randomUUID() : null);
    await rejected(() => rows("SELECT shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL', 'x')"), ['42501']);
    await rejected(() => rows('SELECT shared_private.shared_member_handle_v1($1::uuid, $2::uuid)', [randomUUID(), randomUUID()]), ['42501']);
  }
  await asOwner();
}

// ------------------------------------------------------------------------------------------------------
// Stages 2–10 — behaviour, inside one rolled-back transaction.
// ------------------------------------------------------------------------------------------------------
async function verifyClosedGate(h, w) {
  stage = 'closed gate: nothing is proposed, approved or widened while the governance and history scopes are closed';
  // The fixture's governed addMember already left a legitimate proposal in w.one; the closed gate must add none.
  const baseline = await proposalCount(w.one);
  await actAs('authenticated', h.a);
  assert.deepEqual(await capabilities(), { governance_available: false, history_available: false });
  assert.deepEqual(await proposeSettings(randomUUID(), w.one, 'Closed name'), { outcome: 'UNAVAILABLE', proposal_id: null });
  assert.deepEqual(await proposeEnd(randomUUID(), w.one), { outcome: 'UNAVAILABLE', proposal_id: null });
  const handle = await handleOf(w.one, h.a, 'Bassem Two');
  await actAs('authenticated', h.a);
  assert.deepEqual(await proposeRemoval(randomUUID(), w.one, handle), { outcome: 'UNAVAILABLE', proposal_id: null });
  assert.deepEqual(await proposeShare(randomUUID(), w.one, handle, [randomUUID()]), { outcome: 'UNAVAILABLE', package_id: null });
  assert.deepEqual(await proposeMember(randomUUID(), w.one, drawSharedId()), [{ outcome: 'UNAVAILABLE' }]);
  assert.equal(await acceptRequest(randomUUID(), w.one, randomUUID()), 'UNAVAILABLE');
  for (const [flag, requirements] of [['DISABLED', 'SATISFIED'], ['ENABLED', 'UNKNOWN'], ['INTERNAL', 'SATISFIED'],
    ['LIMITED_ROLLOUT', 'SATISFIED'], ['EMERGENCY_DISABLED', 'SATISFIED']]) {
    await asOwner();
    await setGate('SHARED_GOVERNANCE', flag, requirements);
    await setGate('SHARED_HISTORY_ACCESS', flag, requirements);
    await actAs('authenticated', h.b);
    assert.equal((await proposeEnd(randomUUID(), w.one)).outcome, 'UNAVAILABLE', `${flag} / ${requirements} denies`);
    assert.deepEqual(await capabilities(), { governance_available: false, history_available: false });
  }
  assert.equal(await proposalCount(w.one), baseline, 'the closed gate wrote no new proposal');
  await actAs('authenticated', h.c);
  await rejected(() => setGate('SHARED_GOVERNANCE', 'ENABLED', 'SATISFIED'), ['42501']);
  await asOwner();
}

async function verifySettings(h, w) {
  stage = 'unanimity: the gate opens; any current member proposes; the proposal is no approval';
  await asOwner();
  await setGate('SHARED_GOVERNANCE', 'ENABLED', 'SATISFIED');
  await actAs('authenticated', h.a);
  assert.deepEqual(await capabilities(), { governance_available: true, history_available: false });
  assert.deepEqual(await settings(w.one), [{ world_name: null, world_description: null, world_topic: null }], 'nothing committed: the neutral default');
  assert.deepEqual(await proposeSettings(randomUUID(), w.one, '   ', '', null), { outcome: 'UNCHANGED', proposal_id: null }, 'an unchanged version proposes nothing');
  await rejected(() => proposeSettings(randomUUID(), w.one, 'x'.repeat(81)), ['22023']);
  const command = randomUUID();
  const proposed = await proposeSettings(command, w.one, '  Our Lantern  ', 'A calm place', 'Weekend plans');
  assert.equal(proposed.outcome, 'PROPOSED');
  const proposalId = proposed.proposal_id;
  for (const reader of [h.a, h.b, h.c]) {
    await actAs('authenticated', reader);
    const list = await proposals(w.one);
    realBooleans(list, ['approved_by_self', 'proposer_is_self'], 'proposal');
    assert.deepEqual(Object.keys(list[0]).sort(), ['approved_by_self', 'approved_count', 'created_at', 'operation_kind', 'proposal_id',
      'proposed_description', 'proposed_name', 'proposed_topic', 'proposer_is_self', 'proposer_name', 'required_count', 'target_name'],
    'no approver list: the proposer, the reader\'s own approval and the neutral progress only');
    assert.deepEqual(list.map((p) => [p.proposal_id, p.operation_kind, p.proposed_name, p.proposed_description, p.proposed_topic, p.approved_by_self,
      p.target_name, p.proposer_name, p.proposer_is_self, p.approved_count, p.required_count]),
    [[proposalId, 'WORLD_SETTINGS_CHANGE', 'Our Lantern', 'A calm place', 'Weekend plans', false, null, 'Amal One', reader === h.a, 0, 3]],
    'every required member sees it, the proposer too');
    assert.deepEqual(await settings(w.one), [{ world_name: null, world_description: null, world_topic: null }], 'nothing applied before unanimity');
  }
  await actAs('authenticated', h.x);
  assert.deepEqual(await proposals(w.one), [], 'a non-member reads nothing');
  assert.deepEqual(await settings(w.one), []);

  stage = 'unanimity: every current member approves; the satisfying approval applies the version — the settings apply once';
  const approvals = { a: randomUUID(), b: randomUUID(), c: randomUUID() };
  await actAs('authenticated', h.a);
  assert.equal(await approve(approvals.a, w.one, proposalId), 'APPROVED');
  assert.equal((await proposals(w.one))[0].approved_by_self, true);
  assert.deepEqual((await proposals(w.one)).map((p) => [p.approved_count, p.required_count]), [[1, 3]], 'the proposer approved separately: 1 / 3');
  assert.equal(await approve(approvals.a, w.one, proposalId), 'APPROVED', 'a retry of the same approval is the same answer');
  assert.equal(await approve(randomUUID(), w.one, proposalId), 'APPROVED', 'this human already approved: no second effective approval');
  await actAs('authenticated', h.b);
  assert.equal(await approve(approvals.b, w.one, proposalId), 'APPROVED');
  await actAs('authenticated', h.c);
  assert.deepEqual((await proposals(w.one)).map((p) => [p.approved_by_self, p.approved_count, p.required_count]), [[false, 2, 3]],
    'a member who has not approved sees 2 / 3 and never who approved');
  await actAs('authenticated', h.x);
  assert.equal(await approve(randomUUID(), w.one, proposalId), 'UNAVAILABLE', 'a non-member cannot approve');
  await actAs('authenticated', h.c);
  assert.equal(await approve(approvals.c, w.one, proposalId), 'COMMITTED');
  assert.deepEqual(await settings(w.one), [{ world_name: 'Our Lantern', world_description: 'A calm place', world_topic: 'Weekend plans' }]);
  assert.deepEqual(await names(), [{ world_id: w.one, world_name: 'Our Lantern' }], 'the committed name is the World label');
  assert.deepEqual(await proposals(w.one), [], 'a committed proposal waits on nobody');
  assert.equal(await approve(approvals.c, w.one, proposalId), 'COMMITTED', 'replay answers the committed operation');
  await actAs('authenticated', h.a);
  assert.equal(await approve(approvals.a, w.one, proposalId), 'COMMITTED');
  await asOwner();
  const [{ changes }] = await rows('SELECT count(*)::int AS changes FROM public.shared_world_settings_change_commands WHERE world_id = $1', [w.one]);
  assert.equal(changes, 1, 'the settings apply once');
  await actAs('authenticated', h.d);
  assert.deepEqual(await names(), [], 'another World\'s member does not see this name');

  stage = 'cross-World replay: the same command on another World, operation or request — or another human\'s — is UNAVAILABLE';
  await actAs('authenticated', h.a);
  assert.deepEqual(await proposeSettings(command, w.one, 'Our Lantern', 'A calm place', 'Weekend plans'), { outcome: 'PROPOSED', proposal_id: proposalId },
    'the exact request replays');
  assert.deepEqual(await proposeSettings(command, w.one, 'Another name', 'A calm place', 'Weekend plans'), { outcome: 'UNAVAILABLE', proposal_id: null },
    'the same command with different values');
  assert.equal((await proposeEnd(command, w.one)).outcome, 'UNAVAILABLE', 'the same command for another operation');
  assert.equal(await leave(command, w.one), 'UNAVAILABLE', 'the same command for another family');
  await actAs('authenticated', h.d);
  assert.deepEqual(await proposeSettings(command, w.two, 'Our Lantern', 'A calm place', 'Weekend plans'), { outcome: 'UNAVAILABLE', proposal_id: null },
    'the same command on another World');
  assert.equal(await approve(approvals.c, w.two, proposalId), 'UNAVAILABLE', 'a foreign proposal through another World\'s route');
  assert.equal(await approve(randomUUID(), w.two, proposalId), 'UNAVAILABLE');
  assert.equal(await approve(randomUUID(), w.one, randomUUID()), 'UNAVAILABLE', 'an unknown proposal');
  await actAs('authenticated', h.b);
  assert.equal(await approve(approvals.c, w.one, proposalId), 'UNAVAILABLE', 'another human\'s approval command is not this human\'s replay');
  await asOwner();
}

async function verifyRemoval(h, w) {
  stage = 'removal: the removal target never votes and is never shown the proposal to remove them';
  const handleC = await handleOf(w.one, h.a, 'Chadi Three');
  const handleA = await handleOf(w.one, h.a, 'Amal One');
  await actAs('authenticated', h.a);
  assert.deepEqual(await proposeRemoval(randomUUID(), w.one, handleA), { outcome: 'UNAVAILABLE', proposal_id: null }, 'one\'s own removal is a leave');
  assert.deepEqual(await proposeRemoval(randomUUID(), w.one, randomUUID()), { outcome: 'UNAVAILABLE', proposal_id: null }, 'an unknown handle');
  const handleCElsewhere = await handleOf(w.two, h.d, 'Dalia Four');
  await actAs('authenticated', h.a);
  assert.equal((await proposeRemoval(randomUUID(), w.one, handleCElsewhere)).outcome, 'UNAVAILABLE', 'another World\'s handle resolves to nobody here');
  const command = randomUUID();
  const proposed = await proposeRemoval(command, w.one, handleC);
  assert.equal(proposed.outcome, 'PROPOSED');
  assert.deepEqual(await proposeRemoval(command, w.one, handleC), proposed, 'the exact request replays');
  assert.equal((await proposeRemoval(command, w.one, handleA)).outcome, 'UNAVAILABLE', 'the same command for another target');
  await actAs('authenticated', h.b);
  assert.deepEqual((await proposals(w.one)).map((p) => [p.operation_kind, p.target_name, p.proposer_name, p.approved_count, p.required_count]),
    [['REMOVE_MEMBER', 'Chadi Three', 'Amal One', 0, 2]], 'ALL_CURRENT_MEMBERS_EXCEPT(target): the target is named, never counted');
  await actAs('authenticated', h.c);
  assert.deepEqual(await proposals(w.one), [], 'the target is not shown the proposal to remove them');
  assert.equal(await approve(randomUUID(), w.one, proposed.proposal_id), 'UNAVAILABLE', 'the removal target never votes');
  await actAs('authenticated', h.a);
  assert.equal(await approve(randomUUID(), w.one, proposed.proposal_id), 'APPROVED');
  await actAs('authenticated', h.b);
  assert.equal(await approve(randomUUID(), w.one, proposed.proposal_id), 'COMMITTED', 'ALL_CURRENT_MEMBERS_EXCEPT(target)');
  await asOwner();
  const [episode] = await rows(`SELECT end_reason FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2`, [w.one, h.c]);
  assert.equal(episode.end_reason, 'REMOVED');
  await actAs('authenticated', h.c);
  assert.equal(await entry(w.one), 'UNAVAILABLE', 'the target loses current access at commit');
  assert.deepEqual(await members(w.one), []);
  assert.deepEqual(await settings(w.one), []);
  assert.deepEqual(await listMaterial(w.one), []);
  await asOwner();
}

async function verifyStaleAndLeave(h, w) {
  stage = 'stale topology: a leave after a proposal stales it; no approval set carries over';
  await actAs('authenticated', h.f);
  const proposed = await proposeSettings(randomUUID(), w.three, 'Before the leave');
  assert.equal(proposed.outcome, 'PROPOSED');
  assert.equal(await approve(randomUUID(), w.three, proposed.proposal_id), 'APPROVED');
  // Voluntary leave is NOT held hostage by the ordinary governance gate.
  await asOwner();
  await setGate('SHARED_GOVERNANCE', 'EMERGENCY_DISABLED', 'SATISFIED');
  await actAs('authenticated', h.h);
  const leaveCommand = randomUUID();
  assert.equal(await leave(leaveCommand, w.three), 'LEFT', 'voluntary leave under a closed governance gate');
  await asOwner();
  await setGate('SHARED_GOVERNANCE', 'ENABLED', 'SATISFIED');
  for (const reader of [h.f, h.g]) {
    await actAs('authenticated', reader);
    assert.deepEqual(await proposals(w.three), [], 'a stale proposal waits on nobody');
  }
  await actAs('authenticated', h.g);
  assert.equal(await approve(randomUUID(), w.three, proposed.proposal_id), 'STALE', 'stale governance refuses');
  await asOwner();
  const [{ changes }] = await rows('SELECT count(*)::int AS changes FROM public.shared_world_settings_change_commands WHERE world_id = $1', [w.three]);
  assert.equal(changes, 0);

  stage = 'voluntary leave: LEFT, idempotent, exact-World bound; access ends immediately';
  await actAs('authenticated', h.h);
  assert.equal(await leave(leaveCommand, w.three), 'LEFT', 'same command, same World: the committed result');
  assert.equal(await leave(leaveCommand, w.two), 'UNAVAILABLE', 'same command, another World: no cross-World replay');
  assert.equal(await leave(randomUUID(), w.three), 'UNAVAILABLE', 'a former member cannot leave again');
  assert.equal(await entry(w.three), 'UNAVAILABLE');
  assert.deepEqual(await members(w.three), []);
  assert.deepEqual(await proposals(w.three), []);
  await actAs('authenticated', h.g);
  assert.equal(await leave(leaveCommand, w.three), 'UNAVAILABLE', 'another human\'s leave command');
  await actAs('authenticated', h.x);
  assert.equal(await leave(randomUUID(), w.three), 'UNAVAILABLE', 'a non-member');
  assert.equal(await leave(randomUUID(), randomUUID()), 'UNAVAILABLE', 'an unknown World');
  await asOwner();
  const [{ left }] = await rows(`SELECT count(*)::int AS left FROM public.shared_world_membership_episodes
    WHERE world_id = $1 AND user_id = $2 AND end_reason = 'VOLUNTARY_LEAVE'`, [w.three, h.h]);
  assert.equal(left, 1);
}

async function verifyHistory(h, w) {
  stage = 'history widening: membership is not historical access';
  await asOwner();
  await setGate('SHARED_CONVERSATION', 'ENABLED', 'SATISFIED');
  await actAs('authenticated', h.p);
  const pWords = await send(randomUUID(), w.four, 'Words of P before R joined');
  const pAgain = await send(randomUUID(), w.four, 'More words of P before R joined');
  await actAs('authenticated', h.q);
  const qCommand = randomUUID();
  const qWords = await send(qCommand, w.four, 'Words of Q before R joined');
  const reply = await qandeelReply(h.q, qCommand, w.four, 'QANDEEL before R joined');
  await addMember(w.four, h.r, [h.p, h.q]);
  await actAs('authenticated', h.r);
  assert.deepEqual(await listMaterial(w.four), [], 'FROM_JOIN_FORWARD: nothing earlier is visible to the newcomer');

  stage = 'history widening: the candidates are exactly the resolved human words the grantee cannot see; unresolved material is never offered';
  const handleR = await handleOf(w.four, h.p, 'Rana Nine');
  await actAs('authenticated', h.p);
  assert.deepEqual(await proposeShare(randomUUID(), w.four, handleR, [pWords.material_id]), { outcome: 'UNAVAILABLE', package_id: null },
    'the history scope is closed: nothing widens');
  await asOwner();
  await setGate('SHARED_HISTORY_ACCESS', 'ENABLED', 'SATISFIED');
  await actAs('authenticated', h.p);
  const offered = await candidates(w.four, handleR);
  realBooleans(offered, ['is_self'], 'candidate');
  assert.deepEqual(offered.map((c) => [c.material_id, c.is_self, c.author_name]).sort(),
    [[pWords.material_id, true, 'Pia Seven'], [pAgain.material_id, true, 'Pia Seven'], [qWords.material_id, false, 'Qadir Eight']].sort());
  assert.ok(!offered.some((c) => c.material_id === reply), 'QANDEEL output (UNRESOLVED) is never offered');
  const page1 = await candidates(w.four, handleR, 2);
  const page2 = await candidates(w.four, handleR, 2, page1[1]);
  assert.equal(page1.length, 2);
  assert.deepEqual([...page1, ...page2].map((c) => c.material_id), offered.map((c) => c.material_id),
    'a bounded page is not a ceiling: the next page continues exactly where the last one stopped');
  assert.deepEqual(await candidates(w.four, handleR, 2, page2[page2.length - 1]), [], 'and ends without inventing anything');
  await rejected(() => rows('SELECT * FROM public.list_own_shared_history_share_candidates_v1($1::uuid, $2::uuid, $3::timestamptz, $4::uuid, $5::integer)',
    [w.four, handleR, new Date(), null, 10]), ['22023']);
  assert.deepEqual(await proposeShare(randomUUID(), w.four, handleR, [pWords.material_id, reply]), { outcome: 'UNAVAILABLE', package_id: null },
    'unresolved material is never packageable');
  const handleP = await handleOf(w.four, h.p, 'Pia Seven');
  await actAs('authenticated', h.p);
  assert.deepEqual(await candidates(w.four, handleP), [], 'nobody packages for themselves');
  await rejected(() => proposeShare(randomUUID(), w.four, handleR, Array.from({ length: 21 }, () => randomUUID())), ['22023']);
  await rejected(() => proposeShare(randomUUID(), w.four, handleR, [pWords.material_id, pWords.material_id]), ['22023']);

  stage = 'history widening: the required approvers are the exact authors; each sees only their own words';
  const command = randomUUID();
  const proposed = await proposeShare(command, w.four, handleR, [pWords.material_id, qWords.material_id]);
  assert.equal(proposed.outcome, 'PROPOSED');
  assert.deepEqual(await proposeShare(command, w.four, handleR, [qWords.material_id, pWords.material_id]), proposed, 'the exact item set replays');
  assert.equal((await proposeShare(command, w.four, handleR, [pWords.material_id])).outcome, 'UNAVAILABLE', 'a different item set is not the same request');
  const mine = await requests(w.four);
  realBooleans(mine, ['approved_by_self'], 'request');
  assert.deepEqual(mine.map((r) => [r.package_id, r.grantee_name, r.material_id, r.approved_by_self]), [[proposed.package_id, 'Rana Nine', pWords.material_id, false]]);
  await actAs('authenticated', h.q);
  assert.deepEqual((await requests(w.four)).map((r) => r.material_id), [qWords.material_id], 'Q is asked only about Q\'s words');
  await actAs('authenticated', h.r);
  assert.deepEqual(await requests(w.four), [], 'the grantee is not asked');
  assert.equal(await approveShare(randomUUID(), w.four, proposed.package_id), 'UNAVAILABLE', 'the grantee is no approver');
  await actAs('authenticated', h.d);
  assert.equal(await approveShare(randomUUID(), w.two, proposed.package_id), 'UNAVAILABLE', 'a foreign package through another World\'s route');
  await actAs('authenticated', h.p);
  const pApproval = randomUUID();
  assert.equal(await approveShare(pApproval, w.four, proposed.package_id), 'APPROVED');
  assert.equal(await approveShare(pApproval, w.four, proposed.package_id), 'APPROVED', 'replay');
  assert.equal(await approveShare(pApproval, w.two, proposed.package_id), 'UNAVAILABLE', 'same command, another World');
  await actAs('authenticated', h.r);
  assert.deepEqual(await listMaterial(w.four), [], 'nothing widens before the exact set completes');
  await actAs('authenticated', h.q);
  assert.equal(await approveShare(randomUUID(), w.four, proposed.package_id), 'GRANTED');

  stage = 'history widening: the grantee sees exactly the granted words, and nothing else of the earlier history';
  await actAs('authenticated', h.r);
  assert.deepEqual((await listMaterial(w.four)).map((m) => m.material_id).sort(), [pWords.material_id, qWords.material_id].sort());
  await actAs('authenticated', h.p);
  assert.equal(await approveShare(pApproval, w.four, proposed.package_id), 'GRANTED', 'replay answers the grant');
  assert.deepEqual(await requests(w.four), []);
  assert.deepEqual((await candidates(w.four, handleR)).map((c) => c.material_id), [pAgain.material_id], 'what is granted is no longer a candidate');
  await asOwner();
  const [{ grants }] = await rows('SELECT count(*)::int AS grants FROM public.shared_world_history_access_grants WHERE world_id = $1', [w.four]);
  assert.equal(grants, 1);
}

async function verifyClosure(h, w) {
  stage = 'World end: unanimous; READ_ONLY_CLOSED; a closed-view entitlement for the members at closure only';
  await actAs('authenticated', h.a);
  const aWords = await send(randomUUID(), w.one, 'A last word from A');
  await actAs('authenticated', h.b);
  const bWords = await send(randomUUID(), w.one, 'A last word from B');
  await actAs('authenticated', h.a);
  const proposed = await proposeEnd(randomUUID(), w.one);
  assert.equal(proposed.outcome, 'PROPOSED');
  assert.equal(await approve(randomUUID(), w.one, proposed.proposal_id), 'APPROVED');
  await actAs('authenticated', h.b);
  assert.equal(await approve(randomUUID(), w.one, proposed.proposal_id), 'COMMITTED');
  await asOwner();
  const [world] = await rows('SELECT lifecycle, phase FROM public.shared_worlds WHERE id = $1', [w.one]);
  assert.deepEqual(world, { lifecycle: 'READ_ONLY_CLOSED', phase: 'STANDARD' });
  const [{ open }] = await rows('SELECT count(*)::int AS open FROM public.shared_world_membership_episodes WHERE world_id = $1 AND ended_at IS NULL', [w.one]);
  assert.equal(open, 0, 'closed viewing is never active membership');

  stage = 'World end: the closed-view entitlement read; nothing ordinary after closure';
  for (const reader of [h.a, h.b]) {
    await actAs('authenticated', reader);
    const closed = await closedWorlds();
    assert.deepEqual(closed.map((c) => [c.world_id, c.world_name]), [[w.one, 'Our Lantern']]);
    const people = await closedMembers();
    realBooleans(people, ['is_self'], 'closed member');
    assert.deepEqual(people.map((p) => p.member_name).sort(), ['Amal One', 'Bassem Two'], 'the members at closure, not the member removed before it');
    const material = await closedMaterial(w.one);
    realBooleans(material, ['is_self'], 'closed material');
    assert.ok(material.some((m) => m.material_id === aWords.material_id) && material.some((m) => m.material_id === bWords.material_id));
    assert.equal(await entry(w.one), 'UNAVAILABLE', 'a closed World is never entered as an active World');
    assert.deepEqual(await listMaterial(w.one), []);
    assert.equal((await send(randomUUID(), w.one, 'after the end')).outcome, 'UNAVAILABLE', 'no composer after closure');
    assert.equal((await proposeSettings(randomUUID(), w.one, 'Renamed after the end')).outcome, 'UNAVAILABLE', 'no governance after closure');
    assert.equal(await leave(randomUUID(), w.one), 'UNAVAILABLE');
  }
  await actAs('authenticated', h.c);
  assert.deepEqual(await closedWorlds(), [], 'a member removed before closure is not restored to browsing');
  assert.deepEqual(await closedMaterial(w.one), []);
  await actAs('authenticated', h.x);
  assert.deepEqual(await closedMaterial(w.one), []);

  stage = 'World end: owner deletion after closure unserves the body; it reopens nothing';
  await actAs('authenticated', h.a);
  assert.equal(await deleteOwn(randomUUID(), w.one, aWords.material_id), 'DELETED');
  for (const reader of [h.a, h.b]) {
    await actAs('authenticated', reader);
    assert.ok(!(await closedMaterial(w.one)).some((m) => m.material_id === aWords.material_id), 'the entitlement cannot reconstruct deleted words');
  }
  await asOwner();
  const [after] = await rows('SELECT lifecycle FROM public.shared_worlds WHERE id = $1', [w.one]);
  assert.equal(after.lifecycle, 'READ_ONLY_CLOSED');
  return { bWords };
}

async function verifyFormerMember(h, w, { cWords, bWords }) {
  stage = 'former member: only the owner\'s own words in Worlds they no longer belong to; deletion reopens nothing';
  await actAs('authenticated', h.c);
  const mine = await formerMaterial();
  assert.deepEqual(mine.map((m) => [m.material_id, m.world_id, m.text_body]), [[cWords.material_id, w.one, 'Words of C before the removal']]);
  assert.ok(!mine.some((m) => m.material_id === bWords.material_id), 'never another human\'s words');
  assert.equal(await entry(w.one), 'UNAVAILABLE', 'no World browsing comes with it');
  assert.equal(await deleteOwn(randomUUID(), w.one, cWords.material_id), 'DELETED');
  assert.deepEqual(await formerMaterial(), []);
  await actAs('authenticated', h.b);
  assert.deepEqual((await formerMaterial()).map((m) => m.material_id), [bWords.material_id], 'a closed World is a former World for its members');
  await actAs('authenticated', h.f);
  assert.deepEqual(await formerMaterial(), [], 'a current member has no former material');
  await asOwner();
  const [{ episodes }] = await rows('SELECT count(*)::int AS episodes FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2', [w.one, h.c]);
  assert.equal(episodes, 1, 'deletion reopened no membership');
}


async function verifyFormerMaterialAuthority(h, w) {
  stage = 'material authority survives membership: the words of a member who has since left are still offered';
  await actAs('authenticated', h.q);
  const qLater = await send(randomUUID(), w.four, 'Q speaks again before S joins');
  assert.equal(qLater.outcome, 'COMMITTED');
  await addMember(w.four, h.s, [h.p, h.q, h.r]);
  await actAs('authenticated', h.q);
  assert.equal(await leave(randomUUID(), w.four), 'LEFT');
  const handleS = await handleOf(w.four, h.p, 'Sami Twelve');
  await actAs('authenticated', h.p);
  const offered = await candidates(w.four, handleS);
  assert.ok(offered.some((c) => c.material_id === qLater.material_id && c.author_name === 'Qadir Eight' && c.is_self === false),
    'membership is not material authority: a former member\'s words are still offered');
  const proposed = await proposeShare(randomUUID(), w.four, handleS, [qLater.material_id]);
  assert.equal(proposed.outcome, 'PROPOSED');
  assert.deepEqual(await requests(w.four), [], 'P is no approver of Q\'s words');

  stage = 'material authority survives membership: the former member approves through the account / privacy read, own words only';
  await actAs('authenticated', h.q);
  assert.deepEqual(await requests(w.four), [], 'the in-World read stays closed to a former member');
  const asked = await formerRequests();
  realBooleans(asked, ['approved_by_self'], 'former request');
  assert.deepEqual(Object.keys(asked[0]).sort(), ['approved_by_self', 'created_at', 'established_at', 'material_id', 'package_id', 'text_body', 'world_id'],
    'no grantee, member, Name, count or topic');
  assert.deepEqual(asked.map((r) => [r.package_id, r.world_id, r.material_id, r.text_body, r.approved_by_self]),
    [[proposed.package_id, w.four, qLater.material_id, 'Q speaks again before S joins', false]], 'exactly Q\'s own words');
  for (const reader of [h.p, h.r, h.s, h.x]) {
    await actAs('authenticated', reader);
    assert.deepEqual(await formerRequests(), [], 'nobody else is asked through the privacy read');
  }
  await actAs('authenticated', h.h);
  assert.equal(await approveShare(randomUUID(), w.four, proposed.package_id), 'UNAVAILABLE', 'a former member who is no required approver');
  await actAs('authenticated', h.q);
  const qApproval = randomUUID();
  assert.equal(await approveShare(qApproval, w.two, proposed.package_id), 'UNAVAILABLE', 'the exact manifest binds its exact World');
  assert.equal(await approveShare(qApproval, w.four, proposed.package_id), 'GRANTED', 'the exact required approver completes the exact set');
  assert.equal(await approveShare(qApproval, w.four, proposed.package_id), 'GRANTED', 'replay');
  assert.equal(await approveShare(qApproval, w.two, proposed.package_id), 'UNAVAILABLE', 'same command, another World');
  assert.deepEqual(await formerRequests(), []);
  await asOwner();
  const [binding] = await rows(`SELECT (SELECT count(*) FROM public.shared_world_history_package_approvals a WHERE a.manifest_version_id = $1)::int AS approvals,
      (SELECT count(*) FROM public.shared_world_history_package_required_approvers r WHERE r.manifest_version_id = $1)::int AS required,
      (SELECT count(*) FROM public.shared_world_history_package_manifest_items i WHERE i.manifest_version_id = $1)::int AS items`, [proposed.package_id]);
  assert.deepEqual(binding, { approvals: 1, required: 1, items: 1 }, 'the exact manifest, its exact required approver and its one approval');

  stage = 'material authority survives membership: the grant widens exactly that item; the former member browses nothing';
  await actAs('authenticated', h.s);
  assert.deepEqual((await listMaterial(w.four)).map((m) => m.material_id), [qLater.material_id], 'S sees exactly the granted words and no ghost history');
  await actAs('authenticated', h.q);
  assert.equal(await entry(w.four), 'UNAVAILABLE', 'no World entry');
  assert.deepEqual(await listMaterial(w.four), [], 'no browsing, no surrounding history');
  assert.deepEqual(await members(w.four), [], 'no members');
  assert.deepEqual(await settings(w.four), [], 'no settings, topic or name');
  assert.deepEqual(await proposals(w.four), [], 'no governance state');
  assert.deepEqual(await requests(w.four), []);
  await asOwner();
  const [{ open }] = await rows('SELECT count(*)::int AS open FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL', [w.four, h.q]);
  assert.equal(open, 0, 'approving reopened no membership');
}

/** The acceptance's deferred episode binding is checked now, then deferral is restored (as the addMember fixture does). */
async function flushAcceptance() {
  await asOwner();
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
}

async function verifyReachability(h, w) {
  stage = 'reachability: every well-formed Shared ID gets the same answer; nothing about the target is ever returned';
  const idT = await giveSharedId(h.t);
  const idD = await giveSharedId(h.d);
  const idE = await giveSharedId(h.e);
  const before = await proposalCount(w.two);
  await actAs('authenticated', h.d);
  assert.deepEqual(await proposeMember(randomUUID(), w.two, 'not a shared id'), [{ outcome: 'INVALID_SHARED_ID' }]);
  for (const [what, value] of [['nobody', drawSharedId()], ['the caller\'s own', idD], ['a current member', idE]]) {
    assert.deepEqual(await proposeMember(randomUUID(), w.two, value), [{ outcome: 'SUBMITTED' }], `${what}: the one answer`);
  }
  assert.equal(await proposalCount(w.two), before, 'nothing was opened for any of them');

  stage = 'reachability: the CURRENT Shared ID opens one exact add; approvers see the request and its proposer, never the target';
  await actAs('authenticated', h.d);
  const addCommand = randomUUID();
  assert.deepEqual(await proposeMember(addCommand, w.two, idT.toLowerCase().replaceAll('-', ' ')), [{ outcome: 'SUBMITTED' }]);
  assert.deepEqual(await proposeMember(addCommand, w.two, idT), [{ outcome: 'SUBMITTED' }], 'the exact request replays, in any spelling');
  assert.deepEqual(await proposeMember(addCommand, w.two, drawSharedId()), [{ outcome: 'UNAVAILABLE' }], 'the same command naming another Shared ID');
  assert.equal((await proposeEnd(addCommand, w.two)).outcome, 'UNAVAILABLE', 'the same command for another operation');
  assert.deepEqual(await proposeMember(addCommand, w.one, idT), [{ outcome: 'UNAVAILABLE' }], 'the same command on another World');
  assert.deepEqual(await proposeMember(randomUUID(), w.two, idT), [{ outcome: 'SUBMITTED' }], 'already asked for: the same answer');
  assert.equal(await proposalCount(w.two), before + 1, 'one live request per target and epoch');
  await actAs('authenticated', h.e);
  assert.deepEqual(await proposeMember(addCommand, w.two, idT), [{ outcome: 'UNAVAILABLE' }], 'another human\'s command');
  const seen = await proposals(w.two);
  realBooleans(seen, ['approved_by_self', 'proposer_is_self'], 'reachability proposal');
  assert.deepEqual(seen.map((p) => [p.operation_kind, p.proposer_name, p.proposer_is_self, p.target_name, p.approved_by_self, p.approved_count, p.required_count]),
    [['ADD_MEMBER', 'Dalia Four', false, null, false, 0, 2]], 'the exact request and who proposed it — never the target');
  const addProposal = seen[0].proposal_id;
  await actAs('authenticated', h.t);
  assert.deepEqual(await membershipRequests(), [], 'nothing reaches the target before every member approved');

  stage = 'reachability: a rotation before the acceptance makes the request non-actionable for good';
  await actAs('authenticated', h.d);
  assert.equal(await approve(randomUUID(), w.two, addProposal), 'APPROVED', 'the proposer approves separately');
  await actAs('authenticated', h.e);
  const eApproval = randomUUID();
  assert.equal(await approve(eApproval, w.two, addProposal), 'INVITED');
  assert.equal(await approve(eApproval, w.two, addProposal), 'INVITED', 'replay');
  assert.deepEqual(await proposals(w.two), [], 'a complete request waits on no member');
  await actAs('authenticated', h.t);
  const asked = await membershipRequests();
  assert.deepEqual(Object.keys(asked[0]).sort(), ['created_at', 'proposer_name', 'request_id', 'request_kind', 'world_id'], 'nothing of the World');
  assert.deepEqual(asked.map((r) => [r.request_id, r.world_id, r.request_kind, r.proposer_name]), [[addProposal, w.two, 'ADD_MEMBER', 'Dalia Four']]);
  assert.equal(await entry(w.two), 'UNAVAILABLE', 'no entry before acceptance');
  assert.deepEqual(await members(w.two), []);
  await actAs('authenticated', h.e);
  assert.equal(await acceptRequest(randomUUID(), w.two, addProposal), 'UNAVAILABLE', 'nobody but the exact target accepts');
  const idT2 = await giveSharedId(h.t);
  await actAs('authenticated', h.t);
  assert.deepEqual(await membershipRequests(), [], 'the rotation ended the request');
  assert.equal(await acceptRequest(randomUUID(), w.two, addProposal), 'UNAVAILABLE', 'an acceptance through the old epoch is impossible');
  const idT3 = await giveSharedId(h.t);
  await actAs('authenticated', h.t);
  assert.deepEqual(await membershipRequests(), [], 'and nothing revives after a further rotation');
  assert.equal(await acceptRequest(randomUUID(), w.two, addProposal), 'UNAVAILABLE');
  assert.equal(await entry(w.two), 'UNAVAILABLE');

  stage = 'reachability: an old Shared ID opens nothing; a rotation before an approval answers STALE and records nothing';
  const count = await proposalCount(w.two);
  await actAs('authenticated', h.d);
  assert.deepEqual(await proposeMember(randomUUID(), w.two, idT), [{ outcome: 'SUBMITTED' }], 'a rotated-away ID: the same answer');
  assert.deepEqual(await proposeMember(randomUUID(), w.two, idT2), [{ outcome: 'SUBMITTED' }]);
  assert.equal(await proposalCount(w.two), count, 'and nothing opened');
  await actAs('authenticated', h.d);
  assert.deepEqual(await proposeMember(randomUUID(), w.two, idT3), [{ outcome: 'SUBMITTED' }]);
  const second = (await proposals(w.two))[0].proposal_id;
  assert.equal(await approve(randomUUID(), w.two, second), 'APPROVED');
  const idT4 = await giveSharedId(h.t);
  await actAs('authenticated', h.e);
  assert.deepEqual(await proposals(w.two), [], 'a request whose Shared ID rotated waits on nobody');
  assert.equal(await approve(randomUUID(), w.two, second), 'STALE');
  await asOwner();
  assert.equal(Number((await first('SELECT count(*)::int AS n FROM public.shared_world_governance_approvals WHERE proposal_id = $1', [second])).n), 1,
    'the late approval recorded nothing');
  assert.equal(Number((await first('SELECT count(*)::int AS n FROM public.shared_world_member_invitations WHERE governance_proposal_id = $1', [second])).n), 0,
    'and no invitation exists');

  stage = 'reachability: the current epoch succeeds end to end; FROM_JOIN_FORWARD';
  await actAs('authenticated', h.d);
  const earlier = await send(randomUUID(), w.two, 'Said before T joined');
  assert.equal(earlier.outcome, 'COMMITTED');
  await actAs('authenticated', h.e);
  assert.deepEqual(await proposeMember(randomUUID(), w.two, idT4), [{ outcome: 'SUBMITTED' }]);
  const third = (await proposals(w.two))[0];
  assert.deepEqual([third.operation_kind, third.proposer_name, third.proposer_is_self], ['ADD_MEMBER', 'Ehab Five', true]);
  assert.equal(await approve(randomUUID(), w.two, third.proposal_id), 'APPROVED');
  await actAs('authenticated', h.d);
  assert.equal(await approve(randomUUID(), w.two, third.proposal_id), 'INVITED');
  await actAs('authenticated', h.t);
  const acceptance = randomUUID();
  assert.equal(await acceptRequest(acceptance, w.two, third.proposal_id), 'JOINED');
  await flushAcceptance();
  await actAs('authenticated', h.t);
  assert.equal(await acceptRequest(acceptance, w.two, third.proposal_id), 'JOINED', 'replay');
  assert.equal(await acceptRequest(acceptance, w.one, third.proposal_id), 'UNAVAILABLE', 'same command, another World');
  assert.equal(await acceptRequest(acceptance, w.two, addProposal), 'UNAVAILABLE', 'same command, another request');
  assert.equal(await entry(w.two), 'ALLOW');
  assert.ok((await members(w.two)).some((m) => m.member_name === 'Tala Thirteen' && m.is_self === true), 'the post-membership identity rules now apply');
  assert.ok(!(await listMaterial(w.two)).some((m) => m.material_id === earlier.material_id), 'FROM_JOIN_FORWARD: nothing earlier is granted');
  assert.deepEqual(await membershipRequests(), []);

  stage = 'reachability: rotation leaves existing Worlds and current memberships untouched';
  await giveSharedId(h.t);
  await giveSharedId(h.d);
  for (const reader of [h.t, h.d, h.e]) {
    await actAs('authenticated', reader);
    assert.equal(await entry(w.two), 'ALLOW', 'a current membership survives any rotation');
  }

  stage = 'reachability: a former member comes back only by REJOIN, at the current epoch, by their own acceptance';
  await actAs('authenticated', h.t);
  assert.equal(await leave(randomUUID(), w.two), 'LEFT');
  const idT6 = await giveSharedId(h.t);
  await actAs('authenticated', h.d);
  assert.deepEqual(await proposeMember(randomUUID(), w.two, idT6), [{ outcome: 'SUBMITTED' }]);
  const rejoin = (await proposals(w.two))[0];
  assert.deepEqual([rejoin.operation_kind, rejoin.target_name, rejoin.proposer_name, rejoin.required_count], ['REJOIN_MEMBER', null, 'Dalia Four', 2]);
  assert.equal(await approve(randomUUID(), w.two, rejoin.proposal_id), 'APPROVED');
  await actAs('authenticated', h.e);
  assert.equal(await approve(randomUUID(), w.two, rejoin.proposal_id), 'INVITED');
  await actAs('authenticated', h.t);
  assert.deepEqual((await membershipRequests()).map((r) => [r.request_id, r.request_kind, r.proposer_name]), [[rejoin.proposal_id, 'REJOIN_MEMBER', 'Dalia Four']]);
  assert.equal(await entry(w.two), 'UNAVAILABLE', 'approval alone forces nobody back');
  const idT7 = await giveSharedId(h.t);
  await actAs('authenticated', h.t);
  assert.deepEqual(await membershipRequests(), [], 'a rotation ends a rejoin too');
  assert.equal(await acceptRequest(randomUUID(), w.two, rejoin.proposal_id), 'UNAVAILABLE');
  await actAs('authenticated', h.d);
  assert.deepEqual(await proposeMember(randomUUID(), w.two, idT7), [{ outcome: 'SUBMITTED' }]);
  const rejoinAgain = (await proposals(w.two))[0].proposal_id;
  assert.equal(await approve(randomUUID(), w.two, rejoinAgain), 'APPROVED');
  await actAs('authenticated', h.e);
  assert.equal(await approve(randomUUID(), w.two, rejoinAgain), 'INVITED');
  await actAs('authenticated', h.t);
  assert.equal(await acceptRequest(randomUUID(), w.two, rejoinAgain), 'JOINED');
  await flushAcceptance();
  await actAs('authenticated', h.t);
  assert.equal(await entry(w.two), 'ALLOW');
  await asOwner();
  const episodes = await rows('SELECT ended_at IS NULL AS open FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2 ORDER BY joined_at', [w.two, h.t]);
  assert.deepEqual(episodes.map((e) => e.open), [false, true], 'a rejoin is a NEW episode; the old one is never reopened');
}

// ------------------------------------------------------------------------------------------------------
// Stage 11 — concurrency on committed state.
// ------------------------------------------------------------------------------------------------------
async function waitUntilBlocked(pid) {
  for (let i = 0; i < 200; i += 1) {
    const [row] = await rows('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (row?.wait_event_type === 'Lock') return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('the second transaction never blocked on the first');
}

async function verifyConcurrency() {
  const humans = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const [k1, k2, k3, l1, l2, l3] = humans;
  const suffix = randomUUID().slice(0, 8).replace(/[^a-z0-9]/gu, 'x');
  await client.query('CREATE TEMP TABLE s403_prior_gate ON COMMIT PRESERVE ROWS AS SELECT * FROM shared_private.shared_launch_capability_states');
  const [{ priorGateRows }] = await rows('SELECT count(*)::int AS "priorGateRows" FROM s403_prior_gate');
  const [{ lastEvent }] = await rows('SELECT COALESCE(max(id), 0)::bigint AS "lastEvent" FROM shared_private.shared_launch_capability_events');
  let failed = false;
  let worldK = null;
  let worldL = null;
  const one = new Client({ connectionString: databaseUrl });
  const two = new Client({ connectionString: databaseUrl });
  await one.connect();
  await two.connect();
  try {
    stage = 'concurrency: committed fixtures';
    await client.query('BEGIN');
    await asOwner();
    for (const [index, id] of humans.entries()) await signUp(client, id, `Racer ${index}`, `s403racer${index}${suffix}`);
    worldK = await bornWorld(k1, k2);
    await addMember(worldK, k3, [k1, k2]);
    worldL = await bornWorld(l1, l2);
    await setGate('SHARED_GOVERNANCE', 'ENABLED', 'SATISFIED');
    await asOwner();
    await client.query('COMMIT');
    await client.query('RESET ROLE');
    const [{ pid }] = await rows('SELECT pg_backend_pid() AS pid', [], two);

    stage = 'concurrency: concurrent equivalent approvals record one approval';
    await client.query('BEGIN');
    await actAs('authenticated', k1);
    const proposed = await proposeSettings(randomUUID(), worldK, 'Raced name');
    assert.equal(proposed.outcome, 'PROPOSED');
    assert.equal(await approve(randomUUID(), worldK, proposed.proposal_id), 'APPROVED');
    await client.query('COMMIT');
    const twice = randomUUID();
    await one.query('BEGIN');
    await actAs('authenticated', k2, one);
    assert.equal(await approve(twice, worldK, proposed.proposal_id, one), 'APPROVED');
    await two.query('BEGIN');
    await actAs('authenticated', k2, two);
    const equivalent = approve(twice, worldK, proposed.proposal_id, two);
    await waitUntilBlocked(pid);
    await one.query('COMMIT');
    assert.equal(await equivalent, 'APPROVED', 'the equivalent approval serialized on the World row and answered the committed one');
    await two.query('COMMIT');
    const [{ approvals }] = await rows(`SELECT count(*)::int AS approvals FROM public.shared_world_governance_approvals WHERE proposal_id = $1`, [proposed.proposal_id]);
    assert.equal(approvals, 2);

    stage = 'concurrency: the satisfying approval and a racing leave serialize on the World row — no deadlock, the approval wins';
    await one.query('BEGIN');
    await actAs('authenticated', k3, one);
    assert.equal(await approve(randomUUID(), worldK, proposed.proposal_id, one), 'COMMITTED');
    await two.query('BEGIN');
    await actAs('authenticated', k1, two);
    const racingLeave = leave(randomUUID(), worldK, two);
    await waitUntilBlocked(pid);
    await one.query('COMMIT');
    assert.equal(await racingLeave, 'LEFT');
    await two.query('COMMIT');
    const [{ changes }] = await rows('SELECT count(*)::int AS changes FROM public.shared_world_settings_change_commands WHERE world_id = $1', [worldK]);
    assert.equal(changes, 1);

    stage = 'concurrency: a leave that wins the race stales the proposal; the late approval is STALE';
    await client.query('BEGIN');
    await actAs('authenticated', k2);
    const second = await proposeSettings(randomUUID(), worldK, 'Second raced name');
    assert.equal(second.outcome, 'PROPOSED');
    await client.query('COMMIT');
    await one.query('BEGIN');
    await actAs('authenticated', k3, one);
    assert.equal(await leave(randomUUID(), worldK, one), 'LEFT');
    await two.query('BEGIN');
    await actAs('authenticated', k2, two);
    const lateApproval = approve(randomUUID(), worldK, second.proposal_id, two);
    await waitUntilBlocked(pid);
    await one.query('COMMIT');
    assert.equal(await lateApproval, 'STALE', 'topology changed racing the proposal: stale governance refuses');
    await two.query('COMMIT');

    stage = 'concurrency: a Shared-ID rotation and the target\'s acceptance serialize on the credential row; the rotation that wins ends the request';
    await client.query('BEGIN');
    const idL3 = await giveSharedId(l3);
    await actAs('authenticated', l1);
    assert.deepEqual(await proposeMember(randomUUID(), worldL, idL3), [{ outcome: 'SUBMITTED' }]);
    const request = (await proposals(worldL))[0].proposal_id;
    assert.equal(await approve(randomUUID(), worldL, request), 'APPROVED');
    await actAs('authenticated', l2);
    assert.equal(await approve(randomUUID(), worldL, request), 'INVITED');
    await asOwner();
    await client.query('COMMIT');
    await one.query('BEGIN');
    const [credential] = await rows('SELECT epoch FROM public.shared_world_invite_credential_state WHERE user_id = $1', [l3], one);
    await asOwner(l3, one);
    await rows('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, $3)', [randomUUID(), refOf(drawSharedId()), credential.epoch], one);
    await two.query('BEGIN');
    await actAs('authenticated', l3, two);
    const racingAcceptance = acceptRequest(randomUUID(), worldL, request, two);
    await waitUntilBlocked(pid);
    await one.query('COMMIT');
    assert.equal(await racingAcceptance, 'UNAVAILABLE', 'the acceptance waited for the rotation, then refused the old epoch');
    await two.query('COMMIT');
    const [{ joined }] = await rows('SELECT count(*)::int AS joined FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2', [worldL, l3]);
    assert.equal(joined, 0, 'no membership through a rotated-away Shared ID');

    stage = 'concurrency: unrelated Worlds stay concurrent';
    await one.query('BEGIN');
    await actAs('authenticated', k2, one);
    const held = await proposeSettings(randomUUID(), worldK, 'Holding World K');
    assert.equal(held.outcome, 'PROPOSED');
    await two.query('BEGIN');
    await two.query("SET LOCAL statement_timeout = '5s'");
    await actAs('authenticated', l1, two);
    const elsewhere = await proposeSettings(randomUUID(), worldL, 'World L is not blocked');
    assert.equal(elsewhere.outcome, 'PROPOSED', 'World L proceeded while World K was held');
    await two.query('COMMIT');
    await one.query('COMMIT');
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (!failed) stage = 'concurrency: fixture removal';
    for (const extra of [one, two]) await extra.query('ROLLBACK').catch((error) => { if (error?.code !== '25P01') throw error; });
    await one.end();
    await two.end();
    await client.query('ROLLBACK').catch((error) => { if (error?.code !== '25P01') throw error; });
    await client.query('RESET ROLE');
    const worldIds = [worldK, worldL].filter((id) => id !== null);
    const scoped = async (table, column = 'world_id') => client.query(`DELETE FROM public.${table} WHERE ${column} = ANY($1::uuid[])`, [worldIds]);
    const proposalIds = (await rows('SELECT id FROM public.shared_world_governance_proposals WHERE world_id = ANY($1::uuid[])', [worldIds])).map((r) => r.id);
    const snapshotIds = (await rows('SELECT id FROM public.shared_world_membership_snapshots WHERE world_id = ANY($1::uuid[])', [worldIds])).map((r) => r.id);
    await scoped('shared_world_settings_change_commands');
    await scoped('shared_world_setting_changed_events');
    await scoped('shared_world_settings_state');
    await scoped('shared_world_settings_versions');
    await scoped('shared_world_member_acceptance_commands');
    await scoped('shared_world_member_joined_events');
    await scoped('shared_world_member_invitations');
    await scoped('shared_world_add_member_payload_versions');
    await scoped('shared_world_voluntary_leave_commands');
    await scoped('shared_world_member_left_events');
    await client.query('DELETE FROM shared_private.shared_governance_proposal_origins WHERE governance_proposal_id = ANY($1::uuid[])', [proposalIds]);
    await client.query('DELETE FROM public.shared_world_governance_approvals WHERE proposal_id = ANY($1::uuid[])', [proposalIds]);
    await client.query('DELETE FROM public.shared_world_governance_proposals WHERE id = ANY($1::uuid[])', [proposalIds]);
    await client.query('DELETE FROM public.shared_world_membership_snapshot_members WHERE membership_snapshot_id = ANY($1::uuid[])', [snapshotIds]);
    await client.query('DELETE FROM public.shared_world_membership_snapshots WHERE id = ANY($1::uuid[])', [snapshotIds]);
    await scoped('shared_world_direct_acceptance_commands');
    await scoped('shared_world_direct_birth_events');
    await scoped('shared_world_membership_episodes');
    await client.query('DELETE FROM public.shared_worlds WHERE id = ANY($1::uuid[])', [worldIds]);
    await client.query('DELETE FROM public.shared_world_invitation_commands WHERE actor_user_id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM public.shared_world_direct_invitations WHERE inviter_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM public.shared_world_invite_credential_state WHERE user_id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM shared_private.shared_launch_capability_events WHERE id > $1', [lastEvent]);
    await client.query('DELETE FROM shared_private.shared_launch_capability_states s WHERE NOT EXISTS (SELECT 1 FROM s403_prior_gate p WHERE p.capability_scope = s.capability_scope)');
    await client.query(`UPDATE shared_private.shared_launch_capability_states s SET feature_flag_state = p.feature_flag_state,
      launch_requirements_state = p.launch_requirements_state, restriction_version = p.restriction_version, decided_by = p.decided_by,
      policy_basis = p.policy_basis, decided_at = p.decided_at FROM s403_prior_gate p WHERE p.capability_scope = s.capability_scope`);
    await client.query('DROP TABLE s403_prior_gate');
    const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM public.shared_world_membership_episodes WHERE user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM public.shared_worlds WHERE id = ANY($2::uuid[]))
      + (SELECT count(*) FROM public.shared_world_governance_proposals WHERE world_id = ANY($2::uuid[])) AS residue`, [humans, worldIds]);
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
      const h = { a: randomUUID(), b: randomUUID(), c: randomUUID(), d: randomUUID(), e: randomUUID(), f: randomUUID(), g: randomUUID(),
        h: randomUUID(), p: randomUUID(), q: randomUUID(), r: randomUUID(), s: randomUUID(), t: randomUUID(), x: randomUUID() };
      const suffix = randomUUID().slice(0, 8).replace(/[^a-z0-9]/gu, 'x');
      const named = [['a', 'Amal One'], ['b', 'Bassem Two'], ['c', 'Chadi Three'], ['d', 'Dalia Four'], ['e', 'Ehab Five'], ['f', 'Farah Six'],
        ['g', 'Ghada Ten'], ['h', 'Hani Eleven'], ['p', 'Pia Seven'], ['q', 'Qadir Eight'], ['r', 'Rana Nine'], ['s', 'Sami Twelve'],
        ['t', 'Tala Thirteen'], ['x', 'Xena Outsider']];
      for (const [key, name] of named) await signUp(client, h[key], name, `s403${key}${suffix}`);
      const w = {};
      w.one = await bornWorld(h.a, h.b);
      await addMember(w.one, h.c, [h.a, h.b]);
      w.two = await bornWorld(h.d, h.e);
      w.three = await bornWorld(h.f, h.g);
      await addMember(w.three, h.h, [h.f, h.g]);
      w.four = await bornWorld(h.p, h.q);
      // C speaks in World One before being removed from it (the former-member stage reads it back).
      await setGate('SHARED_CONVERSATION', 'ENABLED', 'SATISFIED');
      await actAs('authenticated', h.c);
      const cWords = await send(randomUUID(), w.one, 'Words of C before the removal');
      assert.equal(cWords.outcome, 'COMMITTED');
      await asOwner();
      await verifyClosedGate(h, w);
      await verifySettings(h, w);
      await verifyRemoval(h, w);
      await verifyStaleAndLeave(h, w);
      await verifyHistory(h, w);
      await verifyFormerMaterialAuthority(h, w);
      await verifyReachability(h, w);
      const { bWords } = await verifyClosure(h, w);
      await verifyFormerMember(h, w, { cWords, bWords });
    } finally {
      await client.query('ROLLBACK');
    }
    await verifyConcurrency();
    console.log('Verified migration 0140: server-owned boundary; fail-closed governance and history scopes; voluntary leave ungated; unanimity with proposer and neutral progress only; removal target never votes; stale topology; settings apply once; World end with closed-view entitlement; owner deletion after closure; history widening over resolved authority only (unresolved material never packageable), paged without a ceiling; former-member material authority without World browsing; add / rejoin by CURRENT Shared ID with epoch binding (rotation ends a request for good; no enumeration); former member own material; cross-World replay refused; non-null booleans; concurrent equivalent approvals; rotation vs acceptance; unrelated Worlds stay concurrent.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Database verification failed at ${stage} (${code}). Connection details were suppressed.`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  // A PostgreSQL refusal's own message names the object, never the connection.
  else if (typeof error?.code === 'string' && typeof error?.message === 'string') console.error(error.message.slice(0, 300));
  process.exitCode = 1;
});
