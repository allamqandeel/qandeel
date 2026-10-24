// SHARED-VIS-01 — one Shared semantic pass, composed over the REAL frozen I-03 chain: the real EffectiveContext, the real
// Source Disclosure Gate, the real I-03F revalidator, the real readiness boundary and the real commit binder. Only the
// service-role resolvers, the server channel, the interpreter and the placer are doubles.
//
// S8A-04 CP2 (2026-10-24, re-anchored): the pass reads the attributed context (0175 v2), writes through the atomic V2
// command, and places through ONE placement call whose anchors the server's geometry turns into a point. The fixtures carry
// the V2 attribution; the CP1 assertions stand, except where CP2 narrows them (each says so).
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
  meaning: 'Moving keeps being postponed', primaryThemes: ['home'], secondaryThemes: ['trust'], sourceRefs: [1, 2], lensKey: 'home',
  nature: 'VIEW', holders: ['S1', 'S2'], relayedBy: [], about: [], hedged: false, ...overrides,
});
/** S8A-04 CP2: one saved position as the attributed context (0175 `read_shared_semantic_context_v2`) returns it. */
const saved = (material_id: string, overrides: Record<string, unknown> = {}) => ({
  material_id, meaning: 'Visible to all', nature: 'VIEW', absent_holder_label: null, hedged: false, standing: 'CURRENT',
  people: [{ role: 'HOLDER', user: AMAL, name: 'Amal' }], earlier_place_id: null, later_place_id: null, source_material_ids: [M1],
  primary_themes: ['home'], semantic_region: 'home', world_x: '0', world_y: '0', committed_at: '2026-10-08T10:05:00Z', ...overrides,
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
      if (name === 'read_shared_semantic_context_v2') return options.existing ?? [];
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
    const commit = rpcs.find((call) => call.name === 'complete_shared_semantic_place_v2');
    expect(commit?.body).toMatchObject({ p_lease_id: LEASE, p_pass_command_id: COMMAND, p_place_ordinal: 1, p_world_id: WORLD, p_material_source_ids: [M1, M2] });
    expect(String(commit?.body.p_world_x)).toMatch(/^-?\d+$/u);
    expect(rpcs.at(-1)).toEqual({ name: 'end_shared_semantic_work_v1', body: { p_pass_command_id: COMMAND, p_lease_id: LEASE, p_completed: true } });
  });

  it('shows the reader only existing meanings read entirely from what everyone may see now', async () => {
    // S8A-04 CP2 (re-anchored): the existing meaning carries its ref and attribution in this reading's tokens.
    const { service, reads } = harness({ existing: [
      saved(OLD_PLACE),
      saved(PLACE, { meaning: 'Rests on hidden words', source_material_ids: [M1, M_HIDDEN] }),
    ] });
    await service.weave(REQUEST);
    expect(reads[0].existing).toEqual([{
      ref: 'E1', meaning: 'Visible to all', nature: 'VIEW', holders: ['S1'], absentHolder: null, relayedBy: [], about: [], hedged: false, sourceRefs: [1],
    }]);
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
    expect(malformed.rpcs.some((call) => call.name === 'complete_shared_semantic_place_v2')).toBe(false);
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
    // S8A-04 CP2 (re-anchored, §5): the scope also correlates the spend with the World and the sender's message.
    expect(seen).toEqual([{ userId: SAME_1, sourceWorldId: WORLD, sourceSharedMaterialId: M4 }]);
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
      expect(rpcs.some((call) => call.name === 'complete_shared_semantic_place_v2')).toBe(false);
    }
  });

  it('a meaning may name a person; a meaning that carries a speaker token of the reading is refused whole', async () => {
    // S8A-04 CP2 (re-anchored, M1): a meaning names a person by Name; a numbered label this reading sent («محمد (2)») is
    // request-local and is now refused whole, like a token.
    const naming: SharedSemanticInterpreter = { read: async () => ({ places: [place({ meaning: 'محمد ضد السفر ومحمد التاني متمسك به', sourceRefs: [1, 2, 4], holders: ['S1'] })] }) };
    expect(await harness({ visibility: everyone, interpreter: naming }).service.weave(request)).toEqual({ state: 'WOVEN', placeIds: [PLACE] });
    const labelled: SharedSemanticInterpreter = { read: async () => ({ places: [place({ meaning: 'محمد (2) ضد السفر', sourceRefs: [2], holders: ['S2'] })] }) };
    expect(await harness({ visibility: everyone, interpreter: labelled }).service.weave(request)).toEqual({ state: 'REFUSED', reason: 'READING_UNAVAILABLE' });
    const leaking: SharedSemanticInterpreter = { read: async () => ({ places: [place({ meaning: 'S2 ضد السفر', sourceRefs: [2], holders: ['S2'] })] }) };
    const refused = harness({ visibility: everyone, interpreter: leaking });
    expect(await refused.service.weave(request)).toEqual({ state: 'REFUSED', reason: 'READING_UNAVAILABLE' });
    expect(refused.rpcs.some((call) => call.name === 'complete_shared_semantic_place_v2')).toBe(false);
  });
});


