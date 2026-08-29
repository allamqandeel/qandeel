import 'reflect-metadata';
import type { ArgumentsHost, HttpServer } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { ConversationContextActivationController } from './conversation-context-activation.controller';
import { ConversationContextActivationService } from './conversation-context-activation.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { HimSessionContextBindingRepository } from '../human-model/him-session-context-binding.repository';
import { HimSessionContextBindingService } from '../human-model/him-session-context-binding.service';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import { sanitizeSentryEvent, sentryOptions } from '../observability/sentry';

// QHIA-011A Fix 02 - full error-lifecycle non-leakage.
//
// The HTTP client was already sanitized by Fix 01. This file closes the two
// remaining outward channels an unmapped database failure travels through in
// production, and it does so WITHOUT mocking either of them away:
//
//   1. the ACTUAL Nest logging path - the real BaseExceptionFilter calling the
//      real Nest Logger, whose real ConsoleLogger formatting is executed and
//      captured at the process stdout/stderr sink. Logger.prototype.error is
//      deliberately NOT mocked here: that is exactly the channel the audit used
//      to fail Fix 01, so suppressing it would make this proof worthless.
//
//   2. the CONFIGURED Sentry boundary - the real production `sentryOptions`
//      (including the real `sanitizeSentryEvent` beforeSend and the real
//      breadcrumb suppression) driven through a real Sentry client with an
//      in-memory transport. No network traffic is possible.
//
// Neither boundary is weakened to make this pass; the fix is the opaque
// representation in MemoryDataApiService, and these tests prove it holds.
const SENTINEL = 'RAW_DB_SENTINEL_QHIA011A_FIX02';
const SENTINEL_CODE = '28P01';
const SENTINEL_MESSAGE = `permission denied for relation him_session_context_bindings: ${SENTINEL}`;
const FORBIDDEN = [SENTINEL, SENTINEL_CODE, SENTINEL_MESSAGE, 'upstreamCode', 'upstreamMessage', 'permission denied'] as const;

const USER = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';
const GOAL = '00000000-0000-4000-8000-00000000000a';

const originalFetch = globalThis.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
  // The exact PostgREST envelope for an UNRECOGNISED database failure: it is
  // never mapped, so it takes the unknown-exception path all the way out.
  globalThis.fetch = (async () => ({
    ok: false,
    status: 500,
    json: async () => ({ code: SENTINEL_CODE, message: SENTINEL_MESSAGE, details: SENTINEL, hint: SENTINEL }),
  } as unknown as Response)) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
});

const controller = (): ConversationContextActivationController =>
  new ConversationContextActivationController(
    new ConversationContextActivationService(
      new HimSessionContextBindingService(new HimSessionContextBindingRepository(new MemoryDataApiService())),
    ),
  );
const request = (): AuthenticatedRequest => ({
  headers: { authorization: 'Bearer raw-header-value' },
  authenticatedUser: { userId: USER, accessToken: 'server-verified-access-token' },
});

/** The unmapped failure, produced by the REAL production chain. */
const unmappedFailure = async (): Promise<unknown> => {
  try {
    await controller().activateContext(request(), SESSION, 'GOAL', { contextId: GOAL });
  } catch (error) {
    return error;
  }
  throw new Error('the sentinel database failure must not resolve successfully');
};

describe('the ACTUAL Nest logging path never emits raw upstream identity', () => {
  it('logs the unknown exception for real, returns a generic 500, and leaks nothing', async () => {
    const failure = await unmappedFailure();
    const replies: Array<{ status: number; body: unknown }> = [];
    const applicationRef = {
      isHeadersSent: () => false,
      reply: (_response: unknown, body: unknown, status: number) => { replies.push({ status, body }); },
      end: () => undefined,
    } as unknown as HttpServer;
    const host = { getArgByIndex: () => ({}) } as unknown as ArgumentsHost;

    // Capture at the SINK, so Nest's real Logger + ConsoleLogger formatting and
    // serialization both execute. Nothing on the logging path is stubbed.
    const emitted: string[] = [];
    const stdoutWrite = process.stdout.write.bind(process.stdout);
    const stderrWrite = process.stderr.write.bind(process.stderr);
    const capture = (chunk: unknown): boolean => { emitted.push(String(chunk)); return true; };
    process.stdout.write = capture as unknown as typeof process.stdout.write;
    process.stderr.write = capture as unknown as typeof process.stderr.write;
    try {
      new BaseExceptionFilter(applicationRef).catch(failure, host);
    } finally {
      process.stdout.write = stdoutWrite;
      process.stderr.write = stderrWrite;
    }

    // Non-vacuity: the logger REALLY ran and REALLY rendered this error. Without
    // this the absence assertions below would pass on an empty capture.
    const log = emitted.join('');
    expect(emitted.length).toBeGreaterThan(0);
    expect(log).toContain('Memory Data API request failed with status 500.');
    // The client still gets a generic 500, and the log carries no database text.
    expect(replies).toEqual([{ status: 500, body: { statusCode: 500, message: 'Internal server error' } }]);
    for (const forbidden of FORBIDDEN) expect(log).not.toContain(forbidden);
  });
});

