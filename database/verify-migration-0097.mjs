// Real-PostgreSQL verifier for migration 0097 - I-05B Public Vitality and
// Search / Lens / Panel Projections v1 (PART D).
//
// Runs against a FULLY migrated database and proves, from live catalogs and
// live execution:
//
//   catalog / posture
//     * the two derived-state writers are machine state - no auth.uid(),
//       executable by nobody, bounded by the ONE visibility truth, confined to
//       their own family; the four resolvers are service_role-only, consume both
//       gates, require the stored row to describe the VISIBLE version, and
//       disclose no private identity.
//
//   vitality
//     * VT01 recompute is deterministic: same inputs, UNCHANGED; new public
//       activity, RECOMPUTED with the next revision and exact counts;
//     * VT02 a DRAFT and a nonexistent target write nothing;
//     * VT03 a stored vitality row for a non-visible Experience is never served -
//       vitality cannot make an invisible object visible.
//
//   projections
//     * PJ01 rebuild is deterministic and bounded to the public derivative and
//       the current interpretation; search, lens and panel serve admitted
//       viewers only; a correction re-projects on the next rebuild;
//     * PJ02 a stale projection row for a non-visible Experience is never
//       served and is cleared on rebuild;
//     * PJ03 a moved version pointer turns every projection dark at once;
//     * PJ04 the search document contains only public words.
//
//   concurrency (committed fixtures, committed seam simulation restored)
//     * C01 projection rebuild versus the visibility transition serializes and
//       projects the published version;
//     * C02 two concurrent rebuilds converge on ONE identical row.
//
//   forward safety inside a rolled-back SAVEPOINT, then every regression to
//   something 0097 OWNS planted and still refused; and zero fixture residue.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, NONE, SEAM, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, count, actAs, asRole, rejected } = rt;

const RECOMPUTE = 'public.recompute_public_experience_vitality_v1(uuid)';
const REBUILD = 'public.rebuild_public_experience_projection_v1(uuid)';
const RESOLVERS = [
  'public.resolve_public_experience_vitality_v1(uuid, uuid)',
  'public.search_public_experiences_v1(uuid, text)',
  'public.resolve_public_lens_v1(uuid, text)',
  'public.resolve_public_panel_v1(uuid, uuid)',
];
const OWN_TABLES = [T.VITALITY, T.PROJECTION];

