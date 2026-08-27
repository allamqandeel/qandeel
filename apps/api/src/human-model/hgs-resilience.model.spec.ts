import { BadRequestException } from '@nestjs/common';
import { calculateHgsResilience,HGS_RESILIENCE_MODEL,type HgsResilienceObservation } from './hgs-resilience.model';
import type { HimMetricCalculationInput } from './him-calculation.types';

const REPORT='2026-08-27T12:00:00.000Z';
const GOAL='33000000-0000-4000-8000-000000000001';
const SITUATION='33000000-0000-4000-8000-000000000002';
const observation=(overrides:Partial<HgsResilienceObservation>={}):HgsResilienceObservation=>({
 observationId:'obs-1',measurementEventId:'event-1',userId:'user-1',metricKey:'hgs.resilience',definitionVersion:1,
 contextKind:'GOAL',contextId:GOAL,target:'finish thesis draft',targetContextKind:'GOAL',targetContextId:GOAL,
 instrumentId:'hgs.resilience.direct-target-bound-adaptive-recovery-report',instrumentVersion:1,scaleContractReference:'hgs.resilience.adaptive-recovery-5.v1',scaleVersion:1,
 responseCode:'MODERATE',reportTimestamp:REPORT,
 source:'DIRECT_STRUCTURED_USER_REPORT',superseded:false,...overrides,
});
const situationObservation=(overrides:Partial<HgsResilienceObservation>={}):HgsResilienceObservation=>observation({contextKind:'SITUATION',contextId:SITUATION,target:'difficult team meeting',targetContextKind:'SITUATION',targetContextId:SITUATION,...overrides});
const input=(o?:HgsResilienceObservation,overrides:Partial<HimMetricCalculationInput>={}):HimMetricCalculationInput=>({
 metricKey:'hgs.resilience',definitionVersion:1,modelId:HGS_RESILIENCE_MODEL.modelId,modelVersion:1,
 context:{kind:o?.contextKind??'GOAL',id:o?.contextId??GOAL},inputs:o?{observation:o}:{},
 supportingEvidenceRefs:[],contradictoryEvidenceRefs:[],provenance:'QANDEEL_HIM_CALCULATION_RUNTIME_V1',traceId:'trace-1',updateReason:'DIRECT_STRUCTURED_USER_REPORT',...overrides,
});

