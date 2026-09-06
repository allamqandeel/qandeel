# Temporal Navigation Layer v1 (T-06)

The interaction and substrate around the frozen temporal primitives, and nothing more.

T-02 remains the only authority over canonical state. `COMMIT_MOMENT` and `COMMIT_LIVE_EDGE` are
not replaced, wrapped, re-derived or generalized. T-06 decides *when* to call them — from a
completed, explicit user act — and owns everything around that moment.

Source: `apps/mobile/src/temporal-navigation/`.
Gate: `npm run test:temporal-navigation-layer-contract` plus the Jest suites under
`apps/mobile/src/temporal-navigation/__tests__/` (TN06-01 … TN06-24).

---

## 1. What is stored, and what is not

`S = { LH, LF, TM, TC, K(TC), IF, MC, RH }` is unchanged, and so is its class separation.

`TM` still has exactly two modes, `FOLLOW_LIVE` and `PINNED(t)`. Effective `TC` is still derived
(`FOLLOW_LIVE → LH`, `PINNED(t) → t`) and still has no storage slot.

`PTC` is **not** CanonicalState. Neither is a Timeline window, a presentation position, animation
progress or gesture progress. None of them has a key in `CanonicalState`, and the exact-shape
validator rejects any attempt to add one — including from a transition that bypasses TypeScript
(proven by TN06-23).

A preview is deliberately **not** implemented by moving `TM` and moving it back. That would create
two false Product transitions, two RH checkpoints, and an interval during which committed truth
claimed something that never happened.

## 2. Two gates, deliberately separate (R1-01)

Two different questions stay two different questions.

**Canonical Moment addressability** — `targeting/addressability.ts`. Is this a legitimate Moment at
all? `1 <= sp <= LH`, T-02's frozen precondition, unchanged. `commitMoment` carries this and nothing
else, because redefining the canonical precondition in interaction terms would collapse the two
concepts. `LH = null` is the technical absence sentinel: before the first mirrored committed Session
Position **nothing** is addressable, which is a correct answer rather than an error.

**Disclosed interaction availability** — `targeting/disclosed-availability.ts`. May T-06 interaction
target it *right now*? Only if it is a member of the currently disclosed Track for this Session.

The second is strictly narrower and is T-06's own. With `LH = 100` and a disclosed prefix through
`SP(80)`, `SP(95)` is a perfectly valid Moment and is **not** an interaction target: nothing has
disclosed it, and the numeric value of `LH` is not a disclosure. Exact entry, relative forward
continuation and the pointer scrub all ask `resolveDisclosedTarget`, which asks the canonical rule
first and disclosed membership second — so the two refusals stay distinguishable (`BEYOND_LIVE_HEAD`
versus `NOT_DISCLOSED`) instead of collapsing into "out of range".

Properties the gate holds:

- membership is checked against the Track's own row (`targets[sp-1].sessionPosition === sp`), never
  inferred from its length and never from `LH`;
- it is Session-scoped, so a replaced Session invalidates the old authority outright;
- disclosure **grows and never rewrites**: a target that becomes disclosed later becomes targetable
  later, and nothing about earlier Product truth changes when it does;
- it is never derived from a pixel, percentage, window offset, viewport bound or scroll position.

Presentation coordinates help a reader *find* a disclosed target. The Timeline bridge turns one into
a disclosed target and then discards it; by the time temporal intent exists, the target is an
integer and the coordinate is gone.

The accessible route is bounded by the same horizon: `exactTargetMaximum` is the disclosure horizon,
not the Live Head, and a forward step is offered only where one really exists.

## 3. `Moment(LH)` is not the Live Edge

`TemporalTargetIntent` has two shapes:

```
{ kind: 'MOMENT', sp }   an ordinary committed Moment target
{ kind: 'LIVE_EDGE' }    a temporal MODE intent
```

There is no conversion between them anywhere in the layer. Reaching, previewing, scrubbing to, or
continuing forward to `SP(LH)` can never quietly mean "go live"; committing it produces `PINNED(LH)`.
The two states then diverge the moment `LH` advances — the pinned view stays, the following view
moves — and TN06-04 proves exactly that.

The Live target is rendered in T-05's outboard slot as its own control. No fake Live Moment is ever
appended to the disclosed Track.

