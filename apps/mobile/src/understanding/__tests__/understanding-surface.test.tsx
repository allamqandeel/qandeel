/**
 * W3-MEGA-U (E2E-D-14) — the «فهم قنديل» / QANDEEL Understanding surface in Arabic and English: the first view, the
 * detail, the honest empty and unavailable states, "talk to QANDEEL about this", and what the reader must never see.
 *
 * The appearance is the REAL authority; the Understanding controller is the REAL controller over a scripted transport
 * that answers exactly what the server projection would.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { BackHandler, StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import type {
  UnderstandingDetailOutcome,
  UnderstandingDetailView,
  UnderstandingDiscussionOutcome,
  UnderstandingItemView,
  UnderstandingListOutcome,
} from '../../runtime-entry';
import { UnderstandingDiscussionStrip, UnderstandingSurface, createUnderstandingController, understandingCopy } from '..';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const REF_A = 'AAAAAAAAAAAAAAAAAAAAAA';
const REF_B = 'BBBBBBBBBBBBBBBBBBBBBB';
const REV_1 = 'rrrrrrrrrrrrrrrrrrrrr1';
const REV_2 = 'rrrrrrrrrrrrrrrrrrrrr2';

const item = (ref: string, overrides: Partial<UnderstandingItemView> = {}): UnderstandingItemView => ({
  ref, revision: REV_1, theme: 'WORK', summary: 'You prepare well before big deadlines.', confidence: 'TAKING_SHAPE', ...overrides,
});
const detailOf = (base: UnderstandingItemView, overrides: Partial<UnderstandingDetailView> = {}): UnderstandingDetailView => ({
  ...base, evidence: ['I plan my week on Sunday.'], contradictions: [], alternatives: ['You prepare early only for others.'],
  unresolved: [], evolution: [{ kind: 'SUPPORT_ADDED', at: '2026-09-29T10:00:00Z' }, { kind: 'FIRST_SEEN', at: '2026-09-28T10:00:00Z' }], ...overrides,
});

function server(initial: { list?: UnderstandingListOutcome; detail?: UnderstandingDetailOutcome } = {}) {
  let list: UnderstandingListOutcome = initial.list ?? { kind: 'READ', items: [item(REF_A), item(REF_B, { theme: 'GOALS', confidence: 'MIXED', summary: 'Finishing the course matters to you.' })] };
  let detail: UnderstandingDetailOutcome = initial.detail ?? { kind: 'READ', view: detailOf(item(REF_A)) };
  const discussions: { ref: string; revision: string }[] = [];
  const closes: string[] = [];
  const answers: UnderstandingDiscussionOutcome[] = [];
  return {
    discussions, closes,
    setList(value: UnderstandingListOutcome) { list = value; },
    setDetail(value: UnderstandingDetailOutcome) { detail = value; },
    answer(value: UnderstandingDiscussionOutcome) { answers.push(value); },
    transport: {
      readItems: async () => list,
      readItem: async () => detail,
      openDiscussion: async (ref: string, revision: string) => {
        discussions.push({ ref, revision });
        return answers.shift() ?? { kind: 'OPENED' as const };
      },
      closeDiscussion: async (ref: string) => {
        closes.push(ref);
        return true;
      },
    },
  };
}

async function surface(language: ChromeLanguage, fake = server()) {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({}),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  const controller = createUnderstandingController({ transport: fake.transport, isCurrent: () => true });
  const onBack = jest.fn();
  const onTalk = jest.fn();
  const view = await render(
    <AppearanceProvider authority={authority}>
      <UnderstandingSurface controller={controller} language={language} insets={INSETS} onBack={onBack} onTalk={onTalk} />
      <UnderstandingDiscussionStrip controller={controller} language={language} insets={INSETS} />
    </AppearanceProvider>,
  );
  await act(async () => {
    await flush();
  });
  return { view, controller, onBack, onTalk, fake };
}

async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await flush();
  });
}

const words = (view: RenderResult) => view.getAllByText(/.+/u).map((node) => node.props.children as string);

afterEach(() => jest.restoreAllMocks());

describe.each(['ar', 'en'] as const)('%s — QANDEEL Understanding', (language) => {
  const copy = understandingCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';

  it('first view: title, summary and confidence IN WORDS for each item, most recently changed first — nothing else', async () => {
    const { view } = await surface(language);
    expect(words(view)).toEqual([
      copy.name,
      copy.theme.WORK, 'You prepare well before big deadlines.', copy.confidenceName(copy.confidence.TAKING_SHAPE),
      copy.theme.GOALS, 'Finishing the course matters to you.', copy.confidenceName(copy.confidence.MIXED),
    ]);
    // The approved confidence words, exactly.
    expect(copy.confidence).toEqual(language === 'ar'
      ? { CLEAR: 'واضح', TAKING_SHAPE: 'يتشكّل', MIXED: 'يوجد تعارض', NEEDS_MORE: 'يحتاج سياقًا أكثر' }
      : { CLEAR: 'Clear', TAKING_SHAPE: 'Taking shape', MIXED: 'Mixed', NEEDS_MORE: 'Needs more to go on' });
    // No percentage, number, score or rank anywhere the reader can see.
    expect(words(view).join(' ')).not.toMatch(/[0-9٠-٩]|%|score/iu);
    // One screen-reader stop per item, its confidence named in words.
    expect(view.getByTestId(`qandeel-understanding-item-${REF_B}`).props.accessibilityLabel)
      .toBe(`${copy.theme.GOALS}, Finishing the course matters to you., ${copy.confidenceName(copy.confidence.MIXED)}`);
    expect(style(view.getByTestId('qandeel-understanding')).direction).toBe(writing);
    expect(view.getByTestId('qandeel-understanding-title').props.accessibilityRole).toBe('header');
  });

  it('every control is at least 44 × 44, and nothing is fixed-width, so 320 pt and large text reflow', async () => {
    const { view } = await surface(language);
    for (const id of ['qandeel-understanding-back', `qandeel-understanding-item-${REF_A}`]) {
      const node = style(view.getByTestId(id));
      expect(node.minHeight).toBeGreaterThanOrEqual(44);
      expect(node.minWidth).toBeGreaterThanOrEqual(44);
    }
    const summary = view.getByText('You prepare well before big deadlines.');
    expect(style(summary).width).toBeUndefined();
    expect(summary.props.numberOfLines).toBeUndefined();
    expect(summary.props.allowFontScaling).not.toBe(false);
  });

  it('is honestly empty: one sentence, no invented item and no category tabs', async () => {
    const { view } = await surface(language, server({ list: { kind: 'READ', items: [] } }));
    expect(words(view)).toEqual([copy.name, copy.empty]);
  });

  it('an unavailable read says so and asks again only when the reader does', async () => {
    const fake = server({ list: { kind: 'UNAVAILABLE' } });
    const { view } = await surface(language, fake);
    expect(words(view)).toEqual([copy.name, copy.unavailable, copy.tryAgain]);
    fake.setList({ kind: 'READ', items: [item(REF_A)] });
    await press(view, 'qandeel-understanding-retry');
    expect(view.getByTestId(`qandeel-understanding-item-${REF_A}`)).toBeTruthy();
  });

  it('detail: the item, then only the parts that exist — evidence, alternatives, evolution — never a reasoning text', async () => {
    const { view } = await surface(language);
    await press(view, `qandeel-understanding-item-${REF_A}`);
    expect(words(view)).toEqual([
      copy.theme.WORK,
      'You prepare well before big deadlines.', copy.confidenceName(copy.confidence.TAKING_SHAPE),
      copy.evidence, 'I plan my week on Sunday.',
      copy.alternatives, 'You prepare early only for others.',
      copy.evolution, copy.evolutionKind.SUPPORT_ADDED, copy.evolutionKind.FIRST_SEEN,
      copy.talk,
    ]);
    // Empty parts are omitted, not filled in.
    expect(view.queryByTestId('qandeel-understanding-detail-contradictions')).toBeNull();
    expect(view.queryByTestId('qandeel-understanding-detail-unresolved')).toBeNull();
  });

  it('Back leaves the item first (the control and Android Back), then the surface', async () => {
    type Handler = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers: { handler: Handler; removed: boolean }[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      const entry = { handler, removed: false };
      handlers.push(entry);
      return { remove: () => { entry.removed = true; } };
    });
    const { view, onBack } = await surface(language);
    await press(view, `qandeel-understanding-item-${REF_A}`);
    await act(async () => {
      const live = handlers.filter((entry) => !entry.removed).reverse();
      expect(live[0].handler({} as Parameters<Handler>[0])).toBe(true);
      await flush();
    });
    expect(view.queryByTestId('qandeel-understanding-detail')).toBeNull();
    expect(view.getByTestId(`qandeel-understanding-item-${REF_A}`)).toBeTruthy();
    await press(view, `qandeel-understanding-item-${REF_A}`);
    await press(view, 'qandeel-understanding-back');
    expect(view.queryByTestId('qandeel-understanding-detail')).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
    await press(view, 'qandeel-understanding-back');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('talk to QANDEEL about this: bound to the exact revision shown, then a bounded context line — nothing written for the reader', async () => {
    const { view, onTalk, fake } = await surface(language);
    await press(view, `qandeel-understanding-item-${REF_A}`);
    await press(view, 'qandeel-understanding-talk');
    expect(fake.discussions).toEqual([{ ref: REF_A, revision: REV_1 }]);
    expect(onTalk).toHaveBeenCalledTimes(1);
    const strip = view.getByTestId('qandeel-understanding-discussion');
    expect(strip).toBeTruthy();
    expect(words(view)).toContain(copy.discussing(copy.theme.WORK));
    // The item's identity never reaches the reader.
    expect(words(view).join(' ')).not.toContain(REF_A);
    await press(view, 'qandeel-understanding-discussion-end');
    expect(view.queryByTestId('qandeel-understanding-discussion')).toBeNull();
    expect(fake.closes).toEqual([REF_A]);
  });

  it('when the item changed meanwhile, nothing is recorded: the current interpretation is shown first', async () => {
    const fake = server();
    const { view, onTalk } = await surface(language, fake);
    await press(view, `qandeel-understanding-item-${REF_A}`);
    fake.answer({ kind: 'CHANGED' });
    fake.setDetail({ kind: 'READ', view: detailOf(item(REF_A, { revision: REV_2, summary: 'You prepare early when it matters to others.' })) });
    await press(view, 'qandeel-understanding-talk');
    expect(onTalk).not.toHaveBeenCalled();
    expect(view.queryByTestId('qandeel-understanding-discussion')).toBeNull();
    expect(view.getByText('You prepare early when it matters to others.')).toBeTruthy();
    await press(view, 'qandeel-understanding-talk');
    expect(fake.discussions.at(-1)).toEqual({ ref: REF_A, revision: REV_2 });
    expect(onTalk).toHaveBeenCalledTimes(1);
  });

  it('a talk that did not land says so in words and can be asked again', async () => {
    const fake = server();
    const { view, onTalk } = await surface(language, fake);
    await press(view, `qandeel-understanding-item-${REF_A}`);
    fake.answer({ kind: 'FAILED' });
    await press(view, 'qandeel-understanding-talk');
    expect(view.getByTestId('qandeel-understanding-talk-failed').props.children).toBe(copy.talkFailed);
    expect(onTalk).not.toHaveBeenCalled();
    await press(view, 'qandeel-understanding-talk');
    expect(onTalk).toHaveBeenCalledTimes(1);
  });
});
