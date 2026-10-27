// S8A-05 CP3 — Public semantic intelligence and deterministic spatial placement: the real-PostgreSQL verifier for 0181
// (Controlled Amendment A-4).
//
// It proves, against a fully migrated database, with synthetic humans and synthetic topics only:
//   1. the boundary: every 0181 function is a pinned postgres-owned `public_region_private` SECURITY DEFINER or one of
//      two pinned `public` INVOKER server wrappers; only service_role executes the two server commands; the
//      publication-time placement, the slot assignment, every derivation and the unchanged publication are executable by
//      no application role; the two relations are RLS-on, privilege-free, immutable / append-only; the AI-COST-01 family
//      list is the 0176 list plus exactly PUBLIC_SEMANTIC_INTERPRETATION and begin admits it; only the 0145 commit writes a
//      coordinate; still five lifecycle movers; the CW2-08 seam still answers NOT_EVALUATED;
//   2. the vocabulary and the geometry: the seeded sub-regions are exactly the API's (`public-semantic-regions.ts`), every
//      key is a valid 0144 lens key, centres of different majors are more than 1,000,000 apart; the SQL spiral equals the
//      documented ring walk for slots 0..5000 and at the edge of its range; the profile rule (1-3 known sub-regions,
//      hundredths >= 10 summing to 100, the dominant by weight then ordinal) refuses every malformed profile;
//   3. the server channel: the v2 input is the package as ONE bounded text — never the title or the section, exactly
//      0180's input without its title line for a short topic, at most 24,576 bytes for a long one with the publisher's
//      written and emphasized words kept — and zero rows whenever 0144's reader serves none; the v2 record keeps the
//      dominant sub-region as the 0144 lens key and refuses a malformed or a NOT_SUPPORTED-with-regions answer;
//   4. the publication-time placement (the CW2-08 seam replaced inside this rolled-back transaction, then restored byte for
//      byte): with the seam closed the publication raises and NOTHING is placed; not semantically ready, stale or
//      unknown-region topics are refused with nothing placed; the first topic of a sub-region sits at its centre, the next
//      ones on the spiral 8,000 apart; a compound sits in its dominant sub-region; section, title, popularity and
//      discussion reach no function; a retry moves nothing; an older 0145 place is kept as it is;
//   5. capacity: 500 / 2,000 / 5,000 topics in one sub-region take distinct lattice points (so no two are closer than
//      8,000), stay well inside their sub-region and the BigInt range;
//   6. concurrency: a second session's publication-time placement waits on the World singleton the first holds.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { APP_ROLES, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, actAs, asRole, rejected } = rt;
const own = async (text, values = []) => { await asRole('postgres'); return rows(text, values); };
const as = async (uid) => asRole('authenticated', uid);
const first = async (text, values = []) => (await rows(text, values))[0];
const marker = () => randomUUID().replace(/[^a-f]/gu, '').slice(0, 12);

const SCHEMA = 'public_region_private';
const LAYOUT = 'public_region_dominant_v1';
const FREEZE_SEAM = 'public_compose_private.resolve_topic_freeze_clearance_v1()';
const PUBLISH = 'public.publish_public_experience_v1(uuid, uuid, uuid)';
const SERVER = {
  read_public_semantic_work_input_v2: 'p_work_id uuid',
  record_public_semantic_work_outcome_v2: 'p_work_id uuid, p_outcome text, p_region_keys text[], p_region_weights integer[], p_meaning text, p_primary_themes text[], p_secondary_themes text[], p_explanation text',
};
const INTERNAL = ['reject_mutation_v1', 'profile_dominant_v1', 'hex_slot_v1', 'derive_identity_v1', 'package_input_v1',
  'assign_slot_v1', 'publish_public_experience_with_placement_v1'];
const NO_ROLE = [
  `${SCHEMA}.publish_public_experience_with_placement_v1(uuid, uuid, uuid)`, `${SCHEMA}.assign_slot_v1(uuid, text)`,
  `${SCHEMA}.package_input_v1(uuid)`, `${SCHEMA}.profile_dominant_v1(text[], integer[])`, `${SCHEMA}.hex_slot_v1(bigint)`,
  `${SCHEMA}.derive_identity_v1(text, uuid, uuid)`, `${SCHEMA}.reject_mutation_v1()`, PUBLISH,
];
const FAMILIES = ['CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION', 'THREAD_FORMATION', 'THREAD_CONTINUITY',
  'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION', 'PERSONAL_UNDERSTANDING_CAPTURE',
  'SHARED_SEMANTIC_READING', 'SHARED_KNOWLEDGE_RECALL', 'SHARED_SPATIAL_PLACEMENT', 'SHARED_DISCLOSURE_JUDGE', 'PUBLIC_SEMANTIC_INTERPRETATION'];
// RE-ANCHORED by S8A-05 CP4 (2026-10-27, Controlled Amendment A-5): migration 0182 adds exactly PUBLIC_QANDEEL_REPLY, detected by its
// branch-scoped context read (0182's own verifier pins the full list); nothing else in this list changes.
const LATER_FAMILIES = ['PUBLIC_QANDEEL_REPLY'];
const WORLD = ['-4611686018427387904', '-4611686018427387904', '4611686018427387903', '4611686018427387903'];
const MAX = 4611686018427387903n;

// ---- the documented geometry, independently of the SQL: the ring walk and the lattice
const CORNERS = (n) => [[-n, n], [0n, n], [n, 0n], [n, -n], [0n, -n], [-n, 0n]];
const DIRECTIONS = [[1n, 0n], [1n, -1n], [0n, -1n], [-1n, 0n], [-1n, 1n], [0n, 1n]];
function ringWalk(k) {
  if (k === 0n) return [0n, 0n];
  let n = 1n;
  while (3n * n * (n + 1n) < k) n += 1n;
  const s = k - (3n * n * (n - 1n) + 1n);
  const side = Number(s / n);
  const step = s % n;
  const [cq, cr] = CORNERS(n)[side];
  return [cq + step * DIRECTIONS[side][0], cr + step * DIRECTIONS[side][1]];
}
const point = (q2, r) => [8000n * q2 + 4000n * r, 6929n * r];
const distance = (a, b) => Math.hypot(Number(a[0] - b[0]), Number(a[1] - b[1]));

