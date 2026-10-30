// S8A-05 CP4 — Public discussion threads and the branch-scoped Public QANDEEL context: the real-PostgreSQL verifier for 0182
// (Controlled Amendment A-5).
//
// It proves, against a fully migrated database, with synthetic humans and synthetic topics only:
//   1. the boundary: every 0182 function is a pinned postgres-owned `public_thread_private` SECURITY DEFINER or a pinned
//      `public` INVOKER wrapper; `authenticated` executes exactly the v2 post and the v2 read, `service_role` exactly the
//      v2 context read; the reply-target relation is private, RLS-on, privilege-free, immutable and holds no text; the
//      context's columns carry no author, display or account; no body reaches private truth; the 0147 schema still holds
//      exactly its functions; the AI-COST-01 family list is the 0181 list plus exactly PUBLIC_QANDEEL_REPLY and begin
//      admits it for the paying human; both CW2-08 seams answer NOT_EVALUATED; still five lifecycle movers;
//   2. the exact reply target (A-5(a)): a reply keeps the post it answers beside the 0096 thread root, which is unchanged;
//      a retry, a refusal or a top-level post writes no target; a reply through the older v1 command answers its root;
//   3. the topic's author (A-5(b)): the read says OP for exactly the posts of the Experience's creating Public Identity,
//      as a boolean, with no identifier;
//   4. the Activity source: REPLY_TO_OWN_POST goes to the author of the exact post answered, never the actor;
//   5. the branch-scoped context (A-5(c)): the invoking post's chain to its root, the root and at most 8 more posts of
//      the same thread before it, each with its speaker role and the post it answers; earlier QANDEEL responses attached
//      to the posts they answered; the topic as one bounded text (0180's labelled input for a sourced topic, at most
//      6 KB; the served items for an S5-02 package); no other thread, no later post, no related topic, no author, no
//      unpublished words; nothing without the live lease or once the Experience leaves the Public World; the unchanged
//      0147 completion accepts what it consumed.
import assert from 'node:assert/strict';
import { VOICE_COST_PROBE, VOICE_FAMILIES } from './voice-cost-families-0184.mjs';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, SEAM, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, actAs, asRole, rejected } = rt;
const own = async (text, values = []) => { await asRole('postgres'); return rows(text, values); };
const as = async (uid) => asRole('authenticated', uid);
const first = async (text, values = []) => (await rows(text, values))[0];
const marker = () => randomUUID().replace(/[^a-f]/gu, '').slice(0, 12);

const SCHEMA = 'public_thread_private';
const ENTITLEMENT = 'public_discussion_private.resolve_public_discussion_entitlement_v1(uuid)';
const FREEZE_SEAM = 'public_compose_private.resolve_topic_freeze_clearance_v1()';
const HUMAN = {
  post_own_public_discussion_v2: ['p_command_id uuid', 'p_experience_id uuid', 'p_reply_to_post_id uuid', 'p_body text'],
  read_public_discussion_posts_v2: ['p_experience_id uuid', 'p_after_ordinal bigint'],
};
const SERVER = { read_public_qandeel_context_v2: ['p_post_id uuid', 'p_lease_id uuid'] };
const INTERNAL = ['reject_reply_target_mutation_v1'];
const S504 = ['begin_public_qandeel_work_v1', 'complete_public_qandeel_work_v1', 'end_public_qandeel_work_v1', 'guard_invocation_v1',
  'invokes_qandeel_v1', 'is_admitted_v1', 'is_entitled_v1', 'post_own_public_discussion_v1', 'qandeel_work_policy_v1',
  'read_public_discussion_capability_v1', 'read_public_discussion_posts_v1', 'read_public_qandeel_context_v1',
  'resolve_public_discussion_entitlement_v1', 'served_version_v1', 'server_read_public_activity_source_v1'];
const FAMILIES = ['CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION', 'THREAD_FORMATION', 'THREAD_CONTINUITY',
  'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION', 'PERSONAL_UNDERSTANDING_CAPTURE',
  'SHARED_SEMANTIC_READING', 'SHARED_KNOWLEDGE_RECALL', 'SHARED_SPATIAL_PLACEMENT', 'SHARED_DISCLOSURE_JUDGE', 'PUBLIC_SEMANTIC_INTERPRETATION',
  'PUBLIC_QANDEEL_REPLY'];
const READ_V1_COLUMNS = ['post_id', 'thread_root_id', 'post_ordinal', 'author_label_mode', 'author_display_label', 'post_body', 'posted_at',
  'is_own', 'qandeel_state', 'qandeel_response_body', 'qandeel_responded_at'];

