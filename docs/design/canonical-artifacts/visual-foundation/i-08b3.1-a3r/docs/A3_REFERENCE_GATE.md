# I-08B3.1-A3 — REFERENCE GATE — VERIFIED EVIDENCE

**Status: PASSED.** Every source below was **re-fetched in this session**, not quoted from the
A2 package. For each: the exact source, its current version or date as the document itself
exposes it, the principle taken, and the concrete effect on A3.

No source is used ornamentally. Where a source says something A3 cannot act on, that is
recorded as a limit rather than paraphrased into a claim — and where a source has **changed
since A2**, or where **A2 attributed something to the wrong page**, that is recorded too.

**How they were fetched.** The W3C documents render as static HTML and were read directly. The
Apple and Material pages are client-rendered single-page applications: a plain fetch returns
only a title, so they were opened in a real browser and their visible text read. That is stated
because a gate whose method cannot be repeated is not evidence.

---

## What changed since A2

| Source | At A2 | At A3 | Material? |
|---|---|---|---|
| **CSS Color Module Level 4** | Candidate Recommendation | **Candidate Recommendation Draft, 13 September 2026** | **Yes** — the gamut-mapping section now names **three** algorithms and lets an implementation choose. See principle 3 |
| **WCAG 2.2** | W3C Recommendation, 12 December 2024 | **unchanged** — W3C Recommendation, 12 December 2024 | no |
| **Apple HIG — Color / Dark Mode / Accessibility** | cited | current as fetched, © 2026 | **Attribution corrected**: the 7:1 target is on the **Dark Mode** page, not the Color page, and carries the qualifier *"especially in small text"*. A2 credited it to Color and dropped the qualifier. See principle 8 |
| **Material 3 — Color roles** | cited for surface roles | current as fetched | no, but the **content-role** half of the page is used at A3 for the first time. See principles 11–13 |

---

## 1. W3C — CSS Color Module Level 4

**Candidate Recommendation Draft, 13 September 2026.** `https://www.w3.org/TR/css-color-4/`

### Principle 1 — the `oklch()` component ranges

The specification gives `oklch()` a lightness percent reference range of `0% = 0.0, 100% = 1.0`
and a chroma percent reference range of `0% = 0.0, 100% = 0.4`.

**Effect on A3.** Every lightness figure in `A3_MEASUREMENTS` is on that 0–1 axis and every
chroma figure on that 0–0.4 axis, so "the Primary came down by 0.0475" and "the highest chroma
in the package is 0.0153" are quantities a reader can check against the specification rather
than against this package's own convention. It is also why the anti-accent ceiling is stated as
`C 0.016` — about 4 % of the chroma axis — rather than as an adjective.

### Principle 2 — a powerless hue, and the exact epsilon

> "When performing color space conversion to a cylindrical polar color space, user agents shall
> treat a hue component as powerless if the chroma … is less than or equal to the epsilon (ε)
> specified for that color space."

For `oklch()` the document states **Powerless hue ε: C <= 0.000004**, and adds that when a
powerless hue becomes missing, "the chroma … is set to zero **to avoid amplifying floating-point
noise**".

**Effect on A3.** `tools/color.mjs` uses exactly `0.000004`, and that constant was **checked
against this draft in this session** rather than carried on trust. It is why the World Base
`#101010` is reported with hue `none` everywhere in this package instead of an arbitrary angle
manufactured out of rounding dust, and why the achromatic diagnostic probe is reported at
`C 0.0000` with no hue at all — a probe that appeared to carry a hue could be mistaken for a
brand value, which is precisely what it must never be.

### Principle 3 — gamut mapping is now implementation's choice (CHANGED SINCE A2)

The current draft lists **three** CSS gamut-mapping algorithms — Binary Search Gamut Mapping
with Local MINDE, EdgeSeeker Gamut Mapping, and Ray Trace Gamut Mapping — and states:
"Implementations m[a]y choose any of the three algorithms based on their quality and runtime
efficiency tradeoffs". It adds: "They all implement a relative colorimetric intent, **thus
colors inside the destination gamut are unchanged**."

**Effect on A3.** This is a real change of posture, not a footnote. If any A3 value needed
mapping, the colour a reader actually saw would depend on which algorithm their browser picked —
and a closure proof cannot rest on that. So A3 added **preflight check 11**, which proves every
one of the 12 colours in the package is already inside the sRGB gamut. Because in-gamut colours
are unchanged by all three algorithms, the question does not arise for this package at all.
That is a stronger position than reasoning about which algorithm Chrome happens to use.

---

## 2. W3C — Web Content Accessibility Guidelines (WCAG) 2.2

**W3C Recommendation, 12 December 2024.** `https://www.w3.org/TR/WCAG22/` — unchanged since A2,
confirmed by re-fetch.

### Principle 4 — SC 1.4.3 Contrast (Minimum)

> "The visual presentation of text and images of text has a contrast ratio of at least 4.5:1"

with **large-scale** defined as "at least 18 point or 14 point bold".

