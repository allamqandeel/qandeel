// S5-04 — Public Discussion + @qandeel + Public Activity / Direct Entry integration v1: the real-PostgreSQL verifier for 0147.
//
// It proves, against a fully migrated database:
//   1. the boundary: every S5-04 function is a pinned `public_discussion_private` SECURITY DEFINER or a pinned `public`
//      INVOKER wrapper; `authenticated` executes exactly the post command, the discussion read and the capability read;
//      `service_role` exactly the four QANDEEL work commands and the Activity source read; anon nothing; no human command
//      accepts an author, an identity, a version, a visibility, an ordinal, an instant or an entitlement verdict; the
//      frozen 0096 / 0097 primitives stay executable by no role; the three tables are private, RLS-enabled and hold no text;
//   2. the entitlement seam answers NOT_EVALUATED, so contribution fails closed and writes nothing — only a simulated
//      ENTITLED, inside this rolled-back transaction, opens it;
//   3. discussion over the frozen 0096 runtime: posts and replies on the served version only, Public Identity display
//      only, idempotent per command, one visible depth (a reply to a reply joins its root), vitality recomputed;
//   4. @qandeel: case-insensitive, standalone, kept verbatim, at most one invocation and one response per post;
//   5. the QANDEEL work: the lease (granted / in progress / limited / already committed), the strictly PUBLIC context, a
//      stale completion discarded and the invocation marked unanswered, one response through the frozen writer;
//   6. the Activity source read: recipients derived from Public truth, never the actor;
//   7. disappearance: once the Experience leaves the Public World, every S5-04 read, command and source answers nothing;
//   8. launch closure: both CW2-08 seams answer NOT_EVALUATED after the run.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, SEAM, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, actAs, asRole, rejected } = rt;
const own = async (text, values = []) => { await asRole('postgres'); return rows(text, values); };

const SCHEMA = 'public_discussion_private';
const ENTITLEMENT = `${SCHEMA}.resolve_public_discussion_entitlement_v1(uuid)`;
const HUMAN = {
  post_own_public_discussion_v1: ['p_command_id uuid', 'p_experience_id uuid', 'p_reply_to_post_id uuid', 'p_body text'],
  read_public_discussion_posts_v1: ['p_experience_id uuid', 'p_after_ordinal bigint'],
  read_public_discussion_capability_v1: ['p_experience_id uuid'],
};
const SERVER = {
  begin_public_qandeel_work_v1: ['p_post_id uuid', 'p_requester_user_id uuid'],
  read_public_qandeel_context_v1: ['p_post_id uuid', 'p_lease_id uuid'],
  complete_public_qandeel_work_v1: ['p_post_id uuid', 'p_lease_id uuid', 'p_experience_version_id uuid', 'p_response_body text', 'p_consumed_post_ids uuid[]'],
  end_public_qandeel_work_v1: ['p_post_id uuid', 'p_lease_id uuid', 'p_unanswered boolean'],
  server_read_public_activity_source_v1: ['p_source_kind text', 'p_source_id uuid'],
};
const INTERNAL = ['resolve_public_discussion_entitlement_v1', 'guard_invocation_v1', 'qandeel_work_policy_v1', 'invokes_qandeel_v1',
  'is_entitled_v1', 'is_admitted_v1', 'served_version_v1'];
const TABLES = ['qandeel_invocations', 'qandeel_work_grants', 'qandeel_work_leases'];
const FROZEN = ['public.post_public_discussion_v1(uuid, uuid, uuid, uuid, text)',
  'public.record_public_qandeel_response_v1(uuid, uuid, uuid, uuid, text, uuid[])', 'public.recompute_public_experience_vitality_v1(uuid)'];

