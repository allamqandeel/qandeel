# I-08B3.1-D2R — AMBIENT / MEANING / ACTIVITY

The boundary the whole system rests on, stated so it can be enforced rather than remembered.

---

## 1. The three things, and what each may do

| | **AMBIENT** | **MEANING LIGHT** | **ACTIVITY** |
|---|---|---|---|
| What it is | the world's persistent character | meaning genuinely emerging or crystallizing | retrieval, processing, waiting, searching, camera movement |
| When present | always, including while nothing is understood | only at the moment of an event | while the system is working |
| Duration | permanent | 900 ms, decaying to **exactly** zero | as long as the work takes |
| Owns | `qandeel.atmosphere` | `qandeel.illumination` | **NOTHING IN THIS SYSTEM** |
| Warm? | **never** — six hues, all outside the warm band | yes, and it is the only warm non-identity thing on the screen | not decided here |
| Chroma | ≤ 0.0197 | 0.032 – 0.046 | — |

**ACTIVITY IS NOT GIVEN AN EXPRESSION HERE, AND THAT IS THE POINT.** Reusing Meaning Light as
loading feedback is the single failure that would destroy the whole system: a light that appears
whenever QANDEEL is *busy* teaches the user that light means "working", and after that no
occurrence of it can mean "understood". The namespace for activity is not `qandeel.illumination`
and never will be. Whoever designs it should reach for motion, position or a neutral indicator —
and should be able to state, in one sentence, why what they are building is not this.

---

## 2. Why the ambient field does not move

This is the decision the rest of the ambient design follows from, and it was not made on taste.
**Four independent sources say the same thing, and three of them are mechanical.**

### The frequency gate puts it off the top of the table

`animate` opens with a table, and its highest tier — "100+ times/day" — reads **"No animation.
Ever. Stop here."** Ambient is not seen a hundred times a day. It is on the screen the entire
time the product is open. It is not near the top of that table; it is off the top of it.

### 0.2 Hz, named by two sources

Apple's Human Interface Guidelines: *avoid showing an oscillation that has a frequency of around
0.2 Hz, "because people can be very sensitive to this frequency"*. The `apple-design` skill
repeats it independently as *"slow looping oscillations (near 0.2 Hz / one cycle per 5s)"*.

A ring that breathes is an oscillation, and the period a designer reaches for when they want
calm is four to six seconds. **The instinctive value is the named frequency.**

### Reduced motion would delete it

Reanimated's own behaviour table: `withRepeat`, infinite, under reduced motion — **"Do not
start."** A world whose richness came from breathing rings would arrive **dead** for every user
with the setting on. Richness that a preference can switch off was never richness; it was an
animation standing in for one.

### The craft has no word for it that is not forbidden

Every term the animation glossary has for making a static thing feel alive — **Pulse, Float,
Orbit, Idle animation, Loop, Alternate, Marquee, Shimmer** — is in one section, "Looping &
Ambient Motion", and the brief forbids every one of them by name or by effect. There was no
vocabulary left for "make the rings feel alive", which is usually what a missing word means.

### So the richness had to come from somewhere still

It comes from **form**. Each topic is drawn as a set of contour lines whose radius is modulated
by three harmonics with phases derived from an **authored presentation seed** belonging to the
scene, summing to at most 6 % of the radius. The number of contours falls with depth, the way a
distant hill shows fewer on a real map.

The seed is a composition choice and is deliberately **not** the topic's analytical id. The
shape is reproducible inside this proof and promises nothing outside it — not across releases,
not across devices, not across users — and a later release may reseed the whole field and lose
nothing. **Contour morphology identifies no topic.** See §4.

The result is measured, not claimed: **check R1** finds **162 resting frames across three worlds
that are byte-identical** — 66, 48 and 48 — while the same frames are, by inspection, a dense
and specific world.

---

## 3. The one motion ambient has, and why it is not on that table

The user's hand.

The map tracks the finger **1:1**, with no duration and no easing. On release it continues at the
finger's exact velocity to the position the gesture was *going* to, using Apple's own projection
function from *Designing Fluid Interfaces*:

```
project(v) = (v / 1000) · d / (1 − d),   d = 0.998
```

This is not an animation of the map. It is the second half of **one gesture**, and the seam
between drag and glide is where an interface stops feeling direct. The frequency table governs
motion the **system** starts; nothing on it applies to a value the user is holding.

Depth planes track the gesture at different rates — 1.0, 0.72, 0.48 — and that parallax is the
one place where the field's **apparent depth** becomes legible. What it makes legible is the
layering itself and nothing else: **the planes encode nothing**. Moving the map with your hand is
how a still field reveals that it has volume — which is a spatial fact about the drawing, not a
claim about time, recency or anything else in the user's world. See §4.

