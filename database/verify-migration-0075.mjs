// Real-PostgreSQL verifier for migration 0075 - Connected Worlds Shared World
// Core Persistence & Deny-by-Default RLS Foundation v1 (I-02A).
//
// Runs against a fully migrated database and proves, from live catalogs and
// live behaviour rather than from the migration text:
//
//   * schema: both Shared tables exist, are owned by postgres, and still carry
//     every column / type / nullability / default, every check and foreign-key
//     constraint with restrictive deletion, the partial one-open-episode unique
//     index and the two join-order indexes that migration 0075 OWNS - unchanged
//     and in their original positions - with RLS on and no trigger. Later
//     additive columns, constraints and indexes from a reviewed slice are
//     permitted: an exact live-shape census would be a mutable-global ceiling
//     rather than a fact about 0075. (Whether a later, separately verified narrow read
//     boundary references these tables is not a 0075 property: this verifier
//     proves that 0075 itself sealed them, not a global ceiling on every
//     future function.)
//   * ACLs: anon, authenticated and service_role hold no SELECT / INSERT /
//     UPDATE / DELETE on either table (has_table_privilege AND an actual
//     rejected statement under SET LOCAL ROLE), PUBLIC holds no grant, and
//     zero RLS policies exist;
//   * behaviour, under the fixture owner inside one rolled-back transaction:
//     the legal lifecycle / phase / birth-basis rows insert, born_at is the
//     database clock, every illegal combination is rejected by its check,
//     membership closes and rejoins as a NEW episode, a second open episode is
//     rejected, ended-before-joined is rejected, a missing World or user is
//     rejected, and neither a World with history nor a user with episodes can
//     be deleted through the restrictive foreign keys;
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
const TABLES = [WORLDS, EPISODES];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
const CHECK_VIOLATION = ['23514'];
const UNIQUE_VIOLATION = ['23505'];
const FK_VIOLATION = ['23503'];
const INSUFFICIENT_PRIVILEGE = ['42501'];

/**
 * FORWARD SAFETY (I-04C).
 *
 * These lists are what migration 0075 OWNS, not a census of the live schema. An
 * exact-live-shape assertion is a mutable-global ceiling: it fails the moment a
 * later reviewed slice evolves a table additively, which is not a fact about
 * 0075 - I-04C's additive `end_reason` on the canonical episode (CW2-03 §15,
 * which models `end_reason?` and which 0075 simply had no writer for yet) is the
 * first such evolution. The historical contract is preserved exactly and
 * deliberately not weakened:
 *
 *   every column 0075 created is still present, with its original type,
 *   nullability, default AND original ordinal position - a prefix, so a drop, a
 *   type change or a reorder still fails - while later additive columns, which
 *   can only be appended, are permitted;
 *
 *   every constraint and index 0075 created is still present and still means
 *   exactly what it meant, each asserted individually below, while a later
 *   additive constraint or index is permitted.
 *
 * What 0075 really guarantees is proven either way by the behaviour section: the
 * illegal lifecycle / phase / birth-basis combinations are still rejected, a
 * second open episode is still rejected, and the restrictive foreign keys still
 * refuse to cascade.
 */
