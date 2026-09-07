# T-10.0 — A/B/C comparison matrix and critique

Status: **NO PRODUCTION MOTION FROZEN.** This is the shootout's reading of the captured runs; the
Motion North Star is the human's choice. Scores are 1–5 as §14 asks. Rows 12 and 13 are unscored
(no device on this machine; see Q9). Every score is tied to a scenario observation below, and every
observation is tied to a recording in `recordings/` or under `E:\QANDEEL\CW\_t10-captures\<run>\`.

## What was compared

Three directions over ONE truth substrate (the real store, T-04 placement, T-06 temporal layer,
T-08 chrome, one fixture world), five identical scenarios (S1–S5, `harness/scenarios.ts`),
plus a real-pointer drag, reduced motion, Arabic/RTL and the Ignition cue on/off. Every run was
driven in real Chrome over the DevTools protocol; the in-page meter (`useFrameCallback`) reports
the last second of frame times; the screencast gives the frames and, as a by-product, the repaint
rate.

| Run family | Runs | Recording |
| --- | --- | --- |
| Pan, release, interruption | `A/B/C-S1`, `A/B/C-drag` | `recordings/A-drag-real-pointer-150ms.png`, `C-drag-real-pointer-150ms.png` |
| Semantic Zoom / inspection | `A/B/C-S2` | `recordings/{A,B,C}-S2-semantic-zoom-250ms.png` |
| Timeline scrub | `A/B/C-S3`, `A-ar-rtl-S3` | `recordings/B-S3-timeline-scrub-400ms.png` |
| The six Return meanings | `A/B/C-S4`, `A/B/C-reduced-S4`, `B-ar-rtl-S4`, `A/B-ar-rtl-S4-chrome` | `recordings/{A,B,C}-S4-six-returns-600ms.png`, `A-reduced-S4-…`, `B-ar-rtl-S4-…` |
| Meaning Ignition | `A/B/C-S5` (cue OFF), `A/B/C-S5-ignition`, `C-ar-rtl-S5-ignition`, `B-S5-ignition-off-2` | `recordings/*-ignition-*-closeup.png`, `C-S5-ignition-450ms.png` |

The first capture batch ran with the Ignition cue OFF in every run because of a driver defect
(`06-review-log.md`); those runs are the cue-off controls, and the `-ignition` runs are the cue-on
evidence. Nothing else was affected.

## Observations per scenario (the facts the scores rest on)

### S1 / drag — pan, release, interruption

- All three: the plane is attached to the finger 1:1 (no easing on the drag path; identical code).
  A second finger stops the momentum where it is and takes ownership; no snap, no spring back.
- Momentum length is the only difference: B stops soonest (0.993), A mid (0.996), C glides longest
  (0.998; in `C-drag` the plane is still gliding 1.3 s after release).
- The scripted S1 commits exactly ONE `PAN` at rest in all three. The real-pointer runs committed
  two in A and C and one in B (Q1: the boundary depends on what the gesture stack reports).
- Reduced: shorter momentum, same 1:1 tracking.

### S2 — Semantic Zoom / inspection

- **A**: the ×8 reinforcement is one critically damped scale about the locus (460 ms); the other
  Homes slide out of frame; appearances fade in place and grow 0.9→1; zoom OUT is the reverse with
  the Homes sliding back in. Continuous at every frame (`A-S2` 3984→4485 ms).
- **B**: the appearances lead — they unfold from the Home along their tethers with a 36 ms
  stagger, and the scale follows 90 ms later (300 ms ease-out). Zoom OUT folds the appearances
  back into the Home, then the other Homes resolve in place (fade 340 ms) rather than sliding in:
  there is a ~250 ms beat where only the current Home is on screen (`B-S2` 4241 ms).
- **C**: the scale is a 0.86 spring (a visible overshoot past ×8 and back), appearances spring
  out of the Home (0.72, overshoot) with a 24 ms stagger, and every node breathes with plane
  speed. Zoom OUT has the same empty beat as B.
- Inspection ring and tethers are identical (not varied).

### S3 — Timeline scrub (non-drag walk 5 → 3 → 2, commit, preview 6, cancel, Return to Live Head)

- All three: what was bound later is simply not there — departures are removed on the next frame
  (no fade, no ghost) in every direction; arrivals resolve (A fade 160 ms; B unfold 260 ms with a
  28 ms stagger; C size spring). The preview veil (0.86) is faint but present. Commit is
  distinguishable from preview by the chrome sentence and the veil, not by camera motion. Return to
  Live Head moves NO camera in any direction (`B-S3` 7386→7800 ms: same frame, appearances return).
- B's temporal stagger is the one place a temporal change acquires an order on screen.

### S4 — the six Return meanings

| Act | A | B | C | Same in all three |
| --- | --- | --- | --- | --- |
| Return to Live Head (temporal only) | no camera motion | no camera motion | no camera motion | the world stays; only the disclosure changes |
| Return to Live Focus | slide + zoom settle | short slide / resolve-in-place when far | spring, carries velocity | lands on the LF Home |
| Go Live + Locate | temporal half, spatial half after 140 ms | after 260 ms | after 80 ms | when there is no legitimate landing (ungeographic LF) only the temporal half happens — no fake sweep (`*-S4` ~8500 ms) |
| Return to World | one damped zoom-out slide | zoom-out with in-place resolve | spring zoom-out | depth opening only, same TC |
| Back one step | slide to the captured viewpoint | slide / resolve-in-place | spring | continuity, not exactness |
| Exact Return | slide + ink lock frame 240 ms | + lock 280 ms | + lock 260 ms | history consumed to the origin (RH 7 → 2) |

- **A** keeps the world continuous across all six (`A-S4` 17113→17717 ms: the THREAD-rung nodes
  slide in from the world position).
- **B** replaces the long THREAD-rung flights (Back, Exact Return) with a resolve-in-place: the
  old set fades out, the new set fades in at the new place (`B-S4` 18473 ms shows the arriving set
  at partial opacity). It is calm and it is a fade-teleport.
- **C** has an empty beat on the depth-changing returns (`C-S4` 17339 and 18714 ms: an empty plane
  between the exit fade and the spring-in), and the arrival breath enlarges everything for a beat.
- Reduced (all three, one shared reduced profile): every flight is a cut plus a ~180 ms opacity
  resolve (`A-reduced-S4` 1192 ms: the arriving set at half weight); the lock frame is kept as
  opacity; destinations and store answers are identical to standard motion.

### S5 — Meaning Ignition (a Moment commits; an appearance becomes known in the inspected Thread; later a promoted Home appears at the WORLD rung)

- Cue OFF (`A/B/C-S5`, `B-S5-ignition-off-2`): the new appearance simply arrives with the
  direction's arrival recipe (fade / unfold / spring). It is easy to miss at the THREAD rung and
  invisible as an event at the WORLD rung.
- Cue ON: a brass ring expands from the new object over ~300 ms and is gone by ~1.1 s after the
  advance. **A** ring only (`A-S5-ignition-ring-closeup.png`); **B** ring plus a faint brass disc
  under the node (`B-S5-ignition-bloom-closeup.png`); **C** ring plus a neighbour breath that is
  not perceptible at this size (`C-S5-ignition-ripple-closeup.png`). The promoted Home at the WORLD
  rung ignites the same way (`B-S5-ignition-world-rung-closeup.png`), which is also an attention
  claim ("look here") on the whole world.
- Never fires on a scrub, a return, a tap or a zoom in any direction (by construction:
  `world-presence.ts` marks `ignite` only on `LIVE_ADVANCE` while following Live).

### Arabic / RTL (`A-ar-rtl-S3`, `B-ar-rtl-S4`, `C-ar-rtl-S5-ignition`, `A/B-ar-rtl-S4-chrome`)

- T-06's strip mirrors (ordinals run 6 → 1 right-to-left, the Live edge at the left); T-08's chrome
  renders the Arabic orientation sentence right-aligned and the Arabic Exact Return control with
  its hint (`B-ar-rtl-S4-chrome-1500ms.png`). The world plane is not mirrored (a map has no reading
  order); motion is identical. No direction has a reading-order dependency: B's unfold follows the
  tether geometry, and its stagger follows disclosure order, not screen order.
- The strip's own copy is English at the baseline (Q11).

### Performance (in-page meter, every clean run)

| Measure | A | B | C |
| --- | --- | --- | --- |
| Frames in the last second / avg / worst | 59–60 / 16.7 ms / ≤ 17.6 ms | 59–60 / 16.7 ms / ≤ 17.7 ms | 59–60 / 16.7 ms / ≤ 17.8 ms |
| Frames over 33.6 ms | 0 | 0 | 0 |
| Canvas repaints per second while the scenario runs (screencast) | 9–28 | 10–24 | 53–72 before the review fix; 22–33 after |
| Canvas repaints per second at rest | 2.2 | ≈ 2 | 53–72 before the review fix; **2.6 after** |

Before `/review-animations`, C repainted the whole canvas every frame at rest: its velocity
low-pass never reached zero, so `speed` changed by a hair each frame and every node's radius
(derived from it) invalidated the canvas. That was a defect, not a property of the field idea, and
it was fixed after the review (snap below 0.5 pt/s). While moving, C still derives every radius
from speed each frame, which costs nothing extra because a moving plane repaints anyway. A depth
change costs a ~190–220 ms main-thread stall in the dev bundle (all three; React reconciliation of
the new rung, not animation) — a production-build measurement is pending.

## Scores (§14)

| # | Criterion | A · Continuous Resolve | B · Semantic Unfolding | C · Field Resonance | Why |
| --- | --- | --- | --- | --- | --- |
| 1 | QANDEEL distinctiveness | 3 | **4** | 2 | A is precise but could be any well-made map. B's unfold-from-host and fold-back are the one motion idea that only QANDEEL's disclosure model can justify. C reads as a spring demo. |
| 2 | Premium feel | **4** | **4** | 3 | A: nothing moves that should not. B: the disclosure lead is the most considered moment in the set. C: two overshoots per zoom read as toy motion. |
| 3 | Spatial continuity | **5** | 3 | 4 | A never cuts. B cuts (resolve-in-place) on every long THREAD-rung flight in this fixture. C is continuous but arrives with an empty beat on depth changes. |
| 4 | Semantic clarity | 3 | **5** | 3 | A's fade says "appeared here", not "belongs to that". B says both, and the fold-back says "returns into its host". C says it too, then the ripple and breath add a claim the record does not make. |
| 5 | Temporal truth | **5** | 4 | **5** | Identical mechanics (instant departures, no ghosts, veil, no camera on temporal acts). B's 28 ms temporal stagger gives a set that arrived at once an order on screen. |
| 6 | Direct-manipulation quality | **5** | 4 | 3 | 1:1 in all three. A's momentum lands where a flick expects; B's is a touch short; C's glide is long enough that the commit boundary lands ~2 s after release. |
| 7 | Interruptibility | **5** | 4 | **5** | Grab-to-stop and act retargeting are shared. A and C carry velocity into the retarget; B restarts a timing curve, which shows as a small velocity break mid-flight. |
| 8 | Calmness over repeated use | **5** | 4 | 2 | A adds nothing per repetition. B's stagger is short but present on every scrub step. C breathes on every pan and overshoots on every zoom. |
| 9 | Hero-moment memorability | 3 | **4** | 3 | The ring is honest and small; the bloom is the most legible once-only cue; the ripple is memorable for the wrong reason (it makes neighbours react). |
| 10 | Arabic/RTL quality | 4 | 4 | 4 | Equal: the mechanics do not depend on direction; the one gap (English strip copy) is the baseline's, not a direction's. |
| 11 | Reduced-motion quality | 4 | 4 | 4 | One shared reduced profile: cut + resolve, fade-in-place arrivals, no stagger, no field, veil and lock kept as opacity. Return acts lose their explanation under a cut (Q5). |
| 12 | Android physical feel | — | — | — | Unscored: no device (Q9). |
| 13 | iOS feel where observable | — | — | — | Unscored: no device (Q9). |
| 14 | Implementation sustainability | **5** | 4 | 3 | A: springs and timings only, repaint on change. B: host lookups, ordinal bookkeeping, one threshold constant (1.25 diagonals). C: velocity tracking always on, every radius derived per frame while moving, distance work per node per ignition; the idle repaint storm turned out to be a fixable defect (see Performance), so C is scored on what remains. |
| 15 | Risk of decorative drift (5 = low) | **5** | 3 | 1 | A has nowhere to drift. B's stagger is one step from "stagger because a list exists". C is one step from "ambient breathing everywhere" and "floating field". |
| | **Total of scored rows (13 × 5 = 65)** | **56** | **51** | **42** | |

Totals are a summary, not the decision: row 4 alone is the reason B exists, and row 3 alone is the
reason A exists.

## The seven questions (§14)

**What becomes annoying after 10 minutes?** C's breath on every pan and its overshoot on every
zoom; C's glide when the reader wanted the world to stop. B's stagger on fast scrubbing (a set that
should snap into being arrives in a short sequence each step). In A, only the long empty flight
between THREAD-rung Homes (~0.5 s across nothing) — and only for a reader who jumps between
Threads often.

**What feels generic?** C as a whole (React Native spring demo; "living" UI). A's slide in
isolation (the fly-to of every map app). The zoom overshoot. The stagger, wherever it is not carrying
disclosure order.

**What feels like QANDEEL?** The unfold from the host and the fold back into it (B). The world that
refuses to move when the act has no landing — Return to Live Head, the temporal-only half of Go
Live + Locate on an ungeographic focus — which all three share because it is the substrate, not the
direction, and which is the most QANDEEL-specific thing on screen. The instant, unceremonious
disappearance of what a Moment did not yet know. The Exact Return lock frame (arguably).

**What motion communicates truth better than static UI?** The unfold from the host (an
appearance's origin is otherwise only a thin tether). The contrast between an instant departure and
a resolving arrival (what left vs. what arrived is legible without reading). Go Live + Locate's two
halves in sequence (the temporal half completes visibly before the spatial half starts, so a
landing-less Go Live reads as complete rather than broken). The preview veil (a previewed world is
visibly not committed).

**What motion is merely decoration?** C's velocity breath, arrival breath and ripple. C's
overshoots. B's temporal stagger. The lock frame is borderline (it draws chrome on the world; the
sentence already says "exactly here"). The Ignition disc under the node (B) adds little over the
ring.

**Which parts should be hybridized?** A's camera (critically damped travel and zoom, no delay,
no cut, momentum 0.996) with B's DEPTH disclosure recipes (unfold from the host with the stagger,
fold back on exit) — and B's temporal recipes replaced by A's (fade in place, no stagger). From C,
at most the velocity carry-over into a travel spring when an act interrupts momentum (a camera
property, not a field response). Ignition, if kept: A's ring or B's bloom, once, local; never the
ripple.

**Which signature should be rejected completely?** C's field response (size follows speed) and
its ripple; B's resolve-in-place as a default for long flights (a cut is a Product decision, Q2,
not a motion default); the overshooting zoom; any Ignition on a scrub, a return or a tap (already
impossible by construction, and it should stay impossible by contract).

## The §15 hypothesis, tested

§15 asked whether the best direction is A's spatial continuity and calmness + B's disclosure
behaviour + a very small amount of C's field response + rare Meaning Ignition.

- **A's spatial continuity and calmness — supported.** Row 3, row 8, row 15; no run showed A
  doing something a reader would want undone.
- **B's disclosure behaviour — supported, for depth disclosure only.** Row 4 is the largest single
  gain in the matrix. B's temporal stagger is not supported (row 5).
- **A very small amount of C's field response — NOT supported.** The smallest response tested
  (+5 % size per 1000 pt/s) already makes size mean speed on a surface where size may mean nothing;
  a smaller amount would be imperceptible and a perceptible amount carries meaning. (The repaint cost
  first attributed to the field was a fixable defect, so the objection rests on meaning, not on
  cost.) What survives from C is not a field response: it is velocity carry-over into a travel
  spring, which belongs to the camera.
- **Rare Meaning Ignition — supported only in its narrowest form.** Once, local, at the object,
  ring or bloom, never a ripple, never at a scrub/return/tap; and the WORLD-rung case (a promoted
  Home igniting) needs an Architecture answer because it is an attention claim on the whole world
  (Q4). The prototypes do not decide whether the cue should exist; they show that if it exists it
  must be this small.

So the hypothesis holds in three of its four parts and is disproved in the fourth.

## Recommendation (not a freeze)

**A-camera + B-depth-disclosure**, with the temporal recipes from A, no field response, and
Ignition kept as a switchable ring/bloom pending Q4. Concretely, from `profiles.ts`:

| Aspect | Recommended source | Note |
| --- | --- | --- |
| Pan release, cancel | A (0.996, spring 320/1) | Q1 decides the commit boundary |
| Zoom | A (spring 460/1, no delay) | Q3 decides whether the reinforcement is visible at all |
| Travel | A (spring 380 + 0.28 ms/pt, max 560, ratio 1); consider C's velocity carry when interrupting momentum | never resolve-in-place by default (Q2) |
| Depth disclosure | B (from-host 340 ms, stagger 36 ms; fold back 180 ms) | the signature |
| Temporal arrival/exit | A (fade 160 ms in place; exit instant) | no stagger on a temporal set |
| Go Live + Locate spatial delay | between A and B (140–260 ms) | the temporal half must read as complete first |
| Field | none | rejected |
| Ignition | A ring or B bloom, ≤ 560 ms, once | Q4 |
| Exact Return lock | keep as a candidate | Q7 |
| Reduced motion | the shared reduced profile | Q5 for the Return acts |

If the human prefers a single direction as built, A is the safe North Star and B is the
distinctive one; C should not be chosen as built.

## Design-critique record (the `design-critique` framework, applied to the filmstrips)

**Overall impression.** Three directions that genuinely differ on a named axis each, over
identical truth; the differences are visible in the filmstrips without narration. The biggest
opportunity is the hybrid above; the biggest risk in the set is C's drift toward a living-field
aesthetic the anti-pattern list names explicitly.

**Usability.** 🟡 B's resolve-in-place can read as "the app jumped" on Back — moderate; fix by
never cutting by default. 🟡 C's late commit boundary after a long glide — moderate; fix by A's
decay. 🟢 The empty beat on zoom-out in B and C — minor; fix by letting the arriving Homes start
their fade with the exit rather than after it.

**Visual hierarchy.** The eye goes first to the inspected ring, then to the appearances; correct.
In C the eye is pulled by whatever breathes; incorrect. Whitespace is the world; every direction
leaves it alone.

**Consistency.** Every act of one kind uses one recipe within a direction; the reduced profile is
shared; durations are per act, not one for all. The one inconsistency inside a direction is B's
long-flight cut versus its short-flight slide (a threshold, not a grammar).

**Accessibility.** No information is carried only by standard motion: every arrival also fades,
every departure is a removal, the veil and lock are opacity, T-04's accessible Map and T-06/T-08's
routes reach the same executors. Reduced motion is a real alternate choreography. The Ignition cue
is brass on warm grey at ~0.9 opacity for a beat — it is decorative, so contrast is not a
requirement; nothing depends on seeing it.

**What works well.** The substrate rules (no camera on temporal acts, no fake sweep on a
landing-less Go Live, instant removal of the not-yet-known) are the same in all three and they are
the strongest thing on screen. The re-based residual makes every canonical change frame-continuous
regardless of direction.

**Priority recommendations.** (1) Take the hybrid to the human review with the seven questions
answered above. (2) Get Q1–Q4 answered by Architecture before production T-10 assumes any of
them. (3) Measure one direction on a device before scoring rows 12 and 13. (4) Whatever is
chosen must meet the `/review-animations` conditions in `06-review-log.md` (critically damped
settles wherever a finger is not involved, no default cut on long flights, no temporal stagger,
velocity carried through an interruption, cancel settles that snap).
