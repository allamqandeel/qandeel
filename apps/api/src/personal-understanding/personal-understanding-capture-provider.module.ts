import { Module } from '@nestjs/common';
import { accountedDeepSeekChatCompletionsClient } from '../ai-usage/accounted-provider-clients';
import { productionAiProviderCallAccounting } from '../ai-usage/production-ai-provider-call-accounting';
import { createDeepSeekClient } from '../model-router/providers/deepseek/deepseek-client';
import { DeepSeekPersonalUnderstandingCaptureProvider } from './deepseek-personal-understanding-capture.provider';
import { FakePersonalUnderstandingCaptureProvider } from './fake-personal-understanding-capture.provider';
import { loadPersonalUnderstandingCaptureDeepSeekConfig } from './personal-understanding-capture-provider.config';
import { PERSONAL_UNDERSTANDING_CAPTURE_PROVIDER, type PersonalUnderstandingCaptureProviderV3 } from './personal-understanding.types';

export function createConfiguredPersonalUnderstandingCaptureProvider(
  environment: NodeJS.ProcessEnv = process.env,
): PersonalUnderstandingCaptureProviderV3 {
  if (environment.NODE_ENV === 'test') return new FakePersonalUnderstandingCaptureProvider();
  // AI-COST-01: every capture attempt passes the one accounting boundary. S8A-03 CP2: DeepSeek Flash, behind the
  // SYNTHETIC_ONLY qualification gate; this is the adapter's only composition. Open Understanding (CP2 amendment §10):
  // capture schema v3 on the same call, client, accounting purpose and configuration.
  const config = loadPersonalUnderstandingCaptureDeepSeekConfig(environment);
  return new DeepSeekPersonalUnderstandingCaptureProvider(config, accountedDeepSeekChatCompletionsClient(
    createDeepSeekClient(config), 'PERSONAL_UNDERSTANDING_CAPTURE', productionAiProviderCallAccounting()));
}

/** Defers construction to the first capture, as every structured provider does: no credential is needed to start the API. */
export function deferredPersonalUnderstandingCaptureProvider(
  resolve: () => PersonalUnderstandingCaptureProviderV3,
): PersonalUnderstandingCaptureProviderV3 {
  let resolved: PersonalUnderstandingCaptureProviderV3 | undefined;
  return {
    captureV3: async (request) => {
      resolved ??= resolve();
      return resolved.captureV3(request);
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
