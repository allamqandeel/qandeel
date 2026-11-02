#!/usr/bin/env node
/**
 * S8B-04 CP2 — the automatic voice reply, END TO END on a device, against a LOCAL fake server. VALIDATION TOOLING ONLY.
 *
 * It stands in for the whole CP2 server so the PRODUCTION mobile surface (S804UiProof: ConversationSurface + the Voice
 * Note slots + the real Session runtime, recorder, PCM stream and player) can be shown and captured for the Product
 * Owner's gate, for free: the voice capability (consent pre-granted to the version the app pins, VOICE_RECORDING_V3),
 * the Voice Note upload (`?liveId=&liveChunks=` → transcriptReady), the live note (D-S1), the commit with
 * `?auto=1` → REPLYING, the live reply (status long-poll, ONE audio stream with a final length announced at its end,
 * DELETE), the recording's playback and the Conversation history.
 *
 * The reply's audio is, for Arabic, a sample QANDEEL's voice already produced in S8B-01 (no new synthesis, nothing paid),
 * paced as Gemini Flash would deliver it (first byte after 655 ms, RTF 0.45); for English, a generated test tone. The
 * reply's words are released in two pieces, as the incremental release guard would release them.
 *
 * Proof switches (GET /fv/mode?audio=ok|fail&status=ok|gone): `fail` refuses the audio stream (the FAILED line, T2-06);
 * `gone` answers every live-reply read 404 (the reply's voice is no longer available, T2-07).
 *
 * Logs carry kinds, sizes, counters and whether the bearer was in a header: never audio, a token or a transcript.
 *
 *   node scripts/s8b-04/fake-auto-reply-server.cjs [--out <dir>]        (127.0.0.1:8805; adb reverse tcp:8805 tcp:8805)
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(process.cwd(), '.s8b-04-auto-reply-proof');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8805;
const TOKEN = 'Bearer s804-ui-proof-token';
const CONSENT_VERSION = 'VOICE_RECORDING_V3'; // the version the app pins (0188, approved at the CP2 gate)
const SESSION_AR = 'd0000000-0000-4000-8000-000000000804';
const SESSION_EN = 'd0000000-0000-4000-8000-000000000805';
const SAMPLE_AR = 'E:/s8b01/artifacts/evals/s8b-01/cloud/s8b01-cp2-cloud-r1/audio/C0497.wav';
const SCRIPT = {
  [SESSION_AR]: { transcript: 'رجعنا من الرحلة النهارده، كانت طويلة.', pieces: ['وصلنا إلى البر', ' بعد رحلة طويلة في البحر.'] },
  [SESSION_EN]: { transcript: 'We got back from the trip today, it was long.', pieces: ['That sounds like a long day.', ' How are you feeling now?'] },
};
const RATE = 24000;
const BPMS = (RATE * 2) / 1000;
const FIRST_BYTE_MS = 655;
const RTF = 0.45;
const mode = { audio: 'ok', status: 'ok' };
const log = (o) => fs.appendFileSync(path.join(OUT, 'results.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...o })}\n`);
const iso = (ms = Date.now()) => new Date(ms).toISOString();
const json = (res, status, body) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
const readBody = async (req) => { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c); };

function pcmFor(session) {
  if (session === SESSION_AR && fs.existsSync(SAMPLE_AR)) {
    const wav = fs.readFileSync(SAMPLE_AR);
    const at = wav.indexOf('data') + 8;
    return wav.subarray(at);
  }
  const ms = 3600;
  const n = (ms * RATE) / 1000;
  const buf = Buffer.alloc(n * 2);
  for (let k = 0; k < n; k += 1) {
    const t = k / RATE;
    const env = 0.35 + 0.3 * Math.max(0, Math.sin(2 * Math.PI * 4 * t));
    buf.writeInt16LE(Math.round(32767 * 0.4 * env * Math.sin(2 * Math.PI * 330 * t)), k * 2);
  }
  return buf;
}

function wavHeader(dataBytes) {
  const h = Buffer.alloc(44);
  const known = dataBytes !== null;
  h.write('RIFF', 0); h.writeUInt32LE(known ? 36 + dataBytes : 0xffffffff, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(known ? dataBytes : 0xffffffff, 40);
  return h;
}

/** session → { turns: [{ userId, replyId?, content, at, recording, reply: { … } | null, replyText }] } */
const sessions = new Map([[SESSION_AR, []], [SESSION_EN, []]]);
const recordings = new Map(); // recordingId → { file, session, durationMs, live }
const commands = new Map(); // commandId → recordingId
const replies = new Map(); // replyId → reply