// ---- the S5-04 and 0182 commands
const postV2 = async (uid, experience, body, replyTo = null, command = randomUUID()) => {
  await as(uid); return first('SELECT * FROM public.post_own_public_discussion_v2($1, $2, $3, $4)', [command, experience, replyTo, body]);
};
const postV1 = async (uid, experience, body, replyTo = null) => {
  await as(uid); return first('SELECT * FROM public.post_own_public_discussion_v1($1, $2, $3, $4)', [randomUUID(), experience, replyTo, body]);
};
const readV2 = async (uid, experience, after = null) => {
  await as(uid); return rows('SELECT * FROM public.read_public_discussion_posts_v2($1, $2)', [experience, after]);
};
const server = async (text, values) => { await asRole('service_role'); return rows(text, values); };
const begin = async (postId, uid) => (await server('SELECT * FROM public.begin_public_qandeel_work_v1($1, $2)', [postId, uid]))[0];
const contextV2 = (postId, lease) => server('SELECT * FROM public.read_public_qandeel_context_v2($1, $2)', [postId, lease]);
const complete = async (postId, lease, version, body, consumed) =>
  (await server('SELECT * FROM public.complete_public_qandeel_work_v1($1, $2, $3, $4, $5::uuid[])', [postId, lease, version, body, consumed]))[0];
const source = (kind, id) => server('SELECT * FROM public.server_read_public_activity_source_v1($1, $2)', [kind, id]);
const targetsOf = (postId) => own(`SELECT reply_to_post_id FROM ${SCHEMA}.reply_targets WHERE post_id = $1`, [postId]);
async function entitle() {
  await asRole('postgres');
  await q(`CREATE OR REPLACE FUNCTION ${ENTITLEMENT.replace('(uuid)', '')}(p_user_id uuid)
    RETURNS TABLE (entitlement_state text, basis text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
      SELECT 'ENTITLED'::text, 'S8A-05 CP4 VERIFIER PROBE: simulated entitlement inside a rolled-back transaction; never a production state'::text $$`);
}

