// Real-PostgreSQL verifier for migration 0105 - I-06C Replay Distribution
// Runtime, Export Privacy Sanitization and the Public REPLAY_ARTIFACT bridge
// (PART B).
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// rows written through the primitives themselves, that:
//
//   the production truth, which is FAIL-CLOSED on two independent seams
//     * X01 package preparation really fails closed on unresolved analytical
//           authority, with the Replay's own I-06B state untouched;
//     * X02 the analytical seam answers the canonical unresolved state and names
//           no approver at all;
//     * X03 the CW2-08 seam answers NOT_EVALUATED on every dimension;
//     * X04 no application role can execute any I-06C primitive;
//
//   preparation, with the analytical seam simulated inside a rolled-back
//   transaction exactly as the frozen I-05B verifiers simulate the Public one
//     * X05 a package binds the exact historically finalized version, mints an
//           opaque reference and widens NO audience;
//     * X06 a version that was never finalized cannot be prepared;
//     * X07 a stranger and a nonexistent Replay reach ONE bounded class;
//     * X08 the required approver set is DERIVED and membership adds nobody;
//     * X09 QANDEEL-authored Personal material fails the source authority closed;
//     * X10 a bound source that moved blocks preparation;
//     * X11 the sanitized descriptor is the whole audience-visible surface;
//     * X12 a second destination is a NEW package with its own identity;
//     * X13 preparation is durably idempotent and a reused id conflicts;
//
//   consent and its withdrawal
//     * X14 the required human approves through auth.uid() with no actor input;
//     * X15 a human the package does not require reaches the bounded class;
//     * X16 an approval cannot float to another package or another destination;
//     * X17 withdrawal is append-only, own-approval only, and idempotent;
//     * X18 MISSING, WITHDRAWN and EFFECTIVE are each derived, never counted;
//
//   the distribution commit
//     * X19 a missing approval blocks it;
//     * X20 a withdrawn approval blocks it;
//     * X21 an unevaluated CW2-08 dimension blocks it, seam last;
//     * X22 each dimension blocks on its own: no layer manufactures another;
//     * X23 a source that moved after preparation blocks it;
//     * X24 an external share reaches AUTHORIZED_FOR_DELIVERY and claims no
//           delivery, with no storage handle anywhere;
//     * X25 the commit is durably idempotent and a reused id conflicts;
//
//   the Public bridge
//     * X26 a Public package prepares the bounded artifact under the CANONICAL
//           Public runtime, with the RESERVED form and no public body;
//     * X27 the canonical Public authority derivation reaches the Replay required
//           set THROUGH the bridge;
//     * X28 an unbridged REPLAY_ARTIFACT item fails the canonical Public
//           authority closed rather than requiring nobody;
//     * X29 ONE human consent act writes BOTH immutable evidence rows;
//     * X30 the Public publish goes through the canonical boundary and still
//           needs the canonical Public CW2-08 prerequisite;
//     * X31 the artifact resolver serves the sanitized descriptor to an admitted
//           viewer and exposes no internal identity;
//     * X32 an Experience that is not publicly visible serves nothing, and no
//           Replay distribution state resurrects it;
//     * X33 a Public viewer gains no source access and no Replay creation
//           authority from the artifact;
//
//   concurrency, on committed state across two connections
//     * C01 a withdrawal racing the distribution commit blocks the stale one;
//     * C02 a source change racing the distribution commit blocks the stale one;
//     * C03 two competing distribution commands converge on ONE winner;
//
// Every scenario reports INDEPENDENTLY through the permanent aggregator and the
// run fails ONCE at the end naming all of them.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createReplayDistributionRuntime, D, DFN, DESTINATIONS, SANITIZED_POLICY,
  runVerifier, APP_ROLES, R, V, T,
} from './replay-distribution-verifier-support.mjs';

const rt = createReplayDistributionRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const PURE = [DFN.DESCRIPTOR_DIGEST, DFN.FINGERPRINT];
const DERIVATIONS = [DFN.ANALYTICAL_SEAM, DFN.PREREQUISITE_SEAM, DFN.DESCRIPTOR, DFN.APPROVERS,
  DFN.AUTHORITY, DFN.APPROVAL_STATE, DFN.EFFECTIVE];
const MUTATING = [DFN.BRIDGE, DFN.PREPARE, DFN.APPROVE, DFN.WITHDRAW, DFN.AUTHORIZE];
const RESOLVERS = [DFN.PACKAGE_RESOLVER, DFN.PUBLIC_RESOLVER];
const COMMAND_TABLES = [D.PREPARE_COMMANDS, D.WITHDRAWAL_COMMANDS, D.AUTHORIZATION_COMMANDS];
/** Every relation whose row count must be unchanged by a package preparation. */
const AUDIENCE_RELATIONS = [T.PUBLICATION_STATE, T.PUBLISH_COMMANDS, D.AUTHORIZATIONS,
  D.AUTHORIZATION_COMMANDS];

const seamsOf = () => Promise.all([
  rt.captureSeamDefinition(DFN.ANALYTICAL_SEAM,
    { expect: ['UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'], forbid: ['RESOLVED_EXACT_HUMAN_REQUIREMENT'] }),
  rt.captureSeamDefinition(DFN.PREREQUISITE_SEAM,
    { expect: ['NOT_EVALUATED'], forbid: ['SAFETY_ALLOW', "'CLEARED'"] }),
]);

async function audienceCounts() {
  const counts = {};
  for (const table of AUDIENCE_RELATIONS) {
    counts[table] = Number((await rows(`SELECT count(*) n FROM ${table}`))[0].n);
  }
  return counts;
}

