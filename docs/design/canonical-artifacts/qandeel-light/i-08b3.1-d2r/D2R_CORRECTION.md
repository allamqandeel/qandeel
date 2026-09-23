# I-08B3.1-D2R — THE CORRECTION

What independent review found, what changed, and what did not.

**Read this first.** Everything else in this package is I-08B3.1-D2 with these three corrections
applied. The work review accepted was preserved and is not re-argued.

---

## REV-01 — INVENTED GEOMETRY SEMANTICS · HARD BLOCKER · RESOLVED

### What was wrong

I-08B3.1-D2 attached Product meaning to presentation geometry that had no authority to carry it:

| D2 claimed | Status |
|---|---|
| ring radius = *how much material the topic holds* | **REMOVED** |
| depth plane = *how recently the topic was active* | **REMOVED** |
| contour count = *temporal distance* | **REMOVED** |
| Shared-world gaps = *the fraction of the topic that exists in that world* | **REMOVED, and the number deleted** |
| Public dimness, fewer contours, no labels = *less of the world is resolved to you* | **REMOVED** |
| contour shape = *a permanent analytical identity, stable on every device and user, forever* | **REMOVED** |

None was authorised by any frozen contract. The Living Analysis Map's rule is that **geometry
does not manufacture meaning**: distance, direction, adjacency, orientation, size, footprint and
contour morphology carry zero analytical meaning unless a canonical Product contract grants it.

**The seductive part is that each claim was individually plausible and none was needed.** The
visuals were never the problem — a field of irregular contours at varying sizes and depths is
exactly as rich without a data story attached. D2 invented a rationale to justify a composition
it had already made, which is how a presentation decision becomes a claim about someone's life.
The "shared fraction" is the clearest case: a number was written into the scene file, used to
compute a dash, and described as disclosed product state. It was none of those things.

### What D2R does instead

**Every ambient visual property is now declared in a data structure the build reads and refuses
to proceed without** — `PRESENTATION_CONTRACT` in `source/scene/d2-world.mjs`. Six of the seven
declare `encodes: null`. The seventh is the world treatment, and it names its source.

```
ring.radius         encodes: null   composition — rhythm, not a uniform grid
ring.layer          encodes: null   apparent depth, and something for the pan to reveal
ring.contourCount   encodes: null   a depth cue
ring.contourShape   encodes: null   authored irregularity from a PRESENTATION SEED
ring.hue            encodes: null   one of six authored hues, assigned for composition
field.parallax      encodes: null   depth response to the user's own hand
world.treatment     encodes: WHICH WORLD IS OPEN — and nothing about any topic in it
```

**The three worlds still differ, and the difference is now uniform across the whole field.** A
world treatment is keyed to the one genuinely disclosed fact — which world the user opened — and
applied identically to every topic in it:

- **Personal** — closed contours.
- **Shared** — the same contours with **one dash pattern, identical on every ring**. It says
  "shared world", not "this much of this topic".
- **Public** — one contour per topic and a lower luminance, uniformly. **Labels are not removed.
  Every topic is named in every world**, because dimness must never be a claim about what the
  user is allowed to know.

**The contour seed is no longer the topic's analytical id.** It is an authored presentation seed
belonging to the scene. Same determinism inside this proof; no identity promised outside it. A
later release may reseed the whole field and lose nothing, because nothing was ever promised.

**And the seductive claim is gone with it.** D2 wrote that a topic is "recognisable before its
label is read". That was an identity channel the Product never granted, and it would have become
a compatibility constraint the moment anyone relied on it.

### What still holds

The field is still rich, still authored, still irregular, and still **completely still** —
`R1`: 162 resting frames across three worlds, byte-identical. Removing the false data story
removed no pixels.

---

## REV-02 — PATTERN INFERRED FROM SCREEN GEOMETRY · HARD BLOCKER · RESOLVED

### What was wrong

D2 computed the **principal axis** of the four member positions, drew a spine along it, and tied
each member to that spine at its **perpendicular distance** — presenting those residuals as the
system being candid about the quality of its fit.

