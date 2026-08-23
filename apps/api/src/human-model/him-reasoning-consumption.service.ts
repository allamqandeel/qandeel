import { Injectable } from '@nestjs/common';
import type {
  HimIntelligenceSnapshot,
  HimIntelligenceSnapshotMetric,
  HimSnapshotContextKind,
  HimSnapshotUnassessedReason,
} from './him-intelligence-snapshot.types';
import type {
  HimReasoningContext,
  HimReasoningMetric,
  HimReasoningUnknownReason,
} from './him-reasoning-consumption.types';

const SUPPORTED_CONTEXTS = new Set<HimSnapshotContextKind>([
  'SITUATION',
  'CONVERSATION_SESSION',
  'DECISION',
  'GOAL',
]);
const UNKNOWN_REASONS: Readonly<Record<HimSnapshotUnassessedReason, HimReasoningUnknownReason>> =
  Object.freeze({
    NO_MEASUREMENT_EVENT: 'NO_MEASUREMENT',
    LATEST_EVENT_UNASSESSED: 'LATEST_MEASUREMENT_UNASSESSED',
    LATEST_EVENT_INVALIDATED: 'LATEST_MEASUREMENT_INVALIDATED',
    INCOMPATIBLE_ACTIVE_BINDING: 'INCOMPATIBLE_ACTIVE_BINDING',
  });

@Injectable()
export class HimReasoningConsumptionService {
  transform(snapshot: HimIntelligenceSnapshot): HimReasoningContext {
    if (snapshot.snapshotContractVersion !== 1) throw new Error('INTEGRITY_FAILURE');
    if (!SUPPORTED_CONTEXTS.has(snapshot.contextKind)) throw new Error('INTEGRITY_FAILURE');

    const keys = new Set(snapshot.metrics.map((metric) => metric.metricKey));
    if (keys.size !== snapshot.metrics.length) throw new Error('INTEGRITY_FAILURE');

    const assessed = snapshot.metrics.filter((metric) => metric.valueState === 'ASSESSED').length;
    const unassessed = snapshot.metrics.length - assessed;
    const coverage = assessed === snapshot.metrics.length ? 'FULL' : assessed === 0 ? 'EMPTY' : 'PARTIAL';
    if (
      snapshot.eligibleMetricCount !== snapshot.metrics.length ||
      snapshot.assessedMetricCount !== assessed ||
      snapshot.unassessedMetricCount !== unassessed ||
      snapshot.coverageState !== coverage
    ) throw new Error('INTEGRITY_FAILURE');

    return {
      source: 'HIM_INTELLIGENCE_SNAPSHOT',
      sourceSnapshotContractVersion: snapshot.snapshotContractVersion,
      contextKind: snapshot.contextKind,
      contextId: snapshot.contextId,
      generatedAt: snapshot.generatedAt,
      coverageState: snapshot.coverageState,
      eligibleMetricCount: snapshot.eligibleMetricCount,
      assessedMetricCount: snapshot.assessedMetricCount,
      unassessedMetricCount: snapshot.unassessedMetricCount,
      metrics: snapshot.metrics.map((metric) => this.transformMetric(metric)),
    };
  }

  private transformMetric(metric: HimIntelligenceSnapshotMetric): HimReasoningMetric {
    if (
      metric.definitionVersion !== 1 ||
      metric.semanticType !== 'STATE' ||
      metric.freshnessState !== 'UNASSESSED' ||
      metric.freshnessReference !== null ||
      metric.confidenceState !== 'UNASSESSED' ||
      metric.confidenceReference !== null
    ) throw new Error('INTEGRITY_FAILURE');

    if (metric.valueState === 'ASSESSED') {
      if (
        metric.unassessedReason !== null ||
        metric.ordinalCategory === null ||
        metric.observedAt === null ||
        metric.validityStatus !== 'VALID' ||
        !this.hasCompleteProvenance(metric)
      ) throw new Error('INTEGRITY_FAILURE');
      return this.output(metric, 'KNOWN', null, 'LATEST_KNOWN');
    }

    if (metric.valueState !== 'UNASSESSED' || metric.unassessedReason === null || metric.ordinalCategory !== null)
      throw new Error('INTEGRITY_FAILURE');
    const unknownReason = UNKNOWN_REASONS[metric.unassessedReason];
    if (!unknownReason) throw new Error('INTEGRITY_FAILURE');
    this.validateUnknownProvenance(metric);
    return this.output(metric, 'UNKNOWN', unknownReason, null);
  }

