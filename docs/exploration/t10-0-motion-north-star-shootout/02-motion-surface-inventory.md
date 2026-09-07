# T-10.0 — Repository motion-surface inventory at the canonical baseline

**Baseline:** `9d07d7dbf881a400305bde9a099ddb91a4e66416` (merged/frozen T-08; equals `origin/main`
at workspace creation, verified through `gh api` and `git ls-remote` over the QANDEEL OpenSSH alias).

## Stack actually installed at the baseline (`apps/mobile/package.json`)

| Package | Pin |
| --- | --- |
| react-native | 0.86.3 |
| expo | ~57.0.20 |
| react-native-reanimated | 4.5.1 |
| react-native-worklets | 0.10.1 |
| react-native-gesture-handler | ~2.32.0 |
| @shopify/react-native-skia | 2.6.2 (canvaskit-wasm 0.41.0 as its web dependency) |

No animation dependency was added. `react-native-web` is **not** declared by the repository; it was
installed into `node_modules` only (`npm install --no-save`, lockfile reverted and verified
untouched) as the viewing harness on this machine, which has no Android SDK, no emulator and no
Xcode. This is a harness fact for human review, not a repository change.

## Where motion already exists, and what is deliberately still

| Surface | File(s) | State at baseline | Consequence for T-10 |
| --- | --- | --- | --- |
| Map drag | `map/camera/useMapPanGesture.ts` | Pan progress held in **React state** (`setProgress` per gesture frame), `.runOnJS(true)`; one canonical `PAN` at gesture end; cancel discards progress; comment: "Smooth, interruptible motion is T-10's". | The one JS-render-per-frame path in the repo. The lab replaces it (in the lab only) with UI-runtime shared values and a rest-time commit. |
| Map paint | `map/renderer/MapCanvas.tsx` | Structural Skia renderer; neutral greys; the world plane is one `Group` offset by the drag translation; the register is screen space. | The lab keeps exactly this structure (plane `Group` + screen-space register) and adds the residual camera. |
| Map composition | `map/renderer/MapSurface.tsx` | Subscribes to the whole canonical state; ONE freshness rule; empty surface when the projection is not this Map's; RN responder tap → `inspectObject`. | The lab subscribes the same way and hit-tests through the same `placeScene`. |
| Semantic Zoom | `map/camera/zoom.ts` | Depth step + ×8 geometric reinforcement, anchor unchanged. | The reinforcement is the quantity the lab's `zoom` residual resolves through (k = 8). |
| Timeline strip | `temporal-navigation/motion/temporal-motion.ts`, `useTemporalMotion.ts` | Four transitions, all under 300 ms: cursor retarget 140, presence 160, commit settle 200 (scale 1.06), cancel 240 critically damped; finger tracked 1:1 with no easing; reduced motion → every movement 0 ms, presence opacity bridge kept; rejected: presentation scrolling, Map cross-fade, camera fly-to, live pulse, ghosts/trails. | Reused as-is inside the lab (production component). Its rejections are treated as prior art for the world: no ghost, no cross-fade across a temporal commit, no idle pulse. |
| Timeline scrub | `timeline-integration/useTemporalScrub.ts`, `scrub.ts` | Worklet gesture writes `fingerX`/`tracking`; `scheduleOnRN` only at a step crossing and at settle; interaction epochs; one coordinator per surface. | The lab's pan follows the same threading discipline (epoch, forwarder-like box, rest-time hop). |
| T-05 presentation | `timeline/**` | FlatList window; never animated (frozen: scrolling is a hundreds-a-day action). | Untouched. |
| Return acts | `return-navigation/**` | Pure TypeScript; "animates nothing"; six executors behind one seam; contract forbids any motion vocabulary in the layer. | Consumed through the barrel only; the lab marks the cause after the act to choose the choreography. |
| Orientation chrome | `orientation-chrome/**` | No animation, no measurement, no gesture; pressed state is a static opacity swap ("Motion is T-10's"); the contract permanently forbids motion in the **truth** modules and allows it in the components. | Mounted unchanged inside the lab; not animated in T-10.0 (chrome motion is production T-10's decision, not the shootout's). |
| App shell | `app/_layout.tsx`, `app/index.tsx`, `shell/FoundationShell.tsx` | Mount nothing Product. | Untouched; the lab is mounted by a local, untracked router root. |

## Contract guards a motion task must respect (all still green with the lab present)

- `inspection-orientation-return-chrome-contract`: truth modules may never reach an animation,
  measurement, scheduling or gesture API (transitive closure); components may.
- `return-navigation-layer-contract`: no production file outside the return layer may deep-import
  it or name its internals; the layer itself may own no motion vocabulary.
- `living-analysis-map-runtime-contract` / `temporal-navigation-layer-contract`: the two-file
  router root and the technical shell stay byte-identical; T-05 stays byte-identical.
- `canonical-home-placement-engine-contract`: the placement vocabulary is forbidden outside the Map.
- `forward-safety-contract`: a T-10 motion module and Reanimated inside the chrome components are
  explicitly authorized future work.

Run at this baseline with the lab in the tree: 168 contract tests pass, 0 fail; the mobile Jest
suite is 82 suites / 858 tests green (including the lab's own 23).
