# QANDEEL — Responsive Recomposition v1 (T-11)

**Status:** CLOSED / FROZEN
**Closure:** PR #215 · merge commit `7908612ff3fdc2bcc8936bc9f4e6f3de89393332`
**Owner:** `apps/mobile/src/responsive/**`
**Baseline:** `1615cea070e7a6594284fc54c6737ce5d5a1a2fb`
**Backlog:** `T-11 backlog inheritance: NONE`

> **The window changes. The world does not.**
>
> **Recompose density, never meaning.**

---

## 1. What T-11 is, and what it refuses to be

QANDEEL is one persistent world with support arranged around it. A reader may look at it through a
320-point portrait window, a 568-point short landscape one, a split view being dragged, or an
expansive window with room to spare. T-11 is the presentation layer that lets the SAME canonical
world, the same temporal truth, the same disclosed `V`, the same Return capabilities and the same
words survive all of them.

It is not a phone pass, a tablet redesign, a dashboard mode, a new geography, a new route system or
a new motion language. There is no compact Product and no expansive Product. There is one Product,
and a window.

The whole boundary reduces to one sentence, and everything below is its consequence:

> A resize may change what is **visible** and what is **arranged**. It may never change what is
> **true**.

---

## 2. Authority

### The kernel had already decided this, and T-11 did not reopen it

`RESPONSIVE_RECOMPOSITION` is not a new identity. T-02's frozen action catalog has carried it since
the foundation — `cls: 'D'`, `level: 'NOT_STORE_ACTION'`, `owner: 'T-11'`, `authority: fields()`,
`transactional: 'NEVER'`, frozen from Stage 6.4 v2 RC-P3 / IN-10C and Stage 6.5 v3 §24. It is
registered for classification only and the store refuses its whole class, so a responsive event
cannot be dispatched at all.

T-11 landing does **not** promote it. That is the single most important thing this task did not do:
the entry exists precisely to say that a layout event is not a Product act, and a task that gave
itself a store action would have inverted its own contract on its first day. The static contract
pins the entry's exact shape and proves it is a member of no executable action union.

Responsive geometry is **Class D**. It is derived from what a container was measured to be, it is
recomputed on every change, it is stored nowhere, and it never enters `MC`, `Φ_eff`, `TM`, `TC`,
`PTC`, `LH`, `LF`, `IF_ref`, `V` or the reversible history.

The owner is a closure rather than a convention. `apps/mobile/src/responsive/**` imports `react`,
`react-native` and its own sibling modules — nothing else, at any depth. There is no path from a
layout to a store, an executor, a temporal action, the semantic projection authority, a locale
provider, the API or the database, so the guarantee is structural: a resize cannot dispatch,
because there is nothing to dispatch to.

Two modules are stricter still. `surface.ts` imports **nothing at all**, and `plan.ts` imports only
`surface.ts`. The arithmetic that decides every composition is therefore reachable by no library, no
runtime, no platform and no store.

### The measured container is the only responsive authority

`Dimensions.get('window')`, `useWindowDimensions`, `PixelRatio` and every other display-scoped
reading are absent from the responsive owner AND from every reusable Product surface it composes.
A reusable surface does not own the display: it is composed inside a split view, a sheet, a proof
harness or a future shell, and answering "how big is the screen" confidently is exactly how one
Product silently becomes two.

Three containers measure, and nothing else does:

| Container | Measures | Produces |
| --- | --- | --- |
| `ResponsiveSurface` | the room the whole composition was given | the `RecompositionPlan` |
| `ResponsiveMapFrame` | the room the world was given | the Map's own `PresentationRect` |
| `ResponsiveTimelineRow` | nothing | the region the temporal surface is composed in |
| `ResponsiveChromeBand` | nothing | the frame the chrome is composed in |

The Map's envelope being MEASURED rather than predicted is load-bearing. Paint, hit testing and the
accessible tree all derive from one envelope, and that envelope is what the frame actually turned
out to be — so the three of them cannot disagree for a frame after a resize, which is precisely the
one-frame lie the motion contract forbids.

### Two seams, and they are seams rather than ownership

**Safe-area insets** and the **font scale** arrive as explicit numbers with neutral defaults, in the
same way T-08 already takes `bottomInset`. Nothing here imports `react-native-safe-area-context`,
mounts a provider, or reads Dynamic Type from the platform. The provider that knows insets lives at
the app root, and the app root is T-12's. Insets change usable layout and padding; they change no
camera, no geography, no temporal state and no offered act.

### Normalization, and why it is not cosmetic

`onLayout` reports layout points as floats. On Android they are device pixels divided by a density
that is rarely an integer, so a container that has not moved reports `359.99998474121094` and then
`360.0000152587891`. Every measurement is captured at whole points before anything reads it, and the
font scale at hundredths. That is what makes "repeated identical measurements produce identical
composition" true of the real input rather than only of the pure function.

Every input the plan is derived from is a number, the derivation is pure, and the measuring hook
memoizes it on those numbers — so a container that reports the same rect twice produces the same
plan OBJECT. A resize that changes nothing therefore costs nothing at all: no placement is
re-derived, no Skia tree is rebuilt, no hit map is recomputed and no accessible tree is rebuilt.

### The settled band follows the usable width, whatever moved it (R1)

