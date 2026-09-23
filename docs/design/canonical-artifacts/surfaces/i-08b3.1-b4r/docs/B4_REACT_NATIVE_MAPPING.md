# B4_REACT_NATIVE_MAPPING

**I-08B3.1-B4.10.** How the semantic tokens should map into React Native.

**This document builds no components and specifies no UI implementation task.** It says how the
frozen token architecture should be consumed when components are built, and — as importantly — names
what is *not* answered so that nobody later reads silence as permission.

---

## 1. The rules, first

1. **Components consume SEMANTIC tokens. Components never embed `#181818`.**
   This is Apple's rule and QANDEEL's: *"Avoid using hard-coded color values or colors that don't
   adapt."* A component that knows a hex is a component that must be edited when the appearance
   changes, which is the failure the three-tier architecture exists to prevent.
2. **Appearance is resolved ONCE, at a theme provider — never per component.**
3. **Product roles do not map one-to-one to component classes.** `role.aside.fill` is not a
   `<Aside>`. A menu, an excerpt panel and a provenance panel are three components that happen to be
   the same Product role.
4. **Accessibility semantics are derived from the interaction inside the layer, not from the Product
   role.** `B4_SURFACE_ROLE_CONTRACTS.md` §0.
5. **The B-track truth is OPAQUE. Reduce Transparency has nothing to undo, and no branch should be
   written for it.**

---

## 2. Token consumption

The build step for React Native is a **resolution**, not a transformation: read
`tokens/qandeel-surface.tokens.json`, follow every alias to its source, serialise each colour to the
platform's form. `tools/b4-dtcg.mjs` already does this — `load()` plus `toCss()` — and the same
resolution drives the integration proof, so the path from token file to painted pixel is the one
that was tested.

Serialisation: an opaque colour becomes its 6-digit hex; a colour with alpha becomes `rgba(...)`.
Only one token in the system has alpha, and it is the scrim.

**What a theme object should carry** is the semantic layer, not the expression layer. A component
asks for `theme.role.passage.scrim`, never for `theme.expression.scrim` and never for a hex.

---

## 3. Appearance resolution

**Source of truth:** `useColorScheme()` from React Native, which returns `'light' | 'dark' | null`
and subscribes to updates. `Appearance.getColorScheme()` is the imperative form;
`Appearance.addChangeListener()` is the subscription.

**The DTCG `appearance` modifier maps one-to-one onto this hook's two meaningful values.**

**`null` maps to `dark`, explicitly.** `null` means the platform expressed no preference (or the
native module is unavailable). QANDEEL is dark-led, so `null` must resolve to the canonical dark
expression by a named branch — not by a falsy check that would land on light by accident. A `null`
that silently became light would be a theme nobody designed.

**Light is not implemented, and must fail loudly.** Resolving into the light appearance today leaves
every semantic token unresolved (`B4_TOKEN_ARCHITECTURE.md` §6). A build that resolves light should
**error**, not fall back to dark. Falling back would make an unfinished theme invisible, which is
the one outcome the architecture was built to prevent.

**No in-app appearance setting.** `Appearance.setColorScheme()` exists, and Apple's guidance is to
avoid an app-specific appearance setting — people *"may think your app is broken because it doesn't
respond to their systemwide appearance choice"*. Recorded so that a future request for a theme
switcher meets a decision rather than a blank.

---

## 4. The PASSAGE, which is where this mapping is load-bearing

I-08B3.1-B3R proved four focus-lifecycle obligations in a browser. They are **product obligations**,
not DOM obligations, and this is their React Native expression.

```jsx
<Modal
  visible={isOpen}
  accessibilityViewIsModal={true}     // background de-prioritised for assistive technology
  onRequestClose={dismiss}            // the platform dismissal paths RN documents - NOT keyboard Escape
>
  {/* NOT accessible={true} on this View - see the hazard below */}
  <View style={{ backgroundColor: theme.role.passage.fill }}>
    <Text accessibilityRole="header">{title}</Text>
    …
  </View>
</Modal>
```

**The four obligations, restated for the platform:**

| B3R obligation | React Native expression |
|---|---|
| focus moves **inside** on open | set initial focus inside the modal explicitly; the platform does not do it for you |
| focus **cannot escape** while up | trap focus within the modal; `accessibilityViewIsModal` de-prioritises the background for assistive technology but is not by itself a focus trap |
| it can be **dismissed**, and the World becomes operable again | **product obligation**: provide a platform-appropriate dismissal. `Modal.onRequestClose` handles the paths RN documents — see below. It is **not** a universal keyboard-Escape mapping |
| dismissal **restores focus** to the invoking control | on **every** dismissal path, including a visible Passage action — not only the back gesture |

**B4R-REV-02 — the scope of `onRequestClose`, stated exactly.** React Native's own documentation says
the callback fires when the user taps **the hardware back button on Android or the menu button on
Apple TV**, and on **iOS** when a Modal is dismissed by **drag gesture** with `presentationStyle` of
`pageSheet` or `formSheet`, or when `allowSwipeDismissal` is enabled. B4 called this "the platform's
Escape". That overstated it: **no keyboard Escape is in that list.**

The correction narrows the *API claim* and leaves the *product obligation* exactly where B3R put it:

- **Product obligation (unchanged, from I-08B3.1-B3R):** a modal PASSAGE must offer a
  platform-appropriate way to dismiss it, and dismissal must restore a coherent focus context.
- **React Native:** `Modal.onRequestClose` covers the platform dismissal paths RN documents, and is
  required on Android and TV. Note the side effect RN calls out: while the modal is open,
  `BackHandler` events are not emitted.