/** The API's vocabulary, read from its source: `sub('key', ordinal, q, r, '…')`. */
function apiVocabulary() {
  const source = readFileSync(new URL('../apps/api/src/public-world/public-semantic-regions.ts', import.meta.url), 'utf8');
  return [...source.matchAll(/^\s*sub\('([a-z_.]+)', (\d+), (-?\d+), (-?\d+), ['"]/gmu)]
    .map((m) => ({ key: m[1], ordinal: Number(m[2]), q: m[3], r: m[4] }));
}

// ---- the S5-02 / S5-03A paths, as the human's own roles
const startDraft = async (uid) => { await as(uid); return (await first('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()])).experience_id; };
const prepareOwn = async (uid, experience, units) => {
  await as(uid);
  return (await first('SELECT * FROM public.prepare_own_public_experience_package_v1($1, $2, $3::uuid[], $4::uuid[], $5::uuid[])',
    [randomUUID(), experience, units, [], []])).outcome;
};
const approveOwn = async (uid, manifest) => { await as(uid); return (await first('SELECT * FROM public.approve_own_public_package_v1($1, $2)', [randomUUID(), manifest])).outcome; };
const readyOwn = async (uid, experience) => { await as(uid); return (await first('SELECT * FROM public.commit_own_public_experience_ready_v1($1, $2)', [randomUUID(), experience])).outcome; };
const requestProposal = async (uid, experience) => { await as(uid); return first('SELECT * FROM public.request_own_public_semantic_proposal_v1($1, $2)', [randomUUID(), experience]); };
const commitWork = async (uid, work) => { await as(uid); return first('SELECT * FROM public.commit_own_public_semantic_work_v1($1)', [work]); };
const acceptSemantic = async (uid, experience, interpretation) => {
  await as(uid); return (await first('SELECT * FROM public.accept_own_public_semantic_proposal_v1($1, $2, $3)', [randomUUID(), experience, interpretation])).outcome;
};
const inputV1 = async (work) => { await asRole('service_role'); return rows('SELECT * FROM public.read_public_semantic_work_input_v1($1)', [work]); };
const inputV2 = async (work) => { await asRole('service_role'); return rows('SELECT * FROM public.read_public_semantic_work_input_v2($1)', [work]); };
const recordV1 = async (work, lens) => {
  await asRole('service_role');
  return (await first('SELECT * FROM public.record_public_semantic_work_outcome_v1($1, $2, $3, $4, $5::text[], $6::text[], $7)',
    [work, 'PROPOSED', lens, 'A topic recorded through the 0144 command', ['older'], [], 'Recorded through the older command.'])).outcome;
};
const recordV2 = async (work, outcome, keys, weights, meaning = null, primary = null, secondary = null, explanation = null) => {
  await asRole('service_role');
  return (await first('SELECT * FROM public.record_public_semantic_work_outcome_v2($1, $2, $3::text[], $4::int[], $5, $6::text[], $7::text[], $8)',
    [work, outcome, keys, weights, meaning, primary, secondary, explanation])).outcome;
};
const requestPlace = async (uid, experience) => { await as(uid); return first('SELECT * FROM public.request_own_public_spatial_placement_v1($1, $2)', [randomUUID(), experience]); };
const commitPlace = async (request, x, y) => {
  await asRole('service_role');
  return (await first('SELECT * FROM public.commit_public_spatial_placement_v1($1, $2, $3, $4)', [request, 'test.layout.v1', x, y])).outcome;
};
const field = async (uid) => { await as(uid); return rows('SELECT * FROM public.read_public_semantic_field_v1($1, $2, $3, $4)', WORLD); };
const slotsOf = async (experience) => own(`SELECT region_key, slot_index::text k, world_x::text x, world_y::text y FROM ${SCHEMA}.region_slots
  WHERE experience_id = $1 ORDER BY region_key`, [experience]);
const placementsOf = async (experience) => own(`SELECT layout_version, world_x::text x, world_y::text y FROM public_spatial_private.spatial_placements
  WHERE experience_id = $1 ORDER BY committed_at, id`, [experience]);
const lifecycleOf = async (experience) => (await own(`SELECT current_lifecycle FROM ${T.EXPERIENCES} WHERE id = $1`, [experience]))[0].current_lifecycle;
const centreOf = async (key) => {
  const [c] = await own(`SELECT lattice_q::text q, lattice_r::text r FROM ${SCHEMA}.sub_regions WHERE region_key = $1`, [key]);
  return point(BigInt(c.q), BigInt(c.r)).map(String);
};

/** READY_FOR_REVIEW through the S5-02 Product path (one personal unit). */
async function readyExperience(f) {
  const experience = await startDraft(f.mohamed);
  assert.equal(await prepareOwn(f.mohamed, experience, [f.userUnit]), 'PREPARED');
  const [{ v, m }] = await own(`SELECT e.current_experience_version_id v, ve.package_manifest_version_id m FROM ${T.EXPERIENCES} e
    JOIN ${T.VERSIONS} ve ON ve.id = e.current_experience_version_id WHERE e.id = $1`, [experience]);
  assert.equal(await approveOwn(f.mohamed, m), 'APPROVED');
  assert.equal(await readyOwn(f.mohamed, experience), 'READY_FOR_REVIEW');
  return { experience, version: v, manifest: m };
}

/** SEMANTICALLY_READY through the v2 server command: QANDEEL's proposal with its profile, the human's commit and accept. */
async function reviewed(f, e, keys, weights) {
  const work = (await requestProposal(f.mohamed, e.experience)).work_id;
  assert.equal(await recordV2(work, 'PROPOSED', keys, weights, 'A topic about what it says', ['what it says'], [], 'The words say so.'), 'RECORDED');
  const committed = await commitWork(f.mohamed, work);
  assert.equal(committed.outcome, 'PROPOSED');
  assert.equal(await acceptSemantic(f.mohamed, e.experience, committed.interpretation_id), 'ACCEPTED');
  return committed.interpretation_id;
}

/** The publication-time placement and the publication, with the CW2-08 seam cleared and restored around the one call. */
async function publishPlaced(seam, uid, command, e) {
  await asRole('postgres');
  await rt.clearPrerequisites();
  try {
    await actAs(uid);
    return await first(`SELECT * FROM ${SCHEMA}.publish_public_experience_with_placement_v1($1, $2, $3)`, [command, e.experience, e.version]);
  } finally {
    await asRole('postgres');
    await rt.restorePrerequisites(seam);
  }
}
const publishClosed = async (uid, command, e) => {
  await actAs(uid);
  return q(`SELECT * FROM ${SCHEMA}.publish_public_experience_with_placement_v1($1, $2, $3)`, [command, e.experience, e.version]);
};

// --------------------------------------------------------------------------------------------------------- 1. boundary
async function verifyBoundary() {
  await asRole('postgres');
  const fns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(fns.map((f) => f.proname).sort(), [...Object.keys(SERVER), ...INTERNAL].sort(), 'B01 the private schema holds exactly the 0181 functions');
  for (const f of fns) {
    assert.deepEqual([f.prosecdef, f.owner, f.proconfig], [true, 'postgres', ['search_path=""']], `B01 ${f.proname} is a pinned postgres definer`);
  }
  const wrappers = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [Object.keys(SERVER)]);
  assert.equal(wrappers.length, 2, 'B02 one public wrapper per server command');
  for (const w of wrappers) {
    assert.deepEqual([w.prosecdef, w.proconfig, w.args], [false, ['search_path=""'], SERVER[w.proname]], `B02 public.${w.proname} is a pinned INVOKER wrapper`);
  }
  const executable = await rows(`SELECT r.rolname, n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT unnest($2::text[]) rolname) r
    WHERE EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
      AND (n.nspname = $3 OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`, [Object.keys(SERVER), APP_ROLES, SCHEMA]);
  assert.deepEqual(executable.map((e) => `${e.rolname} ${e.fn}`).sort(),
    Object.keys(SERVER).flatMap((n) => [`service_role public.${n}`, `service_role ${SCHEMA}.${n}`]).sort(),
    'B03 only the server channel executes the two server commands; nothing else of 0181 is executable by any application role');
  for (const fn of NO_ROLE) {
    for (const role of ['public', ...APP_ROLES]) assert.equal(await rt.canExecute(role, fn), false, `B03 ${role} cannot execute ${fn}`);
  }
  // B04 the two relations: private, RLS-on, privilege-free, postgres-owned, immutable / append-only.
  const tables = await rows(`SELECT c.relname, c.relrowsecurity, pg_get_userbyid(c.relowner) owner FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind = 'r' ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(tables.map((t) => [t.relname, t.relrowsecurity, t.owner]), [['region_slots', true, 'postgres'], ['sub_regions', true, 'postgres']], 'B04');
  const privileges = await rows(`SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
    WHERE table_schema = $1 AND grantee <> 'postgres'`, [SCHEMA]);
  assert.deepEqual(privileges, [], 'B04 no application role holds a privilege on either relation');
  const columns = await rows(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1 ORDER BY 1, ordinal_position`, [SCHEMA]);
  assert.deepEqual(columns.filter((c) => c.table_name === 'region_slots').map((c) => c.column_name),
    ['layout_version', 'region_key', 'slot_index', 'lattice_q', 'lattice_r', 'world_x', 'world_y', 'experience_id', 'assigned_at'],
    'B04 a slot holds no text, no account, no title, no section and no profile');
  // B05 AI-COST-01: the 0176 list plus exactly PUBLIC_SEMANTIC_INTERPRETATION, and begin admits it for the paying user.
  const [{ def }] = await rows(`SELECT pg_get_constraintdef(c.oid) def FROM pg_constraint c
    WHERE c.conrelid = 'public.ai_provider_calls'::regclass AND c.conname = 'ai_provider_calls_feature_family_check'`);
  const [{ publicReply }] = await rows("SELECT to_regprocedure('public.read_public_qandeel_context_v2(uuid, uuid)') IS NOT NULL \"publicReply\"");
  assert.deepEqual([...def.matchAll(/'([A-Z_]+)'::text/gu)].map((m) => m[1]).sort(), [...FAMILIES, ...(publicReply ? LATER_FAMILIES : [])].sort(), 'B05 the family list');
  // B06 the only writer of a coordinate is still the 0145 commit; still five lifecycle movers; the seam is closed.
  const writers = await rows(`SELECT n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosrc ~* 'INSERT INTO public_spatial_private\\.spatial_placements' ORDER BY 1`);
  assert.deepEqual(writers.map((w) => w.fn), ['public_spatial_private.commit_public_spatial_placement_v1'], 'B06 one writer of a coordinate');
  const [{ movers }] = await rows(`SELECT count(*)::int movers FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
    WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
      AND (pr.prosrc ~ 'UPDATE public\\.public_experiences e\\s+SET current_lifecycle = '''
        OR pr.prosrc ~ 'INSERT INTO public\\.public_experiences\\s+\\(id, public_world_singleton')`);
  assert.equal(movers, 5, 'B06 exactly five functions move a Public lifecycle');
  // B07 nothing of 0181 reads a title, a section, the alias, an account, popularity, discussion, views or vitality.
  const bodies = await rows(`SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1`, [SCHEMA]);
  for (const b of bodies) {
    assert.doesNotMatch(b.prosrc, /version_titles|section_key|\btitle\b|display_label|public_identit|public\.users|auth\.|vitality|discussion|posts|views|popular|search_projection|memor|hypothes|shared_world|conversation_/u,
      `B07 ${b.proname} reads nothing but the package, the reviewed meaning and the slots`);
  }
}

async function verifyFamily() {
  const user = randomUUID();
  await asRole('postgres');
  await q('INSERT INTO auth.users (id) VALUES ($1)', [user]);
  await asRole('service_role');
  const [row] = await rows('SELECT * FROM public.begin_ai_provider_call_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::text,$7::text,$8::text,$9::text)',
    [randomUUID(), user, null, null, 'DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', 'PUBLIC_SEMANTIC_INTERPRETATION', 'FAST']);
  assert.equal(row.begin_outcome, 'BEGUN', 'B05 a Public interpretation call is admitted');
  const [call] = await own("SELECT user_id, feature_family FROM public.ai_provider_calls WHERE feature_family = 'PUBLIC_SEMANTIC_INTERPRETATION'");
  assert.deepEqual([call.user_id, call.feature_family], [user, 'PUBLIC_SEMANTIC_INTERPRETATION'], 'B05 recorded for the paying user');
  await asRole('service_role');
  await rejected(() => q('SELECT * FROM public.begin_ai_provider_call_v1($1::uuid,$2::uuid,NULL,NULL,$3,$4,$5,$6,$7)',
    [randomUUID(), user, 'DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', 'PUBLIC_SPATIAL_PLACEMENT', 'FAST']), ['23514', '22023'],
  null);
}

// ------------------------------------------------------------------------------------- 2. vocabulary and geometry
async function verifyGeometry() {
  const seeded = await own(`SELECT region_key key, ordinal, lattice_q::text q, lattice_r::text r, major_key major FROM ${SCHEMA}.sub_regions ORDER BY ordinal`);
  assert.deepEqual(seeded.map(({ key, ordinal, q: q2, r }) => ({ key, ordinal, q: q2, r })), apiVocabulary(),
    'V01 the seeded vocabulary is exactly the API\'s: keys, ordinals and centres');
  assert.equal(seeded.length, 46);
  assert.equal(new Set(seeded.map((s) => s.major)).size, 13, 'V01 13 majors');
  for (const s of seeded) assert.match(s.key, /^[a-z0-9][a-z0-9_.-]{0,63}$/u, `V01 ${s.key} is a valid 0144 lens key`);
  const centres = seeded.map((s) => ({ ...s, p: point(BigInt(s.q), BigInt(s.r)) }));
  let cross = Infinity;
  let within = Infinity;
  for (const a of centres) {
    for (const b of centres) {
      if (a.key >= b.key) continue;
      const d = distance(a.p, b.p);
      if (a.major === b.major) within = Math.min(within, d); else cross = Math.min(cross, d);
    }
  }
  assert.ok(cross > 1_000_000, `V02 sub-regions of different majors are more than 1,000,000 apart (${Math.round(cross)})`);
  assert.ok(within > 600_000, `V02 sub-regions of one major are more than 600,000 apart (${Math.round(within)})`);
  // V03 the SQL spiral is the documented ring walk, slot for slot, and the BigInt range holds at its last slot.
  const sql = await own('SELECT k::text k, h.dq::text dq, h.dr::text dr FROM generate_series(0, 5000) k, public_region_private.hex_slot_v1(k) h ORDER BY k');
  for (const s of sql) assert.deepEqual([s.dq, s.dr], ringWalk(BigInt(s.k)).map(String), `V03 slot ${s.k}`);
  assert.equal(new Set(sql.map((s) => `${s.dq},${s.dr}`)).size, 5001, 'V03 every slot is its own lattice point');
  const [edge] = await own('SELECT h.dq::text dq, h.dr::text dr FROM public_region_private.hex_slot_v1(1000000000000) h');
  assert.deepEqual([edge.dq, edge.dr], ringWalk(1_000_000_000_000n).map(String), 'V03 the last slot');
  for (const v of point(BigInt(edge.dq), BigInt(edge.dr))) assert.ok(v > -MAX && v < MAX, 'V03 the last slot is far inside the coordinate range');
  await q('BEGIN');
  try {
    for (const bad of [-1, 1000000000001]) await rejected(() => q('SELECT * FROM public_region_private.hex_slot_v1($1)', [bad]), ['22023']);
    // V04 the profile rule.
    const dominant = async (keys, weights) => (await first('SELECT public_region_private.profile_dominant_v1($1::text[], $2::int[]) d', [keys, weights])).d;
    assert.equal(await dominant(['work.pressure'], [100]), 'work.pressure');
    assert.equal(await dominant(['inner.sadness', 'work.pressure'], [40, 60]), 'work.pressure', 'V04 the highest weight wins, whatever the order');
    assert.equal(await dominant(['work.pressure', 'family.parents', 'loss.grief'], [30, 30, 40]), 'loss.grief');
    assert.equal(await dominant(['work.pressure', 'family.parents'], [50, 50]), 'family.parents', 'V04 a tie goes to the lower ordinal (12 < 20)');
    assert.equal(await dominant(['family.parents', 'work.pressure'], [50, 50]), 'family.parents', 'V04 independent of the answer\'s order');
    for (const [keys, weights] of [
      [[], []], [['work.pressure', 'family.parents', 'loss.grief', 'inner.anger'], [25, 25, 25, 25]], [['work.unknown'], [100]],
      [['work'], [100]], [['work.pressure', 'work.pressure'], [50, 50]], [['work.pressure', 'family.parents'], [95, 5]],
      [['work.pressure', 'family.parents'], [60, 30]], [['work.pressure', 'family.parents'], [60, 41]], [['work.pressure'], [101]],
      [['work.pressure', 'family.parents'], [100]], [null, [100]], [['work.pressure'], null], [['work.pressure', null], [50, 50]],
      [['WORK.PRESSURE'], [100]],
    ]) await rejected(() => q('SELECT public_region_private.profile_dominant_v1($1::text[], $2::int[])', [keys, weights]), ['22023', '22004']);
  } finally {
    await q('ROLLBACK');
  }
}

// ---------------------------------------------------------------------------- synthetic conversations (0180's shape)
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
async function openFreeze() {
  await asRole('postgres');
  const [seam] = await rows('SELECT pg_get_functiondef(p.oid) d, p.prosrc FROM pg_proc p WHERE p.oid = $1::regprocedure', [FREEZE_SEAM]);
  await q(`CREATE OR REPLACE FUNCTION ${FREEZE_SEAM.replace('()', '')}()
           RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $probe$
             SELECT 'CLEARED'::text -- S8A-05 CP3 VERIFIER PROBE: inside a rolled-back verifier transaction only
           $probe$`);
  return seam;
}
async function closeFreeze(seam) {
  await asRole('postgres');
  await q(seam.d);
  const [{ prosrc }] = await rows('SELECT p.prosrc FROM pg_proc p WHERE p.oid = $1::regprocedure', [FREEZE_SEAM]);
  assert.equal(prosrc, seam.prosrc, 'the production freeze seam is restored byte for byte');
}
/** A sourced topic (S8A-05 CP2): my own messages only, a title, a section, a written text; frozen to READY_FOR_REVIEW. */
async function sourcedTopic(f, messages, title, written, section, emphasized = []) {
  const chat = await conversation(f.mohamed, messages);
  const draft = randomUUID();
  await as(f.mohamed);
  assert.equal((await first('SELECT * FROM public.set_own_topic_conversation_source_v1($1, 0, $2, 1, $3, false, $4::int[], $5::int[])',
    [draft, chat.session, chat.last, [], emphasized])).outcome, 'CREATED');
  assert.equal((await first('SELECT * FROM public.save_own_topic_draft_v1($1, 1, $2, $3, $4)', [draft, title, written, section])).outcome, 'SAVED');
  const frozen = await first('SELECT * FROM public.freeze_own_topic_draft_v1($1, $2, 2)', [randomUUID(), draft]);
  assert.deepEqual([frozen.outcome, frozen.current_lifecycle], ['PREPARED', 'READY_FOR_REVIEW'], 'fixture: a sourced topic is READY_FOR_REVIEW');
  const [{ v, m }] = await own(`SELECT e.current_experience_version_id v, ve.package_manifest_version_id m FROM ${T.EXPERIENCES} e
    JOIN ${T.VERSIONS} ve ON ve.id = e.current_experience_version_id WHERE e.id = $1`, [frozen.experience_id]);
  return { experience: frozen.experience_id, version: v, manifest: m };
}

// --------------------------------------------------------------------------------------------- 3. the server channel
async function verifyServerChannel(f) {
  // I01 an S5-02 package: its present items in ordinal order, labelled; exactly what 0144's reader serves, as one text.
  const work = (await requestProposal(f.mohamed, f.e1.experience)).work_id;
  const items = await inputV1(work);
  const [served] = await inputV2(work);
  assert.deepEqual(Object.keys(served).sort(), ['correction_meaning', 'correction_primary_themes', 'correction_secondary_themes', 'package_text', 'work_kind']);
  assert.equal(served.work_kind, 'PROPOSAL');
  assert.equal(served.package_text, items.sort((a, b) => a.item_ordinal - b.item_ordinal)
    .map((i) => `${i.item_kind === 'ANALYSIS' ? 'ANALYSIS' : 'SOURCE'}: ${i.item_text}`).join('\n'), 'I01 the S5-02 package as one labelled text');
  assert.ok(served.package_text.includes(f.userText), 'I01 the exact committed sentence');
  await as(f.mohamed);
  await rejected(() => q('SELECT * FROM public.read_public_semantic_work_input_v2($1)', [work]), ['42501']);
  await rejected(() => q('SELECT * FROM public.record_public_semantic_work_outcome_v2($1, $2, $3::text[], $4::int[], $5, $6::text[], $7::text[], $8)',
    [work, 'PROPOSED', ['work.pressure'], [100], 'm', ['t'], [], 'e']), ['42501']);
  assert.deepEqual(await inputV2(randomUUID()), [], 'I01 an unknown work serves nothing');

  // R01 the v2 record: the profile's dominant sub-region becomes the 0144 lens key, and only it.
  for (const [keys, weights] of [[['work.unknown'], [100]], [['work.pressure', 'inner.sadness'], [70, 20]], [['work.pressure'], [100, 0]]]) {
    await rejected(() => recordV2(work, 'PROPOSED', keys, weights, 'm', ['t'], [], 'e'), ['22023'], /PUBLIC_SEMANTIC_OUTPUT_INVALID/u);
  }
  await rejected(() => recordV2(work, 'NOT_SUPPORTED', ['work.pressure'], [100]), ['22023'], /PUBLIC_SEMANTIC_OUTPUT_INVALID/u);
  assert.equal(await recordV2(work, 'PROPOSED', ['inner.sadness', 'work.pressure'], [30, 70], 'Tired of the pressure at work', ['work'], ['tiredness'],
    'The words return to the work and the tiredness.'), 'RECORDED');
  const [outcome] = await own('SELECT lens_key, outcome FROM public_semantic_private.semantic_work_outcomes WHERE work_id = $1', [work]);
  assert.deepEqual([outcome.lens_key, outcome.outcome], ['work.pressure', 'PROPOSED'], 'R01 the dominant sub-region, through the 0144 command');
  assert.equal(await recordV2(work, 'PROPOSED', ['loss.grief'], [100], 'Another answer', ['x'], [], 'e'), 'STALE', 'R01 a different second answer is refused (0144)');
  assert.deepEqual(await own('SELECT lens_key FROM public_semantic_private.semantic_work_outcomes WHERE work_id = $1', [work]), [{ lens_key: 'work.pressure' }],
    'R01 the first answer wins');
  assert.deepEqual(await inputV2(work), [], 'I01 an answered work serves nothing more');
  const committed = await commitWork(f.mohamed, work);
  assert.equal(committed.outcome, 'PROPOSED');
  assert.equal(await acceptSemantic(f.mohamed, f.e1.experience, committed.interpretation_id), 'ACCEPTED');
  const [region] = await own('SELECT semantic_region FROM public_spatial_private.derive_reviewed_interpretation_v1($1)', [f.e1.version]);
  assert.equal(region.semantic_region, 'work.pressure', 'R01 the reviewed region is the dominant sub-region');

  // I02 a sourced topic (CP2): never the title or the section; exactly 0180's input without its TITLE line.
  const short = await sourcedTopic(f, [{ role: 'USER', text: `أنا تعبت من الشغل ومش عارف أعمل إيه ${marker()}` },
    { role: 'USER', text: `كل يوم نفس الضغط ${marker()}` }], f.title, f.written, 'family');
  const shortWork = (await requestProposal(f.mohamed, short.experience)).work_id;
  const [shortServed] = await inputV2(shortWork);
  const [{ v1 }] = await own('SELECT public_compose_source_private.interpreter_input_v1($1) v1', [short.manifest]);
  assert.ok(v1.startsWith(`TITLE: ${f.title}\n`), 'I02 0180\'s input begins with the title');
  assert.equal(shortServed.package_text, v1.slice(`TITLE: ${f.title}\n`.length), 'I02 the 0181 input is 0180\'s without the title, nothing else');
  assert.ok(!shortServed.package_text.includes(f.titleWord) && !/family|section/u.test(shortServed.package_text), 'I02 no title, no section');
  assert.ok(shortServed.package_text.startsWith(`AUTHOR_TEXT: ${f.written.trim()}`), 'I02 the written text first');
  f.short = short;
  f.shortWork = shortWork;

  // I03 a long sourced topic: at most 24,576 bytes; the written and the emphasized words kept.
  const emphasizedWord = marker();
  const long = await sourcedTopic(f, Array.from({ length: 40 }, (_, k) => ({ role: 'USER',
    text: k === 20 ? `رسالة مبرزة ${emphasizedWord}` : `رسالة ${k} ${'ك'.repeat(800)}` })), `${f.title} 2`, `${f.written} 2`, 'work_money', [21]);
  const longWork = (await requestProposal(f.mohamed, long.experience)).work_id;
  const [longServed] = await inputV2(longWork);
  assert.ok(Buffer.byteLength(longServed.package_text, 'utf8') <= 24_576, 'I03 bounded to 24,576 bytes');
  assert.ok(Buffer.byteLength(longServed.package_text, 'utf8') > 20_000, 'I03 the budget is used');
  assert.ok(longServed.package_text.includes(`AUTHOR [EMPHASIZED]: رسالة مبرزة ${emphasizedWord}`), 'I03 the emphasized message is kept');
  assert.ok(longServed.package_text.startsWith('AUTHOR_TEXT: '), 'I03 the written text is kept, first');
  assert.ok(!longServed.package_text.includes(f.titleWord), 'I03 no title');
}

// -------------------------------------------------------------------------------- 4. the publication-time placement
async function verifyPlacement(f, seam) {
  const before = async () => (await own(`SELECT (SELECT count(*) FROM ${SCHEMA}.region_slots)::int s,
    (SELECT count(*) FROM public_spatial_private.spatial_placements)::int p, (SELECT count(*) FROM public_spatial_private.spatial_requests)::int r`))[0];
  const zero = await before();

  // P01 PRODUCTION IS CLOSED: with the seam answering NOT_EVALUATED the publication raises and nothing is placed.
  await rejected(() => publishClosed(f.mohamed, randomUUID(), f.e1), ['55000'], /PUBLIC_EXPERIENCE_LAUNCH_PREREQUISITE_UNRESOLVED/u);
  assert.deepEqual(await before(), zero, 'P01 no slot, no request, no placement survives a refused publication');
  assert.equal(await lifecycleOf(f.e1.experience), 'READY_FOR_REVIEW');

  // P02 NOT SEMANTICALLY READY / STALE: refused before any slot.
  await asRole('postgres');
  await rt.clearPrerequisites();
  try {
    await rejected(() => publishClosed(f.mohamed, randomUUID(), f.e2), ['55000'], /PUBLIC_PLACEMENT_NOT_SEMANTICALLY_READY/u);
    await rejected(() => publishClosed(f.mohamed, randomUUID(), { ...f.e1, version: f.e2.version }), ['40001'], /PUBLIC_EXPERIENCE_STALE/u);
  } finally {
    await asRole('postgres');
    await rt.restorePrerequisites(seam);
  }
  assert.deepEqual(await before(), zero, 'P02 nothing placed');

  // P03 THE FIRST TOPIC OF A SUB-REGION SITS AT ITS CENTRE, bound by the unchanged 0145 commit, then publishes.
  const command = randomUUID();
  const published = await publishPlaced(seam, f.mohamed, command, f.e1);
  assert.deepEqual([published.outcome, published.current_lifecycle], ['PUBLISHED', 'PUBLISHED'], 'P03 published through the simulated seam');
  const work = await centreOf('work.pressure');
  assert.deepEqual(await slotsOf(f.e1.experience), [{ region_key: 'work.pressure', k: '0', x: work[0], y: work[1] }], 'P03 slot 0: the centre');
  assert.deepEqual(await placementsOf(f.e1.experience), [{ layout_version: LAYOUT, x: work[0], y: work[1] }], 'P03 the one 0145 placement, same point');
  const seen = (await field(f.reader)).find((r) => r.experience_id === f.e1.experience);
  assert.deepEqual([seen.world_x, seen.world_y, seen.semantic_region], [work[0], work[1], 'work.pressure'], 'P03 served in the field');

  // P04 A RETRY MOVES NOTHING: the same command answers the first result; another command is refused by the publication.
  const again = await publishPlaced(seam, f.mohamed, command, f.e1);
  assert.equal(again.outcome, 'ALREADY_COMMITTED', 'P04 a retried publication');
  await asRole('postgres');
  await rt.clearPrerequisites();
  try {
    await rejected(() => publishClosed(f.mohamed, randomUUID(), f.e1), ['55000', '23505'], null);
  } finally {
    await asRole('postgres');
    await rt.restorePrerequisites(seam);
  }
  assert.deepEqual(await placementsOf(f.e1.experience), [{ layout_version: LAYOUT, x: work[0], y: work[1] }], 'P04 never moved');
  assert.equal((await slotsOf(f.e1.experience)).length, 1, 'P04 never a second slot');

  // P05 A SIMILAR TOPIC SITS NEXT TO IT (8,000 away); A COMPOUND SITS IN ITS DOMINANT SUB-REGION.
  await reviewed(f, f.e3, ['work.pressure', 'work.money'], [80, 20]);
  await publishPlaced(seam, f.mohamed, randomUUID(), f.e3);
  const [e3] = await placementsOf(f.e3.experience);
  const step = point(...ringWalk(1n));
  assert.deepEqual([e3.x, e3.y], [String(BigInt(work[0]) + step[0]), String(BigInt(work[1]) + step[1])], 'P05 slot 1 of the same spiral');
  const next = distance([BigInt(e3.x), BigInt(e3.y)], work.map(BigInt));
  assert.ok(next >= 8000 && next < 8001, `P05 one lattice step (8,000 to 8,000.6) from the first: ${next}`);
  await reviewed(f, f.e4, ['work.pressure', 'inner.sadness'], [40, 60]);
  await publishPlaced(seam, f.mohamed, randomUUID(), f.e4);
  const sadness = await centreOf('inner.sadness');
  const [e4] = await placementsOf(f.e4.experience);
  assert.deepEqual([e4.x, e4.y], sadness, 'P05 the compound sits at its dominant sub-region\'s centre, not between the two');
  assert.ok(distance([BigInt(e4.x), BigInt(e4.y)], work.map(BigInt)) > 1_000_000, 'P05 far from its secondary meaning');

  // P06 THE SECTION AND THE TITLE PLACE NOTHING: a sourced topic filed under «family» sits in its meaning's sub-region.
  assert.equal(await recordV2(f.shortWork, 'PROPOSED', ['work.money'], [100], 'Money worries at work', ['money'], [], 'The words are about money.'), 'RECORDED');
  const shortCommitted = await commitWork(f.mohamed, f.shortWork);
  assert.equal(await acceptSemantic(f.mohamed, f.short.experience, shortCommitted.interpretation_id), 'ACCEPTED');
  await publishPlaced(seam, f.mohamed, randomUUID(), f.short);
  assert.deepEqual((await placementsOf(f.short.experience)).map((p) => [p.x, p.y]), [await centreOf('work.money')], 'P06 the meaning, never the section');

  // P07 AN OLDER 0145 PLACE IS KEPT AS IT IS: no slot, no second placement, never moved.
  await reviewed(f, f.e5, ['loss.grief'], [100]);
  const opened = await requestPlace(f.mohamed, f.e5.experience);
  assert.equal(opened.outcome, 'REQUEST_OPEN');
  assert.equal(await commitPlace(opened.request_id, '123000', '456000'), 'PLACED');
  await publishPlaced(seam, f.mohamed, randomUUID(), f.e5);
  assert.deepEqual(await placementsOf(f.e5.experience), [{ layout_version: 'test.layout.v1', x: '123000', y: '456000' }], 'P07 kept');
  assert.deepEqual(await slotsOf(f.e5.experience), [], 'P07 no slot taken');

  // P08 A LENS OUTSIDE THE VOCABULARY (recorded through the 0144 command) CAN NEVER BE PLACED.
  const legacyWork = (await requestProposal(f.mohamed, f.e6.experience)).work_id;
  assert.equal(await recordV1(legacyWork, 'family.fear'), 'RECORDED');
  const legacyCommitted = await commitWork(f.mohamed, legacyWork);
  assert.equal(await acceptSemantic(f.mohamed, f.e6.experience, legacyCommitted.interpretation_id), 'ACCEPTED');
  const placedBefore = await before();
  await asRole('postgres');
  await rt.clearPrerequisites();
  try {
    await rejected(() => publishClosed(f.mohamed, randomUUID(), f.e6), ['55000'], /PUBLIC_PLACEMENT_REGION_UNKNOWN/u);
  } finally {
    await asRole('postgres');
    await rt.restorePrerequisites(seam);
  }
  assert.deepEqual(await before(), placedBefore, 'P08 nothing placed');
  assert.equal(await lifecycleOf(f.e6.experience), 'READY_FOR_REVIEW');

  // P09 the slots are append-only.
  await asRole('postgres');
  await rejected(() => q(`UPDATE ${SCHEMA}.region_slots SET world_x = world_x WHERE experience_id = $1`, [f.e1.experience]), ['55000']);
  await rejected(() => q(`DELETE FROM ${SCHEMA}.region_slots WHERE experience_id = $1`, [f.e1.experience]), ['55000']);
  await rejected(() => q(`UPDATE ${SCHEMA}.sub_regions SET lattice_q = lattice_q`), ['55000']);
  await rejected(() => q(`INSERT INTO ${SCHEMA}.region_slots (layout_version, region_key, slot_index, lattice_q, lattice_r, world_x, world_y, experience_id, assigned_at)
    SELECT layout_version, 'work.money', 99, lattice_q, lattice_r, world_x, world_y, $1, now() FROM ${SCHEMA}.region_slots WHERE experience_id = $2`,
  [f.e2.experience, f.e1.experience]), ['23505'], null);
}

// ----------------------------------------------------------------------------------------------------- 5. capacity
async function verifyCapacity(f) {
  // 5,000 topics in ONE sub-region (drafts are enough: the slot rule reads no lifecycle), in three steps.
  const timings = [];
  let done = 0;
  for (const target of [500, 2000, 5000]) {
    const started = Date.now();
    await actAs(f.mohamed);
    await rows(`SELECT count(*) FROM (SELECT gen_random_uuid() id FROM generate_series(1, $1::int)) d,
      LATERAL public.create_public_experience_draft_v1(gen_random_uuid(), d.id) c,
      LATERAL ${SCHEMA}.assign_slot_v1(c.experience_id, 'family.siblings') a`, [target - done]).catch(async (error) => {
      throw new Error(`capacity fixture failed: ${error.message}`, { cause: error });
    });
    timings.push(`${target}: ${Date.now() - started} ms`);
    done = target;
    const [stat] = await own(`SELECT count(*)::int n, count(DISTINCT (lattice_q, lattice_r))::int points, min(slot_index)::int lo, max(slot_index)::int hi
      FROM ${SCHEMA}.region_slots WHERE region_key = 'family.siblings'`);
    assert.deepEqual(stat, { n: target, points: target, lo: 0, hi: target - 1 }, `C01 ${target} topics: ${target} distinct points, the spiral's first ${target} slots`);
  }
  const centre = (await centreOf('family.siblings')).map(BigInt);
  const pts = await own(`SELECT world_x::text x, world_y::text y FROM ${SCHEMA}.region_slots WHERE region_key = 'family.siblings'`);
  const radius = Math.max(...pts.map((p) => distance([BigInt(p.x), BigInt(p.y)], centre)));
  assert.ok(radius < 534_000, `C02 5,000 topics stay within half the distance to another major (${Math.round(radius)})`);
  // Distinct lattice points are 8,000 apart at least: check every neighbour pair of the dense spiral.
  const keyOf = (x, y) => `${x},${y}`;
  const taken = new Set(pts.map((p) => keyOf(p.x, p.y)));
  let nearest = Infinity;
  for (const p of pts.slice(0, 600)) {
    for (const [dx, dy] of [[8000n, 0n], [4000n, 6929n], [-4000n, 6929n], [3999n, 0n], [0n, 7999n]]) {
      const other = keyOf(String(BigInt(p.x) + dx), String(BigInt(p.y) + dy));
      if (taken.has(other)) nearest = Math.min(nearest, Math.hypot(Number(dx), Number(dy)));
    }
  }
  assert.ok(nearest >= 8000, 'C03 no two places closer than 8,000');
  console.log(`0181 capacity (one sub-region): ${timings.join(', ')}; radius ${Math.round(radius)}`);
}

// --------------------------------------------------------------------------------------------------- 6. concurrency
async function verifyConcurrency(f) {
  // The main session holds the World singleton (its publications above, uncommitted). A second session's placement waits.
  const { q2, actAs2, close } = await rt.openSecondary();
  try {
    await actAs2(f.mohamed);
    const racing = q2(`SELECT * FROM ${SCHEMA}.publish_public_experience_with_placement_v1($1, $2, $3)`, [randomUUID(), randomUUID(), randomUUID()]);
    racing.catch(() => undefined);
    assert.equal(await rt.stillPending(racing), true, 'K01 a second placement waits on the World singleton before reading any slot');
    await q('ROLLBACK');
    const settled = await racing.then(() => 'ANSWERED', (error) => error.code);
    assert.notEqual(settled, 'ANSWERED', 'K01 then answers the unchanged publication\'s own refusal for an unknown topic');
    assert.notEqual(settled, '55P03', 'K01 it waited for the lock, it did not time out');
  } finally {
    await close();
  }
  assert.deepEqual(await own(`SELECT count(*)::int n FROM ${SCHEMA}.region_slots`), [{ n: 0 }], 'K02 everything rolled back: no slot was committed');
}

// ---------------------------------------------------------------------------------------------------------- fixture
async function fixture() {
  const f = rt.newFixture();
  await asRole('postgres');
  await rt.provision(f);
  f.e1 = await readyExperience(f);
  f.e2 = await readyExperience(f);
  f.e3 = await readyExperience(f);
  f.e4 = await readyExperience(f);
  f.e5 = await readyExperience(f);
  f.e6 = await readyExperience(f);
  f.titleWord = marker();
  f.title = `عنوان الموضوع ${f.titleWord}`;
  f.written = `كتبت هذا عن الشغل ${marker()}`;
  await asRole('postgres');
  assert.equal((await rt.admission(f.reader))[0].admission, 'ADMITTED', 'fixture: an admitted registered viewer');
  return f;
}

await runVerifier('0181', async (stage) => {
  await rt.client.connect();
  stage('boundary');
  await verifyBoundary();
  stage('vocabulary and geometry');
  await verifyGeometry();
  await q('BEGIN');
  try {
    stage('family');
    await verifyFamily();
    stage('fixture');
    const seam = await rt.captureSeam();
    const f = await fixture();
    const freeze = await openFreeze();
    try {
      stage('server channel');
      await verifyServerChannel(f);
    } finally {
      await closeFreeze(freeze);
    }
    stage('publication-time placement');
    await verifyPlacement(f, seam);
    stage('capacity');
    await verifyCapacity(f);
    stage('concurrency');
    await verifyConcurrency(f);
  } finally {
    await q('ROLLBACK').catch(() => undefined);
  }
  await asRole('postgres');
  assert.ok((await rt.captureSeam()).prosrc.includes('NOT_EVALUATED'), 'L01 after rollback the CW2-08 seam answers NOT_EVALUATED');
  assert.ok((await rt.functionPosture(FREEZE_SEAM)).prosrc.includes('NOT_EVALUATED'), 'L01 and the freeze seam is closed');
  console.log('Verified migration 0181: the Public interpretation reads one title-free bounded package and answers a closed region profile whose dominant sub-region alone is kept; the region vocabulary and its geometry are exactly the API\'s; a place is assigned only inside the publication transaction, at the dominant sub-region\'s next free slot under the World lock, committed through the unchanged 0145 command, and rolls back with a publication that is still closed; similar topics sit 8,000 apart, a compound sits in its dominant sub-region, no section, title or popularity reaches the rule, a retry moves nothing, an older place is kept, 5,000 topics fit one sub-region, and a second session waits on the World lock.');
}, async () => { await rt.client.end().catch(() => undefined); });
