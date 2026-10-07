import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ROUTE_RATE_LIMIT_CENSUS } from '../http-security/route-rate-limit.census';
import type { PublicFieldRepository } from './public-field.repository';
import { PublicFieldService } from './public-field.service';
import {
  FakePublicSpatialPlacer, PUBLIC_SPATIAL_PLACEMENT_CONTRACT, UnconfiguredPublicSpatialPlacer, createConfiguredPublicSpatialPlacer,
  decodePublicSpatialPlacement, isCanonicalCoordinateText, type PublicSpatialPlacementInput, type PublicSpatialPlacer,
} from './public-spatial-placer';
import type { PublicSpatialRepository } from './public-spatial.repository';
import { PublicSpatialService } from './public-spatial.service';

const TOKEN = 'viewer-token';
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const COMMAND = id(1);
const EXPERIENCE = id(2);
const REQUEST = id(3);
const REVISION = id(4);
const MAX = '4611686018427387903';
const MIN = '-4611686018427387904';

const INPUT_ROW = { interpretation_id: REVISION, meaning: 'Fear for a family while work feels uncertain', primary_themes: ['fear', 'family'],
  secondary_themes: ['work'], semantic_region: 'family.fear' };

function spatialRepository(overrides: Partial<Record<keyof PublicSpatialRepository, jest.Mock>> = {}) {
  return {
    preparation: jest.fn(async () => [{ preparation_state: 'NOT_PLACED' }]),
    request: jest.fn(async () => [{ outcome: 'REQUEST_OPEN', request_id: REQUEST }]),
    placementInput: jest.fn(async () => [INPUT_ROW]),
    commit: jest.fn(async () => [{ outcome: 'PLACED' }]),
    ...overrides,
  };
}
const placerOf = (answer: () => Promise<unknown>) => ({ place: jest.fn(answer) });
const spatial = (repo = spatialRepository(), placer: { place: jest.Mock } = placerOf(async () => ({ x: '12', y: '-34', layoutVersion: 'model.v1' }))) =>
  new PublicSpatialService(repo as unknown as PublicSpatialRepository, placer as unknown as PublicSpatialPlacer);

const entry = (n: number, extra: Record<string, unknown> = {}) => ({
  experience_id: id(n), world_x: `${n}000`, world_y: `-${n}000`, meaning: `meaning ${n}`, semantic_region: `region.${n}`, ...extra,
});
const PANEL = {
  ...entry(2), version_ordinal: 1, primary_themes: ['fear'], secondary_themes: [], publisher_label_mode: 'PSEUDONYM',
  publisher_display_label: 'the publisher', published_at: '2026-10-06T10:00:00Z', discussion_post_count: 0, qandeel_response_count: 0,
};
function fieldRepository(overrides: Partial<Record<keyof PublicFieldRepository, jest.Mock>> = {}) {
  return {
    field: jest.fn(async () => [entry(2), entry(5)]),
    search: jest.fn(async () => [entry(5)]),
    experience: jest.fn(async () => [PANEL]),
    content: jest.fn(async () => [{ item_ordinal: 1, item_kind: 'SOURCE_CONTENT', item_text: 'the public words' }]),
    nearby: jest.fn(async () => [entry(5)]),
    // S5-03C (re-anchor): the panel read also asks for the Experience's explicit relations; none by default.
    relations: jest.fn(async () => []),
    ...overrides,
  };
}
const fieldService = (repo = fieldRepository()) => new PublicFieldService(repo as unknown as PublicFieldRepository);

