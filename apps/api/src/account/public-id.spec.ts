import { BadRequestException, ConflictException, RequestMethod, ServiceUnavailableException } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DataApiError, SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { AccountController } from './account.controller';
import { AccountRepository } from './account.repository';
import { AccountService, PUBLIC_ID_CHANGE_OUTCOMES } from './account.service';

// W3-02 (E2E-D-09) — the caller's own Public ID and its ONE lifetime manual change. The database (migration
// 0125) decides every outcome; this boundary decodes strictly, maps to bounded outcomes, and never guesses.

const TOKEN = 'caller-token';
const COMMAND = '6f1f3a52-9d4e-4c1b-8a7e-2b9c0d4e5f60';

function makeService() {
  const repository = {
    readFirstUse: jest.fn(),
    completeWelcome: jest.fn(),
    isLoginIdAvailable: jest.fn(),
    readPublicId: jest.fn(),
    changePublicId: jest.fn(),
  } as unknown as jest.Mocked<AccountRepository>;
  return { repository, service: new AccountService(repository) };
}

describe('AccountService — the caller’s own Public ID', () => {
  it('reads the canonical value and allowance, and nothing else', async () => {
    const { repository, service } = makeService();
    repository.readPublicId.mockResolvedValue({ current_public_id: 'nightlamp27', change_available: true });
    await expect(service.readPublicId(TOKEN)).resolves.toEqual({ publicId: 'nightlamp27', changeAvailable: true });
    expect(repository.readPublicId).toHaveBeenCalledWith(TOKEN);
  });

  it('reports an unreadable or malformed answer as unavailable, never as a fabricated state', async () => {
    const { repository, service } = makeService();
    for (const answer of [undefined, { current_public_id: '', change_available: true }, { current_public_id: 'x', change_available: 'yes' }]) {
      repository.readPublicId.mockResolvedValue(answer as never);
      await expect(service.readPublicId(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
    repository.readPublicId.mockRejectedValue(new DataApiError(500));
    await expect(service.readPublicId(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('AccountService — the one lifetime change', () => {
  it('passes exactly the command identity and the requested value on the caller’s token', async () => {
    const { repository, service } = makeService();
    repository.changePublicId.mockResolvedValue({ outcome: 'CHANGED', current_public_id: 'noor.writes', change_available: false });
    await expect(service.changePublicId(TOKEN, { commandId: COMMAND.toUpperCase(), publicId: '@Noor.Writes' }))
      .resolves.toEqual({ outcome: 'CHANGED', publicId: 'noor.writes', changeAvailable: false });
    expect(repository.changePublicId).toHaveBeenCalledWith(TOKEN, COMMAND, '@Noor.Writes');
  });

  it.each(PUBLIC_ID_CHANGE_OUTCOMES)('maps the database’s %s outcome through unchanged, with the caller’s own state', async (outcome) => {
    const { repository, service } = makeService();
    const changeAvailable = outcome !== 'CHANGED' && outcome !== 'ALREADY_USED';
    repository.changePublicId.mockResolvedValue({ outcome, current_public_id: 'nightlamp27', change_available: changeAvailable });
    await expect(service.changePublicId(TOKEN, { commandId: COMMAND, publicId: 'x' })).resolves.toEqual({ outcome, publicId: 'nightlamp27', changeAvailable });
  });

  it('refuses any body that is not exactly one command identity and one bounded value — there is no account field', async () => {
    const { repository, service } = makeService();
    for (const body of [
      null, 'x', [], {}, { publicId: 'a' }, { commandId: COMMAND }, { commandId: 'not-a-uuid', publicId: 'a' },
      { commandId: COMMAND, publicId: 7 }, { commandId: COMMAND, publicId: 'a'.repeat(65) },
      { commandId: COMMAND, publicId: 'a', userId: '00000000-0000-0000-0000-000000000000' },
      { commandId: COMMAND, publicId: 'a', accountId: 'x' },
    ]) {
      await expect(service.changePublicId(TOKEN, body)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(repository.changePublicId).not.toHaveBeenCalled();
  });

  it('a command identity reused for another value is a conflict, and only that', async () => {
    const { repository, service } = makeService();
    repository.changePublicId.mockRejectedValue(new DataApiError(409, { databaseCode: '23505', databaseMessage: 'PUBLIC_ID_COMMAND_CONFLICT' }));
    await expect(service.changePublicId(TOKEN, { commandId: COMMAND, publicId: 'other' })).rejects.toBeInstanceOf(ConflictException);
    // Any other 23505 — or any other failure — is unavailable: the client reconciles before a retry.
    repository.changePublicId.mockRejectedValue(new DataApiError(409, { databaseCode: '23505', databaseMessage: 'something else' }));
    await expect(service.changePublicId(TOKEN, { commandId: COMMAND, publicId: 'other' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    repository.changePublicId.mockRejectedValue(new ServiceUnavailableException());
    await expect(service.changePublicId(TOKEN, { commandId: COMMAND, publicId: 'other' })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('never trusts an unknown outcome or a malformed answer', async () => {
    const { repository, service } = makeService();
    for (const answer of [undefined, { outcome: 'MAYBE', current_public_id: 'a', change_available: true }, { outcome: 'CHANGED', current_public_id: null, change_available: false }]) {
      repository.changePublicId.mockResolvedValue(answer as never);
      await expect(service.changePublicId(TOKEN, { commandId: COMMAND, publicId: 'a' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });

  it('the answer carries no identity of anyone: no id, no Name, no Login ID, no Public ref', async () => {
    const { repository, service } = makeService();
    repository.changePublicId.mockResolvedValue({ outcome: 'UNAVAILABLE', current_public_id: 'nightlamp27', change_available: true, user_id: 'leak', public_identity_ref: 'leak' } as never);
    const result = await service.changePublicId(TOKEN, { commandId: COMMAND, publicId: 'taken.one' });
    expect(Object.keys(result).sort()).toEqual(['changeAvailable', 'outcome', 'publicId']);
  });
});

describe('AccountRepository — the Public ID transports', () => {
  it('reads and changes on the caller’s token only, with no account id in the request', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([{ outcome: 'CHANGED', current_public_id: 'a.b', change_available: false }]) } as unknown as jest.Mocked<SupabaseDataApiService>;
    const serviceApi = { rpc: jest.fn() } as unknown as jest.Mocked<SupabaseServiceRoleApiService>;
    const repository = new AccountRepository(dataApi, serviceApi);

    await repository.readPublicId(TOKEN);
    expect(dataApi.request).toHaveBeenLastCalledWith(TOKEN, 'rpc/read_own_public_id_v1', { method: 'POST', body: '{}' });
    await repository.changePublicId(TOKEN, COMMAND, '@a.b');
    expect(dataApi.request).toHaveBeenLastCalledWith(TOKEN, 'rpc/change_own_public_id_v1', {
      method: 'POST',
      body: JSON.stringify({ p_command_id: COMMAND, p_public_id: '@a.b' }),
    });
    expect(serviceApi.rpc).not.toHaveBeenCalled();
  });
});

describe('AccountController — the Public ID routes', () => {
  const proto = AccountController.prototype as unknown as Record<string, object>;

  it('both routes are guarded, owner-scoped by token, and take no path parameter', () => {
    expect(Reflect.getMetadata(PATH_METADATA, proto.readPublicId)).toBe('public-id');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.readPublicId)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(GUARDS_METADATA, proto.readPublicId)).toEqual([SupabaseAuthGuard]);
    expect(Reflect.getMetadata(PATH_METADATA, proto.changePublicId)).toBe('public-id/change');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.changePublicId)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, proto.changePublicId)).toBe(200);
    expect(Reflect.getMetadata(GUARDS_METADATA, proto.changePublicId)).toEqual([SupabaseAuthGuard]);
  });

  it('there is no Public-ID lookup, search or availability route', () => {
    const paths = Object.getOwnPropertyNames(AccountController.prototype)
      .map((name) => Reflect.getMetadata(PATH_METADATA, proto[name] ?? {}) as string | undefined)
      .filter((path): path is string => typeof path === 'string');
    expect(paths.filter((path) => path.includes('public-id')).sort()).toEqual(['public-id', 'public-id/change']);
    expect(paths.some((path) => /:|availability/u.test(path) && path.includes('public'))).toBe(false);
  });

  it('hands the controller’s token to the service and nothing from the path', async () => {
    const service = { readPublicId: jest.fn().mockResolvedValue({}), changePublicId: jest.fn().mockResolvedValue({}) } as unknown as jest.Mocked<AccountService>;
    const controller = new AccountController(service);
    const request = { authenticatedUser: { accessToken: TOKEN, userId: 'caller' } } as never;
    await controller.readPublicId(request);
    expect(service.readPublicId).toHaveBeenCalledWith(TOKEN);
    const body = { commandId: COMMAND, publicId: 'x' };
    await controller.changePublicId(request, body);
    expect(service.changePublicId).toHaveBeenCalledWith(TOKEN, body);
  });
});
