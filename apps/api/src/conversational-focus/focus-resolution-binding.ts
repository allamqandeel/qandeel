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

/**
 * The production factory. Calling the returned function - not creating it -
 * reads the environment and constructs the adapter.
 */
export function openAiFocusResolutionBinding(environment: NodeJS.ProcessEnv = process.env): FocusResolutionBindingFactory {
  return () => {
    const config = loadFocusResolutionOpenAIConfig(environment);
    return {
      provider: new OpenAiFocusResolutionProvider(config, createOpenAiFocusClient(config)),
      providerName: config.provider,
      providerModel: config.model,
    };
  };
}
