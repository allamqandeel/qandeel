/**
 * COSMOS-INT-01 Slice B — the Public and Shared owners over the PRODUCTION field controllers (S5-03B, SHARED-VIS-01),
 * headless: what the stage is given to draw is exactly what the controller holds, every act is the controller's own, and
 * the product facts the retired field views were proven on hold on the stage's own terms:
 *   - FAR is mass (no place is a target); MID names each place (its label at the MID rung); NEAR is the focus;
 *   - a place the server no longer serves leaves the stage at once (nothing held stands in for it);
 *   - the focused Experience's explicit relations are the only strand, at NEAR, each with its approved accessible name
 *     (S5-03C), and none at FAR or MID or once the focus is released;
 *   - the accessible label of a place is its served meaning (or title), and nothing else.
 */
import { analysisCopy } from '../../../analysis-language';
import { projectAddress, viewportEnvelope } from '../../../map/camera';
import { canonicalWorldAddress, type CanonicalWorldAddress } from '../../../map/world';
import { createPublicFieldController, type PublicFieldTransport } from '../../../public-world/field/public-field-controller';
import type { PublicAuthoringAnswer, PublicFieldEntry, PublicFieldPanel, SharedFieldEntry, SharedFieldPlace, SharedFieldResult, SharedPlaceResult } from '../../../runtime-entry';
import { createSharedFieldController, type SharedFieldTransport } from '../../../shared-world/field/shared-field-controller';
import { publicScene } from '../../core/adapters';
import { compileStage } from '../../core/stage';
import { ORIGIN } from '../owner-core';
import { createPublicCosmosOwner, createSharedCosmosOwner } from '..';

const GLASS = viewportEnvelope(400, 800, { top: 104, bottom: 180 })!;
const tick = () => new Promise((resolve) => setImmediate(resolve));
/** The controller's read after an act: the transport answers, the controller publishes. */
const flush = async () => { for (let n = 0; n < 4; n += 1) await tick(); };
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const yes = <T,>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });
const at = (x: bigint, y: bigint): CanonicalWorldAddress => {
  const a = canonicalWorldAddress(x, y);
  if (!a.ok) throw new Error('fixture');
  return a.address;
};
const entry = (n: number, x: bigint, y: bigint, region = 'family.fear'): PublicFieldEntry => ({ id: id(n), address: at(x, y), meaning: `meaning ${n}`, region });
const E1 = entry(1, 300_000n, 600_000n);
const E2 = entry(2, 315_000n, 608_000n);
const E3 = entry(3, 360_000n, 560_000n, 'hope.waiting');
const RELATION = id(40);
const panelOf = (e: PublicFieldEntry, relations: { relationId: string; other: PublicFieldEntry }[] = [], nearby: PublicFieldEntry[] = []): PublicFieldPanel => ({
  kind: 'SERVED',
  experience: {
    entry: e, primaryThemes: ['fear'], secondaryThemes: [], publisher: { mode: 'PSEUDONYM', label: 'nightlamp27' }, publishedAt: '2026-10-07T10:00:00.000Z',
    discussionCount: 0, content: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'the public words' }], nearby, relations,
  },
});

