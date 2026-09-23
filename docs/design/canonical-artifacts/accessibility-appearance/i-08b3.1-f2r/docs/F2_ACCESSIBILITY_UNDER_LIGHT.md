# I-08B3.1-F2 — THE I-08B3.1-F1 TRANSFORMATIONS, RE-RUN IN LIGHT

> **Do NOT redesign F1. Test that the same transformation laws still work.** — §18

## The headline is how little there was to do, and it is a result rather than a shortcut

I-08B3.1-F1's accessibility transformations are almost entirely **re-routes**: a class is pointed at
a different rung of the frozen reading ramp. **An alias is appearance-independent by construction** —
it resolves through whatever the appearance supplies — so F1's hardest decision needs nothing at all
from F2.

| what F1 does under increased contrast | appearance-bound? |
|---|---|
| `qandeel.analysis.relation` → `{qandeel.content.secondary}` | **no** — an alias |
| `qandeel.control.functional` → `{qandeel.content.secondary}` | **no** — an alias |
| focus perimeter 2 px → 3 px | **no** — a dimension |
| atmosphere lightness near / mid / far | **yes** |
| the opaque scrim literal, under Reduce Transparency | **yes** |

**Four appearance-bound values out of F1's entire accessibility system.** The light appearance loads
F1's own increased-contrast and reduce-transparency files, unchanged, from the same paths the dark
appearance loads them from, and adds one small file to each.

## The same law reproduces itself on the other ground

I-08B3.1-F1's central argument was that raising the atmosphere *alone* — the obvious reading of
"increase contrast" — **compresses the meaning hierarchy**, because the loudest ambient contour
arrives at the strength of the weakest analytical object. Raising the analytical relation with it
widens the gap instead.

| | DARK | LIGHT |
|---|---|---|
| meaning-hierarchy ratio, default | 1.2914 | **1.3786** |
| … if only the atmosphere rose | 1.028 | **1.0032** |
| … with the analytical relation raised too | 1.524 | **1.5497** |

**The same collapse to ≈1.00, and the same widening to ≈1.55.** Nothing in F2 arranged that; it is
what happens when the same re-route is applied to a ramp whose ratios were preserved.

## The same search, in the same order, with one sign reversed

| step | DARK | LIGHT |
|---|---|---|
| worst contour, default | 1.73:1 | **1.692:1** |
| lever 1 — every contour to full alpha | clears 12 of 15 | **clears 12 of 15** |
| worst contour after alpha | 2.88:1 | **2.9161:1** |
| lever 2 — one lightness delta, all three layers | **+0.011** | **−0.008** |
| worst contour after the delta | 3.02:1 | **3.0209:1** |
| loudest contour | 5.50:1 | **5.4072:1** |
| layer spacing preserved exactly | yes | **yes** — 0.0674 / 0.0738 |

**The same 12 of 15 cases cleared by alpha alone** is not a coincidence — it is the same ladder
measured from the other end. **The sign is the whole difference:** on a near-black ground a contour
buys contrast by lifting off it, on a near-white ground by deepening against it.

**Lever order matters and is F1's.** Alpha first, because alpha moves no colour at all and therefore
cannot give any hue a new relationship to any other. Then **one** lightness delta for all three
layers, because a per-layer move would compress or expand the depth ladder, which is a change in the
spatial reading rather than in visibility.

## What is deliberately absent from the light increased-contrast override

Each absence is the same decision F1 made:

- **The World and the Surface do not move.** Whitening the light World to `#ffffff` would gain about
  1.07× on the tertiary ink and would cost the World its ability to hold a light — the requirement
  that fixed its lightness in the first place.
- **Living Brass does not move.** LIVING BRASS IS STATE-INVARIANT IN VALUE AND IN APPEARANCE
  (I-08B3.1-E1R). An accessibility setting is not an exception, and neither is an appearance.
- **QANDEEL Light does not move.** Deepening it under increased contrast would make every meaning
  event louder in proportion to a setting, which is meaning derived from a preference.
