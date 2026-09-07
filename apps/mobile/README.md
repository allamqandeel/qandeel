# Qandeel Mobile

React Native (New Architecture) + Expo (Continuous Native Generation) + TypeScript client
for iOS and Android, established by implementation task T-01 as a **technical foundation
only**.

Do not implement product screens before the core text runtime path and its contracts are stable.

## What this workspace is, and is not

- A member of the root npm workspace (`apps/*`). Every dependency is installed and locked
  by the **root** `package-lock.json`. Never create a nested lockfile here and never use
  another package manager or a package runner.
- A minimal technical shell: `src/app/_layout.tsx` (one Expo Router stack),
  `src/app/index.tsx` (the only route) and `src/shell/FoundationShell.tsx`. It proves the
  committed toolchain boots. It carries no Product copy, no visual language, no Product
  screen and no navigation UI. QANDEEL navigation is not a route stack: the canonical
  state / action foundation lives in `src/state/` (T-02, below) and is not mounted in the
  shell.
- Not a Product identity. `Qandeel`, `qandeel`, `com.qandeel.mobile` and the `qandeel`
  URL scheme are provisional technical identifiers needed to generate and boot the shell.
  No store registration and no production build credentials exist for them.

## Canonical state kernel (T-02)

`src/state/` is the canonical client state and action foundation (implementation task
T-02). It is a pure TypeScript kernel with a React binding through the built-in
`useSyncExternalStore`; it adds no dependency, persists nothing and is not mounted in the
technical shell.

- **Class A** is the only stored class: `LH` and `LF` (server-authoritative mirrors), `TM`
  (the pinned target lives inside it; effective `TC` is derived and never stored), `IF_ref`
  (an exact compound of opaque references), `MC` intent (abstract navigation intent as opaque
  references, never device geometry) and `RH`. `K(TC)`, `V`, `IF_render`, `PTC`, the
  presentation window, layout, envelope and animation state have no key in the state.
- **Executable kernel**: `PAN`, `ZOOM_SEMANTIC`, `COMMIT_MOMENT` and `COMMIT_LIVE_EDGE`
  through `dispatch()`, and the authoritative mirror ingestions `LIVE_HEAD_ADVANCED` and
  `LIVE_FOCUS_TRANSITION` through `ingest()`. No client action can write `LH` or `LF`; no
  passive event can write `TM`, `IF_ref`, `MC` or `RH`. The event catalog is closed.
- **Per-field writer authority** is enforced at runtime on every transition result,
  including test-injected transitions, and at compile time by the transition return types.
- **RH**: one append per effective explicit transaction (`Φ_eff` over canonical intent
  only); a true no-op, a passive event and every Class C / D identity write nothing. The
  transaction boundary is the only writer and has exactly two moves — append one pre-act
  checkpoint, or (for the two frozen `CONSUMES_RH` identities T-07 owns) consume through a
  target checkpoint. No transition can reach `history` at all.
- Every frozen Class-A act now has a landed owner and its own authorized seam: the three
  inspection acts (T-04), `COMMIT_MOMENT_AND_LOCATE` and `CHOOSE_LOCUS` (T-06), and the six
  return acts (T-07). The later-owner level and its fail-closed rule (`OwnedByLaterTask`)
  remain for the next frozen act registered at it. Class C / D identities never reach the
  store.
- `LH = null` is a technical absence sentinel only (no authoritative committed Session
  Position mirrored yet): not SP(0), not a Moment, not a temporal mode, never addressable,
  never persistable. `COMMIT_MOMENT` and `COMMIT_LIVE_EDGE` require a real Live Head.

Contract: `npm run test:mobile-canonical-state-contract` (repository root) plus the Jest
suites under `src/state/__tests__/`.

## Temporal boundary (T-03A2)

`src/temporal/` is the non-UI boundary between the server's committed-CU delivery and the
canonical state kernel. It renders nothing, navigates nothing, persists nothing and stores
no credential, and it is deliberately **not mounted** in the technical shell.

- **Runtime wire validation** (`temporal-wire.ts`): delivered JSON is untrusted, so every
  payload is checked against its exact shape and bounds before it can influence canonical
  state — exact keys, the frozen `CONVERSATIONAL_UNITS_COMMITTED` type and version 1,
  safe-integer Session Positions, `firstSp >= 1`, `lastSp >= firstSp`, and
  `unitCount === lastSp - firstSp + 1`. `liveHead` accepts `null` and rejects `0`.
