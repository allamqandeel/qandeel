// S4-03 — Shared Membership Lifecycle, Governance, Settings & Historical Access v1: secret-free structural contract over
// migration 0140.
//
// Every "must not contain" assertion runs against executable SQL only. Live semantics — leave, governed removal /
// settings / World end, add / rejoin by CURRENT Shared ID with its epoch binding, unanimity, staleness, selective history
// widening, former-member material authority, closed viewing by entitlement, former-member own-material control, the
// cross-World replay law, non-null Product booleans and concurrency — are proven by the real-PostgreSQL verifier this file
// pins into the toolchain and API CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION_NAME = '0140_shared_world_lifecycle_governance_product_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0140.mjs');
const packageJson = JSON.parse(read('../../package.json'));
const workflow = read('../../.github/workflows/api-ci.yml');
const sql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const fnBody = (qualified) => {
  const start = sql.indexOf(`CREATE FUNCTION ${qualified}(`);
  assert.ok(start >= 0, `migration defines ${qualified}`);
  const end = sql.indexOf('$$;', sql.indexOf('AS $$', start));
  return sql.slice(start, end);
};

const INTERNAL = ['derive_shared_lifecycle_identity_v1', 'shared_member_handle_v1', 'shared_lifecycle_command_family_v1',
  'is_current_shared_member_v1', 'is_current_shared_proposal_topology_v1', 'is_committed_shared_proposal_v1',
  'shared_history_share_candidates_v1', 'shared_proposal_replay_matches_v1', 'shared_proposal_progress_v1',
  'shared_reachability_target_v1', 'is_actionable_shared_reachability_v1', 'record_shared_proposal_origin_v1'];
const READS = ['read_shared_governance_capabilities_v1', 'list_own_shared_world_names_v1', 'read_own_shared_world_settings_v1',
  'list_own_shared_world_member_handles_v1', 'list_own_shared_world_proposals_v1', 'list_own_shared_history_share_candidates_v1',
  'list_own_shared_history_share_requests_v1', 'list_own_closed_shared_worlds_v1', 'list_own_closed_shared_world_members_v1',
  'list_own_closed_shared_world_material_v1', 'list_own_former_shared_world_material_v1',
  'list_own_former_shared_history_share_requests_v1', 'list_own_shared_membership_requests_v1'];
const GOVERNED = ['propose_shared_world_settings_v1', 'propose_shared_world_member_removal_v1', 'propose_shared_world_end_v1',
  'approve_shared_world_proposal_v1', 'propose_shared_world_member_v1', 'accept_shared_membership_request_v1'];
const REACHABILITY = ['propose_shared_world_member_v1', 'approve_shared_world_proposal_v1', 'accept_shared_membership_request_v1'];
const HISTORY = ['propose_shared_world_history_share_v1', 'approve_shared_world_history_share_v1'];
const COMMANDS = ['leave_shared_world_v1', ...GOVERNED, ...HISTORY];
const HUMAN = [...READS, ...COMMANDS];
const FROZEN_CORES = ['commit_shared_world_standard_voluntary_leave_v1', 'capture_shared_world_governance_proposal_v1',
  'commit_shared_world_governance_approval_v1', 'resolve_shared_world_governance_approval_v1',
  'prepare_shared_world_add_member_governance_v1', 'prepare_shared_world_remove_member_governance_v1',
  'prepare_shared_world_rejoin_governance_v1', 'dispatch_shared_world_member_invitation_v1',
  'accept_shared_world_member_invitation_v1', 'commit_shared_world_member_removal_v1', 'commit_shared_world_member_rejoin_v1',
  'prepare_shared_world_settings_change_governance_v1', 'commit_shared_world_settings_change_v1',
  'prepare_shared_world_history_package_v1', 'commit_shared_world_history_package_approval_v1',
  'commit_shared_world_history_access_grant_v1', 'prepare_shared_world_standard_end_governance_v1',
  'commit_shared_world_standard_end_v1', 'resolve_shared_world_closed_history_visibility_v1'];