// ---- the S5-02 / S5-03A / S5-03B Product paths (as in verify-migration-0146), each as the human's own role
const as = async (uid) => asRole('authenticated', uid);
const first = async (text, values) => (await rows(text, values))[0];
async function served(f, seam, uid, unit, p, x, y) {
  await as(uid);
  const experience = (await first('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()])).experience_id;
  assert.equal((await first('SELECT * FROM public.prepare_own_public_experience_package_v1($1, $2, $3::uuid[], $4::uuid[], $5::uuid[])',
    [randomUUID(), experience, [unit], [], []])).outcome, 'PREPARED');
  const [{ v, m }] = await own(`SELECT e.current_experience_version_id v, ve.package_manifest_version_id m FROM ${T.EXPERIENCES} e
    JOIN ${T.VERSIONS} ve ON ve.id = e.current_experience_version_id WHERE e.id = $1`, [experience]);
  await as(uid);
  assert.equal((await first('SELECT * FROM public.approve_own_public_package_v1($1, $2)', [randomUUID(), m])).outcome, 'APPROVED');
  assert.equal((await first('SELECT * FROM public.commit_own_public_experience_ready_v1($1, $2)', [randomUUID(), experience])).outcome, 'READY_FOR_REVIEW');
  const work = (await first('SELECT * FROM public.request_own_public_semantic_proposal_v1($1, $2)', [randomUUID(), experience])).work_id;
  await asRole('service_role');
  assert.equal((await first('SELECT * FROM public.record_public_semantic_work_outcome_v1($1, $2, $3, $4, $5::text[], $6::text[], $7)',
    [work, 'PROPOSED', p.lens, p.meaning, p.primary, p.secondary, 'Why, in the analysis.'])).outcome, 'RECORDED');
  await as(uid);
  const committed = await first('SELECT * FROM public.commit_own_public_semantic_work_v1($1)', [work]);
  assert.equal((await first('SELECT * FROM public.accept_own_public_semantic_proposal_v1($1, $2, $3)',
    [randomUUID(), experience, committed.interpretation_id])).outcome, 'ACCEPTED');
  const opened = await first('SELECT * FROM public.request_own_public_spatial_placement_v1($1, $2)', [randomUUID(), experience]);
  await asRole('service_role');
  assert.equal((await first('SELECT * FROM public.commit_public_spatial_placement_v1($1, $2, $3, $4)',
    [opened.request_id, 'test.layout.v1', x, y])).outcome, 'PLACED');
  await asRole('postgres');
  const [published] = await rt.publishCleared(seam, uid, randomUUID(), experience, v);
  assert.equal(published.outcome, 'PUBLISHED', 'fixture: published through the simulated CW2-08 seam only');
  return { experience, version: v, uid };
}
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

// ---- the S5-04 commands
const post = async (uid, experience, body, replyTo = null, command = randomUUID()) => {
  await as(uid); return first('SELECT * FROM public.post_own_public_discussion_v1($1, $2, $3, $4)', [command, experience, replyTo, body]);
};
const discussion = async (uid, experience, after = null) => {
  await as(uid); return rows('SELECT * FROM public.read_public_discussion_posts_v1($1, $2)', [experience, after]);
};
const capability = async (uid, experience) => { await as(uid); return rows('SELECT * FROM public.read_public_discussion_capability_v1($1)', [experience]); };
const server = async (text, values) => { await asRole('service_role'); return rows(text, values); };
const begin = async (postId, uid) => (await server('SELECT * FROM public.begin_public_qandeel_work_v1($1, $2)', [postId, uid]))[0];
const context = (postId, lease) => server('SELECT * FROM public.read_public_qandeel_context_v1($1, $2)', [postId, lease]);
const complete = async (postId, lease, version, body, consumed) =>
  (await server('SELECT * FROM public.complete_public_qandeel_work_v1($1, $2, $3, $4, $5::uuid[])', [postId, lease, version, body, consumed]))[0];
const end = async (postId, lease, unanswered) =>
  (await server('SELECT public.end_public_qandeel_work_v1($1, $2, $3) AS held', [postId, lease, unanswered]))[0].held;
const source = (kind, id) => server('SELECT * FROM public.server_read_public_activity_source_v1($1, $2)', [kind, id]);
const panel = async (uid, experience) => { await as(uid); return first('SELECT * FROM public.read_public_semantic_experience_v1($1)', [experience]); };
const invocations = (postId) => own(`SELECT * FROM ${SCHEMA}.qandeel_invocations WHERE post_id = $1`, [postId]);
async function entitle() {
  await asRole('postgres');
  await q(`CREATE OR REPLACE FUNCTION ${SCHEMA}.resolve_public_discussion_entitlement_v1(p_user_id uuid)
    RETURNS TABLE (entitlement_state text, basis text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
      SELECT 'ENTITLED'::text, 'S5-04 VERIFIER PROBE: simulated entitlement inside a rolled-back transaction; never a production state'::text $$`);
}

// --------------------------------------------------------------------------------------------------------- 1. boundary
async function verifyBoundary() {
  await asRole('postgres');
  const fns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(fns.map((f) => f.proname).sort(), [...Object.keys(HUMAN), ...Object.keys(SERVER), ...INTERNAL].sort(),
    'B01 the private schema holds exactly the S5-04 functions');
  for (const f of fns) {
    assert.equal(f.prosecdef, true, `B01 ${f.proname} is a definer`);
    assert.equal(f.owner, 'postgres');
    assert.deepEqual(f.proconfig, ['search_path=""'], `B01 ${f.proname} pins an empty search_path`);
  }
  const exposed = { ...HUMAN, ...SERVER };
  const wrappers = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [Object.keys(exposed)]);
  assert.equal(wrappers.length, Object.keys(exposed).length, 'B02 each exposed command has exactly one public wrapper');
  for (const w of wrappers) {
    assert.equal(w.prosecdef, false, `B02 public.${w.proname} is an INVOKER wrapper`);
    assert.deepEqual(w.proconfig, ['search_path=""']);
    assert.equal(w.args, exposed[w.proname].join(', '), `B03 public.${w.proname} accepts exactly its inputs`);
  }
  for (const [name, parameters] of Object.entries(HUMAN)) {
    for (const parameter of parameters) {
      assert.doesNotMatch(parameter, /user|actor|viewer|author|account|identity|label|controller|audience|visib|lifecycle|version|ordinal_v|instant|time|entitle|premium|recipient|producer/u,
        `B03 ${name} input ${parameter} claims no authority`);
    }
  }
  const executable = await rows(`SELECT r.rolname, n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT unnest($2::text[]) rolname) r
    WHERE EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
      AND (n.nspname = $3 OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`, [Object.keys(exposed), APP_ROLES, SCHEMA]);
  assert.deepEqual(executable.map((e) => `${e.rolname} ${e.fn}`).sort(), [
    ...Object.keys(HUMAN).flatMap((n) => [`authenticated public.${n}`, `authenticated ${SCHEMA}.${n}`]),
    ...Object.keys(SERVER).flatMap((n) => [`service_role public.${n}`, `service_role ${SCHEMA}.${n}`]),
  ].sort(), 'B04 the human commands are the human\'s; the work and the source read are the server\'s; the seam is nobody\'s');
  const publicExec = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname = $2 OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')`,
  [Object.keys(exposed), SCHEMA]);
  assert.deepEqual(publicExec, [], 'B04 no S5-04 function keeps PUBLIC EXECUTE');
  for (const fn of FROZEN) {
    for (const role of APP_ROLES) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, fn, 'EXECUTE']);
      assert.equal(allowed, false, `B04 ${role} still executes no frozen primitive ${fn}`);
    }
  }
  for (const role of ['anon', 'authenticated']) {
    for (const fn of ['public.resolve_public_discussion_v1(uuid, uuid)', 'public.resolve_public_qandeel_responses_v1(uuid, uuid)']) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, fn, 'EXECUTE']);
      assert.equal(allowed, false, `B04 ${role} still cannot pass a viewer id to ${fn}`);
    }
  }
  const tables = await rows(`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm') ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(tables.map((t) => t.relname), TABLES, 'B05 exactly the three runtime tables');
  for (const t of tables) {
    assert.equal(t.relrowsecurity, true, `B05 ${t.relname} has RLS`);
    for (const role of APP_ROLES) {
      const [{ any }] = await rows(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT')
        OR has_table_privilege($1, $2, 'UPDATE') OR has_table_privilege($1, $2, 'DELETE') AS any`, [role, `${SCHEMA}.${t.relname}`]);
      assert.equal(any, false, `B05 ${role} holds no privilege on ${t.relname}`);
    }
  }
  const textColumns = await rows(`SELECT c.relname, a.attname FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
      AND format_type(a.atttypid, a.atttypmod) NOT IN ('uuid', 'timestamp with time zone', 'bigint')`, [SCHEMA]);
  assert.deepEqual(textColumns, [], 'B05 no discussion text, response, label or contact is copied into S5-04 tables');
  // B06 the Public context firewall, structurally: no S5-04 body reaches private truth.
  const bodies = await rows(`SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1`, [SCHEMA]);
  for (const b of bodies) {
    assert.doesNotMatch(b.prosrc, /provenance|shared_world|shared_private|conversation_|memor|human_model|(^|[^a-z])him_|hypothes|matching|introduction|standing_context|login_id|email|public\.users|derivative_bodies/iu,
      `B06 ${b.proname} reaches no private or Shared truth`);
  }
  const contextBody = bodies.find((b) => b.proname === 'read_public_qandeel_context_v1').prosrc;
  assert.doesNotMatch(contextBody, /display_label|label_mode|author_user_id|public_identit|controller/u,
    'B06 the QANDEEL context carries no author, display or controller');
  assert.ok((await rt.functionPosture(SEAM)).prosrc.includes('NOT_EVALUATED'), 'B07 the CW2-08 publication seam answers NOT_EVALUATED');
  const entitlement = (await rt.functionPosture(ENTITLEMENT)).prosrc;
  assert.ok(entitlement.includes('NOT_EVALUATED') && !entitlement.includes("'ENTITLED'"), 'B07 the entitlement seam answers NOT_EVALUATED');
}

