# I-08B3.1-F2 — KNOWN LIMITATIONS

Everything below is a limit of **this package**, stated so a reader does not have to find it.

---

## 0 — THE THREE THAT MATTER MOST

### 0a — No device validation of any kind

**No iPhone, no Android, no photometer, no VoiceOver, no TalkBack.** Seven gates are named in
`F2_DEVICE_VALIDATION.md`; three of them could change a Product decision rather than a calibration.

### 0b — The meaning-light source clears its floor by about 12%

The light appearance's source rises above its ground by a grayscale dEok of **0.021** against a
just-noticeable **0.020**, with the flooded core near the top of sRGB. **On a display that cannot
reach the sRGB ceiling, or in bright enough ambient light, the source may be lost while the glaze
survives — and the event would then read as a stain.** The remedy is known and the sweep shows its
cost: lower the Light World.

This is the thinnest margin in the package and the one most likely to move on device evidence.

### 0c — The per-pixel magnitude of a meaning event is not equal across appearances

**Area mean dEok 0.2846 in dark, 0.1022 in light; peak 0.6925 against 0.1570.** A dark ground lends
an event the whole empty luminance range above it; a light ground has already spent it. In light,
almost all of the event's magnitude is carried by the **glaze around the source** rather than by the
source — a dip-to-rise ratio of 7.32 : 1, where the dark event is pure brightening.

In each appearance's own smallest reading steps, the unit in which the two numbers mean the same
thing: **2.483 in dark against 1.005 in light.**

F2 reports this rather than closing it by turning something up, and it is the first thing the
Product Owner should look at on Boards C, D and E. **It is a property of the two perceptual
environments** — every one of the 104,835 configurations searched was measured against it.

**AND I-08B3.1-F2R ESTABLISHED WHY IT MAY NOT BE CLOSED, WHICH IS STRONGER THAN SAYING IT WAS NOT.**
An earlier draft of this section said the gap was *not repairable by choosing different values*. That
was wrong, and the correction matters more than the claim: the ratio-preserving floor of 0.2525 IS
reachable. A complete, admissible expression that reaches it was derived and rendered, and it is an
opaque brown-grey sphere on a near-white World. What forbids it is a requirement written from that
render — no stop of the Meaning Light may be darker than the World under its own passage scrim, at
L 0.5423 — and every one of the 2,379 configurations that reach the ratio floor violates exactly that
one requirement. **The gap is therefore a consequence of a ground at L 0.9491, stated as a
requirement, rather than a limit of the search.**

---

## 1 — What was measured on one renderer only

Headless Chrome on Windows, sRGB forced, LCD antialiasing off, 390 × 844 at DPR 2. Every colour
figure, every contrast ratio, every dEok and every raster. See `F2_DEVICE_VALIDATION.md` for what
that can and cannot stand in for.

## 2 — Living Brass's material character in light was not derived

I-08B3.1-C3 permits a restrained brushed / handled character tone at large identity moments, derived
from the body's authoring triple. **That derivation is dark-appearance work.** F2 derives the light
**body** and not its character tone. A light identity moment at large scale is therefore
unspecified, and is carried forward.

## 3 — Apple's 7:1 aspiration is not met by Living Brass or Error in light

> *"At a minimum, make sure the contrast ratio between colors is no lower than 4.5:1. For custom
> foreground and background colors, strive for a contrast ratio of 7:1, especially in small text."*

| | dark | light |
|---|---|---|
| Living Brass vs its World | 6.070:1 | **4.841:1** |
| Error vs its World | 8.612:1 | **4.843:1** |

Both meet the 4.5:1 minimum. **Dark Brass does not meet 7:1 either**, so this is not a light-only
regression — but light is further from it. Pushing Brass to 7:1 on the light ground forces OKLCh
L 0.38, which is a dark brown and is the outcome §7 forbids by name. **The tension is left standing
with both numbers on the page**, for Product review.

## 4 — The parity matrix is bounded, and it inherits I-08B3.1-F1R2's bound

1,452 cells over **11 analytical objects × 6 facts × 22 expressions**. The facts come from the
synthetic fixture I-08B3.1-F1 ships, and F1R2 already recorded that **the fixture's field list is
not the Product's semantic model.** F2 adds an appearance dimension to that matrix; it does not
widen its semantic scope, and the implementation dependency F1R2 recorded — *production accessibility
mapping must be exhaustive against the actual user-exposable V schema* — is still open.

