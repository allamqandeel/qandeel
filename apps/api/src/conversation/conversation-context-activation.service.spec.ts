import { BadRequestException, ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import { ConversationContextActivationService } from './conversation-context-activation.service';
import {
  CONVERSATION_CONTEXT_ACTIVATION_CONFLICT_MESSAGE,
  CONVERSATION_CONTEXT_ACTIVATION_FORBIDDEN_MESSAGE,
} from './conversation-context-activation.types';
import { HimSessionContextBindingService } from '../human-model/him-session-context-binding.service';
import { MemoryDataApiError } from '../memory/memory-data-api.service';
import { HIM_CROSS_CONTEXT_KINDS, type HimCrossContextKind } from '../human-model/him-session-context-binding.types';

// QHIA-011A facade contract.
//
// The facade is a delegation and projection boundary and nothing else: exactly
// one QHIA-006 command per product command, no read-before-write, no
// clear-then-set replacement, no relevance rule of its own, and a product
// response that carries the exact active context identity and none of the
// internal binding lifecycle metadata.
const USER = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';
const TOKEN = 'authenticated-access-token';
const TARGETS: Record<HimCrossContextKind, string> = {
  GOAL: '00000000-0000-4000-8000-00000000000a',
  SITUATION: '00000000-0000-4000-8000-00000000000b',
  DECISION: '00000000-0000-4000-8000-00000000000c',
  RELATIONSHIP: '00000000-0000-4000-8000-00000000000d',
};
const OTHER_GOAL = '00000000-0000-4000-8000-00000000001a';
const SOURCE = 'QANDEEL_EXPLICIT_SESSION_CONTEXT_ACTIVATION_V1';

// The QHIA-006 result shape, verbatim: it deliberately carries the internal
// binding row identity and version that the product response must NOT.
const setResult = (kind: HimCrossContextKind, contextId: string, bindingVersion = 1) => ({
  contractVersion: 1 as const,
  source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING' as const,
  sessionId: SESSION,
  binding: {
    bindingId: '00000000-0000-4000-8000-0000000000f1',
    bindingVersion,
    contextKind: kind,
    contextId,
  },
});

// Every kind that must never become an explicit cross-context activation, and
// every request body that must be refused BEFORE any transport. Both tables are
// typed explicitly so a heterogeneous fixture list cannot degrade to implicit
// any under ts-jest.
const REJECTED_KINDS: ReadonlyArray<string> = [
  'GLOBAL', 'CONVERSATION_SESSION', 'goal', 'GOAL ', '', 'TOPIC', 'ALL', '__proto__',
];
const REJECTED_BODIES: ReadonlyArray<readonly [string, unknown]> = [
  ['a missing body', undefined],
  ['a null body', null],
  ['an array body', [{ contextId: TARGETS.GOAL }]],
  ['a string body', 'GOAL'],
  ['an empty body', {}],
  ['a free-text target', { contextId: 'my current problem' }],
  ['a prose target', { contextId: 'quit my job' }],
  ['a non-uuid target', { contextId: '00000000-0000-4000-8000' }],
  ['a numeric target', { contextId: 42 }],
  ['a null target', { contextId: null }],
  ['a display label beside the id', { contextId: TARGETS.GOAL, displayText: 'quit my job' }],
  ['a target label beside the id', { contextId: TARGETS.GOAL, targetLabel: 'my wife' }],
  ['a reason beside the id', { contextId: TARGETS.GOAL, reason: 'the user mentioned it' }],
  ['a confidence beside the id', { contextId: TARGETS.GOAL, confidence: 0.9 }],
  ['a source selector beside the id', { contextId: TARGETS.GOAL, source: 'MODEL_SUGGESTION' }],
  ['a suggestion payload beside the id', { contextId: TARGETS.GOAL, suggestion: { targetLabel: 'the promotion decision' } }],
  ['a provider output beside the id', { contextId: TARGETS.GOAL, providerOutput: 'QANDEEL thinks this is Goal X' }],
  ['a caller-supplied identity beside the id', { contextId: TARGETS.GOAL, userId: OTHER_GOAL }],
  ['a caller-supplied token beside the id', { contextId: TARGETS.GOAL, accessToken: 'forged' }],
  ['a latest-target selector instead of an id', { latest: true }],
  ['an only-target selector instead of an id', { onlyTarget: true }],
];

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
const facade = (bindings: BindingDouble) =>
  new ConversationContextActivationService(bindings as unknown as HimSessionContextBindingService);

describe('ConversationContextActivationService.activateContext', () => {
  it.each(HIM_CROSS_CONTEXT_KINDS)('delegates %s to the existing QHIA-006 authority exactly once', async (kind) => {
    const bindings = bindingDouble();
    bindings.setBinding.mockResolvedValue(setResult(kind, TARGETS[kind]));
    const result = await facade(bindings).activateContext(USER, TOKEN, SESSION, kind, { contextId: TARGETS[kind] });
    expect(bindings.setBinding).toHaveBeenCalledTimes(1);
    expect(bindings.setBinding).toHaveBeenCalledWith(USER, TOKEN, SESSION, kind, TARGETS[kind]);
    expect(result).toEqual({
      contractVersion: 1,
      source: SOURCE,
      sessionId: SESSION,
      activeBinding: { contextKind: kind, contextId: TARGETS[kind] },
    });
  });

  it('never reads before it writes: no binding read and no clear precedes the set', async () => {
    const bindings = bindingDouble();
    bindings.setBinding.mockResolvedValue(setResult('GOAL', TARGETS.GOAL));
    await facade(bindings).activateContext(USER, TOKEN, SESSION, 'GOAL', { contextId: TARGETS.GOAL });
    expect(bindings.readActiveBindings).not.toHaveBeenCalled();
    expect(bindings.clearBinding).not.toHaveBeenCalled();
  });

  it('replaces a different target of the same kind with ONE set command - never clear then set', async () => {
    const bindings = bindingDouble();
    bindings.setBinding.mockResolvedValue(setResult('GOAL', OTHER_GOAL, 2));
    const result = await facade(bindings).activateContext(USER, TOKEN, SESSION, 'GOAL', { contextId: OTHER_GOAL });
    expect(bindings.setBinding).toHaveBeenCalledTimes(1);
    expect(bindings.setBinding).toHaveBeenCalledWith(USER, TOKEN, SESSION, 'GOAL', OTHER_GOAL);
    expect(bindings.clearBinding).not.toHaveBeenCalled();
    expect(result.activeBinding).toEqual({ contextKind: 'GOAL', contextId: OTHER_GOAL });
  });

  it('replays the same target through the same single command - idempotency stays the database authority', async () => {
    const bindings = bindingDouble();
    bindings.setBinding.mockResolvedValue(setResult('GOAL', TARGETS.GOAL));
    const service = facade(bindings);
    const first = await service.activateContext(USER, TOKEN, SESSION, 'GOAL', { contextId: TARGETS.GOAL });
    const second = await service.activateContext(USER, TOKEN, SESSION, 'GOAL', { contextId: TARGETS.GOAL });
    expect(bindings.setBinding).toHaveBeenCalledTimes(2);
    expect(bindings.setBinding).toHaveBeenNthCalledWith(1, USER, TOKEN, SESSION, 'GOAL', TARGETS.GOAL);
    expect(bindings.setBinding).toHaveBeenNthCalledWith(2, USER, TOKEN, SESSION, 'GOAL', TARGETS.GOAL);
    expect(second).toEqual(first);
  });

  it('strips every internal binding lifecycle fact from the product response', async () => {
    const bindings = bindingDouble();
    bindings.setBinding.mockResolvedValue(setResult('DECISION', TARGETS.DECISION, 7));
    const result = await facade(bindings).activateContext(USER, TOKEN, SESSION, 'DECISION', { contextId: TARGETS.DECISION });
    expect(Object.keys(result).sort()).toEqual(['activeBinding', 'contractVersion', 'sessionId', 'source']);
    expect(Object.keys(result.activeBinding).sort()).toEqual(['contextId', 'contextKind']);
    for (const internal of ['bindingId', 'bindingVersion', 'binding_source', 'canonical_provenance', 'created_at', 'retired_at', 'status']) {
      expect(JSON.stringify(result)).not.toContain(internal);
    }
    expect(JSON.stringify(result)).not.toContain('EXPLICIT_AUTHENTICATED_CONTEXT_BINDING');
  });

  it.each(REJECTED_KINDS)('rejects the non-cross-context kind %p before any transport', async (kind) => {
    const bindings = bindingDouble();
    await expect(facade(bindings).activateContext(USER, TOKEN, SESSION, kind, { contextId: TARGETS.GOAL }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(bindings.setBinding).not.toHaveBeenCalled();
  });

  it.each(REJECTED_BODIES)('rejects %s before any transport', async (_label, body) => {
    const bindings = bindingDouble();
    await expect(facade(bindings).activateContext(USER, TOKEN, SESSION, 'GOAL', body))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(bindings.setBinding).not.toHaveBeenCalled();
  });

  it('rejects a malformed session identifier before any transport', async () => {
    const bindings = bindingDouble();
    await expect(facade(bindings).activateContext(USER, TOKEN, 'not-a-session', 'GOAL', { contextId: TARGETS.GOAL }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(bindings.setBinding).not.toHaveBeenCalled();
  });

  it('propagates an authority rejection unchanged and adds no fallback activation', async () => {
    const bindings = bindingDouble();
    bindings.setBinding.mockRejectedValue(new Error('Unknown, cross-user, or wrong-kind measurement target'));
    await expect(facade(bindings).activateContext(USER, TOKEN, SESSION, 'GOAL', { contextId: TARGETS.GOAL }))
      .rejects.toThrow('Unknown, cross-user, or wrong-kind measurement target');
    expect(bindings.setBinding).toHaveBeenCalledTimes(1);
    expect(bindings.clearBinding).not.toHaveBeenCalled();
    expect(bindings.readActiveBindings).not.toHaveBeenCalled();
  });
});

describe('ConversationContextActivationService.deactivateContext', () => {
  it.each(HIM_CROSS_CONTEXT_KINDS)('delegates the %s clear exactly once and reports only whether it was cleared', async (kind) => {
    const bindings = bindingDouble();
    bindings.clearBinding.mockResolvedValue({
      contractVersion: 1,
      source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING',
      sessionId: SESSION,
      cleared: true,
      retiredBinding: { bindingId: '00000000-0000-4000-8000-0000000000f2', bindingVersion: 3, contextKind: kind, contextId: TARGETS[kind] },
    });
    const result = await facade(bindings).deactivateContext(USER, TOKEN, SESSION, kind);
    expect(bindings.clearBinding).toHaveBeenCalledTimes(1);
    expect(bindings.clearBinding).toHaveBeenCalledWith(USER, TOKEN, SESSION, kind);
    expect(bindings.setBinding).not.toHaveBeenCalled();
    expect(result).toEqual({ contractVersion: 1, source: SOURCE, sessionId: SESSION, contextKind: kind, cleared: true });
    expect(JSON.stringify(result)).not.toContain('retiredBinding');
    expect(JSON.stringify(result)).not.toContain(TARGETS[kind]);
  });

  it('reports an already-clear kind as cleared:false without inventing a retired identity', async () => {
    const bindings = bindingDouble();
    bindings.clearBinding.mockResolvedValue({
      contractVersion: 1, source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING', sessionId: SESSION, cleared: false, retiredBinding: null,
    });
    const result = await facade(bindings).deactivateContext(USER, TOKEN, SESSION, 'RELATIONSHIP');
    expect(result).toEqual({ contractVersion: 1, source: SOURCE, sessionId: SESSION, contextKind: 'RELATIONSHIP', cleared: false });
  });

  it.each(REJECTED_KINDS)('rejects clearing the kind %p before any transport', async (kind) => {
    const bindings = bindingDouble();
    await expect(facade(bindings).deactivateContext(USER, TOKEN, SESSION, kind)).rejects.toBeInstanceOf(BadRequestException);
    expect(bindings.clearBinding).not.toHaveBeenCalled();
  });
});

describe('ConversationContextActivationService.readActiveContexts', () => {
  it('delegates the read exactly once and projects identity facts only', async () => {
    const bindings = bindingDouble();
    bindings.readActiveBindings.mockResolvedValue({
      contractVersion: 1,
      source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING',
      sessionId: SESSION,
      bindingCount: 1,
      bindings: [{ bindingId: '00000000-0000-4000-8000-0000000000f3', bindingVersion: 5, contextKind: 'SITUATION', contextId: TARGETS.SITUATION }],
    });
    const result = await facade(bindings).readActiveContexts(USER, TOKEN, SESSION);
    expect(bindings.readActiveBindings).toHaveBeenCalledTimes(1);
    expect(bindings.readActiveBindings).toHaveBeenCalledWith(USER, TOKEN, SESSION);
    expect(result).toEqual({
      contractVersion: 1, source: SOURCE, sessionId: SESSION, bindingCount: 1,
      bindings: [{ contextKind: 'SITUATION', contextId: TARGETS.SITUATION }],
    });
    expect(JSON.stringify(result)).not.toContain('bindingVersion');
    expect(JSON.stringify(result)).not.toContain('00000000-0000-4000-8000-0000000000f3');
  });

  it('keeps an absent activation absent - zero bindings is a first-class answer', async () => {
    const bindings = bindingDouble();
    bindings.readActiveBindings.mockResolvedValue({
      contractVersion: 1, source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING', sessionId: SESSION, bindingCount: 0, bindings: [],
    });
    const result = await facade(bindings).readActiveContexts(USER, TOKEN, SESSION);
    expect(result).toEqual({ contractVersion: 1, source: SOURCE, sessionId: SESSION, bindingCount: 0, bindings: [] });
    expect(bindings.setBinding).not.toHaveBeenCalled();
  });

  it('carries all four coexisting kinds through in the canonical order without choosing a primary context', async () => {
    const bindings = bindingDouble();
    bindings.readActiveBindings.mockResolvedValue({
      contractVersion: 1,
      source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING',
      sessionId: SESSION,
      bindingCount: 4,
      bindings: HIM_CROSS_CONTEXT_KINDS.map((kind, index) => ({
        bindingId: `00000000-0000-4000-8000-00000000010${index}`, bindingVersion: index + 1, contextKind: kind, contextId: TARGETS[kind],
      })),
    });
    const result = await facade(bindings).readActiveContexts(USER, TOKEN, SESSION);
    expect(result.bindingCount).toBe(4);
    expect(result.bindings).toEqual([
      { contextKind: 'GOAL', contextId: TARGETS.GOAL },
      { contextKind: 'SITUATION', contextId: TARGETS.SITUATION },
      { contextKind: 'DECISION', contextId: TARGETS.DECISION },
      { contextKind: 'RELATIONSHIP', contextId: TARGETS.RELATIONSHIP },
    ]);
  });

  it('rejects a malformed session identifier before any transport', async () => {
    const bindings = bindingDouble();
    await expect(facade(bindings).readActiveContexts(USER, TOKEN, 'nope')).rejects.toBeInstanceOf(BadRequestException);
    expect(bindings.readActiveBindings).not.toHaveBeenCalled();
  });
});

// QHIA-011A Fix 01: authority-rejection mapping.
//
// The migration-0055 authority is correct and unchanged; the application maps
// its EXACT rejections. Matching is exact SQLSTATE + exact verbatim message,
// never HTTP status alone - PostgREST reports 42501 as HTTP 403 but 55000 as
// HTTP 500, so a status-based rule would be both wrong and dangerous.
const OWNERSHIP_DENIAL_MESSAGES = [
  'Session context bindings are owner-exact',
  'Unknown or cross-user conversation session',
  'Unknown, cross-user, or wrong-kind measurement target',
] as const;
const INACTIVE_SESSION_MESSAGE = 'Conversation session is not active';
// Every failure that must KEEP its existing behaviour. Each one is a real
// shape: an unrecognised SQLSTATE, a drifted message, a malformed upstream body
// that left no structured identity, an integrity breach, and an ordinary error.
const UNMAPPED_FAILURES: ReadonlyArray<readonly [string, unknown]> = [
  ['HTTP 403 with an unrecognised code', new MemoryDataApiError(403, { code: '42P01', message: 'relation does not exist' })],
  ['SQLSTATE 42501 with an unrecognised message', new MemoryDataApiError(403, { code: '42501', message: 'permission denied for table him_session_context_bindings' })],
  ['SQLSTATE 42501 with a near-miss message', new MemoryDataApiError(403, { code: '42501', message: 'Unknown or cross-user conversation session.' })],
  ['SQLSTATE 42501 with a differently-cased message', new MemoryDataApiError(403, { code: '42501', message: 'unknown or cross-user conversation session' })],
  ['HTTP 500 with an unrecognised code', new MemoryDataApiError(500, { code: 'PGRST202', message: 'Could not find the function' })],
  ['SQLSTATE 55000 with an unrecognised message', new MemoryDataApiError(500, { code: '55000', message: 'object not in prerequisite state' })],
  ['an authentication failure past the authenticated boundary', new MemoryDataApiError(401, { code: '42501', message: 'Authentication required' })],
  ['an unsupported-kind SQLSTATE reaching the database', new MemoryDataApiError(400, { code: '22023', message: 'Unsupported session cross-context binding kind' })],
  ['HTTP 403 with no structured identity at all', new MemoryDataApiError(403)],
  ['HTTP 500 with no structured identity at all', new MemoryDataApiError(500)],
  ['a code with no message', new MemoryDataApiError(403, { code: '42501' })],
  ['a message with no code', new MemoryDataApiError(403, { message: 'Session context bindings are owner-exact' })],
  ['a fail-closed integrity breach', new Error('INTEGRITY_FAILURE')],
  ['an ordinary application error', new Error('boom')],
];

const rejectionOf = async (work: () => Promise<unknown>): Promise<unknown> => {
  let caught: unknown;
  try { await work(); } catch (error) { caught = error; }
  return caught;
};

describe('ConversationContextActivationService authority-rejection mapping', () => {
  it.each(OWNERSHIP_DENIAL_MESSAGES)(
    'maps the exact 42501 denial %p to ONE indistinguishable sanitized 403 on every command',
    async (message) => {
      for (const command of ['set', 'clear', 'read'] as const) {
        const bindings = bindingDouble();
        const denial = new MemoryDataApiError(403, { code: '42501', message });
        bindings.setBinding.mockRejectedValue(denial);
        bindings.clearBinding.mockRejectedValue(denial);
        bindings.readActiveBindings.mockRejectedValue(denial);
        const service = facade(bindings);
        const caught = await rejectionOf(() => (
          command === 'set' ? service.activateContext(USER, TOKEN, SESSION, 'GOAL', { contextId: TARGETS.GOAL })
            : command === 'clear' ? service.deactivateContext(USER, TOKEN, SESSION, 'GOAL')
              : service.readActiveContexts(USER, TOKEN, SESSION)
        ));
        expect(caught).toBeInstanceOf(ForbiddenException);
        expect((caught as ForbiddenException).getStatus()).toBe(403);
        expect((caught as ForbiddenException).message).toBe(CONVERSATION_CONTEXT_ACTIVATION_FORBIDDEN_MESSAGE);
      }
    },
  );

  it('never lets the sanitized 403 disclose the SQLSTATE, the database message, or which resource failed', async () => {
    const responses = new Set<string>();
    for (const message of OWNERSHIP_DENIAL_MESSAGES) {
      const bindings = bindingDouble();
      bindings.setBinding.mockRejectedValue(new MemoryDataApiError(403, { code: '42501', message }));
      const caught = await rejectionOf(() => facade(bindings).activateContext(USER, TOKEN, SESSION, 'GOAL', { contextId: TARGETS.GOAL }));
      const serialized = JSON.stringify((caught as ForbiddenException).getResponse());
      responses.add(serialized);
      for (const leak of ['42501', 'owner-exact', 'cross-user', 'wrong-kind', 'him_session_context_bindings', 'SQLSTATE', message]) {
        expect(serialized).not.toContain(leak);
      }
    }
    // Unknown, foreign and wrong-kind are publicly INDISTINGUISHABLE.
    expect(responses.size).toBe(1);
  });

  it.each(['set', 'read'] as const)('maps the exact inactive-session refusal to a sanitized 409 on %s', async (command) => {
    const bindings = bindingDouble();
    const refusal = new MemoryDataApiError(500, { code: '55000', message: INACTIVE_SESSION_MESSAGE });
    bindings.setBinding.mockRejectedValue(refusal);
    bindings.readActiveBindings.mockRejectedValue(refusal);
    const service = facade(bindings);
    const caught = await rejectionOf(() => (
      command === 'set' ? service.activateContext(USER, TOKEN, SESSION, 'GOAL', { contextId: TARGETS.GOAL })
        : service.readActiveContexts(USER, TOKEN, SESSION)
    ));
    expect(caught).toBeInstanceOf(ConflictException);
    expect((caught as ConflictException).getStatus()).toBe(409);
    expect((caught as ConflictException).message).toBe(CONVERSATION_CONTEXT_ACTIVATION_CONFLICT_MESSAGE);
    expect(JSON.stringify((caught as ConflictException).getResponse())).not.toContain('55000');
  });

  it('leaves the existing QHIA-006 clear-on-inactive-session behavior untouched', async () => {
    // Migration 0055 deliberately lets CLEAR retire a binding on an owned
    // session that is no longer ACTIVE, so clear returns normally and there is
    // nothing to map.
    const bindings = bindingDouble();
    bindings.clearBinding.mockResolvedValue({
      contractVersion: 1, source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING', sessionId: SESSION, cleared: true,
      retiredBinding: { bindingId: '00000000-0000-4000-8000-0000000000f9', bindingVersion: 1, contextKind: 'GOAL', contextId: TARGETS.GOAL },
    });
    await expect(facade(bindings).deactivateContext(USER, TOKEN, SESSION, 'GOAL')).resolves.toEqual({
      contractVersion: 1, source: SOURCE, sessionId: SESSION, contextKind: 'GOAL', cleared: true,
    });
  });

  it.each(UNMAPPED_FAILURES)('re-throws %s unchanged, so it keeps its existing server-failure behavior', async (_label, failure) => {
    for (const command of ['set', 'clear', 'read'] as const) {
      const bindings = bindingDouble();
      bindings.setBinding.mockRejectedValue(failure);
      bindings.clearBinding.mockRejectedValue(failure);
      bindings.readActiveBindings.mockRejectedValue(failure);
      const service = facade(bindings);
      const caught = await rejectionOf(() => (
        command === 'set' ? service.activateContext(USER, TOKEN, SESSION, 'GOAL', { contextId: TARGETS.GOAL })
          : command === 'clear' ? service.deactivateContext(USER, TOKEN, SESSION, 'GOAL')
            : service.readActiveContexts(USER, TOKEN, SESSION)
      ));
      expect(caught).toBe(failure);
      expect(caught).not.toBeInstanceOf(HttpException);
    }
  });

  it('never maps by HTTP status alone: the same statuses are 403/409 only with the exact structured identity', async () => {
    const mapped = new MemoryDataApiError(403, { code: '42501', message: 'Session context bindings are owner-exact' });
    const unmapped = new MemoryDataApiError(403, { code: '42501', message: 'permission denied for schema public' });
    const statusOnly = new MemoryDataApiError(403);
    const results: unknown[] = [];
    for (const failure of [mapped, unmapped, statusOnly]) {
      const bindings = bindingDouble();
      bindings.setBinding.mockRejectedValue(failure);
      results.push(await rejectionOf(() => facade(bindings).activateContext(USER, TOKEN, SESSION, 'GOAL', { contextId: TARGETS.GOAL })));
    }
    expect(results[0]).toBeInstanceOf(ForbiddenException);
    expect(results[1]).toBe(unmapped);
    expect(results[2]).toBe(statusOnly);
    // The identical HTTP 500 story: only the exact code+message becomes a 409.
    const conflict = new MemoryDataApiError(500, { code: '55000', message: INACTIVE_SESSION_MESSAGE });
    const serverFailure = new MemoryDataApiError(500, { code: '55000', message: 'object not in prerequisite state' });
    const conflictBindings = bindingDouble();
    conflictBindings.setBinding.mockRejectedValue(conflict);
    expect(await rejectionOf(() => facade(conflictBindings).activateContext(USER, TOKEN, SESSION, 'GOAL', { contextId: TARGETS.GOAL })))
      .toBeInstanceOf(ConflictException);
    const serverBindings = bindingDouble();
    serverBindings.setBinding.mockRejectedValue(serverFailure);
    expect(await rejectionOf(() => facade(serverBindings).activateContext(USER, TOKEN, SESSION, 'GOAL', { contextId: TARGETS.GOAL })))
      .toBe(serverFailure);
  });

  it('maps nothing before transport: structural rejections stay 400 and never reach the authority', async () => {
    const bindings = bindingDouble();
    bindings.setBinding.mockRejectedValue(new MemoryDataApiError(403, { code: '42501', message: 'Session context bindings are owner-exact' }));
    for (const [kind, body] of [['GLOBAL', { contextId: TARGETS.GOAL }], ['GOAL', { contextId: 'quit my job' }]] as ReadonlyArray<readonly [string, unknown]>) {
      const caught = await rejectionOf(() => facade(bindings).activateContext(USER, TOKEN, SESSION, kind, body));
      expect(caught).toBeInstanceOf(BadRequestException);
      expect((caught as BadRequestException).getStatus()).toBe(400);
    }
    expect(bindings.setBinding).not.toHaveBeenCalled();
  });
});

describe('ConversationContextActivationService structural boundary', () => {
  it('needs exactly one collaborator - the existing QHIA-006 binding service - and no provider, model, or repository of its own', () => {
    expect(ConversationContextActivationService.length).toBe(1);
    const bindings = bindingDouble();
    const service = facade(bindings);
    expect(service).toBeInstanceOf(ConversationContextActivationService);
    // Exactly the three product commands are public, and no method on this
    // boundary names a selection, suggestion, inference, or label concept -
    // the shapes QHIA-011A must never grow.
    const methods = Object.getOwnPropertyNames(ConversationContextActivationService.prototype)
      .filter((name) => name !== 'constructor');
    for (const command of ['activateContext', 'deactivateContext', 'readActiveContexts']) {
      expect(methods).toContain(command);
    }
    // "Context" legitimately contains the letters of "text", so the ban list
    // names the concrete free-text shapes instead of the substring.
    for (const method of methods) {
      expect(method).not.toMatch(/search|suggest|infer|latest|first|only|label|displayText|freeText|prose|match|similar|embed|model|provider|resolve|choose|select|switch/iu);
    }
  });
});
