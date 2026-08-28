import { Injectable } from '@nestjs/common';
import type {
  HimContextualCurrentMetric,
  HimContextualCurrentSelection,
} from './him-contextual-current-intelligence.types';
import type {
  HimSessionReflectionDirective,
  HimSessionReflectionGuidance,
} from './him-session-reflection-consumption.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNKNOWN_REASONS: ReadonlySet<string> = new Set([
  'NO_CANONICAL_CURRENT_VALUE',
  'LATEST_VALUE_UNASSESSED',
  'LATEST_VALUE_INVALIDATED',
  'INCOMPATIBLE_ACTIVE_BINDING',
]);

@Injectable()
export class HimSessionReflectionConsumptionService {
  // Pure and deterministic: no repository, database, provider, clock, random
  // behavior, LLM, or persistence dependency. It accepts exactly one validated
  // QHIA-004 one-metric CONVERSATION_SESSION Reflection selection and returns
  // one bounded guidance value. The mapping is one-way exploration-style
  // guidance only: it never scores insight/wisdom/self-awareness/mindfulness,
  // never diagnoses rumination or overthinking, never treats direction as
  // valence, and never gains Safety, Question Runtime, Recommendation,
  // Hypothesis, Trend, or FAST/DEEP routing authority. observedAt is a source
  // fact only and never alters the derived guidance.
  consume(selection: HimContextualCurrentSelection): HimSessionReflectionGuidance {
    const metric = this.validate(selection);

    if (metric.knowledgeState === 'UNKNOWN') {
      // UNKNOWN stays UNKNOWN: no substitution, no older value, no midpoint,
      // and no inferred guidance - the conversation proceeds unchanged.
      return this.guidance('NONE', 'DEFAULT');
    }
    // The canonical structured ordinal 1-5. Direction is not valence: 1/2 mean
    // a gentle optional invitation may be useful, 3 adds nothing, and 4/5 mean
    // avoiding redundant reflective prompting - never "worse" or "better".
    if (metric.numericValue === 1 || metric.numericValue === 2) {
      return this.guidance('ACTIVE', 'GENTLE_REFLECTION_INVITATION');
    }
    if (metric.numericValue === 3) return this.guidance('NONE', 'DEFAULT');
    return this.guidance('ACTIVE', 'AVOID_REDUNDANT_REFLECTION');
  }

  private guidance(
    guidanceState: 'NONE' | 'ACTIVE',
    directive: HimSessionReflectionDirective,
  ): HimSessionReflectionGuidance {
    return { contractVersion: 1, guidanceState, directive };
  }

  // Fail-closed integrity protection: a malformed selection is never
  // reinterpreted, repaired, or partially consumed. Anything that is not the
  // exact one-metric authoritative-session hbs.reflection@1 selection contract
  // is an INTEGRITY_FAILURE.
  private validate(selection: HimContextualCurrentSelection): HimContextualCurrentMetric {
    if (selection === null || typeof selection !== 'object') throw new Error('INTEGRITY_FAILURE');
    if (selection.contractVersion !== 1) throw new Error('INTEGRITY_FAILURE');
    if (selection.source !== 'HIM_CANONICAL_LATEST_MEASUREMENT') throw new Error('INTEGRITY_FAILURE');
    if (selection.contextKind !== 'CONVERSATION_SESSION') throw new Error('INTEGRITY_FAILURE');
    if (typeof selection.contextId !== 'string' || !UUID.test(selection.contextId)) throw new Error('INTEGRITY_FAILURE');
    if (selection.requestedMetricCount !== 1) throw new Error('INTEGRITY_FAILURE');
    if (!Array.isArray(selection.metrics) || selection.metrics.length !== 1) throw new Error('INTEGRITY_FAILURE');

    const metric = selection.metrics[0];
    if (metric === null || typeof metric !== 'object') throw new Error('INTEGRITY_FAILURE');
    if (metric.metricKey !== 'hbs.reflection') throw new Error('INTEGRITY_FAILURE');
    if (metric.definitionVersion !== 1) throw new Error('INTEGRITY_FAILURE');
    if (metric.hifOwner !== 'HBS') throw new Error('INTEGRITY_FAILURE');
    if (metric.semanticMappingStatus !== 'UNRESOLVED') throw new Error('INTEGRITY_FAILURE');
    if (metric.semanticType !== null) throw new Error('INTEGRITY_FAILURE');
    if (metric.freshnessState !== 'UNASSESSED' || metric.freshnessReference !== null) throw new Error('INTEGRITY_FAILURE');
    if (metric.confidenceState !== 'UNASSESSED' || metric.confidenceReference !== null) throw new Error('INTEGRITY_FAILURE');
    // The at-report Reflection metric carries no temporal window; a window is
    // a malformed contract, never a Trend or recency input.
    if (metric.temporalWindowStart !== null || metric.temporalWindowEnd !== null) throw new Error('INTEGRITY_FAILURE');

    const known = metric.knowledgeState === 'KNOWN' ? 1 : metric.knowledgeState === 'UNKNOWN' ? 0 : -1;
    if (known === -1) throw new Error('INTEGRITY_FAILURE');
    // Count/coverage coherence for the exact one-metric subset contract.
    if (selection.knownMetricCount !== known || selection.unknownMetricCount !== 1 - known) throw new Error('INTEGRITY_FAILURE');
    if (selection.coverageState !== (known === 1 ? 'FULL' : 'EMPTY')) throw new Error('INTEGRITY_FAILURE');

    if (metric.knowledgeState === 'KNOWN') {
      if (
        metric.numericValue === null || !Number.isSafeInteger(metric.numericValue) ||
        metric.numericValue < 1 || metric.numericValue > 5
      ) throw new Error('INTEGRITY_FAILURE');
      if (metric.unknownReason !== null) throw new Error('INTEGRITY_FAILURE');
      if (typeof metric.canonicalBindingId !== 'string' || !UUID.test(metric.canonicalBindingId)) throw new Error('INTEGRITY_FAILURE');
      // observedAt may exist as a source fact; it is type-checked only and
      // never parsed, compared, or allowed to influence the mapping.
      if (metric.observedAt !== null && typeof metric.observedAt !== 'string') throw new Error('INTEGRITY_FAILURE');
      return metric;
    }
    // Any valid QHIA-004 UNKNOWN carries no fragment of an unusable value.
    if (metric.numericValue !== null) throw new Error('INTEGRITY_FAILURE');
    if (metric.unknownReason === null || !UNKNOWN_REASONS.has(metric.unknownReason)) throw new Error('INTEGRITY_FAILURE');
    if (metric.canonicalBindingId !== null || metric.observedAt !== null) throw new Error('INTEGRITY_FAILURE');
    return metric;
  }
}