Under reduced motion the **differential** is removed, not the parallax: every plane uses the
near rate, so there is no relative motion and the vestibular component is gone, while depth —
carried by scale, luminance and contour count — is untouched. The momentum glide is removed too,
which is `withDecay`'s documented reduced-motion behaviour taken literally: the map stops where
the finger let go.

---

## 4. What the ambient field encodes: NOTHING, and that is declared in a file

**GEOMETRY DOES NOT MANUFACTURE MEANING.** Distance, direction, adjacency, orientation, size,
footprint and contour morphology carry zero analytical meaning unless a canonical Product
contract grants it — and for this field, none does.

I-08B3.1-D2 got this wrong and the correction is `D2R_CORRECTION.md` REV-01. It claimed radius
was quantity, depth was recency, a Shared gap was a sharing fraction, Public dimness was how much
was known, and contour shape was a permanent identity. **None of it was authorised, and none of
it was needed** — the visuals are exactly as rich without a data story attached.

So the declaration now lives in a **data structure the build reads and refuses to proceed
without** — `PRESENTATION_CONTRACT` in `source/scene/d2-world.mjs`, enforced by build gate 6 and
probed by guard **S1**:

| Property | Encodes | Is |
|---|---|---|
| **position** | the canonical semantic geography of the Living Analysis Map | inherited; not reassignable by this package |
| **ring.radius** | **nothing** | composition — rhythm, not a uniform grid |
| **ring.layer** | **nothing** | apparent depth, and something for the pan to reveal |
| **ring.contourCount** | **nothing** | a depth cue |
| **ring.contourShape** | **nothing** | authored irregularity from a PRESENTATION SEED — not the topic's id, and no stability is promised across releases, devices or users |
| **ring.hue** | **nothing** | one of six authored hues, assigned for composition |
| **field.parallax** | **nothing** | depth response to the user's own hand |
| **world.treatment** | **WHICH WORLD IS OPEN** — and nothing about any topic in it | a uniform atmosphere keyed to one genuinely disclosed fact, applied identically to every topic |

**THE RING-SIZE QUESTION IS CLOSED, AND THIS IS THE RULE.** A property that varies and means
nothing can still invite a reader to infer something — a bigger ring *looks* like more of
something. That observation does not reopen anything, because the answer to it is a rule rather
than a redesign:

> **Adaptive presentation size and footprint MAY vary for visual composition and legibility, and
> carry ZERO analytical authority. They MUST NOT encode importance, confidence, strength,
> quantity, centrality or relevance.**

Two consequences follow, and they point in opposite directions on purpose. The rings are **not**
redesigned merely because they vary — variation is what makes the field a composition instead of
a grid. And the variation is **not** granted an encoding to make it feel earned; inventing one is
exactly the failure REV-01 corrected. The exact radii and their calibration are **production
defaults / tunable craft**, free to move on a real device without reopening any Product decision.

**Two guarantees hold the rest together.**

The first is that **every ring on a layer carries the same chroma and the same lightness**, so
two rings differ in hue and in nothing else. Nothing about the palette is ordinal, because there
is no quantity in it to order. No ring can be brighter, more saturated or more insistent than
another.

The second is arithmetic, and it is the sentence that keeps atmosphere from ever being mistaken
for meaning:

> **ATMOSPHERE IS NEVER THE MOST COLOURFUL THING ON SCREEN.**

Every ambient colour is bounded below **both** the identity material's chroma (0.0516) and the
Light's least chromatic stop (0.0317). The ceiling is **derived**, at 0.62 of the latter, so it
survives the Light being re-chosen. Check **R6** measures the whole resting field: maximum chroma
**0.0196**, and **0** pixels in the warm band above the ink floor.

The mistake is therefore unavailable rather than forbidden.

---

## 5. Colour is never alone, and the other channel is the NAME

Apple's accessibility guidance is explicit: *"Convey information with more than color alone."*

Nothing in this field is carried by colour, so there is nothing for colour to carry alone. Hue is
composition; it identifies no topic and distinguishes none. **What identifies a topic is its
LABEL**, and every topic is named in every world — guard **S4**.

I-08B3.1-D2 answered this differently and wrongly, and the difference is worth keeping visible.
It said shape was the fine identity channel: a topic "recognisable before its label is read".
That would have been an identity guarantee the Product never granted, and it would have become a
compatibility constraint the moment anyone relied on it. **The correct answer was simpler and was
there all along: the topic's name is written on it.**

Two topics do still differ in contour, and that remains useful — but as composition, not as a
promise. Nobody should build anything on it.
