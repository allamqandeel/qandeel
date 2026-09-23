# I-08B3.1-F1 — THE ANALYTICAL TRUTH PARITY MATRIX

## 1. The claim

> An accessibility expression may change **HOW** truth is expressed.
> It may not change **WHAT** truth exists.

## 2. The scene, and where its semantics come from

A representative analytical scene, built from I-08B3.1-D2R's own geography — not a lookalike:

| | |
|---|---|
| **8 topics** | D2R's `TOPICS`, five of which are I-08B3.1-D1's `GEO.quiet` coordinates unchanged to the pixel |
| **1 connection** | `تأجيل المهام` → `مقارنة بالآخرين` |
| **1 pattern** | a locus and **4 members**, as an unordered SET |
| **1 insight** | `الإتقان يسبق السهر بيومين` |
| labels, readings | every topic named, in every world |

**11 analytical objects.**

### The semantic fields are SUPPLIED, not authored — and this is the F1R correction

I-08B3.1-F1 wrote `epistemic`, `temporal` and `actionable` onto these objects **inside the scene
builder**. None of those values is established by the inherited D2R scene, so the matrix proved,
correctly and uselessly, that the renderer's own invention survived every expression.

They now arrive as explicit **input** from `tools/f1-fixture.mjs`, stamped:

> ### SYNTHETIC TEST FIXTURE — NOT PRODUCT DATA

**These values are not QANDEEL Product semantics and this package proposes none.** The claim being
tested is only that *if a view supplies a value, the accessible projection carries it through
unchanged.* The provenance travels into `data-qd-provenance` on the rendered root, into
`#qd-truth` and into the projection JSON, so no reader of any surface can mistake the one for the
other.

**The fixture deliberately does not say the same thing twice**, because a projection that
hardcoded `observed / current / true` would pass a preservation test in which everything was
`observed / current / true`:

| object | epistemic | temporal | actionable |
|---|---|---|---|
| most topics | observed | current | true |
| `fear-shortfall` | observed | **historical** | true |
| `energy-decline` | observed | current | **false** |
| `comparison` | **not asserted** | current | true |
| the insight | **hypothesis** | current | true |

`comparison` is the sharpest row: the projection must **omit** the field rather than announce a
plausible default, and `ABSENT` is normalised on both sides of every cell — so a projection that
invented `observed` for it would **fail** the matrix rather than slip through a hole that matches
anything. **And since I-08B3.1-F1R2 it must also announce nothing in its place** — see
`F1_SCREEN_READER_PROJECTION.md` §4.

### What this fixture is evidence of, and what it is not — the F1R2 correction

F1R described the fixture's three fields as *"the complete list of what a projection may carry"*.
**It is nothing of the sort.** It is a test allowlist: three dimensions a synthetic view happens to
supply so that preservation across an accessibility boundary can be proved at all. Describing it as
the complete model let a **bounded** proof read as exhaustive Product truth — the same class of
mistake as the fixture's values reading as Product semantics, one level up.

Two statements, kept apart:

> **A — THE PRODUCT CONTRACT.** Every user-exposable semantic fact legitimately disclosed in
> canonical V and required for understanding or operation must have an equivalent accessible
> expression. **No accessibility projection may silently drop such a fact.** That covers, where
> canonical V exposes them: evidence, provenance, uncertainty or qualification, epistemic status,
> temporal truth, relationships, actions, and any other user-exposable semantic field.

> **B — THE TEST FIXTURE'S COVERAGE.** This fixture supplies `epistemic`, `temporal` and
> `actionable`. The matrix below is therefore a **BOUNDED PROOF of those dimensions**, plus
> structure, relationships, naming and rendered presence. It is not evidence about a dimension the
> fixture does not supply.

The list in A is a list of **kinds of analytical fact**, deliberately **not** runtime field names.
Inventing canonical field names to make the fixture look exhaustive would be the same failure as
inventing semantic values.

The contract is a token — `qandeel.accessibility.projection.completeness` — and it records the
dependency it does not discharge:

> **PRODUCTION ACCESSIBILITY MAPPING MUST BE EXHAUSTIVE AGAINST THE ACTUAL USER-EXPOSABLE V
> SCHEMA**, and that mapping cannot be written until the canonical V schema is integrated.

**And `project(V)` no longer drops a field in silence.** A field the view supplies that the
projector has no mapping for is collected into `$unmappedFields` and travels with the result, into
`#qd-truth` and into the matrix. A bounded projector cannot carry a field it has no vocabulary for;
it can refuse to be quiet about it, and that is the difference between a known limit and an
undetected loss. Checks **B-01**, **B-02**, **B-03**.

## 3. How it is tested, and why that matters

Each expression is **rendered**, and the truth is read back out of the **rendered document** —
out of the `#qd-truth` block the page actually shipped, and out of the DOM elements that actually
exist in it.

> It is **not** imported from the generator. A matrix built by calling `truth()` eleven times and
> comparing the results would prove that a pure function is pure, which nobody doubted. This one
> can catch a transformation that **silently dropped an object on its way to the page**, which is
> the failure §3 is actually about.

The **SCREEN READER** column crosses a rendering boundary: it is a **different document**, with a
different DOM, read separately.

### 3.1 What I-08B3.1-F1R had to repair, because the matrix could falsely pass

Two cells were satisfied by evidence that was **not about the object being tested**:

