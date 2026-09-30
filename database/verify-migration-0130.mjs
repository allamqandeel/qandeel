// W3-MEGA-S — Personal Controls & Settings Integration v1: the real-PostgreSQL verifier for migration 0130
// (E2E-D-16 Export My Data; the PERSONAL-WORLD part of E2E-D-17 Delete Account).
//
// It proves, against a fully migrated database:
//   1. the catalog: the private schema and its four tables (RLS on, no client or server-role table privilege), every
//      function's DEFINER / INVOKER posture and empty search_path, the EXACT execute grants (owner acts: authenticated
//      only; server passes: service_role only), no account parameter on any owner act, the retired-identifier trigger
//      on public.users, and the sixteen narrowed history guards still SECURITY INVOKER with their original refusals;
//   2. the narrowness of the erasure boundary: every guard still refuses a DELETE by the table owner, with the
//      transaction-bound setting forged but no authorization row, and with an authorization row but no setting;
//   3. Export: re-authentication demanded by the database; owner-only request / read; one export in flight; replay;
//      the server-only asynchronous preparation; the package's content (Personal conversation both sides but no failed
//      or system reply, every Memory state labelled, Understanding statements with the owner's own disagreement, the
//      account) and what it never carries (internal ids, idempotency keys, another reader's material, hypothesis
//      reasoning); the "not yet included" Connected Worlds notice; expiry refusing the download and discarding the
//      artifact; a fresh request after expiry;
//   4. Delete Account (Personal world): re-authentication; scheduling with a grace period; replay; cancellation,
//      including that a cancelled command never re-schedules; not due before the grace period; not cancellable after
//      it; the server-only claim and erasure; a REAL populated Personal footprint (committed conversation units, a
//      Memory-control record, Memory in several states, a Hypothesis with a real disagreement, a HIM target) erased
//      to zero rows in every table carrying the account — while another reader's footprint is untouched; the account
//      row gone and the request kept as the minimal record; idempotent retry and completion; retired Login ID and
//      Public ID refused through the existing UNAVAILABLE answers and the availability check; an erased account can
//      never be re-created;
//   5. the Connected Worlds HARD STOP: an account that a Connected Worlds row still references is BLOCKED — nothing of
//      it is erased — and the owner may cancel it;
//   6. concurrency on committed state across two connections whose second attempt is shown to block: a cancellation
//      racing the erasure is refused once the erasure committed, and two erasures of one request erase once.
// Every fixture is rolled back or removed, and the removal is checked.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = [], on = client) => (await on.query(text, values)).rows;
const one = async (text, values = [], on = client) => (await rows(text, values, on))[0];
const count = async (text, values = [], on = client) => Number((await one(text, values, on)).n);

/** Expect `operation` to be refused with one of `codes`. Must run inside an open transaction. */
async function rejected(operation, codes, on = client) {
  let refusal;
  await on.query('SAVEPOINT expected_refusal');
  try {
    await operation();
  } catch (error) {
    refusal = error;
  } finally {
    await on.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await on.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code} (${refusal.message})`);
  return refusal;
}

/** A provider password authentication `ageSeconds` ago, exactly as the token's `amr` claim carries it. */
const passwordProof = (ageSeconds = 1) => [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - ageSeconds }];

async function actAs(role, userId = null, { amr } = {}, on = client) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  const claims = userId ? { sub: userId, role, ...(amr ? { amr } : {}) } : {};
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
}

async function asOwner(on = client) {
  await on.query('RESET ROLE');
  await on.query("SELECT set_config('request.jwt.claims', '{}', true)");
}

const digest = (kind, value) => `${kind}:${createHash('sha256').update(value.toLowerCase(), 'utf8').digest('hex')}`;

// ------------------------------------------------------------------------------------------------------
// Fixtures.
// ------------------------------------------------------------------------------------------------------

const ROUTE = ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'];
const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];

/** A reader with a sign-up identity. */
async function reader(loginId, on = client) {
  const id = randomUUID();
  await on.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  await on.query('UPDATE public.users SET name = $2, login_id = $3 WHERE id = $1', [id, `Reader ${loginId}`, loginId]);
  return id;
}

async function session(userId, on = client) {
  const id = randomUUID();
  await on.query("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, userId]);
  return id;
}

/** One real exchange through the canonical turn pipeline, then one committed conversational unit of the user turn. */
async function exchange(userId, sessionId, content, reply) {
  await actAs('authenticated', userId);
  const userTurn = randomUUID();
  await rows('SELECT * FROM public.create_user_conversation_turn($1,$2,$3,$4)', [userTurn, sessionId, content, null]);
  await actAs('service_role');
  await rows('SELECT * FROM public.claim_conversation_turn($1,$2,$3,$4,$5)', [sessionId, userId, userTurn, ...ROUTE]);
  const assistantTurn = randomUUID();
  const finalized = await rows('SELECT * FROM public.finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [sessionId, userId, userTurn, assistantTurn, reply, 'ALLOW', randomUUID(), null, null, null]);
  assert.equal(finalized.length, 1, 'fixture exchange finalized');
  const units = [{ unit_id: randomUUID(), span_start: 0, span_end: Array.from(content).length }];
  await rows('SELECT * FROM public.commit_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)',
    [sessionId, userId, userTurn, randomUUID(), JSON.stringify(units), ...PROVENANCE]);
  await asOwner();
  return { userTurn, assistantTurn };
}

async function memory(userId, content, status = 'ACTIVE') {
  const id = randomUUID();
  await client.query(
    `INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status)
     VALUES ($1, $2, 'PERSONAL_FACT', $3, 'USER_STATED', 0.95, 0.65, $4)`,
    [id, userId, content, status],
  );
  return id;
}

/** A plain user turn (not yet answered), for a Memory-control command to finalize. */
async function pendingTurn(userId, sessionId, content) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason)
     VALUES ($1, $2, $3, 'USER', 'GENERATING', $4, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT')`,
    [id, sessionId, userId, content],
  );
  return id;
}

