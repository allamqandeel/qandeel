import { readFileSync } from 'node:fs';
import { HimSituationStressRepository } from './him-situation-stress.repository';

// QHIA-007 transport contract. The single architectural requirement of this
// boundary is that ONE QHIA-007 foreground read costs EXACTLY ONE external
// Data API / PostgREST request against the one narrow migration-0056
// composition RPC - never the rejected two-round-trip shape
// (read the QHIA-006 binding, await, then read the QHIA-004 metric, await).
const USER = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';

describe('HimSituationStressRepository', () => {
  it('reads Situation-bound stress through EXACTLY ONE Data API request with the exact RPC path and body', async () => {
    const rows = [{ binding_state: 'NO_ACTIVE_SITUATION' }];
    const dataApi = { request: jest.fn().mockResolvedValue(rows) };
    const repository = new HimSituationStressRepository(dataApi as never);
    const returned = await repository.readSessionSituationStress('token', USER, SESSION);
    expect(dataApi.request).toHaveBeenCalledTimes(1);
    expect(dataApi.request).toHaveBeenCalledWith('token', 'rpc/read_him_session_situation_stress_v1', {
      method: 'POST',
      body: JSON.stringify({ p_user_id: USER, p_session_id: SESSION }),
    });
    expect(returned).toBe(rows);
  });

  it('sends no context kind, context id, metric key, metric list, or target: the callable surface cannot be aimed', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([]) };
    const repository = new HimSituationStressRepository(dataApi as never);
    await repository.readSessionSituationStress('token', USER, SESSION);
    const body = JSON.parse(dataApi.request.mock.calls[0][2].body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['p_session_id', 'p_user_id']);
    for (const forbidden of ['p_context_kind', 'p_context_id', 'p_metric_key', 'p_metric_keys', 'p_definition_versions', 'p_target_id']) {
      expect(body).not.toHaveProperty(forbidden);
    }
    expect(JSON.stringify(body)).not.toContain('SITUATION');
    expect(JSON.stringify(body)).not.toContain('hse.stress');
  });

  it('normalizes a missing payload to an empty array without issuing a second request', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue(undefined) };
    const repository = new HimSituationStressRepository(dataApi as never);
    await expect(repository.readSessionSituationStress('token', USER, SESSION)).resolves.toEqual([]);
    expect(dataApi.request).toHaveBeenCalledTimes(1);
  });

  it('propagates a transport failure after exactly one attempt: no retry and no second round trip', async () => {
    const dataApi = { request: jest.fn().mockRejectedValue(new Error('transport failure')) };
    const repository = new HimSituationStressRepository(dataApi as never);
    await expect(repository.readSessionSituationStress('token', USER, SESSION)).rejects.toThrow('transport failure');
    expect(dataApi.request).toHaveBeenCalledTimes(1);
  });

  it('routes only through the one narrow RPC path - no direct table route and no query surface exists', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([]) };
    const repository = new HimSituationStressRepository(dataApi as never);
    await repository.readSessionSituationStress('token', USER, SESSION);
    const path = dataApi.request.mock.calls[0][1] as string;
    expect(path).toBe('rpc/read_him_session_situation_stress_v1');
    expect(path.startsWith('rpc/')).toBe(true);
    expect(path).not.toContain('?');
    expect(path).not.toContain('him_session_context_bindings');
    expect(path).not.toContain('him_metric_snapshots');
  });

  it('depends on exactly one Data API collaborator and exposes exactly the one read method', () => {
    // No HimSessionContextBindingRepository and no HimRepository dependency:
    // the forbidden serial "binding read then metric read" application path
    // is structurally impossible on this boundary, not merely unused.
    expect(HimSituationStressRepository.length).toBe(1);
    const methods = Object.getOwnPropertyNames(HimSituationStressRepository.prototype).filter((name) => name !== 'constructor');
    expect(methods).toEqual(['readSessionSituationStress']);
  });

  it('contains exactly one Data API call site and references no other repository or RPC in its source', () => {
    const source = readFileSync(`${__dirname}/him-situation-stress.repository.ts`, 'utf8');
    // Structural proof rather than a call census: a second external request
    // cannot be added to this file without failing here.
    expect([...source.matchAll(/this\.dataApi\.request/gu)]).toHaveLength(1);
    expect([...source.matchAll(/rpc\//gu)]).toHaveLength(1);
    expect(source).toContain("'rpc/read_him_session_situation_stress_v1'");
    for (const forbidden of [
      'rpc/read_him_session_context_bindings_v1',
      'rpc/read_him_contextual_current_intelligence_batch_v1',
      'rpc/read_him_latest_measurement_v1',
      'HimSessionContextBindingRepository',
      'HimRepository',
    ]) expect(source).not.toContain(forbidden);
  });
});
