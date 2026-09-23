# I-08B3.1-D2R — IMPLEMENTATION FEASIBILITY AND DEVICE VALIDATION

React Native · Reanimated 4 · React Native Skia.

**Every figure in this document is either a count taken from this package's own scene or a
reading of first-party guidance. NOT ONE OF THEM IS A DEVICE MEASUREMENT.** §16 is answered
honestly in §5: no device was available, the validation matrix is defined, and what was and was
not done is stated.

---

## 1. The strategy, in one line

**One Skia canvas for the world and the light; ordinary React views for text; Reanimated shared
values driving both.** Nothing in this system is a stack of independently animated glowing views,
and the design was shaped so that it could not become one.

---

## 2. Why the ambient field is affordable, and why that is a design consequence

The field's geometry is a **build-time constant**. Every contour path, every colour and every
dash pattern is computed before the page loads; there is no per-frame arithmetic behind the field
at all. Its only per-frame change is **one translateX per depth plane**.

That is not a performance trick applied afterwards. It is the same decision as
*the field does not move* — and it happens to land on the single cheapest thing a GPU can do.

**The node count, taken from this scene:**

| | Count |
|---|---|
| topics | 8 |
| contour strokes (3 near, 2 mid, 1 far) | 17 |
| presence fills | 8 |
| topic labels | 8 |
| light sources | up to 6 |
| structure (4 membership links, 4 marks, the locus mark, keel) | 10 |
| inherited CONNECTION stage | 18 |
| **total drawable nodes** | **~67** |

Software Mansion's own limits: **~500 animated components on iOS, ~100 on low-end Android**, and
*"for highly complex animation scenes (hundreds of elements), consider Reanimated + react-native-skia
instead of animating native views."*

Sixty-seven is under the low-end Android limit — but that limit is for **animated** components,
and on react-native-svg every one of these becomes a **native view** whether it animates or not.
That is the reason for the canvas: not that the count is too high, but that the view hierarchy
is the wrong shape for a field.

**And the field is precisely the case Skia's Atlas exists for.** Its documentation: *"The Atlas
component is used for efficient rendering of multiple instances of the same texture or image"*,
for *"a very large number of similar objects"*, and — the part that matters — *"Atlas transforms
can be animated with near-zero cost using worklets."* A fixed set of sprites whose only per-frame
change is a transform is the Atlas specification restated.

**This is not a guarantee about frame time.** It is a route with a named primitive and a
first-party performance claim attached, and it is the route this design was shaped to be able to
take.

---

## 3. The port table, and four hazards that would render and still be wrong

| Element | Web proof | Production | Note |
|---|---|---|---|
| contour paths | SVG `<path>` | Skia `Path` in an `Atlas` or a static `Picture` | constants; never rebuilt |
| plane parallax | `style.transform` | one shared value → `Group transform` | the only per-frame field write |
| light sources | `<ellipse>` + radial gradient + CSS blur | Skia `Circle`/`Oval` + `RadialGradient` + `Blur` image filter | sigma, and `decal` tile mode so a source fades to nothing at its edge |
| light on the Brass mark | `mix-blend-mode: screen` | `<Group blendMode="screen">` | native; **closes an item I-08B3.1-D0R handed forward as having no engine** |
| membership links / keel reveal | `stroke-dasharray` + offset | Skia `DashPathEffect`, or a trimmed path | dash offset animates cleanly on the UI thread. **All four links must be driven from ONE shared value**, not four — the equality is a semantic requirement (guard S3), and four independent values is how it would drift |
| the emerging node's blur | animated CSS `filter` | **crossfade between two pre-rendered layers** | see the hazard below |
| ink mixing per frame | JS `mix()` on hex | Skia's **`interpolateColors`** | see the hazard below |
| analytical text | DOM | React Native `<Text>` **outside** the canvas | see the hazard below |

**Hazard 1 — the animated blur.** `animate-expo` is explicit: never animate a blur's intensity on
Android, because it re-renders the blur every frame. The proof animates a radius because a proof
can. **Production must crossfade between two pre-blurred layers.** This applies to INSIGHT's
bridging blur and to the depth blur the inherited CONNECTION carries — the second of which is a
finding about the **selected** motion, not about anything D2 added.

**Hazard 2 — colour interpolation.** Skia stores colours differently from Reanimated and ships
its own `interpolateColors`; Reanimated's `interpolateColor` is documented as incompatible. This
renderer mixes ink on the neutral ramp **every frame**. A direct port that reaches for the
familiar function will render, and will be wrong in a way nobody sees until a screenshot is
compared.