describe('the Public owner over the production PublicFieldController', () => {
  function mount(served: PublicFieldEntry[] = [E1, E2, E3], relations: { relationId: string; other: PublicFieldEntry }[] = []) {
    const transport = {
      field: jest.fn(async () => yes(served)),
      search: jest.fn(async (query: string) => yes(served.filter((e) => e.meaning.includes(query) || e.region.includes(query)))),
      experience: jest.fn(async (experienceId: string) => yes(panelOf(served.find((e) => e.id === experienceId)!, experienceId === E1.id ? relations : [], [E2]))),
    };
    const controller = createPublicFieldController({ transport: transport as unknown as PublicFieldTransport, isCurrent: () => true });
    const owner = createPublicCosmosOwner(controller, 'en');
    owner.setGlass(GLASS);
    controller.enter();
    return { transport, controller, owner };
  }

  it('reads what the controller holds: READY with one entity per served Experience, the whole-world evidence, no target at FAR, a name at MID', async () => {
    const { owner, controller } = mount();
    expect(owner.getSnapshot().status).toBe('LOADING');
    await flush();
    const s = owner.getSnapshot();
    expect(s).toMatchObject({ world: 'PUBLIC', status: 'READY', rung: 0, rungs: 3, entityCount: 3, focusId: null, relations: [], unplaced: [] });
    expect(s.shown.map((p) => p.id).sort()).toEqual([E1.id, E2.id, E3.id].sort());
    expect(s.worldIndex?.map((p) => p.id).sort()).toEqual([E1.id, E2.id, E3.id].sort());
    // FAR: mass — no hit and no label; MID: every place is a hit, named by its meaning.
    expect(s.list.layers[0].hits).toHaveLength(0);
    expect(s.list.layers[0].labels).toHaveLength(0);
    expect(s.list.layers[1].hits.map((h) => h.id).sort()).toEqual([E1.id, E2.id, E3.id].sort());
    expect(s.list.layers[1].labels.map((l) => l.text).sort()).toEqual(['meaning 1', 'meaning 2', 'meaning 3']);
    expect(owner.labelOf(E1.id)).toBe('meaning 1');
    expect(controller.getState().camera?.depth).toBe('FAR');
    owner.dispose();
    controller.retire();
  });

  it('every act is the controller\'s own: a FAR tap discloses at MID, a step is one semantic step, NEAR is the focus nearest the centre, Back releases it', async () => {
    const { owner, controller } = mount();
    await flush();
    // A tap on E1's place at FAR (mass: not a target) is the controller's own tapField at that point: MID about it.
    const p = projectAddress(controller.getState().camera!, GLASS, E1.address)!;
    expect(owner.tap(p.x, p.y, owner.getSnapshot().camera)).toBe('FIELD');
    await flush();
    expect(controller.getState().camera?.depth).toBe('MID');
    expect(owner.getSnapshot().rung).toBe(1);
    expect(owner.step('IN', null, null)).toEqual({ applied: true, aboutFingers: false });
    await flush();
    expect(controller.getState()).toMatchObject({ camera: { depth: 'NEAR' }, focus: { id: E1.id } });
    expect(owner.getSnapshot()).toMatchObject({ rung: 2, focusId: E1.id });
    expect(owner.back()).toBe(true);
    await flush();
    expect(controller.getState()).toMatchObject({ camera: { depth: 'MID' }, focus: null });
    expect(owner.getSnapshot().focusId).toBeNull();
    // OUT of MID is a step; at FAR there is nothing to go back to.
    expect(owner.back()).toBe(true);
    await flush();
    expect(owner.getSnapshot().rung).toBe(0);
    expect(owner.back()).toBe(false);
    owner.dispose();
    controller.retire();
  });

  it('S5-03C: the focused Experience\'s served relations are the only strand, at NEAR, each with its approved accessible name; none elsewhere', async () => {
    const { owner, controller } = mount([E1, E2, E3], [{ relationId: RELATION, other: E3 }]);
    await flush();
    expect(owner.getSnapshot().list.layers[2].lines).toHaveLength(0);
    owner.focus(E1.id);
    await flush();
    const near = owner.getSnapshot();
    expect(near).toMatchObject({ rung: 2, focusId: E1.id, relations: [{ id: RELATION, label: 'Relation with meaning 3' }] });
    // The strand is compiled at the last rung only, from the served relation (E2, the neighbour in the same region, has
    // none): the same scene without the relation has fewer hairlines at NEAR, and the same at FAR and MID.
    const facts = { entries: [E1, E2, E3], focusId: E1.id, section: null, rtl: false } as const;
    const withTie = compileStage(publicScene({ ...facts, relatedIds: [E3.id] }, ORIGIN));
    const without = compileStage(publicScene({ ...facts, relatedIds: [] }, ORIGIN));
    expect(near.list.layers[2].lines.length).toBe(withTie.layers[2].lines.length);
    expect(withTie.layers[2].lines.length).toBeGreaterThan(without.layers[2].lines.length);
    expect(withTie.layers[0].lines.length).toBe(without.layers[0].lines.length);
    expect(withTie.layers[1].lines.length).toBe(without.layers[1].lines.length);
    expect(near.list.layers[0].lines).toHaveLength(0);
    owner.back();
    await flush();
    expect(owner.getSnapshot()).toMatchObject({ rung: 1, focusId: null, relations: [] });
    expect(owner.getSnapshot().list.layers[2].lines).toHaveLength(0);
    owner.dispose();
    controller.retire();
  });

  it('a place the server no longer serves leaves the stage at once; the whole-world evidence is what the entry read established', async () => {
    const { owner, controller, transport } = mount();
    await flush();
    transport.field.mockImplementation(async () => yes([E1, E3]));
    controller.revalidate();
    await flush();
    const s = owner.getSnapshot();
    expect(s.entityCount).toBe(2);
    expect(s.shown.map((p) => p.id).sort()).toEqual([E1.id, E3.id].sort());
    expect(s.list.layers[1].hits.map((h) => h.id)).not.toContain(E2.id);
    expect(owner.labelOf(E2.id)).toBe('');
    // Problem 7: the whole-world evidence is the entry read's, not re-read from a later viewport answer.
    expect(s.worldIndex).toHaveLength(3);
    owner.dispose();
    controller.retire();
  });

  it('the stage names what the Analysis names: the field words are the Living Analysis words', () => {
    expect(analysisCopy('en').moreDetail).toBeTruthy();
    expect(analysisCopy('ar').lessDetail).toBeTruthy();
  });
});