// ---- the Product paths to a served topic (as in verify-migration-0147 / 0181), each as the human's own role
async function provisionUnit(uid, text) {
  const session = randomUUID(); const turn = randomUUID(); const batch = randomUUID(); const unit = randomUUID();
  await asRole('postgres');
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
/** READY_FOR_REVIEW through the S5-02 Product path. */
async function readyS502(uid, unit) {
  await as(uid);
  const experience = (await first('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()])).experience_id;
  assert.equal((await first('SELECT * FROM public.prepare_own_public_experience_package_v1($1, $2, $3::uuid[], $4::uuid[], $5::uuid[])',
    [randomUUID(), experience, [unit], [], []])).outcome, 'PREPARED');
  const [{ v, m }] = await own(`SELECT e.current_experience_version_id v, ve.package_manifest_version_id m FROM ${T.EXPERIENCES} e
    JOIN ${T.VERSIONS} ve ON ve.id = e.current_experience_version_id WHERE e.id = $1`, [experience]);
  await as(uid);
  assert.equal((await first('SELECT * FROM public.approve_own_public_package_v1($1, $2)', [randomUUID(), m])).outcome, 'APPROVED');
  assert.equal((await first('SELECT * FROM public.commit_own_public_experience_ready_v1($1, $2)', [randomUUID(), experience])).outcome, 'READY_FOR_REVIEW');
  return { experience, version: v, manifest: m, uid };
}
async function conversation(uid, messages) {
  await asRole('postgres');
  const session = randomUUID();
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, uid]);
  let sp = 0;
  for (const message of messages) {
    const turn = randomUUID();
    const batch = randomUUID();
    await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
             VALUES ($1, $2, $3, $4, 'COMPLETED', 'turn')`, [turn, session, uid, message.role]);
    await q(`INSERT INTO public.conversation_unit_commit_batches
               (id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256, unit_count,
                evaluator_version, policy_version, segmentation_provider, segmentation_model, segmentation_prompt_version)
             VALUES ($1, $2, $3, $4, sha256(convert_to($5, 'UTF8')), sha256(convert_to($6, 'UTF8')), 1, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
    [batch, uid, session, turn, `fp ${turn}`, `t ${turn}`]);
    sp += 1;
    await q(`INSERT INTO public.conversation_units
               (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state, source_modality,
                ordinal_within_turn, source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
             VALUES ($1, $2, $3, $4, $5, $6, 'RESOLVED', 'TEXT', 0, 0, $7, $8, sha256(convert_to($8, 'UTF8')), $9)`,
    [randomUUID(), uid, session, turn, batch, message.role, [...message.text].length, message.text, sp]);
  }
  await q('UPDATE public.session_semantic_clocks SET current_sp = $2 WHERE session_id = $1', [session, sp]);
  return { session, last: sp };
}
/** READY_FOR_REVIEW through the S8A-05 CP2 path: my own messages, a title, a section and a written text, frozen. */
async function readySourced(uid, messages, title, written, emphasized = []) {
  const chat = await conversation(uid, messages);
  const draft = randomUUID();
  await as(uid);
  assert.equal((await first('SELECT * FROM public.set_own_topic_conversation_source_v1($1, 0, $2, 1, $3, false, $4::int[], $5::int[])',
    [draft, chat.session, chat.last, [], emphasized])).outcome, 'CREATED');
  assert.equal((await first('SELECT * FROM public.save_own_topic_draft_v1($1, 1, $2, $3, $4)', [draft, title, written, 'family'])).outcome, 'SAVED');
  const frozen = await first('SELECT * FROM public.freeze_own_topic_draft_v1($1, $2, 2)', [randomUUID(), draft]);
  assert.deepEqual([frozen.outcome, frozen.current_lifecycle], ['PREPARED', 'READY_FOR_REVIEW'], 'fixture: a sourced topic is READY_FOR_REVIEW');
  const [{ v, m }] = await own(`SELECT e.current_experience_version_id v, ve.package_manifest_version_id m FROM ${T.EXPERIENCES} e
    JOIN ${T.VERSIONS} ve ON ve.id = e.current_experience_version_id WHERE e.id = $1`, [frozen.experience_id]);
  return { experience: frozen.experience_id, version: v, manifest: m, uid };
}
/** Reviewed, placed and published through the simulated CW2-08 seam (inside the rolled-back transaction only). */
async function publish(seam, e, p, x, y) {
  await as(e.uid);
  const work = (await first('SELECT * FROM public.request_own_public_semantic_proposal_v1($1, $2)', [randomUUID(), e.experience])).work_id;
  await asRole('service_role');
  assert.equal((await first('SELECT * FROM public.record_public_semantic_work_outcome_v1($1, $2, $3, $4, $5::text[], $6::text[], $7)',
    [work, 'PROPOSED', p.lens, p.meaning, p.primary, p.secondary, 'Why, in the analysis.'])).outcome, 'RECORDED');
  await as(e.uid);
  const committed = await first('SELECT * FROM public.commit_own_public_semantic_work_v1($1)', [work]);
  assert.equal((await first('SELECT * FROM public.accept_own_public_semantic_proposal_v1($1, $2, $3)',
    [randomUUID(), e.experience, committed.interpretation_id])).outcome, 'ACCEPTED');
  const opened = await first('SELECT * FROM public.request_own_public_spatial_placement_v1($1, $2)', [randomUUID(), e.experience]);
  await asRole('service_role');
  assert.equal((await first('SELECT * FROM public.commit_public_spatial_placement_v1($1, $2, $3, $4)',
    [opened.request_id, 'test.layout.v1', x, y])).outcome, 'PLACED');
  await asRole('postgres');
  const [published] = await rt.publishCleared(seam, e.uid, randomUUID(), e.experience, e.version);
  assert.equal(published.outcome, 'PUBLISHED', 'fixture: published through the simulated CW2-08 seam only');
  return e;
}
async function openFreeze() {
  await asRole('postgres');
  const [seam] = await rows('SELECT pg_get_functiondef(p.oid) d, p.prosrc FROM pg_proc p WHERE p.oid = $1::regprocedure', [FREEZE_SEAM]);
  await q(`CREATE OR REPLACE FUNCTION ${FREEZE_SEAM.replace('()', '')}()
           RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $probe$
             SELECT 'CLEARED'::text -- S8A-05 CP4 VERIFIER PROBE: inside a rolled-back verifier transaction only
           $probe$`);
  return seam;
}
async function closeFreeze(seam) {
  await asRole('postgres');
  await q(seam.d);
  assert.equal((await rt.functionPosture(FREEZE_SEAM)).prosrc, seam.prosrc, 'the production freeze seam is restored byte for byte');
}

// --------------------------------------------------------------------------------------------------------- 1. boundary
async function verifyBoundary() {
  await asRole('postgres');
  const fns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) owner, p.prosrc
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(fns.map((f) => f.proname).sort(), [...Object.keys(HUMAN), ...Object.keys(SERVER), ...INTERNAL].sort(),
    'B01 the thread schema holds exactly the 0182 functions');
  for (const f of fns) {
    assert.equal(f.prosecdef, true, `B01 ${f.proname} is a definer`);
    assert.equal(f.owner, 'postgres');
    assert.deepEqual(f.proconfig, ['search_path=""'], `B01 ${f.proname} pins an empty search_path`);
  }
  const s504 = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public_discussion_private' ORDER BY 1`);
  assert.deepEqual(s504.map((f) => f.proname).sort(), [...S504].sort(), 'B01 the 0147 schema still holds exactly its functions');
  const exposed = { ...HUMAN, ...SERVER };
  const wrappers = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [Object.keys(exposed)]);
  assert.equal(wrappers.length, Object.keys(exposed).length, 'B02 each exposed function has exactly one public wrapper');
  for (const w of wrappers) {
    assert.equal(w.prosecdef, false, `B02 public.${w.proname} is an INVOKER wrapper`);
    assert.deepEqual(w.proconfig, ['search_path=""']);
    assert.equal(w.args, exposed[w.proname].join(', '), `B02 public.${w.proname} accepts exactly its inputs`);
  }
  const executable = await rows(`SELECT r.rolname, n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT unnest($2::text[]) rolname) r
    WHERE EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
      AND (n.nspname = $3 OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`, [Object.keys(exposed), APP_ROLES, SCHEMA]);
  assert.deepEqual(executable.map((e) => `${e.rolname} ${e.fn}`).sort(), [
    ...Object.keys(HUMAN).flatMap((n) => [`authenticated public.${n}`, `authenticated ${SCHEMA}.${n}`]),
    ...Object.keys(SERVER).flatMap((n) => [`service_role public.${n}`, `service_role ${SCHEMA}.${n}`]),
  ].sort(), 'B03 the human post and read are the human\'s; the context is the server\'s; the trigger function is nobody\'s');
  const publicExec = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname = $2 OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')`,
  [Object.keys(exposed), SCHEMA]);
  assert.deepEqual(publicExec, [], 'B03 no 0182 function keeps PUBLIC EXECUTE');
  for (const role of APP_ROLES) {
    assert.equal(await rt.canExecute(role, 'public.server_read_public_activity_source_v1(text, uuid)'), role === 'service_role',
      `B03 the replaced Activity source read keeps its 0147 grant (${role})`);
  }
  const tables = await rows(`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm') ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(tables.map((t) => t.relname), ['reply_targets'], 'B04 exactly one relation');
  assert.equal(tables[0].relrowsecurity, true, 'B04 RLS on');
  for (const role of APP_ROLES) {
    const [{ any }] = await rows(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT')
      OR has_table_privilege($1, $2, 'UPDATE') OR has_table_privilege($1, $2, 'DELETE') AS any`, [role, `${SCHEMA}.reply_targets`]);
    assert.equal(any, false, `B04 ${role} holds no privilege on reply_targets`);
  }
  const columns = await rows(`SELECT a.attname, format_type(a.atttypid, a.atttypmod) t FROM pg_attribute a
    WHERE a.attrelid = '${SCHEMA}.reply_targets'::regclass AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`);
  assert.deepEqual(columns.map((c) => `${c.attname} ${c.t}`), ['post_id uuid', 'experience_id uuid', 'reply_to_post_id uuid',
    'recorded_at timestamp with time zone'], 'B04 no text, no account, no label');
  assert.equal(await rt.triggerEnabled(`${SCHEMA}.reply_targets`, 'reply_targets_immutable'), true, 'B04 the immutability trigger is enabled');
  // B05 the Public context firewall: no body reaches private truth; the context's columns carry no author or account.
  for (const f of fns) {
    assert.doesNotMatch(f.prosrc, /provenance|shared_world|shared_private|conversation_|memor|human_model|(^|[^a-z])him_|hypothes|matching|introduction|standing_context|login_id|email|public\.users|derivative_bodies/iu,
      `B05 ${f.proname} reaches no private or Shared truth`);
  }
  const contextBody = fns.find((f) => f.proname === 'read_public_qandeel_context_v2').prosrc;
  assert.doesNotMatch(contextBody, /display_label|label_mode|author_user_id|controller|explicit_relations|RELATED/u,
    'B05 the context reads no display, account, controller or related topic');
  assert.deepEqual(await rt.resultColumns(`${SCHEMA}.read_public_qandeel_context_v2(uuid, uuid)`),
    ['context_kind', 'context_role', 'context_ordinal', 'context_ref', 'context_text', 'speaker', 'answers_ref'], 'B05 the context columns');
  assert.deepEqual(await rt.resultColumns(`${SCHEMA}.read_public_discussion_posts_v2(uuid, bigint)`), [...READ_V1_COLUMNS, 'reply_to_post_id', 'is_op'],
    'B05 the read is the 0147 read plus the target and the OP flag');
  // B06 AI-COST-01.
  const [{ def }] = await rows(`SELECT pg_get_constraintdef(c.oid) def FROM pg_constraint c
    WHERE c.conrelid = 'public.ai_provider_calls'::regclass AND c.conname = 'ai_provider_calls_feature_family_check'`);
  assert.deepEqual([...def.matchAll(/'([A-Z_]+)'::text/gu)].map((m) => m[1]).sort(), [...FAMILIES,
    // RE-ANCHORED by S8B-02 CP1 (migration 0184, 2026-10-30): 0184 adds exactly the four voice families (0184's own verifier pins the full list); nothing else in this list changes.
    ...((await first(VOICE_COST_PROBE)).voice ? VOICE_FAMILIES : [])].sort(), 'B06 the family list');
  // B07 launch closure and the frozen publication core.
  assert.ok((await rt.functionPosture(SEAM)).prosrc.includes('NOT_EVALUATED'), 'B07 the CW2-08 publication seam answers NOT_EVALUATED');
  const entitlement = (await rt.functionPosture(ENTITLEMENT)).prosrc;
  assert.ok(entitlement.includes('NOT_EVALUATED') && !entitlement.includes("'ENTITLED'"), 'B07 the entitlement seam answers NOT_EVALUATED');
  const [{ movers }] = await rows(`SELECT count(*)::int movers FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
    WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
      AND (pr.prosrc ~ 'UPDATE public\\.public_experiences e\\s+SET current_lifecycle = '''
        OR pr.prosrc ~ 'INSERT INTO public\\.public_experiences\\s+\\(id, public_world_singleton')`);
  assert.equal(movers, 5, 'B07 still exactly five lifecycle movers: no successor-version path is opened');
}