The band's hysteresis needs to know which band is already on screen. Its input — the usable width —
has **three independent authorities**: the measured container width, the left inset and the right
inset. Only the first of them arrives as an event.

The first version settled the band inside the layout handler, which is correct for exactly one of
the three. When an inset prop changed without a new container layout, the surface and the plan
recomposed against the new usable width while the stored band still described the old one, so the
hysteresis was handed a predecessor from a width that no longer existed.

That is not cosmetic. Hysteresis is path-dependent by construction: inside the dead zone the band is
decided by history rather than by the width, so a wrong predecessor is a wrong band. An inset-only
step down through the boundary settles `COMPACT` on screen while the stored band stays `EXPANSIVE`,
and the next inset-only step then flips back up using the stale `EXPANSIVE` down-threshold (544)
instead of the `COMPACT` up-threshold (552) it should have been held to. One presentation
composition ends up decided by a band no composition ever settled.

So the settlement lives where the usable width actually resolves — the render — keyed to the width
it was taken at, and adjusted against the band the immediately preceding composition settled:

```ts
const usable = measured === null ? null : measured.width - left - right;
let band = settled?.band ?? null;
if (usable !== null && (settled === null || settled.usable !== usable)) {
  band = bandFor(usable, settled?.band ?? null);
  setSettled({ usable, band });
}
```

This is React's own pattern for state derived from previous state: the update is issued during
render of this same component, so React discards the in-progress output and re-runs immediately,
before any commit. There is no effect, no cascading commit, no extra paint, no timer, no ref read
during render and no remount — and the guard makes it self-terminating, so an unchanged measurement
costs no extra pass at all. The React Compiler's lint accepts it; what that rule set refuses is
`setState` inside an effect, which is what an earlier draft of this hook was corrected away from.

Keeping the width alongside the band is the load-bearing half: it is what says whether a settlement
still belongs to the composition being derived, so one can never be reused across a usable width it
was not taken at. `onLayout` is consequently free of the insets, its identity never changes for the
life of the hook, and the measured container never re-attaches its handler.

The plan's `geometry` is an **identity**, not a counter: it names WHICH coordinate frame this
composition is, derived from the six quantities a physical coordinate is actually taken through.
"Is this the same mapping" is the question a consumer needs answered, and answering it without
remembering is what keeps a derived value derived. The chrome's vertical rhythm, its bottom inset
and its arrangement change what the reader sees and map nothing, so none of them changes it.

---

## 3. Bands are consequences, not identities

Two bands, one height modifier, and every threshold derived from real content stress. Nothing here
names a phone, a tablet, a desktop, a brand, a model or `Platform.OS`, and nothing may: a breakpoint
that names a device becomes a Product concept the moment somebody reads it.

| Band | Condition | What it means |
| --- | --- | --- |
| `COMPACT` | usable width < `EXPANSIVE_MIN_WIDTH` | the chrome must be a single column |
| `EXPANSIVE` | usable width ≥ `EXPANSIVE_MIN_WIDTH` | it need not be |
| short modifier | usable height < `SHORT_HEIGHT_POINTS` | the world and the chrome compete for every point |

### `EXPANSIVE_MIN_WIDTH = 552`

The longest reader-facing wording in the chrome is a 116-character English return hint at T-08's
13-point hint size. It wraps at every supported width, so what matters is not whether it fits but
how short its lines become. The mobile line-length floor is 35 characters; at 13 points an average
Latin advance is ≈ 6.5 points, so 35 characters ≈ 227.5 points — `232` on the 8-point rhythm, which
is `PAIRED_MIN_CELL_POINTS`. Two such cells, the 8-point platform minimum between touch targets,
T-08's own 16-point horizontal padding and the band's 24-point breathing room give

```
2 × 232 + 8 + 2 × 16 + 2 × 24 = 552
```

The constant is **composed from those quantities in code**, not written down, so it cannot drift
away from the reasoning that produced it.

### `SHORT_HEIGHT_POINTS = 456`

The Timeline row is T-05's 48-point Track, its 44-point position rail and T-06's 44-point target
strip: `136`. The smallest chrome that still says where the reader is and offers one way back is
T-08's own `12 + (21 + 4 + 21) + 12 + 21 + 12 + 44 + 12 = 159`. The Map floor is `160`. Their sum is
`455`, which is `456` on the 8-point rhythm. Above it there is slack to spend; below it every point
given to one region is taken from another.

### `MAP_MIN_HEIGHT_POINTS = 160`

T-04 draws a Home at radius 13 and rings its contextual appearances at radius 40 with a 22-point
step. Two turns of that ring is a 124-point diameter; with 18 points of air on each side the Map
keeps `160`. "The Map may show less" was never permission for the Map to vanish.

### The world is sized first, at half — and the support yields

A floor alone was not enough, and the visual proof is what showed it. The composition is a column of
[world, temporal surface, chrome], and if the support regions take their natural height and the
world takes the remainder, then a 1024-point window ends up with a 150-point world under 870 points
of controls — a description of the world where the world should be. T-05's and T-06's accessible
non-drag routes are real, visible controls whose wording wraps, so the support is far taller than
any strip arithmetic predicts.