## 4. Preview

`preview/preview-state.ts` is an ephemeral controller with no store, no dispatch, no transport and
no persistence. It cannot mutate Product truth because it holds nothing that could.

- `preview(bounds, candidate, source)` — `PREVIEW_TEMPORAL_TARGET`. Re-asking for the target already
  previewed publishes nothing and bumps no generation, so a scrub inside one disclosed step is free.
- `stepForward(bounds)` — the progress of `RELATIVE_FORWARD_CONTINUATION`.
- `cancel()` — `CANCEL_PREVIEW`. Lossless, non-transactional, safe with nothing to cancel and safe
  repeatedly.
- `reconcile(bounds)` — drops a preview belonging to a replaced Session, and invents no navigation in
  its place.

`generation` is the interruption guard. It increases on every change of preview intent, cancellation
included, so work started for one target (a projection resolution, a settle, an announcement) can ask
`isCurrent(generation)` and discover it is answering a question nobody is asking any more. Generations
are never reused.

`origin` records the committed viewpoint at the start of a preview. It is **evidence only** — nothing
restores from it and nothing writes it back. Presentation restoration reads current committed bounds,
because under `FOLLOW_LIVE` committed truth legitimately advances with `LH` while a preview is open.

### The bounded preview projection

`preview/preview-projection.ts` is the only mechanism by which a preview may show a historical
target, and it makes no-hindsight structural rather than aspirational:

- it asks for `(Session, PTC, MC.depth)`. `K(PTC)` is what was known at `PTC`, so a later object is
  simply not in it — there is nothing to dim, ghost, grey out or "keep for stability";
- `PTC` passes the addressability gate **before** any lookup, so a position beyond `LH` is never
  asked about. No future-history request exists in the layer and none can be constructed through it
  (TN06-09 asserts the lookup was never called);
- the depth is the rung the camera already discloses. A preview never opens a rung not earned;
- `NOT_FETCHED`, `UNAVAILABLE` and disclosed-and-empty stay three different answers. A sparse or
  empty historical view is a correct view, and nothing is borrowed from another position to fill it.

T-06 introduces no transport. It reads what the projection boundary already holds, through an
injected lookup whose shape is exactly `HistoricalDisclosureCache.lookup`.

## 5. Relative forward continuation

`continuation/forward.ts` moves the ephemeral preview target and never canonical state. It holds at
**both** bounds — the authoritative Live Head and the disclosure horizon — and becomes Live intent at
neither. `nextDisclosedTarget` reports which bound was reached (`AT_LIVE_HEAD` versus
`AT_DISCLOSURE_HORIZON`), so a caller can tell them apart; the preview treats both as "hold".

With `LH = 100` and disclosure through `SP(80)`, a continuation from `SP(79)` may reach `SP(80)` and
must then hold. It never manufactures `SP(81)`. When disclosure later grows, a subsequent deliberate
step reaches further.

Ending one is three different things, none implicit:

- `hold()` stops advancing and leaves the target in place;
- the caller then commits it through the established commit boundary, **or**
- `abort()` (input cancellation) discards everything.

No timer, tick count or elapsed duration is Product truth. The cadence is injected, because any
cadence — constant, accelerating, or one step per input — preserves the semantics identically: every
tick goes through the same addressability gate as a single deliberate step. A cadence *policy* is a
presentation decision and remains open for the later motion and input tasks.

## 6. The commit boundary

`targeting/commit.ts` is the one place ephemeral intent becomes committed truth. It is reached from a
completed explicit act — never a gesture frame, never a scroll event, never an animation callback,
and never the arrival of an animation at its end value.

RH behaviour is exactly the frozen behaviour, and TN06-21 proves it: nothing for previews, retargets,
cancellations or repeated preview ticks; one entry per effective commit; nothing for a true no-op;
nothing for a passive `LH` advance in either temporal mode.

## 7. The two promoted acts

`COMMIT_MOMENT_AND_LOCATE` and `CHOOSE_LOCUS` moved from `METADATA_ONLY` to `EXECUTABLE`. Their
frozen names, owners, per-field authorities and transactional categories are unchanged. The six T-07
identities did not move and still fail closed on all three Product entry points.

### The third seam

