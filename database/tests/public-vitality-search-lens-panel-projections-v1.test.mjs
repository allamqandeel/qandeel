// I-05B - Public Vitality and Search / Lens / Panel Projections v1: the
// secret-free structural contract for migration 0097, and the forward-safety and
// anti-vacuity probe for the WHOLE I-05B slice.
//
// Live semantics are proven by database/verify-migration-0097.mjs against real
// PostgreSQL. What is proven HERE is the structure a migration must already have
// before it deploys: derived state that is recomputed deterministically from
// canonical rows, bounded by the ONE visibility truth, never an authority, never
// served while stale, and cleared when the visibility it was derived from ends.
//
// ## Why the probe lives in this file and not in all four
//
// A mirror-based probe is expensive. The probe below mirrors once and runs ALL
// FOUR I-05B contracts against a mutated tree, so the property every one of them
// must have - "this is a contract, not a ceiling on the roadmap" - is proven for
// all four from one place: a later reviewed I-05C absence slice, a real CW2-08
// gate replacing the seam, a launch-gated grant, additive columns and indexes
// and a new CI step must all leave I-05B passing, and every real weakening of an
// I-05B authority, privacy or visibility invariant must break at least one.
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
const PROBE_CHILD = 'QANDEEL_I05B_PUBLIC_RUNTIME_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0097_public_vitality_search_lens_panel_projections_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0097.mjs');
const support = read('../public-runtime-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);

const OWN_TABLES = ['public_experience_vitality_state', 'public_experience_search_projection'];
const RECOMPUTE = 'recompute_public_experience_vitality_v1';
const REBUILD = 'rebuild_public_experience_projection_v1';
const RESOLVERS = ['resolve_public_experience_vitality_v1', 'search_public_experiences_v1', 'resolve_public_lens_v1', 'resolve_public_panel_v1'];
const OWN_SCRIPT = 'verify:public-vitality-search-lens-panel-projections:integration';

const functionBody = (name) => {
  const start = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `migration 0097 creates ${name}`);
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
  return [...table[1].matchAll(/(\w+)\s+(?:uuid\[\]|text\[\]|uuid|text|integer|bigint|boolean|timestamptz|real|tsvector)/gu)].map((m) => m[1]);
};
const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration 0097 creates ${name}`);
  return executableSql.slice(start, executableSql.indexOf('\n);', start));
};
const columnNames = (name) => tableBlock(name).split('\n')
  .filter((line) => /^ {4}\w+\s+\S/u.test(line) && !/^ {4}CONSTRAINT\b/u.test(line)).map((line) => line.trim().split(/\s+/u)[0]);

// ---------------------------------------------------------------------------

test('0097 is the forward migration after 0096, and every frozen predecessor it consumes is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0097_')).length, 1, 'exactly one migration carries the 0097 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0096_public_semantic_placement_discussion_qandeel_v1.sql'));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of FROZEN_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu);
  assert.doesNotMatch(executableSql, /^ALTER TABLE public\.(?!public_experience_vitality_state|public_experience_search_projection)/mu,
    'the only tables 0097 alters are the two it created');
});

test('derived state is recomputed deterministically from canonical rows, bounded by the ONE visibility truth, and never an authority', () => {
  for (const name of [RECOMPUTE, REBUILD]) {
    const { header, body } = functionBody(name);
    assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path=''/u);
    assert.ok(!body.includes('auth.uid()'), `${name} is machine state and derives no human`);
    assert.deepEqual(inputParameters(name), ['p_experience_id'], `${name} accepts no derived value: it recomputes`);
    assert.match(body, /PERFORM 1 FROM public\.public_experiences e WHERE e\.id = p_experience_id FOR SHARE;/u, `${name} holds the Experience row FOR SHARE`);
    assert.match(body, /FROM public\.resolve_public_visibility_state_v1\(p_experience_id\) vs\s*\n\s*WHERE vs\.visibility_state = 'PUBLICLY_VISIBLE';/u,
      `${name} is bounded by the canonical visibility truth`);
    assert.ok(!body.includes('SET current_lifecycle') && !body.includes('to_lifecycle') && !body.includes('ABSENT_FROM_PUBLIC_WORLD'), `${name} moves no lifecycle`);
    assert.doesNotMatch(body, /(INSERT INTO|UPDATE|DELETE FROM) public\.(public_experiences|public_experience_versions|public_experience_lifecycle_events|public_experience_publication_state|public_experience_controllers|public_experience_semantic_placements|public_discussion_posts|public_qandeel_responses|publication_package|publication_manifest|publication_approval|shared_world|conversation_|users|public_identities|public_identity_display_state)/u,
      `${name} writes only its own derived family`);
    assert.ok(!body.includes('publication_package_item_provenance') && !body.includes('shared_world') && !body.includes('conversation_unit'),
      `${name} reads no sealed provenance and no source`);
    assert.match(body, /IS DISTINCT FROM/u, `${name} writes only when the canonical answer differs from what is stored`);
    assert.match(body, /GET DIAGNOSTICS affected = ROW_COUNT;/u, `${name} reports UNCHANGED truthfully`);
  }
  const recompute = functionBody(RECOMPUTE).body;
  assert.match(recompute, /RETURN QUERY SELECT 'NOT_PUBLICLY_VISIBLE'::text, p_experience_id, NULL::uuid, NULL::bigint,\s*\n\s*NULL::integer, NULL::integer, NULL::timestamptz;\s*\n\s*RETURN;/u,
    'a recompute of a non-visible Experience writes nothing and answers ONE outcome');
  // REV-03: vitality computed FOR the visible version counts only the activity bound
  // TO that version. A superseded version's conversation is its own history, never
  // silently the current version's heat.
  assert.match(recompute, /FROM public\.public_discussion_posts dp\s*\n\s*WHERE dp\.experience_id = p_experience_id AND dp\.target_experience_version_id = visible_version;/u,
    'posts are counted for the visible version only');
  assert.match(recompute, /FROM public\.public_qandeel_responses r\s*\n\s*WHERE r\.experience_id = p_experience_id AND r\.experience_version_id = visible_version;/u,
    'responses are counted for the visible version only');
  assert.match(recompute, /ON CONFLICT ON CONSTRAINT public_experience_vitality_state_pk DO UPDATE/u);
  assert.match(recompute, /CASE WHEN affected = 0 THEN 'VITALITY_UNCHANGED' ELSE 'VITALITY_RECOMPUTED' END/u);
  const rebuild = functionBody(REBUILD).body;
  assert.match(rebuild, /DELETE FROM public\.public_experience_search_projection pr WHERE pr\.experience_id = p_experience_id;/u,
    'a projection of a non-visible Experience is cleared: no projection outlives visibility');
  assert.match(rebuild, /CASE WHEN affected > 0 THEN 'PROJECTION_CLEARED' ELSE 'PROJECTION_ABSENT' END/u);
  assert.match(rebuild, /FROM public\.derive_public_experience_current_placement_v1\(visible_version\) cp;/u, 'the current interpretation of the VISIBLE version');
  assert.match(rebuild, /to_tsvector\('pg_catalog\.simple',\s*\n\s*coalesce\(placement_label, ''\) \|\| ' '\s*\n\s*\|\| coalesce\(string_agg\(b\.public_text_body, ' ' ORDER BY it\.item_ordinal\), ''\)\)/u,
    'the search document is the public derivative bodies in package order plus the semantic label - the simple configuration, no ranking policy');
  assert.match(rebuild, /WHERE it\.manifest_version_id = visible_manifest;/u, 'of the VISIBLE manifest');
  assert.match(rebuild, /CASE WHEN affected = 0 THEN 'PROJECTION_UNCHANGED' ELSE 'PROJECTION_REBUILT' END/u);
});

test('the four resolvers compose both gates, serve a stored row only for the currently visible version, and disclose nothing private', () => {
  for (const name of RESOLVERS) {
    const { header, body } = functionBody(name);
    assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''/u);
    assert.ok(body.includes('resolve_public_visibility_state_v1') && body.includes("ad.admission = 'ADMITTED'") && body.includes("visibility_state = 'PUBLICLY_VISIBLE'"),
      `${name} consumes the canonical visibility state and the admission gate`);
    assert.ok(!body.includes('publication_package_item_provenance') && !body.includes('current_lifecycle') && !body.includes('INSERT INTO'),
      `${name} reads no provenance, tests no lifecycle and writes nothing`);
    for (const column of resultColumns(name)) {
      assert.doesNotMatch(column, /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material_id|history_item|availability|context_ref|world_id|provenance|digest|fingerprint/u,
        `${name} must not return ${column}`);
    }
  }
  for (const name of ['search_public_experiences_v1', 'resolve_public_lens_v1']) {
    assert.match(functionBody(name).body, /ON vs\.visibility_state = 'PUBLICLY_VISIBLE'\s*\n\s*AND vs\.visible_experience_version_id = pr\.experience_version_id/u,
      `${name} never serves a stale projection`);
  }
  assert.match(functionBody('resolve_public_experience_vitality_v1').body, /AND st\.experience_version_id = vs\.visible_experience_version_id/u,
    'vitality is served only for the version it was computed for');
  assert.match(functionBody('resolve_public_panel_v1').body, /LEFT JOIN LATERAL public\.derive_public_experience_current_placement_v1\(vs\.visible_experience_version_id\) cp ON true/u,
    'the panel reads the live current interpretation, not a copy');
  assert.match(functionBody('search_public_experiences_v1').body, /plainto_tsquery\('pg_catalog\.simple', p_query\)/u);
  const grants = [...executableSql.matchAll(/GRANT EXECUTE ON FUNCTION ([^\n']+)/gu)].map((m) => m[1].trim());
  assert.deepEqual(grants, ['%s TO service_role'], 'the ONE grant statement is the resolvers loop, to service_role');
  assert.match(executableSql, /FOREACH fn IN ARRAY internal LOOP\s*\n\s*EXECUTE format\('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn\);\s*\n\s*IF EXISTS\(SELECT 1 FROM pg_roles WHERE rolname='service_role'\) THEN\s*\n\s*EXECUTE format\('REVOKE ALL ON FUNCTION %s FROM service_role', fn\);/u,
    'the two writers are revoked from every application role');
  for (const name of [RECOMPUTE, REBUILD, ...RESOLVERS]) assert.ok(executableSql.includes(`'public.${name}(`), `${name} is named in the security posture`);
});

