// S8A-05 CP1 — Public World «Write your topic»: the real-PostgreSQL verifier for migration 0179.
//
// It proves, against a fully migrated database, with synthetic humans only:
//   1. the boundary: every S8A-05 function is a pinned postgres-owned `public_compose_private` SECURITY DEFINER or a
//      pinned `public` INVOKER wrapper; `authenticated` executes exactly the ten commands and nothing else; the discard
//      primitive and every helper are executable by no application role; every relation is RLS-on, privilege-free,
//      postgres-owned; the drafts cascade from the account and are registered ACCOUNT_CASCADE; the freeze seam answers
//      NOT_EVALUATED; exactly five functions move a Public lifecycle; the package guard still holds every relation;
//      PUBLIC_AUTHORED is the fourth source class with the empty source shape;
//   2. private drafts (production posture, freeze CLOSED): save / read / list / delete by the owner only; a draft saved
//      in one session is restored in another session of the same account; no other human can read, change, preview,
//      freeze or delete it, and the relation itself is unreadable; the 100 / 5,000 bounds, control characters and the
//      section catalogue are enforced; compare-and-set refuses a stale save and answers an equivalent retry; the
//      preview is the public form of exactly the saved revision with the derived display and the privacy notes; NO
//      Public Identity, Experience or package exists after any of it; the closed freeze writes nothing; deleting a
//      draft leaves its words nowhere; Export My Data carries the drafts; a drafts-only account deletes freely;
//   3. the controlled path (the freeze seam replaced inside this rolled-back transaction, then restored byte for
//      byte): a freeze prepares exactly the previewed title and text as ONE PUBLIC_AUTHORED item whose only approver is
//      its author, provisions exactly one identity, reaches READY_FOR_REVIEW and makes the draft read-only; a retry
//      answers the first result; the section changes without moving the placement, the interpretation or the version;
//      published through the simulated CW2-08 seam, viewers get the human title and section — never QANDEEL's meaning
//      as the title — and title search finds it; a never-published discard erases every Public byte, both digests, the
//      title and every derived semantic text at one instant, moves the lifecycle to ABSENT with its event, and returns
//      the draft to editing; a published topic is not discardable here; the guard refuses every unproven erasure;
//   4. launch closure: the freeze seam and the CW2-08 seam answer NOT_EVALUATED again; nothing committed.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';
import { APP_ROLES, SEAM, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, rejected } = rt;
const own = async (text, values = []) => { await asRole('postgres'); return rows(text, values); };
const as = async (uid) => asRole('authenticated', uid);
const first = async (text, values = []) => (await rows(text, values))[0];
/** A unique letters-only marker: a UUID's digits could read as a phone number to the privacy notes. */
const marker = () => randomUUID().replace(/[^a-f]/gu, '').slice(0, 12);
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const SCHEMA = 'public_compose_private';
const FREEZE_SEAM = 'public_compose_private.resolve_topic_freeze_clearance_v1()';
const DISCARD = 'public.discard_never_published_public_experience_v1(uuid, uuid)';
const COMMANDS = {
  list_own_topic_drafts_v1: '',
  read_own_topic_draft_v1: 'uuid',
  save_own_topic_draft_v1: 'uuid, bigint, text, text, text',
  delete_own_topic_draft_v1: 'uuid, uuid',
  preview_own_topic_draft_v1: 'uuid',
  freeze_own_topic_draft_v1: 'uuid, uuid, bigint',
  discard_own_unpublished_topic_v1: 'uuid, uuid',
  set_own_topic_section_v1: 'uuid, uuid, text',
  read_public_topic_headers_v1: 'uuid[]',
  read_public_topic_title_matches_v1: 'text',
  read_public_section_topic_matches_v1: 'text, text',
};
const INTERNAL = ['reject_compose_history_mutation_v1', 'resolve_topic_freeze_clearance_v1', 'derive_compose_identity_v1',
  'account_deletion_pending_v1', 'public_form_v1', 'draft_readiness_v1', 'privacy_notes_v1', 'prepare_authored_package_v1'];
const RELATIONS = ['sections', 'topic_drafts', 'discard_commands', 'version_titles', 'experience_sections',
  'experience_section_events'];
const SECTIONS = ['love', 'marriage', 'family', 'parenting', 'people', 'work_money', 'study_future', 'inner_self',
  'health_body', 'loss_crisis', 'faith_meaning', 'life_changes', 'open'];
const PACKAGE_RELATIONS = [T.MANIFESTS, T.ITEMS, T.BODIES, T.PROVENANCE, T.ITEM_AUTHORITY, T.REQUIRED, T.APPROVALS];
const WORLD = ['-4611686018427387904', '-4611686018427387904', '4611686018427387903', '4611686018427387903'];

// ---- the owner commands, as the human's own application role
const save = async (uid, draft, revision, title, body, section = null) => {
  await as(uid);
  return first('SELECT * FROM public.save_own_topic_draft_v1($1, $2, $3, $4, $5)', [draft, revision, title, body, section]);
};
const readDraft = async (uid, draft) => { await as(uid); return rows('SELECT * FROM public.read_own_topic_draft_v1($1)', [draft]); };
const listDrafts = async (uid) => { await as(uid); return rows('SELECT * FROM public.list_own_topic_drafts_v1()'); };
const deleteDraft = async (uid, draft) => { await as(uid); return (await first('SELECT * FROM public.delete_own_topic_draft_v1($1, $2)', [randomUUID(), draft])).outcome; };
const preview = async (uid, draft) => { await as(uid); return rows('SELECT * FROM public.preview_own_topic_draft_v1($1)', [draft]); };
const freeze = async (uid, draft, revision, command = randomUUID()) => {
  await as(uid);
  return first('SELECT * FROM public.freeze_own_topic_draft_v1($1, $2, $3)', [command, draft, revision]);
};
const discard = async (uid, experience, command = randomUUID()) => {
  await as(uid);
  return (await first('SELECT * FROM public.discard_own_unpublished_topic_v1($1, $2)', [command, experience])).outcome;
};
const setSection = async (uid, experience, section) => {
  await as(uid);
  return first('SELECT * FROM public.set_own_topic_section_v1($1, $2, $3)', [randomUUID(), experience, section]);
};
const headers = async (uid, experiences) => { await as(uid); return rows('SELECT * FROM public.read_public_topic_headers_v1($1::uuid[])', [experiences]); };
const titleMatches = async (uid, query) => { await as(uid); return rows('SELECT * FROM public.read_public_topic_title_matches_v1($1)', [query]); };
const sectionMatches = async (uid, query, section) => {
  await as(uid);
  return rows('SELECT * FROM public.read_public_section_topic_matches_v1($1, $2)', [query, section]).then((r) => r.map((m) => m.experience_id));
};
/** The unchanged 0145 search over the same field (meaning, themes and every public text body). */
const fieldSearch = async (uid, query) => {
  await as(uid);
  return rows('SELECT * FROM public.search_public_semantic_field_v1($1)', [query]).then((r) => r.map((m) => m.experience_id));
};

