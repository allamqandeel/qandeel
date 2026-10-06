// S4-04 — Shared Activity, Notifications & Direct Entry: the cross-layer static contract.
//
// It pins what must stay true across the database, the API and the mobile client: the Shared producer publishes ONLY
// through A3-01's one boundary (`ActivityPublisher.publish`), as `SHARED_ACTIVITY` spoken by PRODUCT, with the exact World
// as context AND destination, never Class 1 or 2, an ordinary message at Class 4 (never an automatic Push), and no message
// text, preview or inferred meaning; its recipients come from ONE service-role server pass that derives them from durable
// Shared truth (the API sends a fact's identity only); per-World mutes reuse the ONE A3-01 mute table through a Shared
// authorization by the entry law (no new table, no Activity read of Connected Worlds tables); Activity's Direct Entry
// opens SHARED_WORLD only on a CURRENT Shared entry verdict while Replay stays closed (Stage 7); the device opens the
// exact World through the existing Shared controller (`openWorld`) — a link is parsed strictly and never trusted; the
// first legitimate Shared entry offers the EXISTING education through `push.offer('SHARED_FIRST_ENTRY')`, gated on
// ALLOW; the Shared Activity words are approved bytes reused from their sources, with every new row in ONE bounded gate.
// Live behaviour is proven by database/verify-migration-0141.mjs, the API spec and the mobile Jest suites.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const RECORD = 'docs/e2e/QANDEEL_S4_04_SHARED_ACTIVITY_NOTIFICATIONS_DIRECT_ENTRY_IMPLEMENTATION_RECORD_v1.md';
const MIGRATION = 'database/migrations/0141_shared_activity_notifications_v1.sql';
const VERIFIER = 'database/verify-migration-0141.mjs';
const API = 'apps/api/src/shared-world';
const MOBILE = 'apps/mobile/src';
const sql = () => read(MIGRATION).split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n');

test('1 — the contract and the verifier are registered in the toolchain and the CI workflows', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['test:s4-04-shared-activity-notifications-direct-entry-contract'], 'node --test tests/s4-04-shared-activity-notifications-direct-entry-contract.test.mjs');
  assert.equal(manifest.scripts['verify:shared-activity-notifications:integration'], 'node --env-file-if-exists=.env database/verify-migration-0141.mjs');
  for (const workflow of ['.github/workflows/api-ci.yml', '.github/workflows/mobile-ci.yml']) {
    assert.match(read(workflow), /run: npm run test:s4-04-shared-activity-notifications-direct-entry-contract\b/u, `${workflow} runs it`);
  }
  assert.match(read('.github/workflows/mobile-ci.yml'), /'tests\/s4-04-shared-activity-notifications-direct-entry-contract\.test\.mjs'/u);
  assert.match(read('.github/workflows/api-ci.yml'), /run: npm run verify:shared-activity-notifications:integration\b/u);
  assert.ok(existsSync(new URL(VERIFIER, root)));
});

test('2 — migration 0141: no new store; ONE server pass for service_role only; the mute is the A3-01 table, authorized by the entry law', () => {
  const body = sql();
  assert.doesNotMatch(body, /CREATE TABLE|ALTER TABLE|CREATE POLICY|CREATE TRIGGER/u, 'no table, column, policy or trigger: no second event, mute or notification store');
  assert.match(body, /CREATE FUNCTION public\.server_read_shared_activity_source_v1\(p_source_kind text, p_source_id uuid\)/u, 'the API sends a fact identity and nothing else');
  assert.match(body, /LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS \$\$/u);
  assert.match(body, /GRANT EXECUTE ON FUNCTION public\.server_read_shared_activity_source_v1\(text, uuid\) TO service_role/u);
  assert.doesNotMatch(body, /GRANT[^;]*shared_private[^;]*TO service_role/u, 'the server channel gains nothing in shared_private');
  assert.doesNotMatch(body, /GRANT[^;]*server_read_shared_activity_source_v1[^;]*TO authenticated/u);
  // Recipients are derived from durable Shared truth, never the author / proposer / actor, and only current members.
  assert.match(body, /public\.resolve_shared_world_material_v1\(v_world, e\.user_id\)/u, 'a message tells only those who can see it (the ONE frozen resolver)');
  assert.match(body, /e\.user_id <> o\.proposer_user_id/u);
  assert.match(body, /e\.id IS DISTINCT FROM p\.excluded_membership_episode_id/u, 'the removal target is never told');
  assert.match(body, /NOT shared_private\.is_committed_shared_proposal_v1\(p\.id\)/u);
  assert.match(body, /SELECT t\.target, p\.world_id, NULL::text/u, 'a request target gets nothing of the World');
  // The per-World mute: the ONE A3-01 table, behind the S4-01 entry law; Activity reads no Connected Worlds table.
  const mute = body.slice(body.indexOf('CREATE FUNCTION shared_private.set_own_shared_world_alerts_v1'), body.indexOf('CREATE FUNCTION public.list_own_shared_world_alerts_v1'));
  assert.match(mute, /e\.ended_at IS NULL AND w\.lifecycle = 'ACTIVE'/u);
  assert.match(mute, /INSERT INTO public\.activity_context_mutes \(user_id, context_ref\) VALUES \(v_user, p_world_id::text\)/u);
  assert.deepEqual([...body.matchAll(/(?:INSERT INTO|DELETE FROM|UPDATE) (public\.[a-z_]+)/gu)].map((m) => m[1]).sort(),
    ['public.activity_context_mutes', 'public.activity_context_mutes'], 'the only write is the reader\'s own mute row');
  assert.doesNotMatch(code('apps/api/src/activity/activity.repository.ts'), /shared_worlds\b|shared_world_membership|shared_world_materials|shared_private/u, 'Activity reads no Connected Worlds table');
});

