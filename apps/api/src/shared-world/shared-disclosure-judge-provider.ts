// S8A-04 CP3 — the composition of the Shared disclosure check (amendment §4; one check per reply under R4 / §11).
//
//   NODE_ENV=test → the deterministic test checker; otherwise DeepSeek Flash through the shared client, behind the
//   SYNTHETIC_ONLY gate and the ONE AI-COST-01 boundary (family SHARED_DISCLOSURE_JUDGE, migration 0176). The gate is read
//   when the judge is composed: where DeepSeek may not run (a production process, an undeclared mode, no key) there is NO
//   judge, and with no judge the reply collects no personal knowledge at all — an item that could not be checked is never
//   used, and the reply is exactly what it was before CP3.
import { accountedDeepSeekChatCompletionsClient } from '../ai-usage/accounted-provider-clients';
import { productionAiProviderCallAccounting } from '../ai-usage/production-ai-provider-call-accounting';
import type { SharedDisclosureCheckRequest, SharedDisclosureJudge } from '../connected-worlds/member-knowledge/shared-member-knowledge.types';
import { createDeepSeekClient } from '../model-router/providers/deepseek/deepseek-client';
import { DeepSeekSharedDisclosureJudge, sharedDisclosureCheckResult } from './deepseek-shared-disclosure-judge';
import { loadSharedDisclosureJudgeDeepSeekConfig, type SharedSocialMemoryDeepSeekConfig } from './shared-social-memory-provider.config';

/**
 * The deterministic test checker (NODE_ENV=test only; R4): a span is ENTAILED when its predicate contains its item's exact
 * words, otherwise ADDS; an item's exact words OUTSIDE every span are reported as an outside passage; nothing is sealed.
 * Never a provider, and never evidence of meaning: it only drives the server's decision in free tests.
 */
export class FakeSharedDisclosureJudge implements SharedDisclosureJudge {
  async judge(request: SharedDisclosureCheckRequest): Promise<unknown> {
    const itemOf = new Map(request.items.map((entry) => [entry.id, entry.item]));
    const spans = [...request.reply.matchAll(/⟦(K[1-9][0-9]*)@?: ([^⟦⟧]*)⟧/gu)];
    const outsideText = request.reply.replace(/⟦K[1-9][0-9]*@?: [^⟦⟧]*⟧/gu, '\u0000');
    const answer = {
      spans: spans.map((match) => ({ id: match[1], verdict: match[2].includes(itemOf.get(match[1]) ?? '\u0000') ? 'ENTAILED' : 'ADDS' })),
      outside: request.items.filter((entry) => outsideText.includes(entry.item)).map((entry) => ({ id: entry.id, passage: entry.item })),
      sealed: [],
    };
    return sharedDisclosureCheckResult(answer, request, JSON.stringify(answer));
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
