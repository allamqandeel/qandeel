// Memory Authority Hardening (migration 0026) adversarial verifier.
//
// Runs against a fully migrated database. It first reconstructs the pre-0026
// permissive authority inside a rolled-back savepoint to prove the forgery
// vulnerability was real, then proves - against the live hardened state - that
// an authenticated client can no longer create, mutate or delete Memory
// directly, cannot forge provenance / lifecycle / scoring / version /
// timestamps, and retains no RPC bypass; that anonymous callers have no
// authority at all; that the narrow server commands enforce ownership,
// vocabulary, lineage and atomicity; that upgrading a pre-0026 database leaves
// existing Memory rows byte-identical; and that tenant isolation holds. Every
// fixture is rolled back; no data is retained.
//
// Role discipline: the server REST role holds EXECUTE on the definer commands
// but is an ordinary RLS-bound role, so every direct SELECT assertion is made
// as the migration owner and the server role is used only to invoke commands.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const migrationSql = await readFile(new URL('./migrations/0026_memory_authority_hardening_v1.sql', import.meta.url), 'utf8');
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

// Reads a row as the migration owner, then restores the previous identity.
async function readAsOwner(text, values, role, uid = null) {
  await identity('postgres');
  const result = await rows(text, values);
  await identity(role, uid);
  return result;
}

const CREATE = 'public.server_create_memory_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz)';
const REMOVE = 'public.server_mark_memory_deleted_v1(uuid,uuid)';
const SUPERSEDE = 'public.server_supersede_memory_v1(uuid,uuid,uuid,text,text,text,double precision,double precision,text,timestamptz)';
const LEGACY = 'public.supersede_memory(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz)';
const CREATE_CALL = 'SELECT * FROM public.server_create_memory_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)';
const REMOVE_CALL = 'SELECT * FROM public.server_mark_memory_deleted_v1($1,$2)';
const SUPERSEDE_CALL = 'SELECT * FROM public.server_supersede_memory_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)';
const LEGACY_CALL = "SELECT * FROM public.supersede_memory($1,$2,'PERSONAL_FACT','legacy','USER_CONFIRMED',1,1,'ACTIVE',NULL)";

const createArgs = (user, id, overrides = {}) => {
  const shape = {
    type: 'PERSONAL_FACT', content: 'server written', source: 'USER_STATED',
    confidence: 0.9, importance: 0.7, status: 'ACTIVE', expiresAt: null, ...overrides,
  };
  return [user, id, shape.type, shape.content, shape.source, shape.confidence, shape.importance, shape.status, shape.expiresAt];
};

