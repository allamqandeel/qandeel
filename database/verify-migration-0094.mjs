// Real-PostgreSQL verifier for migration 0094 - I-05B Public Publication
// Effective Approval State v1 (PART A).
//
// Runs against a FULLY migrated database and proves, from live catalogs and
// live execution:
//
//   catalog / posture
//     * the two derivations are STABLE, write nothing and are executable by no
//       application role; the withdrawal is VOLATILE and executable by nobody;
//     * the withdrawal event is append-only for every role and binds the exact
//       (manifest, approver) pair of the immutable 0092 evidence;
//     * the frozen 0092 approval evidence stays append-only.
//
//   effective approval state
//     * E01 a fresh approval is EFFECTIVE, and the manifest-level view lists it;
//     * E02 the exact historical rightsholder - a FORMER Shared member - withdraws
//       her own approval; the approval row is untouched evidence; no Shared
//       browsing is regained and no control is granted;
//     * E03 repeated identical withdrawals are idempotent; a second withdrawal of
//       the same approval is ALREADY_WITHDRAWN and not a second event;
//     * E04 the controller, a co-rightsholder, a stranger and a guessed identifier
//       all fail with ONE bounded class - no existence oracle;
//     * E05 a later preparation SUPERSEDES the older approval by derivation, and
//       nothing transfers to the new manifest;
//     * E06 a new manifest starts MISSING for every required human and an approval
//       of the new manifest is EFFECTIVE for it alone;
//     * E07 a changed Public World authority snapshot changes the current
//       fingerprint while the bound fingerprint stays historical;
//     * E08 I-05A's frozen READY commit counts historical rows and is NOT the
//       publication gate: READY still commits after a withdrawal, which is why
//       0095 must revalidate effective state at publish time.
//
//   concurrency (committed fixtures, two connections, database-bounded waits)
//     * C01 withdrawal versus a competing preparation serializes on the Experience
//       row and WITHDRAWN dominates SUPERSEDED;
//     * C02 duplicate withdrawal commands from two connections produce ONE event.
//
//   forward safety inside a rolled-back SAVEPOINT, then every regression to
//   something 0094 OWNS planted and still refused; and zero fixture residue.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, NONE, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, count, actAs, asRole, rejected } = rt;

const DERIVATIONS = [
  'public.derive_publication_approval_effective_state_v1(uuid)',
  'public.derive_publication_manifest_effective_approvals_v1(uuid)',
];
const WITHDRAWAL = 'public.withdraw_publication_approval_v1(uuid, uuid)';
const TRIGGER_FN = 'public.reject_publication_approval_state_mutation_v1()';
const OWN_TABLES = [T.WITHDRAWAL_COMMANDS, T.WITHDRAWAL_EVENTS];

async function verifyCatalog() {
  await rt.verifyPosture({
    internal: [...DERIVATIONS, WITHDRAWAL],
    triggers: [TRIGGER_FN],
    reading: DERIVATIONS,
    mutating: [WITHDRAWAL],
    tables: OWN_TABLES,
    immutable: [[T.WITHDRAWAL_EVENTS, 'publication_approval_withdrawal_events_immutable'],
      [T.APPROVALS, 'publication_manifest_approvals_immutable']],
  });
  const state = await rt.functionPosture(DERIVATIONS[0]);
  for (const needle of ['WITHDRAWN', 'SUPERSEDED', 'EFFECTIVE', 'publication_approval_withdrawal_events', 'current_experience_version_id']) {
    assert.ok(state.prosrc.includes(needle), `the effective-state derivation decides from ${needle}`);
  }
  const manifestView = await rt.functionPosture(DERIVATIONS[1]);
  assert.ok(manifestView.prosrc.includes("'MISSING'"), 'a required approval never given is MISSING');
  const withdrawal = await rt.functionPosture(WITHDRAWAL);
  assert.ok(withdrawal.prosrc.includes('auth.uid()') && withdrawal.prosrc.includes('approval.approver_user_id <> u'),
    'withdrawal requires the exact historical rightsholder the approval represents');
  for (const forbidden of ['shared_world_membership_episodes', 'public_experience_controllers',
    'shared_world_history_access_grants', 'shared_world_standard_closed_view_entitlements']) {
    assert.ok(!withdrawal.prosrc.includes(forbidden), `withdrawal reads no ${forbidden}: membership is not rightsholder authority`);
  }
  assert.doesNotMatch(withdrawal.prosrc,
    /(INSERT INTO|UPDATE|DELETE FROM) public\.(publication_manifest_approvals|publication_manifest_required_approvers|public_experience_controllers|shared_world|conversation_|users)/u,
    'withdrawal mutates no approval evidence, no control and no predecessor state');
  assert.ok(withdrawal.prosrc.includes('FROM public.public_world_state w WHERE w.singleton FOR UPDATE'),
    'withdrawal takes the canonical Public lock prefix');
  for (const fn of [...DERIVATIONS, WITHDRAWAL]) {
    for (const name of await rt.inputParameters(fn)) {
      assert.doesNotMatch(name, /approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|effective|state|reason|fingerprint/u,
        `${fn} may not accept ${name}`);
    }
  }
  const [fk] = await rows(
    `SELECT c.confdeltype, ns.nspname || '.' || cl.relname AS parent FROM pg_constraint c
       JOIN pg_class cl ON cl.oid = c.confrelid JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      WHERE c.conrelid = $1::regclass AND c.conname = 'publication_approval_withdrawal_events_approver_fk'`, [T.WITHDRAWAL_EVENTS]);
  assert.ok(fk, 'the withdrawal binds the (manifest, approver) pair by foreign key');
  assert.equal(fk.parent, 'public.publication_manifest_approvals');
  assert.equal(fk.confdeltype, 'r', 'restrictively');
}

