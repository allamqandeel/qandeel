// S8A-04 CP2: recall and placement run on DeepSeek Flash only, through the shared DeepSeek client and its SYNTHETIC_ONLY
// qualification gate, like the CP1 reading. The provider and the model are fixed in code; zero retries.
import { assertDeepSeekFlashSelection, DEEPSEEK_FLASH_MODEL, requireDeepSeekQualification } from '../model-router/providers/deepseek/deepseek-client';

/** Recall's own bound (§3.2): never longer than the slack the turn has, which is at most 2.5 s. */
export const SHARED_KNOWLEDGE_RECALL_TIMEOUT_MS = 2_500;
export const SHARED_KNOWLEDGE_RECALL_MAX_OUTPUT_TOKENS = 120;
export const DEFAULT_SHARED_SPATIAL_PLACEMENT_TIMEOUT_MS = 15_000;
export const SHARED_SPATIAL_PLACEMENT_MAX_OUTPUT_TOKENS = 512;

export interface SharedSocialMemoryDeepSeekConfig {
  provider: 'DEEPSEEK';
  apiKey: string;
  model: typeof DEEPSEEK_FLASH_MODEL;
  timeoutMs: number;
  maxOutputTokens: number;
  maxRetries: 0;
}

export function loadSharedKnowledgeRecallDeepSeekConfig(environment: NodeJS.ProcessEnv = process.env): SharedSocialMemoryDeepSeekConfig {
  assertDeepSeekFlashSelection(environment, 'SHARED_KNOWLEDGE_RECALL');
  const apiKey = requireDeepSeekQualification(environment, 'the Shared knowledge recall');
  return {
    provider: 'DEEPSEEK', apiKey, model: DEEPSEEK_FLASH_MODEL, timeoutMs: SHARED_KNOWLEDGE_RECALL_TIMEOUT_MS,
    maxOutputTokens: SHARED_KNOWLEDGE_RECALL_MAX_OUTPUT_TOKENS, maxRetries: 0,
  };
}

export function loadSharedSpatialPlacementDeepSeekConfig(environment: NodeJS.ProcessEnv = process.env): SharedSocialMemoryDeepSeekConfig {
  assertDeepSeekFlashSelection(environment, 'SHARED_SPATIAL_PLACEMENT');
  const timeoutMs = readTimeout(environment.SHARED_SPATIAL_PLACEMENT_TIMEOUT_MS);
  const apiKey = requireDeepSeekQualification(environment, 'the Shared spatial placement');
  return {
    provider: 'DEEPSEEK', apiKey, model: DEEPSEEK_FLASH_MODEL, timeoutMs,
    maxOutputTokens: SHARED_SPATIAL_PLACEMENT_MAX_OUTPUT_TOKENS, maxRetries: 0,
  };
}

/**
 * S8A-04 CP3 (amendment §4; R4 / §11): the Shared disclosure check, ONE call per reply that used personal knowledge,
 * after generation and before delivery. Its own bound; zero retries; a timeout withholds the reply (nothing cooled). R4:
 * 600 output tokens (was 400 for one owner's items) — the answer now carries a verdict per span and exact passages.
 */
export const SHARED_DISCLOSURE_JUDGE_TIMEOUT_MS = 6_000;
export const SHARED_DISCLOSURE_JUDGE_MAX_OUTPUT_TOKENS = 600;

export function loadSharedDisclosureJudgeDeepSeekConfig(environment: NodeJS.ProcessEnv = process.env): SharedSocialMemoryDeepSeekConfig {
  assertDeepSeekFlashSelection(environment, 'SHARED_DISCLOSURE_JUDGE');
  const apiKey = requireDeepSeekQualification(environment, 'the Shared disclosure judge');
  return {
    provider: 'DEEPSEEK', apiKey, model: DEEPSEEK_FLASH_MODEL, timeoutMs: SHARED_DISCLOSURE_JUDGE_TIMEOUT_MS,
    maxOutputTokens: SHARED_DISCLOSURE_JUDGE_MAX_OUTPUT_TOKENS, maxRetries: 0,
  };
}

/** Within the place pass's own 30 s bound (`shared-semantic-place.service.ts`). */
function readTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_SHARED_SPATIAL_PLACEMENT_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000 || parsed > 30_000) {
    throw new Error('SHARED_SPATIAL_PLACEMENT_TIMEOUT_MS must be between 1000 and 30000.');
  }
  return parsed;
}
