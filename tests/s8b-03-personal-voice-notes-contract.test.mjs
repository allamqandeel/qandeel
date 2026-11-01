import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// S8B-03 — Personal Voice Notes (CP1: Server & Intelligence, migration 0186; CP2: Mobile & Integration, the closing
// change). This static contract proves, with no database and nothing sent off the machine:
//   - all 60 Copy Gate rows the Product Owner APPROVED verbatim on 2026-10-31 (C-01 … C-57, M-01 … M-03) are
//     byte-identical in the implementation record and the code that uses them; the consent text 0186 installs is
//     C-01 … C-11 under the digests its deploy guard requires; C-12 is the microphone purpose everywhere it is declared;
//   - the record states S8B-03's closing state (BG-09) and the backlog carries its admissions (BG-08);
//   - 0186 opens no voice gate, and is wired into CI with its verifier and its live PostgREST proof;
//   - the mobile Voice Note: expo-audio with both background modes off, the voice routes reached only from
//     apps/mobile/src/voice-note/, the Product Owner's screen-reader step, the native gate in Mobile CI, and a proof
//     build that the Product build can never reach;
//   - the Speechmatics key is server-only, the adapter is the one network path, and nothing in the voice code logs.
// The behaviour itself is proven by verify-migration-0186 (C0 … V-X), prove-0186 (CI), the API specs, the mobile jest
// suites, the native gate and the device proofs the record names (§11).

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
const RECORD = 'docs/e2e/QANDEEL_S8B_03_PERSONAL_VOICE_NOTES_IMPLEMENTATION_RECORD_v1.md';
const AMENDMENT = 'docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-03_MACHINE_ASR_FRESH_EVIDENCE_CONTROLLED_AMENDMENT_v1.0.md';
const M0186 = 'database/migrations/0186_s8b_03_personal_voice_notes_v1.sql';
const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/gu, '$1');
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist') return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const files = (dir) => walk(join(root, dir)).map((p) => relative(root, p).replaceAll('\\', '/'));

/** The APPROVED rows as the record states them: `| ID | APPROVED | ar | en |` (M rows: `| ID | APPROVED | where | text |`). */
function approvedRows() {
  const rows = new Map();
  for (const line of read(RECORD).split('\n')) {
    const m = /^\| ((?:C|M)-\d{2}) \| APPROVED \| (.+) \| (.+) \|$/u.exec(line);
    if (m) rows.set(m[1], { a: m[2], b: m[3] });
  }
  return rows;
}
const cId = (n) => `C-${String(n).padStart(2, '0')}`;
const EXPECTED_IDS = [
  ...Array.from({ length: 12 }, (_, i) => cId(i + 1)),
  'C-54', 'C-55', 'C-56', 'C-57', 'M-01', 'M-02', 'M-03',
];
/** C-13 … C-53: the Voice Note's words, approved for CP2. */
const CP2_IDS = Array.from({ length: 41 }, (_, i) => cId(i + 13));

