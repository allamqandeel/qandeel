# E1_REFERENCE_GATE

**I-08B3.1-E1.** A targeted fresh consultation of first-party and normative sources,
performed on **2026-09-22**, answering four questions for each: what did we learn, what
did it change for QANDEEL, what did it not change, and **what did the executor actually do
differently**.

Sources were read in full at the URLs below, not recalled.

**I-08B3.1-E1R DELTA: two more sources, and one that could not be reached.** §9 and §10 are
the E1R additions; §11 records the source that was needed and was unavailable. The eight
E1 sources were not re-read and nothing in §§1–8 changed.

---

## 1. WCAG 2.2 — SC 1.4.1 Use of Color (Level A)

`https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html`

**Learned.** Normative: *"Color is not used as the only visual means of conveying
information, indicating an action, prompting a response, or distinguishing a visual
element."* And an escape hatch in the Understanding text: colours that "differ not only in
their hue, but that also have a significant difference in lightness" at "a contrast ratio
of 3:1 or greater" count as an additional visual distinction.

**Changed.** E1 went and measured the escape hatch instead of assuming it. **The error ink
reaches 1.03:1 against the secondary reading ink and 1.58:1 against the tertiary.** The
lightness route is closed in QANDEEL, which converts a generic rule into a specific fact
about this palette.

**Did not change.** The decision to give error a colour at all.

**Did differently.** The measurement is quoted on board `b06` and is the reason the
`com.qandeel.companion` extension exists as a *contract* on each status role rather than as
advice in a document.

---

## 2. WCAG 2.2 — SC 1.4.11 Non-text Contrast (Level AA)

`https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html`

**Learned.** ≥ 3:1 **against adjacent colour(s)** for "visual information required to
identify user interface components and states, **except for inactive components**". A focus
indicator must have sufficient contrast against the adjacent background.

**Changed.** Two things. First, the "adjacent colours" wording is what made E1 test the
indicator against **every colour QANDEEL can paint beside it**, not just the two grounds —
and that test is what the dark companion exists to pass. Second, the inactive exception is
why `E1_ACCESSIBILITY_BASELINE.md` states plainly that the unavailable ink does not claim
AA, rather than quietly reporting 3.14:1 as if it did.

**Did differently.** Check **R10** became a two-sided claim: the pair covers 13 of 13, and
**the indicator alone covers only 5 of 13**. Without the second half, the companion looks
like decoration.

---

## 3. WCAG 2.2 — SC 2.4.13 Focus Appearance (Level AAA)

`https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html`

**Learned, and it corrected a wrong assumption.** The criterion is a **change-of-contrast**
test — "at least 3:1 between the same pixels in the focused and unfocused states" — and the
document says so explicitly: *"This is different from … Non-text Contrast … which measure
the contrast between different adjacent pixels."* The area requirement is "at least as
large as the area of a 2 CSS pixel thick perimeter of the unfocused component".

**Changed.** E1 had been treating 2.4.13 as an adjacency requirement. It is not. The two
criteria were separated, and the 2 px is now cited as **the specification's own figure**
and classified as a floor rather than as a value E1 chose.

**Did not change.** The detached two-tone construction, which turned out to serve 1.4.11.

---

## 4. Apple Human Interface Guidelines — Color

`https://developer.apple.com/design/human-interface-guidelines/color` (change log: updated
2025-12-16)

**Learned.** Five things that bear directly:

1. *"Avoid using the same color to mean different things … if you use your brand color to
   indicate that a borderless button is interactive, using the same or similar color to
   stylize noninteractive text is confusing."*
2. *"Avoid relying solely on color to differentiate between objects, indicate
   interactivity, or communicate essential information … you can use text labels or glyph
   shapes to identify objects or states."*
3. *"Apply color sparingly … reserve it for elements that truly benefit from emphasis, such
   as status indicators or primary actions."*
4. *"If you define a custom color, make sure to supply light and dark variants, and an
   increased contrast option for each variant."*
5. iOS's own foreground ladder is **Label / Secondary label / Tertiary label / Quaternary
   label**, and macOS names `disabledControlTextColor` — "the text of a control that's
   unavailable" — and `keyboardFocusIndicatorColor` — "the ring that appears around the
   currently focused control".

