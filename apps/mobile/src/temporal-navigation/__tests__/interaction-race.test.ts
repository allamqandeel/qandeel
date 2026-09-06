/**
 * T-06 — R1-02: cross-runtime late callback race.
 *
 * The scrub schedules target crossings and endings from the UI runtime onto the RN runtime
 * separately, so a callback can arrive after the gesture that produced it has already settled,
 * cancelled, failed or been superseded. Correctness must not depend on the scheduler delivering
 * them in order — so these tests never assume it does.
 *
 * `DeferredRuntime` below is the deterministic scheduler seam: it captures exactly what
 * `scheduleOnRN` would deliver — a function and its arguments, including the interaction epoch —
 * and lets a test flush that queue in ANY order, or partially, or long after the interaction is
 * over. Every invariant is then proven under delivery orders that a real device could produce and a
 * synchronous mock never would.
 */
import { createPresentationController } from '../../timeline';
import { createTemporalPreviewController } from '../preview';
import { createScrubHandlers, type ScrubHandlers } from '../timeline-integration/scrub';
import { fullyDisclosedTargeting, temporalTestStore, trackOf } from '../__fixtures__/temporal';

/**
 * A stand-in for the RN-runtime queue. Work is enqueued exactly as the gesture and the reaction
 * would schedule it and is delivered only when a test says so, in whatever order it says.
 */
class DeferredRuntime {
  private readonly queue: { readonly label: string; readonly run: () => void }[] = [];

  push(label: string, run: () => void): void {
    this.queue.push({ label, run });
  }

  get pending(): readonly string[] {
    return this.queue.map((entry) => entry.label);
  }

  /** Deliver the queued work in the given order, by label. Anything unnamed stays queued. */
  flush(...labels: readonly string[]): void {
    for (const label of labels) {
      const index = this.queue.findIndex((entry) => entry.label === label);
      if (index === -1) throw new Error(`nothing queued under ${label}`);
      const [entry] = this.queue.splice(index, 1);
      entry.run();
    }
  }

  flushAll(): void {
    while (this.queue.length > 0) {
      const [entry] = this.queue.splice(0, 1);
      entry.run();
    }
  }
}

function harness(liveHead = 12) {
  const store = temporalTestStore({ liveHead });
  const preview = createTemporalPreviewController();
  const presentation = createPresentationController(trackOf('session-1', liveHead), 240);
  const outcomes: string[] = [];
  const handlers = createScrubHandlers({
    store,
    preview,
    snapshot: presentation.getSnapshot,
    onOutcome: (outcome) => outcomes.push(outcome.outcome),
  });
  const runtime = new DeferredRuntime();

  // Exactly the two things the UI runtime schedules, carrying exactly what it carries.
  const scheduleTarget = (epoch: number, index: number, label: string) => runtime.push(label, () => handlers.targetIndex(epoch, index));
  const scheduleSettle = (epoch: number, committed: boolean, label: string) => runtime.push(label, () => handlers.settle(epoch, committed));

  return { store, preview, presentation, handlers, runtime, outcomes, scheduleTarget, scheduleSettle };
}

const previewOf = (handlers: ScrubHandlers) => handlers.liveInteraction();

describe('R1-02 — a late target callback after cancel', () => {
  it('is ignored: the preview stays idle and canonical state and RH are untouched', () => {
    const h = harness();
    const before = h.store.getState();

    // Gesture A crosses into SP(5), then is cancelled. Both are queued; the cancel lands first.
    h.scheduleTarget(1, 4, 'A:target');
    h.scheduleSettle(1, false, 'A:cancel');
    h.runtime.flush('A:cancel');
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });

    // The target callback now runs late.
    h.runtime.flush('A:target');

    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(h.store.getState()).toBe(before);
    expect(h.store.getState().history).toHaveLength(0);
    expect(h.outcomes).toEqual([]);
  });

  it('is ignored even when the gesture had already established a preview before cancelling', () => {
    const h = harness();
    h.scheduleTarget(1, 4, 'A:first');
    h.runtime.flush('A:first');
    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 5 });

    h.scheduleTarget(1, 7, 'A:late');
    h.scheduleSettle(1, false, 'A:cancel');
    h.runtime.flush('A:cancel', 'A:late');

    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(h.store.getState().history).toHaveLength(0);
  });
});