// ---------------------------------------------------------------- 1. catalog
async function verifyCatalog() {
  await asRole('postgres');
  await rt.verifyPosture({
    internal: [...DERIVATIONS, ...MUTATING],
    mutating: MUTATING,
    reading: DERIVATIONS,
    tables: COMMAND_TABLES,
    immutable: [],
  });
  for (const fn of PURE) {
    const p = await rt.functionPosture(fn);
    assert.equal(p.owner, 'postgres', `${fn} is postgres-owned`);
    assert.equal(p.volatility, 'i', `${fn} is IMMUTABLE, or one truth could digest differently`);
    assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'),
      `${fn} pins an empty search_path`);
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await rt.canExecute(role, fn), false, `${role} must not execute ${fn}`);
    }
  }
  // THE TWO READ BOUNDARIES: service_role only, bounded, and disclosure-checked
  // by their DECLARED result columns.
  for (const fn of RESOLVERS) {
    const p = await rt.functionPosture(fn);
    assert.equal(p.owner, 'postgres', `${fn} is postgres-owned`);
    assert.equal(p.secdef, true, `${fn} is SECURITY DEFINER`);
    assert.equal(p.volatility, 's', `${fn} is STABLE`);
    for (const role of ['public', 'anon', 'authenticated']) {
      assert.equal(await rt.canExecute(role, fn), false, `${role} must not execute ${fn}`);
    }
    assert.equal(await rt.canExecute('service_role', fn), true, `service_role executes ${fn}`);
    assert.ok(!p.prosrc.includes('publication_package_item_provenance'),
      `${fn} never reads the sealed Public provenance`);
  }
  const packageColumns = await rt.resultColumns(DFN.PACKAGE_RESOLVER);
  assert.ok(packageColumns.length > 0, 'the package resolver declares result columns');
  for (const column of packageColumns) {
    assert.doesNotMatch(column, /user_id|session|shared_|material|history_item|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|experience|approver_user|basis|reason/u,
      `the package resolver must not return ${column}`);
  }
  const publicColumns = await rt.resultColumns(DFN.PUBLIC_RESOLVER);
  assert.ok(publicColumns.length > 0, 'the Public Replay artifact resolver declares result columns');
  for (const column of publicColumns) {
    assert.doesNotMatch(column, /user_id|session|shared_|material|history_item|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|replay|manifest|selection|render_contract|distribution/u,
      `the Public Replay artifact resolver must not return ${column}`);
  }
  // THE CANONICAL PUBLIC AUTHORITY DERIVATION kept every rule it had and gained
  // the reserved branch: extended additively, never duplicated.
  const publicAuthority = await rt.functionPosture(DFN.PUBLIC_AUTHORITY);
  for (const needle of ['manifest.intended_publication_action', "availability_state <> 'AVAILABLE'",
    'availability_revision <> p.captured_availability_revision', 'captured_source_digest',
    'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED', 'shared_world_material_historical_authority',
    'replay_public_distribution_artifacts', 'replay_distribution_required_approvers', 'REPLAY_ARTIFACT']) {
    assert.ok(publicAuthority.prosrc.includes(needle),
      `the extended canonical Public authority derivation keeps or gains: ${needle}`);
  }
  assert.ok(!publicAuthority.prosrc.includes('PREPARE_PUBLICATION'),
    'a preparation command is never publication consent');
  for (const role of ['public', ...APP_ROLES]) {
    assert.equal(await rt.canExecute(role, DFN.PUBLIC_AUTHORITY), false,
      `${role} must not execute the canonical Public authority derivation`);
  }
  // AND THE FROZEN CW2-08 PUBLIC SEAM IS STILL FAIL-CLOSED.
  assert.ok((await rt.functionPosture('public.resolve_public_publication_prerequisites_v1(uuid, uuid)'))
    .prosrc.includes('NOT_EVALUATED'),
  'the frozen CW2-08 Public prerequisite seam still answers NOT_EVALUATED');
}

