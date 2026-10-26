/**
 * S8A-05 CP1 — «اكتب موضوعك» / Write your topic inside the Public World root: the entry only after ALLOW, the private
 * account-bound draft (read back from another session of the same account, compare-and-set, deleted with its words), the
 * preview equal to what was saved with its privacy notes, «تجهيز للنشر» answering honestly that publishing is not open,
 * the way back to the draft from a prepared topic, the strict client, the human title in the field, and the Copy Gate.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { PublicWorldArea } from '../../public-world/PublicWorldArea';
import { createPublicWorldController } from '../../public-world/public-world-controller';
import type {
  PublicAuthoringAnswer, PublicTopicDraft, PublicTopicDraftSummary, PublicTopicPrepareOutcome, PublicTopicPreview, PublicTopicPrivacyNote, PublicTopicSection,
} from '../../runtime-entry';
import { PublicWorldApiClient, publicEntryLabel } from '../../runtime-entry';
import { PUBLIC_COMPOSE_COPY_GATE, PUBLIC_COMPOSE_COPY_ROWS, PUBLIC_SECTION_COPY_ROWS, publicComposeCopy } from '../copy';
import { createPublicComposeController, type PublicComposeTransport } from '../public-compose-controller';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const INSETS = { top: 44, right: 0, bottom: 0, left: 0 };
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const yes = <T,>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });
const TITLE = 'كيف أبدأ من جديد بعد الانتقال';
const TEXT = 'انتقلت إلى مدينة جديدة ولا أعرف أحدًا.\nأريد أن أسمع ممن مرّ بهذا.';

/** One account's drafts, as the server holds them: every session of the account reads the same rows. */
function account(opts: { prepare?: PublicTopicPrepareOutcome; notes?: PublicTopicPrivacyNote[] } = {}) {
  const rows = new Map<string, PublicTopicDraft & { readonly updatedAt: string }>();
  const readinessOf = (d: PublicTopicDraft) => (d.title.trim().length < 8 ? 'TITLE_TOO_SHORT' as const : d.text.trim().length === 0 ? 'TEXT_REQUIRED' as const
    : d.section === null ? 'SECTION_REQUIRED' as const : 'READY' as const);
  const t = {
    drafts: jest.fn(async () => yes<readonly PublicTopicDraftSummary[]>([...rows.values()].map((d) => ({ draftId: d.draftId, revision: d.revision, title: d.title,
      section: d.section, textLength: d.text.length, state: d.state, experienceId: d.experienceId, updatedAt: d.updatedAt })))),
    draft: jest.fn(async (draftId: string) => {
      const d = rows.get(draftId);
      return yes(d ? { kind: 'DRAFT' as const, draft: { draftId, revision: d.revision, title: d.title, text: d.text, section: d.section, state: d.state, experienceId: d.experienceId } }
        : { kind: 'ABSENT' as const });
    }),
    save: jest.fn(async (draftId: string, expected: number, title: string, text: string, section: PublicTopicSection | null) => {
      const d = rows.get(draftId);
      if (!d) {
        if (expected !== 0) return yes({ outcome: 'NOT_FOUND' as const, revision: null });
        rows.set(draftId, { draftId, revision: 1, title, text, section, state: 'EDITING', experienceId: null, updatedAt: 't1' });
        return yes({ outcome: 'CREATED' as const, revision: 1 });
      }
      if (d.state === 'PREPARED') return yes({ outcome: 'PREPARED' as const, revision: d.revision });
      if (expected !== d.revision) return yes({ outcome: 'STALE' as const, revision: d.revision });
      rows.set(draftId, { ...d, title, text, section, revision: d.revision + 1, updatedAt: 't2' });
      return yes({ outcome: 'SAVED' as const, revision: d.revision + 1 });
    }),
    remove: jest.fn(async (draftId: string) => (rows.delete(draftId) ? yes('DELETED' as const) : yes('NOT_FOUND' as const))),
    preview: jest.fn(async (draftId: string) => {
      const d = rows.get(draftId);
      if (!d) return yes({ kind: 'ABSENT' as const });
      const preview: PublicTopicPreview = { revision: d.revision, readiness: readinessOf(d), title: d.title.trim(), text: d.text.trim(), section: d.section,
        publisher: { mode: 'PSEUDONYM', label: 'nightlamp27' }, privacyNotes: opts.notes ?? [] };
      return yes({ kind: 'PREVIEW' as const, preview });
    }),
    prepare: jest.fn(async (draftId: string) => {
      const outcome = opts.prepare ?? 'PUBLICATION_NOT_OPEN';
      const d = rows.get(draftId);
      if (outcome === 'PREPARED' && d) rows.set(draftId, { ...d, state: 'PREPARED', experienceId: id(77) });
      return yes(outcome);
    }),
    discard: jest.fn(async (experienceId: string) => {
      for (const [key, d] of rows) if (d.experienceId === experienceId) rows.set(key, { ...d, state: 'EDITING', experienceId: null, revision: d.revision + 1 });
      return yes('DISCARDED' as const);
    }),
    rows,
  };
  return t;
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
const ids = () => { let n = 100; return () => id(n++); };

async function mount(language: 'ar' | 'en', t: ReturnType<typeof account>, entry: 'ALLOW' | 'DENIED' = 'ALLOW') {
  const compose = createPublicComposeController({ transport: t as unknown as PublicComposeTransport, isCurrent: () => true, newId: ids() });
  const controller = createPublicWorldController({ transport: { entry: jest.fn(async () => ({ kind: entry })) }, isCurrent: () => true, compose });
  const view = await render(<AppearanceProvider authority={appearance()}><PublicWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
  for (let n = 0; n < 4; n += 1) await flush();
  return { view, compose };
}

afterEach(cleanup);

describe('S8A-05 CP1 — the entry lives inside the Public World root', () => {
  it('is drawn only after ALLOW', async () => {
    const denied = await mount('ar', account(), 'DENIED');
    expect(denied.view.queryByTestId('qandeel-public-compose-entry')).toBeNull();
    await cleanup();
    const allowed = await mount('ar', account());
    expect(allowed.view.getByTestId('qandeel-public-compose-entry').props.accessibilityLabel).toBe(publicComposeCopy('ar').entry);
  });
});

describe.each(['ar', 'en'] as const)('S8A-05 CP1 %s — writing a topic', (language) => {
  const words = publicComposeCopy(language);

  it('writes a private draft, reads it back from another session of the same account, and edits it by compare-and-set', async () => {
    const t = account();
    const { view } = await mount(language, t);
    await fireEvent.press(view.getByTestId('qandeel-public-compose-entry'));
    await flush();
    expect(view.getByTestId('qandeel-public-compose-no-drafts').props.children).toBe(words.noDrafts);
    await fireEvent.press(view.getByTestId('qandeel-public-compose-new'));
    expect(view.getByTestId('qandeel-public-compose-private').props.children).toBe(words.privateNote);
    await fireEvent.changeText(view.getByTestId('qandeel-public-compose-title'), TITLE);
    await fireEvent.changeText(view.getByTestId('qandeel-public-compose-text'), TEXT);
    await fireEvent.press(view.getByTestId('qandeel-public-compose-section-life_changes'));
    expect(view.getByTestId('qandeel-public-compose-section-life_changes').props.accessibilityState.checked).toBe(true);
    await fireEvent.press(view.getByTestId('qandeel-public-compose-save'));
    await flush();
    expect(t.save).toHaveBeenCalledWith(id(100), 0, TITLE, TEXT, 'life_changes');
    expect(view.getByTestId('qandeel-public-compose-notice').props.children).toBe(words.saved);

    // Another session of the same account: the draft is there, whole.
    const other = createPublicComposeController({ transport: t as unknown as PublicComposeTransport, isCurrent: () => true, newId: ids() });
    other.open();
    await flush();
    expect(other.getState().drafts.map((d) => d.title)).toEqual([TITLE]);
    other.openDraft(id(100));
    await flush();
    expect(other.getState().draft).toMatchObject({ title: TITLE, text: TEXT, section: 'life_changes', revision: 1 });
    // It edits there first; this session's next save is STALE and reloads, never overwriting.
    other.setText(`${TEXT}\nإضافة.`);
    other.save();
    await flush();
    await fireEvent.changeText(view.getByTestId('qandeel-public-compose-title'), `${TITLE} الآن`);
    await fireEvent.press(view.getByTestId('qandeel-public-compose-save'));
    await flush();
    await flush();
    expect(view.getByTestId('qandeel-public-compose-notice').props.children).toBe(words.stale);
    expect(t.rows.get(id(100))).toMatchObject({ title: TITLE, text: `${TEXT}\nإضافة.`, revision: 2 });
    expect(view.getByTestId('qandeel-public-compose-text').props.value).toBe(`${TEXT}\nإضافة.`);
  });

  it('previews exactly what was saved, with the warning and privacy notes; preparing is not open and the draft stays', async () => {
    const t = account({ notes: ['CONTACT_NUMBER', 'SHOWN_UNDER_REAL_NAME'] });
    const { view, compose } = await mount(language, t);
    await act(async () => { compose.open(); });
    await flush();
    await act(async () => { compose.newDraft(); compose.setTitle(TITLE); compose.setText(TEXT); compose.setSection('family'); });
    await fireEvent.press(view.getByTestId('qandeel-public-compose-preview'));
    await flush();
    await flush();
    // The preview saved first, so it shows exactly the account's words.
    expect(t.save).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('qandeel-public-compose-preview-title').props.children).toBe(TITLE);
    expect(view.getByTestId('qandeel-public-compose-preview-text').props.children).toBe(TEXT);
    expect(view.getByTestId('qandeel-public-compose-preview-section').props.children).toBe(words.section('family'));
    expect(view.getByTestId('qandeel-public-compose-public-warning').props.children).toBe(words.publicWarning);
    expect(view.getByTestId('qandeel-public-compose-note-CONTACT_NUMBER').props.children).toBe(words.note('CONTACT_NUMBER'));
    expect(view.getByTestId('qandeel-public-compose-note-SHOWN_UNDER_REAL_NAME').props.children).toBe(words.note('SHOWN_UNDER_REAL_NAME'));
    await fireEvent.press(view.getByTestId('qandeel-public-compose-prepare'));
    await flush();
    expect(t.prepare).toHaveBeenCalledWith(id(100), id(101), 1);
    expect(view.getByTestId('qandeel-public-compose-notice').props.children).toBe(words.notOpen);
    expect(t.rows.get(id(100))).toMatchObject({ state: 'EDITING', title: TITLE });
  });

  it('a prepared topic says it is not published and goes back to its draft; deleting asks once more and erases the draft', async () => {
    const t = account({ prepare: 'PREPARED' });
    const { view, compose } = await mount(language, t);
    await act(async () => { compose.open(); });
    await flush();
    await act(async () => { compose.newDraft(); compose.setTitle(TITLE); compose.setText(TEXT); compose.setSection('open'); });
    await act(async () => { compose.showPreview(); });
    await flush();
    await flush();
    await fireEvent.press(view.getByTestId('qandeel-public-compose-prepare'));
    await flush();
    await flush();
    expect(view.getByTestId('qandeel-public-compose-prepared-state').props.children).toBe(words.preparedState);
    await fireEvent.press(view.getByTestId('qandeel-public-compose-back-to-draft'));
    await flush();
    await flush();
    expect(t.discard).toHaveBeenCalledWith(id(77), expect.any(String));
    expect(view.getByTestId('qandeel-public-compose-editor')).toBeTruthy();
    await fireEvent.press(view.getByTestId('qandeel-public-compose-delete'));
    expect(t.remove).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('qandeel-public-compose-delete-confirmed'));
    await flush();
    await flush();
    expect(t.remove).toHaveBeenCalledWith(id(100), expect.any(String));
    expect(t.rows.size).toBe(0);
    expect(view.getByTestId('qandeel-public-compose-notice').props.children).toBe(words.deleted);
  });

  it('leaving with unsaved words saves them first', async () => {
    const t = account();
    const { view, compose } = await mount(language, t);
    await act(async () => { compose.open(); });
    await flush();
    await act(async () => { compose.newDraft(); compose.setTitle('مسودة قصيرة'); });
    await fireEvent.press(view.getByTestId('qandeel-public-compose-back'));
    await flush();
    await flush();
    expect(t.rows.get(id(100))?.title).toBe('مسودة قصيرة');
    expect(view.getByTestId('qandeel-public-compose-list')).toBeTruthy();
  });
});

