# I-08B3.1-F1 — PART E: LARGER TEXT + BOLD TEXT, IN AN ARABIC-NATIVE PRODUCT

## 1. The test points, and where they come from

Apple's Dynamic Type table, read out of the rendered specification page per table rather than
recalled: **iOS Body is 17 pt at Large (the default) and 53 pt at AX5.**

| test point | multiplier | why this one |
|---|---|---|
| default | ×1.000 | the baseline every other column is compared against |
| xxxLarge | ×1.353 | the largest **non-accessibility** size — the one most users who enlarge text actually reach |
| 200 % | ×2.000 | Apple's stated floor, and WCAG 2.2 SC 1.4.4's threshold |
| **AX5** | **×3.118** | what the system can actually produce. `53 / 17 = 3.118` |
| Bold Text | ×1.000, +100 weight | a real variable-axis move on Estedad |

`qandeel.accessibility.text.max-scale` is **3.118**, and the number comes from Apple's table
rather than from QANDEEL.

## 2. The measured result

| expression | scale | min rendered label | truncated | min **measured** leading ratio | below threshold | objects reachable | rest / selected weight |
|---|---|---|---|---|---|---|---|
| DEFAULT | 1 | 11 px | **no** | **1.7** | **no** | 8 / 8 | 500 / 600 |
| LARGER TEXT xxxLarge | 1.353 | 14.88 px | **no** | **1.7** | **no** | 8 / 8 | 500 / 600 |
| LARGER TEXT 200 % | 2 | 22 px | **no** | **1.7** | **no** | 8 / 8 | 500 / 600 |
| **LARGER TEXT AX5** | **3.118** | **34.3 px** | **no** | **1.7** | **no** | **8 / 8** | 500 / 600 |
| BOLD TEXT | 1 | 11 px | **no** | **1.7** | **no** | 8 / 8 | **600 / 700** |

Every number is read out of the **rendered document** — `scrollWidth > clientWidth` for
truncation, computed `line-height / font-size` for leading — not asserted. Checks **X-02**,
**X-03**, **X-04**.

### The contract is NO CLIPPING. 1.6 is the instrument, not the law.

I-08B3.1-F1R froze a line-height of **1.6** as a **product contract** binding every Arabic-bearing
element at every size. That over-froze a measurement. **The line-height that avoids clipping depends
on the font, the size, the renderer, the platform metrics and the content**, and a later face that
needs a different number has not weakened anything — it has instantiated the same contract
differently.

> **`qandeel.accessibility.text.arabic-must-not-clip`** — *product contract.*
> **ARABIC TEXT MUST NOT CLIP, LOSE DIACRITICS, COLLIDE DESTRUCTIVELY, OR BECOME UNREADABLE AT ANY
> SUPPORTED TEXT SCALE.**

`text.leading-floor` = **1.6** stays, reclassified **production default / validation threshold**:
what Estedad measured at this proof's sizes on this renderer, and what X-02 tests the current proof
against. `text.leading-ratio` = **1.7** remains tunable craft above it. Lowering the threshold is
only ever legitimate as a **measured result**, never as a space saving — the clipping gets worse as
the glyphs grow, not better. Checks **X-02**, **K-06**.

## 3. The one real decision: what a label does when it no longer fits

Above `qandeel.accessibility.text.label-escape-scale` = **1.6**, a topic label can no longer fit
beside its contour at any position the field offers. The three tempting answers are all
forbidden:

- **truncate** — §11 forbids it, and `designing-arabic-frontends` says the clipping risk
  *doubles* with `overflow-hidden` on Arabic, which is exactly where the tempting fix lives;
- **shrink** — §11 forbids shrinking text to preserve composition;
- **overlap** — §11 forbids larger text overlapping analytical objects without a truthful
  fallback.

So the label **moves to the INSPECTION LIST**: a real, scrollable, fully-sized reading of the
**same objects**, reachable from the same place, with the Map unchanged behind it. Apple's own
words license precisely this: *"Avoid truncating text in scrollable regions **unless people can
open a separate view to read the rest of the content**."*

**It is not a summary and not a ranking.** It is the same eight objects, in the same order, with
the same names — and the parity matrix asserts that per object rather than describing it. The
Product hierarchy is not redesigned because text grew.

Apple also says *"Prioritize important content when responding to text-size changes… they don't
always want to increase the size of every word on the screen."* That clause was read carefully
and **deliberately not applied to analytical labels**. It is about transient chrome — the page
names tab titles and hit-damage values. A topic's name is the **identity channel**, and applying
this clause loosely would produce exactly the failure §11 names: *tiny fixed labels because the
Map is visually dense.*

## 4. The Arabic constraints, which are the script's and not a layout preference

| constraint | value | why |
|---|---|---|
| **line-height** | **1.7 here**, above a tested threshold of 1.6 | the contract is that Arabic **must not clip**; the number that achieves it is a property of the face, the size and the renderer. Estedad clips below about 1.6 at these sizes, and it gets **worse** as glyphs grow. 1.7 is inherited from D2R, which set it on both its surfaces |
| **letter-spacing** | **never**, anywhere an Arabic glyph can appear | Arabic is a connected script; tracking visibly breaks the joins. The stylesheet writes `letter-spacing: normal` explicitly so the absence reads as deliberate |
| **italics** | **never** | Arabic has no italic tradition and browsers fake-slant it. `font-style: normal` is written explicitly for the same reason |
| **weight** | 400–700 at UI sizes | below 400 Arabic loses legibility at UI sizes |
| **direction** | `dir="rtl" lang="ar"` at the root | `lang` matters as much as `dir` — it drives Arabic font fallback **and screen-reader voice selection**, which is why it is a Part F decision too |
| **logical properties** | throughout | the selection marker is on `inset-inline-start`, which in RTL is the **right** edge |

## 5. Bold Text, and the step it must not erase

Bold Text adds **+100** to every weight in the system. Estedad is a **variable** face, so this is
a real axis move rather than a synthetic emboldening, and the weights land at **rest 600 /
selected 700** — both inside the 400–700 band.

The point is the **step**, not the weight. E1 gives SELECTED a 100-unit weight step as its
typographic channel, and that channel exists because the Arabic script leaves nothing else open:
italic is unavailable and letter-spacing is forbidden. If Bold Text raised only the rest weight,
**SELECTED would vanish**. Check **X-03** measures the step at every text setting and requires
exactly 100.

The one clamp: the axis maximum is 900, so `Math.min(900, …)`. Asking for 1000 would silently
give 900 and quietly collapse the step at the top of the scale.

## 6. What this does not prove

- **No device.** Everything is desktop-rendered at a 390 pt viewport with `deviceScaleFactor: 2`.
  The escape scale of 1.6 is a **measured property of this viewport** and will differ on another.
- **Android nonlinear font scaling** is not modelled. Android 14+ scales large text nonlinearly,
  so the multiplier ladder above is iOS's, not a cross-platform one.
- **No native Arabic copy review.** The Arabic in this package is F1's, written against the
  register and structure rules, and it has not been read by a native reviewer.
