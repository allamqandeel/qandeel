/**
 * W1B-01 — the production Supabase binding for sign-up, Email-code verification and resend.
 *
 * The SDK is replaced at its module boundary only, so the port under test is the real one: the exact
 * SDK calls it makes, the metadata keys it sends, and how every provider answer becomes a typed KIND —
 * never a Product sentence. The error shapes are the installed `@supabase/auth-js` 2.116 ones: a
 * transport failure is status 0, every 5xx arrives with no code, and a coded error carries `code`.
 */
import { createEphemeralAuthSessionStorage } from '../auth/auth-session-storage';
import { SIGN_UP_METADATA_KEYS, createSupabaseAuthPort } from '../auth/supabase-auth-port';
import { TEST_CONFIG } from '../__fixtures__/runtime-entry';

const mockAuth = {
  signUp: jest.fn(),
  verifyOtp: jest.fn(),
  resend: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(async () => ({ error: null })),
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  startAutoRefresh: jest.fn(),
  stopAutoRefresh: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: mockAuth }) }));

const providerError = (message: string, status: number, code?: string) => Object.assign(new Error(message), { status, code });
const port = () => createSupabaseAuthPort({ config: TEST_CONFIG, storage: createEphemeralAuthSessionStorage() });
const SESSION = { user: { id: 'u-1' }, access_token: 'access-1', refresh_token: 'refresh-1' };

beforeEach(() => {
  for (const fn of Object.values(mockAuth)) fn.mockClear();
});

test('sign-up sends the Email, the untouched password and ONLY the two namespaced identity values', async () => {
  mockAuth.signUp.mockResolvedValue({ data: { user: { id: 'u-1' }, session: null }, error: null });
  expect(await port().signUp('a@example.test', ' pw ', { name: 'أحمد', loginId: 'ahmed.q' })).toEqual({ ok: true });
  expect(mockAuth.signUp).toHaveBeenCalledWith({
    email: 'a@example.test',
    password: ' pw ',
    options: { data: { qandeel_name: 'أحمد', qandeel_login_id: 'ahmed.q' } },
  });
  expect(SIGN_UP_METADATA_KEYS).toEqual({ name: 'qandeel_name', loginId: 'qandeel_login_id' });
});

test('a project that hands back a session at sign-up is refused, and the session is discarded locally', async () => {
  mockAuth.signUp.mockResolvedValue({ data: { user: { id: 'u-1' }, session: SESSION }, error: null });
  const result = await port().signUp('a@example.test', 'pw', { name: 'A', loginId: 'abc' });
  expect(result).toEqual({ ok: false, failure: { kind: 'REFUSED', detail: expect.any(String) } });
  expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});

test.each([
  ['weak_password', 422, 'WEAK_PASSWORD'],
  ['email_address_invalid', 400, 'INVALID_EMAIL'],
  ['validation_failed', 400, 'INVALID_EMAIL'],
  ['user_already_exists', 422, 'REFUSED'],
  ['over_email_send_rate_limit', 429, 'REFUSED'],
  ['signup_disabled', 422, 'REFUSED'],
  [undefined, 500, 'REFUSED'],
  [undefined, 0, 'NETWORK'],
])('sign-up error %s (%i) is the %s kind', async (code, status, kind) => {
  const message = code === 'validation_failed' ? 'Unable to validate email address: invalid format' : 'provider words';
  mockAuth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: providerError(message, status, code) });
  const result = await port().signUp('a@example.test', 'pw', { name: 'A', loginId: 'abc' });
  expect(result).toEqual({ ok: false, failure: { kind, detail: message } });
});

test('verification uses the Email OTP type and yields exactly the session snapshot', async () => {
  mockAuth.verifyOtp.mockResolvedValue({ data: { user: { id: 'u-1' }, session: SESSION }, error: null });
  expect(await port().verifyEmailCode('a@example.test', '123456')).toEqual({ ok: true, value: { userId: 'u-1', accessToken: 'access-1' } });
  expect(mockAuth.verifyOtp).toHaveBeenCalledWith({ email: 'a@example.test', token: '123456', type: 'email' });
});

test.each([
  ['otp_expired', 403, 'CODE_REJECTED'],
  ['validation_failed', 400, 'CODE_REJECTED'],
  ['over_request_rate_limit', 429, 'UNEXPECTED'],
  [undefined, 500, 'UNEXPECTED'],
  [undefined, 0, 'NETWORK'],
])('verification error %s (%i) is the %s kind', async (code, status, kind) => {
  mockAuth.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: providerError('provider words', status, code) });
  expect(await port().verifyEmailCode('a@example.test', '123456')).toEqual({ ok: false, failure: { kind, detail: 'provider words' } });
});

test('resend asks for the sign-up code again; a refusal and a transport failure are told apart', async () => {
  mockAuth.resend.mockResolvedValue({ data: { user: null, session: null }, error: null });
  expect(await port().resendEmailCode('a@example.test')).toEqual({ ok: true });
  expect(mockAuth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@example.test' });
  mockAuth.resend.mockResolvedValue({ data: { user: null, session: null }, error: providerError('after 42 seconds', 429, 'over_email_send_rate_limit') });
  expect(await port().resendEmailCode('a@example.test')).toEqual({ ok: false, failure: { kind: 'REFUSED', detail: 'after 42 seconds' } });
  mockAuth.resend.mockResolvedValue({ data: { user: null, session: null }, error: providerError('Failed to fetch', 0) });
  expect(await port().resendEmailCode('a@example.test')).toEqual({ ok: false, failure: { kind: 'NETWORK', detail: 'Failed to fetch' } });
});

test('a password sign-in the provider answers with email_not_confirmed is its own kind', async () => {
  mockAuth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: providerError('Email not confirmed', 400, 'email_not_confirmed') });
  expect(await port().signInWithPassword('a@example.test', 'pw')).toEqual({ ok: false, failure: { kind: 'EMAIL_NOT_CONFIRMED', detail: 'Email not confirmed' } });
});

test('a rejected credential is still INVALID_CREDENTIALS, and a status-0 transport failure is NETWORK', async () => {
  mockAuth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: providerError('Invalid login credentials', 400, 'invalid_credentials') });
  expect((await port().signInWithPassword('a@example.test', 'pw')).ok).toBe(false);
  expect(await port().signInWithPassword('a@example.test', 'pw')).toEqual({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: 'Invalid login credentials' } });
  mockAuth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: providerError('Network request failed', 0) });
  expect(await port().signInWithPassword('a@example.test', 'pw')).toEqual({ ok: false, failure: { kind: 'NETWORK', detail: 'Network request failed' } });
});
