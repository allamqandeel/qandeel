/**
 * S5-04 — the dependent Public discussion: the strict client, the discussion controller (one visible depth, no cache as a
 * source of display, idempotent sends), the field's Back order (discussion → panel → field) and its exact Direct Entry,
 * the panel's publication date and Discussion entry (human count only), the discussion surface (Public display only,
 * QANDEEL attributed truthfully and distinctly, no composer without entitlement), the Public Activity decoding and the
 * S5-04 Product Copy Gate census.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../../appearance';
import { viewportEnvelope } from '../../../map/camera';
import { resize, subtree } from '../../../responsive/__fixtures__/composition';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { COSMOS_SHEET_BODY_GESTURE_TEST_ID, COSMOS_SHEET_HANDLE_GESTURE_TEST_ID, COSMOS_SHEET_HANDLE_TEST_ID, COSMOS_SHEET_TEST_ID } from '../../../cosmos/product';
import { canonicalWorldAddress } from '../../../map/world';
import type { PublicAuthoringAnswer, PublicDiscussionPage, PublicDiscussionPost, PublicFieldEntry, PublicFieldPanel } from '../../../runtime-entry';
import { ActivityApiClient, PublicWorldApiClient } from '../../../runtime-entry';
import { createPublicWorldController } from '../../public-world-controller';
import { PublicWorldArea } from '../../PublicWorldArea';
import { PUBLIC_DISCUSSION_COPY_GATE, publicDiscussionCopy } from '../discussion-copy';
import { PUBLIC_SHEET_TABS_COPY_GATE, publicSheetTabsCopy } from '../sheet-tabs-copy';
import { createPublicDiscussionController, threadsOf, type PublicDiscussionTransport } from '../public-discussion-controller';
import { createPublicFieldController, type PublicFieldTransport } from '../public-field-controller';
import { PUBLIC_DISCUSSION_TEST_ID } from '../PublicDiscussion';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const INSETS = { top: 44, right: 0, bottom: 0, left: 0 };
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const yes = <T,>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });
const NO = { kind: 'NO_ANSWER' as const };
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const at = (x: bigint, y: bigint) => {
  const a = canonicalWorldAddress(x, y);
  if (!a.ok) throw new Error('fixture');
  return a.address;
};
const E1: PublicFieldEntry = { id: id(1), address: at(300_000n, 600_000n), meaning: 'meaning 1', region: 'family.fear' };
const PUBLISHED = '2026-10-07T10:00:00.000Z';
const served = (count = 3): PublicFieldPanel => ({ kind: 'SERVED', experience: {
  entry: E1, primaryThemes: ['fear'], secondaryThemes: [], publisher: { mode: 'PSEUDONYM', label: 'nightlamp27' }, publishedAt: PUBLISHED,
  discussionCount: count, content: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'the public words' }], nearby: [], relations: [],
} });
// RE-ANCHORED by S8A-05 CP4 (migration 0182, Controlled Amendment A-5(a) / (b)): every post now carries the exact post it
// answers and the OP flag (`public-discussion-threads.test.tsx` proves both).
const post = (n: number, overrides: Partial<PublicDiscussionPost> = {}): PublicDiscussionPost => ({
  id: id(100 + n), threadRootId: id(100 + n), replyToPostId: null, ordinal: n, isOp: false, author: { mode: 'PSEUDONYM', label: `walker${n}` }, text: `post ${n}`,
  postedAt: PUBLISHED, own: false, qandeel: { state: 'NONE' }, ...overrides,
});
const ROOT = post(1);
const REPLY = post(2, { threadRootId: ROOT.id, own: true, qandeel: { state: 'RESPONDED', text: 'A public reading.', respondedAt: PUBLISHED } });
const PENDING = post(3, { qandeel: { state: 'PENDING' } });
const page = (posts: PublicDiscussionPost[] = [ROOT, REPLY, PENDING], canContribute = true, nextAfter: number | null = null): PublicDiscussionPage =>
  ({ kind: 'SERVED', canContribute, posts, nextAfter });

function discussionTransport(answer: () => PublicAuthoringAnswer<PublicDiscussionPage> = () => yes(page())) {
  return {
    read: jest.fn(async () => answer()),
    post: jest.fn(async () => yes({ kind: 'COMMITTED' as const, postId: id(200), threadRootId: id(200), qandeel: 'NONE' as const })),
    retryQandeel: jest.fn(async () => yes('RESPONDED' as const)),
  };
}
const discussionOf = (t = discussionTransport(), newId = (() => { let n = 0; return () => id(300 + (n += 1)); })()) =>
  createPublicDiscussionController({ transport: t as unknown as PublicDiscussionTransport, isCurrent: () => true, newId });
const fieldTransport = (panel: () => PublicFieldPanel = () => served()) => ({
  field: jest.fn(async () => yes([E1])), search: jest.fn(async () => yes([])), experience: jest.fn(async () => yes(panel())),
});
const appearance = () => {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
};

afterEach(cleanup);

describe('S5-04 — the strict discussion client', () => {
  const client = (body: unknown, ok = true) => new PublicWorldApiClient({
    baseUrl: 'https://api', fetch: jest.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => body })) as never,
  } as never).discussion;

  it('decodes exactly the served page; anything more (a like, a rank, an account) is no answer', async () => {
    const wire = { id: ROOT.id, threadRootId: ROOT.id, replyToPostId: null, ordinal: 1, isOp: false, author: { mode: 'PSEUDONYM', label: 'walker1' }, text: 'post 1', postedAt: PUBLISHED,
      own: false, qandeel: { state: 'NONE' } };
    await expect(client({ state: 'SERVED', canContribute: false, posts: [wire], nextAfter: null }).read(E1.id, null))
      .resolves.toEqual(yes({ kind: 'SERVED', canContribute: false, posts: [ROOT], nextAfter: null }));
    await expect(client({ state: 'UNAVAILABLE' }).read(E1.id, null)).resolves.toEqual(yes({ kind: 'ABSENT' }));
    for (const bad of [{ ...wire, likes: 3 }, { ...wire, author: { mode: 'ACCOUNT', label: 'x' } }, { ...wire, userId: id(9) }, { ...wire, qandeel: { state: 'RESPONDED' } }]) {
      await expect(client({ state: 'SERVED', canContribute: true, posts: [bad], nextAfter: null }).read(E1.id, null)).resolves.toEqual(NO);
    }
    await expect(client({}, false).read(E1.id, null)).resolves.toEqual(NO);
  });

  it('posts send only { commandId, text, replyTo }; outcomes are decoded strictly', async () => {
    const fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ outcome: 'NOT_ENTITLED' }) }));
    const c = new PublicWorldApiClient({ baseUrl: 'https://api', fetch } as never).discussion;
    await expect(c.post(E1.id, id(5), '@qandeel?', ROOT.id)).resolves.toEqual(yes({ kind: 'NOT_ENTITLED' }));
    expect(JSON.parse((fetch.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toEqual({ commandId: id(5), text: '@qandeel?', replyTo: ROOT.id });
  });
});

describe('S5-04 — the discussion controller', () => {
  it('groups served posts into one visible depth, in canonical ordinal order', () => {
    const deeper = post(4, { threadRootId: ROOT.id });
    expect(threadsOf([PENDING, deeper, REPLY, ROOT]).map((g) => [g.root.id, g.replies.map((r) => r.id)]))
      .toEqual([[ROOT.id, [REPLY.id, deeper.id]], [PENDING.id, []]]);
  });

  it('reads on open; ABSENT empties it at once — no tombstone, no reason', async () => {
    let answer = yes(page());
    const t = discussionTransport(() => answer);
    const d = discussionOf(t);
    d.open(E1.id);
    await flush();
    expect(d.getState()).toMatchObject({ status: 'SERVED', canContribute: true, hasMore: false });
    answer = yes({ kind: 'ABSENT' });
    d.refresh();
    await flush();
    expect(d.getState()).toMatchObject({ status: 'ABSENT', threads: [], canContribute: false });
  });

  it('a send that was not confirmed retries as the SAME command; a committed send reads again', async () => {
    const t = discussionTransport();
    t.post.mockResolvedValueOnce(NO as never);
    const d = discussionOf(t);
    d.open(E1.id);
    await flush();
    d.replyTo(REPLY);
    expect(await d.send('@qandeel what do you see?')).toBe(false);
    expect(d.getState().send).toBe('UNCONFIRMED');
    expect(await d.send('@qandeel what do you see?')).toBe(true);
    expect(t.post.mock.calls[0]).toEqual([E1.id, id(301), '@qandeel what do you see?', REPLY.id]);
    expect(t.post.mock.calls[1]).toEqual(t.post.mock.calls[0]);
    expect(d.getState()).toMatchObject({ send: 'IDLE', replyTo: null });
    expect(t.read).toHaveBeenCalledTimes(2);
  });

  it('nothing is sent while the reader may not contribute (the CW2-08 entitlement seam)', async () => {
    const t = discussionTransport(() => yes(page([ROOT], false)));
    const d = discussionOf(t);
    d.open(E1.id);
    await flush();
    expect(await d.send('hello')).toBe(false);
    expect(t.post).not.toHaveBeenCalled();
  });
});

describe('S5-04 — the field: Back order and exact Direct Entry', () => {
  it('discussion → panel → field; another Experience never keeps this discussion', async () => {
    const d = discussionOf();
    const field = createPublicFieldController({ transport: fieldTransport() as unknown as PublicFieldTransport, isCurrent: () => true, discussion: d });
    field.enter();
    await flush();
    field.setEnvelope(viewportEnvelope(400, 800)!);
    field.focus(E1.id);
    await flush();
    field.openDiscussion();
    await flush();
    expect(field.getState().focus).toMatchObject({ id: E1.id, discussion: true });
    expect(d.getState().status).toBe('SERVED');
    expect(field.back()).toBe(true);
    expect(field.getState().focus).toMatchObject({ id: E1.id, discussion: false });
    expect(d.getState().status).toBe('CLOSED');
    expect(field.back()).toBe(true);
    expect(field.getState().focus).toBeNull();
    expect(field.back()).toBe(false);
  });

  it('Direct Entry opens EXACTLY the served Experience\'s discussion; a stale one is the neutral absence, never a substitute', async () => {
    const d = discussionOf();
    const field = createPublicFieldController({ transport: fieldTransport() as unknown as PublicFieldTransport, isCurrent: () => true, discussion: d });
    field.target(E1.id, 'DISCUSSION');
    field.enter();
    for (let n = 0; n < 4; n += 1) await flush();
    expect(field.getState().focus).toMatchObject({ id: E1.id, discussion: true, panel: { status: 'SERVED' } });
    expect(field.getState().camera?.depth).toBe('NEAR');
    expect(d.getState().experienceId).toBe(E1.id);

    const stale = createPublicFieldController({ transport: fieldTransport(() => ({ kind: 'ABSENT' })) as unknown as PublicFieldTransport, isCurrent: () => true,
      discussion: discussionOf() });
    stale.enterAt(E1.id, 'DISCUSSION');
    for (let n = 0; n < 4; n += 1) await flush();
    expect(stale.getState().focus).toEqual({ id: E1.id, panel: { status: 'ABSENT' } });
    expect(stale.getState().entries).toEqual([]);
    expect(stale.discussion?.getState().status).toBe('CLOSED');
  });

  it('the Public entry controller applies a target only on ALLOW: DISCUSSION to the field, RELATIONS to the workspace', async () => {
    const field = { target: jest.fn(), retire: jest.fn() };
    const authoring = { openRelations: jest.fn(), retire: jest.fn() };
    const allow = createPublicWorldController({ transport: { entry: jest.fn(async () => ({ kind: 'ALLOW' as const })) }, isCurrent: () => true,
      field: field as never, authoring: authoring as never });
    allow.enterAt({ kind: 'DISCUSSION', experienceId: E1.id });
    await flush();
    expect(field.target).toHaveBeenCalledWith(E1.id, 'DISCUSSION');
    allow.enterAt({ kind: 'RELATIONS', experienceId: E1.id });
    await flush();
    expect(authoring.openRelations).toHaveBeenCalledWith(E1.id);
    const denied = createPublicWorldController({ transport: { entry: jest.fn(async () => ({ kind: 'DENIED' as const })) }, isCurrent: () => true,
      field: field as never, authoring: authoring as never });
    field.target.mockClear(); authoring.openRelations.mockClear();
    denied.enterAt({ kind: 'DISCUSSION', experienceId: E1.id });
    await flush();
    expect(field.target).not.toHaveBeenCalled();
  });

  it('Activity decodes the executable Public destination strictly', async () => {
    const decodeOpen = (body: unknown) => new ActivityApiClient({ baseUrl: 'https://api',
      fetch: jest.fn(async () => ({ ok: true, status: 200, json: async () => body })) } as never).open(id(900));
    expect(await decodeOpen({ outcome: 'ENTER', destination: { kind: 'PUBLIC_WORLD', target: { kind: 'DISCUSSION', experienceId: E1.id } } }))
      .toEqual({ kind: 'ENTER', destination: { kind: 'PUBLIC_WORLD', target: { kind: 'DISCUSSION', experienceId: E1.id } } });
    expect((await decodeOpen({ outcome: 'ENTER', destination: { kind: 'PUBLIC_WORLD', target: { kind: 'RELATIONS', experienceId: E1.id } } })).kind).toBe('ENTER');
    for (const destination of [{ kind: 'PUBLIC_WORLD', target: { kind: 'FEED', experienceId: E1.id } }, { kind: 'PUBLIC_WORLD', target: { kind: 'DISCUSSION', experienceId: 'x' } },
      { kind: 'PUBLIC_WORLD', target: { kind: 'DISCUSSION', experienceId: E1.id, rank: 1 } }, { kind: 'PUBLIC_WORLD' }]) {
      expect(await decodeOpen({ outcome: 'ENTER', destination })).toEqual({ kind: 'FAILED' });
    }
  });
});

describe('S5-04 — the panel entry and the discussion surface', () => {
  async function mount(language: 'ar' | 'en', discussionPage: PublicDiscussionPage = page()) {
    const d = discussionOf(discussionTransport(() => yes(discussionPage)));
    const field = createPublicFieldController({ transport: fieldTransport() as unknown as PublicFieldTransport, isCurrent: () => true, discussion: d });
    const controller = createPublicWorldController({ transport: { entry: jest.fn(async () => ({ kind: 'ALLOW' as const })) }, isCurrent: () => true, field });
    const view = await render(<AppearanceProvider authority={appearance()}><PublicWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
    for (let n = 0; n < 4; n += 1) await flush();
    // COSMOS-INT-01 Slice D RE-ANCHOR (PO, 2026-11-16, Contract v1.5 §19.3): the panel and the discussion are the Detail
    // Sheet's content, in the STAGE, which the surface draws once it has measured its glass; the surface is laid out first.
    // Previously the chrome band drew them without a layout. What these tests protect is unchanged and asserted below.
    await resize(view, 400, 800, { mapHeight: 800 });
    field.setEnvelope(viewportEnvelope(400, 800)!);
    await act(async () => { field.focus(E1.id); });
    for (let n = 0; n < 3; n += 1) await flush();
    return { view, field, d };
  }

  // COSMOS E-2 corrections, Slice E (PO, 2026-11-20 §8): the Discussion entry is the sheet's second tab, beside Back, not a
  // control inside the Information content. Its name still carries the human count only.
  it.each(['ar', 'en'] as const)('the panel shows the publication date; the Discussion tab says «Discussion · n» — the human count only (%s)', async (language) => {
    const copy = publicSheetTabsCopy(language);
    const { view } = await mount(language);
    expect(view.getByTestId('qandeel-public-panel-published').props.children).toMatch(language === 'ar' ? /^نُشرت في / : /^Published /u);
    expect(view.queryByTestId('qandeel-public-panel-discussion')).toBeNull();
    const entry = view.getByTestId('qandeel-public-sheet-tab-discussion');
    expect(entry.props.accessibilityLabel).toBe(copy.discussionWithCount.replace('{0}', '3'));
    expect(entry.props.accessibilityRole).toBe('radio');
    expect(entry.props.accessibilityState).toMatchObject({ checked: false });
    const information = view.getByTestId('qandeel-public-sheet-tab-information');
    expect(information.props.accessibilityLabel).toBe(copy.information);
    expect(information.props.accessibilityState).toMatchObject({ checked: true });
    // Slice D RE-ANCHOR: the laid-out stage and sheet carry React Native's `importantForAccessibility` PROP NAME (the
    // stage hidden while the sheet is expanded); only that platform key is left out, every word and value is still read.
    const tree = JSON.stringify(view.toJSON(), (key, value: unknown) => (key === 'importantForAccessibility' ? undefined : value));
    expect(tree).not.toMatch(/popular|trending|important|qandeelResponseCount/iu);
  });

  it('the discussion: Public display, QANDEEL attributed truthfully and distinctly, Back returns to the same panel', async () => {
    const copy = publicDiscussionCopy('en');
    const { view, field } = await mount('en');
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-sheet-tab-discussion')); });
    for (let n = 0; n < 3; n += 1) await flush();
    expect(view.getByTestId('qandeel-public-discussion')).toBeTruthy();
    expect(view.getByTestId(`qandeel-public-post-${ROOT.id}`)).toBeTruthy();
    const qandeel = view.getByTestId(`qandeel-public-qandeel-${REPLY.id}`);
    expect(qandeel.props.accessibilityLabel).toBe(copy.qandeelSays('A public reading.'));
    expect(view.getByTestId(`qandeel-public-qandeel-pending-${PENDING.id}`).props.children).toBe(copy.qandeelPending);
    expect(view.getByTestId('qandeel-public-composer')).toBeTruthy();
    expect(view.queryByText(/like|follow|message privately/iu)).toBeNull();
    await act(async () => { fireEvent.press(view.getByTestId(`qandeel-public-reply-${ROOT.id}`)); });
    expect(view.getByTestId('qandeel-public-replying-to').props.children).toBe(copy.replyingTo.replace('{0}', 'walker1'));
    // Slice E: the sheet's ONE Back (the same order as the hardware Back, §19.6.4) leaves the discussion for Information.
    expect(view.queryByTestId('qandeel-public-discussion-back')).toBeNull();
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-panel-back')); });
    expect(field.getState().focus).toMatchObject({ id: E1.id, discussion: false });
    expect(view.getByTestId('qandeel-public-panel')).toBeTruthy();
  });

  it('no composer and no Reply where the reader may not contribute; an empty discussion says so', async () => {
    const copy = publicDiscussionCopy('ar');
    const { view } = await mount('ar', page([], false));
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-sheet-tab-discussion')); });
    for (let n = 0; n < 3; n += 1) await flush();
    expect(view.queryByTestId('qandeel-public-composer')).toBeNull();
    expect(view.getByTestId('qandeel-public-discussion-empty').props.children).toBe(copy.noPosts);
  });

  // COSMOS-INT-01 Slice D (Contract v1.5 §19.4 / §19.5 / §19.7): the discussion is read in the Detail Sheet, EXPANDED, in
  // its own scroller; only the sheet's handle drags it, and collapsing or closing the sheet is presentation only.
  it('Slice D: the discussion opens the sheet EXPANDED; only the handle drags; collapsing keeps the discussion, its posts and the composer', async () => {
    const hidden = { includeHiddenElements: true } as const;
    const { view, field, d } = await mount('en');
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-sheet-tab-discussion')); });
    for (let n = 0; n < 3; n += 1) await flush();
    const sheet = () => view.getByTestId(COSMOS_SHEET_TEST_ID, hidden);
    expect(sheet().props.accessibilityViewIsModal).toBe(true);
    // The discussion keeps its own scroller in every phase: the sheet's body never drags over it.
    expect((getByGestureTestId(COSMOS_SHEET_BODY_GESTURE_TEST_ID) as unknown as { config: { enabled: boolean } }).config.enabled).toBe(false);
    expect((getByGestureTestId(COSMOS_SHEET_HANDLE_GESTURE_TEST_ID) as unknown as { config: { enabled: boolean } }).config.enabled).toBe(true);
    // The fixture's reader may contribute: the composer is in the sheet (production stays NOT_EVALUATED: no composer).
    expect(subtree(view, COSMOS_SHEET_TEST_ID).some((node) => (node.props as { testID?: string }).testID === 'qandeel-public-composer')).toBe(true);
    const fieldState = field.getState();
    const discussionState = d.getState();
    await act(async () => { fireEvent(view.getByTestId(COSMOS_SHEET_HANDLE_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: 'collapse' } }); });
    await flush();
    expect(sheet().props.accessibilityViewIsModal).toBe(false);
    expect(field.getState()).toBe(fieldState);
    expect(d.getState()).toBe(discussionState);
    expect(view.getByTestId(`qandeel-public-post-${ROOT.id}`)).toBeTruthy();
    await act(async () => { fireEvent(view.getByTestId(COSMOS_SHEET_HANDLE_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: 'close' } }); });
    await flush();
    expect(sheet().props.pointerEvents).toBe('none');
    expect(field.getState().focus).toMatchObject({ id: E1.id, discussion: true });
    // §19.4 "within the same Experience the current phase is kept": leaving the discussion once the sheet has closed (what
    // the hardware Back's controller step does) returns to the panel WITHOUT showing the sheet again (HONOR, 2026-11-16).
    await act(async () => { field.closeDiscussion(); });
    await flush();
    expect(field.getState().focus).toMatchObject({ id: E1.id, discussion: false });
    expect(sheet().props.pointerEvents).toBe('none');
  });

  // Slice D closure pass (PO, 2026-11-16; the narrow §19.13 exception): hosted in the sheet, the discussion draws no card of
  // its own; anywhere else it keeps its card exactly. Its posts, attribution and composer gating are untouched.
  it.each(['ar', 'en'] as const)('Slice D: in the sheet the discussion is no card inside a card; its posts and composer stay (%s)', async (language) => {
    const { view } = await mount(language);
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-sheet-tab-discussion')); });
    for (let n = 0; n < 3; n += 1) await flush();
    const hosted = flat(view.getByTestId(PUBLIC_DISCUSSION_TEST_ID).props.style);
    expect(hosted.backgroundColor).toBeUndefined();
    expect(hosted.borderRadius).toBeUndefined();
    expect(view.getByTestId(`qandeel-public-post-${ROOT.id}`)).toBeTruthy();
    expect(view.getByTestId('qandeel-public-composer')).toBeTruthy();
    // Its card outside the sheet: `public-discussion-threads.test.tsx`.
  });

  // COSMOS E-2 corrections, Slice E (PO, 2026-11-20 §8), superseding the UI-POLISH-01 section heading: in the sheet the
  // discussion's name is its TAB, beside Back, in the sheet's one header row; the discussion draws no header of its own
  // there (`header="host"`, the second narrow §19.13 exception). Its own Back + «النقاش» header stays everywhere else
  // (`public-discussion-threads.test.tsx`).
  it.each(['ar', 'en'] as const)('Slice E: in the sheet the discussion is named by its tab and draws no second header (%s)', async (language) => {
    const tabs = publicSheetTabsCopy(language);
    const { view } = await mount(language);
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-sheet-tab-discussion')); });
    for (let n = 0; n < 3; n += 1) await flush();
    expect(view.queryByTestId('qandeel-public-discussion-heading')).toBeNull();
    expect(view.queryByTestId('qandeel-public-discussion-back')).toBeNull();
    const chosen = view.getByTestId('qandeel-public-sheet-tab-discussion');
    expect(chosen.props.accessibilityState).toMatchObject({ checked: true });
    expect(chosen.props.accessibilityLabel).toBe(tabs.discussionWithCount.replace('{0}', '3'));
    expect(view.getByTestId('qandeel-public-sheet-tab-information').props.accessibilityState).toMatchObject({ checked: false });
    expect(view.getByTestId('qandeel-public-sheet-tabs').props.accessibilityRole).toBe('radiogroup');
    expect(view.getByTestId('qandeel-public-panel-back')).toBeTruthy();
  });

  // Slice E: Information ↔ Discussion is a tab switch inside the SAME sheet for the SAME Experience: the focus id, the
  // camera and the sheet stay; the tab is the controller's `focus.discussion`; the chosen tab is never re-pressed.
  it('Slice E: switching Information ↔ Discussion keeps the Experience, the camera and the sheet', async () => {
    const hidden = { includeHiddenElements: true } as const;
    const { view, field } = await mount('en');
    const camera = field.getState().camera;
    const sheet = () => view.getByTestId(COSMOS_SHEET_TEST_ID, hidden);
    expect(sheet().props.pointerEvents).not.toBe('none');
    // Pressing the chosen tab again does nothing.
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-sheet-tab-information')); });
    expect(field.getState().focus).toMatchObject({ id: E1.id, discussion: false });
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-sheet-tab-discussion')); });
    for (let n = 0; n < 3; n += 1) await flush();
    expect(field.getState().focus).toMatchObject({ id: E1.id, discussion: true });
    expect(field.getState().camera).toBe(camera);
    expect(sheet().props.accessibilityViewIsModal).toBe(true);
    expect(view.getByTestId(`qandeel-public-post-${ROOT.id}`)).toBeTruthy();
    expect(view.queryByTestId('qandeel-public-panel')).toBeNull();
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-sheet-tab-information')); });
    for (let n = 0; n < 3; n += 1) await flush();
    expect(field.getState().focus).toMatchObject({ id: E1.id, discussion: false });
    expect(field.getState().camera).toBe(camera);
    expect(view.getByTestId('qandeel-public-panel')).toBeTruthy();
    expect(view.queryByTestId(PUBLIC_DISCUSSION_TEST_ID)).toBeNull();
    expect(sheet().props.pointerEvents).not.toBe('none');
    // The Experience is still the sheet's subject: Back from Information releases the focus (§19.6.4).
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-panel-back')); });
    expect(field.getState().focus).toBeNull();
  });

  it('Slice E: a host without a discussion shows Information alone — no tab row', async () => {
    const field = createPublicFieldController({ transport: fieldTransport() as unknown as PublicFieldTransport, isCurrent: () => true, discussion: null });
    const controller = createPublicWorldController({ transport: { entry: jest.fn(async () => ({ kind: 'ALLOW' as const })) }, isCurrent: () => true, field });
    const view = await render(<AppearanceProvider authority={appearance()}><PublicWorldArea controller={controller} language="en" insets={INSETS} /></AppearanceProvider>);
    for (let n = 0; n < 4; n += 1) await flush();
    await resize(view, 400, 800, { mapHeight: 800 });
    field.setEnvelope(viewportEnvelope(400, 800)!);
    await act(async () => { field.focus(E1.id); });
    for (let n = 0; n < 3; n += 1) await flush();
    expect(view.getByTestId('qandeel-public-panel')).toBeTruthy();
    expect(view.getByTestId('qandeel-public-panel-back')).toBeTruthy();
    expect(view.queryByTestId('qandeel-public-sheet-tabs')).toBeNull();
    expect(view.queryByTestId('qandeel-public-sheet-tab-discussion')).toBeNull();
  });
});

describe('COSMOS E-2 Slice E — the sheet tabs Product Copy Gate', () => {
  it('ONE bounded gate, CLOSED: three rows APPROVED by the Product Owner (2026-11-20) in both languages; «النقاش» kept on the S5-04 surfaces; no rank, feed or badge', () => {
    expect(PUBLIC_SHEET_TABS_COPY_GATE.approved).toEqual(['information', 'discussion', 'discussionWithCount']);
    expect(PUBLIC_SHEET_TABS_COPY_GATE.proposed).toEqual([]);
    expect(PUBLIC_SHEET_TABS_COPY_GATE.status).toMatch(/CLOSED/u);
    for (const language of ['ar', 'en'] as const) {
      const copy = publicSheetTabsCopy(language) as unknown as Record<string, unknown>;
      for (const key of PUBLIC_SHEET_TABS_COPY_GATE.approved) expect(typeof copy[key]).toBe('string');
      expect(publicSheetTabsCopy(language).discussionWithCount).toContain('{0}');
    }
    expect(publicSheetTabsCopy('ar')).toEqual({ information: 'المعلومات', discussion: 'المناقشة', discussionWithCount: 'المناقشة · {0}' });
    expect(publicSheetTabsCopy('en')).toEqual({ information: 'Information', discussion: 'Discussion', discussionWithCount: 'Discussion · {0}' });
    const source = readFileSync(join(__dirname, '..', 'sheet-tabs-copy.ts'), 'utf8');
    expect(source.match(/\/\/ APPROVED — COSMOS E-2 Product Copy Gate/gu)).toHaveLength(6);
    expect(source).not.toMatch(/PROPOSED/u);
    // The approval is for the tab presentation only: the S5-04 discussion surface keeps its approved «النقاش» byte-exact.
    expect(publicDiscussionCopy('ar').discussion).toBe('النقاش');
    for (const language of ['ar', 'en'] as const) {
      for (const word of Object.values(publicSheetTabsCopy(language))) expect(word).not.toMatch(/rank|feed|badge|popular|notification|like|follow/iu);
    }
  });
});


const flat = (style: unknown): Record<string, unknown> => StyleSheet.flatten(style as StyleProp<ViewStyle>) as Record<string, unknown>;

describe('S5-04 — returning from the discussion reads the same panel again', () => {
  /** A field focused on E1 whose panel answers come from `experience`; returns the controller and its transport. */
  async function focused(experience: jest.Mock) {
    const t = { ...fieldTransport(), experience };
    const field = createPublicFieldController({ transport: t as unknown as PublicFieldTransport, isCurrent: () => true, discussion: discussionOf() });
    field.enter();
    await flush();
    field.setEnvelope(viewportEnvelope(400, 800)!);
    field.focus(E1.id);
    for (let n = 0; n < 3; n += 1) await flush();
    field.openDiscussion();
    await flush();
    return { field, t };
  }
  const leave = { 'the discussion Back': (f: ReturnType<typeof createPublicFieldController>) => f.closeDiscussion(),
    'the hardware Back': (f: ReturnType<typeof createPublicFieldController>) => { expect(f.back()).toBe(true); } };

  it.each(Object.keys(leave) as Array<keyof typeof leave>)('%s: the panel shows the count read now — same Experience, same camera, no field read', async (way) => {
    let count = 0;
    const { field, t } = await focused(jest.fn(async () => yes(served(count))));
    const camera = field.getState().camera;
    const fieldReads = t.field.mock.calls.length;
    count = 2;
    await act(async () => { leave[way](field); });
    await flush();
    expect(field.getState().focus).toMatchObject({ id: E1.id, discussion: false, panel: { status: 'SERVED', experience: { discussionCount: 2 } } });
    expect(field.getState().camera).toBe(camera);
    expect(t.field.mock.calls.length).toBe(fieldReads);
    expect(t.experience).toHaveBeenLastCalledWith(E1.id);
  });

  it('the count is the human count the server serves; its QANDEEL response count never reaches the panel', async () => {
    let wire = { discussionCount: 0, qandeelResponseCount: 0 };
    const body = () => ({ state: 'SERVED', experience: { id: E1.id, x: '300000', y: '600000', meaning: E1.meaning, region: E1.region, primaryThemes: ['fear'],
      secondaryThemes: [], publisher: { mode: 'PSEUDONYM', label: 'nightlamp27' }, publishedAt: PUBLISHED, ...wire },
      content: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'the public words' }], nearby: [], relations: [] });
    const strict = new PublicWorldApiClient({ baseUrl: 'https://api', fetch: jest.fn(async () => ({ ok: true, status: 200, json: async () => body() })) } as never).field;
    const { field } = await focused(jest.fn((experienceId: string) => strict.experience(experienceId)));
    expect(field.getState().focus).toMatchObject({ panel: { status: 'SERVED', experience: { discussionCount: 0 } } });
    wire = { discussionCount: 3, qandeelResponseCount: 1 };
    await act(async () => { field.closeDiscussion(); });
    for (let n = 0; n < 3; n += 1) await flush();
    const panel = field.getState().focus?.panel;
    expect(panel).toMatchObject({ status: 'SERVED', experience: { discussionCount: 3 } });
    expect(Object.keys(panel?.status === 'SERVED' ? panel.experience : {})).not.toContain('qandeelResponseCount');
  });

  it('an older answer never overwrites a newer one', async () => {
    const pending: Array<(count: number) => void> = [];
    const experience = jest.fn(async () => yes(served(0)));
    const { field } = await focused(experience);
    experience.mockImplementation(() => new Promise((resolve) => { pending.push((count) => resolve(yes(served(count)))); }));
    await act(async () => { field.closeDiscussion(); });
    field.openDiscussion();
    await act(async () => { field.closeDiscussion(); });
    expect(pending).toHaveLength(2);
    await act(async () => { pending[1](5); });
    await act(async () => { pending[0](4); });
    await flush();
    expect(field.getState().focus).toMatchObject({ discussion: false, panel: { status: 'SERVED', experience: { discussionCount: 5 } } });
  });

  it('no longer served: the neutral absence, gone from the field; no answer: unavailable, never a kept or invented count', async () => {
    let answer: PublicAuthoringAnswer<PublicFieldPanel> = yes(served(1));
    const { field } = await focused(jest.fn(async () => answer));
    answer = yes({ kind: 'ABSENT' });
    await act(async () => { field.closeDiscussion(); });
    await flush();
    expect(field.getState().focus).toEqual({ id: E1.id, panel: { status: 'ABSENT' } });
    expect(field.getState().entries.map((entry) => entry.id)).not.toContain(E1.id);

    answer = yes(served(1));
    const failing = await focused(jest.fn(async () => answer));
    answer = NO;
    await act(async () => { failing.field.closeDiscussion(); });
    await flush();
    expect(failing.field.getState().focus).toEqual({ id: E1.id, panel: { status: 'UNAVAILABLE' } });
    expect(failing.field.discussion?.getState().status).toBe('CLOSED');
  });

  // Slice E: the same read-again happens when the reader returns to the Information tab; the Discussion TAB then says the count.
  it.each(['ar', 'en'] as const)('the surface: returning to Information shows «Discussion · n» with the new count on the tab (%s)', async (language) => {
    const copy = publicSheetTabsCopy(language);
    let count = 0;
    const d = discussionOf();
    const field = createPublicFieldController({ transport: fieldTransport(() => served(count)) as unknown as PublicFieldTransport, isCurrent: () => true, discussion: d });
    const controller = createPublicWorldController({ transport: { entry: jest.fn(async () => ({ kind: 'ALLOW' as const })) }, isCurrent: () => true, field });
    const view = await render(<AppearanceProvider authority={appearance()}><PublicWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
    for (let n = 0; n < 4; n += 1) await flush();
    // COSMOS-INT-01 Slice D RE-ANCHOR (PO, 2026-11-16, Contract v1.5 §19.3): the panel and the discussion are the Detail
    // Sheet's content, in the STAGE, which the surface draws once it has measured its glass; the surface is laid out first.
    // Previously the chrome band drew them without a layout. What these tests protect is unchanged and asserted below.
    await resize(view, 400, 800, { mapHeight: 800 });
    field.setEnvelope(viewportEnvelope(400, 800)!);
    await act(async () => { field.focus(E1.id); });
    for (let n = 0; n < 3; n += 1) await flush();
    expect(view.getByTestId('qandeel-public-sheet-tab-discussion').props.accessibilityLabel).toBe(copy.discussion);
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-sheet-tab-discussion')); });
    for (let n = 0; n < 3; n += 1) await flush();
    count = 2;
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-sheet-tab-information')); });
    for (let n = 0; n < 3; n += 1) await flush();
    expect(view.getByTestId('qandeel-public-sheet-tab-discussion').props.accessibilityLabel).toBe(copy.discussionWithCount.replace('{0}', '2'));
  });
});

describe('S5-04 — the Product Copy Gate', () => {
  it('ONE bounded gate, CLOSED: every new row APPROVED in both languages; frozen words reused byte-exact', () => {
    expect(PUBLIC_DISCUSSION_COPY_GATE.proposed).toEqual([]);
    expect(PUBLIC_DISCUSSION_COPY_GATE.approved).toHaveLength(9);
    for (const language of ['ar', 'en'] as const) {
      const copy = publicDiscussionCopy(language) as unknown as Record<string, unknown>;
      for (const key of PUBLIC_DISCUSSION_COPY_GATE.approved) expect(typeof copy[key]).toBe('string');
    }
    expect(publicDiscussionCopy('ar').qandeel).toBe('قنديل');
    expect(publicDiscussionCopy('en').qandeel).toBe('QANDEEL');
    const source = readFileSync(join(__dirname, '..', 'discussion-copy.ts'), 'utf8');
    expect(source.match(/APPROVED — S5-04 Product Copy Gate/gu)).toHaveLength(18);
    expect(source).not.toMatch(/PROPOSED — S5-04/u);
  });
});
