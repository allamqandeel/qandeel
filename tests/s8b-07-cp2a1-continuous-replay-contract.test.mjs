// S8B-07 CP2-A.1 — continuous in-app Replay (PO execution authorization and Copy Gate decision, 2026-11-27). A static pin
// of what the mobile suites and the iOS Replay gate prove, so a later change cannot quietly widen or weaken it:
//
//   copy        RS-02 / RS-03 / RS-04 APPROVED verbatim in the code and the record; RS-01 is the S7-02 `savedPart` and RS-05
//               the existing `tryAgain`, reused verbatim and never duplicated; no new row in the S7-02 registry
//   saving      the saved line stays when the conversation moves on (only "not available" goes); a refused save says RS-04
//               with RS-05; the saved line's one action says RS-02 and opens the exact saved Replay (`openSaved`)
//   one clock   the timeline is drawn and stepped by the presentation clock's own functions, defined once; the player and
//               the audio clock take a step (`seekTo`) and the engine is placed there — no second timing authority
//   before Play (PO direction "CP2-A.1 FINAL VALIDATION AND CORRECTION", item 2) the line is drawn before the first Play
//               from the version's map read alone (GET …/map: no set, no job), which only the timeline reads; the audio,
//               the stage and both lanes keep the set's own map; a step there is where the first Play starts
//   iOS gate    the proof build reached only through a selector that needs its flag; the workflow's three BG-10 cells, its
//               pinned Maestro, and every case PASS except the one NOT TESTED by construction (native audio); each timed
//               sequence is one flow, whole-percent points, and the landing tolerances are pinned (run 46007215812);
//               the results file is one row per case, exactly the case set, a multi-line detail kept on its row, and a
//               touch Maestro delivered too late is NOT TESTED, never PASS (run 46037104976)
//   CI          wired
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createHarnessMirror, removeHarnessMirror } from './harness-temp-dir.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(join(root, file), 'utf8').replace(/\r\n/gu, '\n');
const tsCode = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const files = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const path = `${dir}/${name}`;
  return statSync(join(root, path)).isDirectory() ? files(path) : [path];
});

