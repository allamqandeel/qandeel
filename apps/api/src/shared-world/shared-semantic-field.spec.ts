// SHARED-VIS-01 — the Shared World's semantic places: the provider-neutral interpreter and placer, the server pass composed
// over the REAL frozen I-03 chain (EffectiveContext, Source Disclosure Gate, revalidator, readiness, commit binder — only
// the service-role resolvers, the server channel, the interpreter and the placer are doubles), the member reads, and the
// S4-02 conversation boundary that keeps a place out of the conversation.
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { SharedHumanAudienceResolverService, fingerprintSharedHumanAudience } from '../connected-worlds/audience/shared-human-audience-resolver.service';
import type { StandingContextGrantResolverService } from '../connected-worlds/authority-resolution/standing-context-grant-resolver.service';
import { SharedDeliveryAuthorityRevalidatorService } from '../connected-worlds/delivery-authority/shared-delivery-authority-revalidator.service';
import { SharedEffectiveContextService } from '../connected-worlds/effective-context/shared-effective-context.service';
import { SharedPreModelWorldStateResolverService, fingerprintSharedPreModelWorldState } from '../connected-worlds/effective-context/shared-pre-model-world-state-resolver.service';
import type { SharedWorldId } from '../connected-worlds/kernel/world.types';
import { UnimplementedPrivateSourceState, UnimplementedSourceDisclosureDetector } from '../connected-worlds/material-commit/shared-unavailable-private-context-boundaries';
import { SharedPrivacyAuthorityDeliveryReadinessService } from '../connected-worlds/source-disclosure/shared-privacy-authority-delivery-readiness.service';
import { SharedSourceDisclosureGateService } from '../connected-worlds/source-disclosure/shared-source-disclosure-gate.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import type { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SharedSemanticFieldService } from './shared-semantic-field.service';
import {
  FakeSharedSemanticInterpreter, SHARED_SEMANTIC_INTERPRETATION_CONTRACT, UnconfiguredSharedSemanticInterpreter, createConfiguredSharedSemanticInterpreter,
  decodeSharedSemanticReading, type SharedSemanticInput, type SharedSemanticInterpreter,
} from './shared-semantic-interpreter';
import { SharedSemanticPlaceService } from './shared-semantic-place.service';
import {
  FakeSharedSpatialPlacer, SHARED_SPATIAL_PLACEMENT_CONTRACT, UnconfiguredSharedSpatialPlacer, createConfiguredSharedSpatialPlacer, decodeSharedSpatialPlacement,
  type SharedSpatialPlacer,
} from './shared-spatial-placer';
import type { SharedWorldRepository } from './shared-world.repository';

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

const input = (texts: string[], existing: SharedSemanticInput['existing'] = []): SharedSemanticInput => ({
  contract: SHARED_SEMANTIC_INTERPRETATION_CONTRACT,
  contributions: texts.map((text, index) => ({ ref: index + 1, text })),
  existing,
});
const place = (overrides: Record<string, unknown> = {}) => ({
  meaning: 'Moving keeps being postponed', primaryThemes: ['home'], secondaryThemes: ['trust'], sourceRefs: [1, 2], lensKey: 'home', ...overrides,
});

