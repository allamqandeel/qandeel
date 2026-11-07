import { once } from 'node:events';
import { rm, stat, statfs, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VOICE_OBJECT_MAX_BYTES } from '../voice-media/private-audio-object.store';
import { checkOggOpusPages } from './ogg-page-check';
import { decodeToFloat, pcmDigestOf, probeOutput, startEncoder, type FfmpegBinaries } from './replay-ffmpeg';
import { SourceTooLargeError, type StoreMeter, type TransientAudioStore } from './transient-audio.store';
import { MixFailure, SAMPLES_PER_MS, type MixPlan, type SourcePlan } from './transient-mix-plan';

/**
 * S8B-07 CP1-B (contract §4 – §5, §9, §10; D-06.3) — executes one MixPlan inside one job's scratch directory.
 *
 * The output is built block by block (10 s of samples at a time): each block is the unity-gain float sum of every
 * piece that falls in it (no normalization, no compression, no limiter), written to the encoder's stdin with
 * backpressure. A source is fetched and decoded only when its first piece is reached, and dropped once its last piece
 * is written, so memory holds a few segments, never the whole call. Fail-closed throughout: a missing object, a
 * stream that is not a strict Ogg Opus file, any decoder error line, a decoded length off by more than one frame, a
 * file that does not probe exactly, the scratch bound or the wall cap → MixFailure, and nothing is uploaded.
 */
export const BLOCK_SAMPLES = 10 * 1000 * SAMPLES_PER_MS;
/** D-06.3: ≤ 128 MiB of scratch per job; refuse below 1 GiB free. */
export const SCRATCH_JOB_MAX_BYTES = 128 * 1024 * 1024;
export const SCRATCH_MIN_FREE_BYTES = 1024 * 1024 * 1024;

export interface MixedFile {
  readonly path: string;
  readonly byteSize: number;
  readonly durationMs: number;
  readonly pcmDigest: string;
}

export interface MixContext {
  readonly bin: FfmpegBinaries;
  readonly store: TransientAudioStore;
  readonly scratchDir: string;
  readonly meter: StoreMeter;
  readonly signal: AbortSignal;
  /** The free-space floor (D-06.3); lowered only by the proofs' scratch-cap fixture. */
  readonly minFreeBytes?: number;
  readonly maxScratchBytes?: number;
}

/** Tracks the scratch bytes of one job against its bound. */
class ScratchBudget {
  private used = 0;
  constructor(private readonly max: number) {}
  charge(bytes: number): void {
    this.used += bytes;
    if (this.used > this.max) throw new MixFailure('SCRATCH_CAP');
  }
  release(bytes: number): void {
    this.used -= bytes;
  }
  set(base: number, bytes: number): void {
    if (base + bytes > this.max) throw new MixFailure('SCRATCH_CAP');
  }
  get value(): number {
    return this.used;
  }
}

async function decodeSource(source: SourcePlan, index: number, ctx: MixContext, budget: ScratchBudget): Promise<Float32Array> {
  // The database recorded each object's exact size: a larger body is refused while it streams, a different one after.
  let bytes: Buffer | null;
  try {
    bytes = await ctx.store.readSource(source.storageKey, Math.min(source.byteSize, VOICE_OBJECT_MAX_BYTES), ctx.meter, ctx.signal);
  } catch (error) {
    if (ctx.signal.aborted) throw new MixFailure('TIME_CAP');
    if (error instanceof SourceTooLargeError) throw new MixFailure('DECODE_FAILED');
    throw error;
  }
  if (bytes === null) throw new MixFailure('OBJECT_MISSING');
  if (bytes.length !== source.byteSize) throw new MixFailure('DECODE_FAILED');
  // The strict container check first (every page's CRC and structure, a mono Opus stream); never the timestamps.
  if (source.contentType === 'audio/ogg' && !checkOggOpusPages(bytes)) throw new MixFailure('DECODE_FAILED');
  const path = join(ctx.scratchDir, `in-${index}${source.contentType === 'audio/ogg' ? '.ogg' : '.m4a'}`);
  budget.charge(bytes.length);
  await writeFile(path, bytes);
  try {
    const decoded = await decodeToFloat(ctx.bin, path, source.expectedSamples + source.toleranceSamples, ctx.signal);
    if (Math.abs(decoded.length - source.expectedSamples) > source.toleranceSamples) throw new MixFailure('LENGTH_MISMATCH');
    return decoded;
  } finally {
    await rm(path, { force: true });
    budget.release(bytes.length);
  }
}

