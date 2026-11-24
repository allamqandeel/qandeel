// S8B-07 RB-2 / M-2 (CP3) — Live Call protocol v2, statically: the server's and the phone's statements of v2 agree with
// each other and with docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v2.md; every v1 message keeps exactly its v1 meaning; the frozen
// v1 statements are untouched; only Android ever offers v2 (iOS stays fail-closed). The behaviour is proven by the API jest
// specs (live-call.clock-marks.spec.ts, the gateway e2e spec), the mobile jest suite and database/verify-migration-0203.mjs.
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

/** Loads a TypeScript module whose only imports are the given siblings. */
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

const SERVER_V1_PATH = 'apps/api/src/voice/call/live-call.protocol.ts';
const PHONE_V1_PATH = 'apps/mobile/src/voice-call/live-call-protocol.ts';
const SERVER_V1 = loadTs(SERVER_V1_PATH);
const PHONE_V1 = loadTs(PHONE_V1_PATH);
const SERVER = loadTs('apps/api/src/voice/call/live-call.protocol-v2.ts', { './live-call.protocol': SERVER_V1 });
const PHONE = loadTs('apps/mobile/src/voice-call/live-call-protocol-v2.ts', { './live-call-protocol': PHONE_V1 });
const DOC = 'docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v2.md';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const HELLO = { type: 'HELLO', callId: U1, sessionId: U2, clientInstanceId: U1, resume: false };
const V1_CLIENT = [
  { type: 'HEARTBEAT', n: 0 }, { type: 'MUTE', msgId: 1, captureMs: 40 }, { type: 'UNMUTE', msgId: 2, captureMs: 1000 },
  { type: 'TOKEN_REFRESH', msgId: 3, accessToken: 'abc.def.ghi' }, { type: 'END', msgId: 4 },
  { type: 'PLAYOUT', msgId: 5, callTurnIndex: 2, chunkSeq: 9, playedMs: 200 }, { type: 'BARGE_IN', msgId: 6, callTurnIndex: 2, captureMs: 1240 },
  { type: 'TEXT_TURN', msgId: 7, clientTurnId: U2, text: 'مرحبا' },
];

test('one v2: the same subprotocol, version and message sets on both sides, all named by the document', () => {
  assert.equal(SERVER.LIVE_CALL_PROTOCOL_V2, 'qandeel.live-call.v2');
  assert.equal(PHONE.LIVE_CALL_PROTOCOL_V2, SERVER.LIVE_CALL_PROTOCOL_V2);
  assert.equal(SERVER.LIVE_CALL_PROTOCOL_V2_VERSION, 2);
  assert.equal(PHONE.LIVE_CALL_PROTOCOL_V2_VERSION, 2);
  assert.deepEqual([...SERVER.CLIENT_MESSAGES_V2], [...SERVER_V1.CLIENT_MESSAGES, 'MARK_ECHO']);
  assert.deepEqual([...SERVER.SERVER_MESSAGES_V2], [...SERVER_V1.SERVER_MESSAGES, 'CLOCK_MARK']);
  assert.deepEqual({ ...SERVER.CLOCK_MARK_POLICY }, { periodMs: 1000, slots: 10, slotMs: 100, echoLifetimeMs: 10000, androidMarginMs: 100, maxEchoesPerBatch: 1000 });
  const doc = read(DOC);
  for (const needle of ['qandeel.live-call.v2, qandeel.live-call.v1', 'CLOCK_MARK', 'MARK_ECHO', 'NOCLOCK', '100 ms', 'iOS offers v1 only',
    'never derives a position by continuing the pre-hold frame index', 'apps/api/src/voice/call/live-call.protocol-v2.ts',
    'apps/mobile/src/voice-call/live-call-protocol-v2.ts', '0203_s8b_07_live_call_clock_marks_v1.sql']) assert.ok(doc.includes(needle), `the document states ${needle}`);
  for (const path of ['apps/api/src/voice/call/live-call.protocol-v2.ts', 'apps/mobile/src/voice-call/live-call-protocol-v2.ts']) {
    assert.match(read(path), /docs\/voice\/QANDEEL_LIVE_CALL_PROTOCOL_v2\.md/u, `${path} names its document`);
  }
});

