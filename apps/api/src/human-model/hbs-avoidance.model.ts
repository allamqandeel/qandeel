import { BadRequestException } from '@nestjs/common';
import type { HimCalculationModel,HimMetricCalculationInput,HimMetricCalculationResult } from './him-calculation.types';

// HBS Avoidance v1 is a narrow, target-bound, recent behavioral frequency:
// how often the user reports delaying/disengaging from an intended next step
// toward ONE exact owned GOAL/SITUATION during the fixed previous seven days,
// despite a real opportunity and intention to act. It is NOT a trait, clinical
// construct, fear/anxiety severity, procrastination, low Motivation/Energy/
// Attention, or any inferred signal — direct structured self-report only.
// Direction is not valence: a higher frequency is never automatically "worse".
// Foundation semantic mapping deliberately stays UNRESOLVED (semanticType
// null); calibration and semantic mapping are independent here.
export const HBS_AVOIDANCE_MODEL_ID='hbs.avoidance.direct-structured-seven-day-self-report';
export const HBS_AVOIDANCE_MODEL_VERSION=1;
export const HBS_AVOIDANCE_INSTRUMENT_ID='hbs.avoidance.direct-target-bound-seven-day-report';
export const HBS_AVOIDANCE_SCALE_REFERENCE='hbs.avoidance.frequency-5.v1';
export const HBS_AVOIDANCE_WINDOW_MS=7*24*60*60*1000;
export const HBS_AVOIDANCE_RESPONSES=['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_OPPORTUNITY','NOT_SURE'] as const;
type Response=(typeof HBS_AVOIDANCE_RESPONSES)[number];
export interface HbsAvoidanceObservation {
 observationId:string;measurementEventId:string;userId:string;metricKey:'hbs.avoidance';definitionVersion:1;
 contextKind:'GOAL'|'SITUATION';contextId:string;target:string;targetContextKind:'GOAL'|'SITUATION';targetContextId:string;
 instrumentId:typeof HBS_AVOIDANCE_INSTRUMENT_ID;instrumentVersion:1;scaleContractReference:typeof HBS_AVOIDANCE_SCALE_REFERENCE;scaleVersion:1;
 responseCode:Response;reportTimestamp:string;windowStart:string;windowEnd:string;
 source:'DIRECT_STRUCTURED_USER_REPORT';superseded:boolean;
}
export const HBS_AVOIDANCE_MODEL=Object.freeze<HimCalculationModel>({
 modelId:HBS_AVOIDANCE_MODEL_ID,modelVersion:1,targetMetricKey:'hbs.avoidance',targetDefinitionVersion:1,lifecycle:'CALIBRATED',environment:'PRODUCTION',
 canonicalOwner:'QANDEEL_HIM_GOVERNANCE',canonicalSource:'HIM_EXPANSION_HBS_AVOIDANCE_MEASUREMENT_MODEL_V1',methodType:'DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_REPORT',
 scaleContractReference:HBS_AVOIDANCE_SCALE_REFERENCE,requiredInputKeys:['observation'],requiredEvidenceContract:'FIRST_CLASS_TARGET_BOUND_PERIOD_HIM_MEASUREMENT_OBSERVATION_V1',
 supportedContextKinds:['GOAL','SITUATION'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',
 confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',implementationId:'hbs-avoidance-direct-structured-seven-day-v1',createdAt:'2026-08-27T00:00:00.000Z',versionedAt:'2026-08-27T00:00:00.000Z',
});
const SCORES:Readonly<Partial<Record<Response,number>>>=Object.freeze({NEVER:1,RARELY:2,SOMETIMES:3,OFTEN:4,ALMOST_ALWAYS:5});
export function calculateHbsAvoidance(input:HimMetricCalculationInput):HimMetricCalculationResult{
 const o=input.inputs.observation as HbsAvoidanceObservation|undefined;
 const base={metricKey:input.metricKey,definitionVersion:input.definitionVersion,modelId:input.modelId,modelVersion:input.modelVersion,context:{...input.context},missingInputKeys:o?[]:['observation'],supportingEvidenceRefs:[...input.supportingEvidenceRefs],contradictoryEvidenceRefs:[...input.contradictoryEvidenceRefs],calculatedAt:new Date().toISOString(),provenance:input.provenance,confidenceState:'UNASSESSED' as const,confidenceReference:null,traceId:input.traceId,updateReason:input.updateReason};
 if(!o)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 if(!['GOAL','SITUATION'].includes(input.context.kind)||o.contextKind!==input.context.kind||o.contextId!==input.context.id||o.targetContextKind!==o.contextKind||o.targetContextId!==o.contextId||typeof o.target!=='string'||o.target.trim()!==o.target||!o.target.length||o.target.length>256)throw new BadRequestException('Avoidance exact target/context mismatch.');
 if(o.metricKey!=='hbs.avoidance'||o.definitionVersion!==1||o.instrumentId!==HBS_AVOIDANCE_INSTRUMENT_ID||o.instrumentVersion!==1||o.scaleContractReference!==HBS_AVOIDANCE_SCALE_REFERENCE||o.scaleVersion!==1||o.source!=='DIRECT_STRUCTURED_USER_REPORT'||!Number.isFinite(Date.parse(o.reportTimestamp))||!HBS_AVOIDANCE_RESPONSES.includes(o.responseCode))throw new BadRequestException('Avoidance observation contract mismatch.');
 const windowStart=Date.parse(o.windowStart),windowEnd=Date.parse(o.windowEnd);
 // The seven-day retrospective window is server-owned and immutable: exactly
 // seven days, never ending after the report, never chosen by the caller. A
 // correction keeps the original window, so windowEnd may precede a later
 // corrected reportTimestamp but can never follow it.
 if(!Number.isFinite(windowStart)||!Number.isFinite(windowEnd)||windowEnd-windowStart!==HBS_AVOIDANCE_WINDOW_MS||windowEnd>Date.parse(o.reportTimestamp))throw new BadRequestException('Avoidance seven-day observation window mismatch.');
 if(o.superseded)throw new BadRequestException('Superseded Avoidance observation cannot be calculated.');
 if(input.contradictoryEvidenceRefs.length)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'};
 const score=SCORES[o.responseCode];
 // NO_CLEAR_OPPORTUNITY and NOT_SURE are UNASSESSED, never zero: absence of a
 // clear opportunity or a confident report is missing data, not low avoidance.
 if(score===undefined)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 return{...base,resultState:'ASSESSED',numericValue:score,contradictionState:'NONE'};
}