So the arithmetic runs the other way. The world is sized FIRST, at
`max(MAP_MIN_HEIGHT_POINTS, usableHeight / WORLD_SHARE_DENOMINATOR)`, with `flexGrow: 1,
flexShrink: 0`; the two support regions carry `flexShrink: 1` and their own reachable overflow. The
consequences are the three the Product needs:

- on a tall window with little to say, the world grows into everything the support does not need;
- on any window where the support wants more than half, the support yields — it does not push the
  world into a strip, and it does not push its own last control off the surface;
- the world never falls below its floor, and no act is ever unreachable. Both are structural.

Half is not a taste. "Support **around** the world" is a Product statement, and it is the smallest
share that keeps the world the subject rather than the backdrop.

### The chrome band has no height ceiling — deliberately

An earlier version gave it one, computed from the window minus the world's floor minus a CONSTANT
for the temporal surface. One frame of the visual proof refuted it: the constant was wrong because
the temporal surface's height depends on words that have not been laid out yet, and a ceiling from a
wrong constant put the bottom of the chrome off the screen entirely — the one outcome the whole
contract forbids.

A number this layer cannot know is a number it must not assert. The vertical arithmetic belongs to
the layout engine, which is the only thing that has measured the words. What the layer asserts
instead are the two properties it can guarantee: the world is sized first, and every support region
clips to what it was given and keeps the remainder reachable inside itself.

`TIMELINE_ROW_POINTS` and `CHROME_FLOOR_POINTS` survive as what they always were — the two
MINIMUMS that `SHORT_HEIGHT_POINTS` is derived from.

**T-12 correction.** They are no longer used for *nothing else*. Leaving them unapplied assumed the
two support regions would take their natural height and yield from there, and on a device they did
not: both regions hold a `ScrollView`, a scroller reports no intrinsic height to its parent, and the
Map is the only child that grows. A region's height was therefore "whatever the world did not take",
and when a re-layout let the world's growth take the remainder, the chrome band resolved to **zero**
with the orientation and every return act still mounted inside it — clipped away by its own
`overflow: hidden`. The temporal row reached zero the same way *while carrying a `minHeight` of 136*,
which is precisely why an unconditional `minHeight` was not the repair.

The plan now computes the room each support region gets — from the measured surface and these two
minimums — before either region renders, and the components consume that allocation instead of
inferring one. Nothing about the yielding ORDER changed: the instrument still yields at twice the
orientation's rate, and each region still clips to what it was given and keeps the remainder reachable
inside its own scroller.

Below `SHORT_HEIGHT_POINTS` the three minimums cannot all be honoured by stacking — `160 + 136 + 159`
is more height than a short window has. There the two support regions are composed **across** each
other inside the same band, where they cost `max(136, 159)` rather than their sum, and the world pays
the difference in area, which is the one thing the contract permits it to pay. The threshold for that
is not a new one: it is the same two-cell readable width the chrome's own arrangement already uses.

### `CHROME_MAX_MEASURE_POINTS = 544`

At T-08's 15-point label size an average Latin advance is ≈ 7.5 points, so the 72-character upper end
of the comfortable reading measure is 540 points — `544` on the 8-point rhythm. Past that, extra
width becomes air around the words rather than longer lines. This is a **clamp, not a band**: it is
continuous, it binds gradually, and no composition changes shape where it starts to apply.

### Hysteresis

A container resting exactly on the boundary would otherwise flip band on sub-point noise for as long
as it sat there. Crossing **up** happens at the threshold; crossing **down** happens 8 points below
it — the 8-point rhythm, the smallest change that is a layout change rather than noise. The settled
band is an ARGUMENT to `bandFor`, not hidden state, so the function stays pure and total, and
`bandFor(w, bandFor(w, p)) === bandFor(w, p)` for every width.

The dead zone is the **half-open `[544, 552)`**: `544` is the last expansive width, not the first
compact one. That is deliberate and it mirrors the up-crossing, which is the closed `usable >= 552`
— together they make the hysteresis exactly the 8 points it is named for. Closing the lower bound
the other way would make it 7. `inset-settlement.test.tsx` asserts both edges by name so the
boundary is recorded rather than assumed.

### The composition, case by case

| Case | Window | Band | Short | Arrangement |
| --- | ---: | --- | --- | --- |
| C1 | 320 × 568 | `COMPACT` | no | `STACKED` |
| C2 | 360 × 800 | `COMPACT` | no | `STACKED` |
| C3 | 390 × 844 | `COMPACT` | no | `STACKED` |
| C4 | 412 × 915 | `COMPACT` | no | `STACKED` |
| C5 | 568 × 320 | `EXPANSIVE` | yes | `PAIRED` |
| C6 | 844 × 390 | `EXPANSIVE` | yes | `PAIRED` |
| C7 | 768 × 1024 | `EXPANSIVE` | no | `STACKED` |
| C8 | 1024 × 768 | `EXPANSIVE` | no | `STACKED` |
| C9 | 1366 × 1024 | `EXPANSIVE` | no | `STACKED` |

---

## 4. Compact, expansive, short

**Compact removes space, not truth.** Every currently available act, every essential word, the same
semantic model, the same `V`, the same temporal truth and the same accessibility route are present
at 320 points as at 1366. Nothing is hidden, shortened, ellipsized, put behind a "More", or given a
touch target under 44 points.

