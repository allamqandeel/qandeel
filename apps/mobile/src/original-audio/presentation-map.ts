/**
 * S8B-07 CP1-B (contract §5.3, §5.4) — the presentation map as the phone receives it: the ONE client-side description of
 * a Replay's audio, derived on the server from the plan. The phone decodes it strictly and never repairs, re-derives or
 * computes a window, a gap, a mix or a held time (no parallel truth authority). A map that is not exactly well formed
 * is refused whole: nothing of it is played.
 *
 *   run       { artifactId? (once READY), durationMs, spans }
 *   spans     WINDOW (a selected item's window, its track, its Replay moment) · MIX · GAP (never shortened) · HELD
 *   boundary  boundaries[i] lies between runs[i] and runs[i + 1]: SAME_RECORDING with its elapsedMs, or CROSS_RECORDING
 *             with no length, ever (L-3)
 *
 * The current moment at file position t is the latest-started WINDOW that contains t (D-05.5); it changes only at a
 * WINDOW's fromMs, never inside one (C-B2).
 */
export type PresentationTrack = 'USER' | 'QANDEEL' | 'NOTE';
export type PresentationGapKind = 'RECONNECTION' | 'MUTED' | 'WRITER_LOSS' | 'NOT_SPEAKING';

export type PresentationSpan =
  | { readonly kind: 'WINDOW'; readonly fromMs: number; readonly toMs: number; readonly track: PresentationTrack; readonly momentOrdinal: number }
  | { readonly kind: 'MIX'; readonly fromMs: number; readonly toMs: number }
  | { readonly kind: 'GAP'; readonly fromMs: number; readonly toMs: number; readonly track: PresentationTrack; readonly gapKind: PresentationGapKind }
  | { readonly kind: 'HELD'; readonly fromMs: number; readonly toMs: number; readonly elapsedMs: number; readonly shortened: boolean };

export interface PresentationRun {
  /** Present once the run's file is READY. */
  readonly artifactId: string | null;
  readonly durationMs: number;
  readonly spans: readonly PresentationSpan[];
}

export type PresentationBoundary =
  | { readonly kind: 'SAME_RECORDING'; readonly elapsedMs: number; readonly shortened: boolean }
  | { readonly kind: 'CROSS_RECORDING' };

export interface PresentationMap {
  readonly runs: readonly PresentationRun[];
  readonly boundaries: readonly PresentationBoundary[];
}

/** D-05.1: a held interval up to this length is real silence; a longer one is 1500 ms with its true length declared. */
export const HELD_REAL_MAX_MS = 3000;
/** The pause the phone holds at a long SAME_RECORDING boundary and at every CROSS_RECORDING boundary (§5.4). */
export const BOUNDARY_SHORTENED_MS = 1500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const TRACKS: readonly string[] = ['USER', 'QANDEEL', 'NOTE'];
const GAP_KINDS: readonly string[] = ['RECONNECTION', 'MUTED', 'WRITER_LOSS', 'NOT_SPEAKING'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isMs = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};

function decodeSpan(value: unknown, durationMs: number): PresentationSpan | null {
  if (!isRecord(value) || !isMs(value.fromMs) || !isMs(value.toMs)) return null;
  const { fromMs, toMs } = value;
  if (!(fromMs < toMs && toMs <= durationMs)) return null;
  switch (value.kind) {
    case 'WINDOW':
      if (!hasExactly(value, ['kind', 'fromMs', 'toMs', 'track', 'momentOrdinal']) || !TRACKS.includes(value.track as string)) return null;
      if (!isMs(value.momentOrdinal) || value.momentOrdinal < 1) return null;
      return { kind: 'WINDOW', fromMs, toMs, track: value.track as PresentationTrack, momentOrdinal: value.momentOrdinal };
    case 'MIX':
      return hasExactly(value, ['kind', 'fromMs', 'toMs']) ? { kind: 'MIX', fromMs, toMs } : null;
    case 'GAP':
      if (!hasExactly(value, ['kind', 'fromMs', 'toMs', 'track', 'gapKind'])) return null;
      if (!TRACKS.includes(value.track as string) || !GAP_KINDS.includes(value.gapKind as string)) return null;
      return { kind: 'GAP', fromMs, toMs, track: value.track as PresentationTrack, gapKind: value.gapKind as PresentationGapKind };
    case 'HELD': {
      if (!hasExactly(value, ['kind', 'fromMs', 'toMs', 'elapsedMs', 'shortened']) || !isMs(value.elapsedMs) || typeof value.shortened !== 'boolean') return null;
      // The D-05.1 rule, as the server applied it: never repaired here, only refused when it does not hold.
      const length = toMs - fromMs;
      const ok = value.shortened
        ? value.elapsedMs > HELD_REAL_MAX_MS && length === BOUNDARY_SHORTENED_MS
        : value.elapsedMs <= HELD_REAL_MAX_MS && length === value.elapsedMs;
      return ok ? { kind: 'HELD', fromMs, toMs, elapsedMs: value.elapsedMs, shortened: value.shortened } : null;
    }
    default:
      return null;
  }
}

