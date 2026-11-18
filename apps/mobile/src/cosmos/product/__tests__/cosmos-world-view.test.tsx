/**
 * COSMOS-INT-01 Slice B — the stage view over an owner: what it shows and what it asks of the authority. The owner here
 * is a recording stand-in with the owner's exact seam, so each visible control is proven to relay ONE act and to decide
 * nothing itself. The stage's words are the product copy's; the rail's Personal names are T-08's depth words.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { View } from 'react-native';

import { viewportEnvelope } from '../../../map/camera';
import { semanticDepthWord } from '../../../orientation-chrome';
import { compileStage } from '../../core/stage';
import { COSMOS_BACK_TEST_ID, COSMOS_NEAREST_TEST_ID, COSMOS_OVERVIEW_COMPANION_TEST_ID, COSMOS_OVERVIEW_TEST_ID, COSMOS_RAIL_TEST_ID, COSMOS_REGISTER_TEST_ID, COSMOS_WORLD_VIEW_TEST_ID, CosmosWorldView, cosmosProductCopy, usableCentre, type CosmosWorldOwner, type CosmosWorldSnapshot } from '..';

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

  // COSMOS-INT-01 Slice C CONTROLLED RE-ANCHOR (Product Owner, 2026-11-15, Contract v1.4 §16 U-9 / A-6): the controls keep
  // the same places in both languages — nothing is mirrored — so the Back chip stands at the left with the one arrow it
  // leads with (previous form: `→` and a row-reversed top row in Arabic).
  it('Arabic: the Back chip stands at the LEFT with the one arrow and the top row is not reversed (U-9); the rail stays on the RIGHT (Product Owner override, 2026-11-15) with its label inboard', async () => {
    const { owner, set } = fakeOwner({});
    set({ rung: 1, camera: { cx: 0, cy: 0, scale: 8 } });
    view = await mount(owner, 'ar');
    expect(view.getByTestId(COSMOS_BACK_TEST_ID).props.accessibilityLabel).toBe(`← ${semanticDepthWord('ar', 'WORLD')}`);
    const flat = (node: { props: Record<string, unknown> }) => Object.assign({}, ...[node.props.style].flat(3).filter(Boolean)) as Record<string, unknown>;
    // The top row (the one absolute row at the top inset) runs left → right in Arabic as in English.
    let top = view.getByTestId(COSMOS_BACK_TEST_ID).parent;
    while (top !== null && flat(top as never).top !== GLASS.insetTop + 6) top = top.parent;
    expect(top).not.toBeNull();
    expect(flat(top as never)).toMatchObject({ flexDirection: 'row', left: GLASS.insetLeft + 12, right: GLASS.insetRight + 12 });
    const style = flat(view.getByTestId(COSMOS_RAIL_TEST_ID));
    expect(style.right).toBe(GLASS.insetRight + 2);
    expect(style.left).toBeUndefined();
    // The lit bead is laid out as on the right rail in English: the label, then the dot (never row-reverse).
    const bead = view.getByLabelText(semanticDepthWord('ar', 'THREAD'));
    expect(flat(bead).flexDirection).toBe('row');
    expect(view.getByText(semanticDepthWord('ar', 'THREAD'))).toBeTruthy();
  });

  it('the root pins the layout direction, so a host under native RTL mirroring keeps the accepted chrome layout (rail label inboard)', async () => {
    const { owner, set } = fakeOwner({});
    set({ rung: 1, camera: { cx: 0, cy: 0, scale: 8 } });
    view = await mount(owner, 'ar');
    const root = Object.assign({}, ...[view.getByTestId(COSMOS_WORLD_VIEW_TEST_ID).props.style].flat(3).filter(Boolean)) as Record<string, unknown>;
    expect(root.direction).toBe('ltr');
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

describe("COSMOS-INT-01 Slice C — the host's three seams (Contract v1.3 §15)", () => {
  const seams = async (owner: CosmosWorldOwner, over: { home?: () => void; rail?: React.ReactNode; overviewAct?: React.ReactNode; language?: 'ar' | 'en' } = {}) => render(
    <CosmosWorldView owner={owner} world="PERSONAL" language={over.language ?? 'en'} glass={GLASS} worldLabel="Map" zoomInLabel="More" zoomOutLabel="Less"
      home={over.home} rail={over.rail} overviewAct={over.overviewAct} />,
  );
  const flat = (node: { props: Record<string, unknown> }) => Object.assign({}, ...[node.props.style].flat(3).filter(Boolean)) as Record<string, unknown>;

  it("D-3: at the first rung, away from the centre, Back is the host's canonical act (Return to World) and pans nothing itself; deeper, it is still one semantic step OUT", async () => {
    const { owner, acts, set } = fakeOwner({});
    set({ rung: 0, camera: { cx: 40, cy: -20, scale: 1 } });
    const home = jest.fn();
    view = await seams(owner, { home });
    acts.length = 0;
    await press(view, COSMOS_BACK_TEST_ID);
    expect(home).toHaveBeenCalledTimes(1);
    expect(acts.map((a) => a.kind)).toEqual(['back']);
    expect(acts.some((a) => a.kind === 'goTo')).toBe(false);
    // Deeper: the chip asks the owner for one step OUT and the host's act is not invoked.
    await act(async () => { set({ rung: 1, camera: { cx: 40, cy: -20, scale: 8 } }); });
    acts.length = 0;
    await press(view, COSMOS_BACK_TEST_ID);
    expect(home).toHaveBeenCalledTimes(1);
    expect(acts.map((a) => a.kind)).toEqual(['back']);
    expect(owner.getSnapshot().rung).toBe(0);
  });

  it("without a host act the first-rung Back pans to the centre, as before", async () => {
    const { owner, acts, set } = fakeOwner({});
    set({ rung: 0, camera: { cx: 40, cy: -20, scale: 1 } });
    view = await seams(owner);
    acts.length = 0;
    await press(view, COSMOS_BACK_TEST_ID);
    expect(acts.map((a) => a.kind)).toEqual(['back', 'goTo']);
  });

  it("the rail sits in the glass at the proof's place (bottom inset + 12, 18-point gutters), and the unplaced register stands above it", async () => {
    const { owner, set } = fakeOwner({});
    set({ unplaced: [{ id: 'READING:r9', family: 'READING' }] });
    view = await seams(owner, { rail: <View testID="host-rail" /> });
    const rail = view.getByTestId('host-rail').parent!;
    const wrap = flat(rail as never);
    expect(wrap).toMatchObject({ position: 'absolute', bottom: GLASS.insetBottom + 12, left: GLASS.insetLeft + 18, right: GLASS.insetRight + 18 });
    const register = flat(view.getByTestId(COSMOS_REGISTER_TEST_ID));
    expect(register.bottom).toBe(GLASS.insetBottom + 10 + 128);
    // Without a rail the register keeps its Slice B place.
    await act(async () => { await view!.rerender(<CosmosWorldView owner={owner} world="PERSONAL" language="en" glass={GLASS} worldLabel="Map" zoomInLabel="More" zoomOutLabel="Less" />); });
    expect(flat(view.getByTestId(COSMOS_REGISTER_TEST_ID)).bottom).toBe(GLASS.insetBottom + 10);
  });

  // COSMOS-INT-01 Slice C CONTROLLED RE-ANCHOR (Product Owner, 2026-11-15, Contract v1.4 §16 U-1 / U-3 / A-2 / U-9): the
  // row of contextual controls under the top row is retired (its acts moved into the rail's words row); the stage's one
  // other upper seam is the Overview companion, drawn under the Overview chip only while Overview is on, at the right in
  // both languages. Previous form: an `acts` seam in an absolute row at `top + 6 + 48`, row-reversed for Arabic.
  it("§16 A-2: the host's Overview companion is drawn under the Overview chip only while Overview is on, at the right, in both languages; no row of controls stands under the top row", async () => {
    for (const language of ['en', 'ar'] as const) {
      const { owner, acts, set } = fakeOwner({});
      set({ list: compileStage({ world: 'PERSONAL', rungs: 5, entities: [{ id: 'THREAD:a', kind: 'THREAD', x: 10, y: 10, dye: 1, label: null, fromRung: 0 }], focusId: null, rtl: false }) });
      view = await seams(owner, { overviewAct: <View testID="host-overview-act" />, language });
      expect(view.queryByTestId(COSMOS_OVERVIEW_COMPANION_TEST_ID)).toBeNull();
      expect(view.queryByTestId('host-overview-act')).toBeNull();
      acts.length = 0;
      await press(view, COSMOS_OVERVIEW_TEST_ID);
      const companion = flat(view.getByTestId(COSMOS_OVERVIEW_COMPANION_TEST_ID));
      expect(companion).toMatchObject({ position: 'absolute', top: GLASS.insetTop + 6 + 48, right: GLASS.insetRight + 12, alignItems: 'flex-end' });
      expect(companion.left).toBeUndefined();
      expect(companion.flexDirection).toBeUndefined();
      expect(view.getByTestId('host-overview-act')).toBeTruthy();
      // Presentation only: Overview and its companion's slot write nothing to the owner.
      expect(acts.filter((a) => a.kind !== 'setGlass')).toEqual([]);
      await press(view, COSMOS_OVERVIEW_TEST_ID);
      expect(view.queryByTestId(COSMOS_OVERVIEW_COMPANION_TEST_ID)).toBeNull();
      await act(async () => { view!.unmount(); });
    }
  });

  it('PO 2026-11-16 (§18): the usable centre is the glass centre across, and midway between the top controls and the rail down; an unmeasured row gives way to the glass band', () => {
    expect(usableCentre(GLASS, 150, 600)).toEqual({ x: 195, y: 375 });
    expect(usableCentre(GLASS, null, null)).toEqual({ x: 195, y: (104 + (844 - 220)) / 2 });
    expect(usableCentre(GLASS, 150, null)).toEqual({ x: 195, y: (150 + 624) / 2 });
    // A degenerate band (the rail above the controls) falls back to the camera's own centre.
    expect(usableCentre(GLASS, 600, 150).y).toBe(104 + (844 - 104 - 220) / 2);
  });

  it('PO 2026-11-16 (§18): in the Personal world the current depth word takes no touch, so a pinch finger on it reaches the stage; Shared keeps it as it was', async () => {
    for (const [world, expected] of [['PERSONAL', 'none'], ['SHARED', 'auto']] as const) {
      const { owner, set } = fakeOwner({ world, rungs: world === 'PERSONAL' ? 5 : 3 });
      set({ rung: 1, camera: { cx: 0, cy: 0, scale: 8 } });
      view = await render(<CosmosWorldView owner={owner} world={world} language="en" glass={GLASS} worldLabel="Map" zoomInLabel="More" zoomOutLabel="Less" />);
      const word = view.getByText(cosmosProductCopy('en').rungs[world][1]);
      let node = word.parent;
      while (node !== null && node.props.pointerEvents === undefined) node = node.parent;
      expect(node?.props.pointerEvents).toBe(expected);
      await cleanup();
    }
  });

  it('Slice E D-1 (iOS): the current Personal depth bead itself takes no touch, so a tap on the stage under it reaches the canvas; a shallower bead and Shared are unchanged', async () => {
    // On iOS, UIKit hit-tests a touch to the topmost view under the finger, and only that view's (and its ancestors')
    // recognizers see it. The canvas detector is the bead's sibling, so a bead whose own box covers the word keeps the
    // touch from the stage (diag run 44255421709 proved the mechanism for the stretched deeper beads).
    const beadOf = (label: string) => {
      let node = view!.getByText(label).parent;
      while (node !== null && node.props.accessibilityRole !== 'button') node = node.parent;
      return node;
    };
    const { owner, set } = fakeOwner({ world: 'PERSONAL', rungs: 5 });
    set({ rung: 1, camera: { cx: 0, cy: 0, scale: 8 } });
    view = await render(<CosmosWorldView owner={owner} world="PERSONAL" language="en" glass={GLASS} worldLabel="Map" zoomInLabel="More" zoomOutLabel="Less" />);
    const words = cosmosProductCopy('en').rungs.PERSONAL;
    const current = beadOf(words[1]);
    expect(current?.props.pointerEvents).toBe('none');
    // The bead is still the same disabled, selected button to assistive technology.
    expect(current?.props.accessibilityState).toEqual({ selected: true, disabled: true });
    // A shallower depth stays a working way back.
    const past = view.getAllByRole('button', { name: words[0] })[0];
    expect(past.props.pointerEvents).toBe('auto');
    await cleanup();

    const shared = fakeOwner({ world: 'SHARED', rungs: 3 });
    shared.set({ rung: 1, camera: { cx: 0, cy: 0, scale: 8 } });
    view = await render(<CosmosWorldView owner={shared.owner} world="SHARED" language="en" glass={GLASS} worldLabel="Map" zoomInLabel="More" zoomOutLabel="Less" />);
    expect(beadOf(cosmosProductCopy('en').rungs.SHARED[1])?.props.pointerEvents).toBe('auto');
    await cleanup();
  });

  it('Slice E D-1 (iOS): every depth bead is as wide as what it draws, at the rail’s right edge, never stretched over the stage', async () => {
    // Diag run 44255421709 (iPhone 17, Personal): stretched to the current word, each bead was a 179 x 44 box and the five
    // stood as a 179 x 220 block over the stage. A node tap at 323,475 and a pan from 281,437 reached beads 3 and 2 and
    // never the canvas.
    for (const world of ['PERSONAL', 'SHARED'] as const) {
      const { owner, set } = fakeOwner({ world, rungs: world === 'PERSONAL' ? 5 : 3 });
      set({ rung: 1, camera: { cx: 0, cy: 0, scale: 8 } });
      view = await render(<CosmosWorldView owner={owner} world={world} language="en" glass={GLASS} worldLabel="Map" zoomInLabel="More" zoomOutLabel="Less" />);
      const beads = cosmosProductCopy('en').rungs[world].map((name) => view!.getByRole('button', { name }));
      for (const bead of beads) expect(Object.assign({}, ...[bead.props.style].flat(3).filter(Boolean)).alignSelf).toBe('flex-end');
      await cleanup();
    }
  });
});