test('3 — ONE publishing boundary: the Shared producer publishes through ActivityPublisher only, as a bounded PRODUCT fact', () => {
  const producer = code(`${API}/shared-activity.producer.ts`);
  assert.match(producer, /import \{ ActivityPublisher, type ActivityCandidate \} from '\.\.\/activity\/activity-publisher\.service';/u);
  assert.match(producer, /await this\.publisher\.publish\(candidate\)/u);
  assert.match(producer, /kind: 'SHARED_ACTIVITY'/u);
  assert.match(producer, /speaker: 'PRODUCT'/u);
  assert.match(producer, /contextRef: world/u);
  assert.match(producer, /\{ destination: 'SHARED_WORLD', ref: world \}/u, 'the exact World is the destination');
  assert.match(producer, /disclosureMax: 'L2'/u, 'the Shared default ceiling');
  assert.doesNotMatch(producer, /interruptionClass: [12]\b/u, 'Class 1 is never Shared; Class 2 needs a genuine timing window');
  assert.match(producer, /humanText\(materialId: string\)[\s\S]*?interruptionClass: 4, body: SHARED_ACTIVITY_COPY\.ambient/u, 'a message is ambient: no mark, no strip, no Push');
  assert.doesNotMatch(producer, /text_body|textBody|\.text\b|preview|mention|score|importance|urgency/iu, 'no content, preview, mention or invented importance');
  for (const file of readdirSync(new URL(`${API}/`, root)).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))) {
    const text = code(`${API}/${file}`);
    assert.doesNotMatch(text, /server_publish_activity_candidate_v1|activity_items|activity_item_members/u, `${file} never writes Activity directly`);
    assert.doesNotMatch(text, /console\.|logger\.|Logger\b/u, `${file} logs nothing`);
  }
  // The recipients are the database's: the server read takes a fact identity only.
  const sources = code(`${API}/shared-activity.repository.ts`);
  assert.match(sources, /'server_read_shared_activity_source_v1', \{ p_source_kind: kind, p_source_id: sourceId \}/u);
  // The Shared Product transports stay on the caller's own token.
  for (const file of ['shared-world.repository.ts', 'shared-world-conversation.repository.ts', 'shared-world-lifecycle.repository.ts', 'shared-world-alerts.repository.ts']) {
    assert.doesNotMatch(code(`${API}/${file}`), /ServiceRole|service_role|p_user_id/u, `${file} runs on the caller's token`);
  }
  // Publication follows a COMMITTED fact only, and never changes the Shared answer.
  const controller = code(`${API}/shared-world.controller.ts`);
  for (const [outcome, call] of [['COMMITTED', 'humanText'], ['PROPOSED', 'proposal'], ['SUBMITTED', 'proposal'], ['INVITED', 'memberRequest'], ['JOINED', 'joined'], ['BORN', 'birth'], ['LEFT', 'left']]) {
    assert.match(controller, new RegExp(`if \\(result\\.outcome === '${outcome}'\\) await this\\.activity\\.${call}\\(`, 'u'), `${outcome} → ${call}`);
  }
  assert.match(read('apps/api/src/activity/activity.module.ts'), /exports: \[ActivityPublisher\]/u, 'still exactly one boundary');
});

