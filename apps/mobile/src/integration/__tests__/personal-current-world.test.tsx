/**
 * COSMOS E-2 corrections, Slice C — the user-level CURRENT Personal World (Product Owner decision D-5, Option U,
 * 2026-11-20; Contract §31).
 *
 * The real `LivingAnalysisMap` over the real bootstrapped runtime: the Personal map opens in its Session-bound mode exactly
 * as before, with two mode chips in its rail; choosing "All my topics now" reads the person's current world ONCE through
 * the identity-bound seam (never at launch), shows it on the same stage with an honest note and NO timeline, names each
 * focused Thread from the served wire (alias over grounding wording, else no name yet), offers Slice A's acts — a rename
 * re-reads the current world, "Open where it began" commits this conversation's moment and returns to the Session mode,
 * or asks the ONE switching seam for the other conversation — and says plainly when the world is empty or unreadable.
 * Nothing here moves the Session-bound camera, commits a moment on its own, or invents a name.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';

import { analysisCopy } from '../../analysis-language';
import { disclosureFixture, inspectionFromQuery } from '../../map/__fixtures__/disclosure';
import type { HistoricalSemanticDepth } from '../../projection';
import { resize } from '../../responsive/__fixtures__/composition';
import type { Responder } from '../../runtime-entry/__fixtures__/runtime-entry';
import { effectiveTC } from '../../state';
import {
  LivingAnalysisMap, PERSONAL_CURRENT_PEEK_TEST_ID, PERSONAL_PEEK_TEST_ID, PERSONAL_RAIL_HOLDER_TEST_ID,
  PERSONAL_WORLD_MODE_CURRENT_TEST_ID, PERSONAL_WORLD_MODE_NOTE_TEST_ID, PERSONAL_WORLD_MODE_SESSION_TEST_ID, PERSONAL_WORLD_MODE_TEST_ID,
} from '../composition/LivingAnalysisMap';
import { productLocale } from '../locale/product-locale';
import { harness, settle, SESSION_A, SESSION_B, type IntegrationHarness } from '../__fixtures__/integration';

jest.setTimeout(30000);

const hidden = { includeHiddenElements: true } as const;
const LIVE_HEAD = 6;
const STEP = 1_000_000;
const THREADS = [
  { id: 'thread-a', x: '0', y: '0', establishedSp: 2, name: 'مديري', nameSource: 'GROUNDING_WORDING' as const, origin: { sessionId: SESSION_A, sp: 2 } },
  { id: 'thread-c', x: String(STEP), y: '0', establishedSp: 5, name: null },
];
/** The CURRENT world holds MORE than this Session's disclosure does: a Thread established in another conversation. */
const CURRENT = [
  { id: 'thread-a', home: { x: '0', y: '0' }, name: { text: 'مديري', source: 'GROUNDING_WORDING' }, origin: { sessionId: SESSION_A, sp: 2 } },
  { id: 'thread-b', home: { x: String(STEP / 2), y: '0' }, name: { text: 'My plan', source: 'USER_ALIAS' }, origin: { sessionId: SESSION_B, sp: 3 } },
  { id: 'thread-c', home: { x: String(STEP), y: '0' }, name: { text: null, source: 'NONE' }, origin: { sessionId: SESSION_A, sp: 5 } },
];

const projection: Responder = (request) => {
  const params = new URL(request.url).searchParams;
  const depth = (params.get('depth') ?? 'WORLD') as HistoricalSemanticDepth;
  const inspection = inspectionFromQuery((name) => params.get(name));
  return {
    status: 200,
    body: disclosureFixture({ depth, sessionId: SESSION_A, tc: Number(params.get('tc') ?? LIVE_HEAD), liveHead: LIVE_HEAD, threads: THREADS, inspection }),
  };
};

const harnesses: IntegrationHarness[] = [];
afterEach(async () => {
  cleanup();
  for (const h of harnesses.splice(0)) h.dispose();
  await settle();
});

const INSETS = { top: 44, bottom: 34, left: 0, right: 0 };

interface Mounted {
  readonly h: IntegrationHarness;
  readonly view: RenderResult;
  readonly onAlias: jest.Mock<Promise<boolean>, [string, string]>;
  readonly onOpenSource: jest.Mock<Promise<'SWITCHED'>, [string, number]>;
  readonly serve: (threads: unknown[] | 'FAIL') => void;
}

