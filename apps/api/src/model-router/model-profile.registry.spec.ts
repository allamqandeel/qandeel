import {
  resolveAnthropicModel,
  resolveOpenAIModel,
} from './model-profile.registry';

describe('Model Profile Registry', () => {
  it('maps the Anthropic profile deterministically', () => {
    expect(resolveAnthropicModel('FAST')).toEqual({ model: 'claude-haiku-4-5-20251001' });
    expect(resolveAnthropicModel('DEEP')).toEqual({ model: 'claude-sonnet-4-6' });
  });

  it('maps the OpenAI profile and server-owned reasoning deterministically', () => {
    expect(resolveOpenAIModel('FAST')).toEqual({ model: 'gpt-5.6-luna', reasoningEffort: 'none' });
    expect(resolveOpenAIModel('DEEP')).toEqual({ model: 'gpt-5.6-terra', reasoningEffort: 'low' });
  });
});
