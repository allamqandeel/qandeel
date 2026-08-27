import { BadRequestException } from '@nestjs/common';
import type { HimCalculationModel,HimMetricCalculationInput,HimMetricCalculationResult } from './him-calculation.types';

// HGS Self-Awareness v1 is a narrow, target-bound current perceived
// self-understanding clarity appraisal: in ONE exact GOAL or SITUATION, how
// clearly the user currently feels able to recognize and distinguish the
// internal experiences and personal drivers that matter here - such as
// feelings, needs, motives, values, assumptions, or limits - and understand
// how those are shaping their own choices or behavior in this context. The
// measured object is the user's CURRENT PERCEIVED self-understanding
// clarity - a context-specific appraisal of perceived clarity, never
// verified truth. It is NOT hbs.reflection (the deliberate reflective
// PROCESS), amount of introspection, rumination/overthinking, intelligence
// or wisdom, objective insight accuracy, global identity/self-concept
// clarity, a stable personality trait, emotional intelligence, mindfulness,
// self-esteem, hse.self-confidence, Motivation, behavior change or growth
// achieved, or a therapy/diagnosis construct - direct structured
// self-report only. A higher score means only greater self-reported current
// clarity about oneself in the exact context - never proof the explanation
// is accurate, that hidden motives were identified correctly, that the user
// is wiser, or that growth occurred. HGS ownership does not automatically
// mean longitudinal growth: no growth trajectory, growth percentage, or
// before/after delta exists in this contract. High Reflection may coexist
// with low Self-Awareness (much deliberate examination, still murky
// inside), and low Reflection with high Self-Awareness (little deliberate
// examination, yet currently clear): no formula or constraint forces the
// two to correlate, and the same holds for Motivation and Self-Confidence -
// every such combination stays expressible with no inverse, composite, or
// sibling-derived value. When self-understanding is too uneven across
// facets (feelings, motives, values, assumptions, limits) for one scalar,
// TOO_FACET_DEPENDENT_TO_RATE fails to UNASSESSED instead of collapsing
// facets into one misleading scalar (no Self-Awareness subscales exist in
// v1 and nothing is averaged), and INSUFFICIENT_BASIS_TO_JUDGE fails to
// UNASSESSED when the context is too new or unclear or meaningful internal
// reactions have not emerged enough to judge current clarity - missing
// basis, neither high nor low self-awareness, never zero. Exactly like the
// HRS metrics (and unlike the seven-day HBS trio) there is NO temporal
// window of any kind in this contract: no windowStart/windowEnd fields
// exist, and any smuggled window input is rejected. Foundation semantic
// mapping deliberately stays UNRESOLVED (semanticType null; the construct
// is not force-mapped to CAPABILITY merely because it sounds like an
// ability, and no SELF_AWARENESS or GROWTH semantic type exists).
export const HGS_SELF_AWARENESS_MODEL_ID='hgs.self-awareness.direct-structured-current-self-understanding-clarity';
export const HGS_SELF_AWARENESS_MODEL_VERSION=1;
export const HGS_SELF_AWARENESS_INSTRUMENT_ID='hgs.self-awareness.direct-target-bound-self-understanding-clarity-report';
export const HGS_SELF_AWARENESS_SCALE_REFERENCE='hgs.self-awareness.clarity-5.v1';
export const HGS_SELF_AWARENESS_RESPONSES=['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_FACET_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'] as const;
type Response=(typeof HGS_SELF_AWARENESS_RESPONSES)[number];
export interface HgsSelfAwarenessObservation {
 observationId:string;measurementEventId:string;userId:string;metricKey:'hgs.self-awareness';definitionVersion:1;
 contextKind:'GOAL'|'SITUATION';contextId:string;target:string;targetContextKind:'GOAL'|'SITUATION';targetContextId:string;
 instrumentId:typeof HGS_SELF_AWARENESS_INSTRUMENT_ID;instrumentVersion:1;scaleContractReference:typeof HGS_SELF_AWARENESS_SCALE_REFERENCE;scaleVersion:1;
 responseCode:Response;reportTimestamp:string;
 source:'DIRECT_STRUCTURED_USER_REPORT';superseded:boolean;
}
export const HGS_SELF_AWARENESS_MODEL=Object.freeze<HimCalculationModel>({
 modelId:HGS_SELF_AWARENESS_MODEL_ID,modelVersion:1,targetMetricKey:'hgs.self-awareness',targetDefinitionVersion:1,lifecycle:'CALIBRATED',environment:'PRODUCTION',
 canonicalOwner:'QANDEEL_HIM_GOVERNANCE',canonicalSource:'HIM_EXPANSION_HGS_SELF_AWARENESS_MEASUREMENT_MODEL_V1',methodType:'DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_SELF_UNDERSTANDING_CLARITY_REPORT',
 scaleContractReference:HGS_SELF_AWARENESS_SCALE_REFERENCE,requiredInputKeys:['observation'],requiredEvidenceContract:'FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
 supportedContextKinds:['GOAL','SITUATION'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',
 confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',implementationId:'hgs-self-awareness-direct-structured-target-bound-v1',createdAt:'2026-08-27T00:00:00.000Z',versionedAt:'2026-08-27T00:00:00.000Z',
});
const SCORES:Readonly<Partial<Record<Response,number>>>=Object.freeze({VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5});
export function calculateHgsSelfAwareness(input:HimMetricCalculationInput):HimMetricCalculationResult{
 const o=input.inputs.observation as HgsSelfAwarenessObservation|undefined;
 const base={metricKey:input.metricKey,definitionVersion:input.definitionVersion,modelId:input.modelId,modelVersion:input.modelVersion,context:{...input.context},missingInputKeys:o?[]:['observation'],supportingEvidenceRefs:[...input.supportingEvidenceRefs],contradictoryEvidenceRefs:[...input.contradictoryEvidenceRefs],calculatedAt:new Date().toISOString(),provenance:input.provenance,confidenceState:'UNASSESSED' as const,confidenceReference:null,traceId:input.traceId,updateReason:input.updateReason};
 if(!o)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 if(!['GOAL','SITUATION'].includes(input.context.kind)||o.contextKind!==input.context.kind||o.contextId!==input.context.id)throw new BadRequestException('Self-Awareness exact context mismatch.');
 // A Self-Awareness observation always carries the exact server-derived
 // owned GOAL/SITUATION target shape: the bounded trimmed label and the
 // target kind/ID equal to the context. The label is verified as an opaque
 // binding artifact only - its meaning is never interpreted.
 if(o.targetContextKind!==o.contextKind||o.targetContextId!==o.contextId||typeof o.target!=='string'||o.target.trim()!==o.target||!o.target.length||o.target.length>256)throw new BadRequestException('Self-Awareness exact GOAL/SITUATION target mismatch.');
 if(o.metricKey!=='hgs.self-awareness'||o.definitionVersion!==1||o.instrumentId!==HGS_SELF_AWARENESS_INSTRUMENT_ID||o.instrumentVersion!==1||o.scaleContractReference!==HGS_SELF_AWARENESS_SCALE_REFERENCE||o.scaleVersion!==1||o.source!=='DIRECT_STRUCTURED_USER_REPORT'||!Number.isFinite(Date.parse(o.reportTimestamp))||!HGS_SELF_AWARENESS_RESPONSES.includes(o.responseCode))throw new BadRequestException('Self-Awareness observation contract mismatch.');
 // Self-Awareness is an at-report target-bound appraisal: no
 // temporal-window input exists in this contract, and a smuggled
 // seven/14/30-day window (or any caller-selected window) is rejected
 // rather than interpreted - HGS ownership never implies a growth
 // trajectory or before/after delta.
 if('windowStart' in o||'windowEnd' in o)throw new BadRequestException('Self-Awareness observation must not carry a temporal window.');
 if(o.superseded)throw new BadRequestException('Superseded Self-Awareness observation cannot be calculated.');
 if(input.contradictoryEvidenceRefs.length)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'};
 const score=SCORES[o.responseCode];
 // TOO_FACET_DEPENDENT_TO_RATE, INSUFFICIENT_BASIS_TO_JUDGE, and NOT_SURE
 // are UNASSESSED, never zero: facet-uneven self-understanding, a context
 // too new for meaningful internal reactions, or an unconfident report is
 // missing data - neither low nor high self-awareness, and never a
 // midpoint.
 if(score===undefined)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 return{...base,resultState:'ASSESSED',numericValue:score,contradictionState:'NONE'};
}
