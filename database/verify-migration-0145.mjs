// S5-03B — Public Semantic Field + Stable Spatial Placement + Viewer Runtime v1: the real-PostgreSQL verifier for 0145.
//
// It proves, against a fully migrated database:
//   1. the boundary: every S5-03B function is a pinned `public_spatial_private` SECURITY DEFINER or a pinned `public`
//      INVOKER wrapper; `authenticated` executes exactly the owner and viewer commands, the server channel exactly the
//      placer input and the commit, anon nothing; no owner or viewer command accepts a coordinate, a region, a rank, a
//      neighbour, a model, a readiness, an account or a lifecycle (the field takes only a bounded world rectangle); the two
//      relations are private, RLS-enabled, append-only, hold no semantic or package text and reference no account
//      directly, but bind the version and the S5-03A revision ON DELETE RESTRICT (QAN-BL-ACCT-01); only the commit writes
//      a coordinate, anywhere;
//   2. stable placement: no semantic readiness → no placement; only the exact controller requests; the placer's whole
//      input is the reviewed S5-03A meaning, themes, region and revision identity — never package text, a Public ID, a
//      display label or an account; a client can supply no coordinate; a malformed answer is refused; the placement binds
//      the exact version AND the exact revision; a retry or a different layout model reads the committed coordinates back
//      and moves nothing; history is append-only; a correction makes the old placement stale (kept, never moved, never
//      served) and the new revision receives its own; a request for a superseded revision is STALE;
//   3. the viewer: Draft and READY_FOR_REVIEW are invisible (even placed); only PUBLICLY_VISIBLE + an admitted viewer;
//      the actual S5-03A meaning and region are served and the 0096 private constants never are; search stays inside the
//      same visible field; the panel serves the current display, the published instant, the exact-version vitality and
//      the canonical public content; nearby is bounded and visible-only; a guessed id, a stale placement and an
//      unadmitted viewer are the same neutral absence; an alias change and a vitality recompute move nothing;
//   4. disappearance: a withdrawn approval, an ASSURE-F05 owner deletion and a successor version each make the Experience
//      absent from the field, search, panel, content and nearby at once, with no write of S5-03B's own; the erasure also
//      makes spatial readiness fail closed;
//   5. launch closure: the seam still answers NOT_EVALUATED; no S5-03B path publishes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, NONE, SEAM, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, actAs, asRole, rejected } = rt;
const own = async (text, values = []) => { await asRole('postgres'); return rows(text, values); };
const admission = async (viewer) => { await asRole('postgres'); return rt.admission(viewer); };
const visibility = async (experience) => { await asRole('postgres'); return rt.visibility(experience); };

const SCHEMA = 'public_spatial_private';
const SEMANTIC = 'public_semantic_private';
const OWNER_COMMANDS = {
  read_own_public_spatial_preparation_v1: ['p_experience_id uuid'],
  request_own_public_spatial_placement_v1: ['p_command_id uuid', 'p_experience_id uuid'],
};
const VIEWER_COMMANDS = {
  read_public_semantic_field_v1: ['p_min_x bigint', 'p_min_y bigint', 'p_max_x bigint', 'p_max_y bigint'],
  search_public_semantic_field_v1: ['p_query text'],
  read_public_semantic_experience_v1: ['p_experience_id uuid'],
  read_public_semantic_experience_content_v1: ['p_experience_id uuid'],
  read_public_semantic_nearby_v1: ['p_experience_id uuid'],
};
const SERVER_COMMANDS = {
  read_public_spatial_placement_input_v1: ['p_request_id uuid'],
  commit_public_spatial_placement_v1: ['p_request_id uuid', 'p_layout_version text', 'p_world_x bigint', 'p_world_y bigint'],
};
const INTERNAL = ['reject_spatial_history_mutation_v1', 'derive_spatial_identity_v1', 'derive_reviewed_interpretation_v1',
  'derive_public_spatial_readiness_v1', 'request_admissibility_v1', 'derive_visible_spatial_entry_v1', 'admitted_viewer_v1',
  'field_candidates_v1'];
const RELATIONS = ['spatial_placements', 'spatial_requests'];
const PLACEHOLDERS = ['s5-03a.private', 'S5-03A_PRIVATE_SEMANTIC_INTERPRETATION_V1', 'S5-03A_PRIVATE'];
const WORLD = ['-4611686018427387904', '-4611686018427387904', '4611686018427387903', '4611686018427387903'];

