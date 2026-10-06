/**
 * S4-04 — Shared Activity, Notifications & Direct Entry on the PRODUCTION phase surface, over a runtime the harness
 * genuinely built: the store, the bootstrap, the Conversation, the composition, the Activity / Push / Shared controllers
 * are real; the network is the harness's HTTP double answering as the API does; the notification system and the link
 * source are deterministic test ports (no APNs / FCM hardware). Every Name is synthetic test text.
 *
 *   B — Direct Entry: a notification tap (Activity's ONE `open`) and a QANDEEL link open the EXACT Shared World through the
 *       Shared entry authority — the neutral shell until ALLOW, then the World; a refused / stale / foreign target shows
 *       nothing of any World; the Personal world is untouched; Back follows the Shared local law.
 *   C — per-World mutes in Notifications & Activity: World A muted, World B untouched, unmute restores; the World itself
 *       is never read or changed by it.
 *   D — permission education: nothing at launch; the first legitimate Shared entry (ALLOW) offers the existing education
 *       with the approved words; "Not now" keeps the World open and is remembered; Allow hands to the OS prompt.
 */
import { act, cleanup, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { PREFERENCES } from '../../activity/__fixtures__/activity';
import { notificationsCopy } from '../../activity/copy';
import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import {
  createEphemeralPushDeviceStore, createInertPushPlatformPort, pushCopy, type NotificationTap, type OsPermissionState, type PushDeviceStore,
  type PushPlatformPort,
} from '../../push';
import type { SharedLinkSource } from '../../shared-world';
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
const PUSH_WORDS = pushCopy(LANGUAGE);
const NOTIFY_WORDS = notificationsCopy(LANGUAGE);
const WORLD_A = '33333333-3333-4333-8333-333333333333';
const WORLD_B = '55555555-5555-4555-8555-555555555555';
const ITEM_A = '00000000-0000-4000-8000-0000000000a1';
const ITEM_STALE = '00000000-0000-4000-8000-0000000000c3';
const ITEM_FOREIGN = '00000000-0000-4000-8000-0000000000b2';
const ITEM_LOST = '00000000-0000-4000-8000-0000000000d4';
const MEMBERS_A = [{ name: 'Amal Fixture', self: true }, { name: 'Bassem Fixture', self: false }];
const MEMBERS_B = [{ name: 'Amal Fixture', self: true }, { name: 'Dina Fixture', self: false }];

interface Server {
  entry: (worldId: string) => Promise<{ status: number; body: unknown }> | { status: number; body: unknown };
  muted: Record<string, boolean>;
}
const allow = (worldId: string) => ({
  status: 200, body: { outcome: 'ALLOW', world: { worldId, bornAt: '2026-10-05T00:00:00Z', name: null, members: worldId === WORLD_A ? MEMBERS_A : MEMBERS_B } },
});

function serve(h: IntegrationHarness, s: Server) {
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody([exchange('fixture: earlier words', { key: 'fixture-earlier' })]) } : { status: 500, body: {} }));
  h.http.on('/activity/attention', () => ({ status: 200, body: { present: false, categories: { QANDEEL: { present: false }, SHARED: { present: false, count: null }, PUBLIC: { present: false }, INTRODUCTIONS: { present: false }, SYSTEM: { present: false, count: null } }, interruptions: [] } }));
  h.http.on('/activity/items', () => ({ status: 200, body: { items: [], before: null } }));
  h.http.on('/activity/preferences', () => ({ status: 200, body: PREFERENCES }));
  // Activity's ONE revalidated open (D38): the API answers ENTER only for a CURRENT entry verdict of the exact World.
  h.http.on('/open', (request) => {
    if (request.url.includes(ITEM_FOREIGN)) return { status: 404, body: {} };
    if (request.url.includes(ITEM_STALE)) return { status: 200, body: { outcome: 'UNAVAILABLE', fallback: null } };
    return { status: 200, body: { outcome: 'ENTER', destination: { kind: 'SHARED_WORLD', worldId: WORLD_A } } };
  });
  h.http.on('/push/device', () => ({ status: 200, body: { outcome: 'REGISTERED' } }));
  h.http.on('/push/opened', () => ({ status: 200, body: { outcome: 'RECORDED' } }));
  h.http.on('/shared', () => ({ status: 200, body: {
    capabilities: { invitation: true, birth: true }, invitations: [], closedWorlds: [], memberRequests: [],
    worlds: [{ worldId: WORLD_A, name: null, members: MEMBERS_A }, { worldId: WORLD_B, name: null, members: MEMBERS_B }],
  } }));
  h.http.on('/shared/worlds/', (request) => s.entry(request.url.includes(WORLD_B) ? WORLD_B : WORLD_A));
  h.http.on('/materials', () => ({ status: 200, body: { outcome: 'ALLOW', conversation: true, materials: [], hasOlder: false } }));
  const list = () => ({ status: 200, body: { worlds: [
    { worldId: WORLD_A, name: null, members: MEMBERS_A, muted: s.muted[WORLD_A] === true },
    { worldId: WORLD_B, name: null, members: MEMBERS_B, muted: s.muted[WORLD_B] === true },
  ] } });
  // The double routes by the LAST fragment in the URL, so '/alerts' answers both the list (GET) and the act (PUT).
  h.http.on('/alerts', (request) => {
    if (request.method !== 'PUT') return list();
    const worldId = request.url.includes(WORLD_B) ? WORLD_B : WORLD_A;
    const { muted } = JSON.parse(request.body ?? '{}') as { muted: boolean };
    s.muted[worldId] = muted;
    return { status: 200, body: { outcome: muted ? 'MUTED' : 'UNMUTED' } };
  });
}

