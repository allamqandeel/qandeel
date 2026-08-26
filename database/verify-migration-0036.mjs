// Hypothesis Lifecycle Completion (migration 0036) adversarial verifier.
//
// Runs against a fully migrated database. It proves, on real PostgreSQL:
//   * the canonical lifecycle graph is frozen and is stated identically by the
//     internal policy primitive, by the audit table's edge constraint and by
//     the live transition boundary - every allowed edge succeeds, every
//     forbidden edge and every self-transition fails closed with no mutation
//     and no audit row;
//   * the exact-version contract - the exact expected version succeeds and
//     increments exactly once, a stale expected version fails closed with the
//     canonical 40001 semantics and NEVER transitions the newer row, and a
//     concurrent canonical mutation between the owner's read and the
//     transition makes that read's version stale rather than silently moving a
//     Hypothesis the caller never saw;
//   * the authority boundary - the owner is derived from auth.uid() only, no
//     caller can supply an owner, a transition source, a before/after version
//     or any audit metadata, the internal transition core is executable by no
//     application role, the legacy migration-0005 transition RPC is executable
//     by PUBLIC, anon, authenticated and service_role NOT AT ALL so it cannot
//     bypass exact-version or audit semantics, and no application role holds
//     any direct DML on the immutable lifecycle audit;
//   * the audit contract - exactly one immutable row per successful transition
//     with exact before/after status, exact before/after versions and an exact
//     bounded server-derived source; a failed transition writes none; and an
//     audit failure rolls the status/version mutation back with it;
//   * the generated lifecycle - a canonical SYSTEM_GENERATED batch is built as
//     CANDIDATE, admitted CANDIDATE -> ACTIVE inside the SAME atomic
//     HYPOTHESIS_PERSISTENCE transaction with exactly one activation audit row
//     and exactly one version increment per target, and is durably ACTIVE
//     BEFORE the persistence effect can complete; an activation failure rolls
//     the entire generation persistence back leaving no Hypothesis, no
//     partially ACTIVE batch, no audit and no completion;
//     NO_ACCEPTED_CANDIDATES writes no audit; and a durable retry duplicates
//     nothing;
//   * the upgrade - a reconstructed pre-0036 database really did allow a
//     last-writer-wins unaudited transition and really did strand a persisted
//     generated Hypothesis in CANDIDATE, and applying migration 0036 leaves
//     every historical row byte-identical, backfills nothing and fabricates no
//     audit history.
//
// Every fixture is rolled back; no data is retained. No paid provider is ever
// invoked.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const migrationSql = await readFile(new URL('./migrations/0036_hypothesis_lifecycle_completion_v1.sql', import.meta.url), 'utf8');
const generationSql = await readFile(new URL('./migrations/0033_hypothesis_generation_atomicity_recovery_v1.sql', import.meta.url), 'utf8');
const client = new Client({ connectionString: process.env.DATABASE_URL });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;
const one = async (text, values = []) => (await rows(text, values))[0];

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}

async function rejected(operation, codes = ['42501']) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')})`);
  return error;
}

const STATUSES = ['CANDIDATE', 'ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK', 'REJECTED', 'RETIRED', 'REOPENED'];
// The frozen canonical graph, restated here independently of both the database
// and the TypeScript mirror so a drift in either is caught rather than copied.
const GRAPH = {
  CANDIDATE: ['ACTIVE'],
  ACTIVE: ['SUPPORTED', 'MIXED', 'WEAK', 'REJECTED', 'RETIRED'],
  SUPPORTED: ['MIXED', 'WEAK', 'REJECTED', 'RETIRED'],
  MIXED: ['SUPPORTED', 'WEAK', 'REJECTED', 'RETIRED'],
  WEAK: ['ACTIVE', 'MIXED', 'REJECTED', 'RETIRED'],
  REJECTED: ['REOPENED'],
  RETIRED: ['REOPENED'],
  REOPENED: ['ACTIVE'],
};
// Shortest canonical walk from CANDIDATE to each status, using only real edges.
const WALKS = {
  CANDIDATE: [],
  ACTIVE: ['ACTIVE'],
  SUPPORTED: ['ACTIVE', 'SUPPORTED'],
  MIXED: ['ACTIVE', 'MIXED'],
  WEAK: ['ACTIVE', 'WEAK'],
  REJECTED: ['ACTIVE', 'REJECTED'],
  RETIRED: ['ACTIVE', 'RETIRED'],
  REOPENED: ['ACTIVE', 'REJECTED', 'REOPENED'],
};

const POLICY = 'public.hypothesis_lifecycle_transition_allowed_v1(text,text)';
const CORE = 'public.transition_hypothesis_core_v1(uuid,uuid,integer,text,text)';
const V2 = 'public.transition_hypothesis_v2(uuid,integer,text)';
const LEGACY = 'public.transition_hypothesis(uuid,text)';
const AUDIT_TABLE = 'public.hypothesis_lifecycle_transitions';

const CREATE_CALL = 'SELECT * FROM public.server_create_hypothesis_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)';
const V2_CALL = 'SELECT * FROM public.transition_hypothesis_v2($1,$2,$3)';
const CORE_CALL = 'SELECT * FROM public.transition_hypothesis_core_v1($1,$2,$3,$4,$5)';
const LEGACY_CALL = 'SELECT * FROM public.transition_hypothesis($1,$2)';
const ALLOWED = 'SELECT public.hypothesis_lifecycle_transition_allowed_v1($1,$2) allowed';
const HYPOTHESIS = 'SELECT * FROM public.hypotheses WHERE id=$1';
// Ordered by after_version: the whole verifier runs in ONE transaction, so
// created_at (transaction-fixed CURRENT_TIMESTAMP) cannot order rows, while
// after_version is unique and monotonic per Hypothesis by construction.
const AUDIT = `SELECT * FROM ${AUDIT_TABLE} WHERE hypothesis_id=$1 ORDER BY after_version, id`;
const AUDIT_TOTAL = `SELECT count(*)::int total FROM ${AUDIT_TABLE}`;
const ATTACH_CALL = 'SELECT * FROM public.attach_hypothesis_evidence($1,$2,$3)';

const ACQUIRE = 'SELECT * FROM public.acquire_post_response_intelligence_execution_v1($1,$2,$3,$4,$5,$6,$7,$8)';
const CLAIM = 'SELECT public.claim_post_response_intelligence_effect_v1($1,$2) ok';
const COMPLETE_INTENT = 'SELECT public.complete_post_response_intent_provider_effect_v1($1,$2,$3) ok';
const COMPLETE_CANDIDATE = 'SELECT public.complete_post_response_candidate_provider_effect_v1($1,$2,$3) ok';
const PERSIST = 'SELECT public.persist_post_response_hypothesis_generation_v1($1) ok';
const EFFECT = 'SELECT * FROM public.post_response_intelligence_effects WHERE execution_id=$1 AND effect_key=$2';

