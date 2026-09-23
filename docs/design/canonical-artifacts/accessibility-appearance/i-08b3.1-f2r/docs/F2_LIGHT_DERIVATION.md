# I-08B3.1-F2 — THE LIGHT APPEARANCE, DERIVED

Every value in this document is produced by `tools/f2-derive.mjs`, recorded in
`data/F2_DERIVATION.json`, and asserted against the shipped token files by check **K-02**. The
derivation reads the frozen dark values *through I-08B3.1-F1's own resolver* rather than from a
hex typed into a file, so a copy that happened to be right on the day it was written cannot pass
for provenance.

---

## 0. The discipline, stated before any number was read

> **MEET THE FLOOR, THEN MOVE THE SMALLEST DISTANCE THE REQUIREMENT FORCES.**

Inherited from I-08B3.1-D2R, which used it to pick a Light five degrees from the family the
Product Owner had already seen. F2 uses it wherever a floor exists, which is why Light Brass is
the **lightest** brass that can still be read as an ink rather than the one that reproduces dark
Brass's contrast ratio. **Both candidates are computed and both are reported**; the rejected one
is in the record so a reviewer can disagree with the rule rather than guess at it.

### There is no single transfer function here, and that is the point

§4 forbids deriving light by inverting dark. That prohibition is usually argued on taste. In
QANDEEL it can be argued on measurement:

| role | dark | an inversion would give | hue |
|---|---|---|---|
| Living Brass | `#a58e6f` | `#5a7190` | 75° → 256° — **blue** |
| Error | `#fe907e` | `#016f81` | 30° → 214° — **teal** |
| Primary reading ink | `#d8d5ca` | `#272a35` | 94° → 273° — **blue-violet** |
| QANDEEL Light core | `#fbf2db` | `#040d24` | 89° → 263° — **blue** |

**Mean rotation: 178.7°.** An inversion does not merely produce different values; it produces a
blue identity material and a teal error. One table, and §4 stops being a preference.

So each role is solved by **its own semantic responsibility**:

| role | what it must preserve | what sets its value |
|---|---|---|
| WORLD | least chroma; able to hold a light | the highest lightness at which a source still rises |
| SURFACE | the frozen 1.0716 World-to-Surface ratio | that ratio, on the side away from glare |
| INK ×3 | reading **hierarchy** | contrast-ratio parity, exactly |
| SCRIM | **world suppression** | the suppression factor — it does **not** invert |
| BRASS | identity: hue, chroma, ladder rung | the least darkening that meets its ink duty |
| LIGHT ×3 | **meaning emergence** | an expression family chosen by measured search |
| ATMOSPHERE | the world's field, never meaning | contour-contrast parity per layer |
| ERROR | one cross-appearance family | the least darkening that meets its ink duty |
| DISABLED | availability *de-emphasis* | its two relations, preserved |

---

## PART A — THE LIGHT GROUND

### The World: `#efeeeb` — oklch(0.9491 0.0041 91.4)

**Its lightness is not a comfort judgement and not a mirror of `#101010`.** The search swept
OKLCh L **0.880 to 0.985**, re-deriving every dependent role at every candidate, because a ground
chosen first and checked afterwards is a ground nothing could have rejected.

**It is the highest lightness at which a meaning event can still be seen to HAPPEN.** At L 0.955
— `#f1f0ed` — no expression family in the search could produce a source that rises above the
ground by more than a just-noticeable step, because the ground had taken the ceiling the source
needed. The three requirements that failed at every configuration there were **R-SOURCE**,
**R-GRAYSCALE** and **R-EVENT**.

The World is therefore **as light as it can be while remaining a world a light can happen in**,
and the requirement that fixed it is `qandeel.appearance.meaning-has-a-source`.