The kernel gained `dispatchTemporal(action)` and a `TemporalActionAuthority`, following T-04's
pattern exactly — and deliberately as a **separate** authority object:

- the two promoted families are authorized by different owners against different rules, so sharing a
  verifier would let either owner's mint satisfy the other's seam;
- each seam admits only identities of its own family, by name, *before* any authority is consulted —
  so a sideways smuggle is refused by identity rather than by a `WeakSet` miss;
- the raw `dispatch` surface refuses every promoted act and names which boundary was crossed;
- a store built without an authority runs no act of that family at all.

The mint (`authorizeIfLandingMatchesPostAct`) is a module-local function declaration, used at exactly
two call sites and exported nowhere. Only `TEMPORAL_ACTION_AUTHORITY` crosses the module boundary, and
it can answer about an act but never create one. Authorization is object identity in a `WeakSet`,
consumed on use: a structural copy is refused, and a granted act cannot be replayed.

### The authorization rule, and why it is not T-04's

A Map act is authorized while the projection it came from is the store's **current** one, because a
Map act does not move the temporal position.

A composite temporal act *does* move it. Requiring its landing to come from the current projection
would be exactly backwards — it would force the landing to be resolved at the position being **left**,
which is precisely how hindsight enters a locate. So the rule is the same rule applied to the position
the act **arrives** at:

> the landing's projection must be the projection of the canonical viewpoint this act commits to — its
> Session, its effective `TC`, its semantic depth.

`postActState(state, action)` builds that viewpoint as a read-only hypothetical. It is never
published, never stored and never observable; it can differ from real state in exactly one field,
because `TM` is the only Class-A field either act can move that the projection tuple depends on.
`mapContextFreshness` — T-04's ONE shared rule, called and never re-implemented — then answers,
including the disclosure-and-scene coherence check a tuple alone cannot make.

For `CHOOSE_LOCUS` the post-act viewpoint *is* the current viewpoint, so that act reduces to T-04's
rule with no special case.

The composite act additionally requires the caller's stated `moment` to equal the position the
supplied projection describes. Without it, the act would silently commit to whatever position a stale
context happened to describe, and the authorization could never notice.

### Atomicity, zero loci, several loci

`COMMIT_MOMENT_AND_LOCATE` is one transition writing `TM` and the authorized spatial landing together
— therefore one effective transaction and one checkpoint, never a temporal commit followed later by a
separate pan. It writes no `MC.depth` (a locate is not a semantic-zoom move) and no `IF_ref`
(locating is not inspecting).

- **Zero loci** → `NOT_LOCATABLE`. No geography is invented, and *not even the temporal half* happens.
- **Several loci** → `LOCUS_SELECTION_REQUIRED`, carrying the loci. Nothing is written and nothing is
  recorded: no primary context, no Live Focus heuristic, no nearest geometry, no first row, no last
  used. Once the choice exists, the composite act is re-issued with it — still one transaction.

Every locus is verified twice: the runtime brand proves it came from a disclosed scene at all, and
membership proves it is a locus of *this* identity in *this* projection — so a handle minted from
another position, identity or depth is refused rather than trusted for looking well-formed.

### `CHOOSE_LOCUS` resolves an ambiguity, not a landing (R1-03)

`CHOOSE_LOCUS` is the frozen act for an actual contextual ambiguity, and `resolveLocusChoice` counts
the loci **before** it looks at the offered handle:

| Loci at this position | Answer |
| --- | --- |
| zero | `NOT_LOCATABLE` — no geography is invented, and none is chosen |
| exactly one | `NOT_A_LOCUS_CHOICE` — there is no choice to make, and letting the act run would widen it into a generic spatial locate |
| several | an explicit choice is required, and the handle must be a member of this identity's loci in this projection |

The composite act keeps the general landing resolver, so a unique-locus `COMMIT_MOMENT_AND_LOCATE`
still proceeds without manufacturing a chooser. `CHOOSE_LOCUS` itself remains spatial-only: it
preserves `TM` and `IF_ref`, and repeating the already-current landing stays a true no-op.

### The pending choice has a route (R1-04)

A Product state that says "a choice is required" comes with a usable way to make it.
`locus-choice/` is the narrowest truthful substrate for that — not chrome, not art direction:

