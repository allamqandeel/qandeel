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
import { BlurMask, Circle, FractalNoise, Group, LinearGradient, Path, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { useReadingOf, type DerivedValue } from '../../motion';

import type { MapObjectFamily } from '../projection';
import { APPEARANCE_RADIUS_POINTS, HOME_RADIUS_POINTS, REGISTER_RADIUS_POINTS } from '../renderer/map-geometry';
import type { WorldResponse } from './useWorldResponse';
import { WORLD_VISUAL } from './world-visual.generated';
import { ladderHue } from './WorldStrata';
import type { ChromaFamily } from './world-chroma';
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
  type WorldTier,
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

function SelectedMarker({ x, y, r, contrast }: { x: number; y: number; r: number; contrast: WorldContrast }) {
  const palette = worldPalette(contrast);
  return <Circle cx={x} cy={y} r={r} style="stroke" strokeWidth={palette.markerThickness} color={palette.selectedMarker} />;
}

/** The body of a mark: its shape, filled, or stroked for the open slot. */
function MarkBody({ x, y, r, path, stroked, ink }: { x: number; y: number; r: number; path: string; stroked: boolean; ink: string }) {
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
  return <MarkBody x={x} y={y} r={r} path={path} stroked={V.shapes[family].stroked} ink={ink} />;
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
function Light({ x, y, r, profile, hue, lightness, opacity }: { x: number; y: number; r: number; profile: 'wide' | 'soft' | 'core' | 'point'; hue: number; lightness: number; opacity: DerivedValue<number> | number }) {
  const f = falloff(profile, hue, profile === 'core' ? V.mark.haloSat * V.mark.coreSatShare : V.mark.haloSat, lightness);
  return (
    <Group opacity={opacity}>
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x, y)} r={r} colors={f.colors} positions={f.positions} />
      </Circle>
    </Group>
  );
}

/**
 * S5-03B Phase 1 — the SHAPE a mark is drawn in, kept apart from its MATERIAL. A family's morphology is one
 * shape; the material around it (the tier's ground, light, NEAR limb and core, and the attached SELECTED marker)
 * is the world's own and is the same for every shape. `path` is the body and the NEAR limb; `stroked` draws the
 * open slot; `limbAngle` is the presentation angle the lit limb faces.
 */
export interface WorldMarkShape {
  readonly path: string;
  readonly stroked: boolean;
  readonly limbAngle: number;
}

export interface WorldMarkProps {
  readonly x: number;
  readonly y: number;
  /** The mark radius, in points (constant per tier). */
  readonly r: number;
  readonly tier: WorldTier;
  /** The radius of the attached SELECTED marker, inside the hit radius of the same placement. */
  readonly markerRadius: number;
  readonly shape: WorldMarkShape;
  readonly S: WorldSchedule;
  readonly response: WorldResponse;
  readonly contrast: WorldContrast;
  readonly selected: boolean;
}

/** One placed locus of the Personal world: its family's morphology, in the world's material. */
export function WorldObject({ family, nodeKey, x, y, placement, S, response, contrast, selected }: WorldObjectProps) {
  const r = MARK_RADIUS_POINTS[placement];
  const rotation = presentationRotation(nodeKey);
  const shape: WorldMarkShape = {
    path: morphologyPath(family, x, y, r, rotation),
    stroked: V.shapes[family].stroked,
    limbAngle: rotation * V.shapes[family].rotation,
  };
  return (
    <WorldMark
      x={x}
      y={y}
      r={r}
      tier={tierOf(placement)}
      markerRadius={markerRadius(placement, worldPalette(contrast).markerThickness)}
      shape={shape}
      S={S}
      response={response}
      contrast={contrast}
      selected={selected}
    />
  );
}

