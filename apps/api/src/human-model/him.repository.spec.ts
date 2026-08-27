import { HimRepository } from './him.repository';

describe('HimRepository canonical latest read',()=>{
  // QHIM-005 / QHIM-007 remediation contract: canonical latest is one
  // definition-exact, context-authorized database read. The repository never
  // chooses between a structured view and raw snapshot history, never orders
  // by snapshot_version across events, and never falls back to raw
  // him_metric_snapshots for an unsupported metric/context pair - the
  // canonical RPC is the single read authority for every pair.
  it('reads canonical latest through exactly one definition-exact RPC call',async()=>{
    const row={id:'snapshot-id',metric_key:'hse.energy'};
    const dataApi={request:jest.fn().mockResolvedValue([row])};
    const repository=new HimRepository(dataApi as never);
    const latest=await repository.getLatest('token','user','hse.energy',1,'CONVERSATION_SESSION','00000000-0000-4000-8000-000000000010');
    expect(dataApi.request).toHaveBeenCalledTimes(1);
    expect(dataApi.request).toHaveBeenCalledWith('token','rpc/read_him_latest_measurement_v1',{method:'POST',body:JSON.stringify({p_user_id:'user',p_metric_key:'hse.energy',p_definition_version:1,p_context_kind:'CONVERSATION_SESSION',p_context_id:'00000000-0000-4000-8000-000000000010'})});
    expect(latest).toBe(row);
  });
  it('forwards the exact requested definition version with no implicit default',async()=>{
    const dataApi={request:jest.fn().mockResolvedValue([])};
    const repository=new HimRepository(dataApi as never);
    await repository.getLatest('token','user','hbs.avoidance',3,'GOAL','00000000-0000-4000-8000-000000000011');
    expect(JSON.parse(dataApi.request.mock.calls[0][2].body)).toEqual({p_user_id:'user',p_metric_key:'hbs.avoidance',p_definition_version:3,p_context_kind:'GOAL',p_context_id:'00000000-0000-4000-8000-000000000011'});
  });
  it('returns no measurement cleanly when the RPC returns no row',async()=>{
    const dataApi={request:jest.fn().mockResolvedValue([])};
    const repository=new HimRepository(dataApi as never);
    await expect(repository.getLatest('token','user','hse.energy',1,'CONVERSATION_SESSION','00000000-0000-4000-8000-000000000012')).resolves.toBeUndefined();
    const empty={request:jest.fn().mockResolvedValue(undefined)};
    const emptyRepository=new HimRepository(empty as never);
    await expect(emptyRepository.getLatest('token','user','hse.energy',1,'CONVERSATION_SESSION','00000000-0000-4000-8000-000000000012')).resolves.toBeUndefined();
  });
  it('never queries raw snapshot history or the structured view directly for canonical latest',async()=>{
    const dataApi={request:jest.fn().mockResolvedValue([])};
    const repository=new HimRepository(dataApi as never);
    // A formerly structured-routed pair, a formerly raw-fallback pair, and the
    // exact QHIM-007 legacy pair all take the identical canonical RPC path:
    // eligibility is decided by the exact persisted definition inside the
    // database, never by a repository route expression, and no unsupported
    // pair can reach preserved raw legacy history through canonical latest.
    await repository.getLatest('token','user','hse.energy',1,'CONVERSATION_SESSION','00000000-0000-4000-8000-000000000013');
    await repository.getLatest('token','user','hse.energy',1,'SITUATION','legacy-situation');
    await repository.getLatest('token','user','hbs.avoidance',1,'CONVERSATION_SESSION','00000000-0000-4000-8000-000000000014');
    await repository.getLatest('token','user','hrs.relationship-trust',1,'SITUATION','situation');
    await repository.getLatest('token','user','hgs.purpose-alignment',1,'SITUATION','situation');
    for(const call of dataApi.request.mock.calls){
      expect(call[1]).toBe('rpc/read_him_latest_measurement_v1');
      expect(call[1]).not.toMatch(/him_metric_snapshots|him_current_structured_measurements|snapshot_version/);
    }
    expect(dataApi.request).toHaveBeenCalledTimes(5);
  });
  it('keeps explicit history and context listing as distinct raw audit reads',async()=>{
    // history() and listForContext() are explicit history/audit surfaces and
    // deliberately stay on raw him_metric_snapshots under their existing
    // authority - they are not canonical current reads.
    const dataApi={request:jest.fn().mockResolvedValue([])};
    const repository=new HimRepository(dataApi as never);
    await repository.history('token','user','hse.energy','SITUATION','legacy-situation');
    expect(dataApi.request.mock.calls[0][1]).toMatch(/^him_metric_snapshots\?/);
    expect(dataApi.request.mock.calls[0][1]).toContain('snapshot_version.asc');
    await repository.listForContext('token','user','SITUATION','legacy-situation');
    expect(dataApi.request.mock.calls[1][1]).toMatch(/^him_metric_snapshots\?/);
  });
  it('assembles an Intelligence Snapshot with exactly one RPC call',async()=>{const dataApi={request:jest.fn().mockResolvedValue([])};const repository=new HimRepository(dataApi as never);await repository.readIntelligenceSnapshot('token',{contextKind:'SITUATION',contextId:'00000000-0000-4000-8000-000000000010'});expect(dataApi.request).toHaveBeenCalledTimes(1);expect(dataApi.request).toHaveBeenCalledWith('token','rpc/read_him_intelligence_snapshot_v1',{method:'POST',body:JSON.stringify({p_context_kind:'SITUATION',p_context_id:'00000000-0000-4000-8000-000000000010'})});});
});