async function verifyEffectiveAcls() {
  stage = 'effective ACLs';
  const priv = [
    // Owner-scoped reads survive for Memory Retrieval / Evidence projection.
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
    const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, 'public.memories', p]);
    assert.equal(allowed, expected, `${role} ${p} on public.memories`);
  }
  const fn = [
    // The legacy generic mutation RPC is no longer an authenticated bypass, and
    // it was not handed to any other role either.
    ['authenticated', LEGACY, false], ['anon', LEGACY, false], ['service_role', LEGACY, false],
    ['authenticated', CREATE, false], ['anon', CREATE, false], ['service_role', CREATE, true],
    ['authenticated', REMOVE, false], ['anon', REMOVE, false], ['service_role', REMOVE, true],
    ['authenticated', SUPERSEDE, false], ['anon', SUPERSEDE, false], ['service_role', SUPERSEDE, true],
  ];
  for (const [role, signature, expected] of fn) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed', [role, signature, 'EXECUTE']);
    assert.equal(allowed, expected, `${role} EXECUTE ${signature}`);
  }
  // Deterministic statement of the legacy-RPC contract: after hardening the only
  // EXECUTE holder is the function owner. This covers PUBLIC, which has no
  // has_function_privilege spelling, and does not depend on whatever grants the
  // installation happened to carry.
  assert.deepEqual(await legacyExecuteGrantees(), ['postgres'],
    'legacy supersede_memory EXECUTE is held by the owner only');
  const policies = (await rows(
    "SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='memories' ORDER BY policyname",
  )).map((r) => r.policyname);
  assert.deepEqual(policies, ['memories_select_own'], 'only the owner read policy survives on memories');
  const [{ rls }] = await rows("SELECT relrowsecurity rls FROM pg_class WHERE oid='public.memories'::regclass");
  assert.equal(rls, true, 'row level security stays enabled');
  for (const signature of [CREATE, REMOVE, SUPERSEDE]) {
    const [{ owner, definer, config }] = await rows(
      'SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config FROM pg_proc p WHERE p.oid=$1::regprocedure',
      [signature],
    );
    assert.equal(owner, 'postgres', `${signature} owner`);
    assert.equal(definer, true, `${signature} is SECURITY DEFINER`);
    assert.ok(Array.isArray(config) && config.length === 1 && config[0].startsWith('search_path='), `${signature} hardened search_path`);
  }
  // Exactly the expected Memory-returning command surface exists: no extra CRUD
  // and no broad "update arbitrary columns" RPC was introduced.
  const returning = (await rows(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prorettype='public.memories'::regtype ORDER BY p.proname`,
  )).map((r) => r.proname);
  assert.deepEqual(returning, [
    'server_create_memory_v1', 'server_mark_memory_deleted_v1', 'server_supersede_memory_v1', 'supersede_memory',
  ], 'Memory command surface');
  // Decisive check: no function reachable by an end-user role mutates memories.
  const reachable = (await rows(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f'
        AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
          OR has_function_privilege('anon', p.oid, 'EXECUTE'))
        AND pg_get_functiondef(p.oid) ~* '(INSERT INTO|UPDATE|DELETE FROM)[[:space:]]+public\\.memories'
      ORDER BY p.proname`,
  )).map((r) => r.proname);
  assert.deepEqual(reachable, [], 'no end-user-executable function mutates public.memories');
}

async function reproduceBaselineVulnerability(owner, existing) {
  stage = 'baseline vulnerability reconstruction';
  await q('SAVEPOINT baseline');
  await restorePreHardeningAuthority();

  await identity('authenticated', owner);
  const forged = randomUUID();
  // Exploit: manufacture an apparently canonical USER_CONFIRMED Memory with a
  // caller-chosen version, scoring and lifecycle timestamps.
  await q(`INSERT INTO public.memories(id,user_id,type,content,source,confidence,importance,status,version,created_at,updated_at)
    VALUES($1,$2,'PERSONAL_FACT','forged provenance','USER_CONFIRMED',1,1,'ACTIVE',99,CURRENT_TIMESTAMP - interval '5 years',CURRENT_TIMESTAMP)`, [forged, owner]);
  const [row] = await rows('SELECT source,version FROM public.memories WHERE id=$1', [forged]);
  assert.equal(row.source, 'USER_CONFIRMED', 'baseline: client forged USER_CONFIRMED provenance');
  assert.equal(row.version, 99, 'baseline: client forged an authoritative version');
  // Exploit: the forged row satisfies the canonical Evidence eligibility predicate.
  const [{ n }] = await rows(
    `SELECT count(*)::int n FROM public.memories
      WHERE id=$1 AND status='ACTIVE' AND source IN ('USER_STATED','USER_CONFIRMED')
        AND type<>'DERIVED_INSIGHT' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)`, [forged]);
  assert.equal(n, 1, 'baseline: forged Memory is Evidence-eligible');
  // Exploit: rewrite an existing owned Memory's provenance in place.
  assert.equal((await q("UPDATE public.memories SET source='ADMIN_CONTROLLED' WHERE id=$1", [existing])).rowCount, 1,
    'baseline: client rewrote provenance of an existing Memory');
  // Exploit: the legacy generic RPC was directly executable.
  assert.equal((await rows(LEGACY_CALL, [existing, randomUUID()])).length, 1, 'baseline: legacy RPC was an authenticated bypass');

  await identity('postgres');
  await q('ROLLBACK TO SAVEPOINT baseline');
  await q('RELEASE SAVEPOINT baseline');
}

