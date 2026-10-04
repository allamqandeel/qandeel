/**
 * VPORT-02 — the Call Rail, P2 variant A "Keyed Seam", as a production component. VISUAL MACHINE ONLY.
 *
 * ## What P2 froze, and what this draws
 *
 * One machine (P2 closure §6): the microphone and the audio route are one related plate; End Call is the separated
 * terminal of the same machine, cut away along a parallel seam, at the END edge in both scripts. End Call's glyph is
 * the family's one solid call mark at a nominal 27 px inside an unchanged 44 pt target; its rank comes from geometry,
 * position, separation, terminal form and optical presence — never from a mandatory red, and never from Brass. Mute
 * and route state are carried by FORM: the slash plus a cut through the microphone; the body fill plus the wave count.
 * The geometry is generated from the merged P2-A package (`p2-production.generated.ts`).
 *
 * ## What it does NOT do — the Voice boundary
 *
 * There is no Personal Voice / Live Call runtime on `main` (`QAN-BL-VOICE-01`, `OPEN — UNASSIGNED`). This component
 * therefore knows nothing about a call. It is CONTROLLED: whether the microphone is muted, which route carries the
 * sound (or that no route is known yet), and every word it speaks are props supplied by the future call owner, and
 * every press is a callback to that owner. It has no microphone level, no speaking or listening state, no waveform and
 * no activity trace, and there is no prop through which one could be passed: a truthful speaking indicator needs real
 * audio truth, which only that runtime can provide (P2 §11.1). It invents no call copy either — the Voice and call
 * strings wait on the same runtime (P4-C2 §5).
 *
 * It is not mounted on the Product route: there is no Live Call to mount it in, and a call-shaped surface with nothing
 * behind it would be a fake. The VPORT-02 proof renders it in a validation entry only.
 */
import { Canvas, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { I18nManager, View } from 'react-native';
import { Easing, ReduceMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { Control } from '../conversation/visual/Control';
import type { ConversationPalette } from '../conversation/visual/theme';
import { QANDEEL_EASE_OUT } from '../motion/tokens';
import { P2_CALL_GLYPHS, P2_CALL_RAIL } from './p2-production.generated';

export const CALL_RAIL_TEST_ID = 'qandeel-call-rail';

/**
 * P2-A's toggle morph duration: CRAFT, not Product law (P2 closure §9 freezes no timing). The morph DRAWS a line and
 * fills a body; it neither travels nor scales, so it is kept under Reduce Motion — F1's rule keeps level, ink and
 * draw and drops travel, contraction, scale and blur (P2-A state / motion / accessibility §3).
 */
export const CALL_RAIL_MORPH_MS = 180;

const EASE_OUT = Easing.bezier(QANDEEL_EASE_OUT[0], QANDEEL_EASE_OUT[1], QANDEEL_EASE_OUT[2], QANDEEL_EASE_OUT[3]);

/** The words of the three controls, supplied by the call owner. P2 adds no call copy (P4-C2 §5). */
export interface CallRailLabels {
  /** The microphone's action while it is live, e.g. the frozen G1.2 R1 «كتم الميكروفون». */
  readonly mute: string;
  /** Its action while muted. */
  readonly unmute: string;
  readonly route: string;
  readonly endCall: string;
}

export interface CallRailProps {
  /** The palette of the surface the call line sits on: the Analysis's Dark family, or the Conversation's own. */
  readonly palette: ConversationPalette;
  readonly language: 'ar' | 'en';
  readonly labels: CallRailLabels;
  /** The call owner's truth about the microphone. Never inferred here. */
  readonly muted: boolean;
  /** The call owner's truth about the route; `null` while none is known, and the route control is then absent. */
  readonly route: 'LOUDSPEAKER' | 'EARPIECE' | null;
  readonly onToggleMute: () => void;
  readonly onToggleRoute: () => void;
  readonly onEndCall: () => void;
}

const HIDDEN = Object.freeze({
  accessible: false,
  importantForAccessibility: 'no-hide-descendants' as const,
  accessibilityElementsHidden: true,
  pointerEvents: 'none' as const,
});

/** One morph progress: set where it stands on mount, drawn to its new state on change, never invented. */
function useMorph(on: boolean) {
  const progress = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(on ? 1 : 0, { duration: CALL_RAIL_MORPH_MS, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }));
  }, [on, progress]);
  return progress;
}

function MicGlyph({ muted, ink }: { readonly muted: boolean; readonly ink: string }) {
  const { mic } = P2_CALL_GLYPHS;
  const cut = useMorph(muted);
  return (
    <View {...HIDDEN} testID={`${CALL_RAIL_TEST_ID}:mic-glyph`} style={{ width: mic.size, height: mic.size }}>
      <Canvas style={{ width: mic.size, height: mic.size }}>
        {/* The band of negative space is cut THROUGH the microphone, so muted is a broken instrument, not a line laid
            on top of a whole one. The layer keeps the cut inside this glyph. */}
        <Group layer>
          <RoundedRect
            x={mic.capsule.x}
            y={mic.capsule.y}
            width={mic.capsule.width}
            height={mic.capsule.height}
            r={mic.capsule.r}
            style="stroke"
            strokeWidth={mic.strokeWidth}
            color={ink}
          />
          <Path path={mic.cradle} style="stroke" strokeWidth={mic.strokeWidth} strokeCap="round" strokeJoin="round" color={ink} />
          <Path path={mic.slash} style="stroke" strokeWidth={mic.cutbandWidth} strokeCap="round" blendMode="clear" color={ink} start={0} end={cut} />
        </Group>
        <Path path={mic.slash} style="stroke" strokeWidth={mic.strokeWidth} strokeCap="round" color={ink} start={0} end={cut} />
      </Canvas>
    </View>
  );
}

