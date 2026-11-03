// S8B-06 CP1 — Native Audio Engine & real Android AEC proof: static and synthetic contract.
//
// Under the Integrated Live Call Contract v1.2 FINAL (A6 06-CP1 = v1.0 §12 S8B-06 CP1, D-05-05) and the PO's execution task:
//   1. The phone speaks the FROZEN protocol `qandeel.live-call.v1` exactly. Its statement (apps/mobile/src/voice-call/
//      live-call-protocol.ts) and the fake gateway's are both compared, message by message and byte by byte, with the
//      server's own code statement (apps/api/src/voice/call/live-call.protocol.ts), loaded here as it is.
//   2. The fake gateway (scripts/s8b-06/fake-call-gateway.cjs) behaves as the frozen gateway on a real socket — upgrade
//      refusals, exact keys, frame bounds, epochs, the seq / capture-clock rules, resend, REFUSED + 4002 — and its simulated
//      CP2+ part (REPLY_AUDIO, PLAYOUT, BARGE_IN) follows the contract's A3.2 rules. Its Opus is libopus (opusscript).
//   3. The boundaries of CP1: the one live-call socket lives in src/voice-call (never runtime-entry/ or integration/); the
//      cleartext loopback and the forced cut are reachable from the device proof only; the native module is Android-only,
//      carries no call lifecycle (no Telecom, no foreground service, no CallKit, no notifee), no logging, no expo-audio;
//      the codec is pinned; the gateway calls no provider and reads no environment.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** Loads a pure TypeScript module (no imports) as it is. */
function loadTs(path) {
  const { outputText } = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require);
  return module.exports;
}

const SERVER = loadTs('apps/api/src/voice/call/live-call.protocol.ts');
const PHONE = loadTs('apps/mobile/src/voice-call/live-call-protocol.ts');
const GATEWAY = require(join(root, 'scripts/s8b-06/fake-call-gateway.cjs'));
const { connect, frame: wsFrame } = require(join(root, 'scripts/s8b-06/ws-test-client.cjs'));
const OpusScript = GATEWAY.loadOpus();

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';

const VALID = [
  { type: 'HELLO', v: 1, callId: U1, sessionId: U2, clientInstanceId: U3, resume: false },
  { type: 'HELLO', v: 1, callId: U1, sessionId: U2, clientInstanceId: U3, resume: true },
  { type: 'HEARTBEAT', n: 0 },
  { type: 'HEARTBEAT', n: 0xffffffff },
  { type: 'MUTE', msgId: 1, captureMs: 40 },
  { type: 'UNMUTE', msgId: 2, captureMs: 1000 },
  { type: 'TOKEN_REFRESH', msgId: 3, accessToken: 'abc.def.ghi' },
  { type: 'END', msgId: 4 },
  { type: 'PLAYOUT', msgId: 5, callTurnIndex: 2, chunkSeq: 9, playedMs: 200 },
  { type: 'BARGE_IN', msgId: 6, callTurnIndex: 2, captureMs: 1240 },
  { type: 'TEXT_TURN', msgId: 7, clientTurnId: U2, text: 'مرحبا' },
];

function corpus() {
  const out = [];
  for (const m of VALID) {
    out.push(JSON.stringify(m));
    out.push(JSON.stringify({ ...m, extra: 1 }));
    for (const key of Object.keys(m).filter((k) => k !== 'type')) {
      const missing = { ...m };
      delete missing[key];
      out.push(JSON.stringify(missing));
      for (const bad of [-1, 1.5, 'x', null, 0x100000000, 30, true]) out.push(JSON.stringify({ ...m, [key]: bad }));
    }
  }
  out.push('{', '[]', 'null', '"HELLO"', JSON.stringify({ type: 'NOPE' }), JSON.stringify({ type: 'TEXT_TURN', msgId: 1, clientTurnId: U1, text: '   ' }));
  out.push(JSON.stringify({ type: 'TEXT_TURN', msgId: 1, clientTurnId: U1, text: 'x'.repeat(2001) }));
  out.push(JSON.stringify({ type: 'TOKEN_REFRESH', msgId: 1, accessToken: 'a b' }));
  return out;
}

