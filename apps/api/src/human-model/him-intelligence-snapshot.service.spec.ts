import { ServiceUnavailableException } from '@nestjs/common';
import { MemoryDataApiError,readMemoryDataApiUpstreamIdentity } from '../memory/memory-data-api.service';
import { HimIntelligenceSnapshotService,HIM_SNAPSHOT_SLOTS,HIM_SNAPSHOT_TRANSIENT_TRANSPORT_STATUSES } from './him-intelligence-snapshot.service';
import type { HimSnapshotSourceRow } from './him-intelligence-snapshot.types';
const context='00000000-0000-4000-8000-000000000010',generated='2026-08-24T00:00:00.000Z';
const active=(metric:string,order:number,kind='SITUATION'):HimSnapshotSourceRow=>({generated_at:generated,slot_order:order,metric_key:metric,definition_version:1,semantic_type:'STATE',context_kind:kind,context_id:context,active_binding_id:`active-${metric}`,active_instrument_id:`instrument-${metric}`,active_instrument_version:1,active_scale_reference:`scale-${metric}`,active_scale_version:1,active_model_id:`model-${metric}`,active_model_version:1,measurement_event_id:null,event_observed_at:null,measurement_observation_id:null,response_code:null,observation_instrument_id:null,observation_instrument_version:null,observation_scale_reference:null,observation_scale_version:null,snapshot_id:null,value_state:null,numeric_value:null,validity_status:null,snapshot_provenance:null,calculation_result_id:null,canonical_binding_id:null,snapshot_scale_reference:null,snapshot_scale_version:null,result_state:null,result_numeric_value:null,result_model_id:null,result_model_version:null,result_provenance:null,result_confidence_state:null,result_confidence_reference:null,source_binding_status:null,source_instrument_id:null,source_instrument_version:null,source_scale_reference:null,source_scale_version:null,source_model_id:null,source_model_version:null});
const assessed=(metric:string,order:number,n=3,kind='SITUATION'):HimSnapshotSourceRow=>{const r=active(metric,order,kind);return{...r,measurement_event_id:`event-${metric}`,event_observed_at:'2026-08-23T00:00:00.000Z',measurement_observation_id:`observation-${metric}`,response_code:['','VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH'][n],observation_instrument_id:r.active_instrument_id,observation_instrument_version:1,observation_scale_reference:r.active_scale_reference,observation_scale_version:1,snapshot_id:`snapshot-${metric}`,value_state:'ASSESSED',numeric_value:n,validity_status:'VALID',snapshot_provenance:'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',calculation_result_id:`result-${metric}`,canonical_binding_id:r.active_binding_id,snapshot_scale_reference:r.active_scale_reference,snapshot_scale_version:1,result_state:'ASSESSED',result_numeric_value:n,result_model_id:r.active_model_id,result_model_version:1,result_provenance:'QANDEEL_HIM_CALCULATION_RUNTIME_V1',result_confidence_state:'UNASSESSED',result_confidence_reference:null,source_binding_status:'ACTIVE',source_instrument_id:r.active_instrument_id,source_instrument_version:1,source_scale_reference:r.active_scale_reference,source_scale_version:1,source_model_id:r.active_model_id,source_model_version:1};};
const situation=()=>[active('hse.stress',1),active('hse.motivation',3),active('hse.self-confidence',4),active('hse.attention',5)];
const setup=(rows:HimSnapshotSourceRow[])=>{const repository={readIntelligenceSnapshot:jest.fn().mockResolvedValue(rows)};return{service:new HimIntelligenceSnapshotService(repository as never),repository};};
describe('HIM Intelligence Snapshot foundation v1',()=>{
 it('freezes exact supported slots and canonical filtered order',()=>{expect(HIM_SNAPSHOT_SLOTS).toEqual({SITUATION:['hse.stress','hse.motivation','hse.self-confidence','hse.attention'],CONVERSATION_SESSION:['hse.stress','hse.energy','hse.attention'],DECISION:['hse.self-confidence','hse.attention'],GOAL:['hse.motivation']});expect(Object.values(HIM_SNAPSHOT_SLOTS).flat()).not.toContain('hbs.avoidance');expect(Object.values(HIM_SNAPSHOT_SLOTS).flat()).not.toContain('hbs.consistency');expect(Object.values(HIM_SNAPSHOT_SLOTS).flat()).not.toContain('hbs.initiative');});
 it.each(['GLOBAL','RELATIONSHIP'] as const)('rejects unsupported %s without a repository read',async kind=>{const{service,repository}=setup([]);await expect(service.getSnapshot('token',kind,context)).rejects.toThrow('UNSUPPORTED_CONTEXT');expect(repository.readIntelligenceSnapshot).not.toHaveBeenCalled();});
 it('uses one RPC-backed repository call with no caller metric selection',async()=>{const{service,repository}=setup(situation());await service.getSnapshot('token','SITUATION',context);expect(repository.readIntelligenceSnapshot).toHaveBeenCalledTimes(1);expect(repository.readIntelligenceSnapshot).toHaveBeenCalledWith('token',{contextKind:'SITUATION',contextId:context});});
 it('returns every no-event slot explicitly and EMPTY coverage',async()=>{const result=await setup(situation()).service.getSnapshot('token','SITUATION',context);expect(result).toMatchObject({snapshotContractVersion:1,coverageState:'EMPTY',eligibleMetricCount:4,assessedMetricCount:0,unassessedMetricCount:4,generatedAt:generated});expect(result.metrics.every(m=>m.valueState==='UNASSESSED'&&m.unassessedReason==='NO_MEASUREMENT_EVENT'&&m.ordinalCategory===null&&m.observedAt===null)).toBe(true);});
 it('keeps latest NOT_SURE unassessed without an older-value fallback',async()=>{const row={...assessed('hse.motivation',3,3,'GOAL'),response_code:'NOT_SURE',value_state:'UNASSESSED',numeric_value:null,result_state:'UNASSESSED',result_numeric_value:null};const result=await setup([row]).service.getSnapshot('token','GOAL',context);expect(result.metrics[0]).toMatchObject({valueState:'UNASSESSED',unassessedReason:'LATEST_EVENT_UNASSESSED',ordinalCategory:null,measurementEventId:'event-hse.motivation'});});
 it('keeps an invalidated latest event unassessed',async()=>{const rows=situation();rows[0]={...assessed('hse.stress',1),validity_status:'INVALIDATED'};expect((await setup(rows).service.getSnapshot('token','SITUATION',context)).metrics[0]).toMatchObject({valueState:'UNASSESSED',unassessedReason:'LATEST_EVENT_INVALIDATED',ordinalCategory:null});});
 it.each([[1,'VERY_LOW'],[2,'LOW'],[3,'MODERATE'],[4,'HIGH'],[5,'VERY_HIGH']] as const)('maps exact ordinal code %s to %s only',async(n,category)=>{const result=await setup([assessed('hse.motivation',3,n,'GOAL')]).service.getSnapshot('token','GOAL',context);expect(result.metrics[0].ordinalCategory).toBe(category);});
 it.each([0,1.5,6,Number.NaN])('fails integrity for malformed ordinal code %s',async n=>{await expect(setup([assessed('hse.motivation',3,n,'GOAL')]).service.getSnapshot('token','GOAL',context)).rejects.toThrow('INTEGRITY_FAILURE');});
 it('returns incompatible active binding as bounded unassessed state',async()=>{const row={...assessed('hse.motivation',3,4,'GOAL'),active_binding_id:'new-binding'};expect((await setup([row]).service.getSnapshot('token','GOAL',context)).metrics[0]).toMatchObject({valueState:'UNASSESSED',unassessedReason:'INCOMPATIBLE_ACTIVE_BINDING',ordinalCategory:null});});
 it('fails closed when expected active binding metadata is absent',async()=>{await expect(setup([{...active('hse.motivation',3,'GOAL'),active_binding_id:null}]).service.getSnapshot('token','GOAL',context)).rejects.toThrow('INTEGRITY_FAILURE');});
 it('preserves the database active-binding integrity failure class',async()=>{const repository={readIntelligenceSnapshot:jest.fn().mockRejectedValue(new Error('HIM Intelligence Snapshot active binding integrity failure'))};await expect(new HimIntelligenceSnapshotService(repository as never).getSnapshot('token','GOAL',context)).rejects.toThrow('INTEGRITY_FAILURE');});
 it('derives FULL and PARTIAL coverage only from frozen slots',async()=>{const full=situation().map((r,i)=>assessed(r.metric_key,r.slot_order,i%5+1));expect((await setup(full).service.getSnapshot('token','SITUATION',context)).coverageState).toBe('FULL');const partial=[assessed('hse.stress',1),...situation().slice(1)];const result=await setup(partial).service.getSnapshot('token','SITUATION',context);expect(result).toMatchObject({coverageState:'PARTIAL',eligibleMetricCount:4,assessedMetricCount:1,unassessedMetricCount:3});});
 it('keeps freshness and confidence unresolved and exposes no arithmetic, score, or trend field',async()=>{const metric=(await setup([assessed('hse.motivation',3,5,'GOAL')]).service.getSnapshot('token','GOAL',context)).metrics[0];expect(metric).toMatchObject({freshnessState:'UNASSESSED',freshnessReference:null,confidenceState:'UNASSESSED',confidenceReference:null});for(const field of['numericValue','average','percentage','score','trendDirection','delta','slope'])expect(field in metric).toBe(false);});
 it('fails integrity for row-set drift or inconsistent database read time',async()=>{await expect(setup(situation().slice(1)).service.getSnapshot('token','SITUATION',context)).rejects.toThrow('INTEGRITY_FAILURE');await expect(setup(situation().map((r,i)=>i?{...r,generated_at:'later'}:r)).service.getSnapshot('token','SITUATION',context)).rejects.toThrow('INTEGRITY_FAILURE');});

 // QHIA-014A: the three-way repository failure classification. Transport
 // unavailability is preserved as a sanitized ServiceUnavailableException so
 // the foreground can OMIT Snapshot-derived Human Intelligence for one turn;
 // every authority, ownership, integrity and unknown failure keeps its exact
 // pre-existing fail-closed identity. The two are never collapsed.
 describe('QHIA-014A transport-unavailable vs fail-closed classification',()=>{
  const rejecting=(error:unknown)=>{const repository={readIntelligenceSnapshot:jest.fn().mockRejectedValue(error)};return{service:new HimIntelligenceSnapshotService(repository as never),repository};};
  const read=(error:unknown)=>rejecting(error).service.getSnapshot('token','GOAL',context);

  it('freezes the exact transient infrastructure status set',()=>{expect([...HIM_SNAPSHOT_TRANSIENT_TRANSPORT_STATUSES].sort((a,b)=>a-b)).toEqual([408,429,502,503,504]);});

  it('preserves an existing ServiceUnavailableException from the Data API transport unchanged',async()=>{
   // The real transport emits exactly these for missing configuration and for a
   // fetch/network failure or AbortSignal transport timeout.
   for(const original of [new ServiceUnavailableException('Memory persistence is not configured.'),new ServiceUnavailableException('Memory persistence is unavailable.')]){
    await expect(read(original)).rejects.toBe(original);
   }
  });

  it.each([408,429,502,503,504])('translates the transient MemoryDataApiError status %s into a sanitized ServiceUnavailableException',async status=>{
   const upstream=new MemoryDataApiError(status,{code:'57014',message:'canceling statement due to statement timeout on him_current_structured_measurements'});
   const rejection=await read(upstream).catch((error:unknown)=>error);
   expect(rejection).toBeInstanceOf(ServiceUnavailableException);
   // Sanitized: the server-authored message carries no upstream database text,
   // no status, no code, and no reference to the original error at all.
   const message=(rejection as ServiceUnavailableException).message;
   expect(message).toBe('Human Intelligence Snapshot is unavailable.');
   for(const leaked of ['57014','canceling statement','statement timeout','him_current_structured_measurements'])expect(JSON.stringify({message,serialized:rejection})).not.toContain(leaked);
   // The opaque QHIA-011A identity still exists on the ORIGINAL error and is
   // still readable only through its own restricted accessor - this service
   // never consulted it, and the sanitized rejection carries none of it.
   expect(readMemoryDataApiUpstreamIdentity(upstream)).toEqual({code:'57014',message:'canceling statement due to statement timeout on him_current_structured_measurements'});
  });

  it.each([400,401,403,404,409,500,418,599])('keeps the non-transient MemoryDataApiError status %s fail-closed and never benign',async status=>{
   const rejection=await read(new MemoryDataApiError(status,{code:'42501',message:'permission denied for table him_measurement_events'})).catch((error:unknown)=>error);
   expect(rejection).not.toBeInstanceOf(ServiceUnavailableException);
   expect(rejection).toBeInstanceOf(Error);
   expect((rejection as Error).message).toBe('INVALID_OR_UNOWNED_CONTEXT');
   for(const leaked of ['42501','permission denied','him_measurement_events'])expect(JSON.stringify({message:(rejection as Error).message,serialized:rejection})).not.toContain(leaked);
  });

  it('keeps an ordinary unexpected repository Error fail-closed',async()=>{await expect(read(new Error('unrecognized upstream failure'))).rejects.toThrow('INVALID_OR_UNOWNED_CONTEXT');});

  it('keeps the explicit database active-binding integrity failure ahead of every transport rule',async()=>{
   await expect(read(new Error('HIM Intelligence Snapshot active binding integrity failure'))).rejects.toThrow('INTEGRITY_FAILURE');
   // Even wearing a transient transport status, an explicit integrity failure
   // is an authority answer and stays fail-closed.
   const integrityStatus=Object.assign(new MemoryDataApiError(503),{message:'HIM Intelligence Snapshot active binding integrity failure'});
   await expect(read(integrityStatus)).rejects.toThrow('INTEGRITY_FAILURE');
  });

  it('keeps local validation ahead of the repository entirely',async()=>{
   const{service,repository}=rejecting(new ServiceUnavailableException('Memory persistence is unavailable.'));
   await expect(service.getSnapshot('token','GLOBAL',context)).rejects.toThrow('UNSUPPORTED_CONTEXT');
   await expect(service.getSnapshot('token','GOAL','not-a-uuid')).rejects.toThrow('INVALID_OR_UNOWNED_CONTEXT');
   expect(repository.readIntelligenceSnapshot).not.toHaveBeenCalled();
  });

  it('issues exactly one repository read and never retries a transport failure',async()=>{
   const{service,repository}=rejecting(new MemoryDataApiError(503));
   await expect(service.getSnapshot('token','GOAL',context)).rejects.toBeInstanceOf(ServiceUnavailableException);
   expect(repository.readIntelligenceSnapshot).toHaveBeenCalledTimes(1);
  });
 });
});