**Changed.** (5) is the one that mattered most. E1 derived the unavailable ink as a
**fourth rung** of QANDEEL's three-rung reading ramp, and Apple's own ladder has exactly
that fourth rung, arrived at independently. It also confirmed the choice of an **ink**
rather than an opacity: the platform expresses unavailability as a text colour.
(1) is the Brass boundary restated by the platform. (4) is why the light appearance is
empty **and named**, and why F inherits four obligations rather than two.

**Did not change.** The refusal of a brand-coloured selected state. The platform's tab-bar
guidance points the other way and C2 captured what is being given up.

**And one thing that argues AGAINST E1, recorded rather than buried.** The page warns:
*"Consider how the colors you use might be perceived in other countries and cultures. For
example, red communicates danger in some cultures, but has positive connotations in other
cultures,"* illustrated with the Stocks app showing red as a **positive** trend in Chinese.
QANDEEL is Arabic-native. The illustration is about **trend direction in finance**, not
about failure, and error-red is well established in Arabic-language software — but the
warning is real and it is the one place E1 kept a convention. It is carried into
`E1_KNOWN_LIMITATIONS.md` §2 as an open Product question rather than argued away here.

---

## 5. Apple Human Interface Guidelines — Accessibility

`https://developer.apple.com/design/human-interface-guidelines/accessibility`

**Learned.** *"Convey information with more than color alone. … people who are color blind
may have particular difficulty with pairings such as red-green and blue-orange. Offer
visual indicators, like distinct shapes or icons, in addition to color."* The contrast
table: 4.5:1 up to 17 pt, 3:1 at 18 pt or bold. And: support enlargement to at least 200
percent.

**Did differently.** "Distinct **shapes**" is why the four status marks are specified as
**silhouettes from four different families** — circle, triangle, open check, bare
letterform — rather than as four variations of a circle. And 200 percent is board `b16`
rather than an assurance.

---

## 6. Apple HIG — tvOS note on focus

Same Color page, platform considerations.

**Learned.** *"Avoid using only color to indicate focus. Subtle scaling and responsive
animation are the primary ways to denote interactivity when an element is in focus."*

**Did differently.** Reinforced that focus is carried by **geometry and detachment** in E1,
not by a hue — and it is why focus introduces no colour at all.

---

## 7. Material Design 3 — States / state layers

`https://m3.material.io/foundations/interaction/states/state-layers`

**Learned.** *"A state layer is a semi-transparent covering … the state layer is an overlay
with a fixed opacity for each state and **uses the same color as the content**."*
*"**Only one state layer can be applied at a given time.**"* Values: hover +8 %, focus
+10 %, press +10 %, drag +16 %.

**Changed.** Two things, in opposite directions.

- **Adopted:** "uses the same color as the content" independently confirms E1's decision to
  make the press wash out of the Product's own reading ink rather than white. And 10 % is
  taken as the **production default** for the press presence, cited rather than derived.
- **Diverged, deliberately:** "only one state layer at a given time" means Material cannot
  express focus and press simultaneously, and cannot express focus and selection as
  different kinds of thing. For a product where selection and focus must coexist and be
  told apart, that is not a detail. **E1 takes the opposite architecture: the states write
  different channels, and where two of them write the same one a declared precedence rule
  resolves it.** The divergence is named here so that it reads as a choice rather than as
  ignorance of the reference.

  **I-08B3.1-E1R note.** E1 stated this divergence as *four states, four channels, none used
  twice* — which was a stronger claim than the architecture needed and, as REV-02 found, not
  a true one. The divergence from Material survives the correction intact: what matters is
  that QANDEEL can express focus and selection **at once and as different kinds of thing**,
  and it still can.

---

## 8. Material Design 3 — Color roles

`https://m3.material.io/styles/color/roles`