// ------------------------------------------------------------------------------------------------------- fixture
async function fixture(seam) {
  const f = rt.newFixture();
  await asRole('postgres');
  await rt.provision(f);
  f.strangerUnit = await provisionAuthor(f.stranger);
  f.a = await served(f, seam, f.mohamed, f.userUnit, { lens: 'family.fear', meaning: 'Fear for a family while work feels uncertain', primary: ['fear'], secondary: ['work'] }, '1000000', '2000000');
  f.b = await served(f, seam, f.stranger, f.strangerUnit, { lens: 'courage.daily', meaning: 'Courage found in small daily choices', primary: ['courage'], secondary: [] }, '5000000', '5000000');
  assert.equal((await rt.admission(f.reader))[0].admission, 'ADMITTED', 'fixture: the reader is an admitted registered viewer');
  return f;
}

// ------------------------------------------------------------------------------------------- 2–4. entitlement, discussion
async function verifyDiscussion(f) {
  // E01 the seam answers NOT_EVALUATED: nobody may contribute, and nothing is written.
  assert.deepEqual(await capability(f.reader, f.a.experience), [{ can_contribute: false }], 'E01 not entitled');
  assert.equal((await post(f.reader, f.a.experience, 'a first thought')).outcome, 'NOT_ENTITLED', 'E01 contribution fails closed');
  assert.equal(Number((await own(`SELECT count(*) n FROM ${T.POSTS} WHERE experience_id = $1`, [f.a.experience]))[0].n), 0, 'E01 nothing written');
  await entitle();
  assert.deepEqual(await capability(f.reader, f.a.experience), [{ can_contribute: true }], 'E02 the simulated seam opens contribution');

  // D01 a top-level post on the served version, through the frozen writer; the Public Identity is provisioned once.
  const command = randomUUID();
  const p1 = await post(f.reader, f.a.experience, 'A thought on this', null, command);
  assert.equal(p1.outcome, 'POSTED');
  assert.equal(p1.thread_root_id, p1.post_id);
  assert.equal(p1.qandeel_invoked, false);
  const [stored] = await own(`SELECT * FROM ${T.POSTS} WHERE id = $1`, [p1.post_id]);
  assert.equal(stored.target_experience_version_id, f.a.version, 'D01 bound to the exact served version');
  assert.equal(stored.post_body, 'A thought on this', 'D01 the words are kept verbatim');
  // D02 idempotent per command; the same command for another Experience is a conflict.
  const again = await post(f.reader, f.a.experience, 'A thought on this', null, command);
  assert.deepEqual([again.outcome, again.post_id], ['ALREADY_COMMITTED', p1.post_id], 'D02 retry');
  await rejected(() => post(f.reader, f.b.experience, 'A thought on this', null, command), ['23505']);
  // D03 replies: one visible depth.
  const r1 = await post(f.stranger, f.a.experience, 'A reply', p1.post_id);
  assert.deepEqual([r1.outcome, r1.thread_root_id], ['REPLIED', p1.post_id], 'D03 a reply sits under its root');
  const r2 = await post(f.mohamed, f.a.experience, 'A reply to the reply', r1.post_id);
  assert.deepEqual([r2.outcome, r2.thread_root_id], ['REPLIED', p1.post_id], 'D03 a reply to a reply joins the same root');
  assert.equal((await own(`SELECT parent_post_id FROM ${T.POSTS} WHERE id = $1`, [r2.post_id]))[0].parent_post_id, p1.post_id,
    'D03 stored under the root, without changing 0096 storage');
  // D04 a reply target that is not a served post of this Experience is one neutral answer.
  assert.equal((await post(f.reader, f.b.experience, 'x', p1.post_id)).outcome, 'UNAVAILABLE', 'D04 another Experience\'s post');
  assert.equal((await post(f.reader, f.a.experience, 'x', randomUUID())).outcome, 'UNAVAILABLE', 'D04 a guessed post');
  assert.equal((await post(randomUUID(), f.a.experience, 'x')).outcome, 'UNAVAILABLE', 'D04 an unadmitted human');
  assert.equal((await post(f.reader, randomUUID(), 'x')).outcome, 'UNAVAILABLE', 'D04 a guessed Experience');
  await rejected(() => post(f.reader, f.a.experience, '   '), ['22023']);
  await rejected(() => post(f.reader, f.a.experience, 'x'.repeat(4001)), ['22023']);
  // D05 the read: the served version's posts, Public display only, own flag, ordinal order, paged.
  const read = await discussion(f.reader, f.a.experience);
  assert.deepEqual(read.map((r) => r.post_id), [p1.post_id, r1.post_id, r2.post_id], 'D05 canonical ordinal order');
  assert.deepEqual(read.map((r) => r.thread_root_id), [p1.post_id, p1.post_id, p1.post_id]);
  assert.deepEqual(read.map((r) => r.is_own), [true, false, false], 'D05 the reader\'s own post only');
  const [display] = await own(`SELECT d.display_label FROM public.public_identity_display_state d
    JOIN public.public_identities i ON i.public_identity_ref = d.public_identity_ref WHERE i.user_id = $1`, [f.stranger]);
  assert.equal(read[1].author_display_label, display.display_label, 'D05 the canonical Public Identity display, joined now');
  f.labels = (await own('SELECT d.display_label FROM public.public_identity_display_state d')).map((r) => r.display_label);
  assert.ok(!Object.keys(read[0]).some((k) => /user|identity_ref|account|email|login/u.test(k)), 'D05 no private identity column');
  assert.deepEqual((await discussion(f.reader, f.a.experience, read[0].post_ordinal)).map((r) => r.post_id), [r1.post_id, r2.post_id], 'D05 paging');
  // D06 vitality: the frozen 0097 recompute now runs; counts never move geography.
  const shown = await panel(f.reader, f.a.experience);
  assert.equal(shown.discussion_post_count, 3, 'D06 the discussion count is current');
  assert.deepEqual([shown.world_x, shown.world_y], ['1000000', '2000000'], 'D06 counts move no coordinate');

  // Q01 @qandeel: case-insensitive, standalone, verbatim, one per post.
  const q1 = await post(f.reader, f.a.experience, 'What do you see here, @QANDEEL? and again @qandeel');
  assert.equal(q1.qandeel_invoked, true, 'Q01 invoked, case-insensitively');
  assert.equal((await invocations(q1.post_id)).length, 1, 'Q01 two tokens, one invocation');
  assert.equal((await own(`SELECT post_body FROM ${T.POSTS} WHERE id = $1`, [q1.post_id]))[0].post_body,
    'What do you see here, @QANDEEL? and again @qandeel', 'Q01 the mention is kept verbatim');
  for (const body of ['write to mail@qandeel.com', 'not @qandeelish', 'the @@qandeel', 'qandeel alone', 'visit qandeel.com',
    'visit @qandeel.com', 'see @qandeel.ar/x', 'the @qandeel_bot']) {
    assert.equal((await post(f.reader, f.a.experience, body)).qandeel_invoked, false, `Q02 "${body}" is not an invocation`);
  }
  // Q02b ordinary punctuation around the standalone token still invokes (the regex is a pure function: no post needed).
  for (const body of ['@qandeel, what is this?', 'tell me, @qandeel.', '(@qandeel)', 'ما رأيك @qandeel؟', 'يا @qandeel، انظر',
    '@qandeel.\nnext line', 'hi @qandeel!', '@qandeel']) {
    assert.equal((await own('SELECT public_discussion_private.invokes_qandeel_v1($1) AS v', [body]))[0].v, true, `Q02b "${body}" invokes`);
  }
  for (const body of ['visit @qandeel.com', 'mail@qandeel.com', '@qandeelish', '@@qandeel', 'qandeel.com']) {
    assert.equal((await own('SELECT public_discussion_private.invokes_qandeel_v1($1) AS v', [body]))[0].v, false, `Q02b "${body}" does not invoke`);
  }
  const q2 = await post(f.stranger, f.a.experience, '@qandeel what does this reply mean?', p1.post_id);
  assert.deepEqual([q2.outcome, q2.qandeel_invoked], ['REPLIED', true], 'Q03 a reply may invoke too');
  assert.equal((await discussion(f.reader, f.a.experience)).find((r) => r.post_id === q1.post_id).qandeel_state, 'PENDING', 'Q04 pending');
  Object.assign(f, { p1, r1, r2, q1, q2 });
}

