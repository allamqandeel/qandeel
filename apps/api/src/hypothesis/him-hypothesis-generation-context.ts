import type { HimSnapshotOrdinalCategory } from '../human-model/him-intelligence-snapshot.types';
import type { HimReasoningContext,HimReasoningMetric } from '../human-model/him-reasoning-consumption.types';

// HIM Runtime Consumption v1: the ONE bounded, read-only, provider-facing HIM
// structured-state contract for Controlled Hypothesis Generation. It carries
// EXACTLY the three canonical CONVERSATION_SESSION metric states (stress ->
// energy -> attention) and nothing else: no user/session identity, no
// timestamps, no freshness/confidence claim, no numeric storage value, no
// instrument/model/scale/binding/calculation/provenance identifiers, no
// trends, no composites, no diagnosis. HIM here is advisory structured state -
// never Evidence, never proof, never a lifecycle or Confidence input.
export const HIM_HYPOTHESIS_GENERATION_METRIC_KEYS=Object.freeze(['hse.stress','hse.energy','hse.attention'] as const);
export type HimHypothesisGenerationMetricKey=(typeof HIM_HYPOTHESIS_GENERATION_METRIC_KEYS)[number];

export interface HimHypothesisGenerationMetric {
  metricKey:HimHypothesisGenerationMetricKey;
  knowledgeState:'KNOWN'|'UNKNOWN';
  ordinalCategory:HimSnapshotOrdinalCategory|null;
}

export interface HimHypothesisGenerationContext {
  contractVersion:1;
  source:'HIM_STRUCTURED_STATE';
  contextKind:'CONVERSATION_SESSION';
  metrics:readonly HimHypothesisGenerationMetric[];
}

const CATEGORIES:readonly HimSnapshotOrdinalCategory[]=['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH'];

// Pure minimizing projection from the canonical HIM reasoning context. KNOWN
// keeps only its canonical ordinal category; UNKNOWN keeps null and is never
// filled, guessed, or reinterpreted. A valid EMPTY snapshot is NOT a failure:
// it becomes three explicit UNKNOWN entries. Anything that is not the exact
// canonical CONVERSATION_SESSION reasoning shape fails closed.
export function projectHimHypothesisGenerationContext(reasoning:HimReasoningContext):HimHypothesisGenerationContext{
  if(reasoning.source!=='HIM_INTELLIGENCE_SNAPSHOT'||reasoning.sourceSnapshotContractVersion!==1||reasoning.contextKind!=='CONVERSATION_SESSION')throw new Error('INTEGRITY_FAILURE');
  if(reasoning.metrics.length!==HIM_HYPOTHESIS_GENERATION_METRIC_KEYS.length||reasoning.metrics.some((m,i)=>m.metricKey!==HIM_HYPOTHESIS_GENERATION_METRIC_KEYS[i]))throw new Error('INTEGRITY_FAILURE');
  return Object.freeze({contractVersion:1 as const,source:'HIM_STRUCTURED_STATE' as const,contextKind:'CONVERSATION_SESSION' as const,metrics:Object.freeze(reasoning.metrics.map(m=>metric(m)))});
}
function metric(m:HimReasoningMetric):HimHypothesisGenerationMetric{
  if(m.definitionVersion!==1||m.semanticType!=='STATE'||m.freshnessState!=='UNASSESSED'||m.confidenceState!=='UNASSESSED')throw new Error('INTEGRITY_FAILURE');
  if(m.knowledgeState==='KNOWN'){
    if(m.ordinalCategory===null||!CATEGORIES.includes(m.ordinalCategory))throw new Error('INTEGRITY_FAILURE');
    return{metricKey:m.metricKey as HimHypothesisGenerationMetricKey,knowledgeState:'KNOWN',ordinalCategory:m.ordinalCategory};
  }
  if(m.knowledgeState!=='UNKNOWN'||m.ordinalCategory!==null)throw new Error('INTEGRITY_FAILURE');
  return{metricKey:m.metricKey as HimHypothesisGenerationMetricKey,knowledgeState:'UNKNOWN',ordinalCategory:null};
}
