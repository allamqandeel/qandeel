# I-08B3.1-F1R — ACCESSIBILITY TRUTH + PROOF ARCHITECTURE REPAIR

**REVIEW CANDIDATE. NOT FROZEN. F REMAINS OPEN until I-08B3.1-F2 completes.**

This document is the record of a **targeted revision**, not a redesign. The independent review of
I-08B3.1-F1 found that several of its proofs proved less than they claimed, and that in two places
the package had given itself authority it does not have. Every finding was correct. This is what
each one was, what was done about it, and what it cost.

**No accepted default visual experience changed.** The Living Analysis World's default raster is
**byte-identical** to the pre-revision one — sha256 `0a8cb8e0c2ecaf2d…`, the same hash F1 shipped.
The default document's *bytes* did change, because instrumentation was added to it; §7 below is
the accounting.

---

## The six repairs

### REV-01 — Analytical parity must prove each actual object

**The defect.** The matrix could pass while an object had vanished from the picture.

- a **PATTERN** or a **CONNECTION** counted as rendered if `#analysis` contained *any* `<path>`.
  Eight topics' contours are paths; so is the other object's link. A pattern could disappear
  entirely and the cell stayed green.
- an **INSIGHT** counted as rendered if it appeared in the `#qd-truth` JSON — a block serialised
  straight from the generator. The cell asked whether the generator had produced the object,
  which nobody doubted.

**The repair, in three parts.**

1. **Object-specific render identity.** Every analytical object carries
   `data-qandeel-object-id` and `data-qandeel-kind`, written on the actual drawn or represented
   object. Objects drawn as several primitives — a PATTERN is a locus, four links and four marks —
   are **grouped under one identity**, because a census that counted primitives would call a
   pattern that had lost three of its four members present.
2. **Rendered presence is a laid-out box.** An object is present when an element carrying *its
   own* id exists **and** has a box of non-zero extent. The truth JSON is still read — the matrix
   needs the object's facts from somewhere — and is **never** evidence that it was drawn.
3. **Four planted removals.** Each deletes exactly one object's rendered elements from the page
   and requires the matrix to fail **for that object and for no other**. A probe that made
   everything fail would prove only that the matrix is breakable.

**Result.** 12 expressions × 11 objects = **132 cells, 0 failures** — a **bounded** proof of the
semantic dimensions the fixture supplies, as `F1R2_REVISION.md` §1 goes on to make explicit — and:

| planted removal | elements removed | still in truth JSON | reported ABSENT | others untouched |
|---|---|---|---|---|
| TOPIC `task-delay` | 2 | yes | **yes** | yes |
| CONNECTION `connection:task-delay~comparison` | 1 | yes | **yes** | yes |
| PATTERN `pattern:four-topics` | 2 | yes | **yes** | yes |
| INSIGHT `insight:mastery-precedes-sleep` | 2 | yes | **yes** | yes |

Because the object remains in the JSON in all four runs, these are simultaneously the proof that
**the truth JSON alone cannot satisfy rendered presence**. Checks **P-01**, **P-02**, **P-03**.

**And it found a real defect while being built.** A second axis — *drawn* versus *named* — was
added, because an INSIGHT whose content is a sentence is not expressed by a dot and a keel. Above
the label-escape scale the connection, pattern and insight had their map labels suppressed and
**nothing replaced them**: the inspection view listed only topics. That is
`ACCESSIBLE EXPRESSION = REDUCED ANALYSIS`, and the old matrix reported PASS. **The inspection
view now carries every kind**, each under its own render identity. Check **P-04**, **X-04**.

**And one thing the new axis reported is not a defect.** The **CONNECTION is drawn and never named
in the default visual expression**. That is I-08B3.1-D2R's frozen grammar — a relation is a stroke
between two named topics — and F1R may not add a label to the Living Analysis World, because that
would change accepted default pixels. So the requirement is stated as a **regression** rule, which
is what the law actually says: no accessibility expression may name fewer objects than the default
names, every object must be named in the screen-reader projection, and every object must be named
in the inspection view. The connection's wordless default is recorded in
`F1_KNOWN_LIMITATIONS.md`.

---

### REV-02 — Accessible semantics must derive from V

**The defect.** `f1-scene.mjs` **authored** semantic truth. It wrote `epistemic: 'observed'` onto
every topic, `epistemic: 'hypothesis'` onto the insight, and `temporal: 'current'` and
`actionable: true` onto everything. None of those values is established by the inherited D2R
scene. The parity matrix then proved — correctly and uselessly — that the renderer's own invention
survived every accessibility expression.

**The repair.** The two halves are separated:

