# Return Navigation Layer v1 (T-07)

Return semantics and reversible-history restoration: the six frozen return identities, executable.

The canonical state kernel stays the only authority. This layer decides **when** each act may run
and **with what**, from an explicit user act, and owns exactly the things around that moment — the
runtime return authority, the two one-shot Live Focus bindings, the post-live composite, the World/Z0
return and the consumption of reversible history.

Source: `apps/mobile/src/return-navigation/`. Static contract:
`tests/return-navigation-layer-contract.test.mjs` (`npm run test:return-navigation-layer-contract`).
Behaviour: the ten Jest suites `RN07-A…RN07-J` under `apps/mobile/src/return-navigation/__tests__/`.

Seven modules, and the boundary each one exists to hold:

| Module | What it owns |
| --- | --- |
| `return-actions.ts` | the authorization set, the plan, the action constructor, the mint, the six executors, and the one capability question that needs a proven projection. Nothing but the verifier, the executors and that query is exported. |
| `checkpoint-target.ts` | provenance-bound handles for recorded checkpoints. It can resolve one; it can neither mint nor dispatch. |
| `focus-target.ts` | the one Live Focus → Map target mapping, the landing resolution, and the technical reading of what the client actually holds. |
| `surface.ts` | the entry gate every committed act passes: T-06's Preview cancellation, first. |
| `outcomes.ts` | the outcome vocabulary, and the mapping of one dispatch attempt into it. It cannot dispatch. |
| `availability.ts` | the state-only, Class-A generic availability model. |
| `index.ts` | the whole public surface. |

---

## 1. Six acts, six identities

There is deliberately no `navigate()`, `goHome()`, `reset()`, `goLive()`, `restore()` or
`backOrHome()`. The six have different read-sets, write-sets, history rules and target-binding rules,
and every one of those differences is frozen Product truth that a generic identity would make
unstatable.

| Act | Direct authority | Temporal effect | Spatial / inspection effect | RH |
|---|---|---|---|---|
| `RETURN_LIVE_HEAD` | `TM` | establish `FOLLOW_LIVE` | none | append one pre-act checkpoint iff effective |
| `RETURN_LIVE_FOCUS` | `MC.anchor/orientation/scale/destination` | none | one-shot locate to the referent bound at activation, iff then-legitimate | append iff effective |
| `GO_LIVE_AND_LOCATE` | `TM` + those camera fields | establish `FOLLOW_LIVE` | one-shot post-live locate iff legitimate | **one composite transaction** |
| `RETURN_WORLD` | `MC.depth` + those camera fields | none | the existing canonical World/Z0 camera only | append iff effective |
| `EXACT_RETURN` | `TM`, `IF_ref`, `MC.depth`, camera | restore `PINNED(capturedTC)` | restore the exact captured inspection, camera and depth | consume the target checkpoint and every newer entry; append nothing |
| `BACK_ONE_STEP` | `TM`, `IF_ref`, `MC.depth`, camera | restore `PINNED(capturedTC)` | restore the latest captured inspection, camera and depth | consume exactly the latest entry; append nothing |

No return act writes `LH`, `LF` or the Session. Live truth is authoritative input, never
action-owned output.

The canonical state shape is unchanged: `S = { session, live, temporal, inspection, camera, history }`,
with the effective `TC` derived (`FOLLOW_LIVE → LH`, `PINNED(t) → t`) and exactly two temporal modes.
No `RETURNING`, `SETTLING`, return cursor, return stack, `P5_LF*`, `LF*`, `PTC` or `IF_render` exists
anywhere, persistent or otherwise.

## 2. The independent return authority

`dispatchReturn(action)` is a third store seam with a third, independent `ReturnActionAuthority`.
The store holds only a **verifier**: it can answer whether it authorized this exact action object and
whether that authorization is unused, and it can never mint one.

`return-actions.ts` is the whole executable seam of the layer, and it is deliberately shaped like
T-04's `map-actions.ts` and T-06's `temporal-actions.ts`: the authorization set, the plan types, the
action constructor, the mint and all six executors live in ONE module, and none of the first four is
exported. `runReturnPlan` is a module-local function declaration, so there is no deep import, no
re-export and no future consumer that can reach the mint — the seam is private by construction, not
merely absent from the barrel. It is the only place a return action is constructed, the only
`authorized.add`, and the only call of `store.dispatchReturn`, so a granted action object never
leaves the module. (The outcome module cannot dispatch either: `reportReturnDispatch` maps a thunk
the caller supplies, and never names the canonical seam.) Consequently:

