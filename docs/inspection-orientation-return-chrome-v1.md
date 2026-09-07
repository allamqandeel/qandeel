# Inspection + Orientation + Return Chrome v1 (T-08)

Design notes for `apps/mobile/src/orientation-chrome/`.

T-08 makes the already-correct Living Analysis Map understandable and operable as a Product
surface. It invents no navigation semantics. It consumes the owners that already exist — T-02's
canonical state, T-03C's historical disclosure, T-04's Map and entitlement substrate, T-05's
presentation, T-06's temporal interaction and T-07's six return acts — and adds exactly one thing:
a truthful, read-only account of where the reader is, together with controls that reach the
existing executors and no others.

**The Map remains the semantic world. Chrome is support around the world, never a replacement
for it.**

---

## 1. The questions this surface answers

- Where am I in conversational time?
- What am I inspecting?
- How deep am I?
- What contextualizes this inspection?
- Am I Live or historical?
- Has Live continued while I am historical?
- Where is Live Focus, when it is legitimately knowable here?
- What can I return to, and what does each return actually do?

Nothing else. This is orientation, not an analytical report: no statement, no content, no
confidence, no relation, no evidence and no summary.

---

## 2. Freshness before meaning

The order is the whole design:

```
current canonical viewpoint
  -> prove the held disclosure IS this viewpoint's
    -> derive semantic chrome
      -> present actions
```

A projection is authority for exactly the `(Session, effective TC, MC.depth)` it was disclosed
for. Read a stale, foreign-Session, wrong-position or wrong-depth scene as evidence and every
absence in it becomes a confident lie: *that is not there*, *there is nowhere to go*, *it was not
known then*, *there is no context*, *there is no live focus*. None of those is a fact about the
world; all of them are facts about what the client happens to be holding.

So while the held disclosure is not proven current, `orientationModel` derives **no** semantic
answer from it:

| dimension | when the projection is not proven |
| --- | --- |
| inspection | the matching TECHNICAL state, never an absence |
| contextual lineage | empty, not retained |
| contextual appearances | empty, so no chooser exists to be actionable |
| Live Focus capability | `UNPROVEN` — the question was never asked |
| temporal / spatial / generic returns | unchanged; they never depended on a projection |

The rule itself is T-04's ONE shared `mapContextFreshness`, reached through T-04's own
`isCurrentMapContext` and called in exactly one place in the layer. There is no second freshness
algorithm, no projection cache, no second locatability resolver and no second Live Focus resolver
anywhere in T-08.

`ChromeProjection` deliberately carries T-04's own derivation rather than a
`MapInspectionContext | null`, because a single nullable context would collapse *not fetched*,
*the server refused* and *the held disclosure is incoherent* into one absence — and an absence is
exactly what must not be manufactured here.

---

## 3. Five orientation dimensions, kept apart

`types.ts` keeps temporal, spatial, inspection, Live and return as five separate shapes, so that
collapsing any two of them is a type error rather than a wording mistake.

- **Temporal** — `FOLLOW_LIVE` or `PINNED(t)`, the effective `TC`, and whether the pinned position
  is behind the Live Head. `PINNED(LH)` is **not** `FOLLOW_LIVE`: the modes differ, only one of
  them advances when Live does, and returning to Live is still a meaningful act from it. There is
  no third mode and nowhere to put one.
- **Spatial** — the camera's own rung and whether it is at the canonical World viewpoint. Both are
  camera facts. A sparse or empty disclosed viewport is a correct viewport and is never evidence
  about where the camera is.
- **Inspection** — see §4.
- **Live** — see §5.
- **Return** — see §6.

---

## 4. `IF_ref` and `IF_render`

`IF_ref` is the exact thing the reader asked to inspect. It lives in canonical state, only T-04's
inspection acts may change it, and T-08 never writes, repairs, re-elects or "rescues" it. A
projection change can make a reference unrenderable; that is a fact about the projection, never a
reason to quietly inspect something else.

`IF_render` is derived from exactly two inputs: the decoded `IF_ref` (what was **requested**) and
the disclosure's own `HistoricalInspectionResolution` (the three orthogonal **answers** —
knowledge, context, disclosure).

### The one rule

> An identity may be **named** only where the resolution says `knowledge != UNKNOWN_AT_TC`.

Where `K(TC)` confirms the identity, echoing the reader's own request back to them discloses
nothing they did not already supply. Where it does not, the identity may be a future object, and
naming it — or drawing a placeholder shaped like it, or holding a space where it would go, or
counting it — would confirm to a reader standing before it that a future object exists.

`IDENTITY_UNKNOWN_AT_TC` is therefore a member with **no fields at all**. There is nothing on it
to render, which makes the guarantee structural rather than a matter of care.

