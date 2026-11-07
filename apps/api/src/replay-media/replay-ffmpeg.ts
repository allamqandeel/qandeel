import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import type { Writable } from 'node:stream';
import { MixFailure, OUTPUT_RATE } from './transient-mix-plan';

/**
 * S8B-07 CP1-B (D-06.6, contract §4 – §5, §20 point 4) — the pinned ffmpeg, spawned with the D-06 bounds.
 *
 *   - The binary is `FFMPEG_BIN` / `FFPROBE_BIN`: the BtbN 9.0.2 LGPL build verified by sha256 in CI and in the Replay
 *     image, or the gyan.dev 9.0.2 build for local proofs. The process refuses to start on any other version line.
 *   - Every invocation: `-threads 1 -filter_threads 1`, `-nostdin`, errors only, `-xerror`; ANY error line fails the
 *     job (fail-closed: a corrupt page is never skipped or replaced by silence).
 *   - Every encode and every digest decode is bit-exact (`-fflags +bitexact -flags +bitexact`), so two generations of
 *     one plan are byte-identical files and their PCM digests are equal (§20).
 *   - Every child is killed (SIGKILL) when the job's signal aborts (the wall cap, a lost lease); stderr is never logged
 *     or kept beyond the failure decision, and it never leaves this process.
 */
export interface FfmpegBinaries { readonly ffmpeg: string; readonly ffprobe: string }

export const REQUIRED_FFMPEG_LINE = /^ffmpeg version (?:n)?9\.0\.2[-\s]/u;

export function ffmpegBinariesFrom(env: NodeJS.ProcessEnv): FfmpegBinaries {
  const ffmpeg = env.FFMPEG_BIN;
  const ffprobe = env.FFPROBE_BIN;
  if (!ffmpeg || !ffprobe) throw new Error('FFMPEG_BIN and FFPROBE_BIN are required on the Replay pool');
  return { ffmpeg, ffprobe };
}

/** Thread and determinism flags for every output this pool produces. */
const BOUNDS = ['-threads', '1', '-filter_threads', '1'];
const BITEXACT = ['-fflags', '+bitexact', '-flags', '+bitexact'];
const QUIET = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-xerror'];

interface RunResult { readonly stdout: Buffer; readonly stderrBytes: number; readonly code: number | null }

/** Runs one child to completion: stdout collected up to `maxStdout` bytes (more fails), stderr counted only. */
function run(binary: string, args: readonly string[], signal: AbortSignal, maxStdout: number, onChild?: (child: ChildProcess) => void): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new MixFailure('TIME_CAP'));
      return;
    }
    const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    onChild?.(child);
    const chunks: Buffer[] = [];
    let size = 0;
    let stderrBytes = 0;
    let overflow = false;
    const kill = () => child.kill('SIGKILL');
    signal.addEventListener('abort', kill, { once: true });
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxStdout) {
        overflow = true;
        kill();
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBytes += chunk.length;
    });
    child.on('error', () => {
      signal.removeEventListener('abort', kill);
      reject(new MixFailure('DECODE_FAILED'));
    });
    child.on('close', (code) => {
      signal.removeEventListener('abort', kill);
      if (signal.aborted) reject(new MixFailure('TIME_CAP'));
      else if (overflow) reject(new MixFailure('LENGTH_MISMATCH'));
      else resolve({ stdout: Buffer.concat(chunks, size), stderrBytes, code });
    });
  });
}

/** `ffmpeg -version`'s first line must name the pinned 9.0.2 release line. */
export async function assertPinnedFfmpeg(bin: FfmpegBinaries, signal: AbortSignal): Promise<void> {
  const answer = await run(bin.ffmpeg, ['-hide_banner', '-version'], signal, 1 << 20).catch(() => null);
  const first = answer?.stdout.toString('utf8').split('\n')[0] ?? '';
  if (answer === null || answer.code !== 0 || !REQUIRED_FFMPEG_LINE.test(first)) {
    throw new Error('the Replay pool runs only the pinned ffmpeg 9.0.2');
  }
}

/**
 * Decodes one source file (Ogg Opus or a Voice Note M4A) alone to mono 32-bit float at 24 kHz. Placement and trimming
 * are the caller's, by the database clock: the container's own timestamps never place anything.
 */
export async function decodeToFloat(bin: FfmpegBinaries, inputPath: string, maxSamples: number, signal: AbortSignal): Promise<Float32Array> {
  const result = await run(bin.ffmpeg, [
    ...QUIET, ...BOUNDS, '-i', inputPath, '-map', '0:a:0', '-vn', '-sn', '-dn', '-ac', '1', '-ar', String(OUTPUT_RATE),
    '-c:a', 'pcm_f32le', ...BITEXACT, '-f', 'f32le', 'pipe:1',
  ], signal, maxSamples * 4);
  if (result.code !== 0 || result.stderrBytes > 0 || result.stdout.length % 4 !== 0) throw new MixFailure('DECODE_FAILED');
  // f32le on a little-endian host (asserted at start-up): the bytes are the samples.
  const samples = new Float32Array(result.stdout.length / 4);
  new Uint8Array(samples.buffer).set(result.stdout);
  return samples;
}

/** The encoder: mono float PCM at 24 kHz on stdin → AAC-LC, mono, 24 kHz, 32 kbps, faststart (D-C2), bit-exact. */
export interface Encoder {
  readonly stdin: Writable;
  /** Resolves when the file is complete; rejects with a MixFailure. */
  readonly done: Promise<void>;
}

