# E1_ACCESSIBILITY_BASELINE

**I-08B3.1-E1.** The accessibility contract E1 establishes for these states, what it
verified, and — as importantly — what it does not claim.

E1 is not Phase F. It does not deliver the Increase Contrast derivation, the Light
appearance, the Reduced Transparency transformation or the full alternate-expression
system. **It must not knowingly freeze inaccessible semantics**, and this document is the
account of whether it has.

---

## 1. Colour is not the sole carrier — and here that is a measurement

WCAG 2.2 **SC 1.4.1 Use of Color** (Level A): *"Color is not used as the only visual means
of conveying information, indicating an action, prompting a response, or distinguishing a
visual element."*

Its Understanding document permits a lightness difference at 3:1 to count as the
additional distinction. **E1 measured that and it is unavailable**: the error ink reaches
1.03:1 against the secondary reading ink and 1.58:1 against the tertiary. So the glyph,
the copy, the promoted boundary and the programmatic state are load-bearing.

`E1_NON_COLOUR_COMPANION.md` holds the channel inventory and the reason the four status
silhouettes are drawn from four different families.

---

## 2. Text contrast

| | on the World `#101010` | on the functional Surface `#181818` | verdict |
|---|---|---|---|
| PRIMARY `#d8d5ca` | 12.95:1 | 12.08:1 | AAA |
| SECONDARY `#afaca3` | 8.38:1 | 7.82:1 | AAA |
| TERTIARY `#8b8982` | 5.44:1 | 5.07:1 | AA |
| **ERROR `#fe907e`** | **8.61:1** | **8.04:1** | **AAA** |
| **UNAVAILABLE `#696762`** | 3.37:1 | 3.14:1 | **exempt — see §5** |

The error ink also holds **≥ 4.5:1 on both grounds under simulated protanopia and
deuteranopia** (7.19/6.71 and 9.14/8.53). That is a floor in the derivation, not an
observation after the fact.

Apple's own table is the one E1 checked against: 4.5:1 up to 17 pt, 3:1 at 18 pt or bold.

---

## 3. Focus, against both criteria that apply to it

There are two, they measure different things, and E1 addresses them separately.

**SC 2.4.13 Focus Appearance (AAA)** — an area at least as large as a **2 CSS pixel thick
perimeter** of the unfocused component, with **≥ 3:1 between the same pixels focused and
unfocused**. It is explicitly *not* about adjacent colours.

- Area: the indicator **is** a 2 px perimeter. The figure is taken from the criterion.
- Change of contrast: `#101010` → `#d8d5ca` is **12.95:1**; `#181818` → `#d8d5ca` is
  **12.08:1**.

**SC 1.4.11 Non-text Contrast (AA)** — **≥ 3:1 against adjacent colour(s)**.

- The indicator **alone** reaches 3:1 against only **5 of the 13** colours QANDEEL can
  paint beside it. It fails against every ink, against Living Brass, against all three
  Light stops and against the error.
- **The pair reaches 3:1 against all 13.** The dark companion is what covers the other
  eight. Full table in `E1_VALIDATION_RESULTS.md` §6, check **R10**.

**And the behavioural half**, which no still image can establish: real `Tab` key events and
a real `Enter` key through a real browser, **15/15 obligations met, 5/5 probes fired**. It
caught a defect — an earlier build styled only the simulated attribute, so the keyboard got
Chrome's 1 px default outline while every board painted the E1 indicator.

**The perimeter on an unavailable control is not dimmed with it.** Under the DISCOVERABLE
pattern a focused unavailable control paints the indicator in the focus tokens, measured at
full value: the perimeter belongs to the input system, and the input system is not
unavailable. That is precedence rule P3, and it is an obligation rather than a preference.

"Do not remove focus outlines without a visible replacement" is not advice here; it is the
second behavioural probe, which strips the outline and requires the visibility obligation
to reject the result.

---

## 4. Forms and errors

Every error in every proof carries, in the markup rather than in a caption:

- `aria-invalid="true"` on the control;
- `aria-describedby` from the control to its message;
- `role="alert"` on the message, so a change announces;
- a label bound with `for` / `id`;
- a glyph marked `aria-hidden="true" focusable="false"`.

A **disabled commit states why**, in a real adjacent element the button points at with
`aria-describedby`. That is one of the rules E1 read, and the reason is that a disabled
submit with no explanation is a dead end for everyone and an invisible one for a screen
reader.

---

## 5. Unavailable — the exemption E1 does not hide behind, and the absolute E1R withdrew

SC 1.4.11 exempts "inactive components", and SC 1.4.3 exempts text that is part of an
inactive user interface component. **E1 does not claim AA for the unavailable ink.**

