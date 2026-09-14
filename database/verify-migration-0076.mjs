// Real-PostgreSQL verifier for migration 0076 - Shared Standing Context Grant
// Persistence Foundation v1 (I-02B).
//
// Runs against a fully migrated database and proves, from live catalogs and
// live behaviour rather than from the migration text:
//
//   * schema: both grant tables exist, are owned by postgres, and still carry
//     every column / type / nullability / default, check and foreign-key
//     constraint with restrictive deletion and the intended parents
//     (shared_worlds and users only), the partial one-ACTIVE-grant unique index
//     and every other index that migration 0076 OWNS - unchanged and in their
//     original positions, with later additive columns / constraints / indexes
//     from a reviewed slice permitted rather than censused - while no column,
//     future ones included, is a scope / purpose / action / source / permission
//     / JSON column, with RLS on and no trigger on the grant tables or
//     on the membership-episode table; no generic context-admission / grant /
//     permission / consent-event table exists. (Whether a later, separately
//     verified narrow read boundary exists is not a 0076 property: this
//     verifier proves that 0076 itself sealed the tables, not a global ceiling
//     on every future function.)
//   * ACLs: anon, authenticated and service_role hold no SELECT / INSERT /
//     UPDATE / DELETE on either table (has_table_privilege AND an actual
//     rejected statement under SET LOCAL ROLE, including a direct revoke),
//     PUBLIC holds no grant, and zero RLS policies exist;
//   * behaviour, under the fixture owner inside one rolled-back transaction: a
//     valid ACTIVE grant inserts with granted_at on the database clock, every
//     illegal status / revocation / timestamp combination is rejected by its
//     check, an unknown status is rejected, a missing World or grantor is
//     rejected, a second ACTIVE grant for the same (world, grantor) is
//     rejected, a revoked historical grant plus a later new ACTIVE grant for
//     the same pair succeeds with both rows preserved, a duplicate audience
//     human in one grant is rejected, a missing audience human is rejected,
//     and neither the World, the grantor, an audience human nor a grant with
//     audience rows can be deleted through the restrictive foreign keys;
//   * zero fixture residue after completion.
//
// Nothing here weakens RLS or an ACL to make a proof easy: the application
// roles are only ever used to prove denial.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const client = new Client({ connectionString: process.env.DATABASE_URL });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}

async function rejected(operation, codes) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')})`);
}

const WORLDS = 'public.shared_worlds';
const EPISODES = 'public.shared_world_membership_episodes';
const GRANTS = 'public.shared_world_standing_context_grants';
const AUDIENCE = 'public.shared_world_standing_context_grant_audience';
const TABLES = [GRANTS, AUDIENCE];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
const CHECK_VIOLATION = ['23514'];
const NOT_NULL_VIOLATION = ['23502'];
const UNIQUE_VIOLATION = ['23505'];
const FK_VIOLATION = ['23503'];
const INSUFFICIENT_PRIVILEGE = ['42501'];

const EXPECTED_COLUMNS = {
  [GRANTS]: [
    ['id', 'uuid', 'NO', null],
    ['world_id', 'uuid', 'NO', null],
    ['grantor_user_id', 'uuid', 'NO', null],
    ['status', 'text', 'NO', null],
    ['granted_at', 'timestamp with time zone', 'NO', 'CURRENT_TIMESTAMP'],
    ['revoked_at', 'timestamp with time zone', 'YES', null],
  ],
  [AUDIENCE]: [
    ['grant_id', 'uuid', 'NO', null],
    ['audience_user_id', 'uuid', 'NO', null],
  ],
};

// Generic tables this slice must not have introduced: a generic Context
// Admission / grant / permission engine, Matching or Public private admission,
// or a half-generic consent-event log.
const FORBIDDEN_TABLES = [
  'context_admissions', 'context_admission_grants', 'grants', 'permissions', 'permission_grants', 'authority_grants',
  'consent_events', 'consent_event_log', 'matching_context_grants', 'public_context_grants', 'standing_context_grants',
];

