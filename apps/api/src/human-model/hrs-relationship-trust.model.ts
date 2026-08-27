import { BadRequestException } from '@nestjs/common';
import type { HimCalculationModel,HimMetricCalculationInput,HimMetricCalculationResult } from './him-calculation.types';

// HRS Relationship Trust v1 is a narrow, relationship-bound current reliance
// appraisal: based on what the user has actually experienced in ONE exact
// relationship, how willing the user currently feels to reasonably rely on
// the other person when something important to the user depends on that
// person's word, follow-through, or good-faith handling of that reliance.
// The core object is the user's own current at-report willingness to rely
// under meaningful interpersonal vulnerability/uncertainty - never a verdict
// on the other person. It is NOT a global propensity to trust people, a
// personality trait, attachment style or security, love, closeness,
// affection, loyalty, dependency, compliance, obedience, relationship
// satisfaction, compatibility, commitment, forgiveness, conflict frequency
// or its absence, hrs.communication, hrs.repair, hrs.emotional-safety,
// physical safety, an abuse-risk assessment, a truth detector, proof of
// objective trustworthiness, a prediction the person will act well,
// provider/model or QANDEEL/SENA trust, epistemic Confidence Runtime,
// self-confidence, or a clinical diagnosis - direct structured self-report
// only. A user may trust someone's follow-through without feeling
// emotionally safe with them, communicate well without trusting important
// commitments, feel love while trust is low, or report high trust that is
// objectively misplaced: every such combination stays expressible.
// Direction is not correctness or health: higher means only more
// self-reported current willingness to reasonably rely on this person in
// this exact relationship - never that the relationship is healthier, the
// trust is justified, the person is safe or honest, or that any
// recommendation follows. When reliance differs substantially by domain,
// TOO_CONTEXT_DEPENDENT_TO_RATE fails to UNASSESSED instead of collapsing
// domains into one misleading scalar (no domain sub-scores exist in v1),
// and INSUFFICIENT_BASIS_TO_JUDGE fails to UNASSESSED when the user lacks
// enough relevant relationship experience - never zero and never low trust.
// Exactly like Reflection (and unlike the seven-day HBS trio) there is NO
// temporal window of any kind in this contract: no windowStart/windowEnd
// fields exist, and any smuggled window input is rejected. Foundation
// semantic mapping deliberately stays UNRESOLVED (semanticType null; the
// RELATIONSHIP context kind is not a semantic type). The construct is fully
// independent of every sibling HRS metric: no inverse, composite, or
// sibling-derived value exists.
export const HRS_RELATIONSHIP_TRUST_MODEL_ID='hrs.relationship-trust.direct-structured-current-reliance';
export const HRS_RELATIONSHIP_TRUST_MODEL_VERSION=1;
export const HRS_RELATIONSHIP_TRUST_INSTRUMENT_ID='hrs.relationship-trust.direct-relationship-bound-reliance-report';
export const HRS_RELATIONSHIP_TRUST_SCALE_REFERENCE='hrs.relationship-trust.reliance-5.v1';
export const HRS_RELATIONSHIP_TRUST_RESPONSES=['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_CONTEXT_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'] as const;
type Response=(typeof HRS_RELATIONSHIP_TRUST_RESPONSES)[number];
export interface HrsRelationshipTrustObservation {
 observationId:string;measurementEventId:string;userId:string;metricKey:'hrs.relationship-trust';definitionVersion:1;
 contextKind:'RELATIONSHIP';contextId:string;target:string;targetContextKind:'RELATIONSHIP';targetContextId:string;
 instrumentId:typeof HRS_RELATIONSHIP_TRUST_INSTRUMENT_ID;instrumentVersion:1;scaleContractReference:typeof HRS_RELATIONSHIP_TRUST_SCALE_REFERENCE;scaleVersion:1;
 responseCode:Response;reportTimestamp:string;
 source:'DIRECT_STRUCTURED_USER_REPORT';superseded:boolean;
}
export const HRS_RELATIONSHIP_TRUST_MODEL=Object.freeze<HimCalculationModel>({
 modelId:HRS_RELATIONSHIP_TRUST_MODEL_ID,modelVersion:1,targetMetricKey:'hrs.relationship-trust',targetDefinitionVersion:1,lifecycle:'CALIBRATED',environment:'PRODUCTION',
 canonicalOwner:'QANDEEL_HIM_GOVERNANCE',canonicalSource:'HIM_EXPANSION_HRS_RELATIONSHIP_TRUST_MEASUREMENT_MODEL_V1',methodType:'DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT',
 scaleContractReference:HRS_RELATIONSHIP_TRUST_SCALE_REFERENCE,requiredInputKeys:['observation'],requiredEvidenceContract:'FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
 supportedContextKinds:['RELATIONSHIP'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',
 confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',implementationId:'hrs-relationship-trust-direct-structured-relationship-bound-v1',createdAt:'2026-08-27T00:00:00.000Z',versionedAt:'2026-08-27T00:00:00.000Z',
});
const SCORES:Readonly<Partial<Record<Response,number>>>=Object.freeze({VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5});
export function calculateHrsRelationshipTrust(input:HimMetricCalculationInput):HimMetricCalculationResult{
 const o=input.inputs.observation as HrsRelationshipTrustObservation|undefined;
 const base={metricKey:input.metricKey,definitionVersion:input.definitionVersion,modelId:input.modelId,modelVersion:input.modelVersion,context:{...input.context},missingInputKeys:o?[]:['observation'],supportingEvidenceRefs:[...input.supportingEvidenceRefs],contradictoryEvidenceRefs:[...input.contradictoryEvidenceRefs],calculatedAt:new Date().toISOString(),provenance:input.provenance,confidenceState:'UNASSESSED' as const,confidenceReference:null,traceId:input.traceId,updateReason:input.updateReason};
 if(!o)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 if(input.context.kind!=='RELATIONSHIP'||o.contextKind!==input.context.kind||o.contextId!==input.context.id)throw new BadRequestException('Relationship Trust exact context mismatch.');
 // A Relationship Trust observation always carries the exact server-derived
 // owned RELATIONSHIP target shape: the bounded trimmed label and the target
 // kind/ID equal to the RELATIONSHIP context. The label is verified as an
 // opaque binding artifact only - its meaning is never interpreted.
 if(o.targetContextKind!==o.contextKind||o.targetContextId!==o.contextId||typeof o.target!=='string'||o.target.trim()!==o.target||!o.target.length||o.target.length>256)throw new BadRequestException('Relationship Trust exact RELATIONSHIP target mismatch.');
 if(o.metricKey!=='hrs.relationship-trust'||o.definitionVersion!==1||o.instrumentId!==HRS_RELATIONSHIP_TRUST_INSTRUMENT_ID||o.instrumentVersion!==1||o.scaleContractReference!==HRS_RELATIONSHIP_TRUST_SCALE_REFERENCE||o.scaleVersion!==1||o.source!=='DIRECT_STRUCTURED_USER_REPORT'||!Number.isFinite(Date.parse(o.reportTimestamp))||!HRS_RELATIONSHIP_TRUST_RESPONSES.includes(o.responseCode))throw new BadRequestException('Relationship Trust observation contract mismatch.');
 // Relationship Trust is an at-report relationship-bound appraisal: no
 // temporal-window input exists in this contract, and a smuggled
 // seven/14/30-day window (or any caller-selected window) is rejected
 // rather than interpreted.
 if('windowStart' in o||'windowEnd' in o)throw new BadRequestException('Relationship Trust observation must not carry a temporal window.');
 if(o.superseded)throw new BadRequestException('Superseded Relationship Trust observation cannot be calculated.');
 if(input.contradictoryEvidenceRefs.length)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'};
 const score=SCORES[o.responseCode];
 // TOO_CONTEXT_DEPENDENT_TO_RATE, INSUFFICIENT_BASIS_TO_JUDGE, and NOT_SURE
 // are UNASSESSED, never zero: domain-dependent reliance, insufficient
 // relationship experience, or an unconfident report is missing data - not
 // low trust, and never a midpoint.
 if(score===undefined)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 return{...base,resultState:'ASSESSED',numericValue:score,contradictionState:'NONE'};
}
