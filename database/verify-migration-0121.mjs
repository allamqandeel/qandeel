// Real-PostgreSQL verifier for migration 0121 - QAN-CW-REM-03, Public / Replay
// current-consent composition and Public historical command truth.
//
// Runs against a FULLY migrated database and proves the two accepted assurance
// findings are really fixed, on real state transitions, and that nothing the
// frozen I-05 and I-06 slices owned moved underneath them.
//
//   P01 posture: every replaced boundary keeps its exact frozen signature, its
//       result columns, its postgres-owned SECURITY DEFINER search_path-pinned
//       shape and its "executable by nobody" ACL; the three new derivations are
//       internal, STABLE, write-free and lock-free
//   P02 the lifecycle event log is complete - exactly four functions move a
//       Public Experience lifecycle and every one writes the immutable event
//
//   ASSURE-F03
//   R01 a non-Public Replay approval with no withdrawal is EFFECTIVE
//   R02 a non-Public Replay approval with a withdrawal is WITHDRAWN
//   R03 a Public-linked approval whose linked Public approval is EFFECTIVE is
//       EFFECTIVE
//   R04 a DIRECT withdraw_publication_approval_v1 on the exact linked Public
//       approval makes the Replay approval WITHDRAWN with NO Replay withdrawal
//       event in existence
//   R05 and the distribution then refuses with REPLAY_DISTRIBUTION_APPROVAL_NOT
//       _EFFECTIVE, with zero authorization and zero Public publication effects
//   R06 a SUPERSEDED linked Public approval makes the Replay approval SUPERSEDED
//       and blocks the distribution
//   R07 the historical Replay approval retry is unchanged by either
//   R08 the canonical Replay withdrawal still withdraws BOTH halves
//   R09 an unresolvable linked Public approval fails closed as SUPERSEDED
//   R10 the composition reaches the package-level view and current eligibility
//
//   ASSURE-F09
//   F01 DRAFT creation: the retry answers DRAFT and revision 1 after the
//       Experience has moved to READY_FOR_REVIEW and to PUBLISHED
//   F02 READY: the retry answers READY_FOR_REVIEW after publication and after
//       disappearance
//   F03p PUBLISH: the retry answers PUBLISHED after the Experience is ABSENT
//   F04 Public Identity: the retry answers the label and revision THIS command
//       committed after a later label change
//   F05 a pre-0121 identity command reconstructs its answer while the revision
//       witness holds, and fails closed the moment it does not
//   F06 controller removal: the retry answers the exact absence it reported
//   F07 reconciliation STILL_ELIGIBLE: the retry answers NULL, NULL and
//       PUBLISHED after a LATER reconciliation converged the Experience
//   F08 reconciliation NOT_APPLICABLE: the retry answers the lifecycle the
//       command saw, after the Experience has since published
//   F09n withdrawal and package preparation are immutable already - the
//       negative evidence, proven rather than asserted
//   F10 a changed immutable request under a spent command id still conflicts
//   F11 the legacy temporal fallback fails closed rather than guessing
//
//   REM03-HIST-01 - the historical lifecycle is bound to the command, not found
//   by time
//   H01 DRAFT: the lifecycle event carries the COMMAND id, and the retry
//       answers that exact event
//   H02 READY: the same, including the exact version the command bound
//   H03 PUBLISH: the same
//   H04 the command's own event is gone and another plausible event exists at
//       the same instant -> CONTRADICTORY_HISTORY, and the plausible one is
//       never substituted
//   H05 the event carries the command id but contradicts it -> the same
//   H06 a no-op disappearance command STORES its exact answer, and the retry
//       reads it with the whole event log deleted
//   H07 an actual disappearance stores its answer too, retry-independent of
//       every current state
//   H08 a pre-0121 no-op reconstructs from the immutable log only while that
//       log is unambiguous, and fails closed the moment it is not - while a
//       command-bound answer is untouched by the same ambiguity
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createReplayClosureRuntime, runVerifier, APP_ROLES, NONE, R, D, DFN, T,
} from './replay-closure-verifier-support.mjs';

const rt = createReplayClosureRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const CONTRADICTORY = ['P0001'];
const CONFLICT = ['23505'];
const NOT_EFFECTIVE = ['55000'];

/** The eight boundaries 0121 forward-replaces, with their exact frozen signatures. */
const REPLACED = Object.freeze({
  ENSURE: 'public.ensure_public_identity_v1(uuid, uuid, text, text)',
  LABEL: 'public.update_public_display_label_v1(uuid, text, text)',
  DRAFT: 'public.create_public_experience_draft_v1(uuid, uuid)',
  READY: 'public.commit_public_experience_ready_for_review_v1(uuid, uuid, uuid)',
  PUBLISH: 'public.publish_public_experience_v1(uuid, uuid, uuid)',
  REMOVE: 'public.remove_public_experience_from_public_world_v1(uuid, uuid, uuid)',
  RECONCILE: 'public.reconcile_public_experience_disappearance_v1(uuid, uuid)',
  REPLAY_STATE: 'public.derive_replay_distribution_approval_effective_state_v1(uuid)',
});
/** The four derivations 0121 creates. All internal, all read-only. */
const DERIVED = Object.freeze({
  COMMAND_LIFECYCLE: 'public.derive_public_command_lifecycle_v1(uuid, uuid, uuid, text, timestamptz)',
  LIFECYCLE_AT: 'public.derive_public_experience_lifecycle_at_v1(uuid, timestamptz)',
  IDENTITY_ANSWER: 'public.derive_public_identity_command_answer_v1(uuid)',
  DISAPPEARANCE_ANSWER: 'public.derive_public_disappearance_command_answer_v1(uuid)',
});
const LIFECYCLE_EVENTS = 'public.public_experience_lifecycle_events';
const LIFECYCLE_GUARD = 'public_experience_lifecycle_events_immutable';
const DISAPPEARANCE_COMMANDS = 'public.public_experience_disappearance_commands';
/** The exact frozen result columns each replaced Public boundary must still declare. */
const RESULT_COLUMNS = new Map([
  [REPLACED.ENSURE, ['outcome', 'public_identity_ref', 'label_mode', 'display_label', 'label_revision', 'committed_at']],
  [REPLACED.LABEL, ['outcome', 'public_identity_ref', 'label_mode', 'display_label', 'label_revision', 'committed_at']],
  [REPLACED.DRAFT, ['outcome', 'experience_id', 'created_by_public_identity_ref', 'current_lifecycle',
    'experience_revision', 'committed_at']],
  [REPLACED.READY, ['outcome', 'experience_id', 'experience_version_id', 'manifest_version_id',
    'current_lifecycle', 'satisfied_approval_count', 'authority_request_fingerprint', 'committed_at']],
  [REPLACED.PUBLISH, ['outcome', 'experience_id', 'experience_version_id', 'manifest_version_id',
    'current_lifecycle', 'effective_approval_count', 'authority_request_fingerprint', 'committed_at']],
  [REPLACED.REMOVE, ['outcome', 'experience_id', 'absent_experience_version_id', 'disappearance_basis',
    'current_lifecycle', 'committed_at']],
  [REPLACED.RECONCILE, ['outcome', 'experience_id', 'absent_experience_version_id', 'disappearance_basis',
    'current_lifecycle', 'committed_at']],
  [REPLACED.REPLAY_STATE, ['approval_id', 'approved_distribution_package_version_id', 'approving_user_id',
    'effective_state', 'bound_authority_fingerprint', 'withdrawn_at']],
]);

/**
 * The historical lifecycle at one command's OWN committed instant, asked
 * entirely inside SQL.
 *
 * Never through a JavaScript `Date`: `timestamptz` carries microseconds and a
 * `Date` carries milliseconds, so a round-tripped instant is EARLIER than the
 * one the command recorded and `occurred_at <= p_at` finds nothing. The
 * production path never round-trips - it passes `committed.committed_at`
 * directly - and neither does this probe.
 */
const lifecycleAtCommand = async (relation, command, offset = '0') => (await rows(
  `SELECT public.derive_public_experience_lifecycle_at_v1(c.experience_id, c.committed_at + $2::interval) AS state
     FROM ${relation} c WHERE c.id = $1`, [command, offset]))[0].state;
