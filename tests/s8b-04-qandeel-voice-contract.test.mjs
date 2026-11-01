import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// S8B-04 — QANDEEL's Voice (CP1: Server & Intelligence, migration 0187). This static contract proves, with no database
// and nothing sent off the machine:
//   - every Copy Gate row the Product Owner APPROVED verbatim for CP1 on 2026-11-01 (TM-01 … TM-03, S-01 … S-06,
//     K-01 … K-15, F-01) is byte-identical in the implementation record and the code that uses it; the consent text
//     0187 installs is K-01 … K-15 under the digests its deploy guard requires, and V1 stays history;
//   - the record states CP1 UNDER REVIEW (not CLOSED), H26 pending, and the VA-11R amendment exists;
//   - 0187 opens no voice gate and is wired into CI with its verifier and its Listen proof (pg and PostgREST);
//   - the ONE speech route: Google Cloud (aiplatform) through ADC, gemini-3.8-flash-tts, Achird, a closed request body;
//     no AI Studio, no Gemini SDK, no API key, no fallback;
//   - Listen: the GET reads the 15-minute store only and never starts paid work; no mobile Listen surface in CP1;
//   - TM-01 reaches the model on a VOICE_NOTE turn only (the Voice Note runner alone passes it), TM-03 only when the
//     hint policy is not OFF (CP1: OFF), TM-02 is wired nowhere; the lexicon candidates stay disabled until P-1;
//   - nothing in QANDEEL's voice code logs.
// The behaviour itself is proven by verify-migration-0187, prove-0187 (pg locally and in CI; PostgREST in CI), the API
// specs (speech-rendering, the reply channel, the Vertex adapter against its fake server, Listen) the record names.

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
const RECORD = 'docs/e2e/QANDEEL_S8B_04_QANDEEL_VOICE_IMPLEMENTATION_RECORD_v1.md';
const AMENDMENT = 'docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-04_VA-11R_TTS_ABUSE_MONITORING_CONTROLLED_AMENDMENT_v1.0.md';
const M0187 = 'database/migrations/0187_s8b_04_qandeel_voice_v1.sql';
const POLICY = 'apps/api/src/conversation/behavioral-response-policy.service.ts';
const CONSENT = 'apps/api/src/voice-media/voice-consent-text.ts';
const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/gu, '$1');
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const unescape = (s) => s.replace(/\\'/gu, "'");
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist') return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const files = (dir) => walk(join(root, dir)).map((p) => relative(root, p).replaceAll('\\', '/'));

/** The APPROVED rows as the record states them: `| ID | APPROVED | a | b |` (TM rows: `| ID | APPROVED | text |`); `\|` is a literal bar. */
function approvedRows() {
  const rows = new Map();
  for (const line of read(RECORD).split('\n')) {
    if (!/^\| (?:TM|S|K|F)-\d{2} \| APPROVED \|/u.test(line)) continue;
    const cells = line.slice(1, -1).split(/(?<!\\)\|/u).map((c) => c.trim().replace(/\\\|/gu, '|'));
    rows.set(cells[0], { a: cells[2], b: cells[3] });
  }
  return rows;
}
const ids = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);
const constant = (text, name) => {
  const m = new RegExp(`export const ${name} = '((?:[^'\\\\]|\\\\')*)';`, 'u').exec(text);
  assert.ok(m, `${name} is a single-quoted literal`);
  return unescape(m[1]);
};

