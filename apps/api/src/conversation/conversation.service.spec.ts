import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConversationRepository } from './conversation.repository';
import { ConversationService } from './conversation.service';
import type { ConversationSession, ConversationTurn } from './conversation.types';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';

describe('ConversationService', () => {
  let repository: jest.Mocked<ConversationRepository>;
  let service: ConversationService;
  let orchestrator: jest.Mocked<ConversationOrchestratorService>;
  const session: ConversationSession = {
    id: 'session-a', status: 'ACTIVE', channel: 'TEXT', created_at: 'now', updated_at: 'now',
    last_activity_at: 'now', closed_at: null,
  };
  const turn: ConversationTurn = {
    id: 'turn-a', session_id: session.id, role: 'USER', status: 'RECEIVED', content: 'hello',
    processing_path: null, routing_reason: null, source_turn_id: null, idempotency_key: 'client-1', created_at: 'now', updated_at: 'now', completed_at: null,
  };

  beforeEach(() => {
    repository = {
      createSession: jest.fn(), findSession: jest.fn(), createTurn: jest.fn(),
      findTurnByIdempotencyKey: jest.fn(), cancelTurn: jest.fn(),
    } as unknown as jest.Mocked<ConversationRepository>;
    orchestrator = { orchestrate: jest.fn().mockResolvedValue({ userTurn: turn }) } as unknown as jest.Mocked<ConversationOrchestratorService>;
    service = new ConversationService(repository, orchestrator);
  });

  it('creates a text session under the authenticated user only', async () => {
    repository.createSession.mockResolvedValue(session);
    await expect(service.createSession('user-a', 'token-a')).resolves.toBe(session);
    expect(repository.createSession).toHaveBeenCalledWith('token-a', expect.any(String), 'user-a');
  });

  it('fails closed when a user-scoped session is invisible', async () => {
    repository.findSession.mockResolvedValue(undefined);
    await expect(service.resumeSession('user-a', 'token-a', 'other-session')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects client attempts to override authoritative fields', async () => {
    await expect(service.createTurn('user-a', 'token-a', session.id, {
      content: 'hello', userId: 'user-b', role: 'ASSISTANT', status: 'COMPLETED',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createTurn).not.toHaveBeenCalled();
  });

  it('returns the existing authoritative turn for a duplicate idempotency key', async () => {
    repository.findSession.mockResolvedValue(session);
    repository.findTurnByIdempotencyKey.mockResolvedValue(turn);
    await expect(service.createTurn('user-a', 'token-a', session.id, {
      content: 'hello', idempotencyKey: 'client-1',
    })).resolves.toEqual({ userTurn: turn });
    expect(repository.createTurn).not.toHaveBeenCalled();
    expect(orchestrator.orchestrate).toHaveBeenCalledWith('token-a', 'user-a', turn);
  });

  it('creates only a USER/RECEIVED turn through the repository contract', async () => {
    repository.findSession.mockResolvedValue(session);
    repository.findTurnByIdempotencyKey.mockResolvedValue(undefined);
    repository.createTurn.mockResolvedValue(turn);
    await service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' });
    expect(repository.createTurn).toHaveBeenCalledWith('token-a', expect.objectContaining({
      sessionId: session.id, userId: 'user-a', content: 'hello', idempotencyKey: 'client-1',
    }));
  });

  it('does not rewrite terminal or missing turns during cancellation', async () => {
    repository.findSession.mockResolvedValue(session);
    repository.cancelTurn.mockResolvedValue(undefined);
    await expect(service.cancelTurn('user-a', 'token-a', session.id, 'turn-a')).rejects.toBeInstanceOf(ConflictException);
  });
});
