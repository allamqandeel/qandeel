/**
 * T-06 — `RELATIVE_FORWARD_CONTINUATION`: repeated forward targeting over legitimately disclosed
 * Session Positions.
 *
 * This is Class C interaction progress and nothing else. It moves the ephemeral preview target and
 * never canonical state, so while a continuation is running `TM` is unchanged, effective committed
 * `TC` is unchanged, `RH` is unchanged, and no Product transaction exists. It introduces no third
 * temporal mode: there is still exactly `FOLLOW_LIVE` and `PINNED(t)`, and a continuation is simply
 * a sequence of ephemeral targets between them.
 *
 * Two boundaries are absolute:
 *
 *   - it never crosses the authoritative Live Head. At `LH` the continuation HOLDS — it does not
 *     wrap, does not widen the disclosure horizon and does not reach for anything undisclosed;
 *   - reaching `LH` is not Live intent. Holding at the Live Head still means `PINNED(LH)` if the
 *     reader commits, because only an explicit Live act produces `FOLLOW_LIVE`.
 *
 * Ending a continuation is deliberately three different things, and none of them is implicit:
 * `hold()` stops advancing and leaves the target where it is; the caller then either commits it
 * through the established commit boundary, or cancels it. `abort()` is the input-cancellation path
 * and discards everything. No timer, no tick count and no elapsed duration is ever Product truth —
 * they choose WHEN a target changes, never WHICH targets are legitimate or whether one is committed.
 *
 * The cadence is a presentation policy, injected rather than frozen here. Any cadence — constant,
 * accelerating, or a single step per input — preserves these semantics identically, because every
 * tick goes through the same addressability gate that a single deliberate step goes through.
 */
import type { PreviewResult, TemporalPreviewController } from '../preview/preview-state';
import type { TemporalBounds } from '../targeting/addressability';

/** The default repeat cadence of a held forward continuation, in milliseconds. */
export const FORWARD_CONTINUATION_INTERVAL_MS = 180;

export type ContinuationTimerHandle = unknown;

export interface ForwardContinuationOptions {
  readonly intervalMs?: number;
  readonly setTimer?: (tick: () => void, intervalMs: number) => ContinuationTimerHandle;
  readonly clearTimer?: (handle: ContinuationTimerHandle) => void;
  /** Observes each ephemeral step. Purely informational; it can commit nothing. */
  readonly onStep?: (result: PreviewResult) => void;
}

export interface ForwardContinuation {
  /** One deliberate forward step. The whole of the semantics, without any timer at all. */
  step(bounds: TemporalBounds): PreviewResult;
  /**
   * Begin a held continuation: one step now, then one per interval. `readBounds` is re-read on
   * every tick, so an `LH` that advances mid-hold is respected and a replaced Session is caught.
   */
  begin(readBounds: () => TemporalBounds): PreviewResult;
  /** Stop advancing and LEAVE the target in place. Commits nothing and cancels nothing. */
  hold(): void;
  /** Input cancellation: stop advancing and discard the ephemeral target. Nothing canonical moves. */
  abort(): PreviewResult;
  readonly running: boolean;
}

export function createForwardContinuation(preview: TemporalPreviewController, options: ForwardContinuationOptions = {}): ForwardContinuation {
  const intervalMs = options.intervalMs ?? FORWARD_CONTINUATION_INTERVAL_MS;
  const setTimer = options.setTimer ?? ((tick, ms) => setInterval(tick, ms));
  const clearTimer = options.clearTimer ?? ((handle) => clearInterval(handle as ReturnType<typeof setInterval>));
  const onStep = options.onStep;

  let handle: ContinuationTimerHandle | null = null;

  function stop(): void {
    if (handle === null) return;
    clearTimer(handle);
    handle = null;
  }

  function step(bounds: TemporalBounds): PreviewResult {
    const result = preview.stepForward(bounds);
    onStep?.(result);
    return result;
  }

  return {
    step,
    begin(readBounds) {
      stop();
      const first = step(readBounds());
      // A refusal never starts a repetition: if the first step is not legitimate, no later one is
      // going to become legitimate by being retried on a timer.
      if (first.outcome === 'REJECTED') return first;
      handle = setTimer(() => {
        const result = step(readBounds());
        // Holding at the Live Head keeps the timer alive but changes nothing, so the reader can
        // simply keep holding; a refusal — a replaced Session, a lost Live Head — stops it.
        if (result.outcome === 'REJECTED') stop();
      }, intervalMs);
      return first;
    },
    hold: stop,
    abort() {
      stop();
      return preview.cancel();
    },
    get running() {
      return handle !== null;
    },
  };
}
