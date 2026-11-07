// S8B-07 CP1-B step 5 — the phone's original-audio playback: retained call listening (Sheet A) and the original audio of
// a V2 Replay (Sheet B). A static pin of what the mobile suites prove, so a later change cannot quietly widen it:
//
//   copy        the 28 Copy Gate R1.1 rows APPROVED verbatim in the record and in the code; CL-11 with no final full
//               stop; no Arabic outside the copy file; a proven cause only (CL-06 / CL-07 / RA-09 / RA-10)
//   streaming   never `downloadFirst`; no file system, storage or cache in original-audio; the position in memory only
//   the rules   status every 10 s while playing, ≤ 3 resumes a minute, the renewal lead L, the 1 s notice (§15.2, §19.2)
//   separation  original-audio imports no map, Living Analysis, projection or composite view; the Replay player names
//               no audio and takes only a neutral clock port; V1 has no clock
//   V2 mirror   the mobile V2 tuple is the API's, value for value
//   live call   every transient play claims the one playback owner, which refuses and evicts it while a live call runs
//   config      the media base URL optional, never required, never a secret
//   CI          wired
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(join(root, file), 'utf8').replace(/\r\n/gu, '\n');
const tsCode = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const files = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const path = `${dir}/${name}`;
  return statSync(join(root, path)).isDirectory() ? files(path) : [path];
});

