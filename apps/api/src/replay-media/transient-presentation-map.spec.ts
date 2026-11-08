import type { TransientMapRow } from './transient-media.repository';
import { buildPresentationMap } from './transient-presentation-map';

// S8B-07 CP1-B (contract §5.3, §5.4) — the presentation map against plan rows shaped as 0195's resolver and 0196's map
// read answer them. The fixture is the verifier's three-run Replay (verify-migration-0196 THREE_RUN_EXPECTED): a note
// run, a call run with a barge-in and a 16 s held interval, and the file lengths the database computes for them.
let entry = 0;
function r(kind: TransientMapRow['row_kind'], over: Partial<TransientMapRow> = {}): TransientMapRow {
  return {
    entry_ordinal: entry, row_kind: kind, run_ordinal: null, window_ordinal: null, selected_ordinal: null, track: null,
    clock_start_ms: null, clock_end_ms: null, elapsed_ms: null, gap_kind: null, boundary_kind: null, ...over,
  };
}
function plan(): TransientMapRow[] {
  entry = 1;
  const run1 = [
    r('RUN', { run_ordinal: 1, clock_start_ms: 0, clock_end_ms: 3000 }),
    r('ITEM', { run_ordinal: 1, window_ordinal: 1, selected_ordinal: 1 }),
    r('WINDOW', { run_ordinal: 1, window_ordinal: 1, track: 'NOTE', clock_start_ms: 0, clock_end_ms: 3000 }),
    r('AUDIBLE', { run_ordinal: 1, track: 'NOTE', clock_start_ms: 0, clock_end_ms: 3000 }),
  ];
  entry = 2;
  const text = [r('TEXT', { selected_ordinal: 2 })];
  entry = 3;
  const boundary = [r('BOUNDARY', { boundary_kind: 'CROSS_RECORDING' })];
  entry = 4;
  const run2 = [
    r('RUN', { run_ordinal: 2, clock_start_ms: '1000', clock_end_ms: '25000' }),
    r('ITEM', { run_ordinal: 2, window_ordinal: 2, selected_ordinal: 3 }),
    r('ITEM', { run_ordinal: 2, window_ordinal: 3, selected_ordinal: 4 }),
    r('ITEM', { run_ordinal: 2, window_ordinal: 4, selected_ordinal: 5 }),
    r('ITEM', { run_ordinal: 2, window_ordinal: 4, selected_ordinal: 6 }),
    r('WINDOW', { run_ordinal: 2, window_ordinal: 2, track: 'USER', clock_start_ms: '1000', clock_end_ms: '3000' }),
    r('WINDOW', { run_ordinal: 2, window_ordinal: 3, track: 'QANDEEL', clock_start_ms: '2500', clock_end_ms: '5000' }),
    r('WINDOW', { run_ordinal: 2, window_ordinal: 4, track: 'USER', clock_start_ms: '21000', clock_end_ms: '25000' }),
    r('MIX', { run_ordinal: 2, clock_start_ms: '2500', clock_end_ms: '3000' }),
    r('HELD', { run_ordinal: 2, clock_start_ms: '5000', clock_end_ms: '21000', elapsed_ms: '16000' }),
    r('GAP', { run_ordinal: 2, window_ordinal: 4, track: 'USER', clock_start_ms: '22000', clock_end_ms: '22500', gap_kind: 'MUTED' }),
  ];
  return [...run1, ...text, ...boundary, ...run2];
}

describe('the presentation map (contract §5.3)', () => {
  it('translates plan milliseconds into file milliseconds by the worker\'s own run timeline', () => {
    const map = buildPresentationMap(plan());
    expect(map).not.toBeNull();
    expect(map!.runs.map((run) => run.durationMs)).toEqual([3000, 9500]);
    expect(map!.runs[0]!.spans).toEqual([{ kind: 'WINDOW', fromMs: 0, toMs: 3000, track: 'NOTE', momentOrdinal: 1 }]);
    expect(map!.runs[1]!.spans).toEqual([
      { kind: 'WINDOW', fromMs: 0, toMs: 2000, track: 'USER', momentOrdinal: 3 },
      { kind: 'WINDOW', fromMs: 1500, toMs: 4000, track: 'QANDEEL', momentOrdinal: 4 },
      { kind: 'MIX', fromMs: 1500, toMs: 2000 },
      // D-05.1: 16 s held → 1500 ms in the file, the true length declared.
      { kind: 'HELD', fromMs: 4000, toMs: 5500, elapsedMs: 16000, shortened: true },
      // C-B1: a multi-unit turn is ONE window, presented as its first item's moment.
      { kind: 'WINDOW', fromMs: 5500, toMs: 9500, track: 'USER', momentOrdinal: 5 },
      // A gap inside a window keeps its true length.
      { kind: 'GAP', fromMs: 6500, toMs: 7000, track: 'USER', gapKind: 'MUTED' },
    ]);
    // L-3: a cross-recording boundary claims no length.
    expect(map!.boundaries).toEqual([{ kind: 'CROSS_RECORDING' }]);
  });

  it('carries no key, URL, recording, digest or text; a TEXT item is not in the map', () => {
    const text = JSON.stringify(buildPresentationMap(plan()));
    expect(text).not.toMatch(/key|url|recording_?id|digest|storage|text/iu);
  });

  it('a same-recording boundary: ≤ 3000 ms real, otherwise shortened with its true length', () => {
    const rows = plan().map((row) => (row.row_kind === 'BOUNDARY' ? { ...row, boundary_kind: 'SAME_RECORDING' as const, elapsed_ms: 2000 } : row));
    expect(buildPresentationMap(rows)!.boundaries).toEqual([{ kind: 'SAME_RECORDING', elapsedMs: 2000, shortened: false }]);
    const long = rows.map((row) => (row.row_kind === 'BOUNDARY' ? { ...row, elapsed_ms: 45_000 } : row));
    expect(buildPresentationMap(long)!.boundaries).toEqual([{ kind: 'SAME_RECORDING', elapsedMs: 45_000, shortened: true }]);
  });

  it('fails closed (null), never a partial map, for every malformed plan', () => {
    const base = plan();
    const cases: Array<[string, TransientMapRow[]]> = [
      ['a window with no selected item', base.filter((row) => !(row.row_kind === 'ITEM' && row.window_ordinal === 3))],
      ['a boundary missing', base.filter((row) => row.row_kind !== 'BOUNDARY')],
      ['a cross-recording boundary with a length', base.map((row) => (row.row_kind === 'BOUNDARY' ? { ...row, elapsed_ms: 10 } : row))],
      ['a window inside a shortened held interval', [...base, r('WINDOW', { run_ordinal: 2, window_ordinal: 2, track: 'USER', clock_start_ms: 6000, clock_end_ms: 7000 })]],
      ['an unknown gap kind', base.map((row) => (row.row_kind === 'GAP' ? { ...row, gap_kind: 'INVENTED' } : row))],
      ['an unknown track', base.map((row) => (row.row_kind === 'WINDOW' && row.window_ordinal === 1 ? { ...row, track: null } : row))],
      ['runs not numbered 1..n', base.map((row) => (row.run_ordinal === 2 ? { ...row, run_ordinal: 3 } : row))],
      ['two RUN rows for one run', [...base, r('RUN', { run_ordinal: 1, clock_start_ms: 0, clock_end_ms: 3000 })]],
      ['no rows', []],
    ];
    for (const [name, rows] of cases) expect([name, buildPresentationMap(rows)]).toEqual([name, null]);
  });
});
