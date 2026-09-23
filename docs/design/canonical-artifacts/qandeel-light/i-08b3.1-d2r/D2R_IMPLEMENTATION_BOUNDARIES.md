# I-08B3.1-D2R — FINAL IMPLEMENTATION BOUNDARIES

What an implementer may change, what they may not, and what is not theirs to decide.

---

## 1. Fixed — changing any of these changes the Product

These are decisions the Product Owner has made or that the system's truth rests on. An
implementation that departs from one of them is not an implementation of this system.

| | |
|---|---|
| **The four categories and their topologies** | FIELD, DIRECTION, CONVERGENCE, EMERGENCE. A fifth kind of light event is a new Product decision |
| **CONNECTION** | GUIDED THREAD → CONTROLLED MEANING EMERGENCE → CALM SETTLE, selected at D0R and D1. Not reinterpretable |
| **The falloff law** | one function, shared. Categories differ in where the light is, not in how it falls off |
| **The lifecycle shape** | rise, then a longer fall, to **exactly** zero. Never a fade-to-almost, never a loop, never a residual pulse |
| **Every event ends in a neutral analytical residue** | readable with no animation |
| **Light is never emitted by matter** | the identity material may RECEIVE light; it may never be a source |
| **The ambient field does not animate on its own** | four independent reasons, three mechanical |
| **Atmosphere is never the most colourful thing on screen** | bounded below both the material's chroma and the Light's |
| **Nothing moves a topic from its canonical position** | position is the map's truth |
| **GEOMETRY DOES NOT MANUFACTURE MEANING** | no ambient visual property encodes an analytical quantity without a canonical contract granting it — build gate 6, guard **S1** |
| **A PATTERN is a MEMBER SET** | no order, strength or structure is inferred from screen positions — check **C5** |
| **Every topic is named in every world** | dimness is never a claim about what the user may know — guard **S4** |
| **Meaning Light is never used for activity, loading, focus, selection or confidence** | |

---

## 2. The token family, split — because I-08B3.1-D2 did not split it

D2 called several values *craft parameters to tune on a real device* in §3 of this document and
*freeze candidates* in §2, about the same numbers. The same value was provisional and
irreversible at once. `D2R_CORRECTION.md` REV-03.

**The distinction is not "is it in a token file".** A token exists so an implementation is
CONSISTENT; freezing exists so a PRODUCT DECISION is irreversible. A value can have the first
without the second.

Every token in `tokens/` now carries `com.qandeel.freeze`:

| Class | Count | What it means |
|---|---:|---|
| **product-contract** | 13 | Changing it changes what the product MEANS. Freezeable, subject to independent review. The three Light stops and the names that alias them; the three transition roles; the three reduced-motion rules; the atmosphere chroma ceiling |
| **production-default** | 32 | A calibrated starting value. Changing it inside its stated bound changes how the product FEELS, not what it says. **NOT Product-frozen, and expected to move once a device has been seen** |

`classify()` **throws on any token carrying neither**, so a token added later cannot inherit
"frozen" by sitting in the file.

**The atmosphere ceiling is classified as contract for a reason worth stating**: what is frozen
is the INEQUALITY — atmosphere below both the Light and the material — and the number is that
rule's current derivation. Re-choose the Light and the number should follow it.

**And the important half of the contract is not a token at all.** Fifteen Product-contract
statements are carried in the token tree's `$extensions` and in `D2R_FREEZE_CANDIDATE.md` §2.

---

## 3. Craft parameters — tune these against a real device

Two groups, and the difference matters. The values in §2 marked **production-default** ARE
tokens — they exist so an implementation is consistent — and they are still tunable. The values
below are not tokens at all, because §17 forbids a token for every visual parameter. **Neither
group is Product-frozen.** They live in `MAGNITUDE` in `source/scene/d2-render.mjs` and in the
geometry constants beside them.

| Parameter | Proof value | Tune against |
|---|---|---|
| ring stroke widths | 1.15 / 0.85 px | legibility at real density and DPR |
| ring stroke and fill alphas, per world | 0.86 / 0.60 / 0.40, fill 0.05 | OLED at low brightness |
| the Shared world's dash | `7 5` | whether "a shared world" reads without looking like data |
| the Public world's label alpha | 0.74 | readability of a dimmed but named field |
| member lift on selection | 0.55 opacity, +0.45 px | whether "which four" reads at a glance |
| membership link and mark widths | 1.25 px, r 5.5 | hairline rendering on low-DPR Android |
| locus mark radius and rise | 4.2 px, 3 px | |
| light source blur | 3.4 px Gaussian | shader cost on the weakest target |
| source radii and merge fraction | 1.35 × ring → 30 px, 0.34, 21 px | whether convergence still reads when scaled |
| node blur and rise | 0.9 px, 3 px | Android blur cost — see the feasibility hazards |
| contour samples | 84 points per ring | path complexity against fidelity |

**One rule governs both groups: tuning may not change what the frame MEANS.** If a change makes a
ring outrank the Light, moves a topic, makes one membership link differ from another, suppresses
a label, or makes a residue luminous, it is not a tuning — and gate 6 or one of S1–S6 will stop
it.

**One rule governs all of them: tuning a craft parameter may not change what the frame MEANS.**
If a change makes a ring outrank the Light, moves a topic, makes a structure extrapolate or makes
a residue luminous, it is not a tuning.

---

## 4. Not decided here, and not this track's to decide

| | Owner |
|---|---|
| **How often QANDEEL claims to have understood something** | Product. It decides whether the frequency gate permits these events at all, and it is the single most consequential open question in the D track |
| **The activity / loading / processing expression** | a later track. It must not be Meaning Light |
| **Interaction state** — selected, focused, pressed, disabled | `qandeel.state`, reserved, owned by I-08B3.1-E |
| **The light appearance theme** | reserved and empty; resolving into it fails loudly rather than returning a colour nobody designed |
| **Whether the mark stands on every screen** | a placement question C2 left open and C3 did not close |
| **The screen-reader copy for a PATTERN** | Product copy. The visual system creates the obligation and cannot discharge it |

---

## 5. How to run this package

```
node source/tools/d2-lightsearch.mjs    # derive the Light; writes the search front
node source/tools/d2-build.mjs          # six gates, then one prototype
node source/tools/d2-capture.mjs        # 2,106 frames + per-frame DOM digests
node source/tools/d2-verify.mjs         # C1–C9, R1–R8, G1–G6, S1–S6 + probes
node source/tools/d2-stills.mjs         # keyframes, contact sheets, proof boards
node source/tools/d2-encode.mjs         # nine films, each verified by decoding it back
node source/tools/d2-tokens.mjs         # the candidate token family, emitted and resolved
node source/tools/d2-gates.mjs          # skill + reference gate evidence, hashed from disk
node source/tools/d2-board.mjs          # the Product Owner review surface
node source/tools/d2-manifest.mjs       # every hash, and the preflight
```

In that order. Each one fails loudly and says what is missing rather than throwing a bare
`ENOENT`.

**To open a prototype or the board with the real typeface**, Chrome needs one flag, because it
treats every `file://` document as its own opaque origin and refuses a cross-origin font fetch:

```
chrome.exe --allow-file-access-from-files "prototypes/D2_LIGHT_SYSTEM.html"
```

Without it the page still loads and the Arabic is still readable — in a fallback face. **The
videos and the stills carry the typeface as pixels and are unaffected**, which is why they, and
not the prototype, are what the Product Owner is pointed at.