### The ten states, and why none may be merged

| state | what it means |
| --- | --- |
| `NO_INSPECTION` | the reader is inspecting nothing. Knowable without any projection |
| `RENDERABLE` | named, with the exact requested version intent and disclosed route |
| `IDENTITY_UNKNOWN_AT_TC` | not part of `K(TC)`. Nothing may be named, shaped or counted |
| `CONTEXT_UNAVAILABLE_AT_TC` | the identity is in `K(TC)`; the requested context is not. No substitution |
| `DEPTH_WITHHELD` | known at `TC`, this rung did not earn it. Withheld is not absent |
| `PROJECTION_NOT_FETCHED` | technical: the client has not obtained a disclosure |
| `PROJECTION_UNAVAILABLE` | technical: the server refused, with its typed code |
| `PROJECTION_STALE` | technical: the held disclosure is not this viewpoint's |
| `PROJECTION_INCOHERENT` | technical: the held disclosure produced no usable scene |
| `INSPECTION_NOT_RESOLVED` | technical: this disclosure carries no answer about this inspection |
| `RESOLUTION_MALFORMED` | technical: the answer is not legal, or disagrees with canonical state |

The last six are facts about the client and the transport. None becomes `IDENTITY_UNKNOWN_AT_TC`,
none becomes `DEPTH_WITHHELD`, and none is presented as an absence in the world.

A superseded or not-yet-current version is never called wrong, deleted or never valid: it is a
recorded version of a real lineage, and the reader asked for exactly it. The version intent travels
unchanged through a context switch, because dropping it would silently rebind the reader to the
then-current version — a different request from the one they made.

---

## 5. The historical Live firewall

While historical, the chrome may communicate only two things: that Live has continued, and that a
generic explicit route back to Live exists.

`LiveChrome` has no field for an identity, name, family, category, Home, direction, distance,
offscreen side, marker or count — so two positions differing only in a Live Focus the reader's own
`K(TC)` cannot disclose produce an identical value, because there is nothing on which they could
differ. The Jest matrix proves this differentially over the **entire rendered native tree**, not
over a chosen field: every element, style, label, hint, state and accessibility action is compared.

The one specific capability, "Return to Live Focus", is never derived from `LF`:

- `LF != NONE` is live truth, and from a historical position live truth is future-relative. A
  control whose existence, enabled state, label, hint or accessibility state moved with it would
  leak the presence of a future object through the chrome.
- It would also overstate the capability: a live Thread with no legitimate place at `K(TC)` is not
  a landing.

So the only input is `liveFocusReturnAvailability(store, context)`, asked against a projection
proven to be this viewpoint's. `UNPROVEN` is not a quieter `UNAVAILABLE` — it says the question was
never asked. The label and hint are constants, so they do not move with the answer either.

---

## 6. The six returns stay six Product acts

| act | effect | moves time | moves camera |
| --- | --- | --- | --- |
| `BACK_ONE_STEP` | history | yes | yes |
| `EXACT_RETURN` | history | yes | yes |
| `RETURN_LIVE_HEAD` | temporal | yes | **no** |
| `RETURN_LIVE_FOCUS` | spatial | **no** | yes |
| `RETURN_WORLD` | spatial | no | yes |
| `GO_LIVE_AND_LOCATE` | temporal **and** spatial | yes | yes |

Each control reaches exactly ONE T-07 executor, through a `switch` with one call per arm, so no
payload can redirect one act to another. `movesTime` and `movesCamera` are constants of the frozen
identity: Return to Live Head must never be presented as taking the reader anywhere, Return to Live
Focus must never be presented as going Live, and the composite says it is both rather than being
disguised as either half.

There is deliberately no generic `Home`, `Reset`, `Navigate`, `Go Live`, `BackOrHome` or `Return`:
a generic identity would make the differences between the six unstatable, and every one of those
differences is frozen Product truth. Product Back is never router history.

### The offered set is context-sensitive (R1)

The six **meanings** are always six. What is context-sensitive is which of them a reader is offered.

A permanent six-control matrix — every act rendered, the unavailable ones disabled — is a toolbar,
and a toolbar presents the entire vocabulary of the system as though every part of it were a live
choice. That is the dashboard drift the Product contract forbids. So `returnOrientation` returns
`offered`: the acts that are meaningful *here*, in the frozen logical order, and nothing else. An
empty offered set renders no group at all rather than an empty one.

| act | offered when |
| --- | --- |
| `BACK_ONE_STEP` | something of the reader's own is reversible |
| `EXACT_RETURN` | a bound origin still holds against this store |
| `RETURN_LIVE_HEAD` | a Live Head exists and the committed stance is `PINNED` |
| `RETURN_LIVE_FOCUS` | the projection-bound query says `AVAILABLE` — never raw `LF` |
| `RETURN_WORLD` | the camera is not already at the canonical World viewpoint |
| `GO_LIVE_AND_LOCATE` | a Live Head exists and the stance is `PINNED` |

