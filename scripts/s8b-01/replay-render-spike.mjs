// S8B-01 CP2 — the Replay render spike (voice-runtime-v1.md §9.2: "the codec / container is decided by the S8B-01 CP2
// render spike"). A local technical proof only, not the Replay runtime: no database, no provider, no network, no user data.
//
// It builds a synthetic two-track call on one clock (§6.1): a USER track (synthesized speech in the voice Sulafat, a
// stand-in for a user; never a human voice) and a QANDEEL track (the selected voice Achird) holding only the ranges
// "confirmed played", one reply cut mid-chunk by a barge-in (§4.3 / §4.4), and a reconnection gap left as a gap (§6.2).
// The two tracks are encoded as mono Opus, the source format (§9.2). The render mixes them on the shared clock and draws
// a simple visual sequence from the unit anchors (a placeholder for the bound analytical projection, not the Living
// Analysis grammar), with the unit text as a derived caption (CW2-05 §40), into H.264 + AAC in MP4.
// It then proves: the codec and container profile a phone plays; audio / picture sync at the start and the end of the
// video (a calibration beep and a white frame at the same instants); the sources unchanged by rendering (§7: rendering
// extends or touches nothing); and the processing files deleted on completion (§9.1).
//
//   node scripts/s8b-01/replay-render-spike.mjs <cloudRunDir> <outDir>
// needs ffmpeg / ffprobe on PATH or in QANDEEL_FFMPEG_DIR. Outputs (gitignored): source/{user,qandeel}.opus, replay.mp4,
// report.json.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RATE = 24000;
export const FPS = 30;
export const SIZE = { w: 720, h: 1280 };
const BEEP_MS = 200;
const BEEP_HZ = 1000;

/** The synthetic call: CP2 Cloud samples (Flash), USER in Sulafat, QANDEEL in Achird. */
export const SCRIPT = [
  { track: 'USER', sample: 'C0013', gapBeforeMs: 300 },
  { track: 'QANDEEL', sample: 'C0177', gapBeforeMs: 450 },
  { track: 'USER', sample: 'C0069', gapBeforeMs: 500 },
  { gap: 'RECONNECTION', ms: 1500, gapBeforeMs: 200 },
  { track: 'QANDEEL', sample: 'C0345', gapBeforeMs: 400, cutAt: 0.55 },
  // The barge-in: the user starts 300 ms before the playout stops (on-device VAD detection, §4.4).
  { track: 'USER', sample: 'C0125', overlapMs: 300 },
  { track: 'QANDEEL', sample: 'C0201', gapBeforeMs: 450 },
];

/** PCM16 mono samples of a WAV file (any header layout). */
export function readWav(buf) {
  let p = 12;
  let fmt = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { channels: buf.readUInt16LE(p + 10), rate: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    if (id === 'data') {
      if (!fmt || fmt.channels !== 1 || fmt.bits !== 16) throw new Error('S8B_01_REPLAY: mono 16-bit PCM expected');
      const n = Math.floor(size / 2);
      const out = new Int16Array(n);
      for (let i = 0; i < n; i += 1) out[i] = buf.readInt16LE(p + 8 + i * 2);
      return { rate: fmt.rate, pcm: out };
    }
    p += 8 + size + (size % 2);
  }
  throw new Error('S8B_01_REPLAY: no data chunk');
}

/**
 * The timeline on the call clock: a calibration lead, the units with their [startMs, endMs) anchors, the gap, the tail.
 * `durations` maps a sample to its audio length in ms. A cut unit's anchor ends at the cut (the confirmed playout
 * position); its unplayed remainder is never placed on the track.
 */
export function buildTimeline(script, durations, { leadMs = 1000, tailMs = 1500 } = {}) {
  const units = [];
  let t = leadMs;
  for (const s of script) {
    if (s.gap) { t += s.gapBeforeMs ?? 0; units.push({ kind: 'GAP', gap: s.gap, startMs: t, endMs: t + s.ms }); t += s.ms; continue; }
    const full = durations[s.sample];
    if (!(full > 0)) throw new Error(`S8B_01_REPLAY: no audio for ${s.sample}`);
    const start = s.overlapMs ? t - s.overlapMs : t + (s.gapBeforeMs ?? 0);
    const played = s.cutAt ? Math.round(full * s.cutAt) : full;
    units.push({ kind: 'SPEECH', track: s.track, sample: s.sample, startMs: start, endMs: start + played, interrupted: Boolean(s.cutAt) });
    t = start + played;
  }
  const beeps = [leadMs / 2, t + tailMs / 2].map((ms) => Math.round(ms));
  return { units, beeps, durationMs: t + tailMs };
}

