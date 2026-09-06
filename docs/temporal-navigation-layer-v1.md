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

## 2. The one addressability gate

`targeting/addressability.ts` is the single place a candidate becomes a temporal target. The only
Product temporal addressing unit is the Session Position: an integer in `[1, LH]`. Nothing in the
judging path reads a timestamp, a wall clock, a pixel offset, a normalized percentage, a window
position, a scroll offset, an animation frame, a gesture velocity, a duration, or a server
knowledge or validity time — and the static gate asserts their absence by name.

`LH = null` is the technical absence sentinel: before the first mirrored committed Session Position
**nothing** is addressable, which is a correct answer rather than an error.

Presentation coordinates help a reader *find* a disclosed target. The Timeline bridge turns one into
a disclosed target and then discards it; by the time temporal intent exists, the target is an
integer and the coordinate is gone.

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

`continuation/forward.ts` moves the ephemeral preview target and never canonical state. It stops at
the authoritative Live Head and holds there: it does not wrap, does not widen the disclosure horizon
and does not become Live intent.

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
- **`CHOOSE_LOCUS`** resolves a choice at the current position. It writes the spatial landing only,
  changes no canonical identity, ranks no appearance, and cannot become a temporal move.

Every locus is verified twice: the runtime brand proves it came from a disclosed scene at all, and
membership proves it is a locus of *this* identity in *this* projection — so a handle minted from
another position, identity or depth is refused rather than trusted for looking well-formed.

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
- reduced motion sets every duration to zero: same targets, same preview, same commit, same
  cancellation, same Map truth, same Live/Pinned distinction — only the transition changes;
- the commit settle is **skipped** under reduced motion rather than compressed into a flash, and
  nothing depends on it having played;
- `temporalStance` — the Live/Pinned statement — is derived from the temporal mode alone, so it
  survives reduced motion, a frozen animation and the accessible tree.

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
