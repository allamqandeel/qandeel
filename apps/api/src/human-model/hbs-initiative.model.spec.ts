import { BadRequestException } from '@nestjs/common';
import { calculateHbsInitiative,HBS_INITIATIVE_MODEL,HBS_INITIATIVE_WINDOW_MS,type HbsInitiativeObservation } from './hbs-initiative.model';
import type { HimMetricCalculationInput } from './him-calculation.types';

const REPORT='2026-08-27T12:00:00.000Z';
const WINDOW_START='2026-08-20T12:00:00.000Z';
const observation=(overrides:Partial<HbsInitiativeObservation>={}):HbsInitiativeObservation=>({
 observationId:'obs-1',measurementEventId:'event-1',userId:'user-1',metricKey:'hbs.initiative',definitionVersion:1,
 contextKind:'GOAL',contextId:'10000000-0000-4000-8000-000000000001',target:'finish thesis draft',targetContextKind:'GOAL',targetContextId:'10000000-0000-4000-8000-000000000001',
 instrumentId:'hbs.initiative.direct-target-bound-seven-day-report',instrumentVersion:1,scaleContractReference:'hbs.initiative.frequency-5.v1',scaleVersion:1,
 responseCode:'SOMETIMES',reportTimestamp:REPORT,windowStart:WINDOW_START,windowEnd:REPORT,
 source:'DIRECT_STRUCTURED_USER_REPORT',superseded:false,...overrides,
});
const input=(o?:HbsInitiativeObservation,overrides:Partial<HimMetricCalculationInput>={}):HimMetricCalculationInput=>({
 metricKey:'hbs.initiative',definitionVersion:1,modelId:HBS_INITIATIVE_MODEL.modelId,modelVersion:1,
 context:{kind:'GOAL',id:'10000000-0000-4000-8000-000000000001'},inputs:o?{observation:o}:{},
 supportingEvidenceRefs:[],contradictoryEvidenceRefs:[],provenance:'QANDEEL_HIM_CALCULATION_RUNTIME_V1',traceId:'trace-1',updateReason:'DIRECT_STRUCTURED_USER_REPORT',...overrides,
});

