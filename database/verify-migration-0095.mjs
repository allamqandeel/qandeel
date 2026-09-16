// Real-PostgreSQL verifier for migration 0095 - I-05B Public Experience
// Publication, Canonical Visibility and Serving v1 (PART B).
//
// Runs against a FULLY migrated database and proves, from live catalogs and
// live execution:
//
//   catalog / posture
//     * the publish boundary, the visibility derivation, the admission gate and
//       the CW2-08 prerequisite seam are executable by no application role;
//     * the seam answers NOT_EVALUATED and never CLEARED; the ONE serving
//       resolver is service_role-only and disclosure-bounded;
//     * the publication record is append-only and bound to its own Experience.
//
//   publish (every refusal proven against the PRODUCTION seam where possible,
//   and nothing partial ever left behind)
//     * PB01 DRAFT -> PUBLISHED is refused;
//     * PB02 with every authority gate satisfied the production seam still fails
//       the publication closed on the missing CW2-08 prerequisite;
//     * PB03 a non-controller and a nonexistent Experience get ONE class;
//     * PB04 a wrong version is refused;
//     * PB05 a WITHDRAWN required approval refuses;
//     * PB06 a MISSING required approval refuses (defense in depth: evidence loss);
//     * PB07 a package cannot be superseded once READY, so no superseded approval
//       can ever be the one consulted;
//     * PB08 a deleted (stale-revision) source refuses;
//     * PB09 a changed Public World authority snapshot refuses as stale;
//     * PB10 a Shared source the publisher may no longer SEE refuses with the
//       nonexistent-source class;
//     * PB11 controller loss refuses;
//     * PB12 with a simulated CLEARED seam (rolled back afterwards) the exact
//       version publishes exactly once; retry is idempotent.
//
//   visibility / serving
//     * VS01 DRAFT, READY_FOR_REVIEW and a nonexistent id are ONE state; PUBLISHED
//       is visible with the exact version and manifest;
//     * VS02 admission follows the frozen 0091 policy: signed-out fails closed on
//       UNRESOLVED, a registered account is admitted, an unknown viewer is not;
//     * SV01 the serving resolver returns the bounded derivative for admitted
//       viewers only, in package order, with the CURRENT display label;
//     * SV02 nonexistent, DRAFT, READY and not-admitted are indistinguishable;
//     * SV03 a moved version pointer turns visibility off, fail closed.
//
//   concurrency (committed fixtures, committed seam simulation restored and
//   proven restored, database-bounded waits)
//     * C01 publish versus withdrawal in both orders;
//     * C02 publish versus a competing preparation: supersession of a READY
//       package is structurally impossible;
//     * C03 duplicate publish from two connections publishes once;
//     * C04 publish versus a source deletion has one truthful winner.
//
//   forward safety inside a rolled-back SAVEPOINT, then every regression to
//   something 0095 OWNS planted and still refused; and zero fixture residue.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, NONE, SEAM, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, count, actAs, asRole, rejected } = rt;

const PUBLISH = 'public.publish_public_experience_v1(uuid, uuid, uuid)';
const VISIBILITY = 'public.resolve_public_visibility_state_v1(uuid)';
const ADMISSION = 'public.resolve_public_audience_admission_v1(uuid)';
const SERVING = 'public.resolve_public_experience_serving_v1(uuid, uuid)';
const TRIGGER_FN = 'public.reject_public_publication_state_mutation_v1()';
const OWN_TABLES = [T.PUBLISH_COMMANDS, T.PUBLICATION_STATE];

