/**
 * T-08 — the composed orientation chrome: support AROUND the world, never a replacement for it.
 *
 * ## Why this is a band and not a panel
 *
 * The Living Analysis Map is where the conversation is looked at. Chrome that covered it, or that
 * turned it into a backdrop behind a dashboard, would replace the world with a description of the
 * world. So this component:
 *
 *   - occupies no more than the bottom of its parent and never fills it. There is no
 *     `StyleSheet.absoluteFill`, no full-screen inspector, no modal, no page and no sidebar;
 *   - lets every touch it does not itself claim pass straight through to the world beneath — and
 *     that is true of its DESCENDANTS too, not only of this root. Every noninteractive wrapper is
 *     `box-none` and every text-only surface is `none`, so the only things in this subtree that can
 *     take a press are the controls that mean something. That is what keeps the world live and
 *     pannable while the chrome is on screen, and it is structural rather than a matter of styling;
 *   - contains no scroller and no list of world objects. Enumerating the world here would build a
 *     second Map that could disagree with the first;
 *   - offers only the acts that are meaningful right now, so it never becomes a permanent command
 *     panel of everything the system can do.
 *
 * ## Subscribed, not sampled — twice
 *
 * Every semantic answer depends on the current canonical viewpoint, so this reads the store through
 * the T-02 kernel's own subscription seam. A chrome built from a snapshot taken once at mount would
 * keep describing a position the reader has already left — and would keep offering acts that belong
 * to it. Reading through `useSyncExternalStore` makes the surface correct independently of whatever
 * its parent happens to rerender, and a replaced store resubscribes rather than being remembered.
 *
 * The transient preview is read the same way, from T-06's own published snapshot. It is a SECOND
 * external store and it is strictly read-only here: the prop type carries `getSnapshot` and
 * `subscribe` and nothing else, so starting, retargeting, committing or cancelling a preview is a
 * type error rather than a rule someone has to remember. When a preview source is replaced the old
 * subscription is dropped, and when this component unmounts a late publication from a retired
 * controller reaches nothing.
 *
 * There is no second copy of `TM`, `TC`, `LH`, `LF`, `IF_ref`, the camera, `RH` or `PTC` anywhere
 * here. The one piece of local state is Class D and can only ever REMOVE an opportunity, never
 * create one.
 *
 * ## Rerender, remount and replacement
 *
 * The whole orientation answer is recomputed from props and subscribed state on every render, so a
 * changed callback identity, an extra rerender or a remount cannot alter what any control means or
 * does. Nothing is captured at mount: the Exact Return opportunity is a prop and is never
 * recaptured, no context is auto-selected, and no act is replayed. Every executor call happens
 * synchronously inside the press it belongs to, so there is no asynchronous window in which a late
 * callback could act after unmount — and the provider this component passes down is a pure function
 * that holds no store and can write nothing.
 */
