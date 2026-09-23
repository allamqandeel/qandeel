# I-08B3.1-F2R — WHAT THIS REVISION CHANGED, AND WHY

F2 was accepted apart from one thing: independent review found the light appearance's **meaning
event too quiet, especially CONNECTION**, and rejected the magnitude. This document is the record of
the repair. It is deliberately about the *reasoning*, because in every case but one the design was
closer to right than the numbers were, and the numbers were wrong in ways worth keeping.

**F is not declared frozen by this package. F2R is a targeted repair, not a restart.**

---

## 1 — THE BLOCKER HAD THREE CAUSES AND ALL THREE WERE MEASUREMENT ERRORS

Not one of them was a defect in the expression family.

### 1a — The floor was on the event's PEAK, and a peak is a property of one point

R-EVENT required the event's per-pixel peak `dEok` from the ground to exceed the appearance's own
smallest reading step. F2's expression cleared it: **0.1046 against 0.1017**. It cleared it on a glaze
**0.14 wide in normalised intensity** — a thin annulus with essentially bare ground on either side.

Averaged over the disc a reader actually looks at, weighted by the area element `2f df` along
I-08B3.1-D2R's own falloff, the same expression came to **0.0255**. A quarter of the floor its own
peak had cleared.

*An event is a region. The quantity is now the area mean.*

### 1b — The proof sampled one category on another category's clock

F2 used **one set of beats for three meaning categories**. PATTERN peaks at 3010 ms and INSIGHT at
2920, so those two were well served. **CONNECTION peaks at 1050 ms**, and at t=2900 it stands at
**0.363 of its own level**.

The frame captioned *"CONNECTION — PEAK"* was CONNECTION on its tail. Measured on the rendered pair
the review was shown, the darkest point is **9 luminance units of 255** below the ground, against
about 32 at its true peak. **The review compared REST against that frame and read that frame
correctly.** Roughly three quarters of what was rejected was this, and no amount of re-deriving the
expression would have fixed it.

*Beats are now derived per category from D2R's own event function, by scanning the level series it
returns: peak at the argmax, rise and fall at the half-level crossings.*

### 1c — The requirement was evaluated at an intensity no category reaches, and then at the flattering one

D2R's envelopes top out at **0.8598** (CONNECTION), **0.9587** (PATTERN), **0.9219** (INSIGHT). F2
measured at 1.0. A requirement evaluated where the Product never goes is a requirement about nothing.

**The first correction replaced 1.0 with "the level the quietest category reaches", and that was a
guess about the shape wearing a measurement's clothes.** The signed bloom's area mean *falls* as
intensity rises: above the split the centre of the disc floods toward a core only `dEok` 0.021 from a
ground at L 0.9491, so a stronger event paints *more* of its own disc with the quietest colour it
owns. The configuration that came back cleared the floor at CONNECTION's level and **failed it at
INSIGHT's and PATTERN's** — two of three categories failing a requirement the derivation reported as
met.

It was found because the verifier still measured at 1.0 and **disagreed with the record**. A verifier
disagreeing with a record is normally a defect in the verifier; here it was the only reason anyone
looked at the third number.

*The floor is now required at every level the Product reaches, which means at whichever of the three
the expression scores lowest — computed per configuration, because for a non-monotonic expression the
argmin is not a constant. The dark event rises with intensity and binds on CONNECTION; the light event
falls and binds on PATTERN. **Which category binds is a property of the expression, not of the
Product**, which is why it could never have been a named constant.*

---

## 2 — THE TECHNIQUE WAS REOPENED EXACTLY AS FAR AS THE CORRECTION REQUIRED

The family stands. `signed-bloom` is still the only family in the search with a signed luminance
profile, and that is still the only reason anything survives two requirements that pull in opposite
directions on a near-white ground. What moved is its shape, and one parameter is gone.

### `glaze-gain` is REMOVED