- a **PATTERN** or a **CONNECTION** counted as rendered if `#analysis` contained *any* `<path>`.
  Eight topics' contours are paths, and so is the other object's link. A pattern could vanish
  entirely and the cell stayed green.
- an **INSIGHT** counted as rendered if it appeared in the `#qd-truth` JSON — a block serialised
  straight from the generator. That cell asked whether the generator had produced the object,
  which nobody doubted, and not whether the page had drawn it.

**The repair.** Every analytical object carries an **object-specific render identity** —
`data-qandeel-object-id` and `data-qandeel-kind` — written on the actual drawn or represented
object. An object drawn as several primitives (a PATTERN is a locus, four links and four marks) is
**grouped under one identity**, because a census that counted primitives would call a pattern that
had lost three of its four members present.

> **RENDERED PRESENCE** = an element carrying *this object's own* id exists **and** has a laid-out
> box of non-zero extent. The truth JSON is read for the object's **facts** and is **never**
> evidence that it was drawn.

### 3.2 The four planted removals

Each deletes exactly one object's rendered elements from the page — in the page, after render, so
that what is proved is *the census notices a disappearance whatever caused it* — and leaves the
truth JSON untouched.

| removed | elements | still in truth JSON | reported ABSENT | every other object untouched |
|---|---|---|---|---|
| TOPIC `task-delay` | 2 | yes | **yes** | yes |
| CONNECTION `connection:task-delay~comparison` | 1 | yes | **yes** | yes |
| PATTERN `pattern:four-topics` | 2 | yes | **yes** | yes |
| INSIGHT `insight:mastery-precedes-sleep` | 2 | yes | **yes** | yes |

The last column matters as much as the third: a probe that made *everything* fail would prove only
that the matrix is breakable, not that it is specific.

And because the object remains in the JSON in all four runs, these are simultaneously the proof
that **the truth JSON alone cannot satisfy rendered presence**. Checks **P-02**, **P-03**.

### 3.3 Drawn is not named

A second axis, added in F1R. An **INSIGHT** whose content is a sentence is not expressed by a dot
and a keel, so an expression that keeps the drawing and drops the reading has reduced the analysis
while passing every existence cell.

**The first thing this found was a real defect.** Above the label-escape scale the connection, the
pattern and the insight had their map labels suppressed and **nothing replaced them** — the
inspection view listed only topics. The inspection view now carries **every kind**.

**The second thing it found is not a defect.** The **CONNECTION is drawn and never named in the
default visual expression**. That is I-08B3.1-D2R's frozen grammar — a relation is a stroke between
two named topics — and F1R may not add a label to the Living Analysis World, because that would
change accepted default pixels. So the requirement is stated as a **regression rule**, which is
what the law actually says:

1. no accessibility expression may name **fewer** objects than the DEFAULT names;
2. **every** object is named in the screen-reader projection, with no exception, because there the
   drawing is not available at all;
3. **every** object is named in the **inspection view** — the expression that exists precisely
   because the map can no longer carry a label.

Check **P-04**. The connection's wordless default is recorded in `F1_KNOWN_LIMITATIONS.md`.

## 4. The five facts, per §14

For every object, in every expression:

1. the object **EXISTS**
2. its **RELATIONSHIPS** are the same
3. its **TEMPORAL** truth is the same
4. its **UNCERTAINTY / epistemic** status is the same
5. the **USER ACTIONS** available on it are the same

## 5. The result — and it is a bounded result, stated as one

**THE CURRENT FIXTURE PASSES ALL TESTED SEMANTIC DIMENSIONS.** That is the claim, and since
I-08B3.1-F1R2 it is the whole of it. The matrix is **bounded** to those dimensions; what it settles
for canonical V at large is nothing — the contract in §2A is what covers that, and its mapping is
written at integration.

| | |
|---|---|
| expressions | **12** |
| analytical objects | **11** |
| cells | **132** |
| facts asserted | **660** |
| **failures** | **0** |
| semantic dimensions **tested** | `epistemic` · `temporal` · `actionable` |
| semantic dimensions **not tested** | any the fixture does not supply — **the proof is bounded to the tested dimensions** |
| fields supplied but unmapped | **0 detected**, and detection is proved by feeding the projector one |
| a fabricated cell with a missing object | **rejected** |
| planted removals, one per object family | **4 / 4 caught, none disturbing another object** |
| the truth JSON satisfying rendered presence | **impossible — proved, not asserted** |
| naming regression under any accessibility expression | **none** |

Checks **P-01** … **P-04**. The structural probe feeds the same predicate a cell in which an
object is absent, on every run, so the failure branch is demonstrated even on a host with no
browser at all.

## 6. What differs, which is the whole point

Visual treatment differs in every column. The atmosphere's lightness moves under Increase
Contrast; its drawing mechanism changes under Reduce Transparency; labels leave the Map above
1.6× text; the entire document is a different document in the screen-reader column.

**Analytical content does not differ anywhere.**

## 7. What the matrix deliberately does not contain

- **A "quality" column.** Whether an expression is *good* is Product and Design's judgement, and a
  matrix that graded itself would be laundering taste as a measurement.
- **A per-frame motion column.** Reduced motion appears as a state of the **settled** scene,
  because D2R proved every counterpart reaches the same settled residue and that the settled
  frames are byte-identical across sequences. The frames are Board D's job.
- **A light-appearance column.** §18 puts it out of scope, and inventing one to fill a matrix is
  exactly what §18 forbids.
