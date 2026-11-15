// COSMOS (experimental, isolated) — what one frame draws, as pure Skia elements.
//
// No hook and no thread lives here: each part takes its values either as plain numbers or as values derived on the UI
// thread (`./CosmosCanvas` passes derived values; the headless pixel test passes numbers and rasterises the very same
// elements with CanvasKit, which is how the look is checked without a device).

import { Atlas, Fill, Group, ImageShader, LinearGradient, Path, RadialGradient, Rect, type SkImage, type Transforms3d } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

import { TINT } from '../core/stage';
import { ATLAS_SAMPLING, PLATE_SAMPLING, rgbOf, type PreparedAtlas, type PreparedRung } from './prepare';

/** What is drawn. FULL is the look; the other two are MEASUREMENT-ONLY diagnostics of what the nebula bodies cost. */
export type OverdrawMode = 'FULL' | 'NO_BODIES' | 'PLATES_ONLY';

type Live<T> = T | SharedValue<T>;
export const VOID = '#05060f';

/** One atmosphere plate: a single full-screen tiled fill. DEEP is opaque; GAS and the VEIL add their light. */
export function PlateFill({ image, transform, additive, alpha }: { readonly image: SkImage; readonly transform: Live<Transforms3d>; readonly additive: boolean; readonly alpha: number }) {
  return (
    <Fill blendMode={additive ? 'plus' : 'srcOver'} opacity={alpha}>
      <ImageShader image={image} tx="repeat" ty="repeat" fit="none" transform={transform} sampling={PLATE_SAMPLING} />
    </Fill>
  );
}

/** ONE atlas draw for every instance given. */
export function Sprites({ atlas, instances }: { readonly atlas: SkImage; readonly instances: PreparedAtlas }) {
  if (instances.transforms.length === 0) return null;
  // colorBlendMode MODULATE: white texel × tint, at (texture alpha × instance alpha). blendMode PLUS: light adds.
  return (
    <Atlas image={atlas} sprites={instances.sprites} transforms={instances.transforms} colors={instances.colors}
      colorBlendMode="modulate" blendMode="plus" sampling={ATLAS_SAMPLING} />
  );
}

/** One rung: its atlas draw(s), one stroked path per hairline set and (Shared) its horizon, under one opacity. */
export function RungDraws({ layer, atlas, mode, opacity, hair }: {
  readonly layer: PreparedRung; readonly atlas: SkImage | null; readonly mode: OverdrawMode;
  readonly opacity: Live<number>;
  /** One point in world units (1 / scale): the horizon is a hairline at every depth. */
  readonly hair: Live<number>;
}) {
  const gold = rgbOf(TINT.GOLD);
  return (
    <Group opacity={opacity}>
      {atlas === null ? null : <Sprites atlas={atlas} instances={mode === 'NO_BODIES' ? layer.lights : layer.full} />}
      {layer.lines.map((set) => (
        <Path key={set.key} path={set.path} style="stroke" strokeCap="round" strokeJoin="round" strokeWidth={set.width}
          color={set.color} opacity={set.alpha} blendMode="plus" />
      ))}
      {layer.horizon === null ? null : (
        <>
          <Path path={layer.horizon.ring} style="stroke" strokeWidth={hair} color={gold} opacity={0.5} blendMode="plus" />
          <Path path={layer.horizon.outer} style="stroke" strokeWidth={hair} color={gold} opacity={0.2} blendMode="plus" />
          <Path path={layer.horizon.ticks} style="stroke" strokeWidth={hair} color={gold} opacity={0.42} blendMode="plus" />
        </>
      )}
    </Group>
  );
}

/**
 * The lens: the edges fall away, so the eye rests where the light is. Static. The gate's three CSS gradients: an
 * ellipse (78 % × 60 % at 50 % 47 %) and four edge bands; the bands are drawn only where they are not transparent.
 */
export function Lens({ width, height }: { readonly width: number; readonly height: number }) {
  const clear = 'rgba(5, 6, 15, 0)';
  const rx = width * 0.78; const ry = height * 0.6; const cx = width * 0.5; const cy = height * 0.47;
  return (
    <>
      <Group transform={[{ translateX: cx }, { translateY: cy }, { scaleX: rx }, { scaleY: ry }]}>
        <Rect x={-cx / rx} y={-cy / ry} width={width / rx} height={height / ry}>
          <RadialGradient c={{ x: 0, y: 0 }} r={1} colors={[clear, clear, 'rgba(5, 6, 15, 0.4)', 'rgba(5, 6, 15, 0.86)']} positions={[0, 0.4, 0.72, 1]} />
        </Rect>
      </Group>
      <Rect x={0} y={0} width={width * 0.15} height={height}>
        <LinearGradient start={{ x: 0, y: 0 }} end={{ x: width * 0.15, y: 0 }} colors={['rgba(5, 6, 15, 0.82)', clear]} />
      </Rect>
      <Rect x={width * 0.85} y={0} width={width * 0.15} height={height}>
        <LinearGradient start={{ x: width * 0.85, y: 0 }} end={{ x: width, y: 0 }} colors={[clear, 'rgba(5, 6, 15, 0.82)']} />
      </Rect>
      <Rect x={0} y={0} width={width} height={height * 0.17}>
        <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 0, y: height * 0.17 }} colors={['rgba(5, 6, 15, 0.66)', clear]} />
      </Rect>
      <Rect x={0} y={height * 0.76} width={width} height={height * 0.24}>
        <LinearGradient start={{ x: 0, y: height * 0.76 }} end={{ x: 0, y: height }} colors={[clear, 'rgba(5, 6, 15, 0.62)']} />
      </Rect>
    </>
  );
}
