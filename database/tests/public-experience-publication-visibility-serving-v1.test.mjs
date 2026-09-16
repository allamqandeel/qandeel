// I-05B - Public Experience Publication, Canonical Visibility and Serving v1:
// the secret-free structural contract for migration 0095.
//
// Live semantics - the fail-closed publication, the simulated-then-restored
// CW2-08 seam, the anti-oracle serving answer, races - are proven by
// database/verify-migration-0095.mjs against real PostgreSQL. What is proven HERE
// is the structure a migration must already have before it deploys: that the ONE
// PUBLISHED transition re-derives every gate from current state in the canonical
// order and consumes the CW2-08 prerequisite seam LAST, that the seam fails
// closed, that the ONE visibility derivation is the serving truth, that the ONE
// serving resolver composes both gates and discloses nothing private, and that
// only that resolver is reachable by an application role.
//
// Every assertion is scoped to migration 0095 and its own registration; the
// frozen predecessors are pinned by content, and its I-05B siblings are not.
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

const MIGRATION_NAME = '0095_public_experience_publication_visibility_serving_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0095.mjs');
const support = read('../public-runtime-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);

const OWN_TABLES = ['public_experience_publish_commands', 'public_experience_publication_state'];
const PUBLISH = 'publish_public_experience_v1';
const SEAM = 'resolve_public_publication_prerequisites_v1';
const VISIBILITY = 'resolve_public_visibility_state_v1';
const ADMISSION = 'resolve_public_audience_admission_v1';
const SERVING = 'resolve_public_experience_serving_v1';
const OWN_SCRIPT = 'verify:public-experience-publication-visibility-serving:integration';

const functionBody = (name) => {
  const start = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `migration 0095 creates ${name}`);
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
/** Executable statements only: prose in comments must never satisfy an ordering claim. */
const code = (body) => body.split('\n').map((line) => line.replace(/--.*$/u, '')).join('\n');

// ---------------------------------------------------------------------------

test('0095 is the forward migration after 0094, and every frozen predecessor it consumes is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0095_')).length, 1, 'exactly one migration carries the 0095 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0094_public_publication_effective_approval_state_v1.sql'));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of FROZEN_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu);
  assert.doesNotMatch(executableSql, /^ALTER TABLE public\.(?!public_experience_publish_commands|public_experience_publication_state)/mu,
    'the only tables 0095 alters are the two it created');
});

test('the CW2-08 prerequisite seam fails closed and decides nothing', () => {
  const { header, body } = functionBody(SEAM);
  assert.match(header, /SECURITY DEFINER STABLE SET search_path=''/u);
  assert.match(body, /RETURN QUERY SELECT 'NOT_EVALUATED'::text,/u, 'the only answer today is NOT_EVALUATED');
  assert.ok(!body.includes("'CLEARED'"), 'no permissive constant: the seam cannot say CLEARED until a canonical gate exists');
  assert.ok(!body.includes('public_audience_policy_state') && !body.includes('INSERT INTO'), 'it reads no viewing policy and writes nothing');
  assert.ok(!executableSql.includes('launch_gate') && !executableSql.includes('launch_ready'), 'no launch-ready row exists anywhere in 0095');
  assert.deepEqual(inputParameters(SEAM), ['p_experience_id', 'p_manifest_version_id']);
});

