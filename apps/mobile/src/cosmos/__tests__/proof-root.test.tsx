// COSMOS (experimental, isolated) — the proof root mounts, labels its fixtures and relays acts to the owners.
//
// A structural smoke test only: Skia is a declarative stand-in here and the two runtimes are one, so this catches
// JS-level crashes on mount and on switching worlds, and proves the element tree, the chrome and the
// act → authority → settle wiring. It proves nothing about pixels (see headless-pixels.test.tsx) or frame pacing.

import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';

import { settleLong } from '../../runtime-entry/__fixtures__/runtime-entry';
import { COSMOS_COPY } from '../__validation__/copy';
import { COSMOS_FIXTURE_LABEL_TEST_ID, COSMOS_HUD_TEST_ID, COSMOS_OVERVIEW_TAG_TEST_ID, COSMOS_PROOF_ROOT_TEST_ID, CosmosProofRoot } from '../__validation__/CosmosProofRoot';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { createElement, Fragment } = jest.requireActual<typeof import('react')>('react');
  return { SafeAreaProvider: ({ children }: { children: unknown }) => createElement(Fragment, null, children as never), useSafeAreaInsets: () => ({ top: 44, left: 0, right: 0, bottom: 34 }) };
});
jest.mock('../../integration/locale/device-locale', () => ({ deviceProductLanguage: () => 'en' }));
jest.mock('../__validation__/fixture-transports', () => {
  const actual = jest.requireActual<typeof import('../__validation__/fixture-transports')>('../__validation__/fixture-transports');
  const instant = <T extends { latency?: number }>(options: T): T => ({ ...options, latency: 0 });
  return {
    ...actual,
    createPublicFixtureTransport: (options: Parameters<typeof actual.createPublicFixtureTransport>[0]) => actual.createPublicFixtureTransport(instant(options)),
    createSharedFixtureTransport: (options: Parameters<typeof actual.createSharedFixtureTransport>[0], language: 'ar' | 'en') => actual.createSharedFixtureTransport(instant(options), language),
    createPersonalFixtureWorld: (options: Parameters<typeof actual.createPersonalFixtureWorld>[0], language: 'ar' | 'en') => actual.createPersonalFixtureWorld(instant(options), language),
  };
});
jest.mock('@shopify/react-native-skia', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const element = (name: string) => {
    const Component = ({ children, ...rest }: { children?: unknown }) => React.createElement(View, { skiaElement: name, skiaCount: Array.isArray((rest as { transforms?: unknown[] }).transforms) ? (rest as { transforms: unknown[] }).transforms.length : undefined } as object, (children ?? null) as never);
    Component.displayName = name;
    return Component;
  };
  const disposable = () => ({ dispose: () => undefined });
  const builder = () => { const b: Record<string, unknown> = { build: disposable, dispose: () => undefined }; for (const m of ['moveTo', 'lineTo', 'close']) b[m] = () => b; return b; };
  const image = { width: () => 1024, height: () => 1024, dispose: () => undefined };
  return {
    Canvas: element('Canvas'), Fill: element('Fill'), Group: element('Group'), Path: element('Path'), Rect: element('Rect'), RadialGradient: element('RadialGradient'),
    LinearGradient: element('LinearGradient'), ImageShader: element('ImageShader'), Atlas: element('Atlas'),
    FilterMode: { Nearest: 0, Linear: 1 }, MipmapMode: { None: 0, Nearest: 1, Linear: 2 },
    // The images are "decoded" at once.
    useImage: () => image,
    Skia: { XYWHRect: disposable, RSXform: disposable, PathBuilder: { Make: builder } },
  };
});

// The repository's Reanimated stand-in boxes a shared value without `modify`; the frame probe uses it, so it is added
// to the box here (mutate the boxed value in place, as the real one does).
beforeAll(() => {
  const reanimated = jest.requireMock<{ useSharedValue: <T>(initial: T) => { get(): T; set(next: T): void; modify?: (fn: (value: T) => T) => void } }>('react-native-reanimated');
  const boxed = reanimated.useSharedValue;
  reanimated.useSharedValue = <T,>(initial: T) => {
    const box = boxed(initial);
    box.modify ??= (fn) => box.set(fn(box.get()));
    return box;
  };
});

const copy = COSMOS_COPY.en;
let view: RenderResult | null = null;
const settle = async () => { await act(async () => { await settleLong(); }); };
const sky = (v: RenderResult) => v.getByLabelText(new RegExp(`^(${copy.sky}|${COSMOS_COPY.ar.sky}) ·`, 'u'));
const layout = async (v: RenderResult) => {
  // The gesture surface is the stage's accessible container; the test renderer fires no layout, so one is given.
  await act(async () => { fireEvent(sky(v), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } }); });
  await settle();
};
const count = (v: RenderResult, name: string) => (JSON.stringify(v.toJSON()).match(new RegExp(`"skiaElement":"${name}"`, 'gu')) ?? []).length;
afterEach(async () => { await cleanup(); view = null; });