describe('S5-03B — the provider-neutral spatial placer', () => {
  it('decodes exactly { x, y, layoutVersion } as canonical integer text — no neighbour, rank, edge or float', () => {
    expect(decodePublicSpatialPlacement({ x: '12', y: '-34', layoutVersion: 'model.v1' })).toEqual({ x: '12', y: '-34', layoutVersion: 'model.v1' });
    expect(decodePublicSpatialPlacement({ x: MAX, y: MIN, layoutVersion: 'm' })).not.toBeNull();
    for (const bad of [
      { x: 12, y: '-34', layoutVersion: 'm' }, { x: '1.5', y: '0', layoutVersion: 'm' }, { x: '4611686018427387904', y: '0', layoutVersion: 'm' },
      { x: '0', y: '-4611686018427387905', layoutVersion: 'm' }, { x: '-0', y: '0', layoutVersion: 'm' }, { x: '01', y: '0', layoutVersion: 'm' },
      { x: '0', y: '0', layoutVersion: 'Has Space' }, { x: '0', y: '0' }, { x: '0', y: '0', layoutVersion: 'm', neighbours: [] },
      { x: '0', y: '0', layoutVersion: 'm', rank: 1 }, { x: '0', y: '0', layoutVersion: 'm', edges: [] }, null, [], 'x',
    ]) expect(decodePublicSpatialPlacement(bad)).toBeNull();
    expect(isCanonicalCoordinateText('1e3')).toBe(false);
  });

  it('places by meaning alone under test, deterministically; outside tests it refuses — no fake geography, no fallback', async () => {
    const input: PublicSpatialPlacementInput = { contract: PUBLIC_SPATIAL_PLACEMENT_CONTRACT, semanticRevision: REVISION,
      meaning: 'Fear for a family', primaryThemes: ['fear'], secondaryThemes: [], semanticRegion: 'family.fear' };
    const fake = new FakePublicSpatialPlacer();
    const first = decodePublicSpatialPlacement(await fake.place(input));
    expect(first).not.toBeNull();
    expect(decodePublicSpatialPlacement(await fake.place({ ...input, semanticRevision: id(9) }))).toEqual(first);
    const sameRegion = decodePublicSpatialPlacement(await fake.place({ ...input, meaning: 'Another fear', primaryThemes: ['worry'] }))!;
    const otherRegion = decodePublicSpatialPlacement(await fake.place({ ...input, semanticRegion: 'hope.waiting' }))!;
    const distance = (a: { x: string; y: string }, b: { x: string; y: string }) => {
      const dx = BigInt(a.x) - BigInt(b.x); const dy = BigInt(a.y) - BigInt(b.y); return dx * dx + dy * dy;
    };
    expect(distance(first!, sameRegion)).toBeLessThan(distance(first!, otherRegion));
    expect(createConfiguredPublicSpatialPlacer({ NODE_ENV: 'test' })).toBeInstanceOf(FakePublicSpatialPlacer);
    for (const environment of [{ NODE_ENV: 'production' }, {}, { NODE_ENV: 'development' }]) {
      const placer = createConfiguredPublicSpatialPlacer(environment);
      expect(placer).toBeInstanceOf(UnconfiguredPublicSpatialPlacer);
      await expect(placer.place(input, new AbortController().signal)).rejects.toThrow('Public spatial placement is unavailable.');
    }
  });
});

