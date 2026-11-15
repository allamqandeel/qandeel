/**
 * COSMOS-INT-01 Slice C — the accepted bottom rail: the Personal timeline as the Product Owner approved it on the HONOR
 * (Contract v1.3 §7, §14 C-1 / C-2 / C-9, §15.3 A), over the PRODUCTION temporal authorities and nothing else.
 *
 * The LOOK is the proof's `PositionTicks`, unchanged: a row of thin segments across the bottom, lit up to the committed
 * Moment, a gold dot at it, a quiet line of words under it. The FUNCTION is T-05 / T-06's, reached through their own
 * controllers:
 *
 *   - the segments are the DISCLOSED Moments of T-05's presentation window — one per Moment, nothing for a position
 *     nothing has disclosed, nothing beyond the disclosure horizon; the Live mark is outboard and is not a Moment;
 *   - the segment row IS the temporal target strip: T-06's one interaction (tap previews and commits; drag previews
 *     each segment and commits on release; every other ending cancels), through `useRailScrub` over T-06's own
 *     coordinator; the segments are also the non-drag route to every disclosed Moment, each one a native button;
 *   - the gold dot is the committed Moment and the hollow ring the previewed one, both placed and eased by T-06's
 *     `useTemporalMotion` (D-7); following Live opens no Moment, so the dot stands down and the Live words are lit;
 *   - a long conversation is WINDOWED (G-1): the rail shows at most `⌊width / 8⌋` Moments, the window START is T-05's
 *     own offset (the controller's viewport is set to the rail's capacity in Track steps, so T-05's offset, maximum and
 *     position ARE the rail's window — one authority), the "…" discontinuity mark at either end pages it, and the
 *     window follows the committed Moment when it leaves the window;
 *   - above the segments stands the COMPACT Moment label (Product Owner, §16 U-6 / A-4): T-05's own word for the
 *     committed Moment («اللحظة 12» / "Moment 12"), drawn only while a Moment is committed — following Live draws
 *     nothing, the Live words below carry that state — with T-08's temporal sentence as its accessible label, so the
 *     T-08 meaning (and, during a preview, the preview sentence) stays with assistive technology while nothing
 *     explanatory is drawn; T-06's and T-05's navigators are mounted headless: a 1 × 1 clipped host that hides
 *     nothing from assistive technology, so exact-Moment entry, forward continuation, commit / cancel, refine / widen /
 *     first / last and the command field all keep their routes while none of their text is on the screen (C-5);
 *   - the words row carries, at its START, the host's compact contextual acts (§16 A-3), and at its END the Live words;
 *   - the rail is laid out identically in both languages (§16 U-9): Moment 1 at the left, the Live edge at the right.
 *
 * Nothing here is a second temporal state: no cursor, no window of its own, no clock, no copy of `TC`, `LH` or `PTC`.
 * Every word is an already-approved T-05 / T-06 / T-08 word.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
// The Live words and the "…" marks are gesture-handler Pressables (HONOR, 2026-11-16): a bare-text React Native Pressable over
// the stage's gesture surface lost its press on the device while every chip with a background took it — RNGH's Android
// orchestrator lets a touch over a background-less view fall through to the stage's handlers, whose tap then cancels the
// React Native press. A gesture-handler Pressable is itself a native handler, innermost, so the words always win the tap.
import { GestureDetector, Pressable as GesturePressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { analysisCopy } from '../../../analysis-language';
import { temporalOrientationLine, type ChromeLanguage } from '../../../orientation-chrome';
import type { CanonicalStore } from '../../../state';
import {
  TemporalNavigator,
  commitLiveEdgeIntent,
  commitPreviewedTarget,
  temporalTargeting,
  useTemporalMotion,
  type TemporalMarkerGeometry,
  type TemporalOutcome,
  type TemporalPreviewController,
} from '../../../temporal-navigation';
import { PresentationNavigator, TIMELINE_STEP, type PresentationController } from '../../../timeline';
import { useRailScrub } from './useRailScrub';

export const COSMOS_TIMELINE_RAIL_TEST_ID = 'qandeel-cosmos-timeline-rail';
export const COSMOS_RAIL_SEGMENTS_TEST_ID = `${COSMOS_TIMELINE_RAIL_TEST_ID}:segments`;
/** One disclosed Moment's segment: `${prefix}${sessionPosition}`. */
export const COSMOS_RAIL_MOMENT_TEST_ID_PREFIX = `${COSMOS_TIMELINE_RAIL_TEST_ID}:moment:`;
export const COSMOS_RAIL_COMMITTED_TEST_ID = `${COSMOS_TIMELINE_RAIL_TEST_ID}:committed`;
export const COSMOS_RAIL_PREVIEW_TEST_ID = `${COSMOS_TIMELINE_RAIL_TEST_ID}:preview`;
export const COSMOS_RAIL_LIVE_TEST_ID = `${COSMOS_TIMELINE_RAIL_TEST_ID}:live`;
export const COSMOS_RAIL_EARLIER_TEST_ID = `${COSMOS_TIMELINE_RAIL_TEST_ID}:earlier`;
export const COSMOS_RAIL_LATER_TEST_ID = `${COSMOS_TIMELINE_RAIL_TEST_ID}:later`;
export const COSMOS_RAIL_HEADLESS_TEST_ID = `${COSMOS_TIMELINE_RAIL_TEST_ID}:headless`;
/** The compact Moment label above the segments (§16 A-4). */
export const COSMOS_RAIL_ACTS_ROW_TEST_ID = `${COSMOS_TIMELINE_RAIL_TEST_ID}:acts`;
export const COSMOS_RAIL_LABEL_TEST_ID = `${COSMOS_TIMELINE_RAIL_TEST_ID}:label`;

