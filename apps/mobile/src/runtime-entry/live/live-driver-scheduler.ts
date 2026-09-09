/**
 * T-12P §2.7 — the one owner of the catch-up cadence and its failure backoff.
 *
 * Pure arithmetic, no timers and no state beyond a failure count, so every pacing rule below is
 * provable without waiting for anything. The driver owns the clock; this owns the numbers.
 *
 * WHY 5000 ms, AND NOT AN ARBITRARY NUMBER.
 *
 *  1. Every authenticated request the driver makes costs the QANDEEL API one upstream Supabase
 *     verification, and the API gives that call a 5000 ms abort budget
 *     (`apps/api/src/auth/supabase-auth.service.ts`). Matching the cadence to that budget means at
 *     most one catch-up cycle is outstanding per verification window; a shorter cadence would let a
 *     second cycle be enqueued before the first had even been authorized.
 *  2. The catch-up routes are pull-only paged reads whose server-side page cap is 256 events. That
 *     is a recovery shape, not a per-second streaming shape, and pacing it in seconds respects what
 *     the transport was built for.
 *  3. What is being followed is committed conversational units — human conversation cadence,
 *     seconds to minutes. A sub-second poll would not make a reader see anything sooner in
 *     practice, and would multiply server cost by an order of magnitude for no perceived gain.
 *  4. There is deliberately no push channel, so this cadence is the latency floor for a reader
 *     following Live. Five seconds is the largest number that still reads as "keeping up", which is
 *     why the driver additionally catches up IMMEDIATELY on foreground resume and on explicit
 *     request rather than waiting out a tick.
 *
 * The value is a default, not a law: it is injectable, and no Product semantics depend on it. That
 * is the point — a cadence that changed meaning would be temporal authority, which this is not.
 */

/** The default foreground catch-up cadence. Justified above; injectable everywhere. */
export const FOREGROUND_CATCH_UP_INTERVAL_MS = 5_000;

/** The ceiling a backoff may reach. Beyond a minute a foreground app should look idle, not busy. */
export const MAX_CATCH_UP_BACKOFF_MS = 60_000;

export interface CatchUpSchedule {
  /** The delay before the next cycle, given how many cycles have failed back-to-back. */
  nextDelayMs(consecutiveFailures: number): number;
}

export interface CatchUpScheduleOptions {
  readonly intervalMs?: number;
  readonly maxBackoffMs?: number;
  /**
   * Returns a value in [0, 1). Injected so the jitter is provable. Jitter exists so that many
   * clients recovering from the same outage do not re-converge into a synchronised burst.
   */
  readonly random?: () => number;
}

export function createCatchUpSchedule(options: CatchUpScheduleOptions = {}): CatchUpSchedule {
  const interval = options.intervalMs ?? FOREGROUND_CATCH_UP_INTERVAL_MS;
  const ceiling = options.maxBackoffMs ?? MAX_CATCH_UP_BACKOFF_MS;
  const random = options.random ?? Math.random;
  if (!Number.isFinite(interval) || interval <= 0) throw new RangeError('the catch-up interval must be a positive number of milliseconds');
  if (!Number.isFinite(ceiling) || ceiling < interval) throw new RangeError('the backoff ceiling must be at least the interval');

  return {
    nextDelayMs(consecutiveFailures) {
      if (consecutiveFailures <= 0) return interval;
      // Exponential, capped, then jittered into [50%, 100%] of the computed delay so a retry storm
      // spreads out without any client ever waiting longer than the ceiling.
      const exponential = Math.min(interval * 2 ** (consecutiveFailures - 1), ceiling);
      const jittered = exponential * (0.5 + 0.5 * random());
      return Math.max(interval, Math.min(jittered, ceiling));
    },
  };
}
