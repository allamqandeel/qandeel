// I-05B - Public Semantic Placement, Discussion and Public QANDEEL v1: the
// secret-free structural contract for migration 0096.
//
// Live semantics are proven by database/verify-migration-0096.mjs against real
// PostgreSQL. What is proven HERE is the structure a migration must already have
// before it deploys: interpretation bound to the exact immutable version with
// additive, auditable corrections that touch nothing else; discussion authority
// that is neither control nor rights nor approval and resolves its target through
// the canonical visibility truth; Public QANDEEL output that derives no human,
// creates no consent, and fingerprints public-domain identities only.
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

const MIGRATION_NAME = '0096_public_semantic_placement_discussion_qandeel_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0096.mjs');
const support = read('../public-runtime-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);

const OWN_TABLES = ['public_experience_semantic_placements', 'public_experience_semantic_placement_commands',
  'public_discussion_posts', 'public_discussion_post_commands', 'public_qandeel_responses', 'public_qandeel_response_commands'];
const PLACEMENT = 'record_public_experience_semantic_placement_v1';
const CURRENT = 'derive_public_experience_current_placement_v1';
const POST = 'post_public_discussion_v1';
const RESPONSE = 'record_public_qandeel_response_v1';
const RESOLVERS = ['resolve_public_experience_semantic_placement_v1', 'resolve_public_discussion_v1', 'resolve_public_qandeel_responses_v1'];
const OWN_SCRIPT = 'verify:public-semantic-placement-discussion-qandeel:integration';

const functionBody = (name) => {
  const start = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `migration 0096 creates ${name}`);
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
const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration 0096 creates ${name}`);
  return executableSql.slice(start, executableSql.indexOf('\n);', start));
};
const columnNames = (name) => tableBlock(name).split('\n')
  .filter((line) => /^ {4}\w+\s+\S/u.test(line) && !/^ {4}CONSTRAINT\b/u.test(line)).map((line) => line.trim().split(/\s+/u)[0]);

// ---------------------------------------------------------------------------

test('0096 is the forward migration after 0095, and every frozen predecessor it consumes is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0096_')).length, 1, 'exactly one migration carries the 0096 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0095_public_experience_publication_visibility_serving_v1.sql'));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of FROZEN_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu);
  const foreign = (executableSql.match(/^ALTER TABLE\s+public\.(\w+)/gmu) ?? []).filter((s) => !OWN_TABLES.some((t) => s.endsWith(`public.${t}`)));
  assert.deepEqual(foreign, [], 'the only tables 0096 alters are the six it created');
});

test('semantic interpretation binds the exact immutable version, and a correction is an additive revision that touches nothing else', () => {
  const placements = tableBlock('public_experience_semantic_placements');
  assert.match(placements, /CONSTRAINT public_experience_semantic_placements_version_fk\s*\n\s*FOREIGN KEY \(experience_version_id, experience_id\)\s*\n\s*REFERENCES public\.public_experience_versions \(id, experience_id\) ON DELETE RESTRICT/u,
    'bound to the exact version of the exact Experience, never to an Experience or a package alone');
  assert.match(placements, /UNIQUE \(experience_version_id, placement_revision\)/u, 'deterministic revisions within one version');
  assert.match(placements, /CHECK \(\(placement_revision = 1\) = \(placement_basis = 'INITIAL_INTERPRETATION'\)\)/u,
    'the first revision is the initial interpretation and every later one is a correction, in both directions');
  assert.match(placements, /CHECK \(placement_basis IN \('INITIAL_INTERPRETATION', 'PUBLISHER_CORRECTION'\)\)/u);
  for (const column of columnNames('public_experience_semantic_placements')) {
    assert.doesNotMatch(column, /coordinate|embedding|vector|ranking|score|approv|consent|source_|world_id|shared_|material_id/u,
      `a placement invents no geometry and carries no authority: ${column}`);
  }
  assert.match(executableSql, /CREATE TRIGGER public_experience_semantic_placements_immutable\s*\n\s*BEFORE UPDATE OR DELETE ON public\.public_experience_semantic_placements/u,
    'a correction never rewrites a revision');
  const { header, body } = functionBody(PLACEMENT);
  assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path=''/u);
  assert.match(body, /u uuid := auth\.uid\(\);/u);
  assert.deepEqual(inputParameters(PLACEMENT), ['p_command_id', 'p_placement_id', 'p_experience_id', 'p_experience_version_id', 'p_lens_key', 'p_semantic_label'],
    'no revision, basis, author or authority parameter');
  assert.match(body, /SELECT \* INTO experience FROM public\.public_experiences e WHERE e\.id = p_experience_id FOR UPDATE;\s*\n\s*IF NOT FOUND THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED'/u,
    'a nonexistent Experience and a non-controller receive ONE class');
  assert.match(body, /SELECT \* INTO controller FROM public\.public_experience_controllers c\s*\n\s*WHERE c\.experience_id = p_experience_id AND c\.controller_user_id = u;/u);
  assert.match(body, /IF experience\.current_lifecycle NOT IN \('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED'\) THEN/u,
    'interpretation is recorded for a living Experience only, by a positive list');
  assert.match(body, /WHERE v\.id = p_experience_version_id AND v\.experience_id = p_experience_id\) THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE'/u,
    'the version must belong to the exact Experience');
  assert.match(body, /SELECT coalesce\(max\(sp\.placement_revision\), 0\) \+ 1 INTO next_revision/u, 'the next revision, never a rewrite');
  assert.match(body, /basis := CASE WHEN next_revision = 1 THEN 'INITIAL_INTERPRETATION' ELSE 'PUBLISHER_CORRECTION' END;/u, 'the basis is derived');
  assert.doesNotMatch(body, /(INSERT INTO|UPDATE|DELETE FROM) public\.(public_experiences|public_experience_versions|public_experience_lifecycle_events|public_experience_publication_state|public_experience_controllers|publication_package|publication_manifest|publication_approval|shared_world|conversation_|users|public_identities|public_identity_display_state)/u,
    'a correction changes source content, authority, consent and provenance NOT AT ALL');
  assert.ok(!body.includes('publication_manifest_approvals') && !body.includes('SET current_lifecycle'), 'interpretation is not consent and moves no lifecycle');
  const current = functionBody(CURRENT);
  assert.match(current.header, /SECURITY DEFINER STABLE SET search_path=''/u);
  assert.match(current.body, /ORDER BY sp\.placement_revision DESC\s*\n\s*LIMIT 1;/u, 'the current interpretation is the highest revision');
  assert.match(current.body, /IF p_experience_version_id IS NULL THEN\s*\n\s*RETURN;/u, 'zero rows for NULL, so resolvers can join it laterally');
});

test('discussion authority is its own authority: the author\'s own identity, a visible target through the canonical truth, no control and no approval', () => {
  const posts = tableBlock('public_discussion_posts');
  assert.match(posts, /CONSTRAINT public_discussion_posts_target_fk\s*\n\s*FOREIGN KEY \(target_experience_version_id, experience_id\)\s*\n\s*REFERENCES public\.public_experience_versions \(id, experience_id\)/u,
    'a post binds the exact version that was visible when it was made');
  assert.match(posts, /CONSTRAINT public_discussion_posts_parent_fk\s*\n\s*FOREIGN KEY \(parent_post_id, experience_id\)\s*\n\s*REFERENCES public\.public_discussion_posts \(id, experience_id\)/u,
    'a reply binds a parent of the SAME Experience, structurally');
  assert.match(posts, /UNIQUE \(experience_id, post_ordinal\)/u, 'deterministic per-Experience order');
  assert.match(posts, /FOREIGN KEY \(author_public_identity_ref, author_user_id\)\s*\n\s*REFERENCES public\.public_identities \(public_identity_ref, user_id\)/u);
  for (const column of columnNames('public_discussion_posts')) {
    assert.doesNotMatch(column, /approv|control|consent|publish|safety|launch|moderation/u, `a post carries no authority column: ${column}`);
  }
  const { header, body } = functionBody(POST);
  assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path=''/u);
  assert.deepEqual(inputParameters(POST), ['p_command_id', 'p_post_id', 'p_experience_id', 'p_parent_post_id', 'p_post_body'],
    'no author, identity, ordinal or target-version parameter');
  assert.match(body, /SELECT \* INTO identity FROM public\.public_identities i WHERE i\.user_id = u;\s*\n\s*IF NOT FOUND THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED'/u,
    'the author is the caller\'s own Public Identity, resolved before any target is read');
  assert.match(body, /PERFORM 1 FROM public\.public_experiences e WHERE e\.id = p_experience_id FOR UPDATE;/u, 'the Experience row is held while the visibility answer is used');
  assert.match(body, /FROM public\.resolve_public_visibility_state_v1\(p_experience_id\) vs\s*\n\s*JOIN public\.resolve_public_audience_admission_v1\(u\) ad ON ad\.admission = 'ADMITTED'\s*\n\s*WHERE vs\.visibility_state = 'PUBLICLY_VISIBLE';\s*\n\s*IF NOT FOUND OR visible_version IS NULL THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE' USING ERRCODE='P0002'/u,
    'the target resolves through the canonical visibility truth and the admission gate, and refuses with ONE bounded class');
  assert.equal((body.match(/RAISE EXCEPTION 'PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE' USING ERRCODE='P0002'/gu) ?? []).length, 2,
    'an invisible target and a missing parent share the class');
  assert.match(body, /VALUES \(p_post_id, p_experience_id, visible_version, p_parent_post_id, next_ordinal,\s*\n\s*identity\.public_identity_ref, u, p_post_body, instant\);/u,
    'the post binds the visible version and the resolved identity');
  // REV-03: exact-version closure. A reply targets a post of the CURRENTLY VISIBLE
  // version, never merely a post of the same Experience: successor-version discussion
  // semantics are not decided here, and no Experience-wide policy is chosen silently.
  assert.match(body, /WHERE dp\.id = p_parent_post_id AND dp\.experience_id = p_experience_id\s*\n\s*AND dp\.target_experience_version_id = visible_version\) THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE'/u,
    'a reply targets a post of the currently visible version, with the same bounded class for a superseded-version parent');
  for (const forbidden of ['public_experience_controllers', 'publication_manifest_approvals', 'publication_manifest_required_approvers',
    'current_lifecycle', 'shared_world_membership_episodes', 'publication_package_item_provenance']) {
    assert.ok(!body.includes(forbidden), `discussion reads no ${forbidden}`);
  }
  assert.doesNotMatch(body, /(INSERT INTO|UPDATE|DELETE FROM) public\.(public_experiences|public_experience_controllers|publication_manifest|public_identities)/u);
  assert.equal((body.match(/WHERE c\.id = p_command_id/gu) ?? []).length, 2, 'idempotency before any lock and under it');
});

test('Public QANDEEL output is machine state: no human, no consent, a visible target, a public-domain context fingerprint', () => {
  const responses = tableBlock('public_qandeel_responses');
  assert.match(responses, /CHECK \(producer_kind = 'PUBLIC_QANDEEL'\)/u);
  for (const column of columnNames('public_qandeel_responses')) {
    assert.doesNotMatch(column, /user_id|author|approv|control|consent|identity|source_|world_id|shared_|material_id/u,
      `machine output carries no human, no authority and no source: ${column}`);
  }
  assert.match(responses, /CONSTRAINT public_qandeel_responses_reply_fk\s*\n\s*FOREIGN KEY \(in_reply_to_post_id, experience_id\)\s*\n\s*REFERENCES public\.public_discussion_posts \(id, experience_id\)/u);
  assert.match(responses, /CHECK \(context_fingerprint ~ '\^sha256:\[0-9a-f\]\{64\}\$'\)/u);
  const { header, body } = functionBody(RESPONSE);
  assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path=''/u);
  assert.ok(!body.includes('auth.uid()'), 'the producer derives no human - machine state is not human authority');
  assert.deepEqual(inputParameters(RESPONSE), ['p_command_id', 'p_response_id', 'p_experience_id', 'p_in_reply_to_post_id', 'p_response_body', 'p_consumed_post_ids']);
  assert.match(body, /FROM public\.resolve_public_visibility_state_v1\(p_experience_id\) vs\s*\n\s*WHERE vs\.visibility_state = 'PUBLICLY_VISIBLE';\s*\n\s*IF NOT FOUND OR visible_version IS NULL THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE' USING ERRCODE='P0002'/u);
  assert.equal((body.match(/RAISE EXCEPTION 'PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE' USING ERRCODE='P0002'/gu) ?? []).length, 3,
    'invisible target, foreign reply target and foreign consumed post share ONE class');
  // REV-03: the reply target and every consumed post belong to the CURRENTLY VISIBLE
  // version, never merely to the same Experience.
  assert.match(body, /WHERE dp\.id = p_in_reply_to_post_id AND dp\.experience_id = p_experience_id\s*\n\s*AND dp\.target_experience_version_id = visible_version\) THEN/u,
    'Public QANDEEL replies only to a post of the currently visible version');
  assert.match(body, /WHERE dp\.id = x AND dp\.experience_id = p_experience_id\s*\n\s*AND dp\.target_experience_version_id = visible_version\)\) THEN/u,
    'Public QANDEEL consumes only posts of the currently visible version');
  assert.match(body, /'QANDEEL_CWV2_PUBLIC_QANDEEL_CONTEXT_V1' \|\| E'\\n'\s*\n\s*\|\| 'experience=' \|\| lower\(p_experience_id::text\) \|\| E'\\n'\s*\n\s*\|\| 'experienceVersion=' \|\| lower\(visible_version::text\) \|\| E'\\n'\s*\n\s*\|\| 'manifest=' \|\| lower\(visible_manifest::text\) \|\| E'\\n'\s*\n\s*\|\| 'placementRevision=' \|\| coalesce\(current_placement::text, 'NONE'\) \|\| E'\\n'\s*\n\s*\|\| 'replyTo=' \|\| coalesce\(lower\(p_in_reply_to_post_id::text\), ''\) \|\| E'\\n'\s*\n\s*\|\| 'consumed=' \|\| consumed_scope/u,
    'the context fingerprint binds the Experience, version, manifest, placement revision, reply target and consumed posts - public-domain identities only');
  for (const forbidden of ['publication_package_item_provenance', 'shared_world', 'conversation_unit', 'public_experience_controllers', 'publication_manifest_approvals']) {
    assert.ok(!body.includes(forbidden), `the producer reads no ${forbidden}`);
  }
  assert.doesNotMatch(body, /(INSERT INTO|UPDATE|DELETE FROM) public\.(public_experiences|public_experience_controllers|publication_manifest|publication_approval)/u,
    'machine output creates no consent and no control');
});

test('the three resolvers compose both canonical gates, disclose no private identity, and are the only application-reachable functions', () => {
  for (const name of RESOLVERS) {
    const { header, body } = functionBody(name);
    assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''/u);
    assert.match(body, /FROM public\.resolve_public_visibility_state_v1\(p_experience_id\) vs\s*\n\s*JOIN public\.resolve_public_audience_admission_v1\(p_viewer_user_id\) ad ON ad\.admission = 'ADMITTED'/u,
      `${name} consumes the canonical visibility state and the admission gate`);
    assert.match(body, /WHERE vs\.visibility_state = 'PUBLICLY_VISIBLE'/u);
    assert.ok(!body.includes('publication_package_item_provenance') && !body.includes('current_lifecycle'), `${name} reads no provenance and tests no lifecycle`);
    for (const column of resultColumns(name)) {
      assert.doesNotMatch(column, /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material_id|history_item|availability|context_ref|world_id|provenance|digest|fingerprint/u,
        `${name} must not return ${column}`);
    }
  }
  assert.ok(!resultColumns('resolve_public_qandeel_responses_v1').includes('context_fingerprint'), 'the runtime-integrity fingerprint is not served');
  // REV-03: the two conversation resolvers serve rows bound to the CURRENTLY VISIBLE
  // version only. A post or response made against an earlier version is that
  // version's history, never silently served as the current version's.
  assert.match(functionBody('resolve_public_discussion_v1').body,
    /JOIN public\.public_discussion_posts dp ON dp\.experience_id = vs\.experience_id\s*\n\s*AND dp\.target_experience_version_id = vs\.visible_experience_version_id/u,
    'discussion is served for the visible version only');
  assert.match(functionBody('resolve_public_qandeel_responses_v1').body,
    /JOIN public\.public_qandeel_responses r ON r\.experience_id = vs\.experience_id\s*\n\s*AND r\.experience_version_id = vs\.visible_experience_version_id/u,
    'Public QANDEEL responses are served for the visible version only');
  const grants = [...executableSql.matchAll(/GRANT EXECUTE ON FUNCTION ([^\n']+)/gu)].map((m) => m[1].trim());
  assert.deepEqual(grants, ['%s TO service_role'], 'the ONE grant statement is the resolvers loop, to service_role');
  assert.match(executableSql, /FOREACH fn IN ARRAY resolvers LOOP\s*\n\s*EXECUTE format\('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn\);\s*\n\s*IF EXISTS\(SELECT 1 FROM pg_roles WHERE rolname='service_role'\) THEN\s*\n\s*EXECUTE format\('GRANT EXECUTE ON FUNCTION %s TO service_role', fn\);/u);
  for (const name of [CURRENT, PLACEMENT, POST, RESPONSE, 'reject_public_semantic_presence_mutation_v1', ...RESOLVERS]) {
    assert.ok(executableSql.includes(`'public.${name}(`), `${name} is named in the security posture`);
  }
  for (const table of OWN_TABLES) assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'u'));
});