const SRC = 'apps/mobile/src';
const shipped = files(SRC).filter((path) => /\.tsx?$/u.test(path) && !/\/__(tests|fixtures|validation)__\//u.test(path));
const saveCopy = read(`${SRC}/replay-entry/save-copy.ts`);
const entryCopy = read(`${SRC}/replay-entry/copy.ts`);
const entryController = tsCode(read(`${SRC}/replay-entry/replay-entry-controller.ts`));
const entryView = tsCode(read(`${SRC}/replay-entry/ReplayEntry.tsx`));
const player = tsCode(read(`${SRC}/replay-player/ReplayPlayer.tsx`));
const playerController = tsCode(read(`${SRC}/replay-player/player-controller.ts`));
const audioClock = tsCode(read(`${SRC}/original-audio/replay-audio-clock.ts`));
const audioViews = tsCode(read(`${SRC}/original-audio/ReplayAudioViews.tsx`));
const presentation = tsCode(read(`${SRC}/replay-cosmos/presentation-clock.ts`));
const replayAudio = tsCode(read(`${SRC}/original-audio/replay-audio.ts`));
const mediaClient = tsCode(read(`${SRC}/original-audio/transient-media-api.ts`));
const service = tsCode(read('apps/api/src/replay-media/transient-playback.service.ts'));
const controller = tsCode(read('apps/api/src/replay-media/transient-media.controller.ts'));
const flow = (name) => read(`scripts/ios-replay-gate/flows/${name}`);
const record = read('docs/e2e/QANDEEL_S8B_07_ORIGINAL_AUDIO_REPLAY_RECORD_v1.md');
const workflow = read('.github/workflows/ios-replay-gate.yml');
const worldGate = read('.github/workflows/cosmos-ios-world-gate.yml');
const gate = read('scripts/ios-replay-gate/run-replay-gate.sh');
const selector = read('apps/mobile/scripts/select-s807cp2a1-proof-entry.mjs');
const mobileCi = read('.github/workflows/mobile-ci.yml');
const pkg = JSON.parse(read('package.json'));
const mobilePkg = JSON.parse(read('apps/mobile/package.json'));

const ROWS = [
  ['RS-02', 'openReplay', 'فتح إعادة العرض', 'Open Replay'],
  ['RS-03', 'saving', 'جارٍ حفظ إعادة العرض…', 'Saving Replay…'],
  ['RS-04', 'saveFailed', 'تعذّر حفظ إعادة العرض', "Replay couldn't be saved"],
];

test('copy: RS-02 / RS-03 / RS-04 APPROVED verbatim in the code and the record; RS-01 and RS-05 are existing rows, reused verbatim', () => {
  for (const [id, key, ar, en] of ROWS) {
    const row = new RegExp(`${key}: \\{ id: '${id}', ar: '${ar}', en: ${en.includes("'") ? `"${en}"` : `'${en}'`}, status: 'APPROVED', enStatus: 'APPROVED' \\}`, 'u');
    assert.match(saveCopy, row, `${id} verbatim and APPROVED in save-copy.ts`);
    assert.ok(record.includes(ar) && record.includes(en), `${id} verbatim in the S8B-07 record`);
  }
  assert.match(saveCopy, /REPLAY_SAVE_REUSED_ROWS = Object\.freeze\(\{ 'RS-01': 'savedPart', 'RS-05': 'tryAgain' \} as const\)/u);
  assert.match(entryCopy, /savedPart: \{ ar: 'حُفظ الجزء المختار لإعادة العرض\.', en: 'The selected part was saved for a Replay\.', status: 'APPROVED'/u);
  // Never duplicated: the RS-01 / RS-05 words appear in no new registry.
  assert.ok(!tsCode(saveCopy).includes('حُفظ الجزء المختار') && !tsCode(saveCopy).includes('إعادة المحاولة'), 'save-copy.ts keeps no copy of RS-01 or RS-05');
  assert.ok(!entryCopy.includes('فتح إعادة العرض') && !entryCopy.includes('جارٍ حفظ') && !entryCopy.includes('تعذّر حفظ'));
  assert.match(record, /CP2-A\.1 COPY GATE — CLOSED/u);
});

test('saving: the saved line stays; a refused save says RS-04 with RS-05; the one action says RS-02 and opens the saved Replay', () => {
  assert.match(entryController, /if \(grew && state\.notice === 'NOT_AVAILABLE'\) update\(\{ notice: null \}\);/u);
  assert.ok((entryController.match(/problem: 'SAVE_FAILED'/gu) ?? []).length >= 2, 'NOT_ADMITTED and every other refusal say SAVE_FAILED');
  assert.match(entryView, /selection\.problem === 'SAVE_FAILED' \? saveCopy\.saveFailed/u);
  assert.match(entryView, /saving \? saveCopy\.saving/u);
  assert.match(entryView, /saveCopy\.tryAgain/u);
  assert.match(player, /const label = replaySaveCopy\(language\)\.openReplay;/u);
  assert.match(player, /onPress=\{\(\) => player\.openSaved\(saved\)\} testID="qandeel-replay-preview"/u);
});

test('one clock: the timeline is drawn and stepped by the presentation clock alone, and a step places the engine', () => {
  for (const name of ['replayTimelinePosition', 'replayTimelineTarget']) {
    const defined = shipped.filter((path) => new RegExp(`export function ${name}\\b`, 'u').test(read(path)));
    assert.deepEqual(defined, [`${SRC}/replay-cosmos/presentation-clock.ts`], `${name} is defined once, in the presentation clock`);
  }
  assert.match(audioViews, /replayPresentationClock\(plan, clock\.moments, replayMomentPaceMs\)/u);
  assert.match(audioViews, /replayTimelinePosition\(presentation, open\.ordinal,/u);
  assert.match(audioViews, /const target = replayTimelineTarget\(presentation, ms\);\s*if \(target !== null\) controller\.seekTo\(target\.ordinal, target\.offsetMs\);/u);
  // The presentation clock is pure: it keeps no time of its own.
  assert.doesNotMatch(presentation, /Date\.now|performance\.now|setInterval|setTimeout|requestAnimationFrame/u);
  assert.match(playerController, /seekTo\(ordinal, offsetMs\) \{/u);
  assert.match(playerController, /instance\.seekTo\(ordinal, at\);/u);
  assert.match(audioClock, /seekTo\(ordinal, offsetMs\) \{/u);
  assert.match(audioClock, /engine\.seek\(located\.runIndex, positionMs\);/u);
  // The text moments' pace is the one the player times them by.
  assert.match(playerController, /export function replayMomentPaceMs\(moment: \{ readonly text: string \| null \}\): number \{\s*return readingPaceMs\(moment\.text \?\? ''\);/u);
});

test('before Play: the line is drawn from the map read alone, which no set, job or audio follows', () => {
  // The server: a read of the version's map (0196's owner-scoped read), never the set's request.
  assert.match(controller, /@Get\('replay\/:replayId\/versions\/:versionId\/map'\)/u);
  const body = service.slice(service.indexOf('async presentationMap('), service.indexOf('async presentationMap(') + 900);
  assert.match(body, /this\.repository\.map\(userId, replayId, versionId\)/u);
  assert.doesNotMatch(body, /this\.repository\.request|artifactId|readableForMs/u);
  // The client: one GET, read once per opening, never awaited, and only primes the clock.
  assert.match(mediaClient, /async presentationMap\(replayId: string, versionId: string\): Promise<TransientMapResult> \{\s*const answer = await this\.send\('GET', /u);
  assert.match(replayAudio, /void api\.presentationMap\(replayId, versionId\)\.then\(\(read\) => \{\s*if \(read\.kind === 'MAP'\) clock\.prime\(read\.map\);/u);
  // Only the timeline reads it: `preview` is declared, checked, set in `prime` and offered as `timelinePlan` — nothing else.
  assert.equal((audioClock.match(/\bpreview\b/gu) ?? []).length, 4);
  assert.match(audioClock, /timelinePlan: refused \? null : plan \?\? preview,/u);
  assert.match(audioViews, /const plan = clock\.detail\(\)\.timelinePlan;/u);
  assert.match(audioViews, /paced\.elapsedMs : null, clock\.detail\(\)\.pending\);/u);
  // A step before Play is where the first Play starts, and it is shown there while that Play prepares.
  assert.match(audioClock, /startOf\(asked, located, read\)/u);
  assert.match(audioClock, /const chosen = e\.phase === 'PREPARING' && pendingOffset !== null \? plan\.windowOf\.get\(pendingOffset\.ordinal\) : undefined;/u);
  // In the last moment, Play goes on from a held step or a pause part-way; only after the end does it start again.
  assert.match(playerController, /patch\(\{ playing: true, \.\.\.\(atLast && !inside \? \{ ordinal: order\[0\] \} : \{\}\) \}\);/u);
});

test('iOS gate: the proof build only behind its flag; three BG-10 cells; pinned Maestro; every testable case PASS', () => {
  assert.equal(mobilePkg.main, 'expo-router/entry', 'the Product entry is the manifest\'s');
  assert.match(selector, /process\.env\.S807_CP2A1_PROOF !== '1'/u);
  assert.match(selector, /const PROOF_ENTRY = 'src\/integration\/__validation__\/s807cp2a1-proof-entry\.tsx';/u);
  for (const path of shipped) assert.doesNotMatch(read(path), /S807Cp2a1ProofRoot|cp2a1-proof-monitor/u, `${path} reaches no proof file`);
  for (const cell of ['i17-en', 'i17-ar', 'small-en']) assert.match(workflow, new RegExp(`cell: ${cell},`, 'u'));
  assert.match(workflow, /device: 'iPhone SE \(3rd generation\)\|iPhone 16e'/u);
  const pin = (text, key) => text.match(new RegExp(`${key}: (\\S+)`, 'u'))?.[1];
  for (const key of ['MAESTRO_VERSION', 'MAESTRO_ZIP_SHA256', 'IOS_RUNTIME_SUFFIX']) assert.equal(pin(workflow, key), pin(worldGate, key), `${key} is the World gate's`);
  assert.match(workflow, /S807_CP2A1_PROOF: '1'/u);
  assert.match(workflow, /bash scripts\/ios-replay-gate\/run-replay-gate\.sh/u);
  assert.match(workflow, /grep -v '\^IOS-NATIVE-AUDIO' \| awk -F'\\t' '\$2 != "PASS"'/u);
  for (const id of ['J-SAVED-LINE', 'J-OPEN-ACTION', 'J-OPENS-SAVED', 'C-PLAY-THROUGH', 'C-TIMELINE', 'C-SEEK-PLAYING', 'C-SEEK-HELD', 'C-SEEK-BEFORE-PLAY']) {
    assert.match(gate, new RegExp(`result ${id} PASS`, 'u'), `${id} has a PASS`);
    assert.match(gate, new RegExp(`result ${id} (FAIL|'NOT TESTED')`, 'u'), `${id} can fail`);
  }
  assert.match(gate, /result IOS-NATIVE-AUDIO 'NOT TESTED'/u);
  assert.match(gate, /visited\)" = 1-2-3-5-6/u);
  assert.doesNotMatch(gate, /retry|--repeat/iu);
  // Run 46007215812: Maestro takes no variable in `direction:` and no decimal point, and starts slower than the part.
  assert.match(gate, /result C-TIMELINE PASS "before the first Play: /u);
  assert.match(gate, /'RE=ord=1 t=0\.0 dur=22\.5 play=0 \.\*'/u);
  assert.match(gate, /const px = Math\.round\(\(sx - rx\) \/ rw \* 100\), py = Math\.round\(/u);
  assert.match(gate, /mt c2-steps seek-playing\.yaml /u);
  assert.match(gate, /mt c3-steps seek-held\.yaml /u);
  // The landing tolerances (s, below / above the instant the tapped point really is): playing, held, before Play.
  assert.match(gate, /near "\$l1" "\$be" 0\.25 1\.0\)" = yes \] && \[ "\$\(near "\$l2" "\$fe" 0\.25 1\.0\)" = yes/u);
  assert.match(gate, /near "\$l0" "\$te" 0\.3 0\.3\)" != yes \] \|\| \[ "\$\(near "\$l1" "\$be" 0\.3 0\.3\)" != yes \] \|\| \[ "\$\(near "\$l2" "\$fe" 0\.3 0\.3\)" != yes/u);
  assert.match(gate, /near "\$l1" "\$pe" 0\.3 0\.3\)" != yes/u);
  for (const name of readdirSync(join(root, 'scripts/ios-replay-gate/flows'))) {
    assert.doesNotMatch(flow(name), /direction: \$|retryTapIfNoChange: true|repeat:/u, `${name}: no variable direction, no retry`);
  }
  assert.match(flow('seek-playing.yaml'), /text: "ord=3 \.\*play=1 \.\*"[\s\S]*point: "\$\{P1\}"[\s\S]*point: "\$\{P2\}"/u);
  // Run 46037104976: held, a step into moment 5, then back and forward, every touch taken held; the visited order kept.
  assert.match(flow('seek-held.yaml'), /text: "ord=\[2-6\] \.\*play=1 \.\*"[\s\S]*id: "qandeel-replay-play"[\s\S]*text: "\.\*play=0 \.\*"[\s\S]*point: "\$\{P0\}"[\s\S]*point: "\$\{P1\}"[\s\S]*point: "\$\{P2\}"/u);
  assert.match(gate, /m="\$\(line_point c3-line0 0\.6\)"; b="\$\(line_point c3-line 0\.5\)"; f="\$\(line_point c3-line2 0\.8\)"/u);
  assert.match(gate, /\[ "\$\(field "\$r" seeks\)" != 3 \] \|\| \[ "\$\(all_held "\$\(field "\$r" at\)" 3\)" != yes \]/u);
  assert.match(gate, /grep -Eq -- '-5-3-6\$'/u);
  assert.match(gate, /grep -Eq -- '-3-2-\(3-\)\?6\$'/u);
  // Playing: the step back taken while playing in the long turn, the step forward while playing before its target;
  // otherwise NOT TESTED (Maestro too late) or FAIL (held part-way with nothing pausing it) — never PASS.
  assert.match(gate, /else if \(a\[0\]\.t < 7\.5 \|\| a\[0\]\.t >= 12\.5 \|\| a\[1\]\.t >= Number\(fe\) \/ 1000\) v = "late";/u);
  assert.match(gate, /if \[ "\$pre" = late \]; then result C-SEEK-PLAYING 'NOT TESTED' "precondition: /u);
  assert.match(gate, /elif \[ "\$pre" = stopped \]; then result C-SEEK-PLAYING FAIL /u);
  assert.match(gate, /case "\$n" in \*-steps\) d=\(--debug-output "\$OUT\/maestro\/\$n" --flatten-debug-output\);; esac/u);
  // The results file: sourced, one row per case, and validated against the exact case set before it is judged.
  assert.match(gate, /^\. "\$HERE\/results\.sh"$/mu);
  assert.doesNotMatch(gate, /^(say|result)\(\)/mu);
  assert.match(gate, /^CASES=\(J-SAVED-LINE J-OPEN-ACTION J-OPENS-SAVED C-TIMELINE C-PLAY-THROUGH C-SEEK-PLAYING C-SEEK-HELD C-SEEK-BEFORE-PLAY IOS-NATIVE-AUDIO\)$/mu);
  assert.match(gate, /validate_results "\$\{CASES\[@\]\}" \| tee -a "\$LOG"; \[ "\$\{PIPESTATUS\[0\]\}" -eq 0 \] \|\| exit 1/u);
});

// The results file, run (run 46037104976, small-en: eight cases passed, and J-SAVED-LINE's three label lines made two
// rows with no result, so the cell was red). bash is the runner's; on Windows, Git's.
test('iOS gate results: a multi-line detail stays on its row; the file is exactly the case set', () => {
  const mirror = createHarnessMirror('qandeel-irg-results-');
  const dir = mirror;
  const posix = (path) => path.replace(/\\/gu, '/');
  // Run 46059753878, small-en: every testable case passed and validate_results still failed, as the runner's BSD awk
  // refuses a newline inside a -v assignment ("awk: newline in string"); GNU awk takes it. The proof runs behind a shim
  // that refuses it the same way, ahead of whichever awk the host has.
  mkdirSync(join(dir, 'bsd-awk'));
  writeFileSync(join(dir, 'bsd-awk', 'awk'), [
    '#!/bin/bash',
    'prev=',
    'for a in "$@"; do',
    `  if [ "$prev" = -v ] || [[ "$a" == -v?* ]]; then case "$a" in *$'\\n'*) echo "awk: newline in string $a" >&2; exit 2;; esac; fi`,
    '  prev=$a',
    'done',
    'PATH="${PATH#*:}" exec awk "$@"',
    '',
  ].join('\n'), { mode: 0o755 });
  const sh = (body) => spawnSync('bash', ['-c', `PATH="$(cd "$2" && pwd):$PATH"; . "$1"; ${body}`, 'irg', posix(join(root, 'scripts/ios-replay-gate/results.sh')), posix(join(dir, 'bsd-awk'))], {
    cwd: mirror, encoding: 'utf8', env: { ...process.env, RES: posix(join(dir, 'results.tsv')), LOG: posix(join(dir, 'gate.log')) },
  });
  const header = 'case\tresult\tdetail\n';
  try {
    // The shim is in force: a newline in a -v value is refused, a single-line one passes through.
    const shim = sh(String.raw`awk -v x="$(printf 'a\nb')" 'BEGIN { print x }'; echo "rc=$?"; awk -v x='a b' 'BEGIN { print x }'`);
    assert.match(shim.stdout, /rc=2\na b/u, `${shim.stdout}${shim.stderr}`);
    writeFileSync(join(dir, 'results.tsv'), header);
    // J-SAVED-LINE's evidence as the label query returned it: three lines (one with a carriage return), and a tab.
    const wrote = sh(String.raw`result A PASS "$(printf 'The selected part was saved for a Replay.\nThe selected part was saved for a Replay.\r\nThe selected part was saved for a Replay.')"; result B 'NOT TESTED' "$(printf 'one\ttab\nnext')"; validate_results A B`);
    assert.equal(wrote.status, 0, `${wrote.stdout}${wrote.stderr}`);
    const rows = readFileSync(join(dir, 'results.tsv'), 'utf8').split('\n').filter(Boolean);
    assert.equal(rows.length, 3, 'the header and one row per case');
    assert.deepEqual(rows.map((row) => row.split('\t').length), [3, 3, 3]);
    assert.equal(rows[1], 'A\tPASS\tThe selected part was saved for a Replay. | The selected part was saved for a Replay. | The selected part was saved for a Replay.');
    assert.equal(rows[2], 'B\tNOT TESTED\tone tab | next');
    // The defect itself, as run 46037104976 wrote it: lines of their own with no result.
    writeFileSync(join(dir, 'results.tsv'), `${header}A\tPASS\tThe selected part was saved for a Replay.\nThe selected part was saved for a Replay.\nB\tPASS\tok\n`);
    const planted = sh('validate_results A B');
    assert.notEqual(planted.status, 0);
    assert.match(planted.stdout, /line 3 has 1 fields, not 3/u);
    // A missing case, a duplicate, a case out of order, an unknown result: each refused.
    for (const [body, why] of [
      ['A\tPASS\tok\n', /1 expected case\(s\) missing/u],
      ['A\tPASS\tok\nA\tPASS\tok\nB\tPASS\tok\n', /line 3 is "A", expected "B"/u],
      ['B\tPASS\tok\nA\tPASS\tok\n', /line 2 is "B", expected "A"/u],
      ['A\tPASS\tok\nB\tSKIPPED\tok\n', /has the result "SKIPPED"/u],
    ]) {
      writeFileSync(join(dir, 'results.tsv'), `${header}${body}`);
      const refused = sh('validate_results A B');
      assert.notEqual(refused.status, 0, body);
      assert.match(refused.stdout, why);
    }
  } finally {
    removeHarnessMirror(mirror);
  }
});

test('CI: wired', () => {
  assert.equal(pkg.scripts['test:s8b-07-cp2a1-continuous-replay-contract'], 'node --test tests/s8b-07-cp2a1-continuous-replay-contract.test.mjs');
  assert.match(mobileCi, /run: npm run test:s8b-07-cp2a1-continuous-replay-contract\}/u);
  assert.match(mobileCi, /'tests\/s8b-07-cp2a1-continuous-replay-contract\.test\.mjs'/u);
});
