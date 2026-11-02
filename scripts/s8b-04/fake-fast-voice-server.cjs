#!/usr/bin/env node
/**
 * S8B-04 CP2 — Fast Voice Path feasibility proof: a LOCAL fake server. VALIDATION TOOLING ONLY.
 *
 * It stands in for the server side of the fast path so the phone's part can be proven for free:
 *   - a "turn" is a list of released sentences, each released at a simulated time (as DeepSeek streaming + the release
 *     guard would release them);
 *   - each released sentence is "synthesized" as 24 kHz mono 16-bit PCM, paced like Gemini Flash TTS (first audio byte
 *     after `fb` ms, then audio at real-time factor `rtf`), and streamed to the phone as a WAV whose length is unknown
 *     while it is produced;
 *   - a held sentence is never streamed; a request for it is refused;
 *   - every segment is "synthesized" ONCE: a second request while it streams joins the same production, a request after
 *     it is complete replays the stored bytes (no new "call"), and a client that disconnects does not stop the production
 *     (as a provider call already paid cannot be un-paid) but nothing more is sent to it.
 *
 * CP2 (the production client against it): the API-shaped routes the mobile client calls, on the same turn machinery —
 *   POST /voice/live-notes, POST /voice/live-notes/:liveId/audio?seq=N, DELETE /voice/live-notes/:liveId   (D-S1)
 *   GET /voice/live-replies/:replyId?wait=&have=&final=&done=, GET …/audio, DELETE …                     (auto reply)
 * plus POST /fv/live-reply/start (what the server's commit ?auto=1 would start) and GET /fv/live-notes/:liveId (what the
 * live note received: chunk count, bytes and per-chunk signal level only — the PCM itself is never stored or logged).
 *
 * The audio is a generated test signal (a tone per sentence with a syllable-like envelope), never speech and never a
 * recording. Timings are SIMULATED. It never contacts any provider. It logs only kinds, counts and times.
 *
 *   node scripts/s8b-04/fake-fast-voice-server.cjs [--port 8804] [--out <dir>]
 *   adb reverse tcp:8804 tcp:8804
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const PORT = Number(opt('--port', '8804'));
const OUT = opt('--out', path.join(process.cwd(), '.s8b-04-fast-voice-proof'));
fs.mkdirSync(OUT, { recursive: true });
const RESULTS = path.join(OUT, 'results.jsonl');

const SAMPLE_RATE = 24000;
const BYTES_PER_MS = (SAMPLE_RATE * 2) / 1000;
const CHUNK_MS = 100;
const now = () => Number(process.hrtime.bigint() / 1000000n);

// How an unknown length is written (a proof variable, switched with GET /fv/admin?hdr=…): 'ffff' | 'zero' | 'max31'.
let headerMode = 'ffff';
// The real-time factor a turn uses when the phone does not pass one (GET /fv/admin?rtf=…).
let defaultRtf = 0.45;
const UNKNOWN = { ffff: [0xffffffff, 0xffffffff], zero: [36, 0], max31: [0x7fffffff, 0x7fffffdb] };

function wavHeader(dataBytes) {
  // dataBytes === null → unknown length (the provider stream's length is unknown while it is produced).
  const h = Buffer.alloc(44);
  const [riff, data] = UNKNOWN[headerMode];
  const size = dataBytes === null ? data : dataBytes;
  h.write('RIFF', 0);
  h.writeUInt32LE(dataBytes === null ? riff : 36 + dataBytes, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SAMPLE_RATE, 24);
  h.writeUInt32LE(SAMPLE_RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(size, 40);
  return h;
}

// A test signal: a per-sentence tone with a 4 Hz syllable envelope; sample-continuous across chunks.
function pcmChunk(sentence, fromMs, ms) {
  const n = Math.round((ms * SAMPLE_RATE) / 1000);
  const buf = Buffer.alloc(n * 2);
  const freq = 220 + 110 * (sentence % 4);
  const start = Math.round((fromMs * SAMPLE_RATE) / 1000);
  for (let k = 0; k < n; k += 1) {
    const t = (start + k) / SAMPLE_RATE;
    const env = 0.35 + 0.3 * Math.max(0, Math.sin(2 * Math.PI * 4 * t));
    buf.writeInt16LE(Math.round(32767 * 0.5 * env * Math.sin(2 * Math.PI * freq * t)), k * 2);
  }
  return buf;
}

/** turnId → { startedAt, sentences: [{ text, spoken, held, releaseMs, audioMs }], segments: Map } */
const turns = new Map();
let synthesisCalls = 0;