> **THE MARGIN IS THIN AND IS DISCLOSED RATHER THAN SMOOTHED.** The source clears its floor by
> about 12%. On a display that cannot reach the sRGB ceiling the source may be lost, and this
> value is tunable **downward** for exactly that reason. I-08B3.1-D2R's own chosen Light cleared
> its separation floor by 0.5% and said so; this is the same discipline and the same disclosure.

**Its chroma is the least the system can hold.** 0.0041 is the smallest authored chroma that
survives 8-bit quantisation at this lightness **with its hue intact** — and the hue, 91.4°, is
the mean of QANDEEL's own three reading inks, so the ground is not a new colour decision but the
system's own warmth at the lowest volume it has.

**Why not white.** Apple and Material both ship a white light background and QANDEEL departs from
both. The reason is not glare in the abstract: **a World at the ceiling cannot hold a light, and
this World's job is to hold one.**

**Measured against the obvious answer rather than kept away from it.** The `frontend-design` skill
names *"a warm cream background near #F4F1EA"* as one of three looks AI-generated design clusters
on, regardless of subject. The derived World sits **dEok 0.0111** from it and carries **0.0041** of
chroma against the cream's **0.0098** — less than half as coloured, because the ladder requires the
ground to be the least chromatic band and a cream is not.

### The functional Surface: `#e7e6e3` — oklch(0.9249 0.0042 91.4)

**It is DEEPER than the World, where the dark Surface is LIGHTER than it — and that sign change is
derived, not inverted.** One sentence covers both appearances:

> **THE SURFACE MOVES AWAY FROM THE EXTREME.**

In dark the extreme is black and the machinery is lifted off it. In light the extreme is white and
the machinery is deepened away from it. Lifting it in light would push the functional chrome toward
the glare, and toward the case Apple's materials guidance names directly: *"Never stack a light
translucent surface on another — legibility collapses."*

**The magnitude is the frozen one, untouched: 1.0716:1**, the same ratio `#181818` holds against
`#101010`. That ratio is deliberately tiny and stays tiny, **including its consequence** —
I-08B3.1-F1 had to introduce a contrast BOUNDARY token because the World and the Surface are
separated by almost nothing, and the light appearance inherits that weakness along with the value
rather than quietly repairing it. An appearance may not invent hierarchy, and "fixing" this gap
would be inventing one.

> **APPLE'S BASE / ELEVATED MODEL IS NOT ADOPTED, AND THE REASON IS FROZEN QANDEEL SEMANTICS.**
> Apple raises foreground interfaces by making them *brighter*. I-08B3.1-B4R froze that QANDEEL's
> Surface is not elevated at all — *"the APPARATUS is not raised; it is beside"* — and that all
> four Product Surface roles share one tone. With no elevation metaphor to express, there is no
> reason to spend the light appearance's scarce headroom on one.

### The reading ramp

| rung | dark | ratio in dark | light | ratio in light |
|---|---|---|---|---|
| primary | `#d8d5ca` | 12.9485:1 | `#29271f` | 12.89:1 |
| secondary | `#afaca3` | 8.3838:1 | `#47443c` | 8.36:1 |
| tertiary | `#8b8982` | 5.4352:1 | `#626059` | 5.43:1 |

**The hierarchy is identical and not one value is shared.** I-08B3.1-F1 established that
importance is a RATIO when it forbade an increased-contrast expression from inventing importance,
and guarded the ratio rather than the values; an appearance change is bound by the same argument
for the same reason.

**The primary ink is not black.** Pure black on this ground would be 18.1:1. Maximising the first
rung would compress every rung below it, and §6 says plainly that pure black on pure white is not
automatically superior.

**The ink is tinted, not grey.** It would have been easy to solve the light inks as neutral greys
at the right luminances — the contrast ratios would be identical and every check would pass. They
are solved at the frozen ramp's **own hue**, with the chroma held, because the craft floor's rule
for secondary text on a coloured surface is to tint it from the foreground and never to grey it,
and a warm light ground is a coloured surface.

