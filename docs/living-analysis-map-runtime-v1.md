# Living Analysis Map runtime v1 (T-04)

**Status:** implemented, awaiting independent Architecture review.
**Scope:** canonical world projection, camera mechanics, inspection and context navigation on the
mobile client. Not a redesign of Stage 3/4/5, and not the final graphic-language task.

This document records the implementation contract of `apps/mobile/src/map/**` and of the narrow
change T-04 made to the T-02 canonical state kernel. It states what the Map layer is allowed to
decide, what it must take as given, and where each of those boundaries is enforced.

---

## 1. One persistent world

There is ONE Living Analysis Map. Historical, live, inspected, focused, mobile and zoomed states
are projections of that one world, never alternative layouts of it.

The implementation has exactly one geography source: a Thread's ONE permanent Home, read from the
disclosed projection `V` as exact integer text and decoded to `bigint`. There is no second world,
no mobile-specific layout, no historical layout, no inspection map and no renderer-owned
geography. `MapScene` is a derived view of `V`, and the visual renderer, hit testing and the
accessible tree all read that single derivation.

## 2. Layers

```text
apps/mobile/src/map/
  world/          exact OSDAP v1 addresses; the encodings behind T-02's opaque camera refs
  projection/     V -> MapScene (the entitlement boundary of the Map)
  camera/         concrete camera behind MC; Class-D envelope; pan and semantic-zoom interpreters
  inspection/     entitlement, locatability, and the three promoted Map acts
  accessibility/  the same MapScene as native View semantics
  renderer/       placement, hit testing, and the neutral structural Skia canvas
  outcome.ts      the single typed outcome vocabulary and the single dispatch site
```

Dependencies of the whole layer: `@qandeel/runtime` (types only), `@shopify/react-native-skia`,
`react`, `react-native`, `react-native-gesture-handler`. Nothing else, enforced by a static gate.

## 3. Canonical world coordinates

`world/osdap.ts` is the coordinate adapter.

- The scheme is `QANDEEL_OSDAP_V1` and is validated exactly. An unknown scheme is refused, never
  coerced to v1.
- `x` and `y` are `bigint` and never anything else. Canonical text crosses the wire as exact
  integer text; the adapter refuses `parseFloat`, `parseInt`, `Number()` and `Math.round` by
  construction (a static gate asserts their absence).
- The technical bound is `[-(2^62), 2^62 - 1]`. A coordinate outside it is a malformed address and
  is REFUSED. Nothing is clamped, wrapped or rounded into range.
- The coordinate charset accepted here is deliberately the same one the T-03C wire validator
  already admitted, so T-04 can never refuse a Home for a shape reason the projection boundary
  accepted. The *bound* is the OSDAP rule and is enforced fail-closed.
- No Home is ever inferred. An object without one does not receive one, and an Emerging Focus is
  never given the Home of the Thread it was later promoted to: at `TC` that Thread's geography is a
  different fact.
- No analytical object receives an independent world coordinate. A contextual appearance carries
  its host Thread's Home.
- No layout engine exists. Homes are read, compared and re-encoded, never derived.

### Opaque reference encodings (T-04 owns these; T-02 owns the wrappers)

| T-02 opaque ref | T-04 encoding |
| --- | --- |
| `WORLD_ANCHOR` | `{ scheme: QANDEEL_OSDAP_V1, x, y }`, exact integer text |
| `WORLD_ORIENTATION` | `{ scheme: QANDEEL_MAP_ORIENTATION_V1, up: WORLD_Y_UP }` — v1 has exactly one orientation |
| `SCALE_INTENT` | `{ scheme: QANDEEL_MAP_SCALE_V1, worldUnitsPerPointNumerator, worldUnitsPerPointDenominator }` — an exact reduced ratio, never a float |
| `SPATIAL_DESTINATION` | `{ scheme: QANDEEL_MAP_LOCUS_V1, locus, threadId, bindingId, x, y }` — one authorized locus |

Nothing device-shaped can be expressed in any of them. The canonical orientation is encoded as the
*absence* of an orientation key, so encoding and decoding round-trip exactly and `Φ_eff` never sees
a spurious change.

## 4. `V` is the entitlement source