test('0140 is the one forward migration after 0139: one sealed origin table, no trigger, no rewritten frozen object, nothing seeded', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.equal(migrations.filter((n) => n.startsWith('0140_')).length, 1);
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0139_shared_world_conversation_material_v1.sql'));
  assert.match(migration, /^-- S4-03/u);
  assert.match(sql, /^BEGIN;/mu);
  assert.match(sql, /COMMIT;\s*$/u);
  assert.doesNotMatch(sql, /DROP (?:TABLE|FUNCTION|TRIGGER|POLICY|INDEX|SCHEMA)/iu);
  assert.doesNotMatch(sql, /CREATE OR REPLACE|CREATE TRIGGER|CREATE POLICY|CREATE EXTENSION|LOCK TABLE|CREATE SEQUENCE/iu,
    'no second lifecycle / governance / history model and no frozen function rewritten');
  // Exactly one table: the Product origin of a proposal (proposer; add / rejoin epoch binding). Sealed like every Shared relation.
  assert.deepEqual([...sql.matchAll(/CREATE TABLE ([\w.]+)/gu)].map((m) => m[1]), ['shared_private.shared_governance_proposal_origins']);
  assert.match(sql, /ALTER TABLE shared_private\.shared_governance_proposal_origins ENABLE ROW LEVEL SECURITY;/u);
  assert.match(sql, /REVOKE ALL ON TABLE shared_private\.shared_governance_proposal_origins FROM PUBLIC, anon, authenticated;/u);
  assert.match(sql, /REVOKE ALL ON TABLE shared_private\.shared_governance_proposal_origins FROM service_role/u);
  const table = sql.slice(sql.indexOf('CREATE TABLE shared_private.shared_governance_proposal_origins'), sql.indexOf(');', sql.indexOf('CREATE TABLE shared_private.shared_governance_proposal_origins')));
  assert.doesNotMatch(table, /shared_id|lookup_ref|plaintext|clear|target_user/u, 'no Shared ID, lookup reference or second target copy is kept');
  assert.match(table, /target_credential_epoch bigint/u);
  assert.doesNotMatch(sql, /pg_advisory|advisory_xact/u, 'no advisory lock: the World row is the canonical lock');
  // The migration's only own write is the origin row; every other write is a frozen core's.
  assert.deepEqual([...sql.matchAll(/\b(?:INSERT INTO|UPDATE|DELETE FROM) ((?:public|shared_private)\.\w+)/gu)].map((m) => m[1]),
    ['shared_private.shared_governance_proposal_origins'], 'every other write happens inside a frozen core');
  // The one forward alteration of a 0138 relation: the gate scope CHECK, replaced by the same CHECK plus two literals.
  assert.deepEqual([...sql.matchAll(/DROP CONSTRAINT (\w+)/gu)].map((m) => m[1]), ['shared_launch_capability_states_scope_check']);
  assert.match(sql, /ADD CONSTRAINT shared_launch_capability_states_scope_check\s+CHECK \(capability_scope IN \('SHARED_DIRECT_INVITATION', 'SHARED_DIRECT_WORLD_BIRTH', 'SHARED_CONVERSATION',\s+'SHARED_GOVERNANCE', 'SHARED_HISTORY_ACCESS'\)\)/u);
  assert.doesNotMatch(sql, /ALTER TABLE public\./u, 'no frozen public relation is altered');
  assert.deepEqual([...new Set([...sql.matchAll(/ALTER TABLE ([\w.]+)/gu)].map((m) => m[1]))].sort(),
    ['shared_private.shared_governance_proposal_origins', 'shared_private.shared_launch_capability_states']);
  assert.doesNotMatch(sql, /INSERT INTO shared_private\.shared_launch_capability_states/u, 'no capability is seeded open');
});

