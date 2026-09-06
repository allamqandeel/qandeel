import { memo, type ReactNode, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { FlatList, I18nManager, Text, View } from 'react-native';
import { PresentationNavigator } from '../accessibility/PresentationNavigator';
import { type DisclosedMomentTarget, itemLayout, targetKey, TIMELINE_STEP } from '../model/disclosedTrack';
import type { PresentationController } from '../window/controller';

const MomentStep = memo(function MomentStep({ target }: { target: DisclosedMomentTarget }) {
  return <View testID={`timeline-sp-${target.sessionPosition}`} style={{ width: TIMELINE_STEP, height: TIMELINE_STEP }}
    accessible accessibilityLabel={`Disclosed Moment SP ${target.sessionPosition}`}>
    <Text numberOfLines={1}>{target.sessionPosition}</Text>
  </View>;
});
const renderItem = ({ item }: { item: DisclosedMomentTarget }) => <MomentStep target={item} />;

/** Presentation dimensions only; neither participates in ordinal list layout. */
export const OUTBOARD_LIVE_EXTENT = 64;
const DISCONTINUITY_EXTENT = 16;

/** Composition seam only: a parent supplies disclosed input via the controller.
 * The optional outboard slot is supplied by the later temporal composition. T-05
 * never manufactures a Live target, its activation, or a committed-mode indicator. */
export function TimelinePresentation({ controller, outboardLivePresentation }: {
  controller: PresentationController;
  outboardLivePresentation?: ReactNode;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
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
    <View style={{ flexDirection: 'row', height: TIMELINE_STEP }}>
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
        {state.offset < state.maximum && <Text testID="timeline-discontinuity"
          accessibilityLabel="Disclosed Track continues">…</Text>}
      </View>
      <View testID="timeline-outboard-live" style={{ width: OUTBOARD_LIVE_EXTENT, overflow: 'hidden' }}>
        {outboardLivePresentation}
      </View>
    </>}
    </View>
    <View testID="timeline-position-rail" style={{ height: 44 }} accessible={false}
      onLayout={({ nativeEvent }) => { railWidth.current = nativeEvent.layout.width; }}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
      onResponderGrant={({ nativeEvent }) => railMove(nativeEvent.locationX)}
      onResponderMove={({ nativeEvent }) => railMove(nativeEvent.locationX)}>
      <View pointerEvents="none" style={{ position: 'absolute', left: `${(I18nManager.isRTL ? 1 - state.position : state.position) * 100}%`, height: 44, borderLeftWidth: 2 }} />
    </View>
    <PresentationNavigator key={`navigator:${state.track.sessionId}`} controller={controller} />
  </View>;
}