const EXPECTED_COLUMNS = {
  [WORLDS]: [
    ['id', 'uuid', 'NO', null],
    ['lifecycle', 'text', 'NO', null],
    ['phase', 'text', 'NO', null],
    ['birth_basis', 'text', 'NO', null],
    ['born_at', 'timestamp with time zone', 'NO', 'CURRENT_TIMESTAMP'],
    ['closed_at', 'timestamp with time zone', 'YES', null],
  ],
  [EPISODES]: [
    ['id', 'uuid', 'NO', null],
    ['world_id', 'uuid', 'NO', null],
    ['user_id', 'uuid', 'NO', null],
    ['joined_at', 'timestamp with time zone', 'NO', null],
    ['ended_at', 'timestamp with time zone', 'YES', null],
  ],
};

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
  const [{ n: genericWorlds }] = await rows(
    "SELECT count(*)::int n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relname='worlds'",
  );
  assert.equal(genericWorlds, 0, 'no generic public.worlds table exists');

  stage = 'schema: columns';
  for (const table of TABLES) {
    const columns = await rows(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [table.replace('public.', '')],
    );
    const observed = columns.map((c) => [c.column_name, c.data_type, c.is_nullable, c.column_default]);
    const owned = EXPECTED_COLUMNS[table];
    assert.deepEqual(
      observed.slice(0, owned.length),
      owned,
      `${table} still carries every column migration 0075 owns, unchanged and in its original position`,
    );
    for (const [name] of owned) {
      assert.equal(observed.filter((column) => column[0] === name).length, 1, `${table}.${name} appears exactly once`);
    }
    for (const { column_name: name } of columns) {
      assert.doesNotMatch(name, /owner|admin|inviter|creator|initiator|privilege/iu, `${table}.${name} is not a superior authority column`);
    }
  }

  stage = 'schema: constraints';
  const constraints = async (table) => rows(
    `SELECT conname name, contype type, pg_get_constraintdef(oid) def, confdeltype ondelete,
            CASE WHEN confrelid <> 0 THEN confrelid::regclass::text ELSE NULL END parent
       FROM pg_constraint WHERE conrelid=$1::regclass ORDER BY conname`,
    [table],
  );
  const worldConstraints = await constraints(WORLDS);
  const byName = (list) => Object.fromEntries(list.map((c) => [c.name, c]));
  const worlds = byName(worldConstraints);
  const owns = (list, names, table) => {
    const present = new Set(list.map((c) => c.name));
    for (const name of names) assert.ok(present.has(name), `${table} still carries migration 0075's ${name}`);
  };
  owns(worldConstraints, [
    'shared_worlds_birth_basis_check',
    'shared_worlds_closed_after_birth_check',
    'shared_worlds_closure_consistency_check',
    'shared_worlds_direct_birth_phase_check',
    'shared_worlds_lifecycle_check',
    'shared_worlds_phase_check',
    'shared_worlds_pkey',
  ], 'shared_worlds');
  assert.equal(worlds.shared_worlds_pkey.def, 'PRIMARY KEY (id)');
  assert.match(worlds.shared_worlds_lifecycle_check.def, /'ACTIVE'.*'READ_ONLY_CLOSED'/u);
  assert.match(worlds.shared_worlds_phase_check.def, /'STANDARD'.*'INTRODUCTION'/u);
  assert.match(worlds.shared_worlds_birth_basis_check.def, /'ACCEPTED_INVITATION'.*'MUTUAL_MATCH'/u);
  // pg_get_constraintdef renders `'X'::text` and wraps every operand in parentheses; the
  // regexes tolerate that canonical form without accepting a weaker predicate.
  assert.match(worlds.shared_worlds_closure_consistency_check.def, /lifecycle = 'ACTIVE'(?:::text)?\)? AND \(?closed_at IS NULL\)/u);
  assert.match(worlds.shared_worlds_closure_consistency_check.def, /lifecycle = 'READ_ONLY_CLOSED'(?:::text)?\)? AND \(?closed_at IS NOT NULL\)/u);
  assert.match(worlds.shared_worlds_closure_consistency_check.def, /\) OR \(/u, 'closure consistency is the disjunction of the two lifecycle cases');
  assert.match(worlds.shared_worlds_direct_birth_phase_check.def, /birth_basis <> 'ACCEPTED_INVITATION'(?:::text)?\)? OR \(?phase = 'STANDARD'(?:::text)?/u);
  assert.match(worlds.shared_worlds_closed_after_birth_check.def, /closed_at IS NULL\)? OR \(?closed_at >= born_at/u);
  for (const name of ['shared_worlds_birth_basis_check', 'shared_worlds_closed_after_birth_check',
    'shared_worlds_closure_consistency_check', 'shared_worlds_direct_birth_phase_check',
    'shared_worlds_lifecycle_check', 'shared_worlds_phase_check', 'shared_worlds_pkey']) {
    assert.equal(worlds[name].type, name === 'shared_worlds_pkey' ? 'p' : 'c', `${name} kind`);
  }

  const episodeConstraints = await constraints(EPISODES);
  const episodes = byName(episodeConstraints);
  owns(episodeConstraints, [
    'shared_world_membership_episodes_interval_check',
    'shared_world_membership_episodes_pkey',
    'shared_world_membership_episodes_user_fk',
    'shared_world_membership_episodes_world_fk',
  ], 'membership episodes');
  assert.equal(episodes.shared_world_membership_episodes_pkey.def, 'PRIMARY KEY (id)');
  assert.equal(episodes.shared_world_membership_episodes_interval_check.type, 'c');
  assert.match(episodes.shared_world_membership_episodes_interval_check.def, /ended_at IS NULL\)? OR \(?ended_at >= joined_at/u);
  for (const [name, parent] of [
    ['shared_world_membership_episodes_world_fk', 'shared_worlds'],
    ['shared_world_membership_episodes_user_fk', 'users'],
  ]) {
    assert.equal(episodes[name].type, 'f', `${name} is a foreign key`);
    assert.equal(episodes[name].parent.replace(/^public\./u, ''), parent, `${name} points at public.${parent}`);
    // confdeltype 'r' = RESTRICT: never CASCADE ('c'), SET NULL ('n') or SET DEFAULT ('d').
    assert.equal(episodes[name].ondelete, 'r', `${name} deletes restrictively`);
    assert.match(episodes[name].def, /ON DELETE RESTRICT/u);
  }

  stage = 'schema: indexes';
  const indexes = await rows(
    `SELECT i.relname name, ix.indisunique uniq, pg_get_expr(ix.indpred, ix.indrelid) pred,
            array_to_string(ARRAY(SELECT a.attname FROM unnest(ix.indkey::int2[]) WITH ORDINALITY k(attnum, ord)
                                   JOIN pg_attribute a ON a.attrelid=ix.indrelid AND a.attnum=k.attnum ORDER BY k.ord), ',') cols
       FROM pg_index ix JOIN pg_class i ON i.oid=ix.indexrelid
      WHERE ix.indrelid=$1::regclass ORDER BY i.relname`,
    [EPISODES],
  );
  const observedIndexes = new Map(indexes.map((i) => [i.name, [i.name, i.uniq, i.cols, i.pred]]));
  for (const owned of [
    ['shared_world_membership_episodes_one_open_idx', true, 'world_id,user_id', '(ended_at IS NULL)'],
    ['shared_world_membership_episodes_pkey', true, 'id', null],
    ['shared_world_membership_episodes_user_joined_idx', false, 'user_id,joined_at', null],
    ['shared_world_membership_episodes_world_joined_idx', false, 'world_id,joined_at', null],
  ]) {
    assert.deepEqual(observedIndexes.get(owned[0]), owned, `membership episodes still carry 0075's ${owned[0]}, unchanged`);
  }
  const worldIndexes = await rows(
    'SELECT i.relname name, ix.indisunique uniq FROM pg_index ix JOIN pg_class i ON i.oid=ix.indexrelid WHERE ix.indrelid=$1::regclass ORDER BY i.relname',
    [WORLDS],
  );
  const worldPkey = worldIndexes.find((i) => i.name === 'shared_worlds_pkey');
  assert.ok(worldPkey && worldPkey.uniq === true, "shared_worlds still carries 0075's unique primary key index");

  stage = 'schema: no trigger';
  for (const table of TABLES) {
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
    await rejected(() => q(
      `INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION')`,
      [randomUUID()],
    ), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`UPDATE ${WORLDS} SET lifecycle='READ_ONLY_CLOSED', closed_at=CURRENT_TIMESTAMP`), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(
      `INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP)`,
      [randomUUID(), randomUUID(), randomUUID()],
    ), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`UPDATE ${EPISODES} SET ended_at=CURRENT_TIMESTAMP`), INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');
}

