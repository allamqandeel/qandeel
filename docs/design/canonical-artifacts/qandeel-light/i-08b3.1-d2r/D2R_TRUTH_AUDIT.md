# I-08B3.1-D2R — TRUTH AUDIT

Every way this system could lie, and what stops it.

The brief's §24 lists fifteen failure conditions. This document walks each of them, and then
publishes the ingredients that were considered and rejected — because a design that only reports
what it kept is reporting half of itself.

---

## 1. The fifteen failure conditions

| # | Failure | Status | Evidence |
|---|---|---|---|
| 1 | Ambient becomes random decorative glow | **Avoided** | There is no glow in the ambient field at all — no warm element, no gradient, no source. It is contour lines at chroma ≤ 0.0197. **R6** |
| 2 | Ambient falsely signals analytical importance | **Avoided — and this is where I-08B3.1-D2 failed** | Every ring on a layer carries the same chroma and lightness. Every visual property now declares `encodes: null` in a structure the build refuses to proceed without — gate 6, **S1**. D2's five invented encodings are listed and removed in `D2R_CORRECTION.md` REV-01 |
| 3 | All topic rings continuously pulse | **Avoided** | Nothing pulses. **R1** — 162 resting frames, byte-identical |
| 4 | Pattern is just another Guided Thread | **Avoided, measured** | **C4**: CONNECTION's light centroid travels 596 px along a route; PATTERN's travels 40 px and its spread collapses 125 → 83 px. One is a direction, the other a convergence. And **C5**: nothing about the pattern is derived from screen geometry — the failure I-08B3.1-D2 shipped |
| 5 | Insight is a generic AI sparkle | **Avoided, measured** | **C6**: 50 frames carry light, **0** of them move it outward. A sparkle is outward by definition. And the first build's inward gather closed to a point and produced a disc — corrected to a ring |
| 6 | Connection is silently redesigned | **Avoided** | **C1**: 4,830 channel comparisons against D1's own function, largest difference **0**. One channel of the *reduced-motion* counterpart is corrected, declared loudly in §3 below |
| 7 | Living Brass is used as analytical encoding | **Avoided** | **C9** and **G3**: the literal appears twice in the page's paint, both chrome. `analysis.node` and `analysis.relation` resolve to the neutral ramp |
| 8 | Meaning Light becomes loading feedback | **Avoided by omission, deliberately** | Activity is given no expression in this system and no token namespace. `D2R_AMBIENT_MEANING_ACTIVITY.md` §1 |
| 9 | Reduced Motion deletes semantic meaning | **Avoided** | **C8**: every counterpart reaches the SAME settled residue, with 0 frames in which a light moves. Four real counterparts, captured and encoded |
| 10 | Four categories feel like four unrelated effect packs | **Answered structurally** | One falloff law, one lifecycle, one easing vocabulary, one kind of residue — all functions, not paragraphs. `D2R_DESIGN_RATIONALE.md` §1 |
| 11 | The result is visually timid or generic | **Answered, and measured where it can be** | The level set is the signature. The nearest machine-generated cluster is named and the accent bounded rather than trusted: **R6** |
| 12 | Visual richness comes from meaningless neon | **Avoided** | Maximum chroma anywhere in the resting field: **0.0196**. Living Brass is 0.0516 and is the most chromatic thing on any screen |
| 13 | Implementation requires unbounded expensive effects | **Addressed** | One Skia canvas, static geometry, transforms only. `D2R_IMPLEMENTATION_FEASIBILITY.md` |
| 14 | Skill Gate is performative | **Addressed** | 16 skills with concrete consequences; 2 unavailable and verified so against their own frontmatter; the generator refuses to emit if a claimed file is missing |
| 15 | Evidence is only textual | **Addressed** | 9 verified films, 13 keyframes, 4 contact sheets, 3 composited proof boards, one 33-second coherence film |

---

## 2. The claims each category makes, and whether they are true

A visual claim is a claim. These are the ones this system makes about the product's state.

### AMBIENT claims: *this is your world, and these are its topics.*

- **True by construction**: positions are the canonical geography, inherited; five of the eight
  are I-08B3.1-D1's own `GEO.quiet` coordinates, unchanged to the pixel.
- **Everything else in the field claims NOTHING**, declared property by property in a structure
  the build reads — `PRESENTATION_CONTRACT`, gate 6, guard **S1**. I-08B3.1-D2 claimed five
  encodings here that nothing authorised; `D2R_CORRECTION.md` REV-01 lists them and they are
  gone, including the number behind the "shared fraction".
