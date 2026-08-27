import { BadRequestException } from '@nestjs/common';
import { calculateHrsRepair,HRS_REPAIR_MODEL,type HrsRepairObservation } from './hrs-repair.model';
import type { HimMetricCalculationInput } from './him-calculation.types';

const REPORT='2026-08-27T12:00:00.000Z';
const RELATIONSHIP='32000000-0000-4000-8000-000000000001';
const observation=(overrides:Partial<HrsRepairObservation>={}):HrsRepairObservation=>({
 observationId:'obs-1',measurementEventId:'event-1',userId:'user-1',metricKey:'hrs.repair',definitionVersion:1,
 contextKind:'RELATIONSHIP',contextId:RELATIONSHIP,target:'my relationship with Ahmed',targetContextKind:'RELATIONSHIP',targetContextId:RELATIONSHIP,
 instrumentId:'hrs.repair.direct-relationship-bound-repair-effectiveness-report',instrumentVersion:1,scaleContractReference:'hrs.repair.effectiveness-5.v1',scaleVersion:1,
 responseCode:'MODERATE',reportTimestamp:REPORT,
 source:'DIRECT_STRUCTURED_USER_REPORT',superseded:false,...overrides,
});
const input=(o?:HrsRepairObservation,overrides:Partial<HimMetricCalculationInput>={}):HimMetricCalculationInput=>({
 metricKey:'hrs.repair',definitionVersion:1,modelId:HRS_REPAIR_MODEL.modelId,modelVersion:1,
 context:{kind:'RELATIONSHIP',id:o?.contextId??RELATIONSHIP},inputs:o?{observation:o}:{},
 supportingEvidenceRefs:[],contradictoryEvidenceRefs:[],provenance:'QANDEEL_HIM_CALCULATION_RUNTIME_V1',traceId:'trace-1',updateReason:'DIRECT_STRUCTURED_USER_REPORT',...overrides,
});