export function startEncoder(bin: FfmpegBinaries, outputPath: string, signal: AbortSignal): Encoder {
  const child = spawn(bin.ffmpeg, [
    ...QUIET, ...BOUNDS, '-f', 'f32le', '-ar', String(OUTPUT_RATE), '-ac', '1', '-i', 'pipe:0',
    '-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '32k', '-ar', String(OUTPUT_RATE), '-ac', '1',
    '-map_metadata', '-1', '-map_chapters', '-1', ...BITEXACT, '-movflags', '+faststart', '-f', 'mp4', '-y', outputPath,
  ], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
  let stderrBytes = 0;
  child.stderr!.on('data', (chunk: Buffer) => {
    stderrBytes += chunk.length;
  });
  // A write after the encoder died must not crash the process; the `done` promise carries the failure.
  child.stdin!.on('error', () => undefined);
  const kill = () => child.kill('SIGKILL');
  // A signal that aborted before the spawn never fires again: the child is killed at once.
  if (signal.aborted) kill();
  else signal.addEventListener('abort', kill, { once: true });
  const done = new Promise<void>((resolve, reject) => {
    child.on('error', () => reject(new MixFailure('DECODE_FAILED')));
    child.on('close', (code) => {
      signal.removeEventListener('abort', kill);
      if (signal.aborted) reject(new MixFailure('TIME_CAP'));
      else if (code !== 0 || stderrBytes > 0) reject(new MixFailure('DECODE_FAILED'));
      else resolve();
    });
  });
  return { stdin: child.stdin!, done };
}

export interface ProbedFile { readonly durationMs: number }

/**
 * ffprobe: AAC LC, one channel, 24000 Hz, and the duration (ms, rounded); then the container: `moov` before `mdat`
 * (faststart). Anything else fails the job.
 */
export async function probeOutput(bin: FfmpegBinaries, path: string, signal: AbortSignal): Promise<ProbedFile> {
  const result = await run(bin.ffprobe, [
    '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,profile,channels,sample_rate:format=duration,format_name', '-of', 'json', path,
  ], signal, 1 << 20);
  if (result.code !== 0 || result.stderrBytes > 0) throw new MixFailure('DECODE_FAILED');
  const probed = JSON.parse(result.stdout.toString('utf8')) as {
    streams?: Array<{ codec_type?: string; codec_name?: string; profile?: string; channels?: number; sample_rate?: string }>;
    format?: { duration?: string };
  };
  const streams = probed.streams ?? [];
  const audio = streams[0];
  if (streams.length !== 1 || audio?.codec_type !== 'audio' || audio.codec_name !== 'aac' || audio.profile !== 'LC'
      || audio.channels !== 1 || audio.sample_rate !== String(OUTPUT_RATE)) {
    throw new MixFailure('DECODE_FAILED');
  }
  const seconds = Number(probed.format?.duration);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new MixFailure('DECODE_FAILED');
  if (!(await moovBeforeMdat(path))) throw new MixFailure('DECODE_FAILED');
  return { durationMs: Math.round(seconds * 1000) };
}

/** Walks the top-level MP4 boxes: `moov` must come before `mdat`. */
export async function moovBeforeMdat(path: string): Promise<boolean> {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const header = Buffer.alloc(16);
    let offset = 0;
    while (offset + 8 <= size) {
      await handle.read(header, 0, 16, offset);
      let boxSize = header.readUInt32BE(0);
      const type = header.toString('latin1', 4, 8);
      if (boxSize === 1) boxSize = Number(header.readBigUInt64BE(8));
      if (type === 'moov') return true;
      if (type === 'mdat') return false;
      if (boxSize < 8) return false;
      offset += boxSize;
    }
    return false;
  } finally {
    await handle.close();
  }
}

/**
 * The file's PCM digest (§20 point 4): the output decoded back, bit-exact, to 16-bit mono 24 kHz, hashed. Internal: it
 * goes to the database and nowhere else, never on the wire and never logged.
 */
export function pcmDigestOf(bin: FfmpegBinaries, path: string, maxSamples: number, signal: AbortSignal): Promise<string> {
  // Streamed into the hash: a 60-minute file is never held decoded in memory.
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new MixFailure('TIME_CAP'));
      return;
    }
    const child = spawn(bin.ffmpeg, [
      ...QUIET, ...BOUNDS, '-i', path, '-map', '0:a:0', '-ac', '1', '-ar', String(OUTPUT_RATE), '-c:a', 'pcm_s16le', ...BITEXACT,
      '-f', 's16le', 'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const hash = createHash('sha256');
    let size = 0;
    let stderrBytes = 0;
    let overflow = false;
    const kill = () => child.kill('SIGKILL');
    signal.addEventListener('abort', kill, { once: true });
    child.stdout!.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSamples * 2) {
        overflow = true;
        kill();
        return;
      }
      hash.update(chunk);
    });
    child.stderr!.on('data', (chunk: Buffer) => {
      stderrBytes += chunk.length;
    });
    child.on('error', () => reject(new MixFailure('DECODE_FAILED')));
    child.on('close', (code) => {
      signal.removeEventListener('abort', kill);
      if (signal.aborted) reject(new MixFailure('TIME_CAP'));
      else if (overflow) reject(new MixFailure('LENGTH_MISMATCH'));
      else if (code !== 0 || stderrBytes > 0) reject(new MixFailure('DECODE_FAILED'));
      else resolve(`sha256:${hash.digest('hex')}`);
    });
  });
}