export async function executeMix(plan: MixPlan, ctx: MixContext): Promise<MixedFile> {
  const free = await statfs(ctx.scratchDir);
  if (free.bavail * free.bsize < (ctx.minFreeBytes ?? SCRATCH_MIN_FREE_BYTES)) throw new MixFailure('SCRATCH_CAP');
  const budget = new ScratchBudget(ctx.maxScratchBytes ?? SCRATCH_JOB_MAX_BYTES);
  const output = join(ctx.scratchDir, 'out.m4a');
  const encoder = startEncoder(ctx.bin, output, ctx.signal);
  // If the encoder fails mid-way, the block loop must stop at once, with the encoder's own failure.
  let encoderFailure: unknown = null;
  encoder.done.catch((error: unknown) => {
    encoderFailure = error;
  });

  const lastPiece = plan.sources.map((s) => Math.max(...s.pieces.map((p) => p.at + (p.to - p.from))));
  const decoded = new Map<number, Float32Array>();
  let next = 0;
  try {
    for (let blockStart = 0; blockStart < plan.totalSamples; blockStart += BLOCK_SAMPLES) {
      const blockEnd = Math.min(plan.totalSamples, blockStart + BLOCK_SAMPLES);
      // Fetch and decode every source whose first piece starts before this block ends.
      while (next < plan.sources.length && plan.sources[next]!.pieces[0]!.at < blockEnd) {
        decoded.set(next, await decodeSource(plan.sources[next]!, next, ctx, budget));
        next += 1;
      }
      const block = new Float32Array(blockEnd - blockStart);
      for (const [index, samples] of decoded) {
        for (const piece of plan.sources[index]!.pieces) {
          const from = Math.max(piece.at, blockStart);
          const to = Math.min(piece.at + (piece.to - piece.from), blockEnd);
          // A decoded length within tolerance may be up to one frame short: the clock span keeps its length, the
          // missing tail is silence (never stretched, never borrowed from a neighbour).
          for (let t = from; t < to; t += 1) {
            const s = piece.from + (t - piece.at);
            if (s < samples.length) block[t - blockStart] += samples[s]!;
          }
        }
      }
      for (const index of [...decoded.keys()]) if (lastPiece[index]! <= blockEnd) decoded.delete(index);
      if (encoderFailure !== null) throw encoderFailure;
      const bytes = Buffer.from(block.buffer, block.byteOffset, block.byteLength);
      if (!encoder.stdin.write(bytes)) await Promise.race([once(encoder.stdin, 'drain'), encoder.done]);
      budget.set(budget.value, (await stat(output).catch(() => ({ size: 0 }))).size);
    }
    encoder.stdin.end();
    await encoder.done;
  } catch (error) {
    encoder.stdin.destroy();
    await encoder.done.catch(() => undefined);
    throw error;
  }
  const { size } = await stat(output);
  budget.set(0, size);
  if (size <= 0 || size > VOICE_OBJECT_MAX_BYTES) throw new MixFailure('SCRATCH_CAP');
  const probed = await probeOutput(ctx.bin, output, ctx.signal);
  const pcmDigest = await pcmDigestOf(ctx.bin, output, plan.totalSamples + 48_000, ctx.signal);
  return { path: output, byteSize: size, durationMs: probed.durationMs, pcmDigest };
}
