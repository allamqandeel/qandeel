# T-10.0 — Unresolved questions for HUMAN review

None of these is decided by the shootout. Each one either changes the Motion North Star or changes
what production T-10 may assume. They are ordered by how much they constrain the freeze.

## Q1 — Where is the commit boundary of a pan with momentum?

The baseline commits ONE `PAN` at gesture end with the finger's own translation, and momentum did
not exist. The lab commits ONE `PAN` where the plane comes to REST (after momentum, or when a
Product act interrupts the momentum), because that is the only boundary at which the canonical
camera can never disagree with what the reader is looking at. The alternative — commit at
release, then a second `PAN` when momentum rests — costs a second reversible-history checkpoint
per fling and makes Back stop halfway through a flick. A third alternative — no momentum at all —
keeps T-04's exact mechanic and forgoes P3. **This is a Product-boundary question, not a motion
question, and it needs an Architecture answer before production T-10.**

Evidence that sharpens it: the scripted S1 (a synthetic finger through the same worklets, with an
explicit release velocity) commits exactly one `PAN` in all three directions. The real-pointer
drag runs on the web renderer (mouse events over the DevTools protocol: drag, release, and a second
press 350 ms into the momentum) committed two `PAN`s in A and C and one in B. The count depends on
what the gesture library reports as release velocity and on whether the second press is seen as a
new interaction or as a grab of the running one; the driver cannot control either. Whatever the
boundary is, it must be stated so that "one interaction" is defined by the Product, not by the
gesture stack — and it must be re-verified on a device, not a browser.

## Q2 — Is a long flight ever the right answer inside one world?

At the THREAD rung (scale ÷8) Homes sit 1 000–2 000 points apart, so every flight between Homes
crosses empty world. Direction A flies it (a well-damped slide across nothing for ~0.5 s);
Direction B resolves in place beyond 1.25 viewport diagonals (a cut with an opacity resolve, which
is a fade-teleport); Direction C springs it. "Nothing teleports. Meaning resolves." cannot be held
on both halves at once for a long flight: either the camera travels through emptiness or the world
resolves without travelling. **Which half is the North Star?** A possible hybrid not built here:
a brief zoom-out-and-in arc (the destination and the origin both visible mid-flight), which would
be geometrically continuous but is a "cinematic" transition the anti-pattern list warns about.

## Q3 — Does a depth step's geometric reinforcement belong to the camera or to disclosure?

The ×8 reinforcement is frozen mechanics. A shows it as a critically damped scale about the locus;
B delays it 90 ms so the unfolding leads; C springs it with a little overshoot. In all three the
other Homes fly outward and leave the frame. **Should the reinforcement be visible at all, or should
a depth step read as disclosure only (objects resolve; the plane does not visibly magnify)?** The
latter would make Semantic Zoom look less like an optical zoom, which §13 warns against, at the
cost of the relationship between rungs being invisible.

## Q4 — Meaning Ignition: keep, restrict, or reject?

Three renditions were tested (ring / bloom / ripple) against no cue. The trigger in the lab is
narrow and prototype-only: an identity that first becomes known through a live advance while the
reader follows Live, drawn where it lands. Two risks surfaced: the ripple (C) makes neighbours
respond, which reads as a relationship the record does not state; and any cue on a Home that
appears at the WORLD rung is also a claim that the reader should look there, i.e. an attention
grammar. **If kept, the trigger must be frozen by Architecture, not by motion, and the cue must
never apply to a scrub, a return or a tap.**

## Q5 — Reduced motion: cut plus resolve, or true minimal motion?

The reduced choreography replaces every x/y/z travel with a cut and a ~180 ms opacity resolve, as
Apple's own reduce-motion guidance recommends. But a cut on a Return act loses the one thing
motion was explaining there — that the reader went back somewhere. **Is a short (≤ 160 ms),
critically damped travel acceptable under reduced motion for the Return acts, or must it stay a
cut?** The lab keeps the cut.

## Q6 — The preview veil

While a preview is open the world is drawn at 0.86 opacity so a preview frame cannot be mistaken
for committed truth (T-06's rule for its marker). **Is a veil the right vocabulary for the world,
or should preview weight be carried only by the strip and the chrome sentence?** A veil dims
truthful objects; the alternative leaves preview and commit visually identical on the plane.

## Q7 — Exact Return's arrival lock

A brief inset ink frame marks the exact restoration (240–280 ms). It is the only motion that
draws chrome ON the world. **Is a one-shot frame acceptable, or should "exactly here" stay in the
orientation sentence alone?**

## Q8 — Field response (C) at all?

Node size following plane speed (+5 % per 1000 pt/s) is the one place presentation responds to
gesture energy. It is small, but it makes size mean something (speed) on a surface where size must
never mean anything analytical. **Reject on principle, or keep as the one physical tell?**

## Q9 — Platform feel could not be observed here

This machine has no Android SDK, no emulator and no Xcode. Every observation is from the web
renderer in real Chrome at 60 fps (frame reports in every capture manifest) and from code
reading. Expo Go on a phone (Skia, Reanimated 4 and Gesture Handler are included for SDK 57) is
the nearest real-device route; a development build is the honest one. Matrix rows 12 and 13
(Android physical feel, iOS feel) are therefore **unscored**.

## Q11 — The temporal layer's copy is English-only at the baseline

T-06's `TemporalTargetLayer` (the strip, the preview sentence, the commit and cancel controls) has
no language input; VI-01's bilingual authority reached T-08's chrome only. Under Arabic copy the
world's Arabic sentence and controls are T-08's, while the strip under the world stays English. Not
a shootout finding and not a motion question — recorded here so production T-12 (or an earlier
copy task) picks it up, and so the Arabic/RTL recordings are read correctly.

## Q10 — Harness dependency

`react-native-web` was installed into `node_modules` only (no manifest or lockfile change) so the
lab could be seen on this machine. Nothing in the repository declares it and the branch carries no
dependency change. If a web harness should remain available to future motion work, that is a
dependency decision for Architecture (§9.3), not one the shootout took.
