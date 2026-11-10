/**
 * SHARED-VIS-01 — the Shared World's Living Analysis field: the viewer-local controller (FAR / MID /
 * NEAR over the ONE semantic-field camera, focus + panel, World-local anchors, stale-answer rejection, authority-first
 * restore, no ghost), the surface (the ONE Living Analysis surface, no temporal track, no member or QANDEEL object, an
 * honest empty World), the conversation entry and Back (D7), and the SHARED-VIS-01 Product Copy Gate census.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo, BackHandler, StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../../appearance';
import { analysisCopy } from '../../../analysis-language';
import { DEFAULT_MAP_SCALE, projectAddress, viewportEnvelope } from '../../../map/camera';
import { WORLD_VIEW_STEP_TEST_ID_SUFFIX } from '../../../map/renderer';
import { RESPONSIVE_SURFACE_TEST_ID, RESPONSIVE_TIMELINE_ROW_TEST_ID } from '../../../responsive';
import { resize } from '../../../responsive/__fixtures__/composition';
import { canonicalWorldAddress, type CanonicalWorldAddress } from '../../../map/world';
import { type SharedEntryResult, type SharedFieldEntry, type SharedFieldPlace, type SharedFieldResult, type SharedPlaceResult } from '../../../runtime-entry';
import { createSharedWorldController, type SharedWorldTransport } from '../../shared-world-controller';
import { SharedWorldArea } from '../../SharedWorldArea';
import { SHARED_FIELD_COPY_GATE, sharedFieldCopy } from '../field-copy';
import { createSharedFieldController, type SharedFieldTransport } from '../shared-field-controller';
import { SHARED_FIELD_SURFACE_TEST_ID } from '../SharedFieldView';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
// MAP-CLOSE-01 V-3 (Product Owner scope correction, 2026-11-10): the generic canvas, observed. It records the continuity the
// Shared field asks for and, only when a test says so, paints the same field WITHOUT it, so the two can be compared.
const mockContinuity: { off: boolean; seen: (boolean | undefined)[] } = { off: false, seen: [] };
jest.mock('../../../map/renderer', () => {
  const actual = jest.requireActual('../../../map/renderer');
  const { createElement } = jest.requireActual('react');
  return {
    ...actual,
    WorldCanvas: (props: { continuity?: boolean }) => {
      mockContinuity.seen.push(props.continuity);
      return createElement(actual.WorldCanvas, mockContinuity.off ? { ...props, continuity: false } : props);
    },
  };
});

const INSETS = { top: 44, right: 0, bottom: 0, left: 0 };
const SIZE = { width: 400, height: 800 };
const GLASS = viewportEnvelope(SIZE.width, SIZE.height)!;
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const WORLD_A = '11111111-0000-4000-8000-00000000000a';
const WORLD_B = '11111111-0000-4000-8000-00000000000b';
const at = (x: bigint, y: bigint): CanonicalWorldAddress => {
  const a = canonicalWorldAddress(x, y);
  if (!a.ok) throw new Error('fixture');
  return a.address;
};
const entry = (n: number, x: bigint, y: bigint, region = 'home.move'): SharedFieldEntry => ({ id: id(n), address: at(x, y), meaning: `meaning ${n}`, region });
const A1 = entry(1, 300_000n, 600_000n);
const A2 = entry(2, 315_000n, 608_000n);
const A3 = entry(3, -1_000_000n, -1_500_000n, 'family.care');
const B1 = entry(11, -700_000n, 900_000n, 'work.project');
const placeOf = (e: SharedFieldEntry): SharedFieldPlace => ({
  entry: e, primaryThemes: ['home'], secondaryThemes: ['postponing'], establishedAt: '2026-10-08T10:00:00.000Z',
  sources: [
    { materialId: id(101), producer: 'SELF', authorName: null, text: 'my words', establishedAt: '2026-10-08T09:00:00.000Z' },
    { materialId: id(102), producer: 'HUMAN', authorName: 'Fixture Hadir', text: 'their words', establishedAt: '2026-10-08T09:01:00.000Z' },
  ],
});

/** A deferred answer: resolved by the test, so ordering and staleness are deterministic. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function fieldTransport(worlds: Record<string, SharedFieldEntry[]> = { [WORLD_A]: [A1, A2, A3], [WORLD_B]: [B1] }) {
  const all = Object.values(worlds).flat();
  return {
    field: jest.fn(async (worldId: string): Promise<SharedFieldResult> => (worlds[worldId] === undefined ? { kind: 'DENIED' } : { kind: 'READ', entries: worlds[worldId] })),
    place: jest.fn(async (worldId: string, placeId: string): Promise<SharedPlaceResult> => {
      const e = (worlds[worldId] ?? []).find((x) => x.id === placeId);
      return e === undefined ? (all.some((x) => x.id === placeId) ? { kind: 'ABSENT' } : { kind: 'ABSENT' }) : { kind: 'READ', place: placeOf(e) };
    }),
  };
}
const fieldOf = (t = fieldTransport(), onDenied?: (worldId: string) => void) => {
  const c = createSharedFieldController({ transport: t as unknown as SharedFieldTransport, isCurrent: () => true, onDenied });
  c.setEnvelope(GLASS);
  return { c, t };
};

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('SHARED-VIS-01 — the Shared field controller: one World at a time, its own state', () => {
  it('opens the World as a whole, FAR, at the Map default scale — never fitted to what it holds', async () => {
    const { c, t } = fieldOf();
    c.open(WORLD_A);
    expect(c.getState()).toMatchObject({ worldId: WORLD_A, status: 'LOADING', entries: [], camera: null });
    await flush();
    expect(t.field).toHaveBeenCalledWith(WORLD_A);
    expect(c.getState()).toMatchObject({ status: 'READY', entries: [A1, A2, A3], focus: null, camera: { depth: 'FAR', scale: DEFAULT_MAP_SCALE } });
  });

  it('FAR → MID → NEAR focuses the place nearest the centre and reads its panel; Back releases it, then does nothing', async () => {
    const { c, t } = fieldOf();
    c.open(WORLD_A);
    await flush();
    const p = projectAddress(c.getState().camera!, GLASS, A1.address)!;
    c.tapField(p.x, p.y);
    expect(c.getState().camera?.depth).toBe('MID');
    expect(c.step('IN')).toEqual({ outcome: 'APPLIED' });
    await flush();
    expect(c.getState()).toMatchObject({ camera: { depth: 'NEAR' }, focus: { id: A1.id, panel: { status: 'SERVED' } } });
    expect(t.place).toHaveBeenCalledWith(WORLD_A, A1.id);
    expect(c.back()).toBe(true);
    expect(c.getState()).toMatchObject({ focus: null, camera: { depth: 'MID' } });
    expect(c.back()).toBe(false);
  });

  it('World A and World B never share a camera or a focus; returning to A restores A — after A\'s field is read again', async () => {
    const { c, t } = fieldOf();
    c.open(WORLD_A);
    await flush();
    c.focus(A3.id);
    await flush();
    const aCamera = c.getState().camera;
    expect(c.getState().focus?.id).toBe(A3.id);
    c.open(WORLD_B);
    expect(c.getState()).toMatchObject({ worldId: WORLD_B, entries: [], focus: null, camera: null });
    await flush();
    expect(c.getState()).toMatchObject({ worldId: WORLD_B, entries: [B1], focus: null, camera: { depth: 'FAR' } });
    c.close();
    expect(c.getState()).toMatchObject({ worldId: null, entries: [], camera: null, focus: null });
    const reads = t.field.mock.calls.length;
    c.open(WORLD_A);
    // Nothing of A is shown before A's field is read again (CW2-07 §43).
    expect(c.getState()).toMatchObject({ worldId: WORLD_A, entries: [], camera: null, focus: null });
    await flush();
    expect(t.field.mock.calls.length).toBe(reads + 1);
    expect(c.getState()).toMatchObject({ camera: aCamera, focus: { id: A3.id, panel: { status: 'SERVED' } } });
  });

  it('an answer for an earlier World (or an earlier open of the same World) is never shown', async () => {
    const t = fieldTransport();
    const slow = deferred<SharedFieldResult>();
    t.field.mockImplementationOnce(() => slow.promise);
    const { c } = fieldOf(t);
    c.open(WORLD_A);
    c.open(WORLD_B);
    await flush();
    expect(c.getState()).toMatchObject({ worldId: WORLD_B, entries: [B1] });
    slow.resolve({ kind: 'READ', entries: [A1, A2, A3] });
    await flush();
    expect(c.getState()).toMatchObject({ worldId: WORLD_B, entries: [B1] });
    // A late panel for a place of A while B is open is dropped too.
    const panel = deferred<SharedPlaceResult>();
    t.place.mockImplementationOnce(() => panel.promise);
    c.open(WORLD_A);
    await flush();
    c.focus(A1.id);
    c.open(WORLD_B);
    panel.resolve({ kind: 'READ', place: placeOf(A1) });
    await flush();
    expect(c.getState()).toMatchObject({ worldId: WORLD_B, focus: null });
  });

  it('a remembered focus whose place is no longer served is not restored — no ghost (CW2-07 §44)', async () => {
    const worlds: Record<string, SharedFieldEntry[]> = { [WORLD_A]: [A1, A2, A3] };
    const { c } = fieldOf(fieldTransport(worlds));
    c.open(WORLD_A);
    await flush();
    c.focus(A3.id);
    await flush();
    c.close();
    worlds[WORLD_A] = [A1, A2];
    c.open(WORLD_A);
    await flush();
    expect(c.getState()).toMatchObject({ entries: [A1, A2], focus: null, camera: { depth: 'MID' } });
  });

  it('a place that is no longer served leaves the field at once; a denial forgets the World and is handed to the area', async () => {
    const worlds: Record<string, SharedFieldEntry[]> = { [WORLD_A]: [A1, A2] };
    const t = fieldTransport(worlds);
    const denied = jest.fn();
    const { c } = fieldOf(t, denied);
    c.open(WORLD_A);
    await flush();
    t.place.mockResolvedValueOnce({ kind: 'ABSENT' });
    c.focus(A2.id);
    await flush();
    expect(c.getState()).toMatchObject({ entries: [A1], focus: { id: A2.id, panel: { status: 'ABSENT' } } });
    delete worlds[WORLD_A];
    c.revalidate();
    await flush();
    expect(denied).toHaveBeenCalledWith(WORLD_A);
    expect(c.getState()).toMatchObject({ worldId: null, entries: [], camera: null, focus: null });
  });
});

// ------------------------------------------------------------------------------------------------------ the area
const appearance = () => {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
};
const MEMBERS = [{ name: null, self: true }, { name: 'Fixture Hadir', self: false }];
function areaTransport(entry: (worldId: string) => SharedEntryResult = (worldId) => ({ kind: 'ALLOW', world: { worldId, bornAt: '2026-10-08T00:00:00Z', name: null, members: MEMBERS } })) {
  return {
    root: jest.fn(async () => ({ kind: 'READ', root: { capabilities: { invitation: true, birth: true }, worlds: [{ worldId: WORLD_A, name: null, members: MEMBERS }, { worldId: WORLD_B, name: null, members: MEMBERS }], invitations: [], closedWorlds: [], memberRequests: [] } })),
    entry: jest.fn(async (worldId: string) => entry(worldId)),
    materials: jest.fn(async () => ({ kind: 'READ', conversation: true, materials: [], hasOlder: false })),
  };
}
async function mountArea(field = fieldTransport(), transport = areaTransport()) {
  const controller = createSharedWorldController({ transport: transport as unknown as SharedWorldTransport, isCurrent: () => true, fieldTransport: field as unknown as SharedFieldTransport });
  const view = await render(<AppearanceProvider authority={appearance()}><SharedWorldArea controller={controller} language="en" insets={INSETS} /></AppearanceProvider>);
  await flush();
  return { view, controller, field, transport };
}
async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await flush();
  await flush();
}

describe('SHARED-VIS-01 — the Shared World on the ONE Living Analysis surface', () => {
  it('an ALLOWed World opens on its field; authority first: nothing of the field is read or drawn before ALLOW', async () => {
    const gate = deferred<SharedEntryResult>();
    const transport = areaTransport();
    transport.entry.mockImplementationOnce(() => gate.promise);
    const { view, field } = await mountArea(fieldTransport(), transport);
    await press(view, `qandeel-shared-world-${WORLD_A}`);
    expect(view.getByTestId('qandeel-shared-transition')).toBeTruthy();
    expect(field.field).not.toHaveBeenCalled();
    expect(view.queryByTestId('qandeel-shared-field')).toBeNull();
    await act(async () => { gate.resolve({ kind: 'ALLOW', world: { worldId: WORLD_A, bornAt: '2026-10-08T00:00:00Z', name: null, members: MEMBERS } }); });
    await flush();
    await flush();
    expect(view.getByTestId('qandeel-shared-world-field')).toBeTruthy();
    expect(field.field).toHaveBeenCalledWith(WORLD_A);
    // The one surface, composed CHROME_ONLY: no temporal track (D5); no member or QANDEEL object is drawn (D6).
    expect(view.getByTestId(RESPONSIVE_SURFACE_TEST_ID)).toBeTruthy();
    expect(view.queryByTestId(RESPONSIVE_TIMELINE_ROW_TEST_ID)).toBeNull();
    expect(view.queryByTestId('qandeel-shared-members')).toBeNull();
  });

  it('a denied World draws nothing of the field and reads none of it', async () => {
    const { view, field } = await mountArea(fieldTransport(), areaTransport(() => ({ kind: 'DENIED' })));
    await press(view, `qandeel-shared-world-${WORLD_A}`);
    expect(view.getByTestId('qandeel-shared-world-unavailable')).toBeTruthy();
    expect(view.queryByTestId('qandeel-shared-field')).toBeNull();
    expect(field.field).not.toHaveBeenCalled();
  });

  it('an empty World is shown as empty, with nothing standing in for it', async () => {
    const { view } = await mountArea(fieldTransport({ [WORLD_A]: [] }));
    await press(view, `qandeel-shared-world-${WORLD_A}`);
    expect(view.getByTestId('qandeel-shared-field-empty').props.children).toBe(sharedFieldCopy('en').empty);
    expect(view.queryByTestId(/qandeel-shared-mark/u, { includeHiddenElements: true })).toBeNull();
  });

  it('the accessible semantic step walks FAR → MID → NEAR over the same World, with the reused Living Analysis words', async () => {
    const { view, controller } = await mountArea();
    await press(view, `qandeel-shared-world-${WORLD_A}`);
    await resize(view, SIZE.width, SIZE.height, { mapHeight: SIZE.height });
    await flush();
    const steps = view.getByTestId(`${SHARED_FIELD_SURFACE_TEST_ID}${WORLD_VIEW_STEP_TEST_ID_SUFFIX}`);
    expect(steps.props.accessibilityLabel).toBe(sharedFieldCopy('en').fieldLabel);
    expect(steps.props.accessibilityActions).toEqual([
      { name: 'zoom-in', label: analysisCopy('en').moreDetail },
      { name: 'zoom-out', label: analysisCopy('en').lessDetail },
    ]);
    await act(async () => { steps.props.onAccessibilityAction({ nativeEvent: { actionName: 'zoom-in' } }); });
    await flush();
    expect(controller.field?.getState().camera?.depth).toBe('MID');
    await act(async () => { steps.props.onAccessibilityAction({ nativeEvent: { actionName: 'zoom-out' } }); });
    await flush();
    expect(controller.field?.getState().camera?.depth).toBe('FAR');
  });

  it('the place panel shows its meaning, themes and exact sources, attributed as the conversation attributes them', async () => {
    const { view, controller } = await mountArea();
    await press(view, `qandeel-shared-world-${WORLD_A}`);
    await act(async () => { controller.field?.focus(A1.id); });
    await flush();
    expect(view.getByTestId('qandeel-shared-panel-meaning').props.children).toBe(A1.meaning);
    const copy = sharedFieldCopy('en');
    expect(view.getByTestId(`qandeel-shared-source-${id(101)}`).props.accessibilityLabel).toBe(`${copy.you}: my words`);
    expect(view.getByTestId(`qandeel-shared-source-${id(102)}`).props.accessibilityLabel).toBe('Fixture Hadir: their words');
  });

  it('D7: the conversation is one entry away, and Back returns to the same World at the same camera and focus', async () => {
    type Handler = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers: { handler: Handler; removed: boolean }[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      const record = { handler, removed: false };
      handlers.push(record);
      return { remove: () => { record.removed = true; } };
    });
    const back = async () => { const live = handlers.filter((x) => !x.removed); await act(async () => { live[live.length - 1].handler({ type: 'hardwareBackPress', timeStamp: 0 } as never); }); await flush(); };
    const { view, controller, field } = await mountArea();
    await press(view, `qandeel-shared-world-${WORLD_A}`);
    await act(async () => { controller.field?.focus(A3.id); });
    await flush();
    const camera = controller.field?.getState().camera;
    await press(view, 'qandeel-shared-conversation-open');
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    expect(view.getByTestId('qandeel-shared-welcome')).toBeTruthy();
    const reads = field.field.mock.calls.length;
    await back();
    expect(view.getByTestId('qandeel-shared-world-field')).toBeTruthy();
    expect(field.field.mock.calls.length).toBe(reads + 1);
    expect(controller.field?.getState()).toMatchObject({ worldId: WORLD_A, camera, focus: { id: A3.id } });
    // Back inside the field releases the focus first, then leaves to the Shared root.
    await back();
    expect(controller.field?.getState().focus).toBeNull();
    await back();
    expect(view.getByTestId('qandeel-shared-root')).toBeTruthy();
    expect(controller.field?.getState()).toMatchObject({ worldId: null, entries: [], camera: null });
  });

  it('switching World A → B shows B\'s own World; leaving A forgets its anchor', async () => {
    const { view, controller } = await mountArea();
    await press(view, `qandeel-shared-world-${WORLD_A}`);
    await act(async () => { controller.field?.focus(A1.id); });
    await flush();
    await press(view, 'qandeel-shared-back');
    await press(view, `qandeel-shared-world-${WORLD_B}`);
    expect(controller.field?.getState()).toMatchObject({ worldId: WORLD_B, entries: [B1], focus: null, camera: { depth: 'FAR' } });
    expect(view.queryByText(A1.meaning)).toBeNull();
  });
});

describe('SHARED-VIS-01 — the Product Copy Gate (CLOSED — 6 / 6 APPROVED)', () => {
  it("reuses every existing word exactly; the six new rows are the Product Owner's approved wording (CLOSED — 6 / 6)", () => {
    expect(SHARED_FIELD_COPY_GATE.approved).toEqual(['fieldLabel', 'empty', 'fieldUnavailable', 'conversation', 'placeUnavailable', 'sourcesHeading']);
    expect(SHARED_FIELD_COPY_GATE.proposed).toEqual([]);
    expect(sharedFieldCopy('ar')).toMatchObject({ fieldLabel: 'خريطة المعاني في العالم المشترك', empty: 'لم تتشكل معالم هذا العالم بعد.',
      fieldUnavailable: 'تعذّر عرض هذا العالم المشترك الآن.', conversation: 'المحادثة', placeUnavailable: 'لم يعد هذا المكان متاحًا في العالم المشترك.',
      sourcesHeading: 'مصادر هذا المعنى' });
    expect(sharedFieldCopy('en')).toMatchObject({ fieldLabel: 'Shared World meaning map', empty: "This world's map is still taking shape.",
      fieldUnavailable: "This Shared World can't be shown right now.", conversation: 'Conversation',
      placeUnavailable: 'This place is no longer available in this Shared World.', sourcesHeading: 'Sources of this meaning' });
    for (const language of ['ar', 'en'] as const) {
      const copy = sharedFieldCopy(language);
      expect(copy.moreDetail).toBe(analysisCopy(language).moreDetail);
    }
  });
});

describe('MAP-CLOSE-01 V-3 (Product Owner scope correction) — the Shared field is the same S3-R2 world as the Personal one', () => {
  afterEach(() => {
    mockContinuity.off = false;
    mockContinuity.seen.length = 0;
  });

  /** Every Skia stand-in element of one kind in the rendered tree, with its props. */
  const skia = (view: RenderResult, kind: string): Record<string, unknown>[] => {
    const found: Record<string, unknown>[] = [];
    const walkTree = (node: unknown): void => {
      if (node === null || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walkTree); return; }
      const record = node as { props?: Record<string, unknown>; children?: unknown[] };
      if (record.props?.skiaElement === kind) found.push(record.props);
      for (const child of record.children ?? []) walkTree(child);
    };
    walkTree(view.toJSON());
    return found;
  };
  /** The rendered tree with the world canvas's own paint left out: everything that can be read, touched or decided. */
  const outsideCanvas = (node: unknown): unknown => {
    if (node === null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(outsideCanvas);
    const record = node as { props?: Record<string, unknown>; children?: unknown[] | null };
    if (record.props?.testID === 'qandeel-shared-field-canvas') return { canvas: true };
    return { ...record, children: record.children === null || record.children === undefined ? record.children : record.children.map(outsideCanvas) };
  };

  /** FAR, MID and NEAR of the same World: the accessible semantic step, then a place focused with its panel. */
  async function walk(off: boolean) {
    mockContinuity.off = off;
    const { view, controller } = await mountArea();
    await press(view, `qandeel-shared-world-${WORLD_A}`);
    await resize(view, SIZE.width, SIZE.height, { mapHeight: SIZE.height });
    await flush();
    const steps = view.getByTestId(`${SHARED_FIELD_SURFACE_TEST_ID}${WORLD_VIEW_STEP_TEST_ID_SUFFIX}`);
    const states = [];
    for (const depth of ['FAR', 'MID', 'NEAR'] as const) {
      if (depth === 'MID') {
        await act(async () => { steps.props.onAccessibilityAction({ nativeEvent: { actionName: 'zoom-in' } }); });
        await flush();
      }
      if (depth === 'NEAR') {
        await act(async () => { controller.field?.focus(A1.id); });
        await flush();
      }
      expect(controller.field?.getState().camera?.depth).toBe(depth);
      states.push({
        depth,
        outside: JSON.stringify(outsideCanvas(view.toJSON())),
        paths: skia(view, 'Path'),
        circles: skia(view, 'Circle'),
        lines: skia(view, 'Line').length,
        pictures: skia(view, 'Picture').length,
      });
    }
    return states;
  }

  // One render per test (the testing library allows one mounted tree): the World WITH its continuity is walked first, and
  // the same World without it is compared against it.
  let withIt: Awaited<ReturnType<typeof walk>> = [];

  it('opts into the continuity at every distance it reaches', async () => {
    withIt = await walk(false);
    expect(withIt.map((state) => state.depth)).toEqual(['FAR', 'MID', 'NEAR']);
    expect(mockContinuity.seen.length).toBeGreaterThan(0);
    expect(new Set(mockContinuity.seen)).toEqual(new Set([true]));
  });

  it('the continuity is paint only: every target, label, panel and mark is the same without it, and no member is drawn', async () => {
    expect(withIt).toHaveLength(3);
    const without = await walk(true);
    for (const [index, state] of withIt.entries()) {
      const plain = without[index];
      // What the reader touches and reads: the targets, the labels, the panel, the bands — identical.
      expect(state.outside).toBe(plain.outside);
      // What the world says about each place: its neutral mark and its selection — identical.
      expect(state.paths).toEqual(plain.paths);
      expect(state.circles).toEqual(plain.circles);
      // No line of any kind: the Shared field draws no relation, with or without the continuity.
      expect(state.lines).toBe(0);
      // What it adds is the S3-R2 material: recorded pictures (the deep space and the places' fine threads).
      expect(state.pictures).toBeGreaterThan(plain.pictures);
      expect(state.outside).not.toMatch(/qandeel-shared-members|memberMark/u);
    }
  });
});

