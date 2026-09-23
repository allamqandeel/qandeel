# I-08B3.1-F1 — PART C: REDUCE TRANSPARENCY

## 1. What this setting is not, in QANDEEL

It is not a chrome question, and I-08B3.1-B4R recorded that **before this task existed**:

> *"Note that the B-track truth it will override is OPAQUE: Reduce Transparency has nothing to
> undo here."*

The functional Surface is an opaque matte. The navigation is opaque. `CHROME.opacity` is `1`.
QANDEEL has **no Liquid Glass, no backdrop blur behind content, and no vibrancy stack** — the
three things Apple's Reduce Transparency guidance is actually about.

A package that shipped an impressive-looking chrome transformation for this setting would be
transforming something that does not exist. So the honest first result of Part C is an **absence**,
and the work is finding what the setting really has to act on here.

## 2. What it is: a World question, with three subjects

| subject | default | under Reduce Transparency |
|---|---|---|
| **the ambient field's contours** | ink composited at per-world stroke alphas `0.86 / 0.60 / 0.40`, plus a fill at `0.050 / 0.040 / 0.014` | drawn **opaque**, in their own exact composited equivalents |
| **the PASSAGE scrim** | black at alpha `0.5` | `#080808` — opaque |
| **QANDEEL LIGHT** | translucent | **translucent. Deliberately unchanged.** |

## 3. The substitution is exact, not approximate — which is why the World survives it

Every ambient contour is composited against **one flat opaque colour**, the World `#101010`. A
source-over composite onto a constant has a **closed-form opaque equivalent**, so drawing that
equivalent changes the *mechanism* and **not one pixel**.

90 stroke substitutions and 18 fill substitutions are enumerated in `data/F1_DERIVATION.json`,
and check **T-02** recomputes all 90 rather than trusting the file.

This is the sentence the whole part turns on: **the field is not simplified, it is pre-resolved.**
Reduce Transparency costs the Living Analysis World no contour, no level line, no depth plane
and no label. It costs it a compositing operation.

### The one visible difference, stated rather than hidden

Where two contours **cross**, translucent strokes tint each other and opaque ones do not — the
nearer depth plane wins. That loses a crossing tint and loses **no analytical content**, because
`PRESENTATION_CONTRACT` declares contour shape, radius and hue all `encodes: null`. There was
never anything at a crossing to lose. It is recorded in `F1_KNOWN_LIMITATIONS.md` as a visible
difference rather than claimed as invariance.

## 4. The scrim, where the accessible expression is MORE faithful than the default

`#080808` is not a new colour. It is exactly what black at alpha 0.5 produces over the World,
computed rather than eyeballed — check **T-01** recomputes it and compares.

And B4R's own words make the substitution better than a compromise:

> *"It expresses WORLD SUPPRESSION. Background legibility is not one of its duties, because the
> World behind a PASSAGE is suspended."*

A translucent scrim leaves a suspended World faintly visible. An opaque one does not. **This is
the one place in F1 where an accessibility expression states the Product's own intent more
plainly than the default does**, and it is worth a reviewer's attention for that reason rather
than despite it — because if the opaque scrim reads *better*, the question it raises is about the
default, not about the accessible mode.

Primary reading ink measures **13.63:1** on the scrimmed World, unchanged, because neither the
ink nor the value under it moved.

## 5. QANDEEL LIGHT keeps its alpha, and the zero is a decision

`qandeel.accessibility.transparency.light-alpha-floor` is `0` in **both** contexts, and the
reduced context restates it so a reviewer who expects it to have changed finds the reason where
they look for the change.

A light is a thing whose whole nature is that what is behind it shows through. **An opaque light
is a disc.** Reduce Transparency exists so a translucent *material* does not cost a reader the
legibility of the content on it — and the Light is **content, not material**. Removing its alpha
would delete a meaning event's intensity, which §3 forbids in as many words.

If a device pass finds the Light unreadable under this setting, **the answer is intensity, not
opacity**, and that is recorded as an F2/device carry-forward rather than pre-empted here.

## 6. What does not change at all

Check **T-04**: no analytical ink, no identity material and no status colour moves under Reduce
Transparency. Living Brass `#a58e6f`, primary `#d8d5ca` and error `#fe907e` are byte-identical
across the two contexts. The only token whose value differs is the scrim.

## 7. Platform honesty

`AccessibilityInfo.isReduceTransparencyEnabled` is annotated **`@platform ios`** in the React
Native source, and the Android branch is literally `return Promise.resolve(false)`. **Android has
no equivalent system setting**, and an app cannot synthesise one.

So the combined-settings matrix has **fewer real cells on Android than on iOS**, and
`F1_PLATFORM_MAPPING.md` says which rather than implying parity. A product-level setting that
lets an Android user request this expression explicitly is a legitimate answer and is recorded as
an **APP-DERIVED** option, not shipped as a claim that the platform provides it.
