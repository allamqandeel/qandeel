/**
 * A3-01 — «النشاط» / Activity and in-app attention on the PRODUCTION phase surface, over a runtime the harness genuinely
 * built: the store, the bootstrap, the Conversation, the depth pair, the composition and the Activity controllers are
 * real; the network is the harness's HTTP double answering as the API does. Every event sentence is synthetic test text.
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { BackHandler, StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { activityCopy, notificationsCopy } from '../../activity';
import { PREFERENCES, item } from '../../activity/__fixtures__/activity';
import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import type { ActivityItem } from '../../runtime-entry';
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
const COPY = activityCopy(LANGUAGE);
const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

/** What the API would answer: the attention summary, and the feed page. */
function serve(h: IntegrationHarness, state: { interruptions: { item: ActivityItem; interruptionClass: number; contextKind: string; callSafe: boolean }[]; present: boolean; feed: ActivityItem[] }) {
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody([exchange('fixture: earlier words', { key: 'fixture-earlier' })]) } : { status: 500, body: {} }));
  h.http.on('/activity/attention', () => ({
    status: 200,
    body: {
      present: state.present,
      categories: { QANDEEL: { present: false }, SHARED: { present: false, count: null }, PUBLIC: { present: false }, INTRODUCTIONS: { present: false }, SYSTEM: { present: state.present, count: null } },
      interruptions: state.interruptions,
    },
  }));
  h.http.on('/activity/items', () => ({ status: 200, body: { items: state.feed, before: null } }));
  h.http.on('/activity/strip', () => ({ status: 204, body: {} }));
  h.http.on('/activity/items/seen', () => ({ status: 204, body: {} }));
  h.http.on('/activity/preferences', () => ({ status: 200, body: PREFERENCES }));
  h.http.on('/open', () => ({ status: 200, body: { outcome: 'ENTER', destination: { kind: 'GENERAL_SETTINGS', section: 'SECURITY' } } }));
}

async function world(state: Parameters<typeof serve>[1]): Promise<{ h: IntegrationHarness; view: RenderResult }> {
  const h = await harness({ initialSession: { userId: 'alice', accessToken: 'token-a' }, foreground: 'ACTIVE' });
  serve(h, state);
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

const refresh = async (h: IntegrationHarness) => {
  await act(async () => {
    h.ready().attention.refresh();
    await settle();
  });
};

function systemBack() {
  type Handler = Parameters<typeof BackHandler.addEventListener>[1];
  const handlers: { handler: Handler; removed: boolean }[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    const entry = { handler, removed: false };
    handlers.push(entry);
    return { remove: () => { entry.removed = true; } };
  });
  return async () => {
    await act(async () => {
      for (const entry of [...handlers].reverse()) if (!entry.removed && entry.handler({} as never) === true) break;
      await settle();
    });
  };
}

