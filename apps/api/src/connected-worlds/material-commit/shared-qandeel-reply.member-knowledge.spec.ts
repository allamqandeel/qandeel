// S8A-04 CP3 — the Shared reply with Personal Knowledge (amendment §3 – §5, §8, as R4 / §11 binds over them): the REAL reply
// service, the REAL generator, the REAL frozen I-03 chain and the REAL member-knowledge service and lane, the REAL claim
// spans. Only the server channel (the 0139 / 0175 / 0176 / 0178 reads and acts), the Model Router and the checker are
// doubles. No provider, no database, no spend.
//
// R4 changes three expectations of the V1 version of this file, on purpose: the reply states an item only inside its span
// and the COMMITTED body is the server's rendering of it (the owner's Name written by the server); a checker failure now
// withholds WITHOUT cooling the item (R4-3; V1 cooled it); and only the item a check proved unsafe is cooled.
import type { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import { SafetyResponseGateService } from '../../conversation/safety-response-gate.service';
import { currentAiUsageAttribution } from '../../ai-usage/ai-usage-attribution';
import type { ModelRouter, ModelRouterRequest } from '../../model-router/model-router.types';
import { SharedConversationReplyGenerator } from '../../shared-world/shared-conversation-reply.generator';
import { FakeSharedDisclosureJudge } from '../../shared-world/shared-disclosure-judge-provider';
import { SHARED_MEMBER_KNOWLEDGE_INSTRUCTIONS } from '../../shared-world/shared-member-knowledge-texts';
import type { SharedHumanAudienceResolverService } from '../audience/shared-human-audience-resolver.service';
import type { StandingContextGrantResolverService } from '../authority-resolution/standing-context-grant-resolver.service';
import { SharedDeliveryAuthorityRevalidatorService, digestProviderOutput } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import { SharedEffectiveContextService, digestReasoningContent } from '../effective-context/shared-effective-context.service';
import type { SharedPreModelWorldStateResolverService } from '../effective-context/shared-pre-model-world-state-resolver.service';
import type { SharedWorldId } from '../kernel/world.types';
import { SharedMemberKnowledgeService } from '../member-knowledge/shared-member-knowledge.service';
import type { SharedDisclosureCheckRequest, SharedDisclosureJudge } from '../member-knowledge/shared-member-knowledge.types';
import { SharedPrivacyAuthorityDeliveryReadinessService } from '../source-disclosure/shared-privacy-authority-delivery-readiness.service';
import { SharedSourceDisclosureGateService } from '../source-disclosure/shared-source-disclosure-gate.service';
import { SharedQandeelReplyService, type SharedQandeelReplyRequest } from './shared-qandeel-reply.service';
import type { SharedConversationMaterial } from './shared-qandeel-reply.types';
import { UnimplementedPrivateSourceState, UnimplementedSourceDisclosureDetector } from './shared-unavailable-private-context-boundaries';

const WORLD = '10000000-0000-4000-8000-00000000000a';
const HALA = '20000000-0000-4000-8000-000000000001';
const MOHAMED = '20000000-0000-4000-8000-000000000002';
const SARA = '20000000-0000-4000-8000-000000000003';
const COMMAND = '30000000-0000-4000-8000-000000000001';
const M_NOW = '40000000-0000-4000-8000-000000000003';
const REPLY = '50000000-0000-4000-8000-000000000001';
const LEASE = '60000000-0000-4000-8000-000000000001';
const MEMORY = '70000000-0000-4000-8000-000000000001';
const SARA_MEMORY = '70000000-0000-4000-8000-000000000002';
const RG = '80000000-0000-4000-8000-000000000001';
const DG = '80000000-0000-4000-8000-000000000002';
const SARA_RG = '80000000-0000-4000-8000-000000000003';
const SARA_DG = '80000000-0000-4000-8000-000000000004';
const EPISODE = '90000000-0000-4000-8000-000000000001';
const SARA_EPISODE = '90000000-0000-4000-8000-000000000002';
const ITEM = 'يفضل السفر بالقطار';
const SARA_SECRET = 'تخاف من الطيران';
/** The generator's text: Mohamed's item stated inside the span of the ref this request gave it. */
const MENTIONING = (ref: string) => `⟦${ref}: ${ITEM}⟧، فممكن نشوف مواعيد القطار.`;
const RENDERED = `Mohamed ${ITEM}، فممكن نشوف مواعيد القطار.`;
const NAMES = [{ user_id: HALA, name: 'Hala' }, { user_id: MOHAMED, name: 'Mohamed' }, { user_id: SARA, name: 'Sara' }];

const VIEW: SharedConversationMaterial[] = [
  { materialId: M_NOW, producer: 'HUMAN', authorName: 'Hala', text: 'هنسافر إزاي الأسبوع الجاي؟ قطار ولا طيارة؟', establishedAt: '2026-10-25T10:00:00.000000+00:00' },
];

type Answer = (request: SharedDisclosureCheckRequest) => unknown;
const MENTION: Answer = (request) => ({ spans: request.spans.map((id) => ({ id, verdict: 'ENTAILED' })), outside: [], sealed: [] });
const QUOTE: Answer = (request) => ({ ...(MENTION(request) as object), sealed: [{ id: 'K1', passage: ITEM }] });

/** The V2 checker contract around a scripted answer; records each request and the AI-COST-01 scope it ran in. */
class Judge implements SharedDisclosureJudge {
  calls: Array<{ request: SharedDisclosureCheckRequest; scope: unknown }> = [];
  constructor(private readonly answer: Answer, private readonly during?: () => void, private readonly raw = false) {}
  async judge(request: SharedDisclosureCheckRequest): Promise<unknown> {
    this.calls.push({ request, scope: currentAiUsageAttribution() });
    this.during?.();
    const answer = this.answer(request);
    return this.raw ? answer : { state: 'CHECKED', checkRef: 'c', policyRef: 'p', binding: { ...request.binding }, answer };
  }
}

function collectorRow(overrides: Record<string, unknown> = {}) {
  return { owner_user_id: MOHAMED, memory_id: MEMORY, content: ITEM, content_digest: digestReasoningContent(ITEM), reasoning_grant_id: RG,
    disclosure_grant_id: DG, membership_episode_id: EPISODE, ceiling_user_ids: [HALA, MOHAMED, SARA], owner_name: 'Mohamed', ...overrides };
}

function saraRow() {
  return collectorRow({ owner_user_id: SARA, memory_id: SARA_MEMORY, content: SARA_SECRET, content_digest: digestReasoningContent(SARA_SECRET), reasoning_grant_id: SARA_RG,
    disclosure_grant_id: SARA_DG, membership_episode_id: SARA_EPISODE, owner_name: 'Sara' });
}
function saraItemRow() {
  return { availability: 'AVAILABLE', current_content_digest: digestReasoningContent(SARA_SECRET), reasoning_grant_id: SARA_RG, disclosure_grant_id: SARA_DG,
    membership_episode_id: SARA_EPISODE, grant_content_digest: digestReasoningContent(SARA_SECRET), ceiling_user_ids: [HALA, MOHAMED, SARA], grant_state: 'ACTIVE', disclosure_status: 'ACTIVE' };
}
/** The claim ref this request gave the item whose words are `item` (the last ref before those words in the request). */
const refBefore = (text: string, item: string) => [...text.slice(0, text.indexOf(item)).matchAll(/F[0-9]+·[a-z2-7]{6}/gu)].at(-1)?.[0] ?? 'F9·aaaaaa';

function harness(options: {
  judge?: SharedDisclosureJudge | null;
  collector?: unknown[];
  /** The generator's words; a function receives this request's claim ref for Mohamed (null: none was given). */
  output?: string | ((ref: string | null) => string);
  commit?: (name: string) => unknown;
  itemRow?: () => Record<string, unknown>;
  names?: () => unknown;
  /** Sara's item too: her collector row is added and her item grant resolved (two owners in one reply). */
  sara?: boolean;
  /** The generator's words from the whole request it was sent (overrides `output`). */
  outputFrom?: (text: string) => string;
} = {}) {
  const worldState = { async resolveCurrent(worldId: SharedWorldId) { return { state: 'RESOLVED', snapshot: { worldId, lifecycle: 'ACTIVE', phase: 'STANDARD', snapshotRef: 'world:1' } }; } } as unknown as SharedPreModelWorldStateResolverService;
  const audience = { async resolveCurrent() { return { state: 'RESOLVED', snapshot: { snapshotRef: 'audience:1', humans: [HALA, MOHAMED, SARA].map((humanId) => ({ kind: 'HUMAN', humanId })) } }; } } as unknown as SharedHumanAudienceResolverService;
  const grants = { async resolveCurrent() { throw new Error('the general Standing Context Grant is never composed'); } } as unknown as StandingContextGrantResolverService;
  const effective = new SharedEffectiveContextService(worldState, audience, grants);
  const revalidator = new SharedDeliveryAuthorityRevalidatorService(worldState, audience, grants, new UnimplementedPrivateSourceState());
  const readiness = new SharedPrivacyAuthorityDeliveryReadinessService(new SharedSourceDisclosureGateService(new UnimplementedSourceDisclosureDetector()), revalidator);
  const rpcs: Array<{ name: string; body: Record<string, unknown> }> = [];
  const itemRow = options.itemRow ?? (() => ({ availability: 'AVAILABLE', current_content_digest: digestReasoningContent(ITEM), reasoning_grant_id: RG, disclosure_grant_id: DG,
    membership_episode_id: EPISODE, grant_content_digest: digestReasoningContent(ITEM), ceiling_user_ids: [HALA, MOHAMED, SARA], grant_state: 'ACTIVE', disclosure_status: 'ACTIVE' }));
  const server = {
    async rpc(name: string, body: Record<string, unknown>) {
      rpcs.push({ name, body });
      switch (name) {
        case 'begin_shared_qandeel_reply_work_v1': return [{ work_outcome: 'GRANTED', work_lease_id: LEASE, reply_material_id: null }];
        case 'end_shared_qandeel_reply_work_v1': return true;
        case 'resolve_shared_world_material_v1': return [{ world_id: body.p_world_id, material_id: M_NOW, author_user_id: HALA }];
        case 'list_shared_world_knowledge_v1': return [];
        case 'list_shared_knowledge_for_reply_v1': return options.collector ?? (options.sara ? [collectorRow(), saraRow()] : [collectorRow()]);
        case 'resolve_shared_knowledge_item_v1':
          if (options.sara && body.p_owner_user_id === SARA && body.p_memory_id === SARA_MEMORY) return [saraItemRow()];
          return body.p_owner_user_id === MOHAMED && body.p_memory_id === MEMORY ? [itemRow()] : [];
        case 'cool_down_shared_knowledge_v1': return 1;
        case 'list_shared_audience_names_v1': return options.names ? options.names() : NAMES;
        case 'propose_shared_knowledge_request_v1': return [{ outcome: 'NONE' }];
        default: return [options.commit ? options.commit(name) : { outcome: 'MATERIAL_COMMITTED', material_id: REPLY, established_at: '2026-10-25T10:00:01Z' }];
      }
    },
  } as unknown as SupabaseServiceRoleApiService;
  const requests: ModelRouterRequest[] = [];
  const output: string | ((ref: string | null) => string) = options.output ?? ((ref) => MENTIONING(ref ?? 'F1·aaaaaa'));
  const router = { generate: jest.fn(async (body: ModelRouterRequest) => {
    requests.push(body);
    if (options.outputFrom) return { content: options.outputFrom(JSON.stringify(body)) };
    const ref = /F1·[a-z2-7]{6}/u.exec(JSON.stringify(body))?.[0] ?? null;
    return { content: typeof output === 'string' ? output : output(ref) };
  }) } as unknown as ModelRouter;
  const judge = options.judge === undefined ? new Judge(MENTION) : options.judge;
  const knowledge = new SharedMemberKnowledgeService(server, worldState, audience, judge);
  const service = new SharedQandeelReplyService(effective, readiness, revalidator, audience, server,
    new SharedConversationReplyGenerator(router, new SafetyResponseGateService()), knowledge);
  return { service, rpcs, requests, judge };
}

const request = (): SharedQandeelReplyRequest => ({ worldId: WORLD, humanCommandId: COMMAND, humanMaterialId: M_NOW, requesterUserId: HALA, requesterView: VIEW });
const flush = () => new Promise((resolve) => setImmediate(resolve));
type Call = { name: string; body: Record<string, unknown> };
const named = (rpcs: Call[], name: string): Call[] => rpcs.filter((call) => call.name === name);

describe('S8A-04 CP3 — a Shared reply using an item its owner allowed here', () => {
  it('Hala asks; Mohamed\'s consented item reaches the reply with its ref, Sara\'s nothing; ONE check in Hala\'s scope; v2 commits the RENDERED text', async () => {
    const judge = new Judge(MENTION);
    const h = harness({ judge });
    expect(await h.service.reply(request())).toEqual({ state: 'COMMITTED', materialId: REPLY });
    // The envelope the provider receives: Mohamed's consented words once, under CG-6a′, with a request ref; nothing of
    // Sara's; no id.
    const guidance = h.requests.map((body) => JSON.stringify(body)).join('\n');
    expect(guidance).toContain(SHARED_MEMBER_KNOWLEDGE_INSTRUCTIONS.slice(0, 40));
    expect(guidance).toMatch(/F1·[a-z2-7]{6}/u);
    expect(guidance.split(ITEM).length - 1).toBe(1);
    expect(guidance).not.toContain(SARA_SECRET);
    for (const id of [MOHAMED, MEMORY, RG, DG, EPISODE]) expect(guidance).not.toContain(id);
    // The check: once, Mohamed's item only, under a checker id, no Name, paid by Hala for her message in this World.
    expect(judge.calls).toHaveLength(1);
    expect(judge.calls[0].scope).toEqual({ userId: HALA, sourceWorldId: WORLD, sourceSharedMaterialId: M_NOW });
    expect(judge.calls[0].request.items).toEqual([{ id: 'K1', item: ITEM }]);
    expect(judge.calls[0].request.reply).toBe(`⟦K1: ${ITEM}⟧، فممكن نشوف مواعيد القطار.`);
    expect(judge.calls[0].request.binding.outputDigest).toBe(digestProviderOutput(RENDERED));
    expect(JSON.stringify(judge.calls[0].request)).not.toMatch(/Mohamed|Hala|Sara|F1·/u);
    // The commit with consent, exactly the admitted pair, disclosed, of the RENDERED text; never v1.
    const [commit] = named(h.rpcs, 'complete_shared_world_qandeel_reply_v2');
    expect(commit.body).toMatchObject({ p_body_text: RENDERED, p_output_digest: digestProviderOutput(RENDERED), p_reasoning_grant_ids: [RG], p_disclosed: [true],
      p_reasoning_source_refs: [`shared-knowledge:${RG}`], p_material_source_ids: [] });
    expect(named(h.rpcs, 'complete_shared_world_qandeel_reply_v1')).toHaveLength(0);
    // After the commit, and only then: the local relevance read (no model).
    await flush();
    const [propose] = named(h.rpcs, 'propose_shared_knowledge_request_v1');
    expect(propose.body).toMatchObject({ p_world_id: WORLD, p_source_material_id: M_NOW, p_window_seconds: 3600 });
    expect(h.rpcs.indexOf(propose)).toBeGreaterThan(h.rpcs.indexOf(commit));
    expect(h.requests).toHaveLength(1);
  });

  it('used, not mentioned: committed with the edge and disclosed = false', async () => {
    const h = harness({ judge: new Judge(MENTION), output: 'القطار ممكن يكون أنسب للمجموعة.' });
    expect((await h.service.reply(request())).state).toBe('COMMITTED');
    expect(named(h.rpcs, 'complete_shared_world_qandeel_reply_v2')[0].body).toMatchObject({ p_body_text: 'القطار ممكن يكون أنسب للمجموعة.', p_reasoning_grant_ids: [RG], p_disclosed: [false] });
  });

  it('a blocked reply is withheld like any failure: no commit, no use, no regeneration, the item cooled down, no request', async () => {
    const h = harness({ judge: new Judge(QUOTE) });
    const outcome = await h.service.reply(request());
    expect(outcome).toEqual({ state: 'UNAVAILABLE', reason: 'DELIVERY_NOT_READY' });
    expect(named(h.rpcs, 'complete_shared_world_qandeel_reply_v2')).toHaveLength(0);
    expect(named(h.rpcs, 'complete_shared_world_qandeel_reply_v1')).toHaveLength(0);
    expect(named(h.rpcs, 'cool_down_shared_knowledge_v1')[0].body).toEqual({ p_world_id: WORLD, p_owner_user_ids: [MOHAMED], p_memory_ids: [MEMORY], p_seconds: 3600 });
    expect(h.requests).toHaveLength(1);
    await flush();
    expect(named(h.rpcs, 'propose_shared_knowledge_request_v1')).toHaveLength(0);
    // The lease is returned however the request ends.
    expect(named(h.rpcs, 'end_shared_qandeel_reply_work_v1')).toHaveLength(1);
  });

  it.each([
    ['a throw / timeout', () => new Judge(() => { throw new Error('timeout'); })],
    ['a malformed answer', () => new Judge(() => 'not json', undefined, true)],
    ['an answer bound to another output', () => new Judge((request) => ({ state: 'CHECKED', checkRef: 'c', policyRef: 'p', binding: { ...request.binding, outputDigest: digestProviderOutput('x') }, answer: MENTION(request) }), undefined, true)],
  ])('a check failure (%s) is withheld the same way, and cools NOTHING (R4-3; V1 cooled the item)', async (_name, judge) => {
    const h = harness({ judge: judge() });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'DELIVERY_NOT_READY' });
    expect(named(h.rpcs, 'cool_down_shared_knowledge_v1')).toHaveLength(0);
    expect(named(h.rpcs, 'complete_shared_world_qandeel_reply_v2')).toHaveLength(0);
    expect(h.requests).toHaveLength(1);
  });

  it('the same reply through the composed test checker: in-span words pass; the same words outside a span block and cool only that item', async () => {
    const pass = harness({ judge: new FakeSharedDisclosureJudge() });
    expect((await pass.service.reply(request())).state).toBe('COMMITTED');
    const leak = harness({ judge: new FakeSharedDisclosureJudge(), output: `في حد هنا ${ITEM}.` });
    expect(await leak.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'DELIVERY_NOT_READY' });
    expect(named(leak.rpcs, 'cool_down_shared_knowledge_v1')[0].body).toMatchObject({ p_owner_user_ids: [MOHAMED], p_memory_ids: [MEMORY] });
  });

  it('two owners in ONE check: only the item the check proved unsafe is cooled, never the other (R4-3)', async () => {
    const judge = new Judge((request) => {
      const sara = request.items.find((entry) => entry.item === SARA_SECRET)?.id ?? 'K9';
      return { ...(MENTION(request) as object), outside: [{ id: sara, passage: SARA_SECRET }] };
    });
    const h = harness({ judge, sara: true, outputFrom: (text) => `⟦${refBefore(text, ITEM)}: ${ITEM}⟧، وفي حد هنا ${SARA_SECRET}.` });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'DELIVERY_NOT_READY' });
    expect(judge.calls).toHaveLength(1);
    expect(judge.calls[0].request.items.map((entry) => entry.item).sort()).toEqual([ITEM, SARA_SECRET].sort());
    expect(named(h.rpcs, 'cool_down_shared_knowledge_v1')).toHaveLength(1);
    expect(named(h.rpcs, 'cool_down_shared_knowledge_v1')[0].body).toMatchObject({ p_owner_user_ids: [SARA], p_memory_ids: [SARA_MEMORY] });
    expect(named(h.rpcs, 'complete_shared_world_qandeel_reply_v2')).toHaveLength(0);
  });

  it('two owners, both stated in their own spans: ONE check, each under its OWN owner\'s Name, both disclosed', async () => {
    const judge = new Judge(MENTION);
    const h = harness({ judge, sara: true, outputFrom: (text) => `⟦${refBefore(text, ITEM)}: ${ITEM}⟧، و⟦${refBefore(text, SARA_SECRET)}: ${SARA_SECRET}⟧.` });
    expect((await h.service.reply(request())).state).toBe('COMMITTED');
    expect(judge.calls).toHaveLength(1);
    const [commit] = named(h.rpcs, 'complete_shared_world_qandeel_reply_v2');
    expect(commit.body.p_body_text).toBe(`Mohamed ${ITEM}، وSara ${SARA_SECRET}.`);
    expect(commit.body.p_disclosed).toEqual([true, true]);
    expect(named(h.rpcs, 'cool_down_shared_knowledge_v1')).toHaveLength(0);
  });

  it('revoked during generation: STALE, withheld, not cooled down (consent moved, not the judge)', async () => {
    let revoked = false;
    const h = harness({
      judge: new Judge(MENTION, () => { revoked = true; }),
      itemRow: () => ({ availability: 'AVAILABLE', current_content_digest: digestReasoningContent(ITEM), reasoning_grant_id: RG, disclosure_grant_id: DG,
        membership_episode_id: EPISODE, grant_content_digest: digestReasoningContent(ITEM), ceiling_user_ids: [HALA, MOHAMED, SARA],
        grant_state: revoked ? 'REVOKED' : 'ACTIVE', disclosure_status: revoked ? 'REVOKED' : 'ACTIVE' }),
    });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'DELIVERY_NOT_READY' });
    expect(named(h.rpcs, 'cool_down_shared_knowledge_v1')).toHaveLength(0);
    expect(named(h.rpcs, 'complete_shared_world_qandeel_reply_v2')).toHaveLength(0);
  });

  it('revoked after readiness, before the commit: the 0176 commit answers STALE and nothing is written', async () => {
    const h = harness({ commit: (name) => (name === 'complete_shared_world_qandeel_reply_v2' ? { outcome: 'STALE', material_id: null, established_at: null } : null) });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'COMMIT_STALE' });
    await flush();
    expect(named(h.rpcs, 'propose_shared_knowledge_request_v1')).toHaveLength(0);
  });
});

