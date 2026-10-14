/**
 * S6-01 — the small building blocks of the Introductions preparation surface: paragraphs, choices, actions and fields
 * in the Personal page composition (the same rows, ink and 44-point targets as Settings and Understanding). Logical
 * layout only (start / end), so Arabic and English mirror correctly; no fixed width, so 320 points fit.
 *
 * VIS-2 (Living Portrait): the current act is drawn on the Field — "the sheet" — while what is settled stays on the
 * World. A part on the sheet takes the World as its contrasting ground (inputs, the selected choice, the primary act),
 * so nothing disappears into the surface it stands on, in Dark and Light alike.
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
const PRIMARY_MIN_HEIGHT = 52;
const PRIMARY_RADIUS = 14;
const PRIMARY_OUTLINE = 1.5;

/**
 * The approved calmer hierarchy (Product Owner, VIS-1 decision): local sizes on the shipped Estedad Medium face — the
 * E3 `action` role's face, so no new weight and no generated token is touched. Text still scales with the system.
 */
const medium = (fontSize: number, lineHeight: number) => ({ ...typeStyle('action'), fontSize, lineHeight });
export const LOCAL_TYPE = Object.freeze({
  /** The compact header title. */
  header: medium(17, 30),
  /** The one current question or decision. */
  question: medium(20, 32),
  /** The owner's first name, in the composed (review) portrait only. */
  name: medium(24, 38),
});

export interface PartContext {
  readonly palette: ConversationPalette;
  readonly language: ChromeLanguage;
  readonly writing: 'rtl' | 'ltr';
  readonly busy: boolean;
  /** Drawn on the sheet (the Field): the contrasting ground of its parts is the World. */
  readonly onSheet?: boolean;
  /** Receives the current step's question, where the screen reader arrives once per step. */
  readonly onHeading?: (node: Text | null) => void;
}

const groundOf = (ctx: PartContext) => (ctx.onSheet ? ctx.palette.world : ctx.palette.field);

export function Para({ ctx, text, role = 'body', color, testID }: {
  readonly ctx: PartContext; readonly text: string; readonly role?: 'body' | 'supporting' | 'metadata' | 'statement'; readonly color?: string; readonly testID?: string;
}) {
  return (
    <Text testID={testID} style={{ ...typeStyle(role), color: color ?? ctx.palette.primary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 4, writingDirection: ctx.writing }}>
      {text}
    </Text>
  );
}

