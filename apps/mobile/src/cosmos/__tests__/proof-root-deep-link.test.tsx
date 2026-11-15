// COSMOS (experimental, isolated) — the proof root's deep links: the launch URL is applied ONCE per process.
//
// Regression for the deep-link cold-start loop found on the HONOR (2026-11-15): the link effect depended on `follow`,
// `follow` changed with every owner, so each new owner re-ran the effect, read the launch URL again and switched world
// again — a process started by `qandeel-cosmos-proof://world/<w>` never left "Reading…". This test cold-starts the
// root through such a URL and proves: the world is entered once; later settles create no further owner; later `url`
// events, tab presses, language and step links keep working; and owner creation stays exactly one per act that
// changes (world, language, visit). The same stand-ins as proof-root.test.tsx (Skia declarative, both runtimes one).

import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { settle as flush } from '../../runtime-entry/__fixtures__/runtime-entry';
import { COSMOS_COPY } from '../__validation__/copy';
import { COSMOS_FIXTURE_LABEL_TEST_ID, COSMOS_HUD_TEST_ID, CosmosProofRoot } from '../__validation__/CosmosProofRoot';

const mockCreated: string[] = [];
jest.mock('../__validation__/owners', () => {
  const actual = jest.requireActual<typeof import('../__validation__/owners')>('../__validation__/owners');
  return {
    ...actual,
    createCosmosOwner: (world: Parameters<typeof actual.createCosmosOwner>[0], options: Parameters<typeof actual.createCosmosOwner>[1]) => {
      mockCreated.push(world);
      return actual.createCosmosOwner(world, options);
    },
  };
});
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
    const Component = ({ children }: { children?: unknown }) => React.createElement(View, { skiaElement: name } as object, (children ?? null) as never);
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
    useImage: () => image,
    Skia: { XYWHRect: disposable, RSXform: disposable, PathBuilder: { Make: builder } },
  };
});

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
const SCHEME = 'qandeel-cosmos-proof://';
let view: RenderResult | null = null;
let urlHandler: ((event: { url: string }) => void) | null = null;
const settle = async () => { await act(async () => { for (let i = 0; i < 8; i += 1) await flush(); }); };
const sky = (v: RenderResult) => v.getByLabelText(new RegExp(`^(${copy.sky}|${COSMOS_COPY.ar.sky}) ·`, 'u'));
const layout = async (v: RenderResult) => {
  await act(async () => { fireEvent(sky(v), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } }); });
  await settle();
};
const hud = (v: RenderResult) => v.getByTestId(COSMOS_HUD_TEST_ID).props.children as string;
const selectedTab = (v: RenderResult) => v.getAllByRole('tab').find((tab) => tab.props.accessibilityState?.selected === true)?.props.accessibilityState;
const link = async (path: string) => { await act(async () => { urlHandler?.({ url: `${SCHEME}${path}` }); }); };

beforeEach(() => {
  mockCreated.length = 0;
  urlHandler = null;
  jest.spyOn(Linking, 'addEventListener').mockImplementation(((type: string, handler: (event: { url: string }) => void) => {
    // The ROOT's subscription is the first 'url' listener; the Personal owner's integration runtime registers its own
    // later, and that one must not be mistaken for the root's.
    if (type === 'url' && urlHandler === null) urlHandler = handler;
    return { remove: () => { if (urlHandler === handler) urlHandler = null; } };
  }) as never);
});
afterEach(async () => { await cleanup(); view = null; jest.restoreAllMocks(); });

describe('CosmosProofRoot deep links', () => {
  it('a cold start through a world link enters that world ONCE, and never loops on the launch URL', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(`${SCHEME}world/personal`);
    view = await render(<CosmosProofRoot />);
    await layout(view);
    // The default owner (Public) and ONE Personal owner for the launch URL: the Personal world is READY and drawn.
    expect(mockCreated).toEqual(['PUBLIC', 'PERSONAL']);
    expect(hud(view)).toMatch(/8 entities/u);
    expect(view.getByText(copy.rungs.PERSONAL[0].toUpperCase())).toBeTruthy();
    expect(selectedTab(view)).toBeTruthy();
    // Time passes, React commits again: no further owner is made (the loop re-created one per commit).
    await settle(); await settle(); await settle();
    expect(mockCreated).toEqual(['PUBLIC', 'PERSONAL']);
    expect(hud(view)).toMatch(/8 entities/u);
    // A later `url` event still switches world (one new owner), and the world stays switched.
    await link('world/shared');
    await layout(view);
    expect(mockCreated).toEqual(['PUBLIC', 'PERSONAL', 'SHARED']);
    expect(hud(view)).toMatch(/9 entities/u);
    await settle(); await settle();
    expect(mockCreated).toHaveLength(3);
    // A tab press switches too (one new owner).
    await act(async () => { fireEvent.press(view!.getByText(copy.PUBLIC.toUpperCase())); });
    await layout(view);
    expect(mockCreated).toEqual(['PUBLIC', 'PERSONAL', 'SHARED', 'PUBLIC']);
    expect(hud(view)).toMatch(/29 entities/u);
    // A step link acts on the CURRENT owner (no new owner); a language link makes one (language is part of the owner).
    await link('step/in');
    await settle();
    expect(sky(view).props.accessibilityLabel).toContain(copy.rungs.PUBLIC[1]);
    expect(mockCreated).toHaveLength(4);
    await link('lang/ar');
    await layout(view);
    expect(view.getByTestId(COSMOS_FIXTURE_LABEL_TEST_ID).props.children).toBe(COSMOS_COPY.ar.fixture);
    expect(mockCreated).toHaveLength(5);
    // A fault mode through the sheet still re-enters (one new owner) and shows the refusal.
    await act(async () => { fireEvent.press(view!.getByLabelText(COSMOS_COPY.ar.measurements)); });
    await act(async () => { fireEvent.press(view!.getByText(COSMOS_COPY.ar.faults.REFUSED)); });
    await layout(view);
    expect(view.getByTestId('cosmos-absence-REFUSED')).toBeTruthy();
    expect(mockCreated).toHaveLength(6);
    await settle(); await settle();
    expect(mockCreated).toHaveLength(6);
  });

  it('a launcher start (no launch URL) makes exactly the default owner, and later links are still handled', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    view = await render(<CosmosProofRoot />);
    await layout(view);
    await settle(); await settle();
    expect(mockCreated).toEqual(['PUBLIC']);
    expect(hud(view)).toMatch(/29 entities/u);
    await link('world/personal');
    await layout(view);
    expect(mockCreated).toEqual(['PUBLIC', 'PERSONAL']);
    expect(hud(view)).toMatch(/8 entities/u);
  });
});