// ------------------------------------------------------------------ 1. one protocol, three statements
test('the phone and the gateway accept exactly the client messages the frozen server accepts', () => {
  const texts = corpus();
  assert.ok(texts.length > 150, `corpus of ${texts.length}`);
  for (const text of texts) {
    const server = SERVER.parseClientMessage(text);
    const gateway = GATEWAY.parseClientMessage(text);
    assert.equal(gateway !== null, server !== null, `gateway disagrees on ${text}`);
    if (server) assert.deepEqual({ ...gateway }, { ...server });
  }
  for (const m of VALID) {
    const encoded = PHONE.encodeClientMessage(m);
    assert.deepEqual(SERVER.parseClientMessage(encoded), m, 'the phone writes what the server reads');
    assert.equal(PHONE.isValidClientMessage(m), true);
    assert.deepEqual(Object.keys(JSON.parse(encoded)), Object.keys(m), 'the frozen key order');
  }
  // PLAYOUT / BARGE_IN carry no turn epoch: the epoch is in the binary frames only.
  assert.deepEqual(Object.keys(JSON.parse(PHONE.encodeClientMessage(VALID[8]))), ['type', 'msgId', 'callTurnIndex', 'chunkSeq', 'playedMs']);
  assert.deepEqual(Object.keys(JSON.parse(PHONE.encodeClientMessage(VALID[9]))), ['type', 'msgId', 'callTurnIndex', 'captureMs']);
});

test('the phone reads exactly the server messages the frozen server writes', () => {
  const messages = [
    { type: 'STATE', callId: U1, state: 'ACTIVE', epoch: 2, startedAt: '2026-11-02T10:00:00.000Z', resumeFromCaptureMs: 1400, lastMsgId: 3, endsAt: '2026-11-02T11:00:00.000Z', endReason: null, heartbeatMs: 1000 },
    { type: 'STATE', callId: U1, state: 'ENDED', epoch: null, startedAt: null, resumeFromCaptureMs: null, lastMsgId: 0, endsAt: null, endReason: 'USER_ENDED', heartbeatMs: 1000 },
    { type: 'ACK', msgId: 9 },
    { type: 'REFUSED', reason: 'NOT_SUPPORTED_YET', msgId: 4 },
    { type: 'REFUSED', reason: 'CAPACITY_FULL', msgId: null },
    { type: 'CALL_ENDING', endsInMs: 300000 },
    { type: 'TURN_COMMITTED', callTurnIndex: 3, role: 'ASSISTANT', turnId: U2, clientTurnId: null },
    { type: 'REPLY_END', callTurnIndex: 3, chunks: 40, deliveryState: 'INTERRUPTED' },
  ];
  for (const m of messages) assert.deepEqual(PHONE.parseServerMessage(SERVER.encodeServerMessage(m)), m);
  assert.equal(PHONE.parseServerMessage(SERVER.encodeServerMessage({ ...messages[2], extra: true })), null);
});