It made the glaze's **depth** and its **strength** two names for one quantity. The search could reach
the same painted composite from a shallow stop at high gain or a deep stop at low gain, and had no
way to choose between them — and the deep-stop answers put the authored `low` value inside the reading
ramp's own lightness range while the picture was identical. **The Meaning Light now has ONE gain in
both appearances, D2R's own wash opacity**, exactly as the dark ramp does.

### The glaze weight now vanishes at zero BY SHAPE

A bare Gaussian centred on the split is non-zero at zero intensity. At a width of 0.14 the residue
was far under one 8-bit step, so nothing noticed. The correction needs a **wide** glaze, and there the
same shape leaves a visible tint at the exact intensity at which the event is supposed to be over —
with R-SETTLE still reporting a clean settle, because `at(0)` is a special case in every profile.
**A requirement satisfied by a special case is satisfied by the special case and not by the design.**

New requirement `R-CONTINUOUS` and check `C-08` test the shape *arriving* at the ground.

### The selection rule, and the proof that it converges

**Among admissible configurations, the mildest extreme**: least peak departure, subject to the area
mean clearing the floor. Ties break on the shallowest third rung, then the least **total** hue drift
against the dark stops, then the least extent, then the least shape.

Two earlier rules ran to a bound, so this one was checked for the same failure. Sweeping the
glaze-width cap, the attainable minimum peak saturates *inside* the grid rather than leaning on its
edge.

**The hue tie-break is on the SUM of the per-rung drifts, not the worst rung.** Broken on the worst
rung it traded a core sitting *exactly* on its dark counterpart for a few hundredths of a degree on a
rung where the 8-bit grid is the dominant term.

**And the magnitude objective is now quantised to a just-noticeable step — the third repair this one
rule has needed.** Compared at full float precision, a difference of 0.0001 in the event's peak
departure outranked **two degrees** of cross-appearance hue drift. A fortieth of the smallest
difference anyone can see was deciding role identity. *An objective compared below its own perceptual
resolution is not expressing a preference about the picture; it is ordering numerical noise.*

| selection rule | how it failed |
|---|---|
| *the largest admissible event* | ran to its bound — a wash over half the world |
| *closest to the dark appearance's peak* | the target is unreachable, so *closest* means *maximum* |
| *the unquantised minimum peak* | sub-JND magnitude outranked role identity |

All three produced a correct number and the wrong answer, and **none of them could be caught by
inspecting the winner alone** — you have to see what it was chosen *over*. The record now carries a
`selectionAudit` saying how many configurations shared the winner's magnitude bucket and the best and
worst hue drift among them, and `X-03` asserts the shipped drift is the best of them. **A tolerance
is a ceiling, not a budget**, and until F2R that sentence had no check behind it.

### And where the tolerance genuinely IS spent, the package says what stops it being smaller

The shipped ramp's third rung sits **2.85°** from its dark counterpart, against a 3° tolerance. That
is a thin margin, so it arrives with its cause rather than on trust: of the **480** configurations at
this magnitude carrying less total drift, **none is admissible**, and every one fails `R-EVENT` or
`R-SOURCE`. Putting that rung on its counterpart's hue needs more chroma; at a fixed hue more chroma
lowers the lightness sRGB can hold; the flooded core comes down with it and stops clearing a
just-noticeable rise. The best alternative sits at **0.36°** with a source rising **0.018** against a
floor of 0.020. **`R-HUE` and `R-SOURCE` pull against each other through the gamut boundary**, and
the gamut is not negotiable.

### R-HUE now measures each rung against its own dark counterpart

The old test compared all three stops to the dark **core**, which is weaker: it admitted a ramp 3.78°
from the dark value it is the counterpart of. That is the quantity check `X-03` and
`qandeel.appearance.hue-constancy` are actually about.

### The coarse pass was too narrow in RANGE