// ------------------------------------------------------------------------------------------------- 5. QANDEEL work
async function verifyWork(f) {
  assert.equal((await begin(f.q1.post_id, f.stranger)).work_outcome, 'UNAVAILABLE', 'W01 only the invoking author');
  assert.equal((await begin(f.p1.post_id, f.reader)).work_outcome, 'UNAVAILABLE', 'W01 only an invoking post');
  const granted = await begin(f.q1.post_id, f.reader);
  assert.equal(granted.work_outcome, 'GRANTED', 'W02 granted');
  assert.equal((await begin(f.q1.post_id, f.reader)).work_outcome, 'IN_PROGRESS', 'W02 one live lease per invocation');
  assert.deepEqual(await context(f.q1.post_id, randomUUID()), [], 'W03 no context without the live lease');

  // W03 THE PUBLIC CONTEXT FIREWALL: public-visible truth only.
  const ctx = await context(f.q1.post_id, granted.work_lease_id);
  const kinds = [...new Set(ctx.map((c) => c.context_kind))];
  assert.deepEqual(kinds.sort(), ['CONTENT', 'MEANING', 'POST', 'THEME', 'VERSION'].sort(), 'W03 only public classes');
  assert.equal(ctx.find((c) => c.context_kind === 'VERSION').context_ref, f.a.version);
  assert.equal(ctx.find((c) => c.context_kind === 'MEANING').context_text, 'Fear for a family while work feels uncertain');
  assert.deepEqual(ctx.filter((c) => c.context_kind === 'CONTENT').map((c) => c.context_text), [f.userText], 'W03 the published package');
  assert.deepEqual(ctx.filter((c) => c.context_role === 'INVOKING').map((c) => c.context_ref), [f.q1.post_id], 'W03 the invoking post');
  const texts = ctx.map((c) => c.context_text ?? '').join('\n');
  for (const secret of [f.assistantText, 'a sentence Mohamed wrote', 'a sentence a second publisher committed', ...f.labels]) {
    assert.ok(!texts.includes(secret), `W03 "${secret}" (private, unpublished, or an identity) never enters the context`);
  }
  assert.ok(ctx.filter((c) => c.context_kind === 'POST').every((c) => Number(c.context_ordinal) <= Number(f.q1.post_ordinal)),
    'W03 nothing after the invocation');

  // W04 a stale completion is discarded, ends the lease and marks the invocation unanswered.
  assert.equal((await complete(f.q1.post_id, granted.work_lease_id, randomUUID(), 'A reading', [])).outcome, 'STALE', 'W04 stale');
  assert.equal((await discussion(f.reader, f.a.experience)).find((r) => r.post_id === f.q1.post_id).qandeel_state, 'UNAVAILABLE', 'W04 truthful');
  assert.equal((await complete(f.q1.post_id, granted.work_lease_id, f.a.version, 'A reading', [])).outcome, 'UNAVAILABLE', 'W04 no lease');

  // W05 one response through the frozen writer.
  const again = await begin(f.q1.post_id, f.reader);
  assert.equal(again.work_outcome, 'GRANTED', 'W05 a new attempt');
  const consumed = (await context(f.q1.post_id, again.work_lease_id)).filter((c) => c.context_kind === 'POST').map((c) => c.context_ref);
  const done = await complete(f.q1.post_id, again.work_lease_id, f.a.version, 'Here is what this public Experience shows.', consumed);
  assert.equal(done.outcome, 'RESPONSE_RECORDED', 'W05 recorded');
  const [response] = await own(`SELECT * FROM ${T.RESPONSES} WHERE id = $1`, [done.response_id]);
  assert.deepEqual([response.in_reply_to_post_id, response.experience_version_id, response.producer_kind],
    [f.q1.post_id, f.a.version, 'PUBLIC_QANDEEL'], 'W05 bound to the invoking post and the exact version; no human author');
  const row = (await discussion(f.reader, f.a.experience)).find((r) => r.post_id === f.q1.post_id);
  assert.deepEqual([row.qandeel_state, row.qandeel_response_body], ['RESPONDED', 'Here is what this public Experience shows.'], 'W05 served');
  assert.equal((await panel(f.reader, f.a.experience)).qandeel_response_count, 1, 'W05 vitality');
  // W06 at most one response per invocation, however often it is asked.
  assert.equal((await begin(f.q1.post_id, f.reader)).work_outcome, 'ALREADY_COMMITTED', 'W06');
  assert.equal(Number((await own(`SELECT count(*) n FROM ${T.RESPONSES} WHERE in_reply_to_post_id = $1`, [f.q1.post_id]))[0].n), 1, 'W06 one');
  // W07 end: only the exact holder's lease; an unanswered end is told truthfully.
  const w = await begin(f.q2.post_id, f.stranger);
  assert.equal(await end(f.q2.post_id, randomUUID(), true), false, 'W07 a stranger lease releases nothing');
  assert.equal(await end(f.q2.post_id, w.work_lease_id, true), true, 'W07 released');
  assert.equal((await discussion(f.reader, f.a.experience)).find((r) => r.post_id === f.q2.post_id).qandeel_state, 'UNAVAILABLE', 'W07');
  // W08 the in-flight bound: two at once, the third is LIMITED.
  const more = [];
  for (let i = 0; i < 3; i += 1) more.push((await post(f.reader, f.a.experience, `@qandeel ${i}`)).post_id);
  assert.equal((await begin(more[0], f.reader)).work_outcome, 'GRANTED');
  assert.equal((await begin(more[1], f.reader)).work_outcome, 'GRANTED');
  assert.equal((await begin(more[2], f.reader)).work_outcome, 'LIMITED', 'W08 bounded');
  // W09 the invocation guard: a linked response is never re-linked; nothing is deleted.
  await asRole('postgres');
  await rejected(() => q(`UPDATE ${SCHEMA}.qandeel_invocations SET response_id = NULL WHERE post_id = $1`, [f.q1.post_id]), ['55000']);
  await rejected(() => q(`DELETE FROM ${SCHEMA}.qandeel_invocations WHERE post_id = $1`, [f.q1.post_id]), ['55000']);
}

