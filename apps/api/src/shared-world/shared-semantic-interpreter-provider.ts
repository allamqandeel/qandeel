// S8A-04 CP1 — the one composition of the Shared semantic interpreter (Product Owner D3 / D4, 2026-10-24).
//
//   NODE_ENV=test   the deterministic test interpreter, which reads nothing but its input;
//   otherwise       DeepSeek Flash through the shared client, behind the SYNTHETIC_ONLY qualification gate, and through the
//                   ONE AI-COST-01 accounting boundary under its own feature family SHARED_SEMANTIC_READING (migration 0174).
//                   It is built on the first reading, so the API starts without a credential; where DeepSeek may not run
//                   (a production process, an undeclared mode, no key) every reading is refused before any request.
//
// Only the interpreter is bound. The Shared spatial placer still refuses (D4), so the place pass returns NO_PROVIDER before
// it leases, reads or spends anything, and no place is produced in the application until CP2.
import { accountedDeepSeekChatCompletionsClient } from '../ai-usage/accounted-provider-clients';
import { productionAiProviderCallAccounting } from '../ai-usage/production-ai-provider-call-accounting';
import { createDeepSeekClient } from '../model-router/providers/deepseek/deepseek-client';
import { DeepSeekSharedSemanticInterpreter } from './deepseek-shared-semantic-interpreter';
import { FakeSharedSemanticInterpreter, type SharedSemanticInterpreter } from './shared-semantic-interpreter';
import { loadSharedSemanticReadingDeepSeekConfig } from './shared-semantic-interpreter-provider.config';

export function createConfiguredSharedSemanticInterpreter(environment: NodeJS.ProcessEnv = process.env): SharedSemanticInterpreter {
  if (environment.NODE_ENV === 'test') return new FakeSharedSemanticInterpreter();
  return deferredSharedSemanticInterpreter(() => {
    const config = loadSharedSemanticReadingDeepSeekConfig(environment);
    return new DeepSeekSharedSemanticInterpreter(config, accountedDeepSeekChatCompletionsClient(
      createDeepSeekClient(config), 'SHARED_SEMANTIC_READING', productionAiProviderCallAccounting()));
  });
}

/** Defers construction to the first reading, as every structured provider does; a refused construction refuses that reading. */
export function deferredSharedSemanticInterpreter(resolve: () => SharedSemanticInterpreter): SharedSemanticInterpreter {
  let resolved: SharedSemanticInterpreter | undefined;
  return {
    read: async (input, signal) => {
      resolved ??= resolve();
      return resolved.read(input, signal);
    },
  };
}