test('the self-assertions refuse to deploy a migration that lost any of this', () => {
  for (const phrase of [
    'before the frozen CW2-08 Launch Gate exists',
    'consequential primitive % must be VOLATILE',
    'must hold the exact Experience row while it decides',
    'must not be able to write a lifecycle',
    'must write only its own presence family',
    'must read no Shared membership and no sealed provenance',
    'owns no disappearance lifecycle',
    'may not accept an authority audience visibility ordinal revision or instant parameter',
    'semantic placement requires the exact Experience controller from auth.uid()',
    'a correction must be the next additive revision of the exact version, never a rewrite',
    'semantic placement reads no approval: interpretation is not consent',
    'a discussion post binds the author',
    'a discussion target must resolve through the canonical visibility truth and the admission gate, and refuse with one bounded class',
    'discussion authority is not control, not rights, not approval, and tests no lifecycle for itself',
    'Public QANDEEL output derives no human: machine state is not human authority',
    'a Public QANDEEL target must resolve through the canonical visibility truth and refuse with one bounded class',
    'the Public QANDEEL context fingerprint binds public-domain identities only and never a source',
    'Public QANDEEL output creates no control and satisfies no approval',
    'a reply must target a post of the currently visible version, never merely a post of the same Experience',
    'Public QANDEEL output must reply to and consume posts of the currently visible version only',
    'the discussion resolver must serve only posts bound to the currently visible version',
    'the Public QANDEEL resolver must serve only responses bound to the currently visible version',
    'must consume the canonical visibility state and the audience admission gate',
    'must read no sealed provenance, test no lifecycle for itself and write nothing',
    'must disclose no private identity and no sealed provenance',
    'semantic placement must bind the exact version by restrictive composite foreign key with deterministic revisions',
    'a discussion post must bind the exact visible version and a reply must bind a parent of the same Experience',
    'Public QANDEEL output must carry no human author, account, approver or consent column',
    'must reach no control, no approval and no sealed provenance',
    'must be append-only for every role',
    'the canonical visibility derivation must stay internal',
  ]) {
    assert.ok(selfAssertions.includes(phrase), `the migration refuses itself when: ${phrase}`);
  }
  assert.ok(!selfAssertions.includes('count(*) = '), 'no self-assertion caps how many objects may exist');
});