> **THE RUNGS ARE SOLVED IN ORDER, UNDER A RUNNING CHROMA CAP,** and the first version was wrong
> without it. Solved independently, the three come back in a *different chroma order* than they
> went in: the rungs are 0.002 apart in chroma and the 8-bit grid is coarser than that at these
> lightnesses, so SECONDARY's quantised hex recovered a higher chroma than PRIMARY's and inverted
> two rungs of the cross-appearance ladder without either value being wrong on its own.

### The PASSAGE scrim: neutral black at alpha **0.532**

**This is the single clearest instance of §4 in the package: the role an inversion would most
obviously flip is the one role that must not flip at all.**

A scrim expresses WORLD SUPPRESSION, and suppression is not a direction on the lightness axis — it
is subtraction. A white scrim over a light World is exactly the stacked-light-translucency case
where legibility collapses; it would destroy the thing the scrim exists to protect.

**The alpha is solved for what a scrim DOES, not for what it IS.** An earlier rule preserved the
suppressed-World-to-Surface contrast and returned **0.09** — a scrim that suppresses nothing. That
rule was measuring the GROUND, and a scrim is painted over the World **and everything in it**. What
is preserved is the FACTOR by which the scrim collapses the World's own internal contrast:

| | unscrimmed | scrimmed | factor |
|---|---|---|---|
| **dark**, primary ink vs World | 12.9485:1 | 3.7467:1 | **3.456** |
| **light**, primary ink vs World | 12.8889:1 | 3.7355:1 | **3.4504** |

**And the two alphas land 0.032 apart** — 0.5 and 0.532. Suppression is *multiplicative*, and a
multiplication does not care which end of the lightness range it starts from. This is the one role
in QANDEEL whose value barely moves between appearances, and the reason is arithmetic.

---

## PART B — LIVING BRASS IN LIGHT: `#7a6446` — oklch(0.5165 0.0516 74.8)

**The hue is held to 0.13 of a degree** — authored at 75.0 in dark, recovered at 74.8 here. **The
chroma is held too**, 0.0516 to 0.0511 as measured on the shipped hex, which keeps the material in
exactly the same rung of the ladder: still the second most chromatic thing in the system, still
above QANDEEL Light, still above the atmosphere, still below Error.

**Only the lightness moved, and the rule that moved it is its INK DUTY.**

On a light ground the material's two jobs pull apart for the first time. In dark, one value was
both the metal *and* the ink of the identity mark and the navigation labels, because a warm
mid-tone on near-black is legible by construction. On a near-white ground it is not. The identity
mark and the navigation items are **text at sizes below the WCAG large-text threshold**, so 4.5:1
binds — and the alias chain that makes them one token is frozen. Splitting it in light only would
give the semantic layer an appearance-dependent shape, which is not F2's to do.

**So: meet 4.5:1 against both grounds, then move the smallest distance that allows.** It lands at
**4.841:1** against the World and **4.500:1** against the functional Surface, **dEok 0.1424** from
the frozen dark body.

**The road not taken is in the record.** Reproducing dark Brass's 6.07:1 ratio — the rule the
reading ramp uses — was available and gives `#6b5538`, at **dEok 0.1950**: 37% further from the
material. The ratio rule is right for READING, where the ratio *is* the hierarchy, and wrong for a
MATERIAL, whose identity is its hue and its chroma and whose contrast requirement is a floor.

> **A STANDING TENSION, REPORTED RATHER THAN RESOLVED.** Apple asks custom foreground/background
> pairs to *"strive for a contrast ratio of 7:1, especially in small text."* Light Brass is at
> 4.84:1; **dark Brass is at 6.07:1 and does not meet it either.** Pushing Brass to 7:1 on this
> ground forces it to OKLCh L 0.38, which is a dark brown — the outcome §7 forbids by name. The
> tension is left standing with both numbers on the page, for Product review.