describe('CosmosProofRoot', () => {
  it('mounts the Public world over the labelled fixture and says so, persistently', async () => {
    view = await render(<CosmosProofRoot />);
    await layout(view);
    expect(view.getByTestId(COSMOS_PROOF_ROOT_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(COSMOS_FIXTURE_LABEL_TEST_ID).props.children).toBe('SYNTHETIC FIXTURE · NOT REAL ANALYSIS');
    expect(view.getByTestId(COSMOS_HUD_TEST_ID).props.children).toMatch(/mode FULL · 29 entities/u);
    expect(view.queryByTestId('cosmos-absence-LOADING')).toBeNull();
    // ONE canvas; three plates; and per rung ONE atlas draw whatever the entity count (three rungs, FULL).
    expect(count(view, 'Canvas')).toBe(1);
    expect(count(view, 'ImageShader')).toBe(3);
    expect(count(view, 'Atlas')).toBe(3);
  });

  it('switches world and language without a crash, keeps the fixture label, and commits a Personal position', async () => {
    view = await render(<CosmosProofRoot />);
    await layout(view);
    await act(async () => { fireEvent.press(view!.getByText(copy.SHARED.toUpperCase())); });
    await layout(view);
    expect(view.getByTestId(COSMOS_HUD_TEST_ID).props.children).toMatch(/9 entities/u);
    await act(async () => { fireEvent.press(view!.getByLabelText('العربية')); });
    await layout(view);
    expect(view.getByTestId(COSMOS_FIXTURE_LABEL_TEST_ID).props.children).toBe(COSMOS_COPY.ar.fixture);
    await act(async () => { fireEvent.press(view!.getByText(COSMOS_COPY.ar.PERSONAL)); });
    await layout(view);
    // Personal: five rungs, no label anywhere on the glass, and the position ticks.
    expect(count(view, 'Atlas')).toBe(5);
    expect(view.getByLabelText(COSMOS_COPY.ar.position(3, 12))).toBeTruthy();
    await act(async () => { fireEvent.press(view!.getByLabelText(COSMOS_COPY.ar.position(3, 12))); });
    await settle();
    expect(view.getByText(COSMOS_COPY.ar.position(3, 12))).toBeTruthy(); // pinned at 3 of 12, through the production commit
    await act(async () => { fireEvent.press(view!.getByText(COSMOS_COPY.ar.PUBLIC)); });
    await layout(view);
    expect(view.getByTestId(COSMOS_PROOF_ROOT_TEST_ID)).toBeTruthy();
  });

  it('keeps the absences apart on the glass: refused, unavailable and an empty world', async () => {
    view = await render(<CosmosProofRoot />);
    await layout(view);
    await act(async () => { fireEvent.press(view!.getByLabelText(copy.measurements)); });
    for (const [fault, id, words] of [['REFUSED', 'cosmos-absence-REFUSED', copy.refused], ['FAIL', 'cosmos-absence-UNAVAILABLE', copy.unavailable], ['EMPTY_WORLD', 'cosmos-absence-WORLD_EMPTY', copy.worldEmpty]] as const) {
      await act(async () => { fireEvent.press(view!.getByText(copy.faults[fault])); });
      await layout(view);
      expect(view.getByTestId(id)).toBeTruthy();
      expect(view.getByText(words)).toBeTruthy();
    }
  });

  it('steps through the authority by the accessible zoom, opens the card at NEAR and returns by the depth rail', async () => {
    view = await render(<CosmosProofRoot />);
    await layout(view);
    await act(async () => { fireEvent(sky(view!), 'accessibilityAction', { nativeEvent: { actionName: 'zoom-in' } }); });
    await settle();
    expect(sky(view).props.accessibilityLabel).toContain(copy.rungs.PUBLIC[1]);
    await act(async () => { fireEvent(sky(view!), 'accessibilityAction', { nativeEvent: { actionName: 'zoom-in' } }); });
    await settle();
    expect(sky(view).props.accessibilityLabel).toContain(copy.rungs.PUBLIC[2]);
    expect(view.getByLabelText(copy.close)).toBeTruthy(); // the card is open
    await act(async () => { fireEvent.press(view!.getByLabelText(copy.rungs.PUBLIC[0])); }); // the rail: back to FAR
    await settle();
    expect(view.queryByLabelText(copy.close)).toBeNull();
    expect(sky(view).props.accessibilityLabel).toContain(copy.rungs.PUBLIC[0]);
  });

  it('the overdraw modes change only what is drawn, and the overview dispatches nothing canonical', async () => {
    view = await render(<CosmosProofRoot />);
    await layout(view);
    await act(async () => { fireEvent(sky(view!), 'accessibilityAction', { nativeEvent: { actionName: 'zoom-in' } }); });
    await settle();
    const before = sky(view).props.accessibilityLabel as string;
    await act(async () => { fireEvent.press(view!.getByLabelText(copy.measurements)); });
    await act(async () => { fireEvent.press(view!.getByText('PLATES_ONLY')); });
    expect(count(view, 'Atlas')).toBe(0);
    expect(count(view, 'ImageShader')).toBe(3);
    await act(async () => { fireEvent.press(view!.getByText('NO_BODIES')); });
    expect(count(view, 'Atlas')).toBe(3);
    await act(async () => { fireEvent.press(view!.getByText('FULL')); });
    expect(view.getByTestId(COSMOS_HUD_TEST_ID).props.children).toMatch(/mode FULL/u);
    // Overview: a tag, the same canonical rung, and Back returns.
    await act(async () => { fireEvent.press(view!.getByLabelText(copy.overviewAct)); });
    await settle();
    expect(view.getByTestId(COSMOS_OVERVIEW_TAG_TEST_ID).props.children).toBe(copy.overviewTag);
    expect(sky(view).props.accessibilityLabel).toBe(before);
    await act(async () => { fireEvent.press(view!.getByText(copy.back)); });
    await settle();
    expect(view.queryByTestId(COSMOS_OVERVIEW_TAG_TEST_ID)).toBeNull();
    expect(sky(view).props.accessibilityLabel).toBe(before);
  });
});
