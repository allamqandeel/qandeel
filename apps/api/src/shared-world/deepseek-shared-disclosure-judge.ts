// S8A-04 CP3 — the Shared disclosure judge on DeepSeek Flash (amendment §4; CG-6b PROPOSED): JSON Output, thinking off,
// the shared DeepSeek client and its SYNTHETIC_ONLY gate, ONE call per owner, zero retries, under the AI-COST-01 family
// SHARED_DISCLOSURE_JUDGE (migration 0176), paid by the verified sender of the answered message (the lane makes the call
// inside that scope). A check that can only block: the server builds the v2 assessment from an answer that names exactly
// the request's items and nothing else, and anything else is an error, which the lane treats as UNRESOLVED (withheld).
import { createHash } from 'node:crypto';
import type { SharedDisclosureJudge, SharedDisclosureJudgeAssessment, SharedDisclosureJudgeRequest } from '../connected-worlds/member-knowledge/shared-member-knowledge.types';
import {
  deepSeekJsonContent, deepSeekJsonRequest, escapeDeepSeekData, isDeepSeekTimeout, isDeepSeekUnavailable, type DeepSeekJsonClient,
} from '../model-router/providers/deepseek/deepseek-client';
import type { SharedSocialMemoryDeepSeekConfig } from './shared-social-memory-provider.config';
import { SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS } from './shared-member-knowledge-texts';

export type SharedDisclosureJudgeFailure = 'INVALID_REQUEST' | 'INVALID_STRUCTURED_OUTPUT' | 'TIMEOUT' | 'UNAVAILABLE' | 'PROVIDER_ERROR';

export class SharedDisclosureJudgeProviderError extends Error {
  constructor(readonly reason: SharedDisclosureJudgeFailure) {
    super(`The Shared disclosure judge failed: ${reason}.`);
    this.name = 'SharedDisclosureJudgeProviderError';
  }
}

/** The policy this judge answers under: the instructions and the schema version. */
export const SHARED_DISCLOSURE_JUDGE_POLICY_REF = `QANDEEL_S8A04_SHARED_DISCLOSURE_JUDGE_V1:sha256:${createHash('sha256').update(SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS, 'utf8').digest('hex')}`;
export const SHARED_DISCLOSURE_JUDGE_MAX_ITEMS = 8;

const FINDINGS = ['DIRECT_PROTECTED_SOURCE_FACT', 'SOURCE_SPECIFIC_ATTRIBUTION', 'PRIVATE_QUOTE', 'SEALED_PROVENANCE_DISCLOSURE'] as const;
const ATTRIBUTIONS = ['OWNER', 'OTHER', 'NONE', 'UNCLEAR'] as const;
const ANSWER_KEYS = ['ref', 'findings', 'attributedTo', 'unsupportedOwnerClaim'] as const;

const refOf = (index: number) => `I${index + 1}`;

/** What the model receives: the reply, the request-local labels and the owner's items under request-local refs. */
export const sharedDisclosureJudgeData = (request: SharedDisclosureJudgeRequest) => ({
  reply: request.reply,
  owner: request.owner,
  members: request.members,
  items: request.items.map((entry, index) => ({ ref: refOf(index), item: entry.item })),
});

/** The schema, filled from this request only: exactly one answer per item. */
export function sharedDisclosureJudgeSchema(request: SharedDisclosureJudgeRequest): object {
  return {
    type: 'object', additionalProperties: false, required: ['items'],
    properties: {
      items: {
        type: 'array', minItems: request.items.length, maxItems: request.items.length,
        items: {
          type: 'object', additionalProperties: false, required: [...ANSWER_KEYS],
          properties: {
            ref: { type: 'string', enum: request.items.map((_, index) => refOf(index)) },
            findings: { type: 'array', uniqueItems: true, items: { type: 'string', enum: [...FINDINGS] } },
            attributedTo: { type: 'string', enum: [...ATTRIBUTIONS] },
            unsupportedOwnerClaim: { type: 'boolean' },
          },
        },
      },
    },
  };
}

