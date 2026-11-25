// INTEL-LIVE-01 CP2 (D-3, protocol v3) — what the tracker tells the phone: only what the database committed, each event once
// its write committed, the database's state at start / after a settlement / after a dropped frame, and never a state older
// than an event already told (the snapshot / event race).

import type { BackgroundPermitGate } from '../live-analysis/background-permits';
import type { LiveCallAttentionDelivery, LiveCallAttentionDisclosure } from '../voice/call-turn/live-call-attention.port';
import type { AttentionTrackState } from './call-attention.repository';
import { ATTENTION_DISCLOSURE_POLICY, CallAttentionTracker } from './call-attention.tracker';
import { liveCallAttentionOf, signallingAttentionSettlement } from './live-attention.provider';
import type { AttentionEvaluationResult } from './provisional-attention.types';
import { FakeAttentionEvaluator, InMemoryAttentionStore, none, set } from './testing/fake-attention-evaluator';

const flush = async (rounds = 10): Promise<void> => {
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
  fire(ms?: number): number {
    const due = [...this.handles.entries()].filter(([, h]) => ms === undefined || h.ms === ms);
    for (const [id] of due) this.handles.delete(id);
    for (const [, h] of due) h.fn();
    return due.length;
  }
  get pending(): readonly number[] {
    return [...this.handles.values()].map((h) => h.ms);
  }
}

const permits: BackgroundPermitGate = { acquire: async () => ({ waitedMs: 0, release: async () => undefined }) };

function harness(opts: { readonly evaluator?: FakeAttentionEvaluator; readonly store?: InMemoryAttentionStore; readonly delivery?: () => LiveCallAttentionDelivery } = {}) {
  const store = opts.store ?? new InMemoryAttentionStore();
  const evaluator = opts.evaluator ?? new FakeAttentionEvaluator();
  const timers = new ManualTimers();
  const told: LiveCallAttentionDisclosure[] = [];
  let clock = 0;
  let now = 1_000_000;
  const tracker = new CallAttentionTracker({
    userId: 'u1', callId: 'c1', epoch: 1, evaluator, store, permits, captureClock: () => clock, now: () => now, timers,
    disclose: (d) => {
      const delivery = opts.delivery?.() ?? 'SENT';
      if (delivery === 'SENT') told.push(d);
      return delivery;
    },
  });
  return {
    store, evaluator, timers, told, tracker,
    setClock: (ms: number) => { clock = ms; },
    advance: (ms: number) => { now += ms; },
  };
}

const withdraw = (subjectKey: string, dependsOnSeq: number): AttentionEvaluationResult => ({
  kind: 'DEVELOPMENTS', contextCarry: null, usage: null, providerMs: 5,
  developments: [{ op: 'WITHDRAW', subjectKey, label: subjectKey, kind: 'TOPIC', confidence: 'HIGH', threadRef: null, dependsOnSeq }],
});

