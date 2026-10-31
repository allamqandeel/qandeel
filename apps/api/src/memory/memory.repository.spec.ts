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
    // RE-ANCHORED by S8B-03 (CP1, E5): the typed confirmations are embedded after the attribution.
    expect(new URL(`https://local/${dataApi.request.mock.calls[0][1]}`).searchParams.get('select')).toMatch(/,memory_subject_attributions\(subject\),memory_typed_confirmations\(memory_id\)$/u);
    expect(rows.map(({ id, subject }) => [id, subject])).toEqual([['a', 'SELF'], ['b', 'OTHER'], ['c', null], ['d', null], ['e', null]]);
    expect(rows.every((row) => !('memory_subject_attributions' in row))).toBe(true);
  });

  it('S8B-03 (E5): only a MACHINE_ASR Memory reports a typed confirmation; a typed Memory is read exactly as before', async () => {
    dataApi.request.mockResolvedValue([
      { id: 'a', source: 'MACHINE_ASR', memory_subject_attributions: null, memory_typed_confirmations: [{ memory_id: 'a' }] },
      { id: 'b', source: 'MACHINE_ASR', memory_subject_attributions: null, memory_typed_confirmations: [] },
      { id: 'c', source: 'USER_STATED', memory_subject_attributions: null, memory_typed_confirmations: [] },
    ]);
    const rows = await repository.listActiveForUser('token-a', 'user-a', 32);
    expect(rows.map((row) => row.confirmed_by_typing)).toEqual([true, false, undefined]);
    expect(rows.every((row) => !('memory_typed_confirmations' in row))).toBe(true);
    expect('confirmed_by_typing' in rows[2]).toBe(false);
  });

  it('MEM-AR-01C: retains no Memory write at all - no server command, no authenticated mutation, no generic update', () => {
    const source = readFileSync(join(__dirname, 'memory.repository.ts'), 'utf8');
    expect(source).not.toMatch(/rpc/u);
    expect(source).not.toMatch(/method:\s*'(?:POST|PATCH|PUT|DELETE)'/u);
    for (const writer of ['create', 'markDeleted', 'supersede', 'update']) expect(MemoryRepository.prototype).not.toHaveProperty(writer);
  });
});
