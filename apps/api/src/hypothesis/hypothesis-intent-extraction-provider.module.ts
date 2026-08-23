import { Module } from '@nestjs/common';
import { FakeHypothesisIntentExtractionProvider } from './fake-hypothesis-intent-extraction.provider';
import { OpenAIHypothesisIntentExtractionProvider } from './openai-hypothesis-intent-extraction.provider';
import { HYPOTHESIS_INTENT_EXTRACTION_PROVIDER, type HypothesisIntentExtractionProvider } from './hypothesis-intent-extraction-provider.types';

export function createConfiguredHypothesisIntentExtractionProvider(
  environment: NodeJS.ProcessEnv = process.env,
): HypothesisIntentExtractionProvider {
  if (environment.NODE_ENV === 'test') return new FakeHypothesisIntentExtractionProvider();
  return OpenAIHypothesisIntentExtractionProvider.fromEnvironment(environment);
}

@Module({
  providers: [{
    provide: HYPOTHESIS_INTENT_EXTRACTION_PROVIDER,
    useFactory: () => createConfiguredHypothesisIntentExtractionProvider(process.env),
  }],
  exports: [HYPOTHESIS_INTENT_EXTRACTION_PROVIDER],
})
export class HypothesisIntentExtractionProviderModule {}