/** One track's PCM on the shared clock: its units' audio at their anchors, silence elsewhere, the calibration beeps on both. */
export function trackPcm(timeline, track, audio, rate = RATE) {
  const out = new Int16Array(Math.ceil((timeline.durationMs / 1000) * rate));
  for (const u of timeline.units.filter((x) => x.kind === 'SPEECH' && x.track === track)) {
    const src = audio[u.sample];
    const at = Math.round((u.startMs / 1000) * rate);
    const n = Math.min(src.length, Math.round(((u.endMs - u.startMs) / 1000) * rate));
    for (let i = 0; i < n && at + i < out.length; i += 1) out[at + i] = src[i];
  }
  for (const b of timeline.beeps) {
    const at = Math.round((b / 1000) * rate);
    for (let i = 0; i < (BEEP_MS / 1000) * rate; i += 1) out[at + i] = Math.round(8000 * Math.sin((2 * Math.PI * BEEP_HZ * i) / rate));
  }
  return out;
}

export function wav(pcm, rate = RATE) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length * 2, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length * 2, 40);
  return Buffer.concat([h, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)]);
}

const sec = (ms) => (ms / 1000).toFixed(3);

/** A caption broken into lines of at most `max` characters, at word boundaries (drawtext does not wrap). */
export function wrapCaption(text, max = 26) {
  const lines = [];
  for (const word of text.split(/\s+/u)) {
    if (lines.length && `${lines.at(-1)} ${word}`.length <= max) lines[lines.length - 1] += ` ${word}`;
    else lines.push(word);
  }
  return lines.join('\n');
}

/**
 * The video filter graph: a dark background, a time bar, one disc per side lit while that side's unit is live (USER
 * right, QANDEEL left, in RTL reading), a grey band over a gap, an «interrupted» mark on a cut unit, the derived caption
 * of the live unit (from text files, shaped by ffmpeg), and a white full frame at each calibration beep.
 */
export function videoFilter(timeline, captions, font) {
  const { w, h } = SIZE;
  const f = [`color=c=0x171512:s=${w}x${h}:r=${FPS}:d=${sec(timeline.durationMs)}[bg]`];
  const parts = [];
  parts.push(`drawbox=x=40:y=${h - 120}:w=${w - 80}:h=8:color=0x3b362f:t=fill`);
  parts.push(`drawbox=x=40:y=${h - 120}:w='(${w - 80})*t/${sec(timeline.durationMs)}':h=8:color=0xd9b45a:t=fill`);
  for (const [i, u] of timeline.units.entries()) {
    const on = `enable='between(t,${sec(u.startMs)},${sec(u.endMs)})'`;
    if (u.kind === 'GAP') { parts.push(`drawbox=x=0:y=${h / 2 - 160}:w=${w}:h=320:color=0x55504a@0.6:t=fill:${on}`); continue; }
    const x = u.track === 'USER' ? w - 260 : 60;
    const color = u.track === 'USER' ? '0x6fa8dc' : '0xd9b45a';
    parts.push(`drawbox=x=${x}:y=${h / 2 - 100}:w=200:h=200:color=${color}:t=fill:${on}`);
    if (u.interrupted) parts.push(`drawbox=x=${x}:y=${h / 2 + 120}:w=200:h=12:color=0xe06666:t=fill:${on}`);
    if (captions[i]) parts.push(`drawtext=fontfile='${font}':textfile='${captions[i]}':fontsize=34:fontcolor=0xeee8dd:x=(w-text_w)/2:y=${h / 2 + 200}:text_shaping=1:${on}`);
  }
  for (const b of timeline.beeps) parts.push(`drawbox=x=0:y=0:w=${w}:h=${h}:color=white:t=fill:enable='between(t,${sec(b)},${sec(b + BEEP_MS)})'`);
  f.push(`[bg]${parts.join(',')}[v]`);
  return f.join(';');
}

/** Onsets of the calibration beep in decoded mono PCM (10 ms windows; the first window over the threshold after silence). */
export function findBeeps(pcm, rate, { threshold = 3000, minGapMs = 1000 } = {}) {
  const win = Math.round(rate / 100);
  const out = [];
  for (let i = 0; i + win <= pcm.length; i += win) {
    let s = 0;
    for (let k = 0; k < win; k += 1) s += pcm[i + k] * pcm[i + k];
    if (Math.sqrt(s / win) < threshold) continue;
    // Refine to the first sample over half the threshold inside the window.
    let j = i;
    while (j < i + win && Math.abs(pcm[j]) < threshold / 2) j += 1;
    const ms = (j / rate) * 1000;
    if (!out.length || ms - out.at(-1) > minGapMs) out.push(ms);
  }
  return out;
}

/** The instants (ms) of white frames, from one mean-luma byte per frame. */
export function findFlashes(lumas, fps, { threshold = 230 } = {}) {
  const out = [];
  for (let i = 0; i < lumas.length; i += 1) if (lumas[i] >= threshold && !(i > 0 && lumas[i - 1] >= threshold)) out.push((i / fps) * 1000);
  return out;
}