**What is NOT derived here.** I-08B3.1-C3 permits a restrained brushed/handled character tone at
large identity moments, derived from the body's authoring triple. That derivation is dark-appearance
work; its light counterpart is **open** and is recorded in `F2_KNOWN_LIMITATIONS.md`.

---

## PART C — QANDEEL LIGHT IN THE LIGHT APPEARANCE

**This is the hardest problem in the brief and the brief says so.** §8 predicted in words that
*"make it brighter may fail completely"*. The derivation turns that into a number.

### Four families were built, and three failed for three different reasons

§8 says *"do not preselect the technique"*, so all four were **parameterised and searched** — a
family whose constants I chose and whose rival's constants I also chose is a preference with
arithmetic attached, not a comparison. **104,835 configurations in total: 53,886 across 21 candidate
grounds at the coarse pass, then 50,949 at the full pass on the chosen ground** — 50,760 of them the
signed bloom's, because it is the family with the most shape to search and giving it less would
have been deciding the comparison by how much freedom each side was allowed.

I-08B3.1-F2R grew that search by an order of magnitude, and **not because more resolution was
wanted — because the coarse pass was too narrow in RANGE.** Raising the candidate floor made a
120-configuration grid report every ground non-viable while the full grid had thousands of
admissible configurations at those same grounds. A coarse pass may be coarse in resolution; it may
not be narrow in range.

The event figures below are the **area mean** — the event's difference from its ground averaged over
the source's disc, area-weighted along I-08B3.1-D2R's own falloff. F2 compared families on the
per-pixel PEAK, and a peak is a property of one point where an event is a region; measured on the
peak, a glaze 0.14 wide cleared the floor on a thin annulus.

| family | area mean | gray area mean | peak | rise | verdict |
|---|---|---|---|---|---|
| **F-A ADDITIVE** — the dark technique, unchanged | 0.0151 | 0.0058 | 0.0395 | 0.015 | **rejected** — R-GRAYSCALE and R-EVENT on every variant |
| **F-B DARKENING** — the insight gets deeper | 0.1594 | 0.1594 | 0.4434 | **0.000** | **rejected** — R-SOURCE on every variant; its deep configurations, the only ones with the magnitude to clear R-EVENT, also fail R-SOURCE-DOMINANCE |
| **F-C CHROMATIC** — everything spent on colour | 0.0159 | **0.0000** | 0.0416 | 0.000 | **rejected** — R-GRAYSCALE, R-SOURCE and R-EVENT on every variant |
| **F-D SIGNED BLOOM** | **0.1022** | 0.1014 | 0.1570 | 0.021 | **admissible** — 2,930 of 50,760 configurations |

- **The additive family** — the dark appearance's own technique — reaches **dEok 0.0395** against
  the dark appearance's **0.6925**. That single comparison is the whole of §8.
- **The darkening family** produces the largest event of the four and has **no source at all**: its
  rise is exactly zero. It is a stain, not a light, and it is the answer §8 forbids by name.
- **The chromatic family** is the obvious answer to "how do you show light on a light ground" and it
  reaches **dEok 0.0000** once the colour is removed. It disappears entirely for anyone using the
  grayscale diagnostic or with a colour-vision difference. WCAG SC 1.4.1 excluded it *by arithmetic*.

### The winner: SIGNED BLOOM

`qandeel.expression.illumination.technique = "signed-bloom"`. The renderer dispatches on that token
and **does not test the appearance's name** — §28's requirement, and the reason a third appearance
or a variant that needed a different technique would have one place to change.

| stop | value | OKLCh |
|---|---|---|
| **core** — the flooded source | `#fff6df` | 0.9741 0.0316 89.1 |
| **mid** | `#ddd4be` | 0.8713 0.0312 88.4 |
| **low** — the glaze | `#bcb39e` | 0.7685 0.0308 87.6 |

