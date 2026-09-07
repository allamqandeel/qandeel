# T-10.0 Motion Lab — prototype shootout (DISPOSABLE)

**Status:** exploration only. NO PRODUCTION MOTION FROZEN. Nothing in this directory is a Product
decision, a frozen constant, or a mount. It exists so a human can look at three genuinely
different motion directions over the same truth and pick a Motion North Star.

## What it is

- `truth/` — one scripted fixture world (`lab-world.ts`) that produces wire-legal disclosures for
  every `(Session, TC, depth)`; the REAL canonical store with the REAL T-04 / T-06 / T-07
  authorities (`lab-store.ts`); the projection provider that answers through T-04's own context
  builder and freshness rule (`lab-projection.ts`); and the act layer, where every act reaches
  exactly one existing executor and is tagged with the cause the presentation may read afterwards
  (`lab-acts.ts`).
- `motion/` — the three directions as data (`profiles.ts`), the residual presentation camera in
  plain arithmetic (`presentation-camera.ts`), its Reanimated binding with the finger, momentum,
  re-basing and per-act choreography (`useLabCamera.ts`), and the presented-set rules
  (`world-presence.ts`).
- `world/` — the Skia plane, one node component with its presence choreography, and the surface
  that composes store, preview, projection and camera.
- `harness/` — the developer instrument: direction picker, reduced motion, Arabic copy, RTL,
  Ignition toggle, the identical scenarios S1–S5, a frame-time meter, and the store's answers.

Inside the phone frame the temporal layer is T-06's real `TemporalTargetLayer` (T-05 presentation,
scrub, preview, commit, Live edge, accessible routes) and the chrome is T-08's real
`OrientationChrome` with its frozen bilingual copy. The lab adds only the presentation of the world.

## How to run (local launcher, never committed)

The lab is mounted by a LOCAL, untracked launcher that points Expo Router at a root outside
`src/app` (`apps/mobile/app.config.js` + `apps/mobile/motion-lab-app/`), so the production
technical shell stays byte-identical and unmounted. On the web renderer the launcher loads
CanvasKit before any Skia module evaluates and serves `canvaskit.wasm` from `apps/mobile/public/`.

    cd apps/mobile
    set EXPO_NO_WEB_SETUP=1              # the web-platform check reads the static app.json
    npx expo start --dev-client --web --port 8085
                                         # web harness (this machine has no emulator); run it from
                                         # apps/mobile — the root `start:mobile` script swallows flags
    npx expo start --go                  # Expo Go on a phone (Skia, Reanimated 4 and Gesture
                                         # Handler are included in Expo Go for SDK 57)

The web renderer needs `react-native-web`, which the repository does NOT declare: install it into
`node_modules` only (`npm install --no-save react-native-web@0.21.2` after a clean `npm ci`). The
captures behind the comparison matrix were driven in real Chrome over the DevTools protocol; the
in-app preview pane throttles animation frames and is not a measurement surface.

## Guards

- `__tests__/isolation.test.ts` proves production code cannot import the lab, that the lab consumes
  production only through public barrels, adds no dependency, and never reaches a store dispatch
  except through the executors that already exist.
- `__tests__/lab-world.test.ts` proves every fixture disclosure passes the real wire validator and
  is strictly `K(TC)`.
- `__tests__/presentation-camera.test.ts` and `__tests__/presence-and-profiles.test.ts` prove the
  re-basing arithmetic and the no-hindsight presence rules.

## Open questions for the human review

See `docs/exploration/t10-0-motion-north-star-shootout/`.
