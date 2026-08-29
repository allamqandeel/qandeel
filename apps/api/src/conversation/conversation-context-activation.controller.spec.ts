import 'reflect-metadata';
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { ConversationContextActivationController } from './conversation-context-activation.controller';
import { ConversationContextActivationService } from './conversation-context-activation.service';
import { ConversationController } from './conversation.controller';
import { ConversationModule } from './conversation.module';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { HimSessionContextBindingService } from '../human-model/him-session-context-binding.service';

// QHIA-011A controller contract.
//
// The authenticated product entry exists, is guarded by the REAL
// SupabaseAuthGuard, derives identity and token ONLY from the authenticated
// request, hands every command to the narrow facade, and returns the minimal
// product projection. Malformed input never reaches the QHIA-006 authority.
const USER = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';
const GOAL = '00000000-0000-4000-8000-00000000000a';
const TOKEN = 'server-verified-access-token';
const SOURCE = 'QANDEEL_EXPLICIT_SESSION_CONTEXT_ACTIVATION_V1';

// Exactly what the real SupabaseAuthGuard leaves on the request. The
// Authorization header deliberately carries a DIFFERENT string, and the body
// deliberately carries a forged identity, so "identity comes only from
// authenticatedUser" is provable rather than coincidental.
const authenticatedRequest = (): AuthenticatedRequest => ({
  headers: { authorization: 'Bearer a-raw-header-token-that-must-never-be-used' },
  authenticatedUser: { userId: USER, accessToken: TOKEN },
});

type FacadeDouble = {
  activateContext: jest.Mock;
  deactivateContext: jest.Mock;
  readActiveContexts: jest.Mock;
};
const facadeDouble = (): FacadeDouble => ({
  activateContext: jest.fn(),
  deactivateContext: jest.fn(),
  readActiveContexts: jest.fn(),
});
const controller = (facade: FacadeDouble) =>
  new ConversationContextActivationController(facade as unknown as ConversationContextActivationService);

type BindingDouble = {
  setBinding: jest.Mock;
  clearBinding: jest.Mock;
  readActiveBindings: jest.Mock;
};
const bindingDouble = (): BindingDouble => ({
  setBinding: jest.fn(),
  clearBinding: jest.fn(),
  readActiveBindings: jest.fn(),
});
// The REAL facade under the REAL controller: the only double is the existing
// QHIA-006 authority, so a rejection proven here is proven for the whole
// production chain above the database.
const realChain = (bindings: BindingDouble) =>
  new ConversationContextActivationController(
    new ConversationContextActivationService(bindings as unknown as HimSessionContextBindingService),
  );

// The exact frozen product routes: handler name, path, HTTP verb.
const ROUTES: ReadonlyArray<readonly [string, string, number]> = [
  ['activateContext', 'sessions/:sessionId/context-bindings/:contextKind', RequestMethod.PUT],
  ['deactivateContext', 'sessions/:sessionId/context-bindings/:contextKind', RequestMethod.DELETE],
  ['readActiveContexts', 'sessions/:sessionId/context-bindings', RequestMethod.GET],
];
const REJECTED_KINDS: ReadonlyArray<string> = [
  'GLOBAL', 'CONVERSATION_SESSION', 'goal', 'TOPIC', 'ALL', '',
];
const REJECTED_BODIES: ReadonlyArray<readonly [string, unknown]> = [
  ['a missing body', undefined],
  ['an empty body', {}],
  ['a malformed uuid', { contextId: 'not-a-uuid' }],
  ['a free-text target', { contextId: 'the promotion decision' }],
  ['an extra display field', { contextId: GOAL, displayText: 'my wife' }],
  ['an extra reason field', { contextId: GOAL, reason: 'inferred from the conversation' }],
  ['a suggestion payload', { contextId: GOAL, suggestion: 'QANDEEL thinks this is Goal X' }],
];

describe('ConversationContextActivationController routing and authentication', () => {
  it('is mounted on the conversation surface and protected by the real SupabaseAuthGuard', () => {
    expect(Reflect.getMetadata('path', ConversationContextActivationController)).toBe('conversation');
    expect(Reflect.getMetadata('__guards__', ConversationContextActivationController)).toEqual([SupabaseAuthGuard]);
  });

  it.each(ROUTES)('exposes %s at the exact frozen route', (method, path, verb) => {
    const handler = (ConversationContextActivationController.prototype as unknown as Record<string, object>)[method];
    expect(handler).toBeDefined();
    expect(Reflect.getMetadata('path', handler)).toBe(path);
    expect(Reflect.getMetadata('method', handler)).toBe(verb);
  });

  it('is registered in the Conversation module beside the existing conversation controller', () => {
    const controllers = Reflect.getMetadata('controllers', ConversationModule) as unknown[];
    expect(controllers).toContain(ConversationContextActivationController);
    expect(controllers).toContain(ConversationController);
    const providers = Reflect.getMetadata('providers', ConversationModule) as unknown[];
    expect(providers).toContain(ConversationContextActivationService);
  });

  it('carries no binding write route on the normal conversation controller', () => {
    const conversationPrototype = ConversationController.prototype as unknown as Record<string, object>;
    for (const method of Object.getOwnPropertyNames(ConversationController.prototype)) {
      if (method === 'constructor') continue;
      expect(String(Reflect.getMetadata('path', conversationPrototype[method]))).not.toContain('context-binding');
    }
  });
});