- **The one mirror seam** (`live-head-sync.ts`): the server domain event
  `CONVERSATIONAL_UNITS_COMMITTED` maps to the client mirror event `LIVE_HEAD_ADVANCED`
  through the T-02 `ingest()` seam. The two names are intentionally different layers and
  neither is renamed. A block `firstSp=20, lastSp=23` mirrors once as `toSp=23`; the
  Moments stay addressable by their own Session Positions on the server. Nothing here
  writes `LH` directly, dispatches a Product act, or appends RH. A cross-Session delivery
  is refused, a redelivered head is idempotent, and a stale lower-SP delivery is
  classified as stale — the mirrored head is never retracted.
- **Transport** (`temporal-api.ts`): the base URL, access token and `fetch` are injected by
  the caller. Explicit authenticated HTTP only — a Session temporal snapshot and a bounded
  committed-CU catch-up page. There is no WebSocket and no SSE. Every failure is
  fail-closed.
- T-03A2 delivers authoritative `LH` only through this seam; T-03D (below) delivers
  authoritative `LF` through its own seam. The T-02 meaning of `live = { LH, LF }` is
  unchanged, and no LF value is ever invented on the client.

Types come from the repository-owned, type-only `@qandeel/runtime` workspace package,
imported with `import type`, so it ships no JavaScript into the bundle.

Contract: `npm run test:session-semantic-clock-sp-lh-delivery-contract` (repository root)
plus the Jest suites under `src/temporal/__tests__/`.

## Live Focus ingestion (T-03D)

T-03D activated the FINAL server semantic chain and, with it, the authoritative Live
Focus. `LF` is the Session's **current live conversational attention only** —
`NONE | EMERGING(emergingFocusId) | THREAD(threadId)` — derived by the server from
committed conversation, never by the client, never from elapsed time, and never from
what the Map shows.

- **Wire** (`@qandeel/runtime`): the Session snapshot now carries `liveFocus` and
  `liveFocusAtSp` beside `liveHead`, and the passive domain event
  `LIVE_FOCUS_TRANSITION { sessionId, atSp, value }` is delivered beside
  `CONVERSATIONAL_UNITS_COMMITTED`. The value is the closed reference identity and
  nothing else: no label, no Home coordinate, no direction, no relation count, no
  confidence, no same-SP sequence, no content, no history.
- **Runtime wire validation** (`temporal-wire.ts`): `decodeLiveFocusWireValue`,
  `decodeLiveFocusTransitionEvent`, `decodeLiveFocusEventsPage` and
  `decodeLiveFocusEventsResponse` reject an extra key, a fourth kind, the kernel
  vocabulary on the wire, a non-safe SP, a descending page, two transitions at one SP,
  and a foreign-Session envelope; the snapshot decoder refuses an LF before the first SP
  or beyond the Live Head. New rejection reason: `INVALID_LIVE_FOCUS`.
- **The one LF mirror seam** (`live-focus-sync.ts`): the wire `LIVE_FOCUS_TRANSITION`
  becomes the T-02 mirror event `LIVE_FOCUS_TRANSITION` through the same `ingest()`
  path, mapping `EMERGING → EMERGING_FOCUS` and `THREAD → ESTABLISHED_THREAD`. The two
  vocabularies are different layers and neither is renamed; the kernel is not redesigned.
  Outcomes: `APPLIED`, `IDEMPOTENT` (a redelivery), `OUT_OF_ORDER` (a lower or
  conflicting SP is classified, never applied backward), `REJECTED`. Nothing here writes
  `LF` directly, dispatches a Product action, appends `RH`, moves the camera, or creates a
  persistent focus-follow, and `LH`, `TM`, `TC`, `IF_ref` and `MC` are untouched — also
  while the client is historically pinned. `liveTruthFromSnapshot` builds the startup
  `live = { LH, LF }` so no replay is needed to know the current LF.
- **Transport** (`temporal-api.ts`): `fetchLiveFocusEvents` is the bounded LF catch-up
  route (`/temporal/live-focus-events`) under the same injected-fetch, fail-closed and
  requested-Session-binding rules as the two T-03A2 routes.
- Not here, by design: Return-to-Live-Focus and Go Live + Locate (T-07), any T-03C
  historical projection, and any visual UI. Nothing under `src/temporal/` is mounted.

Contract: `npm run test:effective-live-focus-final-semantic-chain-cutover-contract`
(repository root) plus `src/temporal/__tests__/live-focus-sync.test.ts`.