/** One mark in the world's material, in any shape: constant per tier, nothing about it varies per object. */
export function WorldMark({ x, y, r, tier, markerRadius: marker, shape, S, response, contrast, selected }: WorldMarkProps) {
  const m = V.mark[tier];
  const material = markMaterial(tier, S, contrast === 'increased');
  const palette = worldPalette(contrast);
  const hue = mediumHue(S.lod);
  const lx = Math.cos(shape.limbAngle);
  const ly = Math.sin(shape.limbAngle);
  return (
    <>
      {/* The place the world makes for a place: a subtractive local ground, major tier only (§14). */}
      {tier === 'major' ? (
        <Group opacity={response.groundMajor}>
          <Group opacity={BLOOM.clearing}>
            <Circle cx={x} cy={y} r={r * V.material.objGnd.r}>
              <RadialGradient c={vec(x, y)} r={r * V.material.objGnd.r} colors={SHADE_GRADIENT.colors} positions={SHADE_GRADIENT.positions} />
            </Circle>
          </Group>
        </Group>
      ) : null}
      {/* The medium's light around the body, and at NEAR its wider atmosphere. Constant per tier. */}
      <Light x={x} y={y} r={r * m.halo} profile="wide" hue={hue} lightness={V.mark.haloLight} opacity={tier === 'major' ? response.haloMajor : response.haloMinor} />
      <Light x={x} y={y} r={r * m.haloWide} profile="soft" hue={hue} lightness={V.mark.haloWideLight} opacity={tier === 'major' ? response.haloWideMajor : response.haloWideMinor} />
      {/* LA-VIS-01: the tier's own bloom and hot centre — a hub is a source of light, a minor body a smaller one. */}
      <Light x={x} y={y} r={r * BLOOM[tier].r} profile="point" hue={hue} lightness={BLOOM.light} opacity={BLOOM[tier].alpha} />
      <Light x={x} y={y} r={r * BLOOM[tier].hot} profile="point" hue={hue} lightness={BLOOM.hotLight} opacity={BLOOM[tier].hotAlpha} />
      <MarkBody x={x} y={y} r={r} path={shape.path} stroked={shape.stroked} ink={selected ? palette.selectedInk : material.fill} />
      {/* NEAR: a lit limb and a luminous interior, so the shape bounds a body (§14, WS7R-V §V4b). With no
          runtime focus to face, the limb faces the mark's own presentation angle, as the canonical
          painter does when there is no focus. */}
      <Group opacity={response.near}>
        <Path path={shape.path} style="stroke" strokeWidth={r * V.mark.limbWidth}>
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
      {selected ? <SelectedMarker x={x} y={y} r={marker} contrast={contrast} /> : null}
    </>
  );
}

/**
 * The world's colour around ONE disclosed place: the canonical territory-atmosphere material (its interior
 * stops, in the world's colour) without its rim — there is no territory, so there is no boundary to draw.
 * One per Home, identical for every Home: where the reader's places are, the world is; nothing else is said.
 * A world-space quantity, so it is NOT counter-scaled: it travels and scales with the plane like the world.
 */
