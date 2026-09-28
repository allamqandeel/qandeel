/**
 * W1A-01 — the frozen P2 glyphs, drawn with the already-installed Skia renderer.
 *
 * The geometry is P2's own, generated from `sig.mjs` / `utility.mjs` into
 * `canonical-visual.generated.ts`: the same path data, the same optical stroke for the render size,
 * round caps and joins, on P2's 24-unit grid scaled to the render size. No generic icon replaces
 * any of it, and `react-native-svg` is not used (P2 §14; W1A-01 authorization §5.3).
 *
 * Direction is by MEANING: Send and the depth glyph never mirror; the back chevron points back in
 * the reading direction it is shown in. A glyph is always decorative — the control that holds it
 * carries the accessible name.
 */
import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import { View } from 'react-native';

import { CANONICAL_VISUAL } from './canonical-visual.generated';

export type GlyphName = keyof typeof CANONICAL_VISUAL.glyphs;

export interface GlyphProps {
  readonly name: GlyphName;
  readonly color: string;
  /** The reading direction the glyph is shown in. Only a directional glyph uses it. */
  readonly direction: 'rtl' | 'ltr';
}

const GRID = 24;

export function Glyph({ name, color, direction }: GlyphProps) {
  const glyph = CANONICAL_VISUAL.glyphs[name];
  const size = glyph.size;
  // P2's back is the right-pointing chevron flipped for a left-to-right reading; under RTL the
  // mirror turns it again, so it is drawn as-is. Non-directional glyphs are never flipped.
  const flip = 'flipForLtr' in glyph && glyph.flipForLtr && direction === 'ltr';
  return (
    <View
      style={{ width: size, height: size, transform: flip ? [{ scaleX: -1 }] : undefined }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
      testID={`qandeel-glyph-${name}`}
    >
      <Canvas style={{ width: size, height: size }}>
        <Group transform={[{ scale: size / GRID }]}>
          {glyph.strokes.map((stroke) => (
            <Path
              key={stroke.d}
              path={stroke.d}
              style="stroke"
              strokeWidth={stroke.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
              color={color}
            />
          ))}
          {glyph.dots.map((dot) => (
            <Circle key={`${dot.cx},${dot.cy}`} cx={dot.cx} cy={dot.cy} r={dot.r} color={color} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}