test('0096 is registered in the toolchain, in the I-05B CI group, and in the database README', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0096\\.mjs"`, 'u'));
  assert.match(readme, /0096_public_semantic_placement_discussion_qandeel_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`));
  assert.match(verifier, /verifier for migration 0096/iu);
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0096=PASS; else status=1; fi`));
  // Scoped to the I-05B step's OWN body: a later slice's grouped step ends the
  // same way, and a whole-file check would be satisfied by that one instead.
  const i05bStep = workflow.slice(workflow.indexOf('- name: Verify the four I-05B Public World runtime verifiers'));
  assert.ok(i05bStep.slice(0, i05bStep.indexOf('\n      - ')).includes('exit "$status"'),
    'the grouped I-05B step still fails the job when any of the four verifiers failed');
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu);
});

test('the verifier proves immutability of everything a correction must not touch, the fingerprint byte for byte, and the races', () => {
  for (const needle of ['snapshotImmutables', 'SP01', 'SP02', 'SP03', 'SP04', 'SP05', 'DS01', 'DS02', 'DS03', 'DS04', 'DS05', 'DS06', 'DS07',
    'QR01', 'QR02', 'QR03', 'QR04', 'QR05', 'C01', 'C02', 'QANDEEL_CWV2_PUBLIC_QANDEEL_CONTEXT_V1', 'placementRevision=2',
    'PUBLIC_DISCUSSION_TARGET_NOT_AVAILABLE', 'PUBLIC_QANDEEL_TARGET_NOT_AVAILABLE', 'SAVEPOINT forward_safety', 'i05b96_probe_absence_v1',
    'publishCleared', 'restorePrerequisites',
    // REV-03: real V1 conversation, then a valid successor V2 becomes the visible truth
    // (verifier-only simulation): V1 rows are not served, replied to or consumed as
    // V2's, V2 conversation through the same writers is, and the resolver mutant that
    // serves every version's posts is refused by the catalog program.
    'simulateSuccessorVersion', 'SAVEPOINT successor', 'a reply across versions', 'placementRevision=NONE',
    'a discussion resolver that serves a superseded version']) {
    assert.ok(verifier.includes(needle), `the verifier proves ${needle}`);
  }
  // The successor simulation is named as such, is the caller's transaction to roll back,
  // and puts the publication record's guard back before it returns.
  assert.match(support, /VERIFIER-ONLY SIMULATION of a later reviewed successor publication/u);
  assert.match(support, /async function simulateSuccessorVersion\(experience, manifest\)/u);
  assert.match(support, /DISABLE TRIGGER public_experience_publication_state_immutable[\s\S]*?ENABLE TRIGGER public_experience_publication_state_immutable/u,
    'the guard lifted for the simulation is restored inside it');
  assert.ok(!support.includes('INSERT INTO public.public_experience_publication_state'), 'the simulation fabricates no publication record');
  assert.match(verifier, /\}, \(\) => rt\.client\.end\(\)\.catch\(\(\) => undefined\)\);\s*$/u,
    'the verifier ends its database client through the envelope on every path, so a failure exits instead of hanging the CI step');
  assert.match(verifier, /await actAs\(f\.mohamed\);\s*\n\s*await rejected\(\(\) => rt\.publish\(randomUUID\(\), x\.draft, x\.dv\), \['55000'\], \/LIFECYCLE_INVALID\/u\);/u,
    'QR03 attempts the publication AS the controller, so the refusal it proves is the lifecycle one');
  assert.match(verifier, /assert\.deepEqual\(await snapshotImmutables\(f\.experience, f\.manifest\), before,\s*\n\s*'SP01 a correction changed no version/u);
  for (const launched of ['placing', 'posting']) {
    const launch = verifier.indexOf(`const ${launched} = q2(`);
    assert.ok(launch > 0, `${launched} is LAUNCHED rather than awaited inline`);
    const release = verifier.indexOf("await q('COMMIT')", launch);
    const settle = verifier.indexOf(`await ${launched}`, launch);
    assert.ok(release > launch && settle > release, `${launched} is awaited only after the other connection committed`);
  }
});