- raw `store.dispatch(...)` refuses every return act by identity, naming the boundary crossed;
- `dispatchMap(...)` and `dispatchTemporal(...)` refuse them by family, before any authority is asked;
- `dispatchReturn(...)` admits only the six, and refuses a Map act, a temporal act, a kernel act, a
  Class C/D identity and an authoritative event;
- a forged action, a structural copy, a JSON round trip and a replay of a consumed authorization all
  fail before the transition runs, so a refusal writes nothing, appends nothing and consumes nothing;
- a store built without a Return authority runs no return act at all;
- neither neighbouring owner's mint satisfies this seam, and this seam's mint satisfies neither of
  theirs, because the three sets are different objects.

TypeScript branding is not the mechanism. The check is object identity in a `WeakSet`, consumed on
use, so a `true` flag, a string token or a brand buys nothing.

A static architecture guard walks every production mobile source file outside the layer and refuses
a deep import of any of its modules — only the barrel is a surface — and any mention of
`runReturnPlan`, `ReturnPlan`, `AuthorizedLanding`, `buildAction`, `requireCurrentContext`,
`resolveCheckpointTarget` or `reportReturnDispatch`. `.dispatchReturn(` is refused there too,
everywhere but the kernel that declares it. So a later consumer cannot acquire the seam, and cannot
bypass Preview precedence, the D1 or P5 binding, Exact Return's target resolution or the canonical
World target by reaching past the six executors.

## 3. RH: append **or** consume, and nowhere else

The transaction boundary in `store.ts` remains the only writer of `history`, and it now has exactly
two moves:

```
normal effective explicit transaction  -> append one pre-act checkpoint
Back / Exact Return                    -> consume through the target checkpoint; append nothing
passive authoritative event            -> no RH
Class C / D identity                   -> no RH
true no-op                             -> no RH
```

`runConsumptionTransaction` is a **separate** path on purpose. Running a restoration through the
append path would record the state being left, so the next Back would step forward again and the two
would oscillate for ever. It proves everything the append path proves — the exact canonical shape,
the immutable Session context, the per-field writer authority — and then reduces history in one
atomic publish. Nothing is appended, no partial restore exists, and only the two identities whose
frozen transactional category is `CONSUMES_RH` can reach it.

A restoration that lands on an identical viewpoint is deliberately **not** a no-op: consuming the
checkpoint is the effect, and suppressing it would leave Back unable to move.

### Targeting a checkpoint without trusting a checkpoint

`EXACT_RETURN` names a checkpoint, and a payload a caller can build is not a name. The public handle
(`ReturnCheckpointTarget`) is opaque and provenance-bound: it exposes an ordinal and nothing else,
and the entry it stands for lives in a module-private `WeakMap`. At execution the provenance is
re-proven against **current** history — and the store re-proves the same thing independently, by
locating the entry object in its own `history` before anything is written. So a structurally perfect
forgery, a copy, a round trip, a handle from another store or Session, an already-consumed target and
a replay after success are each refused with the state and the history left object-equivalent.

`BACK_ONE_STEP` takes no target from a caller at all: it reads the latest entry from the store's own
history, and the store additionally refuses a target that is no longer the latest.

### Restoration is always `PINNED`

```
RestoreTemporal(entry) := PINNED(entry.captured.tc)
```

`tmProvenance` is provenance and nothing else — it is not read by any restore path, and the word does
not appear in the return layer at all. A checkpoint captured while `FOLLOW_LIVE` restores to the
Session Position that was effective *then*:

```
FOLLOW_LIVE @ SP(30) -> pin SP(12) -> live advances to SP(44) -> Back  ==>  PINNED(30)
```

never `FOLLOW_LIVE @ 44`. Only `RETURN_LIVE_HEAD` and the temporal part of `GO_LIVE_AND_LOCATE` may
establish `FOLLOW_LIVE`.

Restoration is canonical intent, not renderability. The exact inspection reference comes back with
its contextual, version and lineage references intact, and the exact camera comes back including the
presence or absence of each optional key; whether the object can be rendered at that position is
historical projection's answer, given afterwards. Nothing is substituted, repaired, recentred or
fetched, and an unavailable object is simply not shown.

## 4. Preview precedence

Every committed return act passes through `committedReturn(surface, run)`, which calls T-06's own
`TemporalPreviewController.cancel()` **first** and only then resolves the act from authoritative
committed state. Cancellation writes no canonical field, so discarding a preview appends no RH entry
and consumes none. The closure receives the store and never the controller, and the layer contains no
expression that reads a preview snapshot — so no return act can resolve a target, a landing or a
checkpoint from `PTC`. T-07 owns no preview state and creates no second controller.

