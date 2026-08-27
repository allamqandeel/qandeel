import { BadRequestException } from '@nestjs/common';
import type { HimCalculationModel,HimMetricCalculationInput,HimMetricCalculationResult } from './him-calculation.types';

// HGS Habit Strength v1 is a narrow, target-bound current perceived
// cue-linked-automaticity appraisal of a specific recurring action/routine:
// in ONE exact GOAL or SITUATION, based on sufficient repeated experience
// with the relevant recurring action, how strongly the user currently
// experiences starting or carrying out that action as tending to happen
// automatically when its familiar cue or circumstances occur, with less
// need for a fresh deliberate decision at the moment of action. The core
// object is current perceived cue -> action automaticity. It is NOT HBS
// Consistency, behavior frequency, seven-day follow-through, HBS
// Initiative, willingness to start, hse.motivation, Purpose Alignment,
// Self-Awareness, Resilience, Avoidance, discipline, willpower, grit,
// persistence, commitment, routine scheduling, reminder use, environmental
// convenience, skill/proficiency, speed, ease because the action is
// objectively easy, identity ("this is who I am"), preference/enjoyment,
// craving, compulsion, addiction, inability to stop, pathology, goal
// success/progress, or a global personality trait - direct structured
// self-report only. A higher score means only greater self-reported
// current cue-linked automaticity for the specific recurring action in
// this exact target - never proof the behavior is beneficial, aligned,
// healthy, should continue, that the goal will succeed, or that the user
// lacks control - and a lower score means only lower perceived
// automaticity, never weak character, poor discipline, or failure.
// The mandatory Consistency boundary: Consistency asks "How consistently
// did I do it?" over a fixed seven-day window; Habit Strength asks "How
// automatic has doing it become when the cue/context appears?" with a NULL
// window. High Consistency with low Habit Strength stays fully expressible
// (reliable follow-through through deliberate effort each time), and low
// Consistency with high Habit Strength stays fully expressible (an
// established cue-response association whose cue/opportunity was disrupted
// this week). Neither is derived from the other, no Consistency threshold
// gates this metric, and no frequency -> automaticity conversion exists.
// High Motivation with low Habit Strength, low Motivation with high Habit
// Strength, high Initiative with low Habit Strength, low Initiative with
// high Habit Strength, and every Purpose Alignment / Self-Awareness /
// Resilience combination stay expressible with no inverse, composite, or
// sibling-derived value. The measurement basis is sufficient repeated
// experience, never a hypothetical projection and never an inferred
// history: INSUFFICIENT_REPETITION_HISTORY_TO_JUDGE fails to UNASSESSED
// when the recurring action is too new or insufficiently repeated to judge
// automaticity (insufficient basis, NOT low Habit Strength),
// NO_SINGLE_RECURRING_PATTERN_TO_RATE fails to UNASSESSED when the exact
// target does not support one sufficiently clear recurring action/routine
// for a single scalar appraisal (the behavior is never inferred or chosen
// from the target label, and no behavior classifier, habit graph, or
// behavior ontology exists), and TOO_CUE_DEPENDENT_TO_RATE fails to
// UNASSESSED when the action is highly automatic under one familiar cue
// but strongly deliberate under another (cue conditions are never averaged
// and no cue subdomain exists in v1). Exactly like the HRS metrics,
// Self-Awareness, Resilience, and Purpose Alignment (and unlike the
// seven-day HBS trio) there is NO temporal window of any kind in this
// contract: no windowStart/windowEnd fields exist, and any smuggled window
// input is rejected - repeated history is a basis requirement, not a
// scored temporal window, so no streak, repetition count, days-to-habit,
// time-to-automaticity, or habit-formation curve exists. Foundation
// semantic mapping deliberately stays UNRESOLVED (semanticType null; no
// forced TRAIT/CAPABILITY/STATE/PROGRESS/READINESS mapping and no invented
// HABIT/AUTOMATICITY/ROUTINE semantic type exists).
export const HGS_HABIT_STRENGTH_MODEL_ID='hgs.habit-strength.direct-structured-current-cue-linked-automaticity';
export const HGS_HABIT_STRENGTH_MODEL_VERSION=1;
export const HGS_HABIT_STRENGTH_INSTRUMENT_ID='hgs.habit-strength.direct-target-bound-cue-linked-automaticity-report';
export const HGS_HABIT_STRENGTH_SCALE_REFERENCE='hgs.habit-strength.automaticity-5.v1';
export const HGS_HABIT_STRENGTH_RESPONSES=['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','INSUFFICIENT_REPETITION_HISTORY_TO_JUDGE','NO_SINGLE_RECURRING_PATTERN_TO_RATE','TOO_CUE_DEPENDENT_TO_RATE','NOT_SURE'] as const;
type Response=(typeof HGS_HABIT_STRENGTH_RESPONSES)[number];
export interface HgsHabitStrengthObservation {
 observationId:string;measurementEventId:string;userId:string;metricKey:'hgs.habit-strength';definitionVersion:1;
 contextKind:'GOAL'|'SITUATION';contextId:string;target:string;targetContextKind:'GOAL'|'SITUATION';targetContextId:string;
 instrumentId:typeof HGS_HABIT_STRENGTH_INSTRUMENT_ID;instrumentVersion:1;scaleContractReference:typeof HGS_HABIT_STRENGTH_SCALE_REFERENCE;scaleVersion:1;
 responseCode:Response;reportTimestamp:string;
 source:'DIRECT_STRUCTURED_USER_REPORT';superseded:boolean;
}
export const HGS_HABIT_STRENGTH_MODEL=Object.freeze<HimCalculationModel>({
 modelId:HGS_HABIT_STRENGTH_MODEL_ID,modelVersion:1,targetMetricKey:'hgs.habit-strength',targetDefinitionVersion:1,lifecycle:'CALIBRATED',environment:'PRODUCTION',
 canonicalOwner:'QANDEEL_HIM_GOVERNANCE',canonicalSource:'HIM_EXPANSION_HGS_HABIT_STRENGTH_MEASUREMENT_MODEL_V1',methodType:'DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_CUE_LINKED_AUTOMATICITY_REPORT',
 scaleContractReference:HGS_HABIT_STRENGTH_SCALE_REFERENCE,requiredInputKeys:['observation'],requiredEvidenceContract:'FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
 supportedContextKinds:['GOAL','SITUATION'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',
 confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',implementationId:'hgs-habit-strength-direct-structured-target-bound-v1',createdAt:'2026-08-27T00:00:00.000Z',versionedAt:'2026-08-27T00:00:00.000Z',
});
const SCORES:Readonly<Partial<Record<Response,number>>>=Object.freeze({VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5});
export function calculateHgsHabitStrength(input:HimMetricCalculationInput):HimMetricCalculationResult{
 const o=input.inputs.observation as HgsHabitStrengthObservation|undefined;
 const base={metricKey:input.metricKey,definitionVersion:input.definitionVersion,modelId:input.modelId,modelVersion:input.modelVersion,context:{...input.context},missingInputKeys:o?[]:['observation'],supportingEvidenceRefs:[...input.supportingEvidenceRefs],contradictoryEvidenceRefs:[...input.contradictoryEvidenceRefs],calculatedAt:new Date().toISOString(),provenance:input.provenance,confidenceState:'UNASSESSED' as const,confidenceReference:null,traceId:input.traceId,updateReason:input.updateReason};
 if(!o)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 if(!['GOAL','SITUATION'].includes(input.context.kind)||o.contextKind!==input.context.kind||o.contextId!==input.context.id)throw new BadRequestException('Habit Strength exact context mismatch.');
 // A Habit Strength observation always carries the exact server-derived
 // owned GOAL/SITUATION target shape: the bounded trimmed label and the
 // target kind/ID equal to the context. The label is verified as an
 // opaque binding artifact only - its meaning is never interpreted, and
 // the recurring action being rated is never inferred from it.
 if(o.targetContextKind!==o.contextKind||o.targetContextId!==o.contextId||typeof o.target!=='string'||o.target.trim()!==o.target||!o.target.length||o.target.length>256)throw new BadRequestException('Habit Strength exact GOAL/SITUATION target mismatch.');
 if(o.metricKey!=='hgs.habit-strength'||o.definitionVersion!==1||o.instrumentId!==HGS_HABIT_STRENGTH_INSTRUMENT_ID||o.instrumentVersion!==1||o.scaleContractReference!==HGS_HABIT_STRENGTH_SCALE_REFERENCE||o.scaleVersion!==1||o.source!=='DIRECT_STRUCTURED_USER_REPORT'||!Number.isFinite(Date.parse(o.reportTimestamp))||!HGS_HABIT_STRENGTH_RESPONSES.includes(o.responseCode))throw new BadRequestException('Habit Strength observation contract mismatch.');
 // Habit Strength is an at-report target-bound appraisal grounded in
 // sufficient prior repetition: no temporal-window input exists in this
 // contract, and a smuggled seven/30-day period, streak window,
 // habit-formation interval, or any caller-selected window is rejected
 // rather than interpreted - repeated history is a basis requirement, not
 // a scored temporal window, and the metric never encodes a repetition
 // count, days-to-habit, or time-to-automaticity reading.
 if('windowStart' in o||'windowEnd' in o)throw new BadRequestException('Habit Strength observation must not carry a temporal window.');
 if(o.superseded)throw new BadRequestException('Superseded Habit Strength observation cannot be calculated.');
 if(input.contradictoryEvidenceRefs.length)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'};
 const score=SCORES[o.responseCode];
 // INSUFFICIENT_REPETITION_HISTORY_TO_JUDGE,
 // NO_SINGLE_RECURRING_PATTERN_TO_RATE, TOO_CUE_DEPENDENT_TO_RATE, and
 // NOT_SURE are UNASSESSED, never zero: an action too new or too rarely
 // repeated to judge has no valid automaticity basis (insufficient basis
 // is not low Habit Strength), a target without one sufficiently clear
 // recurring action/routine is never averaged into a single scalar (and
 // the behavior is never chosen for the user), cue-uneven automaticity is
 // never averaged across cue conditions, and an unconfident report is
 // missing data - neither low nor high automaticity, and never a
 // midpoint.
 if(score===undefined)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
 return{...base,resultState:'ASSESSED',numericValue:score,contradictionState:'NONE'};
}
