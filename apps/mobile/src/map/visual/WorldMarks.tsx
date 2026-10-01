/**
 * VPORT-01 — the world's analytical inhabitants, in the canonical I-08B1 object and connection grammar.
 *
 * Three things are drawn here, and each is the expression of a fact the Map already holds:
 *
 *   `WorldObject`   one placed locus on the world plane — a Thread's Home (major tier: a cleared local
 *                   ground, the medium's light around it, the THREAD morphology) or a contextual
 *                   appearance (minor tier: the READING morphology, a smaller light, no ground of its
 *                   own — it lives inside its Home's place);
 *   `WorldTether`   the hosting relation between a contextual appearance and its Home, in the
 *                   canonical connection grammar: a dark local ground under a luminous core whose
 *                   brightest light is along its span. It is the ONLY relation drawn, because it is the
 *                   only relation the production Map holds;
 *   `RegisterMark`  an ungeographic identity, in screen space: its morphology and nothing else. No
 *                   ground and no light — the world makes room for a place, and this has none.
 *
 * SELECTED (E1R): the inspected object carries the frozen selected ink and an ATTACHED marker — a ring
 * hugging its mark at the frozen marker thickness — so the state is a shape, never a colour alone.
 * The marker sits inside the T-04 hit radius of the same placement.
 *
 * Nothing here varies per object except what the object IS (family, placement) and whether it is the
 * one being inspected. Every light, size and alpha is constant per tier.
 */
import { Circle, Group, LinearGradient, Path, RadialGradient, vec } from '@shopify/react-native-skia';
import { useReadingOf, type DerivedValue } from '../../motion';

import type { MapObjectFamily } from '../projection';
import { APPEARANCE_RADIUS_POINTS, HOME_RADIUS_POINTS, REGISTER_RADIUS_POINTS } from '../renderer/map-geometry';
import type { WorldResponse } from './useWorldResponse';
import { WORLD_VISUAL } from './world-visual.generated';
import {
  MARK_RADIUS_POINTS,
  SHADE_GRADIENT,
  falloff,
  hexRgba,
  hsla,
  markMaterial,
  mediumHue,
  morphologyPath,
  presentationRotation,
  tierOf,
  worldPalette,
  type WorldContrast,
  type WorldPlacement,
  type WorldSchedule,
} from './world-resolver';

const V = WORLD_VISUAL;
const GROUND_WIDTH = WORLD_VISUAL.material.relGnd.w;
const BODY_WIDTH = WORLD_VISUAL.relation.body.width;

/** The T-04 hit radius of each placement: nothing painted for an object may reach beyond it. */
const HIT_RADIUS: Readonly<Record<WorldPlacement, number>> = {
  THREAD_HOME: HOME_RADIUS_POINTS,
  CONTEXTUAL_APPEARANCE: APPEARANCE_RADIUS_POINTS,
  UNGEOGRAPHIC: REGISTER_RADIUS_POINTS,
};

/**
 * The radius of the attached SELECTED marker: just outside the mark's widest extent (the canonical
 * morphologies reach 1.42 r), and never past the hit radius, so the state is drawn on the object a tap
 * selects and nowhere else.
 */
export function markerRadius(placement: WorldPlacement, thickness: number): number {
  return Math.min(MARK_RADIUS_POINTS[placement] * 1.42 + 2, HIT_RADIUS[placement] - thickness / 2);
}

function SelectedMarker({ x, y, placement, contrast }: { x: number; y: number; placement: WorldPlacement; contrast: WorldContrast }) {
  const palette = worldPalette(contrast);
  return <Circle cx={x} cy={y} r={markerRadius(placement, palette.markerThickness)} style="stroke" strokeWidth={palette.markerThickness} color={palette.selectedMarker} />;
}

/** The mark itself: the family's canonical morphology, filled, or stroked for the open slot. */
function Mark({
  family,
  nodeKey,
  x,
  y,
  placement,
  S,
  contrast,
  selected,
}: {
  family: MapObjectFamily;
  nodeKey: string;
  x: number;
  y: number;
  placement: WorldPlacement;
  S: WorldSchedule;
  contrast: WorldContrast;
  selected: boolean;
}) {
  const r = MARK_RADIUS_POINTS[placement];
  const tier = tierOf(placement);
  const material = markMaterial(tier, S, contrast === 'increased');
  const palette = worldPalette(contrast);
  const path = morphologyPath(family, x, y, r, presentationRotation(nodeKey));
  // SELECTED: the frozen selected ink. REST: the world's own material.
  const ink = selected ? palette.selectedInk : material.fill;
  const stroked = V.shapes[family].stroked;
  // The mark's ANCHOR: a group carrying only its origin, so what a reader of the paint can locate is
  // the object's own placed point, never a centre reconstructed from a drawn outline.
  return (
    <Group origin={vec(x, y)}>
      {stroked ? (
        <Path path={path} style="stroke" strokeWidth={Math.max(1, r * 0.42)} strokeCap="round" color={ink} />
      ) : (
        <Path path={path} color={ink} />
      )}
    </Group>
  );
}

