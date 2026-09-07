/**
 * T-10.0 MOTION LAB — one entitled object on the plane, with its presence choreography.
 *
 * A node owns exactly the presentation values of its own arrival and departure: opacity, how far
 * it has unfolded from its host, its size resolve, and the prototype-only Ignition cue. Its
 * canonical position is a prop from T-04's placement and never a shared value; what animates is
 * the path from the host Home to that position, never the position itself.
 *
 * The visuals are deliberately neutral placeholders in warm greys (the graphic language is
 * VI-03's, still open). The one chromatic value is the brass of the Ignition hypothesis, used for
 * nothing else — never as a status, an availability or a permanent glow.
 */
import { useLayoutEffect } from 'react';
import { Circle, Line, vec } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withDelay, withSequence, type DerivedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { PresentedNode } from '../motion/world-presence';
import type { MotionProfile } from '../motion/profiles';
import { fadeTo, settleTo } from '../motion/settle';

export const LAB_INK = 'rgb(47,46,43)';
export const LAB_APPEARANCE = 'rgb(112,109,102)';
export const LAB_REGISTER = 'rgb(154,150,142)';
export const LAB_TETHER = 'rgb(201,197,187)';
/** Living Brass — the Ignition hypothesis only. */
export const LAB_BRASS = 'rgb(185,144,62)';

export interface LabNodeProps {
  readonly entry: PresentedNode;
  readonly profile: MotionProfile;
  /** `1 / zoom`: keeps a node the same size on screen while the plane carries a residual zoom. */
  readonly inverseScale: DerivedValue<number>;
  /** Plane speed, points per second; drives the field breath when the profile asks for it. */
  readonly speed: SharedValue<number>;
  /** Arrival breath after a travel, `0`…`1` (C). */
  readonly arrival: SharedValue<number>;
  readonly inspected: boolean;
  readonly ignitionEnabled: boolean;
  /** A ripple reaching this node: a token that changes per ignition, and the delay by distance. */
  readonly ripple: { readonly token: number; readonly delayMs: number } | null;
  /** Whether the node is drawn inside the scaled world plane (a register entry is screen space). */
  readonly inPlane: boolean;
  readonly onExited: (key: string) => void;
}

