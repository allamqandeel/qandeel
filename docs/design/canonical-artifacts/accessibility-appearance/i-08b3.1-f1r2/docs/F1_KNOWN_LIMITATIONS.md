# I-08B3.1-F1 — KNOWN LIMITATIONS

Ordered by how much they should worry a reviewer.

---

## 0. THE SEMANTIC PARITY PROOF IS BOUNDED TO THE DIMENSIONS THE FIXTURE SUPPLIES.

Added by I-08B3.1-F1R2, and it belongs at the top because it qualifies the package's headline
result.

The parity matrix supplies `epistemic`, `temporal` and `actionable`. **It proves preservation for
those dimensions and for no others.** F1R described that three-field allowlist as *"the complete
list of what a projection may carry"* — a bounded test fixture describing itself as the Product's
semantic model, which is the same class of error as the fixture's values reading as Product
semantics, one level up.

A real canonical V may legitimately expose **evidence, provenance, uncertainty or qualification**,
and other user-exposable semantic fields. **None of those is tested here, because no canonical V
exists in this package**, and inventing field names to fill the list would be the same failure
again.

What stands is the contract, `qandeel.accessibility.projection.completeness`:

> **NO USER-EXPOSABLE DISCLOSED ANALYTICAL TRUTH MAY BE LOST SOLELY BECAUSE THE EXPRESSION IS
> ACCESSIBLE.**

and the dependency it does not discharge:

> **PRODUCTION ACCESSIBILITY MAPPING MUST BE EXHAUSTIVE AGAINST THE ACTUAL USER-EXPOSABLE V
> SCHEMA** — writable only once the canonical V schema is integrated.

The one thing F1R2 could do here without a schema, it did: `project(V)` no longer drops an unmapped
field in **silence**. A supplied field the projector has no mapping for is reported in
`$unmappedFields`, so a bounded projector's limit is **detected** rather than invisible. Checks
**B-01**, **B-02**, **B-03**.

## 1. NO SCREEN READER WAS RUN. This is the largest gap.

Part F's evidence is a **browser accessibility tree**, read out of Chrome over the DevTools
protocol. That is real evidence — every name is what an engine computed, not what the generator
intended — and it is **not VoiceOver and not TalkBack**.

What it cannot tell you: how the Arabic is pronounced, whether the traversal order is
comfortable, whether the PATTERN sentence is too long to hear, whether the heading-based axis
model is usable in practice, or how either screen reader handles a text view composed over a
canvas. **All of that needs a device and a person.**

**This is not closed by another F1 stage and I-08B3.1-F1R2 did not open one.** It is a **mandatory
implementation / integration validation gate**: a real VoiceOver run and a real TalkBack run, on
hardware, before QANDEEL ships the accessible expression. **Browser AX-tree evidence is not
screen-reader validation**, and nothing in this package should be read as claiming otherwise. It is
carried in `F1_F2_CARRY_FORWARD.md` as a gate, not as a wish.

## 2. NO DEVICE, ANYWHERE IN THIS PACKAGE.

Everything is rendered headless on Windows at a 390 pt viewport with `deviceScaleFactor: 2`.
No iOS, no Android, no simulator, no hardware.

Consequences that follow directly:

- **`qandeel.accessibility.text.label-escape-scale` = 1.6 is a measured property of THIS
  viewport** and will differ on another. It is classified production-default for that reason.
- Every platform claim in `F1_PLATFORM_MAPPING.md` is a claim about an **API surface** read from
  source, not about behaviour on hardware.
- Android's **nonlinear font scaling** above 1.3× on Android 14+ is not modelled; the multiplier
  ladder is iOS's.
- Nothing about **performance** under any setting was measured. Drawing 90 opaque strokes instead
  of 90 composited ones should be cheaper, and that is a guess.

## 3. NO NATIVE ARABIC COPY REVIEW.

The Arabic in this package is F1's, written against the register and structure rules rather than
translated, with counted-noun agreement implemented rather than eyeballed. It has **not been read
by a native reviewer**. The PATTERN sentence in particular is Product copy standing in for
Product copy that does not exist yet.

## 4. THE OPAQUE SCRIM MAY READ BETTER THAN THE TRANSLUCENT ONE.

