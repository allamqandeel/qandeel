// I-03E - Shared Pre-Model World-State Resolution Boundary & EffectiveContext
// v1: secret-free structural contract over migration 0080, the 0080 verifier,
// the API-side World-state resolver, the EffectiveContext service and types,
// the frozen upstream sources and the toolchain / CI / README wiring.
//
// Every "must not contain" assertion runs against executable SQL / TypeScript
// (comments stripped). Live semantics are proven by the real PostgreSQL
// verifier this file pins into the toolchain and CI, and by the Jest specs it
// pins. The migration checks are written as functions of the SQL text so the
// last test can prove they are not vacuous: each deliberate weakening of the
// migration must be refused by at least one of them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION_NAME = '0080_shared_pre_model_world_state_resolution_v1.sql';
const FN = 'resolve_shared_world_pre_model_state_v1';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0080.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const API = '../../apps/api/src/connected-worlds/effective-context/';
const worldStateResolver = read(`${API}shared-pre-model-world-state-resolver.service.ts`);
const effectiveContextService = read(`${API}shared-effective-context.service.ts`);
const effectiveContextTypes = read(`${API}shared-effective-context.types.ts`);
const worldStateSpec = read(`${API}shared-pre-model-world-state-resolver.service.spec.ts`);
const effectiveContextSpec = read(`${API}shared-effective-context.service.spec.ts`);