function log(record) {
  fs.appendFileSync(RESULTS, `${JSON.stringify({ at: new Date().toISOString(), ...record })}\n`);
}

// The fixed simulated turn: sentence 2 is HELD by the release guard (never spoken); markers are never in `spoken`.
function planTurn(query) {
  const fb = Number(query.get('fb') ?? 655);
  const rtf = Number(query.get('rtf') ?? defaultRtf);
  const first = Number(query.get('first') ?? 900);
  // `gap` delays every later sentence, so its audio arrives after the previous one has finished playing (an underrun).
  const gap = Number(query.get('gap') ?? 0);
  return {
    fb,
    rtf,
    sentences: [
      { spoken: 'S0', held: false, releaseMs: first, audioMs: 2400 },
      { spoken: 'S1', held: false, releaseMs: first + 700 + gap, audioMs: 3600 },
      { spoken: null, held: true, releaseMs: null, audioMs: 0 },
      { spoken: 'S3', held: false, releaseMs: first + 1900 + gap * 2, audioMs: 3000 },
    ],
  };
}

function segmentProduction(turnId, turn, index) {
  let seg = turn.segments.get(index);
  if (seg) return seg;
  const sentence = turn.sentences[index];
  seg = { chunks: [], complete: false, listeners: new Set(), firstByteAt: null, completeAt: null, call: null };
  turn.segments.set(index, seg);
  const releaseAt = turn.startedAt + sentence.releaseMs;
  const begin = () => {
    synthesisCalls += 1;
    seg.call = synthesisCalls;
    log({ kind: 'synthesis_call', turnId, index, call: seg.call });
    let produced = 0;
    const emit = () => {
      if (produced >= sentence.audioMs) {
        seg.complete = true;
        seg.completeAt = now();
        for (const l of seg.listeners) l(null);
        log({ kind: 'synthesis_complete', turnId, index, call: seg.call, sinceTurnMs: seg.completeAt - turn.startedAt });
        return;
      }
      const ms = Math.min(CHUNK_MS, sentence.audioMs - produced);
      const chunk = pcmChunk(index, produced, ms);
      produced += ms;
      if (seg.firstByteAt === null) seg.firstByteAt = now();
      seg.chunks.push(chunk);
      for (const l of seg.listeners) l(chunk);
      setTimeout(emit, ms * turn.rtf);
    };
    setTimeout(emit, turn.fb);
  };
  setTimeout(begin, Math.max(0, releaseAt - now()));
  return seg;
}

function streamSegment(req, res, turnId, index) {
  const turn = turns.get(turnId);
  if (!turn || !turn.sentences[index]) return send(res, 404, { outcome: 'NOT_FOUND' });
  const sentence = turn.sentences[index];
  if (sentence.held) {
    log({ kind: 'held_refused', turnId, index });
    return send(res, 409, { outcome: 'HELD' });
  }
  const seg = segmentProduction(turnId, turn, index);
  const requestedAt = now();
  const replay = seg.complete;
  res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store, private' });
  res.write(wavHeader(replay ? seg.chunks.reduce((a, c) => a + c.length, 0) : null));
  let sent = 0;
  let closed = false;
  for (const chunk of seg.chunks) {
    res.write(chunk);
    sent += chunk.length;
  }
  const finish = (aborted) => {
    if (closed) return;
    closed = true;
    seg.listeners.delete(onChunk);
    log({ kind: 'segment_served', turnId, index, replay, aborted, bytes: sent, audioMs: Math.round(sent / BYTES_PER_MS), requestSinceTurnMs: requestedAt - turn.startedAt, firstByteSinceTurnMs: seg.firstByteAt === null ? null : seg.firstByteAt - turn.startedAt });
  };
  const onChunk = (chunk) => {
    if (closed) return;
    if (chunk === null) {
      res.end();
      finish(false);
      return;
    }
    res.write(chunk);
    sent += chunk.length;
  };
  if (seg.complete) {
    res.end();
    finish(false);
    return;
  }
  seg.listeners.add(onChunk);
  req.on('close', () => {
    if (!res.writableEnded) finish(true);
  });
}

