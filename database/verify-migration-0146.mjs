// S5-03C — Public Explicit Relations + Integrity Closure v1: the real-PostgreSQL verifier for 0146.
//
// It proves, against a fully migrated database:
//   1. the boundary: every S5-03C function is a pinned `public_relation_private` SECURITY DEFINER or a pinned `public`
//      INVOKER wrapper; `authenticated` executes exactly the owner and viewer commands, the server channel NOTHING, anon
//      nothing; no command accepts a viewer, an account, an audience, a visibility, a version, a revision, a region, a
//      distance, a strength, a type or free text; the two relations are private, RLS-enabled, append-only, hold no text
//      beyond three closed vocabularies and reference no account directly, but bind both versions and both S5-03A
//      revisions ON DELETE RESTRICT (QAN-BL-ACCT-01); exactly one function writes a relation (the human request) and
//      exactly one writes an act (the human act recorder);
//   2. SIMILARITY IS NOT A RELATION: two Experiences side by side in the same semantic region have no relation and no
//      line until a human requests one and the other side accepts it;
//   3. the lifecycle: only the source's controller requests; only the target's controller accepts or declines; only the
//      source's side cancels; either side removes an ACTIVE relation; retries are idempotent; a pair holds one current
//      relation; every illegal transition and every direct mutation is refused by the database itself;
//   4. the viewer: a line is served only for an ACTIVE relation whose two bound endpoints are both served now, to an
//      admitted viewer, with the other endpoint's served place — never a pending one, never a count, never an invisible
//      endpoint; relations never move a coordinate;
//   5. integrity: a new current semantic revision, a successor version, a withdrawn approval, an ASSURE-F05 erasure
//      and an owner's removal from the Public World each make the relation non-servable at once, in every read and every
//      command, with no write of S5-03C's own — and nothing carries forward to the new revision or version;
//   6. launch closure: the seam still answers NOT_EVALUATED; no S5-03C path publishes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, NONE, SEAM, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, actAs, asRole, rejected } = rt;
const own = async (text, values = []) => { await asRole('postgres'); return rows(text, values); };
const admission = async (viewer) => { await asRole('postgres'); return rt.admission(viewer); };
const visibility = async (experience) => { await asRole('postgres'); return rt.visibility(experience); };

const SCHEMA = 'public_relation_private';
const SPATIAL = 'public_spatial_private';
const SEMANTIC = 'public_semantic_private';
const OWNER_COMMANDS = {
  read_own_public_relation_experiences_v1: [],
  read_own_public_relations_v1: [],
  request_public_relation_v1: ['p_command_id uuid', 'p_experience_id uuid', 'p_other_experience_id uuid'],
  accept_public_relation_v1: ['p_command_id uuid', 'p_relation_id uuid'],
  decline_public_relation_v1: ['p_command_id uuid', 'p_relation_id uuid'],
  cancel_public_relation_v1: ['p_command_id uuid', 'p_relation_id uuid'],
  remove_public_relation_v1: ['p_command_id uuid', 'p_relation_id uuid'],
};
const VIEWER_COMMANDS = { read_public_semantic_relations_v1: ['p_experience_id uuid'] };
const INTERNAL = ['reject_relation_history_mutation_v1', 'derive_relation_identity_v1', 'derive_relation_life_v1', 'endpoint_is_current_v1',
  'relation_is_current_v1', 'controls_v1', 'lock_endpoints_v1', 'record_act_v1', 'retried_act_v1', 'act_on_public_relation_v1'];
const TABLES = ['explicit_relation_acts', 'explicit_relations'];
const WORLD = ['-4611686018427387904', '-4611686018427387904', '4611686018427387903', '4611686018427387903'];

// ---- the S5-02 / S5-03A / S5-03B Product paths, as each human's own role
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
const commitWork = async (uid, work) => { await as(uid); return first('SELECT * FROM public.commit_own_public_semantic_work_v1($1)', [work]); };
const acceptSemantic = async (uid, experience, interpretation) => {
  await as(uid); return (await first('SELECT * FROM public.accept_own_public_semantic_proposal_v1($1, $2, $3)', [randomUUID(), experience, interpretation])).outcome;
};
const recordOutcome = async (work, outcome, lens, meaning, primary, secondary, explanation) => {
  await asRole('service_role');
  return (await first('SELECT * FROM public.record_public_semantic_work_outcome_v1($1, $2, $3, $4, $5::text[], $6::text[], $7)',
    [work, outcome, lens, meaning, primary, secondary, explanation])).outcome;
};
const requestPlace = async (uid, experience) => {
  await as(uid); return first('SELECT * FROM public.request_own_public_spatial_placement_v1($1, $2)', [randomUUID(), experience]);
};
const commitPlace = async (request, x, y) => {
  await asRole('service_role');
  return (await first('SELECT * FROM public.commit_public_spatial_placement_v1($1, $2, $3, $4)', [request, 'test.layout.v1', x, y])).outcome;
};
const field = async (uid) => { await as(uid); return rows('SELECT * FROM public.read_public_semantic_field_v1($1, $2, $3, $4)', WORLD); };
const panel = async (uid, experience) => { await as(uid); return rows('SELECT * FROM public.read_public_semantic_experience_v1($1)', [experience]); };

