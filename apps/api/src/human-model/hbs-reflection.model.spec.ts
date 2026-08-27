import { BadRequestException } from '@nestjs/common';
import { calculateHbsReflection,HBS_REFLECTION_MODEL,type HbsReflectionObservation } from './hbs-reflection.model';
import type { HimMetricCalculationInput } from './him-calculation.types';

const REPORT='2026-08-27T12:00:00.000Z';
const SESSION='20000000-0000-4000-8000-000000000001';
const situationObservation=(overrides:Partial<HbsReflectionObservation>={}):HbsReflectionObservation=>({
 observationId:'obs-1',measurementEventId:'event-1',userId:'user-1',metricKey:'hbs.reflection',definitionVersion:1,
 contextKind:'SITUATION',contextId:'10000000-0000-4000-8000-000000000001',target:'difficult team meeting',targetContextKind:'SITUATION',targetContextId:'10000000-0000-4000-8000-000000000001',
 instrumentId:'hbs.reflection.direct-context-bound-reflective-engagement-report',instrumentVersion:1,scaleContractReference:'hbs.reflection.engagement-5.v1',scaleVersion:1,
 responseCode:'SOMEWHAT',reportTimestamp:REPORT,
 source:'DIRECT_STRUCTURED_USER_REPORT',superseded:false,...overrides,
});
const sessionObservation=(overrides:Partial<HbsReflectionObservation>={}):HbsReflectionObservation=>situationObservation({
 contextKind:'CONVERSATION_SESSION',contextId:SESSION,target:null,targetContextKind:null,targetContextId:null,...overrides,
});
const input=(o?:HbsReflectionObservation,overrides:Partial<HimMetricCalculationInput>={}):HimMetricCalculationInput=>({
 metricKey:'hbs.reflection',definitionVersion:1,modelId:HBS_REFLECTION_MODEL.modelId,modelVersion:1,
 context:{kind:o?.contextKind??'SITUATION',id:o?.contextId??'10000000-0000-4000-8000-000000000001'},inputs:o?{observation:o}:{},
 supportingEvidenceRefs:[],contradictoryEvidenceRefs:[],provenance:'QANDEEL_HIM_CALCULATION_RUNTIME_V1',traceId:'trace-1',updateReason:'DIRECT_STRUCTURED_USER_REPORT',...overrides,
});

