// S8B-03 CP2 — validation-only fake of the CP1 voice routes + the conversation turn routes, for the production Voice
// Note UI on a device or the iOS Simulator (one Session: SESSION_UI). Fake transcription: a note turns READY a few seconds
// after it is accepted, with a fixed fake transcript; nothing paid, nothing real. The consent text is the server's own
// (C-01 … C-11, version VOICE_RECORDING_V1, from the built API). Faults are injected by toggle files in S803_OUT:
//
//   s803-gate-closed     capability says unavailable; an upload answers NOT_AVAILABLE_NOW
//   s803-fail            the fake transcription fails (FAILED_RETRYABLE, canRetry)
//   s803-drop-before     an upload's socket is destroyed BEFORE anything is stored (network cut during upload)
//   s803-drop-after      the note is stored, then the socket is destroyed (the reply to ACCEPTED is lost)
//   s803-drop-status     every status read's socket is destroyed (network cut after ACCEPTED)
//   s803-expire          every recording reads as past its period (C-37)
//
// Logs carry only kinds, outcomes, sizes and counters: never audio, a token, a transcript or a recording id.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SESSION_UI = 'd0000000-0000-4000-8000-000000000803';
const consentText = require(path.join(__dirname, '../../apps/api/dist/voice-media/voice-consent-text.js'));
const CONSENT = { version: consentText.VOICE_CONSENT_VERSION, rows: consentText.VOICE_CONSENT_ROWS };
const TRANSCRIPT = 'نص تجريبي من خادم التفريغ الوهمي. Fake transcript from the fake transcription server.';
const READY_AFTER_MS = 5000;

