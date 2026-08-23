import { Injectable } from '@nestjs/common';
import { HimRepository } from './him.repository';
import type { HimContextKind } from './him.types';
import type { HimOrdinalCategory,HimTrendDirection,HimTrendRequest,HimTrendResult,HimTrendSourcePoint,HimTrendUnassessedReason } from './him-trend.types';

export const HIM_TREND_CONTEXTS=Object.freeze<Record<string,readonly HimContextKind[]>>({'hse.energy':['CONVERSATION_SESSION'],'hse.motivation':['GOAL','SITUATION'],'hse.attention':['SITUATION','CONVERSATION_SESSION','DECISION'],'hse.self-confidence':['SITUATION','DECISION'],'hse.stress':['SITUATION','CONVERSATION_SESSION']});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES=Object.freeze<Record<number,HimOrdinalCategory>>({1:'VERY_LOW',2:'LOW',3:'MODERATE',4:'HIGH',5:'VERY_HIGH'});

@Injectable()
export class HimTrendService {
  constructor(private readonly repository:HimRepository){}
  async assess(userId:string,token:string,request:HimTrendRequest):Promise<HimTrendResult>{
    const invalid=this.validate(request);if(invalid)return this.unassessed(request,invalid);
    let source;try{source=await this.repository.readTrendSource(token,userId,request);}catch{throw new Error('HIM trend context is invalid or not owned.');}
    if(source.points.length>128)return this.unassessed(request,'WINDOW_OVERFLOW',source.excludedObservationCount,source.activeBinding);
    if(!source.activeBinding||source.points.some(p=>!this.trusted(p,userId,request,source.activeBinding!)))return this.unassessed(request,'INTEGRITY_FAILURE',source.excludedObservationCount,source.activeBinding);
    if(source.points.some(p=>p.canonical_binding_id!==source.activeBinding!.id))return this.unassessed(request,'INCOMPATIBLE_MEASUREMENT_VERSIONS',source.excludedObservationCount,source.activeBinding);
    const points=[...source.points].sort((a,b)=>a.observed_at.localeCompare(b.observed_at)||a.id.localeCompare(b.id));
    if(points.length<2)return this.unassessed(request,'INSUFFICIENT_COMPARABLE_OBSERVATIONS',source.excludedObservationCount,source.activeBinding,points);
    let up=false,down=false;for(let i=1;i<points.length;i++){up||=points[i].numeric_value!>points[i-1].numeric_value!;down||=points[i].numeric_value!<points[i-1].numeric_value!;}
    const direction:HimTrendDirection=up&&down?'MIXED':up?'INCREASING':down?'DECREASING':'UNCHANGED';return this.result(request,null,source.excludedObservationCount,source.activeBinding,points,direction);
  }
  private validate(r:HimTrendRequest):HimTrendUnassessedReason|null{const contexts=HIM_TREND_CONTEXTS[r.metricKey];if(!contexts||r.definitionVersion!==1)return'UNSUPPORTED_METRIC';if(!contexts.includes(r.contextKind))return'UNSUPPORTED_CONTEXT';if(!r.windowStart||!r.windowEnd)return'WINDOW_REQUIRED';const start=Date.parse(r.windowStart),end=Date.parse(r.windowEnd);if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)return'WINDOW_REQUIRED';if(!UUID.test(r.contextId))return'INVALID_OR_UNOWNED_CONTEXT';return null;}
  private trusted(p:HimTrendSourcePoint,userId:string,r:HimTrendRequest,b:NonNullable<Awaited<ReturnType<HimRepository['readTrendSource']>>['activeBinding']>):boolean{return p.user_id===userId&&p.metric_key===r.metricKey&&p.definition_version===r.definitionVersion&&p.context_kind===r.contextKind&&p.context_id===r.contextId&&p.value_state==='ASSESSED'&&p.validity_status==='VALID'&&p.canonical_provenance==='QANDEEL_HIM_RUNTIME_FOUNDATION_V1'&&Number.isInteger(p.numeric_value)&&p.numeric_value!>=1&&p.numeric_value!<=5&&!!p.measurement_event_id&&!!p.measurement_observation_id&&!!p.calculation_result_id&&!!p.canonical_binding_id&&p.binding_metric_key===r.metricKey&&p.binding_definition_version===r.definitionVersion&&p.binding_context_kind===r.contextKind&&p.instrument_id===b.instrumentId&&p.instrument_version===b.instrumentVersion&&p.scale_contract_reference===b.scaleReference&&p.scale_version===b.scaleVersion&&p.model_id===b.modelId&&p.model_version===b.modelVersion;}
  private unassessed(r:HimTrendRequest,reason:HimTrendUnassessedReason,excluded=0,binding:Parameters<HimTrendService['result']>[3]=null,points:HimTrendSourcePoint[]=[]):HimTrendResult{return this.result(r,reason,excluded,binding,points,null);}
  private result(r:HimTrendRequest,reason:HimTrendUnassessedReason|null,excluded:number,b:NonNullable<Awaited<ReturnType<HimRepository['readTrendSource']>>['activeBinding']>|null,points:HimTrendSourcePoint[],direction:HimTrendDirection|null):HimTrendResult{const first=points[0],latest=points.at(-1);return{trendAssessmentState:reason?'UNASSESSED':'ASSESSED',trendDirection:direction,unassessedReason:reason,metricKey:r.metricKey,definitionVersion:r.definitionVersion,contextKind:r.contextKind,contextId:r.contextId,windowStart:r.windowStart??'',windowEnd:r.windowEnd??'',eligibleObservationCount:points.length,excludedObservationCount:Math.min(excluded,128),firstCategory:first?CATEGORIES[first.numeric_value!]:null,latestCategory:latest?CATEGORIES[latest.numeric_value!]:null,firstObservedAt:first?.observed_at??null,latestObservedAt:latest?.observed_at??null,instrumentId:b?.instrumentId??null,instrumentVersion:b?.instrumentVersion??null,scaleReference:b?.scaleReference??null,scaleVersion:b?.scaleVersion??null,modelId:b?.modelId??null,modelVersion:b?.modelVersion??null,sourceMeasurementEventIds:points.slice(0,128).map(p=>p.measurement_event_id!).filter(Boolean),confidenceState:'UNASSESSED',confidenceReference:null,trendContractVersion:1,calculatedAt:new Date().toISOString()};}
}
