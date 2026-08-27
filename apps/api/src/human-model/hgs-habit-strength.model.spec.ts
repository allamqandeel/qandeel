import { BadRequestException } from '@nestjs/common';
import { calculateHgsHabitStrength,HGS_HABIT_STRENGTH_MODEL,type HgsHabitStrengthObservation } from './hgs-habit-strength.model';
import type { HimMetricCalculationInput } from './him-calculation.types';

const REPORT='2026-08-27T12:00:00.000Z';
const GOAL='35000000-0000-4000-8000-000000000001';
const SITUATION='35000000-0000-4000-8000-000000000002';
const observation=(overrides:Partial<HgsHabitStrengthObservation>={}):HgsHabitStrengthObservation=>({
 observationId:'obs-1',measurementEventId:'event-1',userId:'user-1',metricKey:'hgs.habit-strength',definitionVersion:1,
 contextKind:'GOAL',contextId:GOAL,target:'run every morning',targetContextKind:'GOAL',targetContextId:GOAL,
 instrumentId:'hgs.habit-strength.direct-target-bound-cue-linked-automaticity-report',instrumentVersion:1,scaleContractReference:'hgs.habit-strength.automaticity-5.v1',scaleVersion:1,
 responseCode:'MODERATE',reportTimestamp:REPORT,
 source:'DIRECT_STRUCTURED_USER_REPORT',superseded:false,...overrides,
});
const situationObservation=(overrides:Partial<HgsHabitStrengthObservation>={}):HgsHabitStrengthObservation=>observation({contextKind:'SITUATION',contextId:SITUATION,target:'arriving at the office',targetContextKind:'SITUATION',targetContextId:SITUATION,...overrides});
const input=(o?:HgsHabitStrengthObservation,overrides:Partial<HimMetricCalculationInput>={}):HimMetricCalculationInput=>({
 metricKey:'hgs.habit-strength',definitionVersion:1,modelId:HGS_HABIT_STRENGTH_MODEL.modelId,modelVersion:1,
 context:{kind:o?.contextKind??'GOAL',id:o?.contextId??GOAL},inputs:o?{observation:o}:{},
 supportingEvidenceRefs:[],contradictoryEvidenceRefs:[],provenance:'QANDEEL_HIM_CALCULATION_RUNTIME_V1',traceId:'trace-1',updateReason:'DIRECT_STRUCTURED_USER_REPORT',...overrides,
});

