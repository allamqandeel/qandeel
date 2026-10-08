/**
 * S5-03C — explicit Public relations: the strict client, the management in the authoring workspace (request, cancel,
 * accept, decline, remove; every state re-read from the server), the relation lines in the ONE Public field (NEAR, the
 * selected Experience, explicit relations only), their accessibility, their disappearance, and the S5-03C Product Copy
 * Gate census.
 *
 * SIMILARITY IS NOT A RELATION: two Experiences side by side in the same semantic region draw nothing until the server
 * serves an explicit relation between them, and a relation never moves a place.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, cleanup, fireEvent, render } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { viewportEnvelope } from '../../map/camera';
import { canonicalWorldAddress, type CanonicalWorldAddress } from '../../map/world';
import { resize } from '../../responsive/__fixtures__/composition';
import type { PublicAuthoringAnswer, PublicFieldEntry, PublicFieldPanel, PublicRelation, PublicRelationActOutcome, PublicRelations } from '../../runtime-entry';
import { PublicWorldApiClient } from '../../runtime-entry';
import { createPublicWorldController } from '../../public-world/public-world-controller';
import { PublicWorldArea } from '../../public-world/PublicWorldArea';
import { createPublicFieldController, type PublicFieldTransport } from '../../public-world/field/public-field-controller';
import { placePublicField } from '../../public-world/field/public-field-projection';
import { explicitRelationSegments } from '../../public-world/field/PublicRelationLines';
import { focusField, wholeWorldCamera, zoomField } from '../../public-world/field/public-field-camera';
import { publicFieldCopy } from '../../public-world/field/field-copy';
import {
  createPublicAuthoringController, type PublicAuthoringTransport, type PublicRelationSearchTransport, type PublicRelationTransport,
} from '../public-authoring-controller';
import { PublicAuthoringWorkspace } from '../PublicAuthoringWorkspace';
import { PUBLIC_RELATION_COPY_GATE, publicRelationCopy } from '../relation-copy';
import { CANONICAL_VISUAL } from '../../conversation/visual/canonical-visual.generated';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const yes = <T,>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });
const NO = { kind: 'NO_ANSWER' as const };
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const at = (x: bigint, y: bigint): CanonicalWorldAddress => {
  const a = canonicalWorldAddress(x, y);
  if (!a.ok) throw new Error('fixture');
  return a.address;
};
const entry = (n: number, x: bigint, y: bigint, region = 'family.fear'): PublicFieldEntry => ({ id: id(n), address: at(x, y), meaning: `meaning ${n}`, region });
// E1 and E2 are neighbours in the SAME semantic region; E3 is far away elsewhere.
const E1 = entry(1, 300_000n, 600_000n);
const E2 = entry(2, 315_000n, 608_000n);
const E3 = entry(3, 360_000n, 560_000n, 'hope.waiting');
const RELATION = id(40);
const panelOf = (e: PublicFieldEntry, relations: { relationId: string; other: PublicFieldEntry }[] = [], nearby: PublicFieldEntry[] = []): PublicFieldPanel => ({
  kind: 'SERVED', experience: { entry: e, primaryThemes: ['fear'], secondaryThemes: [], publisher: { mode: 'PSEUDONYM', label: 'nightlamp27' },
    publishedAt: '2026-10-07T10:00:00.000Z', discussionCount: 0, // S5-04 re-anchor (validation only): the panel's D7 fields
    content: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'the public words' }], nearby, relations },
});

const appearance = () => {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
};

afterEach(() => { cleanup(); });

// ------------------------------------------------------------------------------------------------------- the client
describe('S5-03C — the strict relation client', () => {
  const clientOf = (answer: (url: string, init: { method: string; body?: string }) => unknown) => {
    const calls: { url: string; method: string; body?: string }[] = [];
    const fetch = jest.fn(async (url: string, init: { method: string; body?: string }) => {
      calls.push({ url, method: init.method, body: init.body });
      return { ok: true, status: 200, json: async () => answer(url, init) };
    });
    return { client: new PublicWorldApiClient({ baseUrl: 'https://api.test', fetch: fetch as never }), calls };
  };

  it('reads own Experiences and relations exactly; anything else is no answer', async () => {
    const good = { experiences: [{ id: id(1), meaning: 'm1' }],
      relations: [{ relationId: RELATION, experienceId: id(1), other: { id: id(3), meaning: 'm3' }, state: 'REQUEST_RECEIVED' }] };
    const { client, calls } = clientOf(() => good);
    await expect(client.relation.relations()).resolves.toEqual(yes(good));
    expect(calls).toEqual([{ url: 'https://api.test/public/authoring/relations', method: 'GET', body: undefined }]);
    for (const bad of [
      { ...good, count: 1 }, { experiences: [], relations: [{ ...good.relations[0], state: 'SUGGESTED' }] },
      { experiences: [], relations: [{ ...good.relations[0], other: { id: id(3), meaning: 'm3', x: '1' } }] },
      { experiences: [{ id: id(1), meaning: 'm1', region: 'r' }], relations: [] },
    ]) await expect(clientOf(() => bad).client.relation.relations()).resolves.toEqual(NO);
  });

  it('sends a command id and the two Experiences only — never a side, type, strength or text', async () => {
    const { client, calls } = clientOf((url) => (url.endsWith('/relations') ? { outcome: 'REQUESTED' } : { outcome: 'ACCEPTED' }));
    await expect(client.relation.request(id(1), id(3), id(9))).resolves.toEqual(yes('REQUESTED'));
    await expect(client.relation.act('accept', RELATION, id(8))).resolves.toEqual(yes('ACCEPTED'));
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ['POST', 'https://api.test/public/authoring/relations', JSON.stringify({ commandId: id(9), experienceId: id(1), otherExperienceId: id(3) })],
      ['POST', `https://api.test/public/authoring/relations/${RELATION}/accept`, JSON.stringify({ commandId: id(8) })],
    ]);
    await expect(clientOf(() => ({ outcome: 'REMOVED' })).client.relation.act('accept', RELATION, id(8))).resolves.toEqual(NO);
  });

  it('decodes a panel only with its explicit relations, each exactly { relationId, other }', async () => {
    const body = (relations: unknown) => ({ state: 'SERVED', experience: { id: id(1), x: '1', y: '2', meaning: 'm', region: 'r', primaryThemes: ['a'],
      secondaryThemes: [], publisher: { mode: 'PSEUDONYM', label: 'p' }, publishedAt: '2026-10-07T00:00:00Z', discussionCount: 0, qandeelResponseCount: 0 },
    content: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 't' }], nearby: [], relations });
    const other = { id: id(3), x: '5', y: '6', meaning: 'm3', region: 'r3' };
    const served = await clientOf(() => body([{ relationId: RELATION, other }])).client.field.experience(id(1));
    expect(served.kind === 'ANSWER' && served.value.kind === 'SERVED' && served.value.experience.relations.map((r) => [r.relationId, r.other.id])).toEqual([[RELATION, id(3)]]);
    for (const bad of [undefined, [{ relationId: RELATION, other, strength: 1 }], [{ relationId: 'guess', other }],
      Array.from({ length: 25 }, (_, n) => ({ relationId: id(100 + n), other }))]) {
      const b = body(bad);
      if (bad === undefined) delete (b as Record<string, unknown>).relations;
      await expect(clientOf(() => b).client.field.experience(id(1))).resolves.toEqual(NO);
    }
  });
});

// ------------------------------------------------------------------------------------------- the management workspace
const authoringTransport = (): PublicAuthoringTransport => ({
  drafts: jest.fn(async () => yes([])), sources: jest.fn(async () => yes({ personal: [], shared: [] })),
  startDraft: jest.fn(async () => NO), preparePackage: jest.fn(async () => NO), review: jest.fn(async () => NO),
  approvalRequests: jest.fn(async () => yes([])), approve: jest.fn(async () => NO), withdraw: jest.fn(async () => NO), ready: jest.fn(async () => NO),
}) as unknown as PublicAuthoringTransport;

/** A server double: the relation truth it holds now, which every read returns and every act changes. */
function relationServer(initial: PublicRelation[] = []) {
  let truth: PublicRelation[] = [...initial];
  const experiences = [{ id: E1.id, meaning: E1.meaning }];
  let fail = false;
  const transport = {
    relations: jest.fn(async () => (fail ? NO : yes<PublicRelations>({ experiences, relations: truth }))),
    request: jest.fn(async (_from: string, to: string) => {
      truth = [...truth, { relationId: id(77), experienceId: E1.id, other: { id: to, meaning: `meaning ${Number(to.slice(-2))}` }, state: 'REQUEST_SENT' }];
      return yes('REQUESTED' as const);
    }),
    act: jest.fn(async (kind: string, relationId: string): Promise<PublicAuthoringAnswer<PublicRelationActOutcome>> => {
      const found = truth.find((r) => r.relationId === relationId);
      if (!found) return yes('UNAVAILABLE' as const);
      if (kind === 'accept') { truth = truth.map((r) => (r.relationId === relationId ? { ...r, state: 'ACTIVE' as const } : r)); return yes('ACCEPTED' as const); }
      truth = truth.filter((r) => r.relationId !== relationId);
      return yes(({ decline: 'DECLINED', cancel: 'CANCELLED', remove: 'REMOVED' } as const)[kind as 'decline']);
    }),
  };
  return { transport: transport as unknown as PublicRelationTransport & typeof transport, set: (next: PublicRelation[]) => { truth = next; }, failNext: () => { fail = true; } };
}
const search = (results: PublicFieldEntry[]): PublicRelationSearchTransport & { search: jest.Mock } => ({ search: jest.fn(async () => yes(results)) });