// ---- the S5-02 path to READY_FOR_REVIEW and the S5-03A path to SEMANTICALLY_READY, as the human's own roles
const as = async (uid) => asRole('authenticated', uid);
const first = async (text, values) => (await rows(text, values))[0];
const startDraft = async (uid) => { await as(uid); return (await first('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()])).experience_id; };
const prepareOwn = async (uid, experience, units, worlds, materials) => {
  await as(uid);
  return (await first('SELECT * FROM public.prepare_own_public_experience_package_v1($1, $2, $3::uuid[], $4::uuid[], $5::uuid[])',
    [randomUUID(), experience, units, worlds, materials])).outcome;
};
const approveOwn = async (uid, manifest) => { await as(uid); return (await first('SELECT * FROM public.approve_own_public_package_v1($1, $2)', [randomUUID(), manifest])).outcome; };
const readyOwn = async (uid, experience) => { await as(uid); return (await first('SELECT * FROM public.commit_own_public_experience_ready_v1($1, $2)', [randomUUID(), experience])).outcome; };
const requestProposal = async (uid, experience) => { await as(uid); return first('SELECT * FROM public.request_own_public_semantic_proposal_v1($1, $2)', [randomUUID(), experience]); };
const requestCorrection = async (uid, experience, interpretation, meaning, primary, secondary) => {
  await as(uid);
  return first('SELECT * FROM public.request_own_public_semantic_correction_v1($1, $2, $3, $4, $5::text[], $6::text[])',
    [randomUUID(), experience, interpretation, meaning, primary, secondary]);
};
const commitWork = async (uid, work) => { await as(uid); return first('SELECT * FROM public.commit_own_public_semantic_work_v1($1)', [work]); };
const acceptSemantic = async (uid, experience, interpretation) => {
  await as(uid); return (await first('SELECT * FROM public.accept_own_public_semantic_proposal_v1($1, $2, $3)', [randomUUID(), experience, interpretation])).outcome;
};
const recordOutcome = async (work, outcome, lens, meaning, primary, secondary, explanation) => {
  await asRole('service_role');
  return (await first('SELECT * FROM public.record_public_semantic_work_outcome_v1($1, $2, $3, $4, $5::text[], $6::text[], $7)',
    [work, outcome, lens, meaning, primary, secondary, explanation])).outcome;
};

// ---- the S5-03B commands
const preparation = async (uid, experience) => { await as(uid); return rows('SELECT * FROM public.read_own_public_spatial_preparation_v1($1)', [experience]); };
const requestPlace = async (uid, command, experience) => {
  await as(uid); return first('SELECT * FROM public.request_own_public_spatial_placement_v1($1, $2)', [command, experience]);
};
const placerInput = async (request) => { await asRole('service_role'); return rows('SELECT * FROM public.read_public_spatial_placement_input_v1($1)', [request]); };
const commitPlace = async (request, layout, x, y) => {
  await asRole('service_role');
  return (await first('SELECT * FROM public.commit_public_spatial_placement_v1($1, $2, $3, $4)', [request, layout, x, y])).outcome;
};
const spatialReadiness = async (experience) => (await own(`SELECT * FROM ${SCHEMA}.derive_public_spatial_readiness_v1($1)`, [experience]))[0];
const placementsOf = async (experience) => own(`SELECT id, experience_version_id, interpretation_id, layout_version, coordinate_scheme, world_x::text x, world_y::text y
  FROM ${SCHEMA}.spatial_placements WHERE experience_id = $1 ORDER BY committed_at, id`, [experience]);
const field = async (uid, bounds = WORLD) => { await as(uid); return rows('SELECT * FROM public.read_public_semantic_field_v1($1, $2, $3, $4)', bounds); };
const searchField = async (uid, query) => { await as(uid); return rows('SELECT * FROM public.search_public_semantic_field_v1($1)', [query]); };
const panel = async (uid, experience) => { await as(uid); return rows('SELECT * FROM public.read_public_semantic_experience_v1($1)', [experience]); };
const contentOf = async (uid, experience) => { await as(uid); return rows('SELECT * FROM public.read_public_semantic_experience_content_v1($1)', [experience]); };
const nearby = async (uid, experience) => { await as(uid); return rows('SELECT * FROM public.read_public_semantic_nearby_v1($1)', [experience]); };
const ids = (list) => list.map((r) => r.experience_id).sort();

const MEANINGS = Object.freeze({
  e1: { lens: 'family.fear', meaning: 'Fear for a family while work feels uncertain', primary: ['fear', 'family'], secondary: ['work'],
    explanation: 'The words return to worry about the people who depend on the speaker.' },
  e2: { lens: 'courage.daily', meaning: 'Courage found in small daily choices', primary: ['courage'], secondary: [],
    explanation: 'The words describe choosing to continue each day.' },
  e4: { lens: 'hope.waiting', meaning: 'Hope after a long winter of waiting', primary: ['hope'], secondary: ['patience'],
    explanation: 'The words look forward after a hard season.' },
});

/** READY_FOR_REVIEW through the S5-02 Product path. */
async function readyExperience(f, withHadir) {
  const experience = await startDraft(f.mohamed);
  assert.equal(await prepareOwn(f.mohamed, experience, [f.userUnit], withHadir ? [f.world] : NONE, withHadir ? [f.hadirMaterial] : NONE), 'PREPARED');
  const [{ v, m }] = await own(`SELECT e.current_experience_version_id v, ve.package_manifest_version_id m FROM ${T.EXPERIENCES} e
    JOIN ${T.VERSIONS} ve ON ve.id = e.current_experience_version_id WHERE e.id = $1`, [experience]);
  assert.equal(await approveOwn(f.mohamed, m), 'APPROVED');
  if (withHadir) assert.equal(await approveOwn(f.hadir, m), 'APPROVED');
  assert.equal(await readyOwn(f.mohamed, experience), 'READY_FOR_REVIEW');
  return { experience, version: v, manifest: m };
}

/** SEMANTICALLY_READY through the S5-03A Product path: QANDEEL's proposal on the server channel, the human's commit and accept. */
async function semanticallyReady(f, experience, p) {
  const work = (await requestProposal(f.mohamed, experience)).work_id;
  assert.equal(await recordOutcome(work, 'PROPOSED', p.lens, p.meaning, p.primary, p.secondary, p.explanation), 'RECORDED');
  const committed = await commitWork(f.mohamed, work);
  assert.equal(committed.outcome, 'PROPOSED');
  assert.equal(await acceptSemantic(f.mohamed, experience, committed.interpretation_id), 'ACCEPTED');
  return committed.interpretation_id;
}

/** A CONSISTENT publisher correction: the next revision, reviewed by its making. */
async function corrected(f, experience, interpretation, meaning, primary, lens) {
  const work = (await requestCorrection(f.mohamed, experience, interpretation, meaning, primary, [])).work_id;
  assert.equal(await recordOutcome(work, 'CONSISTENT', lens, null, null, null, null), 'RECORDED');
  const committed = await commitWork(f.mohamed, work);
  assert.equal(committed.outcome, 'CORRECTED');
  return committed.interpretation_id;
}

/** Request, read the input, commit — the server's whole placement act. */
async function placed(f, experience, x, y, layout = 'test.layout.v1') {
  const opened = await requestPlace(f.mohamed, randomUUID(), experience);
  assert.equal(opened.outcome, 'REQUEST_OPEN');
  assert.equal((await placerInput(opened.request_id)).length, 1);
  assert.equal(await commitPlace(opened.request_id, layout, x, y), 'PLACED');
  return opened.request_id;
}

// --------------------------------------------------------------------------------------------------------- 1. boundary
async function verifyBoundary() {
  await asRole('postgres');
  const fns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(fns.map((f) => f.proname).sort(),
    [...Object.keys(OWNER_COMMANDS), ...Object.keys(VIEWER_COMMANDS), ...Object.keys(SERVER_COMMANDS), ...INTERNAL].sort(),
    'B01 the private schema holds exactly the S5-03B functions');
  for (const f of fns) {
    assert.equal(f.prosecdef, true, `B01 ${f.proname} is a definer`);
    assert.equal(f.owner, 'postgres');
    assert.deepEqual(f.proconfig, ['search_path=""'], `B01 ${f.proname} pins an empty search_path`);
  }
  const exposed = { ...OWNER_COMMANDS, ...VIEWER_COMMANDS, ...SERVER_COMMANDS };
  const wrappers = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [Object.keys(exposed)]);
  assert.equal(wrappers.length, Object.keys(exposed).length, 'B02 each exposed command has exactly one public wrapper');
  for (const w of wrappers) {
    assert.equal(w.prosecdef, false, `B02 public.${w.proname} is an INVOKER wrapper`);
    assert.deepEqual(w.proconfig, ['search_path=""']);
    assert.equal(w.args, exposed[w.proname].join(', '), `B03 public.${w.proname} accepts exactly its inputs`);
  }
  // B03 no owner or viewer command takes an authority claim or a placement control. The field's four bounds are a
  //     viewport request (navigation), checked exactly above; nothing else may name a place.
  for (const [name, inputs] of Object.entries({ ...OWNER_COMMANDS, ...VIEWER_COMMANDS })) {
    for (const parameter of inputs) {
      if (name === 'read_public_semantic_field_v1') continue;
      assert.doesNotMatch(parameter, /user|actor|identity|label|controller|authority|audience|visib|lifecycle|ready|readiness|fingerprint|version|lens|region|placement|coordinate|\bx\b|\by\b|rank|weight|popular|proxim|near|neighbo|distance|vector|embedding|model|layout/u,
        `B03 ${name} input ${parameter} is no authority claim and no placement control`);
    }
  }
  const executable = await rows(`SELECT r.rolname, n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT unnest($2::text[]) rolname) r
    WHERE EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
      AND (n.nspname = $3 OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`, [Object.keys(exposed), APP_ROLES, SCHEMA]);
  assert.deepEqual(executable.map((e) => `${e.rolname} ${e.fn}`).sort(), [
    ...[...Object.keys(OWNER_COMMANDS), ...Object.keys(VIEWER_COMMANDS)].flatMap((n) => [`authenticated public.${n}`, `authenticated ${SCHEMA}.${n}`]),
    ...Object.keys(SERVER_COMMANDS).flatMap((n) => [`service_role public.${n}`, `service_role ${SCHEMA}.${n}`]),
  ].sort(), 'B04 authenticated runs the owner and viewer commands, the server channel the placer input and the commit, anon nothing');
  const publicExec = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname = $2 OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')`,
  [Object.keys(exposed), SCHEMA]);
  assert.deepEqual(publicExec, [], 'B04 no S5-03B function keeps PUBLIC EXECUTE');
  // B05 the relations: two, private, RLS, no table privilege for any application role, no text beyond three names.
  const tables = await rows(`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm') ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(tables.map((t) => t.relname), RELATIONS, 'B05 exactly the two spatial relations');
  for (const t of tables) {
    assert.equal(t.relrowsecurity, true, `B05 ${t.relname} has RLS`);
    for (const role of APP_ROLES) {
      const [{ any }] = await rows(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT')
        OR has_table_privilege($1, $2, 'UPDATE') OR has_table_privilege($1, $2, 'DELETE') AS any`, [role, `${SCHEMA}.${t.relname}`]);
      assert.equal(any, false, `B05 ${role} holds no privilege on ${t.relname}`);
    }
  }
  const columns = await rows(`SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod) t FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped ORDER BY 1, a.attnum`, [SCHEMA]);
  assert.deepEqual(columns.filter((c) => !['uuid', 'bigint', 'timestamp with time zone'].includes(c.t)).map((c) => `${c.relname}.${c.attname}`),
    ['spatial_placements.spatial_contract', 'spatial_placements.layout_version', 'spatial_placements.coordinate_scheme'],
    'B05 no meaning, theme, lens, label or package text is copied into a spatial relation');
  const accountEdges = await rows(`SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = $1 AND c.contype = 'f'
      AND c.confrelid IN ('public.users'::regclass, 'auth.users'::regclass, 'public.public_identities'::regclass)`, [SCHEMA]);
  assert.deepEqual(accountEdges, [], 'B05 no spatial relation references an account or a Public identity directly');
  const restrictEdges = await rows(`SELECT t.relname, c.confrelid::regclass::text target, c.confdeltype FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = $1 AND c.contype = 'f' ORDER BY 1, 2`, [SCHEMA]);
  assert.deepEqual(restrictEdges.map((e) => `${e.relname} → ${e.target} ${e.confdeltype}`), [
    'spatial_placements → public_experience_versions r', 'spatial_placements → public_spatial_private.spatial_requests r',
    'spatial_placements → public_semantic_private.semantic_interpretations r',
    'spatial_requests → public_experience_versions r', 'spatial_requests → public_semantic_private.semantic_interpretations r',
  ].sort(), 'B05a both relations bind the Experience Version and the S5-03A revision ON DELETE RESTRICT (QAN-BL-ACCT-01)');
  // B06 ONE writer of a coordinate in the whole database: the commit. Popularity, vitality, discussion, an alias, a model
  //     upgrade — nothing else can move a committed place, because nothing else can write one.
  const writers = await rows(`SELECT n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prosrc ~* '(INSERT INTO|UPDATE|DELETE FROM)\\s+public_spatial_private\\.spatial_placements'
    ORDER BY 1`);
  assert.deepEqual(writers.map((w) => w.fn), [`${SCHEMA}.commit_public_spatial_placement_v1`], 'B06 only the commit writes a coordinate');
  // B07 nothing S5-03B owns reads the 0096 descriptor or the frozen descriptor readers.
  const bodies = await rows(`SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1`, [SCHEMA]);
  for (const b of bodies) {
    assert.doesNotMatch(b.prosrc, /semantic_label|s5-03a\.private|S5-03A_PRIVATE|resolve_public_experience_semantic_placement_v1|search_public_experiences_v1|resolve_public_lens_v1|resolve_public_panel_v1|public_experience_search_projection|publish_public_experience_v1|'PUBLISHED'/u,
      `B07 ${b.proname} reads no 0096 descriptor and no frozen descriptor reader, and publishes nothing`);
  }
  const [input] = await rows(`SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = $1 AND p.proname = 'read_public_spatial_placement_input_v1'`, [SCHEMA]);
  assert.doesNotMatch(input.prosrc, /public_identit|display_label|label_mode|vitality|discussion|published_at|text_derivative_bodies|auth\.uid/u,
    'B08 the placer input reads the reviewed meaning and nothing that identifies or ranks anyone');
  const seam = (await rt.functionPosture(SEAM)).prosrc;
  assert.ok(seam.includes('NOT_EVALUATED') && !seam.includes("'CLEARED'"), 'B09 the CW2-08 seam still answers NOT_EVALUATED');
}