test('publication re-derives every gate from current state, in the canonical order, and consumes the seam LAST', () => {
  const { header, body } = functionBody(PUBLISH);
  assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path=''/u);
  assert.match(body, /u uuid := auth\.uid\(\);/u);
  assert.deepEqual(inputParameters(PUBLISH), ['p_command_id', 'p_experience_id', 'p_experience_version_id'],
    'no approver, authority, clearance, audience or instant parameter');
  const c = code(body);
  const at = (needle) => { const i = c.indexOf(needle); assert.ok(i >= 0, `publication contains: ${needle}`); return i; };
  const world = at('PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;');
  const experience = at('SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;');
  const controller = at("IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c\n                                WHERE c.experience_id = p_experience_id AND c.controller_user_id = u) THEN\n    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED'");
  const lifecycle = at("IF experience.current_lifecycle <> 'READY_FOR_REVIEW' THEN\n    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID'");
  const version = at('WHERE v.id = p_experience_version_id AND v.experience_id = p_experience_id;');
  const current = at("IF experience.current_experience_version_id IS DISTINCT FROM p_experience_version_id THEN\n    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE'");
  const readyBinding = at('FROM public.public_experience_review_ready_commands r');
  const manifest = at('WHERE m.id = publishing.package_manifest_version_id FOR SHARE;');
  const sharedWorld = at('PERFORM 1 FROM public.shared_worlds w');
  const materials = at('PERFORM 1 FROM public.shared_world_materials m');
  const history = at('PERFORM 1 FROM public.shared_world_history_items i');
  const units = at('PERFORM 1 FROM public.conversation_units cu');
  const access = at('SELECT 1 FROM public.resolve_shared_world_history_visibility_v1(p.shared_world_id, u) v');
  const personal = at('AND p.personal_owner_user_id <> u');
  const authority = at('FROM public.derive_public_publication_authority_v1(manifest.id) d;');
  const stored = at("IF stored <> derived_approvers THEN\n    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE'");
  const missing = at("WHERE s.effective_state = 'MISSING') THEN\n    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_APPROVALS_INCOMPLETE'");
  const notEffective = at("WHERE s.effective_state <> 'EFFECTIVE') THEN\n    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_APPROVAL_NOT_EFFECTIVE' USING ERRCODE='55000'");
  const fingerprint = at("WHERE s.bound_authority_fingerprint IS DISTINCT FROM derived_fingerprint) THEN\n    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE'");
  const ready = at("IF ready_fingerprint IS DISTINCT FROM derived_fingerprint THEN\n    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE'");
  const seam = at('FROM public.resolve_public_publication_prerequisites_v1(p_experience_id, manifest.id) c;');
  const cleared = at("IF clearance_state IS DISTINCT FROM 'CLEARED'");
  const write = at("SET current_lifecycle = 'PUBLISHED', experience_revision = e.experience_revision + 1");
  const order = [world, experience, controller, lifecycle, version, current, readyBinding, manifest, sharedWorld, materials, history, units,
    access, personal, authority, stored, missing, notEffective, fingerprint, ready, seam, cleared, write];
  for (let i = 1; i < order.length; i += 1) assert.ok(order[i] > order[i - 1], `gate ${i} follows gate ${i - 1}: the canonical order is kept`);
  assert.ok(seam > notEffective && seam > ready, 'the CW2-08 prerequisite is the LAST gate: authority truth is answered first');
  assert.ok(write > cleared, 'nothing is written before the last gate passes');
  // The refusal for a hidden Shared source is the SAME class a nonexistent source gets.
  const accessStatement = c.slice(access, c.indexOf('END IF;', access));
  assert.match(accessStatement, /RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002'/u);
  assert.ok(!accessStatement.includes('NOT_AUTHORIZED'), 'a source the publisher may no longer see is not distinguishable from one that does not exist');
  // Exactly one lifecycle value is ever written, and it is PUBLISHED.
  assert.equal((body.match(/current_lifecycle = '/gu) ?? []).length, 1, 'the publish boundary writes exactly one lifecycle value');
  assert.match(body, /VALUES \(p_command_id, p_experience_id, p_experience_version_id, 'READY_FOR_REVIEW', 'PUBLISHED', instant\);/u,
    'the transition it appends is READY_FOR_REVIEW -> PUBLISHED and reuses the command identity');
  assert.ok(!body.includes('ABSENT_FROM_PUBLIC_WORLD'), 'the publish boundary owns no disappearance lifecycle - not even in a comment');
  assert.ok(!body.includes('PREPARE_PUBLICATION'), 'a preparation command is never publication consent');
  assert.match(body, /INSERT INTO public\.public_experience_publication_state/u, 'the immutable publication record is written in the same transaction');
  assert.match(body, /derived_fingerprint, btrim\(clearance_reason\), 1, instant\);/u, 'and names the basis the seam gave');
  assert.ok(!body.includes('public_experience_search_projection') && !body.includes('public_experience_vitality_state'),
    'publication writes no derived projection: projections are rebuilt, never trusted');
  assert.equal((body.match(/WHERE c\.id = p_command_id/gu) ?? []).length, 2, 'idempotency is checked before any lock and under it');
  assert.match(body, /QANDEEL_CWV2_PUBLIC_PUBLISH_COMMAND_V1/u);
  assert.doesNotMatch(body, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp/iu);
  assert.doesNotMatch(body, /pg_advisory|LOCK TABLE|TRUNCATE/iu);
  assert.doesNotMatch(body, /(INSERT INTO|UPDATE|DELETE FROM) public\.(shared_world|conversation_|users|publication_manifest_approvals|publication_manifest_required_approvers|public_experience_controllers|publication_package)/u,
    'publication mutates no source, no evidence, no control and no package');
  for (const forbidden of ['shared_world_membership_episodes', 'shared_world_history_access_grants', 'shared_world_standard_closed_view_entitlements',
    'shared_world_history_package_manifest_items']) {
    assert.ok(!body.includes(forbidden), `publication consumes the canonical I-04F entry point rather than re-deriving ${forbidden}`);
  }
});

test('the ONE visibility derivation requires PUBLISHED plus a consistent immutable publication record, and fails closed to one state', () => {
  const { header, body } = functionBody(VISIBILITY);
  assert.match(header, /SECURITY DEFINER STABLE SET search_path=''/u);
  for (const needle of ["AND e.current_lifecycle = 'PUBLISHED'", 'JOIN public.public_experience_publication_state s ON s.experience_id = e.id',
    'AND e.current_experience_version_id = s.published_experience_version_id', 'AND s.published_manifest_version_id = v.package_manifest_version_id',
    "RETURN QUERY SELECT p_experience_id, 'PUBLICLY_VISIBLE'::text, found_version, found_manifest, found_ordinal;",
    "RETURN QUERY SELECT p_experience_id, 'NOT_PUBLICLY_VISIBLE'::text, NULL::uuid, NULL::uuid, NULL::integer;"]) {
    assert.ok(body.includes(needle), `visibility: ${needle}`);
  }
  assert.equal((body.match(/RETURN QUERY/gu) ?? []).length, 2, 'exactly two answers exist, and every non-visible case is the second');
  assert.ok(!body.includes('public_audience_policy_state'), 'object visibility and viewer admission are different gates');
  assert.ok(!body.includes('INSERT INTO') && !body.includes('UPDATE public'), 'and it writes nothing');
  const admission = functionBody(ADMISSION);
  assert.match(admission.header, /SECURITY DEFINER STABLE SET search_path=''/u);
  assert.match(admission.body, /SELECT \* INTO audience_policy FROM public\.public_audience_policy_state ps WHERE ps\.singleton;/u,
    'admission reads the frozen 0091 policy gate');
  assert.match(admission.body, /audience_policy\.signed_out_viewing_policy = 'ALLOWED'/u, 'signed-out is admitted only when the frozen requirement is resolved ALLOWED');
  assert.match(admission.body, /EXISTS \(SELECT 1 FROM public\.users us WHERE us\.id = p_viewer_user_id\)/u, 'a registered viewer must be a real account');
  assert.ok(!admission.body.includes('public_experiences'), 'admission decides nothing about any object');
});

test('the ONE serving resolver composes both gates, returns the bounded derivative only, and is the only application-reachable function', () => {
  const { header, body } = functionBody(SERVING);
  assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''/u);
  assert.match(body, /FROM public\.resolve_public_visibility_state_v1\(p_experience_id\) vs\s*\n\s*JOIN public\.resolve_public_audience_admission_v1\(p_viewer_user_id\) ad ON ad\.admission = 'ADMITTED'/u);
  assert.match(body, /WHERE vs\.visibility_state = 'PUBLICLY_VISIBLE'\s*\n\s*ORDER BY it\.item_ordinal;/u, 'package order, visible only');
  assert.ok(!body.includes('publication_package_item_provenance'), 'it never reads sealed provenance');
  assert.ok(!body.includes('current_lifecycle'), 'it tests no lifecycle for itself');
  const columns = resultColumns(SERVING);
  for (const column of columns) {
    assert.doesNotMatch(column, /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material_id|history_item|availability|context_ref|world_id|provenance|digest|fingerprint/u,
      `the serving resolver must not return ${column}`);
  }
  assert.ok(columns.includes('publisher_public_identity_ref') && columns.includes('publisher_display_label') && columns.includes('public_text_body'),
    'it returns the stable public ref, the CURRENT label and the public body');
  const grants = [...executableSql.matchAll(/GRANT EXECUTE ON FUNCTION ([^\n']+)/gu)].map((m) => m[1].trim());
  assert.deepEqual(grants, ['%s TO service_role'], 'the ONE grant in the migration is the serving resolver, to service_role, through the loop');
  assert.ok(executableSql.includes(`resolver text := 'public.${SERVING}(uuid, uuid)'`));
  for (const name of [PUBLISH, SEAM, VISIBILITY, ADMISSION, 'reject_public_publication_state_mutation_v1']) {
    assert.ok(executableSql.includes(`'public.${name}(`), `${name} is named in the revoke posture`);
  }
});

test('the publication record is immutable, bound to a version of its own Experience, and carries no decision column', () => {
  assert.match(executableSql, /CONSTRAINT public_experience_publication_state_version_fk\s*\n\s*FOREIGN KEY \(published_experience_version_id, experience_id\)\s*\n\s*REFERENCES public\.public_experience_versions \(id, experience_id\) ON DELETE RESTRICT/u);
  assert.match(executableSql, /CONSTRAINT public_experience_publication_state_manifest_fk\s*\n\s*FOREIGN KEY \(published_manifest_version_id, experience_id\)\s*\n\s*REFERENCES public\.public_experience_versions \(package_manifest_version_id, experience_id\)/u,
    'the published manifest can only be a manifest of a version of this exact Experience');
  assert.match(executableSql, /CONSTRAINT public_experience_publication_state_version_key UNIQUE \(published_experience_version_id\)/u);
  assert.match(executableSql, /CREATE TRIGGER public_experience_publication_state_immutable\s*\n\s*BEFORE UPDATE OR DELETE ON public\.public_experience_publication_state/u);
  assert.match(executableSql, /CONSTRAINT public_experience_publish_commands_version_key UNIQUE \(experience_version_id\)/u, 'one version publishes at most once');
  for (const table of OWN_TABLES) {
    const start = executableSql.indexOf(`CREATE TABLE public.${table} (`);
    const block = executableSql.slice(start, executableSql.indexOf('\n);', start));
    for (const line of block.split('\n').filter((l) => /^ {4}\w+\s+\S/u.test(l) && !/^ {4}CONSTRAINT\b/u.test(l))) {
      assert.doesNotMatch(line.trim().split(/\s+/u)[0],
        /safety|moderation|launch|entitlement|premium|feature_flag|allow|visib|semantic|placement|vitality|discussion|reply|session|turn|conversation_unit|world_id|shared_|material_id|history_item|email|phone|contact|credential/u);
    }
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'u'));
  }
});

test('the self-assertions refuse to deploy a migration that lost any of this', () => {
  for (const phrase of [
    'before the frozen CW2-08 Launch Gate exists',
    'the CW2-08 prerequisite seam must answer NOT_EVALUATED and never CLEARED until the canonical gate exists',
    'the prerequisite seam decides nothing and reads no viewing policy',
    'publication derives the publishing human from auth.uid()',
    'publication must take the canonical Public lock order and the frozen I-04 source order',
    'publication requires the exact Experience controller',
    'publication must require READY_FOR_REVIEW and refuse every other lifecycle',
    'publication must bind the exact version the canonical READY transition committed',
    'publication must prove the publishing human may currently SEE each included Shared source through the canonical I-04F entry point',
    'publication must revalidate the exact rightsholder set and fingerprint through the ONE I-05A derivation',
    'publication must require every required approval to be currently EFFECTIVE through the ONE 0094 derivation',
    'publication must refuse a stale READY snapshot rather than trust it',
    'publication must consume the CW2-08 prerequisite seam and require exactly CLEARED',
    'the publish boundary must write exactly PUBLISHED',
    'the publish boundary owns no disappearance lifecycle',
    'a preparation command is never publication consent',
    'publication must mutate no source, no approval evidence, no control and no package',
    'publication must not re-implement Shared membership or history authorization',
    'may not accept an authority audience visibility clearance or instant parameter',
    'the canonical visibility derivation must require PUBLISHED and a consistent immutable publication record, and fail closed to NOT_PUBLICLY_VISIBLE',
    'object visibility and viewer admission are different gates',
    'the serving resolver must be a STABLE SECURITY DEFINER with an empty search_path',
    'service_role must execute the ONE serving resolver',
    'the serving resolver must consume the canonical visibility state and the audience admission gate',
    'the serving resolver must never read sealed provenance and never test a lifecycle for itself',
    'the serving resolver must disclose no private identity and no sealed provenance',
    'the publication record must be append-only for every role',
    'the publication record must bind the exact version of its own Experience by restrictive foreign key',
    'the frozen I-04F history visibility entry point must still be reachable',
    'the frozen 0092 approval evidence must still be append-only',
    'the frozen 0091 lifecycle truth must still be append-only',
    'the frozen CW2-08 signed-out viewing requirement must remain UNRESOLVED',
  ]) {
    assert.ok(selfAssertions.includes(phrase), `the migration refuses itself when: ${phrase}`);
  }
  assert.match(selfAssertions, /has_function_privilege\('public', fn, 'EXECUTE'\)/u);
  assert.ok(!selfAssertions.includes('count(*) = '), 'no self-assertion caps how many objects may exist');
  // Nothing here forbids the later reviewed disappearance slice. The one refusal
  // that mentions disappearance is scoped to the publish boundary's OWN body
  // ("owns no disappearance lifecycle"); no refusal names a later object, caps
  // the catalog, or requires a lifecycle value to be unreachable schema-wide.
  const refusals = [...selfAssertions.matchAll(/RAISE EXCEPTION '([^']*)'/gu)].map((m) => m[1].toLowerCase());
  assert.equal(refusals.find((m) => /absence_state|i-05c|later slice|must not exist|no function may write/u.test(m)), undefined,
    'no self-assertion forbids a later reviewed I-05C object');
  assert.ok(!selfAssertions.includes("pg_proc") || !/prosrc ~ 'ABSENT_FROM_PUBLIC_WORLD'[\s\S]{0,80}?FROM pg_proc pr\s+WHERE ns\.nspname/u.test(selfAssertions),
    'the disappearance check reads the publish boundary alone, never a census of every function');
});

test('0095 is registered in the toolchain, in the I-05B CI group, and in the database README', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0095\\.mjs"`, 'u'));
  assert.match(readme, /0095_public_experience_publication_visibility_serving_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`));
  assert.ok(readme.includes('PUBLIC_VISIBILITY_STATE') && readme.includes('NOT_EVALUATED'), 'the README records the visibility truth and the fail-closed seam');
  assert.match(verifier, /verifier for migration 0095/iu);
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0095=PASS; else status=1; fi`));
  assert.ok(workflow.includes('exit "$status"'));
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu);
});

