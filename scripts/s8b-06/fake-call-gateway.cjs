#!/usr/bin/env node
/**
 * S8B-06 CP1 — a LOCAL synthetic Live Call gateway for proving the phone's native audio engine. VALIDATION TOOLING ONLY.
 *
 * It speaks the frozen protocol `qandeel.live-call.v1` (docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v1.md, apps/api/src/voice/call/
 * live-call.protocol.ts) to the phone, and nothing else: it calls no provider (no Speechmatics, no DeepSeek, no Gemini),
 * opens no PERSONAL_LIVE_CALL gate, touches no database and reads no credential. It is not the server and is never deployed.
 *
 *   - Upgrade exactly as the frozen gateway: GET /voice/calls/connect, no query (404), WebSocket version 13 (426),
 *     subprotocol `qandeel.live-call.v1` (400), `Authorization: Bearer <the local synthetic token>` (401), no extension.
 *   - RFC 6455 framing with the frozen bounds: client frames masked, FIN on every frame, text ≤ 4096 bytes, binary ≤ 1295,
 *     control ≤ 125 — anything larger closes 1009.
 *   - Messages parsed by exact keys (the same rule as the frozen parser; tests/s8b-06-native-audio-engine-contract.test.mjs
 *     compares the two on a corpus). HELLO / resume / epochs / fencing / OTHER_DEVICE, the AUDIO seq and capture-clock
 *     rules (resend dropped, MUTED and RECONNECTION gaps, any other jump a violation), MUTE / UNMUTE / TOKEN_REFRESH / END
 *     with ACK and msgId repeats, HEARTBEAT and the 3 s silence close, REFUSED + 4002 on a violation.
 *   - SIMULATED CP2+ (the frozen shapes, the contract's A3.2 rules, a stand-in for what S8B-05 CP2–CP4 will build):
 *     REPLY_AUDIO of a synthetic voiced signal encoded by libopus (opusscript, the server's own codec) as 24 kHz mono 20 ms
 *     Opus; PLAYOUT kept as the highest mark per reply (P1) and checked never to exceed what was sent; BARGE_IN closes the
 *     reply at the current mark (P2), later PLAYOUT / BARGE_IN for it is counted as late (P3); REPLY_END. The frozen CP1
 *     server itself still answers PLAYOUT / BARGE_IN with REFUSED NOT_SUPPORTED_YET — this gateway does not claim otherwise.
 *   - Fault scenarios: late packets of a cut reply, repeated / reordered chunks, jitter, a wrong connection epoch, an abrupt
 *     drop and resume, a USER track durable end behind what was received (so the phone resends), delayed PLAYOUT ACKs.
 *
 * The uplink is decoded with libopus (proof that the phone's packets are real Opus) and reduced to content-free numbers per
 * 20 ms packet (level in dBFS, size, TOC, the SILK in-band FEC flag). No audio and no token is logged or written; the only
 * audio it ever writes is its OWN synthetic reply signal, when asked (--write-reply-wav).
 *
 *   node scripts/s8b-06/fake-call-gateway.cjs [--port 8806] [--out <evidence dir>]
 *   adb reverse tcp:8806 tcp:8806            (the proof app connects to ws://127.0.0.1:8806/voice/calls/connect)
 *
 * Control (HTTP, same port): POST /fv/reply?ms=&late=&repeat=&reorder=&jitter=&wrongEpoch=&lead=  POST /fv/drop
 * POST /fv/durable-lag?ms=  POST /fv/playout-ack-delay?ms=  POST /fv/end  GET /fv/summary  GET /fv/levels?from=&to=
 *   POST /fv/gate?mode=none|prbs|duck|silent  GET /fv/echo?turn=&cands=
 * POST /fv/report (the proof app's own content-free report)  POST /fv/reset
 */
'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { gatePattern, analyzeEcho } = require('./echo-analysis.cjs');

const PROTOCOL = 'qandeel.live-call.v1';
const PATH = '/voice/calls/connect';
const SYNTHETIC_TOKEN = 's806-local-synthetic-token';
const LIMITS = Object.freeze({
  heartbeatIntervalMs: 1000, silenceTimeoutMs: 3000, resendBufferMs: 2000, reconnectGraceMs: 30_000, maxTextFrameBytes: 4096,
  maxBinaryFrameBytes: 1295, maxControlFrameBytes: 125, headerBytes: 20, maxOpusPacketBytes: 1275, packetMs: 20,
});
const CLOSE = Object.freeze({ NORMAL: 1000, PROTOCOL_ERROR: 1002, TOO_BIG: 1009, PROTOCOL_VIOLATION: 4002, FENCED: 4003, REFUSED: 4004, SILENCE: 4008 });

// ------------------------------------------------------------------ the frozen message rules (pure; exported for the contract)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const isU32 = (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffffff;
const isUuid = (v) => typeof v === 'string' && UUID.test(v);
const isCapture = (v) => isU32(v) && v % 20 === 0;
const exactKeys = (m, keys) => Object.keys(m).length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(m, k));

