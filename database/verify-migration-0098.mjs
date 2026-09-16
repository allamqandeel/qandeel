// Real-PostgreSQL verifier for migration 0098 - I-05C Continuing Public
// Eligibility and Canonical Visibility Closure v1 (PART A).
//
// Runs against a FULLY migrated database and proves, from live catalogs and
// live execution, the ONE claim PART A exists to make: an exact published
// package stops being public the INSTANT it stops being legitimately public,
// through canonical truth alone, with no row written anywhere.
//
//   catalog / posture
//     * both derivations are postgres-owned STABLE SECURITY DEFINER with a
//       pinned search_path, write nothing and are executable by no application
//       role - so the internal ineligibility cause is unreachable;
//     * the eligibility derivation consumes the frozen publication binding, the
//       ONE 0094 effective-approval derivation and the ONE I-05A authority
//       derivation, and reads no Shared membership, no Experience control and
//       no acting human at all - including, deliberately, no actor source-ACCESS
//       call, which is a publish-time gate and not a continuing condition;
//     * the visibility derivation consumes it, answers exactly two states,
//       keeps the frozen I-05B result shape and reads no viewing policy;
//     * EVERY outward Public surface still routes through it - the visibility
//       dependency census;
//     * the frozen CW2-08 prerequisite still answers NOT_EVALUATED.
//
//   continuing eligibility (nothing is written by any of it)
//     * CE01 a fully eligible publication is ELIGIBLE and PUBLICLY_VISIBLE;
//     * CE02 nonexistent, DRAFT and READY_FOR_REVIEW are ONE bounded class;
//     * CE03 a required rightsholder's withdrawal AFTER publication turns every
//       Public surface dark immediately, mutates no evidence, restores no Shared
//       browsing, grants no control and touches no unrelated Experience;
//     * CE04 a required approval lost from the evidence refuses too;
//     * CE05 the frozen I-04G owner deletion of an included Shared source turns
//       every surface dark and does NOT shrink the immutable package;
//     * CE06 a publisher who may no longer SEE an included Shared source does
//       NOT end the publication - lost actor ACCESS is not lost AVAILABILITY -
//       while the same fixture in the same state goes dark the moment the source
//       really becomes unavailable;
//     * CE07 a drifted CONTENT_RIGHTSHOLDER_SET is an authority invalidation;
//     * CE08 the Personal source class is consumed too - proven by lifting the
//       frozen 0064 guard inside a savepoint, and proven unreachable otherwise;
//     * CE09 no automatic reappearance and no silent successor package;
//     * CE10 every non-serving cause is ONE outward answer;
//     * CE11 stale projections and planted vitality cannot outvote it, and a
//       rebuild clears them;
//     * CE12 every public write path refuses at execution time under its lock.
//
//   forward safety inside a rolled-back SAVEPOINT: a legitimate additive future
//   slice still passes, and eleven weakenings are each refused AND shown to be
//   real regressions rather than vacuous ones - including P11, the plausible
//   future mistake of re-asking actor source ACCESS forever.
//
//   concurrency (committed fixtures, database-bounded waits): withdrawal versus
//   a public write, source loss versus a Public QANDEEL write, and a projection
//   rebuild that began BEFORE the disappearance and cannot commit a newly
//   servable stale result after it.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, NONE, SEAM, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, count, actAs, asRole, rejected } = rt;

const ELIGIBILITY = 'public.derive_public_continuing_eligibility_v1(uuid)';
const VISIBILITY = 'public.resolve_public_visibility_state_v1(uuid)';

/**
 * THE VISIBILITY DEPENDENCY CENSUS: every outward Public World surface I-05A and
 * I-05B created. "Complete disappearance" is only a claim if this list is the
 * whole list, so it is stated once and used by the catalog program, by the live
 * darkness assertions and by the forward-safety probes alike.
 */
const PUBLIC_SURFACES = [
  'public.resolve_public_experience_serving_v1(uuid, uuid)',
  'public.resolve_public_experience_semantic_placement_v1(uuid, uuid)',
  'public.resolve_public_discussion_v1(uuid, uuid)',
  'public.resolve_public_qandeel_responses_v1(uuid, uuid)',
  'public.resolve_public_experience_vitality_v1(uuid, uuid)',
  'public.search_public_experiences_v1(uuid, text)',
  'public.resolve_public_lens_v1(uuid, text)',
  'public.resolve_public_panel_v1(uuid, uuid)',
  // I-06C added the Public Replay artifact surface. The census below is an
  // equality against the LIVE catalog precisely so a new outward Public resolver
  // cannot hide from it, and the intended answer to one being added is to put it
  // here - where `verifyPosture` then holds it to every rule the other eight
  // obey: postgres-owned, SECURITY DEFINER, STABLE, search_path-pinned,
  // service_role-only, sealed-provenance-free, disclosure-bounded, and composing
  // the canonical visibility state with the canonical admission gate rather than
  // testing a lifecycle of its own.
  //
  // It is deliberately NOT added to `assertCompletelyDark`: that helper is
  // called with an Experience and a viewer, and this surface is addressed by the
  // opaque audience reference of one distribution package, which only the slice
  // that minted it holds. Its darkness is proven there, by the I-06C scenario
  // X32, against an Experience this verifier's own fixtures never create.
  'public.resolve_public_replay_artifact_v1(text, uuid)',
];
/** Every write path that may only act on a canonically public target. */
const PUBLIC_WRITERS = [
  'public.post_public_discussion_v1(uuid, uuid, uuid, uuid, text)',
  'public.record_public_qandeel_response_v1(uuid, uuid, uuid, uuid, text, uuid[])',
  'public.recompute_public_experience_vitality_v1(uuid)',
  'public.rebuild_public_experience_projection_v1(uuid)',
];