// Recreates the authority migration 0004 granted and 0026 removes. The legacy
// RPC is granted to service_role as well: a Supabase installation may carry an
// explicit or default EXECUTE grant for the server REST role, and the hardened
// contract must hold from that starting state too rather than depending on the
// clean CI database's initial ACL.
async function restorePreHardeningAuthority() {
  await identity('postgres');
  await q('GRANT INSERT, UPDATE ON public.memories TO authenticated');
  await q('CREATE POLICY memories_insert_own ON public.memories FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()))');
  await q('CREATE POLICY memories_update_own ON public.memories FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()))');
  await q(`GRANT EXECUTE ON FUNCTION ${LEGACY} TO authenticated, service_role`);
  await q('GRANT INSERT, UPDATE, DELETE ON public.memories TO service_role');
}

async function legacyExecutable(role) {
  const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed', [role, LEGACY, 'EXECUTE']);
  return allowed;
}

// Everyone holding EXECUTE on the legacy RPC, by name. PUBLIC is grantee 0 and
// has no has_function_privilege spelling, so the ACL is read directly - that is
// the only way to state the contract deterministically for PUBLIC.
async function legacyExecuteGrantees() {
  return (await rows(
    `SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee
       FROM pg_proc p, aclexplode(p.proacl) a
      WHERE p.oid=$1::regprocedure AND a.privilege_type='EXECUTE'
      ORDER BY 1`, [LEGACY],
  )).map((r) => r.grantee);
}

async function verifyAuthenticatedAttacks(owner, other, ownedMemory, otherMemory) {
  stage = 'authenticated direct attacks';
  await identity('authenticated', owner);
  // 1. The owner still reads its own Memory. 2. Cross-tenant read stays denied.
  assert.deepEqual((await rows('SELECT id FROM public.memories')).map((r) => r.id), [ownedMemory]);
  assert.equal((await rows('SELECT id FROM public.memories WHERE id=$1', [otherMemory])).length, 0);

  // 3. Direct INSERT fails, including every forged-provenance variant (6/7/8).
  const insert = (source, status = 'ACTIVE', type = 'PERSONAL_FACT') => () => q(
    `INSERT INTO public.memories(id,user_id,type,content,source,confidence,importance,status)
      VALUES($1,$2,$3,'attack',$4,1,1,$5)`,
    [randomUUID(), owner, type, source, status],
  );
  await rejected(insert('USER_STATED'));
  await rejected(insert('USER_CONFIRMED'));
  await rejected(insert('ADMIN_CONTROLLED'));
  await rejected(insert('IMPORTED'));
  await rejected(insert('SYSTEM_DERIVED', 'PENDING_CONFIRMATION', 'DERIVED_INSIGHT'));
  // Even a fully server-shaped row with explicit version and timestamps fails.
  await rejected(() => q(
    `INSERT INTO public.memories(id,user_id,scope,type,content,source,confidence,importance,status,version,created_at,updated_at,expires_at,supersedes_memory_id)
      VALUES($1,$2,'USER','GOAL','attack','USER_CONFIRMED',1,1,'ACTIVE',42,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL,NULL)`,
    [randomUUID(), owner],
  ));

  // 4 and 9-12. Direct UPDATE of an owned Memory fails for every field.
  for (const patch of [
    "source='USER_CONFIRMED'", "source='ADMIN_CONTROLLED'", "source='SYSTEM_DERIVED'",
    "status='ACTIVE'", "status='SUPERSEDED'", "status='DELETED'", "status='PENDING_CONFIRMATION'",
    'version=99', 'confidence=1', 'importance=1',
    'created_at=CURRENT_TIMESTAMP', 'updated_at=CURRENT_TIMESTAMP',
    "expires_at=CURRENT_TIMESTAMP + interval '1 year'", 'expires_at=NULL',
    'supersedes_memory_id=NULL', "content='rewritten'", "type='DERIVED_INSIGHT'", "scope='USER'",
    'user_id=user_id',
  ]) await rejected(() => q(`UPDATE public.memories SET ${patch} WHERE id=$1`, [ownedMemory]));

  // 5. Direct DELETE fails, scoped and unscoped.
  await rejected(() => q('DELETE FROM public.memories WHERE id=$1', [ownedMemory]));
  await rejected(() => q('DELETE FROM public.memories'));

  // 13. The legacy generic supersede_memory RPC is no longer executable.
  await rejected(() => q(LEGACY_CALL, [ownedMemory, randomUUID()]));
  // 14. No new server-only Memory command is executable by an authenticated client.
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID())));
  await rejected(() => q(REMOVE_CALL, [owner, ownedMemory]));
  await rejected(() => q(SUPERSEDE_CALL, [owner, ownedMemory, randomUUID(), 'PERSONAL_FACT', 'x', 'USER_CONFIRMED', 1, 1, 'ACTIVE', null]));
  // Nor can a different tenant drive a command against this owner.
  await identity('authenticated', other);
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID())));
  await rejected(() => q(REMOVE_CALL, [owner, ownedMemory]));

  // Nothing above changed the target row.
  const [after] = await readAsOwner('SELECT source,status,version FROM public.memories WHERE id=$1', [ownedMemory], 'authenticated', other);
  assert.deepEqual(after, { source: 'USER_STATED', status: 'ACTIVE', version: 1 });
}

