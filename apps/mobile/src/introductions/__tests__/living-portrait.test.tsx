/**
 * S6-01 / CP3 VIS-2 — the Living Portrait (direction A) and the Product Owner's four refinements, on the device model:
 *
 *   R1  the portrait holds only server-confirmed content: a declared fact, a remembered item awaiting the owner, a
 *       declined item and a missing fact are never drawn as known; an empty preparation draws no portrait at all.
 *   R2  while preparing, the portrait is compact on a crowded screen and always with the keyboard up; the owner can
 *       open it (the group name is a disclosure with its state); the screen reader arrives on the question.
 *   R3  the review is the composed portrait: About you / What matters / Dealbreakers and preferences, the name in the
 *       24/38 role, each part's details and edits behind its own Edit; read-only shows no edit.
 *   R4  no light; an arrival is shown only after the server applied it, and "Added to your preparation." is announced
 *       and written whether or not motion runs (Reduced Motion parity).
 *
 * The appearance is the REAL authority; the controller is the REAL controller over a scripted transport.
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import * as Conversation from '../../conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { IntroductionsChange, IntroductionsDraft, IntroductionsObjective, IntroductionsPriorItem, IntroductionsView } from '../../runtime-entry';
import { IntroductionsSurface, createIntroductionsController, introductionsCopy } from '..';
import { INTRODUCTIONS_COPY_DELTA, INTRODUCTIONS_COPY_ROWS } from '../copy';
import { QUOTE_MARKS } from '../IntroductionsParts';
import { arrivals, projectPortrait } from '../portrait-projection';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));
jest.mock('../../conversation', () => ({ ...jest.requireActual<object>('../../conversation'), useReduceMotion: jest.fn(() => false) }));
/** The window the surface is laid out in: a crowded 320-point phone (568 points tall) unless a test says otherwise. */
const windowSize = { width: 320, height: 568, scale: 2, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => windowSize }));

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const memory = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const reduceMotion = Conversation.useReduceMotion as jest.Mock;

const emptyDraft = (over: Partial<IntroductionsDraft> = {}): IntroductionsDraft => ({
  version: 2,
  facts: { firstName: null, sex: null, birthYearMonth: null, area: null, maritalStatus: null },
  profile: { shortIntroduction: null, workField: null },
  requirements: { hard: { answer: null, items: [] }, soft: { answer: null, items: [] }, discrepancies: [] },
  notes: [], skippedSteps: [], review: { state: 'NOT_REVIEWED' },
  ...over,
});
const viewOf = (next: IntroductionsObjective | null, over: Partial<IntroductionsView> = {}, path: IntroductionsView['plan']['path'] = 'NEW',
  stage: IntroductionsView['plan']['stage'] = 'PREPARING'): IntroductionsView => ({
  availability: { preparation: true, assistance: true }, accountDeletionPending: false,
  assistance: { consent: 'GRANTED', currentVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1' },
  draft: emptyDraft(), priorItems: [], plan: { path, stage, next }, ...over,
});
const prior = (n: number, words: string, itemClass: IntroductionsPriorItem['itemClass'] = 'GOAL'): IntroductionsPriorItem =>
  ({ memoryId: memory(n), itemClass, words, recency: 'CURRENT' });
const note = (id: string, kind: 'ABOUT_ME' | 'WHAT_MATTERS', body: string, origin = 'CONFIRMED_FROM_PRIOR_UNDERSTANDING') => ({ id, kind, origin, body });
const confirmedFacts: IntroductionsDraft['facts'] = {
  firstName: { value: 'Salma', state: 'CONFIRMED' }, sex: { value: 'FEMALE', state: 'CONFIRMED' }, birthYearMonth: { year: 1996, month: 5, state: 'CONFIRMED' },
  area: { countryCode: 'EG', regionCode: 'EG-ALX', state: 'CONFIRMED' }, maritalStatus: { value: 'NEVER_MARRIED', state: 'CONFIRMED' },
};

function server(initial: IntroductionsView) {
  let view = initial;
  const answers: IntroductionsChange[] = [];
  const commands: { kind: string; payload: Record<string, unknown> }[] = [];
  return {
    commands,
    answer(change: IntroductionsChange) { answers.push(change); },
    transport: {
      availability: async () => ({ kind: 'READ' as const, availability: { preparation: true, assistance: true, hasDraft: view.draft !== null } }),
      read: async () => ({ kind: 'READ' as const, view }),
      command: async (_id: string, _version: number, kind: string, payload: Record<string, unknown>) => {
        commands.push({ kind, payload });
        const answer = answers.shift() ?? { kind: 'ANSWERED' as const, outcome: 'APPLIED', view };
        if (answer.kind === 'ANSWERED') view = answer.view;
        return answer;
      },
      discard: async () => ({ kind: 'ANSWERED' as const, outcome: 'DISCARDED', view: { ...view, draft: null } }),
      grantAssistance: async () => ({ kind: 'ANSWERED' as const, outcome: 'GRANTED', view }),
      revokeAssistance: async () => ({ kind: 'ANSWERED' as const, outcome: 'REVOKED', view }),
    },
  };
}

async function surface(language: ChromeLanguage, fake: ReturnType<typeof server>) {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({}), system: { current: () => 'DARK', subscribe: () => () => undefined }, native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  const controller = createIntroductionsController({ transport: fake.transport, isCurrent: () => true });
  const view = await render(
    <AppearanceProvider authority={authority}>
      <IntroductionsSurface controller={controller} language={language} insets={INSETS} onBack={() => undefined} />
    </AppearanceProvider>,
  );
  await act(async () => { await flush(); });
  mounted.push(view);
  return view;
}
async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => { await flush(); });
}
const texts = (view: RenderResult) => view.getAllByText(/.+/u).map((node) => String(node.props.children));
const screen = (height: number) => { windowSize.height = height; };
const mounted: RenderResult[] = [];