// ---- the S5-03A / S5-03B paths an authored topic reuses unchanged
const requestProposal = async (uid, experience) => { await as(uid); return first('SELECT * FROM public.request_own_public_semantic_proposal_v1($1, $2)', [randomUUID(), experience]); };
const recordOutcome = async (work, lens, meaning, primary) => {
  await asRole('service_role');
  return (await first('SELECT * FROM public.record_public_semantic_work_outcome_v1($1, $2, $3, $4, $5::text[], $6::text[], $7)',
    [work, 'PROPOSED', lens, meaning, primary, [], 'The words describe the situation the author wrote about.'])).outcome;
};
const commitWork = async (uid, work) => { await as(uid); return first('SELECT * FROM public.commit_own_public_semantic_work_v1($1)', [work]); };
const acceptSemantic = async (uid, experience, interpretation) => {
  await as(uid); return (await first('SELECT * FROM public.accept_own_public_semantic_proposal_v1($1, $2, $3)', [randomUUID(), experience, interpretation])).outcome;
};
const requestPlace = async (uid, experience) => { await as(uid); return first('SELECT * FROM public.request_own_public_spatial_placement_v1($1, $2)', [randomUUID(), experience]); };
const commitPlace = async (request, x, y) => {
  await asRole('service_role');
  return (await first('SELECT * FROM public.commit_public_spatial_placement_v1($1, $2, $3, $4)', [request, 'test.layout.v1', x, y])).outcome;
};
const field = async (uid) => { await as(uid); return rows('SELECT * FROM public.read_public_semantic_field_v1($1, $2, $3, $4)', WORLD); };
const panel = async (uid, experience) => { await as(uid); return rows('SELECT * FROM public.read_public_semantic_experience_v1($1)', [experience]); };

const identitiesOf = async (uid) => own(`SELECT public_identity_ref FROM ${T.IDENTITIES} WHERE user_id = $1`, [uid]);
const footprint = async (uid) => (await own(`SELECT
    (SELECT count(*) FROM ${T.IDENTITIES} WHERE user_id = $1)::int identities,
    (SELECT count(*) FROM ${T.CONTROLLERS} WHERE controller_user_id = $1)::int experiences,
    (SELECT count(*) FROM ${T.MANIFESTS} WHERE publisher_user_id = $1)::int manifests,
    (SELECT count(*) FROM public.public_identity_commands WHERE actor_user_id = $1)::int identity_commands`, [uid]))[0];
const packageOf = async (experience) => own(`SELECT it.package_item_id, it.item_ordinal, it.derivative_classification, it.public_body_form,
    it.public_body_digest, it.content_state, it.content_erased_at, p.source_class, p.personal_owner_user_id, p.shared_world_id,
    p.captured_source_digest, p.captured_digest_erased_at, b.public_text_body, a.resolution_state, a.required_approver_count
  FROM ${T.ITEMS} it JOIN ${T.PROVENANCE} p ON p.package_item_id = it.package_item_id
  JOIN ${T.ITEM_AUTHORITY} a ON a.package_item_id = it.package_item_id
  LEFT JOIN ${T.BODIES} b ON b.package_item_id = it.package_item_id
  WHERE it.experience_id = $1 ORDER BY it.item_ordinal`, [experience]);
const experienceOf = async (experience) => (await own(`SELECT e.current_lifecycle, e.current_experience_version_id v,
    ve.package_manifest_version_id m FROM ${T.EXPERIENCES} e LEFT JOIN ${T.VERSIONS} ve ON ve.id = e.current_experience_version_id
   WHERE e.id = $1`, [experience]))[0];

/** Every text-like column of every application relation, asked for the exact bytes and their SHA-256 hex digest. */
async function censusOf(text) {
  await asRole('postgres');
  const hex = sha(text);
  const columns = await rows(`SELECT n.nspname s, c.relname t, a.attname col, format_type(a.atttypid, a.atttypmod) ty
      FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped
       AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       AND a.atttypid IN ('text'::regtype, 'varchar'::regtype, 'bpchar'::regtype, 'bytea'::regtype, 'jsonb'::regtype, 'json'::regtype)`);
  const hits = [];
  for (const { s, t, col, ty } of columns) {
    const ident = `"${s}"."${t}"`;
    const sql = ty === 'bytea'
      ? `SELECT count(*) n FROM ${ident} WHERE "${col}" = decode($1, 'hex')`
      : `SELECT count(*) n FROM ${ident} WHERE strpos("${col}"::text, $2) > 0 OR strpos("${col}"::text, $1) > 0`;
    const [{ n }] = await rows(sql, ty === 'bytea' ? [hex] : [hex, text]);
    if (Number(n) > 0) hits.push(`${s}.${t}.${col}`);
  }
  return hits.sort();
}

