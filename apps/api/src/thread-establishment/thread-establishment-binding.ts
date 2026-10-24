// T-03B2b3 - the lazy Thread-provider binding seam, mirroring T-03B1b2's
// focus binding and T-03A2's segmentation seam.
//
// The real DeepSeek adapter is constructed on FIRST ACTUAL NEED inside one
// establishment run - never at module import, never at API bootstrap, never at
// service construction, never for a complete replay, an invalid exchange or a
// partial / legacy exchange, and never before it is semantically needed.
// Starting the application, or running any unrelated test, never requires
// DEEPSEEK_API_KEY. Tests inject a deterministic fake through the same seam,
// and CI makes no live provider request.
//
// No B2a semantic meaning is changed (S8A-03 changes the provider only).

import { loadThreadEstablishmentDeepSeekConfig } from './thread-establishment-provider.config';
import type { ThreadEstablishmentProvider } from './thread-establishment-provider.types';
import { DeepSeekThreadEstablishmentProvider } from './deepseek-thread-establishment.provider';
import { createDeepSeekClient, type DeepSeekJsonClient } from '../model-router/providers/deepseek/deepseek-client';

/** The Thread-establishment binding actually used for one exchange. */
export interface ThreadEstablishmentBinding {
  readonly provider: ThreadEstablishmentProvider;
  readonly providerName: string;
  readonly providerModel: string;
}

export type ThreadEstablishmentBindingFactory = () => ThreadEstablishmentBinding;

/** Decorates the transport client the adapter is built with (AI-COST-01 provider-call accounting). */
export type ThreadEstablishmentClientDecorator = (client: DeepSeekJsonClient) => DeepSeekJsonClient;

/**
 * The production factory. Calling the returned function - not creating it -
 * reads the environment and constructs the adapter.
 */
export function deepSeekThreadEstablishmentBinding(
  environment: NodeJS.ProcessEnv,
  // AI-COST-01: the composition root passes the provider-call accounting decorator for the transport client. S8A-03:
  // it is required, so no composition of this binding can reach DeepSeek unaccounted.
  decorateClient: ThreadEstablishmentClientDecorator,
): ThreadEstablishmentBindingFactory {
  return () => {
    const config = loadThreadEstablishmentDeepSeekConfig(environment);
    return {
      provider: new DeepSeekThreadEstablishmentProvider(config, decorateClient(createDeepSeekClient(config))),
      providerName: config.provider,
      providerModel: config.model,
    };
  };
}
