/**
 * S4-01 — the Global Switcher and the Shared World area on the PRODUCTION phase surface, over a runtime the harness
 * genuinely built: the store, the bootstrap, the Conversation, the composition and the Shared controllers are real; the
 * network is the harness's HTTP double answering as the API does. Every Name is synthetic test text.
 *
 *   Journey C — My World ↔ Shared World: the Personal state is kept and never handed over; Shared entry shows only a
 *               neutral shell until ALLOW; re-entry re-resolves authority; a revoked authority fails safe.
 *   Journey A — invitation → accept → birth → immediate entry into the real World shell (members, welcome, nothing else).
 *   Journey B — the invite answers one non-enumerating confirmation; a malformed ID says so; decline creates nothing.
 */
import { act, cleanup, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { BackHandler, StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { createEphemeralPushDeviceStore } from '../../push';
import { fill, sharedCopy } from '../../shared-world';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLocale } from '../locale/device-locale';
import { harness, settle, type IntegrationHarness } from '../__fixtures__/integration';

jest.mock('expo-status-bar', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { StatusBar: ({ style }: { style: string }) => createElement(View, { testID: 'qandeel-test-status-bar', statusStyle: style } as object) };
});

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const LANGUAGE = deviceProductLocale().language;
const COPY = sharedCopy(LANGUAGE);
const WORLD = '33333333-3333-4333-8333-333333333333';
const INVITATION = '44444444-4444-4444-8444-444444444444';
const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

interface SharedServer {
  root: { capabilities: { invitation: boolean; birth: boolean }; worlds: unknown[]; invitations: unknown[]; closedWorlds: unknown[]; memberRequests: unknown[] };
  entry: () => Promise<{ status: number; body: unknown }> | { status: number; body: unknown };
  invite: { outcome: string };
  accept: { outcome: string; worldId?: string };
  decline: { outcome: string };
}
const ALLOW = { outcome: 'ALLOW', world: { worldId: WORLD, bornAt: '2026-10-05T00:00:00Z', name: null, members: [{ name: 'Amal Fixture', self: true }, { name: 'Bassem Fixture', self: false }] } };
const BORN_WORLD = { worldId: WORLD, name: null, members: [{ name: 'Amal Fixture', self: true }, { name: 'Bassem Fixture', self: false }] };

function serve(h: IntegrationHarness, s: SharedServer) {
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody([exchange('fixture: earlier words', { key: 'fixture-earlier' })]) } : { status: 500, body: {} }));
  h.http.on('/activity/attention', () => ({ status: 200, body: { present: false, categories: { QANDEEL: { present: false }, SHARED: { present: false, count: null }, PUBLIC: { present: false }, INTRODUCTIONS: { present: false }, SYSTEM: { present: false, count: null } }, interruptions: [] } }));
  h.http.on('/shared', () => ({ status: 200, body: s.root }));
  h.http.on('/shared/worlds/', () => s.entry());
  h.http.on('/shared/invitations', () => ({ status: 200, body: s.invite }));
  h.http.on('/accept', () => ({ status: 200, body: s.accept }));
  h.http.on('/decline', () => ({ status: 200, body: s.decline }));
}

async function world(s: SharedServer): Promise<{ h: IntegrationHarness; view: RenderResult }> {
  // S4-04: entering a World is a legitimate moment for the notification education; these journeys are about navigation,
  // so "Not now" was already chosen on this device (the education itself is proven by the S4-04 suite).
  const h = await harness({ initialSession: { userId: 'amal', accessToken: 'token-a' }, pushDeviceStore: createEphemeralPushDeviceStore({ declined: true }) });
  serve(h, s);
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <RuntimePhaseSurface runtime={h.runtime} />
    </SafeAreaProvider>,
  );
  await act(async () => {
    await settle();
  });
  return { h, view };
}

async function press(view: RenderResult, testID: string): Promise<void> {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await settle();
  });
}

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const sharedCalls = (h: IntegrationHarness, fragment: string) => h.http.calls.filter((c) => c.url.includes(fragment));
const personalLayer = (view: RenderResult) => view.getByTestId('qandeel-depth-conversation', { includeHiddenElements: true });

function baseServer(): SharedServer {
  return {
    root: { capabilities: { invitation: true, birth: true }, worlds: [BORN_WORLD], invitations: [], closedWorlds: [], memberRequests: [] },
    entry: () => ({ status: 200, body: ALLOW }),
    invite: { outcome: 'SUBMITTED' },
    accept: { outcome: 'BORN', worldId: WORLD },
    decline: { outcome: 'DECLINED' },
  };
}