**Expansive gains air, not a second Product.** More of the same world becomes visible, the chrome
gains 24 points of band padding, and its reading measure is clamped so the words stay readable
instead of running edge to edge. There is no sidebar, no inspector, no dashboard column, no
"desktop mode", no extra summary and no additional capability. The bottom-band system is the same
system at every width.

**Short landscape is a first-class envelope.** The vertical room is what is scarce there, so the
band's own gap tightens from 12 to 4 points and the return acts wrap two across. Width alone never
pairs them: on a wide, tall window a single column costs nothing and keeps the acts reading as one
ordered list rather than as an invented grouping. Pairing is applied only where it buys back
vertical room AND each cell still clears the readable floor.

### The one place the chrome had to learn something new

`OrientationChrome` and `ReturnControls` gained ONE presentation prop: an already-decided
`'STACKED' | 'PAIRED'` arrangement, defaulting to `STACKED`. The chrome still measures nothing,
reads no width and consults no breakpoint — it is TOLD, by the layer that owns recomposition,
whether the room it has been given makes a second column truthful. That is exactly what T-08 §11
means by "it has no width, breakpoint or layout input, so no Product answer can depend on one", and
what T-08 §12's R2-02 anticipated when it recorded that "T-11 will make them responsive".

The arrangement selects a style and nothing else. The semantic model, the offered set, the order,
the availability and every word are identical under either value, and the static contract proves the
arrangement never touches `offered`, and never reaches `product-copy.ts`.

`row` is the READING direction: React Native reverses it under a right-to-left layout, so the frozen
order survives in both directions and nothing is mirrored into a different meaning. The paired cell
is `flexBasis: '48%'` with `flexGrow: 1` — a floor for the words, never a ceiling. There is no
`width`, no `maxWidth` and no `numberOfLines`, so a control still grows downwards to contain the
longest Arabic wording at the largest text size.

---

## 5. The Map invariant

When the envelope changes, the canonical camera is unchanged, `V` is unchanged, every Home's address
is unchanged, the inspection context is unchanged, no reversible-history entry is appended and no
act is dispatched. Only the visible footprint, the presentation culling and the screen-space
placement change. T-04's resize law is untouched: **resize recomputes the visible footprint only.**

A Home's screen position necessarily differs between two envelopes, because the camera anchor is
drawn at the centre of the safe area and the safe area moved. The invariant that carries meaning is
the one that is asserted: a Home's position **relative to the camera** is identical at every width.
Asserting equal screen coordinates would assert the opposite of the contract — it would require the
world to move with the window.

The Map world is **never mirrored**. Nothing under `apps/mobile/src/map/**` reads `I18nManager`,
`isRTL` or a writing direction, or applies a `flexDirection`, and the placement is byte-identical
under either layout direction. RTL affects chrome and the temporal strip's single physical mirror,
and stops there.

The ungeographic register stays **screen space**. It reflows within its own strip as the safe area
changes — more columns of the same entries, in the same order — and it never moves with the world
camera, never inherits the plane's residual, and never turns a width into a semantic rank.

Paint, pointer and the accessible tree agree under the new envelope because all three derive from
the same measured rect: a tap at exactly where the renderer drew a node selects that node at every
width, and the accessible tree's within-footprint answer is computed from the same footprint the
placement used.

### Direct manipulation during a resize

T-04's `PAN` mapping is **envelope-independent**: `panFromTranslation` converts the finger's own
total translation to a world delta through `camera.scale` alone, and the presentation residual
`dragBy` divides by the residual zoom and nothing else. A geometry change therefore does not
invalidate an open drag's mapping, and the contract's condition for continuation is met — visual
manipulation stays 1:1 and the final `PAN` preserves the frozen T-04 semantics exactly.

So a mid-drag resize is **owner-safe by construction, and the interaction continues.** The
presentation camera's shared values are stable across the re-render a resize causes, so the same
finger keeps writing the same residual; the completion crossing still carries the authority
generation the drag began under, so a replaced store still drops it; and no responsive module can
dispatch a `PAN`, synthesise a compensating one, or route an old gesture's authority into a new
owner, because it can reach no executor at all.

---

## 6. The Timeline invariant

A resize may change how much of the same disclosed track is visible. It may not change `TC`, `LH`,
`TM` or `PTC`, may not create, retarget or commit a Preview, may not create a temporal act and may
not leak a Moment that is not disclosed. The disclosed Track is the same complete SP1-anchored
prefix, by identity, at every width.

The **Live edge remains an outboard presentation slot** at its own fixed extent, beside the Track
rather than beneath it, in both writing directions and at the narrowest supported width. It never
becomes a Moment, never overlaps the target strip, and never disappears. The Moment-targeting strip
stays sized to T-05's own viewport and aligned to the row's start edge, so a touch in the Live
region cannot reach it in either direction.

### An interaction belongs to the geometry it began under

This is the one place a resize could have lied, and it is the most important thing T-11 fixes.

A temporal scrub maps a **physical** finger position through `presentationX(x, viewport, rtl)` and
the window offset. The viewport is a measured presentation quantity that a rotation, a split-view
drag, a safe-area change or a font-scale reflow can replace while a finger is still down. When it is
replaced, the same untouched physical point resolves to a different disclosed Moment — and in
right-to-left it resolves to a Moment on the other side of the strip, because the mirror is taken
about a width that no longer exists. The reader's Preview would retarget to a Moment they never
pointed at, and their release would **commit** it.

