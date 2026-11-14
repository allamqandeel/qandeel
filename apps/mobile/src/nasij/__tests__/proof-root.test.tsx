// NASIJ (experimental, isolated) — the proof root mounts, labels its fixtures and relays acts to the owners.
//
// A structural test only: Skia is a declarative stand-in here and the two runtimes are one, so this proves the element
// tree, the chrome and the act → authority → settle wiring. It proves nothing about pixels or frame pacing.

import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';

import { settle as flush } from '../../runtime-entry/__fixtures__/runtime-entry';
import { NASIJ_COPY } from '../proof/copy';
import { NASIJ_FIXTURE_LABEL_TEST_ID, NASIJ_PROOF_ROOT_TEST_ID, NasijProofRoot } from '../proof/NasijProofRoot';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { createElement, Fragment } = jest.requireActual<typeof import('react')>('react');
  return { SafeAreaProvider: ({ children }: { children: unknown }) => createElement(Fragment, null, children as never), useSafeAreaInsets: () => ({ top: 44, left: 0, right: 0, bottom: 34 }) };
});
jest.mock('../../integration/locale/device-locale', () => ({ deviceProductLanguage: () => 'en' }));
jest.mock('../proof/fixture-transports', () => {
  const actual = jest.requireActual<typeof import('../proof/fixture-transports')>('../proof/fixture-transports');
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
    const Component = ({ children, ...rest }: { children?: unknown }) => React.createElement(View, { ...rest, skiaElement: name } as object, (children ?? null) as never);
    Component.displayName = name;
    return Component;
  };
  const path = () => ({ moveTo: () => undefined, lineTo: () => undefined, close: () => undefined, dispose: () => undefined });
  return {
    Canvas: element('Canvas'), Fill: element('Fill'), Group: element('Group'), Path: element('Path'), Rect: element('Rect'), RadialGradient: element('RadialGradient'),
    ImageShader: element('ImageShader'), FilterMode: { Linear: 1 }, MipmapMode: { Linear: 2 }, TileMode: { Clamp: 0 },
    // No surface here: the cloth is then drawn without its weave, which is the host's own fallback.
    Skia: { Path: { Make: path }, Surface: { Make: () => null, MakeOffscreen: () => null } },
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

const copy = NASIJ_COPY.en;
let view: RenderResult | null = null;
const settle = async () => { await act(async () => { for (let i = 0; i < 8; i += 1) await flush(); }); };
const layout = async (v: RenderResult) => {
  // The gesture surface is the cloth's accessible container; the test renderer fires no layout, so one is given.
  await act(async () => { fireEvent(v.getByLabelText(new RegExp(`^(${copy.cloth}|${NASIJ_COPY.ar.cloth})`, 'u')), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } }); });
  await settle();
};
afterEach(async () => { await cleanup(); view = null; });

describe('NasijProofRoot', () => {
  it('mounts the Public cloth over the labelled fixture and says so, persistently', async () => {
    view = await render(<NasijProofRoot />);
    await layout(view);
    expect(view.getByTestId(NASIJ_PROOF_ROOT_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(NASIJ_FIXTURE_LABEL_TEST_ID).props.children).toBe(copy.fixture.toUpperCase());
    expect(view.getByText(/29 entities/u)).toBeTruthy();
    expect(view.queryByTestId('nasij-absence-LOADING')).toBeNull();
    // One Canvas, and no per-entity node: the Public cloth is a handful of batched paths.
    const json = JSON.stringify(view.toJSON());
    expect(json.match(/"skiaElement":"Canvas"/gu)).toHaveLength(1);
    expect((json.match(/"skiaElement":"Path"/gu) ?? []).length).toBeLessThanOrEqual(3 * 16);
  });

  it('switches world and language, keeps the fixture label, and shows the Personal selvedge', async () => {
    view = await render(<NasijProofRoot />);
    await layout(view);
    await act(async () => { fireEvent.press(view!.getByText(copy.SHARED)); });
    await layout(view);
    expect(view.getByText(/9 entities/u)).toBeTruthy();
    await act(async () => { fireEvent.press(view!.getByLabelText('العربية')); });
    await layout(view);
    expect(view.getByTestId(NASIJ_FIXTURE_LABEL_TEST_ID).props.children).toBe(NASIJ_COPY.ar.fixture.toUpperCase());
    await act(async () => { fireEvent.press(view!.getByText(NASIJ_COPY.ar.PERSONAL)); });
    await layout(view);
    expect(view.getByLabelText(NASIJ_COPY.ar.position(3, 12))).toBeTruthy();
    await act(async () => { fireEvent.press(view!.getByLabelText(NASIJ_COPY.ar.position(3, 12))); });
    await settle();
    expect(view.getByText(NASIJ_COPY.ar.position(3, 12))).toBeTruthy(); // pinned at 3 of 12, through the production commit
  });

  it('keeps the absences apart on the glass: refused, unavailable and an empty world', async () => {
    view = await render(<NasijProofRoot />);
    await layout(view);
    await act(async () => { fireEvent.press(view!.getByLabelText(copy.faultTitle)); });
    for (const [fault, id, words] of [['REFUSED', 'nasij-absence-REFUSED', copy.refused], ['FAIL', 'nasij-absence-UNAVAILABLE', copy.unavailable], ['EMPTY_WORLD', 'nasij-absence-WORLD_EMPTY', copy.worldEmpty]] as const) {
      await act(async () => { fireEvent.press(view!.getByText(copy.faults[fault])); });
      await layout(view);
      expect(view.getByTestId(id)).toBeTruthy();
      expect(view.getByText(words)).toBeTruthy();
    }
    await act(async () => { fireEvent.press(view!.getByText(copy.faults.DENSE)); });
    await layout(view);
    expect(view.getByText(/400 entities/u)).toBeTruthy();
    expect(view.getByText(/1[0-6]? draw ops|[1-9] draw ops/u)).toBeTruthy();
  });

  it('steps along the depth rail through the authority and opens the card by the accessible zoom', async () => {
    view = await render(<NasijProofRoot />);
    await layout(view);
    const cloth = () => view!.getByLabelText(new RegExp(`^${copy.cloth}`, 'u'));
    await act(async () => { fireEvent(cloth(), 'accessibilityAction', { nativeEvent: { actionName: 'zoom-in' } }); });
    await settle();
    expect(cloth().props.accessibilityLabel).toContain(copy.rungs.PUBLIC[1]);
    await act(async () => { fireEvent(cloth(), 'accessibilityAction', { nativeEvent: { actionName: 'zoom-in' } }); });
    await settle();
    expect(cloth().props.accessibilityLabel).toContain(copy.rungs.PUBLIC[2]);
    expect(view.getByLabelText(copy.close)).toBeTruthy(); // the lantern card is open
    await act(async () => { fireEvent.press(view!.getByLabelText(copy.close)); });
    await settle();
    expect(view.queryByLabelText(copy.close)).toBeNull();
    expect(cloth().props.accessibilityLabel).toContain(copy.rungs.PUBLIC[1]);
  });
});