// ------------------------------------------------------------------------------------------------------- fixture
async function fixture() {
  const f = rt.newFixture();
  await asRole('postgres');
  await rt.provision(f);
  f.draft = await startDraft(f.mohamed);
  f.e1 = await readyExperience(f, true);
  f.e2 = await readyExperience(f, false);
  f.e4 = await readyExperience(f, false);
  f.e5 = await readyExperience(f, true);
  f.packageTexts = (await own(`SELECT DISTINCT b.public_text_body t FROM ${T.ITEMS} it JOIN ${T.BODIES} b ON b.package_item_id = it.package_item_id
    WHERE it.manifest_version_id = $1`, [f.e1.manifest])).map((r) => r.t);
  [{ public_id: f.mohamedPublicId }] = await own('SELECT public_id FROM public.users WHERE id = $1', [f.mohamed]);
  [{ display_label: f.mohamedLabel }] = await own(`SELECT d.display_label FROM ${T.DISPLAY} d JOIN ${T.MANIFESTS} m
    ON m.publisher_public_identity_ref = d.public_identity_ref WHERE m.id = $1`, [f.e1.manifest]);
  assert.equal((await admission(f.reader))[0].admission, 'ADMITTED', 'fixture: the reader is an admitted registered viewer');
  return f;
}

