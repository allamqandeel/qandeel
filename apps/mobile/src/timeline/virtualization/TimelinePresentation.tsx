import { memo, type ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { FlatList, I18nManager, Text, View, type TextStyle } from 'react-native';
import { analysisCopy, type AnalysisLanguage } from '../../analysis-language';
import { useAnalysisInk, useAnalysisType, type AnalysisInk } from '../../analysis-visual';
import { PresentationNavigator } from '../accessibility/PresentationNavigator';
import { type DisclosedMomentTarget, itemLayout, targetKey, TIMELINE_STEP } from '../model/disclosedTrack';
import type { PresentationController } from '../window/controller';

// VPORT-02: the numeral in the Analysis ink (tertiary, E3 metadata), centred on its 48-point step, which is exactly
// where the Temporal Spine's notch for the same Moment falls below it. Nothing about the step, its key or its label moved.
const MomentStep = memo(function MomentStep({ target, language, numeral }: { target: DisclosedMomentTarget; language: AnalysisLanguage; numeral: TextStyle }) {
  return <View testID={`timeline-sp-${target.sessionPosition}`} style={{ width: TIMELINE_STEP, height: TIMELINE_STEP }}
    accessible accessibilityLabel={analysisCopy(language).timelinePoint(target.sessionPosition)} accessibilityLanguage={language}>
    <Text numberOfLines={1} style={numeral}>{target.sessionPosition}</Text>
  </View>;
});

/**
 * Presentation dimensions only; neither participates in ordinal list layout.
 *
 * `OUTBOARD_LIVE_EXTENT` is the outboard slot's MINIMUM extent, not its fixed one (`QAN-BL-RSP-02`,
 * corrected in T-12 §17). It was a fixed `width` with `overflow: 'hidden'`, and the T-11 visual proof
 * showed what that costs: at a 200 % system text size the essential Live wording — "Go live" /
 * "Live", and the Arabic equivalents — needs roughly 110 points, so the reader saw "Go". Essential
 * wording clipped by a presentation width is an accessibility-parity failure at a text size real
 * readers use, and every way of "fixing" it inside 64 points is forbidden: truncating the copy,
 * replacing it with an icon, hiding the label, and shrinking the text are all ruled out, and moving
 * the slot under the strip would destroy the outboard identity that keeps Live out of Moment-targeting
 * space.
 *
 * So the slot sizes to its content and this is its floor. Nothing shrinks: at ordinary text sizes the
 * geometry is exactly what it was. Nothing about temporal meaning changes either — the slot is still
 * outboard, still separated from the Track by the discontinuity, still not a Moment and still not a
 * target — and T-05's own viewport measurement stays self-consistent because the Track's `onLayout`
 * reports the width the list ACTUALLY got beside the slot, whatever the slot took.
 */
export const OUTBOARD_LIVE_EXTENT = 64;
const DISCONTINUITY_EXTENT = 16;

/** Composition seam only: a parent supplies disclosed input via the controller.
 * The optional outboard slot is supplied by the later temporal composition. T-05
 * never manufactures a Live target, its activation, or a committed-mode indicator. */
export function TimelinePresentation({ controller, outboardLivePresentation, language = 'en' }: {
  controller: PresentationController;
  outboardLivePresentation?: ReactNode;
  /** The reader's Product language for every word here (W1A-01). */
  language?: AnalysisLanguage;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  // VPORT-02: the Analysis ink and type (`QAN` dark-on-dark correction). Presentation only; read once per surface.
  const ink: AnalysisInk = useAnalysisInk();
  const type = useAnalysisType();
  const metadata = type('metadata');
  // Centred in its own step by the line box alone, so the step keeps its exact invariant extent and style.
  const numeral = useMemo<TextStyle>(() => ({ ...metadata, color: ink.tertiary, textAlign: 'center', lineHeight: TIMELINE_STEP }), [metadata, ink.tertiary]);
  const renderItem = useCallback(({ item }: { item: DisclosedMomentTarget }) => <MomentStep target={item} language={language} numeral={numeral} />, [language, numeral]);
  const list = useRef<FlatList<DisclosedMomentTarget>>(null);
  const railWidth = useRef(0);
  const nativeOffset = useRef(0);
  useLayoutEffect(() => {
    if (nativeOffset.current !== state.offset) {
      list.current?.scrollToOffset({ offset: state.offset, animated: false });
      nativeOffset.current = state.offset;
    }
  }, [state.offset, state.viewport, state.track]);
  const railMove = (x: number) => {
    if (railWidth.current > 0 && Number.isFinite(x)) {
      const fraction = x / railWidth.current;
      controller.move({ type: 'PRESENTATION_POSITION_MOVE', position: I18nManager.isRTL ? 1 - fraction : fraction });
    }
  };
  return <View>
    {/* `minHeight` rather than `height`: the row was clipping the Live label in BOTH axes, and a
        taller wrapped label needs the row to grow with it. The Track itself keeps its exact
        `TIMELINE_STEP` below, so the invariant step, the window offset and the position scale are
        untouched — only the row around them may be taller. */}
    <View style={{ flexDirection: 'row', minHeight: TIMELINE_STEP }}>
    <FlatList key={`list:${state.track.sessionId}`} ref={list} testID="timeline-list" horizontal
      data={state.track.targets} renderItem={renderItem} keyExtractor={targetKey} getItemLayout={itemLayout}
      initialNumToRender={12} maxToRenderPerBatch={12} windowSize={5} updateCellsBatchingPeriod={16}
      style={{ height: TIMELINE_STEP, flexGrow: 1, flexShrink: 1, flexBasis: 0 }}
      onLayout={({ nativeEvent }) => controller.setViewport(nativeEvent.layout.width)}
      onContentSizeChange={() => {
        // RN requires content layout before RTL scrollToOffset; reapply after
        // disclosure replacement too, without deriving membership from layout.
        list.current?.scrollToOffset({ offset: controller.getSnapshot().offset, animated: false });
      }}
      onScroll={({ nativeEvent }) => {
        nativeOffset.current = I18nManager.isRTL
          ? nativeEvent.contentSize.width - nativeEvent.layoutMeasurement.width - nativeEvent.contentOffset.x
          : nativeEvent.contentOffset.x;
        controller.move({ type: 'PRESENTATION_WINDOW_MOVE', offset: nativeOffset.current });
        const bounded = controller.getSnapshot().offset;
        if (bounded !== nativeOffset.current) {
          list.current?.scrollToOffset({ offset: bounded, animated: false });
          nativeOffset.current = bounded;
        }
      }} scrollEventThrottle={16} />
    {outboardLivePresentation != null && <>
      <View style={{ width: DISCONTINUITY_EXTENT }}>
        {state.offset < state.maximum && <Text testID="timeline-discontinuity" style={[metadata, { color: ink.tertiary }]}
          accessibilityLabel={analysisCopy(language).trackContinues} accessibilityLanguage={language}>…</Text>}
      </View>
      {/* Sizes to its content, never below the floor, and never clipped. `flexShrink: 0` is what
          keeps the Track from squeezing the wording back out at a narrow width — the list beside it
          is the flexible half and measures whatever it is left. */}
      <View testID="timeline-outboard-live" style={{ minWidth: OUTBOARD_LIVE_EXTENT, flexShrink: 0 }}>
        {outboardLivePresentation}
      </View>
    </>}
    </View>
    <View testID="timeline-position-rail" style={{ height: 44 }} accessible={false}
      onLayout={({ nativeEvent }) => { railWidth.current = nativeEvent.layout.width; }}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
      onResponderGrant={({ nativeEvent }) => railMove(nativeEvent.locationX)}
      onResponderMove={({ nativeEvent }) => railMove(nativeEvent.locationX)}>
      <View pointerEvents="none" style={{ position: 'absolute', left: `${(I18nManager.isRTL ? 1 - state.position : state.position) * 100}%`, height: 44, borderLeftWidth: 2, borderColor: ink.restInk }} />
    </View>
    <PresentationNavigator key={`navigator:${state.track.sessionId}`} controller={controller} language={language} />
  </View>;
}