test('the verifier reaches PUBLISHED only through a simulated seam it restores and proves restored, and proves every refusal', () => {
  assert.match(support, /async function captureSeam\(\)/u);
  assert.match(support, /async function clearPrerequisites\(\)/u);
  assert.match(support, /async function restorePrerequisites\(seam\)/u);
  assert.match(support, /await q\(seam\.definition\);/u, 'the production seam definition is re-executed');
  assert.match(support, /assert\.equal\(prosrc, seam\.prosrc, 'the production prerequisite seam is restored byte for byte'\);/u);
  assert.match(support, /I-05B VERIFIER PROBE/u, 'the simulated clearance names itself as a probe');
  assert.ok(!support.includes('INSERT INTO public.public_experience_publication_state'), 'the harness never fabricates a publication record');
  assert.match(verifier, /PUBLIC_EXPERIENCE_LAUNCH_PREREQUISITE_UNRESOLVED/u, 'PB02: the production seam refuses a fully authorized publication');
  for (const needle of ['PB01', 'PB02', 'PB03', 'PB04', 'PB05', 'PB06', 'PB07', 'PB08', 'PB09', 'PB10', 'PB11', 'PB12',
    'VS01', 'VS02', 'SV01', 'SV02', 'SV03', 'C01a', 'C01b', 'C02', 'C03', 'C04', 'assertNothingPublished',
    'PUBLIC_EXPERIENCE_APPROVAL_NOT_EFFECTIVE', 'PUBLIC_EXPERIENCE_APPROVALS_INCOMPLETE', 'SAVEPOINT forward_safety',
    'i05b95_probe_absence_v1', 'the production seam is exactly what the migration installed']) {
    assert.ok(verifier.includes(needle), `the verifier proves ${needle}`);
  }
  // Every launched blocking promise is awaited only after the release edge.
  for (const [launched, release] of [['withdrawing', "await q('COMMIT')"], ['publishing', "await q2('COMMIT')"], ['preparing', "await q('COMMIT')"],
    ['duplicate', "await q('COMMIT')"], ['racing', "await q2('COMMIT')"]]) {
    const launch = verifier.indexOf(`const ${launched} = q`);
    assert.ok(launch > 0, `${launched} is LAUNCHED rather than awaited inline`);
    const released = verifier.indexOf(release, launch);
    const settled = Math.min(...[`await ${launched}`, `assert.rejects(${launched}`].map((s) => verifier.indexOf(s, launch)).filter((i) => i > 0));
    assert.ok(released > launch && settled > released, `${launched} is awaited only after the other connection released`);
  }
  assert.match(verifier, /finally \{\s*\n\s*await close\(\);\s*\n\s*await asRole\('postgres'\);\s*\n\s*await rt\.restorePrerequisites\(seam\);/u,
    'the committed seam simulation is restored in finally');
});
