/**
 * W1A-01 (E2E-B-07) — the ONE depth pair of the reader's own world: Conversation ↔ Analysis.
 *
 * > **Integration connects owners. Integration does not replace owners.**
 *
 * Both depths are the SAME Session and the SAME runtime generation: the Conversation is the W1A-01
 * owner's surface over `runtime.conversation`, and the Analysis is the existing Living Analysis Map
 * composition, unchanged, over the same store, projection cache and live driver. Switching depth is
 * a local presentation choice — it dispatches nothing, writes no canonical state, pushes no route,
 * creates no Session and persists nothing (the T-13 recovery record is untouched, so after sign-in
 * or restart the reader lands in the Conversation, as the Product Owner approved for W1A-01).
 *
 * The boundary behaves as the G3 closure froze it: F2's symmetric appearance cross-fade in standard
 * motion, and under Reduced Motion no cross-fade — the same truth with no movement. The outgoing
 * depth stays opaque beneath while the incoming one resolves over it, so no third colour ever shows
 * through the fade. Only the incoming depth is interactive or exposed to assistive technology.
 *
 * Android's system Back is the same act as the Analysis band's «المحادثة» / Conversation control: at
 * the Analysis depth it returns to the Conversation through the same boundary, and it pushes and pops
 * nothing. At the Conversation depth this owner does not listen for Back at all, so the platform's own
 * root behaviour is untouched.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedStyle, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  ANALYSIS_RETURN_BAR_MIN_HEIGHT,
  AnalysisReturnBar,
  ConversationSurface,
  DEPTH_CROSSFADE_MS,
  DEPTH_CROSSFADE_REDUCED_MOTION_MS,
} from '../../conversation';
import { ConversationOpening, FirstUseGate } from '../../account';
import type { ResponsiveInsets } from '../../responsive';
import type { ProductLocale } from '../locale/product-locale';
import type { IntegrationSessionRuntime } from '../runtime/integration-runtime';
import { LivingAnalysisMap } from './LivingAnalysisMap';

export type WorldDepth = 'CONVERSATION' | 'ANALYSIS';

/** Where the reader lands in W1A-01, after sign-in and after every restart. Never persisted. */
export const LANDING_DEPTH: WorldDepth = 'CONVERSATION';

/** One frame at 60 Hz: the most a single rendered frame may advance the cross-fade. */
export const NOMINAL_FRAME_MS = 1000 / 60;

/**
 * One rendered frame's advance of the cross-fade: linear, and never more than one nominal frame.
 *
 * At a steady frame rate this IS F2's 200 ms linear fade (60 Hz: 12 frames; 120 Hz: 24). But a
 * time-based fade is only a claim about the clock, and the W1A-01 proof emulator showed the clock
 * winning: mounting the Analysis world (Skia map, Timeline, chrome) stalls the UI thread for ~265 ms,
 * the whole 200 ms elapsed inside the stall, and the first frame drawn was already at full opacity — a
 * cut. Pacing by rendered frames makes the fade stretch across a stall instead of being skipped by it,
 * so the reader always sees its intermediate frames.
 */
export function fadeStep(current: number, sinceLastFrameMs: number | null, durationMs: number): number {
  'worklet';
  const advance = Math.min(sinceLastFrameMs ?? NOMINAL_FRAME_MS, NOMINAL_FRAME_MS);
  const next = current + advance / durationMs;
  // Twelve sixtieths of a second are 200 ms; floating point must not turn them into thirteen frames.
  return next >= 1 - 1e-9 ? 1 : next;
}

export interface DepthCompositionProps {
  readonly runtime: IntegrationSessionRuntime;
  readonly locale: ProductLocale;
  readonly insets: ResponsiveInsets;
  readonly fontScale: number;
  readonly envelope: { readonly width: number; readonly height: number };
}