test('the record carries all 60 APPROVED rows, none PROPOSED, and states S8B-03\'s closing state (BG-09)', () => {
  const rows = approvedRows();
  assert.deepEqual([...rows.keys()].sort(), [...EXPECTED_IDS, ...CP2_IDS].sort());
  const record = read(RECORD);
  assert.doesNotMatch(record, /^\| (?:C|M)-\d{2} \| PROPOSED \|/mu, 'no row is left PROPOSED');
  const banner = /^\*\*Status:\*\* (.+)$/mu.exec(record)[1];
  assert.match(banner, /^`S8B-03 CLOSED \/ READY FOR THE PRODUCT OWNER'S MERGE DECISION \(2026-10-31, the CP2 closing change/u);
  assert.match(banner, /CP1 MERGED THROUGH PR #370 AS e68ca146/u);
  assert.match(banner, /NOT MERGED \(MERGE ONLY ON THE PRODUCT OWNER'S EXPLICIT «ادمج»\)/u);
  assert.match(banner, /MIGRATION 0186 NOT HOSTED — ALL FOUR VOICE GATES DISABLED — NO PAID PROVIDER CALL/u);
  assert.match(banner, /NOT USER-READY`$/u);
  assert.doesNotMatch(banner, /\bCANDIDATE\b|\bawaiting\b/iu, 'the closed banner advertises no pre-closure state');
  assert.doesNotMatch(record, /S8B-03 (?:IS )?CLOSED \/ (?:FROZEN|MERGED)/u, 'S8B-03 is not declared merged before «ادمج»');
  // The Product Owner's CP2 decisions live in the record; the screen-reader step is CP2-6.
  assert.match(record, /\| CP2-6 \| \*\*The Timeline design APPROVED\*\*/u);
  assert.match(record, /a message shorter than 30 s moves 1 s per increment \/ decrement, one of 30 s or more 5 s, always inside the recording's bounds/u);
  for (const id of ['PC-S1 / S1b', 'PC-S2', 'PC-S3', 'PC-S4', 'PC-S5', 'PC-S6', 'PC-S7', 'PC-D']) {
    assert.ok(record.includes(`| ${id} |`), `${id} stays an open condition in the record`);
  }
  assert.match(record, /are \*\*not\*\* proofs/u);
  assert.match(read(AMENDMENT), /^\*\*Status:\*\* `APPROVED BY THE PRODUCT OWNER \(2026-10-31/mu);
});

test('C-01 … C-11: the consent text in code equals the record, and 0186 installs exactly it under the guarded digests', () => {
  const rows = approvedRows();
  const code = read('apps/api/src/voice-media/voice-consent-text.ts');
  // RE-ANCHORED by S8B-04 CP1 (2026-11-01, migration 0187): VOICE_RECORDING_V1 (C-01 … C-11) is HISTORY, kept unchanged
  // under its own constant; the current version is VOICE_RECORDING_V2 (K-01 … K-15), pinned by the S8B-04 contract test.
  assert.match(code, /export const VOICE_CONSENT_V1_VERSION = 'VOICE_RECORDING_V1';/u);
  assert.match(code, /export const VOICE_CONSENT_VERSION = 'VOICE_RECORDING_V2';/u);
  const unescape = (s) => s.replace(/\\'/gu, "'");
  const inCode = [...code.matchAll(/id: '(C-\d{2})',\s*ar: '((?:[^'\\]|\\')*)',\s*en: '((?:[^'\\]|\\')*)'/gu)]
    .map((m) => ({ id: m[1], ar: unescape(m[2]), en: unescape(m[3]) }));
  assert.deepEqual(inCode.map((r) => r.id), EXPECTED_IDS.slice(0, 11));
  for (const r of inCode) assert.deepEqual([r.ar, r.en], [rows.get(r.id).a, rows.get(r.id).b], `${r.id} is verbatim`);
  const migration = read(M0186);
  const ar = /\$consent_ar\$([\s\S]*?)\$consent_ar\$/u.exec(migration)[1];
  const en = /\$consent_en\$([\s\S]*?)\$consent_en\$/u.exec(migration)[1];
  assert.equal(ar, inCode.map((r) => r.ar).join('\n'), 'the Arabic text 0186 installs is C-01 … C-11, one row per line');
  assert.equal(en, inCode.map((r) => r.en).join('\n'), 'the English text 0186 installs is C-01 … C-11, one row per line');
  assert.ok(migration.includes(`t.text_ar_sha256 = '${sha256(ar)}'`), 'the deploy guard requires this Arabic digest');
  assert.ok(migration.includes(`t.text_en_sha256 = '${sha256(en)}'`), 'the deploy guard requires this English digest');
});

test('C-54 … C-57 are QANDEEL\'s spoken Memory command replies, verbatim', () => {
  const rows = approvedRows();
  const copy = read('apps/api/src/memory/memory-control.copy.ts');
  assert.ok(copy.includes(`ar: '${rows.get('C-54').a}'`), 'C-54 ar');
  assert.ok(copy.includes(`en: "${rows.get('C-54').b}"`), 'C-54 en');
  // {«…»} / {“…”} is the quoted Memory (quoteMemory adds the marks), so the template carries `${quoteMemory(...)}` there.
  const template = (text, ...args) => {
    let i = 0;
    return text.replace(/\{[«“]…[»”]\}/gu, () => `\${quoteMemory(language, ${args[i++]})}`);
  };
  assert.ok(copy.includes(`\`${template(rows.get('C-55').a, 'content')}\``), 'C-55 ar');
  assert.ok(copy.includes(`\`${template(rows.get('C-55').b, 'content')}\``), 'C-55 en');
  assert.ok(copy.includes(`\`${template(rows.get('C-56').a, 'content')}\``), 'C-56 ar');
  assert.ok(copy.includes(`\`${template(rows.get('C-56').b, 'content')}\``), 'C-56 en');
  assert.ok(copy.includes(`\`${template(rows.get('C-57').a, 'previous', 'current')}\``), 'C-57 ar');
  assert.ok(copy.includes(`\`${template(rows.get('C-57').b, 'previous', 'current')}\``), 'C-57 en');
  assert.match(copy, /return language === 'ar' \? `«\$\{bounded\}»` : `“\$\{bounded\}”`;/u, 'the marks are the approved ones');
});