test('the binary frames are byte-identical across the server, the phone and the gateway', () => {
  const packet = Buffer.from([0x48, 1, 2, 3, 4, 5]);
  for (const [epoch, seq, captureMs] of [[1, 0, 0], [7, 123456, 98760], [0xffffffff, 0xffffffff, 0xfffffff0]]) {
    const phone = Buffer.from(PHONE.encodeAudioFrame({ epoch, seq, captureMs, packet: new Uint8Array(packet) }));
    const server = SERVER.encodeAudioFrame({ epoch, seq, captureMs, packet });
    assert.deepEqual(phone, server);
    assert.deepEqual({ ...SERVER.decodeAudioFrame(phone), packet: null }, { epoch, seq, captureMs, packet: null });
    assert.deepEqual({ ...GATEWAY.decodeAudioFrame(phone), packet: null }, { epoch, seq, captureMs, packet: null });
  }
  for (const [epoch, turn, chunk, offset] of [[1, 1, 0, 0], [3, 9, 77, 1540]]) {
    const server = SERVER.encodeReplyAudioFrame({ epoch, callTurnIndex: turn, chunkSeq: chunk, offsetMs: offset, packet });
    assert.deepEqual(GATEWAY.encodeReplyAudioFrame(epoch, turn, chunk, offset, packet), server);
    const decoded = PHONE.decodeReplyAudioFrame(new Uint8Array(server));
    assert.deepEqual({ ...decoded, packet: Buffer.from(decoded.packet) }, { epoch, callTurnIndex: turn, chunkSeq: chunk, offsetMs: offset, packet });
  }
  // A malformed frame is refused by all three.
  const bad = Buffer.from(SERVER.encodeAudioFrame({ epoch: 1, seq: 0, captureMs: 0, packet }));
  bad.writeUInt32BE(1, 16);
  assert.equal(SERVER.decodeAudioFrame(bad), null);
  assert.equal(GATEWAY.decodeAudioFrame(bad), null);
  assert.equal(PHONE.decodeAudioFrame(new Uint8Array(bad)), null);
  // The uplink TOC rule agrees for every TOC byte.
  for (let toc = 0; toc < 256; toc += 1) {
    const p = Buffer.from([toc, 3, 1, 2]);
    const serverRule = (() => {
      const shape = (() => {
        const config = toc >> 3;
        const code = toc & 3;
        const frames = code === 0 ? 1 : code < 3 ? 2 : (p[1] & 0x3f);
        const tenths = config < 12 ? [100, 200, 400, 600][config % 4] : config < 16 ? [100, 200][config % 2] : [25, 50, 100, 200][config % 4];
        return frames === 0 ? null : { mono: (toc & 4) === 0, d: frames * tenths };
      })();
      return shape !== null && shape.mono && shape.d === 200;
    })();
    assert.equal(PHONE.isMono20msOpusPacket(new Uint8Array(p)), serverRule, `toc ${toc}`);
    assert.equal(GATEWAY.isUplinkPacket(p), serverRule, `gateway toc ${toc}`);
  }
});

test('the constants, limits and close codes are the frozen ones, and the protocol document still states them', () => {
  for (const name of ['LIVE_CALL_PROTOCOL', 'LIVE_CALL_PATH', 'LIVE_CALL_PROTOCOL_VERSION', 'AUDIO_FRAME_KIND', 'REPLY_AUDIO_FRAME_KIND', 'FRAME_HEADER_BYTES',
    'MAX_OPUS_PACKET_BYTES', 'MAX_BINARY_FRAME_BYTES', 'MAX_TEXT_FRAME_BYTES', 'AUDIO_PACKET_MS']) {
    assert.deepEqual(PHONE[name], SERVER[name], name);
  }
  assert.deepEqual({ ...PHONE.LIVE_CALL_LIMITS }, { ...SERVER.LIVE_CALL_LIMITS });
  assert.deepEqual({ ...PHONE.LIVE_CALL_CLOSE }, { ...SERVER.LIVE_CALL_CLOSE });
  const doc = read('docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v1.md');
  const block = JSON.parse(/```json qandeel-live-call-v1\n([\s\S]*?)\n```/u.exec(doc)[1]);
  assert.deepEqual(block.limits, { ...PHONE.LIVE_CALL_LIMITS, callEndingNoticeMs: [...PHONE.LIVE_CALL_LIMITS.callEndingNoticeMs] });
  assert.deepEqual(block.close, { ...PHONE.LIVE_CALL_CLOSE });
  assert.equal(GATEWAY.PROTOCOL, SERVER.LIVE_CALL_PROTOCOL);
  assert.equal(GATEWAY.PATH, SERVER.LIVE_CALL_PATH);
  assert.equal(GATEWAY.LIMITS.maxBinaryFrameBytes, SERVER.MAX_BINARY_FRAME_BYTES);
  assert.equal(GATEWAY.LIMITS.maxTextFrameBytes, SERVER.MAX_TEXT_FRAME_BYTES);
  assert.equal(GATEWAY.LIMITS.heartbeatIntervalMs, SERVER.LIVE_CALL_LIMITS.heartbeatIntervalMs);
  assert.equal(GATEWAY.LIMITS.silenceTimeoutMs, SERVER.LIVE_CALL_LIMITS.silenceTimeoutMs);
  for (const [k, v] of Object.entries(GATEWAY.CLOSE)) assert.equal(SERVER.LIVE_CALL_CLOSE[k], v, k);
});