// ---- the S5-03C commands
const lines = async (uid, experience) => { await as(uid); return rows('SELECT * FROM public.read_public_semantic_relations_v1($1)', [experience]); };
const ownExperiences = async (uid) => { await as(uid); return rows('SELECT * FROM public.read_own_public_relation_experiences_v1()'); };
const ownRelations = async (uid) => { await as(uid); return rows('SELECT * FROM public.read_own_public_relations_v1()'); };
const request = async (uid, from, to, command = randomUUID()) => {
  await as(uid); return first('SELECT * FROM public.request_public_relation_v1($1, $2, $3)', [command, from, to]);
};
const act = async (name, uid, relation, command = randomUUID()) => {
  await as(uid); return (await first(`SELECT * FROM public.${name}_public_relation_v1($1, $2)`, [command, relation])).outcome;
};
const accept = (uid, relation, command) => act('accept', uid, relation, command);
const decline = (uid, relation, command) => act('decline', uid, relation, command);
const cancel = (uid, relation, command) => act('cancel', uid, relation, command);
const remove = (uid, relation, command) => act('remove', uid, relation, command);
const otherIds = (list) => list.map((r) => r.experience_id).sort();
const placements = () => own(`SELECT * FROM ${SPATIAL}.spatial_placements ORDER BY id`);

/** Relate two served Experiences through the whole human path: the source side requests, the target side accepts. */
async function related(from, fromUid, to, toUid) {
  const asked = await request(fromUid, from, to);
  assert.equal(asked.outcome, 'REQUESTED');
  assert.equal(await accept(toUid, asked.relation_id), 'ACCEPTED');
  return asked.relation_id;
}

const MEANINGS = Object.freeze({
  a1: { lens: 'family.fear', meaning: 'Fear for a family while work feels uncertain', primary: ['fear', 'family'], secondary: ['work'] },
  a2: { lens: 'family.fear', meaning: 'A parent afraid of losing work', primary: ['fear', 'family'], secondary: ['work'] },
  b: { lens: 'courage.daily', meaning: 'Courage found in small daily choices', primary: ['courage'], secondary: [] },
  c: { lens: 'hope.waiting', meaning: 'Hope after a long winter of waiting', primary: ['hope'], secondary: ['patience'] },
});

/** One more human with committed Personal material of their own, so a second controller can author an Experience. */
async function provisionAuthor(uid) {
  const session = randomUUID(); const turn = randomUUID(); const batch = randomUUID(); const unit = randomUUID();
  const text = 'a sentence a second publisher committed';
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, uid]);
  await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content) VALUES ($1, $2, $3, 'USER', 'COMPLETED', $4)`,
    [turn, session, uid, text]);
  await q(`INSERT INTO public.conversation_unit_commit_batches
             (id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256, unit_count, evaluator_version,
              policy_version, segmentation_provider, segmentation_model, segmentation_prompt_version)
           VALUES ($1, $2, $3, $4, sha256('fp'::bytea), sha256($5::bytea), 1, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
  [batch, uid, session, turn, Buffer.from(text, 'utf8')]);
  await q(`INSERT INTO public.conversation_units
             (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state, source_modality, ordinal_within_turn,
              source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
           VALUES ($1, $2, $3, $4, $5, 'USER', 'RESOLVED', 'TEXT', 0, 0, $6, $7, sha256(convert_to($7, 'UTF8')), 1)`,
  [unit, uid, session, turn, batch, [...text].length, text]);
  return unit;
}

/** READY_FOR_REVIEW → SEMANTICALLY_READY → placed → PUBLISHED (through the simulated CW2-08 seam only). */
async function served(f, seam, uid, unit, p, x, y, hadir = false) {
  const experience = await startDraft(uid);
  assert.equal(await prepareOwn(uid, experience, [unit], hadir ? [f.world] : NONE, hadir ? [f.hadirMaterial] : NONE), 'PREPARED');
  const [{ v, m }] = await own(`SELECT e.current_experience_version_id v, ve.package_manifest_version_id m FROM ${T.EXPERIENCES} e
    JOIN ${T.VERSIONS} ve ON ve.id = e.current_experience_version_id WHERE e.id = $1`, [experience]);
  assert.equal(await approveOwn(uid, m), 'APPROVED');
  if (hadir) assert.equal(await approveOwn(f.hadir, m), 'APPROVED');
  assert.equal(await readyOwn(uid, experience), 'READY_FOR_REVIEW');
  const work = (await requestProposal(uid, experience)).work_id;
  assert.equal(await recordOutcome(work, 'PROPOSED', p.lens, p.meaning, p.primary, p.secondary, 'Why, in the analysis.'), 'RECORDED');
  const committed = await commitWork(uid, work);
  assert.equal(await acceptSemantic(uid, experience, committed.interpretation_id), 'ACCEPTED');
  const opened = await requestPlace(uid, experience);
  assert.equal(opened.outcome, 'REQUEST_OPEN');
  assert.equal(await commitPlace(opened.request_id, x, y), 'PLACED');
  const e = { experience, version: v, manifest: m, interpretation: committed.interpretation_id, uid, p };
  e.publish = async () => {
    await asRole('postgres');
    const [published] = await rt.publishCleared(seam, uid, randomUUID(), experience, v);
    assert.equal(published.outcome, 'PUBLISHED', 'fixture: published through the simulated seam');
  };
  return e;
}