T-06's interaction epoch cannot see this: the gesture never ended, so its epoch is current and open.

So an interaction now carries the **presentation geometry generation** it began under, exactly as it
carries its epoch. The generation advances only when the two quantities the MAPPING is taken through
change — the viewport and the direction. The window offset is deliberately not one of them:
scrolling the Track during a scrub is a presentation move T-05 and T-06 already support, the offset
is read live on the UI runtime, and the finger keeps pointing at the physical place it is pointing
at.

When the generation advances under a live finger, the interaction is **retired through T-06's own
interruption route** — `settle(epoch, false)`, the same path a cancellation, a failure and a
competing recognizer take. Everything that follows falls out of the existing epoch machine rather
than out of a new rule:

```
old presentation geometry authority
  → geometry changes
  → the open interaction is closed and its Preview discarded
  → the reaction stops scheduling: its captured generation is stale
  → the gesture's own later release carries a CURRENT but CLOSED epoch, and is ignored
  → no stale Moment commits, no Preview is wrongly retargeted, and nothing is adopted
```

No timer decides any of it. The guard is declared inside T-06 rather than imported from T-11: it
must hold for every caller, including one that composes the strip itself, and a temporal layer that
needed a presentation layer to be mounted before it could refuse a stale coordinate would be exactly
the wrong dependency.

---

## 7. Continuity while T-10 motion is in flight

> Nothing teleports. Meaning resolves.

The presentation camera draws the plane as `screen(p) = c + zoom · (p + t − c)`. A resize changes
the viewport centre `c`. If a centre change moved the plane by anything other than what it moves the
world by, a travel in flight would jump — and a jump at exactly the moment a reader resizes is
indistinguishable from a navigation nobody performed.

It does not, and the reason is arithmetic rather than care. T-04 places every world node relative to
the same centre, so a centre change moves `p` and `c` by the same vector and the residual term
`(p − c)` is untouched:

```
screen_new(p_new) = c_new + zoom · (p_old − c_old + t) = screen_old(p_old) + (c_new − c_old)
```

The whole plane shifts **rigidly** by the centre delta, for every residual the plane could be
showing — which is exactly what a resting world does. The travel is neither restarted, retargeted
nor snapped, and this is proven over a sample of the residual space rather than at the endpoints of
one animation.

The running travel is not re-issued either. `applyCanonicalChange` reads the viewport diagonal at
the moment it is called; a resize does not call it, so the springs already scheduled keep their
targets and their durations. The canonical destination cannot change, because a resize cannot write
a canonical camera.

**Travel culling** stays conservative under the new envelope: the corridor is still applied rather
than replaced by the resting test, so nothing that could be on the glass during the travel is culled
by the resize. At rest the corridor is the degenerate envelope and the test is exactly T-04's
resting viewport test, at every width.

**Disclosure arrival cannot be replayed.** Membership is asked of the SCENE, and a scene has no
viewport, so every envelope produces the same accepted set and `newlyDisclosedKeys` is empty for a
pure resize. `DisclosureArrival` freezes its plan at mount and plays once; a resize changes a node's
origin and never its plan, and nothing in the composition is keyed by a width or a band, so no
arrival is remounted, replayed or duplicated.

**Meaning Ignition cannot fire.** The M5 cue has no authoritative Product trigger in v1 and is
absent from the motion layer entirely (`QAN-BL-MOT-01`). What a resize could do is invent one; it
cannot, because the responsive owner imports no animation API, holds no clock, names no cue and has
no path to the motion layer at all.

**Reduced motion keeps every capability.** The same acts, the same words, the same composition and
the same accessible routes at every width, with only the transition changed.

---

## 8. Responsive motion policy — the `KEEP STILL` inventory

The animation-opportunity audit was run before implementation. Its result is that T-11 adds **no
animation at all**.

| Moment | Verdict | Why |
| --- | --- | --- |
| continuous container resize | `KEEP STILL` | direct manipulation of the window; easing it would visibly lag the reader's own hand |
| band crossing (`COMPACT` ⇄ `EXPANSIVE`) | `KEEP STILL` | a breakpoint is not a Product event; animating it makes a window resize read as navigation |
| arrangement change (`STACKED` ⇄ `PAIRED`) | `KEEP STILL` | same reason, and a reflow that animates draws the eye to a change in nothing |
| safe-area inset change | `KEEP STILL` | a keyboard or a rotation moves padding; the words did not move |
| font-scale reflow | `KEEP STILL` | the reader changed a system setting and is looking at the result, not at a transition |
| camera travel interrupted by a resize | **preserved, not added** | the existing T-10 travel continues untouched; the rigid shift needs no motion of its own |
| disclosure arrival interrupted by a resize | **preserved, not added** | the arrival is frozen at mount and is neither restarted nor re-timed |

No new vocabulary, no overshoot, no breakpoint delight, no `LayoutAnimation`, no duration and no
easing constant exists anywhere in the responsive owner — and the static contract refuses one.

### The two pieces of motion T-11 does own, and neither is new

**Boundary damping in the support regions.** Both scroll containers set
`alwaysBounceVertical={false}` and deliberately do NOT set `bounces={false}`. The first says: do not
spring back over content that does not exist — a surface that bounces when there is nothing below it
implies there is. The second would have removed the rubber-band in the one case that matters, when
the region really is holding more than it can show, and a scroll that ends against an invisible wall
is the hard stop nothing physical has. `/review-animations` caught that; the reader should feel the
end of their own return acts, not hit it.

