/**
 * A3-01 — the ordinary in-app Attention Strip (P3 §7, §16).
 *
 *   - A restrained ASIDE attached to the upper chrome, emerging from it: nonmodal, no scrim, no large floating card, the
 *     one functional Surface tone. It never covers the Analysis — the presentation law never shows it there.
 *   - Words carry importance, never colour: the same material for every category. No bounce, no pulse, no countdown,
 *     no progress indicator, no artificial urgency.
 *   - Its body is ONE control: the Direct Entry into the originating context, revalidated when pressed (D38). Its other
 *     act is dismiss. Dismissing resolves nothing.
 *   - The readable hold does not run out while a finger is on it, and never while a screen reader is running (focus
 *     cannot be hidden by a timer). It is announced ONCE, through one polite announcement — never the call's channel.
 *   - Reduced Motion: the same strip, acts and meaning, fading instead of moving.
 *
 * P3-A's appear / hold / dismiss durations are reference CRAFT, not Product law (P3 §7, §16).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Control, MIN_TARGET, typeStyle, usePalette, useReduceMotion } from '../conversation';
import { P3Glyph } from '../iconography';
import type { ChromeLanguage } from '../orientation-chrome';
import type { ActivityItem } from '../runtime-entry';
import { activityCopy } from './copy';

export const ATTENTION_STRIP_TEST_ID = 'qandeel-attention-strip';

/** P3-A reference craft. */
export const STRIP_TIMING = Object.freeze({ appearMs: 240, holdMs: 6000, leaveMs: 180, reducedAppearMs: 160, reducedLeaveMs: 140, travel: 10 });

export const pick = (text: { readonly ar: string | null; readonly en: string | null }, language: ChromeLanguage): string =>
  (language === 'ar' ? text.ar ?? text.en : text.en ?? text.ar) ?? '';

/** The source / context identity of an item, in approved words only. */
export function sourceOf(item: ActivityItem, language: ChromeLanguage): string {
  return item.context === null ? activityCopy(language).sources[item.category] : pick(item.context, language);
}

/** Whether a screen reader is running now, followed live. */
function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (mounted) setOn(value);
    });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return on;
}

export interface AttentionStripProps {
  readonly item: ActivityItem;
  readonly language: ChromeLanguage;
  /** Where the strip attaches: the lower edge of the surface's upper chrome. */
  readonly top: number;
  readonly insets: { readonly left: number; readonly right: number };
  /** The body was pressed: the Direct Entry, revalidated by the caller. */
  readonly onEnter: () => void;
  /** Dismissed, or its readable hold ended. */
  readonly onDismiss: () => void;
}

export function AttentionStrip({ item, language, top, insets, onEnter, onDismiss }: AttentionStripProps) {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  const screenReader = useScreenReader();
  const copy = activityCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const source = sourceOf(item, language);
  const sentence = pick(item.body, language);
  const [held, setHeld] = useState(false);
  const leaving = useRef(false);

  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withTiming(1, { duration: reduceMotion ? STRIP_TIMING.reducedAppearMs : STRIP_TIMING.appearMs, reduceMotion: ReduceMotion.Never }));
    // Announced once, when it appears.
    AccessibilityInfo.announceForAccessibility(`${copy.stripRegion}: ${source}. ${sentence}`);
    // The item changes only for a new strip, which is a new mount; the announcement must not repeat on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: reduceMotion ? 0 : -STRIP_TIMING.travel * (1 - shown.get()) }],
  }));

  const leave = useCallback((then: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    shown.set(withTiming(0, { duration: reduceMotion ? STRIP_TIMING.reducedLeaveMs : STRIP_TIMING.leaveMs, reduceMotion: ReduceMotion.Never }));
    setTimeout(then, reduceMotion ? STRIP_TIMING.reducedLeaveMs : STRIP_TIMING.leaveMs);
  }, [reduceMotion, shown]);

  // The readable hold: paused while a finger is on the strip; never a timer under a screen reader.
  useEffect(() => {
    if (held || screenReader) return undefined;
    const handle = setTimeout(() => leave(onDismiss), STRIP_TIMING.holdMs);
    return () => clearTimeout(handle);
  }, [held, leave, onDismiss, screenReader]);

  const glyph = item.category === 'INTRODUCTIONS' ? <P3Glyph name="link" color={palette.secondary} /> : null;
  return (
    <Animated.View
      testID={ATTENTION_STRIP_TEST_ID}
      accessibilityRole="summary"
      accessibilityLabel={copy.stripRegion}
      accessibilityLanguage={language}
      style={[{
        position: 'absolute', top: top + 2, left: insets.left + 10, right: insets.right + 10, zIndex: 3,
        borderRadius: 14, backgroundColor: palette.field, flexDirection: 'row', alignItems: 'center', direction: writing,
        paddingStart: 4, minHeight: MIN_TARGET + 8,
      }, style]}
    >
      <Pressable
        testID="qandeel-attention-strip-body"
        accessibilityRole="button"
        accessibilityLabel={`${source}${language === 'ar' ? '، ' : ', '}${sentence}`}
        accessibilityLanguage={language}
        onPress={() => leave(onEnter)}
        onPressIn={() => setHeld(true)}
        onPressOut={() => setHeld(false)}
        style={{ flex: 1, minHeight: MIN_TARGET, flexDirection: 'row', alignItems: 'center', columnGap: 10, paddingVertical: 8, paddingStart: 8 }}
      >
        {glyph}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ ...typeStyle('metadata'), color: palette.secondary, writingDirection: writing }}>
            {`${source} · ${copy.now}`}
          </Text>
          <Text numberOfLines={2} style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>
            {sentence}
          </Text>
        </View>
      </Pressable>
      {/* Dismiss: the approved words, as the act's visible label (no P2 close glyph is ported by A3-01). */}
      <Control
        palette={palette}
        language={language}
        accessibilityLabel={copy.stripDismiss}
        onPress={() => leave(onDismiss)}
        testID="qandeel-attention-strip-dismiss"
        style={{ minWidth: MIN_TARGET, minHeight: MIN_TARGET, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ ...typeStyle('metadata'), color: palette.restInk }}>{copy.stripDismiss}</Text>
      </Control>
    </Animated.View>
  );
}
