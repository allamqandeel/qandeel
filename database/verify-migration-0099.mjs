// Real-PostgreSQL verifier for migration 0099 - I-05C Public Experience
// Disappearance Runtime v1 (PART B).
//
// Runs against a FULLY migrated database and proves, from live catalogs and
// live execution, the durable convergence that follows PART A - and proves that
// it is defense in depth rather than the thing that enforced privacy.
//
//   catalog / posture
//     * the controlled core, both consequential primitives and the internal
//       audit boundary are executable by no application role;
//     * the core is the ONE writer of ABSENT_FROM_PUBLIC_WORLD, both commands
//       delegate to it and write no lifecycle of their own, and none of them
//       writes a serving lifecycle at all;
//     * both relations bind ONE exact publication row through ONE composite
//       restrictive foreign key onto the additive candidate key;
//     * the disappearance record is append-only, sealed, and carries only a
//       bounded basis;
//     * every Public WRITER still revalidates canonical visibility;
//     * no application role holds any privilege on the Experience relation.
//
//   authorized removal
//     * DR01 the exact controller removes a published Experience: lifecycle,
//       append-only transition, sealed record, projection cleanup and command,
//       all in one transaction, and every Public surface is dark;
//     * DR02 a stranger, a rightsholder who is not a controller and a
//       nonexistent Experience reach ONE bounded class;
//     * DR03 a version that is not the published one is refused as stale;
//     * DR04 durable idempotency: replay, cross-target reuse, convergence;
//     * DR05 a DRAFT and a READY_FOR_REVIEW Experience are not in the Public
//       World, so there is nothing to remove from it;
//     * DR06 no immutable historical evidence is erased;
//     * DR07 nothing unrelated is collateral-damaged;
//     * DR08 every public write path refuses afterwards;
//     * DR09 nothing reactivates it and no successor package appears.
//
//   deterministic reconciliation
//     * RC01 a still-eligible publication converges to nothing;
//     * RC02 a withdrawn required approval converges with that exact basis -
//       AFTER canonical truth had already gone dark;
//     * RC03 a lost source converges with the source basis;
//     * RC04 never-published and nonexistent are NOT_APPLICABLE;
//     * RC05 idempotency and convergence;
//     * RC06 it derives no human and needs no authenticated actor.
//
//   audit: the sealed record is reachable only through the internal boundary,
//   discloses no source or private identity, and is immutable for the owner.
//
//   forward safety inside a rolled-back SAVEPOINT, and a race matrix on
//   committed fixtures with database-bounded waits.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, NONE, SEAM, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, count, actAs, asRole, rejected } = rt;

const CORE = 'public.apply_public_experience_disappearance_v1(uuid, uuid, text)';
const REMOVAL = 'public.remove_public_experience_from_public_world_v1(uuid, uuid, uuid)';
const RECONCILE = 'public.reconcile_public_experience_disappearance_v1(uuid, uuid)';
const AUDIT = 'public.resolve_public_experience_disappearance_audit_v1(uuid)';
const TRIGGER_FN = 'public.reject_public_disappearance_state_mutation_v1()';
const OWN_TABLES = [T.DISAPPEARANCE_COMMANDS, T.DISAPPEARANCE_STATE];
/** Every write path that may only act on a canonically public target. */
const PUBLIC_WRITERS = [
  'public.post_public_discussion_v1(uuid, uuid, uuid, uuid, text)',
  'public.record_public_qandeel_response_v1(uuid, uuid, uuid, uuid, text, uuid[])',
  'public.recompute_public_experience_vitality_v1(uuid)',
  'public.rebuild_public_experience_projection_v1(uuid)',
];
/** A well-formed request_ref for a structural probe row; its value carries no meaning. */
const PROBE_REF = `sha256:${'0'.repeat(64)}`;

