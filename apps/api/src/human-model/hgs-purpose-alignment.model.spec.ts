import { BadRequestException } from '@nestjs/common';
import { calculateHgsPurposeAlignment,HGS_PURPOSE_ALIGNMENT_MODEL,type HgsPurposeAlignmentObservation } from './hgs-purpose-alignment.model';
import type { HimMetricCalculationInput } from './him-calculation.types';

const REPORT='2026-08-27T12:00:00.000Z';
const GOAL='34000000-0000-4000-8000-000000000001';
const SECOND_GOAL='34000000-0000-4000-8000-000000000002';
const observation=(overrides:Partial<HgsPurposeAlignmentObservation>={}):HgsPurposeAlignmentObservation=>({
 observationId:'obs-1',measurementEventId:'event-1',userId:'user-1',metricKey:'hgs.purpose-alignment',definitionVersion:1,
 contextKind:'GOAL',contextId:GOAL,target:'finish thesis draft',targetContextKind:'GOAL',targetContextId:GOAL,
 instrumentId:'hgs.purpose-alignment.direct-goal-bound-purpose-congruence-report',instrumentVersion:1,scaleContractReference:'hgs.purpose-alignment.congruence-5.v1',scaleVersion:1,
 responseCode:'MODERATE',reportTimestamp:REPORT,
 source:'DIRECT_STRUCTURED_USER_REPORT',superseded:false,...overrides,
});
const input=(o?:HgsPurposeAlignmentObservation,overrides:Partial<HimMetricCalculationInput>={}):HimMetricCalculationInput=>({
 metricKey:'hgs.purpose-alignment',definitionVersion:1,modelId:HGS_PURPOSE_ALIGNMENT_MODEL.modelId,modelVersion:1,
 context:{kind:'GOAL',id:o?.contextId??GOAL},inputs:o?{observation:o}:{},
 supportingEvidenceRefs:[],contradictoryEvidenceRefs:[],provenance:'QANDEEL_HIM_CALCULATION_RUNTIME_V1',traceId:'trace-1',updateReason:'DIRECT_STRUCTURED_USER_REPORT',...overrides,
});