async function verifyCatalog() {
  await rt.verifyPosture({
    internal: [RECOMPUTE, REBUILD],
    mutating: [RECOMPUTE, REBUILD],
    resolvers: RESOLVERS,
    tables: OWN_TABLES,
  });
  for (const fn of [RECOMPUTE, REBUILD]) {
    const p = await rt.functionPosture(fn);
    assert.ok(!p.prosrc.includes('auth.uid()'), `${fn} is machine state and derives no human`);
    assert.ok(p.prosrc.includes('resolve_public_visibility_state_v1') && p.prosrc.includes("visibility_state = 'PUBLICLY_VISIBLE'"),
      `${fn} is bounded by the canonical visibility truth`);
    assert.ok(p.prosrc.includes('FROM public.public_experiences e WHERE e.id = p_experience_id FOR SHARE'),
      `${fn} holds the Experience row FOR SHARE while it derives`);
    assert.ok(!p.prosrc.includes('SET current_lifecycle') && !p.prosrc.includes('to_lifecycle') && !p.prosrc.includes('ABSENT_FROM_PUBLIC_WORLD'),
      `${fn} can move no lifecycle`);
    assert.doesNotMatch(p.prosrc,
      /(INSERT INTO|UPDATE|DELETE FROM) public\.(public_experiences|public_experience_versions|public_experience_lifecycle_events|public_experience_publication_state|public_experience_controllers|public_experience_semantic_placements|public_discussion_posts|public_qandeel_responses|publication_package|publication_manifest|publication_approval|shared_world|conversation_|users|public_identities|public_identity_display_state)/u,
      `${fn} writes only its own derived family`);
    assert.ok(!p.prosrc.includes('publication_package_item_provenance') && !p.prosrc.includes('shared_world') && !p.prosrc.includes('conversation_unit'),
      `${fn} reads no sealed provenance and no source`);
    for (const name of await rt.inputParameters(fn)) {
      assert.doesNotMatch(name, /approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|count|revision|heat|rank|document|label|lens/u,
        `${fn} may not accept a derived value: ${name}`);
    }
  }
  const rebuild = await rt.functionPosture(REBUILD);
  assert.ok(rebuild.prosrc.includes('DELETE FROM public.public_experience_search_projection pr WHERE pr.experience_id = p_experience_id'),
    'a projection of a non-visible Experience is cleared on rebuild');
  assert.ok(rebuild.prosrc.includes('public_experience_text_derivative_bodies') && rebuild.prosrc.includes('derive_public_experience_current_placement_v1'),
    'the search document is built from the public derivative bodies and the current interpretation only');
  const recompute = await rt.functionPosture(RECOMPUTE);
  assert.ok(recompute.prosrc.includes('NOT_PUBLICLY_VISIBLE'), 'a recompute of a non-visible Experience writes nothing');
  // Exact-version vitality (REV-03): computed FOR the visible version, it counts
  // only the activity bound TO that version - never a superseded version's.
  assert.ok(recompute.prosrc.includes('dp.experience_id = p_experience_id AND dp.target_experience_version_id = visible_version')
    && recompute.prosrc.includes('r.experience_id = p_experience_id AND r.experience_version_id = visible_version'),
  'vitality computed for a version counts only the activity bound to that version');
  for (const fn of [RESOLVERS[1], RESOLVERS[2]]) {
    assert.ok((await rt.functionPosture(fn)).prosrc.includes('vs.visible_experience_version_id = pr.experience_version_id'),
      `${fn} serves a projection only while it describes the currently visible version`);
  }
  assert.ok((await rt.functionPosture(RESOLVERS[0])).prosrc.includes('st.experience_version_id = vs.visible_experience_version_id'),
    'vitality is served only for the version it was computed for');
  const fks = await rows(
    `SELECT c.conrelid::regclass::text child, c.conname, ns.nspname || '.' || cl.relname AS parent, c.confdeltype
       FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.confrelid JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      WHERE c.contype = 'f' AND c.conrelid = ANY($1::regclass[])`, [OWN_TABLES]);
  assert.equal(fks.length, 2, 'each derived relation binds exactly the version it was derived for');
  for (const fk of fks) {
    assert.equal(fk.parent, 'public.public_experience_versions', `${fk.conname} binds a version`);
    assert.equal(fk.confdeltype, 'r');
  }
  for (const table of OWN_TABLES) {
    const columns = (await rows(
      'SELECT a.attname FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped', [table])).map((r) => r.attname);
    for (const column of columns) {
      assert.doesNotMatch(column, /safety|moderation|launch|entitlement|premium|feature_flag|allow|approv|control|consent|user_id|author|session|turn|conversation_unit|world_id|shared_|material_id|history_item|email|phone|contact|credential|source_|display_label/u,
        `${table} carries no ${column}`);
    }
  }
  const [{ n: gin }] = await rows(
    `SELECT count(*) n FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'public_experience_search_projection'
        AND indexdef ~ 'USING gin \\(search_document\\)'`);
  assert.equal(Number(gin), 1, 'the search document is GIN-indexed');
}

