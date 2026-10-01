import { BadRequestException, ConflictException, HttpException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConversationRepository } from './conversation.repository';
import { ConversationService, TURN_ADMISSION_LIMITED } from './conversation.service';
import { assertForegroundProviderBudget, enterForegroundTurnWork, FOREGROUND_TURN_WORK_DEADLINE_DEFAULT_MS, ForegroundTurnDeadlineExceededError } from './foreground-turn-work';
import type { ConversationSession, ConversationTurn, OrchestratedTurnResult } from './conversation.types';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { ConversationSemanticEstablishmentService } from '../live-focus/conversation-semantic-establishment.service';
import { CorrelationService } from '../observability/correlation.service';
import { DataApiError, SupabaseDataApiService } from './supabase-data-api.service';
import { ConversationTurnWorkRepository } from './conversation-turn-work.repository';

describe('ConversationService', () => {
  let repository: jest.Mocked<ConversationRepository>;
  let service: ConversationService;
  let orchestrator: jest.Mocked<ConversationOrchestratorService>;
  let semantic: jest.Mocked<ConversationSemanticEstablishmentService>;
  let turnWork: jest.Mocked<ConversationTurnWorkRepository>;
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
      // T-03A2 / T-03D: present so a post-finalization semantic failure can be
      // PROVEN never to reach the generation-failure lifecycle command.
      failTurn: jest.fn(), finalizeTurn: jest.fn(), claimTurn: jest.fn(),
    } as unknown as jest.Mocked<ConversationRepository>;
    orchestrator = { orchestrate: jest.fn().mockResolvedValue({ userTurn: turn }) } as unknown as jest.Mocked<ConversationOrchestratorService>;
    // Phase 2 is a real, separately owned collaborator: the FINAL semantic
    // chain (T-03D). The default fake is the pass-through an incomplete
    // exchange actually produces.
    semantic = {
      establish: jest.fn(async (_userId: string, result: OrchestratedTurnResult) => result),
    } as unknown as jest.Mocked<ConversationSemanticEstablishmentService>;
    turnWork = {
      begin: jest.fn().mockResolvedValue({ outcome: 'GRANTED', leaseId: 'lease-a' }),
      end: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ConversationTurnWorkRepository>;
    service = new ConversationService(repository, orchestrator,new CorrelationService(), semantic, turnWork);
  });

  it('creates a session with only the caller token and a generated UUID — identity stays with the database', async () => {
    repository.createSession.mockResolvedValue(session);
    await expect(service.createSession('user-a', 'token-a')).resolves.toBe(session);
    // The repository receives no userId/status/channel/timestamps: the narrow
    // database command derives the owner from auth.uid() and forces the rest.
    expect(repository.createSession).toHaveBeenCalledWith('token-a', expect.stringMatching(/^[0-9a-f-]{36}$/));
  });

  it('binds the repository-returned canonical session ID to the active request scope',async()=>{
    const correlation=new CorrelationService();service=new ConversationService(repository,orchestrator,correlation,semantic,turnWork);repository.createSession.mockResolvedValue(session);
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

  // T-03A2 §24 / T-03D §20.1: generation/finalization and post-finalization
  // semantic establishment are DISTINCT technical phases. The second phase
  // runs strictly after the first has produced durable COMPLETED turns, is the
  // FINAL semantic chain ONLY (no temporal-only fallback), and holds no path
  // back into the conversation lifecycle.
  describe('post-finalization semantic establishment (T-03D cutover)', () => {
    const completedUser: ConversationTurn = { ...turn, status: 'COMPLETED', completed_at: 'now' };
    const assistant: ConversationTurn = {
      ...turn, id: 'turn-b', role: 'ASSISTANT', status: 'COMPLETED', content: 'reply',
      source_turn_id: turn.id, idempotency_key: null, completed_at: 'now',
    };
    const finalized: OrchestratedTurnResult = { userTurn: completedUser, assistantTurn: assistant };

    beforeEach(() => {
      repository.findSession.mockResolvedValue(session);
      repository.findTurnByIdempotencyKey.mockResolvedValue(undefined);
      repository.createTurn.mockResolvedValue(turn);
      orchestrator.orchestrate.mockResolvedValue(finalized);
    });

    it('runs the FINAL semantic establishment on the finalized exchange and returns the additive live delivery', async () => {
      const delivered: OrchestratedTurnResult = {
        ...finalized,
        temporal: {
          liveHead: 5,
          liveFocus: { kind: 'EMERGING', emergingFocusId: 'ef-1' },
          committedEvents: [{
            type: 'CONVERSATIONAL_UNITS_COMMITTED', version: 1, sessionId: session.id,
            batchId: 'batch-1', sourceTurnId: turn.id, firstSp: 1, lastSp: 5, unitCount: 5,
          }],
          liveFocusTransitions: [{ type: 'LIVE_FOCUS_TRANSITION', version: 1, sessionId: session.id, atSp: 1, value: { kind: 'EMERGING', emergingFocusId: 'ef-1' } }],
        } as OrchestratedTurnResult['temporal'],
      };
      semantic.establish.mockResolvedValue(delivered);
      await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello' })).resolves.toBe(delivered);
      expect(semantic.establish).toHaveBeenCalledWith('user-a', finalized);
      // The existing result fields are untouched.
      expect(delivered.userTurn).toBe(completedUser);
      expect(delivered.assistantTurn).toBe(assistant);
    });

    it('never marks a COMPLETED turn FAILED, never regenerates, and surfaces a retryable failure', async () => {
      semantic.establish.mockRejectedValue(new ServiceUnavailableException('Conversation semantic establishment is unavailable.'));

      await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello' }))
        .rejects.toBeInstanceOf(ServiceUnavailableException);

      // The generation phase ran exactly once and the durable turns stay COMPLETED.
      expect(orchestrator.orchestrate).toHaveBeenCalledTimes(1);
      expect(repository.failTurn).not.toHaveBeenCalled();
      expect(repository.finalizeTurn).not.toHaveBeenCalled();
      expect(finalized.userTurn.status).toBe('COMPLETED');
      expect(finalized.assistantTurn?.status).toBe('COMPLETED');
    });

    it('calls the FINAL semantic service only: there is no temporal-only fallback path', async () => {
      semantic.establish.mockRejectedValue(new ServiceUnavailableException('Conversation semantic establishment is unavailable.'));
      await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello' })).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(semantic.establish).toHaveBeenCalledTimes(1);
      // The service holds exactly one post-finalization collaborator: no second
      // establishment path exists to fall back to.
      const collaborators = Object.keys(service as unknown as Record<string, unknown>).filter((key) => /temporal|semantic|establish/iu.test(key));
      expect(collaborators).toEqual(['semantic']);
    });

    it('re-enters establishment on an idempotent replay of the completed turn', async () => {
      repository.findTurnByIdempotencyKey.mockResolvedValue(completedUser);
      semantic.establish.mockResolvedValue(finalized);

      await service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' });

      expect(repository.createTurn).not.toHaveBeenCalled();
      expect(semantic.establish).toHaveBeenCalledTimes(1);
      expect(semantic.establish).toHaveBeenCalledWith('user-a', finalized);
    });

    it('re-enters establishment on the unique-violation replay path too', async () => {
      repository.findTurnByIdempotencyKey.mockResolvedValueOnce(undefined).mockResolvedValueOnce(completedUser);
      repository.createTurn.mockRejectedValue(new DataApiError(409));
      semantic.establish.mockResolvedValue(finalized);

      await service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' });

      expect(semantic.establish).toHaveBeenCalledTimes(1);
    });

    it('does not mistake a later semantic failure for a duplicate-key race', async () => {
      semantic.establish.mockRejectedValue(new DataApiError(409));
      await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' }))
        .rejects.toBeInstanceOf(DataApiError);
      // The idempotency winner lookup guards durable admission only.
      expect(repository.findTurnByIdempotencyKey).toHaveBeenCalledTimes(1);
      expect(orchestrator.orchestrate).toHaveBeenCalledTimes(1);
    });
  });
  describe('PROD-SEC-02 turn admission bound and foreground work', () => {
    const limited = () => new DataApiError(429, { databaseCode: 'PT429', databaseMessage: 'TURN_ADMISSION_LIMITED' });

    it('maps the database admission refusal to the typed 429 and starts no orchestration, provider or semantic work', async () => {
      repository.findSession.mockResolvedValue(session);
      repository.findTurnByIdempotencyKey.mockResolvedValue(undefined);
      repository.createTurn.mockRejectedValue(limited());
      const refusal = await service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' }).catch((error: unknown) => error);
      expect(refusal).toBeInstanceOf(HttpException);
      expect((refusal as HttpException).getStatus()).toBe(429);
      // Exactly the code and nothing else: no counter, window, limit, session or other user.
      expect((refusal as HttpException).getResponse()).toEqual({ code: TURN_ADMISSION_LIMITED });
      expect(orchestrator.orchestrate).not.toHaveBeenCalled();
      expect(semantic.establish).not.toHaveBeenCalled();
      expect(turnWork.begin).not.toHaveBeenCalled();
      expect(repository.failTurn).not.toHaveBeenCalled();
    });

    it('reads the exact PostgREST wire answer through the real Data API client as the typed 429', async () => {
      // The body below is byte-for-byte what live PostgREST returns for the bounded admission (proven in CI by
      // database/prove-0131-postgrest-refusal.mjs against every supported PostgREST line). Here it travels through
      // the production SupabaseDataApiService, so the status and identity the service reads are the real ones.
      const environment = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY };
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
        JSON.stringify({ code: 'PT429', details: null, hint: null, message: 'TURN_ADMISSION_LIMITED' }),
        { status: 429, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
      ));
      try {
        process.env.SUPABASE_URL = 'https://data-api.invalid';
        process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-test-key';
        const dataApi = new SupabaseDataApiService();
        repository.findSession.mockResolvedValue(session);
        repository.findTurnByIdempotencyKey.mockResolvedValue(undefined);
        repository.createTurn.mockImplementation(() => dataApi.request('token-a', 'rpc/create_user_conversation_turn', { method: 'POST', body: '{}' }));
        const refusal = await service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' }).catch((error: unknown) => error);
        expect(refusal).toBeInstanceOf(HttpException);
        expect((refusal as HttpException).getStatus()).toBe(429);
        expect((refusal as HttpException).getResponse()).toEqual({ code: TURN_ADMISSION_LIMITED });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(orchestrator.orchestrate).not.toHaveBeenCalled();
      } finally {
        fetchSpy.mockRestore();
        if (environment.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = environment.url;
        if (environment.key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = environment.key;
      }
    });

    it('one request is charged one work start: its generation and its semantic walk share the exchange\'s lease', async () => {
      const completed = { ...turn, status: 'COMPLETED' as const };
      repository.findSession.mockResolvedValue(session);
      repository.findTurnByIdempotencyKey.mockResolvedValue(undefined);
      repository.createTurn.mockResolvedValue(turn);
      orchestrator.orchestrate.mockImplementationOnce(async () => {
        expect(await enterForegroundTurnWork(session.id, turn.id)).toBe('GRANTED');
        return { userTurn: completed };
      });
      semantic.establish.mockImplementationOnce(async (_userId: string, result: OrchestratedTurnResult) => {
        expect(await enterForegroundTurnWork(session.id, turn.id)).toBe('GRANTED');
        return result;
      });
      await service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' });
      expect(turnWork.begin).toHaveBeenCalledTimes(1);
      expect(turnWork.end).toHaveBeenCalledTimes(1);
    });

    it('a replay of a completed-but-unestablished exchange is a new request, so its semantic walk is charged a work start', async () => {
      const completed = { ...turn, status: 'COMPLETED' as const };
      repository.findSession.mockResolvedValue(session);
      repository.findTurnByIdempotencyKey.mockResolvedValue(completed);
      orchestrator.orchestrate.mockResolvedValue({ userTurn: completed });
      semantic.establish.mockImplementation(async (_userId: string, result: OrchestratedTurnResult) => {
        if (await enterForegroundTurnWork(session.id, turn.id) !== 'GRANTED') throw new ServiceUnavailableException('Conversation semantic establishment is unavailable.');
        return result;
      });
      turnWork.begin.mockResolvedValueOnce({ outcome: 'GRANTED', leaseId: 'lease-1' }).mockResolvedValueOnce({ outcome: 'LIMITED' });
      await service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' });
      await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' })).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(turnWork.begin).toHaveBeenCalledTimes(2);
      expect(repository.createTurn).not.toHaveBeenCalled();
      expect(repository.failTurn).not.toHaveBeenCalled();
    });

    it('never reads a different failure as the admission bound: a bare 429 or a foreign PT429 message stays what it was', async () => {
      repository.findSession.mockResolvedValue(session);
      for (const error of [new DataApiError(429), new DataApiError(429, { databaseCode: 'PT429', databaseMessage: 'SOMETHING_ELSE' }), new DataApiError(500, { databaseCode: 'PT429', databaseMessage: 'TURN_ADMISSION_LIMITED' })]) {
        repository.createTurn.mockRejectedValueOnce(error);
        await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello' })).rejects.toBe(error);
      }
      expect(orchestrator.orchestrate).not.toHaveBeenCalled();
    });

    it('an idempotent replay is resolved before admission, so it is never limited and never charged', async () => {
      repository.findSession.mockResolvedValue(session);
      repository.findTurnByIdempotencyKey.mockResolvedValue(turn);
      repository.createTurn.mockRejectedValue(limited());
      await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' })).resolves.toEqual({ userTurn: turn });
      expect(repository.createTurn).not.toHaveBeenCalled();
      expect(orchestrator.orchestrate).toHaveBeenCalledWith('token-a', 'user-a', turn);
    });

    it('returns the exchange\'s work lease when the request ends - after success and after a failure', async () => {
      repository.findSession.mockResolvedValue(session);
      repository.findTurnByIdempotencyKey.mockResolvedValue(undefined);
      repository.createTurn.mockResolvedValue(turn);
      orchestrator.orchestrate.mockImplementationOnce(async () => {
        await enterForegroundTurnWork(session.id, turn.id);
        return { userTurn: turn };
      });
      await service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' });
      expect(turnWork.begin).toHaveBeenCalledWith(session.id, 'user-a', turn.id);
      expect(turnWork.end).toHaveBeenCalledWith('user-a', turn.id, 'lease-a');

      orchestrator.orchestrate.mockImplementationOnce(async () => {
        await enterForegroundTurnWork(session.id, turn.id);
        throw new ServiceUnavailableException('Conversation generation failed.');
      });
      await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' })).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(turnWork.end).toHaveBeenCalledTimes(2);
    });

    it('a completed reply whose semantic phase is deferred or out of time stays completed: the turn is never failed', async () => {
      const completed = { ...turn, status: 'COMPLETED' as const };
      const assistant = { ...turn, id: 'assistant-a', role: 'ASSISTANT' as const, status: 'COMPLETED' as const, source_turn_id: turn.id };
      repository.findSession.mockResolvedValue(session);
      repository.findTurnByIdempotencyKey.mockResolvedValue(undefined);
      repository.createTurn.mockResolvedValue(turn);
      orchestrator.orchestrate.mockResolvedValue({ userTurn: completed, assistantTurn: assistant });
      semantic.establish.mockRejectedValue(new ServiceUnavailableException('Conversation semantic establishment is unavailable.'));
      await expect(service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' })).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(repository.failTurn).not.toHaveBeenCalled();
    });

    it('runs the whole request under one deadline: a provider asked after it has passed is refused', async () => {
      const now = jest.spyOn(Date, 'now');
      try {
        now.mockReturnValue(1_000_000);
        repository.findSession.mockResolvedValue(session);
        repository.findTurnByIdempotencyKey.mockResolvedValue(undefined);
        repository.createTurn.mockResolvedValue(turn);
        orchestrator.orchestrate.mockImplementationOnce(async () => {
          expect(() => assertForegroundProviderBudget()).not.toThrow();
          now.mockReturnValue(1_000_000 + FOREGROUND_TURN_WORK_DEADLINE_DEFAULT_MS);
          expect(() => assertForegroundProviderBudget()).toThrow(ForegroundTurnDeadlineExceededError);
          return { userTurn: turn };
        });
        await service.createTurn('user-a', 'token-a', session.id, { content: 'hello', idempotencyKey: 'client-1' });
        expect(orchestrator.orchestrate).toHaveBeenCalledTimes(1);
      } finally {
        now.mockRestore();
      }
    });
  });
});
