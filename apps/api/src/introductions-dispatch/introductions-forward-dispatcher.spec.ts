import { ServiceUnavailableException } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataApiError } from '../conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import type { TelemetryService } from '../observability/telemetry.service';
import {
  FORWARD_CALL_TIMEOUT_MS, FORWARD_OUTCOMES, IntroductionsForwardAnswerError, IntroductionsForwardDispatchRepository,
  type ForwardOutcome, type UnpublishedDelivery,
} from './introductions-forward-dispatch.repository';
import {
  FORWARD_ATTEMPTS_PER_CYCLE, IntroductionsForwardDispatcherWorker, type IntroductionsDeliveryNotifier,
} from './introductions-forward-dispatcher.worker';

// S6-07 (CP2, migration 0166, CA-SYS-02) — the forward dispatcher's server pass: one single-proposal database attempt per
// call, a bounded cycle that ends at NONE_DUE, BUSY or a failure, content-free telemetry, the Activity recovery path
// (a committed delivery whose publication failed is published on a later cycle, exactly once), strict decoding of every
// answer, and a module with no controller, no route and no client token. The real-PostgreSQL proof is
// verify-migration-0166.mjs; this proves the worker's own rules.

const T = '11111111-1111-4111-8111-111111111111';
const P = '22222222-2222-4222-8222-222222222222';
const U = '33333333-3333-4333-8333-333333333333';
const delivery = (transition = T): UnpublishedDelivery => ({
  deliveryTransitionId: transition, proposalId: P, recipientUserId: U,
  candidateKey: `introductions:proposal-delivered:${transition}`, deliveredAt: '2026-10-18T10:00:00.000Z',
});
const repo = (outcomes: Array<ForwardOutcome | Error>, pending: () => UnpublishedDelivery[] = () => []) => {
  const queue = [...outcomes];
  return {
    forwardOne: jest.fn(async () => {
      const next = queue.shift() ?? 'NONE_DUE';
      if (next instanceof Error) throw next;
      return next;
    }),
    listUnpublishedDeliveries: jest.fn(async () => pending()),
  };
};
const worker = (r: ReturnType<typeof repo>, telemetry?: unknown, notifier?: IntroductionsDeliveryNotifier) =>
  new IntroductionsForwardDispatcherWorker(r as unknown as IntroductionsForwardDispatchRepository, telemetry as TelemetryService | undefined, notifier);
const recorder = () => {
  const recordOperationalOutcome = jest.fn();
  return { telemetry: { recordOperationalOutcome } as unknown as TelemetryService, recordOperationalOutcome };
};

describe('S6-07 CP2 — IntroductionsForwardDispatcherWorker: the bounded cycle', () => {
  it('attempts until NONE_DUE, one call per proposal, and counts what happened', async () => {
    const r = repo(['FORWARDED', 'SKIPPED_NOT_CLEARED', 'SKIPPED_NO_CONCLUSION', 'FORWARDED', 'HELD_INTEGRITY', 'SKIPPED_MOVED']);
    expect(await worker(r).runOnce()).toEqual({ attempts: 6, forwarded: 2, skipped: 3, busy: 0, held: 1, failed: 0, published: 0, publishFailed: 0 });
    expect(r.forwardOne).toHaveBeenCalledTimes(7);
  });

  it('never makes more than FORWARD_ATTEMPTS_PER_CYCLE attempts in one cycle', async () => {
    const r = repo(Array.from({ length: 50 }, () => 'FORWARDED' as const));
    const summary = await worker(r).runOnce();
    expect(summary.forwarded).toBe(FORWARD_ATTEMPTS_PER_CYCLE);
    expect(r.forwardOne).toHaveBeenCalledTimes(FORWARD_ATTEMPTS_PER_CYCLE);
  });

  it('ends the cycle at BUSY: a held pair is the next cycle\'s, never a tight loop', async () => {
    const r = repo(['FORWARDED', 'BUSY', 'FORWARDED']);
    expect(await worker(r).runOnce()).toMatchObject({ attempts: 2, forwarded: 1, busy: 1 });
    expect(r.forwardOne).toHaveBeenCalledTimes(2);
  });

  it('ends the cycle at a failure and never throws', async () => {
    const r = repo([new ServiceUnavailableException('down'), 'FORWARDED']);
    await expect(worker(r).runOnce()).resolves.toMatchObject({ attempts: 0, failed: 1 });
    expect(r.forwardOne).toHaveBeenCalledTimes(1);
  });

  it('is single-flight: a cycle in progress is not doubled', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const r = repo([]);
    r.forwardOne.mockImplementationOnce(async () => { await gate; return 'NONE_DUE'; });
    const w = worker(r);
    const first = w.runOnce();
    expect(await w.runOnce()).toMatchObject({ attempts: 0 });
    release();
    await first;
    expect(r.forwardOne).toHaveBeenCalledTimes(1);
  });

  it('is off under tests, without the server channel, and when switched off; it holds no timer then', () => {
    expect(worker(repo([])).enabled).toBe(false);
    const saved = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://example.invalid';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
      expect(worker(repo([])).enabled).toBe(true);
      process.env.INTRODUCTIONS_FORWARD_DISPATCH_DISABLED = 'true';
      expect(worker(repo([])).enabled).toBe(false);
      delete process.env.INTRODUCTIONS_FORWARD_DISPATCH_DISABLED;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      expect(worker(repo([])).enabled).toBe(false);
    } finally {
      process.env = saved;
    }
    const w = worker(repo([]));
    w.onModuleInit();
    expect((w as unknown as { timer?: unknown }).timer).toBeUndefined();
    w.onModuleDestroy();
  });
});

