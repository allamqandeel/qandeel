// Real-PostgreSQL verifier for migration 0096 - I-05B Public Semantic
// Placement, Discussion and Public QANDEEL v1 (PART C).
//
// Runs against a FULLY migrated database and proves, from live catalogs and
// live execution:
//
//   catalog / posture
//     * the three writers and the current-placement derivation are executable
//       by no application role; the three resolvers are service_role-only,
//       consume both canonical gates and disclose no private identity;
//     * placement, post and response history are append-only for every role.
//
//   semantic placement
//     * SP01 the exact controller records the interpretation of the exact
//       visible version; a correction is the next revision, the current one is
//       the highest, history is preserved, and NOTHING about the version, the
//       package, the provenance, the approvals or the control changed;
//     * SP02 a rightsholder, a stranger and a nonexistent Experience get ONE class;
//     * SP03 a version of another Experience and malformed descriptors refuse;
//     * SP04 a DRAFT version may carry an interpretation, but it serves nothing
//       and publishes nothing;
//     * SP05 idempotency, command conflicts, immutability.
//
//   discussion
//     * DS01 a former Shared member and a stranger post on a visible Experience
//       bound to the visible version; a reply binds its parent; the resolver
//       returns them in order with the CURRENT author label;
//     * DS02 a DRAFT, a READY_FOR_REVIEW and a nonexistent target are ONE class;
//     * DS03 a foreign or missing parent gets the same class;
//     * DS04 a human without a Public Identity cannot post;
//     * DS05 posting grants no control, satisfies no approval, restores no
//       Shared browsing;
//     * DS06 idempotency, ordinal uniqueness, immutability, roles.
//
//   Public QANDEEL
//     * QR01 a machine response binds the visible version, a reply target and
//       the consumed posts through a context fingerprint over PUBLIC identities
//       only - recomputed here byte for byte;
//     * QR02 invisible and missing targets are ONE class;
//     * QR03 machine output satisfies no approval and grants no control;
//     * QR04 idempotency and immutability.
//
//   concurrency (committed fixtures, committed seam simulation restored)
//     * C01 publish versus placement serializes on the Experience row;
//     * C02 two concurrent posts receive distinct ordinals.
//
//   forward safety inside a rolled-back SAVEPOINT, then every regression to
//   something 0096 OWNS planted and still refused; and zero fixture residue.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, NONE, SEAM, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, count, actAs, asRole, rejected } = rt;

const CURRENT = 'public.derive_public_experience_current_placement_v1(uuid)';
const PLACEMENT = 'public.record_public_experience_semantic_placement_v1(uuid, uuid, uuid, uuid, text, text)';
const POST = 'public.post_public_discussion_v1(uuid, uuid, uuid, uuid, text)';
const RESPONSE = 'public.record_public_qandeel_response_v1(uuid, uuid, uuid, uuid, text, uuid[])';
const TRIGGER_FN = 'public.reject_public_semantic_presence_mutation_v1()';
const RESOLVERS = [
  'public.resolve_public_experience_semantic_placement_v1(uuid, uuid)',
  'public.resolve_public_discussion_v1(uuid, uuid)',
  'public.resolve_public_qandeel_responses_v1(uuid, uuid)',
];
const OWN_TABLES = [T.PLACEMENTS, T.PLACEMENT_COMMANDS, T.POSTS, T.POST_COMMANDS, T.RESPONSES, T.RESPONSE_COMMANDS];
const sha256 = (text) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;

