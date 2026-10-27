/**
 * S8A-05 CP2 — «انشر من قنديل» in the composition: a private draft is created holding a source (by reference only), it
 * names its material and can lose it while keeping its words; its preview shows, page by page of 50, exactly the items
 * the topic would contain — speakers, emphasis, gaps — nothing dropped; a whole message can be emphasized; QANDEEL
 * material asks ONE acknowledgement for the revision previewed before preparing; a «فهم قنديل» item is labelled as an
 * unconfirmed inference; a source's own refusal is said in the reader's words; and every new row awaits its Copy Gate.
 */
import { act, cleanup, fireEvent, render, within } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { PublicWorldArea } from '../../public-world/PublicWorldArea';
import { createPublicWorldController } from '../../public-world/public-world-controller';
import type {
  PublicAuthoringAnswer, PublicTopicConversationChoice, PublicTopicDraft, PublicTopicItem, PublicTopicPreview, PublicTopicSection, PublicTopicSource,
} from '../../runtime-entry';
import { createPublicComposeController, type PublicComposeSourceTransport, type PublicComposeTransport } from '../public-compose-controller';
import { PUBLIC_SOURCE_COPY_GATE, PUBLIC_SOURCE_COPY_ROWS, publicSourceCopy } from '../source-copy';
import { publicComposeCopy } from '../copy';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const INSETS = { top: 44, right: 0, bottom: 0, left: 0 };
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const yes = <T,>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });
const SESSION = id(9);
const TITLE = 'ما تعلّمته من الانتقال إلى مدينة جديدة';
const REF = 'a'.repeat(22);
const REV = 'b'.repeat(22);

/** The reader's own conversation: message m (1-based) is the reader's when odd, QANDEEL's when even; `size` units each. */
function conversationOf(messages: number, size: number) {
  const units: { sp: number; message: number; role: 'USER' | 'QANDEEL'; text: string }[] = [];
  for (let m = 1; m <= messages; m += 1) {
    for (let u = 0; u < size; u += 1) {
      units.push({ sp: units.length + 1, message: m, role: m % 2 === 1 ? 'USER' : 'QANDEEL', text: `m${m}u${u + 1}` });
    }
  }
  return units;
}

type Row = PublicTopicDraft & { source: PublicTopicSource; acknowledgedAt: number | null };