describe('S6-07 CP2 — content-free telemetry', () => {
  it('maps every outcome to one finite label and never emits for NONE_DUE', async () => {
    const { telemetry, recordOperationalOutcome } = recorder();
    await worker(repo(['FORWARDED', 'SKIPPED_MOVED', 'SKIPPED_DELETION_PENDING', 'SKIPPED_NO_CONCLUSION', 'SKIPPED_NOT_CLEARED',
      'SKIPPED_NOT_READY', 'SKIPPED_STALE', 'HELD_INTEGRITY', 'BUSY']), telemetry).runOnce();
    expect(recordOperationalOutcome.mock.calls).toEqual([
      ['INTRODUCTIONS_FORWARD', 'dispatch', 'success'],
      ['INTRODUCTIONS_FORWARD', 'dispatch', 'superseded_expected'],
      ['INTRODUCTIONS_FORWARD', 'dispatch', 'blocked_expected'],
      ['INTRODUCTIONS_FORWARD', 'dispatch', 'blocked_expected'],
      ['INTRODUCTIONS_FORWARD', 'dispatch', 'blocked_expected'],
      ['INTRODUCTIONS_FORWARD', 'dispatch', 'blocked_expected'],
      ['INTRODUCTIONS_FORWARD', 'dispatch', 'blocked_expected'],
      ['INTRODUCTIONS_FORWARD', 'dispatch', 'integrity_failure'],
      ['INTRODUCTIONS_FORWARD', 'dispatch', 'retry_expected'],
    ]);
    recordOperationalOutcome.mockClear();
    await worker(repo([]), telemetry).runOnce();
    expect(recordOperationalOutcome).not.toHaveBeenCalled();
  });

  it('classifies a failure by its kind only, and a throwing meter changes nothing', async () => {
    const { telemetry, recordOperationalOutcome } = recorder();
    await worker(repo([new DataApiError(503)]), telemetry).runOnce();
    await worker(repo([new DataApiError(400)]), telemetry).runOnce();
    await worker(repo([new IntroductionsForwardAnswerError()]), telemetry).runOnce();
    expect(recordOperationalOutcome.mock.calls.map((c) => c[2])).toEqual(['transport_failure', 'integrity_failure', 'integrity_failure']);
    const failing = { recordOperationalOutcome: () => { throw new Error('meter down'); } };
    await expect(worker(repo(['FORWARDED']), failing).runOnce()).resolves.toMatchObject({ forwarded: 1 });
  });
});

// RE-ANCHORED by S6-07 (CP3): the notifier also publishes the other Introductions events (0167); none here.
const NO_EVENTS = () => jest.fn().mockResolvedValue({ published: 0, failed: 0 });

describe('S6-07 CP2 — the Activity recovery path (the notifier itself is CP3)', () => {
  it('without a bound notifier it never lists or publishes anything', async () => {
    const r = repo(['FORWARDED'], () => [delivery()]);
    expect(await worker(r).runOnce()).toMatchObject({ forwarded: 1, published: 0 });
    expect(r.listUnpublishedDeliveries).not.toHaveBeenCalled();
  });

  it('a publication that failed after a committed forward is published on the next cycle, exactly once', async () => {
    const published = new Set<string>();
    const pending = () => [delivery()].filter((d) => !published.has(d.candidateKey));
    let down = true;
    const notifier: IntroductionsDeliveryNotifier = {
      publishDelivered: jest.fn(async (d: UnpublishedDelivery) => {
        if (down) throw new ServiceUnavailableException('activity down');
        published.add(d.candidateKey);
      }),
      publishPendingEvents: NO_EVENTS(),
    };
    const { telemetry, recordOperationalOutcome } = recorder();
    const w = worker(repo(['FORWARDED'], pending), telemetry, notifier);
    expect(await w.runOnce()).toMatchObject({ forwarded: 1, published: 0, publishFailed: 1 });
    down = false;
    expect(await w.runOnce()).toMatchObject({ attempts: 0, published: 1, publishFailed: 0 });
    expect(await w.runOnce()).toMatchObject({ published: 0, publishFailed: 0 });
    expect(notifier.publishDelivered).toHaveBeenCalledTimes(2);
    expect(published).toEqual(new Set([delivery().candidateKey]));
    expect(recordOperationalOutcome.mock.calls.filter((c) => c[1] === 'reconcile').map((c) => c[2]))
      .toEqual(['transport_failure', 'success', 'success']);
  });

  it('a listing failure is reported and never throws', async () => {
    const r = repo([]);
    r.listUnpublishedDeliveries.mockRejectedValueOnce(new IntroductionsForwardAnswerError());
    const { telemetry, recordOperationalOutcome } = recorder();
    await expect(worker(r, telemetry, { publishDelivered: jest.fn(), publishPendingEvents: NO_EVENTS() }).runOnce()).resolves.toMatchObject({ published: 0 });
    expect(recordOperationalOutcome).toHaveBeenCalledWith('INTRODUCTIONS_FORWARD', 'reconcile', 'integrity_failure');
  });
});

