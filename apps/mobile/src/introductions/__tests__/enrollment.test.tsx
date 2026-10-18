/**
 * S6-07 (CP3) — the governed enrollment step and the three independent consents in «التعارف مع قنديل», in Arabic and
 * English: the closed state production shows; ENROLL with three separate rows that show exactly the server's current
 * texts and name their exact versions, an empty optional profile included (D-CP1-1 = B); each consent withdrawn on its
 * own, also while the gate is closed or a deletion is pending; CONSENT_OUTDATED, CHANGED, the lost answer retried with the
 * same command id; RESUME, RECONFIRM_CONSENT and CORRECTION offered only in their own states; the approved words exactly;
 * and the transport's strict decoding.
 *
 * The appearance is the REAL authority; the controllers are the REAL controllers over scripted transports.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import {
  IntroductionsEnrollmentApiClient, type EnrollmentActKind, type EnrollmentActResult, type EnrollmentConsentKind, type EnrollmentRevocationResult,
  type EnrollmentView, type IntroductionsDraft, type IntroductionsView,
} from '../../runtime-entry';
import { sharedCopy } from '../../shared-world/copy';
import {
  ENROLLMENT_COPY_GATE, ENROLLMENT_COPY_ROWS, IntroductionsSurface, createEnrollmentController, createIntroductionsController, enrollmentCopy, enrollmentOffer,
  introductionsCopy,
} from '..';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const AT = '2026-10-18T10:00:00.000Z';
const TEXT = {
  participation: { version: 'S6_07_TEST_PARTICIPATION_V1', textAr: 'نص اختباري للمشاركة', textEn: 'A test participation text' },
  contextGrant: { version: 'S6_07_TEST_CONTEXT_V1', textAr: 'نص اختباري للسياق', textEn: 'A test context text' },
  disclosureAuthority: { version: 'S6_07_TEST_DISCLOSURE_V1', textAr: 'نص اختباري للعرض', textEn: 'A test disclosure text' },
} as const;

// A reviewed draft with NEITHER optional profile field (D-CP1-1 = B): enrollment never asks for one.
const reviewedDraft = (version = 7): IntroductionsDraft => ({
  version,
  facts: {
    firstName: { value: 'Mona', state: 'CONFIRMED' }, sex: { value: 'FEMALE', state: 'CONFIRMED' },
    birthYearMonth: { year: 1994, month: 4, state: 'CONFIRMED' }, area: { countryCode: 'EG', regionCode: null, state: 'CONFIRMED' },
    maritalStatus: { value: 'NEVER_MARRIED', state: 'CONFIRMED' },
  },
  profile: { shortIntroduction: null, workField: null },
  requirements: { hard: { answer: 'NONE_ADDITIONAL', items: [] }, soft: { answer: 'NONE', items: [] }, discrepancies: [] },
  notes: [], skippedSteps: [], review: { state: 'REVIEWED' },
});
const preparationOf = (draft: IntroductionsDraft | null, over: Partial<IntroductionsView> = {}): IntroductionsView => ({
  availability: { preparation: true, assistance: false },
  accountDeletionPending: false,
  assistance: { consent: 'NOT_GRANTED', currentVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1' },
  draft,
  priorItems: [],
  plan: { path: 'NEW', stage: draft === null ? 'NOT_STARTED' : 'REVIEWED', next: null },
  ...over,
});
const closedView = (over: Partial<EnrollmentView> = {}): EnrollmentView => ({
  available: false, accountDeletionPending: false,
  consents: { participation: null, contextGrant: null, disclosureAuthority: null },
  setup: { participationState: 'OFF', pauseReason: null, contextGrant: false, disclosureAuthority: false, matchable: false },
  enrollment: null,
  ...over,
});
const openView = (over: Partial<EnrollmentView> = {}): EnrollmentView => closedView({ available: true, consents: { ...TEXT }, ...over });
const enrolledView = (over: Partial<EnrollmentView> = {}, enrolledDraftVersion = 7): EnrollmentView => openView({
  setup: { participationState: 'ACTIVE', pauseReason: null, contextGrant: true, disclosureAuthority: true, matchable: true },
  enrollment: { enrolledDraftVersion, lastAct: 'ENROLL', lastActAt: AT },
  ...over,
});
const withSetup = (view: EnrollmentView, setup: Partial<EnrollmentView['setup']>): EnrollmentView => ({ ...view, setup: { ...view.setup, ...setup } });

function enrollmentServer(initial: EnrollmentView) {
  let view = initial;
  const acts: { id: string; kind: EnrollmentActKind; draft: number | null; consents: Record<EnrollmentConsentKind, string | null> }[] = [];
  const revocations: { id: string; consent: EnrollmentConsentKind }[] = [];
  const actAnswers: EnrollmentActResult[] = [];
  const revokeAnswers: EnrollmentRevocationResult[] = [];
  let reads = 0;
  return {
    acts, revocations, get reads() { return reads; },
    set(next: EnrollmentView) { view = next; },
    answerAct(answer: EnrollmentActResult) { actAnswers.push(answer); },
    answerRevoke(answer: EnrollmentRevocationResult) { revokeAnswers.push(answer); },
    transport: {
      read: async () => { reads += 1; return { kind: 'READ' as const, view }; },
      act: async (id: string, kind: EnrollmentActKind, draft: number | null, consents: Record<EnrollmentConsentKind, string | null>) => {
        acts.push({ id, kind, draft, consents: { ...consents } });
        const scripted = actAnswers.shift();
        if (scripted !== undefined) { if (scripted.kind === 'ANSWERED') view = scripted.view; return scripted; }
        if (kind === 'ENROLL') view = enrolledView({}, draft ?? 1);
        return { kind: 'ANSWERED' as const, outcome: kind === 'ENROLL' ? 'ENROLLED' as const : 'RECONFIRMED' as const, view };
      },
      revoke: async (id: string, consent: EnrollmentConsentKind) => {
        revocations.push({ id, consent });
        const scripted = revokeAnswers.shift();
        if (scripted !== undefined) { if (scripted.kind === 'ANSWERED') view = scripted.view; return scripted; }
        view = withSetup(view, consent === 'participation' ? { participationState: 'OFF', matchable: false }
          : consent === 'contextGrant' ? { contextGrant: false, matchable: false } : { disclosureAuthority: false, matchable: false });
        return { kind: 'ANSWERED' as const, outcome: 'REVOKED' as const, view };
      },
    },
  };
}

async function surface(language: ChromeLanguage, preparation: IntroductionsView, fake: ReturnType<typeof enrollmentServer>, ids?: string[]) {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({}),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  let prepReads = 0;
  const introductions = createIntroductionsController({
    transport: {
      availability: async () => ({ kind: 'READ' as const, availability: { preparation: true, assistance: false, hasDraft: preparation.draft !== null } }),
      read: async () => { prepReads += 1; return { kind: 'READ' as const, view: preparation }; },
      command: async () => ({ kind: 'FAILED' as const }),
      discard: async () => ({ kind: 'FAILED' as const }),
      grantAssistance: async () => ({ kind: 'FAILED' as const }),
      revokeAssistance: async () => ({ kind: 'FAILED' as const }),
    },
    isCurrent: () => true,
  });
  let n = 0;
  const enrollment = createEnrollmentController({
    transport: fake.transport, isCurrent: () => true,
    newCommandId: () => ids?.[n++] ?? `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  });
  const view = await render(
    <AppearanceProvider authority={authority}>
      <IntroductionsSurface controller={introductions} language={language} insets={INSETS} onBack={() => undefined} enrollment={enrollment} />
    </AppearanceProvider>,
  );
  await act(async () => { await flush(); });
  return { view, enrollment, prepReads: () => prepReads };
}

async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => { await flush(); });
}
const disabled = (view: RenderResult, testID: string) => view.getByTestId(testID).props.accessibilityState?.disabled === true;
const textOf = (view: RenderResult, testID: string) => String(view.getByTestId(testID).props.children);

describe.each(['ar', 'en'] as const)('%s — the governed enrollment step', (language) => {
  const copy = enrollmentCopy(language);
  const prep = introductionsCopy(language);
  const textKey = language === 'ar' ? 'textAr' : 'textEn';

  it('production (closed gate, no consent text): the S6-01 sentence stays, and no step, consent or act is drawn', async () => {
    const fake = enrollmentServer(closedView());
    const { view } = await surface(language, preparationOf(reviewedDraft()), fake);
    expect(textOf(view, 'qandeel-introductions-enrollment-unavailable')).toBe(prep.reviewed);
    expect(view.queryByTestId('qandeel-enrollment-step-ENROLL')).toBeNull();
    expect(view.queryByTestId('qandeel-enrollment-consents')).toBeNull();
    expect(view.queryByText(copy.heading)).toBeNull();
    expect(fake.acts).toHaveLength(0);
  });

  it('ENROLL: three separate rows with the exact server texts; the act needs all three; it names exactly their versions', async () => {
    const fake = enrollmentServer(openView());
    const { view } = await surface(language, preparationOf(reviewedDraft(7)), fake);
    expect(view.queryByTestId('qandeel-introductions-enrollment-unavailable')).toBeNull();
    expect(textOf(view, 'qandeel-enrollment-heading')).toBe(copy.heading);
    expect(view.getByText(copy.lead)).toBeTruthy();
    for (const consent of ['participation', 'contextGrant', 'disclosureAuthority'] as const) {
      expect(textOf(view, `qandeel-enrollment-consent-${consent}-text`)).toBe(TEXT[consent][textKey]);
      expect(view.getByTestId(`qandeel-enrollment-agree-${consent}`).props.accessibilityState.checked).toBe(false);
    }
    expect(view.getByText(copy.participationLabel)).toBeTruthy();
    expect(view.getByText(copy.contextGrantLabel)).toBeTruthy();
    expect(view.getByText(copy.disclosureAuthorityLabel)).toBeTruthy();
    expect(disabled(view, 'qandeel-enrollment-act-ENROLL')).toBe(true);
    await press(view, 'qandeel-enrollment-agree-participation');
    await press(view, 'qandeel-enrollment-agree-contextGrant');
    expect(disabled(view, 'qandeel-enrollment-act-ENROLL')).toBe(true);
    await press(view, 'qandeel-enrollment-act-ENROLL');
    expect(fake.acts).toHaveLength(0);
    await press(view, 'qandeel-enrollment-agree-disclosureAuthority');
    expect(disabled(view, 'qandeel-enrollment-act-ENROLL')).toBe(false);
    await press(view, 'qandeel-enrollment-act-ENROLL');
    expect(fake.acts).toEqual([{ id: expect.any(String), kind: 'ENROLL', draft: 7,
      consents: { participation: TEXT.participation.version, contextGrant: TEXT.contextGrant.version, disclosureAuthority: TEXT.disclosureAuthority.version } }]);
    expect(textOf(view, 'qandeel-enrollment-notice-enrolled')).toBe(copy.enrolled);
    expect(view.queryByTestId('qandeel-enrollment-step-ENROLL')).toBeNull();
    for (const consent of ['participation', 'contextGrant', 'disclosureAuthority'] as const) {
      expect(view.getByTestId(`qandeel-enrollment-consent-state-${consent}-given`).props.children).toBe(copy.given);
    }
  });

  it.each([
    ['participation', 'withdrawParticipation'],
    ['contextGrant', 'withdrawContextGrant'],
    ['disclosureAuthority', 'withdrawDisclosureAuthority'],
  ] as const)('withdrawing %s alone: its own confirmation, ONE revocation, the other two untouched', async (consent, body) => {
    const fake = enrollmentServer(enrolledView());
    const { view } = await surface(language, preparationOf(reviewedDraft(7)), fake);
    await press(view, `qandeel-enrollment-withdraw-${consent}`);
    const confirm = view.getByTestId(`qandeel-enrollment-withdraw-confirm-${consent}`);
    expect(confirm).toBeTruthy();
    expect(view.getByText(copy.withdrawTitle)).toBeTruthy();
    expect(view.getByText(copy[body])).toBeTruthy();
    expect(view.getByTestId(`qandeel-enrollment-withdraw-cancel-${consent}`)).toBeTruthy();
    expect(view.getByText(sharedCopy(language).cancel)).toBeTruthy();
    await press(view, `qandeel-enrollment-withdraw-cancel-${consent}`);
    expect(view.queryByTestId(`qandeel-enrollment-withdraw-confirm-${consent}`)).toBeNull();
    expect(fake.revocations).toHaveLength(0);
    await press(view, `qandeel-enrollment-withdraw-${consent}`);
    await press(view, `qandeel-enrollment-withdraw-yes-${consent}`);
    expect(fake.revocations).toEqual([{ id: expect.any(String), consent }]);
    expect(textOf(view, 'qandeel-enrollment-consents-notice-withdrawn')).toBe(copy.withdrawn);
    expect(view.getByTestId(`qandeel-enrollment-consent-state-${consent}-not-given`).props.children).toBe(copy.notGiven);
    for (const other of (['participation', 'contextGrant', 'disclosureAuthority'] as const).filter((c) => c !== consent)) {
      expect(view.getByTestId(`qandeel-enrollment-consent-state-${other}-given`)).toBeTruthy();
    }
    expect(fake.acts).toHaveLength(0);
  });

  it('a pending deletion and a closed gate never block a withdrawal; no act is offered', async () => {
    const fake = enrollmentServer(enrolledView({ available: false, accountDeletionPending: true }));
    const { view } = await surface(language, preparationOf(reviewedDraft(7), { accountDeletionPending: true }), fake);
    expect(view.getByTestId('qandeel-introductions-read-only')).toBeTruthy();
    expect(view.queryByTestId(/qandeel-enrollment-act-/u)).toBeNull();
    await press(view, 'qandeel-enrollment-withdraw-contextGrant');
    await press(view, 'qandeel-enrollment-withdraw-yes-contextGrant');
    expect(fake.revocations.map((r) => r.consent)).toEqual(['contextGrant']);
  });

  it('an enrolled reader while the gate is closed sees EN-10, never the S6-01 "not available yet"', async () => {
    const fake = enrollmentServer(enrolledView({ available: false, consents: { participation: null, contextGrant: null, disclosureAuthority: null } }));
    const { view } = await surface(language, preparationOf(reviewedDraft(9)), fake);
    expect(textOf(view, 'qandeel-enrollment-closed')).toBe(copy.closed);
    expect(view.queryByTestId('qandeel-introductions-enrollment-unavailable')).toBeNull();
    expect(view.queryByTestId(/qandeel-enrollment-act-/u)).toBeNull();
  });

  it('CONSENT_OUTDATED: the new text is shown with nothing agreed, and the next act names the NEW version', async () => {
    const fake = enrollmentServer(openView());
    const { view } = await surface(language, preparationOf(reviewedDraft(7)), fake);
    const renewed = { version: 'S6_07_TEST_PARTICIPATION_V2', textAr: 'نص اختباري جديد للمشاركة', textEn: 'A new test participation text' };
    fake.answerAct({ kind: 'ANSWERED', outcome: 'CONSENT_OUTDATED', view: openView({ consents: { ...TEXT, participation: renewed } }) });
    for (const consent of ['participation', 'contextGrant', 'disclosureAuthority'] as const) await press(view, `qandeel-enrollment-agree-${consent}`);
    await press(view, 'qandeel-enrollment-act-ENROLL');
    expect(textOf(view, 'qandeel-enrollment-notice-consentOutdated')).toBe(copy.consentOutdated);
    expect(textOf(view, 'qandeel-enrollment-consent-participation-text')).toBe(renewed[textKey]);
    expect(view.getByTestId('qandeel-enrollment-agree-participation').props.accessibilityState.checked).toBe(false);
    expect(disabled(view, 'qandeel-enrollment-act-ENROLL')).toBe(true);
    for (const consent of ['participation', 'contextGrant', 'disclosureAuthority'] as const) await press(view, `qandeel-enrollment-agree-${consent}`);
    await press(view, 'qandeel-enrollment-act-ENROLL');
    expect(fake.acts.map((a) => a.consents.participation)).toEqual([TEXT.participation.version, renewed.version]);
  });

  it('CHANGED: EN-12, and the preparation is read again', async () => {
    const fake = enrollmentServer(openView());
    const { view, prepReads } = await surface(language, preparationOf(reviewedDraft(7)), fake);
    const before = prepReads();
    fake.answerAct({ kind: 'ANSWERED', outcome: 'CHANGED', view: openView() });
    for (const consent of ['participation', 'contextGrant', 'disclosureAuthority'] as const) await press(view, `qandeel-enrollment-agree-${consent}`);
    await press(view, 'qandeel-enrollment-act-ENROLL');
    expect(textOf(view, 'qandeel-enrollment-notice-changed')).toBe(copy.changed);
    expect(prepReads()).toBe(before + 1);
  });
});

describe('the one act offered, in its own state only', () => {
  const draft = reviewedDraft(7);
  it('nothing while the gate is closed or a deletion is pending; nothing without a reviewed draft', () => {
    expect(enrollmentOffer(closedView(), draft)).toBeNull();
    expect(enrollmentOffer(openView({ accountDeletionPending: true }), draft)).toBeNull();
    expect(enrollmentOffer(openView(), null)).toBeNull();
    expect(enrollmentOffer(openView(), { ...draft, review: { state: 'CHANGED_SINCE_REVIEW' } })).toBeNull();
  });
  it('ENROLL needs only a reviewed draft — an empty optional profile is enough (D-CP1-1 = B)', () => {
    expect(draft.profile).toEqual({ shortIntroduction: null, workField: null });
    expect(enrollmentOffer(openView(), draft)).toEqual({ kind: 'ENROLL', consents: ['participation', 'contextGrant', 'disclosureAuthority'], draftVersion: 7 });
  });
  it('RESUME only for a USER_PAUSED participation, with the participation consent only', () => {
    expect(enrollmentOffer(withSetup(enrolledView(), { participationState: 'PAUSED', pauseReason: 'USER_PAUSED' }), draft))
      .toEqual({ kind: 'RESUME', consents: ['participation'], draftVersion: null });
    for (const pauseReason of ['ACTIVE_INTRODUCTION', 'POST_INTRODUCTION', 'POST_SUCCESS', 'SYSTEM_POLICY'] as const) {
      expect(enrollmentOffer(withSetup(enrolledView(), { participationState: 'PAUSED', pauseReason }), draft)?.kind).not.toBe('RESUME');
    }
  });
  it('RECONFIRM_CONSENT for exactly the consents not in force; CORRECTION only for a newer reviewed draft', () => {
    expect(enrollmentOffer(withSetup(enrolledView(), { contextGrant: false }), draft)).toEqual({ kind: 'RECONFIRM_CONSENT', consents: ['contextGrant'], draftVersion: null });
    expect(enrollmentOffer(withSetup(enrolledView(), { disclosureAuthority: false }), draft)).toEqual({ kind: 'RECONFIRM_CONSENT', consents: ['disclosureAuthority'], draftVersion: null });
    expect(enrollmentOffer(enrolledView({}, 7), draft)).toBeNull();
    expect(enrollmentOffer(enrolledView({}, 5), draft)).toEqual({ kind: 'CORRECTION', consents: ['disclosureAuthority'], draftVersion: 7 });
    expect(enrollmentOffer(enrolledView({}, 5), draft, 7)).toBeNull();
    // Participation withdrawn (OFF): enrolling again asks for all three consents.
    expect(enrollmentOffer(withSetup(enrolledView(), { participationState: 'OFF' }), draft)?.kind).toBe('ENROLL');
  });
});

describe('the acts and their answers (Arabic)', () => {
  const copy = enrollmentCopy('ar');
  it('RESUME names only the participation version; RESUMED is EN-18', async () => {
    const fake = enrollmentServer(withSetup(enrolledView(), { participationState: 'PAUSED', pauseReason: 'USER_PAUSED' }));
    fake.answerAct({ kind: 'ANSWERED', outcome: 'RESUMED', view: enrolledView() });
    const { view } = await surface('ar', preparationOf(reviewedDraft(7)), fake);
    expect(view.queryByTestId('qandeel-enrollment-consent-contextGrant')).toBeNull();
    await press(view, 'qandeel-enrollment-agree-participation');
    await press(view, 'qandeel-enrollment-act-RESUME');
    expect(fake.acts).toEqual([{ id: expect.any(String), kind: 'RESUME', draft: null, consents: { participation: TEXT.participation.version, contextGrant: null, disclosureAuthority: null } }]);
    expect(textOf(view, 'qandeel-enrollment-notice-resumed')).toBe(copy.resumed);
  });
  it('RECONFIRM_CONSENT re-gives exactly the withdrawn consent; RECONFIRMED is EN-20', async () => {
    const fake = enrollmentServer(withSetup(enrolledView(), { contextGrant: false }));
    fake.answerAct({ kind: 'ANSWERED', outcome: 'RECONFIRMED', view: enrolledView() });
    const { view } = await surface('ar', preparationOf(reviewedDraft(7)), fake);
    expect(textOf(view, 'qandeel-enrollment-act-RECONFIRM_CONSENT')).toBeDefined();
    await press(view, 'qandeel-enrollment-agree-contextGrant');
    await press(view, 'qandeel-enrollment-act-RECONFIRM_CONSENT');
    expect(fake.acts[0]).toMatchObject({ kind: 'RECONFIRM_CONSENT', draft: null, consents: { participation: null, contextGrant: TEXT.contextGrant.version, disclosureAuthority: null } });
    expect(textOf(view, 'qandeel-enrollment-notice-reconfirmed')).toBe(copy.reconfirmed);
  });
  it('CORRECTION confirms the newer reviewed draft with a fresh disclosure consent; NO_CHANGE stops offering it, silently', async () => {
    const fake = enrollmentServer(enrolledView({}, 5));
    fake.answerAct({ kind: 'ANSWERED', outcome: 'NO_CHANGE', view: enrolledView({}, 5) });
    const { view } = await surface('ar', preparationOf(reviewedDraft(7)), fake);
    await press(view, 'qandeel-enrollment-agree-disclosureAuthority');
    await press(view, 'qandeel-enrollment-act-CORRECTION');
    expect(fake.acts[0]).toMatchObject({ kind: 'CORRECTION', draft: 7, consents: { participation: null, contextGrant: null, disclosureAuthority: TEXT.disclosureAuthority.version } });
    expect(view.queryByTestId('qandeel-enrollment-act-CORRECTION')).toBeNull();
    expect(view.queryByTestId(/qandeel-enrollment-notice-/u)).toBeNull();
  });
  it('a lost answer: EN-21, and repeating the same act or withdrawal reuses the SAME command id', async () => {
    const fake = enrollmentServer(openView());
    fake.answerAct({ kind: 'FAILED' });
    const { view } = await surface('ar', preparationOf(reviewedDraft(7)), fake);
    for (const consent of ['participation', 'contextGrant', 'disclosureAuthority'] as const) await press(view, `qandeel-enrollment-agree-${consent}`);
    await press(view, 'qandeel-enrollment-act-ENROLL');
    expect(textOf(view, 'qandeel-enrollment-notice-failed')).toBe(copy.failed);
    await press(view, 'qandeel-enrollment-act-ENROLL');
    expect(fake.acts).toHaveLength(2);
    expect(fake.acts[1].id).toBe(fake.acts[0].id);
    fake.answerRevoke({ kind: 'FAILED' });
    await press(view, 'qandeel-enrollment-withdraw-participation');
    await press(view, 'qandeel-enrollment-withdraw-yes-participation');
    expect(textOf(view, 'qandeel-enrollment-consents-notice-failed')).toBe(copy.failed);
    // The confirmation stays open after a lost answer, to retry exactly that withdrawal.
    await press(view, 'qandeel-enrollment-withdraw-yes-participation');
    expect(fake.revocations).toHaveLength(2);
    expect(fake.revocations[1].id).toBe(fake.revocations[0].id);
    expect(fake.revocations[0].id).not.toBe(fake.acts[0].id);
  });
  it('NOT_ACTIVE and CHANGED withdrawals answer RV-12 and RV-11 with the server view', async () => {
    const fake = enrollmentServer(enrolledView());
    fake.answerRevoke({ kind: 'ANSWERED', outcome: 'NOT_ACTIVE', view: withSetup(enrolledView(), { contextGrant: false }) });
    const { view } = await surface('ar', preparationOf(reviewedDraft(7)), fake);
    await press(view, 'qandeel-enrollment-withdraw-contextGrant');
    await press(view, 'qandeel-enrollment-withdraw-yes-contextGrant');
    expect(textOf(view, 'qandeel-enrollment-consents-notice-nothingToWithdraw')).toBe(copy.nothingToWithdraw);
    fake.answerRevoke({ kind: 'ANSWERED', outcome: 'CHANGED', view: enrolledView() });
    await press(view, 'qandeel-enrollment-withdraw-participation');
    await press(view, 'qandeel-enrollment-withdraw-yes-participation');
    expect(textOf(view, 'qandeel-enrollment-consents-notice-withdrawChanged')).toBe(copy.withdrawChanged);
  });
  it('a failed enrollment read draws nothing of enrollment: the S6-01 sentence stays', async () => {
    const fake = enrollmentServer(openView());
    fake.transport.read = async () => ({ kind: 'UNAVAILABLE' as const }) as never;
    const { view } = await surface('ar', preparationOf(reviewedDraft(7)), fake);
    expect(textOf(view, 'qandeel-introductions-enrollment-unavailable')).toBe(introductionsCopy('ar').reviewed);
    expect(view.queryByTestId(/qandeel-enrollment-/u)).toBeNull();
  });
  it('the controller refuses an act whose consents were not all agreed, and never calls the server', async () => {
    const fake = enrollmentServer(openView());
    const controller = createEnrollmentController({ transport: fake.transport, isCurrent: () => true });
    controller.open();
    await act(async () => { await flush(); });
    const offer = enrollmentOffer(controller.getState().view!, reviewedDraft(7))!;
    expect(await controller.act(offer, new Set(['participation', 'contextGrant']))).toBeNull();
    expect(fake.acts).toHaveLength(0);
  });
});

describe('the approved words (CP3 Copy Gate, 2026-10-18)', () => {
  it('the five rows the Product Owner amended are used exactly as decided', () => {
    expect(ENROLLMENT_COPY_ROWS.participationLabel).toEqual({ id: 'EN-03', ar: 'المشاركة في مقترحات التعارف', en: 'Taking part in introduction proposals' });
    expect(ENROLLMENT_COPY_ROWS.withdrawParticipation).toEqual({ id: 'RV-06', ar: 'تتوقف مشاركتك في مقترحات التعارف الجديدة، دون إنهاء أي تعارف بدأ بالفعل.',
      en: 'You will stop taking part in new introduction proposals. This does not end an introduction that has already begun.' });
    expect(ENROLLMENT_COPY_ROWS.withdrawDisclosureAuthority).toEqual({ id: 'RV-08', ar: 'لن يُسمح بتمرير مقترحات جديدة إلى الطرف الآخر استنادًا إلى هذه الموافقة.',
      en: 'This consent will no longer authorize new proposals to be forwarded to the other person.' });
  });
  it('exactly EN-01 … EN-21 and RV-01 … RV-12, each once; group D is not used', () => {
    const ids = Object.values(ENROLLMENT_COPY_ROWS).map((row) => row.id);
    expect(ids).toEqual([...ENROLLMENT_COPY_GATE.approved]);
    expect(new Set(ids).size).toBe(33);
    expect(ENROLLMENT_COPY_GATE.status).toMatch(/CLOSED/u);
    expect(ENROLLMENT_COPY_GATE.notApprovedForUse).toEqual(['AC-01', 'AC-02', 'AC-03', 'AC-04', 'AC-05', 'AC-06']);
  });
  // The validation-only proof stand-in (`__validation__`, never in the production bundle) carries copies for the photographs.
  it('no consent text is shipped in the app: the reader sees only what the server installed', () => {
    const files: string[] = [];
    const walk = (dir: string) => { for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) { if (name !== '__tests__' && name !== '__validation__') walk(p); } else if (/\.tsx?$/u.test(name)) files.push(p); } };
    walk(join(__dirname, '../..'));
    const source = files.map((p) => readFileSync(p, 'utf8')).join('\n');
    for (const fragment of ['أوافق على المشاركة في مقترحات التعارف', 'أوافق على أن يستند قنديل', 'أوافق على أن يقدّم قنديل للطرف الآخر',
      'I agree to take part in the introduction proposals', 'I agree that QANDEEL may draw on', 'I agree that QANDEEL may show the other person']) {
      expect(source.includes(fragment)).toBe(false);
    }
  });
});

describe('the transport decodes strictly and sends only versions', () => {
  const answer = (body: unknown, ok = true) => jest.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => body }));
  const client = (fetch: jest.Mock) => new IntroductionsEnrollmentApiClient({ baseUrl: 'https://api.test', fetch: fetch as never });
  it('a usable view is READ; anything doubtful is UNAVAILABLE', async () => {
    expect((await client(answer(openView())).read()).kind).toBe('READ');
    expect((await client(answer({ ...openView(), extra: 1 })).read()).kind).toBe('UNAVAILABLE');
    expect((await client(answer(openView({ consents: { ...TEXT, contextGrant: null } }))).read()).kind).toBe('UNAVAILABLE');
    expect((await client(answer(openView({ consents: { ...TEXT, participation: { ...TEXT.participation, version: 'bad version' } } }))).read()).kind).toBe('UNAVAILABLE');
    expect((await client(answer(withSetup(openView(), { participationState: 'MAYBE' as never }))).read()).kind).toBe('UNAVAILABLE');
    expect((await client(answer(openView(), false)).read()).kind).toBe('UNAVAILABLE');
  });
  it('an act sends exactly the act, the reviewed version and the consent versions; a withdrawal names one consent', async () => {
    const fetch = answer({ outcome: 'ENROLLED', view: enrolledView() });
    const id = '11111111-1111-4111-8111-111111111111';
    const result = await client(fetch).act(id, 'ENROLL', 7, { participation: 'P_V1', contextGrant: 'C_V1', disclosureAuthority: 'D_V1' });
    expect(result.kind).toBe('ANSWERED');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, { method: string; body: string }];
    expect([url, init.method]).toEqual(['https://api.test/introductions/enrollment', 'POST']);
    expect(JSON.parse(init.body)).toEqual({ commandId: id, kind: 'ENROLL', expectedDraftVersion: 7, consents: { participation: 'P_V1', contextGrant: 'C_V1', disclosureAuthority: 'D_V1' } });
    const revoke = answer({ outcome: 'REVOKED', view: enrolledView() });
    expect((await client(revoke).revoke(id, 'contextGrant')).kind).toBe('ANSWERED');
    const [rurl, rinit] = revoke.mock.calls[0] as unknown as [string, { body: string }];
    expect(rurl).toBe('https://api.test/introductions/enrollment/revocation');
    expect(JSON.parse(rinit.body)).toEqual({ commandId: id, consent: 'contextGrant' });
    expect((await client(answer({ outcome: 'SOMETHING', view: enrolledView() })).act(id, 'ENROLL', 7, { participation: 'P_V1', contextGrant: 'C_V1', disclosureAuthority: 'D_V1' })).kind).toBe('FAILED');
    expect((await client(answer({ outcome: 'REVOKED', view: enrolledView() })).revoke('not-a-uuid', 'contextGrant')).kind).toBe('FAILED');
  });
});
