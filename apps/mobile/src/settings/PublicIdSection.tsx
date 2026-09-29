/**
 * W3-02 (E2E-D-09) — the Public ID inside General Settings → Account & Identity (P1 §6, §8.1).
 *
 *   PublicIdRow           the term, the reader's current handle and the allowance: «متاح تغيير يدوي واحد» /
 *                         One manual change available, or «استُخدم التغيير اليدوي الوحيد» / Your one manual
 *                         change has been used. While the change is available the row opens the change; once
 *                         it is used the row stays readable and offers nothing to press.
 *   PublicIdChangeSurface the ONE change, inside the same Settings destination (no route, no dialog, no new
 *                         world): the warning title and body BEFORE anything can be committed, the Current
 *                         value, the New value, «الإبقاء على المعرّف الحالي» / Keep current ID and
 *                         «تأكيد التغيير» / Confirm change.
 *
 * Every word comes from `copy.ts`. A handle is Latin content: it is always drawn as an isolated left-to-right
 * run (so the `@` stays on its left in an Arabic line), and the field and everything in its row share one
 * explicit left-to-right direction context. Nothing here decides whether the change happened: the controller
 * reports what the server said, or what a fresh read of the canonical state shows.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text, TextInput, View, findNodeHandle } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { PublicIdCopy } from './copy';
import { publicIdHandle } from './public-id';
import type { PublicIdController, PublicIdState } from './public-id-controller';

const ROW_START = 24;
const ROW_END = 20;
/** The same dimming every busy act uses (W1B-01, W3-01), so "in flight" reads the same everywhere. */
const BUSY_OPACITY = 0.6;
const FIELD_MIN_HEIGHT = 48;
const FIELD_RADIUS = 12;

/** LEFT-TO-RIGHT ISOLATE … POP DIRECTIONAL ISOLATE: the handle is one Latin run in any paragraph. */
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);
export const isolatedHandle = (publicId: string): string => `${LRI}${publicIdHandle(publicId)}${PDI}`;

const writingOf = (language: ChromeLanguage) => (language === 'ar' ? 'rtl' : 'ltr');

export function PublicIdRow({ state, copy, language, palette, onOpen, rowRef }: {
  readonly state: PublicIdState & { readonly publicId: string };
  readonly copy: PublicIdCopy;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly onOpen: () => void;
  readonly rowRef?: (node: View | null) => void;
}) {
  const writing = writingOf(language);
  const allowance = state.changeAvailable ? copy.available : copy.used;
  // Enough to tell the three facts apart by ear: what it is, which handle, and whether the one change remains.
  const label = [copy.term, publicIdHandle(state.publicId), allowance].join(', ');
  const content = (
    <View style={{ rowGap: 2 }}>
      <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{copy.term}</Text>
      <Text testID="qandeel-public-id-value" style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>
        {isolatedHandle(state.publicId)}
      </Text>
      <Text testID="qandeel-public-id-allowance" style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>
        {allowance}
      </Text>
    </View>
  );
  const frame = { minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0 } as const;
  if (!state.changeAvailable) {
    // Used: still readable as one element, and nothing to press — there is no second change.
    return (
      <View ref={rowRef} testID="qandeel-public-id-row" accessible accessibilityLabel={label} accessibilityLanguage={language} style={{ ...frame, justifyContent: 'center' }}>
        {content}
      </View>
    );
  }
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={label}
      onPress={onOpen}
      testID="qandeel-public-id-row"
      controlRef={rowRef}
      style={frame}
    >
      {content}
    </Control>
  );
}

