/**
 * S8B-07 CP2-A.1 — the iOS Replay gate's readout, on jest's clock over the same fixture world the proof build plays in
 * real time: what the gate expects to read is what the readout says for a continuous part, a seek while playing and a
 * seek while held — and a break in the place is reported, never smoothed over.
 */
import type { ReplayDraftHandoff } from '../../replay-entry';
import { REPLAY, SESSION, run, until, world } from '../../original-audio/__fixtures__/replay-audio-world';
import { createCp2a1ProofMonitor, formatCp2a1Reading } from '../__validation__/cp2a1-proof-monitor';

jest.setTimeout(60000);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function opened() {
  const w = world();
  const monitor = createCp2a1ProofMonitor(w.player, w.clock);
  const stop = monitor.start();
  w.player.openSaved({ sessionId: SESSION, replayId: REPLAY, draftRevision: 1, coverage: 'SELECTED_EXCERPT', selectedMomentCount: 6 } as unknown as ReplayDraftHandoff);
  await run(0);
  await run(0);
  return { w, monitor, stop };
}

describe('the CP2-A.1 proof readout', () => {
  it('a part played from Play alone passes every moment, in order, with no break, to its end', async () => {
    const { w, monitor, stop } = await opened();
    w.player.play();
    await until(() => monitor.reading().ended, 60_000);
    const r = monitor.reading();
    expect(r.visited).toEqual([1, 2, 3, 5, 6]);
    expect(r.continuity).toBe('OK');
    expect(r.seeks).toBe(0);
    expect(r.durationMs).toBe(22_500);
    expect(r.tMs).toBe(22_500);
    expect(r.maxStepMs).toBeLessThanOrEqual(400);
    expect(formatCp2a1Reading(r)).toMatch(/^ord=6 t=22\.5 dur=22\.5 play=0 seeks=0 visited=1-2-3-5-6 cont=OK max=0\.\d end=1$/);
    stop();
  });

  it('a step on the line while playing is counted, lands on its moment, and the part goes on to its end unbroken', async () => {
    const { w, monitor, stop } = await opened();
    w.player.play();
    await until(() => (monitor.reading().ordinal ?? 0) >= 2 && monitor.reading().durationMs !== null);
    // 16 875 ms is in the pause before the second recording: it starts that recording's first moment.
    monitor.controller.seekTo(6, 0);
    await run(300);
    expect(monitor.reading().seeks).toBe(1);
    expect(monitor.reading().ordinal).toBe(6);
    await until(() => monitor.reading().ended, 60_000);
    expect(monitor.reading().continuity).toBe('OK');
    expect(monitor.reading().visited.slice(-1)).toEqual([6]);
    stop();
  });

  it('a step while held places the line there and holds it; Play goes on from it', async () => {
    const { w, monitor, stop } = await opened();
    w.player.play();
    await until(() => (monitor.reading().ordinal ?? 0) >= 2 && monitor.reading().durationMs !== null);
    w.player.pause();
    await until(() => !monitor.reading().playing);
    monitor.controller.seekTo(3, 3_750);
    await run(1_000);
    const held = monitor.reading();
    expect(held.ordinal).toBe(3);
    expect(held.tMs).toBeGreaterThanOrEqual(11_000);
    expect(held.tMs).toBeLessThanOrEqual(11_500);
    await run(2_000);
    expect(monitor.reading().tMs).toBe(held.tMs);
    w.player.play();
    await run(2_000);
    expect(monitor.reading().tMs!).toBeGreaterThan(held.tMs! + 1_000);
    await until(() => monitor.reading().ended, 60_000);
    expect(monitor.reading().continuity).toBe('OK');
    stop();
  });

  it('a jump nobody asked for is reported as a break', async () => {
    const { w, monitor, stop } = await opened();
    w.player.play();
    await until(() => (monitor.reading().ordinal ?? 0) >= 2 && monitor.reading().durationMs !== null);
    await run(1_000);
    w.player.seekTo(6, 0); // the uncounted controller: no step on the line was taken
    await run(500);
    expect(monitor.reading().continuity).toBe('BROKEN');
    stop();
  });
});
