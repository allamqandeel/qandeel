// S8A-04 CP3 — the Shared disclosure check on DeepSeek Flash (amendment §4 as R4 / §11 binds over it; CG-6b′ PROPOSED):
// JSON Output, thinking off, the shared DeepSeek client and its SYNTHETIC_ONLY gate, ONE call per reply, zero retries,
// under the AI-COST-01 family SHARED_DISCLOSURE_JUDGE (migration 0176), paid by the verified sender of the answered message
// (the lane makes the call inside that scope). It sees the reply as its claim spans left it (`⟦K1: …⟧`) and the items under
// checker ids: no Name, no request ref, no identity. A check that can only block: it decides no ownership and grants no
// disclosure. An answer that is not exactly the schema is an error, which the lane treats as UNRESOLVED (withheld, nothing
// cooled); the lane validates the answer again against its own view.
import { createHash } from 'node:crypto';
import { SHARED_CLAIM_SPAN_VERDICTS } from '../connected-worlds/member-knowledge/shared-claim-spans';
import type {
  SharedDisclosureCheckRequest, SharedDisclosureCheckResult, SharedDisclosureJudge,
} from '../connected-worlds/member-knowledge/shared-member-knowledge.types';
import {
  deepSeekJsonContent, deepSeekJsonRequest, escapeDeepSeekData, isDeepSeekTimeout, isDeepSeekUnavailable, type DeepSeekJsonClient,
} from '../model-router/providers/deepseek/deepseek-client';
import type { SharedSocialMemoryDeepSeekConfig } from './shared-social-memory-provider.config';
import { SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS } from './shared-member-knowledge-texts';

export type SharedDisclosureJudgeFailure = 'INVALID_REQUEST' | 'INVALID_STRUCTURED_OUTPUT' | 'TIMEOUT' | 'UNAVAILABLE' | 'PROVIDER_ERROR';

export class SharedDisclosureJudgeProviderError extends Error {
  constructor(readonly reason: SharedDisclosureJudgeFailure) {
    super(`The Shared disclosure check failed: ${reason}.`);
    this.name = 'SharedDisclosureJudgeProviderError';
  }
}

/** The policy this check answers under: the CG-6b′ instructions and the V2 schema. */
export const SHARED_DISCLOSURE_JUDGE_POLICY_REF = `QANDEEL_S8A04_SHARED_DISCLOSURE_CHECK_V2:sha256:${createHash('sha256').update(SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS, 'utf8').digest('hex')}`;
export const SHARED_DISCLOSURE_JUDGE_MAX_ITEMS = 8;

const CHECKER_ID = /^K[1-9][0-9]*$/u;
const BINDING_KEYS = ['effectiveContextRef', 'audienceSnapshotRef', 'disclosureAuthorizationRef', 'outputDigest'] as const;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: ReadonlyArray<string>) => Object.keys(value).length === keys.length && keys.every((key) => key in value);

/** What the model receives: the reply (spans under checker ids) and the items under the same ids. Nothing else. */
export const sharedDisclosureJudgeData = (request: SharedDisclosureCheckRequest) => ({
  reply: request.reply,
  items: request.items.map((entry) => ({ id: entry.id, item: entry.item })),
});

/** The schema, filled from this request only: exactly one verdict per span; passages under this request's item ids. */
export function sharedDisclosureJudgeSchema(request: SharedDisclosureCheckRequest): object {
  const ids = request.items.map((entry) => entry.id);
  const passage = {
    type: 'array',
    items: { type: 'object', additionalProperties: false, required: ['id', 'passage'], properties: { id: { type: 'string', enum: ids }, passage: { type: 'string' } } },
  };
  const spans = request.spans.length === 0
    ? { type: 'array', maxItems: 0 }
    : {
      type: 'array', minItems: request.spans.length, maxItems: request.spans.length,
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'verdict'],
        properties: { id: { type: 'string', enum: [...request.spans] }, verdict: { type: 'string', enum: [...SHARED_CLAIM_SPAN_VERDICTS] } },
      },
    };
  return { type: 'object', additionalProperties: false, required: ['spans', 'outside', 'sealed'], properties: { spans, outside: passage, sealed: passage } };
}

function validRequest(request: SharedDisclosureCheckRequest): boolean {
  if (!isRecord(request) || typeof request.reply !== 'string' || request.reply.trim().length === 0) return false;
  if (!isRecord(request.binding) || !exactKeys(request.binding, BINDING_KEYS)) return false;
  if (!BINDING_KEYS.every((key) => typeof request.binding[key] === 'string' && request.binding[key].trim().length > 0)) return false;
  if (!Array.isArray(request.items) || request.items.length === 0 || request.items.length > SHARED_DISCLOSURE_JUDGE_MAX_ITEMS) return false;
  if (!request.items.every((entry, index) => isRecord(entry) && entry.id === `K${index + 1}` && typeof entry.item === 'string' && entry.item.length > 0)) return false;
  const ids = request.items.map((entry) => entry.id);
  return Array.isArray(request.spans) && new Set(request.spans).size === request.spans.length
    && request.spans.every((id) => typeof id === 'string' && CHECKER_ID.test(id) && ids.includes(id));
}