function parseClientMessage(text) {
  if (text.length > LIMITS.maxTextFrameBytes) return null;
  let m;
  try {
    m = JSON.parse(text);
  } catch {
    return null;
  }
  if (m === null || typeof m !== 'object' || Array.isArray(m)) return null;
  switch (m.type) {
    case 'HELLO':
      return exactKeys(m, ['type', 'v', 'callId', 'sessionId', 'clientInstanceId', 'resume']) && m.v === 1 && isUuid(m.callId) && isUuid(m.sessionId)
        && isUuid(m.clientInstanceId) && typeof m.resume === 'boolean' ? m : null;
    case 'HEARTBEAT':
      return exactKeys(m, ['type', 'n']) && isU32(m.n) ? m : null;
    case 'MUTE':
    case 'UNMUTE':
      return exactKeys(m, ['type', 'msgId', 'captureMs']) && isU32(m.msgId) && isCapture(m.captureMs) ? m : null;
    case 'TOKEN_REFRESH':
      return exactKeys(m, ['type', 'msgId', 'accessToken']) && isU32(m.msgId) && typeof m.accessToken === 'string' && m.accessToken.length > 0
        && m.accessToken.length <= 3500 && !/\s/u.test(m.accessToken) ? m : null;
    case 'END':
      return exactKeys(m, ['type', 'msgId']) && isU32(m.msgId) ? m : null;
    case 'PLAYOUT':
      return exactKeys(m, ['type', 'msgId', 'callTurnIndex', 'chunkSeq', 'playedMs']) && isU32(m.msgId) && isU32(m.callTurnIndex) && isU32(m.chunkSeq)
        && isU32(m.playedMs) ? m : null;
    case 'BARGE_IN':
      return exactKeys(m, ['type', 'msgId', 'callTurnIndex', 'captureMs']) && isU32(m.msgId) && isU32(m.callTurnIndex) && isCapture(m.captureMs) ? m : null;
    case 'TEXT_TURN':
      return exactKeys(m, ['type', 'msgId', 'clientTurnId', 'text']) && isU32(m.msgId) && isUuid(m.clientTurnId) && typeof m.text === 'string'
        && m.text.trim().length > 0 && m.text.length <= 2000 ? m : null;
    default:
      return null;
  }
}

function decodeAudioFrame(buf) {
  if (buf.length <= LIMITS.headerBytes || buf.length > LIMITS.maxBinaryFrameBytes) return null;
  if (buf.readUInt8(0) !== 1 || buf.readUInt8(1) !== 1 || buf.readUInt16BE(2) !== 0 || buf.readUInt32BE(16) !== 0) return null;
  const captureMs = buf.readUInt32BE(12);
  if (captureMs % 20 !== 0) return null;
  return { epoch: buf.readUInt32BE(4), seq: buf.readUInt32BE(8), captureMs, packet: buf.subarray(LIMITS.headerBytes) };
}

function encodeReplyAudioFrame(epoch, callTurnIndex, chunkSeq, offsetMs, packet) {
  const out = Buffer.alloc(LIMITS.headerBytes + packet.length);
  out.writeUInt8(2, 0);
  out.writeUInt8(1, 1);
  out.writeUInt16BE(0, 2);
  out.writeUInt32BE(epoch >>> 0, 4);
  out.writeUInt32BE(callTurnIndex >>> 0, 8);
  out.writeUInt32BE(chunkSeq >>> 0, 12);
  out.writeUInt32BE(offsetMs >>> 0, 16);
  packet.copy(out, LIMITS.headerBytes);
  return out;
}

/** RFC 6716 TOC → { mono, durationTenthsMs, config }. */
function opusShape(packet) {
  if (packet.length < 1) return null;
  const toc = packet[0];
  const config = toc >> 3;
  const code = toc & 3;
  let frames;
  if (code === 0) frames = 1;
  else if (code === 1 || code === 2) frames = 2;
  else {
    if (packet.length < 2) return null;
    frames = packet[1] & 0x3f;
    if (frames === 0) return null;
  }
  const tenths = config < 12 ? [100, 200, 400, 600][config % 4] : config < 16 ? [100, 200][config % 2] : [25, 50, 100, 200][config % 4];
  return { mono: (toc & 4) === 0, durationTenthsMs: frames * tenths, config, code };
}
const isUplinkPacket = (packet) => {
  const s = opusShape(packet);
  return s !== null && s.mono && s.durationTenthsMs === 200;
};

/** libopus celt/entdec.c ec_dec_init + ec_dec_bit_logp: the SILK VAD then LBRR (in-band FEC) flag of a one-frame packet. */
function silkLbrrFlag(packet) {
  const s = opusShape(packet);
  if (!s || s.config >= 16 || s.code !== 0) return null;
  let offs = 1;
  const readByte = () => (offs < packet.length ? packet[offs++] : 0);
  let rng = 128;
  let rem = readByte();
  let val = rng - 1 - (rem >> 1);
  const normalize = () => {
    while (rng <= 1 << 23) {
      rng = (rng * 256) >>> 0;
      let sym = rem;
      rem = readByte();
      sym = ((sym << 8) | rem) >> 1;
      val = ((val * 256) + (255 & ~sym)) % 0x80000000;
    }
  };
  normalize();
  const bit = () => {
    const sv = Math.floor(rng / 2);
    const ret = val < sv;
    if (!ret) val -= sv;
    rng = ret ? sv : rng - sv;
    normalize();
    return ret;
  };
  bit(); // VAD
  return bit(); // LBRR
}

const levelDb = (pcm) => {
  const n = pcm.length / 2;
  if (n === 0) return -120;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const v = pcm.readInt16LE(i * 2);
    sum += v * v;
  }
  const rms = Math.sqrt(sum / n) / 32768;
  return rms <= 1e-6 ? -120 : Math.round(200 * Math.log10(rms)) / 10;
};

// ------------------------------------------------------------------ libopus (the server's own codec build)
function loadOpus() {
  const roots = [path.join(__dirname, '..', '..', 'apps', 'api'), path.join(__dirname, '..', '..')];
  return require(require.resolve('opusscript', { paths: roots }));
}

/**
 * A synthetic voiced test signal (harmonics, moving pitch, syllable envelope) — never speech, never a recording. The
 * phase is accumulated sample by sample so the fundamental stays within 130–200 Hz for the whole reply (harmonics ≤ 1.6
 * kHz, inside the 16 kHz uplink's band); `sin(2π·pitch(t)·t)` would drift by t·pitch′(t) and leave the band in seconds.
 */