// --------------------------------------------------------------------------------------------------------- 1. boundary
async function verifyBoundary() {
  await asRole('postgres');
  const fns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) owner,
      pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(fns.map((f) => f.proname).sort(), [...Object.keys(COMMANDS), ...INTERNAL].sort(),
    'B01 the private schema holds exactly the S8A-05 CP1 functions, one overload each');
  for (const f of fns) {
    assert.equal(f.prosecdef, true, `B01 ${f.proname} is a definer`);
    assert.equal(f.owner, 'postgres', `B01 ${f.proname} is postgres-owned`);
    assert.deepEqual(f.proconfig, ['search_path=""'], `B01 ${f.proname} pins an empty search_path`);
  }
  for (const [name, args] of Object.entries(COMMANDS)) {
    const wrapper = await rt.functionPosture(`public.${name}(${args})`);
    assert.equal(wrapper.secdef, false, `B02 public.${name} is an INVOKER wrapper`);
    assert.deepEqual(wrapper.config, ['search_path=""']);
    assert.ok(wrapper.prosrc.includes(`${SCHEMA}.${name}(`), `B02 public.${name} is one call into its definer`);
    for (const p of await rt.inputParameters(`public.${name}(${args})`)) {
      assert.doesNotMatch(p, /user|account|actor|owner|ref|label|approver|authority|audience|identity|publisher|controller|clear/u,
        `B02 ${name} accepts no ${p}: the human is auth.uid()`);
    }
  }
  const executable = await rows(`SELECT r.rolname, n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT unnest($2::text[]) rolname) r
    WHERE EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
      AND (n.nspname = $3 OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`, [Object.keys(COMMANDS), APP_ROLES, SCHEMA]);
  assert.deepEqual(executable.map((e) => `${e.rolname} ${e.fn}`).sort(),
    Object.keys(COMMANDS).flatMap((n) => [`authenticated public.${n}`, `authenticated ${SCHEMA}.${n}`]).sort(),
    'B03 authenticated runs the eleven commands only; anon and the server channel run nothing; no helper is reachable');
  for (const role of ['public', ...APP_ROLES]) {
    assert.equal(await rt.canExecute(role, DISCARD), false, `B03 ${role} must not execute the discard primitive`);
    assert.equal(await rt.canExecute(role, FREEZE_SEAM), false, `B03 ${role} must not execute the freeze seam`);
  }
  // B04 relations: RLS on, no policy, no privilege for any application role, postgres-owned.
  for (const rel of RELATIONS) {
    const [c] = await rows(`SELECT c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner,
        (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) policies
      FROM pg_class c WHERE c.oid = $1::regclass`, [`${SCHEMA}.${rel}`]);
    assert.deepEqual(c, { rls: true, owner: 'postgres', policies: 0 }, `B04 ${rel} is RLS-on, policy-free, postgres-owned`);
    for (const role of APP_ROLES) {
      const [{ any }] = await rows(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT')
        OR has_table_privilege($1, $2, 'UPDATE') OR has_table_privilege($1, $2, 'DELETE') AS any`, [role, `${SCHEMA}.${rel}`]);
      assert.equal(any, false, `B04 ${role} holds no privilege on ${rel}`);
    }
  }
  assert.deepEqual((await rows(`SELECT section_key FROM ${SCHEMA}.sections ORDER BY display_order`)).map((r) => r.section_key), SECTIONS,
    'B05 the PO-approved catalogue: 12 sections + open');
  // B06 deletion: the drafts cascade from the account, are registered, and nothing references them restrictively.
  const [fk] = await rows(`SELECT c.confdeltype FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.contype = 'f'
    AND c.confrelid = 'public.users'::regclass`, [`${SCHEMA}.topic_drafts`]);
  assert.equal(fk.confdeltype, 'c', 'B06 topic_drafts → public.users ON DELETE CASCADE');
  assert.deepEqual(await rows(`SELECT coverage FROM account_erasure_private.coverage_registry WHERE relation = $1`, [`${SCHEMA}.topic_drafts`]),
    [{ coverage: 'ACCOUNT_CASCADE' }], 'B06 registered ACCOUNT_CASCADE');
  assert.deepEqual(await rows(`SELECT c.conrelid::regclass::text rel FROM pg_constraint c WHERE c.contype = 'f'
    AND c.confrelid = $1::regclass`, [`${SCHEMA}.topic_drafts`]), [], 'B06 nothing references a draft');
  const users = await rows(`SELECT DISTINCT c.conrelid::regclass::text rel FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass AND n.nspname = $1`, [SCHEMA]);
  assert.deepEqual(users.map((u) => u.rel), [`${SCHEMA}.topic_drafts`], 'B06 no other S8A-05 relation names an account');
  // B07 the freeze is closed, and the CW2-08 seam with it.
  const freezeSeam = await rt.functionPosture(FREEZE_SEAM);
  assert.ok(freezeSeam.prosrc.includes('NOT_EVALUATED') && !freezeSeam.prosrc.includes('CLEARED'), 'B07 the freeze seam answers NOT_EVALUATED');
  const cw208 = await rt.functionPosture(SEAM);
  assert.ok(cw208.prosrc.includes('NOT_EVALUATED') && !cw208.prosrc.includes("'CLEARED'"), 'B07 the CW2-08 seam still answers NOT_EVALUATED');
  const freezeBody = (await rt.functionPosture(`${SCHEMA}.freeze_own_topic_draft_v1(uuid, uuid, bigint)`)).prosrc;
  assert.ok(freezeBody.indexOf('resolve_topic_freeze_clearance_v1') < freezeBody.indexOf('account_deletion_pending_v1')
    && freezeBody.indexOf('resolve_topic_freeze_clearance_v1') < freezeBody.indexOf('FROM public_compose_private.topic_drafts'),
  'B07 the freeze asks the seam before it locks, reads or writes anything');
  // B08 nothing S8A-05 owns reaches publication, the CW2-08 seam or placement.
  const bodies = await rows(`SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = $1 OR (n.nspname = 'public' AND p.proname = ANY($2::text[]))`,
  [SCHEMA, [...Object.keys(COMMANDS), 'discard_never_published_public_experience_v1']]);
  for (const b of bodies) {
    assert.doesNotMatch(b.prosrc, /publish_public_experience_v1|resolve_public_publication_prerequisites_v1|commit_public_spatial_placement_v1|request_own_public_spatial_placement_v1|request_own_public_semantic_proposal_v1|'PUBLISHED'/u,
      `B08 ${b.proname} reaches nothing beyond READY_FOR_REVIEW`);
  }
  // B09 exactly five lifecycle movers, each writing the immutable event; the guard still holds every package relation.
  const writers = await rows(`SELECT pr.proname, pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
        AND (pr.prosrc ~ 'UPDATE public\\.public_experiences e\\s+SET current_lifecycle = '''
          OR pr.prosrc ~ 'INSERT INTO public\\.public_experiences\\s+\\(id, public_world_singleton') ORDER BY 1`);
  assert.deepEqual(writers.map((w) => w.proname), ['apply_public_experience_disappearance_v1', 'commit_public_experience_ready_for_review_v1',
    'create_public_experience_draft_v1', 'discard_never_published_public_experience_v1', 'publish_public_experience_v1'],
  'B09 exactly five functions move a Public Experience lifecycle');
  for (const w of writers) assert.match(w.prosrc, /INSERT INTO public\.public_experience_lifecycle_events/u, `B09 ${w.proname} writes the event`);
  for (const table of PACKAGE_RELATIONS) {
    const [tg] = await rows(`SELECT tg.tgenabled FROM pg_trigger tg WHERE tg.tgrelid = $1::regclass AND NOT tg.tgisinternal
      AND tg.tgfoid = 'public.reject_publication_package_mutation_v1'::regproc`, [table]);
    assert.equal(tg?.tgenabled, 'O', `B09 ${table} keeps the enabled append-only guard`);
  }
  // B10 the fourth source class and its empty source shape.
  const [shape] = await rows(`SELECT pg_get_constraintdef(c.oid) d FROM pg_constraint c WHERE c.conrelid = $1::regclass
    AND c.conname = 'publication_package_item_provenance_class_check'`, [T.PROVENANCE]);
  for (const cls of ['MY_WORLD', 'SHARED_WORLD', 'REPLAY_ARTIFACT', 'PUBLIC_AUTHORED']) assert.ok(shape.d.includes(cls), `B10 ${cls}`);
}

// ---------------------------------------------------------------------------------- 2a. another session of the account
async function verifyAnotherSession() {
  const human = randomUUID();
  const draft = randomUUID();
  const title = 'رحلة البحث عن عمل جديد';
  const body = `كتبت هذا في جلسة وأكمله في أخرى ${marker()}`;
  await asRole('postgres');
  await q('INSERT INTO auth.users(id) VALUES ($1)', [human]);
  const second = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await q('BEGIN');
    assert.deepEqual(await save(human, draft, 0, title, body, 'work_money'), { outcome: 'CREATED', draft_revision: '1' }, 'S01 saved');
    await q('COMMIT');
    await second.connect();
    await second.query('BEGIN');
    await second.query('SET LOCAL ROLE authenticated');
    await second.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: human, role: 'authenticated' })]);
    const { rows: restored } = await second.query('SELECT * FROM public.read_own_topic_draft_v1($1)', [draft]);
    assert.equal(restored.length, 1, 'S01 another session of the same account restores the draft');
    assert.deepEqual([restored[0].title, restored[0].body, restored[0].section_key, restored[0].draft_state, String(restored[0].draft_revision)],
      [title, body, 'work_money', 'EDITING', '1'], 'S01 exactly as saved');
    const { rows: listed } = await second.query('SELECT draft_id FROM public.list_own_topic_drafts_v1()');
    assert.deepEqual(listed.map((r) => r.draft_id), [draft], 'S01 and lists it');
    await second.query('ROLLBACK');
  } finally {
    await q('ROLLBACK').catch(() => undefined);
    await second.end().catch(() => undefined);
    await asRole('postgres');
    // A drafts-only account is deleted by its account row alone: the drafts cascade, nothing blocks.
    await q('DELETE FROM public.users WHERE id = $1', [human]);
    await q('DELETE FROM auth.users WHERE id = $1', [human]);
  }
  assert.equal((await own(`SELECT count(*)::int n FROM ${SCHEMA}.topic_drafts WHERE user_id = $1`, [human]))[0].n, 0,
    'S02 deleting the account removed its drafts with it (no blocker)');
}

// ------------------------------------------------------------------------------------------------ 2b. private drafts
async function verifyDrafts(f) {
  const before = await footprint(f.mohamed);
  assert.deepEqual(before, { identities: 0, experiences: 0, manifests: 0, identity_commands: 0 }, 'fixture: Mohamed has no Public footprint');

  // D01 create, read, list, save under compare-and-set.
  f.d1 = randomUUID();
  assert.deepEqual(await save(f.mohamed, f.d1, 0, 'مسودة', '', null), { outcome: 'CREATED', draft_revision: '1' }, 'D01 an empty start is a draft');
  assert.deepEqual(await save(f.mohamed, f.d1, 1, f.title1, f.body1, 'family'), { outcome: 'SAVED', draft_revision: '2' }, 'D01 saved');
  assert.deepEqual(await save(f.mohamed, f.d1, 1, f.title1, f.body1, 'family'), { outcome: 'SAVED', draft_revision: '2' },
    'D01 an equivalent retry answers the revision it produced');
  assert.deepEqual(await save(f.mohamed, f.d1, 1, f.title1, `${f.body1} …`, 'family'), { outcome: 'STALE', draft_revision: '2' },
    'D01 a different save against the old revision is STALE and changes nothing');
  assert.deepEqual(await save(f.mohamed, f.d1, 2, f.title1, f.body1, 'family'), { outcome: 'SAVED', draft_revision: '2' }, 'D01 unchanged');
  const [d1] = await readDraft(f.mohamed, f.d1);
  assert.deepEqual([d1.title, d1.body, d1.section_key, d1.draft_state, d1.experience_id], [f.title1, f.body1, 'family', 'EDITING', null]);
  assert.deepEqual((await listDrafts(f.mohamed)).map((r) => [r.draft_id, r.title, r.text_length]), [[f.d1, f.title1, [...f.body1].length]],
    'D01 my drafts: titles and lengths, newest first');
  assert.equal(await save(f.mohamed, randomUUID(), 3, 'x', 'y').then((r) => r.outcome), 'NOT_FOUND', 'D01 no revision without a draft');

  // D02 the bounds (100 / 5,000 characters, Arabic characters counted as characters), control characters, sections.
  const d2 = randomUUID();
  assert.equal((await save(f.mohamed, d2, 0, 'ع'.repeat(100), 'ب'.repeat(5000), 'open')).outcome, 'CREATED', 'D02 100 / 5,000 fit');
  for (const [title, body, section] of [['ع'.repeat(101), '', null], ['', 'ب'.repeat(5001), null], ['a\nb', '', null],
    ['', 'a\u0007b', null], ['', '', 'politics'], ['', '', 'LOVE']]) {
    assert.equal((await save(f.mohamed, randomUUID(), 0, title, body, section)).outcome, 'INVALID', `D02 refused: ${title.length}/${body.length}/${section}`);
  }
  assert.equal((await save(f.mohamed, randomUUID(), 0, 'سطر', 'سطر أول\n\tوسطر ثانٍ', null)).outcome, 'CREATED', 'D02 line breaks and tabs are text');
  await asRole('postgres');
  await q(`UPDATE ${SCHEMA}.sections SET retired_at = now() WHERE section_key = 'people'`);
  assert.equal((await save(f.mohamed, randomUUID(), 0, '', '', 'people')).outcome, 'INVALID', 'D02 a retired section is not offered');
  await asRole('postgres');
  await q(`UPDATE ${SCHEMA}.sections SET retired_at = NULL WHERE section_key = 'people'`);

  // D03 no other human reaches my draft, by any command; the relation itself answers nobody.
  assert.deepEqual(await readDraft(f.hadir, f.d1), [], 'D03 Hadir reads nothing');
  assert.deepEqual(await preview(f.hadir, f.d1), [], 'D03 Hadir previews nothing');
  assert.deepEqual((await listDrafts(f.hadir)).length, 0, 'D03 Hadir lists nothing of mine');
  assert.equal((await save(f.hadir, f.d1, 2, 'سرقة', 'سرقة', null)).outcome, 'NOT_FOUND', 'D03 Hadir cannot change it (one neutral answer)');
  assert.equal((await save(f.hadir, f.d1, 0, 'سرقة', 'سرقة', null)).outcome, 'NOT_FOUND', 'D03 nor claim its id');
  assert.equal(await deleteDraft(f.hadir, f.d1), 'NOT_FOUND', 'D03 nor delete it');
  assert.equal((await readDraft(f.mohamed, f.d1))[0].body, f.body1, 'D03 untouched');
  await as(f.hadir);
  await rejected(() => q(`SELECT * FROM ${SCHEMA}.topic_drafts`), ['42501']);
  await asRole('anon');
  await rejected(() => q('SELECT * FROM public.list_own_topic_drafts_v1()'), ['42501']);
  await asRole('service_role');
  await rejected(() => q('SELECT * FROM public.read_own_topic_draft_v1($1)', [f.d1]), ['42501']);

  // D04 the preview: the public form of exactly this revision, the derived display, the deterministic notes.
  const [p1] = await preview(f.mohamed, f.d1);
  assert.deepEqual([String(p1.draft_revision), p1.readiness, p1.title, p1.body, p1.section_key, p1.publisher_label_mode, p1.publisher_display_label],
    ['2', 'READY', f.title1.trim(), f.body1.trim(), 'family', 'PSEUDONYM', f.mohamedPublicId], 'D04 the public form, under the CURRENT Public ID');
  assert.deepEqual(p1.privacy_notes, [], 'D04 nothing to note');
  const d3 = randomUUID();
  await save(f.mohamed, d3, 0, 'قصير', `اتصلوا بي على ٠١٠ ١٢٣٤ ٥٦٧٨ أو mail@example.com أو www.example.com — أنا ${f.mohamedFirstName}`, null);
  const [p3] = await preview(f.mohamed, d3);
  assert.equal(p3.readiness, 'TITLE_TOO_SHORT', 'D04 a title under 8 characters is not ready');
  assert.deepEqual(p3.privacy_notes, ['CONTACT_NUMBER', 'EMAIL_ADDRESS', 'LINK', 'OWN_NAME'], 'D04 every note, Arabic-Indic digits too');
  await save(f.mohamed, d3, 1, 'عنوان كافٍ للموضوع', '   ', 'love');
  assert.equal((await preview(f.mohamed, d3))[0].readiness, 'TEXT_REQUIRED', 'D04 whitespace is not text');
  await save(f.mohamed, d3, 2, 'عنوان كافٍ للموضوع', 'نص', null);
  assert.equal((await preview(f.mohamed, d3))[0].readiness, 'SECTION_REQUIRED', 'D04 a section is chosen');

  // D05 THE FREEZE IS CLOSED: answered before anything else, and nothing is written.
  const counts = async () => (await own(`SELECT (SELECT count(*) FROM ${T.EXPERIENCES})::int e, (SELECT count(*) FROM ${T.IDENTITIES})::int i,
    (SELECT count(*) FROM ${T.MANIFESTS})::int m, (SELECT count(*) FROM ${SCHEMA}.version_titles)::int t`))[0];
  const was = await counts();
  assert.deepEqual(await freeze(f.mohamed, f.d1, 2), { outcome: 'PUBLICATION_NOT_OPEN', experience_id: null, current_lifecycle: null },
    'D05 production: preparing for publication is not open');
  assert.deepEqual(await freeze(f.hadir, f.d1, 2), { outcome: 'PUBLICATION_NOT_OPEN', experience_id: null, current_lifecycle: null },
    'D05 the same answer for anyone (no oracle)');
  assert.deepEqual(await counts(), was, 'D05 no Experience, identity, package or title was written');
  assert.equal((await readDraft(f.mohamed, f.d1))[0].draft_state, 'EDITING', 'D05 the draft is still editable');

  // D06 NO PUBLIC IDENTITY BY DRAFTING: after every command above, Mohamed has no Public footprint at all.
  assert.deepEqual(await footprint(f.mohamed), before, 'D06 drafting, previewing, listing and the closed freeze provision nothing');
  assert.deepEqual(await footprint(f.hadir), { identities: 0, experiences: 0, manifests: 0, identity_commands: 0 }, 'D06 nor for Hadir');

  // D07 Export My Data carries my drafts, as written, and nothing of anyone else's.
  await asRole('postgres');
  const [{ x }] = await rows('SELECT personal_data_private.build_personal_export_v1($1) x', [f.mohamed]);
  assert.deepEqual(Object.keys(x).sort(), ['account', 'conversations', 'format', 'interactionPreferences', 'matchingAndIntroductions',
    'memory', 'notYetIncluded', 'preparedAt', 'publicTopicDrafts', 'understanding'], 'D07 one added section');
  assert.deepEqual(x.notYetIncluded, ['shared', 'public', 'replay'], 'D07 the not-yet-included list is unchanged');
  const exported = x.publicTopicDrafts.find((d) => d.text === f.body1);
  assert.deepEqual([exported.title, exported.section, exported.state], [f.title1, 'family', 'editing'], 'D07 the draft, as written');
  assert.equal(x.publicTopicDrafts.length, (await own(`SELECT count(*)::int n FROM ${SCHEMA}.topic_drafts WHERE user_id = $1`, [f.mohamed]))[0].n);
  const [{ y }] = await rows('SELECT personal_data_private.build_personal_export_v1($1) y', [f.hadir]);
  assert.deepEqual(y.publicTopicDrafts, [], 'D07 Hadir exports none of mine');

  // D08 deleting a draft leaves its words nowhere.
  const secret = `سرّ لم يُنشر ${marker()}`;
  const d4 = randomUUID();
  await save(f.mohamed, d4, 0, 'مسودة سأحذفها', secret, 'inner_self');
  assert.deepEqual(await censusOf(secret), [`${SCHEMA}.topic_drafts.body`], 'D08 before: only in the draft');
  assert.equal(await deleteDraft(f.mohamed, d4), 'DELETED', 'D08 deleted');
  assert.equal(await deleteDraft(f.mohamed, d4), 'NOT_FOUND', 'D08 a retry finds nothing');
  assert.deepEqual(await censusOf(secret), [], 'D08 after: the words and their digest are nowhere');
  assert.deepEqual(await footprint(f.mohamed), before, 'D08 still no Public footprint');
}

// ------------------------------------------------------------------------- 3. the controlled verification environment
async function openFreeze() {
  await asRole('postgres');
  const [seam] = await rows('SELECT pg_get_functiondef(p.oid) d, p.prosrc FROM pg_proc p WHERE p.oid = $1::regprocedure', [FREEZE_SEAM]);
  await q(`CREATE OR REPLACE FUNCTION ${FREEZE_SEAM.replace('()', '')}()
           RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $probe$
             SELECT 'CLEARED'::text -- S8A-05 VERIFIER PROBE: inside a rolled-back verifier transaction only
           $probe$`);
  return seam;
}
async function closeFreeze(seam) {
  await asRole('postgres');
  await q(seam.d);
  const [{ prosrc }] = await rows('SELECT p.prosrc FROM pg_proc p WHERE p.oid = $1::regprocedure', [FREEZE_SEAM]);
  assert.equal(prosrc, seam.prosrc, 'the production freeze seam is restored byte for byte');
  for (const role of ['public', ...APP_ROLES]) assert.equal(await rt.canExecute(role, FREEZE_SEAM), false, `${role} still cannot execute it`);
}

async function verifyControlled(f, cw208) {
  const frozen = await openFreeze();
  try {
    // F01 the freeze: exactly the previewed revision becomes ONE authored item, READY_FOR_REVIEW, one identity.
    const [shown] = await preview(f.mohamed, f.d1);
    const freezeCommand = randomUUID();
    const prepared = await freeze(f.mohamed, f.d1, 2, freezeCommand);
    assert.equal(prepared.outcome, 'PREPARED', 'F01 prepared');
    assert.equal(prepared.current_lifecycle, 'READY_FOR_REVIEW', 'F01 READY_FOR_REVIEW, never PUBLISHED');
    f.t1 = prepared.experience_id;
    assert.equal((await identitiesOf(f.mohamed)).length, 1, 'F01 the freeze provisions exactly one Public Identity');
    const pkg = await packageOf(f.t1);
    assert.equal(pkg.length, 1, 'F01 one item');
    assert.deepEqual([pkg[0].source_class, pkg[0].derivative_classification, pkg[0].public_body_form, pkg[0].content_state,
      pkg[0].personal_owner_user_id, pkg[0].shared_world_id, pkg[0].resolution_state, pkg[0].required_approver_count],
    ['PUBLIC_AUTHORED', 'SOURCE_CONTENT_BEARING_DERIVATIVE', 'PUBLIC_TEXT', 'CONTENT_PRESENT', null, null, 'RESOLVED_EXACT_HUMAN_REQUIREMENT', 1],
    'F01 a PUBLIC_AUTHORED item with no source identifier, exact human requirement');
    assert.equal(pkg[0].public_text_body, shown.body, 'F01 THE PREVIEW EQUALS THE PREPARED TEXT, byte for byte');
    assert.equal(pkg[0].public_body_digest, `sha256:${sha(shown.body)}`, 'F01 and its digest');
    const ex1 = await experienceOf(f.t1);
    f.t1v = ex1.v; f.t1m = ex1.m;
    assert.deepEqual(await own(`SELECT title FROM ${SCHEMA}.version_titles WHERE experience_version_id = $1`, [f.t1v]), [{ title: shown.title }],
      'F01 THE PREVIEW EQUALS THE PREPARED TITLE, bound to the version');
    assert.deepEqual(await own(`SELECT section_key, section_revision::int r FROM ${SCHEMA}.experience_sections WHERE experience_id = $1`, [f.t1]),
      [{ section_key: 'family', r: 1 }], 'F01 the chosen section, on the Experience');
    await asRole('postgres');
    const [authority] = await rt.deriveAuthority(f.t1m);
    assert.deepEqual(authority.required_approvers, [f.mohamed], 'F01 the author is the one rightsholder');
    const [ownerRef] = await own(`SELECT m.publisher_user_id FROM ${T.MANIFESTS} m WHERE m.id = $1`, [f.t1m]);
    assert.equal(ownerRef.publisher_user_id, f.mohamed, 'F01 the author publishes under their own identity');
    const [d1] = await readDraft(f.mohamed, f.d1);
    assert.deepEqual([d1.draft_state, d1.experience_id, d1.experience_lifecycle], ['PREPARED', f.t1, 'READY_FOR_REVIEW']);
    assert.equal((await save(f.mohamed, f.d1, 2, 'تعديل بعد التجهيز', f.body1, 'family')).outcome, 'PREPARED', 'F01 read-only while prepared');
    // F02 a retry answers the first result; a stale revision prepares nothing.
    assert.deepEqual(await freeze(f.mohamed, f.d1, 2, freezeCommand), { outcome: 'ALREADY_PREPARED', experience_id: f.t1, current_lifecycle: 'READY_FOR_REVIEW' });
    const d5 = randomUUID();
    await save(f.mohamed, d5, 0, f.title2, f.body2, 'loss_crisis');
    assert.equal((await freeze(f.mohamed, d5, 7)).outcome, 'STALE', 'F02 STALE');
    assert.equal((await freeze(f.hadir, d5, 1)).outcome, 'NOT_FOUND', 'F02 another human cannot freeze my draft');
    assert.equal((await identitiesOf(f.hadir)).length, 0, 'F02 and gains no identity trying');

    // F03 semantic understanding and placement reuse S5-03A / S5-03B unchanged; the section never moves anything.
    const work = (await requestProposal(f.mohamed, f.t1)).work_id;
    assert.equal(await recordOutcome(work, 'family.care', f.meaning1, ['family']), 'RECORDED');
    const committed = await commitWork(f.mohamed, work);
    assert.equal(await acceptSemantic(f.mohamed, f.t1, committed.interpretation_id), 'ACCEPTED');
    const opened = await requestPlace(f.mohamed, f.t1);
    assert.equal(await commitPlace(opened.request_id, '1200000', '2200000'), 'PLACED');
    const snapshot = async () => own(`SELECT (SELECT array_agg(sp.id::text || '@' || sp.world_x::text || ',' || sp.world_y::text ORDER BY sp.id)
        FROM public_spatial_private.spatial_placements sp WHERE sp.experience_id = $1) places,
      (SELECT array_agg(i.placement_id::text ORDER BY i.placement_id) FROM public_semantic_private.semantic_interpretations i
        WHERE i.experience_id = $1) interpretations,
      (SELECT current_experience_version_id FROM ${T.EXPERIENCES} WHERE id = $1) version,
      (SELECT experience_revision FROM ${T.EXPERIENCES} WHERE id = $1) revision`, [f.t1]);
    const beforeSection = await snapshot();
    assert.deepEqual(await setSection(f.mohamed, f.t1, 'parenting'), { outcome: 'CHANGED', section_revision: '2' }, 'F03 changed');
    assert.deepEqual(await setSection(f.mohamed, f.t1, 'parenting'), { outcome: 'UNCHANGED', section_revision: '2' }, 'F03 idempotent');
    assert.deepEqual((await setSection(f.hadir, f.t1, 'love')).outcome, 'UNAVAILABLE', 'F03 only the controller');
    assert.deepEqual((await setSection(f.mohamed, f.t1, 'politics')).outcome, 'INVALID', 'F03 only the catalogue');
    assert.deepEqual(await snapshot(), beforeSection, 'F03 THE SECTION DOES NOT CHANGE THE LOCATION: same place, interpretation, version, revision');
    assert.deepEqual((await own(`SELECT section_key, section_revision::int r FROM ${SCHEMA}.experience_section_events
      WHERE experience_id = $1 ORDER BY section_revision`, [f.t1])).map((e) => [e.section_key, e.r]), [['family', 1], ['parenting', 2]],
    'F03 the change is recorded');

    // F04 published only through the simulated CW2-08 seam: viewers get the human title and section, not the meaning.
    assert.deepEqual(await headers(f.reader, [f.t1]), [], 'F04 nothing before publication');
    assert.deepEqual(await titleMatches(f.reader, 'المساعدة'), [], 'F04');
    assert.deepEqual(await sectionMatches(f.reader, f.bodyWord, 'parenting'), [], 'F04 nothing in its section before publication');
    assert.deepEqual(await fieldSearch(f.reader, f.bodyWord), [], 'F04 nor in the field search');
    await asRole('postgres');
    const [published] = await rt.publishCleared(cw208, f.mohamed, randomUUID(), f.t1, f.t1v);
    assert.equal(published.outcome, 'PUBLISHED', 'fixture: an authored topic publishes through the unchanged frozen path');
    const place = (await field(f.reader)).find((r) => r.experience_id === f.t1);
    assert.deepEqual([place.world_x, place.world_y, place.meaning], ['1200000', '2200000', f.meaning1], 'F04 placed where it was placed');
    assert.deepEqual(await headers(f.reader, [f.t1, randomUUID()]), [{ experience_id: f.t1, title: shown.title, section_key: 'parenting' }],
      'F04 THE HUMAN TITLE AND SECTION of the served topic, nothing for an unknown id');
    assert.notEqual(shown.title, f.meaning1, 'F04 the title is the author\'s words, not QANDEEL\'s meaning');
    assert.equal((await panel(f.reader, f.t1))[0].publisher_display_label, f.mohamedPublicId, 'F04 the panel keeps the CURRENT Public ID');
    assert.deepEqual((await titleMatches(f.reader, 'المساعدة')).map((r) => [r.experience_id, r.world_x, r.world_y]), [[f.t1, '1200000', '2200000']],
      'F04 title search finds it with its place');
    assert.deepEqual(await headers(f.stranger, [f.t1]).then((r) => r.length), 1, 'F04 any admitted viewer');
    // F04 SEARCH INSIDE THE TOPIC'S TEXT: a word only the author's text holds finds it, in the field and in its section.
    assert.deepEqual(await fieldSearch(f.reader, f.bodyWord), [f.t1], 'F04 THE BODY IS SEARCHABLE: the unchanged 0145 search reads the authored text');
    assert.deepEqual(await sectionMatches(f.reader, f.bodyWord, 'parenting'), [f.t1], 'F04 SEARCH INSIDE ITS SECTION finds the body word');
    assert.deepEqual(await sectionMatches(f.reader, 'المساعدة', 'parenting'), [f.t1], 'F04 and the title word');
    assert.deepEqual(await sectionMatches(f.reader, f.bodyWord, 'family'), [], 'F04 another section holds nothing of it');
    assert.deepEqual(await sectionMatches(f.stranger, f.bodyWord, 'parenting'), [f.t1], 'F04 any admitted viewer');
    await as(f.reader);
    for (const bad of [['x', 'politics'], ['x', null], [' x', 'family'], ['', 'family']]) {
      await rejected(() => q('SELECT * FROM public.read_public_section_topic_matches_v1($1, $2)', bad), ['22023']);
    }
    await asRole('anon');
    await rejected(() => q('SELECT * FROM public.read_public_section_topic_matches_v1($1, $2)', ['x', 'family']), ['42501']);
    await asRole('anon');
    await rejected(() => q('SELECT * FROM public.read_public_topic_headers_v1($1::uuid[])', [[f.t1]]), ['42501']);
    await as(f.reader);
    await rejected(() => q('SELECT * FROM public.read_public_topic_headers_v1($1::uuid[])', [Array.from({ length: 401 }, () => randomUUID())]), ['22023']);
    const moved = await setSection(f.mohamed, f.t1, 'family');
    assert.equal(moved.outcome, 'CHANGED');
    assert.deepEqual([(await field(f.reader)).find((r) => r.experience_id === f.t1)].map((r) => [r.world_x, r.world_y]), [['1200000', '2200000']],
      'F04 a section change after publication moves nothing either');
    assert.deepEqual([await sectionMatches(f.reader, f.bodyWord, 'family'), await sectionMatches(f.reader, f.bodyWord, 'parenting')], [[f.t1], []],
      'F04 the section view follows the section at once');
    assert.equal(await discard(f.mohamed, f.t1), 'NOT_DISCARDABLE', 'F04 a published topic is never discarded here (0099 removal owns it)');

    // F05 DISCARD a never-published topic: every Public byte, both digests, the title and derived semantics, one instant.
    const prepared2 = await freeze(f.mohamed, d5, 1);
    assert.equal(prepared2.outcome, 'PREPARED');
    f.t2 = prepared2.experience_id;
    const work2 = (await requestProposal(f.mohamed, f.t2)).work_id;
    assert.equal(await recordOutcome(work2, 'loss.grief', f.meaning2, ['grief']), 'RECORDED');
    await commitWork(f.mohamed, work2);
    assert.ok((await censusOf(f.body2)).includes('public.public_experience_text_derivative_bodies.public_text_body'), 'fixture: the public copy exists');
    assert.equal(await discard(f.hadir, f.t2), 'UNAVAILABLE', 'F05 only the controller');
    const discardCommand = randomUUID();
    assert.equal(await discard(f.mohamed, f.t2, discardCommand), 'DISCARDED', 'F05 discarded');
    assert.equal(await discard(f.mohamed, f.t2), 'ALREADY_DISCARDED', 'F05 a retry answers the first result');
    const after = await packageOf(f.t2);
    const [{ at }] = await own(`SELECT occurred_at at FROM ${SCHEMA}.discard_commands WHERE experience_id = $1`, [f.t2]);
    assert.deepEqual(after.map((i) => [i.content_state, i.public_body_digest, i.captured_source_digest, i.public_text_body]),
      [['ERASED_BY_OWNER', null, null, null]], 'F05 the item is erased: no body, no digest of either kind');
    assert.deepEqual([after[0].content_erased_at, after[0].captured_digest_erased_at], [at, at], 'F05 at the discard instant');
    assert.deepEqual(await own(`SELECT title, title_erased_at FROM ${SCHEMA}.version_titles WHERE experience_id = $1`, [f.t2]),
      [{ title: null, title_erased_at: at }], 'F05 the title is erased at the same instant');
    assert.deepEqual(await own(`SELECT count(*)::int n FROM public_semantic_private.semantic_work_outcomes o
      JOIN public_semantic_private.semantic_work w ON w.id = o.work_id WHERE w.experience_id = $1 AND o.meaning IS NOT NULL`, [f.t2]),
    [{ n: 0 }], 'F05 every semantic text derived from it is erased (0144 trigger)');
    assert.equal((await experienceOf(f.t2)).current_lifecycle, 'ABSENT_FROM_PUBLIC_WORLD', 'F05 DRAFT|READY → ABSENT');
    assert.deepEqual(await own(`SELECT id, from_lifecycle, to_lifecycle, occurred_at FROM ${T.LIFECYCLE} WHERE experience_id = $1
      AND to_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD'`, [f.t2]),
    [{ id: discardCommand, from_lifecycle: 'READY_FOR_REVIEW', to_lifecycle: 'ABSENT_FROM_PUBLIC_WORLD', occurred_at: at }],
    'F05 the immutable lifecycle event, under the command identity');
    const [back] = await readDraft(f.mohamed, d5);
    assert.deepEqual([back.draft_state, back.experience_id, back.body], ['EDITING', null, f.body2], 'F05 the draft returns to editing, the words still mine');
    assert.deepEqual(await censusOf(f.body2), [`${SCHEMA}.topic_drafts.body`], 'F05 the words live only in my private draft');
    assert.deepEqual(await censusOf(f.title2), [`${SCHEMA}.topic_drafts.title`], 'F05 so does the title');
    // F06 deleting a prepared draft discards its topic first, then nothing remains anywhere.
    const reprepared = await freeze(f.mohamed, d5, back.draft_revision);
    assert.equal(reprepared.outcome, 'PREPARED', 'F06 prepared again, as a NEW Experience');
    assert.notEqual(reprepared.experience_id, f.t2);
    assert.equal(await deleteDraft(f.mohamed, d5), 'DELETED', 'F06 deleted');
    assert.equal((await experienceOf(reprepared.experience_id)).current_lifecycle, 'ABSENT_FROM_PUBLIC_WORLD', 'F06 its topic was discarded');
    assert.deepEqual(await censusOf(f.body2), [], 'F06 CANCELLING AND DELETING LEAVES NO TEXT, DIGEST OR REFERENCE ANYWHERE');
    assert.equal((await identitiesOf(f.mohamed)).length, 1, 'F06 still exactly one identity');

    // F07 the guard: an unproven erasure, any other mutation, and a title change are refused.
    await asRole('postgres');
    await rejected(() => q(`UPDATE ${T.PROVENANCE} SET captured_source_digest = NULL, captured_digest_erased_at = now()
      WHERE package_item_id = $1`, [pkg[0].package_item_id]), ['55000'], /PUBLICATION_PACKAGE_IS_IMMUTABLE/u);
    await rejected(() => q(`UPDATE ${T.ITEMS} SET content_state = 'ERASED_BY_OWNER', public_body_digest = NULL, content_erased_at = now()
      WHERE package_item_id = $1`, [pkg[0].package_item_id]), ['55000'], /PUBLICATION_PACKAGE_IS_IMMUTABLE/u);
    await rejected(() => q(`DELETE FROM ${T.BODIES} WHERE package_item_id = $1`, [pkg[0].package_item_id]), ['55000']);
    await rejected(() => q(`UPDATE ${SCHEMA}.version_titles SET title = 'عنوان آخر تمامًا' WHERE experience_version_id = $1`, [f.t1v]), ['55000']);
    await rejected(() => q(`UPDATE ${SCHEMA}.version_titles SET title = NULL, title_erased_at = now() WHERE experience_version_id = $1`, [f.t1v]), ['55000']);
    await rejected(() => q(`DELETE FROM ${SCHEMA}.experience_section_events WHERE experience_id = $1`, [f.t1]), ['55000']);
    await rejected(() => q(`DELETE FROM ${SCHEMA}.discard_commands WHERE experience_id = $1`, [f.t2]), ['55000']);
    // F08 a topic holding a non-authored item (CP1: not discardable here, left to S8A-05 CP2).
    const [{ experience_id: legacy }] = await (async () => { await as(f.mohamed); return rows('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()]); })();
    await as(f.mohamed);
    assert.equal((await first('SELECT * FROM public.prepare_own_public_experience_package_v1($1, $2, $3::uuid[], $4::uuid[], $5::uuid[])',
      [randomUUID(), legacy, [f.userUnit], [], []])).outcome, 'PREPARED');
    // RE-ANCHORED by S8A-05 CP2 (migration 0180, A-2(c) as narrowed by the CP2 controlled amendment): a never-published
    // topic is discarded whatever its item classes; only a Replay artifact stays REPLAY-DIST-01's (verify-0180 F09 proves
    // the erasure of every class).
    assert.equal(await discard(f.mohamed, legacy), 'DISCARDED', 'F08 a MY_WORLD topic is discarded since CP2');
  } catch (error) {
    // The enclosing transaction is aborted and will be rolled back, which restores the seam; report THIS error.
    frozen.failed = true;
    throw error;
  } finally {
    if (!frozen.failed) await closeFreeze(frozen);
  }
  assert.equal((await freeze(f.mohamed, f.d1, 2)).outcome, 'PUBLICATION_NOT_OPEN', 'L01 closed again: the gate answers first');
}

// ---------------------------------------------------------------------------------------------------------- fixture
async function fixture() {
  const f = rt.newFixture();
  await asRole('postgres');
  await rt.provision(f);
  [{ public_id: f.mohamedPublicId }] = await own('SELECT public_id FROM public.users WHERE id = $1', [f.mohamed]);
  // A Name and a Login ID are set together, exactly as sign-up writes them; display stays PSEUDONYM.
  await q("UPDATE public.users SET name = 'Mohsen Salah', login_id = $2 WHERE id = $1", [f.mohamed, `mohsen_${f.mohamed.slice(0, 8)}`]);
  f.mohamedFirstName = 'Mohsen';
  f.title1 = '  كيف تعلمت أن أطلب المساعدة من أهلي  ';
  f.bodyWord = marker();
  f.body1 = `\n كنت أظن أن طلب المساعدة ضعف، حتى جاء يوم لم أستطع فيه وحدي. ${f.bodyWord}\n`;
  f.title2 = `فقدت جدتي هذا الشتاء ${marker()}`;
  f.body2 = `ما زلت أسمع صوتها في المطبخ كل صباح ${marker()}`;
  f.meaning1 = 'Asking family for help after believing it was weakness';
  f.meaning2 = 'Grief for a grandmother that returns each morning';
  assert.equal((await rt.admission(f.reader))[0].admission, 'ADMITTED', 'fixture: an admitted registered viewer');
  return f;
}

await runVerifier('0179', async (stage) => {
  await rt.client.connect();
  stage('boundary');
  await verifyBoundary();
  stage('another session');
  await verifyAnotherSession();
  await q('BEGIN');
  try {
    stage('fixture');
    const cw208 = await rt.captureSeam();
    const f = await fixture();
    stage('private drafts');
    await verifyDrafts(f);
    stage('controlled environment');
    await verifyControlled(f, cw208);
    stage('launch closure');
    const [{ n }] = await own(`SELECT count(*)::int n FROM ${T.EXPERIENCES} WHERE current_lifecycle = 'PUBLISHED'
      AND id NOT IN (SELECT experience_id FROM ${T.PUBLICATION_STATE} s WHERE s.prerequisite_clearance_basis LIKE 'I-05B VERIFIER PROBE%')`);
    assert.equal(n, 0, 'L02 nothing is PUBLISHED except through the in-transaction probe');
  } finally {
    await q('ROLLBACK');
  }
  await asRole('postgres');
  assert.ok((await rt.functionPosture(FREEZE_SEAM)).prosrc.includes('NOT_EVALUATED'), 'L03 after rollback the freeze seam is closed');
  console.log('Verified migration 0179: private topic drafts are the owner\'s alone, restored across sessions, bounded, exported and erased on delete, and provision no Public Identity; preparing for publication stays closed in production; in a controlled environment a freeze prepares exactly the previewed title and text as one PUBLIC_AUTHORED item approved by its author, the section moves nothing, viewers see the human title, and a never-published discard erases every Public byte, digest, title and derived semantic text at one instant.');
}, async () => { await rt.client.end().catch(() => undefined); });