- **The world treatment claims exactly one thing**: which world is open. It is applied
  identically to every topic — guards **S2** and **S5**.
- **Every topic is named in every world** — guard **S4**. Dimness is never a claim about what the
  user is allowed to know.
- **What it does NOT claim**: that anything is happening. Nothing in the field indicates
  activity, confidence, or that QANDEEL is thinking.

### CONNECTION claims: *this meaning relates to that prior understanding.*

Inherited, and audited in I-08B3.1-D1. D2 adds nothing to the claim and subtracts nothing.

### PATTERN claims: *these four topics are members of one pattern.*

This is the most dangerous claim in the package, because a drawn line is very persuasive — and
I-08B3.1-D2 got it wrong in a way that looked like rigour. It fitted a principal axis to the
member positions and drew each member's distance from that axis as though it were an honest
quantity. **Screen positions are a layout; a statistic computed from them says nothing about the
user's life.** `D2R_CORRECTION.md` REV-02.

What D2R claims, and only this:

- **Membership.** Four topics belong to one newly crystallized pattern. That is what the analysis
  provides.
- **Equal status.** Every link is identical in width, opacity, colour and dash, and they all
  arrive together. Guard **S3** reads those attributes off the live elements at 12 probe frames.
- **Nothing moves.** Members hold their canonical positions.
- **The locus is authored**, not computed from the members — so its placement is layout and
  cannot be read as a result.
- **What it does NOT claim**: order, sequence, correlation, strength, spacing, goodness of fit,
  causation, or that these four are the only members.

**The residual risk it cannot remove**: link length varies because positions vary. That is
declared rather than defended — length is a consequence of the map, not a quantity — and the
membership mark at each member exists so membership does not depend on reading the line.

### INSIGHT claims: *something new is now understood, here.*

- **The site was empty before the event** — **C6** measures 58.5 px of clearance from the
  nearest topic's outermost contour.
- **The light travels inward at every frame**, so nothing is emitted; until the last moment there
  is nothing to emit from.
- **It happens at a coordinate in the analytical plane**, not in a corner. There is no container,
  no card, no dismiss affordance, and the chrome is unchanged at every frame — **G4**.
- **What it does NOT claim**: certainty. The new node settles at the same ink as every other
  analytical node, with no emphasis of any kind.

---

## 3. The one contradiction this package discovered

**I-08B3.1-D1's reduced-motion counterpart animates a blur. Apple's Reduce Motion guidance says
not to.**

D1's skill gate states the craft reason plainly and it is a good one: in the reduced version the
destination really is crossfading between two fixed renderings, which is the situation a bridging
blur exists for.

Apple's accessibility page, in a list written for exactly this setting, asks for **"Avoiding
animating into and out of blurs."**

Both are right about their own concern. A blur is the correct bridge for a crossing, **and** an
animated blur is a focal change, and focal changes are part of why motion makes some people
unwell. When a craft technique and an accessibility setting disagree, the setting is not a
suggestion.

**What D2 did.** Corrected one channel — `receptionBlur` — in the reduced-motion counterpart
only. §14 of this brief puts reduced motion inside D2's remit. Check **C2** measures the
correction: exactly one channel differs from D1's counterpart, its peak falls from 0.7988 to
**0.0000**, and the full-motion Connection is untouched and proved so by **C1**.

It is reported here rather than folded in quietly, because the Product Owner selected the
full-motion expression and is entitled to know that its accessibility twin was changed and why.

---

## 4. Instruments that were wrong before they were right

Four, and every one was found by running it and reading the number.

**The Light line no longer bounded what it was named after.** Inherited from D1 as the midpoint
between the reading ramp's chroma and the Light's, it reported 800 pixels of Light surviving the
settle. Every one was a topic ring: D2 introduced a **third** chromatic family that sits between
ink and Light by design, so a line drawn at the ink/Light midpoint ran through the middle of it.

**A check that could not see the Light passed.** The corrected line then put the faint washes
*below* the threshold, and R8 — the check that bounds how bright a category may be — reported
"peak 0.0, frame −1" and **held**. It is now two coordinates rather than one: hue for the family,
chroma for the ink, with the sensitivity floor stated (alpha 0.310) and a blindness condition
that fails the check if it finds no Light at all.

