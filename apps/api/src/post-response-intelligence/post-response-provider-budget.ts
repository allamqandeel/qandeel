import type { IntelligenceEffect, IntelligenceEffectState } from './post-response-intelligence.types';

/**
 * QIR-005 - the canonical v1 registry of PROVIDER-BACKED post-response effects.
 *
 * Exactly these three durable intelligence effects cross an external provider
 * boundary. Membership is explicit and centralized: it is never inferred from an
 * effect-name substring, never derived from `INTELLIGENCE_EFFECTS`, and never
 * extended by adding another `IntelligenceEffect`. `MEMORY_WRITE`,
 * `HYPOTHESIS_UPDATE_BATCH`, `HYPOTHESIS_PERSISTENCE`, `CONFIDENCE_BATCH`,
 * `HIM_BRAIN_CONTEXT_MATERIALIZATION` and the Information Gap synchronization
 * consume ZERO provider budget and are deliberately absent here.
 *
 * A fourth provider-backed post-response effect therefore cannot appear
 * silently: it requires editing this frozen list, which requires a deliberate,
 * separately reviewed, versioned contract update.
 */
export const POST_RESPONSE_PROVIDER_EFFECTS_V1 = [
  'ASSOCIATION_PROVIDER',
  'INTENT_PROVIDER',
  'CANDIDATE_PROVIDER',
] as const;

export type PostResponseProviderEffect = typeof POST_RESPONSE_PROVIDER_EFFECTS_V1[number];

export type PostResponseProviderClassification = 'PROVIDER' | 'NON_PROVIDER';

/**
 * QIR-005 Fix 01 - the EXHAUSTIVE provider/non-provider classification of every
 * canonical `IntelligenceEffect`.
 *
 * The frozen registry above answers "which effects are provider-backed". This
 * record answers the strictly stronger question "has EVERY canonical effect been
 * deliberately classified at all", and the `satisfies Record<IntelligenceEffect,
 * ...>` clause is what makes it TOTAL: adding a member to `INTELLIGENCE_EFFECTS`
 * without adding its entry here is a COMPILE ERROR, and an entry that is not a
 * canonical effect is a compile error too.
 *
 * That closes the silent-drift gap. Previously a new durable effect could enter
 * `INTELLIGENCE_EFFECTS` without anyone deciding whether it crosses a provider
 * boundary; now the decision is forced, in one server-owned place, and it is
 * written down rather than inferred.
 *
 * Classification is a KEYED LOOKUP, never a name pattern: nothing here matches
 * `_PROVIDER`, tests a substring, or derives provider authority from an effect
 * name. `HYPOTHESIS_UPDATE_BATCH` is NON_PROVIDER because the managed A2.3c
 * command calls no provider - not because of how it is spelled.
 *
 * The relation to the frozen v1 budget is deliberately NOT derived in either
 * direction. The entries marked `PROVIDER` must equal
 * `POST_RESPONSE_PROVIDER_EFFECTS_V1` exactly, and that equality is proven by
 * the focused unit tests and by the QIR-005 static contract - so classifying a
 * fourth effect `PROVIDER` FAILS the QIR-005 v1 contract instead of silently
 * widening the cap. A future NON-provider effect, by contrast, is legitimate:
 * classify it `NON_PROVIDER` and the budget of three is untouched.
 *
 * This is a classification relation, not a scheduler: it plans no work, orders
 * no stage, and is never consulted to decide what the dispatcher runs.
 */
export const POST_RESPONSE_EFFECT_PROVIDER_CLASSIFICATION_V1 = {
  MEMORY_WRITE: 'NON_PROVIDER',
  INTENT_PROVIDER: 'PROVIDER',
  CANDIDATE_PROVIDER: 'PROVIDER',
  ASSOCIATION_PROVIDER: 'PROVIDER',
  HYPOTHESIS_UPDATE_BATCH: 'NON_PROVIDER',
  HYPOTHESIS_PERSISTENCE: 'NON_PROVIDER',
  CONFIDENCE_BATCH: 'NON_PROVIDER',
  HIM_BRAIN_CONTEXT_MATERIALIZATION: 'NON_PROVIDER',
} as const satisfies Record<IntelligenceEffect, PostResponseProviderClassification>;