const AUDIT_FAULT = 'qandeel.lifecycle_audit_fault_target';
const ORDER_GUARD = 'qandeel.lifecycle_completion_order_guard';

const userId = randomUUID();
const otherUserId = randomUUID();
const memories = { first: randomUUID(), second: randomUUID() };
const evidence = { first: `memory:${memories.first}`, second: `memory:${memories.second}` };

const scopeFor = (execution) => `CONVERSATION_SESSION:${execution.session}`;

async function armAuditFault(targetId) {
  await identity('postgres');
  await q('SELECT set_config($1,$2,true)', [AUDIT_FAULT, targetId ?? '']);
}

async function armOrderGuard(on) {
  await identity('postgres');
  await q('SELECT set_config($1,$2,true)', [ORDER_GUARD, on ? 'on' : '']);
}

async function executeGrantees(signature) {
  return (await rows(
    `SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee
       FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      WHERE p.oid=$1::regprocedure AND a.privilege_type='EXECUTE'
      ORDER BY 1`, [signature],
  )).map((row) => row.grantee);
}

// Creates a canonical CANDIDATE (status CANDIDATE, version 1) through the
// existing server-authoritative command, then walks it to `status` using ONLY
// the new exact-version boundary.
async function hypothesisAt(status, { owner = userId, statement = `lifecycle ${randomUUID()}` } = {}) {
  const id = randomUUID();
  await identity('service_role');
  const [created] = await rows(CREATE_CALL, [owner, id, statement, 'CAUSAL', 'GENERAL', 'lifecycle scope', 'HUMAN_REVIEWED', [], []]);
  assert.equal(created.status, 'CANDIDATE', 'canonical creation still begins at CANDIDATE');
  assert.equal(created.version, 1, 'canonical creation still begins at version 1');
  let version = created.version;
  await identity('authenticated', owner);
  for (const step of WALKS[status]) {
    const [moved] = await rows(V2_CALL, [id, version, step]);
    assert.equal(moved.status, step);
    version = moved.version;
  }
  await identity('postgres');
  const row = await one(HYPOTHESIS, [id]);
  assert.equal(row.status, status, `walked fixture reached ${status}`);
  return { id, version: row.version, owner };
}