const stripSqlComments = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const stripTsComments = (ts) => ts.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^[ \t]*\/\/.*$/gmu, '').replace(/[ \t]\/\/[^'"\n]*$/gmu, '');
const executableResolver = stripTsComments(worldStateResolver);
const executableService = stripTsComments(effectiveContextService);
const executableTypes = stripTsComments(effectiveContextTypes);
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
  assert.ok(start >= 0 && end > start, 'the World-state resolver function body is present');
  const functionBody = executable.slice(start, end + 'END$$;'.length);
  const assertionStart = executable.indexOf('DO $$\nDECLARE');
  assert.ok(assertionStart > end, 'the terminal self-assertion follows the function');
  const selfAssertion = executable.slice(assertionStart, executable.indexOf('COMMIT;', assertionStart));
  return { executable, functionBody, selfAssertion, deployed: executable.replace(selfAssertion, '') };
}

// The migration-order facts are computed over a plain list of names so the
// forward-safety test can prove that a later migration (0081) is not banned.
function migrationOrderFacts(names) {
  const sorted = [...names].filter((name) => name.endsWith('.sql')).sort();
  assert.ok(sorted.includes(MIGRATION_NAME), 'migration 0080 exists');
  assert.equal(sorted.filter((name) => name.startsWith('0080_')).length, 1, 'exactly one migration carries the 0080 number');
  assert.ok(sorted.indexOf(MIGRATION_NAME) > sorted.indexOf('0079_shared_human_audience_snapshot_resolution_v1.sql'), '0080 orders after 0079');
  return sorted.filter((name) => name < '0080_');
}

const checks = {
  'exactly one read function is created and nothing else': ({ executable }) => {
    assert.match(executable, /^BEGIN;/mu);
    assert.match(executable, /COMMIT;\s*$/u);
    assert.deepEqual([...executable.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((m) => m[1]), [FN], 'exactly one function');
    assert.doesNotMatch(executable, /CREATE (?:TABLE|VIEW|MATERIALIZED VIEW|TRIGGER|EVENT TRIGGER|POLICY|EXTENSION|TYPE|INDEX|SEQUENCE|PROCEDURE|SCHEMA)|ALTER TABLE|DROP /iu,
      'no table, view, trigger, policy, extension, type, index or alteration');
    assert.doesNotMatch(executable, /lifecycle_engine|LifecycleService|close_shared_world|end_world|generic|context_admission/iu, 'no lifecycle command or generic engine');
  },
  'the RPC takes exactly (p_world_id uuid) and returns exactly (world_id, lifecycle, phase)': ({ functionBody }) => {
    assert.match(functionBody, new RegExp(`CREATE FUNCTION public\\.${FN}\\(p_world_id uuid\\)\\nRETURNS TABLE\\(world_id uuid, lifecycle text, phase text\\)`, 'u'));
    assert.doesNotMatch(functionBody, /p_user|p_audience|p_lifecycle|p_phase|p_expected|p_actor|closed_at|born_at|birth_basis|joined_at|membership|standing_context|grant|consent|material|session|history|disclos|matching|public_world|replay/iu,
      'the rowset carries only World identity, lifecycle and phase');
  },
  'the RPC is SECURITY DEFINER, STABLE, search_path-pinned, fully qualified, and reads only the Shared World row': ({ functionBody, selfAssertion }) => {
    assert.match(functionBody, /LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS \$\$/u);
    const references = [...functionBody.matchAll(/\b(?:FROM|JOIN)\s+([\w.]+)/gu)].map((m) => m[1]).sort();
    assert.deepEqual([...new Set(references)], ['public.shared_worlds'], 'only the Shared World table is read, fully qualified');
    for (const reference of references) assert.match(reference, /^public\./u);
    assert.doesNotMatch(functionBody, /membership_episodes|standing_context|grant|consent|conversation|memories|him_|hypothes|auth\.uid|request\.jwt|current_setting|users\b/iu, 'no membership, grant, consent, Shared material, Personal context or client identity is read');
    assert.match(selfAssertion, /IF NOT p\.prosecdef THEN RAISE EXCEPTION/u);
    assert.match(selfAssertion, /IF p\.provolatile <> 's' THEN RAISE EXCEPTION/u);
    assert.match(selfAssertion, /cfg IN \('search_path=', 'search_path=""'\)/u);
    assert.match(selfAssertion, /IF p\.prosrc !~ 'SELECT w\\\.id, w\\\.lifecycle, w\\\.phase' OR p\.prosrc !~ 'FROM public\\\.shared_worlds w' THEN/u);
    assert.match(selfAssertion, /p\.prosrc ~\* 'membership_episodes' OR p\.prosrc ~\* 'standing_context' OR p\.prosrc ~\* 'grant'/u);
    assert.match(selfAssertion, /p\.prosrc ~\* 'closed_at' OR p\.prosrc ~\* 'born_at' OR p\.prosrc ~\* 'birth_basis'/u);
  },
  'canonical Shared World existence is positively checked before any answer: a nonexistent World is a bounded error, never zero rows and never a closed World': ({ functionBody }) => {
    assert.match(functionBody, /IF p_world_id IS NULL THEN\s+RAISE EXCEPTION '[^']+' USING ERRCODE='22023';/u);
    assert.match(functionBody, /IF NOT EXISTS \(SELECT 1 FROM public\.shared_worlds w WHERE w\.id = p_world_id\) THEN\s+RAISE EXCEPTION '[^']+' USING ERRCODE='P0002';/u);
    assert.ok(functionBody.indexOf('IF NOT EXISTS (SELECT 1 FROM public.shared_worlds w') < functionBody.indexOf('RETURN QUERY'), 'the existence check precedes the answer');
  },
  'exactly the canonical row\'s identity, lifecycle and phase are returned: no lifecycle decision, no default, no fallback, no other World': ({ functionBody }) => {
    const query = functionBody.slice(functionBody.indexOf('RETURN QUERY'));
    assert.match(query, /RETURN QUERY\s+SELECT w\.id, w\.lifecycle, w\.phase\s+FROM public\.shared_worlds w\s+WHERE w\.id = p_world_id;\s+END\$\$;$/u);
    assert.doesNotMatch(functionBody, /'ACTIVE'|'READ_ONLY_CLOSED'|'STANDARD'|'INTRODUCTION'|55000|w\.lifecycle =|w\.phase =/u, 'no lifecycle or phase value is compared or decided anywhere in the function');
    assert.doesNotMatch(query, /'ACTIVE'|'READ_ONLY_CLOSED'|'STANDARD'|'INTRODUCTION'|CASE|COALESCE|LIMIT|DISTINCT|UNION|ORDER BY| OR |IS NOT NULL/u, 'lifecycle is returned, never decided, defaulted or widened');
    assert.equal((query.match(/JOIN/gu) ?? []).length, 0, 'no join: the Shared World row alone is the source');
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
    assert.match(selfAssertion, /target_table text := 'public\.shared_worlds';/u);
    assert.match(selfAssertion, /FOREACH target_role IN ARRAY ARRAY\['anon','authenticated','service_role'\]/u);
    assert.match(selfAssertion, /IF has_table_privilege\(target_role, target_table, target_privilege\) THEN\s+RAISE EXCEPTION 'I-03E: direct Shared World table access stays sealed/u);
    assert.match(selfAssertion, /IF EXISTS \(SELECT 1 FROM pg_policy pol WHERE pol\.polrelid = target_table::regclass\) THEN/u);
    assert.match(selfAssertion, /IF NOT rls_enabled THEN RAISE EXCEPTION/u);
  },
};

for (const [name, check] of Object.entries(checks)) {
  test(name, () => check(analyse(migration)));
}

test('0080 exists once, orders after 0079, migrations 0001-0079 are byte-unchanged, and a future migration 0081 is not banned', () => {
  const names = readdirSync(new URL('../migrations/', import.meta.url));
  const frozen = migrationOrderFacts(names);
  assert.equal(frozen.length, 79, 'migrations 0001-0079 are all present');
  const manifest = createHash('sha256').update(frozen.map((name) => `${name} ${gitBlobId(read(`../migrations/${name}`))}`).join('\n')).digest('hex');
  assert.equal(manifest, '147d57046254c2aa38e5e329ac34ffc029d5d355abcf069ecec87f75c0753b6b', 'migrations 0001-0079 are byte-identical to their merged blobs');
  // Forward safety: the same order facts hold when a later authorized migration exists.
  const later = migrationOrderFacts([...names, '0081_forward_safety_probe_v1.sql']);
  assert.deepEqual(later, frozen, 'a later migration changes nothing this contract claims');
  const self = readFileSync(new URL(import.meta.url), 'utf8').replace(/\r\n/gu, '\n').replace(/^\s*\/\/[^\n]*$/gmu, '');
  const banned = new RegExp(['slice\\(-\\d', "> '0080" + "_'", "'0081" + '_(?!forward_safety_probe)'].join('|'), 'u');
  assert.doesNotMatch(self, banned, 'this contract enumerates nothing after 0080');
});

test('the frozen kernel, I-03A evaluator, I-03B resolver and I-03D resolver production sources are byte-unchanged and no other API file changed shape', () => {
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
    ['../../apps/api/src/connected-worlds/audience/shared-human-audience-resolution.types.ts', '39dfdb3c443882682bc05e56bfc2fe1762a8d40f'],
    ['../../apps/api/src/connected-worlds/audience/shared-human-audience-resolver.service.ts', '940eaa77736efb9b171e878b45790cbccbe556c9'],
  ]) {
    assert.equal(gitBlobId(read(path)), blob, `${path} is byte-identical to its merged blob`);
  }
  assert.match(read('../../apps/api/src/connected-worlds/authority/standing-context-authority.spec.ts'), /'standing-context-authority\.spec\.ts', 'standing-context-authority\.ts', 'standing-context-authority\.types\.ts'/u);
  assert.match(read('../../apps/api/src/connected-worlds/authority-resolution/standing-context-grant-resolver.service.spec.ts'), /'standing-context-grant-resolver\.service\.spec\.ts', 'standing-context-grant-resolver\.service\.ts'/u);
  assert.match(read('../../apps/api/src/connected-worlds/audience/shared-human-audience-resolver.service.spec.ts'), /'shared-human-audience-resolution\.types\.ts',\s+'shared-human-audience-resolver\.service\.spec\.ts',\s+'shared-human-audience-resolver\.service\.ts',/u);
  assert.doesNotMatch(read('../../apps/api/src/app.module.ts'), /connected-worlds|StandingContext|SharedHumanAudience|EffectiveContext|PreModelWorldState/u, 'app.module.ts registers no Connected Worlds module');
  const apiSrc = new URL('../../apps/api/src/', import.meta.url);
  const separator = (name) => (name.includes('\\') ? '\\' : '/');
  const connectedWorlds = readdirSync(new URL('connected-worlds/', apiSrc), { recursive: true }).map(String);
  assert.deepEqual(connectedWorlds.filter((name) => /controller|module|gateway|\.dto\./u.test(name)), [], 'no controller, Nest module, gateway or DTO under connected-worlds');
  assert.deepEqual(connectedWorlds.filter((name) => name.includes('effective-context') && name.endsWith('.ts')).map((name) => name.split(/[\\/]/u).pop()).sort(), [
    'shared-effective-context.service.spec.ts', 'shared-effective-context.service.ts', 'shared-effective-context.types.ts',
    'shared-pre-model-world-state-resolver.service.spec.ts', 'shared-pre-model-world-state-resolver.service.ts',
  ], 'the effective-context namespace carries exactly the three production files and their two specs');
  // The effective-context namespace is the only place that names the World-state
  // RPC, and no API file outside the Connected Worlds domain (conversation,
  // model-router, intelligence-runtime, memory, human-model, hypothesis, ...)
  // knows the World-state resolver or the EffectiveContext at all. A later
  // authorized Connected Worlds slice (the Shared runtime integration) may
  // consume the EffectiveContext; that is not a 0080 property, so this contract
  // proves what I-03E introduced rather than a permanent ceiling on it.
  const sources = readdirSync(apiSrc, { recursive: true }).map(String).filter((name) => /\.(?:ts|js|mjs)$/u.test(name));
  const rpcInvokers = sources.filter((name) => !name.includes(`connected-worlds${separator(name)}effective-context`) && readFileSync(new URL(name, apiSrc), 'utf8').includes(FN));
  assert.deepEqual(rpcInvokers, [], 'no API file outside the effective-context namespace names the World-state RPC');
  const outsideConnectedWorlds = sources.filter((name) => !name.startsWith('connected-worlds') && /SharedEffectiveContext|SharedPreModelWorldState|effective-context/u.test(readFileSync(new URL(name, apiSrc), 'utf8')));
  assert.deepEqual(outsideConnectedWorlds, [], 'no API file outside the Connected Worlds domain knows the World-state resolver or the EffectiveContext: no model, provider, conversation, controller or messaging wiring');
});

test('the API World-state resolver calls exactly the RPC over the service-role transport, performs no direct table REST read, keeps the exact P0002 distinction and fingerprints the state deterministically', () => {
  assert.match(executableResolver, new RegExp(`SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC = '${FN}' as const;`, 'u'));
  assert.ok(executableResolver.includes('`${baseUrl}/rest/v1/rpc/${SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC}`'), 'exactly the RPC path');
  assert.equal((executableResolver.match(/\bfetch\(/gu) ?? []).length, 1, 'one fetch');
  assert.doesNotMatch(executableResolver, /\/rest\/v1\/(?!rpc\/)|shared_worlds\b|membership_episodes|select=|standing_context|grant_audience/u, 'no direct table REST read, no membership or grant read');
  assert.match(executableResolver, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(executableResolver, /Authorization: `Bearer \$\{serviceRoleKey\}`/u);
  assert.match(executableResolver, /body: JSON\.stringify\(\{ p_world_id: worldId \}\)/u, 'the body carries the World only: no client-supplied lifecycle');
  assert.doesNotMatch(executableResolver, /accessToken|jwt|auth\.uid|SUPABASE_ANON_KEY/iu, 'no client token path');
  assert.match(executableResolver, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/u);
  assert.match(executableResolver, /if \(!baseUrl \|\| !serviceRoleKey\) return unresolved\('WORLD_STATE_SNAPSHOT_UNAVAILABLE'\);/u);
  assert.match(executableResolver, /isTimeout\(error\) \? 'LOOKUP_TIMED_OUT' : 'LOOKUP_FAILED'/u);
  assert.match(executableResolver, /if \(!response\.ok\) return unresolved\(await classifyRejection\(response\)\);/u, 'a rejection is never a World state');
  // Task §10: the bounded 0080 nonexistent-World code (P0002) is canonical contradiction; every other rejection is infrastructure failure. Only `code` is read.
  assert.match(executableResolver, /NONCANONICAL_WORLD_SQLSTATE = 'P0002' as const;/u);
  assert.match(executableResolver, /return isRecord\(body\) && body\.code === NONCANONICAL_WORLD_SQLSTATE \? 'CONTRADICTORY_CANONICAL_STATE' : 'LOOKUP_FAILED';/u);
  assert.doesNotMatch(executableResolver, /body\.message|body\.details|body\.hint|response\.text\(|response\.statusText/u, 'no raw error message, detail, hint or body enters a result');
  assert.match(migration, /USING ERRCODE='P0002'/u, 'the migration raises exactly the code the resolver classifies');
  assert.match(worldStateSpec, /maps the bounded nonexistent-World rejection \(SQLSTATE P0002 from migration 0080\) to CONTRADICTORY_CANONICAL_STATE, never to LOOKUP_FAILED, never to a closed or empty World/u);
  assert.match(worldStateSpec, /keeps every other rejection as LOOKUP_FAILED/u);
  assert.match(worldStateSpec, /anti-vacuity: canonical contradiction and infrastructure failure are two different results/u);
  // Untrusted payload: exactly one row, exact keys, the requested World, a kernel-legal state; nothing salvaged, no NOT_FOUND.
  assert.match(executableResolver, /if \(!Array\.isArray\(payload\) \|\| payload\.length !== 1\) return 'CONTRADICTORY';/u);
  assert.match(executableResolver, /WORLD_STATE_ROW_KEYS = \['world_id', 'lifecycle', 'phase'\] as const;/u);
  assert.match(executableResolver, /row\.world_id\.toLowerCase\(\) !== worldId\.toLowerCase\(\)\) return 'CONTRADICTORY';/u);
  assert.match(executableResolver, /import \{ isLegalSharedWorldState \} from '\.\.\/kernel\/world-invariants';/u, 'lifecycle / phase legality is the frozen kernel\'s');
  assert.match(executableResolver, /!isLegalSharedWorldState\(state\)\) return 'CONTRADICTORY';/u);
  assert.match(executableResolver, /if \(interpreted === 'CONTRADICTORY'\) return unresolved\('CONTRADICTORY_CANONICAL_STATE'\);/u);
  assert.doesNotMatch(executableResolver, /NOT_FOUND|'READ_ONLY_CLOSED'|'ACTIVE'|BLOCKED|EMPTY/u, 'the resolver has no absence state and decides no lifecycle');
  assert.match(executableTypes, /SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_FAILURES = \[\s+'LOOKUP_FAILED',\s+'LOOKUP_TIMED_OUT',\s+'WORLD_STATE_SNAPSHOT_UNAVAILABLE',\s+'CONTRADICTORY_CANONICAL_STATE',\s+\] as const;/u);
  assert.match(executableTypes, /\| \{ readonly state: 'RESOLVED'; readonly snapshot: SharedPreModelWorldStateSnapshot \}\s+\| \{ readonly state: 'UNRESOLVED'; readonly failure: SharedPreModelWorldStateResolutionFailure \};/u);
  assert.doesNotMatch(executableTypes, /NOT_FOUND/u);
  // Fingerprint: versioned SHA-256 over World + lifecycle + phase; no clock, random identity or secret.
  assert.match(executableResolver, /SHARED_PRE_MODEL_WORLD_STATE_SNAPSHOT_VERSION = 'QANDEEL_CWV2_SHARED_PRE_MODEL_WORLD_STATE_V1' as const;/u);
  assert.match(executableResolver, /createHash\('sha256'\)/u);
  assert.match(executableResolver, /\[SHARED_PRE_MODEL_WORLD_STATE_SNAPSHOT_VERSION, `world=\$\{facts\.worldId\.toLowerCase\(\)\}`, `lifecycle=\$\{facts\.lifecycle\}`, `phase=\$\{facts\.phase\}`\]/u);
  assert.doesNotMatch(executableResolver, /randomUUID|Math\.random|Date\.now|new Date|performance\.now|setTimeout/u, 'clock- and random-free');
  assert.doesNotMatch(executableResolver, /model-router|ModelRouter|provider|conversation|memor|history|session|material|disclos|authority-resolution|standing-context-grant-resolver|shared-human-audience|shared-effective-context\.service/iu);
  assert.doesNotMatch(executableResolver, /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\b/u);
});

test('the EffectiveContext service composes I-03E + I-03D + I-03B + I-03A in the frozen order, admits ALLOW only, preserves order and content, invents no budget, no union, no grantor-in-audience rule and no model, controller or disclosure path', () => {
  assert.match(executableService, /import \{ evaluateStandingContextAuthority \} from '\.\.\/authority\/standing-context-authority';/u);
  assert.match(executableService, /import \{ StandingContextGrantResolverService \} from '\.\.\/authority-resolution\/standing-context-grant-resolver\.service';/u);
  assert.match(executableService, /import \{ SharedHumanAudienceResolverService \} from '\.\.\/audience\/shared-human-audience-resolver\.service';/u);
  assert.match(executableService, /import \{ SharedPreModelWorldStateResolverService \} from '\.\/shared-pre-model-world-state-resolver\.service';/u);
  assert.equal((executableService.match(/evaluateStandingContextAuthority\(/gu) ?? []).length, 1, 'the frozen I-03A evaluator is the ONE authority law, called once per candidate');
  // Frozen order: candidate structure -> World state (closed blocks) -> audience (EMPTY blocks) -> unique-owner grants -> per-candidate I-03A -> envelope.
  const order = [
    "if (validated === 'MALFORMED') return unresolved('MALFORMED_CANDIDATE_SET');",
    'worldState = await this.worldState.resolveCurrent(targetWorldId);',
    "if (!isResolvedWorldState(worldState, targetWorldId)) return unresolved('WORLD_STATE_UNRESOLVED');",
    "if (worldState.snapshot.lifecycle === 'READ_ONLY_CLOSED') return blocked('WORLD_READ_ONLY_CLOSED');",
    'audience = await this.audience.resolveCurrent(targetWorldId);',
    "if (isEmptyAudience(audience)) return blocked('NO_ACTIVE_HUMANS');",
    "if (!isResolvedAudience(audience)) return unresolved('AUDIENCE_UNRESOLVED');",
    'const owners = [...new Set(validated.map((candidate) => candidate.ownerHumanId))];',
    'await this.grants.resolveCurrent(targetWorldId, Object.freeze({ kind: \'HUMAN\', humanId: ownerHumanId } as const));',
    'for (const candidate of validated) {',
    'const decision = evaluateStandingContextAuthority(request, resolutions.get(candidate.ownerHumanId) ?? GRANT_RESOLUTION_FAILED);',
    "if (decision.decision !== 'ALLOW') continue;",
    'contentDigest: digestReasoningContent(candidate.reasoningContent),',
    'effectiveContextRef: fingerprintSharedEffectiveContext({',
    "return Object.freeze({ state: 'READY', effectiveContext } as const);",
  ];
  let cursor = -1;
  for (const step of order) {
    const at = executableService.indexOf(step, cursor + 1);
    assert.ok(at > cursor, `EffectiveContext step is present in order: ${step}`);
    cursor = at;
  }
  // Review R1: only the exact frozen I-03D EMPTY result (`{ state, snapshotRef }`, non-blank, no unknown property) is known BLOCKED state; an EMPTY-like malformed result is UNRESOLVED.
  assert.match(executableService, /const AUDIENCE_EMPTY_KEYS = \['state', 'snapshotRef'\] as const;/u);
  assert.match(executableService, /const AUDIENCE_RESOLVED_KEYS = \['state', 'snapshot'\] as const;/u);
  assert.match(executableService, /const AUDIENCE_SNAPSHOT_KEYS = \['snapshotRef', 'humans'\] as const;/u);
  assert.match(executableService, /return isRecord\(value\) && hasExactKeys\(value, AUDIENCE_EMPTY_KEYS\) && value\.state === 'EMPTY' && isNonBlankString\(value\.snapshotRef\);/u);
  assert.match(executableService, /if \(!isRecord\(value\) \|\| !hasExactKeys\(value, AUDIENCE_RESOLVED_KEYS\) \|\| value\.state !== 'RESOLVED' \|\| !isRecord\(value\.snapshot\)\) return false;/u);
  assert.doesNotMatch(executableService, /audience\.state === 'EMPTY'/u, 'no bare state check decides the BLOCKED branch');
  assert.ok(effectiveContextSpec.includes('anti-vacuity: an EMPTY-like malformed audience result (%s) is UNRESOLVED / AUDIENCE_UNRESOLVED, never BLOCKED, and grants are not called'), 'the spec proves the EMPTY-shape distinction');
  for (const probe of ["['missing snapshotRef', { state: 'EMPTY' }]", "['blank snapshotRef', { state: 'EMPTY', snapshotRef: '' }]", "['extra property (an empty humans list)', { ...AUDIENCE_EMPTY, humans: [] }]", "['a bare EMPTY string', 'EMPTY']"]) {
    assert.ok(effectiveContextSpec.includes(probe), `EffectiveContext spec is missing the EMPTY-shape probe ${probe}`);
  }
  // The request handed to I-03A is exactly the frozen shape, with the SAME audience snapshot for every candidate and the candidate's exact owner as grantor.
  assert.match(executableService, /action: STANDING_CONTEXT_ACTION,\s+grantor,\s+targetWorldId,\s+purpose: STANDING_CONTEXT_PURPOSE,\s+audienceSnapshot,/u);
  assert.match(executableService, /GRANT_RESOLUTION_FAILED: StandingContextGrantResolution = Object\.freeze\(\{ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' \} as const\);/u, 'a throwing grant resolver is an unresolved grant for that owner only');
  // Source availability law: deleted / unavailable candidates are excluded structurally, never resurrected, and content on them is a contradiction.
  assert.match(executableService, /if \(availability === 'AVAILABLE'\) \{/u);
  assert.match(executableService, /\} else if \(!hasExactKeys\(candidate, CANDIDATE_KEYS\) \|\| 'reasoningContent' in candidate\) \{/u);
  assert.match(executableService, /const identity = JSON\.stringify\(\[owner\.humanId, contextId\]\);/u, 'source identity is (owner, contextId)');
  assert.match(executableService, /originWorld\.architectureClass !== 'WORLD' \|\| originWorld\.worldType !== 'MY_WORLD'\) return 'MALFORMED';/u);
  assert.match(executableService, /!isHumanPrincipal\(owner\)\) return 'MALFORMED';/u);
  // No reranking, rewriting, budgeting, union or grantor-in-audience rule; no model, controller, table, disclosure or delivery path.
  assert.doesNotMatch(executableService, /\.sort\(|reasoningContent\.(?:replace|slice|substring|substr|trim|toLowerCase|normalize|split)|truncat|summar|redact/u);
  assert.doesNotMatch(executableService, /BUDGET|_BYTES|_TOKENS|MAX_PRIVATE|tokeniz|byteLength/u, 'no byte or token budget is invented');
  assert.doesNotMatch(executableService, /humans\.(?:some|includes|find|indexOf|filter)\(/u, 'no grantor-in-audience rule');
  assert.doesNotMatch(executableService, /audienceCeiling|\.\.\.resolutions|concat\(|flatMap\(.*grant/u, 'grants are never unioned or widened here');
  assert.doesNotMatch(executableService, /model-router|ModelRouter|composeServerGuidance|memoryContext|intelligence-runtime|IntegratedContext|conversation|human-model|hypothes|recommendation|question|runtime-events/iu);
  assert.doesNotMatch(executableService, /@Controller|@Get|@Post|@Module|\bfetch\b|\/rest\/v1\/|shared_worlds\b|membership_episodes|standing_context_grants|memories|conversation_turns|conversation_sessions/u);
  assert.doesNotMatch(executableService, /SourceMaterialRef|materialId|MATERIAL_DEPENDENCY|REASONING_DEPENDENCY|disclos|publish|quote|deliver|history|replay|matching|public_world/iu);
  assert.doesNotMatch(executableService, /'GRANTED'|'NOT_GRANTED'|'SEALED'|'REQUIRES_REVALIDATION'|contextClassification:|deliveryAuthority:|allowed:|'DENY'|'UNKNOWN'|decision\.reason/u, 'constraints are carried from I-03A, never manufactured; per-owner reasons never enter the result');
  assert.doesNotMatch(executableService, /randomUUID|Math\.random|Date\.now|new Date|performance\.now|setTimeout|accessToken|jwt|auth\.uid|SUPABASE/iu);
  assert.doesNotMatch(executableService, /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\b|revoke|persist/u);
  // Fingerprint: versioned, World + World state + audience + ordered items (ordinal, owner, contextId, digest, grant, authority snapshot); no raw content.
  assert.match(executableService, /SHARED_EFFECTIVE_CONTEXT_VERSION = 'QANDEEL_CWV2_SHARED_EFFECTIVE_CONTEXT_V1' as const;/u);
  assert.match(executableService, /`world=\$\{facts\.worldId\.toLowerCase\(\)\}`,\s+`worldState=\$\{facts\.worldStateSnapshotRef\}`,\s+`audience=\$\{facts\.audienceSnapshotRef\}`,\s+`items=\$\{facts\.items\.length\}`,/u);
  assert.match(executableService, /JSON\.stringify\(\[ordinal, item\.ownerHumanId, item\.contextId, item\.contentDigest, item\.grantId, item\.authoritySnapshotRef\]\)/u);
  assert.doesNotMatch(executableService, /reasoningContent[^\n]*fingerprint|fingerprint[^\n]*reasoningContent/u, 'raw content never enters the fingerprint');
  // Types: the closed contract; no permission flag, no NOT_FOUND, no competing snapshot.
  assert.match(executableTypes, /export type SharedEffectiveContextResolution =\s+\| \{ readonly state: 'READY'; readonly effectiveContext: SharedEffectiveContext \}\s+\| \{ readonly state: 'BLOCKED'; readonly reason: SharedEffectiveContextBlockReason \}\s+\| \{ readonly state: 'UNRESOLVED'; readonly reason: SharedEffectiveContextUnresolvedReason \};/u);
  assert.match(executableTypes, /SHARED_EFFECTIVE_CONTEXT_BLOCK_REASONS = \['WORLD_READ_ONLY_CLOSED', 'NO_ACTIVE_HUMANS'\] as const;/u);
  assert.match(executableTypes, /SHARED_EFFECTIVE_CONTEXT_UNRESOLVED_REASONS = \['WORLD_STATE_UNRESOLVED', 'AUDIENCE_UNRESOLVED', 'MALFORMED_CANDIDATE_SET'\] as const;/u);
  assert.match(executableTypes, /readonly authority: StandingContextAllowDecision;/u);
  assert.match(executableTypes, /export type StandingContextAllowDecision = Extract<StandingContextAuthorityDecision, \{ readonly decision: 'ALLOW' \}>;/u, 'the authority is structurally the exact I-03A ALLOW branch');
  assert.match(executableTypes, /export interface PrivateSourceContextRef extends SourceContextRef \{\s+readonly originWorld: MyWorldRef;\s+\}/u);
  assert.match(executableTypes, /readonly reasoningContent\?: never;/u, 'an unavailable candidate cannot carry content by type');
  assert.match(executableTypes, /import type \{ SharedHumanAudienceSnapshot, StandingContextAuthorityDecision \} from '\.\.\/authority\/standing-context-authority\.types';/u, 'the frozen I-03A snapshot and decision types are reused');
  assert.doesNotMatch(executableTypes, /materialDisclosureAllowed|publishAllowed|historyAccess|replayAllowed|matchingAllowed|publicAllowed|deliveryAllowed|allowed:|NOT_FOUND|interface \w*AudienceSnapshot\b|SourceMaterialRef/u);
  // The specs prove the required behaviours by name.
  for (const proof of [
    '1. a malformed candidate set is UNRESOLVED / MALFORMED_CANDIDATE_SET before any resolver is called',
    '3. READ_ONLY_CLOSED (either phase) is BLOCKED / WORLD_READ_ONLY_CLOSED',
    '5. ACTIVE / INTRODUCTION proceeds with exactly the same admission: Introduction creates no extra privacy authority',
    '7. an EMPTY audience is BLOCKED / NO_ACTIVE_HUMANS',
    '10. an unavailable or deleted candidate that still carries content fails the WHOLE set closed as malformed',
    '12. a deleted / unavailable payload never appears in a READY result or its fingerprint',
    '17. different owners may reuse the same opaque contextId',
    '22. an audience that exceeds the grant ceiling excludes the item',
    "24. grants are never unioned: Ahmed's wider ceiling never covers Mohamed's item",
    '26. the same owner with several candidates triggers exactly one grant resolution and one authority snapshot',
    "28. another owner's safe item is still admitted beside a throwing owner",
    'does not invent a grantor-in-audience rule',
    '29-33. an admitted item carries the exact I-03A ALLOW constraints',
    '34. content is byte-identical to the candidate input',
    '36. candidate order is preserved after exclusions',
    '42. the reference changes with the audience snapshot even when the human set is identical (leave / rejoin)',
    '47. the canonical fingerprint representation binds World, World state, audience and every item without clock, random, secret or raw content',
    '51. every grant resolution unresolved -> READY with an empty private list',
    'the production result carries no per-owner DENY / UNKNOWN detail and no excluded owner identity',
    'end-to-end through the real I-03E / I-03D / I-03B resolvers over a mocked service-role transport',
  ]) {
    assert.ok(effectiveContextSpec.includes(proof), `EffectiveContext spec is missing: ${proof}`);
  }
  assert.match(effectiveContextSpec, /'shared-effective-context\.service\.spec\.ts',\s+'shared-effective-context\.service\.ts',\s+'shared-effective-context\.types\.ts',\s+'shared-pre-model-world-state-resolver\.service\.spec\.ts',\s+'shared-pre-model-world-state-resolver\.service\.ts',/u, 'the effective-context directory carries its own closure guard');
});

test('the 0080 verifier proves the catalog, both ACLs, canonical existence, every legal state, no membership or grant read, zero mutation, forward safety and rolled-back fixtures', () => {
  for (const proof of [
    'process.env.DATABASE_URL',
    'pg_get_function_identity_arguments(pr.oid)',
    'pg_get_function_result(pr.oid)',
    "'p_world_id uuid'",
    "'TABLE(world_id uuid, lifecycle text, phase text)'",
    "assert.equal(fn.owner, 'postgres'",
    "assert.equal(fn.prosecdef, true",
    "assert.equal(fn.provolatile, 's'",
    "cfg === 'search_path=' || cfg === 'search_path=\"\"'",
    'SELECT w\\.id, w\\.lifecycle, w\\.phase',
    "has_function_privilege($1, $2, $3)",
    "for (const role of ['public', 'anon', 'authenticated'])",
    "['42501']",
    'has_table_privilege($1,$2,$3)',
    'for (const role of APPLICATION_ROLES)',
    'SELECT lifecycle, phase FROM ${WORLDS} WHERE id=$1',
    "['P0002']",
    "['22023']",
    'never zero rows and never a closed row',
    'no membership, grant or material read is needed',
    'ACTIVE / STANDARD is exactly its one row',
    'ACTIVE / INTRODUCTION is exactly its one row',
    'READ_ONLY_CLOSED / STANDARD is exactly its one closed row',
    'READ_ONLY_CLOSED / INTRODUCTION is exactly its one closed row',
    'another World never leaks into a result',
    'occupancy and Standing Context state never enter the World-state answer',
    'an open episode does not reopen a closed World',
    'no World, episode, grant, ceiling or consent row changed',
    'lifecycle and phase are unchanged',
    "await identity('service_role')",
    'a later unrelated trigger on shared_worlds is not a 0080 failure',
    'the read path is unaffected by the unrelated trigger',
    'no fixture row remains after completion',
    "await q('ROLLBACK')",
  ]) {
    assert.ok(verifier.includes(proof), `0080 verifier is missing ${proof}`);
  }
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu, 'no connection detail is embedded');
  assert.doesNotMatch(verifier, /\bGRANT\b|CREATE POLICY|DISABLE ROW LEVEL SECURITY|session_replication_role/u, 'the verifier never widens an ACL to make a proof easy');
  assert.doesNotMatch(verifier, /UPDATE \$\{WORLDS\} SET lifecycle='READ_ONLY_CLOSED', closed_at=CURRENT_TIMESTAMP WHERE id=\$1/u, 'no lifecycle mutation is implemented or exercised as a command');
  // Not a mutable-global ceiling: no live relation-count, function-count or permanent zero-trigger assertion.
  assert.doesNotMatch(verifier, /relname ~\*|added no table or view|proname ~ |assert\.equal\(n, 0, `\$\{WORLDS\} has no trigger`\)/u, 'the historical 0080 verifier asserts no permanent global relation, function or trigger ceiling');
});

test('the verifier is wired into the toolchain, API CI after fresh migrations and the 0075 - 0079 verifiers, and the database README', () => {
  assert.match(packageJson, /"verify:shared-pre-model-world-state:integration": "node --env-file-if-exists=\.env database\/verify-migration-0080\.mjs"/u);
  assert.equal((workflow.match(/verify:shared-pre-model-world-state:integration/gu) ?? []).length, 1, 'registered exactly once in API CI');
  const step = workflow.indexOf('run: npm run verify:shared-pre-model-world-state:integration');
  assert.ok(step > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'), 'the verifier runs after fresh migrations are applied');
  for (const predecessor of ['verify:connected-worlds-shared-persistence:integration', 'verify:shared-world-standing-context-grants:integration', 'verify:shared-standing-context-grant-resolution:integration', 'verify:shared-standing-context-consent-commands:integration', 'verify:shared-human-audience-snapshot-resolution:integration']) {
    assert.ok(step > workflow.indexOf(`run: npm run ${predecessor}`), `the verifier runs after ${predecessor}`);
  }
  assert.match(workflow, /Verify Shared pre-model World-state resolution boundary against real PostgreSQL/u);
  assert.match(readme, /## Shared pre-model World-state resolution boundary and EffectiveContext \(migration 0080, I-03E\)/u);
  assert.match(readme, /npm run verify:shared-pre-model-world-state:integration/u);
  assert.match(readme, /\*\*No lifecycle mutation exists\*\*/u);
  assert.match(readme, /\*\*No direct Shared table read\*\*/u);
  assert.match(readme, /never to `NOT_FOUND`/u);
  assert.match(readme, /`READ_ONLY_CLOSED` blocks ordinary pre-model Shared\s+generation/u);
  assert.match(readme, /no extra privacy authority for Introduction/u);
  assert.match(readme, /\*\*state snapshot the EffectiveContext binds\*\*/u);
  assert.match(readme, /\*\*server-internal\*\* Shared EffectiveContext/u);
  assert.match(readme, /\*\*private reasoning-only\*\*/u);
  assert.match(readme, /\*\*No model integration\*\*/u);
});

test('anti-vacuity: every deliberate weakening of migration 0080 is refused by at least one structural check', () => {
  const mutations = [
    ['EXECUTE granted to authenticated', (sql) => sql.replace(`GRANT EXECUTE ON FUNCTION public.${FN}(uuid) TO service_role;`, `GRANT EXECUTE ON FUNCTION public.${FN}(uuid) TO service_role, authenticated;`)],
    ['direct SELECT opened on shared_worlds', (sql) => sql.replace(`GRANT EXECUTE ON FUNCTION public.${FN}(uuid) TO service_role;`, `GRANT EXECUTE ON FUNCTION public.${FN}(uuid) TO service_role;\nGRANT SELECT ON TABLE public.shared_worlds TO service_role;`)],
    ['the existence check dropped (nonexistent World becomes zero rows)', (sql) => sql.replace("  IF NOT EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = p_world_id) THEN\n    RAISE EXCEPTION 'Shared pre-model World-state resolution target is not a canonical Shared World' USING ERRCODE='P0002';\n  END IF;\n", '')],
    ['lifecycle decided in SQL (closed World raised as an error)', (sql) => sql.replace('  RETURN QUERY\n', "  IF EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = p_world_id AND w.lifecycle = 'READ_ONLY_CLOSED') THEN\n    RAISE EXCEPTION 'closed' USING ERRCODE='55000';\n  END IF;\n  RETURN QUERY\n")],
    ['a lifecycle default (nonexistent World reported ACTIVE)', (sql) => sql.replace("    SELECT w.id, w.lifecycle, w.phase\n", "    SELECT p_world_id, COALESCE(w.lifecycle, 'ACTIVE'), COALESCE(w.phase, 'STANDARD')\n")],
    ['a membership read', (sql) => sql.replace('      FROM public.shared_worlds w\n', '      FROM public.shared_worlds w\n      JOIN public.shared_world_membership_episodes e ON e.world_id = w.id\n')],
    ['a grant read', (sql) => sql.replace('    SELECT w.id, w.lifecycle, w.phase\n', '    SELECT w.id, w.lifecycle, w.phase, (SELECT count(*) FROM public.shared_world_standing_context_grants g WHERE g.world_id = w.id) AS grants\n')],
    ['closed_at returned', (sql) => sql.replace('RETURNS TABLE(world_id uuid, lifecycle text, phase text)', 'RETURNS TABLE(world_id uuid, lifecycle text, phase text, closed_at timestamptz)').replace('    SELECT w.id, w.lifecycle, w.phase\n', '    SELECT w.id, w.lifecycle, w.phase, w.closed_at\n')],
    ['birth_basis returned', (sql) => sql.replace('RETURNS TABLE(world_id uuid, lifecycle text, phase text)', 'RETURNS TABLE(world_id uuid, lifecycle text, phase text, birth_basis text').replace('    SELECT w.id, w.lifecycle, w.phase\n', '    SELECT w.id, w.lifecycle, w.phase, w.birth_basis\n')],
    ['a client-supplied lifecycle parameter', (sql) => sql.replace(`CREATE FUNCTION public.${FN}(p_world_id uuid)`, `CREATE FUNCTION public.${FN}(p_world_id uuid, p_expected_lifecycle text DEFAULT NULL)`)],
    ['VOLATILE with a lifecycle write', (sql) => sql.replace("LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$\nBEGIN\n  IF p_world_id IS NULL", "LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$\nBEGIN\n  UPDATE public.shared_worlds SET lifecycle = 'ACTIVE', closed_at = NULL WHERE id = p_world_id;\n  IF p_world_id IS NULL")],
    ['an unpinned search_path', (sql) => sql.replace("SECURITY DEFINER STABLE SET search_path='' AS $$", 'SECURITY DEFINER STABLE AS $$')],
    ['auth.uid() consulted', (sql) => sql.replace('  IF p_world_id IS NULL THEN', '  IF auth.uid() IS NULL THEN RAISE EXCEPTION \'FORBIDDEN\' USING ERRCODE=\'42501\'; END IF;\n  IF p_world_id IS NULL THEN')],
    ['a second function (a lifecycle command)', (sql) => sql.replace('-- Terminal self-assertions.', `CREATE FUNCTION public.close_shared_world_v1(p_world_id uuid) RETURNS void LANGUAGE sql AS 'SELECT NULL';\n-- Terminal self-assertions.`)],
    ['a table', (sql) => sql.replace('-- Terminal self-assertions.', 'CREATE TABLE public.shared_world_state_snapshots (id uuid PRIMARY KEY);\n-- Terminal self-assertions.')],
    ['a view over shared_worlds', (sql) => sql.replace('-- Terminal self-assertions.', 'CREATE VIEW public.shared_world_states AS SELECT id, lifecycle, phase FROM public.shared_worlds;\n-- Terminal self-assertions.')],
    ['a policy on shared_worlds', (sql) => sql.replace('-- Terminal self-assertions.', 'CREATE POLICY worlds_read ON public.shared_worlds FOR SELECT TO service_role USING (true);\n-- Terminal self-assertions.')],
    ['a trigger on shared_worlds', (sql) => sql.replace('-- Terminal self-assertions.', 'CREATE TRIGGER shared_worlds_state_audit AFTER UPDATE ON public.shared_worlds FOR EACH ROW EXECUTE FUNCTION public.resolve_shared_world_pre_model_state_v1();\n-- Terminal self-assertions.')],
    ['the self-assertion no longer refuses authenticated execution', (sql) => sql.replace("FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP\n    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN", "FOREACH target_role IN ARRAY ARRAY['anon'] LOOP\n    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN")],
    ['another World allowed to leak (widened predicate)', (sql) => sql.replace('     WHERE w.id = p_world_id;\nEND$$;', '     WHERE w.id = p_world_id OR w.closed_at IS NOT NULL;\nEND$$;')],
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
  assert.equal(mutations.length, 20);
});
