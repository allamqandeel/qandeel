import { HELD_SHORTENED_MS, MixFailure, RunTimeline, SAMPLES_PER_MS, planMix } from './transient-mix-plan';
import type { JobInputRow } from './transient-media.repository';

// S8B-07 CP1-B — the one translation of job rows into placements (contract §4, §5). Pure; no audio.
const row = (over: Partial<JobInputRow>): JobInputRow => ({
  entry: 'SEGMENT', owner_kind: null, generation: null, storage_key: null, expected_duration_ms: null, track: null,
  segment_index: null, content_type: null, byte_size: null, clock_start_ms: null, clock_end_ms: null, elapsed_ms: null,
  gap_kind: null, window_ordinal: null, selected_ordinal: null, ...over,
});
const key = (n: number) => `voice-call/00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const out = 'voice-transient/00000000-0000-4000-8000-000000000999';

describe('LISTENING (L-8): every segment by the database clock, both tracks summed', () => {
  const rows = [
    row({ entry: 'JOB', owner_kind: 'LISTENING', generation: 1, storage_key: out, expected_duration_ms: '25000', clock_start_ms: 0, clock_end_ms: 25000 }),
    row({ storage_key: key(1), track: 'USER', segment_index: 0, content_type: 'audio/ogg', byte_size: 100, clock_start_ms: 0, clock_end_ms: 10000 }),
    row({ storage_key: key(2), track: 'USER', segment_index: 1, content_type: 'audio/ogg', byte_size: 100, clock_start_ms: 12000, clock_end_ms: 22000 }),
    row({ storage_key: key(3), track: 'QANDEEL', segment_index: 0, content_type: 'audio/ogg', byte_size: 100, clock_start_ms: 9000, clock_end_ms: 19000 }),
    row({ entry: 'GAP', track: 'USER', clock_start_ms: 10000, clock_end_ms: 12000, gap_kind: 'RECONNECTION' }),
  ];

  it('places each segment at clock_start × 24, trimmed to its own clock length; a gap writes nothing (silence)', () => {
    const plan = planMix(rows);
    expect(plan.ownerKind).toBe('LISTENING');
    expect(plan.totalSamples).toBe(25000 * SAMPLES_PER_MS);
    expect(plan.sources.map((s) => [s.storageKey, s.pieces])).toEqual([
      [key(1), [{ from: 0, to: 240000, at: 0 }]],
      [key(3), [{ from: 0, to: 240000, at: 216000 }]],
      [key(2), [{ from: 0, to: 240000, at: 288000 }]],
    ]);
    expect(plan.sources.every((s) => s.toleranceSamples === 20 * SAMPLES_PER_MS)).toBe(true);
  });

  it('a segment outside the call clock is never placed (LENGTH_MISMATCH)', () => {
    const bad = [...rows, row({ storage_key: key(4), track: 'USER', content_type: 'audio/ogg', byte_size: 1, clock_start_ms: 24000, clock_end_ms: 26000 })];
    expect(() => planMix(bad)).toThrow(new MixFailure('LENGTH_MISMATCH'));
  });

  it('an unknown container is never decoded', () => {
    const bad = rows.map((r) => (r.storage_key === key(1) ? { ...r, content_type: 'audio/wav' } : r));
    expect(() => planMix(bad)).toThrow(MixFailure);
  });
});

describe('REPLAY_PLAYBACK (C-B3, L-2, L-6, D-05.1): only AUDIBLE spans, cut after decoding, held shortened', () => {
  // A run on [1000, 40000): USER window [1000, 6000), QANDEEL window [4000, 9000) (MIX [4000, 6000)), a 30 s HELD
  // [9000, 39000), then a USER window [39000, 40000).
  const rows = [
    row({ entry: 'JOB', owner_kind: 'REPLAY_PLAYBACK', generation: 2, storage_key: out, expected_duration_ms: 1000 * (39 - 30) + 1500, clock_start_ms: 1000, clock_end_ms: 40000 }),
    row({ entry: 'AUDIBLE', track: 'USER', clock_start_ms: 1000, clock_end_ms: 6000 }),
    row({ entry: 'AUDIBLE', track: 'QANDEEL', clock_start_ms: 4000, clock_end_ms: 9000 }),
    row({ entry: 'AUDIBLE', track: 'USER', clock_start_ms: 39000, clock_end_ms: 40000 }),
    row({ entry: 'MIX', clock_start_ms: 4000, clock_end_ms: 6000 }),
    row({ entry: 'HELD', clock_start_ms: 9000, clock_end_ms: 39000, elapsed_ms: 30000 }),
    // A USER segment [0, 6500) wider than its window: the [0, 1000) and [6000, 6500) parts are never heard.
    row({ storage_key: key(1), track: 'USER', content_type: 'audio/ogg', byte_size: 1, clock_start_ms: 0, clock_end_ms: 6500 }),
    row({ storage_key: key(2), track: 'QANDEEL', content_type: 'audio/ogg', byte_size: 1, clock_start_ms: 3000, clock_end_ms: 13000 }),
    row({ storage_key: key(3), track: 'USER', content_type: 'audio/ogg', byte_size: 1, clock_start_ms: 38000, clock_end_ms: 48000 }),
  ];

  it('cuts each segment to its track\'s AUDIBLE span, after decoding, at the run timeline position', () => {
    const plan = planMix(rows);
    expect(plan.expectedMs).toBe(10500);
    const pieces = Object.fromEntries(plan.sources.map((s) => [s.storageKey, s.pieces]));
    // USER [1000, 6000) of a segment starting at 0: decoded samples [24000, 144000) at file 0.
    expect(pieces[key(1)]).toEqual([{ from: 24000, to: 144000, at: 0 }]);
    // QANDEEL [4000, 9000) of a segment starting at 3000: decoded [24000, 144000) at file 3000 ms.
    expect(pieces[key(2)]).toEqual([{ from: 24000, to: 144000, at: 3000 * SAMPLES_PER_MS }]);
    // After the 30 s HELD (presented as 1500 ms): USER [39000, 40000) lands at 8000 + 1500 ms.
    expect(pieces[key(3)]).toEqual([{ from: 24000, to: 48000, at: (8000 + HELD_SHORTENED_MS) * SAMPLES_PER_MS }]);
  });

  it('the MIX is exactly the intersection: both tracks write samples only in [3000, 5000) ms of the file', () => {
    const plan = planMix(rows);
    const span = (k: string) => plan.sources.find((s) => s.storageKey === k)!.pieces.map((p) => [p.at, p.at + p.to - p.from]);
    const [[ua, ub]] = span(key(1)) as [[number, number]];
    const [[qa, qb]] = span(key(2)) as [[number, number]];
    expect([Math.max(ua, qa) / SAMPLES_PER_MS, Math.min(ub, qb) / SAMPLES_PER_MS]).toEqual([3000, 5000]);
  });

  it('a held interval of ≤ 3000 ms stays real; a longer one is 1500 ms with its true elapsed_ms declared', () => {
    const t = new RunTimeline(0, 20000, [{ a: 2000, b: 5000 }, { a: 8000, b: 18000 }]);
    expect(t.heldSpans()).toEqual([
      { fromMs: 2000, toMs: 5000, elapsedMs: 3000, shortened: false },
      { fromMs: 5000 + 3000, toMs: 8000 + 1500, elapsedMs: 10000, shortened: true },
    ]);
    expect(t.fileLengthMs).toBe(20000 - (10000 - 1500));
  });

  it('a placement inside a shortened held span is refused (no audible span crosses one)', () => {
    const t = new RunTimeline(0, 20000, [{ a: 8000, b: 18000 }]);
    expect(() => t.fileMs(9000)).toThrow(MixFailure);
  });

  it('a database length that disagrees with the rule is never mixed (LENGTH_MISMATCH)', () => {
    const bad = rows.map((r) => (r.entry === 'JOB' ? { ...r, expected_duration_ms: 10501 } : r));
    expect(() => planMix(bad)).toThrow(new MixFailure('LENGTH_MISMATCH'));
  });

  it('a segment of an unselected track is decoded into nothing (L-2): no piece, no source', () => {
    const only = rows.filter((r) => !(r.entry === 'AUDIBLE' && r.track === 'QANDEEL') && r.entry !== 'MIX');
    const plan = planMix(only);
    expect(plan.sources.map((s) => s.storageKey)).not.toContain(key(2));
  });

  it('a Voice Note window [0, duration) cuts its one object, with the AAC-frame tolerance', () => {
    const note = 'voice-note/00000000-0000-4000-8000-000000000077';
    const plan = planMix([
      row({ entry: 'JOB', owner_kind: 'REPLAY_PLAYBACK', generation: 1, storage_key: out, expected_duration_ms: 4200, clock_start_ms: 0, clock_end_ms: 4200 }),
      row({ entry: 'AUDIBLE', track: 'NOTE', clock_start_ms: 0, clock_end_ms: 4200 }),
      row({ storage_key: note, track: 'NOTE', content_type: 'audio/mp4', byte_size: 1, clock_start_ms: null, clock_end_ms: null }),
    ]);
    expect(plan.sources).toEqual([expect.objectContaining({
      storageKey: note, expectedSamples: 4200 * SAMPLES_PER_MS, toleranceSamples: 43 * SAMPLES_PER_MS,
      pieces: [{ from: 0, to: 4200 * SAMPLES_PER_MS, at: 0 }],
    })]);
  });
});
