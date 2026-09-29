// W2-02 — classifies every frame of a native cold-launch screen recording. VALIDATION ONLY.
//
// The system launch surfaces are transient, so W2-02 adds no production delay to photograph them. Instead the
// platform's own recorder — `adb shell screenrecord` (pre-armed before `am start`) / `xcrun simctl io recordVideo` —
// captures a real cold launch of the installed Release build, and this script decodes it with ffmpeg and labels
// each frame:
//
//   splash   the World ground with a centred mark and nothing else on screen (the Android 12+ system splash)
//   world    the World ground and nothing else (the iOS Launch Screen, or the first app-owned frame)
//   content  a World-like ground with centred content that is not one compact icon (e.g. centred text)
//   product  a World-dark ground with content away from the centre (the Product root)
//   white    a near-white frame — the default flash W2-02 exists to remove
//   black    a near-black (#000) frame that is not the Dark World
//   other    anything else (the launcher / SpringBoard before the app window)
//
// W2-02 owns only the OS launch surface (R1 → R3). `judgeLaunch` returns one of three verdicts: PASS (the surface
// was observed and is correct), FAIL (a defect was OBSERVED) or CAPTURE_MISSED (the transient surface was not
// sampled and nothing observed is a defect — non-gating; a missing frame is never evidence of a defect).
//   Android: the system splash, when sampled, is judged strictly — expected World, no white / black flash before it
//            or at its exit, no second icon splash later. Nothing else after it is judged.
//   iOS:     the launch-colour gate closes once a stable expected-World launch surface is observed; the Apple
//            crossfade that follows (interpolated greys, the Dark app root) is not judged.
// The boot smokes own the app after the handoff, and the deterministic native gates stay authoritative. H.264 is
// lossy, so colours match within a tolerance and every measured value is written to the JSON report.
//
// Usage:
//   node scripts/w2/analyze-w2-02-launch-recording.mjs --video <file> --out <dir> --platform android|ios \
//     --expect-ground light|dark [--then-ground dark] [--label <name>]
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const WORLD = { light: [0xef, 0xee, 0xeb], dark: [0x10, 0x10, 0x10] };
const WORLD_TOLERANCE = 9;
const WIDTH = 90;
const FPS = 30;

function argument(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    if (fallback === undefined) throw new Error(`missing --${name}`);
    return fallback;
  }
  return process.argv[index + 1];
}

const FFMPEG = process.env.FFMPEG || 'ffmpeg';