async function verifySchema() {
  stage = 'schema: tables';
  for (const table of TABLES) {
    const [meta] = await rows(
      'SELECT c.relkind kind, c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.oid=$1::regclass',
      [table],
    );
    assert.ok(meta, `${table} exists`);
    assert.equal(meta.kind, 'r', `${table} is an ordinary table`);
    assert.equal(meta.owner, 'postgres', `${table} is owned by postgres`);
    assert.equal(meta.rls, true, `${table} has row level security enabled`);
  }
  const [{ n: forbidden }] = await rows(
    "SELECT count(*)::int n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relname = ANY($1::text[])",
    [FORBIDDEN_TABLES],
  );
  assert.equal(forbidden, 0, 'no generic context-admission, grant, permission, Matching, Public or consent-event table exists');

  stage = 'schema: columns';
  for (const table of TABLES) {
    const columns = await rows(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [table.replace('public.', '')],
    );
    // FORWARD SAFETY (I-04C): what 0076 OWNS, asserted as a PREFIX rather than as
    // a census of the live schema. A drop, a type / nullability / default change
    // or a reorder still fails; a later reviewed slice may append a column. The
    // shape bans below keep scanning EVERY column, future ones included.
    const observed = columns.map((c) => [c.column_name, c.data_type, c.is_nullable, c.column_default]);
    const owned = EXPECTED_COLUMNS[table];
    assert.deepEqual(
      observed.slice(0, owned.length),
      owned,
      `${table} still carries every column migration 0076 owns, unchanged and in its original position`,
    );
    for (const [name] of owned) {
      assert.equal(observed.filter((column) => column[0] === name).length, 1, `${table}.${name} appears exactly once`);
    }
    for (const { column_name: name, data_type: type } of columns) {
      assert.doesNotMatch(name, /scope|purpose|action|source|permission|disclos|quote|copy|publish|share|export|provenance|transfer|owner|admin|ttl|expir/iu,
        `${table}.${name} is not a generic, disclosure-shaped or owner column`);
      assert.ok(!['json', 'jsonb', 'ARRAY'].includes(type), `${table}.${name} is not a JSON or array column`);
    }
  }

  stage = 'schema: constraints';
  // COLLATE "C" fixes the ordering regardless of the server's default collation.
  const constraints = async (table) => rows(
    `SELECT conname name, contype type, pg_get_constraintdef(oid) def, confdeltype ondelete,
            CASE WHEN confrelid <> 0 THEN confrelid::regclass::text ELSE NULL END parent
       FROM pg_constraint WHERE conrelid=$1::regclass ORDER BY conname COLLATE "C"`,
    [table],
  );
  const byName = (list) => Object.fromEntries(list.map((c) => [c.name, c]));
  // FORWARD SAFETY (I-04C): every constraint 0076 OWNS must still be present, and
  // each one's meaning is asserted individually below. A later additive
  // constraint from a reviewed slice is not a 0076 regression.
  const owns = (list, names, label) => {
    const present = new Set(list.map((c) => c.name));
    for (const name of names) assert.ok(present.has(name), `${label} still carries migration 0076's ${name}`);
  };
  const grantConstraints = await constraints(GRANTS);
  const grants = byName(grantConstraints);
  owns(grantConstraints, [
    'shared_world_standing_context_grants_grantor_fk',
    'shared_world_standing_context_grants_pkey',
    'shared_world_standing_context_grants_revocation_check',
    'shared_world_standing_context_grants_revoked_after_grant_check',
    'shared_world_standing_context_grants_status_check',
    'shared_world_standing_context_grants_world_fk',
  ], 'grants');
  // Every name 0076 chose is well within PostgreSQL's 63-byte identifier limit,
  // so none was silently truncated. Scoped to 0076's own names: what a later
  // reviewed slice names its own constraints is that slice's contract.
  for (const { name } of grantConstraints.filter((c) => c.name.startsWith('shared_world_standing_context_grants_'))) {
    assert.ok(Buffer.byteLength(name) <= 62, `${name} sits below the 63-byte identifier limit`);
  }
  assert.equal(grants.shared_world_standing_context_grants_pkey.def, 'PRIMARY KEY (id)');
  assert.equal(grants.shared_world_standing_context_grants_status_check.type, 'c');
  assert.match(grants.shared_world_standing_context_grants_status_check.def, /'ACTIVE'.*'REVOKED'/u);
  assert.doesNotMatch(grants.shared_world_standing_context_grants_status_check.def, /PENDING|DECLINED|EXPIRED|PAUSED|SUPERSEDED|PUBLIC|MATCHING/u);
  // pg_get_constraintdef renders `'X'::text` and wraps every operand in parentheses; the
  // regexes tolerate that canonical form without accepting a weaker predicate.
  assert.equal(grants.shared_world_standing_context_grants_revocation_check.type, 'c');
  assert.match(grants.shared_world_standing_context_grants_revocation_check.def, /status = 'ACTIVE'(?:::text)?\)? AND \(?revoked_at IS NULL\)/u);
  assert.match(grants.shared_world_standing_context_grants_revocation_check.def, /status = 'REVOKED'(?:::text)?\)? AND \(?revoked_at IS NOT NULL\)/u);
  assert.match(grants.shared_world_standing_context_grants_revocation_check.def, /\) OR \(/u, 'revocation consistency is the disjunction of the two status cases');
  assert.equal(grants.shared_world_standing_context_grants_revoked_after_grant_check.type, 'c');
  assert.match(grants.shared_world_standing_context_grants_revoked_after_grant_check.def, /revoked_at IS NULL\)? OR \(?revoked_at >= granted_at/u);
  for (const [name, parent] of [
    ['shared_world_standing_context_grants_world_fk', 'shared_worlds'],
    ['shared_world_standing_context_grants_grantor_fk', 'users'],
  ]) {
    assert.equal(grants[name].type, 'f', `${name} is a foreign key`);
    assert.equal(grants[name].parent.replace(/^public\./u, ''), parent, `${name} points at public.${parent}`);
    // confdeltype 'r' = RESTRICT: never CASCADE ('c'), SET NULL ('n') or SET DEFAULT ('d').
    assert.equal(grants[name].ondelete, 'r', `${name} deletes restrictively`);
    assert.match(grants[name].def, /ON DELETE RESTRICT/u);
  }

  const audienceConstraints = await constraints(AUDIENCE);
  const audience = byName(audienceConstraints);
  owns(audienceConstraints, [
    'shared_world_standing_context_grant_audience_grant_fk',
    'shared_world_standing_context_grant_audience_pkey',
    'shared_world_standing_context_grant_audience_user_fk',
  ], 'audience ceiling');
  assert.equal(audience.shared_world_standing_context_grant_audience_pkey.def, 'PRIMARY KEY (grant_id, audience_user_id)');
  for (const [name, parent] of [
    ['shared_world_standing_context_grant_audience_grant_fk', 'shared_world_standing_context_grants'],
    ['shared_world_standing_context_grant_audience_user_fk', 'users'],
  ]) {
    assert.equal(audience[name].type, 'f', `${name} is a foreign key`);
    assert.equal(audience[name].parent.replace(/^public\./u, ''), parent, `${name} points at public.${parent}`);
    assert.equal(audience[name].ondelete, 'r', `${name} deletes restrictively`);
    assert.match(audience[name].def, /ON DELETE RESTRICT/u);
  }

  stage = 'schema: indexes';
  const indexes = (table) => rows(
    `SELECT i.relname name, ix.indisunique uniq, pg_get_expr(ix.indpred, ix.indrelid) pred,
            array_to_string(ARRAY(SELECT a.attname FROM unnest(ix.indkey::int2[]) WITH ORDINALITY k(attnum, ord)
                                   JOIN pg_attribute a ON a.attrelid=ix.indrelid AND a.attnum=k.attnum ORDER BY k.ord), ',') cols
       FROM pg_index ix JOIN pg_class i ON i.oid=ix.indexrelid
      WHERE ix.indrelid=$1::regclass ORDER BY i.relname COLLATE "C"`,
    [table],
  );
  // FORWARD SAFETY (I-04C): every index 0076 OWNS, still present and unchanged in
  // uniqueness, key columns and partial predicate. A later additive index from a
  // reviewed slice is not a 0076 regression.
  const ownsIndexes = async (table, expected, label) => {
    const live = new Map((await indexes(table)).map((i) => [i.name, [i.name, i.uniq, i.cols, i.pred]]));
    for (const index of expected) assert.deepEqual(live.get(index[0]), index, `${label} still carries 0076's ${index[0]}, unchanged`);
  };
  await ownsIndexes(GRANTS, [
    ['shared_world_standing_context_grants_one_active_idx', true, 'world_id,grantor_user_id', "(status = 'ACTIVE'::text)"],
    ['shared_world_standing_context_grants_pkey', true, 'id', null],
    ['shared_world_standing_context_grants_world_grantor_idx', false, 'world_id,grantor_user_id', null],
  ], 'grants');
  await ownsIndexes(AUDIENCE, [
    ['shared_world_standing_context_grant_audience_pkey', true, 'grant_id,audience_user_id', null],
    ['shared_world_standing_context_grant_audience_user_idx', false, 'audience_user_id', null],
  ], 'audience ceiling');

  stage = 'schema: no trigger';
  // No trigger on the grant tables, and none on the membership-episode table
  // either: membership expansion has no database path into the audience ceiling.
  for (const table of [...TABLES, EPISODES]) {
    const [{ n }] = await rows('SELECT count(*)::int n FROM pg_trigger WHERE tgrelid=$1::regclass AND NOT tgisinternal', [table]);
    assert.equal(n, 0, `${table} has no trigger`);
  }
}

