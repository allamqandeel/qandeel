// SHARED-VIS-01 — the Shared World's semantic places: the provider-neutral interpreter and placer, the member reads.
// (The server pass over the real frozen I-03 chain is proven beside it, in connected-worlds/material-commit.)
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SharedSemanticFieldService } from './shared-semantic-field.service';
import {
  FakeSharedSemanticInterpreter, SHARED_SEMANTIC_INTERPRETATION_CONTRACT, UnconfiguredSharedSemanticInterpreter, createConfiguredSharedSemanticInterpreter,
  decodeSharedSemanticReading, type SharedSemanticInput, type SharedSemanticInterpreter,
} from './shared-semantic-interpreter';
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
