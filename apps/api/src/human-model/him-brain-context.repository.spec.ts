import { readFileSync } from 'node:fs';
import { HimBrainContextRepository } from './him-brain-context.repository';

// QHIA-012 foreground transport contract. The single architectural requirement
// of this boundary is that ONE turn's Brain Context costs EXACTLY ONE external
// Data API / PostgREST request against the one narrow migration-0061 RPC -
// never a per-slot fan-out, never "read the previous turn, then the effect,
// then the bindings", and never a metric reread.
const USER = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';
const TURN = '00000000-0000-4000-8000-000000000003';

describe('HimBrainContextRepository', () => {
  it('reads Brain Context through EXACTLY ONE Data API request with the exact RPC path and body', async () => {
    const rows = [{ slot_order: 1, slot: 'DECISION_SELF_CONFIDENCE' }];
    const dataApi = { request: jest.fn().mockResolvedValue(rows) };
    const repository = new HimBrainContextRepository(dataApi as never);
    const returned = await repository.readBrainContextForTurn('token', USER, SESSION, TURN);
    expect(dataApi.request).toHaveBeenCalledTimes(1);
    expect(dataApi.request).toHaveBeenCalledWith('token', 'rpc/read_him_brain_context_for_turn_v1', {
      method: 'POST',
      body: JSON.stringify({ p_user_id: USER, p_session_id: SESSION, p_current_turn_id: TURN }),
    });
    expect(returned).toBe(rows);
  });

  it('sends no context kind, context id, metric, slot, registry, or previous-turn selector: the callable surface cannot be aimed', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([]) };
    const repository = new HimBrainContextRepository(dataApi as never);
    await repository.readBrainContextForTurn('token', USER, SESSION, TURN);
    const body = JSON.parse(dataApi.request.mock.calls[0][2].body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['p_current_turn_id', 'p_session_id', 'p_user_id']);
    for (const forbidden of [
      'p_context_kind', 'p_context_id', 'p_metric_key', 'p_metric_keys', 'p_definition_versions',
      'p_slot', 'p_slots', 'p_brain_slot', 'p_previous_turn_id', 'p_source_turn_id', 'p_execution_id', 'p_registry',
    ]) expect(body).not.toHaveProperty(forbidden);
    const serialized = JSON.stringify(body);
    for (const forbidden of ['DECISION', 'SITUATION', 'GOAL', 'hse.', 'hbs.', 'hgs.', 'hrs.']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('normalizes a missing payload to an empty array without issuing a second request', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue(undefined) };
    const repository = new HimBrainContextRepository(dataApi as never);
    await expect(repository.readBrainContextForTurn('token', USER, SESSION, TURN)).resolves.toEqual([]);
    expect(dataApi.request).toHaveBeenCalledTimes(1);
  });

  it('propagates a transport failure after exactly one attempt: no retry and no second round trip', async () => {
    const dataApi = { request: jest.fn().mockRejectedValue(new Error('transport failure')) };
    const repository = new HimBrainContextRepository(dataApi as never);
    await expect(repository.readBrainContextForTurn('token', USER, SESSION, TURN)).rejects.toThrow('transport failure');
    expect(dataApi.request).toHaveBeenCalledTimes(1);
  });

  it('routes only through the one narrow RPC path - no direct table route and no query surface exists', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([]) };
    const repository = new HimBrainContextRepository(dataApi as never);
    await repository.readBrainContextForTurn('token', USER, SESSION, TURN);
    const path = dataApi.request.mock.calls[0][1] as string;
    expect(path).toBe('rpc/read_him_brain_context_for_turn_v1');
    expect(path.startsWith('rpc/')).toBe(true);
    expect(path).not.toContain('?');
    expect(path).not.toContain('conversation_turns');
    expect(path).not.toContain('post_response_intelligence_effects');
    expect(path).not.toContain('him_session_context_bindings');
    expect(path).not.toContain('him_metric_snapshots');
  });

  it('depends on exactly one Data API collaborator and exposes exactly the one read method', () => {
    // No binding repository, no HIM repository, no post-response repository: the
    // rejected multi-round-trip application path is structurally impossible on
    // this boundary, not merely unused.
    expect(HimBrainContextRepository.length).toBe(1);
    const methods = Object.getOwnPropertyNames(HimBrainContextRepository.prototype).filter((name) => name !== 'constructor');
    expect(methods).toEqual(['readBrainContextForTurn']);
  });

  it('contains exactly one Data API call site and references no other repository or RPC in its source', () => {
    const source = readFileSync(`${__dirname}/him-brain-context.repository.ts`, 'utf8');
    expect([...source.matchAll(/this\.dataApi\.request/gu)]).toHaveLength(1);
    expect(source).toContain("'rpc/read_him_brain_context_for_turn_v1'");
    const executable = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    expect([...executable.matchAll(/rpc\//gu)]).toHaveLength(1);
    for (const forbidden of [
      'rpc/read_him_session_context_bindings_v1',
      'rpc/read_him_contextual_current_intelligence_batch_v1',
      'rpc/read_him_latest_measurement_v1',
      'rpc/read_him_latest_measurement_core_v1',
      'rpc/background_read_him_brain_context_source_v1',
      'rpc/read_him_session_cross_context_foreground_v3',
      'HimSessionContextBindingRepository',
      'HimRepository',
      'HimCrossContextForegroundRepository',
      'PostResponseIntelligenceRepository',
      'him_session_context_bindings',
      'him_metric_snapshots',
      'post_response_intelligence_effects',
    ]) expect(executable).not.toContain(forbidden);
  });
});
