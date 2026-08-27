import { BadRequestException } from '@nestjs/common';
import type { HimCalculationModel,HimMetricCalculationInput,HimMetricCalculationResult } from './him-calculation.types';

// HRS Repair v1 is a narrow, relationship-bound current repair-effectiveness
// appraisal after meaningful interpersonal rupture: based on repair
// opportunities the user has actually experienced in ONE exact relationship,
// the user's current appraisal of how effectively the relationship can
// reduce the unresolved impact of hurt, tension, misunderstanding, or
// conflict and restore workable connection through acknowledgment,
// clarification, de-escalation, accountability, or corrective action. The
// core object is repair AFTER a rupture, not whether conflict exists: repair
// can happen without full agreement, can be partial, and requires no
// forgiveness - calming down alone is not necessarily repair, and
// forgetting/avoiding the issue is not automatically repair. It is NOT
// conflict frequency, absence of conflict, "never arguing", generic
// Communication quality, hrs.relationship-trust, hrs.emotional-safety,
// forgiveness, reconciliation or reunion, staying in the relationship,
// relationship satisfaction, love or closeness, attachment style, moral
// blame or fault, whether one person apologized, whether the underlying
// issue was objectively solved, whether the other person is safe, an
// abuse-risk assessment, a clinical construct, or a stay/leave
// Recommendation - direct structured self-report only. A relationship may
// communicate clearly during ordinary conversation yet repair poorly after
// hurt, may have low Trust but strong repair behavior, or may repair
// disagreements while still being emotionally unsafe: every such combination
// stays expressible. When the user has not experienced a meaningful rupture
// that actually required repair, NO_MEANINGFUL_REPAIR_OPPORTUNITY fails to
// UNASSESSED - absence of conflict is not evidence of repair ability, and
// the missing opportunity is never converted into a high score or a low
// one. When some ruptures repair well and others remain badly unresolved,
// TOO_EPISODE_DEPENDENT_TO_RATE fails to UNASSESSED instead of erasing that
// difference in one scalar (no repair subdomains or episode averaging exist
// in v1). Exactly like Relationship Trust (and unlike the seven-day HBS
// trio) there is NO temporal window of any kind in this contract: no
// windowStart/windowEnd fields exist, and any smuggled window input is
// rejected. Foundation semantic mapping deliberately stays UNRESOLVED
// (semanticType null; the RELATIONSHIP context kind is not a semantic
// type). The construct is fully independent of every sibling HRS metric:
// no inverse, composite, or sibling-derived value exists.
export const HRS_REPAIR_MODEL_ID='hrs.repair.direct-structured-current-repair-effectiveness';
export const HRS_REPAIR_MODEL_VERSION=1;
export const HRS_REPAIR_INSTRUMENT_ID='hrs.repair.direct-relationship-bound-repair-effectiveness-report';
export const HRS_REPAIR_SCALE_REFERENCE='hrs.repair.effectiveness-5.v1';
export const HRS_REPAIR_RESPONSES=['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_EPISODE_DEPENDENT_TO_RATE','NOT_SURE'] as const;
type Response=(typeof HRS_REPAIR_RESPONSES)[number];
export interface HrsRepairObservation {
 observationId:string;measurementEventId:string;userId:string;metricKey:'hrs.repair';definitionVersion:1;
 contextKind:'RELATIONSHIP';contextId:string;target:string;targetContextKind:'RELATIONSHIP';targetContextId:string;
 instrumentId:typeof HRS_REPAIR_INSTRUMENT_ID;instrumentVersion:1;scaleContractReference:typeof HRS_REPAIR_SCALE_REFERENCE;scaleVersion:1;
 responseCode:Response;reportTimestamp:string;
 source:'DIRECT_STRUCTURED_USER_REPORT';superseded:boolean;
}
export const HRS_REPAIR_MODEL=Object.freeze<HimCalculationModel>({
 modelId:HRS_REPAIR_MODEL_ID,modelVersion:1,targetMetricKey:'hrs.repair',targetDefinitionVersion:1,lifecycle:'CALIBRATED',environment:'PRODUCTION',
 canonicalOwner:'QANDEEL_HIM_GOVERNANCE',canonicalSource:'HIM_EXPANSION_HRS_REPAIR_MEASUREMENT_MODEL_V1',methodType:'DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT',
 scaleContractReference:HRS_REPAIR_SCALE_REFERENCE,requiredInputKeys:['observation'],requiredEvidenceContract:'FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
 supportedContextKinds:['RELATIONSHIP'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',
 confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',implementationId:'hrs-repair-direct-structured-relationship-bound-v1',createdAt:'2026-08-27T00:00:00.000Z',versionedAt:'2026-08-27T00:00:00.000Z',
});
const SCORES:Readonly<Partial<Record<Response,number>>>=Object.freeze({VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5});
export function calculateHrsRepair(input:HimMetricCalculationInput):HimMetricCalculationResult{
 const o=input.inputs.observation as HrsRepairObservation|undefined;
 const base={metricKey:input.metricKey,definitionVersion:input.definitionVersion,modelId:input.modelId,modelVersion:input.modelVersion,context:{...input.context},missingInputKeys:o?[]:['observation'],supportingEvidenceRefs:[...input.supportingEvidenceRefs],contradictoryEvidenceRefs:[...input.contradictoryEvidenceRefs],calculatedAt:new Date().toISOString(),provenance:input.provenance,confidenceState:'UNASSESSED' as const,confidenceReference:null,traceId:input.traceId,updateReason:input.updateReason};
 if(!o)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 if(input.context.kind!=='RELATIONSHIP'||o.contextKind!==input.context.kind||o.contextId!==input.context.id)throw new BadRequestException('Repair exact context mismatch.');
 // A Repair observation always carries the exact server-derived owned
 // RELATIONSHIP target shape: the bounded trimmed label and the target
 // kind/ID equal to the RELATIONSHIP context. The label is verified as an
 // opaque binding artifact only - its meaning is never interpreted.
 if(o.targetContextKind!==o.contextKind||o.targetContextId!==o.contextId||typeof o.target!=='string'||o.target.trim()!==o.target||!o.target.length||o.target.length>256)throw new BadRequestException('Repair exact RELATIONSHIP target mismatch.');
 if(o.metricKey!=='hrs.repair'||o.definitionVersion!==1||o.instrumentId!==HRS_REPAIR_INSTRUMENT_ID||o.instrumentVersion!==1||o.scaleContractReference!==HRS_REPAIR_SCALE_REFERENCE||o.scaleVersion!==1||o.source!=='DIRECT_STRUCTURED_USER_REPORT'||!Number.isFinite(Date.parse(o.reportTimestamp))||!HRS_REPAIR_RESPONSES.includes(o.responseCode))throw new BadRequestException('Repair observation contract mismatch.');
 // Repair is an at-report relationship-bound appraisal grounded in actual
 // prior repair opportunities: no temporal-window input exists in this
 // contract (it is not a seven-day frequency or "last conflict" measure),
 // and a smuggled window is rejected rather than interpreted.
 if('windowStart' in o||'windowEnd' in o)throw new BadRequestException('Repair observation must not carry a temporal window.');
 if(o.superseded)throw new BadRequestException('Superseded Repair observation cannot be calculated.');
 if(input.contradictoryEvidenceRefs.length)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'};
 const score=SCORES[o.responseCode];
 // NO_MEANINGFUL_REPAIR_OPPORTUNITY, TOO_EPISODE_DEPENDENT_TO_RATE, and
 // NOT_SURE are UNASSESSED, never zero: a relationship with no meaningful
 // rupture to repair, episode-dependent repair, or an unconfident report is
 // missing basis - never good repair, never poor repair, and never a
 // midpoint.
 if(score===undefined)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 return{...base,resultState:'ASSESSED',numericValue:score,contradictionState:'NONE'};
}
