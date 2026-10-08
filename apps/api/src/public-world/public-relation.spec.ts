import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ROUTE_RATE_LIMIT_CENSUS } from '../http-security/route-rate-limit.census';
import type { PublicFieldRepository } from './public-field.repository';
import { PublicFieldService } from './public-field.service';
import type { PublicActivityProducer } from './public-activity.producer';
import type { PublicRelationRepository } from './public-relation.repository';
import { PublicRelationService } from './public-relation.service';

const TOKEN = 'reader-token';
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const COMMAND = id(1);
const MINE = id(2);
const OTHER = id(3);
const RELATION = id(4);

function relationRepository(overrides: Partial<Record<keyof PublicRelationRepository, jest.Mock>> = {}) {
  return {
    experiences: jest.fn(async () => [{ experience_id: MINE, meaning: 'Fear for a family' }]),
    relations: jest.fn(async () => [{ relation_id: RELATION, experience_id: MINE, other_experience_id: OTHER, other_meaning: 'Courage in small choices',
      relation_state: 'REQUEST_SENT' }]),
    request: jest.fn(async () => [{ outcome: 'REQUESTED', relation_id: RELATION }]),
    act: jest.fn(async (_token: string, act: string) => [{ outcome: { accept: 'ACCEPTED', decline: 'DECLINED', cancel: 'CANCELLED', remove: 'REMOVED' }[act] }]),
    ...overrides,
  };
}
// S5-04 re-anchor (validation only): the service now also projects committed facts to Activity through the S5-04 producer.
const activity = { relationRequested: jest.fn(async () => undefined), relationAccepted: jest.fn(async () => undefined), relationEnded: jest.fn(async () => undefined) };
const service = (repo = relationRepository()) => new PublicRelationService(repo as unknown as PublicRelationRepository, activity as unknown as PublicActivityProducer);

