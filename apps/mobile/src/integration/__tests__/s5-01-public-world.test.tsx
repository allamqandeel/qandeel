/**
 * S5-01 — Public World Reachability, Entry & Identity on the PRODUCTION phase surface, over a runtime the harness
 * genuinely built: the store, the bootstrap, the Conversation, the composition, the Shared and Public controllers and
 * General Settings are real; the network is the harness's HTTP double answering as the API does; the link source is a
 * deterministic test port. Every Name and handle is synthetic test text.
 *
 *   A — the third destination: the Global Switcher's Public World enters through the real entry verdict — the neutral
 *       shell until ALLOW, then the root (its name, its own ground, nothing else); a refusal is one neutral answer; the
 *       Personal world is untouched; switching to Shared and back re-resolves and reassigns no state.
 *   B — `qandeel://public`: exact, through the SAME entry controller; anything else is ignored; signed out it is dropped.
 *   C — the Public display choice in General Settings → Account & Identity: the current Public ID by default, Name on
 *       choice, a mode and never label text on the wire.
 */
import { act, cleanup, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { PREFERENCES } from '../../activity/__fixtures__/activity';
import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { publicCopy } from '../../public-world';
import { createEphemeralPushDeviceStore } from '../../push';
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
const WORDS = publicCopy(LANGUAGE);
const HANDLE = 'nightlamp27';
const NAME = 'Amal Fixture';

type Answer = { status: number; body: unknown };
interface Server {
  entry: () => Promise<Answer> | Answer;
  mode: 'PSEUDONYM' | 'REAL_NAME';
}
const ALLOW: Answer = { status: 200, body: { outcome: 'ALLOW' } };

function serve(h: IntegrationHarness, s: Server) {
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody([exchange('fixture: earlier words', { key: 'fixture-earlier' })]) } : { status: 500, body: {} }));
  h.http.on('/activity/attention', () => ({ status: 200, body: { present: false, categories: { QANDEEL: { present: false }, SHARED: { present: false, count: null }, PUBLIC: { present: false }, INTRODUCTIONS: { present: false }, SYSTEM: { present: false, count: null } }, interruptions: [] } }));
  h.http.on('/activity/items', () => ({ status: 200, body: { items: [], before: null } }));
  h.http.on('/activity/preferences', () => ({ status: 200, body: PREFERENCES }));
  h.http.on('/shared', () => ({ status: 200, body: { capabilities: { invitation: true, birth: true }, invitations: [], closedWorlds: [], memberRequests: [], worlds: [] } }));
  h.http.on('/account/public-id', () => ({ status: 200, body: { publicId: HANDLE, changeAvailable: true } }));
  h.http.on('/public/entry', () => s.entry());
  h.http.on('/public/display', (request) => {
    if (request.method === 'PUT') {
      const { mode } = JSON.parse(request.body ?? '{}') as { mode: 'PSEUDONYM' | 'REAL_NAME' };
      const outcome = mode === s.mode ? 'UNCHANGED' : 'UPDATED';
      s.mode = mode;
      return { status: 200, body: { outcome, mode, label: mode === 'REAL_NAME' ? NAME : HANDLE } };
    }
    return { status: 200, body: { mode: s.mode, label: s.mode === 'REAL_NAME' ? NAME : HANDLE, realNameAvailable: true } };
  });
}

function testLinks(launch: string | null = null) {
  let listener: ((url: string) => void) | null = null;
  const source: SharedLinkSource = { initial: async () => launch, subscribe: (l) => { listener = l; return () => { listener = null; }; } };
  return { source, open: (url: string) => listener?.(url) };
}

