// AI-COST-01 - the closed vocabularies of provider-call accounting.
//
// Each registry here equals, exactly, the CHECK constraint of migration 0135 that stores it. A fourth provider, a new
// feature family or a new billable kind is a reviewed change in BOTH places, never an implicit widening.
//
// Nothing in this file is a price, a Credit value or a provider choice.

/** The providers a production call may name. `TEST_PROVIDER` exists only in the database, for synthetic prices. */
export const AI_PROVIDERS = ['OPENAI', 'ANTHROPIC', 'GEMINI'] as const;
export type AiProvider = typeof AI_PROVIDERS[number];

/** The exact external operation each provider is asked to perform. */
export const AI_PROVIDER_OPERATION = {
  OPENAI: 'OPENAI_RESPONSES_CREATE',
  ANTHROPIC: 'ANTHROPIC_MESSAGES_CREATE',
  GEMINI: 'GEMINI_GENERATE_CONTENT',
} as const satisfies Record<AiProvider, string>;
export type AiProviderOperation = typeof AI_PROVIDER_OPERATION[AiProvider];

/** Which QANDEEL capability spent the call. One family per production provider path (the census, §20). */
export const AI_FEATURE_FAMILIES = [
  'CONVERSATION_REPLY',
  'CU_SEGMENTATION',
  'FOCUS_RESOLUTION',
  'THREAD_FORMATION',
  'THREAD_CONTINUITY',
  'HYPOTHESIS_INTENT_EXTRACTION',
  'HYPOTHESIS_EVIDENCE_ASSOCIATION',
  'HYPOTHESIS_CANDIDATE_GENERATION',
] as const;
export type AiFeatureFamily = typeof AI_FEATURE_FAMILIES[number];

export type AiProcessingPath = 'FAST' | 'DEEP';

/**
 * The normalized billable kinds. Together they are a DISJOINT partition of what a provider bills for one call, so each
 * kind is rated on its own and no token is ever charged twice:
 *   INPUT_TOKEN              input billed at the uncached rate (never including a cached or cache-written token);
 *   CACHE_READ_INPUT_TOKEN   input served from the provider's prompt cache;
 *   CACHE_WRITE_INPUT_TOKEN  input written to the provider's prompt cache;
 *   OUTPUT_TOKEN             all billed output, reasoning / thinking included.
 * Audio or other units are NOT here: they need a reviewed extension backed by a provider's billing truth.
 */
export const AI_USAGE_KINDS = ['INPUT_TOKEN', 'OUTPUT_TOKEN', 'CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN'] as const;
export type AiUsageKind = typeof AI_USAGE_KINDS[number];

/** The kinds a COMPLETE usage of each provider carries (migration 0135 `ai_complete_usage_kinds_v1`). */
export const AI_COMPLETE_USAGE_KINDS: Readonly<Record<AiProvider, readonly AiUsageKind[]>> = {
  OPENAI: ['CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN'],
  ANTHROPIC: ['CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN'],
  GEMINI: ['CACHE_READ_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN'],
};

/**
 * What the provider told us, normalized. `ABSENT` carries no quantity at all; `INCOMPLETE` carries only the kinds that
 * were reported; neither is ever padded with a zero. Only `COMPLETE` usage can be rated.
 */
export type NormalizedAiUsage =
  | { readonly completeness: 'COMPLETE' | 'INCOMPLETE'; readonly quantities: Readonly<Partial<Record<AiUsageKind, number>>> }
  | { readonly completeness: 'ABSENT' };

export const ABSENT_AI_USAGE: NormalizedAiUsage = Object.freeze({ completeness: 'ABSENT' });

/** How one attempt ended, as the settlement command records it. */
export type AiProviderCallOutcome = 'SUCCEEDED' | 'FAILED' | 'CANCELLED_BEFORE_PROVIDER';

/** The closed lifecycle of a call (migration 0135 `ai_provider_calls_state_check`). */
export const AI_PROVIDER_CALL_STATES = [
  'PENDING',
  'SUCCEEDED_USAGE_REPORTED',
  'SUCCEEDED_USAGE_UNKNOWN',
  'FAILED_USAGE_REPORTED',
  'FAILED_USAGE_UNKNOWN',
  'CANCELLED_BEFORE_PROVIDER',
] as const;
export type AiProviderCallState = typeof AI_PROVIDER_CALL_STATES[number];

/** The rated-cost states. `PENDING` is a call not yet settled; it has no rating row. */
export const AI_COST_RATING_STATES = ['RATED', 'UNPRICED', 'USAGE_UNKNOWN', 'PENDING'] as const;
export type AiCostRatingState = typeof AI_COST_RATING_STATES[number];

/** The production Credit state. While no Product-authorized policy is active, it is this - never "0 Credits". */
export const CREDIT_POLICY_NOT_ACTIVATED = 'CREDIT_POLICY_NOT_ACTIVATED';

/** What one external attempt is, decided by server authority only - never by a request body. */
export interface AiProviderCallDescriptor {
  readonly provider: AiProvider;
  readonly requestedModel: string;
  readonly featureFamily: AiFeatureFamily;
}

/** The model identity rule shared with every provider configuration and with migration 0135. */
export const AI_MODEL_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
