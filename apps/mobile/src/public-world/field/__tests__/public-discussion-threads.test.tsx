/**
 * S8A-05 CP4 (migration 0182, Controlled Amendment A-5(a) / (b)) — the strict client keeps each reply's exact target and the
 * OP flag; the surface tags the topic author's posts with words, names whom a reply to a reply answers and moves to that
 * post when pressed; the CP4 Product Copy Gate census. Synthetic data only.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../../appearance';
import type { PublicAuthoringAnswer, PublicDiscussionPage, PublicDiscussionPost } from '../../../runtime-entry';
import { PublicWorldApiClient } from '../../../runtime-entry';
import { PublicDiscussion } from '../PublicDiscussion';
import { createPublicDiscussionController, type PublicDiscussionTransport } from '../public-discussion-controller';
import { PUBLIC_AUTHORSHIP_COPY_GATE, PUBLIC_AUTHORSHIP_COPY_ROWS, publicAuthorshipCopy } from '../../discussion-authorship-copy';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const yes = <T,>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });
const NO = { kind: 'NO_ANSWER' as const };
const AT = '2026-10-27T10:00:00.000Z';
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const post = (n: number, overrides: Partial<PublicDiscussionPost> = {}): PublicDiscussionPost => ({
  id: id(100 + n), threadRootId: id(100 + n), replyToPostId: null, ordinal: n, isOp: false, author: { mode: 'PSEUDONYM', label: `walker${n}` },
  text: `post ${n}`, postedAt: AT, own: false, qandeel: { state: 'NONE' }, ...overrides,
});
const ROOT = post(1);
const FIRST = post(2, { threadRootId: ROOT.id, replyToPostId: ROOT.id, isOp: true, author: { mode: 'PSEUDONYM', label: 'nightlamp27' }, text: 'It is mostly my manager.' });
const SECOND = post(3, { threadRootId: ROOT.id, replyToPostId: FIRST.id, text: 'Have you talked to him?' });
const page = (): PublicDiscussionPage => ({ kind: 'SERVED', canContribute: false, posts: [ROOT, FIRST, SECOND], nextAfter: null });
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

describe('S8A-05 CP4 — the strict client keeps the exact target and the OP flag', () => {
  const client = (body: unknown) => new PublicWorldApiClient({
    baseUrl: 'https://api', fetch: jest.fn(async () => ({ ok: true, status: 200, json: async () => body })) as never,
  } as never).discussion;
  const wire = { id: SECOND.id, threadRootId: ROOT.id, replyToPostId: FIRST.id, ordinal: 3, isOp: false, author: { mode: 'PSEUDONYM', label: 'walker3' },
    text: 'Have you talked to him?', postedAt: AT, own: false, qandeel: { state: 'NONE' } };

  it('decodes both fields; a missing, malformed or extra identifying field is no answer', async () => {
    await expect(client({ state: 'SERVED', canContribute: false, posts: [wire], nextAfter: null }).read(ROOT.id, null))
      .resolves.toEqual(yes({ kind: 'SERVED', canContribute: false, posts: [SECOND], nextAfter: null }));
    const { isOp: _isOp, ...noOp } = wire;
    const { replyToPostId: _target, ...noTarget } = wire;
    for (const bad of [noOp, noTarget, { ...wire, isOp: 'yes' }, { ...wire, replyToPostId: 'guess' }, { ...wire, opUserId: id(9) }]) {
      await expect(client({ state: 'SERVED', canContribute: true, posts: [bad], nextAfter: null }).read(ROOT.id, null)).resolves.toEqual(NO);
    }
  });
});

describe('S8A-05 CP4 — the thread surface', () => {
  async function shown(language: 'ar' | 'en') {
    const transport = { read: jest.fn(async () => yes(page())), post: jest.fn(), retryQandeel: jest.fn() };
    const controller = createPublicDiscussionController({ transport: transport as unknown as PublicDiscussionTransport, isCurrent: () => true, newId: () => id(900) });
    controller.open(ROOT.id);
    const view = await render(<AppearanceProvider authority={appearance()}><PublicDiscussion controller={controller} language={language} onBack={() => undefined} /></AppearanceProvider>);
    await flush();
    return view;
  }

  it.each(['ar', 'en'] as const)('tags the topic author\'s post in words, read with the author (%s)', async (language) => {
    const copy = publicAuthorshipCopy(language);
    const view = await shown(language);
    expect(view.getByTestId(`qandeel-public-op-${FIRST.id}`)).toBeTruthy();
    expect(view.queryByTestId(`qandeel-public-op-${ROOT.id}`)).toBeNull();
    expect(view.queryByTestId(`qandeel-public-op-${SECOND.id}`)).toBeNull();
    expect(view.getByLabelText(`nightlamp27 · ${copy.opTag}: It is mostly my manager.`)).toBeTruthy();
  });

  it.each(['ar', 'en'] as const)('names whom a reply to a reply answers, and only then; pressing it moves to that post (%s)', async (language) => {
    const copy = publicAuthorshipCopy(language);
    const view = await shown(language);
    expect(view.queryByTestId(`qandeel-public-in-reply-to-${FIRST.id}`)).toBeNull();
    const line = view.getByTestId(`qandeel-public-in-reply-to-${SECOND.id}`);
    expect(view.getByLabelText(copy.inReplyTo.replace('{0}', 'nightlamp27'))).toBeTruthy();
    expect(view.getAllByText('It is mostly my manager.').length).toBe(2);
    fireEvent.press(line);
  });
});

describe('S8A-05 CP4 — the Product Copy Gate', () => {
  it('two new rows, APPROVED verbatim in both languages by the Product Owner (gate CLOSED); no rank, count or name', () => {
    expect(PUBLIC_AUTHORSHIP_COPY_GATE.status).toBe('S8A-05 CP4 PRODUCT COPY GATE — CLOSED — 2 rows APPROVED in Arabic and English (Product Owner, 2026-10-27, without edits)');
    expect(Object.keys(PUBLIC_AUTHORSHIP_COPY_ROWS)).toEqual(['opTag', 'inReplyTo']);
    for (const row of Object.values(PUBLIC_AUTHORSHIP_COPY_ROWS)) {
      expect([row.status, row.enStatus]).toEqual(['APPROVED', 'APPROVED']);
      expect(`${row.ar} ${row.en}`).not.toMatch(/\b(like|follow|rank|popular|top|best|verified)\b|مميز|الأفضل|موثق/iu);
    }
    expect([PUBLIC_AUTHORSHIP_COPY_ROWS.opTag.ar, PUBLIC_AUTHORSHIP_COPY_ROWS.opTag.en]).toEqual(['صاحب الموضوع', 'Topic author']);
    expect([PUBLIC_AUTHORSHIP_COPY_ROWS.inReplyTo.ar, PUBLIC_AUTHORSHIP_COPY_ROWS.inReplyTo.en]).toEqual(['ردًا على {0}', 'In reply to {0}']);
    expect(PUBLIC_AUTHORSHIP_COPY_ROWS.inReplyTo.ar).toContain('{0}');
    expect(PUBLIC_AUTHORSHIP_COPY_ROWS.inReplyTo.en).toContain('{0}');
  });
});
