# QANDEEL — Living Analysis Map Motion System v1

**Task:** T-10 · **Status:** production candidate, pending independent Architecture + Motion review
**Owner:** `apps/mobile/src/motion/**` (presentation only)
**Gate:** `tests/t10-motion-contract.test.mjs` (`npm run test:t10-motion-contract`)

---

## 1. The North Star

> **Nothing teleports. Meaning resolves.**

The world is one persistent place. A reader who goes somewhere in it should understand *I moved
inside the same world*, never *the screen changed*. The result should feel as if the world remembers
where the reader was — not as if the interface is performing a transition.

Three sentences carry the whole system:

- **Gesture owns the frame while the finger is down.** Finger movement is visual movement: 1:1, on
  the UI runtime, with no easing, no smoothing and no spring arguing with the hand.
- **Product owns the destination; motion owns only the path.** Every act is already true in
  canonical state before any motion explains it. An animation that never finishes changes nothing.
- **Departures are hard; arrivals are earned.** An object the current `V` no longer discloses is
  gone in the same commit. An object that IS in the current `V` may resolve into legibility.

---

## 2. Production vocabulary

Six named roles. No profiles, no personalities, no universal duration.

| Role | Where | Character |
| --- | --- | --- |
| **M0 direct manipulation** | Map pan, Timeline scrub while a finger is down | 1:1, UI runtime, **0 ms** easing |
| **M1 acknowledgement** | T-08 pressables | Immediate state swap; never an animation |
| **M2 temporal resolve** | A committed temporal change | Local, ~**160 ms**, no camera motion |
| **M3 semantic disclosure** | NEW analytical detail becoming legitimate | ≤ **220 ms**, reinforcement ≤ **300 ms**, overlap ≤ **60 ms** |
| **M4 spatial travel** | An already-authorized camera landing | **260–380 ms**, exceptional flight ≤ **540 ms** |
| **M5 Meaning Ignition** | — | **Absent in v1.** No authoritative trigger exists. |

One easing curve, everywhere: `cubic-bezier(0.23, 1, 0.32, 1)` — a strong ease-out. Never `ease-in`:
a slow start delays the exact moment the reader is watching. Every act-driven motion is critically
damped (`dampingRatio: 1`): with no finger on it there is no momentum to carry and nothing to
overshoot for, and an overshoot would draw the camera momentarily past a position nobody authorized.

Tokens live in `apps/mobile/src/motion/tokens.ts`, which imports nothing at all.

---

## 3. Q1–Q8, as built

| | Decision | How it is true |
| --- | --- | --- |
| **Q1** Pan with momentum | **No canonical momentum.** ONE completed drag → ONE `PAN`, at the actual gesture end, from the finger's reported total translation. | The drag writes only the presentation residual. `panByTranslation` is called once, from `onEnd(success)`. A cancelled, failed, never-activated or unmounted gesture dispatches nothing. `withDecay` exists nowhere in production. |
| **Q2** Long same-world travel | **Always travels; never cuts.** Distance-responsive, critically damped, interruptible; long flights approach a 540 ms ceiling. | `travelDurationMs` is monotonic and capped. `CUT_AND_RESOLVE` has exactly two causes, and "far" is not one of them. |
| **Q3** Semantic Zoom reinforcement | **Kept, and it follows the disclosure.** Detail resolves ≤ 220 ms; the geometric reinforcement starts within 0–60 ms and completes ≤ 300 ms. | The plan gives the reinforcement the disclosure budget on a rung change, and a delay that can never exceed 60 ms. |
| **Q4** Meaning Ignition | **`MEANING_IGNITION_TRIGGER_DEFERRED_TO_T12`.** | See §8. |
| **Q5** Reduced Motion | **Cut + local opacity resolve.** Same acts, same destinations, same availability, same copy. | The plan zeroes every x/y/z duration and keeps a 140 ms opacity resolve, which is not movement. Direct finger tracking stays 1:1. |
| **Q6** Preview veil | **Rejected.** The world's opacity never changes because a Preview is open. | The motion owner cannot see a Preview at all: no import, no snapshot, no controller. |
| **Q7** Exact Return lock frame | **Rejected.** | Exact Return shares M4 with Back. Its exactness is in the captured tuple, the final geometry and T-08's wording. No frame, border, brass or special plan field exists. |
| **Q8** Field response | **Rejected completely.** | No velocity is measured anywhere, so nothing can follow it. No neighbour is reachable from any primitive, so nothing can respond to one. |

