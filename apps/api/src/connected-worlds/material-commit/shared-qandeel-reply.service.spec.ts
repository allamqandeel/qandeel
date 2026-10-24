// S4-02 — the request-driven Shared QANDEEL reply, composed over the REAL frozen I-03 chain: the real EffectiveContext,
// the real Source Disclosure Gate, the real I-03F revalidator, the real readiness boundary and the real commit binder.
// Only the three service-role resolvers, the server channel and the generator are doubles.
import type { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import { SharedHumanAudienceResolverService, fingerprintSharedHumanAudience } from '../audience/shared-human-audience-resolver.service';
import type { StandingContextGrantResolverService } from '../authority-resolution/standing-context-grant-resolver.service';
import { SharedDeliveryAuthorityRevalidatorService, digestProviderOutput } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import { SharedEffectiveContextService } from '../effective-context/shared-effective-context.service';
import { SharedPreModelWorldStateResolverService, fingerprintSharedPreModelWorldState } from '../effective-context/shared-pre-model-world-state-resolver.service';
import type { SharedWorldId } from '../kernel/world.types';
import { SharedPrivacyAuthorityDeliveryReadinessService, fingerprintSharedPrivacyAuthorityDeliveryReadiness } from '../source-disclosure/shared-privacy-authority-delivery-readiness.service';
import { SharedSourceDisclosureGateService } from '../source-disclosure/shared-source-disclosure-gate.service';
import { SharedQandeelReplyService, type SharedQandeelReplyRequest } from './shared-qandeel-reply.service';
import type { SharedConversationMaterial, SharedQandeelReplyGenerator, SharedReplyGenerationInput } from './shared-qandeel-reply.types';
import { UnimplementedPrivateSourceState, UnimplementedSourceDisclosureDetector } from './shared-unavailable-private-context-boundaries';
import { SafetyResponseGateService } from '../../conversation/safety-response-gate.service';
import type { ModelRouter, ModelRouterRequest } from '../../model-router/model-router.types';
import { SharedConversationReplyGenerator } from '../../shared-world/shared-conversation-reply.generator';
import type { SharedKnowledgeRecallInput, SharedKnowledgeRecaller } from '../../shared-world/shared-knowledge-recall';

const WORLD = '10000000-0000-4000-8000-00000000000a';
const OTHER_WORLD = '10000000-0000-4000-8000-00000000000b';
const AMAL = '20000000-0000-4000-8000-000000000001';
const BASSEM = '20000000-0000-4000-8000-000000000002';
const COMMAND = '30000000-0000-4000-8000-000000000001';
const M_OLD = '40000000-0000-4000-8000-000000000001';
const M_HIDDEN = '40000000-0000-4000-8000-000000000002';
const M_NOW = '40000000-0000-4000-8000-000000000003';
const REPLY = '50000000-0000-4000-8000-000000000001';
const LEASE = '60000000-0000-4000-8000-000000000001';
/** Who wrote each fixture material, as the frozen 0089 resolver holds it. */
const AUTHORS: Record<string, string | null> = { [M_OLD]: BASSEM, [M_HIDDEN]: AMAL, [M_NOW]: AMAL };
const OUTPUT = 'أهلًا بكما. ما الذي يشغلكما اليوم؟';

const members = (episodeSuffix = '1') => [{ userId: AMAL, membershipEpisodeId: `60000000-0000-4000-8000-00000000000${episodeSuffix}` }, { userId: BASSEM, membershipEpisodeId: '60000000-0000-4000-8000-000000000009' }];
const audienceOf = (worldId: string, episodeSuffix = '1') => ({
  state: 'RESOLVED' as const,
  snapshot: { snapshotRef: fingerprintSharedHumanAudience({ state: 'RESOLVED', worldId, members: members(episodeSuffix) }), humans: [{ kind: 'HUMAN' as const, humanId: AMAL }, { kind: 'HUMAN' as const, humanId: BASSEM }] },
});

const VIEW: SharedConversationMaterial[] = [
  { materialId: M_NOW, producer: 'HUMAN', authorName: 'Amal', text: 'كيف حالكما؟', establishedAt: '2026-10-05T10:02:00.000000+00:00' },
  { materialId: M_HIDDEN, producer: 'HUMAN', authorName: 'Amal', text: 'granted to Amal alone', establishedAt: '2026-10-05T10:01:00.000000+00:00' },
  { materialId: M_OLD, producer: 'HUMAN', authorName: 'Bassem', text: 'Hello both', establishedAt: '2026-10-05T10:00:00.000000+00:00' },
];

interface Harness {
  service: SharedQandeelReplyService;
  generated: SharedReplyGenerationInput[];
  rpcs: { name: string; body: Record<string, unknown> }[];
  candidates: unknown[];
}

function harness(options: {
  lifecycle?: 'ACTIVE' | 'READ_ONLY_CLOSED';
  /** The audience the n-th audience resolution returns (1-based); default: the same audience every time. */
  audienceAt?: (call: number) => ReturnType<typeof audienceOf>;
  visibility?: Record<string, string[]>;
  generation?: () => Promise<{ state: 'GENERATED'; text: string } | { state: 'UNAVAILABLE' }>;
  commitRow?: (body: Record<string, unknown>) => unknown;
  begin?: () => unknown;
  /** S8A-04 CP2: the knowledge read's rows, and the generator in place of the double. */
  knowledge?: unknown[];
  generator?: SharedQandeelReplyGenerator;
} = {}): Harness {
  const worldState = {
    async resolveCurrent(worldId: SharedWorldId) {
      const lifecycle = options.lifecycle ?? 'ACTIVE';
      return { state: 'RESOLVED', snapshot: { worldId, lifecycle, phase: 'STANDARD', snapshotRef: fingerprintSharedPreModelWorldState({ worldId, lifecycle, phase: 'STANDARD' }) } };
    },
  } as unknown as SharedPreModelWorldStateResolverService;
  let audienceCalls = 0;
  const audience = {
    async resolveCurrent(worldId: SharedWorldId) {
      audienceCalls += 1;
      return options.audienceAt ? options.audienceAt(audienceCalls) : audienceOf(worldId);
    },
  } as unknown as SharedHumanAudienceResolverService;
  const grants = { async resolveCurrent() { throw new Error('no private candidate is ever offered, so no grant is ever resolved'); } } as unknown as StandingContextGrantResolverService;
  const candidates: unknown[] = [];
  const effective = new SharedEffectiveContextService(worldState, audience, grants);
  const resolve = effective.resolve.bind(effective);
  effective.resolve = async (worldId, offered) => { candidates.push(offered); return resolve(worldId, offered); };
  const revalidator = new SharedDeliveryAuthorityRevalidatorService(worldState, audience, grants, new UnimplementedPrivateSourceState());
  const readiness = new SharedPrivacyAuthorityDeliveryReadinessService(new SharedSourceDisclosureGateService(new UnimplementedSourceDisclosureDetector()), revalidator);
  const rpcs: Harness['rpcs'] = [];
  const visibility = options.visibility ?? { [AMAL]: [M_OLD, M_HIDDEN, M_NOW], [BASSEM]: [M_OLD, M_NOW] };
  const server = {
    async rpc(name: string, body: Record<string, unknown>) {
      // S8A-04 CP2 (2026-10-24): the reply also reads the World's knowledge (0175); this World holds none.
      if (name === 'list_shared_world_knowledge_v1') {
        rpcs.push({ name, body });
        return options.knowledge ?? [];
      }
      rpcs.push({ name, body });
      if (name === 'begin_shared_qandeel_reply_work_v1') {
        return [options.begin ? options.begin() : { work_outcome: 'GRANTED', work_lease_id: LEASE, reply_material_id: null }];
      }
      if (name === 'end_shared_qandeel_reply_work_v1') return true;
      if (name === 'resolve_shared_world_material_v1') {
        // S8A-02 CP1: the frozen resolver returns each material's author; the double returns the one each fixture has.
        return (visibility[body.p_user_id as string] ?? []).map((material_id) => ({ world_id: body.p_world_id, material_id, author_user_id: AUTHORS[material_id] }));
      }
      return [options.commitRow ? options.commitRow(body) : { outcome: 'MATERIAL_COMMITTED', material_id: REPLY, established_at: '2026-10-05T10:02:01Z' }];
    },
  } as unknown as SupabaseServiceRoleApiService;
  const generated: SharedReplyGenerationInput[] = [];
  const generator: SharedQandeelReplyGenerator = {
    async generate(input) {
      generated.push(input);
      if (options.generator) return options.generator.generate(input);
      return options.generation ? options.generation() : { state: 'GENERATED', text: OUTPUT };
    },
  };
  return { service: new SharedQandeelReplyService(effective, readiness, revalidator, audience, server, generator), generated, rpcs, candidates };
}

const request = (overrides: Partial<SharedQandeelReplyRequest> = {}): SharedQandeelReplyRequest => ({
  worldId: WORLD, humanCommandId: COMMAND, humanMaterialId: M_NOW, requesterUserId: AMAL, requesterView: VIEW, ...overrides,
});

describe('S4-02 Shared QANDEEL reply over the frozen chain', () => {
  it('commits ONE QANDEEL_OUTPUT bound to the exact World, the exact audience and the exact generated bytes', async () => {
    const h = harness();
    expect(await h.service.reply(request())).toEqual({ state: 'COMMITTED', materialId: REPLY });
    const commit = h.rpcs.find((r) => r.name === 'complete_shared_world_qandeel_reply_v1');
    expect(commit).toBeDefined();
    const body = commit!.body;
    expect(body.p_human_command_id).toBe(COMMAND);
    expect(body.p_world_id).toBe(WORLD);
    expect(body.p_body_text).toBe(OUTPUT);
    expect(body.p_output_digest).toBe(digestProviderOutput(OUTPUT));
    expect(body.p_audience_snapshot_ref).toBe(audienceOf(WORLD).snapshot.snapshotRef);
    expect(body.p_readiness_ref).toBe(fingerprintSharedPrivacyAuthorityDeliveryReadiness({
      effectiveContextRef: body.p_effective_context_ref as string, outputDigest: body.p_output_digest as string,
      sourceDisclosureGateRef: body.p_source_disclosure_gate_ref as string, authorityRevalidationRef: body.p_authority_revalidation_ref as string,
    }));
    expect(body.p_material_source_ids).toEqual([]);
    expect(body.p_reasoning_source_refs).toEqual([]);
    // Exactly the 0139 parameters: no kind, author, user, viewer or member list is ever sent.
    expect(Object.keys(body).sort()).toEqual(['p_audience_snapshot_ref', 'p_authority_revalidation_ref', 'p_body_text', 'p_effective_context_ref',
      'p_human_command_id', 'p_lease_id', 'p_material_source_ids', 'p_output_digest', 'p_readiness_ref', 'p_reasoning_source_refs',
      'p_source_disclosure_gate_ref', 'p_world_id']);
    // The commit is made under the lease the database granted, and the lease was asked for before anything else ran.
    expect(body.p_lease_id).toBe(LEASE);
    expect(h.rpcs[0]).toEqual({ name: 'begin_shared_qandeel_reply_work_v1', body: { p_human_command_id: COMMAND, p_world_id: WORLD, p_requester_user_id: AMAL } });
    expect(h.rpcs.at(-1)).toEqual({ name: 'end_shared_qandeel_reply_work_v1', body: { p_human_command_id: COMMAND, p_lease_id: LEASE } });
  });

  it('offers NO private candidate: Personal context never enters a Shared model call', async () => {
    const h = harness();
    await h.service.reply(request());
    expect(h.candidates).toEqual([[]]);
    expect(JSON.stringify(h.generated)).not.toMatch(/memory|hypothes|recommend|session/iu);
  });

  it('gives the model only what EVERY current recipient may see, oldest first, ending with the answered message', async () => {
    const h = harness();
    await h.service.reply(request());
    expect(h.generated).toHaveLength(1);
    expect(h.generated[0].conversation).toEqual([
      // S8A-02 CP1 (2026-10-22): each message carries request-local tokens of itself and of its trusted author, never an id.
      { producer: 'HUMAN', authorName: 'Bassem', text: 'Hello both', messageRef: 'M1', speakerRef: 'S1' },
      { producer: 'HUMAN', authorName: 'Amal', text: 'كيف حالكما؟', messageRef: 'M2', speakerRef: 'S2' },
    ]);
    expect(JSON.stringify(h.generated[0].conversation)).not.toContain('granted to Amal alone');
    expect(JSON.stringify(h.generated[0].conversation)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/u);
    expect(h.rpcs.filter((r) => r.name === 'resolve_shared_world_material_v1').map((r) => r.body.p_user_id).sort()).toEqual([AMAL, BASSEM].sort());
  });

  it('a deleted message is absent from the resolver, so it never reaches the model', async () => {
    const h = harness({ visibility: { [AMAL]: [M_NOW], [BASSEM]: [M_NOW] } });
    await h.service.reply(request());
    expect(h.generated[0].conversation).toEqual([{ producer: 'HUMAN', authorName: 'Amal', text: 'كيف حالكما؟', messageRef: 'M1', speakerRef: 'S1' }]);
  });

  it('a closed World generates nothing and commits nothing', async () => {
    const h = harness({ lifecycle: 'READ_ONLY_CLOSED' });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'CONTEXT_NOT_READY' });
    expect(h.generated).toHaveLength(0);
    // Only the lease was taken, and it was returned at once.
    expect(h.rpcs.map((r) => r.name)).toEqual(['begin_shared_qandeel_reply_work_v1', 'end_shared_qandeel_reply_work_v1']);
  });

  it('refuses when the answered message is not the newest visible human message (no reply to the wrong turn)', async () => {
    const h = harness();
    expect(await h.service.reply(request({ humanMaterialId: M_OLD }))).toEqual({ state: 'UNAVAILABLE', reason: 'HISTORY_UNRESOLVED' });
    expect(h.generated).toHaveLength(0);
  });

  it('a provider failure commits nothing and fabricates nothing', async () => {
    const h = harness({ generation: async () => ({ state: 'UNAVAILABLE' }) });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'GENERATION_UNAVAILABLE' });
    expect(h.rpcs.some((r) => r.name === 'complete_shared_world_qandeel_reply_v1')).toBe(false);
  });

  it('an audience that moved after generation is stale: the frozen revalidation refuses and nothing commits', async () => {
    // Calls 1 (EffectiveContext) see the old audience; the delivery-time revalidation sees a rejoin (a new episode).
    const h = harness({ audienceAt: (call) => (call === 1 ? audienceOf(WORLD) : audienceOf(WORLD, '2')) });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'DELIVERY_NOT_READY' });
    expect(h.rpcs.some((r) => r.name === 'complete_shared_world_qandeel_reply_v1')).toBe(false);
  });

  it('evidence for another World cannot bind: an audience fingerprint of another World is refused by the binder', async () => {
    // Revalidation stays current for THIS World, but the audience read at binding names another World.
    const h = harness({ audienceAt: (call) => (call <= 3 ? audienceOf(WORLD) : audienceOf(OTHER_WORLD)) });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'BINDING_REFUSED' });
    expect(h.rpcs.some((r) => r.name === 'complete_shared_world_qandeel_reply_v1')).toBe(false);
  });

  it('a STALE commit (the database saw the audience or a source move) is reported as such, never retried silently', async () => {
    const h = harness({ commitRow: () => ({ outcome: 'STALE', material_id: null, established_at: null }) });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'COMMIT_STALE' });
    expect(h.rpcs.filter((r) => r.name === 'complete_shared_world_qandeel_reply_v1')).toHaveLength(1);
  });

  it('no lease, no provider work: a generation already running for this command starts nothing', async () => {
    const h = harness({ begin: () => ({ work_outcome: 'IN_PROGRESS', work_lease_id: null, reply_material_id: null }) });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'WORK_IN_PROGRESS' });
    expect(h.generated).toHaveLength(0);
    expect(h.candidates).toHaveLength(0);
    expect(h.rpcs.map((r) => r.name)).toEqual(['begin_shared_qandeel_reply_work_v1']);
  });

  it('no lease, no provider work: a requester at the in-flight bound or out of budget starts nothing', async () => {
    const h = harness({ begin: () => ({ work_outcome: 'LIMITED', work_lease_id: null, reply_material_id: null }) });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'WORK_LIMITED' });
    expect(h.generated).toHaveLength(0);
    expect(h.rpcs.map((r) => r.name)).toEqual(['begin_shared_qandeel_reply_work_v1']);
  });

  it('the one reply already committed is the answer: nothing is generated again', async () => {
    const h = harness({ begin: () => ({ work_outcome: 'ALREADY_COMMITTED', work_lease_id: null, reply_material_id: REPLY }) });
    expect(await h.service.reply(request())).toEqual({ state: 'COMMITTED', materialId: REPLY });
    expect(h.generated).toHaveLength(0);
    expect(h.rpcs.map((r) => r.name)).toEqual(['begin_shared_qandeel_reply_work_v1']);
  });

  it('a refused or malformed lease answer starts nothing', async () => {
    for (const answer of [{ work_outcome: 'UNAVAILABLE', work_lease_id: null, reply_material_id: null }, { work_outcome: 'GRANTED', work_lease_id: 'nope', reply_material_id: null }]) {
      const h = harness({ begin: () => answer });
      expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'WORK_UNAVAILABLE' });
      expect(h.generated).toHaveLength(0);
    }
  });

  it('the lease is returned however generation ends — even when the generator throws', async () => {
    const h = harness({ generation: async () => { throw new Error('provider exploded'); } });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'COMMIT_REFUSED' });
    expect(h.rpcs.at(-1)).toEqual({ name: 'end_shared_qandeel_reply_work_v1', body: { p_human_command_id: COMMAND, p_lease_id: LEASE } });
    expect(h.rpcs.some((r) => r.name === 'complete_shared_world_qandeel_reply_v1')).toBe(false);
  });

  it('malformed requests are refused before any read', async () => {
    const h = harness();
    expect(await h.service.reply(request({ worldId: 'not-a-world' }))).toEqual({ state: 'UNAVAILABLE', reason: 'MALFORMED_REQUEST' });
    expect(h.rpcs).toHaveLength(0);
  });
});