test('derived relations bind the exact version, carry no source or decision column, and are sealed', () => {
  for (const table of OWN_TABLES) {
    assert.match(tableBlock(table), /FOREIGN KEY \(experience_version_id, experience_id\)\s*\n\s*REFERENCES public\.public_experience_versions \(id, experience_id\) ON DELETE RESTRICT/u,
      `${table} binds the exact version of the exact Experience`);
    for (const column of columnNames(table)) {
      assert.doesNotMatch(column, /safety|moderation|launch|entitlement|premium|feature_flag|allow|approv|control|consent|user_id|author|session|turn|conversation_unit|world_id|shared_|material_id|history_item|email|phone|contact|credential|source_|display_label/u,
        `${table} carries no ${column}`);
    }
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'u'));
  }
  assert.match(executableSql, /CREATE INDEX public_experience_search_projection_document_idx\s*\n\s*ON public\.public_experience_search_projection USING gin \(search_document\);/u);
  assert.match(tableBlock('public_experience_search_projection'), /CHECK \(\(\(placement_revision IS NULL\) = \(lens_key IS NULL\)\)\s*\n\s*AND \(\(lens_key IS NULL\) = \(semantic_label IS NULL\)\)\)/u,
    'the interpretation triple is present together or absent together');
});

test('the self-assertions refuse to deploy a migration that lost any of this', () => {
  for (const phrase of [
    'before the frozen CW2-08 Launch Gate exists',
    'derived-state writer % must be VOLATILE',
    'is machine state and derives no human',
    'must be bounded by the canonical visibility truth',
    'must hold the Experience row FOR SHARE while it derives',
    'can move no lifecycle: derived state is never an authority',
    'must write only its own derived family',
    'must read no sealed provenance and no source',
    'may not accept a derived value: it recomputes from canonical rows',
    'a projection of a non-visible Experience must be cleared on rebuild',
    'the search projection is built from the public derivative bodies and the current interpretation only',
    'a vitality recompute of a non-visible Experience must report NOT_PUBLICLY_VISIBLE and write nothing',
    'vitality computed for a version must count only the activity bound to that version',
    'must consume the canonical visibility state and the audience admission gate',
    'must read no sealed provenance, test no lifecycle for itself and write nothing',
    'must disclose no private identity and no sealed provenance',
    'must serve a projection only while it describes the currently visible version',
    'vitality is served only for the version it was computed for',
    'must bind the exact version it was derived for',
    'may reference nothing but the Public Experience and its versions',
    'may carry no authority decision source or private identity column',
    'the canonical visibility derivation must stay internal',
  ]) {
    assert.ok(selfAssertions.includes(phrase), `the migration refuses itself when: ${phrase}`);
  }
  assert.ok(!selfAssertions.includes('count(*) = '), 'no self-assertion caps how many objects may exist');
});

