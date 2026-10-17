import { DataApiError } from '../conversation/supabase-data-api.service';
import { SERVICE_ROLE_RPC_DEFAULT_TIMEOUT_MS, SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import { AccountErasureRecoveryWorker } from './account-erasure-recovery.worker';
import {
  ACCOUNT_ERASURE_TIMEOUT_MS, PrivacyMaintenanceAnswerError, PrivacyMaintenanceRepository, type AccountErasureOperationsSummary,
} from './privacy-maintenance.repository';
import { PrivacyMaintenanceWorker } from './privacy-maintenance.worker';
import type { ProviderAccountRemovalService } from './provider-account-removal.service';

// ACCT-DEL-01 (CP1) — the API side of the governed account erasure (migration 0164): the one RPC under its own call
// bound, the RETRY / INTEGRITY answers of the pass, and the recovery pass (re-arm and the erasure's aggregate state) -
// strict decoding, content-free and fail-soft telemetry, nothing logged.

const D1 = '11111111-1111-4111-8111-111111111111';
const U1 = '22222222-2222-4222-8222-222222222222';
const SCHEDULED = { deletionId: D1, userId: U1, status: 'SCHEDULED' as const };
const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const ROW = {
  blocked_shared_standard: 2, blocked_public: 1, blocked_replay: 0, blocked_unregistered: 0, blocked_unclassified: 1,
  retrying: 3, integrity_holding: 1, media_pending: 4, media_pending_oldest_age_seconds: 900, uncovered_classes: 4,
};
const SUMMARY: AccountErasureOperationsSummary = {
  blockedSharedStandard: 2, blockedPublic: 1, blockedReplay: 0, blockedUnregistered: 0, blockedUnclassified: 1,
  retrying: 3, integrityHolding: 1, mediaPending: 4, mediaPendingOldestAgeSeconds: 900, uncoveredClasses: 4,
};

function repositoryAnswering(answer: unknown) {
  const serviceApi = { rpc: jest.fn().mockResolvedValue(answer) } as unknown as jest.Mocked<SupabaseServiceRoleApiService>;
  return { serviceApi, repository: new PrivacyMaintenanceRepository(serviceApi) };
}

describe('ACCT-DEL-01 — the server channel', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('a caller may name its own call bound; every other call keeps the default five seconds', async () => {
    process.env.SUPABASE_URL = 'https://example.invalid';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    global.fetch = jest.fn().mockImplementation(async () => new Response(JSON.stringify('ERASED'), { status: 200 })) as typeof fetch;
    const api = new SupabaseServiceRoleApiService();
    await api.rpc('server_claim_due_account_deletions_v1', { p_limit: 1 });
    await api.rpc('server_erase_account_v1', { p_deletion_id: D1 }, { timeoutMs: ACCOUNT_ERASURE_TIMEOUT_MS });
    expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([SERVICE_ROLE_RPC_DEFAULT_TIMEOUT_MS, ACCOUNT_ERASURE_TIMEOUT_MS]);
    expect(SERVICE_ROLE_RPC_DEFAULT_TIMEOUT_MS).toBe(5000);
  });
});

