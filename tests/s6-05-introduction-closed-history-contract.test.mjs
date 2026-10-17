// S6-05 — Mutual Match & Introduction World, CP4 (Introduction END & Closed History Integration): the cross-layer static
// contract.
//
// It pins what a later change could silently erode: migration 0161 directly follows 0160, is forward-only, replaces,
// alters and writes nothing, and leaves the authority it composes byte-identical - the material resolver (0089), owner
// deletion (0090 / 0139 / 0143), the closed-view entitlements and the closed resolver (0115 / 0119), the END core (0116),
// the S6-02 END boundary and fence (0155) and the CP2 / CP3 boundaries (0159 / 0160); it adds exactly ONE authenticated
// STABLE reader that answers from the caller's OWN frozen entitlement before anything of the history is read, consults
// no membership, and lets the frozen material resolver decide visibility; END and deletion stay the existing routes, with
// no second END or deletion anywhere; nothing reaches a QANDEEL reply, weaving, analysis, Activity, Push, a gate, an
// account Name, a grant or Personal Context; mobile is untouched (CP5); and the proofs are wired into CI. Live behaviour
// is proven by database/verify-migration-0161.mjs (real PostgreSQL) and
// database/prove-0161-introduction-closed-history-postgrest.mjs (live PostgREST); this file proves structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const sql = (text) => text.replace(/--[^\n]*/gu, '');
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const MIGRATIONS = 'database/migrations';
const MIGRATION = `${MIGRATIONS}/0161_introduction_closed_history_v1.sql`;
const VERIFIER = 'database/verify-migration-0161.mjs';
const WIRE = 'database/prove-0161-introduction-closed-history-postgrest.mjs';
const API = 'apps/api/src/introductions-world';
const blob = (path) => {
  const bytes = Buffer.from(read(path), 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
/** The authority S6-05 CP4 composes, byte-identical (git blob ids at the CP3 head, 18988bc2). */
const FROZEN = {
  [`${MIGRATIONS}/0089_shared_world_material_persistence_v1.sql`]: '82d6d5f0c293528649198efee2305ca0baa7b685',
  [`${MIGRATIONS}/0090_shared_world_material_commit_owner_deletion_v1.sql`]: 'c65bb170449e98454b4ba248dad3793b6ea363f8',
  [`${MIGRATIONS}/0115_introduction_progressive_disclosure_history_visibility_v1.sql`]: '06d6528e1d03443d53aa040a555a437a458c7cb4',
  [`${MIGRATIONS}/0116_introduction_terminal_lifecycle_v1.sql`]: '93cd217f96c2b3562e94cb1eaead0019097d654f',
  [`${MIGRATIONS}/0119_shared_historical_authority_remediation_v1.sql`]: '77f01566a8e1070fd038cefc52e70d3fe5ef7bba',
  [`${MIGRATIONS}/0139_shared_world_conversation_material_v1.sql`]: '32a08f4f880766b56728b7cc4040bb26082e6e74',
  [`${MIGRATIONS}/0143_public_authoring_rights_privacy_v1.sql`]: 'a619bbc965ce266756e115c59c2e5152840934d0',
  [`${MIGRATIONS}/0155_introduction_privacy_isolation_end_boundary_v1.sql`]: 'be25d95ba8eb8f17d883d7b442089d03bf3f2d38',
  [`${MIGRATIONS}/0159_matching_mutual_match_acceptance_v1.sql`]: '743ae60baf8f1759e191d113c8e9b9108cd43bfe',
  [`${MIGRATIONS}/0160_introduction_world_human_messaging_v1.sql`]: '6bc32f4a72a44f1e38d2224fa29a7c355d2fd5b9',
  // The S6-02 END route, reused unchanged (no second END).
  'apps/api/src/introductions-lifecycle/introduction-end.controller.ts': '2683457fd7a0bcf87c532bc73dbb1e9125d48bc6',
  'apps/api/src/introductions-lifecycle/introduction-end.service.ts': 'a63c6c9ae0fdef39cee124e8f28d2005ec553b60',
  'apps/api/src/introductions-lifecycle/introduction-end.repository.ts': '3bfe79a5a4a53be9cd4076551094f73eaff3f071',
};
/** `FUNCTION public.read_my_introduction_history_v1(` ... through its closing dollar tag, comments removed. */
function reader() {
  const text = read(MIGRATION);
  const start = text.indexOf('FUNCTION public.read_my_introduction_history_v1(');
  assert.ok(start >= 0, '0161 defines the reader');
  const tag = /AS (\$[A-Za-z_]*\$)/u.exec(text.slice(start));
  const open = start + tag.index + tag[0].length;
  return sql(text.slice(start, text.indexOf(tag[1], open) + tag[1].length));
}

test('1 — 0161 directly follows 0160, is forward-only, creates exactly one function and leaves the composed authority byte-identical', () => {
  const files = readdirSync(new URL(`${MIGRATIONS}/`, root)).filter((f) => /^\d{4}_.*\.sql$/u.test(f)).sort();
  assert.equal(files.filter((f) => f.startsWith('0161_')).length, 1, 'exactly one 0161');
  assert.equal(files[files.indexOf('0161_introduction_closed_history_v1.sql') - 1], '0160_introduction_world_human_messaging_v1.sql');
  for (const [file, id] of Object.entries(FROZEN)) assert.equal(blob(file), id, `${file} is byte-identical`);
  const body = sql(read(MIGRATION));
  assert.deepEqual([...body.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z_.0-9]+)\(/gu)].map((m) => m[1]), ['public.read_my_introduction_history_v1']);
  assert.doesNotMatch(body, /CREATE OR REPLACE|ALTER TABLE|CREATE TABLE|DROP |CREATE TRIGGER|CREATE POLICY|CREATE INDEX|INSERT INTO|UPDATE public|DELETE FROM/u,
    'nothing existing is replaced, altered or written');
  assert.match(body, /^BEGIN;/mu);
  assert.match(body, /^COMMIT;\s*$/mu);
});

