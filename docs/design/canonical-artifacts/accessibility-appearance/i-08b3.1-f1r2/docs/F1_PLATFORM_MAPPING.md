# I-08B3.1-F1 — PLATFORM AND RUNTIME MAPPING

§16 asks for the design contract mapped to real platform capability, with each signal marked
**SYSTEM-DETECTABLE**, **APP-DERIVED**, **PLATFORM-SPECIFIC** or **NOT CURRENTLY EXPOSED**, and
**no fake cross-platform uniformity**.

Every row below comes from the **React Native source on the main branch**, read line by line.
`reactnative.dev` is unreachable from this host — I-08B3.1-E1 recorded the same — so the source
was used, which is a stronger primary than the docs site would have been.

---

## 1. The signals

| QANDEEL expression | iOS | Android | status |
|---|---|---|---|
| **Reduced Motion** | `isReduceMotionEnabled` + `reduceMotionChanged` | same | **SYSTEM-DETECTABLE**, both — *with an Android qualification, below* |
| **Increase Contrast** | `isDarkerSystemColorsEnabled` (`@platform ios`) + `darkerSystemColorsChanged` | `isHighTextContrastEnabled` (`@platform android`) + `highTextContrastChanged` | **PLATFORM-SPECIFIC — TWO DIFFERENT SETTINGS** |
| **Reduce Transparency** | `isReduceTransparencyEnabled` (`@platform ios`) + `reduceTransparencyChanged` | *none* — `Promise.resolve(false)` | **PLATFORM-SPECIFIC, iOS only** |
| **Bold Text** | `isBoldTextEnabled` (`@platform ios`) + `boldTextChanged` | *none* — `Promise.resolve(false)` | **PLATFORM-SPECIFIC, iOS only** |
| **Larger Text** | Dynamic Type; `allowFontScaling` is on by default | `fontScale`; nonlinear above 1.3× on Android 14+ | **SYSTEM-DETECTABLE**, both, **with different curves** |
| **Screen reader on** | `isScreenReaderEnabled` + `change` / `screenReaderChanged` | same | **SYSTEM-DETECTABLE**, both |
| **Grayscale** | `isGrayscaleEnabled` + `grayscaleChanged` | a real native path exists | **SYSTEM-DETECTABLE with a qualification**, below |
| **Invert colours** | `isInvertColorsEnabled` + `invertColorsChanged` | a real native path exists | **SYSTEM-DETECTABLE**, both |
| **Custom VoiceOver rotor** | `UIAccessibilityCustomRotor` exists natively | TalkBack has no equivalent | **NOT CURRENTLY EXPOSED by React Native** |
| **Announcement** | `announceForAccessibility` / `…WithOptions` | `announceForAccessibility` | **SYSTEM-DETECTABLE**, both |
| **Recommended timeout** | not available — returns the original | `getRecommendedTimeoutMillis` (`@platform android`) | **PLATFORM-SPECIFIC, Android only** |

### The correction this table exists to make

**INCREASE CONTRAST IS NOT ONE SIGNAL.** iOS's `isDarkerSystemColorsEnabled` is a system-wide
contrast preference; Android's `isHighTextContrastEnabled` is specifically about **text**. They
have different scopes, and treating them as one flag would ship a design whose Android behaviour
nobody designed.

**REDUCE TRANSPARENCY HAS NO ANDROID EQUIVALENT AT ALL.** So the combined-settings matrix has
**fewer real cells on Android than on iOS** — see `F1_COMBINED_SETTINGS.md`.

> A widely-used third-party binding lists `isHighTextContrastEnabled` and
> `isDarkerSystemColorsEnabled` as available on **both** platforms. The source says otherwise and
> the source wins. The disagreement is recorded because the plausible secondary is exactly what a
> package would ship if it did not check.

---

## 2. Three Android qualifications the docs site would not have given

