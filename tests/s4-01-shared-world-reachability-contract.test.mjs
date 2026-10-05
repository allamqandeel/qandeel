// S4-01 — Shared World Reachability, Invitation & Birth: the cross-layer static contract.
//
// It pins what must stay true across the database, the API, the mobile client and the device proof: the frozen I-04
// runtime is consumed through migration 0138's owner commands only; the Product boundary takes no user id, inviter or
// target and never uses the server channel; the Shared ID key material is server configuration only; the Global Switcher
// has exactly the two destinations S4-01 owns and the Shared area is handed nothing of the Personal world; the approved
// copy is bound byte for byte; no Shared conversation is faked; and the device proof is a VAL-01 suite of the A3 shape.
// Live behaviour is proven by database/verify-migration-0138.mjs, apps/api/src/shared-world/shared-world.spec.ts and the
// mobile Jest suites; this file proves structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const RECORD = 'docs/e2e/QANDEEL_S4_01_SHARED_WORLD_REACHABILITY_INVITATION_BIRTH_IMPLEMENTATION_RECORD_v1.md';
const API = 'apps/api/src/shared-world';
const MOBILE = 'apps/mobile/src';

test('1 — the contract registers itself in the toolchain and both CI workflows', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['test:s4-01-shared-world-reachability-contract'], 'node --test tests/s4-01-shared-world-reachability-contract.test.mjs');
  for (const workflow of ['.github/workflows/api-ci.yml', '.github/workflows/mobile-ci.yml']) {
    assert.match(read(workflow), /run: npm run test:s4-01-shared-world-reachability-contract\b/u, `${workflow} runs it`);
  }
  assert.match(read('.github/workflows/mobile-ci.yml'), /'tests\/s4-01-shared-world-reachability-contract\.test\.mjs'/u);
});

test('2 — the API consumes 0138 on the caller\'s own token only: no server channel, no identity parameter, no frozen primitive', () => {
  const repository = code(`${API}/shared-world.repository.ts`);
  const calls = [...repository.matchAll(/'([a-z_]+_v1)'/gu)].map((m) => m[1]).sort();
  for (const name of calls) {
    assert.match(read('database/migrations/0138_shared_world_reachability_invitation_birth_v1.sql'), new RegExp(`CREATE FUNCTION public\\.${name}\\(`, 'u'), `${name} is a 0138 owner wrapper`);
  }
  assert.doesNotMatch(repository, /ServiceRole|service_role|p_user_id|p_target|p_inviter/u);
  for (const file of readdirSync(new URL(`${API}/`, root)).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))) {
    const text = code(`${API}/${file}`);
    assert.doesNotMatch(text, /commit_shared_world_direct_acceptance_birth_v1|rotate_shared_world_invite_credential_v1|submit_shared_world_direct_invitation_v1|regenerate_own_shared_id_v1|set_shared_launch_capability_v1/u,
      `${file} reaches no frozen or operator primitive`);
    assert.doesNotMatch(text, /console\.|logger\.|Logger\b/u, `${file} logs nothing (no Shared ID, no invitation, no Name)`);
  }
  const controller = code(`${API}/shared-world.controller.ts`);
  assert.doesNotMatch(controller, /@Param\('(?:userId|inviterId|targetId|targetUserId)'\)|@Query\(/u, 'no route takes an identity');
  assert.match(controller, /@UseGuards\(SupabaseAuthGuard\)/u);
  const app = code('apps/api/src/app.module.ts');
  assert.match(app, /PushModule, SharedWorldModule, AccountModule/u, 'composed before AccountModule');
});

