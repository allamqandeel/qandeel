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
 * ## Where the strip is, physically (FCR-03)
 *
 * The strip is sized to T-05's own Timeline viewport and aligned to the row's START edge, so it sits
 * exactly under the Track in both writing directions: flush left in LTR, flush right in RTL, with
 * T-05's discontinuity and outboard Live slot beside it rather than beneath it. The outboard Live
 * region is therefore never Moment-targeting space — a touch there does not reach the strip at all,
 * in either direction — and the strip's own local coordinates ARE the viewport's physical
 * coordinates, which is what lets the pointer side and the motion side share one geometry. The
 * markers are anchored at the strip's logical start (`start: 0`), so the same translateX rule
 * places them in LTR and its exact reflection places them in RTL.
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

import { analysisCopy, type AnalysisLanguage } from '../../analysis-language';
import { useAnalysisInk, useAnalysisType } from '../../analysis-visual';
import { Aperture, LiveTerminal, SpineLayer, spinePresentation } from '../../iconography';
import type { CanonicalStore } from '../../state';
import { TIMELINE_STEP, TimelinePresentation, type PresentationController } from '../../timeline';
import { TemporalNavigator } from '../accessibility';
import { useTemporalMotion, type TemporalMarkerGeometry } from '../motion';
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
/** VPORT-02: the Temporal Spine (P2 C) on the strip, and the Live terminal where disclosed time ends. */
export const TEMPORAL_SPINE_TEST_ID = 'qandeel-temporal-spine';
export const TEMPORAL_LIVE_TERMINAL_TEST_ID = 'qandeel-temporal-live-terminal';

/** Minimum touch target. The strip is the temporal surface, never a presentation control. */
const STRIP_HEIGHT = 44;
/**
 * The markers sit inside the strip's clip with room to breathe: the commit acknowledgement grows
 * the committed marker by `COMMIT_SETTLE_SCALE` about its centre, and a marker that filled the
 * strip would grow straight into the clipped region and acknowledge nothing (FCR-MOTION-02).
 */
const MARKER_INSET = 2;
const MARKER_HEIGHT = STRIP_HEIGHT - 2 * MARKER_INSET;

export interface LiveEdgeTargetProps {
  readonly store: CanonicalStore;
  readonly preview: TemporalPreviewController;
  readonly following: boolean;
  readonly available: boolean;
  readonly onOutcome?: (outcome: TemporalOutcome) => void;
  readonly language?: AnalysisLanguage;
}

/**
 * The outboard Live target. It is NOT a Moment and it is never appended to the disclosed Track:
 * `Moment(LH)` and the Live Edge are different Product facts, and only this control produces
 * `FOLLOW_LIVE`. Its label states the mode, so `PINNED(LH)` and `FOLLOW_LIVE` remain distinguishable
 * with motion off, with reduced motion on and to a screen reader. Its words are the Product Owner's
 * current-edge wording («تتابع المحادثة الآن» / «العودة لمتابعة المحادثة»); "Live" is never said.
 */