// The whole reply as ONE stream: every released sentence's audio, in order, back to back (a held sentence is skipped).
// While a sentence is still produced the length is unknown; once all are complete it is a replay with a known length.
// The client learns the reply's final audio length from /status and stops itself there.
function streamReply(req, res, turnId) {
  const turn = turns.get(turnId);
  if (!turn) return send(res, 404, { outcome: 'NOT_FOUND' });
  const order = turn.sentences.map((s, i) => (s.held ? null : i)).filter((i) => i !== null);
  const segs = order.map((i) => segmentProduction(turnId, turn, i));
  const requestedAt = now();
  const replay = segs.every((seg) => seg.complete);
  res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store, private' });
  res.write(wavHeader(replay ? segs.reduce((a, seg) => a + seg.chunks.reduce((b, c) => b + c.length, 0), 0) : null));
  let sent = 0;
  let closed = false;
  let k = 0;
  let offset = 0;
  let firstByteAt = null;
  const finish = (aborted) => {
    if (closed) return;
    closed = true;
    for (const seg of segs) seg.listeners.delete(pump);
    log({ kind: 'reply_served', turnId, replay, aborted, bytes: sent, audioMs: Math.round(sent / BYTES_PER_MS), requestSinceTurnMs: requestedAt - turn.startedAt, firstByteSinceRequestMs: firstByteAt === null ? null : firstByteAt - requestedAt });
  };
  function pump() {
    if (closed) return;
    while (k < segs.length) {
      const seg = segs[k];
      while (offset < seg.chunks.length) {
        if (firstByteAt === null) firstByteAt = now();
        res.write(seg.chunks[offset]);
        sent += seg.chunks[offset].length;
        offset += 1;
      }
      if (!seg.complete) return;
      seg.listeners.delete(pump);
      k += 1;
      offset = 0;
      if (k < segs.length) segs[k].listeners.add(pump);
    }
    res.end();
    finish(false);
  }
  if (segs.length) segs[0].listeners.add(pump);
  req.on('close', () => {
    if (!res.writableEnded) finish(true);
  });
  pump();
}

function replyStatus(res, turnId) {
  const turn = turns.get(turnId);
  if (!turn) return send(res, 404, { outcome: 'NOT_FOUND' });
  const order = turn.sentences.map((s, i) => (s.held ? null : i)).filter((i) => i !== null);
  const segs = order.map((i) => turn.segments.get(i));
  const complete = segs.every((seg) => seg && seg.complete);
  const producedMs = segs.reduce((a, seg) => a + (seg ? Math.round(seg.chunks.reduce((b, c) => b + c.length, 0) / BYTES_PER_MS) : 0), 0);
  return send(res, 200, { complete, audioMs: complete ? producedMs : null, producedMs });
}

// ------------------------------------------------------------------------------------------- CP2 API-shaped routes

/** liveId → { sessionId, chunks, bytes, rms: number[], outOfOrder, cancelled } */
const liveNotes = new Map();
/** replyId → { turnId, userTurnId, assistantTurnId, cancelled, bearerSeen } */
const liveReplies = new Map();
const SENTENCE_TEXT = ['طبخت الأرز النهارده.', 'وبعدين قعدنا نتكلم شوية.', null, 'وكان يوم حلو.'];
const uuid = () => require('node:crypto').randomUUID();

function pcmRms(buf) {
  const n = Math.floor(buf.length / 2);
  if (n === 0) return 0;
  let sum = 0;
  for (let k = 0; k < n; k += 1) {
    const v = buf.readInt16LE(k * 2) / 32768;
    sum += v * v;
  }
  return Math.round(Math.sqrt(sum / n) * 10000) / 10000;
}

/** What the reply has released so far (a held sentence never appears), and whether its audio is complete. */
function liveReplyView(reply) {
  const turn = turns.get(reply.turnId);
  const elapsed = now() - turn.startedAt;
  const released = turn.sentences.map((x, i) => (!x.held && x.releaseMs <= elapsed ? SENTENCE_TEXT[i] : null)).filter(Boolean);
  const order = turn.sentences.map((x, i) => (x.held ? null : i)).filter((i) => i !== null);
  const segs = order.map((i) => turn.segments.get(i));
  const complete = segs.every((seg) => seg && seg.complete);
  const durationMs = complete ? segs.reduce((a, seg) => a + Math.round(seg.chunks.reduce((b, c) => b + c.length, 0) / BYTES_PER_MS), 0) : null;
  const text = released.join(' ');
  const allReleased = released.length === order.length;
  const state = reply.cancelled ? 'CANCELLED' : complete ? 'COMPLETE' : 'STREAMING';
  const body = { state, audio: { final: complete, durationMs }, assistantTurnId: allReleased ? reply.assistantTurnId : null, text };
  if (allReleased) {
    const at = new Date().toISOString();
    body.exchange = {
      userTurn: { id: reply.userTurnId, role: 'USER', status: 'COMPLETED', content: 'رسالة صوتية تجريبية', idempotency_key: null, created_at: at },
      assistantTurn: { id: reply.assistantTurnId, role: 'ASSISTANT', status: 'COMPLETED', source_turn_id: reply.userTurnId, content: text, created_at: at },
    };
  }
  return body;
}

