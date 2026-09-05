// T-03B2b3 - the lazy Thread-provider binding seam, mirroring T-03B1b2's
// focus binding and T-03A2's segmentation seam.
//
// The real OpenAI adapter is constructed on FIRST ACTUAL NEED inside one
// establishment run - never at module import, never at API bootstrap, never at
// service construction, never for a complete replay, an invalid exchange or a
// partial / legacy exchange, and never before it is semantically needed.
// Starting the application, or running any unrelated test, never requires
// OPENAI_API_KEY. Tests inject a deterministic fake through the same seam, and
// CI makes no live provider request.
//
// The existing T-03B2a configuration, provider and client are reused exactly;
// no new dependency is introduced and no B2a semantic meaning is changed.

import { loadThreadEstablishmentOpenAIConfig } from './thread-establishment-provider.config';
import type { ThreadEstablishmentProvider } from './thread-establishment-provider.types';
import { createOpenAiThreadClient, OpenAiThreadEstablishmentProvider } from './openai-thread-establishment.provider';

/** The Thread-establishment binding actually used for one exchange. */
export interface ThreadEstablishmentBinding {
  readonly provider: ThreadEstablishmentProvider;
  readonly providerName: string;
  readonly providerModel: string;
}

export type ThreadEstablishmentBindingFactory = () => ThreadEstablishmentBinding;

/**
 * The production factory. Calling the returned function - not creating it -
 * reads the environment and constructs the adapter.
 */
export function openAiThreadEstablishmentBinding(environment: NodeJS.ProcessEnv = process.env): ThreadEstablishmentBindingFactory {
  return () => {
    const config = loadThreadEstablishmentOpenAIConfig(environment);
    return {
      provider: new OpenAiThreadEstablishmentProvider(config, createOpenAiThreadClient(config)),
      providerName: config.provider,
      providerModel: config.model,
    };
  };
}
