/**
 * W3-MEGA-U (E2E-D-14) — the «فهم قنديل» / QANDEEL Understanding surface in Arabic and English: the first view, the
 * detail, the honest empty and unavailable states, "talk to QANDEEL about this", and what the reader must never see.
 *
 * The appearance is the REAL authority; the Understanding controller is the REAL controller over a scripted transport
 * that answers exactly what the server projection would.
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { BackHandler, StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import type {
  UnderstandingDetailOutcome,
  UnderstandingDetailView,
  UnderstandingDisagreementOutcome,
  UnderstandingDiscussionOutcome,
  UnderstandingItemView,
  UnderstandingListOutcome,
  UnderstandingResolutionOutcome,
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
  ref, revision: REV_1, theme: 'WORK', summary: 'You prepare well before big deadlines.', evidenceChange: 'NONE', confidence: 'TAKING_SHAPE', underReview: false, ...overrides,
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
  const disagreements: { ref: string; commandId: string; revision: string }[] = [];
  const verdicts: UnderstandingDisagreementOutcome[] = [];
  const resolutions: { ref: string; commandId: string; revision: string }[] = [];
  const resolutionVerdicts: UnderstandingResolutionOutcome[] = [];
  let holdResolution: Promise<void> | null = null;
  return {
    discussions, closes, disagreements, resolutions,
    verdict(value: UnderstandingDisagreementOutcome) { verdicts.push(value); },
    resolutionVerdict(value: UnderstandingResolutionOutcome) { resolutionVerdicts.push(value); },
    /** The next resolution answer waits until the returned release is called. */
    holdNextResolution() {
      let release = () => undefined as void;
      holdResolution = new Promise<void>((resolve) => { release = resolve; });
      return () => release();
    },
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
      disagree: async (ref: string, commandId: string, revision: string) => {
        disagreements.push({ ref, commandId, revision });
        return verdicts.shift() ?? { kind: 'UNDER_REVIEW' as const, revision: REV_2 };
      },
      resolveDisagreement: async (ref: string, commandId: string, revision: string): Promise<UnderstandingResolutionOutcome> => {
        resolutions.push({ ref, commandId, revision });
        const held = holdResolution;
        holdResolution = null;
        if (held !== null) await held;
        return resolutionVerdicts.shift() ?? { kind: 'RESOLVED', revision };
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

  describe('U3 — I see it differently (explicit disagreement → Contested / Under Review)', () => {
    async function discussing(fake = server()) {
      const world = await surface(language, fake);
      await press(world.view, `qandeel-understanding-item-${REF_A}`);
      await press(world.view, 'qandeel-understanding-talk');
      return world;
    }

    it('is one intentional act on the discussed item, bound to the revision shown, carrying no words; it then says so', async () => {
      const { view, fake } = await discussing();
      expect(view.getByTestId('qandeel-understanding-disagree').props.accessibilityLabel).toBe(copy.disagree);
      await press(view, 'qandeel-understanding-disagree');
      expect(fake.disagreements).toHaveLength(1);
      expect(fake.disagreements[0]).toMatchObject({ ref: REF_A, revision: REV_1 });
      expect(fake.disagreements[0].commandId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
      expect(view.getByTestId('qandeel-understanding-disagreement-recorded').props.children).toBe(copy.disagreeRecorded);
      // Recorded once: the act is gone, the context stays, the Conversation continues.
      expect(view.queryByTestId('qandeel-understanding-disagree')).toBeNull();
      expect(view.getByTestId('qandeel-understanding-discussion')).toBeTruthy();
    });

    it('a lost answer is retried as the SAME command, so the server records it at most once', async () => {
      const fake = server();
      fake.verdict({ kind: 'FAILED' });
      const { view } = await discussing(fake);
      await press(view, 'qandeel-understanding-disagree');
      expect(view.getByTestId('qandeel-understanding-disagreement-failed').props.children).toBe(copy.disagreeFailed);
      await press(view, 'qandeel-understanding-disagree');
      expect(fake.disagreements).toHaveLength(2);
      expect(fake.disagreements[1].commandId).toBe(fake.disagreements[0].commandId);
      expect(view.getByTestId('qandeel-understanding-disagreement-recorded')).toBeTruthy();
    });

    it('never applies the objection to an interpretation the reader did not see: nothing recorded, the current one shown', async () => {
      const fake = server();
      const { view } = await discussing(fake);
      fake.verdict({ kind: 'CHANGED' });
      fake.setDetail({ kind: 'READ', view: detailOf(item(REF_A, { revision: REV_2, summary: 'You prepare early when it matters to others.' })) });
      await press(view, 'qandeel-understanding-disagree');
      expect(view.queryByTestId('qandeel-understanding-disagreement-recorded')).toBeNull();
      expect(within(view.getByTestId('qandeel-understanding-discussion')).getByText('You prepare early when it matters to others.')).toBeTruthy();
      await press(view, 'qandeel-understanding-disagree');
      expect(fake.disagreements.map((entry) => entry.revision)).toEqual([REV_1, REV_2]);
      expect(fake.disagreements[1].commandId).not.toBe(fake.disagreements[0].commandId);
    });

    it('an item under review reads Mixed and under review, in words, in the list and in its detail', async () => {
      const contested = item(REF_A, { confidence: 'MIXED', underReview: true });
      const fake = server({ list: { kind: 'READ', items: [contested] }, detail: { kind: 'READ', view: detailOf(contested, { evolution: [{ kind: 'YOU_DISAGREED', at: '2026-09-30T10:00:00Z' }, { kind: 'FIRST_SEEN', at: '2026-09-28T10:00:00Z' }] }) } });
      const { view } = await surface(language, fake);
      expect(view.getByTestId(`qandeel-understanding-item-${REF_A}-under-review`).props.children).toBe(copy.underReview);
      expect(view.getByTestId(`qandeel-understanding-item-${REF_A}`).props.accessibilityLabel).toContain(copy.confidenceName(copy.confidence.MIXED));
      await press(view, `qandeel-understanding-item-${REF_A}`);
      expect(view.getByTestId('qandeel-understanding-detail-under-review').props.children).toBe(copy.underReviewNote);
      expect(words(view)).toContain(copy.evolutionKind.YOU_DISAGREED);
    });
  });

  describe('W3-CORR-U — I agree with this now (explicit resolution; the disagreement stays history)', () => {
    async function contested(fake = server()) {
      const world = await surface(language, fake);
      await press(world.view, `qandeel-understanding-item-${REF_A}`);
      await press(world.view, 'qandeel-understanding-talk');
      await press(world.view, 'qandeel-understanding-disagree');
      return world;
    }

    it('the exact approved copy, in both languages', () => {
      expect(copy.agree).toBe(language === 'ar' ? 'أوافق عليه الآن' : 'I agree with this now');
      expect(copy.evolutionKind.YOU_RESOLVED_DISAGREEMENT).toBe(language === 'ar' ? 'وافقت لاحقًا على هذا الفهم' : 'You later agreed with this understanding');
    });

    it('is absent while the item is not under review, and offered once it is', async () => {
      const world = await surface(language);
      await press(world.view, `qandeel-understanding-item-${REF_A}`);
      await press(world.view, 'qandeel-understanding-talk');
      expect(world.view.queryByTestId('qandeel-understanding-agree')).toBeNull();
      await press(world.view, 'qandeel-understanding-disagree');
      const agree = world.view.getByTestId('qandeel-understanding-agree');
      expect(agree.props.accessibilityLabel).toBe(copy.agree);
      expect(within(agree).getByText(copy.agree)).toBeTruthy();
      expect(agree.props.accessibilityState).toMatchObject({ busy: false, disabled: false });
    });

    it('bound to the revision shown with its OWN command; success keeps the discussion open and offers a NEW disagreement', async () => {
      const { view, fake } = await contested();
      await press(view, 'qandeel-understanding-agree');
      expect(fake.resolutions).toHaveLength(1);
      expect(fake.resolutions[0]).toMatchObject({ ref: REF_A, revision: REV_2 });
      expect(fake.resolutions[0].commandId).not.toBe(fake.disagreements[0].commandId);
      expect(view.getByTestId('qandeel-understanding-discussion')).toBeTruthy();
      expect(view.queryByTestId('qandeel-understanding-agree')).toBeNull();
      expect(view.queryByTestId('qandeel-understanding-disagreement-recorded')).toBeNull();
      // A later change of mind is a new explicit contest, under a new command identity.
      await press(view, 'qandeel-understanding-disagree');
      expect(fake.disagreements).toHaveLength(2);
      expect(fake.disagreements[1]).toMatchObject({ ref: REF_A, revision: REV_2 });
      expect(fake.disagreements[1].commandId).not.toBe(fake.disagreements[0].commandId);
      expect(fake.closes).toEqual([]);
    });

    it('one request while busy, and the screen reader hears it busy', async () => {
      const fake = server();
      const { view, controller } = await contested(fake);
      const release = fake.holdNextResolution();
      await fireEvent.press(view.getByTestId('qandeel-understanding-agree'));
      await act(async () => {
        await flush();
      });
      expect(view.getByTestId('qandeel-understanding-agree').props.accessibilityState).toMatchObject({ busy: true, disabled: true });
      await expect(controller.agree()).resolves.toBeNull();
      await act(async () => {
        release();
        await flush();
      });
      expect(fake.resolutions).toHaveLength(1);
      expect(view.queryByTestId('qandeel-understanding-agree')).toBeNull();
    });

    it('a lost answer is retried as the SAME resolution command, and says so in words meanwhile', async () => {
      const fake = server();
      const { view } = await contested(fake);
      fake.resolutionVerdict({ kind: 'FAILED' });
      await press(view, 'qandeel-understanding-agree');
      expect(view.getByTestId('qandeel-understanding-resolution-failed').props.children).toBe(copy.disagreeFailed);
      expect(view.getByTestId('qandeel-understanding-agree')).toBeTruthy();
      await press(view, 'qandeel-understanding-agree');
      expect(fake.resolutions).toHaveLength(2);
      expect(fake.resolutions[1].commandId).toBe(fake.resolutions[0].commandId);
      expect(view.queryByTestId('qandeel-understanding-agree')).toBeNull();
    });

    it.each(['CHANGED', 'NOT_UNDER_REVIEW'] as const)('%s is read again first — nothing applied to an unseen revision', async (kind) => {
      const fake = server();
      const { view } = await contested(fake);
      fake.resolutionVerdict({ kind });
      fake.setDetail({ kind: 'READ', view: detailOf(item(REF_A, { revision: REV_1, summary: 'You prepare early when it matters to others.', confidence: 'MIXED', underReview: true })) });
      await press(view, 'qandeel-understanding-agree');
      expect(within(view.getByTestId('qandeel-understanding-discussion')).getByText('You prepare early when it matters to others.')).toBeTruthy();
      await press(view, 'qandeel-understanding-agree');
      expect(fake.resolutions.map((entry) => entry.revision)).toEqual([REV_2, REV_1]);
      expect(fake.resolutions[1].commandId).not.toBe(fake.resolutions[0].commandId);
    });

    it('a gone item removes the discussion', async () => {
      const fake = server();
      const { view } = await contested(fake);
      fake.resolutionVerdict({ kind: 'GONE' });
      await press(view, 'qandeel-understanding-agree');
      expect(view.queryByTestId('qandeel-understanding-discussion')).toBeNull();
    });

    it('a completion after the controller is retired changes nothing', async () => {
      const fake = server();
      const { view, controller } = await contested(fake);
      const release = fake.holdNextResolution();
      let pending: Promise<unknown> = Promise.resolve();
      await act(async () => {
        pending = controller.agree();
        await flush();
      });
      controller.retire();
      await act(async () => {
        release();
        await flush();
      });
      await expect(pending).resolves.toBe('FAILED');
      expect(controller.getState().discussion?.underReview).toBe(true);
      expect(view.getByTestId('qandeel-understanding-agree')).toBeTruthy();
    });

    it('the evolution keeps the disagreement and tells the later agreement, in words', async () => {
      const resolved = item(REF_A, { confidence: 'MIXED' });
      const fake = server({ list: { kind: 'READ', items: [resolved] }, detail: { kind: 'READ', view: detailOf(resolved, { evolution: [
        { kind: 'YOU_RESOLVED_DISAGREEMENT', at: '2026-10-01T10:00:00Z' }, { kind: 'YOU_DISAGREED', at: '2026-09-30T10:00:00Z' }, { kind: 'FIRST_SEEN', at: '2026-09-28T10:00:00Z' },
      ] }) } });
      const { view } = await surface(language, fake);
      await press(view, `qandeel-understanding-item-${REF_A}`);
      expect(words(view)).toEqual(expect.arrayContaining([copy.evolutionKind.YOU_RESOLVED_DISAGREEMENT, copy.evolutionKind.YOU_DISAGREED]));
      expect(view.queryByTestId('qandeel-understanding-detail-under-review')).toBeNull();
    });
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

// INTEL-TM-01 (PG-02, CC-2): a withheld understanding is visible to its owner, but never its statement — not on screen,
// not to a screen reader — and it offers no way to bring it into the Conversation.
describe.each(['ar', 'en'] as const)('%s — INTEL-TM-01 withheld understanding', (language) => {
  const copy = understandingCopy(language);
  const pending = item(REF_A, { summary: null, evidenceChange: 'REVIEW_PENDING', confidence: 'NEEDS_MORE' });
  const unsupported = item(REF_B, { summary: null, evidenceChange: 'NO_REMAINING_SUPPORT', theme: 'GOALS', confidence: 'MIXED', underReview: true });
  const withheldDetail = (base: UnderstandingItemView) => detailOf(base, { evidence: [], contradictions: [], alternatives: [], unresolved: [] });

  it('the approved lines, exactly', () => {
    expect(copy.evidenceChange).toEqual(language === 'ar'
      ? {
        REVIEW_PENDING: 'هذا الاستنتاج يحتاج إلى مراجعة بعد تغيير معلومات كان يعتمد عليها.',
        NO_REMAINING_SUPPORT: 'لا توجد حاليًا معلومات مؤهلة تدعم هذا الاستنتاج، ولذلك لن يعتمد عليه قنديل.',
      }
      : {
        REVIEW_PENDING: 'This conclusion needs review after a change to information it relied on.',
        NO_REMAINING_SUPPORT: "No eligible information currently supports this conclusion, so QANDEEL won't rely on it.",
      });
  });

  it('the first view shows the evidence-change line in the statement place, and the screen reader hears only that', async () => {
    const { view } = await surface(language, server({ list: { kind: 'READ', items: [pending, unsupported] } }));
    expect(words(view)).toEqual([
      copy.name,
      copy.theme.WORK, copy.evidenceChange.REVIEW_PENDING, copy.confidenceName(copy.confidence.NEEDS_MORE),
      copy.theme.GOALS, copy.evidenceChange.NO_REMAINING_SUPPORT, copy.confidenceName(copy.confidence.MIXED), copy.underReview,
    ]);
    expect(view.getByTestId(`qandeel-understanding-item-${REF_A}`).props.accessibilityLabel)
      .toBe(`${copy.theme.WORK}, ${copy.evidenceChange.REVIEW_PENDING}, ${copy.confidenceName(copy.confidence.NEEDS_MORE)}`);
    expect(view.getByTestId(`qandeel-understanding-item-${REF_B}`).props.accessibilityLabel)
      .toBe(`${copy.theme.GOALS}, ${copy.evidenceChange.NO_REMAINING_SUPPORT}, ${copy.confidenceName(copy.confidence.MIXED)}, ${copy.underReview}`);
    expect(view.getByTestId(`qandeel-understanding-item-${REF_A}-evidence-change`)).toBeTruthy();
    expect(JSON.stringify(view.toJSON())).not.toContain('null');
  });

  it('the detail shows the line, the confidence, the review note and the evolution — and no talk', async () => {
    const fake = server({ list: { kind: 'READ', items: [unsupported] }, detail: { kind: 'READ', view: withheldDetail(unsupported) } });
    const { view, controller } = await surface(language, fake);
    await press(view, `qandeel-understanding-item-${REF_B}`);
    expect(view.getByTestId('qandeel-understanding-detail-evidence-change').props.children).toBe(copy.evidenceChange.NO_REMAINING_SUPPORT);
    expect(view.getByTestId('qandeel-understanding-detail-under-review')).toBeTruthy();
    expect(view.getByTestId('qandeel-understanding-detail-evolution')).toBeTruthy();
    for (const absent of ['qandeel-understanding-talk', 'qandeel-understanding-detail-evidence', 'qandeel-understanding-detail-alternatives']) {
      expect(view.queryByTestId(absent)).toBeNull();
    }
    // Nothing can open a discussion of it, even by a direct call.
    await act(async () => { await expect(controller.talk()).resolves.toBeNull(); });
    expect(fake.discussions).toEqual([]);
  });

  it('a discussion whose item turns out withheld on a re-read ends, and its statement is never shown again', async () => {
    const fake = server();
    const { view, controller } = await surface(language, fake);
    await press(view, `qandeel-understanding-item-${REF_A}`);
    await act(async () => { await controller.talk(); });
    expect(controller.getState().discussion).not.toBeNull();
    fake.verdict({ kind: 'CHANGED' });
    fake.setDetail({ kind: 'READ', view: withheldDetail(pending) });
    await act(async () => { await expect(controller.disagree()).resolves.toBe('CHANGED'); });
    expect(controller.getState().discussion).toBeNull();
  });
});
