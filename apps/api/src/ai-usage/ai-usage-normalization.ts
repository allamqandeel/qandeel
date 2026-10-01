// AI-COST-01 - provider usage -> the normalized disjoint partition.
//
// Each provider reports usage in its own shape, and the shapes disagree about what "input" includes. The normalizers
// below translate one provider response into INPUT_TOKEN / CACHE_READ_INPUT_TOKEN / CACHE_WRITE_INPUT_TOKEN /
// OUTPUT_TOKEN so that every token is counted in exactly one kind. They never guess:
//
//   * no usage object                         -> ABSENT (the call's cost is unknown, never zero);
//   * a field the partition needs is missing,
//     malformed, or contradicts another field  -> INCOMPLETE, carrying only the kinds that are known for certain;
//   * a cache field that is absent            -> NOT "uncached": the uncached input cannot be derived, so it is unknown.
//
// The single provider-documented exception is Gemini: its REST surface is proto3 JSON, where an integer count equal to
// zero is omitted from the object, so an optional count missing from a PRESENT usageMetadata is a reported zero. Its
// required count (promptTokenCount) is never treated that way.
//
// Sources (research record, AI-COST-01 implementation record §2): OpenAI Responses `usage` - input_tokens INCLUDES
// input_tokens_details.cached_tokens and .cache_write_tokens; output_tokens INCLUDES reasoning tokens. Anthropic Messages
// `usage` - input_tokens EXCLUDES cache_read_input_tokens and cache_creation_input_tokens; a 1-hour cache write is priced
// differently from a 5-minute one. Gemini `usageMetadata` - promptTokenCount INCLUDES cachedContentTokenCount;
// thoughtsTokenCount is NOT in candidatesTokenCount and is billed as output.

import type { AiUsageKind, NormalizedAiUsage } from './ai-usage.types';
import { ABSENT_AI_USAGE } from './ai-usage.types';

type Quantities = Partial<Record<AiUsageKind, number>>;

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function result(quantities: Quantities, complete: boolean): NormalizedAiUsage {
  const known = Object.fromEntries(Object.entries(quantities).filter(([, value]) => value !== undefined)) as Quantities;
  if (Object.keys(known).length === 0) return ABSENT_AI_USAGE;
  return Object.freeze({ completeness: complete ? 'COMPLETE' : 'INCOMPLETE', quantities: Object.freeze(known) });
}

/** OpenAI Responses API: `response.usage`. */
export function normalizeOpenAIResponsesUsage(response: unknown): NormalizedAiUsage {
  const usage = record(record(response)?.usage);
  if (!usage) return ABSENT_AI_USAGE;
  const input = count(usage.input_tokens);
  const output = count(usage.output_tokens);
  const details = record(usage.input_tokens_details);
  const cacheRead = count(details?.cached_tokens);
  const cacheWrite = count(details?.cache_write_tokens);
  if (input === undefined || cacheRead === undefined || cacheWrite === undefined || cacheRead + cacheWrite > input) {
    // The uncached input cannot be separated from the cached share: only what is certain is kept. Contradictory
    // cache figures are not certain either.
    const contradictory = input !== undefined && cacheRead !== undefined && cacheWrite !== undefined && cacheRead + cacheWrite > input;
    const certain = (part: number | undefined) => (!contradictory && part !== undefined && (input === undefined || part <= input) ? part : undefined);
    return result({ OUTPUT_TOKEN: output, CACHE_READ_INPUT_TOKEN: certain(cacheRead), CACHE_WRITE_INPUT_TOKEN: certain(cacheWrite) }, false);
  }
  return result({
    INPUT_TOKEN: input - cacheRead - cacheWrite,
    CACHE_READ_INPUT_TOKEN: cacheRead,
    CACHE_WRITE_INPUT_TOKEN: cacheWrite,
    OUTPUT_TOKEN: output,
  }, output !== undefined);
}

/** Anthropic Messages API: `message.usage`. */
export function normalizeAnthropicMessagesUsage(message: unknown): NormalizedAiUsage {
  const usage = record(record(message)?.usage);
  if (!usage) return ABSENT_AI_USAGE;
  const quantities: Quantities = {
    INPUT_TOKEN: count(usage.input_tokens),
    CACHE_READ_INPUT_TOKEN: count(usage.cache_read_input_tokens),
    CACHE_WRITE_INPUT_TOKEN: count(usage.cache_creation_input_tokens),
    OUTPUT_TOKEN: count(usage.output_tokens),
  };
  // A 1-hour cache write is priced differently from a 5-minute one, and CACHE_WRITE_INPUT_TOKEN is one rate. Production
  // QANDEEL sets no cache_control, so this never happens; if it ever does, the write is not mispriced - it is unknown.
  const byTtl = record(usage.cache_creation);
  const oneHourWrites = count(byTtl?.ephemeral_1h_input_tokens);
  if (byTtl && (oneHourWrites === undefined || oneHourWrites > 0)) {
    return result({ ...quantities, CACHE_WRITE_INPUT_TOKEN: undefined }, false);
  }
  return result(quantities, Object.values(quantities).every((value) => value !== undefined));
}

/** Gemini generateContent: `response.usageMetadata` (proto3 JSON: an optional zero count is omitted). */
export function normalizeGeminiGenerateContentUsage(body: unknown): NormalizedAiUsage {
  const usage = record(record(body)?.usageMetadata);
  if (!usage) return ABSENT_AI_USAGE;
  const optional = (key: string): number | undefined => (key in usage ? count(usage[key]) : 0);
  const prompt = count(usage.promptTokenCount);
  const cached = optional('cachedContentTokenCount');
  const candidates = optional('candidatesTokenCount');
  const thoughts = optional('thoughtsTokenCount');
  const toolPrompt = optional('toolUsePromptTokenCount');
  const output = candidates !== undefined && thoughts !== undefined ? candidates + thoughts : undefined;
  // Tool-use prompt tokens are not part of QANDEEL's partition (no production call uses tools): any is unknown input.
  if (prompt === undefined || cached === undefined || cached > prompt || toolPrompt !== 0) {
    return result({ OUTPUT_TOKEN: output }, false);
  }
  return result({ INPUT_TOKEN: prompt - cached, CACHE_READ_INPUT_TOKEN: cached, OUTPUT_TOKEN: output }, output !== undefined);
}
