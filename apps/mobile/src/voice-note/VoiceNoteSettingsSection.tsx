/**
 * S8B-03 (CP2, contract §7.6, OD-4) — «الرسائل الصوتية» / Voice messages in the ONE General Settings destination.
 *
 *   C-44  the group's name;
 *   C-45  the retention, in words: 30 days from when a recording reached QANDEEL (`accepted_at`), then deleted;
 *   C-46  while the reader's consent is GRANTED: the withdrawal, behind its consequence C-47 (the one destructive act
 *         after the consequence, with Cancel — the approved word of C-43); once withdrawn, C-48 says so.
 *
 * Drawn while Voice Notes are offered, or once the reader has ever consented — so a withdrawal is always reachable.
 * Every word is an approved row; nothing is logged.
 */
import { useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import { Control, MIN_TARGET, readerDirection, readerSide, typeStyle, usePalette, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { voiceNotePair, voiceNoteText } from './voice-note-copy';
import type { VoiceNoteSession } from './voice-note-session';

const ROW_START = 24;
const ROW_END = 20;

function Act({ label, onPress, busy = false, language, palette, testID }: {
  readonly label: string;
  readonly onPress: () => void;
  readonly busy?: boolean;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly testID: string;
}) {
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      onPress={onPress}
      testID={testID}
      style={{ minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, opacity: busy ? 0.6 : 1 }}
    >
      <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: readerDirection(language) }}>{label}</Text>
    </Control>
  );
}

/** Whether the group is drawn at all. */
export function voiceNoteSettingsShown(session: VoiceNoteSession): boolean {
  const own = session.getState();
  return own.offered || (own.consentState !== null && own.consentState !== 'NONE');
}

export function VoiceNoteSettingsSection({ session, language }: { readonly session: VoiceNoteSession; readonly language: ChromeLanguage }) {
  const palette = usePalette();
  const own = useSyncExternalStore(session.subscribe, session.getState);
  const [confirming, setConfirming] = useState(false);
  if (!(own.offered || (own.consentState !== null && own.consentState !== 'NONE'))) return null;
  const side = readerSide(language);
  const writing = readerDirection(language);
  const line = (text: string, testID: string, live = false) => (
    <Text
      testID={testID}
      accessibilityLanguage={language}
      accessibilityLiveRegion={live ? 'polite' : undefined}
      style={{ ...typeStyle('supporting'), color: palette.secondary, textAlign: side, writingDirection: writing, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 6 }}
    >
      {text}
    </Text>
  );
  const [, cancelLabel] = voiceNotePair('C-43', language);
  // A consent to an earlier version permits nothing, but it is still held: it can be withdrawn like a current one.
  const holdsConsent = own.consentState === 'GRANTED' || own.consentState === 'OUTDATED';
  return (
    <View testID="qandeel-settings-group-voice">
      <Text
        accessibilityRole="header"
        accessibilityLanguage={language}
        testID="qandeel-settings-group-voice-name"
        style={{ ...typeStyle('action'), color: palette.secondary, textAlign: side, writingDirection: writing, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 20, paddingBottom: 6 }}
      >
        {voiceNoteText('C-44', language)}
      </Text>
      {line(voiceNoteText('C-45', language), 'qandeel-voice-retention')}
      {own.consentState === 'WITHDRAWN' ? line(voiceNoteText('C-48', language), 'qandeel-voice-consent-withdrawn', true) : null}
      {holdsConsent && !confirming ? (
        <Act label={voiceNoteText('C-46', language)} onPress={() => setConfirming(true)} language={language} palette={palette} testID="qandeel-voice-withdraw" />
      ) : null}
      {holdsConsent && confirming ? (
        <View testID="qandeel-voice-withdraw-confirm">
          {line(voiceNoteText('C-47', language), 'qandeel-voice-withdraw-consequence')}
          <Act
            label={voiceNoteText('C-46', language)}
            busy={own.withdrawing}
            onPress={() => {
              void session.withdrawConsent().then((outcome) => {
                if (outcome === 'DONE') setConfirming(false);
              });
            }}
            language={language}
            palette={palette}
            testID="qandeel-voice-withdraw-yes"
          />
          <Act label={cancelLabel} onPress={() => setConfirming(false)} language={language} palette={palette} testID="qandeel-voice-withdraw-no" />
        </View>
      ) : null}
    </View>
  );
}
