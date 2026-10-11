// MEM-AR-01C - Memory Subject Identity, Atomicity & Evidence Protection: the real-PostgreSQL verifier for migration 0152.
//
// It proves, against a fully migrated database (API CI applies every migration first), the 01C rows of the approved
// validation matrix (Task Contract §10.1):
//   W-1   the catalog: two append-only provenance tables (owner-only RLS, no API write privilege, immutable, erasure-only
//         DELETE, CASCADE with the Memory), every new function's owner / security mode / empty search_path / EXECUTE,
//         the six legacy writers executable by no application role, and the WRITER CENSUS - the functions an
//         application role can execute that change public.memories, directly or through what they call, are exactly
//         {server_finalize_memory_control_turn_v2, background_record_memory_v1, the governed erasure};
//         the Controlled Changes are their defining bodies plus exactly the marked lines (CC-M1 on 0028 L2, CC-H1 on
//         the 0033 completion) and the 0152 bodies (CC-M2' / CC-M3'); the command shape CHECK keeps every 0128 disjunct;
//   K-1   the SQL equivalence key equals the 01A TypeScript normalizer on the shared golden fixture;
//   L-1   on a FRESH scratch database (0001-0151, the legacy fixture matrix (a)-(g), then 0152 exactly as CI applies it):
//         only (a) becomes SELF, and memories, hypotheses, history and withdrawal records are byte-identical; the
//         reliance distribution on the injected Hypotheses is reported;
//   CC    CC-M1 / CC-M2' / CC-M3' on real rows (L2 SELF-only, NOT_SELF / UNATTRIBUTED before LAPSED, both taints, attach
//         refused), the insert guard (an attribution only WITH its Memory), immutability;
//   S-1   the subject lifecycle through v2 (question, SELF / OTHER / DECLINE answers, an unknown answer lapses, at most
//         one answer, a sensitive request declined before any question) and that v1 can reach none of the new shapes;
//   D-1   duplicates: RECONFIRMED, CORRECTED_TO_EXISTING, FORGET / DISABLE / CORRECT over a legacy pair, the lineage
//         invariant, the export label;
//   D-2   (RC-C2) the same words about the user and about someone else are two facts: FORGET / DISABLE of either
//         subject, a DISABLED copy, an UNATTRIBUTED copy retired only with the compatible fact (disposition provenance),
//         the UNATTRIBUTED legacy pair unchanged, CORRECT and CORRECTED_TO_EXISTING never retiring or keeping the other
//         subject's Memory, another owner untouched;
//   S-2   (L-11) no cross-subject correction by inference: the correction's own subject question names its UNATTRIBUTED
//         fact (its own owner-token read, the request's words through a "which one?" chain), only CORRECTED of that fact
//         with a confirmed subject (USER_CLARIFIED) or a decline answers it, once, from the very next turn; under the lock a
//         newly established equivalent changes nothing; PG-02 stays withheld; R2 for both turns;
//   L-2   RECONFIRMED over an unattributed row linked by a Hypothesis: one successor, withheld before and after, never NONE;
//   R2    background_record_memory_v1: SKIPPED_COMMAND_TURN for a target answer and a subject answer (the confirmed
//         R2 shape), the replay writes nothing, an ordinary turn is captured; W-3 SUPERSEDED_BY_LATER_COMMAND;
//         EQUIVALENT_EXISTS; W-6 ALREADY_RECORDED with the same id; the 0072 association check;
//   H-2   CC-H1: a zero-support validated candidate is refused 22023 CANDIDATE_WITHOUT_SUPPORT directly and through the
//         grounded wrapper, and the ledger is unchanged; a supported candidate still completes;
//   W-5   failure injected after each write step, foreground and background: nothing survives;
//   I-1   two-sided isolation of both tables and of every class, lock decision and stale-capture fact;
//   L-4   a seeded property test over random command and capture sequences: no Hypothesis ever moves from withheld to
//         NONE, every SUPERSEDED row keeps its lineage, no attribution changes;
//   W-2 / W-4  on two real connections, the second shown to block: REMEMBER vs background capture of the same fact (both
//         orders), CORRECT into a value being captured (both orders), two sessions remembering the same fact - exactly
//         one ACTIVE copy each time; v2 against the 0151 bind guard over the same Memory, both orders, no 40P01.
// Committed race fixtures are removed and the removal is checked; the scratch database is dropped.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(root, 'database/migrations');
const MIGRATION = '0152_memory_subject_identity_atomicity_v1.sql';
const migrationText = (name) => readFileSync(join(MIGRATIONS, name), 'utf8').replace(/\r\n/gu, '\n');
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = [], on = client) => (await on.query(text, values)).rows;
const one = async (text, values = [], on = client) => (await rows(text, values, on))[0];
const count = async (text, values = [], on = client) => Number((await one(text, values, on)).n);

async function rejected(operation, codes, message, on = client) {
  let refusal;
  await on.query('SAVEPOINT expected_refusal');
  try { await operation(); } catch (error) { refusal = error; } finally {
    await on.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await on.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code} (${refusal.message})`);
  if (message) assert.match(refusal.message, message);
  return refusal;
}
async function actAs(role, userId = null, on = client, extra = {}) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [userId ? JSON.stringify({ sub: userId, role, ...extra }) : '{}']);
}
async function asOwner(on = client) {
  await on.query('RESET ROLE');
  await on.query("SELECT set_config('request.jwt.claims', '{}', true)");
}
/** Runs `work` as service_role. After a failure nothing more is sent: the caller's savepoint or rollback restores the role. */
async function asServer(work, on = client) {
  await actAs('service_role', null, on);
  const value = await work();
  await asOwner(on);
  return value;
}

// ------------------------------------------------------------------------------------------------------------------
// Fixtures. Explicit, strictly increasing instants: "the immediately preceding user turn" and "a later command" are
// orders, and every fixture row of one transaction would otherwise share CURRENT_TIMESTAMP.
// ------------------------------------------------------------------------------------------------------------------
let tick = 0;
const nextInstant = () => new Date(Date.UTC(2026, 9, 1, 9, 0, 0) + 1000 * tick++).toISOString();

async function reader(on = client) {
  const id = randomUUID();
  await on.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  return id;
}
async function session(userId, on = client) {
  const id = randomUUID();
  await on.query("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, userId]);
  return id;
}
async function userTurn(userId, sessionId, { status = 'GENERATING', content = 'a Memory request', on = client } = {}) {
  const id = randomUUID();
  const at = nextInstant();
  await on.query(
    `INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, created_at, updated_at, completed_at)
     VALUES ($1, $2, $3, 'USER', $4, $5, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', $6, $6, CASE WHEN $4 = 'COMPLETED' THEN $6::timestamptz END)`,
    [id, sessionId, userId, status, content, at],
  );
  return id;
}
let memorySequence = 0;
/** One owned Memory written as the table owner (an earlier writer's row). `subject` attributes it before anything links it. */
async function memory(userId, { content, type = 'PERSONAL_FACT', status = 'ACTIVE', subject = null, expiresIn = null, on = client } = {}) {
  const id = randomUUID();
  memorySequence += 1;
  await on.query(
    `INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status, expires_at)
     VALUES ($1, $2, $3, $4, 'USER_STATED', 0.95, 0.65, $5, CASE WHEN $6::integer IS NULL THEN NULL ELSE now() + make_interval(days => $6::integer) END)`,
    [id, userId, type, content ?? `verifier-0152 fact ${memorySequence}`, status, expiresIn],
  );
  if (subject) {
    await on.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis) VALUES ($1, $2, $3, 'EXPLICIT_STATEMENT')", [id, userId, subject]);
  }
  return id;
}
const link = (memoryId) => `memory:${memoryId}`;
/** The 0151 housekeeping core at its full bound, as the owner. */
const HOUSEKEEPING_LIMIT = 32;
const housekeep = async (userId, on = client) => Number((await one('SELECT public.reevaluate_withdrawn_hypothesis_evidence_core_v1($1, $2) AS n', [userId, HOUSEKEEPING_LIMIT], on)).n);
async function hypothesis(userId, { supporting = [], contradicting = [], scope = 'verifier-0152 scope', on = client } = {}) {
  const id = randomUUID();
  await on.query(
    `INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, status, supporting_evidence_ids, contradicting_evidence_ids, assumptions)
     VALUES ($1, $2, $3, 'BEHAVIORAL', 'WORK', $4, 'SYSTEM_GENERATED', 'ACTIVE', $5, $6, ARRAY['verifier-0152 assumption'])`,
    [id, userId, `verifier-0152 statement ${id.slice(-4)}.`, scope, supporting.map(link), contradicting.map(link)],
  );
  return id;
}
const change = async (id, { now = 'CURRENT_TIMESTAMP', on = client } = {}) => (await one(`SELECT public.hypothesis_evidence_change_core_v1(h.user_id, h.id,
  h.supporting_evidence_ids, h.contradicting_evidence_ids, ${now}) AS value FROM public.hypotheses h WHERE h.id = $1`, [id], on)).value;
const standing = async (userId, memoryId, now = 'CURRENT_TIMESTAMP', on = client) =>
  (await one(`SELECT public.personal_evidence_standing_v1($1, $2, ${now}) AS s`, [userId, link(memoryId)], on)).s;
const memoryRow = (id, on = client) => one('SELECT * FROM public.memories WHERE id = $1', [id], on);
const attributionOf = (id, on = client) => one('SELECT subject, basis, command_id, execution_id FROM public.memory_subject_attributions WHERE memory_id = $1', [id], on);
const dispositionsOf = (userId, on = client) => rows('SELECT memory_id, command_id, primary_memory_id, disposition FROM public.memory_equivalence_dispositions WHERE user_id = $1 ORDER BY memory_id', [userId], on);
const commandOf = (sourceTurnId, on = client) => one('SELECT * FROM public.memory_control_commands WHERE source_turn_id = $1', [sourceTurnId], on);
const commandsOf = (userId, on = client) => rows('SELECT * FROM public.memory_control_commands WHERE user_id = $1 ORDER BY created_at, id', [userId], on);
const activeContents = async (userId, on = client) => (await rows("SELECT content FROM public.memories WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY content", [userId], on)).map((r) => r.content);

const V2 = 'SELECT * FROM public.server_finalize_memory_control_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)';
function v2Args(c) {
  const writes = c.outcome === 'REMEMBERED' || c.outcome === 'CORRECTED';
  return [
    c.session, c.user, c.turn, c.assistant ?? randomUUID(), c.kind, c.outcome,
    c.target ?? null, c.newId ?? (writes ? randomUUID() : null), c.type ?? (writes ? 'PERSONAL_FACT' : null), c.content ?? null,
    writes ? 0.98 : null, writes ? 0.65 : null, null,
    c.candidates ?? [], c.answers ?? null, c.subject ?? null, c.equivalent ?? null,
    c.reply ?? `reply:${c.outcome}`,
    c.replyIfChanged ?? (['CORRECTED', 'FORGOTTEN', 'DISABLED'].includes(c.outcome) ? 'reply:TARGET_CHANGED' : null),
    c.replyIfExisting ?? (writes ? 'reply:EXISTING' : null),
    randomUUID(), null, null,
  ];
}
/** One v2 command as service_role: the committed outcome and the reply that was finalized with it (or [] for nothing). */
async function finalize2(c, on = client) {
  const answer = await asServer(() => rows(V2, v2Args(c), on), on);
  return answer.map((row) => ({ outcome: row.outcome, reply: row.assistant_turn?.content }));
}
const V1 = 'SELECT * FROM public.server_finalize_memory_control_turn_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)';
const v1Args = (c) => [c.session, c.user, c.turn, randomUUID(), c.kind, c.outcome, c.target ?? null, c.newId ?? null, c.type ?? null, c.content ?? null,
  c.newId ? 0.98 : null, c.newId ? 0.65 : null, null, c.candidates ?? [], c.answers ?? null, 'reply', null, randomUUID(), null, null];

/** A completed user turn with its RUNNING post-response execution and MEMORY_WRITE claimed (the 0072 association). */
async function execution(userId, sessionId, { content = 'an ordinary statement', on = client, claim = true } = {}) {
  const turn = await userTurn(userId, sessionId, { status: 'COMPLETED', content, on });
  const id = randomUUID();
  await on.query(`INSERT INTO public.post_response_intelligence_executions (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path,
      safety_disposition, state, current_stage) VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', 'RUNNING', 'VERIFIER_0152')`, [id, randomUUID(), userId, sessionId, turn]);
  if (claim) await on.query("INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state) VALUES ($1, 'MEMORY_WRITE', 'CLAIMED')", [id]);
  return { turn, id };
}
const RECORD = 'SELECT * FROM public.background_record_memory_v1($1, $2, $3, $4, 0.95, 0.75, NULL)';
const record = async (sourceTurnId, content, { type = 'STABLE_PREFERENCE', memoryId = randomUUID(), on = client } = {}) =>
  asServer(() => one(RECORD, [sourceTurnId, memoryId, type, content], on), on);

// ------------------------------------------------------------------------------------------------------------------
// W-1. The catalog.
// ------------------------------------------------------------------------------------------------------------------
const NEW_FUNCTIONS = {
  'public.memory_equivalence_key_v1(text)': { definer: false, roles: [] },
  'public.guard_memory_provenance_record_v1()': { definer: false, roles: [] },
  'public.guard_memory_subject_attribution_insert_v1()': { definer: false, roles: [] },
  'public.memory_status_only_supersede_v1(uuid,uuid)': { definer: true, roles: [] },
  'public.memory_equivalence_lock_v1(uuid)': { definer: false, roles: [] },
  'public.memory_subject_v1(uuid,uuid)': { definer: false, roles: [] },
  'public.memory_dispose_equivalent_v1(uuid,uuid,uuid,uuid,text)': { definer: true, roles: [] },
  'public.pending_memory_subject_clarification_v1(uuid,uuid)': { definer: false, roles: ['authenticated'] },
  'public.pending_memory_correction_subject_clarification_v1(uuid,uuid)': { definer: false, roles: ['authenticated'] },
  'public.server_finalize_memory_control_turn_v2(uuid,uuid,uuid,uuid,text,text,uuid,uuid,text,text,double precision,double precision,timestamp with time zone,uuid[],uuid,text,uuid,text,text,text,uuid,uuid,uuid)': { definer: true, roles: ['service_role'] },
  'public.background_record_memory_v1(uuid,uuid,text,text,double precision,double precision,timestamp with time zone)': { definer: true, roles: ['service_role'] },
};
const REVOKED_WRITERS = [
  'public.server_create_memory_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamp with time zone)',
  'public.server_create_memory_for_execution_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamp with time zone)',
  'public.server_supersede_memory_v1(uuid,uuid,uuid,text,text,text,double precision,double precision,text,timestamp with time zone)',
  'public.server_mark_memory_deleted_v1(uuid,uuid)',
  'public.server_disable_memory_v1(uuid,uuid)',
  'public.server_finalize_memory_control_turn_v1(uuid,uuid,uuid,uuid,text,text,uuid,uuid,text,text,double precision,double precision,timestamp with time zone,uuid[],uuid,text,text,uuid,uuid,uuid)',
];
const API_ROLES = ['anon', 'authenticated', 'service_role'];
const normalizeBody = (text) => text.replace(/\r\n/gu, '\n').trim();
/** The body of `CREATE [OR REPLACE] FUNCTION <header>(...) ... AS $$<body>$$` in a migration text. */
function bodyOf(text, name, { replace = false } = {}) {
  const start = text.indexOf(`${replace ? 'CREATE OR REPLACE FUNCTION' : 'CREATE FUNCTION'} ${name}(`);
  assert.ok(start >= 0, `${name} is defined in its migration`);
  const open = text.indexOf('$$', start);
  const close = text.indexOf('$$', open + 2);
  return normalizeBody(text.slice(open + 2, close));
}
const liveBody = async (signature) => normalizeBody((await one('SELECT prosrc FROM pg_proc WHERE oid = $1::regprocedure', [signature])).prosrc);