async function verifyAcls() {
  stage = 'ACLs: catalog';
  for (const table of TABLES) {
    for (const role of APPLICATION_ROLES) {
      for (const privilege of PRIVILEGES) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
    // PUBLIC authority is proven from the catalog ACL: an aclitem whose grantee
    // is empty ("=X/owner") is a PUBLIC grant. aclexplode reports it as grantee 0.
    const [{ n: publicGrants }] = await rows(
      'SELECT count(*)::int n FROM pg_class c, LATERAL aclexplode(c.relacl) a WHERE c.oid=$1::regclass AND a.grantee=0',
      [table],
    );
    assert.equal(publicGrants, 0, `no PUBLIC grant on ${table}`);
    const [{ n: roleGrants }] = await rows(
      `SELECT count(*)::int n FROM pg_class c, LATERAL aclexplode(c.relacl) a
        WHERE c.oid=$1::regclass AND a.grantee IN (SELECT oid FROM pg_roles WHERE rolname = ANY($2::text[]))`,
      [table, APPLICATION_ROLES],
    );
    assert.equal(roleGrants, 0, `no application-role aclitem on ${table}`);
  }

  stage = 'ACLs: policies';
  for (const table of TABLES) {
    const [{ n }] = await rows('SELECT count(*)::int n FROM pg_policy WHERE polrelid=$1::regclass', [table]);
    assert.equal(n, 0, `${table} carries zero RLS policies`);
  }

  stage = 'ACLs: behaviour';
  for (const role of APPLICATION_ROLES) {
    // A subject claim is supplied for authenticated so the denial is a privilege
    // denial, never a missing-identity artefact.
    await identity(role, role === 'authenticated' ? randomUUID() : null);
    for (const table of TABLES) {
      await rejected(() => q(`SELECT * FROM ${table} LIMIT 1`), INSUFFICIENT_PRIVILEGE);
      await rejected(() => q(`DELETE FROM ${table}`), INSUFFICIENT_PRIVILEGE);
    }
    // Neither a direct grant nor a direct revoke nor a direct audience widening.
    await rejected(() => q(
      `INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`,
      [randomUUID(), randomUUID(), randomUUID()],
    ), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`UPDATE ${GRANTS} SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP`), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2)`, [randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`UPDATE ${AUDIENCE} SET audience_user_id=$1`, [randomUUID()]), INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');
}

async function verifyGrantConstraints(world, otherWorld, grantor, other) {
  stage = 'grants: legal ACTIVE grant';
  await identity('postgres');
  const first = randomUUID();
  await q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [first, world, grantor]);
  const [{ clock, open }] = await rows(`SELECT granted_at = now() clock, revoked_at IS NULL open FROM ${GRANTS} WHERE id=$1`, [first]);
  assert.equal(clock, true, 'granted_at defaults to the database transaction clock');
  assert.equal(open, true, 'an ACTIVE grant has no revoked_at');
  // The database deliberately proves NOTHING about membership (task section 17):
  // the grantor has no membership episode in the fixture and the grant still
  // persists. Whether the grant is currently sufficient is I-03's decision.
  const [{ n: episodes }] = await rows(`SELECT count(*)::int n FROM ${EPISODES} WHERE world_id=$1`, [world]);
  assert.equal(episodes, 0, 'no membership episode exists for the fixture World: grant truth is stored independently of membership');

  stage = 'grants: revocation consistency';
  await rejected(() => q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status,revoked_at) VALUES($1,$2,$3,'ACTIVE',CURRENT_TIMESTAMP)`, [randomUUID(), otherWorld, grantor]), CHECK_VIOLATION);
  await rejected(() => q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'REVOKED')`, [randomUUID(), otherWorld, grantor]), CHECK_VIOLATION);
  // The same truths hold on UPDATE: revoking needs revoked_at, an ACTIVE row cannot carry one.
  await rejected(() => q(`UPDATE ${GRANTS} SET status='REVOKED' WHERE id=$1`, [first]), CHECK_VIOLATION);
  await rejected(() => q(`UPDATE ${GRANTS} SET revoked_at=CURRENT_TIMESTAMP WHERE id=$1`, [first]), CHECK_VIOLATION);
  await rejected(() => q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status,granted_at,revoked_at) VALUES($1,$2,$3,'REVOKED','2026-02-01T00:00:00Z','2026-01-01T00:00:00Z')`, [randomUUID(), otherWorld, grantor]), CHECK_VIOLATION);
  await rejected(() => q(`UPDATE ${GRANTS} SET status='REVOKED', revoked_at=granted_at - interval '1 second' WHERE id=$1`, [first]), CHECK_VIOLATION);

  stage = 'grants: vocabulary';
  for (const status of ['PENDING', 'DECLINED', 'EXPIRED', 'PAUSED', 'SUPERSEDED', 'PUBLIC', 'MATCHING', 'active', 'GRANTED']) {
    await rejected(() => q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,$4)`, [randomUUID(), otherWorld, grantor, status]), CHECK_VIOLATION);
  }
  await rejected(() => q(`UPDATE ${GRANTS} SET status='PAUSED' WHERE id=$1`, [first]), CHECK_VIOLATION);

  stage = 'grants: foreign keys';
  await rejected(() => q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [randomUUID(), randomUUID(), grantor]), FK_VIOLATION);
  await rejected(() => q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [randomUUID(), otherWorld, randomUUID()]), FK_VIOLATION);
  await rejected(() => q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,NULL,$2,'ACTIVE')`, [randomUUID(), grantor]), NOT_NULL_VIOLATION);
  await rejected(() => q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,NULL,'ACTIVE')`, [randomUUID(), otherWorld]), NOT_NULL_VIOLATION);
  await rejected(() => q(`UPDATE ${GRANTS} SET world_id=$1 WHERE id=$2`, [randomUUID(), first]), FK_VIOLATION);

  stage = 'grants: one current ACTIVE grant per (world, grantor)';
  await rejected(() => q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [randomUUID(), world, grantor]), UNIQUE_VIOLATION);
  // The same human may hold an ACTIVE grant in another exact World, and another
  // human may hold one in this World: the ceiling is per (world, grantor).
  const elsewhere = randomUUID(), others = randomUUID();
  await q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [elsewhere, otherWorld, grantor]);
  await q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [others, world, other]);
  await rejected(() => q(`UPDATE ${GRANTS} SET world_id=$1 WHERE id=$2`, [world, elsewhere]), UNIQUE_VIOLATION);

  stage = 'grants: revoke, then a new ACTIVE grant for the same pair';
  // The first grant was granted on the database clock, so its revocation and the
  // reconfirmation are placed relative to that clock (revoked_at >= granted_at).
  await q(`UPDATE ${GRANTS} SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP + interval '1 hour' WHERE id=$1`, [first]);
  const second = randomUUID();
  await q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status,granted_at) VALUES($1,$2,$3,'ACTIVE',CURRENT_TIMESTAMP + interval '2 hours')`, [second, world, grantor]);
  const history = await rows(`SELECT id, status FROM ${GRANTS} WHERE world_id=$1 AND grantor_user_id=$2 ORDER BY granted_at`, [world, grantor]);
  assert.deepEqual(history.map((r) => [r.id, r.status]), [[first, 'REVOKED'], [second, 'ACTIVE']], 'revocation keeps the historical row and the reconfirmation is a new row');
  // With the new grant ACTIVE, neither a third ACTIVE row nor reactivating the revoked one is possible.
  await rejected(() => q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [randomUUID(), world, grantor]), UNIQUE_VIOLATION);
  await rejected(() => q(`UPDATE ${GRANTS} SET status='ACTIVE', revoked_at=NULL WHERE id=$1`, [first]), UNIQUE_VIOLATION);
  // Any number of REVOKED rows for the same pair coexist as history.
  await q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status,granted_at,revoked_at) VALUES($1,$2,$3,'REVOKED','2025-06-01T00:00:00Z','2025-07-01T00:00:00Z')`, [randomUUID(), world, grantor]);
  // The primary key also refuses a replayed grant id.
  await rejected(() => q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status,granted_at,revoked_at) VALUES($1,$2,$3,'REVOKED','2025-06-01T00:00:00Z','2025-07-01T00:00:00Z')`, [first, world, grantor]), UNIQUE_VIOLATION);
  return { first, second, others };
}