**Hazard 3 — origin and units.** Every rotation in this scene is in **degrees** and every light
source is rotated about **its own centre**. Skia's rotations are in **radians** and a `Group`'s
transform origin is the **top-left**. Both of these produce a picture rather than an error.

**Hazard 4 — the canvas is one accessibility node.** A Skia `Canvas` exposes nothing inside it.
The analytical content — topic names, the new conclusion, the relation — must live in real
`<Text>` views composed over the canvas, which is also why this design keeps the field and the
type in separate layers. See `D2R_ACCESSIBILITY.md`.

---

## 4. Cost, by the things that actually cost

| Risk | This system |
|---|---|
| simultaneous animated objects | ≤ 6 light sources + 3 plane transforms + 1 node. Everything else is static |
| blur / shader cost | one Gaussian per light source, bounded radius, ≤ 6 at once, ≤ 900 ms |
| large glow areas | none. The largest source is 62 px radius on a 390 px-wide viewport |
| overdraw | the field is strokes and one faint fill per topic (alpha ≤ 0.05). Lights are additive over near-black |
| transparency | bounded: no stacked translucent surfaces. Apple's material guidance — *never stack a light translucent surface on another* — is not violated because there are none |
| mask cost | none. Reveals are dash offsets, not masks |
| frame-time stability | nothing allocates per frame; all geometry is constant |
| low-end Android | the degradation path is stated below |

**Degradation, in the order it should be applied.** Each step removes cost without removing
meaning, and the last one is still a complete expression:

1. drop the light-source blur to a cheaper approximation (fewer taps)
2. reduce PATTERN's four lobes to two and INSIGHT's five to three — the topology survives
3. drop the parallax differential (planes move together)
4. fall back to the **reduced-motion** expression, which is a designed complete alternative and
   not a stub

---

## 5. Device validation — defined, and honestly not performed

### The matrix

| Class | Device | What to measure |
|---|---|---|
| iPhone, ProMotion | iPhone 15 Pro or later | frame time against the **8 ms** budget 120 Hz implies; `CADisableMinimumFrameDurationOnPhone` must be set or iOS caps at 60 |
| iPhone, 60 Hz | iPhone SE 3 | 16 ms budget; blur cost |
| Android, modern | Pixel 8 | frame time; overdraw via GPU rendering profile |
| Android, materially weaker | a 3 GB device, 720p, Android 12 | the real target. Which degradation step is needed, and whether the reduced expression is the honest default there |

### What each run must record

visual fidelity against the shipped stills · frame time p50/p95 during each event · overdraw ·
Reduce Motion behaviour on the real setting · readability of Arabic at 200 % text size ·
**banding of the Light on an OLED at low brightness** — a near-black World and a low-alpha warm
light are exactly the pair that bands first, and no desktop check can stand in for it.

### What was actually done

**Nothing on a device.** No phone has seen any part of this package. Every figure above is a
count from this scene or a quotation from first-party guidance.

What *was* done, on this host: every frame rendered at 780 × 1688 through the same engine
(Chromium), 2,106 frames captured deterministically, and the determinism proved — the same
sequence captured twice, after five other sequences had used the same elements, with **0 of 210**
DOM digests and **0 of 210** rasters differing.

That proves the scene is a pure function of its state. **It proves nothing whatsoever about
frame time on a phone**, and `animate-expo`'s rule stands: feel is judged on a release build on
the slowest supported device, and nothing else counts.

---

## 6. What is realistic, per category

| | Verdict |
|---|---|
| **AMBIENT** | **Realistic, and the cheapest thing here.** Static geometry, one transform per plane, an Atlas-shaped problem |
| **CONNECTION** | **Realistic with one known cost**, inherited: the destination's depth blur is an animated filter and must become a layer crossfade. Recorded at I-08B3.1-D1 and unchanged |
| **PATTERN** | **Realistic.** Four bounded sources, one dash reveal driven from a single shared value, four strokes, four marks and a node |
| **INSIGHT** | **Realistic with one cost**, its own: the node's bridging blur, same treatment as above. Five sources is the highest simultaneous count in the system |

**Nothing in this design depends on a browser-only behaviour with no native equivalent.** The one
CSS property that had no engine — `mix-blend-mode: screen` on the identity mark — has a native
one in Skia, and that is what closes the open item D0R handed forward.