- **A. THE CANONICAL ACCESSIBILITY CONTRACT** is now a token:
  `qandeel.accessibility.projection.derivation = project-V`, class **product-contract**. It says
  `ACCESSIBLE SEMANTICS = PROJECT(V)` and never `= INFER FROM VISUAL GEOMETRY / F1 RENDERER`.
- **B. THE SYNTHETIC ACCESSIBILITY TEST FIXTURE** is `tools/f1-fixture.mjs`. It supplies
  epistemic status, temporal state, actionability and relationship description as explicit
  **input**, every object stamped `SYNTHETIC TEST FIXTURE — NOT PRODUCT DATA`. That provenance
  travels into the rendered document (`data-qd-provenance`), into `#qd-truth` and into the
  projection JSON, so no reader of any surface can mistake a test input for a Product decision.

`project(V)` copies from a fixed field list and **has no `??`, no default and no ternary
fallback**. Where V supplies nothing, the projection carries nothing.

**The fixture deliberately does not say the same thing twice**, because a projection that
hardcoded `observed / current / true` would pass a preservation test in which everything was
`observed / current / true`:

| object | epistemic | temporal | actionable |
|---|---|---|---|
| most topics | observed | current | true |
| `fear-shortfall` | observed | **historical** | true |
| `energy-decline` | observed | current | **false** |
| `comparison` | **not asserted** | current | true |
| insight | **hypothesis** | current | true |

The `comparison` row is the sharpest one: the projection must **omit** the field rather than
announce a plausible default, and it announces «غير مُحدَّد» — *unspecified* — because saying
nothing and saying "observed" are different facts and only one is true.

