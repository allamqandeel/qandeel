import { HimRepository } from './him.repository';

describe('HimRepository current reads',()=>{
  it('uses the supersession-aware view only for conversation-scoped Energy',async()=>{
    const dataApi={request:jest.fn().mockResolvedValue([])};
    const repository=new HimRepository(dataApi as never);
    await repository.getLatest('token','user','hse.energy','CONVERSATION_SESSION','session');
    expect(dataApi.request.mock.calls[0][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hse.motivation','GOAL','00000000-0000-4000-8000-000000000010');
    expect(dataApi.request.mock.calls[1][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hse.attention','DECISION','00000000-0000-4000-8000-000000000011');
    expect(dataApi.request.mock.calls[2][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hse.self-confidence','SITUATION','00000000-0000-4000-8000-000000000012');
    expect(dataApi.request.mock.calls[3][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hse.stress','CONVERSATION_SESSION','00000000-0000-4000-8000-000000000013');
    expect(dataApi.request.mock.calls[4][1]).toMatch(/^him_current_structured_measurements\?/);
    // HBS Avoidance is the sixth calibrated structured metric: its GOAL and
    // SITUATION reads route through the supersession-aware current view so an
    // explicit correction can never surface a stale superseded value.
    await repository.getLatest('token','user','hbs.avoidance','GOAL','00000000-0000-4000-8000-000000000014');
    expect(dataApi.request.mock.calls[5][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hbs.avoidance','SITUATION','00000000-0000-4000-8000-000000000015');
    expect(dataApi.request.mock.calls[6][1]).toMatch(/^him_current_structured_measurements\?/);
    // Unsupported Avoidance contexts and uncalibrated metrics stay on the
    // raw snapshot-history path.
    await repository.getLatest('token','user','hbs.avoidance','CONVERSATION_SESSION','00000000-0000-4000-8000-000000000016');
    expect(dataApi.request.mock.calls[7][1]).toMatch(/^him_metric_snapshots\?/);
    await repository.getLatest('token','user','hbs.consistency','SITUATION','situation');
    expect(dataApi.request.mock.calls[8][1]).toMatch(/^him_metric_snapshots\?/);
  });
  it('assembles an Intelligence Snapshot with exactly one RPC call',async()=>{const dataApi={request:jest.fn().mockResolvedValue([])};const repository=new HimRepository(dataApi as never);await repository.readIntelligenceSnapshot('token',{contextKind:'SITUATION',contextId:'00000000-0000-4000-8000-000000000010'});expect(dataApi.request).toHaveBeenCalledTimes(1);expect(dataApi.request).toHaveBeenCalledWith('token','rpc/read_him_intelligence_snapshot_v1',{method:'POST',body:JSON.stringify({p_context_kind:'SITUATION',p_context_id:'00000000-0000-4000-8000-000000000010'})});});
});