function testPort(initial: OsPermissionState) {
  let permission = initial;
  let tapListener: ((tap: NotificationTap) => void) | null = null;
  const requests: number[] = [];
  const port: PushPlatformPort = {
    ...createInertPushPlatformPort('ANDROID'),
    readPermission: async () => permission,
    requestPermission: async () => { requests.push(1); permission = { permission: 'GRANTED', canAskAgain: false }; return permission; },
    onTap: (listener) => { tapListener = listener; return () => { tapListener = null; }; },
  };
  return { port, requests, tap: (itemId: string) => tapListener?.({ itemId }) };
}

function testLinks(launch: string | null = null) {
  let listener: ((url: string) => void) | null = null;
  const source: SharedLinkSource = { initial: async () => launch, subscribe: (l) => { listener = l; return () => { listener = null; }; } };
  return { source, open: (url: string) => listener?.(url) };
}

async function world(options: { port?: PushPlatformPort; store?: PushDeviceStore; links?: SharedLinkSource; server?: Partial<Server>; session?: { userId: string; accessToken: string } | null } = {}) {
  const s: Server = { entry: allow, muted: {}, ...options.server };
  const h = await harness({
    initialSession: options.session === undefined ? { userId: 'amal', accessToken: 'token-a' } : options.session,
    foreground: 'ACTIVE',
    pushPlatform: options.port ?? testPort({ permission: 'GRANTED', canAskAgain: false }).port,
    pushDeviceStore: options.store ?? createEphemeralPushDeviceStore(),
    sharedLinks: options.links,
  });
  serve(h, s);
  const view = await render(<SafeAreaProvider initialMetrics={METRICS}><RuntimePhaseSurface runtime={h.runtime} /></SafeAreaProvider>);
  await act(async () => { await settle(); });
  return { h, view, s };
}