describe('S4-01 — the first production Global Switcher', () => {
  it('stands at the Personal Conversation with two destinations, the P2 glyph above each word, QANDEEL selected', async () => {
    const { h, view } = await world(baseServer());
    const switcher = within(view.getByTestId('qandeel-global-switcher'));
    const items = switcher.getAllByRole('radio');
    expect(items.map((node) => node.props.accessibilityLabel)).toEqual([COPY.personalWorld, COPY.sharedWorld]);
    expect(items.map((node) => node.props.accessibilityState.selected)).toEqual([true, false]);
    for (const node of items) expect(style(node).minHeight).toBeGreaterThanOrEqual(44);
    // The glyphs are decorative: the words name the controls.
    expect(view.getByTestId('qandeel-nav-glyph-navMine', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
    expect(view.getByTestId('qandeel-nav-glyph-navShared', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
    // No Public World destination is exposed before its own stage.
    expect(view.queryByTestId('qandeel-nav-glyph-navPublic')).toBeNull();
    // Nothing of Shared is read until the reader goes there.
    expect(sharedCalls(h, '/shared')).toHaveLength(0);
    h.dispose();
  });
});

describe('S4-01 Journey C — My World ↔ Shared World', () => {
  it('keeps the Personal world mounted and untouched, hands nothing over, and restores each area\'s own state', async () => {
    let releaseEntry: (() => void) | null = null;
    const s = baseServer();
    s.entry = () => new Promise((resolve) => { releaseEntry = () => resolve({ status: 200, body: ALLOW }); });
    const { h, view } = await world(s);
    const runtime = h.ready();
    const turnsBefore = sharedCalls(h, '/turns').length;
    const storeBefore = runtime.store.getState();

    // 1. My World captured; 2. Shared entry.
    await press(view, 'qandeel-switcher-shared_world');
    expect(view.getByTestId('qandeel-shared-root')).toBeTruthy();
    expect(personalLayer(view).props.accessibilityElementsHidden).toBe(true);
    expect(personalLayer(view).props.pointerEvents).toBe('none');
    expect(view.getByTestId('qandeel-conversation', { includeHiddenElements: true })).toBeTruthy();

    // Open the World: the neutral pre-authority shell, with no Name, member, welcome or title.
    await press(view, `qandeel-shared-world-${WORLD}`);
    expect(view.getByTestId('qandeel-shared-transition')).toBeTruthy();
    expect(view.queryByText('Bassem Fixture')).toBeNull();
    expect(view.queryByTestId('qandeel-shared-welcome')).toBeNull();
    expect(view.queryByTestId('qandeel-shared-title')).toBeNull();
    // 4. ALLOW: the World opens.
    await act(async () => {
      releaseEntry?.();
      await settle();
    });
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    expect(view.getByTestId('qandeel-shared-welcome').props.accessibilityLabel).toBe(`${COPY.personalWorld}: ${COPY.welcome}`);

    // 5. Nothing of the Personal world transferred, and it was not re-read or re-dispatched.
    expect(runtime.store.getState()).toBe(storeBefore);

    // 6. Back to My World: the same Personal state, reachable again, no reload.
    await press(view, 'qandeel-switcher-my_world');
    expect(view.queryByTestId('qandeel-shared-area')).toBeNull();
    expect(personalLayer(view).props.accessibilityElementsHidden).toBe(false);
    expect(view.getAllByLabelText(/fixture: earlier words/u).length).toBeGreaterThan(0);
    expect(sharedCalls(h, '/turns')).toHaveLength(turnsBefore);
    expect(runtime.store.getState()).toBe(storeBefore);
    expect(h.ready()).toBe(runtime);

    // 7. Re-entry restores the Shared World the reader was in — after authority is resolved again.
    const entriesBefore = sharedCalls(h, '/shared/worlds/').length;
    await press(view, 'qandeel-switcher-shared_world');
    expect(view.getByTestId('qandeel-shared-transition')).toBeTruthy();
    expect(sharedCalls(h, '/shared/worlds/').length).toBe(entriesBefore + 1);
    await act(async () => {
      releaseEntry?.();
      await settle();
    });
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    h.dispose();
  });

  it('fails safe when authority is revoked: one neutral answer, nothing of the World', async () => {
    const s = baseServer();
    const { h, view } = await world(s);
    await press(view, 'qandeel-switcher-shared_world');
    s.entry = () => ({ status: 200, body: { outcome: 'UNAVAILABLE' } });
    await press(view, `qandeel-shared-world-${WORLD}`);
    expect(view.getByTestId('qandeel-shared-world-unavailable')).toBeTruthy();
    expect(view.queryByText('Bassem Fixture')).toBeNull();
    expect(view.queryByTestId('qandeel-shared-members')).toBeNull();
    h.dispose();
  });

  it('keeps Back local: inside a World it returns to the Shared root; at the root it never returns to the Personal world', async () => {
    type Handler = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers: { handler: Handler; removed: boolean }[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      const entry = { handler, removed: false };
      handlers.push(entry);
      return { remove: () => { entry.removed = true; } };
    });
    const live = () => handlers.filter((x) => !x.removed);
    const { h, view } = await world(baseServer());
    await press(view, 'qandeel-switcher-shared_world');
    const atRoot = live().length;
    await press(view, `qandeel-shared-world-${WORLD}`);
    expect(live().length).toBe(atRoot + 1);
    await act(async () => {
      live()[live().length - 1].handler({ type: 'hardwareBackPress', timeStamp: 0 } as never);
      await settle();
    });
    expect(view.getByTestId('qandeel-shared-root')).toBeTruthy();
    expect(live().length).toBe(atRoot);
    h.dispose();
    jest.restoreAllMocks();
  });
});

describe('S4-01 Journey A — invitation → accept → birth → immediate entry', () => {
  it('shows the inviter\'s Name in the approved meaning, accepts, and enters the real World shell at once', async () => {
    const s = baseServer();
    s.root = { capabilities: { invitation: true, birth: true }, worlds: [], invitations: [{ invitationId: INVITATION, inviterName: 'Bassem Fixture' }], closedWorlds: [], memberRequests: [] };
    const { h, view } = await world(s);
    await press(view, 'qandeel-switcher-shared_world');
    const card = within(view.getByTestId(`qandeel-shared-invitation-${INVITATION}`));
    expect(card.getByText(fill(COPY.invitation, 'Bassem Fixture'))).toBeTruthy();
    s.root = { ...s.root, worlds: [BORN_WORLD], invitations: [] };
    await press(view, 'qandeel-shared-accept');
    const accepts = sharedCalls(h, '/accept');
    expect(accepts).toHaveLength(1);
    expect(Object.keys(JSON.parse(accepts[0].body ?? '{}'))).toEqual(['commandId']);
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    const members = within(view.getByTestId('qandeel-shared-members'));
    expect(members.getByText(COPY.you)).toBeTruthy();
    expect(members.getByText('Bassem Fixture')).toBeTruthy();
    // No setup, no fake conversation, no composer.
    expect(view.queryByRole('text', { name: /XXXX/u })).toBeNull();
    expect(view.queryByTestId('qandeel-composer')).toBeNull();
    h.dispose();
  });
});

describe('S4-01 Journey B — invite without enumeration; decline creates nothing', () => {
  it('confirms an invitation without naming anyone, and says so for a malformed ID', async () => {
    const s = baseServer();
    const { h, view } = await world(s);
    await press(view, 'qandeel-switcher-shared_world');
    await press(view, 'qandeel-shared-create');
    await fireEvent.changeText(view.getByTestId('qandeel-shared-invite-input'), 'k7qm 4xwd p9tr');
    await press(view, 'qandeel-shared-invite-send');
    expect(within(view.getByTestId('qandeel-shared-invite-message')).getByText(COPY.invitationSent)).toBeTruthy();
    const sent = sharedCalls(h, '/shared/invitations');
    expect(Object.keys(JSON.parse(sent[0].body ?? '{}')).sort()).toEqual(['commandId', 'sharedId']);
    s.invite = { outcome: 'INVALID_SHARED_ID' };
    await fireEvent.changeText(view.getByTestId('qandeel-shared-invite-input'), '12');
    await press(view, 'qandeel-shared-invite-send');
    expect(within(view.getByTestId('qandeel-shared-invite-message')).getByText(COPY.invalidSharedId)).toBeTruthy();
    h.dispose();
  });

  it('declines with no World and no entry', async () => {
    const s = baseServer();
    s.root = { capabilities: { invitation: true, birth: true }, worlds: [], invitations: [{ invitationId: INVITATION, inviterName: null }], closedWorlds: [], memberRequests: [] };
    const { h, view } = await world(s);
    await press(view, 'qandeel-switcher-shared_world');
    expect(view.getByText(fill(COPY.invitation, COPY.someone))).toBeTruthy();
    s.root = { ...s.root, invitations: [] };
    await press(view, 'qandeel-shared-decline');
    expect(within(view.getByTestId('qandeel-shared-notice')).getByText(COPY.declined)).toBeTruthy();
    expect(view.getByTestId('qandeel-shared-no-worlds')).toBeTruthy();
    expect(sharedCalls(h, '/shared/worlds/')).toHaveLength(0);
    h.dispose();
  });

  it('shows no invite action while Shared is not open, and says so calmly', async () => {
    const s = baseServer();
    s.root = { capabilities: { invitation: false, birth: false }, worlds: [], invitations: [], closedWorlds: [], memberRequests: [] };
    const { h, view } = await world(s);
    await press(view, 'qandeel-switcher-shared_world');
    expect(view.queryByTestId('qandeel-shared-create')).toBeNull();
    expect(view.getByTestId('qandeel-shared-not-open')).toBeTruthy();
    h.dispose();
  });
});
