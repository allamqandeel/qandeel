/**
 * S6-04 — «مقترحات التعارف» / Introduction proposals on the device, in Arabic and English: the neutral space and card,
 * the review with what forward approval means, the three decisions and their short confirmations, the second recipient
 * who may only decline, the closed launch seam, the neutral endings, the loading / empty / unavailable / offline states,
 * Back level by level, the screen reader's heading on every level, 44-point targets — the quiet entry and cue — and the
 * transport's strict decoding, the controller's retry identity, and the copy gate's parity with LANG-01.
 *
 * The appearance is the REAL authority; the controller is the REAL controller over a scripted transport.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo, BackHandler, StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import {
  IntroductionProposalsApiClient, type PrivateProposal, type ProposalDecision, type ProposalDecisionKind, type ProposalsRead,
} from '../../runtime-entry';
import {
  IntroductionsEntry, ProposalsCue, ProposalsSurface, PROPOSALS_COPY_GATE, PROPOSALS_COPY_ROWS, PROPOSALS_LANG01_APPROVED,
  createIntroductionsController, createProposalsController, proposalsCopy, type ProposalsController,
} from '..';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const V1 = '33333333-3333-4333-8333-333333333333';
const V2 = '44444444-4444-4444-8444-444444444444';
const flush = () => new Promise((resolve) => setImmediate(resolve));
const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const AMENDMENT = readFileSync(join(__dirname, '../../../../../docs/design/i-08b3.1-g2.3/G2_3_LANG01_MATCHING_COPY_CONTROLLED_AMENDMENT.md'), 'utf8');
const COPY_SOURCE = readFileSync(join(__dirname, '../proposals-copy.ts'), 'utf8');

const proposal = (over: Partial<PrivateProposal> = {}): PrivateProposal => ({
  proposalId: P1, viewId: V1, status: 'AWAITING_YOU', actions: ['APPROVE_FORWARD', 'DECLINE'], ...over,
});

function server(initial: readonly PrivateProposal[], next: string | null = null) {
  let page: ProposalsRead = { kind: 'READ', proposals: initial, next };
  const decisions: { kind: ProposalDecisionKind; proposalId: string; commandId: string; viewId: string }[] = [];
  const answers: ProposalDecision[] = [];
  const reads: (string | null)[] = [];
  const pages: ProposalsRead[] = [];
  return {
    decisions, reads,
    set(read: ProposalsRead) { page = read; },
    then(read: ProposalsRead) { pages.push(read); },
    answer(decision: ProposalDecision) { answers.push(decision); },
    transport: {
      list: async (after: string | null) => { reads.push(after); return pages.shift() ?? page; },
      decide: async (kind: ProposalDecisionKind, proposalId: string, commandId: string, viewId: string) => {
        decisions.push({ kind, proposalId, commandId, viewId });
        return answers.shift() ?? { kind: 'ANSWERED' as const, outcome: 'RECORDED' as const, proposal: null };
      },
    },
  };
}

function appearance() {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({}), system: { current: () => 'DARK', subscribe: () => () => undefined }, native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
}

async function space(language: ChromeLanguage, fake: ReturnType<typeof server>) {
  const controller = createProposalsController({ transport: fake.transport, isCurrent: () => true });
  const onBack = jest.fn();
  const view = await render(
    <AppearanceProvider authority={appearance()}>
      <ProposalsSurface controller={controller} language={language} insets={INSETS} onBack={onBack} />
    </AppearanceProvider>,
  );
  await act(async () => { await flush(); });
  return { view, controller, onBack };
}

async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => { await flush(); });
}
const words = (view: RenderResult) => view.getAllByText(/.+/u).map((node) => String(node.props.children));
/** Every word on screen is a row of this gate: nothing about anyone can be drawn. */
function onlyCopy(view: RenderResult, language: ChromeLanguage) {
  const allowed = new Set(Object.values(PROPOSALS_COPY_ROWS).map((pair) => pair[language]));
  for (const word of words(view)) expect(allowed.has(word)).toBe(true);
}
const ACCEPT = /accept|قبول|أقبل|أوافق على بدء/iu;

afterEach(() => jest.restoreAllMocks());

