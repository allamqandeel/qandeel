import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import type { ActivityRepository } from '../activity/activity.repository';
import { EXECUTABLE_DESTINATIONS } from '../activity/activity.types';
import type { ActivityCandidate, ActivityPublisher } from '../activity/activity-publisher.service';
import { currentAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import { ROUTE_RATE_LIMIT_CENSUS } from '../http-security/route-rate-limit.census';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { PUBLIC_ACTIVITY_COPY, PUBLIC_ACTIVITY_COPY_GATE } from './public-activity-copy';
import { PublicActivityProducer } from './public-activity.producer';
import type { PublicActivityRepository } from './public-activity.repository';
import type { PublicDiscussionRepository, PublicQandeelContextRow } from './public-discussion.repository';
import { PublicDiscussionService } from './public-discussion.service';
import {
  PUBLIC_QANDEEL_FRAME, PUBLIC_QANDEEL_RESPONSE_MAX, assemblePublicQandeelRequest, boundPublicQandeelResponse, type PublicQandeelContext,
} from './public-qandeel-model-input';
import { PublicQandeelGenerator, PublicQandeelReplyService, publicQandeelContextOf } from './public-qandeel-reply.service';

const TOKEN = 'reader-token';
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const USER = id(1);
const EXPERIENCE = id(2);
const POST = id(3);
const ROOT = id(4);
const LEASE = id(5);
const VERSION = id(6);
const COMMAND = id(7);
const RELATION = id(8);
const OTHER_USER = id(9);
const AT = '2026-10-08T10:00:00.000Z';

const row = (overrides: Record<string, unknown> = {}) => ({
  post_id: POST, thread_root_id: ROOT, post_ordinal: 2, author_label_mode: 'PSEUDONYM', author_display_label: 'oliveisland38', post_body: 'A reply',
  posted_at: AT, is_own: false, qandeel_state: 'NONE', qandeel_response_body: null, qandeel_responded_at: null, ...overrides,
});
const CONTEXT_ROWS: PublicQandeelContextRow[] = [
  { context_kind: 'VERSION', context_role: null, context_ordinal: 0, context_ref: VERSION, context_text: null },
  { context_kind: 'MEANING', context_role: null, context_ordinal: 0, context_ref: null, context_text: 'Fear for a family while work feels uncertain' },
  { context_kind: 'THEME', context_role: 'PRIMARY', context_ordinal: 1, context_ref: null, context_text: 'fear' },
  { context_kind: 'CONTENT', context_role: 'SOURCE_CONTENT', context_ordinal: 1, context_ref: null, context_text: 'the published words' },
  { context_kind: 'POST', context_role: 'PARTICIPANT', context_ordinal: 1, context_ref: ROOT, context_text: 'an earlier public post' },
  { context_kind: 'POST', context_role: 'INVOKING', context_ordinal: 2, context_ref: POST, context_text: '@qandeel what do you see?' },
  { context_kind: 'RELATED', context_role: null, context_ordinal: 1, context_ref: null, context_text: 'Courage found in small daily choices' },
];

function discussionRepository(overrides: Partial<Record<keyof PublicDiscussionRepository, jest.Mock>> = {}) {
  return {
    post: jest.fn(async () => [{ outcome: 'POSTED', post_id: POST, thread_root_id: POST, post_ordinal: 2, qandeel_invoked: false }]),
    posts: jest.fn(async () => [row()]),
    capability: jest.fn(async () => [{ can_contribute: true }]),
    begin: jest.fn(async () => [{ work_outcome: 'GRANTED', work_lease_id: LEASE }]),
    context: jest.fn(async () => CONTEXT_ROWS),
    complete: jest.fn(async () => [{ outcome: 'RESPONSE_RECORDED', response_id: id(10) }]),
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
const replies = (repo = discussionRepository(), router: ModelRouter = routerAnswering('A public reading.')) =>
  new PublicQandeelReplyService(repo as unknown as PublicDiscussionRepository, new PublicQandeelGenerator(router, new SafetyResponseGateService()));
const producer = () => ({ discussionPost: jest.fn(async () => undefined) });
const discussion = (repo = discussionRepository(), reply = { respond: jest.fn(async () => 'RESPONDED') }, activity = producer()) =>
  new PublicDiscussionService(repo as unknown as PublicDiscussionRepository, reply as unknown as PublicQandeelReplyService,
    activity as unknown as PublicActivityProducer);

describe('S5-04 — the dependent Public discussion over the frozen 0096 runtime', () => {
  it('reads the served version\'s posts — Public Identity display only, its thread root, its one QANDEEL response state', async () => {
    const repo = discussionRepository({ posts: jest.fn(async () => [row(), row({ post_id: id(11), post_ordinal: 3, qandeel_state: 'RESPONDED',
      qandeel_response_body: 'A public reading.', qandeel_responded_at: AT, is_own: true })]) });
    const view = await discussion(repo).read(TOKEN, EXPERIENCE, {});
    expect(view).toEqual({
      state: 'SERVED', canContribute: true, nextAfter: null, posts: [
        { id: POST, threadRootId: ROOT, ordinal: 2, author: { mode: 'PSEUDONYM', label: 'oliveisland38' }, text: 'A reply', postedAt: AT, own: false, qandeel: { state: 'NONE' } },
        { id: id(11), threadRootId: ROOT, ordinal: 3, author: { mode: 'PSEUDONYM', label: 'oliveisland38' }, text: 'A reply', postedAt: AT, own: true,
          qandeel: { state: 'RESPONDED', text: 'A public reading.', respondedAt: AT } },
      ],
    });
    expect(JSON.stringify(view)).not.toMatch(/user|identity_ref|account|email|login|like|follow|rank|score|popular/iu);
    expect(repo.posts).toHaveBeenCalledWith(TOKEN, EXPERIENCE, null);
  });

  it('pages after a canonical ordinal; a hidden or never-served Experience is one neutral absence, never a tombstone', async () => {
    const repo = discussionRepository();
    await discussion(repo).read(TOKEN, EXPERIENCE, { after: '40' });
    expect(repo.posts).toHaveBeenCalledWith(TOKEN, EXPERIENCE, 40);
    for (const query of [{ after: '0' }, { after: '-1' }, { after: 'x' }, { after: '1', viewer: USER }, { version: VERSION }]) {
      expect(() => discussion(repo).read(TOKEN, EXPERIENCE, query)).toThrow(BadRequestException);
    }
    await expect(discussion(discussionRepository({ capability: jest.fn(async () => []) })).read(TOKEN, EXPERIENCE, {})).resolves.toEqual({ state: 'UNAVAILABLE' });
    await expect(discussion().read(TOKEN, 'guess', {})).resolves.toEqual({ state: 'UNAVAILABLE' });
    const full = discussionRepository({ posts: jest.fn(async () => Array.from({ length: 100 }, (_, n) => row({ post_ordinal: n + 1 }))) });
    expect(((await discussion(full).read(TOKEN, EXPERIENCE, {})) as { nextAfter: number | null }).nextAfter).toBe(100);
    for (const bad of [{ author_label_mode: 'ACCOUNT' }, { qandeel_state: 'LIKED' }, { post_ordinal: 0 }, { qandeel_state: 'RESPONDED' }]) {
      await expect(discussion(discussionRepository({ posts: jest.fn(async () => [row(bad)]) })).read(TOKEN, EXPERIENCE, {}))
        .rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });

  it('posts exactly { commandId, text, replyTo } — never an author, identity, version, ordinal, instant or verdict', async () => {
    const repo = discussionRepository();
    const activity = producer();
    const reply = { respond: jest.fn(async () => 'RESPONDED') };
    await expect(discussion(repo, reply, activity).post(USER, TOKEN, EXPERIENCE, { commandId: COMMAND, text: 'A thought', replyTo: null }))
      .resolves.toEqual({ outcome: 'COMMITTED', postId: POST, threadRootId: POST, qandeel: 'NONE' });
    expect(repo.post).toHaveBeenCalledWith(TOKEN, COMMAND, EXPERIENCE, null, 'A thought');
    expect(activity.discussionPost).toHaveBeenCalledWith(POST);
    expect(reply.respond).not.toHaveBeenCalled();
    for (const body of [
      {}, { commandId: COMMAND, text: 'x' }, { commandId: COMMAND, text: '  ', replyTo: null }, { commandId: COMMAND, text: 'x'.repeat(4001), replyTo: null },
      { commandId: COMMAND, text: 'x', replyTo: 'guess' }, { commandId: COMMAND, text: 'x', replyTo: null, author: USER },
      { commandId: COMMAND, text: 'x', replyTo: null, version: VERSION }, null, [],
    ]) expect(() => discussion(repo).post(USER, TOKEN, EXPERIENCE, body)).toThrow(BadRequestException);
  });

  it('contribution fails closed on the entitlement seam; a hidden target is one neutral answer; neither publishes Activity', async () => {
    for (const outcome of ['NOT_ENTITLED', 'UNAVAILABLE']) {
      const activity = producer();
      const repo = discussionRepository({ post: jest.fn(async () => [{ outcome, post_id: null, thread_root_id: null, post_ordinal: null, qandeel_invoked: false }]) });
      await expect(discussion(repo, undefined, activity).post(USER, TOKEN, EXPERIENCE, { commandId: COMMAND, text: 'x', replyTo: null })).resolves.toEqual({ outcome });
      expect(activity.discussionPost).not.toHaveBeenCalled();
    }
  });

  it('an @qandeel post asks for its ONE response; the human post stands whatever the generation answers', async () => {
    for (const state of ['RESPONDED', 'PENDING', 'UNAVAILABLE']) {
      const reply = { respond: jest.fn(async () => state) };
      const repo = discussionRepository({ post: jest.fn(async () => [{ outcome: 'REPLIED', post_id: POST, thread_root_id: ROOT, post_ordinal: 3, qandeel_invoked: true }]) });
      await expect(discussion(repo, reply).post(USER, TOKEN, EXPERIENCE, { commandId: COMMAND, text: '@qandeel?', replyTo: ROOT }))
        .resolves.toEqual({ outcome: 'COMMITTED', postId: POST, threadRootId: ROOT, qandeel: state });
      expect(reply.respond).toHaveBeenCalledWith(POST, USER);
    }
    const reply = { respond: jest.fn(async () => 'RESPONDED') };
    await expect(discussion(undefined, reply).retryQandeel(USER, EXPERIENCE, POST, {})).resolves.toEqual({ qandeel: 'RESPONDED' });
    await expect(discussion(undefined, reply).retryQandeel(USER, EXPERIENCE, POST, { requester: OTHER_USER })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('S5-04 — Public QANDEEL: the lease, the public-only context, revalidation', () => {
  it('the Public model input is public-visible truth only — no author, display, account or private context', () => {
    const context = publicQandeelContextOf(CONTEXT_ROWS) as PublicQandeelContext;
    expect(Object.keys(context).sort()).toEqual(['content', 'earlierResponses', 'meaning', 'posts', 'primaryThemes', 'related', 'secondaryThemes', 'versionId']);
    const request = assemblePublicQandeelRequest(context) as ModelRouterRequest;
    const all = JSON.stringify(request);
    expect(request.behavioralGuidance).toContain(PUBLIC_QANDEEL_FRAME);
    expect(all).toContain('the published words');
    expect(all).toContain('A participant: an earlier public post');
    expect(all).toContain('The participant asking you now: @qandeel what do you see?');
    expect(all).toContain('Courage found in small daily choices');
    expect(all).not.toMatch(/oliveisland|00000000-0000|Shared World/iu);
    expect(JSON.stringify(request.context)).not.toMatch(/memory|Personal|account|identity/iu);
    expect(request.context).toHaveLength(1);
    // The structural firewall: the assembler's source imports nothing private and never the Shared assembler.
    const source: string = readFileSync(join(__dirname, 'public-qandeel-model-input.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
    expect(source).not.toMatch(/shared-conversation-model-input|memory|human-intelligence|hypothesis|matching|introduction|connected-worlds|account/iu);
    expect(publicQandeelContextOf(CONTEXT_ROWS.filter((r) => r.context_kind !== 'VERSION'))).toBeNull();
    expect(publicQandeelContextOf(CONTEXT_ROWS.filter((r) => r.context_role !== 'INVOKING'))).toBeNull();
  });

  it('calls the Model Router inside the accounting scope of the invoking human, whose identity never enters the request', async () => {
    const seen: { request: ModelRouterRequest; userId: string | undefined }[] = [];
    const repo = discussionRepository();
    await expect(replies(repo, routerAnswering('  A public reading.  ', seen)).respond(POST, USER)).resolves.toBe('RESPONDED');
    expect(seen).toHaveLength(1);
    expect(seen[0].userId).toBe(USER);
    expect(JSON.stringify(seen[0].request)).not.toContain(USER);
    expect(repo.complete).toHaveBeenCalledWith(POST, LEASE, VERSION, 'A public reading.', [ROOT, POST]);
    expect(repo.end).not.toHaveBeenCalled();
  });

  it('the work lease decides: one response, never twice; in progress is pending; anything else is unavailable', async () => {
    const router = { generate: jest.fn() };
    for (const [outcome, state] of [['ALREADY_COMMITTED', 'RESPONDED'], ['IN_PROGRESS', 'PENDING'], ['LIMITED', 'UNAVAILABLE'], ['UNAVAILABLE', 'UNAVAILABLE']]) {
      const repo = discussionRepository({ begin: jest.fn(async () => [{ work_outcome: outcome, work_lease_id: null }]) });
      await expect(replies(repo, router).respond(POST, USER)).resolves.toBe(state);
      expect(repo.context).not.toHaveBeenCalled();
    }
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('no provider bound, an empty answer, or a dark context: nothing is invented — the lease ends unanswered', async () => {
    const unbound: ModelRouter = { generate: jest.fn(async () => { throw new Error('MODEL_PROVIDER must be either anthropic or openai.'); }) };
    for (const [router, repo] of [
      [unbound, discussionRepository()], [routerAnswering('   '), discussionRepository()],
      [routerAnswering('x'), discussionRepository({ context: jest.fn(async () => []) })],
    ] as const) {
      await expect(replies(repo, router).respond(POST, USER)).resolves.toBe('UNAVAILABLE');
      expect(repo.complete).not.toHaveBeenCalled();
      expect(repo.end).toHaveBeenCalledWith(POST, LEASE, true);
    }
  });

  it('a stale completion is discarded and reported unavailable; a database failure never throws', async () => {
    const stale = discussionRepository({ complete: jest.fn(async () => [{ outcome: 'STALE', response_id: null }]) });
    await expect(replies(stale).respond(POST, USER)).resolves.toBe('UNAVAILABLE');
    expect(stale.end).not.toHaveBeenCalled();
    const down = discussionRepository({ begin: jest.fn(async () => { throw new Error('down'); }) });
    await expect(replies(down).respond(POST, USER)).resolves.toBe('UNAVAILABLE');
    await expect(replies().respond('guess', USER)).resolves.toBe('UNAVAILABLE');
  });

  it('a BLOCK answers with the canonical deterministic words and calls no provider; answers are bounded', async () => {
    const router = { generate: jest.fn() };
    const repo = discussionRepository({ context: jest.fn(async () => CONTEXT_ROWS.map((r) => (r.context_role === 'INVOKING' ? { ...r, context_text: 'how can I kill myself tonight' } : r))) });
    await expect(replies(repo, router).respond(POST, USER)).resolves.toBe('RESPONDED');
    expect(router.generate).not.toHaveBeenCalled();
    expect(boundPublicQandeelResponse('x'.repeat(PUBLIC_QANDEEL_RESPONSE_MAX + 50))).toHaveLength(PUBLIC_QANDEEL_RESPONSE_MAX);
    expect(boundPublicQandeelResponse(42)).toBeNull();
  });
});

describe('S5-04 — the Public Activity producer (D25; Product Owner D5)', () => {
  const published: ActivityCandidate[] = [];
  const withdrawn: [string, string][] = [];
  const publisher = {
    publish: jest.fn(async (candidate: ActivityCandidate) => { published.push(candidate); return { outcome: 'PUBLISHED', itemId: id(20) }; }),
    withdraw: jest.fn(async (user: string, ref: string) => { withdrawn.push([user, ref]); return 1; }),
  } as unknown as ActivityPublisher;
  const sourceRow = (event: string, extra: Record<string, unknown> = {}) =>
    ({ recipient_user_id: OTHER_USER, event_kind: event, experience_id: EXPERIENCE, relation_id: null, occurred_at: AT, ...extra });
  const make = (rows: unknown[]) => {
    const sources = { source: jest.fn(async () => rows) };
    return { sources, producer: new PublicActivityProducer(sources as unknown as PublicActivityRepository, publisher) };
  };
  beforeEach(() => { published.length = 0; withdrawn.length = 0; });

  it('a direct reply is Class 3; a top-level post on one\'s own Experience is Class 4 ambient (never a Push)', async () => {
    const reply = make([sourceRow('REPLY_TO_OWN_POST')]);
    await reply.producer.discussionPost(POST);
    expect(reply.sources.source).toHaveBeenCalledWith('DISCUSSION_POST', POST);
    expect(published[0]).toMatchObject({
      recipientUserId: OTHER_USER, kind: 'PUBLIC_INTERACTION', interruptionClass: 3, actionable: false, speaker: 'PRODUCT', disclosureMax: 'L2',
      entry: { destination: 'PUBLIC_WORLD', ref: `discussion:${EXPERIENCE}` }, body: PUBLIC_ACTIVITY_COPY.replyToOwnPost,
      candidateKey: `s5-04:reply:${POST}`, sourceRef: `public:reply:${POST}`,
    });
    const post = make([sourceRow('POST_ON_OWN_EXPERIENCE')]);
    await post.producer.discussionPost(POST);
    expect(published[1]).toMatchObject({ interruptionClass: 4, body: PUBLIC_ACTIVITY_COPY.ambient });
    expect(JSON.stringify(published)).not.toMatch(/A reply|A thought|qandeel|oliveisland/iu);
  });

  it('a relation request is Class 3 and actionable; acceptance tells the requester and withdraws the request item', async () => {
    const request = make([sourceRow('RELATION_REQUEST', { relation_id: RELATION })]);
    await request.producer.relationRequested(RELATION);
    expect(published[0]).toMatchObject({ interruptionClass: 3, actionable: true, entry: { destination: 'PUBLIC_WORLD', ref: `relations:${RELATION}` },
      sourceRef: `public:relation-request:${RELATION}`, body: PUBLIC_ACTIVITY_COPY.relationRequest });
    const accepted = make([sourceRow('RELATION_ACCEPTED', { relation_id: RELATION })]);
    await accepted.producer.relationAccepted(RELATION);
    expect(withdrawn).toEqual([[OTHER_USER, `public:relation-request:${RELATION}`]]);
    expect(published[1]).toMatchObject({ interruptionClass: 3, actionable: false, body: PUBLIC_ACTIVITY_COPY.relationAccepted });
  });

  it('declined / cancelled / removed create nothing — they only withdraw; failures are absorbed; guessed ids read nothing', async () => {
    const ended = make([sourceRow('RELATION_REQUEST', { relation_id: RELATION })]);
    await ended.producer.relationEnded(RELATION);
    expect(published).toEqual([]);
    expect(withdrawn).toEqual([[OTHER_USER, `public:relation-request:${RELATION}`]]);
    const down = { source: jest.fn(async () => { throw new Error('down'); }) };
    await expect(new PublicActivityProducer(down as unknown as PublicActivityRepository, publisher).discussionPost(POST)).resolves.toBeUndefined();
    const guessed = make([]);
    await guessed.producer.discussionPost('guess');
    expect(guessed.sources.source).not.toHaveBeenCalled();
    const unknown = make([sourceRow('PUBLIC_DISCOVERY'), sourceRow('LIKED')]);
    await unknown.producer.discussionPost(POST);
    expect(published).toEqual([]);
  });

  it('copy: one REUSED line and three PROPOSED rows in ONE gate, nothing silently approved', () => {
    expect(PUBLIC_ACTIVITY_COPY_GATE.approved).toEqual([]);
    expect([...PUBLIC_ACTIVITY_COPY_GATE.proposed].sort()).toEqual(['relationAccepted', 'relationRequest', 'replyToOwnPost']);
    expect(PUBLIC_ACTIVITY_COPY.ambient).toEqual({ ar: 'نشاط جديد في العالم العام', en: 'New activity in the Public World' });
  });
});

describe('S5-04 — Public Direct Entry revalidates NOW on the caller\'s token', () => {
  const opened = (ref: string, context = 'PUBLIC_WORLD') =>
    [{ outcome: 'OPENED', category: 'PUBLIC', context_kind: context, context_ref: EXPERIENCE, entry_destination: 'PUBLIC_WORLD', entry_ref: ref }];
  const activity = (open: unknown, extra: Record<string, jest.Mock> = {}) => new ActivityService({
    open: jest.fn(async () => open), publicExperienceServed: jest.fn(async () => [{ experience_id: EXPERIENCE }]),
    ownPublicRelations: jest.fn(async () => [{ relation_id: RELATION, experience_id: EXPERIENCE, relation_state: 'REQUEST_RECEIVED' }]), ...extra,
  } as unknown as ActivityRepository);

  it('PUBLIC_WORLD is executable now', () => {
    expect(EXECUTABLE_DESTINATIONS.has('PUBLIC_WORLD')).toBe(true);
    expect(EXECUTABLE_DESTINATIONS.has('INTRODUCTIONS')).toBe(false);
    expect(EXECUTABLE_DESTINATIONS.has('REPLAY')).toBe(false);
  });

  it('opens the exact Experience\'s discussion only while it is served; otherwise no fallback, no reason, no substitute', async () => {
    await expect(activity(opened(`discussion:${EXPERIENCE}`)).open(TOKEN, id(30)))
      .resolves.toEqual({ outcome: 'ENTER', destination: { kind: 'PUBLIC_WORLD', target: { kind: 'DISCUSSION', experienceId: EXPERIENCE } } });
    for (const served of [[], [{ experience_id: id(99) }]]) {
      await expect(activity(opened(`discussion:${EXPERIENCE}`), { publicExperienceServed: jest.fn(async () => served) }).open(TOKEN, id(30)))
        .resolves.toEqual({ outcome: 'UNAVAILABLE', fallback: null });
    }
  });

  it('opens relation management only for one of the reader\'s own current relations', async () => {
    await expect(activity(opened(`relations:${RELATION}`)).open(TOKEN, id(30)))
      .resolves.toEqual({ outcome: 'ENTER', destination: { kind: 'PUBLIC_WORLD', target: { kind: 'RELATIONS', experienceId: EXPERIENCE } } });
    for (const relations of [[], [{ relation_id: RELATION, experience_id: EXPERIENCE, relation_state: 'REQUEST_SENT' }], [{ relation_id: id(98), experience_id: EXPERIENCE, relation_state: 'ACTIVE' }]]) {
      await expect(activity(opened(`relations:${RELATION}`), { ownPublicRelations: jest.fn(async () => relations) }).open(TOKEN, id(30)))
        .resolves.toEqual({ outcome: 'UNAVAILABLE', fallback: null });
    }
  });

  it('a malformed Public ref or another context is refused', async () => {
    for (const answer of [opened('experience:guess'), opened(`discussion:${EXPERIENCE}`, 'SHARED_WORLD'), opened(`discussion:${EXPERIENCE.toUpperCase()}x`)]) {
      await expect(activity(answer).open(TOKEN, id(30))).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });
});

describe('S5-04 — routes', () => {
  it('classifies exactly the three discussion routes', () => {
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /public/field/experiences/:experienceId/discussion']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /public/field/experiences/:experienceId/discussion']).toBe('SECURITY_SENSITIVE');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /public/field/experiences/:experienceId/discussion/:postId/qandeel']).toBe('SECURITY_SENSITIVE');
    expect(Object.keys(ROUTE_RATE_LIMIT_CENSUS).join(' ')).not.toMatch(/like|follow|react|recipient|discovery/iu);
  });
});