// ------------------------------------------------------------------------------------------------ 2. stable placement
async function verifyPlacement(f) {
  // P01 no semantic readiness, no place: a Draft, and READY_FOR_REVIEW with no reviewed interpretation.
  for (const experience of [f.draft, f.e1.experience]) {
    assert.deepEqual((await preparation(f.mohamed, experience)).map((r) => r.preparation_state), ['NOT_SEMANTICALLY_READY'], 'P01');
    assert.deepEqual(await requestPlace(f.mohamed, randomUUID(), experience), { outcome: 'NOT_SEMANTICALLY_READY', request_id: null }, 'P01');
  }
  assert.deepEqual([(await spatialReadiness(f.e1.experience)).readiness, (await spatialReadiness(f.e1.experience)).reason],
    ['NOT_READY', 'NOT_SEMANTICALLY_READY'], 'P01 spatial readiness fails closed');
  // A proposal QANDEEL made but the publisher has not reviewed is not ready either.
  const work = (await requestProposal(f.mohamed, f.e1.experience)).work_id;
  const p1 = MEANINGS.e1;
  assert.equal(await recordOutcome(work, 'PROPOSED', p1.lens, p1.meaning, p1.primary, p1.secondary, p1.explanation), 'RECORDED');
  const committed = await commitWork(f.mohamed, work);
  assert.deepEqual(await requestPlace(f.mohamed, randomUUID(), f.e1.experience), { outcome: 'NOT_SEMANTICALLY_READY', request_id: null },
    'P01 an unreviewed proposal is no basis for a place');
  assert.equal(await acceptSemantic(f.mohamed, f.e1.experience, committed.interpretation_id), 'ACCEPTED');
  f.e1.interpretation = committed.interpretation_id;
  assert.equal(Number((await own(`SELECT count(*) n FROM ${SCHEMA}.spatial_requests`))[0].n) >= 0, true);

  // P02 nobody but the exact controller; a guessed id is the same answer; anon and a token-less caller are refused.
  for (const uid of [f.hadir, f.stranger, f.reader]) {
    assert.deepEqual(await preparation(uid, f.e1.experience), [], 'P02 no preparation state for a non-controller');
    assert.deepEqual(await requestPlace(uid, randomUUID(), f.e1.experience), { outcome: 'UNAVAILABLE', request_id: null }, 'P02');
  }
  assert.deepEqual(await requestPlace(f.mohamed, randomUUID(), randomUUID()), { outcome: 'UNAVAILABLE', request_id: null }, 'P02 guessed id');
  assert.deepEqual(await placementsOf(f.e1.experience), [], 'P02 and nothing was written');
  await asRole('anon');
  await rejected(() => q('SELECT * FROM public.request_own_public_spatial_placement_v1($1, $2)', [randomUUID(), f.e1.experience]), ['42501']);
  await rejected(() => q('SELECT * FROM public.read_public_semantic_field_v1($1, $2, $3, $4)', WORLD), ['42501']);

  // P03 semantically ready: NOT_PLACED; one request per revision; a retry is the same request.
  assert.deepEqual((await preparation(f.mohamed, f.e1.experience)).map((r) => r.preparation_state), ['NOT_PLACED'], 'P03');
  assert.deepEqual([(await spatialReadiness(f.e1.experience)).readiness, (await spatialReadiness(f.e1.experience)).reason], ['NOT_READY', 'NO_PLACEMENT'], 'P03');
  const command = randomUUID();
  const opened = await requestPlace(f.mohamed, command, f.e1.experience);
  assert.equal(opened.outcome, 'REQUEST_OPEN');
  assert.deepEqual(await requestPlace(f.mohamed, command, f.e1.experience), opened, 'P03 a retry is the same request');
  assert.deepEqual(await requestPlace(f.mohamed, randomUUID(), f.e1.experience), opened, 'P03 one open request per revision');
  await as(f.mohamed);
  await rejected(() => q('SELECT * FROM public.request_own_public_spatial_placement_v1($1, $2)', [command, f.e2.experience]), ['23505'],
    /PUBLIC_SPATIAL_COMMAND_ID_CONFLICT/u);

  // P04 the placer's whole input: the reviewed meaning, themes, region and revision identity — nothing else.
  const input = await placerInput(opened.request_id);
  assert.deepEqual(input, [{ interpretation_id: f.e1.interpretation, meaning: p1.meaning, primary_themes: p1.primary,
    secondary_themes: p1.secondary, semantic_region: p1.lens }], 'P04 exactly the reviewed S5-03A interpretation');
  const everything = JSON.stringify(input);
  for (const forbidden of [...f.packageTexts, f.mohamedPublicId, f.mohamedLabel, f.world, f.mohamed, f.hadir, f.hadirMaterial, f.userUnit,
    p1.explanation, ...PLACEHOLDERS]) {
    assert.ok(!everything.includes(forbidden), `P04 the placer input carries no package text, identity, alias, explanation or placeholder (${String(forbidden).slice(0, 20)}…)`);
  }

  // P05 a client can supply no coordinate: the commit is the server channel's alone, and the request has no room for one.
  await as(f.mohamed);
  await rejected(() => q('SELECT * FROM public.commit_public_spatial_placement_v1($1, $2, $3, $4)', [opened.request_id, 'mine', 0, 0]), ['42501']);
  await rejected(() => q('SELECT * FROM public.read_public_spatial_placement_input_v1($1)', [opened.request_id]), ['42501']);
  await rejected(() => q('SELECT * FROM public.request_own_public_spatial_placement_v1($1, $2, $3, $4)', [randomUUID(), f.e1.experience, 0, 0]), ['42883']);

  // P06 a malformed placer answer is refused and writes nothing.
  await asRole('service_role');
  for (const [layout, x, y] of [['', 0, 0], ['Has Spaces', 0, 0], ['ok', '4611686018427387904', 0], ['ok', 0, '-4611686018427387905'], [null, 0, 0], ['ok', null, 0]]) {
    await rejected(() => q('SELECT * FROM public.commit_public_spatial_placement_v1($1, $2, $3, $4)', [opened.request_id, layout, x, y]), ['22023'],
      /PUBLIC_SPATIAL_OUTPUT_INVALID/u);
  }
  assert.deepEqual(await placementsOf(f.e1.experience), [], 'P06 nothing was written');

  // P07 PLACED: bound to the exact version AND the exact reviewed revision; spatially ready; the owner sees PLACED, never where.
  assert.equal(await commitPlace(opened.request_id, 'test.layout.v1', '1000000', '2000000'), 'PLACED');
  const [placement] = await placementsOf(f.e1.experience);
  assert.deepEqual([placement.experience_version_id, placement.interpretation_id, placement.x, placement.y, placement.layout_version],
    [f.e1.version, f.e1.interpretation, '1000000', '2000000', 'test.layout.v1'], 'P07 exact version + exact revision');
  assert.equal(placement.coordinate_scheme, 'QANDEEL_PUBLIC_FIELD_V1', "P07 the Public field's own coordinate space — never the Personal Home scheme");
  const ready = await spatialReadiness(f.e1.experience);
  assert.deepEqual([ready.readiness, ready.experience_version_id, ready.interpretation_id, ready.spatial_placement_id],
    ['SPATIALLY_READY', f.e1.version, f.e1.interpretation, placement.id], 'P07 spatial readiness');
  assert.deepEqual(await preparation(f.mohamed, f.e1.experience), [{ preparation_state: 'PLACED' }], 'P07 the owner sees PLACED and no coordinate');

  // P08 stable: a retry, a second request, a different layout model — the committed place is read back, nothing moves.
  assert.equal(await commitPlace(opened.request_id, 'test.layout.v1', '1000000', '2000000'), 'ALREADY_PLACED', 'P08 idempotent retry');
  assert.equal(await commitPlace(opened.request_id, 'upgraded.layout.v2', '-77', '88'), 'ALREADY_PLACED', 'P08 a model upgrade moves nothing');
  assert.deepEqual(await requestPlace(f.mohamed, randomUUID(), f.e1.experience), { outcome: 'ALREADY_PLACED', request_id: null }, 'P08');
  assert.deepEqual(await placerInput(opened.request_id), [], 'P08 no input is served for a placed revision');
  assert.deepEqual(await placementsOf(f.e1.experience), [placement], 'P08 the coordinates are exactly as committed');

  // P09 append-only for every role, and a placement can only name a revision of its own version.
  await asRole('postgres');
  for (const statement of [
    `UPDATE ${SCHEMA}.spatial_placements SET world_x = world_x + 1 WHERE id = '${placement.id}'`,
    `UPDATE ${SCHEMA}.spatial_placements SET layout_version = 'popular.v9' WHERE id = '${placement.id}'`,
    `DELETE FROM ${SCHEMA}.spatial_placements WHERE id = '${placement.id}'`,
    `DELETE FROM ${SCHEMA}.spatial_requests WHERE id = '${opened.request_id}'`,
    `INSERT INTO ${SCHEMA}.spatial_requests (id, experience_id, experience_version_id, interpretation_id, requested_at)
       VALUES ('${randomUUID()}', '${f.e2.experience}', '${f.e2.version}', '${f.e1.interpretation}', now())`,
  ]) {
    await rejected(() => q(statement), ['55000', '23503'], null);
  }

  // P10 a correction makes the old place STALE — kept, never moved — and the new revision receives its own place.
  const p2 = MEANINGS.e2;
  f.e2.interpretation = await semanticallyReady(f, f.e2.experience, p2);
  const e2First = await placed(f, f.e2.experience, '-5000000', '300');
  f.e2.corrected = await corrected(f, f.e2.experience, f.e2.interpretation, 'Courage in ordinary days', ['courage', 'days'], 'courage.days');
  assert.deepEqual([(await spatialReadiness(f.e2.experience)).readiness, (await spatialReadiness(f.e2.experience)).reason,
    (await spatialReadiness(f.e2.experience)).interpretation_id], ['NOT_READY', 'NO_PLACEMENT', f.e2.corrected],
  'P10 the old place does not serve the new revision');
  assert.deepEqual((await placementsOf(f.e2.experience)).map((p) => [p.interpretation_id, p.x, p.y]), [[f.e2.interpretation, '-5000000', '300']],
    'P10 the stale place is kept exactly, never moved');
  assert.equal(await commitPlace(e2First, 'test.layout.v1', '1', '1'), 'ALREADY_PLACED', 'P10 the stale request moves nothing');
  // A request for a revision that a later correction supersedes is STALE, and serves no input.
  const e2Second = await requestPlace(f.mohamed, randomUUID(), f.e2.experience);
  assert.equal(e2Second.outcome, 'REQUEST_OPEN');
  const thirdRevision = await corrected(f, f.e2.experience, f.e2.corrected, 'Courage in small ordinary days', ['courage'], 'courage.ordinary');
  assert.deepEqual(await placerInput(e2Second.request_id), [], 'P10 no input for a superseded revision');
  assert.equal(await commitPlace(e2Second.request_id, 'test.layout.v1', '7', '7'), 'STALE', 'P10 a superseded revision is not placed');
  assert.equal((await placementsOf(f.e2.experience)).length, 1);
  f.e2.current = thirdRevision;
  // e2 stays deliberately UNPLACED at its current revision: published below, it must not be served from its stale place.

  // P11 the other fixtures: e4 placed near e1; e5 placed and kept READY_FOR_REVIEW.
  f.e4.interpretation = await semanticallyReady(f, f.e4.experience, MEANINGS.e4);
  await placed(f, f.e4.experience, '1500000', '2500000');
  f.e5.interpretation = await semanticallyReady(f, f.e5.experience, MEANINGS.e1);
  await placed(f, f.e5.experience, '1200000', '2100000');
  assert.equal((await spatialReadiness(f.e5.experience)).readiness, 'SPATIALLY_READY');
}