// --------------------------------------------------------------------------------------------------------- 1. boundary
async function verifyBoundary() {
  await asRole('postgres');
  const fns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(fns.map((f) => f.proname).sort(), [...Object.keys(OWNER_COMMANDS), ...Object.keys(VIEWER_COMMANDS), ...INTERNAL].sort(),
    'B01 the private schema holds exactly the S5-03C functions');
  for (const f of fns) {
    assert.equal(f.prosecdef, true, `B01 ${f.proname} is a definer`);
    assert.equal(f.owner, 'postgres');
    assert.deepEqual(f.proconfig, ['search_path=""'], `B01 ${f.proname} pins an empty search_path`);
  }
  const exposed = { ...OWNER_COMMANDS, ...VIEWER_COMMANDS };
  const wrappers = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [Object.keys(exposed)]);
  assert.equal(wrappers.length, Object.keys(exposed).length, 'B02 each exposed command has exactly one public wrapper');
  for (const w of wrappers) {
    assert.equal(w.prosecdef, false, `B02 public.${w.proname} is an INVOKER wrapper`);
    assert.deepEqual(w.proconfig, ['search_path=""']);
    assert.equal(w.args, exposed[w.proname].join(', '), `B03 public.${w.proname} accepts exactly its inputs`);
    for (const parameter of exposed[w.proname]) {
      assert.doesNotMatch(parameter, /user|actor|viewer|account|identity|label|controller|authority|audience|visib|lifecycle|version|interpretation|revision|region|lens|theme|coordinate|distance|proxim|near|neighbo|similar|score|strength|weight|rank|type|kind|evidence|text|side|state/u,
        `B03 ${w.proname} input ${parameter} is no authority claim, no geography and no relation content`);
    }
  }
  const executable = await rows(`SELECT r.rolname, n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT unnest($2::text[]) rolname) r
    WHERE EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
      AND (n.nspname = $3 OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`, [Object.keys(exposed), APP_ROLES, SCHEMA]);
  assert.deepEqual(executable.map((e) => `${e.rolname} ${e.fn}`).sort(),
    Object.keys(exposed).flatMap((n) => [`authenticated public.${n}`, `authenticated ${SCHEMA}.${n}`]).sort(),
    'B04 authenticated runs the owner and viewer commands; the server channel and anon run nothing');
  const publicExec = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname = $2 OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')`,
  [Object.keys(exposed), SCHEMA]);
  assert.deepEqual(publicExec, [], 'B04 no S5-03C function keeps PUBLIC EXECUTE');
  const tables = await rows(`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm') ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(tables.map((t) => t.relname), TABLES, 'B05 exactly the two relation tables');
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
  assert.deepEqual(columns.filter((c) => !['uuid', 'timestamp with time zone'].includes(c.t)).map((c) => `${c.relname}.${c.attname}`),
    ['explicit_relation_acts.act', 'explicit_relation_acts.acting_side', 'explicit_relations.relation_type'],
    'B05 no evidence text, meaning, label, strength, score or coordinate is stored with a relation');
  const accountEdges = await rows(`SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = $1 AND c.contype = 'f'
      AND c.confrelid IN ('public.users'::regclass, 'auth.users'::regclass, 'public.public_identities'::regclass)`, [SCHEMA]);
  assert.deepEqual(accountEdges, [], 'B05 no relation table references an account or a Public identity directly');
  const restrictEdges = await rows(`SELECT t.relname, c.conname, c.confrelid::regclass::text target, c.confdeltype FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = $1 AND c.contype = 'f' ORDER BY 1, 2`, [SCHEMA]);
  assert.deepEqual(restrictEdges.map((e) => `${e.relname}.${e.conname} → ${e.target} ${e.confdeltype}`), [
    'explicit_relation_acts.explicit_relation_acts_relation_fk → public_relation_private.explicit_relations r',
    'explicit_relations.explicit_relations_source_interpretation_fk → public_semantic_private.semantic_interpretations r',
    'explicit_relations.explicit_relations_source_version_fk → public_experience_versions r',
    'explicit_relations.explicit_relations_target_interpretation_fk → public_semantic_private.semantic_interpretations r',
    'explicit_relations.explicit_relations_target_version_fk → public_experience_versions r',
  ], 'B05a a relation binds both exact versions and both exact S5-03A revisions ON DELETE RESTRICT (QAN-BL-ACCT-01)');
  // B06 exactly one writer of a relation and one writer of an act in the whole database — a human request and a human act.
  const writers = async (table) => (await rows(`SELECT n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prosrc ~* $1 ORDER BY 1`,
  [`(INSERT INTO|UPDATE|DELETE FROM)\\s+${SCHEMA}\\.${table}\\M`])).map((w) => w.fn);
  assert.deepEqual(await writers('explicit_relations'), [`${SCHEMA}.request_public_relation_v1`], 'B06 only the human request writes a relation');
  assert.deepEqual(await writers('explicit_relation_acts'), [`${SCHEMA}.record_act_v1`], 'B06 only the human act recorder writes an act');
  // B07 a relation is not geography and not similarity: nothing here writes a place, reads a distance, a region or a theme.
  const bodies = await rows(`SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1`, [SCHEMA]);
  for (const b of bodies) {
    assert.doesNotMatch(b.prosrc, /(INSERT INTO|UPDATE|DELETE FROM)\s+public_spatial_private|field_candidates_v1|read_public_semantic_nearby|\^ *2|semantic_region *(=|<>|IN)|primary_themes|secondary_themes|vitality|discussion|published_at|publish_public_experience_v1|'PUBLISHED'/iu,
      `B07 ${b.proname} writes no geography and reads no similarity`);
  }
  const seam = (await rt.functionPosture(SEAM)).prosrc;
  assert.ok(seam.includes('NOT_EVALUATED') && !seam.includes("'CLEARED'"), 'B08 the CW2-08 seam still answers NOT_EVALUATED');
}

// ------------------------------------------------------------------------------------------------------- fixture
async function fixture(seam) {
  const f = rt.newFixture();
  await asRole('postgres');
  await rt.provision(f);
  f.strangerUnit = await provisionAuthor(f.stranger);
  // a1 and a2 are side by side in the SAME semantic region; b is elsewhere, another publisher's; c carries Hadir's words.
  f.a1 = await served(f, seam, f.mohamed, f.userUnit, MEANINGS.a1, '1000000', '2000000');
  f.a2 = await served(f, seam, f.mohamed, f.userUnit, MEANINGS.a2, '1000010', '2000010');
  f.b = await served(f, seam, f.stranger, f.strangerUnit, MEANINGS.b, '5000000', '5000000');
  f.c = await served(f, seam, f.mohamed, f.userUnit, MEANINGS.c, '9000000', '9000000', true);
  assert.equal((await admission(f.reader))[0].admission, 'ADMITTED', 'fixture: the reader is an admitted registered viewer');
  return f;
}

// ------------------------------------------------------------------------------------------- 2–3. similarity, lifecycle
async function verifyLifecycle(f) {
  // L01 nothing is public yet: no relation can be asked between Experiences nobody is served.
  assert.deepEqual(await request(f.mohamed, f.a1.experience, f.b.experience), { outcome: 'UNAVAILABLE', relation_id: null }, 'L01 READY_FOR_REVIEW');
  assert.deepEqual(await ownExperiences(f.mohamed), [], 'L01 nothing of the publisher is served yet');
  for (const e of [f.a1, f.a2, f.b, f.c]) await e.publish();
  assert.equal((await visibility(f.b.experience))[0].visibility_state, 'PUBLICLY_VISIBLE', 'fixture: b is canonically public');
  const placementsBefore = await placements();
  const worldBefore = await field(f.reader);

  // L02 SIMILARITY IS NOT A RELATION: a1 and a2 are neighbours in the same region; nobody asked; no line, no row.
  for (const e of [f.a1, f.a2, f.b, f.c]) assert.deepEqual(await lines(f.reader, e.experience), [], 'L02 zero explicit relations = zero lines');
  assert.deepEqual(await ownRelations(f.mohamed), [], 'L02 nothing to manage');
  assert.deepEqual((await ownExperiences(f.mohamed)).map((r) => r.experience_id).sort(), [f.a1.experience, f.a2.experience, f.c.experience].sort(),
    'L02 the publisher\'s own served Experiences, named by meaning');
  assert.deepEqual((await ownExperiences(f.stranger)).map((r) => [r.experience_id, r.meaning]), [[f.b.experience, MEANINGS.b.meaning]]);

  // L03 only a controller of the source requests; the same Experience twice, a guessed id or an unadmitted viewer is the same answer.
  for (const [uid, from, to] of [[f.stranger, f.a1.experience, f.b.experience], [f.reader, f.a1.experience, f.b.experience],
    [f.mohamed, f.a1.experience, f.a1.experience], [f.mohamed, f.a1.experience, randomUUID()], [f.mohamed, randomUUID(), f.b.experience],
    [randomUUID(), f.a1.experience, f.b.experience]]) {
    assert.deepEqual(await request(uid, from, to), { outcome: 'UNAVAILABLE', relation_id: null }, 'L03 one neutral refusal');
  }
  assert.equal(Number((await own(`SELECT count(*) n FROM ${SCHEMA}.explicit_relations`))[0].n), 0, 'L03 and nothing was written');
  await asRole('anon');
  await rejected(() => q('SELECT * FROM public.request_public_relation_v1($1, $2, $3)', [randomUUID(), f.a1.experience, f.b.experience]), ['42501']);
  await asRole('authenticated');
  await rejected(() => q('SELECT * FROM public.request_public_relation_v1($1, $2, $3)', [randomUUID(), f.a1.experience, f.b.experience]), ['42501'],
    /AUTHENTICATION_REQUIRED/u);

  // L04 the source's controller requests a1 → b: one current relation per pair, in either direction; retries are idempotent.
  const command = randomUUID();
  const asked = await request(f.mohamed, f.a1.experience, f.b.experience, command);
  assert.equal(asked.outcome, 'REQUESTED');
  assert.deepEqual(await request(f.mohamed, f.a1.experience, f.b.experience, command), asked, 'L04 a retry is the same request');
  assert.deepEqual(await request(f.mohamed, f.a1.experience, f.b.experience), { outcome: 'ALREADY_PENDING', relation_id: asked.relation_id }, 'L04');
  assert.deepEqual(await request(f.stranger, f.b.experience, f.a1.experience), { outcome: 'ALREADY_PENDING', relation_id: asked.relation_id },
    'L04 the reverse direction is the same pair');
  await as(f.mohamed);
  await rejected(() => q('SELECT * FROM public.request_public_relation_v1($1, $2, $3)', [command, f.a2.experience, f.b.experience]), ['23505'],
    /PUBLIC_RELATION_COMMAND_ID_CONFLICT/u);
  const [row] = await own(`SELECT * FROM ${SCHEMA}.explicit_relations WHERE id = $1`, [asked.relation_id]);
  assert.deepEqual([row.relation_type, row.source_experience_version_id, row.source_interpretation_id, row.target_experience_version_id, row.target_interpretation_id],
    ['EXPLICIT_PUBLIC_RELATION', f.a1.version, f.a1.interpretation, f.b.version, f.b.interpretation], 'L04 bound to both exact versions and revisions');

  // L05 a pending request is no relation: no line for anyone; each side sees it from its own side, named by meaning only.
  assert.deepEqual(await lines(f.reader, f.a1.experience), [], 'L05 pending draws nothing');
  assert.deepEqual(await lines(f.stranger, f.b.experience), [], 'L05');
  assert.deepEqual(await ownRelations(f.mohamed), [{ relation_id: asked.relation_id, experience_id: f.a1.experience, other_experience_id: f.b.experience,
    other_meaning: MEANINGS.b.meaning, relation_state: 'REQUEST_SENT' }], 'L05 the source side');
  assert.deepEqual(await ownRelations(f.stranger), [{ relation_id: asked.relation_id, experience_id: f.b.experience, other_experience_id: f.a1.experience,
    other_meaning: MEANINGS.a1.meaning, relation_state: 'REQUEST_RECEIVED' }], 'L05 the target side');
  assert.deepEqual(await ownRelations(f.reader), [], 'L05 nobody else');

  // L06 each act belongs to its side only.
  assert.equal(await accept(f.mohamed, asked.relation_id), 'UNAVAILABLE', 'L06 the source cannot accept its own request');
  assert.equal(await decline(f.mohamed, asked.relation_id), 'UNAVAILABLE', 'L06');
  assert.equal(await cancel(f.stranger, asked.relation_id), 'UNAVAILABLE', 'L06 the target cannot cancel');
  for (const name of ['accept', 'decline', 'cancel', 'remove']) {
    assert.equal(await act(name, f.reader, asked.relation_id), 'UNAVAILABLE', `L06 a stranger cannot ${name}`);
    assert.equal(await act(name, f.mohamed, randomUUID()), 'UNAVAILABLE', `L06 a guessed id: ${name}`);
  }
  assert.equal(await remove(f.mohamed, asked.relation_id), 'NOT_ACTIVE', 'L06 a pending request cannot be removed');

  // L07 the target accepts: the relation exists; retries are idempotent; nothing else applies to it.
  const acceptance = randomUUID();
  assert.equal(await accept(f.stranger, asked.relation_id, acceptance), 'ACCEPTED');
  assert.equal(await accept(f.stranger, asked.relation_id, acceptance), 'ACCEPTED', 'L07 a retry is the same act');
  assert.equal(await accept(f.stranger, asked.relation_id), 'NOT_PENDING', 'L07');
  assert.equal(await cancel(f.mohamed, asked.relation_id), 'NOT_PENDING', 'L07 an accepted relation is not cancelled');
  assert.equal(await decline(f.stranger, asked.relation_id), 'NOT_PENDING', 'L07');
  await as(f.stranger);
  await rejected(() => q('SELECT * FROM public.decline_public_relation_v1($1, $2)', [acceptance, asked.relation_id]), ['23505'],
    /PUBLIC_RELATION_COMMAND_ID_CONFLICT/u);
  assert.deepEqual(await request(f.mohamed, f.a1.experience, f.b.experience), { outcome: 'ALREADY_RELATED', relation_id: asked.relation_id }, 'L07');

  // L08 the line: the other endpoint's served place, to every admitted viewer, from both endpoints — and nothing else.
  const fromA1 = await lines(f.reader, f.a1.experience);
  assert.deepEqual(fromA1, [{ relation_id: asked.relation_id, experience_id: f.b.experience, world_x: '5000000', world_y: '5000000',
    meaning: MEANINGS.b.meaning, semantic_region: MEANINGS.b.lens }], 'L08 one explicit relation, one line');
  assert.deepEqual((await lines(f.reader, f.b.experience)).map((r) => [r.relation_id, r.experience_id]), [[asked.relation_id, f.a1.experience]],
    'L08 undirected: the same relation from the other endpoint');
  assert.deepEqual(await lines(f.reader, f.a2.experience), [], 'L08 the neighbour in the same region still has none');
  assert.deepEqual(await lines(f.reader, randomUUID()), [], 'L08 a guessed id');
  for (const uid of [f.mohamed, f.stranger]) {
    assert.deepEqual((await ownRelations(uid)).map((r) => r.relation_state), ['ACTIVE'], 'L08 both sides see it ACTIVE');
  }
  const ghost = randomUUID();
  assert.equal((await admission(ghost))[0].admission, 'NOT_ADMITTED');
  assert.deepEqual(await lines(ghost, f.a1.experience), [], 'L08 an unadmitted viewer reads nothing');
  assert.deepEqual(await ownRelations(ghost), [], 'L08');
  await asRole('anon');
  await rejected(() => q('SELECT * FROM public.read_public_semantic_relations_v1($1)', [f.a1.experience]), ['42501']);

  // L09 A RELATION IS NOT GEOGRAPHY: requests, acceptance and lines moved no place and changed no field.
  assert.deepEqual(await placements(), placementsBefore, 'L09 no coordinate moved');
  assert.deepEqual(await field(f.reader), worldBefore, 'L09 the field is exactly as it was');

  // L10 either side removes an ACTIVE relation; the line goes at once; a new explicit request is a NEW relation.
  await q('SAVEPOINT l10');
  assert.equal(await remove(f.stranger, asked.relation_id), 'REMOVED', 'L10 the target side may remove');
  assert.deepEqual(await lines(f.reader, f.a1.experience), [], 'L10 no line after removal');
  assert.deepEqual(await ownRelations(f.mohamed), [], 'L10');
  assert.equal(await remove(f.mohamed, asked.relation_id), 'NOT_ACTIVE', 'L10');
  assert.equal(await accept(f.stranger, asked.relation_id), 'NOT_PENDING', 'L10 nothing revives it');
  const again = await request(f.mohamed, f.a1.experience, f.b.experience);
  assert.equal(again.outcome, 'REQUESTED');
  assert.notEqual(again.relation_id, asked.relation_id, 'L10 a new explicit relation, never the old one revived');
  // L11 decline and cancel end a request for good.
  assert.equal(await decline(f.stranger, again.relation_id), 'DECLINED');
  assert.deepEqual(await ownRelations(f.stranger), [], 'L11 a declined request is gone');
  assert.equal(await accept(f.stranger, again.relation_id), 'NOT_PENDING', 'L11');
  const third = await request(f.mohamed, f.a1.experience, f.b.experience);
  assert.equal(await cancel(f.mohamed, third.relation_id), 'CANCELLED');
  assert.equal(await accept(f.stranger, third.relation_id), 'NOT_PENDING', 'L11 a cancelled request cannot be accepted');
  assert.deepEqual(await lines(f.reader, f.b.experience), [], 'L11');
  await q('ROLLBACK TO SAVEPOINT l10'); await q('RELEASE SAVEPOINT l10');
  assert.equal(await remove(f.mohamed, asked.relation_id), 'REMOVED', 'L10 the source side may remove too');
  // The integrity probes below run over a fresh ACTIVE relation between the same pair.
  f.ab = await related(f.a1.experience, f.mohamed, f.b.experience, f.stranger);

  // L12 the database itself refuses a direct mutation, a forged transition, a wrong side and an unbound revision.
  await asRole('postgres');
  for (const statement of [`UPDATE ${SCHEMA}.explicit_relations SET requested_at = now()`, `DELETE FROM ${SCHEMA}.explicit_relations`,
    `UPDATE ${SCHEMA}.explicit_relation_acts SET acted_at = now()`, `DELETE FROM ${SCHEMA}.explicit_relation_acts`]) {
    await rejected(() => q(statement), ['55000'], /PUBLIC_RELATION_HISTORY_IS_IMMUTABLE/u);
  }
  await rejected(() => q(`INSERT INTO ${SCHEMA}.explicit_relation_acts VALUES ($1, $2, 'ACCEPT', 'TARGET', now())`, [randomUUID(), f.ab]), ['23505', '55000'],
    null);
  const waiting = await request(f.mohamed, f.a2.experience, f.c.experience);
  await asRole('postgres');
  await rejected(() => q(`INSERT INTO ${SCHEMA}.explicit_relation_acts VALUES ($1, $2, 'ACCEPT', 'SOURCE', now())`, [randomUUID(), waiting.relation_id]),
    ['23514'], /explicit_relation_acts_side_check/u);
  await rejected(() => q(`INSERT INTO ${SCHEMA}.explicit_relation_acts VALUES ($1, $2, 'REMOVE', 'SOURCE', now())`, [randomUUID(), waiting.relation_id]),
    ['55000'], /PUBLIC_RELATION_HISTORY_IS_IMMUTABLE/u);
  assert.equal(await cancel(f.mohamed, waiting.relation_id), 'CANCELLED');
  await asRole('postgres');
  await rejected(() => q(`INSERT INTO ${SCHEMA}.explicit_relations VALUES ($1, 'EXPLICIT_PUBLIC_RELATION', $2, $3, $4, $5, $6, $7, now())`,
    [randomUUID(), f.a2.experience, f.a2.version, f.a1.interpretation, f.c.experience, f.c.version, f.c.interpretation]), ['55000'],
  /PUBLIC_RELATION_HISTORY_IS_IMMUTABLE/u);
  await rejected(() => q(`INSERT INTO ${SCHEMA}.explicit_relations VALUES ($1, 'SIMILAR', $2, $3, $4, $5, $6, $7, now())`,
    [randomUUID(), f.a2.experience, f.a2.version, f.a2.interpretation, f.c.experience, f.c.version, f.c.interpretation]), ['23514']);
}

// ------------------------------------------------------------------------------------------------- 4–5. integrity
/** The relation through `experience` is gone everywhere: no line from either endpoint, no row on either side, no act. */
async function assertGone(f, relation, survivor, gone) {
  assert.ok(!(await lines(f.reader, survivor)).some((r) => r.relation_id === relation), 'no line from the surviving endpoint');
  assert.ok(!(await lines(f.reader, survivor)).some((r) => r.experience_id === gone), 'the invisible endpoint is never disclosed');
  assert.deepEqual(await lines(f.reader, gone), [], 'nothing from the gone endpoint');
  for (const uid of [f.mohamed, f.stranger]) assert.ok(!(await ownRelations(uid)).some((r) => r.relation_id === relation), 'no management row');
  for (const name of ['accept', 'decline', 'cancel', 'remove']) {
    for (const uid of [f.mohamed, f.stranger]) assert.equal(await act(name, uid, relation), 'UNAVAILABLE', `no ${name} on a stale relation`);
  }
}

async function verifyIntegrity(f, seam) {
  f.ac = await related(f.a1.experience, f.mohamed, f.c.experience, f.mohamed);
  assert.deepEqual(otherIds(await lines(f.reader, f.a1.experience)), [f.b.experience, f.c.experience].sort(), 'I00 two explicit relations, two lines');
  const pendingCommand = await request(f.mohamed, f.a2.experience, f.b.experience);
  assert.equal(pendingCommand.outcome, 'REQUESTED');
  const relationsBefore = await own(`SELECT * FROM ${SCHEMA}.explicit_relations ORDER BY id`);
  const actsBefore = await own(`SELECT * FROM ${SCHEMA}.explicit_relation_acts ORDER BY id`);

  // I01 a new current semantic revision of b's visible version (the frozen 0096 primitive — the only writer of a revision
  //     once an Experience is public). The relation bound the OLD reviewed revision: it is not served, and neither is the
  //     pending request through b; the unrelated relation is untouched. Nothing re-binds to the new revision.
  await q('SAVEPOINT i01');
  await asRole('postgres'); await actAs(f.stranger);
  await rt.recordPlacement(randomUUID(), randomUUID(), f.b.experience, f.b.version, 'raw.lens', 'A later frozen revision');
  assert.deepEqual(await panel(f.reader, f.b.experience), [], 'I01 b is not served under an unreviewed revision');
  await assertGone(f, f.ab, f.a1.experience, f.b.experience);
  assert.ok(!(await ownRelations(f.mohamed)).some((r) => r.relation_id === pendingCommand.relation_id), 'I01 a pending request through b is stale too');
  assert.equal(await accept(f.stranger, pendingCommand.relation_id), 'UNAVAILABLE', 'I01 a stale request cannot be accepted');
  assert.deepEqual(otherIds(await lines(f.reader, f.a1.experience)), [f.c.experience], 'I01 the other relation is untouched');
  assert.deepEqual(await request(f.mohamed, f.a1.experience, f.b.experience), { outcome: 'UNAVAILABLE', relation_id: null },
    'I01 nothing can be related to an Experience that is not served');
  await q('ROLLBACK TO SAVEPOINT i01'); await q('RELEASE SAVEPOINT i01');

  // I02 a successor version of b becomes current.
  await q('SAVEPOINT i02');
  await rt.simulateSuccessorVersion(f.b.experience, f.b.manifest);
  await assertGone(f, f.ab, f.a1.experience, f.b.experience);
  await q('ROLLBACK TO SAVEPOINT i02'); await q('RELEASE SAVEPOINT i02');

  // I03 a withdrawn required approval: c goes dark (0098), and so does every relation through it — a1 never discloses c.
  await q('SAVEPOINT i03');
  const [{ id: hadirApproval }] = await own(`SELECT id FROM ${T.APPROVALS} WHERE manifest_version_id = $1 AND approver_user_id = $2`, [f.c.manifest, f.hadir]);
  await asRole('postgres'); await actAs(f.hadir);
  await rt.withdraw(randomUUID(), hadirApproval);
  assert.equal((await visibility(f.c.experience))[0].visibility_state, 'NOT_PUBLICLY_VISIBLE');
  await assertGone(f, f.ac, f.a1.experience, f.c.experience);
  assert.deepEqual(otherIds(await lines(f.reader, f.a1.experience)), [f.b.experience], 'I03 only the visible endpoint remains; no count, no trace of c');
  await q('ROLLBACK TO SAVEPOINT i03'); await q('RELEASE SAVEPOINT i03');

  // I04 ASSURE-F05: Hadir deletes her words. c's reviewed content is erased in the same transaction; the relation goes with it.
  await q('SAVEPOINT i04');
  await asRole('postgres'); await actAs(f.hadir);
  assert.equal((await rt.deleteMaterial(randomUUID(), f.world, f.hadirMaterial, randomUUID()))[0].outcome, 'MATERIAL_DELETED');
  assert.ok(Number((await own(`SELECT count(*) n FROM ${SEMANTIC}.semantic_interpretations WHERE experience_id = $1 AND content_erased_at IS NOT NULL`,
    [f.c.experience]))[0].n) > 0, 'I04 S5-03A erased c\'s content (lineage)');
  await assertGone(f, f.ac, f.a1.experience, f.c.experience);
  await q('ROLLBACK TO SAVEPOINT i04'); await q('RELEASE SAVEPOINT i04');

  // I05 an owner's disappearance from the Public World (0099): absence is terminal, and no orphan line is left behind.
  await q('SAVEPOINT i05');
  await asRole('postgres'); await actAs(f.stranger);
  const [removed] = await rt.removeFromPublicWorld(randomUUID(), f.b.experience, f.b.version);
  assert.ok(removed && /ABSENT|REMOVED/u.test(`${removed.outcome} ${removed.current_lifecycle}`), `I05 b left the Public World (${removed?.outcome})`);
  await assertGone(f, f.ab, f.a1.experience, f.b.experience);
  await q('ROLLBACK TO SAVEPOINT i05'); await q('RELEASE SAVEPOINT i05');

  // I06 an unadmitted viewer, and a viewer who is no longer admitted, reads nothing — the client's cache is never asked.
  assert.deepEqual(await lines(randomUUID(), f.a1.experience), [], 'I06');

  // I07 every probe was derivation only: S5-03C wrote nothing to make anything stale, and after the probes all is as it was.
  assert.deepEqual(await own(`SELECT * FROM ${SCHEMA}.explicit_relations ORDER BY id`), relationsBefore, 'I07 no relation row was written by staleness');
  assert.deepEqual(await own(`SELECT * FROM ${SCHEMA}.explicit_relation_acts ORDER BY id`), actsBefore, 'I07 no act was written by staleness');
  assert.deepEqual(otherIds(await lines(f.reader, f.a1.experience)), [f.b.experience, f.c.experience].sort(), 'I07 restored');
  void seam;
}

// ------------------------------------------------------------------------------------------------------- 6. launch
async function verifyLaunchClosure(f) {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await asRole(role, role === 'anon' ? null : f.mohamed);
    await rejected(() => q(`SELECT * FROM ${SCHEMA}.relation_is_current_v1($1)`, [f.ab]), ['42501']);
    await rejected(() => q(`SELECT * FROM ${SCHEMA}.record_act_v1($1, $2, $3, 'ACCEPT', 'TARGET')`, [f.mohamed, randomUUID(), f.ab]), ['42501']);
  }
  await asRole('service_role');
  await rejected(() => q('SELECT * FROM public.request_public_relation_v1($1, $2, $3)', [randomUUID(), f.a2.experience, f.c.experience]), ['42501'],
    null);
  const seam = (await rt.functionPosture(SEAM)).prosrc;
  assert.ok(seam.includes('NOT_EVALUATED') && !seam.includes("'CLEARED'"), 'X01 the seam was restored and still answers NOT_EVALUATED');
}

await runVerifier('0146', async (stage) => {
  await rt.client.connect();
  stage('boundary');
  await verifyBoundary();
  await q('BEGIN');
  try {
    stage('fixture');
    const seam = await rt.captureSeam();
    const f = await fixture(seam);
    stage('similarity and lifecycle');
    await verifyLifecycle(f);
    stage('integrity');
    await verifyIntegrity(f, seam);
    stage('launch closure');
    await verifyLaunchClosure(f);
  } finally {
    await q('ROLLBACK');
  }
  console.log('Verified migration 0146: an explicit Public relation exists only through a human request by the source\'s controller and an explicit acceptance by the target\'s controller, bound to both exact versions and both exact reviewed revisions; similarity, proximity and a shared region create nothing; a line is served only for an ACTIVE relation whose two bound endpoints are both served now, to an admitted viewer, and never discloses an invisible endpoint; a new semantic revision, a successor version, a withdrawal, an ASSURE-F05 erasure and a disappearance each make it non-servable at once with no write of its own, and nothing carries forward; relations move no coordinate; history is append-only; the server channel holds nothing; nothing publishes.');
});
