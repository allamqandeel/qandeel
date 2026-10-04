/**
 * A3-02 — native Push on the PRODUCTION phase surface, over a runtime the harness genuinely built. The notification system
 * is a test port (permission answers, taps, the launch tap); the network is the harness's HTTP double answering as the
 * API does. Proves: native Direct Entry through Activity's ONE `open` (valid, stale, foreign, cold start, signed out),
 * per-device open evidence, the education → real OS prompt boundary in Notifications & Activity, "Not now", and the
 * detach that precedes sign-out.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { PREFERENCES } from '../../activity/__fixtures__/activity';
import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { createEphemeralPushDeviceStore, createInertPushPlatformPort, pushCopy, type NotificationTap, type OsPermissionState, type PushPlatformPort } from '../../push';
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
const WORDS = pushCopy(LANGUAGE);
const MINE = '00000000-0000-4000-8000-0000000000a1';
const FOREIGN = '00000000-0000-4000-8000-0000000000b2';
const STALE = '00000000-0000-4000-8000-0000000000c3';
const INSTALLATION = '22222222-2222-4222-8222-222222222222';

function testPort(initial: OsPermissionState, launch: NotificationTap | null = null) {
  let permission = initial;
  let tapListener: ((tap: NotificationTap) => void) | null = null;
  const requests: number[] = [];
  const port: PushPlatformPort = {
    ...createInertPushPlatformPort('ANDROID'),
    readPermission: async () => permission,
    requestPermission: async () => { requests.push(1); permission = { permission: 'GRANTED', canAskAgain: false }; return permission; },
    deviceToken: async () => 'fcm-device-token',
    onTap: (listener) => { tapListener = listener; return () => { tapListener = null; }; },
    takeLaunchTap: async () => launch,
  };
  return { port, requests, tap: (itemId: string) => tapListener?.({ itemId }) };
}

function serve(h: IntegrationHarness) {
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody([exchange('fixture: earlier words', { key: 'fixture-earlier' })]) } : { status: 500, body: {} }));
  h.http.on('/activity/attention', () => ({ status: 200, body: { present: false, categories: { QANDEEL: { present: false }, SHARED: { present: false, count: null }, PUBLIC: { present: false }, INTRODUCTIONS: { present: false }, SYSTEM: { present: false, count: null } }, interruptions: [] } }));
  h.http.on('/activity/items', () => ({ status: 200, body: { items: [], before: null } }));
  h.http.on('/activity/preferences', () => ({ status: 200, body: PREFERENCES }));
  h.http.on('/open', (request) => {
    if (request.url.includes(FOREIGN)) return { status: 404, body: {} };
    if (request.url.includes(STALE)) return { status: 200, body: { outcome: 'STALE', fallback: null } };
    return { status: 200, body: { outcome: 'ENTER', destination: { kind: 'GENERAL_SETTINGS', section: 'SECURITY' } } };
  });
  h.http.on('/push/device', () => ({ status: 200, body: { outcome: 'REGISTERED' } }));
  h.http.on('/push/device/detach', () => ({ status: 200, body: { outcome: 'DETACHED' } }));
  h.http.on('/push/opened', () => ({ status: 200, body: { outcome: 'RECORDED' } }));
}

async function world(port: PushPlatformPort, initialSession: { userId: string; accessToken: string } | null = { userId: 'alice', accessToken: 'token-a' }) {
  const h = await harness({ initialSession, foreground: 'ACTIVE', pushPlatform: port, pushDeviceStore: createEphemeralPushDeviceStore({ installationId: INSTALLATION }) });
  serve(h);
  const view = await render(<SafeAreaProvider initialMetrics={METRICS}><RuntimePhaseSurface runtime={h.runtime} /></SafeAreaProvider>);
  await act(async () => { await settle(); });
  return { h, view };
}

async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => { await settle(); });
}

const deliver = async (fire: () => void) => act(async () => { fire(); await settle(); });
const opens = (h: IntegrationHarness) => h.http.calls.filter((c) => c.url.includes('/activity/items/') && c.url.endsWith('/open'));

describe('A3-02 — native Direct Entry is Activity’s ONE revalidated open (D38–D43)', () => {
  it('a tap opens the revalidated destination, and records per-device evidence for THIS installation only', async () => {
    const t = testPort({ permission: 'GRANTED', canAskAgain: false });
    const { h, view } = await world(t.port);
    expect(view.queryByTestId('qandeel-settings')).toBeNull();
    await deliver(() => t.tap(MINE));
    expect(opens(h).map((c) => c.url)).toEqual([expect.stringContaining(`/activity/items/${MINE}/open`)]);
    expect(view.getByTestId('qandeel-settings')).toBeTruthy();
    const evidence = h.http.matching('/push/opened').map((c) => JSON.parse(c.body ?? '{}'));
    expect(evidence).toEqual([{ installationId: INSTALLATION, itemId: MINE }]);
    for (const call of h.http.calls.filter((c) => c.url.includes('/push') || c.url.includes('/activity'))) expect(call.authorization).toBe('Bearer token-a');
    view.unmount();
    h.dispose();
  });

  it('another account’s item answers nothing and the reader is taken nowhere — no substitute (D39)', async () => {
    const t = testPort({ permission: 'GRANTED', canAskAgain: false });
    const { h, view } = await world(t.port);
    await deliver(() => t.tap(FOREIGN));
    expect(opens(h)).toHaveLength(1);
    expect(view.queryByTestId('qandeel-settings')).toBeNull();
    expect(view.queryByTestId('qandeel-activity')).toBeNull();
    view.unmount();
    h.dispose();
  });

  it('a stale target fails closed into Activity, where the item explains itself — never a guessed destination', async () => {
    const t = testPort({ permission: 'GRANTED', canAskAgain: false });
    const { h, view } = await world(t.port);
    await deliver(() => t.tap(STALE));
    expect(view.queryByTestId('qandeel-settings')).toBeNull();
    expect(view.getByTestId('qandeel-activity')).toBeTruthy();
    view.unmount();
    h.dispose();
  });

  it('the tap that launched the app from a terminated state waits for READY, then is taken once', async () => {
    const t = testPort({ permission: 'GRANTED', canAskAgain: false }, { itemId: MINE });
    const { h, view } = await world(t.port);
    expect(opens(h)).toHaveLength(1);
    expect(view.getByTestId('qandeel-settings')).toBeTruthy();
    expect(h.ready().notificationEntries.peek()).toBeNull();
    view.unmount();
    h.dispose();
  });

  it('signed out, a tap is not held for whoever signs in next', async () => {
    const t = testPort({ permission: 'GRANTED', canAskAgain: false }, { itemId: MINE });
    const { h, view } = await world(t.port, null);
    expect(h.phase().kind).toBe('SIGNED_OUT');
    await deliver(() => t.tap(MINE));
    expect(opens(h)).toHaveLength(0);
    view.unmount();
    h.dispose();
  });
});

describe('A3-02 — the permission boundary in Notifications & Activity (D50, P3 §11, §12.2)', () => {
  async function notificationsPage(view: RenderResult) {
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-settings-notifications');
  }

  it('not yet asked: the page says so once; Allow notifications → education → the REAL OS prompt; granted registers the token', async () => {
    const t = testPort({ permission: 'NOT_REQUESTED', canAskAgain: true });
    const { h, view } = await world(t.port);
    await notificationsPage(view);
    expect(view.getByTestId('qandeel-notifications-os-off').props.children).toBe(WORDS.osOff);
    expect(t.requests).toHaveLength(0);
    await press(view, 'qandeel-notifications-allow');
    expect(view.getByTestId('qandeel-push-education')).toBeTruthy();
    expect(view.getByText(WORDS.eduTitle)).toBeTruthy();
    expect(t.requests).toHaveLength(0);
    await press(view, 'qandeel-push-education-allow');
    expect(t.requests).toHaveLength(1);
    expect(view.queryByTestId('qandeel-push-education')).toBeNull();
    expect(view.queryByTestId('qandeel-notifications-os-off')).toBeNull();
    const syncs = h.http.matching('/push/device').filter((c) => c.method === 'PUT').map((c) => JSON.parse(c.body ?? '{}'));
    expect(syncs.at(-1)).toMatchObject({ osPermission: 'GRANTED', pushToken: 'fcm-device-token', installationId: INSTALLATION });
    expect(syncs[0]).toMatchObject({ osPermission: 'NOT_REQUESTED', pushToken: null });
    view.unmount();
    h.dispose();
  });

  it('"Not now": no prompt, the note once, and choosing Allow for Proactive QANDEEL does not ask again', async () => {
    const t = testPort({ permission: 'NOT_REQUESTED', canAskAgain: true });
    const { h, view } = await world(t.port);
    await notificationsPage(view);
    await press(view, 'qandeel-proactive-allow');
    expect(view.getByTestId('qandeel-push-education')).toBeTruthy();
    await press(view, 'qandeel-push-education-not-now');
    expect(view.queryByTestId('qandeel-push-education')).toBeNull();
    expect(view.getByTestId('qandeel-push-not-now-note').props.children).toBe(WORDS.notNowNote);
    await press(view, 'qandeel-proactive-allow');
    expect(view.queryByTestId('qandeel-push-education')).toBeNull();
    expect(t.requests).toHaveLength(0);
    view.unmount();
    h.dispose();
  });

  it('nothing asks at launch', async () => {
    const t = testPort({ permission: 'NOT_REQUESTED', canAskAgain: true });
    const { h, view } = await world(t.port);
    expect(view.queryByTestId('qandeel-push-education')).toBeNull();
    expect(t.requests).toHaveLength(0);
    view.unmount();
    h.dispose();
  });
});

describe('A3-02 — sign-out detaches this installation first', () => {
  it('the detach is sent with the reader’s own token before the session ends', async () => {
    const t = testPort({ permission: 'GRANTED', canAskAgain: false });
    const { h, view } = await world(t.port);
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-settings-sign-out');
    const detach = h.http.matching('/push/device/detach');
    expect(detach.map((c) => JSON.parse(c.body ?? '{}'))).toEqual([{ installationId: INSTALLATION }]);
    expect(detach[0].authorization).toBe('Bearer token-a');
    expect(h.phase().kind).toBe('SIGNED_OUT');
    view.unmount();
    h.dispose();
  });
});
