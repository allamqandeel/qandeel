// S8B-06 CP3 — the call UI, the Living Map during a call and the device closure (contract v1.2 Part A → A1 → v1.1 → v1.0
// §§9–12, A6 06-CP3, D-05-02 / 03 / 06 / 07, acceptance #14 / #22 / #23 / #24 / #40, QAN-BL-VOICE-01 / 06). A static pin of
// what CP3 shipped, so a later change cannot quietly undo it:
//
//   Owner     ONE in-memory call owner (apps/mobile/src/call/), above DepthComposition, built once per runtime generation
//             and retired with it; the only Product constructor of CP2's LiveCallController. No socket in runtime-entry/
//             or integration/: the call's one WebSocket stays the voice-call client's.
//   Truth     the server's `GET /voice/calls/truth`, read by one thin client; the call-safe decision reads the owner.
//   Map       analysis-first: a committed call turn or a reply's end asks the Foreground Live Driver for a catch-up; no
//             analysis on the phone, no new engine.
//   T1        typed during a call: TEXT_TURN on the call's channel through the Conversation's ONE transport.
//   Copy      every call row is the CP3 record's §4 gate row, character for character, and still PROPOSED (D-05-03).
//   Audio     no audio file and no TTS call: F-01 / T-5 / T-1 assets wait on a separate Product Owner approval; CP2's local
//             warning tone is unchanged.
//
// Behaviour is proven by the Jest suites this contract requires to exist (the owner, the transport, the views), and on the
// device by the CP3 record's acceptance matrix.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(join(root, file), 'utf8');
const strip = (code) => code.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/gu, '$1');
const walk = (dir) => readdirSync(join(root, dir), { recursive: true }).map((f) => `${dir}/${String(f).replace(/\\/gu, '/')}`);
const production = (dir) => walk(dir).filter((p) => /\.(?:ts|tsx)$/u.test(p) && !/\/__(?:tests|fixtures|validation)__\//u.test(p));

const MOBILE = 'apps/mobile/src';
const CALL = `${MOBILE}/call`;
const RECORD = 'docs/e2e/QANDEEL_S8B_06_CALL_UI_LIVE_MAP_DEVICE_CLOSURE_RECORD_v1.md';
const COPY_FILE = `${MOBILE}/voice-call/live-call-copy.ts`;
const RUNTIME = `${MOBILE}/integration/runtime/integration-runtime.ts`;
const DEPTH = `${MOBILE}/integration/composition/DepthComposition.tsx`;

const gateRows = () => {
  const record = read(RECORD);
  return record.slice(record.indexOf('## 4. The Copy Gate')).split('\n')
    .filter((line) => /^\| (?:LC|LCE)-\d{2} \|/u.test(line))
    .map((line) => line.split('|').map((cell) => cell.trim()));
};
const copyRows = () => [...read(COPY_FILE).matchAll(/\{ id: '(LCE?-\d{2})', status: '(\w+)', ar: '([^']*)', en: (?:'([^']*)'|"([^"]*)") \}/gu)]
  .map(([, id, status, ar, single, double]) => ({ id, status, ar, en: single ?? double }));

test('the Copy Gate: the phone carries exactly the CP3 record\'s §4 rows, both ways, every one PROPOSED', () => {
  const gate = gateRows();
  const phone = copyRows();
  assert.equal(phone.length, (read(COPY_FILE).match(/\bid: '/gu) ?? []).length, 'every row of the copy table is read');
  assert.deepEqual(phone.map((r) => r.id).sort(), gate.map((cells) => cells[1]).sort(), 'the same ids, no more and no fewer');
  for (const cells of gate) {
    assert.equal(cells[2], 'PROPOSED', `${cells[1]} is PROPOSED in the gate: this record approves no copy`);
    const row = phone.find((r) => r.id === cells[1]);
    assert.equal(row.status, 'PROPOSED', `${cells[1]} is PROPOSED on the phone`);
    assert.equal(row.ar, cells[3], `${cells[1]} Arabic, character for character`);
    assert.equal(row.en, cells[4], `${cells[1]} English, character for character`);
  }
  const record = read(RECORD);
  assert.match(record, /\*\*Register \(the Product Owner's direction, 2026-11-04\):\*\* the Arabic is simplified, neutral Modern Standard Arabic, not\ncolloquial\./u);
  assert.match(record, /\*\*Gate status: (?:OPEN|CLOSED)\*\*/u);
});

test('the native surface and the call screen read these exact rows (the counter-test of the CP2 Jest re-anchor)', () => {
  const copy = strip(read(COPY_FILE));
  const surface = copy.slice(copy.indexOf('export function liveCallSurfaceCopy'), copy.indexOf('export type LiveCallNotice'));
  const lines = Object.fromEntries([...surface.matchAll(/(\w+): t\('(LCE?-\d{2})'\)/gu)].map((m) => [m[1], m[2]]));
  assert.deepEqual(lines, {
    displayName: 'LC-12', notificationTitle: 'LC-12', channelName: 'LC-20', ongoing: 'LC-11', reconnecting: 'LC-04',
    held: 'LC-10', warningT5: 'LC-06', warningT1: 'LC-07', notificationT5: 'LC-13', notificationT1: 'LC-19',
  }, 'CP2\'s two borrowed rows are replaced by rows of their own (channel LC-20, T-1 notification LC-19)');
  const screen = copy.slice(copy.indexOf('export function liveCallScreenCopy'));
  assert.match(screen, /disclosure: t\('LC-01'\)/u, 'the recording disclosure is LC-01 (VOICE_RECORDING_V3, 30 days from the start)');
  assert.match(screen, /recordStopped: t\('LC-21'\)/u);
  assert.match(screen, /interrupted: t\('LC-15'\)/u);
  assert.match(screen, /speaking: t\('LC-22'\)/u);
});

test('one call owner, above the composition, built once per generation and retired with it', () => {
  const runtime = strip(read(RUNTIME));
  assert.equal((runtime.match(/createCallOwner\(/gu) ?? []).length, 1, 'one owner per generation');
  assert.match(runtime, /session\.call\.retire\(\);/u, 'retired with the generation');
  assert.match(runtime, /onCallTurn: \(\) => \{\n\s*built\.conversation\.ensureHistory\(\);\n\s*built\.liveDriver\.requestImmediateCatchUp\(\);\n\s*\}/u,
    'a committed call turn or reply end refreshes the thread and asks for the analysis catch-up');
  const mobile = production(MOBILE);
  const constructors = mobile.filter((p) => !p.includes('/voice-call/') && /new LiveCallController\(/u.test(strip(read(p))));
  assert.deepEqual(constructors, [`${CALL}/call-owner.ts`], 'the owner is the only Product constructor of the call');
  for (const dir of [`${MOBILE}/runtime-entry`, `${MOBILE}/integration`, CALL]) {
    for (const path of production(dir)) {
      assert.doesNotMatch(strip(read(path)), /\bWebSocket\b|new WebSocket|socket\.io/u, `${path} opens no socket`);
    }
  }
  for (const path of production(`${MOBILE}/integration`)) {
    assert.doesNotMatch(strip(read(path)), /from '\.\.\/\.\.\/voice-call\//u, `${path} reaches the call only through call/`);
  }
  const depth = strip(read(DEPTH));
  assert.equal((depth.match(/<CallLine\b/gu) ?? []).length, 1, 'one call line, in the Analysis\'s call box');
  assert.equal((depth.match(/<CallSafeStrip\b/gu) ?? []).length, 1);
});

test('analysis-first: the call module runs no analysis and starts no engine', () => {
  for (const path of production(CALL)) {
    const code = strip(read(path));
    assert.doesNotMatch(code, /from '\.\.\/(?:projection|map|understanding|temporal|human-model|semantic)/u, `${path} imports no analysis layer`);
    assert.doesNotMatch(code, /console\.(?:log|info|debug|warn)/u, `${path} logs nothing (no transcript, no audio)`);
  }
});

test('T1 (D-05-07): typed during a call rides the call, through the Conversation\'s ONE transport', () => {
  const transport = strip(read(`${CALL}/call-text-transport.ts`));
  assert.match(transport, /if \(submission\.idempotencyKey\.startsWith\(LIVE_CALL_KEY_PREFIX\)\)/u, 'a committed call turn is never issued again');
  assert.match(transport, /return outcome\.kind === 'WRITE_NORMALLY' \? base\.submitTurn\(sessionId, submission\) : outcome;/u, 'the ordinary route, once, under the same key');
  const owner = strip(read(`${CALL}/call-owner.ts`));
  assert.match(owner, /export const LIVE_CALL_KEY_PREFIX = 'live-call:';/u, 'the server\'s own call-turn key (0190 / 0191)');
  const session = strip(read(`${MOBILE}/voice-call/live-call-session.ts`));
  assert.match(session, /if \(this\.audibleTurn !== null && this\.engine\.cutReply\?\.\(\) === true\) this\.textCuts \+= 1;/u, 'sending cuts QANDEEL; typing does not');
  assert.match(session, /this\.flushPlayout\('CUT'\);\n\s*return this\.client\.sendText\(clientTurnId, text\);/u, 'PLAYOUT before TEXT_TURN');
  assert.doesNotMatch(strip(read(`${CALL}/CallViews.tsx`)), /onChangeText|sendText/u, 'the call line never watches typing');
});

test('the call screen: the disclosure in CONNECTING only, the J3 crossing, the record never interactive', () => {
  const views = strip(read(`${CALL}/CallViews.tsx`));
  assert.match(views, /case 'CONNECTING':\n\s*return \[copy\.connecting, copy\.disclosure\];/u);
  assert.equal((views.match(/copy\.disclosure/gu) ?? []).length, 1, 'the disclosure is shown in one place');
  const record = views.slice(views.indexOf('export function CallRecordRow'), views.indexOf('export function InterruptedMark'));
  assert.doesNotMatch(record, /onPress|<Control\b|accessibilityRole="button"/u, 'the record (J7) is never interactive');
  const depth = strip(read(DEPTH));
  assert.match(depth, /unchosenEnds/u, 'an end the person did not choose returns to the Conversation (J3)');
});

test('no audio file, no TTS call, the CP2 tone kept', () => {
  const mobileFiles = walk('apps/mobile').filter((p) => !p.includes('node_modules') && !p.includes('/android/') && !p.includes('/ios/build'));
  assert.deepEqual(mobileFiles.filter((p) => /\.(?:mp3|wav|ogg|opus|m4a|aac)$/iu.test(p)), [], 'no audio asset ships in CP3');
  for (const path of production(CALL)) assert.doesNotMatch(strip(read(path)), /tts|gemini|achird|speechmatics/iu, `${path} names no audio provider`);
});

test('the Jest proofs exist, and the contract is registered once', () => {
  for (const spec of ['call-owner.test.ts']) assert.ok(existsSync(join(root, `${CALL}/__tests__/${spec}`)), `${spec} exists`);
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['test:s8b-06-cp3-call-ui-contract'], 'node --test tests/s8b-06-cp3-call-ui-contract.test.mjs');
  const mobile = read('.github/workflows/mobile-ci.yml');
  assert.equal((mobile.match(/run: npm run test:s8b-06-cp3-call-ui-contract\}/gu) ?? []).length, 1, 'one gate step');
  assert.equal((mobile.match(/'tests\/s8b-06-cp3-call-ui-contract\.test\.mjs'/gu) ?? []).length, 1, 'one trigger path');
});