describe('R1-02 — a late target callback after a successful commit', () => {
  it('reopens no preview and produces no second Product transaction', () => {
    const h = harness();
    h.scheduleTarget(1, 2, 'A:target');
    h.scheduleTarget(1, 6, 'A:late');
    h.scheduleSettle(1, true, 'A:commit');

    h.runtime.flush('A:target', 'A:commit');
    expect(h.store.getState().temporal).toEqual({ kind: 'PINNED', at: 3 });
    expect(h.store.getState().history).toHaveLength(1);
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });

    // The queued crossing from the same, now closed, gesture arrives.
    h.runtime.flush('A:late');

    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(h.store.getState().temporal).toEqual({ kind: 'PINNED', at: 3 });
    expect(h.store.getState().history).toHaveLength(1);
    expect(h.outcomes).toEqual(['APPLIED']);
  });
});

describe('R1-02 — an old callback cannot disturb a new gesture', () => {
  it('leaves the newer gesture preview authoritative', () => {
    const h = harness();

    // Gesture A queues a crossing and closes.
    h.scheduleTarget(1, 1, 'A:target');
    h.scheduleSettle(1, false, 'A:cancel');
    h.runtime.flush('A:cancel');

    // Gesture B begins and targets a different Moment.
    h.scheduleTarget(2, 8, 'B:target');
    h.runtime.flush('B:target');
    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 9 });

    // A's crossing arrives late.
    h.runtime.flush('A:target');

    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 9 });
    expect(previewOf(h.handlers).epoch).toBe(2);
    expect(h.store.getState().history).toHaveLength(0);
  });

  it('holds even when the older gesture never settled at all', () => {
    const h = harness();
    h.scheduleTarget(1, 1, 'A:early');
    h.scheduleTarget(1, 2, 'A:late');
    h.runtime.flush('A:early');

    h.scheduleTarget(2, 8, 'B:target');
    h.runtime.flush('B:target', 'A:late');

    expect(h.preview.getSnapshot()).toMatchObject({ ptc: 9 });
  });
});

describe('R1-02 — an old settle cannot commit or cancel a new gesture', () => {
  it('cannot cancel the newer gesture preview', () => {
    const h = harness();
    h.scheduleSettle(1, false, 'A:cancel');

    h.scheduleTarget(2, 5, 'B:target');
    h.runtime.flush('B:target');
    expect(h.preview.getSnapshot()).toMatchObject({ ptc: 6 });

    h.runtime.flush('A:cancel');

    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 6 });
    expect(h.store.getState().history).toHaveLength(0);
  });

  it('cannot commit the newer gesture preview', () => {
    const h = harness();
    h.scheduleSettle(1, true, 'A:commit');

    h.scheduleTarget(2, 5, 'B:target');
    h.runtime.flush('B:target');

    h.runtime.flush('A:commit');

    expect(h.store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(h.store.getState().history).toHaveLength(0);
    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 6 });
    expect(h.outcomes).toEqual([]);
  });
});