export interface WorldObjectProps {
  readonly family: MapObjectFamily;
  readonly nodeKey: string;
  readonly x: number;
  readonly y: number;
  readonly placement: Exclude<WorldPlacement, 'UNGEOGRAPHIC'>;
  readonly S: WorldSchedule;
  readonly response: WorldResponse;
  readonly contrast: WorldContrast;
  readonly selected: boolean;
}

/** A light around a body: one canonical falloff, one tier weight. */
function Light({ x, y, r, profile, hue, lightness, opacity }: { x: number; y: number; r: number; profile: 'wide' | 'soft' | 'core'; hue: number; lightness: number; opacity: DerivedValue<number> | number }) {
  const f = falloff(profile, hue, profile === 'core' ? V.mark.haloSat * V.mark.coreSatShare : V.mark.haloSat, lightness);
  return (
    <Group opacity={opacity}>
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x, y)} r={r} colors={f.colors} positions={f.positions} />
      </Circle>
    </Group>
  );
}

export function WorldObject({ family, nodeKey, x, y, placement, S, response, contrast, selected }: WorldObjectProps) {
  const r = MARK_RADIUS_POINTS[placement];
  const tier = tierOf(placement);
  const m = V.mark[tier];
  const material = markMaterial(tier, S, contrast === 'increased');
  const hue = mediumHue(S.lod);
  const rotation = presentationRotation(nodeKey);
  const limbAngle = rotation * V.shapes[family].rotation;
  const lx = Math.cos(limbAngle);
  const ly = Math.sin(limbAngle);
  const limbPath = morphologyPath(family, x, y, r, rotation);
  return (
    <>
      {/* The place the world makes for a Home: a subtractive local ground, major tier only (§14). */}
      {tier === 'major' ? (
        <Group opacity={response.groundMajor}>
          <Circle cx={x} cy={y} r={r * V.material.objGnd.r}>
            <RadialGradient c={vec(x, y)} r={r * V.material.objGnd.r} colors={SHADE_GRADIENT.colors} positions={SHADE_GRADIENT.positions} />
          </Circle>
        </Group>
      ) : null}
      {/* The medium's light around the body, and at NEAR its wider atmosphere. Constant per tier. */}
      <Light x={x} y={y} r={r * m.halo} profile="wide" hue={hue} lightness={V.mark.haloLight} opacity={tier === 'major' ? response.haloMajor : response.haloMinor} />
      <Light x={x} y={y} r={r * m.haloWide} profile="soft" hue={hue} lightness={V.mark.haloWideLight} opacity={tier === 'major' ? response.haloWideMajor : response.haloWideMinor} />
      <Mark family={family} nodeKey={nodeKey} x={x} y={y} placement={placement} S={S} contrast={contrast} selected={selected} />
      {/* NEAR: a lit limb and a luminous interior, so the shape bounds a body (§14, WS7R-V §V4b). With no
          runtime focus to face, the limb faces the mark's own presentation angle, as the canonical
          painter does when there is no focus. */}
      <Group opacity={response.near}>
        <Path path={limbPath} style="stroke" strokeWidth={r * V.mark.limbWidth}>
          <LinearGradient
            start={vec(x + lx * r * 1.15, y + ly * r * 1.15)}
            end={vec(x - lx * r * 1.15, y - ly * r * 1.15)}
            colors={[
              hsla(V.worldHue, Math.min(100, material.saturation * 1.12), material.light + 4, material.alpha * V.mark.limbShare),
              hsla(V.worldHue, Math.min(100, material.saturation * 1.02), material.light - 2, material.alpha * V.mark.limbShare * 0.3),
              hsla(V.worldHue, material.saturation, material.light, 0),
            ]}
            positions={[0, 0.38, 1]}
          />
        </Path>
        <Light x={x} y={y} r={r * m.core} profile="core" hue={V.worldHue} lightness={Math.min(90, material.light + 2)} opacity={material.alpha * m.coreAlpha} />
      </Group>
      {selected ? <SelectedMarker x={x} y={y} placement={placement} contrast={contrast} /> : null}
    </>
  );
}