export function WorldPlaceAtmosphere({
  x,
  y,
  radius,
  response,
  seed = '',
  chroma,
}: {
  x: number;
  y: number;
  radius: number;
  response: WorldResponse;
  /** LA-VIS-01: the place's scene key, read only for a stable, meaning-free shape of its light (like its rotation). */
  seed?: string;
  /** LA-VIS-01: the world's chroma at this place's address (`./world-chroma`): where it is, never what it is. */
  chroma?: ChromaFamily;
}) {
  // LA-VIS-01: close in, a place's light is the air the reader is inside, not a glare over everything; it thins with the
  // PRESENTED distance, on the plane's own frames, so a travel resolves it continuously.
  const closeShare = useReadingOf(response.approach, (A) => {
    'worklet';
    const t = Math.min(1, Math.max(0, (A - MASS.thinFrom) / (MASS.thinTo - MASS.thinFrom)));
    return 1 - MASS.thinBy * t * t * (3 - 2 * t);
  });
  if (!(radius > 0)) return null;
  const stops = V.worldAtmosphere.stops;
  const [, s0, l0, a0] = stops[0];
  const [, s1, l1, a1] = stops[1];
  const deep = ladderHue(1);
  const tone = massTone(chroma, s0, l0, s1, l1);
  const reach = radius * MASS.haze;
  const textured = radius <= MASS.textureUntil;
  const gain = textured ? MASS.carveGain : 1;
  const embers = emberPoints(seed, x, y, radius);
  const body = (
    <>
      {massLobes(seed).map((lobe, index) => {
        const cx = x + Math.cos(lobe.angle) * radius * lobe.distance;
        const cy = y + Math.sin(lobe.angle) * radius * lobe.distance;
        const r = radius * lobe.r;
        const hue = tone.lobeHue(lobe.rung);
        return (
          <Circle key={index} cx={cx} cy={cy} r={r} blendMode="screen">
            <RadialGradient
              c={vec(cx, cy)}
              r={r}
              colors={[hsla(hue, tone.sat, tone.light + MASS.lobeLift, a1 * lobe.alpha * gain), hsla(hue, tone.sat, tone.light + MASS.lobeLift * 0.6, a1 * lobe.alpha * gain * 0.42), hsla(hue, tone.sat, tone.light, 0)]}
              positions={[0, 0.48, 1]}
            />
          </Circle>
        );
      })}
      {/* The heart: the world's own hue, brightest where the place is. */}
      <Circle cx={x} cy={y} r={radius * MASS.heart} blendMode="screen">
        <RadialGradient
          c={vec(x, y)}
          r={radius * MASS.heart}
          colors={[hsla(tone.heartHue, tone.heartSat, tone.heartLight + MASS.heartLift, a0 * MASS.heartAlpha * gain), hsla(tone.heartHue, tone.heartSat, tone.heartLight + MASS.heartLift * 0.5, a0 * MASS.heartAlpha * gain * 0.35), hsla(tone.heartHue, tone.heartSat, tone.heartLight, 0)]}
          positions={[0, 0.4, 1]}
        />
      </Circle>
    </>
  );
  // The texture: the mass is carved by a noise anchored to the place itself (so it never slides under it) and sized by
  // it (so it zooms with it). Only while the mass is a body on the glass; close in it is the air, and needs none.
  const seedNumber = Math.floor((presentationRotation(seed) / (Math.PI * 2)) * 997);
  return (
    <Group opacity={response.placeAtmosphere}>
      {/* LA-VIS-01 — a semantic MASS rather than a disc. Every place carries the same light, in the same amounts; its
          shape alone is varied, by its key, so nothing about it is said by it. Light accumulates where places are
          many: the territories the eye reads are the real density of real places, and nothing else. */}
      <Group opacity={closeShare}>
        {/* The glow the mass casts into the world around it: wide, faint, the same for every place. */}
        <Circle cx={x} cy={y} r={reach * MASS.glow} blendMode="screen">
          <RadialGradient
            c={vec(x, y)}
            r={reach * MASS.glow}
            colors={[hsla(tone.hazeHue ?? deep, tone.sat, tone.light, a1 * MASS.glowAlpha), hsla(tone.hazeHue ?? deep, tone.sat, tone.light - 6, a1 * MASS.glowAlpha * 0.35), hsla(tone.hazeHue ?? deep, tone.sat, tone.light - 10, 0)]}
            positions={[0, 0.45, 1]}
          />
        </Circle>
        <Circle cx={x} cy={y} r={reach} blendMode="screen">
          <RadialGradient
            c={vec(x, y)}
            r={reach}
            colors={[hsla(tone.hazeHue ?? deep, tone.sat, tone.light - 8, a1 * MASS.hazeAlpha), hsla(tone.hazeHue ?? deep, tone.sat, tone.light - 12, a1 * MASS.hazeAlpha * 0.4), hsla(tone.hazeHue ?? deep, tone.sat, tone.light - 14, 0)]}
            positions={[0, 0.5, 1]}
          />
        </Circle>
        {textured ? (
          <Group>
            <Group layer>
              {body}
              <Group transform={[{ translateX: x }, { translateY: y }]}>
                {MASS.grains.map((grain, index) => (
                  <Rect key={index} x={-reach * MASS.cover} y={-reach * MASS.cover} width={reach * MASS.cover * 2} height={reach * MASS.cover * 2} blendMode="dstIn">
                    <FractalNoise freqX={grain / reach} freqY={grain / reach} octaves={MASS.octaves} seed={seedNumber + index} />
                  </Rect>
                ))}
              </Group>
            </Group>
          </Group>
        ) : (
          body
        )}
        {/* Micro-light inside the mass: the same count, sizes and weights for every place, scattered by its key. It
            is the mass's own light, finer than any mark, and it is never a mark: nothing is placed, hit or read here. */}
        <Path path={embers.fine} color={hsla(tone.heartHue, tone.heartSat, EMBERS.light, EMBERS.fineAlpha)} />
        <Path path={embers.soft} color={hsla(tone.lobeHue(0.5), tone.sat, EMBERS.light, EMBERS.softAlpha)}>
          <BlurMask blur={EMBERS.soft / 3} style="normal" />
        </Path>
      </Group>
    </Group>
  );
}