describe('HGS Habit Strength measurement model v1',()=>{
 it('freezes the exact calibrated target-bound at-report model identity with no temporal window',()=>{
  expect(HGS_HABIT_STRENGTH_MODEL).toMatchObject({
   modelId:'hgs.habit-strength.direct-structured-current-cue-linked-automaticity',modelVersion:1,targetMetricKey:'hgs.habit-strength',targetDefinitionVersion:1,
   lifecycle:'CALIBRATED',environment:'PRODUCTION',canonicalOwner:'QANDEEL_HIM_GOVERNANCE',
   methodType:'DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_CUE_LINKED_AUTOMATICITY_REPORT',scaleContractReference:'hgs.habit-strength.automaticity-5.v1',
   requiredEvidenceContract:'FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
   supportedContextKinds:['GOAL','SITUATION'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',
  });
  // Habit Strength is a one-target current at-report appraisal grounded in
  // sufficient prior repetition, never a period measure, streak,
  // repetition count, days-to-habit, or habit-formation curve: the
  // contract exports no window constant at all.
  expect(Object.keys(HGS_HABIT_STRENGTH_MODEL)).not.toEqual(expect.arrayContaining(['windowMs']));
 });
 it.each([['VERY_LOW',1],['LOW',2],['MODERATE',3],['HIGH',4],['VERY_HIGH',5]] as const)('scores %s as ordinal %i on an owned GOAL target with no interval arithmetic semantics',(code,value)=>{
  const result=calculateHgsHabitStrength(input(observation({responseCode:code})));
  expect(result.resultState).toBe('ASSESSED');
  expect(result.numericValue).toBe(value);
  expect(result.confidenceState).toBe('UNASSESSED');
  expect(result.confidenceReference).toBeNull();
 });
 it.each([['VERY_LOW',1],['VERY_HIGH',5]] as const)('scores %s as ordinal %i on an owned SITUATION target too',(code,value)=>{
  const result=calculateHgsHabitStrength(input(situationObservation({responseCode:code})));
  expect(result.resultState).toBe('ASSESSED');
  expect(result.numericValue).toBe(value);
 });
 it.each(['INSUFFICIENT_REPETITION_HISTORY_TO_JUDGE','NO_SINGLE_RECURRING_PATTERN_TO_RATE','TOO_CUE_DEPENDENT_TO_RATE','NOT_SURE'] as const)('treats %s as UNASSESSED null, never zero, never low automaticity, never high automaticity, and never a midpoint',code=>{
  expect(calculateHgsHabitStrength(input(observation({responseCode:code})))).toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'});
 });
 it('treats a missing observation as UNASSESSED null',()=>{
  expect(calculateHgsHabitStrength(input(undefined))).toMatchObject({resultState:'UNASSESSED',numericValue:null,missingInputKeys:['observation']});
 });
 it('preserves contradiction as PRESENT_UNRESOLVED null without assessing',()=>{
  expect(calculateHgsHabitStrength(input(observation(),{contradictoryEvidenceRefs:['memory:20000000-0000-4000-8000-000000000002']})))
   .toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'});
 });
 it.each([
  ['wrong metric',observation({metricKey:'hgs.resilience' as never})],
  ['wrong definition version',observation({definitionVersion:2 as never})],
  ['wrong instrument',observation({instrumentId:'hgs.resilience.direct-target-bound-adaptive-recovery-report' as never})],
  ['wrong instrument version',observation({instrumentVersion:2 as never})],
  ['wrong scale',observation({scaleContractReference:'hbs.consistency.frequency-5.v1' as never})],
  ['wrong scale version',observation({scaleVersion:2 as never})],
  ['wrong source',observation({source:'LLM_INFERENCE' as never})],
  ['invalid report timestamp',observation({reportTimestamp:'not-a-timestamp'})],
  ['malformed response',observation({responseCode:'FULLY_AUTOMATIC' as never})],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHgsHabitStrength(input(invalid))).toThrow(BadRequestException);
 });
 // Sibling and foreign observations can never be scored under this model:
 // a Consistency, Initiative, Motivation, Purpose Alignment,
 // Self-Awareness, Resilience, or Avoidance report carries its own metric
 // key, instrument, scale, and vocabulary, and every one of those
 // mismatches is rejected. Habit Strength is never derived from
 // Consistency, follow-through frequency, Initiative, Motivation, Purpose
 // Alignment, Self-Awareness, Resilience, streaks, repetition counts,
 // Memory, Evidence, or conversation text - the mandatory Consistency
 // boundary holds structurally: no Consistency frequency code is ever
 // reused as a Habit Strength response and no frequency -> automaticity
 // conversion exists.
 it.each([
  ['an HBS Consistency observation',observation({metricKey:'hbs.consistency' as never,instrumentId:'hbs.consistency.direct-target-bound-seven-day-report' as never,scaleContractReference:'hbs.consistency.frequency-5.v1' as never,responseCode:'ALMOST_ALWAYS' as never})],
  ['an HBS Initiative observation',observation({metricKey:'hbs.initiative' as never,instrumentId:'hbs.initiative.direct-target-bound-seven-day-report' as never,scaleContractReference:'hbs.initiative.frequency-5.v1' as never,responseCode:'OFTEN' as never})],
  ['an HBS Avoidance observation',observation({metricKey:'hbs.avoidance' as never,instrumentId:'hbs.avoidance.direct-target-bound-seven-day-report' as never,scaleContractReference:'hbs.avoidance.frequency-5.v1' as never,responseCode:'NEVER' as never})],
  ['an HSE Motivation observation',observation({metricKey:'hse.motivation' as never,instrumentId:'hse.motivation.direct-self-report' as never,scaleContractReference:'hse.motivation.ordinal-5.v1' as never})],
  ['a Purpose Alignment observation',observation({metricKey:'hgs.purpose-alignment' as never,instrumentId:'hgs.purpose-alignment.direct-goal-bound-purpose-congruence-report' as never,scaleContractReference:'hgs.purpose-alignment.congruence-5.v1' as never})],
  ['a Self-Awareness observation',observation({metricKey:'hgs.self-awareness' as never,instrumentId:'hgs.self-awareness.direct-target-bound-self-understanding-clarity-report' as never,scaleContractReference:'hgs.self-awareness.clarity-5.v1' as never})],
  ['a Resilience observation',observation({metricKey:'hgs.resilience' as never,instrumentId:'hgs.resilience.direct-target-bound-adaptive-recovery-report' as never,scaleContractReference:'hgs.resilience.adaptive-recovery-5.v1' as never})],
  ['a Consistency frequency code on the Habit Strength vocabulary',observation({responseCode:'ALMOST_ALWAYS' as never})],
  ['another frequency code on the Habit Strength vocabulary',observation({responseCode:'NEVER' as never})],
  ['a Reflection engagement code on the Habit Strength vocabulary',observation({responseCode:'A_GREAT_DEAL' as never})],
  ['the Consistency special code',observation({responseCode:'INSUFFICIENT_REPEATED_OPPORTUNITIES' as never})],
  ['the Initiative special code',observation({responseCode:'NO_CLEAR_SELF_OWNED_OPPORTUNITY' as never})],
  ['the Self-Awareness special code',observation({responseCode:'TOO_FACET_DEPENDENT_TO_RATE' as never})],
  ['the shared HRS/Self-Awareness special code',observation({responseCode:'INSUFFICIENT_BASIS_TO_JUDGE' as never})],
  ['the Resilience too-early special code',observation({responseCode:'TOO_EARLY_TO_JUDGE_ADAPTATION' as never})],
  ['the Purpose Alignment value-conflict special code',observation({responseCode:'TOO_VALUE_CONFLICTED_TO_RATE' as never})],
 ])('rejects %s instead of reusing it',(_name,invalid)=>{
  expect(()=>calculateHgsHabitStrength(input(invalid))).toThrow(BadRequestException);
 });
 it('depends only on its own observation: extra sibling inputs change nothing (no inverse, composite, frequency conversion, or forced correlation)',()=>{
  // The mandated coexistence set stays expressible: ALMOST_ALWAYS
  // Consistency with VERY_LOW Habit Strength (reliable follow-through
  // achieved only through deliberate effort each time), NEVER Consistency
  // with VERY_HIGH Habit Strength (an established cue-response
  // association whose cue/opportunity was disrupted this week), VERY_HIGH
  // Motivation with VERY_LOW Habit Strength, VERY_LOW Motivation with
  // VERY_HIGH Habit Strength, and every Initiative / Purpose Alignment /
  // Self-Awareness / Resilience combination. Sibling values never derive,
  // mutate, or veto this metric, no Consistency threshold gates it, no
  // frequency ever converts into automaticity, and a value never becomes
  // a compulsion, addiction, healthy-habit, or continue/stop conclusion -
  // there is no such field to set.
  const alone=calculateHgsHabitStrength(input(observation({responseCode:'VERY_LOW'})));
  const crowded=calculateHgsHabitStrength({...input(observation({responseCode:'VERY_LOW'})),inputs:{observation:observation({responseCode:'VERY_LOW'}),consistencyObservation:{responseCode:'ALMOST_ALWAYS'},initiativeObservation:{responseCode:'OFTEN'},motivationObservation:{responseCode:'VERY_HIGH'},purposeAlignmentObservation:{responseCode:'VERY_HIGH'},conversationText:'I never miss a day, I push myself through it every single time'}});
  expect(alone.numericValue).toBe(1);
  expect(crowded.numericValue).toBe(1);
  const automatic=calculateHgsHabitStrength({...input(observation({responseCode:'VERY_HIGH'})),inputs:{observation:observation({responseCode:'VERY_HIGH'}),consistencyObservation:{responseCode:'NEVER'},motivationObservation:{responseCode:'VERY_LOW'}}});
  expect(automatic.numericValue).toBe(5);
  expect(alone).not.toHaveProperty('streak');
  expect(crowded).not.toHaveProperty('repetitionCount');
  expect(automatic).not.toHaveProperty('compulsionRisk');
 });
 it.each([
  ['unsupported RELATIONSHIP context',{...input(observation()),context:{kind:'RELATIONSHIP' as const,id:GOAL}}],
  ['unsupported CONVERSATION_SESSION context',{...input(observation()),context:{kind:'CONVERSATION_SESSION' as const,id:GOAL}}],
  ['unsupported DECISION context',{...input(observation()),context:{kind:'DECISION' as const,id:GOAL}}],
  ['unsupported GLOBAL context',{...input(observation()),context:{kind:'GLOBAL' as const,id:'GLOBAL'}}],
  ['context id mismatch',{...input(observation()),context:{kind:'GOAL' as const,id:'99999999-0000-4000-8000-000000000009'}}],
  ['context kind mismatch',{...input(observation()),context:{kind:'SITUATION' as const,id:GOAL}}],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHgsHabitStrength(invalid)).toThrow('Habit Strength exact context mismatch.');
 });
 it.each([
  ['forged divergent target id',observation({targetContextId:'99999999-0000-4000-8000-000000000009'})],
  ['missing target label',observation({target:null as never})],
  ['empty target label',observation({target:''})],
  ['untrimmed target label',observation({target:' padded '})],
  ['oversized target label',observation({target:'x'.repeat(257)})],
  ['null target context kind',observation({targetContextKind:null as never})],
  ['foreign target context kind',observation({targetContextKind:'SITUATION' as never})],
 ])('rejects a forged GOAL/SITUATION target shape: %s',(_name,invalid)=>{
  expect(()=>calculateHgsHabitStrength(input(invalid))).toThrow('Habit Strength exact GOAL/SITUATION target mismatch.');
 });
 it('rejects any smuggled temporal window instead of interpreting it',()=>{
  expect(()=>calculateHgsHabitStrength(input({...observation(),windowStart:'2026-08-20T12:00:00.000Z',windowEnd:REPORT} as never))).toThrow('Habit Strength observation must not carry a temporal window.');
  expect(()=>calculateHgsHabitStrength(input({...observation(),windowEnd:REPORT} as never))).toThrow('Habit Strength observation must not carry a temporal window.');
 });
 it('rejects a superseded observation',()=>{
  expect(()=>calculateHgsHabitStrength(input(observation({superseded:true})))).toThrow('Superseded Habit Strength observation cannot be calculated.');
 });
});