beforeEach(() => { reduceMotion.mockReturnValue(false); screen(568); });
afterEach(() => {
  while (mounted.length > 0) mounted.pop()?.unmount();
  jest.restoreAllMocks();
});

describe('the projection decides nothing — it places what the server says (R1)', () => {
  const copy = introductionsCopy('en');
  it('an empty preparation, a declared fact, a remembered item and a missing fact are never part of the portrait', () => {
    const declared = emptyDraft({ facts: { ...emptyDraft().facts, firstName: { value: 'Salma', state: 'DECLARED' }, sex: { value: 'FEMALE', state: 'CORRECTED' } } });
    const p = projectPortrait(viewOf({ kind: 'CONFIRM_PRIOR_ITEM', item: prior(1, 'Reading') }, { draft: declared, priorItems: [prior(1, 'Reading')] }), copy, 'en');
    expect(p.settledKeys.size).toBe(0);
    expect(p.name).toBeNull();
    expect(p.open.map((o) => [o.key, o.state])).toEqual([['fact:INTRODUCTION_FIRST_NAME', 'TO_CONFIRM'], ['fact:SEX', 'TO_DECIDE'], [`prior:${memory(1)}`, 'TO_CONFIRM']]);
    expect(p.current?.key).toBe(`prior:${memory(1)}`);
  });

  it('a confirmed remembered item lands where migration 0154 puts it: a personal fact in About you, anything else in What matters', () => {
    const p = projectPortrait(viewOf(null, { draft: emptyDraft({ notes: [note('a', 'ABOUT_ME', 'I teach'), note('b', 'WHAT_MATTERS', 'Calm')] }) }), copy, 'en');
    expect(p.about.map((n) => n.body)).toEqual(['I teach']);
    expect(p.matters.map((n) => n.body)).toEqual(['Calm']);
    expect(projectPortrait(viewOf({ kind: 'CONFIRM_PRIOR_ITEM', item: prior(2, 'x', 'PERSONAL_FACT') }), copy, 'en').current?.lands).toBe('ABOUT');
    expect(projectPortrait(viewOf({ kind: 'CONFIRM_PRIOR_ITEM', item: prior(2, 'x', 'STABLE_PREFERENCE') }), copy, 'en').current?.lands).toBe('MATTERS');
  });

  it('"no additional dealbreakers" and "no preferences" are answers of their own; unanswered is nothing', () => {
    const none = projectPortrait(viewOf(null, { draft: emptyDraft({ requirements: { hard: { answer: 'NONE_ADDITIONAL', items: [] }, soft: { answer: null, items: [] }, discrepancies: [] } }) }), copy, 'en');
    expect(none.hard).toEqual([{ label: null, value: copy.hardNone }]);
    expect(none.soft).toBeNull();
  });

  it('an arrival is only what a server-confirmed change ADDED', () => {
    const before = projectPortrait(viewOf(null), copy, 'en');
    const after = projectPortrait(viewOf(null, { draft: emptyDraft({ notes: [note('n1', 'WHAT_MATTERS', 'Calm')] }) }), copy, 'en');
    expect([...arrivals(before, after)]).toEqual(['note:n1']);
    expect([...arrivals(after, after)]).toEqual([]);
    expect([...arrivals(null, after)]).toEqual([]);
  });
});

