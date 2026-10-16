// S6-05 (CP5, the last checkpoint) — the mobile Introduction experience, static contract.
//
// It proves the repository shape the Product Owner authorized for CP5: the approved S6-05 copy is used word for word (the
// gate record's 30 APPROVED rows; M-12 nowhere); the Introduction World is reached through ONE strict client of the
// existing CP3 / CP4 / S6-02 routes and the existing Shared owner deletion, with no server, migration or API change; the
// acceptance is offered only when the server offers ACCEPT; IW-35 is drawn only on the server's own ended answer; V-1 is
// structural (the existing selectedMarker at its markerThickness, no new colour); and nothing in the Introduction
// surfaces reaches QANDEEL's reply, Living Analysis, Manage World, Activity or Push. Live behaviour is proven by the
// jest-expo suite apps/mobile/src/introductions/__tests__/introduction-world.test.tsx and, on the server, by
// verify-migration-0159 / 0160 / 0161 and their PostgREST proofs.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const MOBILE = 'apps/mobile/src';
const INTRO = `${MOBILE}/introductions`;
const CLIENT = `${MOBILE}/runtime-entry/introduction-worlds-api.ts`;
const CP5_FILES = [
  `${CLIENT}`, `${INTRO}/introduction-world-controller.ts`, `${INTRO}/introduction-world-copy.ts`, `${INTRO}/IntroductionWorldSurface.tsx`,
  `${INTRO}/IntroductionWorldCards.tsx`,
];
const GATE = read('docs/e2e/QANDEEL_S6_05_VISUAL_COPY_GATE_v1.md');

