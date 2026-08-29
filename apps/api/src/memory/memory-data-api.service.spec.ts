import { ServiceUnavailableException } from '@nestjs/common';
import { MemoryDataApiError, MemoryDataApiService, readMemoryDataApiUpstreamIdentity } from './memory-data-api.service';

// QHIA-011A Fix 01 + Fix 02 transport contract.
//
// The authenticated PostgREST transport preserves EXACTLY three facts about a
// failed request - the HTTP status and the upstream `code` and `message` - so
// that a narrow, boundary-local consumer can recognise an expected authority
// rejection instead of every denial becoming an opaque server error. It
// preserves nothing else: no `details`, no `hint`, no raw body, no headers, no
// token, no key. A malformed or non-JSON error body never replaces the original
// transport failure, and successful requests are untouched.
//
// Since Fix 02 the code and message are OPAQUE - reachable only through
// readMemoryDataApiUpstreamIdentity, never as properties of the error - which
// is why every assertion below reads them through that accessor. The reflection
// and serialization proofs live in memory-data-api-upstream-identity.spec.ts.
const TOKEN = 'caller-access-token';
const SECRET_KEY = 'publishable-key-that-must-never-be-captured';

const originalFetch = globalThis.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;

const respondWith = (response: unknown): void => {
  globalThis.fetch = jest.fn().mockResolvedValue(response) as unknown as typeof fetch;
};
const failing = (status: number, json: () => Promise<unknown>): unknown => ({ ok: false, status, json });
const succeeding = (status: number, json: () => Promise<unknown>): unknown => ({ ok: true, status, json });

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://project.supabase.co/';
  process.env.SUPABASE_PUBLISHABLE_KEY = SECRET_KEY;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  jest.restoreAllMocks();
});

