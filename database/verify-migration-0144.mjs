// S5-03A — Public Semantic Interpretation + Publisher Review v1: the real-PostgreSQL verifier for migration 0144.
//
// It proves, against a fully migrated database:
//   1. the boundary: every S5-03A function is a pinned `public_semantic_private` SECURITY DEFINER or a pinned `public`
//      INVOKER wrapper; `authenticated` executes exactly the five owner commands, the server channel exactly the two
//      server commands, anon nothing, and no internal derivation is reachable; no owner command accepts an account, a
//      ref, a controller, an authority, a lifecycle, a visibility, a readiness, a fingerprint, a lens, a coordinate, a
//      rank or a vector; the four relations are private, RLS-enabled, append-only and reference no account; no frozen
//      I-05 primitive became application-executable; no S5-03A body names anything beyond the exact public package;
//   2. PUBLIC PACKAGE ONLY: the interpreter's whole input is exactly the package items of the exact version — never the
//      Personal conversation, a hidden Shared material, the publisher's Public ID or display label;
//   3. the flow: DRAFT is not reviewable; a non-controller (a rightsholder, a Shared member, a stranger, a guessed id) gets
//      one neutral answer and writes nothing; QANDEEL's proposal becomes revision 1 (INITIAL_INTERPRETATION) only through
//      the server channel and the requester's own commit; accept binds the exact revision; a correction is checked by
//      QANDEEL and becomes the next revision (PUBLISHER_CORRECTION) with QANDEEL's lens key; NOT_SUPPORTED writes
//      nothing; history is append-only; idempotent retries; a malformed or copying interpreter answer is refused;
//   4. version binding: readiness is SEMANTICALLY_READY only for the reviewed CURRENT revision of the exact current
//      version and package; a raw frozen revision is UNREVIEWED; a successor version carries nothing over; no semantic act
//      moves a version, package, approval, controller or lifecycle;
//   5. erasure: an ASSURE-F05 owner deletion makes the package not whole — the review shows no meaning, readiness is
//      PACKAGE_UNAVAILABLE, no input is served, no outcome is recorded, no commit or accept lands, nothing is rebuilt;
//   6. concurrency, on real connections: two corrections of the same revision — one lands, the other is STALE;
//   7. launch closure: the seam still answers NOT_EVALUATED; nothing can publish; the interpretation is served to nobody.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, NONE, SEAM, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, actAs, asRole, rejected } = rt;
const own = async (text, values = []) => { await asRole('postgres'); return rows(text, values); };

const SCHEMA = 'public_semantic_private';
const OWNER_COMMANDS = {
  read_own_public_semantic_review_v1: ['p_experience_id uuid'],
  request_own_public_semantic_proposal_v1: ['p_command_id uuid', 'p_experience_id uuid'],
  request_own_public_semantic_correction_v1: ['p_command_id uuid', 'p_experience_id uuid', 'p_interpretation_id uuid',
    'p_meaning text', 'p_primary_themes text[]', 'p_secondary_themes text[]'],
  commit_own_public_semantic_work_v1: ['p_work_id uuid'],
  accept_own_public_semantic_proposal_v1: ['p_command_id uuid', 'p_experience_id uuid', 'p_interpretation_id uuid'],
};
const SERVER_COMMANDS = {
  read_public_semantic_work_input_v1: ['p_work_id uuid'],
  record_public_semantic_work_outcome_v1: ['p_work_id uuid', 'p_outcome text', 'p_lens_key text', 'p_meaning text',
    'p_primary_themes text[]', 'p_secondary_themes text[]', 'p_explanation text'],
};
const INTERNAL = ['semantic_text_is_well_formed_v1', 'semantic_themes_are_well_formed_v1', 'semantic_themes_are_disjoint_v1',
  'reject_semantic_history_mutation_v1', 'derive_semantic_identity_v1', 'derive_package_fingerprint_v1',
  'resolve_semantic_target_v1', 'copies_package_text_v1', 'interpretation_copies_package_v1', 'derive_work_request_ref_v1',
  'work_admissibility_v1', 'derive_public_semantic_readiness_v1'];
const RELATIONS = ['semantic_work', 'semantic_work_outcomes', 'semantic_interpretations', 'semantic_reviews'];
const FROZEN = ['public.record_public_experience_semantic_placement_v1(uuid, uuid, uuid, uuid, text, text)',
  'public.derive_public_experience_current_placement_v1(uuid)', 'public.publish_public_experience_v1(uuid, uuid, uuid)', SEAM,
  'public.commit_public_experience_ready_for_review_v1(uuid, uuid, uuid)', 'public.post_public_discussion_v1(uuid, uuid, uuid, uuid, text)',
  'public.record_public_qandeel_response_v1(uuid, uuid, uuid, uuid, text, uuid[])'];

// ---- the S5-02 path to READY_FOR_REVIEW, as the human's own application role
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

// ---- the S5-03A commands
const review = async (uid, experience) => { await as(uid); return rows('SELECT * FROM public.read_own_public_semantic_review_v1($1)', [experience]); };
const requestProposal = async (uid, command, experience) => {
  await as(uid); return first('SELECT * FROM public.request_own_public_semantic_proposal_v1($1, $2)', [command, experience]);
};
const requestCorrection = async (uid, command, experience, interpretation, meaning, primary, secondary) => {
  await as(uid);
  return first('SELECT * FROM public.request_own_public_semantic_correction_v1($1, $2, $3, $4, $5::text[], $6::text[])',
    [command, experience, interpretation, meaning, primary, secondary]);
};
const commitWork = async (uid, work) => { await as(uid); return first('SELECT * FROM public.commit_own_public_semantic_work_v1($1)', [work]); };
const accept = async (uid, command, experience, interpretation) => {
  await as(uid); return (await first('SELECT * FROM public.accept_own_public_semantic_proposal_v1($1, $2, $3)', [command, experience, interpretation])).outcome;
};
const input = async (work) => { await asRole('service_role'); return rows('SELECT * FROM public.read_public_semantic_work_input_v1($1)', [work]); };
const record = async (work, outcome, lens, meaning, primary, secondary, explanation) => {
  await asRole('service_role');
  return (await first('SELECT * FROM public.record_public_semantic_work_outcome_v1($1, $2, $3, $4, $5::text[], $6::text[], $7)',
    [work, outcome, lens, meaning, primary, secondary, explanation])).outcome;
};
const readiness = async (experience) => (await own(`SELECT * FROM ${SCHEMA}.derive_public_semantic_readiness_v1($1)`, [experience]))[0];
const placements = async (version) => own(`SELECT id, placement_revision, placement_basis, lens_key, semantic_label, recorded_by_user_id
  FROM ${T.PLACEMENTS} WHERE experience_version_id = $1 ORDER BY placement_revision`, [version]);