/** True when the MP4's moov atom precedes mdat (progressive playback, "faststart"). */
export function moovBeforeMdat(buf) {
  let p = 0;
  const seen = [];
  while (p + 8 <= buf.length) {
    const size = buf.readUInt32BE(p);
    seen.push(buf.toString('ascii', p + 4, p + 8));
    if (size < 8) break;
    p += size;
  }
  return seen.indexOf('moov') >= 0 && seen.indexOf('moov') < seen.indexOf('mdat');
}

/** ffmpeg -benchmark's lines: utime / stime / rtime in seconds, maxrss in KiB. */
export function parseBenchmark(stderr) {
  const m = /bench: utime=([\d.]+)s stime=([\d.]+)s rtime=([\d.]+)s/u.exec(stderr);
  const r = /bench: maxrss=(\d+)KiB/u.exec(stderr);
  return m ? { utimeS: Number(m[1]), stimeS: Number(m[2]), rtimeS: Number(m[3]), maxRssKiB: r ? Number(r[1]) : null } : null;
}

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

function tool(name) {
  const dir = process.env.QANDEEL_FFMPEG_DIR;
  const exe = dir ? join(dir, `${name}${process.platform === 'win32' ? '.exe' : ''}`) : name;
  const probe = spawnSync(exe, ['-version'], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(`S8B_01_REPLAY: ${name} not found (PATH or QANDEEL_FFMPEG_DIR)`);
  return { exe, version: probe.stdout.split('\n')[0] };
}

function run(exe, args, opts = {}) {
  const r = spawnSync(exe, args, { encoding: opts.binary ? 'buffer' : 'utf8', maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`S8B_01_REPLAY: ${exe} failed: ${String(r.stderr).slice(-1500)}`);
  return r;
}

export async function renderSpike(cloudRunDir, outDir) {
  const ffmpeg = tool('ffmpeg');
  const ffprobe = tool('ffprobe');
  if (existsSync(join(outDir, 'replay.mp4'))) throw new Error('S8B_01_REPLAY: the output directory already holds a render');
  const work = join(outDir, 'processing');
  mkdirSync(join(outDir, 'source'), { recursive: true });
  mkdirSync(work, { recursive: true });

  // Texts of the samples (the derived captions), from the reviewed Cloud work list.
  const here = fileURLToPath(new URL('.', import.meta.url));
  const { cloudCalls } = await import('./cp2-cloud.mjs');
  const calls = cloudCalls(JSON.parse(readFileSync(join(here, 'cp2-cloud-plan.json'), 'utf8')), here);
  const textOf = (sample) => calls[Number(sample.slice(1)) - 1].text;

  const audio = {};
  const durations = {};
  for (const s of SCRIPT.filter((x) => x.sample)) {
    const { rate, pcm } = readWav(readFileSync(join(cloudRunDir, 'audio', `${s.sample}.wav`)));
    if (rate !== RATE) throw new Error(`S8B_01_REPLAY: ${s.sample} is ${rate} Hz`);
    audio[s.sample] = pcm;
    durations[s.sample] = Math.round((pcm.length / rate) * 1000);
  }
  const timeline = buildTimeline(SCRIPT, durations);

  // The source: two mono Opus tracks on one clock (§6.1).
  const sources = {};
  for (const track of ['USER', 'QANDEEL']) {
    const w = join(work, `${track.toLowerCase()}.wav`);
    writeFileSync(w, wav(trackPcm(timeline, track, audio)));
    const o = join(outDir, 'source', `${track.toLowerCase()}.opus`);
    run(ffmpeg.exe, ['-hide_banner', '-loglevel', 'error', '-i', w, '-c:a', 'libopus', '-b:a', '24k', '-application', 'voip', o]);
    sources[track] = o;
  }
  const before = Object.fromEntries(Object.entries(sources).map(([k, p]) => [k, sha(p)]));

  const captions = timeline.units.map((u, i) => {
    if (u.kind !== 'SPEECH') return null;
    const p = join(work, `caption-${i}.txt`);
    writeFileSync(p, wrapCaption(textOf(u.sample)));
    return p.replace(/\\/gu, '/').replace(/:/gu, '\\:');
  });
  const font = (process.env.QANDEEL_REPLAY_FONT ?? 'C:/Windows/Fonts/arial.ttf').replace(/:/gu, '\\:');
  const graph = `${videoFilter(timeline, captions, font)};[0:a][1:a]amix=inputs=2:normalize=0[a]`;
  writeFileSync(join(work, 'graph.txt'), graph);

  // The render: the sources mixed on their shared clock, H.264 Main + AAC-LC in MP4, faststart.
  const mp4 = join(outDir, 'replay.mp4');
  const started = Date.now();
  const r = run(ffmpeg.exe, ['-hide_banner', '-benchmark', '-i', sources.USER, '-i', sources.QANDEEL, '-filter_complex_script', join(work, 'graph.txt'),
    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-profile:v', 'main', '-level', '4.0', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '23',
    '-r', String(FPS), '-g', String(FPS * 2), '-c:a', 'aac', '-b:a', '96k', '-ar', '48000', '-ac', '1', '-movflags', '+faststart', '-t', sec(timeline.durationMs), mp4]);
  const renderMs = Date.now() - started;

  // Checks.
  const probe = JSON.parse(run(ffprobe.exe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', mp4]).stdout);
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const a = probe.streams.find((s) => s.codec_type === 'audio');
  const pcmBuf = run(ffmpeg.exe, ['-v', 'error', '-i', mp4, '-map', '0:a', '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-'], { binary: true }).stdout;
  const decoded = new Int16Array(pcmBuf.buffer, pcmBuf.byteOffset, Math.floor(pcmBuf.byteLength / 2));
  const lumas = run(ffmpeg.exe, ['-v', 'error', '-i', mp4, '-map', '0:v', '-vf', 'scale=1:1,format=gray', '-f', 'rawvideo', '-'], { binary: true }).stdout;
  const beeps = findBeeps(decoded, RATE);
  const flashes = findFlashes(lumas, FPS);
  const offsets = timeline.beeps.map((expected, i) => ({ expectedMs: expected, audioMs: Math.round(beeps[i] ?? NaN), videoMs: Math.round(flashes[i] ?? NaN),
    avOffsetMs: Math.round((beeps[i] ?? NaN) - (flashes[i] ?? NaN)) }));
  const after = Object.fromEntries(Object.entries(sources).map(([k, p]) => [k, sha(p)]));

  // Processing files are deleted on completion (§9.1); the sources stay (they stand for the retained recording).
  rmSync(work, { recursive: true, force: true });

  const frameMs = 1000 / FPS;
  const report = {
    kind: 'S8B-01 CP2 Replay render spike (local, synthetic)',
    ffmpeg: ffmpeg.version,
    timeline: { durationMs: timeline.durationMs, units: timeline.units, beepsMs: timeline.beeps },
    source: Object.fromEntries(Object.entries(sources).map(([k, p]) => [k, { file: `source/${k.toLowerCase()}.opus`, bytes: statSync(p).size, sha256: before[k] }])),
    output: {
      file: 'replay.mp4', bytes: statSync(mp4).size, durationS: Number(probe.format.duration), faststart: moovBeforeMdat(readFileSync(mp4)),
      video: { codec: v.codec_name, profile: v.profile, level: v.level, pixFmt: v.pix_fmt, width: v.width, height: v.height, fps: v.r_frame_rate, durationS: Number(v.duration) },
      audio: { codec: a.codec_name, profile: a.profile, sampleRate: Number(a.sample_rate), channels: a.channels, durationS: Number(a.duration) },
    },
    sync: { offsets, maxAbsOffsetMs: Math.max(...offsets.map((o) => Math.abs(o.avOffsetMs))), toleranceMs: Math.round(frameMs) },
    sourcesUnchangedByRender: JSON.stringify(before) === JSON.stringify(after),
    processingFilesDeleted: !existsSync(work),
    resources: { renderWallMs: renderMs, ...parseBenchmark(r.stderr), realtimeFactor: Number((renderMs / timeline.durationMs).toFixed(3)) },
  };
  report.checks = {
    h264MainYuv420p: v.codec_name === 'h264' && v.profile === 'Main' && v.pix_fmt === 'yuv420p',
    aacLc: a.codec_name === 'aac' && a.profile === 'LC',
    faststart: report.output.faststart,
    durationsAgree: Math.abs(Number(v.duration) - Number(a.duration)) < 0.1,
    syncWithinOneFrame: offsets.every((o) => Math.abs(o.avOffsetMs) <= frameMs) && offsets.length === 2,
    timelineHeld: offsets.every((o) => Math.abs(o.audioMs - o.expectedMs) <= 30),
    sourcesUnchangedByRender: report.sourcesUnchangedByRender,
    processingFilesDeleted: report.processingFilesDeleted,
  };
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  return report;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cloudRunDir, outDir] = process.argv.slice(2);
  if (!cloudRunDir || !outDir) { console.error('usage: replay-render-spike.mjs <cloudRunDir> <outDir>'); process.exit(64); }
  const report = await renderSpike(cloudRunDir, outDir);
  console.log(JSON.stringify({ checks: report.checks, output: report.output, sync: report.sync, resources: report.resources }, null, 1));
  if (!Object.values(report.checks).every(Boolean)) process.exit(1);
}