describe('ACCT-DEL-01 — PrivacyMaintenanceRepository', () => {
  it('erases through the ONE governed account erasure, under its own bound, and answers the database\'s own word', async () => {
    const { serviceApi, repository } = repositoryAnswering('RETRY');
    await expect(repository.erase(D1)).resolves.toBe('RETRY');
    expect(serviceApi.rpc).toHaveBeenCalledWith('server_erase_account_v1', { p_deletion_id: D1 }, { timeoutMs: 60_000 });
    expect(serviceApi.rpc).not.toHaveBeenCalledWith('server_erase_personal_account_v1', expect.anything());
  });

  it('re-arm answers a whole non-negative count; anything else is an integrity failure', async () => {
    const ok = repositoryAnswering(2);
    await expect(ok.repository.rearmBlockedDeletions(20)).resolves.toBe(2);
    expect(ok.serviceApi.rpc).toHaveBeenCalledWith('server_rearm_blocked_account_deletions_v1', { p_limit: 20 });
    for (const bad of ['2', -1, 1.5, null, [2]]) {
      await expect(repositoryAnswering(bad).repository.rearmBlockedDeletions(20)).rejects.toBeInstanceOf(PrivacyMaintenanceAnswerError);
    }
  });

  it('the erasure summary is decoded strictly: exactly one row of non-negative whole numbers', async () => {
    const ok = repositoryAnswering([ROW]);
    await expect(ok.repository.readErasureOperations()).resolves.toEqual(SUMMARY);
    expect(ok.serviceApi.rpc).toHaveBeenCalledWith('server_read_account_erasure_operations_v1', {});
    for (const bad of [[], [ROW, ROW], [{ ...ROW, retrying: -1 }], [{ ...ROW, media_pending: '4' }], [{ ...ROW, uncovered_classes: undefined }], ROW, null]) {
      await expect(repositoryAnswering(bad).repository.readErasureOperations()).rejects.toBeInstanceOf(PrivacyMaintenanceAnswerError);
    }
  });
});

function maintenanceHarness(answer: string) {
  const telemetry = new TelemetryService(new CorrelationService());
  const outcome = jest.fn();
  Object.assign(telemetry as unknown as Record<string, unknown>, {
    operationalOutcomes: { add: outcome }, privacyOperationStateCounts: { record: jest.fn() },
    privacyOperationOldestAges: { record: jest.fn() }, privacyExportRecentFailures: { record: jest.fn() },
  });
  const repository = {
    prepareExports: jest.fn().mockResolvedValue(0),
    claimDueDeletions: jest.fn().mockResolvedValue([SCHEDULED]),
    erase: jest.fn().mockResolvedValue(answer),
    complete: jest.fn().mockResolvedValue('COMPLETED'),
    readOperationsSummary: jest.fn().mockRejectedValue(new PrivacyMaintenanceAnswerError()),
  } as unknown as jest.Mocked<PrivacyMaintenanceRepository>;
  const provider = { isConfigured: jest.fn().mockReturnValue(true), remove: jest.fn().mockResolvedValue('REMOVED') } as unknown as jest.Mocked<ProviderAccountRemovalService>;
  const worker = new PrivacyMaintenanceWorker(repository, provider, telemetry);
  const signals = () => outcome.mock.calls.map(([, l]) => `${l.domain}:${l.operation}:${l.outcome}`);
  return { worker, repository, provider, signals };
}

describe('ACCT-DEL-01 — the Privacy & Data pass on the governed account erasure', () => {
  it('RETRY is an expected answer the database already put under a backoff: no provider removal, no failure signal', async () => {
    const h = maintenanceHarness('RETRY');
    await h.worker.runOnce();
    expect(h.signals()).toContain('ACCOUNT_DELETION:erase:retry_expected');
    expect(h.signals().filter((s) => s.startsWith('ACCOUNT_DELETION:erase:') && /_failure$/u.test(s))).toEqual([]);
    expect(h.provider.remove).not.toHaveBeenCalled();
    expect(h.repository.complete).not.toHaveBeenCalled();
  });

  it('INTEGRITY is a visible integrity failure; the provider account is never touched', async () => {
    const h = maintenanceHarness('INTEGRITY');
    await h.worker.runOnce();
    expect(h.signals()).toContain('ACCOUNT_DELETION:erase:integrity_failure');
    expect(h.provider.remove).not.toHaveBeenCalled();
  });

  it('ERASED goes on to the provider and completes, exactly as before', async () => {
    const h = maintenanceHarness('ERASED');
    await h.worker.runOnce();
    expect(h.provider.remove).toHaveBeenCalledWith(U1);
    expect(h.repository.complete).toHaveBeenCalledWith(D1);
  });
});

