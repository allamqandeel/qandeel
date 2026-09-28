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
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  ANALYSIS_RETURN_BAR_MIN_HEIGHT,
  AnalysisReturnBar,
  ConversationSurface,
  DEPTH_CROSSFADE_MS,
  DEPTH_CROSSFADE_REDUCED_MOTION_MS,
} from '../../conversation';
import type { ResponsiveInsets } from '../../responsive';
import type { ProductLocale } from '../locale/product-locale';
import type { IntegrationSessionRuntime } from '../runtime/integration-runtime';
import { LivingAnalysisMap } from './LivingAnalysisMap';

export type WorldDepth = 'CONVERSATION' | 'ANALYSIS';

/** Where the reader lands in W1A-01, after sign-in and after every restart. Never persisted. */
export const LANDING_DEPTH: WorldDepth = 'CONVERSATION';

/**
 * The longest the fade into Analysis waits for the Analysis world to compose. The world draws only
 * once its room is measured and its projection is held; if that takes longer than this (a slow first
 * projection, or one refused), the fade runs anyway so the boundary never waits on the network.
 */
export const ANALYSIS_COMPOSE_WAIT_CEILING_MS = 1000;

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
  // Conversation on its first layout, and the Analysis world when the Map itself has composed — its
  // own first layout is an empty measuring pass, and fading that in was still a cut (found on the
  // W1A-01 proof emulator too), bounded by `ANALYSIS_COMPOSE_WAIT_CEILING_MS`.
  const pendingFade = useRef<number | null>(null);
  const composeCeiling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCeiling = useCallback(() => {
    if (composeCeiling.current !== null) clearTimeout(composeCeiling.current);
    composeCeiling.current = null;
  }, []);
  useEffect(() => clearCeiling, [clearCeiling]);
  const beginFade = useCallback(() => {
    clearCeiling();
    const duration = pendingFade.current;
    if (duration === null) return;
    pendingFade.current = null;
    // Symmetric and linear: an appearance change is not a meaning event, so it has no rise and no settle.
    incoming.set(withTiming(1, { duration, easing: Easing.linear }, (finished) => {
      'worklet';
      if (finished) scheduleOnRN(settle);
    }));
  }, [clearCeiling, incoming, settle]);

  const cross = useCallback(
    (to: WorldDepth) => {
      if (to === depth) return;
      setCrossed(true);
      clearCeiling();
      const duration = reduceMotion ? DEPTH_CROSSFADE_REDUCED_MOTION_MS : DEPTH_CROSSFADE_MS;
      if (duration <= 0) {
        // Reduced Motion: a cut. The new depth is simply there.
        pendingFade.current = null;
        incoming.set(1);
        setLeaving(null);
        setDepth(to);
        return;
      }
      // A depth that is still mounted (the reader turned back mid-fade) will not lay out again, so its
      // fade starts now; a newly mounted one starts on its first layout (see `beginFade`).
      const alreadyMounted = leaving === to;
      incoming.set(0);
      setLeaving(depth);
      setDepth(to);
      pendingFade.current = duration;
      if (alreadyMounted) beginFade();
      else if (to === 'ANALYSIS') composeCeiling.current = setTimeout(beginFade, ANALYSIS_COMPOSE_WAIT_CEILING_MS);
    },
    [beginFade, clearCeiling, depth, incoming, leaving, reduceMotion],
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
  return (
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
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  band: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
});