describe('the Shared owner over the production SharedFieldController', () => {
  const WORLD_A = '11111111-0000-4000-8000-00000000000a';
  const sharedEntry = (n: number, x: bigint, y: bigint, region = 'home.move'): SharedFieldEntry => ({ id: id(n), address: at(x, y), meaning: `meaning ${n}`, region });
  const A1 = sharedEntry(1, 300_000n, 600_000n);
  const A2 = sharedEntry(2, 315_000n, 608_000n);
  const A3 = sharedEntry(3, -1_000_000n, -1_500_000n, 'family.care');
  const placeOf = (e: SharedFieldEntry): SharedFieldPlace => ({
    entry: e, primaryThemes: ['home'], secondaryThemes: ['postponing'], establishedAt: '2026-10-08T10:00:00.000Z',
    sources: [
      { materialId: id(101), producer: 'SELF', authorName: null, text: 'my words', establishedAt: '2026-10-08T09:00:00.000Z' },
      { materialId: id(102), producer: 'HUMAN', authorName: 'Fixture Hadir', text: 'their words', establishedAt: '2026-10-08T09:01:00.000Z' },
    ],
  });
  function mount(entries: SharedFieldEntry[] = [A1, A2, A3]) {
    const transport = {
      field: jest.fn(async (): Promise<SharedFieldResult> => ({ kind: 'READ', entries })),
      place: jest.fn(async (_worldId: string, placeId: string): Promise<SharedPlaceResult> => {
        const e = entries.find((x) => x.id === placeId);
        return e === undefined ? { kind: 'ABSENT' } : { kind: 'READ', place: placeOf(e) };
      }),
    };
    const controller = createSharedFieldController({ transport: transport as unknown as SharedFieldTransport, isCurrent: () => true });
    const owner = createSharedCosmosOwner(controller, 'ar');
    owner.setGlass(GLASS);
    controller.open(WORLD_A);
    return { transport, controller, owner };
  }

  it('reads the open World as the controller holds it, in the reader\'s direction, and names each place by its meaning', async () => {
    const { owner, controller } = mount();
    await flush();
    const s = owner.getSnapshot();
    expect(s).toMatchObject({ world: 'SHARED', status: 'READY', rung: 0, rungs: 3, entityCount: 3, focusId: null, relations: [] });
    expect(s.list.layers[0].hits).toHaveLength(0);
    expect(s.list.layers[1].labels.map((l) => l.text).sort()).toEqual(['meaning 1', 'meaning 2', 'meaning 3']);
    expect(owner.labelOf(A3.id)).toBe('meaning 3');
    // The membership horizon encloses every served place (nothing is drawn outside it).
    expect(s.list.horizon).not.toBeNull();
    owner.dispose();
    controller.retire();
  });

  it('FAR → MID → NEAR by the controller\'s own steps; NEAR focuses the place nearest the centre and reads its panel; Back releases it', async () => {
    const { owner, controller, transport } = mount();
    await flush();
    // FAR → MID about A1's place (the controller's own tapField), then one step IN: NEAR focuses the place nearest the centre.
    const p = projectAddress(controller.getState().camera!, GLASS, A1.address)!;
    expect(owner.tap(p.x, p.y, owner.getSnapshot().camera)).toBe('FIELD');
    await flush();
    expect(controller.getState().camera?.depth).toBe('MID');
    expect(owner.step('IN', null, null).applied).toBe(true);
    await flush();
    expect(controller.getState()).toMatchObject({ camera: { depth: 'NEAR' }, focus: { id: A1.id, panel: { status: 'SERVED' } } });
    expect(transport.place).toHaveBeenCalledWith(WORLD_A, A1.id);
    expect(owner.getSnapshot()).toMatchObject({ rung: 2, focusId: A1.id });
    expect(owner.back()).toBe(true);
    await flush();
    expect(controller.getState()).toMatchObject({ camera: { depth: 'MID' }, focus: null });
    owner.dispose();
    controller.retire();
  });

  it('a closed World is nothing on the stage: LOADING, no entity, no evidence', async () => {
    const { owner, controller } = mount();
    await flush();
    controller.close();
    await flush();
    expect(owner.getSnapshot()).toMatchObject({ status: 'LOADING', entityCount: 0, shown: [], worldIndex: null });
    owner.dispose();
    controller.retire();
  });
});