test('the record carries every CP1 Copy Gate row APPROVED, states CP1 UNDER REVIEW (not CLOSED) and keeps H26 pending', () => {
  const rows = approvedRows();
  assert.deepEqual([...rows.keys()].sort(), [...ids('TM', 3), ...ids('S', 6), ...ids('K', 15), 'F-01'].sort());
  const record = read(RECORD);
  assert.doesNotMatch(record, /^\| (?:TM|S|K|F)-\d{2} \| PROPOSED \|/mu, 'no CP1 row is left PROPOSED');
  const banner = /^\*\*Status:\*\* (.+)$/mu.exec(record)[1];
  assert.match(banner, /^`S8B-04 CP1 UNDER REVIEW/u);
  assert.match(banner, /NOT MERGED \(MERGE ONLY ON THE PRODUCT OWNER'S EXPLICIT «ادمج»\)/u);
  assert.match(banner, /MIGRATION 0187 NOT HOSTED — ALL FOUR VOICE GATES DISABLED — NO PAID PROVIDER CALL/u);
  assert.doesNotMatch(banner, /\bCLOSED\b|\bFROZEN\b/u, 'CP1 is not declared closed');
  assert.match(record, /\| H26 \| PENDING \|/u, 'H26 stays pending');
  for (const check of ['V-1', 'V-2', 'V-7']) assert.match(record, new RegExp(`^\\| ${check} \\|`, 'mu'), `${check} is recorded`);
  assert.match(record, /## Approvals needed before CP2/u);
  assert.match(read(AMENDMENT), /^\*\*Status:\*\* `APPROVED BY THE PRODUCT OWNER \(2026-11-01/mu);
  assert.match(read(AMENDMENT), /90 days/u);
});

test('TM-01 … TM-03 and S-01 … S-06 are verbatim in the code', () => {
  const rows = approvedRows();
  const policy = read(POLICY);
  assert.equal(constant(policy, 'VOICE_DELIVERY_LINE_GUIDANCE_TM_01'), rows.get('TM-01').a);
  assert.equal(constant(policy, 'VOICE_SPOKEN_REPLY_GUIDANCE_TM_02'), rows.get('TM-02').a);
  assert.equal(constant(policy, 'VOICE_PRONUNCIATION_HINT_GUIDANCE_TM_03'), rows.get('TM-03').a);
  const styles = read('apps/api/src/speech-rendering/speech-styles.ts');
  const inCode = [...styles.matchAll(/(CALM|JOY|PLAYFUL|SURPRISE|EMPATHY|SERIOUS): \{ id: '(S-\d{2})', style: '((?:[^'\\]|\\')*)' \}/gu)];
  assert.deepEqual(inCode.map((m) => m[2]), ids('S', 6));
  for (const [, expression, id, style] of inCode) assert.deepEqual([expression, unescape(style)], [rows.get(id).a, rows.get(id).b], `${id} is verbatim`);
});

test('K-01 … K-15: the current consent text in code equals the record, 0187 installs exactly it under the guarded digests, V1 stays history', () => {
  const rows = approvedRows();
  const code = read(CONSENT);
  assert.match(code, /export const VOICE_CONSENT_VERSION = 'VOICE_RECORDING_V2';/u);
  assert.match(code, /export const VOICE_CONSENT_V1_VERSION = 'VOICE_RECORDING_V1';/u);
  const inCode = [...code.matchAll(/id: '(K-\d{2})',\s*ar: '((?:[^'\\]|\\')*)',\s*en: '((?:[^'\\]|\\')*)'/gu)]
    .map((m) => ({ id: m[1], ar: unescape(m[2]), en: unescape(m[3]) }));
  assert.deepEqual(inCode.map((r) => r.id), ids('K', 15));
  for (const r of inCode) assert.deepEqual([r.ar, r.en], [rows.get(r.id).a, rows.get(r.id).b], `${r.id} is verbatim`);
  assert.match(code, /export function consentText[\s\S]*VOICE_CONSENT_ROWS\.map/u, 'the served text is the current version');
  const migration = read(M0187);
  const ar = /\$consent_ar\$([\s\S]*?)\$consent_ar\$/u.exec(migration)[1];
  const en = /\$consent_en\$([\s\S]*?)\$consent_en\$/u.exec(migration)[1];
  assert.equal(ar, inCode.map((r) => r.ar).join('\n'), 'the Arabic text 0187 installs is K-01 … K-15, one row per line');
  assert.equal(en, inCode.map((r) => r.en).join('\n'), 'the English text 0187 installs is K-01 … K-15, one row per line');
  assert.ok(migration.includes(`t.text_ar_sha256 = '${sha256(ar)}'`), 'the deploy guard requires this Arabic digest');
  assert.ok(migration.includes(`t.text_en_sha256 = '${sha256(en)}'`), 'the deploy guard requires this English digest');
  const anchor = read('database/qandeel-voice-0187-anchor.mjs');
  assert.ok(anchor.includes(sha256(ar)) && anchor.includes(sha256(en)), 'the verifiers\' anchor pins the same digests');
  // V1 is never edited: 0186's text is still there, word for word, under its own digests.
  assert.match(read('database/migrations/0186_s8b_03_personal_voice_notes_v1.sql'), /'VOICE_RECORDING_V1'/u);
});