export function LiveEdgeTarget({ store, preview, following, available, onOutcome, language = 'en' }: LiveEdgeTargetProps) {
  const copy = analysisCopy(language);
  const ink = useAnalysisInk();
  const type = useAnalysisType();
  const words = following ? copy.followingConversation : copy.rejoinConversation;
  // VPORT-02: the words in the Analysis ink, on the Analysis ground. Following Live is a state, so it reads in the
  // secondary ink; rejoining is the act, so it reads in the primary; with no Live Head there is nothing to rejoin.
  const wordInk = !available ? ink.tertiary : following ? ink.secondary : ink.primary;
  const onPress = useCallback(() => {
    const outcome = commitLiveEdgeIntent(store, preview);
    onOutcome?.(outcome);
  }, [store, preview, onOutcome]);

  return (
    <Pressable
      testID={TEMPORAL_LIVE_EDGE_TEST_ID}
      style={styles.liveEdge}
      accessibilityRole="button"
      accessibilityLabel={words}
      accessibilityLanguage={language}
      accessibilityState={{ disabled: !available, selected: following }}
      disabled={!available}
      onPress={onPress}
    >
      <Text style={[type('action'), { color: wordInk }]}>{words}</Text>
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
  /** The reader's Product language for every word of this layer and its Timeline (W1A-01). */
  readonly language?: AnalysisLanguage;
}

export function TemporalTargetLayer({ store, preview, presentation, enabled = true, onOutcome, language = 'en' }: TemporalTargetLayerProps) {
  const ink = useAnalysisInk();
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

  // ONE presentation geometry for the pointer side and the motion side: T-05's invariant step,
  // T-05's window offset, T-05's viewport, and the layout direction the strip is laid out under.
  // Presentation quantities every one of them; none is consulted by any Product decision.
  const rtl = I18nManager.isRTL;
  const geometry = useMemo<TemporalMarkerGeometry>(
    () => ({ stepWidth: TIMELINE_STEP, windowOffset: window.offset, viewport: window.viewport, rtl }),
    [window.offset, window.viewport, rtl],
  );

  const motion = useTemporalMotion(
    {
      committedSp: bounds.committedTc,
      previewSp: previewState.status === 'PREVIEWING' ? previewState.ptc : null,
      mode: bounds.mode,
      // The finger is observed on the UI runtime, by the binding's own `tracking` shared value, so
      // the JS-runtime plan never claims to know whether one is down.
      dragging: false,
    },
    geometry,
  );

  const snapshot = useCallback(() => presentation.getSnapshot(), [presentation]);
  const { gesture } = useTemporalScrub({
    store,
    preview,
    snapshot,
    geometry,
    enabled,
    fingerX: motion.fingerX,
    tracking: motion.tracking,
    onCommitted: motion.acknowledgeCommit,
    onCancelled: motion.acknowledgeCancel,
    onOutcome,
  });

  // VPORT-02 — the visible Temporal Spine, P2 C "Parting". Presentation over T-05's window only: it is told which
  // Moment is committed (only while PINNED, because following Live opens no Moment) and which is previewed, and it
  // never turns a coordinate into a Moment. The committed and preview APERTURES are the two markers below.
  const previewSp = previewState.status === 'PREVIEWING' ? previewState.ptc : null;
  const committedPresent = motion.plan.committedPresent;
  const spine = useMemo(
    () =>
      spinePresentation({
        disclosed: window.track.targets.length,
        offset: window.offset,
        viewport: window.viewport,
        committedSp: committedPresent ? bounds.committedTc : null,
        targetSp: previewSp,
      }),
    [window.track.targets.length, window.offset, window.viewport, committedPresent, bounds.committedTc, previewSp],
  );
  const following = motion.plan.temporalStance === 'FOLLOWING_LIVE';
  const liveAvailable = bounds.liveHead !== null;
  const goLive = useCallback(() => {
    const outcome = commitLiveEdgeIntent(store, preview);
    onOutcome?.(outcome);
  }, [store, preview, onOutcome]);

  const liveEdge = (
    <LiveEdgeTarget
      store={store}
      preview={preview}
      following={following}
      available={liveAvailable}
      onOutcome={onOutcome}
      language={language}
    />
  );

  return (
    <View testID={TEMPORAL_TARGET_LAYER_TEST_ID} style={styles.layer}>
      <TimelinePresentation controller={presentation} outboardLivePresentation={liveEdge} language={language} />

      <View style={styles.stripRow}>
        <GestureDetector gesture={gesture}>
          <View
            testID={TEMPORAL_TARGET_STRIP_TEST_ID}
            // Exactly T-05's viewport, at the row's start edge: under the Track in both directions,
            // and never under the discontinuity or the outboard Live slot.
            style={[styles.strip, { width: window.viewport }]}
            // The strip is the temporal surface. Its own semantics are supplied by the navigator
            // below, which is the non-drag route to everything reachable here.
            accessible={false}
          >
            <SpineLayer spine={spine} ink={ink.tertiary} targetInk={ink.primary} layer="SPINE" testID={TEMPORAL_SPINE_TEST_ID} />
            {/* The two markers keep T-06's anchor geometry, motion and testIDs exactly; each now carries P2's
                Parting drawing, hung from its anchor so the opening is centred on the Moment in both directions. */}
            <Animated.View testID={TEMPORAL_COMMITTED_MARKER_TEST_ID} pointerEvents="none" style={[styles.marker, motion.committedStyle]}>
              <Aperture kind="COMMITTED" ink={ink.primary} ground={ink.world} style={styles.aperture} />
            </Animated.View>
            <Animated.View testID={TEMPORAL_PREVIEW_MARKER_TEST_ID} pointerEvents="none" style={[styles.marker, motion.cursorStyle]}>
              <Aperture kind="PREVIEW" ink={ink.primary} ground={ink.world} style={styles.aperture} />
            </Animated.View>
            <SpineLayer spine={spine} ink={ink.tertiary} targetInk={ink.primary} layer="TARGET" testID={TEMPORAL_SPINE_TEST_ID + ':target'} />
          </View>
        </GestureDetector>
        {/* The Live Edge terminal: beyond the strip, where disclosed time ends — never on the Track, never a Moment's
            form. It is a second touch target for the SAME act as the outboard Live words above it, and it is not an
            accessibility element: the words are the act's one accessible route. Nothing here lies over the strip, so
            every Moment stays reachable (F-P2-02). */}
        <Pressable
          testID={TEMPORAL_LIVE_TERMINAL_TEST_ID}
          style={styles.terminal}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          disabled={!liveAvailable}
          onPress={goLive}
        >
          <LiveTerminal engaged={following} ink={following ? ink.primary : ink.restInk} rtl={rtl} />
        </Pressable>
      </View>

      <TemporalNavigator
        store={store}
        preview={preview}
        track={window.track}
        onOutcome={onOutcome}
        onCommitted={motion.acknowledgeCommit}
        onCancelled={motion.acknowledgeCancel}
        language={language}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { flexDirection: 'column' },
  // `alignSelf: 'flex-start'` is the row's START edge: left in LTR, right in RTL — the same edge
  // T-05's Timeline is flush against. A marker for a Moment outside the presentation window has no
  // physical place inside the strip, and is clipped rather than painted over the outboard slot.
  strip: { height: STRIP_HEIGHT, alignSelf: 'flex-start', overflow: 'hidden' },
  // VPORT-02: the strip and the Live terminal share one row. `row` is the reading direction, so the terminal is at
  // the END of the spine in both scripts.
  stripRow: { flexDirection: 'row', alignItems: 'center' },
  terminal: { minHeight: STRIP_HEIGHT, minWidth: STRIP_HEIGHT, justifyContent: 'center' },
  // Anchored at the strip's logical START, so one translateX rule places it in LTR and its exact
  // reflection places it in RTL (see `presentation-geometry.ts`); inset vertically so the commit
  // acknowledgement's growth stays inside the strip's clip.
  // VPORT-02: the anchor is a point on the strip's axis (zero width), so the one translateX rule places it at the
  // Moment in both directions; the Parting drawing hangs from it, centred, its frame aligned to the strip. `start` is
  // exact in both directions because the drawing is symmetric about the anchor: a mirror places the same pixels.
  marker: { position: 'absolute', top: MARKER_INSET, start: 0, width: 0, height: MARKER_HEIGHT },
  aperture: { position: 'absolute', top: -MARKER_INSET, start: -17 },
  liveEdge: { minHeight: 44, justifyContent: 'center' },
});
