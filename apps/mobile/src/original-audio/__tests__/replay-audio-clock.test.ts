/**
 * S8B-07 CP1-B step 5 (Sheet B) — the S7-04 player with the original-audio clock source, over the simulated Replay Media
 * Service and streaming player: the moment switches only at a window's start (V-23, C-B2, D-05.5), a multi-unit voice turn
 * is one window (C-B1), a TEXT moment keeps the V1 pace with no audio and no request (V-29, B2X), the boundary pause is the
 * phone's (§5.4), a Spine jump starts at the window's start (B2T), pause holds both clocks, the live call outranks it, the
 * proven cause only (V-30), no fallback after the end (B13), and a map that is not this version's is refused whole. These
 * are FUNCTIONAL results on a fake clock; HC-1 … HC-5 are the device's (step 6).
 */
import { REPLAY_RENDER_CONTRACT_V1 } from '../../replay-composite';
import type { PresentationSpan } from '../presentation-map';
import { planFor } from '../replay-audio-clock';
import { announcementText, frameText, replayEndedRow } from '../ReplayAudioViews';
import { CROSS, MOMENTS, RUN0, RUN1, pace, run, until, world } from '../__fixtures__/replay-audio-world';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('a mixed V2 Replay played through (V-23, V-29, C-B1, §5.4)', () => {
  it('text at the V1 pace, then each window from its start, the moment switching only at window starts, one boundary pause, one set', async () => {
    const w = world();
    await w.open();
    expect(w.clock()).not.toBeNull();
    w.player.play();
    expect(w.ordinal()).toBe(1);
    // Moment 1 is text: its V1 pace, and no request for audio is made for it.
    await run(pace('first') - 10);
    expect(w.server.calls).toEqual([]);
    await run(10);
    // Moment 2's set is asked for; the moment shown stays 1 until moment 2's window starts (C-B2).
    expect(w.server.calls.filter((c) => c.startsWith('POST'))).toHaveLength(1);
    await run(1_100);
    expect(w.ordinal()).toBe(1);
    expect(w.clock()!.detail().engine.waiting).toBe(true); // RA-11 after 1 s without audio
    await run(1_200);
    expect(w.ordinal()).toBe(2);
    // The latest-started window is current: at 4 s into the file, moment 3, never back to 2 when its window ends.
    await run(4_000);
    expect(w.ordinal()).toBe(3);
    await run(2_500);
    expect(w.ordinal()).toBe(3);
    // The run ends: moment 4 is the same turn's later unit (C-B1), so moment 5 (text) is next; no audio while it is read.
    await until(() => w.ordinal() === 5);
    expect(w.ordinal()).toBe(5);
    const heardBefore = w.heard().length;
    await run(pace('fifth') - 10);
    expect(w.heard()).toHaveLength(heardBefore);
    await run(10);
    // Into another recording: the phone's 1.5 s pause (RA-05 announced), the moment shown still 5, then moment 6.
    expect(w.announced).toContainEqual({ kind: 'BOUNDARY', boundary: CROSS });
    await run(1_400);
    expect(w.ordinal()).toBe(5);
    expect(w.clock()!.detail().between).toEqual(CROSS);
    // 1.5 s, then the file's first byte (the fake network's 200 ms): moment 6.
    expect(await until(() => w.ordinal() === 6)).toBeLessThanOrEqual(310);
    await run(5_500);
    expect(w.playing()).toBe(false);
    expect(w.ordinal()).toBe(6);
    // One command (polled while the set was prepared) and one set for the whole session; every file heard once, in full.
    expect(new Set(w.server.calls.filter((c) => c.startsWith('POST')))).toHaveProperty('size', 1);
    expect(w.server.sets).toHaveLength(1);
    const runs = w.heard();
    const total = (r: number) => runs.filter((h) => h.run === r).reduce((sum, h) => sum + (h.to - h.from), 0);
    expect(total(0)).toBeGreaterThanOrEqual(8_900);
    expect(total(0)).toBeLessThanOrEqual(9_000);
    expect(total(1)).toBeGreaterThanOrEqual(4_900);
    expect(total(1)).toBeLessThanOrEqual(5_000);
    // Nothing heard while a text moment or the boundary pause was presented.
    const run0End = Math.max(...runs.filter((h) => h.run === 0).map((h) => h.until));
    const run1Start = Math.min(...runs.filter((h) => h.run === 1).map((h) => h.at));
    expect(run1Start - run0End).toBeGreaterThanOrEqual(pace('fifth') + 1_500);
    // RA-15 at the MIX start, RA-06 at the gap's start (assistive technology only), each once.
    expect(w.announced.filter((a) => a.kind === 'MIX')).toHaveLength(1);
    expect(w.announced.filter((a) => a.kind === 'GAP')).toEqual([{ kind: 'GAP', gapKind: 'RECONNECTION', ms: 1_000 }]);
  });

  it('pause holds the file and the text timer together; play resumes both where they were (D-05.6)', async () => {
    const w = world();
    await w.open();
    w.player.play();
    await run(pace('first') + 2_200 + 1_000);
    expect(w.ordinal()).toBe(2);
    w.player.pause();
    const at = w.clock()!.detail().positionMs;
    const heard = w.heard().length;
    await run(10_000);
    expect(w.heard()).toHaveLength(heard);
    expect(w.ordinal()).toBe(2);
    w.player.play();
    await run(500);
    expect(Math.abs(w.clock()!.detail().positionMs - at - 500)).toBeLessThanOrEqual(260);
    expect(w.playing()).toBe(true);
  });

  it('a Spine jump to an audio moment starts at its window\'s start; a jump to a TEXT moment stops the audio (B2T, V-29)', async () => {
    const w = world();
    await w.open();
    w.player.seek(3);
    w.player.play();
    await run(2_300);
    expect(w.ordinal()).toBe(3);
    expect(w.clock()!.detail().positionMs).toBeGreaterThanOrEqual(4_000);
    expect(w.clock()!.detail().positionMs).toBeLessThan(4_400);
    const posts = w.server.calls.filter((c) => c.startsWith('POST')).length;
    w.player.seek(5);
    expect(w.ordinal()).toBe(5);
    const heard = w.heard().length;
    await run(pace('fifth') - 10);
    // No audio and no request while the text moment is read, at its V1 pace.
    expect(w.heard()).toHaveLength(heard);
    expect(w.server.calls.filter((c) => c.startsWith('POST'))).toHaveLength(posts);
    expect(w.ordinal()).toBe(5);
    // A Spine jump to the later unit of a turn is the turn's window, presented as its first unit (C-B1).
    w.player.seek(4);
    await run(500);
    expect(w.ordinal()).toBe(3);
    expect(w.clock()!.detail().positionMs).toBeGreaterThanOrEqual(4_000);
  });

  it('inside a moment only its own window is reachable (B2S)', async () => {
    const w = world();
    await w.open();
    w.player.seek(2);
    w.player.play();
    await run(2_500);
    w.clock()!.seekWithin(2, 50_000);
    await run(0);
    expect(w.clock()!.detail().positionMs).toBeLessThan(6_000);
    // The line moved into the overlap: the latest-started window (moment 3) is current there (D-05.5).
    expect(w.ordinal()).toBe(3);
    w.player.seek(2);
    await run(300);
    w.clock()!.seekWithin(2, 2_500);
    await run(0);
    expect(w.clock()!.detail().positionMs).toBe(2_500);
    expect(w.ordinal()).toBe(2);
  });
});