describe('S5-03B — preparing the stable place: meaning in, coordinates committed on the server channel only', () => {
  it('gives the placer exactly the reviewed meaning the database served — no token, package text, identity or alias', async () => {
    const repo = spatialRepository();
    const placer = placerOf(async () => ({ x: '12', y: '-34', layoutVersion: 'model.v1' }));
    await expect(spatial(repo, placer).prepare(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome: 'PLACED' });
    expect(repo.request).toHaveBeenCalledWith(TOKEN, COMMAND, EXPERIENCE);
    expect(repo.placementInput).toHaveBeenCalledWith(REQUEST);
    const [given] = placer.place.mock.calls[0] as unknown as [PublicSpatialPlacementInput];
    expect(given).toEqual({ contract: PUBLIC_SPATIAL_PLACEMENT_CONTRACT, semanticRevision: REVISION, meaning: INPUT_ROW.meaning,
      primaryThemes: ['fear', 'family'], secondaryThemes: ['work'], semanticRegion: 'family.fear' });
    expect(JSON.stringify(given)).not.toContain(TOKEN);
    expect(repo.commit).toHaveBeenCalledWith(REQUEST, 'model.v1', '12', '-34');
  });

  it('refuses any body but { commandId }: the owner can never send a place, a region, a rank or a model', async () => {
    const repo = spatialRepository();
    for (const body of [{}, { commandId: 'x' }, { commandId: COMMAND, x: '1', y: '2' }, { commandId: COMMAND, region: 'r' },
      { commandId: COMMAND, rank: 1 }, { commandId: COMMAND, layoutVersion: 'm' }, { commandId: COMMAND, ready: true }, [COMMAND], null]) {
      expect(() => spatial(repo).prepare(TOKEN, EXPERIENCE, body)).toThrow(BadRequestException);
    }
    expect(repo.request).not.toHaveBeenCalled();
  });

  it('fails closed: an unavailable or malformed placer commits nothing; a placed or stale revision calls no placer', async () => {
    for (const answer of [async () => { throw new Error('down'); }, async () => ({ x: '1', y: '2', layoutVersion: 'm', neighbours: [] }), async () => null]) {
      const repo = spatialRepository();
      await expect(spatial(repo, placerOf(answer)).prepare(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome: 'PLACEMENT_UNAVAILABLE' });
      expect(repo.commit).not.toHaveBeenCalled();
    }
    for (const outcome of ['ALREADY_PLACED', 'NOT_SEMANTICALLY_READY', 'STALE', 'UNAVAILABLE']) {
      const repo = spatialRepository({ request: jest.fn(async () => [{ outcome, request_id: null }]) });
      const placer = placerOf(async () => ({ x: '1', y: '2', layoutVersion: 'm' }));
      await expect(spatial(repo, placer).prepare(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome });
      expect(placer.place).not.toHaveBeenCalled();
    }
    const repo = spatialRepository({ placementInput: jest.fn(async () => []) });
    const placer = placerOf(async () => ({ x: '1', y: '2', layoutVersion: 'm' }));
    await expect(spatial(repo, placer).prepare(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome: 'STALE' });
    expect(placer.place).not.toHaveBeenCalled();
    const already = spatialRepository({ commit: jest.fn(async () => [{ outcome: 'ALREADY_PLACED' }]) });
    await expect(spatial(already).prepare(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome: 'ALREADY_PLACED' });
  });

  it('shows the owner whether the place exists — never where — and one neutral answer otherwise', async () => {
    await expect(spatial().preparation(TOKEN, EXPERIENCE)).resolves.toEqual({ state: 'NOT_PLACED' });
    await expect(spatial(spatialRepository({ preparation: jest.fn(async () => []) })).preparation(TOKEN, EXPERIENCE)).resolves.toEqual({ state: 'UNAVAILABLE' });
    await expect(spatial().preparation(TOKEN, 'not-a-uuid')).resolves.toEqual({ state: 'UNAVAILABLE' });
    await expect(spatial(spatialRepository({ preparation: jest.fn(async () => [{ preparation_state: 'SOMEWHERE' }]) })).preparation(TOKEN, EXPERIENCE))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('S5-03B — the semantic field, search and panel over the same World', () => {
  it('reads one bounded world rectangle of exact integer text, and nothing else', async () => {
    const repo = fieldRepository();
    await expect(fieldService(repo).field(TOKEN, { minX: MIN, minY: MIN, maxX: MAX, maxY: MAX })).resolves.toEqual({ experiences: [
      { id: id(2), x: '2000', y: '-2000', meaning: 'meaning 2', region: 'region.2' },
      { id: id(5), x: '5000', y: '-5000', meaning: 'meaning 5', region: 'region.5' }] });
    expect(repo.field).toHaveBeenCalledWith(TOKEN, MIN, MIN, MAX, MAX);
    for (const query of [{}, { minX: '0', minY: '0', maxX: '1' }, { minX: '0', minY: '0', maxX: '1', maxY: '1', rank: '1' },
      { minX: '0.5', minY: '0', maxX: '1', maxY: '1' }, { minX: '2', minY: '0', maxX: '1', maxY: '1' },
      { minX: '0', minY: '0', maxX: '4611686018427387904', maxY: '1' }, { minX: ['0'], minY: '0', maxX: '1', maxY: '1' }]) {
      expect(() => fieldService(repo).field(TOKEN, query)).toThrow(BadRequestException);
    }
  });

  it('refuses a malformed or oversized answer rather than drawing it', async () => {
    const bad = fieldRepository({ field: jest.fn(async () => [entry(2, { world_x: 1.5 })]) });
    await expect(fieldService(bad).field(TOKEN, { minX: '0', minY: '0', maxX: '1', maxY: '1' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    const many = fieldRepository({ field: jest.fn(async () => Array.from({ length: 401 }, (_, n) => entry(n + 1))) });
    await expect(fieldService(many).field(TOKEN, { minX: '0', minY: '0', maxX: '1', maxY: '1' })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('searches the same field with one trimmed line; every result carries its place', async () => {
    const repo = fieldRepository();
    await expect(fieldService(repo).search(TOKEN, { q: 'family' })).resolves.toEqual({ results: [{ id: id(5), x: '5000', y: '-5000', meaning: 'meaning 5', region: 'region.5' }] });
    for (const query of [{}, { q: '' }, { q: ' padded' }, { q: 'a\nb' }, { q: 'x'.repeat(121) }, { q: 'ok', lens: 'r' }, { q: ['a'] }]) {
      expect(() => fieldService(repo).search(TOKEN, query)).toThrow(BadRequestException);
    }
  });

  it('serves the panel of a served Experience — meaning, current display, content, bounded nearby — and nothing for anything else', async () => {
    const served = await fieldService().experience(TOKEN, id(2));
    expect(served).toEqual({ state: 'SERVED', experience: {
      id: id(2), x: '2000', y: '-2000', meaning: 'meaning 2', region: 'region.2', primaryThemes: ['fear'], secondaryThemes: [],
      publisher: { mode: 'PSEUDONYM', label: 'the publisher' }, publishedAt: '2026-10-06T10:00:00Z', discussionCount: 0, qandeelResponseCount: 0 },
    content: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'the public words' }],
    nearby: [{ id: id(5), x: '5000', y: '-5000', meaning: 'meaning 5', region: 'region.5' }], relations: [] });
    expect(JSON.stringify(served)).not.toMatch(/view|rank|score|importance|user_id|public_identity_ref/iu);
    await expect(fieldService().experience(TOKEN, 'guess')).resolves.toEqual({ state: 'UNAVAILABLE' });
    await expect(fieldService(fieldRepository({ experience: jest.fn(async () => []) })).experience(TOKEN, id(2))).resolves.toEqual({ state: 'UNAVAILABLE' });
    await expect(fieldService(fieldRepository({ content: jest.fn(async () => []) })).experience(TOKEN, id(2))).resolves.toEqual({ state: 'UNAVAILABLE' });
    const crowded = fieldRepository({ nearby: jest.fn(async () => [entry(5), entry(6), entry(7), entry(8)]) });
    await expect(fieldService(crowded).experience(TOKEN, id(2))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('S5-03B — the static boundary of the API', () => {
  const dir = __dirname;
  const source = (file: string) => readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
  const FILES = ['public-spatial-placer.ts', 'public-spatial.repository.ts', 'public-spatial.service.ts', 'public-spatial.controller.ts',
    'public-field.repository.ts', 'public-field.service.ts', 'public-field.controller.ts'];
  // S5-03C (controlled re-anchor): the field's panel read now carries the EXPLICIT relations served by migration 0146's
  // one viewer read. The geography files still name no relation at all; the field files name only that explicit read.
  const GEOGRAPHY = ['public-spatial-placer.ts', 'public-spatial.repository.ts', 'public-spatial.service.ts', 'public-spatial.controller.ts'];

  it('holds no private context, logs nothing, binds no provider, publishes nothing and never reads the 0096 descriptor', () => {
    for (const file of FILES) {
      const text = source(file);
      expect(text).not.toMatch(/memory|humanIntelligence|hypothes|SharedWorld|shared_world|provenance|matching|ModelRouter|console\.|Logger/iu);
      expect(text).not.toMatch(/openai|anthropic|gemini|qwen|deepseek|claude|kimi|glm|gpt-/iu);
      expect(text).not.toMatch(/publish_|PUBLISHED|prerequisite|clearance|CLEARED/u);
      expect(text).not.toMatch(/semantic_label|s5-03a\.private|S5-03A_PRIVATE|search_public_experiences_v1|resolve_public_lens_v1|resolve_public_panel_v1|resolve_public_experience_semantic_placement_v1/u);
      expect(text).not.toMatch(/edge|view_count|viewCount|popular|similar|proxim/iu);
      if (GEOGRAPHY.includes(file)) expect(text).not.toMatch(/relation/iu);
    }
    expect(source('public-spatial-placer.ts')).toMatch(/if \(environment\.NODE_ENV === 'test'\) return new FakePublicSpatialPlacer\(\);\n\s+return new UnconfiguredPublicSpatialPlacer\(\);/u);
  });

  it('calls exactly the 0145 RPCs: the owner and viewer reads on the caller token, the placer input and commit on the server channel', () => {
    const owner = [...source('public-spatial.repository.ts').matchAll(/this\.rpc<[A-Za-z]+>\(token, '([a-z_]+_v1)'/gu)].map((m) => m[1]).sort();
    expect(owner).toEqual(['read_own_public_spatial_preparation_v1', 'request_own_public_spatial_placement_v1']);
    const server = [...source('public-spatial.repository.ts').matchAll(/this\.server\.rpc<[^>]+>\('([a-z_]+_v1)'/gu)].map((m) => m[1]).sort();
    expect(server).toEqual(['commit_public_spatial_placement_v1', 'read_public_spatial_placement_input_v1']);
    const viewer = [...source('public-field.repository.ts').matchAll(/this\.rpc<[A-Za-z]+>\(token, '([a-z_]+_v1)'/gu)].map((m) => m[1]).sort();
    expect(viewer).toEqual(['read_public_semantic_experience_content_v1', 'read_public_semantic_experience_v1', 'read_public_semantic_field_v1',
      'read_public_semantic_nearby_v1', 'read_public_semantic_relations_v1', 'search_public_semantic_field_v1']);
    expect(source('public-field.repository.ts')).not.toMatch(/server|p_viewer|p_user/u);
  });

  it('classifies every new route, the placer-reaching one strictly', () => {
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /public/authoring/drafts/:experienceId/place']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /public/authoring/drafts/:experienceId/place']).toBe('SECURITY_SENSITIVE');
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /public/field']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /public/field/search']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /public/field/experiences/:experienceId']).toBe('AUTHENTICATED');
    expect(Object.keys(ROUTE_RATE_LIMIT_CENSUS).filter((route) => /publish/u.test(route))).toEqual([]);
  });
});
