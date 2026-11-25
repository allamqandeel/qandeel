// INTEL-LIVE-01 CP1 — test doubles for the provisional attention lane: a scripted evaluator (the semantic authority's
// stand-in: it decides nothing by itself, it answers what the test scripted for the evidence it is shown) and an in-memory
// store with 0204's coverage rules. Never used by production composition.

import type {
  AttentionEventInput, AttentionRecordInput, AttentionRecordResult, AttentionTrackState, CallAttentionStore,
} from '../call-attention.repository';
import type {
  AttentionEvaluationInput, AttentionEvaluationResult, AttentionEvaluator, AttentionThread, AttentionTrack, OpenSubject,
} from '../provisional-attention.types';

export type ScriptedAnswer = (input: AttentionEvaluationInput) => AttentionEvaluationResult | Promise<AttentionEvaluationResult>;

/** Answers each evaluation with the script; records every input it was shown (for the tests' INTERIM / order checks). */
export class FakeAttentionEvaluator implements AttentionEvaluator {
  readonly inputs: AttentionEvaluationInput[] = [];
  private pending: Array<{ readonly input: AttentionEvaluationInput; readonly resolve: (r: AttentionEvaluationResult) => void; readonly signal: AbortSignal }> = [];

  constructor(private readonly script: ScriptedAnswer | 'MANUAL' = () => none()) {}

  evaluate(input: AttentionEvaluationInput, signal: AbortSignal): Promise<AttentionEvaluationResult> {
    this.inputs.push(input);
    if (this.script !== 'MANUAL') return Promise.resolve(this.script(input));
    return new Promise((resolve) => {
      this.pending.push({ input, resolve, signal });
      signal.addEventListener('abort', () => resolve({ kind: 'TIMEOUT', usage: null, providerMs: 0 }), { once: true });
    });
  }

  /** MANUAL mode: resolves the oldest open evaluation. */
  answer(result: AttentionEvaluationResult | ((input: AttentionEvaluationInput) => AttentionEvaluationResult)): void {
    const next = this.pending.shift();
    if (!next) throw new Error('No evaluation is open.');
    next.resolve(typeof result === 'function' ? result(next.input) : result);
  }

  get open(): number {
    return this.pending.length;
  }
}

export const none = (): AttentionEvaluationResult => ({ kind: 'NONE', developments: [], contextCarry: null, usage: usage(), providerMs: 5 });
export const usage = () => ({ promptTokens: 1_000, cacheHitTokens: 800, completionTokens: 60 });
export function set(subjectKey: string, dependsOnSeq: number, label = subjectKey, kind: OpenSubject['kind'] = 'TOPIC'): AttentionEvaluationResult {
  return {
    kind: 'DEVELOPMENTS', contextCarry: null, usage: usage(), providerMs: 5,
    developments: [{ op: 'SET', subjectKey, label, kind, confidence: 'HIGH', threadRef: null, dependsOnSeq }],
  };
}

/** 0204's coverage rules in memory: contiguity, ALREADY_COVERED, the epoch fence, the call end. */
export class InMemoryAttentionStore implements CallAttentionStore {
  readonly records: AttentionRecordInput[] = [];
  readonly events: Array<AttentionEventInput & { readonly track: AttentionTrack; readonly seq: number }> = [];
  readonly accounted: Record<AttentionTrack, number> = { USER: 0, QANDEEL: 0 };
  readonly open: Record<AttentionTrack, Map<string, OpenSubject>> = { USER: new Map(), QANDEEL: new Map() };
  epoch = 1;
  ended = false;
  exists = true;
  failNextWrites = 0;
  threads: AttentionThread[] = [];

  async record(input: AttentionRecordInput): Promise<AttentionRecordResult> {
    if (this.failNextWrites > 0) {
      this.failNextWrites -= 1;
      throw new Error('transport');
    }
    if (!this.exists) return { outcome: 'NOT_FOUND', accountedToClockMs: null, firstEventSeq: null, lastEventSeq: null };
    if (input.epoch !== this.epoch) return { outcome: 'FENCED', accountedToClockMs: null, firstEventSeq: null, lastEventSeq: null };
    const at = this.accounted[input.track];
    if (this.ended) return { outcome: 'STALE_AFTER_END', accountedToClockMs: at, firstEventSeq: null, lastEventSeq: null };
    if (input.coversToClockMs <= at) return { outcome: 'ALREADY_COVERED', accountedToClockMs: at, firstEventSeq: null, lastEventSeq: null };
    if (input.coversFromClockMs !== at) return { outcome: 'STALE_RESULT', accountedToClockMs: at, firstEventSeq: null, lastEventSeq: null };
    this.records.push(input);
    const advances = ['DEVELOPMENTS', 'NONE', 'MISSED_HANDOVER', 'DEGRADED_SUSPENDED'].includes(input.outcome);
    if (advances) this.accounted[input.track] = input.coversToClockMs;
    let first: number | null = null;
    let last: number | null = null;
    for (const e of input.events ?? []) {
      const seq = this.events.length + 1;
      first ??= seq;
      last = seq;
      this.events.push({ ...e, track: input.track, seq });
      if (e.op === 'SET') this.open[input.track].set(e.subjectKey, { subjectKey: e.subjectKey, label: e.label, kind: e.kind, confidence: e.confidence, threadRef: e.threadRef });
      else this.open[input.track].delete(e.subjectKey);
    }
    return { outcome: 'RECORDED', accountedToClockMs: this.accounted[input.track], firstEventSeq: first, lastEventSeq: last };
  }

  async readState(): Promise<readonly AttentionTrackState[]> {
    if (!this.exists) return [];
    return (['USER', 'QANDEEL'] as const).map((track) => ({
      track, accountedToClockMs: this.accounted[track], settledThroughClockMs: -1, callEnded: this.ended, openSubjects: [...this.open[track].values()],
    }));
  }

  async readThreads(): Promise<readonly AttentionThread[]> {
    return this.threads;
  }
}