async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => { await settle(); });
}
const deliver = async (fire: () => void) => act(async () => { fire(); await settle(); });
const entries = (h: IntegrationHarness, worldId: string) => h.http.calls.filter((c) => c.url.endsWith(`/shared/worlds/${worldId}`));
const sharedReads = (h: IntegrationHarness) => h.http.calls.filter((c) => c.url.includes('/shared/worlds/'));

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('S4-04 B — Direct Entry into the exact Shared World', () => {
  it('a notification tap: Activity revalidates, the Shared area opens the exact World through its entry authority — the neutral shell until ALLOW, then the World', async () => {
    let release: (() => void) | null = null;
    const t = testPort({ permission: 'GRANTED', canAskAgain: false });
    const { h, view } = await world({
      port: t.port,
      server: { entry: (worldId) => new Promise((resolve) => { release = () => resolve(allow(worldId)); }) },
    });
    const runtime = h.ready();
    const storeBefore = runtime.store.getState();
    expect(view.queryByTestId('qandeel-shared-area')).toBeNull();

    await deliver(() => t.tap(ITEM_A));
    expect(h.http.calls.filter((c) => c.url.endsWith(`/activity/items/${ITEM_A}/open`))).toHaveLength(1);
    // Not trusted: the World is resolved again by the Shared entry authority, for exactly that World.
    expect(entries(h, WORLD_A).length).toBeGreaterThanOrEqual(1);
    expect(entries(h, WORLD_B)).toHaveLength(0);
    expect(view.getByTestId('qandeel-shared-transition')).toBeTruthy();
    expect(view.queryByText('Bassem Fixture')).toBeNull();
    expect(view.queryByTestId('qandeel-shared-welcome')).toBeNull();

    await act(async () => { release?.(); await settle(); });
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    expect(within(view.getByTestId('qandeel-shared-world')).getAllByText(/Bassem Fixture/u).length).toBeGreaterThan(0);
    // The Personal world is untouched and still mounted beneath.
    expect(runtime.store.getState()).toBe(storeBefore);
    expect(view.getByTestId('qandeel-conversation', { includeHiddenElements: true })).toBeTruthy();
    for (const call of h.http.calls.filter((c) => c.url.includes('/shared') || c.url.includes('/activity'))) expect(call.authorization).toBe('Bearer token-a');
    h.dispose();
  });

  it('Back from a Direct Entry World is the Shared local law (World → Shared root); no notification history is manufactured', async () => {
    type Handler = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers: { handler: Handler; removed: boolean }[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      const entry = { handler, removed: false };
      handlers.push(entry);
      return { remove: () => { entry.removed = true; } };
    });
    const t = testPort({ permission: 'GRANTED', canAskAgain: false });
    const { h, view } = await world({ port: t.port });
    await deliver(() => t.tap(ITEM_A));
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    const live = handlers.filter((x) => !x.removed);
    await act(async () => { live[live.length - 1].handler({ type: 'hardwareBackPress', timeStamp: 0 } as never); await settle(); });
    expect(view.getByTestId('qandeel-shared-root')).toBeTruthy();
    expect(view.queryByTestId('qandeel-activity')).toBeNull();
    h.dispose();
  });

  it('a removed / left member: the World refuses at entry — one neutral state, nothing of the World', async () => {
    const t = testPort({ permission: 'GRANTED', canAskAgain: false });
    const { h, view } = await world({ port: t.port, server: { entry: () => ({ status: 200, body: { outcome: 'UNAVAILABLE' } }) } });
    await deliver(() => t.tap(ITEM_LOST));
    expect(view.getByTestId('qandeel-shared-world-unavailable')).toBeTruthy();
    expect(view.queryByText('Bassem Fixture')).toBeNull();
    expect(view.queryByTestId('qandeel-shared-members')).toBeNull();
    expect(h.http.calls.filter((c) => c.url.includes('/materials'))).toHaveLength(0);
    h.dispose();
  });

  it('a stale target fails closed in Activity: no World, no Shared read at all', async () => {
    const t = testPort({ permission: 'GRANTED', canAskAgain: false });
    const { h, view } = await world({ port: t.port });
    await deliver(() => t.tap(ITEM_STALE));
    expect(view.queryByTestId('qandeel-shared-area')).toBeNull();
    expect(view.getByTestId('qandeel-activity')).toBeTruthy();
    expect(sharedReads(h)).toHaveLength(0);
    h.dispose();
  });

  it('another account\'s item (wrong account): nowhere — no World, no Activity, no Shared read', async () => {
    const t = testPort({ permission: 'GRANTED', canAskAgain: false });
    const { h, view } = await world({ port: t.port });
    await deliver(() => t.tap(ITEM_FOREIGN));
    expect(view.queryByTestId('qandeel-shared-area')).toBeNull();
    expect(view.queryByTestId('qandeel-activity')).toBeNull();
    expect(sharedReads(h)).toHaveLength(0);
    h.dispose();
  });

  it('a QANDEEL link names one exact World and enters it through the same authority; anything else is ignored; signed out it is dropped', async () => {
    const links = testLinks();
    const { h, view } = await world({ links: links.source });
    for (const url of ['qandeel://shared/world/not-a-world', `qandeel://shared/world/${WORLD_A}?x=1`, `https://example.invalid/shared/world/${WORLD_A}`, `qandeel://shared/worlds/${WORLD_A}`]) {
      await deliver(() => links.open(url));
    }
    expect(view.queryByTestId('qandeel-shared-area')).toBeNull();
    expect(sharedReads(h)).toHaveLength(0);
    await deliver(() => links.open(`qandeel://shared/world/${WORLD_B}`));
    expect(entries(h, WORLD_B).length).toBeGreaterThanOrEqual(1);
    expect(entries(h, WORLD_A)).toHaveLength(0);
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    expect(within(view.getByTestId('qandeel-shared-world')).getAllByText(/Dina Fixture/u).length).toBeGreaterThan(0);
    h.dispose();

    const signedOut = testLinks(`qandeel://shared/world/${WORLD_A}`);
    const out = await world({ links: signedOut.source, session: null });
    expect(out.h.phase().kind).toBe('SIGNED_OUT');
    expect(sharedReads(out.h)).toHaveLength(0);
    out.h.dispose();
  });

  it('a link that launched the app waits for the reader\'s world, then is taken once', async () => {
    const links = testLinks(`qandeel://shared/world/${WORLD_A}`);
    const { h, view } = await world({ links: links.source });
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    expect(h.ready().sharedLinks.take()).toBeNull();
    h.dispose();
  });
});