test('0097 is registered in the toolchain, in the I-05B CI group, and in the database README', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0097\\.mjs"`, 'u'));
  assert.match(readme, /0097_public_vitality_search_lens_panel_projections_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`));
  assert.ok(readme.includes('I-05C'), 'the README records what I-05B leaves open');
  assert.match(verifier, /verifier for migration 0097/iu);
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0097=PASS; else status=1; fi`));
  assert.ok(workflow.includes('exit "$status"'), 'the grouped I-05B step fails the job when any verifier failed');
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu);
  for (const result of ['result_0094=FAIL', 'result_0095=FAIL', 'result_0096=FAIL', 'result_0097=FAIL']) {
    assert.ok(workflow.includes(result), `${result}: a crash mid-way never reads as PASS`);
  }
});

test('the verifier proves determinism, the stale-projection law and the visibility race against real PostgreSQL', () => {
  for (const needle of ['VT01', 'VT02', 'VT03', 'VT04', 'PJ01', 'PJ02', 'PJ03', 'PJ04', 'C01', 'C02', 'VITALITY_UNCHANGED', 'PROJECTION_UNCHANGED',
    'PROJECTION_CLEARED', 'PROJECTION_ABSENT', 'NOT_PUBLICLY_VISIBLE', 'tsvector_to_array', 'SAVEPOINT forward_safety', 'i05b97_probe_absence_v1',
    'publishCleared', 'restorePrerequisites',
    // REV-03: under a valid successor visible version (verifier-only simulation) the V1
    // vitality is not served, a recompute for V2 counts none of V1's activity, only V2
    // activity moves it, and the recompute mutant that counts every version is refused.
    'simulateSuccessorVersion', 'SAVEPOINT successor', 'V2 vitality counts no V1 post', 'only V2 activity moves V2 vitality',
    'a vitality recompute that counts a superseded version']) {
    assert.ok(verifier.includes(needle), `the verifier proves ${needle}`);
  }
  const launch = verifier.indexOf('const rebuilding = q2(');
  const release = verifier.indexOf("await q('COMMIT')", launch);
  const settle = verifier.indexOf('await rebuilding', launch);
  assert.ok(launch > 0 && release > launch && settle > release, 'the rebuild race is awaited only after the publication committed');
  assert.match(support, /SET lock_timeout = '10s'/u);
});