async function verifyAudienceCeiling(world, grants, grantor, other, third) {
  stage = 'audience: ceiling rows';
  await identity('postgres');
  // The revoked grant's ceiling was {grantor, other}; the reconfirmed grant's
  // ceiling is the explicitly authorized wider set {grantor, other, third}.
  // Nothing derived it from membership: the fixture has no membership episode.
  await q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2),($1,$3)`, [grants.first, grantor, other]);
  await q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2),($1,$3),($1,$4)`, [grants.second, grantor, other, third]);
  const ceiling = await rows(`SELECT grant_id, count(*)::int n FROM ${AUDIENCE} WHERE grant_id = ANY($1::uuid[]) GROUP BY grant_id ORDER BY n`, [[grants.first, grants.second]]);
  assert.deepEqual(ceiling.map((r) => [r.grant_id, r.n]), [[grants.first, 2], [grants.second, 3]], 'each grant carries exactly its own explicitly authorized ceiling');

  stage = 'audience: uniqueness and foreign keys';
  await rejected(() => q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2)`, [grants.second, third]), UNIQUE_VIOLATION);
  await rejected(() => q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2)`, [grants.second, randomUUID()]), FK_VIOLATION);
  await rejected(() => q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2)`, [randomUUID(), third]), FK_VIOLATION);
  await rejected(() => q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,NULL)`, [grants.second]), NOT_NULL_VIOLATION);
  await rejected(() => q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES(NULL,$1)`, [third]), NOT_NULL_VIOLATION);

  stage = 'audience: restrictive deletion';
  // Neither the World, the grantor, an audience-only human, nor a grant with
  // ceiling rows can be deleted: grant truth is never cascaded away.
  await rejected(() => q(`DELETE FROM ${WORLDS} WHERE id=$1`, [world]), FK_VIOLATION);
  await rejected(() => q('DELETE FROM public.users WHERE id=$1', [grantor]), FK_VIOLATION);
  await rejected(() => q('DELETE FROM public.users WHERE id=$1', [third]), FK_VIOLATION);
  await rejected(() => q(`DELETE FROM ${GRANTS} WHERE id=$1`, [grants.first]), FK_VIOLATION);
  await rejected(() => q(`DELETE FROM ${GRANTS} WHERE id=$1`, [grants.second]), FK_VIOLATION);
  const [{ worlds, grantRows, audienceRows }] = await rows(
    `SELECT (SELECT count(*)::int FROM ${WORLDS} WHERE id=$1) worlds,
            (SELECT count(*)::int FROM ${GRANTS} WHERE world_id=$1) "grantRows",
            (SELECT count(*)::int FROM ${AUDIENCE} WHERE grant_id = ANY($2::uuid[])) "audienceRows"`,
    [world, [grants.first, grants.second]],
  );
  assert.equal(worlds, 1, 'the World survives the refused delete');
  assert.equal(grantRows, 4, 'every grant row (two revoked, two active) survives the refused deletes');
  assert.equal(audienceRows, 5, 'every ceiling row survives the refused deletes');
}

async function main() {
  const grantor = randomUUID(), other = randomUUID(), third = randomUUID();
  const world = randomUUID(), otherWorld = randomUUID();
  let grantIds = [];
  try {
    await client.connect();
    await verifySchema();
    await q('BEGIN');
    try {
      await verifyAcls();
      await identity('postgres');
      // Fixture humans are provisioned the canonical way (auth.users -> the
      // migration-0002 trigger -> public.users); fixture Worlds are inserted by
      // the owner exactly as the 0075 verifier does. No application role is
      // used to create anything.
      await q('INSERT INTO auth.users(id) VALUES($1),($2),($3)', [grantor, other, third]);
      await q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION'),($2,'ACTIVE','STANDARD','ACCEPTED_INVITATION')`, [world, otherWorld]);
      const grants = await verifyGrantConstraints(world, otherWorld, grantor, other);
      grantIds = Object.values(grants);
      await verifyAudienceCeiling(world, grants, grantor, other, third);
      await identity('postgres');
    } finally {
      await q('ROLLBACK');
    }
    stage = 'fixture residue';
    const [{ n }] = await rows(
      `SELECT (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${GRANTS} WHERE id = ANY($2::uuid[]) OR world_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${AUDIENCE} WHERE grant_id = ANY($2::uuid[]) OR audience_user_id = ANY($3::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($3::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($3::uuid[])) AS n`,
      [[world, otherWorld], grantIds, [grantor, other, third]],
    );
    assert.equal(Number(n), 0, 'no fixture row remains after completion');
    console.log('Verified migration 0076: shared_world_standing_context_grants and shared_world_standing_context_grant_audience exist and still carry every column they own, unchanged and in its original position, with later additive columns permitted and no column of any kind a scope/purpose/action/source/permission/JSON column, ACTIVE|REVOKED status, revocation-consistency and revoked-after-granted checks, restrictive FKs to shared_worlds and users only, one-ACTIVE-grant partial uniqueness, per-grant audience uniqueness and RLS on; anon/authenticated/service_role/PUBLIC hold no privilege and no policy exists; every illegal status/revocation/FK row is rejected; revocation keeps history and reconfirmation is a new row; no trigger touches the tables; zero fixture residue.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Shared Standing Context Grant persistence verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
