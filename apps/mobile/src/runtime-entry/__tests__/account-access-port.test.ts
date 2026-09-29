/**
 * W2-01 — the PRODUCTION Supabase binding for the final account access lifecycle.
 *
 * The SDK is replaced at its module boundary and the network is an injected `fetch`, so the port under
 * test is the real one: the exact requests it makes, what it adopts into the ONE client, what it keeps
 * out of it, and how every answer becomes a typed KIND.
 */
import { createEphemeralAuthSessionStorage } from '../auth/auth-session-storage';
import { SUPABASE_AUTH_API_VERSION, createSupabaseAuthPort, type AuthRestFetch } from '../auth/supabase-auth-port';
import { TEST_CONFIG } from '../__fixtures__/runtime-entry';

let authStateListener: ((event: string) => void) | null = null;
const mockAuth = {
  signInWithPassword: jest.fn(),
  setSession: jest.fn(),
  verifyOtp: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  updateUser: jest.fn(),
  signOut: jest.fn(async () => ({ error: null })),
  getSession: jest.fn(),
  onAuthStateChange: jest.fn((listener: (event: string) => void) => {
    authStateListener = listener;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }),
  startAutoRefresh: jest.fn(),
  stopAutoRefresh: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: mockAuth }) }));

interface Sent {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

function network() {
  const sent: Sent[] = [];
  const answers: ({ status: number; body: unknown } | 'THROW')[] = [];
  const fetch: AuthRestFetch = async (url, init) => {
    sent.push({ url, method: init.method, headers: init.headers, body: init.body === undefined ? undefined : JSON.parse(init.body) });
    const answer = answers.shift() ?? { status: 500, body: null };
    if (answer === 'THROW') throw new TypeError('Network request failed');
    return { status: answer.status, json: async () => answer.body };
  };
  return { sent, fetch, answer: (status: number, body: unknown) => answers.push({ status, body }), fail: () => answers.push('THROW') };
}

const providerError = (message: string, status: number, code?: string, name?: string) => Object.assign(new Error(message), { status, code, ...(name ? { name } : {}) });
const SESSION = { user: { id: 'u-1' }, access_token: 'access-1', refresh_token: 'refresh-1' };

function port(net = network()) {
  return { net, port: createSupabaseAuthPort({ config: TEST_CONFIG, storage: createEphemeralAuthSessionStorage(), fetch: net.fetch }) };
}

beforeEach(() => {
  for (const fn of Object.values(mockAuth)) fn.mockClear();
  authStateListener = null;
});

describe('Login ID sign-in — resolved on the server, adopted into the ONE client', () => {
  it('sends the Login ID and the untouched password in a body to the QANDEEL API, and adopts the tokens with setSession', async () => {
    const { net, port: p } = port();
    net.answer(200, { accessToken: 'access-1', refreshToken: 'refresh-1' });
    mockAuth.setSession.mockResolvedValue({ data: { user: SESSION.user, session: SESSION }, error: null });
    expect(await p.signInWithLoginId('Mohamed.Allam87', ' pw ')).toEqual({ ok: true, value: { userId: 'u-1', accessToken: 'access-1' } });
    expect(net.sent).toEqual([
      { url: `${TEST_CONFIG.apiBaseUrl}/account/login-id-sign-in`, method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: { loginId: 'Mohamed.Allam87', password: ' pw ' } },
    ]);
    expect(net.sent[0].url).not.toMatch(/Mohamed|pw/u);
    expect(mockAuth.setSession).toHaveBeenCalledWith({ access_token: 'access-1', refresh_token: 'refresh-1' });
    // No Email ever enters the request, and none is asked of the provider directly.
    expect(JSON.stringify(net.sent)).not.toContain('@');
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  it.each([
    [401, { outcome: 'INVALID_CREDENTIALS' }, 'INVALID_CREDENTIALS'],
    [503, { outcome: 'UNAVAILABLE' }, 'UNEXPECTED'],
    [400, { outcome: 'INVALID_REQUEST' }, 'UNEXPECTED'],
    [200, { accessToken: 'only-one' }, 'UNEXPECTED'],
    [409, { outcome: 'CONFLICT' }, 'UNEXPECTED'],
  ])('status %i %j is the %s kind, and nothing is adopted', async (status, body, kind) => {
    const { net, port: p } = port();
    net.answer(status, body);
    const result = await p.signInWithLoginId('nobody.here', 'pw');
    expect(!result.ok && result.failure.kind).toBe(kind);
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('W2-01 R1 — a password-proved unconfirmed account is EMAIL_NOT_CONFIRMED and nothing more: no Email is carried, even one sent', async () => {
    for (const body of [{ outcome: 'EMAIL_NOT_CONFIRMED' }, { outcome: 'EMAIL_NOT_CONFIRMED', email: 'mona@example.test' }]) {
      const { net, port: p } = port();
      net.answer(409, body);
      const result = await p.signInWithLoginId('mona.ali', 'correct');
      expect(result).toStrictEqual({ ok: false, failure: { kind: 'EMAIL_NOT_CONFIRMED', detail: 'email not confirmed' } });
      expect(JSON.stringify(result)).not.toContain('@');
    }
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('no answer at all is NETWORK; a refused adoption is never a session', async () => {
    const offline = port();
    offline.net.fail();
    expect(await offline.port.signInWithLoginId('mona.ali', 'pw')).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'NETWORK' }) });
    const refused = port();
    refused.net.answer(200, { accessToken: 'a', refreshToken: 'r' });
    mockAuth.setSession.mockResolvedValue({ data: { user: null, session: null }, error: providerError('Invalid Refresh Token', 400) });
    expect(await refused.port.signInWithLoginId('mona.ali', 'pw')).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'UNEXPECTED' }) });
  });
});

