import { Inject, Injectable } from '@nestjs/common';
import { runWithAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import { MODEL_ROUTER, type ModelRouter } from '../model-router/model-router.types';
import { PublicDiscussionRepository, type PublicQandeelContextRow } from './public-discussion.repository';
import {
  assemblePublicQandeelRequest, boundPublicQandeelResponse, type PublicQandeelContentItem, type PublicQandeelContext, type PublicQandeelPost,
  type PublicQandeelSpeaker,
} from './public-qandeel-model-input';

/** What the discussion says about the one Public QANDEEL response of an invoking post. */
export type PublicQandeelReplyState = 'RESPONDED' | 'PENDING' | 'UNAVAILABLE';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const SPEAKERS: readonly string[] = ['OP', 'ASKER', 'PARTICIPANT'];

/**
 * S5-04 — the words of ONE Public QANDEEL response, over the provider-neutral Model Router.
 *
 *   1. the canonical Safety Response Gate on the invoking post (and the earlier public posts): BLOCK answers with its own
 *      deterministic words and calls no provider; GUIDED carries its guidance into the request;
 *   2. the one PUBLIC model-input assembler (never the Shared one);
 *   3. the Model Router, inside the AI-COST-01 attribution scope of the human whose request started it — so the call is
 *      accounted, never untracked spend. The human's identity is accounting authority only; it is not in the request.
 *
 * No provider is named or selected here: the Public World module provides this port (S8A-05 CP4, `public-reply-model-router.ts`),
 * and the deterministic test seam is the Model Router's own (NODE_ENV=test). Where the provider refuses, this answers null:
 * no QANDEEL words are invented.
 */
@Injectable()
export class PublicQandeelGenerator {
  constructor(
    @Inject(MODEL_ROUTER) private readonly router: ModelRouter,
    private readonly safety: SafetyResponseGateService,
  ) {}

  async generate(context: PublicQandeelContext, requesterUserId: string): Promise<string | null> {
    const invoking = context.posts.find((post) => post.invoking);
    if (invoking === undefined) return null;
    const earlier = context.posts.filter((post) => !post.invoking).map((post) => ({ role: 'USER' as const, content: post.text }));
    const gate = this.safety.evaluate(invoking.text, [...earlier, { role: 'USER', content: invoking.text }]);
    if (gate.disposition === 'BLOCK') return boundPublicQandeelResponse(gate.deterministicResponse);
    const request = assemblePublicQandeelRequest(context, gate.disposition === 'GUIDED' ? gate.safetyGuidance : undefined);
    if (request === null) return null;
    try {
      const result = await runWithAiUsageAttribution({ userId: requesterUserId }, () => this.router.generate(request));
      return boundPublicQandeelResponse(result.content);
    } catch {
      return null;
    }
  }
}

/**
 * The server context rows → the assembler's input; null for anything malformed or not served (no partial context).
 * S8A-05 CP4: 0182's branch-scoped rows carry each post's speaker role and the post it answers, the earlier answers'
 * targets and the topic as one text; rows without speakers are the older 0147 shape.
 */
export function publicQandeelContextOf(rows: readonly PublicQandeelContextRow[]): PublicQandeelContext | null {
  if (!Array.isArray(rows)) return null;
  const version = rows.find((row) => row.context_kind === 'VERSION')?.context_ref;
  const meaning = rows.find((row) => row.context_kind === 'MEANING')?.context_text;
  if (typeof version !== 'string' || !UUID.test(version) || !isText(meaning)) return null;
  const themes = (role: string) => rows.filter((row) => row.context_kind === 'THEME' && row.context_role === role && isText(row.context_text))
    .map((row) => row.context_text as string);
  const content: PublicQandeelContentItem[] = rows.filter((row) => row.context_kind === 'CONTENT' && isText(row.context_text)
    && (row.context_role === 'SOURCE_CONTENT' || row.context_role === 'ANALYSIS'))
    .map((row) => ({ ordinal: Number(row.context_ordinal), kind: row.context_role as PublicQandeelContentItem['kind'], text: row.context_text as string }));
  const posts: PublicQandeelPost[] = rows.filter((row) => row.context_kind === 'POST' && isText(row.context_text)
    && typeof row.context_ref === 'string' && UUID.test(row.context_ref))
    .map((row) => ({ id: row.context_ref as string, ordinal: Number(row.context_ordinal), invoking: row.context_role === 'INVOKING', text: row.context_text as string }));
  if (posts.filter((post) => post.invoking).length !== 1) return null;
  const postRows = rows.filter((row) => row.context_kind === 'POST');
  if (postRows.some((row) => row.speaker !== null && row.speaker !== undefined)) {
    // 0182 (A-5(c)): every post names its speaker role and the post it answers (or none); every answer, the post it answered.
    const branch: PublicQandeelPost[] = [];
    for (const post of posts) {
      const row = postRows.find((candidate) => candidate.context_ref === post.id);
      if (row === undefined || typeof row.speaker !== 'string' || !SPEAKERS.includes(row.speaker)
        || (row.answers_ref !== null && row.answers_ref !== undefined && (typeof row.answers_ref !== 'string' || !UUID.test(row.answers_ref)))) return null;
      branch.push({ ...post, speaker: row.speaker as PublicQandeelSpeaker, replyTo: row.answers_ref ?? null });
    }
    const answers = rows.filter((row) => row.context_kind === 'QANDEEL');
    if (answers.some((row) => !isText(row.context_text) || typeof row.answers_ref !== 'string' || !branch.some((post) => post.id === row.answers_ref))) return null;
    const topic = rows.find((row) => row.context_kind === 'TOPIC')?.context_text;
    return {
      versionId: version, meaning, primaryThemes: themes('PRIMARY'), secondaryThemes: themes('SECONDARY'), content: [], posts: branch,
      earlierResponses: [], related: [], topic: isText(topic) ? topic : '',
      earlierAnswers: answers.map((row) => ({ answers: row.answers_ref as string, text: row.context_text as string })),
    };
  }
  return {
    versionId: version, meaning, primaryThemes: themes('PRIMARY'), secondaryThemes: themes('SECONDARY'), content, posts,
    earlierResponses: rows.filter((row) => row.context_kind === 'QANDEEL' && isText(row.context_text)).map((row) => row.context_text as string),
    related: rows.filter((row) => row.context_kind === 'RELATED' && isText(row.context_text)).map((row) => row.context_text as string),
  };
}

/**
 * S5-04 — ONE Public QANDEEL response for ONE committed invoking post, under 0147's durable work lease:
 *
 *   begin (GRANTED / ALREADY_COMMITTED / IN_PROGRESS / LIMITED / UNAVAILABLE)
 *   → the strictly PUBLIC context, read NOW under the lease
 *   → the generator (Safety Gate → Public assembler → Model Router, attributed)
 *   → complete, which re-validates the served version, the invoking post, the human's admission and entitlement and every
 *     consumed post before the frozen 0096 writer records it; anything moved makes the result STALE and it is discarded
 *   → the lease always ends; an unanswered attempt is recorded so the discussion says so truthfully.
 *
 * The human's post is already committed: nothing here can remove it. One invocation never spends twice on concurrent
 * requests (the lease), and never records a second response (0147 links one). It never throws; nothing is logged.
 */
@Injectable()
export class PublicQandeelReplyService {
  constructor(private readonly repository: PublicDiscussionRepository, private readonly generator: PublicQandeelGenerator) {}

  async respond(postId: string, requesterUserId: string): Promise<PublicQandeelReplyState> {
    if (!UUID.test(postId) || !UUID.test(requesterUserId)) return 'UNAVAILABLE';
    let lease: string | null = null;
    try {
      const [work] = await this.repository.begin(postId, requesterUserId);
      if (work?.work_outcome === 'ALREADY_COMMITTED') return 'RESPONDED';
      if (work?.work_outcome === 'IN_PROGRESS') return 'PENDING';
      if (work?.work_outcome !== 'GRANTED' || typeof work.work_lease_id !== 'string' || !UUID.test(work.work_lease_id)) return 'UNAVAILABLE';
      lease = work.work_lease_id;
      const context = publicQandeelContextOf(await this.repository.context(postId, lease));
      if (context === null) return 'UNAVAILABLE';
      const text = await this.generator.generate(context, requesterUserId);
      if (text === null) return 'UNAVAILABLE';
      const [done] = await this.repository.complete(postId, lease, context.versionId, text, context.posts.map((post) => post.id));
      lease = null; // complete always ends the lease
      return done?.outcome === 'RESPONSE_RECORDED' || done?.outcome === 'ALREADY_COMMITTED' ? 'RESPONDED' : 'UNAVAILABLE';
    } catch {
      return 'UNAVAILABLE';
    } finally {
      if (lease !== null) await this.repository.end(postId, lease, true).catch(() => undefined);
    }
  }
}