async function verifyEffectiveState(f) {
  const ready = await rt.bringToReady(f, { experience: f.experience, manifest: f.manifest, version: f.version, personal: false });
  assert.deepEqual([...ready.required].sort(), [f.mohamed, f.hadir].sort(), 'fixture: both humans are required');
  const hadirApproval = ready.approvals.get(f.hadir);
  const mohamedApproval = ready.approvals.get(f.mohamed);

  // E01 fresh approvals are EFFECTIVE, bound to the current fingerprint.
  const [s1] = await rt.deriveApprovalState(hadirApproval);
  assert.equal(s1.effective_state, 'EFFECTIVE', 'E01 a fresh approval is EFFECTIVE');
  assert.equal(s1.approving_user_id, f.hadir);
  assert.equal(s1.approved_manifest_version_id, f.manifest);
  assert.equal(s1.bound_authority_fingerprint, ready.fingerprint, 'E01 and it binds the fingerprint READY committed');
  assert.equal(s1.withdrawn_at, null);
  assert.equal(s1.superseding_experience_version_id, null);
  const view = await rt.deriveManifestApprovals(f.manifest);
  assert.deepEqual(view.map((r) => [r.approving_user_id, r.effective_state]).sort(),
    [[f.mohamed, 'EFFECTIVE'], [f.hadir, 'EFFECTIVE']].sort(), 'E01 the manifest view lists every required human as EFFECTIVE');
  assert.deepEqual(await rt.deriveApprovalState(randomUUID()), [], 'an approval that does not exist derives zero rows');
  assert.deepEqual(await rt.deriveManifestApprovals(randomUUID()), [], 'and so does a manifest that does not exist');

  // E04 unauthorized withdrawal fails with ONE bounded class, before any lock.
  await actAs(f.mohamed);
  const byController = await rejected(() => rt.withdraw(randomUUID(), hadirApproval), ['P0002'], /PUBLIC_EXPERIENCE_NOT_AVAILABLE/u);
  await actAs(f.stranger);
  const byStranger = await rejected(() => rt.withdraw(randomUUID(), hadirApproval), ['P0002'], /PUBLIC_EXPERIENCE_NOT_AVAILABLE/u);
  const byGuess = await rejected(() => rt.withdraw(randomUUID(), randomUUID()), ['P0002'], /PUBLIC_EXPERIENCE_NOT_AVAILABLE/u);
  assert.equal(byController.message, byGuess.message, 'E04 the controller learns nothing about whether the approval exists');
  assert.equal(byStranger.message, byGuess.message, 'E04 and neither does a stranger');
  await actAs(null);
  await rejected(() => rt.withdraw(randomUUID(), hadirApproval), ['42501'], /PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED/u);
  await actAs(f.hadir);
  await rejected(() => rt.withdraw(null, hadirApproval), ['22023']);
  assert.equal(await count(T.WITHDRAWAL_EVENTS, 'manifest_version_id = $1', [f.manifest]), 0, 'E04 nothing was recorded');

  // E02 the exact historical rightsholder withdraws. Hadir is a FORMER member.
  const [{ n: open }] = await rows(
    'SELECT count(*) n FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL',
    [f.world, f.hadir]);
  assert.equal(Number(open), 0, 'E02 fixture: Hadir has no open episode');
  const approvalBefore = await rows(`SELECT * FROM ${T.APPROVALS} WHERE id = $1`, [hadirApproval]);
  const command = randomUUID();
  const [withdrawn] = await rt.withdraw(command, hadirApproval);
  assert.equal(withdrawn.outcome, 'WITHDRAWN');
  assert.equal(withdrawn.effective_state, 'WITHDRAWN');
  assert.equal(withdrawn.approval_id, hadirApproval);
  assert.equal(withdrawn.approved_manifest_version_id, f.manifest);
  const [s2] = await rt.deriveApprovalState(hadirApproval);
  assert.equal(s2.effective_state, 'WITHDRAWN', 'E02 the derivation reports WITHDRAWN');
  assert.ok(s2.withdrawn_at instanceof Date);
  assert.deepEqual(await rows(`SELECT * FROM ${T.APPROVALS} WHERE id = $1`, [hadirApproval]), approvalBefore,
    'E02 the historical approval row is untouched evidence');
  const [event] = await rows(`SELECT * FROM ${T.WITHDRAWAL_EVENTS} WHERE approval_id = $1`, [hadirApproval]);
  assert.equal(event.id, command, 'the event reuses the command identity');
  assert.equal(event.approver_user_id, f.hadir);
  assert.equal(event.manifest_version_id, f.manifest);
  const [{ n: stillClosed }] = await rows(
    'SELECT count(*) n FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL',
    [f.world, f.hadir]);
  assert.equal(Number(stillClosed), 0, 'E02 withdrawing regains no Shared browsing');
  assert.deepEqual((await rows(`SELECT controller_user_id FROM ${T.CONTROLLERS} WHERE experience_id = $1`, [f.experience])).map((r) => r.controller_user_id),
    [f.mohamed], 'E02 withdrawing grants no Experience control');
  // The manifest view now shows one WITHDRAWN and one EFFECTIVE.
  const viewAfter = await rt.deriveManifestApprovals(f.manifest);
  assert.deepEqual(viewAfter.map((r) => [r.approving_user_id, r.effective_state]).sort(),
    [[f.mohamed, 'EFFECTIVE'], [f.hadir, 'WITHDRAWN']].sort());
  // The event is append-only for the owner too.
  await asRole('postgres');
  await rejected(() => q(`DELETE FROM ${T.WITHDRAWAL_EVENTS} WHERE approval_id = $1`, [hadirApproval]), ['55000'],
    /PUBLICATION_APPROVAL_STATE_IS_IMMUTABLE/u);
  await rejected(() => q(`UPDATE ${T.WITHDRAWAL_EVENTS} SET occurred_at = occurred_at WHERE approval_id = $1`, [hadirApproval]), ['55000']);
  // And a withdrawal for a human the manifest's evidence never named is
  // unrepresentable: the (manifest, approver) pair must exist in the approvals.
  await rejected(() => q(`INSERT INTO ${T.WITHDRAWAL_EVENTS} (id, approval_id, manifest_version_id, approver_user_id, occurred_at)
                          VALUES ($1, $2, $3, $4, now())`, [randomUUID(), mohamedApproval, f.manifest, f.stranger]), ['23503']);

  // E03 idempotency.
  await actAs(f.hadir);
  const [retry] = await rt.withdraw(command, hadirApproval);
  assert.equal(retry.outcome, 'ALREADY_COMMITTED');
  assert.equal(retry.effective_state, 'WITHDRAWN');
  await rejected(() => rt.withdraw(command, mohamedApproval), ['23505'], /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
  const [again] = await rt.withdraw(randomUUID(), hadirApproval);
  assert.equal(again.outcome, 'ALREADY_WITHDRAWN', 'E03 a second withdrawal is not an error');
  assert.equal(await count(T.WITHDRAWAL_EVENTS, 'approval_id = $1', [hadirApproval]), 1, 'E03 and not a second event');
  assert.equal(await count(T.WITHDRAWAL_COMMANDS, 'approval_id = $1', [hadirApproval]), 2, 'E03 both commands are durable');

  // E08 the frozen READY commit is NOT the publication gate. On a fresh Experience,
  // a withdrawal before READY does not stop the I-05A commit - which is exactly
  // why publication must re-read effective state.
  await actAs(f.mohamed);
  const exp2 = randomUUID(); const m2 = randomUUID(); const v2 = randomUUID();
  await rt.createDraft(randomUUID(), exp2);
  await rt.prepare(randomUUID(), exp2, m2, v2, NONE, NONE, [randomUUID()], [f.world], [f.hadirMaterial]);
  await actAs(f.hadir);
  const a2 = randomUUID();
  await rt.approve(a2, m2);
  await rt.withdraw(randomUUID(), a2);
  await actAs(f.mohamed);
  const [ready2] = await rt.commitReady(randomUUID(), exp2, v2);
  assert.equal(ready2.outcome, 'READY_FOR_REVIEW',
    'E08 the frozen READY commit counts historical rows: READY is not publication, and the publish boundary is where effectiveness binds');
  assert.equal((await rt.deriveApprovalState(a2))[0].effective_state, 'WITHDRAWN');

  // E05 / E06 supersession by a later preparation, on a DRAFT Experience.
  const exp3 = randomUUID(); const m3 = randomUUID(); const v3 = randomUUID();
  await rt.createDraft(randomUUID(), exp3);
  await rt.prepare(randomUUID(), exp3, m3, v3, NONE, NONE, [randomUUID()], [f.world], [f.mohamedMaterial]);
  const a3 = randomUUID();
  await rt.approve(a3, m3);
  assert.equal((await rt.deriveApprovalState(a3))[0].effective_state, 'EFFECTIVE');
  const m4 = randomUUID(); const v4 = randomUUID();
  await rt.prepare(randomUUID(), exp3, m4, v4, NONE, NONE, [randomUUID(), randomUUID()], [f.world, f.world], [f.mohamedMaterial, f.hadirMaterial]);
  const [s3] = await rt.deriveApprovalState(a3);
  assert.equal(s3.effective_state, 'SUPERSEDED', 'E05 a later preparation supersedes the older approval');
  assert.equal(s3.superseding_experience_version_id, v4, 'E05 and names the version that superseded it');
  assert.deepEqual((await rt.deriveManifestApprovals(m4)).map((r) => r.effective_state), ['MISSING', 'MISSING'],
    'E06 the new manifest starts MISSING for every required human: nothing transferred');
  assert.equal(await count(T.APPROVALS, 'manifest_version_id = $1', [m4]), 0,
    'E06 the older approval binds the older manifest by foreign key and cannot float onto the new one');
  await actAs(f.hadir);
  const a4 = randomUUID();
  await rt.approve(a4, m4);
  assert.deepEqual((await rt.deriveManifestApprovals(m4)).map((r) => [r.approving_user_id, r.effective_state]).sort(),
    [[f.mohamed, 'MISSING'], [f.hadir, 'EFFECTIVE']].sort(), 'E06 an approval of the new manifest is effective for it alone');
  assert.equal((await rt.deriveApprovalState(a3))[0].effective_state, 'SUPERSEDED', 'E06 the old one stays superseded');
  // A superseded approval may still be withdrawn: the human act is recorded and dominates.
  await actAs(f.mohamed);
  const [wSup] = await rt.withdraw(randomUUID(), a3);
  assert.equal(wSup.outcome, 'WITHDRAWN');
  assert.equal((await rt.deriveApprovalState(a3))[0].effective_state, 'WITHDRAWN', 'a human act dominates structural supersession');

  // E07 a changed authority snapshot changes the CURRENT fingerprint; the bound
  // fingerprint stays what it was, which is how 0095 detects staleness.
  await q('SAVEPOINT snapshot');
  await q(`UPDATE ${T.WORLD} SET state_version = state_version + 1`);
  const [{ authority_fingerprint: nowDerived }] = await rt.deriveAuthority(m4);
  const [s4] = await rt.deriveApprovalState(a4);
  assert.equal(s4.effective_state, 'EFFECTIVE', 'E07 the human act is unchanged');
  assert.notEqual(s4.bound_authority_fingerprint, nowDerived, 'E07 but the approval no longer binds the current fingerprint');
  await q('ROLLBACK TO SAVEPOINT snapshot'); await q('RELEASE SAVEPOINT snapshot');

  // No application role can reach anything created here.
  for (const role of APP_ROLES) {
    await q('SAVEPOINT v');
    await asRole(role, f.hadir);
    for (const table of OWN_TABLES) await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), ['42501']);
    await rejected(() => rt.withdraw(randomUUID(), hadirApproval), ['42501']);
    await rejected(() => rt.deriveApprovalState(hadirApproval), ['42501']);
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT v'); await q('RELEASE SAVEPOINT v');
  }
  return { hadirApproval, mohamedApproval };
}