async function verifyVitality(f, x) {
  // VT01 deterministic recompute.
  const [first] = await rt.recomputeVitality(f.experience);
  assert.equal(first.outcome, 'VITALITY_RECOMPUTED');
  assert.equal(Number(first.vitality_revision), 1);
  assert.equal(Number(first.discussion_post_count), 2);
  assert.equal(Number(first.qandeel_response_count), 1);
  assert.equal(first.experience_version_id, f.version);
  const [{ latest }] = await rows(
    `SELECT greatest((SELECT max(posted_at) FROM ${T.POSTS} WHERE experience_id = $1),
                     (SELECT max(produced_at) FROM ${T.RESPONSES} WHERE experience_id = $1)) latest`, [f.experience]);
  assert.equal(first.latest_public_activity_at.getTime(), latest.getTime(), 'VT01 the latest public activity is exact');
  const [again] = await rt.recomputeVitality(f.experience);
  assert.equal(again.outcome, 'VITALITY_UNCHANGED', 'VT01 the same inputs produce the same row');
  assert.equal(Number(again.vitality_revision), 1);
  await actAs(f.stranger);
  await rt.post(randomUUID(), randomUUID(), f.experience, null, 'more activity');
  const [third] = await rt.recomputeVitality(f.experience);
  assert.equal(third.outcome, 'VITALITY_RECOMPUTED');
  assert.equal(Number(third.vitality_revision), 2);
  assert.equal(Number(third.discussion_post_count), 3);
  // VT02 non-visible targets write nothing, and answer ONE outcome.
  const [onDraft] = await rt.recomputeVitality(x.draft);
  const [onNothing] = await rt.recomputeVitality(randomUUID());
  assert.equal(onDraft.outcome, 'NOT_PUBLICLY_VISIBLE');
  assert.equal(onNothing.outcome, 'NOT_PUBLICLY_VISIBLE');
  assert.equal(await count(T.VITALITY, 'experience_id = $1', [x.draft]), 0, 'VT02 nothing written for a DRAFT');
  await rejected(() => rt.recomputeVitality(null), ['22023']);
  // VT03 reads are gated; a planted row for an invisible Experience is not served.
  const [served] = await rt.resolveVitality(f.experience, f.reader);
  assert.equal(Number(served.discussion_post_count), 3);
  assert.equal(Number(served.qandeel_response_count), 1);
  assert.deepEqual(await rt.resolveVitality(f.experience, null), [], 'signed-out reads nothing');
  assert.deepEqual(await rt.resolveVitality(randomUUID(), f.reader), []);
  await q(`INSERT INTO ${T.VITALITY} (experience_id, experience_version_id, vitality_revision, discussion_post_count,
             qandeel_response_count, latest_public_activity_at, computed_at) VALUES ($1, $2, 1, 999, 999, now(), now())`, [x.draft, x.dv]);
  assert.deepEqual(await rt.resolveVitality(x.draft, f.reader), [], 'VT03 vitality cannot make an invisible Experience visible');
  assert.deepEqual(await rt.panel(x.draft, f.reader), []);

  // VT04 EXACT-VERSION VITALITY UNDER A SUCCESSOR VISIBLE VERSION. Three V1 posts
  // and one V1 response exist, written by the real writers. The visible truth
  // moves to a valid successor V2 (a verifier-only simulation; successor
  // publication semantics belong to a later slice): the vitality computed for
  // V1 is not served as V2's, a recompute FOR V2 counts none of V1's activity,
  // and only V2's own activity moves it.
  await q('SAVEPOINT successor');
  try {
    const { successorVersion } = await rt.simulateSuccessorVersion(f.experience, f.manifest);
    assert.deepEqual(await rt.resolveVitality(f.experience, f.reader), [], 'VT04 the vitality computed for V1 is not served as V2\'s');
    assert.deepEqual((await rt.panel(f.experience, f.reader)).map((r) => [r.experience_version_id, Number(r.discussion_post_count)]), [[successorVersion, 0]],
      'VT04 the panel names the successor with zero vitality, never V1\'s numbers');
    const [forV2] = await rt.recomputeVitality(f.experience);
    assert.equal(forV2.outcome, 'VITALITY_RECOMPUTED');
    assert.equal(forV2.experience_version_id, successorVersion, 'VT04 vitality is computed for the visible successor');
    assert.equal(Number(forV2.discussion_post_count), 0, 'VT04 V2 vitality counts no V1 post');
    assert.equal(Number(forV2.qandeel_response_count), 0, 'VT04 V2 vitality counts no V1 response');
    assert.equal(forV2.latest_public_activity_at, null, 'VT04 no V2 activity exists yet');
    assert.equal(await count(T.POSTS, 'experience_id = $1 AND target_experience_version_id = $2', [f.experience, f.version]), 3, 'VT04 V1 history is intact');
    await actAs(f.stranger);
    await rt.post(randomUUID(), randomUUID(), f.experience, null, 'the first word on the successor');
    const [moved] = await rt.recomputeVitality(f.experience);
    assert.equal(moved.outcome, 'VITALITY_RECOMPUTED');
    assert.equal(Number(moved.discussion_post_count), 1, 'VT04 only V2 activity moves V2 vitality');
    assert.equal(Number(moved.qandeel_response_count), 0);
    const [servedV2] = await rt.resolveVitality(f.experience, f.reader);
    assert.equal(servedV2.experience_version_id, successorVersion);
    assert.equal(Number(servedV2.discussion_post_count), 1, 'VT04 the served vitality is the successor\'s own');
  } finally {
    await q('ROLLBACK TO SAVEPOINT successor'); await q('RELEASE SAVEPOINT successor');
  }
  const [backToV1] = await rt.resolveVitality(f.experience, f.reader);
  assert.equal(Number(backToV1.discussion_post_count), 3, 'the simulation rolled back: V1 vitality is served again');
}