describe('what outranks it, and what ends it', () => {
  it('a live call starting mid-play stops and releases it; while the call lasts play is refused with no text (V-21, V-34)', async () => {
    const w = world();
    await w.open();
    w.player.seek(2);
    w.player.play();
    await run(3_000);
    expect(w.playing()).toBe(true);
    w.call.set(true);
    await run(0);
    expect(w.playing()).toBe(false);
    expect(w.players.made.every((p) => p.released)).toBe(true);
    expect(w.server.calls.some((c) => c.startsWith('DELETE'))).toBe(true);
    const calls = w.server.calls.length;
    w.player.play();
    await run(5_000);
    expect(w.playing()).toBe(false);
    expect(w.server.calls).toHaveLength(calls);
    expect(w.clock()!.getState().phase).not.toBe('FAILED');
  });

  it('the source deleted mid-play: stopped, released, RA-10 only because the server proves it; nothing plays after (B13, V-30)', async () => {
    const w = world({ server: { sourceReason: 'DELETED' } });
    await w.open();
    w.player.seek(2);
    w.player.play();
    await run(3_000);
    w.server.deleteSource();
    await run(12_000);
    expect(w.clock()!.getState().phase).toBe('ENDED');
    expect(replayEndedRow(w.clock()!.detail().engine.endedReason)).toBe('RA-10');
    expect(w.playing()).toBe(false);
    const heard = w.heard().length;
    // No fallback: neither the clock nor the reading pace plays anything now.
    w.player.play();
    await run(20_000);
    expect(w.playing()).toBe(false);
    expect(w.heard()).toHaveLength(heard);
  });

  it('a cause the server does not prove is RA-17 (V-30)', () => {
    expect(replayEndedRow(null)).toBe('RA-17');
    expect(replayEndedRow('EXPIRED')).toBe('RA-09');
    expect(replayEndedRow('DELETED')).toBe('RA-10');
  });

  it('no Replay media service (NONE) or a full pool (BUSY): RA-12, and a later play asks again', async () => {
    const w = world();
    w.server.busy = 1;
    await w.open();
    w.player.seek(2);
    w.player.play();
    await run(500);
    expect(w.clock()!.getState().phase).toBe('FAILED');
    expect(w.playing()).toBe(false);
    w.player.play();
    await run(3_000);
    expect(w.playing()).toBe(true);
    expect(w.ordinal()).toBe(2);
  });

  it('closing the player releases the set and nothing more is fetched', async () => {
    const w = world();
    await w.open();
    w.player.seek(2);
    w.player.play();
    await run(3_000);
    w.player.close();
    await run(0);
    expect(w.clock()).toBeNull();
    expect(w.players.made.every((p) => p.released)).toBe(true);
    expect(w.server.calls.some((c) => c.startsWith('DELETE'))).toBe(true);
    const calls = w.server.calls.length;
    await run(60_000);
    expect(w.server.calls).toHaveLength(calls);
  });
});