Hue **89.1 / 88.4 / 87.6** against the dark ramp's 89.1 / 88.5 / 90.4 — per-rung drifts of
**0, 0.09 and 2.85°**, each rung against *its own* dark counterpart, measured on the *recovered* hue
of the hex that ships rather than on the authored triple. **2.85° is the widest drift anywhere in the
system, against a 3° tolerance — a thin margin, and the package says what stops it being smaller.**

> **A TOLERANCE IS A CEILING, NOT A BUDGET.** Of the **480** configurations at this magnitude that
> carry *less* total drift, **not one is admissible**, and every one of them fails `R-EVENT` or
> `R-SOURCE`. The reason is the sRGB gamut: putting the third rung on its dark counterpart's hue
> needs more chroma, and at a fixed hue more chroma lowers the lightness sRGB can still hold — so the
> flooded core comes down with it and stops rising above the ground by a just-noticeable step. The
> best alternative sits at **0.36°** of total drift with a source that rises **0.018** against a floor
> of 0.020. **`R-HUE` and `R-SOURCE` pull against each other through the gamut boundary**, and the
> gamut is not negotiable. `selectionAudit` in `data/F2_DERIVATION.json` carries the measurement and
> check `X-03` asserts that the shipped drift is the least available at the shipped magnitude.

Shape: `split` **0.65**, `glaze-width` **0.8**. There is **no `glaze-gain`**: I-08B3.1-F2R removed it
because it made the glaze's depth and its strength two names for one quantity, so the search could
reach the same painted composite from a shallow stop at high gain or a deep stop at low gain and had
no way to choose between them — and the deep-stop answers put the authored `low` value inside the
reading ramp's lightness range while the picture was identical. The Meaning Light now has **one**
gain in both appearances, D2R's own wash opacity.

**The source floods toward the ceiling of what sRGB can hold at the Light's hue; the falloff lays a
warm glaze around it.** It is the only family with a *signed* luminance profile, and that is
the only reason any family survives two requirements that pull in opposite directions on a
near-white ground: the flooded core sits above every reading ink, and the glaze is where the
magnitude is.

### The requirement set, and what each one caught

| requirement | what it says | what it excluded |
|---|---|---|
| **R-SOURCE** | at peak the event is lighter than its ground, **measured with the colour removed** | the darkening family — every variant of it — and every ground above L 0.95 |
| **R-SOURCE-DOMINANCE** | no stop of the ramp is darker than the World under its **own passage scrim**, L 0.5423 | the ratio-preserving floor: all **3,247** configurations that reach it fail this and nothing else. Also the darkening family's deep configurations — the only ones with the magnitude to clear R-EVENT |
| **R-GRAYSCALE** | gray **area mean** ≥ 0.020 | the chromatic family, at 0.0000 |
| **R-SEPARATION** | min dEok(Light at any intensity, Living Brass) ≥ 0.020 | I-08B3.1-D2R's own floor, re-run — result **0.2779** |
| **R-INK-SEPARATION** | the ramp's **stops** stay 0.020 from any reading ink | result **0.2805** |
| **R-NOT-SHADOW** | the composite never carries less chroma than the ground | light adds colour; shadow removes it |
| **R-SETTLE** | at intensity 0 the composite is the ground **exactly** | asserted on the quantised hex |
| **R-CONTINUOUS** | one 8-bit intensity step above zero the composite is already within a JND of the ground | a glaze whose shape does not vanish at zero — invisible at width 0.14, visible at 1.4 |
| **R-ORDER** | the Light band sits between the atmosphere and the material | and carries enough chroma to hold the atmosphere ceiling above the ink |
| **R-EVENT** | the **area mean** exceeds the appearance's own smallest reading step, **0.1017**, at **every** peak level the three categories reach — so at whichever of them the expression scores lowest | the additive and chromatic families |
| **R-HUE** | ≤ 3° drift, **each rung against its own dark counterpart** | a ramp 3.78° from the dark value it is the counterpart of, which the earlier rung-against-the-core version admitted |