test('2 — one authenticated-only STABLE reader: the caller\'s own frozen entitlement first, never membership, visibility the frozen resolver\'s', () => {
  const body = sql(read(MIGRATION));
  assert.match(body, /GRANT EXECUTE ON FUNCTION public\.read_my_introduction_history_v1\(uuid, timestamptz, uuid, integer\) TO authenticated;/u);
  assert.equal((body.match(/GRANT /gu) ?? []).length, 1, 'no other grant');
  const statement = reader();
  assert.match(statement, /LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''/u, 'a STABLE pinned definer: it can write nothing');
  assert.match(statement, /v_user uuid := \(SELECT auth\.uid\(\)\);/u, 'the human is auth.uid()');
  assert.deepEqual(statement.match(/p_[a-z_]+ (?:uuid|timestamptz|integer)/gu),
    ['p_world_id uuid', 'p_before_established_at timestamptz', 'p_before_material_id uuid', 'p_limit integer'], 'exactly the client\'s inputs');
  const entitled = statement.indexOf('FROM public.introduction_closed_view_entitlements ent');
  assert.ok(entitled > 0, 'the authority is the frozen closed-view entitlement');
  assert.match(statement, /WHERE ent\.world_id = p_world_id AND ent\.user_id = v_user/u, 'the caller\'s OWN entitlement, never another\'s');
  assert.match(statement, /r\.introduction_status = 'CLOSED' AND w\.lifecycle = 'READ_ONLY_CLOSED' AND w\.phase = 'INTRODUCTION'/u, 'an Introduction END closed');
  for (const later of ["'ENDED'", 'public.resolve_shared_world_material_v1(']) {
    assert.ok(statement.indexOf(later) > entitled, `${later} only after the entitlement answer`);
  }
  assert.match(statement, /public\.resolve_shared_world_material_v1\(p_world_id, v_user\)/u, 'the frozen resolver (over the one entry point) decides visibility');
  assert.match(statement, /m\.material_kind = 'HUMAN_TEXT' AND m\.author_user_id IS NOT NULL AND m\.text_body IS NOT NULL/u, 'human words only');
  assert.doesNotMatch(statement, /membership_episodes|ended_at IS NULL/u, 'no active membership is consulted');
  assert.doesNotMatch(statement, /FOR UPDATE|RAISE;|EXECUTE |40001|PT409/u, 'it locks nothing, re-raises nothing and runs no dynamic SQL');
  assert.doesNotMatch(statement, /qandeel|semantic|analysis|activity|alert|launch_gate|_capability|public\.users|context_grant|personal|memory|push/iu,
    'no reply, weaving, analysis, Activity, Push, gate, account Name, grant or Personal Context (R-1, R-7)');
});

