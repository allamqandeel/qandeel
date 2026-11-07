import type { TransientMapRow } from './transient-media.repository';
import { HELD_REAL_MAX_MS, RunTimeline } from './transient-mix-plan';

/**
 * S8B-07 CP1-B (contract §5.3, §5.4) — the presentation map: the ONE client-side description of a Replay's audio, derived
 * on the server from the plan rows by the same RunTimeline the worker mixes with, so the file and the map cannot
 * disagree. Pure: no I/O. It carries no key, no URL, no recording and no text; every number is a translation of plan
 * milliseconds into file milliseconds, nothing new.
 *
 *   run       { durationMs, spans } in the plan's run order (the service adds the artifactId once the run is READY)
 *   spans     WINDOW (a selected item's window, its track and its Replay moment), MIX (both selected tracks heard),
 *             GAP (a recorded gap inside a window, never shortened), HELD (between islands: ≤ 3000 ms real, otherwise
 *             1500 ms with the true elapsedMs declared)
 *   boundary  boundaries[i] lies between runs[i] and runs[i + 1]: SAME_RECORDING with its elapsedMs, CROSS_RECORDING
 *             with no length, ever (L-3)
 *
 * A TEXT item carries no audio and is not in the map: the phone presents it with the V1 declared pace, in the order of the
 * moments. A malformed plan answers null (fail-closed): the phone is never handed a map it would have to repair.
 */
export type PresentationTrack = 'USER' | 'QANDEEL' | 'NOTE';
export const GAP_KINDS = ['RECONNECTION', 'MUTED', 'WRITER_LOSS', 'NOT_SPEAKING'] as const;
export type PresentationGapKind = (typeof GAP_KINDS)[number];

export type PresentationSpan =
  | { readonly kind: 'WINDOW'; readonly fromMs: number; readonly toMs: number; readonly track: PresentationTrack; readonly momentOrdinal: number }
  | { readonly kind: 'MIX'; readonly fromMs: number; readonly toMs: number }
  | { readonly kind: 'GAP'; readonly fromMs: number; readonly toMs: number; readonly track: PresentationTrack; readonly gapKind: PresentationGapKind }
  | { readonly kind: 'HELD'; readonly fromMs: number; readonly toMs: number; readonly elapsedMs: number; readonly shortened: boolean };

export interface PresentationRun {
  readonly runOrdinal: number;
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

const SPAN_ORDER: Readonly<Record<PresentationSpan['kind'], number>> = { WINDOW: 0, MIX: 1, GAP: 2, HELD: 3 };

class Malformed extends Error {}

const ms = (value: string | number | null): number => {
  const n = Number(value);
  if (value === null || !Number.isSafeInteger(n) || n < 0) throw new Malformed();
  return n;
};
const trackOf = (value: string | null): PresentationTrack => {
  if (value === 'USER' || value === 'QANDEEL' || value === 'NOTE') return value;
  throw new Malformed();
};

function buildRun(runOrdinal: number, rows: readonly TransientMapRow[]): PresentationRun {
  const runRows = rows.filter((r) => r.row_kind === 'RUN');
  if (runRows.length !== 1) throw new Malformed();
  const run = runRows[0]!;
  const timeline = new RunTimeline(ms(run.clock_start_ms), ms(run.clock_end_ms),
    rows.filter((r) => r.row_kind === 'HELD').map((r) => ({ a: ms(r.clock_start_ms), b: ms(r.clock_end_ms) })));
  const at = (t: string | number | null): number => timeline.fileMs(ms(t));
  // C-B1: each window is presented once, as the moment of the first selected item it carries.
  const momentOf = new Map<number, number>();
  for (const item of rows.filter((r) => r.row_kind === 'ITEM')) {
    if (item.window_ordinal === null || item.selected_ordinal === null) throw new Malformed();
    const known = momentOf.get(item.window_ordinal);
    if (known === undefined || item.selected_ordinal < known) momentOf.set(item.window_ordinal, item.selected_ordinal);
  }
  const windows = rows.filter((r) => r.row_kind === 'WINDOW');
  if (windows.length === 0) throw new Malformed();
  const spans: PresentationSpan[] = [];
  for (const w of windows) {
    const moment = w.window_ordinal === null ? undefined : momentOf.get(w.window_ordinal);
    if (moment === undefined) throw new Malformed();
    spans.push({ kind: 'WINDOW', fromMs: at(w.clock_start_ms), toMs: at(w.clock_end_ms), track: trackOf(w.track), momentOrdinal: moment });
  }
  for (const m of rows.filter((r) => r.row_kind === 'MIX')) spans.push({ kind: 'MIX', fromMs: at(m.clock_start_ms), toMs: at(m.clock_end_ms) });
  for (const g of rows.filter((r) => r.row_kind === 'GAP')) {
    if (!(GAP_KINDS as readonly string[]).includes(g.gap_kind ?? '')) throw new Malformed();
    spans.push({ kind: 'GAP', fromMs: at(g.clock_start_ms), toMs: at(g.clock_end_ms), track: trackOf(g.track), gapKind: g.gap_kind as PresentationGapKind });
  }
  for (const h of timeline.heldSpans()) spans.push({ kind: 'HELD', ...h });
  const durationMs = timeline.fileLengthMs;
  for (const s of spans) if (!(0 <= s.fromMs && s.fromMs < s.toMs && s.toMs <= durationMs)) throw new Malformed();
  spans.sort((x, y) => x.fromMs - y.fromMs || SPAN_ORDER[x.kind] - SPAN_ORDER[y.kind] || x.toMs - y.toMs);
  return { runOrdinal, durationMs, spans };
}

/** The map of a Replay version's plan rows, or null when they do not describe a well-formed sequence of runs. */
export function buildPresentationMap(rows: readonly TransientMapRow[]): PresentationMap | null {
  try {
    const ordinals = [...new Set(rows.filter((r) => r.row_kind === 'RUN').map((r) => r.run_ordinal))];
    if (ordinals.length === 0 || ordinals.some((n, i) => n !== i + 1)) return null;
    const runs = ordinals.map((n) => buildRun(n!, rows.filter((r) => r.run_ordinal === n && r.row_kind !== 'TEXT' && r.row_kind !== 'BOUNDARY')));
    const boundaries = [...rows].filter((r) => r.row_kind === 'BOUNDARY').sort((x, y) => x.entry_ordinal - y.entry_ordinal)
      .map((b): PresentationBoundary => {
        if (b.boundary_kind === 'CROSS_RECORDING') {
          if (b.elapsed_ms !== null) throw new Malformed();
          return { kind: 'CROSS_RECORDING' };
        }
        if (b.boundary_kind !== 'SAME_RECORDING') throw new Malformed();
        const elapsedMs = ms(b.elapsed_ms);
        return { kind: 'SAME_RECORDING', elapsedMs, shortened: elapsedMs > HELD_REAL_MAX_MS };
      });
    if (boundaries.length !== runs.length - 1) return null;
    return { runs, boundaries };
  } catch {
    // A plan the timeline refuses (MixFailure) or a malformed row: never a partial map.
    return null;
  }
}
