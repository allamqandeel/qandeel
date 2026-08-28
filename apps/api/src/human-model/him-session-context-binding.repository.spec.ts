import { HimSessionContextBindingRepository } from './him-session-context-binding.repository';

// QHIA-006 transport contract: every repository method is exactly ONE Data
// API request against exactly one of the three narrow migration-0055 RPC
// paths, with the exact expected body. No per-kind loop, no direct table
// route, and no measurement-repository dependency exists on this boundary.
const USER = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';
const TARGET = '00000000-0000-4000-8000-000000000003';

describe('HimSessionContextBindingRepository', () => {
  it('sets a binding through exactly one Data API request with the exact RPC path and body', async () => {
    const row = { id: 'row-id', context_kind: 'GOAL' };
    const dataApi = { request: jest.fn().mockResolvedValue([row]) };
    const repository = new HimSessionContextBindingRepository(dataApi as never);
    const returned = await repository.setBinding('token', USER, SESSION, 'GOAL', TARGET);
    expect(dataApi.request).toHaveBeenCalledTimes(1);
    expect(dataApi.request).toHaveBeenCalledWith('token', 'rpc/set_him_session_context_binding_v1', {
      method: 'POST',
      body: JSON.stringify({ p_user_id: USER, p_session_id: SESSION, p_context_kind: 'GOAL', p_context_id: TARGET }),
    });
    expect(returned).toBe(row);
  });

  it('clears a binding through exactly one Data API request and reports idempotent already-clear as undefined', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([]) };
    const repository = new HimSessionContextBindingRepository(dataApi as never);
    const returned = await repository.clearBinding('token', USER, SESSION, 'DECISION');
    expect(dataApi.request).toHaveBeenCalledTimes(1);
    expect(dataApi.request).toHaveBeenCalledWith('token', 'rpc/clear_him_session_context_binding_v1', {
      method: 'POST',
      body: JSON.stringify({ p_user_id: USER, p_session_id: SESSION, p_context_kind: 'DECISION' }),
    });
    expect(returned).toBeUndefined();
  });

  it('returns the exact retired row a successful clear yields', async () => {
    const row = { id: 'retired-id', status: 'RETIRED' };
    const dataApi = { request: jest.fn().mockResolvedValue([row]) };
    const repository = new HimSessionContextBindingRepository(dataApi as never);
    await expect(repository.clearBinding('token', USER, SESSION, 'RELATIONSHIP')).resolves.toBe(row);
  });

  it('reads ALL active kinds through exactly one Data API request - never one request per kind', async () => {
    const rows = [{ context_kind: 'GOAL' }, { context_kind: 'SITUATION' }, { context_kind: 'DECISION' }, { context_kind: 'RELATIONSHIP' }];
    const dataApi = { request: jest.fn().mockResolvedValue(rows) };
    const repository = new HimSessionContextBindingRepository(dataApi as never);
    const returned = await repository.readActiveBindings('token', USER, SESSION);
    expect(dataApi.request).toHaveBeenCalledTimes(1);
    expect(dataApi.request).toHaveBeenCalledWith('token', 'rpc/read_him_session_context_bindings_v1', {
      method: 'POST',
      body: JSON.stringify({ p_user_id: USER, p_session_id: SESSION }),
    });
    expect(returned).toBe(rows);
  });

  it('normalizes a missing read payload to an empty array without a second request', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue(undefined) };
    const repository = new HimSessionContextBindingRepository(dataApi as never);
    await expect(repository.readActiveBindings('token', USER, SESSION)).resolves.toEqual([]);
    expect(dataApi.request).toHaveBeenCalledTimes(1);
  });

  it('routes every method through the three narrow RPC paths only - no direct table route exists', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([]) };
    const repository = new HimSessionContextBindingRepository(dataApi as never);
    await repository.setBinding('token', USER, SESSION, 'SITUATION', TARGET);
    await repository.clearBinding('token', USER, SESSION, 'SITUATION');
    await repository.readActiveBindings('token', USER, SESSION);
    const paths = dataApi.request.mock.calls.map((call) => call[1] as string);
    expect(paths).toEqual([
      'rpc/set_him_session_context_binding_v1',
      'rpc/clear_him_session_context_binding_v1',
      'rpc/read_him_session_context_bindings_v1',
    ]);
    for (const path of paths) {
      expect(path.startsWith('rpc/')).toBe(true);
      expect(path).not.toContain('him_session_context_bindings?');
      expect(path).not.toContain('?');
    }
  });

  it('depends on exactly one Data API collaborator and exposes exactly the three binding methods', () => {
    // No HimRepository (or any measurement repository) dependency: the
    // constructor takes the Data API service alone, and the surface is
    // exactly set/clear/read.
    expect(HimSessionContextBindingRepository.length).toBe(1);
    const methods = Object.getOwnPropertyNames(HimSessionContextBindingRepository.prototype).filter((name) => name !== 'constructor');
    expect(methods.sort()).toEqual(['clearBinding', 'readActiveBindings', 'setBinding']);
  });
});
