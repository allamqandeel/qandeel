// INTEL-LIVE-01 CP2 — Live Call protocol v3 and the live map disclosure, statically: the server's and the phone's statements
// of v3 agree with each other and with docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v3.md; v1 and v2 keep exactly their meaning and
// statements; only what the database committed is disclosed; the phone's layer decides nothing; the stage amendment is
// D-5's and no more. The behaviour is proven by the API jest specs (live-call.protocol-v3.spec.ts,
// call-attention.disclosure.spec.ts, the gateway e2e spec) and the mobile jest suite.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = (p) => readFileSync(join(root, p), 'utf8').replace(/\r\n/gu, '\n');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

function loadTs(path, siblings = {}) {
  const { outputText } = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  const req = (name) => {
    if (!(name in siblings)) throw new Error(`unexpected import ${name} in ${path}`);
    return siblings[name];
  };
  new Function('exports', 'module', 'require', outputText)(module.exports, module, req);
  return module.exports;
}

const SERVER_V1 = loadTs('apps/api/src/voice/call/live-call.protocol.ts');
const PHONE_V1 = loadTs('apps/mobile/src/voice-call/live-call-protocol.ts');
const SERVER_V2 = loadTs('apps/api/src/voice/call/live-call.protocol-v2.ts', { './live-call.protocol': SERVER_V1 });
const PHONE_V2 = loadTs('apps/mobile/src/voice-call/live-call-protocol-v2.ts', { './live-call-protocol': PHONE_V1 });
const SERVER = loadTs('apps/api/src/voice/call/live-call.protocol-v3.ts', { './live-call.protocol': SERVER_V1, './live-call.protocol-v2': SERVER_V2 });
const PHONE = loadTs('apps/mobile/src/voice-call/live-call-protocol-v3.ts', { './live-call-protocol': PHONE_V1, './live-call-protocol-v2': PHONE_V2 });
const DOC = 'docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v3.md';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const HELLO = { type: 'HELLO', callId: U1, sessionId: U2, clientInstanceId: U1, resume: true };
const SUBJECT = { track: 'USER', subjectKey: 'travel_plan', label: 'خطة السفر', kind: 'PLAN', confidence: 'MEDIUM', threadRef: null };

test('one v3: the same subprotocol, version and message sets on both sides, all named by the document', () => {
  assert.equal(SERVER.LIVE_CALL_PROTOCOL_V3, 'qandeel.live-call.v3');
  assert.equal(PHONE.LIVE_CALL_PROTOCOL_V3, SERVER.LIVE_CALL_PROTOCOL_V3);
  assert.equal(SERVER.LIVE_CALL_PROTOCOL_V3_VERSION, 3);
  assert.equal(PHONE.LIVE_CALL_PROTOCOL_V3_VERSION, 3);
  assert.deepEqual([...SERVER.CLIENT_MESSAGES_V3], [...SERVER_V2.CLIENT_MESSAGES_V2], 'nothing new from the phone');
  assert.deepEqual([...SERVER.SERVER_MESSAGES_V3], [...SERVER_V2.SERVER_MESSAGES_V2, 'ATTENTION', 'ATTENTION_STATE']);
  assert.equal(SERVER.ATTENTION_STATE_ENTRIES_PER_PART, 12);
  assert.equal(PHONE.ATTENTION_STATE_ENTRIES_PER_PART, 12);
  const doc = read(DOC);
  for (const needle of ['qandeel.live-call.v3, qandeel.live-call.v2, qandeel.live-call.v1', 'qandeel.live-call.v3, qandeel.live-call.v1',
    'ATTENTION_STATE', 'Part 0 replaces the layer', 'Never a snapshot older than an event already sent', 'Audio first', 'NOCLOCK',
    'apps/api/src/voice/call/live-call.protocol-v3.ts', 'apps/mobile/src/voice-call/live-call-protocol-v3.ts', '0204_intel_live_01_call_attention_v1.sql']) {
    assert.ok(doc.includes(needle), `the document states ${needle}`);
  }
  for (const path of ['apps/api/src/voice/call/live-call.protocol-v3.ts', 'apps/mobile/src/voice-call/live-call-protocol-v3.ts']) {
    assert.match(read(path), /docs\/voice\/QANDEEL_LIVE_CALL_PROTOCOL_v3\.md/u, `${path} names its document`);
  }
});

