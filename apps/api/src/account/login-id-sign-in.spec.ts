import { BadRequestException, ConflictException, RequestMethod, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { LoginIdSignInController } from './login-id-sign-in.controller';
import { LoginIdSignInRepository } from './login-id-sign-in.repository';
import { LoginIdSignInService, UNRESOLVED_LOGIN_ID_ADDRESS } from './login-id-sign-in.service';
import { SUPABASE_AUTH_API_VERSION, SupabasePasswordGrantService, type EmailCodeVerdict, type PasswordGrantVerdict, type ResendVerdict } from './supabase-password-grant.service';

// W2-01 — sign in with a Login ID without any client learning which Email it belongs to (P1 §3).
// W2-01 R1 — including after the password was proved: the unconfirmed path and its verify / resend.

const IP = '203.0.113.7';
const PASSWORD = ' correct horse ';
const OWNER_EMAIL = 'owner@example.test';

function harness(verdict: PasswordGrantVerdict = { kind: 'INVALID_CREDENTIALS' }, code: EmailCodeVerdict = { kind: 'CODE_REJECTED' }, resend: ResendVerdict = { kind: 'ACCEPTED' }) {
  const repository = { signInAddressOf: jest.fn(async (loginId: string) => (loginId === 'mohamed.allam87' ? OWNER_EMAIL : null)) } as unknown as jest.Mocked<LoginIdSignInRepository>;
  const grant = { isConfigured: jest.fn(() => true), grant: jest.fn(async () => verdict), verifyEmailCode: jest.fn(async () => code), resendEmailCode: jest.fn(async () => resend) } as unknown as jest.Mocked<SupabasePasswordGrantService>;
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

  it('a proved password with an unverified Email is EMAIL_NOT_CONFIRMED and nothing more — the resolved Email stays on the server', async () => {
    const { grant, service } = harness({ kind: 'EMAIL_NOT_CONFIRMED' });
    const outcome = await service.exchange({ loginId: 'MOHAMED.allam87', password: PASSWORD }, IP);
    expect(outcome).toStrictEqual({ kind: 'EMAIL_NOT_CONFIRMED' });
    expect(JSON.stringify(outcome)).not.toContain(OWNER_EMAIL);
    // The Email was used — internally, for the one provider request — and nowhere else.
    expect(grant.grant).toHaveBeenCalledWith(OWNER_EMAIL, PASSWORD, IP);
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
    await expect(respond({ kind: 'EMAIL_NOT_CONFIRMED' })).resolves.toStrictEqual({ status: 409, body: { outcome: 'EMAIL_NOT_CONFIRMED' } });
  });

  it('no answer ever carries an Email — not even the password-proved 409', async () => {
    for (const outcome of [{ kind: 'EMAIL_NOT_CONFIRMED' }, { kind: 'INVALID_CREDENTIALS' }, { kind: 'UNAVAILABLE' }, { kind: 'SESSION', accessToken: 'a', refreshToken: 'r' }] as const) {
      const { body } = await respond(outcome);
      expect(Object.keys(body as object).filter((key) => /email|account|user/iu.test(key))).toEqual([]);
      expect(JSON.stringify(body)).not.toContain('@');
    }
    expect(new ConflictException({}).getStatus()).toBe(409);
    expect(new ServiceUnavailableException({}).getStatus()).toBe(503);
  });
});