function startReply(session, turn) {
  const pcm = pcmFor(session);
  const reply = { id: crypto.randomUUID(), session, turn, startedAt: Date.now(), pcm, chunks: [], complete: false, cancelled: false, listeners: new Set(), assistantId: crypto.randomUUID() };
  const audioMs = Math.round(pcm.length / BPMS);
  // Released pieces: the first at 900 ms, the second at 1600 ms (as the release guard would release them).
  reply.releaseAt = [900, 1600];
  // Synthesis starts at the first release, then streams at RTF; one production, replayed from the store.
  setTimeout(() => {
    let sent = 0;
    const step = () => {
      if (reply.cancelled) { reply.complete = true; reply.listeners.forEach((l) => l(null)); return; }
      if (sent >= pcm.length) { reply.complete = true; reply.listeners.forEach((l) => l(null)); log({ kind: 'reply_synthesized', audioMs }); return; }
      const chunk = pcm.subarray(sent, Math.min(pcm.length, sent + 100 * BPMS));
      sent += chunk.length;
      reply.chunks.push(chunk);
      reply.listeners.forEach((l) => l(chunk));
      setTimeout(step, 100 * RTF);
    };
    step();
  }, 900 + FIRST_BYTE_MS);
  replies.set(reply.id, reply);
  return reply;
}

function released(reply) {
  const pieces = SCRIPT[reply.session].pieces;
  const elapsed = Date.now() - reply.startedAt;
  return pieces.filter((_, i) => reply.releaseAt[i] <= elapsed).join('');
}

function exchangeOf(session, t) {
  const at = t.at;
  return {
    userTurn: { id: t.userId, session_id: session, role: 'USER', status: 'COMPLETED', content: t.content, idempotency_key: null, created_at: at },
    assistantTurn: { id: t.reply.assistantId, session_id: session, role: 'ASSISTANT', status: 'COMPLETED', source_turn_id: t.userId, content: t.replyText, created_at: at },
  };
}

function view(reply) {
  const text = released(reply);
  const allText = text.length === SCRIPT[reply.session].pieces.join('').length;
  const state = reply.cancelled ? 'CANCELLED' : reply.complete ? 'COMPLETE' : 'STREAMING';
  const durationMs = reply.complete ? Math.round(reply.chunks.reduce((a, c) => a + c.length, 0) / BPMS) : null;
  if (allText && !reply.turn.replyText) reply.turn.replyText = text;
  const body = { state, audio: reply.complete ? { final: true, durationMs } : { final: false }, assistantTurnId: allText ? reply.assistantId : null, text };
  if (allText) body.exchange = exchangeOf(reply.session, reply.turn);
  return body;
}

async function status(req, res, url, reply) {
  const have = Number(url.searchParams.get('have') ?? 0);
  const final = url.searchParams.get('final') === '1';
  const done = url.searchParams.get('done') === '1';
  const until = Date.now() + Math.min(20000, Number(url.searchParams.get('wait') ?? 0));
  const newer = (v) => v.text.length > have || (v.audio.final && !final) || (v.exchange && !done) || v.state === 'CANCELLED';
  let closed = false;
  req.on('close', () => { closed = true; });
  let v = view(reply);
  while (!newer(v) && Date.now() < until && !closed) { await new Promise((r) => setTimeout(r, 50)); v = view(reply); }
  if (!closed) json(res, 200, v);
}

