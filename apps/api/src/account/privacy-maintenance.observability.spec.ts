import { ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import { PrivacyMaintenanceAnswerError, PrivacyMaintenanceRepository, type PrivacyOperationsSummary } from './privacy-maintenance.repository';
import { PrivacyMaintenanceWorker } from './privacy-maintenance.worker';
import type { ProviderAccountRemovalService } from './provider-account-removal.service';

// PROD-OPS-01 — the Privacy & Data pass is never silent. Every step's outcome is one content-free signal from a finite
// relation, the aggregate state is numeric, and telemetry can never change what the pass does.

const D1 = '11111111-1111-4111-8111-111111111111';
const U1 = '22222222-2222-4222-8222-222222222222';
const D2 = '33333333-3333-4333-8333-333333333333';
const U2 = '44444444-4444-4444-8444-444444444444';
const SCHEDULED = { deletionId: D1, userId: U1, status: 'SCHEDULED' as const };
const ERASED = { deletionId: D2, userId: U2, status: 'ERASED' as const };
const SECRET = `RAW_SQL_ERROR_TEXT duplicate key (user_id)=(${U1}) deletion ${D1}`;
const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;

const SUMMARY: PrivacyOperationsSummary = {
  exportPreparing: 4, exportRetrying: 2, exportStuckPreparing: 1, exportStuckPreparingOldestAgeSeconds: 7200,
  exportFailedTotal: 9, exportFailedRecent: 3,
  exportRecentFailuresTransientDatabase: 2, exportRecentFailuresConstraintOrIntegrity: 1,
  exportRecentFailuresResourceOrCapacity: 0, exportRecentFailuresInternalOther: 5,
  deletionStuckDue: 1, deletionStuckDueOldestAgeSeconds: 3600,
  deletionStuckProviderPending: 2, deletionStuckProviderPendingOldestAgeSeconds: 5400,
};

function harness() {
  const telemetry = new TelemetryService(new CorrelationService());
  const outcome = jest.fn(), state = jest.fn(), age = jest.fn(), recentFailures = jest.fn();
  Object.assign(telemetry as unknown as Record<string, unknown>, {
    operationalOutcomes: { add: outcome }, privacyOperationStateCounts: { record: state },
    privacyOperationOldestAges: { record: age }, privacyExportRecentFailures: { record: recentFailures },
  });
  const repository = {
    prepareExports: jest.fn().mockResolvedValue(1),
    claimDueDeletions: jest.fn().mockResolvedValue([]),
    erase: jest.fn().mockResolvedValue('ERASED'),
    complete: jest.fn().mockResolvedValue('COMPLETED'),
    readOperationsSummary: jest.fn().mockResolvedValue(SUMMARY),
  } as unknown as jest.Mocked<PrivacyMaintenanceRepository>;
  const provider = {
    isConfigured: jest.fn().mockReturnValue(true),
    remove: jest.fn().mockResolvedValue('REMOVED'),
  } as unknown as jest.Mocked<ProviderAccountRemovalService>;
  const worker = new PrivacyMaintenanceWorker(repository, provider, telemetry);
  const signals = () => outcome.mock.calls.map(([, labels]) => `${labels.domain}:${labels.operation}:${labels.outcome}`);
  const emitted = () => JSON.stringify([outcome.mock.calls, state.mock.calls, age.mock.calls, recentFailures.mock.calls]);
  return { telemetry, outcome, state, age, recentFailures, repository, provider, worker, signals, emitted };
}

/** Nothing emitted may carry an identifier, a text, an error message or a database code. */
function expectContentFree(h: ReturnType<typeof harness>) {
  const text = h.emitted();
  expect(text).not.toMatch(UUID_ANYWHERE);
  expect(text).not.toMatch(/RAW_SQL|duplicate key|deletion |user_id|session|turn|hypothesis|export_id|message|23505|PGRST|http/iu);
  for (const [value, labels] of h.outcome.mock.calls) {
    expect(value).toBe(1);
    expect(Object.keys(labels).sort()).toEqual(['domain', 'operation', 'outcome', 'policy_version']);
  }
}

describe('PrivacyMaintenanceWorker — operational visibility (PROD-OPS-01)', () => {
  it('a successful cycle emits one success per step and the aggregate state as numbers', async () => {
    const h = harness();
    h.repository.claimDueDeletions.mockResolvedValue([SCHEDULED]);
    await h.worker.runOnce();
    expect(h.signals()).toEqual([
      'PRIVACY_EXPORT:prepare:success', 'ACCOUNT_DELETION:claim:success', 'ACCOUNT_DELETION:erase:success',
      'ACCOUNT_DELETION:provider_remove:success', 'ACCOUNT_DELETION:complete:success',
      'PRIVACY_EXPORT:stuck_scan:success', 'ACCOUNT_DELETION:stuck_scan:success',
    ]);
    expect(h.state.mock.calls.map(([value, l]) => `${l.domain}:${l.state}=${value}`)).toEqual([
      'PRIVACY_EXPORT:preparing=4', 'PRIVACY_EXPORT:retrying=2', 'PRIVACY_EXPORT:stuck_preparing=1', 'PRIVACY_EXPORT:failed_total=9',
      'PRIVACY_EXPORT:failed_recent=3', 'ACCOUNT_DELETION:stuck_due=1', 'ACCOUNT_DELETION:stuck_provider_pending=2',
    ]);
    expect(h.age.mock.calls.map(([value, l]) => `${l.domain}:${l.state}=${value}`)).toEqual([
      'PRIVACY_EXPORT:stuck_preparing=7200', 'ACCOUNT_DELETION:stuck_due=3600', 'ACCOUNT_DELETION:stuck_provider_pending=5400',
    ]);
    expect(h.recentFailures.mock.calls.map(([value, l]) => `${l.failure_class}=${value}`)).toEqual([
      'TRANSIENT_DATABASE=2', 'CONSTRAINT_OR_INTEGRITY=1', 'RESOURCE_OR_CAPACITY=0', 'INTERNAL_OTHER=5',
    ]);
    expectContentFree(h);
  });

  it('an export preparation failure is visible and classified by kind, and the deletions still run', async () => {
    for (const [error, expected] of [
      [new ServiceUnavailableException(SECRET), 'transport_failure'],
      [new DataApiError(503), 'transport_failure'],
      [Object.assign(new Error(SECRET), { name: 'TimeoutError' }), 'transport_failure'],
      [new TypeError('fetch failed', { cause: new Error(SECRET) }), 'transport_failure'],
      [new DataApiError(400, { databaseCode: '23505', databaseMessage: SECRET }), 'integrity_failure'],
      [new PrivacyMaintenanceAnswerError(), 'integrity_failure'],
      [new Error(SECRET), 'integrity_failure'],
    ] as const) {
      const h = harness();
      h.repository.prepareExports.mockRejectedValue(error);
      h.repository.claimDueDeletions.mockResolvedValue([SCHEDULED]);
      await h.worker.runOnce();
      expect(h.signals()[0]).toBe(`PRIVACY_EXPORT:prepare:${expected}`);
      expect(h.repository.erase).toHaveBeenCalledWith(D1);
      expectContentFree(h);
    }
  });

  it('a claim failure is visible and the pass advances nothing, exactly as before', async () => {
    const h = harness();
    h.repository.claimDueDeletions.mockRejectedValue(new DataApiError(500, { databaseMessage: SECRET }));
    await h.worker.runOnce();
    expect(h.signals()).toContain('ACCOUNT_DELETION:claim:transport_failure');
    expect(h.repository.erase).not.toHaveBeenCalled();
    expectContentFree(h);
  });

  it('an erasure failure is visible; the provider is never touched and the next cycle retries', async () => {
    const h = harness();
    h.repository.claimDueDeletions.mockResolvedValue([SCHEDULED]);
    h.repository.erase.mockRejectedValueOnce(new DataApiError(500, { databaseMessage: SECRET }));
    await h.worker.runOnce();
    expect(h.signals()).toContain('ACCOUNT_DELETION:erase:transport_failure');
    expect(h.provider.remove).not.toHaveBeenCalled();
    expect(h.repository.complete).not.toHaveBeenCalled();
    await h.worker.runOnce();
    expect(h.repository.complete).toHaveBeenCalledWith(D1);
    expectContentFree(h);
  });

  it('provider removal UNAVAILABLE is visible and stays retryable — never completed, never cut off', async () => {
    const h = harness();
    h.repository.claimDueDeletions.mockResolvedValue([ERASED]);
    h.repository.erase.mockResolvedValue('ALREADY_ERASED');
    h.provider.remove.mockResolvedValue('UNAVAILABLE');
    for (let cycle = 0; cycle < 25; cycle += 1) await h.worker.runOnce();
    expect(h.provider.remove).toHaveBeenCalledTimes(25);
    expect(h.repository.complete).not.toHaveBeenCalled();
    expect(h.signals().filter((s) => s === 'ACCOUNT_DELETION:provider_remove:provider_unavailable')).toHaveLength(25);
    h.provider.remove.mockRejectedValueOnce(new Error(SECRET));
    await h.worker.runOnce();
    expect(h.signals().filter((s) => s === 'ACCOUNT_DELETION:provider_remove:provider_unavailable')).toHaveLength(26);
    h.provider.remove.mockResolvedValue('REMOVED');
    await h.worker.runOnce();
    expect(h.repository.complete).toHaveBeenCalledWith(D2);
    expectContentFree(h);
  });

  it('a completion failure is visible and stays retryable', async () => {
    const h = harness();
    h.repository.claimDueDeletions.mockResolvedValue([ERASED]);
    h.repository.erase.mockResolvedValue('ALREADY_ERASED');
    h.repository.complete.mockRejectedValueOnce(new DataApiError(503)).mockResolvedValueOnce('UNKNOWN').mockResolvedValue('COMPLETED');
    await h.worker.runOnce();
    await h.worker.runOnce();
    await h.worker.runOnce();
    expect(h.signals().filter((s) => s.startsWith('ACCOUNT_DELETION:complete:'))).toEqual([
      'ACCOUNT_DELETION:complete:transport_failure', 'ACCOUNT_DELETION:complete:integrity_failure', 'ACCOUNT_DELETION:complete:success',
    ]);
    expect(h.repository.complete).toHaveBeenCalledTimes(3);
    expectContentFree(h);
  });

  it('Connected Worlds BLOCKED is an expected answer, never an operational failure; races lost on purpose are expected too', async () => {
    for (const [answer, expected] of [['BLOCKED', 'blocked_expected'], ['CANCELLED', 'superseded_expected'], ['NOT_DUE', 'superseded_expected'], ['UNKNOWN', 'integrity_failure']] as const) {
      const h = harness();
      h.repository.claimDueDeletions.mockResolvedValue([SCHEDULED]);
      h.repository.erase.mockResolvedValue(answer);
      await h.worker.runOnce();
      expect(h.signals()).toContain(`ACCOUNT_DELETION:erase:${expected}`);
      expect(h.provider.remove).not.toHaveBeenCalled();
      if (answer !== 'UNKNOWN') expect(h.signals().filter((s) => /_failure$/u.test(s))).toEqual([]);
    }
  });

  it('a failed aggregate read is visible for both domains and records no state', async () => {
    const h = harness();
    h.repository.readOperationsSummary.mockRejectedValue(new PrivacyMaintenanceAnswerError());
    await h.worker.runOnce();
    expect(h.signals().slice(-2)).toEqual(['PRIVACY_EXPORT:stuck_scan:integrity_failure', 'ACCOUNT_DELETION:stuck_scan:integrity_failure']);
    expect(h.state).not.toHaveBeenCalled();
    expect(h.age).not.toHaveBeenCalled();
  });

  it('telemetry that throws — instruments or the service itself — never changes what the pass does', async () => {
    const drive = async (breakTelemetry: (h: ReturnType<typeof harness>) => void) => {
      const h = harness();
      breakTelemetry(h);
      const order: string[] = [];
      h.repository.prepareExports.mockImplementation(async () => { order.push('prepare'); throw new DataApiError(503); });
      h.repository.claimDueDeletions.mockImplementation(async () => { order.push('claim'); return [SCHEDULED, ERASED]; });
      h.repository.erase.mockImplementation(async (id: string) => { order.push(`erase:${id === D1 ? 'D1' : 'D2'}`); return id === D1 ? 'BLOCKED' : 'ALREADY_ERASED'; });
      h.provider.remove.mockImplementation(async () => { order.push('remove'); return 'REMOVED'; });
      h.repository.complete.mockImplementation(async () => { order.push('complete'); return 'COMPLETED'; });
      h.repository.readOperationsSummary.mockImplementation(async () => { order.push('scan'); return SUMMARY; });
      await expect(h.worker.runOnce()).resolves.toBeUndefined();
      return order;
    };
    const baseline = await drive(() => undefined);
    expect(baseline).toEqual(['prepare', 'claim', 'erase:D1', 'erase:D2', 'remove', 'complete', 'scan']);
    const boom = () => { throw new Error('meter down'); };
    expect(await drive((h) => Object.assign(h.telemetry as unknown as Record<string, unknown>, {
      operationalOutcomes: { add: boom }, privacyOperationStateCounts: { record: boom },
      privacyOperationOldestAges: { record: boom }, privacyExportRecentFailures: { record: boom },
    }))).toEqual(baseline);
    expect(await drive((h) => Object.assign(h.telemetry, {
      recordOperationalOutcome: boom, recordPrivacyOperationState: boom, recordPrivacyExportRecentFailures: boom,
    }))).toEqual(baseline);
  });
});

describe('PrivacyMaintenanceRepository.readOperationsSummary — decoded strictly (PROD-OPS-01)', () => {
  const ROW = {
    export_preparing: 4, export_retrying: 2, export_stuck_preparing: 1, export_stuck_preparing_oldest_age_seconds: 7200,
    export_failed_total: 9, export_failed_recent: 3, export_recent_failures_transient_database: 2,
    export_recent_failures_constraint_or_integrity: 1, export_recent_failures_resource_or_capacity: 0,
    export_recent_failures_internal_other: 5, deletion_stuck_due: 1, deletion_stuck_due_oldest_age_seconds: 3600,
    deletion_stuck_provider_pending: 2, deletion_stuck_provider_pending_oldest_age_seconds: 5400,
  };
  const answering = (answer: unknown) => {
    const serviceApi = { rpc: jest.fn().mockResolvedValue(answer) };
    return { serviceApi, repository: new PrivacyMaintenanceRepository(serviceApi as never) };
  };

  it('reads the one service-role summary with no parameter and maps exactly its fourteen numbers', async () => {
    const { serviceApi, repository } = answering([ROW]);
    await expect(repository.readOperationsSummary()).resolves.toEqual(SUMMARY);
    expect(serviceApi.rpc).toHaveBeenCalledWith('server_read_privacy_operations_summary_v1', {});
  });

  it('refuses any other shape: no row, two rows, a missing, negative, fractional, textual or unsafe number', async () => {
    for (const answer of [
      [], [ROW, ROW], null, ROW, [null], [{ ...ROW, deletion_stuck_due: undefined }], [{ ...ROW, export_failed_total: -1 }],
      [{ ...ROW, export_preparing: 1.5 }], [{ ...ROW, export_preparing: '4' }], [{ ...ROW, export_preparing: Number.MAX_SAFE_INTEGER + 2 }],
    ]) {
      await expect(answering(answer).repository.readOperationsSummary()).rejects.toBeInstanceOf(PrivacyMaintenanceAnswerError);
    }
  });
});