describe('S8A-05 CP1 — the strict client', () => {
  const client = (body: unknown, status = 200) => {
    const fetch = jest.fn(async () => ({ ok: status === 200, status, json: async () => body }));
    // Reached only through the Public World transport, as every consumer reaches it (T-12P: the barrel, nothing deeper).
    return { api: new PublicWorldApiClient({ baseUrl: 'https://api', fetch: fetch as never }).compose, fetch };
  };

  it('sends the draft to its own route and nothing else', async () => {
    const { api, fetch } = client({ outcome: 'CREATED', revision: 1 });
    await expect(api.save(id(1), 0, TITLE, TEXT, 'love')).resolves.toEqual(yes({ outcome: 'CREATED', revision: 1 }));
    expect(fetch).toHaveBeenCalledWith(`https://api/public/compose/drafts/${id(1)}`, expect.objectContaining({ method: 'PUT',
      body: JSON.stringify({ expectedRevision: 0, title: TITLE, text: TEXT, section: 'love' }) }));
  });

  it('refuses any answer it does not know', async () => {
    await expect(client({ outcome: 'PUBLISHED', experienceId: null }).api.prepare(id(1), id(2), 1)).resolves.toEqual({ kind: 'NO_ANSWER' });
    await expect(client({ outcome: 'SAVED', revision: 0 }).api.save(id(1), 1, 'a', 'b', null)).resolves.toEqual({ kind: 'NO_ANSWER' });
    await expect(client({ drafts: [{ draftId: id(1) }] }).api.drafts()).resolves.toEqual({ kind: 'NO_ANSWER' });
    await expect(client({ state: 'CURRENT', revision: 1, readiness: 'READY', title: 't', text: 'x', section: 'politics',
      publisher: { mode: 'PSEUDONYM', label: 'p' }, privacyNotes: [] }).api.preview(id(1))).resolves.toEqual({ kind: 'NO_ANSWER' });
    await expect(client({ outcome: 'PUBLICATION_NOT_OPEN', experienceId: null }).api.prepare(id(1), id(2), 1)).resolves.toEqual(yes('PUBLICATION_NOT_OPEN'));
    await expect(client({}, 503).api.drafts()).resolves.toEqual({ kind: 'NO_ANSWER' });
    await expect(client({ state: 'UNAVAILABLE' }).api.draft(id(1))).resolves.toEqual(yes({ kind: 'ABSENT' }));
  });

  it('rides the same identity-bound Public transport', async () => {
    const { api, fetch } = client({ drafts: [] });
    await expect(api.drafts()).resolves.toEqual(yes([]));
    expect(fetch).toHaveBeenCalledWith('https://api/public/compose/drafts', expect.anything());
  });
});

