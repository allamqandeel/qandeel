/**
 * COSMOS E-2 corrections, Slice C (the Product Owner's D-5, Option U, 2026-11-20) — the CURRENT Personal World's owner,
 * headless: what the stage is given to draw is exactly what the current-world controller holds (one Thread entity per
 * served Thread, at its ONE Home, named as served, never invented); the acts are the field owner's own over a LOCAL
 * camera (FAR mass → MID names → NEAR focus → Back); a Thread the world no longer serves leaves the stage and loses its
 * focus; the family word is the accessible label, with the served name when there is one. No kernel is written: the
 * controller is the only thing read, and the host is told of the focus.
 */
import type { CurrentPersonalThread } from '@qandeel/runtime';

import { analysisCopy } from '../../../analysis-language';
import { createCurrentPersonalWorldController, type CurrentPersonalWorldController } from '../../../conversation/current-personal-world-controller';
import { projectAddress, viewportEnvelope } from '../../../map/camera';
import { canonicalWorldAddress } from '../../../map/world';
import { wholeWorldCamera } from '../../../public-world/field/public-field-camera';
import type { CurrentPersonalWorldOutcome } from '../../../runtime-entry';
import { createCurrentPersonalCosmosOwner, currentThreadIdOf, currentThreadMarkId } from '..';

const GLASS = viewportEnvelope(400, 800, { top: 104, bottom: 180 })!;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const flush = async () => { for (let n = 0; n < 4; n += 1) await tick(); };
const SESSION = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const thread = (id: string, x: string, y: string, name: CurrentPersonalThread['name'], origin = { sessionId: SESSION, sp: 2 }): CurrentPersonalThread => ({ id, home: { x, y }, name, origin });
const T1 = thread('thread-1', '300000', '600000', { text: 'مديري', source: 'GROUNDING_WORDING' });
const T2 = thread('thread-2', '315000', '608000', { text: 'My plan', source: 'USER_ALIAS' }, { sessionId: OTHER, sp: 3 });
const T3 = thread('thread-3', '-1000000', '-1500000', { text: null, source: 'NONE' });

function mount(language: 'en' | 'ar' = 'en') {
  let served: CurrentPersonalThread[] = [T1, T2, T3];
  let answer: () => CurrentPersonalWorldOutcome = () => ({ kind: 'READ', world: { asOf: '2026-11-20T10:00:00.000Z', threads: served } });
  const transport = { read: jest.fn(async () => answer()) };
  const world: CurrentPersonalWorldController = createCurrentPersonalWorldController({ transport, isCurrent: () => true });
  const onFocus = jest.fn();
  const owner = createCurrentPersonalCosmosOwner({ world, language, onFocus });
  owner.setGlass(GLASS);
  return {
    transport, world, owner, onFocus,
    serve(threads: CurrentPersonalThread[]) { served = threads; },
    fail() { answer = () => ({ kind: 'UNAVAILABLE', detail: 'down' }); },
  };
}

