/**
 * S4-01 — the P2 persistent navigation family, drawn with the installed Skia renderer (P2 closure §5).
 *
 * The geometry is P2's own (`p2-production.generated.ts`, from `sig.mjs` `navMine` / `navShared` at the 24 px the P2-A
 * rail draws them). One material for the family, identical at every state: interaction state is never carried by the
 * glyph (C3 §6; P2 §5), so this component takes a colour and nothing else. It is decorative — the destination word
 * names the control (P2 §10) — and a world glyph never mirrors (P2 §10).
 */
import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import { View } from 'react-native';

import { P2_NAV_GLYPHS } from './p2-production.generated';

export type NavGlyphName = 'navMine' | 'navShared';

export interface NavGlyphProps {
  readonly name: NavGlyphName;
  readonly color: string;
}

export function NavGlyph({ name, color }: NavGlyphProps) {
  const glyph = P2_NAV_GLYPHS[name];
  const size = P2_NAV_GLYPHS.size;
  return (
    <View
      style={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
      testID={`qandeel-nav-glyph-${name}`}
    >
      <Canvas style={{ width: size, height: size }}>
        <Group transform={[{ scale: size / P2_NAV_GLYPHS.grid }]}>
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