describe('S8A-05 CP1 — the human title in the field', () => {
  const field = (entries: unknown[]) => {
    const fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ experiences: entries }) }));
    return new PublicWorldApiClient({ baseUrl: 'https://api', fetch: fetch as never }).field;
  };
  const rect = { minX: 0n, minY: 0n, maxX: 9n, maxY: 9n };

  it('shows a titled topic by its title and an untitled Experience by its meaning', async () => {
    const answer = await field([
      { id: id(1), x: '1', y: '1', meaning: 'QANDEEL meaning', region: 'r.1', title: TITLE, section: 'life_changes' },
      { id: id(2), x: '2', y: '2', meaning: 'an older meaning', region: 'r.2' },
    ]).field(rect);
    if (answer.kind !== 'ANSWER') throw new Error('no answer');
    expect(answer.value.map(publicEntryLabel)).toEqual([TITLE, 'an older meaning']);
    expect(answer.value[0].section).toBe('life_changes');
    expect(answer.value[1]).not.toHaveProperty('title');
  });

  it('refuses an entry with an unknown section, an empty title or any other key', async () => {
    for (const extra of [{ title: TITLE, section: 'news' }, { title: '' }, { title: TITLE, rank: 1 }, { section: 'love' }]) {
      await expect(field([{ id: id(1), x: '1', y: '1', meaning: 'm', region: 'r', ...extra }]).field(rect)).resolves.toEqual({ kind: 'NO_ANSWER' });
    }
  });
});

