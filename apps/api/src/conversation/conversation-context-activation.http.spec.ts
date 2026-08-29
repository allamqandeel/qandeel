import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import type { ArgumentsHost, HttpServer } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ConversationContextActivationController } from './conversation-context-activation.controller';
import { ConversationContextActivationService } from './conversation-context-activation.service';
import {
  CONVERSATION_CONTEXT_ACTIVATION_CONFLICT_MESSAGE,
  CONVERSATION_CONTEXT_ACTIVATION_FORBIDDEN_MESSAGE,
} from './conversation-context-activation.types';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { HimSessionContextBindingRepository } from '../human-model/him-session-context-binding.repository';
import { HimSessionContextBindingService } from '../human-model/him-session-context-binding.service';
import { MemoryDataApiService } from '../memory/memory-data-api.service';

// QHIA-011A Fix 01 - REAL HTTP outcome contract.
//
// This is the regression the Codex audit found: an expected QHIA-006 authority
// denial travelled to the client as HTTP 500 because it reached Nest as an
// ordinary error rather than an HttpException.
//
// The whole production chain runs here for real - the real controller, the real
// activation facade, the real QHIA-006 service, the real QHIA-006 repository,
// and the real authenticated PostgREST transport over a scripted `fetch` that
// returns genuine PostgREST error bodies - and the resulting exception is
// resolved to an HTTP status by the REAL `BaseExceptionFilter` from
// `@nestjs/core`. That class is exactly what the application's global
// `SentryGlobalFilter` extends, so the status and body observed here are the
// ones a client observes in production.
//
// SupabaseAuthGuard is not exercised here because the handler is invoked
// directly; the real guard wiring and the authenticated-identity extraction are
// proven in conversation-context-activation.controller.spec.ts.
const USER = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';
const GOAL = '00000000-0000-4000-8000-00000000000a';
const TOKEN = 'server-verified-access-token';

const activeRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: '00000000-0000-4000-8000-0000000000f1',
  user_id: USER,
  conversation_session_id: SESSION,
  context_kind: 'GOAL',
  context_id: GOAL,
  binding_version: 1,
  status: 'ACTIVE',
  binding_source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING',
  created_at: '2026-08-29T00:00:00.000000+00:00',
  retired_at: null,
  canonical_provenance: 'QANDEEL_HIM_SESSION_CONTEXT_BINDING_V1',
  ...over,
});

interface HttpOutcome { status: number; body: unknown; }

const originalFetch = globalThis.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
let fetchCalls = 0;

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
  fetchCalls = 0;
  // BaseExceptionFilter logs every unknown exception; keep the suite output
  // clean without changing its behavior.
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  jest.restoreAllMocks();
});

/** The exact PostgREST error envelope PostgreSQL RAISE produces through PostgREST. */
const upstreamFailure = (status: number, body: unknown): void => {
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return { ok: false, status, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
};
const upstreamSuccess = (rows: unknown): void => {
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return { ok: true, status: 200, json: async () => rows } as unknown as Response;
  }) as unknown as typeof fetch;
};

const controller = (): ConversationContextActivationController =>
  new ConversationContextActivationController(
    new ConversationContextActivationService(
      new HimSessionContextBindingService(new HimSessionContextBindingRepository(new MemoryDataApiService())),
    ),
  );

const request = (): AuthenticatedRequest => ({
  headers: { authorization: 'Bearer raw-header-value' },
  authenticatedUser: { userId: USER, accessToken: TOKEN },
});

/** Runs the handler and resolves whatever a client would actually receive. */
async function httpOutcome(work: () => Promise<unknown>): Promise<HttpOutcome> {
  const replies: HttpOutcome[] = [];
  const applicationRef = {
    isHeadersSent: () => false,
    reply: (_response: unknown, body: unknown, status: number) => { replies.push({ status, body }); },
    end: () => undefined,
  } as unknown as HttpServer;
  const host = { getArgByIndex: () => ({}) } as unknown as ArgumentsHost;
  try {
    return { status: 200, body: await work() };
  } catch (error) {
    new BaseExceptionFilter(applicationRef).catch(error, host);
    expect(replies).toHaveLength(1);
    return replies[0];
  }
}

