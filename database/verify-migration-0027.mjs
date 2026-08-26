// Hypothesis Authority Hardening (migration 0027) adversarial verifier.
//
// Runs against a fully migrated database. It first reconstructs the pre-0027
// permissive authority inside a rolled-back savepoint to prove the creation
// forgery vulnerability was real, then proves - against the live hardened state
// - that an authenticated client can no longer create a Hypothesis directly and
// cannot forge origin / status / version / Evidence / competitor / timestamp
// authority; that anonymous callers have no authority at all; that the server
// REST role holds no direct table DML; that the narrow server creation command
// is service-role only and forces every canonical value; that the pre-existing
// constrained evidence / competition / update commands and the
// migration-0021 background commands still behave exactly as before; that the
// lifecycle graph, version increment and cross-tenant behaviour are preserved
// exactly on migration 0036's exact-version transition boundary while the
// legacy transition RPC is executable by no application role at all; that no
// alternative end-user-reachable creation surface exists; and that upgrading a
// pre-0027 database leaves existing Hypothesis rows byte-identical. Every
// fixture is rolled back; no data is retained.
//
// Role discipline: the server REST role holds EXECUTE on the definer commands
// but is an ordinary RLS-bound role in this environment, so every direct row
// assertion is made as the migration owner and the server role is used only to
// invoke commands and to demonstrate that its direct SELECT is permitted.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const migrationSql = await readFile(new URL('./migrations/0027_hypothesis_authority_hardening_v1.sql', import.meta.url), 'utf8');
const client = new Client({ connectionString: process.env.DATABASE_URL });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

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
}

// Reads rows as the migration owner, then restores the previous identity.
async function readAsOwner(text, values, role, uid = null) {
  await identity('postgres');
  const result = await rows(text, values);
  await identity(role, uid);
  return result;
}

const CREATE = 'public.server_create_hypothesis_v1(uuid,uuid,text,text,text,text,text,text[],text[])';
const GUARD = 'public.assert_canonical_hypothesis_text_array_v1(text[],integer,integer)';
const BACKGROUND_CREATE = 'public.background_create_system_hypothesis_v1(uuid,uuid,text,text,text,text,text[],text[])';
const TRANSITION = 'public.transition_hypothesis(uuid,text)';
// Migration 0036 replaced the operational transition path with an exact-version,
// audited boundary and revoked the legacy function's application authority. The
// live hardened state asserted below therefore includes the 0036 surface.
const TRANSITION_V2 = 'public.transition_hypothesis_v2(uuid,integer,text)';
const TRANSITION_CORE = 'public.transition_hypothesis_core_v1(uuid,uuid,integer,text,text)';
const ATTACH = 'public.attach_hypothesis_evidence(uuid,text,text)';
const LINK = 'public.link_competing_hypotheses(uuid,uuid)';
const UPDATE_LOOP = 'public.apply_hypothesis_evidence_update(uuid,uuid,integer,text,text)';

const CREATE_CALL = 'SELECT * FROM public.server_create_hypothesis_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)';
const BACKGROUND_CREATE_CALL = 'SELECT * FROM public.background_create_system_hypothesis_v1($1,$2,$3,$4,$5,$6,$7,$8)';
const TRANSITION_CALL = 'SELECT * FROM public.transition_hypothesis($1,$2)';
const TRANSITION_V2_CALL = 'SELECT * FROM public.transition_hypothesis_v2($1,$2,$3)';
const ATTACH_CALL = 'SELECT * FROM public.attach_hypothesis_evidence($1,$2,$3)';
const LINK_CALL = 'SELECT * FROM public.link_competing_hypotheses($1,$2)';
const UPDATE_LOOP_CALL = 'SELECT * FROM public.apply_hypothesis_evidence_update($1,$2,$3,$4,$5)';

// The canonical background read shape used by BackgroundIntelligenceDataApiService.
const ACTIVE_READ = `SELECT id FROM public.hypotheses
  WHERE user_id=$1 AND status IN ('CANDIDATE','ACTIVE','SUPPORTED','MIXED','WEAK','REOPENED')
  ORDER BY updated_at DESC, id ASC LIMIT 32`;

const createArgs = (user, id, overrides = {}) => {
  const shape = {
    statement: 'Time pressure contributes to indecision.', type: 'CAUSAL', domain: 'DECISION',
    scope: 'Current work decision', origin: 'SYSTEM_GENERATED',
    assumptions: ['The deadline remains relevant.'], disconfirmingConditions: ['Indecision persists without a deadline.'],
    ...overrides,
  };
  return [user, id, shape.statement, shape.type, shape.domain, shape.scope, shape.origin, shape.assumptions, shape.disconfirmingConditions];
};