describe('R1-02 — a settle commits only the preview its own interaction owns', () => {
  it('fails closed when the gesture established no target of its own', () => {
    const h = harness();
    // A preview left by another route entirely — the accessible one — is not this gesture's to take.
    h.scheduleTarget(1, 3, 'A:target');
    h.runtime.flush('A:target');
    h.scheduleSettle(1, false, 'A:cancel');
    h.runtime.flush('A:cancel');

    const preview = h.preview;
    preview.preview(fullyDisclosedTargeting(h.store), 7, 'EXACT_ENTRY');
    expect(preview.getSnapshot()).toMatchObject({ ptc: 7 });

    // Gesture B ends successfully without ever having crossed a step.
    h.scheduleSettle(2, true, 'B:commit');
    h.runtime.flush('B:commit');

    expect(h.outcomes).toEqual(['REJECTED']);
    expect(h.store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(h.store.getState().history).toHaveLength(0);
    // And it did not cancel somebody else's preview either.
    expect(preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 7 });
  });

  it('does not cancel a preview it does not own when it ends unsuccessfully', () => {
    const h = harness();
    h.preview.preview(fullyDisclosedTargeting(h.store), 4, 'EXACT_ENTRY');

    h.scheduleSettle(1, false, 'A:cancel');
    h.runtime.flush('A:cancel');

    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 4 });
  });
});

describe('R1-02 — the invariant survives arbitrary delivery orders', () => {
  /**
   * Two gestures, four callbacks, delivered in six different orders. The expectations are stated
   * exactly rather than as a bound, because the correct answer genuinely differs per order — and
   * that is the point: a gesture commits when, and only when, it owns a live target of its own.
   *
   * Two complete gestures committing twice is CORRECT (order 1); a settle that arrives before its
   * own target owns nothing and must fail closed (orders 4, 5, 6); and a superseded gesture's
   * callbacks are ignored outright (orders 2, 3, 5, 6).
   */
  const CASES: readonly { readonly order: readonly string[]; readonly outcomes: readonly string[]; readonly rh: number }[] = [
    { order: ['A:t1', 'A:end', 'B:t1', 'B:end'], outcomes: ['APPLIED', 'APPLIED'], rh: 2 },
    { order: ['A:t1', 'B:t1', 'A:end', 'B:end'], outcomes: ['APPLIED'], rh: 1 },
    { order: ['B:t1', 'A:t1', 'B:end', 'A:end'], outcomes: ['APPLIED'], rh: 1 },
    { order: ['A:end', 'A:t1', 'B:end', 'B:t1'], outcomes: ['REJECTED', 'REJECTED'], rh: 0 },
    { order: ['B:end', 'B:t1', 'A:end', 'A:t1'], outcomes: ['REJECTED'], rh: 0 },
    { order: ['A:t1', 'B:end', 'B:t1', 'A:end'], outcomes: ['REJECTED'], rh: 0 },
  ];

  it.each(CASES)('delivers %o without a phantom transaction', ({ order, outcomes, rh }) => {
    const h = harness();
    h.scheduleTarget(1, 1, 'A:t1');
    h.scheduleSettle(1, true, 'A:end');
    h.scheduleTarget(2, 5, 'B:t1');
    h.scheduleSettle(2, true, 'B:end');

    h.runtime.flush(...order);

    expect(h.outcomes).toEqual(outcomes);
    // RH matches the applied outcomes exactly: never a transaction nobody was told about, and
    // never an outcome without a transaction behind it.
    expect(h.store.getState().history).toHaveLength(rh);
    expect(h.store.getState().history.every((entry) => entry.act === 'COMMIT_MOMENT')).toBe(true);
    // No interaction is left open, and none is left owning a target it can still act on.
    expect(previewOf(h.handlers).open).toBe(false);
    expect(previewOf(h.handlers).generation).toBeNull();
  });

  it('never commits a target the settling interaction did not itself establish', () => {
    for (const { order } of CASES) {
      const h = harness();
      h.scheduleTarget(1, 1, 'A:t1');
      h.scheduleSettle(1, true, 'A:end');
      h.scheduleTarget(2, 5, 'B:t1');
      h.scheduleSettle(2, true, 'B:end');
      h.runtime.flush(...order);

      // A's only legitimate target is SP(2) and B's is SP(6). No delivery order can produce a
      // committed position that neither gesture ever established.
      const committed = h.store.getState().temporal;
      if (committed.kind === 'PINNED') expect([2, 6]).toContain(committed.at);
    }
  });
});