async function mount(language: 'en' | 'ar' = 'en', threads: unknown[] | 'FAIL' = CURRENT): Promise<Mounted> {
  const h = await harness({ liveHead: LIVE_HEAD, projection });
  harnesses.push(h);
  let current: unknown[] | 'FAIL' = threads;
  h.http.on('/conversation/personal-world', () => (current === 'FAIL' ? { status: 503, body: {} } : { status: 200, body: { asOf: '2026-11-20T10:00:00.000Z', threads: current } }));
  const onAlias = jest.fn<Promise<boolean>, [string, string]>(async () => true);
  const onOpenSource = jest.fn<Promise<'SWITCHED'>, [string, number]>(async () => 'SWITCHED');
  const view = await render(
    <LivingAnalysisMap runtime={h.ready()} locale={productLocale(language, language === 'ar' ? 'RTL' : 'LTR')} insets={INSETS}
        fontScale={1} envelope={{ width: 390, height: 844 }} registerSheetBack={jest.fn()} onAlias={onAlias} onOpenSource={onOpenSource} />,
  );
  await act(async () => { await settle(); });
  await resize(view, 390, 844, { insetTop: 44, insetBottom: 34 });
  await act(async () => { await settle(); });
  return { h, view, onAlias, onOpenSource, serve: (next) => { current = next; } };
}

const flush = () => act(async () => { await settle(); });
const words = (node: { props: { children?: unknown } }) => (Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children) as string;
const worldReads = (h: IntegrationHarness) => h.http.calls.filter((call) => call.url.endsWith('/conversation/personal-world')).length;
const selected = (view: RenderResult, testID: string) => view.getByTestId(testID, hidden).props.accessibilityState?.selected === true;
const press = async (view: RenderResult, testID: string) => { await act(async () => { fireEvent.press(view.getByTestId(testID, hidden)); }); await flush(); };
const toCurrent = async (view: RenderResult) => press(view, PERSONAL_WORLD_MODE_CURRENT_TEST_ID);
/** Focus one Thread of the current world through the current owner's own act (where the stage's tap lands). */
async function focusCurrent(_h: IntegrationHarness, view: RenderResult, id: string) {
  await act(async () => { currentOwnerFocus(view, id); await settle(); });
  await flush();
}

/** The stage's world view is handed the owner; its marks are focused by the owner's `focus`. The hook below reaches it. */
let currentOwnerFocus: (view: RenderResult, id: string) => void = () => { throw new Error('no current owner'); };
jest.mock('../../cosmos/product', () => {
  const actual = jest.requireActual('../../cosmos/product');
  return {
    ...actual,
    createCurrentPersonalCosmosOwner: (options: Parameters<typeof actual.createCurrentPersonalCosmosOwner>[0]) => {
      const owner = actual.createCurrentPersonalCosmosOwner(options);
      currentOwnerFocus = (_view, id) => owner.focus(actual.currentThreadMarkId(id));
      return owner;
    },
  };
});

describe('Slice C (D-5, Option U) — the Personal map\'s two modes', () => {
  it.each(['en', 'ar'] as const)('%s: opens Session-bound with the two chips (this one selected) and reads NO current world at launch', async (language) => {
    const copy = analysisCopy(language);
    const { h, view } = await mount(language);
    expect(worldReads(h)).toBe(0);
    const chips = view.getByTestId(PERSONAL_WORLD_MODE_TEST_ID, hidden);
    expect(chips.queryAll((node) => node.type === 'Text').map((node) => words(node))).toEqual([copy.worldModeThisConversation, copy.worldModeAllTopics]);
    expect(selected(view, PERSONAL_WORLD_MODE_SESSION_TEST_ID)).toBe(true);
    expect(selected(view, PERSONAL_WORLD_MODE_CURRENT_TEST_ID)).toBe(false);
    // The Session-bound rail (the timeline's holder) is there; the current world's note is not.
    expect(view.getByTestId(PERSONAL_RAIL_HOLDER_TEST_ID, hidden)).toBeTruthy();
    expect(view.queryByTestId(PERSONAL_WORLD_MODE_NOTE_TEST_ID, hidden)).toBeNull();
  });

  it.each(['en', 'ar'] as const)('%s: "All my topics now" reads the current world ONCE on the identity-bound seam and shows it with the honest note and no timeline; back to this conversation reads it again, and the Session world is where it was', async (language) => {
    const copy = analysisCopy(language);
    const { h, view } = await mount(language);
    await toCurrent(view);
    expect(worldReads(h)).toBe(1);
    const call = h.http.calls.find((c) => c.url.endsWith('/conversation/personal-world'))!;
    expect(call.method).toBe('GET');
    expect(call.authorization).toBe('Bearer token-1');
    expect(selected(view, PERSONAL_WORLD_MODE_CURRENT_TEST_ID)).toBe(true);
    expect(words(view.getByTestId(PERSONAL_WORLD_MODE_NOTE_TEST_ID, hidden))).toBe(copy.currentWorldNote);
    expect(view.queryByTestId(PERSONAL_RAIL_HOLDER_TEST_ID, hidden)).toBeNull();
    expect(view.queryByTestId(PERSONAL_PEEK_TEST_ID, hidden)).toBeNull();
    expect(h.ready().currentWorld.getState().threads.map((t) => t.id)).toEqual(['thread-a', 'thread-b', 'thread-c']);
    expect(effectiveTC(h.ready().store.getState())).toBe(LIVE_HEAD);

    await press(view, PERSONAL_WORLD_MODE_SESSION_TEST_ID);
    expect(view.getByTestId(PERSONAL_RAIL_HOLDER_TEST_ID, hidden)).toBeTruthy();
    await toCurrent(view);
    expect(worldReads(h)).toBe(2);
  });

  it('says plainly when the current world is empty, and when it could not be read', async () => {
    const copy = analysisCopy('en');
    const empty = await mount('en', []);
    await toCurrent(empty.view);
    expect(words(empty.view.getByTestId(PERSONAL_WORLD_MODE_NOTE_TEST_ID, hidden))).toBe(copy.currentWorldEmpty);
    cleanup();
    const down = await mount('en', 'FAIL');
    await toCurrent(down.view);
    expect(words(down.view.getByTestId(PERSONAL_WORLD_MODE_NOTE_TEST_ID, hidden))).toBe(copy.currentWorldUnavailable);
  });
});

