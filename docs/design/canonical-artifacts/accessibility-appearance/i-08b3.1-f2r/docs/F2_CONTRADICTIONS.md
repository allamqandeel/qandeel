# I-08B3.1-F2 — CONTRADICTIONS AND TENSIONS FOUND

§14 asks that a genuine Product contradiction be **reported rather than solved secretly**. §36 asks
for the list. This is it.

---

## NO GENUINE PRODUCT CONTRADICTION WAS FOUND

Nothing in the light appearance required a frozen Product decision to be wrong. In particular:

- **No status hue had to be invented.** Warning, Success and Informational stay neutral, resolving to
  reading-ramp rungs with no hue of their own, in both appearances. §14's stop condition was never
  reached.
- **No frozen dark value had to move.** The dark-regression gate is a clean PASS across values,
  routes, all five accessibility states and the raster.
- **No semantic role had to be added, split or re-pointed.**

What follows are **four tensions** — places where two frozen requirements pull against each other
and F2 had to choose, with the number that decided it. A tension is not a contradiction: both sides
remain true and the choice is defensible. They are here because a reviewer should be able to
disagree with the choice rather than discover it.

---

## TENSION 1 — Living Brass is a material AND an ink, and on a light ground those pull apart

**The frozen facts.** `qandeel.identity.mark` and `qandeel.navigation.machinery` both alias
`qandeel.identity.material`. Living Brass is therefore simultaneously the Product's identity
material and the ink of the identity mark and the navigation labels.

**In dark this never bit**, because a warm mid-tone on a near-black ground is legible by
construction — 6.070:1 without anyone having to arrange it.

**On a light ground it bites immediately.** Those labels are text below the WCAG large-text
threshold, so 4.5:1 binds; a material that reads as brass on white would not meet it.

**What F2 could have done and did not.** Split the alias in light only, giving `identity.mark` a
darker ink while `identity.material` stayed brassy. **That would give the semantic layer an
appearance-dependent shape** — the thing check P-02 exists to forbid — and it is not F2's to do.

**What F2 did.** One value, meeting the ink floor, as close to the frozen material as that allows:
`#7a6446` at 4.841:1, dEok 0.1424 from `#a58e6f`, hue held to 0.13°.

**The cost, stated:** Apple asks custom pairs to strive for 7:1. Light Brass is at 4.84:1. Pushing
it there forces OKLCh L 0.38 — a dark brown, which §7 forbids by name. **Dark Brass does not meet
7:1 either, at 6.07:1**, so this is not a light-only regression, but light is further from it.

> **FOR THE PRODUCT OWNER.** If the material matters more than the ink duty, the answer is to give
> the identity mark and the navigation labels a different role — which is a **B-track or E-track
> decision about the semantic layer**, not an appearance decision, and F2 has flagged it rather
> than taken it.

---

## TENSION 2 — "A meaning event must be perceptible" against "a meaning event must not obscure the world"

Both are frozen. LIGHT IS MEANING; and the Living Analysis World must not become a wash.

On a dark ground they do not compete: an event borrows empty luminance range and the world is
mostly empty anyway. **On a light ground they compete directly**, because the only way to make an
event large is to spend the ground, and the ground is what the analysis is drawn on.

**The first two selection rules chose perceptibility and were wrong.** *"The largest admissible
event wins"* ran to its bound and laid a continuous wash over half the world. *"Closest to the dark
appearance's peak"* is the same objective in better words, because an unreachable target makes
*closest* mean *maximum*.

**What F2 did.** Made perceptibility a **floor** — the appearance's own smallest reading step,
0.1017 — and then took **the mildest extreme the floor forces.** The event's area mean lands at
0.1022, just above.

**I-08B3.1-F2R DID NOT CHANGE THAT ANSWER. IT CHANGED WHERE THE FLOOR WAS MEASURED, AND THAT MOVED
THE EXPRESSION BY A LOT.** F2 applied the floor to the event's per-pixel PEAK. A peak is a property
of one point on the falloff; an event is a region. F2's expression cleared 0.1017 at 0.1046 — on a
glaze 0.14 wide in normalised intensity, which is a thin annulus with bare ground either side of it.
**Integrated over the disc a reader actually looks at, the same expression came to 0.0255: a quarter
of the floor its own peak had cleared.** The floor is unchanged and the quantity is now the
area-weighted mean along D2R's own falloff, **required at every peak level the three meaning
categories reach** rather than at an intensity no category attains.

