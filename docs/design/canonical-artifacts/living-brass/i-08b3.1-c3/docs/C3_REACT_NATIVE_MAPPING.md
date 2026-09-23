# C3_REACT_NATIVE_MAPPING

**I-08B3.1-C3.10.** How the material tokens should be consumed in React Native.

**This document specifies. It builds nothing, designs no navigation component, and creates no
implementation task.** It also names what is *not* answered, so that nobody later reads silence as
permission.

It **extends** the frozen `B4_REACT_NATIVE_MAPPING.md` from I-08B3.1-B4R rather than repeating it.
Everything there about theme providers, appearance resolution, `useColorScheme()`, the `null` →
`dark` branch, the loud-failure rule for light, and the PASSAGE focus obligations applies unchanged.

> **A stated limit.** `reactnative.dev` is not reachable from this environment. React Native
> appearance architecture is therefore **inherited** from the frozen B4R mapping, which derived it
> when the source was reachable — not restated from memory as though it had been re-read.

---

## 1. The rules

1. **Components consume SEMANTIC tokens. A component never embeds `#a58e6f`.**
   A component that knows a hex must be edited when the material changes, which is the failure the
   three-tier architecture exists to prevent.
2. **Appearance resolves ONCE, at a theme provider.** Never per component.
3. **A theme object carries the SEMANTIC layer**, not the expression layer. A component asks for
   `theme.navigation.machinery`, never `theme.expression.material.livingBrass.body`, and never a hex.
4. **Selection state is resolved independently of material**, always. See §3.
5. **The material is opaque.** There is no alpha, no opacity ladder and no `Reduce Transparency`
   branch to write.

### 1.1 The build step is a RESOLUTION, not a transformation

Read the resolver, follow every alias to its source, serialise each colour. `vendor/b4r/b4-dtcg.mjs`
already does this — `load()` plus `toCss()` — and **it is the same resolution that drives C3.12**, so
the path from token file to painted pixel is the one that was tested, not a parallel one that
resembles it.

---

## 2. What a theme object should carry

```
theme.identity.material          → the one semantic name for Living Brass
theme.identity.mark              → the canonical Q as the product mark
theme.identity.moment            → the rare large identity moment
theme.navigation.machinery       → the persistent navigation icon family
theme.control.functional         → ordinary functional and action controls (neutral)
theme.analysis.node              → analytical node (neutral)
theme.analysis.relation          → analytical relation stroke (neutral)
```

Plus the frozen B4R Surface roles, resolved in the same pass.

**There is deliberately no `theme.navigation.machinery.selected`.** The token system has no such name,
so a component cannot reach for one.

---

## 3. THE NAVIGATION FAMILY — where this mapping is load-bearing

### 3.1 The library's default model is the thing QANDEEL forbids

React Navigation 7 renders a tab icon through:

```jsx
tabBarIcon: ({ focused, color, size }) => <Icon color={color} size={size} />
```

where `color` is computed by the navigator from `tabBarActiveTintColor` and `tabBarInactiveTintColor`.

**That idiomatic line makes the navigation icon change colour on selection**, which is exactly what the
state-invariance contract forbids. It is the shape every example in the library's documentation takes.

### 3.2 The rule

```jsx
// The injected `color` is IGNORED. This is deliberate and it is the contract.
tabBarIcon: () => <QandeelNavIcon color={theme.navigation.machinery} />,

// Both tints set to the SAME token, so the library's own model is neutralised
// EXPLICITLY rather than by omission.
tabBarActiveTintColor:   theme.navigation.machinery,
tabBarInactiveTintColor: theme.navigation.machinery,
```

Setting both tints rather than leaving them unset matters. An unset option falls back to the library's
defaults, and a later reader cannot tell whether the omission was a decision.

### 3.3 A platform risk that must be VERIFIED, not assumed

The **native** tab navigator's documentation says tint support *"varies based on platform"*. A native
tab bar that applies its own tint to a selected item would break state invariance **in a way no token
check can see** — the token file would still be correct, and the screen would still be wrong.

**This must be verified per platform and per navigator, on device.** C3 does not verify it and does
not claim it holds.

### 3.4 Interior functional controls

`theme.control.functional`. They do **not** inherit from the navigation family, and there is no group
default that would make them. The most likely production failure here is a shared `IconButton` that
takes its colour from a theme-wide `iconColor`; that token does not exist, and should not be created.

---

## 4. THE LARGE IDENTITY MOMENT — the character cannot be shipped as written

**This is the most consequential finding in this document.**

