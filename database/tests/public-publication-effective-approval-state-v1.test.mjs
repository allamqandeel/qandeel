// I-05B - Public Publication Effective Approval State v1: the secret-free
// structural contract for migration 0094.
//
// Live semantics - real ACLs, real denials, the derived EFFECTIVE / WITHDRAWN /
// SUPERSEDED answer, anti-oracle refusals, concurrency and in-database forward
// safety - are proven by database/verify-migration-0094.mjs against real
// PostgreSQL. What is proven HERE is the structure a migration must already have
// before it deploys: that the historical 0092 approval evidence is never touched,
// that effective state is DERIVED from that evidence plus an append-only human
// act plus the current package pointer, that withdrawal needs the exact
// historical rightsholder from auth.uid() and never Shared membership, and that
// nothing here is executable by an application role.
//
// Every assertion is scoped to migration 0094, the verifier and support module it
// added, its registration lines, and the frozen predecessors it consumes - pinned
// by content, which proves immutability without banning additions. Its I-05B
// siblings 0095-0097 are deliberately NOT content-pinned.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { FROZEN_PREDECESSORS } from './public-runtime-frozen-predecessors.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0094_public_publication_effective_approval_state_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0094.mjs');
const support = read('../public-runtime-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);

const OWN_TABLES = ['publication_approval_withdrawal_commands', 'publication_approval_withdrawal_events'];
const DERIVATIONS = ['derive_publication_approval_effective_state_v1', 'derive_publication_manifest_effective_approvals_v1'];
const WITHDRAWAL = 'withdraw_publication_approval_v1';
const OWN_SCRIPT = 'verify:public-publication-effective-approval-state:integration';

/** The body PostgreSQL stores in `prosrc`, found by scanning to the balanced end of the argument list. */
const functionBody = (name) => {
  const start = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `migration 0094 creates ${name}`);
  let depth = 1; let i = start + `CREATE FUNCTION public.${name}(`.length;
  while (i < migration.length && depth > 0) {
    if (migration[i] === '(') depth += 1; else if (migration[i] === ')') depth -= 1;
    i += 1;
  }
  const open = migration.indexOf('AS $$', i);
  const end = migration.indexOf('$$;', open + 5);
  assert.ok(open > i && end > open, `${name} has a terminated dollar-quoted body`);
  return { header: migration.slice(i, open), body: migration.slice(open + 'AS $$'.length, end) };
};
const inputParameters = (name) => {
  const start = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  let depth = 1; let i = start + `CREATE FUNCTION public.${name}(`.length;
  const open = i;
  while (i < migration.length && depth > 0) {
    if (migration[i] === '(') depth += 1; else if (migration[i] === ')') depth -= 1;
    i += 1;
  }
  return [...migration.slice(open, i - 1).matchAll(/(p_\w+)\s+(?:uuid\[\]|text\[\]|uuid|text|integer|bigint|boolean)/gu)].map((m) => m[1]);
};

// ---------------------------------------------------------------------------

