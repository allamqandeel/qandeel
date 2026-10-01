import {
  normalizeAnthropicMessagesUsage,
  normalizeGeminiGenerateContentUsage,
  normalizeOpenAIResponsesUsage,
} from './ai-usage-normalization';

describe('AI-COST-01 usage normalization: a disjoint partition, unknown never zero', () => {
  describe('OpenAI Responses (input_tokens INCLUDES cached and cache-written tokens)', () => {
    it('splits the inclusive input total into uncached, cache read and cache write without double counting', () => {
      const usage = normalizeOpenAIResponsesUsage({ usage: {
        input_tokens: 1000, input_tokens_details: { cached_tokens: 600, cache_write_tokens: 100 },
        output_tokens: 250, output_tokens_details: { reasoning_tokens: 200 }, total_tokens: 1250,
      } });
      expect(usage).toEqual({ completeness: 'COMPLETE', quantities: {
        INPUT_TOKEN: 300, CACHE_READ_INPUT_TOKEN: 600, CACHE_WRITE_INPUT_TOKEN: 100, OUTPUT_TOKEN: 250,
      } });
      // Reasoning tokens are inside output_tokens: never added again.
      const q = (usage as { quantities: Record<string, number> }).quantities;
      expect(q.INPUT_TOKEN + q.CACHE_READ_INPUT_TOKEN + q.CACHE_WRITE_INPUT_TOKEN).toBe(1000);
    });

    it('keeps reported zeros as zeros', () => {
      expect(normalizeOpenAIResponsesUsage({ usage: { input_tokens: 10, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens: 0 } }))
        .toEqual({ completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 10, CACHE_READ_INPUT_TOKEN: 0, CACHE_WRITE_INPUT_TOKEN: 0, OUTPUT_TOKEN: 0 } });
    });

    it('missing usage is ABSENT, never zero tokens', () => {
      for (const response of [{}, { usage: null }, { usage: 'x' }, null, undefined, { output_text: 'hi' }]) {
        expect(normalizeOpenAIResponsesUsage(response)).toEqual({ completeness: 'ABSENT' });
      }
    });

    it('a missing cache field is NOT "uncached": the uncached input is unknown', () => {
      const usage = normalizeOpenAIResponsesUsage({ usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 600 }, output_tokens: 5 } });
      expect(usage).toEqual({ completeness: 'INCOMPLETE', quantities: { CACHE_READ_INPUT_TOKEN: 600, OUTPUT_TOKEN: 5 } });
      expect(normalizeOpenAIResponsesUsage({ usage: { input_tokens: 1000, output_tokens: 5 } }))
        .toEqual({ completeness: 'INCOMPLETE', quantities: { OUTPUT_TOKEN: 5 } });
    });

    it('contradictory or malformed figures are not trusted', () => {
      expect(normalizeOpenAIResponsesUsage({ usage: { input_tokens: 10, input_tokens_details: { cached_tokens: 8, cache_write_tokens: 5 }, output_tokens: 1 } }))
        .toEqual({ completeness: 'INCOMPLETE', quantities: { OUTPUT_TOKEN: 1 } });
      expect(normalizeOpenAIResponsesUsage({ usage: { input_tokens: -1, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens: 1.5 } }))
        .toEqual({ completeness: 'INCOMPLETE', quantities: { CACHE_READ_INPUT_TOKEN: 0, CACHE_WRITE_INPUT_TOKEN: 0 } });
      expect(normalizeOpenAIResponsesUsage({ usage: { input_tokens: 10, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } } }))
        .toEqual({ completeness: 'INCOMPLETE', quantities: { INPUT_TOKEN: 10, CACHE_READ_INPUT_TOKEN: 0, CACHE_WRITE_INPUT_TOKEN: 0 } });
    });
  });

  describe('Anthropic Messages (input_tokens EXCLUDES cache tokens)', () => {
    it('maps each field to its own kind', () => {
      expect(normalizeAnthropicMessagesUsage({ usage: { input_tokens: 50, cache_read_input_tokens: 900, cache_creation_input_tokens: 40, output_tokens: 70 } }))
        .toEqual({ completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 50, CACHE_READ_INPUT_TOKEN: 900, CACHE_WRITE_INPUT_TOKEN: 40, OUTPUT_TOKEN: 70 } });
    });

    it('a null cache field is unknown, not zero', () => {
      expect(normalizeAnthropicMessagesUsage({ usage: { input_tokens: 50, cache_read_input_tokens: null, cache_creation_input_tokens: 0, output_tokens: 70 } }))
        .toEqual({ completeness: 'INCOMPLETE', quantities: { INPUT_TOKEN: 50, CACHE_WRITE_INPUT_TOKEN: 0, OUTPUT_TOKEN: 70 } });
      expect(normalizeAnthropicMessagesUsage({ content: [] })).toEqual({ completeness: 'ABSENT' });
    });

    it('a 1-hour cache write (a different rate) is never priced as a 5-minute one', () => {
      expect(normalizeAnthropicMessagesUsage({ usage: {
        input_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 30, output_tokens: 7,
        cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 20 },
      } })).toEqual({ completeness: 'INCOMPLETE', quantities: { INPUT_TOKEN: 5, CACHE_READ_INPUT_TOKEN: 0, OUTPUT_TOKEN: 7 } });
      expect(normalizeAnthropicMessagesUsage({ usage: {
        input_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 10, output_tokens: 7,
        cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 0 },
      } }).completeness).toBe('COMPLETE');
    });
  });

  describe('Gemini generateContent (promptTokenCount INCLUDES cached content; thoughts are output)', () => {
    it('removes cached content from input and adds thinking to output', () => {
      expect(normalizeGeminiGenerateContentUsage({ usageMetadata: {
        promptTokenCount: 1000, cachedContentTokenCount: 400, candidatesTokenCount: 30, thoughtsTokenCount: 12, totalTokenCount: 1042,
      } })).toEqual({ completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 600, CACHE_READ_INPUT_TOKEN: 400, OUTPUT_TOKEN: 42 } });
    });

    it('an omitted optional count inside a present usageMetadata is proto3\'s zero; the required prompt count is never assumed', () => {
      expect(normalizeGeminiGenerateContentUsage({ usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 9 } }))
        .toEqual({ completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 80, CACHE_READ_INPUT_TOKEN: 0, OUTPUT_TOKEN: 9 } });
      expect(normalizeGeminiGenerateContentUsage({ usageMetadata: { candidatesTokenCount: 9 } }))
        .toEqual({ completeness: 'INCOMPLETE', quantities: { OUTPUT_TOKEN: 9 } });
      expect(normalizeGeminiGenerateContentUsage({ candidates: [] })).toEqual({ completeness: 'ABSENT' });
    });

    it('a present but malformed or contradictory count is not trusted, and tool-use input is unknown', () => {
      expect(normalizeGeminiGenerateContentUsage({ usageMetadata: { promptTokenCount: 10, cachedContentTokenCount: 20, candidatesTokenCount: 1 } }))
        .toEqual({ completeness: 'INCOMPLETE', quantities: { OUTPUT_TOKEN: 1 } });
      expect(normalizeGeminiGenerateContentUsage({ usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 'x' } }))
        .toEqual({ completeness: 'INCOMPLETE', quantities: { INPUT_TOKEN: 10, CACHE_READ_INPUT_TOKEN: 0 } });
      expect(normalizeGeminiGenerateContentUsage({ usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2, toolUsePromptTokenCount: 4 } }))
        .toEqual({ completeness: 'INCOMPLETE', quantities: { OUTPUT_TOKEN: 2 } });
    });
  });
});