**Learned, and this is the single most load-bearing reference result.** *"There are 26
standard color roles organized into six groups: primary, secondary, tertiary, **error**,
surface, and outline."* **Error is the only status role among them.** There is no warning
role, no success role and no info role in the standard set. Also: *"Error is an example of
a static color (it doesn't change even in dynamic color schemes)."*

**Changed.** It converted E1's analysis from a lone refusal into a convergence. The most
widely deployed design system in the world ships exactly one status colour and it is error
— the same answer E1 reached from QANDEEL's own doctrine, by a different route. That is
also why the error value is classified product-contract rather than theme-derived: Material
exempts error from dynamic colour for the same reason.

**Did not change.** The three refusals still carry their own falsifiable conditions; the
convergence is corroboration, not authority.

---

## 9. W3C ARIA Authoring Practices Guide — Developing a Keyboard Interface

`https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/` · **read 2026-09-22 for
I-08B3.1-E1R** · *Focusability of Disabled Controls*

**Learned.** Three things, and the second is the one that mattered.

> "Browsers remove HTML input elements with the `disabled` attribute from the tab sequence."

> "there are some contexts where it is useful for an element to convey a disabled state
> while remaining focusable, especially inside of composite widgets. This can be
> accomplished by applying the state `aria-disabled="true"`."

> **"Screen reader users are far less likely to discover disabled elements that are not
> focusable because moving focus is one of their primary methods of discovery."**

It names the cases — disabled toolbar buttons, listbox options, menu items, tabs, tree
items — and it names the counter-pressure: *"allowing keyboard users to skip disabled
elements usually reduces the number of key presses required to complete a task."* Its
resolution is not a rule but a discipline: adopt *"consistent pattern-based conventions for
the focusability of disabled elements."*

**Changed.** It **falsified a frozen I-08B3.1-E1 product contract.** E1 froze that an
unavailable control is never focusable and never in the tab ring — one of the two patterns
this page describes, and the one with the discovery cost, frozen as though it were the only
one. REV-01 exists because of this page.

**Did not change.** The disabled *expression*. One ink for the whole control, a stated
reason, no activation. The page is about focus order and says nothing about paint, which is
why E1R could correct the contract without touching a single accepted visual.

**Did differently.** Two patterns ship as a **declared, checkable convention** rather than as
a rule — `com.qandeel.availability`, asserted by check R26 with E1's own absolute as its
probe — because "consistent pattern-based conventions" is a request for a convention, and a
convention that lives only in prose is not one. And the DISCOVERABLE pattern is exercised
behaviourally: reached by a real Tab, refusing a real Enter.

---

## 10. MDN — `aria-disabled`

`https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled`
· **read 2026-09-22 for I-08B3.1-E1R**

**Learned.** Two things `aria-disabled` does **not** do, both of which have to be written by
hand:

> "aria-disabled does not change the focusability of such elements, nor will the elements be
> dimmed by default browser styling"

> "In contrast to the HTML `disabled` attribute, where specifying it provides `:disabled`
> user-agent styles to be applied, adding `aria-disabled="true"` doesn't."

> **"Web developers must manually ensure such elements have their functionality
> suppressed."**

And it names as an example exactly QANDEEL's case: *"a button which is important to keep in
the page's focus order, but its action is presently unavailable."*

**Changed.** It turned the DISCOVERABLE pattern from a one-line contract into **two
obligations with two probes**. A pattern that costs the implementer nothing would not need
either.

**Did not change.** The visual-invariance rule. Both patterns look the same; MDN's own
example uses `opacity: 0.5`, which QANDEEL cannot use — an alpha on the whole control is the
thing `E1_DISABLED_COLLISION_RESOLUTION.md` §3 rejects, and E1R keeps the derived ink.

**Did differently.** The page script suppresses activation on every `aria-disabled` control
and each control counts its own activations, so a **real Enter key** can be pressed and the
result read back. Two probes come straight out of these sentences: one drops the suppression
— reachable, painted unavailable, fully operable — and one styles only the native pattern,
which is what happens when an implementer styles whatever the user agent hands them.

---

## 11. The source that could not be reached, and was not paraphrased

`https://reactnative.dev/docs/accessibility` — **attempted three times on 2026-09-22 from
this host and returned nothing.**

It was needed. `E1_REACT_NATIVE_MAPPING.md` **D-E1-6** claims a React Native form for the
DISCOVERABLE pattern — `accessibilityState={{ disabled: true }}` on a control left focusable
with `onPress` suppressed — and the question that decides whether it is right is what each
platform's accessibility focus traversal does with a control in that configuration.

**No first-party wording is quoted for it and none was invented.** The mapping is marked
unverified, it is named in the freeze candidate's list of what review should attack, and it
is the largest untested claim I-08B3.1-E1R adds. A Reference Gate that quietly reconstructed
the page from memory would have produced a more confident document and a less true one.

---

## 12. What was deliberately NOT reopened

Broad Product research was not repeated. The frozen foundations — I-08B3.0, the Surface
system, Living Brass, QANDEEL Light — were read as constraints, not re-litigated. No
contradiction with them appeared, with one exception that is not a contradiction but a
correction: the *restatement* of the inherited disabled collision in C2 and C3 does not
survive measurement, and `E1_DISABLED_COLLISION_RESOLUTION.md` sets out why, without
touching a single frozen value.