const toggle = (name) => fs.existsSync(path.join(process.env.S803_OUT, name));
const state = { consent: 'NONE', grantedVersion: null, records: new Map(), commands: new Map(), turns: [], order: 0 };
const iso = (ms) => new Date(ms).toISOString();

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}
function statusOf(r) {
  if (r.turn) return 'COMMITTED';
  if (r.failed) return 'FAILED_RETRYABLE';
  if (Date.now() >= r.readyAt) {
    if (r.failNext) {
      r.failed = true;
      return 'FAILED_RETRYABLE';
    }
    return 'READY';
  }
  return 'PROCESSING';
}
function voiceView(r) {
  const expired = toggle('s803-expire');
  return { recordingId: r.recordingId, available: !r.deleted && !expired, availableUntil: r.deleted ? null : expired ? iso(Date.now() - 864e5) : r.availableUntil, durationMs: r.durationMs };
}
function turnRows(t) {
  return {
    userTurn: { id: t.userId, session_id: SESSION_UI, role: 'USER', status: 'COMPLETED', content: t.content, processing_path: 'FAST', routing_reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT', source_turn_id: null, idempotency_key: t.key, created_at: t.at, updated_at: t.at, completed_at: t.at },
    assistantTurn: { id: t.replyId, session_id: SESSION_UI, role: 'ASSISTANT', status: 'COMPLETED', content: t.reply, processing_path: 'FAST', routing_reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT', source_turn_id: t.userId, idempotency_key: null, created_at: t.at, updated_at: t.at, completed_at: t.at },
  };
}
function addTurn(content, key, recording) {
  const at = iso(Date.now());
  const t = { userId: crypto.randomUUID(), replyId: crypto.randomUUID(), content, key, at, reply: 'رد نصي تجريبي. A fake text reply.', recording };
  state.turns.push(t);
  return t;
}

/** Answers one request when it is a route this fake owns; returns false otherwise. */
async function handle(req, res, url, authed, ctx) {
  const p = url.pathname;
  let m;
  const own = p.startsWith('/voice/') || p.startsWith(`/conversation/sessions/${SESSION_UI}/`);
  if (!own) return false;
  // The native-capability proof keeps its own upload / playback routes for its own Session.
  if ((m = /^\/voice\/notes\/([^/]+)\/([^/]+)$/.exec(p)) && req.method === 'POST' && m[2] !== 'turn' && m[1] !== SESSION_UI) return false;
  if (/^\/voice\/recordings\/[^/]+\/objects\/NOTE\/0$/.test(p) && ![...state.records.values()].some((r) => p.includes(r.recordingId))) return false;
  if (!authed) {
    json(res, 401, {});
    ctx.log({ kind: 'ui-unauthorized', path: p.split('/').slice(0, 3).join('/') });
    return true;
  }

  if (req.method === 'GET' && p === '/voice/capability') {
    const available = !toggle('s803-gate-closed');
    ctx.log({ kind: 'ui-capability', available, consent: state.consent });
    json(res, 200, { voiceNotesAvailable: available, consentState: state.consent, grantedVersion: state.grantedVersion, currentVersion: CONSENT.version });
    return true;
  }
  if (req.method === 'GET' && p === '/voice/consent') {
    json(res, 200, { consentState: state.consent, consentVersion: CONSENT.version, rows: CONSENT.rows });
    return true;
  }
  if (req.method === 'POST' && p === '/voice/consent/grant') {
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    if (body.version !== CONSENT.version) {
      json(res, 200, { outcome: 'VERSION_NOT_CURRENT' });
      return true;
    }
    state.consent = 'GRANTED';
    state.grantedVersion = body.version;
    ctx.log({ kind: 'ui-consent', outcome: 'GRANTED' });
    json(res, 200, { outcome: 'GRANTED' });
    return true;
  }
  if (req.method === 'POST' && p === '/voice/consent/withdraw') {
    await readBody(req);
    state.consent = 'WITHDRAWN';
    state.grantedVersion = null;
    ctx.log({ kind: 'ui-consent', outcome: 'WITHDRAWN' });
    json(res, 200, { outcome: 'WITHDRAWN' });
    return true;
  }
  if (req.method === 'POST' && (m = /^\/voice\/notes\/([^/]+)\/([^/]+)$/.exec(p)) && m[2] !== 'turn') {
    if (toggle('s803-drop-before')) {
      ctx.log({ kind: 'ui-upload', injected: 'drop-before' });
      req.socket.destroy();
      return true;
    }
    const body = await readBody(req);
    const commandId = m[2];
    if (toggle('s803-gate-closed')) return json(res, 200, { outcome: 'NOT_AVAILABLE_NOW' }), true;
    if (state.consent !== 'GRANTED') return json(res, 200, { outcome: 'CONSENT_REQUIRED' }), true;
    let r = state.records.get(state.commands.get(commandId));
    const replay = r !== undefined;
    if (!replay) {
      const recordingId = crypto.randomUUID();
      const file = path.join(ctx.out, `ui-${recordingId.slice(0, 8)}.m4a`);
      fs.writeFileSync(file, body);
      const proof = await ctx.prove(file).catch(() => null);
      const now = Date.now();
      r = { recordingId, file, acceptedAt: iso(now), availableUntil: iso(now + 30 * 864e5), durationMs: proof && proof.kind === 'PROVEN' ? proof.durationMs : null, readyAt: now + READY_AFTER_MS, failNext: toggle('s803-fail'), failed: false, turn: null, deleted: false };
      state.records.set(recordingId, r);
      state.commands.set(commandId, recordingId);
      ctx.notes.set(recordingId, file);
      ctx.log({ kind: 'ui-upload', outcome: 'ACCEPTED', bytes: body.length, proof: proof && proof.kind, durationMs: r.durationMs, notes: state.records.size });
    } else {
      ctx.log({ kind: 'ui-upload', outcome: 'ACCEPTED', replay: true, notes: state.records.size });
    }
    if (toggle('s803-drop-after')) {
      ctx.log({ kind: 'ui-upload', injected: 'drop-after' });
      req.socket.destroy();
      return true;
    }
    json(res, 200, { outcome: 'ACCEPTED', recordingId: r.recordingId, acceptedAt: r.acceptedAt, availableUntil: r.availableUntil });
    return true;
  }
  if (req.method === 'GET' && p === '/voice/notes/pending') {
    const notes = [...state.records.values()].filter((r) => !r.turn && !r.deleted).map((r) => ({ recordingId: r.recordingId, status: statusOf(r), availableUntil: r.availableUntil, durationMs: r.durationMs }));
    ctx.log({ kind: 'ui-pending', notes: notes.length });
    json(res, 200, { notes });
    return true;
  }
  if (req.method === 'GET' && (m = /^\/voice\/notes\/([^/]+)\/status$/.exec(p))) {
    if (toggle('s803-drop-status')) {
      ctx.log({ kind: 'ui-status', injected: 'drop-status' });
      req.socket.destroy();
      return true;
    }
    const r = state.records.get(m[1]);
    if (!r || r.deleted) return json(res, 404, {}), true;
    const s = statusOf(r);
    ctx.log({ kind: 'ui-status', status: s });
    json(res, 200, { recordingId: r.recordingId, sessionId: SESSION_UI, status: s, failure: s === 'FAILED_RETRYABLE' ? 'PROCESSING' : null, canRetry: s === 'FAILED_RETRYABLE', turnId: r.turn ? r.turn.userId : null, recordingAvailable: !r.deleted, availableUntil: r.availableUntil, durationMs: r.durationMs });
    return true;
  }
  if (req.method === 'POST' && (m = /^\/voice\/notes\/([^/]+)\/transcription\/retry$/.exec(p))) {
    const r = state.records.get(m[1]);
    if (!r || statusOf(r) !== 'FAILED_RETRYABLE') return json(res, 200, { outcome: 'NOT_RETRYABLE' }), true;
    r.failed = false;
    r.failNext = toggle('s803-fail');
    r.readyAt = Date.now() + READY_AFTER_MS;
    ctx.log({ kind: 'ui-retry', outcome: 'RETRY_SCHEDULED' });
    json(res, 200, { outcome: 'RETRY_SCHEDULED' });
    return true;
  }
  if (req.method === 'POST' && (m = /^\/voice\/notes\/([^/]+)\/turn$/.exec(p))) {
    const r = state.records.get(m[1]);
    if (!r || r.deleted) return json(res, 404, {}), true;
    if (!r.turn) {
      if (statusOf(r) !== 'READY') return json(res, 409, { outcome: 'NOT_READY' }), true;
      r.turn = addTurn(TRANSCRIPT, null, r);
      ctx.log({ kind: 'ui-commit', outcome: 'COMMITTED', turns: state.turns.length });
    } else {
      ctx.log({ kind: 'ui-commit', outcome: 'COMMITTED', replay: true, turns: state.turns.length });
    }
    json(res, 200, turnRows(r.turn));
    return true;
  }
  if (req.method === 'DELETE' && (m = /^\/voice\/recordings\/([^/]+)$/.exec(p))) {
    const r = state.records.get(m[1]);
    if (!r) return json(res, 404, {}), true;
    r.deleted = true;
    ctx.notes.delete(r.recordingId);
    ctx.log({ kind: 'ui-delete', outcome: 'DELETED' });
    json(res, 200, { outcome: 'DELETED' });
    return true;
  }
  if (req.method === 'GET' && (m = /^\/voice\/recordings\/([^/]+)\/objects\/NOTE\/0$/.exec(p))) {
    const r = state.records.get(m[1]);
    if (!r || r.deleted || toggle('s803-expire')) return json(res, 404, {}), true;
    ctx.serve(req, res, r.file, 'ui-play');
    return true;
  }
  if (p === `/conversation/sessions/${SESSION_UI}/turns`) {
    if (req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const existing = state.turns.find((t) => t.key === body.idempotencyKey);
      const t = existing ?? addTurn(String(body.content ?? ''), body.idempotencyKey, null);
      ctx.log({ kind: 'ui-typed-turn', replay: existing !== undefined, turns: state.turns.length });
      json(res, 200, turnRows(t));
      return true;
    }
    const exchanges = state.turns.map((t) => ({
      userTurn: { id: t.userId, content: t.content, idempotencyKey: t.key, createdAt: t.at },
      replyState: 'COMPLETED',
      assistantTurn: { id: t.replyId, content: t.reply, createdAt: t.at },
      ...(t.recording ? { voiceNote: voiceView(t.recording) } : {}),
    }));
    ctx.log({ kind: 'ui-history', exchanges: exchanges.length });
    json(res, 200, { exchanges, hasOlder: false });
    return true;
  }
  ctx.log({ kind: 'ui-other', method: req.method, path: p.split('/').slice(0, 3).join('/') });
  json(res, 404, {});
  return true;
}

module.exports = { handle, SESSION_UI };
