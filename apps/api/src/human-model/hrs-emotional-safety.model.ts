import { BadRequestException } from '@nestjs/common';
import type { HimCalculationModel,HimMetricCalculationInput,HimMetricCalculationResult } from './him-calculation.types';

// HRS Emotional Safety v1 is a narrow, relationship-bound current perceived
// safety appraisal for emotional openness: based on what the user has
// actually experienced in ONE exact relationship, how safe it currently
// feels to reveal emotionally vulnerable inner experience - such as a
// feeling, need, insecurity, mistake, limit, or disagreement - without
// reasonably expecting that the vulnerability itself will be met with
// humiliating, contemptuous, punitive, retaliatory, or weaponizing
// interpersonal consequences. The measured object is the user's CURRENT
// PERCEIVED interpersonal safety of emotional exposure - subjective and
// relationship-specific, NEVER an objective classification of the other
// person or the relationship. It is NOT physical/sexual/financial/medical
// safety, imminent-danger assessment, an abuse/coercive-control/
// harassment/manipulation/gaslighting/dangerousness classifier, objective
// partner safety, relationship health or satisfaction, love or closeness,
// attachment style or security, global or social anxiety, conflict
// frequency or absence of conflict, politeness or kindness, "never being
// challenged", lack of accountability, hrs.relationship-trust,
// hrs.communication, hrs.repair, stay/leave authority, or a clinical or
// diagnostic construct - direct structured self-report only. A higher score
// means only more self-reported emotional-openness safety in this
// relationship - never proof the relationship or person is objectively safe
// or healthy - and a lower score is never proof of abuse or danger. The
// word "Safety" grants this metric no system Safety authority: the existing
// Safety Runtime stays separate and independently authoritative, is never
// called, suppressed, replaced, or bypassed here, and no path maps the
// score to any safety verdict. A relationship may have high Trust and low
// Emotional Safety, low Communication and high Emotional Safety, or high
// Repair and low Emotional Safety: every such combination stays
// expressible. When perceived openness safety differs substantially by what
// would be disclosed, TOO_VULNERABILITY_DEPENDENT_TO_RATE fails to
// UNASSESSED instead of collapsing disclosure kinds into one misleading
// scalar (no Emotional Safety subdomains exist in v1 and nothing is
// averaged), and INSUFFICIENT_BASIS_TO_JUDGE fails to UNASSESSED when a new
// or sparse relationship has produced too little meaningful emotional
// exposure - missing basis, neither high nor low safety, never zero.
// Exactly like the three prior HRS metrics (and unlike the seven-day HBS
// trio) there is NO temporal window of any kind in this contract: no
// windowStart/windowEnd fields exist, and any smuggled window input is
// rejected. Foundation semantic mapping deliberately stays UNRESOLVED
// (semanticType null; neither RELATIONSHIP nor "safety" is a semantic
// type). The construct is fully independent of every sibling HRS metric:
// no inverse, composite, or sibling-derived value exists.
export const HRS_EMOTIONAL_SAFETY_MODEL_ID='hrs.emotional-safety.direct-structured-current-emotional-openness-safety';
export const HRS_EMOTIONAL_SAFETY_MODEL_VERSION=1;
export const HRS_EMOTIONAL_SAFETY_INSTRUMENT_ID='hrs.emotional-safety.direct-relationship-bound-emotional-openness-safety-report';
export const HRS_EMOTIONAL_SAFETY_SCALE_REFERENCE='hrs.emotional-safety.openness-safety-5.v1';
export const HRS_EMOTIONAL_SAFETY_RESPONSES=['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_VULNERABILITY_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'] as const;
type Response=(typeof HRS_EMOTIONAL_SAFETY_RESPONSES)[number];
export interface HrsEmotionalSafetyObservation {
 observationId:string;measurementEventId:string;userId:string;metricKey:'hrs.emotional-safety';definitionVersion:1;
 contextKind:'RELATIONSHIP';contextId:string;target:string;targetContextKind:'RELATIONSHIP';targetContextId:string;
 instrumentId:typeof HRS_EMOTIONAL_SAFETY_INSTRUMENT_ID;instrumentVersion:1;scaleContractReference:typeof HRS_EMOTIONAL_SAFETY_SCALE_REFERENCE;scaleVersion:1;
 responseCode:Response;reportTimestamp:string;
 source:'DIRECT_STRUCTURED_USER_REPORT';superseded:boolean;
}
export const HRS_EMOTIONAL_SAFETY_MODEL=Object.freeze<HimCalculationModel>({
 modelId:HRS_EMOTIONAL_SAFETY_MODEL_ID,modelVersion:1,targetMetricKey:'hrs.emotional-safety',targetDefinitionVersion:1,lifecycle:'CALIBRATED',environment:'PRODUCTION',
 canonicalOwner:'QANDEEL_HIM_GOVERNANCE',canonicalSource:'HIM_EXPANSION_HRS_EMOTIONAL_SAFETY_MEASUREMENT_MODEL_V1',methodType:'DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_EMOTIONAL_OPENNESS_SAFETY_REPORT',
 scaleContractReference:HRS_EMOTIONAL_SAFETY_SCALE_REFERENCE,requiredInputKeys:['observation'],requiredEvidenceContract:'FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
 supportedContextKinds:['RELATIONSHIP'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',
 confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',implementationId:'hrs-emotional-safety-direct-structured-relationship-bound-v1',createdAt:'2026-08-27T00:00:00.000Z',versionedAt:'2026-08-27T00:00:00.000Z',
});
const SCORES:Readonly<Partial<Record<Response,number>>>=Object.freeze({VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5});
export function calculateHrsEmotionalSafety(input:HimMetricCalculationInput):HimMetricCalculationResult{
 const o=input.inputs.observation as HrsEmotionalSafetyObservation|undefined;
 const base={metricKey:input.metricKey,definitionVersion:input.definitionVersion,modelId:input.modelId,modelVersion:input.modelVersion,context:{...input.context},missingInputKeys:o?[]:['observation'],supportingEvidenceRefs:[...input.supportingEvidenceRefs],contradictoryEvidenceRefs:[...input.contradictoryEvidenceRefs],calculatedAt:new Date().toISOString(),provenance:input.provenance,confidenceState:'UNASSESSED' as const,confidenceReference:null,traceId:input.traceId,updateReason:input.updateReason};
 if(!o)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 if(input.context.kind!=='RELATIONSHIP'||o.contextKind!==input.context.kind||o.contextId!==input.context.id)throw new BadRequestException('Emotional Safety exact context mismatch.');
 // An Emotional Safety observation always carries the exact server-derived
 // owned RELATIONSHIP target shape: the bounded trimmed label and the target
 // kind/ID equal to the RELATIONSHIP context. The label is verified as an
 // opaque binding artifact only - its meaning is never interpreted.
 if(o.targetContextKind!==o.contextKind||o.targetContextId!==o.contextId||typeof o.target!=='string'||o.target.trim()!==o.target||!o.target.length||o.target.length>256)throw new BadRequestException('Emotional Safety exact RELATIONSHIP target mismatch.');
 if(o.metricKey!=='hrs.emotional-safety'||o.definitionVersion!==1||o.instrumentId!==HRS_EMOTIONAL_SAFETY_INSTRUMENT_ID||o.instrumentVersion!==1||o.scaleContractReference!==HRS_EMOTIONAL_SAFETY_SCALE_REFERENCE||o.scaleVersion!==1||o.source!=='DIRECT_STRUCTURED_USER_REPORT'||!Number.isFinite(Date.parse(o.reportTimestamp))||!HRS_EMOTIONAL_SAFETY_RESPONSES.includes(o.responseCode))throw new BadRequestException('Emotional Safety observation contract mismatch.');
 // Emotional Safety is an at-report relationship-bound appraisal: no
 // temporal-window input exists in this contract, and a smuggled
 // seven/14/30-day window (or any caller-selected window) is rejected
 // rather than interpreted.
 if('windowStart' in o||'windowEnd' in o)throw new BadRequestException('Emotional Safety observation must not carry a temporal window.');
 if(o.superseded)throw new BadRequestException('Superseded Emotional Safety observation cannot be calculated.');
 if(input.contradictoryEvidenceRefs.length)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'};
 const score=SCORES[o.responseCode];
 // TOO_VULNERABILITY_DEPENDENT_TO_RATE, INSUFFICIENT_BASIS_TO_JUDGE, and
 // NOT_SURE are UNASSESSED, never zero: disclosure-dependent safety, too
 // little meaningful emotional exposure, or an unconfident report is
 // missing data - neither low nor high safety, and never a midpoint.
 if(score===undefined)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 return{...base,resultState:'ASSESSED',numericValue:score,contradictionState:'NONE'};
}