async function verifyWorldConstraints() {
  stage = 'worlds: legal rows';
  await identity('postgres');
  const direct = randomUUID(), introduction = randomUUID(), graduated = randomUUID(), closedStandard = randomUUID(), closedIntroduction = randomUUID();
  await q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION')`, [direct]);
  await q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,'ACTIVE','INTRODUCTION','MUTUAL_MATCH')`, [introduction]);
  // A Mutual Match World that completed its Introduction keeps its id and is STANDARD.
  await q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,'ACTIVE','STANDARD','MUTUAL_MATCH')`, [graduated]);
  await q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis,closed_at) VALUES($1,'READ_ONLY_CLOSED','STANDARD','ACCEPTED_INVITATION',CURRENT_TIMESTAMP)`, [closedStandard]);
  await q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis,closed_at) VALUES($1,'READ_ONLY_CLOSED','INTRODUCTION','MUTUAL_MATCH',CURRENT_TIMESTAMP)`, [closedIntroduction]);
  const [{ derived }] = await rows(`SELECT bool_and(born_at = now()) derived FROM ${WORLDS} WHERE id = ANY($1::uuid[])`, [[direct, introduction, graduated, closedStandard, closedIntroduction]]);
  assert.equal(derived, true, 'born_at defaults to the database transaction clock');
  const [{ closed }] = await rows(`SELECT closed_at IS NULL closed FROM ${WORLDS} WHERE id=$1`, [direct]);
  assert.equal(closed, true, 'an ACTIVE World has no closed_at');

  stage = 'worlds: closure consistency';
  await rejected(() => q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis,closed_at) VALUES($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION',CURRENT_TIMESTAMP)`, [randomUUID()]), CHECK_VIOLATION);
  await rejected(() => q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,'READ_ONLY_CLOSED','STANDARD','ACCEPTED_INVITATION')`, [randomUUID()]), CHECK_VIOLATION);
  // The same truths hold on UPDATE: closing needs closed_at, and an ACTIVE row cannot carry one.
  await rejected(() => q(`UPDATE ${WORLDS} SET lifecycle='READ_ONLY_CLOSED' WHERE id=$1`, [direct]), CHECK_VIOLATION);
  await rejected(() => q(`UPDATE ${WORLDS} SET closed_at=CURRENT_TIMESTAMP WHERE id=$1`, [direct]), CHECK_VIOLATION);
  await rejected(() => q(`UPDATE ${WORLDS} SET closed_at=NULL WHERE id=$1`, [closedStandard]), CHECK_VIOLATION);
  await rejected(() => q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis,born_at,closed_at) VALUES($1,'READ_ONLY_CLOSED','STANDARD','ACCEPTED_INVITATION','2026-02-01T00:00:00Z','2026-01-01T00:00:00Z')`, [randomUUID()]), CHECK_VIOLATION);

  stage = 'worlds: direct-invitation phase';
  await rejected(() => q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,'ACTIVE','INTRODUCTION','ACCEPTED_INVITATION')`, [randomUUID()]), CHECK_VIOLATION);
  await rejected(() => q(`UPDATE ${WORLDS} SET phase='INTRODUCTION' WHERE id=$1`, [direct]), CHECK_VIOLATION);
  await rejected(() => q(`UPDATE ${WORLDS} SET birth_basis='ACCEPTED_INVITATION' WHERE id=$1`, [introduction]), CHECK_VIOLATION);

  stage = 'worlds: vocabulary';
  for (const [lifecycle, phase, basis] of [
    ['DORMANT', 'STANDARD', 'ACCEPTED_INVITATION'],
    ['PENDING', 'STANDARD', 'ACCEPTED_INVITATION'],
    ['ARCHIVED', 'STANDARD', 'ACCEPTED_INVITATION'],
    ['ACTIVE', 'PUBLIC', 'ACCEPTED_INVITATION'],
    ['ACTIVE', 'REPLAY', 'MUTUAL_MATCH'],
    ['ACTIVE', 'STANDARD', 'PENDING_PROPOSAL'],
    ['ACTIVE', 'STANDARD', 'INVITATION'],
    ['active', 'STANDARD', 'ACCEPTED_INVITATION'],
  ]) {
    await rejected(() => q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,$2,$3,$4)`, [randomUUID(), lifecycle, phase, basis]), CHECK_VIOLATION);
  }
  await rejected(() => q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION')`, [direct]), UNIQUE_VIOLATION);
  return { direct, introduction, closedStandard };
}