describe('the CURRENT Personal World owner (Slice C, D-5 Option U)', () => {
  it('is empty until the world is read, then holds one Thread entity per served Thread at its Home, a target from FAR and named at MID as served', async () => {
    const { owner, world, transport } = mount();
    expect(owner.getSnapshot()).toMatchObject({ world: 'PERSONAL', status: 'LOADING', entityCount: 0, focusId: null });
    expect(transport.read).not.toHaveBeenCalled();
    world.refresh();
    await flush();
    const s = owner.getSnapshot();
    expect(s).toMatchObject({ world: 'PERSONAL', status: 'READY', rung: 0, rungs: 3, entityCount: 3, focusId: null, relations: [], unplaced: [] });
    const ids = [T1, T2, T3].map((t) => currentThreadMarkId(t.id)).sort();
    expect(s.shown.map((p) => p.id).sort()).toEqual(ids);
    expect(s.worldIndex?.map((p) => p.id).sort()).toEqual(ids);
    // The Personal stage's own rule: a topic is a target from FAR (unlike a Public place), named at MID.
    expect(s.list.layers[0].hits.map((h) => h.id).sort()).toEqual(ids);
    expect(s.list.layers[1].hits.map((h) => h.id).sort()).toEqual(ids);
    // MID labels are the SERVED names only: the unnamed Thread has no label (nothing is invented for it).
    expect(s.list.layers[1].labels.map((l) => l.text).sort()).toEqual(['My plan', 'مديري']);
    expect(currentThreadIdOf(currentThreadMarkId('thread-1'))).toBe('thread-1');
    expect(currentThreadIdOf('PLACE:x')).toBeNull();
    owner.dispose();
  });

  it.each(['en', 'ar'] as const)('%s: the accessible label is the family word, with the served name when there is one', async (language) => {
    const copy = analysisCopy(language);
    const { owner, world } = mount(language);
    world.refresh();
    await flush();
    expect(owner.labelOf(currentThreadMarkId('thread-1'))).toBe(`${copy.family.THREAD} · مديري`);
    expect(owner.labelOf(currentThreadMarkId('thread-2'))).toBe(`${copy.family.THREAD} · My plan`);
    expect(owner.labelOf(currentThreadMarkId('thread-3'))).toBe(copy.family.THREAD);
    expect(owner.labelOf('THREAD:unknown')).toBe(copy.family.THREAD);
    owner.dispose();
  });

  it('a FAR tap on a Thread focuses it (the Personal rule) and tells the host; Back releases the focus to MID; a step IN from MID focuses the nearest; Back out to FAR', async () => {
    const { owner, world, onFocus } = mount();
    world.refresh();
    await flush();
    const decoded = canonicalWorldAddress(BigInt(T1.home.x), BigInt(T1.home.y));
    if (!decoded.ok) throw new Error('fixture');
    const p = projectAddress(wholeWorldCamera(), GLASS, decoded.address);
    expect(p).not.toBeNull();
    expect(owner.tap(p!.x, p!.y, owner.getSnapshot().camera)).toBe('FOCUS');
    expect(owner.getSnapshot()).toMatchObject({ rung: 2, focusId: currentThreadMarkId('thread-1') });
    expect(onFocus).toHaveBeenLastCalledWith('thread-1');
    expect(owner.back()).toBe(true);
    expect(owner.getSnapshot()).toMatchObject({ rung: 1, focusId: null });
    expect(onFocus).toHaveBeenLastCalledWith(null);
    // From MID, one step IN is the focus of the Thread nearest the camera (it stayed over thread-1).
    expect(owner.step('IN', null, null).applied).toBe(true);
    expect(owner.getSnapshot()).toMatchObject({ rung: 2, focusId: currentThreadMarkId('thread-1') });
    expect(owner.back()).toBe(true);
    expect(owner.getSnapshot().rung).toBe(1);
    expect(owner.back()).toBe(true);
    expect(owner.getSnapshot().rung).toBe(0);
    expect(owner.back()).toBe(false);
    owner.dispose();
  });

  it('a direct focus names the Thread to the host; a Thread the world no longer serves leaves the stage and loses its focus; an unreadable world is UNAVAILABLE', async () => {
    const { owner, world, onFocus, serve, fail } = mount();
    world.refresh();
    await flush();
    owner.focus(currentThreadMarkId('thread-2'));
    expect(owner.getSnapshot()).toMatchObject({ rung: 2, focusId: currentThreadMarkId('thread-2') });
    expect(onFocus).toHaveBeenLastCalledWith('thread-2');
    serve([T1, T3]);
    world.refresh();
    await flush();
    expect(owner.getSnapshot()).toMatchObject({ status: 'READY', entityCount: 2, focusId: null });
    expect(onFocus).toHaveBeenLastCalledWith(null);
    expect(owner.getSnapshot().shown.map((p) => p.id)).not.toContain(currentThreadMarkId('thread-2'));
    fail();
    world.refresh();
    await flush();
    expect(owner.getSnapshot()).toMatchObject({ status: 'UNAVAILABLE', entityCount: 0 });
    owner.dispose();
    world.retire();
  });
});