import { useCallback, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { MapActionOutcome, MapProjectionRequest } from '../map';
import type { ReturnMapContext, ReturnOutcome, ReturnSurface } from '../return-navigation';
import type { TemporalPreview } from '../temporal-navigation';
import { exactReturnTargetFor, type ExactReturnOrigin } from './exact-return-origin';
import { InspectionOrientation } from './InspectionOrientation';
import { orientationModel, type ChromeProjection } from './model';
import { liveSentence, previewSentence, spatialSentence, temporalSentence } from './product-copy';
import { ReturnControls } from './ReturnControls';
import type { ChromeLanguage, OrientationModel, ReturnOpportunityId, TemporalPreviewSource } from './types';

export const ORIENTATION_CHROME_TEST_ID = 'qandeel-orientation-chrome';

export interface OrientationChromeProps {
  readonly surface: ReturnSurface;
  /**
   * The Product language this surface speaks.
   *
   * Required, and deliberately not defaulted: defaulting it would quietly make one of the two
   * languages the Product's default, which is not a decision this layer is entitled to take. It is
   * presentation configuration only — it reaches the copy boundary and nothing else, and no semantic
   * answer below is derived from it. It is also NOT the reading direction: `I18nManager.isRTL` is
   * never consulted here, and language never selects a layout direction.
   */
  readonly language: ChromeLanguage;
  readonly projection: ChromeProjection;
  /**
   * An Exact Return opportunity bound from a real explicit inspection journey.
   *
   * It is never minted here, and there is no longer any public way to mint one from an arbitrary
   * checkpoint: T-08 does not read the reversible history, does not treat the oldest recorded
   * checkpoint as an original inspection, and builds no history browser. The integration task binds
   * it at the real journey boundary, and T-07 re-proves it at execution. An opportunity bound
   * against a different store is not offered at all.
   */
  readonly exactReturnOrigin?: ExactReturnOrigin | null;
  /**
   * T-06's preview controller, consumed READ-ONLY.
   *
   * Narrowed to its published snapshot and its subscription, so nothing here can write a preview.
   * When it is absent the preview orientation is simply idle.
   */
  readonly preview?: TemporalPreviewSource | null;
  /**
   * Resolves the LIVE viewpoint's disclosure for the composite act.
   *
   * Its PRESENCE is what makes Go Live + Locate offerable at all: without it the surface has no way
   * to attempt the spatial half, and a control that cannot attempt its own promise is not offered.
   * Presence says nothing about whether a landing will exist.
   */
  readonly liveContext?: (request: MapProjectionRequest) => ReturnMapContext;
  readonly onReturnOutcome?: (id: ReturnOpportunityId, outcome: ReturnOutcome) => void;
  readonly onMapOutcome?: (outcome: MapActionOutcome) => void;
  /**
   * Bottom safe-area inset, supplied by whichever surface mounts this one.
   *
   * T-08 does not read it from the platform: the safe-area provider lives at the app root, and the
   * app root belongs to the later integration task. This is the seam, not the ownership.
   */
  readonly bottomInset?: number;
  /**
   * How the return acts are arranged (T-11), supplied by whichever surface composes this one.
   *
   * The SECOND layout-shaped prop, and the same kind of seam as `bottomInset`: an already-decided
   * arrangement, never a width, a breakpoint or a measurement. Nothing this component computes
   * consults it — the semantic model, the offered set, the order and every word are identical under
   * either value — so no Product answer can depend on how much room the reader's window has.
   */
  readonly returnArrangement?: 'STACKED' | 'PAIRED';
}

/**
 * T-06's published preview, or `null` when this surface observes none.
 *
 * The two callbacks are keyed to the source's identity, so a REPLACED controller resubscribes and
 * the old subscription is dropped by React rather than lingering — and an unmount drops it entirely.
 * The absent case answers `null`, which is referentially stable; returning a fresh object there
 * would make `useSyncExternalStore` loop. No idle shape of T-06's is redefined here.
 */
function usePreview(source: TemporalPreviewSource | null | undefined): TemporalPreview | null {
  const subscribe = useCallback(
    (listener: () => void) => (source === null || source === undefined ? NOOP_UNSUBSCRIBE : source.subscribe(listener)),
    [source],
  );
  const getSnapshot = useCallback(() => (source === null || source === undefined ? null : source.getSnapshot()), [source]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

const NOOP_UNSUBSCRIBE = () => undefined;

export function OrientationChrome({
  surface,
  language,
  projection,
  exactReturnOrigin,
  preview,
  liveContext,
  onReturnOutcome,
  onMapOutcome,
  bottomInset = 0,
  returnArrangement = 'STACKED',
}: OrientationChromeProps) {
  // The kernel's own subscription seam. This is the rerender trigger AND the guarantee that a
  // replaced store is resubscribed to rather than remembered.
  useSyncExternalStore(surface.store.subscribe, surface.store.getState);
  const previewSnapshot = usePreview(preview);

  /**
   * The one piece of Class-D state in T-08, and it is subtractive by construction.
   *
   * An opportunity T-07 has refused has lost its justification, so it is retired rather than left
   * standing as an act that will refuse again. It is compared by object identity, so an ordinary
   * rerender keeps the retirement, a newly bound opportunity is offered normally, and a remount
   * starts clean. It can never make an unavailable act available.
   */
  const [refusedOrigin, setRefusedOrigin] = useState<ExactReturnOrigin | null>(null);
  const origin = exactReturnOrigin === undefined || exactReturnOrigin === null || exactReturnOrigin === refusedOrigin ? null : exactReturnOrigin;
  // Resolved against this store's own lifecycle: a foreign or replaced store yields nothing here,
  // so the act is never offered rather than being offered and then refused on press.
  const exactReturnTarget = exactReturnTargetFor(surface.store, origin);

  const model: OrientationModel = orientationModel(surface.store, projection, {
    exactReturnOrigin: origin,
    preview: previewSnapshot,
    // Capability, not truth: whether this surface could attempt the composite's spatial half at all.
    liveContextAvailable: liveContext !== undefined,
  });
  const current = model.projection.status === 'CURRENT' && projection.held ? projection.context : null;

  const handleReturn = useCallback(
    (id: ReturnOpportunityId, outcome: ReturnOutcome) => {
      // A refusal is evidence that this opportunity's justification is gone. A no-op is not: it
      // means the act legitimately changed nothing, and the opportunity is still real.
      if (id === 'EXACT_RETURN' && outcome.outcome === 'REJECTED' && origin !== null) setRefusedOrigin(origin);
      onReturnOutcome?.(id, outcome);
    },
    [origin, onReturnOutcome],
  );

  const live = liveSentence(language, model.live);
  // Said only while a preview is open, and it says both halves: what is being looked at, and that
  // the reader's own committed position has not moved.
  const previewing = previewSentence(language, model.temporal.preview);

  return (
    <View
      testID={ORIENTATION_CHROME_TEST_ID}
      style={[styles.root, { paddingBottom: 12 + bottomInset }]}
      // Every touch this chrome does not itself claim reaches the world beneath it. The world stays
      // live, pannable and continuous while the chrome is on screen.
      pointerEvents="box-none"
      // Declared a non-element, and carrying NO accessibility metadata of its own. On Android an
      // `accessibilityLabel` becomes the ViewGroup's `contentDescription`, which makes TalkBack
      // focus the container and stop traversing into it — the grouping container swallowing the
      // independent controls, which is the one accessibility outcome this layer must never produce.
      // Naming a region without swallowing it needs a landmark mechanism React Native does not give
      // a non-focusable container, so the region vocabulary exists in `product-copy.ts` and waits
      // for the integration task rather than being applied here as a route that does not exist.
      accessibilityRole="none"
    >
      {/* Orientation is read, never pressed. It takes no touch at all. */}
      <View style={styles.orientation} pointerEvents="none">
        <Text testID={`${ORIENTATION_CHROME_TEST_ID}:temporal`} style={styles.line}>
          {temporalSentence(language, model.temporal)}
        </Text>
        {previewing === null ? null : (
          <Text testID={`${ORIENTATION_CHROME_TEST_ID}:preview`} style={styles.line}>
            {previewing}
          </Text>
        )}
        <Text testID={`${ORIENTATION_CHROME_TEST_ID}:spatial`} style={styles.line}>
          {spatialSentence(language, model.spatial)}
        </Text>
        {live === null ? null : (
          <Text testID={`${ORIENTATION_CHROME_TEST_ID}:live`} style={styles.line}>
            {live}
          </Text>
        )}
      </View>

      <InspectionOrientation
        store={surface.store}
        language={language}
        inspection={model.inspection}
        context={model.context}
        mapContext={current}
        onOutcome={onMapOutcome}
      />

      <ReturnControls
        surface={surface}
        language={language}
        orientation={model.returns}
        context={current}
        exactReturnTarget={exactReturnTarget}
        liveContext={liveContext}
        onOutcome={handleReturn}
        arrangement={returnArrangement}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Bottom-anchored and self-sizing. Deliberately NOT `absoluteFill`, not `flex: 1`, and with no
  // fixed height: the chrome takes the room its own words need and leaves the rest to the world.
  // Every dimension here is direction-neutral, so nothing is mirrored into a different meaning.
  root: { alignSelf: 'stretch', flexDirection: 'column', paddingHorizontal: 16, paddingTop: 12, rowGap: 12 },
  // The orientation lines read as one block, so the gap is the half-step of the 8pt rhythm rather
  // than a section break. It is the tightest value on the scale, not an off-scale one.
  orientation: { flexDirection: 'column', rowGap: 4 },
  line: { fontSize: 13, lineHeight: 21 },
});