---

## 4. The Scene Truth Cut / Camera Continuity split

This is the production rule the whole task turns on.

**Membership is immediate.** At any committed semantic, temporal or depth change, visible membership
switches to the current authorized `V` in that commit. There is no old-scene crossfade, no exit fade,
no fold-back, no retained screenshot and no ghost.

This is architectural rather than disciplined: **there is no exit path to fail**. An object that
leaves `V` leaves the placement, so React unmounts it with the commit that removed it. A crossfade
would have to be *added* to break the rule, and the static gate refuses the shapes that could add one.

**Camera continuity is presentation.** The residual between the canonical camera and the glass is:

```
screen(p) = c + zoom · (p + t − c)
```

On an already-authorized canonical change the residual is REBASED so the frame on the glass is
preserved exactly, then resolved toward canonical truth:

```
zoom' = zoom / k          t' = k · (t + d)
```

`k` is points-per-world-unit new-over-old (a rung deeper is exactly `8`); `d` is where the new anchor
*was* on the old screen. The invariant is machine-checked: applying the rebase to `placeScene(scene,
AFTER)` reproduces `placeScene(scene, BEFORE)` for every canonically placed node, at any distance and
any scale ratio. Nothing about that depends on timing, so the one-frame cluster is impossible while
the rebase is armed, rather than merely unlikely.

Two consequences fall out of the same arithmetic:

- a completed drag commits the finger's own translation, so `d ≈ −t` and the rebased residual is
  ~zero — **the world holds its place at release.** QANDEEL is not a slippy map;
- a change arriving mid-travel rebases the residual *that is on the glass*, so travel **retargets
  from where the plane actually is.** There is no queue anywhere in the system.

### The Skia inner-root ordering trap

The Skia canvas reconciles its children in its own React root, which commits after the surrounding
surface's. A rebase issued from the surface reaches the renderer one paint before the new positions —
and that paint draws the old positions under the new residual. The rebase is therefore issued from
`PresentationCameraRebase`, a **child of the transformed plane and the last one**, in a layout effect
of the same inner commit that writes those positions. The static gate pins that position.

---

## 5. Return choreography

Five of the six need no cause at all: their choreography is read from what actually changed in
canonical state, which is a reading of truth rather than a claim about intent.

| Act | Camera | What is shown |
| --- | --- | --- |
| `RETURN_LIVE_HEAD` | none | Temporal only. **Zero camera travel** — not a travel of zero length; no rebase happens at all. |
| `RETURN_LIVE_FOCUS` | one-shot spatial | M4 travel when a legitimate landing exists. `TC` untouched. No landing → no camera movement of any kind. |
| `GO_LIVE_AND_LOCATE` | conditional spatial | The temporal half lands, then a **110 ms** explanatory beat, then M4 — when there is a landing. No landing → zero spatial phase, and the interaction is still complete. |
| `RETURN_WORLD` | authorized World/Z0 target | Rung opens; the presentation adds nothing to the anchor the act landed on. Already at that camera → nothing travels, and the rung change is shown by disclosure alone. |
| `BACK_ONE_STEP` | captured tuple | M4 where the camera differs, reinforcement where the rung differs, M2 where `TC` differs. Interruptible throughout. |
| `EXACT_RETURN` | captured tuple, exactly | The same vocabulary as Back. No lock frame, no ink, no brass. |