`projection/map-scene.ts` derives `MapScene` from ONE `HistoricalDisclosure` and from nothing
else. It:

- reads Thread Homes from the `WORLD` rung (always present);
- reads Thread↔Reading contextual appearances from the `THREAD` rung;
- reads Emerging Focuses from the `SESSION` rung, with NO locus (pregeographic by frozen truth);
- adds Readings disclosed by the `ANALYTICAL_OBJECT` rung that have no appearance, with NO locus;
- adds no new object family at `SOURCE_PROVENANCE`: deeper disclosure reveals provenance and
  grounding about identities that already exist, and never changes the ontology.

Three absences stay distinct, exactly as T-03C keeps them apart: `NOT_FETCHED` is the absence of a
fetch, `UNAVAILABLE` is a typed server refusal, and a DISCLOSED-and-empty world is a correct,
sparse Map. A rung that is `DEPTH_WITHHELD` is withheld, never empty.

A malformed world — a Home outside the canonical bound, two Homes on one placement, an appearance
whose host Thread is not known at `TC` — fails closed for the whole scene rather than silently
dropping the offending row. A disclosure for another Session, another `TC` or another depth is
refused rather than rendered as this Map.

### Ungeographic identities

An entitled identity with no legitimate locus at `TC` is kept explicitly as *ungeographic*. It is
not dropped (that would hide disclosed truth) and not placed (that would invent geography). The
renderer shows it in a screen-space register that is declared not to be world space, and the
accessible tree announces it as having no place on the map. This is also the 0-loci answer of the
locatability resolver.

### Geometry carries no analytical meaning

Position, proximity, spacing, size, alignment and local packing state nothing about importance,
confidence, truth, causality, ownership, Reading strength, emotional intensity or future
emergence. The one ordering decision the Map makes — the ordinal of a contextual appearance around
its host Home — is a deterministic tie-break derived from already-disclosed facts (the binding's
own Session Position, then its binding identity), assigned per host Home so that a Thread elsewhere
in the world never renumbers another Thread's slots.

## 5. Camera and viewport

Two things are kept apart and can never be confused, because the presentation envelope has no
representation in `MC` at all:

**Canonical navigation intent (`MC`, Class A):** world anchor, orientation, scale intent, semantic
depth, authorized destination.

**Presentation envelope (Class D):** width, height, aspect ratio, safe-area insets, and the visible
footprint derived from them. It never enters `MC`, `Φ_eff` or RH.

The projection is LOCAL. A canonical address is never converted to a float: the exact `bigint`
delta from the camera anchor is divided by the exact scale ratio, and only that camera-relative
quantity becomes a finite `number`. An address whose delta is not finitely representable is
reported as such, never clamped to an edge.

A rotation or a resize recomputes the visible footprint and nothing else. There is no recentring,
no zoom-to-fit, no compaction, no redistribution, and no rescue of a camera that legitimately looks
at empty world. Responsive change does not mean "fit all content".

An undecodable camera is refused rather than repaired with a default: a silently repaired camera is
a camera that moved without a user act.

## 6. Pan

T-02 owns the `PAN` transition; T-04 owns the mapping from an input to an authorized world-anchor
intent, and it is the only place that mapping exists.

- A completed drag produces ONE canonical camera intent. The in-progress translation is Class C/D
  presentation progress: it offsets the renderer's transform and never reaches the store, so a drag
  can never fill RH with frames.
- A cancelled, failed or interrupted gesture dispatches nothing at all and invents no transaction.
- A movement that rounds to no world displacement is not a Product act.
- A movement that would leave the canonical coordinate bound is refused, never clamped.
- No temporal action is emitted, and there is no Live Focus action to emit.
- The non-drag route (`explore left/right/up/down`, one third of the safe area per activation)
  produces the same act with the same authority and the same single checkpoint. Essential Map
  movement is therefore never drag-only.

## 7. Semantic Zoom

Depth is the only semantic authority. A geometric reinforcement (eight times fewer world units per
point per rung, exact) travels with the depth change, but no reader may derive a rung from a
magnitude, and the scale is clamped into a representable band without ever changing the rung.