**It was worse than a flourish, and the fact that it looked like rigour is why.** QANDEEL does
not know a Pattern because four renderer coordinates line up. It knows a Pattern because the
analysis identified a member set and a larger analytical structure. Screen positions are a
LAYOUT, so an axis fitted to them is a statistic about the drawing dressed as a statement about
the user's life — and "how well each member fits" was then drawn from that statistic as though it
were an honest quantity.

D2's own check C5 asserted that the spine did not extrapolate. That was TRUE, and it measured a
property of something that had no business existing. **A check can be rigorous about the wrong
object.** The self-congratulation made it harder to see: *"the pattern is incapable of looking
tidier than it is"* was true of the FIT and meaningless about the PATTERN.

### What D2R draws instead

Only what the Product actually knows: **these four topics are members of one newly crystallized
Pattern.** That is a set. A set has no axis, no order, no spacing and no goodness of fit.

- **A new neutral analytical object** — the pattern's own locus, labelled «نمط / من أربعة
  مواضيع» — resolves at an **authored** position. D2's centroid would have been a statistic of
  the member positions; this is a clear spot on the map, chosen because the drawing fits there.
- **One membership link per member**, joining each member to the locus, **identical in every
  written property** and all drawn **simultaneously**.
- **One identical membership mark** at each member, attached where the link meets the contour, so
  membership is legible AT the member and does not depend on reading a line whose length is an
  accident of layout.

**The simultaneity is a deliberate inversion of a craft default.** The house guidance calls
"everything entering at once" a defect, and it is right about lists of unrelated items. This is
one object with four arms, and a stagger would be an ORDER the Product does not have. Equality
outranks the default, and the inversion is recorded rather than quietly taken.

**Link length varies because positions vary.** That is unavoidable and it is declared: length is
a consequence of the map, not a quantity. What can be enforced is enforced — every link is
identical in width, opacity, colour and dash, measured off the live elements at every probe
frame by guard **S3**.

### Check C5 was replaced, not adjusted

It now asserts three things, none of which D2 could have passed:

- the exported geometry carries **no derived statistic** — `{links, locus, members}`, and the
  forbidden keys `fit`, `axis`, `residual`, `spine`, `ties`, `centroid` are absent from the
  actual object the renderer consumes;
- **every light source carries the same level at every frame** — a per-member amplitude would be
  a strength, and 52 frames carry light with zero disagreement between members;
- **every scalar channel is a function of time alone**, recomputed in the check from the phase
  boundaries independently of the scene module, largest divergence **0**. If a channel ever
  picked up a positional term it would diverge.

---

## REV-03 — FREEZE BOUNDARY · RESOLVED

D2 called several values *craft parameters to tune on a real device* in one document and *freeze
candidates* in another, because both statements were made about the same numbers from different
directions. The same value was provisional and irreversible at once.

**The distinction is not "is it in a token file".** A token exists so an implementation is
CONSISTENT; freezing exists so a PRODUCT DECISION is irreversible. Those are different jobs, and
a value can have the first without the second.

Every token now carries `com.qandeel.freeze`:

| | Count | Meaning |
|---|---:|---|
| **product-contract** | 13 | Changing it changes what the product MEANS. Freezeable. |
| **production-default** | 32 | A calibrated starting value. Changing it within its bound changes how the product FEELS, not what it says. **Not Product-frozen, and expected to move once a device has been seen.** |

`classify()` **throws on any token carrying neither**, so a token added later cannot inherit
"frozen" by sitting in a file someone once called a freeze candidate — which is exactly how the
contradiction arose.

**And the important half of the contract is not a token at all.** Fifteen Product-contract
STATEMENTS are carried in the token tree's own `$extensions` and in
`D2R_FREEZE_CANDIDATE.md` §2: the four categories, the four topologies, event-based Light
reaching exactly zero, the neutral residue, reduced-motion parity, no animated blur under the
setting, atmosphere never outranking Light, geometry not manufacturing meaning, and a Pattern
being a member set.