async function verifyForwardSafety(f, ids) {
  await q('SAVEPOINT forward_safety');
  try {
    // A later reviewed slice: an I-05C absence writer, a supersession audit, a launch gate.
    await q(`CREATE TABLE public.i05b94_probe_supersession_audit (
               approval_id uuid PRIMARY KEY REFERENCES ${T.APPROVALS} (id), noted_at timestamptz NOT NULL)`);
    await q('CREATE TABLE public.i05b94_probe_launch_gate (id uuid PRIMARY KEY, capability text NOT NULL)');
    await q(`CREATE FUNCTION public.i05b94_probe_absence_v1(p_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN UPDATE public.public_experiences e
                      SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD' WHERE e.id = p_id; END$fn$`);
    await q(`ALTER TABLE ${T.WITHDRAWAL_COMMANDS} ADD COLUMN i05b94_probe_note text`);
    await q(`CREATE INDEX i05b94_probe_idx ON ${T.WITHDRAWAL_EVENTS} (occurred_at)`);
    await verifyCatalog();

    const refuses = { name: 'AssertionError' };
    await q('SAVEPOINT r1');
    await q(`GRANT EXECUTE ON FUNCTION ${WITHDRAWAL} TO authenticated`);
    await assert.rejects(verifyCatalog(), refuses, 'withdrawal becoming reachable before the Launch Gate is a regression');
    await q('ROLLBACK TO SAVEPOINT r1');

    await q('SAVEPOINT r2');
    await q(`ALTER TABLE ${T.WITHDRAWAL_EVENTS} DISABLE TRIGGER publication_approval_withdrawal_events_immutable`);
    await assert.rejects(verifyCatalog(), refuses, 'a withdrawal event becoming mutable is a regression');
    await q('ROLLBACK TO SAVEPOINT r2');

    await q('SAVEPOINT r3');
    // A derivation that forgets the withdrawal events would report a withdrawn
    // approval as EFFECTIVE. Same signature, so CREATE OR REPLACE installs it.
    await q(`CREATE OR REPLACE FUNCTION public.derive_publication_approval_effective_state_v1(p_approval_id uuid)
             RETURNS TABLE(approval_id uuid, approved_manifest_version_id uuid, approving_user_id uuid,
                           effective_state text, bound_authority_fingerprint text, withdrawn_at timestamptz,
                           superseding_experience_version_id uuid)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
             BEGIN RETURN QUERY SELECT a.id, a.manifest_version_id, a.approver_user_id, 'EFFECTIVE'::text,
                                       a.bound_authority_fingerprint, NULL::timestamptz, NULL::uuid
                                  FROM public.publication_manifest_approvals a WHERE a.id = p_approval_id; END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'a derivation that ignores withdrawal is a regression');
    // And the mutant really would have lied:
    assert.equal((await rt.deriveApprovalState(ids.hadirApproval))[0].effective_state, 'EFFECTIVE',
      'anti-vacuity: the mutant reports the withdrawn approval as EFFECTIVE, which the catalog check refused');
    await q('ROLLBACK TO SAVEPOINT r3');
    assert.equal((await rt.deriveApprovalState(ids.hadirApproval))[0].effective_state, 'WITHDRAWN', 'the real derivation is back');

    await q('SAVEPOINT r4');
    await q(`ALTER TABLE ${T.WITHDRAWAL_EVENTS} DISABLE ROW LEVEL SECURITY`);
    await assert.rejects(verifyCatalog(), refuses, 'a relation losing RLS is a regression');
    await q('ROLLBACK TO SAVEPOINT r4');
  } finally {
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
  }
}

async function verifyConcurrency(c) {
  const { q2, actAs2, close } = await rt.openSecondary();
  try {
    // C01 WITHDRAWAL VERSUS A COMPETING PREPARATION. The preparation holds the
    // Experience row; the withdrawal blocks on it; whichever order they land in,
    // the human act is recorded and dominates the structural supersession.
    console.log('0094 concurrency C01 start');
    await asRole('postgres');
    await actAs(c.mohamed);
    const m1 = randomUUID(); const v1 = randomUUID();
    await rt.prepare(randomUUID(), c.experience, m1, v1, NONE, NONE, [randomUUID()], [c.world], [c.hadirMaterial]);
    await actAs(c.hadir);
    const a1 = randomUUID();
    await rt.approve(a1, m1);

    await q('BEGIN');
    await actAs(c.mohamed);
    await rt.prepare(randomUUID(), c.experience, randomUUID(), randomUUID(), NONE, NONE,
      [randomUUID(), randomUUID()], [c.world, c.world], [c.hadirMaterial, c.mohamedMaterial]);
    await q2('BEGIN');
    await actAs2(c.hadir);
    const blocked = q2('SELECT * FROM public.withdraw_publication_approval_v1($1, $2)', [randomUUID(), a1]);
    assert.equal(await rt.stillPending(blocked), true, 'C01 the withdrawal blocks on the Experience the preparation holds');
    await q('COMMIT');
    const [w] = (await blocked).rows;
    await q2('COMMIT');
    assert.equal(w.outcome, 'WITHDRAWN');
    assert.equal((await rt.deriveApprovalState(a1))[0].effective_state, 'WITHDRAWN',
      'C01 the human act dominates the supersession the preparation caused');
    console.log('0094 concurrency C01 pass');

    // C02 DUPLICATE WITHDRAWAL COMMANDS from two connections: one event.
    console.log('0094 concurrency C02 start');
    await actAs(c.mohamed);
    const m2 = randomUUID(); const v2 = randomUUID();
    await rt.prepare(randomUUID(), c.experience, m2, v2, NONE, NONE, [randomUUID()], [c.world], [c.hadirMaterial]);
    await actAs(c.hadir);
    const a2 = randomUUID();
    await rt.approve(a2, m2);
    const command = randomUUID();
    await q('BEGIN');
    await actAs(c.hadir);
    const [first] = await rt.withdraw(command, a2);
    assert.equal(first.outcome, 'WITHDRAWN');
    await q2('BEGIN');
    await actAs2(c.hadir);
    const duplicate = q2('SELECT * FROM public.withdraw_publication_approval_v1($1, $2)', [command, a2]);
    assert.equal(await rt.stillPending(duplicate), true, 'C02 the duplicate blocks behind the first');
    await q('COMMIT');
    const [second] = (await duplicate).rows;
    await q2('COMMIT');
    assert.equal(second.outcome, 'ALREADY_COMMITTED', 'C02 the duplicate is served from the durable command');
    assert.equal(await count(T.WITHDRAWAL_EVENTS, 'approval_id = $1', [a2]), 1, 'C02 exactly one event');
    console.log('0094 concurrency C02 pass');
  } finally {
    await close();
  }
}

await runVerifier('0094', async (stage) => {
  await rt.client.connect();
  stage('catalog');
  await asRole('postgres');
  await verifyCatalog();

  const f = rt.newFixture();
  await q('BEGIN');
  let ids;
  try {
    stage('fixtures');
    await rt.provision(f);
    await rt.provisionIdentities(f);
    stage('effective approval state');
    ids = await verifyEffectiveState(f);
    stage('forward safety');
    await asRole('postgres');
    await verifyForwardSafety(f, ids);
  } finally {
    await q('ROLLBACK');
  }

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
      await actAs(c.mohamed);
      await rt.ensureIdentity(randomUUID(), c.mohamedRef, 'PSEUDONYM', 'concurrency publisher');
      await rt.createDraft(randomUUID(), c.experience);
      await asRole('postgres');
    } finally {
      await q('COMMIT');
    }
    await verifyConcurrency(c);
  } finally {
    stage('concurrency: fixture removal');
    await rt.removeCommittedFixtures(c);
  }

  stage('fixture residue');
  await asRole('postgres');
  const humans = [f.mohamed, f.hadir, f.stranger, f.reader, c.mohamed, c.hadir, c.stranger, c.reader];
  const [{ n }] = await rows(
    `SELECT (SELECT count(*) FROM ${T.IDENTITIES} WHERE user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${T.APPROVALS} WHERE approver_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${T.WITHDRAWAL_COMMANDS} WHERE actor_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${T.EXPERIENCES} WHERE id = ANY($2::uuid[]))
          + (SELECT count(*) FROM public.shared_worlds WHERE id = ANY($3::uuid[]))
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
          + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
    [humans, [f.experience, c.experience], [f.world, c.world]]);
  assert.equal(Number(n), 0, 'every fixture this verifier created was rolled back or removed');
  await rt.client.end();
});
