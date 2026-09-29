/**
 * W3-01 — E2E-D-01 (open General Settings), D-10 (Dark / Light / System) and D-07 (Sign out) on the
 * PRODUCTION phase surface, over a runtime the harness genuinely built.
 *
 * `RuntimePhaseSurface` is the route's own mapping; the store, the bootstrap, the Conversation, the depth
 * pair and the ONE appearance authority are all real. Stood in for: the network, the Supabase project,
 * the operating system's appearance (a switch) and the native appearance declaration (a recorder).
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo, BackHandler, StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createEphemeralAppearancePreferenceStore, type AppearancePreference, type AppearancePreferenceStore, type EffectiveAppearance, type SystemAppearanceSource } from '../../appearance';
import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { CANONICAL_VISUAL } from '../../conversation/visual/canonical-visual.generated';
import { resize } from '../../responsive/__fixtures__/composition';
import { settingsCopy } from '../../settings';
import { productSignInCopy } from '../auth-gateway';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLocale } from '../locale/device-locale';
import { harness, settle, type IntegrationHarness } from '../__fixtures__/integration';

// The platform status content is observed where the app decides it: each mounted `StatusBar` becomes a
// marker carrying the style it was given.
jest.mock('expo-status-bar', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { StatusBar: ({ style }: { style: string }) => createElement(View, { testID: 'qandeel-test-status-bar', statusStyle: style } as object) };
});

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const LANGUAGE = deviceProductLocale().language;
const COPY = settingsCopy(LANGUAGE);
const DARK = CANONICAL_VISUAL.palettes.DARK.standard;
const LIGHT = CANONICAL_VISUAL.palettes.LIGHT.standard;

function systemDouble(initial: EffectiveAppearance) {
  let current = initial;
  const listeners = new Set<(next: EffectiveAppearance) => void>();
  const source: SystemAppearanceSource = {
    current: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    source,
    async set(next: EffectiveAppearance) {
      current = next;
      await act(async () => {
        for (const listener of Array.from(listeners)) listener(next);
        await settle();
      });
    },
  };
}

interface World {
  readonly h: IntegrationHarness;
  readonly view: RenderResult;
  readonly system: ReturnType<typeof systemDouble>;
  readonly declared: AppearancePreference[];
  readonly store: AppearancePreferenceStore;
}

async function world(options: { store?: AppearancePreferenceStore; system?: EffectiveAppearance; user?: string } = {}): Promise<World> {
  const system = systemDouble(options.system ?? 'LIGHT');
  const declared: AppearancePreference[] = [];
  const store = options.store ?? createEphemeralAppearancePreferenceStore();
  const h = await harness({
    initialSession: { userId: options.user ?? 'alice', accessToken: 'token-a' },
    appearanceStore: store,
    systemAppearance: system.source,
    nativeAppearance: { apply: (preference) => declared.push(preference) },
  });
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody([exchange('fixture: earlier words', { key: 'fixture-earlier' })]) } : { status: 500, body: {} }));
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <RuntimePhaseSurface runtime={h.runtime} />
    </SafeAreaProvider>,
  );
  await act(async () => {
    await settle();
  });
  return { h, view, system, declared, store };
}

async function press(view: RenderResult, testID: string): Promise<void> {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await settle();
  });
}

const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const conversationGround = (view: RenderResult) => style(view.getByTestId('qandeel-conversation', { includeHiddenElements: true })).backgroundColor;
const settingsGround = (view: RenderResult) => style(view.getByTestId('qandeel-settings')).backgroundColor;
const statusBars = (view: RenderResult) =>
  view.queryAllByTestId('qandeel-test-status-bar', { includeHiddenElements: true }).map((node) => node.props.statusStyle as string);

function systemBack() {
  type Handler = Parameters<typeof BackHandler.addEventListener>[1];
  const handlers: { handler: Handler; removed: boolean }[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    const entry = { handler, removed: false };
    handlers.push(entry);
    return { remove: () => { entry.removed = true; } };
  });
  return {
    async press(): Promise<boolean> {
      let consumed = false;
      await act(async () => {
        for (const entry of [...handlers].reverse()) {
          if (!entry.removed && entry.handler({} as Parameters<Handler>[0]) === true) {
            consumed = true;
            break;
          }
        }
        await settle();
      });
      return consumed;
    },
  };
}

async function openAnalysis(view: RenderResult): Promise<void> {
  await press(view, 'qandeel-depth-to-analysis');
  await fireEvent(view.getByTestId('qandeel-depth-analysis'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
  await resize(view, 390, 844, { insetTop: 104, insetBottom: 34 });
  await act(async () => {
    await settle();
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('E2E-D-01 — the ONE General Settings destination, entered from Personal QANDEEL (P4-C1 S-B)', () => {
  it('the entry is on the Personal row beneath the upper chrome — never in it — at the logical END, 44 × 44, with its approved name', async () => {
    const { h, view } = await world();
    const row = view.getByTestId('qandeel-personal-row');
    const entry = within(row).getByTestId('qandeel-settings-entry');
    expect(view.getAllByTestId('qandeel-settings-entry')).toHaveLength(1);
    // The upper chrome still holds only the depth control, and the row holds only the Settings entry.
    expect(within(row).queryByTestId('qandeel-depth-to-analysis')).toBeNull();
    expect(entry.props.accessibilityLabel).toBe(COPY.title);
    expect(entry.props.accessibilityRole).toBe('button');
    expect(style(entry)).toMatchObject({ width: 44, height: 44, minWidth: 44, minHeight: 44 });
    // Logical END: the reader's end edge is the LEFT in Arabic and the RIGHT in English (explicit LTR frame).
    expect(style(row).justifyContent).toBe(LANGUAGE === 'ar' ? 'flex-start' : 'flex-end');
    expect(style(row).height).toBe(44);
    h.dispose();
  });

  it('opening Settings keeps the SAME Personal runtime, Session and Conversation — nothing is rebuilt, nothing is routed — and Back returns to it exactly', async () => {
    const { h, view } = await world();
    const before = h.ready();
    const sessionsBefore = h.http.creates().length;
    await fireEvent.changeText(view.getByTestId('qandeel-conversation-input'), 'unsent words');

    await press(view, 'qandeel-settings-entry');
    expect(view.getByTestId('qandeel-settings')).toBeTruthy();
    // The Personal world is still mounted beneath, out of reach of touch and assistive technology.
    const layer = view.getByTestId('qandeel-depth-conversation', { includeHiddenElements: true });
    expect(layer.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(layer.props.pointerEvents).toBe('none');
    expect(view.queryByTestId('qandeel-conversation-input')).toBeNull();
    expect(h.ready()).toBe(before);

    await press(view, 'qandeel-settings-back');
    expect(view.queryByTestId('qandeel-settings')).toBeNull();
    expect(h.ready()).toBe(before);
    expect(h.ready().conversation).toBe(before.conversation);
    expect(h.ready().generation).toBe(before.generation);
    expect(h.http.creates()).toHaveLength(sessionsBefore);
    expect(view.getByTestId('qandeel-conversation-input').props.value).toBe('unsent words');
    h.dispose();
  });

  it('Android system Back closes Settings and nothing else; with Settings closed, the Conversation leaves Back to the platform', async () => {
    const back = systemBack();
    const { h, view } = await world();
    await press(view, 'qandeel-settings-entry');
    expect(await back.press()).toBe(true);
    expect(view.queryByTestId('qandeel-settings')).toBeNull();
    expect(view.getByTestId('qandeel-conversation')).toBeTruthy();
    expect(await back.press()).toBe(false);
    h.dispose();
  });

  // Re-anchored by W3-02 (E2E-D-09): the root now holds THREE real groups — Account & Identity, with its one
  // function (the Public ID row), before the two W3-01 owns. Still no placeholder and no other group.
  it('exposes exactly the functional groups that exist — W3-02’s Account & Identity and W3-01’s two — no placeholder, no other group — and exactly these controls', async () => {
    const { h, view } = await world();
    await press(view, 'qandeel-settings-entry');
    const settings = within(view.getByTestId('qandeel-settings'));
    const headers = settings.getAllByRole('header').map((node) => (node.props.children as string));
    expect(headers).toEqual([COPY.title, COPY.accountGroup, COPY.appearanceGroup, COPY.supportGroup]);
    const controls = [...settings.getAllByRole('button'), ...settings.getAllByRole('radio')].map((node) => node.props.accessibilityLabel as string).sort();
    const publicIdRow = [COPY.publicId.term, '@nightlamp27', COPY.publicId.available].join(', ');
    expect(controls).toEqual([COPY.backName, publicIdRow, COPY.appearance.DARK, COPY.appearance.LIGHT, COPY.appearance.SYSTEM, COPY.signOut].sort());
    for (const node of settings.getAllByRole('radio')) expect(style(node).minHeight).toBeGreaterThanOrEqual(44);
    expect(style(settings.getByTestId('qandeel-settings-back'))).toMatchObject({ width: 44, height: 44 });
    h.dispose();
  });

  it('Settings is never reachable from the Analysis depth', async () => {
    const { h, view } = await world();
    await openAnalysis(view);
    expect(view.queryByTestId('qandeel-settings-entry')).toBeNull();
    expect(within(view.getByTestId('qandeel-depth-analysis')).queryByTestId('qandeel-settings-entry', { includeHiddenElements: true })).toBeNull();
    h.dispose();
  });
});

describe('E2E-D-10 — Dark / Light / System, painted from the canonical families', () => {
  it('the default is Dark: a reader with no choice on a Light device sees the Dark Conversation and Settings, with Dark selected', async () => {
    const { h, view } = await world({ system: 'LIGHT' });
    expect(conversationGround(view)).toBe(DARK.world);
    await press(view, 'qandeel-settings-entry');
    expect(settingsGround(view)).toBe(DARK.world);
    const dark = view.getByTestId('qandeel-appearance-dark');
    expect(dark.props.accessibilityState).toMatchObject({ checked: true, selected: true });
    expect(view.getByTestId('qandeel-appearance-dark-selected')).toBeTruthy();
    expect(view.queryByTestId('qandeel-appearance-light-selected')).toBeNull();
    h.dispose();
  });

  it('choosing Light repaints Settings and the Conversation from the canonical Light family, and the status content turns dark', async () => {
    const { h, view, declared, store } = await world({ system: 'DARK' });
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-appearance-light');
    expect(settingsGround(view)).toBe(LIGHT.world);
    expect(LIGHT.routes.world).toBe('qandeel.world.fill → qandeel.expression.world');
    expect(view.getByTestId('qandeel-appearance-light').props.accessibilityState).toMatchObject({ checked: true, selected: true });
    expect(view.getByTestId('qandeel-appearance-dark').props.accessibilityState).toMatchObject({ checked: false, selected: false });
    // Not colour alone: the selected choice carries a SHAPE the others do not.
    expect(view.getByTestId('qandeel-appearance-light-selected')).toBeTruthy();
    expect(view.queryByTestId('qandeel-appearance-dark-selected')).toBeNull();
    expect(statusBars(view).at(-1)).toBe('dark');
    expect(store.read('alice')).toBe('LIGHT');
    expect(declared.at(-1)).toBe('LIGHT');

    await press(view, 'qandeel-settings-back');
    expect(conversationGround(view)).toBe(LIGHT.world);
    expect(style(view.getByTestId('qandeel-conversation-composer')).backgroundColor).toBe(LIGHT.field);
    h.dispose();
  });

  it('System follows the operating system live, on Settings and the Conversation', async () => {
    const { h, view, system } = await world({ system: 'DARK' });
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-appearance-system');
    expect(settingsGround(view)).toBe(DARK.world);
    await system.set('LIGHT');
    expect(settingsGround(view)).toBe(LIGHT.world);
    await press(view, 'qandeel-settings-back');
    expect(conversationGround(view)).toBe(LIGHT.world);
    await system.set('DARK');
    expect(conversationGround(view)).toBe(DARK.world);
    h.dispose();
  });

  it('the Analysis stays the dark place under a Light preference, and returning from it restores Light', async () => {
    const { h, view } = await world({ system: 'LIGHT' });
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-appearance-light');
    await press(view, 'qandeel-settings-back');
    expect(conversationGround(view)).toBe(LIGHT.world);

    await openAnalysis(view);
    expect(style(view.getByTestId('qandeel-analysis-return-bar')).backgroundColor).toBe(DARK.world);
    expect(statusBars(view).at(-1)).toBe('light');
    // Non-vacuity: the preference really is Light while the Analysis paints Dark.
    expect(h.runtime.appearance.getState().effective).toBe('LIGHT');

    await press(view, 'qandeel-depth-to-conversation');
    await fireEvent(view.getByTestId('qandeel-depth-conversation'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
    await act(async () => {
      await settle();
    });
    expect(conversationGround(view)).toBe(LIGHT.world);
    expect(statusBars(view).at(-1)).toBe('dark');
    h.dispose();
  });

  it('increased contrast composes with both appearances: the F1 increased family of the effective appearance', async () => {
    // The platform setting the surface reads (iOS under the Jest preset), switched on.
    jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(true);
    const { h, view } = await world({ system: 'LIGHT' });
    const restMarker = () => style(view.getByTestId('qandeel-appearance-system-marker')).borderColor;
    // Non-vacuity: the F1 increased rest ink differs from the standard one in BOTH families.
    expect(CANONICAL_VISUAL.palettes.DARK.increased.restInk).not.toBe(DARK.restInk);
    expect(CANONICAL_VISUAL.palettes.LIGHT.increased.restInk).not.toBe(LIGHT.restInk);
    await press(view, 'qandeel-settings-entry');
    expect(restMarker()).toBe(CANONICAL_VISUAL.palettes.DARK.increased.restInk);
    await press(view, 'qandeel-appearance-light');
    expect(restMarker()).toBe(CANONICAL_VISUAL.palettes.LIGHT.increased.restInk);
    expect(style(view.getByTestId('qandeel-appearance-light-marker')).borderColor).toBe(CANONICAL_VISUAL.palettes.LIGHT.increased.selectedInk);
    h.dispose();
  });

  it('the same reader on the same device gets their choice after a restart; another reader does not', async () => {
    const store = createEphemeralAppearancePreferenceStore();
    const first = await world({ store, system: 'DARK' });
    await press(first.view, 'qandeel-settings-entry');
    await press(first.view, 'qandeel-appearance-light');
    await first.view.unmount();
    first.h.dispose();

    const restarted = await world({ store, system: 'DARK' });
    expect(conversationGround(restarted.view)).toBe(LIGHT.world);
    await restarted.view.unmount();
    restarted.h.dispose();

    const other = await world({ store, system: 'LIGHT', user: 'bob' });
    expect(conversationGround(other.view)).toBe(DARK.world);
    other.h.dispose();
  });
});

describe('E2E-D-07 — Sign out: this device, once, back to the ordinary Sign in, in the Dark default', () => {
  it('calls the ONE auth sign-out exactly once, even on a double tap, and reaches Sign in WITHOUT the ended-session notice', async () => {
    const { h, view } = await world();
    const signOut = jest.spyOn(h.runtime.auth, 'signOut');
    // The provider's answer is held open, so the second tap lands while the first is still in flight.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const real = h.auth.signOut;
    jest.spyOn(h.auth, 'signOut').mockImplementation(async () => {
      await held;
      return real();
    });
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-settings-sign-out');
    await press(view, 'qandeel-settings-sign-out');
    await act(async () => {
      release();
      await settle();
    });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(h.auth.signOutCount()).toBe(1);
    expect(h.runtime.auth.getState()).toEqual({ kind: 'SIGNED_OUT' });
    expect(h.phase().kind).toBe('SIGNED_OUT');
    expect(view.getByTestId('qandeel-sign-in-gateway')).toBeTruthy();
    expect(within(view.getByTestId('qandeel-sign-in-notice')).queryByText(productSignInCopy(LANGUAGE).sessionEnded)).toBeNull();
    expect(view.queryByTestId('qandeel-settings')).toBeNull();
    expect(view.queryByTestId('qandeel-world-depth')).toBeNull();
    h.dispose();
  });

  it('while the sign-out is in flight the control is busy and refuses; the world is retired when it completes', async () => {
    const { h, view } = await world();
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const real = h.auth.signOut;
    jest.spyOn(h.auth, 'signOut').mockImplementation(async () => {
      await held;
      return real();
    });
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-settings-sign-out');
    const control = view.getByTestId('qandeel-settings-sign-out');
    expect(control.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await press(view, 'qandeel-settings-sign-out');
    await act(async () => {
      release();
      await settle();
    });
    expect(h.auth.signOutCount()).toBe(1);
    expect(h.phase().kind).toBe('SIGNED_OUT');
    h.dispose();
  });

  it('a stale refresh callback landing during or after the sign-out cannot bring the reader back', async () => {
    const { h, view } = await world();
    await press(view, 'qandeel-settings-entry');
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const real = h.auth.signOut;
    jest.spyOn(h.auth, 'signOut').mockImplementation(async () => {
      await held;
      return real();
    });
    await press(view, 'qandeel-settings-sign-out');
    await act(async () => {
      // DURING the sign-out: a refresh that was already in flight lands.
      h.auth.emit({ userId: 'alice', accessToken: 'token-refreshed' }, 'TOKEN_REFRESHED');
      release();
      await settle();
      h.auth.emit({ userId: 'alice', accessToken: 'token-late' }, 'SIGNED_IN');
      await settle();
    });
    expect(h.runtime.auth.getState().kind).toBe('SIGNED_OUT');
    expect(h.phase().kind).toBe('SIGNED_OUT');
    expect(view.getByTestId('qandeel-sign-in-gateway')).toBeTruthy();
    h.dispose();
  });

  it('after sign-out the appearance is the Dark default; the reader’s own choice returns at their next explicit sign-in', async () => {
    const { h, view, declared, store } = await world({ system: 'LIGHT' });
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-appearance-light');
    await press(view, 'qandeel-settings-sign-out');
    expect(h.runtime.appearance.getState()).toEqual({ bound: false, preference: 'DARK', effective: 'DARK' });
    expect(declared.at(-1)).toBe('DARK');
    expect(statusBars(view).at(-1)).toBe('light');
    expect(store.read('alice')).toBe('LIGHT');

    h.auth.signInWith({ ok: true, value: { userId: 'alice', accessToken: 'token-a2' } });
    await act(async () => {
      await h.runtime.auth.signInWithPassword('alice@example.test', 'secret');
      await settle();
    });
    expect(h.phase().kind).toBe('READY');
    expect(conversationGround(view)).toBe(LIGHT.world);
    h.dispose();
  });
});
