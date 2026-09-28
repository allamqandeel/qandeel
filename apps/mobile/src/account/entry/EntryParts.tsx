/**
 * W1B-01 — the account entry's parts, in QANDEEL's frozen visual language from the first frame.
 *
 *   - the World (Dark, P1's default for non-Analysis surfaces) is the ground;
 *   - a field is the FIELD role (`qandeel.role.field.fill`), its words the primary ink, its label the
 *     E3 action role, its help and its message the supporting role — a message is words, never only a
 *     colour;
 *   - the primary act is a FIELD-filled slab; a secondary act is an open control in the rest ink; both
 *     carry E1R's pressed presence and F1's focus perimeter through the shared `Control`;
 *   - Estedad v8.5 static faces carry every weight; no letter-spacing anywhere, so Arabic stays joined.
 *
 * No part here writes a Product word: every string arrives from `../copy.ts` through its caller.
 * Credentials, Login IDs, Email addresses and the code are Latin byte sequences, so their fields stay
 * physically left-to-right inside an Arabic layout (T-14 §5), and only those fields do.
 */
import { useState, type ReactNode, type Ref } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Control, Glyph, typeStyle, usePalette, type ConversationPalette } from '../../conversation';
import type { ChromeLanguage } from '../../orientation-chrome';

export interface EntryLocale {
  readonly language: ChromeLanguage;
  readonly direction: 'RTL' | 'LTR';
}

/** The one spacing constant, added to the reader's real safe-area inset rather than replacing it. */
const GUTTER = 24;

/**
 * The frame every entry screen stands in. It scrolls rather than clips when the keyboard and a large
 * text size take the viewport, and it keeps the lower fields and acts above the keyboard on both
 * platforms — including Android 15+'s enforced edge-to-edge window, which no longer resizes for the
 * keyboard (the W1A-01 finding), hence `padding` everywhere.
 */
export function EntryFrame({ locale, testID, children }: { readonly locale: EntryLocale; readonly testID: string; readonly children: ReactNode }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: palette.world }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: insets.top + GUTTER,
          paddingBottom: insets.bottom + GUTTER,
          paddingLeft: insets.left + GUTTER,
          paddingRight: insets.right + GUTTER,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View
          testID={testID}
          accessibilityLanguage={locale.language}
          // The layout direction is the reader's; it is never derived from the language.
          style={{ width: '100%', maxWidth: 420, alignSelf: 'center', rowGap: 20, direction: locale.direction === 'RTL' ? 'rtl' : 'ltr' }}
        >
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const writing = (language: ChromeLanguage) => (language === 'ar' ? 'rtl' : 'ltr');

export function EntryTitle({ text, language, testID }: { readonly text: string; readonly language: ChromeLanguage; readonly testID?: string }) {
  const palette = usePalette();
  return (
    <Text testID={testID} accessibilityRole="header" style={{ ...typeStyle('statement'), color: palette.primary, writingDirection: writing(language) }}>
      {text}
    </Text>
  );
}

export function EntryText({ text, language, role = 'body', tone = 'secondary', testID }: {
  readonly text: string;
  readonly language: ChromeLanguage;
  readonly role?: 'body' | 'supporting';
  readonly tone?: 'primary' | 'secondary';
  readonly testID?: string;
}) {
  const palette = usePalette();
  return (
    <Text testID={testID} style={{ ...typeStyle(role), color: tone === 'primary' ? palette.primary : palette.secondary, writingDirection: writing(language) }}>
      {text}
    </Text>
  );
}

export interface EntryFieldProps extends Omit<TextInputProps, 'style' | 'accessibilityLabel' | 'accessibilityHint'> {
  readonly label: string;
  /** Persistent help, shown under the label and spoken as the field's hint (P1 §2.1: never a placeholder). */
  readonly help?: string;
  /** The field's current message. Words, announced politely; never a colour alone. */
  readonly message?: string | null;
  readonly language: ChromeLanguage;
  /** A Latin byte sequence (Email, Login ID, password, code): the field stays physically left-to-right. */
  readonly latin?: boolean;
  readonly inputRef?: Ref<TextInput>;
  readonly testID: string;
}