// ------------------------------------------------------------------ 2. the fake gateway on a real socket
function synthUplink(frames) {
  const encoder = new OpusScript(16000, 1, OpusScript.Application.VOIP);
  encoder.setBitrate(24000);
  encoder.encoderCTL(4012, 1);
  encoder.encoderCTL(4014, 10);
  encoder.encoderCTL(4016, 0);
  const out = [];
  for (let f = 0; f < frames; f += 1) {
    const pcm = Buffer.alloc(640);
    for (let i = 0; i < 320; i += 1) {
      const t = (f * 320 + i) / 16000;
      const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t);
      let v = 0;
      for (let h = 1; h <= 6; h += 1) v += Math.sin(2 * Math.PI * 130 * h * t) / h;
      pcm.writeInt16LE(Math.round(5000 * env * v), i * 2);
    }
    out.push(Buffer.from(encoder.encode(pcm, 320)));
  }
  encoder.delete();
  return out;
}
const PACKETS = synthUplink(200);
const audioFrame = (epoch, seq, captureMs, packet = PACKETS[seq % PACKETS.length]) =>
  SERVER.encodeAudioFrame({ epoch, seq, captureMs, packet });
const helloNew = { type: 'HELLO', v: 1, callId: U1, sessionId: U2, clientInstanceId: U3, resume: false };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function withGateway(fn) {
  const gateway = GATEWAY.createGateway({ quiet: true });
  const port = await gateway.listen(0);
  try {
    await fn(gateway, port);
  } finally {
    await gateway.close();
  }
}

test('gateway: the upgrade is refused before any frame exactly as the frozen gateway refuses it', async () => {
  await withGateway(async (_g, port) => {
    assert.equal((await connect(port, { path: '/voice/calls/connect?token=x' })).status, 404);
    assert.equal((await connect(port, { path: '/voice/calls' })).status, 404);
    assert.equal((await connect(port, { version: '8' })).status, 426);
    assert.equal((await connect(port, { protocol: 'other' })).status, 400);
    assert.equal((await connect(port, { token: null })).status, 401);
    assert.equal((await connect(port, { token: 'a-real-looking-token' })).status, 401);
    const ok = await connect(port);
    assert.equal(ok.status, 101);
    assert.equal(ok.protocol, 'qandeel.live-call.v1');
    ok.close();
  });
});

test('gateway: frame bounds, masking and exact keys', async () => {
  await withGateway(async (_g, port) => {
    const big = await connect(port);
    big.sendText('x'.repeat(4097));
    assert.equal(await big.closed(), 1009);
    const bigBinary = await connect(port);
    bigBinary.sendBinary(Buffer.alloc(1296));
    assert.equal(await bigBinary.closed(), 1009);
    const unmasked = await connect(port);
    unmasked.sendRaw(wsFrame(1, Buffer.from(JSON.stringify(helloNew)), { mask: false }));
    assert.equal(await unmasked.closed(), 1002);
    const fragment = await connect(port);
    fragment.sendRaw(wsFrame(1, Buffer.from('{"type":'), { fin: false }));
    assert.equal(await fragment.closed(), 1002);
    const extra = await connect(port);
    extra.sendText({ ...helloNew, extra: 1 });
    assert.deepEqual(await extra.next((m) => m.type === 'REFUSED'), { type: 'REFUSED', reason: 'PROTOCOL_VIOLATION', msgId: null });
    assert.equal(await extra.closed(), 4002);
  });
});