The composite is deliberately **not** offered while the reader already follows Live: there its
temporal half does nothing, so it would collapse into "move to where attention is now" and become a
second button for one act. Historically it is genuinely a third thing, and it is offered.

Every input to that decision is knowledge-safe — the reader's own history, their own camera, their
own temporal stance, an origin they themselves bound, and for Live Focus the projection-bound answer
alone. So the offered SET is knowledge-safe too: two viewpoints differing only in a Live Focus this
position cannot disclose offer exactly the same acts, and the whole rendered tree is identical.

A meaning is a constant. `returnMeaning(id)` returns the frozen shape of any identity whether or not
it is currently offered, and an offered entry is always deeply equal to it: being offered adds an
entry to a list and changes nothing about what an act claims.

### The Exact Return opportunity (R1)

T-08 never mints a target. It does not read reversible-history internals, does not treat the oldest
recorded checkpoint as an "original inspection", and builds no history browser. T-07 remains the
only authority: it re-proves provenance and presence independently before writing anything.

The first version checked only `isReturnCheckpointTarget(target) && index < checkpointCount`. That
is a *necessary* condition, not a sufficient one, and it left a real Product defect: a handle minted
by ANOTHER store is a genuine handle whose ordinal may well sit inside this store's reversible depth,
so the control was offered, the reader pressed it, and only then did T-07 refuse. Canonical state was
never at risk — but a control that lies about what it can do is a Product defect regardless.

`exact-return-origin.ts` closes it with the narrowest possible presentation binding. A caller turns a
target into an opportunity with `bindExactReturnOrigin(store, target)`; a module-private `WeakMap`
keyed on the opaque handle records the store it was bound against. `exactReturnTargetFor` then
requires all three of:

- the handle is one this module bound (a forged or copied object is not);
- it was bound against **this** store — so a replaced store retires it immediately, and a foreign
  handle is never offered in the first place;
- its ordinal is still within the store's reversible depth — so a consumed or unwound-past origin
  retires itself, including immediately after a successful Exact Return.

It reads no checkpoint internals, serializes nothing, persists nothing, enumerates nothing, and
grants nothing: it hands back the very handle it was given. No T-07 private authority was widened and
no persistent checkpoint identity was introduced.

A target T-07 still refuses at execution is retired too, by object identity, so an ordinary rerender
keeps the retirement, a newly bound opportunity is offered normally, and a remount starts clean.

`checkpointCount` supports generic orientation — a count of the reader's **own** transactions — and
authorizes no named history destination.

---

## 7. Context path and contextual appearance

A context path answers "what am I inside?" without turning the world into a document hierarchy. The
lineage is the exact route T-04 minted when it admitted the target, parsed into steps; a route that
does not parse yields **no** path at all, because a crumb the Product cannot explain still reads as
hierarchy. It is rendered as text, and nothing in it is pressable: a clickable path would claim
there are parents to navigate up into, and there are not. There is one world.

For several legitimate appearances: all are offered, in the disclosed scene's own deterministic
order, with the order explicitly denying that it is a ranking. Nothing is primary, defaulted,
preselected, nearest-by-geometry or chosen by the Live Focus. `current` states only where the
reader **is**, read from their own `IF_ref`; where they are inside no named context, nothing is
marked. One appearance produces no chooser at all — offering a "choice" of one implies that
choosing is something the reader must think about here, which is itself false.

A Thread's own permanent Home is not a row in the chooser: it is where that Thread simply is, not
one of several vantages onto it.

Switching goes through T-04's own `switchContext` executor. The same canonical identity remains
one, and switching creates no relation between the two contexts.

---

## 8. React lifecycle

The surface subscribes through the T-02 kernel's own `useSyncExternalStore` seam, so a replaced
store is resubscribed to rather than remembered, and the chrome is correct independently of
whatever its parent happens to rerender. There is no second copy of `TM`, `TC`, `LH`, `LF`,
`IF_ref`, the camera or `RH`.

The whole orientation answer is recomputed from props and subscribed state on every render, so a
changed callback identity, an extra rerender or a remount cannot alter what any control means or
does. Nothing is captured at mount: the Exact Return target is a prop and is never recaptured, no
context is auto-selected, and no act is replayed. Every executor call happens synchronously inside
the press it belongs to, so there is no asynchronous window in which a late callback could act
after unmount — and the `liveContext` provider T-08 passes down is a pure function that holds no
store and can write nothing.

