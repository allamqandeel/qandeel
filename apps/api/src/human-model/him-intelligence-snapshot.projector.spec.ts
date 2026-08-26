import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HimIntelligenceSnapshotService } from './him-intelligence-snapshot.service';
import { HIM_SNAPSHOT_SLOTS,projectHimIntelligenceSnapshot } from './him-intelligence-snapshot.projector';
import type { HimSnapshotSourceRow } from './him-intelligence-snapshot.types';

// HIM Runtime Consumption v1: proves the ONE shared source-row canonicalizer.
// The foreground service delegates to it unchanged, the background path uses
// the SAME function, malformed input fails identically through both entries,
// and no second projection implementation exists in the service.
const context='00000000-0000-4000-8000-000000000010',generated='2026-08-24T00:00:00.000Z';
const active=(metric:string,order:number,kind='CONVERSATION_SESSION'):HimSnapshotSourceRow=>({generated_at:generated,slot_order:order,metric_key:metric,definition_version:1,semantic_type:'STATE',context_kind:kind,context_id:context,active_binding_id:`active-${metric}`,active_instrument_id:`instrument-${metric}`,active_instrument_version:1,active_scale_reference:`scale-${metric}`,active_scale_version:1,active_model_id:`model-${metric}`,active_model_version:1,measurement_event_id:null,event_observed_at:null,measurement_observation_id:null,response_code:null,observation_instrument_id:null,observation_instrument_version:null,observation_scale_reference:null,observation_scale_version:null,snapshot_id:null,value_state:null,numeric_value:null,validity_status:null,snapshot_provenance:null,calculation_result_id:null,canonical_binding_id:null,snapshot_scale_reference:null,snapshot_scale_version:null,result_state:null,result_numeric_value:null,result_model_id:null,result_model_version:null,result_provenance:null,result_confidence_state:null,result_confidence_reference:null,source_binding_status:null,source_instrument_id:null,source_instrument_version:null,source_scale_reference:null,source_scale_version:null,source_model_id:null,source_model_version:null});
const assessed=(metric:string,order:number,n=3,kind='CONVERSATION_SESSION'):HimSnapshotSourceRow=>{const r=active(metric,order,kind);return{...r,measurement_event_id:`event-${metric}`,event_observed_at:'2026-08-23T00:00:00.000Z',measurement_observation_id:`observation-${metric}`,response_code:['','VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH'][n],observation_instrument_id:r.active_instrument_id,observation_instrument_version:1,observation_scale_reference:r.active_scale_reference,observation_scale_version:1,snapshot_id:`snapshot-${metric}`,value_state:'ASSESSED',numeric_value:n,validity_status:'VALID',snapshot_provenance:'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',calculation_result_id:`result-${metric}`,canonical_binding_id:r.active_binding_id,snapshot_scale_reference:r.active_scale_reference,snapshot_scale_version:1,result_state:'ASSESSED',result_numeric_value:n,result_model_id:r.active_model_id,result_model_version:1,result_provenance:'QANDEEL_HIM_CALCULATION_RUNTIME_V1',result_confidence_state:'UNASSESSED',result_confidence_reference:null,source_binding_status:'ACTIVE',source_instrument_id:r.active_instrument_id,source_instrument_version:1,source_scale_reference:r.active_scale_reference,source_scale_version:1,source_model_id:r.active_model_id,source_model_version:1};};
const session=()=>[assessed('hse.stress',1,4),active('hse.energy',2),active('hse.attention',5)];
const service=(rows:HimSnapshotSourceRow[])=>new HimIntelligenceSnapshotService({readIntelligenceSnapshot:jest.fn().mockResolvedValue(rows)} as never);

describe('projectHimIntelligenceSnapshot (shared canonicalizer)',()=>{
 it('re-exports the exact frozen slot matrix used by the service',()=>{expect(HIM_SNAPSHOT_SLOTS).toEqual({SITUATION:['hse.stress','hse.motivation','hse.self-confidence','hse.attention'],CONVERSATION_SESSION:['hse.stress','hse.energy','hse.attention'],DECISION:['hse.self-confidence','hse.attention'],GOAL:['hse.motivation']});});
 it('projects foreground rows byte-identically to the direct projection - one policy, zero drift',async()=>{
  const rows=session();
  const viaService=await service(rows).getSnapshot('token','CONVERSATION_SESSION',context);
  const direct=projectHimIntelligenceSnapshot('CONVERSATION_SESSION',context,rows);
  expect(JSON.stringify(viaService)).toBe(JSON.stringify(direct));
  expect(direct).toMatchObject({snapshotContractVersion:1,coverageState:'PARTIAL',eligibleMetricCount:3,assessedMetricCount:1,unassessedMetricCount:2,generatedAt:generated});
  expect(direct.metrics.map(m=>[m.metricKey,m.valueState,m.ordinalCategory])).toEqual([['hse.stress','ASSESSED','HIGH'],['hse.energy','UNASSESSED',null],['hse.attention','UNASSESSED',null]]);
 });
 it.each([['a missing slot',()=>session().slice(1)],['a reordered slot set',()=>{const rows=session();return[rows[1],rows[0],rows[2]];}],['a foreign context id',()=>session().map(r=>({...r,context_id:'00000000-0000-4000-8000-00000000ffff'}))],['an inconsistent read time',()=>session().map((r,i)=>i?{...r,generated_at:'later'}:r)],['a malformed ordinal code',()=>[({...assessed('hse.stress',1,4),numeric_value:9,result_numeric_value:9}),active('hse.energy',2),active('hse.attention',5)]],['a broken provenance chain',()=>[({...assessed('hse.stress',1,4),snapshot_provenance:'FORGED'}),active('hse.energy',2),active('hse.attention',5)]]])('fails %s identically through the service and the direct projection',async(_label,rows)=>{
  await expect(service(rows()).getSnapshot('token','CONVERSATION_SESSION',context)).rejects.toThrow('INTEGRITY_FAILURE');
  expect(()=>projectHimIntelligenceSnapshot('CONVERSATION_SESSION',context,rows())).toThrow('INTEGRITY_FAILURE');
 });
 it('keeps ONE implementation: the service delegates and holds no second projection policy',()=>{
  const source=readFileSync(join(__dirname,'him-intelligence-snapshot.service.ts'),'utf8');
  expect(source).toContain("from './him-intelligence-snapshot.projector'");
  expect(source).toContain('projectHimIntelligenceSnapshot(');
  for(const remnant of['INCOMPATIBLE_ACTIVE_BINDING','NO_MEASUREMENT_EVENT','LATEST_EVENT_UNASSESSED','LATEST_EVENT_INVALIDATED','VERY_LOW','private metric','SLOT_ORDER'])expect(source).not.toContain(remnant);
 });
});