test('v1 and v2 are frozen: their statements and documents carry nothing of v3', () => {
  for (const path of ['apps/api/src/voice/call/live-call.protocol.ts', 'apps/mobile/src/voice-call/live-call-protocol.ts', 'docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v1.md',
    'apps/api/src/voice/call/live-call.protocol-v2.ts', 'apps/mobile/src/voice-call/live-call-protocol-v2.ts', 'docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v2.md']) {
    assert.doesNotMatch(read(path), /ATTENTION|live-call\.v3/u, `${path} is untouched by v3`);
  }
  const frame = JSON.stringify({ type: 'ATTENTION', seq: 1, op: 'SET', ...SUBJECT, producedClockMs: 20 });
  assert.equal(PHONE_V1.parseServerMessage(frame), null);
  assert.equal(PHONE_V2.parseServerMessageV2(frame), null);
  assert.equal(SERVER_V2.parseClientMessageV2(JSON.stringify({ ...HELLO, v: 3 })), null, 'a v3 HELLO on a v2 connection is a violation');
  assert.equal(SERVER.parseClientMessageV3(JSON.stringify({ ...HELLO, v: 2 })), null, 'a v2 HELLO on a v3 connection is a violation');
  assert.deepEqual({ ...SERVER.parseClientMessageV3(JSON.stringify({ ...HELLO, v: 3 })) }, { ...HELLO, v: 3 });
  for (const m of [{ type: 'STATE', state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 40 }, { type: 'ACK', msgId: 3 }, { type: 'CLOCK_MARK', seq: 4 }]) {
    assert.deepEqual(PHONE.parseServerMessageV3(JSON.stringify(m)), PHONE_V2.parseServerMessageV2(JSON.stringify(m)));
  }
});

test('ATTENTION and ATTENTION_STATE: what the server writes the phone reads, and nothing else', () => {
  for (const op of ['SET', 'WITHDRAW', 'CONFIRMED', 'EXPIRED']) {
    const m = { type: 'ATTENTION', seq: 2 ** 40, op, ...SUBJECT, producedClockMs: op === 'SET' || op === 'WITHDRAW' ? 12_340 : null };
    assert.deepEqual(PHONE.parseServerMessageV3(SERVER.encodeServerMessageV3(m)), m);
  }
  const entries = Array.from({ length: 25 }, (_, i) => ({ ...SUBJECT, subjectKey: `s${i}`, threadRef: i % 2 ? U2 : null, seq: i + 1 }));
  const frames = SERVER.attentionStateFrames(30, entries);
  assert.deepEqual(frames.map((f) => [f.part, f.parts, f.entries.length]), [[0, 3, 12], [1, 3, 12], [2, 3, 1]]);
  for (const f of frames) {
    assert.deepEqual(PHONE.parseServerMessageV3(SERVER.encodeServerMessageV3(f)), f);
    assert.ok(Buffer.byteLength(SERVER.encodeServerMessageV3(f)) <= 4096);
  }
  assert.deepEqual(PHONE.parseServerMessageV3(SERVER.encodeServerMessageV3(SERVER.attentionStateFrames(0, [])[0])), { type: 'ATTENTION_STATE', seq: 0, part: 0, parts: 1, entries: [] });
});