/**
 * The HARD provider-call budget of ONE durable post-response execution.
 *
 * It equals the size of the v1 provider-backed registry above, because each
 * registered provider effect owns at most ONE durable slot. It is a compile-time
 * constant on purpose: it is never read from an environment variable, never
 * configured per deployment, never scaled by processing path, and never raised
 * dynamically at runtime.
 *
 * The budget is scoped to the WHOLE durable execution lifecycle - never to one
 * Redis delivery, one consumer cycle, one reclaim, one dispatcher invocation,
 * one retry or one Node.js process.
 */
export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3;

export const POST_RESPONSE_PROVIDER_BUDGET_POLICY_VERSION = '1';

/**
 * The bounded telemetry decision vocabulary. `AUTHORIZED` is recorded only after
 * a provider slot has actually been spent by a SUCCESSFUL durable claim - never
 * for a mere intention to call a provider. `RECOVERED` is recorded when a valid
 * durable COMPLETED provider effect is consumed with zero provider call.
 * `EXHAUSTED` is recorded BEFORE any provider transport, when the hard budget
 * refuses fresh provider work.
 */
export const POST_RESPONSE_PROVIDER_BUDGET_DECISIONS = ['AUTHORIZED', 'RECOVERED', 'EXHAUSTED'] as const;

export type PostResponseProviderBudgetDecision = typeof POST_RESPONSE_PROVIDER_BUDGET_DECISIONS[number];

/** Bounded label registries, shared with the telemetry boundary so exactly ONE registry exists. */
export const POST_RESPONSE_PROVIDER_EFFECT_KEYS: ReadonlySet<string> = new Set(POST_RESPONSE_PROVIDER_EFFECTS_V1);
export const POST_RESPONSE_PROVIDER_BUDGET_DECISION_KEYS: ReadonlySet<string> = new Set(POST_RESPONSE_PROVIDER_BUDGET_DECISIONS);

/**
 * The deterministic terminal identity of hard provider-budget exhaustion.
 *
 * Under the valid v1 DAG exhaustion is unreachable during a legitimate
 * execution, so it is an integrity/contract violation rather than ordinary
 * optional degradation: it is a TERMINAL QUARANTINE, it fabricates no
 * intelligence result, it substitutes no stale value, and it raises no cap.
 *
 * The stage is the exact QIR-005 stage and is unique to this path. The outcome
 * code is the exact equivalent inside the FROZEN migration-0022
 * `outcome_code` domain: QIR-005 adds no migration, so `PROVIDER_BUDGET_EXHAUSTED`
 * cannot be written as an outcome code without an unauthorized schema change,
 * and the provider-budget identity is carried instead by the dedicated stage
 * plus the `EXHAUSTED` telemetry decision. The pair is deterministic because no
 * other dispatcher path writes the `PROVIDER_BUDGET` stage.
 */
export const POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_OUTCOME = 'AUTHORITY_REJECTED';
export const POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_STAGE = 'PROVIDER_BUDGET';

export type PostResponseProviderBudgetAuthorization = 'AUTHORIZED' | 'EXHAUSTED';

/** Bounded, fail-soft telemetry sink. It receives only frozen registry values - never an identifier, payload or error. */
export type PostResponseProviderBudgetRecorder =
  (effect: PostResponseProviderEffect, decision: PostResponseProviderBudgetDecision) => void;

export function isPostResponseProviderEffect(value: string): value is PostResponseProviderEffect {
  return POST_RESPONSE_PROVIDER_EFFECT_KEYS.has(value);
}

/**
 * Reconstructs the provider slots ALREADY SPENT by a durable execution, from the
 * durable effect ledger alone.
 *
 * Both `CLAIMED` and `COMPLETED` provider-backed effects count as spent. A
 * `COMPLETED` effect obviously spent its slot. A `CLAIMED` effect also spent it
 * permanently: after a durable claim followed by process or transport ambiguity
 * the runtime cannot prove that no external provider request was ever emitted,
 * so the slot is never refunded and the effect is never replayed - the canonical
 * indeterminate-effect quarantine owns that state.
 *
 * Nothing else is consulted: not the current turn, not Hypothesis rows, not
 * Redis, not the delivery attempt count, and not the process. This is what makes
 * the budget survive duplicate delivery, reclaim, redispatch and restart instead
 * of resetting.
 */
