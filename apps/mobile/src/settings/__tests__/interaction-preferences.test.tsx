/**
 * IP-IMP-01 (WP5) — «تفضيلات التعامل» / Interaction Preferences in General Settings, in Arabic and English.
 *
 * The transport, the controller and the page: one row inside the existing QANDEEL & Conversation group; the four
 * approved groups with every approved option; a direct commit with an accessible PENDING state in which the confirmed
 * value stays selected (an uncommitted choice is never shown as saved); the server's answer said once; STALE and failure
 * never shown as saved; the load failure; the optional review (empty is legitimate; apply / replace / skip); RTL / LTR.
 */
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import { InteractionPreferencesApiClient } from '../../runtime-entry';
import type { InteractionPreferenceChange, InteractionPreferencesRecord, LegacyPreferenceReview } from '../../runtime-entry';
import { SettingsSurface, settingsCopy } from '..';
import { createInteractionPreferencesController, type InteractionPreferencesTransport } from '../interaction-preferences-controller';
import { INTERACTION_PREFERENCES_COPY_GATE, interactionPreferencesCopy } from '../interaction-preferences-copy';

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const MEMORY = '11111111-1111-4111-8111-111111111111';
const OTHER_MEMORY = '22222222-2222-4222-8222-222222222222';
const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const record = (over: Partial<InteractionPreferencesRecord['preferences']> = {}, version = 0): InteractionPreferencesRecord => ({
  preferences: { replyLength: 'DEFAULT', replyLanguage: 'DEFAULT', humour: 'DEFAULT', explanationStyle: 'DEFAULT', ...over }, version,
});

/** A transport whose every answer the test releases by hand. */
function controlledTransport(initial = record()) {
  const calls: string[] = [];
  let release: ((outcome: InteractionPreferenceChange) => void) | null = null;
  let reviewAnswer: LegacyPreferenceReview = { kind: 'READ', record: initial, candidates: [] };
  let readAnswer: () => Promise<{ kind: 'READ'; record: InteractionPreferencesRecord } | { kind: 'UNAVAILABLE' }> = () => Promise.resolve({ kind: 'READ', record: initial });
  const transport: InteractionPreferencesTransport = {
    read: () => { calls.push('read'); return readAnswer(); },
    set: (field, value, version) => { calls.push(`set ${field} ${value} ${version}`); return new Promise((resolve) => { release = resolve; }); },
    legacyReview: () => { calls.push('review'); return Promise.resolve(reviewAnswer); },
    applyLegacy: (memoryId, version) => { calls.push(`apply ${memoryId} ${version}`); return new Promise((resolve) => { release = resolve; }); },
  };
  return {
    transport, calls,
    answer: async (outcome: InteractionPreferenceChange) => { await act(async () => { release!(outcome); }); },
    reviewWith: (answer: LegacyPreferenceReview) => { reviewAnswer = answer; },
    readWith: (answer: typeof readAnswer) => { readAnswer = answer; },
  };
}

async function settingsWith(language: ChromeLanguage, transport: InteractionPreferencesTransport) {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({}),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  const controller = createInteractionPreferencesController({ transport, isCurrent: () => true });
  const view = await render(
    <AppearanceProvider authority={authority}>
      <SettingsSurface language={language} insets={INSETS} onBack={jest.fn()} onSignOut={async () => undefined} interactionPreferences={controller} />
    </AppearanceProvider>,
  );
  await act(async () => undefined);
  return { view, controller };
}
const open = async (view: Awaited<ReturnType<typeof settingsWith>>['view']) => {
  await act(async () => { fireEvent.press(view.getByTestId('qandeel-settings-interaction-preferences')); });
  await act(async () => undefined);
};