async function verifyFamily() {
  await q('SAVEPOINT family');
  const user = randomUUID();
  await asRole('postgres');
  await q('INSERT INTO auth.users(id) VALUES ($1)', [user]);
  await asRole('service_role');
  await q('SELECT * FROM public.begin_ai_provider_call_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::text,$7::text,$8::text,$9::text)',
    [randomUUID(), user, null, null, 'DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', 'PUBLIC_QANDEEL_REPLY', 'DEEP']);
  const [call] = await own("SELECT user_id, feature_family FROM public.ai_provider_calls WHERE feature_family = 'PUBLIC_QANDEEL_REPLY'");
  assert.deepEqual([call.user_id, call.feature_family], [user, 'PUBLIC_QANDEEL_REPLY'], 'B06 begin admits the family for the paying human');
  await q('ROLLBACK TO SAVEPOINT family'); await q('RELEASE SAVEPOINT family');
}

// ------------------------------------------------------------------------------------------------------- fixture
async function fixture(seam) {
  const f = rt.newFixture();
  await asRole('postgres');
  await rt.provision(f);
  f.strangerUnit = await provisionUnit(f.stranger, 'a sentence a second publisher committed');
  f.a = await publish(seam, await readyS502(f.mohamed, f.userUnit),
    { lens: 'family.fear', meaning: 'Fear for a family while work feels uncertain', primary: ['fear'], secondary: ['work'] }, '1000000', '2000000');
  f.b = await publish(seam, await readyS502(f.stranger, f.strangerUnit),
    { lens: 'courage.daily', meaning: 'Courage found in small daily choices', primary: ['courage'], secondary: [] }, '5000000', '5000000');
  f.titleWord = marker();
  f.messageWord = marker();
  const freeze = await openFreeze();
  try {
    f.t = await readySourced(f.mohamed, [{ role: 'USER', text: `أنا تعبت من الشغل ${f.messageWord}` }, { role: 'USER', text: 'كل يوم نفس الضغط' }],
      `عنوان الموضوع ${f.titleWord}`, 'كتبت هذا عن الشغل');
    f.long = await readySourced(f.mohamed, Array.from({ length: 30 }, (_, k) => ({ role: 'USER', text: `رسالة ${k} ${'ك'.repeat(800)}` })),
      'موضوع طويل', 'نص مكتوب');
  } finally {
    await closeFreeze(freeze);
  }
  await publish(seam, f.t, { lens: 'work.pressure', meaning: 'Tired of the pressure at work', primary: ['work'], secondary: [] }, '9000000', '9000000');
  await publish(seam, f.long, { lens: 'work.pressure', meaning: 'A long topic about work', primary: ['work'], secondary: [] }, '9100000', '9100000');
  assert.equal((await rt.admission(f.reader))[0].admission, 'ADMITTED', 'fixture: the reader is an admitted registered viewer');
  await entitle();
  f.labels = () => own('SELECT d.display_label FROM public.public_identity_display_state d').then((r) => r.map((x) => x.display_label));
  return f;
}

