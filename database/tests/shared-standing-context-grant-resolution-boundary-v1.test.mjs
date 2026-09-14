// I-03B - Shared Standing Context Grant Resolution Boundary v1: secret-free
// structural contract over migration 0077, the 0077 verifier, the narrowly
// authorized forward-safety correction of the 0076 verifier, and the API-side
// resolver adapter.
//
// Every "must not contain" assertion runs against executable SQL / TypeScript
// (comments stripped). Live semantics are proven by the real PostgreSQL
// verifier this file pins into the toolchain and CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION_NAME = '0077_shared_standing_context_grant_resolution_boundary_v1.sql';
const FN = 'resolve_shared_world_standing_context_grant_v1';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const migration0076 = read('../migrations/0076_shared_world_standing_context_grant_persistence_v1.sql');
const verifier = read('../verify-migration-0077.mjs');
const verifier0076 = read('../verify-migration-0076.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const resolver = read('../../apps/api/src/connected-worlds/authority-resolution/standing-context-grant-resolver.service.ts');
const authorityTypes = read('../../apps/api/src/connected-worlds/authority/standing-context-authority.types.ts');

const stripSqlComments = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const stripTsComments = (ts) => ts.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^[ \t]*\/\/.*$/gmu, '').replace(/[ \t]\/\/[^'"\n]*$/gmu, '');
const executableSql = stripSqlComments(migration);
const executableResolver = stripTsComments(resolver);
const functionBody = (() => {
  const start = executableSql.indexOf(`CREATE FUNCTION public.${FN}`);
  const end = executableSql.indexOf('END$$;', start);
  assert.ok(start >= 0 && end > start, 'the resolver function body is present');
  return executableSql.slice(start, end + 'END$$;'.length);
})();
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

test('0077 exists once, is the forward migration after 0076, and creates exactly one narrow read function and nothing else', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((name) => name.startsWith('0077_')).length, 1, 'exactly one migration carries the 0077 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0076_shared_world_standing_context_grant_persistence_v1.sql'));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  const functions = [...executableSql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((m) => m[1]);
  assert.deepEqual(functions, [FN], 'exactly one function');
  assert.doesNotMatch(executableSql, /CREATE (?:TABLE|VIEW|MATERIALIZED VIEW|TRIGGER|POLICY|EXTENSION|TYPE|INDEX|SEQUENCE|PROCEDURE)|ALTER TABLE|DROP /iu, 'no table, view, trigger, policy, extension, type, index or alteration');
  assert.doesNotMatch(executableSql, /consent|permission_engine|generic|context_admission/iu, 'no generic consent / permission function');
  // No historical migration is edited: 0076 is byte-identical to its merged blob.
  assert.equal(gitBlobId(migration0076), '3b2e1f35f1a7441ac09c482877294df5d42b9693', 'migration 0076 is byte-unchanged');
  assert.equal(migrations.filter((name) => name.startsWith('0076_')).length, 1);
});

test('the resolver takes exactly (world uuid, grantor uuid) and returns exactly the five minimal columns', () => {
  assert.match(functionBody, new RegExp(`CREATE FUNCTION public\\.${FN}\\(p_world_id uuid, p_grantor_user_id uuid\\)\\nRETURNS TABLE\\(grant_id uuid, world_id uuid, grantor_user_id uuid, status text, audience_user_id uuid\\)`, 'u'));
  // The rowset carries nothing else: no purpose / scope / permission / disclosure / provenance / membership column.
  assert.doesNotMatch(functionBody, /purpose|scope|permission|disclos|provenance|material|matching|public_world|public_experience|replay|ttl|expir|granted_at|revoked_at/iu);
});