/** One account, holding drafts and their sources, and deriving the items exactly the way 0180 B.4 does. */
function account(units: ReturnType<typeof conversationOf>) {
  const rows = new Map<string, Row>();
  const qandeel = (s: PublicTopicSource) => s.kind === 'UNDERSTANDING' || (s.kind === 'CONVERSATION' && s.includeQandeelReplies);
  const itemsOf = (row: Row): PublicTopicItem[] => {
    const out: Omit<PublicTopicItem, 'position'>[] = [];
    if (row.text.trim().length > 0) out.push({ role: 'WRITTEN', message: null, emphasized: false, gapBefore: false, text: row.text.trim(), sessionPosition: null });
    const s = row.source;
    if (s.kind === 'UNDERSTANDING') out.push({ role: 'QANDEEL_UNDERSTANDING', message: null, emphasized: false, gapBefore: false, text: 'قد يكون الانتقال صعبًا عليك.', sessionPosition: null });
    if (s.kind === 'CONVERSATION') {
      const first = (m: number) => units.find((u) => u.message === m)!.sp;
      const kept = units.filter((u) => u.sp >= s.firstPosition && u.sp <= s.lastPosition && !s.excludedMessagePositions.includes(first(u.message))
        && (s.includeQandeelReplies || u.role === 'USER'));
      const ordinals = [...new Set(kept.map((u) => u.message))];
      let previous: number | null = null;
      for (const u of kept) {
        out.push({ role: u.role === 'USER' ? 'YOUR_MESSAGE' : 'QANDEEL_REPLY', message: ordinals.indexOf(u.message) + 1,
          emphasized: s.emphasizedMessagePositions.includes(first(u.message)), gapBefore: previous !== null && previous !== u.sp - 1, text: u.text, sessionPosition: u.sp });
        previous = u.sp;
      }
    }
    return out.map((item, n) => ({ ...item, position: n + 1 }));
  };
  const readinessOf = (row: Row): PublicTopicPreview['readiness'] => {
    if (row.title.trim().length < 8) return 'TITLE_TOO_SHORT';
    if (row.section === null) return 'SECTION_REQUIRED';
    if (row.source.kind === 'NONE' && row.text.trim().length === 0) return 'TEXT_REQUIRED';
    if (qandeel(row.source) && row.acknowledgedAt !== row.revision) return 'ACKNOWLEDGEMENT_REQUIRED';
    return 'READY';
  };
  const base = {
    drafts: jest.fn(async () => yes([...rows.values()].map((d) => ({ draftId: d.draftId, revision: d.revision, title: d.title, section: d.section,
      textLength: d.text.length, state: d.state, experienceId: d.experienceId, updatedAt: 't' })))),
    draft: jest.fn(async (draftId: string) => {
      const d = rows.get(draftId);
      return yes(d ? { kind: 'DRAFT' as const, draft: { draftId, revision: d.revision, title: d.title, text: d.text, section: d.section, state: d.state, experienceId: d.experienceId } }
        : { kind: 'ABSENT' as const });
    }),
    save: jest.fn(async (draftId: string, expected: number, title: string, text: string, section: PublicTopicSection | null) => {
      const d = rows.get(draftId);
      if (!d || expected !== d.revision) return yes({ outcome: 'STALE' as const, revision: d?.revision ?? null });
      rows.set(draftId, { ...d, title, text, section, revision: d.revision + 1 });
      return yes({ outcome: 'SAVED' as const, revision: d.revision + 1 });
    }),
    remove: jest.fn(async () => yes('DELETED' as const)),
    preview: jest.fn(async (draftId: string) => {
      const d = rows.get(draftId)!;
      return yes({ kind: 'PREVIEW' as const, preview: { revision: d.revision, readiness: readinessOf(d), title: d.title.trim(), text: d.text.trim(), section: d.section,
        publisher: { mode: 'PSEUDONYM' as const, label: 'nightlamp27' }, privacyNotes: [] } });
    }),
    prepare: jest.fn(async () => yes('PUBLICATION_NOT_OPEN' as const)),
    discard: jest.fn(async () => yes('DISCARDED' as const)),
  };
  const put = (draftId: string, expected: number, source: PublicTopicSource) => {
    const d = rows.get(draftId);
    if (!d) {
      if (expected !== 0) return { outcome: 'NOT_FOUND' as const, revision: null };
      rows.set(draftId, { draftId, revision: 1, title: '', text: '', section: null, state: 'EDITING', experienceId: null, source, acknowledgedAt: null });
      return { outcome: 'CREATED' as const, revision: 1 };
    }
    if (expected !== d.revision) return { outcome: 'STALE' as const, revision: d.revision };
    rows.set(draftId, { ...d, source, revision: d.revision + 1 });
    return { outcome: 'SAVED' as const, revision: d.revision + 1 };
  };
  const sources = {
    setConversationSource: jest.fn(async (draftId: string, expected: number, choice: PublicTopicConversationChoice) =>
      yes(put(draftId, expected, { kind: 'CONVERSATION', ...choice }))),
    setUnderstandingSource: jest.fn(async (ref: string, revision: string, draftId: string, expected: number) =>
      yes(revision === REV ? put(draftId, expected, { kind: 'UNDERSTANDING', ref, revision }) : { outcome: 'CHANGED' as const, revision: null })),
    clearSource: jest.fn(async (draftId: string, expected: number) => yes(put(draftId, expected, { kind: 'NONE' }))),
    acknowledgeSource: jest.fn(async (draftId: string, revision: number) => {
      const d = rows.get(draftId)!;
      if (d.revision !== revision) return yes('STALE' as const);
      rows.set(draftId, { ...d, acknowledgedAt: revision });
      return yes('ACKNOWLEDGED' as const);
    }),
    source: jest.fn(async (draftId: string) => {
      const d = rows.get(draftId);
      return yes(d ? { kind: 'SOURCE' as const, revision: d.revision, source: d.source, acknowledged: d.acknowledgedAt === d.revision } : { kind: 'ABSENT' as const });
    }),
    items: jest.fn(async (draftId: string, page: number) => {
      const d = rows.get(draftId)!;
      const all = itemsOf(d);
      const pageCount = Math.max(1, Math.ceil(all.length / 50));
      return yes({ kind: 'PAGE' as const, page: { state: d.state, revision: d.revision, outcome: 'RESOLVED' as const, itemCount: all.length, page, pageCount,
        items: all.slice((page - 1) * 50, page * 50) } });
    }),
  };
  return { ...base, ...sources, rows, itemsOf };
}