## 5. `RETURN_LIVE_HEAD`

`TM := FOLLOW_LIVE`; `IF_ref`, `MC`, `LH` and `LF` preserved directly. Effective from a historical
position, appending one checkpoint of the complete pre-act viewpoint, so one Back restores that exact
position, inspection, camera and depth. A true no-op when already following Live.

The passive-event trap is closed structurally: `Φ_eff` is compared over the same live truth on both
sides of the transition, so a Live Head that advances while the act is in flight cannot be attributed
to it. There is no activation snapshot to compare against a later settled global state.

## 6. `RETURN_LIVE_FOCUS` — D1

At explicit activation the referent is bound once (`LF* := LF at activation`); `LF*` is transient and
act-local. The landing is resolved against the disclosed projection of the viewpoint the reader is
standing on, through the existing target resolver, and that projection must still be the store's
current one when the act is authorized.

- `TC` and the temporal mode are unchanged; `LF` itself is never written; no persistent follow exists.
- A later Live Focus transition does not retarget the act; a later explicit activation binds the
  then-current referent, which is a different act.
- `NONE` at activation lands nothing and records nothing.
- If the bound referent cannot be placed, the camera does not move — there is no fallback to a newer
  referent and none to anything else.
- Already at the exact entitled landing is a true no-op with no RH churn.
- A scene from another Session, another position, another depth, or from before a later committed
  temporal change, is refused: presence is not entitlement.

The Live Focus → Map target mapping uses frozen identities only, in one place shared with P5:
`NONE →` no target; `EMERGING_FOCUS(id) →` the Map's `EMERGING_FOCUS` family (pregeographic, so a
later Thread Home is never borrowed for it); `ESTABLISHED_THREAD(id) →` the Map's `THREAD` family,
located only through the currently entitled scene.

Several legitimate loci is structurally unreachable for both families under the frozen scene
derivation — a Thread has exactly one permanent Home, an Emerging Focus has none — and the layer
refuses rather than electing one. That impossibility is asserted, not manufactured.

## 7. `GO_LIVE_AND_LOCATE` — P5

```
activation
  -> establish FOLLOW_LIVE as the temporal sub-effect
  -> resolve the authoritative Live Head
  -> at the logical post-live boundary bind ONCE:  P5_LF* := LF at that boundary
  -> locate once iff the bound referent is legitimately locatable at K(LH)
```

The binding is at the post-live boundary because P5 is "go live, and take me to where live attention
is" — not "take me to where attention was when I asked". A transition arriving before that boundary is
bound; one arriving after it is not, because nothing below re-reads `LF`.

**Atomicity.** There is exactly one canonical dispatch. The post-live viewpoint is a local
hypothetical, used to ask for the live projection and to prove the landing against; it is never
published. So there is no intermediate canonical publish, no intermediate checkpoint and no
intermediate Back stop, and one Back after an effective P5 restores the complete pre-P5 viewpoint.

**When the spatial part cannot happen.** A bound referent that is `NONE`, undisclosed at the Live
viewpoint, ungeographic or ambiguous leaves the temporal Live return standing alone — still one act,
still one checkpoint when effective. So does a live projection the client does not hold, and so does a
live scene that has stopped being the Live viewpoint's projection by the time the act is authorized.
Neither a delivery failure nor a stale scene becomes a fabricated claim that there is nowhere to go,
and neither invents a camera movement.

No-op rules: already `FOLLOW_LIVE` and already at the entitled landing records nothing; already
`FOLLOW_LIVE` with a bound referent that cannot be placed and no camera change records nothing.

## 8. `RETURN_WORLD`

Same `TM`, same effective `TC`, same `K(TC)`; the camera becomes the existing canonical World/Z0
target — world origin, canonical orientation, default presentation scale, the `WORLD` rung, no
destination — resolved from the one existing Map helper and never composed here. Nothing is fitted to
what happens to be visible and nothing is recentred on an "important" object. `IF_ref` survives: the
World rung may make its render depth-withheld, which is a derived presentation result, not an erasure
of what the reader asked for. Already exactly there is a true no-op.

## 9. Projection freshness, and why it comes before meaning

Spatial entitlement remains T-04's. The layer calls `mapContextFreshness` in exactly one place, and
always against the viewpoint the act **arrives** at (`postActState`), which differs from the current
one in `TM` alone and only for P5. `mapProjectionRequest` is derived exactly once, for the
hypothetical post-live viewpoint. There is no second locatability algorithm, no second Map disclosure
or cache, no second Live Focus resolver and no transport of any kind.