test('the resolver is SECURITY DEFINER, STABLE, search_path-pinned, fully qualified, and reads only the grant and audience tables', () => {
  assert.match(functionBody, /LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS \$\$/u);
  const tableReferences = [...functionBody.matchAll(/\b(?:FROM|JOIN)\s+([\w.]+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(tableReferences)], ['public.shared_world_standing_context_grant_audience', 'public.shared_world_standing_context_grants', 'public.shared_worlds', 'public.users'],
    'only the grant, audience, Shared World and users tables are read, all fully qualified');
  for (const reference of tableReferences) assert.match(reference, /^public\./u);
  assert.doesNotMatch(functionBody, /membership_episodes|conversation|memories|him_|hypothes|auth\.uid|request\.jwt|current_setting/iu, 'membership, Personal context, HIM and client identity are never read');
});

test('canonical Shared World and human existence are positively checked before any answer', () => {
  assert.match(functionBody, /IF NOT EXISTS \(SELECT 1 FROM public\.shared_worlds w WHERE w\.id = p_world_id\) THEN\s+RAISE EXCEPTION '[^']+' USING ERRCODE='P0002';/u);
  assert.match(functionBody, /IF NOT EXISTS \(SELECT 1 FROM public\.users u WHERE u\.id = p_grantor_user_id\) THEN\s+RAISE EXCEPTION '[^']+' USING ERRCODE='P0002';/u);
  assert.match(functionBody, /IF p_world_id IS NULL OR p_grantor_user_id IS NULL THEN\s+RAISE EXCEPTION '[^']+' USING ERRCODE='22023';/u);
  // Both checks precede the RETURN QUERY.
  assert.ok(functionBody.indexOf('FROM public.shared_worlds w') < functionBody.indexOf('RETURN QUERY'));
  assert.ok(functionBody.indexOf('FROM public.users u') < functionBody.indexOf('RETURN QUERY'));
});

test('the query is exact World + exact grantor + ACTIVE only, LEFT JOINed to the explicit audience rows of that exact grant', () => {
  const query = functionBody.slice(functionBody.indexOf('RETURN QUERY'));
  assert.match(query, /SELECT g\.id, g\.world_id, g\.grantor_user_id, g\.status, a\.audience_user_id\s+FROM public\.shared_world_standing_context_grants g\s+LEFT JOIN public\.shared_world_standing_context_grant_audience a ON a\.grant_id = g\.id\s+WHERE g\.world_id = p_world_id\s+AND g\.grantor_user_id = p_grantor_user_id\s+AND g\.status = 'ACTIVE'\s+ORDER BY a\.audience_user_id;/u);
  assert.doesNotMatch(query, /'REVOKED'|ORDER BY g\.|LIMIT|DISTINCT ON|UNION|granted_at DESC|revoked_at/u, 'no "latest revoked row" rule, no grant combination');
  assert.equal((query.match(/JOIN/gu) ?? []).length, 1, 'exactly one join, the explicit audience table');
});

test('the resolver writes nothing', () => {
  assert.doesNotMatch(functionBody, /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|NOTIFY|PERFORM)\b/u);
  assert.doesNotMatch(executableSql, /\b(?:INSERT INTO|UPDATE public|DELETE FROM|MERGE|TRUNCATE)\b/u);
});

test('EXECUTE is revoked from PUBLIC, anon and authenticated and granted to service_role alone; no direct table privilege is granted', () => {
  assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${FN}\\(uuid, uuid\\) FROM PUBLIC, anon, authenticated;`, 'u'));
  assert.match(executableSql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${FN}\\(uuid, uuid\\) TO service_role;`, 'u'));
  const grants = [...executableSql.matchAll(/^\s*GRANT\b.*$/gmu)].map((m) => m[0].trim());
  assert.deepEqual(grants, [`GRANT EXECUTE ON FUNCTION public.${FN}(uuid, uuid) TO service_role;`], 'the ONLY grant is EXECUTE to service_role');
  assert.doesNotMatch(executableSql, /GRANT (?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE)|ON TABLE|TO authenticated|TO anon|TO PUBLIC|CREATE POLICY|DISABLE ROW LEVEL SECURITY/iu);
  // The terminal self-assertion re-proves the seal at deploy time.
  assert.match(executableSql, /IF has_function_privilege\('public', fn, 'EXECUTE'\) THEN RAISE EXCEPTION/u);
  assert.match(executableSql, /IF NOT has_function_privilege\('service_role', fn, 'EXECUTE'\) THEN/u);
  assert.match(executableSql, /FOREACH target_role IN ARRAY ARRAY\['anon','authenticated','service_role'\]/u);
  assert.match(executableSql, /IF has_table_privilege\(target_role, target_table, target_privilege\) THEN\s+RAISE EXCEPTION 'I-03B: direct table access stays sealed/u);
  assert.match(executableSql, /IF p\.provolatile <> 's' THEN RAISE EXCEPTION/u);
  assert.match(executableSql, /IF NOT p\.prosecdef THEN RAISE EXCEPTION/u);
  assert.match(executableSql, /cfg IN \('search_path=', 'search_path=""'\)/u);
});

