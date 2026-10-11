import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryDataApiService } from './memory-data-api.service';
import { MemoryRepository } from './memory.repository';

describe('MemoryRepository', () => {
  let dataApi: jest.Mocked<MemoryDataApiService>;
  let repository: MemoryRepository;

  beforeEach(() => {
    dataApi = { request: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<MemoryDataApiService>;
    repository = new MemoryRepository(dataApi);
  });

  it('scopes authenticated reads to the owner', async () => {
    await repository.find('token-a', 'user-a', 'memory-a');
    for (const [, path] of dataApi.request.mock.calls) {
      const query = new URL(`https://local/${path}`).searchParams;
      expect(query.get('id')).toBe('eq.memory-a');
      expect(query.get('user_id')).toBe('eq.user-a');
    }
  });

  it('returns only ACTIVE and unexpired rows from active queries', async () => {
    const now = new Date('2026-08-17T12:00:00.000Z');
    await repository.listActiveForUser('token-a', 'user-a', 32, now);
    const query = new URL(`https://local/${dataApi.request.mock.calls[0][1]}`).searchParams;
    expect(query.get('user_id')).toBe('eq.user-a');
    expect(query.get('status')).toBe('eq.ACTIVE');
    expect(query.get('or')).toBe('(expires_at.is.null,expires_at.gt.2026-08-17T12:00:00.000Z)');
    expect(query.get('limit')).toBe('32');
  });

  it('MEM-AR-01C: embeds the attribution and resolves the subject of every row, fail-safe to UNATTRIBUTED', async () => {
    dataApi.request.mockResolvedValue([
      { id: 'a', memory_subject_attributions: { subject: 'SELF' } },
      { id: 'b', memory_subject_attributions: [{ subject: 'OTHER' }] },
      { id: 'c', memory_subject_attributions: null },
      { id: 'd', memory_subject_attributions: [] },
      { id: 'e', memory_subject_attributions: { subject: 'self' } },
    ]);
    const rows = await repository.listActiveForUser('token-a', 'user-a', 32);
    expect(new URL(`https://local/${dataApi.request.mock.calls[0][1]}`).searchParams.get('select')).toMatch(/,memory_subject_attributions\(subject\)$/u);
    expect(rows.map(({ id, subject }) => [id, subject])).toEqual([['a', 'SELF'], ['b', 'OTHER'], ['c', null], ['d', null], ['e', null]]);
    expect(rows.every((row) => !('memory_subject_attributions' in row))).toBe(true);
  });

  it('MEM-AR-01C: retains no Memory write at all - no server command, no authenticated mutation, no generic update', () => {
    const source = readFileSync(join(__dirname, 'memory.repository.ts'), 'utf8');
    expect(source).not.toMatch(/rpc/u);
    expect(source).not.toMatch(/method:\s*'(?:POST|PATCH|PUT|DELETE)'/u);
    for (const writer of ['create', 'markDeleted', 'supersede', 'update']) expect(MemoryRepository.prototype).not.toHaveProperty(writer);
  });
});