test('4 — Direct Entry: SHARED_WORLD opens on a CURRENT entry verdict only; Replay stays closed (Stage 7)', () => {
  const types = code('apps/api/src/activity/activity.types.ts');
  assert.match(types, /new Set\(\['PERSONAL_CONVERSATION', 'QANDEEL_UNDERSTANDING', 'GENERAL_SETTINGS', 'SHARED_WORLD'\]\)/u);
  const service = code('apps/api/src/activity/activity.service.ts');
  assert.match(service, /if \(verdict\?\.outcome === 'ALLOW' && verdict\.world_id === worldId\) return \{ outcome: 'ENTER', destination: \{ kind: 'SHARED_WORLD', worldId \} \};/u);
  assert.match(service, /worldId !== row\.context_ref/u, 'never a World other than the item\'s own');
  assert.match(code('apps/api/src/activity/activity.repository.ts'), /'rpc\/resolve_own_shared_world_entry_v1'/u, 'the existing S4-01 entry verdict, on the caller\'s token');
  const mobileApi = code(`${MOBILE}/runtime-entry/activity-api.ts`);
  assert.match(mobileApi, /value\.kind === 'SHARED_WORLD' && hasExactly\(value, \['kind', 'worldId'\]\) && typeof value\.worldId === 'string' && UUID\.test\(value\.worldId\)/u);
  assert.doesNotMatch(mobileApi, /kind: 'REPLAY'/u);
  const composition = code(`${MOBILE}/integration/composition/DepthComposition.tsx`);
  assert.match(composition, /runtime\.sharedWorld\.openWorld\(destination\.worldId\);/u, 'the existing Shared controller — no second navigator');
  assert.match(composition, /if \(worldId !== null\) enter\(\{ kind: 'SHARED_WORLD', worldId \}\);/u, 'a link enters through the same Direct Entry');
  const link = code(`${MOBILE}/shared-world/shared-link.ts`);
  assert.match(link, /const SHARED_WORLD_LINK = \/\^qandeel:\\\/\\\/shared\\\/world\\\/\(\[0-9A-Fa-f-\]\{36\}\)\$\/u;/u, 'one strict form');
  const runtime = code(`${MOBILE}/integration/runtime/integration-runtime.ts`);
  assert.match(runtime, /if \(state\.kind === 'SIGNED_OUT' \|\| state\.kind === 'ERROR'\) sharedLinks\.drop\(\);/u, 'never held across accounts');
  assert.match(runtime, /if \(worldId !== null && !disposed && kind !== 'SIGNED_OUT' && kind !== 'ERROR'\) sharedLinks\.put\(worldId\);/u);
  // The push module still holds no deep-link handler of its own (A3-02 §7 keeps that).
  for (const file of readdirSync(new URL(`${MOBILE}/push/`, root)).filter((f) => /\.tsx?$/u.test(f))) {
    assert.doesNotMatch(code(`${MOBILE}/push/${file}`), /Linking\.(?:addEventListener|getInitialURL)/u, `${file}`);
  }
});

test('5 — first-entry education: the EXISTING sheet and copy, through push.offer, only on ALLOW, decided by the push controller', () => {
  const controller = code(`${MOBILE}/push/push-controller.ts`);
  assert.match(controller, /export type EducationMoment = 'PROACTIVE_ALLOW' \| 'DEVICE_SETTINGS' \| 'SHARED_FIRST_ENTRY';/u);
  assert.match(controller, /if \(askable && \(moment === 'DEVICE_SETTINGS' \|\| !store\.educationDeclined\(\)\)\)/u, 'a declined education is never pushed again automatically');
  const composition = code(`${MOBILE}/integration/composition/DepthComposition.tsx`);
  assert.equal((composition.match(/push\.offer\('SHARED_FIRST_ENTRY'\)/gu) ?? []).length, 1);
  assert.match(composition, /area !== 'SHARED_WORLD' \|\| sharedEntry !== 'ALLOW' \|\| permission === 'UNKNOWN'\) return;/u, 'never at launch, never on a refused entry');
  assert.doesNotMatch(code(`${MOBILE}/integration/runtime/integration-runtime.ts`), /offer\(/u, 'nothing asks at start');
  assert.equal((composition.match(/<PermissionEducationSheet /gu) ?? []).length, 1, 'the one existing sheet');
});

