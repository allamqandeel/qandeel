/**
 * S8A-05 CP2 — a served topic's content in its panel, in Arabic and English: a topic made from its author's conversation
 * names its speakers to a READER («صاحب الموضوع», «قنديل», QANDEEL's unconfirmed understanding), shows its emphasis and
 * gaps, and is read 50 items a page, every page reached and none kept (a new panel read reads the shown page again);
 * content without sealed speakers (before CP2) is drawn exactly as before.
 */
import { act, cleanup, fireEvent, render, within } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../../appearance';
import { publicSourceCopy } from '../../../public-compose/source-copy';
import type { PublicFieldContentItem, PublicFieldContentPage, PublicFieldExperience } from '../../../runtime-entry';
import { usePalette } from '../../../conversation';
import { publicFieldCopy } from '../field-copy';
import { PublicTopicContent } from '../PublicTopicContent';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const EXPERIENCE = '00000000-0000-4000-8000-000000000077';

const spoken = (ordinal: number, over: Partial<PublicFieldContentItem> = {}): PublicFieldContentItem => ({
  ordinal, kind: 'SOURCE_CONTENT', text: `t${ordinal}`, role: 'YOUR_MESSAGE', message: Math.ceil(ordinal / 2), emphasized: false, gapBefore: false, ...over,
});
const experienceOf = (content: PublicFieldContentItem[], pages?: { itemCount: number; pageCount: number }) =>
  ({ entry: { id: EXPERIENCE }, publisher: { label: null }, content, ...(pages ? { contentPages: pages } : {}) }) as unknown as PublicFieldExperience;

const appearance = () => {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
};

function Host({ experience, language, readPage }: {
  readonly experience: PublicFieldExperience; readonly language: 'ar' | 'en';
  readonly readPage: ((id: string, page: number) => Promise<PublicFieldContentPage | 'ABSENT' | 'UNAVAILABLE'>) | null;
}) {
  const palette = usePalette();
  return <PublicTopicContent experience={experience} copy={publicFieldCopy(language)} palette={palette} language={language} readPage={readPage} />;
}

const mount = async (experience: PublicFieldExperience, language: 'ar' | 'en', readPage: Parameters<typeof Host>[0]['readPage']) => {
  const authority = appearance();
  const view = await render(<AppearanceProvider authority={authority}><Host experience={experience} language={language} readPage={readPage} /></AppearanceProvider>);
  await flush();
  return { view, rerender: (next: PublicFieldExperience) => view.rerender(<AppearanceProvider authority={authority}><Host experience={next} language={language} readPage={readPage} /></AppearanceProvider>) };
};

afterEach(cleanup);

describe.each(['ar', 'en'] as const)('S8A-05 CP2 %s — a reader reads a topic made from a conversation', (language) => {
  const words = publicSourceCopy(language);

  it('names the author by their public name and QANDEEL as «قنديل»', async () => {
    const named = await mount({ ...experienceOf([spoken(1), spoken(2, { kind: 'ANALYSIS', role: 'QANDEEL_REPLY', message: 2 })]), publisher: { label: 'nightlamp27' } } as never,
      language, null);
    expect(within(named.view.getByTestId('qandeel-public-panel-items')).getAllByTestId('qandeel-public-panel-items-speaker').map((n) => n.props.children))
      .toEqual(['nightlamp27', words.speakerQandeel]);
  });

  it('names the author «صاحب الموضوع» when the topic shows no name, with emphasis and gaps', async () => {
    const { view } = await mount(experienceOf([
      spoken(1), spoken(2, { kind: 'ANALYSIS', role: 'QANDEEL_REPLY', message: 2 }), spoken(3, { message: 3, gapBefore: true, emphasized: true }),
      spoken(4, { kind: 'ANALYSIS', role: 'QANDEEL_UNDERSTANDING', message: null }),
    ]), language, null);
    const list = view.getByTestId('qandeel-public-panel-items');
    expect(within(list).getAllByTestId('qandeel-public-panel-items-speaker').map((n) => n.props.children))
      .toEqual([words.speakerAuthor, words.speakerQandeel, words.speakerAuthor, words.understandingLabel]);
    expect(within(list).getAllByTestId('qandeel-public-panel-items-gap')).toHaveLength(1);
    expect(within(list).getByTestId('qandeel-public-panel-items-emphasized').props.children).toBe('t3');
    // A reader cannot change emphasis, and one page has no pager.
    expect(within(list).queryAllByTestId('qandeel-public-panel-items-emphasis')).toHaveLength(0);
    expect(within(list).queryByTestId('qandeel-public-panel-items-pages')).toBeNull();
  });

  it('reads 50 items a page, every page reached, and reads the shown page again on a new panel read', async () => {
    const pageOne = Array.from({ length: 50 }, (_, n) => spoken(n + 1));
    const reads: number[] = [];
    const readPage = jest.fn(async (_id: string, page: number): Promise<PublicFieldContentPage> => {
      reads.push(page);
      return { itemCount: 70, page, pageCount: 2, items: Array.from({ length: 20 }, (_, n) => spoken(51 + n, { text: `p${reads.length}-${51 + n}` })) };
    });
    const first = experienceOf(pageOne, { itemCount: 70, pageCount: 2 });
    const { view, rerender } = await mount(first, language, readPage);
    const list = () => view.getByTestId('qandeel-public-panel-items');
    expect(within(list()).getByTestId('qandeel-public-panel-items-page').props.children).toBe(words.pageOf(1, 2));
    expect(within(list()).getAllByTestId('qandeel-public-panel-items-text')).toHaveLength(50);
    expect(readPage).not.toHaveBeenCalled();
    await fireEvent.press(within(list()).getByTestId('qandeel-public-panel-items-next'));
    await flush();
    expect(readPage).toHaveBeenLastCalledWith(EXPERIENCE, 2);
    expect(within(list()).getByTestId('qandeel-public-panel-items-page').props.children).toBe(words.pageOf(2, 2));
    expect(within(list()).getAllByTestId('qandeel-public-panel-items-text').map((n) => n.props.children)[0]).toBe('p1-51');
    // A new panel read: the shown page is read again, never kept from the older read.
    await act(async () => { rerender(experienceOf(pageOne, { itemCount: 70, pageCount: 2 })); });
    await flush();
    expect(reads).toEqual([2, 2]);
    expect(within(list()).getAllByTestId('qandeel-public-panel-items-text').map((n) => n.props.children)[0]).toBe('p2-51');
    await fireEvent.press(within(list()).getByTestId('qandeel-public-panel-items-previous'));
    await flush();
    expect(within(list()).getAllByTestId('qandeel-public-panel-items-text')).toHaveLength(50);
  });

  it('a page that cannot be read says so; content without speakers is drawn as before', async () => {
    const failing = await mount(experienceOf([spoken(1)], { itemCount: 60, pageCount: 2 }), language, async () => 'UNAVAILABLE');
    await fireEvent.press(failing.view.getByTestId('qandeel-public-panel-items-next'));
    await flush();
    expect(failing.view.getByTestId('qandeel-public-panel-content-unavailable').props.children).toBe(publicFieldCopy(language).fieldUnavailable);
    await cleanup();
    const before = await mount(experienceOf([{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'old words' }, { ordinal: 2, kind: 'ANALYSIS', text: 'old analysis' }]), language, null);
    expect(before.view.queryByTestId('qandeel-public-panel-items')).toBeNull();
    expect(before.view.getByText('old words')).toBeTruthy();
    expect(before.view.getByText(publicFieldCopy(language).analysisItem)).toBeTruthy();
  });
});