**The navigation check asked a wider question than the one that mattered.** Pooling all nine
sequences and demanding one hash returned two. The entire difference is **2 pixels at 1/255** on
the centre icon, between the Connection composition and the others — D1's quiet-material layer
carries a filter there, gets promoted, and shifts an unrelated element one bit. The claim that
matters is per-sequence, where it is exact: nine sequences, **one** navigation region each.

**A font scanner found the sentence that forbids fonts.** For the fifth time in this project, a
scanner for a forbidden thing matched the prose describing the rule — here, `d2-font.mjs`, the
tool whose whole job is to prevent font payloads. The test is now on bytes: a run of base64 that
**decodes** to a font signature. Nothing anyone writes about fonts decodes to `wOF2`.

---

## 5. A defect the instruments found in the renderer

The DOM digest — a SHA-256 of every attribute of every identified element, with no rasteriser in
it — reported all 210 frames of the determinism control differing while **0** rasters did.

`src-4` is the fifth light source. INSIGHT uses five and PATTERN uses four, so it is hidden
whenever PATTERN runs — and it kept INSIGHT's `transform-origin`. Nothing painted, because an
element at opacity 0 paints nothing.

This is the **same defect class I-08B3.1-D1 found and fixed**, returning as two different
properties. The lesson is not "remember these two as well": **hiding by listing properties is a
list that goes stale every time the renderer learns to write a new one**, and the only thing that
keeps it honest is an instrument that reads the whole document instead of the picture.

---

## 6. Rejected ingredients

In the format `find-animation-opportunities` requires, because a design that publishes only what
it kept is reporting half of itself.

| Considered | Rejected because |
|---|---|
| **Topic rings that breathe** | Frequency: off the top of `animate`'s table. And the natural period is 0.2 Hz, named twice as the frequency people are most sensitive to. And `withRepeat` infinite does not start under reduced motion, so the world would arrive dead for those users |
| **A slow drift or float on the far plane** | Same gate, and it would make depth read as instability rather than as time |
| **Members nudged into alignment for PATTERN** | Semantic falsehood. Position is the map's truth; a tidier line would be a wrong map |
| **A fitted axis through the members, with residuals drawn** | **SHIPPED IN I-08B3.1-D2 AND REMOVED HERE.** A statistic of the layout presented as a statement about the user. It looked like rigour, which is why it survived a review |
| **A staggered arrival of the membership links** | A stagger is an ORDER, and the Product has no order for a set. The house guidance against simultaneous entrance is inverted deliberately and recorded |
| **A luminous pattern locus** | Turns brightness into importance, which the D-track forbids. The locus arrives at exactly `qandeel.analysis.node` and is never brighter |
| **A haptic on "QANDEEL understood"** | `animate-expo` §8: one haptic per user action, never on something the user did not cause. All three events are QANDEEL acting |
| **An emphasis ring or badge on the new INSIGHT node** | The node settles at the same ink as every other analytical node. Emphasis would encode confidence, which QANDEEL does not have and may not imply |
| **A fourth easing curve for the gather** | The vocabulary is three curves, inherited. A fourth would confound "a different category" with "a different curve taste" |
| **Unique hues for all eight topics** | The palette would have to enter the warm band or exceed the Light's chroma. Shape is the fine identity channel; colour is the coarse one |

---

## 7. What remains open, and is handed forward

- **How often QANDEEL claims to have understood something.** A Product decision, not a motion
  one, and the single question that decides whether three meaning events per session is calm or
  exhausting. `animate`'s frequency gate cannot be answered from here.
- **Feel on a device.** No phone has seen any of this. `animate-expo`'s rule is that feel is
  judged on a release build on the slowest supported device and nothing else counts.
- **Whether PATTERN reads as membership rather than as a diagram.** Four equal links to a named
  hub is the honest drawing of a set; whether a person reads it that way, or looks for meaning in
  which link is longest, is a question a frame cannot answer. It is the first thing to watch for
  in Product review.
- **Whether a varying ring size still invites an inference it no longer makes.** The claim is
  gone; the invitation may not be. `D2R_AMBIENT_MEANING_ACTIVITY.md` §4 states it as an open
  Product question rather than pretending the correction closed it.
- **The Light's behaviour on an OLED at low brightness**, where a near-black World and a
  low-alpha warm light are exactly the pair that bands first.