describe('ConversationContextActivationController delegation', () => {
  it('activates using only the authenticated identity and token, delegating exactly once', async () => {
    const facade = facadeDouble();
    const minimal = { contractVersion: 1, source: SOURCE, sessionId: SESSION, activeBinding: { contextKind: 'GOAL', contextId: GOAL } };
    facade.activateContext.mockResolvedValue(minimal);
    const request = authenticatedRequest();
    const body = { contextId: GOAL };
    await expect(controller(facade).activateContext(request, SESSION, 'GOAL', body)).resolves.toBe(minimal);
    expect(facade.activateContext).toHaveBeenCalledTimes(1);
    expect(facade.activateContext).toHaveBeenCalledWith(USER, TOKEN, SESSION, 'GOAL', body);
    expect(facade.deactivateContext).not.toHaveBeenCalled();
    expect(facade.readActiveContexts).not.toHaveBeenCalled();
    // The raw Authorization header value is never forwarded as the token.
    expect(JSON.stringify(facade.activateContext.mock.calls)).not.toContain('a-raw-header-token-that-must-never-be-used');
  });

  it('never lets a caller-supplied identity in the body displace the authenticated one', async () => {
    const facade = facadeDouble();
    facade.activateContext.mockResolvedValue({});
    const forged = { contextId: GOAL, userId: '00000000-0000-4000-8000-0000000000ff', accessToken: 'forged-token' };
    await controller(facade).activateContext(authenticatedRequest(), SESSION, 'GOAL', forged);
    const [userId, accessToken] = facade.activateContext.mock.calls[0];
    expect(userId).toBe(USER);
    expect(accessToken).toBe(TOKEN);
  });

  it('clears using only the authenticated identity and token, delegating exactly once', async () => {
    const facade = facadeDouble();
    const minimal = { contractVersion: 1, source: SOURCE, sessionId: SESSION, contextKind: 'SITUATION', cleared: true };
    facade.deactivateContext.mockResolvedValue(minimal);
    await expect(controller(facade).deactivateContext(authenticatedRequest(), SESSION, 'SITUATION')).resolves.toBe(minimal);
    expect(facade.deactivateContext).toHaveBeenCalledTimes(1);
    expect(facade.deactivateContext).toHaveBeenCalledWith(USER, TOKEN, SESSION, 'SITUATION');
    expect(facade.activateContext).not.toHaveBeenCalled();
  });

  it('reads using only the authenticated identity and token, delegating exactly once', async () => {
    const facade = facadeDouble();
    const minimal = { contractVersion: 1, source: SOURCE, sessionId: SESSION, bindingCount: 0, bindings: [] };
    facade.readActiveContexts.mockResolvedValue(minimal);
    await expect(controller(facade).readActiveContexts(authenticatedRequest(), SESSION)).resolves.toBe(minimal);
    expect(facade.readActiveContexts).toHaveBeenCalledTimes(1);
    expect(facade.readActiveContexts).toHaveBeenCalledWith(USER, TOKEN, SESSION);
    expect(facade.activateContext).not.toHaveBeenCalled();
    expect(facade.deactivateContext).not.toHaveBeenCalled();
  });
});

describe('ConversationContextActivationController end-to-end request validation', () => {
  it('returns the minimal product projection and no internal binding lifecycle metadata', async () => {
    const bindings = bindingDouble();
    bindings.setBinding.mockResolvedValue({
      contractVersion: 1,
      source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING',
      sessionId: SESSION,
      binding: { bindingId: '00000000-0000-4000-8000-0000000000f1', bindingVersion: 4, contextKind: 'GOAL', contextId: GOAL },
    });
    const result = await realChain(bindings).activateContext(authenticatedRequest(), SESSION, 'GOAL', { contextId: GOAL });
    expect(result).toEqual({
      contractVersion: 1, source: SOURCE, sessionId: SESSION, activeBinding: { contextKind: 'GOAL', contextId: GOAL },
    });
    expect(bindings.setBinding).toHaveBeenCalledTimes(1);
    expect(bindings.setBinding).toHaveBeenCalledWith(USER, TOKEN, SESSION, 'GOAL', GOAL);
    expect(bindings.readActiveBindings).not.toHaveBeenCalled();
    expect(bindings.clearBinding).not.toHaveBeenCalled();
  });

  it.each(REJECTED_KINDS)('rejects the route kind %p without touching the QHIA-006 authority', async (kind) => {
    const bindings = bindingDouble();
    const chain = realChain(bindings);
    await expect(chain.activateContext(authenticatedRequest(), SESSION, kind, { contextId: GOAL }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(chain.deactivateContext(authenticatedRequest(), SESSION, kind))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(bindings.setBinding).not.toHaveBeenCalled();
    expect(bindings.clearBinding).not.toHaveBeenCalled();
  });

  it.each(REJECTED_BODIES)('rejects %s without touching the QHIA-006 authority', async (_label, body) => {
    const bindings = bindingDouble();
    await expect(realChain(bindings).activateContext(authenticatedRequest(), SESSION, 'GOAL', body))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(bindings.setBinding).not.toHaveBeenCalled();
  });

  it('rejects a malformed session identifier on every route without touching the QHIA-006 authority', async () => {
    const bindings = bindingDouble();
    const chain = realChain(bindings);
    await expect(chain.activateContext(authenticatedRequest(), 'not-a-session', 'GOAL', { contextId: GOAL }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(chain.deactivateContext(authenticatedRequest(), 'not-a-session', 'GOAL'))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(chain.readActiveContexts(authenticatedRequest(), 'not-a-session'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(bindings.setBinding).not.toHaveBeenCalled();
    expect(bindings.clearBinding).not.toHaveBeenCalled();
    expect(bindings.readActiveBindings).not.toHaveBeenCalled();
  });
});
