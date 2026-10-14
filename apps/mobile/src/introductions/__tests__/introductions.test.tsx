/**
 * S6-01 — «التعارف مع قنديل» / Introductions with QANDEEL on the device, in Arabic and English: the honest intro, the
 * separate assistance permission, the N / K / C objective paths rendered as the server plans them, the fact, sex and
 * requirement steps, the review and its plain "enrollment is not available yet", the read-only closed and deletion
 * states, notices, Back, 44-point targets, the entry that is not drawn while nothing is available — and the transport's
 * strict decoding, the controller's retry identity, and the catalogue / consent-text parity with migration 0154.
 *
 * The appearance is the REAL authority; the controller is the REAL controller over a scripted transport.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { BackHandler, StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import { IntroductionsApiClient, type IntroductionsChange, type IntroductionsDraft, type IntroductionsObjective, type IntroductionsView } from '../../runtime-entry';
import { IntroductionsEntry, IntroductionsSurface, createIntroductionsController, introductionsCopy } from '..';
import { AREA_COUNTRIES, AREA_REGIONS } from '../area-catalogue';
import { ASSISTANCE_CONSENT_TEXT, INTRODUCTIONS_COPY_GATE, INTRODUCTIONS_COPY_ROWS, INTRODUCTIONS_HISTORICAL_COPY } from '../copy';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const MEMORY = '11111111-1111-4111-8111-111111111111';
const flush = () => new Promise((resolve) => setImmediate(resolve));
const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const MIGRATION = readFileSync(join(__dirname, '../../../../../database/migrations/0154_matching_onboarding_preparation_v1.sql'), 'utf8');

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
  availability: { preparation: true, assistance: true },
  accountDeletionPending: false,
  assistance: { consent: 'NOT_GRANTED', currentVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1' },
  draft: emptyDraft(),
  priorItems: [],
  plan: { path, stage, next },
  ...over,
});

function server(initial: IntroductionsView) {
  let view = initial;
  const commands: { id: string; version: number; kind: string; payload: Record<string, unknown> }[] = [];
  const grants: { id: string; version: string }[] = [];
  const skips: string[] = [];
  const answers: IntroductionsChange[] = [];
  return {
    commands, grants, skips,
    set(next: IntroductionsView) { view = next; },
    answer(change: IntroductionsChange) { answers.push(change); },
    transport: {
      availability: async () => ({ kind: 'READ' as const, availability: { preparation: view.availability.preparation, assistance: view.availability.assistance, hasDraft: view.draft !== null } }),
      read: async () => ({ kind: 'READ' as const, view }),
      command: async (id: string, version: number, kind: string, payload: Record<string, unknown>) => {
        commands.push({ id, version, kind, payload });
        if (kind === 'SKIP_STEP') skips.push(String(payload.step));
        return answers.shift() ?? { kind: 'ANSWERED' as const, outcome: 'APPLIED', view };
      },
      discard: async () => answers.shift() ?? { kind: 'ANSWERED' as const, outcome: 'DISCARDED', view: { ...view, draft: null } },
      grantAssistance: async (id: string, version: string) => {
        grants.push({ id, version });
        return answers.shift() ?? { kind: 'ANSWERED' as const, outcome: 'GRANTED', view };
      },
      revokeAssistance: async () => answers.shift() ?? { kind: 'ANSWERED' as const, outcome: 'REVOKED', view },
    },
  };
}

async function surface(language: ChromeLanguage, fake: ReturnType<typeof server>) {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({}),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  const controller = createIntroductionsController({ transport: fake.transport, isCurrent: () => true });
  const onBack = jest.fn();
  const view = await render(
    <AppearanceProvider authority={authority}>
      <IntroductionsSurface controller={controller} language={language} insets={INSETS} onBack={onBack} />
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

afterEach(() => jest.restoreAllMocks());

describe.each(['ar', 'en'] as const)('%s — Introductions with QANDEEL', (language) => {
  const copy = introductionsCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';

  it('N — the intro says what this is, that it is private, that enrollment is not available, and nothing more', async () => {
    const { view } = await surface(language, server(viewOf({ kind: 'OFFER_ASSISTANCE' }, { draft: null }, 'NEW', 'NOT_STARTED')));
    // VIS-2: the restrained beginning — no portrait is drawn for what is not known yet (R1); the act is on the sheet.
    expect(words(view)).toEqual([copy.name, copy.opening, copy.privateNote, copy.pathNew, copy.start, copy.enrollmentUnavailable]);
    expect(view.queryByTestId('qandeel-introductions-portrait')).toBeNull();
    expect(style(view.getByTestId('qandeel-introductions')).direction).toBe(writing);
    expect(view.getByTestId('qandeel-introductions-title').props.accessibilityRole).toBe('header');
    expect(words(view).join(' ')).not.toMatch(/active|matched|eligible|نشط|مؤهل|تطابق/iu);
  });

  it('the assistance permission is its own explicit act: the exact consent text, Allow names its version, declining is kept', async () => {
    const fake = server(viewOf({ kind: 'OFFER_ASSISTANCE' }, { draft: null }, 'NEW', 'NOT_STARTED'));
    const { view } = await surface(language, fake);
    await press(view, 'qandeel-introductions-start');
    expect(view.getByTestId('qandeel-introductions-consent-text').props.children).toBe(ASSISTANCE_CONSENT_TEXT.MATCHING_ONBOARDING_ASSISTANCE_V1[language]);
    await press(view, 'qandeel-introductions-assistance-grant');
    expect(fake.grants).toEqual([{ id: expect.any(String), version: 'MATCHING_ONBOARDING_ASSISTANCE_V1' }]);
    await press(view, 'qandeel-introductions-assistance-decline');
    expect(fake.skips).toEqual(['ASSISTANCE_OFFER']);
  });

  it('K — a known item is shown in the owner\'s own words, with the tailored-questions line; confirm and correct send exactly that item', async () => {
    const item = { memoryId: MEMORY, itemClass: 'GOAL' as const, words: 'هدفي أن أبني أسرة هادئة', recency: 'CURRENT' as const };
    const fake = server(viewOf({ kind: 'CONFIRM_PRIOR_ITEM', item }, { assistance: { consent: 'GRANTED', currentVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1' }, priorItems: [item] }, 'KNOWN'));
    const { view } = await surface(language, fake);
    expect(view.getByTestId('qandeel-introductions-path').props.children).toBe(copy.pathKnown);
    expect(view.getByTestId('qandeel-introductions-prior-words').props.children).toBe('هدفي أن أبني أسرة هادئة');
    expect(words(view)).toEqual(expect.arrayContaining([copy.priorLead, copy.priorConfirmQuestion, copy.priorMemoryNote]));
    await press(view, 'qandeel-introductions-prior-yes');
    expect(fake.commands.at(-1)).toMatchObject({ kind: 'RECORD_PRIOR_UNDERSTANDING', version: 2, payload: { memoryId: MEMORY, decision: 'CONFIRMED' } });
    await press(view, 'qandeel-introductions-prior-edit');
    await act(async () => { fireEvent.changeText(view.getByTestId('qandeel-introductions-prior-correction'), 'أريد أسرة هادئة ومستقرة'); });
    await press(view, 'qandeel-introductions-save');
    expect(fake.commands.at(-1)).toMatchObject({ payload: { memoryId: MEMORY, decision: 'CORRECTED', correctedBody: 'أريد أسرة هادئة ومستقرة' } });
  });

  it('C — an older item is asked about, never presumed; the clarification line explains why', async () => {
    const item = { memoryId: MEMORY, itemClass: 'STABLE_PREFERENCE' as const, words: 'أفضّل السكن قرب أهلي', recency: 'NEEDS_RECHECK' as const };
    const fake = server(viewOf({ kind: 'CLARIFY_PRIOR_ITEM', item }, { assistance: { consent: 'GRANTED', currentVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1' }, priorItems: [item] }, 'MIXED'));
    const { view } = await surface(language, fake);
    expect(view.getByTestId('qandeel-introductions-path').props.children).toBe(copy.pathMixed);
    expect(words(view)).toEqual(expect.arrayContaining([copy.priorClarifyLead, copy.priorClarifyQuestion]));
    expect(words(view)).not.toContain(copy.priorConfirmQuestion);
    await press(view, 'qandeel-introductions-prior-no-longer');
    expect(fake.commands.at(-1)).toMatchObject({ payload: { memoryId: MEMORY, decision: 'NO_LONGER_ACCURATE' } });
  });

  it('sex is declared, then confirmed in its own act — never inferred, never confirmed by declaring it', async () => {
    const fake = server(viewOf({ kind: 'ESTABLISH_FACT', fact: 'SEX' }));
    const { view } = await surface(language, fake);
    expect(words(view)).toEqual(expect.arrayContaining([copy.sexTitle, copy.sexHint, copy.male, copy.female]));
    await press(view, 'qandeel-introductions-sex-female');
    expect(fake.commands.map((c) => c.kind)).toEqual(['SET_FACT']);
    expect(fake.commands[0].payload).toEqual({ fact: 'SEX', sex: 'FEMALE' });
    fake.set(viewOf({ kind: 'CONFIRM_DECLARED_FACT', fact: 'SEX' }, { draft: emptyDraft({ facts: { ...emptyDraft().facts, sex: { value: 'FEMALE', state: 'DECLARED' } } }) }));
    const second = await surface(language, fake);
    expect(second.view.getByTestId('qandeel-introductions-fact-value').props.children).toBe(copy.female);
    expect(words(second.view)).toContain(copy.sexConfirmQuestion);
    await press(second.view, 'qandeel-introductions-confirm');
    expect(fake.commands.at(-1)).toMatchObject({ kind: 'CONFIRM_FACT', payload: { fact: 'SEX' } });
  });

  it('dealbreakers and preferences stay apart; "no additional dealbreakers" is a valid answer; the system rules are not the owner\'s', async () => {
    const fake = server(viewOf({ kind: 'ESTABLISH_HARD_REQUIREMENTS' }));
    const { view } = await surface(language, fake);
    expect(words(view)).toEqual(expect.arrayContaining([copy.hardTitle, copy.hardBody, copy.systemRulesNote, copy.hardNone, copy.hardSet]));
    await press(view, 'qandeel-introductions-requirements-none');
    expect(fake.commands.at(-1)).toMatchObject({ kind: 'SET_REQUIREMENTS', payload: { strength: 'HARD', answer: 'NONE_ADDITIONAL', items: [] } });
    await press(view, 'qandeel-introductions-requirements-set');
    await press(view, 'qandeel-introductions-dimension-AGE_RANGE');
    await act(async () => {
      fireEvent.changeText(view.getByTestId('qandeel-introductions-age-min'), '25');
      fireEvent.changeText(view.getByTestId('qandeel-introductions-age-max'), '35');
    });
    await press(view, 'qandeel-introductions-accept-DIVORCED');
    await press(view, 'qandeel-introductions-save');
    expect(fake.commands.at(-1)).toMatchObject({ payload: { strength: 'HARD', answer: 'ITEMS', items: [
      { dimension: 'AGE_RANGE', min: 25, max: 35 }, { dimension: 'MARITAL_STATUS', accepted: ['DIVORCED'] }] } });
  });

  it('a conflict between a dealbreaker and a preference is the owner\'s decision', async () => {
    const { view } = await surface(language, server(viewOf({ kind: 'RESOLVE_DISCREPANCY', dimensions: ['AGE_RANGE'] }, {}, 'MIXED')));
    expect(words(view)).toEqual(expect.arrayContaining([copy.discrepancyTitle, `${copy.discrepancyBody} ${copy.AGE_RANGE}`, copy.editHard, copy.editSoft]));
    await press(view, 'qandeel-introductions-edit-hard');
    expect(view.getByTestId('qandeel-introductions-requirements-HARD')).toBeTruthy();
  });

  it('the reviewed draft says plainly that enrollment is not available — no active, matchable or eligible state anywhere', async () => {
    const draft = emptyDraft({
      facts: { firstName: { value: 'Sara', state: 'CONFIRMED' }, sex: { value: 'FEMALE', state: 'CONFIRMED' }, birthYearMonth: { year: 1996, month: 5, state: 'CONFIRMED' },
        area: { countryCode: 'EG', regionCode: 'EG-ALX', state: 'CONFIRMED' }, maritalStatus: { value: 'NEVER_MARRIED', state: 'CONFIRMED' } },
      requirements: { hard: { answer: 'NONE_ADDITIONAL', items: [] }, soft: { answer: 'NONE', items: [] }, discrepancies: [] },
      review: { state: 'REVIEWED' },
    });
    const { view } = await surface(language, server(viewOf(null, { draft }, 'NEW', 'REVIEWED')));
    expect(view.getByTestId('qandeel-introductions-enrollment-unavailable').props.children).toBe(copy.reviewed);
    expect(words(view)).toEqual(expect.arrayContaining(['Sara', copy.female, copy.NEVER_MARRIED, copy.hardNone, copy.softNone]));
    expect(words(view).join(' ')).not.toMatch(/active|matched|eligible|matchable|نشط|مؤهل|مطابق/iu);
  });

  it('closed or a deletion pending: read-only — the owner sees and may delete what they prepared, and nothing else', async () => {
    const draft = emptyDraft({ facts: { ...emptyDraft().facts, firstName: { value: 'Sara', state: 'CONFIRMED' } } });
    const closed = await surface(language, server(viewOf({ kind: 'ESTABLISH_FACT', fact: 'SEX' }, { draft, availability: { preparation: false, assistance: false } })));
    expect(words(closed.view)).toEqual(expect.arrayContaining([copy.unavailable, 'Sara', copy.discard]));
    expect(closed.view.queryByTestId('qandeel-introductions-sex-female')).toBeNull();
    expect(closed.view.queryByTestId('qandeel-introductions-edit-INTRODUCTION_FIRST_NAME')).toBeNull();
    const pending = await surface(language, server(viewOf({ kind: 'ESTABLISH_FACT', fact: 'SEX' }, { draft, accountDeletionPending: true })));
    expect(words(pending.view)).toContain(copy.deletionPending);
  });

  it('a stale change shows the latest version with a notice; a lost answer is retried with the SAME command id', async () => {
    const fake = server(viewOf({ kind: 'ESTABLISH_FACT', fact: 'SEX' }));
    const { view } = await surface(language, fake);
    fake.answer({ kind: 'FAILED' });
    await press(view, 'qandeel-introductions-sex-male');
    expect(view.getByTestId('qandeel-introductions-notice')).toBeTruthy();
    expect(words(view)).toContain(copy.failed);
    await press(view, 'qandeel-introductions-sex-male');
    expect(fake.commands[1].id).toBe(fake.commands[0].id);
    fake.answer({ kind: 'ANSWERED', outcome: 'STALE_VERSION', view: viewOf({ kind: 'ESTABLISH_FACT', fact: 'SEX' }) });
    await press(view, 'qandeel-introductions-sex-female');
    expect(words(view)).toContain(copy.changedElsewhere);
    expect(fake.commands[2].id).not.toBe(fake.commands[0].id);
  });

  it('every control is at least 44 points and nothing is fixed-width, so 320 points and large text reflow', async () => {
    const { view } = await surface(language, server(viewOf({ kind: 'ESTABLISH_FACT', fact: 'MARITAL_STATUS' })));
    for (const id of ['qandeel-introductions-back', 'qandeel-introductions-marital-CURRENTLY_MARRIED']) {
      const node = style(view.getByTestId(id));
      expect(node.minHeight).toBeGreaterThanOrEqual(44);
      expect(node.minWidth).toBeGreaterThanOrEqual(44);
    }
    // The icon-only Back is 44 x 44 by design; every content row takes the free width, never a fixed one.
    expect(style(view.getByTestId('qandeel-introductions-marital-CURRENTLY_MARRIED')).width).toBeUndefined();
    expect(view.getByTestId('qandeel-introductions-marital-CURRENTLY_MARRIED').props.accessibilityRole).toBe('radio');
  });

  it('Android Back inside an editor leaves the editor first; the header Back leaves the surface', async () => {
    type Handler = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers: { handler: Handler; removed: boolean }[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      const entry = { handler, removed: false };
      handlers.push(entry);
      return { remove: () => { entry.removed = true; } };
    });
    const { view, onBack } = await surface(language, server(viewOf({ kind: 'CONFIRM_DECLARED_FACT', fact: 'SEX' },
      { draft: emptyDraft({ facts: { ...emptyDraft().facts, sex: { value: 'MALE', state: 'DECLARED' } } }) })));
    await press(view, 'qandeel-introductions-edit');
    expect(view.getByTestId('qandeel-introductions-edit-SEX')).toBeTruthy();
    await act(async () => {
      const live = handlers.filter((entry) => !entry.removed).reverse();
      expect(live[0].handler({} as Parameters<Handler>[0])).toBe(true);
      await flush();
    });
    expect(view.queryByTestId('qandeel-introductions-edit-SEX')).toBeNull();
    await press(view, 'qandeel-introductions-back');
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('the entry', () => {
  async function entry(availability: { preparation: boolean; assistance: boolean; hasDraft: boolean } | null) {
    const authority = createAppearanceAuthority({
      store: createEphemeralAppearancePreferenceStore({}), system: { current: () => 'DARK', subscribe: () => () => undefined }, native: { apply: () => undefined },
    });
    authority.bindAccount('reader');
    const controller = createIntroductionsController({
      transport: { ...server(viewOf(null)).transport, availability: async () => (availability === null ? { kind: 'UNAVAILABLE' as const } : { kind: 'READ' as const, availability }) },
      isCurrent: () => true,
    });
    const view = await render(<AppearanceProvider authority={authority}><IntroductionsEntry controller={controller} language="ar" onOpen={() => undefined} /></AppearanceProvider>);
    await act(async () => { await flush(); });
    return view;
  }
  it('is not drawn while nothing is available and nothing was prepared — no teaser', async () => {
    expect((await entry(null)).queryByTestId('qandeel-introductions-entry')).toBeNull();
    expect((await entry({ preparation: false, assistance: false, hasDraft: false })).queryByTestId('qandeel-introductions-entry')).toBeNull();
  });
  it('is drawn when preparation is available, or when the owner has a draft to see or delete', async () => {
    expect((await entry({ preparation: true, assistance: false, hasDraft: false })).getByTestId('qandeel-introductions-entry').props.accessibilityLabel).toBe('التعارف مع قنديل');
    expect((await entry({ preparation: false, assistance: false, hasDraft: true })).getByTestId('qandeel-introductions-entry')).toBeTruthy();
  });
});

describe('the transport decodes strictly', () => {
  const answer = (status: number, body: unknown) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const wire = { availability: { preparation: true, assistance: true, enrollment: false }, accountDeletionPending: false,
    assistance: { consent: 'NOT_GRANTED', grantedVersion: null, currentVersion: 'V' }, draft: null, priorItems: [],
    plan: { path: 'NEW', stage: 'NOT_STARTED', next: { kind: 'OFFER_ASSISTANCE' }, objectives: [], skipped: [], enrollment: 'UNAVAILABLE' }, phrasing: 'UNBOUND' };
  it('a view that claims enrollment, a bound phrasing provider or an unknown objective is no answer', async () => {
    expect((await new IntroductionsApiClient({ baseUrl: 'x', fetch: answer(200, wire) }).read()).kind).toBe('READ');
    for (const bad of [{ ...wire, availability: { ...wire.availability, enrollment: true } }, { ...wire, plan: { ...wire.plan, enrollment: 'AVAILABLE' } },
      { ...wire, phrasing: 'MODEL' }, { ...wire, plan: { ...wire.plan, next: { kind: 'ENROLL' } } }]) {
      expect((await new IntroductionsApiClient({ baseUrl: 'x', fetch: answer(200, bad) }).read()).kind).toBe('UNAVAILABLE');
    }
  });
  it('a 400 is INVALID; a lost answer is FAILED (retry with the same id)', async () => {
    expect(await new IntroductionsApiClient({ baseUrl: 'x', fetch: answer(400, {}) }).command('id', 0, 'SKIP_STEP', { step: 'NOTES' })).toEqual({ kind: 'INVALID' });
    expect(await new IntroductionsApiClient({ baseUrl: 'x', fetch: async () => { throw new Error('offline'); } }).command('id', 0, 'SKIP_STEP', { step: 'NOTES' })).toEqual({ kind: 'FAILED' });
  });
});

describe('parity with migration 0154 and the copy gate', () => {
  it('the consent text shown is byte-for-byte the text the database records the grant against', () => {
    for (const [version, pair] of Object.entries(ASSISTANCE_CONSENT_TEXT)) {
      expect(MIGRATION).toContain(`'${version}'`);
      expect(MIGRATION).toContain(`'${pair.ar}'`);
      expect(MIGRATION).toContain(`'${pair.en}'`);
    }
  });

  it('the area names cover exactly the catalogue codes the database validates', () => {
    const countries = [...MIGRATION.matchAll(/\('([A-Z]{2})', (?:true|false)\)/gu)].map((m) => m[1]).sort();
    const regionBlock = MIGRATION.slice(MIGRATION.indexOf('SELECT left(code, 2), code FROM unnest(ARRAY['), MIGRATION.indexOf(']) AS code;'));
    const regions = [...regionBlock.matchAll(/'([A-Z]{2}-[A-Z0-9]{1,3})'/gu)].map((m) => m[1]).sort();
    expect(Object.keys(AREA_COUNTRIES).sort()).toEqual(countries);
    expect(Object.keys(AREA_REGIONS).sort()).toEqual(regions);
    expect(countries).toHaveLength(22);
  });

  it('the historical C01–C07 are kept verbatim; C01 is used unchanged; C07 is never displayed; every C0x Arabic replacement is free of dialect', () => {
    expect(INTRODUCTIONS_COPY_ROWS.name).toEqual(INTRODUCTIONS_HISTORICAL_COPY.C01);
    for (const [, row] of INTRODUCTIONS_COPY_GATE.controlledReplacements) {
      expect(INTRODUCTIONS_COPY_ROWS[row as keyof typeof INTRODUCTIONS_COPY_ROWS]).toBeDefined();
    }
    for (const row of INTRODUCTIONS_COPY_GATE.englishKeptAsApproved) {
      const historical = Object.values(INTRODUCTIONS_HISTORICAL_COPY).map((pair) => pair.en);
      expect(historical).toContain(INTRODUCTIONS_COPY_ROWS[row].en);
    }
    const shown = Object.values(INTRODUCTIONS_COPY_ROWS).flatMap((pair) => [pair.ar, pair.en]);
    expect(shown).not.toContain(INTRODUCTIONS_HISTORICAL_COPY.C07.ar);
    expect(shown).not.toContain(INTRODUCTIONS_HISTORICAL_COPY.C07.en);
    const dialect = /(^|\s)(خليني|اللي|إيه|ايه|هسألك|علشان|عشان|ليك|مش|ده|دي|لسه|بنتعرف|شوية|حاجة|راجعها|عدّل|اختار|تحب)(\s|[.،؟]|$)/u;
    for (const pair of Object.values(INTRODUCTIONS_COPY_ROWS)) expect(pair.ar).not.toMatch(dialect);
  });
});
