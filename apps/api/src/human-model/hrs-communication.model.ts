import { BadRequestException } from '@nestjs/common';
import type { HimCalculationModel,HimMetricCalculationInput,HimMetricCalculationResult } from './him-calculation.types';

// HRS Communication v1 is a narrow, relationship-bound current communication
// workability appraisal: based on what the user has actually experienced in
// ONE exact relationship, the user's current appraisal of how workable
// communication is when something important needs to be expressed, heard,
// clarified, and understood well enough for the exchange to continue
// constructively, including when the two people do not initially agree. The
// construct is dyadic AS PERCEIVED BY THE USER - never an objective judgment
// about the other person. It measures whether important communication can
// meaningfully "get through" and produce enough shared understanding to keep
// the interaction workable. It is NOT amount or frequency of talking,
// sociability, extraversion, verbosity, agreement, absence of conflict,
// relationship satisfaction, love, closeness, intimacy, affection,
// hrs.relationship-trust, hrs.repair, hrs.emotional-safety, honesty or
// truthfulness, the other person's objective communication skill, conflict
// resolution success, persuasion, compliance, compatibility, a clinical or
// diagnostic construct, a safety verdict, or Recommendation authority -
// direct structured self-report only. A relationship may have high
// Communication and low Trust, high Communication and poor Repair, or low
// Communication and high Emotional Safety: every such combination stays
// expressible. When communication is excellent on practical matters but
// consistently breaks down on emotionally important topics (or vice versa),
// TOO_TOPIC_DEPENDENT_TO_RATE fails to UNASSESSED instead of collapsing
// topics into one misleading scalar (no communication subdomains exist in
// v1), and INSUFFICIENT_BASIS_TO_JUDGE fails to UNASSESSED when a new or
// sparse relationship has produced too few meaningful exchanges - missing
// basis, never zero and never "poor communication". Exactly like
// Relationship Trust (and unlike the seven-day HBS trio) there is NO
// temporal window of any kind in this contract: no windowStart/windowEnd
// fields exist, and any smuggled window input is rejected. Foundation
// semantic mapping deliberately stays UNRESOLVED (semanticType null; the
// RELATIONSHIP context kind is not a semantic type). The construct is fully
// independent of every sibling HRS metric: no inverse, composite, or
// sibling-derived value exists.
export const HRS_COMMUNICATION_MODEL_ID='hrs.communication.direct-structured-current-communication-workability';
export const HRS_COMMUNICATION_MODEL_VERSION=1;
export const HRS_COMMUNICATION_INSTRUMENT_ID='hrs.communication.direct-relationship-bound-communication-workability-report';
export const HRS_COMMUNICATION_SCALE_REFERENCE='hrs.communication.workability-5.v1';
export const HRS_COMMUNICATION_RESPONSES=['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_TOPIC_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'] as const;
type Response=(typeof HRS_COMMUNICATION_RESPONSES)[number];
export interface HrsCommunicationObservation {
 observationId:string;measurementEventId:string;userId:string;metricKey:'hrs.communication';definitionVersion:1;
 contextKind:'RELATIONSHIP';contextId:string;target:string;targetContextKind:'RELATIONSHIP';targetContextId:string;
 instrumentId:typeof HRS_COMMUNICATION_INSTRUMENT_ID;instrumentVersion:1;scaleContractReference:typeof HRS_COMMUNICATION_SCALE_REFERENCE;scaleVersion:1;
 responseCode:Response;reportTimestamp:string;
 source:'DIRECT_STRUCTURED_USER_REPORT';superseded:boolean;
}
export const HRS_COMMUNICATION_MODEL=Object.freeze<HimCalculationModel>({
 modelId:HRS_COMMUNICATION_MODEL_ID,modelVersion:1,targetMetricKey:'hrs.communication',targetDefinitionVersion:1,lifecycle:'CALIBRATED',environment:'PRODUCTION',
 canonicalOwner:'QANDEEL_HIM_GOVERNANCE',canonicalSource:'HIM_EXPANSION_HRS_COMMUNICATION_MEASUREMENT_MODEL_V1',methodType:'DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_COMMUNICATION_WORKABILITY_REPORT',
 scaleContractReference:HRS_COMMUNICATION_SCALE_REFERENCE,requiredInputKeys:['observation'],requiredEvidenceContract:'FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
 supportedContextKinds:['RELATIONSHIP'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',
 confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',implementationId:'hrs-communication-direct-structured-relationship-bound-v1',createdAt:'2026-08-27T00:00:00.000Z',versionedAt:'2026-08-27T00:00:00.000Z',
});
const SCORES:Readonly<Partial<Record<Response,number>>>=Object.freeze({VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5});
export function calculateHrsCommunication(input:HimMetricCalculationInput):HimMetricCalculationResult{
 const o=input.inputs.observation as HrsCommunicationObservation|undefined;
 const base={metricKey:input.metricKey,definitionVersion:input.definitionVersion,modelId:input.modelId,modelVersion:input.modelVersion,context:{...input.context},missingInputKeys:o?[]:['observation'],supportingEvidenceRefs:[...input.supportingEvidenceRefs],contradictoryEvidenceRefs:[...input.contradictoryEvidenceRefs],calculatedAt:new Date().toISOString(),provenance:input.provenance,confidenceState:'UNASSESSED' as const,confidenceReference:null,traceId:input.traceId,updateReason:input.updateReason};
 if(!o)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 if(input.context.kind!=='RELATIONSHIP'||o.contextKind!==input.context.kind||o.contextId!==input.context.id)throw new BadRequestException('Communication exact context mismatch.');
 // A Communication observation always carries the exact server-derived
 // owned RELATIONSHIP target shape: the bounded trimmed label and the target
 // kind/ID equal to the RELATIONSHIP context. The label is verified as an
 // opaque binding artifact only - its meaning is never interpreted.
 if(o.targetContextKind!==o.contextKind||o.targetContextId!==o.contextId||typeof o.target!=='string'||o.target.trim()!==o.target||!o.target.length||o.target.length>256)throw new BadRequestException('Communication exact RELATIONSHIP target mismatch.');
 if(o.metricKey!=='hrs.communication'||o.definitionVersion!==1||o.instrumentId!==HRS_COMMUNICATION_INSTRUMENT_ID||o.instrumentVersion!==1||o.scaleContractReference!==HRS_COMMUNICATION_SCALE_REFERENCE||o.scaleVersion!==1||o.source!=='DIRECT_STRUCTURED_USER_REPORT'||!Number.isFinite(Date.parse(o.reportTimestamp))||!HRS_COMMUNICATION_RESPONSES.includes(o.responseCode))throw new BadRequestException('Communication observation contract mismatch.');
 // Communication is an at-report relationship-bound appraisal: no
 // temporal-window input exists in this contract, and a smuggled
 // seven/14/30-day window (or any caller-selected window) is rejected
 // rather than interpreted.
 if('windowStart' in o||'windowEnd' in o)throw new BadRequestException('Communication observation must not carry a temporal window.');
 if(o.superseded)throw new BadRequestException('Superseded Communication observation cannot be calculated.');
 if(input.contradictoryEvidenceRefs.length)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'};
 const score=SCORES[o.responseCode];
 // TOO_TOPIC_DEPENDENT_TO_RATE, INSUFFICIENT_BASIS_TO_JUDGE, and NOT_SURE
 // are UNASSESSED, never zero: topic-dependent workability, too few
 // meaningful exchanges, or an unconfident report is missing data - not
 // poor communication, and never a midpoint.
 if(score===undefined)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 return{...base,resultState:'ASSESSED',numericValue:score,contradictionState:'NONE'};
}
