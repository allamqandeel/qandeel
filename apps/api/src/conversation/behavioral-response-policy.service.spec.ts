import {
  BehavioralResponsePolicyService,
  TEXT_V1_BEHAVIORAL_GUIDANCE,
} from './behavioral-response-policy.service';

describe('BehavioralResponsePolicyService', () => {
  it('builds deterministic, compact Text v1 guidance without provider or personal profiling', () => {
    const policy = new BehavioralResponsePolicyService();
    expect(policy.buildTextGuidance()).toBe(TEXT_V1_BEHAVIORAL_GUIDANCE);
    expect(policy.buildTextGuidance()).toBe(policy.buildTextGuidance());
    expect(policy.buildTextGuidance().length).toBeLessThanOrEqual(1_500);
    expect(policy.buildTextGuidance()).not.toMatch(/Claude|Anthropic|OpenAI|GPT|Gemini|Kimi/iu);
    expect(policy.buildTextGuidance()).not.toMatch(/the user is|the user has|diagnos/iu);
  });
});
