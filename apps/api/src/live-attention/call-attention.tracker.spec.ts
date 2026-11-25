import type { BackgroundPermitGate } from '../live-analysis/background-permits';
import { CallAttentionTracker } from './call-attention.tracker';
import type { AttentionObservation, ProvisionalAttentionConfig } from './provisional-attention.types';
import { FakeAttentionEvaluator, InMemoryAttentionStore, none, set, usage } from './testing/fake-attention-evaluator';

const flush = async (rounds = 8): Promise<void> => {
  for (let i = 0; i < rounds; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
};

class ManualTimers {
  private handles = new Map<number, { readonly fn: () => void; readonly ms: number }>();
  private next = 1;
  set = (fn: () => void, ms: number): unknown => {
    const id = this.next++;
    this.handles.set(id, { fn, ms });
    return id;
  };
  clear = (handle: unknown): void => {
    this.handles.delete(handle as number);
  };
  fire(): number {
    const due = [...this.handles.entries()];
    this.handles.clear();
    for (const [, h] of due) h.fn();
    return due.length;
  }
  get pending(): readonly number[] {
    return [...this.handles.values()].map((h) => h.ms);
  }
}

function harness(opts: {
  readonly evaluator?: FakeAttentionEvaluator; readonly granted?: () => boolean; readonly config?: Partial<ProvisionalAttentionConfig>;
} = {}) {
  const store = new InMemoryAttentionStore();
  const evaluator = opts.evaluator ?? new FakeAttentionEvaluator();
  const timers = new ManualTimers();
  const observations: AttentionObservation[] = [];
  let clock = 0;
  let now = 1_000_000;
  const permitsAsked: Array<{ kind: string; respectCriticalWindow?: boolean; maxWaitMs?: number }> = [];
  const permits: BackgroundPermitGate = {
    acquire: async (_user, kind, options) => {
      permitsAsked.push({ kind, respectCriticalWindow: options?.respectCriticalWindow, maxWaitMs: options?.maxWaitMs });
      return (opts.granted?.() ?? true) ? { waitedMs: 0, release: async () => undefined } : null;
    },
  };
  const tracker = new CallAttentionTracker({
    userId: 'u1', callId: 'c1', epoch: 1, evaluator, store, permits, captureClock: () => clock, now: () => now,
    config: opts.config, observe: (o) => observations.push(o), timers,
  });
  return {
    store, evaluator, timers, observations, tracker, permitsAsked,
    setClock: (ms: number) => { clock = ms; },
    advance: (ms: number) => { now += ms; },
  };
}

describe('INTEL-LIVE-01 CP1: the provisional attention tracker', () => {
  it('admits the first FINAL at once: no time, word-count or keyword prerequisite; the permit never waits', async () => {
    const h = harness();
    await h.tracker.start();
    h.setClock(900);
    h.tracker.evidence('USER', 'نعم', 400, 800);
    await flush();
    expect(h.evaluator.inputs).toHaveLength(1);
    expect(h.evaluator.inputs[0]!.newEvidence).toEqual([{ seq: 1, text: 'نعم' }]);
    expect(h.permitsAsked[0]).toEqual({ kind: 'PROVISIONAL_ATTENTION', respectCriticalWindow: true, maxWaitMs: 0 });
    expect(h.store.records[0]).toMatchObject({ track: 'USER', coversFromClockMs: 0, coversToClockMs: 800, outcome: 'NONE' });
    expect(h.tracker.snapshot().tracks.USER).toMatchObject({ coveredTo: 800, pending: 0 });
  });

  it('keeps ONE evaluation in flight; what arrives meanwhile is the next span, whole and in order', async () => {
    const evaluator = new FakeAttentionEvaluator('MANUAL');
    const h = harness({ evaluator });
    await h.tracker.start();
    h.tracker.evidence('USER', 'first', 0, 500);
    await flush();
    h.tracker.evidence('USER', 'second', 600, 900);
    h.tracker.evidence('USER', 'third', 950, 1_200);
    await flush();
    expect(evaluator.open).toBe(1);
    evaluator.answer(none());
    await flush();
    expect(evaluator.open).toBe(1);
    expect(evaluator.inputs[1]!.newEvidence.map((e) => e.text)).toEqual(['second', 'third']);
    expect(evaluator.inputs[1]!.priorText).toBe('first');
    evaluator.answer((input) => set('job', input.newEvidence[1]!.seq));
    await flush();
    expect(h.store.records.map((r) => [r.coversFromClockMs, r.coversToClockMs])).toEqual([[0, 500], [500, 1_200]]);
    expect(h.store.events[0]).toMatchObject({ subjectKey: 'job', anchorClockMs: 950 });
    expect(h.tracker.snapshot().tracks.USER.open).toEqual(['job']);
  });

  it('serves both tracks in arrival order, one at a time', async () => {
    const evaluator = new FakeAttentionEvaluator('MANUAL');
    const h = harness({ evaluator });
    await h.tracker.start();
    h.tracker.evidence('USER', 'u1', 0, 400);
    await flush();
    h.tracker.evidence('QANDEEL', 'q1', 500, 900);
    h.tracker.evidence('USER', 'u2', 1_000, 1_300);
    evaluator.answer(none());
    await flush();
    expect(evaluator.inputs[1]!.track).toBe('QANDEEL');
    evaluator.answer(none());
    await flush();
    expect(evaluator.inputs[2]!.track).toBe('USER');
  });

  it('a failure leaves the span pending; two in a row wait the backoff; a success then covers it', async () => {
    let calls = 0;
    const evaluator = new FakeAttentionEvaluator(() => (++calls <= 2 ? { kind: 'TIMEOUT', usage: null, providerMs: 4_000 } : none()));
    const h = harness({ evaluator });
    await h.tracker.start();
    h.tracker.evidence('USER', 'something', 0, 500);
    await flush();
    expect(h.store.records.map((r) => r.outcome)).toEqual(['TIMEOUT', 'TIMEOUT']);
    expect(h.tracker.snapshot().tracks.USER).toMatchObject({ coveredTo: 0, pending: 1 });
    expect(h.timers.pending).toEqual([5_000]);
    h.advance(5_000);
    h.timers.fire();
    await flush();
    expect(h.store.records.map((r) => r.outcome)).toEqual(['TIMEOUT', 'TIMEOUT', 'NONE']);
    expect(h.store.records[2]).toMatchObject({ coversFromClockMs: 0, coversToClockMs: 500 });
    expect(h.tracker.snapshot().tracks.USER).toMatchObject({ coveredTo: 500, pending: 0 });
  });

  it('an evaluator that throws is a provider failure, never a stuck lane', async () => {
    let calls = 0;
    const evaluator = new FakeAttentionEvaluator(() => {
      if (++calls === 1) throw new Error('boom');
      return none();
    });
    const h = harness({ evaluator });
    await h.tracker.start();
    h.tracker.evidence('USER', 'x', 0, 100);
    await flush();
    expect(h.store.records.map((r) => r.outcome)).toEqual(['PROVIDER_FAILED', 'NONE']);
  });

  it('no permit: DEFERRED_PERMIT is recorded, the span stays pending and is asked again after the retry', async () => {
    let grant = false;
    const h = harness({ granted: () => grant });
    await h.tracker.start();
    h.tracker.evidence('USER', 'x', 0, 100);
    await flush();
    expect(h.store.records.map((r) => r.outcome)).toEqual(['DEFERRED_PERMIT']);
    expect(h.evaluator.inputs).toHaveLength(0);
    expect(h.timers.pending).toEqual([1_000]);
    grant = true;
    h.timers.fire();
    await flush();
    expect(h.store.records.map((r) => r.outcome)).toEqual(['DEFERRED_PERMIT', 'NONE']);
  });

  it('past the word window the evaluated text overflows and the carry is required (a word boundary, not a duration)', async () => {
    const h = harness({ config: { maxTurnTextWords: 10 } });
    await h.tracker.start();
    const seven = 'a b c d e f g';
    h.tracker.evidence('USER', seven, 0, 100);
    await flush();
    h.tracker.evidence('USER', seven, 100, 200);
    await flush();
    expect(h.evaluator.inputs[0]!.carryRequired).toBe(false);
    expect(h.evaluator.inputs[1]!.carryRequired).toBe(true);
    h.tracker.evidence('USER', 'h', 200, 300);
    await flush();
    expect(h.evaluator.inputs[2]!.carryRequired).toBe(true);
    expect(h.evaluator.inputs[2]!.priorText.split(' ')).toHaveLength(10);
  });

  it('a span longer than the bound is admitted as consecutive whole sub-spans, none cut, none dropped', async () => {
    const evaluator = new FakeAttentionEvaluator('MANUAL');
    const h = harness({ evaluator, config: { maxTurnTextWords: 10 } });
    await h.tracker.start();
    h.tracker.evidence('USER', 'start', 0, 50);
    await flush();
    for (let i = 0; i < 4; i += 1) h.tracker.evidence('USER', 'w1 w2 w3 w4', 100 + i * 100, 190 + i * 100);
    evaluator.answer(none());
    await flush();
    expect(evaluator.inputs[1]!.newEvidence).toHaveLength(2);
    evaluator.answer(none());
    await flush();
    expect(evaluator.inputs[2]!.newEvidence).toHaveLength(2);
    evaluator.answer(none());
    await flush();
    expect(h.store.records.map((r) => [r.coversFromClockMs, r.coversToClockMs])).toEqual([[0, 50], [50, 290], [290, 490]]);
    expect(h.observations.filter((o) => o.kind === 'ATTENTION_ADMITTED').map((o) => (o as { subSpan: boolean }).subSpan)).toEqual([false, true, false]);
  });

  it('beyond the fold threshold the oldest open subjects travel folded, whole, never dropped', async () => {
    let n = 0;
    const evaluator = new FakeAttentionEvaluator((input) => set(`s${++n}`, input.newEvidence[0]!.seq));
    const h = harness({ evaluator, config: { maxOpenSubjects: 2 } });
    await h.tracker.start();
    for (let i = 0; i < 4; i += 1) {
      h.tracker.evidence('USER', `t${i}`, i * 100, i * 100 + 50);
      await flush();
    }
    const last = evaluator.inputs[3]!;
    expect(last.foldedSubjects.map((s) => s.subjectKey)).toEqual(['s1']);
    expect(last.openSubjects.map((s) => s.subjectKey)).toEqual(['s2', 's3']);
    expect(Object.keys(last.foldedSubjects[0]!).sort()).toEqual(['confidence', 'kind', 'label', 'subjectKey', 'threadRef']);
  });

  it('the hand-over records what was not covered as MISSED_HANDOVER, under its epoch, and stops', async () => {
    const evaluator = new FakeAttentionEvaluator('MANUAL');
    const h = harness({ evaluator });
    await h.tracker.start();
    h.tracker.evidence('USER', 'one', 0, 300);
    await flush();
    h.tracker.evidence('USER', 'two', 400, 700);
    h.tracker.evidence('QANDEEL', 'reply', 800, 1_100);
    await h.tracker.handover();
    await flush();
    expect(h.store.records.map((r) => [r.track, r.outcome, r.coversFromClockMs, r.coversToClockMs])).toEqual([
      ['USER', 'MISSED_HANDOVER', 0, 700], ['QANDEEL', 'MISSED_HANDOVER', 0, 1_100],
    ]);
    expect(h.store.records.every((r) => r.epoch === 1)).toBe(true);
    expect(h.tracker.snapshot().stopped).toBe('HANDOVER');
    h.tracker.evidence('USER', 'late', 1_200, 1_300);
    await flush();
    expect(evaluator.inputs).toHaveLength(1);
  });

  it('a fenced write stops the lane (a newer connection holds the call)', async () => {
    const h = harness();
    await h.tracker.start();
    h.store.epoch = 2;
    h.tracker.evidence('USER', 'x', 0, 100);
    await flush();
    expect(h.tracker.snapshot().stopped).toBe('FENCED');
  });

  it('ALREADY_COVERED adopts the database position (a lost acknowledgement), never re-evaluates covered evidence', async () => {
    const h = harness();
    await h.tracker.start();
    h.store.accounted.USER = 500;
    h.tracker.evidence('USER', 'x', 0, 400);
    await flush();
    expect(h.tracker.snapshot().tracks.USER).toMatchObject({ coveredTo: 500, pending: 0 });
    expect(h.evaluator.inputs).toHaveLength(1);
  });

  it('a lost write leaves the span pending and retries it', async () => {
    const h = harness();
    await h.tracker.start();
    h.store.failNextWrites = 1;
    h.tracker.evidence('USER', 'x', 0, 100);
    await flush();
    expect(h.tracker.snapshot().tracks.USER.pending).toBe(1);
    h.timers.fire();
    await flush();
    expect(h.tracker.snapshot().tracks.USER).toMatchObject({ coveredTo: 100, pending: 0 });
  });

  it('the emergency spend guard (when set) degrades the lane; the next commit records DEGRADED_SUSPENDED', async () => {
    const evaluator = new FakeAttentionEvaluator(() => ({ ...none(), usage: { ...usage(), completionTokens: 1_000_000 } }));
    const h = harness({ evaluator, config: { emergencyCallSpendUsd: 0.5 } });
    await h.tracker.start();
    h.tracker.evidence('USER', 'x', 0, 100);
    await flush();
    expect(h.tracker.snapshot().degraded).toBe('EMERGENCY_SPEND');
    h.tracker.evidence('USER', 'y', 200, 300);
    await flush();
    expect(evaluator.inputs).toHaveLength(1);
    h.tracker.turnCommitted();
    await flush();
    expect(h.store.records.map((r) => r.outcome)).toEqual(['NONE', 'DEGRADED_SUSPENDED']);
  });

  it('the guard is disabled by default: spend never stops understanding', async () => {
    const evaluator = new FakeAttentionEvaluator(() => ({ ...none(), usage: { ...usage(), completionTokens: 1_000_000 } }));
    const h = harness({ evaluator });
    await h.tracker.start();
    for (let i = 0; i < 3; i += 1) {
      h.tracker.evidence('USER', 'x', i * 100, i * 100 + 50);
      await flush();
    }
    expect(h.tracker.snapshot().degraded).toBeNull();
    expect(evaluator.inputs).toHaveLength(3);
  });

  it('sustained provider overload degrades the lane', async () => {
    const evaluator = new FakeAttentionEvaluator(() => ({ kind: 'PROVIDER_FAILED', usage: null, providerMs: 10, overloaded: true }));
    const h = harness({ evaluator, config: { overloadedFailuresBeforeDegraded: 3 } });
    await h.tracker.start();
    h.tracker.evidence('USER', 'x', 0, 100);
    await flush();
    expect(h.tracker.snapshot().degraded).toBeNull();
    h.advance(5_000);
    h.timers.fire();
    await flush();
    expect(h.tracker.snapshot().degraded).toBe('PROVIDER_OVERLOADED');
  });

  it('a resumed connection continues from the database: covered evidence is never sent again', async () => {
    const h = harness();
    h.store.accounted.USER = 1_000;
    h.store.open.USER.set('job', { subjectKey: 'job', label: 'job', kind: 'TOPIC', confidence: 'HIGH', threadRef: null });
    await h.tracker.start();
    h.tracker.evidence('USER', 'old', 500, 900);
    h.tracker.evidence('USER', 'new', 1_100, 1_400);
    await flush();
    expect(h.evaluator.inputs[0]!.newEvidence.map((e) => e.text)).toEqual(['new']);
    expect(h.evaluator.inputs[0]!.openSubjects.map((s) => s.subjectKey)).toEqual(['job']);
    expect(h.store.records[0]).toMatchObject({ coversFromClockMs: 1_000, coversToClockMs: 1_400 });
  });

  it('an ended call stops the lane at start; a missing call too', async () => {
    const ended = harness();
    ended.store.ended = true;
    await ended.tracker.start();
    expect(ended.tracker.snapshot().stopped).toBe('CALL_ENDED');
    const missing = harness();
    missing.store.exists = false;
    await missing.tracker.start();
    expect(missing.tracker.snapshot().stopped).toBe('NOT_FOUND');
  });

  it('observations carry instants and counts only, never a word', async () => {
    const h = harness({ evaluator: new FakeAttentionEvaluator((i) => set('secret-key', i.newEvidence[0]!.seq, 'private label')) });
    await h.tracker.start();
    h.tracker.evidence('USER', 'very private words', 0, 100);
    await flush();
    expect(JSON.stringify(h.observations)).not.toMatch(/private|secret/u);
  });
});
