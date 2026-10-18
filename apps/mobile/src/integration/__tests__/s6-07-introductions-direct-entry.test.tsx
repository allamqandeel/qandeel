/**
 * S6-07 (CP3) — Introductions Activity Direct Entry and the per-Introduction mute, on the PRODUCTION phase surface over
 * a runtime the harness genuinely built (store, bootstrap, composition, Activity / Push / Shared / Introductions
 * controllers are real; the network is the harness's HTTP double answering as the API does; the notification system is a
 * deterministic test port). Every Name is synthetic test text.
 *
 *   A — a notification tap on an Introductions item: Activity's ONE revalidated `open`; an Introduction World opens on its
 *       own surface for exactly that World, which reads it again; a World that is no longer the reader's shows the
 *       neutral unavailable state and nothing of any World; a delivered proposal opens the proposals space, which reads
 *       the reader's proposals again; UNAVAILABLE or another account's item opens nothing in their place.
 *   B — per-Introduction mutes in Notifications & Activity: Introduction A muted, B untouched, unmuting restores; the
 *       Introduction itself is never read or changed by it; the rows reuse approved words only.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { PREFERENCES } from '../../activity/__fixtures__/activity';
import { notificationsCopy } from '../../activity/copy';
import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { introductionTitle, introductionWorldCopy } from '../../introductions';
import { createEphemeralPushDeviceStore, createInertPushPlatformPort, type NotificationTap, type PushPlatformPort } from '../../push';
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
const NOTIFY_WORDS = notificationsCopy(LANGUAGE);
const WORLD_A = '33333333-3333-4333-8333-333333333333';
const WORLD_B = '55555555-5555-4555-8555-555555555555';
const WORLD_GONE = '77777777-7777-4777-8777-777777777777';
const PROPOSAL = '66666666-6666-4666-8666-666666666666';
const ITEM_WORLD = '00000000-0000-4000-8000-0000000000a1';
const ITEM_GONE_WORLD = '00000000-0000-4000-8000-0000000000a2';
const ITEM_PROPOSAL = '00000000-0000-4000-8000-0000000000a3';
const ITEM_UNAVAILABLE = '00000000-0000-4000-8000-0000000000c3';
const ITEM_FOREIGN = '00000000-0000-4000-8000-0000000000b2';

const enter = (target: Record<string, string>) => ({ status: 200, body: { outcome: 'ENTER', destination: { kind: 'INTRODUCTIONS', target } } });

function serve(h: IntegrationHarness, muted: Record<string, boolean>) {
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody([exchange('fixture: earlier words', { key: 'fixture-earlier' })]) } : { status: 500, body: {} }));
  h.http.on('/activity/attention', () => ({ status: 200, body: { present: false, categories: { QANDEEL: { present: false }, SHARED: { present: false, count: null }, PUBLIC: { present: false }, INTRODUCTIONS: { present: false }, SYSTEM: { present: false, count: null } }, interruptions: [] } }));
  h.http.on('/activity/items', () => ({ status: 200, body: { items: [], before: null } }));
  h.http.on('/activity/preferences', () => ({ status: 200, body: { ...PREFERENCES, introductions: { available: true, alerts: true } } }));
  // Activity's ONE revalidated open (D38): the API answers ENTER only after the Introductions domain's own read NOW.
  h.http.on('/open', (request) => {
    if (request.url.includes(ITEM_FOREIGN)) return { status: 404, body: {} };
    if (request.url.includes(ITEM_UNAVAILABLE)) return { status: 200, body: { outcome: 'UNAVAILABLE', fallback: null } };
    if (request.url.includes(ITEM_PROPOSAL)) return enter({ kind: 'PROPOSAL', proposalId: PROPOSAL });
    if (request.url.includes(ITEM_GONE_WORLD)) return enter({ kind: 'WORLD', worldId: WORLD_GONE });
    return enter({ kind: 'WORLD', worldId: WORLD_A });
  });
  h.http.on('/push/device', () => ({ status: 200, body: { outcome: 'REGISTERED' } }));
  h.http.on('/push/opened', () => ({ status: 200, body: { outcome: 'RECORDED' } }));
  h.http.on('/shared', () => ({ status: 200, body: { capabilities: { invitation: true, birth: true }, invitations: [], closedWorlds: [], memberRequests: [], worlds: [] } }));
  h.http.on('/introductions/worlds', () => ({ status: 200, body: { worlds: [
    { worldId: WORLD_A, proposalId: PROPOSAL, state: 'ACTIVE', otherFirstName: 'Omar Fixture' },
    { worldId: WORLD_B, proposalId: '88888888-8888-4888-8888-888888888888', state: 'ENDED', otherFirstName: null },
  ] } }));
  h.http.on('/messages', (request) => (request.url.includes(WORLD_GONE)
    ? { status: 200, body: { outcome: 'UNAVAILABLE' } }
    : { status: 200, body: { outcome: 'ACTIVE', messages: [], hasOlder: false } }));
  h.http.on('/introductions/proposals', () => ({ status: 200, body: { proposals: [], next: null } }));
  h.http.on('/alerts', (request) => {
    if (!request.url.includes('/introductions/')) return { status: 200, body: { worlds: [] } };
    if (request.method !== 'PUT') {
      return { status: 200, body: { worlds: [
        { worldId: WORLD_A, state: 'ACTIVE', otherFirstName: 'Omar Fixture', muted: muted[WORLD_A] === true },
        { worldId: WORLD_B, state: 'ENDED', otherFirstName: null, muted: muted[WORLD_B] === true },
      ] } };
    }
    const worldId = request.url.includes(WORLD_B) ? WORLD_B : WORLD_A;
    const { muted: next } = JSON.parse(request.body ?? '{}') as { muted: boolean };
    muted[worldId] = next;
    return { status: 200, body: { outcome: next ? 'MUTED' : 'UNMUTED' } };
  });
}

function testPort() {
  let tapListener: ((tap: NotificationTap) => void) | null = null;
  const port: PushPlatformPort = {
    ...createInertPushPlatformPort('ANDROID'),
    readPermission: async () => ({ permission: 'GRANTED', canAskAgain: false }),
    onTap: (listener) => { tapListener = listener; return () => { tapListener = null; }; },
  };
  return { port, tap: (itemId: string) => tapListener?.({ itemId }) };
}

async function world() {
  const muted: Record<string, boolean> = {};
  const t = testPort();
  const h = await harness({ initialSession: { userId: 'amal', accessToken: 'token-a' }, foreground: 'ACTIVE', pushPlatform: t.port, pushDeviceStore: createEphemeralPushDeviceStore() });
  serve(h, muted);
  const view = await render(<SafeAreaProvider initialMetrics={METRICS}><RuntimePhaseSurface runtime={h.runtime} /></SafeAreaProvider>);
  await act(async () => { await settle(); });
  return { h, view, muted, t };
}
async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => { await settle(); });
}
const deliver = async (fire: () => void) => act(async () => { fire(); await settle(); });
const introductionReads = (h: IntegrationHarness) => h.http.calls.filter((c) => c.url.includes('/introductions/worlds/') && !c.url.endsWith('/alerts'));

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('S6-07 A — Direct Entry into the exact Introductions context', () => {
  it('an Introduction World item: Activity revalidates, the World opens on its own surface for exactly that World, which reads it again', async () => {
    const { h, view, t } = await world();
    const storeBefore = h.ready().store.getState();
    await deliver(() => t.tap(ITEM_WORLD));
    expect(h.http.calls.filter((c) => c.url.endsWith(`/activity/items/${ITEM_WORLD}/open`))).toHaveLength(1);
    expect(view.getByTestId('qandeel-introduction-world')).toBeTruthy();
    expect(view.getByTestId('qandeel-introduction-active')).toBeTruthy();
    const reads = introductionReads(h);
    expect(reads.length).toBeGreaterThanOrEqual(1);
    expect(reads.every((c) => c.url.includes(`/introductions/worlds/${WORLD_A}/`))).toBe(true);
    // The Personal world is untouched and still mounted beneath; every read carries this reader's bearer.
    expect(h.ready().store.getState()).toBe(storeBefore);
    for (const call of h.http.calls.filter((c) => c.url.includes('/introductions') || c.url.includes('/activity'))) expect(call.authorization).toBe('Bearer token-a');
    h.dispose();
  });

  it('a World that is no longer the reader\'s: the neutral unavailable state, nothing of any World, no substitute', async () => {
    const { h, view, t } = await world();
    await deliver(() => t.tap(ITEM_GONE_WORLD));
    expect(view.getByTestId('qandeel-introduction-unavailable')).toBeTruthy();
    expect(view.queryByTestId('qandeel-introduction-active')).toBeNull();
    expect(view.queryByText(/Omar Fixture/u)).toBeNull();
    expect(introductionReads(h).every((c) => c.url.includes(WORLD_GONE))).toBe(true);
    h.dispose();
  });

  it('a delivered proposal item opens the proposals space, which reads the reader\'s proposals again', async () => {
    const { h, view, t } = await world();
    await deliver(() => t.tap(ITEM_PROPOSAL));
    expect(view.getByTestId('qandeel-proposals')).toBeTruthy();
    expect(h.http.calls.filter((c) => c.url.includes('/introductions/proposals')).length).toBeGreaterThanOrEqual(1);
    expect(view.queryByTestId('qandeel-introduction-world')).toBeNull();
    h.dispose();
  });

  it('UNAVAILABLE fails closed in Activity; another account\'s item opens nothing at all', async () => {
    const first = await world();
    await deliver(() => first.t.tap(ITEM_UNAVAILABLE));
    expect(first.view.queryByTestId('qandeel-introduction-world')).toBeNull();
    expect(first.view.queryByTestId('qandeel-proposals')).toBeNull();
    expect(first.view.getByTestId('qandeel-activity')).toBeTruthy();
    expect(introductionReads(first.h)).toHaveLength(0);
    first.h.dispose();
    cleanup();

    const second = await world();
    await deliver(() => second.t.tap(ITEM_FOREIGN));
    expect(second.view.queryByTestId('qandeel-introduction-world')).toBeNull();
    expect(second.view.queryByTestId('qandeel-proposals')).toBeNull();
    expect(second.view.queryByTestId('qandeel-activity')).toBeNull();
    expect(introductionReads(second.h)).toHaveLength(0);
    second.h.dispose();
  });
});

describe('S6-07 B — per-Introduction mutes in Notifications & Activity', () => {
  it('mutes Introduction A only; B is untouched; unmuting restores; the Introductions themselves are never read', async () => {
    const { h, view, muted } = await world();
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-settings-notifications');
    const rowA = `qandeel-notifications-introduction-world-${WORLD_A}`;
    const rowB = `qandeel-notifications-introduction-world-${WORLD_B}`;
    expect(view.getByTestId('qandeel-notifications-introductions')).toBeTruthy();
    const titles = introductionWorldCopy(LANGUAGE);
    expect(view.getByTestId(rowA).props.accessibilityLabel).toBe(introductionTitle(titles, 'Omar Fixture'));
    expect(view.getByTestId(rowB).props.accessibilityLabel).toBe(titles.titleNoName);
    expect(view.getByTestId(`${rowA}-state`).props.children).toBe(NOTIFY_WORDS.on);

    await press(view, rowA);
    expect(h.http.calls.filter((c) => c.method === 'PUT' && c.url.endsWith(`/introductions/worlds/${WORLD_A}/alerts`)).map((c) => JSON.parse(c.body ?? '{}'))).toEqual([{ muted: true }]);
    expect(muted).toEqual({ [WORLD_A]: true });
    expect(view.getByTestId(`${rowA}-state`).props.children).toBe(NOTIFY_WORDS.mutedWorld);
    expect(view.getByTestId(`${rowB}-state`).props.children).toBe(NOTIFY_WORDS.on);

    await press(view, rowA);
    expect(muted).toEqual({ [WORLD_A]: false });
    expect(view.getByTestId(`${rowA}-state`).props.children).toBe(NOTIFY_WORDS.on);
    // Muting is presentation only: no Introduction message, history, END or share call was made.
    expect(introductionReads(h)).toHaveLength(0);
    h.dispose();
  });
});
