import { BadRequestException } from '@nestjs/common';
import type { HimCalculationModel,HimMetricCalculationInput,HimMetricCalculationResult } from './him-calculation.types';

// HGS Purpose Alignment v1 is a narrow, goal-bound current perceived
// purpose-congruence appraisal: for ONE exact GOAL, how well pursuing that
// goal currently fits with what the user genuinely regards as important,
// personally meaningful, and worth standing for or moving toward -
// including their endorsed values, priorities, and sense of desired life
// direction - rather than merely whether the goal is urgent, rewarding,
// expected, socially approved, or easy to pursue. The core object is
// person <-> goal congruence of meaning/direction. It is NOT
// hse.motivation, desire intensity, excitement, energy, effort,
// engagement, commitment, persistence/grit, HBS Consistency or Initiative,
// Habit Strength, goal progress or attainment, feasibility or likelihood
// of success, self-efficacy/hse.self-confidence, Self-Awareness,
// Resilience, goal importance alone, urgency or external consequences,
// social/family approval, status/prestige/financial reward, moral
// correctness, ethical/legal/safety approval, GLOBAL life purpose, purpose
// clarity, identity certainty, or a clinical/diagnostic construct - direct
// structured self-report only. A higher score means only greater
// self-reported current congruence between this exact GOAL and the user's
// personally meaningful values/priorities/direction - never proof the goal
// is objectively wise, morally good, safe, legal, recommended, likely to
// succeed, or wellbeing-enhancing - and a lower score never proves the
// goal must be abandoned. External pressure is NOT automatically
// misalignment (an externally expected goal may be genuinely endorsed) and
// intrinsic enjoyment is NOT automatically high alignment: the metric asks
// directly for perceived congruence and never infers alignment from
// intrinsic/identified/introjected/external motive categories or any
// weighted autonomous-motivation formula. High Motivation may coexist with
// low Purpose Alignment (strongly driven toward a goal that no longer fits
// what matters), low Motivation with high Purpose Alignment (deeply
// "mine", currently depleted), and every
// Self-Awareness/Resilience/Consistency combination stays expressible with
// no inverse, composite, or sibling-derived value.
// TOO_VALUE_CONFLICTED_TO_RATE fails to UNASSESSED when one goal strongly
// serves one important value while materially conflicting with another
// (one scalar would erase a material conflict - values are never averaged,
// weighted, or ranked into a hierarchy, and no value subdomain exists in
// v1), and INSUFFICIENT_PERSONAL_DIRECTION_BASIS_TO_JUDGE fails to
// UNASSESSED when the user does not currently have enough basis to judge
// alignment because the relevant values/priorities/direction are not clear
// enough - NOT automatically low alignment and no dependency on
// Self-Awareness: the user directly reports whether there is enough basis.
// Exactly like the HRS metrics, Self-Awareness, and Resilience (and unlike
// the seven-day HBS trio) there is NO temporal window of any kind in this
// contract: no windowStart/windowEnd fields exist, and any smuggled window
// input is rejected. The Foundation semantic mapping is ALREADY RESOLVED
// and preserved exactly: hifOwner HGS, semanticMappingStatus RESOLVED,
// semanticType ALIGNMENT - never downgraded to UNRESOLVED/null, never
// remapped to STATE/TRAIT/CAPABILITY/READINESS/PROGRESS, and no PURPOSE or
// VALUES semantic type is invented. RESOLVED/ALIGNMENT does not make this
// metric eligible for Trend v1 or Intelligence Snapshot v1 - both stay
// five-HSE only.
export const HGS_PURPOSE_ALIGNMENT_MODEL_ID='hgs.purpose-alignment.direct-structured-current-purpose-congruence';
export const HGS_PURPOSE_ALIGNMENT_MODEL_VERSION=1;
export const HGS_PURPOSE_ALIGNMENT_INSTRUMENT_ID='hgs.purpose-alignment.direct-goal-bound-purpose-congruence-report';
export const HGS_PURPOSE_ALIGNMENT_SCALE_REFERENCE='hgs.purpose-alignment.congruence-5.v1';
export const HGS_PURPOSE_ALIGNMENT_RESPONSES=['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_VALUE_CONFLICTED_TO_RATE','INSUFFICIENT_PERSONAL_DIRECTION_BASIS_TO_JUDGE','NOT_SURE'] as const;
type Response=(typeof HGS_PURPOSE_ALIGNMENT_RESPONSES)[number];
export interface HgsPurposeAlignmentObservation {
 observationId:string;measurementEventId:string;userId:string;metricKey:'hgs.purpose-alignment';definitionVersion:1;
 contextKind:'GOAL';contextId:string;target:string;targetContextKind:'GOAL';targetContextId:string;
 instrumentId:typeof HGS_PURPOSE_ALIGNMENT_INSTRUMENT_ID;instrumentVersion:1;scaleContractReference:typeof HGS_PURPOSE_ALIGNMENT_SCALE_REFERENCE;scaleVersion:1;
 responseCode:Response;reportTimestamp:string;
 source:'DIRECT_STRUCTURED_USER_REPORT';superseded:boolean;
}
export const HGS_PURPOSE_ALIGNMENT_MODEL=Object.freeze<HimCalculationModel>({
 modelId:HGS_PURPOSE_ALIGNMENT_MODEL_ID,modelVersion:1,targetMetricKey:'hgs.purpose-alignment',targetDefinitionVersion:1,lifecycle:'CALIBRATED',environment:'PRODUCTION',
 canonicalOwner:'QANDEEL_HIM_GOVERNANCE',canonicalSource:'HIM_EXPANSION_HGS_PURPOSE_ALIGNMENT_MEASUREMENT_MODEL_V1',methodType:'DIRECT_STRUCTURED_GOAL_BOUND_CURRENT_PURPOSE_CONGRUENCE_REPORT',
 scaleContractReference:HGS_PURPOSE_ALIGNMENT_SCALE_REFERENCE,requiredInputKeys:['observation'],requiredEvidenceContract:'FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
 supportedContextKinds:['GOAL'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',
 confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',implementationId:'hgs-purpose-alignment-direct-structured-goal-bound-v1',createdAt:'2026-08-27T00:00:00.000Z',versionedAt:'2026-08-27T00:00:00.000Z',
});
const SCORES:Readonly<Partial<Record<Response,number>>>=Object.freeze({VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5});
export function calculateHgsPurposeAlignment(input:HimMetricCalculationInput):HimMetricCalculationResult{
 const o=input.inputs.observation as HgsPurposeAlignmentObservation|undefined;
 const base={metricKey:input.metricKey,definitionVersion:input.definitionVersion,modelId:input.modelId,modelVersion:input.modelVersion,context:{...input.context},missingInputKeys:o?[]:['observation'],supportingEvidenceRefs:[...input.supportingEvidenceRefs],contradictoryEvidenceRefs:[...input.contradictoryEvidenceRefs],calculatedAt:new Date().toISOString(),provenance:input.provenance,confidenceState:'UNASSESSED' as const,confidenceReference:null,traceId:input.traceId,updateReason:input.updateReason};
 if(!o)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 if(input.context.kind!=='GOAL'||o.contextKind!==input.context.kind||o.contextId!==input.context.id)throw new BadRequestException('Purpose Alignment exact context mismatch.');
 // A Purpose Alignment observation always carries the exact server-derived
 // owned GOAL target shape: the bounded trimmed label and the target
 // kind/ID equal to the context. The label is verified as an opaque
 // binding artifact only - its meaning is never interpreted, and no
 // alignment is ever inferred from it.
 if(o.targetContextKind!==o.contextKind||o.targetContextId!==o.contextId||typeof o.target!=='string'||o.target.trim()!==o.target||!o.target.length||o.target.length>256)throw new BadRequestException('Purpose Alignment exact GOAL target mismatch.');
 if(o.metricKey!=='hgs.purpose-alignment'||o.definitionVersion!==1||o.instrumentId!==HGS_PURPOSE_ALIGNMENT_INSTRUMENT_ID||o.instrumentVersion!==1||o.scaleContractReference!==HGS_PURPOSE_ALIGNMENT_SCALE_REFERENCE||o.scaleVersion!==1||o.source!=='DIRECT_STRUCTURED_USER_REPORT'||!Number.isFinite(Date.parse(o.reportTimestamp))||!HGS_PURPOSE_ALIGNMENT_RESPONSES.includes(o.responseCode))throw new BadRequestException('Purpose Alignment observation contract mismatch.');
 // Purpose Alignment is an at-report goal-bound congruence appraisal: no
 // temporal-window input exists in this contract, and a smuggled
 // retrospective period, goal-progress delta, or before/after values
 // window is rejected rather than interpreted - the metric never encodes
 // a period, a growth trajectory, or a values-drift reading.
 if('windowStart' in o||'windowEnd' in o)throw new BadRequestException('Purpose Alignment observation must not carry a temporal window.');
 if(o.superseded)throw new BadRequestException('Superseded Purpose Alignment observation cannot be calculated.');
 if(input.contradictoryEvidenceRefs.length)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'};
 const score=SCORES[o.responseCode];
 // TOO_VALUE_CONFLICTED_TO_RATE, INSUFFICIENT_PERSONAL_DIRECTION_BASIS_TO_JUDGE,
 // and NOT_SURE are UNASSESSED, never zero: a goal that strongly serves
 // one important value while materially conflicting with another is never
 // averaged into one scalar, a user without enough personal-direction
 // basis to judge is missing data (not automatically low alignment), and
 // an unconfident report is neither low nor high alignment - and never a
 // midpoint.
 if(score===undefined)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 return{...base,resultState:'ASSESSED',numericValue:score,contradictionState:'NONE'};
}
