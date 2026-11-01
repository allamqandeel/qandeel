// S8B-03 CP2 — VALIDATION ONLY. The fake voice server of the native-capability proof (S803ProofRoot / S803UiProof) on
// 127.0.0.1:8803: an Android device through `adb reverse tcp:8803 tcp:8803`, or the iOS Simulator directly
// (scripts/s8b-03/run-s803-ios-proof.sh). Nothing paid and nothing real: no provider, no database, no account.
//
// It never logs audio, a token, a transcript or a recording id: only kinds, sizes, whether the proof's Authorization
// header was present, Range, and the CP1 duration prover's verdict on each uploaded file (proveM4aAudioDuration, from the
// built API: `npm run build --workspace @qandeel/api` first). Uploaded files are kept in S803_OUT with the fault toggles
// (fake-voice-api.cjs); they are the proof's silence or tone recordings, never a person's voice.
//
//   S803_OUT=<dir> [S803_LABEL=ios] node scripts/s8b-03/fake-voice-server.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { proveM4aAudioDuration } = require(path.join(__dirname, '../../apps/api/dist/voice/m4a/m4a-audio-duration.js'));

const OUT = process.env.S803_OUT;
if (!OUT) throw new Error('S803_OUT names the folder for the uploaded files and the fault toggles');
fs.mkdirSync(OUT, { recursive: true });
const TOKEN = 'Bearer s803-proof-token';
const voiceApi = require('./fake-voice-api.cjs');
const notes = new Map(); // recordingId -> file
const commands = new Map(); // commandId -> recordingId
const log = (o) => console.log(JSON.stringify({ t: new Date().toISOString(), ...o }));

async function prove(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    return await proveM4aAudioDuration(async (offset, length) => {
      const buf = Buffer.alloc(length);
      const n = fs.readSync(fd, buf, 0, length, offset);
      return buf.subarray(0, n);
    }, size);
  } finally {
    fs.closeSync(fd);
  }
}

function serve(req, res, file, kind) {
  const size = fs.statSync(file).size;
  const range = req.headers.range;
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = 0, end = size - 1, status = 200;
  if (m) {
    start = m[1] === '' ? size - Number(m[2]) : Number(m[1]);
    end = m[1] !== '' && m[2] !== '' ? Math.min(Number(m[2]), size - 1) : size - 1;
    status = 206;
  }
  log({ kind, auth: req.headers.authorization === TOKEN, range: range ?? null, status, bytes: end - start + 1 });
  res.writeHead(status, {
    'Content-Type': 'audio/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store, private',
    ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
  });
  fs.createReadStream(file, { start, end }).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const authed = req.headers.authorization === TOKEN;
  let m;
  if (await voiceApi.handle(req, res, url, authed, { log, out: OUT, prove, notes, serve })) return;
  if (req.method === 'POST' && (m = /^\/voice\/notes\/([^/]+)\/([^/]+)$/.exec(url.pathname))) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    if (!authed) { res.writeHead(401).end(); return log({ kind: 'upload', auth: false }); }
    const commandId = m[2];
    if (commands.has(commandId)) {
      const recordingId = commands.get(commandId);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ outcome: 'ACCEPTED', recordingId, acceptedAt: new Date().toISOString(), availableUntil: new Date(Date.now() + 30 * 864e5).toISOString() }));
      return log({ kind: 'upload-replay', commandId });
    }
    const recordingId = crypto.randomUUID();
    const file = path.join(OUT, `${process.env.S803_LABEL || 'note'}-${recordingId.slice(0, 8)}.m4a`);
    fs.writeFileSync(file, body);
    const proof = await prove(file).catch((e) => ({ error: String(e && e.message) }));
    log({ kind: 'upload', auth: true, contentType: req.headers['content-type'], contentLength: req.headers['content-length'], bytes: body.length, file: path.basename(file), proof, sha256: crypto.createHash('sha256').update(body).digest('hex') });
    notes.set(recordingId, file);
    commands.set(commandId, recordingId);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ outcome: 'ACCEPTED', recordingId, acceptedAt: new Date().toISOString(), availableUntil: new Date(Date.now() + 30 * 864e5).toISOString() }));
    return;
  }
  if (req.method === 'GET' && (m = /^\/voice\/recordings\/([^/]+)\/objects\/NOTE\/0$/.exec(url.pathname))) {
    if (!authed) { log({ kind: 'play', auth: false }); res.writeHead(401).end(); return; }
    const file = notes.get(m[1]);
    if (!file) { res.writeHead(404).end(); return; }
    return serve(req, res, file, 'play');
  }
  // The production saver's proof: S8B-02's own file names. The newest note answers under its name; a name with a copy
  // suffix stands for a recording gone since the manifest (404 NO_LONGER_AVAILABLE).
  if (req.method === 'GET' && url.pathname === '/s803/voice-manifest') {
    if (!authed) { res.writeHead(401).end(); return; }
    const file = [...notes.values()].pop();
    if (!file) { res.writeHead(404).end(); return; }
    // A toggle file `s803-short` in S803_OUT lists one byte more than is served: the C-51 proof (folder removed).
    const bytes = fs.statSync(file).size + (fs.existsSync(path.join(OUT, 's803-short')) ? 1 : 0);
    const files = [{ fileName: 'qandeel-voice-note-20261031T120000000000Z.m4a', bytes }];
    if (url.searchParams.get('gone') === '1') files.push({ fileName: 'qandeel-voice-note-20261031T120000000000Z-1.m4a', bytes });
    log({ kind: 'voice-manifest', files: files.length, bytes });
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ format: 'qandeel.personal-data-export.voice.v1', files }));
    return;
  }
  if (req.method === 'GET' && (m = /^\/account\/privacy\/export\/download\/bundle\/voice\/qandeel-voice-note-\d{8}T\d{12}Z(-\d+)?\.m4a$/.exec(url.pathname))) {
    if (!authed) { log({ kind: 'export-named', auth: false }); res.writeHead(401).end(); return; }
    const file = m[1] ? undefined : [...notes.values()].pop();
    if (!file) {
      log({ kind: 'export-named', auth: true, status: 404 });
      res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ outcome: 'NO_LONGER_AVAILABLE' }));
      return;
    }
    log({ kind: 'export-named', auth: true, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12) });
    return serve(req, res, file, 'export');
  }
  if (req.method === 'GET' && (m = /^\/account\/privacy\/export\/download\/bundle\/voice\/([^/]+)\.m4a$/.exec(url.pathname))) {
    if (!authed) { log({ kind: 'export', auth: false }); res.writeHead(401).end(); return; }
    const file = notes.get(m[1]);
    if (!file) {
      log({ kind: 'export', auth: true, status: 404, expired: true });
      res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ outcome: 'NO_LONGER_AVAILABLE' }));
      return;
    }
    return serve(req, res, file, 'export');
  }
  log({ kind: 'other', method: req.method, path: url.pathname });
  res.writeHead(404).end();
}).listen(8803, '127.0.0.1', () => log({ kind: 'listening', port: 8803, out: OUT }));
