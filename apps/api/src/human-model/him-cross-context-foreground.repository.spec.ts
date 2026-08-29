import { readFileSync } from 'node:fs';
import { HimCrossContextForegroundRepository } from './him-cross-context-foreground.repository';

// QHIA-009 transport contract, upgraded to the QHIA-011 aggregate-v3 endpoint.
// The single architectural requirement of this boundary is that ONE turn's
// cross-context foreground enrichment costs EXACTLY ONE external Data API /
// PostgREST request against the one narrow migration-0060 aggregate-v3 RPC -
// never the four independent QHIA-007, QHIA-008, QHIA-010 and QHIA-011 requests
// it replaces, never "v3 plus a direct Relationship read", never "v2 then
// Relationship", never v2 or v1 as a fallback, and never a retry.
const USER = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';

describe('HimCrossContextForegroundRepository', () => {
  it('reads all four cross-context foreground channels through EXACTLY ONE Data API request with the exact RPC path and body', async () => {
    const rows = [
      { foreground_slot_order: 1, foreground_slot: 'SITUATION_STRESS', binding_state: 'NO_ACTIVE_SITUATION' },
      { foreground_slot_order: 2, foreground_slot: 'DECISION_ATTENTION', binding_state: 'NO_ACTIVE_DECISION' },
      { foreground_slot_order: 3, foreground_slot: 'GOAL_MOTIVATION', binding_state: 'NO_ACTIVE_GOAL' },
      { foreground_slot_order: 4, foreground_slot: 'RELATIONSHIP_COMMUNICATION', binding_state: 'NO_ACTIVE_RELATIONSHIP' },
    ];
    const dataApi = { request: jest.fn().mockResolvedValue(rows) };
    const repository = new HimCrossContextForegroundRepository(dataApi as never);
    const returned = await repository.readSessionCrossContextForeground('token', USER, SESSION);
    expect(dataApi.request).toHaveBeenCalledTimes(1);
    expect(dataApi.request).toHaveBeenCalledWith('token', 'rpc/read_him_session_cross_context_foreground_v3', {
      method: 'POST',
      body: JSON.stringify({ p_user_id: USER, p_session_id: SESSION }),
    });
    expect(returned).toBe(rows);
  });

  it('sends no context kind, context id, target, metric key, metric list, or slot list: the callable surface cannot be aimed', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([]) };
    const repository = new HimCrossContextForegroundRepository(dataApi as never);
    await repository.readSessionCrossContextForeground('token', USER, SESSION);
    const body = JSON.parse(dataApi.request.mock.calls[0][2].body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['p_session_id', 'p_user_id']);
    for (const forbidden of [
      'p_context_kind', 'p_context_id', 'p_metric_key', 'p_metric_keys', 'p_definition_versions', 'p_target_id',
      'p_slot', 'p_slots', 'p_foreground_slots',
    ]) expect(body).not.toHaveProperty(forbidden);
    const serialized = JSON.stringify(body);
    for (const forbidden of [
      'SITUATION', 'DECISION', 'GOAL', 'RELATIONSHIP',
      'hse.stress', 'hse.attention', 'hse.motivation', 'hrs.communication',
      'SITUATION_STRESS', 'DECISION_ATTENTION', 'GOAL_MOTIVATION', 'RELATIONSHIP_COMMUNICATION',
    ]) expect(serialized).not.toContain(forbidden);
  });

  it('normalizes a missing payload to an empty array without issuing a second request', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue(undefined) };
    const repository = new HimCrossContextForegroundRepository(dataApi as never);
    await expect(repository.readSessionCrossContextForeground('token', USER, SESSION)).resolves.toEqual([]);
    expect(dataApi.request).toHaveBeenCalledTimes(1);
  });

  it('propagates a transport failure after exactly one attempt: no retry, no second round trip, no aggregate-v1/v2 or direct 007/008/010/011 fallback', async () => {
    const dataApi = { request: jest.fn().mockRejectedValue(new Error('transport failure')) };
    const repository = new HimCrossContextForegroundRepository(dataApi as never);
    await expect(repository.readSessionCrossContextForeground('token', USER, SESSION)).rejects.toThrow('transport failure');
    expect(dataApi.request).toHaveBeenCalledTimes(1);
  });

  it('routes only through the one narrow RPC path - no direct table route and no query surface exists', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([]) };
    const repository = new HimCrossContextForegroundRepository(dataApi as never);
    await repository.readSessionCrossContextForeground('token', USER, SESSION);
    const path = dataApi.request.mock.calls[0][1] as string;
    expect(path).toBe('rpc/read_him_session_cross_context_foreground_v3');
    expect(path.startsWith('rpc/')).toBe(true);
    expect(path).not.toContain('?');
    expect(path).not.toContain('him_session_context_bindings');
    expect(path).not.toContain('him_metric_snapshots');
  });

  it('depends on exactly one Data API collaborator and exposes exactly the one read method', () => {
    // No HimSituationStressRepository, HimDecisionAttentionRepository,
    // HimGoalMotivationRepository, HimRelationshipCommunicationRepository,
    // HimSessionContextBindingRepository, or HimRepository dependency: a second
    // foreground request - fallback, backup, or racing - is structurally
    // impossible on this boundary, not merely unused.
    expect(HimCrossContextForegroundRepository.length).toBe(1);
    const methods = Object.getOwnPropertyNames(HimCrossContextForegroundRepository.prototype).filter((name) => name !== 'constructor');
    expect(methods).toEqual(['readSessionCrossContextForeground']);
  });

  it('contains exactly one Data API call site and references no other repository or RPC in its source', () => {
    const source = readFileSync(`${__dirname}/him-cross-context-foreground.repository.ts`, 'utf8');
    // Structural proof rather than a call census: a second external request
    // cannot be added to this file without failing here.
    expect([...source.matchAll(/this\.dataApi\.request/gu)]).toHaveLength(1);
    expect(source).toContain("'rpc/read_him_session_cross_context_foreground_v3'");
    // The negatives run on EXECUTABLE source only: the file's own prose may
    // legitimately name the replaced request shapes while documenting their
    // absence, exactly as the database contracts do.
    const executable = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    expect([...executable.matchAll(/rpc\//gu)]).toHaveLength(1);
    for (const forbidden of [
      'rpc/read_him_session_cross_context_foreground_v1',
      'rpc/read_him_session_cross_context_foreground_v2',
      'rpc/read_him_session_situation_stress_v1',
      'rpc/read_him_session_decision_attention_v1',
      'rpc/read_him_session_goal_motivation_v1',
      'rpc/read_him_session_relationship_communication_v1',
      'rpc/read_him_session_context_bindings_v1',
      'rpc/read_him_contextual_current_intelligence_batch_v1',
      'rpc/read_him_latest_measurement_v1',
      'HimSituationStressRepository',
      'HimDecisionAttentionRepository',
      'HimGoalMotivationRepository',
      'HimRelationshipCommunicationRepository',
      'HimSessionContextBindingRepository',
      'HimRepository',
      'him_session_context_bindings',
    ]) expect(executable).not.toContain(forbidden);
  });
});
