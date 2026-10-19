// S6-05 — Mutual Match & Introduction World, CP3 (Introduction World & Human Messaging): the cross-layer static contract.
//
// It pins what a later change could silently erode: migration 0160 directly follows 0159, is forward-only, replaces and
// alters nothing, and leaves the Shared material authority it composes (0089 / 0090 / 0115 / 0118 / 0119 / 0139 / 0143),
// the Introduction lifecycle (0116), the S6-02 fence (0155) and the CP2 acceptance (0159) byte-identical; it adds exactly
// THREE authenticated boundaries beside the S6-02 fence - discovery, one page of human words, one human text message -
// each deciding membership from the Introduction Record before anything else and answering ENDED to the two humans only;
// the send calls the frozen human text core once under Introduction-only identities, after the World row lock; nothing reaches
// a QANDEEL reply, weaving, Living Analysis, Activity, a launch gate, an account Name, a grant or Personal Context (R-1,
// R-7); the send route is SECURITY_SENSITIVE (R-8) and deletion is the existing owner route (R-5); the API module imports
// no AI; mobile is untouched (CP5); and the proofs are wired into CI. Live behaviour is proven by
// database/verify-migration-0160.mjs (real PostgreSQL) and database/prove-0160-introduction-world-messaging-postgrest.mjs
// (live PostgREST); this file proves structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const sql = (text) => text.replace(/--[^\n]*/gu, '');
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const MIGRATIONS = 'database/migrations';
const MIGRATION = `${MIGRATIONS}/0160_introduction_world_human_messaging_v1.sql`;
const VERIFIER = 'database/verify-migration-0160.mjs';
const WIRE = 'database/prove-0160-introduction-world-messaging-postgrest.mjs';
const API = 'apps/api/src/introductions-world';
const BOUNDARIES = ['list_my_introduction_worlds_v1', 'read_my_introduction_messages_v1', 'send_my_introduction_text_v1'];
const blob = (path) => {
  const bytes = Buffer.from(read(path), 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
/** The authority S6-05 CP3 composes, byte-identical (git blob ids at the CP2 head, f13dc26b). */
const FROZEN = {
  [`${MIGRATIONS}/0089_shared_world_material_persistence_v1.sql`]: '82d6d5f0c293528649198efee2305ca0baa7b685',
  [`${MIGRATIONS}/0090_shared_world_material_commit_owner_deletion_v1.sql`]: 'c65bb170449e98454b4ba248dad3793b6ea363f8',
  [`${MIGRATIONS}/0115_introduction_progressive_disclosure_history_visibility_v1.sql`]: '06d6528e1d03443d53aa040a555a437a458c7cb4',
  [`${MIGRATIONS}/0116_introduction_terminal_lifecycle_v1.sql`]: '93cd217f96c2b3562e94cb1eaead0019097d654f',
  [`${MIGRATIONS}/0118_introduction_ordinary_shared_material_v1.sql`]: '4a5e81de210007f905a2fc6012becdcd90bffa3a',
  [`${MIGRATIONS}/0119_shared_historical_authority_remediation_v1.sql`]: '77f01566a8e1070fd038cefc52e70d3fe5ef7bba',
  [`${MIGRATIONS}/0139_shared_world_conversation_material_v1.sql`]: '32a08f4f880766b56728b7cc4040bb26082e6e74',
  [`${MIGRATIONS}/0143_public_authoring_rights_privacy_v1.sql`]: 'a619bbc965ce266756e115c59c2e5152840934d0',
  [`${MIGRATIONS}/0155_introduction_privacy_isolation_end_boundary_v1.sql`]: 'be25d95ba8eb8f17d883d7b442089d03bf3f2d38',
  [`${MIGRATIONS}/0159_matching_mutual_match_acceptance_v1.sql`]: '743ae60baf8f1759e191d113c8e9b9108cd43bfe',
};
/** `FUNCTION public.<name>(` ... through its closing dollar tag, comments removed. */
function statementOf(name) {
  const text = read(MIGRATION);
  const start = text.indexOf(`FUNCTION public.${name}(`);
  assert.ok(start >= 0, `0160 defines ${name}`);
  const tag = /AS (\$[A-Za-z_]*\$)/u.exec(text.slice(start));
  const open = start + tag.index + tag[0].length;
  return sql(text.slice(start, text.indexOf(tag[1], open) + tag[1].length));
}

test('1 — 0160 directly follows 0159, is forward-only, creates exactly three functions and leaves the composed authority byte-identical', () => {
  const files = readdirSync(new URL(`${MIGRATIONS}/`, root)).filter((f) => /^\d{4}_.*\.sql$/u.test(f)).sort();
  assert.equal(files.filter((f) => f.startsWith('0160_')).length, 1, 'exactly one 0160');
  assert.equal(files[files.indexOf('0160_introduction_world_human_messaging_v1.sql') - 1], '0159_matching_mutual_match_acceptance_v1.sql');
  for (const [file, id] of Object.entries(FROZEN)) assert.equal(blob(file), id, `${file} is byte-identical`);
  const body = sql(read(MIGRATION));
  assert.deepEqual([...body.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z_.0-9]+)\(/gu)].map((m) => m[1]).sort(), BOUNDARIES.map((n) => `public.${n}`).sort());
  assert.doesNotMatch(body, /CREATE OR REPLACE|ALTER TABLE|CREATE TABLE|DROP |CREATE TRIGGER|CREATE POLICY|CREATE INDEX|INSERT INTO|UPDATE public|DELETE FROM/u,
    'nothing existing is replaced, altered or written');
  assert.match(body, /^BEGIN;/mu);
  assert.match(body, /^COMMIT;\s*$/mu);
});