Raising the candidate floor made a 120-configuration coarse grid report **every ground non-viable**
while the full grid had thousands of admissible configurations at those same grounds. *A coarse pass
may be coarse in resolution; it may not be narrow in range.*

---

## 3 — THE ONE NEW REQUIREMENT, AND HOW IT WAS FOUND

`R-SOURCE-DOMINANCE`: **no stop of the Meaning Light ramp may be darker than the World under its own
passage scrim.**

### It was found by looking, not by reasoning

This package's transfer rule everywhere else is *preserve the RATIO, not the value* — the reading inks
preserve contrast ratios, the atmosphere preserves its contour contrast, the scrim preserves its
suppression factor. Applied to the meaning event it asks the light event to stand to the LIGHT reading
ramp as the dark event stands to the DARK one.

**That floor is reachable.** A complete, admissible expression that reaches it was derived in full. It
satisfied **every requirement the package stated at the time** — hue drift well inside tolerance, the
chroma ladder preserved, every separation clear, a clean settle, an extent inside the dark event's.

Rendered at CONNECTION's own peak it is an **opaque brown-grey sphere sitting on a near-white World**.

**A configuration that passes every check and fails on sight means a check is missing. It does not
mean the eye is wrong.**

### The bound is a value the appearance already owns

A light ground cannot lend a source much brightness — on a World at L 0.9491 a source can rise by at
most about `dEok` 0.021 before it runs out of range — so **a perceivable light event must borrow
magnitude from darkening.** R-SOURCE says the source must be lighter than its ground. It does not say
how much deepening may accompany it, and that silence was the hole.

The **passage scrim** closes it. It is what QANDEEL paints over a region it is pushing behind
something else — `qandeel.appearance.passage-is-suppressed` — and it composites from an alpha solved
against the dark appearance's own suppression factor. Nothing about it was chosen for this purpose.

> **An event that means *QANDEEL understood* may not be darker than the veil that means *not this, not
> now*.**

### It is measured on the STOPS, and that is the sound place rather than the convenient one

The composite at any intensity is a convex blend of a stop with a backdrop no darker than the ground,
so **the deepest stop bounds the lightness of every pixel the event can paint.** Stops above the scrim
guarantee a whole event above the scrim.

Measured on the *composite* the test does not separate the two candidates at all — the rejected
expression's darkest pixel sits **above** the scrim, because a partial glaze never reaches its own
stop. A bound on the composite would be a bound on one frame; a bound on the stops is a bound on the
expression. `R-INK-SEPARATION` is on the stops for the same reason and says so.

### What is reported and NOT bounded

The **dip-to-rise ratio** is the number that best describes what a reader sees differently between the
two candidates. It is in the record as `dipOverRise` and it carries **no threshold**, because any
threshold between the two measured values would be a threshold read off two samples — which is taste
wearing a measurement. A later brief may bound it if it finds a reason to.

### And it did not become the only thing holding that door

Pure darkening has no rise at any depth, so **R-SOURCE is still the requirement that fails every
variant of the darkening family**, and still the one that excludes it as a family. What
R-SOURCE-DOMINANCE removes is the part of that family which made it attractive: its deep
configurations — the only ones with the magnitude to clear R-EVENT — are also the ones that go darker
than the scrim. The shallow ones that survive the new bound fail R-EVENT instead.

That matters because independent review asked for *"the source must always be lighter than the
ground"* to stop being treated as Product law. It is now a `production-default` **and it is no longer
load-bearing alone.**

---

## 4 — THE EXTENT CLAIM MOVED TO SCENE SCALE

`R-FOOTPRINT` and check `C-06` bound **one** source along its own 1-D falloff. That is the right
instrument for a shape and the wrong one for a stain: the stain risk is at scene scale, where five
INSIGHT lobes can each satisfy a per-source bound and cover the world between them. That is exactly
the failure an earlier selection rule produced, and every per-source number was correct while it
happened.