test('M-01 … M-03 are the model texts, verbatim, and M-01 / M-03 are added only with a voice source', () => {
  const rows = approvedRows();
  const model = read('apps/api/src/memory/machine-asr-model-copy.ts');
  const strip = (cell) => cell.replace(/^`|`$/gu, '').replace(/\\\|/gu, '|');
  assert.ok(model.includes(`"${strip(rows.get('M-01').b)}"`), 'M-01');
  assert.ok(model.includes(`"${strip(rows.get('M-02').b)}"`), 'M-02');
  assert.ok(model.includes(`'${strip(rows.get('M-03').b)}'`), 'M-03');
  assert.match(read('apps/api/src/hypothesis/deepseek-hypothesis-candidate.generator.ts'),
    /return request\.eligibleEvidence\.some\(\(item\) => item\.source === 'MACHINE_ASR'\) \? `\$\{base\} \$\{MACHINE_ASR_SOURCE_GUIDANCE\}` : base;/u);
  assert.match(read('apps/api/src/model-router/model-router.types.ts'),
    /\$\{memoryContext\.some\(\(item\) => item\.source === 'MACHINE_ASR'\) \? ` \$\{MACHINE_ASR_SOURCE_GUIDANCE\}` : ''\}/u);
});

/** The mobile copy module's rows, unescaped. */
function mobileRows() {
  const copy = read('apps/mobile/src/voice-note/voice-note-copy.ts');
  const unquote = (s) => s.slice(1, -1).replace(/\\(.)/gu, '$1');
  return new Map([...copy.matchAll(/\{\s*id: '((?:C)-\d{2})',\s*ar: ('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"),\s*en: ('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"),?\s*\}/gu)]
    .map((m) => [m[1], { ar: unquote(m[2]), en: unquote(m[3]) }]));
}

test('C-12 … C-53: the app shows exactly the approved rows; C-12 is the microphone purpose wherever it is declared', () => {
  const rows = approvedRows();
  const mobile = mobileRows();
  for (const id of ['C-12', ...CP2_IDS]) {
    assert.ok(mobile.has(id), `${id} is in voice-note-copy.ts`);
    assert.deepEqual([mobile.get(id).ar, mobile.get(id).en], [rows.get(id).a, rows.get(id).b], `${id} is verbatim`);
  }
  for (const id of EXPECTED_IDS.slice(0, 11)) {
    assert.deepEqual([mobile.get(id).ar, mobile.get(id).en], [rows.get(id).a, rows.get(id).b], `${id}: the client's guard copy is the consent text`);
  }
  const c12 = rows.get('C-12');
  const plugins = JSON.parse(read('apps/mobile/app.json')).expo.plugins;
  const option = (name) => plugins.find((p) => Array.isArray(p) && p[0] === name)?.[1];
  assert.equal(option('expo-audio').microphonePermission, c12.b, 'NSMicrophoneUsageDescription (English) = C-12');
  assert.equal(option('expo-image-picker').microphonePermission, c12.b, 'OD-7: the picker carries C-12 instead of false');
  assert.equal(JSON.parse(read('apps/mobile/locales/en.json')).ios.NSMicrophoneUsageDescription, c12.b);
  assert.equal(JSON.parse(read('apps/mobile/locales/ar.json')).ios.NSMicrophoneUsageDescription, c12.a);
});

test('the mobile Voice Note: expo-audio in the foreground only, the routes reached only from voice-note/, the step rule', () => {
  const pkg = JSON.parse(read('apps/mobile/package.json'));
  assert.equal(pkg.dependencies['expo-audio'], '~57.0.4');
  assert.equal(pkg.dependencies['expo-keep-awake'], '~57.0.1');
  assert.equal(pkg.main, 'expo-router/entry', 'the Product entry; the proof root is never the shipped entry');
  const audio = JSON.parse(read('apps/mobile/app.json')).expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-audio')[1];
  assert.equal(audio.enableBackgroundRecording, false);
  assert.equal(audio.enableBackgroundPlayback, false);
  for (const path of files('apps/mobile/src').filter((p) => /\.(?:ts|tsx)$/u.test(p))) {
    if (path.startsWith('apps/mobile/src/voice-note/')) continue;
    assert.doesNotMatch(codeOnly(read(path)), /['"`]\/voice\/(?:notes|consent|capability|recordings)/u, `${path} reaches no voice route; voice-note-api.ts does`);
  }
  assert.match(read('apps/mobile/src/voice-note/voice-note-api.ts'), /\/voice\/notes/u);
  // The Product Owner's screen-reader step (CP2-6): 1 s below 30 s, 5 s from 30 s, inside the recording.
  const views = read('apps/mobile/src/voice-note/VoiceNoteViews.tsx');
  assert.match(views, /export const VOICE_NOTE_SHORT_SEEK_STEP_MS = 1000;/u);
  assert.match(views, /export const VOICE_NOTE_LONG_SEEK_STEP_MS = 5000;/u);
  assert.match(views, /export const VOICE_NOTE_LONG_RECORDING_MS = 30_000;/u);
  assert.match(views, /return totalMs < VOICE_NOTE_LONG_RECORDING_MS \? VOICE_NOTE_SHORT_SEEK_STEP_MS : VOICE_NOTE_LONG_SEEK_STEP_MS;/u);
  // The native gate runs in Mobile CI; the proof build is reachable only by its guarded selector.
  assert.equal(JSON.parse(read('package.json')).scripts['prebuild:voice-note:mobile'], 'npm run prebuild:verify-voice-note --workspace @qandeel/mobile');
  assert.ok(read('.github/workflows/mobile-ci.yml').includes('npm run prebuild:voice-note:mobile'));
  assert.match(read('apps/mobile/scripts/select-s803-proof-entry.mjs'), /S803_DEVICE_PROOF/u);
  const proof = read('.github/workflows/s8b-03-ios-proof.yml');
  assert.match(proof, /branches: \['s8b\/s8b-03-cp2'\]/u, 'the iOS proof is scoped to the CP2 branch and manual dispatch');
  assert.doesNotMatch(proof, /secrets\./u, 'the iOS proof holds no credential');
});

test('the repository fixtures are device recordings of silence, pinned with the prover\'s current verdict (QAN-BL-VOICE-03)', () => {
  const dir = 'apps/api/fixtures/voice-m4a';
  assert.deepEqual(readdirSync(join(root, dir)).sort(),
    ['android-emulator-silence-11760ms.m4a', 'android-emulator-silence-2416ms.m4a', 'android-emulator-silence-4720ms.m4a']);
  const spec = read('apps/api/src/voice/m4a/m4a-device-fixtures.spec.ts');
  assert.match(spec, /WITHOUT `-allow-host-audio`/u);
  assert.match(spec, /QAN-BL-VOICE-03/u);
  assert.doesNotMatch(spec, /QAN-BL-VOICE-02/u);
});

test('the backlog carries S8B-03\'s closure: VOICE-01 worked, four admissions with their owners (BG-08)', () => {
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  const row = (id) => backlog.split('\n').find((line) => line.startsWith(`| \`${id}\` |`));
  assert.match(row('QAN-BL-VOICE-01'), /\| `Stage 8B — Voice Runtime` \| `HIGH` \| `DEFERRED — OWNED` \|$/u);
  for (const id of ['QAN-BL-VOICE-02', 'QAN-BL-VOICE-03', 'QAN-BL-VOICE-04']) {
    assert.match(row(id) ?? '', /\| `S8B-08 — Voice Cost, Privacy & Launch Evidence` \| `HIGH` \| `DEFERRED — OWNED` \|$/u, `${id} admitted`);
    assert.ok(backlog.includes(`### \`${id}\``), `${id} has its full item`);
  }
  assert.match(row('QAN-BL-MOB-01') ?? '', /\| `Stage 9 — Economy \+ Launch Closure \(release-readiness gate\)` \| `HIGH` \| `DEFERRED — OWNED` \|$/u);
  assert.ok(backlog.includes('### `QAN-BL-MOB-01`'));
});

test('0186 opens no gate, grants no client role, and is wired into CI with its verifier and live proof', () => {
  const migration = read(M0186);
  assert.match(migration, /^BEGIN;$/mu);
  assert.match(migration.trimEnd(), /COMMIT;$/u);
  assert.match(migration, /WHERE s\.feature_flag_state = 'DISABLED' AND s\.launch_requirements_state = 'UNSATISFIED'\) <> 4/u, 'G1: all four scopes DISABLED');
  assert.doesNotMatch(migration, /(?:SELECT|PERFORM)\s+(?:\*\s+FROM\s+)?voice_private\.set_voice_launch_capability_v1\(/u, '0186 never calls the gate setter');
  assert.doesNotMatch(migration, /GRANT [^;]*\bTO\s+(?:anon|authenticated|PUBLIC)\b[^;]*voice/iu, 'no client role on a voice function');
  const pkg = JSON.parse(read('package.json')).scripts;
  assert.equal(pkg['verify:personal-voice-notes:integration'], 'node --env-file-if-exists=.env database/verify-migration-0186.mjs');
  assert.equal(pkg['prove:personal-voice-notes:postgrest'], 'node --env-file-if-exists=.env database/prove-0186-voice-notes-postgrest.mjs');
  assert.equal(pkg['test:s8b-03-personal-voice-notes-contract'], 'node --test tests/s8b-03-personal-voice-notes-contract.test.mjs');
  const ci = read('.github/workflows/api-ci.yml');
  for (const step of ['verify:personal-voice-notes:integration', '--silent prove:personal-voice-notes:postgrest', 'test:s8b-03-personal-voice-notes-contract']) {
    assert.ok(ci.includes(`npm run ${step}`), `api-ci runs ${step}`);
  }
  assert.ok(ci.indexOf('npm run verify:voice-media-lifecycle:integration') < ci.indexOf('npm run verify:personal-voice-notes:integration'), 'in migration order');
});

test('the Speechmatics key is server-only and unset by default; nothing in the voice code logs or carries a secret', () => {
  assert.match(read('.env.example'), /^SPEECHMATICS_API_KEY=$/mu);
  const config = read('apps/api/src/voice/speechmatics/speechmatics-batch.config.ts');
  assert.match(config, /SPEECHMATICS_API_KEY/u);
  for (const path of files('apps/mobile').filter((p) => /\.(?:ts|tsx|js|json)$/u.test(p))) {
    assert.doesNotMatch(read(path), /SPEECHMATICS|speechmatics/u, `${path} names no voice provider (never a client key)`);
  }
  const voice = [...files('apps/api/src/voice'), ...files('apps/api/src/voice-media')].filter((p) => p.endsWith('.ts') && !p.endsWith('.spec.ts'));
  for (const path of voice) {
    const text = codeOnly(read(path));
    assert.doesNotMatch(text, /\bLogger\b|console\.|captureException|Sentry/u, `${path} logs nothing`);
  }
  for (const path of files('apps/api/src/voice/speechmatics')) {
    assert.doesNotMatch(read(path), /['"](?:sk|key)[-_][A-Za-z0-9]{16,}['"]/u, `${path} holds no literal key`);
  }
});