describe('HGS Purpose Alignment measurement model v1',()=>{
 it('freezes the exact calibrated goal-bound at-report model identity with no temporal window',()=>{
  expect(HGS_PURPOSE_ALIGNMENT_MODEL).toMatchObject({
   modelId:'hgs.purpose-alignment.direct-structured-current-purpose-congruence',modelVersion:1,targetMetricKey:'hgs.purpose-alignment',targetDefinitionVersion:1,
   lifecycle:'CALIBRATED',environment:'PRODUCTION',canonicalOwner:'QANDEEL_HIM_GOVERNANCE',
   methodType:'DIRECT_STRUCTURED_GOAL_BOUND_CURRENT_PURPOSE_CONGRUENCE_REPORT',scaleContractReference:'hgs.purpose-alignment.congruence-5.v1',
   requiredEvidenceContract:'FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
   supportedContextKinds:['GOAL'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',
  });
  // Purpose Alignment is a one-GOAL current at-report congruence
  // appraisal, never a period measure, goal-progress delta, or
  // values-drift trajectory: the contract exports no window constant at
  // all.
  expect(Object.keys(HGS_PURPOSE_ALIGNMENT_MODEL)).not.toEqual(expect.arrayContaining(['windowMs']));
 });
 it.each([['VERY_LOW',1],['LOW',2],['MODERATE',3],['HIGH',4],['VERY_HIGH',5]] as const)('scores %s as ordinal %i on an owned GOAL target with no interval arithmetic semantics',(code,value)=>{
  const result=calculateHgsPurposeAlignment(input(observation({responseCode:code})));
  expect(result.resultState).toBe('ASSESSED');
  expect(result.numericValue).toBe(value);
  expect(result.confidenceState).toBe('UNASSESSED');
  expect(result.confidenceReference).toBeNull();
 });
 it.each(['TOO_VALUE_CONFLICTED_TO_RATE','INSUFFICIENT_PERSONAL_DIRECTION_BASIS_TO_JUDGE','NOT_SURE'] as const)('treats %s as UNASSESSED null, never zero, never low alignment, never high alignment, and never a midpoint',code=>{
  expect(calculateHgsPurposeAlignment(input(observation({responseCode:code})))).toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'});
 });
 it('treats a missing observation as UNASSESSED null',()=>{
  expect(calculateHgsPurposeAlignment(input(undefined))).toMatchObject({resultState:'UNASSESSED',numericValue:null,missingInputKeys:['observation']});
 });
 it('preserves contradiction as PRESENT_UNRESOLVED null without assessing',()=>{
  expect(calculateHgsPurposeAlignment(input(observation(),{contradictoryEvidenceRefs:['memory:20000000-0000-4000-8000-000000000002']})))
   .toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'});
 });
 it.each([
  ['wrong metric',observation({metricKey:'hgs.resilience' as never})],
  ['wrong definition version',observation({definitionVersion:2 as never})],
  ['wrong instrument',observation({instrumentId:'hgs.resilience.direct-target-bound-adaptive-recovery-report' as never})],
  ['wrong instrument version',observation({instrumentVersion:2 as never})],
  ['wrong scale',observation({scaleContractReference:'hse.motivation.ordinal-5.v1' as never})],
  ['wrong scale version',observation({scaleVersion:2 as never})],
  ['wrong source',observation({source:'LLM_INFERENCE' as never})],
  ['invalid report timestamp',observation({reportTimestamp:'not-a-timestamp'})],
  ['malformed response',observation({responseCode:'PERFECTLY_ALIGNED' as never})],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHgsPurposeAlignment(input(invalid))).toThrow(BadRequestException);
 });
 // Sibling and foreign observations can never be scored under this model:
 // a Motivation, Self-Awareness, Resilience, Self-Confidence, Consistency,
 // or Initiative report carries its own metric key, instrument, scale, and
 // vocabulary, and every one of those mismatches is rejected. Purpose
 // Alignment is never derived from Motivation, Self-Awareness, Resilience,
 // Consistency, Initiative, Habit Strength, goal effort, progress,
 // attainment, motive subscales, Memory, Evidence, or conversation text.
 it.each([
  ['an HSE Motivation observation',observation({metricKey:'hse.motivation' as never,instrumentId:'hse.motivation.direct-self-report' as never,scaleContractReference:'hse.motivation.ordinal-5.v1' as never})],
  ['an HSE Self-Confidence observation',observation({metricKey:'hse.self-confidence' as never,instrumentId:'hse.self-confidence.direct-self-report' as never,scaleContractReference:'hse.self-confidence.ordinal-5.v1' as never})],
  ['a Self-Awareness observation',observation({metricKey:'hgs.self-awareness' as never,instrumentId:'hgs.self-awareness.direct-target-bound-self-understanding-clarity-report' as never,scaleContractReference:'hgs.self-awareness.clarity-5.v1' as never})],
  ['a Resilience observation',observation({metricKey:'hgs.resilience' as never,instrumentId:'hgs.resilience.direct-target-bound-adaptive-recovery-report' as never,scaleContractReference:'hgs.resilience.adaptive-recovery-5.v1' as never})],
  ['an HBS Consistency observation',observation({metricKey:'hbs.consistency' as never,instrumentId:'hbs.consistency.direct-target-bound-seven-day-report' as never,scaleContractReference:'hbs.consistency.frequency-5.v1' as never,responseCode:'ALMOST_ALWAYS' as never})],
  ['an HBS Initiative observation',observation({metricKey:'hbs.initiative' as never,instrumentId:'hbs.initiative.direct-target-bound-seven-day-report' as never,scaleContractReference:'hbs.initiative.frequency-5.v1' as never,responseCode:'OFTEN' as never})],
  ['the remaining uncalibrated HGS metric key',observation({metricKey:'hgs.habit-strength' as never})],
  ['an HBS frequency code on the Purpose Alignment vocabulary',observation({responseCode:'ALMOST_ALWAYS' as never})],
  ['a Reflection engagement code on the Purpose Alignment vocabulary',observation({responseCode:'A_GREAT_DEAL' as never})],
  ['the Self-Awareness special code',observation({responseCode:'TOO_FACET_DEPENDENT_TO_RATE' as never})],
  ['the shared HRS/Self-Awareness special code',observation({responseCode:'INSUFFICIENT_BASIS_TO_JUDGE' as never})],
  ['the Resilience no-adversity special code',observation({responseCode:'NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE' as never})],
  ['the Resilience too-early special code',observation({responseCode:'TOO_EARLY_TO_JUDGE_ADAPTATION' as never})],
  ['the Resilience challenge-dependence special code',observation({responseCode:'TOO_CHALLENGE_DEPENDENT_TO_RATE' as never})],
 ])('rejects %s instead of reusing it',(_name,invalid)=>{
  expect(()=>calculateHgsPurposeAlignment(input(invalid))).toThrow(BadRequestException);
 });
 it('depends only on its own observation: extra sibling inputs change nothing (no inverse, composite, autonomous-motivation formula, or forced correlation)',()=>{
  // High Motivation with VERY_LOW Purpose Alignment (and every other
  // sibling combination, including low Motivation with high Purpose
  // Alignment, high Self-Awareness with low Purpose Alignment, low
  // Self-Awareness with high Purpose Alignment, and high Resilience or
  // Consistency with low Purpose Alignment) stays expressible: sibling
  // values never derive, mutate, or veto this metric, no motive-subscale
  // weighting exists, and a value never becomes a goal-quality,
  // endorsement, or continue/abandon conclusion - there is no such field
  // to set.
  const alone=calculateHgsPurposeAlignment(input(observation({responseCode:'VERY_LOW'})));
  const crowded=calculateHgsPurposeAlignment({...input(observation({responseCode:'VERY_LOW'})),inputs:{observation:observation({responseCode:'VERY_LOW'}),motivationObservation:{responseCode:'VERY_HIGH'},selfAwarenessObservation:{responseCode:'VERY_HIGH'},resilienceObservation:{responseCode:'VERY_HIGH'},consistencyObservation:{responseCode:'ALMOST_ALWAYS'},conversationText:'I am working so hard on this every single day and everyone expects me to finish'}});
  expect(alone.numericValue).toBe(1);
  expect(crowded.numericValue).toBe(1);
  const aligned=calculateHgsPurposeAlignment({...input(observation({responseCode:'VERY_HIGH'})),inputs:{observation:observation({responseCode:'VERY_HIGH'}),motivationObservation:{responseCode:'VERY_LOW'}}});
  expect(aligned.numericValue).toBe(5);
  expect(alone).not.toHaveProperty('goalQuality');
  expect(crowded).not.toHaveProperty('recommendation');
  expect(aligned).not.toHaveProperty('endorsement');
 });
 it.each([
  ['unsupported SITUATION context',{...input(observation()),context:{kind:'SITUATION' as const,id:GOAL}}],
  ['unsupported RELATIONSHIP context',{...input(observation()),context:{kind:'RELATIONSHIP' as const,id:GOAL}}],
  ['unsupported CONVERSATION_SESSION context',{...input(observation()),context:{kind:'CONVERSATION_SESSION' as const,id:GOAL}}],
  ['unsupported DECISION context',{...input(observation()),context:{kind:'DECISION' as const,id:GOAL}}],
  ['unsupported GLOBAL context',{...input(observation()),context:{kind:'GLOBAL' as const,id:'GLOBAL'}}],
  ['context id mismatch',{...input(observation()),context:{kind:'GOAL' as const,id:SECOND_GOAL}}],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHgsPurposeAlignment(invalid)).toThrow('Purpose Alignment exact context mismatch.');
 });
 it.each([
  ['forged divergent target id',observation({targetContextId:SECOND_GOAL})],
  ['missing target label',observation({target:null as never})],
  ['empty target label',observation({target:''})],
  ['untrimmed target label',observation({target:' padded '})],
  ['oversized target label',observation({target:'x'.repeat(257)})],
  ['null target context kind',observation({targetContextKind:null as never})],
  ['foreign target context kind',observation({targetContextKind:'SITUATION' as never})],
 ])('rejects a forged GOAL target shape: %s',(_name,invalid)=>{
  expect(()=>calculateHgsPurposeAlignment(input(invalid))).toThrow('Purpose Alignment exact GOAL target mismatch.');
 });
 it('rejects any smuggled temporal window instead of interpreting it',()=>{
  expect(()=>calculateHgsPurposeAlignment(input({...observation(),windowStart:'2026-08-20T12:00:00.000Z',windowEnd:REPORT} as never))).toThrow('Purpose Alignment observation must not carry a temporal window.');
  expect(()=>calculateHgsPurposeAlignment(input({...observation(),windowEnd:REPORT} as never))).toThrow('Purpose Alignment observation must not carry a temporal window.');
 });
 it('rejects a superseded observation',()=>{
  expect(()=>calculateHgsPurposeAlignment(input(observation({superseded:true})))).toThrow('Superseded Purpose Alignment observation cannot be calculated.');
 });
});
