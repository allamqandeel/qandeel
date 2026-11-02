import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// S8B-05 CP1 — the Integrated Live Call's server foundation (contract v1.2 FINAL, Part A, 05-CP1; migration 0189). This
// static contract proves, with no database and nothing sent off the machine:
//   - protocol v1 is frozen IDENTICALLY in its document and its code (path, subprotocol, messages, frame layout, limits,
//     close codes), and the CP2 - CP4 messages are answered NOT_SUPPORTED_YET, never ACKed, never sent;
//   - 0189 is forward-only, one transaction, opens no voice gate, grants no client role, is in the erasure coverage, and
//     its verifier and the synthetic live-call proof (pg and the PostgREST loop) run in CI;
//   - the live call reaches no provider in CP1: the speech sink bound is the null one, voice/call/ imports no recognizer,
//     synthesis, orchestrator, model router or engine, and nothing in it logs;
//   - call-truth is a classified route; the upgrade is the gateway's alone;
//   - the call Copy Gate is one unified gate for both stages, every row PROPOSED, and no call text reaches the phone.
// The behaviour itself is proven by verify-migration-0189, the synthetic proof and the API specs the record names.
//
// RE-ANCHORED by S8B-05 CP2 (migration 0190): PLAYOUT is applied and the server sends TURN_COMMITTED, REPLY_AUDIO and
// REPLY_END; the speech sink is the call turn engine (`voice/call-turn/`), which reaches the conversation only through its
// binding, while `voice/call/` stays provider-free; 0190 is the last migration. Each re-anchor below says what it replaced.

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
const RECORD = 'docs/e2e/QANDEEL_S8B_05_INTEGRATED_LIVE_CALL_IMPLEMENTATION_RECORD_v1.md';
const PROTOCOL_DOC = 'docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v1.md';
const PROTOCOL = 'apps/api/src/voice/call/live-call.protocol.ts';
const CONNECTION = 'apps/api/src/voice/call/live-call.connection.ts';
const M0189 = 'database/migrations/0189_s8b_05_live_call_authority_v1.sql';
const M0190 = 'database/migrations/0190_s8b_05_live_call_spoken_turn_v1.sql';
const CALL_TURN_DIR = 'apps/api/src/voice/call-turn/';
const CALL_DIR = 'apps/api/src/voice/call/';
const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/gu, '$1');
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist') return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const files = (dir) => walk(join(root, dir)).map((p) => relative(root, p).replaceAll('\\', '/'));

/** A frozen object literal of numbers (and arrays of numbers) from the protocol source, evaluated after a charset check. */
function frozenLiteral(source, name) {
  const start = source.indexOf(`export const ${name} = Object.freeze({`);
  assert.ok(start >= 0, `${name} is declared`);
  const body = source.slice(source.indexOf('{', start) + 1, source.indexOf('\n});', start));
  const clean = codeOnly(body).replace(/\bas const\b/gu, '');
  assert.match(clean, /^[\s\w:,[\]*]+$/u, `${name} holds plain numeric expressions only`);
  return new Function(`return ({${clean}});`)();
}
const constant = (source, name) => {
  const match = new RegExp(`export const ${name}(?::[^=]+)? = ([^;]+);`, 'u').exec(source);
  assert.ok(match, `${name} is declared`);
  return match[1].trim();
};
const list = (source, name) => JSON.parse(`[${/\[([^\]]*)\]/u.exec(constant(source, name))[1].replaceAll("'", '"')}]`);