test('3 — the API: two history routes on the existing module, the caller token, the reader once; END and deletion stay the existing routes', () => {
  const controller = code(`${API}/introduction-world.controller.ts`);
  const routes = [...controller.matchAll(/@(Get|Post|Put|Patch|Delete)\('([^']+)'\)/gu)].map((m) => `${m[1]} ${m[2]}`);
  assert.deepEqual(routes, ['Get worlds', 'Get worlds/:worldId/messages', 'Get worlds/:worldId/messages/before/:materialId/:establishedAt',
    'Post worlds/:worldId/messages', 'Get worlds/:worldId/history', 'Get worlds/:worldId/history/before/:materialId/:establishedAt'], 'exactly the six routes');
  assert.doesNotMatch(controller, /delete|\bend\b|Post\('worlds\/:worldId\/(?!messages)/iu, 'no second END or deletion route');
  const repository = code(`${API}/introduction-world.repository.ts`);
  assert.equal((repository.match(/'read_my_introduction_history_v1'/gu) ?? []).length, 1, 'the reader, called once');
  assert.doesNotMatch(repository, /end_own_introduction|delete_own_shared|_core_v1/u, 'the module calls no END or deletion of its own');
  const service = code(`${API}/introduction-world.service.ts`);
  assert.match(service, /row\.introduction_state !== 'ENDED'\)\) return unavailable\(\);/u, 'the history decodes ENDED rows only');
  const census = read('apps/api/src/http-security/route-rate-limit.census.ts');
  for (const [route, rate] of [['GET /introductions/worlds/:worldId/history', 'AUTHENTICATED'],
    ['GET /introductions/worlds/:worldId/history/before/:materialId/:establishedAt', 'AUTHENTICATED'],
    ['POST /introductions/worlds/:worldId/end', 'AUTHENTICATED'],
    ['POST /shared/worlds/:worldId/materials/:materialId/delete', 'AUTHENTICATED']]) {
    assert.ok(census.includes(`'${route}': '${rate}'`), `${route} is ${rate}`);
  }
  assert.equal((census.match(/\/introductions\/[^']*\/end'/gu) ?? []).length, 1, 'exactly one Introduction END route in the whole API');
  const end = code('apps/api/src/introductions-lifecycle/introduction-end.controller.ts');
  assert.deepEqual([...end.matchAll(/@(Get|Post)\('([^']+)'\)/gu)].map((m) => `${m[1]} ${m[2]}`), ['Post worlds/:worldId/end'], 'the S6-02 END, unchanged');
});

// RE-ANCHORED by S6-05 CP5 (2026-10-16): CP4 added no mobile code; CP5, the last checkpoint, wires the Introduction World —
// END and the closed history included — through exactly ONE mobile client (and its test). Nothing else in mobile names the
// routes, and nothing in mobile names a database function.
test('4 — mobile reaches the Introduction World, END and the closed history only through its one CP5 client', () => {
  // The client, its suite, and the validation-only device-proof stand-in (never in the production bundle).
  const S6_05_MOBILE_CLIENT = ['runtime-entry/introduction-worlds-api.ts', 'introductions/__tests__/introduction-world.test.tsx',
    'integration/__validation__/s605-proof-introduction-world.ts'];
  const naming = readdirSync(new URL('apps/mobile/src/', root), { recursive: true }).map((f) => String(f).replace(/\\/gu, '/'))
    .filter((f) => /\.(ts|tsx)$/u.test(f) && /introductions\/worlds/u.test(read(`apps/mobile/src/${f}`)));
  // RE-ANCHORED by S6-06 CP2 (2026-10-17): the S6-06 sharing and continuation clients (and their suite) name the World's
  // disclosure, photo and SUCCESS routes; the messages, END and history routes stay the S6-05 client's alone.
  const S6_06_MOBILE_CLIENTS = ['runtime-entry/introduction-sharing-api.ts', 'runtime-entry/introduction-continuation-api.ts', 'runtime-entry/__tests__/introduction-sharing-api.test.ts'];
  assert.deepEqual(naming.sort(), [...S6_05_MOBILE_CLIENT, ...S6_06_MOBILE_CLIENTS].sort(), 'one client names the routes');
  for (const file of S6_06_MOBILE_CLIENTS) assert.doesNotMatch(read(`apps/mobile/src/${file}`), /\/(?:messages|end|history)\b/u, `${file} names no S6-05 route`);
  for (const file of readdirSync(new URL('apps/mobile/src/', root), { recursive: true }).filter((f) => /\.(ts|tsx)$/u.test(String(f)))) {
    assert.doesNotMatch(read(`apps/mobile/src/${file}`), /_my_introduction_|end_own_introduction/u, `mobile ${file} names no database function`);
  }
  const client = code('apps/mobile/src/runtime-entry/introduction-worlds-api.ts');
  assert.match(client, /\/introductions\/worlds\/\$\{encodeURIComponent\(worldId\)\}\/end`, \{ commandId \}/u, 'END is the S6-02 route with exactly { commandId }');
  assert.match(client, /pagePath\(worldId, 'history', before\)/u, 'the closed history is the CP4 reader');
});

test('5 — the verifier, the wire proof and the contract are wired into the toolchain and API CI', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['verify:introduction-closed-history:integration'], `node --env-file-if-exists=.env ${VERIFIER}`);
  assert.equal(manifest.scripts['prove:introduction-closed-history:postgrest'], `node --env-file-if-exists=.env ${WIRE}`);
  assert.equal(manifest.scripts['test:s6-05-introduction-closed-history-contract'], 'node --test tests/s6-05-introduction-closed-history-contract.test.mjs');
  const workflow = read('.github/workflows/api-ci.yml');
  assert.equal((workflow.match(/npm run verify:introduction-closed-history:integration/gu) ?? []).length, 1);
  assert.ok(workflow.indexOf('npm run verify:introduction-closed-history:integration') > workflow.indexOf('npm run verify:introduction-world-messaging:integration'));
  const wire = workflow.indexOf('npm run --silent prove:introduction-closed-history:postgrest');
  assert.ok(wire > workflow.indexOf('docker run -d --rm --name "postgrest-$version"') && wire < workflow.indexOf('docker stop "postgrest-$version"'),
    'the wire proof runs against every live PostgREST line, inside the loop');
  assert.match(workflow, /run: npm run test:s6-05-introduction-closed-history-contract\}/u);
  for (const file of [VERIFIER, WIRE]) {
    assert.ok(existsSync(new URL(file, root)));
    assert.doesNotMatch(read(file), /supabase\.co|postgres(?:ql)?:\/\/[^'`$]/iu, `${file} embeds no connection detail`);
  }
  const verifier = read(VERIFIER);
  for (const scenario of ['A01 ', 'A02 ', 'A03 ', 'B01 ', 'B02 ', 'B03 ', 'C01 ', 'C02 ', 'C03 ', 'C04 ', 'C05 ', 'C06 ', 'D01 ', 'D02 ',
    'E01 ', 'E02 ', 'G01 ', 'G02 ', 'G03 ', 'G04 ', 'report.assertAllPassed()', 'the run leaves nothing behind']) {
    assert.ok(verifier.includes(scenario), `the 0161 verifier proves ${scenario.trim()}`);
  }
});
