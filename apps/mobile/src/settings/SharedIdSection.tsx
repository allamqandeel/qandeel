/**
 * S4-01 (E2E-D-08) — the Shared ID inside General Settings → Account & Identity (P1 §5.1, §8.1; W3-PDG-01 §4).
 *
 *   SharedIdRow   the term only. It opens the page; nothing is read before the reader asks for it, so an account that
 *                 never reaches Shared gains no Connected Worlds reference (S4-01 §1.1, §14).
 *   SharedIdPage  the reader's current Shared ID (provisioned by the server on this first read while Shared is open),
 *                 Copy, the privacy explanation and Regenerate — behind a clear confirmation that says what stops
 *                 working and what does not. No password is asked, no internal detail is shown, and after regeneration
 *                 the old value is never shown again (W3-PDG-01 §4).
 *
 * Every word comes from the Shared copy module. A Shared ID is Latin content: it is drawn as one isolated
 * left-to-right run in any paragraph.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Text, View, findNodeHandle } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { isolatedSharedId, sharedCopy, type SharedIdController } from '../shared-world';

const ROW_START = 24;
const ROW_END = 20;
const BUSY_OPACITY = 0.6;

const writingOf = (language: ChromeLanguage) => (language === 'ar' ? 'rtl' : 'ltr');

export function SharedIdRow({ language, palette, onOpen, rowRef }: {
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly onOpen: () => void;
  readonly rowRef?: (node: View | null) => void;
}) {
  const copy = sharedCopy(language);
  return (
    <Control palette={palette} language={language} accessibilityLabel={copy.yourSharedId} onPress={onOpen} testID="qandeel-shared-id-row" controlRef={rowRef}
      style={{ minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, justifyContent: 'center' }}>
      <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writingOf(language) }}>{copy.yourSharedId}</Text>
    </Control>
  );
}

export function SharedIdPage({ controller, language, palette, busyChanged }: {
  readonly controller: SharedIdController;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly busyChanged: (busy: boolean) => void;
}) {
  const copy = sharedCopy(language);
  const writing = writingOf(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    controller.start();
  }, [controller]);

  const titleRef = useRef<Text | null>(null);
  useEffect(() => {
    const node = titleRef.current === null ? null : findNodeHandle(titleRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);
  const say = useCallback((text: string) => {
    setMessage(text);
    AccessibilityInfo.announceForAccessibility(text);
  }, []);

  const copyValue = useCallback(async () => {
    if (state.sharedId === null) return;
    await Clipboard.setStringAsync(state.sharedId);
    say(copy.copied);
  }, [copy.copied, say, state.sharedId]);

  const regenerate = useCallback(async () => {
    busyChanged(true);
    setMessage(null);
    const replaced = await controller.regenerate();
    busyChanged(false);
    setConfirming(false);
    if (!replaced) say(copy.actionUnavailable);
  }, [busyChanged, controller, copy.actionUnavailable, say]);

  const body = (() => {
    if (state.status === 'NOT_OPEN') {
      return <Text testID="qandeel-shared-id-not-open" style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{copy.sharedIdNotOpen}</Text>;
    }
    if (state.status === 'UNAVAILABLE') {
      return (
        <View style={{ rowGap: 8 }}>
          <Text testID="qandeel-shared-id-unavailable" style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{copy.actionUnavailable}</Text>
          <Control palette={palette} language={language} accessibilityLabel={copy.retry} onPress={() => controller.start()} testID="qandeel-shared-id-retry"
            style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, justifyContent: 'center' }}>
            <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.retry}</Text>
          </Control>
        </View>
      );
    }
    if (state.status !== 'READY' || state.sharedId === null) {
      return <View testID="qandeel-shared-id-loading" accessibilityState={{ busy: true }} style={{ minHeight: MIN_TARGET }} />;
    }
    const value = state.sharedId;
    return (
      <View style={{ rowGap: 14 }}>
        <View accessible accessibilityLabel={[copy.yourSharedId, value.split('').join(' ')].join(', ')} accessibilityLanguage={language}>
          <Text testID="qandeel-shared-id-value" selectable style={{ ...typeStyle('statement'), color: palette.primary, writingDirection: writing }}>
            {isolatedSharedId(value)}
          </Text>
        </View>
        <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{copy.sharedIdPrivacy}</Text>
        {confirming ? (
          <View testID="qandeel-shared-id-confirm" style={{ rowGap: 10 }}>
            <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{copy.regenerateWarning}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: 12, rowGap: 10 }}>
              <Control palette={palette} language={language} accessibilityLabel={copy.cancel} accessibilityState={{ disabled: state.regenerating }}
                onPress={() => { if (!state.regenerating) setConfirming(false); }} testID="qandeel-shared-id-keep" style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.cancel}</Text>
              </Control>
              <Control palette={palette} language={language} accessibilityLabel={copy.regenerateConfirm} accessibilityState={{ busy: state.regenerating, disabled: state.regenerating }}
                onPress={() => void regenerate()} testID="qandeel-shared-id-regenerate-confirm"
                style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: palette.field, opacity: state.regenerating ? BUSY_OPACITY : 1 }}>
                <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.regenerateConfirm}</Text>
              </Control>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 10 }}>
            <Control palette={palette} language={language} accessibilityLabel={copy.copy} onPress={() => void copyValue()} testID="qandeel-shared-id-copy"
              style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: palette.field }}>
              <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.copy}</Text>
            </Control>
            <Control palette={palette} language={language} accessibilityLabel={copy.regenerate} onPress={() => setConfirming(true)} testID="qandeel-shared-id-regenerate"
              style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.regenerate}</Text>
            </Control>
          </View>
        )}
      </View>
    );
  })();

  return (
    <View testID="qandeel-shared-id-page" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 18, rowGap: 14 }}>
      <Text ref={titleRef} accessibilityRole="header" accessibilityLanguage={language} style={{ ...typeStyle('statement'), color: palette.primary, writingDirection: writing }}>
        {copy.yourSharedId}
      </Text>
      {body}
      <View testID="qandeel-shared-id-message" accessibilityLiveRegion="polite">
        {message === null ? null : <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{message}</Text>}
      </View>
    </View>
  );
}
