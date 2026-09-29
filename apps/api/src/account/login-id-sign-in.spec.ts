import { BadRequestException, ConflictException, RequestMethod, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { LoginIdSignInController } from './login-id-sign-in.controller';
import { LoginIdSignInRepository } from './login-id-sign-in.repository';
import { LoginIdSignInService, UNRESOLVED_LOGIN_ID_ADDRESS } from './login-id-sign-in.service';
import { SUPABASE_AUTH_API_VERSION, SupabasePasswordGrantService, type PasswordGrantVerdict } from './supabase-password-grant.service';

// W2-01 — sign in with a Login ID without any client learning which Email it belongs to (P1 §3).

const IP = '203.0.113.7';
const PASSWORD = ' correct horse ';
const OWNER_EMAIL = 'owner@example.test';

function harness(verdict: PasswordGrantVerdict = { kind: 'INVALID_CREDENTIALS' }) {
  const repository = { signInAddressOf: jest.fn(async (loginId: string) => (loginId === 'mohamed.allam87' ? OWNER_EMAIL : null)) } as unknown as jest.Mocked<LoginIdSignInRepository>;
  const grant = { isConfigured: jest.fn(() => true), grant: jest.fn(async () => verdict) } as unknown as jest.Mocked<SupabasePasswordGrantService>;
  return { repository, grant, service: new LoginIdSignInService(repository, grant) };
}

describe('LoginIdSignInService — the exchange', () => {
  it('resolves the canonical Login ID on the server and spends the provider’s own password grant with it', async () => {
    const { repository, grant, service } = harness({ kind: 'SESSION', accessToken: 'access-1', refreshToken: 'refresh-1' });
    await expect(service.exchange({ loginId: 'Mohamed.Allam87', password: PASSWORD }, IP)).resolves.toEqual({ kind: 'SESSION', accessToken: 'access-1', refreshToken: 'refresh-1' });
    expect(repository.signInAddressOf).toHaveBeenCalledWith('mohamed.allam87');
    // The password is handed on untouched, with the reader's own address for the provider's rate limit.
    expect(grant.grant).toHaveBeenCalledWith(OWNER_EMAIL, PASSWORD, IP);
  });

  it('an unknown, a malformed and a known-but-wrong Login ID meet ONE answer, through the same upstream path', async () => {
    const { grant, service } = harness({ kind: 'INVALID_CREDENTIALS' });
    const answers = [];
    for (const loginId of ['mohamed.allam87', 'nobody.here', 'ab', 'a@b', 'محمد']) answers.push(await service.exchange({ loginId, password: 'wrong' }, IP));
    expect(new Set(answers.map((answer) => JSON.stringify(answer)))).toEqual(new Set([JSON.stringify({ kind: 'INVALID_CREDENTIALS' })]));
    // Every attempt spent a real password grant — none was answered early — and an unresolved one spent
    // it against the reserved address no account can hold.
    expect(grant.grant).toHaveBeenCalledTimes(5);
    expect(grant.grant.mock.calls.map(([email]) => email)).toEqual([OWNER_EMAIL, UNRESOLVED_LOGIN_ID_ADDRESS, UNRESOLVED_LOGIN_ID_ADDRESS, UNRESOLVED_LOGIN_ID_ADDRESS, UNRESOLVED_LOGIN_ID_ADDRESS]);
    expect(UNRESOLVED_LOGIN_ID_ADDRESS).toMatch(/\.invalid$/u);
  });

  it('a malformed Login ID is never looked up', async () => {
    const { repository, service } = harness();
    for (const loginId of ['ab', '.abc', 'a b', 'x'.repeat(31)]) await service.exchange({ loginId, password: 'pw' }, IP);
    expect(repository.signInAddressOf).not.toHaveBeenCalled();
  });

  it('returns the account’s Email ONLY after the provider proved the password and reported it unverified', async () => {
    const { service } = harness({ kind: 'EMAIL_NOT_CONFIRMED' });
    await expect(service.exchange({ loginId: 'MOHAMED.allam87', password: PASSWORD }, IP)).resolves.toEqual({ kind: 'EMAIL_NOT_CONFIRMED', email: OWNER_EMAIL });
  });

  it('an unresolved Login ID can never be answered with anything but a refusal, whatever the provider says', async () => {
    for (const verdict of [{ kind: 'EMAIL_NOT_CONFIRMED' }, { kind: 'SESSION', accessToken: 'a', refreshToken: 'r' }] as const) {
      const { service } = harness(verdict);
      await expect(service.exchange({ loginId: 'nobody.here', password: 'pw' }, IP)).resolves.toEqual({ kind: 'INVALID_CREDENTIALS' });
    }
  });

  it('fails closed, before any lookup, without a secret key or without the reader’s address', async () => {
    const unconfigured = harness();
    unconfigured.grant.isConfigured.mockReturnValue(false);
    await expect(unconfigured.service.exchange({ loginId: 'mohamed.allam87', password: 'pw' }, IP)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    const anonymous = harness();
    await expect(anonymous.service.exchange({ loginId: 'mohamed.allam87', password: 'pw' }, undefined)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    for (const { repository, grant } of [unconfigured, anonymous]) {
      expect(repository.signInAddressOf).not.toHaveBeenCalled();
      expect(grant.grant).not.toHaveBeenCalled();
    }
  });

  it('a database that cannot answer is unavailable, and asks the provider nothing', async () => {
    const { repository, grant, service } = harness();
    repository.signInAddressOf.mockRejectedValue(new DataApiError(500));
    await expect(service.exchange({ loginId: 'mohamed.allam87', password: 'pw' }, IP)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    expect(grant.grant).not.toHaveBeenCalled();
  });

  it('refuses a body that is not exactly one bounded Login ID and one password', async () => {
    const { service } = harness();
    for (const body of [null, 'x', [], {}, { loginId: 'abc' }, { password: 'pw' }, { loginId: 'abc', password: 'pw', email: 'x@y.z' }, { loginId: 42, password: 'pw' }, { loginId: 'abc', password: '' }, { loginId: 'a'.repeat(65), password: 'pw' }, { loginId: 'abc', password: 'p'.repeat(1025) }]) {
      await expect(service.exchange(body, IP)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('logs nothing — no password, no Email, no token', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) => jest.spyOn(console, level).mockImplementation(() => undefined));
    const { service } = harness({ kind: 'SESSION', accessToken: 'access-1', refreshToken: 'refresh-1' });
    await service.exchange({ loginId: 'mohamed.allam87', password: PASSWORD }, IP);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});

describe('LoginIdSignInRepository — the server channel', () => {
  it('asks migration 0124’s function on the server channel only, and answers a string or null', async () => {
    const serviceApi = { rpc: jest.fn().mockResolvedValue(OWNER_EMAIL) } as unknown as jest.Mocked<SupabaseServiceRoleApiService>;
    const repository = new LoginIdSignInRepository(serviceApi);
    await expect(repository.signInAddressOf('mohamed.allam87')).resolves.toBe(OWNER_EMAIL);
    expect(serviceApi.rpc).toHaveBeenCalledWith('resolve_login_id_sign_in_email_v1', { p_login_id: 'mohamed.allam87' });
    serviceApi.rpc.mockResolvedValue(null);
    await expect(repository.signInAddressOf('nobody.here')).resolves.toBeNull();
  });
});

describe('SupabasePasswordGrantService — the provider’s own password grant', () => {
  const env = { ...process.env };
  const fetchMock = jest.fn();
  const answer = (status: number, body: unknown) => fetchMock.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => body });

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.supabase.example/';
    process.env.SUPABASE_SECRET_KEY = 'secret-key-fixture';
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterAll(() => {
    process.env = env;
  });

  it('authorizes with the SECRET key and forwards the reader’s address, so the provider’s per-IP limit applies to them', async () => {
    answer(200, { access_token: 'access-1', refresh_token: 'refresh-1', user: { email: OWNER_EMAIL } });
    await expect(new SupabasePasswordGrantService().grant(OWNER_EMAIL, PASSWORD, IP)).resolves.toEqual({ kind: 'SESSION', accessToken: 'access-1', refreshToken: 'refresh-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://project.supabase.example/auth/v1/token?grant_type=password');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ apikey: 'secret-key-fixture', 'Content-Type': 'application/json', 'X-Supabase-Api-Version': SUPABASE_AUTH_API_VERSION, 'Sb-Forwarded-For': IP });
    expect(JSON.parse(init.body)).toEqual({ email: OWNER_EMAIL, password: PASSWORD });
    expect(url).not.toContain(PASSWORD);
  });

  it.each([
    [400, { error_code: 'email_not_confirmed' }, 'EMAIL_NOT_CONFIRMED'],
    [400, { error_code: 'invalid_credentials' }, 'INVALID_CREDENTIALS'],
    [400, {}, 'INVALID_CREDENTIALS'],
    [422, { error_code: 'validation_failed' }, 'INVALID_CREDENTIALS'],
    [429, { error_code: 'over_request_rate_limit' }, 'UNAVAILABLE'],
    [500, null, 'UNAVAILABLE'],
    [503, {}, 'UNAVAILABLE'],
    [200, { access_token: 'only-one' }, 'UNAVAILABLE'],
  ])('status %i %j is the %s verdict', async (status, body, kind) => {
    answer(status, body);
    expect((await new SupabasePasswordGrantService().grant(OWNER_EMAIL, 'pw', IP)).kind).toBe(kind);
  });

  it('a transport failure, and a server without a secret key, are unavailable — never a shared bucket', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(new SupabasePasswordGrantService().grant(OWNER_EMAIL, 'pw', IP)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role-fixture';
    const unconfigured = new SupabasePasswordGrantService();
    expect(unconfigured.isConfigured()).toBe(false);
    await expect(unconfigured.grant(OWNER_EMAIL, 'pw', IP)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('LoginIdSignInController — the pre-authentication credential route', () => {
  it('mounts POST /account/login-id-sign-in, unguarded, answering 200', () => {
    const handler = LoginIdSignInController.prototype.signInWithLoginId as unknown as object;
    expect(Reflect.getMetadata(PATH_METADATA, LoginIdSignInController)).toBe('account');
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('login-id-sign-in');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
  });

  const respond = async (outcome: Awaited<ReturnType<LoginIdSignInService['exchange']>>) => {
    const service = { exchange: jest.fn().mockResolvedValue(outcome) } as unknown as jest.Mocked<LoginIdSignInService>;
    const controller = new LoginIdSignInController(service);
    try {
      return { status: 200, body: await controller.signInWithLoginId({ loginId: 'x', password: 'y' }, { ip: IP }) };
    } catch (error) {
      const exception = error as UnauthorizedException;
      return { status: exception.getStatus(), body: exception.getResponse() };
    } finally {
      expect(service.exchange).toHaveBeenCalledWith({ loginId: 'x', password: 'y' }, IP);
    }
  };

  it('answers fixed shapes that name an outcome and nothing else', async () => {
    await expect(respond({ kind: 'SESSION', accessToken: 'a', refreshToken: 'r' })).resolves.toEqual({ status: 200, body: { accessToken: 'a', refreshToken: 'r' } });
    await expect(respond({ kind: 'INVALID_CREDENTIALS' })).resolves.toEqual({ status: 401, body: { outcome: 'INVALID_CREDENTIALS' } });
    await expect(respond({ kind: 'UNAVAILABLE' })).resolves.toEqual({ status: 503, body: { outcome: 'UNAVAILABLE' } });
    await expect(respond({ kind: 'EMAIL_NOT_CONFIRMED', email: OWNER_EMAIL })).resolves.toEqual({ status: 409, body: { outcome: 'EMAIL_NOT_CONFIRMED', email: OWNER_EMAIL } });
  });

  it('only the password-proved 409 ever carries an Email', async () => {
    for (const outcome of [{ kind: 'INVALID_CREDENTIALS' }, { kind: 'UNAVAILABLE' }, { kind: 'SESSION', accessToken: 'a', refreshToken: 'r' }] as const) {
      expect(JSON.stringify((await respond(outcome)).body)).not.toMatch(/@|email/iu);
    }
    expect(new ConflictException({}).getStatus()).toBe(409);
    expect(new ServiceUnavailableException({}).getStatus()).toBe(503);
  });
});