describe('S5-03C — explicit Public relations, managed by their controllers', () => {
  it('reads the reader\'s own served Experiences and current relations from their side — meanings only, nothing else', async () => {
    const view = await service().relations(TOKEN);
    expect(view).toEqual({
      experiences: [{ id: MINE, meaning: 'Fear for a family' }],
      relations: [{ relationId: RELATION, experienceId: MINE, other: { id: OTHER, meaning: 'Courage in small choices' }, state: 'REQUEST_SENT' }],
    });
    const keys = JSON.stringify(view).match(/"[A-Za-z]+":/gu) ?? [];
    expect([...new Set(keys)].sort()).toEqual(['"experienceId":', '"experiences":', '"id":', '"meaning":', '"other":', '"relationId":', '"relations":', '"state":']);
    for (const bad of [
      { relation_state: 'PENDING' }, { relation_state: 'SIMILAR' }, { other_meaning: '' }, { other_experience_id: 'guess' },
    ]) {
      const repo = relationRepository({ relations: jest.fn(async () => [{ relation_id: RELATION, experience_id: MINE, other_experience_id: OTHER,
        other_meaning: 'm', relation_state: 'ACTIVE', ...bad }]) });
      await expect(service(repo).relations(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
    await expect(service(relationRepository({ experiences: jest.fn(async () => { throw new Error('down'); }) })).relations(TOKEN))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('asks for a relation with exactly { commandId, experienceId, otherExperienceId } — never a side, type, strength or text', async () => {
    const repo = relationRepository();
    await expect(service(repo).request(TOKEN, { commandId: COMMAND, experienceId: MINE, otherExperienceId: OTHER })).resolves.toEqual({ outcome: 'REQUESTED' });
    expect(repo.request).toHaveBeenCalledWith(TOKEN, COMMAND, MINE, OTHER);
    for (const body of [
      {}, { commandId: COMMAND, experienceId: MINE }, { commandId: COMMAND, experienceId: MINE, otherExperienceId: OTHER, type: 'RELATED' },
      { commandId: COMMAND, experienceId: MINE, otherExperienceId: OTHER, evidence: 'because' }, { commandId: 'x', experienceId: MINE, otherExperienceId: OTHER },
      null, [],
    ]) expect(() => service(repo).request(TOKEN, body)).toThrow(BadRequestException);
    await expect(service(repo).request(TOKEN, { commandId: COMMAND, experienceId: MINE, otherExperienceId: MINE })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
    for (const outcome of ['ALREADY_PENDING', 'ALREADY_RELATED', 'UNAVAILABLE']) {
      await expect(service(relationRepository({ request: jest.fn(async () => [{ outcome, relation_id: null }]) }))
        .request(TOKEN, { commandId: COMMAND, experienceId: MINE, otherExperienceId: OTHER })).resolves.toEqual({ outcome });
    }
    await expect(service(relationRepository({ request: jest.fn(async () => [{ outcome: 'SUGGESTED', relation_id: null }]) }))
      .request(TOKEN, { commandId: COMMAND, experienceId: MINE, otherExperienceId: OTHER })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('runs the four acts with { commandId } alone, each answering only its own words', async () => {
    for (const [act, done, other] of [['accept', 'ACCEPTED', 'NOT_PENDING'], ['decline', 'DECLINED', 'NOT_PENDING'],
      ['cancel', 'CANCELLED', 'NOT_PENDING'], ['remove', 'REMOVED', 'NOT_ACTIVE']] as const) {
      const repo = relationRepository();
      await expect(service(repo).act(TOKEN, act, RELATION, { commandId: COMMAND })).resolves.toEqual({ outcome: done });
      expect(repo.act).toHaveBeenCalledWith(TOKEN, act, COMMAND, RELATION);
      for (const outcome of [other, 'UNAVAILABLE']) {
        await expect(service(relationRepository({ act: jest.fn(async () => [{ outcome }]) })).act(TOKEN, act, RELATION, { commandId: COMMAND }))
          .resolves.toEqual({ outcome });
      }
      await expect(service(relationRepository({ act: jest.fn(async () => [{ outcome: 'ACCEPTED_BY_SIMILARITY' }]) })).act(TOKEN, act, RELATION, { commandId: COMMAND }))
        .rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(() => service().act(TOKEN, act, RELATION, { commandId: COMMAND, side: 'TARGET' })).toThrow(BadRequestException);
      await expect(service().act(TOKEN, act, 'guess', { commandId: COMMAND })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
    }
  });
});

describe('S5-03C — the panel carries explicit relations only', () => {
  const entry = (n: number) => ({ experience_id: id(n), world_x: `${n}000`, world_y: `-${n}000`, meaning: `meaning ${n}`, semantic_region: `region.${n}` });
  const PANEL = { ...entry(2), version_ordinal: 1, primary_themes: ['fear'], secondary_themes: [], publisher_label_mode: 'PSEUDONYM',
    publisher_display_label: 'p', published_at: '2026-10-07T10:00:00Z', discussion_post_count: 0, qandeel_response_count: 0 };
  const field = (relations: jest.Mock) => new PublicFieldService({
    field: jest.fn(async () => []), search: jest.fn(async () => []), experience: jest.fn(async () => [PANEL]),
    content: jest.fn(async () => [{ item_ordinal: 1, item_kind: 'SOURCE_CONTENT', item_text: 'w' }]),
    // The nearest Experience in the same region is NOT a relation: it comes back as nearby context, never as a line.
    nearby: jest.fn(async () => [entry(5)]), relations,
  } as unknown as PublicFieldRepository);

  it('serves the other endpoint of each explicit relation the database served — and none when it served none', async () => {
    const none = await field(jest.fn(async () => [])).experience(TOKEN, id(2));
    expect(none).toMatchObject({ state: 'SERVED', relations: [] });
    expect(none).toMatchObject({ nearby: [{ id: id(5) }] });
    const one = await field(jest.fn(async () => [{ relation_id: RELATION, ...entry(7) }])).experience(TOKEN, id(2));
    expect(one).toMatchObject({ state: 'SERVED', relations: [{ relationId: RELATION, other: { id: id(7), x: '7000', y: '-7000', meaning: 'meaning 7', region: 'region.7' } }] });
    const tooMany = Array.from({ length: 25 }, (_, n) => ({ relation_id: id(100 + n), ...entry(10 + n) }));
    await expect(field(jest.fn(async () => tooMany)).experience(TOKEN, id(2))).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(field(jest.fn(async () => [{ relation_id: 'guess', ...entry(7) }])).experience(TOKEN, id(2))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('S5-03C — the static boundary of the API', () => {
  const source = (file: string) => readFileSync(join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
  const FILES = ['public-relation.repository.ts', 'public-relation.service.ts', 'public-relation.controller.ts'];

  it('holds no private context, no server channel, no similarity and no geography; logs and publishes nothing', () => {
    for (const file of FILES) {
      const text = source(file);
      expect(text).not.toMatch(/memory|humanIntelligence|hypothes|SharedWorld|shared_world|provenance|matching|ModelRouter|console\.|Logger/iu);
      expect(text).not.toMatch(/ServiceRole|server\.rpc|service_role/u);
      expect(text).not.toMatch(/similar|proxim|nearby|distance|region|theme|world_x|world_y|coordinate|placement|strength|score|rank|popular/iu);
      expect(text).not.toMatch(/publish_|PUBLISHED|prerequisite|CLEARED|notif|push/iu);
      // S5-04 re-anchor (validation only): S5-03C published nothing to Activity (relation notifications were S5-04's by the
      // Product Owner's decision). S5-04 adds exactly one projection, after a committed act, through its Public producer —
      // never a recipient, never an Activity table, never a write of relation truth.
      const reach = text.match(/activity[A-Za-z.]*/giu) ?? [];
      expect(reach.every((r) => ['activity', 'activity.relationRequested', 'activity.relationAccepted', 'activity.relationEnded', 'ActivityProducer',
        'activity.producer'].includes(r))).toBe(true);
      expect(text).not.toMatch(/ActivityPublisher|recipient|activity_items/iu);
    }
  });

  it('calls exactly the 0146 owner RPCs on the caller token', () => {
    const repo = source('public-relation.repository.ts');
    expect([...repo.matchAll(/this\.rpc<[A-Za-z]+>\(token, '([a-z_]+_v1)'/gu)].map((m) => m[1]).sort())
      .toEqual(['read_own_public_relation_experiences_v1', 'read_own_public_relations_v1', 'request_public_relation_v1']);
    expect(repo).toMatch(/this\.rpc<PublicRelationActRow>\(token, `\$\{act\}_public_relation_v1`/u);
    expect(repo).not.toMatch(/p_user|p_viewer|p_side|p_type/u);
  });

  it('classifies every new route; asking another human for a relation takes the strict class', () => {
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /public/authoring/relations']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /public/authoring/relations']).toBe('SECURITY_SENSITIVE');
    for (const act of ['accept', 'decline', 'cancel', 'remove']) {
      expect(ROUTE_RATE_LIMIT_CENSUS[`POST /public/authoring/relations/:relationId/${act}`]).toBe('AUTHENTICATED');
    }
  });
});
