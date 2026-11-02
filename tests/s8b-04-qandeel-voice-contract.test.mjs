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
//
// CP2 (the automatic voice reply and the Fast Voice Path, S8B-04's closing change, 2026-11-02; record §11) adds:
//   - T2-01 … T2-07 and R-01 APPROVED verbatim in the record and the phone; VOICE_RECORDING_V3 (V2 with K-07, K-08 and
//     K-13 replaced) current in the API and the phone, installed by 0188 under its guarded digests, with V2 and V1 kept as
//     unchanged history; the record states S8B-04's closing state and the FVP amendment exists;
//   - 0188 opens no voice gate and its verifier runs in CI;
//   - one consent vocabulary across the layers (D4), and a released player stopped and released.

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
const RECORD = 'docs/e2e/QANDEEL_S8B_04_QANDEEL_VOICE_IMPLEMENTATION_RECORD_v1.md';
const AMENDMENT = 'docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-04_VA-11R_TTS_ABUSE_MONITORING_CONTROLLED_AMENDMENT_v1.0.md';
const M0187 = 'database/migrations/0187_s8b_04_qandeel_voice_v1.sql';
const M0188 = 'database/migrations/0188_s8b_04_fast_voice_path_v1.sql';
const FVP = 'docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-04_FAST_VOICE_PATH_CONTROLLED_AMENDMENT_v1.0.md';
const MOBILE_COPY = 'apps/mobile/src/voice-note/voice-note-copy.ts';
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
/** CP2's APPROVED rows as the record states them: `| V3 K-07 | APPROVED | a | b |`, `| T2-01 | … |`, `| R-01 | … |`. */
function approvedRowsCp2() {
  const rows = new Map();
  for (const line of read(RECORD).split('\n')) {
    if (!/^\| (?:V3 K-\d{2}|T2-\d{2}|R-01) \| APPROVED \|/u.test(line)) continue;
    const cells = line.slice(1, -1).split(/(?<!\\)\|/u).map((c) => c.trim().replace(/\\\|/gu, '|'));
    rows.set(cells[0], { a: cells[2], b: cells[3] });
  }
  return rows;
}
/** `id: 'K-..', ar: '…', en: '…'` rows of a slice of a source file (single-quoted literals), unescaped. */
const kRows = (text) => [...text.matchAll(/id: '(K-\d{2})',\s*ar: '((?:[^'\\]|\\')*)',\s*en: '((?:[^'\\]|\\')*)'/gu)]
  .map((m) => ({ id: m[1], ar: unescape(m[2]), en: unescape(m[3]) }));
const between = (text, from, to) => {
  const start = text.indexOf(from);
  assert.ok(start >= 0, `${from} is present`);
  return text.slice(start, to ? text.indexOf(to, start) : undefined);
};
const ids = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);
const constant = (text, name) => {
  const m = new RegExp(`export const ${name} = '((?:[^'\\\\]|\\\\')*)';`, 'u').exec(text);
  assert.ok(m, `${name} is a single-quoted literal`);
  return unescape(m[1]);
};