test('gateway: a call begins, activates on captureMs 0, takes libopus uplink with FEC, and ends on END', async () => {
  await withGateway(async (gateway, port) => {
    const c = await connect(port);
    c.sendText(helloNew);
    const begun = await c.next((m) => m.type === 'STATE');
    assert.equal(begun.state, 'CONNECTING');
    assert.equal(begun.epoch, 1);
    for (let i = 0; i < 100; i += 1) c.sendBinary(audioFrame(1, i, i * 20));
    c.sendText({ type: 'HEARTBEAT', n: 0 });
    const active = await c.next((m) => m.type === 'STATE' && m.state === 'ACTIVE');
    assert.equal(active.resumeFromCaptureMs, 0);
    await wait(100);
    const s = gateway.summary();
    assert.equal(s.uplinkPackets, 100);
    assert.deepEqual(s.violations, []);
    assert.equal(s.captureBreaks, 0);
    assert.equal(s.seqBreaks, 0);
    assert.deepEqual(s.decodedSamplesPerPacket, [320]);
    assert.equal(s.dtxPackets, 0);
    assert.ok(s.silkWithFec / s.silkPackets > 0.8, `in-band FEC read from the SILK LBRR flag (${s.silkWithFec}/${s.silkPackets})`);
    c.sendText({ type: 'END', msgId: 1 });
    assert.deepEqual(await c.next((m) => m.type === 'ACK'), { type: 'ACK', msgId: 1 });
    const ended = await c.next((m) => m.type === 'STATE' && m.state === 'ENDED');
    assert.equal(ended.endReason, 'USER_ENDED');
    assert.equal(await c.closed(), 1000);
  });
});

test('gateway: the seq and capture-clock rules — resend dropped, MUTED gap, any other jump a violation', async () => {
  await withGateway(async (gateway, port) => {
    const c = await connect(port);
    c.sendText(helloNew);
    await c.next((m) => m.type === 'STATE');
    for (let i = 0; i < 10; i += 1) c.sendBinary(audioFrame(1, i, i * 20));
    c.sendBinary(audioFrame(1, 5, 100)); // a repeat: dropped
    c.sendText({ type: 'MUTE', msgId: 1, captureMs: 200 });
    c.sendText({ type: 'UNMUTE', msgId: 2, captureMs: 600 });
    c.sendBinary(audioFrame(1, 10, 600)); // the jump a MUTE / UNMUTE explains
    await c.next((m) => m.type === 'ACK' && m.msgId === 2);
    await wait(50);
    let s = gateway.summary();
    assert.deepEqual(s.gaps, [{ kind: 'MUTED', fromMs: 200, toMs: 600 }]);
    assert.equal(s.resendDropped, 1);
    assert.deepEqual(s.violations, []);
    c.sendBinary(audioFrame(1, 11, 700)); // an unexplained jump
    assert.deepEqual(await c.next((m) => m.type === 'REFUSED'), { type: 'REFUSED', reason: 'PROTOCOL_VIOLATION', msgId: null });
    assert.equal(await c.closed(), 4002);
    s = gateway.summary();
    assert.equal(s.violations.length, 1);
    assert.equal(s.state, 'ACTIVE', 'a violation suspends, it does not end');
  });
});

test('gateway: resume takes a new epoch, fences the old connection, names the durable end, and accepts the original resend', async () => {
  await withGateway(async (gateway, port) => {
    const a = await connect(port);
    a.sendText(helloNew);
    await a.next((m) => m.type === 'STATE');
    for (let i = 0; i < 50; i += 1) a.sendBinary(audioFrame(1, i, i * 20));
    await a.next((m) => m.type === 'STATE' && m.state === 'ACTIVE');
    await wait(50);
    gateway.knobs.durableLagMs = 400;
    const b = await connect(port);
    b.sendText({ ...helloNew, resume: true });
    const resumed = await b.next((m) => m.type === 'STATE');
    assert.equal(resumed.epoch, 2);
    assert.equal(resumed.resumeFromCaptureMs, 600);
    assert.equal(await a.closed(), 4003);
    for (let i = 30; i < 60; i += 1) b.sendBinary(audioFrame(2, i, i * 20)); // the original seq and captureMs from 600
    await wait(80);
    const s = gateway.summary();
    assert.deepEqual(s.epochsSeen, [1, 2]);
    assert.equal(s.lastCaptureMs, 1180);
    assert.equal(s.captureBreaks, 0, 'nothing invented, nothing stitched');
    assert.deepEqual(s.violations, []);
    const old = await connect(port);
    old.sendText({ ...helloNew, resume: true, clientInstanceId: U2 });
    assert.deepEqual(await old.next((m) => m.type === 'REFUSED'), { type: 'REFUSED', reason: 'OTHER_DEVICE', msgId: null });
    assert.equal(await old.closed(), 4004);
    b.close();
  });
});