const appearance = () => {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
};

async function mount(language: 'ar' | 'en', t: ReturnType<typeof account>) {
  let n = 100;
  const compose = createPublicComposeController({ transport: t as unknown as PublicComposeTransport, isCurrent: () => true, newId: () => id(n++),
    sources: t as unknown as PublicComposeSourceTransport });
  const controller = createPublicWorldController({ transport: { entry: jest.fn(async () => ({ kind: 'ALLOW' as const })) }, isCurrent: () => true, compose });
  const view = await render(<AppearanceProvider authority={appearance()}><PublicWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
  for (let k = 0; k < 4; k += 1) await flush();
  return { view, compose };
}

async function settle() {
  for (let k = 0; k < 6; k += 1) await flush();
}

const choice = (over: Partial<PublicTopicConversationChoice> = {}): PublicTopicConversationChoice => ({
  sessionId: SESSION, firstPosition: 1, lastPosition: 12, includeQandeelReplies: true, excludedMessagePositions: [], emphasizedMessagePositions: [], ...over,
});

afterEach(cleanup);

describe.each(['ar', 'en'] as const)('S8A-05 CP2 %s — a topic made from the conversation', (language) => {
  const words = publicSourceCopy(language);
  const compose = publicComposeCopy(language);

  it('creates a private draft holding the reference, names its material, previews its speakers and gaps, and asks ONE acknowledgement before preparing', async () => {
    const t = account(conversationOf(6, 2));
    const { view, compose: c } = await mount(language, t);
    // Messages 1..6 (units 1..12); message 4 (units 7-8) left out.
    let created: Awaited<ReturnType<typeof c.createFromSource>> | null = null;
    await act(async () => { created = await c.createFromSource({ kind: 'CONVERSATION', choice: choice({ excludedMessagePositions: [7] }) }); });
    expect(created).toEqual({ kind: 'CREATED', draftId: id(100) });
    expect(t.setConversationSource).toHaveBeenCalledWith(id(100), 0, choice({ excludedMessagePositions: [7] }));
    await act(async () => { c.openDraft(id(100)); });
    await settle();
    expect(view.getByTestId('qandeel-public-compose-source-conversation').props.children).toBe(words.sourceConversation);
    await fireEvent.changeText(view.getByTestId('qandeel-public-compose-title'), TITLE);
    await fireEvent.press(view.getByTestId('qandeel-public-compose-section-life_changes'));
    await fireEvent.press(view.getByTestId('qandeel-public-compose-preview'));
    await settle();

    const list = view.getByTestId('qandeel-public-compose-items');
    const speakers = within(list).getAllByTestId('qandeel-public-compose-items-speaker').map((n) => n.props.children);
    expect(speakers).toEqual(['nightlamp27', words.speakerQandeel, 'nightlamp27', 'nightlamp27', words.speakerQandeel]);
    expect(within(list).getAllByTestId('qandeel-public-compose-items-gap')).toHaveLength(1);
    expect(within(list).getAllByTestId('qandeel-public-compose-items-gap')[0].props.accessibilityLabel).toBe(words.gap);
    expect(within(list).getAllByTestId('qandeel-public-compose-items-text').map((n) => n.props.children))
      .toEqual(['m1u1', 'm1u2', 'm2u1', 'm2u2', 'm3u1', 'm3u2', 'm5u1', 'm5u2', 'm6u1', 'm6u2']);
    // QANDEEL's words are in: the warning, the Product Owner's acknowledgement, and no Prepare until it is given.
    expect(view.getByTestId('qandeel-public-compose-acknowledgement-text').props.children).toBe(words.acknowledgement);
    expect(view.queryByTestId('qandeel-public-compose-prepare')).toBeNull();
    await fireEvent.press(view.getByTestId('qandeel-public-compose-acknowledge'));
    await settle();
    expect(t.acknowledgeSource).toHaveBeenCalledWith(id(100), t.rows.get(id(100))!.revision);
    expect(view.getByTestId('qandeel-public-compose-acknowledged').props.children).toBe(words.acknowledged);
    await fireEvent.press(view.getByTestId('qandeel-public-compose-prepare'));
    await settle();
    expect(t.prepare).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('qandeel-public-compose-notice').props.children).toContain(compose.notOpen);
  });

  it('a long conversation is read 50 items a page and every item is reached; nothing is dropped', async () => {
    const units = conversationOf(60, 2);
    const t = account(units);
    const { view, compose: c } = await mount(language, t);
    await act(async () => { await c.createFromSource({ kind: 'CONVERSATION', choice: choice({ lastPosition: 120, includeQandeelReplies: false }) }); });
    await act(async () => { c.openDraft(id(100)); });
    await settle();
    await fireEvent.changeText(view.getByTestId('qandeel-public-compose-title'), TITLE);
    await fireEvent.press(view.getByTestId('qandeel-public-compose-section-life_changes'));
    await fireEvent.press(view.getByTestId('qandeel-public-compose-preview'));
    await settle();
    // Only the reader's own words: no acknowledgement is asked, and Prepare is offered.
    expect(view.queryByTestId('qandeel-public-compose-acknowledgement')).toBeNull();
    expect(view.getByTestId('qandeel-public-compose-prepare')).toBeTruthy();
    const seen: string[] = [];
    for (let page = 1; page <= 2; page += 1) {
      const list = view.getByTestId('qandeel-public-compose-items');
      expect(within(list).getByTestId('qandeel-public-compose-items-page').props.children).toBe(words.pageOf(page, 2));
      seen.push(...within(list).getAllByTestId('qandeel-public-compose-items-text').map((n) => n.props.children as string));
      if (page < 2) {
        expect(within(list).getByTestId('qandeel-public-compose-items-next').props.accessibilityLabel).toBe(words.next);
        await fireEvent.press(within(list).getByTestId('qandeel-public-compose-items-next'));
        await settle();
      }
    }
    expect(seen).toEqual(units.filter((u) => u.role === 'USER').map((u) => u.text));
    expect(within(view.getByTestId('qandeel-public-compose-items')).getByTestId('qandeel-public-compose-items-previous')).toBeTruthy();
  });

  it('emphasizes a whole message by its first position, and removing the material keeps the draft and its words', async () => {
    const t = account(conversationOf(4, 2));
    const { view, compose: c } = await mount(language, t);
    await act(async () => { await c.createFromSource({ kind: 'CONVERSATION', choice: choice({ lastPosition: 8 }) }); });
    await act(async () => { c.openDraft(id(100)); });
    await settle();
    await fireEvent.changeText(view.getByTestId('qandeel-public-compose-title'), TITLE);
    await fireEvent.press(view.getByTestId('qandeel-public-compose-section-life_changes'));
    await fireEvent.press(view.getByTestId('qandeel-public-compose-preview'));
    await settle();
    const toggles = within(view.getByTestId('qandeel-public-compose-items')).getAllByTestId('qandeel-public-compose-items-emphasis');
    expect(toggles).toHaveLength(4);
    expect(toggles[1].props.accessibilityLabel).toBe(words.emphasize);
    await fireEvent.press(toggles[1]);
    await settle();
    expect(t.setConversationSource).toHaveBeenLastCalledWith(id(100), expect.any(Number), choice({ lastPosition: 8, emphasizedMessagePositions: [3] }));
    const list = view.getByTestId('qandeel-public-compose-items');
    expect(within(list).getAllByTestId('qandeel-public-compose-items-emphasized').map((n) => n.props.children)).toEqual(['m2u1', 'm2u2']);
    expect(within(list).getAllByTestId('qandeel-public-compose-items-emphasized')[0].props.accessibilityLabel).toContain(words.emphasized);
    // The emphasis changed the revision: the acknowledgement is asked again for it.
    expect(view.getByTestId('qandeel-public-compose-acknowledge')).toBeTruthy();

    await fireEvent.press(view.getByTestId('qandeel-public-compose-back'));
    await settle();
    expect(view.getByTestId('qandeel-public-compose-clear-source').props.accessibilityLabel).toBe(words.clearSource);
    await fireEvent.press(view.getByTestId('qandeel-public-compose-clear-source'));
    await settle();
    expect(t.rows.get(id(100))!.source).toEqual({ kind: 'NONE' });
    expect(t.rows.get(id(100))!.title).toBe(TITLE);
    expect(view.queryByTestId('qandeel-public-compose-source')).toBeNull();
  });
});