// ---------------------------------------------------------------------------------------------- 6. Activity source
async function verifySource(f) {
  const ids = (list) => list.map((r) => `${r.recipient_user_id}:${r.event_kind}`).sort();
  assert.deepEqual(ids(await source('DISCUSSION_POST', f.p1.post_id)), [`${f.mohamed}:POST_ON_OWN_EXPERIENCE`], 'A01 the controller');
  const ownPost = await post(f.mohamed, f.a.experience, 'The publisher adds a note');
  assert.deepEqual(await source('DISCUSSION_POST', ownPost.post_id), [], 'A01 never the actor');
  assert.deepEqual(ids(await source('DISCUSSION_POST', f.r1.post_id)), [`${f.reader}:REPLY_TO_OWN_POST`], 'A02 the parent\'s author');
  const selfReply = await post(f.reader, f.a.experience, 'Replying to myself', f.p1.post_id);
  assert.deepEqual(await source('DISCUSSION_POST', selfReply.post_id), [], 'A02 never the actor');
  await as(f.mohamed);
  const asked = await first('SELECT * FROM public.request_public_relation_v1($1, $2, $3)', [randomUUID(), f.a.experience, f.b.experience]);
  assert.deepEqual(ids(await source('RELATION_REQUEST', asked.relation_id)), [`${f.stranger}:RELATION_REQUEST`], 'A03 the target controller');
  assert.deepEqual(await source('RELATION_ACCEPTED', asked.relation_id), [], 'A03 not accepted yet');
  await as(f.stranger);
  assert.equal((await first('SELECT * FROM public.accept_public_relation_v1($1, $2)', [randomUUID(), asked.relation_id])).outcome, 'ACCEPTED');
  assert.deepEqual(await source('RELATION_REQUEST', asked.relation_id), [], 'A04 no longer pending');
  assert.deepEqual(ids(await source('RELATION_ACCEPTED', asked.relation_id)), [`${f.mohamed}:RELATION_ACCEPTED`], 'A04 the requester');
  assert.deepEqual(ids(await source('RELATION_ENDED', asked.relation_id)), [`${f.stranger}:RELATION_REQUEST`], 'A05 whom to withdraw from');
  assert.deepEqual(await source('DISCUSSION_POST', randomUUID()), [], 'A06 a guessed source');
  await asRole('service_role');
  await rejected(() => q('SELECT * FROM public.server_read_public_activity_source_v1($1, $2)', ['VIEWED', randomUUID()]), ['22023']);
  for (const uid of [f.reader, f.mohamed]) {
    await as(uid);
    await rejected(() => q('SELECT * FROM public.server_read_public_activity_source_v1($1, $2)', ['DISCUSSION_POST', f.p1.post_id]), ['42501']);
    await rejected(() => q('SELECT * FROM public.begin_public_qandeel_work_v1($1, $2)', [f.q2.post_id, uid]), ['42501']);
  }
  await asRole('service_role');
  await rejected(() => q('SELECT * FROM public.post_own_public_discussion_v1($1, $2, $3, $4)', [randomUUID(), f.a.experience, null, 'x']), ['42501']);
  f.relation = asked.relation_id;
}

