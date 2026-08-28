import { HimSessionContextBindingService } from './him-session-context-binding.service';
import type { HimCrossContextKind, HimSessionContextBindingSourceRow } from './him-session-context-binding.types';

// QHIA-006 projection/integrity contract: the service transports the explicit
// authenticated binding authority and validates every database row
// fail-closed. It never sorts, deduplicates, or repairs malformed output into
// correctness, never accepts free text, and never invents a binding.
const USER = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';
const TARGETS: Record<HimCrossContextKind, string> = {
  GOAL: '00000000-0000-4000-8000-00000000000a',
  SITUATION: '00000000-0000-4000-8000-00000000000b',
  DECISION: '00000000-0000-4000-8000-00000000000c',
  RELATIONSHIP: '00000000-0000-4000-8000-00000000000d',
};
const BINDING_IDS: Record<HimCrossContextKind, string> = {
  GOAL: '00000000-0000-4000-8000-000000000010',
  SITUATION: '00000000-0000-4000-8000-000000000011',
  DECISION: '00000000-0000-4000-8000-000000000012',
  RELATIONSHIP: '00000000-0000-4000-8000-000000000013',
};
const activeRow = (kind: HimCrossContextKind, over: Partial<HimSessionContextBindingSourceRow> = {}): HimSessionContextBindingSourceRow => ({
  id: BINDING_IDS[kind],
  user_id: USER,
  conversation_session_id: SESSION,
  context_kind: kind,
  context_id: TARGETS[kind],
  binding_version: 1,
  status: 'ACTIVE',
  binding_source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING',
  created_at: '2026-08-28T00:00:00.000000+00:00',
  retired_at: null,
  canonical_provenance: 'QANDEEL_HIM_SESSION_CONTEXT_BINDING_V1',
  ...over,
});
const retiredRow = (kind: HimCrossContextKind, over: Partial<HimSessionContextBindingSourceRow> = {}): HimSessionContextBindingSourceRow =>
  activeRow(kind, { status: 'RETIRED', retired_at: '2026-08-28T00:00:01.000000+00:00', ...over });

type RepositoryDouble = {
  setBinding: jest.Mock;
  clearBinding: jest.Mock;
  readActiveBindings: jest.Mock;
};
const repositoryDouble = (): RepositoryDouble => ({
  setBinding: jest.fn(),
  clearBinding: jest.fn(),
  readActiveBindings: jest.fn(),
});
const service = (repository: RepositoryDouble) => new HimSessionContextBindingService(repository as never);