async function verifyCatalog() {
  stage = 'W-1 catalog: the two provenance tables';
  for (const table of ['memory_subject_attributions', 'memory_equivalence_dispositions']) {
    const posture = await one(`SELECT c.relrowsecurity AS rls, pg_get_userbyid(c.relowner) AS owner FROM pg_class c WHERE c.oid = $1::regclass`, [`public.${table}`]);
    assert.deepEqual(posture, { rls: true, owner: 'postgres' }, `${table}: RLS on, owned by postgres`);
    for (const role of API_ROLES) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        assert.equal((await one('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, `public.${table}`, privilege])).allowed, false, `${role} has no ${privilege} on ${table}`);
      }
      assert.equal((await one('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, `public.${table}`, 'SELECT'])).allowed, role !== 'anon', `${role} SELECT on ${table}`);
    }
    const policies = await rows('SELECT policyname, cmd, roles::text AS roles, qual FROM pg_policies WHERE schemaname = $1 AND tablename = $2', ['public', table]);
    assert.equal(policies.length, 1, `${table}: one policy`);
    assert.deepEqual([policies[0].cmd, policies[0].roles], ['SELECT', '{authenticated}']);
    assert.match(policies[0].qual, /user_id = \( SELECT auth\.uid\(\)/u, 'owner-only');
    const fks = await rows(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'f'`, [`public.${table}`]);
    assert.ok(fks.length >= 1 && fks.every((fk) => /REFERENCES memories\(id, user_id\) ON DELETE CASCADE/u.test(fk.def)), `${table}: composite FKs to memories, CASCADE`);
  }
  const triggers = Object.fromEntries((await rows(`SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid IN
    ('public.memory_subject_attributions'::regclass, 'public.memory_equivalence_dispositions'::regclass) AND NOT tgisinternal`)).map((t) => [t.tgname, t.def]));
  assert.match(triggers.memory_subject_attributions_immutable, /BEFORE DELETE OR UPDATE .* guard_memory_provenance_record_v1/u);
  assert.match(triggers.memory_equivalence_dispositions_immutable, /BEFORE DELETE OR UPDATE .* guard_memory_provenance_record_v1/u);
  assert.match(triggers.memory_subject_attributions_insert_guard, /BEFORE INSERT .* guard_memory_subject_attribution_insert_v1/u);
  for (const role of API_ROLES) {
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
      assert.equal((await one("SELECT has_table_privilege($1, 'public.memories', $2) AS allowed", [role, privilege])).allowed, false, `${role} has no ${privilege} on memories`);
    }
  }

  stage = 'W-1 catalog: every new function - owner, security mode, empty search_path, EXECUTE';
  for (const [signature, expected] of Object.entries(NEW_FUNCTIONS)) {
    const f = await one(`SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS definer, p.proconfig AS config FROM pg_proc p WHERE p.oid = $1::regprocedure`, [signature]);
    assert.deepEqual(f, { owner: 'postgres', definer: expected.definer, config: ['search_path=""'] }, signature);
    for (const role of [...API_ROLES, 'public']) {
      const allowed = role === 'public'
        ? (await one(`SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE p.oid = $1::regprocedure AND a.grantee = 0) AS allowed`, [signature])).allowed
        : (await one('SELECT has_function_privilege($1, $2::regprocedure, \'EXECUTE\') AS allowed', [role, signature])).allowed;
      assert.equal(allowed, expected.roles.includes(role), `${role} EXECUTE on ${signature}`);
    }
  }

  stage = 'W-1 catalog: the six legacy writers are executable by no application role';
  for (const signature of REVOKED_WRITERS) {
    for (const role of API_ROLES) {
      assert.equal((await one('SELECT has_function_privilege($1, $2::regprocedure, \'EXECUTE\') AS allowed', [role, signature])).allowed, false, `${role} cannot execute ${signature}`);
    }
  }

  stage = 'W-1 writer census: the application-executable Memory writers are exactly v2, the background writer and the governed erasure';
  const functions = await rows(`SELECT p.oid, n.nspname || '.' || p.proname AS name, p.prosrc AS src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'personal_data_private') AND p.prokind = 'f'`);
  const writes = (src) => /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.memories\b/iu.test(src);
  const writers = new Set(functions.filter((f) => writes(f.src)).map((f) => f.name));
  for (let grown = true; grown;) {
    grown = false;
    for (const f of functions) {
      if (writers.has(f.name)) continue;
      if ([...writers].some((w) => f.src.includes(`${w}(`))) { writers.add(f.name); grown = true; }
    }
  }
  const executable = new Set();
  for (const f of functions.filter((x) => writers.has(x.name))) {
    for (const role of API_ROLES) {
      const reach = await one(`SELECT has_function_privilege($1, $2::oid, 'EXECUTE') AND has_schema_privilege($1, p.pronamespace, 'USAGE') AS allowed
        FROM pg_proc p WHERE p.oid = $2::oid`, [role, f.oid]);
      if (reach.allowed) executable.add(f.name);
    }
  }
  // The governed erasure is 0130's two server entry points (the public wrapper and its private core), both unchanged.
  assert.deepEqual([...executable].sort(), ['personal_data_private.erase_personal_account_v1', 'public.background_record_memory_v1',
    'public.server_erase_personal_account_v1', 'public.server_finalize_memory_control_turn_v2'],
  'the writable set is exactly {v2, background_record_memory_v1, governed erasure}');

  stage = 'W-1 catalog: CC-M1 is the 0028 L2 body plus exactly one marked line';
  const l2Live = await liveBody('public.canonical_eligible_memory_ids_v1(uuid,timestamp with time zone)');
  const l2Defined = bodyOf(migrationText('0028_canonical_evidence_eligibility_v1.sql'), 'public.canonical_eligible_memory_ids_v1');
  const marked = l2Live.split('\n').filter((line) => line.includes('-- MEM-AR-01C CC-M1 (0152)'));
  assert.equal(marked.length, 1, 'exactly one marked line');
  assert.match(marked[0], /AND EXISTS \(SELECT 1 FROM public\.memory_subject_attributions attribution WHERE attribution\.memory_id=candidate\.id AND attribution\.user_id=p_user_id AND attribution\.subject='SELF'\)/u);
  assert.equal(l2Live.split('\n').filter((line) => !line.includes('-- MEM-AR-01C CC-M1 (0152)')).join('\n'), l2Defined, 'every other line is 0028\'s');

  stage = 'W-1 catalog: CC-H1 is the 0033 completion body plus exactly one marked line';
  const completionLive = await liveBody('public.complete_post_response_candidate_provider_effect_v1(uuid,text,jsonb)');
  const completionDefined = bodyOf(migrationText('0033_hypothesis_generation_atomicity_recovery_v1.sql'), 'public.complete_post_response_candidate_provider_effect_v1');
  const h1 = completionLive.split('\n').filter((line) => line.includes('-- MEM-AR-01C CC-H1 (0152)'));
  assert.equal(h1.length, 1);
  assert.match(h1[0], /jsonb_array_length\(candidate\.value->'supportingEvidenceIds'\)=0\) THEN RAISE EXCEPTION 'CANDIDATE_WITHOUT_SUPPORT' USING ERRCODE='22023'/u);
  assert.equal(completionLive.split('\n').filter((line) => !line.includes('-- MEM-AR-01C CC-H1 (0152)')).join('\n'), completionDefined);
  assert.equal(await liveBody('public.post_response_generation_candidates_valid_v1(jsonb)'),
    bodyOf(migrationText('0033_hypothesis_generation_atomicity_recovery_v1.sql'), 'public.post_response_generation_candidates_valid_v1'), 'the IMMUTABLE validator is unchanged');

  stage = 'W-1 catalog: CC-M2\' and CC-M3\' are the 0152 bodies; the rest of 0151 is untouched';
  const text0152 = migrationText(MIGRATION);
  for (const [name, signature] of [
    ['public.personal_evidence_standing_v1', 'public.personal_evidence_standing_v1(uuid,text,timestamp with time zone)'],
    ['public.hypothesis_evidence_change_core_v1', 'public.hypothesis_evidence_change_core_v1(uuid,uuid,text[],text[],timestamp with time zone)'],
    ['public.memory_equivalence_key_v1', 'public.memory_equivalence_key_v1(text)'],
    ['public.server_finalize_memory_control_turn_v2', NEW_FUNCTIONS && Object.keys(NEW_FUNCTIONS).find((s) => s.includes('_v2('))],
    ['public.background_record_memory_v1', Object.keys(NEW_FUNCTIONS).find((s) => s.includes('background_record'))],
  ]) {
    const replace = name.includes('standing') || name.includes('change_core');
    assert.equal(await liveBody(signature), bodyOf(text0152, name, { replace }), `${name} is exactly the 0152 body`);
  }
  for (const [name, signature] of [
    ['public.reevaluate_withdrawn_hypothesis_evidence_core_v1', 'public.reevaluate_withdrawn_hypothesis_evidence_core_v1(uuid,integer)'],
    ['public.guard_hypothesis_evidence_link_removal_v1', 'public.guard_hypothesis_evidence_link_removal_v1()'],
    ['public.guard_formal_question_binding_reliance_v1', 'public.guard_formal_question_binding_reliance_v1()'],
  ]) {
    assert.equal(await liveBody(signature), bodyOf(migrationText('0151_personal_evidence_truth_maintenance_v1.sql'), name), `${name} (housekeeping / link guard / bind guard) is 0151's`);
  }

  stage = 'W-1 catalog: the command shape CHECK keeps every 0128 disjunct verbatim';
  const shape = (await one(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'memory_control_commands_shape_check'`)).def;
  for (const outcome of ['INSPECTED', 'CLARIFICATION_REQUIRED', 'TARGET_CHANGED', 'SUBJECT_CLARIFICATION_REQUIRED', 'RECONFIRMED', 'CORRECTED_TO_EXISTING']) assert.ok(shape.includes(`'${outcome}'`), outcome);
  const defined0128 = migrationText('0128_conversational_memory_control_v1.sql');
  const block = defined0128.slice(defined0128.indexOf('CONSTRAINT memory_control_commands_shape_check CHECK ('), defined0128.indexOf('CREATE INDEX memory_control_commands_user_session_idx'));
  const block0152 = text0152.slice(text0152.indexOf('ADD CONSTRAINT memory_control_commands_shape_check CHECK ('), text0152.indexOf('-- MEM-AR-01C (0152)', text0152.indexOf('ADD CONSTRAINT memory_control_commands_shape_check')));
  const disjuncts = (text) => text.split('\n').map((line) => line.trim()).filter((line) => /^(?:\(kind|OR \(kind|AND )/u.test(line)).map((line) => line.replace(/^OR /u, ''));
  assert.deepEqual(disjuncts(block0152), disjuncts(block), 'the 0128 disjuncts, verbatim and in order');
}

// ------------------------------------------------------------------------------------------------------------------
// K-1. Equivalence-key parity with the committed 01A TypeScript normalizer.
// ------------------------------------------------------------------------------------------------------------------
async function verifyKeyParity() {
  stage = 'K-1: memory_equivalence_key_v1 equals normalizeArabicComparison on the shared golden fixture';
  const fixture = JSON.parse(readFileSync(join(root, 'database/fixtures/memory-equivalence-key-v1.json'), 'utf8'));
  assert.ok(fixture.cases.length >= 30);
  for (const row of fixture.cases) {
    assert.equal((await one('SELECT public.memory_equivalence_key_v1($1) AS key', [row.raw])).key, row.expected, row.name);
  }
  assert.equal((await one('SELECT public.memory_equivalence_key_v1(NULL) AS key')).key, null, 'STRICT');
  assert.equal(await count("SELECT count(*) AS n FROM pg_proc WHERE oid = 'public.memory_equivalence_key_v1(text)'::regprocedure AND provolatile = 'i' AND proparallel = 's'"), 1, 'IMMUTABLE, PARALLEL SAFE');
}

// ------------------------------------------------------------------------------------------------------------------
// L-1. The legacy attribution on a FRESH scratch database: 0001-0151, the fixture matrix, then 0152 as CI applies it.
// ------------------------------------------------------------------------------------------------------------------
async function verifyLegacyAttribution() {
  stage = 'L-1: scratch database at 0151';
  const name = `qandeel_v0152_${randomUUID().replace(/-/gu, '').slice(0, 12)}`;
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  await client.query(`CREATE DATABASE ${name}`);
  const scratch = new Client({ connectionString: url.toString() });
  try {
    await scratch.connect();
    const bootstrap = readFileSync(join(root, 'database/supabase-compatible-bootstrap.sql'), 'utf8').replace(/^CREATE ROLE [^;]*;$/gmu, '');
    await scratch.query(bootstrap);
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f < '0152').sort()) await scratch.query(migrationText(file));
    assert.equal((await one("SELECT to_regclass('public.memory_subject_attributions') IS NULL AS absent", [], scratch)).absent, true, 'before 0152 no attribution exists');

    stage = 'L-1: the legacy fixture matrix (a)-(g)';
    const q = (text, values) => scratch.query(text, values);
    const user = randomUUID();
    await q('INSERT INTO auth.users (id) VALUES ($1)', [user]);
    const sessionId = randomUUID();
    await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [sessionId, user]);
    const base = Date.UTC(2026, 6, 1, 10);
    const at = (seconds) => new Date(base + seconds * 1000).toISOString();
    let clock = 0;
    async function legacy({ ledger = 1, window = 'inside', version = 1, commandResult = false, commandTurn = false, content }) {
      clock += 100;
      const turn = randomUUID();
      await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, created_at, updated_at, completed_at)
        VALUES ($1, $2, $3, 'USER', 'COMPLETED', 'legacy turn', 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', $4, $4, $4)`, [turn, sessionId, user, at(clock)]);
      let predecessor = null;
      if (version > 1) {
        predecessor = randomUUID();
        await q(`INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status, version, created_at, updated_at)
          VALUES ($1, $2, 'STABLE_PREFERENCE', 'legacy predecessor', 'USER_STATED', 0.95, 0.75, 'SUPERSEDED', 1, $3, $3)`, [predecessor, user, at(clock + 1)]);
      }
      const id = randomUUID();
      const created = window === 'inside' ? at(clock + 5) : at(clock + 50);
      await q(`INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status, version, supersedes_memory_id, created_at, updated_at)
        VALUES ($1, $2, 'STABLE_PREFERENCE', $3, 'USER_STATED', 0.95, 0.75, 'ACTIVE', $4, $5, $6, $6)`, [id, user, content, version, predecessor, created]);
      for (let n = 0; n < ledger; n += 1) {
        const executionId = randomUUID();
        await q(`INSERT INTO public.post_response_intelligence_executions (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path,
            safety_disposition, state, current_stage, outcome_code, terminal_at) VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', 'COMPLETED', 'DONE', 'COMPLETED', $6)`,
        [executionId, randomUUID(), user, sessionId, n === 0 ? turn : randomUUID(), at(clock + 20)]);
        await q(`INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state, claimed_at, completed_at, result_code, result_reference)
          VALUES ($1, 'MEMORY_WRITE', 'COMPLETED', $2, $3, 'FRESH_EVIDENCE_CREATED', $4)`, [executionId, at(clock + 2), at(clock + 10), `memory:${id}`]);
      }
      if (commandResult || commandTurn) {
        await q(`INSERT INTO public.memory_control_commands (id, user_id, session_id, source_turn_id, kind, outcome, result_memory_id)
          VALUES ($1, $2, $3, $4, 'REMEMBER', $5, $6)`, [randomUUID(), user, sessionId, commandTurn ? turn : await (async () => {
          const other = randomUUID();
          await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, created_at, updated_at, completed_at)
            VALUES ($1, $2, $3, 'USER', 'COMPLETED', 'legacy command turn', 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', $4, $4, $4)`, [other, sessionId, user, at(clock + 30)]);
          return other;
        })(), commandResult ? 'REMEMBERED' : 'ALREADY_REMEMBERED', commandResult ? id : null]);
      }
      return id;
    }
    const matrix = {
      a: await legacy({ content: 'أنا بحب القهوة.' }),
      b: await legacy({ content: 'legacy (b) command result', commandResult: true }),
      c: await legacy({ content: 'legacy (c) outside the claim window', window: 'outside' }),
      d: await legacy({ content: 'legacy (d) two ledger references', ledger: 2 }),
      e: await legacy({ content: 'legacy (e) a successor, version 2', version: 2 }),
      f: await legacy({ content: 'legacy (f) captured on a command turn', commandTurn: true }),
      g: await legacy({ content: 'legacy (g) no ledger entry', ledger: 0 }),
    };
    const hypothesesOf = {};
    for (const [key, supporting] of Object.entries({ onlyA: [matrix.a], onlyG: [matrix.g], aAndG: [matrix.a, matrix.g], onlyB: [matrix.b] })) {
      const id = randomUUID();
      await q(`INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, status, supporting_evidence_ids)
        VALUES ($1, $2, $3, 'BEHAVIORAL', 'WORK', 'legacy scope', 'SYSTEM_GENERATED', 'ACTIVE', $4)`, [id, user, `legacy ${key}.`, supporting.map(link)]);
      hypothesesOf[key] = id;
    }
    const reliance = async () => {
      const values = {};
      for (const [key, id] of Object.entries(hypothesesOf)) {
        values[key] = (await one(`SELECT public.hypothesis_evidence_change_core_v1(h.user_id, h.id,
          h.supporting_evidence_ids, h.contradicting_evidence_ids, CURRENT_TIMESTAMP) AS v FROM public.hypotheses h WHERE h.id = $1`, [id], scratch)).v;
      }
      return values;
    };
    const before = await reliance();
    assert.deepEqual(before, { onlyA: 'NONE', onlyG: 'NONE', aAndG: 'NONE', onlyB: 'NONE' }, 'before 0152 every legacy Hypothesis is relied on');
    const tables = (await rows(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND (c.relname IN ('memories', 'hypotheses', 'hypothesis_evidence_withdrawal_reevaluations') OR c.relname LIKE 'historical\\_%') ORDER BY 1`, [], scratch)).map((r) => r.relname);
    const snapshot = async () => {
      const digests = {};
      for (const table of tables) {
        digests[table] = await one(`SELECT count(*)::int AS n, md5(coalesce(string_agg(row_to_json(t)::text, '|' ORDER BY row_to_json(t)::text), '')) AS digest FROM public.${table} t`, [], scratch);
      }
      return digests;
    };
    const protectedBefore = await snapshot();

    stage = 'L-1: 0152 applied exactly as CI applies it';
    await scratch.query(migrationText(MIGRATION));
    const attributed = await rows('SELECT memory_id, subject, basis, command_id, execution_id IS NOT NULL AS has_execution FROM public.memory_subject_attributions', [], scratch);
    assert.deepEqual(attributed.map((r) => [r.memory_id, r.subject, r.basis, r.command_id, r.has_execution]), [[matrix.a, 'SELF', 'LEGACY_FIRST_PERSON_CAPTURE', null, true]],
      'only (a) - the proven background capture - is SELF; (b)-(g) stay UNATTRIBUTED');
    assert.deepEqual(await snapshot(), protectedBefore, 'memories, hypotheses, the history rows and the withdrawal records are byte-identical');
    const after = await reliance();
    assert.deepEqual(after, { onlyA: 'NONE', onlyG: 'NO_REMAINING_SUPPORT', aAndG: 'REVIEW_PENDING', onlyB: 'NO_REMAINING_SUPPORT' },
      'the subject taint is added once: a Hypothesis citing an unproven row is withheld, one citing only the proven row is not');
    console.log(`  L-1 attribution split on the injected matrix: SELF 1 / UNATTRIBUTED 6; reliance before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);
  } finally {
    await scratch.end().catch(() => undefined);
    await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  }
  assert.equal(await count('SELECT count(*) AS n FROM pg_database WHERE datname = $1', [name]), 0, 'the scratch database is dropped');
}

// ------------------------------------------------------------------------------------------------------------------
// CC-M1 / CC-M2' / CC-M3' and the attribution guard on real rows (rolled back).
// ------------------------------------------------------------------------------------------------------------------
async function verifyEvidenceProtection() {
  const me = await reader();
  stage = 'CC-M1: L2 is SELF-only, inside the unchanged 64-row window';
  const self = await memory(me, { subject: 'SELF', content: 'I work at the bank.' });
  const other = await memory(me, { subject: 'OTHER', content: 'My sister works at the bank.' });
  const unattributed = await memory(me, { content: 'Remembered without a subject.' });
  const l2 = (await rows('SELECT memory_id FROM public.canonical_eligible_memory_ids_v1($1, CURRENT_TIMESTAMP)', [me])).map((r) => r.memory_id);
  assert.deepEqual(l2, [self], 'OTHER and UNATTRIBUTED are never personal Evidence');

  stage = 'CC-M2\': the standings, with the subject taints before LAPSED';
  assert.deepEqual([await standing(me, self), await standing(me, other), await standing(me, unattributed)], ['CURRENT', 'NOT_SELF', 'UNATTRIBUTED']);
  const soon = 'CURRENT_TIMESTAMP + interval \'400 days\'';
  const selfExpiring = await memory(me, { subject: 'SELF', expiresIn: 30, type: 'TEMPORARY_STATE' });
  const otherExpiring = await memory(me, { subject: 'OTHER', expiresIn: 30, type: 'TEMPORARY_STATE' });
  const unattributedExpiring = await memory(me, { expiresIn: 30, type: 'TEMPORARY_STATE' });
  assert.deepEqual([await standing(me, selfExpiring, soon), await standing(me, otherExpiring, soon), await standing(me, unattributedExpiring, soon)],
    ['LAPSED', 'NOT_SELF', 'UNATTRIBUTED'], 'expiry never turns a subject taint into LAPSED');

  stage = 'CC-M3\': both subject standings taint; SELF support alone is relied on';
  const onSelf = await hypothesis(me, { supporting: [self] });
  const onOther = await hypothesis(me, { supporting: [other] });
  const mixed = await hypothesis(me, { supporting: [self, unattributed] });
  const contradictedByOther = await hypothesis(me, { supporting: [self], contradicting: [other] });
  assert.deepEqual([await change(onSelf), await change(onOther), await change(mixed), await change(contradictedByOther)],
    ['NONE', 'NO_REMAINING_SUPPORT', 'REVIEW_PENDING', 'REVIEW_PENDING']);
  assert.equal(await housekeep(me), 0, 'the housekeeping still detaches only WITHDRAWN links');
  assert.deepEqual([await change(onOther), await change(mixed)], ['NO_REMAINING_SUPPORT', 'REVIEW_PENDING'], 'identical after the housekeeping');

  stage = 'CC-M1: an OTHER or UNATTRIBUTED Memory cannot be attached (22023), as the owner\'s own attach';
  const target = await hypothesis(me, { supporting: [self] });
  await actAs('authenticated', me);
  for (const id of [other, unattributed]) {
    await rejected(() => client.query('SELECT * FROM public.attach_hypothesis_evidence($1, $2, \'SUPPORTING\')', [target, link(id)]), ['22023'], /not eligible/u);
  }
  await asOwner();

  stage = 'guard: an attribution only WITH its Memory - never on a pre-existing linked, withdrawn, inactive or foreign row';
  const linked = await memory(me, { content: 'linked before attribution' });
  await hypothesis(me, { supporting: [linked] });
  const withdrawnLink = await memory(me, { content: 'named by a withdrawal record' });
  const deleted = await memory(me, { status: 'DELETED' });
  const stranger = await reader();
  const foreign = await memory(stranger);
  const attribute = (memoryId, userId = me) => client.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis) VALUES ($1, $2, 'SELF', 'EXPLICIT_STATEMENT')", [memoryId, userId]);
  await rejected(() => attribute(linked), ['42501'], /MEMORY_SUBJECT_ATTRIBUTION_ONLY_WITH_ITS_MEMORY/u);
  await rejected(() => attribute(deleted), ['42501']);
  await rejected(() => attribute(foreign), ['42501', '23503']);
  await rejected(() => attribute(foreign, me), ['42501', '23503']);
  const withHypothesis = await hypothesis(me, { supporting: [withdrawnLink, self] });
  await client.query("UPDATE public.memories SET status = 'DELETED' WHERE id = $1", [withdrawnLink]);
  assert.equal(await housekeep(me), 1);
  assert.deepEqual((await one('SELECT supporting_evidence_ids AS s FROM public.hypotheses WHERE id = $1', [withHypothesis])).s, [link(self)]);
  await rejected(() => attribute(withdrawnLink), ['42501']);
  await rejected(() => attribute(self), ['23505', '42501'], undefined);

  stage = 'immutability: no UPDATE, no DELETE outside the governed erasure, for either record';
  await rejected(() => client.query("UPDATE public.memory_subject_attributions SET subject = 'OTHER' WHERE memory_id = $1", [self]), ['55000'], /MEMORY_PROVENANCE_RECORD_IS_IMMUTABLE/u);
  await rejected(() => client.query('DELETE FROM public.memory_subject_attributions WHERE memory_id = $1', [self]), ['55000']);
  const copy = await memory(me, { content: 'I work at the bank.' });
  await client.query("UPDATE public.memories SET status = 'SUPERSEDED' WHERE id = $1", [copy]);
  await client.query("INSERT INTO public.memory_equivalence_dispositions (memory_id, user_id, command_id, primary_memory_id, disposition) VALUES ($1, $2, $3, $4, 'RECONFIRMED')", [copy, me, randomUUID(), self]);
  await rejected(() => client.query("UPDATE public.memory_equivalence_dispositions SET disposition = 'FORGOTTEN' WHERE memory_id = $1", [copy]), ['55000']);
  await rejected(() => client.query('DELETE FROM public.memory_equivalence_dispositions WHERE memory_id = $1', [copy]), ['55000']);
  const fresh1 = await memory(me);
  const fresh2 = await memory(me);
  await rejected(() => client.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, execution_id) VALUES ($1, $2, 'OTHER', 'FIRST_PERSON_CAPTURE', $3)", [fresh1, me, randomUUID()]), ['23514'], /capture_self_check/u);
  await rejected(() => client.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, command_id) VALUES ($1, $2, 'SELF', 'FIRST_PERSON_CAPTURE', $3)", [fresh2, me, randomUUID()]), ['23514'], /provenance_check/u);
}

// ------------------------------------------------------------------------------------------------------------------
// S-1. The subject lifecycle through v2, and v1's reach (rolled back).
// ------------------------------------------------------------------------------------------------------------------
async function verifySubjectLifecycle() {
  const me = await reader();
  const s = await session(me);
  const ask = async (content = 'افتكر إن ساكنة في طنطا') => {
    const turn = await userTurn(me, s, { content });
    const [answer] = await finalize2({ session: s, user: me, turn, kind: 'REMEMBER', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', reply: 'المعلومة دي عنك إنت، ولا عن حد تاني؟' });
    assert.deepEqual(answer, { outcome: 'SUBJECT_CLARIFICATION_REQUIRED', reply: 'المعلومة دي عنك إنت، ولا عن حد تاني؟' });
    return { turn, command: await commandOf(turn) };
  };
  const pendingFor = async (turnId) => { await actAs('authenticated', me); const r = await rows('SELECT * FROM public.pending_memory_subject_clarification_v1($1, $2)', [s, turnId]); await asOwner(); return r; };

  stage = 'S-1: the question writes one command and no Memory; the next turn reads it with the question turn\'s words';
  const memoriesBefore = await count('SELECT count(*) AS n FROM public.memories WHERE user_id = $1', [me]);
  const q1 = await ask();
  assert.deepEqual([q1.command.kind, q1.command.outcome, q1.command.target_memory_id, q1.command.result_memory_id, q1.command.candidate_memory_ids, q1.command.answers_command_id],
    ['REMEMBER', 'SUBJECT_CLARIFICATION_REQUIRED', null, null, [], null]);
  assert.equal(await count('SELECT count(*) AS n FROM public.memories WHERE user_id = $1', [me]), memoriesBefore, 'nothing is stored until the answer');
  const a1 = await userTurn(me, s, { content: 'عني' });
  assert.deepEqual(await pendingFor(a1), [{ command_id: q1.command.id, clarified_turn_content: 'افتكر إن ساكنة في طنطا' }]);

  stage = 'S-1: the SELF answer keeps it as the user\'s (USER_CLARIFIED), at most once';
  const kept = randomUUID();
  assert.deepEqual(await finalize2({ session: s, user: me, turn: a1, kind: 'REMEMBER', outcome: 'REMEMBERED', newId: kept, content: 'ساكنة في طنطا.', subject: 'SELF', answers: q1.command.id }),
    [{ outcome: 'REMEMBERED', reply: 'reply:REMEMBERED' }]);
  assert.deepEqual(await attributionOf(kept), { subject: 'SELF', basis: 'USER_CLARIFIED', command_id: (await commandOf(a1)).id, execution_id: null });
  assert.equal((await commandOf(a1)).answers_command_id, q1.command.id);
  assert.deepEqual(await finalize2({ session: s, user: me, turn: a1, kind: 'REMEMBER', outcome: 'REMEMBERED', content: 'ساكنة في طنطا.', subject: 'SELF', answers: q1.command.id }), [], 'a replayed answer turn writes nothing');
  const late = await userTurn(me, s, { content: 'عن حد تاني' });
  await rejected(() => finalize2({ session: s, user: me, turn: late, kind: 'REMEMBER', outcome: 'REMEMBERED', content: 'ساكنة في طنطا.', subject: 'OTHER', answers: q1.command.id }), ['42501'], /INVALID_MEMORY_CLARIFICATION_ANSWER/u);
  assert.deepEqual(await pendingFor(late), [], 'an answered question is no longer pending');

  stage = 'S-1: the OTHER answer, the DECLINE answer, and an unknown reply that lets the question lapse';
  const q2 = await ask('افتكر إن أحمد بيحب الكورة');
  const a2 = await userTurn(me, s, { content: 'عن حد تاني' });
  const otherId = randomUUID();
  assert.equal((await finalize2({ session: s, user: me, turn: a2, kind: 'REMEMBER', outcome: 'REMEMBERED', newId: otherId, content: 'أحمد بيحب الكورة.', subject: 'OTHER', answers: q2.command.id }))[0].outcome, 'REMEMBERED');
  assert.equal((await attributionOf(otherId)).subject, 'OTHER');
  const q3 = await ask('افتكر إن منى عندها شغل');
  const a3 = await userTurn(me, s, { content: 'لا' });
  assert.deepEqual(await finalize2({ session: s, user: me, turn: a3, kind: 'REMEMBER', outcome: 'CLARIFICATION_DECLINED', answers: q3.command.id }), [{ outcome: 'CLARIFICATION_DECLINED', reply: 'reply:CLARIFICATION_DECLINED' }]);
  const q4 = await ask('افتكر إن الجو حلو');
  const unrelated = await userTurn(me, s, { status: 'COMPLETED', content: 'ماشي يا عم' });
  void unrelated;
  const after = await userTurn(me, s, { content: 'عني' });
  assert.deepEqual(await pendingFor(after), [], 'a question lapses after any other turn: it is never re-asked and leaves nothing pending');
  await rejected(() => finalize2({ session: s, user: me, turn: after, kind: 'REMEMBER', outcome: 'REMEMBERED', content: 'الجو حلو.', subject: 'SELF', answers: q4.command.id }), ['42501']);

  stage = 'S-1: answers bind only to their own kind of question, and carry a decided subject';
  const q5 = await ask('افتكر إن سارة ساكنة في الإسكندرية');
  const a5 = await userTurn(me, s, { content: 'عنها' });
  await rejected(() => finalize2({ session: s, user: me, turn: a5, kind: 'REMEMBER', outcome: 'REMEMBERED', content: 'x y.', answers: q5.command.id }), ['22023'], /INVALID_MEMORY_CONTROL_SHAPE/u);
  await rejected(() => finalize2({ session: s, user: me, turn: a5, kind: 'REMEMBER', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', answers: q5.command.id }), ['42501']);
  await rejected(() => finalize2({ session: s, user: me, turn: a5, kind: 'FORGET', outcome: 'CLARIFICATION_DECLINED', answers: q5.command.id }), ['42501']);

  stage = 'S-1 / T-C3-6: v1 reaches none of the new shapes, and service_role cannot call it at all';
  const v1Turn = await userTurn(me, s, { content: 'v1' });
  await rejected(() => client.query(V1, v1Args({ session: s, user: me, turn: v1Turn, kind: 'REMEMBER', outcome: 'SUBJECT_CLARIFICATION_REQUIRED' })), ['22023'], /INVALID_MEMORY_CONTROL_OUTCOME/u);
  await rejected(() => client.query(V1, v1Args({ session: s, user: me, turn: v1Turn, kind: 'REMEMBER', outcome: 'CLARIFICATION_REQUIRED', candidates: [kept] })), ['23514'], /shape_check/u);
  const q6 = await ask('افتكر إن خالد مسافر');
  const a6 = await userTurn(me, s, { content: 'عن حد تاني' });
  await rejected(() => client.query(V1, v1Args({ session: s, user: me, turn: a6, kind: 'REMEMBER', outcome: 'REMEMBERED', newId: randomUUID(), type: 'PERSONAL_FACT', content: 'خالد مسافر.', answers: q6.command.id })), ['42501'], /INVALID_MEMORY_CLARIFICATION_ANSWER/u);
  await actAs('service_role');
  await rejected(() => client.query(V1, v1Args({ session: s, user: me, turn: a6, kind: 'INSPECT', outcome: 'INSPECTED' })), ['42501'], /permission denied/u);
  await asOwner();

  stage = 'T-C3-10: every 0128 shape is still admitted; the new shapes only as listed';
  const shapeTurn = () => userTurn(me, s, { status: 'COMPLETED', content: 'shape probe' });
  const insert = async (row) => client.query(`INSERT INTO public.memory_control_commands (id, user_id, session_id, source_turn_id, kind, outcome, target_memory_id, result_memory_id, candidate_memory_ids, answers_command_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [randomUUID(), me, s, await shapeTurn(), row.kind, row.outcome, row.target ?? null, row.result ?? null, row.candidates ?? [], row.answers ?? null]);
  const someMemory = await memory(me);
  const clarification = randomUUID();
  await client.query(`INSERT INTO public.memory_control_commands (id, user_id, session_id, source_turn_id, kind, outcome, candidate_memory_ids) VALUES ($1, $2, $3, $4, 'FORGET', 'CLARIFICATION_REQUIRED', $5)`, [clarification, me, s, await shapeTurn(), [someMemory]]);
  for (const row of [
    { kind: 'INSPECT', outcome: 'INSPECTED' }, { kind: 'INSPECT', outcome: 'NOTHING_REMEMBERED' },
    { kind: 'REMEMBER', outcome: 'REMEMBERED', result: someMemory }, { kind: 'REMEMBER', outcome: 'ALREADY_REMEMBERED' }, { kind: 'REMEMBER', outcome: 'DECLINED_SENSITIVE' },
    { kind: 'CORRECT', outcome: 'CORRECTED', target: someMemory, result: someMemory }, { kind: 'CORRECT', outcome: 'ALREADY_CORRECT' },
    { kind: 'FORGET', outcome: 'FORGOTTEN', target: someMemory }, { kind: 'DISABLE', outcome: 'DISABLED', target: someMemory },
    { kind: 'FORGET', outcome: 'TARGET_NOT_FOUND' }, { kind: 'DISABLE', outcome: 'TARGET_NOT_SPECIFIED' },
    { kind: 'CORRECT', outcome: 'CLARIFICATION_REQUIRED', candidates: [someMemory] }, { kind: 'FORGET', outcome: 'TARGET_CHANGED', target: someMemory },
    { kind: 'FORGET', outcome: 'CLARIFICATION_DECLINED', answers: clarification },
    { kind: 'REMEMBER', outcome: 'SUBJECT_CLARIFICATION_REQUIRED' }, { kind: 'REMEMBER', outcome: 'RECONFIRMED', target: someMemory, result: someMemory },
    { kind: 'CORRECT', outcome: 'CORRECTED_TO_EXISTING', target: someMemory, result: someMemory },
    { kind: 'CORRECT', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', target: someMemory },
  ]) await insert(row);
  for (const row of [
    { kind: 'REMEMBER', outcome: 'RECONFIRMED', result: someMemory }, { kind: 'FORGET', outcome: 'CORRECTED_TO_EXISTING', target: someMemory, result: someMemory },
    { kind: 'REMEMBER', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', candidates: [someMemory] }, { kind: 'REMEMBER', outcome: 'CLARIFICATION_REQUIRED', candidates: [someMemory] },
    { kind: 'REMEMBER', outcome: 'CLARIFICATION_DECLINED' }, { kind: 'CORRECT', outcome: 'SUBJECT_CLARIFICATION_REQUIRED' },
    { kind: 'CORRECT', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', target: someMemory, result: someMemory }, { kind: 'CORRECT', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', target: someMemory, candidates: [someMemory] },
    { kind: 'FORGET', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', target: someMemory },
  ]) await rejected(() => insert(row), ['23514']);
}

// ------------------------------------------------------------------------------------------------------------------
// D-1 + L-2. Duplicates, re-confirmation and lineage through v2 (rolled back).
// ------------------------------------------------------------------------------------------------------------------
const lineageViolations = (userId, on = client) => rows(`SELECT m.id,
    (SELECT count(*) FROM public.memories s WHERE s.supersedes_memory_id = m.id)
  + (SELECT count(*) FROM public.memory_control_commands c WHERE c.outcome = 'CORRECTED_TO_EXISTING' AND c.target_memory_id = m.id)
  + (SELECT count(*) FROM public.memory_equivalence_dispositions d WHERE d.memory_id = m.id) AS relations
  FROM public.memories m WHERE m.user_id = $1 AND m.status = 'SUPERSEDED'`, [userId], on).then((r) => r.filter((x) => Number(x.relations) !== 1));

async function verifyDuplicates() {
  const me = await reader();
  const s = await session(me);
  let lastTurn;
  const turn = async () => (lastTurn = await userTurn(me, s));

  stage = 'D-1 / T-C1-4: REMEMBER over an UNATTRIBUTED equivalent is RECONFIRMED - one attributed successor, lineage kept';
  const legacyA = await memory(me, { type: 'STABLE_PREFERENCE', content: 'أنا بحب القهوة.' });
  const legacyA2 = await memory(me, { type: 'STABLE_PREFERENCE', content: 'أنا بحب القهوة' });
  const b = randomUUID();
  assert.deepEqual(await finalize2({ session: s, user: me, turn: await turn(), kind: 'REMEMBER', outcome: 'REMEMBERED', newId: b, type: 'STABLE_PREFERENCE', content: 'أنا بحب القهوة.', subject: 'SELF' }),
    [{ outcome: 'RECONFIRMED', reply: 'reply:REMEMBERED' }]);
  const successor = await memoryRow(b);
  assert.deepEqual([successor.supersedes_memory_id, successor.version, successor.status], [[legacyA, legacyA2].sort()[0], 2, 'ACTIVE']);
  assert.equal((await memoryRow(legacyA)).status, 'SUPERSEDED');
  assert.equal((await memoryRow(legacyA2)).status, 'SUPERSEDED');
  const [loser] = [legacyA, legacyA2].sort().slice(1);
  assert.deepEqual((await dispositionsOf(me)).map((d) => [d.memory_id, d.primary_memory_id, d.disposition]), [[loser, b, 'RECONFIRMED']]);
  assert.deepEqual((await attributionOf(b)).subject, 'SELF');
  assert.deepEqual(await finalize2({ session: s, user: me, turn: await turn(), kind: 'REMEMBER', outcome: 'REMEMBERED', type: 'STABLE_PREFERENCE', content: 'أنا بحب القهوة', subject: 'SELF' }),
    [{ outcome: 'ALREADY_REMEMBERED', reply: 'reply:EXISTING' }], 'a repeat is ALREADY_REMEMBERED');
  assert.deepEqual(await activeContents(me), ['أنا بحب القهوة.'], 'one ACTIVE copy');

  stage = 'D-1: an equivalent with a DIFFERENT subject is a different fact (both kept)';
  const otherTea = await memory(me, { type: 'STABLE_PREFERENCE', content: 'بتحب الشاي.', subject: 'OTHER' });
  assert.equal((await finalize2({ session: s, user: me, turn: await turn(), kind: 'REMEMBER', outcome: 'REMEMBERED', type: 'STABLE_PREFERENCE', content: 'بتحب الشاي.', subject: 'SELF' }))[0].outcome, 'REMEMBERED');
  assert.equal((await memoryRow(otherTea)).status, 'ACTIVE');

  stage = 'D-1 (C1.6): a correction into a value already remembered is CORRECTED_TO_EXISTING - the target superseded status-only';
  const october = await memory(me, { content: 'أنا ساكن في أكتوبر.', subject: 'SELF' });
  const tanta = await memory(me, { content: 'أنا ساكن في طنطا.', subject: 'SELF' });
  assert.deepEqual(await finalize2({ session: s, user: me, turn: await turn(), kind: 'CORRECT', outcome: 'CORRECTED', target: october, content: 'أنا ساكن في طنطا.', subject: 'SELF' }),
    [{ outcome: 'CORRECTED_TO_EXISTING', reply: 'reply:EXISTING' }]);
  assert.deepEqual([(await memoryRow(october)).status, (await memoryRow(tanta)).status], ['SUPERSEDED', 'ACTIVE']);
  assert.equal(await count('SELECT count(*) AS n FROM public.memories WHERE supersedes_memory_id = $1', [october]), 0, 'no second copy, no successor row');
  const c16 = await commandOf(lastTurn);
  assert.deepEqual([c16.outcome, c16.target_memory_id, c16.result_memory_id], ['CORRECTED_TO_EXISTING', october, tanta]);

  stage = 'D-1: FORGET, DISABLE and CORRECT over a legacy duplicate pair change every copy, each with its disposition';
  const forgetA = await memory(me, { content: 'شغلي في البنك.' });
  const forgetB = await memory(me, { content: 'شغلي في البنك', subject: 'SELF' });
  const forgetC = await memory(me, { content: 'شغلي في البنك.', status: 'DISABLED' });
  assert.equal((await finalize2({ session: s, user: me, turn: await turn(), kind: 'FORGET', outcome: 'FORGOTTEN', target: forgetA }))[0].outcome, 'FORGOTTEN');
  for (const id of [forgetA, forgetB, forgetC]) assert.equal((await memoryRow(id)).status, 'DELETED');
  const forgetCommand = (await commandOf(lastTurn)).id;
  assert.deepEqual((await dispositionsOf(me)).filter((d) => d.command_id === forgetCommand).map((d) => [d.memory_id, d.disposition]).sort(),
    [[forgetB, 'FORGOTTEN'], [forgetC, 'FORGOTTEN']].sort());
  const disableA = await memory(me, { content: 'أنا بحب الجري.', type: 'STABLE_PREFERENCE', subject: 'SELF' });
  const disableB = await memory(me, { content: 'أنا بحب الجري', type: 'STABLE_PREFERENCE' });
  assert.equal((await finalize2({ session: s, user: me, turn: await turn(), kind: 'DISABLE', outcome: 'DISABLED', target: disableA }))[0].outcome, 'DISABLED');
  assert.deepEqual([(await memoryRow(disableA)).status, (await memoryRow(disableB)).status], ['DISABLED', 'DISABLED']);
  const correctA = await memory(me, { content: 'أنا شغال في المصنع.', subject: 'SELF' });
  const correctB = await memory(me, { content: 'أنا شغال في المصنع' });
  const corrected = randomUUID();
  assert.equal((await finalize2({ session: s, user: me, turn: await turn(), kind: 'CORRECT', outcome: 'CORRECTED', target: correctA, newId: corrected, content: 'أنا شغال في المكتب.' }))[0].outcome, 'CORRECTED');
  assert.deepEqual([(await memoryRow(correctA)).status, (await memoryRow(correctB)).status, (await memoryRow(corrected)).supersedes_memory_id], ['SUPERSEDED', 'SUPERSEDED', correctA]);
  assert.deepEqual(await attributionOf(corrected), { subject: 'SELF', basis: 'CORRECTION_INHERITED', command_id: (await commandOf(lastTurn)).id, execution_id: null },
    'an undecided correction inherits its target\'s proven subject');
  assert.equal((await dispositionsOf(me)).find((d) => d.memory_id === correctB).disposition, 'CORRECTED');

  stage = 'D-1: an UNATTRIBUTED target never becomes SELF by an undecided correction';
  const legacyJob = await memory(me, { content: 'أنا شغال في البنك.' });
  const inherited = randomUUID();
  await finalize2({ session: s, user: me, turn: await turn(), kind: 'CORRECT', outcome: 'CORRECTED', target: legacyJob, newId: inherited, content: 'أنا شغال في الشركة.' });
  assert.equal(await attributionOf(inherited), undefined, 'UNATTRIBUTED in, UNATTRIBUTED out');

  stage = 'D-1: the lineage invariant - every SUPERSEDED row has exactly one successor, CORRECTED_TO_EXISTING target or disposition';
  assert.deepEqual(await lineageViolations(me), []);
  const exported = await one('SELECT personal_data_private.build_personal_export_v1($1) AS e', [me]);
  const states = Object.fromEntries(exported.e.memory.map((m) => [m.text, m.state]));
  assert.equal(states['أنا ساكن في أكتوبر.'], 'replaced by a correction', 'the export label stays truthful for a status-only supersede');

  stage = 'L-2: RECONFIRMED over an UNATTRIBUTED row linked by a Hypothesis - one successor; withheld before and after; never NONE';
  const anchor = await memory(me, { content: 'أنا بحب المشي الصبح.', type: 'STABLE_PREFERENCE' });
  const selfSupport = await memory(me, { content: 'أنا بصحى بدري.', subject: 'SELF' });
  const h = await hypothesis(me, { supporting: [anchor] });
  const h2 = await hypothesis(me, { supporting: [anchor, selfSupport] });
  assert.deepEqual([await change(h), await change(h2)], ['NO_REMAINING_SUPPORT', 'REVIEW_PENDING'], 'withheld before');
  const reconfirmed = randomUUID();
  assert.equal((await finalize2({ session: s, user: me, turn: await turn(), kind: 'REMEMBER', outcome: 'REMEMBERED', newId: reconfirmed, type: 'STABLE_PREFERENCE', content: 'أنا بحب المشي الصبح.', subject: 'SELF' }))[0].outcome, 'RECONFIRMED');
  assert.deepEqual([await change(h), await change(h2)], ['NO_REMAINING_SUPPORT', 'REVIEW_PENDING'], 'withheld after: the re-confirmation restores nothing');
  await client.query('UPDATE public.hypotheses SET supporting_evidence_ids = array_append(supporting_evidence_ids, $2), version = version + 1 WHERE id = $1', [h, link(reconfirmed)]);
  assert.equal(await change(h), 'REVIEW_PENDING', 'even with the new attributed support attached, the old taint keeps it withheld - never NONE');
  assert.deepEqual(await lineageViolations(me), []);
}

// ------------------------------------------------------------------------------------------------------------------
// D-2 (RC-C2). The same words about the user and about someone else are two facts (rolled back): a command about one
// never retires the other because the words match. Copies are retired only with a compatible subject - equal, or one
// side UNATTRIBUTED - the rule the v2 header states for every equivalent, now applied to FORGET and DISABLE as it
// already was to CORRECT.
// ------------------------------------------------------------------------------------------------------------------
async function verifySubjectIsolation() {
  const me = await reader();
  const stranger = await reader();
  const s = await session(me);
  let lastTurn;
  const turn = async () => (lastTurn = await userTurn(me, s));
  const statuses = async (...ids) => Promise.all(ids.map(async (id) => (await memoryRow(id)).status));
  const pair = async (content, type = 'PERSONAL_FACT') => [
    await memory(me, { content, type, subject: 'SELF' }), await memory(me, { content, type, subject: 'OTHER' })];
  const dispositionsBy = async (command) => (await dispositionsOf(me)).filter((d) => d.command_id === command)
    .map((d) => [d.memory_id, d.primary_memory_id, d.disposition]);

  stage = 'D-2: FORGET of the user\'s fact leaves someone else\'s fact with the same words (and another owner\'s copy)';
  const [selfA, otherA] = await pair('عيد الميلاد يوم ٥ مارس.');
  const strangersCopy = await memory(stranger, { content: 'عيد الميلاد يوم ٥ مارس.', subject: 'SELF' });
  assert.equal((await finalize2({ session: s, user: me, turn: await turn(), kind: 'FORGET', outcome: 'FORGOTTEN', target: selfA }))[0].outcome, 'FORGOTTEN');
  assert.deepEqual(await statuses(selfA, otherA, strangersCopy), ['DELETED', 'ACTIVE', 'ACTIVE']);
  assert.deepEqual(await dispositionsBy((await commandOf(lastTurn)).id), [], 'no disposition: nothing else was retired');

  stage = 'D-2: FORGET of someone else\'s fact leaves the user\'s fact with the same words';
  const [selfB, otherB] = await pair('بيحب الكورة.', 'STABLE_PREFERENCE');
  assert.equal((await finalize2({ session: s, user: me, turn: await turn(), kind: 'FORGET', outcome: 'FORGOTTEN', target: otherB }))[0].outcome, 'FORGOTTEN');
  assert.deepEqual(await statuses(selfB, otherB), ['ACTIVE', 'DELETED']);

  stage = 'D-2: FORGET never deletes a DISABLED copy about someone else either';
  // An attribution is created only with an ACTIVE Memory, so the other person's copy is disabled through v2 itself.
  const [selfC, otherC] = await pair('بيشتغل في البنك.');
  await finalize2({ session: s, user: me, turn: await turn(), kind: 'DISABLE', outcome: 'DISABLED', target: otherC });
  assert.deepEqual(await statuses(selfC, otherC), ['ACTIVE', 'DISABLED']);
  await finalize2({ session: s, user: me, turn: await turn(), kind: 'FORGET', outcome: 'FORGOTTEN', target: selfC });
  assert.deepEqual(await statuses(selfC, otherC), ['DELETED', 'DISABLED']);

  stage = 'D-2: DISABLE of either subject leaves the other relied on';
  const [selfD, otherD] = await pair('بيحب الجري.', 'STABLE_PREFERENCE');
  assert.equal((await finalize2({ session: s, user: me, turn: await turn(), kind: 'DISABLE', outcome: 'DISABLED', target: selfD }))[0].outcome, 'DISABLED');
  assert.deepEqual(await statuses(selfD, otherD), ['DISABLED', 'ACTIVE']);
  const [selfE, otherE] = await pair('بيحب السفر.', 'STABLE_PREFERENCE');
  assert.equal((await finalize2({ session: s, user: me, turn: await turn(), kind: 'DISABLE', outcome: 'DISABLED', target: otherE }))[0].outcome, 'DISABLED');
  assert.deepEqual(await statuses(selfE, otherE), ['ACTIVE', 'DISABLED']);

  stage = 'D-2: an UNATTRIBUTED copy is retired with the attributed fact it is compatible with; the other subject stays';
  const [selfF, otherF] = await pair('بيحب القراءة.', 'STABLE_PREFERENCE');
  const legacyF = await memory(me, { content: 'بيحب القراءة', type: 'STABLE_PREFERENCE' });
  await finalize2({ session: s, user: me, turn: await turn(), kind: 'FORGET', outcome: 'FORGOTTEN', target: selfF });
  assert.deepEqual(await statuses(selfF, legacyF, otherF), ['DELETED', 'DELETED', 'ACTIVE']);
  assert.deepEqual(await dispositionsBy((await commandOf(lastTurn)).id), [[legacyF, selfF, 'FORGOTTEN']], 'disposition provenance: this command, the target');
  const [selfG, otherG] = await pair('بيحب الرسم.', 'STABLE_PREFERENCE');
  const legacyG = await memory(me, { content: 'بيحب الرسم.', type: 'STABLE_PREFERENCE' });
  await finalize2({ session: s, user: me, turn: await turn(), kind: 'DISABLE', outcome: 'DISABLED', target: otherG });
  assert.deepEqual(await statuses(otherG, legacyG, selfG), ['DISABLED', 'DISABLED', 'ACTIVE']);
  assert.deepEqual(await dispositionsBy((await commandOf(lastTurn)).id), [[legacyG, otherG, 'DISABLED']]);

  stage = 'D-2: an UNATTRIBUTED legacy pair is still one fact (unchanged)';
  const legacyH1 = await memory(me, { content: 'شغلي في المصنع.' });
  const legacyH2 = await memory(me, { content: 'شغلي في المصنع' });
  await finalize2({ session: s, user: me, turn: await turn(), kind: 'FORGET', outcome: 'FORGOTTEN', target: legacyH1 });
  assert.deepEqual(await statuses(legacyH1, legacyH2), ['DELETED', 'DELETED']);

  stage = 'D-2: CORRECT changes only its target\'s subject: someone else\'s copy of the old words stays ACTIVE';
  const [selfI, otherI] = await pair('ساكن في أكتوبر.');
  const successorI = randomUUID();
  assert.equal((await finalize2({ session: s, user: me, turn: await turn(), kind: 'CORRECT', outcome: 'CORRECTED', target: selfI, newId: successorI, content: 'ساكن في إسكندرية.' }))[0].outcome, 'CORRECTED');
  assert.deepEqual(await statuses(selfI, otherI, successorI), ['SUPERSEDED', 'ACTIVE', 'ACTIVE']);
  assert.equal((await attributionOf(successorI)).subject, 'SELF');

  stage = 'D-2: CORRECTED_TO_EXISTING keeps only a Memory with the successor\'s subject - never someone else\'s';
  const octoberJ = await memory(me, { content: 'أنا ساكن في الدقي.', subject: 'SELF' });
  const otherTantaJ = await memory(me, { content: 'أنا ساكن في الزمالك.', subject: 'OTHER' });
  const successorJ = randomUUID();
  // Even when the caller names the other person's Memory as the equivalent, the database does not keep it.
  assert.deepEqual(await finalize2({ session: s, user: me, turn: await turn(), kind: 'CORRECT', outcome: 'CORRECTED', target: octoberJ, newId: successorJ, content: 'أنا ساكن في الزمالك.', subject: 'SELF', equivalent: otherTantaJ }),
    [{ outcome: 'CORRECTED', reply: 'reply:CORRECTED' }]);
  assert.deepEqual(await statuses(octoberJ, successorJ, otherTantaJ), ['SUPERSEDED', 'ACTIVE', 'ACTIVE']);
  const commandJ = await commandOf(lastTurn);
  assert.deepEqual([commandJ.target_memory_id, commandJ.result_memory_id], [octoberJ, successorJ]);
  assert.deepEqual(await dispositionsBy(commandJ.id), []);
  // The same correction into the USER's own existing value is still CORRECTED_TO_EXISTING (unchanged).
  const heliopolisK = await memory(me, { content: 'أنا ساكن في مصر الجديدة.', subject: 'SELF' });
  const selfTargetK = await memory(me, { content: 'أنا ساكن في المعادي.', subject: 'SELF' });
  assert.deepEqual(await finalize2({ session: s, user: me, turn: await turn(), kind: 'CORRECT', outcome: 'CORRECTED', target: selfTargetK, content: 'أنا ساكن في مصر الجديدة.', subject: 'SELF' }),
    [{ outcome: 'CORRECTED_TO_EXISTING', reply: 'reply:EXISTING' }]);
  assert.deepEqual(await statuses(selfTargetK, heliopolisK), ['SUPERSEDED', 'ACTIVE']);

  stage = 'D-2: the lineage invariant holds and no attribution changed';
  assert.deepEqual(await lineageViolations(me), []);
  for (const [id, subject] of [[otherA, 'OTHER'], [selfB, 'SELF'], [otherC, 'OTHER'], [otherD, 'OTHER'], [selfE, 'SELF'], [otherF, 'OTHER'], [selfG, 'SELF'], [otherI, 'OTHER'], [otherTantaJ, 'OTHER']]) {
    assert.equal((await attributionOf(id)).subject, subject);
  }
  assert.equal(await count("SELECT count(*) AS n FROM public.memories WHERE user_id = $1 AND status <> 'ACTIVE'", [stranger]), 0, 'another owner is untouched');
}

// ------------------------------------------------------------------------------------------------------------------
// S-2 (L-11, Product Owner 2026-10-12). No cross-subject correction by inference (rolled back): an undecided correction
// of an UNATTRIBUTED fact never resolves into a Memory whose subject is established. The correction's own subject
// question names its exact fact; only CORRECTED of that fact with a confirmed subject (USER_CLARIFIED) or a decline
// answers it, once, from the very next turn; under the lock a newly established equivalent changes nothing.
// ------------------------------------------------------------------------------------------------------------------
async function verifyCorrectionSubject() {
  const me = await reader();
  const stranger = await reader();
  const s = await session(me);
  const QUESTION = 'المعلومة دي عنك إنت، ولا عن حد تاني؟';
  const statuses = async (...ids) => Promise.all(ids.map(async (id) => (await memoryRow(id)).status));
  const footprint = async () => JSON.stringify([
    await rows('SELECT id, status, version FROM public.memories WHERE user_id = $1 ORDER BY id', [me]),
    await rows('SELECT memory_id, subject FROM public.memory_subject_attributions WHERE user_id = $1 ORDER BY memory_id', [me]),
    await dispositionsOf(me)]);
  const pendingReads = async (turnId, userId = me) => {
    await actAs('authenticated', userId);
    const read = {
      correction: await rows('SELECT * FROM public.pending_memory_correction_subject_clarification_v1($1, $2)', [s, turnId]),
      remember: await rows('SELECT * FROM public.pending_memory_subject_clarification_v1($1, $2)', [s, turnId]),
      target: await rows('SELECT * FROM public.pending_memory_clarification_v1($1, $2)', [s, turnId]),
    };
    await asOwner();
    return read;
  };
  const ask = async (target, content = 'لا، مش شغال في البنك، شغال في الشركة', answers = null) => {
    const turn = await userTurn(me, s, { content });
    assert.deepEqual(await finalize2({ session: s, user: me, turn, kind: 'CORRECT', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', target, answers, reply: QUESTION }),
      [{ outcome: 'SUBJECT_CLARIFICATION_REQUIRED', reply: QUESTION }]);
    return { turn, command: await commandOf(turn) };
  };

  stage = 'S-2: the question names its UNATTRIBUTED fact, writes one command and changes no Memory';
  const legacy = await memory(me, { content: 'شغال في البنك.' });
  const mine = await memory(me, { content: 'أنا شغال في الشركة.', subject: 'SELF' });
  const hSupport = await hypothesis(me, { supporting: [legacy] });
  const elsewhere = await memory(me, { content: 'شغال في المصنع.' });
  const standingBefore = await change(hSupport);
  assert.notEqual(standingBefore, 'NONE', 'PG-02: a Hypothesis on an UNATTRIBUTED fact is withheld');
  const before = await footprint();
  const q1 = await ask(legacy);
  assert.deepEqual([q1.command.kind, q1.command.outcome, q1.command.target_memory_id, q1.command.result_memory_id, q1.command.candidate_memory_ids, q1.command.answers_command_id],
    ['CORRECT', 'SUBJECT_CLARIFICATION_REQUIRED', legacy, null, [], null]);
  assert.equal(await footprint(), before, 'asking changes no Memory, attribution or disposition');

  stage = 'S-2: its own read returns the fact and the request\'s words; the REMEMBER and target reads never see it';
  const a1 = await userTurn(me, s, { content: 'عني' });
  assert.deepEqual(await pendingReads(a1), {
    correction: [{ command_id: q1.command.id, target_memory_id: legacy, clarified_turn_content: 'لا، مش شغال في البنك، شغال في الشركة' }], remember: [], target: [] });
  assert.deepEqual((await pendingReads(a1, stranger)).correction, [], 'another owner reads nothing');

  stage = 'S-2: only CORRECTED of exactly that fact with a confirmed subject, or a decline, answers it';
  for (const [answer, codes] of [
    [{ kind: 'CORRECT', outcome: 'CORRECTED', target: elsewhere, content: 'أنا شغال في الشركة.', subject: 'SELF' }, ['42501']],
    [{ kind: 'CORRECT', outcome: 'CORRECTED', target: legacy, content: 'أنا شغال في الشركة.' }, ['42501']],
    [{ kind: 'CORRECT', outcome: 'ALREADY_CORRECT' }, ['42501']],
    [{ kind: 'CORRECT', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', target: legacy }, ['42501']],
    [{ kind: 'REMEMBER', outcome: 'REMEMBERED', content: 'أنا شغال في الشركة.', subject: 'SELF' }, ['42501']],
    [{ kind: 'FORGET', outcome: 'CLARIFICATION_DECLINED' }, ['42501']],
  ]) await rejected(() => finalize2({ session: s, user: me, turn: a1, answers: q1.command.id, ...answer }), codes);
  const strangerSession = await session(stranger);
  const strangerTurn = await userTurn(stranger, strangerSession, { content: 'عني' });
  await rejected(() => finalize2({ session: strangerSession, user: stranger, turn: strangerTurn,
    kind: 'CORRECT', outcome: 'CORRECTED', target: legacy, content: 'أنا شغال في الشركة.', subject: 'SELF', answers: q1.command.id }), ['42501']);
  assert.equal(await footprint(), before);

  stage = 'S-2: «عني» - the confirmed SELF answer keeps the user\'s existing Memory (CORRECTED_TO_EXISTING), once';
  assert.deepEqual(await finalize2({ session: s, user: me, turn: a1, kind: 'CORRECT', outcome: 'CORRECTED', target: legacy, content: 'أنا شغال في الشركة.', subject: 'SELF', answers: q1.command.id }),
    [{ outcome: 'CORRECTED_TO_EXISTING', reply: 'reply:EXISTING' }]);
  const c1 = await commandOf(a1);
  assert.deepEqual([c1.kind, c1.outcome, c1.target_memory_id, c1.result_memory_id, c1.answers_command_id], ['CORRECT', 'CORRECTED_TO_EXISTING', legacy, mine, q1.command.id]);
  assert.deepEqual(await statuses(legacy, mine), ['SUPERSEDED', 'ACTIVE']);
  assert.equal(await attributionOf(legacy), undefined, 'the corrected fact itself is never attributed');
  assert.equal((await attributionOf(mine)).subject, 'SELF');
  const standingAfter = await change(hSupport);
  assert.ok(standingAfter !== 'NONE', `PG-02: still withheld after the correction (${standingBefore} -> ${standingAfter})`);
  assert.deepEqual(await finalize2({ session: s, user: me, turn: a1, kind: 'CORRECT', outcome: 'CORRECTED', target: legacy, content: 'أنا شغال في الشركة.', subject: 'SELF', answers: q1.command.id }), [], 'a replayed answer turn writes nothing');
  const again = await userTurn(me, s, { content: 'عني' });
  assert.deepEqual((await pendingReads(again)).correction, [], 'an answered question is no longer pending');
  await rejected(() => finalize2({ session: s, user: me, turn: again, kind: 'CORRECT', outcome: 'CORRECTED', target: legacy, content: 'أنا شغال في الشركة.', subject: 'SELF', answers: q1.command.id }), ['42501'], /INVALID_MEMORY_CLARIFICATION_ANSWER/u);
  await client.query("UPDATE public.conversation_turns SET status = 'COMPLETED' WHERE id = $1", [again]);

  stage = 'S-2: «عن حد تاني» - the confirmed OTHER answer is a new fact about someone else; the user\'s Memory is untouched';
  const legacy2 = await memory(me, { content: 'ساكن في أكتوبر.' });
  const mineTanta = await memory(me, { content: 'أنا ساكن في طنطا.', subject: 'SELF' });
  const q2 = await ask(legacy2, 'لا، مش ساكن في أكتوبر، ساكن في طنطا');
  const a2 = await userTurn(me, s, { content: 'عن حد تاني' });
  const successor2 = randomUUID();
  assert.equal((await finalize2({ session: s, user: me, turn: a2, kind: 'CORRECT', outcome: 'CORRECTED', target: legacy2, newId: successor2, content: 'أنا ساكن في طنطا.', subject: 'OTHER', answers: q2.command.id }))[0].outcome, 'CORRECTED');
  assert.deepEqual(await statuses(legacy2, successor2, mineTanta), ['SUPERSEDED', 'ACTIVE', 'ACTIVE']);
  assert.equal((await memoryRow(successor2)).supersedes_memory_id, legacy2);
  assert.deepEqual(await attributionOf(successor2), { subject: 'OTHER', basis: 'USER_CLARIFIED', command_id: (await commandOf(a2)).id, execution_id: null });
  assert.deepEqual(await dispositionsOf(me), [], 'nothing about the user was retired');

  stage = 'S-2: a decline, an unrelated reply and a late answer change nothing';
  const legacy3 = await memory(me, { content: 'بيحب الشاي.', type: 'STABLE_PREFERENCE' });
  await memory(me, { content: 'أنا بحب الشاي.', type: 'STABLE_PREFERENCE', subject: 'OTHER' });
  const quiet = await footprint();
  const q3 = await ask(legacy3, 'لا، مش بيحب الشاي، بحب الشاي');
  const a3 = await userTurn(me, s, { content: 'لا' });
  assert.deepEqual(await finalize2({ session: s, user: me, turn: a3, kind: 'CORRECT', outcome: 'CLARIFICATION_DECLINED', answers: q3.command.id }), [{ outcome: 'CLARIFICATION_DECLINED', reply: 'reply:CLARIFICATION_DECLINED' }]);
  const q4 = await ask(legacy3, 'لا، مش بيحب الشاي، بحب الشاي');
  await userTurn(me, s, { status: 'COMPLETED', content: 'ماشي يا عم' });
  const late = await userTurn(me, s, { content: 'عني' });
  assert.deepEqual((await pendingReads(late)).correction, [], 'a question lapses after any other turn');
  await rejected(() => finalize2({ session: s, user: me, turn: late, kind: 'CORRECT', outcome: 'CORRECTED', target: legacy3, type: 'STABLE_PREFERENCE', content: 'أنا بحب الشاي.', subject: 'SELF', answers: q4.command.id }), ['42501']);
  assert.equal(await footprint(), quiet);
  await client.query("UPDATE public.conversation_turns SET status = 'COMPLETED' WHERE id = $1", [late]);

  stage = 'S-2: the question is asked only for an UNATTRIBUTED fact, and only by a correction';
  await rejected(async () => finalize2({ session: s, user: me, turn: await userTurn(me, s), kind: 'CORRECT', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', target: mine }), ['22023'], /INVALID_MEMORY_CONTROL_SHAPE/u);
  await rejected(async () => finalize2({ session: s, user: me, turn: await userTurn(me, s), kind: 'CORRECT', outcome: 'SUBJECT_CLARIFICATION_REQUIRED' }), ['22023'], /INVALID_MEMORY_CONTROL_SHAPE/u);
  await rejected(async () => finalize2({ session: s, user: me, turn: await userTurn(me, s), kind: 'FORGET', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', target: legacy3 }), ['22023'], /INVALID_MEMORY_CONTROL_SHAPE/u);

  stage = 'S-2: an undecided correction never resolves into an established subject under the lock - nothing changes';
  const legacy5 = await memory(me, { content: 'بيشتغل بالليل.' });
  const theirs5 = await memory(me, { content: 'أنا بشتغل بالليل.', subject: 'OTHER' });
  const quiet5 = await footprint();
  for (const equivalent of [null, theirs5]) {
    const turn = await userTurn(me, s);
    assert.deepEqual(await finalize2({ session: s, user: me, turn, kind: 'CORRECT', outcome: 'CORRECTED', target: legacy5, content: 'أنا بشتغل بالليل.', equivalent }),
      [{ outcome: 'TARGET_CHANGED', reply: 'reply:TARGET_CHANGED' }]);
    assert.deepEqual([(await commandOf(turn)).target_memory_id, (await commandOf(turn)).result_memory_id], [legacy5, null]);
  }
  assert.equal(await footprint(), quiet5, 'no successor, no supersede, no attribution, no disposition');
  // An UNATTRIBUTED equivalent alone is still the approved CORRECTED_TO_EXISTING (unchanged).
  const legacy6 = await memory(me, { content: 'بيصحى بدري.' });
  const copy6 = await memory(me, { content: 'أنا بصحى بدري.' });
  assert.equal((await finalize2({ session: s, user: me, turn: await userTurn(me, s), kind: 'CORRECT', outcome: 'CORRECTED', target: legacy6, content: 'أنا بصحى بدري.' }))[0].outcome, 'CORRECTED_TO_EXISTING');
  assert.deepEqual(await statuses(legacy6, copy6), ['SUPERSEDED', 'ACTIVE']);

  stage = 'S-2: chosen by "which one?", the question answers that question and keeps the words of the request that first asked';
  const x = await memory(me, { content: 'ساكن في الدقي.' });
  const y = await memory(me, { content: 'ساكن في الدقي.', type: 'STABLE_PREFERENCE' });
  const which = await userTurn(me, s, { content: 'لا، مش ساكن في الدقي، ساكن في الزمالك' });
  await finalize2({ session: s, user: me, turn: which, kind: 'CORRECT', outcome: 'CLARIFICATION_REQUIRED', candidates: [x, y] });
  const chose = await userTurn(me, s, { content: '1' });
  await rejected(async () => finalize2({ session: s, user: me, turn: chose, kind: 'CORRECT', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', target: legacy5, answers: (await commandOf(which)).id }), ['42501']);
  await finalize2({ session: s, user: me, turn: chose, kind: 'CORRECT', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', target: x, answers: (await commandOf(which)).id, reply: QUESTION });
  const subjectTurn = await userTurn(me, s, { content: 'عني' });
  assert.deepEqual((await pendingReads(subjectTurn)).correction,
    [{ command_id: (await commandOf(chose)).id, target_memory_id: x, clarified_turn_content: 'لا، مش ساكن في الدقي، ساكن في الزمالك' }]);
  const successorX = randomUUID();
  assert.equal((await finalize2({ session: s, user: me, turn: subjectTurn, kind: 'CORRECT', outcome: 'CORRECTED', target: x, newId: successorX, content: 'أنا ساكن في الزمالك.', subject: 'SELF', answers: (await commandOf(chose)).id }))[0].outcome, 'CORRECTED');
  assert.deepEqual(await statuses(x, y, successorX), ['SUPERSEDED', 'ACTIVE', 'ACTIVE']);
  assert.equal((await attributionOf(successorX)).basis, 'USER_CLARIFIED');

  stage = 'S-2 / R2: the question and answer turns are the command\'s; the background writes nothing for either';
  for (const turnId of [q1.turn, a1]) {
    const id = randomUUID();
    await client.query("UPDATE public.conversation_turns SET status = 'COMPLETED' WHERE id = $1 AND status <> 'COMPLETED'", [turnId]);
    await client.query(`INSERT INTO public.post_response_intelligence_executions (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path,
        safety_disposition, state, current_stage) VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', 'RUNNING', 'VERIFIER_0152')`, [id, randomUUID(), me, s, turnId]);
    await client.query("INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state) VALUES ($1, 'MEMORY_WRITE', 'CLAIMED')", [id]);
    assert.deepEqual(await record(turnId, 'أنا شغال في الشركة.', { type: 'PERSONAL_FACT' }), { outcome: 'SKIPPED_COMMAND_TURN', memory_id: null });
  }

  stage = 'S-2: the lineage invariant holds; another owner is untouched';
  assert.deepEqual(await lineageViolations(me), []);
  assert.equal(await count('SELECT count(*) AS n FROM public.memory_control_commands WHERE user_id = $1', [stranger]), 0);
}

// ------------------------------------------------------------------------------------------------------------------
// R2 + W-3 + W-6 + the background writer's contract (rolled back).
// ------------------------------------------------------------------------------------------------------------------
async function verifyBackgroundWriter() {
  const me = await reader();
  const s = await session(me);

  stage = 'background: the 0072 association - a RUNNING execution with MEMORY_WRITE claimed, nothing weaker';
  const unclaimed = await execution(me, s, { claim: false });
  await rejected(() => record(unclaimed.turn, 'أنا بحب البحر'), ['42501'], /MEMORY_WRITE_EXECUTION_NOT_ASSOCIATED/u);
  await rejected(() => record(randomUUID(), 'أنا بحب البحر'), ['42501']);

  stage = 'background: an ordinary first-person capture is CREATED with SELF / FIRST_PERSON_CAPTURE naming its execution';
  const ordinary = await execution(me, s, { content: 'أنا بحب البحر' });
  const sea = randomUUID();
  assert.deepEqual(await record(ordinary.turn, 'أنا بحب البحر.', { memoryId: sea }), { outcome: 'CREATED', memory_id: sea });
  assert.deepEqual(await attributionOf(sea), { subject: 'SELF', basis: 'FIRST_PERSON_CAPTURE', command_id: null, execution_id: ordinary.id });

  stage = 'W-6: a replay of the same execution answers ALREADY_RECORDED with the same Memory, and writes no second row';
  assert.deepEqual(await record(ordinary.turn, 'أنا بحب البحر.'), { outcome: 'ALREADY_RECORDED', memory_id: sea });
  assert.equal(await count("SELECT count(*) AS n FROM public.memories WHERE user_id = $1 AND content = 'أنا بحب البحر.'", [me]), 1);

  stage = 'background: an equivalent ACTIVE fact (SELF or UNATTRIBUTED) is EQUIVALENT_EXISTS; an OTHER one is not the user\'s';
  const again = await execution(me, s, { content: 'أنا بحب البحر' });
  assert.deepEqual(await record(again.turn, 'أنا  بحب البحــر'), { outcome: 'EQUIVALENT_EXISTS', memory_id: null });
  await memory(me, { type: 'STABLE_PREFERENCE', content: 'أنا بحب الجبل.' });
  assert.deepEqual(await record((await execution(me, s)).turn, 'أنا بحب الجبل.'), { outcome: 'EQUIVALENT_EXISTS', memory_id: null }, 'the background never retires or attributes it');
  await memory(me, { type: 'STABLE_PREFERENCE', content: 'بتحب الورد.', subject: 'OTHER' });
  assert.equal((await record((await execution(me, s)).turn, 'بتحب الورد.')).outcome, 'CREATED');

  stage = 'R2: a FORGET clarification answered in words - the forgotten fact is never re-created, on delivery or replay';
  const kushari = await memory(me, { type: 'STABLE_PREFERENCE', content: 'أنا بحب الكشري.', subject: 'SELF' });
  const ful = await memory(me, { type: 'STABLE_PREFERENCE', content: 'أنا بحب الفول.', subject: 'SELF' });
  const question = await userTurn(me, s, { content: 'انسى إني بحب' });
  await finalize2({ session: s, user: me, turn: question, kind: 'FORGET', outcome: 'CLARIFICATION_REQUIRED', candidates: [ful, kushari] });
  const asked = (await commandOf(question)).id;
  const answerTurn = await userTurn(me, s, { content: 'أنا بحب الكشري' });
  assert.equal((await finalize2({ session: s, user: me, turn: answerTurn, kind: 'FORGET', outcome: 'FORGOTTEN', target: kushari, answers: asked }))[0].outcome, 'FORGOTTEN');
  const answerExecution = randomUUID();
  await client.query(`INSERT INTO public.post_response_intelligence_executions (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path,
      safety_disposition, state, current_stage) VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', 'RUNNING', 'VERIFIER_0152')`, [answerExecution, randomUUID(), me, s, answerTurn]);
  await client.query("INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state) VALUES ($1, 'MEMORY_WRITE', 'CLAIMED')", [answerExecution]);
  assert.deepEqual(await record(answerTurn, 'أنا بحب الكشري.'), { outcome: 'SKIPPED_COMMAND_TURN', memory_id: null });
  assert.deepEqual(await record(answerTurn, 'أنا بحب الكشري.'), { outcome: 'SKIPPED_COMMAND_TURN', memory_id: null }, 'a replay writes nothing');
  assert.deepEqual((await rows("SELECT status FROM public.memories WHERE user_id = $1 AND content = 'أنا بحب الكشري.'", [me])).map((r) => r.status), ['DELETED']);
  assert.ok(!(await rows('SELECT memory_id FROM public.canonical_eligible_memory_ids_v1($1, CURRENT_TIMESTAMP)', [me])).some((r) => r.memory_id === kushari), 'never Evidence again');
  assert.equal((await record((await execution(me, s, { content: 'سؤال' })).turn, 'سؤال')).outcome, 'CREATED', 'an unrelated ordinary turn is still captured');
  const questionExecution = await (async () => {
    const id = randomUUID();
    await client.query(`INSERT INTO public.post_response_intelligence_executions (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path,
      safety_disposition, state, current_stage) VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', 'RUNNING', 'VERIFIER_0152')`, [id, randomUUID(), me, s, question]);
    await client.query("INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state) VALUES ($1, 'MEMORY_WRITE', 'CLAIMED')", [id]);
    return id;
  })();
  void questionExecution;
  assert.equal((await record(question, 'انسى إني بحب.')).outcome, 'SKIPPED_COMMAND_TURN', 'the question turn is the command\'s too');

  stage = 'R2 (S-2b): the subject answer «عن أختي» is the command\'s, never the user\'s relationship';
  const subjectQuestion = await userTurn(me, s, { content: 'افتكر إن ساكنة في طنطا' });
  await finalize2({ session: s, user: me, turn: subjectQuestion, kind: 'REMEMBER', outcome: 'SUBJECT_CLARIFICATION_REQUIRED' });
  const subjectAnswer = await userTurn(me, s, { content: 'عن أختي' });
  await finalize2({ session: s, user: me, turn: subjectAnswer, kind: 'REMEMBER', outcome: 'REMEMBERED', content: 'ساكنة في طنطا.', subject: 'OTHER', answers: (await commandOf(subjectQuestion)).id });
  const subjectExecution = randomUUID();
  await client.query(`INSERT INTO public.post_response_intelligence_executions (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path,
      safety_disposition, state, current_stage) VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', 'RUNNING', 'VERIFIER_0152')`, [subjectExecution, randomUUID(), me, s, subjectAnswer]);
  await client.query("INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state) VALUES ($1, 'MEMORY_WRITE', 'CLAIMED')", [subjectExecution]);
  assert.deepEqual(await record(subjectAnswer, 'عن أختي.', { type: 'RELATIONSHIP_CONTEXT' }), { outcome: 'SKIPPED_COMMAND_TURN', memory_id: null });

  stage = 'W-3: a capture delayed past a LATER forget / correction of the same fact is SUPERSEDED_BY_LATER_COMMAND';
  const early = await execution(me, s, { content: 'أنا بحب الشوكولاتة' });
  const chocolate = await memory(me, { type: 'STABLE_PREFERENCE', content: 'أنا بحب الشوكولاتة.', subject: 'SELF' });
  await finalize2({ session: s, user: me, turn: await userTurn(me, s, { content: 'انسى إني بحب الشوكولاتة' }), kind: 'FORGET', outcome: 'FORGOTTEN', target: chocolate });
  assert.deepEqual(await record(early.turn, 'أنا بحب الشوكولاتة.'), { outcome: 'SUPERSEDED_BY_LATER_COMMAND', memory_id: null });
  const earlyCorrection = await execution(me, s, { content: 'أنا ساكن في دمياط' });
  const damietta = await memory(me, { content: 'أنا ساكن في دمياط.', subject: 'SELF' });
  await finalize2({ session: s, user: me, turn: await userTurn(me, s), kind: 'CORRECT', outcome: 'CORRECTED', target: damietta, content: 'أنا ساكن في بورسعيد.', subject: 'SELF' });
  assert.equal((await record(earlyCorrection.turn, 'أنا ساكن في دمياط.', { type: 'PERSONAL_FACT' })).outcome, 'SUPERSEDED_BY_LATER_COMMAND');
  const late = await execution(me, s, { content: 'أنا بحب الشوكولاتة' });
  assert.equal((await record(late.turn, 'أنا بحب الشوكولاتة.')).outcome, 'CREATED', 'a statement made AFTER the forget is the user\'s new fact');

  stage = 'CC-H1 / H-2: a zero-support validated candidate is refused directly and through the grounded wrapper; the ledger is unchanged';
  const supported = await memory(me, { content: 'أنا بخلص شغلي متأخر.', subject: 'SELF' });
  const generation = await execution(me, s, { content: 'ليه أنا دايما متأخر' });
  const scope = `CONVERSATION_SESSION:${s}`;
  await client.query(`INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state, completed_at, result_code, result_payload)
    VALUES ($1, 'INTENT_PROVIDER', 'COMPLETED', CURRENT_TIMESTAMP, 'INTENT_AUTHORIZED', $2)`, [generation.id, JSON.stringify({
    problem: { text: 'ليه أنا دايما متأخر', source: 'CURRENT_USER_TURN', sourceTurnId: generation.turn },
    domain: 'WORK', scope: { kind: 'CONVERSATION_SESSION', sessionId: s, serialized: scope }, evidenceIds: [link(supported)] })]);
  await client.query("INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state) VALUES ($1, 'CANDIDATE_PROVIDER', 'CLAIMED')", [generation.id]);
  const candidate = (supporting) => JSON.stringify([{ hypothesisId: randomUUID(), statement: 'Late finishes follow late starts.', type: 'CAUSAL', domain: 'WORK', scope,
    supportingEvidenceIds: supporting, contradictingEvidenceIds: [], assumptions: [], disconfirmingConditions: [] }]);
  const ledger = () => one("SELECT state, result_code, result_payload FROM public.post_response_intelligence_effects WHERE execution_id = $1 AND effect_key = 'CANDIDATE_PROVIDER'", [generation.id]);
  const beforeLedger = await ledger();
  await rejected(() => asServer(() => client.query("SELECT public.complete_post_response_candidate_provider_effect_v1($1, 'VALIDATED_CANDIDATES', $2::jsonb)", [generation.id, candidate([])])), ['22023'], /CANDIDATE_WITHOUT_SUPPORT/u);
  await rejected(() => asServer(() => client.query("SELECT public.complete_post_response_grounded_candidates_v1($1, 'VALIDATED_CANDIDATES', $2::jsonb, '[]'::jsonb)", [generation.id, candidate([])])), ['22023'], /CANDIDATE_WITHOUT_SUPPORT/u);
  assert.deepEqual(await ledger(), beforeLedger, 'the ledger is unchanged');
  assert.equal((await asServer(() => one("SELECT public.complete_post_response_candidate_provider_effect_v1($1, 'VALIDATED_CANDIDATES', $2::jsonb) AS done", [generation.id, candidate([link(supported)])]))).done, true,
    'a supported candidate still completes');
}

// ------------------------------------------------------------------------------------------------------------------
// W-5. Failure injected after each write step: nothing survives (rolled back).
// ------------------------------------------------------------------------------------------------------------------
async function verifyFailureInjection() {
  stage = 'W-5: failure injection triggers (this transaction only)';
  await client.query(`CREATE FUNCTION pg_temp.verifier_0152_fail() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF current_setting('qandeel.verifier_0152_fail', true) = TG_TABLE_NAME || ':' || TG_OP THEN
        RAISE EXCEPTION 'VERIFIER_0152_INJECTED_FAILURE' USING ERRCODE = 'P0001';
      END IF;
      RETURN NULL;
    END $$`);
  for (const [table, events] of [['memories', 'INSERT OR UPDATE'], ['memory_subject_attributions', 'INSERT'], ['memory_equivalence_dispositions', 'INSERT'],
    ['memory_control_commands', 'INSERT'], ['conversation_turns', 'UPDATE']]) {
    await client.query(`CREATE TRIGGER verifier_0152_fail AFTER ${events} ON public.${table} FOR EACH ROW EXECUTE FUNCTION pg_temp.verifier_0152_fail()`);
  }
  const me = await reader();
  const s = await session(me);
  const footprint = async () => ({
    memories: await rows('SELECT id, status FROM public.memories WHERE user_id = $1 ORDER BY id', [me]),
    attributions: await count('SELECT count(*) AS n FROM public.memory_subject_attributions WHERE user_id = $1', [me]),
    dispositions: await count('SELECT count(*) AS n FROM public.memory_equivalence_dispositions WHERE user_id = $1', [me]),
    commands: await count('SELECT count(*) AS n FROM public.memory_control_commands WHERE user_id = $1', [me]),
    assistants: await count("SELECT count(*) AS n FROM public.conversation_turns WHERE user_id = $1 AND role = 'ASSISTANT'", [me]),
    generating: await count("SELECT count(*) AS n FROM public.conversation_turns WHERE user_id = $1 AND status = 'GENERATING'", [me]),
    history: await count('SELECT count(*) AS n FROM public.historical_material_events WHERE user_id = $1', [me]),
  });
  const legacy = await memory(me, { content: 'أنا بحب الرسم.', type: 'STABLE_PREFERENCE' });
  const legacyCopy = await memory(me, { content: 'أنا بحب الرسم', type: 'STABLE_PREFERENCE' });
  const target = await memory(me, { content: 'أنا ساكن في المنيا.', subject: 'SELF' });
  void legacyCopy;
  const turn = await userTurn(me, s);
  const capture = await execution(me, s, { content: 'أنا بحب النوم' });
  const before = await footprint();
  for (const [step, run] of [
    ['memories:INSERT', () => finalize2({ session: s, user: me, turn, kind: 'REMEMBER', outcome: 'REMEMBERED', type: 'STABLE_PREFERENCE', content: 'أنا بحب السفر.', subject: 'SELF' })],
    ['memory_subject_attributions:INSERT', () => finalize2({ session: s, user: me, turn, kind: 'REMEMBER', outcome: 'REMEMBERED', type: 'STABLE_PREFERENCE', content: 'أنا بحب السفر.', subject: 'SELF' })],
    ['memories:UPDATE', () => finalize2({ session: s, user: me, turn, kind: 'FORGET', outcome: 'FORGOTTEN', target })],
    ['memory_equivalence_dispositions:INSERT', () => finalize2({ session: s, user: me, turn, kind: 'REMEMBER', outcome: 'REMEMBERED', type: 'STABLE_PREFERENCE', content: 'أنا بحب الرسم.', subject: 'SELF', equivalent: legacy })],
    ['memory_control_commands:INSERT', () => finalize2({ session: s, user: me, turn, kind: 'CORRECT', outcome: 'CORRECTED', target, content: 'أنا ساكن في أسيوط.', subject: 'SELF' })],
    ['conversation_turns:UPDATE', () => finalize2({ session: s, user: me, turn, kind: 'DISABLE', outcome: 'DISABLED', target })],
    ['memories:INSERT', () => record(capture.turn, 'أنا بحب النوم.')],
    ['memory_subject_attributions:INSERT', () => record(capture.turn, 'أنا بحب النوم.')],
  ]) {
    stage = `W-5: a failure at ${step}`;
    await client.query("SELECT set_config('qandeel.verifier_0152_fail', $1, true)", [step]);
    await rejected(run, ['P0001'], /VERIFIER_0152_INJECTED_FAILURE/u);
    await client.query("SELECT set_config('qandeel.verifier_0152_fail', '', true)");
    assert.deepEqual(await footprint(), before, `nothing survives a failure at ${step}`);
  }
}

// ------------------------------------------------------------------------------------------------------------------
// I-1. Tenant isolation (rolled back).
// ------------------------------------------------------------------------------------------------------------------
async function verifyIsolation() {
  stage = 'I-1: RLS - each reader reads only their own attributions and dispositions';
  const alice = await reader();
  const bob = await reader();
  const sa = await session(alice);
  const sb = await session(bob);
  const aliceFact = await memory(alice, { type: 'STABLE_PREFERENCE', content: 'أنا بحب العنب.', subject: 'SELF' });
  const aliceCopy = await memory(alice, { type: 'STABLE_PREFERENCE', content: 'أنا بحب العنب' });
  await finalize2({ session: sa, user: alice, turn: await userTurn(alice, sa), kind: 'FORGET', outcome: 'FORGOTTEN', target: aliceFact });
  assert.equal(await count('SELECT count(*) AS n FROM public.memory_equivalence_dispositions WHERE memory_id = $1', [aliceCopy]), 1);
  for (const [as, own, other] of [[alice, 2, 0], [bob, 0, 0]]) {
    await actAs('authenticated', as);
    assert.equal(await count('SELECT count(*) AS n FROM public.memory_subject_attributions WHERE user_id = $1', [alice]) + await count('SELECT count(*) AS n FROM public.memory_equivalence_dispositions WHERE user_id = $1', [alice]), as === alice ? own : 0);
    assert.equal(await count('SELECT count(*) AS n FROM public.memory_subject_attributions WHERE memory_id = $1', [aliceFact]), as === alice ? 1 : other);
    assert.equal(await count('SELECT count(*) AS n FROM public.memory_equivalence_dispositions WHERE memory_id = $1', [aliceCopy]), as === alice ? 1 : other);
    await asOwner();
  }

  stage = 'I-1: v2 never acts on another reader\'s turn, target or equivalent';
  const bobTurn = await userTurn(bob, sb);
  assert.deepEqual(await finalize2({ session: sb, user: alice, turn: bobTurn, kind: 'INSPECT', outcome: 'INSPECTED' }), [], 'a foreign turn answers nothing');
  const bobFact = await memory(bob, { content: 'أنا ساكن في سوهاج.', subject: 'SELF' });
  const aliceTurn = await userTurn(alice, sa);
  await rejected(() => finalize2({ session: sa, user: alice, turn: aliceTurn, kind: 'FORGET', outcome: 'FORGOTTEN', target: bobFact }), ['42501'], /INVALID_MEMORY_CONTROL_TARGET/u);
  await rejected(() => finalize2({ session: sa, user: alice, turn: aliceTurn, kind: 'REMEMBER', outcome: 'REMEMBERED', content: 'أنا ساكن في سوهاج.', subject: 'SELF', equivalent: bobFact }), ['42501']);
  await rejected(() => finalize2({ session: sa, user: alice, turn: aliceTurn, kind: 'FORGET', outcome: 'CLARIFICATION_REQUIRED', candidates: [bobFact] }), ['42501']);

  stage = 'I-1: a class, an equivalence decision and a stale-capture fact never span owners';
  assert.equal((await finalize2({ session: sa, user: alice, turn: aliceTurn, kind: 'REMEMBER', outcome: 'REMEMBERED', content: 'أنا ساكن في سوهاج.', subject: 'SELF' }))[0].outcome, 'REMEMBERED',
    'bob holding the same words makes nothing ALREADY_REMEMBERED for alice');
  const bobGrapes = await memory(bob, { type: 'STABLE_PREFERENCE', content: 'أنا بحب التين.', subject: 'SELF' });
  const aliceEarly = await execution(alice, sa, { content: 'أنا بحب التين' });
  await finalize2({ session: sb, user: bob, turn: await userTurn(bob, sb), kind: 'FORGET', outcome: 'FORGOTTEN', target: bobGrapes });
  assert.equal((await record(aliceEarly.turn, 'أنا بحب التين.')).outcome, 'CREATED', 'bob\'s later forget is not alice\'s');
  assert.equal((await memoryRow(bobFact)).status, 'ACTIVE');
  await actAs('authenticated', bob);
  assert.deepEqual(await rows('SELECT * FROM public.pending_memory_subject_clarification_v1($1, $2)', [sa, aliceTurn]), [], 'a pending question is read only by its owner');
  await asOwner();
}

// ------------------------------------------------------------------------------------------------------------------
// L-4. A seeded property test: random command and capture sequences never lift a withheld Hypothesis (rolled back).
// ------------------------------------------------------------------------------------------------------------------
function prng(seed) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
}
async function verifyMonotonicity() {
  stage = 'L-4: property test over random command and capture sequences';
  const random = prng(152);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const me = await reader();
  const s = await session(me);
  const facts = ['أنا بحب القهوة.', 'أنا بحب الشاي.', 'أنا ساكن في طنطا.', 'أنا شغال في البنك.', 'أختي بتحب الكشري.'];
  const pool = [];
  const selfPool = [];
  for (const [index, content] of facts.entries()) {
    pool.push(await memory(me, { content, type: 'STABLE_PREFERENCE', subject: index % 3 === 0 ? 'SELF' : index % 3 === 1 ? null : 'OTHER', expiresIn: index === 1 ? 10 : null }));
    const self = await memory(me, { content, type: 'STABLE_PREFERENCE', subject: 'SELF', expiresIn: index === 2 ? 10 : null });
    pool.push(self);
    selfPool.push(self);
  }
  const hs = [];
  // Half start relied on (SELF support only), so every transition the sequence makes from NONE is observed.
  for (let i = 0; i < 4; i += 1) hs.push(await hypothesis(me, { supporting: [pick(selfPool), pick(selfPool)].filter((v, k, a) => a.indexOf(v) === k) }));
  for (let i = 0; i < 4; i += 1) hs.push(await hypothesis(me, { supporting: [pick(pool), pick(pool)].filter((v, k, a) => a.indexOf(v) === k), contradicting: random() < 0.3 ? [pick(pool)] : [] }));
  let startedNone = 0;
  for (const h of hs) if (await change(h) === 'NONE') startedNone += 1;
  assert.ok(startedNone >= 4, 'the property test starts with relied-on Hypotheses');
  const attributionSnapshot = async () => rows('SELECT memory_id, subject, basis FROM public.memory_subject_attributions WHERE user_id = $1 ORDER BY memory_id', [me]);
  let withheld = new Set();
  const nowExpressions = ['CURRENT_TIMESTAMP', "CURRENT_TIMESTAMP + interval '30 days'"];
  for (let step = 0; step < 40; step += 1) {
    const active = (await rows("SELECT id FROM public.memories WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY id", [me])).map((r) => r.id);
    const content = pick(facts);
    const op = pick(['REMEMBER', 'CORRECT', 'FORGET', 'DISABLE', 'CAPTURE', 'HOUSEKEEPING']);
    const attributionsBefore = await attributionSnapshot();
    if (op === 'REMEMBER') await finalize2({ session: s, user: me, turn: await userTurn(me, s), kind: 'REMEMBER', outcome: 'REMEMBERED', type: 'STABLE_PREFERENCE', content, subject: pick(['SELF', 'OTHER']) });
    else if (op === 'CORRECT' && active.length) await finalize2({ session: s, user: me, turn: await userTurn(me, s), kind: 'CORRECT', outcome: 'CORRECTED', target: pick(active), type: 'STABLE_PREFERENCE', content, subject: pick(['SELF', null]) });
    else if ((op === 'FORGET' || op === 'DISABLE') && active.length) await finalize2({ session: s, user: me, turn: await userTurn(me, s), kind: op, outcome: op === 'FORGET' ? 'FORGOTTEN' : 'DISABLED', target: pick(active) });
    else if (op === 'CAPTURE') await record((await execution(me, s)).turn, content);
    else await housekeep(me);
    const attributionsAfter = await attributionSnapshot();
    for (const before of attributionsBefore) assert.deepEqual(attributionsAfter.find((a) => a.memory_id === before.memory_id), before, `step ${step} (${op}): no attribution changes or disappears`);
    const now = new Set();
    for (const h of hs) {
      for (const at of nowExpressions) {
        const value = await change(h, { now: at });
        if (value !== 'NONE') now.add(`${h}@${at}`);
        else assert.ok(!withheld.has(`${h}@${at}`), `step ${step} (${op}): a withheld Hypothesis was lifted to NONE`);
      }
    }
    withheld = new Set([...withheld, ...now]);
    assert.deepEqual(await lineageViolations(me), [], `step ${step} (${op}): lineage`);
  }
  console.log(`  L-4: 40 random steps, ${hs.length} Hypotheses (${startedNone} relied on at the start) x 2 clocks; withheld at the end: ${withheld.size} of ${hs.length * 2}; no withheld -> NONE`);
}

// ------------------------------------------------------------------------------------------------------------------
// W-2 / W-4. Races on committed state across two connections.
// ------------------------------------------------------------------------------------------------------------------
async function waitUntilBlocked(pid) {
  for (let i = 0; i < 400; i += 1) {
    const row = await one('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (row?.wait_event_type === 'Lock') return;
    await new Promise((done) => setTimeout(done, 25));
  }
  throw new Error('the second transaction never blocked on the first');
}
async function race(first, second, { firstEnds = 'COMMIT' } = {}) {
  const a = new Client({ connectionString: databaseUrl });
  const b = new Client({ connectionString: databaseUrl });
  await a.connect();
  await b.connect();
  try {
    const [{ pid }] = (await b.query('SELECT pg_backend_pid() AS pid')).rows;
    await a.query('BEGIN');
    const firstValue = await first(a);
    await b.query('BEGIN');
    const pending = second(b).then((value) => ({ value }), (error) => ({ error }));
    await waitUntilBlocked(pid);
    await a.query(firstEnds);
    const secondValue = await pending;
    await b.query(secondValue.error ? 'ROLLBACK' : 'COMMIT');
    if (secondValue.error?.code === '40P01') throw new Error('a deadlock was detected');
    return [firstValue, secondValue];
  } finally {
    await a.end();
    await b.end();
  }
}
async function committed(work) {
  await client.query('BEGIN');
  try { const value = await work(); await client.query('COMMIT'); return value; } catch (error) { await client.query('ROLLBACK'); throw error; }
}
async function removeCommittedReader(userId) {
  await client.query('BEGIN');
  await client.query("SET LOCAL session_replication_role = 'replica'");
  const tables = await rows(`SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.column_name = 'user_id' AND t.table_type = 'BASE TABLE' ORDER BY 1`);
  await client.query(`DELETE FROM public.post_response_intelligence_effects WHERE execution_id IN (
    SELECT e.id FROM public.post_response_intelligence_executions e WHERE e.user_id = $1)`, [userId]);
  for (const { table_name: table } of tables) await client.query(`DELETE FROM public.${table} WHERE user_id = $1`, [userId]);
  await client.query('DELETE FROM public.runtime_event_outbox WHERE subject_user_id = $1', [userId]);
  await client.query('DELETE FROM public.users WHERE id = $1', [userId]);
  await client.query('DELETE FROM auth.users WHERE id = $1', [userId]);
  await client.query('COMMIT');
  const { residue } = await one(`SELECT (SELECT count(*) FROM public.memories WHERE user_id = $1)
    + (SELECT count(*) FROM public.memory_subject_attributions WHERE user_id = $1) + (SELECT count(*) FROM public.memory_equivalence_dispositions WHERE user_id = $1)
    + (SELECT count(*) FROM public.memory_control_commands WHERE user_id = $1) + (SELECT count(*) FROM public.hypotheses WHERE user_id = $1)
    + (SELECT count(*) FROM public.post_response_intelligence_effects f WHERE NOT EXISTS (SELECT 1 FROM public.post_response_intelligence_executions e WHERE e.id = f.execution_id))
    + (SELECT count(*) FROM public.users WHERE id = $1) + (SELECT count(*) FROM auth.users WHERE id = $1) AS residue`, [userId]);
  assert.equal(Number(residue), 0, 'the committed fixtures are gone');
}
/** Reservation fixtures for the bind-guard probe (verify-0151's shape): a SELF-supported questioning target with its open gap. */
async function gapFor(userId, hypothesisId, on = client) {
  const evaluationId = randomUUID();
  const executionId = randomUUID();
  await on.query(`INSERT INTO public.confidence_evaluations (id, user_id, target_id, target_type, target_version, version, lifecycle_state, numeric_score, confidence_band,
      calibration_state, stability, supporting_evidence_ids, contradicting_evidence_ids, assumptions, alternative_hypothesis_ids, missing_information_codes, policy_version, provenance)
    VALUES ($1, $2, $3, 'HYPOTHESIS', 1, 1, 'EVALUATED', NULL, NULL, 'UNCALIBRATED', 'UNASSESSED', '{}', '{}', '{}', '{}',
      ARRAY['UNVERIFIED_ASSUMPTIONS', 'CONFIDENCE_MODEL_UNCALIBRATED'], 'confidence-foundation-v1', 'QANDEEL_CONFIDENCE_RUNTIME')`, [evaluationId, userId, hypothesisId]);
  await on.query(`INSERT INTO public.post_response_intelligence_executions (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path,
      safety_disposition, state, current_stage, outcome_code, terminal_at) VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', 'RUNNING', 'VERIFIER_0152', NULL, NULL)`,
  [executionId, randomUUID(), userId, randomUUID(), randomUUID()]);
  await on.query(`INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state, completed_at, result_code, result_payload)
    VALUES ($1, 'CONFIDENCE_BATCH', 'COMPLETED', CURRENT_TIMESTAMP, 'CONFIDENCE_BATCH_EVALUATED', $2)`,
  [executionId, JSON.stringify([{ ordinal: 1, hypothesisId, targetVersion: 1, confidenceEvaluationId: evaluationId }])]);
  await asServer(() => on.query('SELECT public.sync_post_response_information_gaps_v1($1)', [executionId]), on);
}
const reservation = (userId) => committed(async () => {
  const s = await session(userId);
  const support = await memory(userId, { subject: 'SELF', content: `bind probe ${randomUUID().slice(0, 8)}` });
  const h = await hypothesis(userId, { supporting: [support], scope: `CONVERSATION_SESSION:${s}` });
  await gapFor(userId, h);
  const turn = await userTurn(userId, s);
  const selected = await asServer(() => one('SELECT * FROM public.select_formal_question_opportunity_v1($1, $2, $3)', [userId, s, turn]));
  assert.equal(selected.outcome, 'SELECTED');
  return { session: s, turn, binding: selected.binding_id, support, forgetTurn: await userTurn(userId, s) };
});
const bind = (userId, r, on) => asServer(() => rows('SELECT * FROM public.finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
  [r.session, userId, r.turn, randomUUID(), 'verifier-0152 reply', 'ALLOW', randomUUID(), null, null, r.binding], on), on);

async function verifyRaces() {
  const me = randomUUID();
  try {
    await committed(() => client.query('INSERT INTO auth.users (id) VALUES ($1)', [me]));
    const s = await committed(() => session(me));
    const generatingTurn = () => committed(() => userTurn(me, s));
    const capture = (content) => committed(() => execution(me, s, { content }));

    stage = 'W-2: REMEMBER X racing a background capture of X - the capture waits, then finds it (EQUIVALENT_EXISTS)';
    let t = await generatingTurn();
    let e = await capture('أنا بحب الموز');
    const [remembered, captured] = await race(
      (on) => finalize2({ session: s, user: me, turn: t, kind: 'REMEMBER', outcome: 'REMEMBERED', type: 'STABLE_PREFERENCE', content: 'أنا بحب الموز.', subject: 'SELF' }, on),
      (on) => record(e.turn, 'أنا بحب الموز.', { on }));
    assert.equal(remembered[0].outcome, 'REMEMBERED');
    assert.equal(captured.value.outcome, 'EQUIVALENT_EXISTS');

    stage = 'W-2: a background capture of X racing REMEMBER X - the command waits, then answers ALREADY_REMEMBERED';
    t = await generatingTurn();
    e = await capture('أنا بحب المانجا');
    const [created, already] = await race((on) => record(e.turn, 'أنا بحب المانجا.', { on }),
      (on) => finalize2({ session: s, user: me, turn: t, kind: 'REMEMBER', outcome: 'REMEMBERED', type: 'STABLE_PREFERENCE', content: 'أنا بحب المانجا.', subject: 'SELF' }, on));
    assert.equal(created.outcome, 'CREATED');
    assert.equal(already.value[0].outcome, 'ALREADY_REMEMBERED');

    stage = 'W-2: CORRECT A -> X racing a capture of X, both orders - one ACTIVE X';
    let a = await committed(() => memory(me, { type: 'STABLE_PREFERENCE', content: 'أنا بحب التفاح.', subject: 'SELF' }));
    t = await generatingTurn();
    e = await capture('أنا بحب الكمثرى');
    const [correctedFirst, captureAfter] = await race(
      (on) => finalize2({ session: s, user: me, turn: t, kind: 'CORRECT', outcome: 'CORRECTED', target: a, type: 'STABLE_PREFERENCE', content: 'أنا بحب الكمثرى.', subject: 'SELF' }, on),
      (on) => record(e.turn, 'أنا بحب الكمثرى.', { on }));
    assert.deepEqual([correctedFirst[0].outcome, captureAfter.value.outcome], ['CORRECTED', 'EQUIVALENT_EXISTS']);
    a = await committed(() => memory(me, { type: 'STABLE_PREFERENCE', content: 'أنا بحب البرتقال.', subject: 'SELF' }));
    t = await generatingTurn();
    e = await capture('أنا بحب الليمون');
    const [captureFirst, correctedAfter] = await race((on) => record(e.turn, 'أنا بحب الليمون.', { on }),
      (on) => finalize2({ session: s, user: me, turn: t, kind: 'CORRECT', outcome: 'CORRECTED', target: a, type: 'STABLE_PREFERENCE', content: 'أنا بحب الليمون.', subject: 'SELF' }, on));
    assert.deepEqual([captureFirst.outcome, correctedAfter.value[0].outcome], ['CREATED', 'CORRECTED_TO_EXISTING']);
    for (const fruit of ['أنا بحب الموز.', 'أنا بحب المانجا.', 'أنا بحب الكمثرى.', 'أنا بحب الليمون.']) {
      assert.equal(await count("SELECT count(*) AS n FROM public.memories WHERE user_id = $1 AND status = 'ACTIVE' AND content = $2", [me, fruit]), 1, `exactly one ACTIVE ${fruit}`);
    }

    stage = 'W-2 / T-C4-3: two sessions of one owner remember the same fact - exactly one ACTIVE copy';
    const s2 = await committed(() => session(me));
    const t1 = await generatingTurn();
    const t2 = await committed(() => userTurn(me, s2));
    const [first, second] = await race(
      (on) => finalize2({ session: s, user: me, turn: t1, kind: 'REMEMBER', outcome: 'REMEMBERED', type: 'STABLE_PREFERENCE', content: 'أنا بحب العسل.', subject: 'SELF' }, on),
      (on) => finalize2({ session: s2, user: me, turn: t2, kind: 'REMEMBER', outcome: 'REMEMBERED', type: 'STABLE_PREFERENCE', content: 'أنا بحب العسل', subject: 'SELF' }, on));
    assert.deepEqual([first[0].outcome, second.value[0].outcome], ['REMEMBERED', 'ALREADY_REMEMBERED']);
    assert.equal(await count("SELECT count(*) AS n FROM public.memories WHERE user_id = $1 AND status = 'ACTIVE' AND content LIKE 'أنا بحب العسل%'", [me]), 1);

    stage = 'W-4: v2 FORGET against the 0151 bind guard over the same Memory, both orders, repeated - no 40P01';
    for (let i = 0; i < 3; i += 1) {
      const r1 = await reservation(me);
      const [forgot, bound] = await race(
        (on) => finalize2({ session: r1.session, user: me, turn: r1.forgetTurn, kind: 'FORGET', outcome: 'FORGOTTEN', target: r1.support }, on),
        (on) => bind(me, r1, on));
      assert.equal(forgot[0].outcome, 'FORGOTTEN');
      assert.equal(bound.error?.code, '42501', 'the waiting bind fails closed on the forgotten support');
      const r2 = await reservation(me);
      const [boundFirst, forgotAfter] = await race((on) => bind(me, r2, on),
        (on) => finalize2({ session: r2.session, user: me, turn: r2.forgetTurn, kind: 'FORGET', outcome: 'FORGOTTEN', target: r2.support }, on));
      assert.equal(boundFirst.length, 1, 'the bind committed first');
      assert.equal(forgotAfter.value[0].outcome, 'FORGOTTEN', 'the forget waited, then committed');
    }
  } finally {
    stage = 'races: fixture removal';
    await removeCommittedReader(me);
  }
}

// ------------------------------------------------------------------------------------------------------------------
// Erasure: the new records leave with the account and the erasure is not BLOCKED (rolled back).
// ------------------------------------------------------------------------------------------------------------------
async function verifyErasure() {
  stage = 'erasure: the governed erasure removes attributions and dispositions with their Memories, and is not BLOCKED';
  const alice = await reader();
  const bob = await reader();
  for (const userId of [alice, bob]) {
    const s = await session(userId);
    const fact = await memory(userId, { type: 'STABLE_PREFERENCE', content: 'أنا بحب الخوخ.', subject: 'SELF' });
    await memory(userId, { type: 'STABLE_PREFERENCE', content: 'أنا بحب الخوخ' });
    await finalize2({ session: s, user: userId, turn: await userTurn(userId, s), kind: 'FORGET', outcome: 'FORGOTTEN', target: fact });
  }
  const footprint = async (userId) => [await count('SELECT count(*) AS n FROM public.memory_subject_attributions WHERE user_id = $1', [userId]),
    await count('SELECT count(*) AS n FROM public.memory_equivalence_dispositions WHERE user_id = $1', [userId])];
  assert.deepEqual([await footprint(alice), await footprint(bob)], [[1, 1], [1, 1]], 'the fixture populates both records');
  await actAs('authenticated', alice, client, { amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - 1 }] });
  assert.equal((await one('SELECT * FROM public.request_own_account_deletion_v1($1)', [randomUUID()])).outcome, 'ACCEPTED');
  await asOwner();
  await client.query(`UPDATE personal_data_private.account_deletions SET requested_at = clock_timestamp() - interval '8 days', final_at = clock_timestamp() - interval '1 day'
    WHERE user_id = $1 AND status = 'SCHEDULED'`, [alice]);
  const { id: deletionId } = await one("SELECT id FROM personal_data_private.account_deletions WHERE user_id = $1 AND status <> 'CANCELLED'", [alice]);
  await asServer(() => rows('SELECT * FROM public.server_claim_due_account_deletions_v1(20)'));
  assert.equal((await asServer(() => one('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId]))).outcome, 'ERASED');
  assert.deepEqual([await footprint(alice), await footprint(bob)], [[0, 0], [1, 1]], 'zero rows of the account remain; another reader is untouched');
}

async function main() {
  try {
    await client.connect();
    await verifyCatalog();
    await verifyKeyParity();
    await verifyLegacyAttribution();
    for (const step of [verifyEvidenceProtection, verifySubjectLifecycle, verifyDuplicates, verifySubjectIsolation, verifyCorrectionSubject, verifyBackgroundWriter, verifyFailureInjection, verifyIsolation, verifyMonotonicity, verifyErasure]) {
      await client.query('BEGIN');
      try { await step(); } finally { await client.query('ROLLBACK'); }
    }
    await verifyRaces();
    console.log('Verified migration 0152 Memory Subject Identity, Atomicity & Evidence Protection: append-only subject attribution created only with its Memory, the legacy attribution by provenance alone, SELF-only personal Evidence with permanent subject taints, the subject question and its answers, one ACTIVE equivalent per owner and subject with auditable dispositions and lineage, a fact about someone else never retired by words that match one about the user, no correction resolved into another subject by inference, no background write for a command turn (R2) or a fact a later command withdrew, refusal of unsupported generated candidates, writers limited to v2, the background writer and the governed erasure, atomic under injected failures, isolated per owner, monotonic under random sequences, and race-safe without deadlock.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Migration 0152 verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
