/**
 * A3-01 — the reader's Activity attention, for ONE runtime generation: the neutral attention mark (presence only), the
 * category indicators, and the ONE ordinary Attention Strip.
 *
 *   - It reads server truth (`GET /activity/attention`, the device's own IANA zone so Quiet Hours stay device-local):
 *     when it starts, when the app returns to the foreground, every 30 s while the app is in the foreground, when the
 *     reader leaves the Analysis, and when asked (after an item is seen or opened). One read at a time. Never in the
 *     background: it shares the runtime entry's ONE foreground signal and installs no listener of its own.
 *   - It decides presentation with `decidePresentation` (the device half of the law) against the surface the
 *     composition tells it, and the call truth it is handed (production knows no call).
 *   - It records in-app presentation EVIDENCE only for what truly happened: the one strip shown, and the candidates
 *     settled without one. Unknown stays unknown: a failed record is not retried as if it had succeeded, and the
 *     candidates it named are still never presented twice in this generation.
 *   - Inside the Analysis it presents nothing, settles nothing and announces nothing. Leaving re-reads current truth
 *     first, so a candidate that went stale, was muted or was seen meanwhile is not shown merely because it waited.
 */
import type { ActivityAttentionOutcome, ActivityIndicators, ForegroundSignal, InterruptionCandidate } from '../runtime-entry';
import { PRODUCTION_CALL_TRUTH, type CallTruth } from './call-truth';
import { decidePresentation, type ProductSurface } from './presentation';

export const ATTENTION_POLL_MS = 30_000;

export interface AttentionTransport {
  readAttention(timeZone: string): Promise<ActivityAttentionOutcome>;
  recordStrip(presentedItemId: string | null, settledItemIds: readonly string[]): Promise<boolean>;
}

export interface ShownStrip {
  readonly candidate: InterruptionCandidate;
  readonly form: 'ORDINARY' | 'CALL_SAFE';
}

export interface AttentionState {
  /** P3 §6: presence only. There is no global count, by construction. */
  readonly present: boolean;
  readonly categories: ActivityIndicators['categories'] | null;
  readonly strip: ShownStrip | null;
}

export interface ActivityAttentionController {
  getState(): AttentionState;
  subscribe(listener: () => void): () => void;
  start(): void;
  /** The composition's own surface truth. Leaving the Analysis re-reads current truth before anything is presented. */
  setSurface(surface: ProductSurface): void;
  /** Read again now (after an item was seen / opened, or the reader asked). */
  refresh(): void;
  /** The reader dismissed the strip, or its readable hold ended. Nothing is resolved. */
  dismissStrip(): void;
  /** The reader pressed the strip's body: it leaves, and the caller opens the item (revalidated at that moment). */
  takeStrip(): InterruptionCandidate | null;
  retire(): void;
}

export interface ActivityAttentionControllerOptions {
  readonly transport: AttentionTransport;
  readonly foreground: ForegroundSignal;
  readonly isCurrent: () => boolean;
  readonly timeZone?: () => string;
  readonly call?: () => CallTruth;
  readonly setTimer?: (callback: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  readonly pollMs?: number;
}

const deviceTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const EMPTY: AttentionState = Object.freeze({ present: false, categories: null, strip: null });

export function createActivityAttentionController(options: ActivityAttentionControllerOptions): ActivityAttentionController {
  const setTimer = options.setTimer ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const pollMs = options.pollMs ?? ATTENTION_POLL_MS;
  const call = options.call ?? (() => PRODUCTION_CALL_TRUTH);
  const timeZone = options.timeZone ?? deviceTimeZone;

  const listeners = new Set<() => void>();
  let state: AttentionState = EMPTY;
  let candidates: readonly InterruptionCandidate[] = [];
  let surface: ProductSurface = 'CONVERSATION';
  /** Items this generation already presented or settled: never presented (again) here, whatever the record's fate. */
  const decided = new Set<string>();
  let started = false;
  let retired = false;
  let reading = false;
  let readAgain = false;
  let timer: unknown = null;
  let unsubscribeForeground: (() => void) | null = null;

  const live = () => !retired && options.isCurrent();
  const publish = (next: AttentionState) => {
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };
  const foreground = () => options.foreground.current() === 'ACTIVE';

  function schedule(): void {
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (!live() || !foreground()) return;
    timer = setTimer(() => {
      timer = null;
      read();
    }, pollMs);
  }

  function evaluate(): void {
    if (!live()) return;
    const open = candidates.filter((candidate) => !decided.has(candidate.item.id));
    const decision = decidePresentation(open, { foreground: foreground(), surface, call: call(), showing: state.strip !== null });
    if (decision.kind === 'WAIT') return;
    const settledIds = decision.settled.map((candidate) => candidate.item.id);
    for (const id of settledIds) decided.add(id);
    if (decision.kind === 'SETTLE') {
      if (settledIds.length > 0) void options.transport.recordStrip(null, settledIds);
      return;
    }
    decided.add(decision.presented.item.id);
    publish({ ...state, strip: { candidate: decision.presented, form: decision.form } });
    // The call-safe strip is a transient presentation of an exception; it settles nothing and its item stays waiting.
    if (decision.form === 'ORDINARY') void options.transport.recordStrip(decision.presented.item.id, settledIds);
  }

  function read(): void {
    if (!live()) return;
    if (reading) {
      readAgain = true;
      return;
    }
    reading = true;
    void options.transport.readAttention(timeZone()).then((outcome) => {
      reading = false;
      if (!live()) return;
      if (outcome.kind === 'READ') {
        candidates = outcome.snapshot.interruptions;
        publish({ ...state, present: outcome.snapshot.present, categories: outcome.snapshot.categories });
        evaluate();
      }
      if (readAgain) {
        readAgain = false;
        read();
        return;
      }
      schedule();
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (started || !live()) return;
      started = true;
      unsubscribeForeground = options.foreground.subscribe((next) => {
        if (next === 'ACTIVE') read();
        else if (timer !== null) {
          clearTimer(timer);
          timer = null;
        }
      });
      // Never read in the background: a backgrounded start waits for the foreground.
      if (foreground()) read();
    },
    setSurface(next) {
      if (next === surface) return;
      const leftAnalysis = surface === 'ANALYSIS';
      surface = next;
      // No ordinary strip is ever laid over the Analysis: one that was showing leaves with the reader.
      if (next === 'ANALYSIS' && state.strip?.form === 'ORDINARY') publish({ ...state, strip: null });
      if (leftAnalysis) read();
      else evaluate();
    },
    refresh: () => read(),
    dismissStrip() {
      if (state.strip === null) return;
      publish({ ...state, strip: null });
    },
    takeStrip() {
      const shown = state.strip;
      if (shown === null || shown.form !== 'ORDINARY') return null;
      publish({ ...state, strip: null });
      return shown.candidate;
    },
    retire() {
      retired = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
      unsubscribeForeground?.();
      unsubscribeForeground = null;
      listeners.clear();
    },
  };
}