describe('S8A-04 CP3 — R4: who can be stated, and what never reaches the model', () => {
  it.each([
    ['0178 gives Mohamed no Name (ambiguous or not shared by every viewer)', () => NAMES.map((row) => (row.user_id === MOHAMED ? { ...row, name: null } : row))],
    ['another member has the same Name', () => NAMES.map((row) => (row.user_id === SARA ? { ...row, name: 'Mohamed' } : row))],
    ['the Names are not exactly this audience', () => NAMES.slice(0, 2)],
    ['the 0178 read fails', () => { throw new Error('down'); }],
    ['the 0178 read is not exactly its shape', () => [{ ...NAMES[0], extra: 1 }, NAMES[1], NAMES[2]]],
  ])('%s: the item still informs the reply but has no ref; a span is withheld before any check, and nothing is cooled', async (_name, names) => {
    const judge = new Judge(MENTION);
    const h = harness({ judge, names, output: (ref) => MENTIONING(ref ?? 'F1·aaaaaa') });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'DELIVERY_NOT_READY' });
    const guidance = JSON.stringify(h.requests);
    expect(guidance).toContain(ITEM);
    expect(guidance).not.toMatch(/F1·[a-z2-7]{6}/u);
    expect(judge.calls).toHaveLength(0);
    expect(named(h.rpcs, 'cool_down_shared_knowledge_v1')).toHaveLength(0);
    // Used without being stated, the same reply commits with disclosed = false.
    const used = harness({ judge: new Judge(MENTION), names, output: 'القطار ممكن يكون أنسب.' });
    expect((await used.service.reply(request())).state).toBe('COMMITTED');
    expect(named(used.rpcs, 'complete_shared_world_qandeel_reply_v2')[0].body).toMatchObject({ p_disclosed: [false] });
  });

  it('a reasoning grant still ACTIVE but its disclosure grant not covering this audience: the item never reaches the model (the plain path)', async () => {
    const judge = new Judge(MENTION);
    const h = harness({ judge, output: 'تمام.', itemRow: () => ({ availability: 'AVAILABLE', current_content_digest: digestReasoningContent(ITEM), reasoning_grant_id: RG, disclosure_grant_id: DG,
      membership_episode_id: EPISODE, grant_content_digest: digestReasoningContent(ITEM), ceiling_user_ids: [HALA, MOHAMED, SARA], grant_state: 'ACTIVE', disclosure_status: 'REVOKED' }) });
    expect((await h.service.reply(request())).state).toBe('COMMITTED');
    expect(JSON.stringify(h.requests)).not.toContain(ITEM);
    expect(judge.calls).toHaveLength(0);
    expect(named(h.rpcs, 'complete_shared_world_qandeel_reply_v1')).toHaveLength(1);
    expect(named(h.rpcs, 'complete_shared_world_qandeel_reply_v2')).toHaveLength(0);
  });

  it('a span copied from another request (a forged ref) is withheld before any check', async () => {
    const judge = new Judge(MENTION);
    const h = harness({ judge, output: MENTIONING('F1·zzzzzz') });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'DELIVERY_NOT_READY' });
    expect(judge.calls).toHaveLength(0);
    expect(named(h.rpcs, 'cool_down_shared_knowledge_v1')).toHaveLength(0);
  });
});

