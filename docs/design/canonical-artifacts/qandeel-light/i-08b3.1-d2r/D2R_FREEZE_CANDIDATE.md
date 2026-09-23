# I-08B3.1-D2R — FREEZE-CANDIDATE SUMMARY

**This package does not declare anything frozen.** §26 reserves that decision for independent
Product and Design review. What follows is what would be frozen if it were accepted, what
evidence stands behind each part, and what is explicitly not ready.

---

## 1. The four categories, complete

| | Expression | Evidence |
|---|---|---|
| **A · AMBIENT** | one integrated field across three worlds; contour level sets; still by default; parallax under the user's hand | `video/D2_A_…`, `frames/A/`, `frames/proof/D2_THREE_WORLDS.png`, **R1** |
| **B · CONNECTION** | INHERITED CONTROL, unmodified | `video/D2_B_…`, **C1** — 4,830 comparisons, largest difference 0 |
| **C · PATTERN** | convergence toward an authored locus; membership drawn as four identical links and four identical marks; **nothing inferred from screen geometry** | `video/D2_C_…`, **C4**, **C5**, **S3** |
| **D · INSIGHT** | inward gather onto an empty site; local emergence; a keel that remains | `video/D2_D_…`, **C6** |
| **coherence** | all four in one 33-second film behind Arabic titles | `video/D2_COHERENCE_FOUR_CATEGORIES.mp4`, `frames/proof/D2_COHERENCE_GRID.png` |

**No major Light category remains unresolved.**

---

## 2. The token family

`tokens/qandeel-light.resolver.json` extends the frozen I-08B3.1-C3 resolver — it does not stand
beside it, for the reason C3 itself recorded when it extended B4R: a sibling is how a system ends
up with two answers to one name.

### The freeze boundary, which I-08B3.1-D2 did not draw

| Class | Count | |
|---|---:|---|
| **product-contract** | 13 | Changing it changes what the product MEANS |
| **production-default** | 32 | A calibrated starting value. **Not Product-frozen**, and expected to move once a device has been seen |

`classify()` throws on any token carrying neither, so a token added later cannot inherit "frozen"
by sitting in the file. `D2R_CORRECTION.md` REV-03.

**Fifteen Product-contract statements are NOT tokens**, and they are the important half. They are
carried in the token tree's own `$extensions`:

> four categories · four topologies of one falloff law · AMBIENT is not Meaning Light and
> ACTIVITY is neither · Meaning Light is event-based and reaches exactly zero · EMERGE →
> CRYSTALLIZE → SETTLE with crystallization beginning before emergence ends · no persistent glow
> or looping pulse · every event ends in a neutral analytical residue · reduced motion is a real
> alternate expression reaching the same settled meaning · no animated blur under the setting,
> anywhere · Light may act on the material, never be emitted by it · no analytical object carries
> the identity material · atmosphere is never the most colourful thing on screen · **geometry
> does not manufacture meaning** · **a PATTERN is a member set** · CONNECTION is the inherited
> expression.

**45 tokens**, in two sibling groups:

- **`qandeel.illumination`** — the three Light stops, the falloff law, the lifecycle and its two
  speeds, the one exact easing curve, the intensity ceiling, extents, the three transition roles,
  and the reduced-motion expression.
- **`qandeel.atmosphere`** — the chroma ceiling, three plane lightnesses, six hues, the contour
  parameters, the parallax rates and the deceleration constant.

Emitted, resolved and gated by `source/tools/d2-tokens.mjs`, which asserts:

- every Light colour resolves **through an alias chain** to the hex the scene painted with — a
  value that is right by coincidence is a copy
- **nothing in either group aliases the identity material** (C3 invariant I-04, applied to a new
  namespace)
- **the forbidden name `accent` appears nowhere** (invariant I-18)
- **atmosphere is not nested inside illumination** — that arrangement would say the world's
  ambient life is a kind of meaning

### The Light colour, and what changed

| | Diagnostic (D0 → D1) | Candidate (D2) |
|---|---|---|
| CORE / MID / LOW | `#fef1d6` `#ecdcbc` `#dcc8a1` | **`#fbf2db` `#e8ddc2` `#d6caa9`** |
| authored | — | OKLCh hue **89°**, chroma max **0.046** |
| separation from Living Brass, whole path | **0.0118** | **0.0201** |
| requirement | none stated | **0.020** |

Derived by search, not chosen: `source/tools/d2-lightsearch.mjs`, 751 families satisfying every
constraint, selected by a rule written before the numbers were read. Drawn at
`frames/proof/D2_LIGHT_SEPARATION.png`.

**0.020 IS AN ENGINEERING HEURISTIC THIS PACKAGE ADOPTED. IT IS NOT A PERCEPTUAL LAW AND NO
ARITHMETIC FROZE THIS COLOUR.** It gave the search a floor that was not taste; its justification
is comparative, since I-08B3.1-D1 could not tell the 0.0118 family's dim tail from the identity
material. The threshold at which two colours become tellable apart depends on size, surround,
display, ambient light and viewer, and none of those is in this arithmetic.
**Acceptance remains: this measurement, PLUS visual Product review, PLUS device validation.**

**What is deliberately not a token**: the eighteen ring colours, which are derived from three
tokens that are; and the craft magnitudes listed in `D2R_IMPLEMENTATION_BOUNDARIES.md` §3, which
are the values that should move when someone finally holds a phone.

---

## 3. Verification, in full

**30 of 30 checks hold. 22 of 22 probes detected their planted violation.**

