import { BadRequestException } from '@nestjs/common';
import type { HimCalculationModel,HimMetricCalculationInput,HimMetricCalculationResult } from './him-calculation.types';

// HGS Resilience v1 is a narrow, target-bound current perceived adaptive
// recovery/continuity appraisal under EXPERIENCED challenge: in ONE exact
// GOAL or SITUATION where the user has actually faced meaningful
// difficulty, setback, disruption, or sustained challenge, how well the
// user currently judges they have been able to maintain or regain workable
// functioning and adapt their approach enough to continue engaging with
// what matters in that context. The core object is adaptive functioning
// after or during ACTUAL challenge - never hypothetical toughness - and
// both maintaining workable functioning despite challenge and regaining it
// after disruption count; returning to exactly how things were before is
// never required and adaptation may involve changing approach. It is NOT
// the absence of stress/distress, low hse.stress, emotional numbness,
// stoicism, "being strong", a toughness identity, optimism, positive mood,
// hse.motivation, hse.self-confidence, HBS Consistency, Initiative, or
// Avoidance, Habit Strength, persistence/grit, continuing rigidly at all
// costs, success of the GOAL, achievement/performance, recovery speed,
// instant "bouncing back", post-traumatic growth, clinical recovery, a
// trauma diagnosis/outcome, HRS Repair, a global personality trait, or a
// prediction of future adversity handling - direct structured self-report
// only. A higher score means only greater self-reported current adaptive
// continuity/recovery in the exact challenged context - never proof of
// absent pain, healthy coping in every respect, goal success, better
// character, greater worth, future resilience, or clinical recovery - and
// a lower score means only greater reported current disruption, never
// pathology, weakness, failure, or diagnosis. High Resilience may coexist
// with high Stress (still distressed, yet functioning workably), high
// Self-Awareness may coexist with low Resilience (clear inside, not yet
// adapted), and every Motivation/Self-Confidence/Consistency combination
// stays expressible with no inverse, composite, or sibling-derived value.
// The measurement basis is actual challenge:
// NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE fails to UNASSESSED when the target
// has not yet involved meaningful difficulty (no adversity is NOT high
// resilience), TOO_EARLY_TO_JUDGE_ADAPTATION fails to UNASSESSED when the
// user is still inside the immediate disruption (not low resilience by
// default), and TOO_CHALLENGE_DEPENDENT_TO_RATE fails to UNASSESSED when
// adaptation differs materially across challenge kinds (challenge types
// are never averaged and no resilience subdomains exist in v1). Exactly
// like the HRS metrics and Self-Awareness (and unlike the seven-day HBS
// trio) there is NO temporal window of any kind in this contract: no
// windowStart/windowEnd fields exist, and any smuggled window input is
// rejected. Foundation semantic mapping deliberately stays UNRESOLVED
// (semanticType null; no forced CAPABILITY/TRAIT/STATE/PROGRESS/READINESS
// mapping and no invented RESILIENCE or GROWTH semantic type exists).
export const HGS_RESILIENCE_MODEL_ID='hgs.resilience.direct-structured-current-adaptive-recovery';
export const HGS_RESILIENCE_MODEL_VERSION=1;
export const HGS_RESILIENCE_INSTRUMENT_ID='hgs.resilience.direct-target-bound-adaptive-recovery-report';
export const HGS_RESILIENCE_SCALE_REFERENCE='hgs.resilience.adaptive-recovery-5.v1';
export const HGS_RESILIENCE_RESPONSES=['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE','TOO_EARLY_TO_JUDGE_ADAPTATION','TOO_CHALLENGE_DEPENDENT_TO_RATE','NOT_SURE'] as const;
type Response=(typeof HGS_RESILIENCE_RESPONSES)[number];
export interface HgsResilienceObservation {
 observationId:string;measurementEventId:string;userId:string;metricKey:'hgs.resilience';definitionVersion:1;
 contextKind:'GOAL'|'SITUATION';contextId:string;target:string;targetContextKind:'GOAL'|'SITUATION';targetContextId:string;
 instrumentId:typeof HGS_RESILIENCE_INSTRUMENT_ID;instrumentVersion:1;scaleContractReference:typeof HGS_RESILIENCE_SCALE_REFERENCE;scaleVersion:1;
 responseCode:Response;reportTimestamp:string;
 source:'DIRECT_STRUCTURED_USER_REPORT';superseded:boolean;
}
export const HGS_RESILIENCE_MODEL=Object.freeze<HimCalculationModel>({
 modelId:HGS_RESILIENCE_MODEL_ID,modelVersion:1,targetMetricKey:'hgs.resilience',targetDefinitionVersion:1,lifecycle:'CALIBRATED',environment:'PRODUCTION',
 canonicalOwner:'QANDEEL_HIM_GOVERNANCE',canonicalSource:'HIM_EXPANSION_HGS_RESILIENCE_MEASUREMENT_MODEL_V1',methodType:'DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_ADAPTIVE_RECOVERY_REPORT',
 scaleContractReference:HGS_RESILIENCE_SCALE_REFERENCE,requiredInputKeys:['observation'],requiredEvidenceContract:'FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
 supportedContextKinds:['GOAL','SITUATION'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',
 confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',implementationId:'hgs-resilience-direct-structured-target-bound-v1',createdAt:'2026-08-27T00:00:00.000Z',versionedAt:'2026-08-27T00:00:00.000Z',
});
const SCORES:Readonly<Partial<Record<Response,number>>>=Object.freeze({VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5});
export function calculateHgsResilience(input:HimMetricCalculationInput):HimMetricCalculationResult{
 const o=input.inputs.observation as HgsResilienceObservation|undefined;
 const base={metricKey:input.metricKey,definitionVersion:input.definitionVersion,modelId:input.modelId,modelVersion:input.modelVersion,context:{...input.context},missingInputKeys:o?[]:['observation'],supportingEvidenceRefs:[...input.supportingEvidenceRefs],contradictoryEvidenceRefs:[...input.contradictoryEvidenceRefs],calculatedAt:new Date().toISOString(),provenance:input.provenance,confidenceState:'UNASSESSED' as const,confidenceReference:null,traceId:input.traceId,updateReason:input.updateReason};
 if(!o)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 if(!['GOAL','SITUATION'].includes(input.context.kind)||o.contextKind!==input.context.kind||o.contextId!==input.context.id)throw new BadRequestException('Resilience exact context mismatch.');
 // A Resilience observation always carries the exact server-derived owned
 // GOAL/SITUATION target shape: the bounded trimmed label and the target
 // kind/ID equal to the context. The label is verified as an opaque
 // binding artifact only - its meaning is never interpreted, and no
 // adversity is ever inferred from it.
 if(o.targetContextKind!==o.contextKind||o.targetContextId!==o.contextId||typeof o.target!=='string'||o.target.trim()!==o.target||!o.target.length||o.target.length>256)throw new BadRequestException('Resilience exact GOAL/SITUATION target mismatch.');
 if(o.metricKey!=='hgs.resilience'||o.definitionVersion!==1||o.instrumentId!==HGS_RESILIENCE_INSTRUMENT_ID||o.instrumentVersion!==1||o.scaleContractReference!==HGS_RESILIENCE_SCALE_REFERENCE||o.scaleVersion!==1||o.source!=='DIRECT_STRUCTURED_USER_REPORT'||!Number.isFinite(Date.parse(o.reportTimestamp))||!HGS_RESILIENCE_RESPONSES.includes(o.responseCode))throw new BadRequestException('Resilience observation contract mismatch.');
 // Resilience is an at-report target-bound appraisal grounded in actually
 // experienced challenge: no temporal-window input exists in this
 // contract, and a smuggled seven/30-day recovery period (or any
 // caller-selected window) is rejected rather than interpreted - the
 // metric never encodes a retrospective period, time-to-recovery, or
 // growth trajectory.
 if('windowStart' in o||'windowEnd' in o)throw new BadRequestException('Resilience observation must not carry a temporal window.');
 if(o.superseded)throw new BadRequestException('Superseded Resilience observation cannot be calculated.');
 if(input.contradictoryEvidenceRefs.length)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'};
 const score=SCORES[o.responseCode];
 // NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE, TOO_EARLY_TO_JUDGE_ADAPTATION,
 // TOO_CHALLENGE_DEPENDENT_TO_RATE, and NOT_SURE are UNASSESSED, never
 // zero: a target without meaningful adversity has no valid basis to
 // assess resilience (no adversity is not high resilience), an immediate
 // post-setback disruption is not low resilience by default,
 // challenge-uneven adaptation is never averaged into one scalar, and an
 // unconfident report is missing data - neither low nor high resilience,
 // and never a midpoint.
 if(score===undefined)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 return{...base,resultState:'ASSESSED',numericValue:score,contradictionState:'NONE'};
}