describe('SHARED-VIS-01 — the Shared semantic interpreter (provider-neutral, decoded strictly)', () => {
  it('decodes exactly { places } with at most three places, each exactly its five fields and real sources', () => {
    const given = input(['a', 'b', 'c']);
    expect(decodeSharedSemanticReading({ places: [] }, given)).toEqual({ places: [] });
    expect(decodeSharedSemanticReading({ places: [place({ sourceRefs: [2, 1] })] }, given)?.places[0].sourceRefs).toEqual([1, 2]);
    for (const malformed of [
      { places: [place()], score: 1 },
      { places: [place({ x: '1' })] },
      { places: [place({ sourceRefs: [4] })] },
      { places: [place({ sourceRefs: [] })] },
      { places: [place({ sourceRefs: [1, 1] })] },
      { places: [place({ meaning: 'two\nlines' })] },
      { places: [place({ meaning: `names ${M1}` })] },
      { places: [place({ primaryThemes: ['home'], secondaryThemes: ['HOME'] })] },
      { places: [place({ lensKey: 'Not A Key' })] },
      { places: [place(), place(), place(), place()] },
      null, [], 'text',
    ]) expect(decodeSharedSemanticReading(malformed, given)).toBeNull();
  });

  it('the test interpreter is deterministic, copies no text, and reads only what no existing meaning reads', async () => {
    const fake = new FakeSharedSemanticInterpreter();
    const given = input(['we keep postponing', 'it becomes a fight', 'let us pick a time']);
    const first = await fake.read(given);
    expect(await fake.read(given)).toEqual(first);
    const decoded = decodeSharedSemanticReading(first, given);
    expect(decoded?.places).toHaveLength(1);
    expect(decoded?.places[0].sourceRefs).toEqual([1, 2, 3]);
    expect(JSON.stringify(first)).not.toMatch(/postponing|fight|pick a time/u);
    expect(await fake.read(input(['a', 'b', 'c'], [{ meaning: 'read', sourceRefs: [1, 2] }]))).toEqual({ places: [] });
  });

  it('refuses in production until Stage 8A binds a provider', async () => {
    expect(createConfiguredSharedSemanticInterpreter({ NODE_ENV: 'test' })).toBeInstanceOf(FakeSharedSemanticInterpreter);
    const production = createConfiguredSharedSemanticInterpreter({ NODE_ENV: 'production' });
    expect(production).toBeInstanceOf(UnconfiguredSharedSemanticInterpreter);
    await expect(production.read(input(['a', 'b']), new AbortController().signal)).rejects.toThrow('unavailable');
    expect(createConfiguredSharedSpatialPlacer({ NODE_ENV: 'production' })).toBeInstanceOf(UnconfiguredSharedSpatialPlacer);
  });
});