const candidate = (overrides: Partial<ActivityItem> = {}, interruptionClass = 3) => ({ item: item(overrides), interruptionClass, contextKind: 'ACCOUNT', callSafe: false });
const strips = (h: IntegrationHarness) => h.http.calls.filter((call) => call.url.includes('/activity/strip')).map((call) => JSON.parse(call.body ?? '{}'));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('A3-01 — the global Activity entry (P3 §3, §6)', () => {
  it('ONE icon-only entry in the non-Analysis upper chrome, at the START edge; presence in its name, never a count', async () => {
    const { h, view } = await world({ interruptions: [], present: true, feed: [] });
    expect(view.getAllByTestId('qandeel-activity-entry')).toHaveLength(1);
    const chrome = view.getByTestId('qandeel-chrome-start');
    const entry = within(chrome).getByTestId('qandeel-activity-entry');
    expect(entry.props.accessibilityLabel).toBe(`${COPY.openName}${LANGUAGE === 'ar' ? '، ' : ', '}${COPY.newState}`);
    expect(style(entry)).toMatchObject({ width: 44, height: 44 });
    // Every Activity request: the reader's own token, and no account named anywhere.
    for (const call of h.http.calls.filter((c) => c.url.includes('/activity'))) {
      expect(call.authorization).toBe('Bearer token-a');
      expect(call.url).not.toMatch(/alice|userId|user_id/u);
    }
    view.unmount();
    h.dispose();
  });

  it('the Analysis never receives the entry, and Activity is not a fourth World destination', async () => {
    const { h, view } = await world({ interruptions: [], present: false, feed: [] });
    await press(view, 'qandeel-depth-to-analysis');
    expect(within(view.getByTestId('qandeel-depth-analysis')).queryByTestId('qandeel-activity-entry', { includeHiddenElements: true })).toBeNull();
    view.unmount();
    h.dispose();
  });

  it('opens Activity over the Conversation; Back (control or system) returns to exactly the same place', async () => {
    const back = systemBack();
    const row = item({ category: 'SYSTEM' });
    const { h, view } = await world({ interruptions: [], present: true, feed: [row] });
    await press(view, 'qandeel-activity-entry');
    expect(view.getByTestId('qandeel-activity-title').props.children).toBe(COPY.title);
    expect(view.getByTestId(`qandeel-activity-row-${row.id}`)).toBeTruthy();
    // Beneath Activity the Conversation stays mounted, out of reach.
    expect(view.getByTestId('qandeel-depth-conversation', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
    await back();
    expect(view.queryByTestId('qandeel-activity')).toBeNull();
    expect(view.getByTestId('qandeel-conversation')).toBeTruthy();
    await press(view, 'qandeel-activity-entry');
    await press(view, 'qandeel-activity-back');
    expect(view.queryByTestId('qandeel-activity')).toBeNull();
    view.unmount();
    h.dispose();
  });

  it('Activity’s own settings act opens General Settings directly on Notifications & Activity; Back returns to Activity', async () => {
    const { h, view } = await world({ interruptions: [], present: false, feed: [] });
    await press(view, 'qandeel-activity-entry');
    await press(view, 'qandeel-activity-settings');
    expect(view.getByTestId('qandeel-notifications')).toBeTruthy();
    expect(view.getAllByText(notificationsCopy(LANGUAGE).proactive).length).toBeGreaterThan(0);
    await press(view, 'qandeel-settings-back');
    expect(view.getByTestId('qandeel-activity')).toBeTruthy();
    view.unmount();
    h.dispose();
  });
});

describe('A3-01 — the ordinary Attention Strip and the Analysis law (P3 §7, §8)', () => {
  it('outside the origin, on a non-Analysis surface: ONE strip; its evidence recorded; nothing else presented', async () => {
    const first = candidate({}, 2);
    const second = candidate({}, 3);
    const { h, view } = await world({ interruptions: [first, second], present: true, feed: [] });
    expect(view.getByTestId('qandeel-attention-strip')).toBeTruthy();
    expect(view.getAllByTestId('qandeel-attention-strip')).toHaveLength(1);
    expect(strips(h)).toEqual([{ presentedItemId: first.item.id, settledItemIds: [second.item.id] }]);
    view.unmount();
    h.dispose();
  });

  it('inside the Analysis: no strip, no record; leaving re-reads current truth and presents AT MOST one — no dump', async () => {
    const state = { interruptions: [] as ReturnType<typeof candidate>[], present: false, feed: [] as ActivityItem[] };
    const { h, view } = await world(state);
    await press(view, 'qandeel-depth-to-analysis');
    const a = candidate({}, 3);
    const b = candidate({}, 2);
    const c = candidate({}, 3);
    state.interruptions = [a, b, c];
    state.present = true;
    await refresh(h);
    expect(view.queryByTestId('qandeel-attention-strip')).toBeNull();
    expect(strips(h)).toEqual([]);
    // c went stale while the reader was in the Analysis: current truth no longer lists it.
    state.interruptions = [a, b];
    await press(view, 'qandeel-depth-to-conversation');
    await act(async () => {
      await settle();
    });
    expect(view.getAllByTestId('qandeel-attention-strip')).toHaveLength(1);
    expect(strips(h)).toEqual([{ presentedItemId: b.item.id, settledItemIds: [a.item.id] }]);
    view.unmount();
    h.dispose();
  });

  it('the strip body is the Direct Entry, revalidated by the server first, executed into a surface that exists', async () => {
    const shown = candidate({ category: 'SYSTEM' }, 2);
    const { h, view } = await world({ interruptions: [shown], present: true, feed: [] });
    await press(view, 'qandeel-attention-strip-body');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await settle();
    });
    const opens = h.http.calls.filter((call) => call.url.endsWith(`/activity/items/${shown.item.id}/open`));
    expect(opens).toHaveLength(1);
    expect(opens[0].method).toBe('POST');
    expect(view.getByTestId('qandeel-settings')).toBeTruthy();
    view.unmount();
    h.dispose();
  });

  it('in the background nothing is read and nothing is presented', async () => {
    const h = await harness({ initialSession: { userId: 'alice', accessToken: 'token-a' } });
    serve(h, { interruptions: [candidate()], present: true, feed: [] });
    const view = await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <RuntimePhaseSurface runtime={h.runtime} />
      </SafeAreaProvider>,
    );
    await act(async () => {
      await settle();
    });
    expect(h.http.calls.filter((call) => call.url.includes('/activity/attention'))).toHaveLength(0);
    expect(view.queryByTestId('qandeel-attention-strip')).toBeNull();
    view.unmount();
    h.dispose();
  });
});