const semanticCount = async (table, experience) => {
  const join = table === 'semantic_work' ? `${SCHEMA}.semantic_work x WHERE x.experience_id = $1`
    : table === 'semantic_work_outcomes' ? `${SCHEMA}.semantic_work_outcomes x JOIN ${SCHEMA}.semantic_work w ON w.id = x.work_id WHERE w.experience_id = $1`
      : table === 'semantic_interpretations' ? `${SCHEMA}.semantic_interpretations x WHERE x.experience_id = $1`
        : `${SCHEMA}.semantic_reviews x JOIN ${SCHEMA}.semantic_interpretations i ON i.placement_id = x.placement_id WHERE i.experience_id = $1`;
  return Number((await own(`SELECT count(*) n FROM ${join}`, [experience]))[0].n);
};

const PROPOSAL = Object.freeze({
  lens: 'family.fear', meaning: 'Fear for a family while work feels uncertain',
  primary: ['fear', 'family'], secondary: ['work'], explanation: 'The words return to worry about the people who depend on the speaker.',
});

// --------------------------------------------------------------------------------------------------------- 1. boundary
async function verifyBoundary() {
  await asRole('postgres');
  const fns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(fns.map((f) => f.proname).sort(), [...Object.keys(OWNER_COMMANDS), ...Object.keys(SERVER_COMMANDS), ...INTERNAL].sort(),
    'B01 the private schema holds exactly the S5-03A functions');
  for (const f of fns) {
    assert.equal(f.prosecdef, true, `B01 ${f.proname} is a definer`);
    assert.equal(f.owner, 'postgres');
    assert.deepEqual(f.proconfig, ['search_path=""'], `B01 ${f.proname} pins an empty search_path`);
  }
  const exposed = { ...OWNER_COMMANDS, ...SERVER_COMMANDS };
  const wrappers = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [Object.keys(exposed)]);
  assert.equal(wrappers.length, Object.keys(exposed).length, 'B02 each exposed command has exactly one public wrapper');
  for (const w of wrappers) {
    assert.equal(w.prosecdef, false, `B02 public.${w.proname} is an INVOKER wrapper`);
    assert.deepEqual(w.proconfig, ['search_path=""']);
    assert.equal(w.args, exposed[w.proname].join(', '), `B03 public.${w.proname} accepts exactly its inputs`);
  }
  // B03 no owner command takes an authority claim or a map control.
  for (const [name, inputs] of Object.entries(OWNER_COMMANDS)) {
    for (const parameter of inputs) {
      assert.doesNotMatch(parameter, /user|actor|identity|label|controller|approver|authority|audience|visib|lifecycle|ready|readiness|digest|fingerprint|manifest|version|lens|placement|coordinate|\bx\b|\by\b|lat|lng|rank|weight|popular|proxim|near|vector|embedding|ref\b/u,
        `B03 ${name} input ${parameter} is no authority claim and no map control`);
    }
  }
  const executable = await rows(`SELECT r.rolname, n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT unnest($2::text[]) rolname) r
    WHERE EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
      AND (n.nspname = $3 OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`, [Object.keys(exposed), APP_ROLES, SCHEMA]);
  assert.deepEqual(executable.map((e) => `${e.rolname} ${e.fn}`).sort(), [
    ...Object.keys(OWNER_COMMANDS).flatMap((n) => [`authenticated public.${n}`, `authenticated ${SCHEMA}.${n}`]),
    ...Object.keys(SERVER_COMMANDS).flatMap((n) => [`service_role public.${n}`, `service_role ${SCHEMA}.${n}`]),
  ].sort(), 'B04 authenticated runs the five owner commands, the server channel the two server commands, anon nothing');
  const publicExec = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname = $2 OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')`,
  [Object.keys(exposed), SCHEMA]);
  assert.deepEqual(publicExec, [], 'B04 no S5-03A function keeps PUBLIC EXECUTE');
  // B05 the relations: four, private, RLS, no table privilege for any application role, no account reference.
  const tables = await rows(`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm') ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(tables.map((t) => t.relname), [...RELATIONS].sort(), 'B05 exactly the four semantic relations');
  for (const t of tables) {
    assert.equal(t.relrowsecurity, true, `B05 ${t.relname} has RLS`);
    for (const role of APP_ROLES) {
      const [{ any }] = await rows(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT')
        OR has_table_privilege($1, $2, 'UPDATE') OR has_table_privilege($1, $2, 'DELETE') AS any`, [role, `${SCHEMA}.${t.relname}`]);
      assert.equal(any, false, `B05 ${role} holds no privilege on ${t.relname}`);
    }
  }
  const accountEdges = await rows(`SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = $1 AND c.contype = 'f'
      AND c.confrelid IN ('public.users'::regclass, 'auth.users'::regclass, 'public.public_identities'::regclass)`, [SCHEMA]);
  assert.deepEqual(accountEdges, [], 'B05 no semantic relation references an account or a Public identity (QAN-BL-ACCT-01 gains no edge)');
  const columns = await rows(`SELECT a.attname FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND a.attnum > 0 AND NOT a.attisdropped`, [SCHEMA]);
  for (const { attname } of columns) {
    assert.doesNotMatch(attname, /user|actor|account|identity|coordinate|position|rank|weight|vector|embedding|popular/u, `B05 no ${attname} column`);
  }
  for (const relation of RELATIONS) {
    const [tg] = await rows(`SELECT tg.tgenabled FROM pg_trigger tg WHERE tg.tgrelid = $1::regclass AND NOT tg.tgisinternal
      AND tg.tgfoid = $2::regprocedure`, [`${SCHEMA}.${relation}`, `${SCHEMA}.reject_semantic_history_mutation_v1()`]);
    assert.equal(tg?.tgenabled, 'O', `B05 ${relation} is append-only`);
  }
  // B06 no frozen primitive became application-executable.
  for (const fn of FROZEN) {
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await rt.canExecute(role, fn), false, `B06 ${role} must not execute the frozen ${fn}`);
    }
  }
  // B07 PUBLIC PACKAGE ONLY, by source text; nothing beyond READY_FOR_REVIEW.
  const bodies = await rows(`SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = $2 OR (n.nspname = 'public' AND p.proname = ANY($1::text[]))`, [Object.keys(exposed), SCHEMA]);
  for (const b of bodies) {
    assert.doesNotMatch(b.prosrc, /publish_public_experience_v1|resolve_public_publication_prerequisites_v1|'PUBLISHED'|ABSENT_FROM_PUBLIC_WORLD|public_discussion|public_qandeel|provenance|shared_world|conversation_|memor|human_model|(^|[^a-z])him_|hypothes|matching|introduction|public\.users|public_identit|display_label|label_mode|personal_owner/u,
      `B07 ${b.proname} reads nothing beyond the exact public package and reaches nothing beyond READY_FOR_REVIEW`);
  }
  // B08 the input is served only by the one reader, and the reader's columns carry no identifier but the work's kind.
  const inputColumns = await rt.resultColumns('public.read_public_semantic_work_input_v1(uuid)');
  assert.deepEqual(inputColumns, ['work_kind', 'item_ordinal', 'item_kind', 'item_text', 'correction_meaning',
    'correction_primary_themes', 'correction_secondary_themes'], 'B08 the interpreter input is item ordinal, kind and public text, and the publisher\'s words');
  const reviewColumns = await rt.resultColumns('public.read_own_public_semantic_review_v1(uuid)');
  for (const column of reviewColumns) {
    assert.doesNotMatch(column, /user|ref$|lens|fingerprint|digest|manifest|world|material|session|provenance|coordinate/u, `B08 the review discloses no ${column}`);
  }
  const seam = (await rt.functionPosture(SEAM)).prosrc;
  assert.ok(seam.includes('NOT_EVALUATED') && !seam.includes("'CLEARED'"), 'B09 the CW2-08 seam still answers NOT_EVALUATED');
}