function validRequest(request: SharedDisclosureJudgeRequest): boolean {
  if (!request || typeof request.reply !== 'string' || request.reply.trim().length === 0) return false;
  if (typeof request.owner !== 'string' || request.owner.trim().length === 0 || !Array.isArray(request.members)) return false;
  if (!Array.isArray(request.items) || request.items.length === 0 || request.items.length > SHARED_DISCLOSURE_JUDGE_MAX_ITEMS) return false;
  return request.items.every((entry) => typeof entry.item === 'string' && entry.item.length > 0 && typeof entry.contentDigest === 'string');
}

/** The server's v2 assessment from the model's answer: exactly one answer per ref, no other key; otherwise null. */
export function sharedDisclosureAssessmentFromAnswer(answer: unknown, request: SharedDisclosureJudgeRequest, content: string): SharedDisclosureJudgeAssessment | null {
  if (typeof answer !== 'object' || answer === null || Array.isArray(answer) || Object.keys(answer).join() !== 'items') return null;
  const items = (answer as { items: unknown }).items;
  if (!Array.isArray(items) || items.length !== request.items.length) return null;
  const seen = new Set<string>();
  const sources: Array<SharedDisclosureJudgeAssessment['sources'][number]> = [];
  for (const entry of items as ReadonlyArray<unknown>) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null;
    const record = entry as Record<string, unknown>;
    if (Object.keys(record).length !== ANSWER_KEYS.length || !ANSWER_KEYS.every((key) => key in record)) return null;
    const index = typeof record.ref === 'string' && /^I[1-9][0-9]*$/u.test(record.ref) ? Number(record.ref.slice(1)) - 1 : -1;
    if (index < 0 || index >= request.items.length || seen.has(record.ref as string)) return null;
    seen.add(record.ref as string);
    if (!Array.isArray(record.findings) || new Set(record.findings).size !== record.findings.length
      || !record.findings.every((finding) => (FINDINGS as ReadonlyArray<unknown>).includes(finding))) return null;
    if (!(ATTRIBUTIONS as ReadonlyArray<unknown>).includes(record.attributedTo) || typeof record.unsupportedOwnerClaim !== 'boolean') return null;
    sources.push(Object.freeze({
      contentDigest: request.items[index].contentDigest,
      findings: Object.freeze([...(record.findings as Array<(typeof FINDINGS)[number]>)]),
      attributedTo: record.attributedTo as (typeof ATTRIBUTIONS)[number],
      unsupportedOwnerClaim: record.unsupportedOwnerClaim,
    }));
  }
  return Object.freeze({
    state: 'ASSESSED',
    assessmentRef: `sha256:${createHash('sha256').update([SHARED_DISCLOSURE_JUDGE_POLICY_REF, request.binding.effectiveContextRef, request.binding.outputDigest,
      request.binding.protectedSourceSetRef, content].join('\n'), 'utf8').digest('hex')}`,
    detectorPolicyRef: SHARED_DISCLOSURE_JUDGE_POLICY_REF,
    binding: Object.freeze({ ...request.binding }),
    sources: Object.freeze(sources),
  } as const);
}

/** AI-COST-01: composed only with an accounted client; one call per owner, its own bound, zero retries. */
export class DeepSeekSharedDisclosureJudge implements SharedDisclosureJudge {
  constructor(
    private readonly config: SharedSocialMemoryDeepSeekConfig,
    private readonly client: DeepSeekJsonClient,
  ) {}

  async judge(request: SharedDisclosureJudgeRequest): Promise<unknown> {
    if (!validRequest(request)) throw new SharedDisclosureJudgeProviderError('INVALID_REQUEST');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.client.chat.completions.create(deepSeekJsonRequest({
        instructions: SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS,
        schema: sharedDisclosureJudgeSchema(request),
        data: `<judge_data>${escapeDeepSeekData(sharedDisclosureJudgeData(request))}</judge_data>`,
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
      const assessment = sharedDisclosureAssessmentFromAnswer(answer, request, content);
      if (assessment === null) throw new SharedDisclosureJudgeProviderError('INVALID_STRUCTURED_OUTPUT');
      return assessment;
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