The single piece of Class-D state is the refused-target marker. It is compared by object identity
and is **subtractive by construction**: it can only ever remove an opportunity, never create one.

An absent outcome observer never suppresses the act. Every handler runs the executor first and
notifies afterwards, because `onOutcome?.(act())` would not evaluate its argument at all when no
observer is attached, silently turning the whole route into a no-op.

---

## 9. Preview, no-ops and outcomes

T-08 duplicates no Preview cancellation. T-06 froze the precedence and T-07 applies it inside every
executor; this layer holds no preview state, creates no controller and never calls `cancel()`.

A no-op stays a no-op: no canonical-looking fake state, no fabricated `RH` entry, no invented
camera movement and no persistent selected state. There is no dedicated no-op acknowledgement
state; `OPEN-19` stays deferred.

There is no raw store dispatch anywhere in the layer.

---

## 10. Accessibility and RTL

Every offered act is its own native button, with its own label and hint. That is the route a screen
reader actually reaches, by touch exploration and by swipe traversal, and it is the same route the
pointer takes — there is no accessibility-only capability and no accessibility-only entitlement.

**R1 corrected an overclaim here.** The grouping `View`s are deliberately non-accessible so they
cannot swallow the independent Pressables, and they also carried `accessibilityActions` which were
documented and tested as a second, non-pointer route. A container that is not an accessibility
element is not focusable, so a screen reader never reaches its custom actions: the route was
asserted but not real. The redundant group actions are now gone rather than re-documented, and the
contract asserts that no `accessibilityActions` exists anywhere in the layer. Nothing here claims
behaviour the platform does not give.

Targets are at least 44pt with hit slop, nothing is drag-only, and no `accessibilityValue` is ever
populated — no set size, child count or position in a total is published.

There is no icon, arrow or chevron anywhere in the surface. An arrow would encode a direction, and
a direction is a claim about where something is — a claim T-08 is never entitled to make, in either
writing direction. Labels carry the whole meaning, so they survive mirroring unchanged: the six
keep their identities, order, labels and states under RTL, and the screen-reader traversal order is
the same logical order. Nothing truncates, so truncation can never reorder or guess an identity,
and Arabic and code-switched identities render verbatim.

---

## 11. Anti-scope

T-08 stores no canonical field, adds no Product act, adds no temporal mode, writes no `TM`, `TC`,
`LH`, `LF`, `IF_ref` or camera, mints no return authorization, reads no reversible-history
internals, builds no history browser, implements no second freshness rule, projection cache,
locatability resolver or Live Focus resolver, fetches nothing, persists nothing, routes nothing,
mounts nothing in the app shell, animates nothing, and adds no dependency at all.

General and final motion belong to T-10, responsive Product recomposition to T-11, final app-shell
integration to T-12, and restart and persistence to T-13. The chrome may be locally compact, but it
implements no responsive Product behaviour: it has no width, breakpoint or layout input, so no
Product answer can depend on one. The only layout-shaped prop is `bottomInset`, a seam for whichever
surface eventually mounts this one — the safe-area provider lives at the app root, and the app root
belongs to a later task.

---

## 12. What proves it

- `npm run test:inspection-orientation-return-chrome-contract` — the static contract: the file
  surface, the allowlisted barrel, the T-07 firewall, no new canonical state or Product act, one
  freshness rule, no raw `LF` shortcut, context-sensitive offering without semantic collapse, the
  copy discipline, the store-bound Exact Return opportunity, the single module-level registry, no
  claimed-but-unreal accessibility route, no dependency, no shell mount, no stolen T-10 / T-11 scope,
  and CI registration.
- The Jest suites under `src/orientation-chrome/__tests__/` — the OC08-A…OC08-M adversarial matrix
  plus the R1 suites (`context-sensitivity`, `no-internals`), including the total differential
  no-hindsight proof over the rendered native tree.

### The contract guards T-08, not the repository (R1)

Every assertion in the static contract is scoped to something T-08 owns, or to a genuinely permanent
invariant. Deliberately absent, because a legitimate later task is expected to change them:

- any global migration census. The first version asserted that no migration beyond the T-08 baseline
  existed; PR #209 then landed an unrelated Supabase keep-alive migration, GitHub tests a merge ref
  against current `main`, and a mobile chrome contract failed over a database keep-alive. Freezing a
  mutable global ceiling freezes the future, not the past;
- any hash of a file a later authorized task will change — the lockfile, the mobile manifest, the app
  shell. "T-08 mounts nothing into the shell" is stated as what it is: an assertion that the shell
  files do not reference this layer;
- any census of the mobile source tree, which a sibling task would break by adding its own owner
  directory. The invariant is that T-08 owns exactly one directory and takes over none.