- **Error does not move.** `#ad4739` reaches 4.843:1 against the light World and carries a glyph and
  a sentence besides. F2 does not add a second error colour for this mode any more than F1 did.
- **Disabled does not move.** The rest ink rises under this context and the disabled ink does not,
  so the availability gap **widens**.

## Reduce Transparency in light

**The subject is the same three things, and the light appearance was the obvious place to acquire a
fourth.** Translucent light chrome is the house style of every platform QANDEEL ships on. It is not
adopted, for the reason it was not adopted in dark: I-08B3.1-B4R recorded that QANDEEL's functional
Surface is an opaque matte and *"Reduce Transparency has nothing to undo here"*. A translucent chrome
would be a design F2 has no authority to add, wearing an appearance's name.

**The substitution is still exact.** Every ambient contour composites against one flat opaque colour
— now `#efeeeb` instead of `#101010` — so its alpha composite still has a closed-form opaque
equivalent. The field is not simplified; it is pre-resolved.

**The one place it is not exact is the same place:** where two contours cross. Translucent strokes
tint each other there and opaque ones do not. That loses a crossing tint and no analytical content,
because `PRESENTATION_CONTRACT` declares contour shape, radius, layer and hue all `encodes: null`.

**The opaque scrim is `#706f6e`** — exactly what neutral black at alpha 0.532 produces over the light
World, computed rather than eyeballed, the same relationship `#080808` has to `#101010` at alpha 0.5.

**And the Light keeps its translucency**, as in dark: *a light whose alpha is removed is a disc.* It
matters **more** in light, because the light appearance's expression is a signed profile — both
halves are alpha composites, so an opaque Light here would not merely flatten an intensity, it would
delete the falloff and leave two hard discs where an illumination was.

## Reduced Motion in light

**Unchanged, because it is appearance-independent.** I-08B3.1-D2R proved that every reduced
counterpart reaches the SAME settled residue as its full-motion sibling and that the settled frames
are byte-identical across sequences. F2 inherits that property and relies on it: at settle there is
one scene in each appearance, and the parity matrix asks whether it still contains every object.

**F2 adds exactly one motion and it is the appearance cross-fade** — see
`F2_APPEARANCE_SWITCH.md`. It is the one place F2 departs from the obvious reading of F1's channel
model, and the departure is to *remove* rather than to keep.

## Larger text, bold text, and the one thing the light appearance puts at risk

Larger Arabic text and Bold Text are appearance-independent in mechanism, and the parity matrix runs
all four text expressions in both appearances with no truncation anywhere.

**But there is a real asymmetry worth naming.** Dark-on-light strokes read optically **thinner** than
light-on-dark strokes of the same weight. I-08B3.1-E1 gives SELECTED a 100-unit weight step over
REST and F1 proved Bold Text does not erase it — on a light ground that step is the typographic
signal most at risk, because apparent weight is exactly what a light ground takes away.

Check **X-05** therefore measures the SELECTED-to-REST gap in **both** appearances at every text
setting rather than assuming F1's dark result carries. Its probe is a bold delta large enough to
clamp both rungs at Estedad's variable-axis maximum of 900, which collapses the step to zero.

## Colour is not the only carrier, and the light appearance does not make it more so

- **Error** carries ink, a glyph and its message in words. Board H shows it under grayscale.
- **SELECTED** is an attached marker plus a weight step; **FOCUS** is a detached perimeter with an
  offset and a companion; **PRESSED** is a transient ground response. **None of the three is
  identified by its colour**, which is why none collapses into another when the appearance changes.
- **UNAVAILABLE** states its reason in words on a real control.
- Board K shows the light appearance under grayscale and under simulated deuteranopia.

## What is NOT proved here

**No real VoiceOver or TalkBack run exists, in either appearance.** I-08B3.1-F1 recorded that as a
mandatory implementation / integration validation gate and **F2 does not discharge it.**

The screen-reader projection is appearance-independent by construction — it has no appearance at all
— and the parity matrix confirms the two are identical. **That is evidence about the projection and
not about a device**, and browser accessibility-tree evidence does not equal real screen-reader
validation.
