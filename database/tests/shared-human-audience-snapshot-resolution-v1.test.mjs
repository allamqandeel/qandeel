// I-03D - Shared Human Audience Snapshot Resolution Boundary v1: secret-free
// structural contract over migration 0079, the 0079 verifier, the API-side
// audience resolver and types, the frozen upstream sources and the toolchain /
// CI / README wiring.
//
// Every "must not contain" assertion runs against executable SQL / TypeScript
// (comments stripped). Live semantics are proven by the real PostgreSQL
// verifier this file pins into the toolchain and CI. The migration checks are
// written as functions of the SQL text so the last test can prove they are not
// vacuous: each deliberate weakening of the migration must be refused by at
// least one of them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION_NAME = '0079_shared_human_audience_snapshot_resolution_v1.sql';
const FN = 'resolve_shared_world_human_audience_snapshot_v1';
const EPISODES = 'shared_world_membership_episodes';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0079.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const resolver = read('../../apps/api/src/connected-worlds/audience/shared-human-audience-resolver.service.ts');
const resolutionTypes = read('../../apps/api/src/connected-worlds/audience/shared-human-audience-resolution.types.ts');
const resolverSpec = read('../../apps/api/src/connected-worlds/audience/shared-human-audience-resolver.service.spec.ts');

const stripSqlComments = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const stripTsComments = (ts) => ts.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^[ \t]*\/\/.*$/gmu, '').replace(/[ \t]\/\/[^'"\n]*$/gmu, '');
const executableResolver = stripTsComments(resolver);
const executableTypes = stripTsComments(resolutionTypes);
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

// Parts of the migration, computed from any candidate text so the same checks
// run against the real file and against each anti-vacuity mutation.
function analyse(sql) {
  const executable = stripSqlComments(sql);
  const start = executable.indexOf(`CREATE FUNCTION public.${FN}`);
  const end = executable.indexOf('END$$;', start);
  assert.ok(start >= 0 && end > start, 'the audience resolver function body is present');
  const functionBody = executable.slice(start, end + 'END$$;'.length);
  const assertionStart = executable.indexOf('DO $$\nDECLARE');
  assert.ok(assertionStart > end, 'the terminal self-assertion follows the function');
  const selfAssertion = executable.slice(assertionStart, executable.indexOf('COMMIT;', assertionStart));
  return { executable, functionBody, selfAssertion, deployed: executable.replace(selfAssertion, '') };
}

// The migration-order facts are computed over a plain list of names so the
// forward-safety test can prove that a later migration (0080) is not banned.
function migrationOrderFacts(names) {
  const sorted = [...names].filter((name) => name.endsWith('.sql')).sort();
  assert.ok(sorted.includes(MIGRATION_NAME), 'migration 0079 exists');
  assert.equal(sorted.filter((name) => name.startsWith('0079_')).length, 1, 'exactly one migration carries the 0079 number');
  assert.ok(sorted.indexOf(MIGRATION_NAME) > sorted.indexOf('0078_shared_standing_context_consent_commands_v1.sql'), '0079 orders after 0078');
  return sorted.filter((name) => name < '0079_');
}

const checks = {
  'exactly one read function is created and nothing else': ({ executable }) => {
    assert.match(executable, /^BEGIN;/mu);
    assert.match(executable, /COMMIT;\s*$/u);
    assert.deepEqual([...executable.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((m) => m[1]), [FN], 'exactly one function');
    assert.doesNotMatch(executable, /CREATE (?:TABLE|VIEW|MATERIALIZED VIEW|TRIGGER|EVENT TRIGGER|POLICY|EXTENSION|TYPE|INDEX|SEQUENCE|PROCEDURE|SCHEMA)|ALTER TABLE|DROP /iu,
      'no table, view, trigger, policy, extension, type, index or alteration');
    assert.doesNotMatch(executable, /audience_engine|AudienceService|resolve_audience\(|generic|context_admission/iu, 'no generic audience engine');
  },
  'the RPC takes exactly (p_world_id uuid) and returns exactly (world_id, membership_episode_id, user_id)': ({ functionBody }) => {
    assert.match(functionBody, new RegExp(`CREATE FUNCTION public\\.${FN}\\(p_world_id uuid\\)\\nRETURNS TABLE\\(world_id uuid, membership_episode_id uuid, user_id uuid\\)`, 'u'));
    assert.doesNotMatch(functionBody, /p_user|p_audience|p_members|p_lifecycle|p_actor|joined_at|lifecycle|phase|birth_basis|closed_at|granted_at|material|session|history|disclos|matching|public_world|replay/iu,
      'the rowset carries only World, episode and human identity');
  },
  'the RPC is SECURITY DEFINER, STABLE, search_path-pinned, fully qualified, and reads only the Shared World row and the membership episodes': ({ functionBody, selfAssertion }) => {
    assert.match(functionBody, /LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS \$\$/u);
    const references = [...functionBody.matchAll(/\b(?:FROM|JOIN)\s+([\w.]+)/gu)].map((m) => m[1]).sort();
    assert.deepEqual([...new Set(references)], [`public.${EPISODES}`, 'public.shared_worlds'], 'only the membership-episode and Shared World tables are read, fully qualified');
    for (const reference of references) assert.match(reference, /^public\./u);
    assert.doesNotMatch(functionBody, /standing_context|grant|consent|conversation|memories|him_|hypothes|auth\.uid|request\.jwt|current_setting|users\b/iu, 'no grant, consent, Shared material, Personal context or client identity is read');
    assert.match(selfAssertion, /IF NOT p\.prosecdef THEN RAISE EXCEPTION/u);
    assert.match(selfAssertion, /IF p\.provolatile <> 's' THEN RAISE EXCEPTION/u);
    assert.match(selfAssertion, /cfg IN \('search_path=', 'search_path=""'\)/u);
    assert.match(selfAssertion, /IF p\.prosrc !~ 'e\\\.ended_at IS NULL' THEN/u);
    assert.match(selfAssertion, /p\.prosrc ~\* 'lifecycle' OR p\.prosrc ~\* 'standing_context' OR p\.prosrc ~\* 'grant'/u);
  },
  'canonical Shared World existence is positively checked before any answer: a nonexistent World is a bounded error, never an empty audience': ({ functionBody }) => {
    assert.match(functionBody, /IF p_world_id IS NULL THEN\s+RAISE EXCEPTION '[^']+' USING ERRCODE='22023';/u);
    assert.match(functionBody, /IF NOT EXISTS \(SELECT 1 FROM public\.shared_worlds w WHERE w\.id = p_world_id\) THEN\s+RAISE EXCEPTION '[^']+' USING ERRCODE='P0002';/u);
    assert.ok(functionBody.indexOf('FROM public.shared_worlds w') < functionBody.indexOf('RETURN QUERY'), 'the existence check precedes the answer');
  },
  'the current-membership predicate is exactly ended_at IS NULL on the exact World, deterministically ordered, with no lifecycle filter and no "latest episode" fallback': ({ functionBody }) => {
    const query = functionBody.slice(functionBody.indexOf('RETURN QUERY'));
    assert.match(query, new RegExp(`SELECT e\\.world_id, e\\.id, e\\.user_id\\s+FROM public\\.${EPISODES} e\\s+WHERE e\\.world_id = p_world_id\\s+AND e\\.ended_at IS NULL\\s+ORDER BY e\\.user_id, e\\.id;`, 'u'));
    assert.doesNotMatch(query, /lifecycle|'ACTIVE'|'READ_ONLY_CLOSED'|closed_at|phase/u, 'lifecycle is not an audience filter');
    assert.doesNotMatch(query, /ended_at IS NOT NULL|joined_at|DESC|LIMIT|DISTINCT ON|max\(|UNION|OR e\.|COALESCE/iu, 'no historical or "latest episode" fallback, no union of history and current membership');
    assert.doesNotMatch(query, /standing_context|grant_audience|audience_user_id/u, 'the grant ceiling never defines the audience');
    assert.equal((query.match(/JOIN/gu) ?? []).length, 0, 'no join: the membership table alone is the audience source');
  },
  'the RPC writes nothing': ({ functionBody, deployed }) => {
    assert.doesNotMatch(functionBody, /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|NOTIFY|PERFORM)\b/u);
    assert.doesNotMatch(deployed, /\b(?:INSERT INTO|UPDATE public|DELETE FROM|MERGE|TRUNCATE)\b/u);
  },
  'EXECUTE is revoked from PUBLIC, anon and authenticated and granted to service_role alone; no direct table privilege is opened; no auth.uid() or JWT': ({ executable, selfAssertion }) => {
    assert.match(executable, new RegExp(`REVOKE ALL ON FUNCTION public\\.${FN}\\(uuid\\) FROM PUBLIC, anon, authenticated;`, 'u'));
    assert.match(executable, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${FN}\\(uuid\\) TO service_role;`, 'u'));
    const grants = [...executable.matchAll(/^\s*GRANT\b.*$/gmu)].map((m) => m[0].trim());
    assert.deepEqual(grants, [`GRANT EXECUTE ON FUNCTION public.${FN}(uuid) TO service_role;`], 'the ONLY grant is EXECUTE to service_role');
    assert.doesNotMatch(executable, /GRANT (?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE)|ON TABLE|TO authenticated|TO anon|TO PUBLIC|CREATE POLICY|DISABLE ROW LEVEL SECURITY/iu);
    assert.doesNotMatch(executable, /auth\.uid|request\.jwt/u);
    assert.match(selfAssertion, /IF has_function_privilege\('public', fn, 'EXECUTE'\) THEN RAISE EXCEPTION/u);
    assert.match(selfAssertion, /FOREACH target_role IN ARRAY ARRAY\['anon','authenticated'\]/u);
    assert.match(selfAssertion, /IF NOT has_function_privilege\('service_role', fn, 'EXECUTE'\) THEN/u);
    assert.match(selfAssertion, new RegExp(`FOREACH target_table IN ARRAY ARRAY\\['public\\.shared_worlds','public\\.${EPISODES}'\\]`, 'u'));
    assert.match(selfAssertion, /FOREACH target_role IN ARRAY ARRAY\['anon','authenticated','service_role'\]/u);
    assert.match(selfAssertion, /IF has_table_privilege\(target_role, target_table, target_privilege\) THEN\s+RAISE EXCEPTION 'I-03D: direct membership-table access stays sealed/u);
    assert.match(selfAssertion, /IF EXISTS \(SELECT 1 FROM pg_policy pol WHERE pol\.polrelid = target_table::regclass\) THEN/u);
    assert.match(selfAssertion, /IF NOT rls_enabled THEN RAISE EXCEPTION/u);
  },
};

for (const [name, check] of Object.entries(checks)) {
  test(name, () => check(analyse(migration)));
}

test('0079 exists once, orders after 0078, migrations 0001-0078 are byte-unchanged, and a future migration 0080 is not banned', () => {
  const names = readdirSync(new URL('../migrations/', import.meta.url));
  const frozen = migrationOrderFacts(names);
  assert.equal(frozen.length, 78, 'migrations 0001-0078 are all present');
  const manifest = createHash('sha256').update(frozen.map((name) => `${name} ${gitBlobId(read(`../migrations/${name}`))}`).join('\n')).digest('hex');
  assert.equal(manifest, '8e309ad26af25771d781cf40927585020292eadaeec93eae004bd7312c293705', 'migrations 0001-0078 are byte-identical to their merged blobs');
  // Forward safety: the same order facts hold when a later authorized migration exists.
  const later = migrationOrderFacts([...names, '0080_forward_safety_probe_v1.sql']);
  assert.deepEqual(later, frozen, 'a later migration changes nothing this contract claims');
  const self = readFileSync(new URL(import.meta.url), 'utf8').replace(/\r\n/gu, '\n').replace(/^\s*\/\/[^\n]*$/gmu, '');
  const banned = new RegExp(['slice\\(-\\d', "> '0079" + "_'", "'0080" + '_(?!forward_safety_probe)'].join('|'), 'u');
  assert.doesNotMatch(self, banned, 'this contract enumerates nothing after 0079');
});

test('the frozen kernel, I-03A evaluator and I-03B resolver production sources are byte-unchanged and no other API file changed shape', () => {
  for (const [path, blob] of [
    ['../../apps/api/src/connected-worlds/kernel/authority.types.ts', '1dd6f0e49aa64685b4650a72872c01fceebd517e'],
    ['../../apps/api/src/connected-worlds/kernel/material.types.ts', '86b89d87965763405ac79086bae99655eb8d110d'],
    ['../../apps/api/src/connected-worlds/kernel/principal.types.ts', '654633ad8b7181c5636d2dd4041bdeb6ec1d3892'],
    ['../../apps/api/src/connected-worlds/kernel/shared-world.types.ts', '7f65364091a0896ee229add95baad941ad656cbc'],
    ['../../apps/api/src/connected-worlds/kernel/world-invariants.ts', 'bd000e20700253dbba5684e2bb745ff3872470f7'],
    ['../../apps/api/src/connected-worlds/kernel/world.types.ts', '597c0e8b736300c911fc542a38bf9c99e308c9cc'],
    ['../../apps/api/src/connected-worlds/authority/standing-context-authority.types.ts', '7b6478480a5490ae52bae2316c2c0aa51a679cf5'],
    ['../../apps/api/src/connected-worlds/authority/standing-context-authority.ts', 'f08a3349994a6273ee9f4be4f6fa91bf50d0bc97'],
    ['../../apps/api/src/connected-worlds/authority-resolution/standing-context-grant-resolver.service.ts', 'f72b2665e543c5259a9a682c53c721653c9779b7'],
  ]) {
    assert.equal(gitBlobId(read(path)), blob, `${path} is byte-identical to its merged blob`);
  }
  assert.match(read('../../apps/api/src/connected-worlds/authority/standing-context-authority.spec.ts'), /'standing-context-authority\.spec\.ts', 'standing-context-authority\.ts', 'standing-context-authority\.types\.ts'/u);
  assert.match(read('../../apps/api/src/connected-worlds/authority-resolution/standing-context-grant-resolver.service.spec.ts'), /'standing-context-grant-resolver\.service\.spec\.ts', 'standing-context-grant-resolver\.service\.ts'/u);
  assert.doesNotMatch(read('../../apps/api/src/app.module.ts'), /connected-worlds|StandingContext|SharedHumanAudience/u, 'app.module.ts registers no Connected Worlds module');
  const apiSrc = new URL('../../apps/api/src/', import.meta.url);
  const connectedWorlds = readdirSync(new URL('connected-worlds/', apiSrc), { recursive: true }).map(String);
  assert.deepEqual(connectedWorlds.filter((name) => /controller|module|gateway|\.dto\./u.test(name)), [], 'no controller, Nest module, gateway or DTO under connected-worlds');
  // The audience namespace is the only place that names the audience RPC, and
  // no API file outside the Connected Worlds domain (conversation, model-router,
  // intelligence-runtime, memory, human-model, ...) knows the resolver at all.
  // A later authorized Connected Worlds slice (the pre-model EffectiveContext,
  // I-03E) may consume the resolved snapshot; that is not a 0079 property, so
  // this contract proves what I-03D introduced rather than a permanent ceiling
  // on the later authorized consumers.
  const separator = (name) => (name.includes('\\') ? '\\' : '/');
  const sources = readdirSync(apiSrc, { recursive: true }).map(String).filter((name) => /\.(?:ts|js|mjs)$/u.test(name));
  const rpcInvokers = sources.filter((name) => !name.includes(`connected-worlds${separator(name)}audience`) && readFileSync(new URL(name, apiSrc), 'utf8').includes(FN));
  assert.deepEqual(rpcInvokers, [], 'no API file outside the audience namespace names the audience RPC');
  const outsideConnectedWorlds = sources.filter((name) => !name.startsWith('connected-worlds') && /SharedHumanAudience|shared-human-audience/u.test(readFileSync(new URL(name, apiSrc), 'utf8')));
  assert.deepEqual(outsideConnectedWorlds, [], 'no API file outside the Connected Worlds domain knows the audience resolver: no model, conversation or controller wiring');
});

test('the API resolver calls exactly the RPC over the service-role transport, performs no direct table REST read, reuses the frozen I-03A snapshot type and keeps EMPTY distinct from UNRESOLVED', () => {
  assert.match(executableResolver, /import type \{ SharedHumanAudienceSnapshot \} from '\.\.\/authority\/standing-context-authority\.types';/u, 'the frozen I-03A snapshot type is reused');
  assert.match(executableTypes, /import type \{ SharedHumanAudienceSnapshot \} from '\.\.\/authority\/standing-context-authority\.types';/u);
  assert.doesNotMatch(executableTypes, /interface \w*Snapshot\b|snapshotRef: string;\s+readonly humans/u, 'no competing snapshot shape');
  assert.match(executableTypes, /\| \{ readonly state: 'RESOLVED'; readonly snapshot: SharedHumanAudienceSnapshot \}\s+\| \{ readonly state: 'EMPTY'; readonly snapshotRef: string \}\s+\| \{ readonly state: 'UNRESOLVED'; readonly failure: SharedHumanAudienceResolutionFailure \};/u, 'RESOLVED | EMPTY | UNRESOLVED are three distinct states');
  assert.match(executableTypes, /SHARED_HUMAN_AUDIENCE_RESOLUTION_FAILURES = \[\s+'LOOKUP_FAILED',\s+'LOOKUP_TIMED_OUT',\s+'AUDIENCE_SNAPSHOT_UNAVAILABLE',\s+'CONTRADICTORY_CANONICAL_STATE',\s+\] as const;/u);
  assert.match(executableResolver, new RegExp(`SHARED_HUMAN_AUDIENCE_RESOLUTION_RPC = '${FN}' as const;`, 'u'));
  assert.ok(executableResolver.includes('`${baseUrl}/rest/v1/rpc/${SHARED_HUMAN_AUDIENCE_RESOLUTION_RPC}`'), 'exactly the RPC path');
  assert.equal((executableResolver.match(/\bfetch\(/gu) ?? []).length, 1, 'one fetch');
  assert.doesNotMatch(executableResolver, /\/rest\/v1\/(?!rpc\/)|shared_world_membership_episodes\b|shared_worlds\b|select=|standing_context|grant_audience/u, 'no direct table REST read, no grant read');
  assert.match(executableResolver, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(executableResolver, /Authorization: `Bearer \$\{serviceRoleKey\}`/u);
  assert.match(executableResolver, /body: JSON\.stringify\(\{ p_world_id: worldId \}\)/u, 'the body carries the World only: no client-supplied audience');
  assert.doesNotMatch(executableResolver, /accessToken|jwt|auth\.uid|SUPABASE_ANON_KEY/iu, 'no client token path');
  assert.match(executableResolver, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/u);
  assert.match(executableResolver, /if \(!baseUrl \|\| !serviceRoleKey\) return unresolved\('AUDIENCE_SNAPSHOT_UNAVAILABLE'\);/u);
  assert.match(executableResolver, /isTimeout\(error\) \? 'LOOKUP_TIMED_OUT' : 'LOOKUP_FAILED'/u);
  assert.match(executableResolver, /if \(!response\.ok\) return unresolved\(await classifyRejection\(response\)\);/u, 'a rejection is never EMPTY');
  // Task §19: the bounded 0079 nonexistent-World code (P0002) is canonical contradiction; every other rejection is infrastructure failure. Only `code` is read.
  assert.match(executableResolver, /NONCANONICAL_WORLD_SQLSTATE = 'P0002' as const;/u);
  assert.match(executableResolver, /return isRecord\(body\) && body\.code === NONCANONICAL_WORLD_SQLSTATE \? 'CONTRADICTORY_CANONICAL_STATE' : 'LOOKUP_FAILED';/u);
  assert.doesNotMatch(executableResolver, /body\.message|body\.details|body\.hint|response\.text\(|response\.statusText/u, 'no raw error message, detail, hint or body enters a result');
  assert.match(migration, /USING ERRCODE='P0002'/u, 'the migration raises exactly the code the resolver classifies');
  assert.match(resolverSpec, /maps the bounded nonexistent-World rejection \(SQLSTATE P0002 from migration 0079\) to CONTRADICTORY_CANONICAL_STATE, never to LOOKUP_FAILED or EMPTY/u);
  assert.match(resolverSpec, /keeps every other rejection as LOOKUP_FAILED/u);
  assert.match(resolverSpec, /anti-vacuity: canonical contradiction and infrastructure failure are two different results/u);
  assert.match(executableResolver, /if \(interpreted === 'CONTRADICTORY'\) return unresolved\('CONTRADICTORY_CANONICAL_STATE'\);/u);
  assert.match(executableResolver, /if \(interpreted === 'NO_CURRENT_MEMBERS'\) \{\s+return Object\.freeze\(\{ state: 'EMPTY', snapshotRef: fingerprintSharedHumanAudience\(\{ state: 'EMPTY', worldId \}\) \} as const\);/u);
  assert.doesNotMatch(executableResolver, /humans: \[\]|humans: Object\.freeze\(\[\]\)/u, 'no zero-human snapshot is manufactured');
  // Fingerprint: versioned SHA-256 over World + sorted user@episode pairs; row order non-semantic; RESOLVED / EMPTY domain-separated.
  assert.match(executableResolver, /SHARED_HUMAN_AUDIENCE_SNAPSHOT_VERSION = 'QANDEEL_CWV2_SHARED_HUMAN_AUDIENCE_SNAPSHOT_V1' as const;/u);
  assert.match(executableResolver, /createHash\('sha256'\)/u);
  assert.match(executableResolver, /`sha256:\$\{/u);
  assert.match(executableResolver, /\.sort\(byUserThenEpisode\)\s+\.map\(\(member\) => `\$\{member\.userId\}@\$\{member\.membershipEpisodeId\}`\)\s+\.join\(','\)/u, 'user AND episode identity are bound, sorted before hashing');
  assert.match(executableResolver, /`state=\$\{facts\.state\}`, `world=\$\{facts\.worldId\.toLowerCase\(\)\}`, `members=\$\{members\}`/u);
  assert.doesNotMatch(executableResolver, /randomUUID|Math\.random|Date\.now|new Date|performance\.now|setTimeout/u, 'clock- and random-free');
  // Untrusted payload: exact keys, duplicates refused, World must match, nothing salvaged.
  assert.match(executableResolver, /AUDIENCE_ROW_KEYS = \['world_id', 'membership_episode_id', 'user_id'\] as const;/u);
  assert.match(executableResolver, /if \(new Set\(members\.map\(\(member\) => member\.userId\)\)\.size !== members\.length\) return 'CONTRADICTORY';/u);
  assert.match(executableResolver, /if \(new Set\(members\.map\(\(member\) => member\.membershipEpisodeId\)\)\.size !== members\.length\) return 'CONTRADICTORY';/u);
  assert.match(executableResolver, /if \(row\.world_id\.toLowerCase\(\) !== requestedWorld\) return 'CONTRADICTORY';/u);
  assert.match(executableResolver, /Object\.freeze\(\{ kind: 'HUMAN', humanId: member\.userId \} as const\)/u, 'every member is a human principal; QANDEEL is never inserted');
  // No model, EffectiveContext, lifecycle, history, material, mutation or I-03B import.
  assert.doesNotMatch(executableResolver, /model-router|ModelRouter|provider|EffectiveContext|effective-context|conversation|memor|lifecycle|history|session|material|disclos|authority-resolution|standing-context-grant-resolver/iu);
  assert.doesNotMatch(executableResolver, /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\b/u);
  // The spec proves composition and the leave / rejoin property.
  assert.match(resolverSpec, /evaluateStandingContextAuthority\(requestWith\(resolution\.snapshot\)/u);
  assert.match(resolverSpec, /AUDIENCE_EXCEEDS_GRANT_CEILING/u);
  assert.match(resolverSpec, /expect\(s1\.snapshot\.humans\)\.toEqual\(s2\.snapshot\.humans\);\s+expect\(s1\.snapshot\.snapshotRef\)\.not\.toBe\(s2\.snapshot\.snapshotRef\);/u);
  assert.match(resolverSpec, /'shared-human-audience-resolution\.types\.ts',\s+'shared-human-audience-resolver\.service\.spec\.ts',\s+'shared-human-audience-resolver\.service\.ts',/u, 'the audience directory carries its own closure guard');
});

test('the 0079 verifier proves the catalog, both ACLs, canonical existence, open-membership semantics, lifecycle separation, leave / rejoin and rolled-back fixtures', () => {
  for (const proof of [
    'process.env.DATABASE_URL',
    'pg_get_function_identity_arguments(pr.oid)',
    'pg_get_function_result(pr.oid)',
    "'p_world_id uuid'",
    "'TABLE(world_id uuid, membership_episode_id uuid, user_id uuid)'",
    "assert.equal(fn.owner, 'postgres'",
    "assert.equal(fn.prosecdef, true",
    "assert.equal(fn.provolatile, 's'",
    "cfg === 'search_path=' || cfg === 'search_path=\"\"'",
    'AND e\\.ended_at IS NULL',
    "has_function_privilege($1, $2, $3)",
    "for (const role of ['public', 'anon', 'authenticated'])",
    "['42501']",
    'has_table_privilege($1,$2,$3)',
    "for (const role of APPLICATION_ROLES)",
    "SELECT * FROM ${table} LIMIT 1",
    "['P0002']",
    "['22023']",
    'a closed historical episode alone is an empty current audience, and the World is still canonical',
    'exactly the two open episodes, each with its episode identity',
    'the closed episode and the other World contribute nothing',
    'a ceiling naming a non-member does not widen the current audience',
    'after Hadir leaves only Mohamed is current',
    'but the episode identity is the rejoin episode',
    'audience-state resolution is not generation permission: persisted open episodes are reported as-is',
    'no World, episode, grant, ceiling or consent row changed',
    "await identity('service_role')",
    'no fixture row remains after completion',
    "await q('ROLLBACK')",
  ]) {
    assert.ok(verifier.includes(proof), `0079 verifier is missing ${proof}`);
  }
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu, 'no connection detail is embedded');
  assert.doesNotMatch(verifier, /\bGRANT\b|CREATE POLICY|DISABLE ROW LEVEL SECURITY|session_replication_role/u, 'the verifier never widens an ACL to make a proof easy');
  // Not a mutable-global ceiling: no live zero-trigger or relation-count assertion over the shared tables.
  assert.doesNotMatch(verifier, /pg_trigger|relname ~\*|added no table or view/u, 'the historical 0079 verifier asserts no permanent global trigger or relation ceiling');
});

test('the verifier is wired into the toolchain, API CI after fresh migrations and the 0075 / 0076 / 0077 / 0078 verifiers, and the database README', () => {
  assert.match(packageJson, /"verify:shared-human-audience-snapshot-resolution:integration": "node --env-file-if-exists=\.env database\/verify-migration-0079\.mjs"/u);
  assert.equal((workflow.match(/verify:shared-human-audience-snapshot-resolution:integration/gu) ?? []).length, 1, 'registered exactly once in API CI');
  const step = workflow.indexOf('run: npm run verify:shared-human-audience-snapshot-resolution:integration');
  assert.ok(step > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'), 'the verifier runs after fresh migrations are applied');
  for (const predecessor of ['verify:connected-worlds-shared-persistence:integration', 'verify:shared-world-standing-context-grants:integration', 'verify:shared-standing-context-grant-resolution:integration', 'verify:shared-standing-context-consent-commands:integration']) {
    assert.ok(step > workflow.indexOf(`run: npm run ${predecessor}`), `the verifier runs after ${predecessor}`);
  }
  assert.match(workflow, /Verify Shared human audience snapshot resolution boundary against real PostgreSQL/u);
  assert.match(readme, /## Shared human audience snapshot resolution boundary \(migration 0079, I-03D\)/u);
  assert.match(readme, /npm run verify:shared-human-audience-snapshot-resolution:integration/u);
  assert.match(readme, /ended_at IS NULL/u);
  assert.match(readme, /not historical-material access/u);
  assert.match(readme, /never defines the audience/u);
  assert.match(readme, /`EMPTY` is distinct from `UNRESOLVED`/u);
  assert.match(readme, /membership episode/u);
});

test('anti-vacuity: every deliberate weakening of migration 0079 is refused by at least one structural check', () => {
  const mutations = [
    ['EXECUTE granted to authenticated', (sql) => sql.replace(`GRANT EXECUTE ON FUNCTION public.${FN}(uuid) TO service_role;`, `GRANT EXECUTE ON FUNCTION public.${FN}(uuid) TO service_role, authenticated;`)],
    ['direct SELECT opened on membership episodes', (sql) => sql.replace(`GRANT EXECUTE ON FUNCTION public.${FN}(uuid) TO service_role;`, `GRANT EXECUTE ON FUNCTION public.${FN}(uuid) TO service_role;\nGRANT SELECT ON TABLE public.${EPISODES} TO service_role;`)],
    ['the existence check dropped (nonexistent World becomes empty)', (sql) => sql.replace("  IF NOT EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = p_world_id) THEN\n    RAISE EXCEPTION 'Shared human audience resolution target is not a canonical Shared World' USING ERRCODE='P0002';\n  END IF;\n", '')],
    ['a lifecycle filter', (sql) => sql.replace("     WHERE e.world_id = p_world_id\n       AND e.ended_at IS NULL", "     WHERE e.world_id = p_world_id\n       AND e.ended_at IS NULL\n       AND EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = e.world_id AND w.lifecycle = 'ACTIVE')")],
    ['a "latest episode regardless of ended_at" fallback', (sql) => sql.replace("     WHERE e.world_id = p_world_id\n       AND e.ended_at IS NULL\n     ORDER BY e.user_id, e.id;", "     WHERE e.world_id = p_world_id\n     ORDER BY e.user_id, e.joined_at DESC;")],
    ['historical and current membership unioned', (sql) => sql.replace('       AND e.ended_at IS NULL\n', '       AND (e.ended_at IS NULL OR e.ended_at IS NOT NULL)\n')],
    ['the audience derived from the grant ceiling', (sql) => sql.replace(`      FROM public.${EPISODES} e\n`, `      FROM public.${EPISODES} e\n      JOIN public.shared_world_standing_context_grant_audience a ON a.audience_user_id = e.user_id\n`)],
    ['a history / material read', (sql) => sql.replace('    SELECT e.world_id, e.id, e.user_id\n', '    SELECT e.world_id, e.id, e.user_id, (SELECT count(*) FROM public.conversation_sessions) AS sessions\n')],
    ['the episode identity dropped from the result', (sql) => sql.replace('RETURNS TABLE(world_id uuid, membership_episode_id uuid, user_id uuid)', 'RETURNS TABLE(world_id uuid, user_id uuid)').replace('    SELECT e.world_id, e.id, e.user_id\n', '    SELECT e.world_id, e.user_id\n')],
    ['a client-supplied audience parameter', (sql) => sql.replace(`CREATE FUNCTION public.${FN}(p_world_id uuid)`, `CREATE FUNCTION public.${FN}(p_world_id uuid, p_audience_user_ids uuid[] DEFAULT NULL)`)],
    ['VOLATILE with a write', (sql) => sql.replace("LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$\nBEGIN\n  IF p_world_id IS NULL", "LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$\nBEGIN\n  UPDATE public.shared_worlds SET closed_at = NULL WHERE id = p_world_id;\n  IF p_world_id IS NULL")],
    ['an unpinned search_path', (sql) => sql.replace("SECURITY DEFINER STABLE SET search_path='' AS $$", 'SECURITY DEFINER STABLE AS $$')],
    ['auth.uid() consulted', (sql) => sql.replace('  IF p_world_id IS NULL THEN', '  IF auth.uid() IS NULL THEN RAISE EXCEPTION \'FORBIDDEN\' USING ERRCODE=\'42501\'; END IF;\n  IF p_world_id IS NULL THEN')],
    ['a second function', (sql) => sql.replace('-- Terminal self-assertions.', `CREATE FUNCTION public.resolve_public_world_audience_v1() RETURNS SETOF uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';\n-- Terminal self-assertions.`)],
    ['a table', (sql) => sql.replace('-- Terminal self-assertions.', 'CREATE TABLE public.shared_world_audience_snapshots (id uuid PRIMARY KEY);\n-- Terminal self-assertions.')],
    ['a policy on the membership table', (sql) => sql.replace('-- Terminal self-assertions.', `CREATE POLICY episodes_read ON public.${EPISODES} FOR SELECT TO service_role USING (true);\n-- Terminal self-assertions.`)],
    ['the self-assertion no longer refuses authenticated execution', (sql) => sql.replace("FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP\n    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN", "FOREACH target_role IN ARRAY ARRAY['anon'] LOOP\n    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN")],
    ['nondeterministic order', (sql) => sql.replace('     ORDER BY e.user_id, e.id;', '     ORDER BY random();')],
  ];
  const survivors = [];
  for (const [label, mutate] of mutations) {
    const mutated = mutate(migration);
    assert.notEqual(mutated, migration, `mutation "${label}" applies to the current migration text`);
    let refused = false;
    try {
      const parts = analyse(mutated);
      for (const check of Object.values(checks)) check(parts);
    } catch {
      refused = true;
    }
    if (!refused) survivors.push(label);
  }
  assert.deepEqual(survivors, [], 'every mutation is refused by at least one check');
  assert.equal(mutations.length, 18);
});