describe('HRS Repair measurement model v1',()=>{
 it('freezes the exact calibrated relationship-bound at-report model identity with no temporal window',()=>{
  expect(HRS_REPAIR_MODEL).toMatchObject({
   modelId:'hrs.repair.direct-structured-current-repair-effectiveness',modelVersion:1,targetMetricKey:'hrs.repair',targetDefinitionVersion:1,
   lifecycle:'CALIBRATED',environment:'PRODUCTION',canonicalOwner:'QANDEEL_HIM_GOVERNANCE',
   methodType:'DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT',scaleContractReference:'hrs.repair.effectiveness-5.v1',
   requiredEvidenceContract:'FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',
   supportedContextKinds:['RELATIONSHIP'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',
  });
  // Repair is a one-relationship at-report appraisal grounded in actual
  // prior repair opportunities, never a period measure: the contract
  // exports no window constant at all.
  expect(Object.keys(HRS_REPAIR_MODEL)).not.toEqual(expect.arrayContaining(['windowMs']));
 });
 it.each([['VERY_LOW',1],['LOW',2],['MODERATE',3],['HIGH',4],['VERY_HIGH',5]] as const)('scores %s as ordinal %i on an owned RELATIONSHIP target with no interval arithmetic semantics',(code,value)=>{
  const result=calculateHrsRepair(input(observation({responseCode:code})));
  expect(result.resultState).toBe('ASSESSED');
  expect(result.numericValue).toBe(value);
  expect(result.confidenceState).toBe('UNASSESSED');
  expect(result.confidenceReference).toBeNull();
 });
 // Absence of conflict is never evidence of repair ability: the missing
 // repair opportunity becomes UNASSESSED/null - never a high score because
 // the relationship did not recently fight, and never a low score.
 it.each(['NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_EPISODE_DEPENDENT_TO_RATE','NOT_SURE'] as const)('treats %s as UNASSESSED null, never zero, never good or poor repair, and never a midpoint',code=>{
  expect(calculateHrsRepair(input(observation({responseCode:code})))).toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'});
 });
 it('treats a missing observation as UNASSESSED null',()=>{
  expect(calculateHrsRepair(input(undefined))).toMatchObject({resultState:'UNASSESSED',numericValue:null,missingInputKeys:['observation']});
 });
 it('preserves contradiction as PRESENT_UNRESOLVED null without assessing',()=>{
  expect(calculateHrsRepair(input(observation(),{contradictoryEvidenceRefs:['memory:20000000-0000-4000-8000-000000000002']})))
   .toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'});
 });
 it.each([
  ['wrong metric',observation({metricKey:'hrs.communication' as never})],
  ['wrong definition version',observation({definitionVersion:2 as never})],
  ['wrong instrument',observation({instrumentId:'hrs.communication.direct-relationship-bound-communication-workability-report' as never})],
  ['wrong instrument version',observation({instrumentVersion:2 as never})],
  ['wrong scale',observation({scaleContractReference:'hrs.communication.workability-5.v1' as never})],
  ['wrong scale version',observation({scaleVersion:2 as never})],
  ['wrong source',observation({source:'LLM_INFERENCE' as never})],
  ['invalid report timestamp',observation({reportTimestamp:'not-a-timestamp'})],
  ['malformed response',observation({responseCode:'FULLY_RECONCILED' as never})],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHrsRepair(input(invalid))).toThrow(BadRequestException);
 });
 // Sibling and foreign observations can never be scored under this model:
 // a Trust, Communication, HBS, or HSE report carries its own metric key,
 // instrument, scale, and vocabulary, and every one of those mismatches is
 // rejected. Repair is never derived from Trust, Communication, Emotional
 // Safety, any HBS metric, Memory, Evidence, or conversation text.
 it.each([
  ['a Relationship Trust observation',observation({metricKey:'hrs.relationship-trust' as never,instrumentId:'hrs.relationship-trust.direct-relationship-bound-reliance-report' as never,scaleContractReference:'hrs.relationship-trust.reliance-5.v1' as never})],
  ['a Communication observation',observation({metricKey:'hrs.communication' as never,instrumentId:'hrs.communication.direct-relationship-bound-communication-workability-report' as never,scaleContractReference:'hrs.communication.workability-5.v1' as never})],
  ['an Avoidance observation',observation({metricKey:'hbs.avoidance' as never,instrumentId:'hbs.avoidance.direct-target-bound-seven-day-report' as never,scaleContractReference:'hbs.avoidance.frequency-5.v1' as never,responseCode:'OFTEN' as never})],
  ['an HSE Stress observation',observation({metricKey:'hse.stress' as never,instrumentId:'hse.stress.direct-self-report' as never,scaleContractReference:'hse.stress.ordinal-5.v1' as never})],
  ['an HBS frequency code on the Repair vocabulary',observation({responseCode:'ALMOST_ALWAYS' as never})],
  ['the Trust special code',observation({responseCode:'TOO_CONTEXT_DEPENDENT_TO_RATE' as never})],
  ['the Communication special code',observation({responseCode:'TOO_TOPIC_DEPENDENT_TO_RATE' as never})],
  ['the Communication basis special code',observation({responseCode:'INSUFFICIENT_BASIS_TO_JUDGE' as never})],
 ])('rejects %s instead of reusing it',(_name,invalid)=>{
  expect(()=>calculateHrsRepair(input(invalid))).toThrow(BadRequestException);
 });
 it('depends only on its own observation: extra sibling inputs change nothing (no inverse or composite)',()=>{
  const alone=calculateHrsRepair(input(observation({responseCode:'LOW'})));
  const crowded=calculateHrsRepair({...input(observation({responseCode:'LOW'})),inputs:{observation:observation({responseCode:'LOW'}),trustObservation:{responseCode:'VERY_LOW'},communicationObservation:{responseCode:'VERY_HIGH'},emotionalSafetyObservation:{responseCode:'VERY_LOW'},conversationText:'we made up after the fight'}});
  expect(alone.numericValue).toBe(2);
  expect(crowded.numericValue).toBe(2);
 });
 it.each([
  ['unsupported GOAL context',{...input(observation()),context:{kind:'GOAL' as const,id:RELATIONSHIP}}],
  ['unsupported SITUATION context',{...input(observation()),context:{kind:'SITUATION' as const,id:'difficult team meeting'}}],
  ['unsupported CONVERSATION_SESSION context',{...input(observation()),context:{kind:'CONVERSATION_SESSION' as const,id:RELATIONSHIP}}],
  ['unsupported GLOBAL context',{...input(observation()),context:{kind:'GLOBAL' as const,id:'GLOBAL'}}],
  ['context id mismatch',{...input(observation()),context:{kind:'RELATIONSHIP' as const,id:'99999999-0000-4000-8000-000000000009'}}],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHrsRepair(invalid)).toThrow('Repair exact context mismatch.');
 });
 it.each([
  ['forged divergent target id',observation({targetContextId:'99999999-0000-4000-8000-000000000009'})],
  ['missing target label',observation({target:null as never})],
  ['empty target label',observation({target:''})],
  ['untrimmed target label',observation({target:' padded '})],
  ['oversized target label',observation({target:'x'.repeat(257)})],
  ['null target context kind',observation({targetContextKind:null as never})],
  ['foreign target context kind',observation({targetContextKind:'GOAL' as never})],
 ])('rejects a forged RELATIONSHIP target shape: %s',(_name,invalid)=>{
  expect(()=>calculateHrsRepair(input(invalid))).toThrow('Repair exact RELATIONSHIP target mismatch.');
 });
 it('rejects any smuggled temporal window instead of interpreting it',()=>{
  expect(()=>calculateHrsRepair(input({...observation(),windowStart:'2026-08-20T12:00:00.000Z',windowEnd:REPORT} as never))).toThrow('Repair observation must not carry a temporal window.');
  expect(()=>calculateHrsRepair(input({...observation(),windowEnd:REPORT} as never))).toThrow('Repair observation must not carry a temporal window.');
 });
 it('rejects a superseded observation',()=>{
  expect(()=>calculateHrsRepair(input(observation({superseded:true})))).toThrow('Superseded Repair observation cannot be calculated.');
 });
});
