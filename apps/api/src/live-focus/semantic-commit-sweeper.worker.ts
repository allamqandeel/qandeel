// S8B-07 RB-2 / S2 (Alternative A, PO direction D-S2-12, provisional; execution scope v1.2) - the bounded recovery
// sweeper of migration 0201's semantic commit instants.
//
// The ONLY observation the API makes: 0201's `server_observe_unobserved_semantic_commits_v1(limit)`, through the
// repository's one method. Nothing calls 0201's per-Session observer, nothing observes after a commit, and nothing runs
// inside a semantic commit's transaction: each round is its own RPC, on this worker's own timer.
//
//   activation   opt-in, OFF by default everywhere: only SEMANTIC_COMMIT_SWEEP_ENABLED=true (exactly) turns it on, never a
//                credential, NODE_ENV or anything else; enabled without the server channel it stays OFF (`misconfigured`).
//                A function the database does not have (0201 not installed: PGRST202 / 42883) or may not run (42501) turns
//                it OFF for the life of the process, counted once (`unavailable`), with no further request.
//   bounds       a tick runs at most `rounds` statements of at most `batch` rows (ceilings 500 / 10), starts no statement
//                after its time budget, and never overlaps the previous tick. The batch bounds the ROWS of a statement,
//                never its duration (scope v1.2 §2.1); each call's wait is bounded by its client timeout. A failure is
//                retried only by the next tick.
//   priority     Live Voice first: before every statement the tick yields when this instance's background work was refused
//                a shared permit within the hold (L2's critical window, or the capacity a live reply shrinks). Nothing on
//                the voice path is touched; the signal is the permit gate's existing observer.
//   signals      C-2 by name only - WORK_FOUND, DRAINED_VISIBLE, CAPACITY_REACHED, yielded, UNKNOWN - and the C-3.2
//                detectors. A full batch does not prove that more rows remain, a drained round says nothing of rows
//                locked by others (SKIP LOCKED) or not yet committed, and no count or age of pending rows is ever
//                stated: that read is OR-1, open before any hosted activation.
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataApiError, readDataApiUpstreamIdentity } from '../conversation/supabase-data-api.service';
import type { BackgroundPermitObserver, BackgroundPermitWait, BackgroundWorkKind } from '../live-analysis/background-permits';
import { classifyOperationalFailure } from '../observability/operational-failure';
import type { TelemetryService } from '../observability/telemetry.service';
import type { SemanticCommitSweepBoundary } from './conversation-semantic-runtime.repository';

export const SEMANTIC_COMMIT_SWEEP_PRESSURE = Symbol('SEMANTIC_COMMIT_SWEEP_PRESSURE');

/** D-RB2-4: ceilings, never exceeded by any configuration. */
export const SEMANTIC_COMMIT_SWEEP_CEILINGS = Object.freeze({ batch: 500, rounds: 10 });

/** The shipped settings: 30 s provisional (D-RB2-4); batch, rounds and budget from the bounded load proof (A-11). */
export const SEMANTIC_COMMIT_SWEEP_DEFAULTS = Object.freeze({
  intervalMs: 30_000,
  batch: 500,
  rounds: 10,
  tickBudgetMs: 2_000,
  statementTimeoutMs: 2_000,
});

/** What a configuration may name; anything outside keeps the default. */
export const SEMANTIC_COMMIT_SWEEP_BOUNDS = Object.freeze({
  intervalMs: [1_000, 600_000],
  batch: [1, SEMANTIC_COMMIT_SWEEP_CEILINGS.batch],
  rounds: [1, SEMANTIC_COMMIT_SWEEP_CEILINGS.rounds],
  tickBudgetMs: [100, 10_000],
  statementTimeoutMs: [100, 5_000],
} as const);

export interface SemanticCommitSweepDetectors {
  readonly noOpportunityMs: number;
  readonly ceilingTicks: number;
  readonly failingTicks: number;
}

/** C-3.2 thresholds (D-S2-11, provisional). */
export const SEMANTIC_COMMIT_SWEEP_DETECTORS: SemanticCommitSweepDetectors = Object.freeze({ noOpportunityMs: 600_000, ceilingTicks: 5, failingTicks: 3 });

/** How long one refused permit keeps the sweeper yielding: a waiting acquire asks again at least every 500 ms. */
export const BACKGROUND_PRESSURE_HOLD_MS = 5_000;