## Historical disclosure seam (T-03C)

T-03C completed the SP-native history of every v1 exposed family on the server and
delivers it to the client as `V = Disclose(K(TC), semanticDepth, inspectionContext)`.
`K(TC)` (Layer A) is projected by the database for ONE covered Session at ONE
addressable Session Position and never leaves the server; the client receives exactly
the rungs its requested semantic depth discloses.

- **Wire** (`@qandeel/runtime`, `historical-projection.d.ts`): `HistoricalDisclosure` =
  header (`sessionId`, `liveHead`, `tc`, `sealed`, `depth`, `revision`) + the WORLD floor
  (Threads with their ONE Home as exact integer text and their Session-local state, the
  Live Focus at TC) + four rungs that are each `DISCLOSED { value }` or `DEPTH_WITHHELD`
  (Thread ↔ Reading appearances; Moments, Emerging Focuses, Formal Question ↔ Turn
  appearances; Readings with then-current status / version, lineage and `subjectGroundings`
  (the canonical Emerging Focuses each Reading is grounded to, each at its own SP), peer relations,
  Materials with their R-C5 expiry mapping, Information Gaps, Question candidates,
  Confidence resolved CURRENT / SUPERSEDED / PREVALID; Evidence participations) + the
  optional inspection resolution along three orthogonal axes (knowledge, context,
  disclosure). No timestamp, no same-SP sequence, no score, no label, no camera.
- **Runtime wire validation** (`src/projection/historical-projection-wire.ts`):
  `decodeHistoricalDisclosure` rejects an extra key, a rung that disagrees with the
  declared depth, an SP beyond TC, an incoherent header, an endpoint not known at TC, a
  vocabulary outside the closed sets and a Home that is not exact integer text;
  `decodeUnavailableBody` accepts exactly the five typed refusal codes.
- **Transport** (`historical-projection-api.ts`): `HistoricalProjectionApiClient.fetchDisclosure`
  is the ONE route (`/historical-projection?tc=&depth=[&inspect…]`) under the injected-fetch,
  fail-closed and requested-Session / TC / depth binding rules. The server's typed refusals
  (a LEGACY UNCOVERED SESSION, no Live Head yet, a missing baseline, an unaddressable TC, a
  Session not visible) arrive as `UNAVAILABLE` with their exact code — never as an empty
  disclosure, never as `UNKNOWN_AT_TC`.
- **Class-B holder** (`historical-projection-cache.ts`): `HistoricalDisclosureCache` keeps
  `NOT_FETCHED`, `FETCHED` (with `UNKNOWN_AT_TC` and `DEPTH_WITHHELD` inside the value) and
  `UNAVAILABLE` apart; a sealed disclosure is never invalidated, an open-head disclosure is
  dropped when a newer revision of the Session is observed. It writes nothing into the T-02
  kernel: `K(TC)`, `V`, `IF_render`, divergence and the footprint have no key in
  `CanonicalState` by design, and no Product action or `RH` entry is ever produced.
- Not here, by design: Map geometry, Timeline windows, Return-to-Live-Focus and Go Live +
  Locate (T-04 / T-07 / T-08), and any visual UI. Nothing under `src/projection/` is mounted.

Contract: `npm run test:historical-projection-contract` (repository root) plus the Jest
suites under `src/projection/__tests__/`.

## Temporal navigation layer (T-06)

T-06 owns the interaction and substrate around the frozen temporal primitives. It adds no
canonical field, no second temporal cursor and no dependency: `COMMIT_MOMENT` and
`COMMIT_LIVE_EDGE` remain T-02's, and this layer decides only WHEN to call them, from an
explicit user act.

- **Addressability** (`targeting/addressability.ts`): canonical Moment validity, `1 <= sp <= LH`,
  T-02's frozen precondition unchanged. A temporal target is an integer Session Position — never a
  timestamp, a wall clock, a pixel offset, a percentage, a window position, a scroll offset, an
  animation frame, a gesture velocity or a duration. `LH = null` means nothing is addressable yet,
  which is a correct answer rather than an error. `TemporalTargetIntent` has two shapes, `MOMENT(sp)`
  and `LIVE_EDGE`, and no code path converts one into the other.
