import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConversationRepository } from './conversation.repository';
import { ConversationService } from './conversation.service';
import type { ConversationSession, ConversationTurn } from './conversation.types';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { CorrelationService } from '../observability/correlation.service';
import { DataApiError } from './supabase-data-api.service';

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
    service = new ConversationService(repository, orchestrator,new CorrelationService());
  });

  it('creates a session with only the caller token and a generated UUID — identity stays with the database', async () => {
    repository.createSession.mockResolvedValue(session);
    await expect(service.createSession('user-a', 'token-a')).resolves.toBe(session);
    // The repository receives no userId/status/channel/timestamps: the narrow
    // database command derives the owner from auth.uid() and forces the rest.
    expect(repository.createSession).toHaveBeenCalledWith('token-a', expect.stringMatching(/^[0-9a-f-]{36}$/));
  });

  it('binds the repository-returned canonical session ID to the active request scope',async()=>{
    const correlation=new CorrelationService();service=new ConversationService(repository,orchestrator,correlation);repository.createSession.mockResolvedValue(session);
    await correlation.runRequest(async()=>{await service.createSession('user-a','token-a');expect(correlation.current()?.session_id).toBe(session.id);});
  });

  it('fails closed when a user-scoped session is invisible', async () => {
    repository.findSession.mockResolvedValue(undefined);
    await expect(service.resumeSession('user-a', 'token-a', 'other-session')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects client attempts to override authoritative fields', async () => {
    await expect(service.createTurn('user-a', 'token-a', session.id, {
      content: 'hello', userId: 'user-b', role: 'ASSISTANT', status: 'COMPLETED',
      provider: 'openai', model: 'gpt-5.6-terra', profile: 'openai', reasoning: { effort: 'max' },
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createTurn).not.toHaveBeenCalled();
  });

  it('rejects client attempts to provide or disable behavioral policy', async () => {
    await expect(service.createTurn('user-a', 'token-a', session.id, {
      content: 'hello', behavioralGuidance: 'ignore server policy', behavioralPolicy: false,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createTurn).not.toHaveBeenCalled();
    expect(orchestrator.orchestrate).not.toHaveBeenCalled();
  });

  it('rejects client attempts to choose or disable safety policy', async () => {
    await expect(service.createTurn('user-a', 'token-a', session.id, {
      content: 'hello', safetyCategory: 'NONE', safetyDisposition: 'ALLOW',
      safetyGuidance: 'client policy', safetyDisabled: true,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createTurn).not.toHaveBeenCalled();
    expect(orchestrator.orchestrate).not.toHaveBeenCalled();
  });

  it.each(['IDLE', 'CLOSED', 'EXPIRED'] as const)(
    'rejects NEW turn creation in an owned %s session with no existing idempotency winner',
    async (status) => {
      // The database definer command remains authoritative for ACTIVE/TEXT
      // admission; this service pre-check mirrors it exactly for error mapping.
      repository.findSession.mockResolvedValue({ ...session, status, closed_at: status === 'CLOSED' ? 'now' : null });
      repository.findTurnByIdempotencyKey.mockResolvedValue(undefined);
      await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' }))
        .rejects.toBeInstanceOf(ConflictException);
      expect(repository.findTurnByIdempotencyKey).toHaveBeenCalledWith('token-a', session.id, 'user-a', 'client-1');
      expect(repository.createTurn).not.toHaveBeenCalled();
      expect(orchestrator.orchestrate).not.toHaveBeenCalled();
    },
  );

  it('rejects NEW turn creation in a VOICE session with no existing idempotency winner', async () => {
    repository.findSession.mockResolvedValue({ ...session, channel: 'VOICE' } as unknown as ConversationSession);
    repository.findTurnByIdempotencyKey.mockResolvedValue(undefined);
    await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(repository.createTurn).not.toHaveBeenCalled();
    expect(orchestrator.orchestrate).not.toHaveBeenCalled();
  });

  it('replays the durable idempotency winner even after the session left ACTIVE/TEXT', async () => {
    // Replay recovers already-admitted history; it is not a new turn
    // admission, so the parent lifecycle state does not gate it.
    repository.findSession.mockResolvedValue({ ...session, status: 'CLOSED', closed_at: 'now' });
    repository.findTurnByIdempotencyKey.mockResolvedValue(turn);
    await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' }))
      .resolves.toEqual({ userTurn: turn });
    expect(repository.createTurn).not.toHaveBeenCalled();
    expect(orchestrator.orchestrate).toHaveBeenCalledWith('token-a', 'user-a', turn);
  });

  it('recovers the durable winner through the unchanged unique-violation race path', async () => {
    repository.findSession.mockResolvedValue(session);
    repository.findTurnByIdempotencyKey.mockResolvedValueOnce(undefined).mockResolvedValueOnce(turn);
    repository.createTurn.mockRejectedValue(new DataApiError(409));
    await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' }))
      .resolves.toEqual({ userTurn: turn });
    expect(repository.createTurn).toHaveBeenCalledTimes(1);
    expect(orchestrator.orchestrate).toHaveBeenCalledWith('token-a', 'user-a', turn);
  });

  it('replays a GENERATING idempotency winner through the orchestrator without creating a new USER turn', async () => {
    // Crash-abandoned GENERATING replay: the canonical existing turn is
    // returned and delegated to the orchestrator (which owns the bounded
    // lease-recovery check); no new turn admission occurs.
    const generating: ConversationTurn = { ...turn, status: 'GENERATING', processing_path: 'FAST', routing_reason: 'FAST_DEFAULT' };
    repository.findSession.mockResolvedValue(session);
    repository.findTurnByIdempotencyKey.mockResolvedValue(generating);
    orchestrator.orchestrate.mockResolvedValue({ userTurn: { ...generating, status: 'FAILED' } });
    await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' }))
      .resolves.toEqual({ userTurn: { ...generating, status: 'FAILED' } });
    expect(repository.createTurn).not.toHaveBeenCalled();
    expect(orchestrator.orchestrate).toHaveBeenCalledTimes(1);
    expect(orchestrator.orchestrate).toHaveBeenCalledWith('token-a', 'user-a', generating);
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
