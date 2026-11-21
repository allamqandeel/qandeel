/**
 * COSMOS-INT-01 Slice D CP2 (Contract v1.5 §19, the PO's CP2 authorisation 2026-11-16) — the Shared World's Detail
 * Sheet, on the real Shared area over the real Shared World and field controllers (their transports faked at the network
 * seam only). CP1's ONE sheet (`CosmosDetailSheet` / `useDetailSheet`) is reused; nothing here is a second sheet.
 *
 * D-12 is read as IDENTITY: every presentation transition (expand, collapse, close, by the handle, a drag, the escape or
 * the hardware Back while the sheet is open) leaves the field controller's published state the very same object, asks
 * the transport nothing and re-creates no stage. Only the controllers' own acts change the World.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo, BackHandler, StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../../appearance';
import {
  COSMOS_MARK_TEST_ID_INFIX, COSMOS_SHEET_ACCENT_TEST_ID, COSMOS_SHEET_BODY_GESTURE_TEST_ID, COSMOS_SHEET_HANDLE_TEST_ID, COSMOS_SHEET_SCROLL_TEST_ID,
  COSMOS_SHEET_STAGE_TEST_ID, COSMOS_SHEET_TEST_ID, COSMOS_STEP_TEST_ID_SUFFIX, SHEET_PEEK_MAX, cosmosProductCopy, type SheetPhase,
} from '../../../cosmos/product';
import { LIVING_ANALYSIS_STAGE_TEST_ID } from '../../../living-analysis';
import { projectAddress, type ViewportEnvelope } from '../../../map/camera';
import { canonicalWorldAddress, type CanonicalWorldAddress } from '../../../map/world';
import { resize } from '../../../responsive/__fixtures__/composition';
import type { SharedEntryResult, SharedFieldEntry, SharedFieldPlace, SharedFieldResult, SharedPlaceResult } from '../../../runtime-entry';
import { createSharedWorldController, type SharedWorldController, type SharedWorldTransport } from '../../shared-world-controller';
import { SharedWorldArea } from '../../SharedWorldArea';
import { sharedFieldCopy } from '../field-copy';
import { SHARED_FIELD_WORLD_TEST_ID } from '../SharedLivingAnalysis';
import type { SharedFieldController, SharedFieldTransport } from '../shared-field-controller';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const INSETS = { top: 44, right: 0, bottom: 0, left: 0 };
const SIZE = { width: 400, height: 800 };
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const WORLD = '11111111-0000-4000-8000-00000000000a';
const at = (x: bigint, y: bigint): CanonicalWorldAddress => {
  const a = canonicalWorldAddress(x, y);
  if (!a.ok) throw new Error('fixture');
  return a.address;
};
const entry = (n: number, x: bigint, y: bigint): SharedFieldEntry => ({ id: id(n), address: at(x, y), meaning: `meaning ${n}`, region: 'home.move' });
const P1 = entry(1, 300_000n, 600_000n);
const P2 = entry(2, -1_000_000n, -1_500_000n);
/** P1's place: the decoder's limit of 24 sources, every attribution the conversation uses (SELF, a named HUMAN, an unnamed one, QANDEEL). */
const PRODUCERS = [
  { producer: 'SELF', authorName: null }, { producer: 'HUMAN', authorName: 'Fixture Hadir' }, { producer: 'HUMAN', authorName: null }, { producer: 'QANDEEL', authorName: null },
] as const;
const SOURCES = Array.from({ length: 24 }, (_, i) => ({
  materialId: id(500 + i), ...PRODUCERS[i % 4], text: `source words ${i}`, establishedAt: '2026-10-08T09:00:00.000Z',
}));
const placeOf = (e: SharedFieldEntry): SharedFieldPlace => ({
  entry: e, primaryThemes: ['home', 'leaving'], secondaryThemes: ['postponing'], establishedAt: '2026-10-08T10:00:00.000Z',
  sources: e.id === P1.id ? SOURCES : [SOURCES[0]],
});
const MEMBERS = [{ name: null, self: true }, { name: 'Fixture Hadir', self: false }];

