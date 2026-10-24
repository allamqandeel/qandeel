// SHARED-VIS-01 — the Shared World's semantic places: the provider-neutral interpreter and placer, the member reads.
// (The server pass over the real frozen I-03 chain is proven beside it, in connected-worlds/material-commit.)
//
// S8A-04 CP2 (2026-10-24, re-anchored): the reading is V2 (every place carries its attribution; existing meanings carry
// their ref and attribution), the placer is V2 (anchors only; the geometry is the server's, proven in
// shared-field-geometry.spec.ts), and the member reads are 0175's v2 functions (the database's default locale: the
// Shared routes take no query object, the S4-01 rule).
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SharedSemanticFieldService } from './shared-semantic-field.service';
import {
  FakeSharedSemanticInterpreter, SHARED_SEMANTIC_INTERPRETATION_CONTRACT, UnconfiguredSharedSemanticInterpreter,
  decodeSharedSemanticReading, type SharedSemanticInput, type SharedSemanticInterpreter,
} from './shared-semantic-interpreter';
import { createConfiguredSharedSemanticInterpreter } from './shared-semantic-interpreter-provider';
import {
  FakeSharedSpatialPlacer, SHARED_SPATIAL_PLACEMENT_CONTRACT, UnconfiguredSharedSpatialPlacer, createConfiguredSharedSpatialPlacer, decodeSharedSpatialPlacement,
  sharedPlacementTargets, type SharedSpatialPlacementInput, type SharedSpatialPlacer,
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
  writers: [{ speaker: 'S1', name: 'Amal' }],
  contributions: texts.map((text, index) => ({ ref: index + 1, from: 'S1', text })),
  existing,
});
const place = (overrides: Record<string, unknown> = {}) => ({
  meaning: 'Moving keeps being postponed', primaryThemes: ['home'], secondaryThemes: ['trust'], sourceRefs: [1, 2], lensKey: 'home',
  nature: 'VIEW', holders: ['S1'], relayedBy: [], about: [], hedged: false, ...overrides,
});