function recoveryHarness() {
  const telemetry = new TelemetryService(new CorrelationService());
  const outcome = jest.fn(), state = jest.fn(), age = jest.fn();
  Object.assign(telemetry as unknown as Record<string, unknown>, {
    operationalOutcomes: { add: outcome }, privacyOperationStateCounts: { record: state },
    privacyOperationOldestAges: { record: age }, privacyExportRecentFailures: { record: jest.fn() },
  });
  const repository = {
    rearmBlockedDeletions: jest.fn().mockResolvedValue(0),
    readErasureOperations: jest.fn().mockResolvedValue(SUMMARY),
  } as unknown as jest.Mocked<PrivacyMaintenanceRepository>;
  const provider = { isConfigured: jest.fn().mockReturnValue(true) } as unknown as jest.Mocked<ProviderAccountRemovalService>;
  const worker = new AccountErasureRecoveryWorker(repository, provider, telemetry);
  const signals = () => outcome.mock.calls.map(([, l]) => `${l.domain}:${l.operation}:${l.outcome}`);
  const states = () => state.mock.calls.map(([v, l]) => `${l.domain}:${l.state}=${v}`);
  const emitted = () => JSON.stringify([outcome.mock.calls, state.mock.calls, age.mock.calls]);
  return { worker, repository, provider, signals, states, age, emitted, telemetry };
}

describe('ACCT-DEL-01 — AccountErasureRecoveryWorker', () => {
  it('one cycle re-arms through the database and records the erasure\'s state as numbers under finite labels', async () => {
    const h = recoveryHarness();
    await h.worker.runOnce();
    expect(h.repository.rearmBlockedDeletions).toHaveBeenCalledWith(20);
    expect(h.signals()).toEqual(['ACCOUNT_ERASURE:rearm:success', 'ACCOUNT_ERASURE:operations_scan:success']);
    expect(h.states()).toEqual([
      'ACCOUNT_ERASURE:blocked_shared_standard=2', 'ACCOUNT_ERASURE:blocked_public=1', 'ACCOUNT_ERASURE:blocked_replay=0',
      'ACCOUNT_ERASURE:blocked_unregistered=0', 'ACCOUNT_ERASURE:blocked_unclassified=1', 'ACCOUNT_ERASURE:retrying=3',
      'ACCOUNT_ERASURE:integrity_holding=1', 'ACCOUNT_ERASURE:media_pending=4', 'ACCOUNT_ERASURE:uncovered_classes=4',
    ]);
    expect(h.age.mock.calls.map(([v, l]) => `${l.state}=${v}`)).toEqual(['media_pending=900']);
    expect(h.emitted()).not.toMatch(UUID_ANYWHERE);
  });

  it('a failed re-arm or scan is visible and classified; a failed scan records no state', async () => {
    const h = recoveryHarness();
    h.repository.rearmBlockedDeletions.mockRejectedValue(new DataApiError(503));
    h.repository.readErasureOperations.mockRejectedValue(new PrivacyMaintenanceAnswerError());
    await h.worker.runOnce();
    expect(h.signals()).toEqual(['ACCOUNT_ERASURE:rearm:transport_failure', 'ACCOUNT_ERASURE:operations_scan:integrity_failure']);
    expect(h.states()).toEqual([]);
  });

  it('telemetry that throws never changes what the pass does; a cycle in flight is not doubled', async () => {
    const h = recoveryHarness();
    Object.assign(h.telemetry as unknown as Record<string, unknown>, { recordOperationalOutcome: () => { throw new Error('meter down'); } });
    let release: () => void = () => undefined;
    h.repository.rearmBlockedDeletions.mockImplementation(() => new Promise((resolve) => { release = () => resolve(0); }));
    const first = h.worker.runOnce();
    await h.worker.runOnce();
    expect(h.repository.rearmBlockedDeletions).toHaveBeenCalledTimes(1);
    release();
    await expect(first).resolves.toBeUndefined();
    expect(h.repository.readErasureOperations).toHaveBeenCalledTimes(1);
  });

  it('is off under tests and wherever the provider authority is not configured', () => {
    const h = recoveryHarness();
    expect(process.env.NODE_ENV).toBe('test');
    expect(h.worker.enabled).toBe(false);
  });
});
