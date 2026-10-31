import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// S8B-03 CP1 — Personal Voice Notes, Server & Intelligence (migration 0186). This static contract proves, with no
// database and nothing sent off the machine:
//   - the 19 Copy Gate rows the Product Owner APPROVED verbatim on 2026-10-31 (C-01 … C-12, C-54 … C-57, M-01 … M-03)
//     are byte-identical in the implementation record, the code that uses them and the consent text 0186 installs, and
//     that text's digests are the ones 0186's deploy guard requires;
//   - 0186 opens no voice gate, and is wired into CI with its verifier and its live PostgREST proof;
//   - the Speechmatics key is server-only, the adapter is the one network path, nothing in the voice code logs, and CP1
//     adds no mobile surface (CP2 is not started).
// The behaviour itself is proven by verify-migration-0186 (C0 … V-X), prove-0186 (CI) and the API specs.

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
const EXPECTED_IDS = [
  ...Array.from({ length: 12 }, (_, i) => `C-${String(i + 1).padStart(2, '0')}`),
  'C-54', 'C-55', 'C-56', 'C-57', 'M-01', 'M-02', 'M-03',
];

test('the record carries the 19 APPROVED rows and no other row is APPROVED; CP1 is not S8B-03\'s closure', () => {
  const rows = approvedRows();
  assert.deepEqual([...rows.keys()].sort(), [...EXPECTED_IDS].sort());
  const record = read(RECORD);
  assert.match(record, /^\*\*Status:\*\* `S8B-03 CP1 — SERVER & INTELLIGENCE — DELIVERED ON s8b\/s8b-03-cp1/mu);
  assert.match(record, /S8B-03 NOT CLOSED: CP2 \(MOBILE, expo-audio, DEVICE PROOF, THE REMAINING 41 COPY ROWS\) NOT STARTED, NOT AUTHORIZED/u);
  assert.match(record, /ALL FOUR VOICE GATES DISABLED — NO PAID PROVIDER CALL/u);
  assert.doesNotMatch(record, /S8B-03 (?:IS )?CLOSED \/ (?:FROZEN|MERGED)/u, 'CP1 never declares S8B-03 closed');
  for (const id of ['PC-S1 / S1b', 'PC-S2', 'PC-S3', 'PC-S4', 'PC-S5', 'PC-S6', 'PC-S7', 'PC-D']) {
    assert.ok(record.includes(`| ${id} |`), `${id} stays an open condition in the record`);
  }
  assert.match(record, /are \*\*not\*\* proofs/u);
  assert.match(read(AMENDMENT), /^\*\*Status:\*\* `APPROVED BY THE PRODUCT OWNER \(2026-10-31/mu);
});

test('C-01 … C-11: the consent text in code equals the record, and 0186 installs exactly it under the guarded digests', () => {
  const rows = approvedRows();
  const code = read('apps/api/src/voice-media/voice-consent-text.ts');
  assert.match(code, /export const VOICE_CONSENT_VERSION = 'VOICE_RECORDING_V1';/u);
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

test('C-12 is pinned for CP2: CP1 adds no mobile voice surface and no expo-audio', () => {
  assert.ok(approvedRows().has('C-12'));
  assert.doesNotMatch(read('apps/mobile/package.json'), /expo-audio/u, 'expo-audio is CP2\'s');
  for (const path of files('apps/mobile/src')) {
    assert.doesNotMatch(read(path), /\/voice\/(?:notes|consent|capability)/u, `${path} reaches no S8B-03 route (CP2)`);
  }
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
