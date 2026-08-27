import { BadRequestException } from '@nestjs/common';
import { calculateHrsRelationshipTrust,HRS_RELATIONSHIP_TRUST_MODEL,type HrsRelationshipTrustObservation } from './hrs-relationship-trust.model';
import type { HimMetricCalculationInput } from './him-calculation.types';

const REPORT='2026-08-27T12:00:00.000Z';
const RELATIONSHIP='30000000-0000-4000-8000-000000000001';
const observation=(overrides:Partial<HrsRelationshipTrustObservation>={}):HrsRelationshipTrustObservation=>({
 observationId:'obs-1',measurementEventId:'event-1',userId:'user-1',metricKey:'hrs.relationship-trust',definitionVersion:1,
 contextKind:'RELATIONSHIP',contextId:RELATIONSHIP,target:'my relationship with Ahmed',targetContextKind:'RELATIONSHIP',targetContextId:RELATIONSHIP,
 instrumentId:'hrs.relationship-trust.direct-relationship-bound-reliance-report',instrumentVersion:1,scaleContractReference:'hrs.relationship-trust.reliance-5.v1',scaleVersion:1,
 responseCode:'MODERATE',reportTimestamp:REPORT,
 source:'DIRECT_STRUCTURED_USER_REPORT',superseded:false,...overrides,
});
const input=(o?:HrsRelationshipTrustObservation,overrides:Partial<HimMetricCalculationInput>={}):HimMetricCalculationInput=>({
 metricKey:'hrs.relationship-trust',definitionVersion:1,modelId:HRS_RELATIONSHIP_TRUST_MODEL.modelId,modelVersion:1,
 context:{kind:'RELATIONSHIP',id:o?.contextId??RELATIONSHIP},inputs:o?{observation:o}:{},
 supportingEvidenceRefs:[],contradictoryEvidenceRefs:[],provenance:'QANDEEL_HIM_CALCULATION_RUNTIME_V1',traceId:'trace-1',updateReason:'DIRECT_STRUCTURED_USER_REPORT',...overrides,
});