async function verifyProjections(f, x) {
  // PJ01 deterministic rebuild bounded to the public derivative + interpretation.
  const [built] = await rt.rebuildProjection(f.experience);
  assert.equal(built.outcome, 'PROJECTION_REBUILT');
  assert.equal(Number(built.projection_revision), 1);
  assert.equal(built.experience_version_id, f.version);
  const [row] = await rows(`SELECT * FROM ${T.PROJECTION} WHERE experience_id = $1`, [f.experience]);
  assert.equal(row.lens_key, 'lens.alpha');
  assert.equal(row.semantic_label, 'Orientation of a shared sentence');
  assert.equal(Number(row.placement_revision), 1);
  const [unchanged] = await rt.rebuildProjection(f.experience);
  assert.equal(unchanged.outcome, 'PROJECTION_UNCHANGED', 'PJ01 the same canonical rows produce the same projection');
  assert.equal(Number(unchanged.projection_revision), 1);
  // PJ04 the document contains only public words: package bodies and the label.
  const [{ lexemes }] = await rows(`SELECT array_to_string(tsvector_to_array(search_document), ' ') lexemes FROM ${T.PROJECTION} WHERE experience_id = $1`, [f.experience]);
  assert.ok(lexemes.includes('hadir') && lexemes.includes('committed') && lexemes.includes('orientation'), 'PJ04 public bodies and the label are indexed');
  assert.ok(!lexemes.includes('never'), 'PJ04 material outside the package is not indexed');
  // Search / lens / panel for admitted viewers only.
  const hits = await rt.search(f.reader, 'Hadir wrote');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].experience_id, f.experience);
  assert.ok(Number(hits[0].search_rank) > 0);
  assert.equal(hits[0].publisher_public_identity_ref, f.mohamedRef);
  assert.equal(hits[0].publisher_display_label, 'the publisher');
  for (const column of Object.keys(hits[0])) assert.doesNotMatch(column, /user_id|shared_|world_id|material_id|provenance|digest|fingerprint/u);
  assert.deepEqual(await rt.search(null, 'Hadir wrote'), [], 'PJ01 signed-out searches nothing');
  assert.deepEqual(await rt.search(f.reader, 'zyxwvut'), []);
  await rejected(() => rt.search(f.reader, '   '), ['22023']);
  const byLens = await rt.lens(f.reader, 'lens.alpha');
  assert.deepEqual(byLens.map((r) => r.experience_id), [f.experience]);
  assert.deepEqual(await rt.lens(f.reader, 'lens.other'), []);
  assert.deepEqual(await rt.lens(null, 'lens.alpha'), []);
  await rejected(() => rt.lens(f.reader, 'Bad Lens'), ['22023']);
  const [panel] = await rt.panel(f.experience, f.reader);
  assert.equal(panel.lens_key, 'lens.alpha');
  assert.equal(Number(panel.discussion_post_count), 3, 'the panel carries the recomputed vitality');
  assert.equal(Number(panel.qandeel_response_count), 1);
  assert.equal(Number(panel.version_ordinal), 1);
  assert.equal(panel.publisher_display_label, 'the publisher');
  assert.deepEqual(await rt.panel(f.experience, null), []);
  assert.deepEqual(await rt.panel(randomUUID(), f.reader), []);
  // A correction re-projects on the next rebuild; the old lens goes dark.
  await actAs(f.mohamed);
  await rt.recordPlacement(randomUUID(), randomUUID(), f.experience, f.version, 'lens.beta', 'Reconsidered orientation');
  assert.deepEqual((await rt.lens(f.reader, 'lens.alpha')).map((r) => r.experience_id), [f.experience],
    'before the rebuild the projection still describes the old interpretation, which the visible version still permits');
  const [rebuilt] = await rt.rebuildProjection(f.experience);
  assert.equal(rebuilt.outcome, 'PROJECTION_REBUILT');
  assert.equal(Number(rebuilt.projection_revision), 2);
  assert.deepEqual(await rt.lens(f.reader, 'lens.alpha'), [], 'the old lens no longer lists it');
  assert.deepEqual((await rt.lens(f.reader, 'lens.beta')).map((r) => r.experience_id), [f.experience]);
  assert.equal((await rt.search(f.reader, 'Reconsidered'))[0].experience_id, f.experience);
  assert.equal((await rt.panel(f.experience, f.reader))[0].semantic_label, 'Reconsidered orientation');

  // PJ02 a stale projection for a non-visible Experience is never served and is cleared.
  assert.equal((await rt.rebuildProjection(x.draft))[0].outcome, 'PROJECTION_ABSENT');
  await q(`INSERT INTO ${T.PROJECTION} (experience_id, experience_version_id, placement_revision, lens_key, semantic_label,
             search_document, projection_revision, projected_at)
           VALUES ($1, $2, NULL, NULL, NULL, to_tsvector('pg_catalog.simple', 'planted draft words'), 1, now())`, [x.draft, x.dv]);
  assert.deepEqual(await rt.search(f.reader, 'planted'), [], 'PJ02 a planted projection of a DRAFT is not served');
  assert.deepEqual(await rt.panel(x.draft, f.reader), []);
  assert.equal((await rt.rebuildProjection(x.draft))[0].outcome, 'PROJECTION_CLEARED', 'PJ02 and it is cleared on rebuild');
  assert.equal(await count(T.PROJECTION, 'experience_id = $1', [x.draft]), 0);
  assert.equal((await rt.rebuildProjection(randomUUID()))[0].outcome, 'PROJECTION_ABSENT');
  await rejected(() => rt.rebuildProjection(null), ['22023']);

  // PJ03 a moved version pointer turns every projection dark at once.
  await q('SAVEPOINT pointer');
  const ghost = randomUUID(); const ghostVersion = randomUUID();
  await q(`INSERT INTO ${T.MANIFESTS} (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
             intended_publication_action, target_audience_class, authority_readiness, prepared_authority_snapshot_version, item_count, created_at)
           SELECT $1, experience_id, true, publisher_public_identity_ref, publisher_user_id, intended_publication_action,
                  target_audience_class, authority_readiness, prepared_authority_snapshot_version, item_count, now()
             FROM ${T.MANIFESTS} WHERE id = $2`, [ghost, f.manifest]);
  await q(`INSERT INTO ${T.VERSIONS} (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
           VALUES ($1, $2, $3, 2, now())`, [ghostVersion, f.experience, ghost]);
  await q(`UPDATE ${T.EXPERIENCES} SET current_experience_version_id = $2 WHERE id = $1`, [f.experience, ghostVersion]);
  assert.deepEqual(await rt.search(f.reader, 'Reconsidered'), [], 'PJ03 search is dark');
  assert.deepEqual(await rt.lens(f.reader, 'lens.beta'), [], 'PJ03 the lens is dark');
  assert.deepEqual(await rt.panel(f.experience, f.reader), [], 'PJ03 the panel is dark');
  assert.deepEqual(await rt.resolveVitality(f.experience, f.reader), [], 'PJ03 vitality is dark');
  assert.equal((await rt.rebuildProjection(f.experience))[0].outcome, 'PROJECTION_CLEARED');
  assert.equal((await rt.recomputeVitality(f.experience))[0].outcome, 'NOT_PUBLICLY_VISIBLE');
  await q('ROLLBACK TO SAVEPOINT pointer'); await q('RELEASE SAVEPOINT pointer');
  assert.equal((await rt.lens(f.reader, 'lens.beta')).length, 1, 'and it is back once the pointer is');

  // Roles: service_role executes the four resolvers; nobody executes the writers; tables sealed.
  for (const role of APP_ROLES) {
    await q('SAVEPOINT v');
    await asRole(role, f.reader);
    if (role === 'service_role') {
      assert.equal((await rt.search(f.reader, 'Reconsidered')).length, 1);
      assert.equal((await rt.lens(f.reader, 'lens.beta')).length, 1);
      assert.equal((await rt.panel(f.experience, f.reader)).length, 1);
      assert.equal((await rt.resolveVitality(f.experience, f.reader)).length, 1);
    } else {
      for (const call of [() => rt.search(f.reader, 'x'), () => rt.lens(f.reader, 'lens.beta'), () => rt.panel(f.experience, f.reader),
        () => rt.resolveVitality(f.experience, f.reader)]) await rejected(call, ['42501']);
    }
    await rejected(() => rt.rebuildProjection(f.experience), ['42501']);
    await rejected(() => rt.recomputeVitality(f.experience), ['42501']);
    for (const table of OWN_TABLES) await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), ['42501']);
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT v'); await q('RELEASE SAVEPOINT v');
  }
}