describe('W2-01 R1 — Login-ID-origin Email verification, resolved on the server', () => {
  it('verify sends the Login ID and the code in a body, adopts the relayed session into the ONE client, and names no Email', async () => {
    const { net, port: p } = port();
    net.answer(200, { accessToken: 'access-2', refreshToken: 'refresh-2' });
    mockAuth.setSession.mockResolvedValue({ data: { user: SESSION.user, session: { ...SESSION, access_token: 'access-2' } }, error: null });
    expect(await p.verifyLoginIdEmailCode('Mona.Ali', '123456')).toEqual({ ok: true, value: { userId: 'u-1', accessToken: 'access-2' } });
    expect(net.sent).toEqual([
      { url: `${TEST_CONFIG.apiBaseUrl}/account/login-id-verify-email`, method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: { loginId: 'Mona.Ali', code: '123456' } },
    ]);
    expect(mockAuth.setSession).toHaveBeenCalledWith({ access_token: 'access-2', refresh_token: 'refresh-2' });
    expect(JSON.stringify(net.sent)).not.toContain('@');
    // Never the SDK's own verifyOtp: it would need the Email the device must not know.
    expect(mockAuth.verifyOtp).not.toHaveBeenCalled();
  });

  it.each([
    [401, { outcome: 'CODE_REJECTED' }, 'CODE_REJECTED'],
    [503, { outcome: 'UNAVAILABLE' }, 'UNEXPECTED'],
    [400, { outcome: 'INVALID_REQUEST' }, 'UNEXPECTED'],
    [200, { accessToken: 'only-one' }, 'UNEXPECTED'],
  ])('verify: status %i %j is the %s kind, and nothing is adopted', async (status, body, kind) => {
    const { net, port: p } = port();
    net.answer(status, body);
    const result = await p.verifyLoginIdEmailCode('mona.ali', '123456');
    expect(!result.ok && result.failure.kind).toBe(kind);
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('verify: no answer at all is NETWORK', async () => {
    const { net, port: p } = port();
    net.fail();
    expect(await p.verifyLoginIdEmailCode('mona.ali', '123456')).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'NETWORK' }) });
  });

  it('resend sends only the Login ID; ACCEPTED is sent, no answer is NETWORK, anything else is REFUSED', async () => {
    const { net, port: p } = port();
    net.answer(200, { outcome: 'ACCEPTED' });
    expect(await p.resendLoginIdEmailCode('mona.ali')).toEqual({ ok: true });
    expect(net.sent[0]).toEqual({ url: `${TEST_CONFIG.apiBaseUrl}/account/login-id-resend-verification`, method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: { loginId: 'mona.ali' } });
    net.answer(503, { outcome: 'UNAVAILABLE' });
    expect(await p.resendLoginIdEmailCode('mona.ali')).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'REFUSED' }) });
    net.fail();
    expect(await p.resendLoginIdEmailCode('mona.ali')).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'NETWORK' }) });
  });
});
describe('password recovery — recovery semantics, kept entirely out of the SDK session', () => {
  it('asks for a code with the SDK recovery request; every answered request is the same result', async () => {
    const { port: p } = port();
    for (const error of [null, providerError('over_email_send_rate_limit', 429, 'over_email_send_rate_limit'), providerError('Error sending recovery email', 500, undefined, 'AuthRetryableFetchError'), providerError('User not found', 404)]) {
      mockAuth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error });
      expect(await p.requestPasswordRecovery('reader@example.test')).toEqual({ ok: true });
    }
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('reader@example.test');
  });

  it('only a request that produced no HTTP answer is reported, and it says nothing about any account', async () => {
    const { port: p } = port();
    mockAuth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: providerError('Failed to fetch', 0, undefined, 'AuthRetryableFetchError') });
    expect(await p.requestPasswordRecovery('reader@example.test')).toEqual({ ok: false, failure: { kind: 'NETWORK', detail: 'Failed to fetch' } });
  });

  it('verifies the code with type "recovery" as the SDK would — but never through verifyOtp, so nothing is saved or announced', async () => {
    const { net, port: p } = port();
    net.answer(200, { access_token: 'recovery-access', refresh_token: 'recovery-refresh', user: { email: 'reader@example.test' } });
    expect(await p.verifyRecoveryCode('reader@example.test', '123456')).toEqual({ ok: true, value: { accessToken: 'recovery-access', refreshToken: 'recovery-refresh' } });
    expect(net.sent).toEqual([
      {
        url: `${TEST_CONFIG.supabaseUrl}/auth/v1/verify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: TEST_CONFIG.supabasePublishableKey,
          Authorization: `Bearer ${TEST_CONFIG.supabasePublishableKey}`,
          'X-Supabase-Api-Version': SUPABASE_AUTH_API_VERSION,
        },
        body: { type: 'recovery', email: 'reader@example.test', token: '123456' },
      },
    ]);
    // The whole point: the SDK's verifyOtp persists and announces a PASSWORD_RECOVERY session. Not here.
    expect(mockAuth.verifyOtp).not.toHaveBeenCalled();
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it.each([
    [403, { error_code: 'otp_expired' }, 'CODE_REJECTED'],
    [400, { error_code: 'validation_failed' }, 'CODE_REJECTED'],
    [429, { error_code: 'over_request_rate_limit' }, 'UNEXPECTED'],
    [500, null, 'UNEXPECTED'],
    [200, { access_token: 'no-refresh' }, 'UNEXPECTED'],
  ])('a recovery code answered %i %j is %s — wrong and expired are never told apart', async (status, body, kind) => {
    const { net, port: p } = port();
    net.answer(status, body);
    const result = await p.verifyRecoveryCode('reader@example.test', '123456');
    expect(!result.ok && result.failure.kind).toBe(kind);
  });

  it('updates the password with the grant as bearer, then retires the grant (logout, local scope)', async () => {
    const { net, port: p } = port();
    net.answer(200, { id: 'u-1' });
    net.answer(204, null);
    expect(await p.updateRecoveredPassword({ accessToken: 'recovery-access', refreshToken: 'recovery-refresh' }, ' new pw ')).toEqual({ ok: true });
    expect(net.sent.map((request) => [request.method, request.url, request.headers.Authorization, request.body])).toEqual([
      ['PUT', `${TEST_CONFIG.supabaseUrl}/auth/v1/user`, 'Bearer recovery-access', { password: ' new pw ' }],
      ['POST', `${TEST_CONFIG.supabaseUrl}/auth/v1/logout?scope=local`, 'Bearer recovery-access', undefined],
    ]);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    [422, { error_code: 'weak_password' }, 'WEAK_PASSWORD'],
    [422, { error_code: 'same_password' }, 'WEAK_PASSWORD'],
    [401, { error_code: 'bad_jwt' }, 'UNEXPECTED'],
    [500, null, 'UNEXPECTED'],
  ])('a refused update %i %j is %s, and the grant is not retired by the refusal', async (status, body, kind) => {
    const { net, port: p } = port();
    net.answer(status, body);
    const result = await p.updateRecoveredPassword({ accessToken: 'a', refreshToken: 'r' }, 'pw');
    expect(!result.ok && result.failure.kind).toBe(kind);
    expect(net.sent).toHaveLength(1);
  });

  it('no answer is NETWORK, and retiring an abandoned grant never throws', async () => {
    const { net, port: p } = port();
    net.fail();
    expect(await p.updateRecoveredPassword({ accessToken: 'a', refreshToken: 'r' }, 'pw')).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'NETWORK' }) });
    net.fail();
    await expect(p.retireRecoveryGrant({ accessToken: 'a', refreshToken: 'r' })).resolves.toBeUndefined();
  });
});

describe('restore — a PROVED ended session versus an unverifiable one', () => {
  it('an empty restore on a first launch is simply no session', async () => {
    const { port: p } = port();
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await p.restoreSession()).toEqual({ ok: true, value: null });
  });

  it('a stored session the provider refused while the SDK initialised is SESSION_ENDED, not a first launch', async () => {
    const { port: p } = port();
    // The SDK removed the session and emitted SIGNED_OUT before anything else subscribed.
    authStateListener?.('SIGNED_OUT');
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await p.restoreSession()).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'SESSION_ENDED' }) });
    // The evidence is consumed once.
    expect(await p.restoreSession()).toEqual({ ok: true, value: null });
  });

  it('a 4xx refresh refusal is SESSION_ENDED; a transport failure and a 5xx stay unknown', async () => {
    const { port: p } = port();
    mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: providerError('Invalid Refresh Token: Refresh Token Not Found', 400, 'refresh_token_not_found') });
    expect(await p.restoreSession()).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'SESSION_ENDED' }) });
    mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: providerError('Failed to fetch', 0, undefined, 'AuthRetryableFetchError') });
    expect(await p.restoreSession()).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'NETWORK' }) });
    mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: providerError('HTTP 503', 503, undefined, 'AuthRetryableFetchError') });
    expect(await p.restoreSession()).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'UNEXPECTED' }) });
  });

  it('the port’s OWN sign-out is never evidence that a session ended', async () => {
    const { port: p } = port();
    mockAuth.signOut.mockImplementationOnce(async () => {
      authStateListener?.('SIGNED_OUT');
      return { error: null };
    });
    await p.signOut();
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await p.restoreSession()).toEqual({ ok: true, value: null });
  });
});

test('nothing in the access lifecycle is logged — no password, code, token or Email', async () => {
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) => jest.spyOn(console, level).mockImplementation(() => undefined));
  try {
    const { net, port: p } = port();
    net.answer(401, { outcome: 'INVALID_CREDENTIALS' });
    await p.signInWithLoginId('mona.ali', 'secret-password');
    net.answer(200, { access_token: 'recovery-access', refresh_token: 'recovery-refresh' });
    await p.verifyRecoveryCode('mona@example.test', '123456');
    net.answer(200, {});
    net.answer(204, null);
    await p.updateRecoveredPassword({ accessToken: 'recovery-access', refreshToken: 'recovery-refresh' }, 'new-secret');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
});