const identityAnswer = (command) =>
  rows('SELECT * FROM public.derive_public_identity_command_answer_v1($1)', [command]);
const disappearanceAnswer = (command) =>
  rows('SELECT * FROM public.derive_public_disappearance_command_answer_v1($1)', [command]);

// THE PUBLIC PRIMITIVES, BY THEIR OWN NAMES. The Replay runtime legitimately
// shadows `createDraft`, `prepare` and `approve` with its own, so a Public
// scenario that called the runtime helper would exercise the wrong domain and
// fail somewhere unrelated to what it was proving.
const withdrawPublic = (command, approval) =>
  rows('SELECT * FROM public.withdraw_publication_approval_v1($1, $2)', [command, approval]);
const publicDraft = (command, experience) =>
  rows('SELECT * FROM public.create_public_experience_draft_v1($1, $2)', [command, experience]);
const preparePublic = (command, experience, manifest, version, personalItems, personalUnits,
  sharedItems, sharedWorlds, sharedMaterials) =>
  rows('SELECT * FROM public.prepare_public_experience_manifest_v1($1,$2,$3,$4,$5::uuid[],$6::uuid[],$7::uuid[],$8::uuid[],$9::uuid[])',
    [command, experience, manifest, version, personalItems, personalUnits, sharedItems, sharedWorlds, sharedMaterials]);
const approvePublic = (approval, manifest) =>
  rows('SELECT * FROM public.approve_public_experience_manifest_v1($1, $2)', [approval, manifest]);
const requiredApproversOf = async (manifest) => (await rows(
  `SELECT approver_user_id a FROM ${T.REQUIRED} WHERE manifest_version_id = $1 ORDER BY 1`, [manifest]))
  .map((r) => r.a);

