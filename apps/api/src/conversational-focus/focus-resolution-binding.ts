// T-03B1b2 - the lazy focus-provider binding seam, mirroring T-03A2's
// segmentation seam.
//
// The real DeepSeek adapter is constructed on FIRST ACTUAL NEED inside one
// establishment run - never at module import, never at service construction,
// never for a complete replay, an invalid exchange or partial/legacy semantic
// history. Starting the application, or running any unrelated test, never
// requires DEEPSEEK_API_KEY. Tests inject a deterministic fake through the same
// seam, and CI makes no live provider request.

import { loadFocusResolutionDeepSeekConfig } from './focus-resolution-provider.config';
import type { FocusResolutionProvider } from './focus-resolution-provider.types';
import { DeepSeekFocusResolutionProvider } from './deepseek-focus-resolution.provider';
import { createDeepSeekClient, type DeepSeekJsonClient } from '../model-router/providers/deepseek/deepseek-client';

/** The focus-resolution binding actually used for one exchange. */
export interface FocusResolutionBinding {
  readonly provider: FocusResolutionProvider;
  readonly providerName: string;
  readonly providerModel: string;
}

export type FocusResolutionBindingFactory = () => FocusResolutionBinding;

/** Decorates the transport client the adapter is built with (AI-COST-01 provider-call accounting). */
export type FocusResolutionClientDecorator = (client: DeepSeekJsonClient) => DeepSeekJsonClient;

/**
 * The production factory. Calling the returned function - not creating it -
 * reads the environment and constructs the adapter.
 */
export function deepSeekFocusResolutionBinding(
  environment: NodeJS.ProcessEnv,
  // AI-COST-01: the composition root passes the provider-call accounting decorator for the transport client. S8A-03:
  // it is required, so no composition of this binding can reach DeepSeek unaccounted.
  decorateClient: FocusResolutionClientDecorator,
): FocusResolutionBindingFactory {
  return () => {
    const config = loadFocusResolutionDeepSeekConfig(environment);
    return {
      provider: new DeepSeekFocusResolutionProvider(config, decorateClient(createDeepSeekClient(config))),
      providerName: config.provider,
      providerModel: config.model,
    };
  };
}
