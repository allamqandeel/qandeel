# I-08B3.1-D2R — MOTION LIFECYCLE AND REDUCED MOTION

---

## 1. The lifecycle, in milliseconds

Every meaning event in QANDEEL runs the same three beats. The numbers are I-08B3.1-D1's, which
the Product Owner has already watched; D2 does not retune them.

```
EMERGE ─────────────────► CRYSTALLIZE ─────────────► SETTLE
 260 ms rise               begins BEFORE emerge         1,150 ms fall
 smoothstep                has finished                 cubic-bezier(.38,0,.32,1)
                                                        to EXACTLY zero
```

**The rise and the fall are different lengths on purpose**, and the asymmetry is a stated
position rather than a default. The craft guidance says to make the exit faster than the enter.
This inverts the second half of that, deliberately: here the "exit" is not a dismissal the user
asked for — it is the world returning to rest after an answer, and a snappy fall reads as the
insight being **retracted**.

**Crystallization overlaps emergence.** The first build ran them in sequence and the middle of
the event was a bare line on a dead field. Convergence and crystallization are not two things
one after another; they are one thing seen twice.

**The fall reaches exactly zero**, not nearly zero. Check **C3** walks all six event sequences
past 5,800 ms and the largest surviving transient value in any channel is `0`.

### Two speeds, and why

| | Scale | Used by |
|---|---|---|
| default | 1.00 | CONNECTION — one travelling point between two words |
| large | 1.25 | PATTERN, INSIGHT — spanning much of the map, several simultaneous sources |

Material 3's motion system ships three speeds of one spring for exactly this reason and states
it plainly: *"Most motion should use the default speed, while smaller elements may use fast and
larger elements may use slow."* The **shape** is untouched — same envelope, same two curves, same
exact zero. One scalar, declared once, with a reason.

### Why this is a curve and not a spring

Material 3 replaced its easing-and-duration system with springs in May 2025, so the question had
to be asked. The answer comes from M3's own split: **SPATIAL** springs "overshoot the final value
and bounce into place"; **EFFECTS** springs are for "color and opacity animations, where there
shouldn't be any overshoot."

Light intensity is an effect in exactly that sense. An overshoot there would be the insight
arriving, retracting and arriving again — and a bounce is delight, which `animate` permits only
at the rare/first-time tier.

**SPATIAL MAY OVERSHOOT. LIGHT MAY NOT.** The one place D2 uses momentum physics is the ambient
pan, which is a gesture, and there it uses Apple's projection function rather than any curve.

---

## 2. What each category does, named in the craft's own vocabulary

Named with the terms the glossary already has, so each can be checked against what it claims to
be — and so a prohibited effect is recognised if it is ever arrived at under a friendlier name.

**AMBIENT** is **PARALLAX** over a static field. That term is in the glossary's *Scroll* section,
not its *Looping & Ambient Motion* section, and the distinction is the whole design: it is motion
tied to navigation, which a user causes, rather than motion that runs on its own.

**CONNECTION** is inherited and named in I-08B3.1-D1: a crossfade bridged by blur, with
follow-through, over a travelling line.

**PATTERN** is **ORCHESTRATION** of a **LINE DRAWING**, and deliberately **without a STAGGER** —
four contractions toward an authored locus, the locus resolving, then four membership links
drawn outward from it **simultaneously**, then four identical marks.

**The absent stagger is the one craft default this category inverts.** The house guidance calls
simultaneous entrance a defect, and it is right about lists of unrelated items. This is one
object with four arms, and **a stagger is an ORDER** — which the Product does not have, because
what it knows is a set. Equality outranks the default, and the inversion is recorded here rather
than quietly taken. I-08B3.1-D2 staggered them at 0.11 of the span; that was a sequence nothing
authorised.

**INSIGHT** is a **REVEAL** bridged by **BLUR**, with **FOLLOW-THROUGH** — five lobes gathering
inward, a node resolving out of the gathering, a keel drawing beneath it, a 3 px rise that
settles.