describe('HBS Reflection measurement model v1',()=>{
 it('freezes the exact calibrated context-bound at-report model identity with no temporal window',()=>{
  expect(HBS_REFLECTION_MODEL).toMatchObject({
   modelId:'hbs.reflection.direct-structured-context-bound-reflective-engagement',modelVersion:1,targetMetricKey:'hbs.reflection',targetDefinitionVersion:1,
   lifecycle:'CALIBRATED',environment:'PRODUCTION',canonicalOwner:'QANDEEL_HIM_GOVERNANCE',
   methodType:'DIRECT_STRUCTURED_CONTEXT_BOUND_REFLECTIVE_ENGAGEMENT_REPORT',scaleContractReference:'hbs.reflection.engagement-5.v1',
   requiredEvidenceContract:'FIRST_CLASS_AUTHORIZED_CONTEXT_HIM_MEASUREMENT_OBSERVATION_V1',
   supportedContextKinds:['SITUATION','CONVERSATION_SESSION'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',
  });
  // Reflection is a one-context at-report assessment, never a period
  // measure: the contract exports no seven-day window constant at all.
  expect(Object.keys(HBS_REFLECTION_MODEL)).not.toEqual(expect.arrayContaining(['windowMs']));
 });
 it.each([['NOT_AT_ALL',1],['A_LITTLE',2],['SOMEWHAT',3],['QUITE_A_BIT',4],['A_GREAT_DEAL',5]] as const)('scores %s as ordinal %i on a SITUATION with no interval arithmetic semantics',(code,value)=>{
  const result=calculateHbsReflection(input(situationObservation({responseCode:code})));
  expect(result.resultState).toBe('ASSESSED');
  expect(result.numericValue).toBe(value);
  expect(result.confidenceState).toBe('UNASSESSED');
  expect(result.confidenceReference).toBeNull();
 });
 it.each([['NOT_AT_ALL',1],['A_GREAT_DEAL',5]] as const)('scores %s as ordinal %i on a CONVERSATION_SESSION with null target fields',(code,value)=>{
  const result=calculateHbsReflection(input(sessionObservation({responseCode:code})));
  expect(result.resultState).toBe('ASSESSED');
  expect(result.numericValue).toBe(value);
 });
 it.each(['NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NOT_SURE'] as const)('treats %s as UNASSESSED null, never zero and never a low score',code=>{
  expect(calculateHbsReflection(input(situationObservation({responseCode:code})))).toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'});
  expect(calculateHbsReflection(input(sessionObservation({responseCode:code})))).toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'});
 });
 it('treats a missing observation as UNASSESSED null',()=>{
  expect(calculateHbsReflection(input(undefined))).toMatchObject({resultState:'UNASSESSED',numericValue:null,missingInputKeys:['observation']});
 });
 it('preserves contradiction as PRESENT_UNRESOLVED null without assessing',()=>{
  expect(calculateHbsReflection(input(situationObservation(),{contradictoryEvidenceRefs:['memory:20000000-0000-4000-8000-000000000002']})))
   .toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'});
 });
 it.each([
  ['wrong metric',situationObservation({metricKey:'hgs.self-awareness' as never})],
  ['wrong definition version',situationObservation({definitionVersion:2 as never})],
  ['wrong instrument',situationObservation({instrumentId:'hse.stress.direct-self-report' as never})],
  ['wrong instrument version',situationObservation({instrumentVersion:2 as never})],
  ['wrong scale',situationObservation({scaleContractReference:'hse.stress.ordinal-5.v1' as never})],
  ['wrong scale version',situationObservation({scaleVersion:2 as never})],
  ['wrong source',situationObservation({source:'LLM_INFERENCE' as never})],
  ['invalid report timestamp',situationObservation({reportTimestamp:'not-a-timestamp'})],
  ['malformed response',situationObservation({responseCode:'A_LOT' as never})],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHbsReflection(input(invalid))).toThrow(BadRequestException);
 });
 // Sibling HBS observations can never be scored under this model: an
 // Avoidance, Consistency, or Initiative report carries its own metric key,
 // instrument, scale, and frequency vocabulary, and every one of those
 // mismatches is rejected. Reflection is never derived from a sibling, from
 // Self-awareness, or from conversation text.
 it.each([
  ['an Avoidance observation',situationObservation({metricKey:'hbs.avoidance' as never,instrumentId:'hbs.avoidance.direct-target-bound-seven-day-report' as never,scaleContractReference:'hbs.avoidance.frequency-5.v1' as never,responseCode:'OFTEN' as never})],
  ['a Consistency observation',situationObservation({metricKey:'hbs.consistency' as never,instrumentId:'hbs.consistency.direct-target-bound-seven-day-report' as never,scaleContractReference:'hbs.consistency.frequency-5.v1' as never,responseCode:'SOMETIMES' as never})],
  ['an Initiative observation',situationObservation({metricKey:'hbs.initiative' as never,instrumentId:'hbs.initiative.direct-target-bound-seven-day-report' as never,scaleContractReference:'hbs.initiative.frequency-5.v1' as never,responseCode:'NEVER' as never})],
  ['a sibling frequency code on the Reflection vocabulary',situationObservation({responseCode:'ALMOST_ALWAYS' as never})],
  ['the Avoidance special code',situationObservation({responseCode:'NO_CLEAR_OPPORTUNITY' as never})],
  ['the Consistency special code',situationObservation({responseCode:'INSUFFICIENT_REPEATED_OPPORTUNITIES' as never})],
  ['the Initiative special code',situationObservation({responseCode:'NO_CLEAR_SELF_OWNED_OPPORTUNITY' as never})],
 ])('rejects %s instead of reusing it',(_name,invalid)=>{
  expect(()=>calculateHbsReflection(input(invalid))).toThrow(BadRequestException);
 });
 it('depends only on its own observation: extra sibling inputs change nothing (no inverse or composite)',()=>{
  const alone=calculateHbsReflection(input(situationObservation({responseCode:'A_GREAT_DEAL'})));
  const crowded=calculateHbsReflection({...input(situationObservation({responseCode:'A_GREAT_DEAL'})),inputs:{observation:situationObservation({responseCode:'A_GREAT_DEAL'}),avoidanceObservation:{responseCode:'ALMOST_ALWAYS'},selfAwareness:{score:1},conversationText:'I kept replaying it all night'}});
  expect(alone.numericValue).toBe(5);
  expect(crowded.numericValue).toBe(5);
 });
 it.each([
  ['unsupported GOAL context',{...input(situationObservation()),context:{kind:'GOAL' as const,id:'10000000-0000-4000-8000-000000000001'}}],
  ['unsupported GLOBAL context',{...input(situationObservation()),context:{kind:'GLOBAL' as const,id:'GLOBAL'}}],
  ['context kind mismatch',{...input(situationObservation()),context:{kind:'CONVERSATION_SESSION' as const,id:'10000000-0000-4000-8000-000000000001'}}],
  ['context id mismatch',{...input(situationObservation()),context:{kind:'SITUATION' as const,id:'99999999-0000-4000-8000-000000000009'}}],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHbsReflection(invalid)).toThrow('Reflection exact context mismatch.');
 });
 it.each([
  ['forged divergent target id',situationObservation({targetContextId:'99999999-0000-4000-8000-000000000009'})],
  ['missing target label',situationObservation({target:null})],
  ['empty target label',situationObservation({target:''})],
  ['untrimmed target label',situationObservation({target:' padded '})],
  ['oversized target label',situationObservation({target:'x'.repeat(257)})],
  ['null target context kind',situationObservation({targetContextKind:null})],
 ])('rejects a forged SITUATION target shape: %s',(_name,invalid)=>{
  expect(()=>calculateHbsReflection(input(invalid))).toThrow('Reflection exact SITUATION target mismatch.');
 });
 it.each([
  ['a fake session target label',sessionObservation({target:'fake session target'})],
  ['a fake session target kind',sessionObservation({targetContextKind:'SITUATION'})],
  ['a fake session target id',sessionObservation({targetContextId:SESSION})],
 ])('rejects non-null session target fields: %s',(_name,invalid)=>{
  expect(()=>calculateHbsReflection(input(invalid))).toThrow('Reflection session observation must carry null target fields.');
 });
 it('rejects any smuggled temporal window instead of interpreting it',()=>{
  expect(()=>calculateHbsReflection(input({...situationObservation(),windowStart:'2026-08-20T12:00:00.000Z',windowEnd:REPORT} as never))).toThrow('Reflection observation must not carry a temporal window.');
  expect(()=>calculateHbsReflection(input({...sessionObservation(),windowEnd:REPORT} as never))).toThrow('Reflection observation must not carry a temporal window.');
 });
 it('rejects a superseded observation',()=>{
  expect(()=>calculateHbsReflection(input(situationObservation({superseded:true})))).toThrow('Superseded Reflection observation cannot be calculated.');
 });
});