New check `C-10` compares each category's published **PEAK** raster against its own **REST** raster,
pixel by pixel in OKLab, and counts the fraction of the world that moved beyond a just-noticeable
step — in both appearances, with the light appearance required never to exceed the dark one.

**The instrument is probed where the pixels are.** A reading of three per cent is the same shape a
broken comparison produces — wrong stride, wrong decode, a colliding cache key — and every one of
those also reports *almost nothing changed*. So the light INSIGHT peak is also compared against the
**dark** REST frame, where the ground itself differs and nearly every pixel must register.

---

## 5 — FREEZE-BOUNDARY CLEANUP

Independent review was explicit that ordinary derivation heuristics were being frozen as Product
truth. Five statements were demoted from `product-contract` to `production-default`, each now naming
the contract it serves:

`chroma-order` · `hue-constancy` · `hierarchy-is-a-ratio` · `suppression-is-subtraction` ·
`meaning-has-a-source`

Five contracts were added to carry what was actually frozen:

`roles-stay-separable` · `role-identity-survives-appearance` · `reading-hierarchy-is-preserved` ·
`light-remains-meaning` · `passage-is-suppressed`

**And the boundary is now enforced structurally.** Check `K-01` requires every non-contract value to
name a `serves` target that **exists and is itself classified `product-contract`**. Writing the
demotions without that would have shipped chains of defaults serving defaults and reaching no contract
at all — *the exact failure the review asked to fix, introduced by fixing it.* Six values had no
`serves` at all and were found by it.

---

## 6 — PORTABLE VERIFICATION

An independent Linux extraction produced **30/33** while every record inside the archive said PASS.
The three failures were `D-01` / `P-01` / `S-01`, which asserted that each delegated record was
**newer** than the token tree. A ZIP entry carries a whole-second DOS timestamp, and this archive
writes a zero timestamp, so an extraction can land every file on the same instant or in any order.
**An mtime ordering is a claim about the machine that produced the files, not about the files.**

`tokenTreeDigest()` replaces it: sha256 over every token file's path and bytes, sorted, separators
normalised. Four gates stamp it into their records and the verifier compares the stamp against the
tree in front of it. **All mtime use is gone.**

New check `K-04` asserts the binding and probes it by mutating one byte of one token file.

`F2R_CLEAN_EXTRACTION.md` records the proof from an actual clean extraction — and it does not merely
reproduce equal mtimes, it reproduces the **worst** case for the old rule: every token file stamped
newer than every data record.

---

## 7 — CONSISTENCY CLAIM C7, AND THE DEFECT THAT PROMPTED IT

A frozen-appearance token file quoted **`dEok` 0.531** for the dark meaning event and **0.035** for
its settle. Neither is any quantity this package measures, on either ground, at any intensity — they
were drafted before the search ran and never revisited.

`C1` checks hexes, `C2` checks `oklch` triples, `C3` checks counts, `C4` checks search sizes. **The
perceptual distances — the numbers every argument in this package is made of — had no guard at all.**
A figure is the easiest thing in a design document to invent and the hardest to notice, because it
looks exactly like a measurement.

`C7` requires every `dEok` figure quoted on an authored surface to be a value the derivation produced,
compared at the precision the figure is written at, with a narrow withdrawal window for revision
records. It found two more the day it was written, and one of them was a figure a **tool** had
computed two lines above and then restated by hand.

---

## 8 — WHAT DID NOT MOVE

The Light World, the Surface, the three reading inks, Living Brass, Error, Disabled, the scrim, the
increased-contrast delta, every appearance-switch semantic, and **every frozen dark value**. The
accepted dark raster re-renders byte-identical.

F2R changes the Meaning Light's three stops and its shape, the freeze classifications, the freshness
mechanism, and the instruments. Nothing else.

The North Star remains **OPEN / NOT PROVEN BY F1 / NOT WEAKENED BY F1 / OWNED BY G.**
