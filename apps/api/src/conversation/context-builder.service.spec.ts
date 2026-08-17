import { ContextBuilderService, RECENT_CONTEXT_EXCHANGE_LIMIT } from './context-builder.service';
import { ConversationRepository } from './conversation.repository';
import type { ConversationExchange, ConversationTurn } from './conversation.types';

describe('ContextBuilderService', () => {
  let repository: jest.Mocked<ConversationRepository>;
  let builder: ContextBuilderService;
  const current: ConversationTurn = {
    id: 'current', session_id: 'session-a', role: 'USER', status: 'RECEIVED', content: 'current input',
    processing_path: null, routing_reason: null, source_turn_id: null, idempotency_key: 'request-2',
    created_at: '2026-01-20T00:00:00.000Z', updated_at: 'now', completed_at: null,
  };

  const exchange = (index: number, overrides: { user?: Partial<ConversationTurn>; assistant?: Partial<ConversationTurn> } = {}): ConversationExchange => {
    const userTurn: ConversationTurn = {
      ...current, id: `user-${index}`, status: 'COMPLETED', content: `input-${index}`, idempotency_key: null,
      created_at: `2026-01-${String(index * 2 + 1).padStart(2, '0')}T00:00:00.000Z`, completed_at: 'now', ...overrides.user,
    };
    return { userTurn, assistantTurn: {
      ...userTurn, id: `assistant-${index}`, role: 'ASSISTANT', content: `response-${index}`,
      source_turn_id: userTurn.id, created_at: `2026-01-${String(index * 2 + 2).padStart(2, '0')}T00:00:00.000Z`, ...overrides.assistant,
    } };
  };

  beforeEach(() => {
    repository = { findRecentAuthoritativeExchanges: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<ConversationRepository>;
    builder = new ContextBuilderService(repository);
  });

  it('builds first-turn context with the current source USER turn exactly once', async () => {
    await expect(builder.build('token-a', 'user-a', current)).resolves.toEqual([{ role: 'USER', content: 'current input' }]);
    expect(repository.findRecentAuthoritativeExchanges).toHaveBeenCalledWith(
      'token-a', 'session-a', 'user-a', 'current', RECENT_CONTEXT_EXCHANGE_LIMIT,
    );
  });

  it('assembles durable memory separately and omits an empty memory channel', () => {
    const messages = [{ role: 'USER' as const, content: 'current input' }];
    expect(builder.assemble(messages, [])).toEqual({ messages });
    expect(builder.assemble(messages, [{ type: 'GOAL', content: 'leave work' }])).toEqual({
      messages, memoryContext: [{ type: 'GOAL', content: 'leave work' }],
    });
  });

  it('orders prior complete USER/ASSISTANT exchanges chronologically before the current turn', async () => {
    repository.findRecentAuthoritativeExchanges.mockResolvedValue([exchange(1), exchange(0)]);
    await expect(builder.build('token-a', 'user-a', current)).resolves.toEqual([
      { role: 'USER', content: 'input-0' }, { role: 'ASSISTANT', content: 'response-0' },
      { role: 'USER', content: 'input-1' }, { role: 'ASSISTANT', content: 'response-1' },
      { role: 'USER', content: 'current input' },
    ]);
  });

  it('excludes invalid, non-authoritative, cross-session, and duplicate source exchanges defensively', async () => {
    repository.findRecentAuthoritativeExchanges.mockResolvedValue([
      exchange(0, { user: { status: 'CANCELLED' } }), exchange(1, { assistant: { status: 'FAILED' } }),
      exchange(2, { assistant: { source_turn_id: 'different-user' } }),
      exchange(3, { user: { session_id: 'session-b' }, assistant: { session_id: 'session-b' } }),
      exchange(4, { user: { id: current.id, content: current.content }, assistant: { source_turn_id: current.id } }),
    ]);
    await expect(builder.build('token-a', 'user-a', current)).resolves.toEqual([{ role: 'USER', content: 'current input' }]);
  });

  it('truncates only at complete exchange boundaries when excess history is returned', async () => {
    repository.findRecentAuthoritativeExchanges.mockResolvedValue(
      Array.from({ length: RECENT_CONTEXT_EXCHANGE_LIMIT + 1 }, (_, index) => exchange(index)),
    );
    const context = await builder.build('token-a', 'user-a', current);
    expect(context).toHaveLength(RECENT_CONTEXT_EXCHANGE_LIMIT * 2 + 1);
    expect(context.slice(0, 2)).toEqual([
      { role: 'USER', content: 'input-1' }, { role: 'ASSISTANT', content: 'response-1' },
    ]);
    expect(context.at(-1)).toEqual({ role: 'USER', content: 'current input' });
  });

  it('never emits an orphan row when a candidate exchange is incomplete at the boundary', async () => {
    const mismatched = exchange(0, { assistant: { source_turn_id: 'missing-user' } });
    repository.findRecentAuthoritativeExchanges.mockResolvedValue([mismatched, exchange(1), exchange(2), exchange(3), exchange(4)]);
    const context = await builder.build('token-a', 'user-a', current);
    expect(context.map(({ role }) => role)).toEqual([
      'USER', 'ASSISTANT', 'USER', 'ASSISTANT', 'USER', 'ASSISTANT', 'USER', 'ASSISTANT', 'USER',
    ]);
    expect(context.some(({ content }) => content === mismatched.assistantTurn.content)).toBe(false);
  });
});