describe('S8A-04 CP2 — the saved position: whose it is, written whole, placed by its anchors', () => {
  const MONA = AMAL;
  const MORAD = BASSEM;
  const AHMED = '20000000-0000-4000-8000-000000000003';
  const commitOf = (rpcs: { name: string; body: Record<string, unknown> }[]) => rpcs.filter((call) => call.name === 'complete_shared_semantic_place_v2');

  it('maps every token to the identity the server derived it from: a direct view, and N3 (an absent holder, relayed)', async () => {
    const reading: SharedSemanticInterpreter = { read: async () => ({ places: [
      place({ meaning: 'السفر مناسب', sourceRefs: [1], holders: ['S1'] }),
      place({ meaning: 'مش موافقة على السفر', sourceRefs: [2], holders: [], absentHolder: 'والدة مراد', relayedBy: ['S2'], lensKey: 'family' }),
    ] }) };
    const { service, rpcs } = harness({ interpreter: reading });
    expect((await service.weave(REQUEST)).state).toBe('WOVEN');
    const [direct, relayed] = commitOf(rpcs).map((call) => call.body);
    expect(direct).toMatchObject({ p_nature: 'VIEW', p_holder_user_ids: [MONA], p_absent_holder_label: null, p_relayer_user_ids: [], p_revises_place_id: null });
    // The numbered labels this reading sent go to the write, which refuses a meaning that carries one.
    expect(direct.p_reading_labels).toEqual(['A participant (1)', 'A participant (2)']);
    expect(relayed).toMatchObject({ p_holder_user_ids: [], p_absent_holder_label: 'والدة مراد', p_relayer_user_ids: [MORAD], p_material_source_ids: [M2] });
    for (const body of [direct, relayed]) expect(JSON.stringify(body)).not.toMatch(/"S\d+"/u);
  });

  it('F1 (2026-10-25): a place held by more than one member is never saved; the reading’s other places are', async () => {
    // The server cannot prove that one meaning is jointly held, so it keeps no place that would mix one person's view
    // with another's. A single holder, and an absent holder relayed by a member, are kept.
    const reading: SharedSemanticInterpreter = { read: async () => ({ places: [
      place({ meaning: 'رأي منى ومراد في السفر', sourceRefs: [1, 2], holders: ['S1', 'S2'] }),
      place({ meaning: 'السفر مناسب', sourceRefs: [1], holders: ['S1'] }),
      place({ meaning: 'مش موافقة على السفر', sourceRefs: [2], holders: [], absentHolder: 'والدة مراد', relayedBy: ['S2'], lensKey: 'family' }),
    ] }) };
    const kept = harness({ interpreter: reading });
    expect((await kept.service.weave(REQUEST)).state).toBe('WOVEN');
    const bodies = commitOf(kept.rpcs).map((call) => call.body);
    expect(bodies.map((body) => body.p_holder_user_ids)).toEqual([[MONA], []]);
    expect(JSON.stringify(bodies)).not.toContain('رأي منى ومراد');
    // A reading whose every place is jointly held saves nothing: the pass completes with no place.
    const joint: SharedSemanticInterpreter = { read: async () => ({ places: [place({ holders: ['S1', 'S2'] })] }) };
    const none = harness({ interpreter: joint });
    expect(await none.service.weave(REQUEST)).toEqual({ state: 'WOVEN', placeIds: [] });
    expect(commitOf(none.rpcs)).toEqual([]);
    expect(none.rpcs.at(-1)?.body.p_completed).toBe(true);
  });

  it('refuses the whole reading on any attribution rule, and writes nothing', async () => {
    for (const broken of [
      place({ holders: [], relayedBy: [] }),
      place({ holders: [], absentHolder: 'والدة مراد', relayedBy: [] }),
      place({ holders: ['S1'], relayedBy: ['S1'], sourceRefs: [1] }),
      place({ holders: ['S2'], sourceRefs: [1] }),
      place({ holders: ['S1'], relayedBy: ['S2'], sourceRefs: [1] }),
      place({ holders: ['S9'] }),
      place({ nature: 'FACT' }),
      place({ revises: 'E1' }),
    ]) {
      const { service, rpcs } = harness({ interpreter: { read: async () => ({ places: [broken] }) } });
      expect(await service.weave(REQUEST)).toEqual({ state: 'REFUSED', reason: 'READING_UNAVAILABLE' });
      expect(commitOf(rpcs)).toEqual([]);
      expect(rpcs.some((call) => call.name === 'placeholder')).toBe(false);
    }
  });

  it('a revision names its existing ref, and the write receives the earlier place it revises', async () => {
    const reading: SharedSemanticInterpreter = { read: async () => ({ places: [place({ meaning: 'Moving is settled now', sourceRefs: [1], holders: ['S1'], revises: 'E1' })] }) };
    const { service, rpcs } = harness({ interpreter: reading, existing: [saved(OLD_PLACE)] });
    expect((await service.weave(REQUEST)).state).toBe('WOVEN');
    expect(commitOf(rpcs)[0].body.p_revises_place_id).toBe(OLD_PLACE);
  });

  it('the members an existing meaning names get tokens of their own; its sources are this reading’s refs', async () => {
    const older = '40000000-0000-4000-8000-0000000000a1';
    const visibility = {
      [AMAL]: [{ ...row(older, 'HUMAN_TEXT', 0), author_user_id: AMAL }, row(M1, 'HUMAN_TEXT', 1), row(M2, 'HUMAN_TEXT', 4), row(OLD_PLACE, 'QANDEEL_ANALYSIS', 5)],
      [BASSEM]: [{ ...row(older, 'HUMAN_TEXT', 0), author_user_id: AMAL }, row(M1, 'HUMAN_TEXT', 1), row(M2, 'HUMAN_TEXT', 4), row(OLD_PLACE, 'QANDEEL_ANALYSIS', 5)],
    };
    const existing = [saved(OLD_PLACE, { people: [{ role: 'HOLDER', user: AMAL, name: 'Amal' }, { role: 'ABOUT', user: AHMED, name: 'أحمد' }], source_material_ids: [older] })];
    const { service, reads } = harness({ visibility, existing });
    await service.weave(REQUEST);
    expect(reads[0].writers).toEqual([{ speaker: 'S1', name: 'A participant (1)' }, { speaker: 'S2', name: 'A participant (2)' }, { speaker: 'S3', name: 'أحمد' }]);
    expect(reads[0].existing).toEqual([{ ref: 'E1', meaning: 'Visible to all', nature: 'VIEW', holders: ['S1'], absentHolder: null, relayedBy: [], about: ['S3'], hedged: false, sourceRefs: [1] }]);
  });

  it('the positions the reply was given come first, and only CURRENT ones with no successor are shown', async () => {
    const A = '50000000-0000-4000-8000-0000000000a1';
    const B = '50000000-0000-4000-8000-0000000000a2';
    const C = '50000000-0000-4000-8000-0000000000a3';
    const visibility = Object.fromEntries([AMAL, BASSEM].map((user) => [user, [row(M1, 'HUMAN_TEXT', 1), row(M2, 'HUMAN_TEXT', 4),
      ...[A, B, C].map((id) => ({ world_id: WORLD, material_id: id, material_kind: 'QANDEEL_ANALYSIS', established_at: '2026-10-08T10:05:00Z', text_body: 'x', author_user_id: null }))]]));
    const existing = [
      saved(A, { meaning: 'Superseded', standing: 'SUPERSEDED', later_place_id: B, people: [{ role: 'HOLDER', user: BASSEM, name: 'B' }] }),
      saved(B, { meaning: 'Current', earlier_place_id: A, people: [{ role: 'HOLDER', user: BASSEM, name: 'B' }] }),
      saved(C, { meaning: 'Recalled, about nobody here', people: [{ role: 'HOLDER', user: AHMED, name: 'أحمد' }], source_material_ids: [] }),
    ];
    const { service, reads } = harness({ visibility, existing });
    await service.weave({ ...REQUEST, recalledPlaceIds: [C] });
    expect(reads[0].existing.map((meaning) => meaning.meaning)).toEqual(['Current', 'Recalled, about nobody here']);
  });

  it('places the pass in ONE call, by meaning anchors; the server derives the points; a refused placement writes nothing', async () => {
    const seen: unknown[] = [];
    const placements: unknown[] = [];
    const reading: SharedSemanticInterpreter = { read: async () => ({ places: [
      place({ meaning: 'ب — second by meaning', sourceRefs: [1], holders: ['S1'], lensKey: 'plans' }),
      place({ meaning: 'أ — first by meaning', sourceRefs: [2], holders: ['S2'], lensKey: 'plans' }),
    ] }) };
    const placer: SharedSpatialPlacer = { place: async (input) => {
      placements.push(input);
      seen.push(currentAiUsageAttribution());
      return { placements: [{ new: 'N1', anchors: [{ to: 'R:plans', closeness: 2 }] }, { new: 'N2', anchors: [{ to: 'N1', closeness: 1 }] }] };
    } };
    const { service, rpcs } = harness({ interpreter: reading, placer, existing: [saved(OLD_PLACE, { world_x: '5', world_y: '5' })] });
    expect((await service.weave(REQUEST)).state).toBe('WOVEN');
    expect(placements).toHaveLength(1);
    expect((placements[0] as { new: { ref: string; meaning: string }[] }).new.map((entry) => [entry.ref, entry.meaning]))
      .toEqual([['N1', 'أ — first by meaning'], ['N2', 'ب — second by meaning']]);
    expect(JSON.stringify(placements[0])).not.toMatch(new RegExp(`${AMAL}|${BASSEM}|${OLD_PLACE}|${WORLD}`, 'u'));
    expect(seen).toEqual([{ userId: BASSEM, sourceWorldId: WORLD, sourceSharedMaterialId: M2 }]);
    const points = commitOf(rpcs).map((call) => [call.body.p_meaning, call.body.p_world_x, call.body.p_world_y]);
    // «أ» founds the new region at the first ring point; «ب» lies at closeness 1 from it (r(1) = 4U, angle 0).
    expect(points).toEqual([['ب — second by meaning', String(64n * 2n ** 20n + 4n * 2n ** 20n), '0'], ['أ — first by meaning', String(64n * 2n ** 20n), '0']]);
    const refusing: SharedSpatialPlacer = { place: async () => ({ placements: [{ new: 'N1', anchors: [{ to: 'N1', closeness: 1 }] }] }) };
    const refused = harness({ interpreter: reading, placer: refusing });
    expect(await refused.service.weave(REQUEST)).toEqual({ state: 'REFUSED', reason: 'PLACEMENT_UNAVAILABLE' });
    expect(commitOf(refused.rpcs)).toEqual([]);
  });

  it('the database refusing an attribution refuses the place, and the pass is not recorded as completed', async () => {
    const { service, rpcs } = harness({ commit: () => ({ outcome: 'ATTRIBUTION_REFUSED', material_id: null, established_at: null }) });
    expect(await service.weave(REQUEST)).toEqual({ state: 'REFUSED', reason: 'ATTRIBUTION_REFUSED' });
    expect(rpcs.at(-1)?.body.p_completed).toBe(false);
  });
});