describe('S4-04 C — per-World mutes in Notifications & Activity', () => {
  it('mutes World A only; World B is untouched; unmuting restores; the Worlds themselves are never read', async () => {
    const { h, view, s } = await world();
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-settings-notifications');
    const rowA = `qandeel-notifications-shared-world-${WORLD_A}`;
    const rowB = `qandeel-notifications-shared-world-${WORLD_B}`;
    expect(view.getByTestId('qandeel-notifications-shared')).toBeTruthy();
    expect(view.getByTestId(`${rowA}-state`).props.children).toBe(NOTIFY_WORDS.on);
    expect(view.getByTestId(`${rowB}-state`).props.children).toBe(NOTIFY_WORDS.on);
    expect(view.getByTestId(rowA).props.accessibilityLabel).toBe('Bassem Fixture');

    await press(view, rowA);
    expect(h.http.calls.filter((c) => c.method === 'PUT' && c.url.endsWith(`/shared/worlds/${WORLD_A}/alerts`)).map((c) => JSON.parse(c.body ?? '{}'))).toEqual([{ muted: true }]);
    expect(s.muted).toEqual({ [WORLD_A]: true });
    expect(view.getByTestId(`${rowA}-state`).props.children).toBe(NOTIFY_WORDS.mutedWorld);
    expect(view.getByTestId(rowA).props.accessibilityState.checked).toBe(false);
    expect(view.getByTestId(`${rowB}-state`).props.children).toBe(NOTIFY_WORDS.on);

    await press(view, rowA);
    expect(s.muted).toEqual({ [WORLD_A]: false });
    expect(view.getByTestId(`${rowA}-state`).props.children).toBe(NOTIFY_WORDS.on);
    // Muting is presentation only: no World entry, material, membership or conversation call was made.
    expect(sharedReads(h).filter((c) => !c.url.endsWith('/alerts'))).toHaveLength(0);
    expect(h.http.calls.filter((c) => c.url.includes('/messages') || c.url.includes('/leave') || c.url.includes('/proposals'))).toHaveLength(0);
    h.dispose();
  });
});