export function PublicIdChangeSurface({ controller, currentPublicId, copy, language, palette, onFinished, busyChanged }: {
  readonly controller: PublicIdController;
  readonly currentPublicId: string;
  readonly copy: PublicIdCopy;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  /** Leave the change: `settled` when the change is over, otherwise the reader kept the current ID. */
  readonly onFinished: (settled: boolean) => void;
  /** Tells the Settings frame when a commit is in flight, so Back cannot abandon it half-way. */
  readonly busyChanged: (busy: boolean) => void;
}) {
  const writing = writingOf(language);
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldFocused, setFieldFocused] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  // The warning is the first thing the screen reader reaches, before anything can be committed.
  const titleRef = useRef<Text | null>(null);
  useEffect(() => {
    const node = titleRef.current === null ? null : findNodeHandle(titleRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);

  const say = useCallback((text: string) => {
    setMessage(text);
    AccessibilityInfo.announceForAccessibility(text);
  }, []);

  const commitChange = useCallback(async () => {
    // One commit: the ref refuses a second press in the same frame, before the busy state has rendered.
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    busyChanged(true);
    setMessage(null);
    const result = await controller.commit(value);
    busyRef.current = false;
    busyChanged(false);
    if (!mounted.current) return;
    setBusy(false);
    switch (result) {
      case 'DONE':
        return onFinished(true);
      case 'UNCHANGED':
        return onFinished(false);
      case 'INVALID':
        return say(copy.invalid);
      case 'UNAVAILABLE':
        return say(copy.unavailable);
      case 'RETRY':
        return say(copy.network);
      case null:
        return undefined;
    }
  }, [busyChanged, controller, copy, onFinished, say, value]);

  const keep = useCallback(() => {
    if (busyRef.current) return;
    onFinished(false);
  }, [onFinished]);

  return (
    <View testID="qandeel-public-id-change" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 18, rowGap: 14 }}>
      <Text
        ref={titleRef}
        testID="qandeel-public-id-change-title"
        accessibilityRole="header"
        accessibilityLanguage={language}
        style={{ ...typeStyle('statement'), color: palette.primary, writingDirection: writing }}
      >
        {copy.title}
      </Text>
      <Text testID="qandeel-public-id-change-body" style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>
        {copy.body}
      </Text>

      <View accessible accessibilityLabel={[copy.current, publicIdHandle(currentPublicId)].join(', ')} accessibilityLanguage={language} style={{ rowGap: 2 }}>
        <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{copy.current}</Text>
        <Text testID="qandeel-public-id-change-current" style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>
          {isolatedHandle(currentPublicId)}
        </Text>
      </View>

      <View style={{ rowGap: 6 }}>
        <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{copy.next}</Text>
        {/* One explicit left-to-right context for the field: a handle is typed left to right in any language. */}
        <View style={{ direction: 'ltr' }}>
          <TextInput
            testID="qandeel-public-id-change-input"
            value={value}
            onChangeText={(text) => {
              setValue(text);
              if (message !== null) setMessage(null);
            }}
            editable={!busy}
            accessibilityLabel={copy.next}
            accessibilityLanguage={language}
            accessibilityState={{ disabled: busy }}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            importantForAutofill="no"
            keyboardType="ascii-capable"
            maxLength={64}
            returnKeyType="done"
            onSubmitEditing={() => void commitChange()}
            onFocus={() => setFieldFocused(true)}
            onBlur={() => setFieldFocused(false)}
            selectionColor={palette.primary}
            cursorColor={palette.primary}
            style={{
              ...typeStyle('body'),
              color: palette.primary,
              backgroundColor: palette.field,
              minHeight: FIELD_MIN_HEIGHT,
              borderRadius: FIELD_RADIUS,
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderWidth: palette.focusThickness,
              // The F1 focus indicator while the field has focus; the field's own colour otherwise.
              borderColor: fieldFocused ? palette.focusIndicator : palette.field,
              textAlign: 'left',
              writingDirection: 'ltr',
            }}
          />
        </View>
        {/* One polite region, always mounted, so a message can be announced. Words, never a colour alone. */}
        <View testID="qandeel-public-id-change-message" accessibilityLiveRegion="polite">
          {message === null ? null : (
            <Text style={{ ...typeStyle('supporting'), color: palette.error, writingDirection: writing }}>{message}</Text>
          )}
        </View>
      </View>

      <View testID="qandeel-public-id-actions" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: 12, rowGap: 10 }}>
        <Control
          palette={palette}
          language={language}
          accessibilityLabel={copy.keep}
          accessibilityState={{ disabled: busy }}
          onPress={keep}
          testID="qandeel-public-id-keep"
          style={{ paddingHorizontal: 16, paddingVertical: 10, opacity: busy ? BUSY_OPACITY : 1 }}
        >
          <Text style={{ ...typeStyle('action'), color: palette.restInk, textAlign: 'center', writingDirection: writing }}>{copy.keep}</Text>
        </Control>
        <Control
          palette={palette}
          language={language}
          accessibilityLabel={copy.confirm}
          accessibilityState={{ busy, disabled: busy }}
          onPress={() => void commitChange()}
          testID="qandeel-public-id-confirm"
          style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: palette.field, opacity: busy ? BUSY_OPACITY : 1 }}
        >
          <Text style={{ ...typeStyle('action'), color: palette.primary, textAlign: 'center', writingDirection: writing }}>{copy.confirm}</Text>
        </Control>
      </View>
    </View>
  );
}