const OWNERSHIP_DENIALS: ReadonlyArray<readonly [string, string]> = [
  ['a foreign or unknown conversation session', 'Unknown or cross-user conversation session'],
  ['a foreign, unknown, or wrong-kind measurement target', 'Unknown, cross-user, or wrong-kind measurement target'],
  ['an owner-exactness violation', 'Session context bindings are owner-exact'],
];
const forbidden = (message: string): void => upstreamFailure(403, { code: '42501', message, details: 'never-exposed', hint: 'never-exposed' });
const inactive = (): void => upstreamFailure(500, { code: '55000', message: 'Conversation session is not active' });

describe('PUT /conversation/sessions/:sessionId/context-bindings/:contextKind', () => {
  it.each(OWNERSHIP_DENIALS)('returns a sanitized HTTP 403 - never 500 - for %s', async (_label, message) => {
    forbidden(message);
    const outcome = await httpOutcome(() => controller().activateContext(request(), SESSION, 'GOAL', { contextId: GOAL }));
    expect(outcome.status).toBe(403);
    expect(outcome.body).toEqual({ statusCode: 403, message: CONVERSATION_CONTEXT_ACTIVATION_FORBIDDEN_MESSAGE, error: 'Forbidden' });
    const serialized = JSON.stringify(outcome.body);
    for (const leak of ['42501', message, 'never-exposed', 'owner-exact', 'cross-user', 'wrong-kind']) {
      expect(serialized).not.toContain(leak);
    }
    expect(fetchCalls).toBe(1);
  });

  it('returns HTTP 409 for an owned conversation session that is not active', async () => {
    inactive();
    const outcome = await httpOutcome(() => controller().activateContext(request(), SESSION, 'GOAL', { contextId: GOAL }));
    expect(outcome.status).toBe(409);
    expect(outcome.body).toEqual({ statusCode: 409, message: CONVERSATION_CONTEXT_ACTIVATION_CONFLICT_MESSAGE, error: 'Conflict' });
    expect(JSON.stringify(outcome.body)).not.toContain('55000');
  });

  it('still returns the minimal product projection with HTTP 200 on success', async () => {
    upstreamSuccess([activeRow()]);
    const outcome = await httpOutcome(() => controller().activateContext(request(), SESSION, 'GOAL', { contextId: GOAL }));
    expect(outcome.status).toBe(200);
    expect(outcome.body).toEqual({
      contractVersion: 1,
      source: 'QANDEEL_EXPLICIT_SESSION_CONTEXT_ACTIVATION_V1',
      sessionId: SESSION,
      activeBinding: { contextKind: 'GOAL', contextId: GOAL },
    });
  });

  it('still returns HTTP 400 for malformed input, before any transport', async () => {
    upstreamSuccess([activeRow()]);
    const outcome = await httpOutcome(() => controller().activateContext(request(), SESSION, 'GOAL', { contextId: 'quit my job' }));
    expect(outcome.status).toBe(400);
    expect(fetchCalls).toBe(0);
  });
});

describe('DELETE /conversation/sessions/:sessionId/context-bindings/:contextKind', () => {
  it('returns a sanitized HTTP 403 for an unknown or cross-user conversation session', async () => {
    forbidden('Unknown or cross-user conversation session');
    const outcome = await httpOutcome(() => controller().deactivateContext(request(), SESSION, 'GOAL'));
    expect(outcome.status).toBe(403);
    expect(outcome.body).toEqual({ statusCode: 403, message: CONVERSATION_CONTEXT_ACTIVATION_FORBIDDEN_MESSAGE, error: 'Forbidden' });
  });

  it('keeps the migration-0055 behavior that clearing an owned inactive session succeeds', async () => {
    // The authority does not refuse this, so nothing is mapped and the product
    // answer is an ordinary HTTP 200.
    upstreamSuccess([]);
    const outcome = await httpOutcome(() => controller().deactivateContext(request(), SESSION, 'GOAL'));
    expect(outcome.status).toBe(200);
    expect(outcome.body).toEqual({
      contractVersion: 1, source: 'QANDEEL_EXPLICIT_SESSION_CONTEXT_ACTIVATION_V1',
      sessionId: SESSION, contextKind: 'GOAL', cleared: false,
    });
  });
});