function audio(req, res, reply) {
  const replay = reply.complete;
  res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store, private' });
  res.write(wavHeader(replay ? reply.chunks.reduce((a, c) => a + c.length, 0) : null));
  for (const c of reply.chunks) res.write(c);
  if (reply.complete) { res.end(); log({ kind: 'audio_served', replay }); return; }
  const on = (c) => { if (c === null) { res.end(); reply.listeners.delete(on); log({ kind: 'audio_served', replay }); } else res.write(c); };
  reply.listeners.add(on);
  req.on('close', () => reply.listeners.delete(on));
}

function serveFile(req, res, file) {
  const size = fs.statSync(file).size;
  const m = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  let start = 0, end = size - 1, code = 200;
  if (m) { start = m[1] === '' ? size - Number(m[2]) : Number(m[1]); end = m[1] !== '' && m[2] !== '' ? Math.min(Number(m[2]), size - 1) : size - 1; code = 206; }
  res.writeHead(code, { 'Content-Type': 'audio/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store, private', ...(code === 206 ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
  fs.createReadStream(file, { start, end }).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  let m;
  try {
    if (p === '/fv/mode') {
      if (url.searchParams.get('audio')) mode.audio = url.searchParams.get('audio');
      if (url.searchParams.get('status')) mode.status = url.searchParams.get('status');
      log({ kind: 'mode', ...mode });
      return json(res, 200, mode);
    }
    if (p === '/fv/reset') {
      for (const s of sessions.keys()) sessions.set(s, []);
      replies.clear();
      log({ kind: 'reset' });
      return json(res, 200, { ok: true });
    }
    const authed = req.headers.authorization === TOKEN;
    if (!authed) { log({ kind: 'unauthorized', path: p.split('/').slice(0, 3).join('/') }); return json(res, 401, {}); }
    if (req.method === 'GET' && p === '/voice/capability') return json(res, 200, { voiceNotesAvailable: true, consentState: 'GRANTED_CURRENT', grantedVersion: CONSENT_VERSION, currentVersion: CONSENT_VERSION });
    if (req.method === 'GET' && p === '/voice/notes/pending') return json(res, 200, { notes: [] });
    if (req.method === 'POST' && p === '/voice/live-notes') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      log({ kind: 'live_note_opened', session: body.sessionId === SESSION_AR ? 'ar' : 'en' });
      return json(res, 200, { outcome: 'OPENED' });
    }
    if ((m = /^\/voice\/live-notes\/([^/]+)\/audio$/.exec(p)) && req.method === 'POST') { await readBody(req); return json(res, 200, { outcome: 'APPENDED' }); }
    if ((m = /^\/voice\/live-notes\/([^/]+)$/.exec(p)) && req.method === 'DELETE') { log({ kind: 'live_note_cancelled' }); return json(res, 200, { outcome: 'CANCELLED' }); }
    if (req.method === 'POST' && (m = /^\/voice\/notes\/([^/]+)\/([^/]+)$/.exec(p)) && m[2] !== 'turn') {
      const body = await readBody(req);
      const session = m[1];
      let id = commands.get(m[2]);
      if (!id) {
        id = crypto.randomUUID();
        const file = path.join(OUT, `ui-${id.slice(0, 8)}.m4a`);
        fs.writeFileSync(file, body);
        const chunks = Number(url.searchParams.get('liveChunks') ?? 0);
        recordings.set(id, { file, session, durationMs: chunks ? chunks * 250 : null, live: url.searchParams.has('liveId') });
        commands.set(m[2], id);
        log({ kind: 'upload', bytes: body.length, live: url.searchParams.has('liveId'), liveChunks: chunks });
      }
      const r = recordings.get(id);
      return json(res, 200, { outcome: 'ACCEPTED', recordingId: id, acceptedAt: iso(), availableUntil: iso(Date.now() + 30 * 864e5), transcriptReady: r.live });
    }
    if (req.method === 'GET' && (m = /^\/voice\/notes\/([^/]+)\/status$/.exec(p))) {
      const r = recordings.get(m[1]);
      if (!r) return json(res, 404, {});
      return json(res, 200, { recordingId: m[1], sessionId: r.session, status: r.turn ? 'COMMITTED' : 'READY', failure: null, canRetry: false, turnId: r.turn ? r.turn.userId : null, recordingAvailable: true, availableUntil: iso(Date.now() + 30 * 864e5), durationMs: r.durationMs });
    }
    if (req.method === 'POST' && (m = /^\/voice\/notes\/([^/]+)\/turn$/.exec(p))) {
      const r = recordings.get(m[1]);
      if (!r) return json(res, 404, {});
      const auto = url.searchParams.get('auto') === '1';
      if (!r.turn) {
        r.turn = { userId: crypto.randomUUID(), content: SCRIPT[r.session].transcript, at: iso(), recording: m[1], reply: null, replyText: null };
        sessions.get(r.session).push(r.turn);
        if (auto) r.turn.reply = startReply(r.session, r.turn);
      }
      log({ kind: 'commit', auto, replying: Boolean(r.turn.reply) });
      if (r.turn.reply) return json(res, 200, { outcome: 'REPLYING', turnId: r.turn.userId, replyId: r.turn.reply.id });
      r.turn.replyText = r.turn.replyText ?? SCRIPT[r.session].pieces.join('');
      r.turn.reply = { assistantId: crypto.randomUUID() };
      return json(res, 200, exchangeOf(r.session, r.turn));
    }
    if ((m = /^\/voice\/live-replies\/([^/]+)(\/audio)?$/.exec(p))) {
      const reply = replies.get(m[1]);
      if (!reply || mode.status === 'gone') return json(res, 404, { outcome: 'NOT_FOUND' });
      if (req.method === 'DELETE') { reply.cancelled = !reply.complete; log({ kind: 'reply_cancel', effective: reply.cancelled }); return json(res, 200, { outcome: 'STOPPED' }); }
      if (m[2]) {
        log({ kind: 'audio_request', bearerInHeader: true, mode: mode.audio });
        if (mode.audio === 'fail') return json(res, 503, { outcome: 'UNAVAILABLE' });
        return audio(req, res, reply);
      }
      return status(req, res, url, reply);
    }
    if (req.method === 'GET' && (m = /^\/voice\/recordings\/([^/]+)\/objects\/NOTE\/0$/.exec(p))) {
      const r = recordings.get(m[1]);
      if (!r) return json(res, 404, {});
      return serveFile(req, res, r.file);
    }
    if ((m = /^\/conversation\/sessions\/([^/]+)\/turns$/.exec(p)) && sessions.has(m[1])) {
      if (req.method === 'POST') {
        const body = JSON.parse((await readBody(req)).toString() || '{}');
        const t = { userId: crypto.randomUUID(), content: String(body.content ?? ''), at: iso(), recording: null, reply: { assistantId: crypto.randomUUID() }, replyText: m[1] === SESSION_AR ? 'رد نصي.' : 'A text reply.' };
        sessions.get(m[1]).push(t);
        return json(res, 200, exchangeOf(m[1], t));
      }
      const exchanges = sessions.get(m[1]).map((t) => {
        const done = t.replyText !== null && t.reply !== null;
        return {
          userTurn: { id: t.userId, content: t.content, idempotencyKey: null, createdAt: t.at },
          replyState: done ? 'COMPLETED' : 'PENDING',
          assistantTurn: done ? { id: t.reply.assistantId, content: t.replyText, createdAt: t.at } : null,
          ...(t.recording ? { voiceNote: { recordingId: t.recording, available: true, availableUntil: iso(Date.now() + 30 * 864e5), durationMs: recordings.get(t.recording).durationMs } } : {}),
        };
      });
      return json(res, 200, { exchanges, hasOlder: false });
    }
    log({ kind: 'other', method: req.method, path: p.split('/').slice(0, 3).join('/') });
    return json(res, 404, {});
  } catch (error) {
    log({ kind: 'server_error', message: String(error && error.message) });
    if (!res.headersSent) json(res, 500, {});
  }
}).listen(PORT, '127.0.0.1', () => process.stdout.write(`fake-auto-reply-server on 127.0.0.1:${PORT} → ${OUT}\n`));