async function verifyCatalog() {
  await rt.verifyPosture({
    internal: [CURRENT, PLACEMENT, POST, RESPONSE],
    triggers: [TRIGGER_FN],
    reading: [CURRENT],
    mutating: [PLACEMENT, POST, RESPONSE],
    resolvers: RESOLVERS,
    tables: OWN_TABLES,
    immutable: [[T.PLACEMENTS, 'public_experience_semantic_placements_immutable'],
      [T.POSTS, 'public_discussion_posts_immutable'],
      [T.RESPONSES, 'public_qandeel_responses_immutable']],
  });
  for (const fn of [PLACEMENT, POST, RESPONSE]) {
    const p = await rt.functionPosture(fn);
    assert.ok(p.prosrc.includes('FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE'),
      `${fn} holds the exact Experience row while it decides`);
    assert.ok(!p.prosrc.includes('SET current_lifecycle') && !p.prosrc.includes('to_lifecycle') && !p.prosrc.includes('ABSENT_FROM_PUBLIC_WORLD'),
      `${fn} can write no lifecycle`);
    assert.doesNotMatch(p.prosrc,
      /(INSERT INTO|UPDATE|DELETE FROM) public\.(public_experiences|public_experience_versions|public_experience_lifecycle_events|public_experience_publication_state|public_experience_controllers|publication_package|publication_manifest|publication_approval|shared_world|conversation_|users|public_identities|public_identity_display_state)/u,
      `${fn} writes only its own presence family`);
    assert.ok(!p.prosrc.includes('publication_package_item_provenance') && !p.prosrc.includes('shared_world_membership_episodes'),
      `${fn} reads no sealed provenance and no Shared membership`);
    for (const name of await rt.inputParameters(fn)) {
      assert.doesNotMatch(name, /approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|ordinal|revision|basis|fingerprint|author|identity|producer/u,
        `${fn} may not accept ${name}`);
    }
  }
  const placement = await rt.functionPosture(PLACEMENT);
  for (const needle of ['auth.uid()', 'public_experience_controllers', 'INITIAL_INTERPRETATION', 'PUBLISHER_CORRECTION',
    'coalesce(max(sp.placement_revision), 0) + 1']) {
    assert.ok(placement.prosrc.includes(needle), `placement: ${needle}`);
  }
  assert.ok(!placement.prosrc.includes('publication_manifest_approvals'), 'interpretation is not consent');
  const post = await rt.functionPosture(POST);
  for (const needle of ['auth.uid()', 'FROM public.public_identities i WHERE i.user_id = u', 'resolve_public_visibility_state_v1',
    'resolve_public_audience_admission_v1', 'PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE']) {
    assert.ok(post.prosrc.includes(needle), `discussion: ${needle}`);
  }
  for (const forbidden of ['public_experience_controllers', 'publication_manifest_approvals', 'publication_manifest_required_approvers', 'current_lifecycle']) {
    assert.ok(!post.prosrc.includes(forbidden), `discussion authority is not ${forbidden}`);
  }
  const response = await rt.functionPosture(RESPONSE);
  assert.ok(!response.prosrc.includes('auth.uid()'), 'Public QANDEEL derives no human');
  for (const needle of ['resolve_public_visibility_state_v1', 'PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE', 'QANDEEL_CWV2_PUBLIC_QANDEEL_CONTEXT_V1']) {
    assert.ok(response.prosrc.includes(needle), `Public QANDEEL: ${needle}`);
  }
  for (const forbidden of ['shared_world', 'conversation_unit', 'public_experience_controllers', 'publication_manifest_approvals']) {
    assert.ok(!response.prosrc.includes(forbidden), `Public QANDEEL reads no ${forbidden}`);
  }
  // Exact-version closure (REV-03): a reply targets a post of the currently
  // visible version; Public QANDEEL replies to and consumes such posts only; the
  // two conversation resolvers serve rows bound to the visible version only.
  assert.match(post.prosrc, /dp\.id = p_parent_post_id AND dp\.experience_id = p_experience_id\s+AND dp\.target_experience_version_id = visible_version/u,
    'a reply targets a post of the currently visible version, never merely a post of the same Experience');
  assert.match(response.prosrc, /dp\.id = p_in_reply_to_post_id AND dp\.experience_id = p_experience_id\s+AND dp\.target_experience_version_id = visible_version/u,
    'Public QANDEEL replies to a post of the currently visible version only');
  assert.match(response.prosrc, /dp\.id = x AND dp\.experience_id = p_experience_id\s+AND dp\.target_experience_version_id = visible_version/u,
    'Public QANDEEL consumes posts of the currently visible version only');
  assert.ok((await rt.functionPosture(RESOLVERS[1])).prosrc.includes('dp.target_experience_version_id = vs.visible_experience_version_id'),
    'the discussion resolver serves only posts bound to the currently visible version');
  assert.ok((await rt.functionPosture(RESOLVERS[2])).prosrc.includes('r.experience_version_id = vs.visible_experience_version_id'),
    'the Public QANDEEL resolver serves only responses bound to the currently visible version');
  const responseColumns = (await rows(
    'SELECT a.attname FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped', [T.RESPONSES])).map((r) => r.attname);
  assert.ok(responseColumns.length > 0);
  for (const column of responseColumns) {
    assert.doesNotMatch(column, /user_id|author|approv|control|consent|identity/u, `Public QANDEEL output carries no ${column}`);
  }
  const fks = await rows(
    `SELECT c.conrelid::regclass::text child, c.conname, ns.nspname || '.' || cl.relname AS parent, c.confdeltype
       FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.confrelid JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      WHERE c.contype = 'f' AND c.conrelid = ANY($1::regclass[])`, [OWN_TABLES]);
  for (const fk of fks) {
    assert.ok(!['public.public_experience_controllers', 'public.publication_manifest_approvals',
      'public.publication_manifest_required_approvers', 'public.publication_package_item_provenance'].includes(fk.parent),
    `${fk.child} reaches no control, approval or provenance (${fk.conname})`);
    assert.equal(fk.confdeltype, 'r', `${fk.conname} is restrictive`);
  }
  assert.ok(fks.some((fk) => fk.conname === 'public_discussion_posts_parent_fk' && fk.parent === 'public.public_discussion_posts'),
    'a reply binds a post of the same Experience');
  assert.ok(fks.some((fk) => fk.conname === 'public_experience_semantic_placements_version_fk' && fk.parent === 'public.public_experience_versions'),
    'a placement binds the exact version of the exact Experience');
}

async function snapshotImmutables(experience, manifest) {
  const pick = async (table, where, values) => rows(`SELECT * FROM ${table} WHERE ${where} ORDER BY 1`, values);
  return {
    versions: await pick(T.VERSIONS, 'experience_id = $1', [experience]),
    manifests: await pick(T.MANIFESTS, 'experience_id = $1', [experience]),
    items: await pick(T.ITEMS, 'manifest_version_id = $1', [manifest]),
    bodies: await rows(`SELECT b.* FROM ${T.BODIES} b JOIN ${T.ITEMS} it ON it.package_item_id = b.package_item_id WHERE it.manifest_version_id = $1 ORDER BY 1`, [manifest]),
    provenance: await pick(T.PROVENANCE, 'manifest_version_id = $1', [manifest]),
    approvals: await pick(T.APPROVALS, 'manifest_version_id = $1', [manifest]),
    required: await pick(T.REQUIRED, 'manifest_version_id = $1', [manifest]),
    controllers: await pick(T.CONTROLLERS, 'experience_id = $1', [experience]),
    publication: await pick(T.PUBLICATION_STATE, 'experience_id = $1', [experience]),
    lifecycle: await pick(T.LIFECYCLE, 'experience_id = $1', [experience]),
    effective: await rt.deriveManifestApprovals(manifest),
  };
}

