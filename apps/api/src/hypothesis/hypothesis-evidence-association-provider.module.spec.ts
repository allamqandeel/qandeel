import { FakeHypothesisEvidenceAssociationProvider } from './fake-hypothesis-evidence-association.provider';
import { DeepSeekHypothesisEvidenceAssociationProvider } from './deepseek-hypothesis-evidence-association.provider';
import { loadHypothesisEvidenceAssociationDeepSeekConfig } from './hypothesis-evidence-association-provider.config';
import { createConfiguredHypothesisEvidenceAssociationProvider } from './hypothesis-evidence-association-provider.module';

const QUALIFIED = { DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'key' };

describe('HypothesisEvidenceAssociationProviderModule', () => {
  it('uses only the fake in test mode without a network call', () => expect(createConfiguredHypothesisEvidenceAssociationProvider({ NODE_ENV: 'test' })).toBeInstanceOf(FakeHypothesisEvidenceAssociationProvider));
  it('fails closed without the synthetic qualification or a key', () => {
    expect(() => createConfiguredHypothesisEvidenceAssociationProvider({ NODE_ENV: 'development' })).toThrow('SYNTHETIC_ONLY');
    expect(() => createConfiguredHypothesisEvidenceAssociationProvider({ GOOGLE_AI_API_KEY: 'key' })).toThrow('SYNTHETIC_ONLY');
    expect(() => createConfiguredHypothesisEvidenceAssociationProvider({ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY' })).toThrow('DEEPSEEK_API_KEY');
  });
  it('refuses production whatever it declares (S8A-01 qualification boundary)', () => expect(() => createConfiguredHypothesisEvidenceAssociationProvider({ ...QUALIFIED, NODE_ENV: 'production' })).toThrow('cannot be selected in production'));
  it('constructs DeepSeek Flash without invoking it outside test mode', () => expect(createConfiguredHypothesisEvidenceAssociationProvider({ ...QUALIFIED, NODE_ENV: 'development' })).toBeInstanceOf(DeepSeekHypothesisEvidenceAssociationProvider));
  it('loads the exact bounded defaults and refuses a leftover provider or model selection', () => {
    expect(loadHypothesisEvidenceAssociationDeepSeekConfig(QUALIFIED)).toEqual({ provider: 'DEEPSEEK', apiKey: 'key', model: 'deepseek-flash', timeoutMs: 5_000, maxOutputTokens: 256, maxRetries: 0, schemaVersion: 1 });
    expect(() => loadHypothesisEvidenceAssociationDeepSeekConfig({ ...QUALIFIED, HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER: 'GEMINI' })).toThrow('must be DEEPSEEK');
    expect(() => loadHypothesisEvidenceAssociationDeepSeekConfig({ ...QUALIFIED, HYPOTHESIS_EVIDENCE_ASSOCIATION_MODEL: 'gemini-2.5-flash-lite' })).toThrow('must be deepseek-flash');
    expect(() => loadHypothesisEvidenceAssociationDeepSeekConfig({ ...QUALIFIED, HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_OUTPUT_TOKENS: '513' })).toThrow('between 1 and 512');
  });
});
