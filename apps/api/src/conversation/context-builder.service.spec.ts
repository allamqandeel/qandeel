import { ContextBuilderService, RECENT_CONTEXT_HISTORY_LIMIT } from './context-builder.service';
import { ConversationRepository } from './conversation.repository';
import type { ConversationTurn } from './conversation.types';

describe('ContextBuilderService', () => {
  let repository: jest.Mocked<ConversationRepository>;
  let builder: ContextBuilderService;
  const current: ConversationTurn = {
    id: 'current', session_id: 'session-a', role: 'USER', status: 'RECEIVED', content: 'current input',
    processing_path: null, routing_reason: null, source_turn_id: null, idempotency_key: 'request-2',
    created_at: '2026-01-03T00:00:00.000Z', updated_at: 'now', completed_at: null,
  };

  const turn = (overrides: Partial<ConversationTurn>): ConversationTurn => ({
    ...current,
    id: 'prior-user',
    status: 'COMPLETED',
    content: 'prior input',
    idempotency_key: null,
    created_at: '2026-01-01T00:00:00.000Z',
    completed_at: 'now',
    ...overrides,
  });

  beforeEach(() => {
    repository = { findRecentAuthoritativeTurns: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<ConversationRepository>;
    builder = new ContextBuilderService(repository);
  });

  it('builds first-turn context with the current source USER turn exactly once', async () => {
    await expect(builder.build('token-a', 'user-a', current)).resolves.toEqual([
      { role: 'USER', content: 'current input' },
    ]);
    expect(repository.findRecentAuthoritativeTurns).toHaveBeenCalledWith(
      'token-a', 'session-a', 'user-a', 'current', RECENT_CONTEXT_HISTORY_LIMIT,
    );
  });

  it('orders prior USER/ASSISTANT turns chronologically before the current turn', async () => {
    repository.findRecentAuthoritativeTurns.mockResolvedValue([
      turn({ id: 'prior-assistant', role: 'ASSISTANT', content: 'prior response', source_turn_id: 'prior-user', created_at: '2026-01-02T00:00:00.000Z' }),
      turn({ id: 'prior-user' }),
    ]);

    await expect(builder.build('token-a', 'user-a', current)).resolves.toEqual([
      { role: 'USER', content: 'prior input' },
      { role: 'ASSISTANT', content: 'prior response' },
      { role: 'USER', content: 'current input' },
    ]);
  });

  it('excludes invalid, non-authoritative, cross-session, and duplicate source turns defensively', async () => {
    repository.findRecentAuthoritativeTurns.mockResolvedValue([
      turn({ id: 'cancelled', status: 'CANCELLED' }),
      turn({ id: 'failed', status: 'FAILED' }),
      turn({ id: 'assistant-without-source', role: 'ASSISTANT', source_turn_id: null }),
      turn({ id: 'other-session', session_id: 'session-b' }),
      turn({ id: current.id, content: current.content }),
    ]);

    await expect(builder.build('token-a', 'user-a', current)).resolves.toEqual([
      { role: 'USER', content: 'current input' },
    ]);
  });

  it('uses deterministic id ordering when authoritative turns share a timestamp', async () => {
    repository.findRecentAuthoritativeTurns.mockResolvedValue([
      turn({ id: 'b', role: 'ASSISTANT', source_turn_id: 'a', content: 'second' }),
      turn({ id: 'a', content: 'first' }),
    ]);

    const context = await builder.build('token-a', 'user-a', current);
    expect(context.map(({ content }) => content)).toEqual(['first', 'second', 'current input']);
  });

  it('truncates excess history to the server-owned most-recent turn limit', async () => {
    repository.findRecentAuthoritativeTurns.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => turn({
        id: `turn-${String(index).padStart(2, '0')}`,
        content: `message-${index}`,
        created_at: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      })),
    );

    const context = await builder.build('token-a', 'user-a', current);
    expect(context).toHaveLength(RECENT_CONTEXT_HISTORY_LIMIT + 1);
    expect(context[0]).toEqual({ role: 'USER', content: 'message-2' });
    expect(context.at(-1)).toEqual({ role: 'USER', content: 'current input' });
  });
});
