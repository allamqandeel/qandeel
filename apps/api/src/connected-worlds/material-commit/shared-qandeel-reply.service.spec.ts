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

const WORLD = '10000000-0000-4000-8000-00000000000a';
const OTHER_WORLD = '10000000-0000-4000-8000-00000000000b';
const AMAL = '20000000-0000-4000-8000-000000000001';
const BASSEM = '20000000-0000-4000-8000-000000000002';
const COMMAND = '30000000-0000-4000-8000-000000000001';
const M_OLD = '40000000-0000-4000-8000-000000000001';
const M_HIDDEN = '40000000-0000-4000-8000-000000000002';
const M_NOW = '40000000-0000-4000-8000-000000000003';
const REPLY = '50000000-0000-4000-8000-000000000001';
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
      rpcs.push({ name, body });
      if (name === 'resolve_shared_world_material_v1') {
        return (visibility[body.p_user_id as string] ?? []).map((material_id) => ({ world_id: body.p_world_id, material_id }));
      }
      return [options.commitRow ? options.commitRow(body) : { outcome: 'MATERIAL_COMMITTED', material_id: REPLY, established_at: '2026-10-05T10:02:01Z' }];
    },
  } as unknown as SupabaseServiceRoleApiService;
  const generated: SharedReplyGenerationInput[] = [];
  const generator: SharedQandeelReplyGenerator = {
    async generate(input) {
      generated.push(input);
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
    const commit = h.rpcs.find((r) => r.name === 'commit_shared_world_qandeel_reply_v1');
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
      'p_human_command_id', 'p_material_source_ids', 'p_output_digest', 'p_readiness_ref', 'p_reasoning_source_refs',
      'p_source_disclosure_gate_ref', 'p_world_id']);
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
      { producer: 'HUMAN', authorName: 'Bassem', text: 'Hello both' },
      { producer: 'HUMAN', authorName: 'Amal', text: 'كيف حالكما؟' },
    ]);
    expect(JSON.stringify(h.generated[0].conversation)).not.toContain('granted to Amal alone');
    expect(JSON.stringify(h.generated[0].conversation)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/u);
    expect(h.rpcs.filter((r) => r.name === 'resolve_shared_world_material_v1').map((r) => r.body.p_user_id).sort()).toEqual([AMAL, BASSEM].sort());
  });

  it('a deleted message is absent from the resolver, so it never reaches the model', async () => {
    const h = harness({ visibility: { [AMAL]: [M_NOW], [BASSEM]: [M_NOW] } });
    await h.service.reply(request());
    expect(h.generated[0].conversation).toEqual([{ producer: 'HUMAN', authorName: 'Amal', text: 'كيف حالكما؟' }]);
  });

  it('a closed World generates nothing and commits nothing', async () => {
    const h = harness({ lifecycle: 'READ_ONLY_CLOSED' });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'CONTEXT_NOT_READY' });
    expect(h.generated).toHaveLength(0);
    expect(h.rpcs).toHaveLength(0);
  });

  it('refuses when the answered message is not the newest visible human message (no reply to the wrong turn)', async () => {
    const h = harness();
    expect(await h.service.reply(request({ humanMaterialId: M_OLD }))).toEqual({ state: 'UNAVAILABLE', reason: 'HISTORY_UNRESOLVED' });
    expect(h.generated).toHaveLength(0);
  });

  it('a provider failure commits nothing and fabricates nothing', async () => {
    const h = harness({ generation: async () => ({ state: 'UNAVAILABLE' }) });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'GENERATION_UNAVAILABLE' });
    expect(h.rpcs.some((r) => r.name === 'commit_shared_world_qandeel_reply_v1')).toBe(false);
  });

  it('an audience that moved after generation is stale: the frozen revalidation refuses and nothing commits', async () => {
    // Calls 1 (EffectiveContext) see the old audience; the delivery-time revalidation sees a rejoin (a new episode).
    const h = harness({ audienceAt: (call) => (call === 1 ? audienceOf(WORLD) : audienceOf(WORLD, '2')) });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'DELIVERY_NOT_READY' });
    expect(h.rpcs.some((r) => r.name === 'commit_shared_world_qandeel_reply_v1')).toBe(false);
  });

  it('evidence for another World cannot bind: an audience fingerprint of another World is refused by the binder', async () => {
    // Revalidation stays current for THIS World, but the audience read at binding names another World.
    const h = harness({ audienceAt: (call) => (call <= 3 ? audienceOf(WORLD) : audienceOf(OTHER_WORLD)) });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'BINDING_REFUSED' });
    expect(h.rpcs.some((r) => r.name === 'commit_shared_world_qandeel_reply_v1')).toBe(false);
  });

  it('a STALE commit (the database saw the audience or a source move) is reported as such, never retried silently', async () => {
    const h = harness({ commitRow: () => ({ outcome: 'STALE', material_id: null, established_at: null }) });
    expect(await h.service.reply(request())).toEqual({ state: 'UNAVAILABLE', reason: 'COMMIT_STALE' });
    expect(h.rpcs.filter((r) => r.name === 'commit_shared_world_qandeel_reply_v1')).toHaveLength(1);
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