/**
 * The colours of one mass. Without a chroma it is the canonical world (the world hue at its heart, the cloud ladder in
 * its lobes). With one, the whole mass is that colour, its lobes leaning a few degrees either side so the body is alive
 * rather than flat, and its heart a lighter, hotter version of it.
 */
function massTone(chroma: ChromaFamily | undefined, s0: number, l0: number, s1: number, l1: number) {
  if (chroma === undefined) {
    return { lobeHue: ladderHue, sat: s1, light: l1, heartHue: V.worldHue, heartSat: s0, heartLight: l0, hazeHue: undefined as number | undefined };
  }
  return {
    lobeHue: (rung: number) => chroma.hue + (rung - 0.45) * CHROMA.lobeSpread,
    sat: chroma.saturation * CHROMA.saturation,
    light: chroma.lightness + CHROMA.lift,
    heartHue: chroma.hue,
    heartSat: chroma.saturation * CHROMA.heartSat,
    heartLight: chroma.lightness + CHROMA.heartLift,
    hazeHue: chroma.hue + CHROMA.hazeShift as number | undefined,
  };
}

/** How a chroma is worn by a mass: lobe spread and haze lean (degrees), and lightness lifts (percent). */
const CHROMA = Object.freeze({ lobeSpread: 26, hazeShift: 14, lift: -24, saturation: 0.86, heartSat: 0.55, heartLift: -6 });

/** A place's micro-light: its count, sizes (points) and weights. Constant for every place. */
const EMBERS = Object.freeze({ count: 22, softCount: 8, fine: 1.3, soft: 3.6, light: 84, fineAlpha: 0.75, softAlpha: 0.32 });

/** Where a place's micro-lights sit, in the mass's own frame: denser toward the heart, by its key. */
function emberPoints(seed: string, x: number, y: number, radius: number) {
  // One path of small discs per size: one draw, whatever the count.
  const discs = (from: number, count: number, r: number) => {
    let path = '';
    for (let index = from; index < from + count; index += 1) {
      const angle = presentationRotation(`${index}:e:${seed}`);
      const share = presentationRotation(`${index}:d:${seed}`) / (Math.PI * 2);
      const distance = radius * MASS.haze * 0.8 * share * share;
      const cx = x + Math.cos(angle) * distance;
      const cy = y + Math.sin(angle) * distance;
      path += `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z `;
    }
    return path;
  };
  return { fine: discs(0, EMBERS.count, EMBERS.fine / 2), soft: discs(EMBERS.count, EMBERS.softCount, EMBERS.soft / 2) };
}

