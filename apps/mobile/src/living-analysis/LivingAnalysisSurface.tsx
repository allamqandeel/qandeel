/**
 * S5-03B R1 — the ONE Living Analysis surface: the screen every world is analysed in.
 *
 * > **One screen. One composition. Each world brings only its projection and its capabilities.**
 *
 * Until R1 this composition existed only inside the Personal `LivingAnalysisMap`, so another world could share the
 * Map's renderer but had to build a screen of its own around it. It is now the surface's own, and it is exactly the
 * composition the Living Analysis Map always had:
 *
 *   the Analysis place — dark under every appearance preference (P1 §12.2), on the Analysis ground;
 *   the top band, drawn above the world and read first, whose measured height is the world's top inset;
 *   T-11's responsive owner — one column at every width: the world in its measured frame, then ONE support band;
 *   the support band — the world's temporal track (when the world has one) and its chrome, in the plan's room.
 *
 * What a world brings is its projection and its capabilities, and nothing of the screen:
 *
 *   `world`    — what is drawn in the measured envelope (a `WorldViewSurface` over the world's own projection);
 *   `top`      — what stands in the top band (the Personal Analysis: the way back to the Conversation);
 *   `timeline` — the disclosed temporal track and its orientation line, or `null` for a world that has no time to
 *                navigate. `null` is a capability, not an empty instrument: the plan composes `CHROME_ONLY`, and the band
 *                is what the chrome measures (SHARED-VIS-01, capped at the room every world's band has), so the
 *                world grows into whatever the chrome does not need;
 *   `chrome`   — what the world says about where the reader is, in the chrome band.
 *
 * It holds no store, no projection, no camera, no time and no words of its own. Nothing here animates: motion is the
 * world view's, entirely.
 *
 * MAP-CLOSE-01 V-3 Part B (Product Owner, 2026-11-10): a world that asks for it (`continuousWorld`) is one continuous
 * ground behind the whole screen. The frame, its envelope, the plan and every touch are unchanged; the world's own canvas
 * paints on below the frame, behind the support band, and lays the surface's own ink over the top band and the support as
 * a dark, partly transparent scrim, so the words and controls stay clear where a solid band used to end the world.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAnalysisInk } from '../analysis-visual';
import { useIncreasedContrast, withAlpha } from '../conversation/visual/theme';
import { AnalysisAppearanceScope } from '../appearance';
import { viewportEnvelope, type ViewportEnvelope } from '../map/camera';
import { WorldContinuationContext, type WorldContinuation } from '../map/renderer';
import {
  ResponsiveChromeBand,
  ResponsiveMapFrame,
  ResponsiveSupportBand,
  ResponsiveSurface,
  ResponsiveTimelineRow,
  type ChromeComposition,
  type ResponsiveInsets,
} from '../responsive';

/** The top band: drawn above the world and read first. Its owner measures it; its height is the world's top inset. */
export interface LivingAnalysisTopBand {
  readonly content: ReactNode;
  /** The band's full measured height, including the safe area it covers. */
  readonly height: number;
}

/** The temporal capability: the disclosed track's layer and the temporal orientation line said beside it. */
export interface LivingAnalysisTimeline {
  readonly line: ReactNode;
  readonly layer: ReactNode;
}

export interface LivingAnalysisSurfaceProps {
  /** The safe-area insets. With a top band, the band's height replaces the top inset. */
  readonly insets: ResponsiveInsets;
  readonly fontScale: number;
  /** The envelope this surface is presented inside; T-11 uses it to retire a stale measurement. */
  readonly envelope: { readonly width: number; readonly height: number };
  readonly top?: LivingAnalysisTopBand | null;
  /** The world, in the envelope its frame actually measured. Never called without one. */
  readonly world: (envelope: ViewportEnvelope) => ReactNode;
  readonly timeline: LivingAnalysisTimeline | null;
  /** The world's chrome, composed in the chrome band the plan allocated. */
  readonly chrome: (composition: ChromeComposition) => ReactNode;
  /** Mounted after the support band (a composition observer); never part of the layout. */
  readonly after?: ReactNode;
  /** V-3 Part B: the world runs on as one continuous ground behind the bands (default: no; the frame ends the world). */
  readonly continuousWorld?: boolean;
}

export function LivingAnalysisSurface(props: LivingAnalysisSurfaceProps) {
  return (
    <AnalysisAppearanceScope>
      <LivingAnalysisComposition {...props} />
    </AnalysisAppearanceScope>
  );
}