test('the server discloses only what the database committed, after STATE ACTIVE, audio first, never awaited by the voice path', () => {
  const connection = code(read('apps/api/src/voice/call/live-call.connection.ts'));
  assert.match(connection, /if \(!this\.v3 \|\| this\.phase !== 'ACTIVE'\) return 'NOT_LISTENING';/u);
  assert.match(connection, /if \(this\.transport\.bufferedBytes > ATTENTION_OUTBOUND_LIMIT_BYTES\) return 'DROPPED';/u);
  const tracker = code(read('apps/api/src/live-attention/call-attention.tracker.ts'));
  assert.match(tracker, /if \(written\.outcome === 'RECORDED' && events !== null && written\.firstEventSeq !== null\) \{\n\s+this\.discloseEvents\(/u, 'an event only after its write committed');
  assert.match(tracker, /if \(seq < this\.sentSeq\) return false;/u, 'never a state older than an event already told');
  assert.doesNotMatch(tracker, /await [^;]*disclose/u, 'disclosure is never awaited');
  const gateway = read('apps/api/src/voice/call/gateway/live-call.gateway.ts');
  assert.match(gateway, /offered\.includes\(LIVE_CALL_PROTOCOL_V3\) \? LIVE_CALL_PROTOCOL_V3 : offered\.includes\(LIVE_CALL_PROTOCOL_V2\) \? LIVE_CALL_PROTOCOL_V2 : offered\.includes\(LIVE_CALL_PROTOCOL\) \? LIVE_CALL_PROTOCOL : null/u);
  // CP1's semantic freedom is unchanged: the configuration has exactly its keys, and no word, time or keyword threshold.
  const types = read('apps/api/src/live-attention/provisional-attention.types.ts');
  const keys = [...types.matchAll(/^\s{2}(\w+): [\w_.]+,$/gmu)].map((m) => m[1]);
  assert.deepEqual(keys.slice(0, 9), ['evaluatorTimeoutMs', 'failuresBeforeBackoff', 'backoffMs', 'permitRetryMs', 'maxTurnTextWords', 'maxOpenSubjects', 'maxThreads', 'emergencyCallSpendUsd', 'overloadedFailuresBeforeDegraded']);
  for (const path of ['apps/api/src/voice/call/live-call.protocol-v3.ts', 'apps/api/src/live-attention/call-attention.tracker.ts', 'apps/api/src/live-attention/live-attention.provider.ts']) {
    assert.doesNotMatch(code(read(path)), /console\.|Logger|\.log\(/u, `${path} logs nothing`);
  }
});

test('the phone: v3 offered first on both platforms; the layer decides nothing and keeps nothing', () => {
  const client = read('apps/mobile/src/voice-call/live-call-client.ts');
  assert.match(client, /this\.v3 = this\.options\.offerAttention === true && socket\.protocol === LIVE_CALL_PROTOCOL_V3;/u, 'the server\'s selection decides');
  assert.match(client, /this\.v2 = this\.options\.offerClockMarks === true && socket\.protocol === LIVE_CALL_PROTOCOL_V2;/u, 'v2 unchanged');
  assert.match(client, /if \(!\(this\.v2 \|\| this\.v3\) \|\| this\.ended \|\| !this\.canSendLive\(\)\) return;/u, 'a v3 mark is answered, NOCLOCK on iOS');
  assert.match(read('apps/mobile/src/call/call-owner.ts'), /offerAttention: true,/u);
  const layer = code(read('apps/mobile/src/call/provisional-attention.ts'));
  assert.doesNotMatch(layer, /setTimeout|setInterval|debounce|throttle|AsyncStorage|SecureStore|fetch\(|console\./u, 'no timer, no persistence, no I/O, no log');
  assert.match(layer, /if \(message\.seq <= this\.layer\.seq\) return false;/u, 'a duplicate or stale event changes nothing');
  assert.match(layer, /message\.seq >= this\.layer\.seq/u, 'an older snapshot never moves the layer backwards');
  const owner = code(read('apps/mobile/src/call/call-owner.ts'));
  assert.match(owner, /attention = new ProvisionalAttention\(now\);/u, 'each call starts empty');
  assert.match(owner, /attention = null;\n\s+if \(shown\) attentionChanged\(\);/u, 'the end drops the layer');
});

test('COSMOS D-5: the attention marks are the approved amendment and no more', () => {
  const stage = read('apps/mobile/src/cosmos/core/stage.ts');
  assert.match(stage, /an attention mark is not an entity: it emits no body and no line, is\n\/\/\s+drawn only in the warm role tint or as a glow of a real body, and vanishes when withdrawn, settled or at call end\./u);
  assert.match(stage, /readonly attention\?: readonly AttentionMark\[\];/u);
  assert.match(stage, /export const ATTENTION_MARKS_PER_RUNG = 12;/u);
  const attend = stage.slice(stage.indexOf('function attend('), stage.indexOf('function digestOf('));
  assert.ok(attend.length > 0);
  assert.doesNotMatch(attend, /hits\.push|line\(|strand|nebula|TINT\.GOLD|SPRITE\.HALO|SPRITE\.FIBRE|emphasis: true|major: true/u, 'no hit, no line, no body, no gold, no title');
  assert.match(attend, /put\(body\.x, body\.y, body\.halo \* 1\.6, SPRITE\.PUFF, entity\.dye, 0\.28\);/u, 'the glow: the body\'s own dye');
  assert.match(attend, /put\(x, y, 14, SPRITE\.SPARK, TINT\.WARM, 0\.6\);/u, 'the ember');
  assert.match(stage, /if \(input\.attention !== undefined && input\.attention\.length > 0\) attend\(/u, 'undefined or empty: byte-identical');
  // Prompt v5 is not touched by the visual work (F-4): the evaluator's prompt keeps its version.
  assert.match(read('apps/api/src/live-attention/deepseek-attention-evaluator.ts'), /v5/u);
});