test('F-01 is verbatim in the code; CP1 ships its structure only, with no audio file', () => {
  const rows = approvedRows();
  const line = read('apps/api/src/voice/failure-line/spoken-failure-line.ts');
  const ar = /ar: '((?:[^'\\]|\\')*)'/u.exec(line)[1];
  const en = /en: "([^"]*)"/u.exec(line)[1];
  assert.deepEqual([ar, en], [rows.get('F-01').a, rows.get('F-01').b]);
  const manifest = JSON.parse(read('apps/api/fixtures/voice-tts/manifest.json'));
  assert.deepEqual([manifest.line, manifest.state, manifest.files], ['F-01', 'NOT_INSTALLED', { ar: null, en: null }]);
  assert.deepEqual(files('apps/api/fixtures/voice-tts'), ['apps/api/fixtures/voice-tts/manifest.json'], 'no audio file ships in CP1');
});

test('0187 is forward-only, one transaction, opens no voice gate, and its verifier and Listen proof run in CI', () => {
  const migration = read(M0187);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((migration.match(/^COMMIT;$/gmu) ?? []).length, 1);
  const code = codeOnly(migration);
  assert.doesNotMatch(code, /set_voice_launch_capability_v1|(?:INSERT INTO|UPDATE)\s+voice_private\.voice_launch_capability_(?:states|events)/u, 'no gate is set');
  assert.match(code, /every voice capability scope must remain DISABLED/u, 'the deploy guard refuses an open gate');
  assert.doesNotMatch(code, /GRANT [^;]*TO (?:anon|authenticated|PUBLIC)\b/u, 'no client role is granted anything');
  assert.match(code, /INSERT INTO account_erasure_private\.coverage_registry/u, 'the new relations are in the erasure coverage');
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.equal(scripts['verify:qandeel-voice:integration'], 'node --env-file-if-exists=.env database/verify-migration-0187.mjs');
  assert.equal(scripts['prove:qandeel-voice-listen:integration'], 'node --env-file-if-exists=.env database/prove-0187-listen-fake-vertex.mjs');
  assert.equal(scripts['test:s8b-04-qandeel-voice-contract'], 'node --test tests/s8b-04-qandeel-voice-contract.test.mjs');
  const ci = read('.github/workflows/api-ci.yml');
  const at = (needle) => { const i = ci.indexOf(needle); assert.ok(i >= 0, `CI runs ${needle}`); return i; };
  assert.ok(at('npm run verify:personal-voice-notes:integration') < at('npm run verify:qandeel-voice:integration'), '0187 is verified after 0186');
  assert.ok(at('npm run verify:qandeel-voice:integration') < at('run: npm run prove:qandeel-voice-listen:integration'));
  assert.match(ci, /POSTGREST_VERSION="\$version" npm run --silent prove:qandeel-voice-listen:integration/u, 'the Listen proof runs through every PostgREST version');
  assert.match(ci, /run: npm run test:s8b-04-qandeel-voice-contract/u);
  assert.equal(read('apps/api/src/voice-media/reply-speech.repository.ts').includes('server_set'), false);
});

