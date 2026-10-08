// S4-03 — Shared Membership Lifecycle, Governance, Settings & Historical Access: the cross-layer static contract.
//
// It pins what must stay true across the database, the API, the mobile client and the device proof: the human's lifecycle
// commands go through migration 0140's owner wrappers on the human's own token (and the former-member deletion through
// S4-02's ungated owner wrapper); no request carries a user, actor, approver, target account, audience, rule, snapshot or
// authority; governed add-member and rejoin take the target's CURRENT Shared ID and nothing else, are bound to its epoch
// inside the database, and never name the target before acceptance (P1 §5.2–§5.3; Product Owner decision 2026-10-05);
// a former member approves their own included words through Privacy & Data; Manage World lives inside the exact World and
// keeps its fields above the keyboard on
// both platforms; the ended World is read-only; the former-member control lives in Privacy & Data and browses no World;
// the S4-03 words live in one gated module; and the device proof adds exactly its two legs to the S4 suite. Live behaviour
// is proven by database/verify-migration-0140.mjs, the API specs and the mobile Jest suites; this file proves structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const RECORD = 'docs/e2e/QANDEEL_S4_03_SHARED_LIFECYCLE_GOVERNANCE_IMPLEMENTATION_RECORD_v1.md';
const MIGRATION = 'database/migrations/0140_shared_world_lifecycle_governance_product_v1.sql';
const API = 'apps/api/src/shared-world';
const MOBILE = 'apps/mobile/src';
const IDENTITY_CLAIM = /\b(?:userId|user_id|actorId|actor_id|approverId|approver_id|authorId|targetUserId|target_user_id|audience|approvalRule|approval_rule|membershipSnapshot|membership_snapshot|authority)\b/u;

test('1 — the contract registers itself in the toolchain and both CI workflows', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['test:s4-03-shared-lifecycle-governance-contract'], 'node --test tests/s4-03-shared-lifecycle-governance-contract.test.mjs');
  for (const workflow of ['.github/workflows/api-ci.yml', '.github/workflows/mobile-ci.yml']) {
    assert.match(read(workflow), /run: npm run test:s4-03-shared-lifecycle-governance-contract\b/u, `${workflow} runs it`);
  }
  assert.match(read('.github/workflows/mobile-ci.yml'), /'tests\/s4-03-shared-lifecycle-governance-contract\.test\.mjs'/u);
});

