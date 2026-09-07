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

| act | intent | temporal | spatial | inspection |
| --- | --- | --- | --- | --- |
| `BACK_ONE_STEP` | restore the latest captured viewpoint | restored if different | restored if different | restored if different |
| `EXACT_RETURN` | restore the bound inspection exactly | restored if different | restored if different | restored if different |
| `RETURN_LIVE_HEAD` | establish `FOLLOW_LIVE` | direct | **preserved** | preserved |
| `RETURN_LIVE_FOCUS` | locate the live focus once | **preserved** | one-shot, bounded | preserved |
| `RETURN_WORLD` | return to the World viewpoint | preserved | direct | preserved |
| `GO_LIVE_AND_LOCATE` | go Live, then locate once | direct | **conditional** | preserved |

Each control reaches exactly ONE T-07 executor, through a `switch` with one call per arm, so no
payload can redirect one act to another. The promises are constants of the frozen identity: Return
to Live Head must never be presented as taking the reader anywhere, Return to Live Focus must never
be presented as going Live, and the composite states its temporal half as owned and its spatial half
as conditional, so it can be mistaken for neither half — nor for a guarantee.

**R3-03 — why these are not two booleans.** `movesTime` and `movesCamera` could each say only "this
will change" or "this will not change", and four of the six acts fit neither. Back and Exact Return
restore a *captured tuple*, so an individual field may legitimately come back unchanged — the
contract they keep is the target, not the movement. Return to Live Focus attempts the camera once and
an authorization race may make that a no-op. And Go Live + Locate moves the camera only if the
referent it bound at the post-live boundary turns out to be locatable at `K(LH)`; where it is not,
the temporal return still succeeds and the camera does not move, which is a valid result of the one
act rather than a failure of it. At activation T-08 cannot know which will happen — and must not,
because knowing would itself require reading a future-relative fact. So each dimension carries its
own typed promise and the copy is written from it.

The metadata is descriptive. Which executor runs is decided from the frozen identity alone, so
nothing here can become a second authority over what an act does.

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

### The Exact Return opportunity (R2-01)

T-08 never mints a target. It does not read reversible-history internals, does not treat the oldest
recorded checkpoint as an "original inspection", and builds no history browser. T-07 remains the
independent final authority: it re-proves provenance and presence before writing anything, and no
part of that judgement moved into this layer.

What changed in R2 is *presentation* provenance — whether an act may be **offered** at all.

The first candidate checked `isReturnCheckpointTarget(target) && index < checkpointCount`. Both are
necessary; together they are not sufficient, and two real Product defects survived them:

- `isReturnCheckpointTarget` proves only that **some** store minted the handle. A caller could hand
  `bindExactReturnOrigin` a foreign target and this store, and nothing here could tell: the binding
  recorded a claim rather than checking it. The control was offered, the reader pressed it, and only
  then did T-07 refuse.
- An ordinal is **re-occupied**. Consume a checkpoint and the opportunity correctly disappears — but
  record enough unrelated new transactions and the reversible history grows past that ordinal again,
  and a dead target would be offered a second time. A consumed origin must stay dead forever.

Canonical state was never at risk in either case. A control that lies about what it can do is a
Product defect regardless.

Only T-07 knows the answer, because its provenance lives in a module-private map. Architecture
therefore authorized **one** minimal additive read-only predicate on the T-07 barrel:

```ts
isCurrentReturnCheckpointTargetForStore(store, target): target is ReturnCheckpointTarget
```

It answers three questions as a single boolean — T-07 minted this handle; it was minted by **this**
store; and that exact `RhEntry` is still recorded in the current history. It exposes no checkpoint
internals, returns no target, resolves nothing and grants nothing. `resolveCheckpointTarget` remains
private to T-07 and is neither exported nor called from T-08.

