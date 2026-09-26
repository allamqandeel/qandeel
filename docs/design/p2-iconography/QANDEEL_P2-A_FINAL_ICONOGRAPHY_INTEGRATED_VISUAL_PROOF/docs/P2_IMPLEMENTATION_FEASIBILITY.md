# P2-A — Implementation Feasibility

**Status:** `P2-A ASSESSMENT — NO PRODUCTION IMPLEMENTATION`.

This task changed no production file, dependency or runtime ownership (check K01). A future **Production Integration**
task owns everything below, and each dependency named here needs explicit approval there.

## 1. Custom vector storage

- The signature family is **path data**: `source/src/sig.mjs` generates SVG on a 24-unit grid, per nuance and per
  render size.
- For production, the recommended form is a small typed registry, for example `QandeelGlyph = { name, size → paths[],
  solids[], cut?, morph? }`, generated **once** from `sig.mjs` into static path strings.
  - There are 15 glyphs × 4 sizes at most. End Call has one render size, **27 pt** (the P2-A refinement). It is a
    solid mark, so it is the 24-unit drawing scaled, with no stroke to re-weight. Centred in its 44-pt target it sits
    8.5 pt from the edge; on 3× devices, snap its origin to a whole device pixel (`PixelRatio.roundToNearestPixel`).
  - No runtime geometry maths is needed, and no font or icon build step.
- The morphing members (`muted`, `routeMorph`) carry their extra parts:
  - Mute: the slash, and the mask band.
  - Route: the fill layer, and the second wave, with `pathLength` normalised to 1.

## 2. Utility icons

The recommendation is a curated Hugeicons Free subset, **vendored** as path data with the MIT notice, rendered by the
same component and re-weighted by the same optical-stroke rule (`P2_UTILITY_LIBRARY_COMPARISON.md` §4). There is no
runtime icon package, so there is no Metro tree-shaking risk and no second icon API.

## 3. Rendering: React Native compatibility

| Need | Recommended | Status in the repository |
|---|---|---|
| Glyph rendering | **`react-native-svg` 15.15.4**, Expo SDK 57's own pin | **not a dependency today. It is the one dependency a future task would add**, via `npx expo install react-native-svg` so the SDK resolves the version |
| Morphs (dash offset, fill opacity, mask band width) | Reanimated 4.5.1 `useAnimatedProps` on `Path` / `Rect` | Reanimated 4.5.1 + worklets 0.10.1 are present and match Expo 57 |
| Press feedback | the ground wash as a `View` behind the glyph; `Pressable` with Reanimated CSS transitions | present |
| The Temporal Spine | `react-native-svg` paths (spine, notches, apertures), driven by the existing T-06 shared values; the finger x read from Gesture Handler on the UI runtime | Gesture Handler ~2.32 present; T-06 already keeps the cursor on the UI runtime |
| The Call Rail art | two static SVG paths per variant, mirrored with `transform: [{ scaleX: -1 }]` under RTL | — |

The proof harness is HTML/SVG, but every primitive it uses is one `react-native-svg` supports: `path`, `rect`,
`circle`, `mask`, `pathLength`, stroke dash, opacity and transforms. The machines animate **only** `transform`,
`opacity`, dash offset and fill opacity: no layout property, as T-06 already requires.

## 4. Is Skia necessary? No

- Every P2 mark is a vector path with a stroke, a fill, a mask or a dash. Every P2 motion is an opacity, a dash offset
  or a transform. `react-native-svg` + Reanimated animated props express all of them.
- The Living Analysis World is a separate question, owned by the world's native port.
- **Skia ↔ Reanimated (wording corrected by the P2-A refinement).**
  - **The repository currently declares Skia 2.6.2 and Reanimated 4.5.1. Their exact integration pairing is not
    certified by P2-A and was not device-validated here. P2-A does not rely on Skia. The recommended implementation
    path remains static / vector SVG rendering plus Reanimated where appropriate, subject to a future implementation
    task and device verification.**
  - Skia's own documentation is version-dependent.
    - Animations page: from Skia 2.10, the Reanimated integration requires Reanimated v4 or above; lower versions are
      described with Reanimated v3.
    - Installation page: current native Skia with Reanimated requires Reanimated ≥ 4.0.0 and worklets ≥ 0.7.0.

    Neither page certifies the repository's exact 2.6.2 + 4.5.1 pairing, and a declared peer range is not taken as
    proof (`P2_REFERENCE_GATE.md` §2).
  - If a later task wants Skia for the icons, it must first verify the pairing on devices, or change versions under
    its own approval. **No dependency is changed or upgraded here**, and `apps/mobile/package.json` is untouched.

## 5. RTL

- Glyphs are never mirrored, except the chevron (`scaleX(-1)` under RTL).
- The Call Rail places its pieces with logical `start` / `end`, and its art mirrors as layout.
- The Temporal Spine reuses T-06's one mirror rule, `presentationX` and `restingMarkerX`. P2 adds **no second mirror**
  (T-11 forbids one).

## 6. Accessibility integration

- Glyph components render with `accessible={false}` / `importantForAccessibility="no-hide-descendants"`.
- The `Pressable` carries `accessibilityLabel`, `accessibilityRole="button"` and `accessibilityState` (`selected` /
  `checked` for the toggles), with the existing G1.2 R1 action labels.
- The Track keeps T-05's `accessibilityRole="adjustable"` and its actions. P2 draws over it and changes nothing.

## 7. Performance

- The rail and the chrome are static SVG. The spine redraws only while the finger is down, or while an anim key
  runs.
- In production, the notch set is T-05's windowed FlatList. The spine can be drawn **per item** (one notch per 48-pt
  item) plus one overlay for the apertures, so the cost is independent of the session length.
- Morph animations run on the UI thread (Reanimated), with no React re-render per frame (animate-expo §6).

## 8. Testability

- **Static contract tests** (Node, like this package's K03–K05 and K19–K21): Brass scope, neutral tokens, no simulated
  level, `aria-hidden` glyphs, mirroring rules and toggle form. These can run against the production component
  source.
- **Geometry tests** (Jest): the 48-pt step, the 44-pt band, the terminal outside the Track, and every Moment reachable
  (K06–K10).
- **Device:** 1:1 scrub latency, VoiceOver / TalkBack names, Reduce Motion and Increase Contrast.

## 9. Dependencies a future task would require

| Dependency | Why | Approval |
|---|---|---|
| `react-native-svg` (Expo 57 → 15.15.4) | render the glyphs, the rail art and the spine | **required** from the Product Owner / Architecture |
| (none else) | utility glyphs vendored; Reanimated, Gesture Handler already present; P2 does not rely on Skia | — |

**Not required:** Hugeicons packages (vendored instead); any Pro licence; any Skia / Reanimated upgrade; Lottie.