**The mid-scrub retirement.** When a geometry change retires an open interaction, it routes through
T-06's own cancellation path, so what the reader sees is exactly what any other cancelled scrub
looks like: the preview cursor fades over `presenceMs` and the committed marker is carried home by
the same critically damped spring at `CANCEL_DAMPING_RATIO`. No overshoot, no new vocabulary, and
nothing invented for a case that is rare. It is deliberately silent about WHY — a positive signal
would need either a new motion vocabulary or new Product copy, and T-11 may add neither — and
whether that silence is enough is asked on hardware under `QAN-BL-RSP-01`.

---

## 9. Arabic, RTL and code-switching

Language and layout direction are **independent axes**, and T-11 keeps them that way: no language
selects a direction and no direction selects a language, anywhere.

The full matrix — Arabic+RTL, Arabic+LTR, English+RTL, English+LTR — is proven across the whole C1…C9
envelope: the semantic model is deep-equal, the offered acts are identical, the order is identical,
every word and every hint is identical, and the accessible focus order is identical. Only the
arrangement differs.

At 320 points the longest Arabic return label («العودة إلى المحادثة والانتقال إلى موضعها») and the
longest Arabic hint wrap naturally into a control that has a 44-point floor and no ceiling. Nothing
in the chrome uses `numberOfLines`, `ellipsizeMode` or `adjustsFontSizeToFit`, so no canonical
identity, status or Return wording can be clipped or ellipsized at any width or any text size.
T-08's own type discipline is untouched: ~1.6× line heights, no letter spacing, no italics.

The Map is not mirrored. The Timeline keeps T-06's **single** physical mirror rule — `presentationX`
is the only place a coordinate is mirrored on the pointer side, and `restingMarkerX` its exact
reflection on the motion side — and T-11 adds no second one. The band's `row` under `PAIRED` is a
logical direction that React Native reverses, which is the same rule rather than a competing one.

---

## 10. Accessibility

Everything below is Product truth, not presentation, and none of it is allowed to depend on a width.

- **Every control stays reachable at every width.** No act is hidden, collapsed, deferred to a menu
  or replaced by an ambiguous icon at any size in the envelope.
- **Every control keeps its 44-point floor**, in both arrangements. `minHeight` is a floor and there
  is no `height`, `maxHeight` or `maxWidth` anywhere on a control.
- **Focus order matches visual order** in both arrangements. Wrapping is a `row wrap` in the reading
  direction, so the traversal order is the frozen semantic order in LTR and in RTL.
- **No duplicate focusable node** is introduced at any width: the arrangement selects a style, and
  the tree is the same tree.
- **The Map's accessible target agrees with the responsive geometry**, because it is built from the
  same measured envelope the placement and the hit test use.
- **Pointer-through is preserved**: the only nodes inside the chrome that can take a press are the
  controls that mean something, at every width, so a press that misses one is not swallowed.
- **Reduced motion keeps the same capability**, proven across widths and languages.
- **The screen-reader temporal route is unaffected** by width: the disclosed steps, the Live edge's
  label and its enabled state are identical at C1, C5 and C8.

---

## 11. Dynamic Type

Font scaling is treated as presentation pressure, never as a reason to remove truth. Nothing
anywhere in the chrome sets `allowFontScaling`, `maxFontSizeMultiplier` or `adjustsFontSizeToFit`,
so the reader's own text size is honoured by the platform in full.

At every tracked scale up to 4×, the semantic model, the offered acts, the order, every word and
every hint are identical, and no Product state changes. Labels wrap, controls grow downwards inside
a column with a gap so they cannot overlap, the chrome band grows, and the Map shows less — down to
its floor and no further.

`fontScale` is an explicit presentation input with a neutral default of `1`. It is quantized to
hundredths so a platform's own float noise cannot recompose a surface, and it is carried in the plan
without deciding any composition of its own: growing the chrome is what the words do, not what the
plan does for them.

**Validation limit, stated rather than glossed:** the authoring machine has no simulator, emulator
or device, and `jest-expo` performs no text layout. What is proven here is that nothing disables,
caps or clamps Dynamic Type, and that no Product answer changes with the scale. What is NOT proven
here is how the real type engine lays those strings out at the largest system sizes on real
hardware. That gap is admitted as a backlog item rather than claimed as proof — see §16.

---

## 12. Performance

- No per-frame bridge exists during a resize: the responsive owner has no worklet, no shared value
  and no frame callback.
- No canonical write, no dispatch, no fetch and no projection request can be triggered by a resize.
- No Map, Timeline or chrome owner is keyed by a width, a height or a band, so no measurement can
  remount a world. A full sweep of the envelope leaves the Map surface and its accessibility layer
  as the same instances.
- Measurement noise cannot churn the Skia tree: a plan that composes identically is returned by
  identity, so the placement memo, the presented set and the canvas all hold.
- There is no layout feedback loop. The band's ceiling comes from the plan, not from its content,
  and the plan is a function of the container alone — so nothing the band does can change the
  measurement the band was composed from.
- Threshold flip-flop is impossible for a settled band inside the 8-point hysteresis, and the band
  function is idempotent at every width.