describe('S8A-05 CP1 — the Copy Gate', () => {
  it('is open: every new row PROPOSED in both languages, reused rows approved, thirteen sections in order', () => {
    expect(PUBLIC_COMPOSE_COPY_GATE.status).toMatch(/OPEN/u);
    expect(PUBLIC_COMPOSE_COPY_GATE.approved.sort()).toEqual(['actionUnavailable', 'back', 'retry', 'save']);
    expect(PUBLIC_COMPOSE_COPY_GATE.proposed).toHaveLength(Object.keys(PUBLIC_COMPOSE_COPY_ROWS).length - 4 + 13);
    expect(Object.keys(PUBLIC_SECTION_COPY_ROWS)).toEqual(['love', 'marriage', 'family', 'parenting', 'people', 'work_money', 'study_future', 'inner_self',
      'health_body', 'loss_crisis', 'faith_meaning', 'life_changes', 'open']);
    expect(PUBLIC_SECTION_COPY_ROWS.open.ar).toBe('حكايات مفتوحة');
  });

  it('never says the topic is published, and suggests nothing', () => {
    for (const row of Object.values(PUBLIC_COMPOSE_COPY_ROWS)) {
      expect(row.en).not.toMatch(/\bpublished\b(?!,| yet)|QANDEEL suggests/iu);
      expect(row.ar).not.toMatch(/تم النشر|نُشر الموضوع/u);
    }
  });
});