describe('HGS Resilience measurement model v1',()=>{
 it('freezes the exact calibrated target-bound at-report model identity with no temporal window',()=>{
  expect(HGS_RESILIENCE_MODEL).toMatchObject({
   modelId:'hgs.resilience.direct-structured-current-adaptive-recovery',modelVersion:1,targetMetricKey:'hgs.resilience',targetDefinitionVersion:1,
   lifecycle:'CALIBRATED',environment:'PRODUCTION',canonicalOwner:'QANDEEL_HIM_GOVERNANCE',
   methodType:'DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_ADAPTIVE_RECOVERY_REPORT',scaleContractReference:'hgs.resilience.adaptive-recovery-5.v1',
   requiredEvidenceContract:'FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
   supportedContextKinds:['GOAL','SITUATION'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',
  });
  // Resilience is a one-target current at-report appraisal grounded in
  // actually experienced challenge, never a period measure,
  // time-to-recovery, or growth trajectory: the contract exports no
  // window constant at all.
  expect(Object.keys(HGS_RESILIENCE_MODEL)).not.toEqual(expect.arrayContaining(['windowMs']));
 });
 it.each([['VERY_LOW',1],['LOW',2],['MODERATE',3],['HIGH',4],['VERY_HIGH',5]] as const)('scores %s as ordinal %i on an owned GOAL target with no interval arithmetic semantics',(code,value)=>{
  const result=calculateHgsResilience(input(observation({responseCode:code})));
  expect(result.resultState).toBe('ASSESSED');
  expect(result.numericValue).toBe(value);
  expect(result.confidenceState).toBe('UNASSESSED');
  expect(result.confidenceReference).toBeNull();
 });
 it.each([['VERY_LOW',1],['VERY_HIGH',5]] as const)('scores %s as ordinal %i on an owned SITUATION target too',(code,value)=>{
  const result=calculateHgsResilience(input(situationObservation({responseCode:code})));
  expect(result.resultState).toBe('ASSESSED');
  expect(result.numericValue).toBe(value);
 });
 it.each(['NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE','TOO_EARLY_TO_JUDGE_ADAPTATION','TOO_CHALLENGE_DEPENDENT_TO_RATE','NOT_SURE'] as const)('treats %s as UNASSESSED null, never zero, never low resilience, never high resilience, and never a midpoint',code=>{
  expect(calculateHgsResilience(input(observation({responseCode:code})))).toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'});
 });
 it('treats a missing observation as UNASSESSED null',()=>{
  expect(calculateHgsResilience(input(undefined))).toMatchObject({resultState:'UNASSESSED',numericValue:null,missingInputKeys:['observation']});
 });
 it('preserves contradiction as PRESENT_UNRESOLVED null without assessing',()=>{
  expect(calculateHgsResilience(input(observation(),{contradictoryEvidenceRefs:['memory:20000000-0000-4000-8000-000000000002']})))
   .toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'});
 });
 it.each([
  ['wrong metric',observation({metricKey:'hgs.self-awareness' as never})],
  ['wrong definition version',observation({definitionVersion:2 as never})],
  ['wrong instrument',observation({instrumentId:'hgs.self-awareness.direct-target-bound-self-understanding-clarity-report' as never})],
  ['wrong instrument version',observation({instrumentVersion:2 as never})],
  ['wrong scale',observation({scaleContractReference:'hse.stress.ordinal-5.v1' as never})],
  ['wrong scale version',observation({scaleVersion:2 as never})],
  ['wrong source',observation({source:'LLM_INFERENCE' as never})],
  ['invalid report timestamp',observation({reportTimestamp:'not-a-timestamp'})],
  ['malformed response',observation({responseCode:'BOUNCED_BACK_COMPLETELY' as never})],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHgsResilience(input(invalid))).toThrow(BadRequestException);
 });
 // Sibling and foreign observations can never be scored under this model:
 // a Stress, Motivation, Self-Confidence, Self-Awareness, Consistency, or
 // Repair report carries its own metric key, instrument, scale, and
 // vocabulary, and every one of those mismatches is rejected. Resilience
 // is never derived from low Stress, Motivation, Self-Confidence,
 // Self-Awareness, Consistency, Habit Strength, any HRS metric, Memory,
 // Evidence, or conversation text.
 it.each([
  ['an HSE Stress observation',observation({metricKey:'hse.stress' as never,instrumentId:'hse.stress.direct-self-report' as never,scaleContractReference:'hse.stress.ordinal-5.v1' as never})],
  ['an HSE Motivation observation',observation({metricKey:'hse.motivation' as never,instrumentId:'hse.motivation.direct-self-report' as never,scaleContractReference:'hse.motivation.ordinal-5.v1' as never})],
  ['an HSE Self-Confidence observation',observation({metricKey:'hse.self-confidence' as never,instrumentId:'hse.self-confidence.direct-self-report' as never,scaleContractReference:'hse.self-confidence.ordinal-5.v1' as never})],
  ['a Self-Awareness observation',observation({metricKey:'hgs.self-awareness' as never,instrumentId:'hgs.self-awareness.direct-target-bound-self-understanding-clarity-report' as never,scaleContractReference:'hgs.self-awareness.clarity-5.v1' as never})],
  ['an HBS Consistency observation',observation({metricKey:'hbs.consistency' as never,instrumentId:'hbs.consistency.direct-target-bound-seven-day-report' as never,scaleContractReference:'hbs.consistency.frequency-5.v1' as never,responseCode:'ALMOST_ALWAYS' as never})],
  ['an HRS Repair observation',observation({metricKey:'hrs.repair' as never,instrumentId:'hrs.repair.direct-relationship-bound-repair-effectiveness-report' as never,scaleContractReference:'hrs.repair.effectiveness-5.v1' as never})],
  ['another HGS metric key',observation({metricKey:'hgs.purpose-alignment' as never})],
  ['an HBS frequency code on the Resilience vocabulary',observation({responseCode:'ALMOST_ALWAYS' as never})],
  ['a Reflection engagement code on the Resilience vocabulary',observation({responseCode:'A_GREAT_DEAL' as never})],
  ['the Self-Awareness special code',observation({responseCode:'TOO_FACET_DEPENDENT_TO_RATE' as never})],
  ['the shared HRS/Self-Awareness special code',observation({responseCode:'INSUFFICIENT_BASIS_TO_JUDGE' as never})],
  ['the Repair special code',observation({responseCode:'NO_MEANINGFUL_REPAIR_OPPORTUNITY' as never})],
  ['the Trust special code',observation({responseCode:'TOO_CONTEXT_DEPENDENT_TO_RATE' as never})],
 ])('rejects %s instead of reusing it',(_name,invalid)=>{
  expect(()=>calculateHgsResilience(input(invalid))).toThrow(BadRequestException);
 });
 it('depends only on its own observation: extra sibling inputs change nothing (no inverse, composite, or forced correlation)',()=>{
  // High Stress with VERY_HIGH Resilience (and every other sibling
  // combination, including high Motivation with low Resilience, low
  // Motivation with high Resilience, and high Self-Awareness with low
  // Resilience) stays expressible: sibling values never derive, mutate,
  // or veto this metric, and a value never becomes a recovery-time,
  // trait, or growth conclusion - there is no such field to set.
  const alone=calculateHgsResilience(input(observation({responseCode:'VERY_HIGH'})));
  const crowded=calculateHgsResilience({...input(observation({responseCode:'VERY_HIGH'})),inputs:{observation:observation({responseCode:'VERY_HIGH'}),stressObservation:{responseCode:'VERY_HIGH'},motivationObservation:{responseCode:'VERY_LOW'},selfAwarenessObservation:{responseCode:'VERY_LOW'},selfConfidenceObservation:{responseCode:'VERY_LOW'},conversationText:'this setback broke my routine for weeks and it still hurts'}});
  expect(alone.numericValue).toBe(5);
  expect(crowded.numericValue).toBe(5);
  expect(alone).not.toHaveProperty('recoveryTime');
  expect(crowded).not.toHaveProperty('growthTrajectory');
 });
 it.each([
  ['unsupported RELATIONSHIP context',{...input(observation()),context:{kind:'RELATIONSHIP' as const,id:GOAL}}],
  ['unsupported CONVERSATION_SESSION context',{...input(observation()),context:{kind:'CONVERSATION_SESSION' as const,id:GOAL}}],
  ['unsupported DECISION context',{...input(observation()),context:{kind:'DECISION' as const,id:GOAL}}],
  ['unsupported GLOBAL context',{...input(observation()),context:{kind:'GLOBAL' as const,id:'GLOBAL'}}],
  ['context id mismatch',{...input(observation()),context:{kind:'GOAL' as const,id:'99999999-0000-4000-8000-000000000009'}}],
  ['context kind mismatch',{...input(observation()),context:{kind:'SITUATION' as const,id:GOAL}}],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHgsResilience(invalid)).toThrow('Resilience exact context mismatch.');
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
  expect(()=>calculateHgsResilience(input(invalid))).toThrow('Resilience exact GOAL/SITUATION target mismatch.');
 });
 it('rejects any smuggled temporal window instead of interpreting it',()=>{
  expect(()=>calculateHgsResilience(input({...observation(),windowStart:'2026-08-20T12:00:00.000Z',windowEnd:REPORT} as never))).toThrow('Resilience observation must not carry a temporal window.');
  expect(()=>calculateHgsResilience(input({...observation(),windowEnd:REPORT} as never))).toThrow('Resilience observation must not carry a temporal window.');
 });
 it('rejects a superseded observation',()=>{
  expect(()=>calculateHgsResilience(input(observation({superseded:true})))).toThrow('Superseded Resilience observation cannot be calculated.');
 });
});