test('the 0076 verifier correction removes only its future-global function ceiling and keeps every seal proof', () => {
  assert.doesNotMatch(verifier0076, /pg_proc|touchingFunctions|no public function/u, 'the mutable-global "no future function may touch the tables" assertion is gone');
  assert.doesNotMatch(verifier0076, new RegExp(FN, 'u'), 'the 0076 verifier is not made aware of the I-03B function by name');
  assert.doesNotMatch(verifier0076, /allowlist|resolve_shared/iu);
  for (const proof of [
    'has_table_privilege($1,$2,$3)',
    "SET LOCAL ROLE ${role}",
    'relrowsecurity',
    'pg_policy WHERE polrelid',
    'aclexplode(c.relacl)',
    'confdeltype',
    "(status = 'ACTIVE'::text)",
    "['42501']",
    "SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP`), INSUFFICIENT_PRIVILEGE",
    'revocation keeps the historical row and the reconfirmation is a new row',
    "DELETE FROM ${GRANTS} WHERE id=$1`, [grants.first]), FK_VIOLATION",
    'no fixture row remains after completion',
    "SELECT count(*)::int n FROM pg_trigger WHERE tgrelid=$1::regclass AND NOT tgisinternal",
    "for (const table of [...TABLES, EPISODES])",
    "await q('ROLLBACK')",
  ]) {
    assert.ok(verifier0076.includes(proof), `0076 verifier still proves: ${proof}`);
  }
  for (const role of ['anon', 'authenticated', 'service_role']) assert.ok(verifier0076.includes(`'${role}'`));
  assert.doesNotMatch(verifier0076, /\bGRANT\b|CREATE POLICY|DISABLE ROW LEVEL SECURITY/u);
  // The 0076 static contract still proves migration 0076 itself created no function / trigger / policy.
  const contract0076 = read('./shared-world-standing-context-grant-persistence-v1.test.mjs');
  assert.match(contract0076, /no function, trigger, policy, view, extension or enum type is introduced/u);
  assert.match(contract0076, /no grant, revoke or effective-authority command exists yet/u);
});

test('the 0075 verifier receives the identical correction only: its global function ceiling is gone and every seal proof remains', () => {
  // The resolver must positively check public.shared_worlds existence (task I-03B §5), which the
  // 0075 verifier's mutable-global "no public function mentions shared_worlds" ceiling forbade.
  // The correction is limited to that assertion; nothing about RLS / ACL / policy / FK changes.
  const verifier0075 = read('../verify-migration-0075.mjs');
  assert.doesNotMatch(verifier0075, /pg_proc|touchingFunctions|no public function|writing function/u);
  assert.doesNotMatch(verifier0075, new RegExp(FN, 'u'), 'the 0075 verifier is not made aware of the I-03B function by name');
  for (const proof of [
    'has_table_privilege($1,$2,$3)',
    "SET LOCAL ROLE ${role}",
    'relrowsecurity',
    'pg_policy WHERE polrelid',
    'aclexplode(c.relacl)',
    'confdeltype',
    "'(ended_at IS NULL)'",
    "['42501']",
    "SELECT count(*)::int n FROM pg_trigger WHERE tgrelid=$1::regclass AND NOT tgisinternal",
    'leave + rejoin are two episodes',
    "DELETE FROM public.users WHERE id=$1",
    'no fixture row remains after completion',
    "await q('ROLLBACK')",
  ]) {
    assert.ok(verifier0075.includes(proof), `0075 verifier still proves: ${proof}`);
  }
  assert.doesNotMatch(verifier0075, /\bGRANT\b|CREATE POLICY|DISABLE ROW LEVEL SECURITY/u);
  const contract0075 = read('./connected-worlds-shared-persistence-foundation-v1.test.mjs');
  assert.match(contract0075, /no function, trigger, policy, view or extension is introduced/u);
  assert.match(contract0075, /no birth, lifecycle or membership command exists yet/u);
});