Under Reduce Transparency the PASSAGE scrim becomes opaque, and B4R's own words make that *more*
faithful: the World behind a PASSAGE is **suspended**, and a translucent scrim leaves a suspended
World faintly visible.

If a reviewer agrees, **the question that raises is about the default, not about the accessible
mode** — and F1 has no authority to change the default scrim. Handed up.

## 5. WHERE TWO CONTOURS CROSS, REDUCE TRANSPARENCY LOOKS DIFFERENT.

Translucent strokes tint each other at a crossing; opaque ones do not, and the nearer depth plane
wins. Nothing analytical is lost — `PRESENTATION_CONTRACT` declares contour shape, radius and hue
all `encodes: null` — but it is a **visible difference**, stated rather than claimed away as
invariance.

## 6. THE INCREASED-CONTRAST TARGET IS ADOPTED, NOT OBLIGED.

WCAG 2.2 SC 1.4.11's 3:1 is used as the **target** for the increased-contrast expression because
a user who turns that setting on has asked for separation. I-08B3.1-D2R argued on the record that
a contour is **not** a graphical object under that SC, and F1 does not reopen that. If a later
Product decision makes a contour's shape or colour *informative*, 3:1 becomes an obligation on
the **default** too, and this search is the wrong instrument for it.

## 7. THE CAMERA IS AN OPEN OBLIGATION, NOT A SOLVED ONE.

WCAG 2.2 **SC 2.5.7 Dragging Movements** requires a single-pointer alternative for
author-controlled dragging. The Living Analysis Map's camera is panned by dragging. §19 forbids
F1 from designing the camera, so the motion inventory carries the disposition **CARRY FORWARD**
and the obligation is written into the F2/Product carry-forward. **It is open.**

## 8. THE ANDROID SIGNALS CARRY THREE QUALIFICATIONS.

- Android "reduce motion" is really `TRANSITION_ANIMATION_SCALE == 0`, so a **developer-options**
  toggle produces the same signal as the accessibility setting.
- Android "grayscale" is really the **daltonizer in mode 0**; any other colour-correction mode
  reports `false`.
- The Android high-contrast key is a **hidden** setting (`@hide`), which is a stability risk.

None of these is fixable from a design package; all three are recorded so an implementer is not
surprised.

## 9. THE SPECTACLE MEASUREMENT COMPARES TWO DIFFERENT KINDS OF IMAGE.

The North Star is a full-bleed 1920 px landscape; the capture is a 390 pt phone screen. The
headline ratios are **mostly framing**, which is why `F1_SPECTACLE_PRESERVATION.md` decomposes
them and reports the painted-pixel comparison (×1.41) and the chroma-ceiling comparison (×3.69)
separately. A reviewer who takes ×459 at face value is reading a crop.

## 9b. NORTH STAR SPECTACLE CAPACITY IS NOT PROVEN, AND THIS PACKAGE DOES NOT CLAIM IT.

F1 measured a real gap and decomposed it honestly. **Measuring a distance is not demonstrating
that it can be closed.** Nothing here shows that the final default dark Living Analysis World can
reach the Product Owner's required level of awe.

The obligation is **OPEN** and belongs to **G — INTEGRATED PRODUCT PROOF**; the North Star is
preserved at full strength, neither weakened nor met. And F1's sentence that density was *"the
cheapest available route"* to it is **withdrawn**: no token constrains density, but **absence of a
prohibition is not Product authority**. Checks **G-01**, **G-02**, **G-03**.

## 10. THE SCENE IS F1'S DRAWING OF D2R's WORLD, NOT D2R's RASTER — AND F1R NARROWED THIS.

The geometry, topics, contours, inks, three worlds and event state vectors are D2R's, **imported
and called**. The composition around them — the interaction strip, the inspection list, the label
position below the contour rather than centred on it — is F1's, built to make the accessibility
questions answerable. So the default board is **not** byte-identical to a D2R frame, and it does
not claim to be.

**What I-08B3.1-F1R added.** F1 rested the Default Preservation Gate on the ablation (D-02) and
the token-tree identity (D-01), and described the first as proving the default unchanged. It does
not: both sides of that comparison run F1's own scene builder, so a change hardcoded there would
survive both. D-02 is now named **DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION** and its shipped record
carries the claim it does not support.