test('v1 is frozen: its statements and document carry nothing of v2', () => {
  for (const path of [SERVER_V1_PATH, PHONE_V1_PATH, 'docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v1.md']) {
    assert.doesNotMatch(read(path), /CLOCK_MARK|MARK_ECHO|live-call\.v2/u, `${path} is untouched by v2`);
  }
  assert.equal(SERVER_V1.parseClientMessage(JSON.stringify({ type: 'MARK_ECHO', seq: 1, captureMs: 20 })), null, 'MARK_ECHO is not a v1 message');
  assert.equal(PHONE_V1.parseServerMessage(JSON.stringify({ type: 'CLOCK_MARK', seq: 1 })), null, 'CLOCK_MARK is not a v1 message');
});

test('every v1 message keeps its v1 meaning under v2; HELLO must say v: 2 under v2 and v: 1 under v1', () => {
  for (const m of V1_CLIENT) {
    const text = JSON.stringify(m);
    assert.deepEqual({ ...SERVER.parseClientMessageV2(text) }, { ...SERVER_V1.parseClientMessage(text) }, text);
    assert.equal(SERVER.parseClientMessageV2(JSON.stringify({ ...m, extra: 1 })), null);
  }
  assert.equal(SERVER.parseClientMessageV2(JSON.stringify({ ...HELLO, v: 1 })), null, 'a v1 HELLO on a v2 connection is a violation');
  assert.deepEqual({ ...SERVER.parseClientMessageV2(JSON.stringify({ ...HELLO, v: 2 })) }, { ...HELLO, v: 2 });
  assert.equal(SERVER_V1.parseClientMessage(JSON.stringify({ ...HELLO, v: 2 })), null, 'a v2 HELLO on a v1 connection is a violation');
  assert.equal(SERVER.parseClientMessageV2(JSON.stringify({ ...HELLO, v: 2, extra: 1 })), null);
  for (const m of [{ type: 'STATE', state: 'ACTIVE', epoch: 1, resumeFromCaptureMs: 0 }, { type: 'ACK', msgId: 3 }]) {
    const text = JSON.stringify(m);
    assert.deepEqual(PHONE.parseServerMessageV2(text), PHONE_V1.parseServerMessage(text), text);
  }
});

test('CLOCK_MARK and MARK_ECHO: what one side writes the other reads, and nothing else', () => {
  for (const seq of [1, 2, 0xffffffff]) {
    assert.deepEqual(PHONE.parseServerMessageV2(SERVER.encodeServerMessageV2({ type: 'CLOCK_MARK', seq })), { type: 'CLOCK_MARK', seq });
    for (const captureMs of [0, 20, 1240, 0xffffffff - 15, null]) {
      if (captureMs !== null && captureMs % 20 !== 0) continue;
      assert.deepEqual({ ...SERVER.parseClientMessageV2(PHONE.encodeMarkEcho(seq, captureMs)) }, { type: 'MARK_ECHO', seq, captureMs });
    }
  }
  for (const bad of [{ seq: 0 }, { seq: -1 }, { seq: 1.5 }, { seq: '1' }, { seq: 1, at: 2 }, {}]) {
    assert.equal(PHONE.parseServerMessageV2(JSON.stringify({ type: 'CLOCK_MARK', ...bad })), null, JSON.stringify(bad));
  }
  for (const bad of [{ seq: 1, captureMs: 30 }, { seq: 1, captureMs: -20 }, { seq: 0, captureMs: 20 }, { seq: 1 }, { seq: 1, captureMs: 20, x: 1 },
    { seq: 1, captureMs: '20' }, { captureMs: 20 }, { seq: 1, captureMs: 0x100000000 }]) {
    assert.equal(SERVER.parseClientMessageV2(JSON.stringify({ type: 'MARK_ECHO', ...bad })), null, JSON.stringify(bad));
  }
  for (const [seq, captureMs] of [[0, 20], [1, 30], [1, -20]]) assert.throws(() => PHONE.encodeMarkEcho(seq, captureMs), RangeError);
});

