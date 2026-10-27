/**
 * S8A-05 CP2 — «شارك في العالم العام» from a «فهم قنديل» item, in Arabic and English: offered on the detail only while
 * its summary is shown and not under review, it hands the item's opaque ref at the EXACT revision shown; a changed item
 * asks the reader to open it again and nothing opens; without the composition's handler nothing is offered at all.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import { publicComposeCopy } from '../../public-compose/copy';
import { publicSourceCopy } from '../../public-compose/source-copy';
import type { UnderstandingDetailView, UnderstandingItemView } from '../../runtime-entry';
import { UnderstandingSurface, createUnderstandingController, type UnderstandingShareResult } from '..';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const REF = 'AAAAAAAAAAAAAAAAAAAAAA';
const REV = 'rrrrrrrrrrrrrrrrrrrrr1';

const item = (overrides: Partial<UnderstandingItemView> = {}): UnderstandingItemView => ({
  ref: REF, revision: REV, theme: 'WORK', summary: 'You prepare well before big deadlines.', evidenceChange: 'NONE', confidence: 'TAKING_SHAPE', underReview: false, ...overrides,
});
const detail = (base: UnderstandingItemView): UnderstandingDetailView => ({ ...base, evidence: [], contradictions: [], alternatives: [], unresolved: [], evolution: [] });

async function surface(language: ChromeLanguage, shown: UnderstandingItemView, onShare?: (ref: string, revision: string) => Promise<UnderstandingShareResult>) {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({}),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  const transport = {
    readItems: async () => ({ kind: 'READ' as const, items: [shown] }),
    readItem: async () => ({ kind: 'READ' as const, view: detail(shown) }),
    openDiscussion: async () => ({ kind: 'OPENED' as const }),
    closeDiscussion: async () => true,
    disagree: async () => ({ kind: 'UNDER_REVIEW' as const, revision: REV }),
    resolveDisagreement: async () => ({ kind: 'RESOLVED' as const, revision: REV }),
  };
  const controller = createUnderstandingController({ transport: transport as never, isCurrent: () => true });
  const view = await render(
    <AppearanceProvider authority={authority}>
      <UnderstandingSurface controller={controller} language={language} insets={INSETS} onBack={jest.fn()} onTalk={jest.fn()} onShare={onShare} />
    </AppearanceProvider>,
  );
  await flush();
  await act(async () => { controller.openItem(REF); });
  await flush();
  return view;
}

describe.each(['ar', 'en'] as const)('S8A-05 CP2 %s — sharing a «فهم قنديل» item', (language) => {
  const words = publicSourceCopy(language);

  it('hands the opaque ref at the exact revision shown, once', async () => {
    const onShare = jest.fn(async () => 'OPENED' as const);
    const view = await surface(language, item(), onShare);
    const entry = view.getByTestId('qandeel-understanding-share-entry');
    expect(entry.props.accessibilityLabel).toBe(words.shareEntry);
    await fireEvent.press(entry);
    await flush();
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledWith(REF, REV);
    expect(view.queryByTestId('qandeel-understanding-share-changed')).toBeNull();
  });

  it('a changed item asks to open it again; a failure says it did not work', async () => {
    const answers: UnderstandingShareResult[] = ['CHANGED', 'FAILED'];
    const view = await surface(language, item(), async () => answers.shift()!);
    await fireEvent.press(view.getByTestId('qandeel-understanding-share-entry'));
    await flush();
    expect(view.getByTestId('qandeel-understanding-share-changed').props.children).toBe(words.understandingChanged);
    await fireEvent.press(view.getByTestId('qandeel-understanding-share-entry'));
    await flush();
    expect(view.getByTestId('qandeel-understanding-share-failed').props.children).toBe(publicComposeCopy(language).actionUnavailable);
  });

  it('is not offered under review, while the summary is withheld, or without the composition’s handler', async () => {
    const share = async () => 'OPENED' as const;
    expect((await surface(language, item({ underReview: true }), share)).queryByTestId('qandeel-understanding-share-entry')).toBeNull();
    expect((await surface(language, item({ summary: null, evidenceChange: 'REVIEW_PENDING' }), share)).queryByTestId('qandeel-understanding-share-entry')).toBeNull();
    expect((await surface(language, item())).queryByTestId('qandeel-understanding-share-entry')).toBeNull();
  });
});