// ---------------------------------------------------------------------------------- 2–4. targets, OP, Activity source
async function verifyThreads(f) {
  // T01 a top-level post writes no target.
  const p1 = await postV2(f.reader, f.a.experience, 'A first thought on this');
  assert.deepEqual([p1.outcome, p1.thread_root_id], ['POSTED', p1.post_id], 'T01 posted through the 0147 command');
  assert.deepEqual(await targetsOf(p1.post_id), [], 'T01 no target for a top-level post');
  // T02 a reply to the root keeps the root as its target.
  const r1 = await postV2(f.stranger, f.a.experience, 'A reply to the first thought', p1.post_id);
  assert.deepEqual([r1.outcome, r1.thread_root_id], ['REPLIED', p1.post_id]);
  assert.deepEqual(await targetsOf(r1.post_id), [{ reply_to_post_id: p1.post_id }], 'T02 the exact target');
  // T03 a reply to a reply: 0096 still stores the root; the exact target is kept beside it.
  const command = randomUUID();
  const r2 = await postV2(f.mohamed, f.a.experience, 'The topic author answers the reply', r1.post_id, command);
  assert.deepEqual([r2.outcome, r2.thread_root_id], ['REPLIED', p1.post_id], 'T03 one visible depth (0147)');
  assert.equal((await own(`SELECT parent_post_id FROM ${T.POSTS} WHERE id = $1`, [r2.post_id]))[0].parent_post_id, p1.post_id,
    'T03 the 0096 storage is unchanged');
  assert.deepEqual(await targetsOf(r2.post_id), [{ reply_to_post_id: r1.post_id }], 'T03 the exact target is the reply');
  // T04 a retry of a committed command answers as 0147 does and writes nothing.
  const again = await postV2(f.mohamed, f.a.experience, 'The topic author answers the reply', r1.post_id, command);
  assert.deepEqual([again.outcome, again.post_id], ['ALREADY_COMMITTED', r2.post_id], 'T04 retry');
  assert.equal(Number((await own(`SELECT count(*) n FROM ${SCHEMA}.reply_targets WHERE post_id = $1`, [r2.post_id]))[0].n), 1, 'T04 one target');
  // T05 a refusal writes nothing.
  assert.equal((await postV2(f.reader, f.b.experience, 'x', p1.post_id)).outcome, 'UNAVAILABLE', 'T05 another Experience\'s post');
  assert.equal((await postV2(f.reader, f.a.experience, 'x', randomUUID())).outcome, 'UNAVAILABLE', 'T05 a guessed post');
  await rejected(() => postV2(f.reader, f.a.experience, '   ', p1.post_id), ['22023']);
  // T06 a reply through the older v1 command has no target row; it answers its root.
  const old = await postV1(f.reader, f.a.experience, 'A reply through the older command', r2.post_id);
  assert.equal(old.outcome, 'REPLIED');
  assert.deepEqual(await targetsOf(old.post_id), [], 'T06 no target row');
  // T07 the target is immutable.
  await asRole('postgres');
  await rejected(() => q(`UPDATE ${SCHEMA}.reply_targets SET reply_to_post_id = $2 WHERE post_id = $1`, [r2.post_id, p1.post_id]), ['55000']);
  await rejected(() => q(`DELETE FROM ${SCHEMA}.reply_targets WHERE post_id = $1`, [r2.post_id]), ['55000']);
  // T08 no other role reaches the commands.
  await asRole('service_role');
  await rejected(() => q('SELECT * FROM public.post_own_public_discussion_v2($1, $2, $3, $4)', [randomUUID(), f.a.experience, null, 'x']), ['42501']);
  await asRole('anon');
  await rejected(() => q('SELECT * FROM public.read_public_discussion_posts_v2($1, $2)', [f.a.experience, null]), ['42501']);
  await as(f.reader);
  await rejected(() => q('SELECT * FROM public.read_public_qandeel_context_v2($1, $2)', [p1.post_id, randomUUID()]), ['42501']);

  // O01 the read: exactly the 0147 read, plus the exact target and the OP flag.
  const v1 = await (async () => { await as(f.reader); return rows('SELECT * FROM public.read_public_discussion_posts_v1($1, $2)', [f.a.experience, null]); })();
  const v2 = await readV2(f.reader, f.a.experience);
  assert.deepEqual(v2.map((r) => Object.fromEntries(READ_V1_COLUMNS.map((k) => [k, r[k]]))), v1, 'O01 the 0147 read, unchanged');
  assert.deepEqual(v2.map((r) => r.post_id), [p1.post_id, r1.post_id, r2.post_id, old.post_id]);
  assert.deepEqual(v2.map((r) => r.reply_to_post_id), [null, p1.post_id, r1.post_id, p1.post_id], 'O01 the exact target; the root for an older reply');
  assert.deepEqual(v2.map((r) => r.is_op), [false, false, true, false], 'O01 OP is exactly the topic author\'s post');
  assert.ok(!Object.keys(v2[0]).some((k) => /user|identity|account|email|login|controller/u.test(k)), 'O01 no identity on the wire');
  // O02 the same human is not OP on another human's topic; the flag follows the creating identity, not a name.
  const onB = await postV2(f.mohamed, f.b.experience, 'A thought on someone else\'s topic');
  const ownB = await postV2(f.stranger, f.b.experience, 'The second topic\'s author speaks');
  const readB = await readV2(f.reader, f.b.experience);
  assert.deepEqual(readB.map((r) => [r.post_id, r.is_op]), [[onB.post_id, false], [ownB.post_id, true]], 'O02 OP per topic');
  const opBody = (await rt.functionPosture(`${SCHEMA}.read_public_discussion_posts_v2(uuid, bigint)`)).prosrc;
  assert.match(opBody, /author_public_identity_ref = e\.created_by_public_identity_ref/u, 'O02 OP compares Public Identities, never a name');
  // O03 paging is the 0147 paging.
  assert.deepEqual((await readV2(f.reader, f.a.experience, v2[1].post_ordinal)).map((r) => r.post_id), [r2.post_id, old.post_id], 'O03 paging');

  // A01 the Activity source: REPLY_TO_OWN_POST goes to the author of the EXACT post answered.
  const ids = (list) => list.map((r) => `${r.recipient_user_id}:${r.event_kind}`).sort();
  assert.deepEqual(ids(await source('DISCUSSION_POST', r2.post_id)), [`${f.stranger}:REPLY_TO_OWN_POST`], 'A01 the replied-to author, not the root\'s');
  assert.deepEqual(ids(await source('DISCUSSION_POST', r1.post_id)), [`${f.reader}:REPLY_TO_OWN_POST`], 'A01 a reply to the root');
  assert.deepEqual(ids(await source('DISCUSSION_POST', old.post_id)), [], 'A02 an older reply goes to its root\'s author — the actor, so nobody');
  const selfReply = await postV2(f.stranger, f.a.experience, 'Replying to my own reply', r1.post_id);
  assert.deepEqual(await source('DISCUSSION_POST', selfReply.post_id), [], 'A03 never the actor');
  assert.deepEqual(ids(await source('DISCUSSION_POST', p1.post_id)), [`${f.mohamed}:POST_ON_OWN_EXPERIENCE`], 'A04 a top-level post is unchanged');
  Object.assign(f, { p1, r1, r2, old, selfReply });
}