function transports(entries: SharedFieldEntry[] = [P1, P2]) {
  const field = {
    field: jest.fn(async (): Promise<SharedFieldResult> => ({ kind: 'READ', entries })),
    place: jest.fn(async (_worldId: string, placeId: string): Promise<SharedPlaceResult> => {
      const e = entries.find((x) => x.id === placeId);
      return e === undefined ? { kind: 'ABSENT' } : { kind: 'READ', place: placeOf(e) };
    }),
  };
  const area = {
    root: jest.fn(async () => ({ kind: 'READ', root: { capabilities: { invitation: true, birth: true }, worlds: [{ worldId: WORLD, name: null, members: MEMBERS }], invitations: [], closedWorlds: [], memberRequests: [] } })),
    entry: jest.fn(async (worldId: string): Promise<SharedEntryResult> => ({ kind: 'ALLOW', world: { worldId, bornAt: '2026-10-08T00:00:00Z', name: null, members: MEMBERS } })),
    materials: jest.fn(async () => ({ kind: 'READ', conversation: true, materials: [], hasOlder: false })),
    manage: jest.fn(async () => ({ kind: 'UNAVAILABLE' as const })),
  };
  return { field, area };
}
const appearance = () => {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
};

/** The hardware Back as React Native runs it: the most recent listener first, until one handles it. */
function backKey() {
  type Listener = Parameters<typeof BackHandler.addEventListener>[1];
  const listeners: Listener[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    listeners.push(handler);
    return { remove: () => { const i = listeners.indexOf(handler); if (i >= 0) listeners.splice(i, 1); } };
  });
  return {
    count: () => listeners.length,
    press: async () => {
      let handled = false;
      await act(async () => { for (const l of [...listeners].reverse()) { if (l({} as never) === true) { handled = true; break; } } });
      await flush();
      await flush();
      return handled;
    },
  };
}

interface Mounted {
  readonly view: RenderResult;
  readonly world: SharedWorldController;
  readonly field: SharedFieldController;
  readonly t: ReturnType<typeof transports>;
  readonly glass: () => ViewportEnvelope;
}

/** The measured surface and the stage's gesture layer (the sheet and the stage live in the measured stage). */
async function measureSurface(view: RenderResult) {
  await resize(view, SIZE.width, SIZE.height, { mapHeight: SIZE.height });
  await flush();
  await act(async () => { fireEvent(view.getByTestId(`${SHARED_FIELD_WORLD_TEST_ID}${COSMOS_STEP_TEST_ID_SUFFIX}`, hidden), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: SIZE.width, height: SIZE.height } } }); });
  await flush();
}

async function mount(language: 'ar' | 'en' = 'en', t = transports()): Promise<Mounted> {
  const world = createSharedWorldController({ transport: t.area as unknown as SharedWorldTransport, isCurrent: () => true, fieldTransport: t.field as unknown as SharedFieldTransport });
  const field = world.field!;
  const seen = jest.spyOn(field, 'setEnvelope');
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  const view = await render(<AppearanceProvider authority={appearance()}><SharedWorldArea controller={world} language={language} insets={INSETS} /></AppearanceProvider>);
  await flush();
  await fireEvent.press(view.getByTestId(`qandeel-shared-world-${WORLD}`));
  for (let n = 0; n < 3; n += 1) await flush();
  await measureSurface(view);
  return { view, world, field, t, glass: () => seen.mock.calls[seen.mock.calls.length - 1][0] };
}

