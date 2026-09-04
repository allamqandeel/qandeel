import { ServiceUnavailableException } from '@nestjs/common';
import type { ConversationTurn, OrchestratedTurnResult } from '../conversation/conversation.types';
import {
  ConversationTemporalEstablishmentService,
  type CuSegmentationBinding,
} from './conversation-temporal-establishment.service';
import type { ConversationUnitRepository } from './conversation-unit.repository';
import type {
  CommitBatchSnapshot,
  CommitFinalizedExchangeRequest,
  CommittedConversationUnit,
  FinalizedExchangeCommitResult,
} from './conversation-unit.types';
import type { SourceAnchor } from './cu-anchor-mapper';
import { CuSegmentationProviderError, type CuSegmentationProvider, type CuSegmentationRequest } from './cu-segmentation-provider.types';
import { automaticCommitBatchId, automaticCommitUnitId } from './deterministic-runtime-id';

const SESSION = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const USER_TURN = '11111111-1111-4111-8111-111111111111';
const ASSISTANT_TURN = '22222222-2222-4222-8222-222222222222';

const USER_CONTENT = 'first user claim. second user claim.';
const ASSISTANT_CONTENT = 'first reply. second reply. third reply.';

const USER_BATCH = automaticCommitBatchId(USER_TURN);
const ASSISTANT_BATCH = automaticCommitBatchId(ASSISTANT_TURN);

function turn(overrides: Partial<ConversationTurn> = {}): ConversationTurn {
  return {
    id: USER_TURN, session_id: SESSION, role: 'USER', status: 'COMPLETED', content: USER_CONTENT,
    processing_path: 'FAST', routing_reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT', source_turn_id: null,
    idempotency_key: null, created_at: 'now', updated_at: 'now', completed_at: 'now',
    ...overrides,
  };
}

const userTurn = turn();
const assistantTurn = turn({
  id: ASSISTANT_TURN, role: 'ASSISTANT', content: ASSISTANT_CONTENT, source_turn_id: USER_TURN,
});
const exchange: OrchestratedTurnResult = { userTurn, assistantTurn };

/** A provider that answers per source role, so the two sources are never conflated. */
class RoleScriptedProvider implements CuSegmentationProvider {
  readonly requests: CuSegmentationRequest[] = [];

  constructor(
    private readonly script: {
      USER: readonly SourceAnchor[] | CuSegmentationProviderError;
      ASSISTANT: readonly SourceAnchor[] | CuSegmentationProviderError;
    },
  ) {}

  async propose(request: CuSegmentationRequest): Promise<{ units: readonly SourceAnchor[] }> {
    this.requests.push(request);
    const answer = this.script[request.sourceRole];
    if (answer instanceof CuSegmentationProviderError) throw answer;
    return { units: answer };
  }
}

const DEFAULT_SCRIPT = {
  USER: [{ text: 'first user claim.', occurrence: 1 }, { text: 'second user claim.', occurrence: 1 }],
  ASSISTANT: [
    { text: 'first reply.', occurrence: 1 },
    { text: 'second reply.', occurrence: 1 },
    { text: 'third reply.', occurrence: 1 },
  ],
} as const;