async function verifyAnonymousAttacks(owner, ownedMemory) {
  stage = 'anonymous attacks';
  await identity('anon');
  await rejected(() => q('SELECT id FROM public.memories'));
  await rejected(() => q(
    "INSERT INTO public.memories(id,user_id,type,content,source,confidence,importance,status) VALUES($1,$2,'GOAL','anon','USER_CONFIRMED',1,1,'ACTIVE')",
    [randomUUID(), owner],
  ));
  await rejected(() => q("UPDATE public.memories SET status='DELETED' WHERE id=$1", [ownedMemory]));
  await rejected(() => q('DELETE FROM public.memories WHERE id=$1', [ownedMemory]));
  await rejected(() => q(LEGACY_CALL, [ownedMemory, randomUUID()]));
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID())));
  await rejected(() => q(REMOVE_CALL, [owner, ownedMemory]));
  await rejected(() => q(SUPERSEDE_CALL, [owner, ownedMemory, randomUUID(), 'GOAL', 'x', 'USER_STATED', 1, 1, 'ACTIVE', null]));
}

async function verifyServerCreate(owner, other) {
  stage = 'server-authoritative creation';
  await identity('service_role');
  const id = randomUUID();
  // 15/16/17. Legitimate creation succeeds, is owned by the intended user, and
  // preserves the trusted internal semantics exactly as supplied.
  const [created] = await rows(CREATE_CALL, createArgs(owner, id, {
    type: 'GOAL', content: '  ship the release  ', source: 'USER_CONFIRMED',
    confidence: 0.8, importance: 0.6, status: 'ACTIVE',
  }));
  assert.equal(created.id, id, 'canonical Memory UUID round-trips unchanged');
  assert.equal(created.user_id, owner);
  assert.equal(created.type, 'GOAL');
  assert.equal(created.source, 'USER_CONFIRMED');
  assert.equal(created.status, 'ACTIVE');
  assert.equal(created.confidence, 0.8);
  assert.equal(created.importance, 0.6);
  assert.equal(created.content, 'ship the release');
  // 18. Scope, version, lineage and both timestamps are derived server-side.
  assert.equal(created.scope, 'USER');
  assert.equal(created.version, 1);
  assert.equal(created.supersedes_memory_id, null);
  assert.equal(created.expires_at, null);
  assert.ok(created.created_at instanceof Date && created.updated_at instanceof Date, 'database-derived timestamps');

  // 20. Malformed or non-canonical input fails closed.
  await rejected(() => q(CREATE_CALL, createArgs(null, randomUUID())), ['22023']);
  await rejected(() => q(CREATE_CALL, createArgs(owner, null)), ['22023']);
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID(), { type: 'TRANSCRIPT' })), ['22023']);
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID(), { source: 'MODEL_GUESSED' })), ['22023']);
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID(), { status: 'ARCHIVED' })), ['22023']);
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID(), { source: 'SYSTEM_DERIVED', status: 'ACTIVE' })), ['22023']);
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID(), { content: '   ' })), ['22023']);
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID(), { confidence: 1.5 })), ['22023']);
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID(), { importance: -0.1 })), ['22023']);
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID(), { confidence: Number.NaN })), ['22023']);
  await rejected(() => q(CREATE_CALL, createArgs(owner, randomUUID(), { expiresAt: new Date(Date.now() - 3_600_000) })), ['22023']);
  await rejected(() => q(CREATE_CALL, createArgs(owner, 'not-a-uuid')), ['22P02']);
  // 19. An unknown owner fails closed rather than creating an orphan row.
  await rejected(() => q(CREATE_CALL, createArgs(randomUUID(), randomUUID())), ['42501']);
  // Ownership cannot be transferred by replaying an id under another tenant.
  await rejected(() => q(CREATE_CALL, createArgs(other, id)), ['23505']);
  return id;
}

