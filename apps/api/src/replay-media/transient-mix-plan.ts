import type { JobInputRow } from './transient-media.repository';

/**
 * S8B-07 CP1-B (contract §4, §5) — the ONE translation of a job's database rows into sample placements. Pure: no I/O,
 * no clock, no file. The worker executes it; the presentation map (step 3) uses the same run timeline, so the file and
 * the map can never disagree.
 *
 * Every position is on the database clock: 24 samples per millisecond at the output rate (24 kHz), so a millisecond
 * boundary is an exact sample boundary.
 *   LISTENING  each STORED USER / QANDEEL segment is decoded alone and placed at clock_start × 24, trimmed to its own
 *              clock length; gaps stay silent at their true length; both tracks are summed (L-8).
 *   REPLAY     only the run's AUDIBLE spans are heard: each segment of a track is decoded whole and CUT to the
 *              intersection with that track's AUDIBLE spans after decoding (C-B3); the two tracks sum only where both
 *              are audible, which is exactly the plan's MIX (L-2). A HELD span of ≤ 3000 ms stays real; a longer one
 *              becomes 1500 ms (D-05.1, L-6). GAP rows inside windows are silence at their true length.
 */
export const OUTPUT_RATE = 24_000;
export const SAMPLES_PER_MS = OUTPUT_RATE / 1000;
/** D-05.1: a held interval up to this is kept real; a longer one is presented as HELD_SHORTENED_MS. */
export const HELD_REAL_MAX_MS = 3000;
export const HELD_SHORTENED_MS = 1500;
/** A call segment's decoded length must equal its clock length within one Opus frame (contract §4 step 2). */
export const SEGMENT_TOLERANCE_MS = 20;
/** A Voice Note (AAC) within one AAC frame at 24 kHz (≈ 42.7 ms), the file tolerance of contract §4 step 6. */
export const NOTE_TOLERANCE_MS = 43;

/** A job the worker must fail, with its bounded class. */
export class MixFailure extends Error {
  constructor(readonly failureClass: 'OBJECT_MISSING' | 'DECODE_FAILED' | 'LENGTH_MISMATCH' | 'TIME_CAP' | 'SCRATCH_CAP') {
    super(failureClass);
    this.name = 'MixFailure';
  }
}

/** One piece of a decoded source written into the output: decoded samples [from, to) at output sample `at`. */
export interface Piece { readonly from: number; readonly to: number; readonly at: number }

export interface SourcePlan {
  readonly storageKey: string;
  readonly track: 'USER' | 'QANDEEL' | 'NOTE';
  readonly contentType: 'audio/ogg' | 'audio/mp4';
  readonly byteSize: number;
  /** The decoded length the source must have, in samples, and the tolerance, in samples. */
  readonly expectedSamples: number;
  readonly toleranceSamples: number;
  readonly pieces: readonly Piece[];
}

export interface MixPlan {
  readonly ownerKind: 'LISTENING' | 'REPLAY_PLAYBACK';
  readonly generation: number;
  readonly storageKey: string;
  readonly expectedMs: number;
  readonly totalSamples: number;
  /** Ordered by the first sample each source writes. */
  readonly sources: readonly SourcePlan[];
}

const num = (value: string | number | null | undefined): number => {
  const n = Number(value);
  if (value === null || value === undefined || !Number.isSafeInteger(n)) throw new MixFailure('DECODE_FAILED');
  return n;
};

/** A HELD span as the file presents it. */
export interface HeldSpan { readonly fromMs: number; readonly toMs: number; readonly elapsedMs: number; readonly shortened: boolean }

/**
 * The run timeline: run clock ms → file ms. Inside the run, everything keeps its real length except a HELD span longer
 * than 3000 ms, which becomes 1500 ms. Audible spans never cross a HELD span (HELD lies between the run's islands).
 */
export class RunTimeline {
  private readonly helds: ReadonlyArray<{ a: number; b: number; shrink: number }>;

  constructor(readonly runStartMs: number, readonly runEndMs: number, held: ReadonlyArray<{ a: number; b: number }>) {
    if (!(runStartMs < runEndMs)) throw new MixFailure('DECODE_FAILED');
    this.helds = [...held].sort((x, y) => x.a - y.a).map(({ a, b }) => {
      if (!(runStartMs <= a && a < b && b <= runEndMs)) throw new MixFailure('DECODE_FAILED');
      const elapsed = b - a;
      return { a, b, shrink: elapsed > HELD_REAL_MAX_MS ? elapsed - HELD_SHORTENED_MS : 0 };
    });
  }

  /** The file position of run clock instant `t` (outside every shortened HELD span, or at its edge). */
  fileMs(t: number): number {
    let at = t - this.runStartMs;
    for (const h of this.helds) {
      if (h.b <= t) at -= h.shrink;
      else if (h.a < t) throw new MixFailure('DECODE_FAILED');
    }
    return at;
  }

  get fileLengthMs(): number {
    return this.fileMs(this.runEndMs);
  }