describe('Slice C — the focused Thread of the current world', () => {
  it('is named from the wire beneath the family word (alias as the person\'s choice; wording as their words; none as no name yet), with the honest statement', async () => {
    const copy = analysisCopy('en');
    const { h, view } = await mount('en');
    await toCurrent(view);
    await focusCurrent(h, view, 'thread-b');
    const peek = () => view.getByTestId(PERSONAL_CURRENT_PEEK_TEST_ID, hidden).queryAll((node) => node.type === 'Text').map((node) => words(node));
    expect(peek()).toEqual([copy.family.THREAD, 'My plan', copy.topicNameYours, copy.currentWorldNote, copy.nameTopic, copy.openSource]);
    await focusCurrent(h, view, 'thread-a');
    expect(peek()).toEqual([copy.family.THREAD, 'مديري', copy.topicNameFromWords, copy.currentWorldNote, copy.nameTopic, copy.openSource]);
    await focusCurrent(h, view, 'thread-c');
    expect(peek()).toEqual([copy.family.THREAD, copy.topicUnnamed, copy.currentWorldNote, copy.nameTopic, copy.openSource]);
  });

  it('a rename goes through the ONE alias seam and the current world is re-read (the shown name is the server\'s, never the draft)', async () => {
    const { h, view, onAlias, serve } = await mount('en');
    await toCurrent(view);
    await focusCurrent(h, view, 'thread-a');
    await press(view, `${PERSONAL_PEEK_TEST_ID}:name-edit`);
    const field = view.getByTestId(`${PERSONAL_PEEK_TEST_ID}:name-field`, hidden);
    expect(field.props.value).toBe('');
    serve(CURRENT.map((t) => (t.id === 'thread-a' ? { ...t, name: { text: 'My manager', source: 'USER_ALIAS' } } : t)));
    await act(async () => { fireEvent.changeText(field, 'My manager'); });
    await press(view, `${PERSONAL_PEEK_TEST_ID}:name-save`);
    expect(onAlias).toHaveBeenCalledWith('thread-a', 'My manager');
    expect(worldReads(h)).toBe(2);
    expect(words(view.getByTestId(`${PERSONAL_CURRENT_PEEK_TEST_ID}:name`, hidden))).toBe('My manager');
  });

  it('"Open where it began" in this conversation commits that Session Position through the kernel and returns to the Session mode; in another conversation it asks the ONE switching seam and moves nothing here', async () => {
    const { h, view, onOpenSource } = await mount('en');
    await toCurrent(view);
    await focusCurrent(h, view, 'thread-a');
    await press(view, `${PERSONAL_PEEK_TEST_ID}:source`);
    expect(effectiveTC(h.ready().store.getState())).toBe(2);
    expect(onOpenSource).not.toHaveBeenCalled();
    expect(selected(view, PERSONAL_WORLD_MODE_SESSION_TEST_ID)).toBe(true);
    expect(view.getByTestId(PERSONAL_RAIL_HOLDER_TEST_ID, hidden)).toBeTruthy();

    await toCurrent(view);
    await focusCurrent(h, view, 'thread-b');
    await press(view, `${PERSONAL_PEEK_TEST_ID}:source`);
    expect(onOpenSource).toHaveBeenCalledTimes(1);
    expect(onOpenSource).toHaveBeenCalledWith(SESSION_B, 3);
    expect(effectiveTC(h.ready().store.getState())).toBe(2);
    expect(h.ready().bundle.sessionId).toBe(SESSION_A);
  });
});
