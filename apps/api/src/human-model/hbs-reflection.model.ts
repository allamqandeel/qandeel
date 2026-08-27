import { BadRequestException } from '@nestjs/common';
import type { HimCalculationModel,HimMetricCalculationInput,HimMetricCalculationResult } from './him-calculation.types';

// HBS Reflection v1 is a narrow, context-bound, deliberate reflective
// engagement: at the time of report, to what extent the user has
// intentionally stepped back to examine ONE exact owned SITUATION or
// CONVERSATION_SESSION - what happened, their own actions or assumptions,
// and possible alternative interpretations, learning, or adjustment. It
// measures the reflective behavior/process, never whether the user reached a
// correct insight. It is NOT a permanent personality trait, intelligence,
// wisdom, analytical ability, insight accuracy, hgs.self-awareness,
// emotional intelligence, mindfulness, global introspection disposition,
// accountability, guilt, regret, self-criticism, overthinking, repetitive
// replay, worry, rumination, anxiety, indecision, learning outcome, behavior
// change, Recommendation readiness, therapeutic progress, or clinical
// functioning - direct structured self-report only. A user may reflect
// extensively and still reach a mistaken conclusion; repetitive thinking is
// not automatically Reflection. Direction is not valence: higher means more
// self-reported deliberate reflective engagement with this exact context,
// never automatically healthier/better/wiser. Unlike the seven-day HBS trio
// (Avoidance, Consistency, Initiative) there is NO temporal window of any
// kind in this contract: no windowStart/windowEnd fields exist, and any
// smuggled window input is rejected. Foundation semantic mapping
// deliberately stays UNRESOLVED (semanticType null). The construct is fully
// independent of every sibling HBS metric and of hgs.self-awareness: no
// inverse, composite, or sibling-derived value exists.
export const HBS_REFLECTION_MODEL_ID='hbs.reflection.direct-structured-context-bound-reflective-engagement';
export const HBS_REFLECTION_MODEL_VERSION=1;
export const HBS_REFLECTION_INSTRUMENT_ID='hbs.reflection.direct-context-bound-reflective-engagement-report';
export const HBS_REFLECTION_SCALE_REFERENCE='hbs.reflection.engagement-5.v1';
export const HBS_REFLECTION_RESPONSES=['NOT_AT_ALL','A_LITTLE','SOMEWHAT','QUITE_A_BIT','A_GREAT_DEAL','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NOT_SURE'] as const;
type Response=(typeof HBS_REFLECTION_RESPONSES)[number];
export interface HbsReflectionObservation {
 observationId:string;measurementEventId:string;userId:string;metricKey:'hbs.reflection';definitionVersion:1;
 contextKind:'SITUATION'|'CONVERSATION_SESSION';contextId:string;target:string|null;targetContextKind:'SITUATION'|null;targetContextId:string|null;
 instrumentId:typeof HBS_REFLECTION_INSTRUMENT_ID;instrumentVersion:1;scaleContractReference:typeof HBS_REFLECTION_SCALE_REFERENCE;scaleVersion:1;
 responseCode:Response;reportTimestamp:string;
 source:'DIRECT_STRUCTURED_USER_REPORT';superseded:boolean;
}
export const HBS_REFLECTION_MODEL=Object.freeze<HimCalculationModel>({
 modelId:HBS_REFLECTION_MODEL_ID,modelVersion:1,targetMetricKey:'hbs.reflection',targetDefinitionVersion:1,lifecycle:'CALIBRATED',environment:'PRODUCTION',
 canonicalOwner:'QANDEEL_HIM_GOVERNANCE',canonicalSource:'HIM_EXPANSION_HBS_REFLECTION_MEASUREMENT_MODEL_V1',methodType:'DIRECT_STRUCTURED_CONTEXT_BOUND_REFLECTIVE_ENGAGEMENT_REPORT',
 scaleContractReference:HBS_REFLECTION_SCALE_REFERENCE,requiredInputKeys:['observation'],requiredEvidenceContract:'FIRST_CLASS_AUTHORIZED_CONTEXT_HIM_MEASUREMENT_OBSERVATION_V1',
 supportedContextKinds:['SITUATION','CONVERSATION_SESSION'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',
 confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',implementationId:'hbs-reflection-direct-structured-context-bound-v1',createdAt:'2026-08-27T00:00:00.000Z',versionedAt:'2026-08-27T00:00:00.000Z',
});
const SCORES:Readonly<Partial<Record<Response,number>>>=Object.freeze({NOT_AT_ALL:1,A_LITTLE:2,SOMEWHAT:3,QUITE_A_BIT:4,A_GREAT_DEAL:5});
export function calculateHbsReflection(input:HimMetricCalculationInput):HimMetricCalculationResult{
 const o=input.inputs.observation as HbsReflectionObservation|undefined;
 const base={metricKey:input.metricKey,definitionVersion:input.definitionVersion,modelId:input.modelId,modelVersion:input.modelVersion,context:{...input.context},missingInputKeys:o?[]:['observation'],supportingEvidenceRefs:[...input.supportingEvidenceRefs],contradictoryEvidenceRefs:[...input.contradictoryEvidenceRefs],calculatedAt:new Date().toISOString(),provenance:input.provenance,confidenceState:'UNASSESSED' as const,confidenceReference:null,traceId:input.traceId,updateReason:input.updateReason};
 if(!o)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 if(!['SITUATION','CONVERSATION_SESSION'].includes(input.context.kind)||o.contextKind!==input.context.kind||o.contextId!==input.context.id)throw new BadRequestException('Reflection exact context mismatch.');
 // A SITUATION observation carries the exact server-derived owned target
 // shape; a CONVERSATION_SESSION observation must carry all-null target
 // fields under the canonical representation - no fake session targets.
 if(o.contextKind==='SITUATION'&&(o.targetContextKind!==o.contextKind||o.targetContextId!==o.contextId||typeof o.target!=='string'||o.target.trim()!==o.target||!o.target.length||o.target.length>256))throw new BadRequestException('Reflection exact SITUATION target mismatch.');
 if(o.contextKind==='CONVERSATION_SESSION'&&(o.target!==null||o.targetContextKind!==null||o.targetContextId!==null))throw new BadRequestException('Reflection session observation must carry null target fields.');
 if(o.metricKey!=='hbs.reflection'||o.definitionVersion!==1||o.instrumentId!==HBS_REFLECTION_INSTRUMENT_ID||o.instrumentVersion!==1||o.scaleContractReference!==HBS_REFLECTION_SCALE_REFERENCE||o.scaleVersion!==1||o.source!=='DIRECT_STRUCTURED_USER_REPORT'||!Number.isFinite(Date.parse(o.reportTimestamp))||!HBS_REFLECTION_RESPONSES.includes(o.responseCode))throw new BadRequestException('Reflection observation contract mismatch.');
 // Reflection is an at-report context-bound assessment: no temporal-window
 // input exists in this contract, and a smuggled seven/14/30-day window (or
 // any caller-selected window) is rejected rather than interpreted.
 if('windowStart' in o||'windowEnd' in o)throw new BadRequestException('Reflection observation must not carry a temporal window.');
 if(o.superseded)throw new BadRequestException('Superseded Reflection observation cannot be calculated.');
 if(input.contradictoryEvidenceRefs.length)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'};
 const score=SCORES[o.responseCode];
 // NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT and NOT_SURE are UNASSESSED, never
 // zero: a too-early or incomplete context, a lack of meaningful reflective
 // distance, or an unconfident report is missing data - not low reflection.
 if(score===undefined)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 return{...base,resultState:'ASSESSED',numericValue:score,contradictionState:'NONE'};
}
