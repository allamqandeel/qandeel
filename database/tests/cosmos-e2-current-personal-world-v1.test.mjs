import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

// COSMOS E-2 corrections, Slice C — the user-level CURRENT Personal World (migration 0199), under the Product Owner's
// decision D-5, Option U, of 2026-11-20: ONE owner-scoped read of the Threads the person has NOW (Home, served name,
// origin), beside — never instead of — the Session-bound historical projection, whose frozen availability law is not
// changed. This is the STATIC contract; the posture is proven against real PostgreSQL by
// database/verify-migration-0199.mjs in API CI (no PostgreSQL binary exists on the Windows development machine, so the
// verifier is NOT TESTED locally and is reported as such).

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION = '0199_cosmos_e2_current_personal_world_v1.sql';
const migration = read(`../migrations/${MIGRATION}`);
const verifier = read('../verify-migration-0199.mjs');
const packageJson = JSON.parse(read('../../package.json'));
const workflow = read('../../.github/workflows/api-ci.yml');
const stripSql = (text) => text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const code = stripSql(migration);

test('0199 follows 0198, forward-only, one transaction, and replaces, alters or writes nothing', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  const at = migrations.indexOf(MIGRATION);
  assert.ok(at >= 0, '0199 exists');
  assert.equal(migrations[at - 1], '0198_cosmos_e2_thread_names_v1.sql', 'exactly 0199 follows 0198');
  assert.equal(migrations.filter((name) => name.startsWith('0199_')).length, 1);
  assert.equal((code.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((code.match(/^COMMIT;$/gmu) ?? []).length, 1);
  assert.doesNotMatch(code, /CREATE OR REPLACE FUNCTION/u, 'no earlier function is replaced: V1 and V2 are untouched');
  assert.doesNotMatch(code, /(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX|POLICY|TRIGGER)\b/u, 'no table, index, policy or trigger: a read, nothing else');
  assert.doesNotMatch(code, /^\s*(?:INSERT INTO|UPDATE\s+\S+\s+SET|DELETE FROM|TRUNCATE)\b/gmu, 'no write of any kind');
  assert.equal((code.match(/CREATE FUNCTION/gu) ?? []).length, 1, 'exactly ONE function');
});

test('A — the read is owner-scoped through auth.uid(), fails closed, and lists exactly the canonical Threads with a Home', () => {
  assert.match(code, /CREATE FUNCTION public\.get_user_current_personal_world_v1\(\)\nRETURNS TABLE \(as_of timestamptz, threads jsonb\)\nLANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS \$\$/u);
  assert.match(code, /caller uuid := auth\.uid\(\);/u);
  assert.match(code, /IF caller IS NULL THEN\n\s*RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';/u);
  assert.match(code, /FROM public\.conversation_threads t\n\s*JOIN public\.conversation_thread_homes h ON h\.thread_id = t\.id/u);
  assert.match(code, /WHERE t\.user_id = caller/u);
  assert.match(code, /'home', jsonb_build_object\('x', h\.placement_x::text, 'y', h\.placement_y::text\)/u, 'the ONE canonical Home, as exact integer text');
  assert.match(code, /'origin', jsonb_build_object\('sessionId', t\.established_session_id, 'sp', t\.established_sp\)/u);
  assert.match(code, /coalesce\(jsonb_agg\([\s\S]*ORDER BY t\.id\), '\[\]'::jsonb\)/u, 'an empty world is an empty list, never an error');
  assert.match(code, /CURRENT_TIMESTAMP AS as_of/u, 'as_of is the instant of the read: the present, never a Session Position');
});

test('B — the name follows the 0198 law exactly (alias, else grounding wording, else NONE); nothing is derived', () => {
  assert.match(code, /WHEN al\.alias IS NOT NULL THEN jsonb_build_object\('text', al\.alias, 'source', 'USER_ALIAS'\)/u);
  assert.match(code, /WHEN gw\.wording IS NOT NULL THEN jsonb_build_object\('text', gw\.wording, 'source', 'GROUNDING_WORDING'\)/u);
  assert.match(code, /ELSE jsonb_build_object\('text', NULL, 'source', 'NONE'\)/u);
  assert.match(code, /FROM public\.conversation_thread_aliases a\n\s*WHERE a\.thread_id = t\.id AND a\.user_id = caller\n\s*ORDER BY a\.id DESC LIMIT 1/u, 'the newest alias of the caller');
  assert.match(code, /left\(btrim\(regexp_replace\(r\.anchor_text, '\\s\+', ' ', 'g'\)\), 80\) AS wording/u);
  assert.match(code, /AND r\.session_position <= t\.established_sp/u, 'the wording is bounded by the establishing Session Position');
  for (const forbidden of [/hypotheses/u, /statement/u, /summary/u, /count\(\*\)/u, /lifecycle/u, /live_focus/u, /thread_reading_bindings/u]) {
    assert.doesNotMatch(code, forbidden, `the current world derives nothing Session-anchored (${forbidden.source})`);
  }
  // The frozen Session-bound law is not touched: no availability clause is rewritten, V1 / V2 are not referenced.
  assert.doesNotMatch(code, /historical_thread_availability|world_version|get_session_historical_projection_v[12]/u);
});

test('C — the ACL is the 0030 posture: postgres-owned definer, authenticated only, self-asserted', () => {
  assert.match(code, /ALTER FUNCTION public\.get_user_current_personal_world_v1\(\) OWNER TO postgres;/u);
  assert.match(code, /REVOKE ALL ON FUNCTION public\.get_user_current_personal_world_v1\(\) FROM PUBLIC, anon;/u);
  assert.match(code, /REVOKE ALL ON FUNCTION public\.get_user_current_personal_world_v1\(\) FROM service_role;/u);
  assert.match(code, /GRANT EXECUTE ON FUNCTION public\.get_user_current_personal_world_v1\(\) TO authenticated;/u);
  assert.match(code, /RAISE EXCEPTION '0199: % must be SECURITY DEFINER, owned by postgres, with a pinned search_path', fn;/u);
  assert.match(code, /RAISE EXCEPTION '0199: anon must not execute %', fn;/u);
  assert.match(code, /RAISE EXCEPTION '0199: service_role must not execute %', fn;/u);
  assert.match(code, /RAISE EXCEPTION '0199: authenticated must execute %', fn;/u);
});

test('D — the real-PostgreSQL verifier exists, is wired, rolls back, and states what it does not prove', () => {
  assert.equal(existsSync(new URL('../verify-migration-0199.mjs', import.meta.url)), true);
  for (const stage of ["'T0 catalogue'", "'T1 fails closed'", "'T2 an empty world is one truthful row'", "'T3 the Session-bound projection is untouched'"]) {
    assert.ok(verifier.includes(`stage = ${stage}`), `the verifier runs ${stage}`);
  }
  assert.match(verifier, /does NOT seed Threads/u);
  assert.match(verifier, /NOT TESTED here/u);
  assert.match(verifier, /await q\('ROLLBACK'\);\n\s*console\.log\('migration 0199 verified'\);/u);
  assert.equal(packageJson.scripts['verify:current-personal-world:integration'], 'node --env-file-if-exists=.env database/verify-migration-0199.mjs');
  assert.equal(packageJson.scripts['test:cosmos-e2-current-personal-world-contract'], 'node --test database/tests/cosmos-e2-current-personal-world-v1.test.mjs');
  const names = workflow.indexOf('npm run verify:thread-names:integration');
  const world = workflow.indexOf('npm run verify:current-personal-world:integration');
  assert.ok(names >= 0 && world > names, 'API CI verifies 0199 against real PostgreSQL right after 0198');
});

test('E — the API reads it through ONE RPC and serves it on ONE owner-scoped route; the client validates every row', () => {
  const api = (path) => read(`../../apps/api/src/${path}`);
  const repository = api('historical-projection/historical-projection.repository.ts');
  assert.match(repository, /'rpc\/get_user_current_personal_world_v1'/u);
  assert.equal((repository.match(/'rpc\//gu) ?? []).length, 2, 'the Session-bound V2 read and the current-world read: nothing else');
  const controller = api('conversation/conversation-historical-projection.controller.ts');
  assert.match(controller, /@Get\('personal-world'\)/u);
  assert.match(controller, /currentPersonalWorld\(accessToken\)/u);
  const mapper = api('historical-projection/historical-projection-mapper.ts');
  assert.match(mapper, /const CURRENT_WORLD_ROW_KEYS = \['as_of', 'threads'\] as const;/u);
  assert.match(mapper, /const CURRENT_THREAD_KEYS = \['id', 'home', 'name', 'origin'\] as const;/u);
  assert.match(mapper, /export function mapCurrentPersonalWorldRow\(/u);
  const census = api('http-security/route-rate-limit.census.ts');
  assert.match(census, /'GET \/conversation\/personal-world': 'CONVERSATION',/u);
  const wire = read('../../packages/runtime/src/current-personal-world.d.ts');
  assert.match(wire, /export interface CurrentPersonalWorld \{/u);
  assert.match(wire, /readonly asOf: string;/u);
  // The CODE of the wire (its comments explain what is deliberately absent, so they are stripped before the check).
  const wireCode = wire.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');
  assert.doesNotMatch(wireCode, /lifecycle|liveFocus|tc\b|liveHead/u, 'the current world carries no Session-anchored temporal field');
  const client = read('../../apps/mobile/src/runtime-entry/conversation/current-personal-world-api.ts');
  assert.match(client, /\/conversation\/personal-world/u);
  assert.match(client, /a current-world row is malformed/u);
});