async function verifyCatalog() {
  await rt.verifyPosture({
    internal: [SEAM, VISIBILITY, ADMISSION, PUBLISH],
    triggers: [TRIGGER_FN],
    reading: [SEAM, VISIBILITY, ADMISSION],
    mutating: [PUBLISH],
    resolvers: [SERVING],
    tables: OWN_TABLES,
    immutable: [[T.PUBLICATION_STATE, 'public_experience_publication_state_immutable'],
      [T.APPROVALS, 'publication_manifest_approvals_immutable'],
      [T.LIFECYCLE, 'public_experience_lifecycle_events_immutable']],
  });
  const seam = await rt.functionPosture(SEAM);
  assert.ok(seam.prosrc.includes('NOT_EVALUATED') && !seam.prosrc.includes("'CLEARED'"),
    'the CW2-08 prerequisite seam fails closed: NOT_EVALUATED, never CLEARED');
  const publish = await rt.functionPosture(PUBLISH);
  for (const needle of ['auth.uid()', 'FROM public.public_world_state w WHERE w.singleton FOR UPDATE',
    'FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE', 'FROM public.shared_worlds w',
    'ORDER BY m.id FOR SHARE', 'ORDER BY i.id FOR SHARE', 'ORDER BY cu.id FOR SHARE', 'public_experience_controllers',
    "current_lifecycle <> 'READY_FOR_REVIEW'", 'public_experience_review_ready_commands',
    'resolve_shared_world_history_visibility_v1', 'derive_public_publication_authority_v1',
    'derive_publication_manifest_effective_approvals_v1', "'MISSING'", "<> 'EFFECTIVE'",
    'ready_fingerprint IS DISTINCT FROM derived_fingerprint', 'resolve_public_publication_prerequisites_v1',
    "clearance_state IS DISTINCT FROM 'CLEARED'", "current_lifecycle = 'PUBLISHED'"]) {
    assert.ok(publish.prosrc.includes(needle), `the publish boundary revalidates through: ${needle}`);
  }
  assert.ok(!publish.prosrc.includes('ABSENT_FROM_PUBLIC_WORLD'), 'the publish boundary owns no disappearance lifecycle');
  assert.ok(!publish.prosrc.includes('PREPARE_PUBLICATION'), 'a preparation command is never publication consent');
  assert.ok(publish.prosrc.indexOf('derive_publication_manifest_effective_approvals_v1') < publish.prosrc.indexOf('resolve_public_publication_prerequisites_v1'),
    'the prerequisite seam is the LAST gate, after every authority gate');
  for (const forbidden of ['shared_world_membership_episodes', 'shared_world_history_access_grants',
    'shared_world_standard_closed_view_entitlements', 'shared_world_history_package_manifest_items']) {
    assert.ok(!publish.prosrc.includes(forbidden), `publication re-implements no Shared authorization out of ${forbidden}`);
  }
  const visibility = await rt.functionPosture(VISIBILITY);
  for (const needle of ["current_lifecycle = 'PUBLISHED'", 'public_experience_publication_state',
    'current_experience_version_id = s.published_experience_version_id', 'NOT_PUBLICLY_VISIBLE']) {
    assert.ok(visibility.prosrc.includes(needle), `the canonical visibility derivation requires: ${needle}`);
  }
  assert.ok(!visibility.prosrc.includes('public_audience_policy_state'), 'object visibility reads no viewing policy');
  for (const fn of [PUBLISH, SEAM, VISIBILITY]) {
    for (const name of await rt.inputParameters(fn)) {
      assert.doesNotMatch(name, /approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|clear|launch|safety|entitle|allow|effective|fingerprint/u,
        `${fn} may not accept ${name}`);
    }
  }
  // Version, Experience and manifest are ONE exact version row (REV-02) in both
  // relations this migration created: ONE composite restrictive foreign key onto
  // the additive candidate key on the frozen version relation, no independent
  // partial key into versions, and no direct manifest key beside it. Two
  // independent keys would let version V1 travel with the manifest of V2 of the
  // same Experience (PB13); weakening back into that shape fails this program.
  assert.deepEqual(await rt.uniqueKeyColumns(T.VERSIONS, 'public_experience_versions_exact_identity_key'),
    ['id', 'experience_id', 'package_manifest_version_id'], 'the frozen version relation carries the additive exact-identity candidate key');
  await rt.assertExactBinding(T.PUBLICATION_STATE, T.VERSIONS,
    ['published_experience_version_id', 'experience_id', 'published_manifest_version_id'], ['id', 'experience_id', 'package_manifest_version_id']);
  await rt.assertExactBinding(T.PUBLISH_COMMANDS, T.VERSIONS,
    ['experience_version_id', 'experience_id', 'manifest_version_id'], ['id', 'experience_id', 'package_manifest_version_id']);
  for (const table of OWN_TABLES) {
    assert.deepEqual(await rt.foreignKeysInto(table, T.MANIFESTS), [], `${table} binds the manifest through the version row, never independently`);
  }
  const [{ allowed: entry }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed',
    ['service_role', 'public.resolve_shared_world_history_visibility_v1(uuid, uuid)', 'EXECUTE']);
  assert.equal(entry, true, 'the frozen I-04F visibility entry point is still reachable');
  const [{ signed_out_viewing_policy: signedOut }] = await rows(`SELECT signed_out_viewing_policy FROM ${T.POLICY} WHERE singleton`);
  assert.equal(signedOut, 'UNRESOLVED', 'the frozen CW2-08 signed-out viewing requirement stays UNRESOLVED');
}