const hidden = { includeHiddenElements: true } as const;
const sheet = (view: RenderResult) => view.getByTestId(COSMOS_SHEET_TEST_ID, hidden);
const handle = (view: RenderResult) => view.getByTestId(COSMOS_SHEET_HANDLE_TEST_ID, hidden);
function phaseOf(view: RenderResult): SheetPhase {
  const props = sheet(view).props as { pointerEvents?: string; accessibilityViewIsModal?: boolean };
  return props.pointerEvents === 'none' ? 'CLOSED' : props.accessibilityViewIsModal === true ? 'EXPANDED' : 'PEEK';
}
/** The sheet's content measured as `height` points (24 sources measure more than the PEEK holds). */
async function measure(view: RenderResult, height: number) {
  await act(async () => { fireEvent(view.getByTestId(COSMOS_SHEET_SCROLL_TEST_ID, hidden), 'contentSizeChange', SIZE.width, height); });
}
async function action(view: RenderResult, actionName: string) {
  await act(async () => { fireEvent(handle(view), 'accessibilityAction', { nativeEvent: { actionName } }); });
  await flush();
}
const actionNames = (view: RenderResult) => ((handle(view).props.accessibilityActions ?? []) as { name: string }[]).map((a) => a.name);
const mark = (placeId: string) => `${SHARED_FIELD_WORLD_TEST_ID}${COSMOS_MARK_TEST_ID_INFIX}${placeId}`;
async function select(view: RenderResult, field: SharedFieldController, placeId: string) {
  await act(async () => { field.focus(placeId); });
  await flush();
}
const reads = (t: ReturnType<typeof transports>) => [t.field.field.mock.calls.length, t.field.place.mock.calls.length];
async function drag(gestureId: string, translationY: number, velocityY: number) {
  await act(async () => {
    fireGestureHandler(getByGestureTestId(gestureId), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: translationY / 2, velocityY },
      { state: State.ACTIVE, translationY, velocityY },
      { state: State.END, translationY, velocityY },
    ]);
  });
  await flush();
}
/** A deferred answer, resolved by the test. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = false;
});

describe('Slice D CP2 — selecting a place: PEEK with its meaning and themes (1, 2)', () => {
  it('the World opens on its field with the sheet closed, hidden and untouchable; the band keeps its acts', async () => {
    const { view } = await mount();
    expect(phaseOf(view)).toBe('CLOSED');
    expect(sheet(view).props.importantForAccessibility).toBe('no-hide-descendants');
    expect(view.getByTestId(COSMOS_SHEET_STAGE_TEST_ID).props.pointerEvents).toBe('auto');
    for (const act_ of ['qandeel-shared-back', 'qandeel-shared-conversation-open', 'qandeel-shared-manage-open']) expect(view.getByTestId(act_)).toBeTruthy();
  });

  it('the World\'s own selection act (a step IN at MID focuses the place nearest the centre) opens the PEEK; its panel is read once', async () => {
    const { view, field, t, glass } = await mount();
    const before = t.field.place.mock.calls.length;
    const step = async () => {
      await act(async () => { view.getByTestId(`${SHARED_FIELD_WORLD_TEST_ID}${COSMOS_STEP_TEST_ID_SUFFIX}`).props.onAccessibilityAction({ nativeEvent: { actionName: 'zoom-in' } }); });
      await flush();
    };
    // A tap at FAR discloses MID about the tapped place (the controller's act the stage relays), then the accessible step IN.
    const p = projectAddress(field.getState().camera!, glass(), P1.address)!;
    await act(async () => { field.tapField(p.x, p.y); });
    await flush();
    expect(field.getState()).toMatchObject({ camera: { depth: 'MID' }, focus: null });
    expect(phaseOf(view)).toBe('CLOSED');
    await step();
    expect(field.getState().focus).toMatchObject({ id: P1.id, panel: { status: 'SERVED' } });
    expect(phaseOf(view)).toBe('PEEK');
    expect(t.field.place.mock.calls.length).toBe(before + 1);
    expect(view.getByTestId(COSMOS_SHEET_ACCENT_TEST_ID)).toBeTruthy();
  });

  it('the PEEK leads with the meaning (a header), then the primary and secondary themes; no source count is drawn (SD-6)', async () => {
    const { view, field } = await mount();
    await select(view, field, P1.id);
    const copy = sharedFieldCopy('en');
    expect(view.getByTestId('qandeel-shared-panel-meaning').props).toMatchObject({ accessibilityRole: 'header', children: P1.meaning });
    expect(view.getByText(copy.primaryHeading)).toBeTruthy();
    expect(view.getByText('home, leaving')).toBeTruthy();
    expect(view.getByText(copy.secondaryHeading)).toBeTruthy();
    expect(view.getByText('postponing')).toBeTruthy();
    // SD-6: no new count word and no number of sources anywhere.
    expect(view.queryByText(/\b24\b|sources?\s*\d|\d+\s*sources?/iu)).toBeNull();
  });
});

describe('Slice D CP2 — EXPANDED: every authorised source, attributed, and nothing more (3 – 6)', () => {
  it('the 24 sources are all mounted, in the decoder\'s order, under «Sources of this meaning»; EXPANDED scrolls them', async () => {
    const { view, field } = await mount();
    await select(view, field, P1.id);
    await measure(view, 2400);
    expect(actionNames(view)).toContain('expand');
    await action(view, 'expand');
    expect(phaseOf(view)).toBe('EXPANDED');
    expect(view.getByText(sharedFieldCopy('en').sourcesHeading)).toBeTruthy();
    const rows = view.getAllByTestId(/^qandeel-shared-source-/u);
    expect(rows.map((row) => row.props.testID)).toEqual(SOURCES.map((s) => `qandeel-shared-source-${s.materialId}`));
    expect(view.getByTestId(COSMOS_SHEET_SCROLL_TEST_ID).props.scrollEnabled).not.toBe(false);
  });

  it('each source keeps the conversation\'s attribution: you, the author\'s name, someone, QANDEEL — and its exact words', async () => {
    const { view, field } = await mount();
    await select(view, field, P1.id);
    const copy = sharedFieldCopy('en');
    const who = [copy.you, 'Fixture Hadir', copy.someone, copy.qandeel];
    SOURCES.forEach((s, i) => {
      expect(view.getByTestId(`qandeel-shared-source-${s.materialId}`, hidden).props.accessibilityLabel).toBe(`${who[i % 4]}: ${s.text}`);
    });
  });

  it('no source outside the decoder\'s answer is drawn; a place no longer served shows only that it is unavailable', async () => {
    const t = transports();
    t.field.place.mockImplementation(async (_w: string, placeId: string) => (placeId === P2.id ? { kind: 'ABSENT' } : { kind: 'READ', place: placeOf(P1) }));
    const { view, field } = await mount('en', t);
    await select(view, field, P1.id);
    expect(view.getAllByTestId(/^qandeel-shared-source-/u, hidden)).toHaveLength(SOURCES.length);
    await select(view, field, P2.id);
    expect(phaseOf(view)).toBe('PEEK');
    expect(view.getByTestId('qandeel-shared-panel-absent').props.children).toBe(sharedFieldCopy('en').placeUnavailable);
    expect(view.queryAllByTestId(/^qandeel-shared-source-/u, hidden)).toHaveLength(0);
    expect(view.queryByTestId('qandeel-shared-panel-conversation', hidden)).toBeNull();
  });

  it('a source row offers no navigation: it is read as one text, never a button or a link (SD-2 / G-3)', async () => {
    const { view, field } = await mount();
    await select(view, field, P1.id);
    for (const row of view.getAllByTestId(/^qandeel-shared-source-/u, hidden)) {
      expect(row.props.onPress).toBeUndefined();
      expect(row.props.onClick).toBeUndefined();
      expect(row.props.accessibilityRole).toBeUndefined();
      expect(row.props.accessibilityActions).toBeUndefined();
    }
  });
});

describe('Slice D CP2 — the conversation, through the existing act (7, 8)', () => {
  it('EXPANDED ends with the World\'s Conversation act, the same word as the band\'s; it runs the existing openConversation()', async () => {
    const { view, world, field } = await mount();
    await select(view, field, P1.id);
    await measure(view, 2400);
    await action(view, 'expand');
    const copy = sharedFieldCopy('en');
    const inSheet = view.getByTestId('qandeel-shared-panel-conversation');
    expect(inSheet.props.accessibilityLabel).toBe(copy.conversation);
    expect(view.getByTestId('qandeel-shared-conversation-open').props.accessibilityLabel).toBe(copy.conversation);
    const open = jest.spyOn(world, 'openConversation');
    await fireEvent.press(inSheet);
    await flush();
    expect(open).toHaveBeenCalledTimes(1);
    expect(world.getState().worldView).toBe('CONVERSATION');
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
  });

  it('returning from the conversation restores the same World, camera and focus (the controller\'s anchor), its place peeking', async () => {
    const back = backKey();
    const { view, field, t } = await mount();
    await select(view, field, P1.id);
    const camera = field.getState().camera;
    await measure(view, 2400);
    await action(view, 'expand');
    await fireEvent.press(view.getByTestId('qandeel-shared-panel-conversation'));
    await flush();
    const before = reads(t);
    expect(await back.press()).toBe(true);
    expect(view.getByTestId('qandeel-shared-world-field')).toBeTruthy();
    await measureSurface(view);
    // The controller's own D7 return: one field read and one panel read, as before Slice D; the sheet adds none.
    expect(reads(t)).toEqual([before[0] + 1, before[1] + 1]);
    expect(field.getState()).toMatchObject({ worldId: WORLD, camera, focus: { id: P1.id, panel: { status: 'SERVED' } } });
    expect(phaseOf(view)).toBe('PEEK');
  });
});

describe('Slice D CP2 — dismissal is presentation only (9, 12, 13)', () => {
  it('CLOSED → PEEK → EXPANDED → PEEK → CLOSED: the focus, the camera, the reads, the stage and the canvas are untouched', async () => {
    const { view, field, t } = await mount();
    await select(view, field, P1.id);
    expect(phaseOf(view)).toBe('PEEK');
    await measure(view, 2400);
    const state = field.getState();
    const before = reads(t);
    const stage = view.getByTestId(LIVING_ANALYSIS_STAGE_TEST_ID);
    const worldView = view.getByTestId(SHARED_FIELD_WORLD_TEST_ID);
    const sheetStage = view.getByTestId(COSMOS_SHEET_STAGE_TEST_ID);
    for (const [act_, to] of [['expand', 'EXPANDED'], ['collapse', 'PEEK'], ['close', 'CLOSED']] as const) {
      await action(view, act_);
      expect(phaseOf(view)).toBe(to);
      expect(field.getState()).toBe(state);
      expect(reads(t)).toEqual(before);
      expect(view.getByTestId(LIVING_ANALYSIS_STAGE_TEST_ID, hidden)).toBe(stage);
      expect(view.getByTestId(SHARED_FIELD_WORLD_TEST_ID, hidden)).toBe(worldView);
      // CP1's correction holds for Shared: the stage is one native view in every phase, never flattened or re-parented.
      expect(view.getByTestId(COSMOS_SHEET_STAGE_TEST_ID, hidden)).toBe(sheetStage);
      expect(sheetStage.props.collapsable).toBe(false);
    }
    expect(field.getState().focus?.id).toBe(P1.id);
  });

  it('EXPANDED: the stage stays mounted but takes no touch, is hidden from accessibility and does not drift; the top band stays', async () => {
    const { view, field } = await mount();
    await select(view, field, P1.id);
    await measure(view, 2400);
    await action(view, 'expand');
    const stage = view.getByTestId(COSMOS_SHEET_STAGE_TEST_ID, hidden);
    expect(stage.props.pointerEvents).toBe('none');
    expect(stage.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(sheet(view).props.accessibilityViewIsModal).toBe(true);
    expect(view.getByTestId('qandeel-shared-band')).toBeTruthy();
    expect(view.getByTestId('qandeel-shared-conversation-open')).toBeTruthy();
  });

  it('while the sheet peeks, its visible height is the glass\'s bottom inset (SD-10): recorded, never read, the camera unmoved', async () => {
    const { view, field, t, glass } = await mount();
    await select(view, field, P1.id);
    await measure(view, 2400);
    await flush();
    const camera = field.getState().camera;
    const before = reads(t);
    expect(glass().insetBottom).toBe(SHEET_PEEK_MAX);
    await action(view, 'close');
    expect(glass().insetBottom).toBeLessThan(SHEET_PEEK_MAX);
    expect(field.getState().camera).toBe(camera);
    expect(reads(t)).toEqual(before);
  });

  it('the accessibility escape steps EXPANDED → PEEK → CLOSED, presentation only', async () => {
    const { view, field } = await mount();
    await select(view, field, P1.id);
    await measure(view, 2400);
    await action(view, 'expand');
    const state = field.getState();
    await act(async () => { fireEvent(sheet(view), 'accessibilityEscape'); });
    expect(phaseOf(view)).toBe('PEEK');
    await act(async () => { fireEvent(sheet(view), 'accessibilityEscape'); });
    expect(phaseOf(view)).toBe('CLOSED');
    expect(field.getState()).toBe(state);
  });
});

describe('Slice D CP2 — hardware Back: the area\'s ONE handler, the sheet first (10)', () => {
  it('EXPANDED → PEEK → CLOSED, then field Back releases the focus, then the Shared root; one listener throughout', async () => {
    const back = backKey();
    const { view, world, field } = await mount();
    await select(view, field, P1.id);
    await measure(view, 2400);
    await action(view, 'expand');
    expect(back.count()).toBe(1);
    const state = field.getState();
    expect(await back.press()).toBe(true);
    expect(phaseOf(view)).toBe('PEEK');
    expect(field.getState()).toBe(state);
    expect(await back.press()).toBe(true);
    expect(phaseOf(view)).toBe('CLOSED');
    expect(field.getState()).toBe(state);
    expect(await back.press()).toBe(true);
    expect(field.getState().focus).toBeNull();
    expect(back.count()).toBe(1);
    expect(await back.press()).toBe(true);
    expect(world.getState().place.kind).toBe('ROOT');
  });

  it('the conversation and Manage World keep their place in the order: the sheet is never asked there', async () => {
    const back = backKey();
    const { view, world, field } = await mount();
    await select(view, field, P1.id);
    await fireEvent.press(view.getByTestId('qandeel-shared-conversation-open'));
    await flush();
    expect(world.getState().worldView).toBe('CONVERSATION');
    expect(await back.press()).toBe(true);
    expect(world.getState()).toMatchObject({ place: { kind: 'WORLD' }, worldView: 'MAP' });
    await measureSurface(view);
    await fireEvent.press(view.getByTestId('qandeel-shared-manage-open'));
    await flush();
    expect(world.getState().place.kind).toBe('MANAGE');
    expect(await back.press()).toBe(true);
    expect(world.getState().place.kind).toBe('WORLD');
    expect(back.count()).toBe(1);
  });
});

describe('Slice D CP2 — reopening by the focused place (11)', () => {
  it('a closed sheet comes back when the reader activates the focused mark; the focus is the existing act', async () => {
    const { view, field } = await mount();
    await select(view, field, P1.id);
    await action(view, 'close');
    expect(phaseOf(view)).toBe('CLOSED');
    expect(field.getState().focus?.id).toBe(P1.id);
    await act(async () => { fireEvent.press(view.getByTestId(mark(P1.id), hidden)); });
    await flush();
    expect(phaseOf(view)).toBe('PEEK');
    expect(field.getState().focus?.id).toBe(P1.id);
  });
});

describe('Slice D CP2 — the drag stays the sheet\'s (14)', () => {
  it('a small fast flick changes nothing; a slow deliberate drag expands; the World is neither moved nor read', async () => {
    const { view, field, t } = await mount();
    await select(view, field, P1.id);
    await measure(view, 2400);
    const state = field.getState();
    const before = reads(t);
    await drag(COSMOS_SHEET_BODY_GESTURE_TEST_ID, -20, -2400);
    expect(phaseOf(view)).toBe('PEEK');
    await drag(COSMOS_SHEET_BODY_GESTURE_TEST_ID, -400, -200);
    expect(phaseOf(view)).toBe('EXPANDED');
    expect(field.getState()).toBe(state);
    expect(reads(t)).toEqual(before);
  });
});

describe('Slice D CP2 — the field\'s states in the sheet (15)', () => {
  it('loading: the focused place\'s panel is busy in the PEEK, with no words standing in for it', async () => {
    const t = transports();
    const slow = deferred<SharedPlaceResult>();
    t.field.place.mockImplementationOnce(() => slow.promise);
    const { view, field } = await mount('en', t);
    await select(view, field, P1.id);
    expect(field.getState().focus?.panel.status).toBe('LOADING');
    expect(phaseOf(view)).toBe('PEEK');
    expect(view.getByTestId('qandeel-shared-panel').props.children).toBeTruthy();
    expect(view.queryAllByTestId(/^qandeel-shared-panel-(absent|meaning|conversation)$/u, hidden)).toHaveLength(0);
    expect(view.queryByTestId('qandeel-shared-panel-meaning')).toBeNull();
    await act(async () => { slow.resolve({ kind: 'READ', place: placeOf(P1) }); });
    await flush();
    expect(view.getByTestId('qandeel-shared-panel-meaning').props.children).toBe(P1.meaning);
  });

  it('the field unavailable: the PEEK says so with the existing Retry, which reads the field again', async () => {
    const t = transports();
    t.field.field.mockImplementationOnce(async () => ({ kind: 'UNAVAILABLE' }));
    const { view, t: tt } = await mount('en', t);
    expect(phaseOf(view)).toBe('PEEK');
    expect(view.getByTestId('qandeel-shared-field-unavailable').props.children).toBe(sharedFieldCopy('en').fieldUnavailable);
    const before = tt.field.field.mock.calls.length;
    await fireEvent.press(view.getByTestId('qandeel-shared-field-retry'));
    await flush();
    expect(tt.field.field.mock.calls.length).toBe(before + 1);
    expect(phaseOf(view)).toBe('CLOSED');
  });

  it('an empty World: the PEEK says so; it fits, so EXPANDED is not offered', async () => {
    const { view } = await mount('en', transports([]));
    expect(phaseOf(view)).toBe('PEEK');
    expect(view.getByTestId('qandeel-shared-field-empty').props.children).toBe(sharedFieldCopy('en').empty);
    await measure(view, 60);
    expect(actionNames(view)).not.toContain('expand');
  });
});

describe('Slice D CP2 — language, accessibility and Reduce Motion (16, 17)', () => {
  it.each(['ar', 'en'] as const)('%s: the content reads in its own direction; the handle names its acts with the approved rows only', async (language) => {
    const words = cosmosProductCopy(language);
    const copy = sharedFieldCopy(language);
    const { view, field } = await mount(language);
    await select(view, field, P1.id);
    await measure(view, 2400);
    const writing = language === 'ar' ? 'rtl' : 'ltr';
    expect(StyleSheet.flatten(view.getByTestId('qandeel-shared-panel-meaning').props.style)).toMatchObject({ writingDirection: writing });
    expect(view.getByText(copy.sourcesHeading, hidden)).toBeTruthy();
    expect(view.getByTestId('qandeel-shared-panel-conversation', hidden).props.accessibilityLabel).toBe(copy.conversation);
    expect(handle(view).props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: words.sheetExpand, accessibilityLanguage: language });
    expect(handle(view).props.accessibilityActions).toEqual([{ name: 'expand', label: words.sheetExpand }, { name: 'close', label: words.sheetClose }]);
    for (const word of [words.sheetExpand, words.sheetCollapse, words.sheetClose]) expect(view.queryByText(word)).toBeNull();
  });

  it('Reduce Motion changes how it moves, never where it settles', async () => {
    (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = true;
    const { view, field } = await mount();
    await select(view, field, P1.id);
    await measure(view, 2400);
    await drag(COSMOS_SHEET_BODY_GESTURE_TEST_ID, -400, 0);
    expect(phaseOf(view)).toBe('EXPANDED');
    await action(view, 'collapse');
    expect(phaseOf(view)).toBe('PEEK');
  });
});