The **motion cause channel** (`createMotionCauseChannel`) exists only for the composite beat. It is
written from an outcome T-07 has *already returned*, exactly as T-08's `onReturnOutcome` reports it;
it is one-shot, cleared on read, and armed by nothing else. A refused or no-op act arms nothing.

T-08 needed no change: `onReturnOutcome` already exists on `OrientationChrome`.

---

## 6. Semantic Zoom choreography

**In.** The new `V` is authoritative at the commit; objects no longer disclosed are gone. Newly
disclosed detail resolves from its **true hosting locus** — out from the Home that hosts it, along
the very tether the renderer is drawing beside it — starting at scale `0.92`, never from zero. The
frozen ×8 geometric reinforcement overlaps that disclosure by at most 60 ms, and the lead and the
duration are one 320 ms budget rather than two.

Every standard-motion arrival carries that entry scale, travelling or not: a pure opacity fade with
no initial transform reads as an object materialising rather than resolving. Reduced motion is the
one exception, and it is the rule working — movement is what gets removed there.

The origin is read from the same placement the tether comes from, so an arrival can never travel
along a relationship the renderer is not showing. **No disclosed host → a truthful in-place resolve**,
which is the answer rather than a fallback. Thread Homes and ungeographic register entries always
resolve in place: they have no host, and inventing one would draw a relationship the record does not
state.

**Out.** The shallower `V` wins immediately. Detail that is no longer current disappears; it is never
animated back into its host. Continuity comes from the surviving Home, the reinforcement, and the
newly current shallower objects resolving in.

**No stagger, ever.** Same-truth arrivals begin together, because the record says they became known
together. The arrival plan has no delay, index or ordinal field for an order to live in.

---

## 7. Reduced motion, RTL and accessibility

**Reduced motion** is *fewer and gentler*, not zero. Every x/y/z travel becomes a cut plus a 140 ms
opacity resolve; arrivals keep the opacity bridge and drop the movement in it; direct finger tracking
stays 1:1. The same Return set is offered, the same canonical state is reached, and no copy changes.
The opacity resolve is explicitly `ReduceMotion.Never`, or the one thing left explaining that the
reader went somewhere would never play.

**RTL.** The Map is a world, not reading-order content, and it is not mirrored. No module in the
motion owner knows about writing direction, mirroring or a side of the screen: the drag is physical
(the plane follows the finger), and placement runs from canonical `bigint` addresses through one
transform with no branch on language or direction. T-06's single presentation-geometry rule continues
to own the Timeline's mirroring.

**Accessibility.** Every act keeps a non-drag route through `MapAccessibilityLayer`, and none of them
waits for an animation. The layer is now `pointerEvents="box-none"`: it covers the whole plane for
assistive technology while never being able to take a touch from the world underneath — a real
Android hazard the frozen layer was exposed to. Paint, hit testing and the accessible tree share one
placement *and* one residual, so a touch mid-travel selects what the reader is looking at.

---

## 8. Meaning Ignition disposition

**`MEANING_IGNITION_TRIGGER_DEFERRED_TO_T12`.**

§5 Q4 permits the cue only if a current public owner already exposes an authoritative cause proving
all thirteen conditions. It does not. Canonical state exposes `live.LH` and the temporal mode, but
nothing distinguishes *a committed live advancement that newly disclosed this exact object at
`K(LH)`* from *a fetch completing*, *a projection being replaced*, or *a remount* — and conditions 4,
5 and 11 turn precisely on that distinction. Inventing a trigger would make motion the authority for
a Product claim, which §2.4 forbids.

So no cue ships, and no dormant one either. The absence is structural: the motion owner cannot
observe a live advance, a Live Focus transition or a fetch at all, so a cue cannot be wired to one
later by accident. A65–A72 are satisfied by that structure rather than by a disabled flag.

---

## 9. Performance notes

