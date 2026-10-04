/**
 * VPORT-02 — the Temporal Spine + Aperture, P2 variant C "Parting", as production drawings.
 *
 * P2 froze the MORPHOLOGY (closure §7): a quiet neutral spine, one notch per disclosed Moment, an aperture that is the
 * spine itself opening at the Moment — committed and preview distinguishable, the preview lighter and with no committed
 * mark — and a Live Edge terminal that shares no form with a Moment. It froze no temporal semantic: every position,
 * every stance and every act stays with T-05 / T-06 / T-07, and nothing in this file knows a Moment, a mode or a store.
 * These components are told what to draw and where, and draw it.
 *
 * The geometry is generated from the merged P2-A package (`p2-production.generated.ts`). Its dimensions are reference
 * craft values; the 48-point step and the 44-point band are T-05's.
 *
 * Every drawing here is decorative: the accessible names, values and actions belong to the controls and the
 * navigators that already own them, so each canvas is hidden from the accessibility tree and takes no touch.
 */
import { Canvas, Path, Rect, RoundedRect } from '@shopify/react-native-skia';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { P2_SPINE } from './p2-production.generated';

const HIDDEN = Object.freeze({
  accessible: false,
  importantForAccessibility: 'no-hide-descendants' as const,
  accessibilityElementsHidden: true,
  pointerEvents: 'none' as const,
});

export interface ApertureProps {
  /** `COMMITTED` is PINNED(t)'s opening, with its mark; `PREVIEW` is a lighter opening with no mark. */
  readonly kind: 'COMMITTED' | 'PREVIEW';
  /** The aperture's ink: primary. Its weight, not a second colour, tells committed from preview. */
  readonly ink: string;
  /**
   * The ground the spine runs on. The opening is drawn by parting the spine, so the short run of hairline inside it is
   * covered with the ground it already sits on — the line opens; nothing is laid on top of it.
   */
  readonly ground: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/** One Parting aperture in its own frame: 34 wide, 44 high, the Moment at its centre, the spine on its axis. */
export function Aperture({ kind, ink, ground, style, testID }: ApertureProps) {
  const { aperture, axisY, bandPoints, spine } = P2_SPINE;
  const drawing = kind === 'COMMITTED' ? aperture.committed : aperture.preview;
  return (
    <View {...HIDDEN} testID={testID} style={[{ width: aperture.frameWidth, height: bandPoints }, style]}>
      <Canvas style={{ width: aperture.frameWidth, height: bandPoints }}>
        <Rect x={0} y={axisY - spine.strokeWidth} width={aperture.frameWidth} height={2 * spine.strokeWidth} color={ground} />
        <Path path={drawing.d} style="stroke" strokeWidth={drawing.strokeWidth} strokeCap="round" strokeJoin="round" color={ink} />
        {kind === 'COMMITTED' ? (
          <RoundedRect
            x={aperture.committed.mark.x}
            y={aperture.committed.mark.y}
            width={aperture.committed.mark.width}
            height={aperture.committed.mark.height}
            r={aperture.committed.mark.r}
            color={ink}
          />
        ) : null}
      </Canvas>
    </View>
  );
}

export interface LiveTerminalProps {
  /** ENGAGED while following Live; AVAILABLE while PINNED. A state of the terminal's FORM, not only of its ink. */
  readonly engaged: boolean;
  /** Primary when engaged, the rest ink when available. */
  readonly ink: string;
  /**
   * The terminal's local frame grows toward the END edge, so under a right-to-left layout it mirrors as LAYOUT, the
   * same way T-06's one mirror rule mirrors the spine. It is never a semantic flip of a glyph.
   */
  readonly rtl: boolean;
  readonly testID?: string;
}

/**
 * The Live Edge terminal: a stop bar where disclosed time ends, and beyond it the present as a short line of its own —
 * heavy while following Live, a hairline while pinned. No curve and no core, so it can never be read as a Moment's
 * opening. It is never icon-only: its words are the Live control's own label, which stays visible beside it (T-12).
 */
export function LiveTerminal({ engaged, ink, rtl, testID }: LiveTerminalProps) {
  const { terminal } = P2_SPINE;
  const present = engaged ? terminal.present.engagedStrokeWidth : terminal.present.availableStrokeWidth;
  return (
    <View {...HIDDEN} testID={testID} style={{ width: terminal.frame, height: terminal.frame, transform: rtl ? [{ scaleX: -1 }] : undefined }}>
      <Canvas style={{ width: terminal.frame, height: terminal.frame }}>
        <Path path={terminal.stop.d} style="stroke" strokeWidth={terminal.stop.strokeWidth} strokeCap="round" color={ink} />
        <Path path={terminal.present.d} style="stroke" strokeWidth={present} strokeCap="round" color={ink} />
      </Canvas>
    </View>
  );
}
