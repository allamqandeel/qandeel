# I-08B3.1-F2 — DESIGN RATIONALE

## What the question actually was

§1 of the brief asks: **what does the same QANDEEL world become in light?** — and says explicitly
that the question is *not* "what are the inverted dark colours?"

The difficulty is that almost every honest answer to the first question is also a plausible answer
to the second. A light appearance derived carefully and a light appearance derived by inversion both
produce a light ground, dark ink and a warm accent, and a reviewer cannot tell them apart by looking.
**So the first thing F2 needed was a way to tell them apart by measuring.**

## The measurement that settled it

Invert QANDEEL's twelve appearance literals per channel and read the hues back:

| role | dark hue | inverted hue | rotation |
|---|---|---|---|
| Living Brass | 75.0° | 256.0° | 179.0° |
| Error | 30.3° | 214.0° | 176.3° |
| Primary reading ink | 94.2° | 273.1° | 178.9° |
| QANDEEL Light core | 89.1° | 263.3° | 174.2° |
| Disabled | 88.7° | 268.5° | 179.8° |

**Mean rotation 178.7°.** Every chromatic role in this system lands on the opposite side of the
colour wheel. An inversion does not produce different values — it produces a **blue identity
material** and a **teal error**.

That single table converts §4 from a preference into arithmetic, and it produces the contract the
rest of the package is built on: **hold the hue.** `qandeel.appearance.hue-constancy` is 3°, the
maximum measured drift across the whole system is **1.7°**, and Living Brass and Error both hold to
within **0.2°**.

## The invariant that was found rather than imposed

Measure the chroma of every appearance literal in the frozen dark system and sort:

```
ERROR 0.1364  >  BRASS 0.0516  >  LIGHT 0.0317–0.0462  >  [atmosphere ceiling 0.0197]
              >  INK 0.0106–0.0153  >  DISABLED 0.0081  >  WORLD / SURFACE 0.0000
```

The one status colour is the most chromatic thing on screen. Then the identity material. Then
meaning. Then the world's atmosphere. Then reading. Then the ground.

**Nobody wrote that down.** I-08B3.1-A froze the reading ramp, C3 chose the Brass body, D2R derived
the Light and the atmosphere ceiling, E1 added the Error — four packages, four independent reasons,
and this is what fell out. Which is exactly why it is a genuine invariant and not a rule imposed
afterwards, and why F2 adopts it as *the* cross-appearance identity mechanism:

> **APPEARANCE CHANGES THE LUMINANCE ENVIRONMENT. IT DOES NOT CHANGE THE CHROMA ORDER.**

It is a ladder of **role families**, not of values. In dark the World and the functional Surface are
both exactly achromatic, so their relative position among the individual literals is an artefact of
a sort and not a fact about QANDEEL — the first version of check X-01 compared the eleven literals
one by one and failed for that reason.

## The architecture was already there

§26 asks for `semantic role → appearance projection → accessibility transformation` rather than two
unrelated palettes. **That is not a structure F2 invented.** I-08B3.1-B4R shipped it before a light
appearance was on anyone's list, and said so in its own semantic file:

> *"Appearance-independent: it names what things ARE, never what they look like. Colours live in the
> expression layer that an appearance set supplies."*

And three of the inherited resolvers already carry an `appearance` modifier whose `light` context is
an **empty set with an owner named on it** — B4R's, C3's and E1's, each authored as a deliberate
absence rather than an oversight. C3's carries invariant I-13: *"a light expression that returned the
dark body would be a value nobody designed, shipping under a name someone trusted."*

**F2 fills four declared-empty contexts and adds one modifier the chain did not have.** It creates no
semantic role. §27's example names are not used because the canonical equivalents already exist.

The consequence is the most useful fact in the package: **resolve the frozen chain and count the
literals an appearance owns — there are twelve.** Everything else is an alias. A second appearance
is therefore twelve derivations rather than a second design system, and cross-appearance semantic
parity is **structural**: the roles cannot diverge because there is only one set of them.

## Why each role got its own rule

A single transfer function applied to every role is an inversion wearing better clothes. §4 asks for
each major role to be derived *according to its semantic and perceptual responsibility*, and the
rules genuinely differ:

- **The reading ramp preserves RATIOS**, because QANDEEL's hierarchy *is* the set of ratios.
  I-08B3.1-F1 established that when it forbade increased contrast from inventing importance.
- **Living Brass preserves HUE AND CHROMA and meets a FLOOR**, because a material's identity is its
  hue and its chroma, and its contrast requirement is a floor rather than a target. Applying the
  ramp's rule to it gives `#6b5538` — 37% further from the frozen material for a ratio nobody
  required.
- **The scrim preserves a FACTOR**, because suppression is multiplicative. It is the one role whose
  value barely moves: alpha 0.5 in dark, 0.532 in light.
- **The atmosphere preserves CONTOUR CONTRAST per layer**, because the field's presence is a Product
  requirement even where its contrast is not an accessibility one.
- **The World is bounded by what has to happen in it** — the highest lightness at which a meaning
  event can still be seen to occur.

## The hardest problem, and the two wrong answers that came first

§8's warning that *"make it brighter may fail completely"* is correct and the number is brutal: the
dark appearance's own technique, on the light ground, reaches **dEok 0.0395** against dark's
**0.6925**.

Four families were parameterised and searched. Three fail, each for a reason the brief predicted —
and the one that kills the *tempting* answer is an accessibility requirement rather than an
aesthetic one: the chroma-only family reaches **dEok 0.0000** once the colour is removed.

**Two selection rules were tried and discarded, and both are recorded because the failure mode is
the interesting part.**

1. *"The largest admissible event wins."* An objective with no upper bound runs to one. The glaze
   went to its widest and deepest setting and the rendered INSIGHT laid a continuous wash over half
   the world. Every number was right; the objective was wrong, and it was wrong in a way the numbers
   could not report, because *largest* was exactly what it had been asked for.
2. *"Closest to the dark appearance's event peak."* This sounds like parity and is not — the target
   is unreachable, and **closest to an unreachable target is maximum**. The same runaway objective in
   better words.

The rule is now the discipline the package states everywhere else: **meet the floor, then take the
smallest glaze the floor forces.**

## What F2 refuses to conclude

- **That the two appearances' meaning events are equally strong.** They are not, per-pixel, and the
  package says so on three boards and in two token files. A dark ground lends an event the whole
  empty luminance range above it; a light ground has already spent it.
- **That the North Star is closer.** F1 froze it OPEN, NOT PROVEN, NOT WEAKENED, OWNED BY G, and F2
  preserves that wording. See `F2_NORTH_STAR_CARRY_FORWARD.md`.
- **That any of this survives a device.** No device was available. `F2_DEVICE_VALIDATION.md`.
- **That F may be frozen.** `F2_FREEZE_CANDIDATE.md` states the candidate and the conditions. The
  decision is not F2's.
