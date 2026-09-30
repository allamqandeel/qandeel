/**
 * W3-01 — the General Settings surface and the Personal Settings entry, in Arabic and English, in every
 * appearance state: the stable React UI proof states (no frame timing, no OS transition, no raster).
 *
 * The appearance is the REAL authority over an in-memory store; only the operating system's appearance is a
 * switch the test flips. Every colour asserted is read from the generated canonical families.
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import {
  AppearanceProvider,
  createAppearanceAuthority,
  createEphemeralAppearancePreferenceStore,
  type AppearanceAuthority,
  type AppearancePreference,
  type EffectiveAppearance,
} from '../../appearance';
import { ConversationSurface, createConversationController } from '../../conversation';
import { CANONICAL_VISUAL } from '../../conversation/visual/canonical-visual.generated';
import { exchange, flush, page, scriptedTransport } from '../../conversation/__fixtures__/conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import { SettingsSurface, settingsCopy } from '..';

// W3-MEGA-S re-anchor (validation only): the Language row of «قنديل والمحادثة» / QANDEEL & Conversation is now a real group
// of every Settings root, drawn before Appearance & Accessibility. The language name is its own run (LRI … PDI) in English.
const drawnLanguage = (language: 'ar' | 'en') => (language === 'ar' ? 'العربية' : String.fromCodePoint(0x2066) + 'English' + String.fromCodePoint(0x2069));


const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const P = CANONICAL_VISUAL.palettes;
const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

function authorityFor(preference: AppearancePreference | null, system: EffectiveAppearance = 'LIGHT') {
  let current = system;
  const listeners = new Set<(next: EffectiveAppearance) => void>();
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore(preference === null ? {} : { reader: preference }),
    system: { current: () => current, subscribe: (listener) => (listeners.add(listener), () => listeners.delete(listener)) },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return {
    authority,
    async os(next: EffectiveAppearance) {
      current = next;
      await act(async () => {
        for (const listener of Array.from(listeners)) listener(next);
      });
    },
  };
}

async function settings(language: ChromeLanguage, authority: AppearanceAuthority, onSignOut: () => Promise<unknown> = async () => undefined) {
  const onBack = jest.fn();
  const view = await render(
    <AppearanceProvider authority={authority}>
      <SettingsSurface language={language} insets={INSETS} onBack={onBack} onSignOut={onSignOut} />
    </AppearanceProvider>,
  );
  return { view, onBack };
}

async function personal(language: ChromeLanguage, authority: AppearanceAuthority) {
  const transport = scriptedTransport();
  const controller = createConversationController({
    sessionId: '11111111-1111-4111-8111-111111111111',
    transport,
    isCurrent: () => true,
    onReplyCommitted: () => undefined,
    newSubmissionKey: () => 'key-1',
    setTimer: () => null,
    clearTimer: () => undefined,
  });
  const opened = { settings: 0 };
  const view = await render(
    <AppearanceProvider authority={authority}>
      <ConversationSurface controller={controller} language={language} insets={INSETS} onOpenAnalysis={() => undefined} onOpenSettings={() => { opened.settings += 1; }} />
    </AppearanceProvider>,
  );
  await act(async () => {
    await flush();
  });
  if (transport.pending().reads > 0) {
    await act(async () => {
      transport.answerRead(page([exchange('fixture: السلام عليكم', { reply: 'fixture: وعليكم السلام' })]));
      await flush();
    });
  }
  return { view, opened };
}

const markerOf = (view: RenderResult, preference: AppearancePreference) => style(view.getByTestId(`qandeel-appearance-${preference.toLowerCase()}-marker`));

describe.each(['ar', 'en'] as const)('%s — the Personal Settings entry (P4-C1 S-B)', (language) => {
  it('stands on the Personal row at the reader’s END edge, icon-only, 44 × 44, on the Dark default ground', async () => {
    const { authority } = authorityFor(null);
    const { view, opened } = await personal(language, authority);
    const row = view.getByTestId('qandeel-personal-row');
    // Arabic reads right-to-left, so its END is the LEFT; English's END is the RIGHT (explicit LTR frame).
    expect(style(row).justifyContent).toBe(language === 'ar' ? 'flex-start' : 'flex-end');
    const entry = within(row).getByTestId('qandeel-settings-entry');
    expect(entry.props.accessibilityLabel).toBe(settingsCopy(language).title);
    expect(entry.props.accessibilityLanguage).toBe(language);
    expect(style(entry)).toMatchObject({ width: 44, height: 44 });
    expect(within(row).queryByText(settingsCopy(language).title)).toBeNull();
    // The Dark default: the ground and the glyph's ink are the Dark family's.
    expect(style(view.getByTestId('qandeel-conversation')).backgroundColor).toBe(P.DARK.standard.world);
    await fireEvent.press(entry);
    expect(opened.settings).toBe(1);
  });

  it('is absent when the Personal world does not supply it (no placeholder)', async () => {
    const { authority } = authorityFor(null);
    const view = await render(
      <AppearanceProvider authority={authority}>
        <ConversationSurface
          controller={createConversationController({ sessionId: '11111111-1111-4111-8111-111111111111', transport: scriptedTransport(), isCurrent: () => true, onReplyCommitted: () => undefined })}
          language={language}
          insets={INSETS}
          onOpenAnalysis={() => undefined}
        />
      </AppearanceProvider>,
    );
    expect(view.queryByTestId('qandeel-personal-row')).toBeNull();
    expect(view.queryByTestId('qandeel-settings-entry')).toBeNull();
  });
});

describe.each(['ar', 'en'] as const)('%s — the General Settings surface', (language) => {
  const copy = settingsCopy(language);

  it.each([
    ['DARK', 'LIGHT', 'DARK'],
    ['LIGHT', 'DARK', 'LIGHT'],
    ['SYSTEM', 'LIGHT', 'LIGHT'],
    ['SYSTEM', 'DARK', 'DARK'],
  ] as const)('preference %s on an OS in %s paints the %s family, with that choice selected by shape and state', async (preference, os, effective) => {
    const { authority } = authorityFor(preference, os);
    const { view } = await settings(language, authority);
    const family = P[effective].standard;
    expect(style(view.getByTestId('qandeel-settings')).backgroundColor).toBe(family.world);
    expect(style(view.getByTestId('qandeel-settings-title'))).toMatchObject({ color: family.primary });
    for (const choice of ['DARK', 'LIGHT', 'SYSTEM'] as const) {
      const selected = choice === preference;
      const node = view.getByTestId(`qandeel-appearance-${choice.toLowerCase()}`);
      expect(node.props.accessibilityRole).toBe('radio');
      expect(node.props.accessibilityState).toMatchObject({ checked: selected, selected });
      expect(markerOf(view, choice).borderColor).toBe(selected ? family.selectedInk : family.restInk);
      expect(view.queryByTestId(`qandeel-appearance-${choice.toLowerCase()}-selected`) !== null).toBe(selected);
    }
  });

  it('lays out logically for the reader: the frame’s direction is theirs, and Back points back in it', async () => {
    const { authority } = authorityFor(null);
    const { view, onBack } = await settings(language, authority);
    expect(style(view.getByTestId('qandeel-settings')).direction).toBe(language === 'ar' ? 'rtl' : 'ltr');
    const back = view.getByTestId('qandeel-settings-back');
    expect(back.props.accessibilityLabel).toBe(copy.backName);
    expect(style(back)).toMatchObject({ width: 44, height: 44 });
    await fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows exactly the approved words, in reading order: title, Appearance & Accessibility and its three choices, Support & About and Sign out', async () => {
    const { authority } = authorityFor(null);
    const { view } = await settings(language, authority);
    const words = view.getAllByText(/.+/u).map((node) => node.props.children as string);
    expect(words).toEqual([copy.title, copy.qandeelGroup, copy.language.term, drawnLanguage(language), copy.appearanceGroup, copy.appearance.DARK, copy.appearance.LIGHT, copy.appearance.SYSTEM, copy.supportGroup, copy.signOut]);
    const group = view.getByTestId('qandeel-settings-group-appearance');
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(within(view.getByTestId('qandeel-settings-group-support')).getByRole('button').props.accessibilityLabel).toBe(copy.signOut);
  });

  it('a choice applies at once and System then follows the OS live', async () => {
    const { authority, os } = authorityFor(null, 'DARK');
    const { view } = await settings(language, authority);
    await fireEvent.press(view.getByTestId('qandeel-appearance-light'));
    expect(style(view.getByTestId('qandeel-settings')).backgroundColor).toBe(P.LIGHT.standard.world);
    await fireEvent.press(view.getByTestId('qandeel-appearance-system'));
    expect(style(view.getByTestId('qandeel-settings')).backgroundColor).toBe(P.DARK.standard.world);
    await os('LIGHT');
    expect(style(view.getByTestId('qandeel-settings')).backgroundColor).toBe(P.LIGHT.standard.world);
    await fireEvent.press(view.getByTestId('qandeel-appearance-dark'));
    await os('DARK');
    await os('LIGHT');
    expect(style(view.getByTestId('qandeel-settings')).backgroundColor).toBe(P.DARK.standard.world);
  });

  it('Sign out: one call; while in flight the control is busy and dimmed, and presses are refused', async () => {
    const { authority } = authorityFor(null);
    let calls = 0;
    const { view } = await settings(language, authority, () => {
      calls += 1;
      return new Promise(() => undefined);
    });
    await fireEvent.press(view.getByTestId('qandeel-settings-sign-out'));
    await fireEvent.press(view.getByTestId('qandeel-settings-sign-out'));
    expect(calls).toBe(1);
    const control = view.getByTestId('qandeel-settings-sign-out');
    expect(control.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(style(control).opacity).toBe(0.6);
  });
});

describe('320-width and 2× text: nothing is clipped, nothing is capped', () => {
  it('every text may wrap and scale; the body scrolls; no row has a fixed width', async () => {
    const { authority } = authorityFor(null);
    const { view } = await settings('ar', authority);
    // The body scrolls instead of clipping when a large text size takes the viewport.
    expect(view.getByTestId('qandeel-settings-body').type).toBe('RCTScrollView');
    for (const node of view.getAllByText(/.+/u)) {
      expect(node.props.allowFontScaling).not.toBe(false);
      expect(node.props.maxFontSizeMultiplier).toBeUndefined();
      expect(node.props.numberOfLines).toBeUndefined();
    }
    // The title and each choice's word shrink within their row rather than pushing past it.
    expect(style(view.getByTestId('qandeel-settings-title')).flexShrink).toBe(1);
    for (const choice of ['dark', 'light', 'system']) {
      const row = view.getByTestId(`qandeel-appearance-${choice}`);
      expect(style(row).width).toBeUndefined();
      expect(style(row).minHeight).toBe(44);
      const [word] = within(row).getAllByText(/.+/u);
      expect(style(word).flexShrink).toBe(1);
    }
  });
});

describe('increased contrast and focus', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['DARK', 'LIGHT'] as const)('%s: the F1 increased rest ink and the thicker focus perimeter', async (preference) => {
    jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(true);
    const { authority } = authorityFor(preference);
    const { view } = await settings('en', authority);
    await act(async () => {
      await Promise.resolve();
    });
    const family = P[preference].increased;
    const other = preference === 'DARK' ? 'light' : 'dark';
    expect(markerOf(view, other.toUpperCase() as AppearancePreference).borderColor).toBe(family.restInk);
    await fireEvent(view.getByTestId('qandeel-settings-back'), 'focus');
    const ring = style(view.getByTestId('qandeel-settings-back-focus'));
    expect(ring).toMatchObject({ borderWidth: 3, borderColor: family.focusIndicator });
  });
});