describe.each(['ar', 'en'] as const)('%s — Introduction proposals', (language) => {
  const copy = proposalsCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';

  it('the space: a neutral card per delivered proposal, its status, and nothing about anyone', async () => {
    const { view } = await space(language, server([proposal(), proposal({ proposalId: P2, viewId: V2, status: 'NO_LONGER_AVAILABLE', actions: [] })]));
    expect(words(view)).toEqual([copy.spaceTitle, copy.spaceTitle, copy.spaceIntro, copy.cardTitle, copy.AWAITING_YOU, copy.cardTitle, copy.NO_LONGER_AVAILABLE]);
    onlyCopy(view, language);
    expect(style(view.getByTestId('qandeel-proposals')).direction).toBe(writing);
    const card = view.getByTestId(`qandeel-proposals-card-${P1}`);
    expect(card.props.accessibilityLabel).toBe(`${copy.cardTitle}${language === 'ar' ? '، ' : ', '}${copy.AWAITING_YOU}`);
    expect(card.props.accessibilityRole).toBe('button');
    expect(Number(style(card).minHeight)).toBeGreaterThanOrEqual(44);
    expect(view.getByTestId('qandeel-proposals-heading').props.accessibilityRole).toBe('header');
  });

  it('loading, empty, unavailable and offline are each said plainly; trying again reads afresh', async () => {
    const fake = server([]);
    const { view } = await space(language, fake);
    expect(view.getByTestId('qandeel-proposals-empty')).toBeTruthy();
    expect(words(view)).toContain(copy.empty);
    fake.set({ kind: 'OFFLINE' });
    await act(async () => { view.getByTestId('qandeel-proposals'); });
    const offline = await space(language, (() => { const f = server([]); f.set({ kind: 'OFFLINE' }); return f; })());
    expect(words(offline.view)).toContain(copy.offline);
    const unavailable = await space(language, (() => { const f = server([]); f.set({ kind: 'UNAVAILABLE' }); return f; })());
    expect(words(unavailable.view)).toContain(copy.unavailable);
    await press(unavailable.view, 'qandeel-proposals-retry');
    expect(unavailable.view.getByTestId('qandeel-proposals-unavailable')).toBeTruthy();
    const loading = createProposalsController({ transport: { list: () => new Promise<ProposalsRead>(() => undefined), decide: fake.transport.decide }, isCurrent: () => true });
    const pending = await render(<AppearanceProvider authority={appearance()}><ProposalsSurface controller={loading} language={language} insets={INSETS} onBack={() => undefined} /></AppearanceProvider>);
    expect(pending.getByTestId('qandeel-proposals-loading').props.accessibilityState).toEqual({ busy: true });
    expect(words(pending)).toContain(copy.loading);
  });

  it('the first recipient\'s review: QANDEEL\'s view, its role, what allowing means, the privacy promise; allow and decline only', async () => {
    const { view } = await space(language, server([proposal()]));
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
    await press(view, `qandeel-proposals-card-${P1}`);
    expect(focus).toHaveBeenCalled();
    expect(words(view)).toEqual([copy.spaceTitle, copy.cardTitle, copy.AWAITING_YOU, copy.reviewLead, copy.qandeelRole,
      copy.forwardTitle, copy.forwardMeaning, copy.forwardNotYet, copy.forwardMutual, copy.forwardWithdrawNote, copy.privacy,
      copy.allowAction, copy.declineAction]);
    onlyCopy(view, language);
    expect(words(view).join(' ')).not.toMatch(ACCEPT);
    expect(view.queryByTestId('qandeel-proposals-withdraw')).toBeNull();
  });

  it('forward approval: the meaning is said again before confirming; one decision on the exact view; then in progress, with withdrawal', async () => {
    const fake = server([proposal()]);
    fake.answer({ kind: 'ANSWERED', outcome: 'RECORDED', proposal: proposal({ status: 'IN_PROGRESS', actions: ['WITHDRAW'] }) });
    const { view } = await space(language, fake);
    await press(view, `qandeel-proposals-card-${P1}`);
    await press(view, 'qandeel-proposals-allow');
    expect(view.getByTestId('qandeel-proposals-confirm-APPROVE_FORWARD')).toBeTruthy();
    expect(words(view)).toEqual([copy.spaceTitle, copy.confirmTitle, copy.forwardMeaning, copy.forwardNotYet, copy.forwardMutual, copy.forwardWithdrawNote, copy.confirmAllow, copy.back]);
    expect(fake.decisions).toEqual([]);
    await press(view, 'qandeel-proposals-confirm');
    expect(fake.decisions).toEqual([{ kind: 'forward-approval', proposalId: P1, commandId: expect.stringMatching(/^[0-9a-f-]{36}$/u), viewId: V1 }]);
    expect(words(view)).toEqual([copy.spaceTitle, copy.cardTitle, copy.IN_PROGRESS, copy.inProgressBody, copy.forwardWithdrawNote, copy.withdrawAction]);
  });

  it('decline: no reason asked, a short confirmation, a calm notice, nothing left to decide', async () => {
    const fake = server([proposal()]);
    fake.answer({ kind: 'ANSWERED', outcome: 'RECORDED', proposal: proposal({ status: 'CLOSED_BY_YOU', actions: [] }) });
    const { view } = await space(language, fake);
    await press(view, `qandeel-proposals-card-${P1}`);
    await press(view, 'qandeel-proposals-decline');
    expect(words(view)).toEqual([copy.spaceTitle, copy.confirmTitle, copy.confirmDeclineBody, copy.confirm, copy.back]);
    expect(JSON.stringify(view.toJSON())).not.toMatch(/"type":"TextInput"/u);
    await press(view, 'qandeel-proposals-confirm');
    expect(fake.decisions.map((d) => d.kind)).toEqual(['decline']);
    expect(view.getByTestId('qandeel-proposals-notice-text').props.children).toBe(copy.recordedDecline);
    expect(view.getByTestId('qandeel-proposals-notice').props.accessibilityLiveRegion).toBe('polite');
    expect(view.queryByTestId('qandeel-proposals-sheet')).toBeNull();
  });

  it('withdrawal: its effect is explained before it is confirmed; it is offered only while the server offers it', async () => {
    const fake = server([proposal({ status: 'IN_PROGRESS', actions: ['WITHDRAW'] })]);
    fake.answer({ kind: 'ANSWERED', outcome: 'RECORDED', proposal: proposal({ status: 'CLOSED_BY_YOU', actions: [] }) });
    const { view } = await space(language, fake);
    await press(view, `qandeel-proposals-card-${P1}`);
    expect(view.queryByTestId('qandeel-proposals-allow')).toBeNull();
    expect(view.queryByTestId('qandeel-proposals-decline')).toBeNull();
    await press(view, 'qandeel-proposals-withdraw');
    expect(words(view)).toContain(copy.confirmWithdrawBody);
    await press(view, 'qandeel-proposals-confirm');
    expect(fake.decisions.map((d) => [d.kind, d.viewId])).toEqual([['withdrawal', V1]]);
    expect(view.getByTestId('qandeel-proposals-notice-text').props.children).toBe(copy.recordedWithdraw);
  });

  it('the second recipient may only decline: acceptance is not offered, and nothing says what the other person did', async () => {
    const { view } = await space(language, server([proposal({ actions: ['DECLINE'] })]));
    await press(view, `qandeel-proposals-card-${P1}`);
    expect(words(view)).toEqual([copy.spaceTitle, copy.cardTitle, copy.AWAITING_YOU, copy.reviewLead, copy.qandeelRole,
      copy.acceptNotYet, copy.privacy, copy.declineAction]);
    expect(view.queryByTestId('qandeel-proposals-allow')).toBeNull();
    expect(words(view).filter((w) => w !== copy.acceptNotYet).join(' ')).not.toMatch(ACCEPT);
  });

  it('with the launch seam closed no consequential button is drawn; the review says so neutrally', async () => {
    const { view } = await space(language, server([proposal({ actions: [] })]));
    await press(view, `qandeel-proposals-card-${P1}`);
    expect(view.getByTestId('qandeel-proposals-paused')).toBeTruthy();
    expect(view.queryByTestId('qandeel-proposals-sheet')).toBeNull();
  });

  it.each([
    ['NO_LONGER_AVAILABLE', 'unavailableBody'], ['CLOSED_BY_YOU', 'closedBody'], ['MATCH_CONCLUDED', 'concludedBody'],
  ] as const)('%s is said neutrally, with no decision and no reason', async (status, line) => {
    const { view } = await space(language, server([proposal({ status, actions: [] })]));
    await press(view, `qandeel-proposals-card-${P1}`);
    expect(words(view)).toEqual([copy.spaceTitle, copy.cardTitle, copy[status], copy[line]]);
    expect(view.queryByTestId('qandeel-proposals-sheet')).toBeNull();
  });

  it('a decision on a view that changed decides nothing: a calm notice, and the current answer is shown', async () => {
    const fake = server([proposal()]);
    fake.answer({ kind: 'ANSWERED', outcome: 'CHANGED', proposal: proposal({ viewId: V2, status: 'NO_LONGER_AVAILABLE', actions: [] }) });
    const { view } = await space(language, fake);
    await press(view, `qandeel-proposals-card-${P1}`);
    await press(view, 'qandeel-proposals-allow');
    await press(view, 'qandeel-proposals-confirm');
    expect(view.getByTestId('qandeel-proposals-notice-text').props.children).toBe(copy.changed);
    expect(view.getByTestId('qandeel-proposals-status-body').props.children).toBe(copy.unavailableBody);
  });

  it('a lost answer is said, keeps the confirmation, and is asked again with the SAME command id', async () => {
    const fake = server([proposal()]);
    fake.answer({ kind: 'FAILED' });
    const { view } = await space(language, fake);
    await press(view, `qandeel-proposals-card-${P1}`);
    await press(view, 'qandeel-proposals-decline');
    await press(view, 'qandeel-proposals-confirm');
    expect(view.getByTestId('qandeel-proposals-notice-text').props.children).toBe(copy.failed);
    expect(view.getByTestId('qandeel-proposals-confirm-DECLINE')).toBeTruthy();
    await press(view, 'qandeel-proposals-confirm');
    expect(fake.decisions).toHaveLength(2);
    expect(fake.decisions[1].commandId).toBe(fake.decisions[0].commandId);
  });

  it('Back walks back one level at a time, Android system Back too, and leaves only from the space', async () => {
    const handlers: (() => boolean)[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      handlers.push(handler as () => boolean);
      return { remove: () => undefined };
    });
    const { view, onBack } = await space(language, server([proposal()]));
    await press(view, `qandeel-proposals-card-${P1}`);
    await press(view, 'qandeel-proposals-decline');
    await act(async () => { handlers[handlers.length - 1](); await flush(); });
    expect(view.getByTestId('qandeel-proposals-review')).toBeTruthy();
    await press(view, 'qandeel-proposals-back');
    expect(view.getByTestId('qandeel-proposals-space')).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
    await press(view, 'qandeel-proposals-back');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('more pages are read only when asked, after the last proposal shown', async () => {
    const fake = server([proposal()], P1);
    fake.then({ kind: 'READ', proposals: [proposal()], next: P1 });
    fake.then({ kind: 'READ', proposals: [proposal({ proposalId: P2, viewId: V2, status: 'CLOSED_BY_YOU', actions: [] })], next: null });
    const { view } = await space(language, fake);
    await press(view, 'qandeel-proposals-more');
    expect(fake.reads).toEqual([null, P1]);
    expect(view.getByTestId(`qandeel-proposals-card-${P2}`)).toBeTruthy();
    expect(view.queryByTestId('qandeel-proposals-more')).toBeNull();
  });
});

describe('the quiet entry and cue (D1, D11)', () => {
  const preparation = (available: boolean) => ({
    availability: async () => ({ kind: 'READ' as const, availability: { preparation: available, assistance: false, hasDraft: false } }),
    read: async () => ({ kind: 'UNAVAILABLE' as const }),
    command: async () => ({ kind: 'FAILED' as const }), discard: async () => ({ kind: 'FAILED' as const }),
    grantAssistance: async () => ({ kind: 'FAILED' as const }), revokeAssistance: async () => ({ kind: 'FAILED' as const }),
  });
  async function entry(proposals: ProposalsController | undefined, available = false) {
    const controller = createIntroductionsController({ transport: preparation(available), isCurrent: () => true });
    const view = await render(<AppearanceProvider authority={appearance()}><IntroductionsEntry controller={controller} proposals={proposals} language="ar" onOpen={() => undefined} /></AppearanceProvider>);
    await act(async () => { await flush(); });
    return view;
  }
  const proposalsOf = (list: readonly PrivateProposal[]) => createProposalsController({ transport: server(list).transport, isCurrent: () => true });

  it('without proposals the entry is exactly the S6-01 entry; nothing is drawn while nothing exists', async () => {
    expect((await entry(undefined)).queryByTestId('qandeel-introductions-entry')).toBeNull();
    expect((await entry(proposalsOf([]))).queryByTestId('qandeel-introductions-entry')).toBeNull();
    expect((await entry(proposalsOf([]), true)).getByTestId('qandeel-introductions-entry').props.accessibilityLabel).toBe('التعارف مع قنديل');
  });

  it('a waiting proposal draws the entry with one quiet mark, and the screen reader hears the arrival once in its label', async () => {
    const view = await entry(proposalsOf([proposal()]));
    expect(view.getByTestId('qandeel-introductions-entry').props.accessibilityLabel).toBe(`التعارف مع قنديل، ${proposalsCopy('ar').arrival}`);
    expect(view.getByTestId('qandeel-introductions-entry-waiting', { includeHiddenElements: true })).toBeTruthy();
    const ended = await entry(proposalsOf([proposal({ status: 'CLOSED_BY_YOU', actions: [] })]));
    expect(ended.getByTestId('qandeel-introductions-entry')).toBeTruthy();
    expect(ended.queryByTestId('qandeel-introductions-entry-waiting', { includeHiddenElements: true })).toBeNull();
  });

  it('the cue says the arrival only while a proposal waits, and otherwise offers only the way back to the space', async () => {
    for (const [list, arrival] of [[[proposal()], true], [[proposal({ status: 'IN_PROGRESS', actions: ['WITHDRAW'] })], false], [[], null]] as const) {
      const controller = proposalsOf(list);
      controller.refresh();
      const onOpen = jest.fn();
      const view = await render(<AppearanceProvider authority={appearance()}><ProposalsCue controller={controller} language="en" onOpen={onOpen} /></AppearanceProvider>);
      await act(async () => { await flush(); });
      if (arrival === null) { expect(view.queryByTestId('qandeel-proposals-cue')).toBeNull(); continue; }
      expect(view.queryByTestId('qandeel-proposals-arrival') !== null).toBe(arrival);
      await press(view, 'qandeel-proposals-open');
      expect(onOpen).toHaveBeenCalledTimes(1);
    }
  });
});

describe('the controller', () => {
  it('a decision the server did not offer is never sent; one decision at a time; a retired controller answers nothing', async () => {
    const fake = server([proposal({ actions: ['DECLINE'] })]);
    const controller = createProposalsController({ transport: fake.transport, isCurrent: () => true });
    controller.refresh();
    await act(async () => { await flush(); });
    expect(await controller.decide(P1, 'APPROVE_FORWARD')).toBe(false);
    expect(await controller.decide(P1, 'WITHDRAW')).toBe(false);
    expect(await controller.decide(P2, 'DECLINE')).toBe(false);
    expect(fake.decisions).toEqual([]);
    controller.retire();
    expect(await controller.decide(P1, 'DECLINE')).toBe(false);
    expect(fake.decisions).toEqual([]);
  });

  it('a read in flight when a decision is taken is dropped, never laid over the answer of the decision', async () => {
    const fake = server([proposal()]);
    let release: (read: ProposalsRead) => void = () => undefined;
    let reads = 0;
    const controller = createProposalsController({
      transport: {
        // The first read answers at once; the second answers only after the decision, with the page from before it.
        list: (after) => (++reads === 1 ? fake.transport.list(after) : new Promise<ProposalsRead>((resolve) => { release = resolve; })),
        decide: async () => ({ kind: 'ANSWERED' as const, outcome: 'RECORDED' as const, proposal: proposal({ status: 'IN_PROGRESS', actions: ['WITHDRAW'] }) }),
      },
      isCurrent: () => true,
    });
    controller.refresh();
    await act(async () => { await flush(); });
    controller.refresh();
    await controller.decide(P1, 'APPROVE_FORWARD');
    release({ kind: 'READ', proposals: [proposal()], next: null });
    await act(async () => { await flush(); });
    expect(controller.getState().proposals).toEqual([proposal({ status: 'IN_PROGRESS', actions: ['WITHDRAW'] })]);
  });

  it('a decision answered without the proposal keeps the list and reads it again', async () => {
    const fake = server([proposal()]);
    fake.answer({ kind: 'ANSWERED', outcome: 'RECORDED', proposal: null });
    const controller = createProposalsController({ transport: fake.transport, isCurrent: () => true });
    controller.refresh();
    await act(async () => { await flush(); });
    fake.set({ kind: 'READ', proposals: [proposal({ status: 'CLOSED_BY_YOU', actions: [] })], next: null });
    await controller.decide(P1, 'DECLINE');
    await act(async () => { await flush(); });
    expect(fake.reads).toEqual([null, null]);
    expect(controller.getState().proposals).toEqual([proposal({ status: 'CLOSED_BY_YOU', actions: [] })]);
    expect(controller.getState().notice).toBe('RECORDED_DECLINE');
  });

  it('returning from the space puts the screen reader back on the way into it', async () => {
    const controller = createProposalsController({ transport: server([proposal()]).transport, isCurrent: () => true });
    controller.refresh();
    await act(async () => { await flush(); });
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
    await render(<AppearanceProvider authority={appearance()}><ProposalsCue controller={controller} language="ar" onOpen={() => undefined} focus /></AppearanceProvider>);
    await act(async () => { await flush(); });
    expect(focus).toHaveBeenCalledWith(4242);
  });

  it('a failed read shows nothing it cannot vouch for', async () => {
    const fake = server([proposal()]);
    const controller = createProposalsController({ transport: fake.transport, isCurrent: () => true });
    controller.refresh();
    await act(async () => { await flush(); });
    fake.set({ kind: 'OFFLINE' });
    controller.refresh();
    await act(async () => { await flush(); });
    expect(controller.getState()).toMatchObject({ status: 'OFFLINE', proposals: [] });
  });
});

describe('the transport decodes strictly', () => {
  const answer = (status: number, body: unknown) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const wire = { proposals: [{ proposalId: P1, viewId: V1, status: 'AWAITING_YOU', actions: ['APPROVE_FORWARD', 'DECLINE'] }], next: null };
  it('a proposal with any other field, an unknown status or an acceptance is no answer', async () => {
    expect((await new IntroductionProposalsApiClient({ baseUrl: 'x', fetch: answer(200, wire) }).list(null)).kind).toBe('READ');
    for (const bad of [
      { ...wire, proposals: [{ ...wire.proposals[0], firstName: 'Sara' }] },
      { ...wire, proposals: [{ ...wire.proposals[0], conclusion: 'x' }] },
      { ...wire, proposals: [{ ...wire.proposals[0], status: 'FORWARDED_TO_SECOND' }] },
      { ...wire, proposals: [{ ...wire.proposals[0], actions: ['ACCEPT'] }] },
      { ...wire, next: 'not-a-cursor' },
    ]) {
      expect((await new IntroductionProposalsApiClient({ baseUrl: 'x', fetch: answer(200, bad) }).list(null)).kind).toBe('UNAVAILABLE');
    }
  });
  it('no answer at all is OFFLINE; a 400 decision is INVALID; a lost or doubtful decision answer is FAILED', async () => {
    const offline = async () => { throw new Error('offline'); };
    expect((await new IntroductionProposalsApiClient({ baseUrl: 'x', fetch: offline }).list(null)).kind).toBe('OFFLINE');
    expect(await new IntroductionProposalsApiClient({ baseUrl: 'x', fetch: answer(400, {}) }).decide('decline', P1, P2, V1)).toEqual({ kind: 'INVALID' });
    expect(await new IntroductionProposalsApiClient({ baseUrl: 'x', fetch: offline }).decide('decline', P1, P2, V1)).toEqual({ kind: 'FAILED' });
    expect(await new IntroductionProposalsApiClient({ baseUrl: 'x', fetch: answer(200, { outcome: 'MATCHED', proposal: null }) }).decide('decline', P1, P2, V1)).toEqual({ kind: 'FAILED' });
    expect(await new IntroductionProposalsApiClient({ baseUrl: 'x', fetch: answer(200, { outcome: 'RECORDED', proposal: { ...wire.proposals[0], name: 'x' } }) })
      .decide('decline', P1, P2, V1)).toEqual({ kind: 'FAILED' });
  });
  it('sends exactly the command id and the view, on the decision path, and never an identity', async () => {
    const fetch = jest.fn(answer(200, { outcome: 'RECORDED', proposal: null }));
    await new IntroductionProposalsApiClient({ baseUrl: 'https://api', fetch }).decide('forward-approval', P1, P2, V1);
    expect(fetch).toHaveBeenCalledWith(`https://api/introductions/proposals/${P1}/forward-approval`, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ commandId: P2, viewId: V1 }),
    }));
  });
});

