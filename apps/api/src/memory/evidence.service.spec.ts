import { EVIDENCE_CANDIDATE_LIMIT, EvidenceService, MAX_ELIGIBLE_EVIDENCE, projectEligibleEvidence } from './evidence.service';
import { MemoryRuntimeService } from './memory-runtime.service';
import type { MemoryRecord, MemorySource, MemoryStatus, MemoryType } from './memory.types';

const NOW = new Date('2026-08-17T12:00:00.000Z');

function memory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: '00000000-0000-4000-8000-000000000001', user_id: 'user-1', scope: 'USER',
    type: 'PERSONAL_FACT', content: 'I live in Cairo.', source: 'USER_STATED',
    confidence: 0.95, importance: 0.65, status: 'ACTIVE', version: 1,
    created_at: '2026-08-10T10:00:00.000Z', updated_at: '2026-08-16T10:00:00.000Z',
    expires_at: null, supersedes_memory_id: null, ...overrides,
  };
}

describe('EvidenceService', () => {
  it.each<[MemoryType, string]>([
    ['PERSONAL_FACT', 'USER_STATED_FACT'],
    ['STABLE_PREFERENCE', 'USER_STATED_PREFERENCE'],
    ['GOAL', 'USER_STATED_GOAL'],
    ['DECISION_COMMITMENT', 'USER_STATED_COMMITMENT'],
    ['RELATIONSHIP_CONTEXT', 'USER_STATED_RELATIONSHIP_CONTEXT'],
    ['INTERACTION_PREFERENCE', 'USER_STATED_INTERACTION_PREFERENCE'],
    ['TEMPORARY_STATE', 'USER_STATED_TEMPORARY_STATE'],
  ])('projects eligible %s mechanically as %s', (type, evidenceKind) => {
    const item = projectEligibleEvidence('user-1', [memory({ type, expires_at: type === 'TEMPORARY_STATE' ? '2026-08-18T12:00:00.000Z' : null })], NOW)[0];
    expect(item).toEqual(expect.objectContaining({ evidenceKind, memoryType: type }));
  });

  it.each<[MemoryStatus]>([['DELETED'], ['SUPERSEDED'], ['EXPIRED'], ['DISABLED'], ['PENDING_CONFIRMATION']])(
    'excludes %s memory', (status) => expect(projectEligibleEvidence('user-1', [memory({ status })], NOW)).toEqual([]),
  );

  it.each<[MemorySource]>([['SYSTEM_DERIVED'], ['IMPORTED'], ['ADMIN_CONTROLLED']])(
    'excludes non-authoritative %s provenance', (source) => expect(projectEligibleEvidence('user-1', [memory({ source })], NOW)).toEqual([]),
  );

  it('excludes derived insight and expired temporary state', () => {
    expect(projectEligibleEvidence('user-1', [
      memory({ type: 'DERIVED_INSIGHT' }),
      memory({ id: 'expired', type: 'TEMPORARY_STATE', expires_at: NOW.toISOString() }),
    ], NOW)).toEqual([]);
  });

  it('preserves content, provenance, confidence, importance, and timestamps without a truth score', () => {
    const item = projectEligibleEvidence('user-1', [memory({ source: 'USER_CONFIRMED' })], NOW)[0];
    expect(item).toEqual({
      evidenceId: 'memory:00000000-0000-4000-8000-000000000001',
      evidenceKind: 'USER_STATED_FACT', memoryType: 'PERSONAL_FACT', statement: 'I live in Cairo.',
      source: 'USER_CONFIRMED', confidence: 0.95, importance: 0.65,
      observedAt: '2026-08-10T10:00:00.000Z', updatedAt: '2026-08-16T10:00:00.000Z',
      originatingMemoryId: '00000000-0000-4000-8000-000000000001',
    });
    expect(item).not.toHaveProperty('truthProbability');
    expect(item).not.toHaveProperty('evidenceStrength');
  });

  it('enforces ownership even if an upstream boundary returns a cross-user row', () => {
    expect(projectEligibleEvidence('user-1', [memory({ user_id: 'user-2' })], NOW)).toEqual([]);
  });

  it('uses stable identity and deterministic updated-descending, id-ascending ordering', () => {
    const items = projectEligibleEvidence('user-1', [
      memory({ id: 'b', content: 'B', updated_at: '2026-08-16T11:00:00.000Z' }),
      memory({ id: 'c', content: 'C', updated_at: '2026-08-16T12:00:00.000Z' }),
      memory({ id: 'a', content: 'A', updated_at: '2026-08-16T11:00:00.000Z' }),
    ], NOW);
    expect(items.map((item) => item.originatingMemoryId)).toEqual(['c', 'a', 'b']);
    expect(projectEligibleEvidence('user-1', [memory()], NOW)[0].evidenceId)
      .toBe(projectEligibleEvidence('user-1', [memory()], NOW)[0].evidenceId);
  });

  it('deduplicates only exact normalized type/source/content and keeps semantic conflicts', () => {
    const items = projectEligibleEvidence('user-1', [
      memory({ id: 'new', content: 'I prefer remote work.', updated_at: '2026-08-17T10:00:00.000Z' }),
      memory({ id: 'duplicate', content: ' I prefer remote work.  ', updated_at: '2026-08-16T10:00:00.000Z' }),
      memory({ id: 'conflict', content: 'I prefer office work.', updated_at: '2026-08-15T10:00:00.000Z' }),
    ], NOW);
    expect(items.map((item) => item.statement)).toEqual(['I prefer remote work.', 'I prefer office work.']);
  });

  it('queries Memory Runtime with authenticated identity and the centralized bound', async () => {
    const runtime = { listActiveForUser: jest.fn().mockResolvedValue(
      Array.from({ length: 70 }, (_, index) => memory({ id: String(index), content: String(index) })),
    ) } as unknown as jest.Mocked<MemoryRuntimeService>;
    const service = new EvidenceService(runtime);
    const result = await service.listEligibleForUser('user-1', 'access-token', NOW);
    expect(runtime.listActiveForUser).toHaveBeenCalledWith('user-1', 'access-token', EVIDENCE_CANDIDATE_LIMIT);
    expect(result).toHaveLength(MAX_ELIGIBLE_EVIDENCE);
  });

  it('is a clean future-consumer contract with no transcript, provider, model, Safety, or embedding structures', () => {
    const item = projectEligibleEvidence('user-1', [memory()], NOW)[0] as unknown as Record<string, unknown>;
    for (const forbidden of ['transcript', 'conversation', 'provider', 'model', 'safety', 'embedding']) {
      expect(item).not.toHaveProperty(forbidden);
    }
  });
});