function synthReplyPcm(frames, seed = 2, rate = 24_000) {
  const samples = (rate * 20) / 1000;
  const out = [];
  let phase = 0;
  for (let f = 0; f < frames; f += 1) {
    const pcm = Buffer.alloc(samples * 2);
    for (let i = 0; i < samples; i += 1) {
      const t = (f * samples + i) / rate;
      const pitch = 165 + 35 * Math.sin(2 * Math.PI * 0.6 * t + seed);
      phase = (phase + (2 * Math.PI * pitch) / rate) % (2 * Math.PI);
      const envelope = 0.35 + 0.65 * Math.max(0, Math.sin(2 * Math.PI * 2.5 * t));
      let v = 0;
      for (let h = 1; h <= 8; h += 1) v += Math.sin(h * phase) / h;
      pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(7000 * envelope * v))), i * 2);
    }
    out.push(pcm);
  }
  return out;
}

/**
 * `mask` false chunks are digital silence, or with `duckDb` the same voice that much quieter: some phones mute the
 * speaker amplifier after digital silence, which would hide every later ON segment from the echo measurement.
 */
const DUCK_DB = 40; // the 'duck' gate: OFF segments are the voice 40 dB quieter instead of digital silence

function encodeReply(OpusScript, frames, mask = null, duckDb = null) {
  const encoder = new OpusScript(24_000, 1, OpusScript.Application.VOIP);
  try {
    encoder.setBitrate(32_000);
    encoder.encoderCTL(4012, 1); // OPUS_SET_INBAND_FEC
    encoder.encoderCTL(4014, 10); // OPUS_SET_PACKET_LOSS_PERC
    encoder.encoderCTL(4016, 0); // OPUS_SET_DTX
    const silence = Buffer.alloc(960);
    const quiet = (pcm) => {
      if (duckDb === null) return silence;
      const g = 10 ** (-duckDb / 20);
      const q = Buffer.alloc(pcm.length);
      for (let k = 0; k < pcm.length; k += 2) q.writeInt16LE(Math.round(pcm.readInt16LE(k) * g), k);
      return q;
    };
    return synthReplyPcm(frames).map((pcm, i) => Buffer.from(encoder.encode(mask && !mask[i] ? quiet(pcm) : pcm, 480)));
  } finally {
    encoder.delete();
  }
}

// ------------------------------------------------------------------ RFC 6455 (server side)
function acceptKey(key) {
  return crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
}

function frameOut(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x80 | opcode, len]);
  else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

class Wire {
  constructor(socket, handlers) {
    this.socket = socket;
    this.handlers = handlers;
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('close', () => this.onGone());
    socket.on('error', () => this.onGone());
  }

  onGone() {
    if (this.closed) return;
    this.closed = true;
    this.handlers.onClose();
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      if (this.closed || this.buffer.length < 2) return;
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const rsv = b0 & 0x70;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (this.buffer.length < 4) return;
        len = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (this.buffer.length < 10) return;
        len = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }
      // Bounds before buffering the payload (the frozen gateway's rule).
      const bound = opcode >= 8 ? LIMITS.maxControlFrameBytes : opcode === 2 ? LIMITS.maxBinaryFrameBytes : LIMITS.maxTextFrameBytes;
      if (len > bound) return this.close(CLOSE.TOO_BIG);
      if (!fin || rsv !== 0 || !masked || opcode === 0) return this.close(CLOSE.PROTOCOL_ERROR);
      if (this.buffer.length < offset + 4 + len) return;
      const mask = this.buffer.subarray(offset, offset + 4);
      const payload = Buffer.from(this.buffer.subarray(offset + 4, offset + 4 + len));
      for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i & 3];
      this.buffer = this.buffer.subarray(offset + 4 + len);
      if (opcode === 1) this.handlers.onText(payload.toString('utf8'));
      else if (opcode === 2) this.handlers.onBinary(payload);
      else if (opcode === 8) return this.close(CLOSE.NORMAL);
      else if (opcode === 9) this.raw(frameOut(10, payload));
    }
  }

  raw(bytes) {
    if (!this.closed) this.socket.write(bytes);
  }

  text(message) {
    this.raw(frameOut(1, Buffer.from(JSON.stringify(message), 'utf8')));
  }

  binary(bytes) {
    this.raw(frameOut(2, bytes));
  }

  close(code) {
    if (this.closed) return;
    const payload = Buffer.alloc(2);
    payload.writeUInt16BE(code, 0);
    this.raw(frameOut(8, payload));
    this.closed = true;
    this.socket.end();
    setTimeout(() => this.socket.destroy(), 200).unref();
    this.handlers.onClose();
  }

  destroy() {
    if (this.closed) return;
    this.closed = true;
    this.socket.destroy();
    this.handlers.onClose();
  }
}