- **No per-frame canonical write, no per-frame JS schedule, no per-frame React state.** A 60-frame
  drag costs zero React renders and zero crossings to the Product runtime; the single crossing is at
  the end of a completed gesture.
- **No idle repaint.** Nothing samples velocity, so there is no filter chasing an epsilon it never
  reaches. A residual below 1/1024 point is rest, and rest issues no animation at all.
- **No wrapper for a still world.** An object that is not arriving renders with no group, no opacity
  layer and no derived value attached to anything — the first painted world costs exactly what it
  cost before this task.
- **Arrival recipes are frozen at mount**, so a later canonical change (which moves every node) does
  not rebuild one derived value per object for a resolve already at rest.

---

## 10. Physical-device items still pending

`PHYSICAL MOTION REVIEW PENDING`. This machine has no Android SDK, no emulator and no Xcode; every
local observation is from Jest and from code. Exact-head Android and iOS CI prove build, install and
boot integrity, not feel. Open for device review:

1. **Perceptual parity of the 260–540 ms travel band** on a mid-range Android and on iOS.
2. **The commit acknowledgement's perceptibility.** Raised from 6 % to 9 % scaleY on the strength of
   the T-10.0 carry-forward; only a device can confirm it reads as an acknowledgement, not a wobble.
3. **Android velocity/continuity feel** during a drag and at release. No platform-specific tuning
   constant ships: without a device, a magic Android multiplier would be a fabrication, not a fix.
4. **RTL Arabic 1:1 scrub tracking** on hardware.
5. **The T-10.0 ~190–220 ms depth-change stall** measured in a dev bundle. It was React reconciliation
   of the new rung, not animation; it must be re-measured on a release build before it is treated as
   a production defect.
6. **Interruption feel.** Retargeting is positionally continuous by construction, but it does not
   carry velocity: measuring velocity costs a per-frame callback the performance gate rejects. Only a
   device can say whether the seam is visible when one act interrupts another mid-travel.

---

## 10a. What review changed

Four defects were found by looking at the motion rather than at the tests. All four are now pinned.

| Found by | Defect | Fix |
| --- | --- | --- |
| the running visual proof | The plane's residual zoom scaled every object with it, so a depth step shrank the world to an eighth and grew it back — an optical zoom wearing Semantic Zoom's clothes | `counterScale`, applied per object about its own centre and to the tether stroke |
| `design-critique` | The 60 ms reinforcement lead was added *on top of* 300 ms, putting a depth step at 360 ms against a 320 ms budget | lead + duration are one budget; reinforcement 300 → 260 ms |
| `/review-animations` | An in-place arrival had become a pure opacity fade with no initial transform — a comes-from-nowhere | every standard arrival carries the entry scale again |
| `/review-animations` | The cut-and-resolve re-seeded its dip on every act, so two acts inside one resolve read as a blink | `resolveFromOpacity` retargets from the weight on the glass |

The third one reversed a change made one pass earlier on an aesthetic argument. The review was
right and the argument was wrong: the two kinds of arrival are already legibly different because
one travels along a real tether, and that difference is the part the record justifies.

### R3 — the final path

R1 and R2 corrected the seams. R3 corrected the transitions those seams actually run on, and every
one of them was invisible to a passing test because the tests exercised a prop replacement where the
Product performs a canonical handoff.

