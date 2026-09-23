# I-08B3.1-D2R — DESIGN RATIONALE

What QANDEEL Light is, after D2, and why each of its four categories is the shape it is.

---

## 1. The claim this package makes

QANDEEL Light is **one language with four topologies of one falloff law.**

| | | |
|---|---|---|
| **AMBIENT** | FIELD | no source, everywhere, and still |
| **CONNECTION** | DIRECTION | one source, travelling from A to B |
| **PATTERN** | CONVERGENCE | many sources, contracting onto a shared axis |
| **INSIGHT** | EMERGENCE | many sources, contracting onto an empty point |

That is not a family resemblance somebody asserted. It is a property of the code:
`falloff(distance, radius, level)` in `source/scene/d2-foundation.mjs` is the only function in
this package that converts a light's position into an intensity, and all four categories reach
it. They differ in **where the light is** and **how many sources there are**, and in nothing
else.

Three further things are shared, and each is a function rather than a paragraph:

- **One lifecycle.** `meaningEnvelope` — 260 ms of rise, 1,150 ms of fall, asymmetric, reaching
  **exactly** zero. Check **C3** walks all six event sequences past the settle and finds the
  largest surviving value to be `0`.
- **One easing vocabulary.** The three curves I-08B3.1-D0 derived, imported from D1's scene
  file rather than restated. There is no fourth curve in this package.
- **One kind of residue.** Every meaning event ends with a **neutral analytical object** at a
  frozen token colour, readable with no animation at all. Check **R3**: the settled frames of
  every sequence are byte-identical to each other.

And one thing is deliberately **not** shared, because sharing it would be the lie: the atmosphere
is not made of Light. See `D2R_AMBIENT_MEANING_ACTIVITY.md`.

---

## 2. What each category is, and the purpose it names

`animate` requires a purpose named in one of six words before anything is built.

### A — AMBIENT · «المحيط»

**Not an animation at all**, and therefore not on that list. The field is the world's
atmosphere: eight topics, each drawn as a set of **contour lines** — a level set, the way a hill
is drawn on a map — whose morphology comes from an **AUTHORED PRESENTATION SEED** used only for
composition. It carries no analytical identity and no persistence guarantee across devices,
users or releases.

It is **completely still**. The only motion it has is the user's own hand, and that is a gesture
rather than an animation: 1:1 tracking with no duration, and on release Apple's exact momentum
projection. Four independent reasons for the stillness are set out in
`D2R_AMBIENT_MEANING_ACTIVITY.md` §2; three of them are mechanical.

**Every one of those visual properties encodes NOTHING, and that is declared in a file the build
reads.** I-08B3.1-D2 claimed radius was quantity, depth was recency, a Shared gap was a sharing
fraction and a contour was a permanent identity. None was authorised; none was needed; all are
gone. See `D2R_CORRECTION.md` REV-01.

Three worlds, one expression, **and every difference is uniform across the whole field**.
**Personal** draws closed contours. **Shared** draws the same contours with **one dash pattern,
identical on every ring** — it says "shared world", not "this much of this topic". **Public**
draws one contour per topic at a lower luminance, uniformly, **and names every topic**: dimness
is never a claim about what the user is allowed to know.

### B — CONNECTION · «الرابط» — INHERITED CONTROL. Purpose: STATE INDICATION.

Not designed here. `source/scene/d2-connection.mjs` contains no motion: it imports
I-08B3.1-D1's functions and hands them on. Check **C1** compares all 23 channels at all 210
frames against D1's own composed function — 4,830 comparisons, largest difference **0**.

One channel of its **reduced-motion counterpart** is corrected, for a reason the Reference Gate
found and `D2R_REFERENCE_GATE.md` records in full. The selected Product expression is untouched.

### C — PATTERN · «النمط». Purpose: STATE INDICATION.

Four topics that have been on the map all along become readable as one structure.

**Nothing moves.** The obvious way to draw "these things align" is to nudge them into
alignment; it is also forbidden, because a topic's position on the Living Analysis Map is the
map's truth and not a layout decision. So the members hold still.

**And nothing is inferred from where they are.** I-08B3.1-D2 fitted a principal axis to the
member positions and drew each member's residual against it. QANDEEL does not know a Pattern
because four renderer coordinates line up — it knows one because the analysis identified a member
set. An axis fitted to a layout is a statistic about the drawing. See `D2R_CORRECTION.md` REV-02.

What the Product actually knows is a SET, and a set has no axis, no order and no goodness of fit.
So the drawing is membership and nothing else:

- **A new neutral analytical object** — the pattern's own locus, «نمط / من أربعة مواضيع» — at an
  **authored** position. A centroid would have been a statistic of the members; this is a clear
  spot on the map, chosen because the drawing fits there.
- **Four membership links**, identical in every written property, drawn **simultaneously**. A
  stagger would be an order. This inverts the house guidance against simultaneous entrance
  deliberately: that rule is about lists of unrelated items, and this is one object with four
  arms.
- **Four identical marks**, where each link meets its topic's contour, so membership is legible
  at the member and not only along a line whose length is an accident of layout.