function decodeRun(value: unknown): PresentationRun | null {
  if (!isRecord(value) || !isMs(value.durationMs) || value.durationMs < 1 || !Array.isArray(value.spans)) return null;
  const withId = value.artifactId !== undefined;
  if (!hasExactly(value, withId ? ['artifactId', 'durationMs', 'spans'] : ['durationMs', 'spans'])) return null;
  if (withId && (typeof value.artifactId !== 'string' || !UUID.test(value.artifactId))) return null;
  const spans: PresentationSpan[] = [];
  for (const entry of value.spans) {
    const span = decodeSpan(entry, value.durationMs);
    if (span === null) return null;
    spans.push(span);
  }
  // A run holds at least one window, and its spans arrive in file order.
  if (!spans.some((s) => s.kind === 'WINDOW') || spans.some((s, i) => i > 0 && s.fromMs < spans[i - 1]!.fromMs)) return null;
  return { artifactId: withId ? (value.artifactId as string) : null, durationMs: value.durationMs, spans };
}

function decodeBoundary(value: unknown): PresentationBoundary | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'CROSS_RECORDING') return hasExactly(value, ['kind']) ? { kind: 'CROSS_RECORDING' } : null;
  if (value.kind !== 'SAME_RECORDING' || !hasExactly(value, ['kind', 'elapsedMs', 'shortened'])) return null;
  if (!isMs(value.elapsedMs) || typeof value.shortened !== 'boolean' || value.shortened !== value.elapsedMs > HELD_REAL_MAX_MS) return null;
  return { kind: 'SAME_RECORDING', elapsedMs: value.elapsedMs, shortened: value.shortened };
}

/** The runs and boundaries of a playback answer, or null when they are not exactly a well-formed map. */
export function decodePresentationMap(runs: unknown, boundaries: unknown): PresentationMap | null {
  if (!Array.isArray(runs) || !Array.isArray(boundaries)) return null;
  const decodedRuns: PresentationRun[] = [];
  for (const entry of runs) {
    const run = decodeRun(entry);
    if (run === null) return null;
    decodedRuns.push(run);
  }
  const decodedBoundaries: PresentationBoundary[] = [];
  for (const entry of boundaries) {
    const boundary = decodeBoundary(entry);
    if (boundary === null) return null;
    decodedBoundaries.push(boundary);
  }
  if (decodedRuns.length === 0 ? decodedBoundaries.length !== 0 : decodedBoundaries.length !== decodedRuns.length - 1) return null;
  return { runs: decodedRuns, boundaries: decodedBoundaries };
}

/** The pause the phone holds at a boundary, and what it declares there (§5.4; no file is ever made for it). */
export function boundaryPauseMs(boundary: PresentationBoundary): number {
  return boundary.kind === 'SAME_RECORDING' && !boundary.shortened ? boundary.elapsedMs : BOUNDARY_SHORTENED_MS;
}

/** D-05.5: the latest-started WINDOW containing t, or null between windows. */
export function windowAt(run: PresentationRun, positionMs: number): Extract<PresentationSpan, { kind: 'WINDOW' }> | null {
  let found: Extract<PresentationSpan, { kind: 'WINDOW' }> | null = null;
  for (const span of run.spans) {
    if (span.kind !== 'WINDOW' || span.fromMs > positionMs || positionMs >= span.toMs) continue;
    if (found === null || span.fromMs >= found.fromMs) found = span;
  }
  return found;
}

/**
 * The Replay moment current at file position t (D-05.5 as the PO decided it: "the latest-started window is current; the
 * switch happens only at a window start"): the moment of the window with the latest start at or before t. It equals
 * `windowAt` while that window holds t, and it never changes inside a window or in a held space between two (C-B2).
 * Null only before the run's first window.
 */
export function momentAt(run: PresentationRun, positionMs: number): number | null {
  let found: Extract<PresentationSpan, { kind: 'WINDOW' }> | null = null;
  for (const span of run.spans) {
    if (span.kind !== 'WINDOW' || span.fromMs > positionMs) continue;
    // Two windows starting together: the later moment in the Replay order.
    if (found === null || span.fromMs > found.fromMs || (span.fromMs === found.fromMs && span.momentOrdinal > found.momentOrdinal)) found = span;
  }
  return found === null ? null : found.momentOrdinal;
}

/** The first WINDOW of a Replay moment in a run: where a Spine seek to that moment starts. */
export function firstWindowOf(run: PresentationRun, momentOrdinal: number): Extract<PresentationSpan, { kind: 'WINDOW' }> | null {
  let found: Extract<PresentationSpan, { kind: 'WINDOW' }> | null = null;
  for (const span of run.spans) {
    if (span.kind === 'WINDOW' && span.momentOrdinal === momentOrdinal && (found === null || span.fromMs < found.fromMs)) found = span;
  }
  return found;
}

/** The span of a kind that contains t (MIX, GAP, HELD): what the line announces or frames at that position. */
export function spanAt<K extends 'MIX' | 'GAP' | 'HELD'>(run: PresentationRun, kind: K, positionMs: number): Extract<PresentationSpan, { kind: K }> | null {
  for (const span of run.spans) {
    if (span.kind === kind && span.fromMs <= positionMs && positionMs < span.toMs) return span as Extract<PresentationSpan, { kind: K }>;
  }
  return null;
}
