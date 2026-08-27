import { BadRequestException } from '@nestjs/common';
import { calculateHgsSelfAwareness,HGS_SELF_AWARENESS_MODEL,type HgsSelfAwarenessObservation } from './hgs-self-awareness.model';
import type { HimMetricCalculationInput } from './him-calculation.types';

const REPORT='2026-08-27T12:00:00.000Z';
const GOAL='32000000-0000-4000-8000-000000000001';
const SITUATION='32000000-0000-4000-8000-000000000002';
const observation=(overrides:Partial<HgsSelfAwarenessObservation>={}):HgsSelfAwarenessObservation=>({
 observationId:'obs-1',measurementEventId:'event-1',userId:'user-1',metricKey:'hgs.self-awareness',definitionVersion:1,
 contextKind:'GOAL',contextId:GOAL,target:'finish thesis draft',targetContextKind:'GOAL',targetContextId:GOAL,
 instrumentId:'hgs.self-awareness.direct-target-bound-self-understanding-clarity-report',instrumentVersion:1,scaleContractReference:'hgs.self-awareness.clarity-5.v1',scaleVersion:1,
 responseCode:'MODERATE',reportTimestamp:REPORT,
 source:'DIRECT_STRUCTURED_USER_REPORT',superseded:false,...overrides,
});
const situationObservation=(overrides:Partial<HgsSelfAwarenessObservation>={}):HgsSelfAwarenessObservation=>observation({contextKind:'SITUATION',contextId:SITUATION,target:'difficult team meeting',targetContextKind:'SITUATION',targetContextId:SITUATION,...overrides});
const input=(o?:HgsSelfAwarenessObservation,overrides:Partial<HimMetricCalculationInput>={}):HimMetricCalculationInput=>({
 metricKey:'hgs.self-awareness',definitionVersion:1,modelId:HGS_SELF_AWARENESS_MODEL.modelId,modelVersion:1,
 context:{kind:o?.contextKind??'GOAL',id:o?.contextId??GOAL},inputs:o?{observation:o}:{},
 supportingEvidenceRefs:[],contradictoryEvidenceRefs:[],provenance:'QANDEEL_HIM_CALCULATION_RUNTIME_V1',traceId:'trace-1',updateReason:'DIRECT_STRUCTURED_USER_REPORT',...overrides,
});

