import { BadRequestException } from '@nestjs/common';
import { ConversationContextActivationService } from './conversation-context-activation.service';
import { HimSessionContextBindingService } from '../human-model/him-session-context-binding.service';
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