test('every privileged part is a pinned SECURITY DEFINER in shared_private; every exposed wrapper is INVOKER and authenticated-only', () => {
  const privateFns = [...sql.matchAll(/CREATE FUNCTION shared_private\.(\w+)\(/gu)].map((m) => m[1]);
  assert.deepEqual(privateFns.sort(), [...INTERNAL, ...HUMAN].sort());
  for (const name of [...INTERNAL, ...HUMAN]) {
    assert.match(fnBody(`shared_private.${name}`), /SECURITY DEFINER SET search_path = ''/u, `${name} is a pinned definer`);
  }
  const publicFns = [...sql.matchAll(/CREATE FUNCTION public\.(\w+)\(/gu)].map((m) => m[1]);
  assert.deepEqual(publicFns.sort(), [...HUMAN].sort(), 'no internal helper is exposed');
  for (const name of HUMAN) {
    const body = fnBody(`public.${name}`);
    assert.match(body, /SECURITY INVOKER SET search_path = ''/u, `${name} is an invoker wrapper`);
    assert.match(body, new RegExp(`shared_private\\.${name}\\(`, 'u'), `${name} calls only its own definer`);
  }
  // No name joins the T-03D single-committing-authority census, and none collides with a frozen core.
  for (const name of [...INTERNAL, ...HUMAN]) {
    assert.ok(!name.startsWith('commit_'), `${name} is not a commit_* name`);
    assert.ok(!FROZEN_CORES.includes(name), `${name} is not a frozen core's name`);
  }
  assert.doesNotMatch(sql, /GRANT[^;]*TO service_role/u, 'the server channel is granted nothing');
  assert.doesNotMatch(sql, /GRANT[^;]*ON TABLE/u, 'no table grant of any kind');
  for (const core of FROZEN_CORES) assert.doesNotMatch(sql, new RegExp(`GRANT[^;]*${core}`, 'u'), `no grant on ${core}`);
  assert.match(sql, /EXECUTE format\('REVOKE ALL ON FUNCTION public\.%s FROM PUBLIC, anon, authenticated', fn\)/u);
  assert.match(sql, /EXECUTE format\('REVOKE ALL ON FUNCTION public\.%s FROM service_role', fn\)/u,
    'explicit service_role revocation, so the hosted-default replay (verify-migration-0133) stays exact');
  assert.match(sql, /EXECUTE format\('GRANT EXECUTE ON FUNCTION public\.%s TO authenticated', fn\)/u);
});

test('the human is auth.uid(); the client supplies no user, actor, approver, audience, authority, snapshot or persistence identity', () => {
  for (const name of HUMAN) {
    const body = fnBody(`shared_private.${name}`);
    assert.match(body, /auth\.uid\(\)/u, `${name} derives the human`);
    const signature = body.split('RETURNS')[0];
    assert.doesNotMatch(signature, /p_(?:user|actor|author|approver|audience|authority|snapshot|episode|target_user|grantee_user|approval_rule|operation|payload|manifest|history_item|count)/u,
      `${name} accepts no identity, authority, rule or persistence claim`);
    assert.doesNotMatch(body, /set_config|request\.jwt/u, 'no principal is substituted');
  }
  for (const name of INTERNAL) {
    assert.doesNotMatch(fnBody(`shared_private.${name}`), /auth\.uid/u, `${name} is a pure helper with no token of its own`);
  }
  // Server-derived persistence identities.
  const settings = fnBody('shared_private.propose_shared_world_settings_v1');
  assert.match(settings, /derive_shared_lifecycle_identity_v1\('PROPOSAL', p_command_id::text\)/u);
  assert.match(settings, /derive_shared_lifecycle_identity_v1\('PROPOSAL_SNAPSHOT', p_command_id::text\)/u);
  const approve = fnBody('shared_private.approve_shared_world_proposal_v1');
  assert.match(approve, /derive_shared_lifecycle_identity_v1\('OPERATION_COMMAND', p_proposal_id::text\)/u,
    'the operation the satisfying approval commits belongs to the PROPOSAL, so it commits exactly once');
  const handle = fnBody('shared_private.shared_member_handle_v1');
  assert.match(handle, /derive_shared_lifecycle_identity_v1\('MEMBER_HANDLE', p_world_id::text \|\| ':' \|\| p_user_id::text\)/u,
    'a member handle is World-bound and opaque, never a user id');
});

test('cross-World law: every command proves the exact World, family, request and human BEFORE any replay answer', () => {
  const family = fnBody('shared_private.shared_lifecycle_command_family_v1');
  for (const f of ['LEAVE', 'PROPOSAL', 'APPROVAL', 'HISTORY_PROPOSAL', 'HISTORY_APPROVAL', 'ACCEPTANCE']) assert.match(family, new RegExp(`'${f}'`, 'u'));
  for (const name of COMMANDS) {
    const body = fnBody(`shared_private.${name}`);
    const familyCheck = body.indexOf('shared_lifecycle_command_family_v1(p_command_id)');
    assert.ok(familyCheck > 0, `${name} checks the command family`);
    // Nothing is answered as a success before the family / World / request check: every RETURN that is not a refusal
    // comes after it.
    const answers = [...body.matchAll(/RETURN QUERY SELECT[^;]*;/gu)]
      .filter((m) => !/'(?:UNAVAILABLE|INVALID_SHARED_ID|STALE|UNCHANGED)'::text/u.test(m[0]) || /CASE/u.test(m[0]));
    assert.ok(answers.length > 0, `${name} answers something`);
    assert.ok(answers.every((m) => m.index > familyCheck), `${name}: the binding check precedes every success answer`);
  }
  const leave = fnBody('shared_private.leave_shared_world_v1');
  assert.match(leave, /v_committed\.actor_user_id = v_user AND v_committed\.world_id = p_world_id/u);
  const approve = fnBody('shared_private.approve_shared_world_proposal_v1');
  assert.match(approve, /WHERE p\.id = p_proposal_id AND p\.world_id = p_world_id/u, 'a foreign World\'s proposal is one UNAVAILABLE');
  assert.match(approve, /a\.proposal_id = p_proposal_id AND e\.world_id = p_world_id AND e\.user_id = v_user/u);
  const approveHistory = fnBody('shared_private.approve_shared_world_history_share_v1');
  assert.match(approveHistory, /mv\.id = p_package_id AND mv\.world_id = p_world_id/u);
  const replay = fnBody('shared_private.shared_proposal_replay_matches_v1');
  assert.match(replay, /o\.world_id = p_world_id AND o\.operation_kind = p_operation_kind AND o\.proposer_user_id = p_user_id/u,
    'a proposal replays only for the exact human who proposed it');
  const member = fnBody('shared_private.propose_shared_world_member_v1');
  assert.match(member, /o\.request_digest = shared_private\.derive_shared_lifecycle_identity_v1\('MEMBER_REQUEST',/u,
    'a replay naming another Shared ID is not the same request (proven by digest; the ID itself is never kept)');
  const accept = fnBody('shared_private.accept_shared_membership_request_v1');
  assert.match(accept, /WHERE p\.id = p_request_id AND p\.world_id = p_world_id/u);
  assert.match(accept, /c\.actor_user_id = v_user AND c\.world_id = p_world_id/u);
  assert.match(fnBody('shared_private.propose_shared_world_settings_v1'),
    /v\.name IS NOT DISTINCT FROM v_name AND v\.description IS NOT DISTINCT FROM v_description\s+AND v\.topic IS NOT DISTINCT FROM v_topic/u,
    'a replay with different values is not the same request');
  assert.match(fnBody('shared_private.propose_shared_world_member_removal_v1'),
    /shared_member_handle_v1\(p_world_id, rp\.target_user_id\) = p_member_handle/u, 'a replay for a different target is not the same request');
});

test('the gate: governed and history commands bind their own scope before the World row; leave, privacy and closed reads bind none', () => {
  for (const name of GOVERNED) {
    const body = fnBody(`shared_private.${name}`);
    const gate = body.indexOf("bind_shared_launch_gate_v1('SHARED_GOVERNANCE')");
    const world = body.indexOf('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE');
    assert.ok(gate > 0 && world > gate, `${name}: gate, then World`);
  }
  for (const name of REACHABILITY) {
    const body = fnBody(`shared_private.${name}`);
    const world = body.indexOf('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE');
    const credential = body.indexOf('FOR SHARE');
    assert.ok(credential > world, `${name}: World, then the target credential row FOR SHARE (the epoch binding)`);
    assert.match(body, /public\.shared_world_invite_credential_state s/u);
  }
  for (const name of HISTORY) {
    const body = fnBody(`shared_private.${name}`);
    const gate = body.indexOf("bind_shared_launch_gate_v1('SHARED_HISTORY_ACCESS')");
    const world = body.indexOf('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE');
    assert.ok(gate > 0 && world > gate, `${name}: gate, then World`);
  }
  for (const name of ['leave_shared_world_v1', ...READS]) {
    assert.doesNotMatch(fnBody(`shared_private.${name}`), /bind_shared_launch_gate_v1/u, `${name} binds no ordinary gate`);
  }
});

test('the frozen cores decide: approvals by unanimity, operations only when satisfied, history only through the exact derived set', () => {
  const approve = fnBody('shared_private.approve_shared_world_proposal_v1');
  const approval = approve.indexOf('public.commit_shared_world_governance_approval_v1(v_approval, p_proposal_id)');
  const removal = approve.indexOf('public.commit_shared_world_member_removal_v1(');
  const settings = approve.indexOf('public.commit_shared_world_settings_change_v1(');
  const end = approve.indexOf('public.commit_shared_world_standard_end_v1(');
  assert.ok(approval > 0 && removal > approval && settings > approval && end > approval, 'the approval first, then the operation');
  assert.match(approve, /WHEN object_not_in_prerequisite_state THEN/u, 'an incomplete approval set commits nothing (the frozen 55000)');
  assert.match(approve, /WHEN serialization_failure THEN\s+RETURN QUERY SELECT 'STALE'/u, 'a moved topology is STALE, never silently satisfied');
  // Add / rejoin (Product Owner decision 2026-10-05): the frozen 0085 cores, consumed unchanged, behind the epoch binding.
  assert.match(approve, /p\.operation_kind IN \('REMOVE_MEMBER', 'WORLD_SETTINGS_CHANGE', 'END_WORLD', 'ADD_MEMBER', 'REJOIN_MEMBER'\)/u);
  assert.match(approve, /IF NOT shared_private\.is_actionable_shared_reachability_v1\(p_proposal_id\) THEN\s+RETURN QUERY SELECT 'STALE'::text;/u,
    'a rotated Shared ID ends the request before anything is recorded');
  assert.ok(approve.indexOf('is_actionable_shared_reachability_v1(p_proposal_id)') < approval, 'the binding is checked before the approval');
  assert.match(approve, /public\.dispatch_shared_world_member_invitation_v1\(\s*shared_private\.derive_shared_lifecycle_identity_v1\('MEMBER_INVITATION', p_proposal_id::text\), p_proposal_id\)/u);
  assert.match(approve, /public\.resolve_shared_world_governance_approval_v1\(p_proposal_id, 'REJOIN_MEMBER', v_payload\)/u);
  const member = fnBody('shared_private.propose_shared_world_member_v1');
  assert.match(member, /account_private\.normalize_shared_id_v1\(p_shared_id\)/u);
  assert.match(member, /WHERE s\.credential_lookup_ref = v_ref FOR SHARE/u, 'the target is resolved by exact CURRENT reference only');
  assert.match(member, /RETURNS TABLE \(outcome text\)/u, 'nothing about the target is ever returned');
  assert.match(member, /public\.prepare_shared_world_add_member_governance_v1\(/u);
  assert.match(member, /public\.prepare_shared_world_rejoin_governance_v1\(/u);
  assert.match(member, /record_shared_proposal_origin_v1\(v_proposal, p_command_id, v_user, v_epoch, v_digest\)/u, 'bound to the epoch read under the lock');
  const accept = fnBody('shared_private.accept_shared_membership_request_v1');
  assert.match(accept, /WHERE s\.user_id = v_user FOR SHARE/u, 'the target\'s own credential row, then the binding');
  assert.match(accept, /shared_reachability_target_v1\(p_request_id\) IS DISTINCT FROM v_user\s+OR NOT shared_private\.is_actionable_shared_reachability_v1\(p_request_id\)/u);
  assert.match(accept, /public\.accept_shared_world_member_invitation_v1\(/u);
  assert.match(accept, /public\.commit_shared_world_member_rejoin_v1\(/u);
  const actionable = fnBody('shared_private.is_actionable_shared_reachability_v1');
  assert.match(actionable, /s\.epoch = o\.target_credential_epoch/u, 'only the exact bound epoch is actionable; epochs only grow, so nothing revives');
  const share = fnBody('shared_private.propose_shared_world_history_share_v1');
  assert.match(share, /array_length\(p_material_ids, 1\) > 20/u, 'a package is bounded');
  assert.match(share, /FROM shared_private\.shared_history_share_candidates_v1\(p_world_id, v_user, v_grantee\) c/u,
    'every selected message must be an exact candidate under the World lock');
  assert.match(share, /public\.prepare_shared_world_history_package_v1\(v_manifest, p_world_id, v_grantee, v_items\)/u);
  const candidates = fnBody('shared_private.shared_history_share_candidates_v1');
  assert.match(candidates, /a\.resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT'/u, 'UNRESOLVED material is never offered');
  assert.match(candidates, /public\.resolve_shared_world_history_visibility_v1\(p_world_id, p_grantee_id\)/u, 'the ONE visibility resolver decides what the grantee already sees');
  assert.match(candidates, /m\.material_kind = 'HUMAN_TEXT'/u);
  assert.doesNotMatch(candidates, /is_current_shared_member_v1/u, 'membership is not material authority: no current-approver narrowing');
  const grant = fnBody('shared_private.approve_shared_world_history_share_v1');
  assert.ok(grant.indexOf('public.commit_shared_world_history_package_approval_v1(') < grant.indexOf('public.commit_shared_world_history_access_grant_v1('));
  assert.doesNotMatch(grant, /is_current_shared_member_v1/u, 'a former member who is a required approver approves; membership decides nothing');
  assert.match(grant, /shared_world_history_package_required_approvers ra\s+WHERE ra\.manifest_version_id = p_package_id AND ra\.approver_user_id = v_user/u);
  const page = fnBody('shared_private.list_own_shared_history_share_candidates_v1');
  assert.match(page, /\(m\.established_at, m\.id\) < \(p_before_established_at, p_before_material_id\)/u, 'a bounded page, never a ceiling');
});

test('Product projections: booleans are real booleans; closed viewing is entitlement; former-member control reveals only the owner\'s words', () => {
  for (const [name, pattern] of [
    ['is_current_shared_member_v1', /SELECT COALESCE\(EXISTS \(/u],
    ['is_current_shared_proposal_topology_v1', /SELECT COALESCE\(\(/u],
    ['is_committed_shared_proposal_v1', /SELECT COALESCE\(/u],
    ['shared_proposal_replay_matches_v1', /SELECT COALESCE\(EXISTS \(/u],
  ]) assert.match(fnBody(`shared_private.${name}`), pattern, `${name} never answers NULL`);
  assert.match(fnBody('shared_private.read_shared_governance_capabilities_v1'), /COALESCE\(EXISTS[\s\S]*COALESCE\(EXISTS/u);
  assert.match(fnBody('shared_private.list_own_shared_world_member_handles_v1'), /COALESCE\(e\.user_id = v_user, false\)/u);
  assert.match(fnBody('shared_private.list_own_shared_world_proposals_v1'), /COALESCE\(EXISTS \(SELECT 1 FROM public\.shared_world_governance_approvals a/u);
  assert.match(fnBody('shared_private.list_own_shared_history_share_candidates_v1'), /COALESCE\(m\.author_user_id = v_user, false\)/u);
  assert.match(fnBody('shared_private.list_own_shared_history_share_requests_v1'), /COALESCE\(EXISTS \(SELECT 1 FROM public\.shared_world_history_package_approvals a/u);
  assert.match(fnBody('shared_private.list_own_closed_shared_world_members_v1'), /COALESCE\(other\.user_id = v_user, false\)/u);
  assert.match(fnBody('shared_private.list_own_closed_shared_world_material_v1'), /COALESCE\(m\.author_user_id = v_user, false\)/u);
  // The removal target is never shown the proposal to remove them; the proposer's Name and the neutral progress are
  // shown, never who approved; an add / rejoin target is never named.
  const proposals = fnBody('shared_private.list_own_shared_world_proposals_v1');
  assert.match(proposals, /p\.excluded_membership_episode_id IS DISTINCT FROM mine\.id/u);
  const projected = proposals.split('RETURNS TABLE')[1].split('LANGUAGE')[0];
  assert.match(projected, /proposer_name text, proposer_is_self boolean/u);
  assert.match(projected, /approved_count integer, required_count integer/u);
  assert.doesNotMatch(projected, /approver|approved_by_others|shared_id/u, 'no approver list');
  assert.match(proposals, /CASE WHEN p\.operation_kind = 'REMOVE_MEMBER' THEN tu\.name END/u, 'only a removal target (a current member) is named');
  assert.match(proposals, /COALESCE\(o\.proposer_user_id = v_user, false\)/u);
  // The target of an add / rejoin sees only the kind and the proposer's Name.
  const requestsOfTarget = fnBody('shared_private.list_own_shared_membership_requests_v1');
  assert.match(requestsOfTarget.split('LANGUAGE')[0], /RETURNS TABLE \(request_id uuid, world_id uuid, request_kind text, proposer_name text, created_at timestamptz\)/u);
  // A former member's material authority: own words only, no grantee, no World state.
  const formerAsked = fnBody('shared_private.list_own_former_shared_history_share_requests_v1');
  assert.match(formerAsked, /m\.author_user_id = v_user/u);
  assert.match(formerAsked, /NOT shared_private\.is_current_shared_member_v1\(mv\.world_id, v_user\)/u);
  assert.doesNotMatch(formerAsked, /public\.users|grantee_name|member_name|resolve_shared_world_material/u, 'no grantee, Name or World browsing');
  assert.match(formerAsked, /COALESCE\(EXISTS \(SELECT 1 FROM public\.shared_world_history_package_approvals a/u);
  // Closed viewing reads the entitlement, never membership.
  const closed = fnBody('shared_private.list_own_closed_shared_world_material_v1');
  assert.match(closed, /shared_world_standard_closed_view_entitlements ent/u);
  assert.match(closed, /FROM public\.resolve_shared_world_material_v1\(p_world_id, v_user\)/u);
  assert.doesNotMatch(closed, /ended_at IS NULL/u, 'no fake active membership');
  // Former-member own material: the owner's own HUMAN_TEXT, never another's, never the World around it.
  const former = fnBody('shared_private.list_own_former_shared_world_material_v1');
  assert.match(former, /m\.author_user_id = v_user AND m\.material_kind = 'HUMAN_TEXT'/u);
  assert.match(former, /NOT shared_private\.is_current_shared_member_v1\(m\.world_id, v_user\)/u);
  assert.doesNotMatch(former, /users u|member_name|resolve_shared_world|shared_world_membership_episodes e/u, 'no Name, member, or World browsing');
});

test('the verifier is real PostgreSQL and is wired into the toolchain and API CI after 0139', () => {
  assert.equal(packageJson.scripts['verify:shared-world-lifecycle-governance:integration'],
    'node --env-file-if-exists=.env database/verify-migration-0140.mjs');
  const step = workflow.indexOf('run: npm run verify:shared-world-lifecycle-governance:integration');
  assert.ok(step > workflow.indexOf('run: npm run verify:shared-world-conversation-material:integration'));
  assert.match(verifier, /import pg from 'pg';/u);
  assert.doesNotMatch(verifier, /readFileSync|migrations\//u);
  for (const proof of ['closed gate', 'voluntary leave', 'unanimity', 'removal target never votes', 'stale topology',
    'settings apply once', 'World end', 'closed-view entitlement', 'owner deletion after closure', 'history widening',
    'unresolved material', 'former member', 'cross-World replay', 'non-null booleans', 'concurrent equivalent approvals',
    'unrelated Worlds stay concurrent', 'former-member material authority without World browsing', 'CURRENT Shared ID',
    'epoch binding', 'no enumeration', 'rotation vs acceptance', 'paged without a ceiling', 'neutral progress']) {
    assert.ok(verifier.includes(proof), `the verifier proves ${proof}`);
  }
});
