import { CallEndingWarning, WARNING_FORCE_AFTER_MS, type WarningCuePort } from '../call-ending-warning';
import type { CueKind, CueRequest } from '../voice-call-engine';

function port(result: CueRequest = 'SCHEDULED') {
  const calls: { op: string; id: string; kind: CueKind; dueInMs?: number; forceAfterMs: number }[] = [];
  const p: WarningCuePort = {
    playCue: (id, kind, forceAfterMs) => {
      calls.push({ op: 'play', id, kind, forceAfterMs });
      return 'QUEUED';
    },
    scheduleCue: (id, kind, dueInMs, forceAfterMs) => {
      calls.push({ op: 'schedule', id, kind, dueInMs, forceAfterMs });
      return result;
    },
  };
  return { p, calls };
}

const lines = { notificationT5: 'N5', notificationT1: 'N1' };
const iso = (ms: number) => new Date(ms).toISOString();

describe('S8B-06 CP2 — the 60-minute warning policy', () => {
  it('schedules nothing without an end time, or after the end', () => {
    const { p, calls } = port();
    const w = new CallEndingWarning(p, lines);
    w.onState(null, 0);
    w.onState('not a date', 0);
    w.onState(iso(1000), 1000);
    expect(calls).toEqual([]);
  });

  it('skips T-5 when a minute or less is left; T-1 falls due at once', () => {
    const { p, calls } = port();
    new CallEndingWarning(p, lines).onState(iso(60_000), 0);
    expect(calls).toEqual([{ op: 'schedule', id: 'T1', kind: 'T1', dueInMs: 0, forceAfterMs: WARNING_FORCE_AFTER_MS.T1 }]);
  });

  it('maps the server notice to its warning and forces within the bound', () => {
    const { p, calls } = port();
    const w = new CallEndingWarning(p, lines);
    w.onCallEnding(300_000);
    w.onCallEnding(60_000);
    expect(calls.map((c) => [c.op, c.kind, c.forceAfterMs])).toEqual([['play', 'T5', 30_000], ['play', 'T1', 15_000]]);
  });

  it('a queued warning is not heard until the engine says HEARD; the notification line follows the latest due', () => {
    const { p } = port();
    const w = new CallEndingWarning(p, lines);
    expect(w.notificationLine).toBeNull();
    w.onCallEnding(300_000);
    expect(w.phase.T5).toBe('QUEUED');
    expect(w.notificationLine).toBe('N5');
    w.onCue('DROPPED', 'T5');
    expect(w.phase.T5).toBe('DROPPED');
    w.onCue('HEARD', 'T1');
    expect(w.phase.T1).toBe('HEARD');
    w.onCue('DROPPED', 'T1');
    expect(w.phase.T1).toBe('HEARD');
    expect(w.notificationLine).toBe('N1');
  });

  it('does not reschedule a warning already queued, and reschedules after the engine restarted', () => {
    const { p, calls } = port('NOT_RUNNING');
    const w = new CallEndingWarning(p, lines);
    w.onState(iso(10 * 60_000), 0);
    expect(w.phase).toEqual({ T5: 'NONE', T1: 'NONE' });
    w.onEngineRunning(1000);
    expect(calls.filter((c) => c.op === 'schedule')).toHaveLength(4);
    w.onCallEnding(300_000);
    w.onState(iso(10 * 60_000), 2000);
    expect(calls.filter((c) => c.op === 'schedule' && c.kind === 'T5')).toHaveLength(2);
  });
});