// -------------------------------------------------- 2. the fail-closed truth
async function verifyFailClosed(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('X02 the analytical authority seam answers unresolved and names no approver', async () => {
      const [answer] = await rt.analyticalAuthority(base.projection);
      assert.equal(answer.resolution_state, 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
        'X02 the canonical unresolved state, not an empty requirement');
      assert.equal(answer.required_approvers, null, 'X02 and it names nobody at all');
      assert.ok(String(answer.resolution_basis).length > 0, 'X02 with a stated basis');
    });

    await report.isolated('X03 the CW2-08 prerequisite seam answers NOT_EVALUATED on every dimension', async () => {
      const [gate] = await rt.distributionPrerequisites(randomUUID(), 'SHARE_EXTERNALLY');
      for (const dimension of ['clearance', 'safety_state', 'moderation_state', 'entitlement_state',
        'feature_state', 'launch_state']) {
        assert.equal(gate[dimension], 'NOT_EVALUATED', `X03 ${dimension} is unevaluated, never positive`);
      }
      assert.ok(String(gate.clearance_basis).length > 0, 'X03 with a stated basis');
    });

    await report.isolated('X01 production package preparation fails closed on unresolved analytical authority', async () => {
      const before = await rt.versionSnapshot(base.replay);
      await actAs(f.creator);
      const spec = rt.freshPackage(base.replay, base.version, 'SHARE_EXTERNALLY');
      await rejected(() => rt.prepare(spec), ['55000'],
        /REPLAY_DISTRIBUTION_ANALYTICAL_AUTHORITY_UNRESOLVED/u);
      await asRole('postgres');
      assert.equal(await count(D.PACKAGES, 'replay_id = $1', [base.replay]), 0,
        'X01 no distribution package survives the refusal');
      assert.equal(await count(D.PREPARE_COMMANDS, 'replay_id = $1', [base.replay]), 0,
        'X01 and no command history either: a refused command keeps nothing it wrote');
      const after = await rt.versionSnapshot(base.replay);
      assert.deepEqual(after.versions, before.versions,
        'X01 the Replay Version it could not distribute is exactly as it was');
      assert.deepEqual(after.finalizations, before.finalizations,
        'X01 and it stays historically finalized');
    });

    await report.isolated('X04 no application role can execute any I-06C primitive', async () => {
      for (const fn of [...PURE, ...DERIVATIONS, ...MUTATING]) {
        for (const role of ['public', ...APP_ROLES]) {
          assert.equal(await rt.canExecute(role, fn), false, `X04 ${role} cannot execute ${fn}`);
        }
      }
    });

    await report.isolated('X34 no caller can author the required set, the approval principal or a clearance', async () => {
      const inputs = async (fn) => (await rt.inputParameters(fn));
      for (const fn of MUTATING) {
        for (const name of await inputs(fn)) {
          assert.doesNotMatch(name, /(actor|creator|owner|_user_id|approver|authority|audience|safety|moderation|entitle|launch|clearance|feature|fingerprint|digest|descriptor|sanitiz|required|resolution)/u,
            `X34 ${fn} may not accept ${name}`);
        }
      }
      // And a direct write into the required set or the approvals is blocked for
      // every application role, so there is no path around the derivation.
      for (const role of APP_ROLES) {
        for (const table of [D.REQUIRED, D.APPROVALS, D.AUTHORIZATIONS]) {
          const [{ writable }] = await rows(
            `SELECT bool_or(has_table_privilege($1, $2::regclass, p)) writable
               FROM unnest(ARRAY['INSERT','UPDATE','DELETE']) p`, [role, table]);
          assert.equal(writable, false, `X34 ${role} cannot write ${table} directly`);
        }
      }
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------ 3. preparation
async function verifyPreparation(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    // THE SIMULATED PREDECESSOR, inside this transaction only. Everything below
    // reaches past the analytical seam the way a later reviewed subject-authority
    // resolver would, and the ROLLBACK at the end puts the production seam back.
    await rt.simulateAnalyticalAuthority([]);

    await report.isolated('X05 a prepared package binds the exact finalized version and widens no audience', async () => {
      const before = await audienceCounts();
      await actAs(f.creator);
      const spec = rt.freshPackage(base.replay, base.version, 'SHARE_EXTERNALLY');
      const [prepared] = await rt.prepare(spec);
      assert.equal(prepared.outcome, 'REPLAY_DISTRIBUTION_PACKAGE_PREPARED');
      assert.equal(prepared.destination_action, 'SHARE_EXTERNALLY');
      assert.equal(prepared.authority_requirement_state, 'RESOLVED_EXACT_HUMAN_REQUIREMENT');
      assert.equal(Number(prepared.required_approver_count), 1,
        'X05 the creator is the exact human material authority of their own selected segments');
      assert.match(prepared.audience_safe_reference, /^rdx1_[0-9a-f]{32}$/u,
        'X05 the audience reference is opaque and in its own shape');
      await asRole('postgres');
      const [row] = await rows(`SELECT * FROM ${D.PACKAGES} WHERE id = $1`, [spec.package]);
      assert.equal(row.replay_version_id, base.version, 'X05 the exact Replay Version is bound');
      assert.equal(row.source_class, 'MY_WORLD', 'X05 read from the manifest, never declared');
      assert.match(row.authority_request_fingerprint, /^sha256:[0-9a-f]{64}$/u);
      assert.deepEqual(await audienceCounts(), before,
        'X05 preparing a package publishes nothing, authorizes nothing and widens no audience');
    });

    await report.isolated('X06 a Replay Version that was never finalized cannot be prepared', async () => {
      await actAs(f.creator);
      const [reopened] = await rt.reopen({ command: randomUUID(), replay: base.replay, version: base.version });
      assert.equal(reopened.outcome, 'REPLAY_REOPENED_FOR_REVISION');
      const next = rt.freshPreview(base.replay, 1);
      const [previewed] = await rt.preview(next);
      assert.equal(previewed.outcome, 'REPLAY_PREVIEW_READY', 'X06 a second version exists but is not finalized');
      await rejected(() => rt.prepare(rt.freshPackage(base.replay, next.version, 'DOWNLOAD')),
        ['55000'], /REPLAY_DISTRIBUTION_VERSION_NOT_FINALIZED/u);
      // And the version that WAS finalized is still preparable while the stable
      // Replay is being revised.
      const [prepared] = await rt.prepare(rt.freshPackage(base.replay, base.version, 'DOWNLOAD'));
      assert.equal(prepared.outcome, 'REPLAY_DISTRIBUTION_PACKAGE_PREPARED',
        'X06 a previously finalized version stays distributable through a revision');
    });

    await report.isolated('X07 a stranger and a nonexistent Replay reach ONE bounded class', async () => {
      await actAs(f.stranger);
      const mine = await rejected(() => rt.prepare(rt.freshPackage(base.replay, base.version, 'DOWNLOAD')),
        ['P0002'], /REPLAY_DISTRIBUTION_NOT_AVAILABLE/u);
      const absent = await rejected(
        () => rt.prepare(rt.freshPackage(randomUUID(), randomUUID(), 'DOWNLOAD')),
        ['P0002'], /REPLAY_DISTRIBUTION_NOT_AVAILABLE/u);
      assert.equal(mine.code, absent.code,
        'X07 another human Replay and a Replay that does not exist are indistinguishable');
      assert.doesNotMatch(mine.message, /session|unit|manifest|approver/iu,
        'X07 and the refusal names no private identity');
    });

    await report.isolated('X08 the required approver set is derived and membership adds nobody', async () => {
      await asRole('postgres');
      const [derived] = await rt.requiredApprovers(base.version);
      assert.deepEqual(derived.required_approvers, [f.creator],
        'X08 the exact human material authority of the included segments, and nobody else');
      assert.equal(derived.analytical_authority_resolution, 'RESOLVED_NO_HUMAN_REQUIREMENT',
        'X08 the simulated analytical predecessor genuinely resolved to an empty requirement');
      // A Shared World member of an unrelated World contributes nothing: the
      // derivation reads no membership relation at all.
      const posture = await rt.functionPosture(DFN.APPROVERS);
      for (const forbidden of ['shared_world_membership_episodes', 'public_experience_controllers',
        'shared_world_history_access_grants']) {
        assert.ok(!posture.prosrc.includes(forbidden),
          `X08 the derivation reads no ${forbidden}: membership is not distribution authority`);
      }
    });

    await report.isolated('X09 QANDEEL-authored Personal material fails the source authority closed', async () => {
      // A second Replay over the SAME Session whose selection includes the
      // ASSISTANT-authored committed unit at a sealed position.
      await actAs(f.creator);
      const other = randomUUID();
      const [created] = await rt.createDraft({
        command: randomUUID(), replay: other, manifest: randomUUID(), selection: randomUUID(),
        sourceClass: 'MY_WORLD', context: base.session,
        items: [base.units[0], base.units[1]],
      });
      assert.equal(created.outcome, 'REPLAY_DRAFT_CREATED');
      const preview = rt.freshPreview(other, 1);
      await rt.preview(preview);
      const [finalized] = await rt.finalize({ command: randomUUID(), replay: other, version: preview.version });
      assert.equal(finalized.outcome, 'REPLAY_VERSION_FINALIZED',
        'X09 a Replay carrying QANDEEL-authored Personal material finalizes perfectly well');
      await rejected(() => rt.prepare(rt.freshPackage(other, preview.version, 'DOWNLOAD')),
        ['55000'], /REPLAY_DISTRIBUTION_SOURCE_AUTHORITY_UNRESOLVED/u);
      await asRole('postgres');
      assert.equal(await count(D.PACKAGES, 'replay_id = $1', [other]), 0,
        'X09 and it is DISTRIBUTION that fails closed, never creation or finalization');
    });

    await report.isolated('X10 a bound source that moved blocks preparation', async () => {
      await asRole('postgres');
      await q("SET LOCAL session_replication_role = 'replica'");
      await q(`UPDATE public.conversation_units
                  SET committed_text = overlay(committed_text placing 'Z' from 1 for 1)
                WHERE id = $1`, [base.selectedUnits[0]]);
      await q("SET LOCAL session_replication_role = 'origin'");
      await actAs(f.creator);
      await rejected(() => rt.prepare(rt.freshPackage(base.replay, base.version, 'DOWNLOAD')),
        ['40001'], /REPLAY_SOURCE_STALE/u);
    });

    await report.isolated('X11 the sanitized descriptor is the whole audience-visible surface', async () => {
      await actAs(f.creator);
      const spec = rt.freshPackage(base.replay, base.version, 'SHARE_EXTERNALLY');
      const [prepared] = await rt.prepare(spec);
      await asRole('postgres');
      const [descriptor] = await rows(
        `SELECT * FROM ${D.DESCRIPTORS} WHERE distribution_package_version_id = $1`, [spec.package]);
      for (const [column, value] of Object.entries(SANITIZED_POLICY)) {
        assert.equal(descriptor[column], value, `X11 the descriptor declares the exact ${column}`);
      }
      assert.equal(descriptor.coverage_class, 'SELECTED_EXCERPT', 'X11 the real coverage class');
      assert.equal(Number(descriptor.selected_segment_count), 2, 'X11 the real segment count');
      assert.equal(Number(descriptor.temporal_gap_count), 1,
        'X11 and the REAL gap count, so the number is derived rather than a constant');
      assert.equal(descriptor.audience_safe_reference, prepared.audience_safe_reference);
      assert.match(descriptor.descriptor_digest, /^sha256:[0-9a-f]{64}$/u);
      // IT IS DETERMINISTIC: re-deriving over the same immutable version and the
      // same reference reproduces the digest exactly.
      const [again] = await rt.exportDescriptor(base.version, 'SHARE_EXTERNALLY',
        prepared.audience_safe_reference);
      assert.equal(again.descriptor_digest, descriptor.descriptor_digest,
        'X11 the sanitized surface is deterministic, so an approval and an export cannot differ');
      // AND A DIFFERENT DESTINATION IS A DIFFERENT SURFACE.
      const [download] = await rt.exportDescriptor(base.version, 'DOWNLOAD',
        prepared.audience_safe_reference);
      assert.notEqual(download.descriptor_digest, descriptor.descriptor_digest,
        'X11 the destination is part of the sanitized identity');
    });

    await report.isolated('X12 a second destination is a NEW package with its own authority identity', async () => {
      await actAs(f.creator);
      const share = rt.freshPackage(base.replay, base.version, 'SHARE_EXTERNALLY');
      const download = rt.freshPackage(base.replay, base.version, 'DOWNLOAD');
      await rt.prepare(share);
      await rt.prepare(download);
      await asRole('postgres');
      const [a] = await rows(`SELECT * FROM ${D.PACKAGES} WHERE id = $1`, [share.package]);
      const [b] = await rows(`SELECT * FROM ${D.PACKAGES} WHERE id = $1`, [download.package]);
      assert.notEqual(a.authority_request_fingerprint, b.authority_request_fingerprint,
        'X12 the destination is inside the authority identity, so one consent can never cover both');
      assert.notEqual(a.audience_safe_reference, b.audience_safe_reference,
        'X12 and each carries its own opaque audience reference');
      assert.equal(Number(b.package_revision), Number(a.package_revision) + 1,
        'X12 package revisions advance per Replay');
    });

    await report.isolated('X13 preparation is durably idempotent and a reused command id conflicts', async () => {
      await actAs(f.creator);
      const spec = rt.freshPackage(base.replay, base.version, 'DOWNLOAD');
      const [first] = await rt.prepare(spec);
      const [retry] = await rt.prepare(spec);
      assert.equal(retry.outcome, 'ALREADY_COMMITTED', 'X13 an equivalent retry answers from history');
      assert.equal(retry.distribution_package_version_id, first.distribution_package_version_id);
      assert.equal(retry.audience_safe_reference, first.audience_safe_reference,
        'X13 and returns the ORIGINAL committed answer rather than minting a new reference');
      await rejected(() => rt.prepare({ ...spec, destination: 'SHARE_EXTERNALLY', package: randomUUID() }),
        ['23505'], /REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT/u);
      await asRole('postgres');
      assert.equal(await count(D.PREPARE_COMMANDS, 'id = $1', [spec.command]), 1,
        'X13 exactly one command row exists for one command identity');
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('the production analytical seam is restored after the rolled-back preparation section',
    async () => {
      await asRole('postgres');
      const [analytical] = await seamsOf();
      assert.ok(analytical.prosrc.includes('UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'),
        'the production analytical seam is back and still fails closed');
    });
}

// ----------------------------------------------- 4. consent, and its taking back
async function verifyConsent(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await rt.simulateAnalyticalAuthority([]);
    await actAs(f.creator);
    const spec = rt.freshPackage(base.replay, base.version, 'SHARE_EXTERNALLY');
    await rt.prepare(spec);
    const other = rt.freshPackage(base.replay, base.version, 'DOWNLOAD');
    await rt.prepare(other);
    await asRole('postgres');

    await report.isolated('X14 the required human approves the exact package through auth.uid()', async () => {
      await actAs(f.creator);
      const approval = randomUUID();
      const [approved] = await rt.approve({ approval, package: spec.package });
      assert.equal(approved.outcome, 'REPLAY_DISTRIBUTION_APPROVED');
      assert.equal(approved.approving_user_id, f.creator,
        'X14 the approver is the session human, never a parameter');
      assert.match(approved.bound_authority_fingerprint, /^sha256:[0-9a-f]{64}$/u);
      const [retry] = await rt.approve({ approval, package: spec.package });
      assert.equal(retry.outcome, 'ALREADY_APPROVED', 'X14 an approval is its own durable record');
      await asRole('postgres');
      const [row] = await rows(`SELECT * FROM ${D.APPROVALS} WHERE id = $1`, [approval]);
      assert.equal(row.destination_action, 'SHARE_EXTERNALLY',
        'X14 and it binds the exact destination of its exact package');
    });

    await report.isolated('X15 a human the package does not require reaches the bounded class', async () => {
      await actAs(f.stranger);
      const refused = await rejected(() => rt.approve({ approval: randomUUID(), package: spec.package }),
        ['P0002'], /REPLAY_DISTRIBUTION_NOT_AVAILABLE/u);
      const absent = await rejected(() => rt.approve({ approval: randomUUID(), package: randomUUID() }),
        ['P0002'], /REPLAY_DISTRIBUTION_NOT_AVAILABLE/u);
      assert.equal(refused.code, absent.code,
        'X15 a package that is not yours and a package that does not exist answer identically');
    });

    await report.isolated('X16 an approval cannot float to another package or another destination', async () => {
      await actAs(f.creator);
      const approval = randomUUID();
      await rt.approve({ approval, package: spec.package });
      await rejected(() => rt.approve({ approval, package: other.package }),
        ['23505'], /REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT/u);
      await asRole('postgres');
      assert.equal(await count(D.APPROVALS, 'distribution_package_version_id = $1', [other.package]), 0,
        'X16 the DOWNLOAD package still carries no approval at all');
      const [share] = await rows(`SELECT authority_request_fingerprint fp FROM ${D.PACKAGES} WHERE id = $1`, [spec.package]);
      const [download] = await rows(`SELECT authority_request_fingerprint fp FROM ${D.PACKAGES} WHERE id = $1`, [other.package]);
      assert.notEqual(share.fp, download.fp,
        'X16 and the two authority identities differ, so one consent can never satisfy the other');
    });

    await report.isolated('X17 withdrawal is append-only, own-approval only and idempotent', async () => {
      await actAs(f.creator);
      const approval = randomUUID();
      await rt.approve({ approval, package: spec.package });
      await asRole('postgres');
      const [before] = await rows(`SELECT * FROM ${D.APPROVALS} WHERE id = $1`, [approval]);
      await actAs(f.stranger);
      await rejected(() => rt.withdraw({ command: randomUUID(), approval }),
        ['P0002'], /REPLAY_DISTRIBUTION_NOT_AVAILABLE/u);
      await actAs(f.creator);
      const [withdrawn] = await rt.withdraw({ command: randomUUID(), approval });
      assert.equal(withdrawn.outcome, 'REPLAY_DISTRIBUTION_APPROVAL_WITHDRAWN');
      assert.equal(withdrawn.effective_state, 'WITHDRAWN');
      const [again] = await rt.withdraw({ command: randomUUID(), approval });
      assert.equal(again.outcome, 'ALREADY_WITHDRAWN', 'X17 a repeated withdrawal is not a second event');
      await asRole('postgres');
      const [after] = await rows(`SELECT * FROM ${D.APPROVALS} WHERE id = $1`, [approval]);
      assert.deepEqual(after, before, 'X17 the historical approval row is byte-identical afterwards');
      assert.equal(await count(D.WITHDRAWALS, 'approval_id = $1', [approval]), 1,
        'X17 exactly one effective withdrawal exists, forever');
    });

    await report.isolated('X18 MISSING WITHDRAWN and EFFECTIVE are each derived, never counted', async () => {
      await asRole('postgres');
      const missing = await rt.effectiveApprovals(other.package);
      assert.equal(missing.length, 1, 'X18 one required human');
      assert.equal(missing[0].effective_state, 'MISSING',
        'X18 a required human who never approved is MISSING rather than absent from the answer');
      await actAs(f.creator);
      const approval = randomUUID();
      await rt.approve({ approval, package: other.package });
      await asRole('postgres');
      const [effective] = await rt.effectiveApprovals(other.package);
      assert.equal(effective.effective_state, 'EFFECTIVE');
      await actAs(f.creator);
      await rt.withdraw({ command: randomUUID(), approval });
      await asRole('postgres');
      const [gone] = await rt.effectiveApprovals(other.package);
      assert.equal(gone.effective_state, 'WITHDRAWN',
        'X18 and the historical evidence still exists while the consent no longer does');
      assert.equal((await rt.approvalState(randomUUID())).length, 0,
        'X18 an approval that does not exist answers with zero rows, never an error');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------- 5. the distribution commit
async function verifyDistribution(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await rt.simulateAnalyticalAuthority([]);
    await actAs(f.creator);
    const spec = rt.freshPackage(base.replay, base.version, 'SHARE_EXTERNALLY');
    await rt.prepare(spec);
    const approval = randomUUID();
    await rt.approve({ approval, package: spec.package });
    await asRole('postgres');

    await report.isolated('X19 a missing approval blocks the distribution', async () => {
      await actAs(f.creator);
      const bare = rt.freshPackage(base.replay, base.version, 'DOWNLOAD');
      await rt.prepare(bare);
      await rt.simulateDistributionPrerequisites();
      await rejected(() => rt.authorize({ command: randomUUID(), package: bare.package }),
        ['P0002'], /REPLAY_DISTRIBUTION_APPROVALS_INCOMPLETE/u);
    });

    await report.isolated('X20 a withdrawn approval blocks the distribution', async () => {
      await rt.simulateDistributionPrerequisites();
      await actAs(f.creator);
      await rt.withdraw({ command: randomUUID(), approval });
      await rejected(() => rt.authorize({ command: randomUUID(), package: spec.package }),
        ['55000'], /REPLAY_DISTRIBUTION_APPROVAL_NOT_EFFECTIVE/u);
    });

    await report.isolated('X21 an unevaluated CW2-08 prerequisite blocks the distribution, seam last', async () => {
      await actAs(f.creator);
      await rejected(() => rt.authorize({ command: randomUUID(), package: spec.package }),
        ['55000'], /REPLAY_DISTRIBUTION_PREREQUISITE_UNRESOLVED/u);
      await asRole('postgres');
      assert.equal(await count(D.AUTHORIZATIONS, 'distribution_package_version_id = $1', [spec.package]), 0,
        'X21 and the refusal leaves no authorization record at all');
    });

    await report.isolated('X22 each CW2-08 dimension blocks on its own: no layer manufactures another', async () => {
      for (const [dimension, negative] of [['safety_state', 'SAFETY_DENY'],
        ['moderation_state', 'MODERATION_DENY'], ['entitlement_state', 'NOT_ENTITLED'],
        ['feature_state', 'FEATURE_DISABLED'], ['launch_state', 'LAUNCH_BLOCKED'],
        ['clearance', 'NOT_CLEARED']]) {
        await rt.simulateDistributionPrerequisites({ [dimension]: negative });
        await actAs(f.creator);
        await rejected(() => rt.authorize({ command: randomUUID(), package: spec.package }),
          ['55000'], /REPLAY_DISTRIBUTION_PREREQUISITE_UNRESOLVED/u);
        await asRole('postgres');
      }
      // ALL HUMAN AUTHORITY SATISFIED plus every dimension positive is the ONLY
      // combination that commits, which the next scenario proves.
    });

    await report.isolated('X24 an external share reaches AUTHORIZED_FOR_DELIVERY and claims no delivery', async () => {
      await rt.simulateDistributionPrerequisites();
      await actAs(f.creator);
      const command = randomUUID();
      const [authorized] = await rt.authorize({ command, package: spec.package });
      assert.equal(authorized.outcome, 'REPLAY_DISTRIBUTION_AUTHORIZED');
      assert.equal(authorized.distribution_state, 'AUTHORIZED_FOR_DELIVERY',
        'X24 with no transport boundary nothing claims DELIVERED, SHARED or DOWNLOADED');
      await asRole('postgres');
      const [record] = await rows(
        `SELECT * FROM ${D.AUTHORIZATIONS} WHERE distribution_package_version_id = $1`, [spec.package]);
      assert.equal(record.published_experience_version_id, null,
        'X24 an external destination names no Public publication');
      assert.ok(String(record.prerequisite_clearance_basis).includes('VERIFIER PROBE'),
        'X24 the recorded basis is exactly what the seam answered, never a fabricated constant');
      const columns = await rows(
        `SELECT a.attname FROM pg_attribute a WHERE a.attrelid = $1::regclass
          AND a.attnum > 0 AND NOT a.attisdropped`, [D.AUTHORIZATIONS]);
      for (const { attname } of columns) {
        assert.doesNotMatch(attname, /(url|uri|path|filename|object_key|bucket|storage|delivered|downloaded)/u,
          `X24 no storage handle or delivery claim exists: ${attname}`);
      }
      // AND IT IS DURABLY IDEMPOTENT.
      await actAs(f.creator);
      const [retry] = await rt.authorize({ command, package: spec.package });
      assert.equal(retry.outcome, 'ALREADY_COMMITTED', 'X25 an equivalent retry answers from history');
      assert.equal(retry.distribution_state, 'AUTHORIZED_FOR_DELIVERY');
      await rejected(() => rt.authorize({ command, package: randomUUID() }),
        ['23505'], /REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT/u);
    });

    await report.isolated('X23 a source that moved after preparation blocks the distribution', async () => {
      await rt.simulateDistributionPrerequisites();
      await asRole('postgres');
      await q("SET LOCAL session_replication_role = 'replica'");
      await q(`UPDATE public.conversation_units
                  SET committed_text = overlay(committed_text placing 'Q' from 1 for 1)
                WHERE id = $1`, [base.selectedUnits[1]]);
      await q("SET LOCAL session_replication_role = 'origin'");
      await actAs(f.creator);
      await rejected(() => rt.authorize({ command: randomUUID(), package: spec.package }),
        ['40001'], /REPLAY_SOURCE_STALE/u);
      await asRole('postgres');
      assert.equal(await count(D.AUTHORIZATIONS, 'distribution_package_version_id = $1', [spec.package]), 0,
        'X23 and nothing was authorized over the source that moved');
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('both production seams are restored after the rolled-back distribution section',
    async () => {
      await asRole('postgres');
      const [analytical, gate] = await seamsOf();
      assert.ok(analytical.prosrc.includes('UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'));
      assert.ok(gate.prosrc.includes('NOT_EVALUATED'));
    });
}

// ---------------------------------------------------------- 6. the Public bridge
async function verifyPublicBridge(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await rt.simulateAnalyticalAuthority([]);
    await actAs(f.creator);
    const spec = { ...rt.freshPackage(base.replay, base.version, 'PUBLISH_TO_PUBLIC_WORLD'),
      ...rt.freshPublic(f.experience) };
    const [prepared] = await rt.prepare(spec);
    await asRole('postgres');

    await report.isolated('X26 a Public package prepares the bounded artifact under the canonical runtime', async () => {
      assert.equal(prepared.outcome, 'REPLAY_DISTRIBUTION_PACKAGE_PREPARED');
      const [item] = await rows(`SELECT * FROM ${T.ITEMS} WHERE package_item_id = $1`, [spec.publicItem]);
      assert.equal(item.public_body_form, 'RESERVED',
        'X26 the reserved public body form, activated explicitly');
      assert.equal(item.derivative_classification, 'SOURCE_CONTENT_BEARING_DERIVATIVE');
      assert.equal(await count(T.BODIES, 'package_item_id = $1', [spec.publicItem]), 0,
        'X26 and there is no public body row at all: a Replay artifact is not public text');
      const [provenance] = await rows(`SELECT * FROM ${T.PROVENANCE} WHERE package_item_id = $1`, [spec.publicItem]);
      assert.equal(provenance.source_class, 'REPLAY_ARTIFACT');
      for (const column of ['personal_conversation_unit_id', 'personal_owner_user_id', 'shared_world_id',
        'shared_material_id', 'shared_history_item_id', 'captured_availability_revision']) {
        assert.equal(provenance[column], null,
          `X26 the reserved provenance shape names no private source: ${column}`);
      }
      const [bridge] = await rows(`SELECT * FROM ${D.ARTIFACTS} WHERE package_item_id = $1`, [spec.publicItem]);
      assert.equal(bridge.distribution_package_version_id, spec.package);
      assert.equal(bridge.replay_version_id, base.version);
      const [experience] = await rows(`SELECT current_lifecycle FROM ${T.EXPERIENCES} WHERE id = $1`, [f.experience]);
      assert.equal(experience.current_lifecycle, 'DRAFT',
        'X26 preparing widened no audience: the Experience is still a DRAFT');
    });

    await report.isolated('X27 the canonical Public authority derivation reaches the Replay required set', async () => {
      const [authority] = await rows(
        'SELECT * FROM public.derive_public_publication_authority_v1($1)', [spec.publicManifest]);
      assert.deepEqual(authority.required_approvers, [f.creator],
        'X27 the Public rightsholder set IS the Replay required set, through the bridge');
      assert.equal(Number(authority.required_approver_count), 1);
      const stored = (await rows(
        `SELECT approver_user_id a FROM ${T.REQUIRED} WHERE manifest_version_id = $1 ORDER BY 1`,
        [spec.publicManifest])).map((r) => r.a);
      assert.deepEqual(stored, [f.creator],
        'X27 and the stored canonical rightsholder set agrees with the derivation');
    });

    await report.isolated('X28 an unbridged REPLAY_ARTIFACT item fails the canonical Public authority closed', async () => {
      // The reserved class WITHOUT a Replay binding: exactly the shape that
      // existed before this slice, and exactly the shape that must never read as
      // requiring nobody.
      const orphanManifest = randomUUID();
      const orphanVersion = randomUUID();
      const orphanItem = randomUUID();
      await q(`INSERT INTO ${T.MANIFESTS} (id, experience_id, public_world_singleton,
                 publisher_public_identity_ref, publisher_user_id, intended_publication_action,
                 target_audience_class, authority_readiness, prepared_authority_snapshot_version,
                 item_count, created_at)
               SELECT $1, $2, true, c.controller_public_identity_ref, c.controller_user_id,
                      'PUBLISH_TO_PUBLIC_WORLD', 'PUBLIC_WORLD_AUDIENCE', 'PRIVACY_OWNERSHIP_AUTHORITY_ONLY',
                      w.state_version, 1, clock_timestamp()
                 FROM public.public_experience_controllers c, public.public_world_state w
                WHERE c.experience_id = $2 AND w.singleton`, [orphanManifest, f.experience]);
      await q(`INSERT INTO ${T.VERSIONS} (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
               SELECT $1, $2, $3, coalesce(max(v.version_ordinal), 0) + 1, clock_timestamp()
                 FROM ${T.VERSIONS} v WHERE v.experience_id = $2`, [orphanVersion, f.experience, orphanManifest]);
      await q(`INSERT INTO ${T.ITEMS} (manifest_version_id, experience_id, package_item_id, item_ordinal,
                 derivative_classification, public_body_form, public_body_digest)
               VALUES ($1, $2, $3, 1, 'SOURCE_CONTENT_BEARING_DERIVATIVE', 'RESERVED', $4)`,
      [orphanManifest, f.experience, orphanItem, `sha256:${'9'.repeat(64)}`]);
      await q(`INSERT INTO ${T.PROVENANCE} (package_item_id, manifest_version_id, source_class,
                 captured_availability_state, captured_source_digest)
               VALUES ($1, $2, 'REPLAY_ARTIFACT', 'AVAILABLE', $3)`,
      [orphanItem, orphanManifest, `sha256:${'9'.repeat(64)}`]);
      await rejected(
        () => rows('SELECT * FROM public.derive_public_publication_authority_v1($1)', [orphanManifest]),
        ['55000'], /PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u);
    });

    await report.isolated('X29 ONE human consent act writes BOTH immutable evidence rows', async () => {
      await actAs(f.creator);
      const approval = randomUUID();
      const publicApproval = randomUUID();
      const [approved] = await rt.approve({ approval, package: spec.package, publicApproval });
      assert.equal(approved.outcome, 'REPLAY_DISTRIBUTION_APPROVED');
      assert.equal(approved.linked_public_approval_id, publicApproval);
      await asRole('postgres');
      assert.equal(await count(D.APPROVALS, 'id = $1', [approval]), 1,
        'X29 the Replay evidence row exists');
      const [linked] = await rows(`SELECT * FROM ${T.APPROVALS} WHERE id = $1`, [publicApproval]);
      assert.equal(linked.approver_user_id, f.creator,
        'X29 and the canonical Public evidence row exists, for the SAME human');
      assert.equal(linked.manifest_version_id, spec.publicManifest);
      const [derived] = await rows(
        'SELECT authority_fingerprint fp FROM public.derive_public_publication_authority_v1($1)',
        [spec.publicManifest]);
      assert.equal(linked.bound_authority_fingerprint, derived.fp,
        'X29 bound to the CANONICAL Public authority fingerprint, never a fabricated one');
      // AND NEITHER SUBSYSTEM WAS BYPASSED: the canonical READY commit accepts it.
      await actAs(f.creator);
      const [ready] = await rows(
        'SELECT * FROM public.commit_public_experience_ready_for_review_v1($1, $2, $3)',
        [randomUUID(), f.experience, spec.publicVersion]);
      assert.equal(ready.outcome, 'READY_FOR_REVIEW',
        'X29 the canonical Public READY transition is satisfied by the one consent act');
    });

    await report.isolated('X30 the Public publish goes through the canonical boundary and its own prerequisite', async () => {
      await actAs(f.creator);
      await rt.approve({ approval: randomUUID(), package: spec.package, publicApproval: randomUUID() });
      await rows('SELECT * FROM public.commit_public_experience_ready_for_review_v1($1, $2, $3)',
        [randomUUID(), f.experience, spec.publicVersion]);
      await rt.simulateDistributionPrerequisites();
      // The I-06C seam clears; the CANONICAL Public one does not, and that alone
      // refuses the publication. A Replay can never shortcut around I-05B.
      await rejected(() => rt.authorize({ command: randomUUID(), package: spec.package,
        publicPublishCommand: randomUUID() }),
      ['55000'], /PUBLIC_EXPERIENCE_LAUNCH_PREREQUISITE_UNRESOLVED/u);
      await asRole('postgres');
      assert.equal(await count(D.AUTHORIZATIONS, 'distribution_package_version_id = $1', [spec.package]), 0);
      assert.equal(await count(T.PUBLICATION_STATE, 'experience_id = $1', [f.experience]), 0,
        'X30 and nothing was published');
    });

    await report.isolated('X31 the artifact resolver serves the sanitized descriptor to an admitted viewer', async () => {
      const seam = await rt.captureSeamDefinition('public.resolve_public_publication_prerequisites_v1(uuid, uuid)',
        { expect: ['NOT_EVALUATED'], forbid: ["'CLEARED'"] });
      await actAs(f.creator);
      await rt.approve({ approval: randomUUID(), package: spec.package, publicApproval: randomUUID() });
      await rows('SELECT * FROM public.commit_public_experience_ready_for_review_v1($1, $2, $3)',
        [randomUUID(), f.experience, spec.publicVersion]);
      await rt.simulateDistributionPrerequisites();
      await rt.clearPrerequisites();
      let authorized;
      try {
        await actAs(f.creator);
        [authorized] = await rt.authorize({ command: randomUUID(), package: spec.package,
          publicPublishCommand: randomUUID() });
      } finally {
        await asRole('postgres');
        await rt.restorePrerequisites(seam);
      }
      assert.equal(authorized.distribution_state, 'PUBLIC_PUBLICATION_COMMITTED');
      const [record] = await rows(
        `SELECT * FROM ${D.AUTHORIZATIONS} WHERE distribution_package_version_id = $1`, [spec.package]);
      assert.equal(record.published_experience_version_id, spec.publicVersion,
        'X31 the I-06C record BINDS the canonical Public publication rather than restating it');
      assert.equal(await count(T.PUBLICATION_STATE, 'experience_id = $1', [f.experience]), 1,
        'X31 and the canonical Public publication record is the ONE publication truth');
      // THE SANITIZED SURFACE, AND ONLY IT.
      const served = await rt.resolvePublicArtifact(prepared.audience_safe_reference, f.reader);
      assert.equal(served.length, 1, 'X31 an admitted viewer receives the artifact');
      assert.equal(served[0].audience_safe_reference, prepared.audience_safe_reference);
      assert.equal(served[0].public_experience_id, f.experience);
      assert.equal(served[0].coverage_class, 'SELECTED_EXCERPT');
      assert.equal(Number(served[0].temporal_gap_count), 1);
      for (const value of Object.values(served[0])) {
        for (const secret of [base.replay, base.version, base.manifest, base.session,
          ...base.selectedUnits, spec.package, spec.publicManifest, f.creator]) {
          assert.notEqual(String(value), String(secret),
            'X31 no internal identity of any kind reaches a Public viewer');
        }
      }
      // AND AN UNKNOWN REFERENCE ANSWERS EXACTLY AS AN INVISIBLE ONE DOES.
      assert.equal((await rt.resolvePublicArtifact(`rdx1_${randomUUID().replace(/-/gu, '')}`, f.reader)).length, 0,
        'X31 an unknown audience reference is not an existence oracle');
    });

    await report.isolated('X32 an Experience that is not publicly visible serves nothing', async () => {
      // Nothing above was published inside THIS savepoint, so the canonical
      // visibility derivation answers NOT_PUBLICLY_VISIBLE and the artifact
      // resolver serves nothing - Replay distribution state resurrects nothing.
      const [visibility] = await rt.visibility(f.experience);
      assert.equal(visibility.visibility_state, 'NOT_PUBLICLY_VISIBLE');
      assert.equal(await count(D.ARTIFACTS, 'distribution_package_version_id = $1', [spec.package]), 1,
        'X32 the Replay distribution artifact binding exists');
      assert.equal((await rt.resolvePublicArtifact(prepared.audience_safe_reference, f.reader)).length, 0,
        'X32 and it serves nothing while the Experience is not publicly visible');
    });

    await report.isolated('X33 a Public viewer gains no source access and no Replay creation authority', async () => {
      // The reader is admitted to Public World and controls nothing. I-06A already
      // requires exact Experience CONTROL for a Public-source Replay, and this
      // slice does not weaken it: the artifact reference grants neither.
      await actAs(f.reader);
      await rejected(() => rt.createDraft({
        command: randomUUID(), replay: randomUUID(), manifest: randomUUID(), selection: randomUUID(),
        sourceClass: 'PUBLIC_EXPERIENCE', context: f.experience, version: spec.publicVersion,
        items: [spec.publicItem],
      }), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
      // And the creator-exact boundaries answer a viewer with NOTHING rather than
      // with an error, which is the stronger anti-oracle behaviour.
      assert.equal((await rt.composition(base.replay, f.reader)).length, 0,
        'X33 the creator-exact composition boundary answers a viewer with nothing');
      assert.equal((await rt.resolvePackage(spec.package, f.reader)).length, 0,
        'X33 and so does the distribution package boundary');
      await asRole('postgres');
      assert.equal(await count(D.PACKAGES, 'replay_id <> $1', [base.replay]), 0,
        'X33 and no Replay was created from the Public artifact');
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('every production seam is restored after the rolled-back Public section',
    async () => {
      await asRole('postgres');
      const [analytical, gate] = await seamsOf();
      assert.ok(analytical.prosrc.includes('UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'));
      assert.ok(gate.prosrc.includes('NOT_EVALUATED'));
      const [{ prosrc }] = await rows(
        'SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        ['public.resolve_public_publication_prerequisites_v1(uuid, uuid)']);
      assert.ok(prosrc.includes('NOT_EVALUATED') && !prosrc.includes("'CLEARED'"),
        'the frozen CW2-08 Public seam is production again');
    });
}

// ------------------------------------------------------------ 7. concurrency
/**
 * Three real two-connection races over COMMITTED state.
 *
 * A race needs COMMITTED state, so both seams are simulated across the section
 * rather than inside a rolled-back transaction: the distribution commit
 * re-derives the required approver set through the analytical seam BEFORE it
 * reaches the approval gate, so a production seam would refuse every racer for
 * the same reason and the race would prove nothing. Both are restored in a
 * `finally` and both are PROVEN back byte for byte afterwards - the whole point
 * of a simulated predecessor is that it never survives the scenario that needed
 * it.
 */
async function verifyConcurrency(report, f, base) {
  await asRole('postgres');
  const analytical = await rt.captureSeamDefinition(DFN.ANALYTICAL_SEAM,
    { expect: ['UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'] });
  const gate = await rt.captureSeamDefinition(DFN.PREREQUISITE_SEAM, { expect: ['NOT_EVALUATED'] });

  const withdrawal = rt.freshPackage(base.replay, base.version, 'SHARE_EXTERNALLY');
  const sourceRace = rt.freshPackage(base.replay, base.version, 'DOWNLOAD');
  const competing = rt.freshPackage(base.replay, base.version, 'SHARE_EXTERNALLY');
  const approvals = { withdrawal: randomUUID(), source: randomUUID(), competing: randomUUID() };

  await q('BEGIN');
  try {
    await rt.simulateAnalyticalAuthority([]);
    await actAs(f.creator);
    await rt.prepare(withdrawal);
    await rt.approve({ approval: approvals.withdrawal, package: withdrawal.package });
    await rt.prepare(sourceRace);
    await rt.approve({ approval: approvals.source, package: sourceRace.package });
    await rt.prepare(competing);
    await rt.approve({ approval: approvals.competing, package: competing.package });
    await asRole('postgres');
    // BOTH seams stay simulated across the races, and both are restored below.
    await rt.simulateDistributionPrerequisites();
  } finally {
    await q('COMMIT');
  }

  const secondary = await rt.openSecondary();
  const { q2, actAs2 } = secondary;
  try {
    await report.section('C01 a withdrawal racing the distribution commit blocks the stale commit', async () => {
      await q2('BEGIN');
      await actAs2(f.creator);
      // The withdrawal takes the Replay row FOR UPDATE and holds it, uncommitted.
      await q2('SELECT * FROM public.withdraw_replay_distribution_approval_v1($1, $2, $3)',
        [randomUUID(), approvals.withdrawal, null]);
      await asRole('postgres');
      await q('BEGIN');
      await actAs(f.creator);
      const blocked = q('SELECT * FROM public.authorize_replay_distribution_v1($1, $2, $3)',
        [randomUUID(), withdrawal.package, null]);
      assert.equal(await rt.stillPending(blocked), true,
        'C01 the distribution commit waits for the Replay row the withdrawal holds');
      await q2('COMMIT');
      let refusal = null;
      try { await blocked; } catch (error) { refusal = error; }
      assert.ok(refusal, 'C01 the stale distribution commit is refused');
      assert.equal(refusal.code, '55000');
      assert.match(refusal.message, /REPLAY_DISTRIBUTION_APPROVAL_NOT_EFFECTIVE/u);
      await q('ROLLBACK');
      await asRole('postgres');
      assert.equal(await count(D.AUTHORIZATIONS, 'distribution_package_version_id = $1',
        [withdrawal.package]), 0, 'C01 and nothing was authorized');
    });

    await report.section('C02 a source change racing the distribution commit blocks the stale commit', async () => {
      await q2('BEGIN');
      await q2('RESET ROLE');
      await q2("SET LOCAL session_replication_role = 'replica'");
      await q2(`UPDATE public.conversation_units SET committed_text = committed_text || ' raced'
                WHERE id = $1`, [base.selectedUnits[0]]);
      await asRole('postgres');
      await q('BEGIN');
      await actAs(f.creator);
      const blocked = q('SELECT * FROM public.authorize_replay_distribution_v1($1, $2, $3)',
        [randomUUID(), sourceRace.package, null]);
      assert.equal(await rt.stillPending(blocked), true,
        'C02 the distribution commit waits on the exact committed source row the writer holds');
      await q2('COMMIT');
      let refusal = null;
      try { await blocked; } catch (error) { refusal = error; }
      assert.ok(refusal, 'C02 the stale distribution commit is refused');
      assert.equal(refusal.code, '40001');
      assert.match(refusal.message, /REPLAY_SOURCE_STALE/u);
      await q('ROLLBACK');
      // Put the raced source back, so the remaining race sees the truth it needs.
      await asRole('postgres');
      await q('BEGIN');
      await q("SET LOCAL session_replication_role = 'replica'");
      await q(`UPDATE public.conversation_units SET committed_text = replace(committed_text, ' raced', '')
               WHERE id = $1`, [base.selectedUnits[0]]);
      await q('COMMIT');
      await asRole('postgres');
      const [currency] = await rt.currency(base.manifest);
      assert.equal(currency.currency_state, 'CURRENT', 'C02 and the restored source reads CURRENT again');
    });

    await report.section('C03 two competing distribution commands converge on ONE winner', async () => {
      await asRole('postgres');
      await q('BEGIN');
      await actAs(f.creator);
      const first = q('SELECT * FROM public.authorize_replay_distribution_v1($1, $2, $3)',
        [randomUUID(), competing.package, null]);
      await first;
      await q2('BEGIN');
      await actAs2(f.creator);
      const second = q2('SELECT * FROM public.authorize_replay_distribution_v1($1, $2, $3)',
        [randomUUID(), competing.package, null]);
      assert.equal(await rt.stillPending(second), true,
        'C03 the second command waits for the Replay row the first holds');
      await q('COMMIT');
      let refusal = null;
      try { await second; } catch (error) { refusal = error; }
      assert.ok(refusal, 'C03 exactly one distribution command commits');
      assert.equal(refusal.code, '23505');
      await q2('ROLLBACK');
      await asRole('postgres');
      assert.equal(await count(D.AUTHORIZATIONS, 'distribution_package_version_id = $1',
        [competing.package]), 1, 'C03 and exactly one authorization record exists');
      assert.equal(await count(D.AUTHORIZATION_COMMANDS, 'distribution_package_version_id = $1',
        [competing.package]), 1, 'C03 with exactly one command history row');
    });
  } finally {
    await secondary.close();
    await asRole('postgres');
    await q(analytical.definition);
    await q(gate.definition);
  }
  await report.section('both production seams are restored after the committed races', async () => {
    await asRole('postgres');
    await rt.restoreSeamDefinition(analytical);
    await rt.restoreSeamDefinition(gate);
  });
}

// ---------------------------------------------------------------------- main
await runVerifier('0105', async (stage) => {
  await rt.client.connect();
  const report = createScenarioReport('0105', { query: q, restore: () => asRole('postgres') });

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
    stage('preparation');
    await verifyPreparation(report, f, base);
    stage('consent');
    await verifyConsent(report, f, base);
    stage('distribution');
    await verifyDistribution(report, f, base);
    stage('public bridge');
    await verifyPublicBridge(report, f, base);
    stage('concurrency');
    await verifyConcurrency(report, f, base);
  } finally {
    stage('fixture removal');
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
    `SELECT (SELECT count(*) FROM ${D.PACKAGES} WHERE replay_id IN
               (SELECT id FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[])))
          + (SELECT count(*) FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${V.VERSIONS} WHERE replay_id IN
               (SELECT id FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[])))
          + (SELECT count(*) FROM public.conversation_sessions WHERE user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${T.EXPERIENCES} WHERE id = ANY($2::uuid[])) AS residue`,
    [f.humans, [f.experience].filter(Boolean)]);
  assert.equal(Number(residue), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