> **R-SOURCE IS MEASURED IN GRAYSCALE ON PURPOSE.** Measured in full colour, a core that is merely
> *warmer* than its ground satisfies "there is a light" on chroma alone — which is how an earlier
> version passed a core whose lightness was indistinguishable from the World it sat in. **A source
> is a luminance fact.**

### The magnitudes are not equal, and F2 does not claim they are

| | dark | light |
|---|---|---|
| **area mean**, dEok from ground | **0.2846** | **0.1022** |
| event peak, dEok from ground | 0.6925 | 0.1570 |
| of which rise (the source) | 0.6907 | 0.021 |
| of which dip (the glaze) | 0.000 | 0.1539 |
| in the appearance's **own** smallest reading steps | **2.483** | **1.005** |
| deepest stop | — | L 0.7685, against the World under its own scrim at L 0.5423 |

**A dark ground lends a meaning event the whole empty luminance range above it. A light ground has
already spent that range on the ground.** In light, most of the event's magnitude is carried by the
glaze around the source rather than by the source. That is a property of the two perceptual
environments, not a defect in the expression, and it is reported rather than closed by turning
something up. It is the **single most important thing for the Product Owner to look at** on
Boards C, D and E.

**AND THE VERSION THAT CLOSES THE GAP WAS BUILT, RENDERED AND REJECTED.** This package's transfer
rule everywhere else is *preserve the ratio, not the value*: the reading inks preserve contrast
ratios, the atmosphere preserves its contour contrast, the scrim preserves its suppression factor.
Applied here it asks the light event to stand at 2.483 of the light appearance's own reading steps,
a floor of **0.2525** — and that floor **is reachable**. The expression that reaches it satisfied
every requirement in the table above as the table stood at the time: hue drift 1.6° inside a 3°
tolerance, the chroma ladder preserved, every separation clear, a clean settle, an extent inside the
dark event's. Rendered at CONNECTION's own peak it is an opaque brown-grey sphere sitting on a
near-white World.

**A configuration that passes every check and fails on sight means a check is missing; it does not
mean the eye is wrong.** The missing one is R-SOURCE-DOMINANCE, and it was written after that render
rather than before it — which is the honest order to record, because the alternative is a package
whose checks only ever confirm what it already decided. Its deepest stop sits at L 0.5190 against a
scrim composite at L 0.5423: the event that means *QANDEEL understood* would have been deeper than
the veil that means *not this, not now*. All **2,379** configurations that reach the ratio floor are
darker than that scrim, and every one of them fails that requirement and no other — so the
incompatibility is a property of a ground at L 0.9491 rather than of a threshold chosen to fit.

The dip-to-rise ratio is **7.32 : 1** for the shipped expression against **31 : 1** for the deepest
configuration that reaches the ratio floor. It is recorded and **not** bounded: any threshold between
those numbers would be a threshold read off two samples.

### Two selection rules were tried and discarded before this one

Both are recorded because the failure mode is the interesting part.

1. **"The largest admissible event wins."** An objective with no upper bound runs to one: the glaze
   went to its deepest and widest setting, and the rendered INSIGHT — five overlapping lobes — laid
   a continuous wash over half the world. Every number was right. The objective was wrong, and it
   was wrong in a way the numbers could not report, because *largest* was exactly what it had been
   asked for.
2. **"Closest to the dark appearance's event peak."** This sounds like parity and is not. The
   target is unreachable, and **closest to an unreachable target is maximum** — the same runaway
   objective in better words.

The rule is now the discipline stated at the top of this document: **among admissible
configurations, the mildest extreme** — the least peak departure from the ground, subject to the area
mean clearing the floor, with ties broken on the shallowest third rung, then the least *total* hue
drift against the dark stops, then the least extent, then the least shape. The floor makes the event
read; the selection takes the least the floor forces. A light is a bright source with a boundary, and
past a certain weight the boundary stops being a boundary and becomes a body.