At the `WORLD` floor and the `SOURCE_PROVENANCE` ceiling nothing is dispatched: a boundary is the
absence of an act, not a no-op act. Depth is not a route stack — there is no screen to push and no
router history to read — and on a narrow viewport the consequence is reduced simultaneity, never a
different world, Home or object.

## 8. The three promoted acts

T-04 promoted exactly three frozen acts to executable, by name, keeping their identities, their
per-field authority and their RH behaviour. A fourth catalog level, `EXECUTABLE`, records that the
owning task has landed the substrate; every other later-owner act stays `METADATA_ONLY` and still
fails closed with `OwnedByLaterTask`.

| Act | Authority | Behaviour |
| --- | --- | --- |
| `INSPECT_OBJECT` | `IF_ref` | `IF_ref := the exact requested reference`. No temporal movement, no `LF`, and no camera write at all — ordinary inspection can never smuggle a locate. |
| `SWITCH_CONTEXT` | `IF_ref` | Same canonical identity, another disclosed appearance. Identity and depth must be identical; a context unavailable at `TC` fails closed. |
| `DIRECT_JUMP` | `IF_ref`, `MC.depth`, `MC.anchor`, `MC.orientation`, `MC.scale`, `MC.destination` | The exact reference, the depth and the camera intent needed to land in ONE identified locus, as one transaction and therefore one checkpoint. Temporal state is untouched. |

An effective act appends exactly one RH checkpoint; a true no-op appends none. Both answers come
from the store's own `Φ_eff` rule, not from a local approximation.

### The authorization boundary (R1-01)

Entitlement is only half the guarantee. The other half is that a caller cannot skip it.

The canonical store therefore has two Product entry points instead of one:

- `dispatch(action: KernelAction)` — the T-02 kernel acts, and only those. A promoted Map act
  dispatched here is refused with `UnauthorizedMapAction` **before any transition runs**, so the
  raw public dispatch surface cannot reach `IF_ref`, the camera or RH for a Map act at all.
- `dispatchMap(action: MapAction)` — the one seam a Map act can reach canonical state through. It
  runs exactly the same admission, per-field guard, `Φ_eff` and RH path, and it runs it only after
  the store's own `MapActionAuthority` has **consumed** an authorization for that exact action
  object.

The authority is a runtime property of object identity, not a claim carried inside the action:

```text
V → resolveEntitledInspection → EntitledInspection (WeakSet-branded)
  → grant(action)              ← module-local to inspection/map-actions.ts, exported nowhere
  → store.dispatchMap(action)
  → MAP_ACTION_AUTHORITY.consume(action)   ← WeakSet membership, deleted on use
  → the existing canonical transaction
```

`grant` is a module-local function declaration in `inspection/map-actions.ts`. It is used at
exactly three call sites — the three executors, each downstream of `resolveEntitledInspection` —
and it is exported nowhere, so nothing outside that file can put an action into the set. What
crosses the module boundary is `MAP_ACTION_AUTHORITY`, whose single member `consume` can *answer*
about an act and can never create one. The store holds that verifier and nothing else: it cannot
mint an authorization, it never reads `V`, and it never learns an entitlement rule, so no part of
the disclosure algorithm is duplicated inside the kernel.

What this refuses, at runtime:

- a structurally perfect `InspectionRef`, `WORLD_ANCHOR` or `SPATIAL_DESTINATION` built with the
  public `opaqueRef` — a different object, not in the set;
- a structurally identical **copy** of a legitimately authorized act — likewise a different object;
- a **replay** of a granted act — the authorization is consumed on first use;
- a `true` flag, a token string or a TypeScript brand — none of them is membership in the set;
- a Map act on a store that was never given an authority — the boundary defaults to shut, so
  forgetting to wire it cannot silently open it.

A caller can of course build *their own* store with a permissive authority; that is a different
store, not a bypass of the canonical one, and the canonical store is constructed once with
`MAP_ACTION_AUTHORITY`. Proven by `AUTH-01 … AUTH-05` in `map/__tests__/authority.test.ts`.

### Entitlement

`inspection/entitlement.ts` is the ONLY place an inspection reference can be minted, and it can
only mint one from `V`. Knowing an identifier entitles nobody to anything:

- a rung that is `DEPTH_WITHHELD` is off-depth: its identities are refused, never dimmed, never
  hidden with opacity and never enumerated "for accessibility";