test('the 0077 verifier proves the catalog, both ACLs, canonical existence errors, ACTIVE-only resolution and rolled-back fixtures', () => {
  for (const proof of [
    'process.env.DATABASE_URL',
    'pg_get_function_identity_arguments(pr.oid)',
    'pg_get_function_result(pr.oid)',
    "'p_world_id uuid, p_grantor_user_id uuid'",
    "'TABLE(grant_id uuid, world_id uuid, grantor_user_id uuid, status text, audience_user_id uuid)'",
    "assert.equal(fn.prosecdef, true",
    "assert.equal(fn.provolatile, 's'",
    "cfg === 'search_path=' || cfg === 'search_path=\"\"'",
    "has_function_privilege($1, $2, $3)",
    "for (const role of ['public', 'anon', 'authenticated'])",
    "['42501']",
    'has_table_privilege($1,$2,$3)',
    "await identity('service_role')",
    "SELECT * FROM ${table} LIMIT 1",
    "['P0002']",
    "['22023']",
    'an ACTIVE grant with an empty ceiling is one NULL-audience row',
    'a revoked grant is never chosen as the current grant',
    'only the new ACTIVE grant, never the revoked one',
    'resolution never depends on membership',
    'no fixture row remains after completion',
    "await q('ROLLBACK')",
  ]) {
    assert.ok(verifier.includes(proof), `0077 verifier is missing ${proof}`);
  }
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu, 'no connection detail is embedded');
  assert.doesNotMatch(verifier, /\bGRANT\b|CREATE POLICY|DISABLE ROW LEVEL SECURITY/u, 'the verifier never widens an ACL to make a proof easy');
});