/** The narrowest pitch a segment is drawn at (a 1-point bar with room for the 7-point dot): beyond it the rail windows. */
export const RAIL_MIN_PITCH = 8;
/** The segments' row height (the proof's 44-point touch row). */
export const RAIL_ROW_HEIGHT = 44;

// The stage's own glass palette, as accepted on the device (the same constants as the world view's).
const C = { ink: '#E9EAF4', gold: '#ECCC8A', goldDim: 'rgba(236, 204, 138, 0.38)', quiet: '#9A9DB4', hair: 'rgba(233, 234, 244, 0.16)' } as const;

export interface CosmosTimelineRailProps {
  readonly store: CanonicalStore;
  readonly preview: TemporalPreviewController;
  /** T-05's presentation controller: the rail reads its window and asks it to move; it writes no Track. */
  readonly presentation: PresentationController;
  readonly language: ChromeLanguage;
  /** The host's compact contextual acts, at the START of the words row (§16 A-3). */
  readonly acts?: ReactNode;
  readonly onOutcome?: (outcome: TemporalOutcome) => void;
  readonly testID?: string;
}

/** The rail's window over the disclosed Track, from T-05's own snapshot and the rail's measured width. Pure, for tests. */
export function railWindow(width: number, total: number, offset: number): { readonly capacity: number; readonly shown: number; readonly start: number; readonly pitch: number; readonly windowed: boolean } {
  const capacity = width > 0 ? Math.max(1, Math.floor(width / RAIL_MIN_PITCH)) : 0;
  const windowed = capacity > 0 && total > capacity;
  const shown = capacity === 0 ? 0 : Math.min(total, capacity);
  const start = windowed ? Math.min(Math.max(0, Math.round(offset / TIMELINE_STEP)), total - capacity) : 0;
  const pitch = shown > 0 ? width / shown : 0;
  return { capacity, shown, start, pitch, windowed };
}