- an identity absent from a DISCLOSED rung is `UNKNOWN_AT_TC` and is refused;
- a version beyond the then-current one is future truth and is refused; a version the disclosed
  lineage records is admitted exactly as requested;
- a contextual appearance is legitimate only if `V` discloses that exact binding, and only between
  the two endpoints the binding itself names — nothing is inferred from a question type, a gap
  epoch or a turn ordinal.

The minted value is branded at runtime, not merely typed: a structurally identical object this
module did not produce is not an entitlement, so a forged target cannot reach an act. The kernel
receives an already-entitled `InspectionRef` exactly the way `PAN` receives an already-authorized
`WORLD_ANCHOR`; the kernel validates structure, never entitlement.

### Multiple legitimate contexts

When a direct-jump target has several legitimate loci and the request identifies none, the result
is a typed, non-mutating `CONTEXT_SELECTION_REQUIRED` carrying every locus. No primary context is
chosen, the Live Focus is not consulted, geometry is not consulted, the first row is not taken, no
Class-A field is written and no RH entry is appended. The chooser UI is not built here.

When a locus IS determined — uniquely, or by an explicit entitled choice, or because the request
already names a disclosed appearance — the landing reference carries that locus's exact contextual
route, so the target arrives inside its context rather than as an isolated floating object.

## 9. Locatability substrate

`inspection/locatability.ts` answers, over `MapScene` and therefore over `V` alone: zero, one, or
many legitimate loci, with typed, branded locus handles for later owners. It executes none of
`COMMIT_MOMENT_AND_LOCATE`, `CHOOSE_LOCUS`, `RETURN_LIVE_FOCUS`, `GO_LIVE_AND_LOCATE`,
`RETURN_WORLD`, `EXACT_RETURN` or `BACK_ONE_STEP`; those remain T-06's and T-07's, and this module
exists so their owners inherit the mechanics rather than reinvent them.

## 10. Accessibility parity

The accessible tree is a second projection of the same `MapScene`, not a description of the
drawing. Consequently:

- the accessible object set is exactly the entitled disclosed object set for the same depth and
  context — no future object, no off-depth object, no unavailable context;
- there is no accessibility-only geography and no accessibility-only identity;
- an object outside the current viewport stays in the tree (it is entitled and reachable by
  exploring) with its visibility stated rather than implied.

Non-drag routes exist for inspect, semantic zoom in and out, viewport exploration in four
directions, context switching among disclosed appearances, and direct-jump activation where a
unique locus already exists. Context switching is offered only on the object currently inspected
through a named context, and only when a second disclosed appearance exists, so no route has to
elect a context. The T-07 return acts are deliberately absent.

**Role rule.** A collection role publishes a set size to the platform. A set size announced while
any rung of the frozen lineage is still `DEPTH_WITHHELD` would read as a claim about the world
rather than about this disclosure, so the container takes a collection role only when every rung is
disclosed; otherwise the nodes stay individually reachable inside a plain group. No node publishes
an `accessibilityValue`: the Map has no range, no position in a total and no progress to report.

Labels are structural placeholders. Final Product copy, tone and localization belong to the later
chrome and responsive tasks; no label states an analytical fact about an object.

## 11. Structural renderer

`renderer/` proves the world mechanics and finishes no visual language. It paints a plain wash,
plain circles for entitled objects, plain tethers from a contextual appearance to its host Home,
and a plain strip for identities with no place. There is no typography, colour system, material,
iconography, motion language, lifecycle styling or inspection chrome: those are Phase VI's and the
later chrome tasks', and adding them now would make an unfinished decision look decided.

Paint and hit testing share ONE placement function, so a tap hits exactly what is painted. A node
outside the viewport stays in the scene marked `visible: false`: culling is a paint decision, never
a claim about existence.

The Map is deliberately NOT mounted in the app shell. The T-01 technical container stays
byte-identical, and where the Map appears in the Product is a later task's decision.

## 12. OPEN-17

Exactly two tunable values survive, and both are pure paint: `RenderStyle.ambient` (ambient
background wash intensity) and `RenderStyle.emptySpace` (empty-space texture intensity).

