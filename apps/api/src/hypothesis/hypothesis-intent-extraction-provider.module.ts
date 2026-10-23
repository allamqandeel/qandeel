import { Module } from '@nestjs/common';
import { FakeHypothesisIntentExtractionProvider } from './fake-hypothesis-intent-extraction.provider';
import { DeepSeekHypothesisIntentExtractionProvider } from './deepseek-hypothesis-intent-extraction.provider';
import { loadHypothesisIntentExtractionDeepSeekConfig } from './hypothesis-intent-extraction-provider.config';
import { accountedDeepSeekChatCompletionsClient } from '../ai-usage/accounted-provider-clients';
import { createDeepSeekClient } from '../model-router/providers/deepseek/deepseek-client';
import { productionAiProviderCallAccounting } from '../ai-usage/production-ai-provider-call-accounting';
import { HYPOTHESIS_INTENT_EXTRACTION_PROVIDER, type HypothesisIntentExtractionProvider } from './hypothesis-intent-extraction-provider.types';

export function createConfiguredHypothesisIntentExtractionProvider(
  environment: NodeJS.ProcessEnv = process.env,
): HypothesisIntentExtractionProvider {
  if (environment.NODE_ENV === 'test') return new FakeHypothesisIntentExtractionProvider();
  // AI-COST-01: every extraction attempt passes the one accounting boundary. S8A-03: DeepSeek Flash, behind the
  // SYNTHETIC_ONLY qualification gate; this is the adapter's only composition.
  const config = loadHypothesisIntentExtractionDeepSeekConfig(environment);
  return new DeepSeekHypothesisIntentExtractionProvider(config, accountedDeepSeekChatCompletionsClient(
    createDeepSeekClient(config), 'HYPOTHESIS_INTENT_EXTRACTION', productionAiProviderCallAccounting()));
}

/**
 * Defers extraction-provider construction to the first extraction. Same reasoning and the same
 * one-method shape as `deferredModelRouter`: Nest calls `useFactory` at bootstrap, so reading
 * a provider key there made a provider credential a precondition of STARTING the API — and
 * therefore of serving auth, Session, temporal and projection, none of which extract anything.
 *
 * Configuration validates at the first extraction; an absent credential or an undeclared
 * qualification mode throws there.
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