/** The model's answer, exactly the schema of this request; otherwise null. The lane decides what it means. */
export function sharedDisclosureAnswer(answer: unknown, request: SharedDisclosureCheckRequest): unknown | null {
  if (!isRecord(answer) || !exactKeys(answer, ['spans', 'outside', 'sealed'])) return null;
  const { spans, outside, sealed } = answer;
  if (!Array.isArray(spans) || !Array.isArray(outside) || !Array.isArray(sealed) || spans.length !== request.spans.length) return null;
  const seen = new Set<string>();
  for (const entry of spans as ReadonlyArray<unknown>) {
    if (!isRecord(entry) || !exactKeys(entry, ['id', 'verdict']) || typeof entry.id !== 'string' || !request.spans.includes(entry.id) || seen.has(entry.id)) return null;
    if (!(SHARED_CLAIM_SPAN_VERDICTS as ReadonlyArray<unknown>).includes(entry.verdict)) return null;
    seen.add(entry.id);
  }
  const ids = request.items.map((entry) => entry.id);
  for (const entry of [...outside, ...sealed] as ReadonlyArray<unknown>) {
    if (!isRecord(entry) || !exactKeys(entry, ['id', 'passage']) || typeof entry.id !== 'string' || !ids.includes(entry.id) || typeof entry.passage !== 'string') return null;
  }
  return answer;
}

/** The adapter's result: the answer, bound to exactly what was asked, with a reference over the policy and the answer. */
export function sharedDisclosureCheckResult(answer: unknown, request: SharedDisclosureCheckRequest, content: string): SharedDisclosureCheckResult | null {
  const valid = sharedDisclosureAnswer(answer, request);
  if (valid === null) return null;
  return Object.freeze({
    state: 'CHECKED',
    checkRef: `sha256:${createHash('sha256').update([SHARED_DISCLOSURE_JUDGE_POLICY_REF, ...BINDING_KEYS.map((key) => request.binding[key]), content].join('\n'), 'utf8').digest('hex')}`,
    policyRef: SHARED_DISCLOSURE_JUDGE_POLICY_REF,
    binding: Object.freeze({ ...request.binding }),
    answer: valid,
  } as const);
}

/** AI-COST-01: composed only with an accounted client; one call per reply, its own bound, zero retries. */
export class DeepSeekSharedDisclosureJudge implements SharedDisclosureJudge {
  constructor(
    private readonly config: SharedSocialMemoryDeepSeekConfig,
    private readonly client: DeepSeekJsonClient,
  ) {}

  async judge(request: SharedDisclosureCheckRequest): Promise<unknown> {
    if (!validRequest(request)) throw new SharedDisclosureJudgeProviderError('INVALID_REQUEST');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.client.chat.completions.create(deepSeekJsonRequest({
        instructions: SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS,
        schema: sharedDisclosureJudgeSchema(request),
        data: `<check_data>${escapeDeepSeekData(sharedDisclosureJudgeData(request))}</check_data>`,
        maxTokens: this.config.maxOutputTokens,
      }), { timeout: this.config.timeoutMs, maxRetries: 0, signal: controller.signal });
      const content = deepSeekJsonContent(response);
      if (content === undefined) throw new SharedDisclosureJudgeProviderError('INVALID_STRUCTURED_OUTPUT');
      let answer: unknown;
      try {
        answer = JSON.parse(content);
      } catch {
        throw new SharedDisclosureJudgeProviderError('INVALID_STRUCTURED_OUTPUT');
      }
      const result = sharedDisclosureCheckResult(answer, request, content);
      if (result === null) throw new SharedDisclosureJudgeProviderError('INVALID_STRUCTURED_OUTPUT');
      return result;
    } catch (error) {
      if (error instanceof SharedDisclosureJudgeProviderError) throw error;
      if (controller.signal.aborted || isDeepSeekTimeout(error)) throw new SharedDisclosureJudgeProviderError('TIMEOUT');
      if (isDeepSeekUnavailable(error)) throw new SharedDisclosureJudgeProviderError('UNAVAILABLE');
      throw new SharedDisclosureJudgeProviderError('PROVIDER_ERROR');
    } finally {
      clearTimeout(timer);
    }
  }
}