  heldSpans(): HeldSpan[] {
    return this.helds.map((h) => {
      const fromMs = this.fileMs(h.a);
      const shortened = h.shrink > 0;
      return { fromMs, toMs: fromMs + (shortened ? HELD_SHORTENED_MS : h.b - h.a), elapsedMs: h.b - h.a, shortened };
    });
  }
}

/** The job's plan, or a MixFailure. `rows` is `server_read_transient_media_job_v1` in full. */
export function planMix(rows: readonly JobInputRow[]): MixPlan {
  const job = rows.find((r) => r.entry === 'JOB');
  if (job === undefined || job.storage_key === null || (job.owner_kind !== 'LISTENING' && job.owner_kind !== 'REPLAY_PLAYBACK')) {
    throw new MixFailure('DECODE_FAILED');
  }
  const expectedMs = num(job.expected_duration_ms);
  const segments = rows.filter((r) => r.entry === 'SEGMENT');
  const sources = job.owner_kind === 'LISTENING' ? listeningSources(segments, expectedMs) : replaySources(rows, job, segments, expectedMs);
  return {
    ownerKind: job.owner_kind, generation: num(job.generation), storageKey: job.storage_key, expectedMs,
    totalSamples: expectedMs * SAMPLES_PER_MS,
    sources: sources.filter((s) => s.pieces.length > 0).sort((x, y) => x.pieces[0]!.at - y.pieces[0]!.at),
  };
}

function contentTypeOf(row: JobInputRow): 'audio/ogg' | 'audio/mp4' {
  if (row.content_type === 'audio/ogg' || row.content_type === 'audio/mp4') return row.content_type;
  throw new MixFailure('DECODE_FAILED');
}

function listeningSources(segments: readonly JobInputRow[], expectedMs: number): SourcePlan[] {
  return segments.map((s) => {
    if ((s.track !== 'USER' && s.track !== 'QANDEEL') || s.storage_key === null) throw new MixFailure('DECODE_FAILED');
    const start = num(s.clock_start_ms);
    const end = num(s.clock_end_ms);
    if (!(0 <= start && start < end && end <= expectedMs)) throw new MixFailure('LENGTH_MISMATCH');
    const length = (end - start) * SAMPLES_PER_MS;
    return {
      storageKey: s.storage_key, track: s.track, contentType: contentTypeOf(s), byteSize: num(s.byte_size),
      expectedSamples: length, toleranceSamples: SEGMENT_TOLERANCE_MS * SAMPLES_PER_MS,
      pieces: [{ from: 0, to: length, at: start * SAMPLES_PER_MS }],
    };
  });
}

function replaySources(rows: readonly JobInputRow[], job: JobInputRow, segments: readonly JobInputRow[], expectedMs: number): SourcePlan[] {
  const timeline = new RunTimeline(num(job.clock_start_ms), num(job.clock_end_ms),
    rows.filter((r) => r.entry === 'HELD').map((r) => ({ a: num(r.clock_start_ms), b: num(r.clock_end_ms) })));
  // The database's expected length is the same rule (0196 transient_plan_runs_v1); a disagreement is never mixed.
  if (timeline.fileLengthMs !== expectedMs) throw new MixFailure('LENGTH_MISMATCH');
  const audible = rows.filter((r) => r.entry === 'AUDIBLE').map((r) => {
    if (r.track !== 'USER' && r.track !== 'QANDEEL' && r.track !== 'NOTE') throw new MixFailure('DECODE_FAILED');
    return { track: r.track, a: num(r.clock_start_ms), b: num(r.clock_end_ms) };
  });
  return segments.map((s) => {
    if ((s.track !== 'USER' && s.track !== 'QANDEEL' && s.track !== 'NOTE') || s.storage_key === null) throw new MixFailure('DECODE_FAILED');
    const spans = audible.filter((x) => x.track === s.track);
    // A note has no clock of its own: its one object is [0, the note's duration), the window the plan states.
    const isNote = s.track === 'NOTE';
    const start = isNote ? 0 : num(s.clock_start_ms);
    const end = isNote ? Math.max(0, ...spans.map((x) => x.b)) : num(s.clock_end_ms);
    if (!(0 <= start && start < end)) throw new MixFailure('LENGTH_MISMATCH');
    const pieces: Piece[] = [];
    for (const span of spans) {
      const a = Math.max(span.a, start);
      const b = Math.min(span.b, end);
      if (a >= b) continue;
      pieces.push({ from: (a - start) * SAMPLES_PER_MS, to: (b - start) * SAMPLES_PER_MS, at: timeline.fileMs(a) * SAMPLES_PER_MS });
    }
    return {
      storageKey: s.storage_key, track: s.track, contentType: contentTypeOf(s), byteSize: num(s.byte_size),
      expectedSamples: (end - start) * SAMPLES_PER_MS,
      toleranceSamples: (isNote ? NOTE_TOLERANCE_MS : SEGMENT_TOLERANCE_MS) * SAMPLES_PER_MS,
      pieces: pieces.sort((x, y) => x.at - y.at),
    };
  });
}
