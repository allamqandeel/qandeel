import { BadRequestException, RequestMethod, ServiceUnavailableException } from '@nestjs/common';
import { GUARDS_METADATA, HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { PrivacyDataController } from './privacy-data.controller';
import { PrivacyDataRepository } from './privacy-data.repository';
import { PrivacyDataService } from './privacy-data.service';
import { PrivacyMaintenanceAnswerError, PrivacyMaintenanceRepository } from './privacy-maintenance.repository';
import { PrivacyMaintenanceWorker } from './privacy-maintenance.worker';
import { ProviderAccountRemovalService } from './provider-account-removal.service';
import { SupabasePasswordGrantService } from './supabase-password-grant.service';
import type { TelemetryService } from '../observability/telemetry.service';

// W3-MEGA-S — Privacy & Data, the server boundary. The database (migration 0130) decides every export and deletion
// state and demands the re-authentication itself; the provider decides the password and removes the account. This
// boundary acts for the caller only, decodes strictly, never guesses, and never reports a deletion it did not finish.

const TOKEN = 'caller-token';
const PROOF = 'proof-token';
const IP = '203.0.113.7';
const COMMAND = '6f1f3a52-9d4e-4c1b-8a7e-2b9c0d4e5f60';
const OWNER = { email: 'noor@example.test', emailVerified: true };
const LATER = '2026-10-07T10:00:00.000Z';

function makeService() {
  const repository = {
    readState: jest.fn(),
    requestExport: jest.fn(),
    readExport: jest.fn(),
    requestDeletion: jest.fn(),
    cancelDeletion: jest.fn(),
  } as unknown as jest.Mocked<PrivacyDataRepository>;
  const provider = {
    isConfigured: jest.fn().mockReturnValue(true),
    grant: jest.fn().mockResolvedValue({ kind: 'SESSION', accessToken: PROOF, refreshToken: 'r' }),
    readOwnUser: jest.fn().mockResolvedValue(OWNER),
    endSessions: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<SupabasePasswordGrantService>;
  return { repository, provider, service: new PrivacyDataService(repository, provider) };
}

describe('PrivacyDataService — the owner’s state', () => {
  it('maps the database’s state and nothing else', async () => {
    const { repository, service } = makeService();
    repository.readState.mockResolvedValue({ export_status: 'READY', export_available_until: LATER, deletion_status: 'SCHEDULED', deletion_final_at: LATER });
    await expect(service.readState(TOKEN)).resolves.toEqual({ export: { status: 'READY', availableUntil: LATER }, deletion: { status: 'SCHEDULED', finalAt: LATER } });
    expect(repository.readState).toHaveBeenCalledWith(TOKEN);
  });

  it('is unavailable — never a guess — for an unknown state or no answer', async () => {
    const { repository, service } = makeService();
    repository.readState.mockResolvedValueOnce({ export_status: 'DONE', export_available_until: null, deletion_status: 'NONE', deletion_final_at: null });
    await expect(service.readState(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
    repository.readState.mockResolvedValueOnce({ export_status: 'NONE', export_available_until: null, deletion_status: 'DELETED', deletion_final_at: null });
    await expect(service.readState(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
    repository.readState.mockRejectedValueOnce(new DataApiError(500));
    await expect(service.readState(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
    repository.readState.mockResolvedValueOnce(undefined);
    await expect(service.readState(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe.each([
  ['export', 'requestExport' as const, 'requestExport' as const, { outcome: 'ACCEPTED', export_status: 'PREPARING', available_until: null },
    { outcome: 'ACCEPTED', export: { status: 'PREPARING', availableUntil: null } }],
  ['deletion', 'requestDeletion' as const, 'requestDeletion' as const, { outcome: 'ACCEPTED', deletion_status: 'SCHEDULED', final_at: LATER },
    { outcome: 'ACCEPTED', deletion: { status: 'SCHEDULED', finalAt: LATER } }],
])('PrivacyDataService — the %s request, behind the provider’s own password check', (_name, act, repoAct, row, view) => {
  it('proves the password on the caller’s own Email, requests on the PROOF token, then ends the proof session', async () => {
    const { repository, provider, service } = makeService();
    (repository[repoAct] as jest.Mock).mockResolvedValue(row);
    await expect(service[act](TOKEN, { commandId: COMMAND, password: 'pw' }, IP)).resolves.toEqual(view);
    expect(provider.readOwnUser).toHaveBeenCalledWith(TOKEN, IP);
    expect(provider.grant).toHaveBeenCalledWith(OWNER.email, 'pw', IP);
    expect(repository[repoAct]).toHaveBeenCalledWith(PROOF, COMMAND);
    expect(provider.endSessions).toHaveBeenCalledWith(PROOF, 'local', IP);
  });

  it('a wrong password requests nothing and says only that', async () => {
    const { repository, provider, service } = makeService();
    provider.grant.mockResolvedValue({ kind: 'INVALID_CREDENTIALS' });
    await expect(service[act](TOKEN, { commandId: COMMAND, password: 'wrong' }, IP)).resolves.toEqual({ outcome: 'PASSWORD_REJECTED' });
    expect(repository[repoAct]).not.toHaveBeenCalled();
  });

  it('ends the proof session even when the database gives no usable answer, and says unavailable', async () => {
    const { repository, provider, service } = makeService();
    (repository[repoAct] as jest.Mock).mockRejectedValue(new DataApiError(403));
    await expect(service[act](TOKEN, { commandId: COMMAND, password: 'pw' }, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(provider.endSessions).toHaveBeenCalledWith(PROOF, 'local', IP);
  });

  it('refuses any other body — there is no account field — and fails closed without the relay or a reader address', async () => {
    const { repository, provider, service } = makeService();
    for (const body of [null, [], {}, { commandId: COMMAND }, { commandId: 'x', password: 'pw' }, { commandId: COMMAND, password: '' },
      { commandId: COMMAND, password: 'x'.repeat(1025) }, { commandId: COMMAND, password: 'pw', userId: 'someone' }]) {
      await expect(service[act](TOKEN, body, IP)).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(service[act](TOKEN, { commandId: COMMAND, password: 'pw' }, undefined)).rejects.toBeInstanceOf(ServiceUnavailableException);
    provider.isConfigured.mockReturnValue(false);
    await expect(service[act](TOKEN, { commandId: COMMAND, password: 'pw' }, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(provider.grant).not.toHaveBeenCalled();
    expect(repository[repoAct]).not.toHaveBeenCalled();
  });

  it('a provider without a usable answer is unavailable, not a rejected password', async () => {
    const { repository, provider, service } = makeService();
    provider.grant.mockResolvedValue({ kind: 'UNAVAILABLE' });
    await expect(service[act](TOKEN, { commandId: COMMAND, password: 'pw' }, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
    provider.readOwnUser.mockResolvedValue(null);
    await expect(service[act](TOKEN, { commandId: COMMAND, password: 'pw' }, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repository[repoAct]).not.toHaveBeenCalled();
  });
});

describe('PrivacyDataService — the download', () => {
  it('returns the ready package with the owner’s own Email added from the owner’s own provider session', async () => {
    const { repository, provider, service } = makeService();
    repository.readExport.mockResolvedValue({ export_status: 'READY', available_until: LATER, content: { format: 'qandeel.personal-data-export.v1', account: { name: 'Noor' } } });
    await expect(service.downloadExport(TOKEN, IP)).resolves.toEqual({
      status: 'READY',
      availableUntil: LATER,
      package: { format: 'qandeel.personal-data-export.v1', account: { name: 'Noor', email: OWNER.email, emailVerified: true } },
    });
    expect(repository.readExport).toHaveBeenCalledWith(TOKEN);
    expect(provider.readOwnUser).toHaveBeenCalledWith(TOKEN, IP);
  });

  it.each(['NONE', 'PREPARING', 'EXPIRED', 'FAILED'])('answers %s with no package', async (status) => {
    const { repository, provider, service } = makeService();
    repository.readExport.mockResolvedValue({ export_status: status, available_until: null, content: null });
    await expect(service.downloadExport(TOKEN, IP)).resolves.toEqual({ status, availableUntil: null, package: null });
    expect(provider.readOwnUser).not.toHaveBeenCalled();
  });

  it('never hands out a package without the owner’s own Email, and never a malformed one', async () => {
    const { repository, provider, service } = makeService();
    repository.readExport.mockResolvedValue({ export_status: 'READY', available_until: LATER, content: { account: {} } });
    provider.readOwnUser.mockResolvedValueOnce(null);
    await expect(service.downloadExport(TOKEN, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
    repository.readExport.mockResolvedValue({ export_status: 'READY', available_until: LATER, content: null });
    await expect(service.downloadExport(TOKEN, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('PrivacyDataService — cancellation', () => {
  it.each([
    [{ outcome: 'CANCELLED', deletion_status: 'NONE', final_at: null }, { outcome: 'CANCELLED', deletion: { status: 'NONE', finalAt: null } }],
    [{ outcome: 'NONE', deletion_status: 'NONE', final_at: null }, { outcome: 'NONE', deletion: { status: 'NONE', finalAt: null } }],
    [{ outcome: 'NOT_CANCELLABLE', deletion_status: 'FINALIZING', final_at: LATER }, { outcome: 'NOT_CANCELLABLE', deletion: { status: 'FINALIZING', finalAt: LATER } }],
  ])('maps the database’s answer %o', async (row, view) => {
    const { repository, service } = makeService();
    repository.cancelDeletion.mockResolvedValue(row);
    await expect(service.cancelDeletion(TOKEN, {})).resolves.toEqual(view);
    expect(repository.cancelDeletion).toHaveBeenCalledWith(TOKEN);
  });

  it('takes an empty body only, and never invents an outcome', async () => {
    const { repository, service } = makeService();
    for (const body of [null, [], { userId: 'x' }]) await expect(service.cancelDeletion(TOKEN, body)).rejects.toBeInstanceOf(BadRequestException);
    repository.cancelDeletion.mockResolvedValue({ outcome: 'DELETED', deletion_status: 'NONE', final_at: null });
    await expect(service.cancelDeletion(TOKEN, {})).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('PrivacyDataController — the route surface', () => {
  it('is guarded as a whole, under /account/privacy, with exactly five routes and no account in any path', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PrivacyDataController)).toBe('account/privacy');
    expect(Reflect.getMetadata(GUARDS_METADATA, PrivacyDataController)).toEqual([SupabaseAuthGuard]);
    const routes = Object.getOwnPropertyNames(PrivacyDataController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => {
        const handler = (PrivacyDataController.prototype as unknown as Record<string, object>)[name];
        return [RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)], Reflect.getMetadata(PATH_METADATA, handler)];
      });
    expect(routes).toEqual([['GET', '/'], ['POST', 'export'], ['GET', 'export/download'], ['POST', 'deletion'], ['POST', 'deletion/cancel']]);
  });

  it('no answer is kept by any cache on the way — above all the package', () => {
    for (const name of ['readState', 'requestExport', 'downloadExport', 'requestDeletion', 'cancelDeletion']) {
      const handler = (PrivacyDataController.prototype as unknown as Record<string, object>)[name];
      expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toEqual([{ name: 'Cache-Control', value: 'no-store' }]);
    }
  });
});

function makeWorker() {
  const repository = {
    prepareExports: jest.fn().mockResolvedValue(0),
    claimDueDeletions: jest.fn().mockResolvedValue([]),
    erase: jest.fn(),
    complete: jest.fn().mockResolvedValue('COMPLETED'),
    readOperationsSummary: jest.fn().mockRejectedValue(new Error('not under test here')),
  } as unknown as jest.Mocked<PrivacyMaintenanceRepository>;
  const provider = {
    isConfigured: jest.fn().mockReturnValue(true),
    remove: jest.fn().mockResolvedValue('REMOVED'),
  } as unknown as jest.Mocked<ProviderAccountRemovalService>;
  // PROD-OPS-01's telemetry is proven in privacy-maintenance.observability.spec.ts; here it is inert.
  const telemetry = {
    recordOperationalOutcome: jest.fn(), recordPrivacyOperationState: jest.fn(), recordPrivacyExportRecentFailures: jest.fn(),
  } as unknown as TelemetryService;
  return { repository, provider, worker: new PrivacyMaintenanceWorker(repository, provider, telemetry) };
}

const D1 = '11111111-1111-4111-8111-111111111111';
const U1 = '22222222-2222-4222-8222-222222222222';
const D2 = '33333333-3333-4333-8333-333333333333';
const U2 = '44444444-4444-4444-8444-444444444444';
const SCHEDULED = { deletionId: D1, userId: U1, status: 'SCHEDULED' as const };
const ERASED = { deletionId: D2, userId: U2, status: 'ERASED' as const };

describe('PrivacyMaintenanceWorker — the server’s asynchronous pass', () => {
  it('prepares exports, then erases, removes the provider account, and completes — in that order', async () => {
    const { repository, provider, worker } = makeWorker();
    repository.claimDueDeletions.mockResolvedValue([SCHEDULED]);
    repository.erase.mockResolvedValue('ERASED');
    const order: string[] = [];
    repository.prepareExports.mockImplementation(async () => { order.push('prepare'); return 1; });
    repository.erase.mockImplementation(async () => { order.push('erase'); return 'ERASED'; });
    provider.remove.mockImplementation(async () => { order.push('remove'); return 'REMOVED'; });
    repository.complete.mockImplementation(async () => { order.push('complete'); return 'COMPLETED'; });
    await worker.runOnce();
    expect(order).toEqual(['prepare', 'erase', 'remove', 'complete']);
    expect(provider.remove).toHaveBeenCalledWith(U1);
    expect(repository.complete).toHaveBeenCalledWith(D1);
  });

  it('a BLOCKED, NOT_DUE or CANCELLED erasure stops there: the provider account is never touched', async () => {
    for (const outcome of ['BLOCKED', 'NOT_DUE', 'CANCELLED', 'UNKNOWN']) {
      const { repository, provider, worker } = makeWorker();
      repository.claimDueDeletions.mockResolvedValue([SCHEDULED]);
      repository.erase.mockResolvedValue(outcome);
      await worker.runOnce();
      expect(provider.remove).not.toHaveBeenCalled();
      expect(repository.complete).not.toHaveBeenCalled();
    }
  });

  it('an already-erased request passes the erasure’s residual sweep, then the provider removal; a failed removal is never recorded complete', async () => {
    const { repository, provider, worker } = makeWorker();
    repository.claimDueDeletions.mockResolvedValue([ERASED]);
    const order: string[] = [];
    repository.erase.mockImplementation(async () => { order.push('sweep'); return 'ALREADY_ERASED'; });
    provider.remove.mockImplementation(async () => { order.push('remove'); return 'UNAVAILABLE'; });
    await worker.runOnce();
    expect(repository.erase).toHaveBeenCalledWith(D2);
    expect(order).toEqual(['sweep', 'remove']);
    expect(provider.remove).toHaveBeenCalledWith(U2);
    expect(repository.complete).not.toHaveBeenCalled();
    provider.remove.mockResolvedValue('REMOVED');
    await worker.runOnce();
    expect(repository.complete).toHaveBeenCalledWith(D2);
  });

  it('a failure in one deletion or in preparation does not stop the others', async () => {
    const { repository, provider, worker } = makeWorker();
    repository.prepareExports.mockRejectedValue(new Error('down'));
    repository.claimDueDeletions.mockResolvedValue([SCHEDULED, ERASED]);
    repository.erase.mockImplementation(async (id: string) => {
      if (id === D1) throw new Error('down');
      return 'ALREADY_ERASED';
    });
    await worker.runOnce();
    expect(provider.remove).toHaveBeenCalledTimes(1);
    expect(provider.remove).toHaveBeenCalledWith(U2);
  });

  it('never runs two cycles at once, and is off under tests', async () => {
    const { repository, worker } = makeWorker();
    let release: () => void = () => undefined;
    repository.prepareExports.mockImplementation(() => new Promise((resolve) => { release = () => resolve(0); }));
    const first = worker.runOnce();
    await worker.runOnce();
    expect(repository.prepareExports).toHaveBeenCalledTimes(1);
    release();
    await first;
    expect(worker.enabled).toBe(false);
  });
});

describe('PrivacyMaintenanceRepository — the server channel’s answers, decoded strictly', () => {
  function repositoryAnswering(answer: unknown) {
    const serviceApi = { rpc: jest.fn().mockResolvedValue(answer) };
    return { serviceApi, repository: new PrivacyMaintenanceRepository(serviceApi as never) };
  }

  it('claims: only well-formed rows of the database’s own ids and statuses', async () => {
    const { serviceApi, repository } = repositoryAnswering([
      { deletion_id: D1, user_id: U1, deletion_status: 'SCHEDULED' },
      { deletion_id: D2, user_id: U2, deletion_status: 'ERASED' },
      { deletion_id: 'd3', user_id: U2, deletion_status: 'SCHEDULED' },
      { deletion_id: D2, user_id: U2, deletion_status: 'BLOCKED' },
      null,
    ]);
    await expect(repository.claimDueDeletions(10)).resolves.toEqual([SCHEDULED, ERASED]);
    expect(serviceApi.rpc).toHaveBeenCalledWith('server_claim_due_account_deletions_v1', { p_limit: 10 });
    // PROD-OPS-01: an answer that is not a row set is a visible integrity failure (the pass still claims nothing).
    await expect(repositoryAnswering({ not: 'an array' }).repository.claimDueDeletions(10)).rejects.toBeInstanceOf(PrivacyMaintenanceAnswerError);
  });

  it('scalar answers: the database’s own word, else UNKNOWN; a non-number preparation answer is an integrity failure', async () => {
    await expect(repositoryAnswering('ERASED').repository.erase(D1)).resolves.toBe('ERASED');
    await expect(repositoryAnswering(null).repository.erase(D1)).resolves.toBe('UNKNOWN');
    await expect(repositoryAnswering('COMPLETED').repository.complete(D1)).resolves.toBe('COMPLETED');
    await expect(repositoryAnswering(3).repository.prepareExports(10)).resolves.toBe(3);
    await expect(repositoryAnswering('3').repository.prepareExports(10)).rejects.toBeInstanceOf(PrivacyMaintenanceAnswerError);
    const { serviceApi, repository } = repositoryAnswering('ERASED');
    await repository.erase(D1);
    expect(serviceApi.rpc).toHaveBeenCalledWith('server_erase_personal_account_v1', { p_deletion_id: D1 });
  });
});

describe('ProviderAccountRemovalService — the provider account’s removal', () => {
  const realFetch = global.fetch;
  const env = { ...process.env };
  afterEach(() => {
    global.fetch = realFetch;
    process.env = { ...env };
  });

  function answer(status: number, body: unknown) {
    const fetchMock = jest.fn().mockResolvedValue({ status, json: async () => body });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it('hard-deletes by the database’s id with the server credential, and counts only the provider’s own “already gone”', async () => {
    process.env.SUPABASE_URL = 'https://project.example.test/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-key';
    const service = new ProviderAccountRemovalService();
    const id = '0b6f2c1e-6b8a-4f7e-9a3c-1d2e3f4a5b6c';
    const fetchMock = answer(200, {});
    await expect(service.remove(id)).resolves.toBe('REMOVED');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://project.example.test/auth/v1/admin/users/${id}`);
    expect(init.method).toBe('DELETE');
    expect(init.headers).toEqual(expect.objectContaining({ apikey: 'server-key', Authorization: 'Bearer server-key' }));
    expect(JSON.parse(init.body)).toEqual({ should_soft_delete: false });
    answer(404, { error_code: 'user_not_found' });
    await expect(service.remove(id)).resolves.toBe('REMOVED');
    answer(404, {});
    await expect(service.remove(id)).resolves.toBe('UNAVAILABLE');
    answer(500, {});
    await expect(service.remove(id)).resolves.toBe('UNAVAILABLE');
    await expect(service.remove('not-an-id')).resolves.toBe('UNAVAILABLE');
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
    await expect(service.remove(id)).resolves.toBe('UNAVAILABLE');
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(service.isConfigured()).toBe(false);
    await expect(service.remove(id)).resolves.toBe('UNAVAILABLE');
  });
});