test('gateway (simulated CP2+): REPLY_AUDIO is libopus 24 kHz 20 ms; PLAYOUT keeps the highest mark; BARGE_IN closes; late is counted', async () => {
  await withGateway(async (gateway, port) => {
    const c = await connect(port);
    c.sendText(helloNew);
    await c.next((m) => m.type === 'STATE');
    let seq = 0;
    const tick = setInterval(() => { c.sendBinary(audioFrame(1, seq, seq * 20)); seq += 1; }, 20);
    try {
      await c.next((m) => m.type === 'STATE' && m.state === 'ACTIVE');
      const reply = gateway.startReply({ ms: 1000, late: 5 });
      await wait(450);
      const frames = c.binaries.map((b) => PHONE.decodeReplyAudioFrame(new Uint8Array(b)));
      assert.ok(frames.length >= 15);
      assert.deepEqual(frames.map((f) => f.chunkSeq), frames.map((_, i) => i));
      assert.ok(frames.every((f) => f.epoch === 1 && f.callTurnIndex === reply.turn && f.offsetMs === f.chunkSeq * 20));
      const decoder = new OpusScript(24000, 1, OpusScript.Application.VOIP);
      for (const f of frames) assert.equal(Buffer.from(decoder.decode(Buffer.from(f.packet))).length, 960);
      decoder.delete();
      c.sendText({ type: 'PLAYOUT', msgId: 1, callTurnIndex: reply.turn, chunkSeq: 4, playedMs: 100 });
      c.sendText({ type: 'PLAYOUT', msgId: 2, callTurnIndex: reply.turn, chunkSeq: 2, playedMs: 60 });
      c.sendText({ type: 'BARGE_IN', msgId: 3, callTurnIndex: reply.turn, captureMs: 1000 });
      const end = await c.next((m) => m.type === 'REPLY_END');
      assert.deepEqual(end, { type: 'REPLY_END', callTurnIndex: reply.turn, chunks: 5, deliveryState: 'INTERRUPTED' });
      c.sendText({ type: 'PLAYOUT', msgId: 4, callTurnIndex: reply.turn, chunkSeq: 9, playedMs: 200 });
      c.sendText({ type: 'PLAYOUT', msgId: 5, callTurnIndex: reply.turn, chunkSeq: 49, playedMs: 99000 });
      await c.next((m) => m.type === 'ACK' && m.msgId === 5);
      await wait(200);
      const r = gateway.summary().replies[0];
      assert.deepEqual({ chunkSeq: r.mark.chunkSeq, playedMs: r.mark.playedMs }, { chunkSeq: 4, playedMs: 100 }, 'P1 highest mark, frozen by the close (P2)');
      assert.equal(r.closed.why, 'BARGE_IN');
      assert.equal(r.playoutRejectedLate, 2, 'P3: after the close, counted only');
      assert.equal(r.playoutAboveSent, 1, 'a mark above what was sent is recorded as a defect');
      assert.equal(r.sentAfterCut, 5, 'the late scenario sent 5 packets of the cut reply');
      assert.equal(r.bargeIn.captureMs, 1000);
    } finally {
      clearInterval(tick);
    }
  });
});