| Family | Result |
|---|---|
| **C1–C9** on the state trace, no browser | all hold |
| **R1–R8** on 2,106 captured pixels-true frames | all hold |
| **G1–G6** guards, each with a probe | all hold |
| **S1–S6** semantic guards — the D2R additions, S6 added by the closure repair | all hold, 15 probes |
| build gates | **6** of 6, including the new geometry gate, and the build does not emit if one fails |
| token gates | emitted, resolved, invariants asserted, every token classified |
| videos | 9 of 9 verified by decoding them back; worst mean error **0.277/255** |

The figures a reviewer is most likely to want:

- CONNECTION inheritance: **4,830 comparisons, largest difference 0**
- determinism: the same sequence captured twice after five others used the same elements —
  **0 of 210 DOM digests and 0 of 210 rasters differ**
- ambient at rest: **162 frames across three worlds, byte-identical**
- settled states: **36 frames per sequence, byte-identical**, in all six
- PATTERN carries **no derived statistic**: the exported geometry is `{links, locus, members}`,
  every member's light level is equal at every frame, and every scalar channel matches an
  independent restatement from time alone with divergence **0**
- the three meaning events differ by **16.8 %, 11.2 % and 14.3 %** of the frame at their peak
- no Light survives the settle: **0 pixels**, in all six, with the instrument's sensitivity
  stated (alpha 0.310)
- atmosphere's maximum chroma anywhere: **0.0196**, against Light 0.0317 and Matter 0.0516
- navigation: **1 distinct region per sequence**, across all nine

---

## 4. The eight success conditions of §25

| | |
|---|---|
| 1. each communicates a different true Product event | **Yes** — and the differences are measured, not described: **C4**, **R4** |
| 2. none lies semantically | **No lie found.** `D2R_TRUTH_AUDIT.md` walks all fifteen failure conditions |
| 3. they belong to one authored language | **Yes, structurally** — one falloff law, one lifecycle, one vocabulary, one kind of residue, all as shared functions |
| 4. modern, alive, memorable | **Product judgement.** The boldness is spent on the level set — as composition, identifying nothing; the nearest generic cluster is named and the accent measured rather than trusted |
| 5. calm enough for long-term use | **Yes** — nothing loops, nothing persists, every event decays to exactly zero and the world is still between them |
| 6. accessibility preserves meaning | **Yes** — four real counterparts, each reaching the same settled residue (**C8**); with the gaps in §8 of `D2R_ACCESSIBILITY.md` stated |
| 7. implementation is realistic | **Yes, with two named blur hazards** and a stated degradation path. **No device measurement exists** |
| 8. no major Light category unresolved | **Yes** |

---

## 5. What is NOT ready, and should be read before any freeze

1. **No device has seen this. Not one frame** — and no performance or comfort claim anywhere in
   this package is based on one. The validation matrix is defined in
   `D2R_IMPLEMENTATION_FEASIBILITY.md` §5 and was **not run**; `animate-expo`'s rule is that
   feel is judged on a release build on the slowest supported device and nothing else counts.

   **This is a mandatory implementation validation gate, and it is NOT a blocker on freezing
   this contract.** The two are separable because they are different claims. What is offered for
   freeze is the **Product / semantic Light contract**: what each category MEANS, what the
   geometry does and does not encode, and which properties are irreversible — none of which a
   device measurement can confirm or refute. The device-sensitive values — blur radii, durations,
   the merge fraction, the parallax rates — are classified **production-default / tunable craft**
   in the token tree precisely so they can move after a device is seen without reopening a
   Product decision. Freezing the contract does not pre-approve the calibration, and the
   calibration cannot be signed off from here.
2. **The frequency question is open and is a Product decision.** How often QANDEEL claims to have
   understood something decides whether three meaning events are calm or exhausting.
   `animate`'s gate cannot be answered from here.
3. **No screen-reader pass, no 200 % text rendering, no colour-vision simulation.**
4. **The activity expression does not exist**, deliberately. Whoever builds it must be able to
   say in one sentence why it is not Meaning Light.
5. **The DTCG specification text was not read clause by clause** — the site would not load from
   this host. The structural authority used is the frozen C3 tree, which declares the same
   schema version.
6. **PATTERN may read as a diagram rather than as membership.** Four equal links to a named hub
   is the honest drawing of a set; whether a person looks for meaning in which link is longest is
   a question a frame cannot answer, and it is the first thing to watch in Product review.
7. **Nothing else is open at the Product level.** The ring-size question that appeared here in
   the first D2R package is **closed**, not deferred: adaptive presentation size may vary for
   composition and legibility and carries zero analytical authority, and the radii themselves are
   tunable craft. The rule is stated in `D2R_AMBIENT_MEANING_ACTIVITY.md` §4.

---

## 6. Recommendation

**I-08B3.1-D is READY FOR FINAL INDEPENDENT FREEZE REVIEW**, with §5 read alongside it.

The two blockers are resolved at the level they were raised: the invented encodings are gone and
their absence is enforced by a gate and five guards that read data structures and written
attributes rather than prose; PATTERN is rebuilt on membership with nothing derived from screen
geometry, and the check that replaced D2's now asserts three things D2 could not have passed. The
freeze boundary is drawn on every token, and the important half of the contract is stated as
fifteen sentences rather than smuggled into numbers.

**Item 1 is the thing to be clear-eyed about, and it is a scope boundary rather than a
withholding.** A Light system for a phone that no phone has seen is a design **proved correct and
not yet proved comfortable** — and those are different claims, which is exactly why one can close
while the other stays open. What this package asks review to freeze is the first. The second is
booked as a mandatory implementation gate, and if review can put this on a weak Android before
the track closes, it should.

**This package does not declare I-08B3.1-D closed. That decision is not mine.**