`exact-return-origin.ts` asks it twice: once when a caller turns a target into an opportunity, and
again on every render through `exactReturnTargetFor`. Consequently a foreign handle never binds at
all, a replaced store retires the opportunity immediately, and a consumed origin stays retired
**forever** — history regrowing past its old position cannot revive it, because presence is asked
about the entry itself and never about a count.

`ExactReturnOrigin` is now opaque and **empty**. Once provenance is asked of T-07 there is nothing an
ordinal could add except a second, weaker notion of validity that could disagree with the first, so
resurrection is structurally impossible rather than merely checked for.

The module reads no checkpoint internals, serializes nothing, persists nothing, enumerates nothing,
and hands back the very handle it was given.

A target T-07 still refuses at execution is retired too, by object identity, so an ordinary rerender
keeps the retirement, a newly bound opportunity is offered normally, and a remount starts clean.

`checkpointCount` supports generic orientation — a count of the reader's **own** transactions — and
authorizes no named history destination.

---

### Every reader-facing word is written in one file (R2-03)

R1 claimed that all Product copy had been centralized in `product-copy.ts`. It had not: the six
control labels and hints still lived in `return-orientation.ts`, three region names lived in their
components, and the ordering note lived in `context-orientation.ts`. The claim was aspirational and
the contract asserted a proxy for it (no component interpolates a label of its own) rather than the
claim itself.

R2 makes the claim true. `product-copy.ts` now holds every sentence, every control label and hint,
every region name and the ordering note; `return-orientation.ts` keeps the structural half of each
identity — its effect, and what it may therefore promise — and takes its words from
`returnActWords(id)`. The contract asserts the claim directly: outside `product-copy.ts`, no module
of this layer contains a reader-facing string at all, neither a literal carrying whitespace nor a JSX
text node. One file is where a Product writer works, and "no engineering vocabulary reaches the
reader" is checkable there rather than everywhere.

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

**Anti-scope is not the same as a permanent ban (R2-02).** T-10 will bring motion into these
components and T-11 will make them responsive; a contract forbidding those primitives here forever
would be a guard against authorized work. What is permanent, and what the contract now says, is the
separation of powers *inside* the layer: `types`, `inspection-orientation`, `return-orientation`,
`context-orientation`, `model`, `product-copy` and `exact-return-origin` decide what is true and may
never reach an animation, measurement, scheduling or gesture API, nor import a view layer at all. The
components are where later tasks work. Two bans stay layer-wide because no later task makes them
legitimate either: this layer polls nothing (the kernel publishes a subscription seam), and it
introduces no generic navigation act — motion may move pixels, it may never move the reader.

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

- `npm run test:forward-safety-contract` — the repository-wide forward-safety gate. See below.

### A static contract may freeze what its task owns, never a mutable global (R2-02)

A static contract can be written in two shapes that look identical while it passes:

| shape | example | where it belongs |
| --- | --- | --- |
| **permanent invariant** | "the Map is the only spatial authority"; "no truth may depend on a frame clock" | a perpetual static guard |
| **delivery fact** | "the workflow contains exactly these seven gates"; "no migration exists after 0072"; "this manifest has exactly these dependencies" | closure evidence at one SHA |

The second shape is a ceiling on the repository. It fails on correct future work done by people who
have never read the contract that stops them, and it had already happened here twice: an unrelated
Supabase keep-alive migration failed a mobile chrome contract, and a whole-file hash of
`mobile-ci.yml` failed three database contracts that have nothing to do with mobile CI.

R1 re-anchored those. R2 removed the class. Converted repository-wide:

- whole-file hashes of `mobile-ci.yml`, of the root and mobile manifests, and of the lockfile;
- exhaustive lists of the workflow's mobile gate steps;
- exhaustive censuses of root, API and mobile dependencies;
- enumerations of every migration following 0068 / 0070 / 0071 / 0072;
- byte hashes of the app shell and the router root — mounting the Product surfaces there is T-12's
  entire job;
- T-08's own guards that T-10 and T-11 were scheduled to violate: the exact production-file census,
  the blanket ban on motion, measurement, scheduling and gesture primitives across the whole layer,
  and "only relative modules, `react` and `react-native`".