describe('SHARED-VIS-01 — the Shared semantic interpreter (provider-neutral, decoded strictly)', () => {
  it('decodes exactly { places } with at most three places, each exactly its fields and real sources', () => {
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

  it('S8A-04 CP1: a meaning may name a person, never carry a speaker token of its reading (meaning or theme)', () => {
    const given: SharedSemanticInput = { ...input(['a', 'b']), writers: [{ speaker: 'S1', name: 'منى' }, { speaker: 'S2', name: 'أحمد' }],
      contributions: [{ ref: 1, from: 'S1', text: 'a' }, { ref: 2, from: 'S2', text: 'b' }] };
    expect(decodeSharedSemanticReading({ places: [place({ meaning: 'منى ترى أن أحمد يتأخر، وأحمد يعترض' })] }, given)?.places).toHaveLength(1);
    expect(decodeSharedSemanticReading({ places: [place({ meaning: 'Galaxy S10 or S3?' })] }, given)?.places).toHaveLength(1);
    for (const leaking of [place({ meaning: 'S1 ترى أن S2 يتأخر' }), place({ meaning: '(S2) يعترض' }), place({ primaryThemes: ['S1'] })]) {
      expect(decodeSharedSemanticReading({ places: [leaking] }, given)).toBeNull();
    }
  });

  it('F1 (2026-10-25): the decoder keeps no place held by more than one member, and keeps the rest of the reading', () => {
    const given: SharedSemanticInput = { ...input(['a', 'b']), writers: [{ speaker: 'S1', name: 'هالة' }, { speaker: 'S2', name: 'كريم' }],
      contributions: [{ ref: 1, from: 'S1', text: 'a' }, { ref: 2, from: 'S2', text: 'b' }] };
    const joint = place({ meaning: 'رأي كريم وهالة في المواعيد', sourceRefs: [1, 2], holders: ['S1', 'S2'] });
    const own = place({ meaning: 'هالة شايفة إن المواعيد بتتنسي', sourceRefs: [1], holders: ['S1'] });
    expect(decodeSharedSemanticReading({ places: [joint, own] }, given)?.places.map((p) => p.meaning)).toEqual(['هالة شايفة إن المواعيد بتتنسي']);
    expect(decodeSharedSemanticReading({ places: [joint] }, given)).toEqual({ places: [] });
    // A malformed joint place still refuses the whole reading: the drop is never a way round the rules.
    expect(decodeSharedSemanticReading({ places: [{ ...joint, holders: ['S1', 'S9'] }, own] }, given)).toBeNull();
  });

  it('the test interpreter is deterministic, copies no text, and reads only what no existing meaning reads', async () => {
    const fake = new FakeSharedSemanticInterpreter();
    const given = input(['we keep postponing', 'it becomes a fight', 'let us pick a time']);
    const first = await fake.read(given);
    expect(await fake.read(given)).toEqual(first);
    const decoded = decodeSharedSemanticReading(first, given);
    expect(decoded?.places).toHaveLength(1);
    expect(decoded?.places[0].sourceRefs).toEqual([1, 2, 3]);
    // F1: the test interpreter names one holder, never a joint one.
    expect(decoded?.places[0].attribution.holders).toHaveLength(1);
    expect(JSON.stringify(first)).not.toMatch(/postponing|fight|pick a time/u);
    expect(await fake.read(input(['a', 'b', 'c'], [{ ref: 'E1', meaning: 'read', nature: 'VIEW', holders: ['S1'], absentHolder: null, relayedBy: [], about: [], hedged: false, sourceRefs: [1, 2] }])))
      .toEqual({ places: [] });
  });

  it('S8A-04 CP1: binds DeepSeek behind the SYNTHETIC_ONLY gate (a production process refuses every reading); the placer still refuses', async () => {
    expect(createConfiguredSharedSemanticInterpreter({ NODE_ENV: 'test' })).toBeInstanceOf(FakeSharedSemanticInterpreter);
    const production = createConfiguredSharedSemanticInterpreter({ NODE_ENV: 'production', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'sk-test' });
    await expect(production.read(input(['a', 'b']), new AbortController().signal)).rejects.toThrow('cannot be selected in production');
    const undeclared = createConfiguredSharedSemanticInterpreter({ NODE_ENV: 'development', DEEPSEEK_API_KEY: 'sk-test' });
    await expect(undeclared.read(input(['a', 'b']), new AbortController().signal)).rejects.toThrow('SYNTHETIC_ONLY');
    await expect(new UnconfiguredSharedSemanticInterpreter().read()).rejects.toThrow('unavailable');
    expect(createConfiguredSharedSpatialPlacer({ NODE_ENV: 'production' })).toBeInstanceOf(UnconfiguredSharedSpatialPlacer);
  });
});

describe('SHARED-VIS-01 — the Shared spatial placer (S8A-04 CP2: anchors only, never a coordinate)', () => {
  const given: SharedSpatialPlacementInput = {
    contract: SHARED_SPATIAL_PLACEMENT_CONTRACT,
    regions: [{ region: 'home', count: 1, examples: ['Moving keeps being postponed'] }],
    map: [{ ref: 'P1', region: 'home', meaning: 'Moving keeps being postponed' }],
    new: [{ ref: 'N1', region: 'home', meaning: 'A date is finally chosen' }, { ref: 'N2', region: 'work', meaning: 'The office is far' }],
  };
  const answer = (placements: unknown) => decodeSharedSpatialPlacement({ placements }, given);
  it('the test placer is deterministic and anchors a meaning to its region, or to the region itself', async () => {
    const fake = new FakeSharedSpatialPlacer();
    const one = decodeSharedSpatialPlacement(await fake.place(given), given);
    expect(one).toEqual(new Map([['N1', [{ to: 'P1', closeness: 1 }]], ['N2', [{ to: 'R:work', closeness: 2 }]]]));
    expect(decodeSharedSpatialPlacement(await fake.place(given), given)).toEqual(one);
    expect(sharedPlacementTargets(given)).toEqual(['P1', 'N1', 'N2', 'R:home', 'R:work']);
  });
  it('refuses a coordinate, a score, an unknown target, a self or repeated anchor, a missing meaning, and a cycle', () => {
    expect(answer([{ new: 'N1', anchors: [{ to: 'N2', closeness: 3 }] }, { new: 'N2', anchors: [{ to: 'R:work', closeness: 1 }] }])).not.toBeNull();
    const n2 = { new: 'N2', anchors: [{ to: 'R:work', closeness: 1 }] };
    for (const malformed of [
      [{ new: 'N1', anchors: [{ to: 'P1', closeness: 1 }], x: '1' }, n2],
      [{ new: 'N1', anchors: [{ to: 'P1', closeness: 1, score: 0.9 }] }, n2],
      [{ new: 'N1', anchors: [{ to: 'P9', closeness: 1 }] }, n2],
      [{ new: 'N1', anchors: [{ to: 'N1', closeness: 1 }] }, n2],
      [{ new: 'N1', anchors: [{ to: 'P1', closeness: 1 }, { to: 'P1', closeness: 2 }] }, n2],
      [{ new: 'N1', anchors: [{ to: 'P1', closeness: 4 }] }, n2],
      [{ new: 'N1', anchors: [] }, n2],
      [{ new: 'N1', anchors: [{ to: 'P1', closeness: 1 }] }],
      [{ new: 'N1', anchors: [{ to: 'P1', closeness: 1 }] }, { new: 'N1', anchors: [{ to: 'P1', closeness: 1 }] }],
      [{ new: 'N1', anchors: [{ to: 'N2', closeness: 1 }] }, { new: 'N2', anchors: [{ to: 'N1', closeness: 1 }] }],
    ]) expect(answer(malformed)).toBeNull();
    expect(decodeSharedSpatialPlacement({ x: '1', y: '2', layoutVersion: 'v1' }, given)).toBeNull();
    expect(WORLD).not.toBe(OTHER_WORLD);
  });
});

// ------------------------------------------------------------------------------------------------------ the member reads
function fieldHarness(options: { entry?: 'ALLOW' | 'UNAVAILABLE'; field?: unknown[]; place?: unknown[]; sources?: unknown[] } = {}) {
  const shared = {
    resolveEntry: jest.fn(async () => [options.entry === 'UNAVAILABLE' ? { outcome: 'UNAVAILABLE', world_id: null } : { outcome: 'ALLOW', world_id: WORLD }]),
  };
  const calls: string[] = [];
  const bodies: unknown[] = [];
  const dataApi = {
    request: jest.fn(async (_token: string, path: string, init?: { body?: string }) => {
      calls.push(path);
      bodies.push(init?.body === undefined ? undefined : JSON.parse(init.body));
      if (path.endsWith('list_own_shared_semantic_field_v2')) return options.field ?? [];
      if (path.endsWith('read_own_shared_semantic_place_v2')) return options.place ?? [];
      return options.sources ?? [];
    }),
  };
  return { service: new SharedSemanticFieldService(shared as unknown as SharedWorldRepository, dataApi as unknown as SupabaseDataApiService), calls, bodies };
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
  });

  it('S8A-04 CP2: reads the v2 functions (the composed meaning), in the database default locale', async () => {
    const served = fieldHarness({ field: [fieldRow] });
    await served.service.field('token', WORLD);
    await served.service.place('token', WORLD, PLACE);
    expect(served.calls.map((path) => path.split('/').pop())).toEqual([
      'list_own_shared_semantic_field_v2', 'read_own_shared_semantic_place_v2', 'list_own_shared_semantic_place_sources_v2',
    ]);
    expect(served.bodies).toEqual([
      { p_world_id: WORLD, p_locale: null }, { p_world_id: WORLD, p_place_id: PLACE, p_locale: null }, { p_world_id: WORLD, p_place_id: PLACE },
    ]);
    expect(BadRequestException).toBeDefined();
  });
});