describe('GET /conversation/sessions/:sessionId/context-bindings', () => {
  it('returns a sanitized HTTP 403 for an unknown or cross-user conversation session', async () => {
    forbidden('Unknown or cross-user conversation session');
    const outcome = await httpOutcome(() => controller().readActiveContexts(request(), SESSION));
    expect(outcome.status).toBe(403);
    expect(outcome.body).toEqual({ statusCode: 403, message: CONVERSATION_CONTEXT_ACTIVATION_FORBIDDEN_MESSAGE, error: 'Forbidden' });
  });

  it('returns HTTP 409 for an owned conversation session that is not active', async () => {
    inactive();
    const outcome = await httpOutcome(() => controller().readActiveContexts(request(), SESSION));
    expect(outcome.status).toBe(409);
    expect(outcome.body).toEqual({ statusCode: 409, message: CONVERSATION_CONTEXT_ACTIVATION_CONFLICT_MESSAGE, error: 'Conflict' });
  });

  it('returns the minimal active-context projection with HTTP 200', async () => {
    upstreamSuccess([activeRow()]);
    const outcome = await httpOutcome(() => controller().readActiveContexts(request(), SESSION));
    expect(outcome.status).toBe(200);
    expect(outcome.body).toEqual({
      contractVersion: 1, source: 'QANDEEL_EXPLICIT_SESSION_CONTEXT_ACTIVATION_V1',
      sessionId: SESSION, bindingCount: 1, bindings: [{ contextKind: 'GOAL', contextId: GOAL }],
    });
  });
});

describe('unexpected and unrecognised failures still return a generic HTTP 500', () => {
  const GENERIC_500 = { statusCode: 500, message: 'Internal server error' };

  it.each([
    ['an unrecognised PostgREST code', 500, { code: 'PGRST202', message: 'Could not find the function in the schema cache' }],
    ['SQLSTATE 42501 with an unrecognised message', 403, { code: '42501', message: 'permission denied for table him_session_context_bindings' }],
    ['SQLSTATE 55000 with an unrecognised message', 500, { code: '55000', message: 'object not in prerequisite state' }],
    ['an authentication failure past the authenticated boundary', 401, { code: '42501', message: 'Authentication required' }],
    ['a malformed upstream error body', 403, 'not-json-at-all'],
  ] as ReadonlyArray<readonly [string, number, unknown]>)('maps %s to a generic 500', async (_label, status, body) => {
    upstreamFailure(status, body);
    const outcome = await httpOutcome(() => controller().activateContext(request(), SESSION, 'GOAL', { contextId: GOAL }));
    expect(outcome.status).toBe(500);
    expect(outcome.body).toEqual(GENERIC_500);
  });

  it('maps a fail-closed integrity breach to a generic 500', async () => {
    // The authority answered successfully but for a DIFFERENT kind: the QHIA-006
    // service refuses it, and that refusal is never converted into a benign 403.
    upstreamSuccess([activeRow({ context_kind: 'SITUATION' })]);
    const outcome = await httpOutcome(() => controller().activateContext(request(), SESSION, 'GOAL', { contextId: GOAL }));
    expect(outcome.status).toBe(500);
    expect(outcome.body).toEqual(GENERIC_500);
  });

  it('reproduces the original defect shape, proving this harness can still return 500', async () => {
    // A transport failure with NO structured identity is exactly what every
    // authority denial used to look like before Fix 01. It must still be a 500 -
    // that is what makes the 403/409 results above meaningful rather than an
    // artifact of the harness.
    upstreamFailure(403, undefined);
    const outcome = await httpOutcome(() => controller().activateContext(request(), SESSION, 'GOAL', { contextId: GOAL }));
    expect(outcome.status).toBe(500);
    expect(outcome.body).toEqual(GENERIC_500);
  });
});