test('2 — three authenticated-only boundaries; the human is auth.uid(); membership from the Introduction Record before anything else', () => {
  const body = sql(read(MIGRATION));
  assert.match(body, /GRANT EXECUTE ON FUNCTION\s+public\.list_my_introduction_worlds_v1\(\),\s+public\.read_my_introduction_messages_v1\(uuid, timestamptz, uuid, integer\),\s+public\.send_my_introduction_text_v1\(uuid, uuid, text\)\s+TO authenticated;/u);
  assert.equal((body.match(/GRANT /gu) ?? []).length, 1, 'no other grant');
  for (const name of BOUNDARIES) {
    const statement = statementOf(name);
    assert.match(statement, /SECURITY DEFINER SET search_path = ''/u, `${name} is a pinned definer`);
    assert.match(statement, /v_user uuid := \(SELECT auth\.uid\(\)\);/u, `${name} derives the human`);
    const member = statement.indexOf('v_user IN (r.lower_user_id, r.higher_user_id)');
    assert.ok(member > 0, `${name} decides membership from the Introduction Record`);
    // The listing is one query filtered by that predicate; the read and the send decide it procedurally, first.
    if (name === 'list_my_introduction_worlds_v1') {
      assert.match(statement, /WHERE v_user IN \(r\.lower_user_id, r\.higher_user_id\)/u, 'only the caller\'s own Records are listed');
      continue;
    }
    for (const later of ["'ENDED'", 'FOR UPDATE', 'resolve_shared_world_material_v1(', 'commit_shared_world_human_text_v1(']) {
      const at = statement.indexOf(later);
      assert.ok(at < 0 || at > member, `${name}: ${later} only after the membership answer (ENDED to the two humans only)`);
    }
  }
  assert.deepEqual(statementOf('read_my_introduction_messages_v1').match(/p_[a-z_]+ (?:uuid|timestamptz|integer|text)/gu),
    ['p_world_id uuid', 'p_before_established_at timestamptz', 'p_before_material_id uuid', 'p_limit integer']);
  assert.deepEqual(statementOf('send_my_introduction_text_v1').match(/p_[a-z_]+ (?:uuid|text)/gu), ['p_command_id uuid', 'p_world_id uuid', 'p_content text']);
});