// -------------------------------------------------------------------------
// A. Surface, ACLs and default-deny posture.
// -------------------------------------------------------------------------
async function verifySurfaceAndAcls() {
  stage = 'surface and ACLs';
  await identity('postgres');

  // The internal policy primitive is pure, immutable and internal-only.
  const policy = await one(
    'SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config, p.provolatile volatile FROM pg_proc p WHERE p.oid=$1::regprocedure',
    [POLICY],
  );
  assert.equal(policy.owner, 'postgres', 'lifecycle policy owner');
  assert.equal(policy.definer, false, 'the pure policy primitive needs no definer rights');
  assert.equal(policy.volatile, 'i', 'the lifecycle policy is IMMUTABLE');
  assert.ok(Array.isArray(policy.config) && policy.config.length === 1 && policy.config[0].startsWith('search_path='),
    'the lifecycle policy has the hardened fixed search_path');
  assert.deepEqual(await executeGrantees(POLICY), ['postgres'], 'lifecycle policy EXECUTE holders');
  const { definition: policyDefinition } = await one('SELECT pg_get_functiondef($1::regprocedure) definition', [POLICY]);
  assert.doesNotMatch(policyDefinition, /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/u, 'the lifecycle policy reads no table');
  assert.doesNotMatch(policyDefinition, /auth\.uid/u, 'the lifecycle policy holds no caller-derived authority');

  // The internal transition core is SECURITY DEFINER, owner-scoped, and
  // executable by no application role at all.
  const core = await one(
    'SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config FROM pg_proc p WHERE p.oid=$1::regprocedure',
    [CORE],
  );
  assert.equal(core.owner, 'postgres');
  assert.equal(core.definer, true, 'the transition core is SECURITY DEFINER');
  assert.ok(Array.isArray(core.config) && core.config[0].startsWith('search_path='), 'hardened core search_path');
  assert.deepEqual(await executeGrantees(CORE), ['postgres'], 'transition core EXECUTE holders');

  // The one authenticated wrapper: authenticated only, and its parameter
  // surface cannot express an owner, a source or any audit fact.
  const wrapper = await one(
    'SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config FROM pg_proc p WHERE p.oid=$1::regprocedure',
    [V2],
  );
  assert.equal(wrapper.owner, 'postgres');
  assert.equal(wrapper.definer, true);
  assert.ok(Array.isArray(wrapper.config) && wrapper.config[0].startsWith('search_path='));
  assert.deepEqual(await executeGrantees(V2), ['authenticated', 'postgres'], 'v2 EXECUTE holders');
  const { args } = await one('SELECT pg_get_function_arguments($1::regprocedure) args', [V2]);
  assert.deepEqual(args.split(',').map((part) => part.trim()),
    ['p_hypothesis_id uuid', 'p_expected_version integer', 'p_status text'], 'v2 parameter surface');
  assert.doesNotMatch(args, /user|source|before|after|audit|transition_id|created_at/iu);

  // The legacy transition RPC keeps its object identity but holds no
  // application execution authority at all.
  assert.deepEqual(await executeGrantees(LEGACY), ['postgres'], 'legacy transition EXECUTE holders');

  const fn = [
    ['authenticated', POLICY, false], ['anon', POLICY, false], ['service_role', POLICY, false],
    ['authenticated', CORE, false], ['anon', CORE, false], ['service_role', CORE, false],
    ['authenticated', V2, true], ['anon', V2, false], ['service_role', V2, false],
    ['authenticated', LEGACY, false], ['anon', LEGACY, false], ['service_role', LEGACY, false],
  ];
  for (const [role, signature, expected] of fn) {
    const { allowed } = await one('SELECT has_function_privilege($1,$2,$3) allowed', [role, signature, 'EXECUTE']);
    assert.equal(allowed, expected, `${role} EXECUTE ${signature}`);
  }

  // The immutable audit: owner-scoped SELECT for the client only, no write
  // authority for any application role, RLS on, exactly one read policy.
  const priv = [
    ['authenticated', 'SELECT', true], ['authenticated', 'INSERT', false],
    ['authenticated', 'UPDATE', false], ['authenticated', 'DELETE', false], ['authenticated', 'TRUNCATE', false],
    ['anon', 'SELECT', false], ['anon', 'INSERT', false], ['anon', 'UPDATE', false], ['anon', 'DELETE', false],
    ['service_role', 'SELECT', false], ['service_role', 'INSERT', false],
    ['service_role', 'UPDATE', false], ['service_role', 'DELETE', false], ['service_role', 'TRUNCATE', false],
  ];
  for (const [role, privilege, expected] of priv) {
    const { allowed } = await one('SELECT has_table_privilege($1,$2,$3) allowed', [role, AUDIT_TABLE, privilege]);
    assert.equal(allowed, expected, `${role} ${privilege} on ${AUDIT_TABLE}`);
  }
  const { rls } = await one(`SELECT relrowsecurity rls FROM pg_class WHERE oid='${AUDIT_TABLE}'::regclass`);
  assert.equal(rls, true, 'the lifecycle audit has RLS enabled');
  assert.deepEqual(
    await rows("SELECT policyname, cmd FROM pg_policies WHERE schemaname='public' AND tablename='hypothesis_lifecycle_transitions' ORDER BY policyname"),
    [{ policyname: 'hypothesis_lifecycle_transitions_select_own', cmd: 'SELECT' }],
    'only an owner-scoped read policy exists on the lifecycle audit',
  );
  assert.deepEqual(
    (await rows(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='hypothesis_lifecycle_transitions' ORDER BY ordinal_position`,
    )).map((row) => row.column_name),
    ['id', 'user_id', 'hypothesis_id', 'before_status', 'after_status', 'before_version', 'after_version', 'source', 'created_at'],
    'the lifecycle audit carries durable facts only - no rationale, transcript, payload or free-text field',
  );

  // Decisive surface statements: exactly one function writes the audit, exactly
  // two functions can write a Hypothesis status, and NEITHER of the status
  // writers is reachable by any application role.
  const auditWriters = (await rows(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f'
        AND pg_get_functiondef(p.oid) ~* 'INSERT INTO[[:space:]]+public\\.hypothesis_lifecycle_transitions'
      ORDER BY p.proname`,
  )).map((row) => row.proname);
  assert.deepEqual(auditWriters, ['transition_hypothesis_core_v1'], 'exactly one lifecycle audit writer exists');
  const statusWriters = (await rows(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f'
        AND pg_get_functiondef(p.oid) ~* 'UPDATE[[:space:]]+public\\.hypotheses[[:space:]]+SET[[:space:]]+status'
      ORDER BY p.proname`,
  )).map((row) => row.proname);
  assert.deepEqual(statusWriters, ['transition_hypothesis', 'transition_hypothesis_core_v1'],
    'exactly the legacy command and the audited core can write a Hypothesis status');
  for (const name of [...new Set([...auditWriters, ...statusWriters])]) {
    for (const role of ['authenticated', 'anon', 'service_role']) {
      const { allowed } = await one(
        `SELECT bool_or(has_function_privilege($2, p.oid, 'EXECUTE')) allowed FROM pg_proc p
           JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=$1`,
        [name, role],
      );
      assert.equal(allowed, false, `${role} cannot execute ${name}`);
    }
  }
}

// -------------------------------------------------------------------------
// B. The frozen graph, stated three ways.
// -------------------------------------------------------------------------
async function verifyGraphPolicy() {
  stage = 'canonical lifecycle graph policy';
  await identity('postgres');
  // The canonical vocabulary itself has not drifted.
  const { definition } = await one(
    "SELECT pg_get_constraintdef(c.oid) definition FROM pg_constraint c WHERE c.conname='hypotheses_status_check'",
  );
  for (const status of STATUSES) assert.match(definition, new RegExp(`'${status}'`, 'u'));
  assert.equal((definition.match(/'[A-Z_]+'/gu) ?? []).length, STATUSES.length, 'the status vocabulary is exactly the frozen eight');
  assert.doesNotMatch(definition, /CONFIRMED/u, 'there is no CONFIRMED status');

  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const { allowed } = await one(ALLOWED, [from, to]);
      assert.equal(allowed, GRAPH[from].includes(to), `policy edge ${from} -> ${to}`);
      if (from === to) assert.equal(allowed, false, `self-transition ${from} must be forbidden`);
    }
  }
  // Unknown and NULL statuses are a hard false, never a NULL a CHECK would
  // silently treat as satisfied.
  for (const [from, to] of [['CONFIRMED', 'ACTIVE'], ['ACTIVE', 'CONFIRMED'], ['', 'ACTIVE'], ['active', 'supported']]) {
    assert.equal((await one(ALLOWED, [from, to])).allowed, false, `unknown edge ${from} -> ${to}`);
  }
  for (const [from, to] of [[null, 'ACTIVE'], ['ACTIVE', null], [null, null]]) {
    assert.equal((await one(ALLOWED, [from, to])).allowed, false, 'a NULL status is a hard false');
  }
}

// -------------------------------------------------------------------------
// C. Every allowed edge succeeds; every forbidden edge fails closed.
// -------------------------------------------------------------------------
async function verifyEveryEdge() {
  stage = 'every canonical edge';
  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const fixture = await hypothesisAt(from);
      await identity('postgres');
      const before = await one(HYPOTHESIS, [fixture.id]);
      const auditBefore = await rows(AUDIT, [fixture.id]);
      await identity('authenticated', userId);
      if (GRAPH[from].includes(to)) {
        const [moved] = await rows(V2_CALL, [fixture.id, before.version, to]);
        assert.equal(moved.status, to, `${from} -> ${to} succeeds`);
        assert.equal(moved.version, before.version + 1, `${from} -> ${to} increments the version exactly once`);
        await identity('postgres');
        const audit = await rows(AUDIT, [fixture.id]);
        assert.equal(audit.length, auditBefore.length + 1, `${from} -> ${to} writes exactly one audit row`);
        const written = audit[audit.length - 1];
        assert.deepEqual(
          {
            user: written.user_id, target: written.hypothesis_id,
            beforeStatus: written.before_status, afterStatus: written.after_status,
            beforeVersion: written.before_version, afterVersion: written.after_version, source: written.source,
          },
          {
            user: userId, target: fixture.id, beforeStatus: from, afterStatus: to,
            beforeVersion: before.version, afterVersion: before.version + 1, source: 'AUTHENTICATED_TRANSITION',
          },
          `${from} -> ${to} audit facts are exact`,
        );
      } else {
        await rejected(() => q(V2_CALL, [fixture.id, before.version, to]), ['22023']);
        await identity('postgres');
        assert.deepEqual(await one(HYPOTHESIS, [fixture.id]), before, `${from} -> ${to} mutates nothing`);
        assert.deepEqual(await rows(AUDIT, [fixture.id]), auditBefore, `${from} -> ${to} writes no audit row`);
      }
    }
  }
  // A status outside the canonical vocabulary is rejected before any mutation.
  const fixture = await hypothesisAt('ACTIVE');
  await identity('authenticated', userId);
  for (const bogus of ['CONFIRMED', 'active', '', 'DROP']) {
    await rejected(() => q(V2_CALL, [fixture.id, fixture.version, bogus]), ['22023']);
  }
  await rejected(() => q(V2_CALL, [fixture.id, fixture.version, null]), ['22023']);
  await identity('postgres');
  assert.equal((await one(HYPOTHESIS, [fixture.id])).status, 'ACTIVE');
  assert.equal((await rows(AUDIT, [fixture.id])).length, 1, 'only the walk activation is audited');
}

// -------------------------------------------------------------------------
// D. Exact-version authority.
// -------------------------------------------------------------------------
async function verifyExactVersion() {
  stage = 'exact expected version';
  const fixture = await hypothesisAt('CANDIDATE');
  await identity('authenticated', userId);
  // A wrong expected version - lower, higher, zero, negative or NULL - fails
  // closed. Zero/negative/NULL are rejected as invalid input before any lock.
  await rejected(() => q(V2_CALL, [fixture.id, 2, 'ACTIVE']), ['40001']);
  await rejected(() => q(V2_CALL, [fixture.id, 99, 'ACTIVE']), ['40001']);
  await rejected(() => q(V2_CALL, [fixture.id, 0, 'ACTIVE']), ['22023']);
  await rejected(() => q(V2_CALL, [fixture.id, -1, 'ACTIVE']), ['22023']);
  await rejected(() => q(V2_CALL, [fixture.id, null, 'ACTIVE']), ['22023']);
  await identity('postgres');
  assert.equal((await one(HYPOTHESIS, [fixture.id])).version, 1, 'a rejected transition never bumps the version');
  assert.equal((await rows(AUDIT, [fixture.id])).length, 0, 'a rejected transition writes no audit');

  // The exact version succeeds and increments exactly once.
  await identity('authenticated', userId);
  const [activated] = await rows(V2_CALL, [fixture.id, 1, 'ACTIVE']);
  assert.equal(activated.status, 'ACTIVE');
  assert.equal(activated.version, 2);

  // The now-stale expected version cannot transition the NEWER row: the caller
  // that read version 1 gets a stale-version failure rather than silently
  // moving a version-2 Hypothesis it never saw.
  await rejected(() => q(V2_CALL, [fixture.id, 1, 'SUPPORTED']), ['40001']);
  await identity('postgres');
  const afterStale = await one(HYPOTHESIS, [fixture.id]);
  assert.equal(afterStale.status, 'ACTIVE', 'the newer row was not transitioned by the stale caller');
  assert.equal(afterStale.version, 2);
  assert.equal((await rows(AUDIT, [fixture.id])).length, 1, 'exactly one audit row survives the stale attempt');

  // A real interleaving: another canonical mutation advances the row between
  // the owner's read and the transition, so the read version is stale.
  const raced = await hypothesisAt('CANDIDATE');
  await identity('authenticated', userId);
  const readVersion = raced.version;
  const [attached] = await rows(ATTACH_CALL, [raced.id, evidence.first, 'SUPPORTING']);
  assert.equal(attached.version, readVersion + 1, 'a concurrent canonical Evidence attachment advanced the version');
  await rejected(() => q(V2_CALL, [raced.id, readVersion, 'ACTIVE']), ['40001']);
  await identity('postgres');
  assert.equal((await one(HYPOTHESIS, [raced.id])).status, 'CANDIDATE', 'the raced Hypothesis was not transitioned');
  assert.equal((await rows(AUDIT, [raced.id])).length, 0);
  await identity('authenticated', userId);
  const [reread] = await rows(V2_CALL, [raced.id, readVersion + 1, 'ACTIVE']);
  assert.equal(reread.status, 'ACTIVE');
  assert.equal(reread.version, readVersion + 2, 'the re-read exact version transitions exactly once');
}

// -------------------------------------------------------------------------
// E. Ownership, forgery and direct-DML denial.
// -------------------------------------------------------------------------
async function verifyAuthority() {
  stage = 'ownership and forgery';
  const mine = await hypothesisAt('CANDIDATE');
  const theirs = await hypothesisAt('CANDIDATE', { owner: otherUserId });

  // Cross-tenant: neither tenant can transition the other's Hypothesis, and the
  // attempt yields zero rows rather than a mutation.
  await identity('authenticated', otherUserId);
  assert.equal((await rows(V2_CALL, [mine.id, 1, 'ACTIVE'])).length, 0, 'a cross-tenant transition finds nothing');
  await identity('authenticated', userId);
  assert.equal((await rows(V2_CALL, [theirs.id, 1, 'ACTIVE'])).length, 0, 'a cross-tenant transition finds nothing');
  await identity('postgres');
  for (const fixture of [mine, theirs]) {
    assert.equal((await one(HYPOTHESIS, [fixture.id])).status, 'CANDIDATE', 'no cross-tenant mutation happened');
    assert.equal((await rows(AUDIT, [fixture.id])).length, 0, 'no cross-tenant audit row was written');
  }
  // An unknown target is a no-op, not an error and not a fabricated audit row.
  await identity('authenticated', userId);
  assert.equal((await rows(V2_CALL, [randomUUID(), 1, 'ACTIVE'])).length, 0, 'an unknown target transitions nothing');

  // The owner is auth-derived: with no JWT identity the wrapper fails closed.
  await q('RESET ROLE');
  await q('SET LOCAL ROLE authenticated');
  await q("SELECT set_config('request.jwt.claims','',true)");
  await rejected(() => q(V2_CALL, [mine.id, 1, 'ACTIVE']), ['42501']);

  // A caller cannot reach the core, forge an owner, forge a source, forge a
  // before/after version or supply audit metadata: the core is unreachable and
  // the wrapper has no parameter for any of it.
  for (const role of ['authenticated', 'anon', 'service_role']) {
    await identity(role, role === 'authenticated' ? userId : null);
    await rejected(() => q(CORE_CALL, [userId, mine.id, 1, 'ACTIVE', 'AUTHENTICATED_TRANSITION']), ['42501']);
    await rejected(() => q(CORE_CALL, [userId, mine.id, 1, 'ACTIVE', 'SYSTEM_GENERATION_ACTIVATION']), ['42501']);
    await rejected(() => q(LEGACY_CALL, [mine.id, 'ACTIVE']), ['42501']);
    await rejected(() => q('SELECT public.hypothesis_lifecycle_transition_allowed_v1($1,$2)', ['CANDIDATE', 'ACTIVE']), ['42501']);
  }
  await identity('authenticated', userId);
  // There is no four-argument overload through which a source or an owner could
  // be smuggled into the authenticated boundary.
  await rejected(() => q('SELECT * FROM public.transition_hypothesis_v2($1,$2,$3,$4)',
    [mine.id, 1, 'ACTIVE', 'SYSTEM_GENERATION_ACTIVATION']), ['42883']);
  await rejected(() => q('SELECT * FROM public.transition_hypothesis_v2($1,$2,$3,$4)',
    [userId, mine.id, 1, 'ACTIVE']), ['42883']);

  // Direct DML on the immutable audit is denied to every application role.
  await identity('service_role');
  await rejected(() => q(`SELECT id FROM ${AUDIT_TABLE}`));
  for (const role of ['authenticated', 'anon', 'service_role']) {
    await identity(role, role === 'authenticated' ? userId : null);
    await rejected(() => q(
      `INSERT INTO ${AUDIT_TABLE}(id,user_id,hypothesis_id,before_status,after_status,before_version,after_version,source)
        VALUES($1,$2,$3,'CANDIDATE','ACTIVE',1,2,'AUTHENTICATED_TRANSITION')`, [randomUUID(), userId, mine.id]));
    await rejected(() => q(`UPDATE ${AUDIT_TABLE} SET after_status='SUPPORTED'`));
    await rejected(() => q(`DELETE FROM ${AUDIT_TABLE}`));
    await rejected(() => q(`TRUNCATE ${AUDIT_TABLE}`));
  }

  // The owner reads its own lifecycle history and nothing else.
  const audited = await hypothesisAt('ACTIVE');
  const theirAudited = await hypothesisAt('ACTIVE', { owner: otherUserId });
  await identity('authenticated', userId);
  assert.deepEqual(
    (await rows(`SELECT hypothesis_id FROM ${AUDIT_TABLE} WHERE hypothesis_id=ANY($1)`, [[audited.id, theirAudited.id]]))
      .map((row) => row.hypothesis_id),
    [audited.id], 'the owner reads only its own lifecycle audit',
  );
  await identity('authenticated', otherUserId);
  assert.deepEqual(
    (await rows(`SELECT hypothesis_id FROM ${AUDIT_TABLE} WHERE hypothesis_id=ANY($1)`, [[audited.id, theirAudited.id]]))
      .map((row) => row.hypothesis_id),
    [theirAudited.id], 'the other tenant reads only its own lifecycle audit',
  );
}

// -------------------------------------------------------------------------
// F. Audit invariants and audit-failure rollback.
// -------------------------------------------------------------------------
async function verifyAuditInvariants() {
  stage = 'lifecycle audit invariants';
  const fixture = await hypothesisAt('ACTIVE');
  await identity('postgres');
  const [existing] = await rows(AUDIT, [fixture.id]);
  assert.ok(existing, 'the activation audit row exists');

  // Even as the table owner, an audit row that violates any canonical invariant
  // cannot be stored.
  const audit = (over = {}) => ({
    id: randomUUID(), user: userId, target: fixture.id, before: 'ACTIVE', after: 'SUPPORTED',
    beforeVersion: 2, afterVersion: 3, source: 'AUTHENTICATED_TRANSITION', ...over,
  });
  const insert = (value) => q(
    `INSERT INTO ${AUDIT_TABLE}(id,user_id,hypothesis_id,before_status,after_status,before_version,after_version,source)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [value.id, value.user, value.target, value.before, value.after, value.beforeVersion, value.afterVersion, value.source],
  );
  for (const [label, value, codes] of [
    ['a forbidden graph edge', audit({ before: 'ACTIVE', after: 'CANDIDATE' }), ['23514']],
    ['a self transition', audit({ before: 'ACTIVE', after: 'ACTIVE' }), ['23514']],
    ['a non-canonical before status', audit({ before: 'CONFIRMED', after: 'ACTIVE' }), ['23514']],
    ['a non-canonical after status', audit({ before: 'ACTIVE', after: 'CONFIRMED' }), ['23514']],
    ['a zero before version', audit({ beforeVersion: 0, afterVersion: 1 }), ['23514']],
    ['a negative before version', audit({ beforeVersion: -1, afterVersion: 0 }), ['23514']],
    ['a skipped after version', audit({ beforeVersion: 2, afterVersion: 4 }), ['23514']],
    ['a regressed after version', audit({ beforeVersion: 3, afterVersion: 2 }), ['23514']],
    ['a source outside the bounded vocabulary', audit({ source: 'MANUAL' }), ['23514']],
    ['a cross-owner audit row', audit({ user: otherUserId }), ['23503']],
    ['a duplicate audit identity', audit({ id: existing.id }), ['23505']],
  ]) {
    await rejected(() => insert(value), codes);
    assert.ok(label);
  }
  // A legitimate row is storable, so the rejections above are the constraints
  // doing their job rather than an unrelated failure.
  await q('SAVEPOINT legitimate');
  await insert(audit());
  await q('ROLLBACK TO SAVEPOINT legitimate');
  await q('RELEASE SAVEPOINT legitimate');

  // Audit failure rolls the status/version mutation back with it: the mutation
  // and the audit really are one transaction, not two writes in sequence.
  const guarded = await hypothesisAt('ACTIVE');
  await identity('postgres');
  const beforeFault = await one(HYPOTHESIS, [guarded.id]);
  const auditBeforeFault = await rows(AUDIT, [guarded.id]);
  await armAuditFault(guarded.id);
  await identity('authenticated', userId);
  await rejected(() => q(V2_CALL, [guarded.id, beforeFault.version, 'SUPPORTED']), ['P0001']);
  await identity('postgres');
  assert.deepEqual(await one(HYPOTHESIS, [guarded.id]), beforeFault,
    'a failed audit INSERT rolls the status and version mutation back');
  assert.deepEqual(await rows(AUDIT, [guarded.id]), auditBeforeFault, 'no partial audit row survives');
  await armAuditFault(null);
  // With the fault disarmed the same transition succeeds, so the rollback above
  // was the audit failing rather than a broken fixture.
  await identity('authenticated', userId);
  const [recovered] = await rows(V2_CALL, [guarded.id, beforeFault.version, 'SUPPORTED']);
  assert.equal(recovered.status, 'SUPPORTED');
  assert.equal(recovered.version, beforeFault.version + 1);
}

// -------------------------------------------------------------------------
// G. Generated Candidate -> Active admission inside atomic persistence.
// -------------------------------------------------------------------------
async function newGeneration(count) {
  const execution = { id: randomUUID(), session: randomUUID(), turn: randomUUID() };
  await identity('postgres');
  await q(ACQUIRE, [execution.id, randomUUID(), userId, execution.session, execution.turn, '2.0', 'FAST', 'ALLOW']);
  await identity('service_role');
  assert.equal((await one(CLAIM, [execution.id, 'INTENT_PROVIDER'])).ok, true);
  const intent = {
    problem: { text: 'Why does this keep happening?', source: 'CURRENT_USER_TURN', sourceTurnId: execution.turn },
    domain: 'GENERAL',
    scope: { kind: 'CONVERSATION_SESSION', sessionId: execution.session, serialized: scopeFor(execution) },
    evidenceIds: [evidence.first, evidence.second],
  };
  assert.equal((await one(COMPLETE_INTENT, [execution.id, 'INTENT_AUTHORIZED', JSON.stringify(intent)])).ok, true);
  assert.equal((await one(CLAIM, [execution.id, 'CANDIDATE_PROVIDER'])).ok, true);
  const candidates = Array.from({ length: count }, () => ({
    hypothesisId: randomUUID(),
    statement: `Lifecycle completion hypothesis ${randomUUID()}`,
    type: 'CAUSAL',
    domain: 'GENERAL',
    scope: scopeFor(execution),
    supportingEvidenceIds: [evidence.first],
    contradictingEvidenceIds: [],
    assumptions: [],
    disconfirmingConditions: [],
  }));
  assert.equal((await one(COMPLETE_CANDIDATE, count === 0
    ? [execution.id, 'NO_ACCEPTED_CANDIDATES', null]
    : [execution.id, 'VALIDATED_CANDIDATES', JSON.stringify(candidates)])).ok, true);
  assert.equal((await one(CLAIM, [execution.id, 'HYPOTHESIS_PERSISTENCE'])).ok, true);
  return { execution, candidates, hypothesisIds: candidates.map((candidate) => candidate.hypothesisId) };
}

async function verifyGeneratedActivation() {
  stage = 'generated Candidate -> Active admission';

  // Single target. The order guard refuses to let the persistence effect become
  // COMPLETED while any of its own durable targets is still CANDIDATE, so a
  // successful persistence is itself proof of the required ordering.
  await armOrderGuard(true);
  const single = await newGeneration(1);
  const [target] = single.hypothesisIds;
  await identity('service_role');
  assert.equal((await one(PERSIST, [single.execution.id])).ok, true,
    'atomic persistence succeeds with the activation-before-completion guard armed');
  await identity('postgres');
  const generated = await one(HYPOTHESIS, [target]);
  assert.equal(generated.origin, 'SYSTEM_GENERATED');
  assert.equal(generated.status, 'ACTIVE', 'the persisted generated Hypothesis is durably ACTIVE');
  // create(1) + supporting attach(2) + activation(3).
  assert.equal(generated.version, 3, 'graph construction plus exactly one activation increment');
  const audit = await rows(AUDIT, [target]);
  assert.equal(audit.length, 1, 'exactly one activation audit row for the generated target');
  assert.deepEqual(
    {
      user: audit[0].user_id, before: audit[0].before_status, after: audit[0].after_status,
      beforeVersion: audit[0].before_version, afterVersion: audit[0].after_version, source: audit[0].source,
    },
    { user: userId, before: 'CANDIDATE', after: 'ACTIVE', beforeVersion: 2, afterVersion: 3, source: 'SYSTEM_GENERATION_ACTIVATION' },
    'the generated target really was CANDIDATE at its graph-construction version and was admitted exactly once',
  );
  const persisted = await one(EFFECT, [single.execution.id, 'HYPOTHESIS_PERSISTENCE']);
  assert.equal(persisted.state, 'COMPLETED');
  assert.equal(persisted.result_code, 'HYPOTHESES_PERSISTED');
  assert.deepEqual(persisted.result_payload, [target]);

  // A durable retry duplicates nothing: no second activation, no second audit
  // row, no version churn.
  await identity('service_role');
  assert.equal((await one(PERSIST, [single.execution.id])).ok, false, 'a completed persistence cannot be replayed');
  await identity('postgres');
  assert.deepEqual(await one(HYPOTHESIS, [target]), generated, 'the retry changed no Hypothesis row');
  assert.deepEqual(await rows(AUDIT, [target]), audit, 'the retry wrote no second lifecycle audit row');
  assert.deepEqual(await one(EFFECT, [single.execution.id, 'HYPOTHESIS_PERSISTENCE']), persisted);

  // Multi-target: every target is ACTIVE before the effect completes, each with
  // exactly one activation audit row.
  const batch = await newGeneration(3);
  await identity('service_role');
  assert.equal((await one(PERSIST, [batch.execution.id])).ok, true);
  await identity('postgres');
  const generatedRows = [];
  for (const id of batch.hypothesisIds) generatedRows.push(await one(HYPOTHESIS, [id]));
  assert.deepEqual(generatedRows.map((row) => row.status), ['ACTIVE', 'ACTIVE', 'ACTIVE'],
    'every generated target in the batch is ACTIVE');
  const batchAudit = await rows(
    `SELECT * FROM ${AUDIT_TABLE} WHERE hypothesis_id=ANY($1) ORDER BY hypothesis_id, after_version`, [batch.hypothesisIds],
  );
  assert.equal(batchAudit.length, 3, 'exactly one activation audit row per generated target');
  for (const row of batchAudit) {
    assert.equal(row.before_status, 'CANDIDATE');
    assert.equal(row.after_status, 'ACTIVE');
    assert.equal(row.after_version, row.before_version + 1, 'exactly one version increment per activation');
    assert.equal(row.source, 'SYSTEM_GENERATION_ACTIVATION');
    assert.equal(row.user_id, userId);
  }
  assert.deepEqual(
    batchAudit.map((row) => row.hypothesis_id).sort(),
    [...batch.hypothesisIds].sort(),
    'every durable plan target, and only those, was activated',
  );
  assert.equal((await one(EFFECT, [batch.execution.id, 'HYPOTHESIS_PERSISTENCE'])).result_code, 'HYPOTHESES_PERSISTED');
  await armOrderGuard(false);

  // NO_ACCEPTED_CANDIDATES writes no Hypothesis and therefore no lifecycle
  // audit row at all.
  await identity('postgres');
  const { total: auditBeforeNoOp } = await one(AUDIT_TOTAL);
  const empty = await newGeneration(0);
  await identity('service_role');
  assert.equal((await one(PERSIST, [empty.execution.id])).ok, true);
  await identity('postgres');
  assert.equal((await one(EFFECT, [empty.execution.id, 'HYPOTHESIS_PERSISTENCE'])).result_code, 'NO_HYPOTHESES_PERSISTED');
  assert.equal((await one(AUDIT_TOTAL)).total, auditBeforeNoOp, 'the no-target path writes no lifecycle audit row');
}

async function verifyActivationRollback() {
  stage = 'activation failure rolls the whole persistence back';
  const failing = await newGeneration(2);
  const [first, second] = failing.hypothesisIds;
  await identity('postgres');
  const { total: auditBefore } = await one(AUDIT_TOTAL);
  const { total: hypothesesBefore } = await one('SELECT count(*)::int total FROM public.hypotheses');
  // The SECOND target's activation audit fails, so the first target's already
  // committed graph AND its already applied activation must both roll back.
  await armAuditFault(second);
  await identity('service_role');
  await rejected(() => q(PERSIST, [failing.execution.id]), ['P0001']);
  await armAuditFault(null);
  await identity('postgres');
  assert.equal(await one(HYPOTHESIS, [first]), undefined, 'no earlier generated Hypothesis survives the failed activation');
  assert.equal(await one(HYPOTHESIS, [second]), undefined, 'the failing generated Hypothesis does not survive either');
  assert.equal((await one('SELECT count(*)::int total FROM public.hypotheses')).total, hypothesesBefore,
    'the failed activation rolls back every generated write');
  assert.equal((await one(AUDIT_TOTAL)).total, auditBefore, 'no lifecycle audit row survives the failed activation');
  const stalled = await one(EFFECT, [failing.execution.id, 'HYPOTHESIS_PERSISTENCE']);
  assert.deepEqual(
    { state: stalled.state, code: stalled.result_code, reference: stalled.result_reference, payload: stalled.result_payload },
    { state: 'CLAIMED', code: null, reference: null, payload: null },
    'no false success: the effect stays CLAIMED and result-less for the existing recovery boundary',
  );
  // The same durable plan then persists whole once the fault is gone, proving
  // the stalled state was a real recoverable database state.
  await identity('service_role');
  assert.equal((await one(PERSIST, [failing.execution.id])).ok, true, 'the durable plan persists whole after the fault');
  await identity('postgres');
  for (const id of failing.hypothesisIds) {
    assert.equal((await one(HYPOTHESIS, [id])).status, 'ACTIVE');
    assert.equal((await rows(AUDIT, [id])).length, 1, 'the recovered batch activates each target exactly once');
  }
}

// -------------------------------------------------------------------------
// H. Pre-0036 defects and the forward upgrade.
// -------------------------------------------------------------------------
function historicalFunction(sql, header) {
  const start = sql.indexOf(header);
  assert.ok(start > -1, `historical function ${header} not found`);
  const terminator = 'END;$$;';
  return sql.slice(start, sql.indexOf(terminator, start) + terminator.length)
    .replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');
}

async function verifyPre0036DefectsAndUpgrade() {
  stage = 'pre-0036 reproduction and upgrade';
  await q('SAVEPOINT upgrade');
  await identity('postgres');
  // Reconstruct the exact canonical pre-0036 surface: migration 0033's
  // persistence command, the legacy authenticated transition RPC, and none of
  // the 0036 objects.
  await q(historicalFunction(generationSql, 'CREATE FUNCTION public.persist_post_response_hypothesis_generation_v1(p_execution_id uuid)'));
  await q(`DROP FUNCTION ${V2}`);
  await q(`DROP FUNCTION ${CORE}`);
  await q(`DROP TABLE ${AUDIT_TABLE}`);
  await q(`DROP FUNCTION ${POLICY}`);
  await q(`GRANT EXECUTE ON FUNCTION ${LEGACY} TO authenticated`);

  // Defect A: the legacy RPC is last-writer-wins and unaudited. A caller that
  // read version 1 still transitions a row another mutation already advanced,
  // and no durable lifecycle record exists anywhere.
  const legacyId = randomUUID();
  await identity('service_role');
  await rows(CREATE_CALL, [userId, legacyId, 'legacy lifecycle target', 'CAUSAL', 'GENERAL', 'legacy scope', 'HUMAN_REVIEWED', [], []]);
  await identity('authenticated', userId);
  const readVersion = 1;
  const [advanced] = await rows(ATTACH_CALL, [legacyId, evidence.first, 'SUPPORTING']);
  assert.equal(advanced.version, readVersion + 1, 'pre-0036: another mutation advanced the row');
  const [blind] = await rows(LEGACY_CALL, [legacyId, 'ACTIVE']);
  assert.equal(blind.status, 'ACTIVE', 'pre-0036 defect A: the stale caller still transitioned the newer row');
  assert.equal(blind.version, readVersion + 2, 'pre-0036 defect A: it transitioned a version the caller never read');
  await identity('postgres');
  assert.equal(
    (await one("SELECT to_regclass('public.hypothesis_lifecycle_transitions') present")).present, null,
    'pre-0036 defect A: no lifecycle audit exists at all',
  );

  // Defect B: a successfully persisted canonical SYSTEM_GENERATED Hypothesis is
  // stranded in CANDIDATE, so its Confidence receipt would freeze a Candidate
  // version that any later admission immediately invalidates.
  const legacyGeneration = await newGeneration(1);
  const [strandedId] = legacyGeneration.hypothesisIds;
  await identity('service_role');
  assert.equal((await one(PERSIST, [legacyGeneration.execution.id])).ok, true);
  await identity('postgres');
  assert.equal((await one(HYPOTHESIS, [strandedId])).status, 'CANDIDATE',
    'pre-0036 defect B: the persisted generated Hypothesis stays CANDIDATE');
  assert.equal((await one(EFFECT, [legacyGeneration.execution.id, 'HYPOTHESIS_PERSISTENCE'])).result_code, 'HYPOTHESES_PERSISTED');

  // Capture the exact pre-upgrade history, then apply migration 0036 itself.
  const historyIds = [legacyId, strandedId];
  const before = await rows('SELECT to_jsonb(h) row FROM public.hypotheses h WHERE id=ANY($1) ORDER BY id', [historyIds]);
  const { total: totalBefore } = await one('SELECT count(*)::int total FROM public.hypotheses');
  await q(migrationSql.replace(/^\s*BEGIN;/mu, '').replace(/^\s*COMMIT;\s*$/mu, ''));

  // The upgrade rewrites nothing, deletes nothing, backfills no lifecycle state
  // and fabricates no audit history.
  assert.deepEqual(
    await rows('SELECT to_jsonb(h) row FROM public.hypotheses h WHERE id=ANY($1) ORDER BY id', [historyIds]),
    before, 'the upgrade leaves pre-0036 Hypothesis rows byte-identical',
  );
  assert.equal((await one('SELECT count(*)::int total FROM public.hypotheses')).total, totalBefore, 'the upgrade deletes nothing');
  assert.equal((await one(HYPOTHESIS, [strandedId])).status, 'CANDIDATE',
    'no historical CANDIDATE row is backfilled or reinterpreted');
  assert.equal((await one(AUDIT_TOTAL)).total, 0, 'the upgrade fabricates no lifecycle audit history');

  // The hardened final state is reached from the upgraded database too, and new
  // transitions use the exact-version boundary.
  await verifySurfaceAndAcls();
  stage = 'pre-0036 reproduction and upgrade';
  await identity('authenticated', userId);
  await rejected(() => q(LEGACY_CALL, [strandedId, 'ACTIVE']), ['42501']);
  await rejected(() => q(V2_CALL, [strandedId, 1, 'ACTIVE']), ['40001']);
  await identity('postgres');
  const { version: current } = await one('SELECT version FROM public.hypotheses WHERE id=$1', [strandedId]);
  await identity('authenticated', userId);
  const [upgraded] = await rows(V2_CALL, [strandedId, current, 'ACTIVE']);
  assert.equal(upgraded.status, 'ACTIVE');
  assert.equal(upgraded.version, current + 1);
  await identity('postgres');
  const upgradedAudit = await rows(AUDIT, [strandedId]);
  assert.equal(upgradedAudit.length, 1, 'the first post-upgrade transition is audited exactly once');
  assert.equal(upgradedAudit[0].source, 'AUTHENTICATED_TRANSITION');
  assert.equal(upgradedAudit[0].before_version, current);

  await identity('postgres');
  await q('ROLLBACK TO SAVEPOINT upgrade');
  await q('RELEASE SAVEPOINT upgrade');
}

async function main() {
  try {
    await client.connect();
    await q('BEGIN');
    await identity('postgres');
    await q('INSERT INTO public.users(id,auth_subject) VALUES($1::uuid,$1::text),($2::uuid,$2::text)', [userId, otherUserId]);
    await q(
      `INSERT INTO public.memories(id,user_id,type,content,source,confidence,importance,status) VALUES
        ($1,$3,'GOAL','lifecycle completion fixture evidence one','USER_STATED',1,1,'ACTIVE'),
        ($2,$3,'GOAL','lifecycle completion fixture evidence two','USER_CONFIRMED',1,1,'ACTIVE')`,
      [memories.first, memories.second, userId],
    );

    // Bounded verifier-only faults. Both are plain transaction-local settings
    // read by temporary triggers; nothing in the canonical runtime knows they
    // exist, and both are rolled back with every other fixture.
    //
    // 1. A forced lifecycle-audit INSERT failure, used to prove the mutation
    //    and the audit share one transaction, and that a generated activation
    //    failure rolls the entire persistence back.
    await q(`CREATE FUNCTION public.qandeel_verifier_lifecycle_audit_fault_v1() RETURNS trigger
      LANGUAGE plpgsql SET search_path='' AS $$
      BEGIN
        IF nullif(current_setting('${AUDIT_FAULT}', true),'') IS NOT NULL
           AND NEW.hypothesis_id = nullif(current_setting('${AUDIT_FAULT}', true),'')::uuid
        THEN RAISE EXCEPTION 'VERIFIER_FORCED_LIFECYCLE_AUDIT_FAULT' USING ERRCODE='P0001'; END IF;
        RETURN NEW;
      END;$$`);
    await q(`CREATE TRIGGER qandeel_verifier_lifecycle_audit_fault BEFORE INSERT ON ${AUDIT_TABLE}
      FOR EACH ROW EXECUTE FUNCTION public.qandeel_verifier_lifecycle_audit_fault_v1()`);
    // 2. An ordering guard. While armed it refuses any HYPOTHESIS_PERSISTENCE
    //    completion whose own durable targets are not ALL already ACTIVE, so a
    //    persistence that completes with it armed has proven that activation
    //    happened before durable completion - not after it.
    await q(`CREATE FUNCTION public.qandeel_verifier_lifecycle_order_guard_v1() RETURNS trigger
      LANGUAGE plpgsql SET search_path='' AS $$
      BEGIN
        IF nullif(current_setting('${ORDER_GUARD}', true),'') IS NOT NULL
           AND NEW.effect_key='HYPOTHESIS_PERSISTENCE' AND NEW.state='COMPLETED'
           AND NEW.result_code='HYPOTHESES_PERSISTED' AND NEW.result_payload IS NOT NULL
           AND EXISTS(
             SELECT 1 FROM jsonb_array_elements(NEW.result_payload) AS entry(value)
               JOIN public.hypotheses target ON target.id=(entry.value#>>'{}')::uuid
              WHERE target.status<>'ACTIVE')
        THEN RAISE EXCEPTION 'VERIFIER_ACTIVATION_ORDER_VIOLATION' USING ERRCODE='P0001'; END IF;
        RETURN NEW;
      END;$$`);
    await q(`CREATE TRIGGER qandeel_verifier_lifecycle_order_guard BEFORE UPDATE ON public.post_response_intelligence_effects
      FOR EACH ROW EXECUTE FUNCTION public.qandeel_verifier_lifecycle_order_guard_v1()`);
    await armAuditFault(null);
    await armOrderGuard(false);

    await verifySurfaceAndAcls();
    await verifyGraphPolicy();
    await verifyEveryEdge();
    await verifyExactVersion();
    await verifyAuthority();
    await verifyAuditInvariants();
    await verifyGeneratedActivation();
    await verifyActivationRollback();
    await verifyPre0036DefectsAndUpgrade();

    // No audit row exists without a matching owned Hypothesis.
    await identity('postgres');
    assert.deepEqual(
      await rows(
        `SELECT audit.id FROM ${AUDIT_TABLE} audit
          LEFT JOIN public.hypotheses h ON h.id=audit.hypothesis_id AND h.user_id=audit.user_id
          WHERE h.id IS NULL`,
      ),
      [], 'every lifecycle audit row belongs to an owned Hypothesis',
    );

    console.log('Verified migration 0036: the canonical lifecycle vocabulary and graph are frozen and stated identically by the internal IMMUTABLE policy primitive, the immutable audit edge constraint and the live transition boundary - every allowed edge succeeds with exactly one version increment and exactly one exact audit row, and every forbidden edge, self-transition and non-canonical status fails closed with no mutation and no audit; the exact expected version is authoritative, a stale expected version fails closed with the canonical 40001 semantics and never transitions the newer row, and a real interleaving mutation makes the owner read stale instead of silently moving an unseen Hypothesis; the owner is derived from auth.uid() alone, no caller can supply an owner, a source, a before/after version or any audit metadata, the internal transition core and the lifecycle policy are executable by no application role, the legacy migration-0005 transition RPC is executable by PUBLIC, anon, authenticated and service_role not at all, and the immutable audit accepts no direct DML from any application role while owner-scoped reads stay tenant-isolated; audit invariants reject a forbidden edge, a non-canonical status, broken version arithmetic, an out-of-vocabulary source, a cross-owner row and a duplicate identity, and a forced audit failure rolls the status and version mutation back with it; the canonical SYSTEM_GENERATED batch is built as CANDIDATE and admitted CANDIDATE -> ACTIVE inside the SAME atomic persistence transaction with exactly one activation audit row and exactly one version increment per target, provably BEFORE the persistence effect can complete, a durable retry duplicates nothing, NO_ACCEPTED_CANDIDATES writes no audit, and an activation failure rolls back the entire generated graph, every activation, every audit row and the completion with no false success; and the upgrade from a reconstructed pre-0036 database - which really did allow an unaudited last-writer-wins transition and really did strand a persisted generated Hypothesis in CANDIDATE - leaves every historical row byte-identical, backfills no lifecycle state and fabricates no audit history.');
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Hypothesis lifecycle completion verification failed at ${stage} (${code}): ${error?.message ?? 'unknown assertion'}. Connection details were suppressed.`);
  process.exitCode = 1;
});
