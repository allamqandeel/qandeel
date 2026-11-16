/**
 * COSMOS-INT-01 Slice D CP1 (Contract v1.5 §19) — the Public World's Detail Sheet, on the real Public screen over the real
 * Public controller (its transport faked at the network seam only).
 *
 * D-12 is read as IDENTITY: every presentation transition (expand, collapse, close, by the handle, a drag, the escape or
 * the hardware Back while the sheet is open) leaves the controller's published state the very same object, asks the
 * transport nothing and re-creates no stage. Only the controller's own acts change the field.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo, BackHandler } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../../appearance';
import {
  COSMOS_MARK_TEST_ID_INFIX, COSMOS_SHEET_ACCENT_TEST_ID, COSMOS_SHEET_BODY_GESTURE_TEST_ID, COSMOS_SHEET_HANDLE_GESTURE_TEST_ID, COSMOS_SHEET_HANDLE_TEST_ID,
  COSMOS_SHEET_SCROLL_TEST_ID, COSMOS_SHEET_STAGE_TEST_ID, COSMOS_SHEET_TEST_ID, COSMOS_STEP_TEST_ID_SUFFIX, SHEET_PEEK_MAX, cosmosProductCopy, type SheetPhase,
} from '../../../cosmos/product';
import { LIVING_ANALYSIS_STAGE_TEST_ID } from '../../../living-analysis';
import type { ViewportEnvelope } from '../../../map/camera';
import { canonicalWorldAddress, type CanonicalWorldAddress } from '../../../map/world';
import { resize } from '../../../responsive/__fixtures__/composition';
import type { PublicAuthoringAnswer, PublicFieldEntry, PublicFieldPanel } from '../../../runtime-entry';
import { PUBLIC_TOPIC_SECTIONS } from '../../../runtime-entry';
import { createPublicWorldController } from '../../public-world-controller';
import { PublicWorldArea } from '../../PublicWorldArea';
import { publicFieldCopy } from '../field-copy';
import { PUBLIC_FIELD_WORLD_TEST_ID } from '../PublicLivingAnalysis';
import { createPublicFieldController, type PublicFieldController, type PublicFieldTransport } from '../public-field-controller';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

// The mocked module object itself (the sheet reads its `withSpring` from it), so one test can hold a spring's completion.
const Reanimated = jest.requireMock<typeof import('react-native-reanimated')>('react-native-reanimated');

const INSETS = { top: 44, right: 0, bottom: 0, left: 0 };
const SIZE = { width: 400, height: 800 };
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const yes = <T,>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });
const at = (x: bigint, y: bigint): CanonicalWorldAddress => {
  const a = canonicalWorldAddress(x, y);
  if (!a.ok) throw new Error('fixture');
  return a.address;
};
const entry = (n: number, x: bigint, y: bigint): PublicFieldEntry => ({ id: id(n), address: at(x, y), meaning: `meaning ${n}`, region: 'family.fear' });
const E1 = entry(1, 300_000n, 600_000n);
const E2 = entry(2, 315_000n, 608_000n);
const E3 = entry(3, -1_000_000n, -1_500_000n);
/** Twenty results for one query: a long list the PEEK cannot hold. */
const MANY = Array.from({ length: 20 }, (_, i) => entry(100 + i, BigInt(-2_000_000 + i * 50_000), 900_000n));
const ALL = [E1, E2, E3, ...MANY];
const served = (e: PublicFieldEntry, nearby: PublicFieldEntry[] = []): PublicFieldPanel => ({ kind: 'SERVED', experience: {
  entry: e, primaryThemes: ['fear'], secondaryThemes: ['work'], publisher: { mode: 'PSEUDONYM', label: 'nightlamp27' },
  publishedAt: '2026-10-07T10:00:00.000Z', discussionCount: 0,
  content: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'the public words' }], nearby, relations: [],
} });

