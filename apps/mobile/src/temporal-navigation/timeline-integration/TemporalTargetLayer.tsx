/**
 * T-06 — the composed temporal surface: T-05's presentation, a dedicated temporal target strip, the
 * outboard Live target and the accessible routes, over one canonical store.
 *
 * ## Why the scrub is not on the Timeline itself
 *
 * Presentation movement and temporal traversal are different Product facts, and putting them on the
 * same pixels would make them the same gesture. So the disclosed Track above stays exactly what
 * T-05 built — it scrolls, it refines, it widens, and none of that changes `TC` — and temporal
 * targeting happens on its own strip below, aligned to the same invariant ordinal geometry. A
 * reader can move the window without going anywhere in time, and can go somewhere in time without
 * moving the window, and the two are told apart by where they touch as well as by what they hear.
 *
 * ## What is canonical here, and what is not
 *
 * The store is the only writer. The presentation controller, the preview controller and the motion
 * binding are three separate ephemeral things and none of them can reach canonical state: the first
 * has no dispatch at all, the second has no store, and the third has neither. The only routes from
 * this component to Product truth are the commit boundary and the composite temporal act, and both
 * are reached through this layer's own executors.
 *
 * The Map is deliberately absent. A committed temporal move invalidates the Map's projection, and
 * that handoff belongs to the Map's own freshness rule — which empties the surface rather than
 * keeping stale objects painted, hit-testable or announced. Nothing here bridges, cross-fades or
 * otherwise keeps the old projection alive while the new one is fetched.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import type { CanonicalStore } from '../../state';
import { TIMELINE_STEP, TimelinePresentation, type PresentationController } from '../../timeline';
import { TemporalNavigator } from '../accessibility';
import { useTemporalMotion } from '../motion';
import type { TemporalOutcome } from '../outcome';
import type { TemporalPreviewController } from '../preview/preview-state';
import { temporalTargeting } from '../targeting/disclosed-availability';
import { commitLiveEdgeIntent } from '../targeting/commit';
import { useTemporalScrub } from './useTemporalScrub';

export const TEMPORAL_TARGET_LAYER_TEST_ID = 'qandeel-temporal-target-layer';
export const TEMPORAL_TARGET_STRIP_TEST_ID = 'qandeel-temporal-target-strip';
export const TEMPORAL_COMMITTED_MARKER_TEST_ID = 'qandeel-temporal-committed-marker';
export const TEMPORAL_PREVIEW_MARKER_TEST_ID = 'qandeel-temporal-preview-marker';
export const TEMPORAL_LIVE_EDGE_TEST_ID = 'qandeel-temporal-live-edge';

/** Minimum touch target. The strip is the temporal surface, never a presentation control. */
const STRIP_HEIGHT = 44;
const MARKER_WIDTH = 2;

export interface LiveEdgeTargetProps {
  readonly store: CanonicalStore;
  readonly preview: TemporalPreviewController;
  readonly following: boolean;
  readonly available: boolean;
  readonly onOutcome?: (outcome: TemporalOutcome) => void;
}

/**
 * The outboard Live target. It is NOT a Moment and it is never appended to the disclosed Track:
 * `Moment(LH)` and the Live Edge are different Product facts, and only this control produces
 * `FOLLOW_LIVE`. Its label states the mode, so `PINNED(LH)` and `FOLLOW_LIVE` remain distinguishable
 * with motion off, with reduced motion on and to a screen reader.
 */
export function LiveEdgeTarget({ store, preview, following, available, onOutcome }: LiveEdgeTargetProps) {
  const onPress = useCallback(() => {
    const outcome = commitLiveEdgeIntent(store, preview);
    onOutcome?.(outcome);
  }, [store, preview, onOutcome]);

  return (
    <Pressable
      testID={TEMPORAL_LIVE_EDGE_TEST_ID}
      style={styles.liveEdge}
      accessibilityRole="button"
      accessibilityLabel={following ? 'Live edge, currently following' : 'Live edge, not currently following'}
      accessibilityState={{ disabled: !available, selected: following }}
      disabled={!available}
      onPress={onPress}
    >
      <Text>{following ? 'Live' : 'Go live'}</Text>
    </Pressable>
  );
}

