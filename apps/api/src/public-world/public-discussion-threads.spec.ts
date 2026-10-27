import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ServiceUnavailableException } from '@nestjs/common';
import { currentAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import type { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { HISTORY_BUDGET_BYTES } from '../intelligence-runtime/integrated-context-budget-contract';
import { FakeModelRouter } from '../model-router/fake-model-router';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import type { PublicActivityProducer } from './public-activity.producer';
import { PublicDiscussionRepository, type PublicQandeelContextRow } from './public-discussion.repository';
import { PublicDiscussionService } from './public-discussion.service';
import {
  PUBLIC_QANDEEL_FRAME, THREAD_HEADER, TOPIC_HEADER, assemblePublicQandeelRequest, type PublicQandeelContext,
} from './public-qandeel-model-input';
import { PublicQandeelGenerator, PublicQandeelReplyService, publicQandeelContextOf } from './public-qandeel-reply.service';
import { createPublicQandeelModelRouter } from './public-reply-model-router';

// S8A-05 CP4 (migration 0182, Controlled Amendment A-5): exact reply targets, the OP flag, the branch-scoped @qandeel context,
// the Public reply's own cost family and the Public DEEP budget. Synthetic data only; no provider is called.
const TOKEN = 'reader-token';
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const USER = id(1);
const EXPERIENCE = id(2);
const VERSION = id(3);
const LEASE = id(4);
const ROOT = id(10);
const R1 = id(11);
const R2 = id(12);
const SIDE = id(13);
const ASK = id(14);
const AT = '2026-10-27T10:00:00.000Z';

const readRow = (overrides: Record<string, unknown> = {}) => ({
  post_id: R2, thread_root_id: ROOT, post_ordinal: 3, author_label_mode: 'PSEUDONYM', author_display_label: 'oliveisland38', post_body: 'A reply',
  posted_at: AT, is_own: false, qandeel_state: 'NONE', qandeel_response_body: null, qandeel_responded_at: null, reply_to_post_id: R1, is_op: true, ...overrides,
});
const post = (ref: string, ordinal: number, speaker: string, answers: string | null, text: string, role = 'THREAD'): PublicQandeelContextRow =>
  ({ context_kind: 'POST', context_role: role, context_ordinal: ordinal, context_ref: ref, context_text: text, speaker, answers_ref: answers });
const BRANCH: PublicQandeelContextRow[] = [
  { context_kind: 'VERSION', context_role: null, context_ordinal: 0, context_ref: VERSION, context_text: null, speaker: null, answers_ref: null },
  { context_kind: 'TOPIC', context_role: null, context_ordinal: 0, context_ref: null, context_text: 'TITLE: Tired of work\nAUTHOR_TEXT: I wrote this about work\nAUTHOR: I am tired of the job', speaker: null, answers_ref: null },
  { context_kind: 'MEANING', context_role: null, context_ordinal: 0, context_ref: null, context_text: 'Tired of the pressure at work', speaker: null, answers_ref: null },
  { context_kind: 'THEME', context_role: 'PRIMARY', context_ordinal: 1, context_ref: null, context_text: 'work', speaker: null, answers_ref: null },
  post(ROOT, 1, 'PARTICIPANT', null, 'Is it the hours or the people?'),
  post(R1, 2, 'OP', ROOT, 'It is mostly my manager.'),
  post(SIDE, 3, 'PARTICIPANT', ROOT, 'Same here.'),
  post(R2, 4, 'OP', R1, 'To be clear: I am not leaving the job, I am asking how to talk to him.'),
  post(ASK, 5, 'ASKER', R2, '@qandeel what do you make of this?', 'INVOKING'),
  { context_kind: 'QANDEEL', context_role: null, context_ordinal: 1, context_ref: id(20), context_text: 'It sounds like you want to leave the job.', speaker: 'QANDEEL', answers_ref: R1 },
];

function repository(overrides: Record<string, jest.Mock> = {}) {
  return {
    post: jest.fn(async () => [{ outcome: 'REPLIED', post_id: ASK, thread_root_id: ROOT, post_ordinal: 5, qandeel_invoked: true }]),
    posts: jest.fn(async () => [readRow()]),
    capability: jest.fn(async () => [{ can_contribute: true }]),
    begin: jest.fn(async () => [{ work_outcome: 'GRANTED', work_lease_id: LEASE }]),
    context: jest.fn(async () => BRANCH),
    complete: jest.fn(async () => [{ outcome: 'RESPONSE_RECORDED', response_id: id(30) }]),
    end: jest.fn(async () => true),
    ...overrides,
  };
}
const routerAnswering = (content: string, seen: { request: ModelRouterRequest; userId: string | undefined }[] = []): ModelRouter => ({
  async generate(request) {
    seen.push({ request, userId: currentAiUsageAttribution()?.userId });
    return { content, routingMetadata: { path: request.path }, usage: { inputTokens: 0, outputTokens: 0 } };
  },
});
const replies = (repo = repository(), router: ModelRouter = routerAnswering('A public reading.')) =>
  new PublicQandeelReplyService(repo as unknown as PublicDiscussionRepository, new PublicQandeelGenerator(router, new SafetyResponseGateService()));
const discussion = (repo = repository()) => new PublicDiscussionService(repo as unknown as PublicDiscussionRepository,
  { respond: jest.fn(async () => 'RESPONDED') } as unknown as PublicQandeelReplyService,
  { discussionPost: jest.fn(async () => undefined) } as unknown as PublicActivityProducer);
const userMessage = (request: ModelRouterRequest) => request.context[0].content;

describe('S8A-05 CP4 — exact reply targets and the topic\'s author (A-5(a) / (b))', () => {
  it('the read carries each reply\'s exact target and a boolean OP flag, and no identifier', async () => {
    const view = await discussion().read(TOKEN, EXPERIENCE, {});
    expect(view).toMatchObject({ state: 'SERVED', posts: [{ id: R2, threadRootId: ROOT, replyToPostId: R1, isOp: true }] });
    const top = await discussion(repository({ posts: jest.fn(async () => [readRow({ post_id: ROOT, reply_to_post_id: null, is_op: false })]) })).read(TOKEN, EXPERIENCE, {});
    expect(top).toMatchObject({ posts: [{ id: ROOT, replyToPostId: null, isOp: false }] });
    expect(JSON.stringify(view)).not.toMatch(/user|identity|account|email|login|controller/iu);
  });

  it('a read row without the 0182 fields, or with a malformed one, is no answer', async () => {
    for (const bad of [{ is_op: undefined }, { is_op: 'yes' }, { reply_to_post_id: 'guess' }, { reply_to_post_id: undefined }]) {
      await expect(discussion(repository({ posts: jest.fn(async () => [readRow(bad)]) })).read(TOKEN, EXPERIENCE, {}))
        .rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });

  it('the transport calls 0182\'s v2 post, read and context; the lease and the completion stay 0147\'s', async () => {
    const request = jest.fn(async () => []);
    const rpc = jest.fn(async () => []);
    const repo = new PublicDiscussionRepository({ request } as unknown as SupabaseDataApiService, { rpc } as unknown as SupabaseServiceRoleApiService);
    await repo.post(TOKEN, id(40), EXPERIENCE, R1, 'x');
    await repo.posts(TOKEN, EXPERIENCE, null);
    await repo.begin(ASK, USER);
    await repo.context(ASK, LEASE);
    await repo.complete(ASK, LEASE, VERSION, 'x', [ASK]);
    expect((request.mock.calls as unknown as [string, string][]).map((call) => call[1]))
      .toEqual(['rpc/post_own_public_discussion_v2', 'rpc/read_public_discussion_posts_v2']);
    expect((rpc.mock.calls as unknown as [string][]).map((call) => call[0]))
      .toEqual(['begin_public_qandeel_work_v1', 'read_public_qandeel_context_v2', 'complete_public_qandeel_work_v1']);
  });
});

describe('S8A-05 CP4 — the branch-scoped Public QANDEEL context (A-5(c))', () => {
  it('reads the 0182 rows: speakers, targets, the topic, earlier answers attached to their posts', () => {
    const context = publicQandeelContextOf(BRANCH) as PublicQandeelContext;
    expect(context.topic).toContain('AUTHOR: I am tired of the job');
    expect(context.posts.map((p) => [p.id, p.speaker, p.replyTo, p.invoking])).toEqual([
      [ROOT, 'PARTICIPANT', null, false], [R1, 'OP', ROOT, false], [SIDE, 'PARTICIPANT', ROOT, false], [R2, 'OP', R1, false], [ASK, 'ASKER', R2, true]]);
    expect(context.earlierAnswers).toEqual([{ answers: R1, text: 'It sounds like you want to leave the job.' }]);
    expect([context.content, context.related, context.earlierResponses]).toEqual([[], [], []]);
  });

  it('renders the topic, then the thread with OP / Asker / Participant labels, numbered targets and attached QANDEEL readings', () => {
    const request = assemblePublicQandeelRequest(publicQandeelContextOf(BRANCH) as PublicQandeelContext) as ModelRouterRequest;
    const text = userMessage(request);
    expect(text).toBe([
      TOPIC_HEADER,
      'TITLE: Tired of work\nAUTHOR_TEXT: I wrote this about work\nAUTHOR: I am tired of the job',
      'Its reviewed meaning: Tired of the pressure at work',
      'Themes: work',
      '',
      THREAD_HEADER,
      '#1 [Participant]: Is it the hours or the people?',
      '#2 [OP] replying to #1: It is mostly my manager.',
      '   [QANDEEL] answering #2: It sounds like you want to leave the job.',
      '#3 [Participant] replying to #1: Same here.',
      '#4 [OP] replying to #2: To be clear: I am not leaving the job, I am asking how to talk to him.',
      '#5 [Asker] replying to #4 — asking you now: @qandeel what do you make of this?',
    ].join('\n'));
    // An earlier QANDEEL reading is labelled as a reading, never as the author's view; the author's own later words follow it.
    expect(THREAD_HEADER).toContain('a reading, not a fact, and not the author\'s view');
    expect(text.indexOf('[QANDEEL] answering #2')).toBeLessThan(text.indexOf('#4 [OP]'));
    expect(text).not.toMatch(/00000000-0000|oliveisland|A participant:/u);
  });

  it('keeps the frozen frame, the composition and the locale; Public DEEP is 25 s and FAST 3 s', () => {
    const context = publicQandeelContextOf(BRANCH) as PublicQandeelContext;
    const fast = assemblePublicQandeelRequest(context) as ModelRouterRequest;
    expect(fast.behavioralGuidance).toContain(PUBLIC_QANDEEL_FRAME);
    expect(fast).toMatchObject({ path: 'FAST', locale: 'und', latencyBudgetMs: 3000 });
    const deep = assemblePublicQandeelRequest({ ...context, posts: context.posts.map((p) => (p.invoking
      ? { ...p, text: `@qandeel ${'We are planning a long walk along the river next weekend and comparing routes, snacks and the weather. '.repeat(11)}What do you think?` }
      : p)) }) as ModelRouterRequest;
    expect(deep).toMatchObject({ path: 'DEEP', latencyBudgetMs: 25000 });
  });

  it('bounds the branch: the asking post and its chain first, then the newest others, within the history budget', () => {
    const big = 'x'.repeat(4000);
    const others = Array.from({ length: 8 }, (_, n) => post(id(100 + n), 10 + n, 'PARTICIPANT', ROOT, `${n} ${big}`));
    const rows = [...BRANCH.filter((r) => r.context_kind !== 'POST' && r.context_kind !== 'QANDEEL'),
      post(ROOT, 1, 'PARTICIPANT', null, `root ${big}`), ...others, post(R1, 30, 'OP', ROOT, `chain ${big}`),
      post(ASK, 31, 'ASKER', R1, '@qandeel and so?', 'INVOKING')];
    const text = userMessage(assemblePublicQandeelRequest(publicQandeelContextOf(rows) as PublicQandeelContext) as ModelRouterRequest);
    const thread = text.slice(text.indexOf(THREAD_HEADER));
    expect(Buffer.byteLength(thread, 'utf8')).toBeLessThan(HISTORY_BUDGET_BYTES + 1024);
    expect(thread).toContain('[Asker] replying to');
    expect(thread).toContain('[OP] replying to #1: chain');
    expect(thread).toContain('#1 [Participant]: root');
    expect(thread).toContain('7 xxx');
    expect(thread).not.toContain('] replying to #1: 0 xxx');
  });

  it('a malformed branch is no context: an unknown speaker, a bad target, an answer to a post outside the branch', () => {
    const swap = (index: number, patch: Partial<PublicQandeelContextRow>) => BRANCH.map((r, n) => (n === index ? { ...r, ...patch } : r));
    expect(publicQandeelContextOf(swap(4, { speaker: 'ALICE' }))).toBeNull();
    expect(publicQandeelContextOf(swap(5, { answers_ref: 'guess' }))).toBeNull();
    expect(publicQandeelContextOf(swap(9, { answers_ref: id(99) }))).toBeNull();
    expect(publicQandeelContextOf(BRANCH.filter((r) => r.context_role !== 'INVOKING'))).toBeNull();
  });

  it('the invoker pays: one call inside their attribution scope, their identity never in the request; the completion consumes the branch', async () => {
    const seen: { request: ModelRouterRequest; userId: string | undefined }[] = [];
    const repo = repository();
    await expect(replies(repo, routerAnswering('Your later words say you are staying.', seen)).respond(ASK, USER)).resolves.toBe('RESPONDED');
    expect(seen.map((s) => s.userId)).toEqual([USER]);
    expect(JSON.stringify(seen[0].request)).not.toContain(USER);
    expect(repo.complete).toHaveBeenCalledWith(ASK, LEASE, VERSION, 'Your later words say you are staying.', [ROOT, R1, SIDE, R2, ASK]);
  });

  it('a provider failure invents no words: the lease ends unanswered and nothing is recorded', async () => {
    const repo = repository();
    const failing: ModelRouter = { generate: async () => { throw new Error('provider down'); } };
    await expect(replies(repo, failing).respond(ASK, USER)).resolves.toBe('UNAVAILABLE');
    expect(repo.complete).not.toHaveBeenCalled();
    expect(repo.end).toHaveBeenCalledWith(ASK, LEASE, true);
  });
});

describe('S8A-05 CP4 — the Public reply\'s provider composition (A-5(d))', () => {
  it('test mode is the Model Router\'s own seam; elsewhere DeepSeek refuses before any request unless SYNTHETIC_ONLY is declared', async () => {
    expect(createPublicQandeelModelRouter({ NODE_ENV: 'test' })).toBeInstanceOf(FakeModelRouter);
    const refused = createPublicQandeelModelRouter({ NODE_ENV: 'production' });
    const context = publicQandeelContextOf(BRANCH) as PublicQandeelContext;
    await expect(refused.generate(assemblePublicQandeelRequest(context) as ModelRouterRequest)).rejects.toThrow();
  });

  it('the Public World module hands its generator the PUBLIC_QANDEEL_REPLY router; the application router stays the only MODEL_ROUTER', () => {
    const module = readFileSync(join(__dirname, 'public-world.module.ts'), 'utf8');
    expect(module).toContain('{ provide: PublicQandeelGenerator, useFactory: (safety: SafetyResponseGateService) => new PublicQandeelGenerator(createPublicQandeelModelRouter(process.env), safety), inject: [SafetyResponseGateService] }');
    expect(module).not.toMatch(/provide: MODEL_ROUTER/u);
    const composition = readFileSync(join(__dirname, 'public-reply-model-router.ts'), 'utf8');
    expect(composition).toContain('DeepSeekModelRouter.forPublicQandeel(undefined, productionAiProviderCallAccounting())');
    const router = readFileSync(join(__dirname, '../model-router/providers/deepseek/deepseek-model-router.ts'), 'utf8');
    expect(router).toContain("accountedDeepSeekChatCompletionsClient(createDeepSeekClient(config), 'PUBLIC_QANDEEL_REPLY', accounting)");
    expect(router).toContain("accountedDeepSeekChatCompletionsClient(createDeepSeekClient(config), 'CONVERSATION_REPLY', accounting)");
  });
});