// ------------------------------------------------------------------------------------------------ 7. disappearance
async function verifyDisappearance(f) {
  await q('SAVEPOINT gone');
  const pending = (await post(f.reader, f.a.experience, '@qandeel before it goes')).post_id;
  await asRole('postgres');
  await q(`DELETE FROM ${SCHEMA}.qandeel_work_leases`);
  const lease = (await begin(pending, f.reader)).work_lease_id;
  await asRole('postgres'); await actAs(f.mohamed);
  const [removed] = await rt.removeFromPublicWorld(randomUUID(), f.a.experience, f.a.version);
  assert.ok(removed, 'G01 the owner removed the Experience from the Public World');
  assert.deepEqual(await discussion(f.reader, f.a.experience), [], 'G01 no discussion, no tombstone');
  assert.deepEqual(await capability(f.reader, f.a.experience), [], 'G01 nothing to contribute to');
  assert.equal((await post(f.reader, f.a.experience, 'still here?')).outcome, 'UNAVAILABLE', 'G01 no write');
  assert.deepEqual(await context(pending, lease), [], 'G02 the context goes dark under a live lease');
  assert.equal((await complete(pending, lease, f.a.version, 'too late', [])).outcome, 'STALE', 'G02 the result is discarded');
  assert.equal((await begin(pending, f.reader)).work_outcome, 'UNAVAILABLE', 'G02 no new work');
  assert.deepEqual(await source('DISCUSSION_POST', f.p1.post_id), [], 'G03 no Activity source');
  assert.deepEqual(await source('RELATION_ACCEPTED', f.relation), [], 'G03 the relation is not current');
  assert.ok(Number((await own(`SELECT count(*) n FROM ${T.POSTS} WHERE experience_id = $1`, [f.a.experience]))[0].n) > 0,
    'G04 0099: internal history survives; only serving stops');
  await asRole('postgres');
  await q('ROLLBACK TO SAVEPOINT gone'); await q('RELEASE SAVEPOINT gone');
}