**It converges, and that was checked rather than assumed** — because the two rules above failed by
running to a bound, and a third one that did the same would have been the same mistake in new words.
Sweeping the glaze-width cap, the attainable minimum peak goes 0.1725 → 0.1632 → 0.1612 → 0.1541 →
0.1535 as the cap rises through 0.45, 0.60, 0.80, 1.00 and 1.40, then stays flat at 2.00. The
objective saturates inside the grid instead of leaning on its edge.

**The tie-break is on the SUM of the per-rung hue drifts and not on the worst rung, and the
difference is not academic.** Broken on the worst rung it traded a core sitting *exactly* on its dark
counterpart for a few hundredths of a degree on the third rung — where the recovered hue is dominated
by the 8-bit grid and a hundredth is noise. The tolerance is a maximum and stays a maximum; what a
tie-break should prefer is the ramp that moves least **in total**.

**And the magnitude objective is compared only down to a just-noticeable step, which is the third
time this selection rule had to be repaired.** Compared at full float precision, a difference of
0.0001 in the event's peak departure — a fortieth of the smallest difference anyone can see —
outranked **two degrees** of hue drift away from the value each rung is the cross-appearance
counterpart of. It did exactly that: the search returned a ramp at 6.71° of total drift where one at
2.94° existed at the same perceptible magnitude. **An objective compared below its own perceptual
resolution is not expressing a preference about the picture; it is ordering numerical noise.**

| selection rule | how it failed |
|---|---|
| *the largest admissible event* | ran to its bound — a wash over half the world |
| *closest to the dark appearance's peak* | the target is unreachable, so *closest* means *maximum* |
| *the unquantised minimum peak* | sub-JND magnitude outranked role identity |

All three produced a correct number and the wrong answer, and **none could be caught by inspecting
the winner** — you have to see what it was chosen *over*. So `selectionAudit` in the record carries
how many configurations shared the winner's magnitude bucket and the best and worst hue drift among
them, and check `X-03` asserts the shipped drift is the best of them.

### LIGHT ≠ BRASS, and not by labels

§9 asks that the distinction not rest on labels. It rests on two things a reader can see:

- **Colour distance**, at every intensity: min dEok(Light, Living Brass) = **0.2779**, fourteen times
  the floor D2R adopted.
- **Behaviour.** Living Brass is a flat satin body — one tone, no falloff, no envelope, no residue,
  state-invariant. QANDEEL Light is an *event* — a source with a falloff, a 260/1150 ms envelope,
  and a residue that returns to exactly zero. **One of them settles to nothing.**

---

## PART D — THE AMBIENT FIELD IN LIGHT

**It is the same field.** Not one contour is dropped, no layer is removed, no topic loses its hue,
and the harmonics, ring counts and parallax ladder are untouched. What changes is the layer
lightness, by a rule rather than by an inversion: **each layer's contour keeps the exact WCAG
contrast ratio it holds against its own ground in dark.**

| layer | dark ink | dark L | light ink | light L | ratio preserved |
|---|---|---|---|---|---|
| near | `#7a8990` | 0.620 | `#56646b` | 0.4944 | 5.2631:1 |
| mid | `#66747b` | 0.550 | `#69787e` | 0.5618 | 3.9407:1 |
| far | `#526066` | 0.480 | `#7f8d94` | 0.6356 | 2.9211:1 |

**Its lightness crosses the ground, which is what a field does.** In dark the contours are brighter
than the World; in light they are deeper than it. **The depth cue therefore reverses** — near is the
brightest layer in dark and the deepest in light — and that costs nothing: I-08B3.1-D2R's
`PRESENTATION_CONTRACT` declares ring layer, contour count, contour shape, radius and hue all
`encodes: null`, and I-08B3.1-F1R2 moved the depth cue out of the required accessibility carriers
for the same reason. **A presentation property that means nothing may be expressed differently in a
different environment; that is the definition of a presentation property.**