const AUDIO = 'apps/mobile/src/original-audio';
const shipped = files(AUDIO).filter((path) => /\.tsx?$/u.test(path) && !/\/__(tests|fixtures)__\//u.test(path));
const record = read('docs/e2e/QANDEEL_S8B_07_ORIGINAL_AUDIO_REPLAY_RECORD_v1.md');
const copy = read(`${AUDIO}/original-audio-copy.ts`);
const engine = read(`${AUDIO}/transient-playback.ts`);
const owner = read(`${AUDIO}/playback-owner.ts`);
const replayAudio = read(`${AUDIO}/replay-audio.ts`);
const port = read('apps/mobile/src/voice-note/voice-note-player-port.ts');
const adapter = read('apps/mobile/src/replay-composite/projection-adapter.ts');
const api = read('apps/api/src/replay/replay.service.ts');
const config = read('apps/mobile/src/runtime-entry/config/mobile-public-config.ts');
const pkg = JSON.parse(read('package.json'));

const unescape = (text) => text.replace(/\\'/gu, "'");
const codeRows = () => new Map([...copy.matchAll(/\{ id: '((?:CL|RA)-\d\d)', status: '([A-Z]+)', ar: '((?:[^'\\]|\\.)*)', en: '((?:[^'\\]|\\.)*)' \}/gu)]
  .map((m) => [m[1], { status: m[2], ar: unescape(m[3]), en: unescape(m[4]) }]));
const recordRows = () => {
  const start = record.indexOf('**Copy Gate R1.1, as shipped');
  assert.ok(start >= 0, 'the record carries the shipped rows');
  const table = record.slice(start, record.indexOf('\n\n', record.indexOf('| CL-01 |', start)));
  return new Map([...table.matchAll(/^\| ((?:CL|RA)-\d\d) \| ([^|]+) \| ([^|]+) \| APPROVED \|$/gmu)].map((m) => [m[1], { ar: m[2].trim(), en: m[3].trim() }]));
};

test('the 28 Copy Gate R1.1 rows: APPROVED, verbatim in the record and in the code; CL-11 has no final full stop', () => {
  const code = codeRows();
  const rows = recordRows();
  const ids = [...Array.from({ length: 11 }, (_, i) => `CL-${String(i + 1).padStart(2, '0')}`), ...Array.from({ length: 17 }, (_, i) => `RA-${String(i + 1).padStart(2, '0')}`)];
  assert.deepEqual([...code.keys()], ids, 'exactly the 28 rows, in order');
  assert.deepEqual([...rows.keys()], ids, 'the record lists the same 28');
  for (const id of ids) {
    assert.equal(code.get(id).status, 'APPROVED', id);
    assert.equal(code.get(id).ar, rows.get(id).ar, `${id} ar`);
    assert.equal(code.get(id).en, rows.get(id).en, `${id} en`);
  }
  assert.equal(code.get('CL-11').ar.endsWith('.'), false);
  assert.equal(code.get('CL-11').en.endsWith('.'), false);
  assert.ok(record.includes('CL-11 without its final full stop'));
});

test('no Arabic outside the copy file; the proven cause only', () => {
  for (const path of shipped) {
    if (path.endsWith('original-audio-copy.ts')) continue;
    assert.doesNotMatch(tsCode(read(path)), /[؀-ۿ]/u, `${path}: every word is a Copy Gate row`);
  }
  const listening = read(`${AUDIO}/CallListeningViews.tsx`);
  const views = read(`${AUDIO}/ReplayAudioViews.tsx`);
  assert.ok(listening.includes("return reason === 'EXPIRED' ? 'CL-06' : reason === 'DELETED' ? 'CL-07' : 'CL-11';"));
  assert.ok(views.includes("return reason === 'EXPIRED' ? 'RA-09' : reason === 'DELETED' ? 'RA-10' : 'RA-17';"));
});

test('streaming only: never downloadFirst, no file, no storage, no cache; the position kept in memory', () => {
  assert.ok(port.includes('const player = createAudioPlayer({ uri: url, headers }, { updateInterval: 250 });'));
  assert.doesNotMatch(tsCode(port), /downloadFirst/u);
  for (const path of shipped) {
    const code = tsCode(read(path));
    assert.doesNotMatch(code, /downloadFirst|expo-file-system|FileSystem|AsyncStorage|kv-store|expo-sqlite|localStorage|MMKV|SecureStore|\bcache\b/iu, `${path}: nothing of the audio is stored`);
    assert.doesNotMatch(code, /console\.|telemetry|analytics|@sentry|crashlytics/iu, `${path}: nothing is logged or reported`);
  }
});

test('the phone\'s rules: status every 10 s, at most 3 resumes a minute, the renewal lead within its range, the 1 s notice', () => {
  for (const pin of [
    'export const TRANSIENT_RENEWAL_LEAD_MS = 5 * 60_000;',
    'export const TRANSIENT_RENEWAL_LEAD_RANGE_MS = Object.freeze({ min: 3 * 60_000, max: 10 * 60_000 });',
    'export const TRANSIENT_STATUS_EVERY_MS = 10_000;',
    'export const TRANSIENT_WAITING_NOTICE_MS = 1_000;',
    'export const TRANSIENT_RESUME = Object.freeze({ perMinute: 3, windowMs: 60_000, backoffMs: Object.freeze([0, 1_000, 2_000]) });',
  ]) assert.ok(engine.includes(pin), pin);
});

test('audio and graphics apart: original-audio draws nothing of the map, the Replay player names no audio', () => {
  for (const path of shipped) {
    const code = tsCode(read(path));
    for (const [module, why] of [['map', 'the map'], ['living-analysis', 'the Living Analysis'], ['projection', 'the projection'], ['temporal-navigation', 'the timeline']]) {
      assert.doesNotMatch(code, new RegExp(`from '\\.\\./${module}(?:/[^']*)?'`, 'u'), `${path}: no import of ${why}`);
    }
    assert.doesNotMatch(code, /from '\.\.\/replay-composite(?:\/[^']*)?'/u, `${path}: nothing of the composite (its adapter or its views)`);
  }
  assert.ok(replayAudio.includes("const REPLAY_AUDIO_SCHEMA = 'QANDEEL_REPLAY_RENDER_CONTRACT_V2';"), 'the clock source reads the schema, not the adapter');
  for (const path of files('apps/mobile/src/replay-player').filter((p) => /\.tsx?$/u.test(p) && !/\/__(tests|fixtures)__\//u.test(p))) {
    assert.doesNotMatch(tsCode(read(path)), /expo-av|expo-audio|expo-video|react-native-video|react-native-sound|\bAudio\b|\bVideo\b|\bSound\b|original-audio/u, `${path}: the player names no audio`);
  }
  const port = read('apps/mobile/src/replay-player/moment-clock.ts');
  assert.ok(port.includes('export type ReplayMomentClockSource = (version: ReplayHistoryVersion, moments: readonly ReplayHistoryMoment[]) => ReplayMomentClock | null;'));
});

test('the mobile V2 tuple is the API\'s, value for value; MIXED is never renderable', () => {
  assert.ok(adapter.includes("schema: 'QANDEEL_REPLAY_RENDER_CONTRACT_V2',") && adapter.includes("sourceMediumClass: 'ORIGINAL_MEDIA_PRESERVED',"));
  assert.ok(adapter.includes("sourceText: 'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED',") && adapter.includes("timingIntegrity: 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING',"));
  assert.ok(api.includes("...SHARED_RENDER_POLICIES, sourceText: 'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED', timingIntegrity: 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING' } },"));
  assert.ok(adapter.includes("return version !== undefined && renderContractOf(version) === 'V2' && moment.originalMedium === 'ORIGINAL_AUDIO';"));
  assert.doesNotMatch(tsCode(adapter), /'MIXED'/u, 'MIXED is not admitted by name');
});

test('the live call outranks it: one owner, transient plays refused and evicted while a call runs', () => {
  assert.ok(owner.includes('const TRANSIENT = /^(call|replay):/u;'));
  assert.ok(owner.includes("if (liveCall.isLive() && holder !== null && TRANSIENT.test(holder.key)) evict('LIVE_CALL');"));
  assert.ok(owner.includes('transientAllowed: () => !retired && liveCall?.isLive() !== true,'));
  assert.ok(engine.includes('if (!options.owner.transientAllowed() || !ensureClaim()) return false;'), 'every play claims the owner first');
  assert.ok(replayAudio.includes('subjectKey: `replay:${'), 'a Replay is a transient subject');
  assert.ok(read(`${AUDIO}/call-listening.ts`).includes('subjectKey: `call:${callId}`,'), 'a call recording is a transient subject');
});

test('the media base URL: optional, never required, never a secret', () => {
  assert.ok(config.includes("export const MOBILE_OPTIONAL_PUBLIC_CONFIG_KEYS = Object.freeze(['qandeelReplayMediaBaseUrl'] as const);"));
  assert.match(config, /export const MOBILE_PUBLIC_CONFIG_KEYS = Object\.freeze\(\[\n\s+'qandeelApiBaseUrl',\n\s+'supabaseUrl',\n\s+'supabasePublishableKey',\n\] as const\);/u);
  assert.ok(read('apps/mobile/app.config.js').includes('qandeelReplayMediaBaseUrl: process.env.QANDEEL_REPLAY_MEDIA_BASE_URL ?? null,'));
});

test('wired once into CI', () => {
  assert.equal(pkg.scripts['test:s8b-07-cp1b-mobile-playback-contract'], 'node --test tests/s8b-07-cp1b-mobile-playback-contract.test.mjs');
  const mobile = read('.github/workflows/mobile-ci.yml');
  assert.equal((mobile.match(/run: npm run test:s8b-07-cp1b-mobile-playback-contract\}/gu) ?? []).length, 1);
  assert.ok(mobile.includes("'tests/s8b-07-cp1b-mobile-playback-contract.test.mjs'"), 'a change to this contract runs Mobile CI');
});