async function verifyForwardSafety(f) {
  await q('SAVEPOINT forward_safety');
  try {
    await q(`CREATE TABLE public.i05b97_probe_recommendations (experience_id uuid PRIMARY KEY REFERENCES ${T.EXPERIENCES} (id), score real NOT NULL)`);
    await q(`CREATE FUNCTION public.i05b97_probe_absence_v1(p_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN UPDATE public.public_experiences e
                      SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD' WHERE e.id = p_id; END$fn$`);
    await q(`ALTER TABLE ${T.VITALITY} ADD COLUMN i05b97_probe_reaction_count integer`);
    await q(`CREATE INDEX i05b97_probe_idx ON ${T.PROJECTION} (projected_at)`);
    await verifyCatalog();
    // A later non-serving lifecycle: every projection dark, history intact,
    // and the next rebuild clears the projection without touching any post.
    const postsBefore = await count(T.POSTS, 'experience_id = $1', [f.experience]);
    await q('SELECT public.i05b97_probe_absence_v1($1)', [f.experience]);
    assert.deepEqual(await rt.search(f.reader, 'Reconsidered'), []);
    assert.deepEqual(await rt.panel(f.experience, f.reader), []);
    assert.equal((await rt.rebuildProjection(f.experience))[0].outcome, 'PROJECTION_CLEARED');
    assert.equal(await count(T.POSTS, 'experience_id = $1', [f.experience]), postsBefore, 'no historical presence row was rewritten');

    const refuses = { name: 'AssertionError' };
    await q('SAVEPOINT r1');
    await q(`GRANT EXECUTE ON FUNCTION ${REBUILD} TO service_role`);
    await assert.rejects(verifyCatalog(), refuses, 'a derived-state writer becoming reachable is a regression');
    await q('ROLLBACK TO SAVEPOINT r1');
    await q('SAVEPOINT r2');
    await q(`GRANT EXECUTE ON FUNCTION ${RESOLVERS[1]} TO anon`);
    await assert.rejects(verifyCatalog(), refuses, 'search opening to anon is a regression');
    await q('ROLLBACK TO SAVEPOINT r2');
    await q('SAVEPOINT r3');
    await q(`ALTER TABLE ${T.PROJECTION} DISABLE ROW LEVEL SECURITY`);
    await assert.rejects(verifyCatalog(), refuses, 'a projection losing RLS is a regression');
    await q('ROLLBACK TO SAVEPOINT r3');
    await q('SAVEPOINT r4');
    // A rebuild that keeps a projection alive after visibility ends. Same signature.
    await q(`CREATE OR REPLACE FUNCTION public.rebuild_public_experience_projection_v1(p_experience_id uuid)
             RETURNS TABLE(outcome text, experience_id uuid, experience_version_id uuid, projection_revision bigint)
             LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $fn$
             BEGIN PERFORM 1 FROM public.public_experiences e WHERE e.id = p_experience_id FOR SHARE;
                   PERFORM 1 FROM public.resolve_public_visibility_state_v1(p_experience_id) vs WHERE vs.visibility_state = 'PUBLICLY_VISIBLE';
                   PERFORM 1 FROM public.public_experience_text_derivative_bodies b; PERFORM 1 FROM public.derive_public_experience_current_placement_v1(NULL);
                   RETURN; END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'a rebuild that lets a projection outlive visibility is a regression');
    await q('ROLLBACK TO SAVEPOINT r4');
    await q('SAVEPOINT r5');
    await q(`ALTER TABLE ${T.PROJECTION} ADD COLUMN source_world_id uuid`);
    await assert.rejects(verifyCatalog(), refuses, 'a source identifier entering a projection is a regression');
    await q('ROLLBACK TO SAVEPOINT r5');
    await q('SAVEPOINT r6');
    // A recompute that counts every version's activity as the visible version's:
    // the Experience-wide policy REV-03 refuses to choose silently. Same signature.
    await q(`CREATE OR REPLACE FUNCTION public.recompute_public_experience_vitality_v1(p_experience_id uuid)
             RETURNS TABLE(outcome text, experience_id uuid, experience_version_id uuid, vitality_revision bigint,
                           discussion_post_count integer, qandeel_response_count integer, latest_public_activity_at timestamptz)
             LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $fn$
             BEGIN PERFORM 1 FROM public.public_experiences e WHERE e.id = p_experience_id FOR SHARE;
                   PERFORM 1 FROM public.resolve_public_visibility_state_v1(p_experience_id) vs WHERE vs.visibility_state = 'PUBLICLY_VISIBLE';
                   PERFORM count(*) FROM public.public_discussion_posts dp WHERE dp.experience_id = p_experience_id;
                   PERFORM count(*) FROM public.public_qandeel_responses r WHERE r.experience_id = p_experience_id;
                   RETURN QUERY SELECT 'NOT_PUBLICLY_VISIBLE'::text, p_experience_id, NULL::uuid, NULL::bigint,
                                       NULL::integer, NULL::integer, NULL::timestamptz; END$fn$`);
    await assert.rejects(verifyCatalog(), refuses, 'a vitality recompute that counts a superseded version\'s activity as the visible version\'s is a regression');
    await q('ROLLBACK TO SAVEPOINT r6');
  } finally {
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
  }
}

async function verifyConcurrency(c, seam) {
  const { q2, close } = await rt.openSecondary();
  try {
    await asRole('postgres');
    const ready = await rt.bringToReady(c, { experience: c.experience, manifest: c.manifest, version: c.version, personal: false });
    await asRole('postgres');
    await rt.clearPrerequisites();

    // C01 REBUILD VERSUS THE VISIBILITY TRANSITION: the rebuild blocks on the
    // Experience row the publication holds and projects the published version.
    console.log('0097 concurrency C01 start');
    assert.equal((await rt.rebuildProjection(ready.experience))[0].outcome, 'PROJECTION_ABSENT', 'C01 nothing projected before publication');
    await q('BEGIN');
    await actAs(c.mohamed);
    const [published] = await rt.publish(randomUUID(), ready.experience, ready.version);
    assert.equal(published.outcome, 'PUBLISHED');
    await q2('BEGIN');
    const rebuilding = q2('SELECT * FROM public.rebuild_public_experience_projection_v1($1)', [ready.experience]);
    assert.equal(await rt.stillPending(rebuilding), true, 'C01 the rebuild blocks behind the publication');
    await q('COMMIT');
    const [rebuilt] = (await rebuilding).rows;
    await q2('COMMIT');
    assert.equal(rebuilt.outcome, 'PROJECTION_REBUILT', 'C01 the rebuild saw the committed publication');
    assert.equal(rebuilt.experience_version_id, ready.version);
    console.log('0097 concurrency C01 pass');

    // C02 TWO CONCURRENT REBUILDS converge on ONE identical row.
    console.log('0097 concurrency C02 start');
    await q('BEGIN');
    const [firstRebuild] = await rt.rebuildProjection(ready.experience);
    assert.equal(firstRebuild.outcome, 'PROJECTION_UNCHANGED');
    await q2('BEGIN');
    const second = q2('SELECT * FROM public.rebuild_public_experience_projection_v1($1)', [ready.experience]);
    await new Promise((resolve) => { setTimeout(resolve, 300); });
    await q('COMMIT');
    const [secondRebuild] = (await second).rows;
    await q2('COMMIT');
    assert.equal(secondRebuild.outcome, 'PROJECTION_UNCHANGED', 'C02 a concurrent rebuild converges on the same row');
    assert.equal(Number(secondRebuild.projection_revision), 1);
    assert.equal(await count(T.PROJECTION, 'experience_id = $1', [ready.experience]), 1);
    console.log('0097 concurrency C02 pass');
  } finally {
    await close();
    await asRole('postgres');
    await rt.restorePrerequisites(seam);
    console.log('0097 concurrency seam restored');
  }
}

await runVerifier('0097', async (stage) => {
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
    await rt.bringToReady(f, { experience: f.experience, manifest: f.manifest, version: f.version });
    const [published] = await rt.publishCleared(seam, f.mohamed, randomUUID(), f.experience, f.version);
    assert.equal(published.outcome, 'PUBLISHED');
    await actAs(f.mohamed);
    await rt.recordPlacement(randomUUID(), randomUUID(), f.experience, f.version, 'lens.alpha', 'Orientation of a shared sentence');
    await actAs(f.hadir);
    const post1 = randomUUID();
    await rt.post(randomUUID(), post1, f.experience, null, 'a first public thought');
    await actAs(f.stranger);
    await rt.post(randomUUID(), randomUUID(), f.experience, null, 'a second one');
    await actAs(null);
    await rt.recordResponse(randomUUID(), randomUUID(), f.experience, post1, 'QANDEEL responds', [post1]);
    await actAs(f.mohamed);
    const draft = randomUUID(); const dm = randomUUID(); const dv = randomUUID();
    await rt.createDraft(randomUUID(), draft);
    await rt.prepare(randomUUID(), draft, dm, dv, [randomUUID()], [f.userUnit], NONE, NONE, NONE);
    const x = { draft, dv };
    stage('vitality');
    await verifyVitality(f, x);
    stage('projections');
    await verifyProjections(f, x);
    stage('forward safety');
    await asRole('postgres');
    await verifyForwardSafety(f);
  } finally {
    await q('ROLLBACK');
  }
  assert.equal((await rt.functionPosture(SEAM)).prosrc, seam.prosrc, 'the production seam is intact after the rolled-back section');

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
  const humans = [f.mohamed, f.hadir, f.stranger, f.reader, c.mohamed, c.hadir, c.stranger, c.reader];
  const [{ n }] = await rows(
    `SELECT (SELECT count(*) FROM ${T.IDENTITIES} WHERE user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${T.PROJECTION} WHERE experience_id = ANY($2::uuid[]))
          + (SELECT count(*) FROM ${T.VITALITY} WHERE experience_id = ANY($2::uuid[]))
          + (SELECT count(*) FROM ${T.EXPERIENCES} WHERE id = ANY($2::uuid[]))
          + (SELECT count(*) FROM public.shared_worlds WHERE id = ANY($3::uuid[]))
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
          + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
    [humans, [f.experience, c.experience], [f.world, c.world]]);
  assert.equal(Number(n), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