// ------------------------------------------------------------------------------------------------------------- fixture
async function fixture() {
  const f = rt.newFixture();
  f.member = randomUUID();
  await asRole('postgres');
  await rt.provision(f);
  await q('INSERT INTO auth.users(id) VALUES ($1)', [f.member]);
  await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)
           VALUES ($1, $2, $3, now(), NULL)`, [randomUUID(), f.world, f.member]);
  // A Draft that stays a Draft, and a READY_FOR_REVIEW Experience: Mohamed's own sentence and Hadir's (Hadir approves).
  f.draft = await startDraft(f.mohamed);
  f.exp = await startDraft(f.mohamed);
  assert.equal(await prepareOwn(f.mohamed, f.exp, [f.userUnit], [f.world], [f.hadirMaterial]), 'PREPARED');
  const [{ v, m }] = await own(`SELECT e.current_experience_version_id v, ve.package_manifest_version_id m FROM ${T.EXPERIENCES} e
    JOIN ${T.VERSIONS} ve ON ve.id = e.current_experience_version_id WHERE e.id = $1`, [f.exp]);
  f.version = v;
  f.manifest = m;
  assert.equal(await approveOwn(f.mohamed, m), 'APPROVED');
  assert.equal(await approveOwn(f.hadir, m), 'APPROVED');
  assert.equal(await readyOwn(f.mohamed, f.exp), 'READY_FOR_REVIEW');
  f.packageTexts = (await own(`SELECT b.public_text_body t FROM ${T.ITEMS} it JOIN ${T.BODIES} b ON b.package_item_id = it.package_item_id
    WHERE it.manifest_version_id = $1 ORDER BY it.item_ordinal`, [m])).map((r) => r.t);
  [{ public_id: f.mohamedPublicId }] = await own('SELECT public_id FROM public.users WHERE id = $1', [f.mohamed]);
  return f;
}

/** Everything a semantic act must never move. */
async function untouchable(f) {
  return own(`SELECT e.current_lifecycle, e.current_experience_version_id, e.experience_revision,
      (SELECT count(*)::int FROM ${T.VERSIONS} WHERE experience_id = e.id) versions,
      (SELECT count(*)::int FROM ${T.MANIFESTS} WHERE experience_id = e.id) manifests,
      (SELECT count(*)::int FROM ${T.APPROVALS} WHERE manifest_version_id = $2) approvals,
      (SELECT count(*)::int FROM ${T.WITHDRAWAL_EVENTS} WHERE manifest_version_id = $2) withdrawals,
      (SELECT count(*)::int FROM ${T.CONTROLLERS} WHERE experience_id = e.id) controllers,
      (SELECT count(*)::int FROM ${T.LIFECYCLE} WHERE experience_id = e.id) lifecycle_events
    FROM ${T.EXPERIENCES} e WHERE e.id = $1`, [f.exp, f.manifest]);
}

// ---------------------------------------------------------------------------------------- 2–4. the flow and its binding
async function verifyFlow(f) {
  const before = await untouchable(f);

  // S01 a Draft is not in the semantic stage.
  assert.deepEqual((await review(f.mohamed, f.draft)).map((r) => [r.semantic_state, r.meaning]), [['NOT_READY_FOR_REVIEW', null]], 'S01');
  assert.deepEqual(await requestProposal(f.mohamed, randomUUID(), f.draft), { outcome: 'NOT_READY_FOR_REVIEW', work_id: null }, 'S01');
  assert.equal(await semanticCount('semantic_work', f.draft), 0, 'S01 and nothing was written');

  // S02 READY_FOR_REVIEW with no proposal yet; nothing is ready.
  const [initial] = await review(f.mohamed, f.exp);
  assert.deepEqual([initial.semantic_state, initial.current_lifecycle, initial.interpretation_id, initial.semantically_ready],
    ['NO_PROPOSAL', 'READY_FOR_REVIEW', null, false], 'S02');
  assert.deepEqual([(await readiness(f.exp)).readiness, (await readiness(f.exp)).reason], ['NOT_READY', 'NO_INTERPRETATION'], 'S02');

  // S03 nobody but the exact controller: a rightsholder, a Shared member, a stranger, a guessed id — one neutral answer.
  for (const uid of [f.hadir, f.member, f.stranger]) {
    assert.deepEqual(await review(uid, f.exp), [], 'S03 no review for a non-controller');
    assert.deepEqual(await requestProposal(uid, randomUUID(), f.exp), { outcome: 'UNAVAILABLE', work_id: null }, 'S03');
  }
  assert.deepEqual(await requestProposal(f.mohamed, randomUUID(), randomUUID()), { outcome: 'UNAVAILABLE', work_id: null },
    'S03 a guessed Experience id is the same answer');
  assert.deepEqual(await review(f.mohamed, randomUUID()), []);
  assert.equal(await semanticCount('semantic_work', f.exp), 0, 'S03 and nothing was written');
  await asRole('anon');
  await rejected(() => q('SELECT * FROM public.request_own_public_semantic_proposal_v1($1, $2)', [randomUUID(), f.exp]), ['42501']);
  await asRole('authenticated');
  await rejected(() => q('SELECT * FROM public.read_own_public_semantic_review_v1($1)', [f.exp]), ['42501'], /AUTHENTICATION_REQUIRED/u);

  // S04 the controller asks for QANDEEL's proposal: one work; the same command again is the same work.
  const proposalCommand = randomUUID();
  const opened = await requestProposal(f.mohamed, proposalCommand, f.exp);
  assert.equal(opened.outcome, 'WORK_OPEN');
  assert.deepEqual(await requestProposal(f.mohamed, proposalCommand, f.exp), opened, 'S04 an equivalent retry names the same work');
  const work = opened.work_id;

  // S05 PUBLIC PACKAGE ONLY: the server channel's input is exactly the package, and nothing else exists for it.
  const given = await input(work);
  assert.deepEqual(given.map((r) => [r.work_kind, r.item_ordinal, r.item_text]),
    f.packageTexts.map((text, index) => ['PROPOSAL', index + 1, text]), 'S05 the input is exactly the package items, in order');
  assert.deepEqual(given.map((r) => r.item_kind), ['SOURCE_CONTENT', 'SOURCE_CONTENT']);
  const everything = JSON.stringify(given);
  for (const secret of [f.assistantText, 'a sentence Mohamed never saw', 'a sentence Mohamed wrote', f.mohamedPublicId, f.mohamed, f.hadir, f.world]) {
    assert.ok(!everything.includes(secret), `S05 the input carries nothing outside the package (${secret.slice(0, 24)}…)`);
  }
  for (const uid of [f.mohamed, f.hadir]) {
    await as(uid);
    await rejected(() => q('SELECT * FROM public.read_public_semantic_work_input_v1($1)', [work]), ['42501'], null);
    await rejected(() => q('SELECT * FROM public.record_public_semantic_work_outcome_v1($1, $2, $3, $4, $5::text[], $6::text[], $7)',
      [work, 'PROPOSED', 'x', 'forged meaning', ['forged'], [], 'forged']), ['42501'], null);
  }
  await asRole('anon');
  await rejected(() => q('SELECT * FROM public.read_public_semantic_work_input_v1($1)', [work]), ['42501']);

  // S06 nothing to adopt yet.
  assert.deepEqual(await commitWork(f.mohamed, work), { outcome: 'PENDING', interpretation_id: null, interpretation_revision: null }, 'S06');

  // S07 a malformed interpreter answer is refused and records nothing.
  const malformed = [
    ['CONSISTENT', PROPOSAL.lens, null, null, null, null],
    ['PROPOSED', 'Upper.Case', PROPOSAL.meaning, PROPOSAL.primary, PROPOSAL.secondary, PROPOSAL.explanation],
    ['PROPOSED', PROPOSAL.lens, 'two\nlines', PROPOSAL.primary, PROPOSAL.secondary, PROPOSAL.explanation],
    ['PROPOSED', PROPOSAL.lens, 'x'.repeat(121), PROPOSAL.primary, PROPOSAL.secondary, PROPOSAL.explanation],
    ['PROPOSED', PROPOSAL.lens, PROPOSAL.meaning, ['a', 'b', 'c', 'd'], PROPOSAL.secondary, PROPOSAL.explanation],
    ['PROPOSED', PROPOSAL.lens, PROPOSAL.meaning, [], PROPOSAL.secondary, PROPOSAL.explanation],
    ['PROPOSED', PROPOSAL.lens, PROPOSAL.meaning, ['fear', 'Fear'], PROPOSAL.secondary, PROPOSAL.explanation],
    ['PROPOSED', PROPOSAL.lens, PROPOSAL.meaning, ['fear'], ['fear'], PROPOSAL.explanation],
    ['PROPOSED', PROPOSAL.lens, `near ${randomUUID()}`, PROPOSAL.primary, PROPOSAL.secondary, PROPOSAL.explanation],
    ['PROPOSED', PROPOSAL.lens, PROPOSAL.meaning, PROPOSAL.primary, PROPOSAL.secondary, null],
    ['PROPOSED', PROPOSAL.lens, PROPOSAL.meaning, PROPOSAL.primary, PROPOSAL.secondary, 'y'.repeat(281)],
    ['NOT_SUPPORTED', null, null, null, null, null],
  ];
  for (const [outcome, lens, meaning, primary, secondary, explanation] of malformed) {
    await asRole('service_role');
    await rejected(() => q('SELECT * FROM public.record_public_semantic_work_outcome_v1($1, $2, $3, $4, $5::text[], $6::text[], $7)',
      [work, outcome, lens, meaning, primary, secondary, explanation]), ['22023'], /PUBLIC_SEMANTIC_OUTPUT_INVALID/u);
  }
  assert.equal(await semanticCount('semantic_work_outcomes', f.exp), 0, 'S07 and nothing was recorded');

  // S08 an answer that copies the package text is not an interpretation.
  const quote = f.packageTexts[0].length >= 32 ? f.packageTexts[0] : `${f.packageTexts[0]} ${f.packageTexts[1]}`;
  assert.equal(await record(work, 'PROPOSED', PROPOSAL.lens, quote.slice(0, 120).trim(), PROPOSAL.primary, PROPOSAL.secondary, PROPOSAL.explanation),
    quote.length >= 32 ? 'COPIES_PACKAGE' : 'RECORDED', 'S08');
  assert.equal(await semanticCount('semantic_work_outcomes', f.exp), 0, 'S08 a copying answer records nothing');

  // S09 the interpreter's answer: first answer wins.
  assert.equal(await record(work, 'PROPOSED', PROPOSAL.lens, PROPOSAL.meaning, PROPOSAL.primary, PROPOSAL.secondary, PROPOSAL.explanation), 'RECORDED');
  assert.equal(await record(work, 'PROPOSED', PROPOSAL.lens, PROPOSAL.meaning, PROPOSAL.primary, PROPOSAL.secondary, PROPOSAL.explanation), 'ALREADY_RECORDED');
  assert.equal(await record(work, 'PROPOSED', 'other', 'Another meaning entirely', ['other'], [], 'Other.'), 'STALE', 'S09 never a second answer');
  assert.deepEqual(await input(work), [], 'S09 an answered work is served no more input');
  assert.equal((await requestProposal(f.mohamed, randomUUID(), f.exp)).outcome, 'WORK_STAGED',
    'S09 a new request adopts the staged answer instead of paying for another');

  // S10 only the requester adopts it — as revision 1, INITIAL_INTERPRETATION, through the frozen primitive.
  assert.deepEqual(await commitWork(f.hadir, work), { outcome: 'UNAVAILABLE', interpretation_id: null, interpretation_revision: null },
    'S10 another human cannot adopt this work');
  const committed = await commitWork(f.mohamed, work);
  assert.equal(committed.outcome, 'PROPOSED');
  assert.equal(committed.interpretation_revision, 1);
  assert.deepEqual(await commitWork(f.mohamed, work), { ...committed, outcome: 'ALREADY_COMMITTED' }, 'S10 an equivalent retry');
  const [revision1] = await placements(f.version);
  assert.deepEqual([revision1.id, revision1.placement_revision, revision1.placement_basis, revision1.lens_key, revision1.semantic_label, revision1.recorded_by_user_id],
    [committed.interpretation_id, 1, 'INITIAL_INTERPRETATION', PROPOSAL.lens, PROPOSAL.meaning, f.mohamed],
    'S10 QANDEEL\'s proposal is the frozen INITIAL_INTERPRETATION of the exact version');
  assert.deepEqual(await requestProposal(f.mohamed, randomUUID(), f.exp), { outcome: 'ALREADY_INTERPRETED', work_id: null }, 'S10');

  // S11 the controller's review: QANDEEL's proposal, awaiting review.
  const [awaiting] = await review(f.mohamed, f.exp);
  assert.deepEqual([awaiting.semantic_state, awaiting.interpretation_id, awaiting.interpretation_revision, awaiting.interpretation_origin,
    awaiting.meaning, awaiting.primary_themes, awaiting.secondary_themes, awaiting.explanation, awaiting.review_decision, awaiting.semantically_ready],
  ['AWAITING_REVIEW', committed.interpretation_id, 1, 'QANDEEL_PROPOSAL', PROPOSAL.meaning, PROPOSAL.primary, PROPOSAL.secondary,
    PROPOSAL.explanation, null, false], 'S11');
  assert.equal((await readiness(f.exp)).reason, 'AWAITING_REVIEW', 'S11 a proposal nobody reviewed is not ready');

  // S12 accept binds the exact revision seen.
  assert.equal(await accept(f.mohamed, randomUUID(), f.exp, randomUUID()), 'STALE', 'S12 not the current revision');
  assert.equal(await accept(f.hadir, randomUUID(), f.exp, committed.interpretation_id), 'UNAVAILABLE', 'S12 not the controller');
  assert.equal(await accept(f.mohamed, randomUUID(), f.draft, committed.interpretation_id), 'NOT_READY_FOR_REVIEW', 'S12 another Experience');
  assert.equal(await semanticCount('semantic_reviews', f.exp), 0);
  assert.equal(await accept(f.mohamed, randomUUID(), f.exp, committed.interpretation_id), 'ACCEPTED');
  assert.equal(await accept(f.mohamed, randomUUID(), f.exp, committed.interpretation_id), 'ALREADY_ACCEPTED');
  const [accepted] = await review(f.mohamed, f.exp);
  assert.deepEqual([accepted.semantic_state, accepted.review_decision, accepted.semantically_ready], ['REVIEWED', 'ACCEPTED', true], 'S12');
  assert.deepEqual(await readiness(f.exp), { readiness: 'SEMANTICALLY_READY', reason: null, experience_version_id: f.version,
    interpretation_id: committed.interpretation_id, interpretation_revision: 1 }, 'S12 ready for the exact version and revision');

  // S13 a correction: the publisher's own words, never the map.
  const valid = ['A parent afraid of losing work', ['parenthood', 'fear'], ['work']];
  const invalid = [
    ['', ['fear'], []], ['x'.repeat(121), ['fear'], []], ['two\nlines', ['fear'], []], [` ${valid[0]}`, ['fear'], []],
    [`next to ${randomUUID()}`, ['fear'], []], [valid[0], [], []], [valid[0], ['a', 'b', 'c', 'd'], []],
    [valid[0], ['fear', 'FEAR'], []], [valid[0], ['fear'], ['fear']], [valid[0], ['fear'], ['a', 'b', 'c', 'd']],
    [valid[0], ['t'.repeat(41)], []], [valid[0], [null], []],
  ];
  for (const [meaning, primary, secondary] of invalid) {
    await as(f.mohamed);
    await rejected(() => q('SELECT * FROM public.request_own_public_semantic_correction_v1($1, $2, $3, $4, $5::text[], $6::text[])',
      [randomUUID(), f.exp, committed.interpretation_id, meaning, primary, secondary]), ['22023'], /PUBLIC_SEMANTIC_COMMAND_INVALID/u);
  }
  await as(f.mohamed);
  await rejected(() => q('SELECT * FROM public.request_own_public_semantic_correction_v1($1, $2, $3, $4, $5::text[], $6::text[], $7, $8)',
    [randomUUID(), f.exp, committed.interpretation_id, valid[0], valid[1], valid[2], 0.25, 0.75]), ['42883'], null);
  await rejected(() => q('SELECT * FROM public.accept_own_public_semantic_proposal_v1($1, $2, $3, $4)',
    [randomUUID(), f.exp, committed.interpretation_id, true]), ['42883'], null);
  assert.equal((await requestCorrection(f.mohamed, randomUUID(), f.exp, randomUUID(), ...valid)).outcome, 'STALE', 'S13 not the current revision');
  assert.equal((await requestCorrection(f.hadir, randomUUID(), f.exp, committed.interpretation_id, ...valid)).outcome, 'UNAVAILABLE', 'S13 not the controller');
  assert.equal((await requestCorrection(f.mohamed, randomUUID(), f.exp, committed.interpretation_id, PROPOSAL.meaning, PROPOSAL.primary, PROPOSAL.secondary)).outcome,
    'UNCHANGED', 'S13 identical to the current revision');
  if (quote.length >= 32) {
    assert.equal((await requestCorrection(f.mohamed, randomUUID(), f.exp, committed.interpretation_id, quote.slice(0, 120).trim(), ['fear'], [])).outcome,
      'QUOTES_CONTENT', 'S13 a correction is a meaning, not a copy of the text');
  }
  assert.equal(await semanticCount('semantic_work', f.exp), 1, 'S13 no refused correction wrote anything');

  // S13a QANDEEL finds the correction unsupported by the package: nothing is written.
  const unsupported = await requestCorrection(f.mohamed, randomUUID(), f.exp, committed.interpretation_id, 'A story about sailing', ['sailing'], []);
  assert.equal(unsupported.outcome, 'WORK_OPEN');
  const correctionInput = await input(unsupported.work_id);
  assert.deepEqual([correctionInput.length, correctionInput[0].work_kind, correctionInput[0].correction_meaning, correctionInput[0].correction_primary_themes],
    [f.packageTexts.length, 'CORRECTION', 'A story about sailing', ['sailing']], 'S13a QANDEEL assesses the publisher\'s words against the same package');
  await asRole('service_role');
  await rejected(() => q('SELECT * FROM public.record_public_semantic_work_outcome_v1($1, $2, $3, $4, $5::text[], $6::text[], $7)',
    [unsupported.work_id, 'PROPOSED', PROPOSAL.lens, PROPOSAL.meaning, PROPOSAL.primary, PROPOSAL.secondary, PROPOSAL.explanation]), ['22023'], null);
  assert.equal(await record(unsupported.work_id, 'NOT_SUPPORTED', null, null, null, null, null), 'RECORDED');
  assert.deepEqual(await commitWork(f.mohamed, unsupported.work_id), { outcome: 'NOT_SUPPORTED', interpretation_id: null, interpretation_revision: null });
  assert.equal((await placements(f.version)).length, 1, 'S13a an unsupported correction writes no revision');
  assert.equal((await readiness(f.exp)).readiness, 'SEMANTICALLY_READY', 'S13a and the reviewed proposal stays ready');

  // S13b a CONSISTENT correction is the next revision; QANDEEL — not the publisher — assigns its lens key.
  const correctionCommand = randomUUID();
  const correction = await requestCorrection(f.mohamed, correctionCommand, f.exp, committed.interpretation_id, ...valid);
  assert.equal(correction.outcome, 'WORK_OPEN');
  assert.deepEqual(await requestCorrection(f.mohamed, correctionCommand, f.exp, committed.interpretation_id, ...valid), correction, 'S13b retry');
  await as(f.mohamed);
  await rejected(() => q('SELECT * FROM public.request_own_public_semantic_correction_v1($1, $2, $3, $4, $5::text[], $6::text[])',
    [correctionCommand, f.exp, committed.interpretation_id, 'A different meaning', ['other'], []]), ['23505'], /COMMAND_ID_CONFLICT/u);
  assert.equal(await record(correction.work_id, 'CONSISTENT', 'parenthood.fear', null, null, null, null), 'RECORDED');
  const corrected = await commitWork(f.mohamed, correction.work_id);
  assert.deepEqual([corrected.outcome, corrected.interpretation_revision], ['CORRECTED', 2], 'S13b');
  const history = await placements(f.version);
  assert.deepEqual(history.map((p) => [p.placement_revision, p.placement_basis, p.lens_key, p.semantic_label]), [
    [1, 'INITIAL_INTERPRETATION', PROPOSAL.lens, PROPOSAL.meaning],
    [2, 'PUBLISHER_CORRECTION', 'parenthood.fear', valid[0]],
  ], 'S13b append-only: revision 1 is untouched, the correction is revision 2');
  const [afterCorrection] = await review(f.mohamed, f.exp);
  assert.deepEqual([afterCorrection.semantic_state, afterCorrection.interpretation_origin, afterCorrection.meaning, afterCorrection.primary_themes,
    afterCorrection.secondary_themes, afterCorrection.explanation, afterCorrection.review_decision, afterCorrection.semantically_ready],
  ['REVIEWED', 'PUBLISHER_CORRECTION', valid[0], valid[1], valid[2], null, 'CORRECTED', true], 'S13b the correction is reviewed by its making');
  assert.equal((await readiness(f.exp)).interpretation_revision, 2, 'S13b readiness follows the current revision');
  assert.equal(await accept(f.mohamed, randomUUID(), f.exp, corrected.interpretation_id), 'ALREADY_REVIEWED');
  assert.equal(await accept(f.mohamed, randomUUID(), f.exp, committed.interpretation_id), 'STALE', 'S13b the old revision is no longer acceptable');
  assert.equal((await commitWork(f.mohamed, unsupported.work_id)).outcome, 'STALE', 'S13b an older answered work cannot land now');

  // S14 two corrections of the same revision: the second is stale.
  const racer1 = await requestCorrection(f.mohamed, randomUUID(), f.exp, corrected.interpretation_id, 'Worry for children and work', ['family'], []);
  const racer2 = await requestCorrection(f.mohamed, randomUUID(), f.exp, corrected.interpretation_id, 'Holding a family together', ['family', 'work'], []);
  assert.equal(await record(racer1.work_id, 'CONSISTENT', 'family', null, null, null, null), 'RECORDED');
  assert.equal(await record(racer2.work_id, 'CONSISTENT', 'family.work', null, null, null, null), 'RECORDED');
  assert.equal((await commitWork(f.mohamed, racer1.work_id)).outcome, 'CORRECTED');
  assert.equal((await commitWork(f.mohamed, racer2.work_id)).outcome, 'STALE', 'S14 a correction of a superseded revision never lands');
  assert.equal(await record(racer2.work_id, 'CONSISTENT', 'family.work', null, null, null, null), 'ALREADY_RECORDED');

  // S15 append-only, for the table owner too; the frozen placement too.
  await asRole('postgres');
  for (const statement of [
    `UPDATE ${SCHEMA}.semantic_work SET correction_meaning = 'rewritten' WHERE id = '${correction.work_id}'`,
    `DELETE FROM ${SCHEMA}.semantic_work_outcomes WHERE work_id = '${work}'`,
    `UPDATE ${SCHEMA}.semantic_interpretations SET primary_themes = '{other}' WHERE placement_id = '${committed.interpretation_id}'`,
    `DELETE FROM ${SCHEMA}.semantic_reviews WHERE placement_id = '${committed.interpretation_id}'`,
    `UPDATE ${T.PLACEMENTS} SET semantic_label = 'rewritten' WHERE id = '${committed.interpretation_id}'`,
  ]) {
    await rejected(() => q(statement), ['55000'], null);
  }

  // S16 version binding: nothing a semantic act did moved a version, package, approval, controller or lifecycle.
  assert.deepEqual(await untouchable(f), before, 'S16 the version, package, approvals, controllers and lifecycle are untouched');
  assert.equal(before[0].current_lifecycle, 'READY_FOR_REVIEW', 'S16 the lifecycle stays READY_FOR_REVIEW');

  // S17 a revision this boundary did not commit is never "reviewed" — not even one written by the raw frozen primitive.
  await q('SAVEPOINT raw');
  await asRole('postgres'); await actAs(f.mohamed);
  await rt.recordPlacement(randomUUID(), randomUUID(), f.exp, f.version, 'raw.lens', 'A raw frozen revision');
  await asRole('postgres');
  assert.deepEqual([(await readiness(f.exp)).readiness, (await readiness(f.exp)).reason], ['NOT_READY', 'UNREVIEWED_REVISION'], 'S17');
  assert.deepEqual((await review(f.mohamed, f.exp)).map((r) => [r.semantic_state, r.meaning]), [['UNAVAILABLE', null]], 'S17 nothing unvetted is shown');
  await q('ROLLBACK TO SAVEPOINT raw'); await q('RELEASE SAVEPOINT raw');

  // S18 a successor version carries nothing over: the reviewed interpretation binds the exact version it was made for.
  await q('SAVEPOINT successor');
  await asRole('postgres');
  const successorManifest = randomUUID();
  const successorVersion = randomUUID();
  await q(`INSERT INTO ${T.MANIFESTS} (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
             intended_publication_action, target_audience_class, authority_readiness, prepared_authority_snapshot_version, item_count, created_at)
           SELECT $1, experience_id, true, publisher_public_identity_ref, publisher_user_id, intended_publication_action,
                  target_audience_class, authority_readiness, prepared_authority_snapshot_version, item_count, clock_timestamp()
             FROM ${T.MANIFESTS} WHERE id = $2`, [successorManifest, f.manifest]);
  await q(`INSERT INTO ${T.VERSIONS} (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
           VALUES ($1, $2, $3, 2, clock_timestamp())`, [successorVersion, f.exp, successorManifest]);
  await q(`UPDATE ${T.EXPERIENCES} SET current_experience_version_id = $2 WHERE id = $1`, [f.exp, successorVersion]);
  const successor = await readiness(f.exp);
  assert.equal(successor.readiness, 'NOT_READY', 'S18 the previous version\'s reviewed interpretation does not make its successor ready');
  assert.equal(successor.interpretation_id, null);
  assert.deepEqual((await review(f.mohamed, f.exp)).map((r) => [r.semantic_state, r.meaning]), [['UNAVAILABLE', null]], 'S18');
  assert.ok(['STALE', 'UNAVAILABLE'].includes((await commitWork(f.mohamed, racer2.work_id)).outcome), 'S18 an old version\'s work never lands');
  assert.equal(await accept(f.mohamed, randomUUID(), f.exp, corrected.interpretation_id), 'UNAVAILABLE');
  await q('ROLLBACK TO SAVEPOINT successor'); await q('RELEASE SAVEPOINT successor');
  return { current: (await readiness(f.exp)).interpretation_id };
}

// --------------------------------------------------------------------------------------------------------- 5. erasure
async function verifyErasure(f, flow) {
  await q('SAVEPOINT erasure');
  // A correction is mid-flight when the owner deletes: opened, input served, not yet answered.
  const pending = await requestCorrection(f.mohamed, randomUUID(), f.exp, flow.current, 'Keeping going for the family', ['family'], ['resolve']);
  assert.equal(pending.outcome, 'WORK_OPEN');
  assert.ok((await input(pending.work_id)).length > 0);
  // Hadir deletes her own words: ASSURE-F05 erases their Public copy in the same transaction.
  await asRole('postgres'); await actAs(f.hadir);
  assert.equal((await rt.deleteMaterial(randomUUID(), f.world, f.hadirMaterial, randomUUID()))[0].outcome, 'MATERIAL_DELETED');
  // E01 the review shows nothing of the interpretation, and readiness fails closed.
  assert.deepEqual((await review(f.mohamed, f.exp)).map((r) => [r.semantic_state, r.meaning, r.primary_themes, r.explanation, r.semantically_ready]),
    [['UNAVAILABLE', null, null, null, false]], 'E01 no meaning is presented over a package that is no longer whole');
  assert.deepEqual([(await readiness(f.exp)).readiness, (await readiness(f.exp)).reason], ['NOT_READY', 'PACKAGE_UNAVAILABLE'], 'E01');
  // E02 the in-flight work fails closed at every step; nothing is rebuilt.
  assert.deepEqual(await input(pending.work_id), [], 'E02 no input over an erased package');
  assert.equal(await record(pending.work_id, 'CONSISTENT', 'family', null, null, null, null), 'UNAVAILABLE', 'E02 no outcome');
  assert.equal((await commitWork(f.mohamed, pending.work_id)).outcome, 'UNAVAILABLE', 'E02 no commit');
  assert.equal(await accept(f.mohamed, randomUUID(), f.exp, flow.current), 'UNAVAILABLE', 'E02 no accept');
  assert.deepEqual(await requestProposal(f.mohamed, randomUUID(), f.exp), { outcome: 'UNAVAILABLE', work_id: null }, 'E02 no new proposal');
  assert.equal((await requestCorrection(f.mohamed, randomUUID(), f.exp, flow.current, 'Another meaning', ['other'], [])).outcome, 'UNAVAILABLE');
  assert.equal(await semanticCount('semantic_work_outcomes', f.exp), (await semanticCount('semantic_work', f.exp)) - 1,
    'E02 the in-flight work stayed unanswered');
  await q('ROLLBACK TO SAVEPOINT erasure'); await q('RELEASE SAVEPOINT erasure');
}

// ------------------------------------------------------------------------------------------------------- 7. launch
async function verifyLaunchClosure(f) {
  await asRole('postgres');
  assert.equal((await readiness(f.exp)).readiness, 'SEMANTICALLY_READY');
  const [clearance] = await rt.prerequisites(f.exp, f.manifest);
  assert.equal(clearance.clearance, 'NOT_EVALUATED', 'L01 a semantically ready Experience still meets a NOT_EVALUATED seam');
  for (const role of APP_ROLES) {
    await q('SAVEPOINT l'); await asRole(role, f.mohamed);
    await rejected(() => q('SELECT * FROM public.publish_public_experience_v1($1, $2, $3)', [randomUUID(), f.exp, f.version]), ['42501']);
    await rejected(() => q('SELECT * FROM public.record_public_experience_semantic_placement_v1($1, $2, $3, $4, $5, $6)',
      [randomUUID(), randomUUID(), f.exp, f.version, 'x', 'y']), ['42501']);
    await q('ROLLBACK TO SAVEPOINT l'); await q('RELEASE SAVEPOINT l');
  }
  await asRole('postgres');
  assert.equal((await rt.visibility(f.exp))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE', 'L02 READY_FOR_REVIEW stays non-public');
  await asRole('service_role');
  assert.deepEqual(await rt.resolvePlacement(f.exp, f.reader), [], 'L02 the interpretation is served to no viewer');
  assert.deepEqual(await rt.resolvePlacement(f.exp, f.mohamed), [], 'L02 not even its own publisher, through the public resolver');
  await asRole('postgres');
  assert.deepEqual(await rt.serving(f.exp, f.reader), []);
  const [{ published }] = await rows(`SELECT count(*)::int published FROM ${T.EXPERIENCES} e JOIN ${T.CONTROLLERS} c ON c.experience_id = e.id
    WHERE c.controller_user_id = ANY($1::uuid[]) AND e.current_lifecycle IN ('PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD')`, [[f.mohamed, f.hadir]]);
  assert.equal(published, 0, 'L03 no S5-03A path produced a PUBLISHED Experience');
  assert.equal(Number((await rows(`SELECT count(*) n FROM ${T.PROJECTION} WHERE experience_id = $1`, [f.exp]))[0].n), 0,
    'L03 no search / lens projection exists for it');
}

// --------------------------------------------------------------------------------------------------- 6. concurrency
async function verifyConcurrency() {
  const f = rt.newFixture();
  f.own = randomUUID();
  const experiences = [];
  await asRole('postgres');
  await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [[f.mohamed, f.hadir, f.stranger, f.reader]]);
  await rt.provisionWorld(f, f.world);
  await rt.commitMaterial(f.world, f.own, 'HUMAN_TEXT', f.mohamed, `S5-03A race ${randomUUID()}`,
    'EXACT_HUMAN_APPROVER_SET', 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.mohamed], f.mohamed);
  const { q2, actAs2, close } = await rt.openSecondary();
  const asAuth2 = async (uid) => { await actAs2(uid); await q2('SET ROLE authenticated'); };
  try {
    const exp = await startDraft(f.mohamed);
    experiences.push(exp);
    assert.equal(await prepareOwn(f.mohamed, exp, NONE, [f.world], [f.own]), 'PREPARED');
    const [{ m }] = await own(`SELECT v.package_manifest_version_id m FROM ${T.EXPERIENCES} e JOIN ${T.VERSIONS} v ON v.id = e.current_experience_version_id WHERE e.id = $1`, [exp]);
    assert.equal(await approveOwn(f.mohamed, m), 'APPROVED');
    assert.equal(await readyOwn(f.mohamed, exp), 'READY_FOR_REVIEW');
    const proposal = await requestProposal(f.mohamed, randomUUID(), exp);
    assert.equal(await record(proposal.work_id, 'PROPOSED', PROPOSAL.lens, PROPOSAL.meaning, PROPOSAL.primary, PROPOSAL.secondary, PROPOSAL.explanation), 'RECORDED');
    const { interpretation_id: base } = await commitWork(f.mohamed, proposal.work_id);
    const a = await requestCorrection(f.mohamed, randomUUID(), exp, base, 'Fear held quietly at home', ['fear'], []);
    const b = await requestCorrection(f.mohamed, randomUUID(), exp, base, 'Uncertain work and a family', ['work', 'family'], []);
    assert.equal(await record(a.work_id, 'CONSISTENT', 'fear', null, null, null, null), 'RECORDED');
    assert.equal(await record(b.work_id, 'CONSISTENT', 'work.family', null, null, null, null), 'RECORDED');
    await asRole('postgres');
    // C01 two commits of two corrections of the SAME revision, on two connections: one lands, the other is STALE.
    await q('BEGIN'); await q('SET LOCAL ROLE authenticated');
    await q("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: f.mohamed, role: 'authenticated' })]);
    const [won] = (await q('SELECT * FROM public.commit_own_public_semantic_work_v1($1)', [a.work_id])).rows;
    assert.equal(won.outcome, 'CORRECTED');
    await asAuth2(f.mohamed);
    const losing = q2('SELECT * FROM public.commit_own_public_semantic_work_v1($1)', [b.work_id]);
    assert.equal(await rt.stillPending(losing), true, 'C01 the second commit queues on the Experience lock');
    await q('COMMIT');
    assert.equal((await losing).rows[0].outcome, 'STALE', 'C01 the correction of a superseded revision never lands');
    await asRole('postgres');
    assert.deepEqual((await placements((await own(`SELECT current_experience_version_id v FROM ${T.EXPERIENCES} WHERE id = $1`, [exp]))[0].v))
      .map((p) => p.placement_revision), [1, 2], 'C01 exactly one correction is history');
  } finally {
    await close();
    await asRole('postgres');
    await q('ROLLBACK').catch(() => undefined);
    const [{ ids }] = await rows(`SELECT coalesce(array_agg(e.id), '{}') ids FROM ${T.EXPERIENCES} e
      JOIN ${T.CONTROLLERS} c ON c.experience_id = e.id WHERE c.controller_user_id = ANY($1::uuid[])`, [[f.mohamed, f.stranger, f.hadir]]);
    const all = [...new Set([...experiences, ...ids])];
    // The S5-03A rows bind placements and versions restrictively, so they come off first, inside one transaction.
    await q('BEGIN');
    try {
      for (const relation of RELATIONS) await q(`ALTER TABLE ${SCHEMA}.${relation} DISABLE TRIGGER ${relation}_immutable`);
      await q(`DELETE FROM ${SCHEMA}.semantic_reviews WHERE placement_id IN (SELECT placement_id FROM ${SCHEMA}.semantic_interpretations WHERE experience_id = ANY($1::uuid[]))`, [all]);
      await q(`DELETE FROM ${SCHEMA}.semantic_interpretations WHERE experience_id = ANY($1::uuid[])`, [all]);
      await q(`DELETE FROM ${SCHEMA}.semantic_work_outcomes WHERE work_id IN (SELECT id FROM ${SCHEMA}.semantic_work WHERE experience_id = ANY($1::uuid[]))`, [all]);
      await q(`DELETE FROM ${SCHEMA}.semantic_work WHERE experience_id = ANY($1::uuid[])`, [all]);
      for (const relation of RELATIONS) await q(`ALTER TABLE ${SCHEMA}.${relation} ENABLE TRIGGER ${relation}_immutable`);
      await q('COMMIT');
    } catch (error) {
      await q('ROLLBACK');
      throw error;
    }
    await rt.removeCommittedFixtures({ experiences: all, humans: [f.mohamed, f.hadir, f.stranger, f.reader], world: f.world });
  }
}

await runVerifier('0144', async (stage) => {
  await rt.client.connect();
  stage('boundary');
  await verifyBoundary();
  await q('BEGIN');
  try {
    stage('fixture');
    const f = await fixture();
    stage('flow and version binding');
    const flow = await verifyFlow(f);
    stage('erasure');
    await verifyErasure(f, flow);
    stage('launch closure');
    await verifyLaunchClosure(f);
  } finally {
    await q('ROLLBACK');
  }
  stage('concurrency');
  await verifyConcurrency();
  console.log('Verified migration 0144: the interpreter sees exactly the public package of the exact version and nothing else; only the exact controller reviews; QANDEEL\'s proposal enters only through the server channel and becomes revision 1 (INITIAL_INTERPRETATION) on the requester\'s own commit; accept binds the exact revision; a correction is the publisher\'s words, checked by QANDEEL against the package, and becomes the next revision with QANDEEL\'s lens key; history is append-only; a malformed or copying answer is refused; readiness is derived for the exact reviewed current revision of the exact version and package and fails closed after an erasure, on a raw revision and on a successor; a concurrent correction of a superseded revision is STALE; nothing can publish and the seam answers NOT_EVALUATED.');
}, async () => { await rt.client.end().catch(() => undefined); });
