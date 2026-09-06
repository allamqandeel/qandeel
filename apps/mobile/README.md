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
  only); a true no-op, a passive event and every Class C / D identity write nothing.
  Restoration and the return acts belong to T-07.
- Every other frozen act (`COMMIT_MOMENT_AND_LOCATE`, `CHOOSE_LOCUS`, the six return acts
  and the inspection acts) is registered as metadata only and fails closed
  (`OwnedByLaterTask`) until its owning task lands. Class C / D identities never reach the
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

- **Addressability** (`src/temporal-navigation/targeting/addressability.ts`): the single gate.
  A temporal target is an integer Session Position in `[1, LH]` — never a timestamp, a wall
  clock, a pixel offset, a percentage, a window position, a scroll offset, an animation frame,
  a gesture velocity or a duration. `LH = null` means nothing is addressable yet, which is a
  correct answer rather than an error. `TemporalTargetIntent` has two shapes, `MOMENT(sp)` and
  `LIVE_EDGE`, and no code path converts one into the other.
- **Preview** (`preview/`): `PTC` is Class C. While a preview exists `TM`, effective `TC`,
  `IF_ref`, `MC` and `RH` are all unchanged, and the controller holds no store, no dispatch and
  no transport, so it could not write Product truth even by mistake. A preview is never made by
  moving `TM` and moving it back. `preview-projection.ts` shows a historical target only through
  the disclosure of THAT position, and runs the addressability gate before any lookup — so no
  future-history request exists in this layer, and none can be constructed through it.
- **Continuation** (`continuation/forward.ts`): repeated forward targeting that stops at the
  authoritative Live Head, holds there, and never becomes Live intent. Its cadence is injected,
  never frozen, because no cadence changes the semantics.
- **Commit boundary** (`targeting/commit.ts`): one completed, explicit act → one canonical
  commit. Committing `Moment(LH)` produces `PINNED(LH)`, which stays a different state from
  `FOLLOW_LIVE` and diverges from it as soon as `LH` advances.
- **Promoted acts** (`targeting/temporal-actions.ts`): `COMMIT_MOMENT_AND_LOCATE` and
  `CHOOSE_LOCUS` are executable through a THIRD store seam with their own runtime authority — a
  `WeakSet` consumed on use, whose minting side is module-local and exported nowhere. The
  composite act's landing is resolved against the projection of the position it commits to, and
  is authorized by T-04's ONE shared freshness rule applied to the post-act viewpoint. Zero loci
  invents no geography; several loci elect nothing.
- **Timeline integration** (`timeline-integration/`): one way only. T-05 identifies a disclosed
  target and gains no store, no dispatch, no selected Moment and no Live commit; scrolling,
  refining and widening the presentation change no temporal state. Temporal targeting lives on
  its own strip below the Track, so presentation movement and temporal traversal are told apart
  by where they are touched as well as by what they announce.
- **Motion** (`motion/`): decided in plain arithmetic first, then bound to Reanimated. Motion
  explains Product truth and never carries it — the pure contract imports nothing at all, the
  binding holds no store, and the commit acknowledgement is called with the store's answer
  already in hand. Four transitions, all under 300 ms; reduced motion collapses every one of them
  to zero while changing no target, capability or stance.
- **Accessibility** (`accessibility/`): exact targeting, preview, commit, cancel, forward
  continuation and the Live target each have a route needing neither a drag nor a precision
  pointer. A preview is announced as a preview, committed truth keeps its own sentence, and
  nothing announces presentation movement as temporal movement.
- Not here, by design: the T-07 return acts (still later-owner metadata, still failing closed),
  the Map's own projection handoff, final chrome and art direction, and the general input and
  responsive substrate (T-11). Nothing under `src/temporal-navigation/` is mounted in the shell.

Contract: `npm run test:temporal-navigation-layer-contract` (repository root) plus the Jest
suites under `src/temporal-navigation/__tests__/`. Design notes:
`docs/temporal-navigation-layer-v1.md`.

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