/**
 * LA-VIS-01 — the presentation shares of a place's mass, of a mark's light and of the tether's glow. Sizes, weights and
 * offsets only: every hue, saturation and lightness is generated (the world hue, the cloud ladder, the atmosphere stops).
 */
const MASS = Object.freeze({
  haze: 1,
  glow: 1.9,
  glowAlpha: 0.3,
  /** How far past the haze the texture reaches, so the outermost lobes are carved too. */
  cover: 1.25,
  hazeAlpha: 0.32,
  heart: 0.55,
  heartLift: 34,
  heartAlpha: 0.7,
  lobes: 6,
  lobeLift: 20,
  /** The approach over which a place's light thins to the air around the reader, and by how much. */
  thinFrom: 0.15,
  thinTo: 0.5,
  thinBy: 0.9,
  /** Textured while the mass is a body on the glass (its radius in points); the noise scales, cycles per radius. */
  textureUntil: 320,
  grains: [2.6, 5.5],
  octaves: 3,
  /** The carving takes light; the lobes carry this much more so the lit wisps keep the mass's weight. */
  carveGain: 2.8,
});

/** Each tier's own luminous bloom (radius as a multiple of the mark radius, and weight): the hub reads as the hub. */
const BLOOM = Object.freeze({
  major: { r: 4.4, alpha: 0.85, hot: 1.7, hotAlpha: 0.9 },
  minor: { r: 2.6, alpha: 0.5, hot: 1.25, hotAlpha: 0.55 },
  light: 76,
  hotLight: 94,
  /** How much of the canonical cleared ground stays: the world clears a place, but no longer swallows its light. */
  clearing: 0.45,
});

/** The tether's glow: a soft wide light under a finer core. */
const TETHER = Object.freeze({ core: 0.62, glow: 5.2, glowAlpha: 0.34, blur: 2.4 });

interface MassLobe {
  readonly angle: number;
  readonly distance: number;
  readonly r: number;
  readonly rung: number;
  readonly alpha: number;
}

/** A place's lobes: the same count, sizes and weights for every place, arranged by its key. */
function massLobes(seed: string): readonly MassLobe[] {
  const lobes: MassLobe[] = [];
  for (let index = 0; index < MASS.lobes; index += 1) {
    const turn = presentationRotation(`${index}:t:${seed}`) / (Math.PI * 2);
    lobes.push({
      angle: presentationRotation(`${index}:a:${seed}`),
      distance: 0.18 + 0.34 * turn,
      r: 0.5 + 0.12 * ((index * 0.37) % 1),
      // Inner lobes keep the world's hue; outer ones lean into the cooler ladder, as depth does.
      rung: 0.15 + 0.6 * turn,
      alpha: 0.62 - 0.08 * index,
    });
  }
  return lobes;
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
  const increased = contrast === 'increased';
  // LA-VIS-01: a finer core over a soft glow. Increased contrast keeps its full-width core (F1).
  const coreShare = increased ? 1 : TETHER.core;
  const coreWidth = useReadingOf(strokeScale, (k) => {
    'worklet';
    return width * coreShare * k;
  });
  const glowWidth = useReadingOf(strokeScale, (k) => {
    'worklet';
    return width * TETHER.glow * k;
  });
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
      {/* LA-VIS-01: the relation's own glow, along the same straight span and nowhere else. */}
      <Path path={path} style="stroke" strokeWidth={glowWidth} strokeCap="round" blendMode="screen" color={hsla(hue, rel.end.sat, rel.end.light, Math.min(1, alpha * TETHER.glowAlpha))}>
        <BlurMask blur={TETHER.blur} style="normal" />
      </Path>
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
      {selected ? <SelectedMarker x={x} y={y} r={markerRadius('UNGEOGRAPHIC', worldPalette(contrast).markerThickness)} contrast={contrast} /> : null}
    </>
  );
}
