/**
 * A3-01 — the two P3 glyph members, drawn with the already-installed Skia renderer, exactly as W1A-01's `Glyph` draws
 * P2's: the generated path data, the frozen optical stroke for the render size, round caps and joins, on P2's 24-unit
 * grid. No runtime icon package and no `react-native-svg`.
 *
 *   - `ledger` — Open Ledger, the «النشاط» / Activity entry. Not a ring (every ring in the P2 family is a World, and
 *     Activity is not one). Rest ink in every state, never Living Brass, never mirrored (P3 §5.1, §16).
 *   - `link` — Open Link, the Introductions Activity-row source mark. No ring; the link is offered, not made (P3 §5.2).
 *
 * A glyph is always decorative: the control or row that holds it carries the accessible name.
 */
import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import { View } from 'react-native';

import { P3_GLYPHS } from './p3-production.generated';

export type P3GlyphName = 'ledger' | 'link';

export interface P3GlyphProps {
  readonly name: P3GlyphName;
  readonly color: string;
}

export function P3Glyph({ name, color }: P3GlyphProps) {
  const glyph = P3_GLYPHS[name];
  const size = glyph.size;
  return (
    <View
      // Never mirrored: both glyphs are direction-free by meaning (P3 §16).
      style={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
      testID={`qandeel-p3-glyph-${name}`}
    >
      <Canvas style={{ width: size, height: size }}>
        <Group transform={[{ scale: size / glyph.grid }]}>
          {glyph.strokes.map((stroke) => (
            <Path key={stroke.d} path={stroke.d} style="stroke" strokeWidth={stroke.strokeWidth} strokeCap="round" strokeJoin="round" color={color} />
          ))}
          {glyph.dots.map((dot) => (
            <Circle key={`${dot.cx},${dot.cy}`} cx={dot.cx} cy={dot.cy} r={dot.r} color={color} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}