describe('S4-04 D — permission education at the first legitimate Shared entry', () => {
  it('nothing at launch or at the Shared root; the first ALLOW offers the approved education; Not now keeps the World and is remembered', async () => {
    const t = testPort({ permission: 'NOT_REQUESTED', canAskAgain: true });
    const store = createEphemeralPushDeviceStore();
    const { h, view } = await world({ port: t.port, store });
    expect(view.queryByTestId('qandeel-push-education')).toBeNull();
    await press(view, 'qandeel-switcher-shared_world');
    expect(view.getByTestId('qandeel-shared-root')).toBeTruthy();
    expect(view.queryByTestId('qandeel-push-education')).toBeNull();

    await press(view, `qandeel-shared-world-${WORLD_A}`);
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    const sheet = within(view.getByTestId('qandeel-push-education'));
    expect(sheet.getByText(PUSH_WORDS.eduTitle)).toBeTruthy();
    expect(sheet.getByText(PUSH_WORDS.eduBody)).toBeTruthy();
    expect(t.requests).toHaveLength(0);

    await press(view, 'qandeel-push-education-not-now');
    expect(view.queryByTestId('qandeel-push-education')).toBeNull();
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    expect(t.requests).toHaveLength(0);
    expect(store.educationDeclined()).toBe(true);
    // Back to the root and into another World: no pressure, no repeated automatic ask.
    await press(view, 'qandeel-shared-back');
    await press(view, `qandeel-shared-world-${WORLD_B}`);
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    expect(view.queryByTestId('qandeel-push-education')).toBeNull();
    h.dispose();

    // A new world on the same device: the decline is remembered.
    const again = await world({ port: testPort({ permission: 'NOT_REQUESTED', canAskAgain: true }).port, store });
    await press(again.view, 'qandeel-switcher-shared_world');
    await press(again.view, `qandeel-shared-world-${WORLD_A}`);
    expect(again.view.queryByTestId('qandeel-push-education')).toBeNull();
    again.h.dispose();
  });

  it('a refused entry is not a legitimate moment', async () => {
    const t = testPort({ permission: 'NOT_REQUESTED', canAskAgain: true });
    const { h, view } = await world({ port: t.port, server: { entry: () => ({ status: 200, body: { outcome: 'UNAVAILABLE' } }) } });
    await press(view, 'qandeel-switcher-shared_world');
    await press(view, `qandeel-shared-world-${WORLD_A}`);
    expect(view.getByTestId('qandeel-shared-world-unavailable')).toBeTruthy();
    expect(view.queryByTestId('qandeel-push-education')).toBeNull();
    h.dispose();
  });

  it('Allow hands to the REAL OS prompt — once, and only after the education', async () => {
    const t = testPort({ permission: 'NOT_REQUESTED', canAskAgain: true });
    const { h, view } = await world({ port: t.port });
    await press(view, 'qandeel-switcher-shared_world');
    await press(view, `qandeel-shared-world-${WORLD_A}`);
    expect(t.requests).toHaveLength(0);
    await press(view, 'qandeel-push-education-allow');
    expect(t.requests).toHaveLength(1);
    expect(view.queryByTestId('qandeel-push-education')).toBeNull();
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    expect(h.ready().push.getState().permission).toBe('GRANTED');
    h.dispose();
  });

  it('a Direct Entry into a World is a legitimate Shared entry too; a granted device is never asked', async () => {
    const granted = testPort({ permission: 'GRANTED', canAskAgain: false });
    const { h, view } = await world({ port: granted.port });
    await deliver(() => granted.tap(ITEM_A));
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    expect(view.queryByTestId('qandeel-push-education')).toBeNull();
    expect(granted.requests).toHaveLength(0);
    h.dispose();
  });
});