function binding(provider: CuSegmentationProvider): CuSegmentationBinding {
  return { provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' };
}

function unit(batchId: string, index: number, sp: number, spanStart: number, spanEnd: number, role: 'USER' | 'ASSISTANT'): CommittedConversationUnit {
  return {
    id: automaticCommitUnitId(batchId, { index, spanStart, spanEnd }),
    user_id: USER, session_id: SESSION, source_turn_id: role === 'USER' ? USER_TURN : ASSISTANT_TURN,
    commit_batch_id: batchId, source_role: role, speaker_state: 'RESOLVED', source_modality: 'TEXT',
    ordinal_within_turn: index, source_span_start: spanStart, source_span_end: spanEnd,
    committed_text: 'x'.repeat(spanEnd - spanStart), source_content_sha256: 'deadbeef',
    session_position: sp, created_at: 'now',
  };
}

function snapshot(overrides: Partial<CommitBatchSnapshot> = {}): CommitBatchSnapshot {
  return {
    batch_exists: false, committed_unit_count: 0, units: [], event: null, source_frontier: 0, live_head: null,
    ...overrides,
  };
}

function committedSnapshot(batchId: string, role: 'USER' | 'ASSISTANT', firstSp: number, count: number, liveHead: number): CommitBatchSnapshot {
  const units = Array.from({ length: count }, (_value, index) =>
    unit(batchId, index, firstSp + index, index * 10, index * 10 + 5, role));
  return {
    batch_exists: true,
    committed_unit_count: count,
    units,
    event: {
      commit_batch_id: batchId, user_id: USER, session_id: SESSION,
      source_turn_id: role === 'USER' ? USER_TURN : ASSISTANT_TURN,
      first_sp: firstSp, last_sp: firstSp + count - 1, unit_count: count, created_at: 'now',
    },
    source_frontier: count * 10,
    live_head: liveHead,
  };
}

function repository(overrides: Partial<{
  snapshots: (batchId: string) => CommitBatchSnapshot;
  commit: (request: CommitFinalizedExchangeRequest) => Promise<FinalizedExchangeCommitResult>;
}> = {}) {
  const readBatchSnapshot = jest.fn(async ({ batchId }: { batchId: string }) =>
    (overrides.snapshots ?? (() => snapshot()))(batchId));
  const commitFinalizedExchange = jest.fn(overrides.commit ?? (async (request: CommitFinalizedExchangeRequest) => ({
    live_head: 5,
    user_units: request.userUnits.map((proposed, index) => unit(request.userBatchId, index, index + 1, proposed.spanStart, proposed.spanEnd, 'USER')),
    assistant_units: request.assistantUnits.map((proposed, index) =>
      unit(request.assistantBatchId, index, request.userUnits.length + index + 1, proposed.spanStart, proposed.spanEnd, 'ASSISTANT')),
    user_event: request.userUnits.length === 0 ? null : {
      commit_batch_id: request.userBatchId, user_id: USER, session_id: SESSION, source_turn_id: USER_TURN,
      first_sp: 1, last_sp: request.userUnits.length, unit_count: request.userUnits.length, created_at: 'now',
    },
    assistant_event: request.assistantUnits.length === 0 ? null : {
      commit_batch_id: request.assistantBatchId, user_id: USER, session_id: SESSION, source_turn_id: ASSISTANT_TURN,
      first_sp: request.userUnits.length + 1,
      last_sp: request.userUnits.length + request.assistantUnits.length,
      unit_count: request.assistantUnits.length, created_at: 'now',
    },
  })));
  return {
    readBatchSnapshot,
    commitFinalizedExchange,
    repo: { readBatchSnapshot, commitFinalizedExchange } as unknown as ConversationUnitRepository,
  };
}

describe('ConversationTemporalEstablishmentService', () => {
  it('evaluates USER and ASSISTANT separately and never merges their source', async () => {
    const provider = new RoleScriptedProvider(DEFAULT_SCRIPT);
    const { repo, commitFinalizedExchange } = repository();
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));

    await service.establish(USER, exchange);

    expect(provider.requests).toHaveLength(2);
    expect(provider.requests.map((request) => request.sourceRole).sort()).toEqual(['ASSISTANT', 'USER']);
    for (const request of provider.requests) {
      expect(request.sourceText === USER_CONTENT || request.sourceText === ASSISTANT_CONTENT).toBe(true);
      expect(request.sourceText).not.toContain(request.sourceRole === 'USER' ? 'first reply.' : 'first user claim.');
    }
    // One atomic commit, USER block first.
    expect(commitFinalizedExchange).toHaveBeenCalledTimes(1);
    const committed = commitFinalizedExchange.mock.calls[0][0] as CommitFinalizedExchangeRequest;
    expect(committed.userSourceTurnId).toBe(USER_TURN);
    expect(committed.assistantSourceTurnId).toBe(ASSISTANT_TURN);
    expect(committed.userBatchId).toBe(USER_BATCH);
    expect(committed.assistantBatchId).toBe(ASSISTANT_BATCH);
    expect(committed.userUnits).toHaveLength(2);
    expect(committed.assistantUnits).toHaveLength(3);
  });

  it('returns the additive temporal delivery ordered by Session Position', async () => {
    const provider = new RoleScriptedProvider(DEFAULT_SCRIPT);
    const { repo } = repository();
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));

    const result = await service.establish(USER, exchange);

    expect(result.userTurn).toBe(userTurn);
    expect(result.assistantTurn).toBe(assistantTurn);
    expect(result.temporal).toEqual({
      liveHead: 5,
      committedEvents: [
        expect.objectContaining({ type: 'CONVERSATIONAL_UNITS_COMMITTED', version: 1, firstSp: 1, lastSp: 2, unitCount: 2, sourceTurnId: USER_TURN }),
        expect.objectContaining({ firstSp: 3, lastSp: 5, unitCount: 3, sourceTurnId: ASSISTANT_TURN }),
      ],
    });
    // The wire event carries no analytical or future material.
    expect(JSON.stringify(result.temporal)).not.toMatch(/committed_text|liveFocus|thread|reading|confidence|created_at/u);
  });

  it('derives deterministic unit identities so an equivalent retry addresses the same rows', async () => {
    const provider = new RoleScriptedProvider(DEFAULT_SCRIPT);
    const { repo, commitFinalizedExchange } = repository();
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));

    await service.establish(USER, exchange);
    const first = commitFinalizedExchange.mock.calls[0][0] as CommitFinalizedExchangeRequest;
    expect(first.userUnits.map((proposed) => proposed.unitId)).toEqual(
      first.userUnits.map((proposed, index) => automaticCommitUnitId(USER_BATCH, { index, spanStart: proposed.spanStart, spanEnd: proposed.spanEnd })),
    );

    const second = new ConversationTemporalEstablishmentService(repository().repo, () => binding(new RoleScriptedProvider(DEFAULT_SCRIPT)));
    const secondRepo = repository();
    const replayService = new ConversationTemporalEstablishmentService(secondRepo.repo, () => binding(new RoleScriptedProvider(DEFAULT_SCRIPT)));
    await replayService.establish(USER, exchange);
    const replayed = secondRepo.commitFinalizedExchange.mock.calls[0][0] as CommitFinalizedExchangeRequest;
    expect(replayed.userUnits).toEqual(first.userUnits);
    expect(replayed.assistantUnits).toEqual(first.assistantUnits);
    expect(second).toBeDefined();
  });

  it('performs ZERO provider calls when both automatic batches are already committed', async () => {
    const provider = new RoleScriptedProvider(DEFAULT_SCRIPT);
    const { repo, commitFinalizedExchange } = repository({
      snapshots: (batchId) => batchId === USER_BATCH
        ? committedSnapshot(USER_BATCH, 'USER', 1, 2, 5)
        : committedSnapshot(ASSISTANT_BATCH, 'ASSISTANT', 3, 3, 5),
    });
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));

    const result = await service.establish(USER, exchange);

    expect(provider.requests).toHaveLength(0);
    expect(commitFinalizedExchange).not.toHaveBeenCalled();
    expect(result.temporal?.liveHead).toBe(5);
    expect(result.temporal?.committedEvents.map((event) => event.firstSp)).toEqual([1, 3]);
  });

  it('treats a committed zero-CU pair as complete and produces no advancement event', async () => {
    const provider = new RoleScriptedProvider(DEFAULT_SCRIPT);
    const { repo } = repository({
      snapshots: () => snapshot({ batch_exists: true, committed_unit_count: 0, live_head: null }),
    });
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));

    const result = await service.establish(USER, exchange);

    expect(provider.requests).toHaveLength(0);
    expect(result.temporal).toEqual({ liveHead: null, committedEvents: [] });
  });

  it('allocates only ASSISTANT Session Positions when the USER source yields zero CUs', async () => {
    const provider = new RoleScriptedProvider({ USER: [], ASSISTANT: DEFAULT_SCRIPT.ASSISTANT });
    const { repo, commitFinalizedExchange } = repository();
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));

    const result = await service.establish(USER, exchange);

    const committed = commitFinalizedExchange.mock.calls[0][0] as CommitFinalizedExchangeRequest;
    expect(committed.userUnits).toEqual([]);
    expect(committed.assistantUnits).toHaveLength(3);
    // No phantom USER Moment: exactly one delivery event, the ASSISTANT block.
    expect(result.temporal?.committedEvents).toHaveLength(1);
    expect(result.temporal?.committedEvents[0]?.sourceTurnId).toBe(ASSISTANT_TURN);
  });

  it('leaves the Live Head unchanged when both halves yield zero CUs', async () => {
    const provider = new RoleScriptedProvider({ USER: [], ASSISTANT: [] });
    const { repo } = repository({
      commit: async () => ({ live_head: null, user_units: [], assistant_units: [], user_event: null, assistant_event: null }),
    });
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));

    await expect(service.establish(USER, exchange)).resolves.toMatchObject({
      temporal: { liveHead: null, committedEvents: [] },
    });
  });

  it('fails closed on a provider outage and never collapses the turn to one CU', async () => {
    const provider = new RoleScriptedProvider({
      USER: new CuSegmentationProviderError('UNAVAILABLE'),
      ASSISTANT: DEFAULT_SCRIPT.ASSISTANT,
    });
    const { repo, commitFinalizedExchange } = repository();
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));

    await expect(service.establish(USER, exchange)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(commitFinalizedExchange).not.toHaveBeenCalled();
  });

  it('establishes temporal truth on a retry after an outage', async () => {
    const failing = new RoleScriptedProvider({
      USER: new CuSegmentationProviderError('TIMEOUT'),
      ASSISTANT: DEFAULT_SCRIPT.ASSISTANT,
    });
    const { repo } = repository();
    await expect(new ConversationTemporalEstablishmentService(repo, () => binding(failing)).establish(USER, exchange))
      .rejects.toBeInstanceOf(ServiceUnavailableException);

    const recovered = repository();
    const service = new ConversationTemporalEstablishmentService(recovered.repo, () => binding(new RoleScriptedProvider(DEFAULT_SCRIPT)));
    await expect(service.establish(USER, exchange)).resolves.toMatchObject({ temporal: { liveHead: 5 } });
  });

  it('re-reads the canonical winner instead of overwriting it when a race is lost', async () => {
    const provider = new RoleScriptedProvider(DEFAULT_SCRIPT);
    let committed = false;
    const readBatchSnapshot = jest.fn(async ({ batchId }: { batchId: string }) => {
      if (!committed) return snapshot();
      return batchId === USER_BATCH
        ? committedSnapshot(USER_BATCH, 'USER', 1, 2, 5)
        : committedSnapshot(ASSISTANT_BATCH, 'ASSISTANT', 3, 3, 5);
    });
    const commitFinalizedExchange = jest.fn(async () => {
      committed = true;
      throw new Error('COMMIT_BATCH_PAYLOAD_CONFLICT');
    });
    const service = new ConversationTemporalEstablishmentService(
      { readBatchSnapshot, commitFinalizedExchange } as unknown as ConversationUnitRepository,
      () => binding(provider),
    );

    const result = await service.establish(USER, exchange);

    expect(commitFinalizedExchange).toHaveBeenCalledTimes(1);
    expect(result.temporal?.liveHead).toBe(5);
    expect(result.temporal?.committedEvents.map((event) => event.lastSp)).toEqual([2, 5]);
  });

  it('fails closed when a lost race did not actually produce a canonical pair', async () => {
    const provider = new RoleScriptedProvider(DEFAULT_SCRIPT);
    const { repo } = repository({ commit: async () => { throw new Error('transport is unavailable'); } });
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));
    await expect(service.establish(USER, exchange)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('treats a structurally partial automatic pair as an integrity failure, never a silent repair', async () => {
    const provider = new RoleScriptedProvider(DEFAULT_SCRIPT);
    const { repo, commitFinalizedExchange } = repository({
      snapshots: (batchId) => batchId === USER_BATCH ? committedSnapshot(USER_BATCH, 'USER', 1, 2, 2) : snapshot(),
    });
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));

    await expect(service.establish(USER, exchange)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(provider.requests).toHaveLength(0);
    expect(commitFinalizedExchange).not.toHaveBeenCalled();
  });

  it('fails closed when a committed batch carries no delivery event or a mismatched range', async () => {
    const provider = new RoleScriptedProvider(DEFAULT_SCRIPT);
    const healthyAssistant = committedSnapshot(ASSISTANT_BATCH, 'ASSISTANT', 3, 3, 5);
    for (const broken of [
      { ...committedSnapshot(USER_BATCH, 'USER', 1, 2, 5), event: null },
      {
        ...committedSnapshot(USER_BATCH, 'USER', 1, 2, 5),
        event: { ...committedSnapshot(USER_BATCH, 'USER', 1, 2, 5).event!, last_sp: 9, unit_count: 9 },
      },
      // A zero-CU batch may never carry an advancement event.
      { ...snapshot({ batch_exists: true, committed_unit_count: 0, live_head: 5 }), event: committedSnapshot(USER_BATCH, 'USER', 1, 2, 5).event },
    ]) {
      const { repo } = repository({
        snapshots: (batchId) => batchId === USER_BATCH ? broken : healthyAssistant,
      });
      const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));
      await expect(service.establish(USER, exchange)).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });

  it('fails closed when committed Moments exist but the Session carries no Live Head at all', async () => {
    const provider = new RoleScriptedProvider(DEFAULT_SCRIPT);
    const { repo } = repository({
      snapshots: (batchId) => batchId === USER_BATCH
        ? { ...committedSnapshot(USER_BATCH, 'USER', 1, 2, 5), live_head: 1 }
        : { ...committedSnapshot(ASSISTANT_BATCH, 'ASSISTANT', 3, 3, 5), live_head: 1 },
    });
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));
    await expect(service.establish(USER, exchange)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('passes an exchange that is not a completed USER/ASSISTANT pair straight through', async () => {
    const provider = new RoleScriptedProvider(DEFAULT_SCRIPT);
    const { repo, readBatchSnapshot } = repository();
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));

    for (const result of [
      { userTurn } as OrchestratedTurnResult,
      { userTurn: turn({ status: 'FAILED' }) } as OrchestratedTurnResult,
      { userTurn: turn({ status: 'GENERATING' }), assistantTurn } as OrchestratedTurnResult,
      { userTurn, assistantTurn: turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', status: 'FAILED', source_turn_id: USER_TURN }) },
    ]) {
      await expect(service.establish(USER, result)).resolves.toBe(result);
    }
    expect(readBatchSnapshot).not.toHaveBeenCalled();
    expect(provider.requests).toHaveLength(0);
  });

  // FIX-T03A2-01: a pair that is present and COMPLETED but structurally not a
  // finalized exchange is NOT "nothing to establish" - it fails closed before
  // any provider call and before any database commitment.
  it.each([
    ['the halves are swapped', { userTurn: assistantTurn, assistantTurn: userTurn }],
    ['the USER half is not a USER turn', {
      userTurn: turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', source_turn_id: null }),
      assistantTurn,
    }],
    ['the ASSISTANT half is not an ASSISTANT turn', {
      userTurn,
      assistantTurn: turn({ id: ASSISTANT_TURN, role: 'USER', source_turn_id: USER_TURN }),
    }],
    ['the ASSISTANT is not the response to that USER turn', {
      userTurn,
      assistantTurn: turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', source_turn_id: '99999999-9999-4999-8999-999999999999' }),
    }],
    ['the ASSISTANT has no source turn at all', {
      userTurn,
      assistantTurn: turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', source_turn_id: null }),
    }],
    ['the two halves belong to different Sessions', {
      userTurn,
      assistantTurn: turn({
        id: ASSISTANT_TURN, role: 'ASSISTANT', source_turn_id: USER_TURN,
        session_id: '77777777-7777-4777-8777-777777777777',
      }),
    }],
  ])('fails closed when %s', async (_label, invalid) => {
    const provider = new RoleScriptedProvider(DEFAULT_SCRIPT);
    const { repo, readBatchSnapshot, commitFinalizedExchange } = repository();
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));

    await expect(service.establish(USER, invalid as OrchestratedTurnResult))
      .rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(provider.requests).toHaveLength(0);
    expect(commitFinalizedExchange).not.toHaveBeenCalled();
    expect(readBatchSnapshot).not.toHaveBeenCalled();
    // Both durable turns stay exactly as the orchestrator left them.
    expect(invalid.userTurn.status).toBe('COMPLETED');
    expect(invalid.assistantTurn?.status).toBe('COMPLETED');
  });

  it('still establishes the genuine finalized pair unchanged', async () => {
    const provider = new RoleScriptedProvider(DEFAULT_SCRIPT);
    const { repo, commitFinalizedExchange } = repository();
    const service = new ConversationTemporalEstablishmentService(repo, () => binding(provider));

    const result = await service.establish(USER, exchange);

    expect(commitFinalizedExchange).toHaveBeenCalledTimes(1);
    const committed = commitFinalizedExchange.mock.calls[0][0] as CommitFinalizedExchangeRequest;
    expect(committed.userSourceTurnId).toBe(USER_TURN);
    expect(committed.assistantSourceTurnId).toBe(ASSISTANT_TURN);
    expect(result.temporal?.committedEvents.map((event) => event.firstSp)).toEqual([1, 3]);
  });

  it('creates the provider lazily: constructing the service performs no provider work', async () => {
    const factory = jest.fn(() => binding(new RoleScriptedProvider(DEFAULT_SCRIPT)));
    const { repo } = repository();
    const service = new ConversationTemporalEstablishmentService(repo, factory);
    expect(factory).not.toHaveBeenCalled();

    await service.establish(USER, { userTurn } as OrchestratedTurnResult);
    expect(factory).not.toHaveBeenCalled();

    await service.establish(USER, exchange);
    expect(factory).toHaveBeenCalledTimes(1);
    await service.establish(USER, exchange);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('holds no conversation-lifecycle authority at all', () => {
    const source = Object.getOwnPropertyNames(ConversationTemporalEstablishmentService.prototype)
      .map((name) => String((ConversationTemporalEstablishmentService.prototype as unknown as Record<string, unknown>)[name]))
      .join('\n');
    for (const forbidden of ['failTurn', 'fail_conversation_turn', 'finalizeTurn', 'claimTurn', 'router', 'generate(']) {
      expect(source).not.toContain(forbidden);
    }
  });
});