async function rememberCommand(userId, sessionId, turnId, content) {
  await actAs('service_role');
  const answer = await rows('SELECT * FROM public.server_finalize_memory_control_turn_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)', [
    sessionId, userId, turnId, randomUUID(), 'REMEMBER', 'REMEMBERED', null, randomUUID(), 'PERSONAL_FACT', content,
    0.98, 0.65, null, [], null, 'Got it.', null, randomUUID(), null, null,
  ]);
  await asOwner();
  assert.equal(answer[0]?.outcome, 'REMEMBERED', 'fixture Memory command committed');
}

/** A Hypothesis moved to ACTIVE through the canonical core, then disagreed with through the real command. */
async function contestedUnderstanding(userId, statement) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, assumptions)
     VALUES ($1, $2, $3, 'BEHAVIORAL', 'WORK', 'verifier scope', 'SYSTEM_GENERATED', ARRAY['An internal assumption.'])`,
    [id, userId, statement],
  );
  await client.query('SELECT 1 FROM public.transition_hypothesis_core_v1($1, $2, $3, $4, $5)', [userId, id, 1, 'ACTIVE', 'AUTHENTICATED_TRANSITION']);
  await actAs('authenticated', userId);
  await rows('SELECT * FROM public.record_understanding_disagreement_v1($1, $2, $3)', [randomUUID(), id, 2]);
  await asOwner();
  return id;
}

async function himTarget(userId) {
  await actAs('authenticated', userId);
  await rows("SELECT * FROM public.create_him_motivation_measurement_target('GOAL', 'verifier goal')");
  await asOwner();
}

/** A full Personal footprint. */
async function populated(loginId, words) {
  const user = await reader(loginId);
  const s = await session(user);
  await exchange(user, s, `${words} first message`, `${words} first reply`);
  await exchange(user, s, `${words} second message`, `${words} second reply`);
  // A reply that failed stays out of the export; the user turn that asked stays in.
  await client.query(
    `INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
     VALUES ($1, $2, $3, 'ASSISTANT', 'FAILED', $4)`, [randomUUID(), s, user, `${words} failed reply`]);
  await client.query(
    `INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
     VALUES ($1, $2, $3, 'SYSTEM', 'COMPLETED', $4)`, [randomUUID(), s, user, `${words} system text`]);
  await rememberCommand(user, s, await pendingTurn(user, s, `${words} remember this`), `${words} remembered fact`);
  await memory(user, `${words} disabled fact`, 'DISABLED');
  await memory(user, `${words} forgotten fact`, 'DELETED');
  const hypothesis = await contestedUnderstanding(user, `${words} prepare early for deadlines.`);
  await himTarget(user);
  return { user, session: s, hypothesis };
}

/** Every table (in every QANDEEL schema) that carries an account column, with the account's row count in it. */
async function footprint(userId) {
  const columns = await rows(`SELECT c.table_schema, c.table_name, c.column_name FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE t.table_type = 'BASE TABLE' AND c.table_schema NOT IN ('pg_catalog', 'information_schema', 'auth')
       AND c.data_type = 'uuid'
       AND c.column_name IN ('user_id', 'subject_user_id', 'owner_user_id', 'author_user_id', 'actor_user_id', 'grantor_user_id',
                             'personal_owner_user_id', 'created_by_user_id', 'controller_user_id', 'publisher_user_id')
     ORDER BY 1, 2, 3`);
  const out = {};
  // The deletion request itself is the one row kept by design (the minimal record); it is asserted on its own.
  for (const c of columns.filter((col) => `${col.table_schema}.${col.table_name}` !== 'personal_data_private.account_deletions')) {
    const n = await count(`SELECT count(*) AS n FROM ${c.table_schema}.${c.table_name} WHERE ${c.column_name} = $1`, [userId]);
    if (n > 0) out[`${c.table_schema}.${c.table_name}.${c.column_name}`] = n;
  }
  out['public.users.id'] = await count('SELECT count(*) AS n FROM public.users WHERE id = $1', [userId]);
  return out;
}

// ------------------------------------------------------------------------------------------------------
// 1. Catalog.
// ------------------------------------------------------------------------------------------------------

const OWNER_ACTS = ['read_own_privacy_state_v1()', 'request_own_data_export_v1(uuid)', 'read_own_data_export_v1()',
  'request_own_account_deletion_v1(uuid)', 'cancel_own_account_deletion_v1()'];
const SERVER_PASSES = [['server_prepare_data_exports_v1(integer)', 'prepare_data_exports_v1(integer)'],
  ['server_claim_due_account_deletions_v1(integer)', 'claim_due_account_deletions_v1(integer)'],
  ['server_erase_personal_account_v1(uuid)', 'erase_personal_account_v1(uuid)'],
  ['server_complete_account_deletion_v1(uuid)', 'complete_account_deletion_v1(uuid)']];
const GUARDS = ['reject_him_runtime_mutation', 'reject_him_energy_immutable_mutation', 'guard_him_session_context_binding_mutation',
  'guard_information_gap_lifecycle_mutation', 'guard_formal_question_turn_binding_mutation', 'reject_committed_conversational_unit_mutation_v1',
  'reject_conversation_unit_commit_event_mutation_v1', 'reject_conversation_focus_semantic_mutation_v1', 'reject_conversation_thread_mutation_v1',
  'guard_conversation_world_thread_identity_clock_v1', 'reject_conversation_thread_lifecycle_mutation_v1', 'reject_conversation_live_focus_mutation_v1',
  'guard_historical_world_semantic_clock_v1', 'guard_thread_reading_binding_mutation_v1', 'reject_historical_projection_mutation_v1',
  'guard_historical_canonical_row_preservation_v1'];

const may = async (role, signature) => (await one("SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok", [role, signature])).ok;

async function verifyCatalog() {
  stage = 'catalog: the private schema and its tables';
  const tables = await rows(`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'personal_data_private' AND c.relkind = 'r' ORDER BY 1`);
  assert.deepEqual(tables.map((t) => t.relname), ['account_deletions', 'data_exports', 'erasure_authorizations', 'retired_account_identifiers']);
  assert.ok(tables.every((t) => t.relrowsecurity), 'row-level security on every private table');
  for (const role of ['anon', 'authenticated', 'service_role', 'public']) {
    for (const { relname } of tables) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, `personal_data_private.${relname}`, privilege]);
        assert.equal(allowed, false, `${role} holds no ${privilege} on ${relname}`);
      }
    }
  }
  const usage = await rows(`SELECT r AS role, has_schema_privilege(r, 'personal_data_private', 'USAGE') AS usage,
      has_schema_privilege(r, 'personal_data_private', 'CREATE') AS "create" FROM unnest(ARRAY['anon', 'authenticated', 'public', 'service_role']) r ORDER BY r`);
  assert.deepEqual(usage, [
    { role: 'anon', usage: false, create: false }, { role: 'authenticated', usage: true, create: false },
    { role: 'public', usage: false, create: false }, { role: 'service_role', usage: true, create: false },
  ]);
  const [{ exposed }] = await rows(`SELECT count(*)::int AS exposed FROM pg_db_role_setting s, unnest(s.setconfig) c
    WHERE c ~ '^pgrst\\.db_schemas=' AND c ~ 'personal_data_private'`);
  assert.equal(exposed, 0, 'no Data API configuration exposes the private schema');
  const columns = await rows(`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'personal_data_private' AND table_name = 'retired_account_identifiers' ORDER BY ordinal_position`);
  assert.deepEqual(columns.map((c) => c.column_name), ['digest', 'retired_at'], 'a retired identifier is a digest and a time: no account link');
  const deletionFks = await rows(`SELECT conname FROM pg_constraint WHERE conrelid = 'personal_data_private.account_deletions'::regclass AND contype = 'f'`);
  assert.deepEqual(deletionFks, [], 'the deletion record outlives the account: no foreign key to it');

  stage = 'catalog: function posture and exact grants';
  const fns = await rows(`SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig,
      p.prosecdef, p.proconfig::text[] AS config, pg_get_userbyid(p.proowner) AS owner
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'personal_data_private'
        OR (n.nspname = 'public' AND p.proname IN ('read_own_privacy_state_v1', 'request_own_data_export_v1', 'read_own_data_export_v1',
            'request_own_account_deletion_v1', 'cancel_own_account_deletion_v1', 'server_prepare_data_exports_v1',
            'server_claim_due_account_deletions_v1', 'server_erase_personal_account_v1', 'server_complete_account_deletion_v1'))
     ORDER BY 1`);
  for (const fn of fns) {
    assert.deepEqual(fn.config, ['search_path=""'], `${fn.sig} pins an empty search_path`);
    assert.equal(fn.owner, 'postgres', `${fn.sig} is postgres-owned`);
    assert.doesNotMatch(fn.sig, /\(p_(user|account|actor|owner)/u, `${fn.sig} takes no account parameter`);
    if (fn.sig.startsWith('public.')) assert.equal(fn.prosecdef, false, `${fn.sig} is SECURITY INVOKER`);
  }
  for (const act of OWNER_ACTS) {
    for (const schema of ['public', 'personal_data_private']) {
      const sig = `${schema}.${act}`;
      assert.equal(await may('authenticated', sig), true, `authenticated executes ${sig}`);
      for (const role of ['anon', 'service_role', 'public']) assert.equal(await may(role, sig), false, `${role} must not execute ${sig}`);
    }
  }
  for (const [wrapper, inner] of SERVER_PASSES) {
    for (const sig of [`public.${wrapper}`, `personal_data_private.${inner}`]) {
      assert.equal(await may('service_role', sig), true, `service_role executes ${sig}`);
      for (const role of ['anon', 'authenticated', 'public']) assert.equal(await may(role, sig), false, `${role} must not execute ${sig}`);
    }
  }
  const executable = await rows(`SELECT r.rolname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT 'anon' AS rolname UNION ALL SELECT 'authenticated' UNION ALL SELECT 'service_role' UNION ALL SELECT 'public') r
    WHERE n.nspname = 'personal_data_private' AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`);
  assert.deepEqual(executable.map((e) => `${e.rolname}:${e.proname}`), [
    'authenticated:cancel_own_account_deletion_v1', 'authenticated:read_own_data_export_v1', 'authenticated:read_own_privacy_state_v1',
    'authenticated:request_own_account_deletion_v1', 'authenticated:request_own_data_export_v1',
    'service_role:claim_due_account_deletions_v1', 'service_role:complete_account_deletion_v1', 'service_role:erase_personal_account_v1',
    'service_role:prepare_data_exports_v1',
  ], 'the whole private schema: nothing else is executable by any client or server role');

  stage = 'catalog: the retired-identifier trigger and the narrowed guards';
  const [trigger] = await rows(`SELECT pg_get_triggerdef(t.oid) AS def, n.nspname || '.' || p.proname AS fn, p.prosecdef
      FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE t.tgrelid = 'public.users'::regclass AND t.tgname = 'refuse_retired_account_identifier'`);
  assert.match(trigger.def, /BEFORE INSERT OR UPDATE OF login_id, public_id ON public\.users FOR EACH ROW/u);
  assert.equal(trigger.fn, 'personal_data_private.refuse_retired_account_identifier_v1');
  for (const guard of GUARDS) {
    const [g] = await rows(`SELECT p.prosecdef, p.proconfig::text[] AS config, pg_get_userbyid(p.proowner) AS owner, p.prosrc
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = $1`, [guard]);
    assert.ok(g, `${guard} exists`);
    assert.equal(g.prosecdef, false, `${guard} is still a pure (INVOKER) guard`);
    assert.equal(g.owner, 'postgres');
    assert.deepEqual(g.config, ['search_path=""']);
    assert.match(g.prosrc, /current_setting\('qandeel\.personal_erasure', true\) = pg_catalog\.txid_current\(\)::text/u, `${guard} is narrowed by the transaction`);
    assert.match(g.prosrc, /personal_data_private\.personal_erasure_authorized_v1\(\)/u, `${guard} also demands the authorization row`);
    assert.match(g.prosrc, /RAISE EXCEPTION/u, `${guard} still refuses everything else`);
    for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await may(role, `public.${guard}()`), false, `${role} cannot execute ${guard}`);
  }
  const setters = await rows(`SELECT n.nspname || '.' || p.proname AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.prosrc ~ 'set_config\\(''qandeel\\.personal_erasure''' ORDER BY 1`);
  assert.deepEqual(setters.map((s) => s.fn), ['personal_data_private.erase_personal_account_v1'], 'only the erasure opens the boundary');
  const writers = await rows(`SELECT n.nspname || '.' || p.proname AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.prosrc ~* 'INSERT\\s+INTO\\s+personal_data_private\\.erasure_authorizations' ORDER BY 1`);
  assert.deepEqual(writers.map((s) => s.fn), ['personal_data_private.erase_personal_account_v1'], 'only the erasure writes the authorization');
}

// ------------------------------------------------------------------------------------------------------
// 2. The boundary stays closed to everything but the governed erasure.
// ------------------------------------------------------------------------------------------------------

async function verifyBoundary(fixture) {
  stage = 'boundary: the owner still cannot delete history, even with the setting forged or the row planted';
  const probes = [
    ['public.memories', 'user_id'], ['public.conversation_units', 'user_id'], ['public.historical_material_events', 'user_id'],
    ['public.hypotheses', 'user_id'], ['public.him_measurement_targets', 'user_id'],
  ];
  for (const [table, column] of probes) {
    assert.ok(await count(`SELECT count(*) AS n FROM ${table} WHERE ${column} = $1`, [fixture.user]) > 0, `${table} holds fixture rows`);
    await rejected(() => client.query(`DELETE FROM ${table} WHERE ${column} = $1`, [fixture.user]), ['55000']);
    await rejected(async () => {
      await client.query("SELECT set_config('qandeel.personal_erasure', txid_current()::text, true)");
      await client.query(`DELETE FROM ${table} WHERE ${column} = $1`, [fixture.user]);
    }, ['55000']);
    await rejected(async () => {
      await client.query('INSERT INTO personal_data_private.erasure_authorizations (transaction_id, deletion_id) VALUES (txid_current(), $1)', [randomUUID()]);
      await client.query(`DELETE FROM ${table} WHERE ${column} = $1`, [fixture.user]);
    }, ['55000']);
  }
  stage = 'boundary: an UPDATE is never admitted, even inside a forged erasure';
  await rejected(async () => {
    await client.query("SELECT set_config('qandeel.personal_erasure', txid_current()::text, true)");
    await client.query('INSERT INTO personal_data_private.erasure_authorizations (transaction_id, deletion_id) VALUES (txid_current(), $1)', [randomUUID()]);
    await client.query("UPDATE public.memories SET content = 'rewritten' WHERE user_id = $1", [fixture.user]);
  }, ['55000']);
}

// ------------------------------------------------------------------------------------------------------
// 3. Export.
// ------------------------------------------------------------------------------------------------------

const requestExport = async (userId, commandId, amr = passwordProof()) => {
  await actAs('authenticated', userId, { amr });
  const answer = await one('SELECT * FROM public.request_own_data_export_v1($1)', [commandId]);
  await asOwner();
  return answer;
};
const readExport = async (userId) => {
  await actAs('authenticated', userId);
  const answer = await one('SELECT * FROM public.read_own_data_export_v1()');
  await asOwner();
  return answer;
};
const stateOf = async (userId) => {
  await actAs('authenticated', userId);
  const answer = await one('SELECT * FROM public.read_own_privacy_state_v1()');
  await asOwner();
  return answer;
};
const prepare = async () => {
  await actAs('service_role');
  const [{ prepared }] = await rows('SELECT public.server_prepare_data_exports_v1(20) AS prepared');
  await asOwner();
  return prepared;
};

async function verifyExport(alice, bob) {
  stage = 'export: re-authentication is demanded by the database';
  for (const amr of [undefined, passwordProof(90), passwordProof(5).map((a) => ({ ...a, method: 'otp' }))]) {
    await actAs('authenticated', alice.user, { amr });
    await rejected(() => client.query('SELECT * FROM public.request_own_data_export_v1($1)', [randomUUID()]), ['42501']);
    await asOwner();
  }
  assert.equal(await count('SELECT count(*) AS n FROM personal_data_private.data_exports WHERE user_id = $1', [alice.user]), 0, 'nothing was written');
  assert.deepEqual(await stateOf(alice.user), { export_status: 'NONE', export_available_until: null, deletion_status: 'NONE', deletion_final_at: null });

  stage = 'export: request, replay, one in flight';
  const command = randomUUID();
  assert.deepEqual(await requestExport(alice.user, command), { outcome: 'ACCEPTED', export_status: 'PREPARING', available_until: null });
  assert.deepEqual(await requestExport(alice.user, command), { outcome: 'ACCEPTED', export_status: 'PREPARING', available_until: null }, 'a replay answers the same request');
  assert.equal((await requestExport(alice.user, randomUUID())).export_status, 'PREPARING', 'a second command joins the one in flight');
  assert.equal(await count('SELECT count(*) AS n FROM personal_data_private.data_exports WHERE user_id = $1', [alice.user]), 1);
  assert.deepEqual(await readExport(alice.user), { export_status: 'PREPARING', available_until: null, content: null }, 'nothing downloadable while preparing');
  assert.equal((await stateOf(alice.user)).export_status, 'PREPARING');

  stage = 'export: preparation is the server\'s alone';
  await actAs('authenticated', alice.user);
  await rejected(() => client.query('SELECT public.server_prepare_data_exports_v1(20)'), ['42501']);
  await rejected(() => client.query('SELECT personal_data_private.build_personal_export_v1($1)', [alice.user]), ['42501']);
  await asOwner();
  assert.ok(await prepare() >= 1, 'the preparation pass prepared the package');
  const ready = await readExport(alice.user);
  assert.equal(ready.export_status, 'READY');
  const days = (new Date(ready.available_until) - Date.now()) / 86_400_000;
  assert.ok(days > 6.9 && days <= 7, 'available for a limited period (7 days)');
  assert.deepEqual(await readExport(bob.user), { export_status: 'NONE', available_until: null, content: null }, 'another reader sees nothing');

  stage = 'export: the package holds the Personal world, readably, and nothing it must not';
  const pkg = ready.content;
  assert.equal(pkg.format, 'qandeel.personal-data-export.v1');
  assert.equal(pkg.account.loginId, 'alice.erase');
  assert.equal(pkg.account.name, 'Reader alice.erase');
  assert.match(pkg.account.publicId, /^[a-z]+[0-9]{2,4}$/u);
  // Every fixture row of this transaction shares one CURRENT_TIMESTAMP, so the order is compared as a set here; the
  // package's order is its own (created_at, then id).
  const turns = pkg.conversations.flatMap((c) => c.turns);
  assert.deepEqual(turns.map((t) => `${t.speaker}: ${t.text}`).sort(), [
    'you: alice first message', 'qandeel: alice first reply', 'you: alice second message', 'qandeel: alice second reply',
    'you: alice remember this', 'qandeel: Got it.',
  ].sort(), 'both sides of the Personal conversation');
  assert.ok(!turns.some((t) => /failed reply|system text/u.test(t.text)), 'no failed and no system reply');
  const memory = Object.fromEntries(pkg.memory.map((m) => [m.text, m.state]));
  assert.equal(memory['alice remembered fact'], 'active');
  assert.equal(memory['alice disabled fact'], 'not relied on');
  assert.equal(memory['alice forgotten fact'], 'forgotten', 'a forgotten Memory still held is exported, labelled');
  const [understanding] = pkg.understanding;
  assert.equal(understanding.statement, 'alice prepare early for deadlines.');
  assert.equal(understanding.yourDisagreements.length, 1, 'the owner\'s own disagreement');
  assert.deepEqual(pkg.notYetIncluded, ['shared', 'public', 'replay', 'introductions']);
  const text = JSON.stringify(pkg);
  assert.doesNotMatch(text, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/u, 'no internal identifier of any kind');
  assert.doesNotMatch(text, /"(?:id|userId|sessionId|idempotencyKey|confidence|importance|source|assumptions|supporting|routing)"/u);
  assert.doesNotMatch(text, /An internal assumption|bob /u, 'no hypothesis reasoning and no other reader\'s material');

  stage = 'export: expiry refuses the download and discards the artifact';
  await client.query("UPDATE personal_data_private.data_exports SET available_until = clock_timestamp() - interval '1 second', prepared_at = clock_timestamp() - interval '8 days' WHERE user_id = $1", [alice.user]);
  assert.deepEqual(await readExport(alice.user), { export_status: 'EXPIRED', available_until: null, content: null });
  assert.equal((await stateOf(alice.user)).export_status, 'EXPIRED');
  await prepare();
  assert.deepEqual(await one("SELECT status, content FROM personal_data_private.data_exports WHERE user_id = $1", [alice.user]), { status: 'EXPIRED', content: null }, 'the artifact itself is gone');
  assert.equal((await requestExport(alice.user, randomUUID())).export_status, 'PREPARING', 'a fresh request after expiry');
  assert.equal(await count("SELECT count(*) AS n FROM personal_data_private.data_exports WHERE user_id = $1 AND status = 'PREPARING'", [alice.user]), 1);
}

// ------------------------------------------------------------------------------------------------------
// 4. Delete Account — Personal world.
// ------------------------------------------------------------------------------------------------------

const requestDeletion = async (userId, commandId, amr = passwordProof(), on = client) => {
  await actAs('authenticated', userId, { amr }, on);
  const answer = await one('SELECT * FROM public.request_own_account_deletion_v1($1)', [commandId], on);
  await asOwner(on);
  return answer;
};
const cancelDeletion = async (userId, on = client) => {
  await actAs('authenticated', userId, {}, on);
  const answer = await one('SELECT * FROM public.cancel_own_account_deletion_v1()', [], on);
  await asOwner(on);
  return answer;
};
const server = async (sql, values = [], on = client) => {
  await actAs('service_role', null, {}, on);
  const answer = await rows(sql, values, on);
  await asOwner(on);
  return answer;
};
const erase = async (deletionId, on = client) => (await server('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId], on))[0].outcome;
const complete = async (deletionId) => (await server('SELECT public.server_complete_account_deletion_v1($1) AS outcome', [deletionId]))[0].outcome;
const pastGrace = async (userId, on = client) => on.query(`UPDATE personal_data_private.account_deletions
    SET requested_at = clock_timestamp() - interval '8 days', final_at = clock_timestamp() - interval '1 day'
  WHERE user_id = $1 AND status = 'SCHEDULED'`, [userId]);
const deletionOf = async (userId) => one('SELECT * FROM personal_data_private.account_deletions WHERE user_id = $1 AND status <> $2', [userId, 'CANCELLED']);

async function verifyDeletion(alice, bob) {
  stage = 'deletion: re-authentication is demanded by the database';
  for (const amr of [undefined, passwordProof(90)]) {
    await actAs('authenticated', alice.user, { amr });
    await rejected(() => client.query('SELECT * FROM public.request_own_account_deletion_v1($1)', [randomUUID()]), ['42501']);
    await asOwner();
  }

  stage = 'deletion: schedule, replay, cancel, and a cancelled command never re-schedules';
  const first = randomUUID();
  const scheduled = await requestDeletion(alice.user, first);
  assert.equal(scheduled.outcome, 'ACCEPTED');
  assert.equal(scheduled.deletion_status, 'SCHEDULED');
  const grace = (new Date(scheduled.final_at) - Date.now()) / 86_400_000;
  assert.ok(grace > 6.9 && grace <= 7, 'a short grace period (7 days) before the final deletion');
  assert.deepEqual(await requestDeletion(alice.user, first), scheduled, 'a replay answers the same request');
  assert.deepEqual(await requestDeletion(alice.user, randomUUID()), scheduled, 'one live request per account');
  assert.equal((await stateOf(alice.user)).deletion_status, 'SCHEDULED');
  assert.deepEqual(await cancelDeletion(bob.user), { outcome: 'NONE', deletion_status: 'NONE', final_at: null }, 'another reader cannot cancel it');
  assert.deepEqual(await cancelDeletion(alice.user), { outcome: 'CANCELLED', deletion_status: 'NONE', final_at: null });
  assert.equal((await stateOf(alice.user)).deletion_status, 'NONE');
  assert.deepEqual(await requestDeletion(alice.user, first), { outcome: 'CANCELLED', deletion_status: 'NONE', final_at: null }, 'the spent command never re-schedules');
  assert.deepEqual(await cancelDeletion(alice.user), { outcome: 'NONE', deletion_status: 'NONE', final_at: null }, 'a repeated cancel is harmless');

  stage = 'deletion: not due before the grace period; not cancellable after it';
  const request = await requestDeletion(alice.user, randomUUID());
  assert.equal(request.deletion_status, 'SCHEDULED');
  const { id: deletionId } = await deletionOf(alice.user);
  assert.deepEqual(await server('SELECT * FROM public.server_claim_due_account_deletions_v1(20)'), [], 'nothing is due yet');
  assert.equal(await erase(deletionId), 'NOT_DUE');
  await actAs('authenticated', alice.user);
  await rejected(() => client.query('SELECT public.server_erase_personal_account_v1($1)', [deletionId]), ['42501']);
  await rejected(() => client.query('SELECT * FROM public.server_claim_due_account_deletions_v1(20)'), ['42501']);
  await asOwner();
  await pastGrace(alice.user);
  assert.equal((await stateOf(alice.user)).deletion_status, 'FINALIZING');
  assert.equal((await cancelDeletion(alice.user)).outcome, 'NOT_CANCELLABLE', 'after the grace period the deletion is final');

  stage = 'deletion: the server claims it and erases the Personal world, and nothing else';
  const bobBefore = await footprint(bob.user);
  const aliceBefore = await footprint(alice.user);
  for (const table of ['public.conversation_turns.user_id', 'public.conversation_units.user_id', 'public.memories.user_id',
    'public.memory_control_commands.user_id', 'public.hypotheses.user_id', 'public.understanding_contests.user_id',
    'public.historical_material_events.user_id', 'public.him_measurement_targets.user_id', 'public.runtime_event_outbox.subject_user_id']) {
    assert.ok(aliceBefore[table] > 0, `the fixture really populates ${table}`);
  }
  const claimed = await server('SELECT * FROM public.server_claim_due_account_deletions_v1(20)');
  assert.deepEqual(claimed.map((c) => [c.deletion_id, c.user_id, c.deletion_status]), [[deletionId, alice.user, 'SCHEDULED']]);
  assert.deepEqual(await server('SELECT * FROM public.server_claim_due_account_deletions_v1(20)'), [], 'a claimed request is leased');
  const login = 'alice.erase';
  const { public_id: publicId } = await one('SELECT public_id FROM public.users WHERE id = $1', [alice.user]);
  assert.equal(await erase(deletionId), 'ERASED');
  assert.deepEqual(await footprint(alice.user), { 'public.users.id': 0 }, 'zero rows of the account remain in any table, and no account row');
  assert.deepEqual(await footprint(bob.user), bobBefore, 'another reader\'s footprint is untouched');
  assert.equal(await count('SELECT count(*) AS n FROM personal_data_private.erasure_authorizations'), 0, 'the boundary is closed again');
  const erased = await one('SELECT status, erased_at IS NOT NULL AS erased, completed_at FROM personal_data_private.account_deletions WHERE id = $1', [deletionId]);
  assert.deepEqual(erased, { status: 'ERASED', erased: true, completed_at: null }, 'the request is kept as the minimal record');
  assert.equal(await count('SELECT count(*) AS n FROM auth.users WHERE id = $1', [alice.user]), 1, 'the provider account is the API\'s to remove next');

  stage = 'deletion: retry and completion are idempotent';
  assert.equal(await erase(deletionId), 'ALREADY_ERASED');
  assert.deepEqual((await server('SELECT * FROM public.server_claim_due_account_deletions_v1(20)')).map((c) => c.deletion_status), [], 'still leased');
  await client.query('UPDATE personal_data_private.account_deletions SET lease_until = NULL WHERE id = $1', [deletionId]);
  assert.deepEqual((await server('SELECT * FROM public.server_claim_due_account_deletions_v1(20)')).map((c) => c.deletion_status), ['ERASED'], 'a pending provider removal is claimed again');
  assert.equal(await complete(deletionId), 'COMPLETED');
  assert.equal(await complete(deletionId), 'COMPLETED');
  assert.equal(await erase(deletionId), 'ALREADY_ERASED');
  assert.equal(await complete(randomUUID()), 'UNKNOWN');

  stage = 'deletion: the Login ID and Public ID are not reused directly';
  assert.deepEqual((await rows('SELECT digest FROM personal_data_private.retired_account_identifiers WHERE digest = ANY($1::text[]) ORDER BY 1',
    [[digest('lid1', login), digest('pid1', publicId)]])).length, 2, 'both are retired, as digests');
  const [{ available }] = await server('SELECT public.login_id_is_available_v1($1) AS available', ['ALICE.erase']);
  assert.equal(available, false, 'a retired Login ID is not available (case-insensitively)');
  await actAs('authenticated', bob.user, { amr: passwordProof() });
  const loginChange = await one('SELECT * FROM public.change_own_login_id_v1($1, $2)', [randomUUID(), login]);
  assert.equal(loginChange.outcome, 'UNAVAILABLE', 'the existing Login ID change answers UNAVAILABLE');
  const publicChange = await one('SELECT * FROM public.change_own_public_id_v1($1, $2)', [randomUUID(), publicId]);
  assert.equal(publicChange.outcome, 'UNAVAILABLE', 'the existing Public ID change answers UNAVAILABLE');
  await asOwner();
  await rejected(() => client.query('INSERT INTO public.users (id, auth_subject) VALUES ($1, $1::text)', [alice.user]), ['42501']);
}

// ------------------------------------------------------------------------------------------------------
// 5. The Connected Worlds hard stop.
// ------------------------------------------------------------------------------------------------------

async function verifyConnectedWorldsBlock() {
  stage = 'hard stop: an account a Connected Worlds row references is BLOCKED, and nothing of it is erased';
  const carol = await populated('carol.shared', 'carol');
  await client.query('INSERT INTO public.shared_world_invite_credential_state (user_id, credential_lookup_ref, epoch) VALUES ($1, $2, 1)', [carol.user, `sid1:${randomUUID()}`]);
  await requestDeletion(carol.user, randomUUID());
  await pastGrace(carol.user);
  const before = await footprint(carol.user);
  const { id } = await deletionOf(carol.user);
  assert.equal(await erase(id), 'BLOCKED');
  assert.deepEqual(await footprint(carol.user), before, 'the whole erasure was undone');
  assert.equal((await one('SELECT status FROM personal_data_private.account_deletions WHERE id = $1', [id])).status, 'BLOCKED');
  assert.equal(await count('SELECT count(*) AS n FROM personal_data_private.retired_account_identifiers WHERE digest = $1', [digest('lid1', 'carol.shared')]), 0);
  assert.equal(await count('SELECT count(*) AS n FROM personal_data_private.erasure_authorizations'), 0);
  assert.equal((await stateOf(carol.user)).deletion_status, 'BLOCKED');
  assert.equal(await erase(id), 'BLOCKED', 'never retried into a partial erasure');
  assert.deepEqual(await cancelDeletion(carol.user), { outcome: 'CANCELLED', deletion_status: 'NONE', final_at: null }, 'the owner may cancel a blocked deletion');
}

// ------------------------------------------------------------------------------------------------------
// 6. Concurrency on committed state.
// ------------------------------------------------------------------------------------------------------

async function waitUntilBlocked(pid) {
  for (let i = 0; i < 400; i += 1) {
    const [row] = await rows('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (row?.wait_event_type === 'Lock') return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('the second attempt never blocked on the first');
}

async function race(first, second) {
  const a = new Client({ connectionString: databaseUrl });
  const b = new Client({ connectionString: databaseUrl });
  await a.connect();
  await b.connect();
  try {
    const [{ pid }] = (await b.query('SELECT pg_backend_pid() AS pid')).rows;
    await a.query('BEGIN');
    const x = await first(a);
    await b.query('BEGIN');
    const pending = second(b).then((value) => ({ value }), (error) => ({ error }));
    await waitUntilBlocked(pid);
    await a.query('COMMIT');
    const y = await pending;
    await b.query(y.error ? 'ROLLBACK' : 'COMMIT');
    return [x, y];
  } finally {
    await a.end();
    await b.end();
  }
}

async function verifyConcurrency(fixtures) {
  stage = 'concurrency: committed fixtures';
  await client.query('BEGIN');
  const dave = await reader('dave.race');
  const erin = await reader('erin.race');
  fixtures.push(dave, erin);
  await session(dave);
  await requestDeletion(dave, randomUUID());
  await requestDeletion(erin, randomUUID());
  await pastGrace(dave);
  await pastGrace(erin);
  await client.query('COMMIT');
  const daveDeletion = (await deletionOf(dave)).id;
  const erinDeletion = (await deletionOf(erin)).id;

  stage = 'concurrency: a cancellation racing the committed erasure is refused — the account is gone';
  const [erased, cancel] = await race((on) => erase(daveDeletion, on), (on) => cancelDeletion(dave, on));
  assert.equal(erased, 'ERASED');
  assert.equal(cancel.error?.code, 'P0002', 'the cancellation met no account');
  assert.equal((await one('SELECT status FROM personal_data_private.account_deletions WHERE id = $1', [daveDeletion])).status, 'ERASED');

  stage = 'concurrency: two erasures of one request erase once';
  const [firstErase, secondErase] = await race((on) => erase(erinDeletion, on), (on) => erase(erinDeletion, on));
  assert.equal(firstErase, 'ERASED');
  assert.equal(secondErase.value, 'ALREADY_ERASED');
}

/** Committed fixtures are removed as the table owner. The erased ones hold only their records and the auth row. */
async function removeCommitted(userIds) {
  await client.query('BEGIN');
  for (const userId of userIds) {
    const [row] = await rows('SELECT login_id FROM public.users WHERE id = $1', [userId]);
    await client.query('DELETE FROM personal_data_private.account_deletions WHERE user_id = $1', [userId]);
    if (row) {
      await client.query("SET LOCAL session_replication_role = 'replica'");
      await client.query('DELETE FROM public.conversation_sessions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM public.users WHERE id = $1', [userId]);
      await client.query("SET LOCAL session_replication_role = 'origin'");
    }
    await client.query('DELETE FROM auth.users WHERE id = $1', [userId]);
  }
  await client.query('DELETE FROM personal_data_private.retired_account_identifiers WHERE digest = ANY($1::text[])',
    [[digest('lid1', 'dave.race'), digest('lid1', 'erin.race')]]);
  await client.query('COMMIT');
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
    + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[]))
    + (SELECT count(*) FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[])) AS residue`, [userIds]);
  assert.equal(Number(residue), 0, 'the committed fixtures are gone');
}