- **Everything else is per-platform work, not an inherited guarantee.** Hardware-keyboard **Escape**,
  the accessibility escape gesture (iOS two-finger Z / VoiceOver, Android TalkBack), and any other
  platform dismissal path must be **implemented and verified on each platform and input path the
  product actually supports.**

No keyboard API is invented here. Where RN does not document one, this package says so rather than
naming a prop that would look like a guarantee.

**A named production hazard with no DOM analogue.** Do **not** put `accessible={true}` high in the
modal's body tree: *"it collapses children into one element and hides the buttons from focus."* Label
a header node instead. This would silently destroy the focus containment B3R spent a whole revision
proving, and nothing visual would say so — which is the same shape as the defect B3 found in its own
first implementation.

**The scrim** is the `qandeel.role.passage.scrim` token applied as a full-bleed layer beneath the
PASSAGE and above the World. It is not a Modal presentation style and not a platform default; the
value is the frozen one.

**And the warning that generalises.** `accessibilityViewIsModal` is the native cousin of
`aria-modal`, and the same rule applies: **it does not make the layer modal.** Nothing does except
the behaviour. The one thing B3R established beyond argument is that a declaration of modality and
modality are different things.

---

## 5. The FIELD

**An editable FIELD must use real platform text-input semantics** — `TextInput`, with the label,
hint and state the platform expects. B3's proof harness used a focusable `div` in places; that was
adequate for a visual and containment proof and is not a production textbox specification.

**Not frozen here:** controlled (`value` + `onChangeText`) versus uncontrolled (`defaultValue` +
`onChangeText`). The uncontrolled form is preferred where React does not need to transform, mask,
validate or own the value on every keystroke, and the controlled form can flicker or drop characters
during fast typing on the legacy architecture. That is a **state-ownership decision**, not a Surface
decision, and B4 has no authority over it.

**The boundary, not the fill, is the FIELD.** Whatever the input component is, the Class S line on
the commit boundary is what tells it apart — so the Class S colour being deferred to E/F is a real
dependency for the FIELD, not a cosmetic one.

---

## 6. The ASIDE

The Product role is one thing; the component is many. **A menu-like ASIDE and an informational ASIDE
are different components with different accessibility semantics and the same fill token.**

**This is where the mapping is genuinely incomplete, and it is stated rather than guessed.** B3R
established the DOM patterns — menu button + menu with a roving tab stop; disclosure + `role="note"`
for informational content. Their React Native equivalents are **not** settled:
`accessibilityRole` has no `menu`/`menuitem` pair with the same contract, and there is no native
analogue of `role="note"`. **Open dependency D-7.** The B4 rules that do hold regardless:

- the World stays live and operable — nothing goes inert, nothing gets `accessibilityViewIsModal`;
- there is no scrim;
- the fill is `role.aside.fill`, the same token as PASSAGE;
- it can be **dismissed by a platform-appropriate means** where dismissal is appropriate at all, and
  dismissal **restores a coherent focus context**.

  **B4R-REV-02.** B4 wrote this as "Escape (`onRequestClose`, or the platform equivalent)". Both
  halves were wrong for an ASIDE. `onRequestClose` is a **`Modal` prop**, and an ASIDE is
  **nonmodal** — it does not use `Modal`, so the prop does not exist for it; and `onRequestClose` is
  not keyboard Escape in any case. The obligation is platform-neutral, and naming a modal API inside
  the nonmodal role's contract is precisely the kind of drift that turns an ASIDE into a PASSAGE one
  convenient prop at a time. **ASIDE remains nonmodal: the World stays live, nothing goes inert,
  nothing receives `accessibilityViewIsModal`, and there is no scrim.**

---

## 7. Accessibility preferences

| preference | API | availability | QANDEEL |
|---|---|---|---|
| Reduce Transparency | `AccessibilityInfo.isReduceTransparencyEnabled()` | **iOS only** | **No branch.** The Surface is opaque; the transform is the identity. Proven at the token layer (INV-11) and at the pixel layer by B3 (0 of 5,235,264 pixels). |
| Increased contrast (iOS) | `AccessibilityInfo.isDarkerSystemColorsEnabled()` | **iOS only** | feeds the `contrast` modifier's input |
| Increased contrast (Android) | `AccessibilityInfo.isHighTextContrastEnabled()` | **Android only** | feeds the same input |
| Reduce Motion | `AccessibilityInfo.isReduceMotionEnabled()` | cross-platform | outside B4's authority |
| Screen reader | `AccessibilityInfo.isScreenReaderEnabled()` | cross-platform | outside B4's authority; open dependency D-6 |

**There is no cross-platform "increase contrast" signal.** Two single-platform APIs express the same
user intent. The `contrast` modifier's input must therefore be a **product-level resolution of both
signals**, computed once beside the appearance resolution. Its values are unassigned and owned by
I-08B3.1-F — and, per the architecture, resolving into them fails loudly rather than returning the
standard expression.

`isScreenReaderEnabled()` returns a **Promise**; a bare synchronous `if` on it is always truthy.

---

## 8. What is deliberately not specified

- No component library, no file layout, no naming for components.
- No animation, no transition, no presentation style.
- No `accessibilityRole` for the ASIDE patterns — **D-7**, open.
- No screen-reader announcement behaviour for any role — **D-6**, open.
- No Light values, no increased-contrast values, no Class S colour, no focus token.
- No RTL guidance. QANDEEL is right-to-left throughout and that is settled elsewhere; **B4 authors
  no layout**, and a mapping document inventing layout rules would be exactly the hidden
  implementation task the brief forbids.