describe('S5-03C — relations are managed inside the authoring workspace', () => {
  const received: PublicRelation = { relationId: RELATION, experienceId: E1.id, other: { id: E3.id, meaning: E3.meaning }, state: 'REQUEST_RECEIVED' };

  it('the workspace shows received requests and the reader\'s own served Experiences; accept re-reads the server', async () => {
    const server = relationServer([received]);
    const c = createPublicAuthoringController({ transport: authoringTransport(), relation: server.transport, relationSearch: search([]), isCurrent: () => true, newCommandId: () => id(90) });
    c.open();
    await flush();
    expect(c.getState()).toMatchObject({ screen: 'WORKSPACE', status: 'READY', relationExperiences: [{ id: E1.id }], relations: [received] });
    const view = await render(<PublicAuthoringWorkspace controller={c} language="en" palette={CANONICAL_VISUAL.palettes.DARK.standard} bottomInset={0} />);
    const copy = publicRelationCopy('en');
    expect(view.getByText(copy.receivedHeading)).toBeTruthy();
    expect(view.getByText(E3.meaning)).toBeTruthy();
    expect(view.getByText(`With your experience: ${E1.meaning}`)).toBeTruthy();
    await fireEvent.press(view.getByTestId('qandeel-public-relation-accept'));
    await flush();
    expect(server.transport.act).toHaveBeenCalledWith('accept', RELATION, id(90));
    // What is shown is what the server served on the read AFTER the act — never the act's own assumption.
    expect(server.transport.relations).toHaveBeenCalledTimes(2);
    expect(c.getState().relations).toEqual([{ ...received, state: 'ACTIVE' }]);
    expect(view.queryByTestId('qandeel-public-relation-accept')).toBeNull();
  });

  it('a relation read that fails shows no relation at all (fail closed) and leaves the rest of the workspace usable', async () => {
    const server = relationServer([received]);
    server.failNext();
    const c = createPublicAuthoringController({ transport: authoringTransport(), relation: server.transport, isCurrent: () => true });
    c.open();
    await flush();
    expect(c.getState()).toMatchObject({ status: 'READY', relationExperiences: [], relations: [] });
  });

  it('one Experience\'s relations: ask for one through the SAME Public search (never itself), then cancel; remove an active one', async () => {
    const server = relationServer();
    const finder = search([E1, E2, E3]);
    let n = 0;
    const c = createPublicAuthoringController({ transport: authoringTransport(), relation: server.transport, relationSearch: finder, isCurrent: () => true,
      newCommandId: () => id(200 + (n += 1)) });
    c.open();
    await flush();
    const view = await render(<PublicAuthoringWorkspace controller={c} language="en" palette={CANONICAL_VISUAL.palettes.DARK.standard} bottomInset={0} />);
    await fireEvent.press(view.getByTestId('qandeel-public-relations-experience'));
    await flush();
    expect(c.getState()).toMatchObject({ screen: 'RELATIONS', status: 'READY', experienceId: E1.id });
    expect(view.getByTestId('qandeel-public-authoring-title').props.children).toBe(publicRelationCopy('en').relationsTitle);
    expect(view.getByText(publicRelationCopy('en').requestHint)).toBeTruthy();
    await fireEvent.changeText(view.getByTestId('qandeel-public-relations-search'), 'courage');
    await fireEvent(view.getByTestId('qandeel-public-relations-search'), 'submitEditing');
    await flush();
    expect(finder.search).toHaveBeenCalledWith('courage');
    // The open Experience is never offered as its own relation; nothing is suggested, ranked or pre-selected.
    expect(c.getState().relationSearch.results.map((e) => e.id)).toEqual([E2.id, E3.id]);
    await fireEvent.press(view.getAllByTestId('qandeel-public-relations-request')[1]);
    await flush();
    expect(server.transport.request).toHaveBeenCalledWith(E1.id, E3.id, expect.any(String));
    expect(c.getState().relations.map((r) => r.state)).toEqual(['REQUEST_SENT']);
    expect(view.getByText(publicRelationCopy('en').sentHeading)).toBeTruthy();
    await fireEvent.press(view.getByTestId('qandeel-public-relation-cancel'));
    await flush();
    expect(server.transport.act).toHaveBeenLastCalledWith('cancel', id(77), expect.any(String));
    expect(c.getState().relations).toEqual([]);
    server.set([{ ...received, state: 'ACTIVE' }]);
    c.refresh();
    await flush();
    expect(view.getByText(publicRelationCopy('en').activeHeading)).toBeTruthy();
    await fireEvent.press(view.getByTestId('qandeel-public-relation-remove'));
    await flush();
    expect(server.transport.act).toHaveBeenLastCalledWith('remove', RELATION, expect.any(String));
    expect(c.getState().relations).toEqual([]);
    c.back();
    await flush();
    expect(c.getState().screen).toBe('WORKSPACE');
  });

  it('an act the server no longer allows says so, and the screen shows the server\'s truth', async () => {
    const server = relationServer([received]);
    server.transport.act.mockImplementationOnce(async () => yes('NOT_PENDING' as const));
    const c = createPublicAuthoringController({ transport: authoringTransport(), relation: server.transport, isCurrent: () => true });
    c.open();
    await flush();
    c.acceptRelation(RELATION);
    await flush();
    expect(c.getState().notice).toBe('ACTION_UNAVAILABLE');
    // An Experience the server no longer serves cannot be opened: no stale relation screen.
    c.openRelations(id(99));
    await flush();
    expect(c.getState()).toMatchObject({ screen: 'RELATIONS', status: 'UNAVAILABLE' });
  });
});