Check **C5** measures all three: no derived statistic in the exported geometry, no disagreement
in level between members across 52 lit frames, and every scalar channel a function of time alone
with divergence **0** from an independent restatement.

### D — INSIGHT · «الفهم». Purpose: STATE INDICATION.

A genuinely new conclusion becomes available. There is no prior object to travel to.

**The one rule that separates this from a sparkle is that the light travels inward.** Every
forbidden effect in this space — sparkle, starburst, particle explosion, bloom — shares one
property: light appears at a point and moves away from it, which reads as an emission. Emergence
is the opposite motion, and it is measured rather than asserted: check **C6** walks all 50
frames that carry light and finds **0** in which any lobe moves outward, onto a site that clears
the nearest topic's outermost contour by **58.5 px**.

---

## 3. Three decisions that a rendered frame overturned

Each of these was argued for in prose, looked right on paper, and did not survive a picture.

**THE INSIGHT'S GATHER WAS AN ORB.** Five lobes contracting to one coordinate stack their
gradients and produce a bright disc with the new conclusion sitting inside it. "These five become
one" expressed literally — five things occupying one point — *is* a glow, and it arrived without
anyone choosing it. The gather now closes to a **ring** of radius 21 px, so the light is around
the thing emerging rather than behind it. The same correction was applied to PATTERN before it
could happen there: `MERGE_FRACTION` is 0.34, well under 1, because **convergence is a
direction, not a destination**.

**THE PATTERN'S LIGHT WAS FOG.** The four members are nearly collinear — which is why the fit is
any good — so "move onto the axis" is a journey of 8 to 21 px and nothing visibly travelled. The
first build spread four wide lobes along a near-vertical line and read as fog with a scratch
through it. What the eye sees now is each member's **own contraction**: a lobe begins spread
across its topic's whole extent and closes, which is a true movement, because a pattern is made
of the material inside those topics.

**THE STRUCTURE FINISHED AFTER THE LIGHT HAD GONE.** The structure completed at +1,580 ms and the
light was extinguished by +1,410, so the middle of the event was a bare line on a dead field.
Convergence and crystallization are not two things in sequence; they are one thing seen twice,
and they have to overlap for that to be visible.

---

## 4. The Light colour, and why it changed

I-08B3.1-D1 closed with a finding handed forward: the diagnostic Light passed within ΔEok 0.0163
of Living Brass, so at low intensity **LIGHT and MATTER stop being separable** — at exactly the
intensities an arrival decays through.

`source/tools/d2-lightsearch.mjs` turns that finding into a requirement and searches for the
colour it implies. Measured on the full compositing path — three stops × two grounds × 513
alphas — the diagnostic family is closer still: **0.0118**.

The selection rule was written before the numbers were read: meet **0.020**, then take the
**lowest hue** that does, because this is a freeze candidate and it should move the smallest
distance its own requirement forces. The result is hue 89°, five degrees from the family the
Product Owner has already seen three times, measuring **0.0201** — 1.70× the separation it
replaces. `frames/proof/D2_LIGHT_SEPARATION.png` draws it.

Two constraints in that search are worth naming because they are where taste would otherwise
have entered:

- **The warm band is not a hue range chosen by eye.** The first run pinned its optimum to
  whatever hue cap it was given — separation rises monotonically as hue leaves the material's
  75° — so the cap was choosing the colour. It is now the device-space ordering that makes a
  colour warm at all: R leads G leads B at every stop. At 108° that ordering breaks, which is
  also where a warm light becomes an acid yellow-green.
- **The ink requirement was impossible in its first form** and no family in the space satisfied
  it, including the diagnostic one. A light rising over a near-black World passes through every
  lightness on the way up, so somewhere on that climb it is close to a low-chroma grey by
  arithmetic. Requiring otherwise is requiring a light not to fade in.

---

## 5. The answer to the LIFE TEST

> If semantic truth is correct but the result feels interchangeable with a competent grey
> utility app, the work is incomplete.

The house design guidance says to **spend boldness in one place**. This system spends it on the
**level set**: a topic is a set of contour lines, so the world is dense, layered and specific
while completely frozen. Everything around that is kept quiet.

The shape itself comes from an **authored presentation seed** and is **presentation only**. It is
deliberately not derived from the topic, it identifies nothing, and it carries no guarantee of
stability across releases, devices or users — a later release may reseed the whole field and lose
nothing. **What identifies a topic is its name**, which is written on every topic in every world
and asserted by guard **S4**. The richness never depended on the claim: what makes a still field
alive is that its form is dense, layered and specific.

It also names the risk directly. Machine-generated design clusters around three looks, and one
of them is *a near-black background with a single bright accent* — which is, on its face, a
description of QANDEEL. So this package **bounds the accent rather than trusting its own
taste**: the Light's chroma is capped at 0.046, the atmosphere at 0.0197, and check **R6**
reports the measured maximum across the whole resting field as **0.0196** against Living Brass's
0.0516. Restraint that is measured is a different claim from restraint that is asserted.

And the last word on it belongs to Apple's sixth principle, which is quoted rather than
paraphrased because the distinction is the whole argument: **"Simplicity — not minimalism.
Strip the unnecessary so the core purpose shines; burying everything in one place looks minimal
but isn't simple."**