// ------------------------------------------------------------------------------------------------------- 3. viewer
async function verifyViewer(f, seam) {
  const outputs = [];
  const keep = (value) => { outputs.push(value); return value; };

  // V01 nothing is public yet: READY_FOR_REVIEW is invisible to everyone, even placed, even to its own publisher.
  for (const uid of [f.reader, f.mohamed]) {
    assert.deepEqual(keep(await field(uid)), [], 'V01 an empty field: nothing is published');
    assert.deepEqual(keep(await searchField(uid, 'family')), [], 'V01');
    assert.deepEqual(keep(await panel(uid, f.e1.experience)), [], 'V01');
    assert.deepEqual(keep(await contentOf(uid, f.e1.experience)), [], 'V01');
    assert.deepEqual(keep(await nearby(uid, f.e1.experience)), [], 'V01');
  }

  // Publication exists only through the simulated CW2-08 seam, inside this rolled-back transaction, restored at once.
  for (const e of [f.e1, f.e2, f.e4]) {
    await asRole('postgres');
    const [published] = await rt.publishCleared(seam, f.mohamed, randomUUID(), e.experience, e.version);
    assert.equal(published.outcome, 'PUBLISHED', 'fixture: published through the simulated seam');
  }
  assert.equal((await visibility(f.e2.experience))[0].visibility_state, 'PUBLICLY_VISIBLE', 'fixture: e2 is canonically public');

  // V02 the field: only PUBLICLY_VISIBLE Experiences with a current place, the actual reviewed meaning and region.
  const world = keep(await field(f.reader));
  assert.deepEqual(world.map((r) => [r.experience_id, r.world_x, r.world_y, r.meaning, r.semantic_region]), [
    [f.e1.experience, '1000000', '2000000', MEANINGS.e1.meaning, MEANINGS.e1.lens],
    [f.e4.experience, '1500000', '2500000', MEANINGS.e4.meaning, MEANINGS.e4.lens],
  ], 'V02 e1 and e4 — never the Draft, never READY e5 (placed), never e2 (public, but its only place is stale)');
  assert.deepEqual(Object.keys(world[0]).sort(), ['experience_id', 'meaning', 'semantic_region', 'world_x', 'world_y'], 'V02 nothing else');
  assert.deepEqual(ids(keep(await field(f.reader, ['1400000', '2400000', '1600000', '2600000']))), [f.e4.experience], 'V02 a bounded viewport');
  await as(f.reader);
  await rejected(() => q('SELECT * FROM public.read_public_semantic_field_v1($1, $2, $3, $4)', ['10', '0', '0', '10']), ['22023']);
  assert.deepEqual(ids(keep(await field(f.mohamed))), ids(world), 'V02 the publisher sees the same World as everyone');

  // V03 the frozen I-05 descriptor readers would serve the content-free 0096 constant — this boundary never does.
  const [frozenPanel] = await own('SELECT * FROM public.resolve_public_panel_v1($1, $2)', [f.e1.experience, f.reader]);
  assert.deepEqual([frozenPanel.lens_key, frozenPanel.semantic_label], ['s5-03a.private', 'S5-03A_PRIVATE_SEMANTIC_INTERPRETATION_V1'],
    'V03 (G18) the frozen panel serves the private constant: S5-03B does not use it');

  // V04 search stays inside the same visible field and returns places to navigate to.
  const hits = keep(await searchField(f.reader, 'family'));
  assert.deepEqual(hits.map((r) => [r.experience_id, r.world_x, r.world_y]), [[f.e1.experience, '1000000', '2000000']], 'V04 by meaning');
  assert.deepEqual(ids(keep(await searchField(f.reader, 'patience'))), [f.e4.experience], 'V04 by a secondary theme');
  const bodyWord = f.packageTexts.join(' ').split(/\s+/u).find((w) => /^[a-z]{5,}$/u.test(w));
  assert.ok(bodyWord, 'fixture: a public body word');
  assert.deepEqual(ids(keep(await searchField(f.reader, bodyWord))), [f.e1.experience, f.e4.experience].sort(), 'V04 by public text — visible only');
  for (const term of ['courage', 'ordinary', 'private', 's5', 'S5-03A_PRIVATE_SEMANTIC_INTERPRETATION_V1', 's5-03a.private']) {
    assert.deepEqual(keep(await searchField(f.reader, term)), [], `V04 no hidden, stale or placeholder match (${term})`);
  }
  await as(f.reader);
  for (const bad of ['', ' padded', 'two\nlines', 'x'.repeat(121)]) {
    await rejected(() => q('SELECT * FROM public.search_public_semantic_field_v1($1)', [bad]), ['22023']);
  }

  // V05 the panel: reviewed meaning, current display, published instant, exact-version vitality, its place; the content
  //     through the canonical serving resolver; nearby bounded to visible Experiences.
  const [card] = keep(await panel(f.reader, f.e1.experience));
  assert.deepEqual([card.meaning, card.primary_themes, card.secondary_themes, card.semantic_region, card.publisher_display_label,
    card.discussion_post_count, card.qandeel_response_count, card.world_x, card.world_y, card.version_ordinal],
  [MEANINGS.e1.meaning, MEANINGS.e1.primary, MEANINGS.e1.secondary, MEANINGS.e1.lens, f.mohamedLabel, 0, 0, '1000000', '2000000', 1], 'V05 panel');
  assert.ok(card.published_at instanceof Date, 'V05 the published instant');
  assert.ok(!Object.keys(card).some((k) => /user|ref|explanation|fingerprint|rank|view/u.test(k)), 'V05 no account, ref, explanation, rank or view count');
  const items = keep(await contentOf(f.reader, f.e1.experience));
  assert.deepEqual(items.map((i) => i.item_text).sort(), [...f.packageTexts].sort(), 'V05 the canonical public content');
  assert.deepEqual(new Set(items.map((i) => i.item_kind)).size > 0 && items.every((i) => ['SOURCE_CONTENT', 'ANALYSIS'].includes(i.item_kind)), true);
  assert.deepEqual(ids(keep(await nearby(f.reader, f.e1.experience))), [f.e4.experience], 'V05 nearby: visible only, never itself');
  assert.ok((await nearby(f.reader, f.e4.experience)).length <= 3, 'V05 bounded');

  // V06 one neutral absence for a guessed id, a public Experience with only a stale place, READY_FOR_REVIEW and a Draft.
  for (const target of [randomUUID(), f.e2.experience, f.e5.experience, f.draft]) {
    assert.deepEqual(keep(await panel(f.reader, target)), [], 'V06 panel');
    assert.deepEqual(keep(await contentOf(f.reader, target)), [], 'V06 content');
    assert.deepEqual(keep(await nearby(f.reader, target)), [], 'V06 nearby');
  }

  // V07 an unadmitted viewer reads nothing; a token-less caller is refused.
  const ghost = randomUUID();
  assert.equal((await admission(ghost))[0].admission, 'NOT_ADMITTED');
  assert.deepEqual(await field(ghost), [], 'V07');
  assert.deepEqual(await searchField(ghost, 'family'), [], 'V07');
  assert.deepEqual(await panel(ghost, f.e1.experience), [], 'V07');
  await asRole('authenticated');
  await rejected(() => q('SELECT * FROM public.read_public_semantic_field_v1($1, $2, $3, $4)', WORLD), ['42501'], /AUTHENTICATION_REQUIRED/u);

  // V08 an alias change and a vitality recompute move nothing; the panel shows the CURRENT display.
  const before = await placementsOf(f.e1.experience);
  await asRole('postgres'); await actAs(f.mohamed);
  await rt.updateLabel(randomUUID(), 'PSEUDONYM', 'a renamed publisher');
  await asRole('postgres');
  assert.equal((await rt.recomputeVitality(f.e1.experience))[0].outcome.startsWith('VITALITY_'), true);
  assert.deepEqual(await placementsOf(f.e1.experience), before, 'V08 coordinates unchanged');
  const [renamed] = await panel(f.reader, f.e1.experience);
  assert.deepEqual([renamed.publisher_display_label, renamed.world_x, renamed.world_y], ['a renamed publisher', '1000000', '2000000'], 'V08');

  // V09 the 0096 private constants never reach a Product output.
  const all = JSON.stringify(outputs);
  for (const placeholder of PLACEHOLDERS) assert.ok(!all.includes(placeholder), `V09 ${placeholder} never reaches the viewer`);
}

