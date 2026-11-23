import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataApiError } from '../conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { DatabaseBackgroundPermitGate } from '../live-analysis/background-permits';
import { ConversationSemanticRuntimeRepository } from './conversation-semantic-runtime.repository';
import {
  BACKGROUND_PRESSURE_HOLD_MS,
  BackgroundPermitPressure,
  SEMANTIC_COMMIT_SWEEP_CEILINGS,
  SEMANTIC_COMMIT_SWEEP_DEFAULTS,
  SEMANTIC_COMMIT_SWEEP_DETECTORS,
  SemanticCommitSweeperWorker,
  semanticCommitSweepConfig,
  type SemanticCommitSweepConfig,
} from './semantic-commit-sweeper.worker';

// S8B-07 RB-2 / S2 (Alternative A): the sweeper's activation (A-01), bounds, yielding, failure handling, C-2 signals
// (A-09) and C-3.2 detectors, with a fake sweep boundary. The real-PostgreSQL proofs are database/prove-rb2-s2-sweeper.mjs.

const CHANNEL = { SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-value' };

function config(overrides: Partial<SemanticCommitSweepConfig> = {}): SemanticCommitSweepConfig {
  return { ...semanticCommitSweepConfig({ ...CHANNEL, SEMANTIC_COMMIT_SWEEP_ENABLED: 'true', NODE_ENV: 'production' }), ...overrides };
}

function harness(answers: Array<number | Error>, overrides: Partial<SemanticCommitSweepConfig> = {}) {
  let t = 0;
  const clock = { now: () => t, random: () => 0 };
  const sweep = jest.fn(async (_limit: number, _timeoutMs: number) => {
    const next = answers.length > 1 ? answers.shift() : answers[0];
    if (next instanceof Error) throw next;
    return next as number;
  });
  const recordOperationalOutcome = jest.fn();
  let pressing = false;
  const worker = new SemanticCommitSweeperWorker(
    { sweepUnobservedSemanticCommits: sweep },
    { recordOperationalOutcome },
    { pressing: () => pressing },
    config(overrides),
    clock,
  );
  return {
    worker,
    sweep,
    signals: () => recordOperationalOutcome.mock.calls.map((c: unknown[]) => c.slice(1).join(':')),
    recordOperationalOutcome,
    advance: (ms: number) => { t += ms; },
    press: (value: boolean) => { pressing = value; },
  };
}

describe('RB-2 / S2 activation (A-01): opt-in, OFF by default everywhere', () => {
  /** Every activation rule, as a list of what a config function gets wrong. */
  function violations(fn: typeof semanticCommitSweepConfig): string[] {
    const out: string[] = [];
    const on = (env: NodeJS.ProcessEnv) => fn(env).enabled;
    if (on({})) out.push('enabled with nothing set');
    if (on({ ...CHANNEL })) out.push('enabled by credentials alone');
    if (on({ ...CHANNEL, NODE_ENV: 'production' })) out.push('enabled by NODE_ENV');
    for (const value of ['TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', '']) {
      if (on({ ...CHANNEL, SEMANTIC_COMMIT_SWEEP_ENABLED: value })) out.push(`enabled by ${JSON.stringify(value)}`);
    }
    if (on({ ...CHANNEL, SEMANTIC_COMMIT_SWEEP_ENABLED: 'true', NODE_ENV: 'test' })) out.push('enabled in a test process from the environment');
    if (!on({ ...CHANNEL, SEMANTIC_COMMIT_SWEEP_ENABLED: 'true' })) out.push('exact true with the channel does not enable');
    const bare = fn({ SEMANTIC_COMMIT_SWEEP_ENABLED: 'true' });
    if (bare.enabled || !bare.misconfigured) out.push('enabled without the server channel, or not reported misconfigured');
    if (fn({ ...CHANNEL }).misconfigured) out.push('misconfigured when never requested');
    return out;
  }

  it('the shipped activation has no violation', () => {
    expect(violations(semanticCommitSweepConfig)).toEqual([]);
  });

  it('PLANTED: an activation that enables on credentials is caught', () => {
    const planted: typeof semanticCommitSweepConfig = (env) => ({ ...semanticCommitSweepConfig(env), enabled: !!env.SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY });
    expect(violations(planted)).toEqual(expect.arrayContaining(['enabled by credentials alone']));
  });

  it('settings stay inside the ceilings; anything else keeps the default', () => {
    const base = { ...CHANNEL, SEMANTIC_COMMIT_SWEEP_ENABLED: 'true' };
    expect(semanticCommitSweepConfig(base)).toMatchObject(SEMANTIC_COMMIT_SWEEP_DEFAULTS);
    expect(SEMANTIC_COMMIT_SWEEP_DEFAULTS.batch).toBeLessThanOrEqual(SEMANTIC_COMMIT_SWEEP_CEILINGS.batch);
    expect(SEMANTIC_COMMIT_SWEEP_DEFAULTS.rounds).toBeLessThanOrEqual(SEMANTIC_COMMIT_SWEEP_CEILINGS.rounds);
    for (const [key, value] of [['SEMANTIC_COMMIT_SWEEP_BATCH', '501'], ['SEMANTIC_COMMIT_SWEEP_BATCH', '0'], ['SEMANTIC_COMMIT_SWEEP_BATCH', '1000'],
      ['SEMANTIC_COMMIT_SWEEP_ROUNDS', '11'], ['SEMANTIC_COMMIT_SWEEP_ROUNDS', '-1'], ['SEMANTIC_COMMIT_SWEEP_INTERVAL_MS', '999'],
      ['SEMANTIC_COMMIT_SWEEP_BATCH', '2.5'], ['SEMANTIC_COMMIT_SWEEP_BATCH', '1e3'], ['SEMANTIC_COMMIT_SWEEP_TICK_BUDGET_MS', '99999']] as const) {
      const c = semanticCommitSweepConfig({ ...base, [key]: value });
      expect([c.batch, c.rounds, c.intervalMs, c.tickBudgetMs]).toEqual([SEMANTIC_COMMIT_SWEEP_DEFAULTS.batch, SEMANTIC_COMMIT_SWEEP_DEFAULTS.rounds,
        SEMANTIC_COMMIT_SWEEP_DEFAULTS.intervalMs, SEMANTIC_COMMIT_SWEEP_DEFAULTS.tickBudgetMs]);
    }
    expect(semanticCommitSweepConfig({ ...base, SEMANTIC_COMMIT_SWEEP_BATCH: '200', SEMANTIC_COMMIT_SWEEP_ROUNDS: '4' })).toMatchObject({ batch: 200, rounds: 4 });
  });

  it('a disabled worker schedules nothing and sends nothing; a misconfigured one says so once and stays OFF', () => {
    jest.useFakeTimers();
    try {
      const sweep = jest.fn();
      const recordOperationalOutcome = jest.fn();
      const off = new SemanticCommitSweeperWorker({ sweepUnobservedSemanticCommits: sweep }, { recordOperationalOutcome }, { pressing: () => false },
        semanticCommitSweepConfig({ ...CHANNEL }));
      off.onModuleInit();
      jest.advanceTimersByTime(10 * 60_000);
      expect(sweep).not.toHaveBeenCalled();
      expect(recordOperationalOutcome).not.toHaveBeenCalled();
      const bad = new SemanticCommitSweeperWorker({ sweepUnobservedSemanticCommits: sweep }, { recordOperationalOutcome }, { pressing: () => false },
        semanticCommitSweepConfig({ SEMANTIC_COMMIT_SWEEP_ENABLED: 'true' }));
      bad.onModuleInit();
      jest.advanceTimersByTime(10 * 60_000);
      expect(sweep).not.toHaveBeenCalled();
      expect(recordOperationalOutcome.mock.calls).toEqual([['SEMANTIC_COMMIT_OBSERVATION', 'activation', 'misconfigured']]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('enabled: the first tick after a 1 - 5 s jitter, then one per interval; destroy stops every timer', async () => {
    jest.useFakeTimers();
    try {
      const h = harness([0], { intervalMs: 30_000 });
      h.worker.onModuleInit();
      jest.advanceTimersByTime(999);
      expect(h.sweep).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      expect(h.sweep).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(30_000);
      expect(h.sweep).toHaveBeenCalledTimes(2);
      h.worker.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(10 * 30_000);
      expect(h.sweep).toHaveBeenCalledTimes(2);
      expect(await h.worker.runOnce()).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('a factory provider gets its lifecycle hooks from Nest (the ConversationModule registration shape)', async () => {
    const h = harness([0]);
    const init = jest.spyOn(h.worker, 'onModuleInit').mockImplementation(() => undefined);
    const destroy = jest.spyOn(h.worker, 'onModuleDestroy');
    @Module({ providers: [{ provide: SemanticCommitSweeperWorker, useFactory: () => h.worker }] })
    class Probe {}
    const app = await Test.createTestingModule({ imports: [Probe] }).compile();
    await app.init();
    expect(init).toHaveBeenCalledTimes(1);
    await app.close();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});

describe('RB-2 / S2 ticks: bounded, never overlapping, C-2 signals by name only (A-09)', () => {
  it('a partial round is WORK_FOUND and DRAINED_VISIBLE and ends the tick; an empty one is DRAINED_VISIBLE only', async () => {
    const h = harness([3], { batch: 500 });
    expect(await h.worker.runOnce()).toBe('drained_visible');
    expect(h.sweep.mock.calls).toEqual([[500, SEMANTIC_COMMIT_SWEEP_DEFAULTS.statementTimeoutMs]]);
    expect(h.signals()).toEqual(['sweep_round:work_found', 'sweep_round:drained_visible', 'sweep_tick:drained_visible']);
    const e = harness([0]);
    await e.worker.runOnce();
    expect(e.signals()).toEqual(['sweep_round:drained_visible', 'sweep_tick:drained_visible']);
  });

  it('full rounds stop at the rounds ceiling: CAPACITY_REACHED, which claims no backlog', async () => {
    const h = harness([50], { batch: 50, rounds: 3 });
    expect(await h.worker.runOnce()).toBe('capacity_reached');
    expect(h.sweep).toHaveBeenCalledTimes(3);
    expect(h.signals()).toEqual(['sweep_round:work_found', 'sweep_round:work_found', 'sweep_round:work_found', 'sweep_tick:capacity_reached']);
  });

  it('the time budget starts no further statement', async () => {
    const h = harness([50], { batch: 50, rounds: 10, tickBudgetMs: 1_000 });
    h.sweep.mockImplementation(async () => { h.advance(600); return 50; });
    expect(await h.worker.runOnce()).toBe('capacity_reached');
    expect(h.sweep).toHaveBeenCalledTimes(2);
  });

  it('Live Voice first: under permit pressure no statement runs; pressure after a round stops the tick', async () => {
    const h = harness([50], { batch: 50, rounds: 10 });
    h.press(true);
    expect(await h.worker.runOnce()).toBe('yielded');
    expect(h.sweep).not.toHaveBeenCalled();
    h.press(false);
    h.sweep.mockImplementation(async () => { h.press(true); return 50; });
    expect(await h.worker.runOnce()).toBe('yielded');
    expect(h.sweep).toHaveBeenCalledTimes(1);
    expect(h.signals()).toEqual(['sweep_tick:yielded', 'sweep_round:work_found', 'sweep_tick:yielded']);
  });

  it('PLANTED: a tick that ignores the pressure is caught by the same check', async () => {
    const h = harness([50], { batch: 50, rounds: 2 });
    h.press(true);
    // The planted defect: the same worker, given a pressure source that never reports.
    const ignoring = new SemanticCommitSweeperWorker({ sweepUnobservedSemanticCommits: h.sweep }, { recordOperationalOutcome: jest.fn() }, { pressing: () => false }, config({ batch: 50, rounds: 2 }));
    await h.worker.runOnce();
    expect(h.sweep).not.toHaveBeenCalled();
    await ignoring.runOnce();
    expect(h.sweep).toHaveBeenCalledTimes(2);
  });

  it('never overlaps: a tick asked for while one runs does nothing', async () => {
    const h = harness([0]);
    let release: (value: number) => void = () => undefined;
    h.sweep.mockImplementationOnce(() => new Promise<number>((r) => { release = r; }));
    const first = h.worker.runOnce();
    expect(await h.worker.runOnce()).toBeNull();
    release(0);
    expect(await first).toBe('drained_visible');
    expect(h.sweep).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a Data API 503', new DataApiError(503), 'transport_failure'],
    ['a client timeout', Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' }), 'transport_failure'],
    ['a malformed answer', new Error('SEMANTIC_COMMIT_SWEEP_INTEGRITY'), 'integrity_failure'],
    ['a Data API 400', new DataApiError(400), 'integrity_failure'],
  ])('%s: the tick is UNKNOWN, nothing is retried inside it, the next tick asks again', async (_c, error, outcome) => {
    const h = harness([error, 0]);
    expect(await h.worker.runOnce()).toBe('unknown');
    expect(h.sweep).toHaveBeenCalledTimes(1);
    expect(h.signals()).toEqual([`sweep_round:${outcome}`, 'sweep_tick:unknown']);
    expect(await h.worker.runOnce()).toBe('drained_visible');
    expect(h.sweep).toHaveBeenCalledTimes(2);
  });

  it.each(['PGRST202', '42883', '42501'])('0201 absent or not executable (%s): OFF for the process, counted once, no further request', async (databaseCode) => {
    jest.useFakeTimers();
    try {
      const h = harness([new DataApiError(404, { databaseCode })]);
      h.worker.onModuleInit();
      await jest.advanceTimersByTimeAsync(5_000);
      expect(h.sweep).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(10 * 30_000);
      expect(await h.worker.runOnce()).toBeNull();
      expect(h.sweep).toHaveBeenCalledTimes(1);
      expect(h.signals()).toEqual(['activation:enabled', 'activation:unavailable', 'sweep_tick:unknown']);
      expect(h.worker.enabled).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a throwing telemetry never alters a sweep', async () => {
    const h = harness([10]);
    h.recordOperationalOutcome.mockImplementation(() => { throw new Error('meter down'); });
    expect(await h.worker.runOnce()).toBe('drained_visible');
  });

  it('every signal is a closed name: no number, row, Session or error text', async () => {
    const h = harness([500, 500, 7, new DataApiError(503), 0], { batch: 500, rounds: 10 });
    for (let i = 0; i < 4; i += 1) await h.worker.runOnce();
    for (const call of h.recordOperationalOutcome.mock.calls) {
      expect(call).toHaveLength(3);
      expect(call.every((v: unknown) => typeof v === 'string' && /^[A-Za-z_]+$/u.test(v))).toBe(true);
    }
  });
});

describe('RB-2 / S2 C-3.2 detectors: suspected non-progress, emitted while it holds', () => {
  const D = SEMANTIC_COMMIT_SWEEP_DETECTORS;

  it(`CEILING_SUSTAINED from the ${D.ceilingTicks}th consecutive CAPACITY_REACHED; a drained tick resets it`, async () => {
    const h = harness([20], { batch: 20, rounds: 1 });
    for (let i = 1; i <= D.ceilingTicks + 1; i += 1) {
      await h.worker.runOnce();
      expect(h.signals().filter((s) => s === 'detector:ceiling_sustained')).toHaveLength(Math.max(0, i - D.ceilingTicks + 1));
    }
    h.sweep.mockResolvedValue(3);
    await h.worker.runOnce();
    h.sweep.mockResolvedValue(20);
    await h.worker.runOnce();
    expect(h.signals().filter((s) => s === 'detector:ceiling_sustained')).toHaveLength(2);
  });

  it(`SWEEP_FAILING from the ${D.failingTicks}rd consecutive failed tick; rows stay PENDING, nothing is retried in a loop`, async () => {
    const h = harness([new DataApiError(503)]);
    for (let i = 0; i < D.failingTicks; i += 1) await h.worker.runOnce();
    expect(h.sweep).toHaveBeenCalledTimes(D.failingTicks);
    expect(h.signals().filter((s) => s === 'detector:sweep_failing')).toHaveLength(1);
  });

  it('NO_SWEEP_OPPORTUNITY once no round has run for the threshold while the tick yields', async () => {
    const h = harness([0]);
    h.press(true);
    await h.worker.runOnce();
    h.advance(D.noOpportunityMs + 1);
    await h.worker.runOnce();
    expect(h.signals()).toEqual(['sweep_tick:yielded', 'sweep_tick:yielded', 'detector:no_sweep_opportunity']);
    h.press(false);
    await h.worker.runOnce();
    expect(h.signals().filter((s) => s === 'detector:no_sweep_opportunity')).toHaveLength(1);
  });
});

describe('RB-2 / S2 Live Voice pressure: the permit gate\'s existing observer', () => {
  it('a capacity or critical-window wait, or a timeout, holds the pressure; a person\'s own limit does not', () => {
    let t = 0;
    const p = new BackgroundPermitPressure(() => t);
    expect(p.pressing()).toBe(false);
    p.waited('CALL_ANALYSIS', 'WAIT_USER_LIMIT');
    expect(p.pressing()).toBe(false);
    p.waited('CALL_ANALYSIS', 'WAIT_CRITICAL_WINDOW');
    expect(p.pressing()).toBe(true);
    t += BACKGROUND_PRESSURE_HOLD_MS;
    expect(p.pressing()).toBe(false);
    p.waited('TEXT_SEMANTIC_ANALYSIS', 'WAIT_CAPACITY');
    t += BACKGROUND_PRESSURE_HOLD_MS - 1;
    expect(p.pressing()).toBe(true);
    t += 1;
    p.timedOut();
    expect(p.pressing()).toBe(true);
  });

  it('wired into the real DatabaseBackgroundPermitGate: a waited permit makes the sweeper yield', async () => {
    const pressure = new BackgroundPermitPressure();
    const rpc = jest.fn()
      .mockResolvedValueOnce([{ outcome: 'WAIT_CAPACITY' }])
      .mockResolvedValueOnce([{ outcome: 'GRANTED' }])
      .mockResolvedValue(undefined);
    const gate = new DatabaseBackgroundPermitGate({ rpc } as unknown as Pick<SupabaseServiceRoleApiService, 'rpc'>, { observer: pressure, sleep: async () => undefined });
    const permit = await gate.acquire('00000000-0000-4000-8000-000000000001', 'CALL_ANALYSIS', { respectCriticalWindow: true, maxWaitMs: 1_000 });
    await permit?.release();
    const sweep = jest.fn(async () => 0);
    const worker = new SemanticCommitSweeperWorker({ sweepUnobservedSemanticCommits: sweep }, { recordOperationalOutcome: jest.fn() }, pressure, config());
    expect(await worker.runOnce()).toBe('yielded');
    expect(sweep).not.toHaveBeenCalled();
  });
});

describe('RB-2 / S2 repository: the one sweeper RPC', () => {
  it('calls 0201\'s sweeper with the limit and the client timeout, and reads one count', async () => {
    const rpc = jest.fn().mockResolvedValue(42);
    const repository = new ConversationSemanticRuntimeRepository({ rpc } as unknown as SupabaseServiceRoleApiService);
    await expect(repository.sweepUnobservedSemanticCommits(500, 2_000)).resolves.toBe(42);
    expect(rpc.mock.calls).toEqual([['server_observe_unobserved_semantic_commits_v1', { p_limit: 500 }, { timeoutMs: 2_000 }]]);
  });

  it('refuses a limit outside 0201\'s bounds before any request, and any answer that is not a count within the limit', async () => {
    const rpc = jest.fn();
    const repository = new ConversationSemanticRuntimeRepository({ rpc } as unknown as SupabaseServiceRoleApiService);
    for (const limit of [0, 1001, 2.5, Number.NaN]) await expect(repository.sweepUnobservedSemanticCommits(limit, 2_000)).rejects.toThrow('SEMANTIC_COMMIT_SWEEP_LIMIT');
    expect(rpc).not.toHaveBeenCalled();
    for (const answer of [null, '3', -1, 501, 1.5, [3]]) {
      rpc.mockResolvedValueOnce(answer);
      await expect(repository.sweepUnobservedSemanticCommits(500, 2_000)).rejects.toThrow('SEMANTIC_COMMIT_SWEEP_INTEGRITY');
    }
  });
});