/** The coded frame size, read from ffmpeg's own stream description (no ffprobe needed). */
function videoSize(input) {
  const result = spawnSync(FFMPEG, ['-hide_banner', ...input], { encoding: 'utf8' });
  const match = result.stderr.match(/Video: [^\n]*?, (\d{2,5})x(\d{2,5})/u);
  if (!match) throw new Error(`cannot read the frame size of ${input.at(-1)}: ${result.stderr}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

const distance = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function groundName(ground) {
  if (distance(ground, WORLD.light) <= WORLD_TOLERANCE) return 'light';
  if (distance(ground, WORLD.dark) <= WORLD_TOLERANCE) return 'dark';
  if (ground.every((channel) => channel >= 248)) return 'white';
  if (ground.every((channel) => channel <= 5)) return 'black';
  return 'other';
}

/** Measures one rgb24 frame of WIDTH × height. */
function measure(frame, width, height) {
  const top = Math.round(height * 0.08);
  const bottom = Math.round(height * 0.94);
  const pixel = (x, y) => {
    const offset = (y * width + x) * 3;
    return [frame[offset], frame[offset + 1], frame[offset + 2]];
  };
  const border = [];
  for (let y = top; y < bottom; y += 1) {
    for (const x of [0, 1, 2, width - 3, width - 2, width - 1]) border.push(pixel(x, y));
  }
  const ground = [0, 1, 2].map((channel) => median(border.map((value) => value[channel])));
  const box = Math.round(width * 0.4);
  const x0 = Math.round((width - box) / 2);
  const y0 = Math.round((height - box) / 2);
  let mark = 0;
  let outside = 0;
  let outsideOff = 0;
  let whitePixels = 0;
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (let y = top; y < bottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = pixel(x, y);
      if (value.every((channel) => channel >= 250)) whitePixels += 1;
      const inBox = x >= x0 && x < x0 + box && y >= y0 && y < y0 + box;
      if (inBox) {
        if (distance(value, ground) > 40) {
          mark += 1;
          bounds.minX = Math.min(bounds.minX, x);
          bounds.maxX = Math.max(bounds.maxX, x);
          bounds.minY = Math.min(bounds.minY, y);
          bounds.maxY = Math.max(bounds.maxY, y);
        }
      } else {
        outside += 1;
        if (distance(value, ground) > 14) outsideOff += 1;
      }
    }
  }
  const name = groundName(ground);
  const outsideUniform = outsideOff / outside <= 0.012;
  const hasMark = mark >= 6;
  // The system splash icon is ONE compact, centred mark (a disk, or the luminous Q on the Dark World): roughly as
  // tall as it is wide. Centred TEXT on a World-like ground (e.g. the unconfigured build's CONFIG_REFUSED screen)
  // is wide and short, so it is `content`, never `splash`.
  const markWidth = bounds.maxX - bounds.minX + 1;
  const markHeight = bounds.maxY - bounds.minY + 1;
  const markAspect = hasMark ? markWidth / markHeight : null;
  const markCentre = hasMark ? [(bounds.minX + bounds.maxX) / 2 - width / 2, (bounds.minY + bounds.maxY) / 2 - height / 2] : null;
  const iconLike = hasMark && markAspect >= 0.6 && markAspect <= 1.7 && Math.abs(markCentre[0]) <= box * 0.25 && Math.abs(markCentre[1]) <= box * 0.25;
  let state;
  if (name === 'white' || name === 'black' || name === 'other') state = name;
  else if (outsideUniform) state = hasMark ? (iconLike ? 'splash' : 'content') : 'world';
  else state = name === 'dark' ? 'product' : 'other';
  return { ground: `#${ground.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`, groundName: name, state, markPixels: mark, markAspect: markAspect === null ? null : Number(markAspect.toFixed(2)), outsideOffRatio: Number((outsideOff / outside).toFixed(4)), whiteRatio: Number((whitePixels / (width * (bottom - top))).toFixed(4)) };
}

/** A stable launch surface: this many consecutive frames of the expected World (200 ms at 30 fps). */
export const STABLE_LAUNCH_FRAMES = 6;

/**
 * The three R3 verdicts. A transient OS surface that CI sampling did not catch is never evidence of a defect.
 *   PASS            the launch surface was observed and it is correct
 *   FAIL            a launch defect was OBSERVED
 *   CAPTURE_MISSED  the transient surface was not sampled, and nothing observed is a defect (non-gating)
 */
export const VERDICT = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', CAPTURE_MISSED: 'CAPTURE_MISSED' });

const at = (frame) => `frame ${frame.index} (${frame.time}s)`;

/**
 * Android. The window opens at the first full-screen launch frame. If the system splash was sampled, it is judged
 * strictly: the expected World, no white / black flash before it or AT its exit, no second icon splash later.
 * Nothing else after the splash is judged (the boot smoke owns the app). If it was not sampled, only what WAS
 * observed before the first app-owned frame can fail — a white / black flash or a wrong World; otherwise the
 * verdict is CAPTURE_MISSED.
 */
function judgeAndroid(frames, expectGround, allowed) {
  const start = frames.findIndex((frame) => ['splash', 'world', 'white', 'black'].includes(frame.state));
  if (start === -1) return { verdict: VERDICT.CAPTURE_MISSED, failures: [], notes: ['no launch surface was sampled'], window: null };
  const failures = [];
  const firstSplash = frames.findIndex((frame, index) => index >= start && frame.state === 'splash');
  if (firstSplash === -1) {
    let end = start;
    while (end + 1 < frames.length && ['world', 'white', 'black'].includes(frames[end + 1].state)) end += 1;
    for (const frame of frames.slice(start, end + 1)) {
      if (frame.state === 'white' || frame.state === 'black') failures.push(`${at(frame)} is an observed ${frame.state} flash`);
      if (frame.state === 'world' && !allowed.has(frame.groundName)) failures.push(`${at(frame)} is an observed ${frame.groundName} World, expected ${[...allowed].join(' / ')}`);
    }
    return failures.length > 0
      ? { verdict: VERDICT.FAIL, failures, notes: [], window: { opens: start, closes: end } }
      : { verdict: VERDICT.CAPTURE_MISSED, failures, notes: ['the system splash was not sampled; nothing observed is a defect'], window: { opens: start, closes: end } };
  }
  let lastSplash = firstSplash;
  while (lastSplash + 1 < frames.length && frames[lastSplash + 1].state === 'splash') lastSplash += 1;
  // A white / black flash AT the splash exit (the Expo-default flash) is still the launch interval.
  let end = lastSplash;
  while (end + 1 < frames.length && (frames[end + 1].state === 'white' || frames[end + 1].state === 'black')) end += 1;
  for (const frame of frames.slice(start, end + 1)) {
    if (frame.state !== 'splash' && frame.state !== 'world') failures.push(`${at(frame)} is ${frame.state} ${frame.ground} in the launch interval`);
    else if (!allowed.has(frame.groundName)) failures.push(`${at(frame)} shows the ${frame.groundName} World, expected ${[...allowed].join(' / ')}`);
  }
  if (frames[firstSplash].groundName !== expectGround) failures.push(`the system splash is on the ${frames[firstSplash].groundName} World, expected ${expectGround}`);
  // After the splash only ONE thing is looked at: an icon splash appearing again (a duplicate, custom splash).
  const second = frames.slice(end + 1).filter((frame) => frame.state === 'splash').map((frame) => frame.index);
  if (second.length > 0) failures.push(`a second splash is observed after the system splash (frames ${second.slice(0, 5).join(', ')})`);
  return { verdict: failures.length > 0 ? VERDICT.FAIL : VERDICT.PASS, failures, notes: [], window: { opens: start, closes: end, splashFrom: firstSplash, splashExited: end + 1 < frames.length } };
}

/**
 * iOS. The launch-colour gate opens at the first full-screen launch frame and CLOSES as soon as a stable launch
 * surface of the expected World is observed. The Apple handoff / crossfade after it (interpolated greys, the Dark
 * app root) is not judged. Before it, any observed black, white, mark (Q / logo / image), text or wrong World fails.
 */
function judgeIos(frames, expectGround) {
  const start = frames.findIndex((frame) => ['splash', 'content', 'world', 'white', 'black'].includes(frame.state));
  if (start === -1) return { verdict: VERDICT.CAPTURE_MISSED, failures: [], notes: ['no launch surface was sampled'], window: null };
  let established = -1;
  for (let index = start; index + STABLE_LAUNCH_FRAMES <= frames.length; index += 1) {
    if (frames.slice(index, index + STABLE_LAUNCH_FRAMES).every((frame) => frame.state === 'world' && frame.groundName === expectGround)) {
      established = index;
      break;
    }
  }
  const before = frames.slice(start, established === -1 ? frames.length : established);
  const failures = [];
  for (const frame of before) {
    if (frame.state === 'black' || frame.state === 'white') failures.push(`${at(frame)} is an observed ${frame.state} launch surface`);
    else if (frame.state === 'splash' || frame.state === 'content') failures.push(`${at(frame)}: the Launch Screen carries a mark or text; it must be the World only`);
    else if (frame.state === 'world' && frame.groundName !== expectGround) failures.push(`${at(frame)} is the ${frame.groundName} World, expected ${expectGround}`);
  }
  const window = { opens: start, established: established === -1 ? null : established, closes: established === -1 ? null : established + STABLE_LAUNCH_FRAMES - 1 };
  if (failures.length > 0) return { verdict: VERDICT.FAIL, failures, notes: [], window };
  if (established === -1) return { verdict: VERDICT.CAPTURE_MISSED, failures, notes: [`no stable ${expectGround} World launch surface was sampled; nothing observed is a defect`], window };
  return { verdict: VERDICT.PASS, failures, notes: [], window };
}

/** The R3 verdict for one captured launch. */
export function judgeLaunch(frames, { platform, expectGround, thenGround = '' }) {
  const allowed = new Set([expectGround, ...(thenGround ? [thenGround] : [])]);
  return platform === 'android' ? judgeAndroid(frames, expectGround, allowed) : judgeIos(frames, expectGround);
}

function main() {
  const video = argument('video');
  const out = argument('out');
  const platform = argument('platform');
  const expectGround = argument('expect-ground');
  const thenGround = argument('then-ground', '');
  const label = argument('label', `${platform}-${expectGround}`);
  mkdirSync(out, { recursive: true });

  const input = ['-i', video];
  const size = videoSize(input);
  const height = Math.round((WIDTH * size.height) / size.width / 2) * 2;
  const decoded = spawnSync(FFMPEG, ['-v', 'error', ...input, '-vf', `fps=${FPS},scale=${WIDTH}:${height}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1024 * 1024 * 512 });
  if (decoded.status !== 0) throw new Error(`ffmpeg decode failed: ${decoded.stderr}`);
  const frameBytes = WIDTH * height * 3;
  const frames = [];
  for (let offset = 0; offset + frameBytes <= decoded.stdout.length; offset += frameBytes) {
    frames.push({ index: frames.length, time: Number((frames.length / FPS).toFixed(3)), ...measure(decoded.stdout.subarray(offset, offset + frameBytes), WIDTH, height) });
  }

  const result = judgeLaunch(frames, { platform, expectGround, thenGround });
  const { failures } = result;
  const start = result.window?.opens ?? -1;

  // Segments: consecutive frames with the same state + ground, with one representative PNG each.
  const segments = [];
  for (const frame of frames) {
    const key = `${frame.state}:${frame.groundName}`;
    const last = segments.at(-1);
    if (last && last.key === key) {
      last.to = frame.index;
      last.frames += 1;
    } else {
      segments.push({ key, state: frame.state, ground: frame.groundName, from: frame.index, to: frame.index, frames: 1, fromTime: frame.time });
    }
  }
  for (const segment of segments) {
    const middle = Math.floor((segment.from + segment.to) / 2) / FPS;
    const file = `${label}-${String(segment.from).padStart(4, '0')}-${segment.state}-${segment.ground}.png`;
    spawnSync(FFMPEG, ['-v', 'error', '-y', '-ss', String(middle), ...input, '-frames:v', '1', join(out, file)]);
    segment.keyframe = file;
  }
  // The contact sheet covers the launch itself: from one second before the window opens.
  const sheetFrom = Math.max(0, (start === -1 ? 0 : start) / FPS - 1);
  spawnSync(FFMPEG, ['-v', 'error', '-y', '-ss', String(sheetFrom), ...input, '-vf', 'fps=10,scale=180:-2,tile=8x3', '-frames:v', '1', join(out, `${label}-contact-sheet.png`)]);

  const report = {
    label, platform, video, expectGround, thenGround: thenGround || null, fps: FPS, analysedWidth: WIDTH, analysedHeight: height, sourceSize: size,
    frames: frames.length,
    capture: 'screen recording',
    launchWindow: result.window, stableLaunchFrames: platform === 'ios' ? STABLE_LAUNCH_FRAMES : null, notes: result.notes,
    afterHandoff: 'not judged: the app-owned runtime surface after the handoff belongs to the boot smoke, not to W2-02',
    segments, failures, verdict: result.verdict, perFrame: frames,
  };
  writeFileSync(join(out, `${label}-analysis.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${label}: ${report.verdict} — ${frames.length} frames; segments: ${segments.map((segment) => `${segment.state}/${segment.ground}×${segment.frames}`).join(' → ')}`);
  for (const failure of failures) console.log(`  FAIL ${failure}`);
  for (const note of result.notes) console.log(`  NOTE ${note}`);
  // Only an OBSERVED defect exits non-zero; CAPTURE_MISSED is reported and non-gating.
  if (result.verdict === VERDICT.FAIL) process.exitCode = 1;
}

if (process.argv[1] !== undefined && process.argv[1].replace(/\\/gu, '/').endsWith('scripts/w2/analyze-w2-02-launch-recording.mjs')) main();