describe('the S6-04 copy gate', () => {
  it('M-01 and M-03 are the LANG-01 approved Arabic, byte for byte; M-01 is kept but displayed nowhere (CG-2); M-02 is not used', () => {
    for (const text of [PROPOSALS_LANG01_APPROVED.M01, PROPOSALS_LANG01_APPROVED.M03]) expect(AMENDMENT).toContain(`> **${text}**`);
    expect(PROPOSALS_COPY_ROWS.privacy.ar).toBe(PROPOSALS_LANG01_APPROVED.M03);
    expect(PROPOSALS_COPY_GATE.retainedNotDisplayed).toEqual(['M-01']);
    expect(PROPOSALS_COPY_GATE.notUsed).toEqual(['M-02']);
    for (const pair of Object.values(PROPOSALS_COPY_ROWS)) {
      expect(pair.ar).not.toContain(PROPOSALS_LANG01_APPROVED.M01);
      expect(pair.ar).not.toMatch(/بناءً على فهمه/u);
      expect(pair.en).not.toMatch(/understanding of each of you/iu);
    }
    for (const pair of Object.values(PROPOSALS_COPY_ROWS)) expect(pair.ar).not.toMatch(/نقاط اتفاق/u);
  });

  it('every displayed row is marked approved; the gate is closed by the Product Owner decision of 2026-10-15', () => {
    const lines = COPY_SOURCE.split('\n').filter((line) => /^\s{2}[A-Za-z_]+: \{ ar: /u.test(line));
    expect(lines).toHaveLength(Object.keys(PROPOSALS_COPY_ROWS).length);
    for (const line of lines) expect(line).toMatch(/\/\/ APPROVED (\(Product Owner, 2026-10-15\)|— LANG-01 M-03)/u);
    expect(COPY_SOURCE).not.toMatch(/\/\/ PROPOSED/u);
    expect(PROPOSALS_COPY_GATE.status).toMatch(/— CLOSED —/u);
  });

  it('Arabic is simplified MSA with no Latin letter (no English word to reorder); English carries no Arabic letter', () => {
    const dialect = /(^|\s)(خد|براحتك|خليني|اللي|إيه|ايه|علشان|عشان|ليك|مش|ده|دي|لسه|شوية|حاجة|عايز|بتاع)(\s|[.،؟]|$)/u;
    for (const pair of Object.values(PROPOSALS_COPY_ROWS)) {
      expect(pair.ar).not.toMatch(/[A-Za-z]/u);
      expect(pair.ar).not.toMatch(dialect);
      expect(pair.en).not.toMatch(/[؀-ۿ]/u);
    }
  });

  it('no row ranks, scores, compares, reveals a person or claims an analysis that did not happen', () => {
    for (const pair of Object.values(PROPOSALS_COPY_ROWS)) {
      expect(pair.en).not.toMatch(/%|percent|score|rank|best|compatib|match rate|swipe|candidate|photo|age|profile/iu);
      expect(pair.ar).not.toMatch(/٪|%|نسبة|درجة|ترتيب|الأفضل|توافق|مرشح|صورة|عمر|ملف/u);
    }
  });
});