// ------------------------------------------------------------------ 3. CP1 boundaries
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
const walk = (dir) => readdirSync(join(root, dir), { recursive: true }).map((f) => `${dir}/${String(f).replace(/\\/gu, '/')}`);
const MODULE = 'apps/mobile/modules/qandeel-voice-call';
const KOTLIN = `${MODULE}/android/src/main/java/expo/modules/qandeelvoicecall`;

test('the one live-call socket lives in src/voice-call; ws:// and the forced cut are the device proof’s alone', () => {
  const mobile = walk('apps/mobile/src').filter((f) => /\.(ts|tsx)$/u.test(f));
  const sockets = mobile.filter((f) => /\bnew WebSocket\b|\bWebSocket as\b/u.test(strip(read(f))));
  assert.deepEqual(sockets, ['apps/mobile/src/voice-call/live-call-client.ts']);
  for (const f of mobile.filter((p) => p.startsWith('apps/mobile/src/runtime-entry/') || p.startsWith('apps/mobile/src/integration/'))) {
    assert.doesNotMatch(read(f), /voice-call\/|live-call/u, `${f} does not reach the live call`);
  }
  for (const f of mobile.filter((p) => /insecureLoopbackForProof:\s*true/u.test(read(p)))) assert.match(f, /^apps\/mobile\/src\/voice-call\/__validation__\//u, f);
  // voice-call-engine.ts only binds the native call; every caller is the device proof.
  for (const f of mobile.filter((p) => p !== 'apps/mobile/src/voice-call/voice-call-engine.ts' && /\.forceBargeIn\(/u.test(read(p)))) assert.match(f, /^apps\/mobile\/src\/voice-call\/__validation__\//u, f);
  for (const f of mobile.filter((p) => p.startsWith('apps/mobile/src/voice-call/'))) {
    assert.doesNotMatch(read(f), /from 'expo-audio'|@notifee|expo-notifications|AsyncStorage|expo-sqlite|expo-file-system/u, `${f}: no expo-audio, no notification, no persistence`);
  }
  const client = read('apps/mobile/src/voice-call/live-call-client.ts');
  assert.match(client, /Authorization: `Bearer \$\{this\.options\.accessToken\(\)\}`/u, 'the token travels in the upgrade header');
  assert.doesNotMatch(strip(client), /console\.|\?token=|accessToken=/u, 'no logging, never a token in the URL');
});

// S8B-06 CP2 RE-ANCHOR (A6 06-CP2): the module now has an iOS engine and the call lifecycle, owned and pinned by
// tests/s8b-06-native-call-lifecycle-contract.test.mjs (the exact config, both platforms, the second dependency, which
// files may speak Telecom). What CP1 pinned here still holds: the CP1 audio ENGINE files carry no call lifecycle, the
// module logs nothing, writes no file and opens no network, and its audio rules are unchanged.
test('the native audio engine: a pinned codec, no call lifecycle in the engine, no logging, and VAD after AEC', () => {
  const config = JSON.parse(read(`${MODULE}/expo-module.config.json`));
  assert.deepEqual(config.android, { modules: ['expo.modules.qandeelvoicecall.QandeelVoiceCallModule'] });
  assert.equal(existsSync(join(root, MODULE, 'android/src/main/AndroidManifest.xml')), false, "no module manifest: the service and its permissions are the config plugin's");
  const gradle = read(`${MODULE}/android/build.gradle`);
  assert.match(gradle, /implementation 'io\.github\.jaredmdobson:concentus:1\.0\.2'/u);
  const kotlin = walk(`${MODULE}/android/src/main/java`).filter((f) => f.endsWith('.kt')).map((f) => strip(read(f))).join('\n');
  for (const forbidden of [/android\.util\.Log\b/u, /\bLog\.[dviwe]\(/u, /println\(/u,
    /notifee/iu, /expo\.modules\.audio/u, /FileOutputStream|openFileOutput|cacheDir|filesDir/u, /java\.net\.|okhttp/iu]) {
    assert.doesNotMatch(kotlin, forbidden, `the native module: ${forbidden}`);
  }
  for (const file of ['CallAudioEngine.kt', 'OpusCodecs.kt', 'ReplyLedger.kt', 'SpeechOnsetDetector.kt', 'CuePlayer.kt', 'CueSchedule.kt']) {
    assert.doesNotMatch(strip(read(`${KOTLIN}/${file}`)), /core\.telecom|ConnectionService|MANAGE_OWN_CALLS|startForeground|FOREGROUND_SERVICE|CallStyle|Notification/u, `${file}: the engine has no call lifecycle`);
  }
  const engine = read(`${KOTLIN}/CallAudioEngine.kt`);
  assert.match(engine, /MediaRecorder\.AudioSource\.VOICE_COMMUNICATION/u);
  assert.match(engine, /AcousticEchoCanceler\.create\(created\.audioSessionId\)/u);
  assert.match(engine, /AudioManager\.MODE_IN_COMMUNICATION/u);
  assert.match(engine, /AudioAttributes\.USAGE_VOICE_COMMUNICATION/u);
  assert.match(engine, /audioManager\.mode = savedMode/u, 'the previous audio mode is restored');
  assert.match(engine, /abandonAudioFocusRequest/u);
  assert.match(engine, /val packet = encoder\.encode\(frame\)[\s\S]*?sink\.uplink\(captureMs, packet\)[\s\S]*?detector\.push\(level, ref, captureMs\)/u,
    'the uplink is sent before the detector judges the frame: it never waits for and never stops at a barge-in');
  assert.match(engine, /mark = ledger\.advance\(presented\)/u, 'PLAYOUT comes from the presented position');
  assert.match(engine, /if \(hasStamp\) stamp\.framePosition else/u);
  const detector = read(`${KOTLIN}/SpeechOnsetDetector.kt`);
  assert.match(detector, /val onsetFrames: Int = 10,/u, '10 × 20 ms = the contract’s 200 ms');
  const codec = read(`${KOTLIN}/OpusCodecs.kt`);
  for (const rule of [/RATE = 16_000/u, /FRAME_SAMPLES = 320/u, /useInbandFEC = true/u, /useDTX = false/u, /packetLossPercent = 10/u, /BITRATE = 24_000/u]) assert.match(codec, rule);
  assert.match(engine, /const val RAMP_MS = 8L/u);
});

test('the fake gateway calls no provider, reads no environment and stores no audio but its own synthetic reply', () => {
  const code = strip(read('scripts/s8b-06/fake-call-gateway.cjs'));
  assert.doesNotMatch(code, /\bfetch\(|require\('node:https'\)|require\('https'\)|process\.env|speechmatics|deepseek|generativelanguage|googleapis|supabase/iu);
  assert.doesNotMatch(code, /console\.log\(/u);
  const writes = [...code.matchAll(/fs\.(?:writeFileSync|appendFileSync)\(([^\n]*)/gu)].map((m) => m[1]);
  assert.equal(writes.length, 3, 'three writes only');
  assert.ok(writes.some((w) => w.startsWith("path.join(out, 'gateway-events.jsonl')")), 'the content-free event log');
  assert.ok(writes.some((w) => w.startsWith('path.join(out, `device-report-')), 'the device metric reports');
  assert.ok(writes.some((w) => w.startsWith('file, Buffer.concat([header, pcm])')), 'the WAV writer');
  assert.match(code, /writeWav\(path\.join\(out, `synthetic-reply-/u, 'the only WAV is its own synthetic reply');
});

test('the contract is wired', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:s8b-06-native-audio-engine-contract'], 'node --test tests/s8b-06-native-audio-engine-contract.test.mjs');
  assert.match(read('.github/workflows/api-ci.yml'), /run: npm run test:s8b-06-native-audio-engine-contract/u);
  const mobile = read('.github/workflows/mobile-ci.yml');
  assert.match(mobile, /run: npm run test:s8b-06-native-audio-engine-contract/u);
  assert.match(mobile, /'tests\/s8b-06-native-audio-engine-contract\.test\.mjs'/u);
});