What replaced each is the invariant underneath it. MOB-CI-01's job *shape* stays exact and no gate
may be registered twice, but the gate list may grow. The renderer version stays pinned exactly, but
the manifest may gain a dependency. Each migration is still the sole authority for the objects it
declares, but the chain may grow. The shell may grow, but it never mounts a layer it should not, and
whenever it does mount T-08 it must come through the barrel. Motion, measurement and gestures may
enter the components, but never the modules that decide what is TRUE — because what is true may not
depend on how it is shown, how long it takes to show, or how large the screen is. And T-08 may import
anything the mobile app already declares, but nothing it does not: that, not a manifest census, is
what "T-08 adds no dependency" means.

### Closure evidence at this SHA, which is not the same as a perpetual guard

These were true when T-08 closed, and are recorded here rather than frozen in CI:

- the app shell and the router root reference nothing in `orientation-chrome`; T-08 is mounted
  nowhere;
- the layer imports no animation, measurement, scheduling or gesture API anywhere, in components as
  well as in truth modules;
- `apps/mobile/src/orientation-chrome/` contains exactly the eleven modules listed in §12's contract
  and no others.

### The forward-safety gate

Removing ceilings is half a fix; nothing would stop the next one. So `tests/forward-safety-contract.test.mjs`
proves the property directly. It mirrors the repository into a temporary directory, performs the
authorized future changes that are known to be coming — a new Mobile CI gate, a new migration, T-10
motion, T-11 responsive work, T-12 shell integration, a new root devDependency — and re-runs **every**
real contract against the mutated tree. Not a re-implementation of their assertions: the contracts
themselves, so the gate cannot drift from what they actually check.

The negative half matters as much, because a gate that only proved "everything still passes" would be
satisfied by contracts that assert nothing. So it also performs the mutations that must be refused —
a truth module reaching an animation API, a shell deep-importing past the barrel, a new chrome module
writing its own copy, a chrome module importing an undeclared package, a migration re-declaring an
owned substrate, a duplicated CI gate — and requires the owning contract to fail. Finally it sweeps
every root contract for the ceiling *shapes* themselves, so the class cannot come back.

Two contracts are excluded from the mutation runs and named explicitly: `toolchain` and
`mobile-foundation-toolchain-contract` interrogate git itself — which paths are tracked, which are
ignored — so they are meaningless against a copy that is not a repository. The shape sweep covers them.

---

## 13. R3 — two Product languages, a visible preview, and honest promises

### Arabic and English are both real, and neither is the semantics

`ChromeLanguage` is `'ar' | 'en'`, and it is Class D presentation configuration: not canonical state,
not `RH`, not `TM`, not `TC`, not `PTC`, not projection authority and not return authority. It is a
**required** prop rather than a defaulted one, because defaulting it would quietly elect one of the
two languages as the Product's default, which is not this layer's decision.

Language is an input at the copy boundary and nowhere above it. `orientationModel` takes no language
argument at all, and the model it returns carries no sentence: every string in it is a frozen token
or an opaque handle. That is what makes "the semantic answer is identical in Arabic and in English" a
structural fact rather than a discipline — there is no code path along which the two could disagree,
because the answer is complete before a word is chosen.

Reading direction is a **separate axis**. `I18nManager.isRTL` says how the platform lays a surface
out; it does not say which language a reader reads. An English reader on an RTL device and an Arabic
reader on an LTR one are both ordinary, so neither is inferred from the other anywhere in this layer,
and all four combinations are exercised.

The register is **VI-01's, not this task's**. Every string here is T1 · Chrome under the VI-01
register law, which assigns neutral contemporary Arabic — explicitly not فصحى تراثية and not
MSA-by-default — with no displayed case endings, gender-neutral by default, and the retired
«المشهد» not reintroduced. Two VI-01 divergences shape the English: "context" as a noun does not
ship (Arabic «سياق» is ordinary and approved, so the two languages legitimately diverge), and "live"
does not ship as user-facing English. Numerals are Western in both languages through one formatter,
because this layer's seam is a *language* and carries no region — and `ar` alone does not determine
digits. No regional numeral policy is frozen here; that belongs with T-12's locale provider.