describe('S8A-04 CP3 — without consented knowledge the reply is exactly what it was', () => {
  it.each([
    ['no item allowed here', { collector: [] }],
    ['no judge may run (production, no key)', { judge: null }],
    ['a collector row that is not exactly its shape', { collector: [collectorRow({ content_digest: digestReasoningContent('other words') })] }],
    ['two rows for one owner', { collector: [collectorRow(), collectorRow({ memory_id: SARA_MEMORY })] }],
  ])('%s: the frozen path, v1 commit, no judge, no member block', async (_name, options) => {
    const judge = new Judge(MENTION);
    const h = harness({ ...options, judge: 'judge' in options ? (options.judge as null) : judge, output: 'تمام، نشوف الاختيارين.' });
    expect(await h.service.reply(request())).toEqual({ state: 'COMMITTED', materialId: REPLY });
    expect(named(h.rpcs, 'complete_shared_world_qandeel_reply_v1')[0].body).toMatchObject({ p_reasoning_source_refs: [] });
    expect(named(h.rpcs, 'complete_shared_world_qandeel_reply_v2')).toHaveLength(0);
    expect(judge.calls).toHaveLength(0);
    expect(JSON.stringify(h.requests)).not.toContain('MEMBER KNOWLEDGE');
    expect(JSON.stringify(h.requests)).not.toContain(ITEM);
    if (!('judge' in options)) expect(named(h.rpcs, 'list_shared_knowledge_for_reply_v1')).toHaveLength(1);
    else expect(named(h.rpcs, 'list_shared_knowledge_for_reply_v1')).toHaveLength(0);
  });

  it('a collector that fails is no knowledge, never a refused reply', async () => {
    const broken = harness({ collector: [{ unexpected: true }], output: 'تمام.' });
    expect((await broken.service.reply(request())).state).toBe('COMMITTED');
    expect(named(broken.rpcs, 'complete_shared_world_qandeel_reply_v1')).toHaveLength(1);
  });

  it('the item\'s ceiling no longer covers the audience: not admitted, so not used', async () => {
    const h = harness({ collector: [collectorRow({ ceiling_user_ids: [HALA, MOHAMED] })], output: 'تمام.',
      itemRow: () => ({ availability: 'AVAILABLE', current_content_digest: digestReasoningContent(ITEM), reasoning_grant_id: RG, disclosure_grant_id: DG,
        membership_episode_id: EPISODE, grant_content_digest: digestReasoningContent(ITEM), ceiling_user_ids: [HALA, MOHAMED], grant_state: 'NEEDS_RECONFIRMATION', disclosure_status: 'ACTIVE' }) });
    expect((await h.service.reply(request())).state).toBe('COMMITTED');
    expect(JSON.stringify(h.requests)).not.toContain(ITEM);
    expect(named(h.rpcs, 'complete_shared_world_qandeel_reply_v1')).toHaveLength(1);
  });
});