/** The one current question or decision of a step: the most prominent words on the screen. */
export function Question({ ctx, text, testID }: { readonly ctx: PartContext; readonly text: string; readonly testID?: string }) {
  const { onHeading, language, palette, writing } = ctx;
  return (
    <Text
      ref={onHeading}
      accessibilityRole="header"
      accessibilityLanguage={language}
      testID={testID}
      style={{ ...LOCAL_TYPE.question, color: palette.primary, paddingTop: 6, paddingBottom: 6, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}
    >
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

/** Quotation marks by reading language: the owner's words are always shown as quoted, never as QANDEEL's own. */
export const QUOTE_MARKS: Readonly<Record<ChromeLanguage, readonly [string, string]>> = Object.freeze({ ar: ['«', '»'], en: ['\u201C', '\u201D'] });

/** The owner's own words, quoted and never rewritten. The words themselves are one text node (`testID`). */
export function Quote({ ctx, text, testID, role = 'body', color, numberOfLines }: {
  readonly ctx: PartContext; readonly text: string; readonly testID?: string; readonly role?: 'body' | 'supporting'; readonly color?: string; readonly numberOfLines?: number;
}) {
  const [open, close] = QUOTE_MARKS[ctx.language];
  return (
    <Text numberOfLines={numberOfLines} style={{ ...typeStyle(role), color: color ?? ctx.palette.primary, writingDirection: ctx.writing }}>
      {open}<Text testID={testID}>{text}</Text>{close}
    </Text>
  );
}

/**
 * The mark of something NOT settled (E1: shape and ink, never a hue): a ring when it awaits the owner's confirmation; an
 * open ring when it is changed, older or in conflict and must be decided. Decorative — the words carry the meaning.
 */
export function OpenMark({ ctx, state }: { readonly ctx: PartContext; readonly state: 'TO_CONFIRM' | 'TO_DECIDE' }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID={`qandeel-introductions-mark-${state}`}
      style={{
        width: 11, height: 11, borderRadius: 5.5, borderWidth: 1.5,
        borderColor: state === 'TO_DECIDE' ? ctx.palette.primary : ctx.palette.secondary,
        borderTopColor: state === 'TO_DECIDE' ? 'transparent' : ctx.palette.secondary,
        transform: state === 'TO_DECIDE' ? [{ rotate: '-45deg' }] : undefined,
      }}
    />
  );
}

/**
 * One action, 44 points high at least. A secondary act is a full-width row (or, `inline`, one of an `ActionRow`) in the
 * rest ink. The `primary` act — at most one per step — is the one prominent control: on the sheet, an outlined shape on
 * the World; elsewhere, the Field.
 */
export function Action({ ctx, label, onPress, testID, primary = false, disabled = false, accessibilityLabel, inline = false, expanded }: {
  readonly ctx: PartContext; readonly label: string; readonly onPress: () => void; readonly testID: string;
  readonly primary?: boolean; readonly disabled?: boolean; readonly accessibilityLabel?: string; readonly inline?: boolean;
  /** A disclosure: whether what it opens is open. */
  readonly expanded?: boolean;
}) {
  const off = ctx.busy || disabled;
  const state = { busy: ctx.busy, disabled: off, ...(expanded === undefined ? {} : { expanded }) };
  if (primary && ctx.onSheet) {
    return (
      <Control
        palette={ctx.palette}
        language={ctx.language}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={state}
        onPress={off ? () => undefined : onPress}
        testID={testID}
        style={{ minHeight: PRIMARY_MIN_HEIGHT, paddingVertical: 12, paddingHorizontal: 18, marginStart: ROW_START, marginEnd: ROW_END, marginVertical: 8,
          borderRadius: PRIMARY_RADIUS, backgroundColor: ctx.palette.world, borderWidth: PRIMARY_OUTLINE, borderColor: ctx.palette.primary,
          opacity: off ? BUSY_OPACITY : 1 }}
      >
        {/* The label spans the button and is centred by its alignment, not shrink-wrapped: on Android a shrink-wrapped
            label can be measured narrower than it draws after a re-render, and its last word is clipped (seen at 320 dp). */}
        <Text style={{ ...typeStyle('action'), color: ctx.palette.primary, textAlign: 'center', alignSelf: 'stretch', writingDirection: ctx.writing }}>{label}</Text>
      </Control>
    );
  }
  if (inline) {
    return (
      <Control
        palette={ctx.palette}
        language={ctx.language}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={state}
        onPress={off ? () => undefined : onPress}
        testID={testID}
        style={{ minHeight: MIN_TARGET, paddingVertical: 10, paddingHorizontal: 8, opacity: off ? BUSY_OPACITY : 1 }}
      >
        <Text style={{ ...typeStyle('action'), color: ctx.palette.restInk, writingDirection: ctx.writing }}>{label}</Text>
      </Control>
    );
  }
  return (
    <Control
      palette={ctx.palette}
      language={ctx.language}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={state}
      onPress={off ? () => undefined : onPress}
      testID={testID}
      style={primary
        ? { minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: 16, paddingEnd: 16, marginStart: ROW_START - 8, marginEnd: ROW_END - 8, marginVertical: 6,
          borderRadius: 12, backgroundColor: ctx.palette.field, opacity: off ? BUSY_OPACITY : 1 }
        : { minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, opacity: off ? BUSY_OPACITY : 1 }}
    >
      <Text style={{ ...typeStyle('action'), color: primary ? ctx.palette.primary : ctx.palette.restInk, writingDirection: ctx.writing }}>{label}</Text>
    </Control>
  );
}

/** Secondary acts side by side, wrapping onto the next line on a narrow screen or with large text. */
export function ActionRow({ children }: { readonly children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, paddingStart: ROW_START - 8, paddingEnd: ROW_END - 8 }}>{children}</View>;
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
        backgroundColor: selected ? groundOf(ctx) : undefined, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', columnGap: 10,
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
          backgroundColor: groundOf(ctx),
          minHeight: multiline ? FIELD_MIN_HEIGHT * 2 : FIELD_MIN_HEIGHT,
          borderRadius: FIELD_RADIUS,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderWidth: ctx.palette.focusThickness,
          borderColor: focused ? ctx.palette.focusIndicator : ctx.onSheet ? ctx.palette.tertiary : ctx.palette.field,
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
