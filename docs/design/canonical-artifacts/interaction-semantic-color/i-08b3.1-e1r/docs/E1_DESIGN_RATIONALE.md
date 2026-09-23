# E1_DESIGN_RATIONALE

**I-08B3.1-E1 — INTERACTION + SYSTEM SEMANTIC COLORS.**
**Revised by I-08B3.1-E1R.** Freeze candidate. Frozen by nobody.

> **What I-08B3.1-E1R changed, and what it did not.** No token value moved and no accepted
> expression was redesigned. Four sentences this package had frozen as Product contract were
> corrected: the exclusivity rule about visual channels (false — §3), the absolute about the
> focusability of an unavailable control (too narrow — §3.1), the universal about identity
> material and availability (outside this package's authority), and the cap on the number of
> status hues (§4). The withdrawn wording, with what was wrong with each, is in
> `E1R_REVISION_RECORD.md`.

---

## 1. The sentence this package adds to the grammar

QANDEEL already has three:

```
BRASS IS MATTER.          what a thing is made of. Permanent. State-invariant.
LIGHT IS MEANING.         what the system understood. An event: it rises, decays, reaches exactly zero.
ACTIVITY IS PROCESS.      and it has no expression in the visual system at all.
```

E adds the fourth and fifth, and they are deliberately not about the object:

```
STATE IS THE USER'S POSITION.     where input is going, what the user chose,
                                  whether the user is touching, whether the user may.
STATUS IS WHAT NEEDS ATTENTION.   not what happened. What needs attention.
```

Everything else in this package follows from those two sentences, and each of them
carries a mechanical consequence rather than only a mood:

- If state is the user's position, then state belongs to the *relationship*, not to the
  material or the meaning — so **interaction state introduces no colour at all**. Check
  **R02** asserts that every colour under `qandeel.state` is an alias into the frozen
  reading ramp, with one exception the ramp itself produced.
- If status colour marks what needs attention rather than what happened, then a role
  **earns** a colour by having to *interrupt* — and so far only failure has. **ERROR
  currently owns the only dedicated status hue**, and check **R03** asserts that the graph
  agrees with the shipped policy and that every role without a hue carries the condition
  that would overturn its refusal. **The number is not frozen; the earning is.**

---

## 2. What E1 adds to QANDEEL, in full

**One colour.** `qandeel.expression.status.error` = `#fe907e`, the error ink.

**One extension of the frozen reading ramp.** `qandeel.expression.state.disabled` =
`#696762` — the ramp continued by its own rung, one step below the dimmest rung the
Product reads with. It is not a status colour and it is not an opacity.

**Nothing else.** Press, focus and selection are expressed entirely in the Product's own
frozen neutrals, in geometry, in type weight and in behaviour.

Three of the four functional status roles — **warning, success, informational** — are
KEPT as Product roles and have **not earned a dedicated hue**, and each of them records the
condition that would overturn that decision **and the Product evidence a hue would require.
Two of those three conditions have since been met**, and neither is answered with a colour;
see §4 and `E1R_PRODUCT_SURFACE_AUDIT.md`.

---

## 3. The composition model, which is how the five states are told apart

**This section used to state an exclusivity rule, and the rule was false.** It said each
state owned a different channel and that no channel was used by two states. SELECTED writes
the ink and DISABLED writes the ink; it was untrue as written. The expressions below are
unchanged. What follows is the true account of why they compose.

| channel | owner | also written by | resolved by |
|---|---|---|---|
| **GROUND** — the Product's own ink at low presence, transient, on pointer-down | PRESSED | — | — |
| **DETACHED PERIMETER** — outside the control, separated by a gap | FOCUS | — | — |
| **ATTACHED MARKER (presence)** — a segment on the anchored edge | SELECTED | — | — |
| **INK** | SELECTED | **DISABLED** | **P1** |
| **TYPE WEIGHT** | SELECTED | — | — |
| **AVAILABILITY** *(not a visual channel)* | DISABLED | — | — |

**P1** availability overrides ink, including the marker's — and takes neither the marker's
presence nor the weight. **P2** availability suppresses the press response. **P3** focus is
orthogonal and is never suppressed by another state.

That is why every pair the brief asks about composes rather than collides:

- **SELECTED + FOCUSED.** The marker is attached and is a *segment* — inset from the
  control's top and bottom. The indicator is detached and is a *continuous perimeter*.
  On one row they appear as two objects with ground between them, which
  `b04-selected-vs-focus.png` shows and a magnification of the raster confirms.
- **PRESSED + SELECTED.** The wash is on the ground and the marker is on the object, so a
  selected row being pressed shows both, and the ground returns to rest while the marker
  does not.
- **PRESSED → RELEASED.** Nothing persists, because a press never touched the object.
- **SELECTED + UNAVAILABLE.** *Not expressible under the old rule, which had to call it
  impossible.* The ink collapses and the record of the choice — marker and weight — does
  not. `b17-state-composition.png`.

All sixteen combinations are enumerated with a verdict in the shipped token file. Four are
unreachable, all four by P2.

Material 3 takes the opposite route and says so plainly: "**only one state layer can be
applied at a given time**", at 8 % for hover, 10 % for focus, 10 % for press and 16 % for
drag. That is one channel carrying four states at four opacities, and it cannot express
focus and press at once — which for a product where focus and selection must coexist is
not a detail. E1 diverges deliberately and the Reference Gate records where.

### 3.1 DISABLED is not a fifth peer, and that is why its absolute was wrong

The other four states describe **where the user is**. DISABLED describes **what the system
permits**, which is why it behaves as an override. E1 froze that an unavailable control is
never focusable — and the exclusivity rule above made that sound like a consequence of the
model rather than the separate accessibility claim it was. It is one of two legitimate
patterns and it is the one with the cost: W3C's APG, *"screen reader users are far less
likely to discover disabled elements that are not focusable because moving focus is one of
their primary methods of discovery."* Two patterns now ship, visually identical, differing
only in focus-order membership. `E1_STATE_SEMANTIC_MAP.md` §5.1.

---

## 4. Why status colour is earned rather than assigned

The habitual answer is a taxonomy: green means good, orange means careful, red means bad,
blue means here is a fact. E1 rejects it, and not on taste.

**Error is retrospective and about state** — something failed, or what is here is not
valid. Marking a *thing* as wrong is what colour is good at.

**Warning is prospective and about consequence** — this will happen if you proceed. Colour
is bad at futures and copy is good at them. And in QANDEEL a warning is never ambient: it
is always attached to a commit the user is performing, so the boundary they commit across
is already the right carrier, and that boundary already exists in the frozen Surface
contract ("a FIELD is a boundary, not a box: the line does the work").

**Success is a state that changed**, and the interface is already showing it. A persistent
green would be a second, weaker statement of a fact the state system makes better.

**Informational is rank**, and the frozen three-step reading ramp was built for rank.

So: **if only the thing needing attention is coloured, then the coloured thing is always
the thing needing attention.** The asymmetry is the product of the decision, not a gap in
it. Material 3 arrived at the same place independently — its 26 standard colour roles come
in six groups, and **error is the only status role among them.** There is no success role
to inherit and no warning role to inherit.

Each of the three refusals carries a falsifiable condition, written into the token tree:

- **Warning** fails if a warning must ever appear *ambiently*, detached from a commit the
  user is performing. **MET** — ambient service degradation, `E1R_PRODUCT_SURFACE_AUDIT.md`
  §3.7.
- **Success** fails if an operation's result cannot be shown in place. **MET** — background
  completion after the user has navigated away, §3.8.
- **Informational** fails if information is a distinct *kind* rather than a subordinate
  detail — and then the answer is still a glyph, not a hue. **Not met.**

**Two of the three conditions are met, and E1R creates no hue for either.** A condition
being met means the refusal is no longer automatic, not that a colour is owed: in both cases
the first answers are still position, glyph, copy and somewhere for the result to land. Both
are handed to Product with the case named.

**That finding is the practical argument for the revision.** E1's wording — a frozen count
of status hues — left nowhere to record it except as a contradiction. What is frozen now is
that a hue must be **earned** and that QANDEEL uses no generic traffic-light palette. The
number is not.

---

## 5. The measurement that makes the colour-only prohibition specific to QANDEEL

WCAG 2.2 SC 1.4.1 is generic: colour must not be the only visual means. Its Understanding
document offers an escape — a difference in lightness at a contrast ratio of 3:1 or greater
counts as an additional visual distinction.

**E1 measured that escape and it is not available here.** The error ink reaches **1.03:1**
against the secondary reading ink and **1.58:1** against the tertiary. So in QANDEEL the
glyph, the copy and the promoted boundary are load-bearing, not belt-and-braces.

There is a second, sharper measurement. QANDEEL's reading ramp is not achromatic: it sits
at OkLCh hue 91–94 with chroma 0.011–0.015. Under simulated protanopia a red collapses
toward that same warm neighbourhood, and the binding constraint on the entire error
derivation turned out to be **`protan: dEok from SECONDARY`** — the distance between the
error ink and the Product's own reading ink, for a red-blind reader. For that reader the
error ink and *Living Brass* are the two closest things in QANDEEL (dEok 0.055 against a
floor of 0.051). Both facts are arguments for the non-colour channel, and both are
arguments for keeping Brass scarce.

---

## 6. What the derivation cost, and what it bought

**`#fe907e` is PRODUCT-OWNER VISUALLY APPROVED**, and its acceptance rests on Product visual
judgement plus contrast and accessibility evidence plus semantic-separation evidence.

The value has **one declared Product decision** — that it belongs to the red family, which
is FAMILIARITY, the single convention E1 keeps from ordinary UI. Every other coordinate is
derived; `E1_COLOUR_DERIVATION.md` gives the whole chain.

**The derivation is engineering evidence about this palette on this ground, and not an
accessibility law.** Its perceptual floor is QANDEEL's own — *as far apart as Living Brass
already is from the reading ramp* — so a different system, a different ground, or a
differently-argued floor would admit different values. The figures below say the value does
not break anything QANDEEL already relies on. **They do not prove that no other valid error
red could exist**, and I-08B3.1-E1R corrects E1 for letting them read that way.

The headline result is uncomfortable and is reported rather than smoothed: **the
accessibility floors consume almost the entire red region of the sRGB gamut at this
lightness.** Only 3 sampled points are feasible, and the gamut edge is 0.001 of chroma
away. There was very nearly nowhere to stand.

The same floors, applied unchanged to the two error reds a designer would otherwise reach
for, reject both:

| candidate | result against QANDEEL's palette |
|---|---|
| **Material 3 dark error `#f2b8b5`** | 3 floors unmet. It collides with **QANDEEL LIGHT** under dichromacy — both are pale warm values, and under deuteranopia they sit dEok 0.018 apart against a floor of 0.051. |
| **Apple systemRed dark `#ff453a`** | 2 floors unmet. Under simulated protanopia it falls to **3.74:1** on the World and **3.49:1** on the functional Surface, below the 4.5:1 it needs as text. |

That is why E1 derived a value instead of adopting one, and it is check **R14**'s probe
rather than a paragraph.

---

## 7. What E1 does NOT do

It does not solve Light Mode, Increase Contrast, Reduced Transparency, screen or tab
transitions, navigation choreography, semantic zoom, camera travel, Timeline motion,
Return to Live, the full micro-interaction system, or the global Product motion hierarchy.

It designs **no hover state**, and that is a decision rather than an omission: QANDEEL
ships touch-first, and a touch device fires hover on tap, which turns a hover expression
into a false press. The namespace is not reserved for one either — see
`E1_KNOWN_LIMITATIONS.md`.

It freezes no icon geometry, no navigation form, and no placement.

---

## 8. Where to look

| question | file |
|---|---|
| **what I-08B3.1-E1R changed, and the withdrawn wording** | **`E1R_REVISION_RECORD.md`** |
| **the bounded Product-surface audit of the status policy** | **`E1R_PRODUCT_SURFACE_AUDIT.md`** |
| the five states, the two availability patterns, the composition matrix | `E1_STATE_SEMANTIC_MAP.md` |
| which roles have earned a hue, with reasons and overturn conditions | `E1_FUNCTIONAL_SEMANTIC_ROLES.md` |
| how the one colour was derived | `E1_COLOUR_DERIVATION.md` |
| the non-colour channels, and the Arabic copy contract | `E1_NON_COLOUR_COMPANION.md`, `E1_ARABIC_COPY_CONTRACT.md` |
| the inherited collision, and what happened to it | `E1_DISABLED_COLLISION_RESOLUTION.md` |
| Brass / Light / state / status kept apart | `E1_SEPARATION_CONTRACT.md` |
| what is frozen and what is craft | `E1_FREEZE_BOUNDARY.md`, `E1_IMPLEMENTATION_BOUNDARIES.md` |
| the numbers | `E1_VALIDATION_RESULTS.md` |
| what is still open, and what may be wrong | `E1_KNOWN_LIMITATIONS.md` |
| what to look at, in what order | `E1_REVIEW_BOARD.md` |