- **Disclosed availability** (`targeting/disclosed-availability.ts`): the narrower, T-06-owned
  interaction gate. A Moment that `LH` makes valid but nothing has disclosed is not a target — with
  `LH = 100` and a prefix through `SP(80)`, `SP(95)` is a legitimate Moment and not an interaction
  target. Exact entry, forward continuation and the pointer scrub all ask this one rule; membership
  is read from the Track's own row, never inferred from `LH` or from any presentation quantity;
  disclosure grows and never rewrites; a replaced Session invalidates the authority outright.
- **Preview** (`preview/`): `PTC` is Class C. While a preview exists `TM`, effective `TC`,
  `IF_ref`, `MC` and `RH` are all unchanged, and the controller holds no store, no dispatch and
  no transport, so it could not write Product truth even by mistake. A preview is never made by
  moving `TM` and moving it back. `preview-projection.ts` shows a historical target only through
  the disclosure of THAT position, and runs BOTH gates — canonical validity and disclosed
  availability — before any lookup. A cached projection for an undisclosed Moment is therefore
  unreachable: the cache is evidence about what was fetched, never authority about what may be shown.
  Each half of the gate comes from where it is true: canonical bounds are re-derived from the state
  under judgement and the caller's `bounds` snapshot is never read, so a stale or foreign one can only
  narrow what is reachable, never widen it. Authorization is a fact about that call, not a capability
  — no token, brand or projector is exported, and no state survives a call, so there is nothing old
  enough to go stale. No future-history request exists in this layer, and none can be constructed
  through it.
- **Continuation** (`continuation/forward.ts`): repeated forward targeting that holds at BOTH the
  authoritative Live Head and the disclosure horizon, and becomes Live intent at neither. Its cadence
  is injected, never frozen, because no cadence changes the semantics.
- **Commit boundary** (`targeting/commit.ts`): one completed, explicit act → one canonical
  commit. Committing `Moment(LH)` produces `PINNED(LH)`, which stays a different state from
  `FOLLOW_LIVE` and diverges from it as soon as `LH` advances.
- **Promoted acts** (`targeting/temporal-actions.ts`): `COMMIT_MOMENT_AND_LOCATE` and
  `CHOOSE_LOCUS` are executable through a THIRD store seam with their own runtime authority — a
  `WeakSet` consumed on use, whose minting side is module-local and exported nowhere. The
  composite act's landing is resolved against the projection of the position it commits to, and
  is authorized by T-04's ONE shared freshness rule applied to the post-act viewpoint. Zero loci
  invents no geography; several loci elect nothing; and `CHOOSE_LOCUS` is applicable ONLY to a
  genuine multiple-locus ambiguity — a unique locus is a landing, not a choice, and is refused.
- **Locus choice** (`locus-choice/`): the pending contextual-locus choice and its user-facing route.
  Construction is provenance-bound — neither factory accepts a locus list; both derive the complete
  legitimate set from the resolver, and the composite one binds the executor's answer to that
  derivation by position and by exact locus-key set. The result is opaque to the type system and
  branded at runtime, and the brand is checked where the surface is BUILT: a pending choice the module
  did not mint yields no model, so it renders no option and publishes no accessibility action rather
  than displaying a list of contexts the Product cannot vouch for. Every legitimate locus is offered
  exactly once, unranked and unpreselected, with a pointer route and a non-pointer accessibility
  action per option; both converge on one executor. Backing out performs no act and stays reachable
  even when nothing can be offered; a stale Session or depth fails the choice closed.
- **Timeline integration** (`timeline-integration/`): one way only. T-05 identifies a disclosed
  target and gains no store, no dispatch, no selected Moment and no Live commit; scrolling,
  refining and widening the presentation change no temporal state. Temporal targeting lives on
  its own strip below the Track, so presentation movement and temporal traversal are told apart
  by where they are touched as well as by what they announce. Every scheduled scrub callback carries
  its gesture's interaction epoch, so a callback from a settled, cancelled or superseded gesture is
  inert whatever order the two runtimes deliver in — and ownership belongs to ONE coordinator per
  mounted surface, bound to the store and preview controller and reading its observers at call
  time, so a rerender with new callback identities, a replaced controller or an unmount can never
  split it; a retired surface's callbacks are inert. The strip is sized to T-05's own viewport at
  the row's start edge, and `presentation-geometry.ts` is the ONE logical↔physical rule shared by
  the pointer side and the motion side, so under right-to-left the markers rest where T-05 draws
  the same Moments and the outboard Live slot is never Moment-targeting space.
