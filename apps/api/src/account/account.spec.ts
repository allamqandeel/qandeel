import { BadRequestException, RequestMethod, ServiceUnavailableException } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DataApiError, SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { AccountController } from './account.controller';
import { AccountRepository } from './account.repository';
import { AccountService, isWellFormedLoginId } from './account.service';

// W1B-01 — the account's Product routes: the caller's own first-use state, the caller's own Welcome
// completion, and the one pre-authentication Login ID availability question.

const TOKEN = 'caller-token';

describe('AccountService — first use', () => {
  let repository: jest.Mocked<AccountRepository>;
  let service: AccountService;

  beforeEach(() => {
    repository = {
      readFirstUse: jest.fn(),
      completeWelcome: jest.fn().mockResolvedValue(undefined),
      isLoginIdAvailable: jest.fn(),
    } as unknown as jest.Mocked<AccountRepository>;
    service = new AccountService(repository);
  });

  it('owes a brand-new named account the Welcome and the First Conversation Opening', async () => {
    repository.readFirstUse.mockResolvedValue({ name: 'أحمد', welcome_completed: false, has_conversed: false });
    await expect(service.readFirstUse(TOKEN)).resolves.toEqual({ displayName: 'أحمد', welcomePending: true, firstConversationOpening: true });
    expect(repository.readFirstUse).toHaveBeenCalledWith(TOKEN);
  });

  it('after the Welcome, still owes the First Conversation Opening until the first committed turn', async () => {
    repository.readFirstUse.mockResolvedValue({ name: 'Mona', welcome_completed: true, has_conversed: false });
    await expect(service.readFirstUse(TOKEN)).resolves.toEqual({ displayName: 'Mona', welcomePending: false, firstConversationOpening: true });
  });

  it('after the first committed turn, owes neither: the normal opener serves every later empty Conversation', async () => {
    repository.readFirstUse.mockResolvedValue({ name: 'Mona', welcome_completed: true, has_conversed: true });
    await expect(service.readFirstUse(TOKEN)).resolves.toEqual({ displayName: 'Mona', welcomePending: false, firstConversationOpening: false });
  });

  it('never shows a Welcome to an account that has already conversed, even if the Welcome was never completed', async () => {
    repository.readFirstUse.mockResolvedValue({ name: 'Mona', welcome_completed: false, has_conversed: true });
    expect((await service.readFirstUse(TOKEN)).welcomePending).toBe(false);
  });

  it('invents no name for an account without one, and owes it no Welcome', async () => {
    repository.readFirstUse.mockResolvedValue({ name: null, welcome_completed: false, has_conversed: false });
    await expect(service.readFirstUse(TOKEN)).resolves.toEqual({ displayName: null, welcomePending: false, firstConversationOpening: true });
  });

  it('reports an unreadable account as unavailable, never as a fabricated state', async () => {
    repository.readFirstUse.mockRejectedValue(new DataApiError(500));
    await expect(service.readFirstUse(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
    repository.readFirstUse.mockResolvedValue(undefined);
    await expect(service.readFirstUse(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('completes the Welcome with the caller’s own token only', async () => {
    await service.completeWelcome(TOKEN);
    expect(repository.completeWelcome).toHaveBeenCalledWith(TOKEN);
    repository.completeWelcome.mockRejectedValue(new DataApiError(503));
    await expect(service.completeWelcome(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('AccountService — Login ID availability', () => {
  let repository: jest.Mocked<AccountRepository>;
  let service: AccountService;

  beforeEach(() => {
    repository = { readFirstUse: jest.fn(), completeWelcome: jest.fn(), isLoginIdAvailable: jest.fn().mockResolvedValue(true) } as unknown as jest.Mocked<AccountRepository>;
    service = new AccountService(repository);
  });

  it('answers a boolean, and asks the database with the canonical lowercase form', async () => {
    await expect(service.checkLoginIdAvailability({ loginId: 'Mohamed.Allam87' })).resolves.toEqual({ available: true });
    expect(repository.isLoginIdAvailable).toHaveBeenCalledWith('mohamed.allam87');
    repository.isLoginIdAvailable.mockResolvedValue(false);
    await expect(service.checkLoginIdAvailability({ loginId: 'taken.one' })).resolves.toEqual({ available: false });
  });

  it('answers a malformed Login ID as unavailable without asking the database', async () => {
    for (const loginId of ['', 'ab', 'a'.repeat(31), '.abc', 'abc.', 'ab..cd', 'ab cd', 'محمد', 'a@b.c']) {
      await expect(service.checkLoginIdAvailability({ loginId })).resolves.toEqual({ available: false });
    }
    expect(repository.isLoginIdAvailable).not.toHaveBeenCalled();
  });

  it('refuses a body that is not exactly one bounded Login ID', async () => {
    for (const body of [null, 'abc', [], {}, { loginId: 42 }, { loginId: 'abc', email: 'x@y.z' }, { loginId: 'a'.repeat(65) }]) {
      await expect(service.checkLoginIdAvailability(body)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('reports a failed check as unavailable service, never as "available"', async () => {
    repository.isLoginIdAvailable.mockRejectedValue(new DataApiError(500));
    await expect(service.checkLoginIdAvailability({ loginId: 'fresh.choice' })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('the grammar is the migration’s grammar', () => {
    for (const legal of ['abc', 'a'.repeat(30), 'a.b-c_d', '007', 'Mohamed.Allam87']) expect(isWellFormedLoginId(legal)).toBe(true);
    for (const illegal of ['ab', 'a'.repeat(31), '_abc', 'abc-', 'a..b', 'a._b', 'a b', 'محمد', 'ab$c']) expect(isWellFormedLoginId(illegal)).toBe(false);
  });
});

describe('AccountRepository — the transports', () => {
  it('reads and completes on the caller’s token, and checks availability on the server channel only', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([{ name: 'A', welcome_completed: false, has_conversed: false }]) } as unknown as jest.Mocked<SupabaseDataApiService>;
    const serviceApi = { rpc: jest.fn().mockResolvedValue(true) } as unknown as jest.Mocked<SupabaseServiceRoleApiService>;
    const repository = new AccountRepository(dataApi, serviceApi);

    await expect(repository.readFirstUse(TOKEN)).resolves.toEqual({ name: 'A', welcome_completed: false, has_conversed: false });
    expect(dataApi.request).toHaveBeenLastCalledWith(TOKEN, 'rpc/read_account_first_use_v1', { method: 'POST', body: '{}' });
    await repository.completeWelcome(TOKEN);
    expect(dataApi.request).toHaveBeenLastCalledWith(TOKEN, 'rpc/complete_first_use_welcome_v1', { method: 'POST', body: '{}' });
    await expect(repository.isLoginIdAvailable('fresh.choice')).resolves.toBe(true);
    expect(serviceApi.rpc).toHaveBeenCalledWith('login_id_is_available_v1', { p_login_id: 'fresh.choice' });
    expect(dataApi.request).toHaveBeenCalledTimes(2);
  });
});

describe('AccountController — routes and guards', () => {
  const route = (method: keyof AccountController) => {
    const handler = AccountController.prototype[method] as unknown as object;
    return {
      path: Reflect.getMetadata(PATH_METADATA, handler),
      method: Reflect.getMetadata(METHOD_METADATA, handler),
      guards: Reflect.getMetadata(GUARDS_METADATA, handler) ?? [],
      code: Reflect.getMetadata(HTTP_CODE_METADATA, handler),
    };
  };

  it('mounts under /account', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AccountController)).toBe('account');
    expect(Reflect.getMetadata(GUARDS_METADATA, AccountController)).toBeUndefined();
  });

  it('guards the two first-use routes with the Supabase guard', () => {
    expect(route('readFirstUse')).toEqual({ path: 'first-use', method: RequestMethod.GET, guards: [SupabaseAuthGuard], code: undefined });
    expect(route('completeWelcome')).toEqual({ path: 'first-use/welcome', method: RequestMethod.POST, guards: [SupabaseAuthGuard], code: 204 });
  });

  it('leaves only the availability question reachable before authentication, as a POST body', () => {
    expect(route('checkLoginIdAvailability')).toEqual({ path: 'login-id-availability', method: RequestMethod.POST, guards: [], code: 200 });
  });

  it('passes the caller’s own token, never a caller-supplied id', async () => {
    const accounts = { readFirstUse: jest.fn().mockResolvedValue({}), completeWelcome: jest.fn(), checkLoginIdAvailability: jest.fn() } as unknown as jest.Mocked<AccountService>;
    const controller = new AccountController(accounts);
    const request = { headers: {}, authenticatedUser: { userId: 'owner', accessToken: TOKEN } };
    await controller.readFirstUse(request);
    await controller.completeWelcome(request);
    expect(accounts.readFirstUse).toHaveBeenCalledWith(TOKEN);
    expect(accounts.completeWelcome).toHaveBeenCalledWith(TOKEN);
  });
});