test('the record carries every CP1 and CP2 Copy Gate row APPROVED and states S8B-04\'s closing state (BG-09); H26 stays pending', () => {
  const rows = approvedRows();
  assert.deepEqual([...rows.keys()].sort(), [...ids('TM', 3), ...ids('S', 6), ...ids('K', 15), 'F-01'].sort());
  assert.deepEqual([...approvedRowsCp2().keys()].sort(), ['R-01', ...ids('T2', 7), 'V3 K-07', 'V3 K-08', 'V3 K-13'].sort());
  const record = read(RECORD);
  assert.doesNotMatch(record, /^\| (?:TM|S|K|F|T2|R|V3 K)-\d{2} \| PROPOSED \|/mu, 'no Copy Gate row is left PROPOSED');
  const banner = /^\*\*Status:\*\* (.+)$/mu.exec(record)[1];
  assert.match(banner, /^`S8B-04 CLOSED \/ READY FOR THE PRODUCT OWNER'S MERGE DECISION \(2026-11-02, the CP2 closing change/u);
  assert.match(banner, /CP1 MERGED THROUGH PR #372 AS 54b5333e/u);
  assert.match(banner, /NOT MERGED \(MERGE ONLY ON THE PRODUCT OWNER'S EXPLICIT «ادمج»\)/u);
  assert.match(banner, /THE PAID RUNS \(D-S5, SPEECHMATICS REALTIME QUALITY, P-1\) NOT RUN, NOT AUTHORIZED/u);
  assert.match(banner, /MIGRATIONS 0187 AND 0188 NOT HOSTED — ALL FOUR VOICE GATES DISABLED — NO PAID PROVIDER CALL/u);
  assert.doesNotMatch(banner, /UNDER REVIEW|\bFROZEN\b/u, 'neither a review banner nor frozen');
  assert.match(record, /\| H26 \| PENDING \|/u, 'H26 stays pending (carried by QAN-BL-VOICE-05)');
  assert.match(record, /## 11\. CP2 — the automatic voice reply and the Fast Voice Path \(S8B-04's closing change\)/u);
  assert.match(record, /### 11\.11 S8B-04's closure \(BG-08 \/ BG-09\)/u);
  assert.match(record, /\| D9 \| NOT AUTHORIZED/u);
  assert.match(read(FVP), /^\*\*Status:\*\* `APPROVED BY THE PRODUCT OWNER \(2026-11-02/mu);
  for (const rule of Array.from({ length: 10 }, (_, i) => `FVP-${i + 1}`)) assert.match(read(FVP), new RegExp(`^\\| ${rule} \\|`, 'mu'), `${rule} is stated`);
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

test('K-01 … K-15 (V2): the code equals the record, 0187 installs exactly it under the guarded digests; V2 and V1 stay history', () => {
  const rows = approvedRows();
  const code = read(CONSENT);
  // RE-ANCHORED by CP2 (migration 0188): V2 is history under its own constant; V3 is current (the next test).
  assert.match(code, /export const VOICE_CONSENT_V2_VERSION = 'VOICE_RECORDING_V2';/u);
  assert.match(code, /export const VOICE_CONSENT_V1_VERSION = 'VOICE_RECORDING_V1';/u);
  const inCode = kRows(between(code, 'export const VOICE_CONSENT_V2_ROWS', 'export const VOICE_CONSENT_VERSION'));
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

test('V3 (CP2): VOICE_RECORDING_V3 is V2 with K-07, K-08 and K-13 replaced, verbatim; 0188 installs exactly it under the guarded digests; the phone carries the same rows', () => {
  const v2Rows = approvedRows();
  const cp2 = approvedRowsCp2();
  const code = read(CONSENT);
  assert.match(code, /export const VOICE_CONSENT_VERSION = 'VOICE_RECORDING_V3';/u);
  const changed = kRows(between(code, 'export const VOICE_CONSENT_V3_CHANGED_ROWS', 'const V3_CHANGES'));
  assert.deepEqual(changed.map((r) => r.id), ['K-07', 'K-08', 'K-13'], 'exactly three rows change');
  for (const r of changed) assert.deepEqual([r.ar, r.en], [cp2.get(`V3 ${r.id}`).a, cp2.get(`V3 ${r.id}`).b], `V3 ${r.id} is verbatim`);
  assert.match(code, /export const VOICE_CONSENT_ROWS: ReadonlyArray<VoiceConsentRow> = VOICE_CONSENT_V2_ROWS\.map\(\(row\) => V3_CHANGES\.get\(row\.id\) \?\? row\);/u);
  const byId = new Map(changed.map((r) => [r.id, r]));
  const v3 = ids('K', 15).map((id) => byId.get(id) ?? { id, ar: v2Rows.get(id).a, en: v2Rows.get(id).b });
  const ar = v3.map((r) => r.ar).join('\n');
  const en = v3.map((r) => r.en).join('\n');
  const migration = read(M0188);
  assert.equal(/\$consent_ar\$([\s\S]*?)\$consent_ar\$/u.exec(migration)[1], ar, 'the Arabic text 0188 installs is V3, one row per line');
  assert.equal(/\$consent_en\$([\s\S]*?)\$consent_en\$/u.exec(migration)[1], en, 'the English text 0188 installs is V3, one row per line');
  assert.match(migration, /install_consent_text_v1\(\n  'VOICE_RECORDING_V3',/u);
  for (const digest of [sha256(ar), sha256(en)]) {
    assert.ok(migration.includes(`t.text_ar_sha256 = '${digest}'`) || migration.includes(`t.text_en_sha256 = '${digest}'`), 'the deploy guard requires the V3 digest');
    assert.ok(read('database/qandeel-voice-0188-anchor.mjs').includes(digest), 'the verifiers\' anchor pins the same digest');
  }
  // V2 and V1 stay as they are: 0188's guard requires their unchanged digests; 0187 still installs V2 word for word.
  const v2ar = ids('K', 15).map((id) => v2Rows.get(id).a).join('\n');
  assert.ok(migration.includes(`t.text_ar_sha256 = '${sha256(v2ar)}'`), 'V2 unchanged under 0188');
  assert.ok(migration.includes("t.version = 'VOICE_RECORDING_V1' AND NOT t.is_current"), 'V1 historical under 0188');
  assert.equal(/\$consent_ar\$([\s\S]*?)\$consent_ar\$/u.exec(read(M0187))[1], v2ar, '0187 is not edited');
  // The phone carries the same version and rows: its guard refuses any other text (title first, agree / decline last).
  const mobile = read(MOBILE_COPY);
  assert.match(mobile, /export const VOICE_CONSENT_VERSION = 'VOICE_RECORDING_V3';/u);
  assert.deepEqual(kRows(between(mobile, 'export const VOICE_CONSENT_COPY_ROWS', '];')), v3, 'the phone\'s K-01 … K-15 are the server\'s');
});

test('T2-01 … T2-07 and R-01 (CP2) are verbatim on the phone; R-01 is in no consent text', () => {
  const cp2 = approvedRowsCp2();
  const mobile = read(MOBILE_COPY);
  const unquote = (s) => s.slice(1, -1).replace(/\\(.)/gu, '$1');
  const inCode = new Map([...mobile.matchAll(/\{?\s*id: '((?:T2-\d{2})|R-01)',\s*ar: ('(?:[^'\\]|\\.)*'),\s*en: ('(?:[^'\\]|\\.)*'),?\s*\}?/gu)]
    .map((m) => [m[1], { ar: unquote(m[2]), en: unquote(m[3]) }]));
  assert.deepEqual([...inCode.keys()].sort(), [...ids('T2', 7), 'R-01'].sort());
  for (const [id, row] of inCode) assert.deepEqual([row.ar, row.en], [cp2.get(id).a, cp2.get(id).b], `${id} is verbatim`);
  assert.doesNotMatch(mobile, /T2-0\d[^\n]*PROPOSED|PROPOSED, Arabic and English, for the CP2 Copy Gate/u, 'no CP2 row is described as PROPOSED');
  assert.ok(!read(M0188).includes(cp2.get('R-01').a) && !read(CONSENT).includes(cp2.get('R-01').a), 'R-01 is outside every consent text');
});

test('0188 is forward-only, one transaction, opens no voice gate, grants no client role, and its verifier runs in CI', () => {
  const migration = read(M0188);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((migration.match(/^COMMIT;$/gmu) ?? []).length, 1);
  assert.doesNotMatch(migration, /DRAFT|PLACEHOLDER|PROPOSED/u, 'no draft word is left in the migration');
  const code = codeOnly(migration);
  assert.doesNotMatch(code, /set_voice_launch_capability_v1|(?:INSERT INTO|UPDATE)\s+voice_private\.voice_launch_capability_(?:states|events)/u, 'no gate is set');
  assert.match(code, /every voice capability scope must remain DISABLED/u, 'the deploy guard refuses an open gate');
  assert.doesNotMatch(code, /GRANT [^;]*TO (?:anon|authenticated|PUBLIC)\b/u, 'no client role is granted anything');
  assert.match(code, /VOICE_RECORDING_V3 must be the current approved text and V2 and V1 historical and unchanged/u);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['verify:fast-voice-path:integration'], 'node --env-file-if-exists=.env database/verify-migration-0188.mjs');
  assert.match(read('.github/workflows/api-ci.yml'), /run: npm run verify:fast-voice-path:integration/u);
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
  // RE-ANCHORED by S8B-04 CP2: the runner may also hand over the automatic voice reply (D-S2 / D-S3), nothing else.
  assert.match(runner, /\{ modality: 'VOICE_NOTE'(?:, liveReply: options\.liveReply)? \}/u);
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

// S8B-04 CP2 (D4, the Product Owner's gate, 2026-11-02) — the consent words cross three layers unchanged: the states
// voice_private.consent_state_v1 returns (0183) are what the API passes through, and the phone reads exactly those four
// words (no word of its own). S8B-03 shipped a phone that read only NONE / GRANTED / WITHDRAWN, which no real server
// sends: Voice Notes were never offered. The validation fakes answer in the server's words too.
test('CP2 D4: the consent states of the database, the API and the phone are one vocabulary', () => {
  const m0183 = read('database/migrations/0183_s8b_02_voice_foundation_v1.sql');
  const fn = m0183.slice(m0183.indexOf('CREATE FUNCTION voice_private.consent_state_v1'), m0183.indexOf('CREATE FUNCTION public.server_voice_consent_state_v1'));
  const dbStates = [...new Set([...fn.matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]).filter((w) => w !== 'VOICE_RECORDING'))].sort();
  assert.deepEqual(dbStates, ['GRANTED_CURRENT', 'NOT_GRANTED', 'VERSION_NOT_CURRENT', 'WITHDRAWN']);
  const service = codeOnly(read('apps/api/src/voice-media/voice-notes.service.ts'));
  assert.match(service, /consentState: state\.consent_state,/u, 'GET /voice/consent passes the state through');
  assert.match(service, /consentState: row\.consent_state,/u, 'GET /voice/capability passes the state through');
  const api = codeOnly(read('apps/mobile/src/voice-note/voice-note-api.ts'));
  const map = api.slice(api.indexOf('SERVER_VOICE_CONSENT_STATES'), api.indexOf('});', api.indexOf('SERVER_VOICE_CONSENT_STATES')));
  const phoneWords = [...map.matchAll(/^\s+([A-Z_]+): '([A-Z]+)',$/gmu)].map((m) => [m[1], m[2]]);
  assert.deepEqual(phoneWords.map(([w]) => w).sort(), dbStates, 'the phone maps exactly the database states');
  assert.deepEqual(Object.fromEntries(phoneWords), { GRANTED_CURRENT: 'GRANTED', VERSION_NOT_CURRENT: 'OUTDATED', NOT_GRANTED: 'NONE', WITHDRAWN: 'WITHDRAWN' });
  assert.match(api, /const consentState = \(value: unknown\): VoiceConsentState \| null =>\s+\(typeof value === 'string' && Object\.prototype\.hasOwnProperty\.call\(SERVER_VOICE_CONSENT_STATES, value\)/u,
    'the decoder reads through the map only');
  assert.match(api, /consentCurrent: state === 'GRANTED' && answer\.body\.grantedVersion === answer\.body\.currentVersion && answer\.body\.currentVersion === VOICE_CONSENT_VERSION,/u,
    'only a current consent to the version this build carries permits anything');
  for (const fake of ['scripts/s8b-03/fake-voice-api.cjs', 'scripts/s8b-04/fake-auto-reply-server.cjs']) {
    const words = [...codeOnly(read(fake)).matchAll(/consentState: '([A-Z_]+)'/gu)].map((m) => m[1]);
    for (const word of words) assert.ok(dbStates.includes(word), `${fake} answers in the server's words (${word})`);
  }
  assert.match(read('scripts/s8b-03/fake-voice-api.cjs'), /'GRANTED_CURRENT' : 'VERSION_NOT_CURRENT'\)\s+: state\.consent === 'WITHDRAWN' \? 'WITHDRAWN' : 'NOT_GRANTED'\);/u);
});

// S8B-04 CP2 (device finding, 2026-11-02) — expo-audio's `remove()` on Android only forgets the player in its module
// (`players.remove(player.id)`); the native player keeps playing until garbage collection. A voice let go while speaking
// (leaving the conversation, the reply's announced end) went on unseen. The port stops and releases it, in this order.
test('CP2: a released player is stopped and released, never left to garbage collection', () => {
  const port = codeOnly(read('apps/mobile/src/voice-note/voice-note-player-port.ts'));
  assert.match(port, /release: \(\) => \{\s+subscription\.remove\(\);\s+player\.pause\(\);\s+player\.remove\(\);\s+player\.release\(\);\s+\},/u);
  const moduleSource = read('node_modules/expo-audio/android/src/main/java/expo/modules/audio/AudioModule.kt');
  assert.match(moduleSource, /Function\("remove"\) \{ player: AudioPlayer ->\s+players\.remove\(player\.id\)\s+\}/u,
    'the reason stands: if expo-audio ever stops the player in remove(), revisit this port');
});