What it claims is that an unavailable control is *recognisable but clearly unavailable*,
and it carries that on four channels: one ink for the whole control (losing its internal
hierarchy), the platform-appropriate programmatic disabled state, **activation suppressed**,
and a stated reason. Three of those four are not paint.

### 5.1 Focusability is a separate decision, and E1 got it wrong

I-08B3.1-E1 froze, as Product contract, that an unavailable control is never focusable and
never in the tab ring. That is one of two legitimate patterns, frozen as though it were the
only one, and **it is the pattern with the accessibility cost**. W3C's ARIA Authoring
Practices Guide is direct about it: *"screen reader users are far less likely to discover
disabled elements that are not focusable because moving focus is one of their primary
methods of discovery."* The same page names the cases where a disabled control must stay
reachable — toolbar buttons, listbox options, menu items, tabs, tree items — and asks for
*"consistent pattern-based conventions for the focusability of disabled elements"*.

E1R ships two patterns, visually identical, differing only in focus-order membership:

| | NATIVE NON-DISCOVERABLE | DISCOVERABLE |
|---|---|---|
| in the focus order | no | **yes** |
| can activate | no | no |
| what it costs | discovery, for a screen-reader user | a keystroke, for every keyboard user |

**The DISCOVERABLE pattern costs two things it is easy to forget**, and MDN names both:
`aria-disabled` *"does not change the focusability of such elements, nor will the elements
be dimmed by default browser styling"*, and *"web developers must manually ensure such
elements have their functionality suppressed."* So the paint must be asked for and the
activation must be blocked. Both are done, both are measured under real keys, and both have
a probe — one strips the suppression (reachable, painted unavailable, fully operable), the
other styles only the native pattern (unavailable and painted as though available).

The failure condition the brief names is "Disabled becomes unreadable". At 3.14:1 on the
functional Surface the unavailable ink is above the 3:1 large-text threshold and well above
the retired diagnostic carrier's 2.57:1 — a *better* position than the inherited baseline,
not a worse one.

---

## 6. Colour-vision variation

Simulated with **Viénot, Brettel & Mollon (1999)** on linear-light sRGB, transcribed and
exercised by 26 property tests that do not depend on remembering the constants.

- **Protanopia and deuteranopia are floors in the derivation**, not checks after it. The
  two binding constraints on the entire error value belong to a protanope.
- **Tritanopia is excluded from every floor**, because the single-plane simplification is
  not validated for it. A property test asserts that limit rather than hiding it, so
  anyone who starts feeding tritan into a floor fails loudly. Tritanopes retain red–green
  discrimination, and the error's identifiability for them rests where it rests for
  everyone: the non-colour channels.
- `b13-integrated-protanopia.png` and `b14-integrated-deuteranopia.png` are the integrated
  screen transformed **from the raster Chrome drew**, not re-rendered with different
  tokens. Re-rendering would only prove that a different scene looks different.

---

## 7. Greyscale

`b12-integrated-greyscale.png` is the integrated screen under WCAG's own relative-luminance
transform: **0 chromatic pixels, 199 distinct greys**. Every state and every status is
still identifiable, because every one of them ships a non-colour channel.

---

## 8. Enlarged text

Apple asks for at least 200 percent. `b16-text-200.png` puts the states and the error field
at 200 %: the marker, the detached indicator and the promoted boundary all scale with the
control, because each is expressed in logical properties against the control's own box
rather than as a fixed offset. The error message wraps and keeps its glyph on the first
line.

Arabic line-height is 1.65 throughout — below roughly 1.6 the ascenders, descenders and
diacritics clip, and clipping risk doubles wherever text is truncated.

---

## 9. What E1 does NOT claim

- **No screen reader ran.** The programmatic attributes are correct and present; the
  announcement was not heard.
- **No device has seen one frame.** Every measurement is from headless Chrome at
  device-pixel-ratio 2 with LCD antialiasing and subpixel positioning disabled.
- **The Light appearance is empty on purpose.** Resolving into it leaves both E1 values
  UNRESOLVED and names what is missing — check **R17**. A light set carrying a copy of the
  dark values would be a light-mode error colour invented by accident: every floor that
  produced `#fe907e` is a statement about a **near-black** ground, and on a light ground
  its contrast relationships invert and the dichromacy floors are measured against
  different simulated neutrals. Owned by **F**.
- **The increased-contrast contexts are inherited from B4R and are empty.** Apple is
  explicit that a custom colour needs light and dark variants *and* an increased-contrast
  option for each. E1 supplies none of them and says so.
- **Reduced motion** is not addressed, because E1's only motion is a press response of one
  duration and one scale, classified production-default craft. Under a reduced-motion
  setting the scale is dropped and the ground response remains, which is a one-line
  implementation note rather than an alternate expression — and it is recorded in
  `E1_IMPLEMENTATION_BOUNDARIES.md`, not designed here.
