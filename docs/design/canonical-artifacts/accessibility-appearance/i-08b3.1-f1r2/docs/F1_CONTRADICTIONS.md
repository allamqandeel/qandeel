# I-08B3.1-F1 — GENUINE PRODUCT CONTRADICTIONS DISCOVERED

§27 asks for contradictions found, not for a clean report. These are the four, in order of how
much they matter.

---

## C-1. "INCREASE CONTRAST" AND "MEANING EARNS EMPHASIS" ARE INCOMPATIBLE UNLESS BOTH MOVE

**The contradiction.** The obvious reading of Increase Contrast is *raise the things that are
hard to see*. Do that to its limit in QANDEEL — every ambient contour at full opacity, no colour
changed at all — and the analysis-to-atmosphere ratio falls from **1.2914 to 1.028**. The quiet
thing arrives at the strength of the meaningful thing, and I-08B3.0's **MEANING EARNS EMPHASIS**
and **QUIET BEFORE LUMINOUS** are both broken by an accessibility setting.

**Why it cannot be dodged.** Reaching for the next lever makes it worse: the atmosphere's near
ink already sits at OkLCh **L 0.6206** against the analytical relation's **L 0.6297**. There is
**no headroom** between atmosphere and analytical ink, so raising one without the other is not
available.

**The resolution F1 shipped.** Both move, and analysis moves further:
`qandeel.analysis.relation` is re-routed one rung up the **frozen** reading ramp, 5.44 → 8.38,
and the ratio becomes **1.524** — wider than the default. No literal is introduced.

**What is handed up.** The resolution works because the ramp had a rung above tertiary. If a
future Increase Contrast needs to move a class that is **already at primary**, the ramp has no
higher rung and this technique runs out. That is a real ceiling on the method and Product should
know it exists.

---

## C-2. THE ACCESSIBLE SCRIM IS MORE FAITHFUL THAN THE DEFAULT ONE

**The contradiction.** I-08B3.1-B4R says the PASSAGE scrim expresses **WORLD SUPPRESSION**, and
that *"background legibility is not one of its duties, because the World behind a PASSAGE is
suspended."* A translucent scrim leaves a suspended World faintly visible. **An opaque one does
not.**

So under Reduce Transparency, QANDEEL states its own intent **more plainly than it does by
default**.

**Why this is not a win.** An accessibility expression should transform how something is
expressed, not correct it. If the opaque scrim is the more faithful expression of the contract,
the question is about the **default**, and F1 has no authority over the default scrim.

**Handed up to Product and to the B-track.**

---

## C-3. THE PRODUCT OWNER'S NORTH STAR AND THE FROZEN CHROMA CEILING ARE 3.69× APART

**The contradiction.** §0 sets the North Star as the emotional ceiling and insists the World must
not become visually timid. Measured, the authored atmosphere chroma ceiling is **0.0197** against
a North Star 95th-percentile chroma of **0.0727** — **×3.69**. On density the distance is larger
still: thousands of points against eight topics.

**Why F1 cannot act on it.** The ceiling is I-08B3.1-D2R's, derived at 0.62 of the minimum chroma
of the three QANDEEL LIGHT stops so that **ATMOSPHERE can never compete with LIGHT**. It is a
semantic separation. F1 is forbidden from touching it, and *raising it under an accessibility
banner would be exactly the kind of design change wearing an accessibility name that §25
forbids.*

**What F1 can say honestly.** F1 did not create the distance, did not widen it, and cannot close
it. The measurement is in the package with its decomposition — and the important correction is
that **most of the headline gap is framing**: among painted pixels the distance is **×1.41**, and
QANDEEL's own error ink is **more** chromatic than the North Star's 95th percentile. The narrow,
real gap is the atmosphere ceiling and the field's **density** — and density is constrained by no
token anywhere.

**Handed up as the first item of the F2/Product carry-forward.**

---

## C-4. THE REDUCED-MOTION RUNTIME DEFAULT VIOLATES THE REDUCED-MOTION CONTRACT

**The contradiction.** QANDEEL's contract says a meaning event under Reduced Motion becomes
**gentler**, keeping level, ink and draw. Reanimated's default — `ReduceMotion.System`, applied to
every animation — makes it a **cut**: entering animations jump to their endpoints and **exiting
animations are omitted entirely**, which deletes the 1,150 ms settle that carries the result.

So *the obvious, documented, library-default integration produces exactly the failure §25
names*, and it does so silently.

**The resolution.** The replacement animation is declared `ReduceMotion.Never` and the suppressed
channels are switched off at the **value**, from `qandeel.accessibility.motion.*`. The token file
carries a scalar named `system-default-is-wrong-here` so this cannot be filed as an
implementation detail.

**Why it is still a contradiction.** It means **every** QANDEEL animation must opt out of the
library's accessibility mechanism in order to *be* accessible. That is fragile: a new animation
written the ordinary way will be wrong, and nothing in the toolchain will say so. A lint rule or
a wrapper is a real engineering requirement, and it is in the carry-forward.

---

## And one that turned out NOT to be a contradiction, recorded because it looked like one

**Reduce Transparency versus the Living Analysis World.** The expected conflict was that removing
transparency would flatten a World built out of composited atmosphere. It does not: the field is
composited against **one flat opaque colour**, so every stroke has a **closed-form opaque
equivalent**. The field is not simplified, it is **pre-resolved** — the same pixels by a different
mechanism.

The conflict that was expected to be hardest turned out to be arithmetic.
