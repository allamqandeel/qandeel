import { MemoryRuntimeService } from './memory-runtime.service';
import { MEMORY_WRITE_DUPLICATE_LOOKUP_LIMIT, MemoryWriteEvaluatorService } from './memory-write-evaluator.service';
import { MemoryWriteService } from './memory-write.service';
import type { MemoryRecord } from './memory.types';
import { projectEligibleEvidence } from './evidence.service';

describe('MemoryWriteService', () => {
  let runtime: jest.Mocked<MemoryRuntimeService>;
  let writer: MemoryWriteService;

  beforeEach(() => {
    runtime = {
      listActiveForUser: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(record({ id: 'persisted-memory-id' })),
    } as unknown as jest.Mocked<MemoryRuntimeService>;
    writer = new MemoryWriteService(new MemoryWriteEvaluatorService(), runtime);
  });

  it('uses a bounded owner-scoped ACTIVE lookup before exactly one write', async () => {
    await expect(writer.evaluateAndWrite('user-a', 'token-a', 'I prefer short answers.')).resolves.toEqual({
      decision: 'WRITE', type: 'STABLE_PREFERENCE',
      memoryId: 'persisted-memory-id', evidenceId: 'memory:persisted-memory-id',
    });
    expect(runtime.listActiveForUser).toHaveBeenCalledWith('user-a', 'token-a', MEMORY_WRITE_DUPLICATE_LOOKUP_LIMIT);
    expect(runtime.create).toHaveBeenCalledTimes(1);
    // The token scopes the duplicate lookup only; the write carries no credential.
    expect(runtime.create).toHaveBeenCalledWith('user-a', expect.objectContaining({
      type: 'STABLE_PREFERENCE', source: 'USER_STATED', status: 'ACTIVE',
    }));
  });

  it('skips an exact normalized duplicate of the same type', async () => {
    runtime.listActiveForUser.mockResolvedValue([record({ content: 'I PREFER  short answers' })]);
    const result = await writer.evaluateAndWrite('user-a', 'token-a', 'I prefer short answers.');
    expect(result).toMatchObject({
      decision: 'SKIP', reason: 'EXACT_NORMALIZED_DUPLICATE', type: 'STABLE_PREFERENCE',
    });
    expect(runtime.create).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('memoryId');
    expect(result).not.toHaveProperty('evidenceId');
  });

  it('does not let another user suppress the authenticated user write', async () => {
    runtime.listActiveForUser.mockImplementation(async (userId) => userId === 'user-b' ? [record({ user_id: 'user-b' })] : []);
    await writer.evaluateAndWrite('user-a', 'token-a', 'I prefer short answers.');
    expect(runtime.create).toHaveBeenCalledWith('user-a', expect.anything());
  });

  it('never calls persistence for obvious credentials', async () => {
    const result = await writer.evaluateAndWrite('user-a', 'token-a', 'Remember my password is ABC123');
    expect(result).toEqual({
      decision: 'SKIP', reason: 'SENSITIVE_DATA',
    });
    expect(runtime.listActiveForUser).not.toHaveBeenCalled();
    expect(runtime.create).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('memoryId');
    expect(result).not.toHaveProperty('evidenceId');
  });

  it('uses the same mechanical Evidence ID format as canonical projection without an Evidence query', async () => {
    const created = record({ id: 'canonical-id' });
    runtime.create.mockResolvedValue(created);
    const result = await writer.evaluateAndWrite('user-a', 'token-a', 'I prefer short answers.');
    expect(result).toMatchObject({ memoryId: created.id, evidenceId: 'memory:canonical-id' });
    expect(projectEligibleEvidence('user-a', [created])[0].evidenceId).toBe('memory:canonical-id');
    expect(runtime.listActiveForUser).toHaveBeenCalledTimes(1);
  });
});

function record(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: 'memory', user_id: 'user-a', scope: 'USER', type: 'STABLE_PREFERENCE', content: 'I prefer short answers.',
    source: 'USER_STATED', confidence: 0.95, importance: 0.75, status: 'ACTIVE', version: 1,
    created_at: '2026-08-17T00:00:00.000Z', updated_at: '2026-08-17T00:00:00.000Z', expires_at: null,
    supersedes_memory_id: null, ...overrides,
  };
}