const rejection = async (): Promise<MemoryDataApiError> => {
  let caught: unknown;
  try {
    await new MemoryDataApiService().request(TOKEN, 'rpc/set_him_session_context_binding_v1', { method: 'POST', body: '{}' });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(MemoryDataApiError);
  return caught as MemoryDataApiError;
};

describe('MemoryDataApiService structured upstream failure identity', () => {
  it('preserves the exact PostgREST code and message of an ownership denial (HTTP 403 / SQLSTATE 42501)', async () => {
    respondWith(failing(403, async () => ({
      code: '42501',
      details: 'a detail that must never be captured',
      hint: 'a hint that must never be captured',
      message: 'Unknown, cross-user, or wrong-kind measurement target',
    })));
    const error = await rejection();
    expect(error.status).toBe(403);
    expect(readMemoryDataApiUpstreamIdentity(error).code).toBe('42501');
    expect(readMemoryDataApiUpstreamIdentity(error).message).toBe('Unknown, cross-user, or wrong-kind measurement target');
  });

  it('preserves the exact code and message of an inactive-session refusal, which PostgREST reports as HTTP 500', async () => {
    respondWith(failing(500, async () => ({ code: '55000', message: 'Conversation session is not active' })));
    const error = await rejection();
    expect(error.status).toBe(500);
    expect(readMemoryDataApiUpstreamIdentity(error).code).toBe('55000');
    expect(readMemoryDataApiUpstreamIdentity(error).message).toBe('Conversation session is not active');
    // The generic Error.message is unchanged, so nothing that already logs or
    // reports these errors starts emitting database text.
    expect(error.message).toBe('Memory Data API request failed with status 500.');
  });

  it('captures neither details, hint, raw body, token, nor key', async () => {
    respondWith(failing(403, async () => ({
      code: '42501', message: 'Session context bindings are owner-exact',
      details: 'sensitive-detail', hint: 'sensitive-hint', token: TOKEN, apikey: SECRET_KEY,
    })));
    const error = await rejection();
    const serialized = JSON.stringify({ ...error, message: error.message });
    for (const secret of ['sensitive-detail', 'sensitive-hint', TOKEN, SECRET_KEY, 'details', 'hint', 'apikey']) {
      expect(serialized).not.toContain(secret);
    }
    // Fix 02: the identity is opaque, so the spread carries only the status -
    // never the upstream code or message.
    expect(Object.keys({ ...error })).toEqual(['status']);
    expect(serialized).not.toContain('42501');
    expect(serialized).not.toContain('owner-exact');
    expect(readMemoryDataApiUpstreamIdentity(error)).toEqual({
      code: '42501', message: 'Session context bindings are owner-exact' });
  });

  it.each([
    ['a non-JSON body', async () => { throw new SyntaxError('Unexpected token < in JSON'); }],
    ['an empty body', async () => { throw new SyntaxError('Unexpected end of JSON input'); }],
    ['a null body', async () => null],
    ['an undefined body', async () => undefined],
    ['an array body', async () => [{ code: '42501', message: 'Session context bindings are owner-exact' }]],
    ['a string body', async () => 'Forbidden'],
    ['a body with no code or message', async () => ({ details: 'x' })],
  ] as ReadonlyArray<readonly [string, () => Promise<unknown>]>)(
    'keeps the status but no structured identity for %s',
    async (_label, json) => {
      respondWith(failing(403, json));
      const error = await rejection();
      expect(error.status).toBe(403);
      expect(readMemoryDataApiUpstreamIdentity(error).code).toBeUndefined();
      expect(readMemoryDataApiUpstreamIdentity(error).message).toBeUndefined();
    },
  );

  // A field is preserved on its own merits, so a partial identity stays
  // partial. That is deliberate and safe: the activation boundary requires BOTH
  // an exact code AND an exact message, so a half-identity can never be mapped.
  it.each([
    ['a non-string code', { code: 42501, message: 'Session context bindings are owner-exact' }, undefined, 'Session context bindings are owner-exact'],
    ['an empty code', { code: '', message: 'Session context bindings are owner-exact' }, undefined, 'Session context bindings are owner-exact'],
    ['a non-string message', { code: '42501', message: { text: 'denied' } }, '42501', undefined],
    ['an oversized message, never truncated', { code: '42501', message: 'x'.repeat(257) }, '42501', undefined],
  ] as ReadonlyArray<readonly [string, unknown, string | undefined, string | undefined]>)(
    'preserves only the usable half of %s',
    async (_label, body, expectedCode, expectedMessage) => {
      respondWith(failing(403, async () => body));
      const error = await rejection();
      expect(error.status).toBe(403);
      expect(readMemoryDataApiUpstreamIdentity(error).code).toBe(expectedCode);
      expect(readMemoryDataApiUpstreamIdentity(error).message).toBe(expectedMessage);
    },
  );

  it('never lets a body-parsing failure replace the original transport failure', async () => {
    respondWith(failing(503, async () => { throw new Error('stream closed'); }));
    const error = await rejection();
    expect(error).toBeInstanceOf(MemoryDataApiError);
    expect(error.status).toBe(503);
  });
});

describe('MemoryDataApiService successful and unconfigured behavior is unchanged', () => {
  it('returns the parsed body on success', async () => {
    respondWith(succeeding(200, async () => [{ id: 'row' }]));
    await expect(new MemoryDataApiService().request(TOKEN, 'memories')).resolves.toEqual([{ id: 'row' }]);
  });

  it('returns undefined for 204 without reading a body', async () => {
    const json = jest.fn();
    respondWith(succeeding(204, json as unknown as () => Promise<unknown>));
    await expect(new MemoryDataApiService().request(TOKEN, 'memories')).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it('still fails closed when the transport is unconfigured', async () => {
    delete process.env.SUPABASE_URL;
    await expect(new MemoryDataApiService().request(TOKEN, 'memories')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('still maps a network failure to an unavailable transport, never to a domain answer', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;
    await expect(new MemoryDataApiService().request(TOKEN, 'memories')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
