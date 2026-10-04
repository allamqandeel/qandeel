/**
 * A3-01 — the Activity surfaces in Arabic and English, Dark and Light, standard and Reduced Motion: the entry and its
 * mark, the Activity page, the ordinary strip, the call-safe strip (validation only), and Notifications & Activity.
 * Colours are read from the generated canonical families; words from the one copy module.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore, type AppearancePreference } from '../../appearance';
import { CANONICAL_VISUAL } from '../../conversation/visual/canonical-visual.generated';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { ActivityItem, ActivityOpenOutcome, ActivityPreferences } from '../../runtime-entry';
import { NotificationsSettings } from '../../settings/NotificationsSection';
import { ActivityEntry } from '../ActivityEntry';
import { ActivitySurface } from '../ActivitySurface';
import { AttentionStrip, STRIP_TIMING } from '../AttentionStrip';
import { CallSafeStrip } from '../CallSafeStrip';
import { createActivityAttentionController } from '../attention-controller';
import { ACTIVITY_COPY_GATE, activityCopy, notificationsCopy } from '../copy';
import { createActivityFeedController } from '../feed-controller';
import { createActivityPreferencesController } from '../preferences-controller';
import { PREFERENCES, item, snapshot } from '../__fixtures__/activity';
import { createManualForegroundSignal } from '../../runtime-entry';

// Every test unmounts what it rendered (this repository's RNTL setup does not do it implicitly).
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
  // The preset's AccessibilityInfo functions are already jest.fn: spyOn returns them, call history and all.
  jest.clearAllMocks();
});

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const P = CANONICAL_VISUAL.palettes;
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const flush = () => act(async () => {
  await new Promise((resolve) => setImmediate(resolve));
});

function appearance(preference: AppearancePreference) {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: preference }),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
}

function controllers(items: readonly ActivityItem[], open: (id: string) => ActivityOpenOutcome = () => ({ kind: 'ENTER', destination: { kind: 'PERSONAL_CONVERSATION' } }), present = false) {
  const seen: string[][] = [];
  const feed = createActivityFeedController({
    transport: {
      readPage: async () => ({ kind: 'READ', items, before: null }),
      markSeen: async (ids) => (seen.push([...ids]), true),
      open: async (id) => open(id),
    },
    isCurrent: () => true,
  });
  const attention = createActivityAttentionController({
    transport: { readAttention: async () => ({ kind: 'READ', snapshot: snapshot([], present) }), recordStrip: async () => true },
    foreground: createManualForegroundSignal('ACTIVE'), isCurrent: () => true, setTimer: () => 0, clearTimer: () => undefined,
  });
  return { feed, attention, seen };
}

describe.each<[ChromeLanguage, AppearancePreference]>([['ar', 'DARK'], ['en', 'LIGHT']])('Activity — %s, %s', (language, preference) => {
  const copy = activityCopy(language);
  const palette = P[preference as 'DARK' | 'LIGHT'].standard;

  it('the entry: Open Ledger, rest ink, decorative; presence carried in the NAME, never a number', async () => {
    const { attention } = controllers([], undefined, true);
    attention.start();
    const view = await render(
      <AppearanceProvider authority={appearance(preference)}>
        <ActivityEntry controller={attention} language={language} onOpen={() => undefined} />
      </AppearanceProvider>,
    );
    await flush();
    const entry = view.getByTestId('qandeel-activity-entry');
    expect(entry.props.accessibilityLabel).toBe(`${copy.openName}${language === 'ar' ? '، ' : ', '}${copy.newState}`);
    expect(entry.props.accessibilityLabel).not.toMatch(/\d/u);
    expect(flat(entry)).toMatchObject({ width: 44, height: 44 });
    const glyph = view.getByTestId('qandeel-p3-glyph-ledger', { includeHiddenElements: true });
    expect(glyph.props.accessibilityElementsHidden).toBe(true);
    expect(flat(glyph).transform).toBeUndefined(); // never mirrored
    const mark = view.getByTestId('qandeel-activity-mark', { includeHiddenElements: true });
    expect(mark.props.accessibilityElementsHidden).toBe(true);
    attention.retire();
  });

  it('the page: rows with their words, states in the name; NEW is a solid mark and WAITING a hollow ring', async () => {
    const fresh = item({ category: 'SYSTEM' });
    const waiting = item({ attention: 'SEEN', actionable: true, waiting: true, mark: true });
    const stale = item({ stale: true, mark: false, entry: 'UNAVAILABLE' });
    const { feed, attention } = controllers([fresh, waiting, stale]);
    const onBack = jest.fn();
    const onOpenSettings = jest.fn();
    const view = await render(
      <AppearanceProvider authority={appearance(preference)}>
        <ActivitySurface feed={feed} attention={attention} language={language} insets={INSETS} onBack={onBack} onOpenSettings={onOpenSettings} onEnter={() => undefined} />
      </AppearanceProvider>,
    );
    await flush();
    expect(flat(view.getByTestId('qandeel-activity'))).toMatchObject({ backgroundColor: palette.world, direction: language === 'ar' ? 'rtl' : 'ltr' });
    expect(view.getByTestId('qandeel-activity-title').props.children).toBe(copy.title);
    const name = (target: ActivityItem) => view.getByTestId(`qandeel-activity-row-${target.id}`).props.accessibilityLabel as string;
    expect(name(fresh)).toContain(copy.markNew);
    expect(name(waiting)).toContain(copy.markWaiting);
    expect(name(stale)).toContain(copy.stale);
    expect(view.getByTestId(`qandeel-activity-row-${fresh.id}-mark-new`, { includeHiddenElements: true })).toBeTruthy();
    expect(flat(view.getByTestId(`qandeel-activity-row-${waiting.id}-mark-waiting`))).toMatchObject({ borderWidth: 1.5, borderColor: palette.primary });
    // The filters: All selected by default; toggle buttons, not tabs; 44-pt targets.
    const all = view.getByTestId('qandeel-activity-filter-all');
    expect(all.props.accessibilityRole).toBe('togglebutton');
    expect(all.props.accessibilityState).toMatchObject({ selected: true });
    expect(all.props.accessibilityLabel).toBe(copy.all);
    expect(view.getByTestId('qandeel-activity-filter-introductions').props.accessibilityLabel).toBe(copy.filters.INTRODUCTIONS);
    await fireEvent.press(view.getByTestId('qandeel-activity-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByTestId('qandeel-activity-settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('Direct Entry revalidates when pressed; a stale row explains and offers only its own context; Stage 4–8 destinations fail closed', async () => {
    const valid = item();
    const stale = item({ stale: true, entry: 'UNAVAILABLE' });
    const future = item({ category: 'SHARED', entry: 'UNAVAILABLE' });
    const outcomes: Record<string, ActivityOpenOutcome> = {
      [valid.id]: { kind: 'ENTER', destination: { kind: 'GENERAL_SETTINGS', section: 'SECURITY' } },
      [stale.id]: { kind: 'STALE', fallback: { kind: 'PERSONAL_CONVERSATION' } },
      [future.id]: { kind: 'UNAVAILABLE', fallback: null },
    };
    const { feed, attention } = controllers([valid, stale, future], (id) => outcomes[id]);
    const onEnter = jest.fn();
    const view = await render(
      <AppearanceProvider authority={appearance(preference)}>
        <ActivitySurface feed={feed} attention={attention} language={language} insets={INSETS} onBack={() => undefined} onOpenSettings={() => undefined} onEnter={onEnter} />
      </AppearanceProvider>,
    );
    await flush();
    await fireEvent.press(view.getByTestId(`qandeel-activity-row-${valid.id}`));
    await flush();
    expect(onEnter).toHaveBeenCalledWith({ kind: 'GENERAL_SETTINGS', section: 'SECURITY' });
    await fireEvent.press(view.getByTestId(`qandeel-activity-row-${stale.id}`));
    await flush();
    expect(view.getByText(copy.staleExplain)).toBeTruthy();
    await fireEvent.press(view.getByTestId(`qandeel-activity-row-${stale.id}-fallback`));
    expect(onEnter).toHaveBeenLastCalledWith({ kind: 'PERSONAL_CONVERSATION' });
    await fireEvent.press(view.getByTestId(`qandeel-activity-row-${future.id}`));
    await flush();
    expect(view.getByText(ACTIVITY_COPY_GATE.rows.entryUnavailable[language])).toBeTruthy();
    expect(view.queryByTestId(`qandeel-activity-row-${future.id}-fallback`)).toBeNull();
    expect(onEnter).toHaveBeenCalledTimes(2);
  });

  it('empty, loading and unavailable states, with the frozen «إعادة المحاولة» act', async () => {
    const empty = controllers([]);
    const view = await render(
      <AppearanceProvider authority={appearance(preference)}>
        <ActivitySurface feed={empty.feed} attention={empty.attention} language={language} insets={INSETS} onBack={() => undefined} onOpenSettings={() => undefined} onEnter={() => undefined} />
      </AppearanceProvider>,
    );
    await flush();
    expect(view.getByText(copy.empty)).toBeTruthy();
    let fail = true;
    const feed = createActivityFeedController({
      transport: { readPage: async () => (fail ? { kind: 'UNAVAILABLE' } : { kind: 'READ', items: [], before: null }), markSeen: async () => true, open: async () => ({ kind: 'FAILED' }) },
      isCurrent: () => true,
    });
    await view.rerender(
      <AppearanceProvider authority={appearance(preference)}>
        <ActivitySurface feed={feed} attention={empty.attention} language={language} insets={INSETS} onBack={() => undefined} onOpenSettings={() => undefined} onEnter={() => undefined} />
      </AppearanceProvider>,
    );
    await flush();
    expect(view.getByText(copy.gate.unavailable)).toBeTruthy();
    fail = false;
    await fireEvent.press(view.getByTestId('qandeel-activity-retry'));
    await flush();
    await flush();
    expect(view.getByText(copy.empty)).toBeTruthy();
  });
});

describe('the ordinary Attention Strip', () => {
  afterEach(() => {
    jest.useRealTimers();
    (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = false;
  });

  it('is announced ONCE; its body is the Direct Entry; dismiss is its other act; the hold pauses under a finger', async () => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const onEnter = jest.fn();
    const onDismiss = jest.fn();
    const shown = item({ category: 'SYSTEM' });
    const view = await render(
      <AppearanceProvider authority={appearance('DARK')}>
        <AttentionStrip item={shown} language="en" top={92} insets={{ left: 0, right: 0 }} onEnter={onEnter} onDismiss={onDismiss} />
      </AppearanceProvider>,
    );
    expect(announce).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('qandeel-attention-strip').props.accessibilityLabel).toBe('Alert');
    expect(view.getByTestId('qandeel-attention-strip-dismiss').props.accessibilityLabel).toBe('Dismiss alert');
    await view.rerender(
      <AppearanceProvider authority={appearance('DARK')}>
        <AttentionStrip item={shown} language="en" top={92} insets={{ left: 0, right: 0 }} onEnter={onEnter} onDismiss={onDismiss} />
      </AppearanceProvider>,
    );
    expect(announce).toHaveBeenCalledTimes(1);
    // A finger on it: the readable hold does not run out.
    await fireEvent(view.getByTestId('qandeel-attention-strip-body'), 'pressIn');
    await act(async () => {
      jest.advanceTimersByTime(STRIP_TIMING.holdMs * 3);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    await fireEvent(view.getByTestId('qandeel-attention-strip-body'), 'pressOut');
    await act(async () => {
      jest.advanceTimersByTime(STRIP_TIMING.holdMs + STRIP_TIMING.leaveMs + 10);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('never times out under a screen reader; Reduced Motion is the same strip without travel', async () => {
    jest.useFakeTimers();
    (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = true;
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const onDismiss = jest.fn();
    const onEnter = jest.fn();
    const view = await render(
      <AppearanceProvider authority={appearance('DARK')}>
        <AttentionStrip item={item()} language="ar" top={92} insets={{ left: 0, right: 0 }} onEnter={onEnter} onDismiss={onDismiss} />
      </AppearanceProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(STRIP_TIMING.holdMs * 5);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    const strip = flat(view.getByTestId('qandeel-attention-strip'));
    expect(strip.transform).toEqual([{ translateY: 0 }]);
    expect(strip.direction).toBe('rtl');
    await fireEvent.press(view.getByTestId('qandeel-attention-strip-body'));
    await act(async () => {
      jest.advanceTimersByTime(STRIP_TIMING.reducedLeaveMs + 10);
    });
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});

describe('the call-safe strip — validation fixture only (no call authority exists)', () => {
  it('is dismiss-only: text body, no Direct Entry', async () => {
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const onDismiss = jest.fn();
    const view = await render(
      <AppearanceProvider authority={appearance('DARK')}>
        <CallSafeStrip item={item({ category: 'SYSTEM' })} language="ar" onDismiss={onDismiss} />
      </AppearanceProvider>,
    );
    expect(view.getByTestId('qandeel-call-safe-strip').props.accessibilityLabel).toBe(activityCopy('ar').callSafeRegion);
    expect(view.getAllByRole('button')).toHaveLength(1);
    await fireEvent.press(view.getByTestId('qandeel-call-safe-strip-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe.each<ChromeLanguage>(['ar', 'en'])('Notifications & Activity — %s', (language) => {
  const words = notificationsCopy(language);
  function prefs(initial: ActivityPreferences, save: (input: unknown) => ActivityPreferences | null = () => initial) {
    const sent: unknown[] = [];
    const snoozes: (number | null)[] = [];
    let current = initial;
    const controller = createActivityPreferencesController({
      transport: {
        readPreferences: async () => ({ kind: 'READ', preferences: current }),
        savePreferences: async (input) => {
          sent.push(input);
          const next = save(input);
          if (next === null) return { kind: 'UNAVAILABLE' };
          current = next;
          return { kind: 'READ', preferences: next };
        },
        setSnooze: async (minutes) => {
          snoozes.push(minutes);
          current = { ...current, snoozeUntil: minutes === null ? null : new Date(Date.now() + minutes * 60_000).toISOString() };
          return { kind: 'READ', preferences: current };
        },
      },
      isCurrent: () => true,
    });
    return { controller, sent, snoozes };
  }
  async function page(controller: ReturnType<typeof prefs>['controller']) {
    const view = await render(
      <AppearanceProvider authority={appearance('DARK')}>
        <NotificationsSettings controller={controller} language={language} palette={P.DARK.standard} />
      </AppearanceProvider>,
    );
    await flush();
    return view;
  }

  it('sections by Product meaning, in order; Introductions not drawn before the capability; critical security is words, not a switch', async () => {
    const { controller } = prefs(PREFERENCES);
    const view = await page(controller);
    const headers = view.getAllByRole('header').map((node) => node.props.children as string);
    expect(headers).toEqual([words.proactive, words.shared, words.public, words.system, words.quiet, words.snooze, words.lock]);
    expect(view.queryByTestId('qandeel-notifications-introductions')).toBeNull();
    expect(view.getByTestId('qandeel-notifications-security-always').props.children).toBe(words.securityAlways);
    const toggles = view.getAllByRole('togglebutton').map((node) => node.props.accessibilityLabel as string);
    expect(toggles.join(' ')).not.toContain(words.securityAlways);
    expect(view.getByTestId('qandeel-notifications-quiet-range').props.children).toBe(language === 'ar' ? 'من 23:00 إلى 08:00' : '23:00 to 08:00');
    expect(view.getByTestId('qandeel-proactive-allow').props.accessibilityState).toMatchObject({ checked: true });
    expect(view.getByTestId('qandeel-notifications-public-discovery').props.accessibilityState).toMatchObject({ checked: false });
    // The Lock Screen subjects: no Introductions row before the capability exists.
    expect(view.queryByTestId('qandeel-lock-introductions')).toBeNull();
    expect(view.getByTestId('qandeel-lock-qandeel').props.accessibilityLabel).toContain(words.levels.L1);
  });

  it('a change sends the WHOLE set; the server answer is what is shown; a refused save keeps the confirmed state and says so', async () => {
    let refuse = false;
    const { controller, sent } = prefs(PREFERENCES, (input) => (refuse ? null : { ...PREFERENCES, ...(input as object), snoozeUntil: null, introductions: PREFERENCES.introductions }));
    const view = await page(controller);
    await fireEvent.press(view.getByTestId('qandeel-proactive-reduce'));
    await flush();
    expect(sent[0]).toMatchObject({ proactive: 'REDUCE', quietHours: PREFERENCES.quietHours, lockScreen: PREFERENCES.lockScreen });
    expect(view.getByTestId('qandeel-proactive-reduce').props.accessibilityState).toMatchObject({ checked: true });
    refuse = true;
    await fireEvent.press(view.getByTestId('qandeel-notifications-shared'));
    await flush();
    expect(view.getByTestId('qandeel-notifications-shared').props.accessibilityState).toMatchObject({ checked: true });
    expect(view.getByTestId('qandeel-notifications-failed').props.children).toBe(ACTIVITY_COPY_GATE.rows.saveFailed[language]);
  });

  it('Quiet Hours edit on a 30-minute grid; a zero-length window is refused before sending', async () => {
    const { controller, sent } = prefs(PREFERENCES, (input) => ({ ...PREFERENCES, ...(input as object), snoozeUntil: null, introductions: PREFERENCES.introductions }));
    const view = await page(controller);
    await fireEvent.press(view.getByTestId('qandeel-notifications-quiet-start'));
    await fireEvent.press(view.getByTestId('qandeel-notifications-quiet-start-22:30'));
    await flush();
    expect(sent[0]).toMatchObject({ quietHours: { enabled: true, start: '22:30', end: '08:00' } });
    await fireEvent.press(view.getByTestId('qandeel-notifications-quiet-end'));
    await fireEvent.press(view.getByTestId('qandeel-notifications-quiet-end-22:30'));
    await flush();
    expect(sent).toHaveLength(1);
  });

  it('Snooze: 1 h / 8 h / 24 h / Custom, then its active state and End', async () => {
    const { controller, snoozes } = prefs(PREFERENCES);
    const view = await page(controller);
    expect(view.getByTestId('qandeel-notifications-snooze-8h').props.accessibilityLabel).toContain(words.snoozeOptions['8h']);
    await fireEvent.press(view.getByTestId('qandeel-notifications-snooze-custom'));
    await fireEvent.press(view.getByTestId('qandeel-notifications-snooze-longer'));
    await fireEvent.press(view.getByTestId('qandeel-notifications-snooze-custom-confirm'));
    await flush();
    expect(snoozes).toEqual([180]);
    expect(view.getByTestId('qandeel-notifications-snoozed')).toBeTruthy();
    await fireEvent.press(view.getByTestId('qandeel-notifications-snooze-end'));
    await flush();
    expect(snoozes).toEqual([180, null]);
    expect(view.queryByTestId('qandeel-notifications-snoozed')).toBeNull();
  });

  it('Lock Screen ceilings: the four approved labels with their help; a choice saves that one subject', async () => {
    const { controller, sent } = prefs(PREFERENCES, (input) => ({ ...PREFERENCES, ...(input as object), snoozeUntil: null, introductions: PREFERENCES.introductions }));
    const view = await page(controller);
    await fireEvent.press(view.getByTestId('qandeel-lock-shared'));
    const levels = view.getByTestId('qandeel-lock-shared-levels');
    expect(levels.props.accessibilityRole).toBe('radiogroup');
    await fireEvent.press(view.getByTestId('qandeel-lock-shared-L3'));
    await flush();
    expect((sent[0] as ActivityPreferences).lockScreen).toEqual({ ...PREFERENCES.lockScreen, SHARED: 'L3' });
  });
});