async function main() {
  await client.connect();
  const committed = [];
  try {
    await client.query('BEGIN');
    await verifyCatalog();
    stage = 'fixtures: two populated readers';
    const alice = await populated('alice.erase', 'alice');
    const bob = await populated('bob.keeps', 'bob');
    await verifyBoundary(alice);
    await verifyExport(alice, bob);
    await verifyDeletion(alice, bob);
    await verifyConnectedWorldsBlock();
    await client.query('ROLLBACK');
    await verifyConcurrency(committed);
  } catch (error) {
    error.message = `[${stage}] ${error.message}`;
    throw error;
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    stage = 'fixture removal';
    if (committed.length) await removeCommitted(committed);
    await client.end();
  }
  console.log('Verified migration 0130: the private Privacy & Data state and its exact grants; the sixteen history guards narrowed to the ONE governed, transaction-bound Personal erasure and closed to every forgery; Export with database-enforced re-authentication, owner-only asynchronous preparation, readable Personal content without internal ids or another reader\'s material, and expiry discarding the artifact; Delete Account with re-authentication, a cancellable grace period, a final erasure of a real populated Personal footprint to zero rows while another reader is untouched, idempotent retry and completion, retired Login ID and Public ID, no resurrection; the Connected Worlds hard stop BLOCKING without erasing; and committed races that erase once and refuse a late cancellation.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
