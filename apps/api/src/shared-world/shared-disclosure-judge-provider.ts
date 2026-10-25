// S8A-04 CP3 — the composition of the Shared disclosure judge (amendment §4).
//
//   NODE_ENV=test → the deterministic test judge; otherwise DeepSeek Flash through the shared client, behind the
//   SYNTHETIC_ONLY gate and the ONE AI-COST-01 boundary (family SHARED_DISCLOSURE_JUDGE, migration 0176). The gate is read
//   when the judge is composed: where DeepSeek may not run (a production process, an undeclared mode, no key) there is NO
//   judge, and with no judge the reply collects no personal knowledge at all — an item that could not be checked is never
//   used, and the reply is exactly what it was before CP3.
import { accountedDeepSeekChatCompletionsClient } from '../ai-usage/accounted-provider-clients';
import { productionAiProviderCallAccounting } from '../ai-usage/production-ai-provider-call-accounting';
import type { SharedDisclosureJudge, SharedDisclosureJudgeRequest } from '../connected-worlds/member-knowledge/shared-member-knowledge.types';
import { createDeepSeekClient } from '../model-router/providers/deepseek/deepseek-client';
import { DeepSeekSharedDisclosureJudge, sharedDisclosureAssessmentFromAnswer } from './deepseek-shared-disclosure-judge';
import { loadSharedDisclosureJudgeDeepSeekConfig, type SharedSocialMemoryDeepSeekConfig } from './shared-social-memory-provider.config';

/**
 * The deterministic test judge (NODE_ENV=test only): an item whose exact words appear in the reply is stated, and tied
 * to its owner when the owner's label appears too; anything else is nothing. Never a provider.
 */
export class FakeSharedDisclosureJudge implements SharedDisclosureJudge {
  async judge(request: SharedDisclosureJudgeRequest): Promise<unknown> {
    const answer = {
      items: request.items.map((entry, index) => {
        const stated = request.reply.includes(entry.item);
        return {
          ref: `I${index + 1}`,
          findings: stated ? ['DIRECT_PROTECTED_SOURCE_FACT', 'SOURCE_SPECIFIC_ATTRIBUTION'] : [],
          attributedTo: stated ? (request.reply.includes(request.owner) ? 'OWNER' : 'NONE') : 'NONE',
          unsupportedOwnerClaim: false,
        };
      }),
    };
    return sharedDisclosureAssessmentFromAnswer(answer, request, JSON.stringify(answer));
  }
}

/** The application's judge, or null where none may run. */
export function createConfiguredSharedDisclosureJudge(environment: NodeJS.ProcessEnv = process.env): SharedDisclosureJudge | null {
  if (environment.NODE_ENV === 'test') return new FakeSharedDisclosureJudge();
  let config: SharedSocialMemoryDeepSeekConfig;
  try {
    config = loadSharedDisclosureJudgeDeepSeekConfig(environment);
  } catch {
    return null;
  }
  return new DeepSeekSharedDisclosureJudge(config, accountedDeepSeekChatCompletionsClient(
    createDeepSeekClient(config), 'SHARED_DISCLOSURE_JUDGE', productionAiProviderCallAccounting()));
}