Checks **A-01** (a source scan: no renderer file writes a semantic literal, with the one
view-constructing probe line marked `V-INPUT` and **listed** rather than excluded silently),
**A-02** (every supplied value preserved, every omitted one omitted, and a probe that changes the
insight's status and requires the projection to follow it), **A-03** (provenance stamped),
**A-04** (the contract is in the token tree).

**These fixture values are not QANDEEL Product semantics and F1R proposes none.**

---

### REV-03 — Traversal order must not invent semantic order

**The defect.** The projection described its within-axis order as *"the Product's own stable
identity order"*. No supplied Product contract establishes the authored array order as a semantic
identity order. The sentence gave a technical accident Product authority — a smaller version of
exactly the failure the by-kind axis exists to avoid.

**The rule now**, implemented by `neutralOrder()`:

1. **Group by kind.** A legitimate Product distinction; the accessibility model needs it to offer
   an axis at all.
2. **Within an equal, unranked group**: if V supplies a canonical order for that kind, use it.
   `V.canonicalOrder` is the **implementation seam** and is deliberately `null` today.
3. **Otherwise**: ascending **Unicode code-point order of the stable id**, declared
   **NON-SEMANTIC** in those words. `localeCompare` was rejected deliberately — a locale collation
   is a reading convention that differs between platforms and ICU versions, so it would make the
   order of an Arabic id set depend on which device the reader is holding.

Peers are declared `EQUAL, UNRANKED`. The order is never importance, confidence, merit, truth,
priority, recency, position or size.

**R-02 now verifies the algorithm, not the sentence.** It recomputes the emitted order from the
ids and compares; it rejects the withdrawn wording by name; and it scans every projection row for
the whole vocabulary of ranking — `rank`, `score`, `weight`, `confidence`, `priority`,
`importance`, `strength`, `relevance`, `position`, `index` — because the thing forbidden is a
value, not a spelling.

**R-03 is the planted test.** The source array is reversed and re-sorted. The traversal order and
every semantic fact are unchanged — and the probe underneath it runs the same comparison against an
order sorted by a fabricated per-object strength, which must be rejected, so the first half cannot
pass for the wrong reason.

---

### REV-04 — The spectacle gate now says what it actually proves

**The defect.** F1's "ablation" was described as proving the default expression unchanged. It
proves something narrower: that the default does not *notice* the accessibility override files. A
change hardcoded into F1's own base scene survives both sides of that comparison, because both
sides run the same scene builder.

**The rename.** The existing proof is now **DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION**, and the
shipped record carries a `doesNotProve` field naming the claim it does not support. Check **D-04**
asserts that the disclaimer is present — a proof that quietly drops an overclaim is one a later
reader can re-acquire.

**The missing claim, proved separately** in `tools/f1-inherit.mjs`, against the **inherited
package** rather than against F1's other self:

| | what | result |
|---|---|---|
| **I-01** | every written attribute of the inherited ATMOSPHERE layer — geometry, ink, alpha, width, dash — read out of F1's rendered default document and compared against the same channel produced by calling **D2R's own exported functions**: `contourPath`, `ringInk`, `RINGS`, `WORLDS`, `TOPICS`, `ATMOSPHERE` | **25 elements × 7 fields, no differences** |
| **I-02** | a **reference page built from those exports alone** — nothing from `f1-scene.mjs` or `f1-resolve.mjs` reaches it — rasterised at 390×844 dpr 2, against F1's default document with everything that is not the inherited layer removed from the DOM | **pixel-identical**, `0c52861c66b6427c…` |
| **I-03** | the settled analysis layer's **geometry** against D2R's own `PATTERN_LOCUS`, `PATTERN_MEMBERS`, `INSIGHT_SITE`, `INSIGHT_KEEL`, `topicById` | **12 elements, no differences** |

I-02's probe displaces one contour by one pixel and must be rejected, so the comparison is known
to be able to tell two pictures apart.

**What remains unverified, enumerated in the shipped record and asserted by check I-04:**

- **the chrome, the navigation and the panel** — F1 composes a header, a navigation bar and a
  proof panel that have **no counterpart in the vendored D2R material**. There is nothing
  inherited to compare their pixels against, and this package does not claim there is.
- **the motion** — F1 renders only the settled state. No frame of any sequence is compared.
- **QANDEEL LIGHT** — not painted in the settled scene, so inherited by reference, not comparison.
- **D2R's own page** — its HTML scaffold is not vendored here, so `makeRenderer` cannot be driven.
  The reference is built from D2R's data and geometry functions instead, and this package says so
  rather than claiming the renderer was used.

**No byte identity is fabricated anywhere.**

---

### REV-05 — North Star capacity is not proven

The North Star is preserved as the **SPECTACLE / RICHNESS NORTH STAR** at full strength, neither
weakened nor met.

**Two sentences are withdrawn.** F1 wrote that density is *"the cheapest available route toward
the North Star's level of richness"* because no token constrains it. That converts *nothing
forbids this* into *therefore this is authorised*, which no package here has the standing to do.

> **ABSENCE OF A PROHIBITION IS NOT PRODUCT AUTHORITY.**

What may be said is narrower and true: **F1 imposes no ceiling on density**, so whatever the
Product later decides, no accessibility expression in this package has to change.

**The obligation is recorded as data, not prose** — `verdict.northStarStatus` in
`data/F1_SPECTACLE.json`, state `OPEN — NOT PROVEN BY F1, NOT WEAKENED BY F1`, owner
**G — INTEGRATED PRODUCT PROOF**, with the seven things G must prove listed. Checks **G-01**,
**G-02** (which allows the retracted sentence to be *quoted* within two lines of its retraction,
because a retraction that cannot name what it retracts is not much of one), **G-03**.

**F1R does not reopen D.** Only if G cannot reach the required spectacle within the frozen
I-08B3.1-D contract does a targeted D reconciliation arise, and F1R neither proposes one nor
treats the measurements as grounds for one.

---

### REV-06 — Product contract vs implementation strategy

**The defect.** Implementation technique was frozen at the same height as Product meaning.

**The repair.** A third freeze class. Every token F1 authors now declares one of:

| class | meaning | count |
|---|---|---|
| `product-contract` | what the product MEANS under a setting | 37 |
| `production-default` | tunable craft — a number measured on one viewport with one font | 14 |
| `implementation-strategy` | the current technique for meeting a requirement with today's libraries | 2 |

**53 token values in total**, up from 49. All four additions are semantic requirements that had
been living *inside* an implementation value's description with nothing naming them —
`motion.semantic-events-must-survive`, `projection.derivation`, `text.leading-floor`,
`text.selected-step-must-survive-bold` — and none of them is a new colour. **F1R still adds no
colour to QANDEEL.** The package's one literal remains `#080808`, the computed opaque equivalent
of the 0.5 black scrim over the World.

Every `implementation-strategy` and `production-default` token **names the product-contract
requirement it serves**, and check **K-02** rejects one that names a token that does not exist or
is not itself a contract.

**The two the review named by hand:**

- `motion.system-default-is-wrong-here` → **implementation-strategy**, serving the new
  `motion.semantic-events-must-survive`. The contract is *"Reduced Motion must preserve required
  semantic events and final meaning"*, not *"Reanimated must use `ReduceMotion.Never` forever"*.
  **The finding is unchanged and still binding today**: `ReduceMotion.System` omits exiting
  animations entirely, which deletes the settle that carries the result.
- `projection.canvas` → **implementation-strategy**, serving `projection.derivation`. The contract
  is that every disclosed analytical object has an accessible representation derived from V;
  text-views-over-canvas is how that is achieved with **this renderer**. The Skia finding stands.

**The numeric calibration constants**, reclassified to production-default with their irreversible
requirement split out:

| was | is | and the contract underneath it |
|---|---|---|
| `text.leading-ratio` **1.7** frozen as contract | production-default | new `text.leading-floor` **1.6** — a **measured property of the script**: Arabic ascenders, descenders and diacritics clip below it, and clipping a diacritic changes the word |
| `text.bold-weight-delta` **100** frozen as contract | production-default | new `text.selected-step-must-survive-bold` — the delta applies to **every** rung, so Bold Text cannot erase SELECTED |
| `text.max-scale` **3.118** | production-default | the contract is *whatever the platform's maximum is*; 3.118 instantiates it for iOS today, and Android's nonlinear scaling gives another number |

**Nothing was weakened; only the authority level was corrected.** X-02 now measures the rendered
line-height against the **floor token** rather than a literal typed into the census script, and
X-03 measures the rendered weight step rather than trusting the delta.

---

### REV-08 — Canonical inheritance cleanup

**I-08B3.1-D — QANDEEL LIGHT SYSTEM is CLOSED / FROZEN.
I-08B3.1-E — INTERACTION + SYSTEM SEMANTIC COLORS is CLOSED / FROZEN.** Neither is reopened.

F1's README described them as freeze candidates; F1R corrects that wherever this package speaks in
its own voice.

**The vendored copies still say "FREEZE CANDIDATE" and are deliberately left alone.**
`vendor/d2r/**` and `vendor/e1/**` are byte-for-byte copies verified by check **V-01** against
their sources. Editing one to update a status would break a provenance chain in order to improve
prose. Check **W-01** asserts **both halves**: F1R's own surfaces say CLOSED / FROZEN, the
vendored bytes are untouched and still carry their authoring-time language, and the discrepancy is
**disclosed in the place a reader would notice it** rather than left to be discovered.

---

## REV-07 — What was preserved

Untouched, and re-verified after every change above:

Reduced Motion channel-preservation model · semantic motion never silently deleted · Increased
Contrast hierarchy protection (ratio 1.2914 → **1.524**, widening) · Reduce Transparency's exact
alternate expression (90 strokes + 18 fills) · combined-setting composition with no third value
set · the no-colour-dependence diagnostic (hue carries **1.0185:1**, i.e. nothing) · Larger Arabic
Text inspection fallback · **Living Brass `#a58e6f`** · **QANDEEL Light** · **Error `#fe907e`** ·
the accessibility modifiers · **the default dark visual expression**.

---

## 7. The visual-change accounting

**THE LIVING ANALYSIS WORLD'S PIXELS DID NOT CHANGE.**

| | pre-F1R | post-F1R | |
|---|---|---|---|
| default raster sha256 | `0a8cb8e0c2ecaf2d…` | `0a8cb8e0c2ecaf2d…` | **identical** |
| default document sha256 | `511a782e9d56abcf…` | *changed* | **instrumentation added** |

The document's bytes changed and the package says so rather than claiming otherwise. What was
added:

- `data-qandeel-object-id` / `data-qandeel-kind` attributes and the `<g>` groups that carry them.
  **An SVG `<g>` with no presentation attribute paints exactly what its children paint** — which
  is not an argument, it is what I-02's pixel comparison measures.
- `data-qd-provenance` on the root element, and `provenance` inside `#qd-truth`.
- in the **larger-text expressions only**, the inspection view's connection, pattern and insight
  rows. These do not exist at the default text size, so the default composition is untouched.

Expected visible changes are confined to the screen-reader board, the parity board and the
captions that tell the corrected truth.

---

## 8. Validation

At I-08B3.1-F1R this **was 52/52 checks and 52/52 probes rejecting**; I-08B3.1-F1R2 took it to
59/59. Every new guard carries a planted probe:

| repair | checks | the probe that must reject |
|---|---|---|
| REV-01 | P-01 … P-04, X-04 | four planted removals; a census with only topics present |
| REV-02 | A-01 … A-04 | the same source scan over the fixture, which *does* author; a view with the insight's status changed |
| REV-03 | R-02, R-03 | the withdrawn wording; an order sorted by a fabricated strength |
| REV-04 | D-02, D-04, I-01 … I-04 | one stroke alpha changed; one contour displaced by a pixel; an empty unverified list |
| REV-05 | G-01 … G-03 | a status of PROVEN; the retracted sentence standing alone |
| REV-06 | K-01 … K-04, X-02, X-03 | a class not in the set; a `serves` naming a token that does not exist |
| REV-08 | W-01 | the withdrawn README line |

---

**RECOMMENDED READY FOR FINAL INDEPENDENT REVIEW. NOT FROZEN. F REMAINS OPEN.**