describe('INTEL-LIVE-01 CP2: the attention disclosure (protocol v3)', () => {
  it('starts the phone from the database: one STATE with the open subjects and their event numbers', async () => {
    const store = new InMemoryAttentionStore();
    await store.record({
      userId: 'u1', callId: 'c1', epoch: 1, track: 'USER', coversFromClockMs: 0, coversToClockMs: 500, outcome: 'DEVELOPMENTS',
      admittedClockMs: 500, producedClockMs: 600, providerMs: 5, promptTokens: null, cacheHitTokens: null, completionTokens: null,
      events: [{ op: 'SET', subjectKey: 'a', label: 'A', kind: 'TOPIC', confidence: 'HIGH', threadRef: null, anchorClockMs: 0, evidenceClockMs: 500 }],
    });
    const h = harness({ store });
    await h.tracker.start();
    expect(h.told).toEqual([{
      kind: 'STATE', seq: 1, entries: [{ track: 'USER', subjectKey: 'a', label: 'A', kind: 'TOPIC', confidence: 'HIGH', threadRef: null, seq: 1 }],
    }]);
  });

  it('an empty call is told as an empty STATE (the phone layer is replaced by nothing)', async () => {
    const h = harness();
    await h.tracker.start();
    expect(h.told).toEqual([{ kind: 'STATE', seq: 0, entries: [] }]);
  });

  it('tells each development the moment its write committed, numbered by the database, with its produced instant', async () => {
    const evaluator = new FakeAttentionEvaluator((input) => (input.newEvidence[0]!.seq === 1 ? set('travel', 1) : withdraw('travel', 2)));
    const h = harness({ evaluator });
    await h.tracker.start();
    h.setClock(900);
    h.tracker.evidence('USER', 'سافرت', 100, 800);
    await flush();
    h.setClock(1_900);
    h.tracker.evidence('USER', 'لا ليس سفرا', 1_000, 1_800);
    await flush();
    expect(h.told.slice(1)).toEqual([
      { kind: 'EVENT', seq: 1, op: 'SET', producedClockMs: 900, subject: { track: 'USER', subjectKey: 'travel', label: 'travel', kind: 'TOPIC', confidence: 'HIGH', threadRef: null } },
      { kind: 'EVENT', seq: 2, op: 'WITHDRAW', producedClockMs: 1_900, subject: { track: 'USER', subjectKey: 'travel', label: 'travel', kind: 'TOPIC', confidence: 'HIGH', threadRef: null } },
    ]);
  });

  it('tells nothing for an answer the database did not commit (NONE, a failure, a write refused)', async () => {
    const evaluator = new FakeAttentionEvaluator(() => set('x', 1));
    const h = harness({ evaluator });
    await h.tracker.start();
    h.store.epoch = 2; // FENCED: another connection holds the call
    h.tracker.evidence('USER', 'نعم', 0, 400);
    await flush();
    expect(h.told).toHaveLength(1); // the start STATE only
    expect(h.store.events).toHaveLength(0);
  });

  it('the race: a STATE read before an event that was then told is never sent; it is read again and sent current', async () => {
    const evaluator = new FakeAttentionEvaluator('MANUAL');
    const h = harness({ evaluator });
    await h.tracker.start();
    h.tracker.evidence('USER', 'أ', 0, 400);
    await flush();
    // A settlement signal reads the state BEFORE the in-flight write commits ...
    let releaseRead!: () => void;
    const realRead = h.store.readState.bind(h.store);
    let held: readonly AttentionTrackState[] | null = null;
    h.store.readState = async () => {
      held = await realRead();
      await new Promise<void>((resolve) => { releaseRead = resolve; });
      h.store.readState = realRead;
      return held;
    };
    h.tracker.settled();
    await flush();
    // ... the write commits and its event is told (seq 1) ...
    evaluator.answer(set('a', 1));
    await flush();
    expect(h.told.at(-1)).toMatchObject({ kind: 'EVENT', seq: 1, op: 'SET' });
    // ... then the old read (seq 0, no 'a') resolves: it must not undo the event; a fresh read is told instead.
    releaseRead();
    await flush();
    const states = h.told.filter((d) => d.kind === 'STATE');
    expect(states.map((d) => d.seq)).toEqual([0, 1]);
    expect(states.at(-1)).toMatchObject({ seq: 1, entries: [{ subjectKey: 'a', seq: 1 }] });
    // Every seq the phone was told is non-decreasing: the phone can never be moved backwards.
    const seqs = h.told.map((d) => d.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  });

  it('a settlement on this instance is told as the database state (the settled subjects leave the layer)', async () => {
    const h = harness({ evaluator: new FakeAttentionEvaluator(() => set('a', 1)) });
    await h.tracker.start();
    h.tracker.evidence('USER', 'أ', 0, 400);
    await flush();
    h.store.settle('USER', 'CONFIRMED');
    h.tracker.settled();
    await flush();
    expect(h.told.at(-1)).toEqual({ kind: 'STATE', seq: 2, entries: [] });
  });

  it('a settlement on another instance reaches the phone by the bounded watch after a commit, and the watch stops', async () => {
    const h = harness({ evaluator: new FakeAttentionEvaluator(() => set('a', 1)) });
    await h.tracker.start();
    h.tracker.evidence('USER', 'أ', 0, 400);
    await flush();
    h.tracker.turnCommitted();
    expect(h.timers.pending).toContain(ATTENTION_DISCLOSURE_POLICY.settlementWatchEveryMs);
    h.store.settle('USER', 'EXPIRED');
    h.timers.fire(ATTENTION_DISCLOSURE_POLICY.settlementWatchEveryMs);
    await flush();
    expect(h.told.at(-1)).toEqual({ kind: 'STATE', seq: 2, entries: [] });
    // Nothing open any more: the watch does not re-arm after its next tick.
    h.timers.fire(ATTENTION_DISCLOSURE_POLICY.settlementWatchEveryMs);
    await flush();
    expect(h.timers.pending).not.toContain(ATTENTION_DISCLOSURE_POLICY.settlementWatchEveryMs);
  });

  it('the watch is bounded in time even while subjects stay open', async () => {
    const h = harness({ evaluator: new FakeAttentionEvaluator(() => set('a', 1)) });
    await h.tracker.start();
    h.tracker.evidence('USER', 'أ', 0, 400);
    await flush();
    h.tracker.turnCommitted();
    h.advance(ATTENTION_DISCLOSURE_POLICY.settlementWatchForMs);
    h.timers.fire(ATTENTION_DISCLOSURE_POLICY.settlementWatchEveryMs);
    await flush();
    expect(h.timers.pending).toEqual([]);
  });

  it('audio first: a dropped frame is not retried as a frame; the database state is told again later', async () => {
    let drop = false;
    const h = harness({ evaluator: new FakeAttentionEvaluator(() => set('a', 1)), delivery: () => (drop ? 'DROPPED' : 'SENT') });
    await h.tracker.start();
    drop = true;
    h.tracker.evidence('USER', 'أ', 0, 400);
    await flush();
    expect(h.told).toHaveLength(1);
    expect(h.timers.pending).toEqual([ATTENTION_DISCLOSURE_POLICY.resendAfterDropMs]);
    drop = false;
    h.timers.fire(ATTENTION_DISCLOSURE_POLICY.resendAfterDropMs);
    await flush();
    expect(h.told.at(-1)).toMatchObject({ kind: 'STATE', seq: 1, entries: [{ subjectKey: 'a' }] });
  });

  it('a stopped tracker tells nothing more and leaves no timer', async () => {
    const h = harness({ evaluator: new FakeAttentionEvaluator(() => set('a', 1)) });
    await h.tracker.start();
    h.tracker.evidence('USER', 'أ', 0, 400);
    await flush();
    h.tracker.turnCommitted();
    await h.tracker.close();
    h.tracker.settled();
    await flush();
    expect(h.timers.pending).toEqual([]);
    expect(h.told.filter((d) => d.kind === 'STATE')).toHaveLength(1);
  });

  it('without a listener (not v3) the lane evaluates exactly as before and nothing is read for the phone', async () => {
    const store = new InMemoryAttentionStore();
    let reads = 0;
    const read = store.readState.bind(store);
    store.readState = async () => { reads += 1; return read(); };
    const tracker = new CallAttentionTracker({
      userId: 'u1', callId: 'c1', epoch: 1, evaluator: new FakeAttentionEvaluator(() => set('a', 1)), store, permits, captureClock: () => 0,
    });
    await tracker.start();
    tracker.evidence('USER', 'أ', 0, 400);
    await flush();
    tracker.turnCommitted();
    tracker.settled();
    await flush();
    expect(reads).toBe(1);
    expect(store.events).toHaveLength(1);
    await tracker.close();
  });
});

describe('INTEL-LIVE-01 CP2: the settlement signal', () => {
  it('tells the trackers of the settled call on this instance, and only those', async () => {
    const store = new InMemoryAttentionStore();
    const told: Record<string, LiveCallAttentionDisclosure[]> = { c1: [], c2: [] };
    const lane = liveCallAttentionOf({ evaluator: new FakeAttentionEvaluator(() => none()), store, permits });
    const open = (callId: string) => lane.open({
      userId: 'u1', sessionId: 's1', callId, epoch: 1, latestCaptureMs: () => 0,
      discloseAttention: (d) => { told[callId]!.push(d); return 'SENT'; },
    });
    const one = open('c1');
    open('c2');
    await flush();
    lane.settled?.('c1');
    await flush();
    expect(told.c1).toHaveLength(2);
    expect(told.c2).toHaveLength(1);
    one.close();
    lane.settled?.('c1');
    await flush();
    expect(told.c1).toHaveLength(2);
  });

  it('signals only a settlement that changed something; the sweep signals each call it settled', async () => {
    const signalled: string[] = [];
    const wrapped = signallingAttentionSettlement({
      settle: async (_u, callId) => (callId === 'c1'
        ? { outcome: 'SETTLED' as const, confirmed: 1, expired: 0 }
        : { outcome: 'SETTLED' as const, confirmed: 0, expired: 0 }),
      settleDueHalves: async () => [
        { callId: 'c3', outcome: 'SETTLED', confirmed: 0, expired: 2 },
        { callId: 'c4', outcome: 'SETTLED', confirmed: 0, expired: 0 },
      ],
    }, { settled: (callId) => signalled.push(callId) });
    await wrapped.settle('u1', 'c1', 0, 'USER');
    await wrapped.settle('u1', 'c2', 0, 'USER');
    expect(await wrapped.settleDue(10)).toBe(2);
    expect(signalled).toEqual(['c1', 'c3']);
  });
});