async function verifyCatalog() {
  await rt.verifyPosture({
    internal: [CORE, REMOVAL, RECONCILE, AUDIT],
    triggers: [TRIGGER_FN],
    mutating: [CORE, REMOVAL, RECONCILE],
    reading: [AUDIT],
    tables: OWN_TABLES,
    immutable: [[T.DISAPPEARANCE_STATE, 'public_experience_disappearance_state_immutable'],
      [T.PUBLICATION_STATE, 'public_experience_publication_state_immutable'],
      [T.LIFECYCLE, 'public_experience_lifecycle_events_immutable'],
      [T.APPROVALS, 'publication_manifest_approvals_immutable']],
  });

  // THE ONE CONTROLLED PATH. The core writes the value exactly once; neither
  // command writes a lifecycle of its own; none of the three writes a serving
  // lifecycle at all, so nothing here can reactivate an absent Experience.
  const core = await rt.functionPosture(CORE);
  assert.equal((core.prosrc.match(/SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD'/gu) ?? []).length, 1,
    'the controlled core writes ABSENT_FROM_PUBLIC_WORLD exactly once');
  for (const needle of ["e.current_lifecycle = 'PUBLISHED'", 'e.current_experience_version_id = s.published_experience_version_id',
    'public_experience_lifecycle_events', "'PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD'",
    'public_experience_disappearance_state',
    'DELETE FROM public.public_experience_search_projection']) {
    assert.ok(core.prosrc.includes(needle), `the controlled core requires: ${needle}`);
  }
  assert.ok(!core.prosrc.includes('auth.uid()'), 'the controlled core decides no authority of its own');
  for (const fn of [CORE, REMOVAL, RECONCILE]) {
    const p = await rt.functionPosture(fn);
    for (const forbidden of ["SET current_lifecycle = 'PUBLISHED'", "SET current_lifecycle = 'DRAFT'",
      "SET current_lifecycle = 'READY_FOR_REVIEW'"]) {
      assert.ok(!p.prosrc.includes(forbidden), `${fn} may not reactivate an absent Experience`);
    }
    assert.doesNotMatch(p.prosrc,
      /(INSERT INTO|UPDATE|DELETE FROM) public\.(shared_world|conversation_|users|publication_manifest_approvals|publication_manifest_required_approvers|publication_approval_withdrawal|public_experience_controllers|publication_package|public_experience_publication_state|public_experience_versions|public_identities|public_discussion_posts|public_qandeel_responses|public_experience_semantic_placements)/u,
      `${fn} erases no immutable evidence and mutates no source, package, approval, control, presence or identity`);
    for (const name of await rt.inputParameters(fn)) {
      assert.doesNotMatch(name, /approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|clear|launch|safety|entitle|allow|effective|eligib|absent|cause|reason|force|fingerprint/u,
        `${fn} may not accept ${name}`);
    }
  }
  // The ONE parameter that carries a derived value belongs to the core alone.
  assert.ok((await rt.inputParameters(CORE)).includes('p_disappearance_basis'),
    'the controlled core takes the bounded basis its caller derived');
  for (const fn of [REMOVAL, RECONCILE]) {
    assert.ok(!(await rt.inputParameters(fn)).some((n) => /basis/u.test(n)),
      `${fn} derives the basis and accepts none`);
    const p = await rt.functionPosture(fn);
    assert.ok(p.prosrc.includes('apply_public_experience_disappearance_v1'), `${fn} delegates to the ONE controlled primitive`);
    assert.ok(!p.prosrc.includes('SET current_lifecycle'), `${fn} writes no lifecycle of its own`);
    assert.ok(p.prosrc.includes('FROM public.public_world_state w WHERE w.singleton FOR UPDATE')
      && p.prosrc.includes('FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE'),
    `${fn} takes the canonical Public lock prefix`);
    assert.equal((p.prosrc.match(/WHERE c\.id = p_command_id/gu) ?? []).length, 2,
      `${fn} checks durable idempotency before any lock and again under it`);
  }

  // THE REMOVAL IS A CONTROL ACT; THE RECONCILIATION IS MACHINE CONVERGENCE.
  const removal = await rt.functionPosture(REMOVAL);
  assert.ok(removal.prosrc.includes('auth.uid()') && removal.prosrc.includes('public_experience_controllers'),
    'removal requires the exact Experience controller derived from auth.uid()');
  assert.ok(removal.prosrc.includes('PUBLIC_EXPERIENCE_NOT_AUTHORIZED') && removal.prosrc.includes('ALREADY_ABSENT'));
  for (const forbidden of ['publication_manifest_approvals', 'publication_manifest_required_approvers',
    'publication_approval_withdrawal_events', 'shared_world_membership_episodes']) {
    assert.ok(!removal.prosrc.includes(forbidden), `container control is not content rights: removal reads no ${forbidden}`);
  }
  const reconcile = await rt.functionPosture(RECONCILE);
  assert.ok(!reconcile.prosrc.includes('auth.uid()'), 'reconciliation derives no human');
  assert.ok(!reconcile.prosrc.includes('public_experience_controllers'), 'and reads no control');
  for (const needle of ['derive_public_continuing_eligibility_v1', 'FROM public.shared_worlds w',
    'ORDER BY m.id FOR SHARE', 'ORDER BY i.id FOR SHARE', 'ORDER BY cu.id FOR SHARE',
    'DISAPPEARANCE_CONVERGED', 'STILL_ELIGIBLE', 'ALREADY_ABSENT', 'NOT_APPLICABLE']) {
    assert.ok(reconcile.prosrc.includes(needle), `reconciliation requires: ${needle}`);
  }

  // EVERY PUBLIC WRITE PATH STILL REVALIDATES CANONICAL VISIBILITY, under its
  // own lock. Disappearance is only complete if writes fail closed too.
  for (const fn of PUBLIC_WRITERS) {
    const p = await rt.functionPosture(fn);
    assert.ok(p.prosrc.includes('resolve_public_visibility_state_v1'),
      `${fn} revalidates canonical visibility at execution time`);
    assert.ok(p.prosrc.includes("visibility_state = 'PUBLICLY_VISIBLE'"), `${fn} requires a canonically public target`);
    assert.ok(p.prosrc.includes('FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE')
      || p.prosrc.includes('FROM public.public_experiences e WHERE e.id = p_experience_id FOR SHARE'),
    `${fn} holds the exact Experience row while it decides`);
  }

  // STRUCTURE: ONE exact publication row, through ONE composite restrictive
  // foreign key onto the additive candidate key, in both relations.
  assert.deepEqual(await rt.uniqueKeyColumns(T.PUBLICATION_STATE, 'public_experience_publication_state_exact_identity_key'),
    ['experience_id', 'published_experience_version_id', 'published_manifest_version_id'],
    'the frozen publication record carries the additive exact-identity candidate key');
  await rt.assertExactBinding(T.DISAPPEARANCE_STATE, T.PUBLICATION_STATE,
    ['experience_id', 'absent_experience_version_id', 'absent_manifest_version_id'],
    ['experience_id', 'published_experience_version_id', 'published_manifest_version_id']);
  await rt.assertExactBinding(T.DISAPPEARANCE_COMMANDS, T.PUBLICATION_STATE,
    ['experience_id', 'target_experience_version_id', 'target_manifest_version_id'],
    ['experience_id', 'published_experience_version_id', 'published_manifest_version_id']);
  for (const table of OWN_TABLES) {
    assert.deepEqual(await rt.foreignKeysInto(table, T.MANIFESTS), [],
      `${table} binds the manifest through the publication row, never independently`);
  }
  const [{ basis }] = await rows(
    `SELECT pg_get_constraintdef(c.oid) basis FROM pg_constraint c
      WHERE c.conrelid = $1::regclass AND c.conname = 'public_experience_disappearance_state_basis_check'`,
    [T.DISAPPEARANCE_STATE]);
  for (const cls of ['AUTHORIZED_CONTROLLER_REMOVAL', 'REQUIRED_APPROVAL_NOT_EFFECTIVE',
    'PUBLISHED_SOURCE_NOT_AVAILABLE', 'PUBLICATION_AUTHORITY_INVALIDATED']) {
    assert.ok(basis.includes(cls), `the bounded disappearance basis includes ${cls}`);
  }
  assert.ok(!basis.includes('PUBLICATION_BINDING_INVALID'),
    'a contradictory publication binding is not a disappearance cause and may not be a basis');

  // NO APPLICATION ROLE CAN TAKE THE PATH AROUND. The frozen Experience
  // relation grants nothing to any of them, keeps row security on and carries
  // zero policies - a grant alone, a policy alone, or the two together are each
  // a path around the ONE controlled primitive, so all three are refused here.
  for (const role of ['public', ...APP_ROLES]) {
    const [{ any_privilege }] = await rows(
      `SELECT bool_or(has_table_privilege($1, $2::regclass, p)) any_privilege
         FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p`, [role, T.EXPERIENCES]);
    assert.equal(any_privilege, false, `${role} holds no direct privilege on the Experience lifecycle relation`);
  }
  const [{ rls, policies }] = await rows(
    `SELECT c.relrowsecurity rls, (SELECT count(*) FROM pg_policy WHERE polrelid = c.oid) policies
       FROM pg_class c WHERE c.oid = $1::regclass`, [T.EXPERIENCES]);
  assert.equal(rls, true, 'the Experience lifecycle relation keeps row security enabled');
  assert.equal(Number(policies), 0, 'and carries zero policies');
  // PART A is already the canonical visibility truth: the convergence is
  // defense in depth over a derivation that had already gone dark.
  assert.ok((await rt.functionPosture('public.resolve_public_visibility_state_v1(uuid)')).prosrc
    .includes('derive_public_continuing_eligibility_v1'),
  'the canonical visibility derivation already consumes continuing eligibility');
  assert.ok((await rt.functionPosture(SEAM)).prosrc.includes('NOT_EVALUATED'),
    'the CW2-08 prerequisite seam still answers NOT_EVALUATED');
  // The audit boundary is INTERNAL: there is no Public or ordinary-role read of
  // disappearance evidence at all.
  for (const role of ['public', ...APP_ROLES]) {
    assert.equal(await rt.canExecute(role, AUDIT), false, `${role} must not execute the disappearance audit boundary`);
  }
  for (const column of await rt.resultColumns(AUDIT)) {
    assert.doesNotMatch(column, /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material_id|history_item|availability|context_ref|world_id|provenance|digest|fingerprint/u,
      `the audit boundary must not return ${column}`);
  }
}

/** Every immutable historical fact a disappearance must leave exactly as it was. */
async function evidenceSnapshot(experience, manifest) {
  const one = async (text, values) => (await rows(text, values))[0];
  return {
    publication: await one(`SELECT * FROM ${T.PUBLICATION_STATE} WHERE experience_id = $1`, [experience]),
    manifest: await one(`SELECT * FROM ${T.MANIFESTS} WHERE id = $1`, [manifest]),
    versions: await rows(`SELECT * FROM ${T.VERSIONS} WHERE experience_id = $1 ORDER BY version_ordinal`, [experience]),
    items: await rows(`SELECT * FROM ${T.ITEMS} WHERE manifest_version_id = $1 ORDER BY item_ordinal`, [manifest]),
    bodies: await rows(`SELECT b.* FROM ${T.BODIES} b JOIN ${T.ITEMS} it ON it.package_item_id = b.package_item_id
                         WHERE it.manifest_version_id = $1 ORDER BY b.package_item_id`, [manifest]),
    provenance: await rows(`SELECT * FROM ${T.PROVENANCE} WHERE manifest_version_id = $1 ORDER BY package_item_id`, [manifest]),
    approvals: await rows(`SELECT * FROM ${T.APPROVALS} WHERE manifest_version_id = $1 ORDER BY id`, [manifest]),
    withdrawals: await rows(`SELECT * FROM ${T.WITHDRAWAL_EVENTS} WHERE manifest_version_id = $1 ORDER BY id`, [manifest]),
    controllers: await rows(`SELECT * FROM ${T.CONTROLLERS} WHERE experience_id = $1 ORDER BY controller_user_id`, [experience]),
    posts: await rows(`SELECT * FROM ${T.POSTS} WHERE experience_id = $1 ORDER BY post_ordinal`, [experience]),
    responses: await rows(`SELECT * FROM ${T.RESPONSES} WHERE experience_id = $1 ORDER BY response_ordinal`, [experience]),
    placements: await rows(`SELECT * FROM ${T.PLACEMENTS} WHERE experience_id = $1 ORDER BY placement_revision`, [experience]),
  };
}

async function verifyRemoval(f, seam) {
  const target = await rt.bringToPublished(f, { experience: f.experience, manifest: f.manifest, version: f.version }, seam);
  const other = randomUUID();
  const otherVersion = randomUUID();
  const otherManifest = randomUUID();
  await rt.bringToPublished(f, { experience: other, manifest: otherManifest, version: otherVersion, personal: false, shared: [f.mohamedMaterial] }, seam);
  const lensKey = 'i05c.removal';
  const searchTerm = 'sentence';
  await actAs(f.mohamed);
  await rt.recordPlacement(randomUUID(), randomUUID(), f.experience, f.version, lensKey, 'the removal interpretation');
  const firstPost = randomUUID();
  await rt.post(randomUUID(), firstPost, f.experience, null, 'a public sentence before the removal');
  await rt.recordResponse(randomUUID(), randomUUID(), f.experience, firstPost, 'a Public QANDEEL response', [firstPost]);
  await rt.recomputeVitality(f.experience);
  await rt.rebuildProjection(f.experience);
  await rt.recordPlacement(randomUUID(), randomUUID(), other, otherVersion, lensKey, 'the unrelated interpretation');
  await rt.rebuildProjection(other);
  assert.equal((await rt.search(f.reader, searchTerm)).filter((r) => r.experience_id === f.experience).length, 1);
  const evidence = await evidenceSnapshot(f.experience, f.manifest);
  const otherEvidence = await evidenceSnapshot(other, otherManifest);

  // DR05 a DRAFT and a READY_FOR_REVIEW Experience were never in the Public
  // World, so there is nothing to remove FROM it.
  const draft = randomUUID();
  await rt.createDraft(randomUUID(), draft);
  const readyExp = randomUUID();
  const ready = await rt.bringToReady(f, { experience: readyExp, manifest: randomUUID(), version: randomUUID(), personal: false, shared: [f.mohamedMaterial] });
  await rejected(() => rt.removeFromPublicWorld(randomUUID(), draft, f.version), ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);
  await rejected(() => rt.removeFromPublicWorld(randomUUID(), readyExp, ready.version), ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);
  assert.equal(await count(T.DISAPPEARANCE_STATE, 'experience_id = ANY($1::uuid[])', [[draft, readyExp]]), 0, 'DR05 nothing written');

  // DR02 a stranger, a rightsholder who is NOT a controller, and a nonexistent
  // Experience reach ONE bounded class. Hadir is the exact historical
  // rightsholder of an included Shared material and is not a controller.
  await actAs(f.stranger);
  const byStranger = await rejected(() => rt.removeFromPublicWorld(randomUUID(), f.experience, f.version), ['42501'], /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);
  await actAs(f.hadir);
  const byRightsholder = await rejected(() => rt.removeFromPublicWorld(randomUUID(), f.experience, f.version), ['42501'], /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);
  await actAs(f.mohamed);
  const byGuess = await rejected(() => rt.removeFromPublicWorld(randomUUID(), randomUUID(), f.version), ['42501'], /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);
  assert.equal(byStranger.message, byGuess.message, 'DR02 no existence oracle for a stranger');
  assert.equal(byRightsholder.message, byGuess.message, 'DR02 content rights are not container control');
  await actAs(null);
  await rejected(() => rt.removeFromPublicWorld(randomUUID(), f.experience, f.version), ['42501'], /PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED/u);
  await actAs(f.mohamed);
  await rejected(() => rt.removeFromPublicWorld(null, f.experience, f.version), ['22023']);
  await rejected(() => rt.removeFromPublicWorld(randomUUID(), f.experience, null), ['22023']);
  assert.equal((await rt.visibility(f.experience))[0].visibility_state, 'PUBLICLY_VISIBLE', 'DR02 nothing happened');

  // DR03 the exact target: a version that is not the published one is stale,
  // and so is a version of another Experience.
  await rejected(() => rt.removeFromPublicWorld(randomUUID(), f.experience, randomUUID()), ['40001'], /PUBLIC_EXPERIENCE_STALE/u);
  await rejected(() => rt.removeFromPublicWorld(randomUUID(), f.experience, otherVersion), ['40001'], /PUBLIC_EXPERIENCE_STALE/u);
  assert.equal(await count(T.DISAPPEARANCE_COMMANDS, 'experience_id = $1', [f.experience]), 0, 'DR03 nothing recorded');

  // DR01 THE AUTHORIZED REMOVAL.
  const command = randomUUID();
  const revisionBefore = (await rows(`SELECT experience_revision r FROM ${T.EXPERIENCES} WHERE id = $1`, [f.experience]))[0].r;
  const [removed] = await rt.removeFromPublicWorld(command, f.experience, f.version);
  assert.equal(removed.outcome, 'REMOVED_FROM_PUBLIC_WORLD');
  assert.equal(removed.experience_id, f.experience);
  assert.equal(removed.absent_experience_version_id, f.version);
  assert.equal(removed.disappearance_basis, 'AUTHORIZED_CONTROLLER_REMOVAL');
  assert.equal(removed.current_lifecycle, 'ABSENT_FROM_PUBLIC_WORLD');
  assert.ok(removed.committed_at instanceof Date);
  const [experienceRow] = await rows(`SELECT * FROM ${T.EXPERIENCES} WHERE id = $1`, [f.experience]);
  assert.equal(experienceRow.current_lifecycle, 'ABSENT_FROM_PUBLIC_WORLD');
  assert.equal(Number(experienceRow.experience_revision), Number(revisionBefore) + 1);
  const transitions = await rows(`SELECT * FROM ${T.LIFECYCLE} WHERE experience_id = $1 ORDER BY occurred_at, id`, [f.experience]);
  assert.deepEqual(transitions.map((r) => [r.from_lifecycle, r.to_lifecycle]),
    [[null, 'DRAFT'], ['DRAFT', 'READY_FOR_REVIEW'], ['READY_FOR_REVIEW', 'PUBLISHED'], ['PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD']]);
  assert.equal(transitions[3].id, command, 'DR01 the transition reuses the command identity');
  assert.equal(transitions[3].experience_version_id, f.version, 'and names the exact version that disappeared');
  const [record] = await rows(`SELECT * FROM ${T.DISAPPEARANCE_STATE} WHERE experience_id = $1`, [f.experience]);
  assert.equal(record.absent_experience_version_id, f.version);
  assert.equal(record.absent_manifest_version_id, f.manifest);
  assert.equal(record.disappearance_basis, 'AUTHORIZED_CONTROLLER_REMOVAL');
  assert.deepEqual(record.absent_since, transitions[3].occurred_at, 'DR01 ONE database-owned instant for every fact');
  const [issued] = await rows(`SELECT * FROM ${T.DISAPPEARANCE_COMMANDS} WHERE id = $1`, [command]);
  assert.equal(issued.command_kind, 'CONTROLLER_REMOVAL');
  assert.equal(issued.actor_user_id, f.mohamed);
  assert.equal(issued.target_experience_version_id, f.version);
  assert.equal(issued.target_manifest_version_id, f.manifest);
  assert.deepEqual(issued.committed_at, record.absent_since);
  // EVERY PUBLIC SURFACE IS DARK, and the derived projection is gone.
  await rt.assertCompletelyDark(f.experience, f.reader, { lensKey, searchTerm });
  assert.equal(await count(T.PROJECTION, 'experience_id = $1', [f.experience]), 0, 'DR01 the search projection was cleared');
  assert.equal((await rt.continuingEligibility(f.experience))[0].ineligibility_class, 'NOT_PUBLISHED');

  // DR06 NO IMMUTABLE HISTORICAL EVIDENCE IS ERASED.
  assert.deepEqual(await evidenceSnapshot(f.experience, f.manifest), evidence,
    'DR06 the version, manifest, items, bodies, provenance, approvals, control and internal presence history all survive');
  await rejected(() => q(`UPDATE ${T.DISAPPEARANCE_STATE} SET disappearance_basis = $2 WHERE experience_id = $1`,
    [f.experience, 'PUBLISHED_SOURCE_NOT_AVAILABLE']), ['55000'], /PUBLIC_DISAPPEARANCE_STATE_IS_IMMUTABLE/u);
  await rejected(() => q(`DELETE FROM ${T.DISAPPEARANCE_STATE} WHERE experience_id = $1`, [f.experience]), ['55000']);

  // DR07 NOTHING UNRELATED IS COLLATERAL-DAMAGED.
  assert.equal((await rt.visibility(other))[0].visibility_state, 'PUBLICLY_VISIBLE', 'DR07 another Experience stays visible');
  assert.equal((await rt.serving(other, f.reader)).length, 1);
  assert.equal((await rt.lens(f.reader, lensKey)).filter((r) => r.experience_id === other).length, 1,
    'DR07 and keeps its projection');
  assert.deepEqual(await evidenceSnapshot(other, otherManifest), otherEvidence, 'DR07 and every row of it');
  assert.equal(await count(T.IDENTITIES, 'user_id = $1', [f.mohamed]), 1, 'DR07 the stable Public Identity survives globally');
  assert.equal(await count(T.DISAPPEARANCE_STATE, 'experience_id = $1', [other]), 0);
  assert.equal(Number((await rows(
    'SELECT count(*) n FROM public.shared_world_materials WHERE world_id = $1', [f.world]))[0].n), 7,
  'DR07 no Shared material was touched');
  assert.equal(Number((await rows('SELECT count(*) n FROM public.conversation_units WHERE user_id = $1', [f.mohamed]))[0].n), 2,
    'DR07 and no Personal history');

  // DR08 EVERY PUBLIC WRITE PATH REFUSES.
  await rejected(() => rt.post(randomUUID(), randomUUID(), f.experience, null, 'a post after the removal'),
    ['P0002'], /PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE/u);
  await rejected(() => rt.post(randomUUID(), randomUUID(), f.experience, firstPost, 'a reply after the removal'),
    ['P0002'], /PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE/u);
  await rejected(() => rt.recordResponse(randomUUID(), randomUUID(), f.experience, null, 'a response after it', NONE),
    ['P0002'], /PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE/u);
  await rejected(() => rt.recordPlacement(randomUUID(), randomUUID(), f.experience, f.version, lensKey, 'a correction after it'),
    ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);
  assert.equal((await rt.recomputeVitality(f.experience))[0].outcome, 'NOT_PUBLICLY_VISIBLE');
  assert.equal((await rt.rebuildProjection(f.experience))[0].outcome, 'PROJECTION_ABSENT',
    'DR08 and a rebuild cannot resurrect a projection');
  await rt.assertCompletelyDark(f.experience, f.reader, { lensKey, searchTerm });

  // DR09 NOTHING REACTIVATES IT.
  await rejected(() => rt.publish(randomUUID(), f.experience, f.version), ['42501', '55000']);
  await rejected(() => rt.prepare(randomUUID(), f.experience, randomUUID(), randomUUID(), NONE, NONE,
    [randomUUID()], [f.world], [f.mohamedMaterial]), ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);
  await rejected(() => rt.commitReady(randomUUID(), f.experience, f.version), ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);

  // DR04 DURABLE IDEMPOTENCY.
  const [replay] = await rt.removeFromPublicWorld(command, f.experience, f.version);
  assert.equal(replay.outcome, 'ALREADY_COMMITTED');
  assert.equal(replay.absent_experience_version_id, f.version);
  assert.deepEqual(replay.committed_at, record.absent_since);
  await rejected(() => rt.removeFromPublicWorld(command, other, otherVersion), ['23505'], /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
  await rejected(() => rt.removeFromPublicWorld(command, randomUUID(), f.version), ['23505'], /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
  assert.equal((await rt.visibility(other))[0].visibility_state, 'PUBLICLY_VISIBLE',
    'DR04 an idempotency key cannot probe or touch another Experience');
  const [again] = await rt.removeFromPublicWorld(randomUUID(), f.experience, f.version);
  assert.equal(again.outcome, 'ALREADY_ABSENT', 'DR04 a repeated legitimate removal converges rather than erroring');
  assert.equal(await count(T.DISAPPEARANCE_STATE, 'experience_id = $1', [f.experience]), 1, 'DR04 exactly one record');
  assert.equal(await count(T.LIFECYCLE, `experience_id = $1 AND to_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD'`, [f.experience]), 1,
    'DR04 and exactly one transition');
  assert.equal(await count(T.DISAPPEARANCE_COMMANDS, 'experience_id = $1', [f.experience]), 2, 'DR04 both commands are durable');

  // AU01 AUDIT. The sealed record is reachable only through the internal
  // boundary, and every application role is refused both paths.
  const [audited] = await rt.disappearanceAudit(f.experience);
  assert.equal(audited.experience_id, f.experience);
  assert.equal(audited.absent_experience_version_id, f.version);
  assert.equal(audited.disappearance_basis, 'AUTHORIZED_CONTROLLER_REMOVAL');
  assert.deepEqual(await rt.disappearanceAudit(other), [], 'AU01 an Experience that never disappeared has no record');
  assert.deepEqual(await rt.disappearanceAudit(randomUUID()), [], 'AU01 and neither does a guessed identifier');
  await rejected(() => rt.disappearanceAudit(null), ['22023']);
  for (const role of APP_ROLES) {
    await q('SAVEPOINT audit_role');
    await asRole(role, f.reader);
    await rejected(() => rt.disappearanceAudit(f.experience), ['42501']);
    await rejected(() => rt.removeFromPublicWorld(randomUUID(), f.experience, f.version), ['42501']);
    await rejected(() => rt.reconcileDisappearance(randomUUID(), f.experience), ['42501']);
    for (const table of [...OWN_TABLES, T.EXPERIENCES]) await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), ['42501']);
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT audit_role'); await q('RELEASE SAVEPOINT audit_role');
  }
  await actAs(f.mohamed);
  return { target, other, otherVersion, draft, readyExp, lensKey, searchTerm, command };
}

async function verifyReconciliation(f, seam, state) {
  // RC04 never-published and nonexistent are NOT_APPLICABLE and write nothing.
  for (const [label, id] of [['a DRAFT', state.draft], ['a READY_FOR_REVIEW', state.readyExp], ['a nonexistent id', randomUUID()]]) {
    const [answer] = await rt.reconcileDisappearance(randomUUID(), id);
    assert.equal(answer.outcome, 'NOT_APPLICABLE', `RC04 ${label} is not applicable`);
    assert.equal(answer.absent_experience_version_id, null);
    assert.equal(await count(T.DISAPPEARANCE_STATE, 'experience_id = $1', [id]), 0);
  }
  await rejected(() => rt.reconcileDisappearance(randomUUID(), null), ['22023']);

  // RC05 the already-absent Experience converges.
  const [alreadyAbsent] = await rt.reconcileDisappearance(randomUUID(), f.experience);
  assert.equal(alreadyAbsent.outcome, 'ALREADY_ABSENT');
  assert.equal(alreadyAbsent.disappearance_basis, 'AUTHORIZED_CONTROLLER_REMOVAL',
    'RC05 the first cause is the recorded one; convergence never rewrites it');
  assert.equal(await count(T.DISAPPEARANCE_STATE, 'experience_id = $1', [f.experience]), 1);

  // RC01 a still-eligible publication converges to nothing.
  const [stillEligible] = await rt.reconcileDisappearance(randomUUID(), state.other);
  assert.equal(stillEligible.outcome, 'STILL_ELIGIBLE');
  assert.equal(stillEligible.current_lifecycle, 'PUBLISHED');
  assert.equal(await count(T.DISAPPEARANCE_STATE, 'experience_id = $1', [state.other]), 0, 'RC01 nothing written');
  assert.equal((await rt.visibility(state.other))[0].visibility_state, 'PUBLICLY_VISIBLE');

  // RC02 A WITHDRAWN REQUIRED APPROVAL CONVERGES WITH THAT EXACT BASIS - and
  // canonical truth had ALREADY gone dark before the reconciliation ran, which
  // is the whole point of PART A.
  const withdrawTarget = randomUUID();
  const withdrawVersion = randomUUID();
  const withdrawManifest = randomUUID();
  const published = await rt.bringToPublished(f,
    { experience: withdrawTarget, manifest: withdrawManifest, version: withdrawVersion }, seam);
  await actAs(f.hadir);
  await rt.withdraw(randomUUID(), published.approvals.get(f.hadir));
  await actAs(f.mohamed);
  assert.equal((await rt.visibility(withdrawTarget))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE',
    'RC02 canonical truth went dark BEFORE any convergence');
  assert.equal((await rows(`SELECT current_lifecycle c FROM ${T.EXPERIENCES} WHERE id = $1`, [withdrawTarget]))[0].c, 'PUBLISHED');
  const reconciliation = randomUUID();
  const [converged] = await rt.reconcileDisappearance(reconciliation, withdrawTarget);
  assert.equal(converged.outcome, 'DISAPPEARANCE_CONVERGED');
  assert.equal(converged.disappearance_basis, 'REQUIRED_APPROVAL_NOT_EFFECTIVE');
  assert.equal(converged.current_lifecycle, 'ABSENT_FROM_PUBLIC_WORLD');
  assert.equal(converged.absent_experience_version_id, withdrawVersion);
  const [wRecord] = await rows(`SELECT * FROM ${T.DISAPPEARANCE_STATE} WHERE experience_id = $1`, [withdrawTarget]);
  assert.equal(wRecord.disappearance_basis, 'REQUIRED_APPROVAL_NOT_EFFECTIVE');
  assert.equal(wRecord.absent_manifest_version_id, withdrawManifest);
  const [wCommand] = await rows(`SELECT * FROM ${T.DISAPPEARANCE_COMMANDS} WHERE id = $1`, [reconciliation]);
  assert.equal(wCommand.command_kind, 'DISAPPEARANCE_RECONCILIATION');
  assert.equal(wCommand.actor_user_id, null, 'RC02 machine convergence records no human');
  await rt.assertCompletelyDark(withdrawTarget, f.reader, {});
  // RC05 replay and convergence.
  const [wReplay] = await rt.reconcileDisappearance(reconciliation, withdrawTarget);
  assert.equal(wReplay.outcome, 'ALREADY_COMMITTED');
  await rejected(() => rt.reconcileDisappearance(reconciliation, state.other), ['23505'], /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
  assert.equal((await rt.reconcileDisappearance(randomUUID(), withdrawTarget))[0].outcome, 'ALREADY_ABSENT');
  assert.equal(await count(T.DISAPPEARANCE_STATE, 'experience_id = $1', [withdrawTarget]), 1);
  assert.equal(await count(T.LIFECYCLE, `experience_id = $1 AND to_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD'`, [withdrawTarget]), 1);
  // A controller removal of an already-converged Experience converges too, and
  // never rewrites the recorded basis.
  const [afterConverged] = await rt.removeFromPublicWorld(randomUUID(), withdrawTarget, withdrawVersion);
  assert.equal(afterConverged.outcome, 'ALREADY_ABSENT');
  assert.equal(afterConverged.disappearance_basis, 'REQUIRED_APPROVAL_NOT_EFFECTIVE');

  // RC03 A LOST SOURCE CONVERGES WITH THE SOURCE BASIS.
  const sourceTarget = randomUUID();
  const sourceVersion = randomUUID();
  await rt.bringToPublished(f,
    { experience: sourceTarget, manifest: randomUUID(), version: sourceVersion, personal: false, shared: [f.hadirMaterial] }, seam);
  await actAs(f.hadir);
  await rt.deleteMaterial(randomUUID(), f.world, f.hadirMaterial, randomUUID());
  await actAs(f.mohamed);
  assert.equal((await rt.visibility(sourceTarget))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE',
    'RC03 canonical truth went dark BEFORE any convergence');
  const [sourceConverged] = await rt.reconcileDisappearance(randomUUID(), sourceTarget);
  assert.equal(sourceConverged.outcome, 'DISAPPEARANCE_CONVERGED');
  assert.equal(sourceConverged.disappearance_basis, 'PUBLISHED_SOURCE_NOT_AVAILABLE');
  assert.equal((await rt.disappearanceAudit(sourceTarget))[0].disappearance_basis, 'PUBLISHED_SOURCE_NOT_AVAILABLE');
  await rt.assertCompletelyDark(sourceTarget, f.reader, {});
  // The immutable package was NOT shrunk to keep serving a smaller one.
  const [{ item_count: itemCount }] = await rows(
    `SELECT m.item_count FROM ${T.MANIFESTS} m JOIN ${T.VERSIONS} v ON v.package_manifest_version_id = m.id
      WHERE v.id = $1`, [sourceVersion]);
  assert.equal(Number(itemCount), 1, 'RC03 the immutable manifest is unchanged');

  // RC06 the reconciliation needs no authenticated actor at all.
  await actAs(null);
  const [noHuman] = await rt.reconcileDisappearance(randomUUID(), state.other);
  assert.equal(noHuman.outcome, 'STILL_ELIGIBLE', 'RC06 machine convergence derives no human');
  await actAs(f.mohamed);
  return { withdrawTarget, withdrawVersion, sourceTarget, sourceVersion };
}

async function verifyForwardSafety(f, state) {
  const refuses = { name: 'AssertionError' };
  await q('SAVEPOINT forward_safety');
  try {
    await asRole('postgres');
    // A LEGITIMATE ADDITIVE FUTURE SLICE still passes.
    await q(`CREATE TABLE public.i05c99_probe_later_state (
               experience_id uuid PRIMARY KEY REFERENCES ${T.EXPERIENCES} (id), noted_at timestamptz NOT NULL)`);
    await q(`CREATE FUNCTION public.i05c99_probe_note_v1(p_experience_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN INSERT INTO public.i05c99_probe_later_state (experience_id, noted_at)
                   VALUES (p_experience_id, clock_timestamp()) ON CONFLICT DO NOTHING; END$fn$`);
    await q('CREATE TABLE public.i05c99_probe_launch_gate (id uuid PRIMARY KEY, capability text NOT NULL)');
    await q(`ALTER TABLE ${T.DISAPPEARANCE_COMMANDS} ADD COLUMN i05c99_probe_note text`);
    await q(`CREATE INDEX i05c99_probe_idx ON ${T.DISAPPEARANCE_STATE} (absent_since)`);
    await verifyCatalog();

    // F1 AN APPLICATION ROLE GAINS A DIRECT LIFECYCLE UPDATE. This is the one
    // path around the controlled primitive, and it is refused - and really is
    // a path: with the grant in place an application role writes the lifecycle
    // directly, which is exactly what the census exists to catch.
    await q('SAVEPOINT f1');
    await q(`GRANT UPDATE, SELECT ON TABLE ${T.EXPERIENCES} TO authenticated`);
    await assert.rejects(verifyCatalog(), refuses, 'F1 a direct application-role lifecycle privilege is a regression');
    // The grant alone still writes nothing - row security is on with zero
    // policies - so the probe adds the policy too and shows the PAIR really is
    // a path around the controlled primitive. Both halves are refused above.
    await q(`CREATE POLICY i05c99_probe_all ON ${T.EXPERIENCES} FOR ALL TO authenticated USING (true) WITH CHECK (true)`);
    await assert.rejects(verifyCatalog(), refuses, 'F1 and so is a policy on the Experience lifecycle relation');
    await asRole('authenticated', f.mohamed);
    await q(`UPDATE ${T.EXPERIENCES} SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD' WHERE id = $1`, [state.other]);
    await asRole('postgres');
    assert.equal((await rows(`SELECT current_lifecycle c FROM ${T.EXPERIENCES} WHERE id = $1`, [state.other]))[0].c,
      'ABSENT_FROM_PUBLIC_WORLD', 'F1 anti-vacuity: the pair really opens a path around the controlled primitive');
    assert.equal(await count(T.DISAPPEARANCE_STATE, 'experience_id = $1', [state.other]), 0,
      'F1 and leaves no evidence, which is exactly what the controlled path exists to guarantee');
    await q('ROLLBACK TO SAVEPOINT f1'); await q('RELEASE SAVEPOINT f1');

    // F2 THE EXACT PUBLICATION BINDING IS WEAKENED INTO INDEPENDENT KEYS, so a
    // disappearance record could name version V1 beside the manifest of V2.
    await q('SAVEPOINT f2');
    await q(`ALTER TABLE ${T.DISAPPEARANCE_STATE} DROP CONSTRAINT public_experience_disappearance_state_publication_fk`);
    await q(`ALTER TABLE ${T.DISAPPEARANCE_STATE} ADD CONSTRAINT i05c99_probe_version_fk
             FOREIGN KEY (absent_experience_version_id, experience_id) REFERENCES ${T.VERSIONS} (id, experience_id) ON DELETE RESTRICT`);
    await q(`ALTER TABLE ${T.DISAPPEARANCE_STATE} ADD CONSTRAINT i05c99_probe_manifest_fk
             FOREIGN KEY (absent_manifest_version_id) REFERENCES ${T.MANIFESTS} (id) ON DELETE RESTRICT`);
    await assert.rejects(verifyCatalog(), refuses, 'F2 two independent keys in place of the exact publication binding is a regression');
    await q(`ALTER TABLE ${T.DISAPPEARANCE_STATE} DISABLE TRIGGER public_experience_disappearance_state_immutable`);
    await q(`DELETE FROM ${T.DISAPPEARANCE_STATE} WHERE experience_id = $1`, [f.experience]);
    await q(`INSERT INTO ${T.DISAPPEARANCE_STATE}
               (experience_id, absent_experience_version_id, absent_manifest_version_id, disappearance_basis, absent_since)
             VALUES ($1, $2, $3, 'AUTHORIZED_CONTROLLER_REMOVAL', now())`,
    [f.experience, f.version, (await rows(`SELECT id FROM ${T.MANIFESTS} WHERE experience_id = $1`, [state.other]))[0].id]);
    assert.equal(await count(T.DISAPPEARANCE_STATE,
      'experience_id = $1 AND absent_manifest_version_id <> $2', [f.experience, f.manifest]), 1,
    'F2 anti-vacuity: the weakened shape admits a record naming another Experience\'s manifest');
    await q('ROLLBACK TO SAVEPOINT f2'); await q('RELEASE SAVEPOINT f2');

    // F3 A PUBLIC WRITER STOPS REVALIDATING CANONICAL VISIBILITY, so an absent
    // Experience becomes writable again.
    await q('SAVEPOINT f3');
    await q(`CREATE OR REPLACE FUNCTION public.post_public_discussion_v1(
               p_command_id uuid, p_post_id uuid, p_experience_id uuid, p_parent_post_id uuid, p_post_body text)
             RETURNS TABLE(outcome text, post_id uuid, experience_id uuid, target_experience_version_id uuid,
                           parent_post_id uuid, post_ordinal bigint, author_public_identity_ref uuid,
                           committed_at timestamptz)
             LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $fn$
             DECLARE u uuid := auth.uid(); target uuid; ident uuid; ordinal bigint; now_at timestamptz;
             BEGIN
               SELECT e.current_experience_version_id INTO target FROM public.public_experiences e WHERE e.id = p_experience_id;
               SELECT i.public_identity_ref INTO ident FROM public.public_identities i WHERE i.user_id = u;
               SELECT coalesce(max(dp.post_ordinal), 0) + 1 INTO ordinal
                 FROM public.public_discussion_posts dp WHERE dp.experience_id = p_experience_id;
               now_at := clock_timestamp();
               INSERT INTO public.public_discussion_posts
                 (id, experience_id, target_experience_version_id, parent_post_id, post_ordinal,
                  author_public_identity_ref, author_user_id, post_body, posted_at)
               VALUES (p_post_id, p_experience_id, target, p_parent_post_id, ordinal, ident, u, p_post_body, now_at);
               RETURN QUERY SELECT 'POSTED'::text, p_post_id, p_experience_id, target, p_parent_post_id,
                                   ordinal, ident, now_at;
             END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'F3 a public writer that skips canonical visibility is a regression');
    await actAs(f.mohamed);
    const ghostPost = randomUUID();
    await rt.post(randomUUID(), ghostPost, f.experience, null, 'a post on an absent Experience');
    assert.equal(await count(T.POSTS, 'id = $1', [ghostPost]), 1,
      'F3 anti-vacuity: the mutant really makes an absent Experience writable');
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT f3'); await q('RELEASE SAVEPOINT f3');

    // F4 THE SEALED DISAPPEARANCE RECORD BECOMES MUTABLE.
    await q('SAVEPOINT f4');
    await q(`ALTER TABLE ${T.DISAPPEARANCE_STATE} DISABLE TRIGGER public_experience_disappearance_state_immutable`);
    await assert.rejects(verifyCatalog(), refuses, 'F4 a mutable disappearance record is a regression');
    await q('ROLLBACK TO SAVEPOINT f4'); await q('RELEASE SAVEPOINT f4');

    // F5 A CONSEQUENTIAL PRIMITIVE BECOMES REACHABLE BEFORE THE LAUNCH GATE.
    await q('SAVEPOINT f5');
    await q(`GRANT EXECUTE ON FUNCTION ${REMOVAL} TO authenticated`);
    await assert.rejects(verifyCatalog(), refuses, 'F5 removal becoming application-reachable is a regression');
    await q('ROLLBACK TO SAVEPOINT f5'); await q('RELEASE SAVEPOINT f5');

    // F6 THE DISAPPEARANCE AUDIT BOUNDARY OPENS TO THE SERVICE TIER, which
    // would publish the private cause of every disappearance.
    await q('SAVEPOINT f6');
    await q(`GRANT EXECUTE ON FUNCTION ${AUDIT} TO service_role`);
    await assert.rejects(verifyCatalog(), refuses, 'F6 an application-reachable disappearance cause is a regression');
    await q('ROLLBACK TO SAVEPOINT f6'); await q('RELEASE SAVEPOINT f6');

    // F7 THE REMOVAL STOPS DELEGATING AND WRITES THE LIFECYCLE ITSELF, which is
    // the second path the ONE controlled primitive exists to prevent.
    await q('SAVEPOINT f7');
    await q(`CREATE OR REPLACE FUNCTION public.remove_public_experience_from_public_world_v1(
               p_command_id uuid, p_experience_id uuid, p_experience_version_id uuid)
             RETURNS TABLE(outcome text, experience_id uuid, absent_experience_version_id uuid,
                           disappearance_basis text, current_lifecycle text, committed_at timestamptz)
             LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $fn$
             BEGIN
               UPDATE public.public_experiences e SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD'
                WHERE e.id = p_experience_id;
               RETURN QUERY SELECT 'REMOVED_FROM_PUBLIC_WORLD'::text, p_experience_id, p_experience_version_id,
                                   'AUTHORIZED_CONTROLLER_REMOVAL'::text, 'ABSENT_FROM_PUBLIC_WORLD'::text,
                                   clock_timestamp();
             END$fn$`);
    await assert.rejects(verifyCatalog(), refuses,
      'F7 a removal that writes the lifecycle itself, with no controller and no evidence, is a regression');
    await q('ROLLBACK TO SAVEPOINT f7'); await q('RELEASE SAVEPOINT f7');

    // F8 A STALE PROJECTION IS PLANTED FOR THE ABSENT EXPERIENCE. Nothing
    // serves it: canonical visibility, not the projection, is the authority.
    await q('SAVEPOINT f8');
    await q(`INSERT INTO ${T.PROJECTION}
               (experience_id, experience_version_id, placement_revision, lens_key, semantic_label,
                search_document, projection_revision, projected_at)
             VALUES ($1, $2, 1, $3, 'a planted stale label',
                     to_tsvector('pg_catalog.simple', 'a planted stale sentence'), 1, now())`,
    [f.experience, f.version, state.lensKey]);
    await q(`INSERT INTO ${T.VITALITY}
               (experience_id, experience_version_id, vitality_revision, discussion_post_count,
                qandeel_response_count, latest_public_activity_at, computed_at)
             VALUES ($1, $2, 1, 99, 99, now(), now())
             ON CONFLICT ON CONSTRAINT public_experience_vitality_state_pk DO UPDATE SET discussion_post_count = 99`,
    [f.experience, f.version]);
    await rt.assertCompletelyDark(f.experience, f.reader, { lensKey: state.lensKey, searchTerm: 'planted' });
    assert.equal((await rt.rebuildProjection(f.experience))[0].outcome, 'PROJECTION_CLEARED',
      'F8 and the next rebuild removes the planted row');
    await q('ROLLBACK TO SAVEPOINT f8'); await q('RELEASE SAVEPOINT f8');
  } finally {
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
  }
}

async function verifyConcurrency(c, seam) {
  const { q2, actAs2, close } = await rt.openSecondary();
  try {
    await asRole('postgres');
    const shared = [c.mohamedMaterial];
    const exA = await rt.bringToPublished(c, { experience: c.experience, manifest: randomUUID(), version: randomUUID(), personal: false, shared }, seam);
    const exB = await rt.bringToPublished(c, { experience: c.experiences[1], manifest: randomUUID(), version: randomUUID(), personal: false, shared }, seam);
    const exC = await rt.bringToPublished(c, { experience: c.experiences[2], manifest: randomUUID(), version: randomUUID(), personal: false, shared }, seam);
    const readyD = await rt.bringToReady(c, { experience: c.experiences[3], manifest: randomUUID(), version: randomUUID(), personal: false, shared });
    await asRole('postgres');

    // C01 PUBLICATION COMPLETION VERSUS DISAPPEARANCE ENFORCEMENT. The
    // publication holds the Public World singleton and the Experience; the
    // removal blocks on them; after the publication commits the removal sees
    // PUBLISHED and removes exactly that publication.
    console.log('0099 concurrency C01 start');
    await rt.clearPrerequisites();
    try {
      await q('BEGIN');
      await actAs(c.mohamed);
      const [publishedD] = await rt.publish(randomUUID(), readyD.experience, readyD.version);
      assert.equal(publishedD.outcome, 'PUBLISHED');
      await q2('BEGIN');
      await actAs2(c.mohamed);
      const removing = q2('SELECT * FROM public.remove_public_experience_from_public_world_v1($1, $2, $3)',
        [randomUUID(), readyD.experience, readyD.version]);
      assert.equal(await rt.stillPending(removing), true, 'C01 the removal blocks behind the publication');
      await q('COMMIT');
      const [removedD] = (await removing).rows;
      await q2('COMMIT');
      assert.equal(removedD.outcome, 'REMOVED_FROM_PUBLIC_WORLD', 'C01 and then removes the publication that committed');
    } finally {
      await asRole('postgres');
      await rt.restorePrerequisites(seam);
    }
    assert.equal(await count(T.DISAPPEARANCE_STATE, 'experience_id = $1', [readyD.experience]), 1);
    assert.equal(await count(T.PUBLICATION_STATE, 'experience_id = $1', [readyD.experience]), 1,
      'C01 no partially published and partially absent state');
    assert.equal((await rt.visibility(readyD.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE');
    console.log('0099 concurrency C01 pass');

    // C02 DUPLICATE REMOVAL from two connections: exactly one disappearance.
    console.log('0099 concurrency C02 start');
    const duplicateCommand = randomUUID();
    await q('BEGIN');
    await actAs(c.mohamed);
    const [firstRemoval] = await rt.removeFromPublicWorld(duplicateCommand, exA.experience, exA.version);
    assert.equal(firstRemoval.outcome, 'REMOVED_FROM_PUBLIC_WORLD');
    await q2('BEGIN');
    await actAs2(c.mohamed);
    const duplicate = q2('SELECT * FROM public.remove_public_experience_from_public_world_v1($1, $2, $3)',
      [duplicateCommand, exA.experience, exA.version]);
    assert.equal(await rt.stillPending(duplicate), true, 'C02 the duplicate blocks behind the first');
    await q('COMMIT');
    const [dup] = (await duplicate).rows;
    await q2('COMMIT');
    assert.equal(dup.outcome, 'ALREADY_COMMITTED', 'C02 the duplicate is served from the durable command');
    assert.equal(await count(T.DISAPPEARANCE_STATE, 'experience_id = $1', [exA.experience]), 1, 'C02 exactly one record');
    assert.equal(await count(T.LIFECYCLE, `experience_id = $1 AND to_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD'`, [exA.experience]), 1);
    console.log('0099 concurrency C02 pass');

    // C03 REMOVAL VERSUS WITHDRAWAL: two independent ineligibility reasons
    // converge on ONE absent result, and the first cause is the recorded one.
    console.log('0099 concurrency C03 start');
    await q('BEGIN');
    await actAs(c.mohamed);
    const [removedB] = await rt.removeFromPublicWorld(randomUUID(), exB.experience, exB.version);
    assert.equal(removedB.outcome, 'REMOVED_FROM_PUBLIC_WORLD');
    await q2('BEGIN');
    await actAs2(c.mohamed);
    const withdrawing = q2('SELECT * FROM public.withdraw_publication_approval_v1($1, $2)',
      [randomUUID(), exB.approvals.get(c.mohamed)]);
    assert.equal(await rt.stillPending(withdrawing), true, 'C03 the withdrawal blocks on the Experience the removal holds');
    await q('COMMIT');
    const [wB] = (await withdrawing).rows;
    await q2('COMMIT');
    assert.equal(wB.outcome, 'WITHDRAWN', 'C03 the withdrawal is still recorded as the rightsholder act it is');
    assert.equal(await count(T.DISAPPEARANCE_STATE, 'experience_id = $1', [exB.experience]), 1);
    assert.equal((await rt.disappearanceAudit(exB.experience))[0].disappearance_basis, 'AUTHORIZED_CONTROLLER_REMOVAL',
      'C03 and convergence never rewrites the recorded cause');
    assert.equal((await rt.reconcileDisappearance(randomUUID(), exB.experience))[0].outcome, 'ALREADY_ABSENT',
      'C03 a later reconciliation converges on the same absent result');
    console.log('0099 concurrency C03 pass');

    // C04 RECONCILIATION VERSUS REMOVAL on an Experience whose consent ended:
    // whichever commits first is the truth, and the other converges.
    console.log('0099 concurrency C04 start');
    await actAs(c.mohamed);
    await rt.withdraw(randomUUID(), exC.approvals.get(c.mohamed));
    assert.equal((await rt.visibility(exC.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE',
      'C04 canonical truth is already dark before either converges');
    await q('BEGIN');
    const [convergedC] = await rt.reconcileDisappearance(randomUUID(), exC.experience);
    assert.equal(convergedC.outcome, 'DISAPPEARANCE_CONVERGED');
    await q2('BEGIN');
    await actAs2(c.mohamed);
    const removingC = q2('SELECT * FROM public.remove_public_experience_from_public_world_v1($1, $2, $3)',
      [randomUUID(), exC.experience, exC.version]);
    assert.equal(await rt.stillPending(removingC), true, 'C04 the removal blocks behind the reconciliation');
    await q('COMMIT');
    const [removedC] = (await removingC).rows;
    await q2('COMMIT');
    assert.equal(removedC.outcome, 'ALREADY_ABSENT', 'C04 the loser converges instead of failing');
    assert.equal(await count(T.DISAPPEARANCE_STATE, 'experience_id = $1', [exC.experience]), 1, 'C04 exactly one record');
    assert.equal((await rt.disappearanceAudit(exC.experience))[0].disappearance_basis, 'REQUIRED_APPROVAL_NOT_EFFECTIVE');
    console.log('0099 concurrency C04 pass');

    // C05 REMOVAL VERSUS A PUBLIC WRITE: the write blocks, then refuses.
    console.log('0099 concurrency C05 start');
    const exE = await rt.bringToPublished(c, { experience: randomUUID(), manifest: randomUUID(), version: randomUUID(), personal: false, shared }, seam);
    c.experiences.push(exE.experience);
    await asRole('postgres');
    await q('BEGIN');
    await actAs(c.mohamed);
    await rt.removeFromPublicWorld(randomUUID(), exE.experience, exE.version);
    await q2('BEGIN');
    await actAs2(c.mohamed);
    const posting = q2('SELECT * FROM public.post_public_discussion_v1($1, $2, $3, $4, $5)',
      [randomUUID(), randomUUID(), exE.experience, null, 'a post racing the removal']);
    assert.equal(await rt.stillPending(posting), true, 'C05 the post blocks on the Experience the removal holds');
    await q('COMMIT');
    await assert.rejects(posting, (error) => error.code === 'P0002' && /PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE/u.test(error.message),
      'C05 the removal won, so the public write refuses');
    await q2('ROLLBACK');
    assert.equal(await count(T.POSTS, 'experience_id = $1', [exE.experience]), 0, 'C05 nothing partial');
    console.log('0099 concurrency C05 pass');
  } finally {
    await close();
    await asRole('postgres');
    await rt.restorePrerequisites(seam);
    console.log('0099 concurrency seam restored');
  }
}

await runVerifier('0099', async (stage) => {
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
    stage('authorized removal');
    const state = await verifyRemoval(f, seam);
    stage('reconciliation');
    await verifyReconciliation(f, seam, state);
    stage('forward safety');
    await asRole('postgres');
    await verifyForwardSafety(f, state);
  } finally {
    await q('ROLLBACK');
  }
  assert.equal((await rt.functionPosture(SEAM)).prosrc, seam.prosrc, 'the production seam is intact after the rolled-back section');
  await verifyCatalog();

  stage('concurrency');
  const c = rt.newFixture();
  c.humans = [c.mohamed, c.hadir, c.stranger, c.reader];
  c.experiences = [c.experience, randomUUID(), randomUUID(), randomUUID()];
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
  await verifyCatalog();
  const humans = [f.mohamed, f.hadir, f.stranger, f.reader, c.mohamed, c.hadir, c.stranger, c.reader];
  const [{ n }] = await rows(
    `SELECT (SELECT count(*) FROM ${T.IDENTITIES} WHERE user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${T.DISAPPEARANCE_STATE} WHERE experience_id = ANY($2::uuid[]))
          + (SELECT count(*) FROM ${T.DISAPPEARANCE_COMMANDS} WHERE experience_id = ANY($2::uuid[]))
          + (SELECT count(*) FROM ${T.PUBLICATION_STATE} WHERE experience_id = ANY($2::uuid[]))
          + (SELECT count(*) FROM ${T.EXPERIENCES} WHERE id = ANY($2::uuid[]))
          + (SELECT count(*) FROM public.shared_worlds WHERE id = ANY($3::uuid[]))
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
          + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
    [humans, [f.experience, ...c.experiences], [f.world, c.world]]);
  assert.equal(Number(n), 0, 'every fixture this verifier created was rolled back or removed');
  const [{ worlds }] = await rows(`SELECT count(*) worlds FROM ${T.WORLD}`);
  assert.equal(Number(worlds), 1, 'and exactly one logical Public World still exists');
}, () => rt.client.end().catch(() => undefined));
