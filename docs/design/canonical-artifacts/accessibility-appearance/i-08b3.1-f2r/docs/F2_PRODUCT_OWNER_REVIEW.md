# I-08B3.1-F2 — PRODUCT OWNER REVIEW

§32 says what **not** to ask you: not tiny neutral differences, not an exact grey, not 1 px, not
minor contrast tuning, not a micro glow, not a minor shadow, not a minor opacity.

**None of those is on this page.** Every value in this package is derived against a stated
requirement and recorded; where a value was a judgement, the judgement is yours and the board is
where you make it.

---

## The eight questions, and where to look

### 1. Does Light QANDEEL still feel like QANDEEL?
**→ Board B**, and **Board J** beside the dark control at the same scale.

*What the package can prove:* the field is not simplified — same geometry, same eight topics, same
six hues, same harmonics, same ring counts, same parallax ladder; the chroma ladder is intact; the
maximum hue drift across the whole system is 1.70°.
*What it cannot prove:* that the result is QANDEEL. **That is this question.**

### 2. Is it beautiful enough to choose voluntarily?
**→ Boards B, F and G.**

Board G is the one to sit with: long-form Arabic on the light ground, three rungs of hierarchy, a
brass rule on the aside. If the light appearance is going to be chosen rather than tolerated, it
will be chosen for reading.

### 3. Does Living Brass still feel premium and recognisable?
**→ Board L** for the pair, **Board B** for the navigation, **Board H** for the buttons.

`#a58e6f` → `#7a6446`. Hue held to **0.13°**, chroma held to 0.0005, same rung of the ladder.
*What the package cannot tell you:* whether it reads as **brass** or as **brown** on a real screen.
**See `F2_CONTRADICTIONS.md` tension 1 — this is the one where a "no" has a known consequence:** the
material is where it is because it also has to be a legible ink, and freeing it means giving the
identity mark a different role, which is a B-track decision.

### 4. Does Meaning Light still feel like understanding?
**→ Boards C, D and E — the light strip and the dark strip, same beats, same page.**

**This is the question F2 is least able to answer for you, and the package says so in three places.**
The measurement: averaged across its own source disc the dark event differs from its ground by dEok
**0.2846** and the light event by **0.1022** — 2.483 of the dark appearance's own smallest reading
steps against 1.005 of the light one's. A dark ground lends an event the whole empty luminance range
above it; a light ground has already spent it. In light, almost all of the magnitude is in the **glaze
around the source** rather than the source, by 7.32 to 1.

**YOU HAVE ALREADY ANSWERED THIS ONCE, AND THE ANSWER WAS NO.** Independent review found the light
event near-static, and it was right about the frame it was shown. I-08B3.1-F2R found three causes and
all three were measurement errors rather than design errors: the requirement was on the event's peak
instead of its area, so a rim 0.14 wide satisfied it while the region a reader sees did not; **the
board captioned "CONNECTION — PEAK" was CONNECTION 1,850 ms past its own peak, at 0.363 of its own
level, because one set of beats was used for three categories with different clocks**; and the floor
was evaluated at an intensity no category reaches. Roughly three quarters of what was rejected was the
second one. The boards you are looking at now sample each category on its own clock.

Three earlier attempts to close the remaining gap are in the record and all three were wrong in
instructive ways: one laid a wash over half the world, the second was the same mistake with a better
name, and **the third was the principled one — preserve the ratio rather than the value, exactly as
this package does everywhere else. It passed every check in the package and rendered as an opaque
brown-grey sphere sitting on the World.** That is why there is now a requirement saying a meaning
event may not be darker than the veil QANDEEL draws over a region it is suppressing.

**If your answer is still "this does not feel like understanding", the parameters that would make it
larger are named, searched and classified as tunable** — `bloom.split` and `bloom.glaze-width` — but
their ceiling is no longer only R-FOOTPRINT and R-INK-SEPARATION. It is R-SOURCE-DOMINANCE, and on a
World at L 0.9491 that ceiling is close enough to the floor that **the next real lever is the ground,
not the event.** The sweep records what lowering it costs.

### 5. Does the Living Analysis World still feel deep and alive?
**→ Board B**, and Board J for the comparison.

The depth cue **reverses**: near is the brightest layer in dark and the deepest in light. That costs
nothing semantically — D2R declares every one of those properties `encodes: null` — but it is a real
perceptual change and it is worth your eye.

### 6. Does Error still feel like the same distinctive QANDEEL Error?
**→ Board H**, all three tiles: light, dark, and light under grayscale.

`#fe907e` → `#ad4739`. Hue held to **0.2°**, chroma held. The rejected alternative — the one that
reproduces dark's contrast ratio — is `#801c11`, a maroon, and it is on the board so you can see
what was not chosen.

### 7. Is reading comfortable?
**→ Board G**, then **Board K** at AX5 and Bold Text.

The three ratios are 12.89 / 8.36 / 5.43, against dark's 12.95 / 8.38 / 5.44. The primary ink is
**not black** — black would be 18.1:1 — because maximising the first rung compresses every rung
below it.

### 8. Does Light feel first-class rather than fallback?
**→ Board J, and then the whole set.**

§33 says F2 **fails** if Light looks like a fallback mode. The package can show you that nothing was
simplified, dropped or approximated. **Whether it reads as first-class is the judgement.**

---

## The three places a "no" changes something structural

| if you say no to | the consequence |
|---|---|
| **Q4 — Meaning Light** | the bloom parameters move, inside stated bounds; or Part C re-opens with a new family |
| **Q3 — Living Brass** | the identity mark needs its own role — a **B/E-track** decision, not an appearance one |
| **Q1 or Q8 — it is not QANDEEL** | the Light World's lightness is the first lever, and the full sweep of 21 candidates is in `data/F2_DERIVATION.json` |

Everything else is a calibration.

---

## What you are NOT being asked to accept

- **That any of this works on a device.** No device was available. Seven gates are listed in
  `F2_DEVICE_VALIDATION.md`, and three of them could change a Product decision.
- **That the North Star is any closer.** It remains **OPEN, NOT PROVEN, NOT WEAKENED, OWNED BY G**.
- **That F may be frozen.** `F2_FREEZE_CANDIDATE.md` states the candidate and the conditions; the
  decision is yours and independent review's.