**AND "EVERY LEVEL" TOOK A SECOND CORRECTION, BECAUSE THE FIRST ONE PICKED THE FLATTERING LEVEL.**
F2R initially evaluated at the level the *quietest* category reaches — CONNECTION's 0.8598 — on the
reasoning that the quietest category is the hardest case. It is not: **the signed bloom's area mean
falls as intensity rises**, because above the split the centre of the disc floods toward a core only
dEok 0.021 from the ground, so a stronger event paints more of its own disc with the quietest colour
it owns. The expression that came back cleared the floor at CONNECTION's level and failed it at
INSIGHT's and PATTERN's. "The quietest category" was a guess about the shape wearing a measurement's
clothes, and the verifier found it by measuring somewhere else and disagreeing with the record. The
requirement now binds at whichever of the three levels the expression scores lowest — and because the
dark event rises with intensity while the light event falls, **the two appearances bind on different
categories. Which category binds is a property of the expression, not of the Product.**

**The cost, stated:** the light meaning event is **about as perceptible, on average across its own
disc, as the difference between secondary and tertiary text.** That is a defensible floor and it is a
modest event. It is the second thing the Product Owner should judge on Boards C, D and E.

**AND THE VERSION THAT IS NOT MODEST WAS BUILT AND REJECTED.** Applying this package's own transfer
rule — preserve the ratio, not the value — would set the floor at 2.483 of the light appearance's own
reading steps, or 0.2525. That floor **is reachable**, and the expression that reaches it passed every
requirement the package stated at the time and rendered as an opaque brown-grey sphere on a
near-white World. The requirement that now rejects it, **R-SOURCE-DOMINANCE**, was written from that
render: no stop of the ramp may be darker than the World under its **own passage scrim**, L 0.5423.
All 2,379 configurations that reach the ratio floor fail it and nothing else. **So this tension has a
floor AND a ceiling now, and both are stated in the appearance's own values rather than in a
preference.**

---

## TENSION 3 — The functional Surface must separate structurally, and must not glare

I-08B3.1-B4R froze the World-to-Surface ratio at **1.0716:1** — deliberately tiny, and already weak
enough that I-08B3.1-F1 had to introduce a contrast BOUNDARY token to give increased contrast
something to work with.

Preserving that ratio in light preserves the weakness with it. **Widening it would have been easy
and would have been F2 inventing hierarchy**, which §3 forbids.

**What F2 did.** Preserved the ratio exactly, and moved the Surface **away from the extreme** —
deeper than the World in light, as it is lighter than the World in dark. Apple's base/elevated model
would have moved it the other way; it is not adopted, because B4R froze that the Surface is *not
elevated at all*.

**The cost, stated:** the light appearance inherits a very weak World-to-Surface separation, and a
reviewer who finds it too weak is finding a **B4R** question, not an F2 one.

---

## TENSION 4 — The atmosphere's chroma ceiling is derived from the Light, and the light Light is quieter

I-08B3.1-D2R derives the ceiling as `0.62 × the least chromatic Light stop`, *specifically so the
rule survives the Light being re-chosen*. F2 is the package that re-chooses it, and the ceiling moved
by itself: **0.0197 → 0.0193.**

**So the light appearance's ambient field is permitted about 2% less colour than the dark one's** —
not by a decision, but by a derivation working as designed.

**What F2 did.** Nothing. The derivation is D2R's and it is correct; overriding it would break the
property D2R built it for.

**What F2 had to add.** A clause in R-ORDER: the Light must carry **enough** chroma to hold the
atmosphere ceiling above the reading ramp. Without it, a quieter Light drags the ceiling **through**
the ink band and inverts two rungs of the cross-appearance ladder without either value being wrong
on its own. **That failure happened during the derivation and is why the clause exists.**

---

## Recorded for a different track

**The Living Analysis Map's camera** is panned by dragging, and WCAG 2.2 SC 2.5.7 requires a
single-pointer alternative. Inherited from I-08B3.1-F1, unresolved, and unaffected by the
appearance — noted here only so it is not lost in a second package.