- **Motion** (`motion/`): decided in plain arithmetic first, then bound to Reanimated. Motion
  explains Product truth and never carries it — the pure contract imports nothing at all, the
  binding holds no store, and the commit acknowledgement is called with the store's answer
  already in hand. Four transitions, all under 300 ms; reduced motion collapses every movement to
  zero (keeping the preview's opacity bridge) while changing no target, capability or stance.
  Positions animate in Track space and become physical only in the style, through the shared
  geometry, with the window offset, viewport and direction in never-animated shared values.
- **Accessibility** (`accessibility/`): exact targeting, preview, commit, cancel, forward
  continuation and the Live target each have a route needing neither a drag nor a precision
  pointer. A preview is announced as a preview, committed truth keeps its own sentence, and
  nothing announces presentation movement as temporal movement. The container is a plain layout
  View; the stance and preview live on a dedicated leaf summary element that also carries the named
  actions, and the exact-entry input and the four controls are individually focusable siblings — no
  accessibility element in the layer owns an interactive descendant.
- Not here, by design: the T-07 return acts (their own layer, behind their own authority), the
  Map's own projection handoff, final chrome and art direction, and the general input and
  responsive substrate (T-11). Nothing under `src/temporal-navigation/` is mounted in the shell.

Contract: `npm run test:temporal-navigation-layer-contract` (repository root) plus the Jest
suites under `src/temporal-navigation/__tests__/`. Design notes:
`docs/temporal-navigation-layer-v1.md`.

## Return navigation layer (T-07)

`src/return-navigation/` turns the six frozen return identities into executable Product behaviour.
They stay six different acts: there is no `navigate()`, `goHome()`, `reset()`, `goLive()`,
`restore()` or `backOrHome()`, because every difference between them is frozen truth a generic
identity would make unstatable.

- **Authority and the six acts** (`return-actions.ts`): a THIRD store seam (`dispatchReturn`) with its
  own runtime authority. Shaped like T-04's `map-actions.ts` and T-06's `temporal-actions.ts`, the
  authorization set, the plan, the action constructor, the mint and all six executors live in ONE
  module and none of the first four is exported — so the seam is private by construction, not merely
  absent from the barrel, and a static guard refuses any deep import or mention of it from production
  source outside the layer. Raw dispatch refuses every return act by identity; the Map and temporal
  seams refuse them by family; a forged, copied, round-tripped or replayed act fails before the
  transition runs; and a store built without a Return authority runs none of them at all.
  - Return to Live Head is temporal only; Return to Live Focus binds its referent once at activation
    and never chases a newer one; Go Live + Locate binds once at the post-live boundary and is ONE
    composite transaction, with no intermediate publish, checkpoint or Back stop; Return to World
    uses the existing canonical World/Z0 camera target, called from the Map layer's one helper, and
    `IF_ref` survives — only its render may become depth-withheld.
  - `Back One Step` restores the latest checkpoint and removes exactly it; `Exact Return` restores a
    named one and consumes it with every newer entry, on a separate guarded consumption transaction.
    Neither appends, so a Back chain walks strictly backwards and can never oscillate forward. Every
    restoration is `PINNED(capturedTC)` — `tmProvenance` is provenance only and is never read — and
    the exact inspection, camera and depth come back unrepaired.
- **Checkpoint targets** (`checkpoint-target.ts`): the Exact Return target is an opaque,
  provenance-bound handle, re-proven against current history by both the layer and the store.
  Resolving one grants nothing: it can neither mint nor dispatch.
- **Freshness before meaning** (`focus-target.ts` + the act module): a projection is proven to BE the
  arriving viewpoint's before any entitlement or locatability question is asked of it, and proven
  again before it may authorize a landing. A stale, foreign-Session, wrong-position or wrong-depth
  scene is a technical fact and can never escape as a semantic "not disclosed" or "no place here".
  The semantic resolver itself is layer-internal: the public barrel is a pinned allowlist that keeps
  only the technical `returnMapContext` half, so the gate cannot be walked around by a legal import.
- **Preview precedence** (`surface.ts`): every committed act cancels T-06's preview first, then
  resolves from committed state. The layer holds no preview state and cannot read `PTC` at all.
- **Availability** (`availability.ts`): the minimal non-pointer substrate, from Class A alone —
  booleans about the reader's own committed viewpoint and a count of their own checkpoints. It
  carries no Live-Focus capability bit: `LF != NONE` is future-relative from a historical position
  and would overstate the act besides, so that question is answered only against a projection proven
  to be this viewpoint's, by `liveFocusReturnAvailability`. No identity, label, Home, direction,
  distance, coordinate or locus count is exposed anywhere.
- Not here, by design: final return and orientation chrome (T-08), the motion system (T-10),
  responsive recomposition (T-11), restart and persistence (T-13). The layer is pure TypeScript with
  no component, no hook, no geometry and no motion, it adds no dependency at all, and nothing under
  `src/return-navigation/` is mounted in the shell.

Contract: `npm run test:return-navigation-layer-contract` (repository root) plus the Jest suites
under `src/return-navigation/__tests__/`. Design notes: `docs/return-navigation-layer-v1.md`.

## Inspection + orientation + return chrome (T-08)

`src/orientation-chrome/` makes the already-correct Living Analysis Map understandable and
operable as a Product surface. It invents no navigation semantics: it consumes T-02, T-03C,
T-04, T-05, T-06 and T-07 through their public barrels and adds one read-only account of
where the reader is, plus controls that reach the existing executors and no others.

- **Freshness before meaning** (`model.ts`): current canonical viewpoint, then prove the held
  disclosure IS this viewpoint's, then derive semantic chrome, then present actions. While the
  projection is not proven current, NO semantic answer is derived from it: the inspection state
  becomes the matching technical state, the lineage and appearance list are empty rather than
  retained, and the Live Focus question is `UNPROVEN` — the statement that it was never asked,
  not a quieter `UNAVAILABLE`. The rule is T-04's ONE shared rule, reached through
  `isCurrentMapContext` and called in exactly one place; there is no second freshness algorithm,
  no projection cache, no second locatability resolver and no second Live Focus resolver.
- **Five orientation dimensions stay apart** (`types.ts`): temporal, spatial, inspection, Live
  and return are five different questions, kept separate in the type system so that a collapsed
  answer is a type error rather than a wording mistake. The temporal, spatial and generic return
  facts are entailed by Class A alone and stay truthful with no projection at all.
- **`IF_ref` vs `IF_render`** (`inspection-orientation.ts`): `IF_ref` lives in canonical state and
  is never rewritten, re-elected or "rescued" here. `IF_render` is what the selected disclosure may
  legitimately show of it, under ONE rule — an identity may be named only where the resolution says
  `knowledge != UNKNOWN_AT_TC`. `IDENTITY_UNKNOWN_AT_TC` therefore has no fields at all: there is
  nothing on it to render and no target-shaped hole to leave. `DEPTH_WITHHELD`, `NOT_FETCHED`,
  `UNAVAILABLE`, `PROJECTION_STALE`, `INSPECTION_NOT_RESOLVED` and `RESOLUTION_MALFORMED` stay
  separate members; none becomes an absence in the world, and a superseded or not-yet-current
  version keeps its exact lineage intent and is never called wrong, deleted or never valid.
- **The six returns stay six, and the offered set is context-sensitive** (`return-orientation.ts`,
  `ReturnControls.tsx`): each control reaches exactly one T-07 executor through a `switch` with one
  call per arm. Return to Live Head is temporal only and promises no camera movement; Return to Live
  Focus is spatial only and promises no temporal movement; Go Live + Locate says it is both, as ONE
  transaction, and is offered only while the reader is historical — following Live it would collapse
  into Return to Live Focus. Only the acts that are meaningful right now are rendered: a permanent
  six-control matrix is a toolbar, which is the dashboard drift the contract forbids. The six
  MEANINGS are untouched by that — `returnMeaning(id)` is a constant whether or not an act is
  offered — and every input to the offer is knowledge-safe, so the offered set leaks nothing either.
  There is no generic `Home`, `Reset`, `Navigate`, `Go Live`, `BackOrHome` or `Return`, and Product
  Back is never router history.
- **No engineering vocabulary reaches the reader** (`product-copy.ts`): every word the chrome can
  say is written in one module. A family is named in plain language and never as its wire token; a
  rung is named by what it discloses and never as its enum; a projection refusal is a sentence about
  what the Product can show and never a transport code; and no identifier of any kind — canonical
  id, binding id, locus key or lineage token — is ever spoken or drawn, in any script. The typed
  distinctions behind the words are untouched.
- **No hindsight** (`OrientationChrome.tsx`): while historical, the chrome says only that the
  conversation has continued and that an explicit route back exists. Two viewpoints differing only
  in a Live Focus this position cannot disclose render an IDENTICAL native tree — same labels,
  hints, disabled states and accessibility actions — because nothing here reads `LF`. The one
  specific capability comes from `liveFocusReturnAvailability` against a proven projection, and
  adds no metadata about its target.
- **Contextual appearance** (`context-orientation.ts`): the lineage is the exact route T-04 minted
  from `V`, rendered as the SHAPE of the route in words — "Inside a thread, inside a context" — and
  never as a clickable page breadcrumb or a string of ids. Several disclosed appearances are all
  offered, in the disclosed scene's own order, with the note that the order is not a ranking;
  nothing is primary, defaulted or preselected, and `current` states only where the reader is.
  Options are distinguished by the two things a reader already has — whether this is the context
  they are looking through, and the Moment the appearance was taken up at. `V` discloses no
  human-readable name for a Thread, so when two appearances cannot be told apart that way the
  chooser **fails closed**: nothing is invented and no internal handle is exposed. One appearance is
  not a choice either. Switching goes through T-04's own executor carrying the requested version
  intent.
- **Exact Return** stays opaque and its provenance is asked of T-07 (`exact-return-origin.ts`): T-08
  never mints a target, never reads reversible-history internals, never treats the oldest checkpoint
  as an original inspection and builds no history browser. A caller turns a target into an
  opportunity with `bindExactReturnOrigin`, which is refused unless T-07's own
  `isCurrentReturnCheckpointTargetForStore` confirms all three of: T-07 minted this handle, THIS
  store minted it, and that exact history entry is still recorded. The same question is re-asked on
  every render, so a handle from a foreign or replaced store is never offered at all, and a consumed
  origin stays retired forever — the opportunity carries no ordinal, so history regrowing past its
  old position cannot revive it. The predicate returns a boolean and nothing else: it exposes no
  checkpoint internals, and `resolveCheckpointTarget` stays private to T-07, which remains the
  independent final authority and re-proves provenance and presence at execution.
- **Lifecycle**: subscribed through the T-02 kernel's own seam, so a replaced store is
  resubscribed to rather than remembered. The whole answer is recomputed from props and subscribed
  state every render, so callback churn, extra renders, remounts and store replacement cannot
  rebind a target, elect a context or replay an act. The one piece of Class-D state is subtractive
  and can only ever remove an opportunity.
- **Accessibility and RTL**: every offered act is its own native button with its own label and hint —
  that is the route a screen reader actually reaches. The grouping containers are never `accessible`
  so they cannot swallow the buttons, and precisely because they are not focusable they publish no
  custom actions either: a non-focusable container's actions are not a discoverable route, and
  claiming them as one would document behaviour React Native does not provide. Targets are at least
  44pt with hit slop and nothing is drag-only. There is no icon, arrow or chevron anywhere, so
  mirroring has nothing directional to invert; the offered set, its order, its labels and its hints
  are identical under RTL, and an Arabic or code-switched world produces the same internal-free
  chrome in both writing directions.
- **One copy module**: every sentence, control label, control hint, region name and the ordering note
  are written in `product-copy.ts` and nowhere else, which is what makes "no engineering vocabulary
  reaches the reader" checkable in one file. The static contract asserts it directly: outside that
  module, no file of the layer contains a reader-facing string at all.
- Not here, by design: general and final motion (T-10), responsive recomposition (T-11), final
  app-shell integration (T-12) and persistence (T-13). As delivered, nothing under
  `src/orientation-chrome/` is mounted in the shell and the layer reaches no animation, measurement,
  scheduling or gesture API. What the contract *permanently* forbids is narrower and survives those
  tasks: the modules that decide what is true may never reach any of it, whatever the components
  later do, and every non-relative import must already be declared by this app.

Contract: `npm run test:inspection-orientation-return-chrome-contract` (repository root) plus the
Jest suites under `src/orientation-chrome/__tests__/`. Design notes:
`docs/inspection-orientation-return-chrome-v1.md`.

## Repository forward-safety gate

`npm run test:forward-safety-contract` (repository root) mirrors the repository, applies the
authorized future changes that are known to be coming — a new Mobile CI gate, a new migration, T-10
motion, T-11 responsive work, T-12 shell integration, a new root devDependency — and re-runs every
static contract against the mutated tree, then requires the mutations that must be refused to fail.
It exists because a static contract that freezes a file the whole repository shares will break
correct work done by someone who never read it, which has already happened twice here.

## Toolchain pins (Expo SDK 57)

| Package | Pin |
| --- | --- |
| `expo` | `~57.0.20` |
| `react-native` | `0.86.3` (the New Architecture is the only architecture on this SDK line; there is no toggle) |
| `react` / `@types/react` | `19.2.3` / `~19.2.2` |
| `expo-router` with `react-native-screens ~4.26.0`, `react-native-safe-area-context ~5.7.0`, `expo-linking ~57.0.9`, `expo-constants ~57.0.17`, `expo-status-bar ~57.0.1` | `~57.0.19` |
| `expo-dev-client` | `~57.0.18` |
| `react-native-reanimated` / `react-native-worklets` / `react-native-gesture-handler` | `4.5.1` / `0.10.1` / `~2.32.0` (mechanically required: `expo-router` depends on `react-native-drawer-layout`, whose non-optional peers are Reanimated and Gesture Handler; pinned to the SDK 57 bundled versions, not used by the shell) |
| `typescript` | `~5.9.3` (intentional exception, see below) |
| `jest` / `jest-expo` / `@types/jest` | `~29.7.0` / `~57.0.5` / `^29.5.14` |
| `@testing-library/react-native` / `test-renderer` | `^14.0.1` / `^1.2.0` |
| `expo-doctor` | `^1.20.4` |
| `eslint` / `eslint-config-expo` | `^9.39.5` / `~57.0.2` |

Node.js 22.13.0 or newer is required (repository root `engines`).

## Intentional TypeScript exception

Expo SDK 57 templates ship TypeScript 6.x. This workspace pins `typescript ~5.9.3` on
purpose and declares the exception in `package.json` through Expo's documented
dependency-validation exclusion, `expo.install.exclude`:

```json
{ "expo": { "install": { "exclude": ["typescript"] } } }
```

Why: the repository holds exactly one TypeScript line. The API's root scripts invoke the
root-hoisted `tsc` by path, so a second major would make API type-checking depend on npm's
hoisting order, and TypeScript 6 deprecates options the root `tsconfig.base.json` relies
on. `expo/tsconfig.base` needs only options available since TypeScript 5.5. Moving the
repository to TypeScript 6 is a separate toolchain task, never part of the mobile
foundation.

The exclusion is honoured by `expo start`, `expo-doctor` and `expo install --check` /
`--fix`. Both `npm run deps:check` (`expo install --check`, non-mutating) and
`npm run doctor` (`expo-doctor`) must pass with no unresolved TypeScript mismatch; the
dependency version check is never skipped.

## Continuous Native Generation policy

`ios/` and `android/` are generated by `expo prebuild` and are **never committed**. Manual
edits to generated native projects are not canonical source. Native customization follows
the frozen hierarchy:

1. supported Expo / React Native APIs and maintained libraries (default);
2. an idempotent Expo config plugin (pre-authorized; idempotency is asserted in CI);
3. an Expo Module or explicit native module (pre-authorized with the frozen requirement named);
4. direct manipulation of generated native files or dangerous mods: **not pre-authorized**;
   it requires a separate Engineering Architecture review.

`npm run prebuild:verify` proves two properties and then discards the generated directories
and requires an unchanged repository state: (1) re-running `expo prebuild --no-clean` over
the generated project leaves every file byte-identical (idempotent re-application, the
Level-2 property), and (2) two clean generations are identical modulo the random Xcode
object identifiers that the project generator assigns on every run.

## Commands

Run from the repository root; each delegates to this workspace:

```sh
npm run typecheck:mobile
npm run lint:mobile
npm run test:mobile
npm run deps:check:mobile
npm run doctor:mobile
npm run prebuild:mobile
npm run start:mobile
```

`npm run start:mobile` starts the dev server for a development build (`expo-dev-client`).
Expo Go is not a target.

## Continuous integration

`.github/workflows/mobile-ci.yml` runs the gates above, then generates the native projects
and proves that the shell boots:

- **Android** (`ubuntu-latest`, Node 22, Temurin JDK 17): Release APK, API 36 x86_64
  emulator, Maestro boot smoke.
- **iOS** (`macos-26`, Node 22, Xcode 26.6 selected explicitly): Release simulator build,
  iPhone 17 / iOS 26.5, Maestro boot smoke.

Maestro is pinned to `cli-2.10.0` and verified against a literal SHA-256 before
extraction. The boot smoke (`.maestro/boot-smoke.yaml`) only asserts that the technical
shell is visible; no gesture or accessibility Product suite exists yet.

## Security boundary

No provider keys, credentials or secret-bearing environment files belong in this workspace
or in the app bundle.
