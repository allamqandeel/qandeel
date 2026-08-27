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
    // HBS Consistency and Initiative are the seventh and eighth calibrated
    // structured metrics: their GOAL and SITUATION reads also route through
    // the supersession-aware current view, each fully independently.
    await repository.getLatest('token','user','hbs.consistency','GOAL','00000000-0000-4000-8000-000000000017');
    expect(dataApi.request.mock.calls[7][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hbs.consistency','SITUATION','00000000-0000-4000-8000-000000000018');
    expect(dataApi.request.mock.calls[8][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hbs.initiative','GOAL','00000000-0000-4000-8000-000000000019');
    expect(dataApi.request.mock.calls[9][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hbs.initiative','SITUATION','00000000-0000-4000-8000-000000000020');
    expect(dataApi.request.mock.calls[10][1]).toMatch(/^him_current_structured_measurements\?/);
    // Unsupported HBS contexts and uncalibrated metrics stay on the raw
    // snapshot-history path.
    await repository.getLatest('token','user','hbs.avoidance','CONVERSATION_SESSION','00000000-0000-4000-8000-000000000016');
    expect(dataApi.request.mock.calls[11][1]).toMatch(/^him_metric_snapshots\?/);
    await repository.getLatest('token','user','hbs.consistency','CONVERSATION_SESSION','00000000-0000-4000-8000-000000000021');
    expect(dataApi.request.mock.calls[12][1]).toMatch(/^him_metric_snapshots\?/);
    await repository.getLatest('token','user','hbs.initiative','CONVERSATION_SESSION','00000000-0000-4000-8000-000000000022');
    expect(dataApi.request.mock.calls[13][1]).toMatch(/^him_metric_snapshots\?/);
    // HBS Reflection is the ninth calibrated structured metric: its exact
    // context-bound SITUATION and CONVERSATION_SESSION reads route through
    // the supersession-aware current view, while its unsupported contexts
    // and every HRS metric stay on the raw snapshot-history path.
    await repository.getLatest('token','user','hbs.reflection','SITUATION','situation');
    expect(dataApi.request.mock.calls[14][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hbs.reflection','CONVERSATION_SESSION','00000000-0000-4000-8000-000000000023');
    expect(dataApi.request.mock.calls[15][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hbs.reflection','GOAL','00000000-0000-4000-8000-000000000024');
    expect(dataApi.request.mock.calls[16][1]).toMatch(/^him_metric_snapshots\?/);
    // HGS Self-Awareness is the fourteenth calibrated structured metric
    // (activated by 0046): its exact target-bound GOAL and SITUATION reads
    // route through the supersession-aware current view.
    await repository.getLatest('token','user','hgs.self-awareness','SITUATION','situation');
    expect(dataApi.request.mock.calls[17][1]).toMatch(/^him_current_structured_measurements\?/);
    // HRS Relationship Trust is the tenth calibrated structured metric: its
    // exact RELATIONSHIP-bound read routes through the supersession-aware
    // current view, while its unsupported contexts and every other HRS
    // metric stay on the raw snapshot-history path.
    await repository.getLatest('token','user','hrs.relationship-trust','RELATIONSHIP','00000000-0000-4000-8000-000000000025');
    expect(dataApi.request.mock.calls[18][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hrs.relationship-trust','SITUATION','situation');
    expect(dataApi.request.mock.calls[19][1]).toMatch(/^him_metric_snapshots\?/);
    // HRS Communication and Repair are the eleventh and twelfth calibrated
    // structured metrics: each exact RELATIONSHIP-bound read routes through
    // the supersession-aware current view fully independently, while their
    // unsupported contexts stay on the raw snapshot-history path.
    await repository.getLatest('token','user','hrs.communication','RELATIONSHIP','00000000-0000-4000-8000-000000000026');
    expect(dataApi.request.mock.calls[20][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hrs.repair','RELATIONSHIP','00000000-0000-4000-8000-000000000027');
    expect(dataApi.request.mock.calls[21][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hrs.communication','SITUATION','situation');
    expect(dataApi.request.mock.calls[22][1]).toMatch(/^him_metric_snapshots\?/);
    await repository.getLatest('token','user','hrs.repair','GOAL','00000000-0000-4000-8000-000000000028');
    expect(dataApi.request.mock.calls[23][1]).toMatch(/^him_metric_snapshots\?/);
    // HRS Emotional Safety is the thirteenth calibrated structured metric
    // and completes the HRS family: its exact RELATIONSHIP-bound read routes
    // through the supersession-aware current view, while its unsupported
    // contexts and every uncalibrated HGS metric stay on the raw
    // snapshot-history path.
    await repository.getLatest('token','user','hrs.emotional-safety','RELATIONSHIP','00000000-0000-4000-8000-000000000029');
    expect(dataApi.request.mock.calls[24][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hrs.emotional-safety','SITUATION','situation');
    expect(dataApi.request.mock.calls[25][1]).toMatch(/^him_metric_snapshots\?/);
    await repository.getLatest('token','user','hrs.emotional-safety','GOAL','00000000-0000-4000-8000-000000000030');
    expect(dataApi.request.mock.calls[26][1]).toMatch(/^him_metric_snapshots\?/);
    // HGS Self-Awareness GOAL reads route through the current view exactly
    // like SITUATION reads, while its unsupported contexts stay on the raw
    // snapshot-history path.
    await repository.getLatest('token','user','hgs.self-awareness','GOAL','00000000-0000-4000-8000-000000000031');
    expect(dataApi.request.mock.calls[27][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hgs.self-awareness','CONVERSATION_SESSION','00000000-0000-4000-8000-000000000032');
    expect(dataApi.request.mock.calls[28][1]).toMatch(/^him_metric_snapshots\?/);
    // HGS Resilience is the fifteenth calibrated structured metric
    // (activated by 0047): its exact target-bound GOAL and SITUATION reads
    // route through the supersession-aware current view fully independently
    // of Self-Awareness, while its unsupported contexts and the two
    // remaining uncalibrated HGS metrics stay on the raw
    // snapshot-history path - no other HGS metric is routed.
    await repository.getLatest('token','user','hgs.resilience','SITUATION','situation');
    expect(dataApi.request.mock.calls[29][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hgs.resilience','GOAL','00000000-0000-4000-8000-000000000035');
    expect(dataApi.request.mock.calls[30][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hgs.resilience','CONVERSATION_SESSION','00000000-0000-4000-8000-000000000036');
    expect(dataApi.request.mock.calls[31][1]).toMatch(/^him_metric_snapshots\?/);
    await repository.getLatest('token','user','hgs.purpose-alignment','GOAL','00000000-0000-4000-8000-000000000033');
    expect(dataApi.request.mock.calls[32][1]).toMatch(/^him_metric_snapshots\?/);
    await repository.getLatest('token','user','hgs.habit-strength','GOAL','00000000-0000-4000-8000-000000000034');
    expect(dataApi.request.mock.calls[33][1]).toMatch(/^him_metric_snapshots\?/);
  });
  it('assembles an Intelligence Snapshot with exactly one RPC call',async()=>{const dataApi={request:jest.fn().mockResolvedValue([])};const repository=new HimRepository(dataApi as never);await repository.readIntelligenceSnapshot('token',{contextKind:'SITUATION',contextId:'00000000-0000-4000-8000-000000000010'});expect(dataApi.request).toHaveBeenCalledTimes(1);expect(dataApi.request).toHaveBeenCalledWith('token','rpc/read_him_intelligence_snapshot_v1',{method:'POST',body:JSON.stringify({p_context_kind:'SITUATION',p_context_id:'00000000-0000-4000-8000-000000000010'})});});
});