test('the API resolver calls exactly the RPC over the service-role transport, reuses the frozen I-03A type, and fingerprints with versioned SHA-256', () => {
  assert.match(executableResolver, /import type \{[^}]*StandingContextGrantResolution[^}]*\} from '\.\.\/authority\/standing-context-authority\.types';/u);
  assert.match(executableResolver, new RegExp(`STANDING_CONTEXT_GRANT_RESOLUTION_RPC = '${FN}' as const;`, 'u'));
  assert.ok(executableResolver.includes('`${baseUrl}/rest/v1/rpc/${STANDING_CONTEXT_GRANT_RESOLUTION_RPC}`'), 'exactly the RPC path');
  assert.equal((executableResolver.match(/\bfetch\(/gu) ?? []).length, 1, 'one fetch');
  assert.doesNotMatch(executableResolver, /\/rest\/v1\/(?!rpc\/)|shared_world_standing_context_grants\b|grant_audience|membership|episode|select=/u, 'no direct table REST read, no membership read');
  assert.match(executableResolver, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(executableResolver, /Authorization: `Bearer \$\{serviceRoleKey\}`/u);
  assert.doesNotMatch(executableResolver, /accessToken|jwt|auth\.uid|SUPABASE_ANON_KEY/iu, 'no client token path');
  assert.match(executableResolver, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/u);
  assert.match(executableResolver, /STANDING_CONTEXT_AUTHORITY_SNAPSHOT_VERSION = 'QANDEEL_CWV2_STANDING_CONTEXT_AUTHORITY_SNAPSHOT_V1' as const;/u);
  assert.match(executableResolver, /createHash\('sha256'\)/u);
  assert.match(executableResolver, /`sha256:\$\{/u);
  assert.match(executableResolver, /sort\(byCodeUnit\)\.join\(','\)/u, 'audience ids are sorted before hashing');
  assert.doesNotMatch(executableResolver, /randomUUID|Math\.random|Date\.now|new Date|performance\.now|setTimeout/u, 'clock- and random-free');
  // Failure mapping is bounded to the frozen I-03A failure classes.
  const frozen = [...authorityTypes.match(/STANDING_CONTEXT_RESOLUTION_FAILURES = \[([^\]]+)\]/u)[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]).sort();
  assert.deepEqual(frozen.filter((failure) => executableResolver.includes(`'${failure}'`)), frozen, 'every frozen failure class is used');
  const literals = [...executableResolver.matchAll(/'([A-Z][A-Z_]+)'/gu)].map((m) => m[1]).filter((literal) => /UNRESOLVED|FAILED|TIMED_OUT|UNAVAILABLE|CONTRADICTORY/u.test(literal));
  assert.deepEqual([...new Set(literals)].sort(), [...frozen, 'CONTRADICTORY', 'UNRESOLVED'].sort(), 'no failure class outside the frozen I-03A union is invented');
  assert.match(executableResolver, /isTimeout\(error\) \? 'LOOKUP_TIMED_OUT' : 'LOOKUP_FAILED'/u);
  assert.match(executableResolver, /if \(!response\.ok\) return unresolved\('LOOKUP_FAILED'\);/u);
  assert.match(executableResolver, /if \(!baseUrl \|\| !serviceRoleKey\) return unresolved\('AUTHORITY_SNAPSHOT_UNAVAILABLE'\);/u);
  // No mutation, no grant / revoke, no consent event, no model.
  assert.doesNotMatch(executableResolver, /grant_standing|revoke|extend_|consent|model-router|ModelRouter|provider|openai/iu);
  assert.doesNotMatch(executableResolver, /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\b/u);
});

test('no controller, route, module registration or model integration is added', () => {
  const apiSrc = new URL('../../apps/api/src/', import.meta.url);
  const connectedWorlds = readdirSync(new URL('connected-worlds/', apiSrc), { recursive: true }).map(String);
  assert.deepEqual(connectedWorlds.filter((name) => /controller|module|gateway|resolver\.ts$|\.dto\./u.test(name)), [], 'no controller, Nest module, gateway or DTO under connected-worlds');
  assert.ok(existsSync(new URL('connected-worlds/authority-resolution/standing-context-grant-resolver.service.ts', apiSrc)));
  const appModule = read('../../apps/api/src/app.module.ts');
  assert.doesNotMatch(appModule, /connected-worlds|StandingContext/u, 'app.module.ts does not register Connected Worlds');
  // I-03A and the kernel are untouched: the frozen files still carry their own closure guards.
  assert.match(read('../../apps/api/src/connected-worlds/authority/standing-context-authority.spec.ts'), /'standing-context-authority\.spec\.ts', 'standing-context-authority\.ts', 'standing-context-authority\.types\.ts'/u);
  assert.match(read('../../apps/api/src/connected-worlds/kernel/connected-worlds-kernel.spec.ts'), /'authority\.types\.ts', 'material\.types\.ts', 'principal\.types\.ts', 'shared-world\.types\.ts', 'world-invariants\.ts', 'world\.types\.ts'/u);
});

test('the verifier is wired into the toolchain, API CI after fresh migrations and the 0076 verifier, and the database README', () => {
  assert.match(packageJson, /"verify:shared-standing-context-grant-resolution:integration": "node --env-file-if-exists=\.env database\/verify-migration-0077\.mjs"/u);
  assert.equal((workflow.match(/verify:shared-standing-context-grant-resolution:integration/gu) ?? []).length, 1, 'registered exactly once in API CI');
  const step = workflow.indexOf('run: npm run verify:shared-standing-context-grant-resolution:integration');
  assert.ok(step > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'), 'the verifier runs after fresh migrations are applied');
  assert.ok(step > workflow.indexOf('run: npm run verify:shared-world-standing-context-grants:integration'), 'the verifier runs after the 0076 verifier');
  assert.match(workflow, /Verify Shared Standing Context Grant resolution boundary against real PostgreSQL/u);
  assert.match(readme, /## Shared Standing Context Grant resolution boundary \(migration 0077, I-03B\)/u);
  assert.match(readme, /npm run verify:shared-standing-context-grant-resolution:integration/u);
  assert.match(readme, /service_role/u);
  assert.match(readme, /I-03A remains the\s+decision law/u);
  assert.match(readme, /No direct\s+table privilege was opened/u);
});
