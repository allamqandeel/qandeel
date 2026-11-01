/**
 * S8B-03 (CP2, contract §7.6, OD-4) — «الرسائل الصوتية» / Voice messages in General Settings: drawn while Voice Notes are
 * offered or once the reader has ever consented; the retention in words (C-45); the withdrawal only behind its
 * consequence (C-46 → C-47, Cancel = C-43's second half); once withdrawn, C-48. Every word an approved row, ar + en.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';

import type { ChromeLanguage } from '../../orientation-chrome';
import type { VoiceConsentState } from '../voice-note-api';
import { voiceNotePair, voiceNoteText } from '../voice-note-copy';
import type { VoiceNoteSession, VoiceNoteSessionState } from '../voice-note-session';
import { voiceNoteSettingsShown, VoiceNoteSettingsSection } from '../VoiceNoteSettingsSection';

jest.mock('expo-sqlite/kv-store', () => ({ SQLiteStorage: jest.fn() }));
jest.mock('expo-file-system', () => ({ Directory: jest.fn(), File: jest.fn(), Paths: {} }));

/** A Session as the section reads it: its state, and the one act it calls. */
function stubSession(offered: boolean, consentState: VoiceConsentState | null) {
  let state: VoiceNoteSessionState = { offered, consentCurrent: consentState === 'GRANTED', consentState, withdrawing: false, sheet: null, notice: null };
  const listeners = new Set<() => void>();
  const set = (next: Partial<VoiceNoteSessionState>) => {
    state = { ...state, ...next };
    for (const l of listeners) l();
  };
  let finish: (outcome: 'DONE' | 'FAILED') => void = () => undefined;
  const withdrawConsent = jest.fn(() => {
    set({ withdrawing: true });
    return new Promise<'DONE' | 'FAILED'>((resolve) => {
      finish = (outcome) => {
        set(outcome === 'DONE' ? { withdrawing: false, consentState: 'WITHDRAWN', consentCurrent: false } : { withdrawing: false });
        resolve(outcome);
      };
    });
  });
  const session = {
    getState: () => state,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    withdrawConsent,
  } as unknown as VoiceNoteSession;
  return { session, withdrawConsent, finish: (outcome: 'DONE' | 'FAILED') => act(async () => finish(outcome)) };
}

async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => undefined);
}

describe.each<ChromeLanguage>(['ar', 'en'])('Voice messages in Settings (%s)', (language) => {
  it('is not drawn while Voice Notes are not offered and the reader never consented (the gates DISABLED)', async () => {
    for (const consent of [null, 'NONE'] as const) {
      const { session } = stubSession(false, consent);
      expect(voiceNoteSettingsShown(session)).toBe(false);
      const view = await render(<VoiceNoteSettingsSection session={session} language={language} />);
      expect(view.queryByTestId('qandeel-settings-group-voice')).toBeNull();
      await view.unmount();
    }
  });

  it('offered: the group name (C-44) and the retention in words (C-45); no withdrawal before a consent', async () => {
    const { session } = stubSession(true, 'NONE');
    const view = await render(<VoiceNoteSettingsSection session={session} language={language} />);
    expect(view.getByTestId('qandeel-settings-group-voice-name').props.children).toBe(voiceNoteText('C-44', language));
    expect(view.getByTestId('qandeel-settings-group-voice-name').props.accessibilityRole).toBe('header');
    expect(view.getByTestId('qandeel-voice-retention').props.children).toBe(voiceNoteText('C-45', language));
    expect(view.queryByTestId('qandeel-voice-withdraw')).toBeNull();
    expect(view.queryByTestId('qandeel-voice-consent-withdrawn')).toBeNull();
  });

  it('OD-4: C-46 opens its consequence (C-47); Cancel keeps the consent; the second C-46 withdraws, then C-48 says so', async () => {
    // Drawn even once Voice Notes are no longer offered: a withdrawal is always reachable after a consent.
    const t = stubSession(false, 'GRANTED');
    const view = await render(<VoiceNoteSettingsSection session={t.session} language={language} />);
    expect(view.getByTestId('qandeel-voice-withdraw').props.accessibilityLabel).toBe(voiceNoteText('C-46', language));
    await press(view, 'qandeel-voice-withdraw');
    expect(view.getByTestId('qandeel-voice-withdraw-consequence').props.children).toBe(voiceNoteText('C-47', language));
    expect(view.getByTestId('qandeel-voice-withdraw-no').props.accessibilityLabel).toBe(voiceNotePair('C-43', language)[1]);
    await press(view, 'qandeel-voice-withdraw-no');
    expect(view.queryByTestId('qandeel-voice-withdraw-confirm')).toBeNull();
    expect(t.withdrawConsent).not.toHaveBeenCalled();

    await press(view, 'qandeel-voice-withdraw');
    await press(view, 'qandeel-voice-withdraw-yes');
    expect(t.withdrawConsent).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('qandeel-voice-withdraw-yes').props.accessibilityState).toEqual({ busy: true, disabled: true });
    await t.finish('DONE');
    expect(view.queryByTestId('qandeel-voice-withdraw-confirm')).toBeNull();
    expect(view.queryByTestId('qandeel-voice-withdraw')).toBeNull();
    const withdrawn = view.getByTestId('qandeel-voice-consent-withdrawn');
    expect(withdrawn.props.children).toBe(voiceNoteText('C-48', language));
    expect(withdrawn.props.accessibilityLiveRegion).toBe('polite');
  });

  it('a withdrawal that did not reach QANDEEL leaves the consequence open, to try again', async () => {
    const t = stubSession(true, 'GRANTED');
    const view = await render(<VoiceNoteSettingsSection session={t.session} language={language} />);
    await press(view, 'qandeel-voice-withdraw');
    await press(view, 'qandeel-voice-withdraw-yes');
    await t.finish('FAILED');
    expect(view.getByTestId('qandeel-voice-withdraw-confirm')).toBeTruthy();
    expect(view.getByTestId('qandeel-voice-withdraw-yes').props.accessibilityState).toEqual({ busy: false, disabled: false });
  });
});