test('3 — the send: the World row first, then the frozen human text core exactly once, under Introduction-only identities', () => {
  const send = statementOf('send_my_introduction_text_v1');
  assert.equal((send.match(/public\.commit_shared_world_human_text_v1\(/gu) ?? []).length, 1);
  assert.ok(send.indexOf('FOR UPDATE') < send.indexOf('public.commit_shared_world_human_text_v1('), 'the World row lock comes first');
  assert.match(send, /FROM public\.shared_worlds w WHERE w\.id = p_world_id FOR UPDATE/u, 'the same first lock END and SUCCESS take');
  // Introduction-only namespaces: the same command id replayed through the Stage 4 send (which starts a reply, weaving
  // and Activity on COMMITTED) is that core's command conflict, never a Stage 4 message.
  for (const namespace of ['INTRODUCTION_HUMAN_TEXT_MATERIAL', 'INTRODUCTION_HUMAN_TEXT_HISTORY_ITEM']) {
    assert.ok(send.includes(`shared_private.derive_shared_conversation_identity_v1('${namespace}', p_command_id)`), `the Introduction-only ${namespace} derivation`);
  }
  assert.doesNotMatch(send, /derive_shared_conversation_identity_v1\('HUMAN_TEXT_/u, 'never the Stage 4 namespaces');
  assert.ok(send.indexOf("v_phase IS DISTINCT FROM 'INTRODUCTION'") < send.indexOf('FOR UPDATE'), 'a World no longer an Introduction is answered without its lock');
  assert.match(send, /length\(p_content\) > 20000/u, 'the Stage 4 bound');
  assert.match(send, /IF SQLERRM = 'SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT' THEN/u, 'only the core\'s own command conflict is COMMAND_CONFLICT');
  for (const outcome of ['COMMITTED', 'ENDED', 'UNAVAILABLE', 'COMMAND_CONFLICT']) assert.ok(send.includes(`'${outcome}'::text`), outcome);
  assert.doesNotMatch(send, /40001|PT409|serialization_failure|RAISE;|EXECUTE /u, 'nothing to absorb, nothing re-raised, no dynamic SQL');
  const read = statementOf('read_my_introduction_messages_v1');
  assert.match(read, /public\.resolve_shared_world_material_v1\(p_world_id, v_user\)/u, 'the frozen resolver decides visibility');
  assert.match(read, /m\.material_kind = 'HUMAN_TEXT' AND m\.author_user_id IS NOT NULL AND m\.text_body IS NOT NULL/u, 'human words only');
  assert.match(statementOf('list_my_introduction_worlds_v1'), /shared_private\.shared_person_name_v1\(/u, 'the S6-02 name projection');
});

test('4 — human words only: no reply, weaving, analysis, Activity, gate, account Name, grant or Personal Context anywhere (R-1, R-7)', () => {
  for (const name of BOUNDARIES) {
    assert.doesNotMatch(statementOf(name), /qandeel|semantic|analysis|activity|alert|launch_gate|_capability|public\.users|context_grant|personal|memory/iu, name);
  }
  for (const file of readdirSync(new URL(`${API}/`, root)).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))) {
    const text = code(`${API}/${file}`);
    for (const target of [...text.matchAll(/from '([^']+)'/gu)].map((m) => m[1])) {
      assert.ok(target.startsWith('./') || ['@nestjs/common', '../auth/authenticated-request', '../auth/supabase-auth.guard',
        '../auth/supabase-auth.service', '../conversation/supabase-data-api.service'].includes(target), `${file} imports ${target}`);
    }
    assert.doesNotMatch(text, /router|qandeel|reply|semantic|weave|analysis|activity|push|notification|memory|personal|grant|service[-_]role|shared-world/iu, file);
    assert.doesNotMatch(text, /console\.|Logger|retry|setTimeout/u, `${file} logs nothing and never retries`);
  }
});

test('5 — the API: four routes, the caller token, SECURITY_SENSITIVE send (R-8), owner deletion reused (R-5), composed once', () => {
  const controller = code(`${API}/introduction-world.controller.ts`);
  // CP4 (2026-10-16) adds the two closed-history reads after these four; tests/s6-05-introduction-closed-history-contract pins them.
  assert.deepEqual([...controller.matchAll(/@(Get|Post|Put|Patch|Delete)\('([^']+)'\)/gu)].map((m) => `${m[1]} ${m[2]}`).slice(0, 4), [
    'Get worlds', 'Get worlds/:worldId/messages', 'Get worlds/:worldId/messages/before/:materialId/:establishedAt', 'Post worlds/:worldId/messages',
  ]);
  assert.match(controller, /@Controller\('introductions'\)/u);
  assert.match(controller, /@UseGuards\(SupabaseAuthGuard\)/u);
  const repository = code(`${API}/introduction-world.repository.ts`);
  // CP4 (2026-10-16) adds the one 0161 reader beside the three 0160 boundaries.
  assert.deepEqual([...repository.matchAll(/'(list_my_introduction_worlds_v1|read_my_introduction_messages_v1|send_my_introduction_text_v1|[a-z_]+_v1)'/gu)].map((m) => m[1]),
    [...BOUNDARIES.slice(0, 2), 'read_my_introduction_history_v1', BOUNDARIES[2]]);
  const census = read('apps/api/src/http-security/route-rate-limit.census.ts');
  for (const [route, rate] of [['GET /introductions/worlds', 'AUTHENTICATED'], ['GET /introductions/worlds/:worldId/messages', 'AUTHENTICATED'],
    ['GET /introductions/worlds/:worldId/messages/before/:materialId/:establishedAt', 'AUTHENTICATED'],
    ['POST /introductions/worlds/:worldId/messages', 'SECURITY_SENSITIVE'],
    ['POST /shared/worlds/:worldId/materials/:materialId/delete', 'AUTHENTICATED']]) {
    assert.ok(census.includes(`'${route}': '${rate}'`), `${route} is ${rate}`);
  }
  assert.doesNotMatch(controller, /delete/iu, 'no second deletion route: the existing owner deletion is reused');
  const account = read('apps/api/src/account/account.module.ts');
  assert.equal((account.match(/IntroductionsWorldModule/gu) ?? []).length, 3, 'imported, documented and composed once');
  // RE-ANCHORED by S6-06 (2026-10-16, CP1): its two modules are composed after this one.
  // RE-ANCHORED by S6-07 CP1 (2026-10-18): the governed enrollment module is composed after the S6-06 modules.
  // RE-ANCHORED by S6-07 CP2 (2026-10-18): the forward dispatcher's server pass is composed after it.
  // RE-ANCHORED by S7-01 (2026-10-19): the Personal Replay module (migration 0169) is composed after it, on its own line.
  assert.match(account, /imports: \[ObservabilityModule, IntroductionsPreparationModule, IntroductionsLifecycleModule, IntroductionsProposalsModule, IntroductionsWorldModule,\n {4}IntroductionsDisclosureModule, IntroductionsContinuationModule, IntroductionsEnrollmentModule, IntroductionsDispatchModule,\n {4}ReplayModule\]/u);
  // The Stage 4 send keeps its Activity, and only it: the Introduction module calls no producer (R-7).
  assert.equal((read('apps/api/src/shared-world/shared-world.controller.ts').match(/this\.activity\.humanText\(/gu) ?? []).length, 1);
});

// RE-ANCHORED by S6-05 CP5 (2026-10-16): CP3 added no mobile code; CP5 wires the Introduction World through exactly ONE
// mobile client (and its test); nothing else in mobile names the routes or any database function.
test('6 — mobile reaches the Introduction World only through its one CP5 client', () => {
  // The client, its suite, and the validation-only device-proof stand-in (never in the production bundle).
  const S6_05_MOBILE_CLIENT = ['runtime-entry/introduction-worlds-api.ts', 'introductions/__tests__/introduction-world.test.tsx',
    'integration/__validation__/s605-proof-introduction-world.ts'];
  const naming = readdirSync(new URL('apps/mobile/src/', root), { recursive: true }).map((f) => String(f).replace(/\\/gu, '/'))
    .filter((f) => /\.(ts|tsx)$/u.test(f) && /introductions\/worlds/u.test(read(`apps/mobile/src/${f}`)));
  // RE-ANCHORED by S6-06 CP2 (2026-10-17): the S6-06 sharing and continuation clients (and their suite) name the World's
  // disclosure, photo and SUCCESS routes; the messages, END and history routes stay the S6-05 client's alone.
  const S6_06_MOBILE_CLIENTS = ['runtime-entry/introduction-sharing-api.ts', 'runtime-entry/introduction-continuation-api.ts', 'runtime-entry/__tests__/introduction-sharing-api.test.ts'];
  // RE-ANCHORED by S6-07 CP3 (2026-10-18): the per-Introduction alerts client names only `/introductions/worlds/:id/alerts`,
  // and the CP3 integration test answers the Introduction World reads as the API does; neither wires a message, END or history.
  const S6_07_MOBILE_CLIENTS = ['runtime-entry/introduction-alerts-api.ts', 'integration/__tests__/s6-07-introductions-direct-entry.test.tsx'];
  for (const file of S6_07_MOBILE_CLIENTS) assert.doesNotMatch(read(`apps/mobile/src/${file}`), /\/end\b|\/history|method: 'POST'/u, `${file} wires no message, END or history`);
  assert.deepEqual(naming.sort(), [...S6_05_MOBILE_CLIENT, ...S6_06_MOBILE_CLIENTS, ...S6_07_MOBILE_CLIENTS].sort(), 'one client names the routes');
  for (const file of S6_06_MOBILE_CLIENTS) assert.doesNotMatch(read(`apps/mobile/src/${file}`), /\/(?:messages|end|history)\b/u, `${file} names no S6-05 route`);
  for (const file of readdirSync(new URL('apps/mobile/src/', root), { recursive: true }).filter((f) => /\.(ts|tsx)$/u.test(String(f)))) {
    assert.doesNotMatch(read(`apps/mobile/src/${file}`), /_my_introduction_/u, `mobile ${file} names no database function`);
  }
});

test('7 — the verifier, the wire proof and the contract are wired into the toolchain and API CI', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['verify:introduction-world-messaging:integration'], `node --env-file-if-exists=.env ${VERIFIER}`);
  assert.equal(manifest.scripts['prove:introduction-world-messaging:postgrest'], `node --env-file-if-exists=.env ${WIRE}`);
  assert.equal(manifest.scripts['test:s6-05-introduction-world-messaging-contract'], 'node --test tests/s6-05-introduction-world-messaging-contract.test.mjs');
  const workflow = read('.github/workflows/api-ci.yml');
  assert.equal((workflow.match(/npm run verify:introduction-world-messaging:integration/gu) ?? []).length, 1);
  assert.ok(workflow.indexOf('npm run verify:introduction-world-messaging:integration') > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'));
  const wire = workflow.indexOf('npm run --silent prove:introduction-world-messaging:postgrest');
  assert.ok(wire > workflow.indexOf('docker run -d --rm --name "postgrest-$version"') && wire < workflow.indexOf('docker stop "postgrest-$version"'),
    'the wire proof runs against every live PostgREST line, inside the loop');
  assert.match(workflow, /run: npm run test:s6-05-introduction-world-messaging-contract\}/u);
  for (const file of [VERIFIER, WIRE]) {
    assert.ok(existsSync(new URL(file, root)));
    assert.doesNotMatch(read(file), /supabase\.co|postgres(?:ql)?:\/\/[^'`$]/iu, `${file} embeds no connection detail`);
  }
  const verifier = read(VERIFIER);
  for (const scenario of ['A01 ', 'A02 ', 'A03 ', 'B01 ', 'B02 ', 'C01 ', 'C02 ', 'C03 ', 'D01 ', 'D02 ', 'D03 ', 'D04 ', 'E01 ', 'E02 ', 'E03 ',
    'G01 ', 'G02 ', 'G03 ', 'G04 ', 'report.assertAllPassed()', 'the run leaves nothing behind']) {
    assert.ok(verifier.includes(scenario), `the 0160 verifier proves ${scenario.trim()}`);
  }
});
