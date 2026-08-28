import { Injectable } from '@nestjs/common';
import type { HimReasoningContext, HimReasoningMetric } from './him-reasoning-consumption.types';
import type {
  HimInteractionAdaptation,
  HimInteractionAdaptationDirectives,
  HimInteractionAdaptationDriver,
} from './him-interaction-adaptation.types';

// Frozen QHIA-001 foreground eligibility: exactly the canonical
// HIM_SNAPSHOT_SLOTS.CONVERSATION_SESSION set. Eligibility is NOT derived from
// the catalog, CALIBRATED status, or semanticType — an extra, missing, or
// duplicate slot is an INTEGRITY_FAILURE (fail-closed eligibility protection).
const SESSION_METRIC_SLOTS = Object.freeze(['hse.stress', 'hse.energy', 'hse.attention'] as const);
const ORDINAL_CATEGORIES: ReadonlySet<string> = new Set(['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH']);
const DEFAULT_DIRECTIVES: Readonly<HimInteractionAdaptationDirectives> = Object.freeze({
  responseDensity: 'DEFAULT', cognitiveLoad: 'DEFAULT', branching: 'DEFAULT',
  steeringPressure: 'DEFAULT', deliveryPacing: 'DEFAULT', stepBatching: 'DEFAULT',
});

@Injectable()
export class HimInteractionAdaptationService {
  // Pure and deterministic: no I/O, persistence, repository, provider, or
  // clock dependency. Timestamps and provenance identifiers never alter the
  // derived adaptation. One-way burden reduction only: favorable/high-capacity
  // values never increase pressure, complexity, branching, or length.
  derive(context: HimReasoningContext): HimInteractionAdaptation {
    this.validate(context);
    const byKey = new Map(context.metrics.map((metric) => [metric.metricKey, metric]));
    const directives: HimInteractionAdaptationDirectives = { ...DEFAULT_DIRECTIVES };
    const drivers: HimInteractionAdaptationDriver[] = [];

    // Canonical driver order (stress, energy, attention) keeps the output
    // deterministic independent of metric array traversal order. Active
    // drivers combine by monotonic union: no driver cancels another driver's
    // burden reduction, and no arithmetic or ranking exists.
    const stress = byKey.get('hse.stress')!;
    if (stress.knowledgeState === 'KNOWN' && (stress.ordinalCategory === 'HIGH' || stress.ordinalCategory === 'VERY_HIGH')) {
      drivers.push('STRESS_HIGH_OR_VERY_HIGH');
      directives.cognitiveLoad = 'REDUCED';
      directives.steeringPressure = 'REDUCED';
      directives.deliveryPacing = 'CALMER';
    }
    const energy = byKey.get('hse.energy')!;
    if (energy.knowledgeState === 'KNOWN' && (energy.ordinalCategory === 'VERY_LOW' || energy.ordinalCategory === 'LOW')) {
      drivers.push('ENERGY_LOW_OR_VERY_LOW');
      directives.responseDensity = 'COMPACT';
      directives.stepBatching = 'ONE_AT_A_TIME';
    }
    const attention = byKey.get('hse.attention')!;
    if (attention.knowledgeState === 'KNOWN' && (attention.ordinalCategory === 'VERY_LOW' || attention.ordinalCategory === 'LOW')) {
      drivers.push('ATTENTION_LOW_OR_VERY_LOW');
      directives.cognitiveLoad = 'REDUCED';
      directives.branching = 'SINGLE_TRACK';
      directives.stepBatching = 'ONE_AT_A_TIME';
    }

    return {
      contractVersion: 1, source: 'HIM_REASONING_CONTEXT', sourceSnapshotContractVersion: 1,
      contextKind: 'CONVERSATION_SESSION', contextId: context.contextId,
      adaptationState: drivers.length ? 'ACTIVE' : 'NONE', directives, drivers,
    };
  }

  private validate(context: HimReasoningContext): void {
    if (
      context.source !== 'HIM_INTELLIGENCE_SNAPSHOT' || context.sourceSnapshotContractVersion !== 1 ||
      context.contextKind !== 'CONVERSATION_SESSION'
    ) throw new Error('INTEGRITY_FAILURE');
    const keys = context.metrics.map((metric) => metric.metricKey);
    if (
      keys.length !== SESSION_METRIC_SLOTS.length || new Set(keys).size !== keys.length ||
      SESSION_METRIC_SLOTS.some((slot) => !keys.includes(slot))
    ) throw new Error('INTEGRITY_FAILURE');
    if (context.eligibleMetricCount !== SESSION_METRIC_SLOTS.length) throw new Error('INTEGRITY_FAILURE');
    const known = context.metrics.filter((metric) => metric.knowledgeState === 'KNOWN').length;
    const coverage = known === context.metrics.length ? 'FULL' : known === 0 ? 'EMPTY' : 'PARTIAL';
    if (
      context.assessedMetricCount !== known ||
      context.unassessedMetricCount !== context.metrics.length - known ||
      context.coverageState !== coverage
    ) throw new Error('INTEGRITY_FAILURE');
    context.metrics.forEach((metric) => this.validateMetric(metric));
  }

  private validateMetric(metric: HimReasoningMetric): void {
    if (metric.definitionVersion !== 1 || metric.semanticType !== 'STATE') throw new Error('INTEGRITY_FAILURE');
    if (
      metric.freshnessState !== 'UNASSESSED' || metric.freshnessReference !== null ||
      metric.confidenceState !== 'UNASSESSED' || metric.confidenceReference !== null
    ) throw new Error('INTEGRITY_FAILURE');
    if (metric.knowledgeState === 'KNOWN') {
      if (metric.ordinalCategory === null || !ORDINAL_CATEGORIES.has(metric.ordinalCategory)) throw new Error('INTEGRITY_FAILURE');
      if (metric.unknownReason !== null) throw new Error('INTEGRITY_FAILURE');
      return;
    }
    // UNKNOWN never carries an ordinal and never substitutes a default or an
    // older observation; a missing unknown reason is a malformed contract.
    if (metric.knowledgeState !== 'UNKNOWN' || metric.ordinalCategory !== null || metric.unknownReason === null)
      throw new Error('INTEGRITY_FAILURE');
  }
}