test('1 — the copy is the Copy Gate record\'s 30 APPROVED rows word for word; M-12 is used nowhere', () => {
  const approved = new Map();
  for (const line of GATE.split(/\r?\n/u)) {
    if (!/^\| (IW|M)-/u.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    approved.set(cells[0].split(' ')[0], { ar: cells[2], en: cells[3], status: cells[4] });
  }
  const copy = read(`${INTRO}/introduction-world-copy.ts`);
  const rows = [...copy.matchAll(/^ {2}(\w+): \{ id: '([^']+)', ar: ("(?:[^"\\]|\\.)*"), en: ("(?:[^"\\]|\\.)*") \}, \/\/ APPROVED — S6-05 Copy Gate/gmu)];
  assert.equal(rows.length, 30, 'thirty rows, each marked APPROVED');
  for (const [, , id, ar, en] of rows) {
    const row = approved.get(id);
    assert.match(row?.status ?? '', /^APPROVED/u, `${id} is APPROVED in the record`);
    assert.equal(JSON.parse(ar), row.ar.replace('{الاسم الأول}', '{0}'), `${id} Arabic`);
    assert.equal(JSON.parse(en), row.en.replace('{first name}', '{0}'), `${id} English`);
  }
  assert.match(approved.get('M-12').status, /^Not used \(R-2\)/u);
  // Production files only: the suite names the phrase to prove it is absent.
  for (const file of readdirSync(new URL(`${MOBILE}/`, root), { recursive: true }).filter((f) => /\.(ts|tsx)$/u.test(String(f)) && !/__tests__/u.test(String(f)))) {
    assert.doesNotMatch(read(`${MOBILE}/${String(file).replace(/\\/gu, '/')}`), /أنا معكما في البداية|I'm with you at the start/u, `${file} carries no M-12`);
  }
  assert.match(GATE, /\*\*VISUAL GATE CLOSED — COPY GATE CLOSED\*\*/u, 'both gates stay closed');
});

test('2 — one strict client of the existing routes: CP3 / CP4 reads and send, the S6-02 END; no identity, counterpart or audience', () => {
  const client = code(CLIENT);
  assert.deepEqual([...client.matchAll(/'(GET|POST)', (?:`([^`]+)`|'([^']+)')/gu)].map((m) => `${m[1]} ${m[2] ?? m[3]}`), [
    'GET /introductions/worlds',
    'POST /introductions/worlds/${encodeURIComponent(worldId)}/messages',
    'POST /introductions/worlds/${encodeURIComponent(worldId)}/end',
  ]);
  assert.match(client, /pagePath\(worldId, 'messages', before\)/u);
  assert.match(client, /pagePath\(worldId, 'history', before\)/u);
  assert.match(client, /\{ commandId, content \}/u, 'a message is exactly { commandId, content }');
  assert.match(client, /\{ commandId \}\);/u, 'END is exactly { commandId }');
  assert.doesNotMatch(client, /userId|user_id|counterpart|audience|authorName|accountName|retry\(|setTimeout|AsyncStorage|SecureStore/u);
  assert.match(client, /hasExactly\(value, \['worldId', 'proposalId', 'state', 'otherFirstName'\]\)/u, 'a World is exactly what the server answers');
  assert.match(client, /canDelete !== \(producer === 'SELF'\)/u, 'only the author may delete');
  // ENDED is a bare, exact server answer — never a transport failure.
  assert.match(client, /bareOutcome\(answer\.body, \['ENDED', 'UNAVAILABLE'\] as const\) \?\? 'FAILED'/u);
  assert.match(client, /bareOutcome\(body, \['ENDED', 'UNAVAILABLE', 'COMMAND_CONFLICT'\] as const\) \?\? 'FAILED'/u);
  assert.match(client, /if \(answer\.kind === 'NETWORK'\) return \{ kind: 'OFFLINE' \};/u);
  // Deletion is the existing Shared owner deletion (R-5), never a second route.
  const runtime = code(`${MOBILE}/integration/runtime/integration-runtime.ts`);
  assert.match(runtime, /createIntroductionWorldsController\(\{ transport: entry\.introductionWorldsFor\(bundle\), deletion: shared, isCurrent, foreground: entry\.foreground \}\)/u);
  assert.match(runtime, /session\.introductionWorlds\.retire\(\);/u, 'retired with the generation');
  assert.doesNotMatch(client, /\/delete|deleteMaterial|deleteOwn/u, 'the client has no deletion of its own');
});

test('3 — the acceptance: offered only when the server offers ACCEPT; bound to the view; MATCHED alone names a World', () => {
  const api = code(`${MOBILE}/runtime-entry/introduction-proposals-api.ts`);
  assert.match(api, /`\/introductions\/proposals\/\$\{encodeURIComponent\(proposalId\)\}\/acceptance`, \{ commandId, viewId \}/u);
  assert.match(api, /outcome === 'MATCHED' \? typeof worldId !== 'string' \|\| !UUID\.test\(worldId\) : worldId !== null/u);
  const controller = code(`${INTRO}/proposals-controller.ts`);
  assert.match(controller, /!shown\.actions\.includes\('ACCEPT'\)/u, 'only an offered acceptance');
  assert.match(controller, /const id = pending !== null && pending\.key === key \? pending\.id : newCommandId\(\);/u, 'a lost answer keeps its id');
  const surface = code(`${INTRO}/ProposalsSurface.tsx`);
  assert.match(surface, /offered\.includes\('ACCEPT'\) \?/u, 'IW-01 only when offered');
  assert.match(surface, /const declineOnly = !forward && !accept && proposal\.actions\.includes\('DECLINE'\);/u, 'acceptNotYet stays while ACCEPT is not offered');
});

test('4 — IW-35 only on the server\'s own ended answer; a lost message or END keeps its command id', () => {
  const controller = code(`${INTRO}/introduction-world-controller.ts`);
  const send = controller.slice(controller.indexOf('const dispatchSend'), controller.indexOf('const unsubscribeForeground'));
  assert.equal((send.match(/status: 'ENDED'/gu) ?? []).length, 2, 'the ended pending state is set only in the ENDED branch');
  assert.match(send, /case 'ENDED':/u);
  // A transport failure keeps the pending message's command id (sendId is not cleared) and is never ENDED.
  assert.match(send, /default:\n\s+patch\(token, worldId, \{ pending: Object\.freeze\(\{ text, status: answer\.kind === 'OFFLINE' \? 'OFFLINE' : 'FAILED' \}\) \}\);\n\s+\}/u);
  const surface = code(`${INTRO}/IntroductionWorldSurface.tsx`);
  assert.equal((surface.match(/copy\.sendEnded/gu) ?? []).length, 1, 'IW-35 is drawn in one place');
  assert.match(surface, /pending\.status === 'ENDED' \? \(/u, 'and only for the ENDED pending state');
  assert.match(controller, /if \(endId === null\) endId = newCommandId\(\);/u, 'END keeps its id until answered');
});

test('5 — V-1 is structural: the existing selectedMarker at its markerThickness; no colour literal in any CP5 file', () => {
  for (const file of [`${INTRO}/IntroductionWorldSurface.tsx`, `${INTRO}/IntroductionWorldCards.tsx`, `${INTRO}/ProposalsSurface.tsx`]) {
    const text = code(file);
    assert.doesNotMatch(text, /#[0-9a-f]{3,8}\b|rgba?\(/iu, `${file} adds no colour`);
  }
  for (const file of [`${INTRO}/IntroductionWorldSurface.tsx`, `${INTRO}/IntroductionWorldCards.tsx`, `${INTRO}/ProposalsSurface.tsx`]) {
    assert.match(code(file), /borderStartWidth: palette\.markerThickness, borderStartColor: palette\.selectedMarker/u, `${file} draws the seam from the existing tokens`);
  }
});

test('6 — an Introduction is never a Standard Shared World: no reply, Living Analysis, Manage World, Activity, Push or AI', () => {
  for (const file of CP5_FILES) {
    const text = code(file);
    assert.doesNotMatch(text, /from '\.\.\/(?:activity|push|living-analysis|map|understanding)'|SharedLivingAnalysis|SharedManagePage|shared-world-controller'|model-router|qandeelTurnName|waitingForReply|replyFailed|Activity|Push/u,
      `${file} reaches no reply, analysis, management, Activity or Push`);
  }
  const area = code(`${MOBILE}/shared-world/SharedWorldArea.tsx`);
  assert.match(area, /if \(introduction !== null && introductions !== undefined\) \{\n\s+return \(\n\s+<View testID=\{SHARED_AREA_TEST_ID\}[^\n]*\n\s+<IntroductionWorldSurface /u, 'an Introduction opens its own surface');
  const surface = code(`${INTRO}/IntroductionWorldSurface.tsx`);
  assert.doesNotMatch(surface, /openManage|manageWorld|membersHeading|openConversation|LivingAnalysis/u, 'tools are back and END only (D4)');
});

test('7 — the mobile suite, the contract and the toolchain', () => {
  const suite = read(`${INTRO}/__tests__/introduction-world.test.tsx`);
  for (const name of ['the S6-05 Copy Gate, word for word', 'S15a:', 'S15b:', 'S10 / S11 / S12:', 'S4: the first party', 'S5: a live Introduction']) {
    assert.ok(suite.includes(name), `the suite proves ${name}`);
  }
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['test:s6-05-introduction-mobile-contract'], 'node --test tests/s6-05-introduction-mobile-contract.test.mjs');
  assert.match(read('.github/workflows/api-ci.yml'), /run: npm run test:s6-05-introduction-mobile-contract\}/u);
});