describe('MAP-CLOSE-01 V-3 (Product Owner scope correction) — the Shared screen stands on the continuous world', () => {
  afterEach(() => jest.restoreAllMocks());

  /** The platform's increased-contrast setting, as the theme reads it on either platform. */
  const contrast = (increased: boolean) => {
    jest.spyOn(AccessibilityInfo, 'isHighTextContrastEnabled').mockResolvedValue(increased);
    jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(increased);
  };
  /** The frame is shorter than the screen: the support band holds the rest of the column. */
  const FRAME = 500;

  it('the band is transparent, and the ONE canvas runs on behind the support band and takes no touch there', async () => {
    contrast(false);
    const { view } = await mountArea();
    await press(view, `qandeel-shared-world-${WORLD_A}`);
    await resize(view, SIZE.width, SIZE.height, { mapHeight: FRAME });
    await flush();
    const canvasView = view.getByTestId('qandeel-shared-field-canvas', { includeHiddenElements: true });
    expect(canvasView.props.style).toMatchObject({ height: SIZE.height });
    expect(canvasView.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(view.getByTestId('qandeel-shared-band').props.style)).toMatchObject({ backgroundColor: 'transparent' });
  });

  it('under increased contrast the frame ends the world and the band keeps its solid ground (F1)', async () => {
    contrast(true);
    const { view } = await mountArea();
    await press(view, `qandeel-shared-world-${WORLD_A}`);
    await resize(view, SIZE.width, SIZE.height, { mapHeight: FRAME });
    await flush();
    const canvasView = view.getByTestId('qandeel-shared-field-canvas', { includeHiddenElements: true });
    expect(canvasView.props.style).toMatchObject({ height: FRAME });
    expect(canvasView.props.pointerEvents).toBeUndefined();
    expect(StyleSheet.flatten(view.getByTestId('qandeel-shared-band').props.style).backgroundColor).not.toBe('transparent');
  });
});