// -------------------------------------------------------------------------------------- 5. the branch-scoped context
async function verifyContext(f) {
  // The thread under p1 so far: p1 (reader), r1 (stranger -> p1), r2 (OP -> r1), old (reader, v1 -> root), selfReply (stranger -> r1).
  // A side branch long enough to push the chain out of "the last 8", an earlier QANDEEL answer in the thread, another thread.
  const asked = await postV2(f.stranger, f.a.experience, '@qandeel what is the first reply saying?', f.r1.post_id);
  const lease0 = (await begin(asked.post_id, f.stranger)).work_lease_id;
  const consumed0 = (await contextV2(asked.post_id, lease0)).filter((c) => c.context_kind === 'POST').map((c) => c.context_ref);
  assert.equal((await complete(asked.post_id, lease0, f.a.version, 'An earlier reading: the reply worries about work.', consumed0)).outcome,
    'RESPONSE_RECORDED', 'C00 the unchanged 0147 completion accepts what the v2 context consumed');
  const side = [];
  for (let i = 0; i < 9; i += 1) side.push((await postV2(f.reader, f.a.experience, `side note ${i}`, f.p1.post_id)).post_id);
  const otherThread = await postV2(f.stranger, f.a.experience, 'A different thread entirely');
  const invoking = await postV2(f.reader, f.a.experience, '@qandeel do you agree with the topic author here?', f.r2.post_id);
  const later = await postV2(f.stranger, f.a.experience, 'Something written after the question', f.p1.post_id);
  assert.equal(invoking.qandeel_invoked, true);

  assert.deepEqual(await contextV2(invoking.post_id, randomUUID()), [], 'C01 nothing without the live lease');
  const lease = (await begin(invoking.post_id, f.reader)).work_lease_id;
  const ctx = await contextV2(invoking.post_id, lease);
  assert.deepEqual([...new Set(ctx.map((c) => c.context_kind))].sort(), ['MEANING', 'POST', 'THEME', 'TOPIC', 'VERSION'],
    'C02 only public classes; no CONTENT list, no RELATED (an earlier answer outside the branch is not carried, C06)');
  assert.equal(ctx.find((c) => c.context_kind === 'VERSION').context_ref, f.a.version);
  assert.equal(ctx.find((c) => c.context_kind === 'MEANING').context_text, 'Fear for a family while work feels uncertain');
  // C03 an S5-02 package: the topic is its served items, labelled, as one text.
  assert.equal(ctx.find((c) => c.context_kind === 'TOPIC').context_text, `AUTHOR: ${f.userText}`, 'C03 the S5-02 topic as one labelled text');
  // C04 the branch: the chain to the root, the root, and the last 8 other thread posts before the invoker.
  const posts = ctx.filter((c) => c.context_kind === 'POST');
  const chosen = posts.map((c) => c.context_ref);
  for (const id of [invoking.post_id, f.r2.post_id, f.r1.post_id, f.p1.post_id]) assert.ok(chosen.includes(id), `C04 the chain keeps ${id}`);
  assert.deepEqual(chosen.filter((id) => ![invoking.post_id, f.r2.post_id, f.r1.post_id, f.p1.post_id].includes(id)), side.slice(1),
    'C04 the 8 most recent other posts of the thread, nothing older off the chain');
  assert.ok(!chosen.includes(otherThread.post_id), 'C04 no other thread');
  assert.ok(!chosen.includes(later.post_id), 'C04 nothing after the invocation');
  assert.deepEqual(posts.map((c) => Number(c.context_ordinal)), [...posts.map((c) => Number(c.context_ordinal))].sort((x, y) => x - y), 'C04 ordinal order');
  // C05 roles: the invoking post; OP / ASKER / PARTICIPANT; the post each answers.
  const byId = Object.fromEntries(posts.map((c) => [c.context_ref, c]));
  assert.deepEqual(posts.filter((c) => c.context_role === 'INVOKING').map((c) => c.context_ref), [invoking.post_id], 'C05 one invoking post');
  assert.deepEqual([byId[invoking.post_id].speaker, byId[f.p1.post_id].speaker, byId[f.r1.post_id].speaker, byId[f.r2.post_id].speaker],
    ['ASKER', 'ASKER', 'PARTICIPANT', 'OP'], 'C05 the speaker roles, from Public Identities, never names');
  assert.deepEqual([byId[invoking.post_id].answers_ref, byId[f.r2.post_id].answers_ref, byId[f.r1.post_id].answers_ref, byId[f.p1.post_id].answers_ref],
    [f.r2.post_id, f.r1.post_id, f.p1.post_id, null], 'C05 the exact post each answers');
  // C06 earlier QANDEEL answers are attached to the posts they answered, and only those in the branch.
  const earlier = ctx.filter((c) => c.context_kind === 'QANDEEL');
  assert.deepEqual(earlier.map((c) => [c.speaker, c.context_text]), [], 'C06 the earlier answer to a post outside the branch is not carried');
  // C07 nothing private, unpublished or identifying.
  const texts = ctx.map((c) => c.context_text ?? '').join('\n');
  for (const secret of [f.assistantText, 'a sentence a second publisher committed', ...(await f.labels())]) {
    assert.ok(!texts.includes(secret), `C07 "${secret}" never enters the context`);
  }
  // C08 the 0147 completion accepts the v2 context's posts, and one answer is recorded.
  const done = await complete(invoking.post_id, lease, f.a.version, 'I read the topic author as saying the fear is about the family.', chosen);
  assert.equal(done.outcome, 'RESPONSE_RECORDED', 'C08 recorded through the unchanged 0147 completion');
  assert.equal((await begin(invoking.post_id, f.reader)).work_outcome, 'ALREADY_COMMITTED', 'C08 at most one answer per invocation');

  // C09 an earlier answer INSIDE the branch is attached to its post; the invoking post's own answer is never fed back.
  const follow = await postV2(f.stranger, f.a.experience, '@qandeel and what about my question above?', invoking.post_id);
  const lease2 = (await begin(follow.post_id, f.stranger)).work_lease_id;
  const ctx2 = await contextV2(follow.post_id, lease2);
  const answers = ctx2.filter((c) => c.context_kind === 'QANDEEL');
  assert.deepEqual(answers.map((c) => [c.speaker, c.answers_ref, c.context_text]),
    [['QANDEEL', invoking.post_id, 'I read the topic author as saying the fear is about the family.']], 'C09 attached to the post it answered');
  const p2 = Object.fromEntries(ctx2.filter((c) => c.context_kind === 'POST').map((c) => [c.context_ref, c]));
  assert.deepEqual([p2[follow.post_id].speaker, p2[invoking.post_id].speaker, p2[f.r2.post_id].speaker], ['ASKER', 'PARTICIPANT', 'OP'],
    'C09 roles are relative to the asker');
  await server('SELECT public.end_public_qandeel_work_v1($1, $2, $3)', [follow.post_id, lease2, true]);

  // C10 a sourced topic: 0180's labelled input with its title, bounded to 6 KB; a long one is cut at the bound.
  const ask = await postV2(f.reader, f.t.experience, '@qandeel what is this topic about?');
  const tl = (await begin(ask.post_id, f.reader)).work_lease_id;
  const topic = (await contextV2(ask.post_id, tl)).find((c) => c.context_kind === 'TOPIC').context_text;
  const [{ expected }] = await own('SELECT public_compose_source_private.qandeel_context_v1($1) expected', [f.t.manifest]);
  assert.equal(topic, expected, 'C10 exactly 0180\'s bounded @qandeel input');
  assert.ok(topic.startsWith(`TITLE: عنوان الموضوع ${f.titleWord}\n`) && topic.includes(f.messageWord), 'C10 the title and the author\'s words, labelled');
  assert.ok(!/family/u.test(topic), 'C10 no section key');
  const askLong = await postV2(f.reader, f.long.experience, '@qandeel summarise?');
  const ll = (await begin(askLong.post_id, f.reader)).work_lease_id;
  const longTopic = (await contextV2(askLong.post_id, ll)).find((c) => c.context_kind === 'TOPIC').context_text;
  assert.ok(Buffer.byteLength(longTopic, 'utf8') <= 6144 && Buffer.byteLength(longTopic, 'utf8') > 5000, 'C10 bounded to 6 KB, the budget used');
  await server('SELECT public.end_public_qandeel_work_v1($1, $2, $3)', [ask.post_id, tl, true]);

  // C11 once the Experience leaves the Public World, the context, the read and the source go dark under a live lease.
  await q('SAVEPOINT gone');
  await asRole('postgres'); await actAs(f.mohamed);
  const [removed] = await rt.removeFromPublicWorld(randomUUID(), f.long.experience, f.long.version);
  assert.ok(removed, 'C11 the owner removed the topic from the Public World');
  assert.deepEqual(await contextV2(askLong.post_id, ll), [], 'C11 the context goes dark under a live lease');
  assert.deepEqual(await readV2(f.reader, f.long.experience), [], 'C11 the read goes dark');
  assert.deepEqual(await source('DISCUSSION_POST', askLong.post_id), [], 'C11 no Activity source');
  await asRole('postgres');
  await q('ROLLBACK TO SAVEPOINT gone'); await q('RELEASE SAVEPOINT gone');
}