export function reconstructSpentProviderSlots(
  effects: readonly Pick<IntelligenceEffectState, 'effect_key' | 'state'>[],
): ReadonlySet<PostResponseProviderEffect> {
  const spent = new Set<PostResponseProviderEffect>();
  for (const effect of effects) {
    if (!isPostResponseProviderEffect(effect.effect_key)) continue;
    if (effect.state !== 'CLAIMED' && effect.state !== 'COMPLETED') continue;
    spent.add(effect.effect_key);
  }
  return spent;
}

/**
 * The ONE centralized provider-budget gate for a single durable post-response
 * execution.
 *
 * This is deliberately NOT a workflow engine, a scheduler of arbitrary work, a
 * retry framework or a durable ledger. It owns nothing about Association,
 * Intent, Candidate generation, Hypothesis, Evidence, Safety, HIM, Information
 * Gap, persistence, Confidence, Redis, reclaim policy or provider/model
 * selection. The dispatcher remains the composition and execution engine; this
 * object only answers "may a fresh provider-backed effect be started, and has a
 * slot now been spent".
 *
 * The integration law it enforces, in this exact order:
 *
 *   authorize -> durable effect claim -> spend -> at most ONE provider transport
 *
 * `authorize` never spends a slot, because a mere intention to invoke a provider
 * is not a spend and a failed durable claim must consume nothing. `spend` is
 * called only after the durable claim SUCCEEDED, and from that instant the slot
 * is permanently spent for this execution: there is no refund on crash,
 * timeout, provider error, invalid output, ambiguous completion, later authority
 * failure or quarantine.
 */
export class PostResponseProviderBudget {
  private readonly spentSlots: Set<PostResponseProviderEffect>;

  constructor(spent: ReadonlySet<PostResponseProviderEffect>, private readonly recorder: PostResponseProviderBudgetRecorder) {
    this.spentSlots = new Set(spent);
  }

  /** Provider slots already spent by this durable execution. */
  get spent(): number { return this.spentSlots.size; }

  /** Provider slots this durable execution may still spend. Never negative. */
  get remaining(): number { return Math.max(0, POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 - this.spentSlots.size); }

  isSpent(effect: PostResponseProviderEffect): boolean { return this.spentSlots.has(effect); }

  /**
   * Decides whether FRESH provider work for one provider-backed effect may
   * proceed to its durable claim. It is refused - before any transport - when
   * this effect's own single slot is already spent (local duplicate consumption)
   * or when the hard lifecycle cap is already reached.
   */
  authorize(effect: PostResponseProviderEffect): PostResponseProviderBudgetAuthorization {
    if (this.spentSlots.has(effect) || this.spentSlots.size >= POST_RESPONSE_PROVIDER_CALL_BUDGET_V1) {
      this.record(effect, 'EXHAUSTED');
      return 'EXHAUSTED';
    }
    return 'AUTHORIZED';
  }

  /** Marks the slot permanently spent. Called ONLY after the durable effect claim succeeded. */
  spend(effect: PostResponseProviderEffect): void {
    if (this.spentSlots.has(effect)) return;
    this.spentSlots.add(effect);
    this.record(effect, 'AUTHORIZED');
  }

  /** Records that a valid durable COMPLETED provider effect was consumed with ZERO provider call. */
  recover(effect: PostResponseProviderEffect): void {
    this.record(effect, 'RECOVERED');
  }

  // Telemetry is fail-soft at this boundary too: an observability failure can
  // never change a budget decision, strand an effect, or alter the execution.
  private record(effect: PostResponseProviderEffect, decision: PostResponseProviderBudgetDecision): void {
    try { this.recorder(effect, decision); } catch { /* fail-soft */ }
  }
}