describe.each(['ar', 'en'] as const)('%s — the Living Portrait', (language) => {
  const copy = introductionsCopy(language);
  const items = [prior(1, 'أريد أن أبقى قريبة من أهلي.', 'STABLE_PREFERENCE'), prior(2, 'أعمل معلمة.', 'PERSONAL_FACT')];
  const known = viewOf({ kind: 'CONFIRM_PRIOR_ITEM', item: items[0] }, { priorItems: items }, 'KNOWN');
  const afterYes = viewOf({ kind: 'CONFIRM_PRIOR_ITEM', item: items[1] }, {
    priorItems: [items[1]], draft: emptyDraft({ version: 3, notes: [note('n1', 'WHAT_MATTERS', items[0].words)] }),
  }, 'KNOWN');

  it('a remembered item waits in "Not settled yet", apart from the portrait; its landing place is shown, never its words as known', async () => {
    const view = await surface(language, server(known));
    expect(view.getByTestId('qandeel-introductions-band')).toBeTruthy();
    expect(view.getByTestId('qandeel-introductions-prior-words').props.children).toBe(items[0].words);
    expect(view.getByTestId('qandeel-introductions-mark-TO_CONFIRM', { includeHiddenElements: true })).toBeTruthy();
    expect(texts(view)).toEqual(expect.arrayContaining([copy.clusterOpen, copy.notesHeading, copy.afterConfirmPrior]));
    expect(view.queryByTestId(`qandeel-introductions-portrait-note:n1`)).toBeNull();
    // The band's item is announced as not confirmed yet.
    const item = view.getByLabelText(`${copy.stateDeclared}: ${items[0].words}`);
    expect(item).toBeTruthy();
    // The question is the step's heading, in the approved 20/32 role; the header is the calm 17.
    expect(style(view.getByTestId('qandeel-introductions-step-heading'))).toMatchObject({ fontSize: 20, lineHeight: 32, fontFamily: 'Estedad-Medium' });
    expect(style(view.getByTestId('qandeel-introductions-title'))).toMatchObject({ fontSize: 17, lineHeight: 30 });
    // The primary act's label spans its button (never shrink-wrapped, which Android can clip after a re-render).
    expect(style(view.getByText(copy.priorYes))).toMatchObject({ alignSelf: 'stretch', textAlign: 'center' });
  });

  it('after the server applies "Yes", the owner\'s words appear in What matters, "Added" is written and announced, and the next item waits', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const announceIos = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => undefined);
    // AccessibilityInfo is already a mock under jest: start each count from nothing.
    announce.mockClear();
    announceIos.mockClear();
    const fake = server(known);
    const view = await surface(language, fake);
    fake.answer({ kind: 'ANSWERED', outcome: 'APPLIED', view: afterYes });
    await press(view, 'qandeel-introductions-prior-yes');
    expect(view.getByTestId('qandeel-introductions-portrait-note:n1').props.children).toBe(items[0].words);
    expect(view.getByTestId('qandeel-introductions-added').props.children).toBe(copy.added);
    expect([...announce.mock.calls, ...announceIos.mock.calls].map((c) => c[0])).toEqual([copy.added]);
    expect(view.getByTestId('qandeel-introductions-prior-words').props.children).toBe(items[1].words);
  });

  it('Reduced Motion: the same words, the same "Added", the same announcement — only nothing moves', async () => {
    reduceMotion.mockReturnValue(true);
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const announceIos = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => undefined);
    // AccessibilityInfo is already a mock under jest: start each count from nothing.
    announce.mockClear();
    announceIos.mockClear();
    const fake = server(known);
    const view = await surface(language, fake);
    fake.answer({ kind: 'ANSWERED', outcome: 'APPLIED', view: afterYes });
    await press(view, 'qandeel-introductions-prior-yes');
    expect(view.getByTestId('qandeel-introductions-portrait-note:n1').props.children).toBe(items[0].words);
    expect(view.getByTestId('qandeel-introductions-added')).toBeTruthy();
    expect([...announce.mock.calls, ...announceIos.mock.calls].map((c) => c[0])).toEqual([copy.added]);
  });

  it('a declined item never lands: nothing is added, nothing is announced', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    announce.mockClear();
    const fake = server(known);
    const view = await surface(language, fake);
    fake.answer({ kind: 'ANSWERED', outcome: 'APPLIED', view: viewOf({ kind: 'CONFIRM_PRIOR_ITEM', item: items[1] }, { priorItems: [items[1]] }, 'KNOWN') });
    await press(view, 'qandeel-introductions-prior-decline');
    expect(view.queryByTestId('qandeel-introductions-added')).toBeNull();
    expect(texts(view)).not.toContain(items[0].words);
    expect(announce).not.toHaveBeenCalled();
  });

  it('R2 — on a crowded screen the portrait keeps each group\'s newest words; the group name opens the rest, and says so', async () => {
    const many = viewOf({ kind: 'CONFIRM_PRIOR_ITEM', item: items[1] }, {
      priorItems: [items[1]], draft: emptyDraft({ notes: [note('n1', 'WHAT_MATTERS', 'one'), note('n2', 'WHAT_MATTERS', 'two'), note('n3', 'WHAT_MATTERS', 'three')] }),
    }, 'KNOWN');
    const view = await surface(language, server(many));
    expect(view.queryByTestId('qandeel-introductions-portrait-note:n1')).toBeNull();
    expect(view.getByTestId('qandeel-introductions-portrait-note:n3')).toBeTruthy();
    const toggle = view.getByTestId('qandeel-introductions-portrait-caption-MATTERS');
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
    await press(view, 'qandeel-introductions-portrait-caption-MATTERS');
    expect(view.getByTestId('qandeel-introductions-portrait-note:n1')).toBeTruthy();
    expect(view.getByTestId('qandeel-introductions-portrait-caption-MATTERS').props.accessibilityState).toMatchObject({ expanded: true });
  });

  it('R2 — with the keyboard up, the field keeps its act (Save) in view; its question only when there is room', async () => {
    const handlers: Record<string, () => void> = {};
    jest.spyOn(ReactNative.Keyboard, 'addListener').mockImplementation(((event: string, handler: () => void) => {
      handlers[event] = handler;
      return { remove: () => undefined };
    }) as never);
    const scrollTo = jest.spyOn(ReactNative.ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined);
    // The focused field: 52 points tall, 900 points down the page.
    const field = { measureLayout: (_to: unknown, done: (x: number, y: number, w: number, h: number) => void) => done(0, 900, 288, 52) };
    jest.spyOn(ReactNative.TextInput.State, 'currentlyFocusedInput').mockReturnValue(field as never);
    const view = await surface(language, server(viewOf({ kind: 'ESTABLISH_PRIORITIES' })));
    const body = view.getByTestId('qandeel-introductions-body');
    const shown = async (viewport: number) => {
      scrollTo.mockClear();
      await act(async () => { body.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 320, height: viewport } } }); await flush(); });
      return (scrollTo.mock.calls.at(-1)?.[0] as { y: number } | undefined)?.y;
    };
    // The step opened at its own place first (the sheet's layout)…
    await act(async () => { view.getByTestId('qandeel-introductions-sheet').props.onLayout({ nativeEvent: { layout: { x: 0, y: 700, width: 320, height: 400 } } }); await flush(); });
    await act(async () => { handlers.keyboardDidShow(); await flush(); });
    // Room for both: the question's context above the field (132 points), Save below it.
    expect(await shown(600)).toBe(900 - 132);
    // …and the keyboard shrinking the page never re-applies that opening place over the field.
    scrollTo.mockClear();
    await act(async () => { body.props.onContentSizeChange(320, 1200); await flush(); });
    expect(scrollTo).not.toHaveBeenCalled();
    // A page the keyboard has shrunk (large text, 320 dp): the act wins; the field itself never leaves the top.
    expect(await shown(150)).toBe(900 + 52 + 76 - 150);
    expect(await shown(60)).toBe(900);
  });

  it('R2 — at a large text size the current item opens with less of the portrait above it; its caption is never broken', async () => {
    windowSize.fontScale = 1.3;
    try {
      const scrollTo = jest.spyOn(ReactNative.ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined);
      const view = await surface(language, server(known));
      await act(async () => { view.getByTestId('qandeel-introductions-body').props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 500 } } }); await flush(); });
      scrollTo.mockClear();
      // The band's own layout places the step (the wrapper around the band reports it).
      const band = view.getByTestId('qandeel-introductions-band');
      const placer = [band.parent, band.parent?.parent].find((node) => typeof node?.props.onLayout === 'function');
      await act(async () => { placer?.props.onLayout({ nativeEvent: { layout: { x: 0, y: 400, width: 320, height: 120 } } }); await flush(); });
      expect((scrollTo.mock.calls.at(-1)?.[0] as { y: number }).y).toBeCloseTo(400 - 500 * 0.12);
      const caption = view.getByText(copy.clusterOpen);
      expect(style(caption)).toMatchObject({ flexShrink: 0 });
      expect(style(caption.parent as never)).toMatchObject({ flexWrap: 'wrap' });
    } finally {
      windowSize.fontScale = 1;
    }
  });

  it('R4 — at a large text size, the step after an arrival opens with "Added to your preparation." in view', async () => {
    windowSize.fontScale = 1.3;
    try {
      const scrollTo = jest.spyOn(ReactNative.ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined);
      const fake = server(known);
      const view = await surface(language, fake);
      fake.answer({ kind: 'ANSWERED', outcome: 'APPLIED', view: afterYes });
      await press(view, 'qandeel-introductions-prior-yes');
      await act(async () => { view.getByTestId('qandeel-introductions-body').props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 500 } } }); await flush(); });
      // "Added" sits 200 points down the page, the new item's band at 400.
      expect(view.getByTestId('qandeel-introductions-added')).toBeTruthy();
      // The only text the surface measures is that line.
      const textType = ReactNative.Text as unknown as { prototype: { measureLayout: (to: unknown, done: (x: number, y: number) => void) => void } };
      jest.spyOn(textType.prototype, 'measureLayout').mockImplementation((_to, done) => done(0, 200));
      scrollTo.mockClear();
      const band = view.getByTestId('qandeel-introductions-band');
      const placer = [band.parent, band.parent?.parent].find((node) => typeof node?.props.onLayout === 'function');
      await act(async () => { placer?.props.onLayout({ nativeEvent: { layout: { x: 0, y: 400, width: 320, height: 120 } } }); await flush(); });
      expect((scrollTo.mock.calls.at(-1)?.[0] as { y: number }).y).toBe(200 - 12);
    } finally {
      windowSize.fontScale = 1;
    }
  });

  it('R2 — a roomy screen shows the whole portrait, until the keyboard comes up', async () => {
    screen(900);
    const handlers: Record<string, () => void> = {};
    jest.spyOn(ReactNative.Keyboard, 'addListener').mockImplementation(((event: string, handler: () => void) => {
      handlers[event] = handler;
      return { remove: () => undefined };
    }) as never);
    const view = await surface(language, server(viewOf({ kind: 'ESTABLISH_PRIORITIES' }, {
      draft: emptyDraft({ notes: [note('n1', 'WHAT_MATTERS', 'one', 'USER_AUTHORED'), note('n2', 'WHAT_MATTERS', 'two', 'USER_AUTHORED')] }),
    })));
    expect(view.getByTestId('qandeel-introductions-portrait-note:n1')).toBeTruthy();
    await act(async () => { handlers.keyboardDidShow(); await flush(); });
    expect(view.queryByTestId('qandeel-introductions-portrait-note:n1')).toBeNull();
    expect(view.getByTestId('qandeel-introductions-priority')).toBeTruthy();
    expect(view.getByTestId('qandeel-introductions-save')).toBeTruthy();
  });

  it('R2 — sending an answer closes the keyboard while its field still exists, so the next step is never left beneath it', async () => {
    const fake = server(viewOf({ kind: 'ESTABLISH_PRIORITIES' }));
    // Dismissing blurs the focused field: it must happen before the answer can replace the step.
    const dismissedAfter: number[] = [];
    const dismiss = jest.spyOn(ReactNative.Keyboard, 'dismiss').mockImplementation(() => { dismissedAfter.push(fake.commands.length); });
    const view = await surface(language, fake);
    await fireEvent.changeText(view.getByTestId('qandeel-introductions-priority'), 'Honesty');
    expect(dismiss).not.toHaveBeenCalled();
    fake.answer({ kind: 'ANSWERED', outcome: 'APPLIED', view: viewOf({ kind: 'ESTABLISH_PRIORITIES' }, { draft: emptyDraft({ version: 3, notes: [note('n1', 'WHAT_MATTERS', 'Honesty', 'USER_AUTHORED')] }) }) });
    await press(view, 'qandeel-introductions-save');
    expect(fake.commands.map((c) => c.kind)).toEqual(['ADD_NOTE']);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(dismissedAfter).toEqual([0]);
  });

  const reviewed = viewOf(null, {
    draft: emptyDraft({
      facts: confirmedFacts, profile: { shortIntroduction: null, workField: 'EDUCATION' },
      requirements: { hard: { answer: 'ITEMS', items: [{ dimension: 'AREA', countryCode: 'EG' }] }, soft: { answer: 'ITEMS', items: [{ dimension: 'AGE_RANGE', min: 28, max: 36 }] }, discrepancies: [] },
      notes: [note('n1', 'WHAT_MATTERS', 'Calm'), note('n3', 'ABOUT_ME', 'I teach'), note('n6', 'WHAT_MATTERS', 'Honesty', 'USER_AUTHORED')],
      skippedSteps: ['SHORT_INTRODUCTION'], review: { state: 'REVIEWED' },
    }),
  }, 'KNOWN', 'REVIEWED');

  it('R3 — the review is a composed portrait: the name in 24/38, three parts, a closed dealbreaker and an open preference, what was left out', async () => {
    const view = await surface(language, server(reviewed));
    expect(style(view.getByTestId('qandeel-introductions-portrait-name'))).toMatchObject({ fontSize: 24, lineHeight: 38 });
    for (const part of ['ABOUT', 'MATTERS', 'BOUNDS']) expect(view.getByTestId(`qandeel-introductions-portrait-${part}`)).toBeTruthy();
    expect(style(view.getByTestId('qandeel-introductions-portrait-hard'))).toMatchObject({ borderWidth: 1 });
    expect(style(view.getByTestId('qandeel-introductions-portrait-soft')).borderWidth).toBeUndefined();
    expect(texts(view)).toEqual(expect.arrayContaining(['Salma', copy.female, 'Honesty', 'I teach', copy.reviewed, `${copy.stateNotIncluded}: ${copy.shortIntroTitle}`]));
    expect(texts(view).join(' ')).not.toMatch(/%|score|match(ed|ing)? |eligible|نشط|مؤهل|مطابق|نسبة/iu);
    // The completed private preparation is said first, before the portrait it completes.
    expect(texts(view).indexOf(copy.reviewed)).toBeLessThan(texts(view).indexOf('Salma'));
    // Nothing of the review is a long form: no detail row is shown until a part is opened.
    expect(view.queryByTestId('qandeel-introductions-edit-SEX')).toBeNull();
  });

  it('VIS-3P — one hierarchy: the name heads its facts, the owner\'s words outshine their quiet marks, each frame says its kind', async () => {
    const view = await surface(language, server(reviewed));
    const about = view.getByTestId('qandeel-introductions-portrait-ABOUT');
    const name = view.getByTestId('qandeel-introductions-portrait-name');
    // The name is the subject of About you: it heads its part, after the part's caption and Edit.
    expect(within(about).getByTestId('qandeel-introductions-portrait-name')).toBe(name);
    const order = texts(view);
    expect(order.indexOf(copy.clusterAbout)).toBeLessThan(order.indexOf('Salma'));
    expect(order.indexOf('Salma')).toBeLessThan(order.indexOf(copy.female));
    // The facts are the name's quieter subtitle; the quiet ink is the caption's.
    const quiet = style(view.getByTestId('qandeel-introductions-portrait-caption-MATTERS')).color;
    expect(style(view.getByTestId('qandeel-introductions-portrait-fact:SEX')).color).not.toBe(style(name).color);
    // Quotation marks are punctuation: the opening one hangs apart (hidden from the screen reader), both in the quiet ink.
    const [open, close] = QUOTE_MARKS[language];
    const opens = view.getAllByText(open, { includeHiddenElements: true });
    expect(opens.length).toBeGreaterThanOrEqual(3);
    for (const mark of opens) expect(style(mark)).toMatchObject({ color: quiet });
    for (const mark of view.getAllByText(close, { includeHiddenElements: true })) expect(style(mark)).toMatchObject({ color: quiet });
    expect(view.queryByText(open)).toBeNull();
    // The parts are set apart by an even rhythm: About opens the portrait; every later part keeps the same space.
    expect(style(view.getByTestId('qandeel-introductions-portrait-MATTERS')).paddingTop).toBe(style(view.getByTestId('qandeel-introductions-portrait-BOUNDS')).paddingTop);
    // Shape is never the only signal: each frame is announced as one item that begins with its kind.
    expect(view.getByTestId('qandeel-introductions-portrait-hard').props.accessibilityLabel).toMatch(new RegExp(`^${copy.hardTitle}`, 'u'));
    expect(view.getByTestId('qandeel-introductions-portrait-soft').props.accessibilityLabel).toMatch(new RegExp(`^${copy.softTitle}`, 'u'));
  });

  it('VIS-3P — a step\'s secondary choices are quiet controls on the sheet: 44 points, the World\'s ground, never the primary\'s outline', async () => {
    const view = await surface(language, server(known));
    const primary = style(view.getByTestId('qandeel-introductions-prior-yes'));
    for (const id of ['qandeel-introductions-prior-edit', 'qandeel-introductions-prior-no-longer', 'qandeel-introductions-prior-decline']) {
      const chip = style(view.getByTestId(id));
      expect(chip).toMatchObject({ minHeight: 44, backgroundColor: primary.backgroundColor });
      expect(chip.borderWidth).toBeUndefined();
    }
    // The blank line a remembered item would take is drawn, never a box around words.
    expect(style(view.getByTestId('qandeel-introductions-landing')).borderWidth).toBeUndefined();
  });

  it('R2 — before it is confirmed, the review opens with its lead question; the portrait follows; Confirm review rests below', async () => {
    const draft = reviewed.draft as IntroductionsDraft;
    const view = await surface(language, server(viewOf({ kind: 'REVIEW' }, { draft: { ...draft, review: { state: 'NOT_REVIEWED' } } }, 'KNOWN')));
    const order = texts(view);
    expect(view.getByTestId('qandeel-introductions-step-heading').props.children).toBe(copy.reviewLead);
    expect(order.indexOf(copy.reviewLead)).toBeLessThan(order.indexOf('Salma'));
    expect(order.indexOf('Salma')).toBeLessThan(order.indexOf(copy.reviewConfirm));
    expect(view.getByTestId('qandeel-introductions-edit-group-ABOUT')).toBeTruthy();
  });

  it('R3 — each part\'s details and edits are disclosed by its own Edit; Back closes them; every edit capability remains', async () => {
    const view = await surface(language, server(reviewed));
    const edit = view.getByTestId('qandeel-introductions-edit-group-ABOUT');
    expect(edit.props.accessibilityState).toMatchObject({ expanded: false });
    expect(edit.props.accessibilityLabel).toBe(`${copy.edit}: ${copy.clusterAbout}`);
    await press(view, 'qandeel-introductions-edit-group-ABOUT');
    for (const key of ['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS', 'WORK', 'PROFILE']) {
      expect(view.getByTestId(`qandeel-introductions-edit-${key}`)).toBeTruthy();
    }
    await press(view, 'qandeel-introductions-edit-SEX');
    expect(view.getByTestId('qandeel-introductions-sex-female')).toBeTruthy();
    await press(view, 'qandeel-introductions-back');
    await press(view, 'qandeel-introductions-edit-group-BOUNDS');
    await press(view, 'qandeel-introductions-edit-HARD');
    expect(view.getByTestId('qandeel-introductions-requirements-HARD')).toBeTruthy();
    expect(texts(view)).toContain(copy.systemRulesNote);
  });

  it('Delete preparation opens its confirmation in view — the page\'s last block is brought up, not left below the fold', async () => {
    const view = await surface(language, server(reviewed));
    const body = view.getByTestId('qandeel-introductions-body');
    const toEnd = jest.spyOn(ReactNative.ScrollView.prototype, 'scrollToEnd').mockImplementation(() => undefined);
    // A prototype spy keeps its history across tests: start the count from nothing.
    toEnd.mockClear();
    await act(async () => { body.props.onContentSizeChange(320, 1400); await flush(); });
    expect(toEnd).not.toHaveBeenCalled();
    await press(view, 'qandeel-introductions-discard');
    await act(async () => { view.getByTestId('qandeel-introductions-body').props.onContentSizeChange(320, 1600); await flush(); });
    expect(toEnd).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('qandeel-introductions-discard-cancel')).toBeTruthy();
  });

  it('read-only: the composed portrait, what was not settled marked as such, delete — and no Edit anywhere', async () => {
    const draft = emptyDraft({ facts: { ...emptyDraft().facts, firstName: { value: 'Salma', state: 'CONFIRMED' }, sex: { value: 'FEMALE', state: 'DECLARED' } } });
    const view = await surface(language, server(viewOf({ kind: 'CONFIRM_DECLARED_FACT', fact: 'SEX' }, { draft, accountDeletionPending: true })));
    expect(texts(view)).toEqual(expect.arrayContaining([copy.deletionPending, 'Salma', copy.discard]));
    expect(view.getByTestId('qandeel-introductions-open-fact:SEX').props.children).toBe(copy.female);
    expect(view.queryByTestId('qandeel-introductions-edit-group-ABOUT')).toBeNull();
    expect(view.queryByTestId('qandeel-introductions-confirm')).toBeNull();
  });
});

describe('the VIS-2 copy delta', () => {
  it('is exactly seven rows, each in both languages, plus the Product Owner\'s systemRulesNote correction', () => {
    expect(INTRODUCTIONS_COPY_DELTA.rows).toHaveLength(7);
    for (const row of INTRODUCTIONS_COPY_DELTA.rows) {
      expect(INTRODUCTIONS_COPY_ROWS[row].ar.length).toBeGreaterThan(0);
      expect(INTRODUCTIONS_COPY_ROWS[row].en.length).toBeGreaterThan(0);
    }
    expect(INTRODUCTIONS_COPY_ROWS.systemRulesNote).toEqual({
      ar: 'عند إتاحة التعارف، ستُطبَّق قواعد الأهلية المعتمدة، بما فيها السن القانونية. وهذه ليست شروطًا شخصية تختارها.',
      en: 'When Introductions becomes available, the approved eligibility rules, including the applicable legal age, will apply. These are not your personal dealbreakers.',
    });
    expect(Object.keys(INTRODUCTIONS_COPY_ROWS)).toHaveLength(94 + 7);
  });
});