**Effect on A3.** 4.5:1 is the floor every reading value is measured against, on **both**
surfaces, in `A3_MEASUREMENTS.csv` and on `HIERARCHY_RAMP.png`. All three candidates and both
unchanged levels clear it comfortably — which is itself the finding that forced the rest of A3
to exist: **a contrast ratio cannot separate P1 from P2**, so the decision has to be made on
what the raster shows, not on a number.

The large-scale definition is applied **in CSS units**: 1 pt = 1.333 px, so Metadata at
12 CSS px is **9 CSS pt** and is ordinary text owing 4.5:1, not large text owing 3:1. This is
the A2R correction, carried forward deliberately — see principle 10.

### Principle 5 — SC 1.4.11 Non-text Contrast

> "The visual presentation of the following have a contrast ratio of at least 3:1 against
> adjacent color(s): User Interface Components [and] Graphical Objects"

**Effect on A3.** The Analysis Map's connecting lines are a graphical object required to
understand the content, so the diagnostic edge is **solved** to 3:1 rather than picked — and it
is solved against the diagnostic Subtle, the lighter of the two surfaces it can land on, because
a value that passes on the darker surface and fails on the lighter one has not passed. A3 does
**not** promote that solved value into a token; it is scaffolding needed to draw ENVIRONMENT 2
at all.

The same criterion is why ENVIRONMENT 4 has **no dividers**: 1.4.11 does not require a visual
boundary for a control that already has visible content, so the utility rows are separated by
spacing.

### Principle 6 — contrast ratio and relative luminance are defined over the DISPLAYED value

> contrast ratio = "(L1 + 0.05) / (L2 + 0.05)"

WCAG defines relative luminance from 8-bit sRGB channels.

**Effect on A3.** Every ratio in this package is computed from the **quantised hex the browser
paints**, never from the pre-quantisation float, and the authored OKLCH triple is carried
alongside so the gap between intent and display stays visible. The renderer also forces
greyscale antialiasing, because WCAG directs that the criterion be evaluated from the author's
colours rather than the smoothed pixels — this keeps the measured ratios and the raster
describing the same thing.

---

## 3. Apple — Human Interface Guidelines

Fetched from `developer.apple.com/design/human-interface-guidelines/` in this session;
the pages carry a 2026 copyright and no separate version number.

### Principle 7 — colour appears brighter in a dark environment (Color)

> "In bright surroundings, colors look darker and more muted. **In dark environments, colors
> appear bright and saturated.**"

**Effect on A3.** This is the most decision-relevant sentence Apple has for this stage, and it
cuts toward testing rather than trusting: a Primary evaluated on a near-black ground will read
brighter than its number suggests, which is an argument for rendering the lowered candidates
rather than assuming A1's value was already right. It is part of why A3 exists.

It also sets a **limit**, and the limit is recorded rather than glossed: the same page says
"Test your app's color scheme under a variety of lighting conditions." A3 renders under two
**raster** conditions, not two **lighting** conditions. Ambient viewing conditions are not
tested here and A3 makes no claim about them.

### Principle 8 — the 7:1 target for custom colours in Dark Mode (ATTRIBUTION CORRECTED)

From the **Dark Mode** page — not the Color page, which is where A2 attributed it:

> "At a minimum, make sure the contrast ratio between colors is no lower than 4.5:1. For custom
> foreground and background colors, strive for a contrast ratio of 7:1, **especially in small
> text**."

**Effect on A3.** *(Corrected at A3R — see `A3R_REVISION_RECORD.md`.)* QANDEEL's current
canonical visual expression is **dark-led**, and this A3 proof evaluates custom
foreground/background colours in that dark expression. The frozen Visual Constitution is
**DARK-LED, NOT DARK-LOCKED**: the architecture remains theme-capable, and B3.1 is establishing
the canonical dark expression, not ruling other expressions out. Apple's guidance is relevant
because the colours under test here are custom foreground and background colours in a dark
expression — which is exactly the case it addresses — and that relevance does not depend on any
claim about the Product being permanently dark.

The target therefore applies to every reading value in this proof. Measured on the worse of the two surfaces: the control
13.18:1, P1 12.08:1, P2 11.38:1 and the Secondary 7.82:1 all meet it; the **Tertiary reaches
only 5.07:1**. The qualifier A2 dropped is exactly the one that bites — the Tertiary's role is
Metadata at 12 CSS px, which *is* the small text. That shortfall is rendered as a failure
capture and stated in `A3_FAILURES`, and A3 is forbidden to close it by brightening the
Tertiary, so it is left open for the Director.

### Principle 9 — base and elevated backgrounds; four foreground label levels (Dark Mode, Color)

> "the system uses two sets of background colors — called base and elevated … The base colors
> are dimmer, making background interfaces appear to recede, and the elevated colors are
> brighter"

and, for foreground content, iOS defines **Label, Secondary label, Tertiary label and
Quaternary label** — a content ladder that is separate from the background ladder.