async function verifyEffectiveAcls() {
  stage = 'effective ACLs';
  const priv = [
    // Owner-scoped reads survive for Hypothesis retrieval, reasoning context and Confidence.
    ['authenticated', 'SELECT', true],
    ['authenticated', 'INSERT', false],
    ['authenticated', 'UPDATE', false],
    ['authenticated', 'DELETE', false],
    ['anon', 'SELECT', false], ['anon', 'INSERT', false], ['anon', 'UPDATE', false], ['anon', 'DELETE', false],
    // The server REST role reads for background intelligence but cannot mutate
    // the table directly; its writes must go through the definer commands.
    ['service_role', 'SELECT', true],
    ['service_role', 'INSERT', false],
    ['service_role', 'UPDATE', false],
    ['service_role', 'DELETE', false],
  ];
  for (const [role, p, expected] of priv) {
    const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, 'public.hypotheses', p]);
    assert.equal(allowed, expected, `${role} ${p} on public.hypotheses`);
  }
  const fn = [
    // The new creation command is server-only.
    ['authenticated', CREATE, false], ['anon', CREATE, false], ['service_role', CREATE, true],
    ['authenticated', GUARD, false], ['anon', GUARD, false], ['service_role', GUARD, false],
    // The migration-0021 background creation command stays server-only.
    ['authenticated', BACKGROUND_CREATE, false], ['anon', BACKGROUND_CREATE, false], ['service_role', BACKGROUND_CREATE, true],
    // The pre-existing constrained mutation commands keep exactly the authority
    // migrations 0005 and 0008 gave them: this task widened nothing. The one
    // later change is migration 0036, which revoked the legacy transition RPC's
    // application authority in favour of the exact-version audited boundary -
    // the legacy function is no longer executable by ANY application role, and
    // the internal transition core is executable by none of them either.
    ['authenticated', TRANSITION, false], ['anon', TRANSITION, false], ['service_role', TRANSITION, false],
    ['authenticated', TRANSITION_V2, true], ['anon', TRANSITION_V2, false], ['service_role', TRANSITION_V2, false],
    ['authenticated', TRANSITION_CORE, false], ['anon', TRANSITION_CORE, false], ['service_role', TRANSITION_CORE, false],
    ['authenticated', ATTACH, true], ['anon', ATTACH, false],
    ['authenticated', LINK, true], ['anon', LINK, false],
    ['authenticated', UPDATE_LOOP, true], ['anon', UPDATE_LOOP, false],
  ];
  for (const [role, signature, expected] of fn) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed', [role, signature, 'EXECUTE']);
    assert.equal(allowed, expected, `${role} EXECUTE ${signature}`);
  }
  // Deterministic statement of the creation-command contract. PUBLIC is grantee
  // 0 and has no has_function_privilege spelling, so the ACL is read directly.
  assert.deepEqual(await executeGrantees(CREATE), ['postgres', 'service_role'], 'server creation EXECUTE holders');
  assert.deepEqual(await executeGrantees(GUARD), ['postgres'], 'shape guard EXECUTE holders');
  assert.deepEqual(await executeGrantees(BACKGROUND_CREATE), ['postgres', 'service_role'], 'background creation EXECUTE holders');

  const policies = (await rows(
    "SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='hypotheses' ORDER BY policyname",
  )).map((r) => r.policyname);
  assert.deepEqual(policies, ['hypotheses_select_own'], 'only the owner read policy survives on hypotheses');
  const [{ rls }] = await rows("SELECT relrowsecurity rls FROM pg_class WHERE oid='public.hypotheses'::regclass");
  assert.equal(rls, true, 'row level security stays enabled');

  const [{ owner, definer, config }] = await rows(
    'SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config FROM pg_proc p WHERE p.oid=$1::regprocedure',
    [CREATE],
  );
  assert.equal(owner, 'postgres', 'creation command owner');
  assert.equal(definer, true, 'creation command is SECURITY DEFINER');
  assert.ok(Array.isArray(config) && config.length === 1 && config[0].startsWith('search_path='), 'hardened search_path');

  // 41. The command exposes no parameter capable of setting status, version,
  // Evidence, competitors or timestamps.
  const [{ args }] = await rows('SELECT pg_get_function_arguments($1::regprocedure) args', [CREATE]);
  assert.deepEqual(args.split(',').map((part) => part.trim()), [
    'p_user_id uuid', 'p_hypothesis_id uuid', 'p_statement text', 'p_type text', 'p_domain text',
    'p_scope text', 'p_origin text', 'p_assumptions text[]', 'p_disconfirming_conditions text[]',
  ], 'server creation parameter surface');
  assert.doesNotMatch(args, /status|version|supporting|contradicting|competing|evidence|created_at|updated_at/iu);
}