That one rule is consulted at **two** moments, and both are necessary:

- **before meaning.** `requireCurrentContext` proves the supplied context IS this act's viewpoint
  before any entitlement or locatability question is asked of it. Without that, a stale,
  foreign-Session, wrong-position or wrong-depth scene that simply does not happen to contain the
  bound referent would escape as a semantic `NOT_ENTITLED` or `NOT_LOCATABLE` — a statement about the
  world derived from a projection of somewhere else. Staleness is a fact about the client; it is
  never evidence about the world. Structurally, in every function that asks a projection a semantic
  question, the proof precedes the question, and the static contract asserts that ordering.
- **at authorization.** The mint proves it again, because the viewpoint can move between the two: a
  Live Head advance under `FOLLOW_LIVE`, or a committed temporal change, retires the scene the
  landing was resolved from. A landing may only be dispatched from a projection that is still the
  arriving viewpoint's.

`NOT_FETCHED`, `UNAVAILABLE` and an incoherent held disclosure are reported as one **technical**
outcome (`PROJECTION_NOT_AVAILABLE`) and never as `NOT_LOCATABLE` or `NOT_ENTITLED`: they are facts
about the client, not facts about the world. For P5 every one of these technical answers leaves the
temporal Live return standing alone — still one canonical dispatch, still one Product transaction,
camera untouched and no intermediate checkpoint.

## 10. No hindsight in any result

A return outcome is a status, never a place. Nothing this layer produces carries a Thread or Emerging
Focus identity, a display label, a Home, a direction, a distance, a coordinate, a count of loci, an
accessibility set size or a "go there" hint. `locate` says only what happened to the spatial part of
the act — landed, already there, or one of the truthful reasons nothing moved.

`returnAvailability(state)` is the minimal non-pointer substrate, derived from Class A alone: four
booleans about the reader's own committed viewpoint and a count of the reader's **own** recorded
checkpoints. It says that Live exists and that a route back to Live is available — the generic Live
meta a historical reader is permitted — and nothing else.

It deliberately carries **no Live-Focus capability bit**. `LF != NONE` is live truth, and from a
historical position that is future-relative: a bit derived from it can reveal that a Thread exists
which `K(TC)` does not disclose, which is exactly the future-state information the historical
firewall exists to keep out. It would also overstate the act, because a live Thread with no
legitimate place at the reader's viewpoint is not a landing.

That question is therefore answered only by `liveFocusReturnAvailability(store, context)`, which
proves the projection is this viewpoint's first and then asks the same locatability substrate the act
itself uses. `UNPROVEN` is not a weaker `UNAVAILABLE`: it means the question was never asked, so an
unproven projection leaks nothing either — not even whether a Live Focus exists. It holds no token,
no cache and no capability that could outlive its justification, and it names nothing.

The differential this preserves: two historical states with the same committed viewpoint, camera,
inspection, `RH` and Live advancement, differing only in that one has `LF = NONE` and the other a
future Thread unavailable at `TC`, produce an identical generic model **and** an identical
projection-bound answer.

## 11. Accessibility, RTL and motion

- Every act is a plain function call with a typed outcome: no drag, no precision pointer, no
  coordinate, and no accessibility-only route to state. There is one executor per identity, so no
  generic Home/Back/Live route can collapse the six.
- T-07 adds **no React component and no hook**, so the React lifecycle section is not applicable and
  the static contract asserts that structurally (no `.tsx` file, no React import, no hook call).
- **RTL semantic parity: N/A at geometry level; canonical behaviour is identical.** The layer holds
  no physical geometry at all.
- **Motion status: N/A — no T-07 motion behaviour changed.** Semantic correctness here is fully true
  with motion removed: no animation dispatches a return act, no animation state decides whether RH is
  appended or consumed, and no third "returning" mode exists. T-10 remains the motion-system owner.
- Final return and orientation chrome — copy, colour, icon, layout — is T-08's. Nothing here states
  any of it.

## 12. Boundaries this task did not cross

No third temporal mode, no persistent `RETURNING` / `SETTLING`, no bookmarks, no coarse temporal
stepping, no object-originated version jumps, no dedicated no-op acknowledgement state, no
cross-session Timeline, no Replay, no T-08 chrome, no T-10 reduced-motion controller, no T-11
responsive recomposition, no T-13 restart or persistence, no new Map geography, no new projection
cache, no new Live Focus resolver, no backend/API/schema change, no route history as Product history,
and no generic navigation framework.

The layer imports nothing outside this app: every specifier is a relative module, so T-07 adds no
dependency and moves no lockfile.
