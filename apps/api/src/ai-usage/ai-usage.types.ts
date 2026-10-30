// AI-COST-01 - the closed vocabularies of provider-call accounting.
//
// Each registry here equals, exactly, the CHECK constraint of migration 0135 that stores it, as widened by 0170 (S8A-01:
// DEEPSEEK). A new provider, a new feature family or a new billable kind is a reviewed change in BOTH places, never an
// implicit widening. S8B-02 (0184) adds the voice vocabulary in its own section at the end; the `AI_LEDGER_*` unions there
// equal the widened CHECKs, while the text registries below keep exactly the text path's values.
//
// Nothing in this file is a price, a Credit value or a provider choice.

/** The providers a production call may name. `TEST_PROVIDER` exists only in the database, for synthetic prices. */
export const AI_PROVIDERS = ['OPENAI', 'ANTHROPIC', 'GEMINI', 'DEEPSEEK'] as const;
export type AiProvider = typeof AI_PROVIDERS[number];

/** The exact external operation each provider is asked to perform. */
export const AI_PROVIDER_OPERATION = {
  OPENAI: 'OPENAI_RESPONSES_CREATE',
  ANTHROPIC: 'ANTHROPIC_MESSAGES_CREATE',
  GEMINI: 'GEMINI_GENERATE_CONTENT',
  DEEPSEEK: 'DEEPSEEK_CHAT_COMPLETIONS_CREATE',
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
  // S8A-03 CP2 (migration 0171): the background Personal Understanding capture.
  'PERSONAL_UNDERSTANDING_CAPTURE',
  // S8A-04 CP1 (migration 0174): the Shared semantic reading of one World's conversation.
  'SHARED_SEMANTIC_READING',
  // S8A-04 CP2 (migration 0175): the Shared knowledge recall and the Shared spatial placement.
  'SHARED_KNOWLEDGE_RECALL',
  'SHARED_SPATIAL_PLACEMENT',
  // S8A-04 CP3 (migration 0176): the Shared disclosure judge, paid by the sender of the answered message.
  'SHARED_DISCLOSURE_JUDGE',
  // S8A-05 CP3 (migration 0181): the Public semantic interpretation, paid by the publisher who asked.
  'PUBLIC_SEMANTIC_INTERPRETATION',
  // S8A-05 CP4 (migration 0182): the Public QANDEEL reply, paid by the human who invoked @qandeel.
  'PUBLIC_QANDEEL_REPLY',
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
 * These are the text path's kinds. The audio kinds are the reviewed S8B-02 extension (`AI_VOICE_USAGE_KINDS`, below).
 */
export const AI_USAGE_KINDS = ['INPUT_TOKEN', 'OUTPUT_TOKEN', 'CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN'] as const;
export type AiUsageKind = typeof AI_USAGE_KINDS[number];

/** The kinds a COMPLETE usage of each provider carries (migration 0135 `ai_complete_usage_kinds_v1`). */
export const AI_COMPLETE_USAGE_KINDS: Readonly<Record<AiProvider, readonly AiUsageKind[]>> = {
  OPENAI: ['CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN'],
  ANTHROPIC: ['CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN'],
  GEMINI: ['CACHE_READ_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN'],
  DEEPSEEK: ['CACHE_READ_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN'],
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

// ---------------------------------------------------------------------------------------------------------------------
// S8B-02 CP1 (migration 0184; Product Owner decisions D-1 and D-2, 2026-10-30): the VOICE ledger vocabulary.
//
// It is kept beside, never inside, the text registries above: the text path's providers, single operation, families,
// kinds and telemetry are unchanged, so no text caller can name a voice operation and no text label set changes. The
// ledger CHECKs hold the union (`AI_LEDGER_*`). Nothing here calls a provider: CP1 records the vocabulary only.
// ---------------------------------------------------------------------------------------------------------------------

/** The voice operations, per provider. Gemini speech is route-neutral (its route is S8B-04's). */
export const AI_VOICE_PROVIDER_OPERATIONS = {
  SPEECHMATICS: ['SPEECHMATICS_REALTIME_TRANSCRIPTION', 'SPEECHMATICS_BATCH_TRANSCRIPTION'],
  GEMINI: ['GEMINI_SPEECH_GENERATION'],
} as const;
export type AiVoiceProvider = keyof typeof AI_VOICE_PROVIDER_OPERATIONS;
export type AiVoiceOperation = typeof AI_VOICE_PROVIDER_OPERATIONS[AiVoiceProvider][number];

/** Every operation each provider may name in the ledger (migration 0184 `ai_provider_operation_is_known_v1`). */
export const AI_LEDGER_PROVIDER_OPERATIONS: Readonly<Record<AiProvider | AiVoiceProvider, readonly string[]>> = {
  OPENAI: [AI_PROVIDER_OPERATION.OPENAI],
  ANTHROPIC: [AI_PROVIDER_OPERATION.ANTHROPIC],
  GEMINI: [AI_PROVIDER_OPERATION.GEMINI, ...AI_VOICE_PROVIDER_OPERATIONS.GEMINI],
  DEEPSEEK: [AI_PROVIDER_OPERATION.DEEPSEEK],
  SPEECHMATICS: AI_VOICE_PROVIDER_OPERATIONS.SPEECHMATICS,
};

/** The voice capabilities that spend a call. */
export const AI_VOICE_FEATURE_FAMILIES = [
  'VOICE_NOTE_TRANSCRIPTION',
  'LIVE_CALL_TRANSCRIPTION',
  'SPEECH_SYNTHESIS',
  'SPEECH_RENDERING',
] as const;
export type AiVoiceFeatureFamily = typeof AI_VOICE_FEATURE_FAMILIES[number];

/** Exactly migration 0184's `ai_provider_calls_feature_family_check`. */
export const AI_LEDGER_FEATURE_FAMILIES = [...AI_FEATURE_FAMILIES, ...AI_VOICE_FEATURE_FAMILIES] as const;

/**
 * The voice billable kinds:
 *   AUDIO_INPUT_MS       transcribed input audio, in milliseconds (Speechmatics);
 *   AUDIO_OUTPUT_TOKEN   generated audio, in the provider's audio tokens (Gemini speech; D-1: speech is billed in tokens).
 * A Gemini speech call's text input is the existing INPUT_TOKEN.
 */
export const AI_VOICE_USAGE_KINDS = ['AUDIO_INPUT_MS', 'AUDIO_OUTPUT_TOKEN'] as const;
export type AiVoiceUsageKind = typeof AI_VOICE_USAGE_KINDS[number];

/** Exactly migration 0184's usage and component kind CHECKs. */
export const AI_LEDGER_USAGE_KINDS = [...AI_USAGE_KINDS, ...AI_VOICE_USAGE_KINDS] as const;
export type AiLedgerUsageKind = typeof AI_LEDGER_USAGE_KINDS[number];

/** The kinds a COMPLETE usage of each voice operation carries (migration 0184 `ai_complete_usage_kinds_v2`). */
export const AI_VOICE_COMPLETE_USAGE_KINDS: Readonly<Record<AiVoiceOperation, readonly AiLedgerUsageKind[]>> = {
  SPEECHMATICS_REALTIME_TRANSCRIPTION: ['AUDIO_INPUT_MS'],
  SPEECHMATICS_BATCH_TRANSCRIPTION: ['AUDIO_INPUT_MS'],
  GEMINI_SPEECH_GENERATION: ['AUDIO_OUTPUT_TOKEN', 'INPUT_TOKEN'],
};

/**
 * D-2: where a settled quantity came from. GATEWAY_MEASURED is what QANDEEL's gateway measured of the audio it streamed;
 * it is never evidence that the provider billed the same quantity, is never presented as provider usage, and is
 * admitted only for the two Speechmatics operations. Every reader keeps the two apart.
 */
export const AI_USAGE_SOURCES = ['PROVIDER_REPORTED', 'GATEWAY_MEASURED'] as const;
export type AiUsageSource = typeof AI_USAGE_SOURCES[number];
export const AI_GATEWAY_MEASURABLE_OPERATIONS: readonly AiVoiceOperation[] = AI_VOICE_PROVIDER_OPERATIONS.SPEECHMATICS;

/** What a voice usage reported, normalized as the text usage is: never padded with a zero. */
export type NormalizedAiVoiceUsage =
  | { readonly completeness: 'COMPLETE' | 'INCOMPLETE'; readonly quantities: Readonly<Partial<Record<AiLedgerUsageKind, number>>> }
  | { readonly completeness: 'ABSENT' };