describe('HimSessionContextBindingService.readActiveBindings', () => {
  it('projects zero bindings as a valid empty result - absent relevance stays absent', async () => {
    const repository = repositoryDouble();
    repository.readActiveBindings.mockResolvedValue([]);
    const result = await service(repository).readActiveBindings(USER, 'token', SESSION);
    expect(result).toEqual({
      contractVersion: 1,
      source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING',
      sessionId: SESSION,
      bindingCount: 0,
      bindings: [],
    });
    expect(repository.readActiveBindings).toHaveBeenCalledTimes(1);
    expect(repository.readActiveBindings).toHaveBeenCalledWith('token', USER, SESSION);
  });

  it('projects one ACTIVE binding with exact identity facts only', async () => {
    const repository = repositoryDouble();
    repository.readActiveBindings.mockResolvedValue([activeRow('SITUATION', { binding_version: 3 })]);
    const result = await service(repository).readActiveBindings(USER, 'token', SESSION);
    expect(result.bindingCount).toBe(1);
    expect(result.bindings).toEqual([
      { bindingId: BINDING_IDS.SITUATION, bindingVersion: 3, contextKind: 'SITUATION', contextId: TARGETS.SITUATION },
    ]);
  });

  it('projects all four kinds in the exact canonical order GOAL, SITUATION, DECISION, RELATIONSHIP', async () => {
    const repository = repositoryDouble();
    repository.readActiveBindings.mockResolvedValue([
      activeRow('GOAL'), activeRow('SITUATION'), activeRow('DECISION'), activeRow('RELATIONSHIP'),
    ]);
    const result = await service(repository).readActiveBindings(USER, 'token', SESSION);
    expect(result.bindingCount).toBe(4);
    expect(result.bindings.map((binding) => binding.contextKind)).toEqual(['GOAL', 'SITUATION', 'DECISION', 'RELATIONSHIP']);
    expect(result.bindings.map((binding) => binding.contextId)).toEqual([
      TARGETS.GOAL, TARGETS.SITUATION, TARGETS.DECISION, TARGETS.RELATIONSHIP,
    ]);
  });

  it.each<[string, HimSessionContextBindingSourceRow[]]>([
    ['a duplicate kind', [activeRow('GOAL'), activeRow('GOAL', { id: BINDING_IDS.SITUATION, context_id: TARGETS.SITUATION })]],
    ['reordered rows - the DB read must arrive canonical, never be re-sorted here', [activeRow('SITUATION'), activeRow('GOAL')]],
    ['more than four rows', [
      activeRow('GOAL'), activeRow('SITUATION'), activeRow('DECISION'), activeRow('RELATIONSHIP'),
      activeRow('GOAL', { id: '00000000-0000-4000-8000-000000000099' }),
    ]],
    ['a cross-user row', [activeRow('GOAL', { user_id: '00000000-0000-4000-8000-0000000000ff' })]],
    ['a cross-session row', [activeRow('GOAL', { conversation_session_id: '00000000-0000-4000-8000-0000000000fe' })]],
    ['a non-cross-context kind', [activeRow('GOAL', { context_kind: 'CONVERSATION_SESSION' })]],
    ['a GLOBAL kind', [activeRow('GOAL', { context_kind: 'GLOBAL' })]],
    ['a malformed context id', [activeRow('GOAL', { context_id: 'improve my fitness' })]],
    ['a malformed binding id', [activeRow('GOAL', { id: 'not-a-uuid' })]],
    ['a zero binding version', [activeRow('GOAL', { binding_version: 0 })]],
    ['a fractional binding version', [activeRow('GOAL', { binding_version: 1.5 })]],
    ['an unsafe binding version', [activeRow('GOAL', { binding_version: Number.MAX_SAFE_INTEGER + 2 })]],
    ['a RETIRED row on the active-read path', [retiredRow('GOAL')]],
    ['a wrong binding source', [activeRow('GOAL', { binding_source: 'INFERRED_RELEVANCE' })]],
    ['a wrong canonical provenance', [activeRow('GOAL', { canonical_provenance: 'SOMETHING_ELSE_V9' })]],
    ['an ACTIVE row carrying a retirement time', [activeRow('GOAL', { retired_at: '2026-08-28T00:00:02.000000+00:00' })]],
    ['a missing created_at', [activeRow('GOAL', { created_at: '' })]],
    ['a null row', [null as unknown as HimSessionContextBindingSourceRow]],
  ])('fails closed with INTEGRITY_FAILURE on %s', async (_label, rows) => {
    const repository = repositoryDouble();
    repository.readActiveBindings.mockResolvedValue(rows);
    await expect(service(repository).readActiveBindings(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
  });

  it('rejects malformed request identities before any Data API request exists', async () => {
    const repository = repositoryDouble();
    await expect(service(repository).readActiveBindings('not-a-uuid', 'token', SESSION)).rejects.toThrow('INVALID_SESSION_CONTEXT_BINDING_REQUEST');
    await expect(service(repository).readActiveBindings(USER, 'token', 'GLOBAL')).rejects.toThrow('INVALID_SESSION_CONTEXT_BINDING_REQUEST');
    expect(repository.readActiveBindings).not.toHaveBeenCalled();
  });
});

describe('HimSessionContextBindingService.setBinding', () => {
  it.each<[HimCrossContextKind]>([['GOAL'], ['SITUATION'], ['DECISION'], ['RELATIONSHIP']])(
    'accepts a valid exact %s binding and returns the validated ACTIVE result',
    async (kind) => {
      const repository = repositoryDouble();
      repository.setBinding.mockResolvedValue(activeRow(kind));
      const result = await service(repository).setBinding(USER, 'token', SESSION, kind, TARGETS[kind]);
      expect(result).toEqual({
        contractVersion: 1,
        source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING',
        sessionId: SESSION,
        binding: { bindingId: BINDING_IDS[kind], bindingVersion: 1, contextKind: kind, contextId: TARGETS[kind] },
      });
      expect(repository.setBinding).toHaveBeenCalledTimes(1);
      expect(repository.setBinding).toHaveBeenCalledWith('token', USER, SESSION, kind, TARGETS[kind]);
    },
  );

  it.each<[string, HimSessionContextBindingSourceRow | undefined]>([
    ['a RETIRED returned row', retiredRow('GOAL')],
    ['a returned row for a different target', activeRow('GOAL', { context_id: TARGETS.SITUATION })],
    ['a returned row of a different kind', activeRow('SITUATION', { context_id: TARGETS.GOAL })],
    ['a returned cross-session row', activeRow('GOAL', { conversation_session_id: '00000000-0000-4000-8000-0000000000fe' })],
    ['a returned cross-user row', activeRow('GOAL', { user_id: '00000000-0000-4000-8000-0000000000ff' })],
    ['a missing returned row', undefined],
  ])('fails closed on %s', async (_label, row) => {
    const repository = repositoryDouble();
    repository.setBinding.mockResolvedValue(row);
    await expect(service(repository).setBinding(USER, 'token', SESSION, 'GOAL', TARGETS.GOAL)).rejects.toThrow('INTEGRITY_FAILURE');
  });

  it('accepts no free-text input: a prose target never reaches the Data API', async () => {
    const repository = repositoryDouble();
    await expect(
      service(repository).setBinding(USER, 'token', SESSION, 'GOAL', 'improve my fitness this year'),
    ).rejects.toThrow('INVALID_SESSION_CONTEXT_BINDING_REQUEST');
    await expect(
      service(repository).setBinding(USER, 'token', SESSION, 'CONVERSATION_SESSION' as HimCrossContextKind, TARGETS.GOAL),
    ).rejects.toThrow('INVALID_SESSION_CONTEXT_BINDING_REQUEST');
    await expect(
      service(repository).setBinding(USER, 'token', SESSION, 'GLOBAL' as HimCrossContextKind, TARGETS.GOAL),
    ).rejects.toThrow('INVALID_SESSION_CONTEXT_BINDING_REQUEST');
    expect(repository.setBinding).not.toHaveBeenCalled();
  });
});

describe('HimSessionContextBindingService.clearBinding', () => {
  it('accepts a validated retired row and reports the exact retired binding', async () => {
    const repository = repositoryDouble();
    repository.clearBinding.mockResolvedValue(retiredRow('DECISION', { binding_version: 2 }));
    const result = await service(repository).clearBinding(USER, 'token', SESSION, 'DECISION');
    expect(result).toEqual({
      contractVersion: 1,
      source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING',
      sessionId: SESSION,
      cleared: true,
      retiredBinding: { bindingId: BINDING_IDS.DECISION, bindingVersion: 2, contextKind: 'DECISION', contextId: TARGETS.DECISION },
    });
    expect(repository.clearBinding).toHaveBeenCalledTimes(1);
    expect(repository.clearBinding).toHaveBeenCalledWith('token', USER, SESSION, 'DECISION');
  });

  it('reports an idempotent already-clear kind as cleared:false with no retired binding', async () => {
    const repository = repositoryDouble();
    repository.clearBinding.mockResolvedValue(undefined);
    const result = await service(repository).clearBinding(USER, 'token', SESSION, 'GOAL');
    expect(result).toEqual({
      contractVersion: 1,
      source: 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING',
      sessionId: SESSION,
      cleared: false,
      retiredBinding: null,
    });
  });

  it.each<[string, HimSessionContextBindingSourceRow]>([
    ['a still-ACTIVE returned row', activeRow('GOAL')],
    ['a retired row without a retirement time', retiredRow('GOAL', { retired_at: null })],
    ['a retired row of a different kind', retiredRow('SITUATION')],
    ['a retired cross-user row', retiredRow('GOAL', { user_id: '00000000-0000-4000-8000-0000000000ff' })],
    ['a retired row with a wrong source constant', retiredRow('GOAL', { binding_source: 'MODEL_SELECTED' })],
  ])('fails closed on %s', async (_label, row) => {
    const repository = repositoryDouble();
    repository.clearBinding.mockResolvedValue(row);
    await expect(service(repository).clearBinding(USER, 'token', SESSION, 'GOAL')).rejects.toThrow('INTEGRITY_FAILURE');
  });
});
