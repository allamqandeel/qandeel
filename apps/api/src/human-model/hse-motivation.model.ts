import { BadRequestException } from '@nestjs/common';
import type { HimCalculationModel,HimMetricCalculationInput,HimMetricCalculationResult } from './him-calculation.types';

export const HSE_MOTIVATION_MODEL_ID='hse.motivation.direct-structured-self-report';
export const HSE_MOTIVATION_MODEL_VERSION=1;
export const HSE_MOTIVATION_INSTRUMENT_ID='hse.motivation.direct-self-report';
export const HSE_MOTIVATION_SCALE_REFERENCE='hse.motivation.ordinal-5.v1';
export const HSE_MOTIVATION_RESPONSES=['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NOT_SURE'] as const;
type Response=(typeof HSE_MOTIVATION_RESPONSES)[number];
export interface HseMotivationObservation {
 observationId:string;measurementEventId:string;userId:string;metricKey:'hse.motivation';definitionVersion:1;
 contextKind:'GOAL'|'SITUATION';contextId:string;target:string;targetContextKind:'GOAL'|'SITUATION';targetContextId:string;
 instrumentId:typeof HSE_MOTIVATION_INSTRUMENT_ID;instrumentVersion:1;scaleContractReference:typeof HSE_MOTIVATION_SCALE_REFERENCE;scaleVersion:1;
 responseCode:Response;reportTimestamp:string;source:'DIRECT_STRUCTURED_USER_REPORT';superseded:boolean;
}
export const HSE_MOTIVATION_MODEL=Object.freeze<HimCalculationModel>({
 modelId:HSE_MOTIVATION_MODEL_ID,modelVersion:1,targetMetricKey:'hse.motivation',targetDefinitionVersion:1,lifecycle:'CALIBRATED',environment:'PRODUCTION',
 canonicalOwner:'QANDEEL_HIM_GOVERNANCE',canonicalSource:'ISSUE_58_HSE_MOTIVATION_MEASUREMENT_MODEL_V1',methodType:'DIRECT_STRUCTURED_SELF_REPORT',
 scaleContractReference:HSE_MOTIVATION_SCALE_REFERENCE,requiredInputKeys:['observation'],requiredEvidenceContract:'FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
 supportedContextKinds:['GOAL','SITUATION'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',
 confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',implementationId:'hse-motivation-direct-structured-v1',createdAt:'2026-08-22T00:00:00.000Z',versionedAt:'2026-08-22T00:00:00.000Z',
});
const SCORES:Readonly<Record<Exclude<Response,'NOT_SURE'>,number>>=Object.freeze({VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5});
export function calculateHseMotivation(input:HimMetricCalculationInput):HimMetricCalculationResult{
 const o=input.inputs.observation as HseMotivationObservation|undefined;
 const base={metricKey:input.metricKey,definitionVersion:input.definitionVersion,modelId:input.modelId,modelVersion:input.modelVersion,context:{...input.context},missingInputKeys:o?[]:['observation'],supportingEvidenceRefs:[...input.supportingEvidenceRefs],contradictoryEvidenceRefs:[...input.contradictoryEvidenceRefs],calculatedAt:new Date().toISOString(),provenance:input.provenance,confidenceState:'UNASSESSED' as const,confidenceReference:null,traceId:input.traceId,updateReason:input.updateReason};
 if(!o)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 if(!['GOAL','SITUATION'].includes(input.context.kind)||o.contextKind!==input.context.kind||o.contextId!==input.context.id||o.targetContextKind!==o.contextKind||o.targetContextId!==o.contextId||typeof o.target!=='string'||o.target.trim()!==o.target||!o.target.length||o.target.length>256)throw new BadRequestException('Motivation exact target/context mismatch.');
 if(o.metricKey!=='hse.motivation'||o.definitionVersion!==1||o.instrumentId!==HSE_MOTIVATION_INSTRUMENT_ID||o.instrumentVersion!==1||o.scaleContractReference!==HSE_MOTIVATION_SCALE_REFERENCE||o.scaleVersion!==1||o.source!=='DIRECT_STRUCTURED_USER_REPORT'||!Number.isFinite(Date.parse(o.reportTimestamp))||!HSE_MOTIVATION_RESPONSES.includes(o.responseCode))throw new BadRequestException('Motivation observation contract mismatch.');
 if(o.superseded)throw new BadRequestException('Superseded Motivation observation cannot be calculated.');
 if(input.contradictoryEvidenceRefs.length)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'};
 if(o.responseCode==='NOT_SURE')return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 return{...base,resultState:'ASSESSED',numericValue:SCORES[o.responseCode],contradictionState:'NONE'};
}