describe('fail closed, and V1 unchanged', () => {
  it('a map that is not this version\'s is refused whole: RA-12, nothing heard', async () => {
    // Moment 1 (a TEXT moment) named by a window.
    const w = world({ server: { spans: [[{ kind: 'WINDOW', fromMs: 0, toMs: 9_000, track: 'USER', momentOrdinal: 1 }], RUN1] } });
    await w.open();
    w.player.seek(2);
    w.player.play();
    await run(5_000);
    expect(w.clock()!.getState().phase).toBe('FAILED');
    expect(w.heard()).toEqual([]);
  });

  it('planFor refuses a moment named twice, an uncovered audio moment, windows out of order, a run covering nothing', () => {
    const shapes = (a: readonly PresentationSpan[], b: readonly PresentationSpan[]) => [{ durationMs: 9_000, spans: a }, { durationMs: 5_000, spans: b }];
    expect(planFor(MOMENTS, shapes(RUN0, RUN1), [CROSS])).not.toBeNull();
    expect(planFor(MOMENTS, shapes(RUN0, [{ ...RUN1[0]!, momentOrdinal: 3 } as PresentationSpan]), [CROSS])).toBeNull();
    expect(planFor(MOMENTS, shapes([RUN0[0]!], RUN1), [CROSS])).toBeNull(); // moment 3 (and 4) uncovered
    expect(planFor(MOMENTS, shapes(RUN1, RUN0), [CROSS])).toBeNull();
    const plan = planFor(MOMENTS, shapes(RUN0, RUN1), [CROSS])!;
    expect(plan.windowOf.get(4)?.window.momentOrdinal).toBe(3);
    expect(plan.throughOf).toEqual([4, 6]);
  });

  it('a V1 version has no clock: the S7-04 pace for every moment, and no request', async () => {
    const text = MOMENTS.map((m) => ({ ...m, originalMedium: 'ORIGINAL_TEXT' as const }));
    const w = world({ contract: REPLAY_RENDER_CONTRACT_V1, moments: text });
    await w.open();
    expect(w.clock()).toBeNull();
    w.player.play();
    await run(pace('first'));
    expect(w.ordinal()).toBe(2);
    await run(pace('heard two'));
    expect(w.ordinal()).toBe(3);
    expect(w.server.calls).toEqual([]);
  });
});

describe('the words (Copy Gate R1.1)', () => {
  it('frames: RA-05 across recordings with no length, RA-04 only when shortened, nothing for a pause kept at its length', () => {
    expect(frameText(CROSS, 'ar')).toBe('من تسجيل آخر.');
    expect(frameText({ kind: 'SAME_RECORDING', elapsedMs: 754_000, shortened: true }, 'ar')).toBe('مضى هنا 12:34 في التسجيل، واختُصر هذا الفاصل عند الاستماع.');
    expect(frameText({ kind: 'SAME_RECORDING', elapsedMs: 2_000, shortened: false }, 'en')).toBeNull();
    expect(frameText({ kind: 'HELD', elapsedMs: 4_200, shortened: true }, 'en')).toBe('0:04 passed here in the recording; this interval is shortened for listening.');
  });

  it('announcements: RA-15 at a MIX, a gap\'s own row, and nothing for NOT_SPEAKING', () => {
    expect(announcementText({ kind: 'MIX' }, 'ar')).toBe('يُسمع صوتان معًا هنا.');
    expect(announcementText({ kind: 'GAP', gapKind: 'MUTED', ms: 3_000 }, 'en')).toBe('The microphone was muted here for 0:03.');
    expect(announcementText({ kind: 'GAP', gapKind: 'NOT_SPEAKING', ms: 3_000 }, 'en')).toBeNull();
  });
});