describe('SHARED-VIS-01 — the Shared spatial placer (one World, its own geography)', () => {
  const at = (worldId: string, meaning = 'Moving keeps being postponed') => ({
    contract: SHARED_SPATIAL_PLACEMENT_CONTRACT, worldId, meaning, primaryThemes: ['home'], secondaryThemes: ['trust'], semanticRegion: 'home',
  });
  it('places a meaning deterministically, within the exact bound, and never at the same point in another World', async () => {
    const fake = new FakeSharedSpatialPlacer();
    const one = decodeSharedSpatialPlacement(await fake.place(at(WORLD)));
    expect(one).not.toBeNull();
    expect(decodeSharedSpatialPlacement(await fake.place(at(WORLD)))).toEqual(one);
    const other = decodeSharedSpatialPlacement(await fake.place(at(OTHER_WORLD)));
    expect(other).not.toEqual(one);
    expect(decodeSharedSpatialPlacement({ x: '4611686018427387904', y: '0', layoutVersion: 'v1' })).toBeNull();
    expect(decodeSharedSpatialPlacement({ x: '1', y: '2', layoutVersion: 'v1', neighbour: 'x' })).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------------ the pass harness
const members = [{ userId: AMAL, membershipEpisodeId: '70000000-0000-4000-8000-000000000001' }, { userId: BASSEM, membershipEpisodeId: '70000000-0000-4000-8000-000000000002' }];
const audienceOf = (worldId: string) => ({
  state: 'RESOLVED' as const,
  snapshot: { snapshotRef: fingerprintSharedHumanAudience({ state: 'RESOLVED', worldId, members }), humans: [{ kind: 'HUMAN' as const, humanId: AMAL }, { kind: 'HUMAN' as const, humanId: BASSEM }] },
});
const row = (material_id: string, material_kind: string, minute: number, text_body: string | null = `words ${minute}`) =>
  ({ world_id: WORLD, material_id, material_kind, established_at: `2026-10-08T10:0${minute}:00.000000+00:00`, text_body });

function harness(options: {
  interpreter?: SharedSemanticInterpreter; placer?: SharedSpatialPlacer; begin?: unknown; commit?: (body: Record<string, unknown>) => unknown;
  existing?: unknown[];
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
  const visibility: Record<string, unknown[]> = {
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
    expect(await service.weave({ worldId: WORLD, humanCommandId: COMMAND })).toEqual({ state: 'NOT_RUN', reason: 'NO_PROVIDER' });
    expect(rpcs).toEqual([]);
  });

  it('reads only the human text EVERY recipient may see, and commits QANDEEL_ANALYSIS over the exact sources it named', async () => {
    const { service, rpcs, reads } = harness();
    expect(await service.weave({ worldId: WORLD, humanCommandId: COMMAND })).toEqual({ state: 'WOVEN', placeIds: [PLACE] });
    expect(reads).toHaveLength(1);
    expect(reads[0].contributions.map((c) => c.text)).toEqual(['words 1', 'words 4']);
    expect(JSON.stringify(reads[0])).not.toMatch(new RegExp(`${AMAL}|${BASSEM}|${M1}|Amal|Bassem`, 'u'));
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
    await service.weave({ worldId: WORLD, humanCommandId: COMMAND });
    expect(reads[0].existing).toEqual([{ meaning: 'Visible to all', sourceRefs: [1] }]);
  });

  it('a busy, done or limited World starts nothing; a refusal commits nothing and records no completed pass', async () => {
    for (const outcome of ['IN_PROGRESS', 'DONE', 'LIMITED'] as const) {
      const { service, rpcs } = harness({ begin: { work_outcome: outcome, work_lease_id: null } });
      expect(await service.weave({ worldId: WORLD, humanCommandId: COMMAND })).toEqual({ state: 'NOT_RUN', reason: outcome });
      expect(rpcs.map((call) => call.name)).toEqual(['begin_shared_semantic_work_v1']);
    }
    const invented: SharedSemanticInterpreter = { read: async () => ({ places: [place({ sourceRefs: [9] })] }) };
    const malformed = harness({ interpreter: invented });
    expect(await malformed.service.weave({ worldId: WORLD, humanCommandId: COMMAND })).toEqual({ state: 'REFUSED', reason: 'READING_UNAVAILABLE' });
    expect(malformed.rpcs.some((call) => call.name === 'complete_shared_semantic_place_v1')).toBe(false);
    expect(malformed.rpcs.at(-1)?.body.p_completed).toBe(false);
    const stale = harness({ commit: () => ({ outcome: 'STALE', material_id: null, established_at: null }) });
    expect(await stale.service.weave({ worldId: WORLD, humanCommandId: COMMAND })).toEqual({ state: 'REFUSED', reason: 'COMMIT_STALE' });
    expect(stale.rpcs.at(-1)?.body.p_completed).toBe(false);
    const failing: SharedSpatialPlacer = { place: async () => { throw new Error('down'); } };
    expect(await harness({ placer: failing }).service.weave({ worldId: WORLD, humanCommandId: COMMAND })).toEqual({ state: 'REFUSED', reason: 'PLACEMENT_UNAVAILABLE' });
    expect(await harness().service.weave({ worldId: 'not-a-world', humanCommandId: COMMAND })).toEqual({ state: 'NOT_RUN', reason: 'MALFORMED_REQUEST' });
  });

  it('nothing new has formed: the pass completes with no place', async () => {
    const quiet: SharedSemanticInterpreter = { read: async () => ({ places: [] }) };
    const { service, rpcs } = harness({ interpreter: quiet });
    expect(await service.weave({ worldId: WORLD, humanCommandId: COMMAND })).toEqual({ state: 'WOVEN', placeIds: [] });
    expect(rpcs.at(-1)?.body.p_completed).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------------ the member reads
function fieldHarness(options: { entry?: 'ALLOW' | 'UNAVAILABLE'; field?: unknown[]; place?: unknown[]; sources?: unknown[] } = {}) {
  const shared = {
    resolveEntry: jest.fn(async () => [options.entry === 'UNAVAILABLE' ? { outcome: 'UNAVAILABLE', world_id: null } : { outcome: 'ALLOW', world_id: WORLD }]),
  };
  const calls: string[] = [];
  const dataApi = {
    request: jest.fn(async (_token: string, path: string) => {
      calls.push(path);
      if (path.endsWith('list_own_shared_semantic_field_v1')) return options.field ?? [];
      if (path.endsWith('read_own_shared_semantic_place_v1')) return options.place ?? [];
      return options.sources ?? [];
    }),
  };
  return { service: new SharedSemanticFieldService(shared as unknown as SharedWorldRepository, dataApi as unknown as SupabaseDataApiService), calls };
}
const fieldRow = { place_id: PLACE, world_x: '123456789', world_y: '-4611686018427387904', meaning: 'Moving keeps being postponed', semantic_region: 'home' };

describe('SHARED-VIS-01 — the member reads', () => {
  it('nothing of a World is read before its entry verdict is ALLOW', async () => {
    const { service, calls } = fieldHarness({ entry: 'UNAVAILABLE', field: [fieldRow] });
    expect(await service.field('token', WORLD)).toEqual({ outcome: 'UNAVAILABLE' });
    expect(await service.place('token', WORLD, PLACE)).toEqual({ outcome: 'UNAVAILABLE' });
    expect(calls).toEqual([]);
    expect(await fieldHarness().service.field('token', 'nope')).toEqual({ outcome: 'UNAVAILABLE' });
  });

  it('serves the places at their exact integer places, and refuses a malformed row', async () => {
    expect(await fieldHarness({ field: [fieldRow] }).service.field('token', WORLD)).toEqual({
      outcome: 'ALLOW', places: [{ placeId: PLACE, x: '123456789', y: '-4611686018427387904', meaning: 'Moving keeps being postponed', region: 'home' }],
    });
    await expect(fieldHarness({ field: [{ ...fieldRow, world_x: 1.5 }] }).service.field('token', WORLD)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('one place with its themes and exact sources, attributed as the conversation attributes them; otherwise ABSENT', async () => {
    const served = fieldHarness({
      place: [{ ...fieldRow, primary_themes: ['home'], secondary_themes: ['trust'], established_at: '2026-10-08T10:06:00Z' }],
      sources: [
        { material_id: M1, producer_kind: 'HUMAN', is_self: true, author_name: 'Amal', text_body: 'we keep postponing', established_at: '2026-10-08T10:01:00Z' },
        { material_id: M2, producer_kind: 'HUMAN', is_self: false, author_name: 'Bassem', text_body: 'it becomes a fight', established_at: '2026-10-08T10:04:00Z' },
      ],
    });
    const view = await served.service.place('token', WORLD, PLACE);
    expect(view.outcome).toBe('ALLOW');
    if (view.outcome === 'ALLOW') {
      expect(view.place.sources.map((s) => [s.producer, s.authorName])).toEqual([['SELF', null], ['HUMAN', 'Bassem']]);
      expect(view.place.primaryThemes).toEqual(['home']);
    }
    expect(await fieldHarness({ place: [], sources: [] }).service.place('token', WORLD, PLACE)).toEqual({ outcome: 'ABSENT' });
    expect(await fieldHarness({ place: [{ ...fieldRow, primary_themes: ['home'], secondary_themes: [], established_at: 'x' }], sources: [] })
      .service.place('token', WORLD, PLACE)).toEqual({ outcome: 'ABSENT' });
    expect(await fieldHarness().service.place('token', WORLD, 'guess')).toEqual({ outcome: 'ABSENT' });
    expect(BadRequestException).toBeDefined();
  });
});
