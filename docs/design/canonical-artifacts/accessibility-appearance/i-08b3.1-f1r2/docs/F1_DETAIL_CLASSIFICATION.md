# I-08B3.1-F1 — SEMANTIC, ORIENTATION, AMBIENT

§4 of the brief asks for every piece of visual material to be classified **A semantic / required**,
**B orientation / interaction support**, or **C ambient / decorative**, because the three have
different rights: C may be reduced or replaced, B may be transformed, **A may never be silently
deleted**.

QANDEEL is unusually easy to classify and unusually hard to argue with about it, for one reason:
**the classification already exists in the code.** `d2-world.mjs` ships a `PRESENTATION_CONTRACT`
that declares, per visual property, what it encodes — and the build refuses to emit a page if a
property claims to encode something without naming a canonical contract that grants it. So the
table below is not F1's opinion. It is a data structure the build reads.

---

## A — SEMANTIC / REQUIRED

| material | what it carries | may an accessibility expression remove it? |
|---|---|---|
| a **topic's name** | the topic's identity — the ONLY identity channel | **no.** Check X-04 asserts all eight reachable at every text setting |
| an **analytical node** | that an object exists at this point in the analysis | **no** |
| a **relation stroke** | that two named topics are connected | **no.** Parity cell `connection:*` |
| a **membership link** and its **mark** | that this topic belongs to this pattern | **no.** One width, one opacity, for every link — a set has no strengths |
| a **pattern locus** | that a pattern exists and what it gathers | **no.** In the projection it becomes a sentence |
| an **insight node**, its **text** and its **keel** | that something was understood, and what | **no** |
| **epistemic status** — observed vs hypothesis | how much the object claims | **no.** Announced in words in the projection |
| **temporal state** | when this is true | **no** |
| **SELECTED, FOCUS, UNAVAILABLE, ERROR** | the user's position, and what needs attention | **no.** E1's grammar, inherited unchanged |
| the **reason** an unavailable control is unavailable | why | **no.** It is a carrier, not a courtesy |

## B — ORIENTATION / INTERACTION SUPPORT

| material | transformation applied |
|---|---|
| **parallax between depth planes** | the DIFFERENTIAL is removed under Reduced Motion; **the pan stays** — removing it would remove access to the off-screen Map, which is deleting analysis |
| **momentum after a flick** | removed under Reduced Motion. The resting position a projection would have chosen was never a fact about the analysis |
| **the press response** | the ground LEVEL survives; a scale would go |
| **the functional Surface's edge** | gains a 1 px boundary under Increase Contrast, because World↔Surface is 1.072:1 |
| **the focus perimeter** | thickens 2 px → 3 px under Increase Contrast. Non-colour, on purpose |
| **the label's position on the Map** | above 1.6× text it moves to the inspection list. **Not a truncation and not a shrink** |

## C — AMBIENT / DECORATIVE

Everything in this class is declared `encodes: null` by `PRESENTATION_CONTRACT`, by name:

| material | `encodes` | what it explicitly does NOT mean |
|---|---|---|
| `ring.radius` | `null` | amount of material, importance, confidence, activity |
| `ring.layer` | `null` | recency, age, relevance, rank, distance in time |
| `ring.contourCount` | `null` | temporal distance, quantity, density of anything analytical |
| `ring.contourShape` | `null` | identity, a signature, anything recognisable-by-shape |
| `ring.hue` | `null` | category, identity, type, state, sentiment |
| `field.parallax` | `null` | time, sequence, importance |

**One property in the field is not in class C**, and the contract says so: `world.treatment`
encodes **WHICH WORLD IS OPEN — and nothing about any topic in it.** It is a uniform atmosphere
keyed to one disclosed fact, identical for every topic in that world. That is why Reduce
Transparency may change how a contour is *drawn* and may not remove the **dash** that says
"shared world", and why the Public world's lower luminance is uniform rather than per-topic.

---

## The measurement that makes class C checkable rather than assertable

The strongest thing F1 can say about `ring.hue` is not that it encodes nothing. It is that it
**cannot**:

> The six atmosphere hues share one chroma and one lightness per depth layer by construction.
> The **maximum contrast between any two of them is 1.0185:1**, the maximum OkLCh ΔE is
> **0.0398**, and under protanopia and deuteranopia the maxima are **0.0340** and **0.0314**.

Colour does not distinguish one topic from another **even for a reader with full colour vision**.
A grayscale rendering cannot lose information that was never carried. Check **N-01**.

---

## The boundary, stated as the brief asks

- Decorative atmospheric material **may** be reduced or re-drawn. Under Reduce Transparency it
  is pre-resolved rather than simplified; under Increase Contrast its lightness moves by 0.011.
- A relationship that communicates a real analytical connection **may not** disappear — and
  Board J's 132 cells are the per-object assertion of that, not a statement about it — a **bounded**
  assertion, over the semantic dimensions the fixture supplies.
- A Pattern membership relation **may not** disappear. Under Reduced Motion its links arrive by
  ink **at full length**, because a wipe is motion across the screen and a fade is not.
- A selected state **may not** become ambiguous. Its two channels are a marker and a weight
  step; neither is a colour, so neither can be lost to a colour transformation.
- A topic label **may not** become inaccessible because its surrounding atmosphere changed —
  and the label does not live in the atmosphere at all. It is a real text view over the drawing,
  which is the same constraint production has and the reason the projection can exist.