describe('S6-07 CP2 — IntroductionsForwardDispatchRepository: the server channel, strictly decoded', () => {
  const api = (answer: unknown) => {
    const rpc = jest.fn().mockResolvedValue(answer);
    return { rpc, repository: new IntroductionsForwardDispatchRepository({ rpc } as unknown as SupabaseServiceRoleApiService) };
  };

  it('calls the one dispatcher with p_max = 1 only, under its own bound', async () => {
    const { rpc, repository } = api([{ outcome: 'SKIPPED_NOT_CLEARED' }]);
    await expect(repository.forwardOne()).resolves.toBe('SKIPPED_NOT_CLEARED');
    expect(rpc).toHaveBeenCalledWith('server_forward_approved_matching_proposals_v1', { p_max: 1 }, { timeoutMs: FORWARD_CALL_TIMEOUT_MS });
    for (const outcome of FORWARD_OUTCOMES) await expect(api([{ outcome }]).repository.forwardOne()).resolves.toBe(outcome);
  });

  it('refuses every answer no migration produces', async () => {
    for (const answer of [null, [], [{}], [{ outcome: 'CLEARED' }], [{ outcome: 'FORWARDED', proposal_id: P }],
      [{ outcome: 'FORWARDED' }, { outcome: 'FORWARDED' }], { outcome: 'FORWARDED' }]) {
      await expect(api(answer).repository.forwardOne()).rejects.toBeInstanceOf(IntroductionsForwardAnswerError);
    }
  });

  it('lists deliveries with the exact key the database derives, and refuses anything else', async () => {
    const row = { delivery_transition_id: T, proposal_id: P, recipient_user_id: U, candidate_key: `introductions:proposal-delivered:${T}`,
      delivered_at: '2026-10-18T10:00:00+00:00', action: 'PUBLISH' };
    const { rpc, repository } = api([row]);
    await expect(repository.listUnpublishedDeliveries(50)).resolves.toEqual([{ ...delivery(), deliveredAt: row.delivered_at }]);
    expect(rpc).toHaveBeenCalledWith('server_list_proposal_delivery_activity_reconciliation_v1', { p_limit: 50 });
    for (const bad of [{ ...row, action: 'WITHDRAW' }, { ...row, candidate_key: `introductions:proposal-delivered:${P}` },
      { ...row, recipient_user_id: 'someone' }, { ...row, delivered_at: 'yesterday' }, null]) {
      await expect(api([bad]).repository.listUnpublishedDeliveries(50)).rejects.toBeInstanceOf(IntroductionsForwardAnswerError);
    }
    await expect(api([row, row]).repository.listUnpublishedDeliveries(1)).rejects.toBeInstanceOf(IntroductionsForwardAnswerError);
  });
});

describe('S6-07 CP2 — isolation of the dispatch module', () => {
  const dir = __dirname;
  const sources = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .map((f) => [f, readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, '')] as const);

  it('has no controller, no route and no client token; it logs nothing', () => {
    expect(sources.map(([f]) => f).sort()).toEqual(['introductions-dispatch.module.ts', 'introductions-forward-dispatch.repository.ts',
      'introductions-forward-dispatcher.worker.ts']);
    for (const [file, code] of sources) {
      expect([file, /@Controller|@(Get|Post|Put|Patch|Delete)\(|SupabaseDataApiService|SupabaseAuthGuard|accessToken|console\.|Logger/u.test(code)])
        .toEqual([file, false]);
      expect([file, /from '\.\.\/(conversation(?!\/supabase-service-role-api)|memory|hypothesis|human-model|model-router|shared-world|public-world|connected-worlds|activity|push)\b/u.test(code)])
        .toEqual([file, false]);
    }
    const repository = sources.find(([f]) => f.endsWith('repository.ts'))![1];
    expect(repository.match(/rpc<unknown>\('([a-z0-9_]+)'/gu)).toEqual([
      "rpc<unknown>('server_forward_approved_matching_proposals_v1'",
      "rpc<unknown>('server_list_proposal_delivery_activity_reconciliation_v1'",
    ]);
  });
});