async function liveReplyStatus(req, res, url, replyId) {
  const reply = liveReplies.get(replyId);
  if (!reply) return send(res, 404, { outcome: 'NOT_FOUND' });
  const have = Number(url.searchParams.get('have') ?? 0);
  const final = url.searchParams.get('final') === '1';
  const done = url.searchParams.get('done') === '1';
  const waitMs = Math.min(20000, Number(url.searchParams.get('wait') ?? 0));
  const newer = (v) => v.text.length > have || (v.audio.final && !final) || (v.exchange !== undefined && !done) || v.state === 'CANCELLED';
  const until = now() + waitMs;
  let view = liveReplyView(reply);
  let closed = false;
  req.on('close', () => { closed = true; });
  while (!newer(view) && now() < until && !closed) {
    await new Promise((r) => setTimeout(r, 50));
    view = liveReplyView(reply);
  }
  if (closed) return undefined;
  log({ kind: 'live_reply_status', replyId: replyId.slice(0, 8), state: view.state, textLength: view.text.length, final: view.audio.final, durationMs: view.audio.durationMs, exchange: view.exchange !== undefined });
  return send(res, 200, view);
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    const parts = [];
    req.on('data', (c) => parts.push(c));
    req.on('end', () => resolve(Buffer.concat(parts)));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'GET' && url.pathname === '/fv/health') return send(res, 200, { ok: true, synthesisCalls, headerMode });
    if (req.method === 'GET' && url.pathname === '/fv/admin') {
      const mode = url.searchParams.get('hdr');
      if (mode && UNKNOWN[mode]) headerMode = mode;
      if (url.searchParams.get('rtf')) defaultRtf = Number(url.searchParams.get('rtf'));
      log({ kind: 'admin', headerMode, defaultRtf });
      return send(res, 200, { headerMode, defaultRtf });
    }
    if (req.method === 'POST' && url.pathname === '/fv/turn/start') {
      const turnId = `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
      const plan = planTurn(url.searchParams);
      const turn = { ...plan, startedAt: now(), segments: new Map() };
      turns.set(turnId, turn);
      // auto=1: the server starts every released sentence's synthesis itself, at its release (D-S3), with no phone request.
      if (url.searchParams.get('auto') === '1') turn.sentences.forEach((s, i) => { if (!s.held) segmentProduction(turnId, turn, i); });
      log({ kind: 'turn_started', turnId, fb: plan.fb, rtf: plan.rtf, released: plan.sentences.map((s, i) => (s.held ? null : { i, releaseMs: s.releaseMs, audioMs: s.audioMs })) });
      // The phone is told only the released sentences' indexes, in order (a held sentence is never offered).
      return send(res, 200, { turnId, segments: plan.sentences.map((s, i) => (s.held ? null : i)).filter((i) => i !== null) });
    }
    if (req.method === 'GET' && parts[0] === 'fv' && parts[1] === 'seg' && parts.length === 4) {
      return streamSegment(req, res, parts[2], Number(parts[3]));
    }
    if (req.method === 'GET' && parts[0] === 'fv' && parts[1] === 'reply' && parts.length === 3) return streamReply(req, res, parts[2]);
    if (req.method === 'GET' && parts[0] === 'fv' && parts[1] === 'reply' && parts.length === 4 && parts[3] === 'status') return replyStatus(res, parts[2]);
    if (req.method === 'POST' && url.pathname === '/fv/log') {
      const body = await readBody(req);
      log({ kind: 'client', ...JSON.parse(body.toString('utf8')) });
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/fv/upload') {
      const body = await readBody(req);
      const name = (url.searchParams.get('name') ?? 'upload').replace(/[^a-z0-9._-]/gi, '_');
      fs.writeFileSync(path.join(OUT, name), body);
      log({ kind: 'upload', name, bytes: body.length });
      return send(res, 200, { ok: true, bytes: body.length });
    }
    // CP2: what the server's commit ?auto=1 would start — a turn whose synthesis the server starts itself (D-S3).
    if (req.method === 'POST' && url.pathname === '/fv/live-reply/start') {
      const turnId = `t${Date.now().toString(36)}`;
      const plan = planTurn(url.searchParams);
      const turn = { ...plan, startedAt: now(), segments: new Map() };
      turns.set(turnId, turn);
      turn.sentences.forEach((x, i) => { if (!x.held) segmentProduction(turnId, turn, i); });
      const replyId = uuid();
      liveReplies.set(replyId, { turnId, userTurnId: uuid(), assistantTurnId: uuid(), cancelled: false, bearerSeen: false });
      log({ kind: 'live_reply_started', replyId: replyId.slice(0, 8), turnId });
      return send(res, 200, { replyId, turnId: liveReplies.get(replyId).userTurnId });
    }
    if (parts[0] === 'voice' && parts[1] === 'live-replies' && parts.length >= 3) {
      const reply = liveReplies.get(parts[2]);
      if (req.method === 'GET' && parts.length === 3) return liveReplyStatus(req, res, url, parts[2]);
      if (!reply) return send(res, 404, { outcome: 'NOT_FOUND' });
      if (req.method === 'GET' && parts[3] === 'audio') {
        const bearer = /^Bearer \S+$/u.test(req.headers.authorization ?? '');
        reply.bearerSeen = reply.bearerSeen || bearer;
        log({ kind: 'live_reply_audio_request', replyId: parts[2].slice(0, 8), bearerInHeader: bearer, tokenInUrl: url.search.length > 0 });
        return streamReply(req, res, reply.turnId);
      }
      if (req.method === 'DELETE' && parts.length === 3) {
        reply.cancelled = true;
        log({ kind: 'live_reply_cancelled', replyId: parts[2].slice(0, 8) });
        return send(res, 200, { outcome: 'STOPPED' });
      }
    }
    if (parts[0] === 'voice' && parts[1] === 'live-notes') {
      if (req.method === 'POST' && parts.length === 2) {
        const body = JSON.parse((await readBody(req)).toString('utf8'));
        liveNotes.set(body.liveId, { sessionId: body.sessionId, chunks: 0, bytes: 0, rms: [], outOfOrder: 0, cancelled: false });
        log({ kind: 'live_note_opened', liveId: String(body.liveId).slice(0, 8) });
        return send(res, 200, { outcome: 'OPENED' });
      }
      const note = liveNotes.get(parts[2]);
      if (!note) return send(res, 404, { outcome: 'NOT_FOUND' });
      if (req.method === 'POST' && parts[3] === 'audio') {
        const chunk = await readBody(req);
        if (Number(url.searchParams.get('seq')) !== note.chunks) {
          note.outOfOrder += 1;
          return send(res, 409, { outcome: 'OUT_OF_ORDER' });
        }
        note.chunks += 1;
        note.bytes += chunk.length;
        note.rms.push(pcmRms(chunk));
        return send(res, 200, { outcome: 'APPENDED' });
      }
      if (req.method === 'DELETE' && parts.length === 3) {
        note.cancelled = true;
        log({ kind: 'live_note_cancelled', liveId: parts[2].slice(0, 8) });
        return send(res, 200, { outcome: 'CANCELLED' });
      }
    }
    if (req.method === 'GET' && parts[0] === 'fv' && parts[1] === 'live-notes' && parts.length === 3) {
      const note = liveNotes.get(parts[2]);
      if (!note) return send(res, 404, { outcome: 'NOT_FOUND' });
      const audible = note.rms.filter((r) => r >= 0.003).length;
      const summary = { chunks: note.chunks, bytes: note.bytes, audioMs: Math.round(note.bytes / 32), outOfOrder: note.outOfOrder, cancelled: note.cancelled, maxRms: Math.max(0, ...note.rms), audibleChunks: audible };
      log({ kind: 'live_note_summary', liveId: parts[2].slice(0, 8), ...summary });
      return send(res, 200, summary);
    }
    return send(res, 404, { outcome: 'NOT_FOUND' });
  } catch (error) {
    log({ kind: 'server_error', message: String(error && error.message) });
    if (!res.headersSent) send(res, 500, { outcome: 'ERROR' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`fake-fast-voice-server on 127.0.0.1:${PORT}, results → ${RESULTS}\n`);
});