export function LabNode({ entry, profile, inverseScale, speed, arrival, inspected, ignitionEnabled, ripple, inPlane, onExited }: LabNodeProps) {
  const { node, host, recipe, phase, enterOrdinal, entryToken, ignite, key } = entry;
  const initial = phase === 'PRESENT';
  const presence = useSharedValue(initial ? 1 : 0);
  const slide = useSharedValue(initial ? 1 : recipe.enter === 'from-host' ? 0 : 1);
  const grow = useSharedValue(initial ? 1 : recipe.enter === 'fade' ? 1 : recipe.enter === 'from-host' ? 0.6 : 0.9);
  const ignition = useSharedValue(0);
  const rippleBreath = useSharedValue(0);

  // Arrival. Runs once per entry token, in a layout effect so the first drawn frame already carries
  // the start of the choreography rather than a fully present node that then blinks.
  useLayoutEffect(() => {
    if (phase !== 'ENTERING') return;
    const delay = enterOrdinal * recipe.staggerMs;
    switch (recipe.enter) {
      case 'fade':
        slide.set(1);
        grow.set(1);
        presence.set(withDelay(delay, fadeTo(1, recipe.enterMs)));
        break;
      case 'in-place':
        slide.set(1);
        presence.set(withDelay(delay, fadeTo(1, recipe.enterMs)));
        grow.set(withDelay(delay, settleTo(1, recipe.enterSettle, 0)));
        break;
      case 'from-host':
        presence.set(withDelay(delay, fadeTo(1, recipe.enterMs)));
        slide.set(withDelay(delay, settleTo(1, recipe.enterSettle, 0)));
        grow.set(withDelay(delay, settleTo(1, recipe.enterSettle, 0)));
        break;
      default:
        break;
    }
    if (ignite && ignitionEnabled) {
      // Meaning Ignition (hypothesis): once, locally, when this identity legitimately became known
      // through a live advance. Never on a tap, never on a scrub, never on a return.
      ignition.set(withDelay(delay + 80, withSequence(fadeTo(1, 140), fadeTo(0, profile.ignition.durationMs))));
    }
    // The choreography belongs to the entry token; the recipe and profile are captured with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryToken, phase]);

  // Departure. Temporal departures never reach here (they are removed on the next frame by the
  // presence set); a depth departure may fade or fold back into its host, then removes itself.
  useLayoutEffect(() => {
    if (phase !== 'EXITING') return;
    const finish = (finished?: boolean) => {
      'worklet';
      if (finished === true) scheduleOnRN(onExited, key);
    };
    if (recipe.exit === 'to-host') {
      slide.set(settleTo(0, { kind: 'timing', durationMs: recipe.exitMs }, 0));
      grow.set(settleTo(0.6, { kind: 'timing', durationMs: recipe.exitMs }, 0));
      presence.set(fadeTo(0, recipe.exitMs, finish));
      return;
    }
    presence.set(fadeTo(0, recipe.exit === 'fade' ? recipe.exitMs : 0, finish));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // A ripple (C only): a neighbour's size breathes once, later the further away it is.
  useLayoutEffect(() => {
    if (ripple === null || profile.ignition.rippleBreath <= 0 || !ignitionEnabled) return;
    rippleBreath.set(withDelay(ripple.delayMs, withSequence(fadeTo(1, 120), settleTo(0, { kind: 'spring', durationMs: 460, dampingRatio: 0.7, carriesVelocity: false }, 0))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ripple?.token]);

  const baseRadius = node.radius;
  const velocityBreath = profile.field.velocityBreath;
  const arrivalBreath = profile.field.arrivalBreath;
  const rippleAmount = profile.ignition.rippleBreath;

  // The canonical position and the host position travel as shared values, written in a layout
  // effect: the plane's re-based residual is written in a layout effect of the same commit, so the
  // renderer sees a new position and its residual together and never paints one without the other.
  const px = useSharedValue(node.x);
  const py = useSharedValue(node.y);
  const hx = useSharedValue(host.x);
  const hy = useSharedValue(host.y);
  useLayoutEffect(() => {
    px.set(node.x);
    py.set(node.y);
    hx.set(host.x);
    hy.set(host.y);
  }, [node.x, node.y, host.x, host.y, px, py, hx, hy]);

  // A contextual appearance's slot is a presentation offset in POINTS from its host Home (T-04: it
  // is not geography). The plane's residual zoom must scale canonical positions and nothing else, so
  // the slot offset is counter-scaled here: it reads the same size on screen whatever the residual.
  const counter = inPlane ? inverseScale : null;
  const cx = useDerivedValue(() => hx.get() + (px.get() - hx.get()) * slide.get() * (counter === null ? 1 : counter.get()), [counter]);
  const cy = useDerivedValue(() => hy.get() + (py.get() - hy.get()) * slide.get() * (counter === null ? 1 : counter.get()), [counter]);
  const tetherStart = useDerivedValue(() => vec(hx.get(), hy.get()));
  const radius = useDerivedValue(() => {
    const breath = 1 + velocityBreath * Math.min(speed.get() / 1000, 1) + arrivalBreath * arrival.get() + rippleAmount * rippleBreath.get();
    return baseRadius * (counter === null ? 1 : counter.get()) * Math.max(0.05, grow.get()) * breath;
  }, [baseRadius, velocityBreath, arrivalBreath, rippleAmount, counter]);
  const opacity = useDerivedValue(() => Math.min(1, Math.max(0, presence.get())));
  const tetherOpacity = useDerivedValue(() => Math.min(1, Math.max(0, presence.get())) * 0.9);
  const tetherEnd = useDerivedValue(() => vec(cx.get(), cy.get()));
  const inspectedRadius = useDerivedValue(() => radius.get() + 5 * (counter === null ? 1 : counter.get()), [counter]);
  const strokeWidth = useDerivedValue(() => 1.5 * (counter === null ? 1 : counter.get()), [counter]);
  const ignitionRingRadius = useDerivedValue(() => radius.get() + (5 + 16 * ignition.get()) * (counter === null ? 1 : counter.get()), [counter]);
  const ignitionRingOpacity = useDerivedValue(() => ignition.get() * 0.9);
  const bloomRadius = useDerivedValue(() => radius.get() * (1.4 + 0.8 * ignition.get()));
  const bloomOpacity = useDerivedValue(() => (profile.ignition.style === 'bloom' ? ignition.get() * 0.3 : 0), [profile.ignition.style]);

  const isAppearance = node.region === 'WORLD_PLANE' && node.locus !== null && node.locus.kind === 'CONTEXTUAL_APPEARANCE';
  const fill = node.region === 'UNGEOGRAPHIC_REGISTER' ? LAB_REGISTER : node.locus?.kind === 'THREAD_HOME' ? LAB_INK : LAB_APPEARANCE;

  return (
    <>
      {isAppearance ? <Line p1={tetherStart} p2={tetherEnd} color={LAB_TETHER} strokeWidth={strokeWidth} opacity={tetherOpacity} /> : null}
      <Circle cx={cx} cy={cy} r={bloomRadius} color={LAB_BRASS} opacity={bloomOpacity} />
      <Circle cx={cx} cy={cy} r={radius} color={fill} opacity={opacity} />
      {inspected ? <Circle cx={cx} cy={cy} r={inspectedRadius} color={LAB_INK} style="stroke" strokeWidth={strokeWidth} opacity={opacity} /> : null}
      <Circle cx={cx} cy={cy} r={ignitionRingRadius} color={LAB_BRASS} style="stroke" strokeWidth={strokeWidth} opacity={ignitionRingOpacity} />
    </>
  );
}