/** After any refusal, nothing partial exists for the Experience. */
async function assertNothingPublished(experience, expectedLifecycle) {
  assert.equal(await count(T.PUBLICATION_STATE, 'experience_id = $1', [experience]), 0, 'no publication record');
  assert.equal(await count(T.PUBLISH_COMMANDS, 'experience_id = $1', [experience]), 0, 'no publish command');
  assert.equal(await count(T.LIFECYCLE, "experience_id = $1 AND to_lifecycle = 'PUBLISHED'", [experience]), 0, 'no PUBLISHED transition');
  const [{ current_lifecycle }] = await rows(`SELECT current_lifecycle FROM ${T.EXPERIENCES} WHERE id = $1`, [experience]);
  assert.equal(current_lifecycle, expectedLifecycle, `the Experience stayed ${expectedLifecycle}`);
  assert.equal((await rt.visibility(experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE', 'and it is not publicly visible');
}

async function verifyPublish(f, seam) {
  const ready = await rt.bringToReady(f, { experience: f.experience, manifest: f.manifest, version: f.version });
  const hadirApproval = ready.approvals.get(f.hadir);

  // PB02 with the PRODUCTION seam: every authority gate is satisfied and the
  // publication still fails closed on the missing CW2-08 prerequisite.
  await actAs(f.mohamed);
  await rejected(() => rt.publish(randomUUID(), f.experience, f.version), ['55000'], /PUBLIC_EXPERIENCE_LAUNCH_PREREQUISITE_UNRESOLVED/u);
  await assertNothingPublished(f.experience, 'READY_FOR_REVIEW');
  const [seamAnswer] = await rt.prerequisites(f.experience, f.manifest);
  assert.equal(seamAnswer.clearance, 'NOT_EVALUATED', 'PB02 the production seam evaluates nothing');

  // PB01 DRAFT never jumps to PUBLISHED, even with a cleared seam.
  const draft = randomUUID(); const dm = randomUUID(); const dv = randomUUID();
  const dm2 = randomUUID(); const dv2 = randomUUID();
  await rt.createDraft(randomUUID(), draft);
  await rt.prepare(randomUUID(), draft, dm, dv, [randomUUID()], [f.userUnit], NONE, NONE, NONE);
  await rt.approve(randomUUID(), dm);
  await rt.clearPrerequisites();
  try {
    await rejected(() => rt.publish(randomUUID(), draft, dv), ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);
    await assertNothingPublished(draft, 'DRAFT');

    // PB03 a non-controller and a nonexistent Experience: ONE class.
    await actAs(f.hadir);
    const nonController = await rejected(() => rt.publish(randomUUID(), f.experience, f.version), ['42501'], /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);
    await actAs(f.mohamed);
    const nonexistent = await rejected(() => rt.publish(randomUUID(), randomUUID(), f.version), ['42501'], /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);
    assert.equal(nonController.message, nonexistent.message, 'PB03 no existence oracle for a controller command');
    await actAs(null);
    await rejected(() => rt.publish(randomUUID(), f.experience, f.version), ['42501'], /PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED/u);
    await actAs(f.mohamed);
    await rejected(() => rt.publish(randomUUID(), f.experience, null), ['22023']);

    // PB04 a wrong version: unknown -> not available; a version of another
    // Experience -> not available; both leave nothing behind.
    await rejected(() => rt.publish(randomUUID(), f.experience, randomUUID()), ['P0002'], /PUBLIC_EXPERIENCE_NOT_AVAILABLE/u);
    await rejected(() => rt.publish(randomUUID(), f.experience, dv), ['P0002'], /PUBLIC_EXPERIENCE_NOT_AVAILABLE/u);
    await assertNothingPublished(f.experience, 'READY_FOR_REVIEW');

    // PB13 THE MISMATCHED PAIR, structurally. A second package of the DRAFT
    // Experience gives it V1/M1 and V2/M2 through the frozen preparation alone.
    // Under two independent foreign keys the pair (V1, M2) satisfies both - V1
    // is a version of this Experience and M2 is a manifest of this Experience -
    // so only the exact composite binding can refuse it. PostgreSQL refuses it
    // for the publication record AND the publish command; the true pairs are
    // accepted (and rolled back), so the refusal is the mismatch and nothing else.
    await actAs(f.mohamed);
    await rt.prepare(randomUUID(), draft, dm2, dv2, [randomUUID()], [f.userUnit], NONE, NONE, NONE);
    await asRole('postgres');
    await rejected(() => q(`INSERT INTO ${T.PUBLICATION_STATE}
                              (experience_id, published_experience_version_id, published_manifest_version_id,
                               authority_request_fingerprint, prerequisite_clearance_basis, publication_revision, published_at)
                            VALUES ($1, $2, $3, $4, 'PB13 structural probe', 1, now())`, [draft, dv, dm2, PROBE_REF]), ['23503']);
    await rejected(() => q(`INSERT INTO ${T.PUBLISH_COMMANDS}
                              (id, experience_id, experience_version_id, manifest_version_id, actor_user_id,
                               effective_approval_count, authority_request_fingerprint, request_ref, committed_at)
                            VALUES ($1, $2, $3, $4, $5, 0, $6, $6, now())`, [randomUUID(), draft, dv, dm2, f.mohamed, PROBE_REF]), ['23503']);
    await q('SAVEPOINT exact_pair');
    await q(`INSERT INTO ${T.PUBLICATION_STATE}
               (experience_id, published_experience_version_id, published_manifest_version_id,
                authority_request_fingerprint, prerequisite_clearance_basis, publication_revision, published_at)
             VALUES ($1, $2, $3, $4, 'PB13 structural probe', 1, now())`, [draft, dv2, dm2, PROBE_REF]);
    await q(`INSERT INTO ${T.PUBLISH_COMMANDS}
               (id, experience_id, experience_version_id, manifest_version_id, actor_user_id,
                effective_approval_count, authority_request_fingerprint, request_ref, committed_at)
             VALUES ($1, $2, $3, $4, $5, 0, $6, $6, now())`, [randomUUID(), draft, dv, dm, f.mohamed, PROBE_REF]);
    assert.equal(await count(T.PUBLICATION_STATE, 'experience_id = $1', [draft]), 1, 'PB13 the exact pair of ONE version row is representable');
    await q('ROLLBACK TO SAVEPOINT exact_pair'); await q('RELEASE SAVEPOINT exact_pair');
    await assertNothingPublished(draft, 'DRAFT');
    await actAs(f.mohamed);

    // PB05 a WITHDRAWN required approval refuses, and the READY snapshot is not trusted.
    await q('SAVEPOINT withdrawn');
    await actAs(f.hadir);
    await rt.withdraw(randomUUID(), hadirApproval);
    await actAs(f.mohamed);
    await rejected(() => rt.publish(randomUUID(), f.experience, f.version), ['55000'], /PUBLIC_EXPERIENCE_APPROVAL_NOT_EFFECTIVE/u);
    await assertNothingPublished(f.experience, 'READY_FOR_REVIEW');
    await q('ROLLBACK TO SAVEPOINT withdrawn'); await q('RELEASE SAVEPOINT withdrawn');

    // PB06 a MISSING required approval refuses. READY needed every approval, so
    // the only way to reach this gate is evidence loss - simulated by the owner
    // with the guard lifted inside a savepoint. Defense in depth is still a gate.
    await q('SAVEPOINT missing');
    await q(`ALTER TABLE ${T.APPROVALS} DISABLE TRIGGER publication_manifest_approvals_immutable`);
    await q(`DELETE FROM ${T.APPROVALS} WHERE id = $1`, [hadirApproval]);
    await q(`ALTER TABLE ${T.APPROVALS} ENABLE TRIGGER publication_manifest_approvals_immutable`);
    assert.deepEqual((await rt.deriveManifestApprovals(f.manifest)).map((r) => r.effective_state).sort(), ['EFFECTIVE', 'MISSING']);
    await rejected(() => rt.publish(randomUUID(), f.experience, f.version), ['P0002'], /PUBLIC_EXPERIENCE_APPROVALS_INCOMPLETE/u);
    await assertNothingPublished(f.experience, 'READY_FOR_REVIEW');
    await q('ROLLBACK TO SAVEPOINT missing'); await q('RELEASE SAVEPOINT missing');

    // PB07 a READY package cannot be superseded: the frozen preparation refuses
    // a non-DRAFT Experience, so the approvals publication consults are always
    // those of the current manifest.
    await rejected(() => rt.prepare(randomUUID(), f.experience, randomUUID(), randomUUID(), NONE, NONE,
      [randomUUID()], [f.world], [f.mohamedMaterial]), ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);
    assert.deepEqual((await rt.deriveManifestApprovals(f.manifest)).map((r) => r.effective_state), ['EFFECTIVE', 'EFFECTIVE']);

    // PB08 a deleted source: the frozen I-04G owner deletion bumps the
    // availability revision; the ONE authority derivation refuses.
    await q('SAVEPOINT deletion');
    await actAs(f.hadir);
    await rt.deleteMaterial(randomUUID(), f.world, f.hadirMaterial, randomUUID());
    await actAs(f.mohamed);
    await rejected(() => rt.publish(randomUUID(), f.experience, f.version), ['P0002'], /PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE/u);
    await assertNothingPublished(f.experience, 'READY_FOR_REVIEW');
    await q('ROLLBACK TO SAVEPOINT deletion'); await q('RELEASE SAVEPOINT deletion');

    // PB09 a changed Public World authority snapshot: stale.
    await q('SAVEPOINT snapshot');
    await q(`UPDATE ${T.WORLD} SET state_version = state_version + 1`);
    await rejected(() => rt.publish(randomUUID(), f.experience, f.version), ['40001'], /PUBLIC_EXPERIENCE_STALE/u);
    await assertNothingPublished(f.experience, 'READY_FOR_REVIEW');
    await q('ROLLBACK TO SAVEPOINT snapshot'); await q('RELEASE SAVEPOINT snapshot');

    // PB10 a Shared source the publisher may no longer SEE. Ending Mohamed's
    // episode is what a leave or removal does; the canonical I-04F resolver then
    // shows him nothing, and publication refuses with the nonexistent-source class.
    await q('SAVEPOINT hidden');
    await q(`UPDATE public.shared_world_membership_episodes SET ended_at = now()
              WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL`, [f.world, f.mohamed]);
    assert.deepEqual(await rows('SELECT history_item_id FROM public.resolve_shared_world_history_visibility_v1($1, $2)', [f.world, f.mohamed]), [],
      'PB10 fixture: the canonical resolver shows the former member nothing');
    const hidden = await rejected(() => rt.publish(randomUUID(), f.experience, f.version), ['P0002'], /PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE/u);
    assert.equal(hidden.message.includes('PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE'), true);
    await assertNothingPublished(f.experience, 'READY_FOR_REVIEW');
    await q('ROLLBACK TO SAVEPOINT hidden'); await q('RELEASE SAVEPOINT hidden');

    // PB11 controller loss refuses.
    await q('SAVEPOINT control');
    await q(`DELETE FROM ${T.CONTROLLERS} WHERE experience_id = $1`, [f.experience]);
    await rejected(() => rt.publish(randomUUID(), f.experience, f.version), ['42501'], /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);
    await q('ROLLBACK TO SAVEPOINT control'); await q('RELEASE SAVEPOINT control');

    // PB12 with the simulated CLEARED seam, the exact version publishes once.
    const command = randomUUID();
    const before = (await rows(`SELECT experience_revision FROM ${T.EXPERIENCES} WHERE id = $1`, [f.experience]))[0].experience_revision;
    const [published] = await rt.publish(command, f.experience, f.version);
    assert.equal(published.outcome, 'PUBLISHED');
    assert.equal(published.current_lifecycle, 'PUBLISHED');
    assert.equal(published.experience_version_id, f.version);
    assert.equal(published.manifest_version_id, f.manifest);
    assert.equal(Number(published.effective_approval_count), 2);
    assert.equal(published.authority_request_fingerprint, ready.fingerprint, 'PB12 the fingerprint READY committed is still the current one');
    const [state] = await rows(`SELECT * FROM ${T.PUBLICATION_STATE} WHERE experience_id = $1`, [f.experience]);
    assert.equal(state.published_experience_version_id, f.version);
    assert.equal(state.published_manifest_version_id, f.manifest);
    assert.equal(Number(state.publication_revision), 1);
    assert.match(state.prerequisite_clearance_basis, /VERIFIER PROBE/u, 'the record names the basis the seam gave');
    const [{ experience_revision: after }] = await rows(`SELECT experience_revision FROM ${T.EXPERIENCES} WHERE id = $1`, [f.experience]);
    assert.equal(Number(after), Number(before) + 1);
    const transitions = await rows(`SELECT id, from_lifecycle, to_lifecycle, experience_version_id FROM ${T.LIFECYCLE}
                                     WHERE experience_id = $1 ORDER BY occurred_at`, [f.experience]);
    assert.deepEqual(transitions.map((r) => [r.from_lifecycle, r.to_lifecycle]),
      [[null, 'DRAFT'], ['DRAFT', 'READY_FOR_REVIEW'], ['READY_FOR_REVIEW', 'PUBLISHED']]);
    assert.equal(transitions[2].id, command, 'the transition reuses the command identity');
    assert.equal(transitions[2].experience_version_id, f.version);
    // Idempotent retry, conflicting reuse, and no second publication.
    const [retry] = await rt.publish(command, f.experience, f.version);
    assert.equal(retry.outcome, 'ALREADY_COMMITTED');
    assert.equal(retry.authority_request_fingerprint, published.authority_request_fingerprint);
    await rejected(() => rt.publish(command, f.experience, dv), ['23505'], /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
    await rejected(() => rt.publish(randomUUID(), f.experience, f.version), ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);
    assert.equal(await count(T.PUBLICATION_STATE, 'experience_id = $1', [f.experience]), 1);
    // The publication record is immutable for the owner too.
    await rejected(() => q(`UPDATE ${T.PUBLICATION_STATE} SET published_experience_version_id = $2 WHERE experience_id = $1`, [f.experience, dv]),
      ['55000'], /PUBLIC_PUBLICATION_STATE_IS_IMMUTABLE/u);
    await rejected(() => q(`DELETE FROM ${T.PUBLICATION_STATE} WHERE experience_id = $1`, [f.experience]), ['55000']);
    // A published Experience cannot be re-prepared or re-approved by the frozen primitives.
    await rejected(() => rt.prepare(randomUUID(), f.experience, randomUUID(), randomUUID(), [randomUUID()], [f.userUnit], NONE, NONE, NONE),
      ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);
  } finally {
    await rt.restorePrerequisites(seam);
  }
  await rejected(() => rt.publish(randomUUID(), draft, dv), ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);
  return { draft, dm, dv, dm2, dv2, ready };
}

/** A well-formed fingerprint / request_ref for a structural probe row; its value carries no meaning. */
const PROBE_REF = `sha256:${'0'.repeat(64)}`;

async function verifyVisibilityAndServing(f, published) {
  // VS01 the ONE visibility derivation.
  const [visible] = await rt.visibility(f.experience);
  assert.equal(visible.visibility_state, 'PUBLICLY_VISIBLE');
  assert.equal(visible.visible_experience_version_id, f.version);
  assert.equal(visible.visible_manifest_version_id, f.manifest);
  assert.equal(Number(visible.visible_version_ordinal), 1);
  const [draftState] = await rt.visibility(published.draft);
  const [absentState] = await rt.visibility(randomUUID());
  assert.equal(draftState.visibility_state, 'NOT_PUBLICLY_VISIBLE');
  assert.deepEqual({ ...draftState, experience_id: null }, { ...absentState, experience_id: null },
    'VS01 a DRAFT and a nonexistent id are ONE state');
  // A READY_FOR_REVIEW Experience is invisible too.
  const readyExp = randomUUID(); const rm = randomUUID(); const rv = randomUUID();
  await rt.bringToReady(f, { experience: readyExp, manifest: rm, version: rv, personal: false, shared: [f.mohamedMaterial] });
  assert.equal((await rt.visibility(readyExp))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE', 'VS01 READY_FOR_REVIEW is not public');
  await rejected(() => rt.visibility(null), ['22023']);

  // VS02 admission.
  assert.deepEqual(await rt.admission(null), [{ admission: 'NOT_ADMITTED', viewer_class: 'SIGNED_OUT' }],
    'VS02 signed-out fails closed while the frozen requirement is UNRESOLVED');
  assert.deepEqual(await rt.admission(f.reader), [{ admission: 'ADMITTED', viewer_class: 'REGISTERED' }],
    'VS02 a registered account is admitted');
  assert.deepEqual(await rt.admission(randomUUID()), [{ admission: 'NOT_ADMITTED', viewer_class: 'REGISTERED' }],
    'VS02 an unknown viewer is not');
  await q('SAVEPOINT policy');
  await q(`UPDATE ${T.POLICY} SET signed_out_viewing_policy = 'ALLOWED', registered_viewing_policy = 'REGISTERED_AND_SIGNED_OUT'`);
  assert.equal((await rt.admission(null))[0].admission, 'ADMITTED', 'VS02 the gate follows the policy singleton');
  assert.ok((await rt.serving(f.experience, null)).length > 0, 'VS02 and serving follows the gate');
  await q(`UPDATE ${T.POLICY} SET signed_out_viewing_policy = 'DENIED'`);
  assert.equal((await rt.admission(null))[0].admission, 'NOT_ADMITTED');
  await q('ROLLBACK TO SAVEPOINT policy'); await q('RELEASE SAVEPOINT policy');

  // SV01 serving: bounded derivative, package order, current label, admitted viewers only.
  await actAs(f.mohamed);
  await rt.updateLabel(randomUUID(), 'REAL_NAME', 'the publisher renamed');
  const served = await rt.serving(f.experience, f.reader);
  assert.equal(served.length, 3, 'SV01 the three package items are served');
  assert.deepEqual(served.map((r) => Number(r.item_ordinal)), [1, 2, 3], 'in package order');
  assert.ok(served.every((r) => r.experience_version_id === f.version && r.publisher_public_identity_ref === f.mohamedRef));
  assert.ok(served.every((r) => r.publisher_display_label === 'the publisher renamed' && r.publisher_label_mode === 'REAL_NAME'),
    'SV01 the CURRENT display label renders; the package bound the stable ref');
  assert.deepEqual(served.map((r) => r.public_text_body).sort(),
    [f.userText, 'a sentence Mohamed wrote', 'a sentence Hadir wrote'].sort(), 'SV01 the bodies are the bounded public derivative');
  assert.ok(served.every((r) => r.published_at instanceof Date));
  for (const row of served) {
    for (const column of Object.keys(row)) {
      assert.doesNotMatch(column, /user_id|shared_|world_id|material_id|history_item|conversation_unit|session|provenance|digest|fingerprint/u,
        `SV01 the served row carries no ${column}`);
    }
  }
  // A stranger (registered, no Public Identity) and a former member are admitted viewers too.
  assert.equal((await rt.serving(f.experience, f.stranger)).length, 3);
  assert.equal((await rt.serving(f.experience, f.hadir)).length, 3);
  // SV02 anti-oracle: every non-served case is the same empty answer.
  assert.deepEqual(await rt.serving(f.experience, null), [], 'SV02 signed-out is not admitted');
  assert.deepEqual(await rt.serving(randomUUID(), f.reader), [], 'SV02 nonexistent');
  assert.deepEqual(await rt.serving(published.draft, f.reader), [], 'SV02 DRAFT');
  assert.deepEqual(await rt.serving(readyExp, f.reader), [], 'SV02 READY_FOR_REVIEW');
  assert.deepEqual(await rt.serving(f.experience, randomUUID()), [], 'SV02 unknown viewer');
  await rejected(() => rt.serving(null, f.reader), ['22023']);
  // The resolver is reachable by service_role and nobody else; tables stay sealed.
  for (const role of APP_ROLES) {
    await q('SAVEPOINT v');
    await asRole(role, f.reader);
    if (role === 'service_role') {
      assert.equal((await rt.serving(f.experience, f.reader)).length, 3, 'service_role executes the ONE serving resolver');
    } else {
      await rejected(() => rt.serving(f.experience, f.reader), ['42501']);
    }
    for (const table of [...OWN_TABLES, T.EXPERIENCES, T.BODIES, T.PROVENANCE]) await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), ['42501']);
    await rejected(() => rt.publish(randomUUID(), f.experience, f.version), ['42501']);
    await rejected(() => rt.visibility(f.experience), ['42501']);
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT v'); await q('RELEASE SAVEPOINT v');
  }

  // SV03 a moved version pointer turns visibility off, fail closed, even though
  // the lifecycle and the publication record still say PUBLISHED.
  await q('SAVEPOINT pointer');
  const [{ current_lifecycle }] = await rows(`SELECT current_lifecycle FROM ${T.EXPERIENCES} WHERE id = $1`, [f.experience]);
  assert.equal(current_lifecycle, 'PUBLISHED');
  // A second version of THIS Experience, written by the owner (versions are
  // append-only, and appending is allowed), then the pointer is moved to it.
  const ghost = randomUUID();
  await q(`INSERT INTO ${T.MANIFESTS} (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
             intended_publication_action, target_audience_class, authority_readiness, prepared_authority_snapshot_version, item_count, created_at)
           SELECT $1, experience_id, true, publisher_public_identity_ref, publisher_user_id, intended_publication_action,
                  target_audience_class, authority_readiness, prepared_authority_snapshot_version, item_count, now()
             FROM ${T.MANIFESTS} WHERE id = $2`, [ghost, f.manifest]);
  const ghostVersion = randomUUID();
  await q(`INSERT INTO ${T.VERSIONS} (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
           VALUES ($1, $2, $3, 2, now())`, [ghostVersion, f.experience, ghost]);
  await q(`UPDATE ${T.EXPERIENCES} SET current_experience_version_id = $2 WHERE id = $1`, [f.experience, ghostVersion]);
  assert.equal((await rt.visibility(f.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE',
    'SV03 a publication whose pointer moved is not visible');
  assert.deepEqual(await rt.serving(f.experience, f.reader), [], 'SV03 and is not served');
  await q('ROLLBACK TO SAVEPOINT pointer'); await q('RELEASE SAVEPOINT pointer');
  assert.equal((await rt.visibility(f.experience))[0].visibility_state, 'PUBLICLY_VISIBLE');
}

async function verifyForwardSafety(f, seam, published) {
  await q('SAVEPOINT forward_safety');
  try {
    // A later reviewed I-05C slice: an absence record beside the immutable
    // publication record, and a writer that moves the lifecycle out of PUBLISHED.
    await q(`CREATE TABLE public.i05b95_probe_absence_state (
               experience_id uuid PRIMARY KEY REFERENCES ${T.EXPERIENCES} (id), absent_since timestamptz NOT NULL)`);
    await q(`CREATE FUNCTION public.i05b95_probe_absence_v1(p_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN UPDATE public.public_experiences e
                      SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD' WHERE e.id = p_id; END$fn$`);
    await q('CREATE TABLE public.i05b95_probe_launch_gate (id uuid PRIMARY KEY, capability text NOT NULL)');
    await q(`ALTER TABLE ${T.PUBLISH_COMMANDS} ADD COLUMN i05b95_probe_note text`);
    await q(`CREATE INDEX i05b95_probe_idx ON ${T.PUBLICATION_STATE} (published_at)`);
    await verifyCatalog();
    // And the absence writer really turns the published Experience dark through
    // the ONE derivation, with the publication record untouched.
    await q('SELECT public.i05b95_probe_absence_v1($1)', [f.experience]);
    assert.equal((await rt.visibility(f.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE',
      'a later reviewed non-serving lifecycle turns every surface dark without rewriting the publication record');
    assert.deepEqual(await rt.serving(f.experience, f.reader), []);
    assert.equal(await count(T.PUBLICATION_STATE, 'experience_id = $1', [f.experience]), 1);

    const refuses = { name: 'AssertionError' };
    await q('SAVEPOINT r1');
    await rt.clearPrerequisites();
    await assert.rejects(verifyCatalog(), refuses, 'a seam that answers CLEARED without a canonical gate is a regression');
    await q('ROLLBACK TO SAVEPOINT r1');
    assert.equal((await rt.functionPosture(SEAM)).prosrc, seam.prosrc);

    await q('SAVEPOINT r2');
    await q(`GRANT EXECUTE ON FUNCTION ${PUBLISH} TO authenticated`);
    await assert.rejects(verifyCatalog(), refuses, 'publication becoming reachable before the Launch Gate is a regression');
    await q('ROLLBACK TO SAVEPOINT r2');

    await q('SAVEPOINT r3');
    await q(`GRANT EXECUTE ON FUNCTION ${SERVING} TO anon`);
    await assert.rejects(verifyCatalog(), refuses, 'the serving resolver opening to anon is a regression');
    await q('ROLLBACK TO SAVEPOINT r3');

    await q('SAVEPOINT r4');
    await q(`REVOKE EXECUTE ON FUNCTION ${SERVING} FROM service_role`);
    await assert.rejects(verifyCatalog(), refuses, 'the ONE serving boundary becoming unreachable is a regression');
    await q('ROLLBACK TO SAVEPOINT r4');

    await q('SAVEPOINT r5');
    await q(`ALTER TABLE ${T.PUBLICATION_STATE} DISABLE TRIGGER public_experience_publication_state_immutable`);
    await assert.rejects(verifyCatalog(), refuses, 'a mutable publication record is a regression');
    await q('ROLLBACK TO SAVEPOINT r5');

    await q('SAVEPOINT r6');
    // A publish boundary that stops reading effective approvals. Same signature.
    await q(`CREATE OR REPLACE FUNCTION public.publish_public_experience_v1(p_command_id uuid, p_experience_id uuid, p_experience_version_id uuid)
             RETURNS TABLE(outcome text, experience_id uuid, experience_version_id uuid, manifest_version_id uuid,
                           current_lifecycle text, effective_approval_count integer, authority_request_fingerprint text,
                           committed_at timestamptz)
             LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $fn$
             BEGIN UPDATE public.public_experiences e SET current_lifecycle = 'PUBLISHED' WHERE e.id = p_experience_id; RETURN; END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'a publish boundary that skips the effective-approval gate is a regression');
    await q('ROLLBACK TO SAVEPOINT r6');

    await q('SAVEPOINT r7');
    await q(`UPDATE ${T.POLICY} SET signed_out_viewing_policy = 'ALLOWED'`);
    await assert.rejects(verifyCatalog(), refuses, 'guessing the unresolved signed-out launch requirement is a regression');
    await q('ROLLBACK TO SAVEPOINT r7');

    await q('SAVEPOINT r8');
    // The weakening REV-02 named: the publication record binding version and
    // manifest through two independent foreign keys. The catalog program refuses
    // the shape - and the shape really admits version V1 beside the manifest of
    // V2 of the same Experience, the pair PB13 proved unrepresentable.
    await q(`ALTER TABLE ${T.PUBLICATION_STATE} DROP CONSTRAINT public_experience_publication_state_version_fk`);
    await q(`ALTER TABLE ${T.PUBLICATION_STATE} ADD CONSTRAINT i05b95_probe_version_fk
             FOREIGN KEY (published_experience_version_id, experience_id) REFERENCES ${T.VERSIONS} (id, experience_id) ON DELETE RESTRICT`);
    await q(`ALTER TABLE ${T.PUBLICATION_STATE} ADD CONSTRAINT i05b95_probe_manifest_fk
             FOREIGN KEY (published_manifest_version_id, experience_id) REFERENCES ${T.VERSIONS} (package_manifest_version_id, experience_id) ON DELETE RESTRICT`);
    await assert.rejects(verifyCatalog(), refuses, 'two independent foreign keys in place of the exact version and manifest binding is a regression');
    await q(`INSERT INTO ${T.PUBLICATION_STATE}
               (experience_id, published_experience_version_id, published_manifest_version_id,
                authority_request_fingerprint, prerequisite_clearance_basis, publication_revision, published_at)
             VALUES ($1, $2, $3, $4, 'r8 weakened-shape probe', 1, now())`, [published.draft, published.dv, published.dm2, PROBE_REF]);
    assert.equal(await count(T.PUBLICATION_STATE, 'experience_id = $1 AND published_experience_version_id = $2 AND published_manifest_version_id = $3',
      [published.draft, published.dv, published.dm2]), 1,
    'anti-vacuity: the weakened shape admits the mismatched version and manifest pair the exact binding refused in PB13');
    await q('ROLLBACK TO SAVEPOINT r8');
  } finally {
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
  }
}

async function verifyConcurrency(c, seam) {
  const { q2, actAs2, close } = await rt.openSecondary();
  try {
    await asRole('postgres');
    // Two READY Experiences for the two withdrawal orders, one for duplicates,
    // one for the source-deletion race.
    const exA = await rt.bringToReady(c, { experience: c.experience, manifest: c.manifest, version: c.version, personal: false });
    const expB = c.experiences[1]; const expC = c.experiences[2]; const expD = c.experiences[3];
    const exB = await rt.bringToReady(c, { experience: expB, manifest: randomUUID(), version: randomUUID(), personal: false });
    const exC = await rt.bringToReady(c, { experience: expC, manifest: randomUUID(), version: randomUUID(), personal: false, shared: [c.mohamedMaterial] });
    const exD = await rt.bringToReady(c, { experience: expD, manifest: randomUUID(), version: randomUUID(), personal: false });
    await asRole('postgres');
    await rt.clearPrerequisites();

    // C01a PUBLISH THEN WITHDRAWAL. The publication holds the Experience; the
    // withdrawal blocks; after the commit the withdrawal is recorded as truth
    // AFTER publication, and the published version stays visible: acting on it
    // is a later reviewed slice, never a silent I-05B decision.
    console.log('0095 concurrency C01a start');
    await q('BEGIN');
    await actAs(c.mohamed);
    const [pubA] = await rt.publish(randomUUID(), exA.experience, exA.version);
    assert.equal(pubA.outcome, 'PUBLISHED');
    await q2('BEGIN');
    await actAs2(c.hadir);
    const withdrawing = q2('SELECT * FROM public.withdraw_publication_approval_v1($1, $2)', [randomUUID(), exA.approvals.get(c.hadir)]);
    assert.equal(await rt.stillPending(withdrawing), true, 'C01a the withdrawal blocks on the Experience the publication holds');
    await q('COMMIT');
    const [wA] = (await withdrawing).rows;
    await q2('COMMIT');
    assert.equal(wA.outcome, 'WITHDRAWN');
    assert.equal((await rt.visibility(exA.experience))[0].visibility_state, 'PUBLICLY_VISIBLE',
      'C01a the publication that committed first is the truth; the later withdrawal is recorded, not silently acted on');
    console.log('0095 concurrency C01a pass');

    // C01b WITHDRAWAL THEN PUBLISH: the publication blocks, then refuses.
    console.log('0095 concurrency C01b start');
    await q2('BEGIN');
    await actAs2(c.hadir);
    await q2('SELECT * FROM public.withdraw_publication_approval_v1($1, $2)', [randomUUID(), exB.approvals.get(c.hadir)]);
    await q('BEGIN');
    await actAs(c.mohamed);
    const publishing = q('SELECT * FROM public.publish_public_experience_v1($1, $2, $3)', [randomUUID(), exB.experience, exB.version]);
    assert.equal(await rt.stillPending(publishing), true, 'C01b the publication blocks on the Experience the withdrawal holds');
    await q2('COMMIT');
    await assert.rejects(publishing, (error) => error.code === '55000' && /APPROVAL_NOT_EFFECTIVE/u.test(error.message),
      'C01b the withdrawal won, so the publication refuses');
    await q('ROLLBACK');
    assert.equal((await rows(`SELECT current_lifecycle FROM ${T.EXPERIENCES} WHERE id = $1`, [exB.experience]))[0].current_lifecycle, 'READY_FOR_REVIEW');
    assert.equal(await count(T.PUBLICATION_STATE, 'experience_id = $1', [exB.experience]), 0, 'C01b nothing partial');
    console.log('0095 concurrency C01b pass');

    // C02 PUBLISH VERSUS A COMPETING PREPARATION: the preparation blocks and then
    // is refused, because a READY or PUBLISHED package cannot be superseded.
    console.log('0095 concurrency C02 start');
    await q('BEGIN');
    await actAs(c.mohamed);
    const [pubC] = await rt.publish(randomUUID(), exC.experience, exC.version);
    assert.equal(pubC.outcome, 'PUBLISHED');
    await q2('BEGIN');
    await actAs2(c.mohamed);
    const preparing = q2('SELECT * FROM public.prepare_public_experience_manifest_v1($1,$2,$3,$4,$5::uuid[],$6::uuid[],$7::uuid[],$8::uuid[],$9::uuid[])',
      [randomUUID(), exC.experience, randomUUID(), randomUUID(), NONE, NONE, [randomUUID()], [c.world], [c.hadirMaterial]]);
    assert.equal(await rt.stillPending(preparing), true, 'C02 the preparation blocks behind the publication');
    await q('COMMIT');
    await assert.rejects(preparing, (error) => error.code === '55000' && /LIFECYCLE_INVALID/u.test(error.message),
      'C02 no later package can supersede a published one through the frozen primitives');
    await q2('ROLLBACK');
    console.log('0095 concurrency C02 pass');

    // C03 DUPLICATE PUBLISH from two connections: exactly one publication.
    console.log('0095 concurrency C03 start');
    const command = randomUUID();
    await q('BEGIN');
    await actAs(c.mohamed);
    const [pubD] = await rt.publish(command, exD.experience, exD.version);
    assert.equal(pubD.outcome, 'PUBLISHED');
    await q2('BEGIN');
    await actAs2(c.mohamed);
    const duplicate = q2('SELECT * FROM public.publish_public_experience_v1($1, $2, $3)', [command, exD.experience, exD.version]);
    assert.equal(await rt.stillPending(duplicate), true, 'C03 the duplicate blocks behind the first');
    await q('COMMIT');
    const [dup] = (await duplicate).rows;
    await q2('COMMIT');
    assert.equal(dup.outcome, 'ALREADY_COMMITTED', 'C03 the duplicate is served from the durable command');
    await actAs(c.mohamed);
    await q('BEGIN');
    try {
      await rejected(() => rt.publish(randomUUID(), exD.experience, exD.version), ['55000'], /LIFECYCLE_INVALID/u);
    } finally { await q('ROLLBACK'); }
    assert.equal(await count(T.PUBLICATION_STATE, 'experience_id = $1', [exD.experience]), 1, 'C03 exactly one publication record');
    assert.equal(await count(T.LIFECYCLE, "experience_id = $1 AND to_lifecycle = 'PUBLISHED'", [exD.experience]), 1);
    console.log('0095 concurrency C03 pass');

    // C04 PUBLISH VERSUS SOURCE DELETION: the deletion holds the Shared World
    // row in the frozen I-04 order; the publication blocks on it; the deletion
    // wins and the publication refuses. Uses B, which is still READY.
    console.log('0095 concurrency C04 start');
    await q2('BEGIN');
    await actAs2(c.hadir);
    await q2('SELECT * FROM public.delete_shared_world_owned_material_v1($1, $2, $3, $4)', [randomUUID(), c.world, c.hadirMaterial, randomUUID()]);
    await q('BEGIN');
    await actAs(c.mohamed);
    const racing = q('SELECT * FROM public.publish_public_experience_v1($1, $2, $3)', [randomUUID(), exB.experience, exB.version]);
    assert.equal(await rt.stillPending(racing), true, 'C04 the publication blocks on the Shared World row the deletion holds');
    await q2('COMMIT');
    await assert.rejects(racing, (error) => error.code === 'P0002' || error.code === '55000',
      'C04 the deletion won: the publication refuses rather than publishing a deleted source');
    await q('ROLLBACK');
    assert.equal((await rows(`SELECT current_lifecycle FROM ${T.EXPERIENCES} WHERE id = $1`, [exB.experience]))[0].current_lifecycle, 'READY_FOR_REVIEW');
    console.log('0095 concurrency C04 pass');
  } finally {
    await close();
    await asRole('postgres');
    await rt.restorePrerequisites(seam);
    console.log('0095 concurrency seam restored');
  }
}

await runVerifier('0095', async (stage) => {
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
    stage('publish boundary');
    const published = await verifyPublish(f, seam);
    stage('visibility and serving');
    await verifyVisibilityAndServing(f, published);
    stage('forward safety');
    await asRole('postgres');
    await verifyForwardSafety(f, seam, published);
  } finally {
    await q('ROLLBACK');
  }
  assert.equal((await rt.functionPosture(SEAM)).prosrc, seam.prosrc, 'the production seam is intact after the rolled-back section');

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
          + (SELECT count(*) FROM ${T.PUBLICATION_STATE} WHERE experience_id = ANY($2::uuid[]))
          + (SELECT count(*) FROM ${T.PUBLISH_COMMANDS} WHERE actor_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${T.EXPERIENCES} WHERE id = ANY($2::uuid[]))
          + (SELECT count(*) FROM public.shared_worlds WHERE id = ANY($3::uuid[]))
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
          + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
    [humans, [f.experience, ...c.experiences], [f.world, c.world]]);
  assert.equal(Number(n), 0, 'every fixture this verifier created was rolled back or removed');
  const [{ worlds }] = await rows(`SELECT count(*) worlds FROM ${T.WORLD}`);
  assert.equal(Number(worlds), 1, 'and exactly one logical Public World still exists');
}, () => rt.client.end().catch(() => undefined));
