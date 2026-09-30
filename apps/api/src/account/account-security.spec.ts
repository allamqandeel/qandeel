import { BadRequestException, ConflictException, RequestMethod, ServiceUnavailableException } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { AccountIdentityRepository } from './account-identity.repository';
import { AccountSecurityController } from './account-security.controller';
import { AccountSecurityService } from './account-security.service';
import { SupabasePasswordGrantService } from './supabase-password-grant.service';

// W3-MEGA-A — Account & Identity Completion + Security v1, the server boundary. The database (migration 0129) decides
// the Name and Login ID outcomes; the provider decides every password, Email and session outcome. This boundary
// acts for the caller only, decodes strictly, never reveals whether another account holds a value, and never guesses.

const TOKEN = 'caller-token';
const PROOF = 'proof-token';
const IP = '203.0.113.7';
const COMMAND = '6f1f3a52-9d4e-4c1b-8a7e-2b9c0d4e5f60';
const OWNER = { email: 'noor@example.test', emailVerified: true };

function makeService() {
  const repository = {
    readIdentity: jest.fn(),
    changeName: jest.fn(),
    changeLoginId: jest.fn(),
  } as unknown as jest.Mocked<AccountIdentityRepository>;
  const provider = {
    isConfigured: jest.fn().mockReturnValue(true),
    grant: jest.fn().mockResolvedValue({ kind: 'SESSION', accessToken: PROOF, refreshToken: 'r' }),
    readOwnUser: jest.fn().mockResolvedValue(OWNER),
    requestEmailChange: jest.fn().mockResolvedValue({ kind: 'ACCEPTED' }),
    verifyEmailChangeCode: jest.fn(),
    changePassword: jest.fn().mockResolvedValue({ kind: 'CHANGED' }),
    endSessions: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<SupabasePasswordGrantService>;
  return { repository, provider, service: new AccountSecurityService(repository, provider) };
}

describe('AccountSecurityService — the owner’s identity read', () => {
  it('returns the owner’s Name, Login ID, Email and status — and nothing else', async () => {
    const { repository, provider, service } = makeService();
    repository.readIdentity.mockResolvedValue({ name: 'Noor', login_id: 'noor.h' });
    await expect(service.readIdentity(TOKEN, IP)).resolves.toEqual({ name: 'Noor', loginId: 'noor.h', email: OWNER.email, emailVerified: true });
    expect(repository.readIdentity).toHaveBeenCalledWith(TOKEN);
    expect(provider.readOwnUser).toHaveBeenCalledWith(TOKEN, IP);
  });

  it('is unavailable — never a guess — when either part is unreadable, or the relay is not configured', async () => {
    const { repository, provider, service } = makeService();
    repository.readIdentity.mockResolvedValue({ name: 'Noor', login_id: 'noor.h' });
    provider.readOwnUser.mockResolvedValueOnce(null);
    await expect(service.readIdentity(TOKEN, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
    repository.readIdentity.mockRejectedValueOnce(new DataApiError(500));
    await expect(service.readIdentity(TOKEN, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.readIdentity(TOKEN, undefined)).rejects.toBeInstanceOf(ServiceUnavailableException);
    provider.isConfigured.mockReturnValue(false);
    await expect(service.readIdentity(TOKEN, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('AccountSecurityService — the Name', () => {
  it.each(['CHANGED', 'UNCHANGED', 'INVALID'])('maps the database’s %s outcome with the owner’s resulting Name', async (outcome) => {
    const { repository, service } = makeService();
    repository.changeName.mockResolvedValue({ outcome, current_name: 'Noor' });
    await expect(service.changeName(TOKEN, { name: ' Noor ' })).resolves.toEqual({ outcome, name: 'Noor' });
    expect(repository.changeName).toHaveBeenCalledWith(TOKEN, ' Noor ');
  });

  it('refuses any other body — there is no account field — and never invents an outcome', async () => {
    const { repository, service } = makeService();
    for (const body of [null, [], {}, { name: 7 }, { name: 'x'.repeat(201) }, { name: 'a', userId: 'x' }]) {
      await expect(service.changeName(TOKEN, body)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(repository.changeName).not.toHaveBeenCalled();
    repository.changeName.mockResolvedValue({ outcome: 'MAYBE', current_name: 'x' });
    await expect(service.changeName(TOKEN, { name: 'a' })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('AccountSecurityService — the Login ID, behind the provider’s own password check', () => {
  it('proves the password on the caller’s own Email, changes on the PROOF token, then ends the proof session', async () => {
    const { repository, provider, service } = makeService();
    repository.changeLoginId.mockResolvedValue({ outcome: 'CHANGED', current_login_id: 'noor.new' });
    await expect(service.changeLoginId(TOKEN, { commandId: COMMAND.toUpperCase(), loginId: 'Noor.New', password: 'pw' }, IP))
      .resolves.toEqual({ outcome: 'CHANGED', loginId: 'noor.new' });
    expect(provider.grant).toHaveBeenCalledWith(OWNER.email, 'pw', IP);
    expect(repository.changeLoginId).toHaveBeenCalledWith(PROOF, COMMAND, 'Noor.New');
    expect(provider.endSessions).toHaveBeenCalledWith(PROOF, 'local', IP);
  });

  it('a wrong password changes nothing and says only that', async () => {
    const { repository, provider, service } = makeService();
    provider.grant.mockResolvedValue({ kind: 'INVALID_CREDENTIALS' });
    await expect(service.changeLoginId(TOKEN, { commandId: COMMAND, loginId: 'x.y', password: 'bad' }, IP)).resolves.toEqual({ outcome: 'PASSWORD_REJECTED' });
    expect(repository.changeLoginId).not.toHaveBeenCalled();
  });

  it.each(['UNCHANGED', 'INVALID', 'UNAVAILABLE'])('passes %s through, and still ends the proof session', async (outcome) => {
    const { repository, provider, service } = makeService();
    repository.changeLoginId.mockResolvedValue({ outcome, current_login_id: 'noor.h' });
    await expect(service.changeLoginId(TOKEN, { commandId: COMMAND, loginId: 'x', password: 'pw' }, IP)).resolves.toEqual({ outcome, loginId: 'noor.h' });
    expect(provider.endSessions).toHaveBeenCalledWith(PROOF, 'local', IP);
  });

  it('a reused command identity is a conflict; every other failure is unavailable; the proof session ends either way', async () => {
    const { repository, provider, service } = makeService();
    repository.changeLoginId.mockRejectedValueOnce(new DataApiError(409));
    await expect(service.changeLoginId(TOKEN, { commandId: COMMAND, loginId: 'x.y', password: 'pw' }, IP)).rejects.toBeInstanceOf(ConflictException);
    repository.changeLoginId.mockRejectedValueOnce(new DataApiError(403));
    await expect(service.changeLoginId(TOKEN, { commandId: COMMAND, loginId: 'x.y', password: 'pw' }, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(provider.endSessions).toHaveBeenCalledTimes(2);
    provider.grant.mockResolvedValue({ kind: 'UNAVAILABLE' });
    await expect(service.changeLoginId(TOKEN, { commandId: COMMAND, loginId: 'x.y', password: 'pw' }, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('refuses a body with any account field, a malformed command or an empty password', async () => {
    const { provider, service } = makeService();
    for (const body of [{}, { commandId: 'nope', loginId: 'a', password: 'p' }, { commandId: COMMAND, loginId: 'a', password: '' },
      { commandId: COMMAND, loginId: 'a', password: 'p', userId: 'x' }, { commandId: COMMAND, loginId: 'a'.repeat(65), password: 'p' }]) {
      await expect(service.changeLoginId(TOKEN, body, IP)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(provider.grant).not.toHaveBeenCalled();
  });
});

describe('AccountSecurityService — Change Email (W3-PDG-01 §2)', () => {
  it('password first, then the new Email; nothing changes yet, and the proof session ends', async () => {
    const { provider, service } = makeService();
    await expect(service.requestEmailChange(TOKEN, { password: 'pw', email: ' new@example.test ' }, IP)).resolves.toEqual({ outcome: 'ACCEPTED' });
    expect(provider.grant).toHaveBeenCalledWith(OWNER.email, 'pw', IP);
    expect(provider.endSessions).toHaveBeenCalledWith(PROOF, 'local', IP);
    expect(provider.requestEmailChange).toHaveBeenCalledWith(TOKEN, 'new@example.test', IP);
  });

  it('a wrong password asks nothing of the new Email', async () => {
    const { provider, service } = makeService();
    provider.grant.mockResolvedValue({ kind: 'INVALID_CREDENTIALS' });
    await expect(service.requestEmailChange(TOKEN, { password: 'bad', email: 'new@example.test' }, IP)).resolves.toEqual({ outcome: 'PASSWORD_REJECTED' });
    expect(provider.requestEmailChange).not.toHaveBeenCalled();
  });

  it('the current Email is UNCHANGED; an implausible one is INVALID_EMAIL before any provider call', async () => {
    const { provider, service } = makeService();
    await expect(service.requestEmailChange(TOKEN, { password: 'pw', email: 'NOOR@example.test' }, IP)).resolves.toEqual({ outcome: 'UNCHANGED' });
    expect(provider.requestEmailChange).not.toHaveBeenCalled();
    await expect(service.requestEmailChange(TOKEN, { password: 'pw', email: 'not an email' }, IP)).resolves.toEqual({ outcome: 'INVALID_EMAIL' });
  });

  it('confirms the CURRENT Email first, then the new one, and only then ends both sessions', async () => {
    const { provider, service } = makeService();
    provider.verifyEmailChangeCode
      .mockResolvedValueOnce({ kind: 'CONFIRMED' })
      .mockResolvedValueOnce({ kind: 'SESSION', accessToken: 'provider-session', refreshToken: 'r' });
    await expect(service.confirmEmailChange(TOKEN, { email: 'new@example.test', newEmailCode: '111111', currentEmailCode: '222222' }, IP))
      .resolves.toEqual({ outcome: 'CHANGED' });
    expect(provider.verifyEmailChangeCode.mock.calls).toEqual([[OWNER.email, '222222', IP], ['new@example.test', '111111', IP]]);
    expect(provider.endSessions.mock.calls).toEqual([['provider-session', 'local', IP], [TOKEN, 'local', IP]]);
  });

  it('a rejected current-Email code never reaches the new Email: no partial change is possible', async () => {
    const { provider, service } = makeService();
    provider.verifyEmailChangeCode.mockResolvedValueOnce({ kind: 'CODE_REJECTED' });
    await expect(service.confirmEmailChange(TOKEN, { email: 'new@example.test', newEmailCode: '111111', currentEmailCode: '000000' }, IP))
      .resolves.toEqual({ outcome: 'CODE_REJECTED' });
    expect(provider.verifyEmailChangeCode).toHaveBeenCalledTimes(1);
    expect(provider.endSessions).not.toHaveBeenCalled();
  });

  it('a rejected new-Email code (wrong, expired, or an address another account holds) is ONE answer and ends nothing', async () => {
    const { provider, service } = makeService();
    provider.verifyEmailChangeCode.mockResolvedValueOnce({ kind: 'CONFIRMED' }).mockResolvedValueOnce({ kind: 'CODE_REJECTED' });
    await expect(service.confirmEmailChange(TOKEN, { email: 'taken@example.test', newEmailCode: '111111', currentEmailCode: '222222' }, IP))
      .resolves.toEqual({ outcome: 'CODE_REJECTED' });
    expect(provider.endSessions).not.toHaveBeenCalled();
  });

  it('a retry after a lost answer reconciles from the canonical Email: already the new one → CHANGED, no code spent', async () => {
    const { provider, service } = makeService();
    provider.readOwnUser.mockResolvedValue({ email: 'new@example.test', emailVerified: true });
    await expect(service.confirmEmailChange(TOKEN, { email: 'NEW@example.test', newEmailCode: '111111', currentEmailCode: '222222' }, IP))
      .resolves.toEqual({ outcome: 'CHANGED' });
    expect(provider.verifyEmailChangeCode).not.toHaveBeenCalled();
    expect(provider.endSessions).toHaveBeenCalledWith(TOKEN, 'local', IP);
  });

  it('no usable provider answer is unavailable; codes must be six digits', async () => {
    const { provider, service } = makeService();
    provider.verifyEmailChangeCode.mockResolvedValueOnce({ kind: 'UNAVAILABLE' });
    await expect(service.confirmEmailChange(TOKEN, { email: 'n@e.st', newEmailCode: '111111', currentEmailCode: '222222' }, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
    for (const body of [{ email: 'n@e.st', newEmailCode: '11111', currentEmailCode: '222222' }, { email: 'n@e.st', newEmailCode: '١١١١١١', currentEmailCode: '222222' }]) {
      await expect(service.confirmEmailChange(TOKEN, body, IP)).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});

describe('AccountSecurityService — Change Password and Sign out from other devices (W3-PDG-01 §3)', () => {
  it('changes on the owner’s session: the provider ends the others, the current device continues', async () => {
    const { provider, service } = makeService();
    await expect(service.changePassword(TOKEN, { password: 'old', newPassword: 'new-strong' }, IP)).resolves.toEqual({ outcome: 'CHANGED' });
    expect(provider.grant).toHaveBeenCalledWith(OWNER.email, 'old', IP);
    expect(provider.changePassword).toHaveBeenCalledWith(TOKEN, 'new-strong', 'old', IP);
    expect(provider.endSessions).toHaveBeenCalledWith(PROOF, 'local', IP);
    expect(provider.endSessions).toHaveBeenCalledWith(TOKEN, 'others', IP);
    expect(provider.endSessions).not.toHaveBeenCalledWith(TOKEN, 'local', IP);
  });

  it('a project that requires a fresh session: the change is made on the proof session and this device is signed out too', async () => {
    const { provider, service } = makeService();
    provider.changePassword.mockResolvedValueOnce({ kind: 'REAUTHENTICATION_NEEDED' }).mockResolvedValueOnce({ kind: 'CHANGED' });
    await expect(service.changePassword(TOKEN, { password: 'old', newPassword: 'new-strong' }, IP)).resolves.toEqual({ outcome: 'CHANGED_SIGNED_OUT' });
    expect(provider.changePassword.mock.calls[1]).toEqual([PROOF, 'new-strong', 'old', IP]);
    expect(provider.endSessions).toHaveBeenCalledWith(TOKEN, 'local', IP);
  });

  it('a wrong current password changes nothing; a policy refusal is POLICY; anything else is unavailable, never success', async () => {
    const { provider, service } = makeService();
    provider.grant.mockResolvedValueOnce({ kind: 'INVALID_CREDENTIALS' });
    await expect(service.changePassword(TOKEN, { password: 'bad', newPassword: 'n' }, IP)).resolves.toEqual({ outcome: 'PASSWORD_REJECTED' });
    expect(provider.changePassword).not.toHaveBeenCalled();
    provider.changePassword.mockResolvedValueOnce({ kind: 'POLICY' });
    await expect(service.changePassword(TOKEN, { password: 'old', newPassword: 'old' }, IP)).resolves.toEqual({ outcome: 'POLICY' });
    provider.changePassword.mockResolvedValueOnce({ kind: 'UNAVAILABLE' });
    await expect(service.changePassword(TOKEN, { password: 'old', newPassword: 'n' }, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('signs out every OTHER session only when the provider confirms it', async () => {
    const { provider, service } = makeService();
    await expect(service.signOutOtherDevices(TOKEN, IP)).resolves.toEqual({ outcome: 'SIGNED_OUT_OTHERS' });
    expect(provider.endSessions).toHaveBeenCalledWith(TOKEN, 'others', IP);
    provider.endSessions.mockResolvedValueOnce(false);
    await expect(service.signOutOtherDevices(TOKEN, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('SupabasePasswordGrantService — the owner’s provider calls', () => {
  const originalEnv = { ...process.env };
  const fetchMock = jest.fn();
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.supabase.test/';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterAll(() => {
    process.env = originalEnv;
  });
  const answer = (status: number, body: unknown) => ({ status, json: async () => body });

  it('reads the owner’s own user with the owner’s token, the secret key and the forwarded reader', async () => {
    fetchMock.mockResolvedValue(answer(200, { id: 'x', email: 'noor@example.test', email_confirmed_at: '2026-09-01T00:00:00Z' }));
    await expect(new SupabasePasswordGrantService().readOwnUser(TOKEN, IP)).resolves.toEqual({ email: 'noor@example.test', emailVerified: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://project.supabase.test/auth/v1/user');
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({ apikey: 'sb_secret_test', Authorization: `Bearer ${TOKEN}`, 'Sb-Forwarded-For': IP });
    expect(init.body).toBeUndefined();
  });

  it('never tells a taken new Email apart from a free one', async () => {
    const relay = new SupabasePasswordGrantService();
    for (const [status, body] of [[200, {}], [422, { error_code: 'email_exists' }], [429, { error_code: 'over_email_send_rate_limit' }], [500, null]] as const) {
      fetchMock.mockResolvedValueOnce(answer(status, body));
      await expect(relay.requestEmailChange(TOKEN, 'new@example.test', IP)).resolves.toEqual({ kind: 'ACCEPTED' });
    }
    fetchMock.mockResolvedValueOnce(answer(422, { error_code: 'email_address_invalid' }));
    await expect(relay.requestEmailChange(TOKEN, 'x@y', IP)).resolves.toEqual({ kind: 'INVALID_EMAIL' });
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(relay.requestEmailChange(TOKEN, 'new@example.test', IP)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PUT', body: JSON.stringify({ email: 'new@example.test' }) });
  });

  it('reads one Email-change confirmation: accepted, completed (a session), or rejected', async () => {
    const relay = new SupabasePasswordGrantService();
    fetchMock.mockResolvedValueOnce(answer(200, { msg: 'Confirmation link accepted.' }));
    await expect(relay.verifyEmailChangeCode('noor@example.test', '222222', IP)).resolves.toEqual({ kind: 'CONFIRMED' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ type: 'email_change', email: 'noor@example.test', token: '222222' });
    fetchMock.mockResolvedValueOnce(answer(200, { access_token: 'a', refresh_token: 'b' }));
    await expect(relay.verifyEmailChangeCode('new@example.test', '111111', IP)).resolves.toEqual({ kind: 'SESSION', accessToken: 'a', refreshToken: 'b' });
    fetchMock.mockResolvedValueOnce(answer(403, { error_code: 'otp_expired' }));
    await expect(relay.verifyEmailChangeCode('new@example.test', '111111', IP)).resolves.toEqual({ kind: 'CODE_REJECTED' });
    fetchMock.mockResolvedValueOnce(answer(429, {}));
    await expect(relay.verifyEmailChangeCode('new@example.test', '111111', IP)).resolves.toEqual({ kind: 'UNAVAILABLE' });
  });

  it('changes a password with the current one included, and maps the provider’s refusals', async () => {
    const relay = new SupabasePasswordGrantService();
    fetchMock.mockResolvedValueOnce(answer(200, { id: 'x' }));
    await expect(relay.changePassword(TOKEN, 'new', 'old', IP)).resolves.toEqual({ kind: 'CHANGED' });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PUT', body: JSON.stringify({ password: 'new', current_password: 'old' }) });
    for (const [code, kind] of [['weak_password', 'POLICY'], ['same_password', 'POLICY'], ['reauthentication_needed', 'REAUTHENTICATION_NEEDED'], ['unexpected', 'UNAVAILABLE']]) {
      fetchMock.mockResolvedValueOnce(answer(422, { error_code: code }));
      await expect(relay.changePassword(TOKEN, 'new', 'old', IP)).resolves.toEqual({ kind });
    }
  });

  it('ends sessions only on the provider’s confirmation; a gone session counts as ended only for `local`', async () => {
    const relay = new SupabasePasswordGrantService();
    fetchMock.mockResolvedValueOnce(answer(204, null));
    await expect(relay.endSessions(TOKEN, 'others', IP)).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('https://project.supabase.test/auth/v1/logout?scope=others');
    fetchMock.mockResolvedValueOnce(answer(403, null));
    await expect(relay.endSessions(TOKEN, 'others', IP)).resolves.toBe(false);
    fetchMock.mockResolvedValueOnce(answer(403, null));
    await expect(relay.endSessions(TOKEN, 'local', IP)).resolves.toBe(true);
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(relay.endSessions(TOKEN, 'others', IP)).resolves.toBe(false);
  });

  it('asks nothing without the secret key', async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    await expect(new SupabasePasswordGrantService().readOwnUser(TOKEN, IP)).resolves.toBeNull();
    await expect(new SupabasePasswordGrantService().endSessions(TOKEN, 'others', IP)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('AccountSecurityController — guarded owner routes, no account in any path', () => {
  const routes: [string, RequestMethod, string][] = [
    ['readIdentity', RequestMethod.GET, 'identity'],
    ['changeName', RequestMethod.POST, 'name/change'],
    ['changeLoginId', RequestMethod.POST, 'login-id/change'],
    ['requestEmailChange', RequestMethod.POST, 'email/change'],
    ['confirmEmailChange', RequestMethod.POST, 'email/confirm'],
    ['changePassword', RequestMethod.POST, 'password/change'],
    ['signOutOtherDevices', RequestMethod.POST, 'sessions/sign-out-others'],
  ];

  it('the whole controller is guarded', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AccountSecurityController)).toEqual([SupabaseAuthGuard]);
    expect(Reflect.getMetadata(PATH_METADATA, AccountSecurityController)).toBe('account');
  });

  it.each(routes)('%s is %s /account/%s', (handler, method, path) => {
    const fn = (AccountSecurityController.prototype as unknown as Record<string, object>)[handler];
    expect(Reflect.getMetadata(METHOD_METADATA, fn)).toBe(method);
    expect(Reflect.getMetadata(PATH_METADATA, fn)).toBe(path);
    expect(path).not.toMatch(/:|user|account/u);
  });

  it('passes only the verified caller’s token and the reader’s address', async () => {
    const security = { changeLoginId: jest.fn().mockResolvedValue({ outcome: 'CHANGED', loginId: 'x' }) } as unknown as AccountSecurityService;
    const controller = new AccountSecurityController(security);
    const request = { headers: {}, ip: IP, authenticatedUser: { userId: 'caller', accessToken: TOKEN } };
    await controller.changeLoginId(request, { commandId: COMMAND, loginId: 'x', password: 'p' });
    expect(security.changeLoginId).toHaveBeenCalledWith(TOKEN, { commandId: COMMAND, loginId: 'x', password: 'p' }, IP);
  });
});
