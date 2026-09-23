# I-08B3.1-F2 — IMPLEMENTATION FEASIBILITY

> **Use one centralized appearance projection architecture.** Do not hard-wire Product logic to
> `if dark → X else → Y` throughout the codebase. — §28

## The shape

```
system appearance  ─┐
accessibility state ├─►  ONE PROJECTION  ─►  resolved roles  ─►  every consumer
token tree         ─┘
```

Three inputs, one projection, one output type. **Every consumer takes a resolved ROLE.** Nothing
downstream knows which appearance is active, and nothing downstream is allowed to ask.

`tools/f2-resolve.mjs` is that projection in this package. `qandeel.appearance.resolution-is-centralised`
records the requirement as a token and classifies it **implementation-strategy**, because *the
centralisation* is a Product requirement — it is what makes the contract checkable — while *the
mechanism* is a choice, and naming it a strategy keeps a prototype's structure from becoming
Product law.

## 1 — Detecting the appearance

```js
import { useColorScheme } from 'react-native';
```

React Native's own source: *"React hook that provides and subscribes to color scheme updates from
the Appearance module. Returns `'light'`, `'dark'`, or `null`. Notes: `null` will only be returned
if the native Appearance module is unavailable (out of tree platforms)."*

**The null branch is a Product decision, not a default.** The tempting reading of `null` is
`'light'`. QANDEEL is **dark-led**, so:

```js
const appearance = useColorScheme() ?? 'dark';
```

One rule, in one place, so the fallback cannot be decided differently at each call site.

## 2 — Appearance changes while the app is alive

**It is a subscription and never a value captured at mount.** `useColorScheme` is built on
`useSyncExternalStore` over `Appearance.addChangeListener`, and that is the right shape because the
appearance genuinely changes mid-session — Apple's Auto setting switches it at sunrise and sunset.

**This is where the analogy with Reduced Motion breaks, and the break is worth stating.** The
`react-native-best-practices` reference records that `useReducedMotion` *"returns true if the device
has reduced motion enabled AT APP START. Does not update at runtime."* Copying that pattern for the
appearance would produce an app that is correct until the sun goes down.

### The Android requirement that only the Reference Gate surfaced

> *"When the app's theme changes … it triggers a `uiMode` configuration change, **which
> automatically recreates activities**."* — Android Developers, Dark theme

**By default, on Android, an appearance change destroys and recreates the Activity** — which is
precisely what §16 forbids. Therefore, **required**:

```xml
<activity android:name=".MainActivity" android:configChanges="uiMode" />
```

…so the Activity is *not* recreated and the appearance projection re-renders instead.

> **THIS IS AN INTEGRATION GATE, NOT A CLAIM.** F2 proved the no-state-reset contract in a browser.
> That proof does not cover the Android Activity lifecycle, and a package that stopped there would
> have shipped a contract the runtime violates on one of its two platforms. **The gate: the
> analytical state, the selection, the focus and the scroll position survive a real system
> appearance change on a real device.**

## 3 — Adaptive colour resolution, and the stale-cache failure

The single most likely implementation defect is a `StyleSheet.create` at module scope:

```js
// WRONG — resolved once, at import time, in whatever appearance was active then
const styles = StyleSheet.create({ world: { backgroundColor: roles.world } });
```

That object is built once per module load and never rebuilt. The appearance changes, the projection
updates, and the styles do not. **It is the same defect as capturing the appearance at mount, one
layer down**, and it fails silently: the app looks right until someone switches.

```js
// RIGHT — the styles are a function of the projection
const useStyles = () => {
  const roles = useQandeelAppearance();
  return useMemo(() => StyleSheet.create({ world: { backgroundColor: roles.world } }), [roles]);
};
```

The same rule binds anything that caches a colour: memoised components, animated colour values,
navigator theme objects, and shader uniforms.

## 4 — Skia

A Skia paint takes a colour like any other consumer, so the appearance costs Skia nothing
structurally. Two things do need care:

- **Shader uniforms and pre-built `SkPaint` objects are caches.** They must be rebuilt from the
  projection, on the same dependency as the styles.
- **A Skia Canvas is one opaque node to an accessibility API.** That is I-08B3.1-D2R's inherited
  constraint and F1's projection requirement, and it is unchanged by the appearance: every
  analytical object must still be a real view with a real accessible name composed over the canvas.
  **The appearance does not make this harder and does not make it easier.**

## 5 — Reanimated

**F2 introduces one animation: the appearance cross-fade.** 200 ms, symmetric, and **removed** —
not shortened — under reduced motion.

`ReducedMotionConfig` / `useReducedMotion` gate it. The documented Reanimated behaviour I-08B3.1-F1
recorded still applies and is the reason the gate is explicit rather than left to
`ReduceMotion.System`: the global default **deletes exiting animations entirely**, and QANDEEL's
1,150 ms settle is an exit.

**The cross-fade must not share the meaning envelope.** D2R's envelope is 260/1,150 asymmetric; the
cross-fade is symmetric with no rise and no settle. Check **S-02** asserts the durations differ.

## 6 — Accessibility modifier composition

The projection takes the accessibility state as an input alongside the appearance, which is what
makes `LIGHT + INCREASE CONTRAST + REDUCE TRANSPARENCY` one resolution rather than three patches:

```js
const roles = resolveAppearance({
  appearance,                                   // 'dark' | 'light'
  contrast: highContrast ? 'increased' : 'standard',
  transparency: reduceTransparency ? 'reduced' : 'full',
});
```

`AccessibilityInfo` supplies `isHighTextContrastEnabled` and `isReduceTransparencyEnabled` with
change listeners, and both are subscriptions for the same reason the appearance is.

**Motion and text scale are deliberately NOT modifiers of the colour projection.** Neither resolves
to a colour, and putting them in would make the resolver the authority on something it cannot check
— I-08B3.1-F1's split, kept.

## 7 — React Navigation

React Navigation carries its own `DarkTheme` / `DefaultTheme` objects. **They are not adopted.**
Adopting them would put a second appearance authority beside QANDEEL's projection, which is the
scattered shape §28 forbids. The navigator is **fed from** the projection:

```js
<NavigationContainer theme={navigationThemeFrom(roles)}>
```

## 8 — Android dynamic colour

**Not adopted.** Material 3 can derive a whole scheme from the user's wallpaper. QANDEEL's palette
*is* its identity — Living Brass is the material the Product is made of, and the chroma ladder is
how its semantics are encoded. A wallpaper-derived scheme would replace the thing the design system
exists to protect. Platform theming informs the implementation; it does not author the system.

## 9 — What the production mapping still owes

- **The exhaustive mapping against the real canonical V schema**, which I-08B3.1-F1R2 recorded as an
  implementation dependency and F2 does not discharge.
- **The light-appearance counterpart of I-08B3.1-C3's brushed/handled character tone.** C3 derives it
  from the body's authoring triple for the dark appearance; the light derivation is open.
- **The `android:configChanges="uiMode"` declaration and its device gate**, above.
- **A real VoiceOver and TalkBack run**, in both appearances.
- **Device colour validation** — see `F2_DEVICE_VALIDATION.md`.