async function verifyPlacement(f, x) {
  await actAs(f.mohamed);
  const before = await snapshotImmutables(f.experience, f.manifest);
  const c1 = randomUUID(); const p1 = randomUUID();
  const [initial] = await rt.recordPlacement(c1, p1, f.experience, f.version, 'lens.alpha', 'Orientation of a shared sentence');
  assert.equal(initial.outcome, 'PLACEMENT_RECORDED');
  assert.equal(Number(initial.placement_revision), 1);
  assert.equal(initial.placement_basis, 'INITIAL_INTERPRETATION');
  assert.equal(initial.experience_version_id, f.version);
  // SP01 a correction is the next additive revision; the current one is the highest.
  const c2 = randomUUID(); const p2 = randomUUID();
  const [corrected] = await rt.recordPlacement(c2, p2, f.experience, f.version, 'lens.beta', 'A corrected orientation');
  assert.equal(corrected.outcome, 'PLACEMENT_CORRECTED');
  assert.equal(Number(corrected.placement_revision), 2);
  assert.equal(corrected.placement_basis, 'PUBLISHER_CORRECTION');
  const [current] = await rt.currentPlacement(f.version);
  assert.equal(current.placement_id, p2);
  assert.equal(current.lens_key, 'lens.beta');
  assert.equal(Number(current.placement_revision), 2, 'SP01 the current interpretation is the highest revision');
  assert.equal(await count(T.PLACEMENTS, 'experience_version_id = $1', [f.version]), 2, 'SP01 history is preserved');
  assert.deepEqual(await snapshotImmutables(f.experience, f.manifest), before,
    'SP01 a correction changed no version, package, body, provenance, approval, control, publication or lifecycle row');
  const [served] = await rt.resolvePlacement(f.experience, f.reader);
  assert.equal(served.lens_key, 'lens.beta');
  assert.equal(served.semantic_label, 'A corrected orientation');
  assert.equal(Number(served.placement_revision), 2);
  assert.deepEqual(await rt.resolvePlacement(f.experience, null), [], 'signed-out is not admitted');
  assert.deepEqual(await rt.resolvePlacement(randomUUID(), f.reader), []);
  assert.deepEqual(await rt.currentPlacement(null), [], 'a NULL version has no interpretation');

  // SP05 idempotency, conflicts, immutability.
  const [retry] = await rt.recordPlacement(c1, p1, f.experience, f.version, 'lens.alpha', 'Orientation of a shared sentence');
  assert.equal(retry.outcome, 'ALREADY_COMMITTED');
  assert.equal(Number(retry.placement_revision), 1);
  assert.equal(retry.placement_basis, 'INITIAL_INTERPRETATION');
  await rejected(() => rt.recordPlacement(c1, randomUUID(), f.experience, f.version, 'lens.alpha', 'Orientation of a shared sentence'), ['23505'],
    /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
  await rejected(() => rt.recordPlacement(randomUUID(), p1, f.experience, f.version, 'lens.gamma', 'reused identity'), ['23505'],
    /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
  await rejected(() => q(`UPDATE ${T.PLACEMENTS} SET semantic_label = 'rewritten' WHERE id = $1`, [p1]), ['55000'], /PUBLIC_SEMANTIC_PRESENCE_IS_IMMUTABLE/u);
  await rejected(() => q(`DELETE FROM ${T.PLACEMENTS} WHERE id = $1`, [p1]), ['55000']);

  // SP02 one class for a rightsholder, a stranger and a nonexistent Experience.
  await actAs(f.hadir);
  const byRightsholder = await rejected(() => rt.recordPlacement(randomUUID(), randomUUID(), f.experience, f.version, 'lens.x', 'not mine'), ['42501'], /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);
  await actAs(f.stranger);
  const byStranger = await rejected(() => rt.recordPlacement(randomUUID(), randomUUID(), f.experience, f.version, 'lens.x', 'not mine'), ['42501']);
  await actAs(f.mohamed);
  const absent = await rejected(() => rt.recordPlacement(randomUUID(), randomUUID(), randomUUID(), f.version, 'lens.x', 'nothing'), ['42501']);
  assert.equal(byRightsholder.message, absent.message, 'SP02 no existence oracle');
  assert.equal(byStranger.message, absent.message);
  await actAs(null);
  await rejected(() => rt.recordPlacement(randomUUID(), randomUUID(), f.experience, f.version, 'lens.x', 'x'), ['42501'], /AUTHENTICATION_REQUIRED/u);
  await actAs(f.mohamed);

  // SP03 wrong version and malformed descriptors.
  await rejected(() => rt.recordPlacement(randomUUID(), randomUUID(), f.experience, x.dv, 'lens.x', 'other experience version'), ['P0002'], /PUBLIC_EXPERIENCE_NOT_AVAILABLE/u);
  await rejected(() => rt.recordPlacement(randomUUID(), randomUUID(), f.experience, f.version, 'Bad Lens', 'x'), ['22023']);
  await rejected(() => rt.recordPlacement(randomUUID(), randomUUID(), f.experience, f.version, 'lens.x', 'two\nlines'), ['22023']);
  await rejected(() => rt.recordPlacement(randomUUID(), randomUUID(), f.experience, f.version, 'lens.x', 'x'.repeat(121)), ['22023']);
  await rejected(() => rt.recordPlacement(randomUUID(), randomUUID(), f.experience, f.version, 'lens.x', '   '), ['22023']);

  // SP04 a DRAFT version may carry an interpretation, which serves nothing and
  // publishes nothing: interpretation is not publication authority.
  const [draftPlacement] = await rt.recordPlacement(randomUUID(), randomUUID(), x.draft, x.dv, 'lens.draft', 'A draft interpretation');
  assert.equal(draftPlacement.outcome, 'PLACEMENT_RECORDED');
  assert.deepEqual(await rt.resolvePlacement(x.draft, f.reader), [], 'SP04 a DRAFT interpretation is not served');
  await rejected(() => rt.publish(randomUUID(), x.draft, x.dv), ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);
  assert.equal((await rt.visibility(x.draft))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE');
  return { p1, p2 };
}

async function verifyDiscussion(f, x) {
  const before = await snapshotImmutables(f.experience, f.manifest);
  // DS01 a former Shared member posts, a stranger posts, the former member replies.
  await actAs(f.hadir);
  const post1 = randomUUID(); const cmd1 = randomUUID();
  const [first] = await rt.post(cmd1, post1, f.experience, null, 'a first public thought');
  assert.equal(first.outcome, 'POSTED');
  assert.equal(Number(first.post_ordinal), 1);
  assert.equal(first.target_experience_version_id, f.version, 'DS01 the post binds the exact visible version');
  assert.equal(first.author_public_identity_ref, f.hadirRef, 'DS01 the author is the stable Public Identity, resolved');
  await actAs(f.stranger);
  const post2 = randomUUID();
  const [second] = await rt.post(randomUUID(), post2, f.experience, null, 'a stranger joins in');
  assert.equal(Number(second.post_ordinal), 2);
  await actAs(f.hadir);
  const post3 = randomUUID();
  const [reply] = await rt.post(randomUUID(), post3, f.experience, post1, 'a reply to the first');
  assert.equal(reply.outcome, 'REPLIED');
  assert.equal(reply.parent_post_id, post1);
  assert.equal(Number(reply.post_ordinal), 3);
  const thread = await rt.resolveDiscussion(f.experience, f.reader);
  assert.deepEqual(thread.map((r) => [Number(r.post_ordinal), r.author_display_label, r.parent_post_id]),
    [[1, 'hadir public', null], [2, 'a stranger', null], [3, 'hadir public', post1]], 'DS01 deterministic order with the CURRENT author label');
  for (const row of thread) {
    for (const column of Object.keys(row)) assert.doesNotMatch(column, /user_id|shared_|world_id|session/u, `DS01 no ${column} served`);
  }
  // The label is the CURRENT one: a rename shows everywhere at once.
  await rt.updateLabel(randomUUID(), 'REAL_NAME', 'Hadir renamed');
  assert.equal((await rt.resolveDiscussion(f.experience, f.reader))[0].author_display_label, 'Hadir renamed');

  // DS02 / DS03 one class for invisible, nonexistent, foreign parent, missing parent.
  const onDraft = await rejected(() => rt.post(randomUUID(), randomUUID(), x.draft, null, 'on a draft'), ['P0002'], /PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE/u);
  const onReady = await rejected(() => rt.post(randomUUID(), randomUUID(), x.readyExp, null, 'on a ready one'), ['P0002'], /PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE/u);
  const onNothing = await rejected(() => rt.post(randomUUID(), randomUUID(), randomUUID(), null, 'on nothing'), ['P0002'], /PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE/u);
  const badParent = await rejected(() => rt.post(randomUUID(), randomUUID(), f.experience, randomUUID(), 'reply to nothing'), ['P0002'], /PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE/u);
  assert.equal(onDraft.message, onNothing.message, 'DS02 DRAFT and nonexistent are indistinguishable');
  assert.equal(onReady.message, onNothing.message, 'DS02 READY_FOR_REVIEW and nonexistent are indistinguishable');
  assert.equal(badParent.message, onNothing.message, 'DS03 a missing parent is the same class');
  const self = randomUUID();
  await rejected(() => rt.post(randomUUID(), self, f.experience, self, 'self reply'), ['22023']);
  await rejected(() => rt.post(randomUUID(), randomUUID(), f.experience, null, '   '), ['22023']);
  // DS04 a human without a Public Identity cannot post.
  await actAs(f.reader);
  await rejected(() => rt.post(randomUUID(), randomUUID(), f.experience, null, 'no identity'), ['42501'], /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);
  await actAs(null);
  await rejected(() => rt.post(randomUUID(), randomUUID(), f.experience, null, 'nobody'), ['42501'], /AUTHENTICATION_REQUIRED/u);
  // The controller posts on the same terms as anyone else.
  await actAs(f.mohamed);
  const [byController] = await rt.post(randomUUID(), randomUUID(), f.experience, null, 'the publisher replies too');
  assert.equal(Number(byController.post_ordinal), 4);

  // DS05 posting grants no control, satisfies no approval, restores no browsing.
  assert.deepEqual(await snapshotImmutables(f.experience, f.manifest), { ...before },
    'DS05 no version, package, approval, control, publication or lifecycle row changed');
  const [{ n: open }] = await rows(
    'SELECT count(*) n FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL', [f.world, f.hadir]);
  assert.equal(Number(open), 0, 'DS05 posting restores no Shared browsing');

  // DS06 idempotency, ordinal uniqueness, immutability, roles.
  await actAs(f.hadir);
  const [retry] = await rt.post(cmd1, post1, f.experience, null, 'a first public thought');
  assert.equal(retry.outcome, 'ALREADY_COMMITTED');
  assert.equal(Number(retry.post_ordinal), 1);
  await rejected(() => rt.post(cmd1, randomUUID(), f.experience, null, 'a first public thought'), ['23505'], /COMMAND_ID_CONFLICT/u);
  await rejected(() => rt.post(randomUUID(), post1, f.experience, null, 'reuse'), ['23505'], /COMMAND_ID_CONFLICT/u);
  await rejected(() => q(`INSERT INTO ${T.POSTS} (id, experience_id, target_experience_version_id, parent_post_id, post_ordinal,
                            author_public_identity_ref, author_user_id, post_body, posted_at)
                          VALUES ($1, $2, $3, NULL, 1, $4, $5, 'forged', now())`, [randomUUID(), f.experience, f.version, f.hadirRef, f.hadir]), ['23505']);
  await rejected(() => q(`UPDATE ${T.POSTS} SET post_body = 'rewritten' WHERE id = $1`, [post1]), ['55000'], /PUBLIC_SEMANTIC_PRESENCE_IS_IMMUTABLE/u);
  await rejected(() => q(`DELETE FROM ${T.POSTS} WHERE id = $1`, [post3]), ['55000']);
  assert.deepEqual(await rt.resolveDiscussion(f.experience, null), [], 'DS06 signed-out reads nothing');
  assert.deepEqual(await rt.resolveDiscussion(x.draft, f.reader), []);
  assert.deepEqual(await rt.resolveDiscussion(randomUUID(), f.reader), []);
  for (const role of APP_ROLES) {
    await q('SAVEPOINT v');
    await asRole(role, f.hadir);
    if (role === 'service_role') assert.equal((await rt.resolveDiscussion(f.experience, f.reader)).length, 4);
    else await rejected(() => rt.resolveDiscussion(f.experience, f.reader), ['42501']);
    await rejected(() => rt.post(randomUUID(), randomUUID(), f.experience, null, 'x'), ['42501']);
    await rejected(() => rt.recordPlacement(randomUUID(), randomUUID(), f.experience, f.version, 'lens.x', 'x'), ['42501']);
    await rejected(() => rt.recordResponse(randomUUID(), randomUUID(), f.experience, null, 'x', NONE), ['42501']);
    for (const table of OWN_TABLES) await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), ['42501']);
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT v'); await q('RELEASE SAVEPOINT v');
  }
  return { post1, post2, post3 };
}

async function verifyQandeel(f, x, posts, placements) {
  const before = await snapshotImmutables(f.experience, f.manifest);
  await actAs(null);
  const r1 = randomUUID(); const c1 = randomUUID();
  const [recorded] = await rt.recordResponse(c1, r1, f.experience, posts.post1, 'QANDEEL responds in public', [posts.post1, posts.post2]);
  assert.equal(recorded.outcome, 'RESPONSE_RECORDED');
  assert.equal(Number(recorded.response_ordinal), 1);
  assert.equal(recorded.experience_version_id, f.version, 'QR01 bound to the visible version');
  // QR01 the context fingerprint binds PUBLIC identities only, and is recomputable.
  const consumed = [posts.post1, posts.post2].map((id) => id.toLowerCase()).sort();
  const expected = sha256(['QANDEEL_CWV2_PUBLIC_QANDEEL_CONTEXT_V1',
    `experience=${f.experience.toLowerCase()}`, `experienceVersion=${f.version.toLowerCase()}`, `manifest=${f.manifest.toLowerCase()}`,
    'placementRevision=2', `replyTo=${posts.post1.toLowerCase()}`, `consumed=${consumed.join(',')}`].join('\n'));
  assert.equal(recorded.context_fingerprint, expected,
    'QR01 the fingerprint is exactly the hash of the Experience, version, manifest, current placement revision, reply target and consumed posts');
  const [stored] = await rows(`SELECT * FROM ${T.RESPONSES} WHERE id = $1`, [r1]);
  assert.equal(stored.producer_kind, 'PUBLIC_QANDEEL');
  assert.equal(stored.in_reply_to_post_id, posts.post1);
  const served = await rt.resolveResponses(f.experience, f.reader);
  assert.equal(served.length, 1);
  assert.equal(served[0].response_body, 'QANDEEL responds in public');
  assert.ok(!('context_fingerprint' in served[0]), 'QR01 the runtime-integrity fingerprint is not served');
  const [plain] = await rt.recordResponse(randomUUID(), randomUUID(), f.experience, null, 'a second response', NONE);
  assert.equal(Number(plain.response_ordinal), 2);
  assert.notEqual(plain.context_fingerprint, recorded.context_fingerprint);
  assert.deepEqual(await rt.resolveResponses(f.experience, null), [], 'signed-out reads nothing');

  // QR02 invisible / nonexistent / foreign targets: ONE class.
  const onDraft = await rejected(() => rt.recordResponse(randomUUID(), randomUUID(), x.draft, null, 'x', NONE), ['P0002'], /PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE/u);
  const onNothing = await rejected(() => rt.recordResponse(randomUUID(), randomUUID(), randomUUID(), null, 'x', NONE), ['P0002'], /PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE/u);
  const badReply = await rejected(() => rt.recordResponse(randomUUID(), randomUUID(), f.experience, randomUUID(), 'x', NONE), ['P0002'], /PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE/u);
  const badConsumed = await rejected(() => rt.recordResponse(randomUUID(), randomUUID(), f.experience, null, 'x', [posts.post1, randomUUID()]), ['P0002'], /PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE/u);
  assert.equal(onDraft.message, onNothing.message, 'QR02 DRAFT and nonexistent are indistinguishable');
  assert.equal(badReply.message, onNothing.message);
  assert.equal(badConsumed.message, onNothing.message);
  await rejected(() => rt.recordResponse(randomUUID(), randomUUID(), f.experience, null, '  ', NONE), ['22023']);
  await rejected(() => rt.recordResponse(randomUUID(), randomUUID(), f.experience, null, 'x', null), ['22023']);

  // QR03 machine output satisfies no approval and grants no control. The
  // controller's own attempt to publish the DRAFT still fails on lifecycle -
  // the machine output moved nothing - so the attempt is made AS the
  // controller; as nobody it would fail one gate earlier, on authentication.
  assert.deepEqual(await snapshotImmutables(f.experience, f.manifest), before,
    'QR03 no approval, control, package, publication or lifecycle row changed');
  await actAs(f.mohamed);
  await rejected(() => rt.publish(randomUUID(), x.draft, x.dv), ['55000'], /LIFECYCLE_INVALID/u);
  await actAs(null);
  assert.equal(placements.p2.length > 0, true);

  // QR04 idempotency and immutability.
  const [retry] = await rt.recordResponse(c1, r1, f.experience, posts.post1, 'QANDEEL responds in public', [posts.post1, posts.post2]);
  assert.equal(retry.outcome, 'ALREADY_COMMITTED');
  assert.equal(retry.context_fingerprint, expected);
  await rejected(() => rt.recordResponse(c1, randomUUID(), f.experience, null, 'other', NONE), ['23505'], /COMMAND_ID_CONFLICT/u);
  await rejected(() => rt.recordResponse(randomUUID(), r1, f.experience, null, 'reuse', NONE), ['23505'], /COMMAND_ID_CONFLICT/u);
  await rejected(() => q(`UPDATE ${T.RESPONSES} SET response_body = 'rewritten' WHERE id = $1`, [r1]), ['55000'], /PUBLIC_SEMANTIC_PRESENCE_IS_IMMUTABLE/u);
  return { r1 };
}

async function verifySuccessorVersion(f, posts, responses) {
  // DS07 / QR05 EXACT-VERSION CLOSURE UNDER A SUCCESSOR VISIBLE VERSION. Real V1
  // history exists above, written by the real writers. The canonical visible
  // truth then moves to a valid successor V2 fixture (a verifier-only
  // simulation; successor publication semantics belong to a later slice), and
  // V1's conversation must not be served, replied to or consumed as V2's -
  // while V2's own conversation, through the same writers, is.
  const v1Posts = await count(T.POSTS, 'experience_id = $1 AND target_experience_version_id = $2', [f.experience, f.version]);
  const v1Responses = await count(T.RESPONSES, 'experience_id = $1 AND experience_version_id = $2', [f.experience, f.version]);
  assert.ok(v1Posts >= 4 && v1Responses >= 2, 'DS07 fixture: real V1 conversation exists');
  assert.equal((await rt.resolveDiscussion(f.experience, f.reader)).length, v1Posts, 'DS07 fixture: V1 is served while V1 is the visible version');
  await q('SAVEPOINT successor');
  try {
    const { successorVersion, successorManifest } = await rt.simulateSuccessorVersion(f.experience, f.manifest);
    assert.deepEqual(await rt.resolveDiscussion(f.experience, f.reader), [],
      'DS07 posts bound to the superseded version are not served as the successor version\'s');
    assert.deepEqual(await rt.resolveResponses(f.experience, f.reader), [],
      'QR05 responses bound to the superseded version are not served as the successor version\'s');
    assert.deepEqual(await rt.resolvePlacement(f.experience, f.reader), [], 'the V1 interpretation is not served as V2\'s either');
    assert.equal(await count(T.POSTS, 'experience_id = $1 AND target_experience_version_id = $2', [f.experience, f.version]), v1Posts,
      'DS07 V1 history is intact: nothing was rewritten, moved or deleted');
    assert.equal(await count(T.RESPONSES, 'experience_id = $1 AND experience_version_id = $2', [f.experience, f.version]), v1Responses);
    // A reply to a V1 post, Public QANDEEL replying to a V1 post, and Public
    // QANDEEL consuming a V1 post: refused with the ONE bounded class each.
    await actAs(f.hadir);
    const crossReply = await rejected(() => rt.post(randomUUID(), randomUUID(), f.experience, posts.post1, 'a reply across versions'),
      ['P0002'], /PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE/u);
    const noParent = await rejected(() => rt.post(randomUUID(), randomUUID(), f.experience, randomUUID(), 'a reply to nothing'),
      ['P0002'], /PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE/u);
    assert.equal(crossReply.message, noParent.message, 'DS07 a superseded-version parent is the same bounded class as a nonexistent one');
    await actAs(null);
    const crossReplyQ = await rejected(() => rt.recordResponse(randomUUID(), randomUUID(), f.experience, posts.post1, 'across versions', NONE),
      ['P0002'], /PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE/u);
    const crossConsumeQ = await rejected(() => rt.recordResponse(randomUUID(), randomUUID(), f.experience, null, 'across versions', [posts.post2]),
      ['P0002'], /PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE/u);
    const noTargetQ = await rejected(() => rt.recordResponse(randomUUID(), randomUUID(), f.experience, randomUUID(), 'to nothing', NONE),
      ['P0002'], /PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE/u);
    assert.equal(crossReplyQ.message, noTargetQ.message, 'QR05 a superseded-version reply target is the same bounded class as a nonexistent one');
    assert.equal(crossConsumeQ.message, noTargetQ.message, 'QR05 and so is a superseded-version consumed post');
    // Anti-vacuity: V2 conversation through the real writers IS served, bound to V2 and M2.
    await actAs(f.stranger);
    const v2Post = randomUUID();
    const [posted] = await rt.post(randomUUID(), v2Post, f.experience, null, 'a thought on the successor');
    assert.equal(posted.target_experience_version_id, successorVersion, 'DS07 a new post binds the successor version');
    assert.equal(Number(posted.post_ordinal), v1Posts + 1, 'DS07 the per-Experience ordinal keeps counting: history is not renumbered');
    await actAs(null);
    const v2Response = randomUUID();
    const [produced] = await rt.recordResponse(randomUUID(), v2Response, f.experience, v2Post, 'QANDEEL on the successor', [v2Post]);
    assert.equal(produced.experience_version_id, successorVersion, 'QR05 a new response binds the successor version');
    const successorPrint = sha256(['QANDEEL_CWV2_PUBLIC_QANDEEL_CONTEXT_V1',
      `experience=${f.experience.toLowerCase()}`, `experienceVersion=${successorVersion.toLowerCase()}`,
      `manifest=${successorManifest.toLowerCase()}`, 'placementRevision=NONE',
      `replyTo=${v2Post.toLowerCase()}`, `consumed=${v2Post.toLowerCase()}`].join('\n'));
    assert.equal(produced.context_fingerprint, successorPrint,
      'QR05 the context fingerprint binds the successor version and manifest, and the successor has no interpretation of its own yet');
    assert.deepEqual((await rt.resolveDiscussion(f.experience, f.reader)).map((r) => r.post_id), [v2Post], 'DS07 exactly the successor conversation is served');
    assert.deepEqual((await rt.resolveResponses(f.experience, f.reader)).map((r) => r.response_id), [v2Response], 'QR05 exactly the successor responses are served');
  } finally {
    await q('ROLLBACK TO SAVEPOINT successor'); await q('RELEASE SAVEPOINT successor');
  }
  assert.equal((await rt.resolveDiscussion(f.experience, f.reader)).length, v1Posts, 'the simulation rolled back: V1 is the visible version and is served again');
  assert.equal((await rt.resolveResponses(f.experience, f.reader)).some((r) => r.response_id === responses.r1), true);
}

async function verifyForwardSafety(f) {
  await q('SAVEPOINT forward_safety');
  try {
    await q(`CREATE TABLE public.i05b96_probe_reactions (id uuid PRIMARY KEY, post_id uuid NOT NULL REFERENCES ${T.POSTS} (id), kind text NOT NULL)`);
    await q(`CREATE TABLE public.i05b96_probe_spatial_placement (
               experience_version_id uuid PRIMARY KEY REFERENCES ${T.VERSIONS} (id), x double precision NOT NULL, y double precision NOT NULL)`);
    await q(`CREATE FUNCTION public.i05b96_probe_absence_v1(p_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN UPDATE public.public_experiences e
                      SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD' WHERE e.id = p_id; END$fn$`);
    await q(`ALTER TABLE ${T.POST_COMMANDS} ADD COLUMN i05b96_probe_note text`);
    await q(`CREATE INDEX i05b96_probe_idx ON ${T.POSTS} (posted_at)`);
    await verifyCatalog();
    // A later non-serving lifecycle turns discussion and responses dark at once.
    await q('SELECT public.i05b96_probe_absence_v1($1)', [f.experience]);
    assert.deepEqual(await rt.resolveDiscussion(f.experience, f.reader), [], 'disappearance composes through the ONE visibility truth');
    assert.deepEqual(await rt.resolveResponses(f.experience, f.reader), []);
    assert.deepEqual(await rt.resolvePlacement(f.experience, f.reader), []);
    await actAs(f.hadir);
    await rejected(() => rt.post(randomUUID(), randomUUID(), f.experience, null, 'after absence'), ['P0002'], /PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE/u);
    assert.ok(await count(T.POSTS, 'experience_id = $1', [f.experience]) > 0, 'and no historical post was rewritten');

    const refuses = { name: 'AssertionError' };
    await q('SAVEPOINT r1');
    await q(`GRANT EXECUTE ON FUNCTION ${POST} TO authenticated`);
    await assert.rejects(verifyCatalog(), refuses, 'a writer becoming reachable before the Launch Gate is a regression');
    await q('ROLLBACK TO SAVEPOINT r1');
    await q('SAVEPOINT r2');
    await q(`ALTER TABLE ${T.PLACEMENTS} DISABLE TRIGGER public_experience_semantic_placements_immutable`);
    await assert.rejects(verifyCatalog(), refuses, 'a mutable placement history is a regression');
    await q('ROLLBACK TO SAVEPOINT r2');
    await q('SAVEPOINT r3');
    await q(`ALTER TABLE ${T.RESPONSES} ADD COLUMN author_user_id uuid`);
    await assert.rejects(verifyCatalog(), refuses, 'Public QANDEEL output acquiring a human author is a regression');
    await q('ROLLBACK TO SAVEPOINT r3');
    await q('SAVEPOINT r4');
    await q(`CREATE OR REPLACE FUNCTION public.post_public_discussion_v1(p_command_id uuid, p_post_id uuid, p_experience_id uuid, p_parent_post_id uuid, p_post_body text)
             RETURNS TABLE(outcome text, post_id uuid, experience_id uuid, target_experience_version_id uuid,
                           parent_post_id uuid, post_ordinal bigint, author_public_identity_ref uuid, committed_at timestamptz)
             LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $fn$
             BEGIN PERFORM 1 FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
                   PERFORM auth.uid(); PERFORM 1 FROM public.public_identities i WHERE i.user_id = auth.uid(); RETURN; END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'a discussion writer that stops resolving its target through canonical visibility is a regression');
    await q('ROLLBACK TO SAVEPOINT r4');
    await q('SAVEPOINT r5');
    await q(`GRANT EXECUTE ON FUNCTION ${RESOLVERS[1]} TO anon`);
    await assert.rejects(verifyCatalog(), refuses, 'a resolver opening to anon is a regression');
    await q('ROLLBACK TO SAVEPOINT r5');
    await q('SAVEPOINT r6');
    // A discussion resolver that serves every version's posts as the visible
    // version's: the Experience-wide policy REV-03 refuses to choose silently.
    // Same signature, so CREATE OR REPLACE installs it with its ACL intact.
    await q(`CREATE OR REPLACE FUNCTION public.resolve_public_discussion_v1(p_experience_id uuid, p_viewer_user_id uuid)
             RETURNS TABLE(post_id uuid, experience_id uuid, target_experience_version_id uuid, parent_post_id uuid,
                           post_ordinal bigint, author_public_identity_ref uuid, author_label_mode text,
                           author_display_label text, post_body text, posted_at timestamptz)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
             BEGIN RETURN QUERY
               SELECT dp.id, dp.experience_id, dp.target_experience_version_id, dp.parent_post_id, dp.post_ordinal,
                      dp.author_public_identity_ref, d.label_mode, d.display_label, dp.post_body, dp.posted_at
                 FROM public.resolve_public_visibility_state_v1(p_experience_id) vs
                 JOIN public.resolve_public_audience_admission_v1(p_viewer_user_id) ad ON ad.admission = 'ADMITTED'
                 JOIN public.public_discussion_posts dp ON dp.experience_id = vs.experience_id
                 JOIN public.public_identity_display_state d ON d.public_identity_ref = dp.author_public_identity_ref
                WHERE vs.visibility_state = 'PUBLICLY_VISIBLE' ORDER BY dp.post_ordinal; END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'a discussion resolver that serves a superseded version\'s posts as the visible version\'s is a regression');
    await q('ROLLBACK TO SAVEPOINT r6');
  } finally {
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
  }
}

async function verifyConcurrency(c, seam) {
  const { q2, actAs2, close } = await rt.openSecondary();
  try {
    await asRole('postgres');
    const ready = await rt.bringToReady(c, { experience: c.experience, manifest: c.manifest, version: c.version, personal: false });
    await asRole('postgres');
    await rt.clearPrerequisites();

    // C01 PUBLISH VERSUS PLACEMENT: the placement blocks on the Experience row
    // the publication holds and lands on the published version afterwards.
    console.log('0096 concurrency C01 start');
    await q('BEGIN');
    await actAs(c.mohamed);
    const [published] = await rt.publish(randomUUID(), ready.experience, ready.version);
    assert.equal(published.outcome, 'PUBLISHED');
    await q2('BEGIN');
    await actAs2(c.mohamed);
    const placing = q2('SELECT * FROM public.record_public_experience_semantic_placement_v1($1, $2, $3, $4, $5, $6)',
      [randomUUID(), randomUUID(), ready.experience, ready.version, 'lens.race', 'placed during a publication']);
    assert.equal(await rt.stillPending(placing), true, 'C01 the placement blocks behind the publication');
    await q('COMMIT');
    const [placed] = (await placing).rows;
    await q2('COMMIT');
    assert.equal(placed.outcome, 'PLACEMENT_RECORDED');
    assert.equal(Number(placed.placement_revision), 1);
    assert.equal((await rt.resolvePlacement(ready.experience, c.reader))[0].lens_key, 'lens.race');
    console.log('0096 concurrency C01 pass');

    // C02 TWO CONCURRENT POSTS receive distinct ordinals: the second blocks on
    // the Experience row and derives its ordinal after the first committed.
    console.log('0096 concurrency C02 start');
    await q('BEGIN');
    await actAs(c.hadir);
    const [first] = await rt.post(randomUUID(), randomUUID(), ready.experience, null, 'first in flight');
    assert.equal(Number(first.post_ordinal), 1);
    await q2('BEGIN');
    await actAs2(c.stranger);
    const posting = q2('SELECT * FROM public.post_public_discussion_v1($1, $2, $3, $4, $5)',
      [randomUUID(), randomUUID(), ready.experience, null, 'second in flight']);
    assert.equal(await rt.stillPending(posting), true, 'C02 the second post blocks behind the first');
    await q('COMMIT');
    const [second] = (await posting).rows;
    await q2('COMMIT');
    assert.equal(Number(second.post_ordinal), 2, 'C02 distinct ordinals, deterministic order');
    assert.deepEqual((await rt.resolveDiscussion(ready.experience, c.reader)).map((r) => Number(r.post_ordinal)), [1, 2]);
    console.log('0096 concurrency C02 pass');
  } finally {
    await close();
    await asRole('postgres');
    await rt.restorePrerequisites(seam);
    console.log('0096 concurrency seam restored');
  }
}

await runVerifier('0096', async (stage) => {
  await rt.client.connect();
  stage('catalog');
  await asRole('postgres');
  await verifyCatalog();
  const seam = await rt.captureSeam();

  const f = rt.newFixture();
  await q('BEGIN');
  try {
    stage('fixtures');
    await rt.provision(f);
    await rt.provisionIdentities(f);
    await rt.bringToReady(f, { experience: f.experience, manifest: f.manifest, version: f.version });
    const [published] = await rt.publishCleared(seam, f.mohamed, randomUUID(), f.experience, f.version);
    assert.equal(published.outcome, 'PUBLISHED', 'fixture: the Experience published under a simulated clearance');
    // A DRAFT and a READY_FOR_REVIEW Experience for the invisible-target proofs.
    await actAs(f.mohamed);
    const draft = randomUUID(); const dm = randomUUID(); const dv = randomUUID();
    await rt.createDraft(randomUUID(), draft);
    await rt.prepare(randomUUID(), draft, dm, dv, [randomUUID()], [f.userUnit], NONE, NONE, NONE);
    const readyExp = randomUUID();
    await rt.bringToReady(f, { experience: readyExp, manifest: randomUUID(), version: randomUUID(), personal: false, shared: [f.mohamedMaterial] });
    const x = { draft, dv, readyExp };
    stage('semantic placement');
    const placements = await verifyPlacement(f, x);
    stage('discussion');
    const posts = await verifyDiscussion(f, x);
    stage('Public QANDEEL');
    const responses = await verifyQandeel(f, x, posts, placements);
    stage('successor version closure');
    await verifySuccessorVersion(f, posts, responses);
    stage('forward safety');
    await asRole('postgres');
    await verifyForwardSafety(f);
  } finally {
    await q('ROLLBACK');
  }
  assert.equal((await rt.functionPosture(SEAM)).prosrc, seam.prosrc, 'the production seam is intact after the rolled-back section');

  stage('concurrency');
  const c = rt.newFixture();
  c.humans = [c.mohamed, c.hadir, c.stranger, c.reader];
  c.experiences = [c.experience];
  try {
    await asRole('postgres');
    await q('BEGIN');
    try {
      await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [c.humans]);
      await rt.provisionWorld(c, c.world);
      await rt.provisionIdentities(c);
      await asRole('postgres');
    } finally {
      await q('COMMIT');
    }
    await verifyConcurrency(c, seam);
  } finally {
    stage('concurrency: fixture removal');
    await rt.removeCommittedFixtures(c);
  }

  stage('fixture residue');
  await asRole('postgres');
  assert.equal((await rt.functionPosture(SEAM)).prosrc, seam.prosrc, 'the production seam is exactly what the migration installed');
  const humans = [f.mohamed, f.hadir, f.stranger, f.reader, c.mohamed, c.hadir, c.stranger, c.reader];
  const [{ n }] = await rows(
    `SELECT (SELECT count(*) FROM ${T.IDENTITIES} WHERE user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${T.POSTS} WHERE author_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${T.PLACEMENTS} WHERE recorded_by_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${T.RESPONSES} WHERE experience_id = ANY($2::uuid[]))
          + (SELECT count(*) FROM ${T.EXPERIENCES} WHERE id = ANY($2::uuid[]))
          + (SELECT count(*) FROM public.shared_worlds WHERE id = ANY($3::uuid[]))
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
          + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
    [humans, [f.experience, c.experience], [f.world, c.world]]);
  assert.equal(Number(n), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
