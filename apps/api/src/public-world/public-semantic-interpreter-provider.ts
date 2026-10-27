// S8A-05 CP3 — the one composition of the Public semantic interpreter (Controlled Amendment A-4).
//
//   NODE_ENV=test   the deterministic test interpreter, which reads nothing but its input;
//   otherwise       DeepSeek Flash through the shared client, behind the SYNTHETIC_ONLY qualification gate, and through the
//                   ONE AI-COST-01 accounting boundary under its own feature family PUBLIC_SEMANTIC_INTERPRETATION
//                   (migration 0181), paid by the publisher who asked. It is built on the first attempt, so the API starts
//                   without a credential; where DeepSeek may not run (a production process, an undeclared mode, no key)
//                   every attempt is refused before any request, and the service answers INTERPRETATION_UNAVAILABLE.
//
// The port's own `createConfiguredPublicSemanticInterpreter` stays the refusing default; this is the only place a
// provider is chosen. The placement is not a provider: it is the database's deterministic, free P-dom rule.
import { accountedDeepSeekChatCompletionsClient } from '../ai-usage/accounted-provider-clients';
import { productionAiProviderCallAccounting } from '../ai-usage/production-ai-provider-call-accounting';
import { createDeepSeekClient } from '../model-router/providers/deepseek/deepseek-client';
import { DeepSeekPublicSemanticInterpreter } from './deepseek-public-semantic-interpreter';
import { FakePublicSemanticInterpreter, type PublicSemanticInterpreter } from './public-semantic-interpreter';
import { loadPublicSemanticInterpretationDeepSeekConfig } from './public-semantic-interpreter-provider.config';

export function createProductionPublicSemanticInterpreter(environment: NodeJS.ProcessEnv = process.env): PublicSemanticInterpreter {
  if (environment.NODE_ENV === 'test') return new FakePublicSemanticInterpreter();
  return deferredPublicSemanticInterpreter(() => {
    const config = loadPublicSemanticInterpretationDeepSeekConfig(environment);
    return new DeepSeekPublicSemanticInterpreter(config, accountedDeepSeekChatCompletionsClient(
      createDeepSeekClient(config), 'PUBLIC_SEMANTIC_INTERPRETATION', productionAiProviderCallAccounting()));
  });
}

/** Defers construction to the first attempt, as every structured provider does; a refused construction refuses that attempt. */
export function deferredPublicSemanticInterpreter(resolve: () => PublicSemanticInterpreter): PublicSemanticInterpreter {
  let resolved: PublicSemanticInterpreter | undefined;
  return {
    propose: async (input, signal) => {
      resolved ??= resolve();
      return resolved.propose(input, signal);
    },
    assessCorrection: async (input, signal) => {
      resolved ??= resolve();
      return resolved.assessCorrection(input, signal);
    },
  };
}