test('2 — the API consumes 0140 on the caller\'s own token only: no server channel, no identity, no frozen core, nothing logged', () => {
  const repository = code(`${API}/shared-world-lifecycle.repository.ts`);
  const migration = read(MIGRATION);
  // RE-ANCHORED by SHARED-VIS-01 (validation only): the ended World's read moved to the 0148 v2 read — the 0140 read
  // without semantic places (QANDEEL_ANALYSIS); the 0140 function itself is unchanged.
  const calls = [...repository.matchAll(/'([a-z_]+_v[12])'/gu)].map((m) => m[1]);
  for (const name of calls) {
    if (name === 'list_own_closed_shared_world_material_v2') {
      assert.match(read('database/migrations/0148_shared_semantic_field_living_analysis_v1.sql'), /CREATE FUNCTION public\.list_own_closed_shared_world_material_v2\(/u,
        'the ended World\'s conversation is the 0148 v2 read, without semantic places');
      continue;
    }
    if (name === 'delete_own_shared_world_material_v1') {
      assert.match(read('database/migrations/0139_shared_world_conversation_material_v1.sql'), /CREATE FUNCTION public\.delete_own_shared_world_material_v1\(/u,
        'the former-member deletion is S4-02\'s ungated owner wrapper, consumed unchanged');
      continue;
    }
    assert.match(migration, new RegExp(`CREATE FUNCTION public\\.${name}\\(`, 'u'), `${name} is a 0140 owner wrapper`);
  }
  assert.equal(new Set(calls).size, 23, 'the 22 human commands of 0140 and the one owner deletion of 0139');
  assert.doesNotMatch(repository, /ServiceRole|service_role|p_user_id|p_actor|p_approver|p_target_user|p_audience|p_episode|p_snapshot/u);
  for (const file of ['shared-world-lifecycle.repository.ts', 'shared-world-lifecycle.service.ts', 'shared-world.controller.ts']) {
    const text = code(`${API}/${file}`);
    assert.doesNotMatch(text, /console\.|logger\.|Logger\b/u, `${file} logs nothing`);
    assert.doesNotMatch(text, /commit_shared_world_standard_voluntary_leave_v1|capture_shared_world_governance_proposal_v1|commit_shared_world_governance_approval_v1|prepare_shared_world_(?:add_member|remove_member|rejoin|settings_change|history_package|standard_end)_governance_v1|commit_shared_world_member_(?:removal|rejoin)_v1|commit_shared_world_settings_change_v1|commit_shared_world_history_(?:package_approval|access_grant)_v1|commit_shared_world_standard_end_v1|dispatch_shared_world_member_invitation_v1/u,
      `${file} reaches no frozen 0083–0088 core`);
  }
  const controller = code(`${API}/shared-world.controller.ts`);
  assert.doesNotMatch(controller, /@Query\(/u, 'no query object (the S4-01 rule)');
  assert.doesNotMatch(controller, /@Param\('(?:userId|actorId|approverId|targetUserId|targetId|episodeId|snapshotId)'\)/u, 'no route takes an identity');
  assert.match(controller, /@Get\('worlds\/:worldId\/manage'\)/u);
  assert.match(controller, /@Post\('worlds\/:worldId\/leave'\)/u);
  const service = code(`${API}/shared-world-lifecycle.service.ts`);
  assert.match(service, /commandOf\(body, \['commandId', 'memberHandle'\]\)/u, 'removal takes an opaque handle, never an account');
  assert.match(service, /commandOf\(body, \['commandId', 'name', 'description', 'topic'\]\)/u);
  assert.match(service, /commandOf\(body, \['commandId', 'memberHandle', 'materialIds'\]\)/u);
  assert.match(service, /if \(!\(await this\.allowed\(token, worldId\)\)\) return \{ outcome: 'UNAVAILABLE' \};/u, 'nothing of a World before the entry verdict');
  const census = read('apps/api/src/http-security/route-rate-limit.census.ts');
  for (const route of ['POST /shared/worlds/:worldId/proposals/settings', 'POST /shared/worlds/:worldId/proposals/removal', 'POST /shared/worlds/:worldId/proposals/end',
    'POST /shared/worlds/:worldId/history-shares', 'POST /shared/worlds/:worldId/proposals/member']) assert.ok(census.includes(`'${route}': 'SECURITY_SENSITIVE'`), `${route} is held to the strict class`);
  assert.match(census, /'POST \/shared\/worlds\/:worldId\/leave': 'AUTHENTICATED'/u, 'leaving is an exit right, never throttled like a credential act');
  assert.doesNotMatch(read('apps/api/src/http-security/rate-limit.policy.ts'), /SHARED_GOVERNANCE|SHARED_LIFECYCLE/u, 'no new rate class');
});

test('3 — add / rejoin by CURRENT Shared ID only: epoch-bound in the database, one answer, the target never named before acceptance', () => {
  const migration = read(MIGRATION).split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
  // The frozen 0085 cores are consumed unchanged, behind the Shared-ID epoch binding.
  assert.match(migration, /CREATE TABLE shared_private\.shared_governance_proposal_origins/u);
  assert.match(migration, /target_credential_epoch bigint/u);
  assert.match(migration, /CREATE FUNCTION public\.propose_shared_world_member_v1\(p_command_id uuid, p_world_id uuid, p_shared_id text\)\nRETURNS TABLE \(outcome text\)/u,
    'the Product boundary takes a Shared ID and returns one outcome word');
  assert.match(migration, /CREATE FUNCTION public\.accept_shared_membership_request_v1\(p_command_id uuid, p_world_id uuid, p_request_id uuid\)/u);
  assert.doesNotMatch(read('database/migrations/0085_shared_world_governed_membership_lifecycle_v1.sql'), /shared_governance_proposal_origins/u, '0085 is not rewritten');
  // The API and the client carry the typed Shared ID — never an account, epoch or lookup result.
  const service = code(`${API}/shared-world-lifecycle.service.ts`);
  assert.match(service, /commandOf\(body, \['commandId', 'sharedId'\]\)/u);
  assert.match(service, /targetName: kind === 'REMOVAL' \? row\.target_name \?\? null : null/u, 'only a removal target (a current member) is ever named');
  for (const file of [`${API}/shared-world-lifecycle.service.ts`, `${API}/shared-world-lifecycle.repository.ts`, `${MOBILE}/runtime-entry/shared-world-api.ts`,
    `${MOBILE}/shared-world/shared-world-controller.ts`]) {
    assert.doesNotMatch(code(file), /target_user|targetUser|credential_epoch|credentialEpoch|lookup_ref|lookupRef/u, `${file} carries no target account, epoch or lookup result`);
  }
  const controllerApi = code(`${API}/shared-world.controller.ts`);
  assert.match(controllerApi, /@Post\('worlds\/:worldId\/proposals\/member'\)/u);
  assert.match(controllerApi, /@Post\('membership-requests\/:worldId\/:requestId\/accept'\)/u);
  assert.doesNotMatch(controllerApi, /@Get\('[^']*(?:people|users|search|directory|lookup)[^']*'\)/u, 'no searchable people directory');
  // The approver sees the request and who proposed it; the target sees who proposed it — and nothing of the World.
  const page = code(`${MOBILE}/shared-world/SharedManagePage.tsx`);
  assert.match(page, /proposal\.kind === 'ADD' \? copy\.proposalAdd : proposal\.kind === 'REJOIN' \? copy\.proposalRejoin/u);
  assert.match(page, /accessibilityLabel=\{copy\.inviteFieldLabel\}/u, 'the S4-01 approved Shared ID field');
  const root = code(`${MOBILE}/runtime-entry/shared-world-api.ts`);
  assert.match(root, /hasExactly\(r, \['requestId', 'worldId', 'kind', 'proposerName'\]\)/u, 'a request carries its proposer and nothing of the World');
});

test('4 — Manage World is inside the exact World, keeps its fields above the keyboard, and the ended World is read-only', () => {
  const area = code(`${MOBILE}/shared-world/SharedWorldArea.tsx`);
  assert.match(area, /<KeyboardAvoidingView style=\{\{ flex: 1 \}\} behavior="padding">/u, 'the S4-02 composer rule is kept');
  assert.match(area, /<KeyboardAvoidingView style=\{\{ flex: 1 \}\} behavior="padding" testID="qandeel-shared-manage-keyboard">/u,
    'Manage World\'s text fields stay above the keyboard on both platforms (Android 15+ edge-to-edge does not resize)');
  assert.doesNotMatch(area, /Platform\.OS === 'ios' \? 'padding' : undefined/u);
  assert.match(area, /if \(state\.place\.kind === 'MANAGE'\)/u);
  assert.match(area, /onPress=\{\(\) => controller\.openManage\(\)\}/u, 'one way into Manage World, from inside the World');
  const closed = code(`${MOBILE}/shared-world/SharedClosedWorld.tsx`);
  assert.doesNotMatch(closed, /TextInput|SharedSendBar|openManage|controller\.send|deleteMaterial|approve|propose/u, 'the ended World offers no input, governance or deletion');
  const controller = code(`${MOBILE}/shared-world/shared-world-controller.ts`);
  assert.match(controller, /const worldId = openWorldId\(\);\n\s+if \(worldId === null\) return;\n\s+threadRead \+= 1;/u, 'Manage World opens only from an ALLOWed World');
  assert.match(controller, /returnToRoot\('LEFT'\);/u, 'leaving returns to the Shared root at once');
  assert.doesNotMatch(controller, /setInterval|setTimeout|WebSocket|EventSource/u, 'no timer and no realtime channel');
  for (const file of ['SharedWorldArea.tsx', 'SharedManagePage.tsx', 'SharedClosedWorld.tsx', 'SharedWorldThread.tsx']) {
    assert.doesNotMatch(code(`${MOBILE}/shared-world/${file}`), /['"`][^'"`\n]*[؀-ۿ][^'"`\n]*['"`]/u, `${file} carries no Arabic literal`);
  }
  for (const file of ['SharedManagePage.tsx', 'SharedClosedWorld.tsx', 'shared-world-controller.ts']) {
    assert.doesNotMatch(code(`${MOBILE}/shared-world/${file}`), /expo-av|expo-audio|Audio\.|microphone|VoiceNote|recordAsync/u, `${file} fakes no voice (QAN-BL-VOICE-01)`);
  }
  const api = code(`${MOBILE}/runtime-entry/shared-world-api.ts`);
  assert.doesNotMatch(api, IDENTITY_CLAIM, 'the client sends no user, actor, approver, audience, rule, snapshot or authority');
});

test('5 — the former-member control lives in Privacy & Data and browses no World', () => {
  const surface = code(`${MOBILE}/settings/SettingsSurface.tsx`);
  const privacyGroup = surface.slice(surface.indexOf('testID="qandeel-settings-group-privacy"'), surface.indexOf('testID="qandeel-settings-group-support"'));
  assert.match(privacyGroup, /<FormerSharedMaterialRow /u, 'one row, inside Privacy & Data');
  const page = code(`${MOBILE}/settings/FormerSharedMaterialSection.tsx`);
  assert.doesNotMatch(page, /SharedWorldArea|openWorld|members|authorName|worldLabel|labelOfWorld/u, 'no World browsing, member or Name');
  const controller = code(`${MOBILE}/settings/former-shared-material-controller.ts`);
  assert.doesNotMatch(controller, /entry\(|materials\(|manage\(/u, 'it reads only the reader\'s own former words');
  // Material authority survives membership: the former member approves their own included words here, with no grantee.
  assert.match(controller, /transport\.approveFormerHistoryShare\(request\.worldId, packageId, commandId\)/u);
  assert.doesNotMatch(page, /granteeName|grantee/u, 'no grantee is shown to a former member');
  assert.match(code(`${MOBILE}/integration/composition/DepthComposition.tsx`), /formerShared=\{runtime\.formerSharedMaterial\}/u);
});

test('6 — the S4-03 words live in one copy module under one gate; canon and approved rows are reused, never copied', () => {
  const copy = read(`${MOBILE}/shared-world/lifecycle-copy.ts`);
  assert.match(copy, /export const SHARED_LIFECYCLE_COPY_GATE = \{/u);
  assert.match(copy, /manageWorld: 'إدارة العالم', \/\/ CANON — I-08A4 §8/u);
  assert.match(copy, /manageWorld: 'Manage World', \/\/ CANON — I-08A4 §9/u);
  assert.match(copy, /worldSettings: 'إعدادات العالم', \/\/ CANON — I-08A4 §8/u);
  assert.match(copy, /worldSettings: 'World Settings', \/\/ CANON — I-08A4 §9/u);
  assert.match(copy, /const shared = sharedCopy\(language\); \/\/ REUSED — S4-01/u);
  assert.match(copy, /const conversation = sharedConversationCopy\(language\); \/\/ REUSED — S4-02/u);
  assert.match(copy, /status: 'S4-03 PRODUCT COPY GATE — CLOSED — Product Owner, 2026-10-05',/u, 'the gate is closed by the Product Owner');
  assert.doesNotMatch(copy.slice(copy.indexOf('const AR_OWN')), /\/\/ PROPOSED/u, 'no row is still PROPOSED');
  const rows = [...copy.matchAll(/^\s+(\w+): ['"][^\n]*\/\/ (CANON|PROPOSED|APPROVED)/gmu)].map((m) => [m[1], m[2]]);
  const gate = copy.slice(copy.indexOf('export const SHARED_LIFECYCLE_COPY_GATE'), copy.indexOf('} as const;'));
  const listed = (name) => [...(new RegExp(`${name}: \\[([^\\]]*)\\]`, 'u').exec(gate)?.[1] ?? '').matchAll(/'(\w+)'/gu)].map((m) => m[1]);
  assert.equal(rows.length, 2 * (listed('canon').length + listed('approved').length), 'every own row is listed under the gate, in both languages');
  // Every own row is drawn somewhere: no word is approved for a surface that does not exist.
  const surfaces = ['SharedWorldArea.tsx', 'SharedManagePage.tsx', 'SharedClosedWorld.tsx'].map((f) => code(`${MOBILE}/shared-world/${f}`)).join('\n')
    + code(`${MOBILE}/settings/FormerSharedMaterialSection.tsx`);
  for (const key of [...listed('canon'), ...listed('approved'), ...listed('reused')]) {
    assert.match(surfaces, new RegExp(`(?:copy|lifecycle)\\.${key}\\b`, 'u'), `${key} is drawn on an S4-03 surface`);
  }
  for (const [name, status] of rows) assert.ok(['CANON', 'APPROVED'].includes(status), `${name} carries a status`);
  // The runner asserts the reader's own notices byte-for-byte.
  const runner = read('scripts/phase-m/run-s401-proof-leg.sh');
  const left = /AR_LEFT="([^"]+)"/u.exec(runner)?.[1];
  const granted = /EN_GRANTED="([^"]+)"/u.exec(runner)?.[1];
  assert.ok(left !== undefined && copy.includes(`left: '${left}',`), 'the Arabic leave notice the device flow asserts is the copy module\'s');
  assert.ok(granted !== undefined && copy.includes(`granted: '${granted}',`), 'the English grant notice the device flow asserts is the copy module\'s');
});

test('7 — the device proof adds exactly its two S4-03 legs to the existing S4 suite, deterministic and validation-only', () => {
  const runner = read('scripts/phase-m/run-s401-proof-leg.sh');
  assert.match(runner, /ar-s403-journey-a\) maestro_flow s4-03-journey-a\.yaml leg/u);
  assert.match(runner, /en-s403-journey-b\) maestro_flow s4-03-journey-b\.yaml leg/u);
  for (const flow of ['s4-03-journey-a.yaml', 's4-03-journey-b.yaml']) {
    const text = read(`apps/mobile/.maestro/${flow}`);
    assert.doesNotMatch(text, /- wait:|sleep|waitForAnimationToEnd/u, `${flow} synchronizes on state, never on time`);
    assert.doesNotMatch(text, /hideKeyboard/u, `${flow} keeps the keyboard open naturally (T-13)`);
  }
  assert.match(read('apps/mobile/.maestro/s4-03-journey-a.yaml'), /inputText: "Fixture Lantern"\n- scrollUntilVisible:\n    element:\n      id: "qandeel-shared-settings-send"\n    direction: DOWN\n    timeout: 30000\n- tapOn:\n    id: "qandeel-shared-settings-send"/u,
    'Send is brought into view and pressed with the keyboard still open');
  assert.match(read('apps/mobile/.maestro/s4-03-journey-b.yaml'), /- scrollUntilVisible:\n    element:\n      id: "qandeel-shared-share-candidate"\n    direction: DOWN\n    timeout: 30000/u,
    'the share candidate is scrolled into view, never only waited for');
  assert.match(read('.github/workflows/s4-proof.yml'), /'feat\/s4-03-shared-lifecycle-governance'/u);
  for (const file of ['SharedManagePage.tsx', 'SharedClosedWorld.tsx', 'lifecycle-copy.ts']) {
    assert.doesNotMatch(code(`${MOBILE}/shared-world/${file}`), /__validation__|S401ProofRoot|S403_PROOF/u, `${file} reaches no proof code`);
  }
});

test('8 — the implementation record exists, records both Product Owner decisions and claims no merge', () => {
  assert.ok(existsSync(new URL(RECORD, root)));
  const record = read(RECORD);
  assert.match(record, /^# QANDEEL — S4-03 Shared Membership Lifecycle, Governance, Settings & Historical Access — Implementation Record v1/u);
  assert.match(record, /^\*\*Status:\*\* \*\*`S4-03 IMPLEMENTED/mu);
  assert.doesNotMatch(record, /^\*\*Status:\*\*[^\n]*MERGED \/ CLOSED/mu, 'the record never claims a merge it has not had');
  assert.match(record, /### 4\.1 Add-member target presentation/u);
  assert.match(record, /### 4\.2 Birth scene and World-Transition/u);
  assert.match(record, /T-A \+ B-A/u, 'the visual decision is recorded');
  assert.match(record, /CURRENT Shared ID/u, 'the reachability decision is recorded');
  assert.match(record, /\*\*Orphan gaps:\*\* none silently dropped/u);
  assert.match(record, /QAN-BL-VOICE-01/u);
});