test('0094 is the forward migration after 0093, and every frozen predecessor it consumes is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0094_')).length, 1, 'exactly one migration carries the 0094 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0093_public_experience_review_ready_runtime_v1.sql'));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of FROZEN_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical: I-05B reopens no predecessor`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu);
  // The ONE statement that touches a frozen relation is the additive exact-identity
  // candidate key on the 0092 evidence (REV-01): a constraint, no row, no column, no
  // trigger, no policy. Nothing else outside the two relations 0094 created is altered.
  const foreignAlters = [...executableSql.matchAll(/^ALTER TABLE public\.(?!publication_approval_withdrawal_(?:commands|events)\b)[\s\S]*?;/gmu)]
    .map((m) => m[0].replace(/\s+/gu, ' '));
  assert.deepEqual(foreignAlters, [
    'ALTER TABLE public.publication_manifest_approvals ADD CONSTRAINT publication_manifest_approvals_exact_identity_key UNIQUE (id, manifest_version_id, approver_user_id);',
  ], 'the only frozen relation 0094 alters is the 0092 evidence, and only by adding the exact-identity candidate key');
  assert.doesNotMatch(executableSql, /(INSERT INTO|UPDATE|DELETE FROM) public\.publication_manifest_approvals\b/u,
    'no statement in 0094 writes the historical approval evidence');
});

test('effective state is DERIVED from the evidence, the human act and the current package pointer', () => {
  const state = functionBody(DERIVATIONS[0]);
  assert.match(state.header, /SECURITY DEFINER STABLE SET search_path=''/u);
  assert.match(state.body, /WHEN w\.id IS NOT NULL THEN 'WITHDRAWN'/u, 'a withdrawal event dominates');
  assert.match(state.body, /WHEN cv\.id IS NULL OR cv\.package_manifest_version_id <> a\.manifest_version_id THEN 'SUPERSEDED'/u,
    'a manifest that is no longer the current one is SUPERSEDED, and an absent pointer fails closed');
  assert.match(state.body, /ELSE 'EFFECTIVE' END/u);
  assert.match(state.body, /LEFT JOIN public\.publication_approval_withdrawal_events w ON w\.approval_id = a\.id/u,
    'the withdrawal event is read for the exact approval');
  assert.match(state.body, /ON cv\.id = e\.current_experience_version_id AND cv\.experience_id = e\.id/u,
    'the current version pointer is read for the exact Experience');
  assert.match(state.body, /IF p_approval_id IS NULL THEN\s*\n\s*RETURN;/u,
    'a NULL identifier yields zero rows so the LATERAL manifest view can report MISSING truthfully');
  assert.ok(!state.body.includes('INSERT INTO') && !state.body.includes('UPDATE public') && !state.body.includes('DELETE FROM'),
    'the derivation writes nothing');
  const view = functionBody(DERIVATIONS[1]);
  assert.match(view.header, /SECURITY DEFINER STABLE SET search_path=''/u);
  assert.match(view.body, /FROM public\.publication_manifest_required_approvers ra\s*\n\s*LEFT JOIN public\.publication_manifest_approvals a/u,
    'the manifest view walks the DERIVED required set and never a caller-supplied list');
  assert.match(view.body, /LEFT JOIN LATERAL public\.derive_publication_approval_effective_state_v1\(a\.id\) s ON a\.id IS NOT NULL/u,
    'and consumes the ONE per-approval derivation rather than a second copy');
  assert.match(view.body, /coalesce\(s\.effective_state, 'MISSING'\)/u, 'a required approval never given is MISSING');
  assert.ok(!view.body.includes('shared_world_membership_episodes'), 'membership contributes nothing to who is required');
});

test('withdrawal requires the exact historical rightsholder from auth.uid(), under the canonical lock prefix, and touches no evidence', () => {
  const { header, body } = functionBody(WITHDRAWAL);
  assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path=''/u);
  assert.match(body, /u uuid := auth\.uid\(\);/u);
  assert.match(body, /IF u IS NULL THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED'/u);
  assert.match(body, /IF NOT FOUND OR approval\.approver_user_id <> u THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002'/u,
    'a nonexistent approval and somebody else\'s approval receive ONE bounded class: no existence oracle');
  assert.deepEqual(inputParameters(WITHDRAWAL), ['p_command_id', 'p_approval_id'],
    'no approver, manifest, reason or state parameter: the human is the caller and the approval is the only thing named');
  assert.match(body, /PERFORM 1 FROM public\.public_world_state w WHERE w\.singleton FOR UPDATE;/u, 'the ONE Public World first');
  assert.match(body, /PERFORM 1 FROM public\.public_experiences e WHERE e\.id = target_experience FOR UPDATE;/u, 'then the exact Experience');
  assert.ok(body.indexOf('public_world_state w WHERE w.singleton FOR UPDATE') < body.indexOf('public_experiences e WHERE e.id = target_experience FOR UPDATE'));
  for (const forbidden of ['shared_world_membership_episodes', 'public_experience_controllers', 'shared_world_history_access_grants',
    'shared_world_standard_closed_view_entitlements', 'shared_world_history_package_manifest_items']) {
    assert.ok(!body.includes(forbidden), `withdrawal reads no ${forbidden}: current membership is not rightsholder authority, control is not consent`);
  }
  assert.doesNotMatch(body, /(INSERT INTO|UPDATE|DELETE FROM) public\.(publication_manifest_approvals|publication_manifest_required_approvers|public_experience_controllers|shared_world|conversation_|users)/u);
  assert.doesNotMatch(body, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp/iu, 'one read of the database clock');
  assert.doesNotMatch(body, /pg_advisory|LOCK TABLE|TRUNCATE/iu);
  // Durable idempotency binding the whole request, checked before and under the lock.
  assert.match(body, /QANDEEL_CWV2_PUBLIC_APPROVAL_WITHDRAWAL_COMMAND_V1/u);
  assert.equal((body.match(/WHERE c\.id = p_command_id/gu) ?? []).length, 2, 'idempotency is checked twice: before any lock, and under it');
  assert.match(body, /committed\.request_ref <> request[\s\S]{0,140}?PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
  assert.match(body, /RETURN QUERY SELECT 'ALREADY_WITHDRAWN'::text/u, 'a second withdrawal is not an error and not a second event');
  assert.match(body, /VALUES \(p_command_id, p_approval_id, approval\.manifest_version_id, u, instant\);/u, 'the event reuses the command identity');
  assert.match(body, /RETURN QUERY SELECT 'WITHDRAWN'::text/u);
  assert.ok(!body.includes('PUBLISHED') && !body.includes('ABSENT_FROM_PUBLIC_WORLD'), 'withdrawal moves no lifecycle');
  for (const name of [...DERIVATIONS, WITHDRAWAL]) {
    for (const parameter of inputParameters(name)) {
      assert.doesNotMatch(parameter, /approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|effective|state|reason|fingerprint/u,
        `${name} may not accept ${parameter}`);
    }
  }
});

test('the withdrawal event is append-only, one per approval, and bound to ONE exact approval of the immutable 0092 evidence', () => {
  assert.match(executableSql, /CONSTRAINT publication_approval_withdrawal_events_approval_key UNIQUE \(approval_id\)/u);
  // REV-01: id, manifest and approver of the SAME approval row, through ONE composite
  // foreign key onto the additive candidate key. Two independent foreign keys are NOT
  // accepted as proof - each half can be satisfied by a different approval row.
  assert.match(executableSql, /ALTER TABLE public\.publication_manifest_approvals\s*\n\s*ADD CONSTRAINT publication_manifest_approvals_exact_identity_key\s*\n\s*UNIQUE \(id, manifest_version_id, approver_user_id\);/u,
    'the frozen evidence gains the exact-identity candidate key the composite binding needs');
  assert.match(executableSql, /CONSTRAINT publication_approval_withdrawal_events_approval_fk\s*\n\s*FOREIGN KEY \(approval_id, manifest_version_id, approver_user_id\)\s*\n\s*REFERENCES public\.publication_manifest_approvals \(id, manifest_version_id, approver_user_id\)\s*\n\s*ON DELETE RESTRICT/u,
    'a withdrawal event binds ONE exact approval: a human the approval never named, or approval A beside approval B\'s pair, is unrepresentable');
  assert.match(executableSql, /CONSTRAINT publication_approval_withdrawal_commands_approval_fk\s*\n\s*FOREIGN KEY \(approval_id, manifest_version_id, actor_user_id\)\s*\n\s*REFERENCES public\.publication_manifest_approvals \(id, manifest_version_id, approver_user_id\)\s*\n\s*ON DELETE RESTRICT/u,
    'and so does a withdrawal command: the actor IS the approver of the exact approval named');
  assert.doesNotMatch(executableSql, /FOREIGN KEY \(approval_id\)\s+REFERENCES/u, 'no independent approval-id foreign key');
  assert.doesNotMatch(executableSql, /FOREIGN KEY \(manifest_version_id, (?:actor|approver)_user_id\)\s*\n\s*REFERENCES public\.publication_manifest_approvals/u,
    'no independent (manifest, approver) foreign key beside it: two independent keys are not one exact approval');
  for (const table of OWN_TABLES) {
    const start = executableSql.indexOf(`CREATE TABLE public.${table} (`);
    const block = executableSql.slice(start, executableSql.indexOf('\n);', start));
    assert.equal((block.match(/REFERENCES public\.publication_manifest_approvals/gu) ?? []).length, 1,
      `${table} reaches the approval evidence through exactly the composite key`);
  }
  assert.match(executableSql, /CREATE TRIGGER publication_approval_withdrawal_events_immutable\s*\n\s*BEFORE UPDATE OR DELETE ON public\.publication_approval_withdrawal_events/u);
  assert.match(executableSql, /RAISE EXCEPTION 'PUBLICATION_APPROVAL_STATE_IS_IMMUTABLE'\s*\n\s*USING ERRCODE='55000'/u);
  for (const table of OWN_TABLES) {
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} OWNER TO postgres;`, 'u'));
  }
  assert.match(executableSql, /CONSTRAINT publication_approval_withdrawal_commands_request_check\s*\n\s*CHECK \(request_ref ~ '\^sha256/u);
  // No column of either relation is a decision or a serving column.
  for (const table of OWN_TABLES) {
    const start = executableSql.indexOf(`CREATE TABLE public.${table} (`);
    const block = executableSql.slice(start, executableSql.indexOf('\n);', start));
    for (const line of block.split('\n').filter((l) => /^ {4}\w+\s+\S/u.test(l) && !/^ {4}CONSTRAINT\b/u.test(l))) {
      assert.doesNotMatch(line.trim().split(/\s+/u)[0], /safety|moderation|launch|entitlement|premium|feature_flag|allow|visib|semantic|placement|vitality|discussion|reply/u);
    }
  }
});