export function CosmosTimelineRail({ store, preview, presentation, language, acts = null, onOutcome, testID = COSMOS_TIMELINE_RAIL_TEST_ID }: CosmosTimelineRailProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const previewState = useSyncExternalStore(preview.subscribe, preview.getSnapshot);
  const window = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot);
  const copy = analysisCopy(language);
  // U-9: one geometry in both languages — the row runs left → right, Moment 1 first, the Live edge at the right.
  const rtl = false;

  // Canonical bounds and disclosed availability together, exactly as T-06's own layer hands them out: no route here
  // can target a Moment nothing has disclosed. A replaced Session or a no-longer-disclosed target takes its preview.
  const targeting = useMemo(() => temporalTargeting(state, window.track), [state, window.track]);
  useEffect(() => {
    preview.reconcile(targeting);
  }, [preview, targeting]);
  const bounds = targeting.bounds;

  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width)), []);
  const total = window.track.targets.length;
  const { capacity, shown, start, pitch, windowed } = railWindow(width, total, window.offset);

  // ONE window authority: T-05's controller, whose viewport is the rail's capacity in Track steps. Its offset, maximum
  // and position are then the rail's window, and every T-05 route (page, adjust, first / last, the command) moves it.
  useLayoutEffect(() => {
    if (capacity > 0) presentation.setViewport(capacity * TIMELINE_STEP);
  }, [presentation, capacity]);

  // The window follows the committed Moment when it leaves the window (a commit beyond it, Live advancing while
  // following). Deliberately NOT keyed on the window start: paging away from the committed Moment is the reader's own
  // presentation move and is not undone here.
  const committedIndex = bounds.committedTc !== null && bounds.committedTc <= total ? bounds.committedTc - 1 : null;
  useEffect(() => {
    if (!windowed || committedIndex === null) return;
    // The window start is read from T-05 at this moment, not from the render that scheduled this effect.
    const at = railWindow(width, total, presentation.getSnapshot().offset).start;
    if (committedIndex >= at && committedIndex < at + capacity) return;
    presentation.move({ type: 'PRESENTATION_WINDOW_MOVE', offset: (committedIndex - Math.floor(capacity / 2)) * TIMELINE_STEP });
  }, [windowed, committedIndex, capacity, presentation, width, total]);

  // ONE geometry for the pointer side and the motion side: the segment pitch is the step, the window start the offset.
  const geometry = useMemo<TemporalMarkerGeometry>(() => ({ stepWidth: pitch, windowOffset: start * pitch, viewport: width, rtl }), [pitch, start, width, rtl]);
  const previewSp = previewState.status === 'PREVIEWING' ? previewState.ptc : null;
  const motion = useTemporalMotion({ committedSp: bounds.committedTc, previewSp, mode: bounds.mode, dragging: false }, geometry);

  const snapshot = useCallback(() => presentation.getSnapshot(), [presentation]);
  const { gesture } = useRailScrub({
    store,
    preview,
    snapshot,
    geometry: { width, pitch, start, count: shown, rtl },
    enabled: shown > 0,
    fingerX: motion.fingerX,
    tracking: motion.tracking,
    onCommitted: motion.acknowledgeCommit,
    onCancelled: motion.acknowledgeCancel,
    onOutcome,
  });

  /** A segment pressed without a drag: the same preview and the same commit boundary as the pointer route. */
  const choose = useCallback(
    (sp: number) => {
      const previewed = preview.preview(targeting, sp, 'DISCLOSED_TARGET');
      if (previewed.outcome === 'REJECTED') return;
      const outcome = commitPreviewedTarget(store, preview, targeting);
      onOutcome?.(outcome);
      if (outcome.outcome === 'APPLIED') motion.acknowledgeCommit();
      else motion.acknowledgeCancel();
    },
    [preview, targeting, store, onOutcome, motion],
  );
  const goLive = useCallback(() => {
    onOutcome?.(commitLiveEdgeIntent(store, preview));
  }, [store, preview, onOutcome]);

  const committedPresent = motion.plan.committedPresent;
  const following = motion.plan.temporalStance === 'FOLLOWING_LIVE';
  const liveAvailable = bounds.liveHead !== null;
  const liveWords = following ? copy.followingConversation : copy.rejoinConversation;
  // §16 A-4: the drawn label is T-05's word for the COMMITTED Moment, from the canonical bounds; nothing while following
  // Live (no Moment is invented). Its accessible label is T-08's own temporal sentence for this very state.
  const label = committedPresent && bounds.committedTc !== null ? copy.timelinePoint(bounds.committedTc) : null;
  const sentence = temporalOrientationLine(store, language, previewState);

  const segments: ReactNode[] = [];
  for (let i = 0; i < shown; i += 1) {
    const target = window.track.targets[start + i];
    if (target === undefined) break;
    const sp = target.sessionPosition;
    const at = committedPresent && sp === bounds.committedTc;
    const lit = committedPresent && bounds.committedTc !== null && sp <= bounds.committedTc;
    segments.push(
      <Pressable key={sp} testID={`${COSMOS_RAIL_MOMENT_TEST_ID_PREFIX}${sp}`} accessibilityRole="button" accessibilityLabel={copy.timelinePoint(sp)}
        accessibilityLanguage={language} accessibilityState={{ selected: at }} onPress={() => choose(sp)} style={styles.tick}>
        {/* The dot marker stands where the committed segment's bar would be (the proof's `tickAt`). */}
        {at ? null : <View style={lit ? styles.tickLit : styles.tickBar} />}
      </Pressable>,
    );
  }

  // `collapsable={false}`: the rail's root must stay a native view that KEEPS its children (a stacking context). With only
  // a testID, Fabric flattens it and hoists the segments, the marks and the Live words into the stage's own container,
  // and on the HONOR the words' press was then lost in both languages (three builds: eecd954f, 73c77c4a, 8a7c04ba);
  // with the root un-flattened the same press is reliable (two probe builds, and the fix build — Contract v1.4 §16.6).
  return (
    <View testID={testID} collapsable={false} style={styles.rail} pointerEvents="box-none">
      {/* The host's compact acts, ABOVE the label (§16 A-3 as corrected in §16.6): everything that appears and disappears
          with the temporal state sits above the segments, so the rail grows and shrinks UPWARD and the segments — the
          surface under the reader's finger — never move (HONOR, e64861ad: acts wrapping under the segments pushed them up
          by a line the moment a Moment was committed). */}
      {acts === null ? null : (
        <View testID={COSMOS_RAIL_ACTS_ROW_TEST_ID} style={styles.actsRow} pointerEvents="box-none">{acts}</View>
      )}
      {label === null ? null : (
        <View testID={COSMOS_RAIL_LABEL_TEST_ID} pointerEvents="none" style={styles.labelRow}>
          <Text accessibilityLabel={sentence ?? label} accessibilityLanguage={language} style={[styles.labelText, language === 'ar' ? styles.labelArabic : styles.labelEnglish]}>{label}</Text>
        </View>
      )}
      <View style={styles.row} pointerEvents="box-none">
        <GestureDetector gesture={gesture}>
          {/* The segment row is the temporal surface. `onLayout` is its width: the one measurement the rail makes. */}
          <View testID={COSMOS_RAIL_SEGMENTS_TEST_ID} onLayout={onLayout} style={styles.segments} accessible={false}>
            {segments}
            <Animated.View testID={COSMOS_RAIL_COMMITTED_TEST_ID} pointerEvents="none" style={[styles.marker, motion.committedStyle]}>
              <View style={styles.dot} />
            </Animated.View>
            <Animated.View testID={COSMOS_RAIL_PREVIEW_TEST_ID} pointerEvents="none" style={[styles.marker, motion.cursorStyle]}>
              <View style={styles.ring} />
            </Animated.View>
          </View>
        </GestureDetector>
        {/* The "…" marks, after the row so they stand above its edge: earlier Moments at the START, later ones at the END. */}
        {start > 0 ? (
          <GesturePressable testID={COSMOS_RAIL_EARLIER_TEST_ID} accessibilityRole="button" accessibilityLabel={copy.trackContinues} accessibilityLanguage={language}
            onPress={() => presentation.page(-1)} style={[styles.more, styles.moreStart]}>
            <Text style={styles.moreText}>…</Text>
          </GesturePressable>
        ) : null}
        {start + shown < total ? (
          <GesturePressable testID={COSMOS_RAIL_LATER_TEST_ID} accessibilityRole="button" accessibilityLabel={copy.trackContinues} accessibilityLanguage={language}
            onPress={() => presentation.page(1)} style={[styles.more, styles.moreEnd]}>
            <Text style={styles.moreText}>…</Text>
          </GesturePressable>
        ) : null}
      </View>
      {/* The words row: the outboard Live edge, with T-06's words, at the END. Never a Moment; never an act. */}
      <View style={styles.words} pointerEvents="box-none">
        <View style={styles.spacer} />
        <GesturePressable testID={COSMOS_RAIL_LIVE_TEST_ID} accessibilityRole="button" accessibilityLabel={liveWords} accessibilityLanguage={language}
          accessibilityState={{ disabled: !liveAvailable, selected: following }} disabled={!liveAvailable} onPress={goLive} style={styles.liveAct}>
          <Text style={following ? styles.quietText : styles.goldText}>{liveWords}</Text>
        </GesturePressable>
      </View>
      {/* The non-drag routes, headless: present to assistive technology, not on the screen (C-5). */}
      <View testID={COSMOS_RAIL_HEADLESS_TEST_ID} style={styles.headless} accessibilityRole="none" pointerEvents="box-none">
        <TemporalNavigator store={store} preview={preview} track={window.track} onOutcome={onOutcome} onCommitted={motion.acknowledgeCommit} onCancelled={motion.acknowledgeCancel} language={language} />
        <PresentationNavigator controller={presentation} language={language} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { gap: 2 },
  // The compact label's own row: one supporting line, no explanatory text (U-6).
  labelRow: { paddingBottom: 2 },
  labelText: { fontSize: 13, lineHeight: 18, color: C.ink },
  labelArabic: { textAlign: 'right', writingDirection: 'rtl' },
  labelEnglish: { textAlign: 'left', writingDirection: 'ltr' },
  row: { flexDirection: 'row', alignItems: 'center' },
  // The proof's `ticks`: a 44-point row, one flexed cell per Moment. Clipped, so a marker travelling to a Moment
  // outside the window is not painted over the "…" marks.
  segments: { flex: 1, flexDirection: 'row', height: RAIL_ROW_HEIGHT, overflow: 'hidden' },
  tick: { flex: 1, height: RAIL_ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  tickBar: { width: 1, height: 9, backgroundColor: C.hair },
  tickLit: { width: 1, height: 13, backgroundColor: C.goldDim },
  // A marker is a point on the row's axis (zero width) anchored at the row's left edge in both languages (U-9), and
  // T-06's one translate rule places it at its Moment; the glyph hangs centred on the anchor.
  marker: { position: 'absolute', top: 0, left: 0, width: 0, height: RAIL_ROW_HEIGHT },
  dot: { position: 'absolute', top: (RAIL_ROW_HEIGHT - 7) / 2, left: -3.5, width: 7, height: 7, borderRadius: 4, backgroundColor: C.gold },
  ring: { position: 'absolute', top: (RAIL_ROW_HEIGHT - 9) / 2, left: -4.5, width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: C.gold },
  // The "…" discontinuity marks are drawn in the rail's own 18-point gutters (the host's inset); each is a 44-point
  // press target (T12-A95) centred on its gutter, so it reaches 13 points over the row's edge segment.
  more: { position: 'absolute', top: 0, width: 44, height: RAIL_ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  moreStart: { left: -31 },
  moreEnd: { right: -31 },
  moreText: { fontSize: 11, letterSpacing: 0.8, color: C.quiet },
  words: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spacer: { flex: 1 },
  // The acts' row above the label: the chips wrap (§16.6), nothing is clipped; it exists only while acts are offered.
  actsRow: { alignItems: 'flex-start', paddingBottom: 2 },
  liveAct: { minHeight: RAIL_ROW_HEIGHT, paddingHorizontal: 10, justifyContent: 'center', flexShrink: 0 },
  quietText: { fontSize: 11, letterSpacing: 0.8, color: C.quiet },
  goldText: { fontSize: 13, color: C.gold },
  headless: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'hidden' },
});