export function EntryField({ label, help, message, language, latin = false, inputRef, testID, ...input }: EntryFieldProps) {
  const palette = usePalette();
  const [focused, setFocused] = useState(false);
  const reader = writing(language);
  return (
    <View style={{ rowGap: 6 }}>
      <Text style={{ ...typeStyle('action'), color: palette.secondary, writingDirection: reader }}>{label}</Text>
      {help === undefined ? null : (
        <Text testID={`${testID}-help`} style={{ ...typeStyle('supporting'), color: palette.tertiary, writingDirection: reader }}>
          {help}
        </Text>
      )}
      <TextInput
        {...input}
        ref={inputRef}
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={help}
        // The label and hint are the reader's language; only the typed value is Latin.
        accessibilityLanguage={language}
        onFocus={(event) => {
          setFocused(true);
          input.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          input.onBlur?.(event);
        }}
        selectionColor={palette.primary}
        cursorColor={palette.primary}
        style={{
          ...typeStyle('body'),
          color: palette.primary,
          backgroundColor: palette.field,
          minHeight: 48,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderWidth: palette.focusThickness,
          // The F1 focus indicator while the field has focus; the World's own colour otherwise, so the
          // field does not move by a pixel when focus arrives.
          borderColor: focused ? palette.focusIndicator : palette.field,
          textAlign: latin ? 'left' : reader === 'rtl' ? 'right' : 'left',
          writingDirection: latin ? 'ltr' : reader,
        }}
      />
      <EntryMessage text={message ?? null} language={language} testID={`${testID}-message`} />
    </View>
  );
}

/** One polite region, always mounted, so a change into it can be announced. Empty takes no room. */
export function EntryMessage({ text, language, testID, tone = 'error' }: {
  readonly text: string | null;
  readonly language: ChromeLanguage;
  readonly testID: string;
  readonly tone?: 'error' | 'status';
}) {
  const palette = usePalette();
  return (
    <View testID={testID} accessibilityLiveRegion="polite">
      {text === null ? null : (
        <Text style={{ ...typeStyle('supporting'), color: tone === 'error' ? palette.error : palette.secondary, writingDirection: writing(language) }}>
          {text}
        </Text>
      )}
    </View>
  );
}

/** The screen's primary act: a FIELD-filled slab, busy while its one request is in flight. */
export function EntryAction({ label, onPress, busy, language, testID }: {
  readonly label: string;
  readonly onPress: () => void;
  readonly busy: boolean;
  readonly language: ChromeLanguage;
  readonly testID: string;
}) {
  const palette = usePalette();
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      onPress={onPress}
      testID={testID}
      style={{ minHeight: 48, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: palette.field, opacity: busy ? 0.6 : 1 }}
    >
      <Text style={{ ...typeStyle('action'), color: palette.primary, textAlign: 'center', writingDirection: writing(language) }}>{label}</Text>
    </Control>
  );
}

/** A secondary act: open on the World, in the rest ink, optionally led by P2's back chevron. */
export function EntryLink({ label, onPress, language, testID, back = false, inert = false }: {
  readonly label: string;
  readonly onPress: () => void;
  readonly language: ChromeLanguage;
  readonly testID: string;
  readonly back?: boolean;
  readonly inert?: boolean;
}) {
  const palette: ConversationPalette = usePalette();
  const direction = writing(language);
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={label}
      accessibilityState={inert ? { disabled: true } : undefined}
      onPress={onPress}
      testID={testID}
      style={{ alignSelf: 'flex-start', paddingHorizontal: 8 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 6 }}>
        {back ? <Glyph name="back" color={palette.restInk} direction={direction} /> : null}
        <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: direction }}>{label}</Text>
      </View>
    </Control>
  );
}