// ---------------------------------------------------------------------------
// Forward safety and anti-vacuity for the WHOLE I-05B slice.
// ---------------------------------------------------------------------------

const I05B_CONTRACTS = [
  'database/tests/public-publication-effective-approval-state-v1.test.mjs',
  'database/tests/public-experience-publication-visibility-serving-v1.test.mjs',
  'database/tests/public-semantic-placement-discussion-qandeel-v1.test.mjs',
  'database/tests/public-vitality-search-lens-panel-projections-v1.test.mjs',
];
const MIRRORED = ['.github', 'database', 'tests', 'package.json'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i05b-public-');
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
  const files = I05B_CONTRACTS.map((relative) => join(mirror, relative));
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files],
    { cwd: mirror, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024 });
  assert.equal(result.error, undefined, `the mirrored contracts could not be started: ${result.error?.message}`);
  assert.notEqual(result.status, null, 'the mirrored contracts did not exit normally');
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.match(output, /# pass \d+/u, `the mirrored contracts reported no results:\n${output.slice(-1500)}`);
  assert.doesNotMatch(output, /# pass 0\b/u, 'the mirrored contracts executed nothing');
  return { ok: result.status === 0, output };
}

const M94 = 'database/migrations/0094_public_publication_effective_approval_state_v1.sql';
const M95 = 'database/migrations/0095_public_experience_publication_visibility_serving_v1.sql';
const M96 = 'database/migrations/0096_public_semantic_placement_discussion_qandeel_v1.sql';
const M97 = `database/migrations/${MIGRATION_NAME}`;
const SUPPORT = 'database/public-runtime-verifier-support.mjs';
const V95 = 'database/verify-migration-0095.mjs';
const CI = '.github/workflows/api-ci.yml';
const GROUP_STEP = '      - name: Verify the four I-05B Public World runtime verifiers against real PostgreSQL as one reported group';

test('every authorized later I-05C / CW2-08 / launch addition leaves all four I-05B contracts passing',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const mirror = buildMirror();
    try {
      // A later reviewed slice: the I-05C absence record and writer, a REAL CW2-08
      // gate replacing the seam, a launch-gated grant, additive columns and an index.
      write(mirror, 'database/migrations/0098_public_world_absence_and_launch_gate_v1.sql',
        'BEGIN;\n'
        + 'CREATE TABLE public.public_experience_absence_state (\n'
        + '  experience_id uuid PRIMARY KEY REFERENCES public.public_experiences (id), absent_since timestamptz NOT NULL);\n'
        + 'CREATE TABLE public.public_launch_gate_state (singleton boolean PRIMARY KEY CHECK (singleton), publication_cleared boolean NOT NULL);\n'
        + 'CREATE FUNCTION public.withdraw_public_experience_from_public_world_v1(p_id uuid) RETURNS void\n'
        + "  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + "  BEGIN UPDATE public.public_experiences e SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD' WHERE e.id = p_id; END$fn$;\n"
        + 'CREATE OR REPLACE FUNCTION public.resolve_public_publication_prerequisites_v1(p_experience_id uuid, p_manifest_version_id uuid)\n'
        + '  RETURNS TABLE(clearance text, clearance_basis text)\n'
        + "  LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$\n"
        + "  BEGIN RETURN QUERY SELECT CASE WHEN g.publication_cleared THEN 'CLEARED' ELSE 'NOT_CLEARED' END::text,\n"
        + "                            'CW2-08 Launch Gate v1'::text FROM public.public_launch_gate_state g WHERE g.singleton; END$fn$;\n"
        + 'GRANT EXECUTE ON FUNCTION public.publish_public_experience_v1(uuid, uuid, uuid) TO service_role;\n'
        + 'ALTER TABLE public.public_experience_publication_state ADD COLUMN reviewed_by_launch_gate boolean;\n'
        + 'ALTER TABLE public.public_experience_vitality_state ADD COLUMN reaction_count integer;\n'
        + 'CREATE INDEX public_discussion_posts_posted_idx ON public.public_discussion_posts (posted_at);\n'
        + 'CREATE TABLE public.public_experience_spatial_placement (\n'
        + '  experience_version_id uuid PRIMARY KEY REFERENCES public.public_experience_versions (id), x real NOT NULL, y real NOT NULL);\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0098.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/public-world-absence-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      patch(mirror, CI, GROUP_STEP,
        '      - {name: Verify a later I-05C slice, run: npm run verify:public-world-absence:integration}\n' + GROUP_STEP);
      const { ok, output } = runInMirror(mirror);
      assert.ok(ok,
        'a later reviewed absence record and writer, a real CW2-08 gate replacing the seam, a launch-gated grant, '
        + 'additive columns, an index, a spatial placement model and a new CI gate must all leave I-05B passing:\n'
        + output.slice(-2500));
    } finally {
      removeHarnessMirror(mirror);
    }
  });

