import { Module } from '@nestjs/common';
import { accountedDeepSeekChatCompletionsClient } from '../ai-usage/accounted-provider-clients';
import { productionAiProviderCallAccounting } from '../ai-usage/production-ai-provider-call-accounting';
import { createDeepSeekClient } from '../model-router/providers/deepseek/deepseek-client';
import { DeepSeekPersonalUnderstandingCaptureProvider } from './deepseek-personal-understanding-capture.provider';
import { FakePersonalUnderstandingCaptureProvider } from './fake-personal-understanding-capture.provider';
import { loadPersonalUnderstandingCaptureDeepSeekConfig } from './personal-understanding-capture-provider.config';
import { PERSONAL_UNDERSTANDING_CAPTURE_PROVIDER, type PersonalUnderstandingCaptureProvider } from './personal-understanding.types';

export function createConfiguredPersonalUnderstandingCaptureProvider(
  environment: NodeJS.ProcessEnv = process.env,
): PersonalUnderstandingCaptureProvider {
  if (environment.NODE_ENV === 'test') return new FakePersonalUnderstandingCaptureProvider();
  // AI-COST-01: every capture attempt passes the one accounting boundary. S8A-03 CP2: DeepSeek Flash, behind the
  // SYNTHETIC_ONLY qualification gate; this is the adapter's only composition.
  const config = loadPersonalUnderstandingCaptureDeepSeekConfig(environment);
  return new DeepSeekPersonalUnderstandingCaptureProvider(config, accountedDeepSeekChatCompletionsClient(
    createDeepSeekClient(config), 'PERSONAL_UNDERSTANDING_CAPTURE', productionAiProviderCallAccounting()));
}

/** Defers construction to the first capture, as every structured provider does: no credential is needed to start the API. */
export function deferredPersonalUnderstandingCaptureProvider(
  resolve: () => PersonalUnderstandingCaptureProvider,
): PersonalUnderstandingCaptureProvider {
  let resolved: PersonalUnderstandingCaptureProvider | undefined;
  return {
    capture: async (request) => {
      resolved ??= resolve();
      return resolved.capture(request);
    },
  };
}

@Module({
  providers: [{
    provide: PERSONAL_UNDERSTANDING_CAPTURE_PROVIDER,
    useFactory: () => deferredPersonalUnderstandingCaptureProvider(() => createConfiguredPersonalUnderstandingCaptureProvider(process.env)),
  }],
  exports: [PERSONAL_UNDERSTANDING_CAPTURE_PROVIDER],
})
export class PersonalUnderstandingCaptureProviderModule {}