| Defect | Fix |
| --- | --- |
| A real temporal or depth commit makes this Map's context stale before the fresh one arrives, and the disclosure record was erased in that gap — so Semantic Zoom, a committed temporal move and every Return that changes `TC` or depth compared the new world against nothing and disclosed nothing | the record survives a technical stale handoff. It is EVIDENCE, not a world: identities only, no geometry, no pixels, no entitlement, never painted. Only a replaced authority erases it |
| Membership was read from a PLACEMENT, which omits a locus the camera cannot finitely project — so a locus that merely became representable read as newly known | membership is derived from the `MapScene`, through the same key definition that names a painted node |
| The travel corridor never retired: the widened candidate set of the last movement stayed alive for the life of the surface | a threshold reaction on the residual retires it at rest, epoch-guarded. It is not an animation completion and it reaches no Product state |
| A mid-flight retarget computed culling from rest while the camera rebased from the frame on the glass — two different states, so the renderer could cull an object that was visibly on screen | the corridor is an ENVELOPE, rebased exactly as the residual is. Whatever the plane shows is inside it by construction, with no shared value read during render |
| The endpoint box was not a bound. Translation and reinforcement animate independently, so the product of two monotone factors can reach a screen position neither endpoint represents — critical damping proves nothing about it | interval arithmetic over the component RANGES. It answers for every assignment at once, so timing, delay and lead cannot make it wrong |
| An unrepresentable transition returned `AT_REST`, so the world changed viewpoint with no travel, no dip and no resolve — a bare, uncovered cut | representability is asked before rest. Such a change is a `CUT_AND_RESOLVE` with a zero beat, so the cut and the dip that covers it land in the same frame |
| The dip's depth was derived from the weight already on the glass. R2 caught half of it — with a beat the sample is stale by the time it lands and drops the plane backwards — and the branch that fixed the blink opened a worse hole: a cut arriving late in a running resolve was covered by whatever remained, which at 0.99 opacity is nothing. Under reduced motion every travel is a cut, so that was the ordinary case | the dip is the constant `REDUCED_RESOLVE_FROM_OPACITY`, issued with the same delay as the cut. A constant can be neither stale nor shallow, and two cuts in quick succession read as two cuts — which is what they are |

**`COMPOSITE_SPATIAL_CAUSE_BINDING_DEFERRED_TO_T12`.**

R1 narrowed the composite cause from `APPLIED` to `APPLIED` + `LANDED`. That was necessary and not
sufficient, and R3 accepts the review's reading: a pending token has no owner. A landed composite
can arm one while the Map is between projections and cannot consume it, the accessible viewport
routes stay deliberately reachable in exactly that gap, and the next camera change on a freshly
mounted Map would then wear a beat belonging to an act a later action has already superseded.

No narrowing repairs that, because the defect is the shape rather than the condition. A mailbox is
not a binding; only one exact transition, one owner generation, one shot, invalidated by staleness
would be. Which canonical change an already-returned outcome belongs to is a composition fact this
owner does not have and cannot acquire without taking T-12's integration ownership.

So the stateful channel does not ship. `presentationTravelPlan` still accepts the cause and still
returns the beat — the choreography is real and stays tested — and nothing in production can produce
one. The camera passes `null` unconditionally.

**Carried forward, not fixed here.** Presentation culling during a DIRECT drag (M0) is still T-04's
resting viewport cull: the surface does not re-render while a finger is down, by design, so a drag
that carries an object in from beyond the cull margin does not repaint until the `PAN` commits. That
is pre-existing behaviour, unchanged by T-10, and outside R3's M4/M3 scope — recorded here rather
than left to be rediscovered.

## 11. Rejected patterns

Field resonance · neighbour ripple · ambient breathing · velocity-based node size · arrival breath ·
permanent glow or neon · particle field · animated blur · shimmer · skeleton leaking future shape ·
page slide · card-to-detail morph · modal inspection · generic shared-element transition · bouncing
nodes · optical zoom pretending to be Semantic Zoom · temporal stagger · disclosure stagger without
real semantic order · old-scene crossfade · fade-teleport in standard camera travel · future ghosts
and historical trails · animated tether tension · inspection dimming · confidence, importance or
recency encoded by motion geometry · infinite repeat · breathing Live indicator · rubber-band world
edge · cinematic camera arc · Exact Return lock frame · Preview world veil.

Every one is refused by `tests/t10-motion-contract.test.mjs`, which also plants each class of defect
into a mirrored copy of the owner and requires its own scan to catch it.