export interface TemporalTargetLayerProps {
  readonly store: CanonicalStore;
  readonly preview: TemporalPreviewController;
  /** T-05's presentation controller. This layer reads it and never writes it. */
  readonly presentation: PresentationController;
  readonly enabled?: boolean;
  readonly onOutcome?: (outcome: TemporalOutcome) => void;
}

export function TemporalTargetLayer({ store, preview, presentation, enabled = true, onOutcome }: TemporalTargetLayerProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const previewState = useSyncExternalStore(preview.subscribe, preview.getSnapshot);
  const window = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot);

  // Canonical bounds and disclosed availability together: the layer never hands a route one
  // without the other, so no surface here can target a Moment nothing has disclosed.
  const targeting = useMemo(() => temporalTargeting(state, window.track), [state, window.track]);
  const bounds = targeting.bounds;

  // A replaced Session takes its preview with it, and so does a target that is no longer disclosed.
  // Nothing is carried across and no Product navigation is invented in its place; the
  // reconciliation writes no canonical field.
  useEffect(() => {
    preview.reconcile(targeting);
  }, [preview, targeting]);

  const motion = useTemporalMotion(
    {
      committedSp: bounds.committedTc,
      previewSp: previewState.status === 'PREVIEWING' ? previewState.ptc : null,
      mode: bounds.mode,
      // The finger is observed on the UI runtime, by the binding's own `tracking` shared value, so
      // the JS-runtime plan never claims to know whether one is down.
      dragging: false,
    },
    { stepWidth: TIMELINE_STEP, windowOffset: window.offset },
  );

  const snapshot = useCallback(() => presentation.getSnapshot(), [presentation]);
  const { gesture } = useTemporalScrub({
    store,
    preview,
    snapshot,
    geometry: { viewport: window.viewport, windowOffset: window.offset, rtl: I18nManager.isRTL },
    enabled,
    fingerX: motion.fingerX,
    tracking: motion.tracking,
    onCommitted: motion.acknowledgeCommit,
    onCancelled: motion.acknowledgeCancel,
    onOutcome,
  });

  const liveEdge = (
    <LiveEdgeTarget
      store={store}
      preview={preview}
      following={motion.plan.temporalStance === 'FOLLOWING_LIVE'}
      available={bounds.liveHead !== null}
      onOutcome={onOutcome}
    />
  );

  return (
    <View testID={TEMPORAL_TARGET_LAYER_TEST_ID} style={styles.layer}>
      <TimelinePresentation controller={presentation} outboardLivePresentation={liveEdge} />

      <GestureDetector gesture={gesture}>
        <View
          testID={TEMPORAL_TARGET_STRIP_TEST_ID}
          style={styles.strip}
          // The strip is the temporal surface. Its own semantics are supplied by the navigator
          // below, which is the non-drag route to everything reachable here.
          accessible={false}
        >
          <Animated.View
            testID={TEMPORAL_COMMITTED_MARKER_TEST_ID}
            pointerEvents="none"
            style={[styles.marker, styles.committedMarker, motion.committedStyle]}
          />
          <Animated.View
            testID={TEMPORAL_PREVIEW_MARKER_TEST_ID}
            pointerEvents="none"
            style={[styles.marker, styles.previewMarker, motion.cursorStyle]}
          />
          <Animated.View testID={`${TEMPORAL_TARGET_STRIP_TEST_ID}:settle`} pointerEvents="none" style={[styles.settle, motion.settleStyle]} />
        </View>
      </GestureDetector>

      <TemporalNavigator
        store={store}
        preview={preview}
        track={window.track}
        onOutcome={onOutcome}
        onCommitted={motion.acknowledgeCommit}
        onCancelled={motion.acknowledgeCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { flexDirection: 'column' },
  strip: { height: STRIP_HEIGHT },
  marker: { position: 'absolute', top: 0, width: MARKER_WIDTH, height: STRIP_HEIGHT },
  committedMarker: { borderLeftWidth: MARKER_WIDTH },
  previewMarker: { borderLeftWidth: MARKER_WIDTH, borderStyle: 'dashed' },
  settle: { position: 'absolute', left: 0, right: 0, top: 0, height: STRIP_HEIGHT },
  liveEdge: { minHeight: 44, justifyContent: 'center' },
});