test('protocol v1 is frozen identically in its document and its code', () => {
  const code = read(PROTOCOL);
  const doc = read(PROTOCOL_DOC);
  const block = /```json qandeel-live-call-v1\n([\s\S]*?)\n```/u.exec(doc);
  assert.ok(block, 'the document carries the machine-readable statement');
  const frozen = JSON.parse(block[1]);
  assert.equal(frozen.protocol, JSON.parse(constant(code, 'LIVE_CALL_PROTOCOL').replaceAll("'", '"')));
  assert.equal(frozen.path, JSON.parse(constant(code, 'LIVE_CALL_PATH').replaceAll("'", '"')));
  assert.equal(frozen.version, Number(constant(code, 'LIVE_CALL_PROTOCOL_VERSION')));
  assert.deepEqual(frozen.clientMessages, list(code, 'CLIENT_MESSAGES'));
  assert.deepEqual(frozen.serverMessages, list(code, 'SERVER_MESSAGES'));
  assert.deepEqual(frozen.notYetSupported, list(code, 'NOT_YET_SUPPORTED').sort());
  assert.deepEqual(frozen.frame, {
    audioKind: Number(constant(code, 'AUDIO_FRAME_KIND')), replyAudioKind: Number(constant(code, 'REPLY_AUDIO_FRAME_KIND')),
    headerBytes: Number(constant(code, 'FRAME_HEADER_BYTES')), maxOpusPacketBytes: Number(constant(code, 'MAX_OPUS_PACKET_BYTES')),
    maxTextFrameBytes: Number(constant(code, 'MAX_TEXT_FRAME_BYTES')), packetMs: Number(constant(code, 'AUDIO_PACKET_MS')),
  });
  assert.deepEqual(frozen.limits, frozenLiteral(code, 'LIVE_CALL_LIMITS'));
  assert.deepEqual(frozen.close, frozenLiteral(code, 'LIVE_CALL_CLOSE'));
  assert.deepEqual(frozen.clientMessages, ['HELLO', 'AUDIO', 'PLAYOUT', 'BARGE_IN', 'TEXT_TURN', 'MUTE', 'UNMUTE', 'TOKEN_REFRESH', 'HEARTBEAT', 'END'],
    'the client messages the contract froze (05-CP1 Scope C)');
  assert.deepEqual(frozen.serverMessages, ['STATE', 'TURN_COMMITTED', 'REPLY_AUDIO', 'REPLY_END', 'REFUSED', 'CALL_ENDING', 'ACK'],
    'the server messages the contract froze (05-CP1 Scope C)');
  assert.match(doc, /^\*\*Status:\*\* FROZEN by S8B-05 CP1/mu);
  assert.match(code, /docs\/voice\/QANDEEL_LIVE_CALL_PROTOCOL_v1\.md/u, 'the code names its document');
});

