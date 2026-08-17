import {
  MAX_MEMORY_CONTEXT_CHARACTERS, MAX_SELECTED_MEMORIES, MEMORY_CANDIDATE_LIMIT,
  MemoryRetrieverService, selectMemories,
} from './memory-retriever.service';
import { MemoryRuntimeService } from './memory-runtime.service';
import type { MemoryRecord } from './memory.types';

const memory = (id: string, content: string, overrides: Partial<MemoryRecord> = {}): MemoryRecord => ({
  id, user_id: 'user-a', scope: 'USER', type: 'PERSONAL_FACT', content, source: 'USER_STATED',
  confidence: 0.5, importance: 0.5, status: 'ACTIVE', version: 1,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  expires_at: null, supersedes_memory_id: null, ...overrides,
});

describe('MemoryRetrieverService', () => {
  let runtime: jest.Mocked<MemoryRuntimeService>;
  let retriever: MemoryRetrieverService;

  beforeEach(() => {
    runtime = { listActiveForUser: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<MemoryRuntimeService>;
    retriever = new MemoryRetrieverService(runtime);
  });

  it.each(['hello', 'thanks', 'تمام', 'What is the capital of Egypt?'])('skips non-personal turn %s without a query', async (content) => {
    await expect(retriever.retrieve('user-a', 'token-a', content)).resolves.toEqual([]);
    expect(runtime.listActiveForUser).not.toHaveBeenCalled();
  });

  it.each(['what did I tell you about my job?', 'فاكر موضوع الشغل؟', 'قلتلك قبل كده عن احمد'])('attempts bounded authenticated retrieval for %s', async (content) => {
    await retriever.retrieve('user-a', 'token-a', content);
    expect(runtime.listActiveForUser).toHaveBeenCalledWith('user-a', 'token-a', MEMORY_CANDIDATE_LIMIT);
  });

  it('uses generic explicit recall for arbitrary names without treating names alone as policy signals', async () => {
    expect(retriever.shouldRetrieve('يوسف')).toBe(false);
    await retriever.retrieve('user-a', 'token-a', 'فاكر موضوع يوسف؟');
    expect(runtime.listActiveForUser).toHaveBeenCalledWith('user-a', 'token-a', MEMORY_CANDIDATE_LIMIT);
  });

  it('returns no fabricated memory when an explicit recall has no relevant lexical match', async () => {
    runtime.listActiveForUser.mockResolvedValue([memory('1', 'I prefer tea')]);
    await expect(retriever.retrieve('user-a', 'token-a', 'remember my job?')).resolves.toEqual([]);
  });

  it('ranks deterministically with relevance primary and importance, confidence, then recency as bounded signals', () => {
    const candidates = [
      memory('irrelevant', 'My divorce hearing is tomorrow', { importance: 1, confidence: 1 }),
      memory('low', 'My job is in design', { importance: 0.2, confidence: 0.2 }),
      memory('important', 'My job goal is management', { importance: 0.9, confidence: 0.2 }),
      memory('confident-old', 'My job preference is remote', { importance: 0.5, confidence: 0.9 }),
      memory('confident-new', 'My job plan is remote', { importance: 0.5, confidence: 0.9, updated_at: '2026-02-01T00:00:00.000Z' }),
    ];
    const first = selectMemories('remember my job', candidates);
    expect(first).toEqual(selectMemories('remember my job', [...candidates].reverse()));
    expect(first.map(({ content }) => content)).not.toContain('My divorce hearing is tomorrow');
    expect(first[0].content).toBe('My job goal is management');
  });

  it('supports conservative Arabic normalization and lexical relevance', () => {
    expect(selectMemories('فاكر شُغلي؟', [memory('1', 'شغلي في التصميم'), memory('2', 'بحب الشاي')]))
      .toEqual([{ type: 'PERSONAL_FACT', content: 'شغلي في التصميم', source: 'USER_STATED' }]);
  });

  it('deduplicates and enforces top-K and total character budget without truncation', () => {
    const candidates = [memory('dup-old', 'job remote'), memory('dup-new', ' JOB   REMOTE ', { updated_at: '2026-02-01T00:00:00.000Z' })];
    expect(selectMemories('job remote', candidates)).toHaveLength(1);
    expect(selectMemories('job', Array.from({ length: 8 }, (_, index) => memory(String(index), `job item ${index}`))))
      .toHaveLength(MAX_SELECTED_MEMORIES);
    const oversized = memory('large', `job ${'x'.repeat(MAX_MEMORY_CONTEXT_CHARACTERS)}`);
    expect(selectMemories('job', [oversized, memory('fits', 'job fits')])).toEqual([
      { type: 'PERSONAL_FACT', content: 'job fits', source: 'USER_STATED' },
    ]);
  });
});
