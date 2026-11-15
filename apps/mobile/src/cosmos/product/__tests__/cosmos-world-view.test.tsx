/**
 * COSMOS-INT-01 Slice B — the stage view over an owner: what it shows and what it asks of the authority. The owner here
 * is a recording stand-in with the owner's exact seam, so each visible control is proven to relay ONE act and to decide
 * nothing itself. The stage's words are the product copy's; the rail's Personal names are T-08's depth words.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';

import { viewportEnvelope } from '../../../map/camera';
import { semanticDepthWord } from '../../../orientation-chrome';
import { compileStage } from '../../core/stage';
import { COSMOS_BACK_TEST_ID, COSMOS_NEAREST_TEST_ID, COSMOS_OVERVIEW_TEST_ID, COSMOS_RAIL_TEST_ID, COSMOS_REGISTER_TEST_ID, CosmosWorldView, cosmosProductCopy, type CosmosWorldOwner, type CosmosWorldSnapshot } from '..';

const GLASS = viewportEnvelope(390, 844, { top: 104, bottom: 220 })!;

type Act = { kind: string; args: unknown[] };

function fakeOwner(initial: Partial<CosmosWorldSnapshot>) {
  const acts: Act[] = [];
  const listeners = new Set<() => void>();
  let snapshot: CosmosWorldSnapshot = {
    world: 'PERSONAL', status: 'READY', list: compileStage({ world: 'PERSONAL', rungs: 5, entities: [], focusId: null, rtl: false }), held: [true, true, true, true, true], rungs: 5,
    rung: 0, camera: { cx: 0, cy: 0, scale: 1 }, focusId: null, inspectedId: null, shown: [], worldIndex: null, entityCount: 0, unplaced: [], relations: [], ...initial,
  };
  const set = (next: Partial<CosmosWorldSnapshot>) => { snapshot = { ...snapshot, ...next }; for (const l of Array.from(listeners)) l(); };
  const record = (kind: string, ...args: unknown[]) => { acts.push({ kind, args }); };
  const owner: CosmosWorldOwner = {
    getSnapshot: () => snapshot,
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    setGlass: (glass) => record('setGlass', glass),
    pan: (released) => { record('pan', released); return true; },
    step: (direction, focal, released) => {
      record('step', direction, focal, released);
      const rung = snapshot.rung + (direction === 'IN' ? 1 : -1);
      if (rung < 0 || rung >= snapshot.rungs) return { applied: false, aboutFingers: false };
      set({ rung, camera: { ...snapshot.camera, scale: Math.pow(8, rung) } });
      return { applied: true, aboutFingers: focal !== null };
    },
    tap: (x, y, released) => { record('tap', x, y, released); return 'NONE'; },
    focus: (id) => { record('focus', id); set({ inspectedId: id }); },
    back: () => { record('back'); if (snapshot.rung === 0) return false; set({ rung: snapshot.rung - 1 }); return true; },
    goTo: (x, y) => { record('goTo', x, y); set({ camera: { ...snapshot.camera, cx: x, cy: y } }); return true; },
    labelOf: (id) => `label:${id}`,
    dispose: () => record('dispose'),
  };
  return { owner, acts, set };
}

const mount = async (owner: CosmosWorldOwner, language: 'ar' | 'en' = 'en') => render(
  <CosmosWorldView owner={owner} world="PERSONAL" language={language} glass={GLASS} worldLabel="Map" zoomInLabel="More" zoomOutLabel="Less" />,
);
const press = async (view: RenderResult, testID: string) => { await act(async () => { fireEvent.press(view.getByTestId(testID)); }); };
let view: RenderResult | null = null;
afterEach(async () => { await cleanup(); view = null; });

describe('CosmosWorldView — the stage over an owner', () => {
  it('hands the host glass to the owner before anything is drawn, and labels the stage with the world and its rung', async () => {
    const { owner, acts } = fakeOwner({});
    view = await mount(owner);
    expect(acts[0]).toEqual({ kind: 'setGlass', args: [GLASS] });
    expect(view.getByLabelText(`Map · ${semanticDepthWord('en', 'WORLD')}`)).toBeTruthy();
  });

  it('the rail names the Personal rungs with T-08 depth words; a shallower bead steps OUT to it, one canonical step at a time', async () => {
    const { owner, acts, set } = fakeOwner({});
    set({ rung: 2, camera: { cx: 0, cy: 0, scale: 64 } });
    view = await mount(owner);
    const rail = view.getByTestId(COSMOS_RAIL_TEST_ID);
    const names = ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'].map((d) => semanticDepthWord('en', d as never));
    for (const name of names) expect(view.getByLabelText(name)).toBeTruthy();
    expect(rail).toBeTruthy();
    acts.length = 0;
    await act(async () => { fireEvent.press(view!.getByLabelText(names[0])); });
    expect(acts.filter((a) => a.kind === 'step').map((a) => a.args[0])).toEqual(['OUT', 'OUT']);
    expect(owner.getSnapshot().rung).toBe(0);
  });

  it('Back names the shallower rung and asks the owner once; at home it stands down', async () => {
    const { owner, acts, set } = fakeOwner({});
    set({ rung: 1, camera: { cx: 0, cy: 0, scale: 8 } });
    view = await mount(owner);
    const back = view.getByTestId(COSMOS_BACK_TEST_ID);
    expect(back.props.accessibilityLabel).toBe(`← ${semanticDepthWord('en', 'WORLD')}`);
    acts.length = 0;
    await press(view, COSMOS_BACK_TEST_ID);
    expect(acts.map((a) => a.kind)).toEqual(['back']);
    // Home: the first rung at the origin.
    expect(view.getByTestId(COSMOS_BACK_TEST_ID).props.accessibilityState).toEqual({ disabled: true });
  });

  it('Arabic: the Back arrow points the other way; the rail stays on the RIGHT (Product Owner override, 2026-11-15) with its label inboard', async () => {
    const { owner, set } = fakeOwner({});
    set({ rung: 1, camera: { cx: 0, cy: 0, scale: 8 } });
    view = await mount(owner, 'ar');
    expect(view.getByTestId(COSMOS_BACK_TEST_ID).props.accessibilityLabel).toBe(`→ ${semanticDepthWord('ar', 'WORLD')}`);
    const flat = (node: { props: { style: unknown } }) => Object.assign({}, ...[node.props.style].flat(3).filter(Boolean)) as Record<string, unknown>;
    const style = flat(view.getByTestId(COSMOS_RAIL_TEST_ID));
    expect(style.right).toBe(GLASS.insetRight + 2);
    expect(style.left).toBeUndefined();
    // The lit bead is laid out as on the right rail in English: the label, then the dot (never row-reverse).
    const bead = view.getByLabelText(semanticDepthWord('ar', 'THREAD'));
    expect(flat(bead).flexDirection).toBe('row');
    expect(view.getByText(semanticDepthWord('ar', 'THREAD'))).toBeTruthy();
  });

  it('English: the rail is on the right as well', async () => {
    const { owner, set } = fakeOwner({});
    set({ rung: 1, camera: { cx: 0, cy: 0, scale: 8 } });
    view = await mount(owner, 'en');
    const style = Object.assign({}, ...[view.getByTestId(COSMOS_RAIL_TEST_ID).props.style].flat(3).filter(Boolean)) as Record<string, unknown>;
    expect(style.right).toBe(GLASS.insetRight + 2);
    expect(style.left).toBeUndefined();
  });

  it('Overview is presentation only: it toggles its own selected state and writes nothing to the owner', async () => {
    const { owner, acts, set } = fakeOwner({});
    set({ list: compileStage({ world: 'PERSONAL', rungs: 5, entities: [{ id: 'THREAD:a', kind: 'THREAD', x: 10, y: 10, dye: 1, label: null, fromRung: 0 }, { id: 'THREAD:b', kind: 'THREAD', x: -40, y: 30, dye: 2, label: null, fromRung: 0 }], focusId: null, rtl: false }) });
    view = await mount(owner);
    acts.length = 0;
    await press(view, COSMOS_OVERVIEW_TEST_ID);
    expect(view.getByTestId(COSMOS_OVERVIEW_TEST_ID).props.accessibilityState).toEqual({ selected: true });
    await press(view, COSMOS_OVERVIEW_TEST_ID);
    expect(view.getByTestId(COSMOS_OVERVIEW_TEST_ID).props.accessibilityState).toEqual({ selected: false });
    expect(acts.filter((a) => a.kind !== 'setGlass')).toEqual([]);
  });

  it('says only the one absence the chrome does not: a known world with nothing in this region, with the way to the nearest', async () => {
    const { owner, acts, set } = fakeOwner({});
    // A whole-world read established one place, far from the camera: REGION_EMPTY with a bearing.
    set({ worldIndex: [{ id: 'THREAD:far', x: 900, y: -300 }], shown: [] });
    view = await mount(owner);
    const copy = cosmosProductCopy('en');
    expect(view.getByText(copy.regionEmpty)).toBeTruthy();
    acts.length = 0;
    await act(async () => { fireEvent.press(view!.getByLabelText(copy.nearest)); });
    expect(acts.map((a) => a.kind)).toEqual(['goTo']);
    expect(acts[0].args).toEqual([900, -300]);
    // Loading, unavailable and an empty world are the production chrome's sentences, never this view's.
    for (const status of ['LOADING', 'UNAVAILABLE'] as const) {
      await act(async () => { set({ status, worldIndex: null }); });
      expect(view.queryByTestId(COSMOS_NEAREST_TEST_ID)).toBeNull();
    }
    await act(async () => { set({ status: 'READY', worldIndex: [], shown: [] }); });
    expect(view.queryByTestId(COSMOS_NEAREST_TEST_ID)).toBeNull();
  });

  it('G-6: the unplaced register lists each object by the owner\'s family word, and a press is one inspection', async () => {
    const { owner, acts, set } = fakeOwner({});
    set({ unplaced: [{ id: 'EMERGING_FOCUS:e1', family: 'EMERGING_FOCUS' }, { id: 'READING:r9', family: 'READING' }] });
    view = await mount(owner);
    expect(view.getByTestId(COSMOS_REGISTER_TEST_ID)).toBeTruthy();
    expect(view.getByLabelText('label:EMERGING_FOCUS:e1')).toBeTruthy();
    acts.length = 0;
    await press(view, `${COSMOS_REGISTER_TEST_ID}:READING:r9`);
    expect(acts.map((a) => a.kind)).toEqual(['focus']);
    expect(view.getByTestId(`${COSMOS_REGISTER_TEST_ID}:READING:r9`).props.accessibilityState).toEqual({ selected: true });
    await act(async () => { set({ unplaced: [] }); });
    expect(view.queryByTestId(COSMOS_REGISTER_TEST_ID)).toBeNull();
  });
});