test('the contracts are not vacuous: every deliberate weakening of I-05B is refused by at least one of them',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const regressions = [
      ['the publish boundary stops refusing a non-effective approval', M95,
        "  IF EXISTS (SELECT 1 FROM public.derive_publication_manifest_effective_approvals_v1(manifest.id) s\n              WHERE s.effective_state <> 'EFFECTIVE') THEN\n    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_APPROVAL_NOT_EFFECTIVE' USING ERRCODE='55000';\n  END IF;\n", ''],
      ['the prerequisite seam answers CLEARED without a canonical gate', M95,
        "RETURN QUERY SELECT 'NOT_EVALUATED'::text,", "RETURN QUERY SELECT 'CLEARED'::text,"],
      ['the prerequisite seam stops being the last gate', M95,
        "  -- GATE 10: THE READY SNAPSHOT IS NOT TRUSTED. Its recorded fingerprint must\n",
        "  SELECT c.clearance, c.clearance_basis INTO clearance_state, clearance_reason\n    FROM public.resolve_public_publication_prerequisites_v1(p_experience_id, manifest.id) c;\n  -- GATE 10: THE READY SNAPSHOT IS NOT TRUSTED. Its recorded fingerprint must\n"],
      ['canonical visibility stops requiring PUBLISHED', M95, "     AND e.current_lifecycle = 'PUBLISHED'\n", ''],
      ['canonical visibility stops requiring a consistent version pointer', M95,
        '     AND e.current_experience_version_id = s.published_experience_version_id\n', ''],
      ['the serving resolver reads sealed provenance', M95,
        '    JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id\n   WHERE vs.visibility_state',
        '    JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id\n    JOIN public.publication_package_item_provenance pv ON pv.package_item_id = it.package_item_id\n   WHERE vs.visibility_state'],
      ['publication opens to authenticated before any Launch Gate', M95,
        "    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);",
        "    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);"],
      ['publication stops proving the publisher may still SEE the Shared source', M95,
        '         SELECT 1 FROM public.resolve_shared_world_history_visibility_v1(p.shared_world_id, u) v\n          WHERE v.history_item_id = p.shared_history_item_id)',
        '         SELECT 1 FROM public.shared_world_history_items v\n          WHERE v.id = p.shared_history_item_id)'],
      ['the publication record becomes mutable', M95,
        'CREATE TRIGGER public_experience_publication_state_immutable', 'CREATE TRIGGER public_experience_publication_state_later'],
      ['withdrawal stops requiring the exact rightsholder', M94,
        '  IF NOT FOUND OR approval.approver_user_id <> u THEN', '  IF NOT FOUND THEN'],
      ['the effective-state derivation forgets the withdrawal events', M94,
        '    LEFT JOIN public.publication_approval_withdrawal_events w ON w.approval_id = a.id\n',
        '    LEFT JOIN public.publication_approval_withdrawal_events w ON false\n'],
      ['a withdrawal for a human the evidence never named becomes representable', M94,
        '    CONSTRAINT publication_approval_withdrawal_events_approval_fk\n        FOREIGN KEY (approval_id, manifest_version_id, approver_user_id)\n        REFERENCES public.publication_manifest_approvals (id, manifest_version_id, approver_user_id)\n        ON DELETE RESTRICT\n',
        ''],
      ['the withdrawal binding weakens back into two independent foreign keys', M94,
        '    CONSTRAINT publication_approval_withdrawal_events_approval_fk\n        FOREIGN KEY (approval_id, manifest_version_id, approver_user_id)\n        REFERENCES public.publication_manifest_approvals (id, manifest_version_id, approver_user_id)\n        ON DELETE RESTRICT\n',
        '    CONSTRAINT publication_approval_withdrawal_events_approval_fk\n        FOREIGN KEY (approval_id) REFERENCES public.publication_manifest_approvals (id) ON DELETE RESTRICT,\n'
        + '    CONSTRAINT publication_approval_withdrawal_events_approver_fk\n        FOREIGN KEY (manifest_version_id, approver_user_id)\n'
        + '        REFERENCES public.publication_manifest_approvals (manifest_version_id, approver_user_id)\n        ON DELETE RESTRICT\n'],
      ['the publication record binds version and manifest through two independent foreign keys', M95,
        '    CONSTRAINT public_experience_publication_state_version_fk\n        FOREIGN KEY (published_experience_version_id, experience_id, published_manifest_version_id)\n        REFERENCES public.public_experience_versions (id, experience_id, package_manifest_version_id)\n        ON DELETE RESTRICT\n',
        '    CONSTRAINT public_experience_publication_state_version_fk\n        FOREIGN KEY (published_experience_version_id, experience_id)\n        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,\n'
        + '    CONSTRAINT public_experience_publication_state_manifest_fk\n        FOREIGN KEY (published_manifest_version_id, experience_id)\n'
        + '        REFERENCES public.public_experience_versions (package_manifest_version_id, experience_id)\n        ON DELETE RESTRICT\n'],
      ['the discussion resolver serves a superseded version\'s posts as the visible version\'s', M96,
        '    JOIN public.public_discussion_posts dp ON dp.experience_id = vs.experience_id\n     AND dp.target_experience_version_id = vs.visible_experience_version_id\n',
        '    JOIN public.public_discussion_posts dp ON dp.experience_id = vs.experience_id\n'],
      ['Public QANDEEL consumes a superseded version\'s post as the visible version\'s', M96,
        '                        WHERE dp.id = x AND dp.experience_id = p_experience_id\n                          AND dp.target_experience_version_id = visible_version)) THEN',
        '                        WHERE dp.id = x AND dp.experience_id = p_experience_id)) THEN'],
      ['vitality counts a superseded version\'s activity as the visible version\'s', M97,
        '   WHERE dp.experience_id = p_experience_id AND dp.target_experience_version_id = visible_version;\n',
        '   WHERE dp.experience_id = p_experience_id;\n'],
      ['0094 rewrites the historical approval evidence', M94,
        'INSERT INTO public.publication_approval_withdrawal_commands\n    (id, approval_id, manifest_version_id, actor_user_id, request_ref, committed_at)\n  VALUES (p_command_id, p_approval_id, approval.manifest_version_id, u, request, instant);\n\n  RETURN QUERY SELECT \'WITHDRAWN\'::text',
        "UPDATE public.publication_manifest_approvals SET approved_at = instant WHERE id = p_approval_id;\n  INSERT INTO public.publication_approval_withdrawal_commands\n    (id, approval_id, manifest_version_id, actor_user_id, request_ref, committed_at)\n  VALUES (p_command_id, p_approval_id, approval.manifest_version_id, u, request, instant);\n\n  RETURN QUERY SELECT 'WITHDRAWN'::text"],
      ['discussion stops resolving its target through the admission gate', M96,
        "    JOIN public.resolve_public_audience_admission_v1(u) ad ON ad.admission = 'ADMITTED'\n",
        "    CROSS JOIN (SELECT 'ADMITTED'::text AS admission) ad\n"],
      ['Public QANDEEL output derives a human', M96,
        'DECLARE\n  committed public.public_qandeel_response_commands;', 'DECLARE\n  u uuid := auth.uid();\n  committed public.public_qandeel_response_commands;'],
      ['a correction rewrites a placement instead of appending one', M96,
        'CREATE TRIGGER public_experience_semantic_placements_immutable', 'CREATE TRIGGER public_experience_semantic_placements_later'],
      ['a placement detaches from the exact version', M96,
        '    CONSTRAINT public_experience_semantic_placements_version_fk\n        FOREIGN KEY (experience_version_id, experience_id)\n        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,\n',
        ''],
      ['a projection outlives visibility', M97,
        '    DELETE FROM public.public_experience_search_projection pr WHERE pr.experience_id = p_experience_id;\n', ''],
      ['search serves a stale projection', M97,
        "    JOIN public.public_experience_search_projection pr ON pr.search_document @@ query_lexemes\n    JOIN LATERAL public.resolve_public_visibility_state_v1(pr.experience_id) vs\n      ON vs.visibility_state = 'PUBLICLY_VISIBLE'\n     AND vs.visible_experience_version_id = pr.experience_version_id\n",
        "    JOIN public.public_experience_search_projection pr ON pr.search_document @@ query_lexemes\n    JOIN LATERAL public.resolve_public_visibility_state_v1(pr.experience_id) vs\n      ON vs.visibility_state = 'PUBLICLY_VISIBLE'\n"],
      ['a derived-state writer opens to service_role', M97,
        "      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);\n    END IF;\n  END LOOP;\n  FOREACH fn IN ARRAY resolvers LOOP",
        "      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);\n    END IF;\n  END LOOP;\n  FOREACH fn IN ARRAY resolvers LOOP"],
      ['a frozen predecessor migration is edited',
        'database/migrations/0093_public_experience_review_ready_runtime_v1.sql', 'BEGIN;', 'BEGIN;\n-- edited\n'],
      ['the CI step that runs an I-05B verifier is removed', CI,
        `if npm run ${OWN_SCRIPT}; then result_0097=PASS; else status=1; fi`, 'if npm run test:toolchain; then result_0097=PASS; else status=1; fi'],
      ['the grouped I-05B CI step stops failing the job when a verifier fails', CI, '\n          exit "$status"\n', '\n          exit 0\n'],
      ['a failing I-05B verifier is swallowed instead of recorded', CI,
        'if npm run verify:public-publication-effective-approval-state:integration; then result_0094=PASS; else status=1; fi',
        'npm run verify:public-publication-effective-approval-state:integration || true'],
      ['the seam simulation is no longer restored', SUPPORT, '    await q(seam.definition);\n', "    await q('SELECT 1');\n"],
      ['the concurrency harness loses its database-enforced wait bound', SUPPORT, `      await run("SET lock_timeout = '10s'");\n`, ''],
      ['a publish race awaits before releasing the other connection', V95,
        "    await q('COMMIT');\n    const [wA] = (await withdrawing).rows;", "    const [wA] = (await withdrawing).rows;\n    await q('COMMIT');"],
    ];
    for (const [reason, file, from, to] of regressions) {
      const fresh = buildMirror();
      try {
        patch(fresh, file, from, to);
        const { ok, output } = runInMirror(fresh);
        assert.equal(ok, false,
          `a repository where ${reason} must break at least one I-05B contract; all four passed:\n${output.slice(-1500)}`);
      } finally {
        removeHarnessMirror(fresh);
      }
    }
  });