// ------------------------------------------------------------------------------------------------- the field lines
describe('S5-03C — explicit relation lines in the ONE Public field', () => {
  const SIZE = { width: 400, height: 800 };
  const GLASS = viewportEnvelope(SIZE.width, SIZE.height)!;
  const INSETS = { top: 44, right: 0, bottom: 0, left: 0 };

  it('segments exist only at NEAR, for the selected Experience, from what the server served — never from nearness', () => {
    const relations = [{ relationId: RELATION, other: E3 }];
    const near = focusField(E1.address);
    const placed = placePublicField({ camera: near, envelope: GLASS, entries: [E1, E2, E3], results: [], focusId: E1.id }).nodes;
    expect(explicitRelationSegments(near, placed, E1.id, relations).map((s) => [s.relationId, s.otherMeaning])).toEqual([[RELATION, E3.meaning]]);
    // E2 is E1's neighbour in the SAME region: no relation was served, so there is no segment.
    expect(explicitRelationSegments(near, placed, E1.id, [])).toEqual([]);
    const far = wholeWorldCamera();
    const mid = zoomField(far, 'IN');
    if (mid.outcome !== 'MOVED') throw new Error('fixture');
    for (const camera of [far, mid.camera]) {
      const nodes = placePublicField({ camera, envelope: GLASS, entries: [E1, E2, E3], results: [], focusId: E1.id }).nodes;
      expect(explicitRelationSegments(camera, nodes, E1.id, relations)).toEqual([]);
    }
    expect(explicitRelationSegments(near, placed, null, relations)).toEqual([]);
    // A relation is not geography: the places are exactly where they are without it.
    const without = placePublicField({ camera: near, envelope: GLASS, entries: [E1, E2, E3], results: [], focusId: E1.id }).nodes;
    expect(without.map((node) => [node.key, node.x, node.y])).toEqual(placed.map((node) => [node.key, node.x, node.y]));
  });

  async function mount(panels: Record<string, () => PublicFieldPanel>) {
    const transport = {
      field: jest.fn(async () => yes([E1, E2, E3])),
      search: jest.fn(async () => yes([])),
      experience: jest.fn(async (experienceId: string) => yes(panels[experienceId]())),
    };
    const field = createPublicFieldController({ transport: transport as unknown as PublicFieldTransport, isCurrent: () => true });
    const controller = createPublicWorldController({ transport: { entry: jest.fn(async () => ({ kind: 'ALLOW' as const })) }, isCurrent: () => true, field });
    const view = await render(<AppearanceProvider authority={appearance()}><PublicWorldArea controller={controller} language="en" insets={INSETS} /></AppearanceProvider>);
    for (let k = 0; k < 4; k += 1) await flush();
    await resize(view, SIZE.width, SIZE.height, { mapHeight: SIZE.height });
    await flush();
    return { view, field, transport };
  }
  const tethers = (view: { toJSON: () => unknown }) => {
    const found: Record<string, unknown>[] = [];
    const walk = (node: unknown): void => {
      if (node === null || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      const record = node as { props?: Record<string, unknown>; children?: unknown[] };
      if (record.props?.skiaElement === 'Path' && typeof record.props.path === 'string' && / L /u.test(record.props.path as string)) found.push(record.props);
      for (const child of record.children ?? []) walk(child);
    };
    walk(view.toJSON());
    return found;
  };

  it('draws the selected Experience\'s explicit relation in the canonical connection style, accessible by the other\'s meaning', async () => {
    let relations = [{ relationId: RELATION, other: E3 }];
    const { view, field } = await mount({ [E1.id]: () => panelOf(E1, relations, [E2]), [E2.id]: () => panelOf(E2), [E3.id]: () => panelOf(E3, [{ relationId: RELATION, other: E1 }]) });
    expect(tethers(view)).toHaveLength(0);
    await act(async () => { field.focus(E1.id); });
    await flush();
    expect(field.getState()).toMatchObject({ camera: { depth: 'NEAR' }, focus: { id: E1.id, panel: { status: 'SERVED' } } });
    // One relation, one straight line (the canonical tether: ground, body, glow, core — all along the same span).
    const spans = new Set(tethers(view).map((p) => p.path));
    expect(spans.size).toBe(1);
    const line = view.getByTestId(`qandeel-public-explicit-relation-${RELATION}`, { includeHiddenElements: true });
    expect(line.props.accessibilityLabel).toBe('Relation with meaning 3');
    expect(line.props.accessible).toBe(true);
    expect(line.props.accessibilityRole).toBeUndefined();
    expect(line.props.onPress).toBeUndefined();
    expect(line.props.pointerEvents).toBe('none');
    // The neighbour in the same region has no relation and no line, and no accessible element announces it as one.
    expect(view.queryAllByLabelText(/Relation with meaning 2/u, { includeHiddenElements: true })).toHaveLength(0);
    // DISAPPEARANCE: the next read serves no relation (removed, stale, or the other endpoint no longer served) — the line
    // and its accessible name go at once; nothing kept from the earlier read draws it again.
    relations = [];
    await act(async () => { field.revalidate(); });
    await flush();
    expect(tethers(view)).toHaveLength(0);
    expect(view.queryByTestId(`qandeel-public-explicit-relation-${RELATION}`, { includeHiddenElements: true })).toBeNull();
  });

  it('no line at FAR or MID, and none once the selection is released', async () => {
    const { view, field } = await mount({ [E1.id]: () => panelOf(E1, [{ relationId: RELATION, other: E3 }]), [E2.id]: () => panelOf(E2), [E3.id]: () => panelOf(E3) });
    await act(async () => { field.step('IN'); });
    await flush();
    expect(field.getState().camera?.depth).toBe('MID');
    expect(tethers(view)).toHaveLength(0);
    await act(async () => { field.focus(E1.id); });
    await flush();
    expect(tethers(view).length).toBeGreaterThan(0);
    await act(async () => { field.back(); });
    await flush();
    expect(field.getState().focus).toBeNull();
    expect(tethers(view)).toHaveLength(0);
  });

  it('an endpoint that is no longer served takes its line with it, and the panel that disappears takes all of them', async () => {
    let absent = false;
    const { view, field } = await mount({
      [E1.id]: () => (absent ? { kind: 'ABSENT' } : panelOf(E1, [{ relationId: RELATION, other: E3 }])), [E2.id]: () => panelOf(E2), [E3.id]: () => panelOf(E3),
    });
    await act(async () => { field.focus(E1.id); });
    await flush();
    expect(tethers(view).length).toBeGreaterThan(0);
    absent = true;
    await act(async () => { field.revalidate(); });
    await flush();
    expect(tethers(view)).toHaveLength(0);
    expect(view.queryByTestId(`qandeel-public-explicit-relation-${RELATION}`, { includeHiddenElements: true })).toBeNull();
    // The decorative atmosphere is never announced as anything: the only accessible names in the world frame are the
    // places' own meanings and the field's own name.
    expect(view.queryAllByLabelText(/Relation with/u, { includeHiddenElements: true })).toHaveLength(0);
    expect(publicFieldCopy('en').fieldLabel).not.toMatch(/relation/iu);
  });
});

// ---------------------------------------------------------------------------------------------- the Copy Gate census
describe('S5-03C — one Product Copy Gate, CLOSED by the Product Owner', () => {
  it('every new row APPROVED in both languages exactly as proposed; none left PROPOSED; frozen words reused byte-exact', () => {
    expect(PUBLIC_RELATION_COPY_GATE.status).toBe('S5-03C PRODUCT COPY GATE — CLOSED — 13 rows APPROVED (Product Owner, 2026-10-07)');
    expect(PUBLIC_RELATION_COPY_GATE.approved).toHaveLength(13);
    expect(PUBLIC_RELATION_COPY_GATE.proposed).toEqual([]);
    const source = readFileSync(join(__dirname, '..', 'relation-copy.ts'), 'utf8');
    expect(source.match(/\/\/ APPROVED — S5-03C Product Copy Gate \(Product Owner, 2026-10-07\)/gu)).toHaveLength(26);
    expect(source).not.toMatch(/PROPOSED — S5-03C/u);
    for (const language of ['ar', 'en'] as const) {
      const copy = publicRelationCopy(language);
      for (const key of PUBLIC_RELATION_COPY_GATE.approved) expect(copy[key].length).toBeGreaterThan(0);
      expect(copy.relationWith).toContain('{0}');
      expect(copy.withYours).toContain('{0}');
      expect(copy.searchLabel).toBe(publicFieldCopy(language).searchLabel);
      expect(copy.noResults).toBe(publicFieldCopy(language).noResults);
      // No row speaks of nearness, similarity, strength, a count or QANDEEL finding a relation.
      expect(Object.values(copy).join(' ')).not.toMatch(/similar|near|close to|strength|score|suggest|found|قريب|مشابه|اقتراح|قوة/iu);
    }
    expect(publicRelationCopy('ar').relationWith).toBe('علاقة مع {0}');
    expect(publicRelationCopy('en').relationWith).toBe('Relation with {0}');
  });
});
