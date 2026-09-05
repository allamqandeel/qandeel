// T-03B3 - the lazy Thread Continuity provider binding seam, mirroring the
// T-03B1b2 focus binding and the T-03B2b3 Thread binding - and stricter.
//
// The real OpenAI adapter is constructed on the FIRST ACTUAL CALL - never at
// module import, never at API bootstrap, never at service construction, never
// for a complete replay, an invalid exchange, a partial / legacy exchange, a
// same-Session already-bound focus, a CU with no independent focus or a
// zero-CU exchange. The binding itself reads only the provider IDENTITY
// (name + model), so recording capture provenance never needs
// OPENAI_API_KEY. Starting the application, or running any unrelated test,
// never requires the key. Tests inject a deterministic fake through the same
// seam, and CI makes no live provider request.

import { loadThreadContinuityOpenAIConfig, loadThreadContinuityProviderIdentity } from './thread-continuity-provider.config';
import type {
  ThreadContinuityProvider,
  ThreadContinuityResolutionProposal,
  ThreadContinuityResolutionRequest,
  ThreadContinuityScreeningProposal,
  ThreadContinuityScreeningRequest,
} from './thread-continuity-provider.types';
import { createOpenAiThreadContinuityClient, OpenAiThreadContinuityProvider } from './openai-thread-continuity.provider';

/** The Thread-continuity binding actually used for one exchange. */
export interface ThreadContinuityBinding {
  readonly provider: ThreadContinuityProvider;
  readonly providerName: string;
  readonly providerModel: string;
}

export type ThreadContinuityBindingFactory = () => ThreadContinuityBinding;

/**
 * The production factory. Calling the returned function reads the provider
 * identity only; the adapter (and the credential) is constructed on the first
 * real screening or resolution call.
 */
export function openAiThreadContinuityBinding(environment: NodeJS.ProcessEnv = process.env): ThreadContinuityBindingFactory {
  return () => {
    const identity = loadThreadContinuityProviderIdentity(environment);
    let adapter: OpenAiThreadContinuityProvider | undefined;
    const real = (): OpenAiThreadContinuityProvider => {
      if (adapter === undefined) {
        const config = loadThreadContinuityOpenAIConfig(environment);
        adapter = new OpenAiThreadContinuityProvider(config, createOpenAiThreadContinuityClient(config));
      }
      return adapter;
    };
    return {
      provider: {
        screen: async (request: ThreadContinuityScreeningRequest): Promise<ThreadContinuityScreeningProposal> => real().screen(request),
        resolve: async (request: ThreadContinuityResolutionRequest): Promise<ThreadContinuityResolutionProposal> => real().resolve(request),
      },
      providerName: identity.provider,
      providerModel: identity.model,
    };
  };
}