// Every column except status and updated_at must survive a deletion untouched.
const PRESERVED_BY_DELETE = [
  'id', 'user_id', 'scope', 'type', 'content', 'source', 'confidence',
  'importance', 'version', 'created_at', 'expires_at', 'supersedes_memory_id',
];

function assertOnlyStatusMoved(before, after, label) {
  assert.equal(after.status, 'DELETED', `${label}: status becomes DELETED`);
  for (const column of PRESERVED_BY_DELETE) {
    assert.deepEqual(after[column], before[column], `${label}: ${column} unchanged by deletion`);
  }
}

async function verifyServerDelete(owner, other, activeId) {
  stage = 'server-authoritative deletion';
  const [before] = await readAsOwner('SELECT * FROM public.memories WHERE id=$1', [activeId], 'service_role');
  assert.equal(before.status, 'ACTIVE');
  // 21. ACTIVE -> DELETED: only the lifecycle status (and updated_at) moves.
  const [deleted] = await rows(REMOVE_CALL, [owner, activeId]);
  assertOnlyStatusMoved(before, deleted, 'ACTIVE target');
  // 26. No physical delete: the row is still present.
  const [{ n }] = await readAsOwner('SELECT count(*)::int n FROM public.memories WHERE id=$1', [activeId], 'service_role');
  assert.equal(n, 1, 'deletion is a lifecycle transition, never a physical delete');
  // An already DELETED owned row stays a legitimate target and is returned
  // again, exactly as the pre-hardening owned-row update behaved. This command
  // moved the write authority, not the lifecycle semantics.
  const [reDeleted] = await rows(REMOVE_CALL, [owner, activeId]);
  assert.ok(reDeleted, 'an already deleted owned Memory is still an owned target');
  assertOnlyStatusMoved(deleted, reDeleted, 'already DELETED target');
  // 19. A wrong-user target returns no row and mutates nothing.
  assert.equal((await rows(REMOVE_CALL, [other, activeId])).length, 0);
  // A nonexistent target likewise returns no row.
  assert.equal((await rows(REMOVE_CALL, [owner, randomUUID()])).length, 0);
  const [still] = await readAsOwner('SELECT * FROM public.memories WHERE id=$1', [activeId], 'service_role');
  assertOnlyStatusMoved(deleted, still, 'after rejected attempts');
  // 20. Malformed input fails closed.
  await rejected(() => q(REMOVE_CALL, [null, activeId]), ['22023']);
  await rejected(() => q(REMOVE_CALL, [owner, null]), ['22023']);
  await rejected(() => q(REMOVE_CALL, [owner, 'not-a-uuid']), ['22P02']);
}