// --------------------------------------------------------------- 1. posture
async function verifyPosture() {
  await asRole('postgres');
  for (const signature of Object.values(REPLACED)) {
    const p = await rt.functionPosture(signature);
    assert.equal(p.owner, 'postgres', `${signature} is postgres-owned`);
    assert.equal(p.secdef, true, `${signature} is SECURITY DEFINER`);
    assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'),
      `${signature} pins an empty search_path`);
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await rt.canExecute(role, signature), false,
        `${role} must not execute ${signature} before the frozen CW2-08 Launch Gate exists`);
    }
    assert.deepEqual(await rt.resultColumns(signature), RESULT_COLUMNS.get(signature),
      `${signature} keeps its exact frozen result columns`);
  }
  for (const signature of Object.values(DERIVED)) {
    const p = await rt.functionPosture(signature);
    assert.equal(p.owner, 'postgres', `${signature} is postgres-owned`);
    assert.equal(p.secdef, true, `${signature} is SECURITY DEFINER`);
    assert.equal(p.volatility, 's', `${signature} is STABLE`);
    assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'),
      `${signature} pins an empty search_path`);
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await rt.canExecute(role, signature), false, `${role} must not execute ${signature}`);
    }
    assert.doesNotMatch(p.prosrc, /pg_advisory|LOCK TABLE|FOR UPDATE|FOR SHARE|TRUNCATE/iu,
      `${signature} takes no lock of any kind`);
    assert.doesNotMatch(p.prosrc, /INSERT INTO|DELETE FROM|UPDATE public\./u, `${signature} writes nothing`);
  }
  // THE REPLAY COMPOSITION IS A COMPOSITION, not a second Public rulebook.
  const state = await rt.functionPosture(REPLACED.REPLAY_STATE);
  assert.match(state.prosrc, /derive_publication_approval_effective_state_v1/u,
    'the Replay effective state composes the canonical Public derivation');
  assert.match(state.prosrc, /linked_public_approval_id/u,
    'and consumes the EXACT linked Public approval the consent act committed');
  assert.doesNotMatch(state.prosrc, /publication_approval_withdrawal_events/u,
    'Public withdrawal rules are not re-implemented inside Replay');
  assert.equal(state.volatility, 's', 'and it is still STABLE');
  // NO GENERIC RESULT BLOB reached any Public command history.
  const [{ blobs }] = await rows(
    `SELECT count(*) blobs FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name LIKE '%_commands' AND c.data_type IN ('json', 'jsonb')`);
  assert.equal(Number(blobs), 0, 'no Public command history carries a generic JSON response blob');
  // THE TYPED ANSWER IS TYPED, BOUNDED, AND REQUIRED OF EVERY FUTURE COMMAND.
  const columns = await rows(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'public_identity_commands'
        AND column_name IN ('committed_label_mode', 'committed_display_label') ORDER BY column_name`);
  assert.deepEqual(columns.map((c) => [c.column_name, c.data_type]),
    [['committed_display_label', 'text'], ['committed_label_mode', 'text']],
    'the committed label answer is two typed text columns');
  assert.equal(await rt.triggerEnabled('public.public_identity_commands', 'public_identity_commands_answer_required'),
    true, 'and a future command that does not carry its answer is refused structurally');
}

/**
 * P02 - the claim both historical derivations rest on, asked of the catalog.
 *
 * If a fifth writer of `public_experiences.current_lifecycle` ever appears
 * without writing the immutable event, both the exact command binding and the
 * legacy fallback stop being truth, silently. This is the check that would
 * notice. It also pins the event id to the command id for the three
 * lifecycle-moving families, which is what makes the binding exact rather than
 * temporal (REM03-HIST-01).
 */
async function verifyLifecycleLogComplete() {
  await asRole('postgres');
  // The pattern names the RELATION, not just the column: `current_lifecycle` is
  // also a column of `public.replays`, and a column-only census counts the three
  // frozen I-06B Replay lifecycle writers as Public ones.
  const writers = await rows(
    `SELECT pr.proname, pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
        AND (pr.prosrc ~ 'UPDATE public\\.public_experiences e\\s+SET current_lifecycle = '''
          OR pr.prosrc ~ 'INSERT INTO public\\.public_experiences\\s+\\(id, public_world_singleton')
      ORDER BY pr.proname`);
  assert.deepEqual(writers.map((w) => w.proname), [
    'apply_public_experience_disappearance_v1',
    'commit_public_experience_ready_for_review_v1',
    'create_public_experience_draft_v1',
    'publish_public_experience_v1',
  ], 'exactly four functions move a Public Experience lifecycle');
  for (const writer of writers) {
    assert.match(writer.prosrc, /INSERT INTO public\.public_experience_lifecycle_events/u,
      `${writer.proname} writes the immutable lifecycle event the historical derivation reads`);
  }
  assert.equal(await rt.triggerEnabled(T.LIFECYCLE, 'public_experience_lifecycle_events_immutable'), true,
    'and that event log is append-only for every role');

  // REM03-HIST-01: the three lifecycle-moving families write the event under
  // the COMMAND identity, which is why their retries bind it by id. Asserted
  // from the frozen sources, so a future replacement that stopped doing it
  // would be caught here rather than by a silently weaker answer.
  for (const [name, expected] of [
    ['create_public_experience_draft_v1', "VALUES (p_command_id, p_experience_id, NULL, NULL, 'DRAFT'"],
    ['commit_public_experience_ready_for_review_v1', "VALUES (p_command_id, p_experience_id, p_experience_version_id, 'DRAFT', 'READY_FOR_REVIEW'"],
    ['publish_public_experience_v1', "VALUES (p_command_id, p_experience_id, p_experience_version_id, 'READY_FOR_REVIEW', 'PUBLISHED'"],
  ]) {
    const [{ prosrc }] = await rows(
      `SELECT pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
        WHERE n.nspname = 'public' AND pr.proname = $1`, [name]);
    assert.ok(prosrc.includes(expected),
      `${name} writes its lifecycle event under its own command identity`);
    assert.ok(prosrc.includes('derive_public_command_lifecycle_v1'),
      `${name} answers its retry from that exact event`);
    assert.ok(!prosrc.includes('derive_public_experience_lifecycle_at_v1'),
      `${name} never reconstructs the answer by time`);
  }
  // And the temporal fallback has exactly one caller: the legacy branch.
  const callers = await rows(
    `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
        AND pr.proname <> 'derive_public_experience_lifecycle_at_v1'
        AND pr.prosrc ~ 'derive_public_experience_lifecycle_at_v1' ORDER BY pr.proname`);
  assert.deepEqual(callers.map((c) => c.proname), ['derive_public_disappearance_command_answer_v1'],
    'the temporal reconstruction is reachable only from the legacy disappearance branch');
}

// ------------------------------------------------------- 2. ASSURE-F03 (F03)
async function verifyConsentComposition(report, f, base) {
  await q('BEGIN');
  try {
    await rt.simulateAnalyticalAuthority([]);

    await report.isolated('R01 a non-Public approval with no withdrawal is EFFECTIVE', async () => {
      await actAs(f.creator);
      const spec = rt.freshPackage(base.replay, base.version, 'SHARE_EXTERNALLY');
      await rt.prepare(spec);
      const approval = randomUUID();
      await rt.approve({ approval, package: spec.package });
      await asRole('postgres');
      const [state] = await rt.approvalState(approval);
      assert.equal(state.effective_state, 'EFFECTIVE');
      assert.equal(state.withdrawn_at, null, 'R01 and nothing was withdrawn');
    });

    await report.isolated('R02 a non-Public approval with a Replay withdrawal is WITHDRAWN', async () => {
      await actAs(f.creator);
      const spec = rt.freshPackage(base.replay, base.version, 'DOWNLOAD');
      await rt.prepare(spec);
      const approval = randomUUID();
      await rt.approve({ approval, package: spec.package });
      await rt.withdraw({ command: randomUUID(), approval });
      await asRole('postgres');
      assert.equal((await rt.approvalState(approval))[0].effective_state, 'WITHDRAWN');
    });

    await report.isolated('R03 a Public-linked approval whose Public half is EFFECTIVE is EFFECTIVE', async () => {
      await actAs(f.creator);
      const spec = { ...rt.freshPackage(base.replay, base.version, 'PUBLISH_TO_PUBLIC_WORLD'),
        ...rt.freshPublic(f.experience) };
      await rt.prepare(spec);
      const approval = randomUUID();
      const publicApproval = randomUUID();
      await rt.approve({ approval, package: spec.package, publicApproval });
      await asRole('postgres');
      assert.equal((await rt.deriveApprovalState(publicApproval))[0].effective_state, 'EFFECTIVE',
        'R03 the canonical Public half is effective');
      assert.equal((await rt.approvalState(approval))[0].effective_state, 'EFFECTIVE',
        'R03 and so is the Replay half it is linked to');
    });

    // THE DEFECT ITSELF. One human consent act, taken back through the Public
    // primitive alone, which has never heard of Replay.
    await report.isolated('R04 a DIRECT Public withdrawal makes the linked Replay approval WITHDRAWN', async () => {
      await actAs(f.creator);
      const spec = { ...rt.freshPackage(base.replay, base.version, 'PUBLISH_TO_PUBLIC_WORLD'),
        ...rt.freshPublic(f.experience) };
      await rt.prepare(spec);
      const approval = randomUUID();
      const publicApproval = randomUUID();
      await rt.approve({ approval, package: spec.package, publicApproval });
      // The canonical Public withdrawal, called BY ITS OWN NAME. Nothing about
      // this path knows a Replay borrowed the consent.
      const [withdrawn] = await withdrawPublic(randomUUID(), publicApproval);
      assert.equal(withdrawn.outcome, 'WITHDRAWN', 'R04 the Public half was taken back');
      await asRole('postgres');
      assert.equal(await count(D.WITHDRAWALS, 'approval_id = $1', [approval]), 0,
        'R04 and NO Replay withdrawal event was invented');
      const [state] = await rt.approvalState(approval);
      assert.equal(state.effective_state, 'WITHDRAWN',
        'R04 the Replay approval is no longer effective, because the human withdrew the consent it records');
      assert.equal(state.withdrawn_at, null,
        'R04 and the Replay withdrawal instant stays NULL: historical truth is unchanged');
      // THE HISTORICAL EVIDENCE IS ALL STILL THERE.
      assert.equal(await count(D.APPROVALS, 'id = $1', [approval]), 1, 'R04 the Replay approval row survives');
      assert.equal(await count(T.APPROVALS, 'id = $1', [publicApproval]), 1, 'R04 and so does the Public one');
    });

    await report.isolated('R05 the distribution then refuses, with zero effects', async () => {
      await actAs(f.creator);
      const spec = { ...rt.freshPackage(base.replay, base.version, 'PUBLISH_TO_PUBLIC_WORLD'),
        ...rt.freshPublic(f.experience) };
      await rt.prepare(spec);
      const approval = randomUUID();
      const publicApproval = randomUUID();
      await rt.approve({ approval, package: spec.package, publicApproval });
      await rt.actAs(f.creator);
      const [ready] = await rows('SELECT * FROM public.commit_public_experience_ready_for_review_v1($1, $2, $3)',
        [randomUUID(), f.experience, spec.publicVersion]);
      assert.equal(ready.outcome, 'READY_FOR_REVIEW', 'R05 the Public half reached READY through the canonical path');
      await withdrawPublic(randomUUID(), publicApproval);
      await asRole('postgres');
      await rt.simulateDistributionPrerequisites();
      await rt.clearPrerequisites();
      await actAs(f.creator);
      await rejected(() => rt.authorize({ command: randomUUID(), package: spec.package,
        publicPublishCommand: randomUUID() }), NOT_EFFECTIVE, /REPLAY_DISTRIBUTION_APPROVAL_NOT_EFFECTIVE/u);
      await asRole('postgres');
      assert.equal(await count(D.AUTHORIZATIONS, 'distribution_package_version_id = $1', [spec.package]), 0,
        'R05 nothing was authorized');
      const [experience] = await rows(`SELECT current_lifecycle FROM ${T.EXPERIENCES} WHERE id = $1`, [f.experience]);
      assert.notEqual(experience.current_lifecycle, 'PUBLISHED', 'R05 and nothing was published');
    });

    await report.isolated('R06 a SUPERSEDED linked Public approval makes the Replay approval SUPERSEDED', async () => {
      await actAs(f.creator);
      const first = { ...rt.freshPackage(base.replay, base.version, 'PUBLISH_TO_PUBLIC_WORLD'),
        ...rt.freshPublic(f.experience) };
      await rt.prepare(first);
      const approval = randomUUID();
      const publicApproval = randomUUID();
      await rt.approve({ approval, package: first.package, publicApproval });
      // A SECOND Public-linked package on the same DRAFT Experience moves the
      // current version pointer, and the frozen 0094 derivation calls the first
      // Public approval SUPERSEDED. Nothing simulated: the canonical path did it.
      const second = { ...rt.freshPackage(base.replay, base.version, 'PUBLISH_TO_PUBLIC_WORLD'),
        ...rt.freshPublic(f.experience) };
      await rt.prepare(second);
      await asRole('postgres');
      assert.equal((await rt.deriveApprovalState(publicApproval))[0].effective_state, 'SUPERSEDED',
        'R06 the canonical Public half is superseded');
      assert.equal((await rt.approvalState(approval))[0].effective_state, 'SUPERSEDED',
        'R06 and the Replay half composes that rather than answering EFFECTIVE');
      await rt.simulateDistributionPrerequisites();
      await actAs(f.creator);
      await rejected(() => rt.authorize({ command: randomUUID(), package: first.package,
        publicPublishCommand: randomUUID() }), NOT_EFFECTIVE, /REPLAY_DISTRIBUTION_APPROVAL_NOT_EFFECTIVE/u);
    });

    await report.isolated('R07 the historical approval retry is unchanged by either', async () => {
      await actAs(f.creator);
      const spec = { ...rt.freshPackage(base.replay, base.version, 'PUBLISH_TO_PUBLIC_WORLD'),
        ...rt.freshPublic(f.experience) };
      await rt.prepare(spec);
      const approval = randomUUID();
      const publicApproval = randomUUID();
      const [approved] = await rt.approve({ approval, package: spec.package, publicApproval });
      await withdrawPublic(randomUUID(), publicApproval);
      await actAs(f.creator);
      const [again] = await rt.approve({ approval, package: spec.package, publicApproval });
      assert.equal(again.outcome, 'ALREADY_APPROVED', 'R07 the historical consent act still answers');
      assert.equal(again.approved_at.getTime(), approved.approved_at.getTime(),
        'R07 with the exact instant it committed');
      assert.equal(again.linked_public_approval_id, publicApproval, 'R07 and the exact link it recorded');
      await asRole('postgres');
      assert.equal((await rt.approvalState(approval))[0].effective_state, 'WITHDRAWN',
        'R07 while the CURRENT effective state is the withdrawn one');
    });

    await report.isolated('R08 the canonical Replay withdrawal still withdraws BOTH halves', async () => {
      await actAs(f.creator);
      const spec = { ...rt.freshPackage(base.replay, base.version, 'PUBLISH_TO_PUBLIC_WORLD'),
        ...rt.freshPublic(f.experience) };
      await rt.prepare(spec);
      const approval = randomUUID();
      const publicApproval = randomUUID();
      await rt.approve({ approval, package: spec.package, publicApproval });
      const [withdrawn] = await rt.withdraw({ command: randomUUID(), approval, publicCommand: randomUUID() });
      assert.equal(withdrawn.outcome, 'REPLAY_DISTRIBUTION_APPROVAL_WITHDRAWN');
      assert.equal(withdrawn.effective_state, 'WITHDRAWN',
        'R08 and the committed answer is still the pinned WITHDRAWN, not a recomposed one');
      await asRole('postgres');
      assert.equal((await rt.deriveApprovalState(publicApproval))[0].effective_state, 'WITHDRAWN',
        'R08 the canonical Public half is withdrawn too');
      assert.equal((await rt.approvalState(approval))[0].effective_state, 'WITHDRAWN');
    });

    await report.isolated('R09 an unresolvable linked Public approval fails closed', async () => {
      await actAs(f.creator);
      const spec = { ...rt.freshPackage(base.replay, base.version, 'PUBLISH_TO_PUBLIC_WORLD'),
        ...rt.freshPublic(f.experience) };
      await rt.prepare(spec);
      const approval = randomUUID();
      const publicApproval = randomUUID();
      await rt.approve({ approval, package: spec.package, publicApproval });
      await asRole('postgres');
      assert.equal((await rt.approvalState(approval))[0].effective_state, 'EFFECTIVE', 'R09 it starts effective');
      // The immutable composite foreign key makes an ABSENT linked Public row
      // unrepresentable, so the only honest way to reach the fail-closed branch
      // is to make the canonical derivation answer nothing - which is exactly
      // what it does for an approval it cannot resolve. Replaced inside this
      // scenario's savepoint and restored whatever happens.
      const canonical = await rt.captureSeamDefinition(
        'public.derive_publication_approval_effective_state_v1(uuid)', { expect: ['WITHDRAWN', 'SUPERSEDED'] });
      try {
        await q(`CREATE OR REPLACE FUNCTION public.derive_publication_approval_effective_state_v1(p_approval_id uuid)
                 RETURNS TABLE(approval_id uuid, approved_manifest_version_id uuid, approving_user_id uuid,
                               effective_state text, bound_authority_fingerprint text, withdrawn_at timestamptz,
                               superseding_experience_version_id uuid)
                 LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $probe$
                 BEGIN
                   RETURN;
                 END$probe$`);
        const [state] = await rt.approvalState(approval);
        assert.equal(state.effective_state, 'SUPERSEDED',
          'R09 a linked Public approval that cannot be resolved is SUPERSEDED, never EFFECTIVE');
      } finally {
        await rt.restoreSeamDefinition(canonical);
      }
      assert.equal((await rt.approvalState(approval))[0].effective_state, 'EFFECTIVE',
        'R09 and the production derivation is back, byte for byte');
    });

    await report.isolated('R10 the composition reaches the package view and current eligibility', async () => {
      await actAs(f.creator);
      const spec = { ...rt.freshPackage(base.replay, base.version, 'PUBLISH_TO_PUBLIC_WORLD'),
        ...rt.freshPublic(f.experience) };
      await rt.prepare(spec);
      const approval = randomUUID();
      const publicApproval = randomUUID();
      await rt.approve({ approval, package: spec.package, publicApproval });
      await asRole('postgres');
      assert.deepEqual((await rt.effectiveApprovals(spec.package)).map((a) => a.effective_state), ['EFFECTIVE'],
        'R10 the package-level view says EFFECTIVE while both halves hold');
      await actAs(f.creator);
      await withdrawPublic(randomUUID(), publicApproval);
      await asRole('postgres');
      assert.deepEqual((await rt.effectiveApprovals(spec.package)).map((a) => a.effective_state), ['WITHDRAWN'],
        'R10 and composes the direct Public withdrawal the moment it happens');
      const [eligible] = await rt.eligibility(spec.package);
      assert.equal(eligible.eligibility_state, 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY',
        'R10 so a package that was never authorized is not eligible either');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// ------------------------------------------------------- 3. ASSURE-F09 (F09)
/**
 * One Experience taken from nothing to READY_FOR_REVIEW through the frozen
 * I-05A primitives, returning every command id so a retry can be asked later.
 */
async function draftToReady(f, ids) {
  await actAs(f.mohamed);
  const [drafted] = await publicDraft(ids.draftCommand, ids.experience);
  assert.equal(drafted.outcome, 'DRAFT_CREATED', 'fixture: the draft was created');
  // THE PACKAGE ITEM IDENTITY IS PART OF THE IMMUTABLE REQUEST, so it comes
  // from `ids` and is reused by every retry: a fresh one would be a DIFFERENT
  // request under a spent command id, which is a conflict rather than a retry.
  const [prepared] = await preparePublic(ids.prepareCommand, ids.experience, ids.manifest, ids.version,
    NONE, NONE, [ids.sharedItem], [f.world], [f.mohamedMaterial]);
  assert.equal(prepared.outcome, 'PACKAGE_PREPARED', 'fixture: the package prepared');
  const required = await requiredApproversOf(ids.manifest);
  const approvals = new Map();
  for (const approver of required) {
    await actAs(approver);
    const approval = randomUUID();
    await approvePublic(approval, ids.manifest);
    approvals.set(approver, approval);
  }
  await actAs(f.mohamed);
  const [ready] = await rt.commitReady(ids.readyCommand, ids.experience, ids.version);
  assert.equal(ready.outcome, 'READY_FOR_REVIEW', 'fixture: READY_FOR_REVIEW committed');
  return { drafted, prepared, ready, approvals, required };
}

const freshIds = () => ({
  experience: randomUUID(), manifest: randomUUID(), version: randomUUID(), sharedItem: randomUUID(),
  draftCommand: randomUUID(), prepareCommand: randomUUID(), readyCommand: randomUUID(),
  publishCommand: randomUUID(), removeCommand: randomUUID(),
});

async function verifyHistoricalAnswers(report, f, seam) {
  await q('BEGIN');
  try {
    await report.isolated('F01 DRAFT creation answers DRAFT and revision 1 forever', async () => {
      const ids = freshIds();
      const { drafted } = await draftToReady(f, ids);
      assert.equal(drafted.current_lifecycle, 'DRAFT');
      assert.equal(Number(drafted.experience_revision), 1);
      await asRole('postgres');
      const [moved] = await rows(`SELECT current_lifecycle, experience_revision FROM ${T.EXPERIENCES} WHERE id = $1`,
        [ids.experience]);
      assert.equal(moved.current_lifecycle, 'READY_FOR_REVIEW', 'F01 the Experience really moved');
      assert.ok(Number(moved.experience_revision) > 1, 'F01 and its revision really moved');
      await actAs(f.mohamed);
      const [retry] = await publicDraft(ids.draftCommand, ids.experience);
      assert.equal(retry.outcome, 'ALREADY_COMMITTED');
      assert.equal(retry.current_lifecycle, 'DRAFT', 'F01 the retry answers what the creation committed');
      assert.equal(Number(retry.experience_revision), 1, 'F01 and the revision it committed');
      assert.equal(retry.committed_at.getTime(), drafted.committed_at.getTime());
      // AND AGAIN AFTER PUBLICATION, which moves it twice more.
      await rt.publishCleared(seam, f.mohamed, ids.publishCommand, ids.experience, ids.version);
      await actAs(f.mohamed);
      const [afterPublish] = await publicDraft(ids.draftCommand, ids.experience);
      assert.equal(afterPublish.current_lifecycle, 'DRAFT', 'F01 still DRAFT after the Experience published');
      assert.equal(Number(afterPublish.experience_revision), 1);
    });

    await report.isolated('F02 READY answers READY_FOR_REVIEW after publication and disappearance', async () => {
      const ids = freshIds();
      const { ready } = await draftToReady(f, ids);
      assert.equal(ready.current_lifecycle, 'READY_FOR_REVIEW');
      await rt.publishCleared(seam, f.mohamed, ids.publishCommand, ids.experience, ids.version);
      await actAs(f.mohamed);
      await rt.removeFromPublicWorld(ids.removeCommand, ids.experience, ids.version);
      await asRole('postgres');
      assert.equal((await rows(`SELECT current_lifecycle c FROM ${T.EXPERIENCES} WHERE id = $1`, [ids.experience]))[0].c,
        'ABSENT_FROM_PUBLIC_WORLD', 'F02 the Experience is two transitions past READY');
      await actAs(f.mohamed);
      const [retry] = await rt.commitReady(ids.readyCommand, ids.experience, ids.version);
      assert.equal(retry.outcome, 'ALREADY_COMMITTED');
      assert.equal(retry.current_lifecycle, 'READY_FOR_REVIEW', 'F02 and the retry still answers what it committed');
      assert.equal(retry.satisfied_approval_count, ready.satisfied_approval_count);
      assert.equal(retry.authority_request_fingerprint, ready.authority_request_fingerprint);
    });

    await report.isolated('F03p PUBLISH answers PUBLISHED after the Experience is ABSENT', async () => {
      const ids = freshIds();
      await draftToReady(f, ids);
      const [published] = await rt.publishCleared(seam, f.mohamed, ids.publishCommand, ids.experience, ids.version);
      assert.equal(published.current_lifecycle, 'PUBLISHED');
      await actAs(f.mohamed);
      await rt.removeFromPublicWorld(ids.removeCommand, ids.experience, ids.version);
      const [retry] = await rt.publish(ids.publishCommand, ids.experience, ids.version);
      assert.equal(retry.outcome, 'ALREADY_COMMITTED');
      assert.equal(retry.current_lifecycle, 'PUBLISHED',
        'F03p a publication that later left the Public World still answers PUBLISHED');
      assert.equal(retry.effective_approval_count, published.effective_approval_count);
    });

    await report.isolated('F04 a Public Identity command answers the label it committed', async () => {
      const human = randomUUID();
      await asRole('postgres');
      await q('INSERT INTO auth.users(id) VALUES ($1)', [human]);
      await actAs(human);
      const ensureCommand = randomUUID();
      const [created] = await rt.ensureIdentity(ensureCommand, randomUUID(), 'PSEUDONYM', 'the first alias');
      assert.equal(created.outcome, 'CREATED');
      const labelCommand = randomUUID();
      const [updated] = await rt.updateLabel(labelCommand, 'REAL_NAME', 'a completely different name');
      assert.equal(updated.outcome, 'UPDATED');
      assert.equal(Number(updated.label_revision), 2);

      const [ensureRetry] = await rt.ensureIdentity(ensureCommand, created.public_identity_ref, 'PSEUDONYM', 'the first alias');
      assert.equal(ensureRetry.outcome, 'ALREADY_COMMITTED');
      assert.equal(ensureRetry.display_label, 'the first alias', 'F04 the label this command committed');
      assert.equal(ensureRetry.label_mode, 'PSEUDONYM', 'F04 and the mode it committed');
      assert.equal(Number(ensureRetry.label_revision), 1, 'F04 and the revision it committed');

      const [labelRetry] = await rt.updateLabel(labelCommand, 'REAL_NAME', 'a completely different name');
      assert.equal(labelRetry.outcome, 'ALREADY_COMMITTED');
      assert.equal(labelRetry.display_label, 'a completely different name');
      assert.equal(Number(labelRetry.label_revision), 2);

      // A THIRD label change moves the display row again; neither retry moves.
      await rt.updateLabel(randomUUID(), 'PSEUDONYM', 'a third alias');
      const [stillFirst] = await rt.ensureIdentity(ensureCommand, created.public_identity_ref, 'PSEUDONYM', 'the first alias');
      assert.equal(stillFirst.display_label, 'the first alias', 'F04 and stays the committed one');
    });

    await report.isolated('F05 a pre-0121 identity command reconstructs, or fails closed', async () => {
      const human = randomUUID();
      await asRole('postgres');
      await q('INSERT INTO auth.users(id) VALUES ($1)', [human]);
      await actAs(human);
      const ensureCommand = randomUUID();
      const [created] = await rt.ensureIdentity(ensureCommand, randomUUID(), 'PSEUDONYM', 'a legacy alias');
      await asRole('postgres');
      // EXACTLY THE SHAPE A COMMAND COMMITTED BEFORE THIS MIGRATION HAS.
      await q('UPDATE public.public_identity_commands SET committed_label_mode = NULL, committed_display_label = NULL WHERE id = $1',
        [ensureCommand]);
      const [reconstructed] = await identityAnswer(ensureCommand);
      assert.equal(reconstructed.display_label, 'a legacy alias',
        'F05 while the committed revision is still the current one, the current row IS that answer');
      assert.equal(Number(reconstructed.label_revision), 1);
      await actAs(human);
      const [retry] = await rt.ensureIdentity(ensureCommand, created.public_identity_ref, 'PSEUDONYM', 'a legacy alias');
      assert.equal(retry.display_label, 'a legacy alias', 'F05 and the command answers it');

      // NOW THE WITNESS BREAKS. The label moved, so the answer is gone.
      await rt.updateLabel(randomUUID(), 'REAL_NAME', 'something else entirely');
      await asRole('postgres');
      await rejected(() => identityAnswer(ensureCommand), CONTRADICTORY, /CONTRADICTORY_HISTORY/u);
      await actAs(human);
      await rejected(
        () => rt.ensureIdentity(ensureCommand, created.public_identity_ref, 'PSEUDONYM', 'a legacy alias'),
        CONTRADICTORY, /CONTRADICTORY_HISTORY/u);
      // AND IT NEVER SUBSTITUTES THE CURRENT LABEL.
      await asRole('postgres');
      const [display] = await rows(`SELECT display_label FROM ${T.DISPLAY} WHERE public_identity_ref = $1`,
        [created.public_identity_ref]);
      assert.equal(display.display_label, 'something else entirely',
        'F05 the current label exists and was deliberately not returned');
    });

    await report.isolated('F06 controller removal answers the absence it reported', async () => {
      const ids = freshIds();
      await draftToReady(f, ids);
      await rt.publishCleared(seam, f.mohamed, ids.publishCommand, ids.experience, ids.version);
      await actAs(f.mohamed);
      const [removed] = await rt.removeFromPublicWorld(ids.removeCommand, ids.experience, ids.version);
      assert.equal(removed.outcome, 'REMOVED_FROM_PUBLIC_WORLD');
      const [retry] = await rt.removeFromPublicWorld(ids.removeCommand, ids.experience, ids.version);
      assert.equal(retry.outcome, 'ALREADY_COMMITTED');
      assert.equal(retry.absent_experience_version_id, ids.version);
      assert.equal(retry.disappearance_basis, 'AUTHORIZED_CONTROLLER_REMOVAL');
      assert.equal(retry.current_lifecycle, 'ABSENT_FROM_PUBLIC_WORLD');
      assert.equal(retry.committed_at.getTime(), removed.committed_at.getTime());
    });

    // THE SHARPEST CASE IN THE CENSUS. A STILL_ELIGIBLE answer returned NULL,
    // NULL and PUBLISHED. The frozen retry answered with the command's target
    // version immediately, and with a basis and a lifecycle a LATER convergence
    // wrote.
    await report.isolated('F07 STILL_ELIGIBLE answers NULL after a later convergence', async () => {
      const ids = freshIds();
      const { approvals } = await draftToReady(f, ids);
      await rt.publishCleared(seam, f.mohamed, ids.publishCommand, ids.experience, ids.version);
      await asRole('postgres');
      const reconcileCommand = randomUUID();
      const [eligible] = await rt.reconcileDisappearance(reconcileCommand, ids.experience);
      assert.equal(eligible.outcome, 'STILL_ELIGIBLE');
      assert.equal(eligible.absent_experience_version_id, null, 'F07 it named no absent version');
      assert.equal(eligible.disappearance_basis, null, 'F07 and no basis');
      assert.equal(eligible.current_lifecycle, 'PUBLISHED');
      // The retry with NOTHING changed at all must already answer the same.
      const [immediate] = await rt.reconcileDisappearance(reconcileCommand, ids.experience);
      assert.equal(immediate.outcome, 'ALREADY_COMMITTED');
      assert.equal(immediate.absent_experience_version_id, null,
        'F07 the retry names no absent version either - the frozen one returned the command target here');
      assert.equal(immediate.disappearance_basis, null);
      assert.equal(immediate.current_lifecycle, 'PUBLISHED');

      // NOW MAKE IT INELIGIBLE AND CONVERGE IT, through the canonical paths.
      const [rightsholder] = [...approvals.keys()];
      await actAs(rightsholder);
      await withdrawPublic(randomUUID(), approvals.get(rightsholder));
      await asRole('postgres');
      const [converged] = await rt.reconcileDisappearance(randomUUID(), ids.experience);
      assert.equal(converged.outcome, 'DISAPPEARANCE_CONVERGED');
      assert.equal(converged.disappearance_basis, 'REQUIRED_APPROVAL_NOT_EFFECTIVE');
      // AND THE FIRST COMMAND STILL ANSWERS WHAT IT ANSWERED.
      const [after] = await rt.reconcileDisappearance(reconcileCommand, ids.experience);
      assert.equal(after.outcome, 'ALREADY_COMMITTED');
      assert.equal(after.absent_experience_version_id, null,
        'F07 a LATER disappearance does not retro-fit an absence onto a command that reported none');
      assert.equal(after.disappearance_basis, null, 'F07 nor a basis written after it committed');
      assert.equal(after.current_lifecycle, 'PUBLISHED', 'F07 nor the lifecycle the Experience reached later');
    });

    await report.isolated('F08 NOT_APPLICABLE answers the lifecycle the command saw', async () => {
      const ids = freshIds();
      await actAs(f.mohamed);
      await publicDraft(ids.draftCommand, ids.experience);
      await asRole('postgres');
      const reconcileCommand = randomUUID();
      const [notApplicable] = await rt.reconcileDisappearance(reconcileCommand, ids.experience);
      assert.equal(notApplicable.outcome, 'NOT_APPLICABLE');
      assert.equal(notApplicable.current_lifecycle, 'DRAFT');
      // Take the same Experience all the way to PUBLISHED and then out again.
      await actAs(f.mohamed);
      const [prepared] = await preparePublic(ids.prepareCommand, ids.experience, ids.manifest, ids.version,
        NONE, NONE, [ids.sharedItem], [f.world], [f.mohamedMaterial]);
      assert.equal(prepared.outcome, 'PACKAGE_PREPARED');
      for (const approver of await requiredApproversOf(ids.manifest)) {
        await actAs(approver);
        await approvePublic(randomUUID(), ids.manifest);
      }
      await actAs(f.mohamed);
      await rt.commitReady(ids.readyCommand, ids.experience, ids.version);
      await rt.publishCleared(seam, f.mohamed, ids.publishCommand, ids.experience, ids.version);
      await asRole('postgres');
      const [retry] = await rt.reconcileDisappearance(reconcileCommand, ids.experience);
      assert.equal(retry.outcome, 'ALREADY_COMMITTED');
      assert.equal(retry.current_lifecycle, 'DRAFT',
        'F08 the lifecycle this command saw, not the one the Experience reached afterwards');
      assert.equal(retry.absent_experience_version_id, null);
      assert.equal(retry.disappearance_basis, null);
    });

    await report.isolated('F09n withdrawal and package preparation were already immutable', async () => {
      const ids = freshIds();
      const { approvals, prepared } = await draftToReady(f, ids);
      const [rightsholder] = [...approvals.keys()];
      const withdrawalCommand = randomUUID();
      await actAs(rightsholder);
      const [withdrawn] = await withdrawPublic(withdrawalCommand, approvals.get(rightsholder));
      assert.equal(withdrawn.effective_state, 'WITHDRAWN');
      const [again] = await withdrawPublic(withdrawalCommand, approvals.get(rightsholder));
      assert.equal(again.outcome, 'ALREADY_COMMITTED');
      assert.equal(again.effective_state, 'WITHDRAWN',
        'F09n the withdrawal answer is pinned: the event is append-only and the derivation reports it first');
      await asRole('postgres');
      assert.equal(await rt.triggerEnabled(T.WITHDRAWAL_EVENTS, 'publication_approval_withdrawal_events_immutable'),
        true, 'F09n and the event relation refuses DELETE for every role, which is why it is pinned');
      await actAs(f.mohamed);
      const [prepareRetry] = await preparePublic(ids.prepareCommand, ids.experience, ids.manifest, ids.version,
        NONE, NONE, [ids.sharedItem], [f.world], [f.mohamedMaterial]);
      assert.equal(prepareRetry.outcome, 'ALREADY_COMMITTED');
      assert.equal(prepareRetry.version_ordinal, prepared.version_ordinal,
        'F09n the preparation retry reads an immutable version row, not a mutable pointer');
      await asRole('postgres');
      assert.equal(await rt.triggerEnabled(T.VERSIONS, 'public_experience_versions_immutable'), true,
        'F09n and that row is guarded UPDATE and DELETE for every role');
    });

    await report.isolated('F10 a changed immutable request under a spent command id still conflicts', async () => {
      const ids = freshIds();
      await draftToReady(f, ids);
      await actAs(f.mohamed);
      await rejected(() => publicDraft(ids.draftCommand, randomUUID()), CONFLICT,
        /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
      await rejected(() => rt.commitReady(ids.readyCommand, ids.experience, randomUUID()), CONFLICT,
        /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
      await rejected(() => preparePublic(ids.prepareCommand, ids.experience, ids.manifest, ids.version,
        NONE, NONE, [randomUUID()], [f.world], [f.mohamedMaterial]), CONFLICT,
      /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
      // THE IDENTITY FAMILY TOO, where the answer columns 0121 added live. A
      // command id is spent within its OWN family: each family has its own
      // command relation, so this is asked of the identity command itself
      // rather than of a draft id borrowed from another one.
      const labelCommand = randomUUID();
      const [updated] = await rt.updateLabel(labelCommand, 'PSEUDONYM', 'an alias this command committed');
      assert.equal(updated.outcome, 'UPDATED');
      await rejected(() => rt.updateLabel(labelCommand, 'REAL_NAME', 'an alias it never carried'),
        CONFLICT, /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
      const [again] = await rt.updateLabel(labelCommand, 'PSEUDONYM', 'an alias this command committed');
      assert.equal(again.display_label, 'an alias this command committed',
        'F10 while the equivalent retry still answers exactly what it committed');
    });

    await report.isolated('F11 the historical lifecycle derivation fails closed rather than guessing', async () => {
      const ids = freshIds();
      await actAs(f.mohamed);
      await publicDraft(ids.draftCommand, ids.experience);
      await asRole('postgres');
      const commands = 'public.public_experience_draft_commands';
      assert.equal(await lifecycleAtCommand(commands, ids.draftCommand), 'DRAFT',
        'F11 the instant of the creation itself answers DRAFT');
      // Before the Experience existed there is no evidence at all, and the
      // derivation says so instead of returning something plausible.
      await rejected(() => lifecycleAtCommand(commands, ids.draftCommand, '-1 minute'),
        CONTRADICTORY, /CONTRADICTORY_HISTORY/u);
      await rejected(() => rows(
        `SELECT public.derive_public_experience_lifecycle_at_v1($1, c.committed_at)
           FROM ${commands} c WHERE c.id = $2`, [randomUUID(), ids.draftCommand]),
      CONTRADICTORY, /CONTRADICTORY_HISTORY/u);
      // A disappearance answer for a command that does not exist fails the same way.
      await rejected(() => disappearanceAnswer(randomUUID()), CONTRADICTORY, /CONTRADICTORY_HISTORY/u);
      await rejected(() => identityAnswer(randomUUID()), CONTRADICTORY, /CONTRADICTORY_HISTORY/u);
    });

    // ------------------------------------------------------------ REM03-HIST-01
    //
    // The historical lifecycle is bound to the command BY IDENTITY, not found
    // by time. `occurred_at` is not a uniqueness key, so a "latest event at or
    // before the committed instant" reconstruction is weaker than the truth the
    // three lifecycle-moving commands already recorded.
    await report.isolated('H01 DRAFT binds the exact lifecycle event its command id names', async () => {
      const ids = freshIds();
      const { drafted } = await draftToReady(f, ids);
      await asRole('postgres');
      const [own] = await rows(`SELECT * FROM ${LIFECYCLE_EVENTS} WHERE id = $1`, [ids.draftCommand]);
      assert.ok(own, 'H01 the creation wrote its lifecycle event under the COMMAND identity');
      assert.equal(own.experience_id, ids.experience);
      assert.equal(own.to_lifecycle, 'DRAFT');
      assert.equal(own.experience_version_id, null, 'H01 a birth names no version');
      assert.equal(own.occurred_at.getTime(), drafted.committed_at.getTime(),
        'H01 at the command own committed instant');
      await actAs(f.mohamed);
      const [retry] = await publicDraft(ids.draftCommand, ids.experience);
      assert.equal(retry.current_lifecycle, own.to_lifecycle, 'H01 and the retry answers THAT event');
    });

    await report.isolated('H02 READY binds the exact lifecycle event its command id names', async () => {
      const ids = freshIds();
      const { ready } = await draftToReady(f, ids);
      await asRole('postgres');
      const [own] = await rows(`SELECT * FROM ${LIFECYCLE_EVENTS} WHERE id = $1`, [ids.readyCommand]);
      assert.ok(own, 'H02 the transition wrote its event under the COMMAND identity');
      assert.equal(own.experience_id, ids.experience);
      assert.equal(own.experience_version_id, ids.version, 'H02 naming the exact version the command bound');
      assert.equal(own.to_lifecycle, 'READY_FOR_REVIEW');
      assert.equal(own.occurred_at.getTime(), ready.committed_at.getTime());
      await actAs(f.mohamed);
      assert.equal((await rt.commitReady(ids.readyCommand, ids.experience, ids.version))[0].current_lifecycle,
        own.to_lifecycle, 'H02 and the retry answers THAT event');
    });

    await report.isolated('H03 PUBLISH binds the exact lifecycle event its command id names', async () => {
      const ids = freshIds();
      await draftToReady(f, ids);
      const [published] = await rt.publishCleared(seam, f.mohamed, ids.publishCommand, ids.experience, ids.version);
      await asRole('postgres');
      const [own] = await rows(`SELECT * FROM ${LIFECYCLE_EVENTS} WHERE id = $1`, [ids.publishCommand]);
      assert.ok(own, 'H03 the publication wrote its event under the COMMAND identity');
      assert.equal(own.experience_version_id, ids.version);
      assert.equal(own.to_lifecycle, 'PUBLISHED');
      assert.equal(own.occurred_at.getTime(), published.committed_at.getTime());
      await actAs(f.mohamed);
      assert.equal((await rt.publish(ids.publishCommand, ids.experience, ids.version))[0].current_lifecycle,
        own.to_lifecycle, 'H03 and the retry answers THAT event');
    });

    await report.isolated('H04 a missing exact event fails closed, with a plausible one present', async () => {
      const ids = freshIds();
      const { drafted } = await draftToReady(f, ids);
      await asRole('postgres');
      // Remove the command's OWN event and plant another one for the same
      // Experience, at the same instant, saying exactly what the retry wants to
      // hear. A temporal reconstruction would answer from it. This must not.
      await q(`ALTER TABLE ${LIFECYCLE_EVENTS} DISABLE TRIGGER ${LIFECYCLE_GUARD}`);
      await q(`DELETE FROM ${LIFECYCLE_EVENTS} WHERE id = $1`, [ids.draftCommand]);
      await q(`INSERT INTO ${LIFECYCLE_EVENTS}
                 (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
               VALUES ($1, $2, NULL, NULL, 'DRAFT', $3)`,
      [randomUUID(), ids.experience, drafted.committed_at]);
      await q(`ALTER TABLE ${LIFECYCLE_EVENTS} ENABLE TRIGGER ${LIFECYCLE_GUARD}`);
      assert.equal(await count(LIFECYCLE_EVENTS, 'experience_id = $1', [ids.experience]), 2,
        'H04 a plausible event, and the READY one, are both there');
      await actAs(f.mohamed);
      await rejected(() => publicDraft(ids.draftCommand, ids.experience), CONTRADICTORY,
        /CONTRADICTORY_HISTORY/u);
    });

    await report.isolated('H05 an exact event that contradicts its command fails closed', async () => {
      const ids = freshIds();
      await draftToReady(f, ids);
      await asRole('postgres');
      await q(`ALTER TABLE ${LIFECYCLE_EVENTS} DISABLE TRIGGER ${LIFECYCLE_GUARD}`);
      // The event still carries the command identity, and now disagrees about
      // which lifecycle that command committed.
      await q(`UPDATE ${LIFECYCLE_EVENTS} SET from_lifecycle = 'DRAFT', to_lifecycle = 'PUBLISHED' WHERE id = $1`,
        [ids.readyCommand]);
      await q(`ALTER TABLE ${LIFECYCLE_EVENTS} ENABLE TRIGGER ${LIFECYCLE_GUARD}`);
      await actAs(f.mohamed);
      await rejected(() => rt.commitReady(ids.readyCommand, ids.experience, ids.version), CONTRADICTORY,
        /CONTRADICTORY_HISTORY/u);
      // And an instant that is not the command's own instant is contradictory too.
      await asRole('postgres');
      await q(`ALTER TABLE ${LIFECYCLE_EVENTS} DISABLE TRIGGER ${LIFECYCLE_GUARD}`);
      await q(`UPDATE ${LIFECYCLE_EVENTS}
                  SET from_lifecycle = 'DRAFT', to_lifecycle = 'READY_FOR_REVIEW',
                      occurred_at = occurred_at + interval '1 second' WHERE id = $1`, [ids.readyCommand]);
      await q(`ALTER TABLE ${LIFECYCLE_EVENTS} ENABLE TRIGGER ${LIFECYCLE_GUARD}`);
      await actAs(f.mohamed);
      await rejected(() => rt.commitReady(ids.readyCommand, ids.experience, ids.version), CONTRADICTORY,
        /CONTRADICTORY_HISTORY/u);
    });

    await report.isolated('H06 a no-op disappearance command STORES its exact answer', async () => {
      const ids = freshIds();
      await draftToReady(f, ids);
      await rt.publishCleared(seam, f.mohamed, ids.publishCommand, ids.experience, ids.version);
      await asRole('postgres');
      const reconcileCommand = randomUUID();
      const [eligible] = await rt.reconcileDisappearance(reconcileCommand, ids.experience);
      assert.equal(eligible.outcome, 'STILL_ELIGIBLE');
      const [stored] = await rows(`SELECT * FROM ${DISAPPEARANCE_COMMANDS} WHERE id = $1`, [reconcileCommand]);
      assert.equal(stored.committed_lifecycle, 'PUBLISHED', 'H06 the lifecycle it returned is durable');
      assert.equal(stored.committed_absent_experience_version_id, null,
        'H06 and so is the ABSENCE OF an absent version, which the command target does not record');
      assert.equal(stored.committed_disappearance_basis, null);
      assert.notEqual(stored.target_experience_version_id, null,
        'H06 the target it bound is still there and is deliberately NOT the answer');
      // THE ANSWER IS READ FROM THE ROW, not reconstructed: with every lifecycle
      // event of this Experience gone, a temporal reconstruction is impossible
      // and the retry still answers.
      await q(`ALTER TABLE ${LIFECYCLE_EVENTS} DISABLE TRIGGER ${LIFECYCLE_GUARD}`);
      await q(`DELETE FROM ${LIFECYCLE_EVENTS} WHERE experience_id = $1`, [ids.experience]);
      await q(`ALTER TABLE ${LIFECYCLE_EVENTS} ENABLE TRIGGER ${LIFECYCLE_GUARD}`);
      const [retry] = await rt.reconcileDisappearance(reconcileCommand, ids.experience);
      assert.equal(retry.outcome, 'ALREADY_COMMITTED');
      assert.equal(retry.current_lifecycle, 'PUBLISHED', 'H06 from the stored answer alone');
      assert.equal(retry.absent_experience_version_id, null);
      assert.equal(retry.disappearance_basis, null);
    });

    await report.isolated('H07 an actual disappearance stores its exact answer too', async () => {
      const ids = freshIds();
      await draftToReady(f, ids);
      await rt.publishCleared(seam, f.mohamed, ids.publishCommand, ids.experience, ids.version);
      await actAs(f.mohamed);
      await rt.removeFromPublicWorld(ids.removeCommand, ids.experience, ids.version);
      await asRole('postgres');
      const [stored] = await rows(`SELECT * FROM ${DISAPPEARANCE_COMMANDS} WHERE id = $1`, [ids.removeCommand]);
      assert.equal(stored.committed_lifecycle, 'ABSENT_FROM_PUBLIC_WORLD');
      assert.equal(stored.committed_absent_experience_version_id, ids.version);
      assert.equal(stored.committed_disappearance_basis, 'AUTHORIZED_CONTROLLER_REMOVAL');
      await q(`ALTER TABLE ${LIFECYCLE_EVENTS} DISABLE TRIGGER ${LIFECYCLE_GUARD}`);
      await q(`DELETE FROM ${LIFECYCLE_EVENTS} WHERE experience_id = $1`, [ids.experience]);
      await q(`ALTER TABLE ${LIFECYCLE_EVENTS} ENABLE TRIGGER ${LIFECYCLE_GUARD}`);
      await actAs(f.mohamed);
      const [retry] = await rt.removeFromPublicWorld(ids.removeCommand, ids.experience, ids.version);
      assert.equal(retry.absent_experience_version_id, ids.version,
        'H07 the retry is independent of every current state, including the event log');
      assert.equal(retry.disappearance_basis, 'AUTHORIZED_CONTROLLER_REMOVAL');
      assert.equal(retry.current_lifecycle, 'ABSENT_FROM_PUBLIC_WORLD');
    });

    await report.isolated('H08 a pre-0121 no-op reconstructs only when unique, else fails closed', async () => {
      const ids = freshIds();
      await draftToReady(f, ids);
      await rt.publishCleared(seam, f.mohamed, ids.publishCommand, ids.experience, ids.version);
      await asRole('postgres');
      const reconcileCommand = randomUUID();
      await rt.reconcileDisappearance(reconcileCommand, ids.experience);
      // EXACTLY THE SHAPE A COMMAND COMMITTED BEFORE THIS MIGRATION HAS.
      await q(`UPDATE ${DISAPPEARANCE_COMMANDS}
                  SET committed_lifecycle = NULL, committed_disappearance_basis = NULL,
                      committed_absent_experience_version_id = NULL WHERE id = $1`, [reconcileCommand]);
      const [legacy] = await rt.reconcileDisappearance(reconcileCommand, ids.experience);
      assert.equal(legacy.current_lifecycle, 'PUBLISHED',
        'H08 the legacy fallback reconstructs it from the immutable event log');
      assert.equal(legacy.absent_experience_version_id, null);
      // NOW MAKE THE EVIDENCE AMBIGUOUS. Two events share the latest instant,
      // so "the latest one" is no longer a fact, and the fallback fails closed
      // rather than choosing.
      await q(`ALTER TABLE ${LIFECYCLE_EVENTS} DISABLE TRIGGER ${LIFECYCLE_GUARD}`);
      await q(`INSERT INTO ${LIFECYCLE_EVENTS}
                 (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
               SELECT $1, le.experience_id, le.experience_version_id, 'PUBLISHED',
                      'ABSENT_FROM_PUBLIC_WORLD', le.occurred_at
                 FROM ${LIFECYCLE_EVENTS} le WHERE le.id = $2`, [randomUUID(), ids.publishCommand]);
      await q(`ALTER TABLE ${LIFECYCLE_EVENTS} ENABLE TRIGGER ${LIFECYCLE_GUARD}`);
      await rejected(() => rt.reconcileDisappearance(reconcileCommand, ids.experience), CONTRADICTORY,
        /CONTRADICTORY_HISTORY/u);
      // AND THE SAME AMBIGUITY CANNOT REACH A COMMAND THAT BINDS ITS OWN EVENT.
      await actAs(f.mohamed);
      assert.equal((await rt.publish(ids.publishCommand, ids.experience, ids.version))[0].current_lifecycle,
        'PUBLISHED', 'H08 a command-bound answer is untouched by a second event at the same instant');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// ---------------------------------------------------------------------- main
await runVerifier('0121', async (stage) => {
  await rt.client.connect();
  const report = createScenarioReport('0121', { query: q, restore: () => asRole('postgres') });

  stage('posture');
  await report.section('P01 posture: signatures, result columns, ACLs and the new derivations', verifyPosture);
  await report.section('P02 the Public lifecycle event log is complete', verifyLifecycleLogComplete);

  stage('replay fixture');
  const rf = { creator: randomUUID(), creatorRef: randomUUID(), experience: null };
  rf.humans = [rf.creator];
  let base = null;
  const pf = rt.newFixture();
  const publicHumans = [pf.mohamed, pf.hadir, pf.stranger, pf.reader];
  const seam = await rt.captureSeam();
  try {
    await q('BEGIN');
    try {
      await asRole('postgres');
      await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [rf.humans]);
      base = await rt.provisionFinalizedReplay(rf.creator);
      rf.experience = await rt.provisionControlledExperience(rf.creator, rf.creatorRef, 'the replay publisher');
      await asRole('postgres');
    } finally {
      await q('COMMIT');
    }

    stage('ASSURE-F03 consent composition');
    await verifyConsentComposition(report, rf, base);

    // THE SHARED SOURCE ONLY, deliberately. `provision` would also commit a
    // Personal Session, turns and units, and the canonical Public teardown does
    // not own those - it would leave a `conversation_sessions` row holding the
    // fixture human by a restrictive foreign key. Nothing in the ASSURE-F09
    // matrix needs a MY_WORLD item: every package below is one Shared material.
    stage('public fixture');
    await q('BEGIN');
    try {
      await asRole('postgres');
      await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [publicHumans]);
      await rt.provisionWorld(pf, pf.world);
      await rt.provisionIdentities(pf);
      await asRole('postgres');
    } finally {
      await q('COMMIT');
    }

    stage('ASSURE-F09 historical answers');
    await verifyHistoricalAnswers(report, pf, seam);
  } finally {
    stage('fixture removal');
    await asRole('postgres');
    // A TEARDOWN FAILURE IS A FINDING, not something to swallow: a run that
    // left committed fixtures behind would make the next one prove less.
    await rt.restorePrerequisites(seam);
    await rt.removeCommittedFixtures({ humans: publicHumans, experiences: [], world: pf.world });
    await rt.removeCommittedDistributions(rf.humans);
    await rt.removeCommittedReplayVersions(rf.humans);
    await rt.removeCommittedReplays(rf.humans);
    await rt.removePublicReplayFixture([rf.experience].filter(Boolean));
    await rt.removePublicIdentities(rf.humans);
    await rt.removeHistoricalFixture(rf.humans);
    await rt.removeFixtureHumans(rf.humans);
  }

  stage('report');
  await asRole('postgres');
  await report.section('the catalog is exactly what the migration installed, after every fixture is gone',
    verifyPosture);
  report.print();
  report.assertAllPassed();

  // THE CW2-08 SEAMS ARE FAIL-CLOSED AGAIN.
  const [{ prosrc: publicSeam }] = await rows(
    'SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
    ['public.resolve_public_publication_prerequisites_v1(uuid, uuid)']);
  assert.match(publicSeam, /NOT_EVALUATED/u, 'the CW2-08 Public seam is fail-closed again after the run');
  assert.doesNotMatch(publicSeam, /'CLEARED'/u, 'and answers CLEARED to nobody');
  const [{ prosrc: replaySeam }] = await rows(
    'SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [DFN.PREREQUISITE_SEAM]);
  assert.match(replaySeam, /NOT_EVALUATED/u, 'and so is the Replay distribution seam');

  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${T.EXPERIENCES} WHERE id = ANY($2::uuid[]))
          + (SELECT count(*) FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM public.public_identity_commands WHERE actor_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`,
    [[...rf.humans, ...publicHumans], [rf.experience].filter(Boolean)]);
  assert.equal(Number(residue), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