// ------------------------------------------------------------------------------------------------ 4. disappearance
async function assertAbsent(f, experience, term) {
  assert.ok(!ids(await field(f.reader)).includes(experience), 'absent from the field');
  assert.ok(!ids(await searchField(f.reader, term)).includes(experience), 'absent from search');
  assert.deepEqual(await panel(f.reader, experience), [], 'absent from the panel');
  assert.deepEqual(await contentOf(f.reader, experience), [], 'absent from the content');
  assert.deepEqual(await nearby(f.reader, experience), [], 'no nearby around it');
  for (const other of [f.e4.experience]) {
    if (other !== experience) assert.ok(!ids(await nearby(f.reader, other)).includes(experience), 'absent from another\'s nearby');
  }
}

async function verifyDisappearance(f) {
  const spatialBefore = await own(`SELECT * FROM ${SCHEMA}.spatial_placements ORDER BY id`);

  // D01 a withdrawn required approval: canonical visibility goes dark (0098) and so does every S5-03B read.
  await q('SAVEPOINT d01');
  const [{ id: hadirApproval }] = await own(`SELECT id FROM ${T.APPROVALS} WHERE manifest_version_id = $1 AND approver_user_id = $2`,
    [f.e1.manifest, f.hadir]);
  await asRole('postgres'); await actAs(f.hadir);
  await rt.withdraw(randomUUID(), hadirApproval);
  assert.equal((await visibility(f.e1.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE', 'D01 canonical visibility');
  await assertAbsent(f, f.e1.experience, 'family');
  assert.deepEqual(ids(await field(f.reader)), [f.e4.experience], 'D01 the rest of the World is unchanged');
  await q('ROLLBACK TO SAVEPOINT d01'); await q('RELEASE SAVEPOINT d01');

  // D02 ASSURE-F05: Hadir deletes her words. The package copy and the S5-03A content are erased in the same transaction;
  //     S5-03B writes nothing and still goes dark everywhere, and spatial readiness fails closed.
  await q('SAVEPOINT d02');
  await asRole('postgres'); await actAs(f.hadir);
  assert.equal((await rt.deleteMaterial(randomUUID(), f.world, f.hadirMaterial, randomUUID()))[0].outcome, 'MATERIAL_DELETED');
  assert.equal(Number((await own(`SELECT count(*) n FROM ${SEMANTIC}.semantic_interpretations WHERE experience_id = $1 AND content_erased_at IS NOT NULL`,
    [f.e1.experience]))[0].n) > 0, true, 'D02 S5-03A erased its content (lineage)');
  await assertAbsent(f, f.e1.experience, 'family');
  assert.deepEqual(ids(await field(f.reader)), [f.e4.experience], 'D02 a package nobody erased keeps its place in the World');
  assert.deepEqual([(await spatialReadiness(f.e5.experience)).readiness, (await spatialReadiness(f.e5.experience)).reason],
    ['NOT_READY', 'NOT_SEMANTICALLY_READY'], 'D02 spatial readiness fails closed for an erased package');
  assert.deepEqual(await preparation(f.mohamed, f.e5.experience), [{ preparation_state: 'NOT_SEMANTICALLY_READY' }], 'D02');
  assert.deepEqual(await requestPlace(f.mohamed, randomUUID(), f.e5.experience), { outcome: 'NOT_SEMANTICALLY_READY', request_id: null }, 'D02');
  assert.deepEqual(await own(`SELECT * FROM ${SCHEMA}.spatial_placements ORDER BY id`), spatialBefore,
    'D02 the geometry is reasoning state: kept, never served, nothing rebuilt');
  await q('ROLLBACK TO SAVEPOINT d02'); await q('RELEASE SAVEPOINT d02');

  // D03 a successor version becomes current: the previous version's place is never the new version's.
  await q('SAVEPOINT d03');
  const successor = await rt.simulateSuccessorVersion(f.e4.experience, f.e4.manifest);
  assert.equal((await visibility(f.e4.experience))[0].visible_experience_version_id, successor.successorVersion);
  assert.ok(!ids(await field(f.reader)).includes(f.e4.experience), 'D03 no place is inherited across versions');
  assert.deepEqual(await panel(f.reader, f.e4.experience), [], 'D03');
  assert.ok(!ids(await searchField(f.reader, 'hope')).includes(f.e4.experience), 'D03');
  await q('ROLLBACK TO SAVEPOINT d03'); await q('RELEASE SAVEPOINT d03');
  assert.deepEqual(ids(await field(f.reader)), [f.e1.experience, f.e4.experience].sort(), 'after the probes, the World is as it was');
}

// ------------------------------------------------------------------------------------------------------- 5. launch
async function verifyLaunchClosure(f) {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await asRole(role, role === 'anon' ? null : f.mohamed);
    await rejected(() => q('SELECT * FROM public.publish_public_experience_v1($1, $2, $3)', [randomUUID(), f.e5.experience, f.e5.version]), ['42501']);
    await rejected(() => q(`SELECT * FROM ${SCHEMA}.derive_public_spatial_readiness_v1($1)`, [f.e5.experience]), ['42501']);
  }
  const seam = (await rt.functionPosture(SEAM)).prosrc;
  assert.ok(seam.includes('NOT_EVALUATED') && !seam.includes("'CLEARED'"), 'L01 the seam was restored and still answers NOT_EVALUATED');
  const [{ lifecycle }] = await own(`SELECT current_lifecycle lifecycle FROM ${T.EXPERIENCES} WHERE id = $1`, [f.e5.experience]);
  assert.equal(lifecycle, 'READY_FOR_REVIEW', 'L02 a spatially ready Experience is still not published');
}

await runVerifier('0145', async (stage) => {
  await rt.client.connect();
  stage('boundary');
  await verifyBoundary();
  await q('BEGIN');
  try {
    stage('fixture');
    const seam = await rt.captureSeam();
    const f = await fixture();
    stage('stable placement');
    await verifyPlacement(f);
    stage('viewer');
    await verifyViewer(f, seam);
    stage('disappearance');
    await verifyDisappearance(f);
    stage('launch closure');
    await verifyLaunchClosure(f);
  } finally {
    await q('ROLLBACK');
  }
  console.log('Verified migration 0145: a stable spatial placement exists only for a semantically ready Experience, bound to the exact version and the exact reviewed S5-03A revision, from a meaning-only input on the server channel; a client supplies no coordinate; a retry or a different model moves nothing; history is append-only; a correction leaves the old place stale and unserved; only PUBLICLY_VISIBLE Experiences with a current place are served to an admitted viewer, with the reviewed S5-03A meaning and never the 0096 constants; search, panel, content and nearby stay inside the same visible World; a withdrawal, an ASSURE-F05 erasure and a successor version each make the Experience absent everywhere at once; nothing publishes.');
}, async () => { await rt.client.end().catch(() => undefined); });