The separation is structural rather than a promise: the entitlement, placement and accessibility
layers do not take a `RenderStyle` at all. Two values therefore preserve canonical state, `K(TC)`,
`V`, Home coordinates, `MapScene` semantic membership, placement, hit testing, the accessible
semantic tree and action availability, and differ only in nonsemantic pixels. No third channel may
be added: a tuning value with a semantic consequence is not a tuning value.

## 13. State authority

There is no second navigation store. The Map layer reaches each canonical entry point from exactly
one place — the shared outcome helper: `dispatchKernelAction` for `PAN` and `ZOOM_SEMANTIC`,
`dispatchAuthorizedMapAction` for the three promoted acts — and every act goes through the existing
per-field authority guard, `Φ_eff` no-op detection and RH boundary. The only client-side state the
Map owns is presentation progress: the live drag translation, the viewport envelope and the derived
placement, all Class C/D and incapable of becoming canonical authority.

## 14. Anti-scope

T-04 does not reopen Stage 3/4/5, redesign Home placement, edit T-03C truth rules, create a second
world, derive a semantic relation from geometry, write `LF`, change `TC`/`TM`, implement Timeline
windowing, Preview/PTC/scrub, the T-06 temporal locate, the T-07 return acts, T-08 chrome, T-10
motion, T-11 responsive recomposition or T-13 persistence. It adds no bookmarks (OPEN-06), no
coarse temporal step (OPEN-08), no object-originated version jump (OPEN-09), no dedicated no-op
acknowledgement (OPEN-19), no `MAP_FOCUS_OBJECT`, no generic `navigate()` and no final brand or
graphic-language styling.

## 15. Adversarial proof matrix

| Id | Claim | Where |
| --- | --- | --- |
| M04-01 | Same world across viewports | `camera-viewport.test.ts` |
| M04-02 | Historical filtering never relocates survivors | `map-scene.test.ts` |
| M04-03 | Pan is spatial only | `pan.test.ts` |
| M04-04 | Semantic Zoom is disclosure | `semantic-zoom.test.ts`, `map-scene.test.ts` |
| M04-05 | No hindsight in renderer, hit testing or a11y | `map-scene.test.ts`, `inspection.test.ts`, `accessibility.test.ts` |
| M04-06 | Inspect authority | `inspection.test.ts` |
| M04-07 | Context switch | `inspection.test.ts` |
| M04-08 | Direct jump, unique locus | `direct-jump.test.ts` |
| M04-09 | Direct jump, multiple contexts | `direct-jump.test.ts` |
| M04-10 | Responsive envelope | `camera-viewport.test.ts` |
| M04-11 | RenderStyle reversibility | `render-style.test.tsx` |
| M04-12 | Large BigInt addresses | `world-osdap.test.ts` |
| M04-13 | Accessibility parity | `accessibility.test.ts` |
| M04-14 | LF firewall | `firewall.test.ts` |
| M04-15 | Registry and scope firewall | `firewall.test.ts`, `tests/living-analysis-map-runtime-contract.test.mjs` |
| AUTH-01 | Forged inspect cannot reach canonical mutation | `authority.test.ts` |
| AUTH-02 | Forged context switch cannot reach canonical mutation | `authority.test.ts` |
| AUTH-03 | Forged direct jump cannot reach canonical mutation | `authority.test.ts` |
| AUTH-04 | Legitimate V-resolved paths unchanged | `authority.test.ts` |
| AUTH-05 | Knowing an identifier is not entitlement | `authority.test.ts` |

## 16. Verification

- `npm run test:mobile` — the Jest suites, including the T-04 matrix above.
- `npm run test:living-analysis-map-runtime-contract` — the static boundary gate.
- `npm run test:mobile-canonical-state-contract` — the T-02 gate, re-anchored by exact T-04 name.
- `npm run test:mobile-foundation-contract` — the T-01 gate, re-anchored for the one added pin.
- `npm run typecheck:mobile`, `npm run lint:mobile`, `npm run deps:check:mobile`,
  `npm run doctor:mobile`, `npm run prebuild:mobile`.
- Android and iOS native smoke: mandatory here, because Skia is a native dependency and both the
  mobile workspace and the root lockfile changed, which the classifier reports as native impact.