describe.each(['ar', 'en'] as const)('S8A-05 CP2 %s — a topic made from «فهم قنديل»', (language) => {
  const words = publicSourceCopy(language);

  it('labels the shown summary as an unconfirmed inference, asks the acknowledgement, and refuses a changed item without a draft', async () => {
    const t = account([]);
    const { view, compose: c } = await mount(language, t);
    let refused: unknown = null;
    await act(async () => { refused = await c.createFromSource({ kind: 'UNDERSTANDING', ref: REF, revision: 'c'.repeat(22) }); });
    expect(refused).toEqual({ kind: 'REFUSED', outcome: 'CHANGED' });
    expect(t.rows.size).toBe(0);
    await act(async () => { await c.createFromSource({ kind: 'UNDERSTANDING', ref: REF, revision: REV }); });
    expect(t.setUnderstandingSource).toHaveBeenLastCalledWith(REF, REV, id(101), 0);
    await act(async () => { c.openDraft(id(101)); });
    await settle();
    expect(view.getByTestId('qandeel-public-compose-source-understanding').props.children).toBe(words.sourceUnderstanding);
    await fireEvent.changeText(view.getByTestId('qandeel-public-compose-title'), TITLE);
    await fireEvent.press(view.getByTestId('qandeel-public-compose-section-life_changes'));
    await fireEvent.press(view.getByTestId('qandeel-public-compose-preview'));
    await settle();
    const list = view.getByTestId('qandeel-public-compose-items');
    expect(within(list).getAllByTestId('qandeel-public-compose-items-speaker').map((n) => n.props.children)).toEqual([words.understandingLabel]);
    expect(within(list).queryAllByTestId('qandeel-public-compose-items-emphasis')).toHaveLength(0);
    expect(view.getByTestId('qandeel-public-compose-acknowledge')).toBeTruthy();
  });
});

