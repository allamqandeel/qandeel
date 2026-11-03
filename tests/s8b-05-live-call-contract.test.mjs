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
//
// RE-ANCHORED by S8B-05 CP4 (migration 0192): BARGE_IN and TEXT_TURN are applied, so no message is NOT_SUPPORTED_YET; 0192
// is the last migration.

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
// a violation for a chunk never sent). TURN_COMMITTED and REPLY_END are sent only by the call turn engine, through the
// connection's channel; REPLY_AUDIO is encoded by the connection alone.
// RE-ANCHORED by S8B-05 CP4 (was: BARGE_IN and TEXT_TURN refused NOT_SUPPORTED_YET, never ACKed). Both are applied while
// the call is ACTIVE: a BARGE_IN once per msgId, ACKed; a TEXT_TURN ACKed once committed (its ACK never moves lastMsgId,
// one commit per clientTurnId) or REFUSED with its reason. Nothing is NOT_SUPPORTED_YET any more.
test('every v1 client message is applied (none NOT_SUPPORTED_YET); the turn server messages come from the call turn engine alone', () => {
  const connection = codeOnly(read(CONNECTION));
  assert.doesNotMatch(connection, /NOT_YET_SUPPORTED|'NOT_SUPPORTED_YET'/u, 'the connection refuses nothing as not supported');
  assert.deepEqual(list(read(PROTOCOL), 'NOT_YET_SUPPORTED'), []);
  assert.match(connection, /case 'BARGE_IN': \{\n\s+if \(this\.phase !== 'ACTIVE'\) return this\.violation\(\);\n\s+if \(this\.repeated\(message\.msgId\)\) return;/u);
  assert.match(connection, /case 'TEXT_TURN': \{\n\s+if \(this\.phase !== 'ACTIVE'\) return this\.violation\(\);/u);
  assert.match(connection, /verdict\.kind === 'COMMITTED' \? this\.ack\(msgId, false\) : this\.send\(\{ type: 'REFUSED', reason: verdict\.reason, msgId \}\)/u,
    'a typed turn is ACKed once committed without moving lastMsgId, or refused with its reason');
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
  // RE-ANCHORED by S8B-05 CP3 (was: 0190 is the last migration): CP3 adds exactly 0191 after 0190.
  // RE-ANCHORED by S8B-05 CP4 (was: 0191 is the last migration): CP4 adds exactly 0192 after 0191.
  assert.deepEqual(migrations.slice(-4), ['0189_s8b_05_live_call_authority_v1.sql', '0190_s8b_05_live_call_spoken_turn_v1.sql',
    '0191_s8b_05_live_call_ordered_halves_v1.sql', '0192_s8b_05_live_call_barge_in_text_turn_v1.sql'],
  'CP2 adds exactly 0190 after 0189, CP3 exactly 0191 after 0190, CP4 exactly 0192 after 0191');
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
  // RE-ANCHORED by S8B-05 CP3 (was: CP2 under review): CP2 merged (PR #375); the record states CP3 under review, not closed.
  // RE-ANCHORED by S8B-05 CP4 (was: CP3 under review): CP3 merged (PR #377); CP4 is S8B-05's closing change, and the record
  // states S8B-05 closed and ready for the Product Owner's merge decision (BG-09): not merged, gates closed, #34 not met.
  assert.match(record, /^\*\*Status:\*\* `S8B-05 CLOSED \/ READY FOR THE PRODUCT OWNER'S MERGE DECISION \(2026-11-03, the CP4 closing change; §12\)/mu);
  assert.match(record, /NOT MERGED \(MERGE ONLY ON THE PRODUCT OWNER'S EXPLICIT «ادمج»\) — #34 NOT MET UNDER SHIPPED, OWNED BY GCR-01-A — MIGRATIONS 0189 – 0192 NOT HOSTED — ALL FOUR VOICE GATES DISABLED/u);
  assert.doesNotMatch(record.slice(0, record.indexOf('## 0.')), /^\*\*(?:Checkpoint|Status):\*\*[^\n]*UNDER REVIEW/mu, 'no current banner is a review banner');
  assert.match(record, /### 12\.8 Backlog \(BG-08\) — the closing change/u);
  const rows = record.split('\n').filter((line) => /^\| (?:LC|LCE)-\d{2} \|/u.test(line));
  assert.ok(rows.length >= 30, 'the unified gate lists the existing and the new call rows');
  for (const row of rows) assert.match(row, /^\| (?:LC|LCE)-\d{2} \| PROPOSED \|/u, `${row.slice(0, 12)} is PROPOSED`);
  const ids = rows.map((row) => row.split('|')[1].trim());
  assert.equal(new Set(ids).size, ids.length, 'every row id is unique');
  const mobile = files('apps/mobile/src').filter((p) => /\.(?:ts|tsx)$/u.test(p));
  // S8B-06 CP1 (D-05-05) adds the phone's native engine and protocol client under src/voice-call/ — no surface and no
  // call text: no component outside its device proof, and the protocol named inside that layer only.
  const call = mobile.filter((p) => p.includes('voice-call/') && !/\/__(?:validation|tests|fixtures)__\//u.test(p));
  assert.ok(call.every((p) => p.endsWith('.ts')), 'no call surface on the phone');
  for (const path of mobile) {
    assert.doesNotMatch(read(path), /\bLCE?-\d{2}\b/u, `${path} carries no call copy`);
    if (!call.includes(path)) assert.doesNotMatch(read(path), /qandeel\.live-call\.v1/u, `${path} names no call protocol`);
  }
  for (const path of call) assert.doesNotMatch(read(path), /[؀-ۿ]/u, `${path} carries no call text`);
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

// S8B-05 CP3 (migration 0191; contract v1.2 Part A A3.3, A1 §1 - §3, L2 - L5): the ordered half establishment, the
// durable ordered analysis worker, the shared background permits and S3 after the END. Statically: 0191 is forward-only,
// opens no gate and grants no client role; L2 (M1) is the default and M1′ only when set exactly; the voice path makes no
// database call for the analysis (an in-memory kick, never awaited) and no reply path asks a background permit; the worker
// logs nothing; the verifier and the synthetic proof run in CI and the proof reaches no provider. The behaviour itself is
// proven by verify-migration-0191, the CP3 synthetic proof and the live-analysis / establishment specs.
const M0191 = 'database/migrations/0191_s8b_05_live_call_ordered_halves_v1.sql';
const ANALYSIS_DIR = 'apps/api/src/live-analysis/';

test('0191 is forward-only, one transaction, opens no voice gate, grants no client role, and its proofs run in CI', () => {
  const migration = read(M0191);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((migration.match(/^COMMIT;$/gmu) ?? []).length, 1);
  const code = codeOnly(migration);
  assert.doesNotMatch(code, /set_voice_launch_capability_v1\(|(?:INSERT INTO|UPDATE)\s+voice_private\.voice_launch_capability_(?:states|events)/u, 'no gate is set');
  assert.doesNotMatch(code, /GRANT [^;]*TO (?:anon|authenticated|PUBLIC)\b/u, 'nothing is granted to a client role');
  assert.match(code, /CREATE FUNCTION public\.server_acquire_background_permit_v1\(/u);
  assert.match(code, /'contract v1\.2 A1 §3 \(B_total 16, B_min 2, k 2, two permits per person, a 120 s lease; calibrated in S8B-08\)'/u,
    'the shipped permit policy is the contract\'s, calibrated later, not by CP3');
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.equal(scripts['verify:live-call-ordered-halves:integration'], 'node --env-file-if-exists=.env database/verify-migration-0191.mjs');
  assert.equal(scripts['prove:live-analysis-synthetic:integration'],
    'node --env-file-if-exists=.env node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/s8b-05-cp3-live-analysis-proof.ts');
  const ci = read('.github/workflows/api-ci.yml');
  const at = (needle) => { const i = ci.indexOf(needle); assert.ok(i >= 0, `CI runs ${needle}`); return i; };
  assert.ok(at('run: npm run verify:live-call-spoken-turn:integration') < at('run: npm run verify:live-call-ordered-halves:integration'), '0191 is verified after 0190');
  assert.ok(at('run: npm run prove:live-call-spoken-turn-synthetic:integration') < at('run: npm run prove:live-analysis-synthetic:integration'), 'CP3 proof after the CP2 proof');
  // DEC-R1-3 (the Product Owner, 2026-11-03): the SHIPPED, CALIBRATED and CONSERVATIVE results stay visible in CI; only M1
  // under CONSERVATIVE, a test profile and not a launch setting, is enforced; the others are reported, never hidden.
  assert.match(ci, /S8B05_CP3_PROFILES: SHIPPED,CALIBRATED,CONSERVATIVE\n\s*run: npm run prove:live-analysis-synthetic:integration/u,
    'CI runs the CP3 proof under all three permit profiles');
  const proof = read('apps/api/scripts/s8b-05-cp3-live-analysis-proof.ts');
  assert.match(codeOnly(proof), /if \(impact\.M1_CONSERVATIVE\) \{\s*check\(/u, 'the voice limit is enforced for M1 under CONSERVATIVE');
  assert.match(proof, /REPORTED {2}\$\{key\} exceeds the voice protection limit/u, 'every other profile is reported when it exceeds it');
  assert.match(proof, /S8B05_CP3_PROOF_REFUSED: DATABASE_URL must name a loopback throwaway database/u);
  assert.doesNotMatch(codeOnly(proof), /api\.deepseek\.com|speechmatics\.com|googleapis\.com|aiplatform|openai\.com/u, 'the proof reaches no provider');
});

// O3b as amended by DEC-R1-1 (the Product Owner, 2026-11-03; record §11.11): the call's ACTIVATION adopts the session's
// unestablished pre-call exchanges, in the activation's own transaction; the first turn adopts only what completed after it,
// after the activation's items (one order); the connection then kicks the worker in memory, never awaited, no database call.
test('O3b as amended by DEC-R1-1: the activation adopts in its own transaction, the first turn only after it, and the kick stays in memory', () => {
  const code = codeOnly(read(M0191));
  const activate = code.slice(code.indexOf('CREATE OR REPLACE FUNCTION public.server_activate_call_v1('));
  const activateBody = activate.slice(0, activate.indexOf('END$$;'));
  assert.match(activateBody, /PERFORM voice_private\.adopt_pre_call_exchanges_v1\(p_call_id, p_user_id, v_call\.session_id, 1000\);\s*RETURN QUERY SELECT 'ACTIVE'::text, v_now,/u,
    'the first ACTIVE adopts, in the same transaction, just before it answers');
  const commit = code.slice(code.indexOf('CREATE OR REPLACE FUNCTION public.server_commit_live_call_turn_v1('));
  assert.match(commit.slice(0, commit.indexOf('END$$;')), /IF v_index = 1 THEN\s*PERFORM voice_private\.adopt_pre_call_exchanges_v1\(p_call_id, p_user_id, v_call\.session_id, 0\);/u,
    'the first turn adopts only what is left, with no reserve');
  const adopt = code.slice(code.indexOf('CREATE FUNCTION voice_private.adopt_pre_call_exchanges_v1('));
  assert.match(adopt.slice(0, adopt.indexOf('END$$;')), /CASE WHEN v_after IS NULL THEN p\.n - p\.total - p_reserve ELSE v_after \+ p\.n END[\s\S]*WHERE x\.idx < 1;/u,
    'a later adoption continues after the call\'s last adopted item and never reaches a turn\'s index');
  const connection = codeOnly(read('apps/api/src/voice/call/live-call.connection.ts'));
  assert.match(connection, /this\.sendState\('ACTIVE'\);\s*this\.deps\.analysisKick\?\.\(this\.sessionId!\);/u, 'the kick follows the ACTIVE state');
  assert.doesNotMatch(connection, /await [^;\n]*analysisKick/u, 'never awaited');
  assert.match(codeOnly(read('apps/api/src/voice/call/live-call.service.ts')), /analysisKick: \(sessionId\) => this\.analysis\?\.kick\(sessionId, 'CALL_ACTIVATED'\),/u);
});

test('L2 is the default (M1) and M1′ only when set exactly; the voice path kicks in memory and no reply path asks a permit', () => {
  const worker = codeOnly(read(`${ANALYSIS_DIR}call-analysis.worker.ts`));
  assert.match(worker, /return environment\[CALL_ANALYSIS_START_ENV\] === 'AT_COMMIT' \? 'AT_COMMIT' : 'AFTER_FIRST_AUDIO';/u, 'the default is L2\'s yield');
  assert.match(worker, /respectCriticalWindow: this\.deps\.start === 'AFTER_FIRST_AUDIO',/u);
  const signal = codeOnly(read(`${CALL_TURN_DIR}live-call-analysis.signal.ts`));
  assert.doesNotMatch(signal, /import [^;]*(?:supabase|service-role|data-api|repository)/iu, 'the signal reaches no database');
  assert.match(signal, /try \{[\s\S]*?\} catch/u, 'a kick never throws into the voice path');
  const engine = codeOnly(read(`${CALL_TURN_DIR}live-call-turn.engine.ts`));
  assert.doesNotMatch(engine, /await [^;\n]*analysis/u, 'the engine never awaits the analysis');
  // The live call reply, the typed reply and the voice-note reply never ask a background permit.
  for (const path of ['apps/api/src/conversation/live-call-reply.service.ts', 'apps/api/src/conversation/conversation.service.ts',
    ...files('apps/api/src/voice').filter((p) => p.endsWith('.ts') && !p.endsWith('.spec.ts'))]) {
    assert.doesNotMatch(codeOnly(read(path)), /BackgroundPermitGate|BACKGROUND_PERMIT_GATE|acquire_background_permit/u, `${path} asks no background permit`);
  }
  for (const path of files(ANALYSIS_DIR).filter((p) => p.endsWith('.ts') && !p.endsWith('.spec.ts'))) {
    assert.doesNotMatch(codeOnly(read(path)), /\bLogger\b|console\.|process\.stdout/u, `${path} logs nothing`);
  }
});

// S8B-05 CP3 review correction (A2 smoke in API CI): a proof that drives an event-writing command leaves no runtime event
// behind. The outbox names its subject `subject_user_id`, so the teardowns' `user_id` sweep never reaches it; a fixture event
// left PENDING is older than any later event and fills the publisher's oldest-first batch (claim_runtime_events(20)), which
// left the A2 smoke's own event PENDING after the CP3 proof. Every such teardown deletes by `subject_user_id` and the proof
// counts what is left of the runtime outbox after it.
test('every proof that writes runtime events removes its fixtures\' outbox rows by subject_user_id and proves none is left', () => {
  const EVENT_WRITERS = /server_commit_live_call_turn_v1|server_close_live_call_exchange_v1|server_end_call_v1|server_close_ended_call_exchange_v1|finalize_conversation_turn/u;
  const proofs = files('apps/api/scripts').filter((p) => p.endsWith('.ts')).filter((p) => {
    const text = read(p);
    return text.includes("column_name = 'user_id'") && EVENT_WRITERS.test(text);
  });
  assert.ok(proofs.includes('apps/api/scripts/s8b-05-cp3-live-analysis-proof.ts'), 'the CP3 proof is covered');
  assert.ok(proofs.includes('apps/api/scripts/s8b-05-cp2-spoken-turn-synthetic-proof.ts'), 'the CP2 proof is covered');
  for (const path of proofs) {
    const text = codeOnly(read(path));
    const teardown = text.slice(text.indexOf('async function teardown('));
    assert.match(teardown, /DELETE FROM public\.runtime_event_outbox WHERE subject_user_id = ANY\(\$1::uuid\[\]\)/u, `${path}: the teardown deletes its fixtures' events`);
    assert.match(text, /count\(\*\) FROM public\.runtime_event_outbox WHERE subject_user_id = ANY\(\$1::uuid\[\]\)\)::int AS (?:events|outbox_events)/u,
      `${path}: what the teardown left of the outbox is counted`);
  }
});

// S8B-05 CP3 R2 (API CI, the S6-06 media proof's P04 on db832c72): a proof that adds call segments and ends calls leaves no
// erasure key behind. The END seals the recording, which queues every never-uploaded segment's key (0183
// seal_call_recording_v1); the queue keys on storage_key, so the teardowns' `user_id` sweep never reaches it. Left behind,
// 426 `voice-call/` keys came due and filled the media erasure worker's oldest-first claim of 25, so P04's photo keys were
// never claimed. Every such teardown deletes its fixtures' keys before their objects, and the proof counts what is left.
test('every proof that seals call recordings removes its fixtures\' erasure queue keys and proves none is left', () => {
  const proofs = files('apps/api/scripts').filter((p) => p.endsWith('.ts')).filter((p) => {
    const text = read(p);
    return text.includes("column_name = 'user_id'") && /server_add_call_segment_v\d/u.test(text) && /server_end_call_v1/u.test(text);
  });
  assert.ok(proofs.includes('apps/api/scripts/s8b-05-cp3-live-analysis-proof.ts'), 'the CP3 proof is covered');
  for (const path of proofs) {
    const text = codeOnly(read(path));
    const teardown = text.slice(text.indexOf('async function teardown('));
    const queue = teardown.indexOf('DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key IN');
    const objects = teardown.indexOf('DELETE FROM voice_private.recording_objects WHERE recording_id IN');
    assert.ok(queue >= 0, `${path}: the teardown deletes its fixtures' erasure keys`);
    assert.ok(queue < objects, `${path}: before the objects that name them`);
    assert.match(text, /count\(\*\) FROM introduction_sharing_private\.media_erasure_queue WHERE storage_key = ANY\(\$2::text\[\]\)\)::int AS erasure_queue_keys/u,
      `${path}: what the teardown left of the erasure queue is counted`);
  }
  // verify-migration-0191's race fixtures are erased through the account erasure, which queues their keys the same way.
  const verifier = codeOnly(read('database/verify-migration-0191.mjs'));
  assert.match(verifier, /DELETE FROM introduction_sharing_private\.media_erasure_queue WHERE storage_key = ANY\(\$1::text\[\]\)/u, 'verify-0191 removes its fixtures\' erasure keys');
  assert.match(verifier, /DELETE FROM account_erasure_private\.media_pending WHERE storage_key = ANY\(\$1::text\[\]\)/u, 'and their pending-erasure rows');
  assert.match(verifier, /the race fixtures left erasure keys behind/u, 'and proves none is left');
});

