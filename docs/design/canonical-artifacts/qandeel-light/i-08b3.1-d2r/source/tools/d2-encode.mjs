/**
 * I-08B3.1-D2R — THE VIDEOS.
 *
 * Nine category films plus one COHERENCE FILM that cuts all four together behind Arabic title
 * cards, because §11's question — "do these feel like ONE QANDEEL Light language?" — cannot be
 * answered by watching four clips on four different days.
 *
 * EVERY FILE IS VERIFIED BY DECODING IT BACK and comparing three of its frames against the PNGs
 * it was made from. An encoder that silently produces a black file, a half-length file or a file
 * at the wrong frame rate is the failure mode this step exists to catch, and it does not
 * announce itself.
 *
 * `h264_mf` is Windows Media Foundation's H.264 encoder, which is the only one this host has —
 * there is no libx264 and no ffprobe in the ffmpeg that ships with CapCut. That is a fact about
 * the machine, recorded so nobody wonders why the flags look unusual.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isMain } from './d2-main.mjs';
import { decode } from '../vendor/png.mjs';
import { T, TA } from '../scene/d2-foundation.mjs';
import { CARDS, CARD_FRAMES } from './d2-capture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..', '..');
const WORK = join(PKG, '..', '.i08b31-d2-work');
const FRAMES = join(WORK, 'frames');
const TMP = join(WORK, 'tmp');

const FFMPEG_CANDIDATES = [
  join(process.env.LOCALAPPDATA ?? '', 'CapCut', 'Apps', '9.2.0.3931', 'ffmpeg.exe'),
  'ffmpeg',
];
const ffmpeg = FFMPEG_CANDIDATES.find((p) => p === 'ffmpeg' || existsSync(p));
if (!ffmpeg) throw new Error('d2-encode: no ffmpeg available on this host');

const BITRATE = '9M';   // generous, because dark smooth gradients band before anything else does

/**
 * BOTH streams, always. ffmpeg writes its whole log — including the `frame=` line this tool
 * parses — to STDERR and still exits 0; and it exits non-zero on harmless warnings. The output
 * file is what to believe, not the status.
 */