The accepted brushed/handled character is built from four SVG filter primitives:

| primitive | `react-native-svg` |
|---|---|
| `feColorMatrix` | implemented |
| `feFlood` | implemented |
| `feComposite` | implemented |
| **`feTurbulence`** | **NOT SUPPORTED** |

Confirmed against the library's own `USAGE.md`, which lists the implemented filters and then lists
`FeTurbulence` explicitly under *"Not supported yet"*. The page also notes that unimplemented filters
*"will display a warning indicating they are not currently supported"*.

**So the failure mode on native is not a crash. It is a warning in a log and a mark without its
character** — a silent downgrade at the one composition where the material is allowed to have any.

### 4.1 Routes that can carry it

None of these is chosen here; choosing is integration's, on integration's evidence.

| Route | What it costs |
|---|---|
| **react-native-skia** — native filter support, named by the installed guidance for exactly this case | each `Canvas` is heavy, and package size. Acceptable for **one** rare moment; not acceptable per icon |
| **A Skia shader** generating the field directly | most control, most work; must reproduce the seeded field deterministically |
| **A deterministic build-time pre-render** to a raster at the sizes the moment actually uses | simplest and cheapest. **But the specification forbids freezing the character as a decorative bitmap**, so this is acceptable only as a build-time *artefact of the algorithm*, generated from the parameters and regenerable, never as a hand-authored image |
| **WebView** | browsers cover the most of the SVG standard, and the overhead is unjustifiable for one mark |

### 4.2 Whichever route is taken, four things must hold

1. **Subtractive-only.** No pixel lighter than the body. Measurable, and it must be measured.
2. **Deterministic.** The same mark at the same size renders to the same bytes.
3. **The anisotropy survives.** Frequency along the grain roughly a tenth of frequency across it. An
   isotropic field is speckle, not brushing.
4. **The tone derives from the AUTHORED OkLCh triple**, not the 8-bit body — see §6.

### 4.3 The performance rule this produces

> **Large identity material character must not require expensive texture processing on every icon.**

The installed guidance gives the reason independently of QANDEEL's taste: every `react-native-svg`
element becomes a native view with no drawing cache, and rendering many small SVGs in separate Skia
canvases degrades performance.

**Prefer a scale-aware implementation**: the ordinary machinery path is a flat fill and nothing else;
the character path exists only for `theme.identity.moment`. Since the identity moment is rare by
contract, the expensive path should be **statically unreachable** from the navigation icon component
rather than merely unused by it.

---

## 5. The canonical mark

The Q is a static vector. The installed guidance is explicit that for static SVG content
`react-native-svg` is the wrong tool — every element becomes an unmemoised native view, redrawn from
scratch each dispatch — and points to `expo-image` or `react-native-vector-image` instead.

**But the mark must be painted in a token-resolved colour**, which a pre-rendered asset cannot be
without generating one asset per colour. Since QANDEEL has exactly one material value today, that is
currently a choice between two acceptable options rather than a problem; it becomes a real problem the
moment a light appearance exists. **Flagged for F**, not decided here.

---

## 6. The character tone derivation, restated for implementers

```
tone = oklch( L_authored − (amplitude / toneDepthRatio), C_authored, H_authored )
```

Take `L_authored`, `C_authored`, `H_authored` from the body token's
`$extensions["com.qandeel.provenance"].authoredAs` — **not** from the 8-bit value the token paints
with.

| source | result |
|---|---|
| authored triple — **the specification** | **`#967f60`** |
| the 8-bit body `#a58e6f` — the obvious choice | `#957f60` |

Quantising to 8 bits costs 0.00047 of lightness and the subtraction carries it forward. **No colour
test will catch this**, because both are plausible Brass. Invariant **I-21** asserts both halves.

---

## 7. What C3 does NOT check, and what a component-level check would have to do

Every invariant in this package is about the **token output**. A React Native component can hard-code
a colour and no token check will ever see it.

A component-level guard would have to:

1. **Lint for colour literals** in component source, allowing them only in the token layer.
2. **Assert that the navigation icon ignores the injected tint** — a render test at two selection
   states asserting the icon's resolved colour is identical.
3. **Assert on device** that the native tab bar applies no tint of its own (§3.3).
4. **Assert the character is unreachable** from anything other than the identity moment — ideally by
   type, so that the expensive path cannot be called with a navigation icon.
5. **Assert the light appearance fails loudly** rather than falling back to dark.

**C3 does none of these.** They belong to the stage that builds components, and they are written down
here so that stage inherits a list rather than an intuition.