function transport() {
  return {
    field: jest.fn(async () => yes([E1, E2, E3])),
    search: jest.fn(async (q: string) => yes(q === 'nothing' ? [] : q === 'many' ? MANY : [E3])),
    experience: jest.fn(async (experienceId: string) => yes(served(ALL.find((e) => e.id === experienceId)!, experienceId === E1.id ? [E2] : []))),
  };
}
const appearance = () => createAppearanceAuthority({
  store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
  system: { current: () => 'DARK', subscribe: () => () => undefined },
  native: { apply: () => undefined },
});

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
      return handled;
    },
  };
}

interface Mounted {
  readonly view: RenderResult;
  readonly field: PublicFieldController;
  readonly t: ReturnType<typeof transport>;
  readonly glass: () => ViewportEnvelope;
}

async function mount(language: 'ar' | 'en' = 'en'): Promise<Mounted> {
  const t = transport();
  const field = createPublicFieldController({ transport: t as unknown as PublicFieldTransport, isCurrent: () => true });
  const controller = createPublicWorldController({ transport: { entry: jest.fn(async () => ({ kind: 'ALLOW' as const })) }, isCurrent: () => true, field });
  const seen = jest.spyOn(field, 'setEnvelope');
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  const view = await render(<AppearanceProvider authority={appearance()}><PublicWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
  for (let n = 0; n < 4; n += 1) await flush();
  await resize(view, SIZE.width, SIZE.height, { mapHeight: SIZE.height });
  await flush();
  await act(async () => { fireEvent(view.getByTestId(`${PUBLIC_FIELD_WORLD_TEST_ID}${COSMOS_STEP_TEST_ID_SUFFIX}`), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: SIZE.width, height: SIZE.height } } }); });
  await flush();
  return { view, field, t, glass: () => seen.mock.calls[seen.mock.calls.length - 1][0] };
}

const hidden = { includeHiddenElements: true } as const;
const sheet = (view: RenderResult) => view.getByTestId(COSMOS_SHEET_TEST_ID, hidden);
const handle = (view: RenderResult) => view.getByTestId(COSMOS_SHEET_HANDLE_TEST_ID, hidden);
function phaseOf(view: RenderResult): SheetPhase {
  const props = sheet(view).props as { pointerEvents?: string; accessibilityViewIsModal?: boolean };
  return props.pointerEvents === 'none' ? 'CLOSED' : props.accessibilityViewIsModal === true ? 'EXPANDED' : 'PEEK';
}
/** The sheet's content measured as `height` points (a long list measures more than the PEEK holds). */
async function measure(view: RenderResult, height: number) {
  await act(async () => { fireEvent(view.getByTestId(COSMOS_SHEET_SCROLL_TEST_ID, hidden), 'contentSizeChange', SIZE.width, height); });
}
async function action(view: RenderResult, actionName: string) {
  await act(async () => { fireEvent(handle(view), 'accessibilityAction', { nativeEvent: { actionName } }); });
  await flush();
}
const actionNames = (view: RenderResult) => ((handle(view).props.accessibilityActions ?? []) as { name: string }[]).map((a) => a.name);
async function search(view: RenderResult, query: string) {
  await fireEvent(view.getByTestId('qandeel-public-search'), 'focus');
  await fireEvent.changeText(view.getByTestId('qandeel-public-search'), query);
  await fireEvent(view.getByTestId('qandeel-public-search'), 'submitEditing');
  await flush();
}
async function focusByResult(view: RenderResult, e: PublicFieldEntry) {
  await search(view, 'hope');
  await fireEvent.press(view.getByTestId(`qandeel-public-search-result-${e.id}`));
  await flush();
}
const reads = (t: ReturnType<typeof transport>) => [t.field.mock.calls.length, t.search.mock.calls.length, t.experience.mock.calls.length];
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

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = false;
});

