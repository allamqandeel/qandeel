// S6-02 — Introduction-Phase Privacy Isolation & Safe END Boundary: the cross-layer static contract.
//
// It pins what a later change could silently erode: migration 0155 is forward-only and leaves the frozen I-04 / I-07
// runtime byte-identical; every Shared Product name projection goes through the ONE recipient-scoped projection, which
// never reads the account Name for a Matching-born World; Stage 4 reads, sends and QANDEEL reply work refuse an
// Introduction-phase World; the three membership boundaries refuse ADD / REJOIN for a Matching-born World; Replay and S5-02
// Public authoring filter Introduction-era material without a new resolver caller or a Replay column; the ONE END
// boundary is authenticated-only and ungated and is the ONE named exception of the 0149 NO_BACKDOOR census; the API route
// takes the World and a command id only; and nothing is wired to mobile. Live behaviour is proven by
// database/verify-migration-0155.mjs (real PostgreSQL) and database/prove-0155-introduction-end-postgrest.mjs (live
// PostgREST); this file proves structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const sql = (text) => text.replace(/--[^\n]*/gu, '');
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const MIGRATIONS = 'database/migrations';
const MIGRATION = `${MIGRATIONS}/0155_introduction_privacy_isolation_end_boundary_v1.sql`;
const VERIFIER = 'database/verify-migration-0155.mjs';
const WIRE = 'database/prove-0155-introduction-end-postgrest.mjs';
const API = 'apps/api/src/introductions-lifecycle';
const blob = (path) => {
  const bytes = Buffer.from(read(path), 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
/** The frozen authority S6-02 composes, byte-identical (git blob ids at the S6-02 base, main 2224c47f). */
const FROZEN = {
  '0075_connected_worlds_shared_persistence_foundation_v1.sql': '3119d34a4edd4c934067393eb278077fd294852b',
  '0108_matching_participation_private_setup_foundation_v1.sql': '88845e0290809d1fd9949db1a5ebf3973bacdbb3',
  '0109_matching_setup_human_authority_commands_v1.sql': '030de6db8d7982a4503cc2200927511f1c212e60',
  '0113_matching_mutual_match_introduction_persistence_v1.sql': '56fdb8f961047cf2848deda2f991cf436897ccb7',
  '0114_matching_mutual_match_commit_transaction_v1.sql': 'c1f45248f37a0f0f30cc62ac1ccb4e1397797632',
  '0116_introduction_terminal_lifecycle_v1.sql': '93cd217f96c2b3562e94cb1eaead0019097d654f',
  '0118_introduction_ordinary_shared_material_v1.sql': '4a5e81de210007f905a2fc6012becdcd90bffa3a',
  '0119_shared_historical_authority_remediation_v1.sql': '77f01566a8e1070fd038cefc52e70d3fe5ef7bba',
  '0149_matching_setup_pre_launch_direct_execute_narrowing_v1.sql': 'bf15ade251615caa54c6ba754e0c684c2ec79d6a',
  '0154_matching_onboarding_preparation_v1.sql': '200a83842a10242e69c0bf56ac8d007f1e3789b6',
};
/** `CREATE OR REPLACE FUNCTION <name>(` ... through its closing dollar tag, from the 0155 text. */
function statementOf(text, name) {
  const start = text.indexOf(`FUNCTION ${name}(`);
  assert.ok(start >= 0, `0155 defines ${name}`);
  const tag = /AS (\$[A-Za-z_]*\$)/u.exec(text.slice(start));
  const open = start + tag.index + tag[0].length;
  return text.slice(start, text.indexOf(tag[1], open) + tag[1].length);
}

test('1 — 0155 directly follows 0154, is forward-only and leaves the frozen authority byte-identical', () => {
  const files = readdirSync(new URL(`${MIGRATIONS}/`, root)).filter((f) => /^\d{4}_.*\.sql$/u.test(f)).sort();
  assert.equal(files.filter((f) => f.startsWith('0155_')).length, 1, 'exactly one 0155');
  assert.equal(files[files.indexOf('0155_introduction_privacy_isolation_end_boundary_v1.sql') - 1], '0154_matching_onboarding_preparation_v1.sql');
  for (const [file, id] of Object.entries(FROZEN)) assert.equal(blob(`${MIGRATIONS}/${file}`), id, `${file} is byte-identical`);
  const body = sql(read(MIGRATION));
  assert.match(body, /^BEGIN;$/mu); assert.match(body, /^COMMIT;$/mu);
  assert.doesNotMatch(body, /\b(ALTER|CREATE|DROP) TABLE\b|\bDROP FUNCTION\b|\bALTER DEFAULT PRIVILEGES\b|\bON ALL FUNCTIONS\b/u,
    'no relation is created, altered or dropped (no Replay phase / birth_basis column), nothing is dropped or blanket-granted');
  for (const frozen of ['commit_introduction_end_v1', 'commit_introduction_success_v1', 'commit_shared_world_human_material_v1',
    'commit_shared_world_qandeel_material_v1', 'resolve_shared_world_history_visibility_v1', 'resolve_shared_world_material_v1',
    'delete_shared_world_owned_material_v1', 'resolve_matching_canonical_first_name_v1', 'commit_shared_world_direct_acceptance_birth_v1']) {
    assert.doesNotMatch(body, new RegExp(String.raw`FUNCTION public\.${frozen}\(`, 'u'), `0155 does not redefine the frozen ${frozen}`);
  }
  assert.deepEqual([...body.matchAll(/^\s*GRANT [^;]+;/gmu)].map((m) => m[0].trim()),
    ['GRANT EXECUTE ON FUNCTION public.end_own_introduction_v1(uuid, uuid) TO authenticated;'], 'the one grant 0155 makes');
});

test('2 — the ONE name projection: account Name only for an ACCEPTED_INVITATION World, the handoff first name or NULL otherwise', () => {
  const text = read(MIGRATION);
  const projection = sql(statementOf(text, 'shared_private.shared_person_name_v1'));
  const [ordinary, matching] = projection.split(/\bELSE\b/u);
  assert.match(ordinary, /WHEN w\.birth_basis = 'ACCEPTED_INVITATION' THEN\s+\(SELECT u\.name FROM public\.users u WHERE u\.id = p_subject_user_id\)/u);
  assert.doesNotMatch(matching, /public\.users|\.name\b(?!_)/u, 'a Matching-born World never reads the account Name - not even as a fallback');
  assert.doesNotMatch(projection, /introductions_preparation_private|declared_facts|first_name_state/u, 'never the 0154 draft');
  assert.doesNotMatch(projection, /introduction_disclosure|FULL_NAME/u, 'never a FULL_NAME disclosure: disclosure is not a display consent');
  for (const binding of ['shared_world_matching_birth_events b', 'matching_match_commits c', 'matching_match_handoff_package_versions pv',
    'matching_match_handoff_subjects hs', 'hs.presented_to_user_id = p_viewer_user_id', 'hs.subject_user_id = p_subject_user_id',
    'r.lower_user_id = p_subject_user_id AND r.higher_user_id = p_viewer_user_id']) {
    assert.ok(projection.includes(binding), `the projection proves ${binding}`);
  }
  // Every account-Name projection of the Stage 4 / SHARED-VIS-01 / S5-02 / Activity reads 0155 redefines goes through it.
  const redefined = [...text.matchAll(/^CREATE OR REPLACE FUNCTION ([a-z_]+\.[a-z0-9_]+)\(/gmu)].map((m) => m[1]);
  for (const fn of redefined) {
    const statement = sql(statementOf(text, fn));
    for (const alias of [...statement.matchAll(/public\.users\s+([a-z_]+)/gu)].map((m) => m[1])) {
      assert.doesNotMatch(statement, new RegExp(String.raw`\b${alias}\.name\b`, 'u'), `${fn} projects no ${alias}.name`);
    }
  }
  for (const fn of ['shared_private.list_own_shared_world_members_v1', 'shared_private.list_own_shared_world_material_v1',
    'shared_private.list_own_shared_world_member_handles_v1', 'shared_private.list_own_shared_world_proposals_v1',
    'shared_private.list_own_shared_history_share_candidates_v1', 'shared_private.list_own_shared_history_share_requests_v1',
    'shared_private.list_own_closed_shared_world_members_v1', 'shared_private.list_own_closed_shared_world_material_v1',
    'shared_private.list_own_shared_membership_requests_v1', 'public.server_read_shared_activity_source_v1',
    'shared_semantic_private.list_own_shared_semantic_place_sources_v1', 'shared_semantic_private.list_own_closed_shared_world_material_v2',
    'public_authoring_private.list_own_public_authoring_sources_v1']) {
    assert.match(statementOf(text, fn), /shared_private\.shared_person_name_v1\(/u, `${fn} uses the projection`);
  }
});

test('3 — D4: Stage 4 reads, sends and QANDEEL reply work refuse an Introduction-phase World; deletion and the 0118 cores stay', () => {
  const text = read(MIGRATION);
  for (const fn of ['shared_private.list_own_shared_worlds_v1', 'shared_private.list_own_shared_world_members_v1',
    'shared_private.resolve_own_shared_world_entry_v1', 'shared_private.list_own_shared_world_material_v1',
    'shared_private.begin_shared_qandeel_reply_work_v1', 'shared_private.list_own_shared_world_alerts_v1',
    'shared_private.set_own_shared_world_alerts_v1', 'shared_semantic_private.is_current_member_v1']) {
    assert.match(sql(statementOf(text, fn)), /w\.lifecycle = 'ACTIVE' AND w\.phase = 'STANDARD'/u, `${fn} reads only a Standard World`);
  }
  for (const fn of ['shared_private.send_shared_world_human_text_v1', 'shared_private.complete_shared_world_qandeel_reply_v1']) {
    assert.match(sql(statementOf(text, fn)), /IF NOT EXISTS \(SELECT 1 FROM public\.shared_worlds w WHERE w\.id = p_world_id AND w\.phase = 'STANDARD'\) THEN/u,
      `${fn} refuses an Introduction-phase World before the Introduction-capable 0118 core`);
  }
  const activity = sql(statementOf(text, 'public.server_read_shared_activity_source_v1'));
  assert.equal((activity.match(/w\.lifecycle = 'ACTIVE' AND w\.phase = 'STANDARD'/gu) ?? []).length, 4, 'every Activity source branch is Standard-only');
  assert.doesNotMatch(sql(text), /FUNCTION shared_private\.delete_own_shared_world_material_v1\(/u, 'the owner\'s deletion right is untouched');
});

test('4 — A1 / D3: the three membership boundaries refuse ADD and REJOIN for a Matching-born World', () => {
  const text = read(MIGRATION);
  const guard = /IF (?:v_kind IN \('ADD_MEMBER', 'REJOIN_MEMBER'\)\s+AND )?NOT EXISTS \(SELECT 1 FROM public\.shared_worlds w WHERE w\.id = p_world_id AND w\.birth_basis = 'ACCEPTED_INVITATION'\) THEN\s+RETURN QUERY SELECT 'UNAVAILABLE'::text;/u;
  for (const fn of ['shared_private.propose_shared_world_member_v1', 'shared_private.approve_shared_world_proposal_v1',
    'shared_private.accept_shared_membership_request_v1']) {
    const statement = sql(statementOf(text, fn));
    assert.match(statement, guard, `${fn} refuses a Matching-born World`);
    const lock = statement.search(/FROM public\.shared_worlds w WHERE w\.id = p_world_id FOR UPDATE/u);
    assert.ok(lock >= 0 && lock < statement.search(guard), `${fn} decides it under the World row lock`);
  }
  assert.doesNotMatch(sql(text), /FUNCTION shared_private\.leave_shared_world_v1\(|FUNCTION shared_private\.propose_shared_world_end_v1\(/u,
    'leaving and the Standard end are unchanged');
});

test('5 — GATE-35 / D5: Replay and Public authoring filter Introduction-era material without a new resolver caller', () => {
  const text = read(MIGRATION);
  const era = sql(statementOf(text, 'shared_private.is_introduction_era_history_item_v1'));
  assert.match(era, /i\.occurred_at > ce\.occurred_at/u, 'an item AT the SUCCESS instant stays Introduction-era');
  assert.match(era, /coalesce\(\([\s\S]*\), true\)/u, 'unknown is Introduction-era (fail-closed)');
  assert.match(era, /t\.terminal_outcome = 'COMPLETED'/u); assert.match(era, /r\.introduction_status = 'COMPLETED'/u);
  for (const fn of ['shared_private.shared_person_name_v1', 'shared_private.is_introduction_era_history_item_v1',
    'shared_private.without_introduction_era_history_v1', 'public.end_own_introduction_v1']) {
    assert.doesNotMatch(statementOf(text, fn), /resolve_shared_world_history_visibility_v1/u, `${fn} adds no caller of the 0119 resolver`);
  }
  for (const fn of ['public.replay_capture_source_manifest_v1', 'public.derive_replay_source_manifest_currency_v1']) {
    const statement = statementOf(text, fn);
    assert.match(statement, /visible := shared_private\.without_introduction_era_history_v1\(/u, `${fn} filters its visible set`);
    assert.ok(statement.indexOf('without_introduction_era_history_v1') > statement.indexOf('resolve_shared_world_history_visibility_v1'),
      `${fn} filters what the frozen resolver answered`);
  }
  assert.match(statementOf(text, 'public_authoring_private.list_own_public_authoring_sources_v1'),
    /AND NOT shared_private\.is_introduction_era_history_item_v1\(v_world, m\.history_item_id\)/u);
  assert.match(statementOf(text, 'public_authoring_private.prepare_own_public_experience_package_v1'),
    /is_introduction_era_history_item_v1\(sm\.world_id, sm\.history_item_id\)\) THEN\s+RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE'/u);
});

test('6 — D1: the ONE END boundary, ungated, and the ONE named exception of the 0149 NO_BACKDOOR census', () => {
  const end = statementOf(read(MIGRATION), 'public.end_own_introduction_v1');
  assert.match(end, /^FUNCTION public\.end_own_introduction_v1\(p_command_id uuid, p_world_id uuid\)\nRETURNS TABLE\(outcome text\)/u);
  const body = sql(end);
  assert.equal((body.match(/public\.commit_introduction_end_v1\(/gu) ?? []).length, 1);
  assert.doesNotMatch(body, /launch_gate|prerequisites|CLEARED|INSERT|UPDATE|DELETE|activate_matching|resume_matching|grant_matching|set_introduction_profile|set_matching_requirements|grant_pre_match/u);
  assert.match(body, /QANDEEL_S6_02_INTRODUCTION_END_PARTICIPATION_EVENT_V1' \|\| E'\\n' \|\| 'LOWER'/u);
  assert.match(body, /QANDEEL_S6_02_INTRODUCTION_END_PARTICIPATION_EVENT_V1' \|\| E'\\n' \|\| 'HIGHER'/u);
  assert.match(read(MIGRATION), /REVOKE ALL ON FUNCTION public\.end_own_introduction_v1\(uuid, uuid\) FROM PUBLIC;/u);
  const verifier = read('database/verify-migration-0149.mjs');
  assert.match(verifier, /const S6_02_INTRODUCTION_END = 'public\.end_own_introduction_v1\(uuid, uuid\)';/u);
  // S6-04 (2026-10-15) appends its three named decision boundaries after the END exception, and S6-05 (2026-10-16,
  // migration 0159) its one acceptance boundary after them; the END exception itself is unchanged and still named
  // exactly once in the census. S6-06 (2026-10-16, migration 0163) appends its two continuation boundaries after them.
  // RE-ANCHORED by S6-07 CP1 (2026-10-18, migration 0165, Controlled Amendment CA-01-impl): the ONE governed enrollment
  // boundary is appended after the S6-06 continuation boundaries in the 0149 census and after their absorbers in the 0150
  // ABSORBED list; everything pinned before it is unchanged.
  assert.match(verifier, /\[\.\.\.retainedWriters, nameOf\(S6_02_INTRODUCTION_END\), \.\.\.S6_04_PROPOSAL_DECISIONS\.map\(nameOf\), nameOf\(S6_05_MUTUAL_MATCH_ACCEPT\),\n {6}\.\.\.S6_06_INTRODUCTION_CONTINUATION\.map\(nameOf\), nameOf\(S6_07_GOVERNED_ENROLLMENT\)\]\.sort\(\)/u, 'the census admits exactly the retained four, the one END boundary, the three named S6-04 decisions, the one S6-05 acceptance, the two S6-06 continuation boundaries and the one S6-07 enrollment boundary');
  assert.equal((verifier.match(/S6_02_INTRODUCTION_END/gu) ?? []).length, 7, 'the exception is named, not generalized');
  for (const probe of ['f4 the census refuses a second client-executable wrapper around the END core',
    'f5 the census refuses the END boundary granted beyond authenticated']) assert.ok(verifier.includes(probe), probe);
  assert.match(read('database/matching-setup-verifier-support.mjs'),
    /export const SEC_MATCH_00_RETAINED = \[MFN\.PAUSE, MFN\.TURN_OFF, MFN\.REVOKE_CONTEXT, MFN\.REVOKE_DISCLOSURE, MFN\.SETUP\];/u, 'the retained set is unchanged');
});

// RE-ANCHORED by S6-05 CP5 (2026-10-16): the END reaches mobile through S6-05's one Introduction World client (and its
// test); nothing else in mobile names the route, and nothing in mobile names the database function.
test('7 — the API route takes the World and one command id, is an exit right, and logs and retries nothing; mobile reaches it through one S6-05 client', () => {
  const controller = code(`${API}/introduction-end.controller.ts`);
  assert.match(controller, /@Controller\('introductions'\)/u);
  assert.match(controller, /@Post\('worlds\/:worldId\/end'\)/u);
  assert.deepEqual([...controller.matchAll(/@Param\('([^']+)'\)/gu)].map((m) => m[1]), ['worldId'], 'no route takes an identity');
  assert.match(controller, /@UseGuards\(SupabaseAuthGuard\)/u);
  const service = code(`${API}/introduction-end.service.ts`);
  assert.match(service, /key !== 'commandId'/u, 'the body is exactly { commandId }');
  assert.doesNotMatch(service, /retry|setTimeout|for \(|while \(/u, 'one call, never retried');
  const repository = code(`${API}/introduction-end.repository.ts`);
  assert.match(repository, /'rpc\/end_own_introduction_v1'/u);
  assert.match(repository, /\{ p_command_id: commandId, p_world_id: worldId \}/u);
  assert.doesNotMatch(repository, /ServiceRole|service_role/u, 'the caller\'s own token');
  assert.match(read('apps/api/src/http-security/route-rate-limit.census.ts'), /'POST \/introductions\/worlds\/:worldId\/end': 'AUTHENTICATED'/u);
  // S6-04 (2026-10-15) appends its own proposal module, and S6-05 (2026-10-16, CP3) its Introduction World module after
  // it, and S6-06 (2026-10-16, CP1) its two modules after that; the S6-02 module stays composed here, exactly once.
  // RE-ANCHORED by S6-07 CP1 (2026-10-18): the governed enrollment module is composed after the S6-06 modules.
  assert.match(read('apps/api/src/account/account.module.ts'), /imports: \[ObservabilityModule, IntroductionsPreparationModule, IntroductionsLifecycleModule, IntroductionsProposalsModule, IntroductionsWorldModule,\n {4}IntroductionsDisclosureModule, IntroductionsContinuationModule, IntroductionsEnrollmentModule\]/u);
  const mobile = (dir) => readdirSync(new URL(dir, root), { recursive: true }).filter((f) => /\.(ts|tsx)$/u.test(String(f)));
  const client = ['runtime-entry/introduction-worlds-api.ts', 'introductions/__tests__/introduction-world.test.tsx',
    'integration/__validation__/s605-proof-introduction-world.ts'];
  // RE-ANCHORED by S6-06 CP2 (2026-10-17): the S6-06 sharing and continuation clients (and their suite) name the
  // Introduction World routes for disclosure, photos and SUCCESS — and never the END, which stays the S6-05 client's.
  const sharing = ['runtime-entry/introduction-sharing-api.ts', 'runtime-entry/introduction-continuation-api.ts', 'runtime-entry/__tests__/introduction-sharing-api.test.ts'];
  for (const file of sharing) assert.doesNotMatch(read(`apps/mobile/src/${file}`), /\/end\b|end_own_introduction/u, `mobile ${file} wires no END`);
  for (const file of mobile('apps/mobile/src/').map((f) => String(f).replace(/\\/gu, '/'))) {
    assert.doesNotMatch(read(`apps/mobile/src/${file}`), /end_own_introduction/u, `mobile ${file} names no database function`);
    if (!client.includes(file) && !sharing.includes(file)) assert.doesNotMatch(read(`apps/mobile/src/${file}`), /introductions\/worlds\//u, `mobile ${file} wires no END outside the S6-05 client`);
  }
});

test('8 — the verifier, the wire proof and the contract are wired into the toolchain and API CI', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['verify:introduction-privacy-end-boundary:integration'], `node --env-file-if-exists=.env ${VERIFIER}`);
  assert.equal(manifest.scripts['prove:introduction-end:postgrest'], `node --env-file-if-exists=.env ${WIRE}`);
  assert.equal(manifest.scripts['test:s6-02-introduction-privacy-end-boundary-contract'], 'node --test tests/s6-02-introduction-privacy-end-boundary-contract.test.mjs');
  const workflow = read('.github/workflows/api-ci.yml');
  assert.equal((workflow.match(/npm run verify:introduction-privacy-end-boundary:integration/gu) ?? []).length, 1);
  assert.ok(workflow.indexOf('npm run verify:introduction-privacy-end-boundary:integration') > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'));
  const wire = workflow.indexOf('npm run --silent prove:introduction-end:postgrest');
  assert.ok(wire > workflow.indexOf('docker run -d --rm --name "postgrest-$version"') && wire < workflow.indexOf('docker stop "postgrest-$version"'),
    'the wire proof runs against every live PostgREST line, inside the loop');
  assert.match(workflow, /run: npm run test:s6-02-introduction-privacy-end-boundary-contract\}/u);
  for (const file of [VERIFIER, WIRE]) {
    assert.ok(existsSync(new URL(file, root)));
    assert.doesNotMatch(read(file), /supabase\.co|postgres(?:ql)?:\/\/[^'`$]/iu, `${file} embeds no connection detail`);
  }
  const verifier = read(VERIFIER);
  for (const scenario of ['I01 ', 'I02 ', 'N01 ', 'N02 ', 'M01 ', 'M03 ', 'M04 ', 'E01 ', 'E03 ', 'E04 ', 'E05 ', 'R01 ', 'R03 ', 'R04 ', 'R05 ',
    'A01 ', 'A02 ', 'X01 ', 'X02 ', 'report.assertAllPassed()', 'every fixture this verifier created was rolled back or removed']) {
    assert.ok(verifier.includes(scenario), `the 0155 verifier proves ${scenario.trim()}`);
  }
});
