/**
 * W3-MEGA-U — E2E-D-14: open «فهم قنديل» / QANDEEL Understanding from Personal QANDEEL (P4-C1 U-A), on the PRODUCTION
 * phase surface, over a runtime the harness genuinely built. The store, the bootstrap, the Conversation, the depth pair
 * and the Understanding controller are real; the network is the harness's HTTP double, answering as the server would.
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { BackHandler, StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { resize } from '../../responsive/__fixtures__/composition';
import { understandingCopy } from '../../understanding';
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
const COPY = understandingCopy(LANGUAGE);
const REF = 'AAAAAAAAAAAAAAAAAAAAAA';
const REV = 'rrrrrrrrrrrrrrrrrrrrr1';
const ITEM = { ref: REF, revision: REV, theme: 'GOALS', summary: 'Finishing the course matters to you.', evidenceChange: 'NONE', confidence: 'MIXED', underReview: false };
const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

async function world(): Promise<{ h: IntegrationHarness; view: RenderResult }> {
  const h = await harness({ initialSession: { userId: 'alice', accessToken: 'token-a' } });
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody([exchange('fixture: earlier words', { key: 'fixture-earlier' })]) } : { status: 500, body: {} }));
  h.http.on('/understanding/items', () => ({ status: 200, body: { items: [ITEM] } }));
  h.http.on(`/understanding/items/${REF}`, () => ({
    status: 200,
    body: { ...ITEM, evidence: ['I want to finish what I start.'], contradictions: ['I skipped the last two lessons.'], alternatives: [], unresolved: [], evolution: [{ kind: 'FIRST_SEEN', at: '2026-09-28T10:00:00Z' }] },
  }));
  h.http.on(`/understanding/items/${REF}/discussion`, () => ({ status: 204, body: {} }));
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

const understandingRequests = (h: IntegrationHarness) => h.http.calls.filter((request) => request.url.includes('/understanding'));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('E2E-D-14 — QANDEEL Understanding, a depth of Personal QANDEEL (P4-C1 U-A)', () => {
  it('the entry is ONE persistent word on the Personal row beneath the upper chrome, at the reader’s START edge, reached first', async () => {
    const { h, view } = await world();
    const row = view.getByTestId('qandeel-personal-row');
    const entry = within(row).getByTestId('qandeel-understanding-entry');
    expect(view.getAllByTestId('qandeel-understanding-entry')).toHaveLength(1);
    expect(entry.props.accessibilityLabel).toBe(COPY.name);
    expect(entry.props.accessibilityRole).toBe('button');
    expect(style(entry)).toMatchObject({ minWidth: 44, minHeight: 44 });
    // Read before the Settings entry, in both languages: the row is laid out from the reader's start.
    const order = within(row).getAllByRole('button').map((node) => node.props.testID);
    expect(order).toEqual(['qandeel-understanding-entry', 'qandeel-settings-entry']);
    expect(style(row).flexDirection).toBe(LANGUAGE === 'ar' ? 'row-reverse' : 'row');
    // Nothing is read until the reader opens it.
    expect(understandingRequests(h)).toEqual([]);
    h.dispose();
  });

  it('opening it keeps the SAME runtime, Session and Conversation; Back returns to the exact Personal state', async () => {
    const { h, view } = await world();
    const before = h.ready();
    const sessions = h.http.creates().length;
    await fireEvent.changeText(view.getByTestId('qandeel-conversation-input'), 'unsent words');
    await press(view, 'qandeel-understanding-entry');
    expect(view.getByTestId('qandeel-understanding')).toBeTruthy();
    const layer = view.getByTestId('qandeel-depth-conversation', { includeHiddenElements: true });
    expect(layer.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(layer.props.pointerEvents).toBe('none');
    // The owner's own data, with the owner's own credential, and no user id anywhere.
    expect(understandingRequests(h).map((request) => [request.method, request.authorization])).toEqual([['GET', 'Bearer token-a']]);
    expect(understandingRequests(h).every((request) => !/alice|user/iu.test(request.url + (request.body ?? '')))).toBe(true);
    expect(view.getByText(COPY.confidenceName(COPY.confidence.MIXED))).toBeTruthy();
    await press(view, 'qandeel-understanding-back');
    expect(view.queryByTestId('qandeel-understanding')).toBeNull();
    expect(h.ready()).toBe(before);
    expect(h.ready().conversation).toBe(before.conversation);
    expect(h.ready().generation).toBe(before.generation);
    expect(h.http.creates()).toHaveLength(sessions);
    expect(view.getByTestId('qandeel-conversation-input').props.value).toBe('unsent words');
    h.dispose();
  });

  it('Android system Back leaves an open item, then Understanding, then leaves Back to the platform', async () => {
    const back = systemBack();
    const { h, view } = await world();
    await press(view, 'qandeel-understanding-entry');
    await press(view, `qandeel-understanding-item-${REF}`);
    expect(view.getByTestId('qandeel-understanding-detail')).toBeTruthy();
    expect(await back.press()).toBe(true);
    expect(view.queryByTestId('qandeel-understanding-detail')).toBeNull();
    expect(view.getByTestId('qandeel-understanding')).toBeTruthy();
    expect(await back.press()).toBe(true);
    expect(view.queryByTestId('qandeel-understanding')).toBeNull();
    expect(view.getByTestId('qandeel-conversation')).toBeTruthy();
    expect(await back.press()).toBe(false);
    h.dispose();
  });

  it('talk to QANDEEL about this: back to the SAME Conversation with a bounded context line; nothing typed, nothing sent', async () => {
    const { h, view } = await world();
    const before = h.ready();
    await fireEvent.changeText(view.getByTestId('qandeel-conversation-input'), 'my own words');
    await press(view, 'qandeel-understanding-entry');
    await press(view, `qandeel-understanding-item-${REF}`);
    await press(view, 'qandeel-understanding-talk');
    expect(view.queryByTestId('qandeel-understanding')).toBeNull();
    expect(h.ready()).toBe(before);
    const strip = view.getByTestId('qandeel-understanding-discussion');
    expect(within(strip).getByText(COPY.discussing(COPY.theme.GOALS))).toBeTruthy();
    // The reader's own draft is untouched, and no turn was submitted for them.
    expect(view.getByTestId('qandeel-conversation-input').props.value).toBe('my own words');
    expect(h.http.calls.filter((request) => request.url.endsWith('/turns') && request.method === 'POST')).toEqual([]);
    const talk = understandingRequests(h).find((request) => request.method === 'POST');
    expect(talk).toMatchObject({ authorization: 'Bearer token-a', body: JSON.stringify({ revision: REV }) });
    await press(view, 'qandeel-understanding-discussion-end');
    expect(view.queryByTestId('qandeel-understanding-discussion')).toBeNull();
    expect(understandingRequests(h).filter((request) => request.method === 'DELETE')).toHaveLength(1);
    h.dispose();
  });

  it('E2E-D-15: I see it differently → recorded against the revision seen, no words sent; the item reads Mixed and under review, also after a restart', async () => {
    // A stateful stand-in for the server's contest truth (migration 0127): the disagreement makes the item MIXED /
    // under review at a new revision, and every later read — in this runtime or a new one — reflects it.
    let contested = false;
    const serve = (h: IntegrationHarness) => {
      h.http.on('/understanding/items', () => ({ status: 200, body: { items: [contested ? { ...ITEM, revision: 'rrrrrrrrrrrrrrrrrrrrr2', confidence: 'MIXED', underReview: true } : ITEM] } }));
      h.http.on(`/understanding/items/${REF}/disagreement`, () => {
        contested = true;
        return { status: 200, body: { underReview: true, revision: 'rrrrrrrrrrrrrrrrrrrrr2' } };
      });
    };
    const first = await world();
    serve(first.h);
    await press(first.view, 'qandeel-understanding-entry');
    await press(first.view, `qandeel-understanding-item-${REF}`);
    await press(first.view, 'qandeel-understanding-talk');
    await fireEvent.changeText(first.view.getByTestId('qandeel-conversation-input'), 'my own words');
    await press(first.view, 'qandeel-understanding-disagree');
    const sent = understandingRequests(first.h).filter((request) => request.url.endsWith('/disagreement'));
    expect(sent).toHaveLength(1);
    expect(sent[0].authorization).toBe('Bearer token-a');
    expect(Object.keys(JSON.parse(sent[0].body ?? '{}')).sort()).toEqual(['commandId', 'revision']);
    expect(JSON.parse(sent[0].body ?? '{}').revision).toBe(REV);
    expect(sent[0].body).not.toContain('my own words');
    expect(first.view.getByTestId('qandeel-understanding-disagreement-recorded').props.children).toBe(COPY.disagreeRecorded);
    // The Conversation continues: the reader's draft is theirs, and nothing was sent for them.
    expect(first.view.getByTestId('qandeel-conversation-input').props.value).toBe('my own words');
    expect(first.h.http.calls.filter((request) => request.url.endsWith('/turns') && request.method === 'POST')).toEqual([]);
    await press(first.view, 'qandeel-understanding-entry');
    expect(first.view.getByTestId(`qandeel-understanding-item-${REF}-under-review`).props.children).toBe(COPY.underReview);
    expect(first.view.getByText(COPY.confidenceName(COPY.confidence.MIXED))).toBeTruthy();
    first.h.dispose();

    const restarted = await world();
    serve(restarted.h);
    await press(restarted.view, 'qandeel-understanding-entry');
    expect(restarted.view.getByTestId(`qandeel-understanding-item-${REF}-under-review`)).toBeTruthy();
    restarted.h.dispose();
  });

  it('is never in the Analysis and never inside General Settings', async () => {
    const { h, view } = await world();
    await press(view, 'qandeel-settings-entry');
    expect(within(view.getByTestId('qandeel-settings')).queryByText(COPY.name)).toBeNull();
    await press(view, 'qandeel-settings-back');
    await press(view, 'qandeel-depth-to-analysis');
    await fireEvent(view.getByTestId('qandeel-depth-analysis'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
    await resize(view, 390, 844, { insetTop: 104, insetBottom: 34 });
    await act(async () => {
      await settle();
    });
    expect(within(view.getByTestId('qandeel-depth-analysis')).queryByTestId('qandeel-understanding-entry')).toBeNull();
    h.dispose();
  });
});
