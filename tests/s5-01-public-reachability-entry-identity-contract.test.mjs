// S5-01 — Public World Reachability, Entry & Identity Foundation: the cross-layer static contract.
//
// It pins what must stay true across the database, the API, the mobile client and the governance record: the frozen
// I-05 runtime (0091–0099) is consumed, never edited or re-granted; migration 0142 adds one entry verdict and the
// account's Public display MODE (never label bytes), composed over the frozen audience gate and synchronized into the
// I-05 display row; no Draft, publication, Experience, search, placement, discussion, Public QANDEEL, reaction, Replay
// or Launch path is opened; signed-out viewing stays UNRESOLVED; the Global Switcher's third destination is the real
// Public area with the frozen P2 navPublic; `qandeel://public` is exact and goes through the same entry controller;
// the display choice lives in Account & Identity; the Copy Gate is closed; QAN-BL-CW-01 is assigned to
// S5-02 and not implemented. Live behaviour is proven by database/verify-migration-0142.mjs, the API spec and the mobile
// Jest suites; this file proves structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { FROZEN_PREDECESSORS } from '../database/tests/public-runtime-frozen-predecessors.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const sql = (path) => read(path).replace(/--.*$/gmu, '');
const RECORD = 'docs/e2e/QANDEEL_S5_01_PUBLIC_REACHABILITY_ENTRY_IDENTITY_FOUNDATION_IMPLEMENTATION_RECORD_v1.md';
const MIGRATION = 'database/migrations/0142_public_world_entry_identity_product_v1.sql';
const VERIFIER = 'database/verify-migration-0142.mjs';
const API = 'apps/api/src/public-world';
const MOBILE = 'apps/mobile/src';
const OWNER_WRAPPERS = ['read_public_world_entry_v1', 'read_own_public_display_v1', 'set_own_public_display_mode_v1'];

test('1 — the contract and the 0142 verifier are registered in the toolchain and both CI workflows', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['test:s5-01-public-reachability-entry-identity-contract'], 'node --test tests/s5-01-public-reachability-entry-identity-contract.test.mjs');
  assert.equal(manifest.scripts['verify:public-world-entry-identity:integration'], 'node --env-file-if-exists=.env database/verify-migration-0142.mjs');
  for (const workflow of ['.github/workflows/api-ci.yml', '.github/workflows/mobile-ci.yml']) {
    assert.match(read(workflow), /run: npm run test:s5-01-public-reachability-entry-identity-contract\b/u, `${workflow} runs it`);
  }
  assert.match(read('.github/workflows/mobile-ci.yml'), /'tests\/s5-01-public-reachability-entry-identity-contract\.test\.mjs'/u);
  const api = read('.github/workflows/api-ci.yml');
  assert.match(api, /run: npm run verify:public-world-entry-identity:integration\b/u);
  assert.ok(api.indexOf('verify:public-world-entry-identity:integration') > api.indexOf('verify:shared-activity-notifications:integration'), 'it runs after the 0141 verifier');
  assert.ok(existsSync(new URL(VERIFIER, root)));
  assert.doesNotMatch(read(VERIFIER), /readFileSync|migrations\//u, 'the verifier proves the migrated database, not the file');
});

