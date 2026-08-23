import { Injectable } from '@nestjs/common';
import type { ProcessingPath } from '../model-router/model-router.types';
import type { HimReasoningContext, HimReasoningMetric } from './him-reasoning-consumption.types';
import type { HimDeepModelMetric, HimModelContext } from './him-fast-deep-consumption.types';

@Injectable()
export class HimFastDeepConsumptionService {
  project(path: ProcessingPath, context: HimReasoningContext): HimModelContext {
    if (path !== 'FAST' && path !== 'DEEP') throw new Error('INTEGRITY_FAILURE');
    if (
      context.source !== 'HIM_INTELLIGENCE_SNAPSHOT' || context.sourceSnapshotContractVersion !== 1 ||
      context.contextKind !== 'CONVERSATION_SESSION'
    ) throw new Error('INTEGRITY_FAILURE');

    const keys = new Set(context.metrics.map((metric) => metric.metricKey));
    if (keys.size !== context.metrics.length) throw new Error('INTEGRITY_FAILURE');
    const knownMetricCount = context.metrics.filter((metric) => metric.knowledgeState === 'KNOWN').length;
    const unknownMetricCount = context.metrics.length - knownMetricCount;
    const coverageState = knownMetricCount === context.metrics.length ? 'FULL' : knownMetricCount === 0 ? 'EMPTY' : 'PARTIAL';
    if (
      context.eligibleMetricCount !== context.metrics.length || context.assessedMetricCount !== knownMetricCount ||
      context.unassessedMetricCount !== unknownMetricCount || context.coverageState !== coverageState
    ) throw new Error('INTEGRITY_FAILURE');
    context.metrics.forEach((metric) => this.validateMetric(metric));

    const base = {
      contractVersion: 1 as const, source: 'HIM_REASONING_CONTEXT' as const,
      sourceSnapshotContractVersion: 1 as const, contextKind: 'CONVERSATION_SESSION' as const,
      contextId: context.contextId, coverageState: context.coverageState,
      eligibleMetricCount: context.eligibleMetricCount, knownMetricCount, unknownMetricCount,
      freshnessPolicy: 'UNASSESSED' as const, confidencePolicy: 'UNASSESSED' as const,
    };
    if (path === 'FAST') return {
      ...base, consumptionMode: 'FAST',
      metrics: context.metrics.map(({ metricKey, knowledgeState, ordinalCategory }) => ({
        metricKey, knowledgeState, ordinalCategory,
      })),
    };
    return {
      ...base, consumptionMode: 'DEEP',
      metrics: context.metrics.map((metric): HimDeepModelMetric => ({
        metricKey: metric.metricKey, knowledgeState: metric.knowledgeState,
        unknownReason: metric.unknownReason, ordinalCategory: metric.ordinalCategory,
        observationQualifier: metric.observationQualifier, observedAt: metric.observedAt,
        freshnessState: metric.freshnessState, confidenceState: metric.confidenceState,
        validityStatus: metric.validityStatus,
      })),
    };
  }

  private validateMetric(metric: HimReasoningMetric): void {
    if (metric.freshnessState !== 'UNASSESSED' || metric.confidenceState !== 'UNASSESSED')
      throw new Error('INTEGRITY_FAILURE');
    if (metric.knowledgeState === 'KNOWN') {
      if (metric.ordinalCategory === null) throw new Error('INTEGRITY_FAILURE');
      return;
    }
    if (metric.knowledgeState !== 'UNKNOWN' || metric.ordinalCategory !== null)
      throw new Error('INTEGRITY_FAILURE');
  }
}
