import type { HimReasoningContext,HimReasoningMetric } from '../human-model/him-reasoning-consumption.types';
import { HIM_HYPOTHESIS_GENERATION_METRIC_KEYS,projectHimHypothesisGenerationContext } from './him-hypothesis-generation-context';

// HIM Runtime Consumption v1: the bounded provider-facing minimization. Exactly
// three canonical CONVERSATION_SESSION metric states, canonical order, KNOWN
// keeps only its ordinal category, UNKNOWN stays null, valid EMPTY becomes
// three explicit UNKNOWN entries, and nothing sensitive or internal leaks.
const known=(metricKey:string,ordinalCategory:HimReasoningMetric['ordinalCategory']):HimReasoningMetric=>({metricKey,definitionVersion:1,semanticType:'STATE',knowledgeState:'KNOWN',unknownReason:null,ordinalCategory,observationQualifier:'LATEST_KNOWN',scaleReference:`scale-${metricKey}`,scaleVersion:1,observedAt:'2026-08-23T00:00:00.000Z',freshnessState:'UNASSESSED',freshnessReference:null,confidenceState:'UNASSESSED',confidenceReference:null,validityStatus:'VALID',measurementEventId:`event-${metricKey}`,measurementObservationId:`observation-${metricKey}`,calculationResultId:`result-${metricKey}`,canonicalBindingId:`binding-${metricKey}`,instrumentId:`instrument-${metricKey}`,instrumentVersion:1,modelId:`model-${metricKey}`,modelVersion:1});
const unknown=(metricKey:string):HimReasoningMetric=>({...known(metricKey,null),knowledgeState:'UNKNOWN',unknownReason:'NO_MEASUREMENT',ordinalCategory:null,observationQualifier:null,scaleReference:null,scaleVersion:null,observedAt:null,validityStatus:null,measurementEventId:null,measurementObservationId:null,calculationResultId:null,canonicalBindingId:null,instrumentId:null,instrumentVersion:null,modelId:null,modelVersion:null});
const reasoning=(metrics:HimReasoningMetric[],overrides:Partial<HimReasoningContext>={}):HimReasoningContext=>{const assessed=metrics.filter(m=>m.knowledgeState==='KNOWN').length;return{source:'HIM_INTELLIGENCE_SNAPSHOT',sourceSnapshotContractVersion:1,contextKind:'CONVERSATION_SESSION',contextId:'00000000-0000-4000-8000-000000000010',generatedAt:'2026-08-24T00:00:00.000Z',coverageState:assessed===metrics.length?'FULL':assessed===0?'EMPTY':'PARTIAL',eligibleMetricCount:metrics.length,assessedMetricCount:assessed,unassessedMetricCount:metrics.length-assessed,metrics,...overrides};};
const partial=()=>reasoning([known('hse.stress','HIGH'),unknown('hse.energy'),unknown('hse.attention')]);

describe('projectHimHypothesisGenerationContext',()=>{
 it('freezes exactly the three canonical session metric keys in canonical order',()=>{expect([...HIM_HYPOTHESIS_GENERATION_METRIC_KEYS]).toEqual(['hse.stress','hse.energy','hse.attention']);});
 it.each([['VERY_LOW'],['LOW'],['MODERATE'],['HIGH'],['VERY_HIGH']] as const)('maps KNOWN only to the canonical ordinal category %s',category=>{
  const result=projectHimHypothesisGenerationContext(reasoning([known('hse.stress',category),unknown('hse.energy'),unknown('hse.attention')]));
  expect(result.metrics[0]).toEqual({metricKey:'hse.stress',knowledgeState:'KNOWN',ordinalCategory:category});
 });
 it('maps UNKNOWN to a null category and never invents another meaning',()=>{
  const result=projectHimHypothesisGenerationContext(partial());
  expect(result).toEqual({contractVersion:1,source:'HIM_STRUCTURED_STATE',contextKind:'CONVERSATION_SESSION',metrics:[{metricKey:'hse.stress',knowledgeState:'KNOWN',ordinalCategory:'HIGH'},{metricKey:'hse.energy',knowledgeState:'UNKNOWN',ordinalCategory:null},{metricKey:'hse.attention',knowledgeState:'UNKNOWN',ordinalCategory:null}]});
 });
 it('turns a valid EMPTY snapshot into three explicit UNKNOWN entries - not a failure',()=>{
  const result=projectHimHypothesisGenerationContext(reasoning([unknown('hse.stress'),unknown('hse.energy'),unknown('hse.attention')]));
  expect(result.metrics).toHaveLength(3);
  expect(result.metrics.every(m=>m.knowledgeState==='UNKNOWN'&&m.ordinalCategory===null)).toBe(true);
 });
 it('leaks no identifier, timestamp, provenance, numeric value, freshness/confidence claim, or trend/composite/diagnostic field',()=>{
  const result=projectHimHypothesisGenerationContext(partial());
  const serialized=JSON.stringify(result);
  expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/iu);
  expect(serialized).not.toMatch(/observedAt|generatedAt|freshness|confidence|numeric|instrument|scale|model|binding|calculation|provenance|event|observation|reason|qualifier|validity|trend|delta|average|composite|readiness|score|diagnosis|personality/iu);
  for(const metric of result.metrics)expect(Object.keys(metric).sort()).toEqual(['knowledgeState','metricKey','ordinalCategory']);
  expect(Object.keys(result).sort()).toEqual(['contextKind','contractVersion','metrics','source']);
 });
 it.each([
  ['a non-session context kind',()=>reasoning([known('hse.stress','HIGH'),unknown('hse.energy'),unknown('hse.attention')],{contextKind:'SITUATION' as never})],
  ['a foreign source',()=>reasoning([unknown('hse.stress'),unknown('hse.energy'),unknown('hse.attention')],{source:'FORGED' as never})],
  ['a missing metric',()=>reasoning([unknown('hse.stress'),unknown('hse.energy')])],
  ['a non-canonical metric order',()=>reasoning([unknown('hse.energy'),unknown('hse.stress'),unknown('hse.attention')])],
  ['a fourth metric',()=>reasoning([unknown('hse.stress'),unknown('hse.energy'),unknown('hse.attention'),unknown('hbs.avoidance')])],
  ['KNOWN without a canonical category',()=>reasoning([{...known('hse.stress','HIGH'),ordinalCategory:null},unknown('hse.energy'),unknown('hse.attention')])],
  ['UNKNOWN carrying a category',()=>reasoning([{...unknown('hse.stress'),ordinalCategory:'LOW' as never},unknown('hse.energy'),unknown('hse.attention')])],
  ['an assessed freshness claim',()=>reasoning([{...known('hse.stress','HIGH'),freshnessState:'FRESH' as never},unknown('hse.energy'),unknown('hse.attention')])],
  ['an assessed confidence claim',()=>reasoning([{...known('hse.stress','HIGH'),confidenceState:'ASSESSED' as never},unknown('hse.energy'),unknown('hse.attention')])],
 ])('fails closed on %s',(_label,build)=>{expect(()=>projectHimHypothesisGenerationContext(build())).toThrow('INTEGRITY_FAILURE');});
});