describe('HBS Initiative measurement model v1',()=>{
 it('freezes the exact calibrated target-bound seven-day model identity',()=>{
  expect(HBS_INITIATIVE_MODEL).toMatchObject({
   modelId:'hbs.initiative.direct-structured-seven-day-self-report',modelVersion:1,targetMetricKey:'hbs.initiative',targetDefinitionVersion:1,
   lifecycle:'CALIBRATED',environment:'PRODUCTION',canonicalOwner:'QANDEEL_HIM_GOVERNANCE',
   methodType:'DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_REPORT',scaleContractReference:'hbs.initiative.frequency-5.v1',
   requiredEvidenceContract:'FIRST_CLASS_TARGET_BOUND_PERIOD_HIM_MEASUREMENT_OBSERVATION_V1',
   supportedContextKinds:['GOAL','SITUATION'],missingDataBehavior:'UNASSESSED',contradictionBehavior:'UNASSESSED_PRESERVE_CONFLICT',confidenceContract:'UNRESOLVED_METRIC_CONFIDENCE',
  });
  expect(HBS_INITIATIVE_WINDOW_MS).toBe(604_800_000);
 });
 it.each([['NEVER',1],['RARELY',2],['SOMETIMES',3],['OFTEN',4],['ALMOST_ALWAYS',5]] as const)('scores %s as ordinal %i with no interval arithmetic semantics',(code,value)=>{
  const result=calculateHbsInitiative(input(observation({responseCode:code})));
  expect(result.resultState).toBe('ASSESSED');
  expect(result.numericValue).toBe(value);
  expect(result.confidenceState).toBe('UNASSESSED');
  expect(result.confidenceReference).toBeNull();
 });
 it.each(['NO_CLEAR_SELF_OWNED_OPPORTUNITY','NOT_SURE'] as const)('treats %s as UNASSESSED null, never zero',code=>{
  const result=calculateHbsInitiative(input(observation({responseCode:code})));
  expect(result).toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'});
 });
 it('treats a missing observation as UNASSESSED null',()=>{
  expect(calculateHbsInitiative(input(undefined))).toMatchObject({resultState:'UNASSESSED',numericValue:null,missingInputKeys:['observation']});
 });
 it('preserves contradiction as PRESENT_UNRESOLVED null without assessing',()=>{
  expect(calculateHbsInitiative(input(observation(),{contradictoryEvidenceRefs:['memory:20000000-0000-4000-8000-000000000002']})))
   .toMatchObject({resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'});
 });
 it.each([
  ['wrong metric',observation({metricKey:'hse.motivation' as never})],
  ['wrong definition version',observation({definitionVersion:2 as never})],
  ['wrong instrument',observation({instrumentId:'hse.motivation.direct-self-report' as never})],
  ['wrong instrument version',observation({instrumentVersion:2 as never})],
  ['wrong scale',observation({scaleContractReference:'hse.motivation.ordinal-5.v1' as never})],
  ['wrong scale version',observation({scaleVersion:2 as never})],
  ['wrong source',observation({source:'LLM_INFERENCE' as never})],
  ['malformed response',observation({responseCode:'ALWAYS' as never})],
 ])('rejects %s',(_name,invalid)=>{
  expect(()=>calculateHbsInitiative(input(invalid))).toThrow(BadRequestException);
 });
 // Sibling-metric and Avoidance observations can never be scored under this
 // model: a Consistency or Avoidance report carries its own metric key,
 // instrument, scale, and vocabulary, and every one of those mismatches is
 // rejected. Initiative is never derived from a sibling.
 it.each([
  ['a sibling Consistency observation',observation({metricKey:'hbs.consistency' as never,instrumentId:'hbs.consistency.direct-target-bound-seven-day-report' as never,scaleContractReference:'hbs.consistency.frequency-5.v1' as never})],
  ['an Avoidance observation',observation({metricKey:'hbs.avoidance' as never,instrumentId:'hbs.avoidance.direct-target-bound-seven-day-report' as never,scaleContractReference:'hbs.avoidance.frequency-5.v1' as never,responseCode:'NO_CLEAR_OPPORTUNITY' as never})],
  ['a sibling special code on its own vocabulary',observation({responseCode:'INSUFFICIENT_REPEATED_OPPORTUNITIES' as never})],
  ['the Avoidance special code',observation({responseCode:'NO_CLEAR_OPPORTUNITY' as never})],
 ])('rejects %s instead of reusing it',(_name,invalid)=>{
  expect(()=>calculateHbsInitiative(input(invalid))).toThrow(BadRequestException);
 });
 it('depends only on its own observation: extra sibling inputs change nothing (no inverse or composite)',()=>{
  const alone=calculateHbsInitiative(input(observation({responseCode:'NEVER'})));
  const crowded=calculateHbsInitiative({...input(observation({responseCode:'NEVER'})),inputs:{observation:observation({responseCode:'NEVER'}),avoidanceObservation:{responseCode:'NEVER'},consistencyObservation:{responseCode:'ALMOST_ALWAYS'}}});
  expect(alone.numericValue).toBe(1);
  expect(crowded.numericValue).toBe(1);
 });
 it.each([
  ['context mismatch',observation({contextId:'99999999-0000-4000-8000-000000000009',targetContextId:'99999999-0000-4000-8000-000000000009'})],
  ['target/context divergence',observation({targetContextId:'99999999-0000-4000-8000-000000000009'})],
  ['SITUATION observation against GOAL input',observation({contextKind:'SITUATION' as const,targetContextKind:'SITUATION' as const})],
  ['empty target label',observation({target:''})],
  ['untrimmed target label',observation({target:' padded '})],
 ])('rejects wrong GOAL/SITUATION target identity: %s',(_name,invalid)=>{
  expect(()=>calculateHbsInitiative(input(invalid))).toThrow('Initiative exact target/context mismatch.');
 });
 it.each([
  ['malformed window start',observation({windowStart:'not-a-timestamp'})],
  ['malformed window end',observation({windowEnd:'not-a-timestamp'})],
  ['shifted six-day window',observation({windowStart:'2026-08-21T12:00:00.000Z'})],
  ['oversized eight-day window',observation({windowStart:'2026-08-19T12:00:00.000Z'})],
  ['window ending after the report',observation({windowStart:'2026-08-21T00:00:00.000Z',windowEnd:'2026-08-28T00:00:00.000Z'})],
 ])('rejects a non-seven-day or shifted window: %s',(_name,invalid)=>{
  expect(()=>calculateHbsInitiative(input(invalid))).toThrow('Initiative seven-day observation window mismatch.');
 });
 it('accepts the original preserved window on a later corrected report timestamp',()=>{
  const corrected=observation({reportTimestamp:'2026-08-27T13:30:00.000Z'});
  expect(calculateHbsInitiative(input(corrected)).resultState).toBe('ASSESSED');
 });
 it('rejects a superseded observation',()=>{
  expect(()=>calculateHbsInitiative(input(observation({superseded:true})))).toThrow('Superseded Initiative observation cannot be calculated.');
 });
});