**Effect on A3.** Two things. The base/elevated pair is why the diagnostic Subtle exists at all
as proof scaffolding — a reading value has to be judged on the surface it recedes to *and* the
surface it advances to. And the four-level label ladder is why A3 treats the content ramp as its
own question: it is not derived from the surfaces, it is measured against them. Note also the
Color page's rule that a semantic colour must not be reused for another job — "don't use the
separator color as a text color" — which is why the map edge is derived from the World rather
than borrowed from the reading ramp, and why the achromatic probe is never used as a reading
value.

### Principle 10 — small-size legibility is a WEIGHT question, and 11 pt is a NATIVE point (Accessibility)

The platform table gives iOS a **default size of 17 pt and a minimum size of 11 pt**, and the
page adds:

> "Bear in mind that **font weight can also impact how easy text is to read**. If you're using a
> custom font with a thin weight, aim for larger than the recommended sizes to increase
> legibility." — with the captioned rule "**Thicker weights are easier to read for smaller font
> sizes.**"

Its contrast table gives: up to 17 pt → 4.5:1; 18 pt → 3:1; bold at any size → 3:1.

**Effect on A3.** The weight guidance is the source-level support for A3.6: when a small role is
fragile, the lever is weight, and QANDEEL already has that lever inside the frozen 12/20/400–500
role. A3 therefore sets Metadata at 500 in the Product proofs, keeps 400 as a control, and does
**not** touch size, leading, tracking or the Tertiary colour.

**And the limit, stated plainly: Apple's 11 pt is a NATIVE platform point.** This browser proof
establishes **no parity** between a CSS pt and a native iOS pt, so A3 makes no claim about how
close the frozen Metadata role sits to Apple's minimum. That must be validated in the real
iOS / React Native environment, outside A3. This is the A2R correction carried forward verbatim
in posture, and `tools/a3-measure.mjs` says so at the point where the conversion happens.

---

## 4. Material Design 3 — Color roles

Fetched from `m3.material.io/styles/color/roles` in this session.

### Principle 11 — surface for a background area, surface container for navigation

> "There are three surface roles: **Surface** – Default color for backgrounds … **On surface** –
> Text and icons against any surface or surface container color … **On surface variant** –
> Lower-emphasis color for text and icons"

and five surface container levels, of which:

> "The most common combination of surface roles uses surface for a background area and surface
> container for a navigation area."

**Effect on A3.** Every environment is a body on `--world` with a navigation strip on the
diagnostic `--subtle`, with no border and no shadow between them. That mapping is unchanged from
A2 and is why the diagnostic Subtle is present in an A3 board at all.

### Principle 12 — content colour is used on ALL surfaces (new use at A3)

> "**Text and icons typically use on surface and on surface variant on all types of surfaces.**"

**Effect on A3.** This is the rule that shapes `HIERARCHY_RAMP.png`. A content value does not
belong to one surface; it has to hold its relationship on every surface it can reach. So the
board renders the complete Primary/Secondary/Tertiary relationship **twice — on the World Base
and on the diagnostic Subtle** — and the measurement table reports both, plus the worse of the
two. Measuring only against the darkest ground would have flattered every candidate and would
have hidden the Tertiary's shortfall.

### Principle 13 — role mappings stay the same across breakpoints (new use at A3)

> "All color mappings – but especially surface colors – should remain the same for layout
> regions across breakpoints. For example, the body area will use the surface color and the
> navigation area will use the surface container color on both mobile and tablet."

**Effect on A3.** The mobile condition in A3.7 keeps the **identical role mapping** — body on
`--world`, navigation on `--subtle`, the same three content levels — and changes only geometry.
It does not invent a phone-specific palette, which would have made the robustness check compare
two different designs instead of two raster conditions.

### Principle 14 — an observation the sources cannot settle for us

Material 3 gives content **two** levels (`on surface`, `on surface variant`). Apple gives
**four** (label, secondary, tertiary, quaternary). QANDEEL's frozen reading system has
**three**.

**Effect on A3.** Neither source can adjudicate a three-level ramp, because neither has one.
That is recorded as a reason the question is answered from the raster and from measured OKLCH
steps rather than by appeal to authority — and it is why `CONTROL_COLLAPSED_HIERARCHY.png` was
rendered, so the ramp has a zero-separation floor of its own to be judged against.

---

## 5. What these sources do NOT establish for A3

Stated explicitly, because an omission reads as an oversight:

- **No source tested here can choose between P1 and P2.** Every candidate clears every published
  floor on both surfaces. The sources set the boundaries of the legal region; they do not pick a
  point inside it.
- **No source here is a perceptual measurement.** None of them reports a difference threshold
  for near-white text on a near-black ground, and A3 ran no study, so A3 makes no
  threshold claim of any kind.
- **No source here establishes native platform parity.** Apple's figures are in native points
  and this is a browser raster. The native question is named and deferred, not answered.
- **No source here covers ambient lighting.** Apple asks for testing under varied lighting;
  A3 cannot do that and does not claim to have done it.
