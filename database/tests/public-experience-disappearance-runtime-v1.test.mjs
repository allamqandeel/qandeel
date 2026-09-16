// I-05C - Public Experience Disappearance Runtime v1: the secret-free
// structural contract for migration 0099.
//
// Live semantics - the authorized removal, the deterministic convergence, the
// anti-oracle refusals, the race matrix - are proven by
// database/verify-migration-0099.mjs against real PostgreSQL. What is proven
// HERE is the structure a migration must already have before it deploys: that
// there is exactly ONE controlled path to `ABSENT_FROM_PUBLIC_WORLD`, that both
// consequential primitives delegate to it and write no lifecycle of their own,
// that nothing can reactivate an absent Experience, that the sealed evidence is
// append-only and bound to ONE exact publication row, that no immutable
// historical evidence is erased, and that migrations 0091-0097 are
// byte-identical while 0098 is the derivation this convergence sits on top of.
//
// ## Why the slice-wide probe lives in this file and not in both
//
// A mirror-based probe is expensive. The probe at the end mirrors once and runs
// BOTH I-05C contracts against a mutated tree, so the property each of them must
// have - this is a contract, not a ceiling on the roadmap - is proven for both
// from one place: a later reviewed CW2-08 gate, a republication slice, a spatial
// model, additive columns and a new CI step must all leave I-05C passing, and
// every real weakening of an I-05C privacy, authority or convergence invariant
// must break at least one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createHarnessMirror, removeHarnessMirror } from '../../tests/harness-temp-dir.mjs';
import { FROZEN_PREDECESSORS } from './public-runtime-frozen-predecessors.mjs';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
/** Set in the child runs of the probe, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I05C_PUBLIC_DISAPPEARANCE_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0099_public_experience_disappearance_runtime_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const partA = read('../migrations/0098_public_continuing_eligibility_visibility_closure_v1.sql');
const verifier = read('../verify-migration-0099.mjs');
const support = read('../public-runtime-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);
const installedSql = executableSql.slice(0, SELF_ASSERT_START);

const CORE = 'apply_public_experience_disappearance_v1';
const REMOVAL = 'remove_public_experience_from_public_world_v1';
const RECONCILE = 'reconcile_public_experience_disappearance_v1';
const AUDIT = 'resolve_public_experience_disappearance_audit_v1';
const OWN_TABLES = ['public_experience_disappearance_commands', 'public_experience_disappearance_state'];
const OWN_SCRIPT = 'verify:public-experience-disappearance-runtime:integration';

const functionBody = (name) => {
  const start = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `migration 0099 creates ${name}`);
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
const resultColumns = (name) => {
  const { header } = functionBody(name);
  const table = /RETURNS TABLE\(([\s\S]*?)\)\s*\n?LANGUAGE/u.exec(header);
  assert.ok(table, `${name} declares a RETURNS TABLE result`);
  return [...table[1].matchAll(/(\w+)\s+(?:uuid\[\]|text\[\]|uuid|text|integer|bigint|boolean|timestamptz|real)/gu)].map((m) => m[1]);
};
const tableBlock = (table) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${table} (`);
  assert.ok(start >= 0, `0099 creates ${table}`);
  return executableSql.slice(start, executableSql.indexOf('\n);', start));
};
const code = (body) => body.split('\n').map((line) => line.replace(/--.*$/u, '')).join('\n');

// ---------------------------------------------------------------------------

test('0099 is the forward migration after 0098, every frozen predecessor is byte-identical, and the ONE frozen alter is additive', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0099_')).length, 1, 'exactly one migration carries the 0099 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0098_public_continuing_eligibility_visibility_closure_v1.sql'));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of FROZEN_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu);
  // The ONE statement that touches a frozen relation is the additive
  // exact-identity candidate key on the 0095 publication record: a constraint,
  // no row, no column, no trigger, no policy.
  const foreignAlters = [...installedSql.matchAll(/^ALTER TABLE public\.(?!public_experience_disappearance_commands\b|public_experience_disappearance_state\b)[\s\S]*?;/gmu)]
    .map((m) => m[0].replace(/\s+/gu, ' '));
  assert.deepEqual(foreignAlters, [
    'ALTER TABLE public.public_experience_publication_state ADD CONSTRAINT public_experience_publication_state_exact_identity_key UNIQUE (experience_id, published_experience_version_id, published_manifest_version_id);',
  ], 'the only frozen relation 0099 alters is the 0095 publication record, and only by adding the exact-identity candidate key');
  // PART A is already the canonical visibility truth, so the convergence is
  // defense in depth over a derivation that had already gone dark.
  assert.match(partA, /CREATE OR REPLACE FUNCTION public\.resolve_public_visibility_state_v1/u);
  assert.match(partA, /derive_public_continuing_eligibility_v1/u);
  assert.equal((executableSql.match(/\bGRANT\b/gu) ?? []).length, 0,
    'nothing here is granted to any application role: there is no Public or ordinary-role disappearance surface at all');
});

test('there is exactly ONE controlled path to ABSENT_FROM_PUBLIC_WORLD, and nothing can reactivate an absent Experience', () => {
  const core = functionBody(CORE);
  assert.match(core.header, /LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path=''/u);
  assert.equal((installedSql.match(/SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD'/gu) ?? []).length, 1,
    'the whole migration assigns the disappearance lifecycle exactly once');
  assert.equal((code(core.body).match(/SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD'/gu) ?? []).length, 1,
    'and that one assignment is inside the controlled core');
  for (const lifecycle of ['PUBLISHED', 'DRAFT', 'READY_FOR_REVIEW']) {
    assert.ok(!installedSql.includes(`SET current_lifecycle = '${lifecycle}'`),
      `no I-05C primitive writes a serving lifecycle: ${lifecycle} is never assigned`);
  }
  const c = code(core.body);
  // The exact publication that disappears is READ from the immutable record.
  assert.match(c, /SELECT s\.published_experience_version_id, s\.published_manifest_version_id\s*\n\s*INTO record_version, record_manifest/u);
  assert.ok(c.includes("AND e.current_lifecycle = 'PUBLISHED'")
    && c.includes('AND e.current_experience_version_id = s.published_experience_version_id'),
  'the only legal predecessor state is PUBLISHED bound to its own current version');
  assert.match(c, /RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE'/u, 'and every other predecessor state is refused');
  // The transition is APPENDED to the frozen append-only lifecycle truth.
  assert.match(c, /INSERT INTO public\.public_experience_lifecycle_events/u);
  assert.match(c, /'PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD', instant\);/u);
  assert.match(c, /INSERT INTO public\.public_experience_disappearance_state/u, 'and the disappearance is auditable');
  assert.match(c, /DELETE FROM public\.public_experience_search_projection pr WHERE pr\.experience_id = p_experience_id;/u,
    'the derived projection that retains a copy of the public text is cleared as defense in depth');
  assert.ok(!c.includes('auth.uid()'), 'the core decides no authority of its own');
  assert.equal((c.match(/clock_timestamp\(\)/gu) ?? []).length, 1, 'ONE database-owned instant for every fact');
  assert.doesNotMatch(c, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp/iu);
  // The ONE parameter carrying a derived value belongs to the core alone.
  assert.deepEqual(inputParameters(CORE), ['p_transition_id', 'p_experience_id', 'p_disappearance_basis']);
  for (const command of [REMOVAL, RECONCILE]) {
    const body = code(functionBody(command).body);
    assert.ok(!body.includes('SET current_lifecycle'), `${command} writes no lifecycle of its own`);
    assert.match(body, new RegExp(`SELECT \\* INTO applied FROM public\\.${CORE}\\(`, 'u'),
      `${command} delegates the transition to the ONE controlled primitive`);
    assert.ok(!inputParameters(command).some((p) => /basis|reason|cause|force|absent/u.test(p)),
      `${command} derives the basis and accepts none`);
  }
});

test('both consequential primitives take the canonical lock prefix and are durably idempotent', () => {
  for (const command of [REMOVAL, RECONCILE]) {
    const { header, body } = functionBody(command);
    assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path=''/u);
    const c = code(body);
    const world = c.indexOf('PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;');
    const experience = c.indexOf('SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;');
    assert.ok(world >= 0 && experience > world, `${command} takes the ONE Public World and then the exact Experience`);
    assert.equal((c.match(/WHERE c\.id = p_command_id/gu) ?? []).length, 2,
      `${command} checks durable idempotency before any lock and again under it`);
    assert.match(c, /RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505'/u,
      `${command} refuses a command identity reused for a different request, before it reads anything about the target`);
    assert.match(c, /QANDEEL_CWV2_PUBLIC_DISAPPEARANCE_COMMAND_V1/u);
    assert.doesNotMatch(c, /pg_advisory|LOCK TABLE|TRUNCATE/iu);
    assert.doesNotMatch(c, /(INSERT INTO|UPDATE|DELETE FROM) public\.(shared_world|conversation_|users|publication_manifest_approvals|publication_manifest_required_approvers|publication_approval_withdrawal|public_experience_controllers|publication_package|public_experience_publication_state|public_experience_versions|public_identities|public_discussion_posts|public_qandeel_responses|public_experience_semantic_placements)/u,
      `${command} erases no immutable evidence and mutates no source, package, approval, control, presence or identity`);
  }
  // The reconciliation additionally holds every included source in the frozen
  // I-04 order, so the eligibility answer cannot go stale before it writes.
  const reconcile = code(functionBody(RECONCILE).body);
  const order = ['PERFORM 1 FROM public.publication_package_manifest_versions m', 'PERFORM 1 FROM public.shared_worlds w',
    'ORDER BY m.id FOR SHARE', 'ORDER BY i.id FOR SHARE', 'ORDER BY cu.id FOR SHARE',
    'FROM public.derive_public_continuing_eligibility_v1(p_experience_id)'];
  let previous = -1;
  for (const needle of order) {
    const at = reconcile.indexOf(needle);
    assert.ok(at > previous, `the reconciliation reaches ${needle} in the canonical order`);
    previous = at;
  }
});

test('removal is a CONTROL act and reconciliation is machine convergence, and neither confuses the two', () => {
  const removal = code(functionBody(REMOVAL).body);
  assert.match(removal, /u uuid := auth\.uid\(\);/u);
  assert.deepEqual(inputParameters(REMOVAL), ['p_command_id', 'p_experience_id', 'p_experience_version_id'],
    'no controller, actor, authority, basis or force parameter');
  assert.match(removal, /IF NOT FOUND OR NOT EXISTS \(SELECT 1 FROM public\.public_experience_controllers c\s*\n\s*WHERE c\.experience_id = p_experience_id AND c\.controller_user_id = u\) THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED'/u,
    'a nonexistent Experience and a non-controller reach ONE bounded class');
  for (const forbidden of ['publication_manifest_approvals', 'publication_manifest_required_approvers',
    'publication_approval_withdrawal_events', 'shared_world_membership_episodes']) {
    assert.ok(!removal.includes(forbidden), `container control is not content rights: removal reads no ${forbidden}`);
  }
  assert.match(removal, /IF publication\.published_experience_version_id IS DISTINCT FROM p_experience_version_id THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE'/u,
    'the caller names the exact published version, and the manifest is read from the record rather than supplied');
  assert.match(removal, /NOT IN \('PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD'\) THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID'/u,
    'a DRAFT and a READY_FOR_REVIEW Experience were never in the Public World');
  assert.match(removal, /'ALREADY_ABSENT'::text/u, 'and a repeated legitimate removal converges rather than erroring');

  const reconcile = code(functionBody(RECONCILE).body);
  assert.ok(!reconcile.includes('auth.uid()'), 'machine convergence derives no human');
  assert.ok(!reconcile.includes('public_experience_controllers'), 'and is not a control action');
  assert.deepEqual(inputParameters(RECONCILE), ['p_command_id', 'p_experience_id']);
  const outcomes = [...new Set([...reconcile.matchAll(/'([A-Z_]{5,})'::text, (?:p_experience_id|committed\.experience_id)/gu)].map((m) => m[1]))].sort();
  assert.deepEqual(outcomes, ['ALREADY_ABSENT', 'ALREADY_COMMITTED', 'DISAPPEARANCE_CONVERGED', 'NOT_APPLICABLE', 'STILL_ELIGIBLE'],
    'the reconciliation outcome vocabulary is bounded and deterministic');
  assert.match(reconcile, /IF eligibility\.ineligibility_class NOT IN \('REQUIRED_APPROVAL_NOT_EFFECTIVE',\s*\n\s*'PUBLISHED_SOURCE_NOT_AVAILABLE',\s*\n\s*'PUBLICATION_AUTHORITY_INVALIDATED'\) THEN/u,
    'a contradictory publication binding is not a disappearance cause, so it converges to NOT_APPLICABLE and writes nothing');
  assert.match(reconcile, new RegExp(`${CORE}\\(\\s*\\n?\\s*p_command_id, p_experience_id, eligibility\\.ineligibility_class\\)`, 'u'),
    'and the class is passed straight through: there is no second vocabulary to drift from the first');
});

test('the sealed evidence binds ONE exact publication row, is append-only, and carries no cause detail or source', () => {
  assert.match(executableSql, /ALTER TABLE public\.public_experience_publication_state\s*\n\s*ADD CONSTRAINT public_experience_publication_state_exact_identity_key\s*\n\s*UNIQUE \(experience_id, published_experience_version_id, published_manifest_version_id\);/u,
    'the frozen publication record gains the additive exact-identity candidate key the composite binding needs');
  assert.match(executableSql, /CONSTRAINT public_experience_disappearance_state_publication_fk\s*\n\s*FOREIGN KEY \(experience_id, absent_experience_version_id, absent_manifest_version_id\)\s*\n\s*REFERENCES public\.public_experience_publication_state\s*\n\s*\(experience_id, published_experience_version_id, published_manifest_version_id\)\s*\n\s*ON DELETE RESTRICT/u,
    'the disappearance record binds the exact publication as one row');
  assert.match(executableSql, /CONSTRAINT public_experience_disappearance_commands_publication_fk\s*\n\s*FOREIGN KEY \(experience_id, target_experience_version_id, target_manifest_version_id\)\s*\n\s*REFERENCES public\.public_experience_publication_state\s*\n\s*\(experience_id, published_experience_version_id, published_manifest_version_id\)\s*\n\s*ON DELETE RESTRICT/u,
    'and so does the command');
  assert.doesNotMatch(executableSql, /REFERENCES public\.publication_package_manifest_versions/u,
    'no direct manifest foreign key: the absent manifest is THE manifest of THE published version');
  assert.doesNotMatch(executableSql, /FOREIGN KEY \((?:absent|target)_experience_version_id, experience_id\)\s*\n\s*REFERENCES/u,
    'and no independent partial version key beside it');
  assert.match(executableSql, /CONSTRAINT public_experience_disappearance_state_basis_check\s*\n\s*CHECK \(disappearance_basis IN \('AUTHORIZED_CONTROLLER_REMOVAL',\s*\n\s*'REQUIRED_APPROVAL_NOT_EFFECTIVE',\s*\n\s*'PUBLISHED_SOURCE_NOT_AVAILABLE',\s*\n\s*'PUBLICATION_AUTHORITY_INVALIDATED'\)\)/u,
    'the bounded basis is exactly the authorized act and the three convergeable ineligibility classes');
  // The self-assertion block NAMES the class it refuses as a basis, so this is
  // asked of the constraint the migration installs rather than of its guard.
  assert.ok(!tableBlock('public_experience_disappearance_state').includes('PUBLICATION_BINDING_INVALID'),
    'a contradictory binding is never a basis');
  assert.match(executableSql, /CREATE TRIGGER public_experience_disappearance_state_immutable\s*\n\s*BEFORE UPDATE OR DELETE ON public\.public_experience_disappearance_state/u);
  assert.match(executableSql, /CONSTRAINT public_experience_disappearance_state_pk PRIMARY KEY \(experience_id\)/u,
    'an Experience disappears from the Public World once');
  // The two command families are kept apart by SHAPE, not by discipline.
  const commands = tableBlock('public_experience_disappearance_commands');
  assert.match(commands, /CHECK \(command_kind IN \('CONTROLLER_REMOVAL', 'DISAPPEARANCE_RECONCILIATION'\)\)/u);
  assert.match(commands, /CHECK \(\(command_kind = 'CONTROLLER_REMOVAL'\) = \(actor_user_id IS NOT NULL\)\)/u,
    'a human act carries its exact human; machine convergence carries none');
  assert.match(commands, /CHECK \(\(target_experience_version_id IS NULL\) = \(target_manifest_version_id IS NULL\)\)/u,
    'the target publication is named whole or not at all, because the composite key is MATCH SIMPLE');
  assert.match(commands, /CHECK \(command_kind <> 'CONTROLLER_REMOVAL' OR target_experience_version_id IS NOT NULL\)/u);
  // No cause detail, no free text, no source identifier, no decision column.
  for (const table of OWN_TABLES) {
    const block = tableBlock(table);
    for (const line of block.split('\n').filter((l) => /^ {4}\w+\s+\S/u.test(l) && !/^ {4}CONSTRAINT\b/u.test(l))) {
      assert.doesNotMatch(line.trim().split(/\s+/u)[0],
        /safety|moderation|launch|entitlement|premium|feature_flag|allow|visib|semantic|placement|vitality|discussion|reply|detail|note|message|session|turn|conversation_unit|world_id|shared_|material_id|history_item|availability|email|phone|contact|credential|digest/u,
        `${table} may carry no Safety Launch entitlement serving source or free-text cause column`);
    }
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} OWNER TO postgres;`, 'u'));
  }
  assert.match(executableSql, /REVOKE ALL ON TABLE public\.public_experience_disappearance_commands,\s*\n\s*public\.public_experience_disappearance_state\s*\n\s*FROM PUBLIC, anon, authenticated;/u);
});

test('the audit boundary is INTERNAL and discloses no source or private identity', () => {
  const { header, body } = functionBody(AUDIT);
  assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''/u);
  assert.deepEqual(resultColumns(AUDIT),
    ['experience_id', 'absent_experience_version_id', 'absent_manifest_version_id', 'disappearance_basis', 'absent_since']);
  for (const column of resultColumns(AUDIT)) {
    assert.doesNotMatch(column,
      /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material_id|history_item|availability|context_ref|world_id|provenance|digest|fingerprint/u,
      `the audit boundary must not return ${column}`);
  }
  for (const forbidden of ['publication_package_item_provenance', 'shared_world', 'conversation_unit', 'public_identities']) {
    assert.ok(!body.includes(forbidden), `the audit boundary reads no ${forbidden}`);
  }
  assert.ok(!body.includes('INSERT INTO') && !body.includes('UPDATE public') && !body.includes('DELETE FROM'));
  // It is named in the revoke posture and in NO grant: reading why an
  // Experience disappeared is a private cause, so there is no serving surface.
  assert.ok(executableSql.includes(`'public.${AUDIT}(uuid)'`), 'the audit boundary is named in the revoke posture');
});

test('the self-assertions refuse to deploy a migration that lost any of this', () => {
  for (const phrase of [
    'before the frozen CW2-08 Launch Gate exists',
    'the disappearance audit boundary must be STABLE',
    'consequential primitive % must be VOLATILE',
    'accepts no clock but one read of the database clock',
    'locks rows in the canonical order and truncates nothing',
    'must erase no immutable evidence and mutate no source, package, approval, control, presence or identity',
    'may not accept an authority audience visibility eligibility or instant parameter',
    'the controlled disappearance core must write ABSENT_FROM_PUBLIC_WORLD exactly once',
    'the controlled disappearance core must refuse every predecessor state but PUBLISHED bound to its own current version',
    'the disappearance transition must be appended to the frozen append-only lifecycle truth',
    'the disappearance must be auditable',
    'the controlled disappearance core decides no authority of its own',
    'must reach ABSENT_FROM_PUBLIC_WORLD only through the ONE controlled primitive',
    'must delegate the transition to the ONE controlled primitive',
    'must take the canonical Public lock prefix',
    'must check durable idempotency before any lock and again under it',
    'no I-05C primitive may reactivate an absent Experience',
    'removal must require the exact Experience controller derived from auth.uid()',
    'a non-controller and a nonexistent Experience must reach ONE bounded class',
    'container control is not content rights: removal reads no approval',
    'removal must bind the exact published version the immutable record holds',
    'a repeated legitimate removal must converge rather than error',
    'disappearance reconciliation derives no human',
    'disappearance reconciliation is not a control action and reads no control',
    'disappearance reconciliation must consume the ONE continuing-eligibility truth',
    'disappearance reconciliation must hold the exact sources in the frozen I-04 order while it decides',
    'the bounded reconciliation outcome vocabulary must include',
    'the disappearance audit boundary must read no sealed provenance and no private identity',
    'the disappearance audit boundary must disclose no private identity and no sealed provenance',
    'the frozen publication record must carry the additive exact-identity candidate key (experience, version, manifest)',
    'may not bind the publication through an independent partial or direct manifest foreign key',
    'must bind the exact publication - Experience, published version and published manifest of the same row - through one composite restrictive foreign key',
    'may carry no Safety Launch entitlement visibility serving source or free-text cause column',
    'the disappearance basis must be exactly the authorized act and the three convergeable ineligibility classes',
    'the disappearance record must be append-only for every role',
    'must hold no direct privilege on the Experience lifecycle relation',
    'the canonical visibility derivation must already consume continuing eligibility before any convergence exists',
    'the frozen 0091 lifecycle truth must still be append-only',
    'the frozen 0095 publication record must still be append-only',
    'the CW2-08 prerequisite seam must still answer NOT_EVALUATED',
    'the frozen CW2-08 signed-out viewing requirement must remain UNRESOLVED',
  ]) {
    assert.ok(selfAssertions.includes(phrase), `the migration refuses itself when: ${phrase}`);
  }
  // Nothing here is a ceiling on a later reviewed slice: no refusal names a
  // future object, caps the catalog, or sweeps every function in the schema.
  const refusals = [...selfAssertions.matchAll(/RAISE EXCEPTION '([^']*)'/gu)].map((m) => m[1].toLowerCase());
  assert.equal(refusals.find((m) => /must not exist|no migration may|count\(\*\) = |no later/u.test(m)), undefined,
    'no self-assertion forbids a later reviewed object');
  assert.ok(!selfAssertions.includes('FROM pg_proc pr JOIN pg_namespace'),
    'and none sweeps the whole catalog: every assertion is a fact about the objects 0099 owns or the frozen truths it consumes');
});

test('0099 is registered in the toolchain, in the I-05C CI group, and in the database README', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0099\\.mjs"`, 'u'));
  assert.match(readme, /0099_public_experience_disappearance_runtime_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`));
  assert.ok(readme.includes('AUTHORIZED_CONTROLLER_REMOVAL') && readme.includes('DISAPPEARANCE_CONVERGED'),
    'the README records the disappearance basis and the convergence outcomes');
  assert.match(verifier, /verifier for migration 0099/iu);
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0099=PASS; else status=1; fi`));
  // Scoped to the I-05C step's OWN body. Other grouped steps end the same way,
  // and a whole-file check would be satisfied by one of those instead.
  const step = workflow.slice(workflow.indexOf('- name: Verify the two I-05C Public World disappearance verifiers'));
  assert.ok(step.slice(0, step.indexOf('\n      - ')).includes('exit "$status"'),
    'the grouped I-05C step fails the job when either verifier failed');
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu);
});

test('the verifier proves the live semantics, eight refused weakenings and the race matrix', () => {
  for (const needle of ['DR01', 'DR02', 'DR03', 'DR04', 'DR05', 'DR06', 'DR07', 'DR08', 'DR09',
    'RC01', 'RC02', 'RC03', 'RC04', 'RC05', 'RC06', 'AU01',
    'F1 a direct application-role lifecycle privilege is a regression',
    'F2 two independent keys in place of the exact publication binding is a regression',
    'F3 a public writer that skips canonical visibility is a regression',
    'F4 a mutable disappearance record is a regression',
    'F5 removal becoming application-reachable is a regression',
    'F6 an application-reachable disappearance cause is a regression',
    'F7 a removal that writes the lifecycle itself, with no controller and no evidence, is a regression',
    'F8 and the next rebuild removes the planted row',
    'anti-vacuity', 'evidenceSnapshot', 'assertCompletelyDark', 'assertExactBinding',
    'C01', 'C02', 'C03', 'C04', 'C05', 'SAVEPOINT forward_safety']) {
    assert.ok(verifier.includes(needle), `the verifier proves ${needle}`);
  }
  assert.ok(support.includes('DISAPPEARANCE_COMMANDS') && support.includes('DISAPPEARANCE_STATE')
    && support.includes("[T.DISAPPEARANCE_STATE, 'public_experience_disappearance_state_immutable']"),
  'the shared harness knows the disappearance relations and lifts their guard for teardown');
  assert.match(verifier, /\}, \(\) => rt\.client\.end\(\)\.catch\(\(\) => undefined\)\);\s*$/u,
    'the verifier ends its database client through the envelope on every path, so a failure exits instead of hanging the CI step');
  // Every launched blocking promise is awaited only after the release edge.
  for (const [launched, release] of [['removing', "await q('COMMIT')"], ['duplicate', "await q('COMMIT')"],
    ['withdrawing', "await q('COMMIT')"], ['removingC', "await q('COMMIT')"], ['posting', "await q('COMMIT')"]]) {
    const launch = verifier.indexOf(`const ${launched} = q`);
    assert.ok(launch > 0, `${launched} is LAUNCHED rather than awaited inline`);
    const released = verifier.indexOf(release, launch);
    const settled = Math.min(...[`await ${launched}`, `assert.rejects(${launched}`].map((s) => verifier.indexOf(s, launch)).filter((i) => i > 0));
    assert.ok(released > launch && settled > released, `${launched} is awaited only after the other connection released`);
  }
});

// ---------------------------------------------------------------------------
// Forward safety and anti-vacuity for the WHOLE I-05C slice.
// ---------------------------------------------------------------------------

const I05C_CONTRACTS = [
  'database/tests/public-continuing-eligibility-visibility-closure-v1.test.mjs',
  'database/tests/public-experience-disappearance-runtime-v1.test.mjs',
];
const MIRRORED = ['.github', 'database', 'tests', 'package.json'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i05c-public-');
  for (const entry of MIRRORED) {
    const from = join(rootPath, entry);
    if (!existsSync(from)) continue;
    cpSync(from, join(mirror, entry), { recursive: true, filter: (src) => !SKIP.test(src.slice(rootPath.length)) });
  }
  return mirror;
}
const write = (mirror, relative, text) => {
  mkdirSync(dirname(join(mirror, relative)), { recursive: true });
  writeFileSync(join(mirror, relative), text);
};
function patch(mirror, relative, from, to) {
  const target = join(mirror, relative);
  const text = readFileSync(target, 'utf8');
  assert.ok(text.includes(from), `the mirrored ${relative} contains the text to patch; it does not contain:\n${from}`);
  assert.equal(text.indexOf(from), text.lastIndexOf(from),
    `the patch anchor for ${relative} occurs more than once, so the mutation would land somewhere unintended`);
  writeFileSync(target, text.replace(from, to));
}
function runInMirror(mirror) {
  const env = { ...process.env, [PROBE_CHILD]: '1' };
  delete env.NODE_TEST_CONTEXT;
  const files = I05C_CONTRACTS.map((relative) => join(mirror, relative));
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files],
    { cwd: mirror, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024 });
  assert.equal(result.error, undefined, `the mirrored contracts could not be started: ${result.error?.message}`);
  assert.notEqual(result.status, null, 'the mirrored contracts did not exit normally');
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.match(output, /# pass \d+/u, `the mirrored contracts reported no results:\n${output.slice(-1500)}`);
  assert.doesNotMatch(output, /# pass 0\b/u, 'the mirrored contracts executed nothing');
  return { ok: result.status === 0, output };
}

const M98 = 'database/migrations/0098_public_continuing_eligibility_visibility_closure_v1.sql';
const M99 = `database/migrations/${MIGRATION_NAME}`;
const SUPPORT = 'database/public-runtime-verifier-support.mjs';
const V98 = 'database/verify-migration-0098.mjs';
const V99 = 'database/verify-migration-0099.mjs';
const CI = '.github/workflows/api-ci.yml';
const GROUP_STEP = '      - name: Verify the two I-05C Public World disappearance verifiers against real PostgreSQL as one reported group';

test('every authorized later addition leaves both I-05C contracts passing',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const mirror = buildMirror();
    try {
      // A later reviewed slice: a REAL CW2-08 gate replacing the seam, a
      // launch-gated grant, an explicit republication path out of absence, a
      // spatial placement model, additive columns and an index.
      write(mirror, 'database/migrations/0100_public_launch_gate_and_republication_v1.sql',
        'BEGIN;\n'
        + 'CREATE TABLE public.public_launch_gate_state (singleton boolean PRIMARY KEY CHECK (singleton), publication_cleared boolean NOT NULL);\n'
        + 'CREATE OR REPLACE FUNCTION public.resolve_public_publication_prerequisites_v1(p_experience_id uuid, p_manifest_version_id uuid)\n'
        + '  RETURNS TABLE(clearance text, clearance_basis text)\n'
        + "  LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$\n"
        + "  BEGIN RETURN QUERY SELECT CASE WHEN g.publication_cleared THEN 'CLEARED' ELSE 'NOT_CLEARED' END::text,\n"
        + "                            'CW2-08 Launch Gate v1'::text FROM public.public_launch_gate_state g WHERE g.singleton; END$fn$;\n"
        + 'GRANT EXECUTE ON FUNCTION public.publish_public_experience_v1(uuid, uuid, uuid) TO service_role;\n'
        + 'CREATE TABLE public.public_experience_republication_commands (id uuid PRIMARY KEY,\n'
        + '  experience_id uuid NOT NULL REFERENCES public.public_experiences (id), committed_at timestamptz NOT NULL);\n'
        + 'CREATE FUNCTION public.republish_absent_public_experience_v1(p_command_id uuid, p_experience_id uuid) RETURNS void\n'
        + "  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + "  BEGIN UPDATE public.public_experiences e SET current_lifecycle = 'DRAFT' WHERE e.id = p_experience_id; END$fn$;\n"
        + 'ALTER TABLE public.public_experience_disappearance_state ADD COLUMN reviewed_by_launch_gate boolean;\n'
        + 'CREATE INDEX public_experience_disappearance_state_since_idx ON public.public_experience_disappearance_state (absent_since);\n'
        + 'CREATE TABLE public.public_experience_spatial_placement (\n'
        + '  experience_version_id uuid PRIMARY KEY REFERENCES public.public_experience_versions (id), x real NOT NULL, y real NOT NULL);\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0100.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/public-republication-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      patch(mirror, CI, GROUP_STEP,
        '      - {name: Verify a later reviewed slice, run: npm run verify:public-republication:integration}\n' + GROUP_STEP);
      const { ok, output } = runInMirror(mirror);
      assert.ok(ok,
        'a later reviewed CW2-08 gate replacing the seam, a launch-gated grant, an explicit republication path, '
        + 'a spatial placement model, additive columns, an index and a new CI gate must all leave I-05C passing:\n'
        + output.slice(-2500));
    } finally {
      removeHarnessMirror(mirror);
    }
  });

test('the contracts are not vacuous: every deliberate weakening of I-05C is refused by at least one of them',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const regressions = [
      ['continuing eligibility stops requiring every approval to be EFFECTIVE', M98,
        "  IF EXISTS (\n    SELECT 1 FROM public.derive_publication_manifest_effective_approvals_v1(bound_manifest) ea\n     WHERE ea.effective_state <> 'EFFECTIVE'\n        OR ea.bound_authority_fingerprint IS DISTINCT FROM bound_fingerprint\n  ) THEN", '  IF false THEN'],
      ['continuing eligibility stops revalidating source availability', M98,
        '    SELECT d.required_approvers INTO derived_approvers\n      FROM public.derive_public_publication_authority_v1(bound_manifest) d;',
        '    SELECT ARRAY[]::uuid[] INTO derived_approvers;'],
      // The REV-01 direction: re-asking the publish-time ACTOR gate forever is
      // itself the regression, because it makes one human's later loss of Shared
      // browsing delete everyone else's Public view.
      ['continuing eligibility re-asks actor source ACCESS as a continuing condition', M98,
        '  -- AND THERE IS NO FIFTH GATE, ON PURPOSE.',
        '  IF EXISTS (\n    SELECT 1 FROM public.publication_package_item_provenance p\n'
        + '      JOIN public.publication_package_manifest_versions mv ON mv.id = p.manifest_version_id\n'
        + "     WHERE p.manifest_version_id = bound_manifest AND p.source_class = 'SHARED_WORLD'\n"
        + '       AND NOT EXISTS (\n         SELECT 1 FROM public.resolve_shared_world_history_visibility_v1(\n'
        + '                        p.shared_world_id, mv.publisher_user_id) vis\n'
        + '          WHERE vis.history_item_id = p.shared_history_item_id)\n  ) THEN\n'
        + "    RETURN QUERY SELECT p_experience_id, 'INELIGIBLE'::text, 'PUBLISHED_SOURCE_NOT_AVAILABLE'::text,\n"
        + '      NULL::uuid, NULL::uuid, NULL::integer;\n    RETURN;\n  END IF;\n\n'
        + '  -- AND THERE IS NO FIFTH GATE, ON PURPOSE.'],
      ['continuing eligibility reads Shared membership instead of canonical source truth', M98,
        '    SELECT d.required_approvers INTO derived_approvers\n      FROM public.derive_public_publication_authority_v1(bound_manifest) d;',
        '    SELECT ARRAY[]::uuid[] INTO derived_approvers;\n'
        + '    IF NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes ep\n'
        + '                    WHERE ep.ended_at IS NULL) THEN\n'
        + "      RETURN QUERY SELECT p_experience_id, 'INELIGIBLE'::text, 'PUBLISHED_SOURCE_NOT_AVAILABLE'::text,\n"
        + '        NULL::uuid, NULL::uuid, NULL::integer;\n      RETURN;\n    END IF;'],
      ['continuing eligibility stops comparing the stored rightsholder set', M98,
        '  IF stored_approvers IS DISTINCT FROM derived_approvers THEN', '  IF false THEN'],
      ['continuing eligibility lets a raise escape as an error a caller can read', M98,
        '  EXCEPTION\n    WHEN SQLSTATE \'P0002\' THEN', '  EXCEPTION\n    WHEN SQLSTATE \'XX000\' THEN'],
      ['canonical visibility stops consuming continuing eligibility', M98,
        "    FROM public.derive_public_continuing_eligibility_v1(p_experience_id) ce\n   WHERE ce.eligibility_state = 'ELIGIBLE';",
        '    FROM public.public_experience_publication_state ce\n   WHERE ce.experience_id = p_experience_id;'],
      ['canonical visibility exposes the internal ineligibility cause', M98,
        "    RETURN QUERY SELECT p_experience_id, 'NOT_PUBLICLY_VISIBLE'::text, NULL::uuid, NULL::uuid, NULL::integer;",
        '    RETURN QUERY SELECT p_experience_id, (SELECT ce.ineligibility_class\n      FROM public.derive_public_continuing_eligibility_v1(p_experience_id) ce), NULL::uuid, NULL::uuid, NULL::integer;'],
      ['the eligibility derivation opens to the service tier', M98,
        "      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);",
        "      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);"],
      ['PART A starts writing a row, so privacy waits on a write', M98,
        'CREATE FUNCTION public.derive_public_continuing_eligibility_v1(p_experience_id uuid)',
        'CREATE TABLE public.i05c_probe_cache (experience_id uuid PRIMARY KEY);\n'
        + 'CREATE FUNCTION public.derive_public_continuing_eligibility_v1(p_experience_id uuid)'],
      ['the disappearance core stops being the ONE lifecycle writer', M99,
        '  SELECT * INTO applied FROM public.apply_public_experience_disappearance_v1(\n    p_command_id, p_experience_id, \'AUTHORIZED_CONTROLLER_REMOVAL\');',
        "  UPDATE public.public_experiences e SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD' WHERE e.id = p_experience_id;\n"
        + '  SELECT * INTO applied FROM public.apply_public_experience_disappearance_v1(\n    p_command_id, p_experience_id, \'AUTHORIZED_CONTROLLER_REMOVAL\');'],
      ['the disappearance core admits an illegal predecessor state', M99,
        "   WHERE e.id = p_experience_id\n     AND e.current_lifecycle = 'PUBLISHED'\n     AND e.current_experience_version_id = s.published_experience_version_id;",
        '   WHERE e.id = p_experience_id;'],
      ['an I-05C primitive reactivates an absent Experience', M99,
        '  RETURN QUERY SELECT record_version, record_manifest, instant;',
        "  UPDATE public.public_experiences e SET current_lifecycle = 'PUBLISHED' WHERE e.id = p_experience_id;\n"
        + '  RETURN QUERY SELECT record_version, record_manifest, instant;'],
      ['removal stops requiring the exact Experience controller', M99,
        '  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c\n                                WHERE c.experience_id = p_experience_id AND c.controller_user_id = u) THEN',
        '  IF NOT FOUND THEN'],
      ['removal stops binding the exact published version', M99,
        '  IF publication.published_experience_version_id IS DISTINCT FROM p_experience_version_id THEN',
        '  IF false THEN'],
      ['reconciliation becomes a control action', M99,
        'DECLARE\n  committed public.public_experience_disappearance_commands;\n  experience public.public_experiences;\n  publication public.public_experience_publication_state;\n  eligibility record;',
        'DECLARE\n  u uuid := auth.uid();\n  committed public.public_experience_disappearance_commands;\n  experience public.public_experiences;\n  publication public.public_experience_publication_state;\n  eligibility record;'],
      ['reconciliation stops consuming the ONE continuing-eligibility truth', M99,
        '  SELECT * INTO eligibility FROM public.derive_public_continuing_eligibility_v1(p_experience_id);',
        "  SELECT 'INELIGIBLE'::text AS eligibility_state, 'PUBLISHED_SOURCE_NOT_AVAILABLE'::text AS ineligibility_class INTO eligibility;"],
      ['reconciliation stops holding the exact sources while it decides', M99,
        '  PERFORM 1 FROM public.shared_worlds w', '  PERFORM 1 FROM public.public_world_state w2 WHERE false AND EXISTS (SELECT 1 FROM public.shared_worlds w'],
      ['the disappearance record becomes mutable', M99,
        'CREATE TRIGGER public_experience_disappearance_state_immutable', 'CREATE TRIGGER public_experience_disappearance_state_later'],
      ['the disappearance binding weakens into two independent foreign keys', M99,
        '    CONSTRAINT public_experience_disappearance_state_publication_fk\n        FOREIGN KEY (experience_id, absent_experience_version_id, absent_manifest_version_id)\n        REFERENCES public.public_experience_publication_state\n                   (experience_id, published_experience_version_id, published_manifest_version_id)\n        ON DELETE RESTRICT\n',
        '    CONSTRAINT public_experience_disappearance_state_publication_fk\n        FOREIGN KEY (experience_id) REFERENCES public.public_experience_publication_state (experience_id) ON DELETE RESTRICT,\n'
        + '    CONSTRAINT public_experience_disappearance_state_manifest_fk\n        FOREIGN KEY (absent_manifest_version_id)\n'
        + '        REFERENCES public.publication_package_manifest_versions (id) ON DELETE RESTRICT\n'],
      ['a free-text cause column appears beside the bounded basis', M99,
        '    disappearance_basis text NOT NULL,\n', '    disappearance_basis text NOT NULL,\n    cause_detail text,\n'],
      ['the disappearance basis admits an invented class', M99,
        "        CHECK (disappearance_basis IN ('AUTHORIZED_CONTROLLER_REMOVAL',\n                                       'REQUIRED_APPROVAL_NOT_EFFECTIVE',\n                                       'PUBLISHED_SOURCE_NOT_AVAILABLE',\n                                       'PUBLICATION_AUTHORITY_INVALIDATED')),",
        '        CHECK (length(btrim(disappearance_basis)) > 0),'],
      ['the disappearance audit boundary opens to the service tier', M99,
        "    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);",
        "    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);"],
      ['a frozen predecessor migration is edited',
        'database/migrations/0095_public_experience_publication_visibility_serving_v1.sql', 'BEGIN;', 'BEGIN;\n-- edited\n'],
      ['the CI step that runs an I-05C verifier is removed', CI,
        `if npm run ${OWN_SCRIPT}; then result_0099=PASS; else status=1; fi`, 'if npm run test:toolchain; then result_0099=PASS; else status=1; fi'],
      ['the grouped I-05C CI step stops failing the job when a verifier fails', CI,
        '"$result_0098" "$result_0099" >> "$GITHUB_STEP_SUMMARY"\n          fi\n          exit "$status"\n',
        '"$result_0098" "$result_0099" >> "$GITHUB_STEP_SUMMARY"\n          fi\n          exit 0\n'],
      ['a failing I-05C verifier is swallowed instead of recorded', CI,
        'if npm run verify:public-continuing-eligibility-visibility-closure:integration; then result_0098=PASS; else status=1; fi',
        'npm run verify:public-continuing-eligibility-visibility-closure:integration || true'],
      ['the complete-disappearance helper stops asking a surface', SUPPORT,
        "    assert.deepEqual(await resolveResponses(experience, viewer), [], 'Public QANDEEL returns nothing');\n", ''],
      ['a failed I-05C verifier hangs its CI step instead of exiting', V98,
        '}, () => rt.client.end().catch(() => undefined));\n', '  await rt.client.end();\n});\n'],
      ['the disappearance verifier stops proving that a planted projection cannot serve', V99,
        "'F8 and the next rebuild removes the planted row'", "'F8 rebuild'"],
      ['a disappearance race awaits before releasing the other connection', V99,
        "    await q('COMMIT');\n    const [dup] = (await duplicate).rows;", "    const [dup] = (await duplicate).rows;\n    await q('COMMIT');"],
    ];
    for (const [reason, file, from, to] of regressions) {
      const fresh = buildMirror();
      try {
        patch(fresh, file, from, to);
        const { ok, output } = runInMirror(fresh);
        assert.equal(ok, false,
          `a repository where ${reason} must break at least one I-05C contract; both passed:\n${output.slice(-1500)}`);
      } finally {
        removeHarnessMirror(fresh);
      }
    }
  });
