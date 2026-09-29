// W2-02 — classifies every frame of a native cold-launch screen recording. VALIDATION ONLY.
//
// The system launch surfaces are transient, so W2-02 adds no production delay to photograph them. Instead the
// platform's own recorder (`adb shell screenrecord` / `xcrun simctl io recordVideo`) captures a real cold launch
// of the installed Release build, and this script decodes the recording with ffmpeg and labels each frame:
//
//   splash   the World ground with a centred mark and nothing else on screen (the Android 12+ system splash)
//   world    the World ground and nothing else (the iOS Launch Screen, or the first app-owned frame)
//   product  a World-dark ground with content away from the centre (the Product root)
//   white    a near-white frame — the default flash W2-02 exists to remove
//   black    a near-black (#000) frame that is not the Dark World
//   other    anything else (the launcher / SpringBoard before the app window)
//
// The strict window opens at the first World frame. From there to the end only `splash`, `world` and `product`
// are allowed; any `white`, `black` or `other` frame fails. H.264 is lossy, so colours match within a tolerance
// and every measured value is written to the JSON report for review.
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
function videoSize(video) {
  const result = spawnSync(FFMPEG, ['-hide_banner', '-i', video], { encoding: 'utf8' });
  const match = result.stderr.match(/Video: [^\n]*?, (\d{2,5})x(\d{2,5})/u);
  if (!match) throw new Error(`cannot read the frame size of ${video}: ${result.stderr}`);
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
  for (let y = top; y < bottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = pixel(x, y);
      if (value.every((channel) => channel >= 250)) whitePixels += 1;
      const inBox = x >= x0 && x < x0 + box && y >= y0 && y < y0 + box;
      if (inBox) {
        if (distance(value, ground) > 40) mark += 1;
      } else {
        outside += 1;
        if (distance(value, ground) > 14) outsideOff += 1;
      }
    }
  }
  const name = groundName(ground);
  const outsideUniform = outsideOff / outside <= 0.012;
  const hasMark = mark >= 6;
  let state;
  if (name === 'white' || name === 'black' || name === 'other') state = name;
  else if (outsideUniform) state = hasMark ? 'splash' : 'world';
  else state = name === 'dark' ? 'product' : 'other';
  return { ground: `#${ground.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`, groundName: name, state, markPixels: mark, outsideOffRatio: Number((outsideOff / outside).toFixed(4)), whiteRatio: Number((whitePixels / (width * (bottom - top))).toFixed(4)) };
}

function main() {
  const video = argument('video');
  const out = argument('out');
  const platform = argument('platform');
  const expectGround = argument('expect-ground');
  const thenGround = argument('then-ground', '');
  const label = argument('label', `${platform}-${expectGround}`);
  mkdirSync(out, { recursive: true });

  const size = videoSize(video);
  const height = Math.round((WIDTH * size.height) / size.width / 2) * 2;
  const decoded = spawnSync(FFMPEG, ['-v', 'error', '-i', video, '-vf', `fps=${FPS},scale=${WIDTH}:${height}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1024 * 1024 * 512 });
  if (decoded.status !== 0) throw new Error(`ffmpeg decode failed: ${decoded.stderr}`);
  const frameBytes = WIDTH * height * 3;
  const frames = [];
  for (let offset = 0; offset + frameBytes <= decoded.stdout.length; offset += frameBytes) {
    frames.push({ index: frames.length, time: Number((frames.length / FPS).toFixed(3)), ...measure(decoded.stdout.subarray(offset, offset + frameBytes), WIDTH, height) });
  }

  const failures = [];
  const start = frames.findIndex((frame) => frame.state === 'splash' || frame.state === 'world');
  if (start === -1) failures.push('no World launch frame was recorded');
  const strict = start === -1 ? [] : frames.slice(start);
  for (const frame of strict) {
    if (!['splash', 'world', 'product'].includes(frame.state)) failures.push(`frame ${frame.index} (${frame.time}s) is ${frame.state} ${frame.ground} after the launch began`);
  }
  const launchFrames = strict.filter((frame) => frame.state !== 'product');
  const firstGround = launchFrames[0]?.groundName;
  if (firstGround && firstGround !== expectGround) failures.push(`the launch ground is ${firstGround}, expected ${expectGround}`);
  const grounds = [...new Set(launchFrames.map((frame) => frame.groundName))];
  const allowedGrounds = new Set([expectGround, ...(thenGround ? [thenGround] : [])]);
  for (const ground of grounds) if (!allowedGrounds.has(ground)) failures.push(`an unexpected ${ground} World frame appears during the launch`);
  const firstProduct = strict.findIndex((frame) => frame.state === 'product');
  const beforeProduct = firstProduct === -1 ? strict : strict.slice(0, firstProduct);
  if (platform === 'android') {
    if (!beforeProduct.some((frame) => frame.state === 'splash' && frame.groundName === expectGround)) failures.push(`no Android system splash (icon on the ${expectGround} World) was recorded before the Product`);
  } else {
    const marked = beforeProduct.filter((frame) => frame.state === 'splash');
    if (marked.length > 0) failures.push(`the iOS Launch Screen carries a mark in ${marked.length} frame(s) — it must be the World only`);
  }
  if (firstProduct === -1) failures.push('the Product root never appeared');

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
    spawnSync(FFMPEG, ['-v', 'error', '-y', '-ss', String(middle), '-i', video, '-frames:v', '1', join(out, file)]);
    segment.keyframe = file;
  }
  spawnSync(FFMPEG, ['-v', 'error', '-y', '-i', video, '-vf', `fps=6,scale=180:-2,tile=8x4`, '-frames:v', '1', join(out, `${label}-contact-sheet.png`)]);

  const report = { label, platform, video, expectGround, thenGround: thenGround || null, fps: FPS, analysedWidth: WIDTH, analysedHeight: height, sourceSize: size, frames: frames.length, strictFrom: start, firstProduct: firstProduct === -1 ? null : start + firstProduct, segments, failures, verdict: failures.length === 0 ? 'PASS' : 'FAIL', perFrame: frames };
  writeFileSync(join(out, `${label}-analysis.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${label}: ${report.verdict} — ${frames.length} frames; segments: ${segments.map((segment) => `${segment.state}/${segment.ground}×${segment.frames}`).join(' → ')}`);
  for (const failure of failures) console.log(`  FAIL ${failure}`);
  if (failures.length > 0) process.exitCode = 1;
}

main();
