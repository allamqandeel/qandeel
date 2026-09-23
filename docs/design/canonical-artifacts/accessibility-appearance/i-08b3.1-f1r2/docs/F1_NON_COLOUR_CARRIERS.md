# I-08B3.1-F1 — PART D: DIFFERENTIATE WITHOUT COLOUR ALONE

## 1. The rule, and what it is not

**QANDEEL keeps its colour.** The rule is not "remove colour"; it is:

> **COLOUR MAY SUPPORT MEANING. COLOUR MAY NOT BE THE ONLY REQUIRED CARRIER.**

Grayscale and the two dichromacies are **diagnostics** in F1, not target aesthetics, and F1 ships
**no override** for either — they are display-level transforms the OS applies after the app has
drawn, and an app repainting itself for them would be fighting the compositor.

## 2. The measurement that makes this part almost boring, which is the result

The strongest thing that can be said about hue in the Living Analysis World is not that it
encodes nothing. It is that it **cannot**:

| layer | max contrast between any two of the six hues | max ΔEok | under protanopia | under deuteranopia |
|---|---|---|---|---|
| near | **1.0185:1** | 0.0398 | 0.0340 | 0.0314 |
| mid | **1.0228:1** | 0.0401 | 0.0337 | 0.0291 |
| far | **1.0213:1** | 0.0380 | 0.0335 | 0.0301 |

The six ring inks share **one chroma and one lightness per depth layer** by construction. Colour
does not distinguish one topic from another **even for a reader with full colour vision**. A
grayscale rendering cannot lose information that was never carried — which is why Board F is a
quiet board and why that is the point rather than a disappointment.

Check **N-01** re-measures all three layers and requires every pair below 1.05:1.

## 3. What actually carries each distinction

| distinction | colour channel | the companion, declared as a token |
|---|---|---|
| one **topic** from another | none — measured above | `topic-identity` = **the written NAME**, in every world, at every size |
| **membership** in a pattern | none | `pattern-membership` = an **identical mark** at every member + a link |
| **SELECTED** | ink | `selected` = an **attached marker** on the inline-start edge + a **100-unit weight step** |
| **FOCUS** | indicator ink | `focus` = a **detached perimeter** at an offset + a **dark companion** |
| **UNAVAILABLE** | availability ink | `unavailable` = the ink + a **reason stated in words**, associated with the control |
| **ERROR** | `#fe907e` | `error` = ink + **glyph** + **copy** + **role** |
| which **world** is open | a uniform treatment | the world's **name in the header** |

Check **N-02** asserts every one of these companions is **declared as a token** rather than
described in a document, so a distinction added later without one is caught by its absence.

### `depth` left this table in I-08B3.1-F1R2, and did not leave the package

F1 listed **near from far** here — `depth` = 3 / 2 / 1 level lines + scale — as a **product
contract**, beside topic identity and error.

A companion channel is an obligation **because the distinction it accompanies carries analytical
meaning that colour must not be the only carrier of.** Near-from-far carries none: I-08B3.1-D2R's
`PRESENTATION_CONTRACT` declares `ring.contourCount` and `ring.layer` **`encodes: null`**, and
`ring.radius`, `ring.contourShape`, `ring.hue` and `field.parallax` with them. Requiring a
non-colour carrier for a distinction that encodes nothing **asserts a semantic parity obligation
over something with no semantics** — and quietly restores, inside the accessibility layer, exactly
the authority D2R removed.

**The craft is unchanged and the drawing is unchanged.** 3 / 2 / 1 level lines and a scale remain,
in the default and in the grayscale diagnostic, as
`qandeel.accessibility.presentationCraft.depth` — **production craft that carries no analytical
meaning**, declared as such. What is withdrawn is only the claim that an accessible expression must
*preserve* it in order to preserve the analysis.

Check **K-05** reads D2R's own `PRESENTATION_CONTRACT` and fails if any product-contract
accessibility token names a property that table declares `encodes: null`.

## 4. The one hue that carries meaning is the one with three companions

`#fe907e` is by a distance the most chromatic value in QANDEEL — **C 0.1364**, against Living
Brass at 0.0516 and an atmosphere ceiling of 0.0197. It is the only place hue is load-bearing.

WCAG 1.4.1 allows a **lightness difference at 3:1** to count as the non-colour distinguishing
factor. E1 measured that escape hatch **closed** here: the error ink reaches **1.03:1** against
secondary ink and 1.58:1 against tertiary. So the glyph, the copy and the role are an
**obligation**, not a courtesy. Check **N-03** re-measures it.

> That measurement also broke this package's first attempt at a probe for check N-01, which fed
> the predicate the error ink against secondary ink on the assumption that a pair where colour
> carries meaning would obviously separate. It measures 1.03:1 and the predicate accepted it.
> The probe was wrong and the system was right; the wrong probe is left described in the
> verifier because it is the more interesting fact.

## 5. Interaction states, which never depended on colour

E1's grammar was already built this way and F1 inherits it whole:

- **PRESSED** is a ground response — a **level**, not a hue.
- **FOCUS** is a **perimeter** (a shape) at an **offset** (a position), with a companion.
- **SELECTED** is a **marker** (a shape) plus a **weight** (a typographic axis).
- **UNAVAILABLE** is an ink **plus a sentence**.

None of these is lost to grayscale, to protanopia, to deuteranopia, or to Bold Text — and
check **X-03** asserts the weight step survives Bold Text at 100 units, which is the only reason
Bold Text does not erase SELECTED.

## 6. What the diagnostic is for, and what it cannot tell you

Board F renders the same scene under grayscale, protanopia and deuteranopia. It is there to
**expose a hidden colour dependence**, and it did not find one.

What it cannot tell you: whether a reader can *use* the map. No user was involved. The argument
that the written name carries identity is structural and measured, and it has **not been tested
with anyone** — I-08B3.1-D2R recorded the same gap and F1 does not close it.