async function world(options: { links?: SharedLinkSource; server?: Partial<Server>; session?: { userId: string; accessToken: string } | null } = {}) {
  const s: Server = { entry: () => ALLOW, mode: 'PSEUDONYM', ...options.server };
  const h = await harness({
    initialSession: options.session === undefined ? { userId: 'amal', accessToken: 'token-a' } : options.session,
    foreground: 'ACTIVE',
    // Navigation is what is proved here: the first-Shared-entry education is declined up front.
    pushDeviceStore: createEphemeralPushDeviceStore({ declined: true }),
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
const entries = (h: IntegrationHarness) => h.http.calls.filter((c) => c.url.endsWith('/public/entry'));
const publicReads = (h: IntegrationHarness) => h.http.calls.filter((c) => c.url.includes('/public/'));

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('S5-01 A — the third Global Area', () => {
  it('Public World enters through the real entry verdict: the neutral shell until ALLOW, then the root and nothing else', async () => {
    let release: (() => void) | null = null;
    const { h, view } = await world({ server: { entry: () => new Promise<Answer>((resolve) => { release = () => resolve(ALLOW); }) } });
    const runtime = h.ready();
    const storeBefore = runtime.store.getState();
    // Nothing of Public is read until the reader goes there.
    expect(publicReads(h)).toHaveLength(0);
    const switcher = within(view.getByTestId('qandeel-global-switcher'));
    expect(switcher.getAllByRole('radio').map((node) => node.props.accessibilityLabel)[2]).toBe(WORDS.publicWorld);
    expect(view.getByTestId('qandeel-global-switcher').props.accessibilityLabel).toBe(WORDS.switcherLabel);

    await press(view, 'qandeel-switcher-public_world');
    expect(entries(h)).toHaveLength(1);
    // Pre-authority: the neutral shell, and no destination detail — not even the Public World's name as a title.
    expect(view.getByTestId('qandeel-public-transition')).toBeTruthy();
    expect(view.queryByTestId('qandeel-public-title')).toBeNull();
    expect(view.queryByTestId('qandeel-public-field')).toBeNull();
    expect(view.getByTestId('qandeel-switcher-public_world').props.accessibilityState).toMatchObject({ selected: true });

    await act(async () => { release?.(); await settle(); });
    expect(view.getByTestId('qandeel-public-root')).toBeTruthy();
    expect(within(view.getByTestId('qandeel-public-root')).getByTestId('qandeel-public-title').props.children).toBe(WORDS.publicWorld);
    // Content-empty by truth: no Experience, feed, list or count stands in for S5-03's field.
    expect(within(view.getByTestId('qandeel-public-field')).queryAllByRole('button')).toHaveLength(0);
    // The Personal world is untouched and still mounted beneath; only the Public routes were asked, on the reader's token.
    expect(runtime.store.getState()).toBe(storeBefore);
    expect(view.getByTestId('qandeel-conversation', { includeHiddenElements: true })).toBeTruthy();
    for (const call of publicReads(h)) expect(call.authorization).toBe('Bearer token-a');
    expect(publicReads(h).every((c) => c.url.endsWith('/public/entry'))).toBe(true);
    h.dispose();
  });

  it('a refusal is one neutral answer with a retry that asks again; nothing of Public World is drawn', async () => {
    const answers: Answer[] = [{ status: 200, body: { outcome: 'UNAVAILABLE' } }, ALLOW];
    const { h, view } = await world({ server: { entry: () => answers.shift() ?? ALLOW } });
    await press(view, 'qandeel-switcher-public_world');
    expect(view.getByTestId('qandeel-public-unavailable')).toBeTruthy();
    expect(within(view.getByTestId('qandeel-public-unavailable')).getByText(WORDS.worldUnavailable)).toBeTruthy();
    expect(view.queryByTestId('qandeel-public-title')).toBeNull();
    await press(view, 'qandeel-public-retry');
    expect(entries(h)).toHaveLength(2);
    expect(view.getByTestId('qandeel-public-root')).toBeTruthy();
    h.dispose();
  });

  it('switching Public → Shared → Public re-resolves each time and reassigns no Personal or Shared state', async () => {
    const { h, view } = await world();
    const runtime = h.ready();
    const storeBefore = runtime.store.getState();
    await press(view, 'qandeel-switcher-public_world');
    expect(view.getByTestId('qandeel-public-root')).toBeTruthy();
    await press(view, 'qandeel-switcher-shared_world');
    expect(view.queryByTestId('qandeel-public-area')).toBeNull();
    expect(view.getByTestId('qandeel-shared-area')).toBeTruthy();
    const sharedPlace = runtime.sharedWorld.getState().place;
    await press(view, 'qandeel-switcher-public_world');
    // A previous ALLOW is never kept as authority: entering again asks again.
    expect(entries(h)).toHaveLength(2);
    expect(view.getByTestId('qandeel-public-root')).toBeTruthy();
    expect(runtime.sharedWorld.getState().place).toEqual(sharedPlace);
    await press(view, 'qandeel-switcher-my_world');
    expect(view.queryByTestId('qandeel-public-area')).toBeNull();
    expect(runtime.store.getState()).toBe(storeBefore);
    h.dispose();
  });
});

describe('S5-01 B — qandeel://public', () => {
  it('the exact root link enters through the same entry controller; anything else is ignored; signed out it is dropped', async () => {
    const links = testLinks();
    const { h, view } = await world({ links: links.source });
    for (const url of ['qandeel://public/', 'qandeel://public?x=1', 'qandeel://public#y', 'qandeel://PUBLIC', 'qandeel://public/experience/1', 'https://example.invalid/public', ' qandeel://public']) {
      await deliver(() => links.open(url));
    }
    expect(view.queryByTestId('qandeel-public-area')).toBeNull();
    expect(publicReads(h)).toHaveLength(0);
    await deliver(() => links.open('qandeel://public'));
    expect(entries(h)).toHaveLength(1);
    expect(view.getByTestId('qandeel-public-root')).toBeTruthy();
    // Already in Public World, a second link asks the SAME controller again — it is never authority by itself.
    await deliver(() => links.open('qandeel://public'));
    expect(entries(h)).toHaveLength(2);
    expect(h.ready().publicLinks.take()).toBe(false);
    h.dispose();

    const signedOut = testLinks('qandeel://public');
    const out = await world({ links: signedOut.source, session: null });
    expect(out.h.phase().kind).toBe('SIGNED_OUT');
    expect(publicReads(out.h)).toHaveLength(0);
    out.h.dispose();
  });

  it('a link that launched the app waits for the reader\'s world, then is taken once', async () => {
    const links = testLinks('qandeel://public');
    const { h, view } = await world({ links: links.source });
    expect(view.getByTestId('qandeel-public-root')).toBeTruthy();
    expect(entries(h)).toHaveLength(1);
    expect(h.ready().publicLinks.take()).toBe(false);
    h.dispose();
  });
});

describe('S5-01 C — the Public display choice in Account & Identity', () => {
  it('shows the current Public ID by default; choosing Name sends a MODE only; the selection is the server answer', async () => {
    const { h, view, s } = await world();
    await press(view, 'qandeel-settings-entry');
    const account = within(view.getByTestId('qandeel-settings-group-account'));
    expect(account.getByTestId('qandeel-public-display-heading').props.children).toBe(WORDS.displayHeading);
    expect(account.getByTestId('qandeel-public-display-pseudonym').props.accessibilityState).toMatchObject({ checked: true });
    expect(account.getByTestId('qandeel-public-display-label').props.children).toContain(`@${HANDLE}`);

    await press(view, 'qandeel-public-display-real_name');
    const puts = h.http.calls.filter((c) => c.url.endsWith('/public/display') && c.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0].body ?? '{}')).toEqual({ mode: 'REAL_NAME' });
    expect(s.mode).toBe('REAL_NAME');
    expect(within(view.getByTestId('qandeel-settings-group-account')).getByTestId('qandeel-public-display-real_name').props.accessibilityState).toMatchObject({ checked: true });
    expect(within(view.getByTestId('qandeel-settings-group-account')).getByTestId('qandeel-public-display-label').props.children).toBe(NAME);
    // No Public Settings page: the choice lives in the ONE General Settings destination.
    expect(view.queryByTestId('qandeel-public-area')).toBeNull();
    h.dispose();
  });
});