**The chroma ceiling is re-derived, not copied.** D2R makes it `0.62 × the least chromatic Light
stop` *precisely so the rule survives the Light being re-chosen* — its own words: *"If a later
package picks a paler Light, the atmosphere gets quieter on its own, and nobody has to remember that
the two numbers were related."* **F2 is that later package**, and the ceiling moved by itself:
**0.0197 in dark, 0.0193 in light.**

**Nothing gained analytical meaning.** radius ≠ quantity, depth ≠ recency, colour ≠ importance,
contour ≠ topic identity, brightness ≠ confidence. All five remain `encodes: null`, in both
appearances, and check **K-01** classifies every F2 value against it.

---

## PART E — INTERACTION AND STATUS IN LIGHT

**Two literals, and only two.** Every other interaction and status role in QANDEEL is an alias in
dark and stays an alias in light: REST, PRESSED, FOCUS, SELECTED, WARNING, SUCCESS and
INFORMATIONAL all reach the reading ramp or the identity material and change in the light appearance
**because those changed**. That is the architecture working, and it is why F2 adds two values rather
than thirteen.

### ERROR: `#ad4739` — oklch(0.5305 0.1364 30.1)

**Hue held to 0.2 of a degree** — 30.3 in dark, 30.1 here — **and chroma held**, 0.1364 to 0.1370.
Error remains the most chromatic thing on a QANDEEL screen in both appearances, which is its rung of
the ladder and is the reason it reads as the same error rather than as a different one.

**The rule is the material's rule, not the reading ramp's.** Error is painted as text and as a
boundary, so 4.5:1 binds as a FLOOR; it is not a rung in a hierarchy, so there is no ratio to
reproduce. **4.843:1** against the World, **4.502:1** against the Surface, **dEok 0.2361** from the
frozen dark Error.

**The road not taken:** reproducing dark Error's 8.61:1 gives `#801c11` at **dEok 0.3716** — 57%
further from the frozen value, and visibly a maroon rather than a coral. The Product Owner approved
the warm coral direction; a ratio nobody required is not a reason to leave it.

**Colour is still not the only carrier, in either appearance.** The error row carries its ink, a
glyph and its message in words. Board H shows it under the grayscale diagnostic.

### DISABLED: `#83817c` — oklch(0.6024 0.0078 88.7)

**It keeps its RELATIONS rather than a floor, and the relations are the signal.** In dark it sits at
**3.3681:1** against the World — below 4.5:1, which WCAG 2.2 exempts for inactive components — and
**below the tertiary reading ink**. Both facts are what "de-emphasis without illegibility" consists
of, and both are re-instantiated: **3.3541:1** in light, still below the light tertiary rung.

**Raising it to meet 4.5:1 would compress its distance from the resting ink, and that distance is
the availability signal.** Its reason is stated in words on a real control, through a real
accessible description.

### WARNING, SUCCESS, INFORMATIONAL: unchanged, and neutral

They resolve to reading-ramp rungs with no hue of their own, **in both appearances**. I-08B3.1-E1
froze that **STATUS COLOUR IS EARNED, NOT ASSIGNED BY TAXONOMY**, and an appearance change has no
authority to expand the semantic colour system: a green success that existed only in light would be
a Product decision smuggled in as a rendering detail. Check **E-03**.

**No contradiction arose here.** §14 asks that one be reported if it does; none did.

---

## PART F — INCREASED CONTRAST IN LIGHT

See `F2_ACCESSIBILITY_UNDER_LIGHT.md` for the full treatment. In summary: **most of I-08B3.1-F1
needed nothing from F2**, because its transformations are re-routes along the frozen ramp and an
alias is appearance-independent by construction. The same search, in the same order, with one sign
reversed: worst contour **1.692:1** → full alpha clears **12 of 15** cases → **one** lightness delta
of **−0.008** closes the residue at **3.0209:1**. In dark that delta is **+0.011** and it clears the
same 12 of 15.