await runVerifier('0182', async (stage) => {
  await rt.client.connect();
  stage('boundary');
  await verifyBoundary();
  await q('BEGIN');
  try {
    stage('family');
    await verifyFamily();
    stage('fixture');
    const seam = await rt.captureSeam();
    const f = await fixture(seam);
    stage('targets, OP and the Activity source');
    await verifyThreads(f);
    stage('branch-scoped context');
    await verifyContext(f);
  } finally {
    await q('ROLLBACK').catch(() => undefined);
  }
  stage('launch closure');
  await asRole('postgres');
  const entitlement = (await rt.functionPosture(ENTITLEMENT)).prosrc;
  assert.ok(entitlement.includes('NOT_EVALUATED') && !entitlement.includes("'ENTITLED'"), 'X01 the entitlement seam is restored');
  const seam = (await rt.functionPosture(SEAM)).prosrc;
  assert.ok(seam.includes('NOT_EVALUATED') && !seam.includes("'CLEARED'"), 'X01 the publication seam still answers NOT_EVALUATED');
  assert.ok((await rt.functionPosture(FREEZE_SEAM)).prosrc.includes('NOT_EVALUATED'), 'X01 the freeze seam is closed');
  console.log('Verified migration 0182: a Public reply keeps the exact post it answers beside the unchanged 0096 thread root, written only by the unchanged 0147 command and immutable; the read is the 0147 read plus that target and a boolean OP flag derived from the creating Public Identity; REPLY_TO_OWN_POST reaches the exact author answered and never the actor; the @qandeel context is the invoking branch (chain, root, last 8) with OP / ASKER / PARTICIPANT roles and the posts each answers, earlier answers attached to their posts, the topic as one bounded labelled text, public-visible truth only, dark without the lease or once the topic leaves; the 0147 completion is unchanged; PUBLIC_QANDEEL_REPLY is admitted; nothing publishes.');
}, async () => { await rt.client.end().catch(() => undefined); });