async function verifyCatalog() {
  await rt.verifyPosture({
    internal: [ELIGIBILITY, VISIBILITY],
    reading: [ELIGIBILITY, VISIBILITY],
    resolvers: PUBLIC_SURFACES,
  });

  const eligibility = await rt.functionPosture(ELIGIBILITY);
  // It CONTINUES the frozen publication gates rather than inventing new ones.
  for (const needle of ["current_lifecycle = 'PUBLISHED'", 'public_experience_publication_state',
    'current_experience_version_id = s.published_experience_version_id',
    's.published_manifest_version_id = v.package_manifest_version_id',
    'derive_publication_manifest_effective_approvals_v1', "<> 'EFFECTIVE'",
    'derive_public_publication_authority_v1', 'publication_manifest_required_approvers',
    'WHEN OTHERS THEN']) {
    assert.ok(eligibility.prosrc.includes(needle), `continuing eligibility requires: ${needle}`);
  }
  for (const cls of ['NOT_PUBLISHED', 'PUBLICATION_BINDING_INVALID', 'REQUIRED_APPROVAL_NOT_EFFECTIVE',
    'PUBLISHED_SOURCE_NOT_AVAILABLE', 'PUBLICATION_AUTHORITY_INVALIDATED']) {
    assert.ok(eligibility.prosrc.includes(cls), `the bounded internal ineligibility vocabulary includes ${cls}`);
  }
  // Current Shared membership is never a proxy for source access or for
  // rightsholder authority, and control is never read at all. Neither is ACTOR
  // source access a continuing condition: the frozen I-04F entry point answers
  // "may THIS HUMAN see it", which 0095 gate 6 asks of the publishing human at
  // the instant of publication, and which must not become a perpetual public
  // predicate. Source AVAILABILITY is the ONE I-05A derivation, asserted above.
  for (const forbidden of ['shared_world_membership_episodes', 'shared_world_history_access_grants',
    'shared_world_standard_closed_view_entitlements', 'shared_world_history_package_manifest_items',
    'public_experience_controllers', 'ABSENT_FROM_PUBLIC_WORLD',
    'resolve_shared_world_history_visibility_v1']) {
    assert.ok(!eligibility.prosrc.includes(forbidden),
      `continuing eligibility consumes canonical truth rather than reading ${forbidden}`);
  }
  // No actor of any kind reaches the derivation: not a viewer, not a controller,
  // not the publisher. Continuing eligibility is a property of the EXPERIENCE.
  assert.ok(!eligibility.prosrc.includes('auth.uid()'),
    'continuing eligibility reads no acting human at all');

  const visibility = await rt.functionPosture(VISIBILITY);
  for (const needle of ['derive_public_continuing_eligibility_v1', "eligibility_state = 'ELIGIBLE'",
    'PUBLICLY_VISIBLE', 'NOT_PUBLICLY_VISIBLE']) {
    assert.ok(visibility.prosrc.includes(needle), `the canonical visibility derivation requires: ${needle}`);
  }
  assert.equal((visibility.prosrc.match(/RETURN QUERY/gu) ?? []).length, 2,
    'exactly two answers exist, so every non-serving cause is ONE outward class');
  for (const forbidden of ['ineligibility_class', 'public_audience_policy_state',
    'public_experience_search_projection', 'public_experience_vitality_state']) {
    assert.ok(!visibility.prosrc.includes(forbidden),
      `the canonical visibility derivation must not read or expose ${forbidden}`);
  }
  // The frozen I-05B result shape is unchanged, so every frozen consumer still
  // reads the same five columns, and none of them is private.
  assert.deepEqual(await rt.resultColumns(VISIBILITY),
    ['experience_id', 'visibility_state', 'visible_experience_version_id',
      'visible_manifest_version_id', 'visible_version_ordinal'],
    'the canonical visibility derivation keeps the frozen I-05B result shape');
  for (const fn of [ELIGIBILITY, VISIBILITY]) {
    for (const name of await rt.inputParameters(fn)) {
      assert.doesNotMatch(name, /approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|clear|launch|safety|entitle|allow|effective|eligib|absent|cause|reason|basis|fingerprint/u,
        `${fn} may not accept ${name}`);
    }
  }

  // THE VISIBILITY DEPENDENCY CENSUS. `verifyPosture` already proved every
  // surface consumes the canonical visibility state and the admission gate;
  // this proves the census itself is complete against the live catalog, so a
  // NEW outward Public resolver that bypassed visibility could not hide from it.
  const declared = (await rows(
    `SELECT pr.proname FROM pg_proc pr
       JOIN pg_namespace ns ON ns.oid = pr.pronamespace
      WHERE ns.nspname = 'public' AND pr.proname ~ '^(resolve_public_|search_public_)'
        AND pr.proname NOT IN ('resolve_public_visibility_state_v1', 'resolve_public_audience_admission_v1',
                               'resolve_public_publication_prerequisites_v1', 'resolve_public_experience_review_v1',
                               'resolve_public_package_items_v1', 'resolve_public_experience_disappearance_audit_v1')
      ORDER BY 1`)).map((r) => r.proname);
  assert.deepEqual(declared.sort(),
    PUBLIC_SURFACES.map((s) => s.replace(/^public\./u, '').replace(/\(.*$/u, '')).sort(),
    'every outward Public World surface is in the visibility dependency census');

  // The frozen boundaries PART A consumes are intact, and the CW2-08
  // prerequisite is still fail-closed and unresolved.
  // Continuing eligibility now rests entirely on the ONE I-05A derivation for
  // source truth, so what that derivation binds is asserted rather than assumed.
  const authority = await rt.functionPosture('public.derive_public_publication_authority_v1(uuid)');
  for (const needle of ["availability_state <> 'AVAILABLE'",
    'availability_revision <> p.captured_availability_revision', 'captured_source_digest']) {
    assert.ok(authority.prosrc.includes(needle),
      `the ONE I-05A source truth still binds the exact captured source: ${needle}`);
  }
  assert.ok((await rt.functionPosture(SEAM)).prosrc.includes('NOT_EVALUATED'),
    'the CW2-08 prerequisite seam still answers NOT_EVALUATED');
  const [{ signed_out_viewing_policy: signedOut }] = await rows(`SELECT signed_out_viewing_policy FROM ${T.POLICY} WHERE singleton`);
  assert.equal(signedOut, 'UNRESOLVED', 'the frozen CW2-08 signed-out viewing requirement stays UNRESOLVED');
  for (const [table, trigger] of [[T.APPROVALS, 'publication_manifest_approvals_immutable'],
    [T.WITHDRAWAL_EVENTS, 'publication_approval_withdrawal_events_immutable'],
    [T.PUBLICATION_STATE, 'public_experience_publication_state_immutable'],
    [T.LIFECYCLE, 'public_experience_lifecycle_events_immutable'],
    ['public.conversation_units', 'conversation_units_immutable']]) {
    assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} still guards ${table}`);
  }
}

const eligibilityOf = async (experience) => {
  const [row] = await rt.continuingEligibility(experience);
  assert.ok(row, `continuing eligibility answers for ${experience}`);
  return row;
};

/** A snapshot of everything a disappearance cause must NOT have touched. */
async function packageSnapshot(experience, manifest) {
  const one = async (text, values) => (await rows(text, values))[0];
  return {
    lifecycle: (await one(`SELECT current_lifecycle c FROM ${T.EXPERIENCES} WHERE id = $1`, [experience])).c,
    publication: await one(`SELECT * FROM ${T.PUBLICATION_STATE} WHERE experience_id = $1`, [experience]),
    manifest: await one(`SELECT * FROM ${T.MANIFESTS} WHERE id = $1`, [manifest]),
    items: await rows(`SELECT * FROM ${T.ITEMS} WHERE manifest_version_id = $1 ORDER BY item_ordinal`, [manifest]),
    bodies: await rows(`SELECT b.* FROM ${T.BODIES} b JOIN ${T.ITEMS} it ON it.package_item_id = b.package_item_id
                         WHERE it.manifest_version_id = $1 ORDER BY b.package_item_id`, [manifest]),
    provenance: await rows(`SELECT * FROM ${T.PROVENANCE} WHERE manifest_version_id = $1 ORDER BY package_item_id`, [manifest]),
    approvals: await rows(`SELECT * FROM ${T.APPROVALS} WHERE manifest_version_id = $1 ORDER BY id`, [manifest]),
    required: await rows(`SELECT * FROM ${T.REQUIRED} WHERE manifest_version_id = $1 ORDER BY approver_user_id`, [manifest]),
    transitions: await rows(`SELECT * FROM ${T.LIFECYCLE} WHERE experience_id = $1 ORDER BY occurred_at, id`, [experience]),
    controllers: await rows(`SELECT * FROM ${T.CONTROLLERS} WHERE experience_id = $1 ORDER BY controller_user_id`, [experience]),
  };
}

async function verifyContinuingEligibility(f, seam) {
  // The target: a REAL publication of three items - one Personal unit Mohamed
  // owns and two Shared materials, one of them Hadir's, so a FORMER Shared
  // member is a required rightsholder of a package she can no longer browse.
  const target = await rt.bringToPublished(f, { experience: f.experience, manifest: f.manifest, version: f.version }, seam);
  // An UNRELATED published Experience that shares NO rightsholder with the
  // target and NO Shared source with Hadir, so every collateral claim is real.
  const other = randomUUID();
  const otherPublished = await rt.bringToPublished(f,
    { experience: other, manifest: randomUUID(), version: randomUUID(), personal: false, shared: [f.mohamedMaterial] }, seam);
  const lensKey = 'i05c.closure';
  const searchTerm = 'sentence';
  await actAs(f.mohamed);
  await rt.recordPlacement(randomUUID(), randomUUID(), f.experience, f.version, lensKey, 'the target interpretation');
  await rt.post(randomUUID(), randomUUID(), f.experience, null, 'a public sentence about it');
  await rt.recordResponse(randomUUID(), randomUUID(), f.experience, null, 'a Public QANDEEL response', NONE);
  await rt.recomputeVitality(f.experience);
  await rt.rebuildProjection(f.experience);

  // CE01 a fully eligible publication.
  const eligible = await eligibilityOf(f.experience);
  assert.equal(eligible.eligibility_state, 'ELIGIBLE');
  assert.equal(eligible.ineligibility_class, null, 'CE01 an eligible answer names no cause');
  assert.equal(eligible.eligible_experience_version_id, f.version);
  assert.equal(eligible.eligible_manifest_version_id, f.manifest);
  assert.equal(Number(eligible.eligible_version_ordinal), 1);
  const [visible] = await rt.visibility(f.experience);
  assert.equal(visible.visibility_state, 'PUBLICLY_VISIBLE');
  assert.equal(visible.visible_experience_version_id, f.version);
  assert.equal((await rt.serving(f.experience, f.reader)).length, 3, 'CE01 the bounded derivative is served');
  assert.equal((await rt.resolveDiscussion(f.experience, f.reader)).length, 1);
  assert.equal((await rt.resolveResponses(f.experience, f.reader)).length, 1);
  assert.equal((await rt.resolveVitality(f.experience, f.reader)).length, 1);
  assert.equal((await rt.resolvePlacement(f.experience, f.reader)).length, 1);
  assert.equal((await rt.panel(f.experience, f.reader)).length, 1);
  assert.equal((await rt.search(f.reader, searchTerm)).filter((r) => r.experience_id === f.experience).length, 1);
  assert.equal((await rt.lens(f.reader, lensKey)).filter((r) => r.experience_id === f.experience).length, 1);
  const before = await packageSnapshot(f.experience, f.manifest);

  // CE02 nonexistent, DRAFT and READY_FOR_REVIEW are ONE bounded class.
  const draft = randomUUID();
  await rt.createDraft(randomUUID(), draft);
  const readyExp = randomUUID();
  await rt.bringToReady(f, { experience: readyExp, manifest: randomUUID(), version: randomUUID(), personal: false, shared: [f.mohamedMaterial] });
  const nothing = await eligibilityOf(randomUUID());
  for (const [label, id] of [['nonexistent', nothing.experience_id], ['DRAFT', draft], ['READY_FOR_REVIEW', readyExp]]) {
    const answer = await eligibilityOf(id);
    assert.equal(answer.eligibility_state, 'INELIGIBLE', `CE02 ${label} is ineligible`);
    assert.equal(answer.ineligibility_class, 'NOT_PUBLISHED', `CE02 ${label} is NOT_PUBLISHED`);
    assert.equal(answer.eligible_experience_version_id, null);
    assert.deepEqual({ ...(await rt.visibility(id))[0], experience_id: null },
      { experience_id: null, visibility_state: 'NOT_PUBLICLY_VISIBLE', visible_experience_version_id: null,
        visible_manifest_version_id: null, visible_version_ordinal: null },
      `CE02 ${label} is the same outward answer`);
  }
  await rejected(() => rt.continuingEligibility(null), ['22023']);
  await rejected(() => rt.visibility(null), ['22023']);

  // CE03 A REQUIRED RIGHTSHOLDER WITHDRAWS AFTER PUBLICATION.
  await q('SAVEPOINT withdrawal');
  const hadirApproval = target.approvals.get(f.hadir);
  await actAs(f.hadir);
  const [withdrawn] = await rt.withdraw(randomUUID(), hadirApproval);
  assert.equal(withdrawn.outcome, 'WITHDRAWN');
  const afterWithdrawal = await eligibilityOf(f.experience);
  assert.equal(afterWithdrawal.eligibility_state, 'INELIGIBLE');
  assert.equal(afterWithdrawal.ineligibility_class, 'REQUIRED_APPROVAL_NOT_EFFECTIVE');
  // IMMEDIATELY, through canonical truth alone: no lifecycle moved, no
  // reconciliation ran, no projection was rebuilt, and every surface is dark.
  await rt.assertCompletelyDark(f.experience, f.reader, { lensKey, searchTerm });
  assert.equal((await rows(`SELECT current_lifecycle c FROM ${T.EXPERIENCES} WHERE id = $1`, [f.experience]))[0].c,
    'PUBLISHED', 'CE03 the lifecycle still says PUBLISHED: privacy did not wait for a write');
  assert.equal(await count(T.PROJECTION, 'experience_id = $1', [f.experience]), 1,
    'CE03 the stale projection row is still there and still cannot serve');
  // Nothing was mutated, and no unrelated Experience moved.
  assert.deepEqual(await packageSnapshot(f.experience, f.manifest), before,
    'CE03 no version, package, body, provenance, approval, control, publication or transition row changed');
  assert.equal((await rt.visibility(other))[0].visibility_state, 'PUBLICLY_VISIBLE',
    'CE03 an unrelated Experience is untouched');
  assert.equal((await rt.serving(other, f.reader)).length, 1);
  // Withdrawing restores no Shared browsing and grants no Experience control.
  assert.equal(Number((await rows(
    'SELECT count(*) n FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL',
    [f.world, f.hadir]))[0].n), 0, 'CE03 the former member regained no membership');
  assert.deepEqual(await rows('SELECT history_item_id FROM public.resolve_shared_world_history_visibility_v1($1, $2)', [f.world, f.hadir]), [],
    'CE03 and no Shared browsing');
  assert.deepEqual((await rows(`SELECT controller_user_id FROM ${T.CONTROLLERS} WHERE experience_id = $1`, [f.experience])).map((r) => r.controller_user_id),
    [f.mohamed], 'CE03 and no Experience control');
  // A controller who is not the rightsholder can neither fabricate nor cancel
  // the withdrawal, and cannot make the publication reappear.
  await actAs(f.mohamed);
  await rejected(() => rt.withdraw(randomUUID(), target.approvals.get(f.hadir)), ['P0002'], /PUBLIC_EXPERIENCE_NOT_AVAILABLE/u);
  await asRole('postgres');
  await rejected(() => q(`DELETE FROM ${T.WITHDRAWAL_EVENTS} WHERE approval_id = $1`, [hadirApproval]), ['55000']);
  await rejected(() => q(`UPDATE ${T.WITHDRAWAL_EVENTS} SET occurred_at = occurred_at WHERE approval_id = $1`, [hadirApproval]), ['55000']);
  await actAs(f.mohamed);
  // CE12 every public write path refuses at execution time, under its own lock.
  await rejected(() => rt.post(randomUUID(), randomUUID(), f.experience, null, 'a post after the withdrawal'),
    ['P0002'], /PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE/u);
  await rejected(() => rt.recordResponse(randomUUID(), randomUUID(), f.experience, null, 'a response after it', NONE),
    ['P0002'], /PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE/u);
  assert.equal((await rt.recomputeVitality(f.experience))[0].outcome, 'NOT_PUBLICLY_VISIBLE',
    'CE12 a vitality recompute writes nothing');
  assert.equal((await rt.rebuildProjection(f.experience))[0].outcome, 'PROJECTION_CLEARED',
    'CE12 and a rebuild clears the projection rather than recreating it');
  assert.equal(await count(T.PROJECTION, 'experience_id = $1', [f.experience]), 0);
  await rt.assertCompletelyDark(f.experience, f.reader, { lensKey, searchTerm });
  // CE09 no automatic reappearance: no frozen path returns it to public, and no
  // successor package can be prepared for a published Experience.
  await rejected(() => rt.publish(randomUUID(), f.experience, f.version), ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);
  await rejected(() => rt.prepare(randomUUID(), f.experience, randomUUID(), randomUUID(), NONE, NONE,
    [randomUUID()], [f.world], [f.mohamedMaterial]), ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);
  await rejected(() => rt.commitReady(randomUUID(), f.experience, f.version), ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);
  // A semantic correction is still a CONTROLLER act on a PUBLISHED Experience -
  // the frozen 0096 semantics - and it reaches no public surface, so it is a
  // sealed correction rather than a public one.
  const sealedPlacement = randomUUID();
  const [corrected] = await rt.recordPlacement(randomUUID(), sealedPlacement, f.experience, f.version, lensKey, 'a sealed correction');
  assert.equal(corrected.outcome, 'PLACEMENT_CORRECTED');
  assert.deepEqual(await rt.resolvePlacement(f.experience, f.reader), [], 'CE12 and it is not publicly served');
  await q('ROLLBACK TO SAVEPOINT withdrawal'); await q('RELEASE SAVEPOINT withdrawal');
  assert.equal((await eligibilityOf(f.experience)).eligibility_state, 'ELIGIBLE', 'CE03 the rollback restored the fixture');

  // CE04 a required approval lost from the immutable evidence. READY and
  // publication both required it, so the only way to reach this is evidence
  // loss - simulated by the owner with the guard lifted inside a savepoint.
  await q('SAVEPOINT missing');
  await asRole('postgres');
  await q(`ALTER TABLE ${T.APPROVALS} DISABLE TRIGGER publication_manifest_approvals_immutable`);
  await q(`DELETE FROM ${T.APPROVALS} WHERE id = $1`, [hadirApproval]);
  await q(`ALTER TABLE ${T.APPROVALS} ENABLE TRIGGER publication_manifest_approvals_immutable`);
  assert.deepEqual((await rt.deriveManifestApprovals(f.manifest)).map((r) => r.effective_state).sort(), ['EFFECTIVE', 'MISSING']);
  assert.equal((await eligibilityOf(f.experience)).ineligibility_class, 'REQUIRED_APPROVAL_NOT_EFFECTIVE');
  await rt.assertCompletelyDark(f.experience, f.reader, { lensKey, searchTerm });
  await q('ROLLBACK TO SAVEPOINT missing'); await q('RELEASE SAVEPOINT missing');

  // CE05 THE FROZEN I-04G OWNER DELETION OF AN INCLUDED SHARED SOURCE.
  await q('SAVEPOINT deletion');
  await actAs(f.hadir);
  await rt.deleteMaterial(randomUUID(), f.world, f.hadirMaterial, randomUUID());
  await actAs(f.mohamed);
  assert.equal((await eligibilityOf(f.experience)).ineligibility_class, 'PUBLISHED_SOURCE_NOT_AVAILABLE');
  await rt.assertCompletelyDark(f.experience, f.reader, { lensKey, searchTerm });
  // CE09 THE EXACT PACKAGE RULE: the immutable manifest is never shrunk and
  // never re-served as a smaller package under the old publication identity.
  const afterDeletion = await packageSnapshot(f.experience, f.manifest);
  assert.deepEqual(afterDeletion, before, 'CE09 the immutable package is untouched: it fails closed, it does not shrink');
  assert.equal(Number(afterDeletion.manifest.item_count), 3);
  assert.equal(afterDeletion.provenance.length, 3);
  // And the unrelated Experience, whose sources are all still available, is
  // untouched by another Experience's source loss.
  assert.equal((await rt.visibility(other))[0].visibility_state, 'PUBLICLY_VISIBLE', 'CE05 no collateral disappearance');
  await q('ROLLBACK TO SAVEPOINT deletion'); await q('RELEASE SAVEPOINT deletion');

  // CE06 THE PUBLISHER LOSES SHARED BROWSING, AND THE PUBLICATION DOES NOT CARE.
  // Ending Mohamed's episode is what a leave or a removal does, and the canonical
  // I-04F resolver then shows him nothing at all. That is actor source ACCESS:
  // the frozen 0095 gate 6 asks it of the PUBLISHING HUMAN at the consequential
  // instant of publication, and nothing in 0091-0097 re-asks it afterwards.
  // Re-asking it forever would let one human's later browsing status decide
  // everyone else's Public view. The exact source is untouched - still
  // AVAILABLE, still at the captured revision, still the captured bytes - so the
  // published package stays eligible and stays served.
  await q('SAVEPOINT hidden');
  await asRole('postgres');
  await q(`UPDATE public.shared_world_membership_episodes SET ended_at = now()
            WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL`, [f.world, f.mohamed]);
  await actAs(f.mohamed);
  assert.deepEqual(await rows('SELECT history_item_id FROM public.resolve_shared_world_history_visibility_v1($1, $2)', [f.world, f.mohamed]), [],
    'CE06 fixture: the canonical I-04F resolver shows the former member nothing');
  assert.equal((await eligibilityOf(f.experience)).eligibility_state, 'ELIGIBLE',
    'CE06 lost actor source ACCESS is not lost source AVAILABILITY, and does not end the publication');
  assert.equal((await rt.visibility(f.experience))[0].visibility_state, 'PUBLICLY_VISIBLE',
    'CE06 the published Experience is still canonically visible');
  assert.equal((await rt.serving(f.experience, f.reader)).length, 3,
    'CE06 and every Public viewer is still served the whole bounded derivative');
  // AND THE SAME FIXTURE, IN THE SAME LOST-BROWSING STATE, DOES GO DARK the
  // moment an included source actually becomes unavailable. The owner deletes
  // it; the only difference between these two assertions is availability, which
  // is the entire distinction this gate exists to make. Without this half, an
  // ELIGIBLE answer above could not be told apart from a broken fixture.
  await actAs(f.hadir);
  await rt.deleteMaterial(randomUUID(), f.world, f.hadirMaterial, randomUUID());
  await actAs(f.mohamed);
  assert.equal((await eligibilityOf(f.experience)).ineligibility_class, 'PUBLISHED_SOURCE_NOT_AVAILABLE',
    'CE06 availability, unlike actor access, IS a continuing condition');
  await rt.assertCompletelyDark(f.experience, f.reader, { lensKey, searchTerm });
  // CE10 and the unavailable source leaks no distinct outward answer.
  assert.deepEqual(await rt.serving(f.experience, f.reader), await rt.serving(randomUUID(), f.reader),
    'CE10 an unavailable Shared source is indistinguishable from an Experience that does not exist');
  await q('ROLLBACK TO SAVEPOINT hidden'); await q('RELEASE SAVEPOINT hidden');

  // CE07 THE DERIVED CONTENT RIGHTSHOLDER SET DRIFTS. A new human material
  // authority on an included Shared history item grows the derived union; the
  // stored set no longer equals it, so the published authority no longer derives.
  await q('SAVEPOINT authority');
  await asRole('postgres');
  await q(`INSERT INTO public.shared_world_history_item_required_approvers (history_item_id, approver_user_id)
           SELECT sm.history_item_id, $2 FROM public.shared_world_materials sm WHERE sm.id = $1`, [f.mohamedMaterial, f.stranger]);
  assert.equal((await eligibilityOf(f.experience)).ineligibility_class, 'PUBLICATION_AUTHORITY_INVALIDATED');
  await rt.assertCompletelyDark(f.experience, f.reader, { lensKey, searchTerm });
  await q('ROLLBACK TO SAVEPOINT authority'); await q('RELEASE SAVEPOINT authority');

  // CE08 THE PERSONAL SOURCE CLASS IS CONSUMED TOO. It cannot become
  // unavailable through any canonical path - the frozen 0064 committed unit is
  // append-only for every role INCLUDING the owner, which is proven first - so
  // the branch is exercised by lifting that guard inside a savepoint. The
  // eligibility derivation consumes the ONE I-05A authority derivation, which
  // binds the exact committed bytes, so a Personal source that is no longer the
  // source the package snapshotted fails the publication closed.
  await asRole('postgres');
  await rejected(() => q('DELETE FROM public.conversation_units WHERE id = $1', [f.userUnit]), ['55000']);
  await rejected(() => q('UPDATE public.conversation_units SET committed_text = $2 WHERE id = $1', [f.userUnit, 'rewritten']), ['55000']);
  await q('SAVEPOINT personal');
  await q('ALTER TABLE public.conversation_units DISABLE TRIGGER conversation_units_immutable');
  // The frozen 0064 unit pins length(committed_text) = source_span_end -
  // source_span_start, so the probe changes the BYTES and not the length: the
  // question is whether the package's captured digest still matches the source,
  // not whether a malformed unit is representable.
  await q('UPDATE public.conversation_units SET committed_text = $2 WHERE id = $1',
    [f.userUnit, `${f.userText.slice(0, -1)}!`]);
  await q('ALTER TABLE public.conversation_units ENABLE TRIGGER conversation_units_immutable');
  assert.equal((await eligibilityOf(f.experience)).ineligibility_class, 'PUBLISHED_SOURCE_NOT_AVAILABLE');
  await rt.assertCompletelyDark(f.experience, f.reader, { lensKey, searchTerm });
  await q('ROLLBACK TO SAVEPOINT personal'); await q('RELEASE SAVEPOINT personal');
  assert.equal(await rt.triggerEnabled('public.conversation_units', 'conversation_units_immutable'), true,
    'CE08 the frozen Personal guard is enabled again');

  // CE10 EVERY NON-SERVING CAUSE IS ONE OUTWARD ANSWER, and the internal cause
  // is unreachable by every application role.
  await actAs(f.mohamed);
  assert.deepEqual(await rt.serving(f.experience, null), [], 'CE10 a signed-out viewer is not admitted');
  assert.deepEqual(await rt.serving(f.experience, randomUUID()), [], 'CE10 an unknown viewer is not admitted');
  for (const role of APP_ROLES) {
    await q('SAVEPOINT role');
    await asRole(role, f.reader);
    await rejected(() => rt.continuingEligibility(f.experience), ['42501']);
    await rejected(() => rt.visibility(f.experience), ['42501']);
    if (role === 'service_role') {
      assert.equal((await rt.serving(f.experience, f.reader)).length, 3, 'service_role still executes the ONE serving resolver');
    } else {
      await rejected(() => rt.serving(f.experience, f.reader), ['42501']);
    }
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT role'); await q('RELEASE SAVEPOINT role');
  }

  // CE11 A PLANTED VITALITY ROW AND A STALE PROJECTION CANNOT OUTVOTE the
  // canonical truth: both describe the exact version that WAS visible, and
  // neither serves once the Experience is ineligible.
  await q('SAVEPOINT stale');
  await asRole('postgres');
  assert.equal(await count(T.PROJECTION, `experience_id = $1 AND experience_version_id = $2`, [f.experience, f.version]), 1);
  assert.equal(await count(T.VITALITY, `experience_id = $1 AND experience_version_id = $2`, [f.experience, f.version]), 1);
  await actAs(f.hadir);
  await rt.withdraw(randomUUID(), hadirApproval);
  await actAs(f.mohamed);
  assert.equal(await count(T.PROJECTION, 'experience_id = $1', [f.experience]), 1, 'CE11 the projection row still exists');
  assert.equal(await count(T.VITALITY, 'experience_id = $1', [f.experience]), 1, 'CE11 and so does the vitality row');
  await rt.assertCompletelyDark(f.experience, f.reader, { lensKey, searchTerm });
  await q('ROLLBACK TO SAVEPOINT stale'); await q('RELEASE SAVEPOINT stale');

  return { target, other, otherPublished, draft, readyExp, lensKey, searchTerm, hadirApproval, before };
}

async function verifyForwardSafety(f, state) {
  const refuses = { name: 'AssertionError' };
  await q('SAVEPOINT forward_safety');
  try {
    await asRole('postgres');
    // A LEGITIMATE ADDITIVE FUTURE SLICE still passes: a new relation beside
    // the Public runtime, a new internal function, a new column, a new index and
    // a later reviewed Launch Gate table.
    await q(`CREATE TABLE public.i05c98_probe_later_state (
               experience_id uuid PRIMARY KEY REFERENCES ${T.EXPERIENCES} (id), noted_at timestamptz NOT NULL)`);
    await q(`CREATE FUNCTION public.i05c98_probe_note_v1(p_experience_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN INSERT INTO public.i05c98_probe_later_state (experience_id, noted_at)
                   VALUES (p_experience_id, clock_timestamp()) ON CONFLICT DO NOTHING; END$fn$`);
    await q('CREATE TABLE public.i05c98_probe_launch_gate (id uuid PRIMARY KEY, capability text NOT NULL)');
    await q(`ALTER TABLE ${T.PROJECTION} ADD COLUMN i05c98_probe_note text`);
    await q(`CREATE INDEX i05c98_probe_idx ON ${T.VITALITY} (computed_at)`);
    await verifyCatalog();

    // P1 BYPASS CANONICAL VISIBILITY IN ONE PUBLIC RESOLVER.
    await q('SAVEPOINT p1');
    await q(`CREATE OR REPLACE FUNCTION public.resolve_public_discussion_v1(p_experience_id uuid, p_viewer_user_id uuid)
             RETURNS TABLE(post_id uuid, experience_id uuid, target_experience_version_id uuid, parent_post_id uuid,
                           post_ordinal bigint, author_public_identity_ref uuid, author_label_mode text,
                           author_display_label text, post_body text, posted_at timestamptz)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
             BEGIN
               RETURN QUERY SELECT dp.id, dp.experience_id, dp.target_experience_version_id, dp.parent_post_id,
                                   dp.post_ordinal, dp.author_public_identity_ref, d.label_mode, d.display_label,
                                   dp.post_body, dp.posted_at
                 FROM public.public_discussion_posts dp
                 JOIN public.public_identity_display_state d ON d.public_identity_ref = dp.author_public_identity_ref
                WHERE dp.experience_id = p_experience_id ORDER BY dp.post_ordinal;
             END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'P1 a Public resolver that bypasses canonical visibility is a regression');
    await actAs(f.hadir);
    await rt.withdraw(randomUUID(), state.hadirApproval);
    await actAs(f.mohamed);
    assert.equal((await rt.resolveDiscussion(f.experience, f.reader)).length, 1,
      'P1 anti-vacuity: the mutant really serves the discussion of an ineligible Experience');
    await q('ROLLBACK TO SAVEPOINT p1'); await q('RELEASE SAVEPOINT p1');

    // P2 MAKE PROJECTION EXISTENCE IMPLY VISIBILITY.
    await q('SAVEPOINT p2');
    await q(`CREATE OR REPLACE FUNCTION public.search_public_experiences_v1(p_viewer_user_id uuid, p_query text)
             RETURNS TABLE(experience_id uuid, experience_version_id uuid, lens_key text, semantic_label text,
                           publisher_public_identity_ref uuid, publisher_label_mode text, publisher_display_label text,
                           published_at timestamptz, search_rank real)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
             DECLARE query_lexemes tsquery;
             BEGIN
               query_lexemes := plainto_tsquery('pg_catalog.simple', p_query);
               RETURN QUERY
               SELECT pr.experience_id, pr.experience_version_id, pr.lens_key, pr.semantic_label,
                      m.publisher_public_identity_ref, d.label_mode, d.display_label, s.published_at,
                      ts_rank(pr.search_document, query_lexemes)
                 FROM public.public_experience_search_projection pr
                 JOIN public.public_experience_publication_state s ON s.experience_id = pr.experience_id
                 JOIN public.public_experience_versions v ON v.id = pr.experience_version_id
                 JOIN public.publication_package_manifest_versions m ON m.id = v.package_manifest_version_id
                 JOIN public.public_identity_display_state d ON d.public_identity_ref = m.publisher_public_identity_ref
                WHERE pr.search_document @@ query_lexemes;
             END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'P2 a projection that implies visibility is a regression');
    await actAs(f.hadir);
    await rt.withdraw(randomUUID(), state.hadirApproval);
    await actAs(f.mohamed);
    assert.equal((await rt.search(f.reader, state.searchTerm)).filter((r) => r.experience_id === f.experience).length, 1,
      'P2 anti-vacuity: the mutant really serves the stale projection of an ineligible Experience');
    await q('ROLLBACK TO SAVEPOINT p2'); await q('RELEASE SAVEPOINT p2');

    // P3 REPLACE EXACT SOURCE TRUTH WITH SHARED MEMBERSHIP.
    await q('SAVEPOINT p3');
    await q(`CREATE OR REPLACE FUNCTION public.derive_public_continuing_eligibility_v1(p_experience_id uuid)
             RETURNS TABLE(experience_id uuid, eligibility_state text, ineligibility_class text,
                           eligible_experience_version_id uuid, eligible_manifest_version_id uuid,
                           eligible_version_ordinal integer)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
             BEGIN
               RETURN QUERY
               SELECT e.id, 'ELIGIBLE'::text, NULL::text, s.published_experience_version_id,
                      s.published_manifest_version_id, v.version_ordinal
                 FROM public.public_experiences e
                 JOIN public.public_experience_publication_state s ON s.experience_id = e.id
                 JOIN public.public_experience_versions v ON v.id = s.published_experience_version_id
                WHERE e.id = p_experience_id AND e.current_lifecycle = 'PUBLISHED'
                  AND EXISTS (SELECT 1 FROM public.shared_world_membership_episodes ep
                               WHERE ep.ended_at IS NULL);
             END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'P3 membership in place of exact source truth is a regression');
    await actAs(f.hadir);
    await rt.deleteMaterial(randomUUID(), f.world, f.hadirMaterial, randomUUID());
    await actAs(f.mohamed);
    assert.equal((await rt.visibility(f.experience))[0].visibility_state, 'PUBLICLY_VISIBLE',
      'P3 anti-vacuity: the mutant really keeps a deleted source publicly visible');
    await q('ROLLBACK TO SAVEPOINT p3'); await q('RELEASE SAVEPOINT p3');

    // P4 OMIT THE EFFECTIVE-APPROVAL CHECK FROM CONTINUING ELIGIBILITY.
    await q('SAVEPOINT p4');
    // The source gate is KEPT and only the effective-approval gate is dropped,
    // so the probe is precisely the weakening §21 names and not a broader one.
    await q(`CREATE OR REPLACE FUNCTION public.derive_public_continuing_eligibility_v1(p_experience_id uuid)
             RETURNS TABLE(experience_id uuid, eligibility_state text, ineligibility_class text,
                           eligible_experience_version_id uuid, eligible_manifest_version_id uuid,
                           eligible_version_ordinal integer)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
             DECLARE fv uuid; fm uuid; fo integer;
             BEGIN
               SELECT s.published_experience_version_id, s.published_manifest_version_id, v.version_ordinal
                 INTO fv, fm, fo
                 FROM public.public_experiences e
                 JOIN public.public_experience_publication_state s ON s.experience_id = e.id
                 JOIN public.public_experience_versions v
                   ON v.id = s.published_experience_version_id AND v.experience_id = e.id
                WHERE e.id = p_experience_id AND e.current_lifecycle = 'PUBLISHED'
                  AND e.current_experience_version_id = s.published_experience_version_id
                  AND s.published_manifest_version_id = v.package_manifest_version_id;
               IF NOT FOUND THEN
                 RETURN QUERY SELECT p_experience_id, 'INELIGIBLE'::text, 'NOT_PUBLISHED'::text,
                   NULL::uuid, NULL::uuid, NULL::integer;
                 RETURN;
               END IF;
               BEGIN
                 PERFORM 1 FROM public.derive_public_publication_authority_v1(fm);
               EXCEPTION WHEN OTHERS THEN
                 RETURN QUERY SELECT p_experience_id, 'INELIGIBLE'::text, 'PUBLISHED_SOURCE_NOT_AVAILABLE'::text,
                   NULL::uuid, NULL::uuid, NULL::integer;
                 RETURN;
               END;
               RETURN QUERY SELECT p_experience_id, 'ELIGIBLE'::text, NULL::text, fv, fm, fo;
             END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'P4 continuing eligibility without the effective-approval gate is a regression');
    await actAs(f.hadir);
    await rt.withdraw(randomUUID(), state.hadirApproval);
    await actAs(f.mohamed);
    assert.equal((await rt.visibility(f.experience))[0].visibility_state, 'PUBLICLY_VISIBLE',
      'P4 anti-vacuity: the mutant really keeps a withdrawn publication publicly visible');
    await q('ROLLBACK TO SAVEPOINT p4'); await q('RELEASE SAVEPOINT p4');

    // P5 THE CANONICAL VISIBILITY DERIVATION STOPS CONSUMING CONTINUING
    // ELIGIBILITY and goes back to raw lifecycle plus the publication record.
    await q('SAVEPOINT p5');
    await q(`CREATE OR REPLACE FUNCTION public.resolve_public_visibility_state_v1(p_experience_id uuid)
             RETURNS TABLE(experience_id uuid, visibility_state text, visible_experience_version_id uuid,
                           visible_manifest_version_id uuid, visible_version_ordinal integer)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
             DECLARE fv uuid; fm uuid; fo integer;
             BEGIN
               SELECT s.published_experience_version_id, s.published_manifest_version_id, v.version_ordinal
                 INTO fv, fm, fo
                 FROM public.public_experiences e
                 JOIN public.public_experience_publication_state s ON s.experience_id = e.id
                 JOIN public.public_experience_versions v ON v.id = s.published_experience_version_id
                  AND v.experience_id = e.id
                WHERE e.id = p_experience_id AND e.current_lifecycle = 'PUBLISHED'
                  AND e.current_experience_version_id = s.published_experience_version_id;
               IF FOUND THEN
                 RETURN QUERY SELECT p_experience_id, 'PUBLICLY_VISIBLE'::text, fv, fm, fo;
               ELSE
                 RETURN QUERY SELECT p_experience_id, 'NOT_PUBLICLY_VISIBLE'::text, NULL::uuid, NULL::uuid, NULL::integer;
               END IF;
             END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'P5 a visibility truth that ignores continuing eligibility is a regression');
    await actAs(f.hadir);
    await rt.withdraw(randomUUID(), state.hadirApproval);
    await actAs(f.mohamed);
    assert.equal((await rt.visibility(f.experience))[0].visibility_state, 'PUBLICLY_VISIBLE',
      'P5 anti-vacuity: the mutant really restores the pre-I-05C behaviour');
    await q('ROLLBACK TO SAVEPOINT p5'); await q('RELEASE SAVEPOINT p5');

    // P6 THE INTERNAL INELIGIBILITY CAUSE BECOMES AN OUTWARD ANSWER.
    await q('SAVEPOINT p6');
    await q(`CREATE OR REPLACE FUNCTION public.resolve_public_visibility_state_v1(p_experience_id uuid)
             RETURNS TABLE(experience_id uuid, visibility_state text, visible_experience_version_id uuid,
                           visible_manifest_version_id uuid, visible_version_ordinal integer)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
             BEGIN
               RETURN QUERY
               SELECT ce.experience_id,
                      CASE WHEN ce.eligibility_state = 'ELIGIBLE' THEN 'PUBLICLY_VISIBLE'
                           ELSE ce.ineligibility_class END::text,
                      ce.eligible_experience_version_id, ce.eligible_manifest_version_id, ce.eligible_version_ordinal
                 FROM public.derive_public_continuing_eligibility_v1(p_experience_id) ce;
             END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'P6 exposing the internal ineligibility cause is a regression');
    assert.equal((await rt.visibility(state.draft))[0].visibility_state, 'NOT_PUBLISHED',
      'P6 anti-vacuity: the mutant really leaks a distinguishable private cause');
    await q('ROLLBACK TO SAVEPOINT p6'); await q('RELEASE SAVEPOINT p6');

    // P7 THE ELIGIBILITY DERIVATION BECOMES REACHABLE BY AN APPLICATION ROLE,
    // which would make the private cause readable by the service tier.
    await q('SAVEPOINT p7');
    await q(`GRANT EXECUTE ON FUNCTION ${ELIGIBILITY} TO service_role`);
    await assert.rejects(verifyCatalog(), refuses, 'P7 the internal cause becoming application-reachable is a regression');
    await q('ROLLBACK TO SAVEPOINT p7'); await q('RELEASE SAVEPOINT p7');

    // P8 A PUBLIC SURFACE OPENS TO anon.
    await q('SAVEPOINT p8');
    await q(`GRANT EXECUTE ON FUNCTION ${PUBLIC_SURFACES[0]} TO anon`);
    await assert.rejects(verifyCatalog(), refuses, 'P8 widening anonymous Public serving is a regression');
    await q('ROLLBACK TO SAVEPOINT p8'); await q('RELEASE SAVEPOINT p8');

    // P9 THE LAUNCH PREREQUISITE BECOMES PERMISSIVE WITHOUT A CANONICAL GATE.
    await q('SAVEPOINT p9');
    await rt.clearPrerequisites();
    await assert.rejects(verifyCatalog(), refuses, 'P9 a seam that answers CLEARED without a canonical gate is a regression');
    await q('ROLLBACK TO SAVEPOINT p9'); await q('RELEASE SAVEPOINT p9');

    // P10 A NEW OUTWARD PUBLIC SURFACE APPEARS OUTSIDE THE CENSUS, so a later
    // slice could serve a target the disappearance never reached.
    await q('SAVEPOINT p10');
    await q(`CREATE FUNCTION public.resolve_public_experience_headline_v1(p_experience_id uuid, p_viewer_user_id uuid)
             RETURNS TABLE(experience_id uuid, semantic_label text)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
             BEGIN
               RETURN QUERY SELECT pr.experience_id, pr.semantic_label
                 FROM public.public_experience_search_projection pr WHERE pr.experience_id = p_experience_id;
             END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'P10 an outward Public surface outside the visibility census is a regression');
    await q('ROLLBACK TO SAVEPOINT p10'); await q('RELEASE SAVEPOINT p10');

    // P11 ACTOR SOURCE ACCESS RETURNS AS A CONTINUING CONDITION. This is the
    // plausible future mistake: the frozen 0095 gate 6 reads like a source check,
    // so a later slice re-asks it of the immutable publisher forever. It is not a
    // source check - it answers "may THIS HUMAN see it" - and it would make one
    // human's later loss of Shared browsing delete everyone else's Public view.
    await q('SAVEPOINT p11');
    await q(`CREATE OR REPLACE FUNCTION public.derive_public_continuing_eligibility_v1(p_experience_id uuid)
             RETURNS TABLE(experience_id uuid, eligibility_state text, ineligibility_class text,
                           eligible_experience_version_id uuid, eligible_manifest_version_id uuid,
                           eligible_version_ordinal integer)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
             BEGIN
               RETURN QUERY
               SELECT e.id, 'ELIGIBLE'::text, NULL::text, s.published_experience_version_id,
                      s.published_manifest_version_id, v.version_ordinal
                 FROM public.public_experiences e
                 JOIN public.public_experience_publication_state s ON s.experience_id = e.id
                 JOIN public.public_experience_versions v ON v.id = s.published_experience_version_id
                 JOIN public.publication_package_manifest_versions m ON m.id = v.package_manifest_version_id
                WHERE e.id = p_experience_id AND e.current_lifecycle = 'PUBLISHED'
                  AND NOT EXISTS (
                    SELECT 1 FROM public.publication_package_item_provenance p
                     WHERE p.manifest_version_id = m.id AND p.source_class = 'SHARED_WORLD'
                       AND NOT EXISTS (
                         SELECT 1 FROM public.resolve_shared_world_history_visibility_v1(
                                        p.shared_world_id, m.publisher_user_id) vis
                          WHERE vis.history_item_id = p.shared_history_item_id));
             END$fn$`);
    await assert.rejects(verifyCatalog(), refuses,
      'P11 re-asking actor source ACCESS as a continuing public condition is a regression');
    await asRole('postgres');
    await q(`UPDATE public.shared_world_membership_episodes SET ended_at = now()
              WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL`, [f.world, f.mohamed]);
    await actAs(f.mohamed);
    assert.equal((await rt.visibility(f.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE',
      'P11 anti-vacuity: the mutant really hides an Experience whose every source is still fully available');
    await q('ROLLBACK TO SAVEPOINT p11'); await q('RELEASE SAVEPOINT p11');
  } finally {
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
  }
}

async function verifyConcurrency(c, seam) {
  const { q2, actAs2, close } = await rt.openSecondary();
  try {
    await asRole('postgres');
    const exA = await rt.bringToPublished(c, { experience: c.experience, manifest: randomUUID(), version: randomUUID(), personal: false }, seam);
    const exB = await rt.bringToPublished(c, { experience: c.experiences[1], manifest: randomUUID(), version: randomUUID(), personal: false }, seam);
    const exC = await rt.bringToPublished(c, { experience: c.experiences[2], manifest: randomUUID(), version: randomUUID(), personal: false }, seam);
    await asRole('postgres');
    await actAs(c.mohamed);
    await rt.recordPlacement(randomUUID(), randomUUID(), exC.experience, exC.version, 'i05c.race', 'the racing interpretation');
    await rt.rebuildProjection(exC.experience);
    await asRole('postgres');

    // R01 WITHDRAWAL VERSUS A PUBLIC WRITE. The withdrawal holds the Experience
    // FOR UPDATE; the post blocks on it; the withdrawal wins and the post is
    // refused rather than landing on a target that is no longer public.
    console.log('0098 concurrency R01 start');
    await q('BEGIN');
    await actAs(c.hadir);
    await q('SELECT * FROM public.withdraw_publication_approval_v1($1, $2)', [randomUUID(), exA.approvals.get(c.hadir)]);
    await q2('BEGIN');
    await actAs2(c.mohamed);
    const posting = q2('SELECT * FROM public.post_public_discussion_v1($1, $2, $3, $4, $5)',
      [randomUUID(), randomUUID(), exA.experience, null, 'a post racing the withdrawal']);
    assert.equal(await rt.stillPending(posting), true, 'R01 the post blocks on the Experience the withdrawal holds');
    await q('COMMIT');
    await assert.rejects(posting, (error) => error.code === 'P0002' && /PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE/u.test(error.message),
      'R01 the withdrawal won, so the public write refuses');
    await q2('ROLLBACK');
    assert.equal(await count(T.POSTS, 'experience_id = $1', [exA.experience]), 0, 'R01 nothing partial');
    console.log('0098 concurrency R01 pass');

    // R02 SOURCE LOSS VERSUS A PUBLIC QANDEEL WRITE, in BOTH orderings.
    //
    // The frozen 0096 writer takes the Experience row FOR UPDATE and no Shared
    // lock - it consumes no source - while the frozen I-04G owner deletion
    // takes the Shared World row. They do not contend, and they must not: what
    // matters is that no stale row is ever SERVED. So the first ordering proves
    // the honest outcome rather than a blocked one - a write that committed
    // before the deletion did lands internally and is served to nobody - and
    // the second proves that once the deletion is committed the write refuses.
    console.log('0098 concurrency R02 start');
    await q2('BEGIN');
    await actAs2(c.hadir);
    await q2('SELECT * FROM public.delete_shared_world_owned_material_v1($1, $2, $3, $4)',
      [randomUUID(), c.world, c.hadirMaterial, randomUUID()]);
    const raceResponse = randomUUID();
    await q('BEGIN');
    await actAs(c.mohamed);
    const [wrote] = await rt.recordResponse(randomUUID(), raceResponse, exB.experience, null, 'a response racing the loss', NONE);
    assert.equal(wrote.outcome, 'RESPONSE_RECORDED', 'R02 the write saw the source still committed-available');
    await q('COMMIT');
    await q2('COMMIT');
    await asRole('postgres');
    assert.equal(await count(T.RESPONSES, 'id = $1', [raceResponse]), 1, 'R02 the row landed internally');
    assert.equal((await rt.visibility(exB.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE',
      'R02 the source loss turned the exact publication dark');
    assert.deepEqual(await rt.resolveResponses(exB.experience, c.reader), [],
      'R02 and the row that raced it is served to nobody');
    await rt.assertCompletelyDark(exB.experience, c.reader, { lensKey: 'i05c.race', searchTerm: 'sentence' });
    // The second ordering: the deletion is committed first, so the write
    // refuses. `rejected` rolls back to a savepoint, so it needs a transaction.
    await actAs(c.mohamed);
    await q('BEGIN');
    try {
      await rejected(() => rt.recordResponse(randomUUID(), randomUUID(), exB.experience, null, 'a response after the loss', NONE),
        ['P0002'], /PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE/u);
      await rejected(() => rt.post(randomUUID(), randomUUID(), exB.experience, null, 'a post after the loss'),
        ['P0002'], /PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE/u);
    } finally { await q('ROLLBACK'); }
    await asRole('postgres');
    // Exactly the publications that included the deleted source went dark.
    assert.equal((await rt.visibility(exA.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE');
    assert.equal((await rt.visibility(exC.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE');
    console.log('0098 concurrency R02 pass');

    // R03 A PROJECTION REBUILD THAT BEGAN BEFORE THE DISAPPEARANCE cannot
    // commit a newly servable stale result after it. The rebuild holds the
    // Experience FOR SHARE and writes a projection of the still-visible version;
    // a withdrawal blocks on the same row FOR UPDATE; after both commit the
    // projection row exists and describes the version that WAS visible, and no
    // read path serves it.
    console.log('0098 concurrency R03 start');
    const exD = await rt.bringToPublished(c, { experience: c.experiences[3], manifest: randomUUID(), version: randomUUID(),
      personal: false, shared: [c.mohamedMaterial] }, seam);
    await asRole('postgres');
    await actAs(c.mohamed);
    await rt.recordPlacement(randomUUID(), randomUUID(), exD.experience, exD.version, 'i05c.race', 'the stale interpretation');
    await q('BEGIN');
    const [rebuilt] = await rt.rebuildProjection(exD.experience);
    assert.equal(rebuilt.outcome, 'PROJECTION_REBUILT');
    await q2('BEGIN');
    await actAs2(c.mohamed);
    const withdrawing = q2('SELECT * FROM public.withdraw_publication_approval_v1($1, $2)',
      [randomUUID(), exD.approvals.get(c.mohamed)]);
    assert.equal(await rt.stillPending(withdrawing), true, 'R03 the withdrawal blocks on the Experience the rebuild holds');
    await q('COMMIT');
    const [wD] = (await withdrawing).rows;
    await q2('COMMIT');
    assert.equal(wD.outcome, 'WITHDRAWN');
    await asRole('postgres');
    assert.equal(await count(T.PROJECTION, 'experience_id = $1 AND experience_version_id = $2', [exD.experience, exD.version]), 1,
      'R03 the projection the earlier transaction committed is still there');
    assert.equal((await rt.search(c.reader, 'sentence')).filter((r) => r.experience_id === exD.experience).length, 0,
      'R03 and it serves nothing: canonical visibility, not the projection, decides');
    assert.equal((await rt.lens(c.reader, 'i05c.race')).filter((r) => r.experience_id === exD.experience).length, 0);
    assert.equal((await rt.rebuildProjection(exD.experience))[0].outcome, 'PROJECTION_CLEARED',
      'R03 and the next rebuild clears it');
    console.log('0098 concurrency R03 pass');
  } finally {
    await close();
    await asRole('postgres');
    await rt.restorePrerequisites(seam);
    console.log('0098 concurrency seam restored');
  }
}

await runVerifier('0098', async (stage) => {
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
    stage('continuing eligibility');
    const state = await verifyContinuingEligibility(f, seam);
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
          + (SELECT count(*) FROM ${T.PUBLICATION_STATE} WHERE experience_id = ANY($2::uuid[]))
          + (SELECT count(*) FROM ${T.PROJECTION} WHERE experience_id = ANY($2::uuid[]))
          + (SELECT count(*) FROM ${T.VITALITY} WHERE experience_id = ANY($2::uuid[]))
          + (SELECT count(*) FROM ${T.EXPERIENCES} WHERE id = ANY($2::uuid[]))
          + (SELECT count(*) FROM public.shared_worlds WHERE id = ANY($3::uuid[]))
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
          + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
    [humans, [f.experience, ...c.experiences], [f.world, c.world]]);
  assert.equal(Number(n), 0, 'every fixture this verifier created was rolled back or removed');
  const [{ worlds }] = await rows(`SELECT count(*) worlds FROM ${T.WORLD}`);
  assert.equal(Number(worlds), 1, 'and exactly one logical Public World still exists');
}, () => rt.client.end().catch(() => undefined));