export function DepthComposition({ runtime, locale, insets, fontScale, envelope }: DepthCompositionProps) {
  // The safe-area edges as numbers: T-11's inset type allows an absent edge, which is zero.
  const edges = useMemo(
    () => ({ top: insets.top ?? 0, right: insets.right ?? 0, bottom: insets.bottom ?? 0, left: insets.left ?? 0 }),
    [insets.top, insets.right, insets.bottom, insets.left],
  );
  const [depth, setDepth] = useState<WorldDepth>(LANDING_DEPTH);
  const [leaving, setLeaving] = useState<WorldDepth | null>(null);
  // Focus follows the reader across the boundary only when THEY crossed it, never on first arrival.
  const [crossed, setCrossed] = useState(false);
  const [bandHeight, setBandHeight] = useState(edges.top + ANALYSIS_RETURN_BAR_MIN_HEIGHT);
  const reduceMotion = useReducedMotion();
  const incoming = useSharedValue(1);
  const incomingStyle = useAnimatedStyle(() => ({ opacity: incoming.get() }));

  const settle = useCallback(() => setLeaving(null), []);

  // The incoming depth is mounted by the switch itself, and mounting it (the whole Analysis world, or
  // the Conversation's history) can take longer than the fade. Started at the press, the fade's clock
  // would run out before the incoming depth's first frame, and the reader would see a cut (found on the
  // W1A-01 proof emulator). So the fade starts only once the incoming depth is actually drawn: the
  // Conversation on its first layout, and the Analysis world when `LivingAnalysisMap` reports its real
  // first state — its own first layout is an empty measuring pass, and fading that in was still a cut
  // (found on the W1A-01 proof emulator too). There is no timeout that could start the fade earlier:
  // until the Analysis is drawn, the Conversation stays visible beneath it, and Back still returns.
  const pendingFade = useRef<number | null>(null);
  // The running fade's duration; zero when no fade is running. Read on the UI runtime per frame.
  const fading = useSharedValue(0);
  // Symmetric and linear: an appearance change is not a meaning event, so it has no rise and no settle.
  // Paced by rendered frames (see `fadeStep`), so a stalled UI thread stretches it and never skips it.
  const fadeFrames = useFrameCallback((frame) => {
    'worklet';
    const duration = fading.get();
    if (duration <= 0) return;
    const next = fadeStep(incoming.get(), frame.timeSincePreviousFrame, duration);
    incoming.set(next);
    if (next >= 1) {
      fading.set(0);
      scheduleOnRN(settle);
    }
  }, false);
  // Frames are only watched while a fade runs.
  useEffect(() => {
    if (leaving === null) fadeFrames.setActive(false);
  }, [fadeFrames, leaving]);
  const beginFade = useCallback(() => {
    const duration = pendingFade.current;
    if (duration === null) return;
    pendingFade.current = null;
    fading.set(duration);
    fadeFrames.setActive(true);
  }, [fadeFrames, fading]);

  const cross = useCallback(
    (to: WorldDepth) => {
      if (to === depth) return;
      setCrossed(true);
      const duration = reduceMotion ? DEPTH_CROSSFADE_REDUCED_MOTION_MS : DEPTH_CROSSFADE_MS;
      // A fade still running toward the other depth stops here; its frames are not reused.
      fading.set(0);
      if (duration <= 0) {
        // Reduced Motion: a cut. The new depth is simply there.
        pendingFade.current = null;
        incoming.set(1);
        setLeaving(null);
        setDepth(to);
        return;
      }
      // A Conversation that is still mounted (the reader turned back mid-fade) is drawn and will not lay
      // out again, so its fade starts now. The Analysis never starts here: turning back to it re-arms
      // its composition report, which fires only once it is actually drawn (see `beginFade`).
      const conversationStillMounted = to === 'CONVERSATION' && leaving === to;
      incoming.set(0);
      setLeaving(depth);
      setDepth(to);
      pendingFade.current = duration;
      if (conversationStillMounted) beginFade();
    },
    [beginFade, depth, fading, incoming, leaving, reduceMotion],
  );

  // Android system Back at the Analysis depth is the return to the Conversation. Registered only
  // while Analysis is the depth, so at the Conversation Back reaches the platform exactly as before.
  useEffect(() => {
    if (depth !== 'ANALYSIS') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      cross('CONVERSATION');
      return true;
    });
    return () => subscription.remove();
  }, [cross, depth]);

  const analysisInsets = useMemo(() => ({ ...edges, top: bandHeight }), [edges, bandHeight]);

  const layer = (which: WorldDepth, current: boolean): ReactNode =>
    which === 'CONVERSATION' ? (
      <ConversationSurface
        controller={runtime.conversation}
        language={locale.language}
        insets={edges}
        onOpenAnalysis={() => cross('ANALYSIS')}
        focusDepthControl={crossed && current}
        opening={<ConversationOpening account={runtime.account} language={locale.language} />}
      />
    ) : (
      <View style={styles.fill}>
        {/*
          The band comes FIRST, so it is read first, and it is drawn above the world. The world treats
          it exactly as it treats the status bar: the band's measured height is the world's top inset,
          so T-11 keeps everything the reader must see out from under it.
        */}
        <View style={styles.band}>
          <AnalysisReturnBar
            language={locale.language}
            insets={edges}
            onReturnToConversation={() => cross('CONVERSATION')}
            onHeight={setBandHeight}
            focusControl={crossed && current}
          />
        </View>
        <LivingAnalysisMap
          runtime={runtime}
          locale={locale}
          insets={analysisInsets}
          fontScale={fontScale}
          envelope={envelope}
          onComposed={current ? beginFade : undefined}
        />
      </View>
    );

  const stack: WorldDepth[] = leaving === null ? [depth] : [leaving, depth];
  // W1B-01: the account's first use stands before the world — the wait for the account, then the one-time
  // Welcome when it is owed. The depth pair itself is unchanged.
  return (
    <FirstUseGate account={runtime.account} language={locale.language} insets={edges}>
      <View style={styles.fill} testID="qandeel-world-depth">
        {/*
          G3 K18 — status-region legibility against the ground actually painted behind it. Both depths
          stand on the Dark World (P1's default for the Conversation; the Analysis shell is dark), so the
          platform status content is light while this world is composed, whatever the system appearance.
        */}
        <StatusBar style="light" />
        {stack.map((which) => {
          const current = which === depth;
          return (
            <Animated.View
              key={which}
              testID={`qandeel-depth-${which.toLowerCase()}`}
              style={[StyleSheet.absoluteFill, current && leaving !== null ? incomingStyle : null]}
              // The Analysis world reports its own composition instead (see `beginFade`).
              onLayout={current && leaving !== null && which === 'CONVERSATION' ? beginFade : undefined}
              pointerEvents={current ? 'auto' : 'none'}
              importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
              accessibilityElementsHidden={!current}
            >
              {layer(which, current)}
            </Animated.View>
          );
        })}
      </View>
    </FirstUseGate>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  band: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
});
