import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import { HypothesisServiceRoleApiService } from './hypothesis-service-role-api.service';
import { HypothesisRepository } from './hypothesis.repository';
import type { CreateHypothesisInput } from './hypothesis.types';

describe('HypothesisRepository', () => {
  const input: CreateHypothesisInput = {
    statement: 'Time pressure contributes to indecision.', type: 'CAUSAL', domain: 'DECISION',
    scope: 'Current work decision', origin: 'SYSTEM_GENERATED',
    assumptions: ['The deadline remains relevant.'], disconfirmingConditions: ['Indecision persists without a deadline.'],
  };
  let dataApi: jest.Mocked<MemoryDataApiService>;
  let serverAuthority: jest.Mocked<HypothesisServiceRoleApiService>;
  let repository: HypothesisRepository;

  beforeEach(() => {
    dataApi = { request: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<MemoryDataApiService>;
    serverAuthority = { rpc: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<HypothesisServiceRoleApiService>;
    repository = new HypothesisRepository(dataApi, serverAuthority);
  });

  it('creates through the narrow server command instead of a direct table write', async () => {
    serverAuthority.rpc.mockResolvedValue([{ id: 'hypothesis-a' }]);
    await repository.create('hypothesis-a', 'user-a', input);
    const [name, body] = serverAuthority.rpc.mock.calls[0];
    expect(name).toBe('server_create_hypothesis_v1');
    expect(body).toEqual({
      p_user_id: 'user-a', p_hypothesis_id: 'hypothesis-a', p_statement: input.statement,
      p_type: 'CAUSAL', p_domain: 'DECISION', p_scope: 'Current work decision', p_origin: 'SYSTEM_GENERATED',
      p_assumptions: input.assumptions, p_disconfirming_conditions: input.disconfirmingConditions,
    });
    // Server-owned authority columns are derived in the database, never submitted here.
    for (const forbidden of [
      'p_status', 'p_version', 'p_supporting_evidence_ids', 'p_contradicting_evidence_ids',
      'p_competing_hypothesis_ids', 'p_created_at', 'p_updated_at',
    ]) expect(body).not.toHaveProperty(forbidden);
    // No caller credential reaches the privileged channel.
    expect(JSON.stringify(body)).not.toMatch(/token/iu);
    expect(dataApi.request).not.toHaveBeenCalled();
  });

  it('defaults absent structured metadata to empty lists without inventing content', async () => {
    serverAuthority.rpc.mockResolvedValue([{ id: 'hypothesis-a' }]);
    await repository.create('hypothesis-a', 'user-a', { ...input, assumptions: undefined, disconfirmingConditions: undefined });
    const [, body] = serverAuthority.rpc.mock.calls[0];
    expect(body).toMatchObject({ p_assumptions: [], p_disconfirming_conditions: [] });
  });

  it('scopes authenticated reads to the owner', async () => {
    await repository.find('token-a', 'user-a', 'hypothesis-a');
    const found = new URL(`https://local/${dataApi.request.mock.calls[0][1]}`).searchParams;
    expect(found.get('id')).toBe('eq.hypothesis-a');
    expect(found.get('user_id')).toBe('eq.user-a');
    await repository.listActive('token-a', 'user-a', 32);
    const listed = new URL(`https://local/${dataApi.request.mock.calls[1][1]}`).searchParams;
    expect(listed.get('user_id')).toBe('eq.user-a');
    expect(listed.get('status')).toBe('in.(CANDIDATE,ACTIVE,SUPPORTED,MIXED,WEAK,REOPENED)');
    expect(listed.get('limit')).toBe('32');
  });

  it('leaves the existing constrained mutation commands on the caller identity', async () => {
    await repository.transition('token-a', 'hypothesis-a', 'ACTIVE');
    await repository.attachEvidence('token-a', 'hypothesis-a', 'memory:22222222-2222-4222-8222-222222222222', 'SUPPORTING');
    await repository.linkCompetitor('token-a', 'hypothesis-a', 'hypothesis-b');
    expect(dataApi.request.mock.calls.map(([, path]) => path)).toEqual([
      'rpc/transition_hypothesis', 'rpc/attach_hypothesis_evidence', 'rpc/link_competing_hypotheses',
    ]);
    expect(serverAuthority.rpc).not.toHaveBeenCalled();
  });

  it('retains no direct authenticated Hypothesis table write and no generic update path', () => {
    const source = readFileSync(join(__dirname, 'hypothesis.repository.ts'), 'utf8');
    // No direct table POST/PATCH/PUT/DELETE survives on the user-token channel.
    expect(source).not.toMatch(/dataApi\.request<[^>]*>\(token, 'hypotheses'/u);
    expect(source).not.toMatch(/dataApi\.request[\s\S]{0,200}?'hypotheses'[\s\S]{0,200}?method:\s*'(?:POST|PATCH|PUT|DELETE)'/u);
    // No broad "update arbitrary columns" method exists.
    expect(HypothesisRepository.prototype).not.toHaveProperty('update');
  });
});