// RE-ANCHORED by S8B-05 CP2 (was: CP2 - CP4 refused and never sent). PLAYOUT is applied (ACTIVE only, the highest mark,
// a violation for a chunk never sent); BARGE_IN and TEXT_TURN (CP3 - CP4) stay refused. TURN_COMMITTED and REPLY_END are
// sent only by the call turn engine, through the connection's channel; REPLY_AUDIO is encoded by the connection alone.
test('CP3 - CP4 messages are refused NOT_SUPPORTED_YET, never ACKed; the CP2 server messages come from the call turn engine alone', () => {
  const connection = codeOnly(read(CONNECTION));
  assert.match(connection, /if \(NOT_YET_SUPPORTED\.has\(message\.type\)\) \{\n\s+this\.send\(\{ type: 'REFUSED', reason: 'NOT_SUPPORTED_YET'/u);
  assert.deepEqual(list(read(PROTOCOL), 'NOT_YET_SUPPORTED').sort(), ['BARGE_IN', 'TEXT_TURN']);
  assert.match(connection, /case 'PLAYOUT': \{\n\s+if \(this\.phase !== 'ACTIVE'\) return this\.violation\(\);\n\s+if \(this\.repeated\(message\.msgId\)\) return;/u);
  assert.match(connection, /if \(verdict === 'VIOLATION'\) return this\.violation\(\);\n\s+return this\.ack\(message\.msgId\);/u);
  for (const path of files(CALL_DIR).filter((p) => !p.endsWith('.spec.ts') && !p.includes('/testing/') && p !== PROTOCOL)) {
    assert.doesNotMatch(codeOnly(read(path)), /type: '(?:TURN_COMMITTED|REPLY_END)'/u, `${path} sends no turn message itself`);
    if (path !== CONNECTION) assert.doesNotMatch(codeOnly(read(path)), /encodeReplyAudioFrame/u, `${path} encodes no reply audio`);
  }
  assert.equal((connection.match(/encodeReplyAudioFrame\(/gu) ?? []).length, 1, 'one REPLY_AUDIO encoder, under the connection\'s epoch');
  const senders = files('apps/api/src').filter((p) => !p.endsWith('.spec.ts') && !p.includes('/testing/') && p !== PROTOCOL)
    .filter((p) => /type: '(?:TURN_COMMITTED|REPLY_END)'/u.test(codeOnly(read(p))));
  assert.deepEqual(senders.sort(), [`${CALL_TURN_DIR}call-reply.ts`, `${CALL_TURN_DIR}live-call-turn.engine.ts`]);
});

test('0189 is forward-only, one transaction, opens no voice gate, grants no client role, and its proofs run in CI', () => {
  const migration = read(M0189);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((migration.match(/^COMMIT;$/gmu) ?? []).length, 1);
  const code = codeOnly(migration);
  assert.doesNotMatch(code, /set_voice_launch_capability_v1\(|(?:INSERT INTO|UPDATE)\s+voice_private\.voice_launch_capability_(?:states|events)/u, 'no gate is set');
  assert.match(code, /every voice capability scope must remain DISABLED/u, 'the deploy guard refuses an open gate');
  assert.doesNotMatch(code, /GRANT [^;]*TO (?:anon|authenticated|PUBLIC)\b/u, 'no client role is granted anything');
  assert.match(code, /INSERT INTO account_erasure_private\.coverage_registry/u, 'the calls relation is in the erasure coverage');
  const migrations = readdirSync(join(root, 'database/migrations')).filter((f) => f.endsWith('.sql')).sort();
  // RE-ANCHORED by S8B-05 CP2 (was: 0189 is the last migration): CP2 adds exactly 0190 after it.
  assert.deepEqual(migrations.slice(-2), ['0189_s8b_05_live_call_authority_v1.sql', '0190_s8b_05_live_call_spoken_turn_v1.sql'], 'CP2 adds exactly 0190 after 0189');
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.equal(scripts['verify:live-call-authority:integration'], 'node --env-file-if-exists=.env database/verify-migration-0189.mjs');
  assert.equal(scripts['prove:live-call-synthetic:integration'],
    'node --env-file-if-exists=.env node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/s8b-05-live-call-synthetic-proof.ts');
  assert.equal(scripts['test:s8b-05-live-call-contract'], 'node --test tests/s8b-05-live-call-contract.test.mjs');
  const ci = read('.github/workflows/api-ci.yml');
  const at = (needle) => { const i = ci.indexOf(needle); assert.ok(i >= 0, `CI runs ${needle}`); return i; };
  assert.ok(at('npm run verify:fast-voice-path:integration') < at('run: npm run verify:live-call-authority:integration'), '0189 is verified after 0188');
  assert.ok(at('run: npm run verify:live-call-authority:integration') < at('run: npm run prove:live-call-synthetic:integration'));
  assert.match(ci, /POSTGREST_VERSION="\$version" npm run --silent prove:live-call-synthetic:integration/u, 'the synthetic proof runs through every PostgREST version');
  assert.match(ci, /run: npm run test:s8b-05-live-call-contract/u);
  assert.match(read('apps/api/scripts/s8b-05-live-call-synthetic-proof.ts'), /S8B05_PROOF_REFUSED: DATABASE_URL must name a loopback throwaway database/u,
    'the proof refuses any database but a loopback one');
});

// RE-ANCHORED by S8B-05 CP2 (was: the null speech sink is bound). The sink is the call turn engine; voice/call/ still imports
// no recognizer, synthesis, orchestrator, router or engine and logs nothing. The engine itself (voice/call-turn/) reaches the
// conversation only through LiveCallConversationBinding: it imports no model router, DeepSeek or orchestrator, and logs
// nothing. The call's recognizer is bound on the server key alone, never on VOICE_NOTE_LIVE_TRANSCRIPT.
test('voice/call/ stays provider-free: the speech sink is the call turn engine, which reaches the conversation through its binding alone', () => {
  const module = read('apps/api/src/voice/voice.module.ts');
  assert.match(module, /    LiveCallTurnEngine,\n    \{ provide: LIVE_CALL_SPEECH_SINK, useExisting: LiveCallTurnEngine \},/u, 'CP2 binds the call turn engine');
  assert.doesNotMatch(codeOnly(module), /useValue: NULL_LIVE_CALL_SPEECH_SINK/u);
  assert.match(module, /provide: LIVE_CALL_RECOGNITION,\n\s+useFactory: \(\): RealtimeRecognition \| null => \{\n\s+const config = loadSpeechmaticsRealtimeConfig\(\);\n\s+return config\.apiKey \? new SpeechmaticsRealtimeAdapter/u, 'the call recognizer needs the server key alone');
  for (const path of files(CALL_TURN_DIR)) {
    const text = read(path);
    assert.doesNotMatch(text, /from '[./]*(?:conversation\/conversation|model-router|deepseek|ai-gateway|analysis)/u, `${path} imports no orchestrator, router or engine`);
    assert.doesNotMatch(text, /from '[^']*\/(?:speechmatics|vertex-speech)\//u, `${path} imports no provider adapter`);
    if (path.endsWith('.spec.ts') || path.includes('/testing/')) continue;
    assert.doesNotMatch(codeOnly(text), /\bLogger\b|console\.|process\.stdout|process\.stderr|process\.env/u, `${path} logs nothing and reads no environment`);
  }
  assert.match(module, /\{ provide: LIVE_CALL_STORE, useClass: LiveCallRepository \}/u);
  for (const path of files(CALL_DIR)) {
    const text = read(path);
    assert.doesNotMatch(text, /from '\.\.\/(?:\.\.\/)?(?:speechmatics|vertex-speech|live-note|live-reply|listen)\//u, `${path} imports no voice provider path`);
    assert.doesNotMatch(text, /from '[./]*(?:conversation\/conversation|model-router|deepseek|ai-gateway|memory|analysis|ai-usage)/u, `${path} imports no orchestrator, router or engine`);
    if (path.endsWith('.spec.ts') || path.includes('/testing/')) continue;
    assert.doesNotMatch(codeOnly(text), /\bLogger\b|console\.|process\.stdout|process\.stderr/u, `${path} logs nothing`);
  }
  assert.match(read(`${CALL_DIR}live-call-speech.port.ts`), /CP2 binds the call turn engine/u);
});

test('0190 is forward-only, one transaction, opens no voice gate, grants the client role only its owner reads, and its proofs run in CI', () => {
  const migration = read(M0190);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((migration.match(/^COMMIT;$/gmu) ?? []).length, 1);
  const code = codeOnly(migration);
  assert.doesNotMatch(code, /set_voice_launch_capability_v1\(|(?:INSERT INTO|UPDATE)\s+voice_private\.voice_launch_capability_(?:states|events)/u, 'no gate is set');
  assert.doesNotMatch(code, /GRANT [^;]*TO (?:anon|PUBLIC)\b/u, 'nothing is granted to anon or PUBLIC');
  assert.deepEqual([...code.matchAll(/GRANT ([A-Z]+)[^;]* TO authenticated/gu)].map((m) => m[1]).sort(), ['EXECUTE', 'SELECT'], 'authenticated: the RLS read of its call turns and the invoker reads only');
  assert.match(code, /INSERT INTO account_erasure_private\.coverage_registry/u, 'the new relations are in the erasure coverage');
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.equal(scripts['verify:live-call-spoken-turn:integration'], 'node --env-file-if-exists=.env database/verify-migration-0190.mjs');
  const ci = read('.github/workflows/api-ci.yml');
  const at = (needle) => { const i = ci.indexOf(needle); assert.ok(i >= 0, `CI runs ${needle}`); return i; };
  assert.ok(at('run: npm run verify:live-call-authority:integration') < at('run: npm run verify:live-call-spoken-turn:integration'), '0190 is verified after 0189');
  // The CP2 synthetic spoken turn: in the PostgreSQL job after the CP1 proof, and over the wire on the oldest and newest
  // PostgREST lines (single-call mode); never pointed at anything but a loopback throwaway database.
  assert.equal(scripts['prove:live-call-spoken-turn-synthetic:integration'],
    'node --env-file-if-exists=.env node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/s8b-05-cp2-spoken-turn-synthetic-proof.ts');
  assert.ok(at('run: npm run prove:live-call-synthetic:integration') < at('run: npm run prove:live-call-spoken-turn-synthetic:integration'), 'CP2 proof after the CP1 proof');
  assert.ok(ci.includes('if [ "$version" = "v12.2.9" ] || [ "$version" = "v16.4" ]; then\n'
    + '              S8B05_CP2_PROOF_SINGLE_CALL=1 POSTGREST_VERSION="$version" npm run --silent prove:live-call-spoken-turn-synthetic:integration'),
  'the CP2 proof over the wire, on the oldest and the newest PostgREST line');
  const proof = read('apps/api/scripts/s8b-05-cp2-spoken-turn-synthetic-proof.ts');
  assert.match(proof, /S8B05_CP2_PROOF_REFUSED: DATABASE_URL must name a loopback throwaway database/u);
  assert.doesNotMatch(codeOnly(proof), /api\.deepseek\.com|speechmatics\.com|googleapis\.com|aiplatform/u, 'the proof reaches no provider');
});

test('call-truth is a classified, guarded, private route; the upgrade is the gateway\'s own', () => {
  assert.match(read('apps/api/src/http-security/route-rate-limit.census.ts'), /'GET \/voice\/calls\/truth': 'AUTHENTICATED',/u);
  const controller = read(`${CALL_DIR}live-call-truth.controller.ts`);
  assert.match(controller, /@UseGuards\(SupabaseAuthGuard\)/u);
  assert.match(controller, /@Header\('Cache-Control', 'no-store, private'\)/u);
  const gateway = codeOnly(read(`${CALL_DIR}gateway/live-call.gateway.ts`));
  assert.match(gateway, /if \(request\.url !== LIVE_CALL_PATH\) return refuse\(socket, 404, 'NOT_FOUND'\);/u, 'any other upgrade path, or a query, is 404');
  assert.match(gateway, /this\.auth\.authenticate\(header\(request, 'authorization'\)\)/u, 'the same Supabase check as every guarded route');
  assert.doesNotMatch(gateway, /x-forwarded-for|x-real-ip/iu, 'no forwarded header is read by hand');
  assert.match(gateway, /rateLimitTrackerOf\(this\.requestView\(request, socket\)\)/u, 'the HTTP throttler\'s own tracker keys the upgrade rate');
});

test('the call Copy Gate is one gate for both stages, every row PROPOSED, and no call text reaches the phone in CP1', () => {
  const record = read(RECORD);
  // RE-ANCHORED by S8B-05 CP2 (was: CP1 under review): CP1 merged (PR #374); the record states CP2 under review, not closed.
  assert.match(record, /^\*\*Checkpoint:\*\* S8B-05 CP2 — UNDER REVIEW/mu, 'the record states CP2 under review, not closed');
  const rows = record.split('\n').filter((line) => /^\| (?:LC|LCE)-\d{2} \|/u.test(line));
  assert.ok(rows.length >= 30, 'the unified gate lists the existing and the new call rows');
  for (const row of rows) assert.match(row, /^\| (?:LC|LCE)-\d{2} \| PROPOSED \|/u, `${row.slice(0, 12)} is PROPOSED`);
  const ids = rows.map((row) => row.split('|')[1].trim());
  assert.equal(new Set(ids).size, ids.length, 'every row id is unique');
  const mobile = files('apps/mobile/src').filter((p) => /\.(?:ts|tsx)$/u.test(p));
  assert.ok(!mobile.some((p) => p.includes('voice-call/')), 'no call surface on the phone in CP1');
  for (const path of mobile) assert.doesNotMatch(read(path), /\bLC-\d{2}\b|qandeel\.live-call\.v1/u, `${path} carries no call copy and no call protocol`);
});

// S8B-05 CP2 (CA-05-02 §2.3, acceptance #27): an interrupted reply is never treated as complete. Today no post-response
// consumer reads the source exchange's reply content: the authority reads only that a completed reply exists (no content),
// and the capture's recent turns stop BEFORE the source turn (its own reply is newer, so never among them). A future
// consumer that reads the reply content must read delivery_state with it; the export and the history carry it.
test('no post-response consumer reads the source exchange\'s reply content without delivery_state; the export and the history carry it', () => {
  const CONSUMER_DIRS = ['post-response-intelligence', 'background-intelligence', 'hypothesis', 'personal-understanding', 'human-model', 'memory', 'understanding']
    .map((d) => `apps/api/src/${d}/`);
  const consumers = CONSUMER_DIRS.flatMap((d) => files(d)).filter((p) => p.endsWith('.ts') && !p.endsWith('.spec.ts'));
  assert.ok(consumers.length > 20, 'the consumer folders are scanned');
  for (const path of consumers) {
    const code = codeOnly(read(path));
    const readsDelivery = /delivery_state|deliveryState/u.test(code);
    for (const line of code.split('\n').filter((l) => /role: 'eq\.ASSISTANT'|role=eq\.ASSISTANT/u.test(l))) {
      if (!readsDelivery) assert.match(line, /select: TURN_FIELDS\b/u, `${path} reads an ASSISTANT turn without its content (or with delivery_state)`);
    }
    if (!readsDelivery) {
      assert.doesNotMatch(code, /assistant(?:Turn)?\??\.content\b|reply_content|replyContent/u, `${path} reads no reply content without delivery_state`);
    }
  }
  const data = codeOnly(read('apps/api/src/background-intelligence/background-intelligence-data-api.service.ts'));
  assert.match(data, /const TURN_FIELDS = 'id,session_id,role,status,source_turn_id';/u, 'the completed-reply check selects no content');
  assert.match(data, /return rows\.slice\(at < 0 \? rows\.length : at \+ 1\)\.slice\(0, limit\)/u, 'the recent turns stop before the source turn');
  const m0190 = codeOnly(read(M0190));
  assert.match(m0190, /'deliveryState', lower\(vs\.delivery_state\)/u, 'Export My Data carries the delivery state of a call reply');
  assert.match(m0190, /CREATE FUNCTION public\.server_read_call_reply_delivery_v1\(/u);
  const history = codeOnly(read('apps/api/src/conversation/conversation.service.ts'));
  assert.match(history, /\.\.\.\(reply && deliveryByReply\.has\(reply\.id\) \? \{ deliveryState: deliveryByReply\.get\(reply\.id\)! \} : \{\}\)/u, 'the history carries it, additively');
});
