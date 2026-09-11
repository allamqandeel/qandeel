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

/**
 * Defers extraction-provider construction to the first extraction. Same reasoning and the same
 * one-method shape as `deferredModelRouter`: Nest calls `useFactory` at bootstrap, so reading
 * `OPENAI_API_KEY` there made a provider credential a precondition of STARTING the API — and
 * therefore of serving auth, Session, temporal and projection, none of which extract anything.
 *
 * `OpenAIHypothesisIntentExtractionProvider.fromEnvironment` is unchanged and validates exactly as
 * before; an absent or invalid credential still throws the same error, at the first extraction.
 * Extraction still fails closed.
 */
export function deferredHypothesisIntentExtractionProvider(
  resolve: () => HypothesisIntentExtractionProvider,
): HypothesisIntentExtractionProvider {
  let resolved: HypothesisIntentExtractionProvider | undefined;
  return {
    // `async` for the same reason as `deferredModelRouter.generate`: a construction failure must
    // reach the caller as a rejection, never as a synchronous throw from a Promise-returning method.
    extract: async (request) => {
      resolved ??= resolve();
      return resolved.extract(request);
    },
  };
}

@Module({
  providers: [{
    provide: HYPOTHESIS_INTENT_EXTRACTION_PROVIDER,
    useFactory: () => deferredHypothesisIntentExtractionProvider(() => createConfiguredHypothesisIntentExtractionProvider(process.env)),
  }],
  exports: [HYPOTHESIS_INTENT_EXTRACTION_PROVIDER],
})
export class HypothesisIntentExtractionProviderModule {}