**None of the four is a PULSE, a RIPPLE, a FLOAT, an ORBIT, an IDLE ANIMATION, a SHIMMER, a
MARQUEE or a LOOP** — every one of which is in the glossary's looping or loading sections, and
every one of which this brief forbids.

---

## 3. Reduced motion: four real counterparts

### Why it is four functions and not a flag

Reanimated's own behaviour table is the argument. With the setting on, `withTiming` and
`withSpring` **"return the `toValue` immediately"**, entering animations **"instantaneously reach
their endpoints"**, and exiting animations **"are omitted"**.

So a global `ReduceMotion.System` does not make an event gentler. **It makes it a cut.** The
event stops existing rather than becoming quieter, which is precisely the failure §14 names.

### What each counterpart keeps and what it drops

Decided from Apple's list rather than by feel. Under Reduce Motion, Apple asks for *"reducing
automatic and repetitive animations, including zooming, scaling"*, for *"Replacing transitions in
x-, y-, and z-axes with fades"*, and — the one that cost this package a real correction — for
*"Avoiding animating into and out of blurs."*

| | Kept | Dropped |
|---|---|---|
| **AMBIENT** | the field, entire; 1:1 panning | the parallax **differential** (all planes at the near rate) and the momentum glide |
| **CONNECTION** | D1's counterpart, entire | **the bridging blur** — see below |
| **PATTERN** | four lights rising and falling **in place**; the locus resolving; the links and marks arriving by opacity at full length | convergence, contraction, the wipe |
| **INSIGHT** | five lights at their arrived positions; the node arriving by opacity, **sharp**; the keel | the gather, the contraction, **the blur entirely** |

The principle underneath: **keep LEVEL, INK and DRAW; drop TRAVEL, CONTRACTION, SCALE and BLUR.**
The meaning survives because the meaning was never in the travel. What a user has to end up
knowing is *which* things, *what* structure, and *that* it is settled — and all three are states.

### Two details that are the rules taken literally

**The links do not wipe.** In the reduced counterpart they are present at full length from the
first frame they exist and arrive by opacity alone. A wipe is motion across the screen; a fade is
not.

**The map stops where the finger let go.** `withDecay` under reduced motion "returns the current
value immediately", so there is no momentum glide — not a shortened one, none. That is the rule's
real behaviour rather than an approximation of it.

### The correction to the inherited counterpart

D1's reduced-motion Connection keeps its bridging blur, with a good craft reason. Apple's list
says not to. §14 puts reduced motion inside D2's remit, so **one channel** was corrected:
`receptionBlur`, peak 0.7988 → **0.0000**, in the reduced counterpart only.

Check **C2** measures it: exactly one channel differs from D1's function, and the full-motion
Connection is byte-identical to D1's at all 210 frames (**C1**).

### What is proved about all four

**C8** — every counterpart reaches the **same settled residue** as its full-motion sibling, and
there are **0** frames in any of them in which a light moves.

**R3** — the settled frames of every sequence, full-motion and reduced alike, are byte-identical
to each other. **The end state does not depend on which version you saw.**

`frames/proof/D2_REDUCED_MOTION_PAIRS.png` puts each pair side by side at the same millisecond.

---

## 4. What motion is never allowed to do here

From §13 of the brief, with what enforces each:

| Motion must not | Enforced by |
|---|---|
| invent a relation | PATTERN draws MEMBERSHIP only; nothing about it is derived from screen positions (**C5**) |
| imply unavailable knowledge | no ambient property encodes a quantity (gate 6, **S1**); no link is a strength (**S3**); every topic is named (**S4**) |
| create fake importance | every ring on a layer is the same chroma and lightness; the settled residue carries no emphasis |
| leak future knowledge | the INSIGHT site is empty before the event and nothing anticipates it (**C6**) |
| substitute animation for actual Product state | every settled state is readable with no animation, and is byte-identical across sequences (**R3**) |
