import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import type { TemporalDeliveryRepository } from '../conversation-unit/temporal-delivery.repository';
import { ConversationTemporalController } from './conversation-temporal.controller';

const request = { authenticatedUser: { userId: 'user-a', accessToken: 'token-a' } } as unknown as AuthenticatedRequest;

const EVENT = {
  type: 'CONVERSATIONAL_UNITS_COMMITTED',
  version: 1,
  sessionId: 'session-1',
  batchId: 'batch-1',
  sourceTurnId: 'turn-1',
  firstSp: 1,
  lastSp: 2,
  unitCount: 2,
} as const;
const LF_EVENT = {
  type: 'LIVE_FOCUS_TRANSITION',
  version: 1,
  sessionId: 'session-1',
  atSp: 2,
  value: { kind: 'EMERGING', emergingFocusId: '4ef8538d-ddda-5e11-b7d9-052be85de59a' },
} as const;
const SNAPSHOT = { sessionId: 'session-1', liveHead: 12, liveFocus: { kind: 'THREAD', threadId: 'afc4fd81-fe54-5738-9545-e1053044d919' }, liveFocusAtSp: 9 };

function controller(overrides: Partial<{ snapshot: unknown; events: unknown; liveFocusEvents: unknown }> = {}) {
  const getSessionTemporalState = jest.fn().mockResolvedValue('snapshot' in overrides ? overrides.snapshot : SNAPSHOT);
  const getCommittedEvents = jest.fn().mockResolvedValue('events' in overrides ? overrides.events : [EVENT]);
  const getLiveFocusEvents = jest.fn().mockResolvedValue('liveFocusEvents' in overrides ? overrides.liveFocusEvents : [LF_EVENT]);
  return {
    getSessionTemporalState,
    getCommittedEvents,
    getLiveFocusEvents,
    instance: new ConversationTemporalController(
      { getSessionTemporalState, getCommittedEvents, getLiveFocusEvents } as unknown as TemporalDeliveryRepository,
    ),
  };
}

describe('ConversationTemporalController', () => {
  it('returns the authoritative Session live state (LH + LF) for the caller token only', async () => {
    const { instance, getSessionTemporalState } = controller();
    await expect(instance.sessionTemporalState(request, 'session-1')).resolves.toEqual(SNAPSHOT);
    expect(getSessionTemporalState).toHaveBeenCalledWith('token-a', 'session-1');
    // No caller-supplied user id is forwarded as authorization.
    expect(getSessionTemporalState.mock.calls[0]).toHaveLength(2);
  });

  it('returns liveHead null with liveFocus NONE and never a zero sentinel', async () => {
    const { instance } = controller({ snapshot: { sessionId: 'session-1', liveHead: null, liveFocus: { kind: 'NONE' }, liveFocusAtSp: null } });
    await expect(instance.sessionTemporalState(request, 'session-1')).resolves.toEqual({ sessionId: 'session-1', liveHead: null, liveFocus: { kind: 'NONE' }, liveFocusAtSp: null });
  });

  it('fails closed with 404 for a Session the caller cannot see', async () => {
    const { instance } = controller({ snapshot: undefined });
    await expect(instance.sessionTemporalState(request, 'session-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the ordered committed-CU catch-up page and nothing analytical', async () => {
    const { instance, getCommittedEvents } = controller();
    const response = await instance.committedEvents(request, 'session-1');
    expect(response).toEqual({ sessionId: 'session-1', events: [EVENT] });
    expect(getCommittedEvents).toHaveBeenCalledWith('token-a', 'session-1', {});
    expect(JSON.stringify(response)).not.toMatch(/committed_text|liveFocus|thread|reading|confidence|same_sp/u);
  });

  it('returns the ordered LF transition catch-up page: reference identity only, no sequence, label, Home or content', async () => {
    const { instance, getLiveFocusEvents } = controller();
    const response = await instance.liveFocusEvents(request, 'session-1', '1', '16');
    expect(response).toEqual({ sessionId: 'session-1', events: [LF_EVENT] });
    expect(getLiveFocusEvents).toHaveBeenCalledWith('token-a', 'session-1', { afterSp: 1, limit: 16 });
    expect(JSON.stringify(response)).not.toMatch(/committed_text|same_sp|sequence|label|name|home|placement|reading|confidence|importance|reason/u);
  });

  it('passes an explicit cursor and page size through', async () => {
    const { instance, getCommittedEvents } = controller();
    await instance.committedEvents(request, 'session-1', '7', '32');
    expect(getCommittedEvents).toHaveBeenCalledWith('token-a', 'session-1', { afterSp: 7, limit: 32 });
  });

  it('refuses SP(0), a negative or non-integer cursor, and an out-of-range page size on both catch-up routes', async () => {
    const { instance, getCommittedEvents, getLiveFocusEvents } = controller();
    for (const afterSp of ['0', '-1', '1.5', 'abc', '']) {
      await expect(instance.committedEvents(request, 'session-1', afterSp)).rejects.toBeInstanceOf(BadRequestException);
      await expect(instance.liveFocusEvents(request, 'session-1', afterSp)).rejects.toBeInstanceOf(BadRequestException);
    }
    for (const limit of ['0', '257', 'abc']) {
      await expect(instance.committedEvents(request, 'session-1', undefined, limit)).rejects.toBeInstanceOf(BadRequestException);
      await expect(instance.liveFocusEvents(request, 'session-1', undefined, limit)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(getCommittedEvents).not.toHaveBeenCalled();
    expect(getLiveFocusEvents).not.toHaveBeenCalled();
  });

  it('exposes no Timeline, history, projection or return-to-live route', () => {
    const routes = Object.getOwnPropertyNames(ConversationTemporalController.prototype);
    expect(routes.sort()).toEqual(['committedEvents', 'constructor', 'liveFocusEvents', 'sessionTemporalState']);
  });
});

describe('temporal wiring bootstrap', () => {
  it('loads the conversation module with no provider credential present', async () => {
    // The module registers the segmentation, focus, Thread and continuity
    // binding FACTORIES, never their products, so neither loading the module
    // nor starting the application reads OPENAI_API_KEY. The credential is
    // required only by an actual evaluation, which no unrelated test performs.
    // Effective Live Focus has no provider factory at all.
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    jest.resetModules();
    try {
      const loaded = await import('./conversation.module');
      expect(loaded.ConversationModule).toBeDefined();
      expect(typeof loaded.CU_SEGMENTATION_BINDING_FACTORY).toBe('symbol');
      expect(typeof loaded.FOCUS_RESOLUTION_BINDING_FACTORY).toBe('symbol');
      expect(typeof loaded.THREAD_ESTABLISHMENT_BINDING_FACTORY).toBe('symbol');
      expect(typeof loaded.THREAD_CONTINUITY_BINDING_FACTORY).toBe('symbol');
      expect('LIVE_FOCUS_BINDING_FACTORY' in loaded).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });
});