test('6 — the Shared Activity words: approved bytes reused from their sources; new rows only under ONE bounded gate', () => {
  const api = read(`${API}/shared-activity-copy.ts`);
  const lifecycle = read(`${MOBILE}/shared-world/lifecycle-copy.ts`);
  const shared = read(`${MOBILE}/shared-world/copy.ts`);
  const pair = (key) => {
    const m = new RegExp(`  ${key}: \\{ ar: '([^']*)', en: '([^']*)' \\}`, 'u').exec(api);
    assert.ok(m, `${key} is bound`);
    return [m[1], m[2]];
  };
  for (const key of ['proposalSettings', 'proposalRemoval', 'proposalEnd', 'proposalAdd', 'proposalRejoin', 'proposedBy', 'memberRequestAdd', 'memberRequestRejoin']) {
    const [ar, en] = pair(key);
    assert.ok(lifecycle.includes(`  ${key}: '${ar}', // APPROVED — S4-03 Product Copy Gate`), `${key} Arabic is the S4-03 approved bytes`);
    assert.ok(lifecycle.includes(`  ${key}: '${en}', // APPROVED — S4-03 Product Copy Gate`) || lifecycle.includes(`  ${key}: "${en}", // APPROVED — S4-03 Product Copy Gate`), `${key} English is the S4-03 approved bytes`);
  }
  const [someoneAr, someoneEn] = pair('someone');
  assert.ok(shared.includes(`someone: '${someoneAr}', // APPROVED — S4-01 Product Copy Gate`) && shared.includes(`someone: '${someoneEn}', // APPROVED — S4-01 Product Copy Gate`));
  assert.match(api, /ambient: LOCK_SCREEN_COPY\.generic\.SHARED as Bilingual,/u, 'p3.generic.shared, imported not copied');
  // S5-01 R1 re-anchor: the Product Owner approved `joined` (2026-10-06); the bytes are unchanged.
  assert.match(api, /status: 'S4-04 PRODUCT COPY GATE — CLOSED — 1 row APPROVED',/u, 'the one gate states its status');
  assert.match(api, /approved: \['joined'\],\n  proposed: \[\],/u);
  assert.match(api, /\/\*\* APPROVED — S4-04 Product Copy Gate \(Product Owner, 2026-10-06\)\. \{0\}: the person's own Name\. \*\/\n  joined: \{ ar: 'انضم \{0\} إلى هذا العالم\.', en: '\{0\} joined this world\.' \},/u);
  // The per-World row's state word is the approved p3.mutedWorld bytes.
  const registry = JSON.parse(read('docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/data/COPY_REGISTRY.json')).rows;
  const muted = registry.find((r) => r.k === 'p3.mutedWorld');
  const activity = read(`${MOBILE}/activity/copy.ts`);
  assert.ok(activity.includes(`mutedWorld: '${muted.ar}', // APPROVED — p3.mutedWorld`));
  assert.ok(activity.includes(`mutedWorld: '${muted.en}',`));
  // No permission copy is created: the education words stay A3-02's approved module, byte-pinned by its own contract.
  assert.doesNotMatch(code(`${MOBILE}/integration/composition/DepthComposition.tsx`), /eduTitle|eduBody/u);
});

test('7 — per-World mutes: current Worlds only, one World per act, presentation only', () => {
  const settings = code(`${MOBILE}/settings/NotificationsSection.tsx`);
  assert.match(settings, /onPress=\{\(\) => void controller\?\.setMuted\(world\.worldId, on\)\}/u);
  assert.match(settings, /labelOfWorld\(shared, world\)/u, 'the World\'s own label, the Shared root\'s words');
  const alerts = code(`${MOBILE}/shared-world/shared-alerts-controller.ts`);
  assert.match(alerts, /transport\.setAlerts\(worldId, muted\)/u);
  assert.doesNotMatch(alerts, /setMute\(|\/activity\/mutes/u, 'not the 0136 command that needs an existing item');
  const service = code(`${API}/shared-world-alerts.service.ts`);
  assert.match(service, /if \(Object\.keys\(value\)\.length !== 1 \|\| typeof value\.muted !== 'boolean'\) invalid\(\);/u);
  const census = read('apps/api/src/http-security/route-rate-limit.census.ts');
  assert.match(census, /'GET \/shared\/alerts': 'AUTHENTICATED',/u);
  assert.match(census, /'PUT \/shared\/worlds\/:worldId\/alerts': 'AUTHENTICATED',/u);
});

test('8 — the implementation record exists, keeps Replay out of scope and claims no merge', () => {
  const record = read(RECORD);
  assert.match(record, /\*\*Status:\*\* \*\*`S4-04 IMPLEMENTED — REVIEW CANDIDATE/u);
  assert.match(record, /Replay/u);
  assert.match(record, /Orphan gaps = 0/u);
  assert.doesNotMatch(record, /Status:[^\n]*MERGED \//u);
});