export interface WorldTetherProps {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly S: WorldSchedule;
  readonly response: WorldResponse;
  readonly contrast: WorldContrast;
  /** The counter-scale, so the stroke stays the same number of points on the glass at every rung. */
  readonly strokeScale: DerivedValue<number>;
}

/**
 * The hosting relation in the canonical connection grammar (§13): its local ground, its NEAR body and
 * its core, whose light is along the span at NEAR and at the ends at FAR and MID. It is drawn straight
 * because the T-10 arrival travels along the straight line between the same two points, and the
 * renderer may not show a path the arrival does not take.
 */
export function WorldTether({ fromX, fromY, toX, toY, S, response, contrast, strokeScale }: WorldTetherProps) {
  const rel = V.relation;
  const width = V.material.rel.w * S.relBead * S.relW * rel.widthScale;
  const alpha = V.material.rel.a * S.rel;
  const hue = mediumHue(S.lod);
  const p1 = vec(fromX, fromY);
  const p2 = vec(toX, toY);
  const path = `M ${fromX} ${fromY} L ${toX} ${toY}`;
  const groundAlpha = Math.min(V.material.relGnd.max, alpha * V.material.relGnd.a * V.material.relGnd.k);
  const eA = 1 + (rel.endAlpha[1] - rel.endAlpha[0]) * S.lod;
  const mA = rel.middleAlpha[0] + (rel.middleAlpha[1] - rel.middleAlpha[0]) * S.lod;
  // Screen quantities: counter-scaled with the plane's residual zoom, exactly as the objects are.
  const groundWidth = useReadingOf(strokeScale, (k) => {
    'worklet';
    return width * GROUND_WIDTH * k;
  });
  const bodyWidth = useReadingOf(strokeScale, (k) => {
    'worklet';
    return width * BODY_WIDTH * k;
  });
  const coreWidth = useReadingOf(strokeScale, (k) => {
    'worklet';
    return width * k;
  });
  const increased = contrast === 'increased';
  const palette = worldPalette(contrast);
  // F1, increased contrast: the analytical relation moves up one rung and draws at full opacity. The
  // atmosphere does not move, so the ratio between them widens — "high contrast is not high importance".
  const core = increased
    ? { colors: [hexRgba(palette.analysisRelation, 1), hexRgba(palette.analysisRelation, 1), hexRgba(palette.analysisRelation, 1)] }
    : {
        colors: [
          hsla(hue, rel.end.sat, rel.end.light, alpha * eA),
          hsla(hue, rel.middle.sat + rel.middle.satNear * S.lod, rel.middle.light + rel.middle.lightNear * S.lod, Math.min(1, alpha * mA)),
          hsla(hue, rel.end.sat, rel.end.light, alpha * eA),
        ],
      };
  return (
    <>
      <Group opacity={response.relationGround}>
        <Path path={path} style="stroke" strokeWidth={groundWidth} strokeCap="round" color={`rgba(${rel.ground.rgb.join(',')},${groundAlpha})`} />
      </Group>
      <Group opacity={response.relationBody}>
        <Path path={path} style="stroke" strokeWidth={bodyWidth} strokeCap="round" color={hsla(hue, rel.body.sat, rel.body.light, Math.min(rel.body.max, alpha * rel.body.share))} />
      </Group>
      <Path path={path} style="stroke" strokeWidth={coreWidth} strokeCap="round">
        <LinearGradient start={p1} end={p2} colors={core.colors} positions={[0, 0.5, 1]} />
      </Path>
    </>
  );
}

export interface RegisterMarkProps {
  readonly family: MapObjectFamily;
  readonly nodeKey: string;
  readonly x: number;
  readonly y: number;
  readonly S: WorldSchedule;
  readonly contrast: WorldContrast;
  readonly selected: boolean;
}

/** An ungeographic identity: its morphology in screen space, with no ground and no light of a place. */
export function RegisterMark({ family, nodeKey, x, y, S, contrast, selected }: RegisterMarkProps) {
  return (
    <>
      <Mark family={family} nodeKey={nodeKey} x={x} y={y} placement="UNGEOGRAPHIC" S={S} contrast={contrast} selected={selected} />
      {selected ? <SelectedMarker x={x} y={y} placement="UNGEOGRAPHIC" contrast={contrast} /> : null}
    </>
  );
}