No global render-count ceiling is asserted. A count like that fails on correct future work and
proves nothing about a resize; what is asserted instead is the property underneath it — identity
stability, no remount, and no canonical write.

---

## 13. What the review passes changed

The design critique was run over the rendered proof rather than over the code, which is why it found
things the suites could not. Every finding is dispositioned here.

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | The chrome band's height ceiling was computed from a constant for the temporal surface. The constant was wrong, and the bottom of the chrome was off the screen at every case in the envelope. | **Applied.** The ceiling is gone; the vertical arithmetic belongs to the layout engine. See §3. |
| 2 | The support regions took their natural height and the world got the remainder — a 150-point world under 870 points of controls at 1366 × 1024. | **Applied.** The world is sized first at half the usable height and grows into what the support does not need. |
| 3 | Both support regions yielded at the same rate, so the temporal surface — whose height is mostly slack above its own interactive minimum — took as much of the deficit as the chrome, whose height is nearly all essential wording. | **Applied.** The instrument yields at twice the rate, down to `TIMELINE_ROW_POINTS` and no further. When something has to go first, the instrument goes before the answer. |
| 4 | The Timeline was clamped to the chrome's reading measure, so an 844-point landscape showed one Moment inside a 576-point column with 134 points of empty margin on each side. | **Applied.** The reading clamp is for prose. The Timeline gets the whole available width: every extra point is one more disclosed Moment the reader can see and reach at once. |
| 5 | The Timeline row sat flush to the surface edge while the chrome carried the band's padding, so the two support regions did not share a vertical rhythm. | **Applied.** The row takes the band's own horizontal inset. |
| 6 | T-05's outboard Live slot has a fixed 64-point width with `overflow: 'hidden'`, so its label clips to "Go" at 200 % text. | **Admitted, not applied.** Pre-existing, in a byte-frozen owner, unreachable from here. `QAN-BL-RSP-02`. see §16. |
| 7 | At 320 × 568 the temporal surface alone wants more than half the window; whether its accessible routes should be permanently visible is a composition question. | **Not T-11's.** Recorded against `QAN-BL-T12-03`, which already owns where each surface appears. |

The accessibility pass added two guards rather than two fixes, because the properties already held
and were only unproven: no container this layer introduces carries an accessibility name, a hint,
`accessible`, or an action — the Android grouping defect T-08 designed around cannot recur here —
and both scroll containers declare themselves layout rather than a node to stop on.

The Arabic pass likewise added a guard: every layout property this layer writes is
direction-neutral, and it never reads a direction at all. The one place a physical side is named is
the safe-area inset, which is physical in the world — a notch is on one side of a device, not on its
start edge.

---

## 14. Rejected patterns, and why

| Rejected | Why |
| --- | --- |
| a device, brand or `Platform.OS` breakpoint | a breakpoint that names a device becomes a Product concept, and then two devices have two Products |
| `Dimensions.get('window')` as responsive authority | a reusable surface does not own the display; it is composed inside something |
| a third band | nothing in the envelope needs one; the reading measure and the Map's share change continuously |
| a sidebar, inspector or dashboard column on an expansive window | a larger window is not permission to create a second Product |
| pairing the return acts on any wide window | on a tall window a column costs nothing, and a grid invents a grouping the acts do not have |
| a "More" control, an overflow menu or a collapsed group | compactness removes space, not truth |
| `numberOfLines` on essential wording | truncating a canonical identity is not a layout decision |
| animating a band crossing | a window is not a destination; a resize that animates reads as navigation |
| easing the resize itself | it is direct manipulation of the window, and lag is the one thing it must not have |
| recentering or fitting the world to the new window | the world would move because the window did, which is the whole thing T-11 exists to prevent |
| mirroring the Map under RTL | the world is a place, and a place does not have a reading direction |
| teaching T-08's chrome to measure | what is true may not depend on how large the screen is |
| retiring a scrub on a window-offset change | scrolling during a scrub is a supported presentation move, and the finger keeps pointing where it points |
| a timer anywhere in the ownership rules | correctness must not depend on scheduling luck |

---

## 15. Closure evidence at this SHA, which is not the same as a perpetual guard

These were true when T-11 closed, and are recorded here rather than frozen in CI — freezing them
would fail on authorized future work rather than on a defect, which is the ceiling class R2-02
removed from this repository:

- the app shell and the router root are byte-identical to the baseline, and mount no Product surface
  at all: `apps/mobile/src/app/**` and `apps/mobile/src/shell/**` reference nothing in `responsive`,
  `map`, `orientation-chrome`, `temporal-navigation`, `timeline` or `motion`. Mounting them is T-12's
  entire job;
- `react-native-safe-area-context` is declared by the mobile app and imported by no source file.
  Binding the provider is T-12's;
- `apps/mobile/src/responsive/` contains exactly the six production modules and the barrel listed in
  §2, and no others;
- neither manifest and neither lockfile changed. T-11 adds no dependency.

What IS permanently guarded is the invariant underneath each of them: the shell may only ever reach
the responsive owner through its public barrel, the owner can never reach a store, an executor or a
provider, and the owner names only packages the mobile app already declares.

---

## 16. Native and physical validation limits