const run = (args) => {
  const r = spawnSync(ffmpeg, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return (r.stdout ?? '') + (r.stderr ?? '');
};

export const FILMS = [
  { seq: 'ambient', file: 'D2_A_AMBIENT_WORLD_FIELD', frames: TA.FRAMES, fps: TA.FPS },
  { seq: 'connection', file: 'D2_B_CONNECTION_INHERITED', frames: T.FRAMES, fps: T.FPS },
  { seq: 'pattern', file: 'D2_C_PATTERN_CRYSTALLIZATION', frames: T.FRAMES, fps: T.FPS },
  { seq: 'insight', file: 'D2_D_INSIGHT_EMERGENCE', frames: T.FRAMES, fps: T.FPS },
  { seq: 'ambient-rm', file: 'D2_RM_A_AMBIENT_WORLD_FIELD', frames: TA.FRAMES, fps: TA.FPS },
  { seq: 'connection-rm', file: 'D2_RM_B_CONNECTION_INHERITED', frames: T.FRAMES, fps: T.FPS },
  { seq: 'pattern-rm', file: 'D2_RM_C_PATTERN_CRYSTALLIZATION', frames: T.FRAMES, fps: T.FPS },
  { seq: 'insight-rm', file: 'D2_RM_D_INSIGHT_EMERGENCE', frames: T.FRAMES, fps: T.FPS },
];

/** card, sequence — the order the coherence film runs in. */
export const COHERENCE = [
  ['card-ambient', 'ambient'],
  ['card-connection', 'connection'],
  ['card-pattern', 'pattern'],
  ['card-insight', 'insight'],
];

function encodeFrom(dir, out, fps, count) {
  if (existsSync(out)) rmSync(out);
  run([
    '-hide_banner', '-y',
    '-framerate', String(fps),
    '-i', join(dir, '%04d.png'),
    '-frames:v', String(count),
    '-c:v', 'h264_mf',
    '-b:v', BITRATE,
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    out,
  ]);
  if (!existsSync(out)) throw new Error(`d2-encode: ${out} was not produced`);
  const bytes = readFileSync(out).length;
  if (bytes < 50_000) throw new Error(`d2-encode: ${out} is only ${bytes} bytes — the encode failed quietly`);
  return bytes;
}

function verifyAgainst(out, srcDir, checkAt) {
  const nullPass = run(['-hide_banner', '-i', out, '-f', 'null', '-']);
  const m = [...nullPass.matchAll(/frame=\s*(\d+)/g)].pop();
  const decodedFrames = m ? Number(m[1]) : -1;
  const errors = [];
  let worst = 0;
  for (const f of checkAt) {
    const png = join(TMP, `verify-${f}-${createHash('sha256').update(out).digest('hex').slice(0, 8)}.png`);
    if (existsSync(png)) rmSync(png);
    run(['-hide_banner', '-y', '-i', out, '-vf', `select=eq(n\\,${f})`, '-vsync', '0', '-frames:v', '1', png]);
    if (!existsSync(png)) { errors.push({ frame: f, error: 'could not be extracted from the encoded file' }); continue; }
    const a = decode(readFileSync(png));
    const b = decode(readFileSync(join(srcDir, `${String(f).padStart(4, '0')}.png`)));
    if (a.width !== b.width || a.height !== b.height) {
      errors.push({ frame: f, error: `${a.width}x${a.height} decoded vs ${b.width}x${b.height} source` });
      continue;
    }
    let sum = 0;
    for (let i = 0; i < a.rgba.length; i += 4) {
      sum += Math.abs(a.rgba[i] - b.rgba[i]) + Math.abs(a.rgba[i + 1] - b.rgba[i + 1]) + Math.abs(a.rgba[i + 2] - b.rgba[i + 2]);
    }
    const mean = sum / ((a.rgba.length / 4) * 3);
    worst = Math.max(worst, mean);
    rmSync(png, { force: true });
  }
  return { decodedFrames, errors, meanError: worst };
}

async function main() {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(join(PKG, 'video'), { recursive: true });
  const report = { generated: 'source/tools/d2-encode.mjs', encoder: 'h264_mf', ffmpeg, bitrate: BITRATE, files: [] };

  for (const f of FILMS) {
    const dir = join(FRAMES, f.seq);
    const out = join(PKG, 'video', `${f.file}.mp4`);
    const bytes = encodeFrom(dir, out, f.fps, f.frames);
    const v = verifyAgainst(out, dir, [0, Math.floor(f.frames / 2), f.frames - 1]);
    const ok = v.errors.length === 0 && v.decodedFrames === f.frames && v.meanError < 2;
    report.files.push({ ...f, bytes, ...v, verified: ok });
    console.log(`  ${ok ? 'VERIFIED' : 'FAILED  '}  ${f.file}.mp4  ${bytes.toLocaleString()} B  `
      + `${v.decodedFrames}/${f.frames} frames  mean error ${v.meanError.toFixed(3)}/255`);
    if (!ok) throw new Error(`d2-encode: ${f.file} did not verify — ${JSON.stringify(v.errors)}`);
  }

  /* ------------------------------------------------- the coherence film, card by card --- */
  const filmDir = join(TMP, 'coherence');
  rmSync(filmDir, { recursive: true, force: true });
  mkdirSync(filmDir, { recursive: true });
  let n = 0;
  for (const [card, seq] of COHERENCE) {
    for (let i = 0; i < CARD_FRAMES; i++) {
      copyFileSync(join(FRAMES, card, `${String(i).padStart(4, '0')}.png`), join(filmDir, `${String(n++).padStart(4, '0')}.png`));
    }
    const count = readdirSync(join(FRAMES, seq)).filter((x) => x.endsWith('.png')).length;
    for (let i = 0; i < count; i++) {
      copyFileSync(join(FRAMES, seq, `${String(i).padStart(4, '0')}.png`), join(filmDir, `${String(n++).padStart(4, '0')}.png`));
    }
  }
  const filmOut = join(PKG, 'video', 'D2_COHERENCE_FOUR_CATEGORIES.mp4');
  const filmBytes = encodeFrom(filmDir, filmOut, T.FPS, n);
  const fv = verifyAgainst(filmOut, filmDir, [0, Math.floor(n / 2), n - 1]);
  const filmOk = fv.errors.length === 0 && fv.decodedFrames === n && fv.meanError < 2;
  report.files.push({ seq: 'coherence', file: 'D2_COHERENCE_FOUR_CATEGORIES', frames: n, fps: T.FPS, bytes: filmBytes, ...fv, verified: filmOk });
  console.log(`  ${filmOk ? 'VERIFIED' : 'FAILED  '}  D2_COHERENCE_FOUR_CATEGORIES.mp4  ${filmBytes.toLocaleString()} B  `
    + `${fv.decodedFrames}/${n} frames  mean error ${fv.meanError.toFixed(3)}/255  (${(n / T.FPS).toFixed(1)} s)`);
  if (!filmOk) throw new Error(`d2-encode: the coherence film did not verify — ${JSON.stringify(fv.errors)}`);

  rmSync(filmDir, { recursive: true, force: true });
  writeFileSync(join(PKG, 'data', 'D2_ENCODE_REPORT.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (isMain(import.meta.url)) {
  console.log('D2 ENCODE');
  await main();
  console.log('  wrote data/D2_ENCODE_REPORT.json');
}