- `pendingCompositeChoice` can only be built from a genuine `LOCUS_SELECTION_REQUIRED` result, and
  `pendingSpatialChoice` only from two or more loci, so a chooser cannot be manufactured;
- `locusChoiceModel` offers every legitimate locus exactly once, in the disclosed scene's own
  deterministic order, and says out loud that the order is not a ranking. Nothing is preselected,
  defaulted or described as preferable;
- `LocusChoiceSurface` gives each option a `Pressable` (pointer) **and** a container accessibility
  action keyed by the locus rather than by an index (non-pointer, no precision input). Both routes
  call one `choose`, which reaches one `resolvePendingLocusChoice`, which reaches the existing
  executors and the existing runtime authority;
- a submission the chooser does not offer never reaches the executor;
- backing out calls the observer and performs no act at all — there is nothing to undo, because the
  temporal half has not happened;
- a pending choice fails closed when the projection stops being the one the act would commit to: a
  Session replacement or a semantic-depth move refuses it through the shared freshness rule.

One case that deliberately does **not** fail closed: the reader moving elsewhere in time while the
choice is pending. A composite act commits to its own Moment and its landing came from the projection
*of that Moment*, so the pairing is still coherent — the act was always going to move them. Only the
Session, the depth, or the disclosure-and-scene coherence can make it stale.

## 8. Map coupling and the stale-projection firewall

Ordinary temporal navigation is not spatial navigation. `COMMIT_MOMENT` changes the temporal mode
only; the camera and inspection stay governed by their own authority. The composite act is the one
frozen exception, and it is explicit.

After a committed temporal move, T-04's own freshness rule makes the old projection stale: it is not
painted, not hit-tested, not announced and not usable to authorize anything. T-06 does not soften
that, and this layer contains no Map surface at all — so there is no cross-fade, no retained scene,
no "previous scene" fallback and no bridge that would keep stale `V` on screen while a new one
arrives.

## 9. Motion

The motion contract was decided before any animation code existed, and lives in
`motion/temporal-motion.ts` as plain arithmetic that imports nothing.

**Rejected**

| Candidate | Why not |
| --- | --- |
| Presentation scroll, window move, refine, widen | Hundreds of interactions a day, and animating them would blur presentation movement into temporal traversal — a frozen distinction. |
| Cross-fading the Map across a committed temporal move | Keeps the old projection's pixels on screen after the new position is committed: stale `V` presented as current. |
| A camera fly-to on a composite locate | Camera motion is not this task's authority. |
| A repeating "live pulse" as the Live/Pinned distinction | An infinite repeat does not start under reduced motion, so it could never *be* the distinction; as reinforcement it is decoration on a dense functional surface. |
| Any ghost, trail or interpolation between two historical states | There is no truthful in-between: they are different disclosures, not different positions of one thing. |

**Kept** — four, all under 300 ms:

| # | Purpose | Values |
| --- | --- | --- |
| M1 cursor retarget | State indication / preventing a jarring change | `withTiming` 140 ms, `cubic-bezier(0.23, 1, 0.32, 1)`; retargets rather than restarting, so held continuation glides |
| M2 commit settle | Feedback, after the store has already answered | `withSequence` 80 ms up / 120 ms down on opacity + `scale(1 → 1.06)`; never from `scale(0)` |
| M3 cancel return | Spatial consistency | `withSpring` 240 ms, `dampingRatio: 1` — critically damped, so it cannot overshoot past committed truth |
| M4 preview presence | Preview-versus-commit legibility | `withTiming` 160 ms on opacity to `0.72`; a preview marker is never drawn at committed weight |

Rules the numbers encode:

- while a finger is down the cursor tracks it **1:1 with no easing**. Easing a direct manipulation is
  lag, and lag on a scrub reads as the interface disagreeing with the hand;
- reduced motion sets every **movement** duration to zero and keeps the preview's opacity bridge:
  same targets, same preview, same commit, same cancellation, same Map truth, same Live/Pinned
  distinction — only the transition changes;
- the commit settle is **skipped** under reduced motion rather than compressed into a flash, and
  nothing depends on it having played;
- `temporalStance` — the Live/Pinned statement — is derived from the temporal mode alone, so it
  survives reduced motion, a frozen animation and the accessible tree.

### What the mandatory animation review changed