describe('HGS Self-Awareness measurement model v1',()=>{
 it('freezes the exact calibrated target-bound at-report model identity with no temporal window',()=>{
  expect(HGS_SELF_AWARENESS_MODEL).toMatchObject({
   modelId:'hgs.self-awareness.direct-structured-current-self-understanding-clarity',modelVersion:1,targetMetricKey:'hgs.self-awareness',targetDefinitionVersion:1,
   lifecycle:'CALIBRATED',environment:'PRODUCTION',canonicalOwner:'QANDEEL_HIM_GOVERNANCE',
   methodType:'DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_SELF_UNDERSTANDING_CLARITY_REPORT',scaleContractReference:'hgs.self-awareness.clarity-5.v1',
   requiredEvidenceContract:'FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
   supportedContextKinds:['GOAL','SITUATION'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',
  });
  // Self-Awareness is a one-target current at-report appraisal, never a
  // period measure or growth trajectory: the contract exports no window
  // constant at all.
  expect(Object.keys(HGS_SELF_AWARENESS_MODEL)).not.toEqual(expect.arrayContaining(['windowMs']));
 });
 it.each([['VERY_LOW',1],['LOW',2],['MODERATE',3],['HIGH',4],['VERY_HIGH',5]] as const)('scores %s as ordinal %i on an owned GOAL target with no interval arithmetic semantics',(code,value)=>{
  const result=calculateHgsSelfAwareness(input(observation({responseCode:code})));
  expect(result.resultState).toBe('ASSESSED');
  expect(result.numericValue).toBe(value);
  expect(result.confidenceState).toBe('UNASSESSED');
  expect(result.confidenceReference).toBeNull();
 });
 it.each([['VERY_LOW',1],['VERY_HIGH',5]] as const)('scores %s as ordinal %i on an owned SITUATION target too',(code,value)=>{
  const result=calculateHgsSelfAwareness(input(situationObservation({responseCode:code})));
  expect(result.resultState).toBe('ASSESSED');
  expect(result.numericValue).toBe(value);
 });
 it.each(['TOO_FACET_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'] as const)('treats %s as UNASSESSED null, never zero, never low self-awareness, and never a midpoint',code=>{
  expect(calculateHgsSelfAwareness(input(observation({responseCode:code})))).toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'});
 });
 it('treats a missing observation as UNASSESSED null',()=>{
  expect(calculateHgsSelfAwareness(input(undefined))).toMatchObject({resultState:'UNASSESSED',numericValue:null,missingInputKeys:['observation']});
 });
 it('preserves contradiction as PRESENT_UNRESOLVED null without assessing',()=>{
  expect(calculateHgsSelfAwareness(input(observation(),{contradictoryEvidenceRefs:['memory:20000000-0000-4000-8000-000000000002']})))
   .toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'});
 });
 it.each([
  ['wrong metric',observation({metricKey:'hbs.reflection' as never})],
  ['wrong definition version',observation({definitionVersion:2 as never})],
  ['wrong instrument',observation({instrumentId:'hbs.reflection.direct-context-bound-reflective-engagement-report' as never})],
  ['wrong instrument version',observation({instrumentVersion:2 as never})],
  ['wrong scale',observation({scaleContractReference:'hse.self-confidence.ordinal-5.v1' as never})],
  ['wrong scale version',observation({scaleVersion:2 as never})],
  ['wrong source',observation({source:'LLM_INFERENCE' as never})],
  ['invalid report timestamp',observation({reportTimestamp:'not-a-timestamp'})],
  ['malformed response',observation({responseCode:'PERFECTLY_CLEAR' as never})],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHgsSelfAwareness(input(invalid))).toThrow(BadRequestException);
 });
 // Sibling and foreign observations can never be scored under this model:
 // a Reflection, Motivation, Self-Confidence, HBS, or HRS report carries
 // its own metric key, instrument, scale, and vocabulary, and every one of
 // those mismatches is rejected. Self-Awareness is never derived from
 // Reflection, Motivation, Self-Confidence, any other HGS metric, any HRS
 // metric, Memory, Evidence, or conversation text.
 it.each([
  ['a Reflection observation',observation({metricKey:'hbs.reflection' as never,instrumentId:'hbs.reflection.direct-context-bound-reflective-engagement-report' as never,scaleContractReference:'hbs.reflection.engagement-5.v1' as never,responseCode:'SOMEWHAT' as never})],
  ['an HSE Motivation observation',observation({metricKey:'hse.motivation' as never,instrumentId:'hse.motivation.direct-self-report' as never,scaleContractReference:'hse.motivation.ordinal-5.v1' as never})],
  ['an HSE Self-Confidence observation',observation({metricKey:'hse.self-confidence' as never,instrumentId:'hse.self-confidence.direct-self-report' as never,scaleContractReference:'hse.self-confidence.ordinal-5.v1' as never})],
  ['another HGS metric key',observation({metricKey:'hgs.resilience' as never})],
  ['an HRS Emotional Safety observation',observation({metricKey:'hrs.emotional-safety' as never,instrumentId:'hrs.emotional-safety.direct-relationship-bound-emotional-openness-safety-report' as never,scaleContractReference:'hrs.emotional-safety.openness-safety-5.v1' as never})],
  ['a Reflection engagement code on the Self-Awareness vocabulary',observation({responseCode:'A_GREAT_DEAL' as never})],
  ['an HBS frequency code on the Self-Awareness vocabulary',observation({responseCode:'ALMOST_ALWAYS' as never})],
  ['the Reflection special code',observation({responseCode:'NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT' as never})],
  ['the Trust special code',observation({responseCode:'TOO_CONTEXT_DEPENDENT_TO_RATE' as never})],
  ['the Emotional Safety special code',observation({responseCode:'TOO_VULNERABILITY_DEPENDENT_TO_RATE' as never})],
 ])('rejects %s instead of reusing it',(_name,invalid)=>{
  expect(()=>calculateHgsSelfAwareness(input(invalid))).toThrow(BadRequestException);
 });
 it('depends only on its own observation: extra sibling inputs change nothing (no inverse, composite, or forced correlation)',()=>{
  // High Reflection with VERY_LOW Self-Awareness (and every other sibling
  // combination, including high Motivation with low Self-Awareness and
  // high Self-Awareness with low Motivation) stays expressible: sibling
  // values never derive, mutate, or veto this metric, and a low value
  // never becomes an insight-accuracy or growth conclusion - there is no
  // such field to set.
  const alone=calculateHgsSelfAwareness(input(observation({responseCode:'VERY_LOW'})));
  const crowded=calculateHgsSelfAwareness({...input(observation({responseCode:'VERY_LOW'})),inputs:{observation:observation({responseCode:'VERY_LOW'}),reflectionObservation:{responseCode:'A_GREAT_DEAL'},motivationObservation:{responseCode:'VERY_HIGH'},selfConfidenceObservation:{responseCode:'VERY_HIGH'},conversationText:'I have been thinking about this for weeks and still cannot tell what I feel'}});
  expect(alone.numericValue).toBe(1);
  expect(crowded.numericValue).toBe(1);
  expect(alone).not.toHaveProperty('insightAccuracy');
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
  expect(()=>calculateHgsSelfAwareness(invalid)).toThrow('Self-Awareness exact context mismatch.');
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
  expect(()=>calculateHgsSelfAwareness(input(invalid))).toThrow('Self-Awareness exact GOAL/SITUATION target mismatch.');
 });
 it('rejects any smuggled temporal window instead of interpreting it',()=>{
  expect(()=>calculateHgsSelfAwareness(input({...observation(),windowStart:'2026-08-20T12:00:00.000Z',windowEnd:REPORT} as never))).toThrow('Self-Awareness observation must not carry a temporal window.');
  expect(()=>calculateHgsSelfAwareness(input({...observation(),windowEnd:REPORT} as never))).toThrow('Self-Awareness observation must not carry a temporal window.');
 });
 it('rejects a superseded observation',()=>{
  expect(()=>calculateHgsSelfAwareness(input(observation({superseded:true})))).toThrow('Superseded Self-Awareness observation cannot be calculated.');
 });
});