describe('W2-01 R1 — the Login-ID-origin Email verification, on the server', () => {
  const EMAIL_LIKE = /@|email|owner/iu;

  it('verifies the code against the Email it resolves itself, and answers the provider’s session — never the Email', async () => {
    const { repository, grant, service } = harness(undefined, { kind: 'SESSION', accessToken: 'access-2', refreshToken: 'refresh-2' });
    const outcome = await service.verifyEmail({ loginId: 'Mohamed.Allam87', code: '123456' }, IP);
    expect(outcome).toStrictEqual({ kind: 'SESSION', accessToken: 'access-2', refreshToken: 'refresh-2' });
    expect(repository.signInAddressOf).toHaveBeenCalledWith('mohamed.allam87');
    expect(grant.verifyEmailCode).toHaveBeenCalledWith(OWNER_EMAIL, '123456', IP);
    expect(JSON.stringify(outcome)).not.toMatch(EMAIL_LIKE);
  });

  it('a rejected code, an unknown Login ID and a malformed one meet ONE bounded answer, each through the provider', async () => {
    const { grant, service } = harness(undefined, { kind: 'CODE_REJECTED' });
    const answers = [];
    for (const loginId of ['mohamed.allam87', 'nobody.here', 'ab']) answers.push(await service.verifyEmail({ loginId, code: '000000' }, IP));
    expect(new Set(answers.map((answer) => JSON.stringify(answer)))).toEqual(new Set([JSON.stringify({ kind: 'CODE_REJECTED' })]));
    expect(grant.verifyEmailCode.mock.calls.map(([email]) => email)).toEqual([OWNER_EMAIL, UNRESOLVED_LOGIN_ID_ADDRESS, UNRESOLVED_LOGIN_ID_ADDRESS]);
  });

  it('an unresolved Login ID can never be answered with a session, whatever the provider says', async () => {
    const { service } = harness(undefined, { kind: 'SESSION', accessToken: 'a', refreshToken: 'r' });
    await expect(service.verifyEmail({ loginId: 'nobody.here', code: '123456' }, IP)).resolves.toStrictEqual({ kind: 'CODE_REJECTED' });
  });

  it('resend resolves on the server, asks the provider with that Email, and answers ONE result for every Login ID', async () => {
    const { grant, service } = harness();
    const answers = [];
    for (const loginId of ['MOHAMED.allam87', 'nobody.here', 'ab']) answers.push(await service.resendVerification({ loginId }, IP));
    expect(new Set(answers.map((answer) => JSON.stringify(answer)))).toEqual(new Set([JSON.stringify({ kind: 'ACCEPTED' })]));
    expect(grant.resendEmailCode.mock.calls).toEqual([[OWNER_EMAIL, IP], [UNRESOLVED_LOGIN_ID_ADDRESS, IP], [UNRESOLVED_LOGIN_ID_ADDRESS, IP]]);
  });

  it('both fail closed before any lookup without a secret key or the reader’s address', async () => {
    const unconfigured = harness();
    unconfigured.grant.isConfigured.mockReturnValue(false);
    await expect(unconfigured.service.verifyEmail({ loginId: 'mohamed.allam87', code: '123456' }, IP)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    await expect(unconfigured.service.resendVerification({ loginId: 'mohamed.allam87' }, IP)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    const anonymous = harness();
    await expect(anonymous.service.verifyEmail({ loginId: 'mohamed.allam87', code: '123456' }, undefined)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    await expect(anonymous.service.resendVerification({ loginId: 'mohamed.allam87' }, '')).resolves.toEqual({ kind: 'UNAVAILABLE' });
    for (const { repository, grant } of [unconfigured, anonymous]) {
      expect(repository.signInAddressOf).not.toHaveBeenCalled();
      expect(grant.verifyEmailCode).not.toHaveBeenCalled();
      expect(grant.resendEmailCode).not.toHaveBeenCalled();
    }
  });

  it('refuses a body that is not exactly one bounded Login ID and one 6-digit code (verify) or one Login ID (resend)', async () => {
    const { service } = harness();
    for (const body of [null, {}, { loginId: 'abc' }, { code: '123456' }, { loginId: 'abc', code: '12345' }, { loginId: 'abc', code: '1234567' }, { loginId: 'abc', code: '12a456' }, { loginId: 'abc', code: '123456', email: 'x@y.z' }, { loginId: 'a'.repeat(65), code: '123456' }]) {
      await expect(service.verifyEmail(body, IP)).rejects.toBeInstanceOf(BadRequestException);
    }
    for (const body of [null, {}, { loginId: '' }, { loginId: 7 }, { loginId: 'abc', email: 'x@y.z' }, { loginId: 'a'.repeat(65) }]) {
      await expect(service.resendVerification(body, IP)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('logs nothing — no code, no Email, no token', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) => jest.spyOn(console, level).mockImplementation(() => undefined));
    const { service } = harness(undefined, { kind: 'SESSION', accessToken: 'access-2', refreshToken: 'refresh-2' });
    await service.verifyEmail({ loginId: 'mohamed.allam87', code: '123456' }, IP);
    await service.resendVerification({ loginId: 'mohamed.allam87' }, IP);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});

describe('W2-01 R1 — the provider’s own verify and resend, asked from the server', () => {
  const env = { ...process.env };
  const fetchMock = jest.fn();
  const answer = (status: number, body: unknown) => fetchMock.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => body });

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.supabase.example';
    process.env.SUPABASE_SECRET_KEY = 'secret-key-fixture';
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterAll(() => {
    process.env = env;
  });

  it('verify: POST /auth/v1/verify with the Email-code type, the secret key and the reader’s address; the tokens only', async () => {
    answer(200, { access_token: 'access-2', refresh_token: 'refresh-2', user: { email: OWNER_EMAIL } });
    await expect(new SupabasePasswordGrantService().verifyEmailCode(OWNER_EMAIL, '123456', IP)).resolves.toStrictEqual({ kind: 'SESSION', accessToken: 'access-2', refreshToken: 'refresh-2' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://project.supabase.example/auth/v1/verify');
    expect(init.headers).toEqual({ apikey: 'secret-key-fixture', 'Content-Type': 'application/json', 'X-Supabase-Api-Version': SUPABASE_AUTH_API_VERSION, 'Sb-Forwarded-For': IP });
    expect(JSON.parse(init.body)).toEqual({ type: 'email', email: OWNER_EMAIL, token: '123456' });
  });

  it.each([
    [403, { error_code: 'otp_expired' }, 'CODE_REJECTED'],
    [400, { error_code: 'validation_failed' }, 'CODE_REJECTED'],
    [429, { error_code: 'over_request_rate_limit' }, 'UNAVAILABLE'],
    [500, null, 'UNAVAILABLE'],
    [200, { access_token: 'only-one' }, 'UNAVAILABLE'],
  ])('verify: status %i %j is the %s verdict', async (status, body, kind) => {
    answer(status, body);
    expect((await new SupabasePasswordGrantService().verifyEmailCode(OWNER_EMAIL, '123456', IP)).kind).toBe(kind);
  });

  it('resend: POST /auth/v1/resend with the sign-up type; EVERY answered request is one result, only no answer is unavailable', async () => {
    const service = new SupabasePasswordGrantService();
    for (const [status, body] of [[200, {}], [400, { error_code: 'email_exists' }], [429, { error_code: 'over_email_send_rate_limit' }], [500, { msg: `Error sending confirmation email to ${OWNER_EMAIL}` }]] as const) {
      answer(status, body);
      await expect(service.resendEmailCode(OWNER_EMAIL, IP)).resolves.toStrictEqual({ kind: 'ACCEPTED' });
    }
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://project.supabase.example/auth/v1/resend');
    expect(init.headers['Sb-Forwarded-For']).toBe(IP);
    expect(JSON.parse(init.body)).toEqual({ type: 'signup', email: OWNER_EMAIL });
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(service.resendEmailCode(OWNER_EMAIL, IP)).resolves.toStrictEqual({ kind: 'UNAVAILABLE' });
  });
});

describe('W2-01 R1 — LoginIdSignInController, the verify and resend routes', () => {
  it('mounts POST /account/login-id-verify-email and /account/login-id-resend-verification, unguarded, answering 200', () => {
    for (const [name, path] of [['verifyLoginIdEmail', 'login-id-verify-email'], ['resendLoginIdVerification', 'login-id-resend-verification']] as const) {
      const handler = LoginIdSignInController.prototype[name] as unknown as object;
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
    }
  });

  const call = async (run: () => Promise<unknown>) => {
    try {
      return { status: 200, body: await run() };
    } catch (error) {
      const exception = error as UnauthorizedException;
      return { status: exception.getStatus(), body: exception.getResponse() };
    }
  };

  it('verify answers the tokens, one bounded rejection, or unavailable — never an Email', async () => {
    const cases = [
      [{ kind: 'SESSION', accessToken: 'a', refreshToken: 'r' }, { status: 200, body: { accessToken: 'a', refreshToken: 'r' } }],
      [{ kind: 'CODE_REJECTED' }, { status: 401, body: { outcome: 'CODE_REJECTED' } }],
      [{ kind: 'UNAVAILABLE' }, { status: 503, body: { outcome: 'UNAVAILABLE' } }],
    ] as const;
    for (const [outcome, expected] of cases) {
      const service = { verifyEmail: jest.fn().mockResolvedValue(outcome) } as unknown as jest.Mocked<LoginIdSignInService>;
      const answer = await call(() => new LoginIdSignInController(service).verifyLoginIdEmail({ loginId: 'x', code: '123456' }, { ip: IP }));
      expect(answer).toStrictEqual(expected);
      expect(JSON.stringify(answer.body)).not.toMatch(/@|email/iu);
      expect(service.verifyEmail).toHaveBeenCalledWith({ loginId: 'x', code: '123456' }, IP);
    }
  });

  it('resend answers ACCEPTED or unavailable — never an Email, never the provider’s words', async () => {
    for (const [outcome, expected] of [[{ kind: 'ACCEPTED' }, { status: 200, body: { outcome: 'ACCEPTED' } }], [{ kind: 'UNAVAILABLE' }, { status: 503, body: { outcome: 'UNAVAILABLE' } }]] as const) {
      const service = { resendVerification: jest.fn().mockResolvedValue(outcome) } as unknown as jest.Mocked<LoginIdSignInService>;
      const answer = await call(() => new LoginIdSignInController(service).resendLoginIdVerification({ loginId: 'x' }, { ip: IP }));
      expect(answer).toStrictEqual(expected);
      expect(service.resendVerification).toHaveBeenCalledWith({ loginId: 'x' }, IP);
    }
  });
});