test('3 — the Shared ID key material is server configuration: never in the repository, never in the database, fail closed', () => {
  const sealing = code(`${API}/shared-id-sealing.ts`);
  assert.match(sealing, /process\.env/u);
  assert.match(sealing, /QANDEEL_SHARED_ID_SEALING_KEYS/u);
  assert.match(sealing, /QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION/u);
  assert.match(sealing, /'aes-256-gcm'/u);
  assert.match(sealing, /setAAD\(/u, 'the ciphertext is bound to account, epoch and key version');
  assert.match(sealing, /sharedIdLookupRef\(value\) === lookupRef/u, 'a value is shown only when it re-derives the stored reference');
  const env = read('.env.example');
  assert.match(env, /^QANDEEL_SHARED_ID_SEALING_KEYS=\s*$/mu, 'the key is named, never valued');
  assert.match(env, /^QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION=/mu);
  assert.doesNotMatch(read('database/migrations/0138_shared_world_reachability_invitation_birth_v1.sql'), /pgp_sym|encrypt\(|decrypt\(/u, 'the database never holds or uses the key');
});

test('4 — the Global Switcher has exactly the two S4-01 destinations; the Shared area is handed nothing of the Personal world', () => {
  const switcher = code(`${MOBILE}/shared-world/GlobalSwitcher.tsx`);
  assert.match(switcher, /export type WorldArea = 'MY_WORLD' \| 'SHARED_WORLD';/u);
  assert.match(switcher, /<NavGlyph name=\{item\.glyph\}/u);
  assert.doesNotMatch(switcher, /navPublic|PUBLIC_WORLD/u, 'no inert Public destination');
  const depth = code(`${MOBILE}/integration/composition/DepthComposition.tsx`);
  const area = depth.slice(depth.indexOf('<SharedWorldArea'), depth.indexOf('/>', depth.indexOf('<SharedWorldArea')));
  const props = [...area.matchAll(/^\s+(\w+)=/gmu)].map((m) => m[1]);
  assert.deepEqual(props, ['controller', 'language', 'insets', 'activity'], 'no store, Session, camera, focus or time is handed over');
  assert.doesNotMatch(area, /runtime\.(?:store|conversation|projection|presentation|preview|journey)/u);
  assert.match(depth, /const personalReachable = reachable && !activityShown && area === 'MY_WORLD';/u, 'the Personal world stays mounted and out of reach beneath');
  assert.deepEqual(readdirSync(new URL(`${MOBILE}/app`, root)).sort(), ['_layout.tsx', 'index.tsx'], 'switching is not a route');
  const sharedArea = code(`${MOBILE}/shared-world/SharedWorldArea.tsx`);
  assert.doesNotMatch(sharedArea, /useCanonicalStore|CanonicalState|conversationController|ConversationSurface|Composer|sendTurn/u, 'no Shared conversation or composer is faked');
});

test('5 — the approved meanings and the frozen names are bound byte for byte', () => {
  const copy = read(`${MOBILE}/shared-world/copy.ts`);
  for (const exact of [
    "invitation: '{0} يدعوك لإنشاء عالم مشترك بينكما ومع قنديل.', // APPROVED — S4-01 §1.3",
    "invitation: '{0} invites you to create a Shared World together with QANDEEL.', // APPROVED — S4-01 §1.3",
    "welcome: 'أهلًا بكما. هذا عالمكما المشترك معي.', // APPROVED — S4-01 §1.6",
    "welcome: 'Welcome. This is your Shared World with me.', // APPROVED — S4-01 §1.6",
    "sharedWorld: 'العالم المشترك', // CANON — G1.2 §3",
    "sharedWorld: 'Shared World', // CANON — G1.2 §3",
    "personalWorld: 'قنديل', // CANON — I-08A4 §8",
    "personalWorld: 'QANDEEL', // CANON — I-08A4 §9",
  ]) assert.ok(copy.includes(exact), `copy carries ${exact}`);
  // The S4-01 Product Copy Gate is CLOSED (Product Owner, 2026-10-05): no row is PROPOSED, and the three amended rows
  // are bound byte-for-byte.
  assert.match(copy, /status: 'S4-01 PRODUCT COPY GATE — CLOSED/u, 'the S4-01 Product Copy Gate is closed');
  assert.doesNotMatch(copy, /\/\/ PROPOSED/u, 'no S4-01 Product copy row remains PROPOSED');
  for (const exact of [
    "declined: 'تم رفض الدعوة.'",
    "invalidSharedId: 'تأكد من المعرّف المشترك وحاول مرة أخرى.'",
    "invalidSharedId: 'Check the Shared ID and try again.'",
    "switcherLabel: 'التنقل بين قنديل والعالم المشترك'",
    "switcherLabel: 'Switch between QANDEEL and Shared World'",
  ]) assert.ok(copy.includes(exact), `copy carries the amended ${exact}`);
  for (const retired of ["'رُفضت الدعوة.'", "'هذا لا يبدو معرّفًا مشتركًا.'", "switcherLabel: 'العوالم'", "switcherLabel: 'Worlds'"]) {
    assert.equal(copy.includes(retired), false, `the retired ${retired} is gone`);
  }
  // The surfaces write no words of their own.
  for (const file of ['SharedWorldArea.tsx', 'GlobalSwitcher.tsx']) {
    assert.doesNotMatch(code(`${MOBILE}/shared-world/${file}`), /['"`][^'"`\n]*[؀-ۿ][^'"`\n]*['"`]/u, `${file} carries no Arabic literal`);
  }
});

test('6 — the device proof is a VAL-01 suite of the A3 shape, and the proof root is unreachable from a Product build', () => {
  const suites = read('scripts/validation/proof-suites.mjs');
  assert.match(suites, /s4: Object\.freeze\(\{\n\s+workflow: '\.github\/workflows\/s4-proof\.yml',\n\s+recipe: 's4-shared-world-proof',/u);
  assert.match(read('scripts/phase-m/native-artifact-manifest.mjs'), /'s4-shared-world-proof': 'src\/integration\/__validation__\/s401-proof-entry\.tsx',/u);
  const workflow = read('.github/workflows/s4-proof.yml');
  assert.match(workflow, /legs --suite s4 --since/u);
  assert.match(workflow, /--role PROOF_VALIDATION --recipe s4-shared-world-proof/u);
  assert.match(workflow, /retry-budget\.mjs --attempt/u);
  assert.match(workflow, /bash scripts\/phase-m\/run-s401-proof-leg\.sh "\$APK" "\$LEG"/u);
  const runner = read('scripts/phase-m/run-s401-proof-leg.sh');
  assert.match(runner, /bounded-run\.mjs/u);
  for (const flow of ['s4-01-readiness.yaml', 's4-01-journey-a.yaml', 's4-01-journey-b.yaml', 's4-01-journey-c.yaml']) {
    assert.ok(existsSync(new URL(`apps/mobile/.maestro/${flow}`, root)), `${flow} exists`);
  }
  const mobileManifest = JSON.parse(read('apps/mobile/package.json'));
  assert.equal(mobileManifest.main, 'expo-router/entry', 'the Product build registers the Product root');
  for (const file of readdirSync(new URL(`${MOBILE}/shared-world/`, root)).filter((f) => /\.(ts|tsx)$/u.test(f))) {
    assert.doesNotMatch(code(`${MOBILE}/shared-world/${file}`), /__validation__|S401ProofRoot/u, `${file} reaches no proof code`);
  }
});

test('7 — the implementation record exists and states its lifecycle without claiming a merge', () => {
  const record = read(RECORD);
  assert.match(record, /^# QANDEEL — S4-01 Shared World Reachability, Invitation & Birth — Implementation Record v1/u);
  assert.match(record, /\*\*Status:\*\* \*\*`S4-01 IMPLEMENTED — READY FOR INDEPENDENT REVIEW — NOT MERGED`\*\*/u);
  assert.match(record, /Orphan gaps = 0/u);
});