// Deletion is not restricted by the target's current lifecycle status: a
// superseded predecessor is still an owned, deletable row and keeps its row,
// content and lineage on both sides of the link.
async function verifyDeleteAcrossLifecycleStates(owner) {
  stage = 'deletion across lifecycle states';
  await identity('service_role');
  const predecessorId = randomUUID(), successorId = randomUUID();
  await rows(CREATE_CALL, createArgs(owner, predecessorId, { content: 'lineage predecessor' }));
  await rows(SUPERSEDE_CALL, [owner, predecessorId, successorId, 'PERSONAL_FACT', 'lineage successor', 'USER_CONFIRMED', 1, 0.8, 'ACTIVE', null]);
  const [before] = await readAsOwner('SELECT * FROM public.memories WHERE id=$1', [predecessorId], 'service_role');
  assert.equal(before.status, 'SUPERSEDED');

  const [deleted] = await rows(REMOVE_CALL, [owner, predecessorId]);
  assert.ok(deleted, 'a SUPERSEDED owned Memory is a legitimate deletion target');
  assertOnlyStatusMoved(before, deleted, 'SUPERSEDED target');

  const after = await readAsOwner(
    'SELECT id, status, content, version, supersedes_memory_id FROM public.memories WHERE id=ANY($1) ORDER BY version',
    [[predecessorId, successorId]], 'service_role',
  );
  assert.equal(after.length, 2, 'no physical delete: both lineage rows remain');
  assert.deepEqual(after[0], {
    id: predecessorId, status: 'DELETED', content: 'lineage predecessor', version: 1, supersedes_memory_id: null,
  }, 'the predecessor keeps its row and content');
  assert.deepEqual(after[1], {
    id: successorId, status: 'ACTIVE', content: 'lineage successor', version: 2, supersedes_memory_id: predecessorId,
  }, 'the lineage link survives the deletion on both sides');

  // Every other lifecycle state is equally deletable; none is terminal.
  for (const status of ['PENDING_CONFIRMATION', 'DISABLED', 'EXPIRED']) {
    const id = randomUUID();
    const source = status === 'PENDING_CONFIRMATION' ? 'SYSTEM_DERIVED' : 'USER_STATED';
    const type = status === 'PENDING_CONFIRMATION' ? 'DERIVED_INSIGHT' : 'GOAL';
    const [seeded] = await rows(CREATE_CALL, createArgs(owner, id, { status, source, type, content: `state ${status}` }));
    assert.equal(seeded.status, status);
    const [removed] = await rows(REMOVE_CALL, [owner, id]);
    assert.ok(removed, `${status} is a legitimate deletion target`);
    assertOnlyStatusMoved(seeded, removed, `${status} target`);
  }
}

async function verifyServerSupersede(owner, other, otherMemory) {
  stage = 'server-authoritative supersession';
  await identity('service_role');
  const predecessorId = randomUUID(), successorId = randomUUID();
  await rows(CREATE_CALL, createArgs(owner, predecessorId, { content: 'I live in Cairo.' }));

  // 24. Self-supersession fails closed.
  await rejected(() => q(SUPERSEDE_CALL, [owner, predecessorId, predecessorId, 'PERSONAL_FACT', 'x', 'USER_CONFIRMED', 1, 1, 'ACTIVE', null]), ['22023']);
  // 23. Cross-user supersession finds no predecessor and mutates nothing.
  assert.equal((await rows(SUPERSEDE_CALL, [other, predecessorId, randomUUID(), 'PERSONAL_FACT', 'x', 'USER_CONFIRMED', 1, 1, 'ACTIVE', null])).length, 0);
  assert.equal((await rows(SUPERSEDE_CALL, [owner, otherMemory, randomUUID(), 'PERSONAL_FACT', 'x', 'USER_CONFIRMED', 1, 1, 'ACTIVE', null])).length, 0);
  let [state] = await readAsOwner('SELECT status FROM public.memories WHERE id=$1', [predecessorId], 'service_role');
  assert.equal(state.status, 'ACTIVE', 'a rejected supersession leaves the predecessor untouched');

  // 22. Successor creation and predecessor transition succeed together.
  const [successor] = await rows(SUPERSEDE_CALL, [owner, predecessorId, successorId, 'PERSONAL_FACT', 'I live in Alexandria.', 'USER_CONFIRMED', 1, 0.8, 'ACTIVE', null]);
  assert.equal(successor.id, successorId);
  assert.equal(successor.user_id, owner, 'the successor is owned by the predecessor owner');
  assert.equal(successor.scope, 'USER');
  assert.equal(successor.version, 2, 'version is derived from the predecessor');
  assert.equal(successor.supersedes_memory_id, predecessorId);
  [state] = await readAsOwner('SELECT status FROM public.memories WHERE id=$1', [predecessorId], 'service_role');
  assert.equal(state.status, 'SUPERSEDED');

  // 22. Failure is atomic: an invalid successor leaves the predecessor ACTIVE
  // and creates no partial successor row.
  const secondPredecessor = randomUUID();
  await rows(CREATE_CALL, createArgs(owner, secondPredecessor));
  await rejected(() => q(SUPERSEDE_CALL, [owner, secondPredecessor, randomUUID(), 'PERSONAL_FACT', 'x', 'USER_CONFIRMED', 5, 1, 'ACTIVE', null]), ['22023']);
  const atomic = await readAsOwner(
    'SELECT (SELECT status FROM public.memories WHERE id=$1) status, (SELECT count(*)::int FROM public.memories WHERE supersedes_memory_id=$1) successors',
    [secondPredecessor], 'service_role',
  );
  assert.deepEqual(atomic[0], { status: 'ACTIVE', successors: 0 });

  // 25. The single-successor invariant still holds. The predecessor is no
  // longer ACTIVE, so the command cannot produce a second successor, and the
  // table constraint still rejects one even from the migration owner.
  assert.equal((await rows(SUPERSEDE_CALL, [owner, predecessorId, randomUUID(), 'PERSONAL_FACT', 'second', 'USER_CONFIRMED', 1, 1, 'ACTIVE', null])).length, 0);
  await identity('postgres');
  assert.equal((await rows('SELECT count(*)::int n FROM public.memories WHERE supersedes_memory_id=$1', [predecessorId]))[0].n, 1);
  await rejected(() => q(
    `INSERT INTO public.memories(id,user_id,type,content,source,confidence,importance,status,version,supersedes_memory_id)
      VALUES($1,$2,'PERSONAL_FACT','duplicate successor','USER_CONFIRMED',1,1,'ACTIVE',2,$3)`,
    [randomUUID(), owner, predecessorId],
  ), ['23505']);
  // Lineage is preserved: the predecessor content still exists.
  const [lineage] = await rows('SELECT content FROM public.memories WHERE id=$1', [predecessorId]);
  assert.equal(lineage.content, 'I live in Cairo.');
}