// S8B-05 CP4 (migration 0192; contract v1.2 P4 / P5, D-05-07, §5.2, CA-05-02 §2.2): barge-in, the typed turn in a call, the
// drain and the resume, F-01. Statically: 0192 is forward-only, one transaction, opens no gate and grants no client role;
// its verifier and the CP4 synthetic proof run in CI after CP3's, and the proof reaches no provider; F-01's files stay NOT
// INSTALLED in the repository (the proof plays a generated tone from a temporary directory); the call turn engine logs
// nothing and writes F-01 to the QANDEEL track only when heard; M2 joins the CP3 matrix, measured and reported.
const M0192 = 'database/migrations/0192_s8b_05_live_call_barge_in_text_turn_v1.sql';
const CP4_PROOF = 'apps/api/scripts/s8b-05-cp4-live-call-closure-proof.ts';

test('0192 is forward-only, one transaction, opens no voice gate, grants no client role, and its proofs run in CI after CP3', () => {
  const migration = read(M0192);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((migration.match(/^COMMIT;$/gmu) ?? []).length, 1);
  const code = codeOnly(migration);
  assert.doesNotMatch(code, /set_voice_launch_capability_v1\(|(?:INSERT INTO|UPDATE)\s+voice_private\.voice_launch_capability_(?:states|events)/u, 'no gate is set');
  assert.match(code, /every voice capability scope must remain DISABLED/u, 'the deploy guard refuses an open gate');
  assert.doesNotMatch(code, /GRANT [^;]*TO (?:anon|authenticated|PUBLIC)\b/u, 'nothing is granted to a client role');
  for (const fn of ['server_record_call_barge_in_v1', 'server_close_live_call_text_exchange_v1', 'server_read_open_call_exchange_v1']) {
    assert.match(code, new RegExp(`CREATE FUNCTION public\\.${fn}\\(`, 'u'), fn);
  }
  assert.match(code, /CREATE TRIGGER conversation_turns_live_call_admission\s+BEFORE INSERT ON public\.conversation_turns/u,
    'the REST text turn is refused while a call of the session is live (the 0131 race)');
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.equal(scripts['verify:live-call-barge-in-text-turn:integration'], 'node --env-file-if-exists=.env database/verify-migration-0192.mjs');
  assert.equal(scripts['prove:live-call-closure-synthetic:integration'],
    `node --env-file-if-exists=.env node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json ${CP4_PROOF}`);
  const ci = read('.github/workflows/api-ci.yml');
  const at = (needle) => { const i = ci.indexOf(needle); assert.ok(i >= 0, `CI runs ${needle}`); return i; };
  assert.ok(at('run: npm run prove:live-analysis-synthetic:integration') < at('run: npm run verify:live-call-barge-in-text-turn:integration'), '0192 is verified after CP3');
  assert.ok(at('run: npm run verify:live-call-barge-in-text-turn:integration') < at('run: npm run prove:live-call-closure-synthetic:integration'), 'the CP4 proof after 0192');
  const proof = read(CP4_PROOF);
  assert.match(proof, /S8B05_CP4_PROOF_REFUSED: DATABASE_URL must name a loopback throwaway database/u);
  assert.doesNotMatch(codeOnly(proof), /api\.deepseek\.com|speechmatics\.com|googleapis\.com|aiplatform|openai\.com/u, 'the proof reaches no provider');
});

test('F-01 stays NOT_INSTALLED in the repository; the call plays it only from pinned files, and the engine logs nothing', () => {
  const manifest = JSON.parse(read('apps/api/fixtures/voice-tts/manifest.json'));
  assert.deepEqual([manifest.state, manifest.files.ar, manifest.files.en], ['NOT_INSTALLED', null, null], 'no F-01 audio is committed (D-05-02)');
  const line = codeOnly(read(`${CALL_TURN_DIR}call-failure-line.ts`));
  assert.match(line, /if \(loaded\.state !== 'READY'\) return null;/u, 'nothing is played while the files are not installed');
  assert.doesNotMatch(line, /synthesize|SpeechSynthesis/u, 'F-01 is never synthesized at run time');
  assert.match(codeOnly(read('apps/api/src/voice/voice.module.ts')), /provide: LIVE_CALL_FAILURE_LINE, useFactory: \(\) => callFailureLine\(loadSpokenFailureLine\(\)\)/u);
  for (const path of files(CALL_TURN_DIR).filter((p) => !p.endsWith('.spec.ts') && !p.includes('/testing/'))) {
    assert.doesNotMatch(codeOnly(read(path)), /console\.|Logger\b|\.log\(/u, `${path} logs nothing`);
  }
  const proof = read(CP4_PROOF);
  assert.match(proof, /mkdtempSync\(join\(tmpdir\(\), 's8b05-cp4-f01-'\)\)/u, 'the proof\'s tone lives in a temporary directory');
  assert.match(proof, /rmSync\(dir, \{ recursive: true, force: true \}\)/u, 'and is removed');
});

test('M2 joins the CP3 matrix (five calls, post-response through the real gate), measured against the same five calls and reported', () => {
  const proof = read('apps/api/scripts/s8b-05-cp3-live-analysis-proof.ts');
  const code = codeOnly(proof);
  assert.match(code, /\{ key: 'M0_M2', start: null, profile: null, calls: WORKLOAD\.m2Calls \}/u);
  assert.match(code, /key: `M2_\$\{profile\}`, start: 'AFTER_FIRST_AUDIO' as const, profile, calls: WORKLOAD\.m2Calls, postResponse: true/u);
  assert.match(code, /new DatabasePostResponseBackgroundGate\(serviceApi, new DatabaseBackgroundPermitGate\(serviceApi\)\)/u, 'the post-response work takes the real gate');
  assert.match(code, /const base = mode\.key\.startsWith\('M2_'\) \? 'M0_M2' : 'M0';/u, 'M2 is measured against the same five calls with everything off');
  assert.match(code, /every post-response delivery ran, delayed and never dropped/u);
  assert.doesNotMatch(code, /if \(impact\.M2_/u, 'M2 is reported, not enforced (the speed criterion stays the Product Owner\'s GCR-01)');
});