### The preview is looked at, not travelled to

T-08 consumes T-06's published snapshot through a read-only seam that carries `getSnapshot` and
`subscribe` and nothing else, so starting, retargeting, committing or cancelling a preview is a type
error rather than a rule. T-06 and T-07 keep the whole of preview precedence, including the
cancellation every return executor performs for itself.

The transient target is a **sibling** of the committed stance, never a member of it: `mode` still has
exactly two values, so a preview cannot be expressed as a temporal mode and `PTC` cannot be expressed
as `TC`. The copy says both halves out loud — what is being looked at, and that the reader's own
position has not moved — because a preview that does not deny being a commitment reads as one.

### The composite is not offered where it cannot be attempted

Go Live + Locate resolves the live viewpoint's disclosure through a provider the surface supplies.
Without one there is nothing to attempt the spatial half with, so the act is not offered at all, and
no built-in "not fetched" provider stands in to keep the control on screen. Provider presence is a
client capability decided before anything about Live is known: it cannot move with `LF` and it
discloses nothing, so requiring it adds no future-relative input to the offered set.

### "The original inspection" is consumed, never manufactured (R3-04)

Same-store provenance is necessary, and T-07 proves it. It is **not** sufficient to call a checkpoint
the named origin of a real explicit inspection **journey**: a checkpoint recorded by Return to World
is a perfectly valid handle and is not an inspection at all. A public mint over an arbitrary target
therefore let any caller manufacture a Product capability whose name was false — and the earlier
tests did exactly that, binding a Return-World checkpoint and labelling it the original inspection.

T-08 is not app-shell integrated and owns no inspection-**journey** coordinator, so it cannot know
which checkpoint began the journey. The boundary is therefore consumer-only: the opaque capability
and its consumer helpers are public, and the mint is absent from the barrel. Nothing outside this
layer can construct an origin from a target.

> **Deferred, explicitly, to the T-12 integration gate:** establishing the real inspection-**journey**
> origin at the actual journey boundary. T-12 may add a narrow journey-origin coordinator or
> integration seam for it **without reopening T-07's return semantics**. Until such an origin is
> supplied, the Exact Return control is simply absent. T-07 remains the final execution authority and
> re-proves provenance and presence before writing anything.

### The semantic firewall follows the import graph

The permanent claim is that what a reader is told is true may never depend on a frame clock, a
viewport size, a measured layout, a gesture stream or a scheduler. Guarding that with a census of
today's semantic filenames was a proxy: a future `semantic-helper.ts` imported by `model.ts` would
have decided things too and escaped the list. The guard now walks the local import graph from the
semantic roots, so anything reachable is in the closure automatically, at any depth — and a
specifier that leaves the layer must resolve to one of the owner layers T-08 is authorized to
consume, which closes the sideways route as well. Presentation-only motion and responsive work in
the components remain allowed, because T-10 and T-11 own them.

### Pass-through is a property of the subtree

`pointerEvents="box-none"` on the root exempts only the root. Every noninteractive wrapper in this
layer now declares `box-none`, every text-only surface declares `none`, and the only nodes that can
take a press are the controls that mean something. The composition proof mounts the **real**
`MapSurface` beside the **real** `OrientationChrome` and shows a tap that misses the controls reaching
the Map's own route, a control press not falling through, a context-choice press switching context
only, and a stale Map projection staying unavailable while the chrome is on screen. It is a test
composition: nothing is mounted into the app shell, which stays T-12's.

Narrow width is proved with a real 320-point parent and viewport envelope rather than a safe-area
inset. At that width the semantic model, the offered acts, their order and every word are identical
to the wide surface, and canonical state and the camera are untouched — presentation only, in both
languages.