// Migration compatibility: a database in the pre-0026 state upgrades cleanly
// and leaves existing Memory rows exactly as they were.
async function verifyUpgradePath(owner) {
  stage = 'upgrade from the pre-hardening schema';
  await q('SAVEPOINT upgrade');
  await identity('postgres');
  for (const signature of [CREATE, REMOVE, SUPERSEDE, 'public.assert_canonical_memory_shape_v1(text,text,text,double precision,double precision,text,timestamptz)']) {
    await q(`DROP FUNCTION ${signature}`);
  }
  await restorePreHardeningAuthority();
  // The simulated pre-hardening installation really does hand the legacy
  // generic RPC to every application role, including the server REST role, and
  // really does give that role direct table write. Asserting it here means the
  // revocation below is proven, not inherited from the clean CI database.
  for (const role of ['authenticated', 'service_role']) {
    assert.equal(await legacyExecutable(role), true, `pre-hardening: ${role} can EXECUTE legacy supersede_memory`);
  }
  assert.deepEqual(await legacyExecuteGrantees(), ['authenticated', 'postgres', 'service_role'],
    'pre-hardening: legacy EXECUTE is held by both application roles');
  for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
    const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', ['service_role', 'public.memories', privilege]);
    assert.equal(allowed, true, `pre-hardening: service_role holds ${privilege} on public.memories`);
  }

  // A Memory row written the pre-hardening way, captured verbatim.
  const legacyId = randomUUID();
  await identity('authenticated', owner);
  await q(`INSERT INTO public.memories(id,user_id,type,content,source,confidence,importance,status,version,created_at,updated_at)
    VALUES($1,$2,'GOAL','legacy row','USER_CONFIRMED',0.55,0.45,'ACTIVE',7,CURRENT_TIMESTAMP - interval '10 days',CURRENT_TIMESTAMP - interval '9 days')`, [legacyId, owner]);
  await identity('postgres');
  const [beforeUpgrade] = await rows('SELECT * FROM public.memories WHERE id=$1', [legacyId]);

  // Apply the migration itself; it is already inside this transaction.
  await q(migrationSql.replace(/^\s*BEGIN;/mu, '').replace(/^\s*COMMIT;\s*$/mu, ''));

  const [afterUpgrade] = await rows('SELECT * FROM public.memories WHERE id=$1', [legacyId]);
  assert.deepEqual(afterUpgrade, beforeUpgrade, 'the upgrade leaves existing Memory rows byte-identical');
  const [{ total }] = await rows('SELECT count(*)::int total FROM public.memories');
  assert.ok(total > 0, 'the upgrade deletes nothing');
  // The hardened final state is reached from the upgraded database too - which
  // includes stripping the legacy EXECUTE this environment started with.
  await verifyEffectiveAcls();
  stage = 'upgrade from the pre-hardening schema';
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal(await legacyExecutable(role), false, `upgrade revoked legacy EXECUTE from ${role}`);
  }
  assert.deepEqual(await legacyExecuteGrantees(), ['postgres'],
    'upgrade leaves legacy EXECUTE with the owner only - no PUBLIC, anon, authenticated or service_role');
  await identity('authenticated', owner);
  await rejected(() => q("UPDATE public.memories SET source='ADMIN_CONTROLLED' WHERE id=$1", [legacyId]));
  await rejected(() => q(LEGACY_CALL, [legacyId, randomUUID()]));
  // The server role cannot reach it either, from any direction.
  await identity('service_role');
  await rejected(() => q(LEGACY_CALL, [legacyId, randomUUID()]));

  await identity('postgres');
  await q('ROLLBACK TO SAVEPOINT upgrade');
  await q('RELEASE SAVEPOINT upgrade');
}

