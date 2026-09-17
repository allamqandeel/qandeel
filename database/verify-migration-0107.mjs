// Real-PostgreSQL verifier for migration 0107 - I-06D post-authorization current
// delivery eligibility, controlled reconciliation and Replay Runtime closure.
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// rows written through the primitives themselves, that a historical distribution
// authorization is EVIDENCE that an authorization existed, and never a permanent
// bearer right to deliver after the world moved:
//
//   production truth, which is FAIL-CLOSED
//     * E01 a package that was never authorized has no authorization to use;
//     * E05 with the production analytical seam in place, current eligibility
//           answers NOT_ELIGIBLE / AUTHORITY_UNRESOLVED and never guesses;
//     * E06 an unevaluated CW2-08 dimension refuses, LAST, after every privacy
//           and ownership gate;
//     * E11 no application role reaches the derivation or the primitive;
//
//   current delivery eligibility, with the seams simulated inside a rolled-back
//   transaction exactly as the frozen I-06C verifier simulates them
//     * E02 a historically AUTHORIZED_FOR_DELIVERY package over current source
//           passes every remaining gate;
//     * E03 source loss refuses FUTURE delivery while the historical
//           authorization row stays exactly as it was written;
//     * E04 a withdrawn approval refuses future use, append-only throughout;
//     * E07 no answer ever claims that a delivery happened or was recalled;
//     * E08 the answer is package-exact: another package of the same Replay
//           Version has its own, and cannot borrow this one;
//     * E09 the creator boundary reports the historical and the current fact
//           side by side and collapses every authority failure into ONE class;
//     * E10 a stranger receives ZERO ROWS;
//
//   the Public destination, where the canonical runtime keeps ownership
//     * P01 private Replay source loss alone invents NO Public transition and
//           changes the canonical Public answer in no way at all;
//     * P02 the Public artifact keeps serving the identical sanitized surface,
//           so a source loss is not a private-source oracle;
//     * P03 canonical Public disappearance immediately stops Public serving;
//     * P04 and it makes current distribution eligibility refuse;
//     * P05 no Replay reconciliation resurrects a disappeared Experience;
//
//   reconciliation, which documents and never decides
//     * N01 it appends bounded evidence and returns the live answer;
//     * N02 the evidence is NOT authority: restore the source and the live
//           derivation says CURRENT while the row still says NOT_CURRENT;
//     * N03 an equivalent retry is idempotent and writes nothing new;
//     * N04 the same command id over a different target is a deterministic
//           conflict that writes nothing;
//     * N05 another human cannot reconcile a creator-private target;
//     * N06 a version that was never finalized cannot be reconciled;
//     * N07 not one immutable row moves;
//     * N08 every I-06D relation is append-only and sealed;
//
//   concurrency, on committed state across two connections
//     * C01 source loss racing reconciliation has ONE coherent current answer;
//     * C02 approval withdrawal racing reconciliation converges safely;
//     * C03 Public disappearance racing reconciliation preserves Public absence;
//     * C04 reopen-for-revision racing old-version reconciliation preserves the
//           old immutable version;
//     * C05 a duplicate reconciliation command converges on ONE observation;
//     * C06 reconciliation racing a new distribution authorization;
//
//   g1..g5 the refused weakenings, each proven non-vacuous
//
// Every scenario reports INDEPENDENTLY through the permanent aggregator and the
// run fails ONCE at the end naming all of them.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createReplayClosureRuntime, C, CFN, I06D_IMMUTABLE, DISTRIBUTION_CLASSES,
  CLOSURE_DISCLOSURE_BAN, runVerifier, APP_ROLES, R, V, D, DFN, T,
} from './replay-closure-verifier-support.mjs';

const rt = createReplayClosureRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const OWN_TABLES = [C.DISTRIBUTION_EVENTS, C.COMMANDS];

// ---------------------------------------------------------------- 1. catalog
async function verifyCatalog() {
  await asRole('postgres');
  await rt.verifyPosture({
    internal: [CFN.ELIGIBILITY],
    reading: [CFN.ELIGIBILITY, CFN.DISTRIBUTION_STATE],
    mutating: [CFN.RECONCILE],
    tables: OWN_TABLES,
    immutable: [I06D_IMMUTABLE[1], I06D_IMMUTABLE[2]],
  });

  // THE RECONCILIATION PRIMITIVE IS REACHABLE BY NOBODY while the CW2-08 Launch
  // Gate is unimplemented, and the creator boundary by the service tier alone.
  for (const role of ['public', ...APP_ROLES]) {
    assert.equal(await rt.canExecute(role, CFN.RECONCILE), false,
      `E11 ${role} must not execute the reconciliation primitive`);
    assert.equal(await rt.canExecute(role, CFN.ELIGIBILITY), false,
      `E11 ${role} must not execute the internal eligibility derivation`);
  }
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.equal(await rt.canExecute(role, CFN.DISTRIBUTION_STATE), false,
      `E09 ${role} must not execute the creator distribution-state boundary`);
  }
  assert.equal(await rt.canExecute('service_role', CFN.DISTRIBUTION_STATE), true,
    'E09 the service tier executes the creator distribution-state boundary');
  for (const column of await rt.resultColumns(CFN.DISTRIBUTION_STATE)) {
    assert.doesNotMatch(column, CLOSURE_DISCLOSURE_BAN,
      `E09 the creator boundary must not return ${column}`);
  }

  // THE ELIGIBILITY DERIVATION COMPOSES THE CANONICAL AUTHORITIES AND WRITES NO
  // SECOND ONE - read from the installed body, because a derivation that stopped
  // consulting one of these would look identical from outside.
  const eligibility = await rt.functionPosture(CFN.ELIGIBILITY);
  for (const needle of ['derive_replay_version_current_availability_v1',
    'derive_replay_distribution_authority_v1', 'derive_replay_distribution_effective_approvals_v1',
    'derive_replay_export_descriptor_v1', 'resolve_replay_distribution_prerequisites_v1',
    'resolve_public_visibility_state_v1', 'replay_version_finalizations']) {
    assert.ok(eligibility.prosrc.includes(needle),
      `E02 current eligibility must re-evaluate through the canonical ${needle}`);
  }
  for (const forbidden of ['replay_distribution_authority_fingerprint_v1',
    'derive_replay_source_manifest_currency_v1', 'derive_public_continuing_eligibility_v1',
    'current_lifecycle', 'public_experience_publication_state']) {
    assert.ok(!eligibility.prosrc.includes(forbidden),
      `E02 current eligibility computes no parallel ${forbidden} of its own`);
  }
  // AND IT CONSULTS NO RECONCILIATION ROW: evidence documents, never decides.
  for (const relation of [C.SOURCE_EVENTS, C.DISTRIBUTION_EVENTS, C.COMMANDS]) {
    assert.ok(!eligibility.prosrc.includes(relation.replace('public.', '')),
      `N02 current truth never consults ${relation}`);
  }

  // THE CANONICAL PUBLIC VISIBILITY RESOLVER IS UNTOUCHED AND SOURCE-BLIND.
  const visibility = await rt.functionPosture(CFN.PUBLIC_VISIBILITY);
  assert.ok(visibility.prosrc.includes('derive_public_continuing_eligibility_v1'),
    'P01 the canonical Public visibility resolver still rests on the frozen I-05C truth');
  assert.ok(!visibility.prosrc.includes('replay_'),
    'P01 and it inspects no private Replay source state: that would be an invented cross-domain rule and a private-source oracle');

  // THE ADDITIVE CANDIDATE KEY IS TRIVIALLY UNIQUE, and its relation still guarded.
  const key = await rt.uniqueKeyColumns(D.PACKAGES, 'replay_distribution_package_versions_target_key');
  assert.deepEqual(key, ['id', 'replay_id', 'replay_version_id'],
    'N01 the additive candidate key binds the package, its Replay and its Replay Version');
  assert.ok(key.includes('id'), 'and contains the primary key, so it constrains no row the primary key did not');
  assert.equal(await rt.triggerEnabled(D.PACKAGES, 'replay_distribution_package_versions_immutable'), true,
    'the frozen I-06C append-only guard on distribution packages is still in place');
  await rt.assertExactBinding(C.DISTRIBUTION_EVENTS, D.PACKAGES,
    ['distribution_package_version_id', 'replay_id', 'replay_version_id'],
    ['id', 'replay_id', 'replay_version_id']);

  // NEITHER I-06D RELATION RECORDS A DELIVERY, AN EXTERNAL COPY OR A RECALL.
  for (const table of [...OWN_TABLES, C.SOURCE_EVENTS]) {
    for (const { attname, typname } of await rows(
      `SELECT a.attname, ty.typname FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
        WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped`, [table])) {
      assert.doesNotMatch(attname,
        /(delivered|downloaded|sent_at|recipient|endpoint|recalled|destroyed|remote_file|external_copy|codec|bitrate|cdn|bucket|object_key|watermark|storage|url|uri|path|transcript|audio|body|content|payload|provenance|staleness|digest)/u,
        `E07 ${table} may not carry ${attname}: QANDEEL performs no delivery and guarantees no recall`);
      assert.ok(!['json', 'jsonb', 'bytea'].includes(typname),
        `E07 ${attname} may not be an untyped payload column`);
    }
  }
}

