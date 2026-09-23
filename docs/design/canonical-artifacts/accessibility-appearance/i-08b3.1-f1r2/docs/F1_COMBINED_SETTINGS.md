# I-08B3.1-F1 — COMBINED SETTINGS

§9 requires the settings tested together, not only in isolation.

## 1. The matrix that was actually rendered and measured

| expression | rendered | in the parity matrix |
|---|---|---|
| DEFAULT | ✓ | ✓ |
| REDUCED MOTION | ✓ | ✓ |
| INCREASE CONTRAST | ✓ | ✓ |
| REDUCE TRANSPARENCY | ✓ | ✓ |
| **INCREASE CONTRAST + REDUCE TRANSPARENCY** | ✓ | ✓ |
| **REDUCED MOTION + INCREASE CONTRAST** | ✓ | ✓ |
| GRAYSCALE (diagnostic) | ✓ | ✓ |
| LARGER TEXT xxxLarge / 200 % / AX5 | ✓ | ✓ |
| BOLD TEXT | ✓ | ✓ |
| SCREEN-READER PROJECTION | ✓ | ✓ *(a different document)* |

**12 expressions × 11 analytical objects = 132 cells, 5 facts each. 0 failures.**

A **bounded** proof, stated as one: every cell is evidence about the semantic dimensions the
synthetic fixture supplies. The Product contract is wider — no user-exposable disclosed analytical
truth may be lost solely because the expression is accessible — and the exhaustive production
mapping is validated against the real canonical V schema at integration.

## 2. Why no combination needs its own values

The two colour-bearing settings are **orthogonal by construction**:

- **Increase Contrast** changes *which rung of the frozen reading ramp a class points at*, plus
  the atmosphere's lightness;
- **Reduce Transparency** changes *the mechanism a contour is drawn by*, plus the scrim.

They act on different properties of different things, so the resolver composes them in one pass
and there is no third token file. Check **X-01** asserts that mechanically: for every role, the
combined resolution equals whichever single-setting override moved it, and a combination that
needed its own values would fail.

> That check exists because a combination with bespoke values would mean the two transformations
> were **not** independent — and a reviewer would then have to check every *pair* rather than
> every *setting*. The absence of a third file is the claim.

## 3. The combination that does not exist, and why saying so matters

**REDUCE TRANSPARENCY HAS NO ANDROID EQUIVALENT.**
`AccessibilityInfo.isReduceTransparencyEnabled` is `@platform ios` and the Android branch is
literally `return Promise.resolve(false)`.

So the real matrix differs by platform:

| combination | iOS | Android |
|---|---|---|
| Reduced Motion | ✓ | ✓ |
| Increase Contrast | ✓ *(`isDarkerSystemColorsEnabled`)* | ✓ *(`isHighTextContrastEnabled` — **a different setting, about text**)* |
| Reduce Transparency | ✓ | **no system signal** |
| Contrast + Transparency | ✓ | **not reachable from system settings** |
| Motion + Contrast | ✓ | ✓ |
| Bold Text | ✓ | **no system signal** |

§9 says *do not fabricate platform behaviour*. The Android column above is the answer: F1 renders
the combination because it is a legitimate **expression**, and records that on Android it can only
be reached by an **app-derived** preference, not by the OS.

## 4. The contradiction the combination was checked for, and did not have

The combination worth worrying about is **Increase Contrast + Reduce Transparency**, because one
raises the atmosphere and the other makes it opaque — and if both raised it, the field would
arrive at analytical strength.

They do not compound. Increase Contrast already sets the stroke-alpha sentinel to *draw at full
opacity*; Reduce Transparency sets the same sentinel and adds pre-compositing. **The second
setting cannot raise what the first has already taken to 1.0.** So the combined loudest contour
is the same 5.501:1 as Increase Contrast alone, and check **C-05**'s ceiling holds unchanged.

That is a real property of the design rather than a coincidence, and it is why the sentinel is a
sentinel — a plain multiplier would have reached full opacity at a different point for each of
the three worlds, giving the setting a per-world reading it must not have.

## 5. Reduced Motion in a matrix of stills

I-08B3.1-D2R proved every reduced counterpart reaches the **same settled residue** as its
full-motion sibling and that the settled frames are byte-identical across sequences. **At settle
there is one scene**, so *"does reduced motion delete an analytical object"* is answered by
asking whether the settled scene still contains it — which is what the matrix asks.

The **frames** are Board D's job, and Board D draws them from D2R's own state vectors.