**Android "reduce motion" is really an ANIMATOR SCALE.** `AccessibilityInfoModule.kt` derives it
from `Settings.Global.TRANSITION_ANIMATION_SCALE == 0`, with the code's own comment:
*"Disabling animations in developer settings will set the animation scale to '0.0' but setting
'reduce motion' / 'disable animations' will set the animation scale to '0'."* So a **developer-
options toggle produces the same signal** as the accessibility setting.

**Android "grayscale" is really the DALTONIZER in one specific mode** —
`accessibility_display_daltonizer_enabled == 1 && accessibility_display_daltonizer == 0`. A user
with colour correction set to **any other mode** reports `false`. The signal is narrower than its
name.

**The Android high-contrast key is HIDDEN.** The module reads the string `"high_text_contrast_enabled"`
and the source comments that the constant *"is marked with @hide"*. That is a **stability risk**
worth a reviewer knowing about.

---

## 3. The runtime trap, and it is the default

Reanimated's `ReduceMotion.System` is the default for every animation, and under it
`withTiming`/`withSpring` **return the `toValue` immediately**, entering animations jump to their
endpoints, and **exiting animations are OMITTED ENTIRELY** — which deletes QANDEEL's 1,150 ms
settle, the beat that carries the result.

**What an implementation must do:**

1. Do **not** rely on a global `<ReducedMotionConfig mode={ReduceMotion.System} />`.
2. Declare the **replacement** animation `reduceMotion: ReduceMotion.Never`.
3. Switch the **suppressed** channels off from `qandeel.accessibility.motion.*`, at the value.
4. Read the setting from `AccessibilityInfo.isReduceMotionEnabled` **and subscribe to
   `reduceMotionChanged`** — `useReducedMotion` reports the setting *"when the app started"* and
   does not update at runtime, so a user who changes it mid-session gets the old behaviour until
   restart.

---

## 4. The accessibility element model

The Map is a Skia `Canvas`, which is **one opaque node** to an accessibility API. So:

| | |
|---|---|
| the field | `importantForAccessibility="no-hide-descendants"` (Android) / `accessibilityElementsHidden` (iOS) |
| every analytical object | a **real view** over the canvas, with `accessibilityRole`, `accessibilityLabel`, `accessibilityValue`, `accessibilityState` |
| the PATTERN's membership | `accessibilityLabel` carrying the **sentence** — Product copy |
| traversal by kind | grouped containers with **headings**, because RN exposes no custom rotor |
| an arriving INSIGHT | `AccessibilityInfo.announceForAccessibility`, **once** |
| the root | `lang`/`accessibilityLanguage` `ar` — it drives **screen-reader voice selection** as well as font fallback |

---

## 5. What is APP-DERIVED rather than system-detectable

- **A QANDEEL-level "reduce transparency" preference on Android.** The platform has no setting, so
  an app-level one is the only way an Android user can request that expression. Legitimate, and
  recorded as APP-DERIVED rather than presented as platform support.
- **A QANDEEL-level Bold Text preference on Android.** Same shape.
- **The label escape scale.** Derived from the measured layout, not from a system signal.

---

## 6. What is NOT CURRENTLY EXPOSED

| capability | the native API it would need | consequence for F1 |
|---|---|---|
| **custom rotor** | `UIAccessibilityCustomRotor` / `AccessibilityRotorEntry` | traversal by kind uses **headings** instead. A rotor jumps from anywhere; headings require walking to the group first |
| **`prefersCrossFadeTransitions` on Android** | none exists | iOS-only; QANDEEL does not depend on it |
| **a per-element "reduce transparency" hint** | none on either platform | the expression is resolved at the token level instead, which is where it belongs anyway |

---

## 7. What no part of this package establishes

**No device. No simulator. No screen reader. No TalkBack. No VoiceOver.** Everything above is
read from source and rendered in a headless browser on Windows. Every claim in this document is a
claim about an **API surface**, not about behaviour on hardware.