function LivingAnalysisComposition({ insets, fontScale, envelope: surfaceEnvelope, top = null, world, timeline, chrome, after = null, continuousWorld = false }: LivingAnalysisSurfaceProps) {
  // VPORT-02: the Analysis's own ground, under the world and the support alike. The Analysis is one dark place under
  // every appearance preference (G3 Decision A); the support band painted nothing and showed the window behind it.
  const ink = useAnalysisInk();
  // VPORT-02 (G3 Decision B): the temporal orientation line's measured height, paid for by the chrome band.
  const [lineHeight, setLineHeight] = useState(0);
  // SHARED-VIS-01 (Product Owner, Option 1): a world with no temporal track is given the band its chrome measures, so an
  // empty chrome holds no room and the world grows into it. Whole points only, so sub-point noise is never a relayout.
  const [chromeContent, setChromeContent] = useState<number | null>(null);
  // A frame resized while the camera travels is safe: the world view keeps the running travel in the new frame
  // (SHARED-VIS-01 controlled amendment to WorldCanvas), so the band follows the chrome at once.
  const onChromeContent = useCallback((height: number) => {
    const points = Math.ceil(Math.max(0, height));
    setChromeContent((current) => (current === points ? current : points));
  }, []);
  // MAP-CLOSE-01 V-3 (PO addendum, screen space): Personal's band is sized to what its two regions hold, by the same
  // rule as a world with no track — each region measured, each capped by the room it had, the world given the rest.
  const [timelineContent, setTimelineContent] = useState<number | null>(null);
  const onTimelineContent = useCallback((points: number) => {
    setTimelineContent((current) => (current === points ? current : points));
  }, []);
  const chromeOnly = timeline === null;
  const topHeight = top === null ? null : top.height;
  const surfaceInsets = useMemo(() => (topHeight === null ? insets : { ...insets, top: topHeight }), [insets, topHeight]);
  const scrim = useCallback((alpha: number) => withAlpha(ink.world, alpha), [ink.world]);
  // Under increased contrast the frame still ends the world (F1): no word stands on the world's light.
  const increased = useIncreasedContrast();
  const continuous = continuousWorld && !increased;

  const surface = (
    // T-11's own surface identity is kept: the responsive container belongs to that owner, and
    // overriding its test id would make the composition unrecognizable to the owner's own tooling.
    <ResponsiveSurface
      insets={surfaceInsets}
      fontScale={fontScale}
      envelope={surfaceEnvelope}
      support={timeline === null ? 'CHROME_ONLY' : 'TIMELINE_AND_CHROME'}
      // Under TIMELINE_AND_CHROME the chrome's room includes the temporal line it yields to the Timeline row.
      chromeContentPoints={chromeOnly ? chromeContent : chromeContent === null ? null : chromeContent + lineHeight}
      timelineContentPoints={chromeOnly ? null : timelineContent}
      style={{ backgroundColor: ink.world }}
    >
      {(plan) => {
        // Stacked, the line's room comes out of the chrome's share and never out of the world's (amendment §3
        // rules 1 and 3); across, the line sits inside the instrument's own column and takes nothing from the chrome.
        const linePoints = plan.support.arrangement === 'STACKED' ? Math.min(lineHeight, plan.support.chromePoints) : 0;
        return (
          <>
            <ResponsiveMapFrame frame={plan.mapFrame}>
              {(rect) => {
                const envelope = viewportEnvelope(rect.width, rect.height, {
                  top: rect.insetTop,
                  right: rect.insetRight,
                  bottom: rect.insetBottom,
                  left: rect.insetLeft,
                });
                // A surface that cannot be composed renders nothing rather than a guess. T-11 refuses
                // the same rects T-04's validator refuses, so this is null only when there is no rect.
                if (envelope === null) return null;
                if (!continuous) return world(envelope);
                // The frame stands at the top of the measured column, so whatever of the column lies below it is the
                // support's: that is how far the world runs on.
                const continuation: WorldContinuation = { below: Math.max(0, plan.surface.height - rect.height), scrim };
                return <WorldContinuationContext.Provider value={continuation}>{world(envelope)}</WorldContinuationContext.Provider>;
              }}
            </ResponsiveMapFrame>

            {/*
              The support regions share ONE band, and it is mounted unconditionally so that a
              measurement threshold changes a style and never an element type — a remount here would
              clear local state that a resize must not touch. Which way they sit inside it is the
              plan's decision, never this composition's.
            */}
            <ResponsiveSupportBand support={plan.support}>
              {timeline === null ? null : (
                <ResponsiveTimelineRow
                  widthPoints={plan.timelineWidthPoints}
                  paddingHorizontal={plan.chrome.paddingHorizontal}
                  support={plan.support}
                  line={timeline.line}
                  onLineHeight={setLineHeight}
                  linePoints={linePoints}
                  onContentHeight={onTimelineContent}
                >
                  {timeline.layer}
                </ResponsiveTimelineRow>
              )}

              <ResponsiveChromeBand chrome={plan.chrome} support={plan.support} yieldPoints={linePoints} onContentHeight={onChromeContent}>
                {chrome(plan.chrome)}
              </ResponsiveChromeBand>
            </ResponsiveSupportBand>
            {after}
          </>
        );
      }}
    </ResponsiveSurface>
  );

  if (top === null) return surface;
  return (
    <>
      {/*
        The band comes FIRST, so it is read first, and it is drawn above the world. The world treats
        it exactly as it treats the status bar: the band's measured height is the world's top inset,
        so T-11 keeps everything the reader must see out from under it.
      */}
      <View style={styles.band}>{top.content}</View>
      {surface}
    </>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
});
