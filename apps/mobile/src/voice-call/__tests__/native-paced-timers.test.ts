import { NativePacedTimers } from '../native-paced-timers';
import { ManualTimers } from '../__fixtures__/live-call-test-kit';

/** S8B-06 CP2 — the call's timers fire from native events when JS timers are paused, once per due time, never in a burst. */
describe('NativePacedTimers', () => {
  it('a timeout fires from the pump when JS timers are paused, and only once', () => {
    const base = new ManualTimers();
    const timers = new NativePacedTimers(base);
    const fired: string[] = [];
    timers.setTimeout(() => fired.push('a'), 500);
    base.skip(499);
    timers.pump();
    expect(fired).toEqual([]);
    base.skip(1);
    timers.pump();
    timers.pump();
    expect(fired).toEqual(['a']);
    base.advance(1000);
    expect(fired).toEqual(['a']);
    expect(timers.pending).toBe(0);
  });

  it('a timeout the JS timer fired first is not fired again by the pump', () => {
    const base = new ManualTimers();
    const timers = new NativePacedTimers(base);
    let n = 0;
    timers.setTimeout(() => (n += 1), 100);
    base.advance(100);
    timers.pump();
    expect(n).toBe(1);
  });

  it('an interval paced by the pump runs once per due time and never bursts to catch up', () => {
    const base = new ManualTimers();
    const timers = new NativePacedTimers(base);
    let n = 0;
    timers.setInterval(() => (n += 1), 1000);
    base.skip(5000);
    timers.pump();
    expect(n).toBe(1);
    base.skip(999);
    timers.pump();
    expect(n).toBe(1);
    base.skip(1);
    timers.pump();
    expect(n).toBe(2);
  });

  it('the foreground interval and the pump do not double-fire the same due time', () => {
    const base = new ManualTimers();
    const timers = new NativePacedTimers(base);
    let n = 0;
    timers.setInterval(() => (n += 1), 1000);
    base.advance(1000);
    expect(n).toBe(1);
    timers.pump(); // the native tick right after the JS interval ran it
    expect(n).toBe(1);
    base.advance(1000);
    expect(n).toBe(2);
  });

  it('a cleared timer never fires from either path', () => {
    const base = new ManualTimers();
    const timers = new NativePacedTimers(base);
    let n = 0;
    const t = timers.setTimeout(() => (n += 1), 10);
    const i = timers.setInterval(() => (n += 1), 10);
    timers.clearTimeout(t);
    timers.clearInterval(i);
    base.advance(100);
    timers.pump();
    expect(n).toBe(0);
    expect(timers.pending).toBe(0);
  });
});