describe('Slice D — the Public Detail Sheet: phases are presentation only (D-12)', () => {
  it('Public opens on the whole field with the sheet closed, hidden and untouchable', async () => {
    const { view } = await mount();
    expect(phaseOf(view)).toBe('CLOSED');
    expect(sheet(view).props.importantForAccessibility).toBe('no-hide-descendants');
    expect(sheet(view).props.accessibilityElementsHidden).toBe(true);
    expect(view.getByTestId(COSMOS_SHEET_STAGE_TEST_ID).props.pointerEvents).toBe('auto');
  });

  it('CLOSED → PEEK → EXPANDED → PEEK → CLOSED: the focus, the camera, the reads and the stage are untouched', async () => {
    const { view, field, t } = await mount();
    await focusByResult(view, E3);
    expect(phaseOf(view)).toBe('PEEK');
    expect(field.getState().focus).toMatchObject({ id: E3.id });
    await measure(view, 2000);
    const state = field.getState();
    const before = reads(t);
    const stage = view.getByTestId(LIVING_ANALYSIS_STAGE_TEST_ID);
    const world = view.getByTestId(PUBLIC_FIELD_WORLD_TEST_ID);
    for (const [act_, to] of [['expand', 'EXPANDED'], ['collapse', 'PEEK'], ['close', 'CLOSED']] as const) {
      await action(view, act_);
      expect(phaseOf(view)).toBe(to);
      expect(field.getState()).toBe(state);
      expect(reads(t)).toEqual(before);
      expect(view.getByTestId(LIVING_ANALYSIS_STAGE_TEST_ID, hidden)).toBe(stage);
      expect(view.getByTestId(PUBLIC_FIELD_WORLD_TEST_ID, hidden)).toBe(world);
    }
    // The focused mark stays the focus after the sheet closed.
    expect(field.getState().focus?.id).toBe(E3.id);
  });

  it('EXPANDED: the stage stays mounted but takes no touch, is hidden from accessibility and does not drift; the sheet is the modal', async () => {
    const { view } = await mount();
    await focusByResult(view, E3);
    await measure(view, 2000);
    const world = view.getByTestId(PUBLIC_FIELD_WORLD_TEST_ID);
    await action(view, 'expand');
    const stage = view.getByTestId(COSMOS_SHEET_STAGE_TEST_ID, hidden);
    expect(stage.props.pointerEvents).toBe('none');
    expect(stage.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(stage.props.accessibilityElementsHidden).toBe(true);
    expect(sheet(view).props.accessibilityViewIsModal).toBe(true);
    expect(view.getByTestId(COSMOS_SHEET_SCROLL_TEST_ID).props.scrollEnabled).toBe(true);
    expect(view.getByTestId(PUBLIC_FIELD_WORLD_TEST_ID, hidden)).toBe(world);
    // The top band is above the stage and is not hidden.
    expect(view.getByTestId('qandeel-public-search')).toBeTruthy();
    await action(view, 'collapse');
    expect(view.getByTestId(COSMOS_SHEET_STAGE_TEST_ID).props.pointerEvents).toBe('auto');
    expect(view.getByTestId(COSMOS_SHEET_SCROLL_TEST_ID).props.scrollEnabled).toBe(false);
  });

  it('the accessibility escape steps EXPANDED → PEEK → CLOSED, presentation only', async () => {
    const { view, field } = await mount();
    await focusByResult(view, E3);
    await measure(view, 2000);
    await action(view, 'expand');
    const state = field.getState();
    await act(async () => { fireEvent(sheet(view), 'accessibilityEscape'); });
    expect(phaseOf(view)).toBe('PEEK');
    await act(async () => { fireEvent(sheet(view), 'accessibilityEscape'); });
    expect(phaseOf(view)).toBe('CLOSED');
    expect(field.getState()).toBe(state);
  });

  it('while the sheet peeks, its visible height is the glass\'s bottom inset (SD-10): the envelope is recorded, the camera is not moved', async () => {
    const { view, field, glass } = await mount();
    await focusByResult(view, E3);
    await measure(view, 2000);
    await flush();
    const camera = field.getState().camera;
    expect(glass().insetBottom).toBe(SHEET_PEEK_MAX);
    await action(view, 'close');
    expect(glass().insetBottom).toBeLessThan(SHEET_PEEK_MAX);
    expect(field.getState().camera).toBe(camera);
  });

  it('the gold hairline marks a sheet about ONE focused Experience, and only then', async () => {
    const { view } = await mount();
    await search(view, 'hope');
    expect(view.queryByTestId(COSMOS_SHEET_ACCENT_TEST_ID)).toBeNull();
    await fireEvent.press(view.getByTestId(`qandeel-public-search-result-${E3.id}`));
    await flush();
    expect(view.getByTestId(COSMOS_SHEET_ACCENT_TEST_ID)).toBeTruthy();
  });
});

describe('Slice D — hardware Back: ONE handler, the sheet first (§19.6)', () => {
  it('EXPANDED → PEEK → CLOSED, and only then the controller releases the focus', async () => {
    const back = backKey();
    const { view, field } = await mount();
    await focusByResult(view, E3);
    await measure(view, 2000);
    await action(view, 'expand');
    expect(back.count()).toBe(1);
    expect(await back.press()).toBe(true);
    expect(phaseOf(view)).toBe('PEEK');
    expect(field.getState().focus?.id).toBe(E3.id);
    expect(await back.press()).toBe(true);
    expect(phaseOf(view)).toBe('CLOSED');
    expect(field.getState().focus?.id).toBe(E3.id);
    // The sheet has nothing left to dismiss: the controller's own local Back runs, and releases the focus.
    expect(await back.press()).toBe(true);
    expect(field.getState().focus).toBeNull();
  });

  it('re-registration: the focus changes while the sheet is open, and Back still dismisses the sheet before releasing anything', async () => {
    const back = backKey();
    const { view, field } = await mount();
    await search(view, 'hope');
    await fireEvent.press(view.getByTestId(`qandeel-public-search-result-${E3.id}`));
    await flush();
    // A new focus while the sheet is open (the field's own act, as a nearby or a mark would): a fresh PEEK.
    await act(async () => { field.focus(E1.id); });
    await flush();
    expect(field.getState().focus?.id).toBe(E1.id);
    expect(phaseOf(view)).toBe('PEEK');
    expect(back.count()).toBe(1);
    expect(await back.press()).toBe(true);
    expect(phaseOf(view)).toBe('CLOSED');
    expect(field.getState().focus?.id).toBe(E1.id);
    expect(await back.press()).toBe(true);
    expect(field.getState().focus).toBeNull();
  });

  it('at the World\'s root with the sheet closed, nothing is registered', async () => {
    const back = backKey();
    await mount();
    expect(back.count()).toBe(0);
  });
});

describe('Slice D — reopening by the focused item (SD-12)', () => {
  it('a closed sheet comes back when the reader activates the focused mark; the act is the existing focus', async () => {
    const { view, field, t } = await mount();
    await focusByResult(view, E3);
    await action(view, 'close');
    expect(phaseOf(view)).toBe('CLOSED');
    const experienceReads = t.experience.mock.calls.length;
    await act(async () => { fireEvent.press(view.getByTestId(`${PUBLIC_FIELD_WORLD_TEST_ID}${COSMOS_MARK_TEST_ID_INFIX}${E3.id}`)); });
    await flush();
    expect(phaseOf(view)).toBe('PEEK');
    expect(field.getState().focus?.id).toBe(E3.id);
    // The existing controller behaviour is kept: the same focus re-reads its panel, exactly as before Slice D.
    expect(t.experience.mock.calls.length).toBe(experienceReads + 1);
  });
});

describe('Slice D — long lists stay reachable (the long-list amendment)', () => {
  it('the section list: every section is mounted, EXPANDED scrolls it with no focus, and the last one can be chosen', async () => {
    const { view, field } = await mount();
    await fireEvent.press(view.getByTestId('qandeel-public-section-control'));
    await flush();
    expect(phaseOf(view)).toBe('PEEK');
    expect(field.getState().focus).toBeNull();
    for (const key of ['all', ...PUBLIC_TOPIC_SECTIONS]) expect(view.getByTestId(`qandeel-public-section-${key}`)).toBeTruthy();
    await measure(view, 44 * 14 + 80);
    expect(actionNames(view)).toContain('expand');
    await action(view, 'expand');
    expect(phaseOf(view)).toBe('EXPANDED');
    expect(view.getByTestId(COSMOS_SHEET_SCROLL_TEST_ID).props.scrollEnabled).toBe(true);
    await fireEvent.press(view.getByTestId('qandeel-public-section-open'));
    await flush();
    expect(field.getState().section).toMatchObject({ key: 'open', choosing: false });
  });

  it('twenty results: all are rendered (none cut), EXPANDED scrolls them, and the last one selected focuses it and peeks', async () => {
    const { view, field } = await mount();
    await search(view, 'many');
    for (const e of MANY) expect(view.getByTestId(`qandeel-public-search-result-${e.id}`)).toBeTruthy();
    await measure(view, 44 * 20 + 40);
    await action(view, 'expand');
    expect(phaseOf(view)).toBe('EXPANDED');
    const last = MANY[MANY.length - 1];
    await fireEvent.press(view.getByTestId(`qandeel-public-search-result-${last.id}`));
    await flush();
    expect(field.getState().focus?.id).toBe(last.id);
    expect(phaseOf(view)).toBe('PEEK');
  });

  it('zero results: the reader is told so in a PEEK that fits, and EXPANDED is not offered', async () => {
    const { view } = await mount();
    await search(view, 'nothing');
    expect(phaseOf(view)).toBe('PEEK');
    expect(view.getByText(publicFieldCopy('en').noResults)).toBeTruthy();
    await measure(view, 60);
    expect(actionNames(view)).toEqual(['close']);
  });

  it('a search closed by the reader shows its answer again on the next submit', async () => {
    const { view } = await mount();
    await search(view, 'hope');
    await action(view, 'close');
    await fireEvent(view.getByTestId('qandeel-public-search'), 'submitEditing');
    await flush();
    expect(phaseOf(view)).toBe('PEEK');
  });
});

describe('Slice D — unavailable sheet actions execute nothing (§19.8)', () => {
  it('a PEEK that fits offers no expand; asking for it anyway changes nothing at all', async () => {
    const { view, field, t } = await mount();
    await focusByResult(view, E3);
    await measure(view, 60);
    expect(actionNames(view)).toEqual(['close']);
    const state = field.getState();
    const before = reads(t);
    await action(view, 'expand');
    await action(view, 'collapse');
    expect(phaseOf(view)).toBe('PEEK');
    expect(field.getState()).toBe(state);
    expect(reads(t)).toEqual(before);
  });

  it('a closed sheet offers nothing and its handle is disabled; every action is refused', async () => {
    const { view, field } = await mount();
    await focusByResult(view, E3);
    await action(view, 'close');
    expect(actionNames(view)).toEqual([]);
    expect(handle(view).props.accessibilityState).toMatchObject({ disabled: true });
    const state = field.getState();
    for (const name of ['expand', 'collapse', 'close']) await action(view, name);
    await act(async () => { fireEvent.press(handle(view)); });
    expect(phaseOf(view)).toBe('CLOSED');
    expect(field.getState()).toBe(state);
  });
});

describe('Slice D — the drag (§19.7): bounded, distance-led, never the map', () => {
  it('the sheet drags only vertically: a 12-point activation, a 16-point horizontal failure; the body drags in PEEK only', async () => {
    const { view } = await mount();
    await focusByResult(view, E3);
    const body = getByGestureTestId(COSMOS_SHEET_BODY_GESTURE_TEST_ID) as unknown as { config: Record<string, unknown> };
    expect(body.config).toMatchObject({ enabled: true, activeOffsetYStart: -12, activeOffsetYEnd: 12, failOffsetXStart: -16, failOffsetXEnd: 16 });
    await measure(view, 2000);
    await action(view, 'expand');
    expect((getByGestureTestId(COSMOS_SHEET_BODY_GESTURE_TEST_ID) as unknown as { config: { enabled: boolean } }).config.enabled).toBe(false);
    expect((getByGestureTestId(COSMOS_SHEET_HANDLE_GESTURE_TEST_ID) as unknown as { config: { enabled: boolean } }).config.enabled).toBe(true);
  });

  it('a small fast flick changes nothing; a slow deliberate drag expands; the map is neither panned nor read', async () => {
    const { view, field, t } = await mount();
    await focusByResult(view, E3);
    await measure(view, 2000);
    const state = field.getState();
    const before = reads(t);
    await drag(COSMOS_SHEET_BODY_GESTURE_TEST_ID, -20, -4000);
    expect(phaseOf(view)).toBe('PEEK');
    await drag(COSMOS_SHEET_BODY_GESTURE_TEST_ID, -400, -100);
    expect(phaseOf(view)).toBe('EXPANDED');
    await drag(COSMOS_SHEET_HANDLE_GESTURE_TEST_ID, 2000, 300);
    expect(phaseOf(view)).toBe('CLOSED');
    expect(field.getState()).toBe(state);
    expect(reads(t)).toEqual(before);
  });

  it('a drag\'s new phase reaches the host when the move SETTLES, never mid-flight; an interrupted move tells nothing', async () => {
    // Final HONOR review (2026-11-16): told at release, the host's commit of EXPANDED → PEEK held one frame for 83–99 ms
    // while the sheet still travelled. The mock's springs finish at once; here their completions are held and released.
    const held: ((finished?: boolean) => void)[] = [];
    jest.spyOn(Reanimated, 'withSpring').mockImplementation(((toValue: number, _config: unknown, callback?: (finished?: boolean) => void) => {
      if (callback !== undefined) held.push(callback);
      return toValue;
    }) as unknown as typeof Reanimated.withSpring);
    const { view } = await mount();
    await focusByResult(view, E3);
    await measure(view, 2000);
    await action(view, 'expand');
    expect(phaseOf(view)).toBe('EXPANDED');
    held.length = 0;
    await drag(COSMOS_SHEET_HANDLE_GESTURE_TEST_ID, 250, 300);
    expect(held).toHaveLength(1);
    expect(phaseOf(view)).toBe('EXPANDED'); // released, still travelling: the host is not told yet
    await act(async () => { held[0](false); }); // interrupted (a new grab): nothing is told
    await flush();
    expect(phaseOf(view)).toBe('EXPANDED');
    await act(async () => { held[0](true); }); // settled: told once
    await flush();
    expect(phaseOf(view)).toBe('PEEK');
  });

  it('Reduce Motion changes how it moves, never where it settles', async () => {
    (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = true;
    const { view } = await mount();
    await focusByResult(view, E3);
    await measure(view, 2000);
    await drag(COSMOS_SHEET_BODY_GESTURE_TEST_ID, -400, 0);
    expect(phaseOf(view)).toBe('EXPANDED');
    await action(view, 'collapse');
    expect(phaseOf(view)).toBe('PEEK');
  });
});

describe('Slice D — language and accessibility (headless)', () => {
  it.each(['ar', 'en'] as const)('%s: the handle is a button naming its one available act, with the approved accessibility rows only', async (language) => {
    const words = cosmosProductCopy(language);
    const { view } = await mount(language);
    await focusByResult(view, E3);
    await measure(view, 2000);
    expect(handle(view).props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: words.sheetExpand, accessibilityLanguage: language });
    expect(handle(view).props.accessibilityState).toMatchObject({ expanded: false, disabled: false });
    expect(handle(view).props.accessibilityActions).toEqual([{ name: 'expand', label: words.sheetExpand }, { name: 'close', label: words.sheetClose }]);
    await action(view, 'expand');
    expect(handle(view).props.accessibilityLabel).toBe(words.sheetCollapse);
    expect(handle(view).props.accessibilityState).toMatchObject({ expanded: true });
    expect(handle(view).props.accessibilityActions).toEqual([{ name: 'collapse', label: words.sheetCollapse }, { name: 'close', label: words.sheetClose }]);
    // No new visible word: the sheet's rows are never drawn as text.
    for (const word of [words.sheetExpand, words.sheetCollapse, words.sheetClose]) expect(view.queryByText(word)).toBeNull();
  });
});
