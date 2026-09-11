/** AC-01 — the request-time credential seam itself: what it stamps, and what it refuses. */
import {
  CredentialUnavailableError,
  NO_CAPTURED_CREDENTIAL,
  createAuthorizedFetch,
  type RuntimeCredential,
} from '../auth/request-credential';
import type { RuntimeHttpFetch } from '../conversation/conversation-session-api';

interface Seen {
  readonly input: string;
  readonly init: Parameters<RuntimeHttpFetch>[1];
}

function recorder(): { fetch: RuntimeHttpFetch; seen: Seen[] } {
  const seen: Seen[] = [];
  return {
    seen,
    fetch: async (input, init) => {
      seen.push({ input, init });
      return { ok: true, status: 200, json: async () => ({}) };
    },
  };
}

test('the bearer is read at the request, not at construction', async () => {
  let credential: RuntimeCredential | null = { accessToken: 'token-A', authGeneration: 1 };
  const http = recorder();
  const authorized = createAuthorizedFetch({ credential: () => credential, authGeneration: 1, fetch: http.fetch });

  await authorized('https://api.test/one', { method: 'GET' });
  credential = { accessToken: 'token-B', authGeneration: 1 };
  await authorized('https://api.test/two', { method: 'GET' });

  expect(http.seen.map((call) => call.init?.headers?.Authorization)).toEqual(['Bearer token-A', 'Bearer token-B']);
});

test('a token a client captured for itself is overwritten, never merged or preferred', async () => {
  const http = recorder();
  const authorized = createAuthorizedFetch({
    credential: () => ({ accessToken: 'token-B', authGeneration: 4 }),
    authGeneration: 4,
    fetch: http.fetch,
  });

  // Exactly what a frozen T-03 transport sends: its own Authorization, plus headers it owns.
  await authorized('https://api.test/x', {
    method: 'GET',
    headers: { Authorization: `Bearer ${NO_CAPTURED_CREDENTIAL}`, Accept: 'application/json' },
  });

  expect(http.seen[0].init?.headers).toEqual({ Authorization: 'Bearer token-B', Accept: 'application/json' });
});

test('the body and the method pass through untouched', async () => {
  const http = recorder();
  const authorized = createAuthorizedFetch({
    credential: () => ({ accessToken: 'token-B', authGeneration: 1 }),
    authGeneration: 1,
    fetch: http.fetch,
  });

  await authorized('https://api.test/x', { method: 'POST', body: '{"a":1}' });

  expect(http.seen[0].init?.method).toBe('POST');
  expect(http.seen[0].init?.body).toBe('{"a":1}');
});

test('a request for an unauthenticated runtime is refused before it is issued', async () => {
  const http = recorder();
  const authorized = createAuthorizedFetch({ credential: () => null, authGeneration: 1, fetch: http.fetch });

  await expect(authorized('https://api.test/x')).rejects.toThrow(CredentialUnavailableError);
  expect(http.seen).toEqual([]);
});

test('a credential belonging to a replaced identity is refused, not used', async () => {
  const http = recorder();
  const authorized = createAuthorizedFetch({
    // Someone IS authenticated — just not the reader this caller was built for.
    credential: () => ({ accessToken: 'token-someone-else', authGeneration: 2 }),
    authGeneration: 1,
    fetch: http.fetch,
  });

  await expect(authorized('https://api.test/x')).rejects.toMatchObject({ refusal: 'IDENTITY_REPLACED' });
  expect(http.seen).toEqual([]);
});

test('a refusal names the reason and never the credential', async () => {
  const authorized = createAuthorizedFetch({
    credential: () => ({ accessToken: 'token-super-secret', authGeneration: 9 }),
    authGeneration: 1,
    fetch: recorder().fetch,
  });

  const error = await authorized('https://api.test/x').then(
    () => null,
    (cause: unknown) => cause,
  );
  expect(error).toBeInstanceOf(CredentialUnavailableError);
  // The whole serialized error, not just the message: a token in any field is a token in a log.
  expect(JSON.stringify({ message: (error as Error).message, ...(error as object) })).not.toContain('token-super-secret');
  expect((error as Error).stack ?? '').not.toContain('token-super-secret');
});

test('the placeholder is not mistakable for a credential', () => {
  // If the seam is ever bypassed, this is what a server sees — an immediate, self-describing 401
  // rather than a well-formed token that happens to be stale.
  expect(NO_CAPTURED_CREDENTIAL).toBe('no-captured-credential');
  expect(NO_CAPTURED_CREDENTIAL).not.toMatch(/^ey/u);
});
