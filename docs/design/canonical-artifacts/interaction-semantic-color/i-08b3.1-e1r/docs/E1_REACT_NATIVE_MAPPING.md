# E1_REACT_NATIVE_MAPPING

**I-08B3.1-E1.** QANDEEL ships React Native. The proof is a DOM. This document says which
parts of the specification map cleanly, which need a different mechanism, and which are
genuinely unanswered — because the last category is the one that gets a package rejected
when it is hidden.

---

## 1. Maps cleanly

| E1 | React Native |
|---|---|
| the two literals and every alias | plain colour values from the resolved token graph |
| the press ground response | `Pressable`'s `style` callback: `({ pressed }) => pressed && { backgroundColor }`. It fires on **press-in**, which is the contract |
| the press scale response | `Animated` / Reanimated on `transform: [{ scale }]` |
| selection ink and weight promotion | `Text` style |
| the selection marker | a `View` on the anchored edge, sized with `borderStartWidth` / a positioned child |
| logical direction | `I18nManager.isRTL` plus the `*Start` / `*End` style properties, which resolve per element exactly as CSS logical properties do |
| the disabled ink | one colour applied to every `Text` and icon in the control — **and to the selection marker**, which is precedence rule P1 |
| NATIVE NON-DISCOVERABLE UNAVAILABLE | `Pressable disabled` + `accessibilityState={{ disabled: true }}` |
| the selection marker under SELECTED + UNAVAILABLE | the same `View`, with its `backgroundColor` switched to the unavailable ink. Its presence and the `Text` weight do not change |
| an invalid field | `accessibilityInvalid` where available; `accessibilityState` + `accessibilityHint` otherwise |
| the disabled reason | a real sibling `Text`, referenced by `accessibilityLabelledBy` (Android) / `accessibilityHint` |
| status live regions | `accessibilityLiveRegion="assertive"` on Android; `AccessibilityInfo.announceForAccessibility` on iOS |

---

## 2. Needs a different mechanism

**The two-tone focus indicator.** There is no `outline` and no `outline-offset` in React
Native, and `box-shadow` is not available on Android in the way the proof uses it. The
construction that reproduces the specification exactly is **two nested Views**:

```
<View style={{ padding: companionThickness, borderRadius: r + offset + thickness }}>   // companion
  <View style={{ borderWidth: thickness, borderColor: indicator,
                 padding: offset, borderRadius: r + offset }}>                         // indicator + gap
    {control}
  </View>
</View>
```

The gap is real padding rather than an offset, which is why `offset` is a token rather
than an implicit property of the outline. A `react-native-svg` stroke is the alternative
where a control's shape is not a rounded rectangle.

**The press wash on a transparent ground.** The DOM composites `rgba(ink, 0.10)` over
whatever is behind. In RN the same is true for `backgroundColor`, but a control sitting
directly on the World and one sitting on the functional Surface composite to **different**
values — `#242423` and `#2b2b2a`. Both are specified and both are measured; an
implementation that pre-flattens the wash to one value will be wrong on one of the two
grounds.

---

## 3. Genuinely unanswered, and named as such

**D-E1-1 — there is no `:focus-visible` in React Native.** The web distinction between
"focused" and "focused by keyboard" is the browser's. RN has `onFocus` and, on TV and with
a hardware keyboard, focus is a real and visible thing; on touch it is mostly not. E1's
contract says the indicator means *input is going here*, which is a statement about intent
rather than an API. **Integration must decide when it appears**, and the decision should be
recorded rather than emerging from whichever component library is used.

**D-E1-2 — the behavioural proof is one engine, keyboard only.** `tools/e1-focus.mjs`
drove Chrome. No RN focus manager was exercised, no touch or pointer dismissal was tested,
and no screen reader was heard. The obligations are correct for the semantics they
describe; they are not a claim about a device.

**D-E1-3 — `accessibilityInvalid` is not uniformly available.** The web pairing of
`aria-invalid` with `aria-describedby` and `role="alert"` has no single RN equivalent that
behaves the same on both platforms. The fallback — `accessibilityState`, a hint, and an
assertive live region — is close but is not the same announcement, and E1 has not verified
either.

**D-E1-6 — the DISCOVERABLE UNAVAILABLE pattern has no verified React Native form.** This
is new in I-08B3.1-E1R and it is the largest unverified claim the revision adds. On the web
the pattern is exact: `aria-disabled="true"`, no `disabled` attribute, activation suppressed
in script. React Native has no `aria-disabled`, and the pieces that would compose the same
behaviour — `accessibilityState={{ disabled: true }}` on a control left focusable, with
`onPress` suppressed rather than the component disabled — are **specified here and not
tested on a device or against a screen reader in this package.** What each platform's
accessibility focus traversal does with a control in that configuration is precisely the
question, and it was not answered: `reactnative.dev` could not be read from this host during
the Reference Gate, so no first-party wording is quoted and none is invented.

**The web half is fully proved and the native half is not.** An integration must verify:
that the control is reachable by the platform's accessibility focus, that it announces as
disabled, and that activation does not occur — and must record the result, because getting
this wrong produces a control that *looks* unavailable and *is* operable, which the web
probe demonstrates is an easy defect to ship.

**D-E1-4 — increased contrast has no cross-platform input.** Inherited from B4R's D-9:
`isDarkerSystemColorsEnabled()` is iOS-only and `isHighTextContrastEnabled()` is
Android-only. E1 adds no increased-contrast values, so it does not make this worse; it also
does not fix it, and F will meet it again.

**D-E1-5 — variable-weight Arabic on Android.** The proof uses Estedad's variable axis at
500 and 600. Android's handling of variable font weights below API 29 is a real constraint,
and a static-instance fallback may be required — which would make the two weights two font
files rather than one axis position. The *relation* survives either way; the packaging does
not.

---

## 4. What does not need code, and the reason must be written down

**Reduced transparency needs nothing**, because E1 introduces no translucency. The press
wash is a composite, not a live blur, and it resolves to an opaque value. Recorded so that
nobody adds a branch to be safe — the same reasoning B4R recorded for the opaque Surface.