test('2 — 0142 is forward-only and leaves the frozen I-05 runtime exactly as it is', () => {
  const files = readdirSync(new URL('database/migrations/', root)).filter((f) => f.endsWith('.sql')).sort();
  assert.equal(files[files.indexOf('0142_public_world_entry_identity_product_v1.sql') - 1], '0141_shared_activity_notifications_v1.sql');
  for (const [file, blob] of FROZEN_PREDECESSORS) {
    const bytes = Buffer.from(read(`database/migrations/${file}`), 'utf8');
    const id = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(id, blob, `${file} is byte-identical`);
  }
  const text = sql(MIGRATION);
  assert.doesNotMatch(text, /CREATE OR REPLACE|DROP |ALTER TABLE public\.|ALTER FUNCTION public\.(?!read_public_world_entry_v1|read_own_public_display_v1|set_own_public_display_mode_v1)/u,
    'no frozen object is replaced, dropped or altered');
  // The two frozen identity primitives appear only by signature, in the deploy-time closure assertion; nothing calls them.
  assert.doesNotMatch(text, /INSERT INTO public\.public_identities|(?:PERFORM|SELECT|FROM)\s[^;]*(?:ensure_public_identity_v1|update_public_display_label_v1)/u, 'no I-05 identity is provisioned');
  assert.doesNotMatch(text, /public_audience_policy_state\s+SET|UPDATE public\.public_audience_policy_state|'ALLOWED'|'CLEARED'/u, 'no audience policy is set and no prerequisite is cleared');
  assert.doesNotMatch(text, /resolve_public_publication_prerequisites_v1\s*\(\s*p_/u, 'the CW2-08 seam is not redefined');
  for (const forbidden of ['create_public_experience_draft_v1', 'prepare_public_experience_manifest_v1', 'approve_public_experience_manifest_v1',
    'commit_public_experience_ready_for_review_v1', 'publish_public_experience_v1', 'resolve_public_experience_serving_v1', 'resolve_public_experience_review_v1',
    'post_public_discussion_v1', 'record_public_qandeel_response_v1', 'search_public_experiences_v1', 'resolve_public_lens_v1', 'resolve_public_panel_v1',
    'record_public_experience_semantic_placement_v1', 'publication_package_item_provenance', 'public_experience_text_derivative_bodies']) {
    const uses = text.split(forbidden).length - 1;
    const asserted = ['publish_public_experience_v1', 'create_public_experience_draft_v1'].includes(forbidden) ? 1 : 0;
    assert.equal(uses, asserted, `0142 does not reach ${forbidden}${asserted ? ' (only its own deploy-time closure assertion names it)' : ''}`);
  }
  assert.match(text, /public\.resolve_public_audience_admission_v1\(v_user\)/u, 'the entry composes the ONE frozen audience gate');
  assert.match(text, /RAISE EXCEPTION 'PUBLIC_WORLD_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'/u, 'signed-out never reaches the gate');
});

test('3 — 0142 grants exactly the three owner commands to authenticated and nothing to anyone else', () => {
  const text = sql(MIGRATION);
  const grants = [...text.matchAll(/GRANT\s+([^;]+);/gu)].map((m) => m[1].replace(/\s+/gu, ' ').trim());
  assert.deepEqual(grants, [
    'USAGE ON SCHEMA public_world_private TO authenticated',
    'EXECUTE ON FUNCTION public_world_private.read_public_world_entry_v1(), public_world_private.read_own_public_display_v1(), public_world_private.set_own_public_display_mode_v1(text), public.read_public_world_entry_v1(), public.read_own_public_display_v1(), public.set_own_public_display_mode_v1(text) TO authenticated',
  ]);
  assert.doesNotMatch(text, /GRANT[^;]*(?:service_role|anon)/u);
  assert.doesNotMatch(text, /GRANT[^;]*ON TABLE/u, 'no table grant');
  const definers = text.match(/SECURITY DEFINER/gu) ?? [];
  const pinned = text.match(/SECURITY DEFINER SET search_path = ''/gu) ?? [];
  assert.equal(definers.length, pinned.length, 'every definer pins an empty search_path');
  for (const name of OWNER_WRAPPERS) {
    assert.match(text, new RegExp(`CREATE FUNCTION public\\.${name}\\([^)]*\\)\\nRETURNS[^\\n]*\\nLANGUAGE sql (?:STABLE|VOLATILE) SECURITY INVOKER SET search_path = ''`, 'u'), `public.${name} is an INVOKER wrapper`);
  }
  assert.match(text, /REFERENCES public\.users \(id\) ON DELETE CASCADE/u, 'the choice never blocks the governed Personal erasure');
});

test('4 — the API consumes 0142 on the caller\'s own token only: three routes, no identity, label or authority input', () => {
  const repository = code(`${API}/public-world.repository.ts`);
  const calls = [...repository.matchAll(/'([a-z_]+_v1)'/gu)].map((m) => m[1]).sort();
  assert.deepEqual(calls, [...OWNER_WRAPPERS].sort());
  assert.doesNotMatch(repository, /ServiceRole|service_role|serviceApi|p_user|p_public_identity|p_display_label|p_audience/u);
  // RE-ANCHORED by S5-02 (validation only). This first swept EVERY file of the directory, when S5-01's were the only
  // ones. S5-02 legitimately adds the Public authoring boundary beside them (`public-authoring.*`, pinned by its own
  // contract); S5-01's own four files still open nothing inside Public World.
  // RE-ANCHORED by S5-04 (validation only): `public-world.module.ts` is the Stage-5 composition root, and S5-04 composes the
  // dependent discussion there (its own contract pins that wiring). S5-01's own three files still open nothing.
  for (const file of ['public-world.controller.ts', 'public-world.repository.ts', 'public-world.service.ts']) {
    const text = code(`${API}/${file}`);
    assert.doesNotMatch(text, /console\.|logger\.|Logger\b/u, `${file} logs nothing`);
    assert.doesNotMatch(text, /experience|draft|publication|publish_|discussion|reaction|replay|search|lens|placement/iu, `${file} opens nothing inside Public World`);
  }
  const controller = code(`${API}/public-world.controller.ts`);
  assert.deepEqual([...controller.matchAll(/@(Get|Put|Post|Delete|Patch)\('([^']*)'\)/gu)].map((m) => `${m[1]} ${m[2]}`), ['Get entry', 'Get display', 'Put display']);
  assert.doesNotMatch(controller, /@Param\(|@Query\(/u, 'no route takes an identity or a filter');
  assert.match(controller, /@Controller\('public'\)\n@UseGuards\(SupabaseAuthGuard\)/u);
  const service = code(`${API}/public-world.service.ts`);
  assert.match(service, /Object\.keys\(value\)\.some\(\(key\) => key !== 'mode'\)/u, 'the body is the mode and nothing else');
  assert.match(code('apps/api/src/app.module.ts'), /HimModule, PublicWorldModule, ActivityModule/u);
  const census = code('apps/api/src/http-security/route-rate-limit.census.ts');
  for (const route of ['GET /public/entry', 'GET /public/display', 'PUT /public/display']) assert.match(census, new RegExp(`'${route}': 'AUTHENTICATED'`, 'u'));
});

test('5 — the third Global Area is real: navPublic from P2, the same entry controller for the switcher and the link', () => {
  const generated = read(`${MOBILE}/iconography/p2-production.generated.ts`);
  assert.match(generated, /"navPublic": \{\n\s+"strokes": \[\n\s+\{\n\s+"d": "M13\.426 19\.872A8 8 0 0 1 6\.829 18\.104M4\.47 9\.299A8 8 0 0 1 9\.299 4\.47M18\.104 6\.829A8 8 0 0 1 19\.872 13\.426"/u,
    'the frozen P2-A sig.mjs navPublic, executed by the generator, never redrawn');
  assert.match(read('apps/mobile/scripts/generate-p2-production.mjs'), /navPublic: navPrimitives\(SIG\.navPublic\(OPEN, 24\)\)/u);
  assert.match(code(`${MOBILE}/iconography/NavGlyph.tsx`), /export type NavGlyphName = 'navMine' \| 'navShared' \| 'navPublic';/u);
  const link = code(`${MOBILE}/public-world/public-link.ts`);
  assert.match(link, /const PUBLIC_WORLD_LINK = 'qandeel:\/\/public';/u);
  assert.match(link, /return url === PUBLIC_WORLD_LINK;/u, 'exact parse only');
  const runtime = code(`${MOBILE}/integration/runtime/integration-runtime.ts`);
  assert.match(runtime, /if \(isPublicWorldLink\(url\) && !disposed && kind !== 'SIGNED_OUT' && kind !== 'ERROR'\) publicLinks\.put\(\);/u);
  assert.match(runtime, /if \(state\.kind === 'SIGNED_OUT' \|\| state\.kind === 'ERROR'\) publicLinks\.drop\(\);/u, 'signed out, a Public link is dropped');
  const depth = code(`${MOBILE}/integration/composition/DepthComposition.tsx`);
  assert.match(depth, /if \(areaRef\.current === 'PUBLIC_WORLD'\) publicWorld\.enter\(\);\n\s+setArea\('PUBLIC_WORLD'\);/u, 'a link enters through the same controller');
  const area = depth.slice(depth.indexOf('<PublicWorldArea'), depth.indexOf('/>', depth.indexOf('<PublicWorldArea')));
  assert.deepEqual([...area.matchAll(/^\s+(\w+)=/gmu)].map((m) => m[1]), ['controller', 'language', 'insets', 'activity'], 'nothing of the Personal world or the Shared area is handed over');
  assert.match(depth, /const personalReachable = reachable && !activityShown && area === 'MY_WORLD';/u);
  const surface = code(`${MOBILE}/public-world/PublicWorldArea.tsx`);
  assert.ok(surface.indexOf("entry === 'NONE' || entry === 'RESOLVING'") < surface.indexOf('qandeel-public-title'), 'no destination detail before ALLOW');
  assert.doesNotMatch(surface, /BackHandler/u, 'Back at the root is local-only: nothing is registered');
  for (const file of readdirSync(new URL(`${MOBILE}/public-world/`, root)).filter((f) => /\.(ts|tsx)$/u.test(f))) {
    // RE-ANCHORED by S5-04 (validation only): the entry controller now carries ONE Direct Entry target (an Experience id,
    // DISCUSSION or RELATIONS) to the field or the workspace on ALLOW. It still holds and fakes no Public content.
    const text = file === 'public-world-controller.ts'
      ? code(`${MOBILE}/public-world/${file}`).replace(/experienceId|'DISCUSSION'|'RELATIONS'/gu, '')
      : code(`${MOBILE}/public-world/${file}`);
    assert.doesNotMatch(text, /experience|draft|publication|publish_|discussion|reaction|replay|search|lens|placement|trending|popular/iu, `${file} fakes no Public content`);
    assert.doesNotMatch(text, /useCanonicalStore|conversationController|sharedWorld\b|__validation__/u, `${file} reads nothing of the Personal world or the Shared area`);
  }
});

test('6 — the display choice is a MODE in Account & Identity; no Public Settings page; the Copy Gate is closed', () => {
  const api = code(`${MOBILE}/runtime-entry/public-world-api.ts`);
  assert.match(api, /this\.exchange\('PUT', '\/public\/display', \{ mode \}\)/u, 'only the mode is sent');
  assert.doesNotMatch(api, /publicIdentityRef|public_identity_ref|userId/u);
  const settings = code(`${MOBILE}/settings/SettingsSurface.tsx`);
  const account = settings.slice(settings.indexOf('qandeel-settings-group-account'), settings.indexOf('qandeel-settings-group-security'));
  assert.match(account, /<PublicDisplaySection controller=\{publicDisplay\}/u, 'inside the Account & Identity group');
  for (const dir of ['settings', 'public-world']) {
    for (const file of readdirSync(new URL(`${MOBILE}/${dir}/`, root)).filter((f) => /\.(ts|tsx)$/u.test(f))) {
      assert.doesNotMatch(file, /PublicSettings|public-settings/u, `${file} is not a Public Settings page`);
    }
  }
  for (const file of ['public-world/PublicWorldArea.tsx', 'settings/PublicDisplaySection.tsx', 'shared-world/GlobalSwitcher.tsx']) {
    assert.doesNotMatch(code(`${MOBILE}/${file}`), /['"`][^'"`\n]*[؀-ۿ][^'"`\n]*['"`]/u, `${file} carries no Arabic literal`);
  }
  const copy = read(`${MOBILE}/public-world/copy.ts`);
  assert.match(copy, /status: 'S5-01 PRODUCT COPY GATE — CLOSED \(2026-10-06: every row CANON, REUSED or APPROVED; none PROPOSED\)'/u);
  for (const exact of [
    "publicWorld: 'العالم العام', // CANON — I-08A4 §8",
    "publicWorld: 'Public World', // CANON — I-08A4 §9",
    "switcherLabel: 'التنقل بين قنديل والعالم المشترك والعالم العام', // APPROVED — S5-01 Product Copy Gate (Product Owner, 2026-10-06) — accessible name only",
    "switcherLabel: 'Switch between QANDEEL, Shared World and Public World', // APPROVED — S5-01 Product Copy Gate (Product Owner, 2026-10-06) — accessible name only",
    "displayHeading: 'الظهور في العالم العام', // APPROVED — S5-01 Product Copy Gate (Product Owner, 2026-10-06)",
    "displayHeading: 'Shown in Public World as', // APPROVED — S5-01 Product Copy Gate (Product Owner, 2026-10-06)",
  ]) assert.ok(copy.includes(exact), `copy carries ${exact}`);
  assert.equal((copy.match(/\/\/ PROPOSED/gu) ?? []).length, 0, 'no PROPOSED row remains');
});

test('7 — governance: the record, E2E-H-08 and QAN-BL-CW-01 owned by S5-02 without being closed', () => {
  const record = read(RECORD);
  assert.match(record, /^# QANDEEL — S5-01 Public Reachability, Entry & Identity Foundation — Implementation Record v1/u);
  // RE-ANCHORED by S5-02 (governance reconciliation, validation only): S5-01 merged through PR #314; its banner now records
  // that truth and keeps the review-time banner as history.
  assert.match(record, /\*\*Status:\*\* \*\*`S5-01 — MERGED \/ CLOSED — PR #314 at 8dfc7b38baa133c8cecbffea8c65ae17ddc245ff — S5-01 PRODUCT COPY GATE CLOSED`\*\*/u);
  assert.match(record, /`S5-01 IMPLEMENTED — REVIEW CANDIDATE \(Draft PR\) — S5-01 PRODUCT COPY GATE CLOSED — NOT MERGED`; Claude did not merge it\./u);
  assert.match(record, /\*\*`E2E-H-08` — ADVANCED \/ S5-02 OWNED — NOT CLOSED\*\*/u, 'S5-01 advances E2E-H-08 and does not close it');
  assert.doesNotMatch(record, /E2E-H-08[^\n]*closes on merge/u);
  assert.match(record, /Orphan gaps = 0/u);
  assert.match(record, /5cf98a267d9eed7e9019f0ca5ed93bd8884a1b36/u);
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /\| `QAN-BL-CW-01` \| Owner Deletion Does Not Reach the Public DRAFT Source-Content Derivative \(`ASSURE-F05`\) \| `S5-02 — Publishing \+ Rights \+ Draft\/Review \+ Privacy Closure` \| `HIGH` \| `CLOSED — TOMBSTONE` \|/u,
    'RE-ANCHORED by S5-02: the owner S5-01 designated closed the item (tombstone effective from the S5-02 merge)');
  assert.match(backlog, /\| `QAN-BL-ACCT-01` \| Account Deletion Across Connected Worlds — Explicit Connected-Worlds Deletion Blocker \| `UNASSIGNED` \| `HIGH` \| `OPEN — UNASSIGNED` \|/u);
  assert.match(backlog, /physically erased/u, 'the Product Owner ASSURE-F05 decision is recorded');
  assert.match(backlog, /\| `S5-02 — Publishing \+ Rights \+ Draft\/Review \+ Privacy Closure` \|[^\n]*`E2E-H-08`[^\n]*80-character account Name by a reviewed forward migration/u, 'S5-02 owns the E2E-H-08 closure and the Name-length reconciliation');
  assert.doesNotMatch(sql(MIGRATION), /public_experience_text_derivative/u, 'ASSURE-F05 is not implemented here');
});