export interface SemanticCommitSweepConfig {
  readonly enabled: boolean;
  readonly misconfigured: boolean;
  readonly intervalMs: number;
  readonly batch: number;
  readonly rounds: number;
  readonly tickBudgetMs: number;
  readonly statementTimeoutMs: number;
  readonly detectors: SemanticCommitSweepDetectors;
}

type Setting = keyof typeof SEMANTIC_COMMIT_SWEEP_BOUNDS;
const ENV: Readonly<Record<Setting, string>> = {
  intervalMs: 'SEMANTIC_COMMIT_SWEEP_INTERVAL_MS',
  batch: 'SEMANTIC_COMMIT_SWEEP_BATCH',
  rounds: 'SEMANTIC_COMMIT_SWEEP_ROUNDS',
  tickBudgetMs: 'SEMANTIC_COMMIT_SWEEP_TICK_BUDGET_MS',
  statementTimeoutMs: 'SEMANTIC_COMMIT_SWEEP_STATEMENT_TIMEOUT_MS',
};

function bounded(setting: Setting, raw: string | undefined): number {
  const [min, max] = SEMANTIC_COMMIT_SWEEP_BOUNDS[setting];
  const value = raw !== undefined && /^\d{1,9}$/u.test(raw) ? Number(raw) : Number.NaN;
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : SEMANTIC_COMMIT_SWEEP_DEFAULTS[setting];
}

/**
 * D-S2-5: the one flag, exactly `true`, and nothing else. A test process never starts it from the environment: tests
 * construct the worker with their own configuration.
 */
export function semanticCommitSweepConfig(env: NodeJS.ProcessEnv): SemanticCommitSweepConfig {
  const requested = env.SEMANTIC_COMMIT_SWEEP_ENABLED === 'true' && env.NODE_ENV !== 'test';
  const channel = !!env.SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    enabled: requested && channel,
    misconfigured: requested && !channel,
    intervalMs: bounded('intervalMs', env[ENV.intervalMs]),
    batch: bounded('batch', env[ENV.batch]),
    rounds: bounded('rounds', env[ENV.rounds]),
    tickBudgetMs: bounded('tickBudgetMs', env[ENV.tickBudgetMs]),
    statementTimeoutMs: bounded('statementTimeoutMs', env[ENV.statementTimeoutMs]),
    detectors: SEMANTIC_COMMIT_SWEEP_DETECTORS,
  };
}

/**
 * This instance's background demand, as the shared permit gate already reports it (its observer): a unit of background
 * work that had to wait - L2's critical window while a live reply has nothing heard yet, or the capacity a live reply
 * shrinks - or gave up waiting. A person's own limit is not capacity and does not count. Never throws: it is called inside
 * the gate's acquire loop.
 */
export class BackgroundPermitPressure implements BackgroundPermitObserver {
  private lastAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly now: () => number = Date.now, private readonly holdMs: number = BACKGROUND_PRESSURE_HOLD_MS) {}

  waited(_kind: BackgroundWorkKind, reason: BackgroundPermitWait): void {
    if (reason !== 'WAIT_USER_LIMIT') this.lastAt = this.now();
  }

  timedOut(): void {
    this.lastAt = this.now();
  }

  pressing(): boolean {
    return this.now() - this.lastAt < this.holdMs;
  }
}

export type SemanticCommitSweepTick = 'drained_visible' | 'capacity_reached' | 'yielded' | 'unknown';
type Operation = 'activation' | 'sweep_round' | 'sweep_tick' | 'detector';
const DOMAIN = 'SEMANTIC_COMMIT_OBSERVATION';

/** The database has no such function (0201 is not installed) or the role may not run it. */
function unavailable(error: unknown): boolean {
  if (!(error instanceof DataApiError)) return false;
  const { databaseCode } = readDataApiUpstreamIdentity(error);
  return databaseCode === 'PGRST202' || databaseCode === '42883' || databaseCode === '42501';
}

export interface SemanticCommitSweeperClock {
  readonly now: () => number;
  readonly random: () => number;
}