describe('S4-02 fail-closed private-context boundaries', () => {
  it('the unimplemented detector and source-state never answer CLEAR / AVAILABLE', async () => {
    expect(await new UnimplementedSourceDisclosureDetector().assess({} as never)).toEqual({ state: 'UNRESOLVED', failure: 'DETECTOR_UNAVAILABLE' });
    expect(await new UnimplementedPrivateSourceState().resolveCurrent({} as never)).toEqual({ state: 'UNRESOLVED', failure: 'SOURCE_STATE_UNAVAILABLE' });
  });
});

// S8A-04 CP2 (2026-10-24): a position established long before the window reaches the reply, with its history and status —
// through the real generator, the real knowledge composition and a recall written by the test (zero provider calls).
describe('S8A-04 CP2 — the World’s knowledge in the Shared reply', () => {
  const placeId = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const row = (n: number, overrides: Record<string, unknown> = {}) => ({
    place_id: placeId(n), meaning: `موقف قديم رقم ${n} ${'و'.repeat(120)}`, nature: 'VIEW', absent_holder_label: null, hedged: false, standing: 'CURRENT',
    people: [{ role: 'HOLDER', user: AMAL, name: 'Amal' }], earlier_place_id: null, later_place_id: null, semantic_region: 'plans',
    committed_at: new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString(), ...overrides,
  });
  // Forty positions (over the 8 KB inline bound); Bassem's travel position was revised in February.
  const KNOWLEDGE = [
    ...Array.from({ length: 38 }, (_, index) => row(index + 3)),
    row(1, { meaning: 'Bassem is against travelling this summer', standing: 'SUPERSEDED', later_place_id: placeId(2), people: [{ role: 'HOLDER', user: BASSEM, name: 'Bassem' }], committed_at: '2026-01-02T00:00:00Z' }),
    row(2, { meaning: 'Bassem would travel if it is in August', hedged: true, earlier_place_id: placeId(1), people: [{ role: 'HOLDER', user: BASSEM, name: 'Bassem' }], committed_at: '2026-02-02T00:00:00Z' }),
  ];

  it('recall finds the old position beyond the window: the reply receives it as Bassem’s, uncertain, with the earlier one as history', async () => {
    const recalls: SharedKnowledgeRecallInput[] = [];
    const recaller: SharedKnowledgeRecaller = {
      async recall(input) {
        recalls.push(input);
        return { refs: input.knowledge.filter((entry) => entry.meaning.startsWith('Bassem')).map((entry) => entry.ref) };
      },
    };
    const requests: ModelRouterRequest[] = [];
    const router = { generate: jest.fn(async (body: ModelRouterRequest) => { requests.push(body); return { content: OUTPUT }; }) } as unknown as ModelRouter;
    const h = harness({ knowledge: KNOWLEDGE, generator: new SharedConversationReplyGenerator(router, new SafetyResponseGateService(), recaller) });
    const outcome = await h.service.reply(request());
    expect(outcome).toEqual({ state: 'COMMITTED', materialId: REPLY, recalledPlaceIds: [placeId(2)] });
    expect(h.rpcs.find((call) => call.name === 'list_shared_world_knowledge_v1')?.body).toEqual({ p_world_id: WORLD, p_viewer_user_id: AMAL });
    expect(recalls).toHaveLength(1);
    // The SUPERSEDED position is never an entry of its own.
    expect(recalls[0].knowledge.filter((entry) => entry.meaning.startsWith('Bassem'))).toEqual([expect.objectContaining({ heldBy: ['Bassem'], current: true, uncertain: true })]);
    const guidance = requests[0].behavioralGuidance;
    const block = /<world_knowledge>(.*)<\/world_knowledge>/su.exec(guidance)?.[1] as string;
    expect(JSON.parse(block)).toEqual([{
      kind: 'view', heldBy: ['Bassem'], relayedBy: [], about: [], uncertain: true, since: '2026-02', current: true, meaning: 'Bassem would travel if it is in August',
      earlier: [{ since: '2026-01', kind: 'view', uncertain: false, meaning: 'Bassem is against travelling this summer' }],
    }]);
    // No identity reaches the provider.
    expect(JSON.stringify(requests[0])).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}/u);
    expect(JSON.stringify(recalls[0])).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}/u);
  });

  it('a knowledge read that fails or is malformed is no knowledge: the reply still commits', async () => {
    for (const knowledge of [[{ place_id: 'not a place' }], 'rows' as unknown as unknown[]]) {
      const h = harness({ knowledge });
      expect(await h.service.reply(request())).toEqual({ state: 'COMMITTED', materialId: REPLY });
      expect(h.generated[0].knowledge).toEqual([]);
    }
  });
});
