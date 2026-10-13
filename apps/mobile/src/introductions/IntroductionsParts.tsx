/**
 * S6-01 — the small building blocks of the Introductions preparation surface: paragraphs, choices, actions and fields
 * in the Personal page composition (the same rows, ink and 44-point targets as Settings and Understanding). Logical
 * layout only (start / end), so Arabic and English mirror correctly; no fixed width, so 320 points fit.
 */
import { useState, type ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';

export const ROW_START = 24;
export const ROW_END = 20;
export const BUSY_OPACITY = 0.6;
const FIELD_MIN_HEIGHT = 48;
const FIELD_RADIUS = 12;

export interface PartContext {
  readonly palette: ConversationPalette;
  readonly language: ChromeLanguage;
  readonly writing: 'rtl' | 'ltr';
  readonly busy: boolean;
}

export function Para({ ctx, text, role = 'body', color, testID }: {
  readonly ctx: PartContext; readonly text: string; readonly role?: 'body' | 'supporting' | 'metadata' | 'statement'; readonly color?: string; readonly testID?: string;
}) {
  return (
    <Text testID={testID} style={{ ...typeStyle(role), color: color ?? ctx.palette.primary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 4, writingDirection: ctx.writing }}>
      {text}
    </Text>
  );
}

export function Heading({ ctx, text, testID }: { readonly ctx: PartContext; readonly text: string; readonly testID?: string }) {
  return (
    <Text
      accessibilityRole="header"
      accessibilityLanguage={ctx.language}
      testID={testID}
      style={{ ...typeStyle('action'), color: ctx.palette.primary, paddingTop: 18, paddingBottom: 4, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: ctx.writing }}
    >
      {text}
    </Text>
  );
}

/** The owner's own words, set apart and never rewritten. */
export function Quote({ ctx, text, testID }: { readonly ctx: PartContext; readonly text: string; readonly testID?: string }) {
  return (
    <View style={{ marginStart: ROW_START, marginEnd: ROW_END, marginVertical: 8, paddingStart: 12, borderStartWidth: 2, borderColor: ctx.palette.tertiary }}>
      <Text testID={testID} style={{ ...typeStyle('body'), color: ctx.palette.primary, writingDirection: ctx.writing }}>{text}</Text>
    </View>
  );
}

/** One action: a full-width row, 44 points high at least. `primary` is drawn in the rest ink, as every primary act. */
export function Action({ ctx, label, onPress, testID, primary = false, disabled = false, accessibilityLabel }: {
  readonly ctx: PartContext; readonly label: string; readonly onPress: () => void; readonly testID: string;
  readonly primary?: boolean; readonly disabled?: boolean; readonly accessibilityLabel?: string;
}) {
  const off = ctx.busy || disabled;
  return (
    <Control
      palette={ctx.palette}
      language={ctx.language}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy: ctx.busy, disabled: off }}
      onPress={off ? () => undefined : onPress}
      testID={testID}
      style={primary
        ? { minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: 16, paddingEnd: 16, marginStart: ROW_START - 8, marginEnd: ROW_END - 8, marginVertical: 6,
          borderRadius: 12, backgroundColor: ctx.palette.field, opacity: off ? BUSY_OPACITY : 1 }
        : { minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, opacity: off ? BUSY_OPACITY : 1 }}
    >
      <Text style={{ ...typeStyle('action'), color: ctx.palette.primary, writingDirection: ctx.writing }}>{label}</Text>
    </Control>
  );
}

/** One choice of a closed set. A radio (one of) or a toggle (any of); its state is announced, never colour alone. */
export function Choice({ ctx, label, selected, onPress, testID, multiple = false }: {
  readonly ctx: PartContext; readonly label: string; readonly selected: boolean; readonly onPress: () => void; readonly testID: string; readonly multiple?: boolean;
}) {
  return (
    <Control
      palette={ctx.palette}
      language={ctx.language}
      accessibilityRole={multiple ? 'togglebutton' : 'radio'}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled: ctx.busy }}
      onPress={ctx.busy ? () => undefined : onPress}
      testID={testID}
      style={{
        minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0,
        backgroundColor: selected ? ctx.palette.field : undefined, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', columnGap: 10,
      }}
    >
      <Text style={{ ...typeStyle('body'), color: ctx.palette.primary, writingDirection: ctx.writing, flexShrink: 1 }}>{label}</Text>
      {selected ? <Text accessibilityElementsHidden importantForAccessibility="no" style={{ ...typeStyle('body'), color: ctx.palette.restInk }}>✓</Text> : null}
    </Control>
  );
}

export function Field({ ctx, label, value, onChange, testID, maxLength, numeric = false, multiline = false, direction }: {
  readonly ctx: PartContext; readonly label: string; readonly value: string; readonly onChange: (text: string) => void; readonly testID: string;
  readonly maxLength: number; readonly numeric?: boolean; readonly multiline?: boolean; readonly direction?: 'rtl' | 'ltr';
}) {
  const [focused, setFocused] = useState(false);
  const writing = direction ?? ctx.writing;
  return (
    <View style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 6 }}>
      <Text style={{ ...typeStyle('metadata'), color: ctx.palette.secondary, paddingBottom: 4, writingDirection: ctx.writing }}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        editable={!ctx.busy}
        accessibilityLabel={label}
        accessibilityLanguage={ctx.language}
        accessibilityState={{ disabled: ctx.busy }}
        autoCorrect={false}
        autoComplete="off"
        importantForAutofill="no"
        keyboardType={numeric ? 'number-pad' : 'default'}
        maxLength={maxLength}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={ctx.palette.primary}
        cursorColor={ctx.palette.primary}
        style={{
          ...typeStyle('body'),
          color: ctx.palette.primary,
          backgroundColor: ctx.palette.field,
          minHeight: multiline ? FIELD_MIN_HEIGHT * 2 : FIELD_MIN_HEIGHT,
          borderRadius: FIELD_RADIUS,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderWidth: ctx.palette.focusThickness,
          borderColor: focused ? ctx.palette.focusIndicator : ctx.palette.field,
          textAlign: writing === 'rtl' ? 'right' : 'left',
          textAlignVertical: multiline ? 'top' : 'center',
          writingDirection: writing,
        }}
      />
    </View>
  );
}

/** A group of choices that wraps on a narrow screen. */
export function Choices({ children }: { readonly children: ReactNode }) {
  return <View>{children}</View>;
}