await runVerifier('0147', async (stage) => {
  await rt.client.connect();
  stage('boundary');
  await verifyBoundary();
  await q('BEGIN');
  try {
    stage('fixture');
    const seam = await rt.captureSeam();
    const f = await fixture(seam);
    stage('entitlement and discussion');
    await verifyDiscussion(f);
    stage('QANDEEL work');
    await verifyWork(f);
    stage('Activity source');
    await verifySource(f);
    stage('disappearance');
    await verifyDisappearance(f);
  } finally {
    await q('ROLLBACK');
  }
  stage('launch closure');
  await asRole('postgres');
  const entitlement = (await rt.functionPosture(ENTITLEMENT)).prosrc;
  assert.ok(entitlement.includes('NOT_EVALUATED') && !entitlement.includes("'ENTITLED'"), 'X01 the entitlement seam is restored');
  const seam = (await rt.functionPosture(SEAM)).prosrc;
  assert.ok(seam.includes('NOT_EVALUATED') && !seam.includes("'CLEARED'"), 'X01 the publication seam still answers NOT_EVALUATED');
  console.log('Verified migration 0147: Public discussion is the frozen 0096 runtime reached through one narrow human command and one paged read, on the served version only, Public display only, one visible depth, idempotent, vitality recomputed; contribution fails closed on the NOT_EVALUATED entitlement seam; @qandeel is case-insensitive, standalone, verbatim and answered at most once per post, under a bounded server lease, from a strictly public context, revalidated before the frozen writer records it; Activity recipients are derived from Public truth and never the actor; disappearance darkens every read, command and source; nothing publishes.');
});