async function verifyHistoryUntouched(historical) {
  stage = 'historical rows untouched';
  await identity('postgres');
  const [row] = await rows('SELECT * FROM public.memories WHERE id=$1', [historical.id]);
  assert.deepEqual(row, historical, 'a Memory row nobody targeted is byte-identical after every operation above');
}

async function verifyTenantIsolation(owner, other) {
  stage = 'tenant isolation';
  await identity('authenticated', owner);
  const mine = await rows('SELECT user_id FROM public.memories');
  assert.ok(mine.length > 0 && mine.every((r) => r.user_id === owner), 'the owner sees only its own Memory');
  await identity('authenticated', other);
  const theirs = await rows('SELECT user_id FROM public.memories');
  assert.ok(theirs.length > 0 && theirs.every((r) => r.user_id === other), 'the other tenant sees only its own Memory');
}

async function main() {
  try {
    await client.connect();
    await q('BEGIN');
    await identity('postgres');
    const owner = randomUUID(), other = randomUUID();
    const ownedMemory = randomUUID(), otherMemory = randomUUID();
    await q('INSERT INTO auth.users(id) VALUES($1),($2)', [owner, other]);
    // Rows that stand in for Memory history written before this migration.
    await q(`INSERT INTO public.memories(id,user_id,type,content,source,confidence,importance,status,version,created_at,updated_at)
      VALUES($1,$2,'PERSONAL_FACT','historical fact','USER_STATED',0.9,0.7,'ACTIVE',1,CURRENT_TIMESTAMP - interval '30 days',CURRENT_TIMESTAMP - interval '30 days'),
            ($3,$4,'GOAL','other tenant goal','USER_CONFIRMED',1,0.8,'ACTIVE',1,CURRENT_TIMESTAMP - interval '30 days',CURRENT_TIMESTAMP - interval '30 days')`,
      [ownedMemory, owner, otherMemory, other]);
    const [historical] = await rows('SELECT * FROM public.memories WHERE id=$1', [ownedMemory]);

    await verifyEffectiveAcls();
    await reproduceBaselineVulnerability(owner, ownedMemory);
    await verifyAuthenticatedAttacks(owner, other, ownedMemory, otherMemory);
    await verifyAnonymousAttacks(owner, ownedMemory);
    const created = await verifyServerCreate(owner, other);
    await verifyServerDelete(owner, other, created);
    await verifyServerSupersede(owner, other, otherMemory);
    await verifyDeleteAcrossLifecycleStates(owner);
    await verifyUpgradePath(owner);
    await verifyHistoryUntouched(historical);
    await verifyTenantIsolation(owner, other);

    await identity('postgres');
    console.log('Verified migration 0026: reproduced the baseline Memory forgery, then proved server-only Memory write authority, rejected authenticated and anonymous mutation and provenance forgery, closed the legacy RPC bypass, narrow owner-checked server commands, unchanged deletion semantics over every lifecycle state, atomic lineage-preserving supersession, a clean upgrade that leaves existing rows byte-identical, and tenant isolation.');
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Memory authority verification failed at ${stage} (${code}). Connection details were suppressed.`);
  process.exitCode = 1;
});