describe('the CONFIGURED Sentry boundary never emits raw upstream identity', () => {
  it('captures a sanitized event through the real beforeSend with an in-memory transport', async () => {
    const failure = await unmappedFailure();
    const envelopes: unknown[] = [];
    const client = new Sentry.NodeClient({
      ...sentryOptions,
      dsn: 'https://0123456789abcdef0123456789abcdef@o0.ingest.sentry.io/0',
      enabled: true,
      integrations: [],
      stackParser: Sentry.defaultStackParser,
      transport: () => ({
        send: async (envelope: unknown) => { envelopes.push(envelope); return {}; },
        flush: async () => true,
      }),
    });
    const scope = new Sentry.Scope();
    scope.setClient(client);
    scope.captureException(failure);
    await client.flush(2000);

    // Non-vacuity: an event really reached the transport, really carried this
    // exception and its stack, and really went through the production
    // sanitizer - which strips even the generic exception value.
    expect(envelopes.length).toBe(1);
    const item = ((envelopes[0] as unknown[])[1] as unknown[][])[0];
    const captured = item[1] as { exception?: { values?: Array<{ value?: unknown; stacktrace?: { frames?: unknown[] } }> } };
    expect(captured.exception?.values).toHaveLength(1);
    expect(captured.exception?.values?.[0]?.stacktrace?.frames?.length).toBeGreaterThan(0);
    expect(captured.exception?.values?.[0]?.value).toBeUndefined();
    const serialized = JSON.stringify(envelopes[0]);
    for (const forbidden of FORBIDDEN) expect(serialized).not.toContain(forbidden);
  });

  it('keeps the production sanitizer stripping every enrichment channel', async () => {
    const failure = await unmappedFailure();
    // A deliberately hostile event: every channel the contract enumerates is
    // pre-loaded with the sentinel, and the REAL production sanitizer must
    // remove all of them.
    const sanitized = sanitizeSentryEvent({
      message: SENTINEL_MESSAGE,
      logentry: { message: SENTINEL_MESSAGE },
      transaction: SENTINEL,
      extra: { upstreamCode: SENTINEL_CODE, upstreamMessage: SENTINEL_MESSAGE, error: failure },
      contexts: { upstream: { code: SENTINEL_CODE, message: SENTINEL_MESSAGE } },
      breadcrumbs: [{ message: SENTINEL_MESSAGE, data: { code: SENTINEL_CODE } }],
      user: { id: USER, username: SENTINEL },
      request: { method: 'PUT', url: `https://api/${SENTINEL}`, data: SENTINEL_MESSAGE, headers: { authorization: SENTINEL } },
      exception: {
        values: [{
          type: 'MemoryDataApiError',
          value: SENTINEL_MESSAGE,
          // Exactly what a source-context integration would attach: the frame
          // reduction must drop source text and local variables, which is the
          // channel that could otherwise carry a raw message into an event.
          stacktrace: {
            frames: [{
              filename: 'memory-data-api.service.ts', function: 'MemoryDataApiService.request', lineno: 1, colno: 1, in_app: true,
              context_line: `const message = '${SENTINEL_MESSAGE}';`,
              pre_context: [SENTINEL_MESSAGE], post_context: [SENTINEL_CODE],
              vars: { upstreamCode: SENTINEL_CODE, upstreamMessage: SENTINEL_MESSAGE },
            }],
          },
        }],
      },
      tags: { upstreamCode: SENTINEL_CODE },
    });
    const serialized = JSON.stringify(sanitized);
    for (const forbidden of FORBIDDEN) expect(serialized).not.toContain(forbidden);
    expect(sanitized.exception.values[0].type).toBe('MemoryDataApiError');
    expect(sanitized.exception.values[0].value).toBeUndefined();
    expect(sanitized.request).toEqual({ method: 'PUT' });
    for (const stripped of ['message', 'logentry', 'transaction', 'extra', 'contexts', 'breadcrumbs', 'user']) {
      expect(sanitized[stripped]).toBeUndefined();
    }
    // The production configuration also suppresses breadcrumbs at the source.
    expect(sentryOptions.beforeSend).toBe(sanitizeSentryEvent);
    expect(sentryOptions.beforeBreadcrumb({ message: SENTINEL_MESSAGE })).toBeNull();
    expect(sentryOptions.sendDefaultPii).toBe(false);
  });
});