  private validateUnknownProvenance(metric: HimIntelligenceSnapshotMetric): void {
    if (metric.unassessedReason === 'NO_MEASUREMENT_EVENT') {
      if (
        metric.observedAt !== null || metric.validityStatus !== null || metric.measurementEventId !== null ||
        metric.measurementObservationId !== null || metric.calculationResultId !== null ||
        metric.canonicalBindingId !== null || this.hasAnyModelProvenance(metric)
      ) throw new Error('INTEGRITY_FAILURE');
      return;
    }
    if (metric.measurementEventId === null || metric.measurementObservationId === null || metric.observedAt === null)
      throw new Error('INTEGRITY_FAILURE');
    if (metric.unassessedReason === 'LATEST_EVENT_UNASSESSED') {
      const hasAnyCalculationProvenance = metric.calculationResultId !== null || metric.canonicalBindingId !== null ||
        this.hasAnyModelProvenance(metric);
      if (hasAnyCalculationProvenance && !this.hasCompleteProvenance(metric)) throw new Error('INTEGRITY_FAILURE');
      if (metric.validityStatus !== (hasAnyCalculationProvenance ? 'VALID' : null)) throw new Error('INTEGRITY_FAILURE');
      return;
    }
    if (!this.hasCompleteProvenance(metric)) throw new Error('INTEGRITY_FAILURE');
    if (metric.unassessedReason === 'LATEST_EVENT_INVALIDATED' && metric.validityStatus !== 'INVALIDATED')
      throw new Error('INTEGRITY_FAILURE');
    if (metric.unassessedReason === 'INCOMPATIBLE_ACTIVE_BINDING' && metric.validityStatus !== 'VALID')
      throw new Error('INTEGRITY_FAILURE');
  }

  private hasCompleteProvenance(metric: HimIntelligenceSnapshotMetric): boolean {
    return metric.measurementEventId !== null && metric.measurementObservationId !== null &&
      metric.calculationResultId !== null && metric.canonicalBindingId !== null &&
      metric.scaleReference !== null && this.isVersion(metric.scaleVersion) &&
      metric.instrumentId !== null && this.isVersion(metric.instrumentVersion) &&
      metric.modelId !== null && this.isVersion(metric.modelVersion);
  }

  private hasAnyModelProvenance(metric: HimIntelligenceSnapshotMetric): boolean {
    return metric.scaleReference !== null || metric.scaleVersion !== null || metric.instrumentId !== null ||
      metric.instrumentVersion !== null || metric.modelId !== null || metric.modelVersion !== null;
  }

  private isVersion(value: number | null): value is number {
    return Number.isSafeInteger(value) && value! > 0;
  }

  private output(
    metric: HimIntelligenceSnapshotMetric,
    knowledgeState: 'KNOWN' | 'UNKNOWN',
    unknownReason: HimReasoningUnknownReason | null,
    observationQualifier: 'LATEST_KNOWN' | null,
  ): HimReasoningMetric {
    return {
      metricKey: metric.metricKey,
      definitionVersion: metric.definitionVersion,
      semanticType: metric.semanticType,
      knowledgeState,
      unknownReason,
      ordinalCategory: knowledgeState === 'KNOWN' ? metric.ordinalCategory : null,
      observationQualifier,
      scaleReference: metric.scaleReference,
      scaleVersion: metric.scaleVersion,
      observedAt: metric.observedAt,
      freshnessState: 'UNASSESSED',
      freshnessReference: null,
      confidenceState: 'UNASSESSED',
      confidenceReference: null,
      validityStatus: metric.validityStatus,
      measurementEventId: metric.measurementEventId,
      measurementObservationId: metric.measurementObservationId,
      calculationResultId: metric.calculationResultId,
      canonicalBindingId: metric.canonicalBindingId,
      instrumentId: metric.instrumentId,
      instrumentVersion: metric.instrumentVersion,
      modelId: metric.modelId,
      modelVersion: metric.modelVersion,
    };
  }
}
