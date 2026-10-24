import * as registry from './model-profile.registry';
import { resolveDeepSeekModel } from './model-profile.registry';

describe('Model Profile Registry', () => {
  it('maps the DeepSeek Flash profile and its server-owned thinking deterministically', () => {
    expect(resolveDeepSeekModel('FAST')).toEqual({ model: 'deepseek-flash', thinking: 'disabled' });
    expect(resolveDeepSeekModel('DEEP')).toEqual({ model: 'deepseek-flash', thinking: 'enabled', reasoningEffort: 'low' });
  });

  it('S8A-03 (D1): holds no Anthropic or OpenAI profile', () => {
    expect(Object.keys(registry).sort()).toEqual(['DEEPSEEK_MODEL_PROFILE', 'resolveDeepSeekModel']);
  });
});