test('negotiation: the server selects v2 only when offered; only Android offers it; the fake v1 gateway answers v1', () => {
  const gateway = read('apps/api/src/voice/call/gateway/live-call.gateway.ts');
  assert.match(gateway, /offered\.includes\(LIVE_CALL_PROTOCOL_V2\) \? LIVE_CALL_PROTOCOL_V2 : offered\.includes\(LIVE_CALL_PROTOCOL\) \? LIVE_CALL_PROTOCOL : null/u);
  assert.match(gateway, /`Sec-WebSocket-Protocol: \$\{selected\}`/u);
  const engine = read('apps/mobile/src/voice-call/voice-call-engine.ts');
  assert.match(engine, /Platform\.OS === 'android' && typeof native\.clockMark === 'function'/u, 'only the Android engine exposes clockMark');
  const session = read('apps/mobile/src/voice-call/live-call-session.ts');
  assert.match(session, /offerClockMarks: typeof options\.engine\.clockMark === 'function'/u, 'v2 is offered only by an engine with clockMark');
  const client = read('apps/mobile/src/voice-call/live-call-client.ts');
  assert.match(client, /this\.v2 = this\.options\.offerClockMarks === true && socket\.protocol === LIVE_CALL_PROTOCOL_V2;/u, 'the server\'s selection decides');
  for (const path of ['Expo/QandeelVoiceCallModule.swift', 'Core/IOSCallEngine.swift', 'Core/CallEngineCore.swift']) {
    assert.doesNotMatch(read(`apps/mobile/modules/qandeel-voice-call/ios/${path}`), /clockMark|MarkEcho/u, `iOS ${path} has no clock mark: fail-closed`);
  }
  const fake = read('scripts/s8b-06/fake-call-gateway.cjs');
  assert.match(fake, /Sec-WebSocket-Protocol: \$\{PROTOCOL\}/u, 'the fake gateway always selects v1');
});

test('Android: the capture-clock marker — segment reference, hold invalidation, resume ordering, JUnit-proven', () => {
  const K = 'apps/mobile/modules/qandeel-voice-call/android/src';
  const marker = read(`${K}/main/java/expo/modules/qandeelvoicecall/CaptureClockMarker.kt`);
  assert.match(marker, /const val MARGIN_NS = 100_000_000L/u, 'the frozen 100 ms Android margin');
  assert.doesNotMatch(marker, /^import android|Log\.|println|java\.net/mu, 'pure: no Android, no log, no network');
  const engine = read(`${K}/main/java/expo/modules/qandeelvoicecall/CallAudioEngine.kt`);
  assert.match(engine, /stamp\.nanoTime \+ \(segmentSamples - UplinkOpusEncoder\.FRAME_SAMPLES - stamp\.framePosition\)/u,
    'the mark is timed through the samples read, never through the (jumping) frame index');
  assert.match(engine, /stamp\.nanoTime \+ \(readSamples - UplinkOpusEncoder\.FRAME_SAMPLES - stamp\.framePosition\)/u,
    'both readings of the timestamp: a platform position that restarts with the microphone, or one that continues');
  assert.match(marker, /fun pick\(segmentTimeNs: Long, recordingTimeNs: Long, readNs: Long\): Long/u, 'the earlier plausible reading');
  assert.match(engine, /holdCount \+= 1[\s\S]*?clockMarker\.invalidate\(\)[\s\S]*?record\?\.stop\(\)/u, 'a hold invalidates before the microphone stops');
  assert.match(engine, /synchronized\(holdMonitor\) \{ resumeFrameIndex = continueAt \}\n\s*synchronized\(lock\) \{ held = false \}/u,
    'resume publishes the new index before it clears the hold');
  assert.match(engine, /clockMarker\.segmentStart\(\) \/\/ a new segment/u);
  assert.match(engine, /segment != holdCount\) continue/u, 'a frame whose read spanned a hold is never sent or stamped');
  assert.match(engine, /sink\.uplink\(captureMs, packet\)\n\s*\}\n\s*wasMuted = isMuted\n[^\n]*\n\s*for \(echo in clockMarker\.frame\(/u, 'echoes after the uplink');
  const module = read(`${K}/main/java/expo/modules/qandeelvoicecall/QandeelVoiceCallModule.kt`);
  assert.match(module, /Function\("clockMark"\) \{ token: Double ->/u);
  assert.match(module, /"onMarkEcho"/u);
  const junit = read(`${K}/test/java/expo/modules/qandeelvoicecall/CaptureClockMarkerTest.kt`);
  for (const name of ['noEchoUntilTheStartUpTimestampsAreStable', 'aMissingTimestampRestartsStabilityAndAPendingMarkWaitsOrExpires',
    'aHoldAnswersEveryPendingMarkNoclockAndRefusesNewOnes', 'aResumeReEstablishesTheReferenceFromTheNewSegmentOnly',
    'repeatedHoldResumeDuplicateAndDelayedMarksAreEachAnsweredOnceAndNeverEarly']) assert.match(junit, new RegExp(`fun ${name}[(]`, 'u'), name);
});