function RouteGlyph({ loudspeaker, ink }: { readonly loudspeaker: boolean; readonly ink: string }) {
  const { route } = P2_CALL_GLYPHS;
  const on = useMorph(loudspeaker);
  return (
    <View {...HIDDEN} testID={`${CALL_RAIL_TEST_ID}:route-glyph`} style={{ width: route.size, height: route.size }}>
      <Canvas style={{ width: route.size, height: route.size }}>
        {/* Two carriers for one state: the body fills, and the second wave draws. The earpiece keeps ONE wave,
            because sound still plays there — no wave at all would read as mute. */}
        <Path path={route.body} style="fill" color={ink} opacity={on} />
        <Path path={route.body} style="stroke" strokeWidth={route.strokeWidth} strokeJoin="round" color={ink} />
        <Path path={route.innerWave} style="stroke" strokeWidth={route.strokeWidth} strokeCap="round" color={ink} />
        <Path path={route.outerWave} style="stroke" strokeWidth={route.strokeWidth} strokeCap="round" color={ink} start={0} end={on} />
      </Canvas>
    </View>
  );
}

function EndCallGlyph({ ink }: { readonly ink: string }) {
  const { endCall, grid } = P2_CALL_GLYPHS;
  // The same solid handset on the same 24-unit grid, scaled to 27 px: a solid mark has no stroke to re-weight.
  return (
    <View {...HIDDEN} testID={`${CALL_RAIL_TEST_ID}:end-glyph`} style={{ width: endCall.size, height: endCall.size }}>
      <Canvas style={{ width: endCall.size, height: endCall.size }}>
        <Group transform={[{ scale: endCall.size / grid }]}>
          <Path path={endCall.d} style="fill" color={ink} />
        </Group>
      </Canvas>
    </View>
  );
}

/** The rail art: one hairline piece, laid out from the END edge and mirrored as LAYOUT under right-to-left. */
function ArtPiece({ piece, ink, rtl, testID }: { readonly piece: typeof P2_CALL_RAIL.group | typeof P2_CALL_RAIL.terminal; readonly ink: string; readonly rtl: boolean; readonly testID: string }) {
  return (
    <View
      {...HIDDEN}
      testID={testID}
      style={{ position: 'absolute', end: piece.end, top: piece.top, width: piece.width, height: piece.height, transform: rtl ? [{ scaleX: -1 }] : undefined }}
    >
      <Canvas style={{ width: piece.width, height: piece.height }}>
        <Path path={piece.d} style="stroke" strokeWidth={piece.strokeWidth} strokeCap="round" strokeJoin="round" color={ink} />
      </Canvas>
    </View>
  );
}

const TARGET_TOP = (P2_CALL_RAIL.lineHeight - 44) / 2;

export function CallRail({ palette, language, labels, muted, route, onToggleMute, onToggleRoute, onEndCall }: CallRailProps) {
  const rtl = I18nManager.isRTL;
  const { slots, group, terminal } = P2_CALL_RAIL;
  const slot = (place: { readonly end: number; readonly width: number }) => ({ position: 'absolute' as const, end: place.end, top: TARGET_TOP, width: place.width, height: place.width, alignItems: 'center' as const });
  return (
    <View
      testID={CALL_RAIL_TEST_ID}
      // The rail's whole footprint, measured from the END edge: the group's far side. It never grows with its content.
      style={{ width: group.end + group.width, height: P2_CALL_RAIL.lineHeight }}
    >
      {/* The neutral tertiary hairline: one plate, keyed and broken. No tone fill, no second Surface. */}
      <ArtPiece piece={group} ink={palette.tertiary} rtl={rtl} testID={`${CALL_RAIL_TEST_ID}:group`} />
      <ArtPiece piece={terminal} ink={palette.tertiary} rtl={rtl} testID={`${CALL_RAIL_TEST_ID}:terminal`} />

      {route === null ? null : (
        <Control
          palette={palette}
          language={language}
          accessibilityRole="togglebutton"
          accessibilityLabel={labels.route}
          accessibilityState={{ checked: route === 'LOUDSPEAKER' }}
          onPress={onToggleRoute}
          testID={`${CALL_RAIL_TEST_ID}:route`}
          style={slot(slots.route)}
        >
          <RouteGlyph loudspeaker={route === 'LOUDSPEAKER'} ink={palette.restInk} />
        </Control>
      )}
      <Control
        palette={palette}
        language={language}
        accessibilityRole="togglebutton"
        accessibilityLabel={muted ? labels.unmute : labels.mute}
        accessibilityState={{ checked: muted }}
        onPress={onToggleMute}
        testID={`${CALL_RAIL_TEST_ID}:mic`}
        style={slot(slots.mic)}
      >
        <MicGlyph muted={muted} ink={palette.restInk} />
      </Control>
      {/* The terminal act: primary ink and the one solid mark. No red — no canonical grant exists for one — and no Brass. */}
      <Control
        palette={palette}
        language={language}
        accessibilityLabel={labels.endCall}
        onPress={onEndCall}
        testID={`${CALL_RAIL_TEST_ID}:end`}
        style={slot(slots.end)}
      >
        <EndCallGlyph ink={palette.primary} />
      </Control>
    </View>
  );
}
