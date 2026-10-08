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

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../../appearance';
import { viewportEnvelope } from '../../../map/camera';
import { canonicalWorldAddress } from '../../../map/world';
import type { PublicAuthoringAnswer, PublicDiscussionPage, PublicDiscussionPost, PublicFieldEntry, PublicFieldPanel } from '../../../runtime-entry';
import { ActivityApiClient, PublicWorldApiClient } from '../../../runtime-entry';
import { createPublicWorldController } from '../../public-world-controller';
import { PublicWorldArea } from '../../PublicWorldArea';
import { PUBLIC_DISCUSSION_COPY_GATE, publicDiscussionCopy } from '../discussion-copy';
import { createPublicDiscussionController, threadsOf, type PublicDiscussionTransport } from '../public-discussion-controller';
import { createPublicFieldController, type PublicFieldTransport } from '../public-field-controller';

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
const post = (n: number, overrides: Partial<PublicDiscussionPost> = {}): PublicDiscussionPost => ({
  id: id(100 + n), threadRootId: id(100 + n), ordinal: n, author: { mode: 'PSEUDONYM', label: `walker${n}` }, text: `post ${n}`,
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
    const wire = { id: ROOT.id, threadRootId: ROOT.id, ordinal: 1, author: { mode: 'PSEUDONYM', label: 'walker1' }, text: 'post 1', postedAt: PUBLISHED,
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
    field.setEnvelope(viewportEnvelope(400, 800)!);
    await act(async () => { field.focus(E1.id); });
    for (let n = 0; n < 3; n += 1) await flush();
    return { view, field, d };
  }

  it.each(['ar', 'en'] as const)('the panel shows the publication date and «Discussion · n» — the human count only (%s)', async (language) => {
    const copy = publicDiscussionCopy(language);
    const { view } = await mount(language);
    expect(view.getByTestId('qandeel-public-panel-published').props.children).toMatch(language === 'ar' ? /^نُشرت في / : /^Published /u);
    const entry = view.getByTestId('qandeel-public-panel-discussion');
    expect(entry.props.accessibilityLabel).toBe(copy.discussionWithCount.replace('{0}', '3'));
    expect(entry.props.accessibilityRole).toBe('button');
    expect(JSON.stringify(view.toJSON())).not.toMatch(/popular|trending|important|qandeelResponseCount/iu);
  });

  it('the discussion: Public display, QANDEEL attributed truthfully and distinctly, Back returns to the same panel', async () => {
    const copy = publicDiscussionCopy('en');
    const { view, field } = await mount('en');
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-panel-discussion')); });
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
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-discussion-back')); });
    expect(field.getState().focus).toMatchObject({ id: E1.id, discussion: false });
    expect(view.getByTestId('qandeel-public-panel')).toBeTruthy();
  });

  it('no composer and no Reply where the reader may not contribute; an empty discussion says so', async () => {
    const copy = publicDiscussionCopy('ar');
    const { view } = await mount('ar', page([], false));
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-public-panel-discussion')); });
    for (let n = 0; n < 3; n += 1) await flush();
    expect(view.queryByTestId('qandeel-public-composer')).toBeNull();
    expect(view.getByTestId('qandeel-public-discussion-empty').props.children).toBe(copy.noPosts);
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