test('every function is internal: revoked from PUBLIC, anon, authenticated and service_role, and nothing is granted', () => {
  assert.match(executableSql, /EXECUTE format\('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn\);/u);
  assert.match(executableSql, /EXECUTE format\('REVOKE ALL ON FUNCTION %s FROM service_role', fn\);/u);
  assert.equal((executableSql.match(/GRANT\s+EXECUTE/gu) ?? []).length, 0, '0094 grants EXECUTE to nobody: withdrawal waits behind the same unimplemented CW2-08 Launch Gate as every I-05A primitive');
  assert.equal((executableSql.match(/\bGRANT\b/gu) ?? []).length, 0, 'and grants nothing at all');
  for (const name of [...DERIVATIONS, WITHDRAWAL, 'reject_publication_approval_state_mutation_v1']) {
    assert.ok(executableSql.includes(`'public.${name}(`), `${name} is named in the revoke posture`);
  }
});

test('the self-assertions refuse to deploy a migration that lost any of this', () => {
  for (const phrase of [
    'must be owned by postgres',
    'must be SECURITY DEFINER',
    'must pin an empty search_path',
    'before the frozen CW2-08 Launch Gate exists',
    'derivation % must be STABLE',
    'derivation % must write nothing',
    'consequential primitive % must be VOLATILE',
    'the effective-state derivation must decide EFFECTIVE, WITHDRAWN and SUPERSEDED',
    'the effective-state derivation must read the withdrawal events and the current version pointer',
    'the manifest-level derivation must report a required approval that was never given as MISSING',
    'withdrawal must require the exact historical rightsholder the approval represents',
    'withdrawal must read no Shared membership and no Experience control: current membership is not rightsholder authority',
    'withdrawal must mutate no approval evidence, no control and no predecessor state',
    'accepts no clock but one read of the database clock',
    'withdrawal must take the canonical Public lock prefix so it serializes with publication',
    'may not accept an authority audience visibility state or instant parameter',
    'the frozen 0092 approval evidence must still be append-only',
    'the frozen approval evidence must carry the additive exact-identity candidate key (id, manifest, approver)',
    'may not bind the approval evidence through an independent partial foreign key',
    'must bind ONE exact approval - id, manifest and approver of the same immutable row - through one composite restrictive foreign key',
    'a withdrawal event must be append-only for every role',
    'must not reach Experience control',
    'may carry no Safety Launch entitlement visibility or serving column',
    'must have row level security enabled',
    'must carry zero policies',
    'must hold no privilege for %',
  ]) {
    assert.ok(selfAssertions.includes(phrase), `the migration refuses itself when: ${phrase}`);
  }
  assert.match(selfAssertions, /cfg IN \('search_path=', 'search_path=""'\)/u);
  assert.match(selfAssertions, /has_function_privilege\('public', fn, 'EXECUTE'\)/u);
  assert.match(selfAssertions, /unnest\(pr\.proargnames, pr\.proargmodes\) AS arg\(name, mode\)\s*\n\s*WHERE pr\.oid = fn::regprocedure AND arg\.mode = 'i'/u,
    'the parameter ban reads the INPUT half only');
  // FIX-C stays honoured: nothing here forbids a LATER additive state either. The
  // messages the migration can raise never refuse a later reviewed object.
  const refusals = [...selfAssertions.matchAll(/RAISE EXCEPTION '([^']*)'/gu)].map((m) => m[1].toLowerCase());
  assert.equal(refusals.find((m) => m.includes('count(*) =')), undefined, 'no self-assertion caps how many objects may exist');
  assert.ok(!selfAssertions.includes('count(*) = '));
});

test('0094 is registered in the toolchain, in CI as part of the I-05B group, and in the database README', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0094\\.mjs"`, 'u'));
  assert.match(readme, /0094_public_publication_effective_approval_state_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`), 'the README names the verifier command');
  assert.match(verifier, /verifier for migration 0094/iu);
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0094=PASS; else status=1; fi`),
    'the verifier runs in API CI and its failure is recorded rather than swallowed');
  assert.ok(workflow.includes('exit "$status"'), 'the grouped I-05B step still fails the job when any of the four verifiers failed');
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu, 'no API CI step continues on error');
  const group = workflow.indexOf('Verify the four I-05B Public World runtime verifiers against real PostgreSQL as one reported group');
  const i05a = workflow.indexOf('Verify the three I-05A Public World verifiers against real PostgreSQL as one reported group');
  assert.ok(i05a > 0 && group > i05a, 'the I-05B group runs after the I-05A group it builds on');
});

