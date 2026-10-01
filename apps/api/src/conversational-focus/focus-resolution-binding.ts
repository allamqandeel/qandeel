// T-03B1b2 - the lazy focus-provider binding seam, mirroring T-03A2's
// segmentation seam.
//
// The real OpenAI adapter is constructed on FIRST ACTUAL NEED inside one
// establishment run - never at module import, never at service construction,
// never for a complete replay, an invalid exchange or partial/legacy semantic
// history. Starting the application, or running any unrelated test, never
// requires OPENAI_API_KEY. Tests inject a deterministic fake through the same
// seam, and CI makes no live provider request.

import { loadFocusResolutionOpenAIConfig } from './focus-resolution-provider.config';
import type { FocusResolutionProvider } from './focus-resolution-provider.types';
import { createOpenAiFocusClient, OpenAiFocusResolutionProvider } from './openai-focus-resolution.provider';

/** The focus-resolution binding actually used for one exchange. */
export interface FocusResolutionBinding {
  readonly provider: FocusResolutionProvider;
  readonly providerName: string;
  readonly providerModel: string;
}

export type FocusResolutionBindingFactory = () => FocusResolutionBinding;

/** Decorates the transport client the adapter is built with (AI-COST-01 provider-call accounting). */
export type FocusResolutionClientDecorator = (client: ReturnType<typeof createOpenAiFocusClient>) => ReturnType<typeof createOpenAiFocusClient>;

/**
 * The production factory. Calling the returned function - not creating it -
 * reads the environment and constructs the adapter.
 */
export function openAiFocusResolutionBinding(
  environment: NodeJS.ProcessEnv = process.env,
  // AI-COST-01: the composition root passes the provider-call accounting decorator for the transport client; the
  // adapter itself is unchanged and this slice imports nothing new.
  decorateClient: FocusResolutionClientDecorator = (client) => client,
): FocusResolutionBindingFactory {
  return () => {
    const config = loadFocusResolutionOpenAIConfig(environment);
    return {
      provider: new OpenAiFocusResolutionProvider(config, decorateClient(createOpenAiFocusClient(config))),
      providerName: config.provider,
      providerModel: config.model,
    };
  };
}