test('the ONE speech route: Google Cloud through ADC, gemini-3.8-flash-tts, Achird, a closed request body, no key, no fallback', () => {
  const config = read('apps/api/src/voice/vertex-speech/vertex-speech.config.ts');
  assert.match(config, /VERTEX_SPEECH_MODEL = 'gemini-3\.8-flash-tts'/u);
  assert.match(config, /VERTEX_SPEECH_VOICE = 'Achird'/u);
  assert.match(config, /VERTEX_SPEECH_LOCATION = 'global'/u);
  assert.match(config, /VERTEX_SPEECH_BASE_URL = 'https:\/\/aiplatform\.googleapis\.com'/u);
  assert.match(config, /QANDEEL_VERTEX_TTS_PROJECT/u);
  const api = files('apps/api/src').filter((p) => !p.endsWith('.spec.ts'));
  for (const path of api) {
    const text = read(path);
    assert.doesNotMatch(text, /generativelanguage\.googleapis|@google\/genai|GEMINI_API_KEY|GOOGLE_API_KEY|AI_STUDIO/u, `${path}: no AI Studio, no Gemini SDK, no API key`);
  }
  for (const path of files('apps/api/src/voice/vertex-speech').filter((p) => !p.endsWith('.spec.ts'))) {
    assert.doesNotMatch(read(path), /[?&]key=|x-goog-api-key|apiKey/u, `${path} sends no API key`);
  }
  assert.match(read('apps/api/src/voice/vertex-speech/vertex-speech.auth.ts'), /new GoogleAuth\(\{ scopes: \[VERTEX_SPEECH_SCOPE\] \}\)/u, 'ADC only');
  const request = codeOnly(read('apps/api/src/voice/vertex-speech/vertex-speech.request.ts'));
  assert.doesNotMatch(request, /systemInstruction|tools|toolConfig|safetySettings|cachedContent|labels|\bstore\b|temperature|topP|topK|seed|multiSpeaker|languageCode/u, 'nothing beyond the closed body');
  assert.match(request, /responseModalities: \['AUDIO'\]/u);
  assert.match(read('apps/api/src/voice/vertex-speech/vertex-speech.adapter.ts'), /redirect: 'error'/u);
  const module = codeOnly(read('apps/api/src/voice/voice.module.ts'));
  assert.equal((module.match(/new VertexSpeechAdapter\(/gu) ?? []).length, 1, 'one synthesis route, no fallback');
  assert.doesNotMatch(module, /Fake[A-Z]\w*/u, 'no fake is composed');
  for (const path of [...files('apps/mobile/src'), 'apps/mobile/app.json', 'apps/mobile/app.config.js', 'apps/mobile/package.json']) {
    assert.doesNotMatch(read(path), /aiplatform\.googleapis|QANDEEL_VERTEX_TTS|google-auth-library/u, `${path} reaches no provider`);
  }
  assert.match(read('.env.example'), /^QANDEEL_VERTEX_TTS_PROJECT=$/mu);
});

test('Listen: the paid command is a POST; the GET reads the store only; one admission per segment; no mobile Listen surface yet', () => {
  const controller = codeOnly(read('apps/api/src/voice/listen/reply-listen.controller.ts'));
  assert.equal((controller.match(/@Get\(/gu) ?? []).length, 1);
  const getHandler = /@Get\('replies\/:turnId\/listen\/:listenId\/segments\/:index\/audio'\)[\s\S]*?\n  \}\n/u.exec(controller)[0];
  assert.match(getHandler, /this\.listen\.audio\(/u);
  assert.doesNotMatch(getHandler, /synthesize|start\(|admit/u, 'the GET starts nothing');
  assert.match(controller, /@Post\('replies\/:turnId\/listen\/:listenId\/segments\/:index\/synthesis'\)/u);
  assert.equal((controller.match(/@Header\('Cache-Control', PRIVATE_NO_STORE\)/gu) ?? []).length, 4, 'every Listen answer is no-store, private');
  const service = codeOnly(read('apps/api/src/voice/listen/reply-listen.service.ts'));
  const audio = /async audio\([\s\S]*?\n  \}\n/u.exec(service)[0];
  assert.match(audio, /this\.repository\.readAudio\(/u);
  assert.doesNotMatch(audio, /route|adapter|admission|admitSynthesis|retrySynthesis|startListen|synthesize/u, 'reading audio never reaches the provider');
  assert.match(service, /this\.repository\.admitSynthesis\(/u, 'paid work is admitted by the database first');
  for (const path of files('apps/mobile/src')) {
    assert.doesNotMatch(read(path), /\/voice\/replies|\/listen\b|segments\/[^'"]*\/synthesis/u, `${path}: no mobile Listen surface in CP1`);
  }
});

test('TM-01 on VOICE_NOTE turns only, TM-03 only with the hint policy on (CP1 OFF), TM-02 wired nowhere, lexicon disabled', () => {
  const api = files('apps/api/src').filter((p) => !p.endsWith('.spec.ts'));
  const voiceNoteCallers = api.filter((p) => /modality: 'VOICE_NOTE'/u.test(codeOnly(read(p))));
  assert.deepEqual(voiceNoteCallers, ['apps/api/src/conversation/conversation.service.ts'], 'only the Voice Note runner passes VOICE_NOTE');
  const service = read('apps/api/src/conversation/conversation.service.ts');
  const runner = /async runCommittedTurn\([\s\S]*?\n  \}\n/u.exec(service)[0];
  assert.match(runner, /\{ modality: 'VOICE_NOTE' \}/u);
  assert.equal((codeOnly(service).match(/modality: 'VOICE_NOTE'/gu) ?? []).length, 1);
  for (const path of api.filter((p) => p !== POLICY)) {
    assert.doesNotMatch(read(path), /withSpokenCallReply|VOICE_SPOKEN_REPLY_GUIDANCE_TM_02/u, `${path} does not wire TM-02 (S8B-05)`);
  }
  const orchestrator = codeOnly(read('apps/api/src/conversation/conversation-orchestrator.service.ts'));
  assert.match(orchestrator, /voiceNote \? withVoiceNoteChannel\(textGuidance, \{ hints: SPEECH_HINT_POLICY !== 'OFF' \}\) : textGuidance/u);
  assert.match(read('apps/api/src/speech-rendering/speech-hints.ts'), /export const SPEECH_HINT_POLICY: SpeechHintPolicy = 'OFF';/u);
  const lexicon = codeOnly(read('apps/api/src/speech-rendering/pronunciation-lexicon.ts'));
  assert.equal((lexicon.match(/enabled: false/gu) ?? []).length, 4, 'the four candidates are built');
  assert.doesNotMatch(lexicon, /enabled: true/u, 'none is enabled before P-1');
});

test('nothing in QANDEEL\'s voice code logs, and no audio, text or token reaches telemetry', () => {
  const voice = [
    ...files('apps/api/src/speech-rendering'), ...files('apps/api/src/voice/vertex-speech'), ...files('apps/api/src/voice/listen'),
    ...files('apps/api/src/voice/failure-line'), 'apps/api/src/voice/speech-admission.guard.ts',
    'apps/api/src/voice-media/reply-speech.repository.ts', 'apps/api/src/voice-media/reply-speech-sweep.worker.ts',
  ].filter((p) => p.endsWith('.ts') && !p.endsWith('.spec.ts'));
  for (const path of voice) {
    assert.doesNotMatch(codeOnly(read(path)), /\bLogger\b|console\.|captureException|Sentry/u, `${path} logs nothing`);
  }
  assert.doesNotMatch(codeOnly(read('apps/api/src/voice/vertex-speech/vertex-speech.auth.ts')), /\btoken\b[^;]*\b(?:signal|record|emit)\(/u);
});