The `review-animations` gate ran against the revised implementation and produced four material
findings plus one robustness point. All are fixed on this branch, and each is pinned by the static
gate so it cannot silently return.

| # | Finding | Fix |
| --- | --- | --- |
| R1-MOTION-01 | Both markers eased against the presentation scroll. `cursorOffsetFor` folded the window offset into the animated value, so scrolling the Timeline — a hundreds-of-times-a-day action that must not animate at all — dragged 140 ms of easing behind the content, and blurred presentation movement into temporal traversal. | Positions animate in the Track's own space (`trackOffsetFor`); the window offset lives in its own **never-animated** shared value and is subtracted in the style. A scroll now moves the markers instantly; only a change of Moment eases. |
| R1-MOTION-02 | Both markers animated in from `translateX: 0` on mount, and again on the first mirrored Moment — a "comes from nowhere" entrance nobody asked for. | The shared values are seeded with the correct first position, and a `placed` guard **sets** the first real target instead of animating to it. |
| R1-MOTION-03 | The commit acknowledgement animated a full-width overlay with no background, border or content — it was invisible. The code comment already claimed it grew "from the marker's own size". | The acknowledgement now rides the committed marker itself as a `scaleY` pulse composed after its `translateX`, and the dead overlay is deleted. |
| R1-MOTION-04 | Reduced motion zeroed the preview's opacity transition too. The standard is *fewer and gentler*, not none — keep opacity, drop movement — and zeroing it made the preview blink in and out, a harsher transition rather than a calmer one. | `presenceMs` survives reduced motion; every duration that moves something still goes to zero. |
| R1-MOTION-05 | The cancel return relied on `withSpring` behaving correctly at `duration: 0` under reduced motion. | At zero duration a `withTiming` is used instead, so reduced motion never depends on a spring's zero-duration case. |

Cleared without change: no `ease-in` anywhere; no `scale(0)` entrance; only `transform` and `opacity`
animate; every duration is under 300 ms; all motion is `withTiming`/`withSpring` on shared values and
therefore retargets rather than restarting; the locus chooser has no motion at all, which is correct
for a surface whose job is to present a choice without implying one.

Two things still need a real device and cannot be judged from code: how the scrub feels when
interrupted mid-flight and reversed, and whether the 140 ms cursor retarget reads as continuous at a
held continuation's cadence on a slow Android device.

### Threading

`timeline-integration/useTemporalScrub.ts` keeps motion on the UI runtime and Product decisions on
the RN runtime:

- the gesture callbacks are worklets writing the finger position and a tracking flag into shared
  values, so the cursor follows the finger without a React render;
- `scheduleOnRN` is never called per frame. A `useAnimatedReaction` watches the derived disclosed step
  index and crosses runtimes only when that index changes — at most once per 48-point step — and once
  more when the gesture ends;
- every Product decision lives in `createScrubHandlers`, as ordinary functions with no gesture, no
  renderer and no worklet, which is why they are tested directly;
- `runOnJS` is absent from the layer: it is removed in Reanimated 4, and `scheduleOnRN` replaces it.

A scrub is a completed act with an unambiguous boundary, exactly like the Map's drag. While a finger
is down nothing canonical happens. A successful end dispatches exactly one commit. Cancellation,
failure, interruption and a competing recognizer winning all land in one path that dispatches nothing
at all — no partial commit, no half transaction, no RH entry.

### Interaction ownership over reordered callbacks (R1-02)

Target crossings and endings are scheduled onto the RN runtime separately, so a callback can arrive
after the gesture that produced it has settled, cancelled, failed or been superseded. Correctness
must not depend on delivery order, so it does not.

Every scheduled callback carries the **epoch** of its gesture — a monotonic counter incremented once
per gesture in `onBegin` — and `createScrubHandlers` keeps a small state machine over it:

| Epoch | Meaning | Effect |
| --- | --- | --- |
| `< current` | an older, superseded interaction | ignored |
| `> current` | the first callback of a newer interaction | adopted, opened |
| `== current`, open | the live interaction | acted on |
| `== current`, closed | already settled or cancelled | ignored |

Adoption on first sight is what makes it order-independent: no separate "open" message can arrive
late or out of turn. A settle closes its interaction *before* acting, so its own in-flight callbacks
are already inert. And an interaction acts only on the preview **it** established — it holds that
preview's generation and re-checks it is still live — so:

- a late target after cancel or after commit reopens nothing;
- an older gesture cannot retarget a newer gesture's preview;
- an older settle or finalize cannot commit or cancel a newer gesture;
- a successful settle owning no target of its own fails closed and commits nothing;
- an unsuccessful ending cannot discard a preview created by the accessible route.

`interaction-race.test.ts` proves this with a deterministic scheduler seam that captures exactly what
`scheduleOnRN` would deliver and flushes it in arbitrary orders — including six interleavings of two
gestures, each with its exact expected outcome sequence and RH length. Two complete gestures
committing twice is correct; a settle that arrives before its own target must fail closed. Nothing in
this file uses a timer, a clock or a microtask as a correctness guarantee.

## 10. Accessibility

Every essential capability has a route needing neither a drag nor a precision pointer: exact disclosed
Moment targeting (typed as a Session Position), preview, commit, cancel, relative forward
continuation, the Live target, and the contextual-locus choice. Each goes through the same gate,
controller and commit boundary as its pointer equivalent — there is no accessibility-only path to
state, and no action is offered that the pointer route could not reach.

Three things the model refuses to say: it never announces a preview as committed truth (the preview is
its own sentence and says so; committed truth keeps its own, unchanged); it never announces
presentation movement as temporal movement (T-05's own "presentation" labels are untouched, and
nothing here derives from a window, offset or percentage); and it never states projection truth — no
count of what exists at a position, no hint of what is coming, no residue of a projection the store has
left.

Temporal targeting is also physically separate: the disclosed Track above scrolls exactly as T-05
built it, and temporal targeting happens on its own strip below, aligned to the same invariant ordinal
geometry. Presentation movement and temporal traversal are told apart by where they are touched as
well as by what they announce.

## 11. Failure and interruption

Every case fails closed, and no failure path leaves canonical state partially mutated: no authoritative
`LH`; target below `SP(1)`; target beyond `LH`; a malformed target; a target absent from the disclosed
Track; a stale historical projection; a projection unavailable or not fetched; a stale Map context; a
zero-locus locate target; a multiple-locus target before the choice; input cancellation; a preview
interrupted by a new target; a preview cancelled while work is in flight (the generation guard); a new
authoritative `LH` while pinned and while following; the same target committed twice (a true no-op);
Session replacement during a preview; a semantic-depth change during a preview or locate; reduced
motion; and animation interruption.

## 12. Registry changes

| Identity | Before | After |
| --- | --- | --- |
| `COMMIT_MOMENT_AND_LOCATE` | `METADATA_ONLY` | `EXECUTABLE` (owner T-06, authority `TM` + spatial, `COMPOSITE_TRANSACTION`) |
| `CHOOSE_LOCUS` | `METADATA_ONLY` | `EXECUTABLE` (owner T-06, authority spatial, `EFFECTIVE_TRANSACTION`) |
| The six T-07 return identities | `METADATA_ONLY` | unchanged — still failing closed |
| `PREVIEW_TEMPORAL_TARGET`, `CANCEL_PREVIEW`, `RELATIVE_FORWARD_CONTINUATION`, `INPUT_CANCELLATION` | `NOT_STORE_ACTION` | unchanged — non-store identities |

Kernel files touched: `actions.ts`, `authority.ts`, `transitions.ts`, `store.ts`, `index.ts`.
`classes.ts`, `history.ts`, `selectors.ts` and `CanonicalStateProvider.tsx` are byte-identical — the
class model, the RH transaction boundary, the Class-B selectors and the React binding did not need to
change for this promotion, which is itself evidence that no new canonical state was introduced.

## 13. Anti-scope

Not implemented here, deliberately: any T-07 return act; final art direction, chrome or copy; T-05
visual styling; the Living Analysis Map's rendering or its projection handoff; T-10's motion-system
ownership beyond what this layer needs locally; T-11's general input and responsive substrate beyond
the narrow seams required; and any change to the server's historical projection.

Nothing under `src/temporal-navigation/` is mounted in the app shell. The T-01 technical container
stays byte-identical, and where the temporal surface appears in the Product is a later task's decision.
`GestureHandlerRootView` must wrap whatever mounts `TemporalTargetLayer`.