export class SemanticCommitSweeperWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private starter: NodeJS.Timeout | undefined;
  private running = false;
  private stopped = false;
  private off = false;
  private capacityTicks = 0;
  private failedTicks = 0;
  private lastOpportunityAt: number;

  constructor(
    private readonly sweeps: SemanticCommitSweepBoundary,
    private readonly telemetry: Pick<TelemetryService, 'recordOperationalOutcome'>,
    private readonly pressure: Pick<BackgroundPermitPressure, 'pressing'>,
    private readonly config: SemanticCommitSweepConfig,
    private readonly clock: SemanticCommitSweeperClock = { now: Date.now, random: Math.random },
  ) {
    this.lastOpportunityAt = clock.now();
  }

  get enabled(): boolean {
    return this.config.enabled && !this.off && !this.stopped;
  }

  onModuleInit(): void {
    if (this.config.misconfigured) this.signal('activation', 'misconfigured');
    if (!this.enabled || this.timer || this.starter) return;
    this.signal('activation', 'enabled');
    this.lastOpportunityAt = this.clock.now();
    // A restart's first tick comes after a short jitter, so instances started together do not sweep in step.
    const jitter = Math.round(1_000 + this.clock.random() * Math.min(4_000, this.config.intervalMs));
    this.starter = setTimeout(() => {
      this.starter = undefined;
      if (!this.enabled) return;
      this.timer = setInterval(() => void this.runOnce(), this.config.intervalMs);
      this.timer.unref();
      void this.runOnce();
    }, jitter);
    this.starter.unref();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    this.halt();
  }

  /**
   * One tick; never throws, never overlaps the previous one. Returns the tick's C-2 signal, or null when no tick ran (one
   * still running, stopped, or OFF).
   */
  async runOnce(): Promise<SemanticCommitSweepTick | null> {
    if (this.running || !this.enabled) return null;
    this.running = true;
    try {
      const tick = await this.tick();
      this.detect(tick);
      return tick;
    } finally {
      this.running = false;
    }
  }

  private async tick(): Promise<SemanticCommitSweepTick> {
    const { batch, rounds, tickBudgetMs, statementTimeoutMs } = this.config;
    const started = this.clock.now();
    let done = 0;
    for (;;) {
      if (!this.enabled) return 'unknown';
      if (this.pressure.pressing()) return this.close('yielded');
      // The ceilings and the budget end a tick; only a full last statement makes it CAPACITY_REACHED, and that still does
      // not prove another batch remains.
      if (done >= rounds || this.clock.now() - started >= tickBudgetMs) return this.close('capacity_reached');
      let stamped: number;
      try {
        stamped = await this.sweeps.sweepUnobservedSemanticCommits(batch, statementTimeoutMs);
      } catch (error) {
        return this.failed(error);
      }
      done += 1;
      this.lastOpportunityAt = this.clock.now();
      if (stamped > 0) this.signal('sweep_round', 'work_found');
      if (stamped < batch) {
        this.signal('sweep_round', 'drained_visible');
        return this.close('drained_visible');
      }
    }
  }

  private close(tick: SemanticCommitSweepTick): SemanticCommitSweepTick {
    if (tick === 'capacity_reached') this.capacityTicks += 1;
    if (tick === 'drained_visible') this.capacityTicks = 0;
    if (tick === 'capacity_reached' || tick === 'drained_visible') this.failedTicks = 0;
    this.signal('sweep_tick', tick);
    return tick;
  }

  private failed(error: unknown): SemanticCommitSweepTick {
    if (unavailable(error)) {
      // Fail closed, once: no further request from this process.
      this.off = true;
      this.halt();
      this.signal('activation', 'unavailable');
    } else {
      this.signal('sweep_round', classifyOperationalFailure(error) === 'TRANSPORT' ? 'transport_failure' : 'integrity_failure');
      this.failedTicks += 1;
    }
    this.signal('sweep_tick', 'unknown');
    return 'unknown';
  }

  /** C-3.2: suspected non-progress, emitted on every tick while it holds. Proving it needs OR-1's read. */
  private detect(tick: SemanticCommitSweepTick): void {
    if (this.off) return;
    const { detectors } = this.config;
    if (this.capacityTicks >= detectors.ceilingTicks) this.signal('detector', 'ceiling_sustained');
    if (this.failedTicks >= detectors.failingTicks) this.signal('detector', 'sweep_failing');
    if (tick !== 'drained_visible' && this.clock.now() - this.lastOpportunityAt > detectors.noOpportunityMs) this.signal('detector', 'no_sweep_opportunity');
  }

  private halt(): void {
    if (this.starter) clearTimeout(this.starter);
    if (this.timer) clearInterval(this.timer);
    this.starter = undefined;
    this.timer = undefined;
  }

  /** The closed outcome; no row, Session, count, age, error text or database code can be passed here. */
  private signal(operation: Operation, outcome: string): void {
    try {
      this.telemetry.recordOperationalOutcome(DOMAIN, operation, outcome);
    } catch {
      // Losing a signal is acceptable; it never alters a sweep.
    }
  }
}