test('the verifier proves the effective-state law against real PostgreSQL, with bounded races and a rolled-back forward-safety probe', () => {
  assert.match(verifier, /import \{[^}]*createRuntime[^}]*\} from '\.\/public-runtime-verifier-support\.mjs'/u);
  for (const needle of ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'C01', 'C02',
    'ALREADY_WITHDRAWN', "'SUPERSEDED'", 'no existence oracle', 'regains no Shared browsing', 'grants no Experience control',
    'the frozen READY commit counts historical rows', 'SAVEPOINT forward_safety', 'ROLLBACK TO SAVEPOINT forward_safety',
    'i05b94_probe_absence_v1', 'anti-vacuity', 'removeCommittedFixtures', 'every fixture this verifier created was rolled back or removed',
    // REV-01: the cross-pair is refused by PostgreSQL, the exact triple is accepted, the
    // catalog program reads both column lists of the composite key, and the weakening
    // back into two independent keys is refused AND shown to admit the cross-pair.
    'publication_manifest_approvals_exact_identity_key', 'assertExactBinding', 'THE CROSS-PAIR', 'exact_triple',
    'i05b94_probe_approver_fk', 'the weakened shape admits the cross-pair']) {
    assert.ok(verifier.includes(needle), `the verifier proves ${needle}`);
  }
  assert.match(support, /async function assertExactBinding\(table, parent, local, parentColumns\)/u);
  assert.match(support, /must not bind \$\{parent\} through an independent partial foreign key/u,
    'the shared catalog check refuses an independent partial key, not merely the absence of the composite one');
  // Release edges precede awaits: a launched blocking promise is awaited only after
  // the connection it waits for has issued COMMIT.
  for (const launched of ['blocked', 'duplicate']) {
    const launch = verifier.indexOf(`const ${launched} = q2(`);
    assert.ok(launch > 0, `${launched} is LAUNCHED rather than awaited inline`);
    const release = verifier.indexOf("await q('COMMIT')", launch);
    const settle = verifier.indexOf(`await ${launched}`, launch);
    assert.ok(release > launch && settle > release, `${launched} is awaited only after the other connection committed`);
  }
  // The wait is bounded in the database, in the shared harness.
  assert.match(support, /SET lock_timeout = '10s'/u);
  assert.match(support, /SET statement_timeout = '15s'/u);
  assert.match(support, /SET lock_timeout = '0'/u);
  assert.match(support, /stillPending/u);
});