// ------------------------------------------------------------------ the gateway
function createGateway(options = {}) {
  const OpusScript = loadOpus();
  const out = options.out ?? null;
  if (out) fs.mkdirSync(out, { recursive: true });
  const quiet = options.quiet === true;
  const say = (line) => {
    if (!quiet) process.stdout.write(`[s806-gateway] ${line}\n`);
  };
  const record = (kind, data) => {
    if (out) fs.appendFileSync(path.join(out, 'gateway-events.jsonl'), `${JSON.stringify({ t: Date.now(), kind, ...data })}\n`);
  };

  // gate: the reply's reference pattern for the echo analysis (echo-analysis.cjs): none | prbs | silent.
  const knobs = { durableLagMs: 0, playoutAckDelayMs: 0, gate: 'none' };
  /** callId → call */
  const calls = new Map();
  let current = null; // the newest connection
  const reports = [];
  // Report files continue the evidence folder's numbering (a restarted gateway never overwrites an earlier report).
  const reportBase = out && fs.existsSync(out) ? fs.readdirSync(out).filter((f) => f.startsWith('device-report-')).length : 0;

  function newCall(hello) {
    return {
      callId: hello.callId, sessionId: hello.sessionId, clientInstanceId: hello.clientInstanceId, state: 'CONNECTING', epoch: 1, startedAt: null,
      endReason: null, expectedCaptureMs: 0, lastMsgId: 0, muted: false, muteSeen: false, resumedGap: false, conn: null, graceTimer: null,
      decoder: new OpusScript(16_000, 1, OpusScript.Application.VOIP),
      uplink: [], // { captureMs, seq, epoch, bytes, levelDb, lbrr, config, receivedAt }
      gaps: [], // { kind, fromMs, toMs }
      resendDropped: 0, violations: [], decodeErrors: 0, dtxPackets: 0, nonUplinkShape: 0,
      replies: new Map(), nextTurn: 1,
      epochsSeen: [1], helloCount: 0, resumeCount: 0, controlsAfterResume: [],
    };
  }

  function stateMessage(call) {
    return {
      type: 'STATE', callId: call.callId, state: call.state, epoch: call.state === 'ENDED' ? null : call.epoch, startedAt: call.startedAt,
      resumeFromCaptureMs: call.state === 'ACTIVE' ? call.expectedCaptureMs : null, lastMsgId: call.lastMsgId,
      endsAt: call.startedAt ? new Date(Date.parse(call.startedAt) + 3_600_000).toISOString() : null, endReason: call.endReason,
      heartbeatMs: LIMITS.heartbeatIntervalMs,
    };
  }

  function endCall(call, reason) {
    if (call.state === 'ENDED') return;
    call.state = 'ENDED';
    call.endReason = reason;
    for (const reply of call.replies.values()) stopReply(reply);
    if (call.graceTimer) clearTimeout(call.graceTimer);
    record('call_ended', { reason });
    say(`call ended ${reason}`);
  }

  function suspend(call) {
    if (call.state !== 'ACTIVE' && call.state !== 'CONNECTING') return;
    for (const reply of call.replies.values()) stopReply(reply);
    call.graceTimer = setTimeout(() => endCall(call, 'PEER_LOST_AFTER_GRACE'), LIMITS.reconnectGraceMs);
    call.graceTimer.unref?.();
  }

  // ---------------------------------------------------------------- one connection
  function onUpgrade(req, socket) {
    const url = req.url ?? '';
    const fail = (status) => {
      socket.end(`HTTP/1.1 ${status} ${http.STATUS_CODES[status]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      record('upgrade_refused', { status });
    };
    if (url.includes('?') || url !== PATH) return fail(404);
    if (req.headers['sec-websocket-version'] !== '13') return fail(426);
    if (req.headers['sec-websocket-protocol'] !== PROTOCOL || typeof req.headers['sec-websocket-key'] !== 'string') return fail(400);
    if (req.headers.authorization !== `Bearer ${SYNTHETIC_TOKEN}`) return fail(401);
    socket.setNoDelay(true);
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
      + `Sec-WebSocket-Accept: ${acceptKey(req.headers['sec-websocket-key'])}\r\nSec-WebSocket-Protocol: ${PROTOCOL}\r\n\r\n`,
    );
    const conn = { phase: 'AWAIT_HELLO', call: null, epoch: null, lastSeq: null, lastFrameAt: Date.now(), silence: null, wire: null, closed: false };
    current = conn;
    const lose = (code) => {
      if (conn.closed) return;
      conn.closed = true;
      clearInterval(conn.silence);
      if (code !== null) conn.wire.close(code);
      const call = conn.call;
      if (call && call.conn === conn) {
        call.conn = null;
        suspend(call);
      }
      record('connection_lost', { code });
    };
    const violation = (why) => {
      if (conn.closed) return;
      if (conn.call) conn.call.violations.push(why);
      record('violation', { why });
      say(`VIOLATION ${why}`);
      conn.wire.text({ type: 'REFUSED', reason: 'PROTOCOL_VIOLATION', msgId: null });
      lose(CLOSE.PROTOCOL_VIOLATION);
    };
    const refuse = (reason) => {
      conn.wire.text({ type: 'REFUSED', reason, msgId: null });
      conn.closed = true;
      clearInterval(conn.silence);
      conn.wire.close(CLOSE.REFUSED);
    };
    conn.wire = new Wire(socket, {
      onText: (text) => {
        conn.lastFrameAt = Date.now();
        const m = parseClientMessage(text);
        if (!m) return violation('malformed message');
        handle(conn, m, { violation, refuse, lose });
      },
      onBinary: (bytes) => {
        conn.lastFrameAt = Date.now();
        audio(conn, bytes, { violation, lose });
      },
      onClose: () => lose(null),
    });
    conn.silence = setInterval(() => {
      if (Date.now() - conn.lastFrameAt >= LIMITS.silenceTimeoutMs) lose(CLOSE.SILENCE);
    }, 250);
    conn.silence.unref?.();
  }

  function handle(conn, m, { violation, refuse, lose }) {
    if (m.type === 'HELLO') {
      if (conn.phase !== 'AWAIT_HELLO') return violation('second HELLO');
      return hello(conn, m, refuse, lose);
    }
    if (conn.phase === 'AWAIT_HELLO') return violation('message before HELLO');
    const call = conn.call;
    const repeated = (msgId) => {
      if (msgId > call.lastMsgId) return false;
      conn.wire.text({ type: 'ACK', msgId });
      return true;
    };
    const ack = (msgId) => {
      call.lastMsgId = Math.max(call.lastMsgId, msgId);
      conn.wire.text({ type: 'ACK', msgId });
    };
    if (call.pendingControlCheck) call.controlsAfterResume.push(m.type === 'HEARTBEAT' ? null : m.type);
    switch (m.type) {
      case 'HEARTBEAT':
        return;
      case 'TOKEN_REFRESH':
        if (m.accessToken !== SYNTHETIC_TOKEN) return refuse('TOKEN_INVALID');
        if (repeated(m.msgId)) return;
        return ack(m.msgId);
      case 'MUTE':
      case 'UNMUTE':
        if (call.state !== 'ACTIVE') return violation('mute outside ACTIVE');
        if (repeated(m.msgId)) return;
        call.muted = m.type === 'MUTE';
        if (call.muted) call.muteSeen = true;
        record(m.type.toLowerCase(), { captureMs: m.captureMs });
        return ack(m.msgId);
      case 'END':
        if (repeated(m.msgId)) return;
        ack(m.msgId);
        endCall(call, 'USER_ENDED');
        conn.wire.text(stateMessage(call));
        conn.closed = true;
        clearInterval(conn.silence);
        conn.wire.close(CLOSE.NORMAL);
        return;
      case 'PLAYOUT':
        return playout(conn, call, m, repeated, ack);
      case 'BARGE_IN':
        return bargeIn(conn, call, m, repeated, ack);
      case 'TEXT_TURN':
        conn.wire.text({ type: 'REFUSED', reason: 'NOT_SUPPORTED_YET', msgId: m.msgId });
        return;
      default:
        return violation('unknown');
    }
  }

  function hello(conn, m, refuse) {
    let call = calls.get(m.callId);
    if (!m.resume) {
      if (call) return refuse('COMMAND_CONFLICT');
      call = newCall(m);
      calls.set(m.callId, call);
      conn.call = call;
      conn.epoch = 1;
      conn.phase = 'CONNECTING';
      call.conn = conn;
      call.helloCount += 1;
      record('call_begun', { epoch: 1 });
      say('call begun (epoch 1)');
      conn.wire.text(stateMessage(call));
      return;
    }
    if (!call) return refuse('NOT_FOUND');
    if (call.clientInstanceId !== m.clientInstanceId) return refuse('OTHER_DEVICE');
    if (call.state === 'ENDED') {
      conn.wire.text(stateMessage(call));
      conn.closed = true;
      clearInterval(conn.silence);
      conn.wire.close(CLOSE.NORMAL);
      return;
    }
    if (call.graceTimer) clearTimeout(call.graceTimer);
    call.graceTimer = null;
    const previous = call.conn;
    call.epoch += 1;
    call.epochsSeen.push(call.epoch);
    call.resumeCount += 1;
    call.helloCount += 1;
    if (previous && !previous.closed) {
      previous.closed = true;
      clearInterval(previous.silence);
      previous.wire.close(CLOSE.FENCED);
      record('fenced', { epoch: call.epoch - 1 });
    }
    // The USER track's durable end (a lag knob makes the phone resend what the "writer" had not stored yet).
    if (call.state === 'ACTIVE' && knobs.durableLagMs > 0) {
      const durable = Math.max(0, call.expectedCaptureMs - knobs.durableLagMs);
      call.uplink = call.uplink.filter((p) => p.captureMs < durable);
      call.expectedCaptureMs = durable;
    }
    call.resumedGap = true;
    conn.call = call;
    conn.epoch = call.epoch;
    conn.phase = call.state;
    call.conn = conn;
    call.pendingControlCheck = true;
    call.resumeFromSent = call.state === 'ACTIVE' ? call.expectedCaptureMs : null;
    record('resumed', { epoch: call.epoch, resumeFromCaptureMs: call.resumeFromSent, lastMsgId: call.lastMsgId });
    say(`call resumed (epoch ${call.epoch}, resumeFrom ${call.resumeFromSent})`);
    conn.wire.text(stateMessage(call));
  }

  function audio(conn, bytes, { violation }) {
    if (conn.closed) return;
    if (conn.phase === 'AWAIT_HELLO') return violation('audio before HELLO');
    const call = conn.call;
    const frame = decodeAudioFrame(bytes);
    if (!frame) return violation('malformed audio frame');
    if (frame.epoch !== conn.epoch) return violation(`wrong epoch ${frame.epoch} != ${conn.epoch}`);
    if (!isUplinkPacket(frame.packet)) {
      call.nonUplinkShape += 1;
      return violation('not a mono 20 ms Opus packet');
    }
    if (call.state === 'CONNECTING') {
      if (frame.captureMs !== 0) return violation('first packet not at captureMs 0');
      call.state = 'ACTIVE';
      conn.phase = 'ACTIVE';
      call.startedAt = new Date().toISOString();
      record('call_active', {});
      say('call ACTIVE');
      conn.wire.text(stateMessage(call));
    }
    if (conn.lastSeq !== null) {
      if (frame.seq <= conn.lastSeq) {
        call.resendDropped += 1;
        return;
      }
      if (frame.seq !== conn.lastSeq + 1) return violation(`seq jump ${conn.lastSeq} -> ${frame.seq}`);
    }
    if (call.muted) return violation('audio while muted');
    call.pendingControlCheck = false;
    const expected = call.expectedCaptureMs;
    if (frame.captureMs < expected) {
      conn.lastSeq = frame.seq;
      call.resendDropped += 1;
      return;
    }
    if (frame.captureMs > expected) {
      if (call.resumedGap) call.gaps.push({ kind: 'RECONNECTION', fromMs: expected, toMs: frame.captureMs });
      else if (call.muteSeen) call.gaps.push({ kind: 'MUTED', fromMs: expected, toMs: frame.captureMs });
      else return violation(`capture jump ${expected} -> ${frame.captureMs}`);
    }
    conn.lastSeq = frame.seq;
    call.resumedGap = false;
    call.muteSeen = false;
    let pcm;
    try {
      pcm = Buffer.from(call.decoder.decode(frame.packet));
    } catch {
      call.decodeErrors += 1;
      return violation('libopus refused the packet');
    }
    if (frame.packet.length <= 2) call.dtxPackets += 1;
    call.uplink.push({
      captureMs: frame.captureMs, seq: frame.seq, epoch: frame.epoch, bytes: frame.packet.length, samples: pcm.length / 2, levelDb: levelDb(pcm),
      lbrr: silkLbrrFlag(frame.packet), config: opusShape(frame.packet).config, receivedAt: Date.now(),
    });
    call.expectedCaptureMs = frame.captureMs + 20;
  }

  // ---------------------------------------------------------------- simulated replies (CP2+ stand-in)
  function stopReply(reply) {
    if (reply.timer) clearTimeout(reply.timer);
    reply.timer = null;
  }

  function startReply(call, opts) {
    const conn = call.conn;
    if (!conn || call.state !== 'ACTIVE') return null;
    const turn = call.nextTurn;
    call.nextTurn += 1;
    const chunks = Math.max(1, Math.round(opts.ms / 20));
    const gate = opts.gate ?? knobs.gate;
    const mask = gatePattern(chunks, gate, turn * 7919 + call.epochsSeen.length);
    const duckDb = gate === 'duck' ? DUCK_DB : null;
    const packets = encodeReply(OpusScript, chunks, mask, duckDb);
    const refDb = synthReplyPcm(chunks).map((pcm, i) => (mask && !mask[i] ? (duckDb === null ? -120 : levelDb(pcm) - duckDb) : levelDb(pcm)));
    if (opts.writeWav && out) writeWav(path.join(out, `synthetic-reply-${chunks * 20}ms.wav`), Buffer.concat(synthReplyPcm(chunks)), 24_000);
    const reply = {
      turn, chunks, packets, opts, gate, mask, refDb, sendAt: [], marks: [], nextChunk: 0, sent: [], sentAfterCut: 0, wrongEpochSent: 0, repeatsSent: 0, reorderedSent: 0, closed: null,
      mark: null, playouts: 0, playoutRejectedLate: 0, playoutAboveSent: 0, bargeIn: null, bargeInLate: 0, startedAt: Date.now(), timer: null,
      lateBudget: opts.late, swapPending: null,
    };
    call.replies.set(turn, reply);
    record('reply_started', { turn, chunks, opts });
    say(`reply ${turn}: ${chunks} chunks (${chunks * 20} ms) late=${opts.late} repeat=${opts.repeat} reorder=${opts.reorder} jitter=${opts.jitter} wrongEpoch=${opts.wrongEpoch}`);
    const t0 = process.hrtime.bigint();
    const lead = opts.lead;
    const tick = () => {
      reply.timer = null;
      if (!call.conn || call.conn.closed || call.state !== 'ACTIVE') return;
      const c = reply.nextChunk;
      if (c >= reply.chunks) return finishSending(call, reply);
      if (reply.closed && reply.lateBudget <= 0) return;
      sendChunk(call, reply, c);
      reply.nextChunk += 1;
      if (reply.closed) reply.lateBudget -= 1;
      const due = Number(t0 / 1_000_000n) + Math.max(0, reply.nextChunk - lead) * 20 + (opts.jitter > 0 ? Math.random() * opts.jitter : 0);
      const wait = Math.max(0, due - Number(process.hrtime.bigint() / 1_000_000n));
      reply.timer = setTimeout(tick, wait);
    };
    tick();
    return reply;
  }

  function sendChunk(call, reply, c) {
    const conn = call.conn;
    const send = (chunk, epoch) => {
      conn.wire.binary(encodeReplyAudioFrame(epoch, reply.turn, chunk, chunk * 20, reply.packets[chunk]));
      reply.sent.push(chunk);
      if (reply.sendAt[chunk] === undefined) reply.sendAt[chunk] = Date.now();
      if (reply.closed) reply.sentAfterCut += 1;
    };
    const o = reply.opts;
    if (o.reorder > 0 && c % o.reorder === o.reorder - 1 && c + 1 < reply.chunks && reply.swapPending === null) {
      reply.swapPending = c; // hold c, send c+1 first next tick
      return;
    }
    if (o.wrongEpoch > 0 && c % o.wrongEpoch === o.wrongEpoch - 1) {
      conn.wire.binary(encodeReplyAudioFrame(conn.epoch + 1000, reply.turn, c, c * 20, reply.packets[c]));
      reply.wrongEpochSent += 1;
    }
    send(c, conn.epoch);
    if (reply.swapPending !== null && reply.swapPending === c - 1) {
      send(reply.swapPending, conn.epoch); // the older chunk arrives after its successor
      reply.reorderedSent += 1;
      reply.swapPending = null;
    }
    if (o.repeat > 0 && c % o.repeat === o.repeat - 1) {
      send(c, conn.epoch);
      reply.repeatsSent += 1;
    }
  }

  function finishSending(call, reply) {
    if (reply.finishedSendingAt) return;
    reply.finishedSendingAt = Date.now();
    if (!reply.closed) {
      call.conn?.wire.text({ type: 'REPLY_END', callTurnIndex: reply.turn, chunks: reply.chunks, deliveryState: 'COMPLETE' });
      // Natural completion closes the reply once its audio had time to be heard.
      setTimeout(() => closeReply(reply, 'COMPLETE'), 1500).unref?.();
    }
  }

  function closeReply(reply, why) {
    if (reply.closed) return;
    reply.closed = { why, at: Date.now(), mark: reply.mark };
    record('reply_closed', { turn: reply.turn, why, mark: reply.mark });
  }

  function playout(conn, call, m, repeated, ack) {
    if (repeated(m.msgId)) return;
    const reply = call.replies.get(m.callTurnIndex);
    const respond = () => ack(m.msgId);
    if (reply) {
      reply.playouts += 1;
      const maxSentEnd = reply.sent.length ? (Math.max(...reply.sent) * 20 + 20) : 0;
      if (m.playedMs > maxSentEnd || m.chunkSeq * 20 + 20 !== m.playedMs) reply.playoutAboveSent += m.playedMs > maxSentEnd ? 1 : 0;
      if (reply.closed) reply.playoutRejectedLate += 1; // P3: after the close, counted only
      else if (!reply.mark || m.playedMs > reply.mark.playedMs) reply.mark = { chunkSeq: m.chunkSeq, playedMs: m.playedMs, at: Date.now() }; // P1
      if (!reply.closed) reply.marks.push([Date.now(), m.chunkSeq]); // when the phone said this chunk was heard (echo alignment)
      record('playout', { turn: m.callTurnIndex, chunkSeq: m.chunkSeq, playedMs: m.playedMs, late: Boolean(reply.closed) });
    }
    if (knobs.playoutAckDelayMs > 0) setTimeout(() => { if (!conn.closed) respond(); }, knobs.playoutAckDelayMs).unref?.();
    else respond();
  }

  function bargeIn(conn, call, m, repeated, ack) {
    if (repeated(m.msgId)) return;
    const reply = call.replies.get(m.callTurnIndex);
    if (reply) {
      if (reply.closed) reply.bargeInLate += 1;
      else {
        reply.bargeIn = { captureMs: m.captureMs, at: Date.now(), markAtArrival: reply.mark };
        closeReply(reply, 'BARGE_IN'); // P2: the mark held now is the truth; later marks are late
        const heard = reply.mark ? reply.mark.chunkSeq + 1 : 0;
        conn.wire.text({ type: 'REPLY_END', callTurnIndex: reply.turn, chunks: heard, deliveryState: 'INTERRUPTED' });
        if (reply.lateBudget <= 0) stopReply(reply);
        say(`barge-in on reply ${reply.turn} at captureMs ${m.captureMs}; heard ${heard}/${reply.chunks} chunks`);
      }
      record('barge_in', { turn: m.callTurnIndex, captureMs: m.captureMs, late: reply.bargeInLate > 0 });
    }
    ack(m.msgId);
  }

  // ---------------------------------------------------------------- summary (content-free)
  function summarize(call) {
    if (!call) return null;
    const up = call.uplink;
    let seqBreaks = 0;
    let captureBreaks = 0;
    for (let i = 1; i < up.length; i += 1) {
      if (up[i].captureMs !== up[i - 1].captureMs + 20) captureBreaks += 1;
      if (up[i].seq !== up[i - 1].seq + 1) seqBreaks += 1;
    }
    const silk = up.filter((p) => p.lbrr !== null);
    const replies = [...call.replies.values()].map((r) => ({
      turn: r.turn, gate: r.gate, chunks: r.chunks, sentDistinct: new Set(r.sent).size, sentTotal: r.sent.length, sentAfterCut: r.sentAfterCut,
      wrongEpochSent: r.wrongEpochSent, repeatsSent: r.repeatsSent, reorderedSent: r.reorderedSent, closed: r.closed, mark: r.mark,
      playouts: r.playouts, playoutRejectedLate: r.playoutRejectedLate, playoutAboveSent: r.playoutAboveSent, bargeIn: r.bargeIn,
      bargeInLate: r.bargeInLate,
    }));
    return {
      callId: call.callId, state: call.state, endReason: call.endReason, epochsSeen: call.epochsSeen, resumes: call.resumeCount,
      uplinkPackets: up.length, firstCaptureMs: up[0]?.captureMs ?? null, lastCaptureMs: up.at(-1)?.captureMs ?? null,
      expectedCaptureMs: call.expectedCaptureMs, captureBreaks, seqBreaks, gaps: call.gaps, resendDropped: call.resendDropped,
      violations: call.violations, decodeErrors: call.decodeErrors, dtxPackets: call.dtxPackets,
      uplinkAllMono20ms: call.nonUplinkShape === 0, decodedSamplesPerPacket: [...new Set(up.map((p) => p.samples))],
      silkPackets: silk.length, silkWithFec: silk.filter((p) => p.lbrr).length, tocConfigs: [...new Set(up.map((p) => p.config))],
      meanBytes: up.length ? Math.round((up.reduce((s, p) => s + p.bytes, 0) / up.length) * 10) / 10 : 0,
      controlsAfterResume: call.controlsAfterResume.filter(Boolean),
      replies,
    };
  }

  function levels(call, from, to) {
    if (!call) return [];
    return call.uplink.filter((p) => p.captureMs >= from && p.captureMs <= to).map((p) => [p.captureMs, p.seq, p.levelDb, p.receivedAt]);
  }

  const newest = () => (current?.call ?? [...calls.values()].at(-1) ?? null);

  // ---------------------------------------------------------------- HTTP control
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const json = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const num = (name, fallback) => (url.searchParams.has(name) ? Number(url.searchParams.get(name)) : fallback);
    const call = newest();
    if (req.method === 'POST' && url.pathname === '/fv/reply') {
      if (!call) return json(409, { error: 'NO_CALL' });
      const reply = startReply(call, {
        ms: num('ms', 6000), late: num('late', 0), repeat: num('repeat', 0), reorder: num('reorder', 0), jitter: num('jitter', 0),
        wrongEpoch: num('wrongEpoch', 0), lead: num('lead', 5), writeWav: url.searchParams.get('wav') === '1',
      });
      return reply ? json(200, { turn: reply.turn, chunks: reply.chunks }) : json(409, { error: 'NOT_ACTIVE' });
    }
    if (req.method === 'POST' && url.pathname === '/fv/drop') {
      if (!call?.conn) return json(409, { error: 'NO_CONNECTION' });
      call.conn.wire.destroy();
      return json(200, { dropped: true });
    }
    if (req.method === 'POST' && url.pathname === '/fv/durable-lag') {
      knobs.durableLagMs = num('ms', 0);
      return json(200, knobs);
    }
    if (req.method === 'POST' && url.pathname === '/fv/playout-ack-delay') {
      knobs.playoutAckDelayMs = num('ms', 0);
      return json(200, knobs);
    }
    if (req.method === 'POST' && url.pathname === '/fv/end') {
      if (!call) return json(409, { error: 'NO_CALL' });
      endCall(call, 'SERVER_ENDED');
      if (call.conn && !call.conn.closed) {
        call.conn.wire.text(stateMessage(call));
        call.conn.closed = true;
        call.conn.wire.close(CLOSE.NORMAL);
      }
      return json(200, { ended: true });
    }
    if (req.method === 'POST' && url.pathname === '/fv/gate') {
      const mode = url.searchParams.get('mode');
      if (!['none', 'prbs', 'duck', 'silent'].includes(mode)) return json(400, { error: 'BAD_MODE' });
      knobs.gate = mode;
      return json(200, knobs);
    }
    if (req.method === 'GET' && url.pathname === '/fv/echo') {
      const reply = call?.replies.get(num('turn', -1));
      if (!reply) return json(404, { error: 'NO_REPLY' });
      const heard = reply.closed?.why === 'BARGE_IN' && reply.mark ? reply.mark.chunkSeq + 1 : reply.chunks;
      const candidates = (url.searchParams.get('cands') ?? '').split(',').filter(Boolean).map(Number).filter(Number.isFinite);
      const analysis = analyzeEcho({ uplink: call.uplink, mask: reply.mask, refDb: reply.refDb, sendAt: reply.sendAt, marks: reply.marks, chunks: heard, candidates });
      record('echo_analysis', { turn: reply.turn, gate: reply.gate, analysis });
      // The inputs, as numbers only (levels and instants, never samples), so the analysis can be re-run offline.
      const inputs = {
        levels: call.uplink.map((p) => [p.captureMs, p.levelDb, p.receivedAt]), mask: reply.mask ? reply.mask.map((m) => (m ? 1 : 0)).join('') : null,
        refDb: reply.refDb, sendAt: reply.sendAt, marks: reply.marks, chunks: heard, candidates,
      };
      return json(200, { turn: reply.turn, gate: reply.gate, closed: reply.closed?.why ?? null, analysis, inputs });
    }
    if (req.method === 'GET' && url.pathname === '/fv/summary') return json(200, { knobs, call: summarize(call), reports: reports.length });
    if (req.method === 'GET' && url.pathname === '/fv/levels') return json(200, levels(call, num('from', 0), num('to', 1e12)));
    if (req.method === 'POST' && url.pathname === '/fv/report') {
      let body = '';
      req.on('data', (d) => { body += d; if (body.length > 4_000_000) req.destroy(); });
      req.on('end', () => {
        try {
          const report = JSON.parse(body);
          reports.push(report);
          if (out) fs.writeFileSync(path.join(out, `device-report-${String(reportBase + reports.length).padStart(3, '0')}-${String(report.test ?? 'x').replace(/[^\w-]/gu, '')}.json`), JSON.stringify({ report, gateway: summarize(newest()) }, null, 2));
          json(200, { stored: reports.length });
        } catch {
          json(400, { error: 'BAD_JSON' });
        }
      });
      return undefined;
    }
    if (req.method === 'POST' && url.pathname === '/fv/reset') {
      for (const c of calls.values()) {
        endCall(c, 'SERVER_ENDED');
        if (c.conn && !c.conn.closed) c.conn.wire.destroy();
        c.decoder.delete();
      }
      calls.clear();
      current = null;
      knobs.durableLagMs = 0;
      knobs.playoutAckDelayMs = 0;
      return json(200, { reset: true });
    }
    return json(404, { error: 'NOT_FOUND' });
  });
  server.on('upgrade', onUpgrade);
  // `server.close()` waits for every socket it accepted. A refused upgrade (`socket.end` only) or a Wire closed with an
  // unref'd destroy timer can stay half-open; on Node 22 (CI) close() then never settles and the test runner's event loop
  // drains under it. close() therefore destroys whatever is still open.
  const sockets = new Set();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  return {
    server,
    listen: (port, host = '127.0.0.1') => new Promise((resolve) => server.listen(port, host, () => resolve(server.address().port))),
    close: () => new Promise((resolve) => {
      for (const c of calls.values()) {
        for (const r of c.replies.values()) stopReply(r);
        if (c.graceTimer) clearTimeout(c.graceTimer);
        if (c.conn && !c.conn.closed) c.conn.wire.destroy();
      }
      server.close(() => resolve());
      for (const socket of sockets) socket.destroy();
    }),
    summary: () => summarize(newest()),
    startReply: (opts) => startReply(newest(), { ms: 2000, late: 0, repeat: 0, reorder: 0, jitter: 0, wrongEpoch: 0, lead: 5, ...opts }),
    knobs,
  };
}

function writeWav(file, pcm, rate) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, pcm]));
}

module.exports = {
  createGateway, parseClientMessage, decodeAudioFrame, encodeReplyAudioFrame, isUplinkPacket, silkLbrrFlag, opusShape, synthReplyPcm, encodeReply,
  loadOpus, PROTOCOL, PATH, SYNTHETIC_TOKEN, LIMITS, CLOSE,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const port = Number(opt('--port', '8806'));
  const outDir = opt('--out', path.join(process.cwd(), '.s8b-06-device-proof'));
  const gateway = createGateway({ out: outDir });
  gateway.listen(port).then((p) => process.stdout.write(`[s806-gateway] listening on 127.0.0.1:${p}${PATH} (evidence → ${outDir})\n`));
}