describe('S8A-05 CP2 — the Copy Gate', () => {
  it('the gate is CLOSED: the 37 new rows APPROVED in both languages; only earlier approvals are reused; the owner’s Arabic is verbatim', () => {
    for (const [key, row] of Object.entries(PUBLIC_SOURCE_COPY_ROWS)) {
      expect([key, row.status, row.enStatus]).toEqual([key, 'APPROVED', 'APPROVED']);
      if (PUBLIC_SOURCE_COPY_GATE.reused.includes(key)) expect(row.source).not.toMatch(/S8A-05 CP2/u);
      else expect(row.source).toMatch(/S8A-05 CP2 Product Copy Gate — APPROVED verbatim, Arabic and English \(Product Owner, 2026-10-27\)/u);
    }
    expect(PUBLIC_SOURCE_COPY_GATE.reused).toEqual(['shareWhole', 'shareCancel']);
    expect(PUBLIC_SOURCE_COPY_GATE.approved).toHaveLength(37);
    expect([PUBLIC_SOURCE_COPY_GATE.proposed, PUBLIC_SOURCE_COPY_GATE.englishProposed]).toEqual([[], []]);
    expect(PUBLIC_SOURCE_COPY_GATE.status).toMatch(/CLOSED \/ APPROVED/u);
    expect(PUBLIC_SOURCE_COPY_ROWS.shareEntry.ar).toBe('شارك في العالم العام');
    expect(PUBLIC_SOURCE_COPY_ROWS.understandingLabel.ar).toBe('فهم قنديل — استنتاج غير مؤكد، ليس حقيقة');
    expect(PUBLIC_SOURCE_COPY_ROWS.acknowledgement.ar).toBe('كلام قنديل قد يصف أشخاصًا آخرين؛ نشره قرارك');
    // No word says the topic IS published, and no engineering term reaches the reader.
    for (const row of Object.values(PUBLIC_SOURCE_COPY_ROWS)) {
      expect(row.en).not.toMatch(/\bpublished\b|session|position|sp\b|revision|token|hypothes|memory|evidence|score/iu);
      expect(row.ar).not.toMatch(/نُشر|تم النشر/u);
    }
  });
});