---

## F — THE LIGHT COLOUR: KEPT, THE CLAIM CORRECTED

The family `#fbf2db` / `#e8ddc2` / `#d6caa9` remains the candidate. The measured improvement and
the search evidence stand.

**What changed is the epistemic status of 0.020.** It is now stated everywhere as an
**engineering heuristic this package adopted**, not a perceptual law, and explicitly as something
that did not freeze a colour:

> 0.020 gave the search a floor that was not taste. Its justification is comparative — the family
> it replaces measures 0.0118 and I-08B3.1-D1 could not tell that family's dim tail from the
> identity material. The threshold at which two colours become tellable apart depends on their
> size, their surround, the display, the ambient light and the viewer, and none of those is in
> this arithmetic.
>
> **Acceptance remains: this measurement, PLUS visual Product review, PLUS device validation.**

No colour exploration was reopened.

---

## H — SKILL-GATE REPORTING ON A REVIEWING HOST

Preflight **P10** used to FAIL on any machine but the executing one, because the skills it
recorded live under that host's `~/.claude/skills` and shipping them here would mean
redistributing someone else's files.

It now returns a **third state**: `UNVERIFIABLE — EXTERNAL SKILL SOURCE NOT PRESENT`, counted
separately and never folded into either neighbour. On the original host the strict path + hash
check still runs and still has to pass. The inventory in `data/D2_GATE_INVENTORY.json` carries
every path, size and SHA-256 for independent checking wherever the sources do exist.

Reporting FAIL told a reviewer their extraction was broken when nothing was. Reporting PASS would
have claimed a verification that did not happen.

---

## I — THE SEMANTIC GUARDS

Five new guards, each reading a **data structure or a written attribute** — never its own rule
text, which is the trap this project has now hit five times. Twenty-two probes across the suite,
all of which detected their planted violation.

| | Guard | Probes |
|---|---|---|
| **S1** | no ambient property claims meaning without naming a canonical source; no undeclared key on a topic or crossing to the page | a contract entry claiming an encoding with no source; a topic carrying `shared: 0.62`; a `dash` crossing the wire |
| **S2** | a world treatment is one value applied identically to every topic | a per-topic `dashByTopic` map |
| **S3** | every membership link and mark is written identically — read off the live elements at 12 probe frames | one link written wider than its siblings |
| **S4** | every topic is named in every world | a suppressed label |
| **S5** | a dashed contour says WHICH WORLD, never how much of a topic is shared | three different dash patterns |

**Build gate 6** enforces the same contract before a page is written at all, so a regression
cannot reach a capture.

---

## What was NOT touched

- **D0, D1, and the inherited full-motion CONNECTION.** Check C1: 4,830 channel comparisons,
  largest difference **0**.
- **The D1 reduced-motion blur correction**, which review accepted.
- **INSIGHT**, except for the shared amplitude convention it shares with PATTERN.
- AMBIENT as a non-self-animating field; no perpetual pulse; controlled irregularity; calm
  settle; exact-zero Light; the Ambient / Meaning / Activity separation; Living Brass separation;
  reduced motion as an alternate expression; the React Native / Reanimated / Skia direction; the
  Skill Gate and Reference Gate, which were re-run unchanged.

**The CONNECTION films were re-rendered**, and that is not cosmetic: the world behind them
changed when the ambient field was corrected. The inherited state vector is identical and
re-proved; only the atmosphere it is drawn over is different.

---

## One thing this correction taught, recorded rather than smoothed over

**A false rationale survives review by being useful.** Every invented encoding in D2 made the
package *easier to explain* — it answered "why is that ring bigger?" with something satisfying.
Nothing in the build could see them, because the claims lived in prose, and prose is not an input
to anything.

That is why the fix is a data structure and a gate rather than a corrected paragraph. The
question "does this visual property mean anything?" now has to be answered in a file the build
reads, for every property, before a page can be written.