The inherited layer is now compared **against the inherited package** — `tools/f1-inherit.mjs`:

- **I-01** — 25 elements × 7 written attributes of the ATMOSPHERE layer against D2R's own exported
  functions. **No differences.**
- **I-02** — the same layer rasterised against a reference page built from those exports **alone**.
  **Pixel-identical.**
- **I-03** — the analysis layer's geometry against D2R's own sites. **No differences.**

**What is still not verified, and it is not small:**

- **the chrome, the navigation and the panel.** F1 composes a header, a navigation bar and a proof
  panel with **no counterpart in the vendored D2R material**. There is nothing inherited to
  compare their pixels against.
- **the motion.** F1 renders only the settled state; no frame of any sequence is compared.
- **QANDEEL LIGHT.** Not painted in the settled scene, so inherited by reference, not comparison.
- **D2R's own page.** Its HTML scaffold is not vendored here, so `makeRenderer` cannot be driven
  and the package does **not** claim the D2R renderer was used. The reference is built from D2R's
  data and geometry functions instead.

Check **I-04** asserts that this list is present and names the chrome and the scaffold, because a
non-regression proof that does not enumerate what it could not reach invites a reader to assume it
reached everything.

## 10b. THE CONNECTION IS DRAWN AND NEVER NAMED IN THE DEFAULT VISUAL EXPRESSION.

Found by the *drawn versus named* axis F1R added to the parity matrix. In the default map a
relation is a **stroke between two named topics** and carries no label of its own. That is
I-08B3.1-D2R's frozen grammar, and F1R **may not** add a label — doing so would change accepted
default pixels, which the revision forbids outright.

It **is** named in the inspection view and in the screen-reader projection, so no reader loses it;
and the parity rule is therefore a **regression** rule — no expression may name fewer objects than
the default names (check **P-04**) — rather than an absolute one that the frozen design could not
satisfy. Whether the default map should name its relations is a **D and Product** question and is
recorded as such, not decided here.

## 10c. REFERENTIAL INTEGRITY OF CANONICAL V IS AN ASSUMPTION ABOUT SOMEBODY ELSE.

I-08B3.1-F1R2 made the projector **fail closed** on a reference V does not disclose: no raw id, no
recovered name, no prose, and the inconsistency reported rather than swallowed. Three planted broken
views prove it, and the withdrawn `?? id` resolver proves the test can see a leak.

What that does **not** do is make a malformed V correct. QANDEEL is required to guarantee that
canonical V is **referentially closed** — every referenced id is disclosed in the same V — and
**that guarantee lives upstream, where this package cannot check it.** The projector's job is to
stay safe when it is broken, not to repair it; a dangling reference that reaches the projection is a
defect in whatever produced V, and the accessible surface makes it visible rather than fluent.

## 10d. WHAT «UNSPECIFIED» MEANS IS STILL NOBODY'S DECISION HERE.

F1R announced «غير مُحدَّد» for an absent epistemic status. F1R2 withdrew it, because the absence of
a field does not tell you whether the value is not applicable, not disclosed at this depth,
unavailable, absent from this object family, or simply not supplied.

**The projection now says nothing, which is correct and is also not an answer.** If QANDEEL wants a
reader to be told that a status is unknown, **canonical V must supply that as an explicit value** —
and deciding whether it should, and which of those five things it would mean, is a **Product**
question this package has no standing to settle. Recorded, not decided.

## 11. NO USER WAS INVOLVED.

The argument that a written name carries topic identity is structural and measured. It has not
been tested with anyone. I-08B3.1-D2R recorded the same gap; F1 does not close it.

## 12. HAPTICS WERE CONSIDERED AND NOT USED.

Apple's Motion page asks to *"supplement visual feedback by also using alternatives like haptics
and audio"*, and a haptic could in principle mark a meaning event under Reduced Motion. It was
not taken: `animate-expo`'s rule is absolute — *"never the only feedback… haptics are off
system-wide for many users, and silent on most Android hardware"* — so it could only be additive,
and adding one would be **designing new feedback**, which §19 forbids. Recorded as an F2/Product
option.