describe.each(['ar', 'en'] as const)('IP-IMP-01 Interaction Preferences (%s)', (language) => {
  const words = interactionPreferencesCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  let announce: jest.SpyInstance;
  beforeEach(() => { announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined); });
  afterEach(() => announce.mockRestore());

  it('is ONE row inside the existing «قنديل والمحادثة» / QANDEEL & Conversation group, after the Language row - no new group, nothing read until opened', async () => {
    const t = controlledTransport();
    const { view } = await settingsWith(language, t.transport);
    const group = within(view.getByTestId('qandeel-settings-group-qandeel'));
    const labels = [...group.getAllByRole('button')].map((node) => node.props.accessibilityLabel as string);
    expect(labels[labels.length - 1]).toBe(words.row);
    expect(labels).toHaveLength(2);
    expect(view.getAllByRole('header').map((node) => node.props.children)).toContain(settingsCopy(language).qandeelGroup);
    expect(t.calls).toEqual([]);
  });

  it('opens a page of the same destination with the four approved groups and every approved option, Automatic selected', async () => {
    const t = controlledTransport();
    const { view } = await settingsWith(language, t.transport);
    await open(view);
    expect(t.calls).toEqual(['read']);
    const page = within(view.getByTestId('qandeel-interaction-preferences'));
    expect(page.getAllByRole('header').map((node) => node.props.children)).toEqual([
      words.fields.REPLY_LENGTH, words.fields.REPLY_LANGUAGE, words.fields.HUMOUR, words.fields.EXPLANATION_STYLE,
    ]);
    const groups = ['reply-length', 'reply-language', 'humour', 'explanation-style'].map((field) => page.getByTestId(`qandeel-interaction-preferences-${field}-group`));
    expect(groups.map((g) => g.props.accessibilityLabel)).toEqual([words.fields.REPLY_LENGTH, words.fields.REPLY_LANGUAGE, words.fields.HUMOUR, words.fields.EXPLANATION_STYLE]);
    const options = (index: number) => within(groups[index]).getAllByRole('radio').map((node) => node.props.accessibilityLabel);
    expect(options(0)).toEqual([words.values.REPLY_LENGTH.DEFAULT, words.values.REPLY_LENGTH.ALWAYS_BRIEF]);
    expect(options(1)).toEqual(['DEFAULT', 'EGYPTIAN_ARABIC', 'MODERN_STANDARD_ARABIC', 'LEVANTINE_ARABIC', 'GULF_ARABIC', 'MAGHREBI_ARABIC', 'ENGLISH'].map((v) => words.values.REPLY_LANGUAGE[v]));
    expect(options(2)).toEqual([words.values.HUMOUR.DEFAULT, words.values.HUMOUR.WELCOME, words.values.HUMOUR.DECLINED]);
    expect(options(3)).toEqual(['DEFAULT', 'SIMPLER', 'DIRECT', 'SIMPLER_AND_DIRECT'].map((v) => words.values.EXPLANATION_STYLE[v]));
    for (const group of groups) {
      const checked = within(group).getAllByRole('radio').filter((node) => node.props.accessibilityState?.checked);
      expect(checked.map((node) => node.props.accessibilityLabel)).toEqual([words.values.REPLY_LENGTH.DEFAULT]);
    }
    for (const node of page.getAllByRole('radio')) expect(style(node).minHeight).toBeGreaterThanOrEqual(44);
    for (const header of page.getAllByRole('header')) expect(style(header).writingDirection).toBe(writing);
    expect(page.queryByText(/save|حفظ$/iu)).toBeNull();
  });

  it('commits directly: PENDING keeps the confirmed value selected, then shows and says the server answer once', async () => {
    const t = controlledTransport(record({}, 4));
    const { view } = await settingsWith(language, t.transport);
    await open(view);
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-interaction-preferences-reply-language-egyptian-arabic')); });
    expect(t.calls).toContain('set REPLY_LANGUAGE EGYPTIAN_ARABIC 4');
    const chosen = view.getByTestId('qandeel-interaction-preferences-reply-language-egyptian-arabic');
    expect(chosen.props.accessibilityState).toMatchObject({ checked: false, busy: true });
    expect(view.getByTestId('qandeel-interaction-preferences-reply-language-default').props.accessibilityState).toMatchObject({ checked: true });
    // Nothing else can be chosen while one change is in flight.
    expect(view.getByTestId('qandeel-interaction-preferences-humour-welcome').props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-interaction-preferences-humour-welcome')); });
    expect(t.calls.filter((c) => c.startsWith('set'))).toHaveLength(1);
    expect(within(view.getByTestId('qandeel-interaction-preferences-notice')).queryByText(words.saved)).toBeNull();

    await t.answer({ kind: 'SAVED', record: record({ replyLanguage: 'EGYPTIAN_ARABIC' }, 5) });
    expect(view.getByTestId('qandeel-interaction-preferences-reply-language-egyptian-arabic').props.accessibilityState).toMatchObject({ checked: true, busy: false });
    expect(within(view.getByTestId('qandeel-interaction-preferences-notice')).getByText(words.saved)).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(words.saved);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('a reset to Automatic is said as such', async () => {
    const t = controlledTransport(record({ humour: 'DECLINED' }, 2));
    const { view } = await settingsWith(language, t.transport);
    await open(view);
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-interaction-preferences-humour-default')); });
    await t.answer({ kind: 'SAVED', record: record({}, 3) });
    expect(within(view.getByTestId('qandeel-interaction-preferences-notice')).getByText(words.reset)).toBeTruthy();
    expect(view.getByTestId('qandeel-interaction-preferences-humour-default').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('STALE shows the newer value the server holds and says the change was not saved; a failure keeps the confirmed value', async () => {
    const t = controlledTransport(record({}, 1));
    const { view } = await settingsWith(language, t.transport);
    await open(view);
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-interaction-preferences-reply-length-always-brief')); });
    await t.answer({ kind: 'STALE', record: record({ replyLanguage: 'ENGLISH' }, 2) });
    expect(view.getByTestId('qandeel-interaction-preferences-reply-length-always-brief').props.accessibilityState).toMatchObject({ checked: false });
    expect(view.getByTestId('qandeel-interaction-preferences-reply-language-english').props.accessibilityState).toMatchObject({ checked: true });
    expect(within(view.getByTestId('qandeel-interaction-preferences-notice')).getByText(words.notSaved)).toBeTruthy();

    await act(async () => { fireEvent.press(view.getByTestId('qandeel-interaction-preferences-reply-length-always-brief')); });
    expect(t.calls).toContain('set REPLY_LENGTH ALWAYS_BRIEF 2');
    await t.answer({ kind: 'FAILED' });
    expect(view.getByTestId('qandeel-interaction-preferences-reply-length-default').props.accessibilityState).toMatchObject({ checked: true });
    expect(within(view.getByTestId('qandeel-interaction-preferences-notice')).getByText(words.notSaved)).toBeTruthy();
  });

  it('a load failure says so in the approved words, and pressing it reads again', async () => {
    const t = controlledTransport();
    t.readWith(() => Promise.resolve({ kind: 'UNAVAILABLE' }));
    const { view } = await settingsWith(language, t.transport);
    await open(view);
    const failed = view.getByTestId('qandeel-interaction-preferences-load-failed');
    expect(failed.props.accessibilityLabel).toBe(words.loadFailed);
    t.readWith(() => Promise.resolve({ kind: 'READ', record: record() }));
    await act(async () => { fireEvent.press(failed); });
    await act(async () => undefined);
    expect(view.getByTestId('qandeel-interaction-preferences')).toBeTruthy();
    expect(t.calls).toEqual(['read', 'read']);
  });

  it('the optional review: an empty list is a legitimate answer, said plainly', async () => {
    const t = controlledTransport();
    const { view } = await settingsWith(language, t.transport);
    await open(view);
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-interaction-preferences-review')); });
    await act(async () => undefined);
    expect(view.getByTestId('qandeel-interaction-preferences-review').props.accessibilityLabel).toBe(words.review);
    expect(view.getByTestId('qandeel-interaction-preferences-review-empty').props.children).toBe(words.noCandidates);
  });

  it('the review offers the reader\'s own words; Apply / Replace commit through the server, Skip changes nothing anywhere', async () => {
    const t = controlledTransport(record({ replyLanguage: 'ENGLISH' }, 3));
    t.reviewWith({ kind: 'READ', record: record({ replyLanguage: 'ENGLISH' }, 3), candidates: [
      { memoryId: MEMORY, statement: 'كلمني بالمصري.', field: 'REPLY_LANGUAGE', value: 'EGYPTIAN_ARABIC' },
      { memoryId: OTHER_MEMORY, statement: 'رد عليا باختصار.', field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF' },
    ] });
    const { view } = await settingsWith(language, t.transport);
    await open(view);
    await act(async () => { fireEvent.press(view.getByTestId('qandeel-interaction-preferences-review')); });
    await act(async () => undefined);
    // A different current choice: the act is «استبدال التفضيل الحالي» / Replace current preference.
    const replace = view.getByTestId(`qandeel-interaction-preferences-apply-${MEMORY}`);
    expect(within(replace).getByText(words.replace)).toBeTruthy();
    expect(within(view.getByTestId(`qandeel-interaction-preferences-apply-${OTHER_MEMORY}`)).getByText(words.apply)).toBeTruthy();
    expect(view.getByText('«كلمني بالمصري.»')).toBeTruthy();

    await act(async () => { fireEvent.press(view.getByTestId(`qandeel-interaction-preferences-skip-${OTHER_MEMORY}`)); });
    expect(view.queryByTestId(`qandeel-interaction-preferences-candidate-${OTHER_MEMORY}`)).toBeNull();
    expect(t.calls.filter((c) => c.startsWith('apply') || c.startsWith('set'))).toEqual([]);

    await act(async () => { fireEvent.press(replace); });
    expect(t.calls).toContain(`apply ${MEMORY} 3`);
    expect(view.getByTestId('qandeel-interaction-preferences-reply-language-english').props.accessibilityState).toMatchObject({ checked: true });
    await t.answer({ kind: 'SAVED', record: record({ replyLanguage: 'EGYPTIAN_ARABIC' }, 4) });
    expect(view.getByTestId('qandeel-interaction-preferences-reply-language-egyptian-arabic').props.accessibilityState).toMatchObject({ checked: true });
    expect(view.queryByTestId(`qandeel-interaction-preferences-candidate-${MEMORY}`)).toBeNull();
    expect(view.getByTestId('qandeel-interaction-preferences-review-empty').props.children).toBe(words.noCandidates);
  });
});

describe('IP-IMP-01 — the controller and the transport', () => {
  it('a retired generation applies no late answer', async () => {
    let live = true;
    let release!: (v: InteractionPreferenceChange) => void;
    const controller = createInteractionPreferencesController({
      transport: {
        read: () => Promise.resolve({ kind: 'READ', record: record() }),
        set: () => new Promise((resolve) => { release = resolve; }),
        legacyReview: () => Promise.resolve({ kind: 'UNAVAILABLE' }),
        applyLegacy: () => Promise.resolve({ kind: 'FAILED' }),
      },
      isCurrent: () => live,
    });
    controller.start();
    await Promise.resolve();
    await Promise.resolve();
    const pending = controller.choose('HUMOUR', 'WELCOME');
    live = false;
    release({ kind: 'SAVED', record: record({ humour: 'WELCOME' }, 1) });
    expect(await pending).toBe(false);
    expect(controller.getState().record?.preferences.humour).toBe('DEFAULT');
  });

  it('the client sends exactly one field and the version, holds no user id, and decodes strictly', async () => {
    const sent: { url: string; init: RequestInit }[] = [];
    const answers: unknown[] = [];
    const client = new InteractionPreferencesApiClient({
      baseUrl: 'https://api.test',
      fetch: (async (url: string, init: RequestInit) => {
        sent.push({ url, init });
        const body = answers.shift();
        return { ok: body !== undefined, status: body === undefined ? 503 : 200, json: async () => body } as unknown as Response;
      }) as never,
    });
    const ok = { preferences: { replyLength: 'ALWAYS_BRIEF', replyLanguage: 'DEFAULT', humour: 'DEFAULT', explanationStyle: 'DEFAULT' }, version: 1 };
    answers.push({ outcome: 'SAVED', ...ok });
    expect(await client.set('REPLY_LENGTH', 'ALWAYS_BRIEF', 0)).toEqual({ kind: 'SAVED', record: ok });
    expect(sent[0].url).toBe('https://api.test/interaction-preferences');
    expect(JSON.parse(String(sent[0].init.body))).toEqual({ field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF', expectedVersion: 0 });
    for (const bad of [
      { ...ok, extra: true },
      { ...ok, preferences: { ...ok.preferences, humour: 'SARCASTIC' } },
      { ...ok, version: -1 },
      { preferences: ok.preferences },
    ]) {
      answers.push(bad);
      expect(await client.read()).toEqual({ kind: 'UNAVAILABLE' });
    }
    answers.push({ outcome: 'MAYBE', ...ok });
    expect(await client.set('HUMOUR', 'WELCOME', 1)).toEqual({ kind: 'FAILED' });
    expect(await client.set('HUMOUR', 'WELCOME', 1)).toEqual({ kind: 'FAILED' });
    answers.push({ ...ok, candidates: [{ memoryId: MEMORY, statement: 'كلمني بالمصري.', field: 'REPLY_LANGUAGE', value: 'EGYPTIAN_ARABIC', replacesCurrent: false }] });
    expect(await client.legacyReview()).toEqual({ kind: 'READ', record: ok, candidates: [{ memoryId: MEMORY, statement: 'كلمني بالمصري.', field: 'REPLY_LANGUAGE', value: 'EGYPTIAN_ARABIC' }] });
    answers.push({ ...ok, candidates: [{ memoryId: 'x', statement: 's', field: 'REPLY_LANGUAGE', value: 'EGYPTIAN_ARABIC', replacesCurrent: false }] });
    expect(await client.legacyReview()).toEqual({ kind: 'UNAVAILABLE' });
    expect(sent.every(({ init }) => !JSON.stringify(init.body ?? '').includes('userId'))).toBe(true);
  });

  it('every approved string is carried verbatim, in both languages', () => {
    expect(INTERACTION_PREFERENCES_COPY_GATE.ar.row).toBe('تفضيلات التعامل');
    expect(INTERACTION_PREFERENCES_COPY_GATE.en.values.EXPLANATION_STYLE.SIMPLER_AND_DIRECT).toBe('Simple & direct');
    expect(INTERACTION_PREFERENCES_COPY_GATE.ar.notSaved).toBe('لم يُحفظ التغيير. حاول مرة أخرى.');
    expect(INTERACTION_PREFERENCES_COPY_GATE.en.noCandidates).toBe('No eligible previous preferences to review.');
    expect(Object.keys(INTERACTION_PREFERENCES_COPY_GATE.ar.values.REPLY_LANGUAGE)).toHaveLength(7);
  });
});
