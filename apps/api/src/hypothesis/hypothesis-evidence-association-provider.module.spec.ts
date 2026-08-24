import { FakeHypothesisEvidenceAssociationProvider } from './fake-hypothesis-evidence-association.provider';
import { GeminiHypothesisEvidenceAssociationProvider } from './gemini-hypothesis-evidence-association.provider';
import { createConfiguredHypothesisEvidenceAssociationProvider } from './hypothesis-evidence-association-provider.module';

describe('HypothesisEvidenceAssociationProviderModule', () => {
  it('uses only the fake in test mode without a network call', () => expect(createConfiguredHypothesisEvidenceAssociationProvider({ NODE_ENV: 'test' })).toBeInstanceOf(FakeHypothesisEvidenceAssociationProvider));
  it('fails closed without a production key', () => expect(() => createConfiguredHypothesisEvidenceAssociationProvider({ NODE_ENV: 'production' })).toThrow('GOOGLE_AI_API_KEY'));
  it('constructs Gemini without invoking it outside test mode', () => expect(createConfiguredHypothesisEvidenceAssociationProvider({ NODE_ENV: 'production', GOOGLE_AI_API_KEY: 'key' })).toBeInstanceOf(GeminiHypothesisEvidenceAssociationProvider));
});
