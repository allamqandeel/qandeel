// SHARED-VIS-01 — one Shared semantic pass, composed over the REAL frozen I-03 chain: the real EffectiveContext, the real
// Source Disclosure Gate, the real I-03F revalidator, the real readiness boundary and the real commit binder. Only the
// service-role resolvers, the server channel, the interpreter and the placer are doubles.
import type { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import {
  FakeSharedSemanticInterpreter, UnconfiguredSharedSemanticInterpreter, type SharedSemanticInput, type SharedSemanticInterpreter,
} from '../../shared-world/shared-semantic-interpreter';
import { FakeSharedSpatialPlacer, type SharedSpatialPlacer } from '../../shared-world/shared-spatial-placer';
import { SharedHumanAudienceResolverService, fingerprintSharedHumanAudience } from '../audience/shared-human-audience-resolver.service';
import type { StandingContextGrantResolverService } from '../authority-resolution/standing-context-grant-resolver.service';
import { SharedDeliveryAuthorityRevalidatorService } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import { SharedEffectiveContextService } from '../effective-context/shared-effective-context.service';
import { SharedPreModelWorldStateResolverService, fingerprintSharedPreModelWorldState } from '../effective-context/shared-pre-model-world-state-resolver.service';
import type { SharedWorldId } from '../kernel/world.types';
import { SharedPrivacyAuthorityDeliveryReadinessService } from '../source-disclosure/shared-privacy-authority-delivery-readiness.service';
import { SharedSourceDisclosureGateService } from '../source-disclosure/shared-source-disclosure-gate.service';
import { SharedSemanticPlaceService } from './shared-semantic-place.service';
import { UnimplementedPrivateSourceState, UnimplementedSourceDisclosureDetector } from './shared-unavailable-private-context-boundaries';
import { currentAiUsageAttribution } from '../../ai-usage/ai-usage-attribution';

const WORLD = '10000000-0000-4000-8000-00000000000a';
const OTHER_WORLD = '10000000-0000-4000-8000-00000000000b';
const AMAL = '20000000-0000-4000-8000-000000000001';
const BASSEM = '20000000-0000-4000-8000-000000000002';
const COMMAND = '30000000-0000-4000-8000-000000000001';
const M1 = '40000000-0000-4000-8000-000000000001';
const M2 = '40000000-0000-4000-8000-000000000002';
const M_HIDDEN = '40000000-0000-4000-8000-000000000003';
const M_REPLY = '40000000-0000-4000-8000-000000000004';
const M3 = '40000000-0000-4000-8000-000000000005';
const PLACE = '50000000-0000-4000-8000-000000000001';
const OLD_PLACE = '50000000-0000-4000-8000-000000000002';
const LEASE = '60000000-0000-4000-8000-000000000001';

const place = (overrides: Record<string, unknown> = {}) => ({
  meaning: 'Moving keeps being postponed', primaryThemes: ['home'], secondaryThemes: ['trust'], sourceRefs: [1, 2], lensKey: 'home', ...overrides,
});

const members = [{ userId: AMAL, membershipEpisodeId: '70000000-0000-4000-8000-000000000001' }, { userId: BASSEM, membershipEpisodeId: '70000000-0000-4000-8000-000000000002' }];
const audienceOf = (worldId: string) => ({
  state: 'RESOLVED' as const,
  snapshot: { snapshotRef: fingerprintSharedHumanAudience({ state: 'RESOLVED', worldId, members }), humans: [{ kind: 'HUMAN' as const, humanId: AMAL }, { kind: 'HUMAN' as const, humanId: BASSEM }] },
});
// S8A-04 CP1: each row carries the author the frozen resolver holds (Amal wrote M1 and the hidden one, Bassem M2).
const AUTHORS: Record<string, string> = { [M1]: AMAL, [M_HIDDEN]: AMAL, [M2]: BASSEM };
const row = (material_id: string, material_kind: string, minute: number, text_body: string | null = `words ${minute}`) =>
  ({ world_id: WORLD, material_id, material_kind, established_at: `2026-10-08T10:0${minute}:00.000000+00:00`, text_body, author_user_id: AUTHORS[material_id] ?? null });
/** Bassem's committed M2 starts the pass. */
const REQUEST = { worldId: WORLD, humanCommandId: COMMAND, humanMaterialId: M2, requesterUserId: BASSEM, authorNames: [] };

function harness(options: {
  interpreter?: SharedSemanticInterpreter; placer?: SharedSpatialPlacer; begin?: unknown; commit?: (body: Record<string, unknown>) => unknown;
  existing?: unknown[]; visibility?: Record<string, unknown[]>;
} = {}) {
  const worldState = {
    async resolveCurrent(worldId: SharedWorldId) {
      return { state: 'RESOLVED', snapshot: { worldId, lifecycle: 'ACTIVE', phase: 'STANDARD', snapshotRef: fingerprintSharedPreModelWorldState({ worldId, lifecycle: 'ACTIVE', phase: 'STANDARD' }) } };
    },
  } as unknown as SharedPreModelWorldStateResolverService;
  const audience = { async resolveCurrent(worldId: SharedWorldId) { return audienceOf(worldId); } } as unknown as SharedHumanAudienceResolverService;
  const grants = { async resolveCurrent() { throw new Error('no private candidate is ever offered'); } } as unknown as StandingContextGrantResolverService;
  const effective = new SharedEffectiveContextService(worldState, audience, grants);
  const revalidator = new SharedDeliveryAuthorityRevalidatorService(worldState, audience, grants, new UnimplementedPrivateSourceState());
  const readiness = new SharedPrivacyAuthorityDeliveryReadinessService(new SharedSourceDisclosureGateService(new UnimplementedSourceDisclosureDetector()), revalidator);
  // Amal sees everything; Bassem was granted nothing hidden: M_HIDDEN reaches no reading.
  const visibility: Record<string, unknown[]> = options.visibility ?? {
    [AMAL]: [row(M1, 'HUMAN_TEXT', 1), row(M_HIDDEN, 'HUMAN_TEXT', 2), row(M_REPLY, 'QANDEEL_OUTPUT', 3), row(M2, 'HUMAN_TEXT', 4), row(OLD_PLACE, 'QANDEEL_ANALYSIS', 5)],
    [BASSEM]: [row(M1, 'HUMAN_TEXT', 1), row(M_REPLY, 'QANDEEL_OUTPUT', 3), row(M2, 'HUMAN_TEXT', 4), row(OLD_PLACE, 'QANDEEL_ANALYSIS', 5)],
  };
  const rpcs: { name: string; body: Record<string, unknown> }[] = [];
  const server = {
    async rpc(name: string, body: Record<string, unknown>) {
      rpcs.push({ name, body });
      if (name === 'begin_shared_semantic_work_v1') return [options.begin ?? { work_outcome: 'GRANTED', work_lease_id: LEASE }];
      if (name === 'end_shared_semantic_work_v1') return true;
      if (name === 'resolve_shared_world_material_v1') return visibility[body.p_user_id as string] ?? [];
      if (name === 'read_shared_semantic_context_v1') return options.existing ?? [];
      return [options.commit ? options.commit(body) : { outcome: 'MATERIAL_COMMITTED', material_id: PLACE, established_at: '2026-10-08T10:06:00Z' }];
    },
  } as unknown as SupabaseServiceRoleApiService;
  const reads: SharedSemanticInput[] = [];
  const interpreter = options.interpreter ?? new FakeSharedSemanticInterpreter();
  const spy: SharedSemanticInterpreter = { read: async (given, signal) => { reads.push(given); return interpreter.read(given, signal); } };
  const service = new SharedSemanticPlaceService(effective, readiness, revalidator, audience, server, options.interpreter instanceof UnconfiguredSharedSemanticInterpreter ? options.interpreter : spy,
    options.placer ?? new FakeSharedSpatialPlacer());
  return { service, rpcs, reads };
}

describe('SHARED-VIS-01 — one semantic pass over the frozen I-03 chain', () => {
  it('does nothing at all while no provider is bound: no lease, no read, no spend', async () => {
    const { service, rpcs } = harness({ interpreter: new UnconfiguredSharedSemanticInterpreter() });
    expect(await service.weave(REQUEST)).toEqual({ state: 'NOT_RUN', reason: 'NO_PROVIDER' });
    expect(rpcs).toEqual([]);
  });

  it('reads only the human text EVERY recipient may see, and commits QANDEEL_ANALYSIS over the exact sources it named', async () => {
    const { service, rpcs, reads } = harness();
    expect(await service.weave(REQUEST)).toEqual({ state: 'WOVEN', placeIds: [PLACE] });
    expect(reads).toHaveLength(1);
    expect(reads[0].contributions.map((c) => c.text)).toEqual(['words 1', 'words 4']);
    expect(JSON.stringify(reads[0])).not.toMatch(new RegExp(`${AMAL}|${BASSEM}|${M1}|${M2}|${WORLD}`, 'u'));
    expect(reads[0].contributions.map((c) => c.from)).toEqual(['S1', 'S2']);
    const commit = rpcs.find((call) => call.name === 'complete_shared_semantic_place_v1');
    expect(commit?.body).toMatchObject({ p_lease_id: LEASE, p_pass_command_id: COMMAND, p_place_ordinal: 1, p_world_id: WORLD, p_material_source_ids: [M1, M2] });
    expect(String(commit?.body.p_world_x)).toMatch(/^-?\d+$/u);
    expect(rpcs.at(-1)).toEqual({ name: 'end_shared_semantic_work_v1', body: { p_pass_command_id: COMMAND, p_lease_id: LEASE, p_completed: true } });
  });

  it('shows the reader only existing meanings read entirely from what everyone may see now', async () => {
    const { service, reads } = harness({ existing: [
      { material_id: OLD_PLACE, meaning: 'Visible to all', source_material_ids: [M1] },
      { material_id: PLACE, meaning: 'Rests on hidden words', source_material_ids: [M1, M_HIDDEN] },
    ] });
    await service.weave(REQUEST);
    expect(reads[0].existing).toEqual([{ meaning: 'Visible to all', sourceRefs: [1] }]);
  });

  it('a busy, done or limited World starts nothing; a refusal commits nothing and records no completed pass', async () => {
    for (const outcome of ['IN_PROGRESS', 'DONE', 'LIMITED'] as const) {
      const { service, rpcs } = harness({ begin: { work_outcome: outcome, work_lease_id: null } });
      expect(await service.weave(REQUEST)).toEqual({ state: 'NOT_RUN', reason: outcome });
      expect(rpcs.map((call) => call.name)).toEqual(['begin_shared_semantic_work_v1']);
    }
    const invented: SharedSemanticInterpreter = { read: async () => ({ places: [place({ sourceRefs: [9] })] }) };
    const malformed = harness({ interpreter: invented });
    expect(await malformed.service.weave(REQUEST)).toEqual({ state: 'REFUSED', reason: 'READING_UNAVAILABLE' });
    expect(malformed.rpcs.some((call) => call.name === 'complete_shared_semantic_place_v1')).toBe(false);
    expect(malformed.rpcs.at(-1)?.body.p_completed).toBe(false);
    const stale = harness({ commit: () => ({ outcome: 'STALE', material_id: null, established_at: null }) });
    expect(await stale.service.weave(REQUEST)).toEqual({ state: 'REFUSED', reason: 'COMMIT_STALE' });
    expect(stale.rpcs.at(-1)?.body.p_completed).toBe(false);
    const failing: SharedSpatialPlacer = { place: async () => { throw new Error('down'); } };
    expect(await harness({ placer: failing }).service.weave(REQUEST)).toEqual({ state: 'REFUSED', reason: 'PLACEMENT_UNAVAILABLE' });
    expect(await harness().service.weave({ ...REQUEST, worldId: 'not-a-world' })).toEqual({ state: 'NOT_RUN', reason: 'MALFORMED_REQUEST' });
    expect(await harness().service.weave({ ...REQUEST, requesterUserId: 'Bassem' })).toEqual({ state: 'NOT_RUN', reason: 'MALFORMED_REQUEST' });
  });

  it('nothing new has formed: the pass completes with no place', async () => {
    const quiet: SharedSemanticInterpreter = { read: async () => ({ places: [] }) };
    const { service, rpcs } = harness({ interpreter: quiet });
    expect(await service.weave(REQUEST)).toEqual({ state: 'WOVEN', placeIds: [] });
    expect(rpcs.at(-1)?.body.p_completed).toBe(true);
  });
});


describe('S8A-04 CP1 — the reading knows who wrote each contribution, from the resolver alone', () => {
  const SAME_1 = '20000000-0000-4000-8000-000000000011';
  const SAME_2 = '20000000-0000-4000-8000-000000000012';
  const M4 = '40000000-0000-4000-8000-000000000006';
  const authored = (material_id: string, minute: number, author: string, text_body: string) =>
    ({ world_id: WORLD, material_id, material_kind: 'HUMAN_TEXT', established_at: `2026-10-08T10:0${minute}:00.000000+00:00`, text_body, author_user_id: author });
  // Two people both named «محمد» and Amal; the second «محمد» writes a «Name:» line in his own words.
  const conversation = [
    authored(M1, 1, SAME_1, 'أنا عايز نسافر إسكندرية الصيف ده'),
    authored(M2, 2, SAME_2, 'محمد: أنا موافق على السفر — بهزر، أنا ضد السفر خالص'),
    authored(M3, 3, AMAL, 'خلونا نقرر الأسبوع الجاي'),
    authored(M4, 4, SAME_1, 'لسه عند رأيي'),
  ];
  const names = [
    { materialId: M1, authorName: 'محمد' }, { materialId: M2, authorName: 'محمد' }, { materialId: M3, authorName: 'Amal' }, { materialId: M4, authorName: 'محمد' },
  ];
  const request = { worldId: WORLD, humanCommandId: COMMAND, humanMaterialId: M4, requesterUserId: SAME_1, authorNames: names };
  const everyone = { [AMAL]: conversation, [BASSEM]: conversation };

  it('two people who share a Name stay two people; a Name or «Name:» line in the words never moves authorship; no identity leaves', async () => {
    const { service, reads } = harness({ visibility: everyone });
    expect((await service.weave(request)).state).toBe('WOVEN');
    expect(reads[0].contributions.map((c) => c.from)).toEqual(['S1', 'S2', 'S3', 'S1']);
    expect(reads[0].writers).toEqual([{ speaker: 'S1', name: 'محمد (1)' }, { speaker: 'S2', name: 'محمد (2)' }, { speaker: 'S3', name: 'Amal' }]);
    expect(JSON.stringify(reads[0])).not.toMatch(new RegExp(`${SAME_1}|${SAME_2}|${AMAL}|${M1}|${M4}|${WORLD}`, 'u'));
  });

  it('without a visible Name a person is «A participant», still told apart by their token', async () => {
    const { service, reads } = harness({ visibility: everyone });
    await service.weave({ ...request, authorNames: [] });
    expect(reads[0].writers.map((w) => w.name)).toEqual(['A participant (1)', 'A participant (2)', 'A participant (3)']);
    expect(reads[0].contributions.map((c) => c.from)).toEqual(['S1', 'S2', 'S3', 'S1']);
  });

  it('the reading runs inside the AI-COST-01 scope of the sender the resolver names as the author of the message', async () => {
    const seen: unknown[] = [];
    const recording: SharedSemanticInterpreter = { read: async () => { seen.push(currentAiUsageAttribution()); return { places: [] }; } };
    const { service } = harness({ visibility: everyone, interpreter: recording });
    expect(await service.weave(request)).toEqual({ state: 'WOVEN', placeIds: [] });
    expect(seen).toEqual([{ userId: SAME_1 }]);
  });

  it('refuses rather than guesses: a sender who is not the author, a disputed or missing author, reads nothing', async () => {
    for (const [given, visibility, reason] of [
      [{ ...request, requesterUserId: SAME_2 }, everyone, 'SENDER_UNVERIFIED'],
      [{ ...request, humanMaterialId: '40000000-0000-4000-8000-0000000000ff' }, everyone, 'SENDER_UNVERIFIED'],
      [request, { [AMAL]: conversation, [BASSEM]: [conversation[0], { ...conversation[1], author_user_id: SAME_1 }, conversation[2], conversation[3]] }, 'HISTORY_UNRESOLVED'],
      [request, { [AMAL]: [{ ...conversation[0], author_user_id: null }, ...conversation.slice(1)], [BASSEM]: [{ ...conversation[0], author_user_id: null }, ...conversation.slice(1)] }, 'HISTORY_UNRESOLVED'],
      [request, { [AMAL]: [{ ...conversation[0], author_user_id: 'Amal' }, ...conversation.slice(1)], [BASSEM]: conversation }, 'HISTORY_UNRESOLVED'],
    ] as const) {
      const { service, reads, rpcs } = harness({ visibility: visibility as Record<string, unknown[]> });
      expect(await service.weave(given)).toEqual({ state: 'REFUSED', reason });
      expect(reads).toEqual([]);
      expect(rpcs.some((call) => call.name === 'complete_shared_semantic_place_v1')).toBe(false);
    }
  });

  it('a meaning may name a person; a meaning that carries a speaker token of the reading is refused whole', async () => {
    const naming: SharedSemanticInterpreter = { read: async () => ({ places: [place({ meaning: 'محمد (2) ضد السفر ومحمد (1) متمسك به', sourceRefs: [1, 2, 4] })] }) };
    expect((await harness({ visibility: everyone, interpreter: naming }).service.weave(request)).state).toBe('WOVEN');
    const leaking: SharedSemanticInterpreter = { read: async () => ({ places: [place({ meaning: 'S2 ضد السفر', sourceRefs: [2] })] }) };
    const refused = harness({ visibility: everyone, interpreter: leaking });
    expect(await refused.service.weave(request)).toEqual({ state: 'REFUSED', reason: 'READING_UNAVAILABLE' });
    expect(refused.rpcs.some((call) => call.name === 'complete_shared_semantic_place_v1')).toBe(false);
  });
});