`jest-expo` performs no layout: there is no Yoga in the test renderer, so `onLayout` never fires by
itself and the proof composition fires it with the rect a real column would produce. That proves
everything the responsive owner does GIVEN a measurement — the plan, the envelope, the parity, the
ownership, the continuity. It does not prove that the platform produces that measurement, and it is
never cited as if it did.

The browser proof shows real layout of the real components at every case in the envelope, in both
languages and both directions. It is browser layout, not native layout, and in particular it is not
a Dynamic Type proof.

What remains unproven after T-11, honestly stated:

1. real type-engine layout of the Arabic and English wording at the largest system text sizes on
   device;
2. real safe-area insets on a notched device and on a gesture-bar device, including the asymmetric
   and landscape cases;
3. real split-view and Stage-Manager-style continuous resize, and real orientation change, on
   hardware;
4. a real mid-travel resize and a real mid-scrub resize performed with a finger.

These are admitted to the canonical backlog as `QAN-BL-RSP-01` rather than glossed. Nothing about
them is known to be wrong; they are a class of claim that cannot be made from code and CI alone.

### What the proof found that T-11 could not fix

**The outboard Live control's label clips at large text.** T-05 gives the outboard slot a fixed
`width: OUTBOARD_LIVE_EXTENT` (64) with `overflow: 'hidden'`. At 200 % text the label "Go live"
needs about 110 points, so the reader sees "Go" — essential wording, clipped. It is visible in the
`P07-large-text` and `P07b-largest-text` frames.

This is a **pre-existing defect in a frozen owner, surfaced by T-11's proof**, not a T-11
regression: the slot, its width and its clip all predate this task, and the same clipping happens at
that text size with or without the responsive layer. T-11 cannot fix it either, because the T-06
contract holds every T-05 file byte-identical, and reopening that freeze from a presentation task
would be exactly the kind of sideways reach the boundary exists to prevent.

It is therefore admitted as `QAN-BL-RSP-02`, with the evidence, rather than left in a report.

**The vertical budget between the three surfaces is a composition question, not a responsive one.**
At 320 × 568 the temporal surface alone — Track, rail, strip, and T-05's and T-06's accessible
non-drag routes — wants more than half the window, and the chrome wants most of the rest. T-11's
answer is the only one available to it: the world is sized first, the support yields, and everything
stays reachable. Whether those accessible routes should be permanently visible, collapsed, or given
their own surface is `QAN-BL-T12-03`'s question, and this task does not answer it.

---

## 17. BG-08 closure reconciliation

- **Inherited items:** `T-11 backlog inheritance: NONE`. The register's §9 kickoff table and its
  prose both say so, and the static contract asserts both.
- **Blockers:** none were moved to the backlog. The one real defect this task found — a mid-scrub
  geometry change committing a stale-mapped Moment — was fixed inside T-11 (§6), as BG-01 requires.
- **Newly admitted:**
  - `QAN-BL-RSP-01 — Physical Responsive Recomposition Validation`, owned by
    `T-12 — Final Integration / pre-release physical validation gate`, status `VALIDATION — OPEN`,
    with the exact reopen condition and the four-item validation set of §15. It qualifies under
    BG-06 because it is a carried-forward validation obligation with stated reopening evidence.
  - `QAN-BL-RSP-02 — Outboard Live Label Clipped at Large Text`, owned by
    `T-12 — Final Integration`, status `DEFERRED — OWNED`, `HIGH`. It qualifies under BG-06 and NOT
    under BG-01: it is a pre-existing defect in a byte-frozen T-05 file, it reproduces at that text
    size with or without the responsive layer, and T-11 cannot reach it without breaking the freeze
    that keeps a presentation task out of a temporal owner. Admitting it is not laundering a T-11
    blocker; leaving it in a report would have been losing a real finding.
- **Not admitted:** every anti-scope sentence in this document. A boundary is not an obligation.

---

## 18. What proves it

- `npm run test:t11-responsive-contract` — the static contract: the owner's closure, the two-package
  import surface, the derived thresholds, the pure hysteresis, no device branch, no display
  authority, no Product vocabulary, the arrangement seam, no truncation, no mirror, no refit, no
  width-keyed remount, the mid-scrub geometry ownership, no new canonical field, act, mode, motion
  or backend, the barrel allowlist, the T-12/T-13 boundary, the backlog kickoff and CI registration.
- The Jest suites under `apps/mobile/src/responsive/__tests__/` — the plan and its arithmetic, the
  Map invariants and the resize sweep, the Timeline invariants and the mid-scrub retirement, the
  T-08 parity matrix across C1…C9 × {ar, en} × {LTR, RTL} × text scale, and the T-10 continuity
  algebra.
- `npm run test:forward-safety-contract` — the repository-wide gate, now carrying T-11's own half of
  the refusals: a Product surface that reads the display, a responsive module that reaches an
  executor, one that names a Product concept, one that invents a motion vocabulary, and a chrome
  that branches on a device class must each be refused by the contract that owns them.
- `docs/responsive-recomposition-v1-traceability.md` — every frozen invariant, every doctrine rule,
  `T11-A01…A80` and `PM-01…PM-30` mapped to exact code, an exact test, a static proof, a visual
  proof, or `STRUCTURALLY IMPOSSIBLE` with its reason.

Nothing in T-11 authorizes a merge. Independent Architecture + Experience review comes next.