async function verifyMembershipEpisodes(worlds, member, other) {
  stage = 'episodes: open, close, rejoin';
  await identity('postgres');
  const first = randomUUID(), second = randomUUID();
  await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,'2026-01-01T00:00:00Z')`, [first, worlds.direct, member]);
  // A second open episode for the same (world, user) is refused while the first is open.
  await rejected(() => q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,'2026-01-02T00:00:00Z')`, [randomUUID(), worlds.direct, member]), UNIQUE_VIOLATION);
  // The same human may be open in another World, and another human in this World.
  await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,'2026-01-01T00:00:00Z')`, [randomUUID(), worlds.introduction, member]);
  await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,'2026-01-01T00:00:00Z')`, [randomUUID(), worlds.direct, other]);
  // Leave closes the episode; rejoin is a NEW row, and the closed episode survives as history.
  await q(`UPDATE ${EPISODES} SET ended_at='2026-02-01T00:00:00Z' WHERE id=$1`, [first]);
  await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,'2026-03-01T00:00:00Z')`, [second, worlds.direct, member]);
  const history = await rows(`SELECT id, ended_at IS NULL open FROM ${EPISODES} WHERE world_id=$1 AND user_id=$2 ORDER BY joined_at`, [worlds.direct, member]);
  assert.deepEqual(history.map((r) => [r.id, r.open]), [[first, false], [second, true]], 'leave + rejoin are two episodes, the earlier one preserved closed');
  // With the rejoin open, a further open episode is refused again.
  await rejected(() => q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,'2026-04-01T00:00:00Z')`, [randomUUID(), worlds.direct, member]), UNIQUE_VIOLATION);
  await rejected(() => q(`UPDATE ${EPISODES} SET ended_at=NULL WHERE id=$1`, [first]), UNIQUE_VIOLATION);

  stage = 'episodes: interval';
  await rejected(() => q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at,ended_at) VALUES($1,$2,$3,'2026-02-01T00:00:00Z','2026-01-01T00:00:00Z')`, [randomUUID(), worlds.closedStandard, member]), CHECK_VIOLATION);
  await rejected(() => q(`UPDATE ${EPISODES} SET ended_at='2025-12-31T00:00:00Z' WHERE id=$1`, [second]), CHECK_VIOLATION);
  // An instantaneous episode (ended_at = joined_at) is a legal closed interval.
  await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at,ended_at) VALUES($1,$2,$3,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`, [randomUUID(), worlds.closedStandard, member]);

  stage = 'episodes: foreign keys';
  await rejected(() => q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP)`, [randomUUID(), randomUUID(), member]), FK_VIOLATION);
  await rejected(() => q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP)`, [randomUUID(), worlds.direct, randomUUID()]), FK_VIOLATION);
  await rejected(() => q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,NULL,$2,CURRENT_TIMESTAMP)`, [randomUUID(), member]), ['23502']);

  stage = 'episodes: restrictive deletion';
  // Neither a World with membership history nor a user with episodes can be
  // deleted: the history is never cascaded away.
  await rejected(() => q(`DELETE FROM ${WORLDS} WHERE id=$1`, [worlds.direct]), FK_VIOLATION);
  await rejected(() => q('DELETE FROM public.users WHERE id=$1', [member]), FK_VIOLATION);
  const [{ n: worldsLeft }] = await rows(`SELECT count(*)::int n FROM ${WORLDS} WHERE id=$1`, [worlds.direct]);
  const [{ n: episodesLeft }] = await rows(`SELECT count(*)::int n FROM ${EPISODES} WHERE world_id=$1`, [worlds.direct]);
  assert.equal(worldsLeft, 1, 'the World survives the refused delete');
  assert.equal(episodesLeft, 3, 'every episode survives the refused delete');
}

async function main() {
  const member = randomUUID(), other = randomUUID();
  const worldIds = [];
  try {
    await client.connect();
    await verifySchema();
    await q('BEGIN');
    try {
      await verifyAcls();
      await identity('postgres');
      // Fixture humans are provisioned the canonical way (auth.users -> the
      // migration-0002 trigger -> public.users); no application role is used
      // to create anything.
      await q('INSERT INTO auth.users(id) VALUES($1),($2)', [member, other]);
      const worlds = await verifyWorldConstraints();
      worldIds.push(...Object.values(worlds));
      await verifyMembershipEpisodes(worlds, member, other);
      await identity('postgres');
    } finally {
      await q('ROLLBACK');
    }
    stage = 'fixture residue';
    const [{ n }] = await rows(
      `SELECT (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${EPISODES} WHERE user_id = ANY($2::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($2::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($2::uuid[])) AS n`,
      [worldIds, [member, other]],
    );
    assert.equal(Number(n), 0, 'no fixture row remains after completion');
    console.log('Verified migration 0075: shared_worlds and shared_world_membership_episodes exist and still carry every frozen column (unchanged and in its original position, with later additive columns permitted), check, restrictive foreign keys, one-open-episode partial uniqueness and RLS on; anon/authenticated/service_role/PUBLIC hold no privilege and no policy exists; every illegal lifecycle/phase/birth-basis/closure row is rejected; membership closes and rejoins as a new episode; no trigger touches the tables; zero fixture residue.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Connected Worlds Shared persistence foundation verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