// 49 / section 10. Every function that can create a Hypothesis row, and every
// function reachable by an end-user role that mutates the table, by name. This
// is an explicit allowlist over effective ACLs rather than a single regex over
// one migration's text.
async function verifyCreationSurface() {
  stage = 'Hypothesis creation surface';
  await identity('postgres');
  const returning = (await rows(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prorettype='public.hypotheses'::regtype ORDER BY p.proname`,
  )).map((r) => r.proname);
  assert.deepEqual(returning, [
    'attach_hypothesis_evidence', 'background_attach_hypothesis_evidence_v1',
    'background_create_system_hypothesis_v1', 'background_link_competing_hypotheses_v1',
    'link_competing_hypotheses', 'server_create_hypothesis_v1', 'transition_hypothesis',
    // Migration 0036's exact-version lifecycle boundary: the internal core and
    // its single authenticated wrapper. Neither creates a Hypothesis row.
    'transition_hypothesis_core_v1', 'transition_hypothesis_v2',
  ], 'Hypothesis command surface');

  const creators = (await rows(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f'
        AND pg_get_functiondef(p.oid) ~* 'INSERT INTO[[:space:]]+public\\.hypotheses'
      ORDER BY p.proname`,
  )).map((r) => r.proname);
  assert.deepEqual(creators, ['background_create_system_hypothesis_v1', 'server_create_hypothesis_v1'],
    'exactly two Hypothesis creation functions exist');
  for (const name of creators) {
    for (const role of ['authenticated', 'anon']) {
      const [{ allowed }] = await rows(
        `SELECT bool_or(has_function_privilege($2, p.oid, 'EXECUTE')) allowed FROM pg_proc p
           JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=$1`,
        [name, role],
      );
      assert.equal(allowed, false, `${role} cannot execute ${name}`);
    }
  }
  // Decisive check: no function reachable by an end-user role creates a
  // Hypothesis row through any route.
  const reachable = (await rows(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f'
        AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
          OR has_function_privilege('anon', p.oid, 'EXECUTE'))
        AND pg_get_functiondef(p.oid) ~* 'INSERT INTO[[:space:]]+public\\.hypotheses'
      ORDER BY p.proname`,
  )).map((r) => r.proname);
  assert.deepEqual(reachable, [], 'no end-user-executable function creates a Hypothesis');
}

async function executeGrantees(signature) {
  return (await rows(
    `SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee
       FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      WHERE p.oid=$1::regprocedure AND a.privilege_type='EXECUTE'
      ORDER BY 1`, [signature],
  )).map((r) => r.grantee);
}

// Recreates the authority migration 0005 granted and 0027 removes. The server
// REST role is given direct table DML as well: a Supabase installation may carry
// explicit or default table grants for it, and the hardened contract must hold
// from that starting state too rather than depending on the clean CI database's
// initial ACL.
async function restorePreHardeningAuthority() {
  await identity('postgres');
  await q('GRANT INSERT ON public.hypotheses TO authenticated');
  await q('CREATE POLICY hypotheses_insert_own ON public.hypotheses FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()))');
  await q('GRANT SELECT, INSERT, UPDATE, DELETE ON public.hypotheses TO service_role');
}

// A. Prove the vulnerability was real, not merely asserted from migration text.
async function reproduceBaselineVulnerability(owner) {
  stage = 'baseline vulnerability reconstruction';
  await q('SAVEPOINT baseline');
  await restorePreHardeningAuthority();

  await identity('authenticated', owner);
  const forged = randomUUID(), competitor = randomUUID();
  const supporting = [`memory:${randomUUID()}`, `memory:${randomUUID()}`];
  const contradicting = [`memory:${randomUUID()}`];
  // Exploit: manufacture an apparently canonical Hypothesis with a caller-chosen
  // origin, status, version, Evidence roles, competitors and timestamps.
  await q(
    `INSERT INTO public.hypotheses(
       id,user_id,statement,type,domain,scope,origin,status,version,
       supporting_evidence_ids,contradicting_evidence_ids,competing_hypothesis_ids,
       assumptions,disconfirming_conditions,created_at,updated_at)
     VALUES($1,$2,'Forged authoritative claim','CAUSAL','DECISION','forged scope','ADMIN_CONTROLLED','SUPPORTED',42,
       $3,$4,ARRAY[$5]::uuid[],ARRAY['forged assumption'],ARRAY['forged disconfirmation'],
       CURRENT_TIMESTAMP - interval '5 years', CURRENT_TIMESTAMP - interval '5 years')`,
    [forged, owner, supporting, contradicting, competitor],
  );
  const [row] = await rows('SELECT * FROM public.hypotheses WHERE id=$1', [forged]);
  assert.equal(row.origin, 'ADMIN_CONTROLLED', 'baseline: client forged ADMIN_CONTROLLED provenance');
  assert.equal(row.status, 'SUPPORTED', 'baseline: client forged a non-CANDIDATE status');
  assert.equal(row.version, 42, 'baseline: client forged an authoritative version');
  assert.deepEqual(row.supporting_evidence_ids, supporting, 'baseline: client chose supporting Evidence');
  assert.deepEqual(row.contradicting_evidence_ids, contradicting, 'baseline: client chose contradicting Evidence');
  assert.deepEqual(row.competing_hypothesis_ids, [competitor], 'baseline: client chose competitors');
  assert.ok(row.created_at < new Date(Date.now() - 86_400_000), 'baseline: client backdated the lifecycle timestamps');
  // Exploit: SYSTEM_GENERATED provenance was equally reachable.
  const systemForged = randomUUID();
  await q(
    `INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,status)
     VALUES($1,$2,'Forged system claim','CAUSAL','GENERAL','forged scope','SYSTEM_GENERATED','ACTIVE')`,
    [systemForged, owner],
  );
  // Exploit: the forged row is indistinguishable to the canonical active read
  // that feeds reasoning context, association and Confidence.
  const active = (await rows(ACTIVE_READ, [owner])).map((r) => r.id);
  assert.ok(active.includes(forged) && active.includes(systemForged), 'baseline: forged Hypotheses reach the canonical active read');

  await identity('postgres');
  await q('ROLLBACK TO SAVEPOINT baseline');
  await q('RELEASE SAVEPOINT baseline');
}

// B. 1-15.
async function verifyAuthenticatedAttacks(owner, other, ownedHypothesis, otherHypothesis) {
  stage = 'authenticated direct attacks';
  await identity('authenticated', owner);
  // 1. The owner still reads its own Hypothesis. 2. Cross-tenant read is denied.
  assert.deepEqual((await rows('SELECT id FROM public.hypotheses ORDER BY id')).map((r) => r.id), [ownedHypothesis]);
  assert.equal((await rows('SELECT id FROM public.hypotheses WHERE id=$1', [otherHypothesis])).length, 0);

  // 3-6. A plain CANDIDATE insert fails, and so does every forged origin.
  const insertOrigin = (origin, status = 'CANDIDATE') => () => q(
    `INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,status)
      VALUES($1,$2,'attack','CAUSAL','GENERAL','attack scope',$3,$4)`,
    [randomUUID(), owner, origin, status],
  );
  await rejected(insertOrigin('USER_PROPOSED'));
  await rejected(insertOrigin('SYSTEM_GENERATED'));
  await rejected(insertOrigin('ADMIN_CONTROLLED'));
  await rejected(insertOrigin('HUMAN_REVIEWED'));
  // 7. Non-CANDIDATE status. 8. Arbitrary version.
  await rejected(insertOrigin('SYSTEM_GENERATED', 'SUPPORTED'));
  await rejected(() => q(
    `INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,status,version)
      VALUES($1,$2,'attack','CAUSAL','GENERAL','attack scope','SYSTEM_GENERATED','ACTIVE',99)`,
    [randomUUID(), owner],
  ));
  // 9. Supporting Evidence. 10. Contradicting Evidence. 11. Competitors.
  await rejected(() => q(
    `INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,supporting_evidence_ids)
      VALUES($1,$2,'attack','CAUSAL','GENERAL','attack scope','SYSTEM_GENERATED',$3)`,
    [randomUUID(), owner, [`memory:${randomUUID()}`]],
  ));
  await rejected(() => q(
    `INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,contradicting_evidence_ids)
      VALUES($1,$2,'attack','CAUSAL','GENERAL','attack scope','SYSTEM_GENERATED',$3)`,
    [randomUUID(), owner, [`memory:${randomUUID()}`]],
  ));
  await rejected(() => q(
    `INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,competing_hypothesis_ids)
      VALUES($1,$2,'attack','CAUSAL','GENERAL','attack scope','SYSTEM_GENERATED',ARRAY[$3]::uuid[])`,
    [randomUUID(), owner, ownedHypothesis],
  ));
  // 12. Caller-chosen timestamps, and a fully server-shaped row.
  await rejected(() => q(
    `INSERT INTO public.hypotheses(
       id,user_id,statement,type,domain,scope,origin,status,version,
       supporting_evidence_ids,contradicting_evidence_ids,competing_hypothesis_ids,
       assumptions,disconfirming_conditions,created_at,updated_at)
     VALUES($1,$2,'attack','CAUSAL','GENERAL','attack scope','ADMIN_CONTROLLED','SUPPORTED',7,
       '{}','{}','{}','{}','{}',CURRENT_TIMESTAMP - interval '1 year',CURRENT_TIMESTAMP)`,
    [randomUUID(), owner],
  ));
  // Cross-tenant creation is denied for the same reason - no INSERT at all.
  await rejected(() => q(
    `INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin)
      VALUES($1,$2,'attack','CAUSAL','GENERAL','attack scope','SYSTEM_GENERATED')`,
    [randomUUID(), other],
  ));

  // 13. Direct UPDATE remains unavailable for every authoritative field.
  for (const patch of [
    "origin='ADMIN_CONTROLLED'", "origin='SYSTEM_GENERATED'", "status='SUPPORTED'", "status='ACTIVE'",
    'version=99', "statement='rewritten'", "scope='rewritten'", "type='STRATEGIC'", "domain='WORK'",
    'supporting_evidence_ids=\'{}\'', 'contradicting_evidence_ids=\'{}\'', 'competing_hypothesis_ids=\'{}\'',
    "assumptions='{}'", "disconfirming_conditions='{}'",
    'created_at=CURRENT_TIMESTAMP', 'updated_at=CURRENT_TIMESTAMP', 'user_id=user_id',
  ]) await rejected(() => q(`UPDATE public.hypotheses SET ${patch} WHERE id=$1`, [ownedHypothesis]));

  // 14. Direct DELETE remains unavailable, scoped and unscoped.
  await rejected(() => q('DELETE FROM public.hypotheses WHERE id=$1', [ownedHypothesis]));
  await rejected(() => q('DELETE FROM public.hypotheses'));

  // 15. The server creation command is not executable by an authenticated
  // client, for its own tenant or for another one, and neither is its guard.
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID())));
  await rejected(() => q(CREATE_CALL, createArgs(other, randomUUID())));
  await rejected(() => q('SELECT public.assert_canonical_hypothesis_text_array_v1($1,8,500)', [['x']]));
  // Nor is the migration-0021 background creation command.
  await rejected(() => q(BACKGROUND_CREATE_CALL, [owner, randomUUID(), 'attack', 'CAUSAL', 'GENERAL', 'scope', [], []]));
  await identity('authenticated', other);
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID())));

  // Nothing above changed the target row.
  const [after] = await readAsOwner(
    'SELECT origin,status,version FROM public.hypotheses WHERE id=$1', [ownedHypothesis], 'authenticated', other,
  );
  assert.deepEqual(after, { origin: 'ADMIN_CONTROLLED', status: 'SUPPORTED', version: 9 });
}

// C.
async function verifyAnonymousAttacks(owner, ownedHypothesis) {
  stage = 'anonymous attacks';
  await identity('anon');
  await rejected(() => q('SELECT id FROM public.hypotheses'));
  await rejected(() => q(
    `INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin)
      VALUES($1,$2,'anon','CAUSAL','GENERAL','anon scope','SYSTEM_GENERATED')`,
    [randomUUID(), owner],
  ));
  await rejected(() => q("UPDATE public.hypotheses SET status='SUPPORTED' WHERE id=$1", [ownedHypothesis]));
  await rejected(() => q('DELETE FROM public.hypotheses WHERE id=$1', [ownedHypothesis]));
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID())));
  await rejected(() => q(BACKGROUND_CREATE_CALL, [owner, randomUUID(), 'anon', 'CAUSAL', 'GENERAL', 'scope', [], []]));
  await rejected(() => q(TRANSITION_CALL, [ownedHypothesis, 'ACTIVE']));
  await rejected(() => q(TRANSITION_V2_CALL, [ownedHypothesis, 1, 'ACTIVE']));
}

// E. 16-41.
async function verifyServerCreate(owner, other, transactionTimestamp) {
  stage = 'server-authoritative creation';
  await identity('service_role');
  const id = randomUUID();
  // 16-20. Legitimate creation succeeds, keeps the supplied canonical identity
  // and preserves the trusted internal semantics after canonical normalization.
  const [created] = await rows(CREATE_CALL, createArgs(owner, id, {
    statement: '  Time pressure contributes to indecision.  ',
    scope: '  Current work decision  ',
    origin: 'ADMIN_CONTROLLED',
    assumptions: ['  The deadline remains relevant.  ', 'Priorities are stable.'],
    disconfirmingConditions: ['Indecision persists without a deadline.'],
  }));
  assert.equal(created.id, id, 'canonical Hypothesis UUID round-trips unchanged');
  assert.equal(created.user_id, owner);
  assert.equal(created.statement, 'Time pressure contributes to indecision.');
  assert.equal(created.type, 'CAUSAL');
  assert.equal(created.domain, 'DECISION');
  assert.equal(created.scope, 'Current work decision');
  // Trusted internal origin vocabulary stays supported without being reachable
  // from an authenticated direct write.
  assert.equal(created.origin, 'ADMIN_CONTROLLED');
  assert.deepEqual(created.assumptions, ['The deadline remains relevant.', 'Priorities are stable.']);
  assert.deepEqual(created.disconfirming_conditions, ['Indecision persists without a deadline.']);
  // 21-26. Every authoritative column is derived, whatever the caller asked for.
  assert.equal(created.status, 'CANDIDATE');
  assert.equal(created.version, 1);
  assert.deepEqual(created.supporting_evidence_ids, []);
  assert.deepEqual(created.contradicting_evidence_ids, []);
  assert.deepEqual(created.competing_hypothesis_ids, []);
  assert.deepEqual(created.created_at, transactionTimestamp, 'created_at is database-derived');
  assert.deepEqual(created.updated_at, transactionTimestamp, 'updated_at is database-derived');

  // Every canonical origin remains available to trusted internal creation and
  // always yields a CANDIDATE at version 1.
  for (const origin of ['SYSTEM_GENERATED', 'HUMAN_REVIEWED', 'USER_PROPOSED', 'ADMIN_CONTROLLED']) {
    const [row] = await rows(CREATE_CALL, createArgs(owner, randomUUID(), { origin, statement: `origin ${origin}` }));
    assert.equal(row.origin, origin);
    assert.equal(row.status, 'CANDIDATE');
    assert.equal(row.version, 1);
  }

  // 27-29. Identity failures fail closed.
  await rejected(() => q(CREATE_CALL, createArgs(randomUUID(), randomUUID())), ['42501']);
  await rejected(() => q(CREATE_CALL, createArgs(null, randomUUID())), ['22023']);
  await rejected(() => q(CREATE_CALL, createArgs(owner, null)), ['22023']);
  await rejected(() => q(CREATE_CALL, createArgs(owner, 'not-a-uuid')), ['22P02']);
  await rejected(() => q(CREATE_CALL, createArgs('not-a-uuid', randomUUID())), ['22P02']);

  // 30-39. Vocabulary and bounds fail closed.
  const invalid = [
    { type: 'FACT' }, { type: null }, { domain: 'HEALTH' }, { domain: null },
    { origin: 'MODEL' }, { origin: null },
    { statement: '   ' }, { statement: null }, { statement: 'x'.repeat(2001) },
    { scope: '   ' }, { scope: null }, { scope: 'x'.repeat(501) },
    { assumptions: Array.from({ length: 9 }, (_, index) => `assumption ${index}`) },
    { assumptions: ['   '] }, { assumptions: ['x'.repeat(501)] }, { assumptions: [null] },
    { assumptions: ['same', '  same  '] }, { assumptions: null },
    { disconfirmingConditions: Array.from({ length: 9 }, (_, index) => `condition ${index}`) },
    { disconfirmingConditions: ['   '] }, { disconfirmingConditions: ['x'.repeat(501)] },
    { disconfirmingConditions: [null] }, { disconfirmingConditions: ['same', 'same'] },
    { disconfirmingConditions: null },
  ];
  for (const overrides of invalid) {
    await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID(), overrides)), ['22023']);
  }

  // 40. A duplicate identifier fails atomically, for the same tenant and for
  // another one - so an id can never be replayed to transfer ownership.
  await rejected(() => q(CREATE_CALL, createArgs(owner, id, { statement: 'duplicate' })), ['23505']);
  await rejected(() => q(CREATE_CALL, createArgs(other, id, { statement: 'duplicate' })), ['23505']);
  const [survivor] = await readAsOwner('SELECT statement,user_id FROM public.hypotheses WHERE id=$1', [id], 'service_role');
  assert.deepEqual(survivor, { statement: 'Time pressure contributes to indecision.', user_id: owner },
    'a rejected duplicate leaves the original row untouched');
  return id;
}

// F. 42-48.
async function verifyExistingRuntimeRegression(owner, other, evidenceMemory, ineligibleMemory) {
  stage = 'existing mutation and background runtime regression';
  await identity('service_role');
  const lifecycle = randomUUID(), attachTarget = randomUUID(), competitorA = randomUUID(), competitorB = randomUUID(), updateTarget = randomUUID();
  for (const [id, statement] of [
    [lifecycle, 'lifecycle target'], [attachTarget, 'attach target'],
    [competitorA, 'competitor a'], [competitorB, 'competitor b'], [updateTarget, 'update target'],
  ]) await rows(CREATE_CALL, createArgs(owner, id, { statement }));

  // 42. The canonical lifecycle graph is unchanged; only the authority boundary
  // moved. Migration 0036 made transition_hypothesis_v2 the one authenticated
  // path, so the graph, version and cross-tenant behaviour this verifier has
  // always asserted are asserted through it - with the exact expected version -
  // and the legacy RPC is proven unreachable rather than exercised.
  await identity('authenticated', owner);
  await rejected(() => q(TRANSITION_CALL, [lifecycle, 'ACTIVE']), ['42501']);
  const [activated] = await rows(TRANSITION_V2_CALL, [lifecycle, 1, 'ACTIVE']);
  assert.equal(activated.status, 'ACTIVE');
  assert.equal(activated.version, 2, 'transition still bumps the version');
  await rejected(() => q(TRANSITION_V2_CALL, [lifecycle, 2, 'CANDIDATE']), ['22023']);
  await rejected(() => q(TRANSITION_V2_CALL, [lifecycle, 2, 'REOPENED']), ['22023']);
  // A stale expected version fails closed instead of transitioning the newer row.
  await rejected(() => q(TRANSITION_V2_CALL, [lifecycle, 1, 'SUPPORTED']), ['40001']);
  const [supported] = await rows(TRANSITION_V2_CALL, [lifecycle, 2, 'SUPPORTED']);
  assert.equal(supported.status, 'SUPPORTED');
  assert.equal(supported.version, 3);
  // Cross-tenant transition still finds nothing rather than mutating.
  await identity('authenticated', other);
  assert.equal((await rows(TRANSITION_V2_CALL, [lifecycle, 3, 'REJECTED'])).length, 0);
  // The server REST role cannot use either boundary to move a Hypothesis.
  await identity('service_role');
  await rejected(() => q(TRANSITION_CALL, [lifecycle, 'REJECTED']), ['42501']);
  await rejected(() => q(TRANSITION_V2_CALL, [lifecycle, 3, 'REJECTED']), ['42501']);

  // 43. attach_hypothesis_evidence behaviour is unchanged.
  await identity('authenticated', owner);
  const [attached] = await rows(ATTACH_CALL, [attachTarget, `memory:${evidenceMemory}`, 'SUPPORTING']);
  assert.deepEqual(attached.supporting_evidence_ids, [`memory:${evidenceMemory}`]);
  assert.equal(attached.version, 2);
  await rejected(() => q(ATTACH_CALL, [attachTarget, `memory:${evidenceMemory}`, 'CONTRADICTING']), ['22023']);
  await rejected(() => q(ATTACH_CALL, [attachTarget, `memory:${ineligibleMemory}`, 'SUPPORTING']), ['22023']);
  await rejected(() => q(ATTACH_CALL, [attachTarget, 'not-evidence', 'SUPPORTING']), ['22023']);

  // 44. link_competing_hypotheses stays symmetric.
  const [linked] = await rows(LINK_CALL, [competitorA, competitorB]);
  assert.deepEqual(linked.competing_hypothesis_ids, [competitorB]);
  const [mirror] = await readAsOwner(
    'SELECT competing_hypothesis_ids,version FROM public.hypotheses WHERE id=$1', [competitorB], 'authenticated', owner,
  );
  assert.deepEqual(mirror.competing_hypothesis_ids, [competitorA]);
  assert.equal(mirror.version, 2);
  await rejected(() => q(LINK_CALL, [competitorA, competitorB]), ['22023']);

  // 45. apply_hypothesis_evidence_update keeps its authority, audit and
  // bounded-Evidence contract. Migration 0028 moved the bounded projection out
  // of this function's inline CTE into the single canonical membership
  // primitive, and migration 0032 factored the mutation body into the one
  // internal core shared with the server-authorized background wrapper, so
  // each fingerprint is asserted where it now lives.
  const [{ definition }] = await rows('SELECT pg_get_functiondef($1::regprocedure) definition', [UPDATE_LOOP]);
  for (const fingerprint of [/auth\.uid\(\)/u, /apply_hypothesis_evidence_update_core_v1/u]) {
    assert.match(definition, fingerprint, 'hypothesis update loop definition changed');
  }
  const [{ definition: coreDefinition }] = await rows(
    "SELECT pg_get_functiondef(to_regprocedure('public.apply_hypothesis_evidence_update_core_v1(uuid,uuid,uuid,integer,text,text)')) definition",
  );
  for (const fingerprint of [/canonical_eligible_memory_ids_v1/u, /QANDEEL_HYPOTHESIS_UPDATE_LOOP/u, /INSERT INTO public\.hypothesis_updates/u]) {
    assert.match(coreDefinition, fingerprint, 'hypothesis update mutation core definition changed');
  }
  const [{ canonical }] = await rows(
    "SELECT pg_get_functiondef(to_regprocedure('public.canonical_eligible_memory_ids_v1(uuid,timestamptz)')) canonical",
  );
  assert.match(canonical, /LIMIT 64/u, 'the canonical Evidence candidate bound is absent');
  const [applied] = await rows(UPDATE_LOOP_CALL, [randomUUID(), updateTarget, 1, `memory:${evidenceMemory}`, 'SUPPORTING']);
  assert.equal(applied.update.before_version, 1);
  assert.equal(applied.update.after_version, 2);
  assert.deepEqual(applied.hypothesis.supporting_evidence_ids, [`memory:${evidenceMemory}`]);
  await rejected(() => q(UPDATE_LOOP_CALL, [randomUUID(), updateTarget, 1, `memory:${evidenceMemory}`, 'SUPPORTING']), ['40001']);

  // 46/47. The migration-0021 background creation path still works and still
  // produces canonical SYSTEM_GENERATED / CANDIDATE rows.
  await identity('service_role');
  const backgroundId = randomUUID();
  const [background] = await rows(BACKGROUND_CREATE_CALL, [
    owner, backgroundId, 'background statement', 'BEHAVIORAL', 'WORK', 'background scope', ['background assumption'], [],
  ]);
  assert.equal(background.id, backgroundId);
  assert.equal(background.user_id, owner);
  assert.equal(background.origin, 'SYSTEM_GENERATED');
  assert.equal(background.status, 'CANDIDATE');
  assert.equal(background.version, 1);
  const [backgroundAttached] = await rows(
    'SELECT * FROM public.background_attach_hypothesis_evidence_v1($1,$2,$3,$4)',
    [owner, backgroundId, `memory:${evidenceMemory}`, 'SUPPORTING'],
  );
  assert.deepEqual(backgroundAttached.supporting_evidence_ids, [`memory:${evidenceMemory}`]);
  const [backgroundLinked] = await rows(
    'SELECT * FROM public.background_link_competing_hypotheses_v1($1,$2,$3)', [owner, backgroundId, lifecycle],
  );
  assert.ok(backgroundLinked.competing_hypothesis_ids.includes(lifecycle));

  // 48. The background read path keeps its direct service-role SELECT. In this
  // environment the server role is an ordinary RLS-bound role, so the assertion
  // is that the privilege exists and the canonical read executes; the row
  // content itself is asserted as the migration owner.
  const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', ['service_role', 'public.hypotheses', 'SELECT']);
  assert.equal(allowed, true, 'the server role keeps direct SELECT for the background read path');
  await rows(ACTIVE_READ, [owner]);
  const visible = (await readAsOwner(ACTIVE_READ, [owner], 'service_role')).map((r) => r.id);
  assert.ok(visible.includes(backgroundId), 'the canonical active read still returns background-created Hypotheses');
}

// Section 12. A database in the pre-0027 state upgrades cleanly and leaves
// existing Hypothesis rows exactly as they were.
async function verifyUpgradePath(owner) {
  stage = 'upgrade from the pre-hardening schema';
  await q('SAVEPOINT upgrade');
  await identity('postgres');
  await q(`DROP FUNCTION ${CREATE}`);
  await q(`DROP FUNCTION ${GUARD}`);
  await restorePreHardeningAuthority();
  // The simulated pre-hardening installation really does give the server REST
  // role direct table DML and the client direct INSERT. Asserting it here means
  // the revocation below is proven, not inherited from the clean CI database.
  for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
    const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', ['service_role', 'public.hypotheses', privilege]);
    assert.equal(allowed, true, `pre-hardening: service_role holds ${privilege} on public.hypotheses`);
  }
  const [{ clientInsert }] = await rows(
    'SELECT has_table_privilege($1,$2,$3) "clientInsert"', ['authenticated', 'public.hypotheses', 'INSERT'],
  );
  assert.equal(clientInsert, true, 'pre-hardening: authenticated holds INSERT on public.hypotheses');

  // A Hypothesis row written the pre-hardening way, with nontrivial values,
  // captured verbatim.
  const legacyId = randomUUID(), legacyCompetitor = randomUUID();
  await identity('authenticated', owner);
  await q(
    `INSERT INTO public.hypotheses(
       id,user_id,statement,type,domain,scope,origin,status,version,
       supporting_evidence_ids,contradicting_evidence_ids,competing_hypothesis_ids,
       assumptions,disconfirming_conditions,created_at,updated_at)
     VALUES($1,$2,'legacy hypothesis','STRATEGIC','WORK','legacy scope','HUMAN_REVIEWED','MIXED',13,
       $3,$4,ARRAY[$5]::uuid[],ARRAY['legacy assumption'],ARRAY['legacy disconfirmation'],
       CURRENT_TIMESTAMP - interval '10 days', CURRENT_TIMESTAMP - interval '9 days')`,
    [legacyId, owner, [`memory:${randomUUID()}`], [`memory:${randomUUID()}`], legacyCompetitor],
  );
  await identity('postgres');
  const [beforeUpgrade] = await rows('SELECT * FROM public.hypotheses WHERE id=$1', [legacyId]);
  const [{ total: totalBefore }] = await rows('SELECT count(*)::int total FROM public.hypotheses');

  // Apply the migration itself; it is already inside this transaction.
  await q(migrationSql.replace(/^\s*BEGIN;/mu, '').replace(/^\s*COMMIT;\s*$/mu, ''));

  const [afterUpgrade] = await rows('SELECT * FROM public.hypotheses WHERE id=$1', [legacyId]);
  assert.deepEqual(afterUpgrade, beforeUpgrade, 'the upgrade leaves existing Hypothesis rows byte-identical');
  const [{ total: totalAfter }] = await rows('SELECT count(*)::int total FROM public.hypotheses');
  assert.equal(totalAfter, totalBefore, 'the upgrade deletes nothing');

  // The hardened final state is reached from the upgraded database too, which
  // includes stripping the direct table DML this environment started with.
  await verifyEffectiveAcls();
  await verifyCreationSurface();
  stage = 'upgrade from the pre-hardening schema';
  await identity('authenticated', owner);
  await rejected(() => q(
    `INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin)
      VALUES($1,$2,'post upgrade','CAUSAL','GENERAL','scope','ADMIN_CONTROLLED')`,
    [randomUUID(), owner],
  ));
  await rejected(() => q("UPDATE public.hypotheses SET origin='ADMIN_CONTROLLED' WHERE id=$1", [legacyId]));
  // The server role cannot reach the table directly either.
  await identity('service_role');
  await rejected(() => q(
    `INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin)
      VALUES($1,$2,'server direct','CAUSAL','GENERAL','scope','SYSTEM_GENERATED')`,
    [randomUUID(), owner],
  ));
  await rejected(() => q("UPDATE public.hypotheses SET status='SUPPORTED' WHERE id=$1", [legacyId]));
  await rejected(() => q('DELETE FROM public.hypotheses WHERE id=$1', [legacyId]));
  // Legitimate server creation works immediately after the upgrade.
  const [postUpgrade] = await rows(CREATE_CALL, createArgs(owner, randomUUID(), { statement: 'post upgrade creation' }));
  assert.equal(postUpgrade.status, 'CANDIDATE');

  await identity('postgres');
  await q('ROLLBACK TO SAVEPOINT upgrade');
  await q('RELEASE SAVEPOINT upgrade');
}

async function verifyHistoryUntouched(historical) {
  stage = 'historical rows untouched';
  await identity('postgres');
  const [row] = await rows('SELECT * FROM public.hypotheses WHERE id=$1', [historical.id]);
  assert.deepEqual(row, historical, 'a Hypothesis row nobody targeted is byte-identical after every operation above');
}

async function verifyTenantIsolation(owner, other) {
  stage = 'tenant isolation';
  await identity('authenticated', owner);
  const mine = await rows('SELECT user_id FROM public.hypotheses');
  assert.ok(mine.length > 0 && mine.every((r) => r.user_id === owner), 'the owner sees only its own Hypotheses');
  await identity('authenticated', other);
  const theirs = await rows('SELECT user_id FROM public.hypotheses');
  assert.ok(theirs.length > 0 && theirs.every((r) => r.user_id === other), 'the other tenant sees only its own Hypotheses');
}

async function main() {
  try {
    await client.connect();
    await q('BEGIN');
    await identity('postgres');
    const [{ ts }] = await rows('SELECT CURRENT_TIMESTAMP ts');
    const owner = randomUUID(), other = randomUUID();
    const ownedHypothesis = randomUUID(), otherHypothesis = randomUUID();
    const evidenceMemory = randomUUID(), ineligibleMemory = randomUUID();
    await q('INSERT INTO auth.users(id) VALUES($1),($2)', [owner, other]);
    await q(
      `INSERT INTO public.memories(id,user_id,scope,type,content,source,confidence,importance,status) VALUES
        ($1,$3,'USER','PERSONAL_FACT','eligible evidence','USER_STATED',0.9,0.7,'ACTIVE'),
        ($2,$3,'USER','DERIVED_INSIGHT','ineligible evidence','SYSTEM_DERIVED',0.9,0.7,'PENDING_CONFIRMATION')`,
      [evidenceMemory, ineligibleMemory, owner],
    );
    // Rows that stand in for Hypothesis history written before this migration,
    // deliberately carrying nontrivial authoritative values.
    await q(
      `INSERT INTO public.hypotheses(
         id,user_id,statement,type,domain,scope,origin,status,version,
         supporting_evidence_ids,contradicting_evidence_ids,assumptions,disconfirming_conditions,created_at,updated_at)
       VALUES($1,$2,'historical hypothesis','CAUSAL','GENERAL','historical scope','ADMIN_CONTROLLED','SUPPORTED',9,
         $5,$6,ARRAY['historical assumption'],ARRAY['historical disconfirmation'],
         CURRENT_TIMESTAMP - interval '30 days', CURRENT_TIMESTAMP - interval '30 days'),
             ($3,$4,'other tenant hypothesis','BEHAVIORAL','WORK','other scope','SYSTEM_GENERATED','ACTIVE',1,
         '{}','{}','{}','{}',CURRENT_TIMESTAMP - interval '30 days', CURRENT_TIMESTAMP - interval '30 days')`,
      [ownedHypothesis, owner, otherHypothesis, other, [`memory:${evidenceMemory}`], [`memory:${randomUUID()}`]],
    );
    const [historical] = await rows('SELECT * FROM public.hypotheses WHERE id=$1', [ownedHypothesis]);

    await verifyEffectiveAcls();
    await verifyCreationSurface();
    await reproduceBaselineVulnerability(owner);
    await verifyAuthenticatedAttacks(owner, other, ownedHypothesis, otherHypothesis);
    await verifyAnonymousAttacks(owner, ownedHypothesis);
    await verifyServerCreate(owner, other, ts);
    await verifyExistingRuntimeRegression(owner, other, evidenceMemory, ineligibleMemory);
    await verifyUpgradePath(owner);
    await verifyHistoryUntouched(historical);
    await verifyTenantIsolation(owner, other);

    await identity('postgres');
    console.log('Verified migration 0027: reproduced the baseline Hypothesis creation forgery, then proved server-only Hypothesis creation authority, rejected authenticated and anonymous creation and origin/status/version/Evidence/competitor/timestamp forgery, removed direct service-role table DML, an allowlisted creation surface with no end-user bypass, canonical forced creation values, unchanged evidence/competition/update and background semantics, an unchanged lifecycle graph and version increment on the migration-0036 exact-version transition boundary with the legacy transition RPC executable by no application role, a clean upgrade that leaves existing rows byte-identical, and tenant isolation.');
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Hypothesis authority verification failed at ${stage} (${code}). Connection details were suppressed.`);
  process.exitCode = 1;
});