// ------------------------------------------------------- 2. the fail-closed truth
async function verifyFailClosed(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('E01 a package that was never authorized has no authorization to use', async () => {
      await rt.simulateAnalyticalAuthority([]);
      await actAs(f.creator);
      const spec = rt.freshPackage(base.replay, base.version, 'DOWNLOAD');
      await rt.prepare(spec);
      await asRole('postgres');
      const [answer] = await rt.eligibility(spec.package);
      assert.equal(answer.eligibility_state, 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY');
      assert.equal(answer.refusal_class, 'NOT_AUTHORIZED',
        'E01 current eligibility is about USING an authorization, and there is none');
    });

    await report.isolated('E05 the production analytical seam refuses, bounded, and never guesses', async () => {
      await rt.simulateAnalyticalAuthority([]);
      await rt.simulateDistributionPrerequisites();
      const spec = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      await asRole('postgres');
      assert.equal((await rt.eligibility(spec.package))[0].eligibility_state,
        'ELIGIBLE_FOR_FUTURE_DELIVERY', 'E05 with both seams simulated the package is eligible');

      // NOW PUT THE PRODUCTION ANALYTICAL SEAM BACK. Nothing else changes.
      const analytical = await rt.captureSeamDefinition(DFN.ANALYTICAL_SEAM,
        { expect: ['I-06C VERIFIER PROBE'] });
      await q(`CREATE OR REPLACE FUNCTION public.resolve_replay_analytical_distribution_authority_v1(
                 p_analytical_projection_version_id uuid)
               RETURNS TABLE(resolution_state text, required_approvers uuid[], resolution_basis text)
               LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $probe$
               BEGIN
                 RAISE EXCEPTION 'REPLAY_DISTRIBUTION_ANALYTICAL_AUTHORITY_UNRESOLVED' USING ERRCODE='55000';
               END$probe$`);
      const [refused] = await rt.eligibility(spec.package);
      assert.equal(refused.eligibility_state, 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY');
      assert.equal(refused.refusal_class, 'AUTHORITY_UNRESOLVED',
        'E05 an unresolved subject authority is a bounded refusal, never an error a caller reads as permission');
      // AND IT IS NEVER REINTERPRETED AS AN EMPTY HUMAN REQUIREMENT.
      const [creatorAnswer] = await rt.distributionState(spec.package, f.creator);
      assert.equal(creatorAnswer.current_eligibility_state, 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY');
      assert.equal(creatorAnswer.unavailable_class, 'AUTHORITY_NO_LONGER_CURRENT');
      assert.equal(analytical.prosrc.includes('I-06C VERIFIER PROBE'), true,
        'E05 the seam this scenario replaced was the verifier probe, not production');
    });

    await report.isolated('E06 an unevaluated CW2-08 dimension refuses, after every privacy gate', async () => {
      await rt.simulateAnalyticalAuthority([]);
      await rt.simulateDistributionPrerequisites();
      const spec = await rt.authorizePackage(base, f.creator, 'SHARE_EXTERNALLY');
      await asRole('postgres');
      for (const dimension of ['safety_state', 'moderation_state', 'entitlement_state',
        'feature_state', 'launch_state']) {
        await rt.simulateDistributionPrerequisites({ [dimension]: 'NOT_EVALUATED' });
        const [answer] = await rt.eligibility(spec.package);
        assert.equal(answer.refusal_class, 'PREREQUISITE_UNRESOLVED',
          `E06 an unevaluated ${dimension} refuses on its own: no layer manufactures another`);
      }
      // AND THE PRIVACY GATES ARE ANSWERED FIRST: with the source gone, the
      // refusal is the SOURCE rather than the prerequisite, whatever CW2-08 says.
      await rt.simulateDistributionPrerequisites();
      await rt.detachSourceUnit(base.selectedUnits[0], f.stranger);
      await asRole('postgres');
      assert.equal((await rt.eligibility(spec.package))[0].refusal_class, 'SOURCE_NOT_CURRENT',
        'E06 the CW2-08 seam is LAST: a privacy failure is never reported as a launch failure');
    });

    await report.isolated('E11 no application role reaches any I-06D primitive or relation', async () => {
      for (const role of APP_ROLES) {
        for (const table of [...OWN_TABLES, C.SOURCE_EVENTS]) {
          for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
            const [{ allowed }] = await rows('SELECT has_table_privilege($1, $2::regclass, $3) allowed',
              [role, table, privilege]);
            assert.equal(allowed, false, `E11 ${role} must hold no ${privilege} on ${table}`);
          }
        }
      }
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('both production seams are restored after the rolled-back fail-closed section',
    async () => {
      await asRole('postgres');
      const analytical = await rt.functionPosture(DFN.ANALYTICAL_SEAM);
      const gate = await rt.functionPosture(DFN.PREREQUISITE_SEAM);
      assert.ok(analytical.prosrc.includes('UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'));
      assert.ok(gate.prosrc.includes('NOT_EVALUATED'));
      assert.ok(!analytical.prosrc.includes('VERIFIER PROBE'));
    });
}

// --------------------------------------------- 3. current delivery eligibility
async function verifyEligibility(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await rt.simulateAnalyticalAuthority([]);
    await rt.simulateDistributionPrerequisites();

    await report.isolated('E02 E03 source loss refuses FUTURE delivery and rewrites no history', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      const before = await rows(
        `SELECT distribution_package_version_id, destination_action, replay_version_id,
                authority_request_fingerprint, distribution_state, effective_approval_count,
                authorized_at::text AS at
           FROM ${D.AUTHORIZATIONS} WHERE distribution_package_version_id = $1`, [spec.package]);
      assert.equal(before.length, 1, 'E02 the historical authorization exists');
      assert.equal(before[0].distribution_state, 'AUTHORIZED_FOR_DELIVERY');
      assert.equal((await rt.eligibility(spec.package))[0].eligibility_state, 'ELIGIBLE_FOR_FUTURE_DELIVERY',
        'E02 and over current source it passes every remaining gate');

      await rt.detachSourceUnit(base.selectedUnits[0], f.stranger);
      await asRole('postgres');
      const [after] = await rt.eligibility(spec.package);
      assert.equal(after.eligibility_state, 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY');
      assert.equal(after.refusal_class, 'SOURCE_NOT_CURRENT', 'E03 future delivery is refused');
      // E03 THE HISTORICAL ROW IS EXACTLY WHAT IT WAS, including the instant, read
      // as database-native text rather than as a JavaScript Date.
      assert.deepEqual(await rows(
        `SELECT distribution_package_version_id, destination_action, replay_version_id,
                authority_request_fingerprint, distribution_state, effective_approval_count,
                authorized_at::text AS at
           FROM ${D.AUTHORIZATIONS} WHERE distribution_package_version_id = $1`, [spec.package]),
      before, 'E03 the historical authorization is neither deleted nor rewritten');
    });

    await report.isolated('E04 a withdrawn approval refuses future use, append-only throughout', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      assert.equal((await rt.eligibility(spec.package))[0].eligibility_state, 'ELIGIBLE_FOR_FUTURE_DELIVERY');
      const approvalBefore = await rows(
        `SELECT id, approver_user_id, bound_authority_fingerprint, approved_at::text AS at
           FROM ${D.APPROVALS} WHERE id = $1`, [spec.approval]);
      await actAs(f.creator);
      const [withdrawn] = await rt.withdraw({ command: randomUUID(), approval: spec.approval });
      assert.equal(withdrawn.outcome, 'REPLAY_DISTRIBUTION_APPROVAL_WITHDRAWN');
      await asRole('postgres');
      const [after] = await rt.eligibility(spec.package);
      assert.equal(after.eligibility_state, 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY');
      assert.equal(after.refusal_class, 'APPROVAL_NOT_EFFECTIVE', 'E04 human withdrawal blocks future use');
      // THE APPROVAL ROW IS UNTOUCHED: withdrawal is an append-only EVENT, and
      // effective state is DERIVED. `APPROVED -> REVOKED` is never a row update.
      assert.deepEqual(await rows(
        `SELECT id, approver_user_id, bound_authority_fingerprint, approved_at::text AS at
           FROM ${D.APPROVALS} WHERE id = $1`, [spec.approval]), approvalBefore,
      'E04 the historical approval row is exactly what it was');
      assert.equal(await count(D.WITHDRAWALS, 'approval_id = $1', [spec.approval]), 1,
        'E04 and the withdrawal is one append-only event');
    });

    await report.isolated('E07 E08 the answer claims no delivery and cannot be borrowed', async () => {
      const first = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      const second = await rt.authorizePackage(base, f.creator, 'SHARE_EXTERNALLY');
      await asRole('postgres');
      for (const spec of [first, second]) {
        const [answer] = await rt.eligibility(spec.package);
        assert.ok(['ELIGIBLE_FOR_FUTURE_DELIVERY', 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY']
          .includes(answer.eligibility_state),
        'E07 the vocabulary is about FUTURE eligibility and has no DELIVERED state at all');
      }
      // E08 EACH PACKAGE HAS ITS OWN ANSWER. Withdrawing one consent moves one
      // package and leaves the other exactly where it was.
      await actAs(f.creator);
      await rt.withdraw({ command: randomUUID(), approval: first.approval });
      await asRole('postgres');
      assert.equal((await rt.eligibility(first.package))[0].refusal_class, 'APPROVAL_NOT_EFFECTIVE');
      assert.equal((await rt.eligibility(second.package))[0].eligibility_state, 'ELIGIBLE_FOR_FUTURE_DELIVERY',
        'E08 an authorization belongs to ONE exact immutable package and never floats to another');
    });

    await report.isolated('E09 E10 the creator boundary is bounded, historical-and-current, creator-exact', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      await asRole('postgres');
      const [eligible] = await rt.distributionState(spec.package, f.creator);
      assert.equal(eligible.historical_distribution_state, 'AUTHORIZED_FOR_DELIVERY');
      assert.equal(eligible.current_eligibility_state, 'ELIGIBLE_FOR_FUTURE_DELIVERY');
      assert.equal(eligible.unavailable_class, null);
      assert.deepEqual(Object.keys(eligible).sort(),
        ['current_eligibility_state', 'destination_action', 'distribution_package_version_id',
          'historical_distribution_state', 'unavailable_class'],
        'E09 the boundary returns exactly its bounded surface');

      // THE TWO FACTS DISAGREE, AND BOTH ARE REPORTED TRUTHFULLY.
      await actAs(f.creator);
      await rt.withdraw({ command: randomUUID(), approval: spec.approval });
      await asRole('postgres');
      const [moved] = await rt.distributionState(spec.package, f.creator);
      assert.equal(moved.historical_distribution_state, 'AUTHORIZED_FOR_DELIVERY',
        'E09 the historical fact is unchanged');
      assert.equal(moved.current_eligibility_state, 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY',
        'E09 and the current answer is not');
      assert.equal(moved.unavailable_class, 'AUTHORITY_NO_LONGER_CURRENT',
        'E09 collapsed into ONE class, so the creator never learns WHICH human moved');
      assert.ok(DISTRIBUTION_CLASSES.includes(moved.unavailable_class));
      for (const value of Object.values(moved)) {
        if (typeof value !== 'string') continue;
        assert.ok(!['WITHDRAWN', 'MISSING', 'SUPERSEDED', 'APPROVAL_NOT_EFFECTIVE',
          'AUTHORITY_SUPERSEDED', 'SOURCE_NOT_CURRENT'].includes(value),
        `E09 the internal class ${value} must never reach the creator boundary`);
      }
      // E10 AND ANOTHER HUMAN LEARNS NOTHING AT ALL.
      assert.deepEqual(await rt.distributionState(spec.package, f.stranger), [],
        'E10 a stranger receives zero rows');
      assert.deepEqual(await rt.distributionState(randomUUID(), f.creator), [],
        'E10 and a nonexistent package answers identically');
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('both production seams are restored after the rolled-back eligibility section',
    async () => {
      await asRole('postgres');
      assert.ok((await rt.functionPosture(DFN.ANALYTICAL_SEAM)).prosrc
        .includes('UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'));
      assert.ok((await rt.functionPosture(DFN.PREREQUISITE_SEAM)).prosrc.includes('NOT_EVALUATED'));
    });
}

// --------------------------------------------- 4. the Public destination rule
async function verifyPublicNonRegression(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await rt.simulateAnalyticalAuthority([]);
    await rt.simulateDistributionPrerequisites();

    await report.isolated('P01 P02 private source loss invents NO Public transition and is no oracle', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'PUBLISH_TO_PUBLIC_WORLD', f.experience);
      assert.equal(spec.historical, 'PUBLIC_PUBLICATION_COMMITTED');
      const visibleBefore = await rt.visibility(f.experience);
      assert.equal(visibleBefore[0].visibility_state, 'PUBLICLY_VISIBLE');
      const servedBefore = await rt.resolvePublicArtifact(spec.reference, f.reader);
      assert.equal(servedBefore.length, 1, 'P02 the Public Replay artifact is served');
      const lifecycleBefore = await rows(
        `SELECT current_lifecycle, current_experience_version_id FROM ${T.EXPERIENCES} WHERE id = $1`,
        [f.experience]);

      // THE PRIVATE SOURCE DISAPPEARS.
      await rt.detachSourceUnit(base.selectedUnits[0], f.stranger);
      await asRole('postgres');
      assert.equal((await rt.availability(base.replay, base.version))[0].availability_state, 'NOT_CURRENT',
        'P01 the private Replay source really is no longer current');

      // AND THE PUBLIC WORLD DOES NOT MOVE. Not the lifecycle, not the canonical
      // visibility answer, not one byte of the sanitized surface an audience sees.
      assert.deepEqual(await rows(
        `SELECT current_lifecycle, current_experience_version_id FROM ${T.EXPERIENCES} WHERE id = $1`,
        [f.experience]), lifecycleBefore,
      'P01 no Public lifecycle transition was invented by a private source loss');
      assert.deepEqual(await rt.visibility(f.experience), visibleBefore,
        'P01 and the canonical Public visibility answer is identical');
      assert.deepEqual(await rt.resolvePublicArtifact(spec.reference, f.reader), servedBefore,
        'P02 the audience sees exactly what it saw, so source loss is not a private-source oracle');
      assert.equal(await count(T.DISAPPEARANCE_STATE, 'experience_id = $1', [f.experience]), 0,
        'P01 and no disappearance record exists');
    });

    await report.isolated('P03 P04 canonical Public disappearance stops serving and refuses the package', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'PUBLISH_TO_PUBLIC_WORLD', f.experience);
      assert.equal((await rt.resolvePublicArtifact(spec.reference, f.reader)).length, 1);
      assert.equal((await rt.eligibility(spec.package))[0].eligibility_state, 'ELIGIBLE_FOR_FUTURE_DELIVERY',
        'P04 the published Public package is currently eligible');

      // THE CANONICAL PUBLIC PATH, and only it.
      await actAs(f.creator);
      const [removed] = await rt.removeFromPublicWorld(randomUUID(), f.experience, spec.publicVersion);
      assert.equal(removed.outcome, 'REMOVED_FROM_PUBLIC_WORLD');
      await asRole('postgres');
      assert.equal((await rt.visibility(f.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE');
      assert.equal((await rt.resolvePublicArtifact(spec.reference, f.reader)).length, 0,
        'P03 the Public Replay artifact serves nothing, immediately');
      const [refused] = await rt.eligibility(spec.package);
      assert.equal(refused.refusal_class, 'PUBLIC_DESTINATION_NOT_SERVING',
        'P04 and the destination own runtime is what refuses, consumed rather than duplicated');
      const [creatorAnswer] = await rt.distributionState(spec.package, f.creator);
      assert.equal(creatorAnswer.unavailable_class, 'DESTINATION_NOT_CURRENTLY_SERVING');
    });

    await report.isolated('P05 no Replay reconciliation resurrects a disappeared Experience', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'PUBLISH_TO_PUBLIC_WORLD', f.experience);
      await actAs(f.creator);
      await rt.removeFromPublicWorld(randomUUID(), f.experience, spec.publicVersion);
      const absent = await rows(
        `SELECT current_lifecycle FROM ${T.EXPERIENCES} WHERE id = $1`, [f.experience]);
      assert.equal(absent[0].current_lifecycle, 'ABSENT_FROM_PUBLIC_WORLD');

      // RECONCILE THE REPLAY, REPEATEDLY, OVER THE ABSENT DESTINATION.
      await actAs(f.creator);
      const [reconciled] = await rt.reconcile(
        rt.freshReconciliation(base.replay, base.version, spec.package));
      assert.equal(reconciled.outcome, 'REPLAY_POST_FINALIZATION_RECONCILED');
      assert.equal(reconciled.eligibility_answer, 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY');
      await actAs(f.creator);
      await rt.reconcile(rt.freshReconciliation(base.replay, base.version, spec.package));
      await asRole('postgres');
      assert.deepEqual(await rows(
        `SELECT current_lifecycle FROM ${T.EXPERIENCES} WHERE id = $1`, [f.experience]), absent,
      'P05 the Public Experience is still absent: reconciliation writes no Public lifecycle at all');
      assert.equal((await rt.visibility(f.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE');
      assert.equal((await rt.resolvePublicArtifact(spec.reference, f.reader)).length, 0,
        'P05 and nothing is served');
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('both production seams are restored after the rolled-back Public section',
    async () => {
      await asRole('postgres');
      assert.ok((await rt.functionPosture(DFN.ANALYTICAL_SEAM)).prosrc
        .includes('UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'));
      assert.ok((await rt.functionPosture(DFN.PREREQUISITE_SEAM)).prosrc.includes('NOT_EVALUATED'));
      assert.ok((await rt.functionPosture('public.resolve_public_publication_prerequisites_v1(uuid, uuid)'))
        .prosrc.includes('NOT_EVALUATED'));
    });
}

// ------------------------------------------------------- 5. the reconciliation
async function verifyReconciliation(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await rt.simulateAnalyticalAuthority([]);
    await rt.simulateDistributionPrerequisites();

    await report.isolated('N01 N02 reconciliation appends bounded evidence that is NOT authority', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      const original = await rt.sourceTextOf(base.selectedUnits[0]);
      await rt.changeSourceText(base.selectedUnits[0]);
      await actAs(f.creator);
      const command = rt.freshReconciliation(base.replay, base.version, spec.package);
      const [result] = await rt.reconcile(command);
      assert.equal(result.outcome, 'REPLAY_POST_FINALIZATION_RECONCILED');
      assert.equal(result.availability_answer, 'NOT_CURRENT');
      assert.equal(result.eligibility_answer, 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY');
      await asRole('postgres');
      assert.equal(await count(C.SOURCE_EVENTS,
        "id = $1 AND observed_availability_state = 'NOT_CURRENT'", [command.command]), 1,
      'N01 one bounded source observation was appended');
      assert.equal(await count(C.DISTRIBUTION_EVENTS,
        "id = $1 AND observed_refusal_class = 'SOURCE_NOT_CURRENT'", [command.command]), 1,
      'N01 and one bounded distribution observation, naming the gate that refused');

      // N02 THE EVIDENCE CANNOT OUTVOTE THE LIVE DERIVATION. Put the exact source
      // back and ask again: the answer changes, the row does not.
      await rt.restoreSourceText(base.selectedUnits[0], original);
      await asRole('postgres');
      assert.equal((await rt.availability(base.replay, base.version))[0].availability_state, 'CURRENT',
        'N02 the live derivation answers CURRENT the moment the source returns');
      assert.equal((await rt.eligibility(spec.package))[0].eligibility_state, 'ELIGIBLE_FOR_FUTURE_DELIVERY',
        'N02 without waiting for any reconciliation to run');
      assert.equal(await count(C.SOURCE_EVENTS,
        "id = $1 AND observed_availability_state = 'NOT_CURRENT'", [command.command]), 1,
      'N02 while the observation still records exactly what was observed, and decides nothing');
    });

    await report.isolated('N03 N04 an equivalent retry is idempotent and a reused id conflicts', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      await actAs(f.creator);
      const command = rt.freshReconciliation(base.replay, base.version, spec.package);
      const [first] = await rt.reconcile(command);
      const [retry] = await rt.reconcile(command);
      assert.equal(retry.outcome, 'ALREADY_COMMITTED');
      assert.equal(retry.availability_answer, first.availability_answer,
        'N03 the retry is answered from what was COMMITTED, not recomputed');
      assert.equal(retry.eligibility_answer, first.eligibility_answer);
      assert.equal(retry.reconciled_at.getTime(), first.reconciled_at.getTime(),
        'N03 including the original instant');
      await asRole('postgres');
      assert.equal(await count(C.SOURCE_EVENTS, 'id = $1', [command.command]), 1,
        'N03 and the retry wrote no second observation');

      // N04 THE SAME COMMAND ID OVER A DIFFERENT TARGET IS A CONFLICT.
      const other = await rt.authorizePackage(base, f.creator, 'SHARE_EXTERNALLY');
      await actAs(f.creator);
      await rejected(() => rt.reconcile({ ...command, package: other.package }),
        ['23505'], /REPLAY_POST_FINALIZATION_COMMAND_ID_CONFLICT/u);
      await rejected(() => rt.reconcile({ ...command, package: null }),
        ['23505'], /REPLAY_POST_FINALIZATION_COMMAND_ID_CONFLICT/u);
      await asRole('postgres');
      assert.equal(await count(C.DISTRIBUTION_EVENTS, 'distribution_package_version_id = $1',
        [other.package]), 0, 'N04 and the conflicting command wrote nothing at all');
    });

    await report.isolated('N05 N06 another human cannot reconcile, and neither can an unfinalized version', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      await actAs(f.stranger);
      await rejected(() => rt.reconcile(rt.freshReconciliation(base.replay, base.version, spec.package)),
        ['P0002'], /REPLAY_POST_FINALIZATION_NOT_AVAILABLE/u);
      // A nonexistent Replay reaches the SAME bounded class, so the refusal is
      // not an existence oracle.
      await rejected(() => rt.reconcile(rt.freshReconciliation(randomUUID(), randomUUID(), null)),
        ['P0002'], /REPLAY_POST_FINALIZATION_NOT_AVAILABLE/u);

      await actAs(f.creator);
      const [reopened] = await rt.reopen({ command: randomUUID(), replay: base.replay, version: base.version });
      assert.equal(reopened.outcome, 'REPLAY_REOPENED_FOR_REVISION');
      await asRole('postgres');
      const second = rt.freshPreview(base.replay, await rt.draftRevision(base.replay));
      await actAs(f.creator);
      await rt.preview(second);
      await rejected(() => rt.reconcile(rt.freshReconciliation(base.replay, second.version, null)),
        ['P0002'], /REPLAY_POST_FINALIZATION_NOT_AVAILABLE/u);
      await asRole('postgres');
      assert.equal(await count(C.SOURCE_EVENTS, 'replay_version_id = $1', [second.version]), 0,
        'N06 a version that was never finalized leaves no post-finalization evidence');
    });

    await report.isolated('N07 reconciliation moves not one immutable row', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      await asRole('postgres');
      const before = {
        ...await rt.replaySnapshot(base.replay), ...await rt.versionSnapshot(base.replay),
        packages: await rows(`SELECT * FROM ${D.PACKAGES} WHERE replay_id = $1 ORDER BY package_revision`,
          [base.replay]),
        authorizations: await rows(
          `SELECT * FROM ${D.AUTHORIZATIONS} WHERE replay_id = $1 ORDER BY distribution_package_version_id`,
          [base.replay]),
        descriptors: await rows(
          `SELECT * FROM ${D.DESCRIPTORS} WHERE distribution_package_version_id = $1`, [spec.package]),
      };
      await rt.detachSourceUnit(base.selectedUnits[0], f.stranger);
      await actAs(f.creator);
      await rt.reconcile(rt.freshReconciliation(base.replay, base.version, spec.package));
      await asRole('postgres');
      const after = {
        ...await rt.replaySnapshot(base.replay), ...await rt.versionSnapshot(base.replay),
        packages: await rows(`SELECT * FROM ${D.PACKAGES} WHERE replay_id = $1 ORDER BY package_revision`,
          [base.replay]),
        authorizations: await rows(
          `SELECT * FROM ${D.AUTHORIZATIONS} WHERE replay_id = $1 ORDER BY distribution_package_version_id`,
          [base.replay]),
        descriptors: await rows(
          `SELECT * FROM ${D.DESCRIPTORS} WHERE distribution_package_version_id = $1`, [spec.package]),
      };
      assert.deepEqual(after, before,
        'N07 the immutable package, its descriptor, its authorization and the whole Replay Version are untouched');
    });

    await report.isolated('N08 every I-06D relation is append-only for every role including its owner', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      await actAs(f.creator);
      const command = rt.freshReconciliation(base.replay, base.version, spec.package);
      await rt.reconcile(command);
      await asRole('postgres');
      for (const [table, column, value] of [
        [C.SOURCE_EVENTS, 'observed_availability_state', 'NOT_CURRENT'],
        [C.DISTRIBUTION_EVENTS, 'observed_eligibility_state', 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'],
        [C.COMMANDS, 'committed_availability_state', 'NOT_CURRENT']]) {
        await rejected(() => q(`UPDATE ${table} SET ${column} = $2 WHERE id = $1`, [command.command, value]),
          ['55000'], /REPLAY_POST_FINALIZATION_IS_IMMUTABLE/u);
        await rejected(() => q(`DELETE FROM ${table} WHERE id = $1`, [command.command]),
          ['55000'], /REPLAY_POST_FINALIZATION_IS_IMMUTABLE/u);
      }
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('both production seams are restored after the rolled-back reconciliation section',
    async () => {
      await asRole('postgres');
      assert.ok((await rt.functionPosture(DFN.ANALYTICAL_SEAM)).prosrc
        .includes('UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'));
      assert.ok((await rt.functionPosture(DFN.PREREQUISITE_SEAM)).prosrc.includes('NOT_EVALUATED'));
    });
}

// ------------------------------------------------------------ 6. concurrency
async function verifyConcurrency(report, f, base) {
  await asRole('postgres');
  const analytical = await rt.captureSeamDefinition(DFN.ANALYTICAL_SEAM,
    { expect: ['UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'] });
  const gate = await rt.captureSeamDefinition(DFN.PREREQUISITE_SEAM, { expect: ['NOT_EVALUATED'] });

  let sourceRace = null;
  let withdrawalRace = null;
  let reopenRace = null;
  let duplicateRace = null;
  let newAuthorization = null;
  await q('BEGIN');
  try {
    await rt.simulateAnalyticalAuthority([]);
    await rt.simulateDistributionPrerequisites();
    sourceRace = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
    withdrawalRace = await rt.authorizePackage(base, f.creator, 'SHARE_EXTERNALLY');
    reopenRace = await rt.authorizePackage(base, f.creator, 'PUBLISH_TO_PUBLIC_WORLD', f.experience);
    duplicateRace = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
    // Prepared and approved but NOT authorized: C06 is the act that authorizes it.
    newAuthorization = rt.freshPackage(base.replay, base.version, 'SHARE_EXTERNALLY');
    await actAs(f.creator);
    await rt.prepare(newAuthorization);
    newAuthorization.approval = randomUUID();
    await rt.approve({ approval: newAuthorization.approval, package: newAuthorization.package });
    await asRole('postgres');
    // BOTH seams stay simulated across the races, and both are restored below.
    await rt.simulateDistributionPrerequisites();
  } finally {
    await q('COMMIT');
  }

  const secondary = await rt.openSecondary();
  const { q2, actAs2 } = secondary;
  try {
    await report.section('C01 a source change racing reconciliation has ONE coherent current answer', async () => {
      // Every race begins by clearing both connections: a scenario that failed
      // earlier would otherwise leave one inside an ABORTED transaction.
      await q2('ROLLBACK');
      await asRole('postgres');
      const original = await rt.sourceTextOf(base.selectedUnits[0]);
      await q2('BEGIN');
      await q2('RESET ROLE');
      await q2("SET LOCAL session_replication_role = 'replica'");
      await q2(`UPDATE public.conversation_units
                   SET committed_text = overlay(committed_text placing 'R' from 1 for 1)
                 WHERE id = $1`, [base.selectedUnits[0]]);
      await q('BEGIN');
      await actAs(f.creator);
      const command = rt.freshReconciliation(base.replay, base.version, sourceRace.package);
      const blocked = q('SELECT * FROM public.reconcile_replay_post_finalization_state_v1($1, $2, $3, $4)',
        [command.command, command.replay, command.version, command.package]);
      assert.equal(await rt.stillPending(blocked), true,
        'C01 reconciliation waits on the exact committed source row the writer holds, through the canonical lock');
      await q2('COMMIT');
      const [observed] = (await blocked).rows;
      assert.equal(observed.availability_answer, 'NOT_CURRENT',
        'C01 and it observes the source the winner committed, never a stale one');
      assert.equal(observed.eligibility_answer, 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY');
      await q('COMMIT');
      // Put the EXACT original bytes back, so the remaining races see the truth
      // they need and the fixture is what it was.
      await asRole('postgres');
      await q('BEGIN');
      await q("SET LOCAL session_replication_role = 'replica'");
      await q('UPDATE public.conversation_units SET committed_text = $2 WHERE id = $1',
        [base.selectedUnits[0], original]);
      await q('COMMIT');
      await asRole('postgres');
      assert.equal((await rt.availability(base.replay, base.version))[0].availability_state, 'CURRENT',
        'C01 and the restored source reads CURRENT again');
    });

    await report.section('C02 a withdrawal racing reconciliation converges safely', async () => {
      await q2('ROLLBACK');
      await asRole('postgres');
      await q2('BEGIN');
      await actAs2(f.creator);
      await q2('SELECT * FROM public.withdraw_replay_distribution_approval_v1($1, $2, $3)',
        [randomUUID(), withdrawalRace.approval, null]);
      await q('BEGIN');
      await actAs(f.creator);
      const command = rt.freshReconciliation(base.replay, base.version, withdrawalRace.package);
      const blocked = q('SELECT * FROM public.reconcile_replay_post_finalization_state_v1($1, $2, $3, $4)',
        [command.command, command.replay, command.version, command.package]);
      assert.equal(await rt.stillPending(blocked), true,
        'C02 reconciliation waits for the Replay row the withdrawal holds: Replay-first, both times');
      await q2('COMMIT');
      const [observed] = (await blocked).rows;
      assert.equal(observed.eligibility_answer, 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY',
        'C02 the loser observes the withdrawal the winner committed');
      await q('COMMIT');
      await asRole('postgres');
      assert.equal(await count(C.DISTRIBUTION_EVENTS,
        "id = $1 AND observed_refusal_class = 'APPROVAL_NOT_EFFECTIVE'", [command.command]), 1,
      'C02 and the evidence names the gate that refused');
    });

    await report.section('C03 Public disappearance racing reconciliation preserves Public absence', async () => {
      await q2('ROLLBACK');
      await asRole('postgres');
      await q2('BEGIN');
      await actAs2(f.creator);
      await q2('SELECT * FROM public.remove_public_experience_from_public_world_v1($1, $2, $3)',
        [randomUUID(), f.experience, reopenRace.publicVersion]);
      await q('BEGIN');
      await actAs(f.creator);
      const command = rt.freshReconciliation(base.replay, base.version, reopenRace.package);
      const blocked = q('SELECT * FROM public.reconcile_replay_post_finalization_state_v1($1, $2, $3, $4)',
        [command.command, command.replay, command.version, command.package]);
      assert.equal(await rt.stillPending(blocked), true,
        'C03 reconciliation waits on the Public rows the canonical disappearance holds');
      await q2('COMMIT');
      const [observed] = (await blocked).rows;
      assert.equal(observed.eligibility_answer, 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY',
        'C03 and observes the absence rather than a stale visible state');
      await q('COMMIT');
      await asRole('postgres');
      assert.equal((await rt.visibility(f.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE',
        'C03 the Public Experience is still absent after the Replay reconciliation committed');
      assert.equal((await rt.resolvePublicArtifact(reopenRace.reference, f.reader)).length, 0,
        'C03 and nothing is served');
    });

    await report.section('C04 reopen-for-revision racing old-version reconciliation preserves the old version', async () => {
      await q2('ROLLBACK');
      await asRole('postgres');
      const finalizedBefore = await rows(
        `SELECT replay_version_id, finalized_by_user_id, finalized_at::text AS at
           FROM ${V.FINALIZATIONS} WHERE replay_id = $1 ORDER BY replay_version_id`, [base.replay]);
      await q2('BEGIN');
      await actAs2(f.creator);
      await q2('SELECT * FROM public.reopen_replay_for_revision_v1($1, $2, $3)',
        [randomUUID(), base.replay, base.version]);
      await q('BEGIN');
      await actAs(f.creator);
      const command = rt.freshReconciliation(base.replay, base.version, sourceRace.package);
      const blocked = q('SELECT * FROM public.reconcile_replay_post_finalization_state_v1($1, $2, $3, $4)',
        [command.command, command.replay, command.version, command.package]);
      assert.equal(await rt.stillPending(blocked), true,
        'C04 both take the Replay row FOR UPDATE, so they serialize rather than interleave');
      await q2('COMMIT');
      const [observed] = (await blocked).rows;
      assert.equal(observed.outcome, 'REPLAY_POST_FINALIZATION_RECONCILED',
        'C04 the old finalized version is still reconcilable after the Replay reopened');
      await q('COMMIT');
      await asRole('postgres');
      assert.deepEqual(await rows(
        `SELECT replay_version_id, finalized_by_user_id, finalized_at::text AS at
           FROM ${V.FINALIZATIONS} WHERE replay_id = $1 ORDER BY replay_version_id`, [base.replay]),
      finalizedBefore, 'C04 and the historical finalization of the old version is exactly what it was');
    });

    await report.section('C05 a duplicate reconciliation command converges on ONE observation', async () => {
      await q2('ROLLBACK');
      await asRole('postgres');
      const command = rt.freshReconciliation(base.replay, base.version, duplicateRace.package);
      await q('BEGIN');
      await actAs(f.creator);
      const first = q('SELECT * FROM public.reconcile_replay_post_finalization_state_v1($1, $2, $3, $4)',
        [command.command, command.replay, command.version, command.package]);
      await first;
      await q2('BEGIN');
      await actAs2(f.creator);
      const second = q2('SELECT * FROM public.reconcile_replay_post_finalization_state_v1($1, $2, $3, $4)',
        [command.command, command.replay, command.version, command.package]);
      assert.equal(await rt.stillPending(second), true,
        'C05 the second command waits for the Replay row the first holds');
      await q('COMMIT');
      const converged = (await second).rows;
      assert.equal(converged[0].outcome, 'ALREADY_COMMITTED',
        'C05 the loser converges on the committed observation rather than writing a second one');
      await q2('COMMIT');
      await asRole('postgres');
      assert.equal(await count(C.SOURCE_EVENTS, 'id = $1', [command.command]), 1,
        'C05 exactly one observation exists for one idempotent command');
    });

    await report.section('C06 reconciliation racing a new distribution authorization', async () => {
      await q2('ROLLBACK');
      await asRole('postgres');
      await q2('BEGIN');
      await actAs2(f.creator);
      await q2('SELECT * FROM public.authorize_replay_distribution_v1($1, $2, $3)',
        [randomUUID(), newAuthorization.package, null]);
      await q('BEGIN');
      await actAs(f.creator);
      const command = rt.freshReconciliation(base.replay, base.version, newAuthorization.package);
      const blocked = q('SELECT * FROM public.reconcile_replay_post_finalization_state_v1($1, $2, $3, $4)',
        [command.command, command.replay, command.version, command.package]);
      assert.equal(await rt.stillPending(blocked), true,
        'C06 reconciliation waits for the Replay row the authorization holds: no lock inversion, no deadlock');
      await q2('COMMIT');
      const [observed] = (await blocked).rows;
      assert.equal(observed.eligibility_answer, 'ELIGIBLE_FOR_FUTURE_DELIVERY',
        'C06 and observes the authorization the winner committed, never a stale absence');
      await q('COMMIT');
      await asRole('postgres');
      assert.equal(await count(C.DISTRIBUTION_EVENTS,
        "id = $1 AND observed_eligibility_state = 'ELIGIBLE_FOR_FUTURE_DELIVERY'", [command.command]), 1);
    });
  } finally {
    await q('ROLLBACK').catch(() => undefined);
    await q2('ROLLBACK').catch(() => undefined);
    await secondary.close();
    await asRole('postgres');
    await rt.restoreSeamDefinition(analytical);
    await rt.restoreSeamDefinition(gate);
  }

  await report.section('both production seams are restored after the committed races', async () => {
    await asRole('postgres');
    const restoredAnalytical = await rt.functionPosture(DFN.ANALYTICAL_SEAM);
    const restoredGate = await rt.functionPosture(DFN.PREREQUISITE_SEAM);
    assert.equal(restoredAnalytical.prosrc, analytical.prosrc,
      'the production analytical subject-authority seam is restored byte for byte');
    assert.equal(restoredGate.prosrc, gate.prosrc,
      'the production CW2-08 prerequisite seam is restored byte for byte');
    assert.ok(!restoredAnalytical.prosrc.includes('VERIFIER PROBE'));
    assert.ok(!restoredGate.prosrc.includes('VERIFIER PROBE'));
  });
}

// --------------------------------------------------------- 7. forward safety
async function verifyForwardSafety(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await rt.simulateAnalyticalAuthority([]);
    await rt.simulateDistributionPrerequisites();
    const [derivation] = await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      [CFN.ELIGIBILITY]);
    const [primitive] = await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      [CFN.RECONCILE]);

    await report.isolated('g1 the withdrawn-approval gate is load-bearing', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      await actAs(f.creator);
      await rt.withdraw({ command: randomUUID(), approval: spec.approval });
      await asRole('postgres');
      assert.equal((await rt.eligibility(spec.package))[0].refusal_class, 'APPROVAL_NOT_EFFECTIVE');
      const weakened = derivation.definition.replace(
        "WHERE s.effective_state IS DISTINCT FROM 'EFFECTIVE') THEN",
        "WHERE false AND s.effective_state IS DISTINCT FROM 'EFFECTIVE') THEN");
      assert.notEqual(weakened, derivation.definition, 'g1 the weakening changed the derivation');
      assert.ok(weakened.includes("WHERE false AND s.effective_state"), 'g1 and it introduced the dead condition');
      await q(weakened);
      assert.equal((await rt.eligibility(spec.package))[0].eligibility_state, 'ELIGIBLE_FOR_FUTURE_DELIVERY',
        'g1 without the gate a withdrawn approval really does stay effective, so the gate is load-bearing');
      await q(derivation.definition);
      const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        [CFN.ELIGIBILITY]);
      assert.equal(prosrc, derivation.prosrc, 'g1 the production derivation is restored byte for byte');
      assert.equal((await rt.eligibility(spec.package))[0].refusal_class, 'APPROVAL_NOT_EFFECTIVE',
        'g1 and it refuses the withdrawn approval again');
    });

    await report.isolated('g2 the source gate is load-bearing, and the catalog refuses a detached one', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      await rt.detachSourceUnit(base.selectedUnits[0], f.stranger);
      await asRole('postgres');
      assert.equal((await rt.eligibility(spec.package))[0].refusal_class, 'SOURCE_NOT_CURRENT');
      const weakened = derivation.definition.replace(
        "IF current_availability IS DISTINCT FROM 'CURRENT' THEN",
        "IF false AND current_availability IS DISTINCT FROM 'CURRENT' THEN");
      assert.notEqual(weakened, derivation.definition, 'g2 the weakening changed the derivation');
      await q(weakened);
      assert.equal((await rt.eligibility(spec.package))[0].eligibility_state, 'ELIGIBLE_FOR_FUTURE_DELIVERY',
        'g2 without the gate a stale authorization really does stay usable, so the gate is load-bearing');
      // AND THE CATALOG CONTRACT IS NOT VACUOUS EITHER.
      const detached = derivation.definition.replace(
        'FROM public.derive_replay_version_current_availability_v1(package.replay_id, package.replay_version_id) a;',
        "FROM (SELECT 'CURRENT'::text AS availability_state) a;");
      assert.notEqual(detached, derivation.definition, 'g2 the second weakening changed the derivation');
      assert.ok(!detached.includes('derive_replay_version_current_availability_v1'),
        'g2 and it removed the canonical delegation entirely');
      await q(detached);
      let refused = false;
      try { await verifyCatalog(); } catch { refused = true; }
      assert.ok(refused, 'g2 the catalog check really refuses an eligibility derivation with no source gate');
      await q(derivation.definition);
      const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        [CFN.ELIGIBILITY]);
      assert.equal(prosrc, derivation.prosrc, 'g2 the production derivation is restored byte for byte');
    });

    await report.isolated('g3 the Public destination gate is load-bearing', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'PUBLISH_TO_PUBLIC_WORLD', f.experience);
      await actAs(f.creator);
      await rt.removeFromPublicWorld(randomUUID(), f.experience, spec.publicVersion);
      await asRole('postgres');
      assert.equal((await rt.eligibility(spec.package))[0].refusal_class, 'PUBLIC_DESTINATION_NOT_SERVING');
      const weakened = derivation.definition.replace(
        "IF visible.state IS DISTINCT FROM 'PUBLICLY_VISIBLE'",
        "IF false AND visible.state IS DISTINCT FROM 'PUBLICLY_VISIBLE'");
      assert.notEqual(weakened, derivation.definition, 'g3 the weakening changed the derivation');
      await q(weakened);
      assert.equal((await rt.eligibility(spec.package))[0].eligibility_state, 'ELIGIBLE_FOR_FUTURE_DELIVERY',
        'g3 without the gate an absent Public destination really does read eligible, so the gate is load-bearing');
      // AND THE CANONICAL PUBLIC ANSWER NEVER MOVED: the weakening made the REPLAY
      // answer wrong and left the Public World correct, which is exactly the
      // ownership boundary this slice keeps.
      assert.equal((await rt.visibility(f.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE');
      assert.equal((await rt.resolvePublicArtifact(spec.reference, f.reader)).length, 0,
        'g3 and a weakened Replay derivation still serves nothing to a Public audience');
      await q(derivation.definition);
      const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        [CFN.ELIGIBILITY]);
      assert.equal(prosrc, derivation.prosrc, 'g3 the production derivation is restored byte for byte');
    });

    await report.isolated('g4 reconciliation cannot be made to mutate an immutable package field', async () => {
      const spec = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      const before = await rows(`SELECT * FROM ${D.PACKAGES} WHERE id = $1`, [spec.package]);
      // The weakening is the defect in its most direct form: a reconciliation
      // that "refreshes" the stale package in place instead of refusing it.
      const weakened = primitive.definition.replace(
        '  RETURN QUERY SELECT \'REPLAY_POST_FINALIZATION_RECONCILED\'::text',
        `  UPDATE public.replay_distribution_package_versions
       SET required_approver_count = 0 WHERE id = p_distribution_package_version_id;
  RETURN QUERY SELECT 'REPLAY_POST_FINALIZATION_RECONCILED'::text`);
      assert.notEqual(weakened, primitive.definition, 'g4 the weakening changed the primitive');
      assert.ok(weakened.includes('SET required_approver_count = 0'), 'g4 and it introduced the in-place refresh');
      await q(weakened);
      await actAs(f.creator);
      // THE FROZEN I-06C APPEND-ONLY GUARD REFUSES IT, so the defect cannot even
      // reach the row: immutability is structural, not a convention the caller
      // is trusted to keep.
      await rejected(() => rt.reconcile(rt.freshReconciliation(base.replay, base.version, spec.package)),
        ['55000'], /REPLAY_DISTRIBUTION_IS_IMMUTABLE/u);
      await asRole('postgres');
      assert.deepEqual(await rows(`SELECT * FROM ${D.PACKAGES} WHERE id = $1`, [spec.package]), before,
        'g4 and the immutable package is exactly what it was');
      await q(primitive.definition);
      const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        [CFN.RECONCILE]);
      assert.equal(prosrc, primitive.prosrc, 'g4 the production primitive is restored byte for byte');
    });

    await report.isolated('g5 a later reviewed delivery boundary leaves everything passing', async () => {
      // The roadmap, as real relations: a reviewed media delivery boundary with
      // a real storage handle and a reviewed external-provider receipt. Nothing
      // 0106 or 0107 asserted may forbid them, because both migrations ban what
      // is banned ON THEIR OWN RELATIONS.
      await q(`CREATE TABLE public.i06d_probe_delivery_receipts (
                 id uuid PRIMARY KEY,
                 distribution_package_version_id uuid NOT NULL
                   REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT,
                 storage_object_key text NOT NULL, delivered_at timestamptz NOT NULL)`);
      await q(`ALTER TABLE ${C.DISTRIBUTION_EVENTS} ADD COLUMN probe_client_ref text`);
      await q(`CREATE INDEX i06d_probe_distribution_events_at_idx ON ${C.DISTRIBUTION_EVENTS} (observed_at)`);
      const spec = await rt.authorizePackage(base, f.creator, 'DOWNLOAD');
      await asRole('postgres');
      assert.equal((await rt.eligibility(spec.package))[0].eligibility_state, 'ELIGIBLE_FOR_FUTURE_DELIVERY',
        'g5 a later delivery boundary, an additive column and an index leave the derivation answering');
      await verifyCatalog();
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('the catalog is intact after the rolled-back weakenings', verifyCatalog);
}

// ---------------------------------------------------------------------- main
await runVerifier('0107', async (stage) => {
  await rt.client.connect();
  const report = createScenarioReport('0107', { query: q, restore: () => asRole('postgres') });

  stage('catalog');
  await report.section('the catalog is exactly what the migration installed', verifyCatalog);

  stage('fixture');
  const f = {
    creator: randomUUID(), stranger: randomUUID(), reader: randomUUID(), creatorRef: randomUUID(),
    experience: null,
  };
  f.humans = [f.creator, f.stranger, f.reader];
  let base = null;
  try {
    await q('BEGIN');
    try {
      await asRole('postgres');
      await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [f.humans]);
      base = await rt.provisionFinalizedReplay(f.creator);
      f.experience = await rt.provisionControlledExperience(f.creator, f.creatorRef, 'the replay publisher');
      await asRole('postgres');
    } finally {
      await q('COMMIT');
    }

    stage('fail closed');
    await verifyFailClosed(report, f, base);
    stage('eligibility');
    await verifyEligibility(report, f, base);
    stage('public non-regression');
    await verifyPublicNonRegression(report, f, base);
    stage('reconciliation');
    await verifyReconciliation(report, f, base);
    stage('concurrency');
    await verifyConcurrency(report, f, base);
    stage('forward safety');
    await verifyForwardSafety(report, f, base);
  } finally {
    stage('fixture removal');
    await rt.removeCommittedReconciliations(f.humans);
    await rt.removeCommittedDistributions(f.humans);
    await rt.removeCommittedReplayVersions(f.humans);
    await rt.removeCommittedReplays(f.humans);
    await rt.removePublicReplayFixture([f.experience].filter(Boolean));
    await rt.removePublicIdentities(f.humans);
    await rt.removeHistoricalFixture(f.humans);
    await rt.removeFixtureHumans(f.humans);
  }

  stage('report');
  await asRole('postgres');
  await report.section('the catalog is exactly what the migration installed, after every fixture is gone',
    verifyCatalog);
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${C.COMMANDS} WHERE replay_id IN
               (SELECT id FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[])))
          + (SELECT count(*) FROM ${D.PACKAGES} WHERE replay_id IN
               (SELECT id FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[])))
          + (SELECT count(*) FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM public.conversation_sessions WHERE user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${T.EXPERIENCES} WHERE id = ANY($2::uuid[])) AS residue`,
    [f.humans, [f.experience].filter(Boolean)]);
  assert.equal(Number(residue), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