## 5 — Reduced motion is tested at settle, not as frames

Inherited from I-08B3.1-D2R's proof that every reduced counterpart reaches the same settled residue
as its full-motion sibling, and from F1's use of it. The parity matrix therefore asks whether the
settled scene still contains every object; **it does not re-prove D2R's frame-level property in the
light appearance.** Boards C, D and E show the beats in both appearances side by side, which is
evidence a reader can check but is not a frame-by-frame proof.

## 6 — The cross-fade is proved as arithmetic, not as a rendered animation

The appearance cross-fade is measured as a blend of two rendered projections, with the assertion
that no intermediate channel leaves the segment between them. **That is a strong statement about what
a compositor will produce and it is not a recording.** Whether 200 ms *feels* like a re-projection
rather than a transformation is a motion judgement, on a device.

## 7 — Three of QANDEEL's surfaces were composed for the first time here

The conversation, the deep-analysis reading view and the utility / form / error surface did not
exist before this package; §23 requires them and F1's proofs are all the Living Analysis World.
**They introduce no token and no role** — every colour is resolved by its Product role and every type
size, weight and leading is the frozen one — but **their composition is F2's and has not been through
Product review.** If the Product Owner rejects a composition, the colour evidence on that board
still stands; the layout does not.

## 8 — The Arabic copy on those three surfaces is new

Written in فصحى, in Arabic structure, and deliberately carrying the **same analytical content** as
the Living Analysis World so the surfaces read as one Product. It has not been reviewed by an Arabic
editor.

## 9 — The atmosphere's fill alpha was not re-derived

Each contour's **stroke** contrast is preserved per layer. The interior **fill** — D2R's 0.050,
0.040 and 0.014 per world — is inherited unchanged, so the fill's perceptual weight against the
ground is *not* guaranteed to be identical across appearances the way the contour's is. The fill is
a very low-alpha wash in both, and the difference is small; it is recorded because it is a place
where "the alpha is preserved" and "the effect is preserved" are not the same statement, and this
package took the second reading everywhere else.

## 10 — R-FOOTPRINT is satisfied structurally, not by the expression

The requirement that a light event not cover more of the world than a dark one is met **because both
appearances use I-08B3.1-D2R's own source geometry**, not because any expression was constrained by
it. Measured as a fraction of the source radius it is close to vacuous — a falloff that decays to
zero covers its own source in either appearance — which is why check **C-06** measures it in
**pixels** against a real source radius and probes it with the defect this package actually had.
**The requirement is kept and labelled rather than quietly dropped.**

## 11 — No user was involved

No research, no testing with people, in either appearance. §32 asks the Product Owner eight
questions; none of them has been asked of anyone else.

## 12 — The package is 21 MB

Larger than I-08B3.1-F1's 7.6 MB, because it carries two appearances of every proof, twelve boards
and thirty motion frames. The board HTML references its tiles by path rather than embedding them,
and intermediate proof documents are shipped without rasters — both decisions are recorded in
`tools/f2-render.mjs` and `tools/f2-boards.mjs`.

## 13 — `data/F2_MANIFEST.json` is not byte-stable across runs

It hashes every file in the package including `docs/F2_MANIFEST.md`, which is generated from it — an
inherent fixed point, inherited from I-08B3.1-F1. **Everything else in the package is byte-stable**,
and `tools/f2-consistency.mjs` re-reads the shipped surfaces to prove it.

---

## Carried forward, unresolved, from earlier packages

These are **not** F2's to close and are restated so they are not lost:

- **A real VoiceOver / TalkBack device run** — I-08B3.1-F1's mandatory implementation gate, in both
  appearances now.
- **Exhaustive accessibility mapping against the real canonical V schema** — I-08B3.1-F1R2.
- **WCAG 2.2 SC 2.5.7 dragging movements** on the Living Analysis Map's camera — I-08B3.1-F1.
- **QANDEEL's navigation morphology** remains unreconciled — I-08B3.1-E1.
- **The North Star spectacle** — OPEN, NOT PROVEN, NOT WEAKENED, OWNED BY G.