describe('HRS Relationship Trust measurement model v1',()=>{
 it('freezes the exact calibrated relationship-bound at-report model identity with no temporal window',()=>{
  expect(HRS_RELATIONSHIP_TRUST_MODEL).toMatchObject({
   modelId:'hrs.relationship-trust.direct-structured-current-reliance',modelVersion:1,targetMetricKey:'hrs.relationship-trust',targetDefinitionVersion:1,
   lifecycle:'CALIBRATED',environment:'PRODUCTION',canonicalOwner:'QANDEEL_HIM_GOVERNANCE',
   methodType:'DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT',scaleContractReference:'hrs.relationship-trust.reliance-5.v1',
   requiredEvidenceContract:'FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
   supportedContextKinds:['RELATIONSHIP'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',
  });
  // Relationship Trust is a one-relationship at-report appraisal, never a
  // period measure: the contract exports no window constant at all.
  expect(Object.keys(HRS_RELATIONSHIP_TRUST_MODEL)).not.toEqual(expect.arrayContaining(['windowMs']));
 });
 it.each([['VERY_LOW',1],['LOW',2],['MODERATE',3],['HIGH',4],['VERY_HIGH',5]] as const)('scores %s as ordinal %i on an owned RELATIONSHIP target with no interval arithmetic semantics',(code,value)=>{
  const result=calculateHrsRelationshipTrust(input(observation({responseCode:code})));
  expect(result.resultState).toBe('ASSESSED');
  expect(result.numericValue).toBe(value);
  expect(result.confidenceState).toBe('UNASSESSED');
  expect(result.confidenceReference).toBeNull();
 });
 it.each(['TOO_CONTEXT_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'] as const)('treats %s as UNASSESSED null, never zero, never low trust, and never a midpoint',code=>{
  expect(calculateHrsRelationshipTrust(input(observation({responseCode:code})))).toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'});
 });
 it('treats a missing observation as UNASSESSED null',()=>{
  expect(calculateHrsRelationshipTrust(input(undefined))).toMatchObject({resultState:'UNASSESSED',numericValue:null,missingInputKeys:['observation']});
 });
 it('preserves contradiction as PRESENT_UNRESOLVED null without assessing',()=>{
  expect(calculateHrsRelationshipTrust(input(observation(),{contradictoryEvidenceRefs:['memory:20000000-0000-4000-8000-000000000002']})))
   .toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'});
 });
 it.each([
  ['wrong metric',observation({metricKey:'hrs.communication' as never})],
  ['wrong definition version',observation({definitionVersion:2 as never})],
  ['wrong instrument',observation({instrumentId:'hse.stress.direct-self-report' as never})],
  ['wrong instrument version',observation({instrumentVersion:2 as never})],
  ['wrong scale',observation({scaleContractReference:'hse.stress.ordinal-5.v1' as never})],
  ['wrong scale version',observation({scaleVersion:2 as never})],
  ['wrong source',observation({source:'LLM_INFERENCE' as never})],
  ['invalid report timestamp',observation({reportTimestamp:'not-a-timestamp'})],
  ['malformed response',observation({responseCode:'COMPLETE_TRUST' as never})],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHrsRelationshipTrust(input(invalid))).toThrow(BadRequestException);
 });
 // Sibling and foreign observations can never be scored under this model:
 // an HBS or HSE report carries its own metric key, instrument, scale, and
 // vocabulary, and every one of those mismatches is rejected. Relationship
 // Trust is never derived from Communication, Repair, Emotional Safety, any
 // HBS metric, Memory, Evidence, or conversation text.
 it.each([
  ['a Reflection observation',observation({metricKey:'hbs.reflection' as never,instrumentId:'hbs.reflection.direct-context-bound-reflective-engagement-report' as never,scaleContractReference:'hbs.reflection.engagement-5.v1' as never,responseCode:'SOMEWHAT' as never})],
  ['an Avoidance observation',observation({metricKey:'hbs.avoidance' as never,instrumentId:'hbs.avoidance.direct-target-bound-seven-day-report' as never,scaleContractReference:'hbs.avoidance.frequency-5.v1' as never,responseCode:'OFTEN' as never})],
  ['an HSE Motivation observation',observation({metricKey:'hse.motivation' as never,instrumentId:'hse.motivation.direct-self-report' as never,scaleContractReference:'hse.motivation.ordinal-5.v1' as never})],
  ['an HBS frequency code on the Trust vocabulary',observation({responseCode:'ALMOST_ALWAYS' as never})],
  ['the Reflection special code',observation({responseCode:'NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT' as never})],
  ['the Avoidance special code',observation({responseCode:'NO_CLEAR_OPPORTUNITY' as never})],
  ['the Consistency special code',observation({responseCode:'INSUFFICIENT_REPEATED_OPPORTUNITIES' as never})],
 ])('rejects %s instead of reusing it',(_name,invalid)=>{
  expect(()=>calculateHrsRelationshipTrust(input(invalid))).toThrow(BadRequestException);
 });
 it('depends only on its own observation: extra sibling inputs change nothing (no inverse or composite)',()=>{
  const alone=calculateHrsRelationshipTrust(input(observation({responseCode:'VERY_HIGH'})));
  const crowded=calculateHrsRelationshipTrust({...input(observation({responseCode:'VERY_HIGH'})),inputs:{observation:observation({responseCode:'VERY_HIGH'}),communicationObservation:{responseCode:'VERY_LOW'},repairObservation:{responseCode:'VERY_LOW'},emotionalSafetyObservation:{responseCode:'VERY_LOW'},avoidanceObservation:{responseCode:'ALMOST_ALWAYS'},conversationText:'I am not sure I can count on him'}});
  expect(alone.numericValue).toBe(5);
  expect(crowded.numericValue).toBe(5);
 });
 it.each([
  ['unsupported GOAL context',{...input(observation()),context:{kind:'GOAL' as const,id:RELATIONSHIP}}],
  ['unsupported SITUATION context',{...input(observation()),context:{kind:'SITUATION' as const,id:'difficult team meeting'}}],
  ['unsupported CONVERSATION_SESSION context',{...input(observation()),context:{kind:'CONVERSATION_SESSION' as const,id:RELATIONSHIP}}],
  ['unsupported GLOBAL context',{...input(observation()),context:{kind:'GLOBAL' as const,id:'GLOBAL'}}],
  ['context id mismatch',{...input(observation()),context:{kind:'RELATIONSHIP' as const,id:'99999999-0000-4000-8000-000000000009'}}],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHrsRelationshipTrust(invalid)).toThrow('Relationship Trust exact context mismatch.');
 });
 it.each([
  ['forged divergent target id',observation({targetContextId:'99999999-0000-4000-8000-000000000009'})],
  ['missing target label',observation({target:null as never})],
  ['empty target label',observation({target:''})],
  ['untrimmed target label',observation({target:' padded '})],
  ['oversized target label',observation({target:'x'.repeat(257)})],
  ['null target context kind',observation({targetContextKind:null as never})],
  ['foreign target context kind',observation({targetContextKind:'SITUATION' as never})],
 ])('rejects a forged RELATIONSHIP target shape: %s',(_name,invalid)=>{
  expect(()=>calculateHrsRelationshipTrust(input(invalid))).toThrow('Relationship Trust exact RELATIONSHIP target mismatch.');
 });
 it('rejects any smuggled temporal window instead of interpreting it',()=>{
  expect(()=>calculateHrsRelationshipTrust(input({...observation(),windowStart:'2026-08-20T12:00:00.000Z',windowEnd:REPORT} as never))).toThrow('Relationship Trust observation must not carry a temporal window.');
  expect(()=>calculateHrsRelationshipTrust(input({...observation(),windowEnd:REPORT} as never))).toThrow('Relationship Trust observation must not carry a temporal window.');
 });
 it('rejects a superseded observation',()=>{
  expect(()=>calculateHrsRelationshipTrust(input(observation({superseded:true})))).toThrow('Superseded Relationship Trust observation cannot be calculated.');
 });
});
